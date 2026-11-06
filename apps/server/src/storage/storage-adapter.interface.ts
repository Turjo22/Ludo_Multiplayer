import type { GameState, PrivatePlayerCredentials } from '@ludo/shared-types';

export interface IStorageAdapter {
  saveSession(session: GameState, ttlSeconds?: number): Promise<void>;
  getSession(sessionId: string): Promise<GameState | null>;
  deleteSession(sessionId: string): Promise<void>;
  listActiveSessions(): Promise<GameState[]>;

  saveCredentials(sessionId: string, playerId: string, creds: PrivatePlayerCredentials): Promise<void>;
  getCredentials(sessionId: string, playerId: string): Promise<PrivatePlayerCredentials | null>;
  getCredentialsByRecoveryCode(sessionId: string, recoveryCode: string): Promise<PrivatePlayerCredentials | null>;
  deleteCredentials(sessionId: string, playerId: string): Promise<void>;

  close(): Promise<void>;
}
