/**
 * Retention purge.
 *
 * Hard-deletes volunteer records — and with them, by cascade, every dietary and
 * medical restriction — for operations whose retention period has expired.
 *
 * Run it on a schedule (Railway cron, or any scheduler) so the promise made on
 * the sign-in form holds without anyone remembering. It is safe to run often:
 * operations still inside their retention window are left alone, and an
 * operation already purged has nothing left to delete.
 *
 *   npm run db:purge            # delete what is due
 *   npm run db:purge -- --dry   # report what WOULD be deleted
 */
import { eq } from 'drizzle-orm';
import { getDb, schema } from '../db';
import { isPurgeDue, purgeDueOn } from '../retention';

export interface PurgeResult {
  readonly operationsChecked: number;
  readonly operationsPurged: number;
  readonly volunteersDeleted: number;
  readonly lines: readonly string[];
}

export async function runPurge(today: string, dryRun = false): Promise<PurgeResult> {
  const db = getDb();
  const operations = await db.select().from(schema.operations);
  const lines: string[] = [];
  let operationsPurged = 0;
  let volunteersDeleted = 0;

  for (const op of operations) {
    const due = isPurgeDue(op.endDate, op.retentionDays, today);
    const dueOn = purgeDueOn(op.endDate, op.retentionDays);

    const volunteers = await db.select({ id: schema.volunteers.id })
      .from(schema.volunteers).where(eq(schema.volunteers.operationId, op.id));

    if (!due) {
      lines.push(`KEEP   ${op.name} — ${volunteers.length} record(s), due ${dueOn}`);
      continue;
    }
    if (volunteers.length === 0) {
      lines.push(`CLEAR  ${op.name} — already empty, was due ${dueOn}`);
      continue;
    }

    if (dryRun) {
      lines.push(`WOULD  ${op.name} — ${volunteers.length} record(s), due ${dueOn}`);
    } else {
      // Restrictions cascade from volunteers, so this clears both.
      await db.delete(schema.volunteers).where(eq(schema.volunteers.operationId, op.id));
      await db.update(schema.operations).set({ purgeAfter: dueOn }).where(eq(schema.operations.id, op.id));
      lines.push(`PURGED ${op.name} — ${volunteers.length} record(s), due ${dueOn}`);
    }
    operationsPurged += 1;
    volunteersDeleted += volunteers.length;
  }

  return { operationsChecked: operations.length, operationsPurged, volunteersDeleted, lines };
}
