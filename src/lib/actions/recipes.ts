'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireSession } from '@/lib/auth/current';
import { getDb, schema } from '@/lib/db';
import { requireOpAccess } from '@/lib/data/access';
import { RECIPE_CATEGORIES } from '@/lib/domain';
import { parseIngredientList } from '@/lib/recipe-parse';
import { tagsFor } from '@/lib/allergens';

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

/* -------------------------------------------------------------------------- */
/* Editing an existing recipe                                                 */
/* -------------------------------------------------------------------------- */

const updateRecipeSchema = recipeSchema.extend({ recipeId: z.string().uuid() });

/** Changes a recipe's details in place. Previously a typo meant delete and rebuild. */
export async function updateRecipe(formData: FormData): Promise<void> {
  const parsed = updateRecipeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  await assertMember(parsed.data.operationId);

  const tags = parsed.data.tags.split(',').map((t) => t.trim().toLowerCase()).filter((t) => t !== '');
  const burners = Number(parsed.data.burners);

  await getDb().update(schema.recipes)
    .set({
      name: parsed.data.name,
      category: parsed.data.category,
      tags,
      method: parsed.data.method === '' ? null : parsed.data.method,
      burners: Number.isFinite(burners) ? Math.max(0, Math.trunc(burners)) : 0,
    })
    .where(and(
      eq(schema.recipes.id, parsed.data.recipeId),
      eq(schema.recipes.operationId, parsed.data.operationId),
    ));

  revalidateRecipePaths(parsed.data.operationId);
}

const recipeLineRefSchema = z.object({
  operationId: z.string().uuid(),
  recipeId: z.string().uuid(),
  ingredientId: z.string().uuid(),
});

/**
 * Checks the recipe belongs to this operation before touching its lines.
 * Without this a known recipe id from another operation could be edited.
 */
async function recipeInOperation(recipeId: string, operationId: string): Promise<boolean> {
  const rows = await getDb().select({ id: schema.recipes.id }).from(schema.recipes)
    .where(and(eq(schema.recipes.id, recipeId), eq(schema.recipes.operationId, operationId)))
    .limit(1);
  return rows.length > 0;
}

/** Drops a single ingredient line, rather than the whole recipe. */
export async function removeRecipeIngredient(formData: FormData): Promise<void> {
  const parsed = recipeLineRefSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  await assertMember(parsed.data.operationId);
  if (!await recipeInOperation(parsed.data.recipeId, parsed.data.operationId)) return;

  await getDb().delete(schema.recipeIngredients).where(and(
    eq(schema.recipeIngredients.recipeId, parsed.data.recipeId),
    eq(schema.recipeIngredients.ingredientId, parsed.data.ingredientId),
  ));

  revalidateRecipePaths(parsed.data.operationId);
}

const updateLineSchema = recipeLineRefSchema.extend({
  qtyPerServing: decimal,
  unit: z.string().trim().min(1),
});

/** Adjusts the quantity or unit of one line in place. */
export async function updateRecipeIngredient(formData: FormData): Promise<void> {
  const parsed = updateLineSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  await assertMember(parsed.data.operationId);
  if (!await recipeInOperation(parsed.data.recipeId, parsed.data.operationId)) return;

  await getDb().update(schema.recipeIngredients)
    .set({
      qtyPerServing: parsed.data.qtyPerServing === '' ? '0' : parsed.data.qtyPerServing,
      unit: parsed.data.unit,
    })
    .where(and(
      eq(schema.recipeIngredients.recipeId, parsed.data.recipeId),
      eq(schema.recipeIngredients.ingredientId, parsed.data.ingredientId),
    ));

  revalidateRecipePaths(parsed.data.operationId);
}

function revalidateRecipePaths(operationId: string): void {
  revalidatePath(`/op/${operationId}/food/recipes`);
  revalidatePath(`/op/${operationId}/food/menu`);
  revalidatePath(`/op/${operationId}/food/shopping`);
  revalidatePath(`/op/${operationId}/food/check`);
  revalidatePath(`/op/${operationId}/food/brief`);
}

/* -------------------------------------------------------------------------- */
/* Writing a whole ingredient list in one go                                  */
/* -------------------------------------------------------------------------- */

const pasteSchema = z.object({
  operationId: z.string().uuid(),
  recipeId: z.string().uuid(),
  text: z.string(),
});

/**
 * Takes a typed or pasted ingredient list and writes the whole recipe at once.
 *
 * The one-ingredient-per-submit form made a ten-line recipe twenty round trips,
 * which is why a Food Unit Leader would sooner keep the dish on paper. This
 * matches each line to an existing ingredient by name and creates the ones that
 * are new.
 *
 * Two things it will not do quietly, because both would mislead later:
 * an ingredient it invents has no price, so the recipe would cost nothing; and
 * an ingredient the allergen knowledge base does not recognise produces no
 * warning on the safety check. Both are counted and named back to the user.
 */
