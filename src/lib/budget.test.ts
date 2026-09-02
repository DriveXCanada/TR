import { describe, it, expect } from 'vitest';
import { dailyBudget, budgetSummary } from './budget';
import type { Stay } from './presence';

const stay = (p: Partial<Stay> = {}): Stay => ({
  arriveDate: '2026-03-02', arriveMeal: 'breakfast',
  departDate: '2026-03-05', departMeal: 'supper', ...p,
});

describe('budget is a rate, not a pot', () => {
  const crew: Stay[] = [
    stay(),
    stay(),
    stay({ arriveDate: '2026-03-04', arriveMeal: 'breakfast' }),
  ];

  it('a day costs rate x people on site that day', () => {
    expect(dailyBudget(crew, '2026-03-02', 25)).toBe(50);
    expect(dailyBudget(crew, '2026-03-04', 25)).toBe(75);
  });

  it('flexes down when the roster shrinks', () => {
    const leaving: Stay[] = [stay({ departDate: '2026-03-03', departMeal: 'supper' }), stay()];
    expect(dailyBudget(leaving, '2026-03-03', 25)).toBe(50);
    expect(dailyBudget(leaving, '2026-03-04', 25)).toBe(25);
  });

  it('counts someone who leaves after lunch for that whole day', () => {
    const halfDay: Stay[] = [stay({ departDate: '2026-03-05', departMeal: 'lunch' })];
    expect(dailyBudget(halfDay, '2026-03-05', 25)).toBe(25);
    expect(dailyBudget(halfDay, '2026-03-06', 25)).toBe(0);
  });

  it('totals across the operation as the sum of person-days', () => {
    const summary = budgetSummary(crew, '2026-03-02', '2026-03-05', 25);
    expect(summary.days).toHaveLength(4);
    expect(summary.totalPeopleDays).toBe(2 + 2 + 3 + 3);
    expect(summary.totalBudget).toBe(250);
  });

  it('an empty roster budgets nothing', () => {
    expect(budgetSummary([], '2026-03-02', '2026-03-05', 25).totalBudget).toBe(0);
  });

  it('keeps currency and rate on the summary for display', () => {
    const s = budgetSummary(crew, '2026-03-02', '2026-03-02', 25, 'CAD');
    expect(s.currency).toBe('CAD');
    expect(s.rate).toBe(25);
  });
});
