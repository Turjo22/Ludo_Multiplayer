import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryStorageAdapter } from '../../apps/server/src/storage/in-memory-storage.js';
import { SessionManager } from '../../apps/server/src/sessions/session-manager.js';

describe('Integration: Session Management & Guest Identity', () => {
  let storage: InMemoryStorageAdapter;
  let sessionManager: SessionManager;

  beforeEach(() => {
    storage = new InMemoryStorageAdapter();
    sessionManager = new SessionManager(storage);
  });

  it('creates 2-player session with unique ID and assigns creator to RED host', async () => {
    const result = await sessionManager.createSession('2P', 'Alice');

    expect(result.sessionId).toBeDefined();
    expect(result.sessionId.length).toBe(6);
    expect(result.player.name).toBe('Alice');
    expect(result.player.color).toBe('RED');
    expect(result.player.isHost).toBe(true);
    expect(result.player.tokens.length).toBe(4);
    expect(result.gameState.status).toBe('WAITING');
    expect(result.gameState.mode).toBe('2P');
    expect(result.credentials.reconnectToken).toBeDefined();
    expect(result.credentials.recoveryCode).toMatch(/^RC-\d{4}-\d{4}$/);

    // Verify stored session
    const stored = await storage.getSession(result.sessionId);
    expect(stored).not.toBeNull();
    expect(stored?.players.RED?.name).toBe('Alice');
    expect(stored?.players.YELLOW).toBeNull();
  });

  it('allows second player to join 2P session and transitions to ACTIVE', async () => {
    const createRes = await sessionManager.createSession('2P', 'Alice');
    const joinRes = await sessionManager.joinSession(createRes.sessionId, 'Bob');

    expect(joinRes.player.color).toBe('YELLOW');
    expect(joinRes.player.name).toBe('Bob');
    expect(joinRes.gameState.status).toBe('ACTIVE');
    expect(joinRes.gameState.players.RED?.presence).toBe('CONNECTED');
    expect(joinRes.gameState.players.YELLOW?.presence).toBe('CONNECTED');

    // Attempting a 3rd player in 2P mode must throw capacity error
    await expect(sessionManager.joinSession(createRes.sessionId, 'Charlie')).rejects.toThrow(
      /completely full|already started/
    );
  });

  it('handles 4-player session joining and assigned colors', async () => {
    const createRes = await sessionManager.createSession('4P', 'Player 1');
    expect(createRes.player.color).toBe('RED');

    const p2 = await sessionManager.joinSession(createRes.sessionId, 'Player 2');
    expect(p2.player.color).toBe('GREEN');
    expect(p2.gameState.status).toBe('WAITING');

    const p3 = await sessionManager.joinSession(createRes.sessionId, 'Player 3');
    expect(p3.player.color).toBe('YELLOW');
    expect(p3.gameState.status).toBe('WAITING');

    const p4 = await sessionManager.joinSession(createRes.sessionId, 'Player 4');
    expect(p4.player.color).toBe('BLUE');
    expect(p4.gameState.status).toBe('ACTIVE'); // Starts when 4th player joins
  });

  it('handles disconnection, pauses active game, and preserves player slot', async () => {
    const createRes = await sessionManager.createSession('2P', 'Alice');
    await sessionManager.joinSession(createRes.sessionId, 'Bob');

    // Alice disconnects
    const { session, disconnectedPlayer } = await sessionManager.handlePlayerDisconnect(
      createRes.sessionId,
      createRes.player.id
    );

    expect(disconnectedPlayer?.color).toBe('RED');
    expect(session?.status).toBe('PAUSED');
    expect(session?.players.RED?.presence).toBe('DISCONNECTED');
    expect(session?.players.YELLOW?.presence).toBe('CONNECTED');
    // Session is alive because Bob is still connected
    expect(session?.disconnectGraceExpiresAt).toBeNull();
  });

  it('starts 15-minute expiration countdown when ALL players disconnect', async () => {
    const createRes = await sessionManager.createSession('2P', 'Alice');
    const joinRes = await sessionManager.joinSession(createRes.sessionId, 'Bob');

    // Both disconnect
    await sessionManager.handlePlayerDisconnect(createRes.sessionId, createRes.player.id);
    const { session } = await sessionManager.handlePlayerDisconnect(
      createRes.sessionId,
      joinRes.player.id
    );

    expect(session?.status).toBe('PAUSED');
    expect(session?.disconnectGraceExpiresAt).toBeGreaterThan(Date.now());
  });

  it('authenticates reconnect using private reconnect token and resumes game', async () => {
    const createRes = await sessionManager.createSession('2P', 'Alice');
    const joinRes = await sessionManager.joinSession(createRes.sessionId, 'Bob');

    // Alice disconnects
    await sessionManager.handlePlayerDisconnect(createRes.sessionId, createRes.player.id);

    // Alice reconnects with token
    const reconnRes = await sessionManager.reconnectPlayer(
      createRes.sessionId,
      createRes.player.id,
      createRes.credentials.reconnectToken
    );

    expect(reconnRes.player.presence).toBe('CONNECTED');
    expect(reconnRes.gameState.status).toBe('ACTIVE'); // Resumed because both are now connected
    expect(reconnRes.gameState.players.RED?.presence).toBe('CONNECTED');
  });

  it('restores player identity on another device using recovery code', async () => {
    const createRes = await sessionManager.createSession('2P', 'Alice');
    await sessionManager.joinSession(createRes.sessionId, 'Bob');

    // Alice disconnects and opens another browser with recovery code
    await sessionManager.handlePlayerDisconnect(createRes.sessionId, createRes.player.id);

    const recoverRes = await sessionManager.recoverPlayer(
      createRes.sessionId,
      createRes.credentials.recoveryCode,
      'Alice (Mobile)'
    );

    expect(recoverRes.player.name).toBe('Alice (Mobile)');
    expect(recoverRes.player.color).toBe('RED');
    expect(recoverRes.player.presence).toBe('CONNECTED');
  });

  it('rejects reconnect attempt with invalid token or session', async () => {
    const createRes = await sessionManager.createSession('2P', 'Alice');

    await expect(
      sessionManager.reconnectPlayer(createRes.sessionId, createRes.player.id, 'bogus-token-1234567890')
    ).rejects.toThrow(/Authentication failed/);

    await expect(
      sessionManager.reconnectPlayer('NONEXS', createRes.player.id, createRes.credentials.reconnectToken)
    ).rejects.toThrow(/not found/);
  });
});
