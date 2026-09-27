import { getRedisClient } from '@/lib/redis/client';

export class CacheService {
  // Default TTL for cached lists: 300 seconds (5 minutes)
  static readonly DEFAULT_TTL = 300;

  // Key structure constants
  static clientsListKey(scope: string = 'all'): string {
    return `crm:clients:list:${scope}`;
  }

  static projectsByClientKey(clientId: string): string {
    return `crm:projects:client:${clientId}`;
  }

  static allProjectsKey(scope: string = 'all'): string {
    return `crm:projects:list:${scope}`;
  }

  /**
   * Safe GET from Redis.
   * Returns null on any cache MISS, Redis error, timeout, or invalid JSON.
   * Caller always falls back to MongoDB.
   */
  static async get<T>(key: string): Promise<T | null> {
    try {
      const redis = getRedisClient();
      if (!redis) return null;

      const raw = await redis.get(key);
      if (!raw) return null;

      return JSON.parse(raw) as T;
    } catch {
      // Fail silently to MongoDB
      return null;
    }
  }

  /**
   * Safe SET in Redis with TTL.
   * Returns true on success, false on error.
   */
  static async set(
    key: string,
    value: any,
    ttlSeconds: number = CacheService.DEFAULT_TTL
  ): Promise<boolean> {
    try {
      const redis = getRedisClient();
      if (!redis) return false;

      const serialized = JSON.stringify(value);
      await redis.setex(key, ttlSeconds, serialized);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Safe DEL for single or multiple keys.
   */
  static async del(key: string | string[]): Promise<boolean> {
    try {
      const redis = getRedisClient();
      if (!redis) return false;

      if (Array.isArray(key)) {
        if (key.length > 0) {
          await redis.del(...key);
        }
      } else {
        await redis.del(key);
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Invalidate client list cache
   */
  static async invalidateClientsCache(): Promise<void> {
    try {
      const redis = getRedisClient();
      if (!redis) return;

      const stream = redis.scanStream({ match: 'crm:clients:*', count: 100 });
      const keysToDelete: string[] = [];
      stream.on('data', (keys: string[]) => {
        if (keys.length) keysToDelete.push(...keys);
      });
      await new Promise<void>((resolve) => {
        stream.on('end', async () => {
          if (keysToDelete.length > 0) {
            await redis.del(...keysToDelete).catch(() => {});
          }
          resolve();
        });
        stream.on('error', () => resolve());
      });
    } catch {
      // Ignore
    }
  }

  /**
   * Invalidate project cache keys:
   * - Invalidate general projects list
   * - Invalidate projects for specific clientId
   * - Invalidate projects for oldClientId if project was reassigned
   */
  static async invalidateProjectsCache(clientId?: string, oldClientId?: string): Promise<void> {
    try {
      const redis = getRedisClient();
      if (!redis) return;

      const keysToDelete: string[] = ['crm:projects:list:all'];

      if (clientId) {
        keysToDelete.push(this.projectsByClientKey(clientId.toString()));
      }

      if (oldClientId && oldClientId.toString() !== clientId?.toString()) {
        keysToDelete.push(this.projectsByClientKey(oldClientId.toString()));
      }

      await redis.del(...keysToDelete);
    } catch {
      // Ignore
    }
  }
}
