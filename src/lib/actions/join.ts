'use server';

import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { z } from 'zod';
import { getDb, schema } from '@/lib/db';
import { rateLimit, pruneRateLimits } from '@/lib/rate-limit';
import { ICS_ROLES, MEALS, SEVERITIES } from '@/lib/domain';
import { sanitizeSizes } from '@/lib/sizes';

export interface JoinState {
  readonly ok?: boolean;
  readonly error?: string;
}

const restrictionSchema = z.object({
  key: z.string().trim().min(1).max(60),
  severity: z.enum(SEVERITIES),
  note: z.string().trim().max(500).optional(),
});

const joinSchema = z.object({
  kioskToken: z.string().trim().min(8),
  consent: z.literal('yes'),
  firstName: z.string().trim().min(1, 'Enter your first name.').max(80),
  lastName: z.string().trim().min(1, 'Enter your last name.').max(80),
  icsRole: z.enum(ICS_ROLES),
  phone: z.string().trim().max(40).optional(),
  arriveDate: z.string().trim().min(1, 'Tell us the day you arrive.'),
  arriveMeal: z.enum(MEALS),
  departDate: z.string().trim().optional(),
  departMeal: z.enum(MEALS).optional(),
  epipenCarrying: z.string().optional(),
  epipenLocation: z.string().trim().max(300).optional(),
  restrictions: z.string().optional(),
  sizes: z.string().optional(),
  likes: z.string().trim().max(500).optional(),
  dislikes: z.string().trim().max(500).optional(),
  morale: z.string().trim().max(500).optional(),
  freeNote: z.string().trim().max(1000).optional(),
});

function csv(value: string | undefined): string[] {
  if (value === undefined) return [];
  return value.split(',').map((v) => v.trim()).filter((v) => v !== '');
}

export async function submitJoin(_prev: JoinState, formData: FormData): Promise<JoinState> {
  const token = String(formData.get('kioskToken') ?? '');

  // Rate limit per kiosk token AND per client, so one shared device cannot be
  // used to flood the roster and one bad actor cannot lock out a whole site.
  pruneRateLimits();
  const forwarded = (await headers()).get('x-forwarded-for') ?? 'unknown';
  const client = forwarded.split(',')[0]?.trim() ?? 'unknown';
  const perToken = rateLimit(`join:${token}`, 40, 60 * 60 * 1000);
  const perClient = rateLimit(`join:${token}:${client}`, 6, 10 * 60 * 1000);
  if (!perToken.allowed || !perClient.allowed) {
    const wait = Math.max(perToken.retryAfterSeconds, perClient.retryAfterSeconds);
    return { error: `Too many sign-ins from this device. Try again in ${Math.ceil(wait / 60)} minute(s), or ask a lead to add you.` };
  }

  const raw = Object.fromEntries(formData);
  const parsed = joinSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      error: issue?.path[0] === 'consent'
        ? 'You must agree before we can record anything.'
        : issue?.message ?? 'Please check the form and try again.',
    };
  }

  const db = getDb();
  const found = await db.select().from(schema.operations)
    .where(eq(schema.operations.kioskToken, parsed.data.kioskToken)).limit(1);
  const operation = found[0];
  if (operation === undefined) {
    return { error: 'This sign-in link is no longer active. Ask a lead for the current QR code.' };
  }

  let restrictions: z.infer<typeof restrictionSchema>[] = [];
  if (parsed.data.restrictions !== undefined && parsed.data.restrictions.trim() !== '') {
    try {
      const decoded: unknown = JSON.parse(parsed.data.restrictions);
      restrictions = z.array(restrictionSchema).max(30).parse(decoded);
    } catch {
      return { error: 'We could not read your dietary and medical answers. Please try again.' };
    }
  }

  // Sizes are sanitised against the known schemes — an unrecognised value is
  // dropped rather than stored, so a tally can never invent a size.
  let sizes: Record<string, string> = {};
  if (parsed.data.sizes !== undefined && parsed.data.sizes.trim() !== '') {
    try {
      sizes = sanitizeSizes(JSON.parse(parsed.data.sizes)) as Record<string, string>;
    } catch {
      sizes = {};
    }
  }

  const created = await db.insert(schema.volunteers).values({
    operationId: operation.id,
    firstName: parsed.data.firstName,
    lastName: parsed.data.lastName,
    icsRole: parsed.data.icsRole,
    phone: parsed.data.phone === '' ? null : parsed.data.phone ?? null,
    email: null,
    onSite: true,
    arriveDate: parsed.data.arriveDate,
    arriveMeal: parsed.data.arriveMeal,
    // Blank departure is allowed on purpose. `isPresent` counts an unconfirmed
    // departure as present and the board says so — better than forcing a guess.
    departDate: parsed.data.departDate === '' ? null : parsed.data.departDate ?? null,
    departMeal: parsed.data.departMeal ?? null,
    epipenCarrying: parsed.data.epipenCarrying === 'yes',
    epipenLocation: parsed.data.epipenLocation === '' ? null : parsed.data.epipenLocation ?? null,
    likes: csv(parsed.data.likes),
    dislikes: csv(parsed.data.dislikes),
    morale: csv(parsed.data.morale),
    freeNote: parsed.data.freeNote === '' ? null : parsed.data.freeNote ?? null,
    sizes,
    source: 'kiosk',
    consentAt: new Date(),
  }).returning();

  const volunteerId = created[0]?.id;
  if (volunteerId === undefined) return { error: 'Could not save your details. Please try again.' };

  for (const restriction of restrictions) {
    await db.insert(schema.restrictions).values({
      volunteerId,
      key: restriction.key.toLowerCase(),
      severity: restriction.severity,
      note: restriction.note === '' ? null : restriction.note ?? null,
    });
  }

  return { ok: true };
}
