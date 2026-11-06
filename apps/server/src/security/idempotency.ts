/**
 * Action idempotency tracker to prevent duplicate event execution, race conditions,
 * and rapid double-clicks on dice rolls or token moves.
 */
export class IdempotencyTracker {
  private processedActions = new Map<string, { timestamp: number; result?: unknown }>();
  private readonly ttlMs: number;

  constructor(ttlSeconds = 60) {
    this.ttlMs = ttlSeconds * 1000;
  }

  /**
   * Returns true if action was already processed within TTL.
   */
  has(actionId: string): boolean {
    const entry = this.processedActions.get(actionId);
    if (!entry) return false;
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.processedActions.delete(actionId);
      return false;
    }
    return true;
  }

  /**
   * Marks an action as processed.
   */
  record(actionId: string, result?: unknown): void {
    this.processedActions.set(actionId, {
      timestamp: Date.now(),
      result,
    });
    this.cleanUp();
  }

  getSavedResult<T>(actionId: string): T | undefined {
    const entry = this.processedActions.get(actionId);
    return entry?.result as T | undefined;
  }

  private cleanUp(): void {
    if (this.processedActions.size < 500) return;
    const now = Date.now();
    for (const [id, entry] of this.processedActions.entries()) {
      if (now - entry.timestamp > this.ttlMs) {
        this.processedActions.delete(id);
      }
    }
  }
}
