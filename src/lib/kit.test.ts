import { describe, it, expect } from 'vitest';
import { needForDay, planItems, arrivalsOn, roundQty, orderQty, formatQty, splitKitAudience, type KitItem, type Person } from './kit';
import type { SizeMap } from './sizes';
import { peoplePresentOnDay } from './presence';

const item = (over: Partial<KitItem> = {}): KitItem => ({
  id: 'i1', name: 'Nitrile gloves', category: 'ppe',
  issuePolicy: 'single_use', intervalDays: 1, qtyPerPerson: 1, unit: 'pair',
  sizeScheme: null, stockOnHand: 0, reorderLevel: 0, leadTimeDays: 2,
  ...over,
});

const person = (over: Partial<Person> = {}): Person => ({
  arriveDate: '2026-03-02', arriveMeal: 'breakfast',
  departDate: '2026-03-06', departMeal: 'supper',
  sizes: {} as SizeMap, ...over,
});

const crew = [person(), person(), person({ arriveDate: '2026-03-04' })];

describe('arrivalsOn', () => {
  it('finds people present today but not yesterday', () => {
    expect(arrivalsOn(crew, '2026-03-02')).toHaveLength(2);
    expect(arrivalsOn(crew, '2026-03-04')).toHaveLength(1);
    expect(arrivalsOn(crew, '2026-03-05')).toHaveLength(0);
  });
});

describe('single_use — consumed daily by everyone on site', () => {
  it('scales with the day headcount', () => {
    expect(needForDay([item()], crew, '2026-03-02', '2026-03-02')[0]?.qty).toBe(2);
    expect(needForDay([item()], crew, '2026-03-04', '2026-03-02')[0]?.qty).toBe(3);
  });
  it('multiplies by qty per person', () => {
    expect(needForDay([item({ qtyPerPerson: 2 })], crew, '2026-03-04', '2026-03-02')[0]?.qty).toBe(6);
  });
  it('explains the number', () => {
    expect(needForDay([item()], crew, '2026-03-04', '2026-03-02')[0]?.basis).toMatch(/3 on site/);
  });
});

describe('per_deployment — issued once, to arrivals only', () => {
  const boots = item({ id: 'b', name: 'Boots', issuePolicy: 'per_deployment' });

  it('charges the day people arrive, not every day', () => {
    expect(needForDay([boots], crew, '2026-03-02', '2026-03-02')[0]?.qty).toBe(2);
    expect(needForDay([boots], crew, '2026-03-03', '2026-03-02')[0]?.qty).toBe(0);
    expect(needForDay([boots], crew, '2026-03-04', '2026-03-02')[0]?.qty).toBe(1);
  });

  it('THE failure this prevents: does not order a pair per person per day', () => {
    const plan = planItems([boots], crew, '2026-03-02', '2026-03-06', '2026-03-02')[0];
    expect(plan?.totalQty).toBe(3);          // three people, one pair each
    const asIfDaily = 5 * 3;                  // what a naive daily count would order
    expect(plan?.totalQty).toBeLessThan(asIfDaily);
  });

  it('says so plainly when nobody is arriving', () => {
    expect(needForDay([boots], crew, '2026-03-03', '2026-03-02')[0]?.basis).toMatch(/nobody new/i);
  });
});

describe('periodic — charged on the days it falls due', () => {
  const cartridge = item({ id: 'c', name: 'Cartridges', issuePolicy: 'periodic', intervalDays: 3 });

  it('charges on the due days only', () => {
    expect(needForDay([cartridge], crew, '2026-03-02', '2026-03-02')[0]?.qty).toBe(2); // day 0
    expect(needForDay([cartridge], crew, '2026-03-03', '2026-03-02')[0]?.qty).toBe(0);
    expect(needForDay([cartridge], crew, '2026-03-05', '2026-03-02')[0]?.qty).toBe(3); // day 3
  });

  it('counts down to the next due day', () => {
    expect(needForDay([cartridge], crew, '2026-03-03', '2026-03-02')[0]?.basis).toMatch(/next in 2 day/);
  });

  it('treats a zero or negative interval as daily rather than dividing by zero', () => {
    const broken = item({ issuePolicy: 'periodic', intervalDays: 0 });
    expect(needForDay([broken], crew, '2026-03-03', '2026-03-02')[0]?.qty).toBe(2);
  });
});

