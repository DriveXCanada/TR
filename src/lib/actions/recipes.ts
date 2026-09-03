'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireSession } from '@/lib/auth/current';
import { getDb, schema } from '@/lib/db';
import { requireOpAccess } from '@/lib/data/access';
import { RECIPE_CATEGORIES } from '@/lib/domain';

async function assertMember(operationId: string): Promise<void> {
  const session = await requireSession();
  await requireOpAccess(operationId, session);
}

const decimal = z.string().trim().refine(
  (v) => v === '' || (Number.isFinite(Number(v)) && Number(v) >= 0),
  'Must be a non-negative number.',
);

const ingredientSchema = z.object({
  operationId: z.string().uuid(),
  name: z.string().trim().min(1),
  category: z.string().trim().min(1),
  defaultUnit: z.string().trim().min(1),
  unitCost: decimal,
  packSize: decimal,
  packUnit: z.string().trim(),
  packCost: decimal,
});

export async function createIngredient(formData: FormData): Promise<void> {
  const parsed = ingredientSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  await assertMember(parsed.data.operationId);

  await getDb().insert(schema.ingredients).values({
    operationId: parsed.data.operationId,
    name: parsed.data.name,
    category: parsed.data.category,
    defaultUnit: parsed.data.defaultUnit,
    unitCost: parsed.data.unitCost === '' ? '0' : parsed.data.unitCost,
    packSize: parsed.data.packSize === '' ? null : parsed.data.packSize,
    packUnit: parsed.data.packUnit === '' ? null : parsed.data.packUnit,
    packCost: parsed.data.packCost === '' ? null : parsed.data.packCost,
  });
  revalidatePath(`/op/${parsed.data.operationId}/food/recipes`);
}

const onHandSchema = z.object({
  operationId: z.string().uuid(),
  ingredientId: z.string().uuid(),
  haveOnHand: decimal,
});

export async function setHaveOnHand(formData: FormData): Promise<void> {
  const parsed = onHandSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  await assertMember(parsed.data.operationId);

  await getDb().update(schema.ingredients)
    .set({ haveOnHand: parsed.data.haveOnHand === '' ? '0' : parsed.data.haveOnHand })
    .where(and(
      eq(schema.ingredients.id, parsed.data.ingredientId),
      eq(schema.ingredients.operationId, parsed.data.operationId),
    ));
  revalidatePath(`/op/${parsed.data.operationId}/food/shopping`);
  revalidatePath(`/op/${parsed.data.operationId}/food/recipes`);
}

const recipeSchema = z.object({
  operationId: z.string().uuid(),
  name: z.string().trim().min(1),
  category: z.enum(RECIPE_CATEGORIES),
  method: z.string().trim(),
  burners: z.string().trim(),
  tags: z.string().trim(),
});

export async function createRecipe(formData: FormData): Promise<void> {
  const parsed = recipeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  await assertMember(parsed.data.operationId);

  const tags = parsed.data.tags.split(',').map((t) => t.trim().toLowerCase()).filter((t) => t !== '');
  const burners = Number(parsed.data.burners);

  await getDb().insert(schema.recipes).values({
    operationId: parsed.data.operationId,
    name: parsed.data.name,
    category: parsed.data.category,
    tags,
    method: parsed.data.method === '' ? null : parsed.data.method,
    burners: Number.isFinite(burners) ? Math.max(0, Math.trunc(burners)) : 0,
  });
  revalidatePath(`/op/${parsed.data.operationId}/food/recipes`);
  revalidatePath(`/op/${parsed.data.operationId}/food/menu`);
}

const recipeLineSchema = z.object({
  operationId: z.string().uuid(),
  recipeId: z.string().uuid(),
  ingredientId: z.string().uuid(),
  qtyPerServing: decimal,
  unit: z.string().trim().min(1),
});

export async function addRecipeIngredient(formData: FormData): Promise<void> {
  const parsed = recipeLineSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  await assertMember(parsed.data.operationId);

  const db = getDb();
  // Both the recipe and the ingredient must belong to this operation.
  const [recipe, ingredient] = await Promise.all([
    db.select().from(schema.recipes).where(and(
      eq(schema.recipes.id, parsed.data.recipeId),
      eq(schema.recipes.operationId, parsed.data.operationId),
    )).limit(1),
    db.select().from(schema.ingredients).where(and(
      eq(schema.ingredients.id, parsed.data.ingredientId),
      eq(schema.ingredients.operationId, parsed.data.operationId),
    )).limit(1),
  ]);
  if (recipe.length === 0 || ingredient.length === 0) return;

  await db.insert(schema.recipeIngredients).values({
    recipeId: parsed.data.recipeId,
    ingredientId: parsed.data.ingredientId,
    qtyPerServing: parsed.data.qtyPerServing === '' ? '0' : parsed.data.qtyPerServing,
    unit: parsed.data.unit,
  });
  revalidatePath(`/op/${parsed.data.operationId}/food/recipes`);
  revalidatePath(`/op/${parsed.data.operationId}/food/shopping`);
}

const deleteRecipeSchema = z.object({
  operationId: z.string().uuid(),
  recipeId: z.string().uuid(),
});

export async function deleteRecipe(formData: FormData): Promise<void> {
  const parsed = deleteRecipeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  await assertMember(parsed.data.operationId);

  await getDb().delete(schema.recipes).where(and(
    eq(schema.recipes.id, parsed.data.recipeId),
    eq(schema.recipes.operationId, parsed.data.operationId),
  ));
  revalidatePath(`/op/${parsed.data.operationId}/food/recipes`);
  revalidatePath(`/op/${parsed.data.operationId}/food/menu`);
}
