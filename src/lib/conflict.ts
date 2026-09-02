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

  // Fastest lookup that still keeps the *first* explanation for each tag.
  const hitByTag = new Map<Tag, TagHit>();
  for (const hit of tagHits) if (!hitByTag.has(hit.tag)) hitByTag.set(hit.tag, hit);

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
        const hit = hitByTag.get(tag);
        if (hit === undefined) continue;
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

  conflicts.sort((a, b) => {
    const bySeverity = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (bySeverity !== 0) return bySeverity;
    return a.volunteerName.localeCompare(b.volunteerName);
  });

  const severeCount = conflicts.filter((c) => c.severity === 'severe').length;
  return {
    conflicts,
    severeCount,
    verdict: conflicts.length === 0 ? 'clear' : 'hold',
    unmatchedKeys: [...unmatched],
    tagHits,
  };
}
