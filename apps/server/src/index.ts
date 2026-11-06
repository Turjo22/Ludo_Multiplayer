import http from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import { createStorageAdapter } from './storage/storage-factory.js';
import { SessionManager } from './sessions/session-manager.js';
import { GameManager } from './game-engine/game-manager.js';
import { PresenceTracker } from './reconnection/presence-tracker.js';
import { setupSocketHandlers } from './sockets/socket-handler.js';
import { createApp } from './app.js';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from '@ludo/shared-types';

dotenv.config();

const PORT = parseInt(process.env.PORT || '4000', 10);
const HOST = process.env.HOST || '0.0.0.0';

async function bootstrap() {
  const storage = await createStorageAdapter();
  const sessionManager = new SessionManager(storage);
  const gameManager = new GameManager(storage);

  const app = createApp(sessionManager, gameManager);
  const httpServer = http.createServer(app);

  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingInterval: 10000,
    pingTimeout: 5000,
    transports: ['websocket', 'polling'],
  });

  const presenceTracker = new PresenceTracker(sessionManager, io);
  setupSocketHandlers(io, sessionManager, gameManager, presenceTracker);

  httpServer.listen(PORT, HOST, () => {
    console.log(`🚀 [Ludo Server] Real-time multiplayer engine running on http://${HOST}:${PORT}`);
    console.log(`📡 [Ludo Server] Socket.IO ready for cross-device connections`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n🛑 [Ludo Server] Received ${signal}. Shutting down gracefully...`);
    presenceTracker.destroy();
    io.close(() => {
      httpServer.close(async () => {
        await storage.close();
        console.log('✅ [Ludo Server] Closed cleanly.');
        process.exit(0);
      });
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  console.error('Fatal bootstrap error in Ludo Server:', err);
  process.exit(1);
});
