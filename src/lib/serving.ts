/**
 * Serving a meal draws down the pantry.
 *
 * Counting a store cupboard every day is the job nobody does, so stock figures
 * drift and the shopping list quietly becomes fiction. Marking a meal served
 * deducts what it used, which keeps a ROUGH running figure — good enough to
 * spot "we are nearly out of oats" without a full count.
 *
 * Two properties make this safe to put in front of a tired cook:
 *  - Serving twice does nothing the second time. The slot records that it was
 *    served, and the deduction happens once.
 *  - Undo reverses exactly. The servings count is snapshotted at the moment of
 *    serving, so reversing uses that number even if the roster changed since.
 */
import { round2 } from './budget';

export interface ServedRecipeLine {
  readonly ingredientId: string;
  readonly qtyPerServing: number;
}

export interface ServedRecipe {
  readonly id: string;
  readonly name: string;
  readonly ingredients: readonly ServedRecipeLine[];
}

export interface ConsumptionLine {
  readonly ingredientId: string;
  readonly qty: number;
  /** Which dishes drew on it — so a surprising figure can be traced. */
  readonly fromDishes: readonly string[];
}

/**
 * What a slot consumes at a given number of servings.
 *
 * Consolidates across dishes: two dishes both using oats produce one line, so
 * the pantry is decremented once with the combined figure.
 */
export function consumptionForSlot(
  recipeIds: readonly string[],
  recipes: readonly ServedRecipe[],
  servings: number,
): ConsumptionLine[] {
  const count = Number.isFinite(servings) && servings > 0 ? servings : 0;
  if (count === 0) return [];

  const byId = new Map(recipes.map((r) => [r.id, r]));
  const totals = new Map<string, { qty: number; dishes: Set<string> }>();

  for (const recipeId of recipeIds) {
    const recipe = byId.get(recipeId);
    if (recipe === undefined) continue;
    for (const line of recipe.ingredients) {
      const entry = totals.get(line.ingredientId) ?? { qty: 0, dishes: new Set<string>() };
      entry.qty += line.qtyPerServing * count;
      entry.dishes.add(recipe.name);
      totals.set(line.ingredientId, entry);
    }
  }

  return [...totals.entries()].map(([ingredientId, v]) => ({
    ingredientId,
    qty: round2(v.qty),
    fromDishes: [...v.dishes].sort(),
  }));
}

export interface ActualDraw {
  readonly ingredientId: string;
  /** What was really taken — never more than was there. */
  readonly qty: number;
}

/**
 * How much can actually come out, and what the new level is.
 *
 * Stock floors at zero: a negative pantry is not a fact about the world, it
 * means the recorded figure was already wrong. Crucially the amount actually
 * drawn is returned alongside, because that — not the recipe's demand — is what
 * an undo has to put back. Returning the full demand to a pantry that could
 * not supply it invents stock, and repeated serve/undo cycles would inflate it
 * without limit.
 */
export function drawFrom(stockOnHand: number, qty: number): { remaining: number; drawn: number } {
  const drawn = round2(Math.min(Math.max(0, stockOnHand), Math.max(0, qty)));
  return { remaining: round2(Math.max(0, stockOnHand - qty)), drawn };
}

export function applyReturn(stockOnHand: number, qty: number): number {
  return round2(stockOnHand + Math.max(0, qty));
}

/** Ingredients a serving would push below zero — i.e. the recorded stock is wrong. */
export function shortfalls(
  lines: readonly ConsumptionLine[],
  stockById: ReadonlyMap<string, number>,
): { ingredientId: string; short: number }[] {
  const out: { ingredientId: string; short: number }[] = [];
  for (const line of lines) {
    const have = stockById.get(line.ingredientId) ?? 0;
    if (line.qty > have) out.push({ ingredientId: line.ingredientId, short: round2(line.qty - have) });
  }
  return out;
}
