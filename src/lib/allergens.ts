/**
 * Ingredient knowledge base.
 *
 * The whole point of this file is HIDDEN ingredients. A fish-allergic Greyshirt
 * reads "pulled pork" and sees no fish; the worcestershire in the sauce contains
 * anchovy. Every entry that resolves to a non-obvious tag carries a `via` string
 * so the board can show its reasoning — an unexplained warning gets ignored, and
 * an ignored warning is the same as no warning.
 *
 * Matching is deliberately generous. A false positive costs a cook thirty
 * seconds; a false negative can put someone in an ambulance.
 */

/** Tags are allergen or composition facts about an ingredient. */
export const TAGS = [
  'peanuts', 'tree-nuts', 'fish', 'shellfish', 'gluten', 'dairy', 'egg', 'soy',
  'sesame', 'mustard', 'sulphites', 'pork', 'meat', 'poultry', 'gelatin',
  'alcohol', 'high-sugar', 'honey',
] as const;
export type Tag = (typeof TAGS)[number];

export interface IngredientFact {
  /** Lowercase substrings; any match applies the tags. */
  readonly match: readonly string[];
  readonly tags: readonly Tag[];
  /** Explains a non-obvious derivation, e.g. "anchovy in worcestershire". */
  readonly via?: string;
}

export const INGREDIENT_FACTS: readonly IngredientFact[] = [
  // --- The classic hidden-fish traps ---
  { match: ['worcestershire', 'worcester sauce'], tags: ['fish'], via: 'anchovy in worcestershire sauce' },
  { match: ['caesar dressing', 'caesar salad'], tags: ['fish', 'egg', 'dairy'], via: 'anchovy + egg in Caesar dressing' },
  { match: ['fish sauce', 'nam pla', 'nuoc mam'], tags: ['fish'], via: 'fish sauce' },
  { match: ['oyster sauce'], tags: ['shellfish'], via: 'oyster sauce' },
  { match: ['anchovy', 'anchovies'], tags: ['fish'] },
  { match: ['bbq sauce', 'barbecue sauce', 'steak sauce', 'hp sauce'], tags: ['fish'], via: 'most commercial BBQ/steak sauces contain worcestershire (anchovy)' },

  // --- Nuts ---
  { match: ['peanut', 'pb&j', 'pb and j', 'satay'], tags: ['peanuts'] },
  { match: ['almond', 'cashew', 'walnut', 'pecan', 'pistachio', 'hazelnut', 'macadamia', 'brazil nut'], tags: ['tree-nuts'] },
  { match: ['pesto'], tags: ['tree-nuts', 'dairy'], via: 'pine nuts + parmesan in pesto' },
  { match: ['nutella'], tags: ['tree-nuts', 'dairy', 'high-sugar'], via: 'hazelnut spread' },
  { match: ['marzipan'], tags: ['tree-nuts', 'high-sugar'], via: 'almond paste' },

  // --- Gluten ---
  { match: ['bread', 'bun', 'roll', 'tortilla', 'wrap', 'pasta', 'noodle', 'flour', 'cracker', 'crouton', 'panko', 'breadcrumb', 'pancake', 'oatmeal', 'oats', 'cereal', 'barley', 'couscous'], tags: ['gluten'] },
  { match: ['soy sauce', 'teriyaki'], tags: ['soy', 'gluten'], via: 'wheat in brewed soy sauce' },
  { match: ['beer', 'ale', 'lager'], tags: ['gluten', 'alcohol'] },
  { match: ['gravy', 'roux'], tags: ['gluten'], via: 'flour-thickened' },

  // --- Dairy / egg ---
  { match: ['milk', 'cream', 'butter', 'cheese', 'yogurt', 'yoghurt', 'parmesan', 'cheddar', 'mozzarella', 'ghee'], tags: ['dairy'] },
  { match: ['mayo', 'mayonnaise', 'aioli'], tags: ['egg'], via: 'egg in mayonnaise' },
  { match: ['egg', 'omelette', 'frittata', 'meringue'], tags: ['egg'] },
  { match: ['ranch dressing'], tags: ['dairy', 'egg'], via: 'buttermilk + egg in ranch' },

  // --- Meat / fish flesh ---
  { match: ['bacon', 'ham', 'pork', 'sausage', 'pepperoni', 'salami', 'prosciutto', 'lard'], tags: ['pork', 'meat'] },
  { match: ['beef', 'steak', 'ground beef', 'burger', 'lamb', 'veal', 'venison'], tags: ['meat'] },
  { match: ['chicken', 'turkey', 'duck'], tags: ['poultry', 'meat'] },
  { match: ['cold cut', 'deli meat', 'lunch meat', 'bologna'], tags: ['meat'] },
  { match: ['salmon', 'tuna', 'cod', 'haddock', 'tilapia', 'halibut', 'sardine', 'trout'], tags: ['fish'] },
  { match: ['shrimp', 'prawn', 'crab', 'lobster', 'scallop', 'clam', 'mussel', 'oyster'], tags: ['shellfish'] },
  { match: ['gelatin', 'jell-o', 'jello', 'marshmallow'], tags: ['gelatin'], via: 'gelatin is animal-derived' },
  { match: ['chicken stock', 'beef stock', 'chicken broth', 'beef broth', 'bouillon'], tags: ['meat'], via: 'meat stock' },

  // --- Other regulated allergens ---
  { match: ['soy', 'tofu', 'edamame', 'miso'], tags: ['soy'] },
  { match: ['sesame', 'tahini', 'hummus'], tags: ['sesame'], via: 'tahini in hummus' },
  { match: ['mustard', 'dijon'], tags: ['mustard'] },
  { match: ['wine', 'vinegar', 'dried fruit', 'raisin'], tags: ['sulphites'], via: 'sulphite preservative' },
  { match: ['honey'], tags: ['honey', 'high-sugar'] },

  // --- Sugar load (advisory, for diabetic crew) ---
  { match: ['sugar', 'syrup', 'jam', 'jelly', 'candy', 'soda', 'pop ', 'juice', 'icing', 'chocolate'], tags: ['high-sugar'] },
];

export interface TagHit {
  readonly tag: Tag;
  /** The ingredient text that produced the tag. */
  readonly source: string;
  readonly via?: string;
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9&\s-]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Split pasted free-form text into individual ingredient lines. */
export function splitIngredients(text: string): string[] {
  return text
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Every tag implied by one ingredient string, including hidden derivations. */
export function tagsFor(ingredient: string): TagHit[] {
  const hay = normalize(ingredient);
  if (hay === '') return [];
  const hits: TagHit[] = [];
  const seen = new Set<Tag>();
  for (const fact of INGREDIENT_FACTS) {
    if (!fact.match.some((m) => hay.includes(m))) continue;
    for (const tag of fact.tags) {
      if (seen.has(tag)) continue;
      seen.add(tag);
      hits.push({ tag, source: ingredient.trim(), ...(fact.via ? { via: fact.via } : {}) });
    }
  }
  return hits;
}

/** Tags for a whole pasted ingredient list. */
export function tagsForAll(ingredients: readonly string[]): TagHit[] {
  return ingredients.flatMap((i) => tagsFor(i));
}
