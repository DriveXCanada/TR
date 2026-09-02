'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireSession } from '@/lib/auth/current';
import { getDb, schema } from '@/lib/db';
import { requireOpAccess } from '@/lib/data/access';
import { ICS_ROLES, MEALS, SEVERITIES } from '@/lib/domain';

export interface RosterState { readonly error?: string; readonly ok?: string; }

async function assertMember(operationId: string): Promise<void> {
  const session = await requireSession();
  await requireOpAccess(operationId, session);
}

const optionalMeal = z.union([z.enum(MEALS), z.literal('')]).optional();

const volunteerSchema = z.object({
  operationId: z.string().uuid(),
  firstName: z.string().trim().min(1, 'Enter a first name.').max(80),
  lastName: z.string().trim().min(1, 'Enter a last name.').max(80),
  icsRole: z.enum(ICS_ROLES),
  phone: z.string().trim().max(40).optional(),
  arriveDate: z.string().trim().optional(),
  arriveMeal: optionalMeal,
  departDate: z.string().trim().optional(),
  departMeal: optionalMeal,
  epipenCarrying: z.string().optional(),
  epipenLocation: z.string().trim().max(300).optional(),
  restrictionKey: z.string().trim().max(60).optional(),
  restrictionSeverity: z.union([z.enum(SEVERITIES), z.literal('')]).optional(),
  restrictionNote: z.string().trim().max(500).optional(),
});

const blankToNull = (value: string | undefined): string | null =>
  value === undefined || value.trim() === '' ? null : value.trim();

/** Adds a volunteer by hand — for anyone who cannot or will not use the kiosk QR. */
export async function addVolunteer(_prev: RosterState, formData: FormData): Promise<RosterState> {
  const parsed = volunteerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the details.' };
  await assertMember(parsed.data.operationId);

  const db = getDb();
  const created = await db.insert(schema.volunteers).values({
    operationId: parsed.data.operationId,
    firstName: parsed.data.firstName,
    lastName: parsed.data.lastName,
    icsRole: parsed.data.icsRole,
    phone: blankToNull(parsed.data.phone),
    email: null,
    onSite: true,
    arriveDate: blankToNull(parsed.data.arriveDate),
    arriveMeal: parsed.data.arriveMeal === '' ? null : parsed.data.arriveMeal ?? null,
    departDate: blankToNull(parsed.data.departDate),
    departMeal: parsed.data.departMeal === '' ? null : parsed.data.departMeal ?? null,
    epipenCarrying: parsed.data.epipenCarrying === 'yes',
    epipenLocation: blankToNull(parsed.data.epipenLocation),
    likes: [], dislikes: [], morale: [],
    freeNote: null,
    source: 'lead',
    // Recorded by a lead on the volunteer's behalf — consent was given in person.
    consentAt: new Date(),
  }).returning();

  const volunteerId = created[0]?.id;
  if (volunteerId === undefined) return { error: 'Could not save the volunteer.' };

  const key = blankToNull(parsed.data.restrictionKey);
  if (key !== null) {
    await db.insert(schema.restrictions).values({
      volunteerId,
      key: key.toLowerCase(),
      severity: parsed.data.restrictionSeverity === '' || parsed.data.restrictionSeverity === undefined
        ? 'preference' : parsed.data.restrictionSeverity,
      note: blankToNull(parsed.data.restrictionNote),
    });
  }

  revalidatePath(`/op/${parsed.data.operationId}/roster`);
  revalidatePath(`/op/${parsed.data.operationId}`);
  return {
    ok: `Added ${parsed.data.firstName} ${parsed.data.lastName}.`
      + (key === null ? ' Add any further restrictions from their row.' : ''),
  };
}

const restrictionSchema = z.object({
  operationId: z.string().uuid(),
  volunteerId: z.string().uuid(),
  key: z.string().trim().min(1).max(60),
  severity: z.enum(SEVERITIES),
  note: z.string().trim().max(500).optional(),
});

export async function addRestriction(formData: FormData): Promise<void> {
  const parsed = restrictionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  await assertMember(parsed.data.operationId);

  const db = getDb();
  // The volunteer must belong to this operation.
  const rows = await db.select().from(schema.volunteers).where(and(
    eq(schema.volunteers.id, parsed.data.volunteerId),
    eq(schema.volunteers.operationId, parsed.data.operationId),
  )).limit(1);
  if (rows.length === 0) return;

  await db.insert(schema.restrictions).values({
    volunteerId: parsed.data.volunteerId,
    key: parsed.data.key.toLowerCase(),
    severity: parsed.data.severity,
    note: blankToNull(parsed.data.note),
  });
  revalidatePath(`/op/${parsed.data.operationId}/roster`);
  revalidatePath(`/op/${parsed.data.operationId}`);
}

const staySchema = z.object({
  operationId: z.string().uuid(),
  volunteerId: z.string().uuid(),
  arriveDate: z.string().trim().optional(),
  arriveMeal: optionalMeal,
  departDate: z.string().trim().optional(),
  departMeal: optionalMeal,
});

/** Correcting a stay is the most common roster edit — people leave early. */
export async function updateStay(formData: FormData): Promise<void> {
  const parsed = staySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  await assertMember(parsed.data.operationId);

  await getDb().update(schema.volunteers).set({
    arriveDate: blankToNull(parsed.data.arriveDate),
    arriveMeal: parsed.data.arriveMeal === '' ? null : parsed.data.arriveMeal ?? null,
    departDate: blankToNull(parsed.data.departDate),
    departMeal: parsed.data.departMeal === '' ? null : parsed.data.departMeal ?? null,
  }).where(and(
    eq(schema.volunteers.id, parsed.data.volunteerId),
    eq(schema.volunteers.operationId, parsed.data.operationId),
  ));

  revalidatePath(`/op/${parsed.data.operationId}/roster`);
  revalidatePath(`/op/${parsed.data.operationId}`);
}
