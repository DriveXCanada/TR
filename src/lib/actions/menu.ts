'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireSession } from '@/lib/auth/current';
import { getDb, schema } from '@/lib/db';
import { requireOpAccess } from '@/lib/data/access';
import { SLOTS, type Slot } from '@/lib/domain';
import { loadSnapshot } from '@/lib/data/access';
import { servingsFor } from '@/lib/menu-cost';
import { consumptionForSlot, drawFrom, applyReturn } from '@/lib/serving';

const slotEnum = z.enum(SLOTS);

async function assertMember(operationId: string): Promise<void> {
  const session = await requireSession();
  await requireOpAccess(operationId, session);
}

/** Find or create the menu slot row for a day + slot. */
async function slotId(operationId: string, day: string, slot: Slot): Promise<string> {
  const db = getDb();
  const found = await db.select().from(schema.menuSlots).where(and(
    eq(schema.menuSlots.operationId, operationId),
    eq(schema.menuSlots.day, day),
    eq(schema.menuSlots.slot, slot),
  )).limit(1);
  const existing = found[0]?.id;
  if (existing !== undefined) return existing;

  const created = await db.insert(schema.menuSlots)
    .values({ operationId, day, slot, servings: null }).returning();
  const id = created[0]?.id;
  if (id === undefined) throw new Error('Could not create the menu slot.');
  return id;
}

const addSchema = z.object({
  operationId: z.string().uuid(),
  day: z.string().min(1),
  slot: slotEnum,
  recipeId: z.string().uuid(),
});

export async function addDish(formData: FormData): Promise<void> {
  const parsed = addSchema.safeParse({
    operationId: formData.get('operationId'),
    day: formData.get('day'),
    slot: formData.get('slot'),
    recipeId: formData.get('recipeId'),
  });
  if (!parsed.success) return;
  await assertMember(parsed.data.operationId);

  const db = getDb();
  const recipe = await db.select().from(schema.recipes).where(and(
    eq(schema.recipes.id, parsed.data.recipeId),
    eq(schema.recipes.operationId, parsed.data.operationId),
  )).limit(1);
  const found = recipe[0];
  if (found === undefined) return;

  // Lunch is a packed field lunch. Enforced here too — a crafted POST must not
  // be able to put a hot dish into the lunch slot.
  if (parsed.data.slot === 'lunch' && !found.tags.includes('pack')) return;

  const id = await slotId(parsed.data.operationId, parsed.data.day, parsed.data.slot);
  await db.insert(schema.menuSlotItems).values({ menuSlotId: id, recipeId: found.id, adHocName: null });
  revalidatePath(`/op/${parsed.data.operationId}/food/menu`);
  revalidatePath(`/op/${parsed.data.operationId}/food/shopping`);
}

const removeSchema = z.object({
  operationId: z.string().uuid(),
  itemId: z.string().uuid(),
});

export async function removeDish(formData: FormData): Promise<void> {
  const parsed = removeSchema.safeParse({
    operationId: formData.get('operationId'),
    itemId: formData.get('itemId'),
  });
  if (!parsed.success) return;
  await assertMember(parsed.data.operationId);

  const db = getDb();
  // Only delete an item that belongs to a slot in THIS operation.
  const rows = await db.select({ itemId: schema.menuSlotItems.id })
    .from(schema.menuSlotItems)
    .innerJoin(schema.menuSlots, eq(schema.menuSlotItems.menuSlotId, schema.menuSlots.id))
    .where(and(
      eq(schema.menuSlotItems.id, parsed.data.itemId),
      eq(schema.menuSlots.operationId, parsed.data.operationId),
    )).limit(1);
  if (rows.length === 0) return;

  await db.delete(schema.menuSlotItems).where(eq(schema.menuSlotItems.id, parsed.data.itemId));
  revalidatePath(`/op/${parsed.data.operationId}/food/menu`);
  revalidatePath(`/op/${parsed.data.operationId}/food/shopping`);
}

