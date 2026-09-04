/**
 * Kit and consumables.
 *
 * The whole question logistics needs answered is "how many do I need, and when
 * do I have to order it". That turns on ONE property per item: how it is
 * issued.
 *
 *  - single_use   consumed every day, per person (nitrile gloves, N95, wipes)
 *  - per_deployment issued once and kept (boots, hard hat, high-vis)
 *  - periodic     replaced every N days (respirator cartridges, work gloves)
 *
 * Treating all three the same is the classic failure: count boots daily and you
 * order fourteen pairs per person for a two-week deployment; count gloves once
 * and you run out on day two.
 */
import { MEALS, type Meal } from './domain';
import { peoplePresentOnDay, daysBetween, type Stay } from './presence';
import { tallySizes, type SizeScheme, type Sized, type SizeTally } from './sizes';

/**
 * Units you can only buy whole. A shortfall of 2.4 pairs of gloves is three
 * packets in the real world, so orderable quantities round UP for these and
 * stay fractional for measures like litres.
 */
const DISCRETE_UNITS = new Set(['each', 'pair', 'set', 'box', 'roll', 'case', 'unit', 'packet', 'pack']);

/** Kills floating-point dust: 0.05 x 281 is 14.049999999999999 without this. */
export function roundQty(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** What you actually order — whole units for things sold whole. */
export function orderQty(value: number, unit: string): number {
  return DISCRETE_UNITS.has(unit.trim().toLowerCase())
    ? Math.ceil(roundQty(value))
    : roundQty(value);
}

/** Display form: no trailing zeros, no exponent, no eleven decimal places. */
export function formatQty(value: number): string {
  const rounded = roundQty(value);
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/\.?0+$/, '');
}

export const ISSUE_POLICIES = ['single_use', 'per_deployment', 'periodic'] as const;
export type IssuePolicy = (typeof ISSUE_POLICIES)[number];

export const ISSUE_POLICY_LABELS: Record<IssuePolicy, string> = {
  single_use: 'Single use — issued fresh each day',
  per_deployment: 'Per deployment — issued once, kept',
  periodic: 'Periodic — replaced every N days',
};

export const KIT_CATEGORIES = ['ppe', 'consumable', 'tool', 'equipment', 'sanitation', 'other'] as const;
export type KitCategory = (typeof KIT_CATEGORIES)[number];

export interface KitItem {
  readonly id: string;
  readonly name: string;
  readonly category: KitCategory;
  readonly issuePolicy: IssuePolicy;
  /** Days between replacements. Only meaningful for `periodic`. */
  readonly intervalDays: number;
  /** How many units one person needs per issue. */
  readonly qtyPerPerson: number;
  readonly unit: string;
  /** When set, demand is broken down by that size scheme. */
  readonly sizeScheme: SizeScheme | null;
  readonly stockOnHand: number;
  /** Order when projected stock falls below this. */
  readonly reorderLevel: number;
  /** Days between placing an order and it arriving. */
  readonly leadTimeDays: number;
}

export type Person = Stay & Sized;

/** Present today but not yesterday — i.e. arriving. Drives per-deployment issue. */
export function arrivalsOn<T extends Stay>(
  people: readonly T[], day: string, schedule: readonly Meal[] = MEALS,
): T[] {
  const previous = new Date(`${day}T00:00:00Z`);
  previous.setUTCDate(previous.getUTCDate() - 1);
  const yesterday = previous.toISOString().slice(0, 10);
  return people.filter((p) =>
    peoplePresentOnDay([p], day, schedule) === 1 && peoplePresentOnDay([p], yesterday, schedule) === 0);
}

export interface DayNeed {
  readonly item: KitItem;
  readonly people: number;
  readonly qty: number;
  /** Why this number, in words — an unexplained order gets queried. */
  readonly basis: string;
  readonly sizes: readonly SizeTally[];
}

/**
 * What a given day actually consumes.
 *
 * `periodic` is charged on the days it falls due rather than smeared across the
 * operation, so a daily figure matches what somebody physically hands out.
 */
