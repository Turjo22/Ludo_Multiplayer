import type { Server, Socket } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  CreateSessionSuccessPayload,
  JoinSessionSuccessPayload,
  ReconnectSessionSuccessPayload,
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

    // Handle disconnect
    socket.on('disconnect', async () => {
      await presenceTracker.handleDisconnect(socketId);
    });
  });
}