const servingsSchema = z.object({
  operationId: z.string().uuid(),
  day: z.string().min(1),
  slot: slotEnum,
  servings: z.string(),
});

export async function setServings(formData: FormData): Promise<void> {
  const parsed = servingsSchema.safeParse({
    operationId: formData.get('operationId'),
    day: formData.get('day'),
    slot: formData.get('slot'),
    servings: formData.get('servings'),
  });
  if (!parsed.success) return;
  await assertMember(parsed.data.operationId);

  const raw = parsed.data.servings.trim();
  // Blank means "follow the headcount" — that is the safe default, not zero.
  const value = raw === '' ? null : Math.max(0, Math.trunc(Number(raw)));
  if (value !== null && !Number.isFinite(value)) return;

  const id = await slotId(parsed.data.operationId, parsed.data.day, parsed.data.slot);
  await getDb().update(schema.menuSlots).set({ servings: value }).where(eq(schema.menuSlots.id, id));
  revalidatePath(`/op/${parsed.data.operationId}/food/menu`);
  revalidatePath(`/op/${parsed.data.operationId}/food/shopping`);
}

// --- Starter library --------------------------------------------------------

/**
 * Loads the standard field-kitchen catalogue into an operation.
 *
 * A new operation starts with no ingredients and no recipes, so the planner has
 * nothing to offer and a Food Unit Leader faces a blank page and an evening of
 * typing before the tool does anything for them. This seeds the same priced
 * catalogue and recipe book the sample deployment uses — including the packed
 * lunch options — and skips anything already present by name, so it is safe to
 * run twice and never overwrites a recipe someone has edited.
 */
export async function loadStarterLibrary(formData: FormData): Promise<void> {
  const operationId = z.string().uuid().safeParse(formData.get('operationId'));
  if (!operationId.success) return;
  await assertMember(operationId.data);

  const { INGREDIENTS, RECIPES } = await import('@/lib/db/seed-data');
  const db = getDb();

  const existingIngredients = await db.select().from(schema.ingredients)
    .where(eq(schema.ingredients.operationId, operationId.data));
  const ingredientIdByName = new Map(existingIngredients.map((i) => [i.name.toLowerCase(), i.id]));

  for (const item of INGREDIENTS) {
    if (ingredientIdByName.has(item.name.toLowerCase())) continue;
    const row = await db.insert(schema.ingredients).values({
      operationId: operationId.data,
      name: item.name,
      category: item.category,
      defaultUnit: item.defaultUnit,
      unitCost: item.unitCost,
      packSize: item.packSize ?? null,
      packUnit: item.packUnit ?? null,
      packCost: item.packCost ?? null,
      haveOnHand: '0',
    }).returning();
    const id = row[0]?.id;
    if (id !== undefined) ingredientIdByName.set(item.name.toLowerCase(), id);
  }

  const existingRecipes = await db.select().from(schema.recipes)
    .where(eq(schema.recipes.operationId, operationId.data));
  const recipeNames = new Set(existingRecipes.map((r) => r.name.toLowerCase()));

  // seed-data keys ingredients by short key; map key -> catalogue name -> id.
  const nameByKey = new Map(INGREDIENTS.map((i) => [i.key, i.name.toLowerCase()]));

  for (const recipe of RECIPES) {
    if (recipeNames.has(recipe.name.toLowerCase())) continue;
    const row = await db.insert(schema.recipes).values({
      operationId: operationId.data,
      name: recipe.name,
      category: recipe.category,
      tags: recipe.tags,
      method: recipe.method,
      burners: recipe.burners,
    }).returning();
    const recipeId = row[0]?.id;
    if (recipeId === undefined) continue;

    for (const line of recipe.items) {
      const ingredientName = nameByKey.get(line.key);
      const ingredientId = ingredientName === undefined ? undefined : ingredientIdByName.get(ingredientName);
      if (ingredientId === undefined) continue;
      await db.insert(schema.recipeIngredients).values({
        recipeId,
        ingredientId,
        qtyPerServing: String(line.qtyPerServing),
        unit: line.unit,
      });
    }
  }

  revalidatePath(`/op/${operationId.data}/food/recipes`);
  revalidatePath(`/op/${operationId.data}/food/menu`);
  revalidatePath(`/op/${operationId.data}/food/shopping`);
}

