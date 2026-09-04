import { describe, it, expect } from 'vitest';
import { tallySizes, sanitizeSizes, sizeCompleteness, SCHEMES, type SizeMap } from './sizes';

const person = (sizes: SizeMap) => ({ sizes });

describe('sanitizeSizes — form input is never trusted', () => {
  it('keeps recognised scheme/option pairs', () => {
    expect(sanitizeSizes({ shirt: 'L', boot: '10' })).toEqual({ shirt: 'L', boot: '10' });
  });
  it('drops unknown schemes and unknown options', () => {
    expect(sanitizeSizes({ hat: 'L', shirt: 'Enormous', glove: 'M' })).toEqual({ glove: 'M' });
  });
  it('drops blanks, non-strings and non-objects', () => {
    expect(sanitizeSizes({ shirt: '  ', glove: 42 })).toEqual({});
    expect(sanitizeSizes(null)).toEqual({});
    expect(sanitizeSizes('L')).toEqual({});
  });
  it('trims surrounding whitespace', () => {
    expect(sanitizeSizes({ shirt: ' L ' })).toEqual({ shirt: 'L' });
  });
});

describe('tallySizes', () => {
  const crew = [
    person({ shirt: 'L', glove: 'M', boot: '10' }),
    person({ shirt: 'L', glove: 'L', boot: '10' }),
    person({ shirt: 'M', glove: 'M' }),
    person({}),
  ];

  it('counts each size within a scheme', () => {
    const shirt = tallySizes(crew, ['shirt'])[0];
    expect(shirt?.counts.find((c) => c.size === 'L')?.count).toBe(2);
    expect(shirt?.counts.find((c) => c.size === 'M')?.count).toBe(1);
  });

  it('reports unanswered separately and never folds it into a size', () => {
    const boot = tallySizes(crew, ['boot'])[0];
    expect(boot?.unknown).toBe(2);
    expect(boot?.counts.reduce((s, c) => s + c.count, 0)).toBe(2);
    expect((boot?.counts.reduce((s, c) => s + c.count, 0) ?? 0) + (boot?.unknown ?? 0)).toBe(crew.length);
  });

  it('lists every option in the scheme order, including zeroes', () => {
    const glove = tallySizes(crew, ['glove'])[0];
    expect(glove?.counts.map((c) => c.size)).toEqual([...SCHEMES.glove.options]);
  });

  it('treats a value outside the scheme as unknown rather than inventing a size', () => {
    const odd = tallySizes([person({ shirt: 'XXXXL' } as SizeMap)], ['shirt'])[0];
    expect(odd?.unknown).toBe(1);
    expect(odd?.counts.every((c) => c.count === 0)).toBe(true);
  });

  it('handles an empty crew', () => {
    const t = tallySizes([], ['shirt'])[0];
    expect(t?.total).toBe(0);
    expect(t?.unknown).toBe(0);
  });
});

describe('sizeCompleteness', () => {
  it('separates fully answered, partly answered and silent', () => {
    const all: SizeMap = { shirt: 'L', glove: 'M', boot: '10', mask: 'Regular', helmet: 'Adjustable' };
    const result = sizeCompleteness([person(all), person({ shirt: 'M' }), person({})]);
    expect(result).toEqual({ complete: 1, partial: 1, missing: 1, total: 3 });
  });
});
