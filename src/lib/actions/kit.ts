'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireSession } from '@/lib/auth/current';
import { getDb, schema } from '@/lib/db';
import { requireOpAccess } from '@/lib/data/access';
import { ISSUE_POLICIES, KIT_CATEGORIES } from '@/lib/kit';
import { SIZE_SCHEMES } from '@/lib/sizes';
import { templateByKey } from '@/lib/kit-templates';

async function assertMember(operationId: string): Promise<void> {
  const session = await requireSession();
  await requireOpAccess(operationId, session);
}

export interface KitState { readonly error?: string; readonly ok?: string; }

const number = z.string().trim().refine(
  (v) => v === '' || (Number.isFinite(Number(v)) && Number(v) >= 0),
  'Must be a non-negative number.',
);

const itemSchema = z.object({
  operationId: z.string().uuid(),
  name: z.string().trim().min(1, 'Give the item a name.').max(120),
  category: z.enum(KIT_CATEGORIES),
  issuePolicy: z.enum(ISSUE_POLICIES),
  intervalDays: number,
  qtyPerPerson: number,
  unit: z.string().trim().min(1).max(20),
  sizeScheme: z.union([z.enum(SIZE_SCHEMES), z.literal('')]),
  stockOnHand: number,
  reorderLevel: number,
  leadTimeDays: number,
});

const int = (v: string, fallback: number): number => {
  const n = Math.trunc(Number(v));
  return v === '' || !Number.isFinite(n) ? fallback : Math.max(0, n);
};

export async function createKitItem(_prev: KitState, formData: FormData): Promise<KitState> {
  const parsed = itemSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the details.' };
  await assertMember(parsed.data.operationId);

  await getDb().insert(schema.kitItems).values({
    operationId: parsed.data.operationId,
    name: parsed.data.name,
    category: parsed.data.category,
    issuePolicy: parsed.data.issuePolicy,
    intervalDays: Math.max(1, int(parsed.data.intervalDays, 1)),
    qtyPerPerson: parsed.data.qtyPerPerson === '' ? '1' : parsed.data.qtyPerPerson,
    unit: parsed.data.unit,
    sizeScheme: parsed.data.sizeScheme === '' ? null : parsed.data.sizeScheme,
    stockOnHand: parsed.data.stockOnHand === '' ? '0' : parsed.data.stockOnHand,
    reorderLevel: parsed.data.reorderLevel === '' ? '0' : parsed.data.reorderLevel,
    leadTimeDays: int(parsed.data.leadTimeDays, 2),
  });

  revalidatePath(`/op/${parsed.data.operationId}/logistics/inventory`);
  return { ok: `Added ${parsed.data.name}.` };
}

const updateSchema = itemSchema.extend({ itemId: z.string().uuid() });

export async function updateKitItem(formData: FormData): Promise<void> {
  const parsed = updateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  await assertMember(parsed.data.operationId);

  await getDb().update(schema.kitItems).set({
    name: parsed.data.name,
    category: parsed.data.category,
    issuePolicy: parsed.data.issuePolicy,
    intervalDays: Math.max(1, int(parsed.data.intervalDays, 1)),
    qtyPerPerson: parsed.data.qtyPerPerson === '' ? '1' : parsed.data.qtyPerPerson,
    unit: parsed.data.unit,
    sizeScheme: parsed.data.sizeScheme === '' ? null : parsed.data.sizeScheme,
    stockOnHand: parsed.data.stockOnHand === '' ? '0' : parsed.data.stockOnHand,
    reorderLevel: parsed.data.reorderLevel === '' ? '0' : parsed.data.reorderLevel,
    leadTimeDays: int(parsed.data.leadTimeDays, 2),
  }).where(and(
    eq(schema.kitItems.id, parsed.data.itemId),
    eq(schema.kitItems.operationId, parsed.data.operationId),
  ));

  revalidatePath(`/op/${parsed.data.operationId}/logistics/inventory`);
}

/** Fast path used from the stock column — logistics counts a shelf, types one number. */
const stockSchema = z.object({
  operationId: z.string().uuid(),
  itemId: z.string().uuid(),
  stockOnHand: number,
});

export async function setStock(formData: FormData): Promise<void> {
  const parsed = stockSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  await assertMember(parsed.data.operationId);

  await getDb().update(schema.kitItems)
    .set({ stockOnHand: parsed.data.stockOnHand === '' ? '0' : parsed.data.stockOnHand })
    .where(and(
      eq(schema.kitItems.id, parsed.data.itemId),
      eq(schema.kitItems.operationId, parsed.data.operationId),
    ));

  revalidatePath(`/op/${parsed.data.operationId}/logistics/inventory`);
}

const deleteSchema = z.object({ operationId: z.string().uuid(), itemId: z.string().uuid() });

export async function deleteKitItem(formData: FormData): Promise<void> {
  const parsed = deleteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  await assertMember(parsed.data.operationId);

  await getDb().delete(schema.kitItems).where(and(
    eq(schema.kitItems.id, parsed.data.itemId),
    eq(schema.kitItems.operationId, parsed.data.operationId),
  ));
  revalidatePath(`/op/${parsed.data.operationId}/logistics/inventory`);
}

const templateSchema = z.object({
  operationId: z.string().uuid(),
  templateKey: z.string().trim().min(1),
});

/**
 * Loads a standard loadout. Additive and matched by name, so it can be run
 * twice, and layering "chainsaw" on top of "general" never duplicates the base
 * PPE or overwrites a stock count someone has already entered.
 */
export async function loadKitTemplate(formData: FormData): Promise<void> {
  const parsed = templateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  await assertMember(parsed.data.operationId);

  const template = templateByKey(parsed.data.templateKey);
  if (template === undefined) return;

  const db = getDb();
  const existing = await db.select().from(schema.kitItems)
    .where(eq(schema.kitItems.operationId, parsed.data.operationId));
  const have = new Set(existing.map((i) => i.name.toLowerCase()));

  for (const item of template.items) {
    if (have.has(item.name.toLowerCase())) continue;
    await db.insert(schema.kitItems).values({
      operationId: parsed.data.operationId,
      name: item.name,
      category: item.category,
      issuePolicy: item.issuePolicy,
      intervalDays: item.intervalDays ?? 1,
      qtyPerPerson: String(item.qtyPerPerson),
      unit: item.unit,
      sizeScheme: item.sizeScheme ?? null,
      stockOnHand: '0',
      reorderLevel: '0',
      leadTimeDays: item.leadTimeDays ?? 2,
      notes: item.notes ?? null,
    });
    have.add(item.name.toLowerCase());
  }

  revalidatePath(`/op/${parsed.data.operationId}/logistics/inventory`);
}
