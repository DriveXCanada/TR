import { describe, it, expect, vi, afterEach } from 'vitest';
import { rateLimit, pruneRateLimits } from './rate-limit';

afterEach(() => { vi.useRealTimers(); });

describe('rateLimit', () => {
  it('allows up to the limit then blocks', () => {
    const key = `k-${Math.random()}`;
    for (let i = 0; i < 3; i += 1) expect(rateLimit(key, 3, 60_000).allowed).toBe(true);
    const blocked = rateLimit(key, 3, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('keeps separate keys independent', () => {
    const a = `a-${Math.random()}`;
    const b = `b-${Math.random()}`;
    rateLimit(a, 1, 60_000);
    expect(rateLimit(a, 1, 60_000).allowed).toBe(false);
    expect(rateLimit(b, 1, 60_000).allowed).toBe(true);
  });

  it('resets after the window', () => {
    vi.useFakeTimers();
    const key = `w-${Math.random()}`;
    expect(rateLimit(key, 1, 1_000).allowed).toBe(true);
    expect(rateLimit(key, 1, 1_000).allowed).toBe(false);
    vi.advanceTimersByTime(1_500);
    expect(rateLimit(key, 1, 1_000).allowed).toBe(true);
  });

  it('prunes expired buckets', () => {
    vi.useFakeTimers();
    const key = `p-${Math.random()}`;
    rateLimit(key, 1, 1_000);
    vi.advanceTimersByTime(2_000);
    pruneRateLimits();
    // A pruned key starts fresh rather than staying blocked.
    expect(rateLimit(key, 1, 1_000).allowed).toBe(true);
  });
});
