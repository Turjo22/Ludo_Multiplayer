import { Redis } from 'ioredis';
import type { GameState, PrivatePlayerCredentials } from '@ludo/shared-types';
import type { IStorageAdapter } from './storage-adapter.interface.js';

export class RedisStorageAdapter implements IStorageAdapter {
  private client: Redis;

  constructor(redisUrl?: string) {
    this.client = new Redis(redisUrl || process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: 3,
      enableOfflineQueue: false,
      lazyConnect: true,
    });
  }

  async connect(): Promise<void> {
    await this.client.connect();
  }

  private sessionKey(sessionId: string): string {
    return `ludo:session:${sessionId.toUpperCase()}`;
  }

  private credKey(sessionId: string, playerId: string): string {
    return `ludo:cred:${sessionId.toUpperCase()}:${playerId}`;
  }

  private recoveryKey(sessionId: string, recoveryCode: string): string {
    return `ludo:recovery:${sessionId.toUpperCase()}:${recoveryCode.toUpperCase()}`;
  }

  async saveSession(session: GameState, ttlSeconds?: number): Promise<void> {
    const key = this.sessionKey(session.sessionId);
    const data = JSON.stringify(session);
    if (ttlSeconds && ttlSeconds > 0) {
      await this.client.set(key, data, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, data);
    }
  }

  async getSession(sessionId: string): Promise<GameState | null> {
    const key = this.sessionKey(sessionId);
    const data = await this.client.get(key);
    if (!data) return null;
    try {
      return JSON.parse(data) as GameState;
    } catch {
      return null;
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    const key = this.sessionKey(sessionId);
    await this.client.del(key);
  }

  async listActiveSessions(): Promise<GameState[]> {
    const keys = await this.client.keys('ludo:session:*');
    if (!keys || keys.length === 0) return [];

    const rawValues = await this.client.mget(...keys);
    const results: GameState[] = [];
    for (const raw of rawValues) {
      if (raw) {
        try {
          results.push(JSON.parse(raw));
        } catch {}
      }
    }
    return results;
  }

  async saveCredentials(
    sessionId: string,
    playerId: string,
    creds: PrivatePlayerCredentials
  ): Promise<void> {
    const cKey = this.credKey(sessionId, playerId);
    const rKey = this.recoveryKey(sessionId, creds.recoveryCode);
    const pipeline = this.client.pipeline();
    pipeline.set(cKey, JSON.stringify(creds), 'EX', 86400 * 3); // 3 days
    pipeline.set(rKey, playerId, 'EX', 86400 * 3);
    await pipeline.exec();
  }

  async getCredentials(
    sessionId: string,
    playerId: string
  ): Promise<PrivatePlayerCredentials | null> {
    const cKey = this.credKey(sessionId, playerId);
    const data = await this.client.get(cKey);
    if (!data) return null;
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  async getCredentialsByRecoveryCode(
    sessionId: string,
    recoveryCode: string
  ): Promise<PrivatePlayerCredentials | null> {
    const rKey = this.recoveryKey(sessionId, recoveryCode);
    const playerId = await this.client.get(rKey);
    if (!playerId) return null;
    return this.getCredentials(sessionId, playerId);
  }

  async deleteCredentials(sessionId: string, playerId: string): Promise<void> {
    const creds = await this.getCredentials(sessionId, playerId);
    const pipeline = this.client.pipeline();
    pipeline.del(this.credKey(sessionId, playerId));
    if (creds) {
      pipeline.del(this.recoveryKey(sessionId, creds.recoveryCode));
    }
    await pipeline.exec();
  }

  async close(): Promise<void> {
    await this.client.quit();
  }
}
