import { describe, it, expect } from 'vitest';
import { purgeDueOn, isPurgeDue, daysUntilPurge, retentionStatus, addDays } from './retention';

describe('purgeDueOn', () => {
  it('is the end date plus the retention period', () => {
    expect(purgeDueOn('2026-03-08', 30)).toBe('2026-04-07');
  });
  it('handles month and year rollover', () => {
    expect(purgeDueOn('2026-12-20', 30)).toBe('2027-01-19');
    expect(addDays('2026-02-27', 2)).toBe('2026-03-01');
  });
  it('treats a zero or negative period as immediate', () => {
    expect(purgeDueOn('2026-03-08', 0)).toBe('2026-03-08');
    expect(purgeDueOn('2026-03-08', -5)).toBe('2026-03-08');
  });
});

describe('isPurgeDue', () => {
  it('is false during the operation and the retention window', () => {
    expect(isPurgeDue('2026-03-08', 30, '2026-03-05')).toBe(false);
    expect(isPurgeDue('2026-03-08', 30, '2026-04-06')).toBe(false);
  });
  it('is true on the due date and after', () => {
    expect(isPurgeDue('2026-03-08', 30, '2026-04-07')).toBe(true);
    expect(isPurgeDue('2026-03-08', 30, '2027-01-01')).toBe(true);
  });
  it('shortening the retention period brings the date forward immediately', () => {
    // The promise is recomputed, never read from a stale stored value.
    expect(isPurgeDue('2026-03-08', 30, '2026-03-20')).toBe(false);
    expect(isPurgeDue('2026-03-08', 7, '2026-03-20')).toBe(true);
  });
});

describe('daysUntilPurge / retentionStatus', () => {
  it('counts down and then goes negative', () => {
    expect(daysUntilPurge('2026-03-08', 30, '2026-04-01')).toBe(6);
    expect(daysUntilPurge('2026-03-08', 30, '2026-04-10')).toBe(-3);
  });
  it('states the date in words a volunteer could be shown', () => {
    const before = retentionStatus('2026-03-08', 30, '2026-04-01');
    expect(before.due).toBe(false);
    expect(before.summary).toContain('2026-04-07');
    const after = retentionStatus('2026-03-08', 30, '2026-04-10');
    expect(after.due).toBe(true);
    expect(after.summary).toMatch(/expired 3 day/);
  });
});