export async function addIngredientsFromText(formData: FormData): Promise<void> {
  const parsed = pasteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const { operationId, recipeId, text } = parsed.data;
  await assertMember(operationId);
  if (!await recipeInOperation(recipeId, operationId)) return;

  const { lines, unparsed } = parseIngredientList(text);
  const back = `/op/${operationId}/food/recipes`;
  if (lines.length === 0) {
    // Names, not a count, so the same banner can show what was skipped either way.
    const skipped = new URLSearchParams({ paste: 'none' });
    if (unparsed.length > 0) skipped.set('unreadable', unparsed.slice(0, 5).join('|'));
    redirect(`${back}?${skipped.toString()}#recipe-${recipeId}`);
  }

  const db = getDb();
  const existing = await db.select().from(schema.ingredients)
    .where(eq(schema.ingredients.operationId, operationId));
  const byName = new Map(existing.map((i) => [i.name.trim().toLowerCase(), i.id]));

  const createdNames: string[] = [];
  for (const line of lines) {
    const key = line.name.toLowerCase();
    if (byName.has(key)) continue;
    const [row] = await db.insert(schema.ingredients).values({
      operationId,
      name: line.name,
      category: 'pantry',
      defaultUnit: line.unit,
      unitCost: '0',
    }).returning({ id: schema.ingredients.id });
    if (row === undefined) continue;
    byName.set(key, row.id);
    createdNames.push(line.name);
  }

  const already = await db.select({ ingredientId: schema.recipeIngredients.ingredientId })
    .from(schema.recipeIngredients)
    .where(eq(schema.recipeIngredients.recipeId, recipeId));
  const haveLine = new Set(already.map((r) => r.ingredientId));

  let written = 0;
  for (const line of lines) {
    const ingredientId = byName.get(line.name.toLowerCase());
    if (ingredientId === undefined) continue;
    const values = { qtyPerServing: String(line.qty), unit: line.unit };
    if (haveLine.has(ingredientId)) {
      // A repeated ingredient replaces its line rather than adding a second one,
      // which would double the quantity on the shopping list.
      await db.update(schema.recipeIngredients).set(values).where(and(
        eq(schema.recipeIngredients.recipeId, recipeId),
        eq(schema.recipeIngredients.ingredientId, ingredientId),
      ));
    } else {
      await db.insert(schema.recipeIngredients).values({ recipeId, ingredientId, ...values });
      haveLine.add(ingredientId);
    }
    written += 1;
  }

  revalidateRecipePaths(operationId);

  // Named back so the gaps are visible rather than discovered during service.
  const unknownAllergens = createdNames.filter((n) => tagsFor(n).length === 0);
  const params = new URLSearchParams({ paste: 'ok', added: String(written) });
  if (createdNames.length > 0) params.set('created', createdNames.slice(0, 8).join('|'));
  if (unknownAllergens.length > 0) params.set('unchecked', unknownAllergens.slice(0, 8).join('|'));
  if (unparsed.length > 0) params.set('unreadable', unparsed.slice(0, 5).join('|'));
  redirect(`${back}?${params.toString()}#recipe-${recipeId}`);
}

/** Prices an ingredient after the fact — the gap a pasted list leaves behind. */
const priceSchema = z.object({
  operationId: z.string().uuid(),
  ingredientId: z.string().uuid(),
  unitCost: decimal,
  packSize: decimal,
  packUnit: z.string().trim(),
  packCost: decimal,
});

export async function setIngredientPrice(formData: FormData): Promise<void> {
  const parsed = priceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  await assertMember(parsed.data.operationId);

  await getDb().update(schema.ingredients)
    .set({
      unitCost: parsed.data.unitCost === '' ? '0' : parsed.data.unitCost,
      packSize: parsed.data.packSize === '' ? null : parsed.data.packSize,
      packUnit: parsed.data.packUnit === '' ? null : parsed.data.packUnit,
      packCost: parsed.data.packCost === '' ? null : parsed.data.packCost,
    })
    .where(and(
      eq(schema.ingredients.id, parsed.data.ingredientId),
      eq(schema.ingredients.operationId, parsed.data.operationId),
    ));
  revalidateRecipePaths(parsed.data.operationId);
}

/** Duplicates a recipe so a variation starts from a working dish. */
export async function copyRecipe(formData: FormData): Promise<void> {
  const parsed = deleteRecipeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  await assertMember(parsed.data.operationId);

  const db = getDb();
  const [source] = await db.select().from(schema.recipes).where(and(
    eq(schema.recipes.id, parsed.data.recipeId),
    eq(schema.recipes.operationId, parsed.data.operationId),
  )).limit(1);
  if (source === undefined) return;

  const [copy] = await db.insert(schema.recipes).values({
    operationId: source.operationId,
    name: `${source.name} (copy)`,
    category: source.category,
    tags: source.tags,
    method: source.method,
    burners: source.burners,
  }).returning({ id: schema.recipes.id });
  if (copy === undefined) return;

  const lines = await db.select().from(schema.recipeIngredients)
    .where(eq(schema.recipeIngredients.recipeId, source.id));
  if (lines.length > 0) {
    await db.insert(schema.recipeIngredients).values(lines.map((l) => ({
      recipeId: copy.id,
      ingredientId: l.ingredientId,
      qtyPerServing: l.qtyPerServing,
      unit: l.unit,
    })));
  }

  revalidateRecipePaths(parsed.data.operationId);
}
