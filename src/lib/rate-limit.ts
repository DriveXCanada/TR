/**
 * In-memory rate limiter for the public kiosk endpoint.
 *
 * Deliberately simple: a single field deployment runs one instance, and the
 * threat here is a bored volunteer spamming the form, not a botnet. If this ever
 * runs multi-instance the limit becomes per-instance — noted rather than
 * over-engineered, because a distributed limiter needs infrastructure a field
 * kitchen will not have.
 */
interface Bucket { count: number; resetAt: number; }

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  readonly allowed: boolean;
  readonly retryAfterSeconds: number;
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (existing === undefined || now >= existing.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  if (existing.count > limit) {
    return { allowed: false, retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000) };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

/** Keeps the map from growing without bound on a long-running server. */
export function pruneRateLimits(): void {
  const now = Date.now();
  for (const [key, bucket] of buckets) if (now >= bucket.resetAt) buckets.delete(key);
}
