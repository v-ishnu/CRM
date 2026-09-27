import Redis from 'ioredis';

declare global {
  // eslint-disable-next-line no-var
  var __redisClientInstance: Redis | null | undefined;
}

/**
 * Checks whether Redis connection string is present in environment variables.
 */
export function isRedisConfigured(): boolean {
  return !!(process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL);
}

/**
 * Returns a singleton ioredis client or null if not configured / failed.
 * Configured with short timeouts and offline queue disabled to guarantee
 * that Redis downtime NEVER delays or breaks CRM operations.
 */
export function getRedisClient(): Redis | null {
  if (!isRedisConfigured()) {
    return null;
  }

  if (global.__redisClientInstance) {
    return global.__redisClientInstance;
  }

  try {
    const redisUrl = process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL!;
    const client = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      commandTimeout: 2000,
      enableOfflineQueue: false,
      retryStrategy(times) {
        // Stop retrying aggressively if Redis is down
        if (times > 3) {
          return null;
        }
        return Math.min(times * 200, 1000);
      },
    });

    client.on('error', (err) => {
      if (process.env.NODE_ENV !== 'test') {
        console.warn('[REDIS_WARNING] Redis connection issue (fallback to MongoDB active):', err.message);
      }
    });

    global.__redisClientInstance = client;
    return client;
  } catch (error: any) {
    console.warn('[REDIS_INIT_ERROR] Could not initialize Redis client, using MongoDB:', error.message);
    return null;
  }
}

/**
 * Safely reset/disconnect Redis for tests.
 */
export async function closeRedisConnection(): Promise<void> {
  if (global.__redisClientInstance) {
    try {
      await global.__redisClientInstance.quit();
    } catch {
      // Ignore cleanup error
    }
    global.__redisClientInstance = null;
  }
}
