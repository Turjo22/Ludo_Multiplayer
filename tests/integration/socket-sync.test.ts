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
} from '@ludo/shared-types';

describe('Integration: Real-Time Socket.IO Multiplayer Synchronization', () => {
  let httpServer: http.Server;
  let io: Server<ClientToServerEvents, ServerToClientEvents>;
  let serverPort: number;
  let serverUrl: string;

  beforeAll(async () => {
    const storage = new InMemoryStorageAdapter();
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

  function waitForConnect(socket: ClientSocket<any, any>): Promise<void> {
    socket.on('connect_error', (err) => console.error('[Socket Error]:', err));
    if (socket.connected) return Promise.resolve();
    return new Promise<void>((resolve) => socket.once('connect', () => resolve()));
  }

  it('synchronizes real-time session creation, joining, dice rolls, and moves across multiple sockets', async () => {
    const clientA: ClientSocket<ServerToClientEvents, ClientToServerEvents> = ioc(serverUrl, {
      transports: ['websocket'],
      forceNew: true,
    });
    const clientB: ClientSocket<ServerToClientEvents, ClientToServerEvents> = ioc(serverUrl, {
      transports: ['websocket'],
      forceNew: true,
    });

    await Promise.all([waitForConnect(clientA), waitForConnect(clientB)]);

    // Client A creates a 2P game
    const createResult = await new Promise<CreateSessionSuccessPayload>((resolve, reject) => {
      clientA.emit(
        'session:create',
        { mode: '2P', playerName: 'Player Red' },
        (response) => {
          if (response.success) resolve(response.data);
          else reject(new Error(response.error.message));
        }
      );
    });

    expect(createResult.sessionId).toBeDefined();
    expect(createResult.player.color).toBe('RED');
    const sessionId = createResult.sessionId;

    // Client B joins using ONLY the Session ID
    const clientAStatePromise = new Promise<GameState>((resolve) => {
      clientA.on('session:state', (state) => {
        if (state.status === 'ACTIVE') resolve(state);
      });
    });

    const joinResult = await new Promise<JoinSessionSuccessPayload>((resolve, reject) => {
      clientB.emit(
        'session:join',
        { sessionId, playerName: 'Player Yellow' },
        (response) => {
          if (response.success) resolve(response.data);
          else reject(new Error(response.error.message));
        }
      );
    });

    expect(joinResult.player.color).toBe('YELLOW');

    // Both players should receive active game state
    const syncedState = await clientAStatePromise;
    expect(syncedState.status).toBe('ACTIVE');
    expect(syncedState.players.RED?.presence).toBe('CONNECTED');
    expect(syncedState.players.YELLOW?.presence).toBe('CONNECTED');

    // Client A rolls dice
    const clientBDicePromise = new Promise<number>((resolve) => {
      clientB.on('dice:result', (result) => {
        resolve(result.value);
      });
    });

    const rollResponse = await new Promise<{ diceValue: number }>((resolve, reject) => {
      clientA.emit('dice:roll', { actionId: 'socket-roll-1' }, (res) => {
        if (res.success) resolve(res.data);
        else reject(new Error(res.error.message));
      });
    });

    const synchronizedDice = await clientBDicePromise;
    expect(synchronizedDice).toBe(rollResponse.diceValue);

    clientA.disconnect();
    clientB.disconnect();
  });
});
