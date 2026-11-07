import type { Server, Socket } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  CreateSessionSuccessPayload,
  JoinSessionSuccessPayload,
  ReconnectSessionSuccessPayload,
  PlayerColor,
} from '@ludo/shared-types';
import {
  CreateSessionSchema,
  JoinSessionSchema,
  ReconnectSessionSchema,
  RecoverSessionSchema,
  RollDiceSchema,
  MoveTokenSchema,
} from '@ludo/validation';
import type { SessionManager } from '../sessions/session-manager.js';
import type { GameManager } from '../game-engine/game-manager.js';
import type { PresenceTracker } from '../reconnection/presence-tracker.js';
import { RateLimiter } from '../security/rate-limiter.js';

export function setupSocketHandlers(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  sessionManager: SessionManager,
  gameManager: GameManager,
  presenceTracker: PresenceTracker
): void {
  const rateLimiter = new RateLimiter(50, 10); // 50 actions per 10s per socket
  const voiceRooms = new Map<string, Map<string, { socketId: string; playerId: string; color: PlayerColor; isMuted: boolean }>>();

  io.on('connection', (socket: Socket<ClientToServerEvents, ServerToClientEvents>) => {
    const socketId = socket.id;

    // Rate limit check helper
    const checkRateLimit = (): boolean => {
      if (!rateLimiter.isAllowed(socketId)) {
        socket.emit('error:notification', {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests. Please slow down.',
        });
        return false;
      }
      return true;
    };

    // Heartbeat ping
    socket.on('ping:heartbeat', (payload, callback) => {
      if (typeof callback === 'function') {
        callback({ clientTime: payload.clientTime, serverTime: Date.now() });
      }
    });

    // Create session
    socket.on('session:create', async (payload, callback) => {
      try {
        if (!checkRateLimit()) {
          return callback({
            success: false,
            error: { code: 'RATE_LIMIT', message: 'Rate limit exceeded' },
          });
        }

        const validated = CreateSessionSchema.parse(payload);
        const result: CreateSessionSuccessPayload = await sessionManager.createSession(
          validated.mode,
          validated.playerName
        );

        socket.join(result.sessionId);
        presenceTracker.registerConnection(socketId, result.sessionId, result.player.id);

        callback({ success: true, data: result });
      } catch (err: any) {
        callback({
          success: false,
          error: { code: 'CREATE_SESSION_FAILED', message: err.message || 'Failed to create session' },
        });
      }
    });

    // Join session
    socket.on('session:join', async (payload, callback) => {
      try {
        if (!checkRateLimit()) {
          return callback({
            success: false,
            error: { code: 'RATE_LIMIT', message: 'Rate limit exceeded' },
          });
        }

        const validated = JoinSessionSchema.parse(payload);
        const result: JoinSessionSuccessPayload = await sessionManager.joinSession(
          validated.sessionId,
          validated.playerName
        );

        socket.join(result.sessionId);
        presenceTracker.registerConnection(socketId, result.sessionId, result.player.id);

        // Broadcast to other players in the room
        socket.to(result.sessionId).emit('session:joined', result.player);
        io.to(result.sessionId).emit('session:state', result.gameState);

        if (result.gameState.status === 'ACTIVE') {
          io.to(result.sessionId).emit('game:start', result.gameState);
        }

        callback({ success: true, data: result });
      } catch (err: any) {
        callback({
          success: false,
          error: { code: 'JOIN_SESSION_FAILED', message: err.message || 'Failed to join session' },
        });
      }
    });

    // Reconnect session
    socket.on('session:reconnect', async (payload, callback) => {
      try {
        const validated = ReconnectSessionSchema.parse(payload);
        const result: ReconnectSessionSuccessPayload = await sessionManager.reconnectPlayer(
          validated.sessionId,
          validated.playerId,
          validated.reconnectToken
        );

        socket.join(result.sessionId);
        presenceTracker.registerConnection(socketId, result.sessionId, result.player.id);

        io.to(result.sessionId).emit('player:reconnected', {
          playerId: result.player.id,
          color: result.player.color,
        });

        if (result.gameState.status === 'ACTIVE') {
          io.to(result.sessionId).emit('session:resumed', result.gameState);
        }

        io.to(result.sessionId).emit('session:state', result.gameState);

        callback({ success: true, data: result });
      } catch (err: any) {
        callback({
          success: false,
          error: { code: 'RECONNECT_FAILED', message: err.message || 'Failed to reconnect' },
        });
      }
    });

    // Recover session using recovery code
    socket.on('session:recover', async (payload, callback) => {
      try {
        const validated = RecoverSessionSchema.parse(payload);
        const result = await sessionManager.recoverPlayer(
          validated.sessionId,
          validated.recoveryCode,
          validated.newPlayerName
        );

        socket.join(result.sessionId);
        presenceTracker.registerConnection(socketId, result.sessionId, result.player.id);

        io.to(result.sessionId).emit('player:reconnected', {
          playerId: result.player.id,
          color: result.player.color,
        });

        io.to(result.sessionId).emit('session:state', result.gameState);

        callback({ success: true, data: result });
      } catch (err: any) {
        callback({
          success: false,
          error: { code: 'RECOVERY_FAILED', message: err.message || 'Failed to recover identity' },
        });
      }
    });

    // Roll dice
    socket.on('dice:roll', async (payload, callback) => {
      try {
        if (!checkRateLimit()) {
          return callback({
            success: false,
            error: { code: 'RATE_LIMIT', message: 'Rate limit exceeded' },
          });
        }

        const info = presenceTracker.getPlayerForSocket(socketId);
        if (!info) {
          return callback({
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Player not authenticated' },
          });
        }

        const validated = RollDiceSchema.parse(payload);
        const { diceResult, legalMoves, gameState } = await gameManager.rollDice(
          info.sessionId,
          info.playerId,
          validated.actionId
        );

        io.to(info.sessionId).emit('dice:result', {
          ...diceResult,
          legalMoves,
        });

        io.to(info.sessionId).emit('session:state', gameState);

        callback({
          success: true,
          data: { diceValue: diceResult.value, legalMoves },
        });
      } catch (err: any) {
        callback({
          success: false,
          error: { code: 'DICE_ROLL_FAILED', message: err.message || 'Failed to roll dice' },
        });
      }
    });

    // Move token
    socket.on('token:move', async (payload, callback) => {
      try {
        if (!checkRateLimit()) {
          return callback({
            success: false,
            error: { code: 'RATE_LIMIT', message: 'Rate limit exceeded' },
          });
        }

        const info = presenceTracker.getPlayerForSocket(socketId);
        if (!info) {
          return callback({
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Player not authenticated' },
          });
        }

        const validated = MoveTokenSchema.parse(payload);
        const { moveResult, gameState } = await gameManager.moveToken(
          info.sessionId,
          info.playerId,
          validated.tokenId,
          validated.actionId
        );

        io.to(info.sessionId).emit('token:moved', {
          ...moveResult,
          state: gameState,
        });

        io.to(info.sessionId).emit('session:state', gameState);

        if (moveResult.isGameOver && moveResult.winnerColor) {
          io.to(info.sessionId).emit('game:finished', {
            winner: moveResult.winnerColor,
            rankings: gameState.rankings,
            state: gameState,
          });
        }

        callback({
          success: true,
          data: { moveResult },
        });
      } catch (err: any) {
        callback({
          success: false,
          error: { code: 'MOVE_TOKEN_FAILED', message: err.message || 'Failed to move token' },
        });
      }
    });

    // Voice chat: join voice room
    socket.on('voice:join', async () => {
      const info = presenceTracker.getPlayerForSocket(socketId);
      if (!info) return;

      const session = await sessionManager.getSession(info.sessionId);
      if (!session) return;

      const player = Object.values(session.players).find((p) => p?.id === info.playerId);
      if (!player) return;

      let roomUsers = voiceRooms.get(info.sessionId);
      if (!roomUsers) {
        roomUsers = new Map();
        voiceRooms.set(info.sessionId, roomUsers);
      }

      const userInfo = {
        socketId,
        playerId: player.id,
        color: player.color,
        isMuted: false,
      };

      // Send currently active peers to this new peer
      const existing = Array.from(roomUsers.values()).filter((u) => u.socketId !== socketId);
      socket.emit('voice:active-users', { users: existing });

      roomUsers.set(socketId, userInfo);

      // Broadcast to other voice peers that user joined
      socket.to(info.sessionId).emit('voice:user-joined', userInfo);
    });

    // Voice chat: leave voice room
    socket.on('voice:leave', () => {
      const info = presenceTracker.getPlayerForSocket(socketId);
      if (!info) return;

      const roomUsers = voiceRooms.get(info.sessionId);
      if (roomUsers) {
        roomUsers.delete(socketId);
        if (roomUsers.size === 0) voiceRooms.delete(info.sessionId);
      }

      socket.to(info.sessionId).emit('voice:user-left', { socketId });
    });

    // Voice chat: WebRTC P2P signaling relay
    socket.on('voice:signal', (payload) => {
      if (!payload.targetSocketId || !payload.signal) return;
      io.to(payload.targetSocketId).emit('voice:signal', {
        senderSocketId: socketId,
        signal: payload.signal,
      });
    });

    // Voice chat: mute status
    socket.on('voice:mute', (payload) => {
      const info = presenceTracker.getPlayerForSocket(socketId);
      if (!info) return;

      const roomUsers = voiceRooms.get(info.sessionId);
      if (roomUsers) {
        const u = roomUsers.get(socketId);
        if (u) u.isMuted = payload.isMuted;
      }

      io.to(info.sessionId).emit('voice:user-muted', {
        socketId,
        isMuted: payload.isMuted,
      });
    });

    // Emoji reactions
    socket.on('player:emoji', async (payload) => {
      const info = presenceTracker.getPlayerForSocket(socketId);
      if (!info || !payload.emoji) return;

      const session = await sessionManager.getSession(info.sessionId);
      if (!session) return;

      const player = Object.values(session.players).find((p) => p?.id === info.playerId);
      if (!player) return;

      io.to(info.sessionId).emit('player:emoji', {
        id: `emoji-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        emoji: payload.emoji.slice(0, 4),
        color: player.color,
        playerName: player.name,
        timestamp: Date.now(),
      });
    });

    // Handle disconnect
    socket.on('disconnect', async () => {
      const info = presenceTracker.getPlayerForSocket(socketId);
      if (info) {
        const roomUsers = voiceRooms.get(info.sessionId);
        if (roomUsers) {
          roomUsers.delete(socketId);
          if (roomUsers.size === 0) voiceRooms.delete(info.sessionId);
          socket.to(info.sessionId).emit('voice:user-left', { socketId });
        }
      }
      await presenceTracker.handleDisconnect(socketId);
    });
  });
}
