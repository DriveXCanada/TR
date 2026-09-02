import { describe, it, expect } from 'vitest';
import {
  isPresent,
  isPresentOnDay,
  isPresentForSlot,
  presenceWarnings,
  peoplePresentOnDay,
  crewForSlot,
  daysBetween,
  type Stay,
} from './presence';

const stay = (p: Partial<Stay> = {}): Stay => ({
  arriveDate: '2026-03-02',
  arriveMeal: 'breakfast',
  departDate: '2026-03-05',
  departMeal: 'supper',
  ...p,
});

describe('isPresent — stay window', () => {
  it('excludes days before arrival and after departure', () => {
    expect(isPresent(stay(), '2026-03-01', 'supper')).toBe(false);
    expect(isPresent(stay(), '2026-03-06', 'breakfast')).toBe(false);
  });

  it('includes the full middle of the stay', () => {
    expect(isPresent(stay(), '2026-03-03', 'breakfast')).toBe(true);
    expect(isPresent(stay(), '2026-03-04', 'supper')).toBe(true);
  });

  it('respects the arrival MEAL, not just the day', () => {
    const s = stay({ arriveDate: '2026-03-02', arriveMeal: 'supper' });
    expect(isPresent(s, '2026-03-02', 'breakfast')).toBe(false);
    expect(isPresent(s, '2026-03-02', 'lunch')).toBe(false);
    expect(isPresent(s, '2026-03-02', 'supper')).toBe(true);
  });

  it('respects the departure MEAL — the spec case: leaves after lunch, drops from supper', () => {
    const s = stay({ departDate: '2026-03-05', departMeal: 'lunch' });
    expect(isPresent(s, '2026-03-05', 'breakfast')).toBe(true);
    expect(isPresent(s, '2026-03-05', 'lunch')).toBe(true);
    expect(isPresent(s, '2026-03-05', 'supper')).toBe(false);
  });

  it('handles a single-meal stay', () => {
    const s = stay({
      arriveDate: '2026-03-03', arriveMeal: 'lunch',
      departDate: '2026-03-03', departMeal: 'lunch',
    });
    expect(isPresent(s, '2026-03-03', 'breakfast')).toBe(false);
    expect(isPresent(s, '2026-03-03', 'lunch')).toBe(true);
    expect(isPresent(s, '2026-03-03', 'supper')).toBe(false);
  });
});

describe('isPresent — ambiguity biases toward PRESENT', () => {
  it('unconfirmed departure meal keeps them through end of day', () => {
    const s = stay({ departDate: '2026-03-05', departMeal: null });
    expect(isPresent(s, '2026-03-05', 'breakfast')).toBe(true);
    expect(isPresent(s, '2026-03-05', 'supper')).toBe(true);
    expect(isPresent(s, '2026-03-06', 'breakfast')).toBe(false);
  });

  it('no departure at all keeps them present indefinitely', () => {
    const s = stay({ departDate: null, departMeal: null });
    expect(isPresent(s, '2027-01-01', 'supper')).toBe(true);
  });

  it('unknown arrival meal includes the whole arrival day', () => {
    const s = stay({ arriveDate: '2026-03-02', arriveMeal: null });
    expect(isPresent(s, '2026-03-02', 'breakfast')).toBe(true);
  });

  it('unknown arrival date does not exclude anyone', () => {
    const s = stay({ arriveDate: null, arriveMeal: null });
    expect(isPresent(s, '2026-03-01', 'breakfast')).toBe(true);
  });

  it('reports each ambiguity so the UI can warn loudly', () => {
    expect(presenceWarnings(stay())).toEqual([]);
    expect(presenceWarnings(stay({ departMeal: null }))).toEqual(['unconfirmed-departure']);
    expect(presenceWarnings(stay({ departDate: null, departMeal: null }))).toEqual(['open-ended-stay']);
    expect(presenceWarnings(stay({ arriveDate: null }))).toContain('no-arrival');
  });
});

describe('day-level and slot-level presence', () => {
  it('someone leaving after lunch is still on site that DAY', () => {
    const s = stay({ departDate: '2026-03-05', departMeal: 'lunch' });
    expect(isPresentOnDay(s, '2026-03-05')).toBe(true);
    expect(isPresent(s, '2026-03-05', 'supper')).toBe(false);
  });

  it('all-day slots (snack, drinks) use day-level presence', () => {
    const s = stay({ departDate: '2026-03-05', departMeal: 'lunch' });
    expect(isPresentForSlot(s, '2026-03-05', 'snack')).toBe(true);
    expect(isPresentForSlot(s, '2026-03-05', 'drinks')).toBe(true);
    expect(isPresentForSlot(s, '2026-03-05', 'supper')).toBe(false);
  });

  it('honours a non-standard meal schedule', () => {
    const schedule = ['breakfast', 'supper'] as const;
    const s = stay({ departDate: '2026-03-05', departMeal: 'breakfast' });
    expect(isPresent(s, '2026-03-05', 'supper', schedule)).toBe(false);
    expect(isPresent(s, '2026-03-05', 'breakfast', schedule)).toBe(true);
  });
});

describe('headcount helpers', () => {
  const crew: Stay[] = [
    stay(),
    stay({ departDate: '2026-03-05', departMeal: 'lunch' }),
    stay({ arriveDate: '2026-03-06', arriveMeal: 'breakfast', departDate: '2026-03-08', departMeal: 'supper' }),
  ];

  it('counts only people on site that day', () => {
    expect(peoplePresentOnDay(crew, '2026-03-03')).toBe(2);
    expect(peoplePresentOnDay(crew, '2026-03-07')).toBe(1);
  });

  it('headcount drops between lunch and supper on a departure day', () => {
    expect(crewForSlot(crew, '2026-03-05', 'lunch')).toHaveLength(2);
    expect(crewForSlot(crew, '2026-03-05', 'supper')).toHaveLength(1);
  });
});

describe('daysBetween', () => {
  it('is inclusive of both ends', () => {
    expect(daysBetween('2026-03-02', '2026-03-05')).toEqual([
      '2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05',
    ]);
  });
  it('handles a single day and month rollover', () => {
    expect(daysBetween('2026-03-02', '2026-03-02')).toEqual(['2026-03-02']);
    expect(daysBetween('2026-02-27', '2026-03-01')).toEqual(['2026-02-27', '2026-02-28', '2026-03-01']);
  });
});