describe('planItems — stock, shortfall and the order deadline', () => {
  it('subtracts stock in hand', () => {
    const plan = planItems([item({ stockOnHand: 100 })], crew, '2026-03-02', '2026-03-06', '2026-03-02')[0];
    expect(plan?.totalQty).toBe(13);
    expect(plan?.shortfall).toBe(0);
    expect(plan?.runsOutOn).toBeNull();
  });

  it('reports the day stock runs out', () => {
    const plan = planItems([item({ stockOnHand: 5 })], crew, '2026-03-02', '2026-03-06', '2026-03-02')[0];
    expect(plan?.shortfall).toBe(8);
    expect(plan?.runsOutOn).toBe('2026-03-04');
  });

  it('backs the order date off by the lead time — the whole point', () => {
    const plan = planItems([item({ stockOnHand: 5, leadTimeDays: 2 })], crew, '2026-03-02', '2026-03-06', '2026-03-02')[0];
    expect(plan?.runsOutOn).toBe('2026-03-04');
    expect(plan?.orderBy).toBe('2026-03-02');   // two days earlier
  });

  it('flags urgent once the order date has passed', () => {
    const late = planItems([item({ stockOnHand: 5, leadTimeDays: 2 })], crew, '2026-03-02', '2026-03-06', '2026-03-03')[0];
    expect(late?.urgent).toBe(true);
    const early = planItems([item({ stockOnHand: 5, leadTimeDays: 2 })], crew, '2026-03-02', '2026-03-06', '2026-03-01')[0];
    expect(early?.urgent).toBe(false);
  });

  it('never reports a negative shortfall', () => {
    const plan = planItems([item({ stockOnHand: 9999 })], crew, '2026-03-02', '2026-03-06', '2026-03-02')[0];
    expect(plan?.shortfall).toBe(0);
  });
});

describe('size breakdown', () => {
  it('splits demand by size when the item is sized', () => {
    const sized = [
      person({ sizes: { glove: 'M' } }),
      person({ sizes: { glove: 'M' } }),
      person({ sizes: { glove: 'L' } }),
    ];
    const need = needForDay([item({ sizeScheme: 'glove' })], sized, '2026-03-02', '2026-03-02')[0];
    const glove = need?.sizes[0];
    expect(glove?.counts.find((c) => c.size === 'M')?.count).toBe(2);
    expect(glove?.counts.find((c) => c.size === 'L')?.count).toBe(1);
  });

  it('carries unknown sizes through rather than guessing', () => {
    const need = needForDay([item({ sizeScheme: 'glove' })], [person()], '2026-03-02', '2026-03-02')[0];
    expect(need?.sizes[0]?.unknown).toBe(1);
  });

  it('returns no breakdown for an unsized item', () => {
    expect(needForDay([item()], crew, '2026-03-02', '2026-03-02')[0]?.sizes).toEqual([]);
  });
});


describe('quantities are never floating-point dust', () => {
  // The real symptom: hand sanitiser at 0.05 L across a crew reported a
  // shortfall of 14.049999999999999 L.
  const many = Array.from({ length: 47 }, () => person());

  it('a fractional rate across a large crew stays clean', () => {
    const gel = item({ name: 'Hand sanitiser', qtyPerPerson: 0.05, unit: 'L' });
    const need = needForDay([gel], many, '2026-03-02', '2026-03-02')[0];
    expect(need?.qty).toBe(2.35);
    expect(String(need?.qty)).not.toMatch(/\d{6}/);
  });

  it('accumulating across a whole operation stays clean', () => {
    const gel = item({ name: 'Hand sanitiser', qtyPerPerson: 0.05, unit: 'L' });
    const plan = planItems([gel], many, '2026-03-02', '2026-03-06', '2026-03-02')[0];
    expect(plan?.totalQty).toBe(11.75);
    expect(String(plan?.totalQty)).not.toMatch(/\d{6}/);
    expect(String(plan?.shortfall)).not.toMatch(/\d{6}/);
  });

  it('rounds a discrete shortfall UP — you cannot order 2.4 pairs', () => {
    const gloves = item({ qtyPerPerson: 0.35, unit: 'pair', stockOnHand: 0 });
    const plan = planItems([gloves], [person(), person(), person()], '2026-03-02', '2026-03-02', '2026-03-02')[0];
    expect(plan?.totalQty).toBe(1.05);
    expect(plan?.shortfall).toBe(2);
  });

  it('leaves measured units fractional rather than inflating them', () => {
    const fuel = item({ qtyPerPerson: 0.8, unit: 'L', stockOnHand: 0 });
    const plan = planItems([fuel], [person(), person(), person()], '2026-03-02', '2026-03-02', '2026-03-02')[0];
    expect(plan?.shortfall).toBe(2.4);
  });
});

