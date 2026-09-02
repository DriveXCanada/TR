/**
 * Budget is a RATE, not a pot.
 *
 * The op is funded at a per-person-per-day rate, so the day's budget flexes with
 * the roster: a day with 48 Greyshirts on site is funded for 48, not for the
 * peak headcount or the average. Everything else (menu costs, shopping totals)
 * is compared against this.
 */
import { MEALS, type Meal } from './domain';
import { peoplePresentOnDay, daysBetween, type Stay } from './presence';

export interface BudgetDay {
  readonly day: string;
  readonly people: number;
  readonly budget: number;
}

export interface BudgetSummary {
  readonly rate: number;
  readonly currency: string;
  readonly days: readonly BudgetDay[];
  readonly totalPeopleDays: number;
  readonly totalBudget: number;
}

/** A single day's budget: rate × people on site that day. */
export function dailyBudget<T extends Stay>(
  volunteers: readonly T[],
  day: string,
  rate: number,
  schedule: readonly Meal[] = MEALS,
): number {
  return round2(rate * peoplePresentOnDay(volunteers, day, schedule));
}

/** Budget across the whole operation window. */
export function budgetSummary<T extends Stay>(
  volunteers: readonly T[],
  startDate: string,
  endDate: string,
  rate: number,
  currency = 'CAD',
  schedule: readonly Meal[] = MEALS,
): BudgetSummary {
  const days = daysBetween(startDate, endDate).map((day) => {
    const people = peoplePresentOnDay(volunteers, day, schedule);
    return { day, people, budget: round2(rate * people) };
  });
  const totalPeopleDays = days.reduce((sum, d) => sum + d.people, 0);
  return {
    rate,
    currency,
    days,
    totalPeopleDays,
    totalBudget: round2(rate * totalPeopleDays),
  };
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
