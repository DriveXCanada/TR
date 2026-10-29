import { describe, it, expect } from 'vitest';
import { parseIngredientLine, parseIngredientList } from './recipe-parse';

const p = (s: string) => parseIngredientLine(s);

describe('parseIngredientLine', () => {
  it('reads the common shape: quantity, unit, name', () => {
    expect(p('60 g rolled oats')).toMatchObject({ qty: 60, unit: 'g', name: 'rolled oats' });
    expect(p('200 ml milk')).toMatchObject({ qty: 200, unit: 'ml', name: 'milk' });
  });

  it('handles a unit glued to the number', () => {
    expect(p('200ml milk')).toMatchObject({ qty: 200, unit: 'ml', name: 'milk' });
    expect(p('1.5kg potatoes')).toMatchObject({ qty: 1.5, unit: 'kg', name: 'potatoes' });
  });

  it('treats a countable thing with no unit as "each"', () => {
    expect(p('2 eggs')).toMatchObject({ qty: 2, unit: 'each', name: 'eggs' });
    expect(p('3 onions')).toMatchObject({ qty: 3, unit: 'each', name: 'onions' });
  });

  it('does not mistake the first word of a name for a unit', () => {
    expect(p('2 bay leaves')).toMatchObject({ qty: 2, unit: 'each', name: 'bay leaves' });
    expect(p('4 chicken thighs')).toMatchObject({ qty: 4, unit: 'each', name: 'chicken thighs' });
  });

  it('accepts a bare ingredient as one each', () => {
    expect(p('salt')).toMatchObject({ qty: 1, unit: 'each', name: 'salt' });
  });

  it('strips bullets, dashes and "of"', () => {
    expect(p('- 60 g of rolled oats')).toMatchObject({ qty: 60, unit: 'g', name: 'rolled oats' });
    expect(p('• 2 eggs')).toMatchObject({ qty: 2, name: 'eggs' });
  });

  it('normalises unit spellings', () => {
    expect(p('2 kilos beef')?.unit).toBe('kg');
    expect(p('1 litre stock')?.unit).toBe('L');
    expect(p('3 tablespoons oil')?.unit).toBe('tbsp');
    expect(p('2 cans tomatoes')?.unit).toBe('tin');
    expect(p('4 slices bread')?.unit).toBe('slice');
  });

  it('reads fractions', () => {
    expect(p('1/2 cup rice')).toMatchObject({ qty: 0.5, unit: 'cup', name: 'rice' });
    expect(p('½ tsp pepper')).toMatchObject({ qty: 0.5, unit: 'tsp' });
  });

  it('accepts a comma decimal', () => {
    expect(p('1,5 kg flour')).toMatchObject({ qty: 1.5, unit: 'kg' });
  });

  it('ignores blank lines', () => {
    expect(p('   ')).toBeNull();
  });
});

describe('parseIngredientList', () => {
  it('parses a pasted block', () => {
    const { lines, unparsed } = parseIngredientList(
      `60 g rolled oats
       200 ml milk
       2 eggs
       salt`,
    );
    expect(lines).toHaveLength(4);
    expect(unparsed).toHaveLength(0);
    expect(lines.map((l) => l.name)).toEqual(['rolled oats', 'milk', 'eggs', 'salt']);
  });

  it('keeps the raw line so the UI can show what it understood', () => {
    const { lines } = parseIngredientList('60 g rolled oats');
    expect(lines[0]?.raw).toBe('60 g rolled oats');
  });

  it('reports a line it cannot read rather than guessing at it', () => {
    const { lines, unparsed } = parseIngredientList('60 g oats\n12345\n200 ml milk');
    expect(lines).toHaveLength(2);
    expect(unparsed).toEqual(['12345']);
  });

  it('skips empty lines without complaint', () => {
    const { lines, unparsed } = parseIngredientList('60 g oats\n\n\n200 ml milk\n');
    expect(lines).toHaveLength(2);
    expect(unparsed).toHaveLength(0);
  });
});

describe('matching the catalogue rather than polluting it', () => {
  it('drops a vague measure so the line names the real ingredient', () => {
    expect(parseIngredientLine('pinch of salt')?.name).toBe('salt');
    expect(parseIngredientLine('a handful of parsley')?.name).toBe('parsley');
    expect(parseIngredientLine('splash of vinegar')?.name).toBe('vinegar');
    expect(parseIngredientLine('knob of butter')?.name).toBe('butter');
  });

  it('drops a preparation note that follows a comma', () => {
    expect(parseIngredientLine('2 onions, finely chopped')?.name).toBe('onions');
    expect(parseIngredientLine('1 tin chickpeas, drained and rinsed')?.name).toBe('chickpeas');
    expect(parseIngredientLine('salt, to taste')?.name).toBe('salt');
  });

  it('keeps trailing text it does not recognise, rather than losing an ingredient', () => {
    expect(parseIngredientLine('2 onions, red if you have them')?.name)
      .toBe('onions, red if you have them');
  });

  it('drops a parenthesised optional marker', () => {
    expect(parseIngredientLine('30 g chilli flakes (optional)')?.name).toBe('chilli flakes');
  });

  it('does not strip a word that is part of the ingredient', () => {
    expect(parseIngredientLine('200 g few-grain bread')?.name).toBe('few-grain bread');
    expect(parseIngredientLine('1 scoop protein powder')?.name).toBe('protein powder');
  });
});
