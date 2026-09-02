'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireSession } from '@/lib/auth/current';
import { getDb, schema } from '@/lib/db';
import { requireOpAccess } from '@/lib/data/access';
import { SLOTS, type Slot } from '@/lib/domain';

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
  revalidatePath(`/op/${parsed.data.operationId}/menu`);
  revalidatePath(`/op/${parsed.data.operationId}/shopping`);
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
  revalidatePath(`/op/${parsed.data.operationId}/menu`);
  revalidatePath(`/op/${parsed.data.operationId}/shopping`);
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
  revalidatePath(`/op/${parsed.data.operationId}/menu`);
  revalidatePath(`/op/${parsed.data.operationId}/shopping`);
}
