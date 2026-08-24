/**
 * Small in-memory sliding-window rate limiter. Keyed per caller (IP + client),
 * good for a single node; move to Redis alongside the session store when
 * scaling out.
 */
export class RateLimiter {
  private hits = new Map<string, number[]>();

  constructor(
    private maxRequests: number,
    private windowMs: number,
    private now: () => number = Date.now,
  ) {}

  /** Returns true when the request is allowed. */
  allow(key: string): boolean {
    const cutoff = this.now() - this.windowMs;
    const timestamps = (this.hits.get(key) ?? []).filter((t) => t > cutoff);
    if (timestamps.length >= this.maxRequests) {
      this.hits.set(key, timestamps);
      return false;
    }
    timestamps.push(this.now());
    this.hits.set(key, timestamps);
    // Opportunistic cleanup so idle keys don't accumulate forever
    if (this.hits.size > 10_000) {
      for (const [k, ts] of this.hits) {
        if (ts.every((t) => t <= cutoff)) this.hits.delete(k);
      }
    }
    return true;
  }
}
