'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireSession } from '@/lib/auth/current';
import { getDb, schema } from '@/lib/db';
import { requireOpAccess } from '@/lib/data/access';

async function assertMember(operationId: string): Promise<void> {
  const session = await requireSession();
  await requireOpAccess(operationId, session);
}

function newToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function rotateKioskToken(formData: FormData): Promise<void> {
  const operationId = z.string().uuid().safeParse(formData.get('operationId'));
  if (!operationId.success) return;
  await assertMember(operationId.data);

  await getDb().update(schema.operations)
    .set({ kioskToken: newToken() })
    .where(eq(schema.operations.id, operationId.data));
  revalidatePath(`/op/${operationId.data}/settings`);
}

const settingsSchema = z.object({
  operationId: z.string().uuid(),
  perPersonPerDay: z.string().trim(),
  retentionDays: z.string().trim(),
});

export async function updateSettings(formData: FormData): Promise<void> {
  const parsed = settingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  await assertMember(parsed.data.operationId);

  const rate = Number(parsed.data.perPersonPerDay);
  const retention = Number(parsed.data.retentionDays);
  if (!Number.isFinite(rate) || rate < 0) return;
  if (!Number.isFinite(retention) || retention < 1) return;

  await getDb().update(schema.operations).set({
    perPersonPerDay: rate.toFixed(2),
    retentionDays: Math.trunc(retention),
  }).where(eq(schema.operations.id, parsed.data.operationId));

  revalidatePath(`/op/${parsed.data.operationId}/settings`);
  revalidatePath(`/op/${parsed.data.operationId}`);
}

const purgeSchema = z.object({
  operationId: z.string().uuid(),
  confirm: z.string(),
});

export interface PurgeState { readonly error?: string; readonly deleted?: number; }

/**
 * Hard-deletes every volunteer and their restrictions for this operation.
 * Irreversible, so it requires the operation name typed exactly.
 */
export async function purgeNow(_prev: PurgeState, formData: FormData): Promise<PurgeState> {
  const parsed = purgeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: 'Invalid request.' };

  const session = await requireSession();
  const operation = await requireOpAccess(parsed.data.operationId, session);

  if (parsed.data.confirm.trim() !== operation.name) {
    return { error: `Type the operation name exactly — "${operation.name}" — to confirm.` };
  }

  const db = getDb();
  const rows = await db.select({ id: schema.volunteers.id }).from(schema.volunteers)
    .where(eq(schema.volunteers.operationId, parsed.data.operationId));
  // Restrictions cascade from volunteers, so one delete clears both.
  await db.delete(schema.volunteers).where(eq(schema.volunteers.operationId, parsed.data.operationId));

  revalidatePath(`/op/${parsed.data.operationId}`);
  return { deleted: rows.length };
}
