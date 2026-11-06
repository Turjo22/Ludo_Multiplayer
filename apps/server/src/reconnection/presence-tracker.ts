import type { Server, Socket } from 'socket.io';
import type { SessionManager } from '../sessions/session-manager.js';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from '@ludo/shared-types';

export interface ConnectedSocketInfo {
  sessionId: string;
  playerId: string;
  socketId: string;
  connectedAt: number;
  lastPingAt: number;
}

export class PresenceTracker {
  private socketToPlayer = new Map<string, { sessionId: string; playerId: string }>();
  private playerToSocket = new Map<string, string>(); // `${sessionId}:${playerId}` -> socketId
  private cleanupInterval?: NodeJS.Timeout;

  constructor(
    private sessionManager: SessionManager,
    private io: Server<ClientToServerEvents, ServerToClientEvents>
  ) {
    this.startBackgroundMonitor();
  }

  registerConnection(socketId: string, sessionId: string, playerId: string): void {
    const key = `${sessionId.toUpperCase()}:${playerId}`;
    this.socketToPlayer.set(socketId, { sessionId: sessionId.toUpperCase(), playerId });
    this.playerToSocket.set(key, socketId);
  }

  getPlayerForSocket(socketId: string): { sessionId: string; playerId: string } | undefined {
    return this.socketToPlayer.get(socketId);
  }

  async handleDisconnect(socketId: string): Promise<void> {
    const info = this.socketToPlayer.get(socketId);
    if (!info) return;

    this.socketToPlayer.delete(socketId);
    const key = `${info.sessionId}:${info.playerId}`;
    this.playerToSocket.delete(key);

    const { session, disconnectedPlayer } = await this.sessionManager.handlePlayerDisconnect(
      info.sessionId,
      info.playerId
    );

    if (session && disconnectedPlayer) {
      // Notify session room
      this.io.to(session.sessionId).emit('player:disconnected', {
        playerId: disconnectedPlayer.id,
        color: disconnectedPlayer.color,
        graceExpiresAt: session.disconnectGraceExpiresAt || null,
      });

      if (session.status === 'PAUSED') {
        this.io.to(session.sessionId).emit('session:paused', {
          reason: session.pauseReason || 'A player disconnected. Waiting for reconnection...',
          graceExpiresAt: session.disconnectGraceExpiresAt || null,
        });
      }

      this.io.to(session.sessionId).emit('session:state', session);
    }
  }

  private startBackgroundMonitor(): void {
    // Check every 30 seconds for expired disconnect grace sessions
    this.cleanupInterval = setInterval(async () => {
      // Background checks handled by Redis TTL or in-memory adapter timers
    }, 30000);
    this.cleanupInterval.unref?.();
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.socketToPlayer.clear();
    this.playerToSocket.clear();
  }
}
