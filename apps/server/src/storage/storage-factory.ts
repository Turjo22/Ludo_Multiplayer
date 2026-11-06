import type { IStorageAdapter } from './storage-adapter.interface.js';
import { InMemoryStorageAdapter } from './in-memory-storage.js';
import { RedisStorageAdapter } from './redis-storage.js';

export async function createStorageAdapter(): Promise<IStorageAdapter> {
  const redisUrl = process.env.REDIS_URL;

  if (redisUrl) {
    try {
      const adapter = new RedisStorageAdapter(redisUrl);
      await adapter.connect();
      console.log(`[Storage] Connected to Redis at ${redisUrl}`);
      return adapter;
    } catch (err) {
      console.warn('[Storage] Failed to connect to Redis. Falling back to in-memory adapter:', err);
    }
  }

  console.log('[Storage] Using InMemoryStorageAdapter (active sessions and credentials stored in-process)');
  return new InMemoryStorageAdapter();
}
