import { describe, it, expect } from 'vitest';
import { buildShoppingList, shoppingListToCsv, type BuildShoppingListInput } from './shopping';

const ingredients = [
  { id: 'oats', name: 'Rolled oats', category: 'dry goods', defaultUnit: 'g', unitCost: 0.004, packSize: 1000, packUnit: 'g', packCost: 4.5, haveOnHand: 0 },
  { id: 'milk', name: 'Milk', category: 'dairy', defaultUnit: 'ml', unitCost: 0.002, packSize: 2000, packUnit: 'ml', packCost: 3.8, haveOnHand: 0 },
  { id: 'salt', name: 'Salt', category: 'pantry', defaultUnit: 'g', unitCost: 0.001, packSize: null, packUnit: null, packCost: null, haveOnHand: 0 },
];

const recipes = [
  { id: 'oatmeal', name: 'Oatmeal', ingredients: [
    { ingredientId: 'oats', qtyPerServing: 60, unit: 'g' },
    { ingredientId: 'milk', qtyPerServing: 200, unit: 'ml' },
    { ingredientId: 'salt', qtyPerServing: 1, unit: 'g' },
  ] },
  { id: 'porridge-deluxe', name: 'Porridge deluxe', ingredients: [
    { ingredientId: 'oats', qtyPerServing: 40, unit: 'g' },
  ] },
];

const base = (over: Partial<BuildShoppingListInput> = {}): BuildShoppingListInput => ({
  dishes: [{ day: '2026-03-02', slot: 'breakfast', recipeId: 'oatmeal', servings: 50 }],
  recipes,
  ingredients,
  ...over,
});

describe('scaling', () => {
  it('scales each ingredient by servings', () => {
    const list = buildShoppingList(base());
    expect(list.lines.find((l) => l.ingredientId === 'oats')?.requiredQty).toBe(3000);
    expect(list.lines.find((l) => l.ingredientId === 'milk')?.requiredQty).toBe(10000);
  });

  it('treats zero or negative servings as zero rather than corrupting the list', () => {
    const list = buildShoppingList(base({ dishes: [{ day: 'd', slot: 'breakfast', recipeId: 'oatmeal', servings: -5 }] }));
    expect(list.lines.find((l) => l.ingredientId === 'oats')?.requiredQty).toBe(0);
    expect(list.totalCost).toBe(0);
  });
});

describe('consolidation', () => {
  it('merges the same ingredient across dishes and days into one line', () => {
    const list = buildShoppingList(base({ dishes: [
      { day: '2026-03-02', slot: 'breakfast', recipeId: 'oatmeal', servings: 50 },
      { day: '2026-03-03', slot: 'breakfast', recipeId: 'oatmeal', servings: 50 },
      { day: '2026-03-04', slot: 'breakfast', recipeId: 'porridge-deluxe', servings: 10 },
    ] }));
    const oats = list.lines.filter((l) => l.ingredientId === 'oats');
    expect(oats).toHaveLength(1);
    expect(oats[0]?.requiredQty).toBe(60 * 100 + 40 * 10);
  });

  it('records which dishes drove each line', () => {
    const list = buildShoppingList(base({ dishes: [
      { day: 'd1', slot: 'breakfast', recipeId: 'oatmeal', servings: 10 },
      { day: 'd2', slot: 'breakfast', recipeId: 'porridge-deluxe', servings: 10 },
    ] }));
    expect(list.lines.find((l) => l.ingredientId === 'oats')?.usedIn).toEqual(['Oatmeal', 'Porridge deluxe']);
  });
});

describe('have on hand', () => {
  it('subtracts stock before buying', () => {
    const list = buildShoppingList(base({
      ingredients: ingredients.map((i) => (i.id === 'oats' ? { ...i, haveOnHand: 1200 } : i)),
    }));
    const oats = list.lines.find((l) => l.ingredientId === 'oats');
    expect(oats?.requiredQty).toBe(3000);
    expect(oats?.toBuyQty).toBe(1800);
  });

  it('never goes negative when stock exceeds the requirement', () => {
    const list = buildShoppingList(base({
      ingredients: ingredients.map((i) => (i.id === 'oats' ? { ...i, haveOnHand: 99999 } : i)),
    }));
    const oats = list.lines.find((l) => l.ingredientId === 'oats');
    expect(oats?.toBuyQty).toBe(0);
    expect(oats?.packs).toBe(0);
    expect(oats?.cost).toBe(0);
  });
});

describe('pack rounding', () => {
  it('rounds UP to whole packs and prices by the pack', () => {
    const list = buildShoppingList(base());
    const oats = list.lines.find((l) => l.ingredientId === 'oats');
    // 3000 g needed, 1 kg packs => 3 packs exactly.
    expect(oats?.packs).toBe(3);
    expect(oats?.cost).toBe(13.5);

    const milk = list.lines.find((l) => l.ingredientId === 'milk');
    // 10000 ml needed, 2 L packs => 5 packs.
    expect(milk?.packs).toBe(5);
    expect(milk?.cost).toBe(19);
  });

  it('rounds a partial pack up, never down', () => {
    const list = buildShoppingList(base({ dishes: [{ day: 'd', slot: 'breakfast', recipeId: 'oatmeal', servings: 51 }] }));
    const oats = list.lines.find((l) => l.ingredientId === 'oats');
    expect(oats?.toBuyQty).toBe(3060);
    expect(oats?.packs).toBe(4);
    expect(oats?.purchasedQty).toBe(4000);
  });

  it('prices per unit when the ingredient has no pack size', () => {
    const list = buildShoppingList(base());
    const salt = list.lines.find((l) => l.ingredientId === 'salt');
    expect(salt?.packs).toBeNull();
    expect(salt?.cost).toBe(0.05);
  });
});

describe('cost and budget', () => {
  it('subtotals by category and totals the list', () => {
    const list = buildShoppingList(base());
    expect(list.totalCost).toBe(round(13.5 + 19 + 0.05));
    expect(list.categories.find((c) => c.category === 'dairy')?.cost).toBe(19);
  });

  it('compares against the budget and flags an overrun', () => {
    expect(buildShoppingList(base({ budget: 100 })).overBudget).toBe(false);
    expect(buildShoppingList(base({ budget: 100 })).remaining).toBe(round(100 - 32.55));
    expect(buildShoppingList(base({ budget: 10 })).overBudget).toBe(true);
    expect(buildShoppingList(base({ budget: 10 })).remaining).toBe(round(10 - 32.55));
  });

  it('omits the comparison when no budget is given', () => {
    const list = buildShoppingList(base());
    expect(list.budget).toBeNull();
    expect(list.overBudget).toBe(false);
  });
});

describe('missing references are surfaced, not swallowed', () => {
  it('reports unknown recipes and ingredients', () => {
    const list = buildShoppingList(base({
      dishes: [{ day: 'd', slot: 'lunch', recipeId: 'ghost', servings: 10 }],
    }));
    expect(list.missingRecipeIds).toEqual(['ghost']);

    const list2 = buildShoppingList(base({
      recipes: [{ id: 'oatmeal', name: 'Oatmeal', ingredients: [{ ingredientId: 'nope', qtyPerServing: 1, unit: 'g' }] }],
    }));
    expect(list2.missingIngredientIds).toEqual(['nope']);
  });
});

describe('csv export', () => {
  it('emits a header, a row per line and a total', () => {
    const csv = shoppingListToCsv(buildShoppingList(base()));
    expect(csv.split('\n')[0]).toContain('Category,Ingredient');
    expect(csv).toContain('Rolled oats');
    expect(csv.trim().endsWith('32.55,')).toBe(true);
  });
});

function round(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