// --- Copy a day -------------------------------------------------------------

const copySchema = z.object({
  operationId: z.string().uuid(),
  fromDay: z.string().min(1),
});

/**
 * Copies one day's planned dishes onto other days, replacing whatever was there.
 *
 * A 14-day operation is 70 slots, most of them repeats. Planning one good day
 * and rolling it forward is how a field kitchen actually works.
 *
 * Servings overrides are deliberately NOT copied: headcount differs day to day,
 * so a copied override would silently cook for the wrong number of people. The
 * target days go back to following their own headcount.
 */
export async function copyDay(formData: FormData): Promise<void> {
  const parsed = copySchema.safeParse({
    operationId: formData.get('operationId'),
    fromDay: formData.get('fromDay'),
  });
  if (!parsed.success) return;
  await assertMember(parsed.data.operationId);

  const targets = formData.getAll('toDays')
    .map((v) => String(v))
    .filter((d) => d !== '' && d !== parsed.data.fromDay);
  if (targets.length === 0) return;

  const db = getDb();
  const sourceSlots = await db.select().from(schema.menuSlots).where(and(
    eq(schema.menuSlots.operationId, parsed.data.operationId),
    eq(schema.menuSlots.day, parsed.data.fromDay),
  ));
  if (sourceSlots.length === 0) return;

  const sourceItems = await db.select().from(schema.menuSlotItems);
  const itemsBySlot = new Map<string, typeof sourceItems>();
  for (const item of sourceItems) {
    const list = itemsBySlot.get(item.menuSlotId) ?? [];
    list.push(item);
    itemsBySlot.set(item.menuSlotId, list);
  }

  for (const day of targets) {
    for (const source of sourceSlots) {
      const targetId = await slotId(parsed.data.operationId, day, source.slot);
      await db.delete(schema.menuSlotItems).where(eq(schema.menuSlotItems.menuSlotId, targetId));
      for (const item of itemsBySlot.get(source.id) ?? []) {
        await db.insert(schema.menuSlotItems).values({
          menuSlotId: targetId,
          recipeId: item.recipeId,
          adHocName: item.adHocName,
        });
      }
    }
  }

  revalidatePath(`/op/${parsed.data.operationId}/food/menu`);
  revalidatePath(`/op/${parsed.data.operationId}/food/shopping`);
}

// --- Serving -----------------------------------------------------------------

const servedSchema = z.object({
  operationId: z.string().uuid(),
  day: z.string().min(1),
  slot: slotEnum,
});

/**
 * Marks a meal served and draws the ingredients out of the pantry.
 *
 * Idempotent: a slot already marked served is left alone, so a double tap on a
 * phone cannot deduct twice. The servings count is snapshotted so that undoing
 * reverses exactly the amount that was taken.
 */
