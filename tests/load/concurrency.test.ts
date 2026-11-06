import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { InMemoryStorageAdapter } from '../../apps/server/src/storage/in-memory-storage.js';
import { SessionManager } from '../../apps/server/src/sessions/session-manager.js';
import { GameManager } from '../../apps/server/src/game-engine/game-manager.js';

describe('Load Test: Concurrent Sessions & Action Throughput', () => {
  let storage: InMemoryStorageAdapter;
  let sessionManager: SessionManager;
  let gameManager: GameManager;

  beforeAll(() => {
    storage = new InMemoryStorageAdapter();
    sessionManager = new SessionManager(storage);
    gameManager = new GameManager(storage);
  });

  afterAll(async () => {
    await storage.close();
  });

  it('handles 25 concurrent independent sessions (50 players) with action processing latency < 100ms', async () => {
    const sessionCount = 25;
    const sessionIds: string[] = [];
    const player1List: Array<{ sessionId: string; playerId: string }> = [];

    // 1. Create and join 25 sessions concurrently
    const setupStart = performance.now();
    await Promise.all(
      Array.from({ length: sessionCount }).map(async (_, idx) => {
        const createRes = await sessionManager.createSession('2P', `Host_${idx}`);
        await sessionManager.joinSession(createRes.sessionId, `Guest_${idx}`);

        sessionIds.push(createRes.sessionId);
        player1List.push({
          sessionId: createRes.sessionId,
          playerId: createRes.player.id,
        });
      })
    );
    const setupDuration = performance.now() - setupStart;
    console.log(`[Load Test] 25 sessions (50 players) created & activated in ${setupDuration.toFixed(1)}ms`);

    expect(sessionIds.length).toBe(sessionCount);

    // 2. Concurrently execute dice rolls across all 25 active matches
    const rollStart = performance.now();
    const rollLatencies: number[] = [];

    await Promise.all(
      player1List.map(async (entry, i) => {
        const actionStart = performance.now();
        const rollRes = await gameManager.rollDice(
          entry.sessionId,
          entry.playerId,
          `concurrent-roll-${i}`
        );
        const actionDuration = performance.now() - actionStart;
        rollLatencies.push(actionDuration);

        expect(rollRes.diceResult.value).toBeGreaterThanOrEqual(1);
        expect(rollRes.diceResult.value).toBeLessThanOrEqual(6);
      })
    );

    const totalRollTime = performance.now() - rollStart;
    const avgLatency = rollLatencies.reduce((a, b) => a + b, 0) / rollLatencies.length;
    const maxLatency = Math.max(...rollLatencies);

    console.log(
      `[Load Test] 25 concurrent actions processed in ${totalRollTime.toFixed(1)}ms | Avg: ${avgLatency.toFixed(
        2
      )}ms | Max: ${maxLatency.toFixed(2)}ms`
    );

    // Performance target in Section 12.I: Server-side game action processing below 100 ms under normal load
    expect(avgLatency).toBeLessThan(100);
    expect(maxLatency).toBeLessThan(150);

    // 3. Verify total session isolation (every session has its own unique ID and state)
    const storedSessions = await storage.listActiveSessions();
    expect(storedSessions.length).toBe(sessionCount);
    const distinctIds = new Set(storedSessions.map((s) => s.sessionId));
    expect(distinctIds.size).toBe(sessionCount);
  });
});
