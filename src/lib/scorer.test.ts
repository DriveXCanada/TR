import { describe, it, expect } from 'vitest';
import { scoreDish, rankDishes, servableDishes, type PreferenceCrew, type ScoreableDish } from './scorer';

const dish = (id: string, name: string, ingredients: string[]): ScoreableDish => ({ id, name, ingredients });

const chilli = dish('chilli', 'Beef chilli', ['ground beef', 'kidney beans', 'tomato']);
const pasta = dish('pasta', 'Tomato pasta', ['pasta', 'tomato', 'olive oil']);
const satay = dish('satay', 'Chicken satay', ['chicken', 'peanut butter', 'soy sauce']);
const rice = dish('rice', 'Rice and vegetables', ['rice', 'carrot', 'pepper']);

const peanutSevere: PreferenceCrew = {
  id: 'v1', firstName: 'Sam', lastName: 'Reed',
  restrictions: [{ key: 'peanuts', severity: 'severe' }],
};
const glutenIntolerant: PreferenceCrew = {
  id: 'v2', firstName: 'Rae', lastName: 'Fox',
  restrictions: [{ key: 'gluten', severity: 'intolerance' }],
};
const vegetarian: PreferenceCrew = {
  id: 'v3', firstName: 'Ari', lastName: 'Lund',
  restrictions: [{ key: 'vegetarian', severity: 'preference' }],
};

describe('hard exclusion by severe restriction', () => {
  it('excludes a dish that conflicts with a severe restriction', () => {
    const score = scoreDish(satay, [peanutSevere]);
    expect(score.excluded).toBe(true);
    expect(score.excludedBy[0]).toContain('Sam Reed');
    expect(score.score).toBe(Number.NEGATIVE_INFINITY);
  });

  it('a severe exclusion cannot be outweighed by any number of likes', () => {
    const crowdPleaser: PreferenceCrew[] = [
      peanutSevere,
      ...Array.from({ length: 40 }, (_, i) => ({
        id: `f${i}`, firstName: `Fan${i}`, lastName: 'X',
        restrictions: [], likes: ['satay', 'chicken', 'peanut'],
      })),
    ];
    const ranked = rankDishes([satay, rice], crowdPleaser);
    expect(ranked[0]?.dish.id).toBe('rice');
    expect(ranked.find((r) => r.dish.id === 'satay')?.excluded).toBe(true);
  });

  it('servableDishes never returns an excluded dish', () => {
    expect(servableDishes([satay, rice], [peanutSevere]).map((d) => d.dish.id)).toEqual(['rice']);
  });

  it('does not exclude when the same allergen is only an intolerance', () => {
    const score = scoreDish(pasta, [glutenIntolerant]);
    expect(score.excluded).toBe(false);
    expect(score.worstSeverity).toBe('intolerance');
  });
});

describe('soft scoring', () => {
  it('rewards likes and morale, penalises dislikes', () => {
    const liker: PreferenceCrew = { id: 'a', firstName: 'A', lastName: 'A', restrictions: [], likes: ['chilli'] };
    const hater: PreferenceCrew = { id: 'b', firstName: 'B', lastName: 'B', restrictions: [], dislikes: ['chilli'] };
    expect(scoreDish(chilli, [liker]).score).toBeGreaterThan(scoreDish(chilli, [hater]).score);
  });

  it('weights morale above a plain like', () => {
    const liker: PreferenceCrew = { id: 'a', firstName: 'A', lastName: 'A', restrictions: [], likes: ['chilli'] };
    const morale: PreferenceCrew = { id: 'b', firstName: 'B', lastName: 'B', restrictions: [], morale: ['chilli'] };
    expect(scoreDish(chilli, [morale]).score).toBeGreaterThan(scoreDish(chilli, [liker]).score);
  });

  it('penalises soft conflicts — a vegetarian nudges beef down', () => {
    expect(scoreDish(chilli, [vegetarian]).score).toBeLessThan(scoreDish(rice, [vegetarian]).score);
  });

  it('ranks best-first and breaks ties by name', () => {
    const ranked = rankDishes([rice, pasta], []);
    expect(ranked.map((r) => r.dish.name)).toEqual(['Rice and vegetables', 'Tomato pasta']);
  });
});

describe('degenerate inputs', () => {
  it('an empty crew excludes nothing', () => {
    expect(scoreDish(satay, []).excluded).toBe(false);
  });
  it('a dish with no ingredients conflicts with nobody', () => {
    expect(scoreDish(dish('x', 'Mystery', []), [peanutSevere]).excluded).toBe(false);
  });
  it('handles an empty dish list', () => {
    expect(rankDishes([], [peanutSevere])).toEqual([]);
  });
});
