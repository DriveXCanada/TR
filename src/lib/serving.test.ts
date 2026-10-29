import { describe, it, expect } from 'vitest';
import { consumptionForSlot, drawFrom, applyReturn, shortfalls, type ServedRecipe } from './serving';

const recipes: ServedRecipe[] = [
  { id: 'oatmeal', name: 'Oatmeal', ingredients: [
    { ingredientId: 'oats', qtyPerServing: 60 },
    { ingredientId: 'milk', qtyPerServing: 200 },
  ] },
  { id: 'porridge', name: 'Porridge deluxe', ingredients: [
    { ingredientId: 'oats', qtyPerServing: 40 },
  ] },
];

describe('consumptionForSlot', () => {
  it('scales each ingredient by servings', () => {
    const lines = consumptionForSlot(['oatmeal'], recipes, 40);
    expect(lines.find((l) => l.ingredientId === 'oats')?.qty).toBe(2400);
    expect(lines.find((l) => l.ingredientId === 'milk')?.qty).toBe(8000);
  });

  it('consolidates an ingredient used by two dishes into one line', () => {
    const lines = consumptionForSlot(['oatmeal', 'porridge'], recipes, 10);
    const oats = lines.filter((l) => l.ingredientId === 'oats');
    expect(oats).toHaveLength(1);
    expect(oats[0]?.qty).toBe(1000);
    expect(oats[0]?.fromDishes).toEqual(['Oatmeal', 'Porridge deluxe']);
  });

  it('consumes nothing at zero or negative servings', () => {
    expect(consumptionForSlot(['oatmeal'], recipes, 0)).toEqual([]);
    expect(consumptionForSlot(['oatmeal'], recipes, -5)).toEqual([]);
  });

  it('ignores a dish with no known recipe rather than throwing', () => {
    expect(consumptionForSlot(['ghost'], recipes, 10)).toEqual([]);
  });

  it('does not accumulate floating-point dust', () => {
    const lines = consumptionForSlot(['oatmeal'], [
      { id: 'oatmeal', name: 'Oatmeal', ingredients: [{ ingredientId: 'salt', qtyPerServing: 0.05 }] },
    ], 47);
    expect(lines[0]?.qty).toBe(2.35);
  });
});

describe('drawFrom / applyReturn', () => {
  it('deducts and returns symmetrically when stock covers the draw', () => {
    const { remaining, drawn } = drawFrom(1000, 240);
    expect(remaining).toBe(760);
    expect(drawn).toBe(240);
    expect(applyReturn(remaining, drawn)).toBe(1000);
  });

  it('floors at zero — a negative pantry is not a fact about the world', () => {
    expect(drawFrom(100, 250).remaining).toBe(0);
  });

  it('THE bug this prevents: undo must not invent stock that never existed', () => {
    // Pantry empty, recipe wants 1920 g. Nothing comes out...
    const { remaining, drawn } = drawFrom(0, 1920);
    expect(remaining).toBe(0);
    expect(drawn).toBe(0);
    // ...so nothing goes back.
    expect(applyReturn(remaining, drawn)).toBe(0);
  });

  it('a partial draw returns only what was taken', () => {
    const { remaining, drawn } = drawFrom(100, 250);
    expect(drawn).toBe(100);
    expect(applyReturn(remaining, drawn)).toBe(100);
  });

  it('repeated serve/undo cycles cannot inflate the pantry', () => {
    let stock = 500;
    for (let i = 0; i < 10; i += 1) {
      const { remaining, drawn } = drawFrom(stock, 800);   // always more than we hold
      stock = applyReturn(remaining, drawn);
    }
    expect(stock).toBe(500);
  });
});

describe('shortfalls', () => {
  it('names what the pantry cannot cover', () => {
    const lines = consumptionForSlot(['oatmeal'], recipes, 40);
    const stock = new Map([['oats', 1000], ['milk', 99999]]);
    expect(shortfalls(lines, stock)).toEqual([{ ingredientId: 'oats', short: 1400 }]);
  });

  it('is empty when stock covers the draw', () => {
    const lines = consumptionForSlot(['oatmeal'], recipes, 1);
    expect(shortfalls(lines, new Map([['oats', 100], ['milk', 500]]))).toEqual([]);
  });

  it('treats an unknown ingredient as zero stock rather than skipping it', () => {
    const lines = consumptionForSlot(['oatmeal'], recipes, 1);
    expect(shortfalls(lines, new Map()).length).toBe(2);
  });
});
