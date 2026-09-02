/**
 * Meal-level presence.
 *
 * A volunteer's stay runs from (arriveDate, arriveMeal) to (departDate,
 * departMeal). Everything downstream — the safety board, the conflict check,
 * headcount, the menu and the budget — filters through `isPresent`, so this is
 * one of the functions that must not have bugs.
 *
 * Safety bias: when the stay is ambiguous we count the volunteer as PRESENT and
 * surface a warning. Over-including someone means we check an allergy we did
 * not need to. Under-including them means we serve a severe allergen to someone
 * who is standing in the line. Those errors are not symmetric.
 */
import { MEALS, isMeal, type Meal, type Slot } from './domain';

export interface Stay {
  readonly arriveDate: string | null;
  readonly arriveMeal: Meal | null;
  readonly departDate: string | null;
  readonly departMeal: Meal | null;
}

/** Position of a meal within the operation's schedule. -1 when absent. */
function mealIndex(meal: Meal, schedule: readonly Meal[]): number {
  return schedule.indexOf(meal);
}

/**
 * Is this volunteer on site for a given day + meal?
 *
 * `schedule` is the operation's ordered meal schedule; defaults to the standard
 * breakfast → lunch → supper.
 */
export function isPresent(
  stay: Stay,
  day: string,
  meal: Meal,
  schedule: readonly Meal[] = MEALS,
): boolean {
  const at = mealIndex(meal, schedule);
  if (at === -1) return false;

  // --- Arrival ---
  if (stay.arriveDate !== null) {
    if (day < stay.arriveDate) return false;
    if (day === stay.arriveDate && stay.arriveMeal !== null) {
      const from = mealIndex(stay.arriveMeal, schedule);
      // An arrival meal outside the schedule is meaningless — do not let it
      // silently exclude anyone.
      if (from !== -1 && at < from) return false;
    }
    // arriveMeal null on the arrival day => present from the start of that day.
  }
  // arriveDate null => arrival unknown; present (and warned about).

  // --- Departure ---
  if (stay.departDate !== null) {
    if (day > stay.departDate) return false;
    if (day === stay.departDate && stay.departMeal !== null) {
      const until = mealIndex(stay.departMeal, schedule);
      if (until !== -1 && at > until) return false;
    }
    // departMeal null on the departure day => present through end of day.
  }
  // departDate null => still on site; present (and warned about).

  return true;
}

/** Present for at least one meal on `day`. Drives headcount and daily budget. */
export function isPresentOnDay(stay: Stay, day: string, schedule: readonly Meal[] = MEALS): boolean {
  return schedule.some((meal) => isPresent(stay, day, meal, schedule));
}

/**
 * Presence for any menu slot. `snack` and `drinks` are all-day slots and use
 * day-level presence; the served meals use meal-level presence.
 */
export function isPresentForSlot(
  stay: Stay,
  day: string,
  slot: Slot,
  schedule: readonly Meal[] = MEALS,
): boolean {
  return isMeal(slot) ? isPresent(stay, day, slot, schedule) : isPresentOnDay(stay, day, schedule);
}

export type PresenceWarning = 'no-arrival' | 'unconfirmed-departure' | 'open-ended-stay';

/**
 * Ambiguities in a stay that the UI must warn about rather than quietly resolve.
 * Each corresponds to a case above where we counted someone as present.
 */
export function presenceWarnings(stay: Stay): PresenceWarning[] {
  const warnings: PresenceWarning[] = [];
  if (stay.arriveDate === null) warnings.push('no-arrival');
  if (stay.departDate === null) warnings.push('open-ended-stay');
  else if (stay.departMeal === null) warnings.push('unconfirmed-departure');
  return warnings;
}

export const PRESENCE_WARNING_TEXT: Record<PresenceWarning, string> = {
  'no-arrival': 'No arrival recorded — counted as present for every meal.',
  'unconfirmed-departure': 'Departure meal not confirmed — counted as present through end of day.',
  'open-ended-stay': 'No departure recorded — counted as present indefinitely.',
};

/** Count of people on site for a given day. */
export function peoplePresentOnDay<T extends Stay>(
  volunteers: readonly T[],
  day: string,
  schedule: readonly Meal[] = MEALS,
): number {
  return volunteers.filter((v) => isPresentOnDay(v, day, schedule)).length;
}

/** The crew actually on site for a given day + slot. */
export function crewForSlot<T extends Stay>(
  volunteers: readonly T[],
  day: string,
  slot: Slot,
  schedule: readonly Meal[] = MEALS,
): T[] {
  return volunteers.filter((v) => isPresentForSlot(v, day, slot, schedule));
}

/** Inclusive list of ISO days between two dates. */
export function daysBetween(start: string, end: string): string[] {
  const out: string[] = [];
  const cursor = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (cursor.getTime() <= last.getTime()) {
    out.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}
