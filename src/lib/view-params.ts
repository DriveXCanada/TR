/**
 * Resolves the day + slot selection from the URL, falling back to something
 * sensible and always inside the operation window.
 */
import { SLOTS, type Slot } from './domain';
import { daysBetween } from './presence';

export interface SelectedSlot {
  readonly days: readonly string[];
  readonly day: string;
  readonly slot: Slot;
}

export function resolveSelection(
  startDate: string,
  endDate: string,
  search: Record<string, string | string[] | undefined>,
): SelectedSlot {
  const days = daysBetween(startDate, endDate);
  const first = days[0] ?? startDate;

  const rawDay = typeof search.day === 'string' ? search.day : undefined;
  const day = rawDay !== undefined && days.includes(rawDay) ? rawDay : first;

  const rawSlot = typeof search.slot === 'string' ? search.slot : undefined;
  const slot: Slot = rawSlot !== undefined && (SLOTS as readonly string[]).includes(rawSlot)
    ? (rawSlot as Slot)
    : 'supper';

  return { days, day, slot };
}
