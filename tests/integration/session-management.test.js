"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const in_memory_storage_js_1 = require("../../apps/server/src/storage/in-memory-storage.js");
const session_manager_js_1 = require("../../apps/server/src/sessions/session-manager.js");
(0, vitest_1.describe)('Integration: Session Management & Guest Identity', () => {
    let storage;
    let sessionManager;
    (0, vitest_1.beforeEach)(() => {
        storage = new in_memory_storage_js_1.InMemoryStorageAdapter();
        sessionManager = new session_manager_js_1.SessionManager(storage);
    });
    (0, vitest_1.it)('creates 2-player session with unique ID and assigns creator to RED host', async () => {
        const result = await sessionManager.createSession('2P', 'Alice');
        (0, vitest_1.expect)(result.sessionId).toBeDefined();
        (0, vitest_1.expect)(result.sessionId.length).toBe(6);
        (0, vitest_1.expect)(result.player.name).toBe('Alice');
        (0, vitest_1.expect)(result.player.color).toBe('RED');
        (0, vitest_1.expect)(result.player.isHost).toBe(true);
        (0, vitest_1.expect)(result.player.tokens.length).toBe(4);
        (0, vitest_1.expect)(result.gameState.status).toBe('WAITING');
        (0, vitest_1.expect)(result.gameState.mode).toBe('2P');
        (0, vitest_1.expect)(result.credentials.reconnectToken).toBeDefined();
        (0, vitest_1.expect)(result.credentials.recoveryCode).toMatch(/^RC-\d{4}-\d{4}$/);
        // Verify stored session
        const stored = await storage.getSession(result.sessionId);
        (0, vitest_1.expect)(stored).not.toBeNull();
        (0, vitest_1.expect)(stored?.players.RED?.name).toBe('Alice');
        (0, vitest_1.expect)(stored?.players.YELLOW).toBeNull();
    });
    (0, vitest_1.it)('allows second player to join 2P session and transitions to ACTIVE', async () => {
        const createRes = await sessionManager.createSession('2P', 'Alice');
        const joinRes = await sessionManager.joinSession(createRes.sessionId, 'Bob');
        (0, vitest_1.expect)(joinRes.player.color).toBe('YELLOW');
        (0, vitest_1.expect)(joinRes.player.name).toBe('Bob');
        (0, vitest_1.expect)(joinRes.gameState.status).toBe('ACTIVE');
        (0, vitest_1.expect)(joinRes.gameState.players.RED?.presence).toBe('CONNECTED');
        (0, vitest_1.expect)(joinRes.gameState.players.YELLOW?.presence).toBe('CONNECTED');
        // Attempting a 3rd player in 2P mode must throw capacity error
        await (0, vitest_1.expect)(sessionManager.joinSession(createRes.sessionId, 'Charlie')).rejects.toThrow(/completely full|already started/);
    });
    (0, vitest_1.it)('handles 4-player session joining and assigned colors', async () => {
        const createRes = await sessionManager.createSession('4P', 'Player 1');
        (0, vitest_1.expect)(createRes.player.color).toBe('RED');
        const p2 = await sessionManager.joinSession(createRes.sessionId, 'Player 2');
        (0, vitest_1.expect)(p2.player.color).toBe('GREEN');
        (0, vitest_1.expect)(p2.gameState.status).toBe('WAITING');
        const p3 = await sessionManager.joinSession(createRes.sessionId, 'Player 3');
        (0, vitest_1.expect)(p3.player.color).toBe('YELLOW');
        (0, vitest_1.expect)(p3.gameState.status).toBe('WAITING');
        const p4 = await sessionManager.joinSession(createRes.sessionId, 'Player 4');
        (0, vitest_1.expect)(p4.player.color).toBe('BLUE');
        (0, vitest_1.expect)(p4.gameState.status).toBe('ACTIVE'); // Starts when 4th player joins
    });
    (0, vitest_1.it)('handles disconnection, pauses active game, and preserves player slot', async () => {
        const createRes = await sessionManager.createSession('2P', 'Alice');
        await sessionManager.joinSession(createRes.sessionId, 'Bob');
        // Alice disconnects
        const { session, disconnectedPlayer } = await sessionManager.handlePlayerDisconnect(createRes.sessionId, createRes.player.id);
        (0, vitest_1.expect)(disconnectedPlayer?.color).toBe('RED');
        (0, vitest_1.expect)(session?.status).toBe('PAUSED');
        (0, vitest_1.expect)(session?.players.RED?.presence).toBe('DISCONNECTED');
        (0, vitest_1.expect)(session?.players.YELLOW?.presence).toBe('CONNECTED');
        // Session is alive because Bob is still connected
        (0, vitest_1.expect)(session?.disconnectGraceExpiresAt).toBeNull();
    });
    (0, vitest_1.it)('starts 15-minute expiration countdown when ALL players disconnect', async () => {
        const createRes = await sessionManager.createSession('2P', 'Alice');
        const joinRes = await sessionManager.joinSession(createRes.sessionId, 'Bob');
        // Both disconnect
        await sessionManager.handlePlayerDisconnect(createRes.sessionId, createRes.player.id);
        const { session } = await sessionManager.handlePlayerDisconnect(createRes.sessionId, joinRes.player.id);
        (0, vitest_1.expect)(session?.status).toBe('PAUSED');
        (0, vitest_1.expect)(session?.disconnectGraceExpiresAt).toBeGreaterThan(Date.now());
    });
    (0, vitest_1.it)('authenticates reconnect using private reconnect token and resumes game', async () => {
        const createRes = await sessionManager.createSession('2P', 'Alice');
        const joinRes = await sessionManager.joinSession(createRes.sessionId, 'Bob');
        // Alice disconnects
        await sessionManager.handlePlayerDisconnect(createRes.sessionId, createRes.player.id);
        // Alice reconnects with token
        const reconnRes = await sessionManager.reconnectPlayer(createRes.sessionId, createRes.player.id, createRes.credentials.reconnectToken);
        (0, vitest_1.expect)(reconnRes.player.presence).toBe('CONNECTED');
        (0, vitest_1.expect)(reconnRes.gameState.status).toBe('ACTIVE'); // Resumed because both are now connected
        (0, vitest_1.expect)(reconnRes.gameState.players.RED?.presence).toBe('CONNECTED');
    });
    (0, vitest_1.it)('restores player identity on another device using recovery code', async () => {
        const createRes = await sessionManager.createSession('2P', 'Alice');
        await sessionManager.joinSession(createRes.sessionId, 'Bob');
        // Alice disconnects and opens another browser with recovery code
        await sessionManager.handlePlayerDisconnect(createRes.sessionId, createRes.player.id);
        const recoverRes = await sessionManager.recoverPlayer(createRes.sessionId, createRes.credentials.recoveryCode, 'Alice (Mobile)');
        (0, vitest_1.expect)(recoverRes.player.name).toBe('Alice (Mobile)');
        (0, vitest_1.expect)(recoverRes.player.color).toBe('RED');
        (0, vitest_1.expect)(recoverRes.player.presence).toBe('CONNECTED');
    });
    (0, vitest_1.it)('rejects reconnect attempt with invalid token or session', async () => {
        const createRes = await sessionManager.createSession('2P', 'Alice');
        await (0, vitest_1.expect)(sessionManager.reconnectPlayer(createRes.sessionId, createRes.player.id, 'bogus-token-1234567890')).rejects.toThrow(/Authentication failed/);
        await (0, vitest_1.expect)(sessionManager.reconnectPlayer('NONEXS', createRes.player.id, createRes.credentials.reconnectToken)).rejects.toThrow(/not found/);
    });
});
//# sourceMappingURL=session-management.test.js.map