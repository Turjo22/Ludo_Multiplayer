import express, { type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import type { SessionManager } from './sessions/session-manager.js';
import type { GameManager } from './game-engine/game-manager.js';
import {
  CreateSessionSchema,
  JoinSessionSchema,
  ReconnectSessionSchema,
  RecoverSessionSchema,
} from '@ludo/validation';

export function createApp(sessionManager: SessionManager, gameManager: GameManager) {
  const app = express();

  app.use(
    helmet({
      contentSecurityPolicy: false, // Allows flexible websocket & frontend development
    })
  );

  const allowedOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    process.env.FRONTEND_URL || '',
  ].filter(Boolean);

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow mobile apps, curl, or matched web origins
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(null, true); // Permissive in dev/self-hosted
        }
      },
      credentials: true,
    })
  );

  app.use(cookieParser());
  app.use(express.json());

  // Health check endpoint
  app.get('/health', async (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: Date.now(),
      memory: process.memoryUsage(),
    });
  });

  // Get public session state
  app.get('/api/sessions/:sessionId', async (req: Request, res: Response) => {
    try {
      const sessionId = req.params.sessionId.toUpperCase();
      const session = await sessionManager.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }
      res.json(session);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Create session
  app.post('/api/sessions', async (req: Request, res: Response) => {
    try {
      const parsed = CreateSessionSchema.parse(req.body);
      const result = await sessionManager.createSession(parsed.mode, parsed.playerName);

      // Set secure HTTP-only cookie for reconnection resilience
      res.cookie(`ludo_reconnect_${result.sessionId}`, result.credentials.reconnectToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.status(201).json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Join session
  app.post('/api/sessions/:sessionId/join', async (req: Request, res: Response) => {
    try {
      const sessionId = req.params.sessionId.toUpperCase();
      const parsed = JoinSessionSchema.parse({
        sessionId,
        playerName: req.body.playerName,
      });

      const result = await sessionManager.joinSession(parsed.sessionId, parsed.playerName);

      res.cookie(`ludo_reconnect_${result.sessionId}`, result.credentials.reconnectToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Reconnect player
  app.post('/api/sessions/:sessionId/reconnect', async (req: Request, res: Response) => {
    try {
      const sessionId = req.params.sessionId.toUpperCase();
      const cookieToken = req.cookies[`ludo_reconnect_${sessionId}`];
      const reconnectToken = req.body.reconnectToken || cookieToken;

      const parsed = ReconnectSessionSchema.parse({
        sessionId,
        playerId: req.body.playerId,
        reconnectToken,
      });

      const result = await sessionManager.reconnectPlayer(
        parsed.sessionId,
        parsed.playerId,
        parsed.reconnectToken
      );

      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Recover identity using recovery code
  app.post('/api/sessions/:sessionId/recover', async (req: Request, res: Response) => {
    try {
      const sessionId = req.params.sessionId.toUpperCase();
      const parsed = RecoverSessionSchema.parse({
        sessionId,
        recoveryCode: req.body.recoveryCode,
        newPlayerName: req.body.newPlayerName,
      });

      const result = await sessionManager.recoverPlayer(
        parsed.sessionId,
        parsed.recoveryCode,
        parsed.newPlayerName
      );

      res.cookie(`ludo_reconnect_${result.sessionId}`, result.credentials.reconnectToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  return app;
}
