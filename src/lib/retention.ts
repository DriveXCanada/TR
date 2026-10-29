/**
 * Retention.
 *
 * The volunteer sign-in form tells people their details are deleted after the
 * operation's retention period. That is a promise made to someone handing over
 * medical information, so the deletion has to actually happen rather than
 * depend on somebody remembering to press a button.
 *
 * The due date is computed from the operation's end date and its retention
 * period at run time rather than trusted from a stored column, so changing the
 * retention period takes effect immediately and a stale value cannot keep data
 * alive past its promise.
 */

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + Math.trunc(days));
  return d.toISOString().slice(0, 10);
}

/** The day volunteer data for an operation becomes deletable. */
export function purgeDueOn(endDate: string, retentionDays: number): string {
  return addDays(endDate, Math.max(0, Math.trunc(retentionDays)));
}

export function isPurgeDue(endDate: string, retentionDays: number, today: string): boolean {
  return today >= purgeDueOn(endDate, retentionDays);
}

/** Days remaining before deletion; negative once overdue. */
export function daysUntilPurge(endDate: string, retentionDays: number, today: string): number {
  const due = new Date(`${purgeDueOn(endDate, retentionDays)}T00:00:00Z`).getTime();
  const now = new Date(`${today}T00:00:00Z`).getTime();
  return Math.round((due - now) / 86_400_000);
}

export interface RetentionStatus {
  readonly dueOn: string;
  readonly daysRemaining: number;
  readonly due: boolean;
  /** Plain words for an operator — and for the volunteer-facing notice. */
  readonly summary: string;
}

export function retentionStatus(
  endDate: string, retentionDays: number, today: string,
): RetentionStatus {
  const dueOn = purgeDueOn(endDate, retentionDays);
  const daysRemaining = daysUntilPurge(endDate, retentionDays, today);
  const due = daysRemaining <= 0;
  return {
    dueOn,
    daysRemaining,
    due,
    summary: due
      ? `Due for deletion — retention expired ${Math.abs(daysRemaining)} day(s) ago.`
      : `Volunteer data is deleted on ${dueOn} (${daysRemaining} day(s) from now).`,
  };
}
