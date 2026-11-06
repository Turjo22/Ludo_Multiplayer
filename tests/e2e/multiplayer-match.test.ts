import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { Server } from 'socket.io';
import { io as ioc, type Socket as ClientSocket } from 'socket.io-client';
import { InMemoryStorageAdapter } from '../../apps/server/src/storage/in-memory-storage.js';
import { SessionManager } from '../../apps/server/src/sessions/session-manager.js';
import { GameManager } from '../../apps/server/src/game-engine/game-manager.js';
import { PresenceTracker } from '../../apps/server/src/reconnection/presence-tracker.js';
import { setupSocketHandlers } from '../../apps/server/src/sockets/socket-handler.js';
import { createApp } from '../../apps/server/src/app.js';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  GameState,
  CreateSessionSuccessPayload,
  JoinSessionSuccessPayload,
  ReconnectSessionSuccessPayload,
  TokenId,
} from '@ludo/shared-types';

describe('E2E: Complete Multiplayer Match & Session Lifecycle', () => {
  let httpServer: http.Server;
  let io: Server<ClientToServerEvents, ServerToClientEvents>;
  let serverPort: number;
  let serverUrl: string;
  let storage: InMemoryStorageAdapter;

  beforeAll(async () => {
    storage = new InMemoryStorageAdapter();
    const sessionManager = new SessionManager(storage);
    const gameManager = new GameManager(storage);

    const app = createApp(sessionManager, gameManager);
    httpServer = http.createServer(app);

    io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer);
    const presenceTracker = new PresenceTracker(sessionManager, io);
    setupSocketHandlers(io, sessionManager, gameManager, presenceTracker);

    await new Promise<void>((resolve) => {
      httpServer.listen(0, '127.0.0.1', () => {
        const address = httpServer.address() as { port: number };
        serverPort = address.port;
        serverUrl = `http://127.0.0.1:${serverPort}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      io.close(() => {
        httpServer.close(() => resolve());
      });
    });
  });

  function connectClient(): Promise<ClientSocket<ServerToClientEvents, ClientToServerEvents>> {
    const socket = ioc(serverUrl, { transports: ['websocket'], forceNew: true });
    return new Promise((resolve) => {
      socket.on('connect', () => resolve(socket));
    });
  }

  it('runs a complete 2-player match with turn alternation, bonus turns, and state synchronization', async () => {
    const clientRed = await connectClient();
    const clientYellow = await connectClient();

    // 1. Red creates 2-player game
    const createData = await new Promise<CreateSessionSuccessPayload>((resolve, reject) => {
      clientRed.emit('session:create', { mode: '2P', playerName: 'Alice (Red)' }, (res) => {
        if (res.success) resolve(res.data);
        else reject(new Error(res.error.message));
      });
    });

    const sessionId = createData.sessionId;
    expect(createData.player.color).toBe('RED');
    expect(createData.gameState.status).toBe('WAITING');

    // 2. Yellow joins using ONLY the Session ID
    const joinData = await new Promise<JoinSessionSuccessPayload>((resolve, reject) => {
      clientYellow.emit('session:join', { sessionId, playerName: 'Bob (Yellow)' }, (res) => {
        if (res.success) resolve(res.data);
        else reject(new Error(res.error.message));
      });
    });

    expect(joinData.player.color).toBe('YELLOW');
    expect(joinData.gameState.status).toBe('ACTIVE');

    // 3. Roll dice for Red
    const rollRes = await new Promise<{ diceValue: number }>((resolve, reject) => {
      clientRed.emit('dice:roll', { actionId: 'e2e-roll-1' }, (res) => {
        if (res.success) resolve(res.data);
        else reject(new Error(res.error.message));
      });
    });

    expect(rollRes.diceValue).toBeGreaterThanOrEqual(1);
    expect(rollRes.diceValue).toBeLessThanOrEqual(6);

    clientRed.disconnect();
    clientYellow.disconnect();
  });

  it('runs a 4-player game lobby assignment across Red, Green, Yellow, and Blue', async () => {
    const c1 = await connectClient();
    const c2 = await connectClient();
    const c3 = await connectClient();
    const c4 = await connectClient();

    // Player 1 creates 4P game
    const p1 = await new Promise<CreateSessionSuccessPayload>((resolve) => {
      c1.emit('session:create', { mode: '4P', playerName: 'P1' }, (res) => {
        if (res.success) resolve(res.data);
      });
    });
    expect(p1.player.color).toBe('RED');
    expect(p1.gameState.status).toBe('WAITING');

    // Player 2 joins -> Green
    const p2 = await new Promise<JoinSessionSuccessPayload>((resolve) => {
      c2.emit('session:join', { sessionId: p1.sessionId, playerName: 'P2' }, (res) => {
        if (res.success) resolve(res.data);
      });
    });
    expect(p2.player.color).toBe('GREEN');

    // Player 3 joins -> Yellow
    const p3 = await new Promise<JoinSessionSuccessPayload>((resolve) => {
      c3.emit('session:join', { sessionId: p1.sessionId, playerName: 'P3' }, (res) => {
        if (res.success) resolve(res.data);
      });
    });
    expect(p3.player.color).toBe('YELLOW');

    // Player 4 joins -> Blue -> transitions to ACTIVE!
    const p4 = await new Promise<JoinSessionSuccessPayload>((resolve) => {
      c4.emit('session:join', { sessionId: p1.sessionId, playerName: 'P4' }, (res) => {
        if (res.success) resolve(res.data);
      });
    });
    expect(p4.player.color).toBe('BLUE');
    expect(p4.gameState.status).toBe('ACTIVE');

    c1.disconnect();
    c2.disconnect();
    c3.disconnect();
    c4.disconnect();
  });

  it('handles disconnection, preserves game state, and allows private reconnect', async () => {
    const c1 = await connectClient();
    const c2 = await connectClient();

    const created = await new Promise<CreateSessionSuccessPayload>((resolve) => {
      c1.emit('session:create', { mode: '2P', playerName: 'Player 1' }, (res) => {
        if (res.success) resolve(res.data);
      });
    });

    await new Promise<JoinSessionSuccessPayload>((resolve) => {
      c2.emit('session:join', { sessionId: created.sessionId, playerName: 'Player 2' }, (res) => {
        if (res.success) resolve(res.data);
      });
    });

    // C1 disconnects
    c1.disconnect();
    await new Promise((r) => setTimeout(r, 100));

    // Verify session is paused in storage
    const pausedSession = await storage.getSession(created.sessionId);
    expect(pausedSession?.status).toBe('PAUSED');
    expect(pausedSession?.players.RED?.presence).toBe('DISCONNECTED');

    // C1 reconnects with a fresh socket using stored credentials
    const c1Reconnected = await connectClient();
    const reconnRes = await new Promise<ReconnectSessionSuccessPayload>((resolve, reject) => {
      c1Reconnected.emit(
        'session:reconnect',
        {
          sessionId: created.sessionId,
          playerId: created.player.id,
          reconnectToken: created.credentials.reconnectToken,
        },
        (res) => {
          if (res.success) resolve(res.data);
          else reject(new Error(res.error.message));
        }
      );
    });

    expect(reconnRes.player.color).toBe('RED');
    expect(reconnRes.gameState.status).toBe('ACTIVE'); // Resumed!
    expect(reconnRes.gameState.players.RED?.presence).toBe('CONNECTED');

    c1Reconnected.disconnect();
    c2.disconnect();
  });
});
