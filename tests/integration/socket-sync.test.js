"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const socket_io_client_1 = require("socket.io-client");
const in_memory_storage_js_1 = require("../../apps/server/src/storage/in-memory-storage.js");
const session_manager_js_1 = require("../../apps/server/src/sessions/session-manager.js");
const game_manager_js_1 = require("../../apps/server/src/game-engine/game-manager.js");
const presence_tracker_js_1 = require("../../apps/server/src/reconnection/presence-tracker.js");
const socket_handler_js_1 = require("../../apps/server/src/sockets/socket-handler.js");
const app_js_1 = require("../../apps/server/src/app.js");
(0, vitest_1.describe)('Integration: Real-Time Socket.IO Multiplayer Synchronization', () => {
    let httpServer;
    let io;
    let serverPort;
    let serverUrl;
    (0, vitest_1.beforeAll)(async () => {
        const storage = new in_memory_storage_js_1.InMemoryStorageAdapter();
        const sessionManager = new session_manager_js_1.SessionManager(storage);
        const gameManager = new game_manager_js_1.GameManager(storage);
        const app = (0, app_js_1.createApp)(sessionManager, gameManager);
        httpServer = http_1.default.createServer(app);
        io = new socket_io_1.Server(httpServer);
        const presenceTracker = new presence_tracker_js_1.PresenceTracker(sessionManager, io);
        (0, socket_handler_js_1.setupSocketHandlers)(io, sessionManager, gameManager, presenceTracker);
        await new Promise((resolve) => {
            httpServer.listen(0, '127.0.0.1', () => {
                const address = httpServer.address();
                serverPort = address.port;
                serverUrl = `http://127.0.0.1:${serverPort}`;
                resolve();
            });
        });
    });
    (0, vitest_1.afterAll)(async () => {
        await new Promise((resolve) => {
            io.close(() => {
                httpServer.close(() => resolve());
            });
        });
    });
    (0, vitest_1.it)('synchronizes real-time session creation, joining, dice rolls, and moves across multiple sockets', async () => {
        const clientA = (0, socket_io_client_1.io)(serverUrl, {
            transports: ['websocket'],
            forceNew: true,
        });
        const clientB = (0, socket_io_client_1.io)(serverUrl, {
            transports: ['websocket'],
            forceNew: true,
        });
        await Promise.all([
            new Promise((resolve) => clientA.on('connect', () => resolve())),
            new Promise((resolve) => clientB.on('connect', () => resolve())),
        ]);
        // Client A creates a 2P game
        const createResult = await new Promise((resolve, reject) => {
            clientA.emit('session:create', { mode: '2P', playerName: 'Player Red' }, (response) => {
                if (response.success)
                    resolve(response.data);
                else
                    reject(new Error(response.error.message));
            });
        });
        (0, vitest_1.expect)(createResult.sessionId).toBeDefined();
        (0, vitest_1.expect)(createResult.player.color).toBe('RED');
        const sessionId = createResult.sessionId;
        // Client B joins using ONLY the Session ID
        const clientAStatePromise = new Promise((resolve) => {
            clientA.on('session:state', (state) => {
                if (state.status === 'ACTIVE')
                    resolve(state);
            });
        });
        const joinResult = await new Promise((resolve, reject) => {
            clientB.emit('session:join', { sessionId, playerName: 'Player Yellow' }, (response) => {
                if (response.success)
                    resolve(response.data);
                else
                    reject(new Error(response.error.message));
            });
        });
        (0, vitest_1.expect)(joinResult.player.color).toBe('YELLOW');
        // Both players should receive active game state
        const syncedState = await clientAStatePromise;
        (0, vitest_1.expect)(syncedState.status).toBe('ACTIVE');
        (0, vitest_1.expect)(syncedState.players.RED?.presence).toBe('CONNECTED');
        (0, vitest_1.expect)(syncedState.players.YELLOW?.presence).toBe('CONNECTED');
        // Client A rolls dice
        const clientBDicePromise = new Promise((resolve) => {
            clientB.on('dice:result', (result) => {
                resolve(result.value);
            });
        });
        const rollResponse = await new Promise((resolve, reject) => {
            clientA.emit('dice:roll', { actionId: 'socket-roll-1' }, (res) => {
                if (res.success)
                    resolve(res.data);
                else
                    reject(new Error(res.error.message));
            });
        });
        const synchronizedDice = await clientBDicePromise;
        (0, vitest_1.expect)(synchronizedDice).toBe(rollResponse.diceValue);
        clientA.disconnect();
        clientB.disconnect();
    });
});
//# sourceMappingURL=socket-sync.test.js.map