import { describe, it, expect } from 'vitest';
import { checkConflicts, type CrewMember } from './conflict';
import { tagsFor, splitIngredients } from './allergens';

const member = (id: string, first: string, restrictions: CrewMember['restrictions']): CrewMember =>
  ({ id, firstName: first, lastName: 'Test', restrictions });

const fishAllergic = member('v1', 'Dana', [{ key: 'fish', severity: 'severe' }]);
const vegetarian = member('v2', 'Ari', [{ key: 'vegetarian', severity: 'preference' }]);
const peanutAllergic = member('v3', 'Sam', [{ key: 'peanuts', severity: 'severe' }]);
const glutenIntolerant = member('v4', 'Rae', [{ key: 'gluten', severity: 'intolerance' }]);

describe('hidden ingredients', () => {
  it('THE case: worcestershire -> anchovy -> flags fish-allergic AND vegetarian crew', () => {
    const report = checkConflicts('pulled pork, worcestershire sauce, brown sugar', [fishAllergic, vegetarian]);

    const fish = report.conflicts.find((c) => c.volunteerId === 'v1');
    expect(fish).toBeDefined();
    expect(fish?.tag).toBe('fish');
    expect(fish?.severity).toBe('severe');
    expect(fish?.via).toMatch(/anchovy/i);

    // The vegetarian is flagged too — by the pork, and by the same fish tag.
    const vegConflicts = report.conflicts.filter((c) => c.volunteerId === 'v2');
    expect(vegConflicts.length).toBeGreaterThan(0);
    expect(vegConflicts.map((c) => c.tag)).toContain('fish');

    expect(report.verdict).toBe('hold');
    expect(report.severeCount).toBe(1);
  });

  it('explains the derivation rather than asserting a bare tag', () => {
    const hits = tagsFor('Worcestershire sauce');
    expect(hits.find((h) => h.tag === 'fish')?.via).toMatch(/anchovy/i);
  });

  it('catches fish hidden in commercial BBQ sauce', () => {
    const report = checkConflicts('bbq sauce', [fishAllergic]);
    expect(report.severeCount).toBe(1);
    expect(report.conflicts[0]?.via).toMatch(/worcestershire/i);
  });

  it('catches egg hidden in mayonnaise and tree nuts hidden in pesto', () => {
    const eggAllergic = member('v5', 'Kit', [{ key: 'egg', severity: 'severe' }]);
    const nutAllergic = member('v6', 'Lou', [{ key: 'tree-nuts', severity: 'severe' }]);
    expect(checkConflicts('mayonnaise', [eggAllergic]).severeCount).toBe(1);
    expect(checkConflicts('pesto', [nutAllergic]).conflicts[0]?.via).toMatch(/pine nuts/i);
  });

  it('catches wheat hidden in soy sauce', () => {
    expect(checkConflicts('soy sauce', [glutenIntolerant]).conflicts[0]?.via).toMatch(/wheat/i);
  });
});

describe('packed lunch safety', () => {
  it('PB&J trips the peanut check', () => {
    const report = checkConflicts('PB&J sandwich', [peanutAllergic]);
    expect(report.severeCount).toBe(1);
    expect(report.verdict).toBe('hold');
  });

  it('a cheese sandwich does not trip peanuts, but does trip dairy and gluten', () => {
    const dairyFree = member('v7', 'Max', [{ key: 'dairy', severity: 'intolerance' }]);
    expect(checkConflicts('cheese sandwich on bread', [peanutAllergic]).conflicts).toHaveLength(0);
    expect(checkConflicts('cheese sandwich on bread', [dairyFree, glutenIntolerant]).conflicts).toHaveLength(2);
  });

  it('BLT flags vegetarians and pork restrictions', () => {
    const noPork = member('v8', 'Noor', [{ key: 'pork', severity: 'severe' }]);
    const report = checkConflicts('BLT: bacon, lettuce, tomato, bread, mayonnaise', [vegetarian, noPork]);
    expect(report.conflicts.some((c) => c.volunteerId === 'v8' && c.tag === 'pork')).toBe(true);
    expect(report.conflicts.some((c) => c.volunteerId === 'v2')).toBe(true);
  });
});

describe('ranking and verdict', () => {
  it('ranks severe first regardless of input order', () => {
    const report = checkConflicts('bread, peanut butter', [glutenIntolerant, peanutAllergic]);
    expect(report.conflicts[0]?.severity).toBe('severe');
    expect(report.conflicts.at(-1)?.severity).toBe('intolerance');
  });

  it('is CLEAR only when nothing conflicts', () => {
    expect(checkConflicts('rice, carrots, salt', [fishAllergic, peanutAllergic]).verdict).toBe('clear');
    expect(checkConflicts('rice, tuna', [fishAllergic]).verdict).toBe('hold');
  });

  it('an empty crew cannot produce conflicts', () => {
    expect(checkConflicts('peanut butter, tuna, bread', []).verdict).toBe('clear');
  });

  it('surfaces unrecognised restriction keys instead of dropping them', () => {
    const odd = member('v9', 'Wren', [{ key: 'nightshades', severity: 'severe' }]);
    const report = checkConflicts('tomato, potato', [odd]);
    expect(report.unmatchedKeys).toContain('nightshades');
  });

  it('is case- and punctuation-insensitive', () => {
    expect(checkConflicts('WORCESTERSHIRE SAUCE!!', [fishAllergic]).severeCount).toBe(1);
    expect(checkConflicts('Peanut-Butter', [peanutAllergic]).severeCount).toBe(1);
  });
});

describe('vegan vs vegetarian', () => {
  it('vegan also excludes dairy, egg and honey', () => {
    const vegan = member('v10', 'Ash', [{ key: 'vegan', severity: 'preference' }]);
    expect(checkConflicts('butter, honey', [vegan]).conflicts.length).toBeGreaterThanOrEqual(2);
    expect(checkConflicts('butter, honey', [vegetarian]).conflicts).toHaveLength(0);
  });
});

describe('splitIngredients', () => {
  it('splits on newlines, commas and semicolons and drops blanks', () => {
    expect(splitIngredients('bread,\n butter;;  \n cheese ')).toEqual(['bread', 'butter', 'cheese']);
  });
});
