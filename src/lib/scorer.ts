/**
 * Meal-ranking scorer.
 *
 * The second function that must not have bugs. A dish that conflicts with a
 * SEVERE restriction on the present crew is hard-excluded — it can never be
 * ranked, never be "best available", never appear as a suggestion. Only after
 * that hard gate do soft preferences (likes, dislikes, morale) affect ordering.
 */
import { checkConflicts, type CrewMember } from './conflict';
import type { Severity } from './domain';

export interface ScoreableDish {
  readonly id: string;
  readonly name: string;
  /** Ingredient lines for the conflict engine. */
  readonly ingredients: readonly string[];
}

export interface PreferenceCrew extends CrewMember {
  readonly likes?: readonly string[];
  readonly dislikes?: readonly string[];
  readonly morale?: readonly string[];
}

export interface DishScore {
  readonly dish: ScoreableDish;
  /** Hard gate. When true the dish is unservable for this crew, full stop. */
  readonly excluded: boolean;
  readonly excludedBy: readonly string[];
  readonly score: number;
  readonly likes: number;
  readonly dislikes: number;
  readonly moraleHits: number;
  readonly conflictCount: number;
  readonly worstSeverity: Severity | null;
}

const SEVERITY_WEIGHT: Record<Severity, number> = {
  severe: 0,          // never reached — severe is a hard exclusion
  intolerance: -8,
  preference: -2,
};

function matches(dishText: string, terms: readonly string[] | undefined): number {
  if (terms === undefined || terms.length === 0) return 0;
  const hay = dishText.toLowerCase();
  return terms.filter((t) => t.trim() !== '' && hay.includes(t.toLowerCase().trim())).length;
}

export function scoreDish(dish: ScoreableDish, crew: readonly PreferenceCrew[]): DishScore {
  const report = checkConflicts(dish.ingredients, crew);
  const severe = report.conflicts.filter((c) => c.severity === 'severe');

  const dishText = `${dish.name} ${dish.ingredients.join(' ')}`;
  let likes = 0;
  let dislikes = 0;
  let moraleHits = 0;
  for (const member of crew) {
    likes += matches(dishText, member.likes);
    dislikes += matches(dishText, member.dislikes);
    moraleHits += matches(dishText, member.morale);
  }

  const softPenalty = report.conflicts
    .filter((c) => c.severity !== 'severe')
    .reduce((sum, c) => sum + SEVERITY_WEIGHT[c.severity], 0);

  const score = likes * 2 + moraleHits * 3 - dislikes * 2 + softPenalty;

  const worst: Severity | null = severe.length > 0
    ? 'severe'
    : report.conflicts.some((c) => c.severity === 'intolerance')
      ? 'intolerance'
      : report.conflicts.length > 0
        ? 'preference'
        : null;

  return {
    dish,
    excluded: severe.length > 0,
    excludedBy: [...new Set(severe.map((c) => `${c.volunteerName} (${c.restrictionKey})`))],
    // An excluded dish carries no meaningful score; -Infinity keeps it last if
    // any caller ever sorts without filtering first.
    score: severe.length > 0 ? Number.NEGATIVE_INFINITY : score,
    likes,
    dislikes,
    moraleHits,
    conflictCount: report.conflicts.length,
    worstSeverity: worst,
  };
}

/** Rank dishes best-first. Excluded dishes are returned, flagged, never ranked above servable ones. */
export function rankDishes(dishes: readonly ScoreableDish[], crew: readonly PreferenceCrew[]): DishScore[] {
  return dishes
    .map((d) => scoreDish(d, crew))
    .sort((a, b) => {
      if (a.excluded !== b.excluded) return a.excluded ? 1 : -1;
      if (b.score !== a.score) return b.score - a.score;
      return a.dish.name.localeCompare(b.dish.name);
    });
}

/** Only what is actually safe to serve this crew. */
export function servableDishes(dishes: readonly ScoreableDish[], crew: readonly PreferenceCrew[]): DishScore[] {
  return rankDishes(dishes, crew).filter((d) => !d.excluded);
}
