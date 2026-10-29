import { describe, it, expect } from 'vitest';
import { checkConflicts, checkDish, explainConflict, groupConflicts, type CrewMember } from './conflict';
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

describe('explaining a conflict so it gets acted on', () => {
  /** The real case: a beef chilli that genuinely carries fish protein. */
  const chilli = [
    'Ground beef', 'Kidney beans, tinned', 'Tomato paste',
    'Onions', 'Chili powder', 'Worcestershire sauce',
  ];
  const devon: CrewMember = {
    id: 'v1', firstName: 'Devon', lastName: 'Achterberg',
    restrictions: [{ key: 'fish', severity: 'severe' }],
  };

  it('flags the chilli, because Worcestershire sauce is made with anchovy', () => {
    const { conflicts } = checkConflicts(chilli, [devon]);
    const fish = conflicts.find((c) => c.tag === 'fish');
    expect(fish).toBeDefined();
    expect(fish?.severity).toBe('severe');
    expect(fish?.ingredient.toLowerCase()).toContain('worcestershire');
    expect(fish?.via).toMatch(/anchovy/i);
  });

  it('names the ingredient and the derivation, not just the tag', () => {
    const { conflicts } = checkConflicts(chilli, [devon]);
    const fish = conflicts.find((c) => c.tag === 'fish');
    const line = explainConflict(fish!);
    expect(line).toContain('Devon Achterberg');
    expect(line).toContain('fish');
    expect(line).toMatch(/worcestershire/i);
    expect(line).toMatch(/anchovy/i);
  });

  it('does not blame the beef for the fish warning', () => {
    const { conflicts } = checkConflicts(chilli, [devon]);
    const fish = conflicts.find((c) => c.tag === 'fish');
    expect(fish?.ingredient.toLowerCase()).not.toContain('beef');
  });

  it('groups one line per reason instead of repeating a tag', () => {
    const second: CrewMember = {
      id: 'v2', firstName: 'Sam', lastName: 'Okonkwo',
      restrictions: [{ key: 'fish', severity: 'severe' }],
    };
    const groups = groupConflicts(checkConflicts(chilli, [devon, second]).conflicts);
    const fish = groups.filter((g) => g.tag === 'fish');
    expect(fish).toHaveLength(1);
    expect(fish[0]?.people).toEqual(['Devon Achterberg', 'Sam Okonkwo']);
  });

  it('keeps the same tag separate when two ingredients cause it', () => {
    const groups = groupConflicts(checkConflicts(
      ['Worcestershire sauce', 'Anchovy fillets'],
      [devon],
    ).conflicts);
    const fish = groups.filter((g) => g.tag === 'fish');
    expect(fish.length).toBeGreaterThan(1);
  });

  it('ranks severe first so the dangerous line is read first', () => {
    const mixed: CrewMember = {
      id: 'v3', firstName: 'Ada', lastName: 'Byron',
      restrictions: [{ key: 'vegetarian', severity: 'preference' }],
    };
    const groups = groupConflicts(checkConflicts(chilli, [devon, mixed]).conflicts);
    expect(groups[0]?.severity).toBe('severe');
  });

  it('never drops a person from a group', () => {
    const many = ['Ann Lee', 'Bo Chen', 'Cy Doe'].map((n, i) => ({
      id: `m${i}`, firstName: n.split(' ')[0]!, lastName: n.split(' ')[1]!,
      restrictions: [{ key: 'fish', severity: 'severe' as const }],
    }));
    const groups = groupConflicts(checkConflicts(chilli, many).conflicts);
    const fish = groups.find((g) => g.tag === 'fish');
    expect(fish?.people).toHaveLength(3);
  });
});

describe('the dish name as a backstop, not a second voice', () => {
  const devon: CrewMember = {
    id: 'v1', firstName: 'Devon', lastName: 'Achterberg',
    restrictions: [{ key: 'vegetarian', severity: 'preference' }],
  };

  it('does not repeat a tag the ingredients already proved', () => {
    const r = checkDish('Beef chilli', ['Ground beef', 'Kidney beans, tinned'], [devon]);
    const meat = groupConflicts(r.conflicts).filter((g) => g.tag === 'meat');
    expect(meat).toHaveLength(1);
    expect(meat[0]?.ingredient).toBe('Ground beef');
  });

  it('still catches an allergen that only the name reveals', () => {
    const sam: CrewMember = {
      id: 'v2', firstName: 'Sam', lastName: 'Okonkwo',
      restrictions: [{ key: 'peanuts', severity: 'severe' }],
    };
    // The cook forgot to list the peanut butter.
    const r = checkDish('Peanut noodles', ['Egg noodles', 'Soy sauce'], [sam]);
    const peanut = r.conflicts.find((c) => c.tag === 'peanuts');
    expect(peanut).toBeDefined();
    expect(peanut?.severity).toBe('severe');
    expect(r.verdict).toBe('hold');
  });

  it('says when a warning came from the name rather than an ingredient', () => {
    const sam: CrewMember = {
      id: 'v2', firstName: 'Sam', lastName: 'Okonkwo',
      restrictions: [{ key: 'peanuts', severity: 'severe' }],
    };
    const r = checkDish('Peanut noodles', ['Egg noodles'], [sam]);
    const peanut = r.conflicts.find((c) => c.tag === 'peanuts');
    expect(peanut?.via).toMatch(/ingredient list does not account/i);
  });

  it('counts people, not lines, as severe', () => {
    const sam: CrewMember = {
      id: 'v2', firstName: 'Sam', lastName: 'Okonkwo',
      restrictions: [{ key: 'fish', severity: 'severe' }],
    };
    const r = checkDish('Fish pie', ['Worcestershire sauce', 'Anchovy fillets'], [sam]);
    expect(r.severeCount).toBe(1);
    expect(r.conflicts.length).toBeGreaterThan(1);
  });

  it('a dish with no ingredients listed is still checked by name', () => {
    const sam: CrewMember = {
      id: 'v2', firstName: 'Sam', lastName: 'Okonkwo',
      restrictions: [{ key: 'peanuts', severity: 'severe' }],
    };
    const r = checkDish('Peanut butter cookies', [], [sam]);
    expect(r.verdict).toBe('hold');
    expect(r.severeCount).toBe(1);
  });

  it('a clean dish stays clear', () => {
    const r = checkDish('Roast potatoes & carrots', ['Potatoes', 'Carrots'], [devon]);
    expect(r.verdict).toBe('clear');
  });
});
