import { describe, it, expect } from 'vitest';
import { needForDay, planItems, arrivalsOn, type KitItem, type Person } from './kit';
import type { SizeMap } from './sizes';

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
