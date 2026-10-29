/**
 * Conflict engine — pasted ingredients × the crew actually on site.
 *
 * One of the two functions that must not have bugs. Rules:
 *  - Rank severe first, always. The banner shows what can hospitalise someone.
 *  - Explain the derivation. "Contains fish (anchovy in worcestershire sauce)"
 *    gets acted on; "contains fish" on a pulled-pork dish gets dismissed.
 *  - Never silently drop a restriction we do not recognise — surface it as
 *    unmatched so a human decides.
 */
import { SEVERITY_RANK, type Severity } from './domain';
import { tagsForAll, splitIngredients, type Tag, type TagHit } from './allergens';

export interface CrewRestriction {
  readonly key: string;
  readonly severity: Severity;
  readonly note?: string | null;
}

export interface CrewMember {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly restrictions: readonly CrewRestriction[];
}

/**
 * Which ingredient tags each restriction key conflicts with.
 * Allergen keys map to themselves; diet keys fan out to several tags.
 */
const RESTRICTION_TAGS: Record<string, readonly Tag[]> = {
  peanuts: ['peanuts'],
  'tree-nuts': ['tree-nuts'],
  fish: ['fish'],
  shellfish: ['shellfish'],
  gluten: ['gluten'],
  dairy: ['dairy'],
  egg: ['egg'],
  soy: ['soy'],
  sesame: ['sesame'],
  mustard: ['mustard'],
  sulphites: ['sulphites'],
  pork: ['pork'],
  vegetarian: ['meat', 'poultry', 'fish', 'shellfish', 'pork', 'gelatin'],
  vegan: ['meat', 'poultry', 'fish', 'shellfish', 'pork', 'gelatin', 'dairy', 'egg', 'honey'],
  halal: ['pork', 'alcohol'],
  diabetic: ['high-sugar'],
};

export function knownRestrictionKeys(): string[] {
  return Object.keys(RESTRICTION_TAGS);
}

export interface Conflict {
  readonly volunteerId: string;
  readonly volunteerName: string;
  readonly restrictionKey: string;
  readonly severity: Severity;
  readonly tag: Tag;
  /** The ingredient text that triggered it. */
  readonly ingredient: string;
  /** Why this ingredient implies this tag, when it is not obvious. */
  readonly via?: string;
  readonly note?: string | null;
}

export interface ConflictReport {
  readonly conflicts: readonly Conflict[];
  readonly severeCount: number;
  /** CLEAR TO SERVE only when nothing at all conflicts. */
  readonly verdict: 'clear' | 'hold';
  /** Restriction keys we have no mapping for — a human must judge these. */
  readonly unmatchedKeys: readonly string[];
  readonly tagHits: readonly TagHit[];
}

/**
 * One line a human can act on.
 *
 * A bare tag is the reason safety warnings get ignored: "fish" on a beef chilli
 * reads as a bug, so the next warning is dismissed too. The ingredient and the
 * derivation are what make it credible — the chilli really does carry fish
 * protein, because Worcestershire sauce is made with anchovy.
 */
export function explainConflict(c: Conflict): string {
  const tag = c.tag.replace(/-/g, ' ');
  const because = c.via === undefined ? c.ingredient : `${c.ingredient} (${c.via})`;
  return `${c.volunteerName} cannot have ${tag} — ${because}`;
}

/**
 * The same conflicts grouped by what caused them, so a dish shows one line per
 * reason instead of a row of unexplained tags.
 */
export interface ConflictReason {
  readonly severity: Severity;
  readonly tag: Tag;
  readonly ingredient: string;
  readonly via?: string;
  /** Everyone affected, most severe first. Never truncated. */
  readonly people: readonly string[];
}

export function groupConflicts(conflicts: readonly Conflict[]): ConflictReason[] {
  const groups = new Map<string, { base: Conflict; people: string[] }>();
  for (const c of conflicts) {
    const key = `${c.severity}|${c.tag}|${c.ingredient.toLowerCase()}`;
    const found = groups.get(key);
    if (found === undefined) {
      groups.set(key, { base: c, people: [c.volunteerName] });
    } else if (!found.people.includes(c.volunteerName)) {
      found.people.push(c.volunteerName);
    }
  }
  return [...groups.values()]
    .map(({ base, people }) => ({
      severity: base.severity,
      tag: base.tag,
      ingredient: base.ingredient,
      ...(base.via === undefined ? {} : { via: base.via }),
      people,
    }))
    .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}

/**
 * Checks a dish, using its name only as a backstop.
 *
 * Scanning the name catches a recipe whose ingredient list is incomplete —
 * "Peanut noodles" that forgot to list peanut butter is a real way someone
 * gets hurt. But when a tag is already proven by a real ingredient, a second
 * line naming the dish ("meat in Beef chilli") is noise, and noise is what
 * teaches people to skim past the line that matters.
 *
 * So: ingredients decide. The name only speaks for a tag nothing else revealed,
 * and says that is where it came from.
 */
