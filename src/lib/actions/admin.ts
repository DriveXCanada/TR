'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireSession } from '@/lib/auth/current';
import { getDb, schema } from '@/lib/db';
import { requireOpAccess } from '@/lib/data/access';
import { hashPin, MIN_PIN_LENGTH } from '@/lib/auth/password';
import { daysBetween } from '@/lib/presence';
import { ICS_ROLES } from '@/lib/domain';

/** Account administration is master-only. Managers cannot mint accounts. */
async function requireMaster(): Promise<void> {
  const session = await requireSession();
  if (!session.isMaster) redirect('/');
}

export interface AdminState { readonly error?: string; readonly ok?: string; }

// --- Manager accounts -------------------------------------------------------

const managerSchema = z.object({
  username: z.string().trim().min(2, 'Username must be at least 2 characters.').max(40)
    .regex(/^[a-z0-9._-]+$/i, 'Letters, numbers, dot, dash and underscore only.'),
  name: z.string().trim().min(1, 'Enter a display name.').max(80),
  pin: z.string().trim().min(MIN_PIN_LENGTH, `PIN must be at least ${MIN_PIN_LENGTH} characters.`).max(64),
});

export async function createManager(_prev: AdminState, formData: FormData): Promise<AdminState> {
  await requireMaster();
  const parsed = managerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid details.' };

  const db = getDb();
  const username = parsed.data.username.toLowerCase();
  const clash = await db.select().from(schema.users).where(eq(schema.users.username, username)).limit(1);
  if (clash.length > 0) return { error: `The username "${username}" is already taken.` };

  await db.insert(schema.users).values({
    username, name: parsed.data.name, pinHash: await hashPin(parsed.data.pin),
    isMaster: false, isActive: true,
  });
  revalidatePath('/managers');
  return { ok: `Created "${username}". Give them the PIN in person — it is not shown again.` };
}

const idSchema = z.object({ userId: z.string().uuid() });

export async function toggleManagerActive(formData: FormData): Promise<void> {
  await requireMaster();
  const parsed = idSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;

  const db = getDb();
  const rows = await db.select().from(schema.users).where(eq(schema.users.id, parsed.data.userId)).limit(1);
  const user = rows[0];
  // Never let the master lock itself out.
  if (user === undefined || user.isMaster) return;

  await db.update(schema.users).set({ isActive: !user.isActive }).where(eq(schema.users.id, user.id));
  revalidatePath('/managers');
}

const resetPinSchema = z.object({
  userId: z.string().uuid(),
  pin: z.string().trim().min(MIN_PIN_LENGTH).max(64),
});

export async function resetManagerPin(_prev: AdminState, formData: FormData): Promise<AdminState> {
  await requireMaster();
  const parsed = resetPinSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: `PIN must be at least ${MIN_PIN_LENGTH} characters.` };

  const db = getDb();
  const rows = await db.select().from(schema.users).where(eq(schema.users.id, parsed.data.userId)).limit(1);
  const user = rows[0];
  if (user === undefined || user.isMaster) return { error: 'That account cannot be changed here.' };

  await db.update(schema.users).set({ pinHash: await hashPin(parsed.data.pin) }).where(eq(schema.users.id, user.id));
  revalidatePath('/managers');
  return { ok: `PIN reset for "${user.username}".` };
}

// --- Operations -------------------------------------------------------------

const operationSchema = z.object({
  name: z.string().trim().min(1, 'Give the operation a name.').max(120),
  location: z.string().trim().min(1, 'Where is it?').max(160),
  startDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD.'),
  endDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be YYYY-MM-DD.'),
  perPersonPerDay: z.string().trim(),
});

export async function createOperation(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const session = await requireSession();
  if (!session.isMaster) return { error: 'Only the master account can create an operation.' };

  const parsed = operationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the details.' };
  if (parsed.data.endDate < parsed.data.startDate) {
    return { error: 'The end date cannot be before the start date.' };
  }

  const rate = Number(parsed.data.perPersonPerDay);
  if (!Number.isFinite(rate) || rate < 0) return { error: 'Enter a valid per-person-per-day rate.' };

  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const kioskToken = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');

  const db = getDb();
  const created = await db.insert(schema.operations).values({
    name: parsed.data.name,
    location: parsed.data.location,
    startDate: parsed.data.startDate,
    endDate: parsed.data.endDate,
    perPersonPerDay: rate.toFixed(2),
    currency: 'CAD',
    kioskToken,
    status: 'planning',
  }).returning();

  const operation = created[0];
  if (operation === undefined) return { error: 'Could not create the operation.' };

  // The creator is a lead on it, otherwise nobody can reach it.
  await db.insert(schema.operationMembers)
    .values({ operationId: operation.id, userId: session.userId, role: 'lead' })
    .onConflictDoNothing();

  // Seed a zero demand row per role per day so the resources grid has a shape
  // to edit rather than being empty.
  for (const day of daysBetween(parsed.data.startDate, parsed.data.endDate)) {
    for (const role of ICS_ROLES) {
      await db.insert(schema.resourceDemands)
        .values({ operationId: operation.id, icsRole: role, day, target: 0 })
        .onConflictDoNothing();
    }
  }

  revalidatePath('/');
  return { ok: `Created "${operation.name}".` };
}

// --- Operation membership ---------------------------------------------------

const memberSchema = z.object({
  operationId: z.string().uuid(),
  userId: z.string().uuid(),
  role: z.enum(['lead', 'assistant']),
});

export async function addOperationMember(formData: FormData): Promise<void> {
  const session = await requireSession();
  const parsed = memberSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;

  // Master, or a lead on this operation, may assign people to it.
  await requireOpAccess(parsed.data.operationId, session);
  if (!session.isMaster && !(await isLead(parsed.data.operationId, session.userId))) return;

  await getDb().insert(schema.operationMembers).values({
    operationId: parsed.data.operationId,
    userId: parsed.data.userId,
    role: parsed.data.role,
  }).onConflictDoNothing();

  revalidatePath(`/op/${parsed.data.operationId}/settings`);
}

const removeMemberSchema = z.object({
  operationId: z.string().uuid(),
  userId: z.string().uuid(),
});

export async function removeOperationMember(formData: FormData): Promise<void> {
  const session = await requireSession();
  const parsed = removeMemberSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;

  await requireOpAccess(parsed.data.operationId, session);
  if (!session.isMaster && !(await isLead(parsed.data.operationId, session.userId))) return;
  // Removing yourself would strand the operation; the master can always reach it.
  if (parsed.data.userId === session.userId) return;

  await getDb().delete(schema.operationMembers).where(and(
    eq(schema.operationMembers.operationId, parsed.data.operationId),
    eq(schema.operationMembers.userId, parsed.data.userId),
  ));
  revalidatePath(`/op/${parsed.data.operationId}/settings`);
}

async function isLead(operationId: string, userId: string): Promise<boolean> {
  const rows = await getDb().select().from(schema.operationMembers).where(and(
    eq(schema.operationMembers.operationId, operationId),
    eq(schema.operationMembers.userId, userId),
    eq(schema.operationMembers.role, 'lead'),
  )).limit(1);
  return rows.length > 0;
}