export async function markSlotServed(formData: FormData): Promise<void> {
  const parsed = servedSchema.safeParse({
    operationId: formData.get('operationId'),
    day: formData.get('day'),
    slot: formData.get('slot'),
  });
  if (!parsed.success) return;
  const session = await requireSession();
  await requireOpAccess(parsed.data.operationId, session);

  const db = getDb();
  const slotRows = await db.select().from(schema.menuSlots).where(and(
    eq(schema.menuSlots.operationId, parsed.data.operationId),
    eq(schema.menuSlots.day, parsed.data.day),
    eq(schema.menuSlots.slot, parsed.data.slot),
  )).limit(1);
  const slot = slotRows[0];
  if (slot === undefined || slot.servedAt !== null) return;   // already served

  const snapshot = await loadSnapshot(parsed.data.operationId, session);
  const view = snapshot.menu.find((m) => m.id === slot.id);
  if (view === undefined) return;

  const { servings } = servingsFor(view, snapshot.volunteers, snapshot.operation);
  if (servings <= 0) return;

  const lines = consumptionForSlot(
    view.items.map((i) => i.recipeId).filter((r): r is string => r !== null),
    snapshot.recipes.map((r) => ({
      id: r.id,
      name: r.name,
      ingredients: r.ingredients.map((i) => ({ ingredientId: i.ingredientId, qtyPerServing: i.qtyPerServing })),
    })),
    servings,
  );

  // Record what actually came out, not what the recipe asked for — see
  // drawFrom. Undo replays this list, so it can never hand back more than the
  // pantry supplied.
  const stockById = new Map(snapshot.ingredients.map((i) => [i.id, i.haveOnHand]));
  const actualDraws: { ingredientId: string; qty: number }[] = [];
  for (const line of lines) {
    const have = stockById.get(line.ingredientId);
    if (have === undefined) continue;
    const { remaining, drawn } = drawFrom(have, line.qty);
    actualDraws.push({ ingredientId: line.ingredientId, qty: drawn });
    if (drawn === 0 && remaining === have) continue;   // nothing to write
    await db.update(schema.ingredients)
      .set({ haveOnHand: String(remaining) })
      .where(and(
        eq(schema.ingredients.id, line.ingredientId),
        eq(schema.ingredients.operationId, parsed.data.operationId),
      ));
  }

  await db.update(schema.menuSlots)
    .set({ servedAt: new Date(), servedServings: servings, servedDraws: actualDraws })
    .where(eq(schema.menuSlots.id, slot.id));

  revalidatePath(`/op/${parsed.data.operationId}/food/menu`);
  revalidatePath(`/op/${parsed.data.operationId}/food/shopping`);
  revalidatePath(`/op/${parsed.data.operationId}/food/recipes`);
}

/** Reverses a serving, returning exactly what was drawn. */
export async function markSlotUnserved(formData: FormData): Promise<void> {
  const parsed = servedSchema.safeParse({
    operationId: formData.get('operationId'),
    day: formData.get('day'),
    slot: formData.get('slot'),
  });
  if (!parsed.success) return;
  const session = await requireSession();
  await requireOpAccess(parsed.data.operationId, session);

  const db = getDb();
  const slotRows = await db.select().from(schema.menuSlots).where(and(
    eq(schema.menuSlots.operationId, parsed.data.operationId),
    eq(schema.menuSlots.day, parsed.data.day),
    eq(schema.menuSlots.slot, parsed.data.slot),
  )).limit(1);
  const slot = slotRows[0];
  if (slot === undefined || slot.servedAt === null) return;

  // Replay exactly what was taken. Recomputing from the recipe would return
  // more than the pantry gave when stock was short, inventing stock.
  const draws = slot.servedDraws ?? [];
  const current = await db.select().from(schema.ingredients)
    .where(eq(schema.ingredients.operationId, parsed.data.operationId));
  const stockById = new Map(current.map((i) => [i.id, Number(i.haveOnHand)]));

  for (const draw of draws) {
    const have = stockById.get(draw.ingredientId);
    if (have === undefined || draw.qty <= 0) continue;
    await db.update(schema.ingredients)
      .set({ haveOnHand: String(applyReturn(have, draw.qty)) })
      .where(and(
        eq(schema.ingredients.id, draw.ingredientId),
        eq(schema.ingredients.operationId, parsed.data.operationId),
      ));
  }

  await db.update(schema.menuSlots)
    .set({ servedAt: null, servedServings: null, servedDraws: null })
    .where(eq(schema.menuSlots.id, slot.id));

  revalidatePath(`/op/${parsed.data.operationId}/food/menu`);
  revalidatePath(`/op/${parsed.data.operationId}/food/shopping`);
  revalidatePath(`/op/${parsed.data.operationId}/food/recipes`);
}
