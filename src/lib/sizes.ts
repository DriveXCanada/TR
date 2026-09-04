/**
 * PPE sizing.
 *
 * Sizes are captured once, at volunteer sign-in, and read by both the Food Unit
 * (nothing) and Logistics (everything). Kept as a small closed set of schemes
 * rather than free text: "L", "Large" and "lge" are the same glove to a human
 * and three different gloves to a count, and the count is the whole point.
 */

export const SIZE_SCHEMES = ['shirt', 'glove', 'boot', 'mask', 'helmet'] as const;
export type SizeScheme = (typeof SIZE_SCHEMES)[number];

export interface SchemeSpec {
  readonly key: SizeScheme;
  readonly label: string;
  /** What a volunteer is asked, in their words. */
  readonly prompt: string;
  readonly options: readonly string[];
}

export const SCHEMES: Record<SizeScheme, SchemeSpec> = {
  shirt: {
    key: 'shirt', label: 'Shirt / jacket', prompt: 'Shirt or jacket size',
    options: ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'],
  },
  glove: {
    key: 'glove', label: 'Gloves', prompt: 'Work glove size',
    options: ['XS', 'S', 'M', 'L', 'XL', '2XL'],
  },
  boot: {
    key: 'boot', label: 'Boots', prompt: 'Boot size (US)',
    options: ['5', '6', '6.5', '7', '7.5', '8', '8.5', '9', '9.5', '10', '10.5', '11', '11.5', '12', '13', '14', '15'],
  },
  mask: {
    key: 'mask', label: 'Respirator', prompt: 'Respirator / N95 face size',
    options: ['Small', 'Regular', 'Large'],
  },
  helmet: {
    key: 'helmet', label: 'Hard hat', prompt: 'Hard hat',
    options: ['Adjustable', 'Small', 'Large'],
  },
};

/** A volunteer's answers, scheme -> chosen option. Unanswered schemes are absent. */
export type SizeMap = Partial<Record<SizeScheme, string>>;

export function isSizeScheme(value: string): value is SizeScheme {
  return (SIZE_SCHEMES as readonly string[]).includes(value);
}

/** Keeps only recognised schemes and options — form input is never trusted. */
export function sanitizeSizes(input: unknown): SizeMap {
  if (typeof input !== 'object' || input === null) return {};
  const out: SizeMap = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (!isSizeScheme(key)) continue;
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (trimmed === '') continue;
    if (!SCHEMES[key].options.includes(trimmed)) continue;
    out[key] = trimmed;
  }
  return out;
}

export interface SizeTally {
  readonly scheme: SizeScheme;
  readonly label: string;
  /** Option -> how many people, in the scheme's own order. */
  readonly counts: readonly { size: string; count: number }[];
  /** People on site who never answered this question. */
  readonly unknown: number;
  readonly total: number;
}

export interface Sized {
  readonly sizes: SizeMap;
}

/**
 * How many of each size are needed for a given set of people.
 *
 * `unknown` is reported separately and never folded into a size. Guessing a
 * boot size produces a boot nobody can wear; saying "four unknown" produces a
 * phone call, which is the correct outcome.
 */
export function tallySizes<T extends Sized>(
  people: readonly T[],
  schemes: readonly SizeScheme[] = SIZE_SCHEMES,
): SizeTally[] {
  return schemes.map((scheme) => {
    const spec = SCHEMES[scheme];
    const counts = new Map<string, number>(spec.options.map((o) => [o, 0]));
    let unknown = 0;
    for (const person of people) {
      const value = person.sizes[scheme];
      if (value === undefined || !counts.has(value)) unknown += 1;
      else counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    return {
      scheme,
      label: spec.label,
      counts: spec.options.map((size) => ({ size, count: counts.get(size) ?? 0 })),
      unknown,
      total: people.length,
    };
  });
}

/** Fraction of people who have answered every scheme. Drives the "chase them" nudge. */
export function sizeCompleteness<T extends Sized>(people: readonly T[]): {
  complete: number; partial: number; missing: number; total: number;
} {
  let complete = 0; let partial = 0; let missing = 0;
  for (const person of people) {
    const answered = SIZE_SCHEMES.filter((s) => person.sizes[s] !== undefined).length;
    if (answered === SIZE_SCHEMES.length) complete += 1;
    else if (answered === 0) missing += 1;
    else partial += 1;
  }
  return { complete, partial, missing, total: people.length };
}
