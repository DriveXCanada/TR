/**
 * Shopping list builder.
 *
 * Walks the planned menu, scales every recipe to the servings actually needed,
 * consolidates identical ingredients across dishes and days, subtracts what is
 * already on hand, rounds up to purchasable pack sizes, and prices the result
 * against the operation budget.
 *
 * Rounding is always UP. Running out of food mid-service is a real failure;
 * a surplus tin of tomatoes is not.
 */
import { round2 } from './budget';

export interface ShoppingIngredient {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly defaultUnit: string;
  /** Cost per single `defaultUnit`. Used when no pack size is defined. */
  readonly unitCost: number;
  /** Purchasable pack, e.g. 2.5 kg. When set, purchases round up to whole packs. */
  readonly packSize?: number | null;
  readonly packUnit?: string | null;
  readonly packCost?: number | null;
  /** Already in the store cupboard, in `defaultUnit`. */
  readonly haveOnHand?: number | null;
}

export interface PlannedRecipeIngredient {
  readonly ingredientId: string;
  readonly qtyPerServing: number;
  readonly unit: string;
}

export interface PlannedRecipe {
  readonly id: string;
  readonly name: string;
  readonly ingredients: readonly PlannedRecipeIngredient[];
}

/** One dish planned into one slot, with the servings it must cover. */
export interface PlannedDish {
  readonly day: string;
  readonly slot: string;
  readonly recipeId: string;
  readonly servings: number;
}

export interface ShoppingLine {
  readonly ingredientId: string;
  readonly name: string;
  readonly category: string;
  readonly unit: string;
  /** Total the menu calls for. */
  readonly requiredQty: number;
  readonly haveOnHand: number;
  /** requiredQty minus what is on hand, floored at zero. */
  readonly toBuyQty: number;
  /** Whole packs to purchase, when the ingredient is sold in packs. */
  readonly packs: number | null;
  readonly packSize: number | null;
  readonly packUnit: string | null;
  /** What is actually bought after pack rounding, in `unit`. */
  readonly purchasedQty: number;
  readonly cost: number;
  /** Which dishes drove this line — so a cook can trace a quantity back. */
  readonly usedIn: readonly string[];
}

export interface CategorySubtotal {
  readonly category: string;
  readonly cost: number;
  readonly lines: number;
}

export interface ShoppingList {
  readonly lines: readonly ShoppingLine[];
  readonly categories: readonly CategorySubtotal[];
  readonly totalCost: number;
  readonly budget: number | null;
  readonly remaining: number | null;
  readonly overBudget: boolean;
  /** Recipes referenced by the menu that we have no definition for. */
  readonly missingRecipeIds: readonly string[];
  /** Ingredients referenced by a recipe that are not in the catalogue. */
  readonly missingIngredientIds: readonly string[];
}

export interface BuildShoppingListInput {
  readonly dishes: readonly PlannedDish[];
  readonly recipes: readonly PlannedRecipe[];
  readonly ingredients: readonly ShoppingIngredient[];
  /** Total operation budget to compare against. Omit for no comparison. */
  readonly budget?: number | null;
}

export function buildShoppingList(input: BuildShoppingListInput): ShoppingList {
  const recipeById = new Map(input.recipes.map((r) => [r.id, r]));
  const ingredientById = new Map(input.ingredients.map((i) => [i.id, i]));

  const required = new Map<string, { qty: number; unit: string; usedIn: Set<string> }>();
  const missingRecipes = new Set<string>();
  const missingIngredients = new Set<string>();

  for (const dish of input.dishes) {
    const recipe = recipeById.get(dish.recipeId);
    if (recipe === undefined) {
      missingRecipes.add(dish.recipeId);
      continue;
    }
    // Negative or non-finite servings would silently corrupt the whole list.
    const servings = Number.isFinite(dish.servings) && dish.servings > 0 ? dish.servings : 0;
    for (const line of recipe.ingredients) {
      if (!ingredientById.has(line.ingredientId)) {
        missingIngredients.add(line.ingredientId);
        continue;
      }
      const existing = required.get(line.ingredientId);
      const addition = line.qtyPerServing * servings;
      if (existing === undefined) {
        required.set(line.ingredientId, {
          qty: addition,
          unit: line.unit,
          usedIn: new Set([recipe.name]),
        });
      } else {
        existing.qty += addition;
        existing.usedIn.add(recipe.name);
      }
    }
  }

  const lines: ShoppingLine[] = [];
  for (const [ingredientId, agg] of required) {
    const ingredient = ingredientById.get(ingredientId);
    if (ingredient === undefined) continue;

    const requiredQty = round3(agg.qty);
    const haveOnHand = Math.max(0, ingredient.haveOnHand ?? 0);
    const toBuyQty = round3(Math.max(0, requiredQty - haveOnHand));

    const packSize = ingredient.packSize ?? null;
    const usePacks = packSize !== null && packSize > 0;
    const packs = usePacks ? Math.ceil(toBuyQty / packSize) : null;
    const purchasedQty = usePacks && packs !== null ? round3(packs * packSize) : toBuyQty;

    const cost = usePacks && packs !== null
      ? round2(packs * (ingredient.packCost ?? 0))
      : round2(toBuyQty * ingredient.unitCost);

    lines.push({
      ingredientId,
      name: ingredient.name,
      category: ingredient.category,
      unit: ingredient.defaultUnit,
      requiredQty,
      haveOnHand,
      toBuyQty,
      packs,
      packSize,
      packUnit: ingredient.packUnit ?? null,
      purchasedQty,
      cost,
      usedIn: [...agg.usedIn].sort(),
    });
  }

  lines.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));

  const byCategory = new Map<string, { cost: number; lines: number }>();
  for (const line of lines) {
    const entry = byCategory.get(line.category) ?? { cost: 0, lines: 0 };
    entry.cost = round2(entry.cost + line.cost);
    entry.lines += 1;
    byCategory.set(line.category, entry);
  }

  const totalCost = round2(lines.reduce((sum, l) => sum + l.cost, 0));
  const budget = input.budget ?? null;

  return {
    lines,
    categories: [...byCategory.entries()]
      .map(([category, v]) => ({ category, cost: v.cost, lines: v.lines }))
      .sort((a, b) => a.category.localeCompare(b.category)),
    totalCost,
    budget,
    remaining: budget === null ? null : round2(budget - totalCost),
    overBudget: budget !== null && totalCost > budget,
    missingRecipeIds: [...missingRecipes],
    missingIngredientIds: [...missingIngredients],
  };
}

function round3(n: number): number {
  return Math.round((n + Number.EPSILON) * 1000) / 1000;
}

/** CSV export of a shopping list. */
export function shoppingListToCsv(list: ShoppingList): string {
  const header = ['Category', 'Ingredient', 'Required', 'Unit', 'Have on hand', 'To buy', 'Packs', 'Purchased', 'Cost', 'Used in'];
  const rows = list.lines.map((l) => [
    l.category, l.name, String(l.requiredQty), l.unit, String(l.haveOnHand),
    String(l.toBuyQty), l.packs === null ? '' : String(l.packs), String(l.purchasedQty),
    l.cost.toFixed(2), l.usedIn.join(' / '),
  ]);
  return [header, ...rows, [], ['Total', '', '', '', '', '', '', '', list.totalCost.toFixed(2), '']]
    .map((r) => r.map(csvCell).join(','))
    .join('\n');
}

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