export function checkDish(
  dishName: string,
  ingredients: readonly string[],
  crew: readonly CrewMember[],
): ConflictReport {
  const fromIngredients = checkConflicts(ingredients, crew);
  if (dishName.trim() === '') return fromIngredients;

  const proven = new Set(fromIngredients.conflicts.map((c) => c.tag));
  const fromName = checkConflicts([dishName], crew).conflicts
    .filter((c) => !proven.has(c.tag))
    .map((c) => ({
      ...c,
      via: 'named in the dish, which the ingredient list does not account for',
    }));

  if (fromName.length === 0) return fromIngredients;

  const conflicts = [...fromIngredients.conflicts, ...fromName].sort((a, b) => {
    const bySeverity = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (bySeverity !== 0) return bySeverity;
    return a.volunteerName.localeCompare(b.volunteerName);
  });

  return {
    conflicts,
    severeCount: new Set(
      conflicts.filter((c) => c.severity === 'severe').map((c) => c.volunteerId),
    ).size,
    verdict: conflicts.length === 0 ? 'clear' : 'hold',
    unmatchedKeys: fromIngredients.unmatchedKeys,
    tagHits: fromIngredients.tagHits,
  };
}

export interface DishInput {
  readonly name: string;
  readonly ingredients: readonly string[];
}

/**
 * Checks several dishes served together.
 *
 * Per dish, not pooled: a dish name may only vouch for its own ingredient
 * list. Pooled, "Beef chilli" would count as evidence about the potatoes
 * beside it, and a tag proven in one dish would silence the name-backstop on
 * another — which is the one case the backstop exists for.
 */
export function checkDishes(
  dishes: readonly DishInput[],
  crew: readonly CrewMember[],
): ConflictReport {
  const reports = dishes.map((d) => checkDish(d.name, d.ingredients, crew));
  const conflicts = reports.flatMap((r) => r.conflicts).sort((a, b) => {
    const bySeverity = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (bySeverity !== 0) return bySeverity;
    return a.volunteerName.localeCompare(b.volunteerName);
  });

  return {
    conflicts,
    severeCount: new Set(
      conflicts.filter((c) => c.severity === 'severe').map((c) => c.volunteerId),
    ).size,
    verdict: conflicts.length === 0 ? 'clear' : 'hold',
    unmatchedKeys: [...new Set(reports.flatMap((r) => [...r.unmatchedKeys]))],
    tagHits: reports.flatMap((r) => [...r.tagHits]),
  };
}

function fullName(m: CrewMember): string {
  return `${m.firstName} ${m.lastName}`.trim();
}

/**
 * Check an ingredient list against the present crew.
 *
 * `ingredients` may be raw pasted text or an already-split list.
 */
export function checkConflicts(
  ingredients: string | readonly string[],
  crew: readonly CrewMember[],
): ConflictReport {
  const list = typeof ingredients === 'string' ? splitIngredients(ingredients) : [...ingredients];
  const tagHits = tagsForAll(list);

  // Every ingredient that carries a tag, not just the first one found. Naming
  // only the first lets a cook remove that ingredient and believe the dish is
  // safe while a second source of the same allergen is still in it.
  const hitsByTag = new Map<Tag, TagHit[]>();
  for (const hit of tagHits) {
    const found = hitsByTag.get(hit.tag);
    if (found === undefined) {
      hitsByTag.set(hit.tag, [hit]);
    } else if (!found.some((h) => h.source.toLowerCase() === hit.source.toLowerCase())) {
      found.push(hit);
    }
  }

  const conflicts: Conflict[] = [];
  const unmatched = new Set<string>();

  for (const member of crew) {
    for (const restriction of member.restrictions) {
      const key = restriction.key.trim().toLowerCase();
      const tags = RESTRICTION_TAGS[key];
      if (tags === undefined) {
        unmatched.add(restriction.key);
        continue;
      }
      for (const tag of tags) {
        for (const hit of hitsByTag.get(tag) ?? []) {
          conflicts.push({
            volunteerId: member.id,
            volunteerName: fullName(member),
            restrictionKey: key,
            severity: restriction.severity,
            tag,
            ingredient: hit.source,
            ...(hit.via ? { via: hit.via } : {}),
            note: restriction.note ?? null,
          });
        }
      }
    }
  }

  conflicts.sort((a, b) => {
    const bySeverity = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (bySeverity !== 0) return bySeverity;
    return a.volunteerName.localeCompare(b.volunteerName);
  });

  // People at severe risk, not ingredient-person pairs: "2 SEVERE" has to mean
  // two people who could be hospitalised, or the number cannot be acted on.
  const severeCount = new Set(
    conflicts.filter((c) => c.severity === 'severe').map((c) => c.volunteerId),
  ).size;
  return {
    conflicts,
    severeCount,
    verdict: conflicts.length === 0 ? 'clear' : 'hold',
    unmatchedKeys: [...unmatched],
    tagHits,
  };
}