export function needForDay(
  items: readonly KitItem[],
  people: readonly Person[],
  day: string,
  startDate: string,
  schedule: readonly Meal[] = MEALS,
): DayNeed[] {
  const onSite = people.filter((p) => peoplePresentOnDay([p], day, schedule) === 1);
  const arriving = arrivalsOn(people, day, schedule);
  const dayIndex = Math.max(0, daysBetween(startDate, day).length - 1);

  return items.map((item) => {
    let group: readonly Person[];
    let basis: string;

    switch (item.issuePolicy) {
      case 'single_use':
        group = onSite;
        basis = `${onSite.length} on site x ${item.qtyPerPerson}`;
        break;
      case 'per_deployment':
        group = arriving;
        basis = arriving.length === 0
          ? 'nobody new arriving'
          : `${arriving.length} arriving x ${item.qtyPerPerson}`;
        break;
      case 'periodic': {
        const interval = Math.max(1, Math.trunc(item.intervalDays));
        const due = dayIndex % interval === 0;
        group = due ? onSite : [];
        basis = due
          ? `${onSite.length} on site x ${item.qtyPerPerson} (every ${interval} days)`
          : `not due — next in ${interval - (dayIndex % interval)} day(s)`;
        break;
      }
    }

    return {
      item,
      people: group.length,
      qty: roundQty(group.length * item.qtyPerPerson),
      basis,
      sizes: item.sizeScheme === null ? [] : tallySizes(group, [item.sizeScheme]),
    };
  });
}

export interface ItemPlan {
  readonly item: KitItem;
  /** Total units the whole operation consumes. */
  readonly totalQty: number;
  readonly stockOnHand: number;
  /** Units still to buy, floored at zero. */
  readonly shortfall: number;
  /** The day stock is projected to run out, or null if it never does. */
  readonly runsOutOn: string | null;
  /**
   * Last day an order can be placed and still arrive before stock runs out.
   * Null when there is no shortfall.
   */
  readonly orderBy: string | null;
  readonly urgent: boolean;
}

/**
 * Projects consumption across the operation against stock in hand.
 *
 * The lead time is the point of this. Knowing you run out on Thursday is no use
 * on Wednesday if delivery takes two days — so it reports the day the order has
 * to be placed, and flags it as urgent once that day has passed.
 */
export function planItems(
  items: readonly KitItem[],
  people: readonly Person[],
  startDate: string,
  endDate: string,
  today: string,
  schedule: readonly Meal[] = MEALS,
): ItemPlan[] {
  const days = daysBetween(startDate, endDate);

  return items.map((item) => {
    let running = item.stockOnHand;
    let runsOutOn: string | null = null;
    let totalQty = 0;

    for (const day of days) {
      const need = needForDay([item], people, day, startDate, schedule)[0];
      const qty = need?.qty ?? 0;
      totalQty = roundQty(totalQty + qty);
      running = roundQty(running - qty);
      if (running < 0 && runsOutOn === null) runsOutOn = day;
    }

    // Rounded up for discrete units — you cannot order 2.4 pairs of gloves.
    const shortfall = orderQty(Math.max(0, totalQty - item.stockOnHand), item.unit);
    let orderBy: string | null = null;
    if (runsOutOn !== null) {
      const target = new Date(`${runsOutOn}T00:00:00Z`);
      target.setUTCDate(target.getUTCDate() - Math.max(0, Math.trunc(item.leadTimeDays)));
      orderBy = target.toISOString().slice(0, 10);
    }

    return {
      item,
      totalQty,
      stockOnHand: item.stockOnHand,
      shortfall,
      runsOutOn,
      orderBy,
      // Past the order date, or below the reorder level with nothing on order.
      urgent: (orderBy !== null && orderBy <= today) || (shortfall > 0 && item.stockOnHand <= item.reorderLevel),
    };
  });
}

/**
 * Splits the crew into those who draw kit and those who do not.
 *
 * Some roles are on site and eating but never draw PPE — command staff, a PIO
 * visiting for a day. Excluding them from a glove count is correct; excluding
 * them from a meal count would starve somebody. This function exists so that
 * distinction is made in exactly one place, and its return type names both
 * halves so a caller cannot silently pass the wrong one to a headcount.
 */
export interface KitAudience<T> {
  /** Draw PPE and consumables. Use for kit demand only. */
  readonly drawsKit: readonly T[];
  /** On site but exempt. Still fed — never subtract these from a food count. */
  readonly exempt: readonly T[];
}

export function splitKitAudience<T extends { icsRole: string }>(
  people: readonly T[],
  exemptRoles: readonly string[],
): KitAudience<T> {
  if (exemptRoles.length === 0) return { drawsKit: people, exempt: [] };
  const exemptSet = new Set(exemptRoles.map((r) => r.trim().toLowerCase()));
  const drawsKit: T[] = [];
  const exempt: T[] = [];
  for (const person of people) {
    (exemptSet.has(person.icsRole.trim().toLowerCase()) ? exempt : drawsKit).push(person);
  }
  return { drawsKit, exempt };
}
