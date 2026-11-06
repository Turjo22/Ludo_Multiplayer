import type { GameState, PrivatePlayerCredentials } from '@ludo/shared-types';
import type { IStorageAdapter } from './storage-adapter.interface.js';

interface ExpiringEntry<T> {
  data: T;
  expiresAt: number | null;
  timeoutId?: NodeJS.Timeout;
}

export class InMemoryStorageAdapter implements IStorageAdapter {
  private sessions = new Map<string, ExpiringEntry<GameState>>();
  private credentials = new Map<string, PrivatePlayerCredentials>(); // key: `${sessionId}:${playerId}`
  private recoveryCodeMap = new Map<string, string>(); // key: `${sessionId}:${recoveryCode}` -> playerId

  async saveSession(session: GameState, ttlSeconds?: number): Promise<void> {
    const existing = this.sessions.get(session.sessionId);
    if (existing?.timeoutId) {
      clearTimeout(existing.timeoutId);
    }

    let expiresAt: number | null = null;
    let timeoutId: NodeJS.Timeout | undefined;

    if (ttlSeconds && ttlSeconds > 0) {
      expiresAt = Date.now() + ttlSeconds * 1000;
      timeoutId = setTimeout(() => {
        this.deleteSession(session.sessionId).catch(() => {});
      }, ttlSeconds * 1000);
      timeoutId.unref?.();
    }

    // Clone session to prevent mutation side-effects
    this.sessions.set(session.sessionId, {
      data: JSON.parse(JSON.stringify(session)),
      expiresAt,
      timeoutId,
    });
  }

  async getSession(sessionId: string): Promise<GameState | null> {
    const entry = this.sessions.get(sessionId.toUpperCase());
    if (!entry) return null;

    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      await this.deleteSession(sessionId);
      return null;
    }

    return JSON.parse(JSON.stringify(entry.data));
  }

  async deleteSession(sessionId: string): Promise<void> {
    const key = sessionId.toUpperCase();
    const entry = this.sessions.get(key);
    if (entry?.timeoutId) {
      clearTimeout(entry.timeoutId);
    }
    this.sessions.delete(key);

    // Also remove any credentials associated with this session
    const prefix = `${key}:`;
    for (const credKey of Array.from(this.credentials.keys())) {
      if (credKey.startsWith(prefix)) {
        this.credentials.delete(credKey);
      }
    }
    for (const recKey of Array.from(this.recoveryCodeMap.keys())) {
      if (recKey.startsWith(prefix)) {
        this.recoveryCodeMap.delete(recKey);
      }
    }
  }

  async listActiveSessions(): Promise<GameState[]> {
    const results: GameState[] = [];
    const now = Date.now();
    for (const [id, entry] of this.sessions.entries()) {
      if (entry.expiresAt && now > entry.expiresAt) {
        continue;
      }
      results.push(JSON.parse(JSON.stringify(entry.data)));
    }
    return results;
  }

  async saveCredentials(
    sessionId: string,
    playerId: string,
    creds: PrivatePlayerCredentials
  ): Promise<void> {
    const upperId = sessionId.toUpperCase();
    this.credentials.set(`${upperId}:${playerId}`, { ...creds });
    this.recoveryCodeMap.set(`${upperId}:${creds.recoveryCode.toUpperCase()}`, playerId);
  }

  async getCredentials(
    sessionId: string,
    playerId: string
  ): Promise<PrivatePlayerCredentials | null> {
    const upperId = sessionId.toUpperCase();
    const creds = this.credentials.get(`${upperId}:${playerId}`);
    return creds ? { ...creds } : null;
  }

  async getCredentialsByRecoveryCode(
    sessionId: string,
    recoveryCode: string
  ): Promise<PrivatePlayerCredentials | null> {
    const upperId = sessionId.toUpperCase();
    const playerId = this.recoveryCodeMap.get(`${upperId}:${recoveryCode.toUpperCase()}`);
    if (!playerId) return null;
    return this.getCredentials(sessionId, playerId);
  }

  async deleteCredentials(sessionId: string, playerId: string): Promise<void> {
    const upperId = sessionId.toUpperCase();
    const creds = this.credentials.get(`${upperId}:${playerId}`);
    if (creds) {
      this.recoveryCodeMap.delete(`${upperId}:${creds.recoveryCode.toUpperCase()}`);
      this.credentials.delete(`${upperId}:${playerId}`);
    }
  }

  async close(): Promise<void> {
    for (const entry of this.sessions.values()) {
      if (entry.timeoutId) {
        clearTimeout(entry.timeoutId);
      }
    }
    this.sessions.clear();
    this.credentials.clear();
    this.recoveryCodeMap.clear();
  }
}
