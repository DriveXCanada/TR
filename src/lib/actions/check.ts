'use server';

import { z } from 'zod';
import { requireSession } from '@/lib/auth/current';
import { getDb, schema } from '@/lib/db';
import { loadSnapshot } from '@/lib/data/access';
import { resolveSelection } from '@/lib/view-params';
import { crewForSlot } from '@/lib/presence';
import { checkConflicts, type Conflict } from '@/lib/conflict';

export interface CheckState {
  readonly ran: boolean;
  readonly verdict?: 'clear' | 'hold';
  readonly conflicts?: readonly Conflict[];
  readonly severeCount?: number;
  readonly unmatchedKeys?: readonly string[];
  readonly crewSize?: number;
  readonly dishText?: string;
  readonly error?: string;
}

const input = z.object({
  operationId: z.string().uuid(),
  day: z.string().min(1),
  slot: z.string().min(1),
  dish: z.string().trim().min(1, 'Paste the dish or its ingredients first.'),
});

export async function runCheck(_prev: CheckState, formData: FormData): Promise<CheckState> {
  const session = await requireSession();
  const parsed = input.safeParse({
    operationId: formData.get('operationId'),
    day: formData.get('day'),
    slot: formData.get('slot'),
    dish: formData.get('dish'),
  });
  if (!parsed.success) {
    return { ran: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' };
  }

  const snapshot = await loadSnapshot(parsed.data.operationId, session);
  const { day, slot } = resolveSelection(
    snapshot.operation.startDate, snapshot.operation.endDate,
    { day: parsed.data.day, slot: parsed.data.slot },
  );

  const crew = crewForSlot(snapshot.volunteers, day, slot, snapshot.operation.mealSchedule);
  const report = checkConflicts(parsed.data.dish, crew);

  // Record that a check happened and what it said — never the restriction data
  // it was checked against. See PRIVACY.md.
  try {
    await getDb().insert(schema.mealChecks).values({
      operationId: parsed.data.operationId,
      day,
      slot: slot as (typeof schema.mealChecks.$inferInsert)['slot'],
      dishText: parsed.data.dish.slice(0, 2000),
      verdict: report.verdict,
      conflictCount: report.conflicts.length,
      checkedBy: session.userId,
    });
  } catch {
    // An audit-log failure must never block a safety check from being shown.
  }

  return {
    ran: true,
    verdict: report.verdict,
    conflicts: report.conflicts,
    severeCount: report.severeCount,
    unmatchedKeys: report.unmatchedKeys,
    crewSize: crew.length,
    dishText: parsed.data.dish,
  };
}
