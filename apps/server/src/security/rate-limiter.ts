/**
 * Rate limiter using sliding-window counter per client key (IP or Player ID).
 */
export class RateLimiter {
  private requests = new Map<string, number[]>();
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests = 30, windowSeconds = 10) {
    this.maxRequests = maxRequests;
    this.windowMs = windowSeconds * 1000;
  }

  isAllowed(key: string): boolean {
    const now = Date.now();
    const timestamps = this.requests.get(key) || [];
    const valid = timestamps.filter((t) => now - t < this.windowMs);

    if (valid.length >= this.maxRequests) {
      return false;
    }

    valid.push(now);
    this.requests.set(key, valid);

    if (this.requests.size > 2000) {
      this.cleanup(now);
    }

    return true;
  }

  private cleanup(now: number): void {
    for (const [key, times] of this.requests.entries()) {
      const valid = times.filter((t) => now - t < this.windowMs);
      if (valid.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, valid);
      }
    }
  }
}