describe('rounding helpers', () => {
  it('roundQty clears the dust', () => {
    expect(roundQty(14.049999999999999)).toBe(14.05);
    expect(roundQty(0.1 + 0.2)).toBe(0.3);
  });

  it('orderQty rounds discrete units up and leaves measures alone', () => {
    expect(orderQty(2.1, 'pair')).toBe(3);
    expect(orderQty(2.1, 'each')).toBe(3);
    expect(orderQty(2.1, 'L')).toBe(2.1);
    expect(orderQty(3, 'each')).toBe(3);
  });

  it('formatQty drops trailing zeros and never shows a long tail', () => {
    expect(formatQty(14.049999999999999)).toBe('14.05');
    expect(formatQty(12)).toBe('12');
    expect(formatQty(2.5)).toBe('2.5');
    expect(formatQty(2.0)).toBe('2');
  });
});


describe('kit exemption — some roles draw no PPE but everyone eats', () => {
  const roled = (icsRole: string, over: Partial<Person> = {}) => ({ ...person(over), icsRole });
  const crew = [
    roled('Core Ops'), roled('Core Ops'), roled('Core Ops'),
    roled('IC'), roled('PIO'),
  ];

  it('splits the crew without losing anyone', () => {
    const { drawsKit, exempt } = splitKitAudience(crew, ['IC', 'PIO']);
    expect(drawsKit).toHaveLength(3);
    expect(exempt).toHaveLength(2);
    expect(drawsKit.length + exempt.length).toBe(crew.length);
  });

  it('kit demand drops to those who draw kit', () => {
    const gloves = item({ unit: 'pair' });
    const all = needForDay([gloves], crew, '2026-03-02', '2026-03-02')[0];
    const { drawsKit } = splitKitAudience(crew, ['IC', 'PIO']);
    const some = needForDay([gloves], drawsKit, '2026-03-02', '2026-03-02')[0];
    expect(all?.qty).toBe(5);
    expect(some?.qty).toBe(3);
  });

  it('THE guarantee: the food headcount is unchanged by any exemption', () => {
    const beforeFood = peoplePresentOnDay(crew, '2026-03-02');
    const { drawsKit, exempt } = splitKitAudience(crew, ['IC', 'PIO', 'Core Ops']);
    // Even with every role exempt from kit, everyone is still on site to be fed.
    expect(drawsKit).toHaveLength(0);
    expect(peoplePresentOnDay(crew, '2026-03-02')).toBe(beforeFood);
    expect(peoplePresentOnDay([...drawsKit, ...exempt], '2026-03-02')).toBe(beforeFood);
  });

  it('an empty exemption list changes nothing', () => {
    const { drawsKit, exempt } = splitKitAudience(crew, []);
    expect(drawsKit).toHaveLength(crew.length);
    expect(exempt).toHaveLength(0);
  });

  it('matches roles case- and whitespace-insensitively', () => {
    expect(splitKitAudience(crew, ['  core ops  ']).exempt).toHaveLength(3);
  });

  it('an unknown exempt role excludes nobody', () => {
    expect(splitKitAudience(crew, ['Nonexistent']).drawsKit).toHaveLength(crew.length);
  });
});
