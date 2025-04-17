import { createClient } from 'redis';
import config from '../config';
import { logger } from '../utils/logger';

// Create Redis client
const client = createClient({
  url: config.redis.url,
});

client.on('error', (err) => logger.error('Redis Client Error', err));
client.on('connect', () => logger.info('Redis client connected'));
client.on('reconnecting', () => logger.info('Redis client reconnecting'));
client.on('ready', () => logger.info('Redis client ready'));

// Connect to Redis
(async () => {
  try {
    await client.connect();
  } catch (err) {
    logger.error('Failed to connect to Redis', err);
  }
})();

/**
 * Redis cache service
 */
export const redisCache = {
  /**
   * Set a value in Redis cache
   * @param key Cache key
   * @param value Value to cache
   * @param ttlSeconds TTL in seconds (optional)
   */
  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    try {
      const serializedValue = JSON.stringify(value);
      
      if (ttlSeconds) {
        await client.set(key, serializedValue, { EX: ttlSeconds });
      } else {
        await client.set(key, serializedValue);
      }
    } catch (error) {
      logger.error(`Error setting cache key: ${key}`, error);
      // Continue without caching - application should not break if cache fails
    }
  },

  /**
   * Get a value from Redis cache
   * @param key Cache key
   * @returns Cached value or null if not found
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await client.get(key);
      if (!data) return null;
      
      return JSON.parse(data) as T;
    } catch (error) {
      logger.error(`Error getting cache key: ${key}`, error);
      return null;
    }
  },

  /**
   * Delete a value from Redis cache
   * @param key Cache key to delete
   */
  async del(key: string): Promise<void> {
    try {
      await client.del(key);
    } catch (error) {
      logger.error(`Error deleting cache key: ${key}`, error);
    }
  },

  /**
   * Check if a key exists in Redis cache
   * @param key Cache key
   */
  async exists(key: string): Promise<boolean> {
    try {
      return (await client.exists(key)) === 1;
    } catch (error) {
      logger.error(`Error checking if cache key exists: ${key}`, error);
      return false;
    }
  },

  /**
   * Set a key with expiration if it doesn't exist
   * @param key Cache key
   * @param value Value to cache
   * @param ttlSeconds TTL in seconds
   * @returns true if set, false if key already exists
   */
  async setNX(key: string, value: any, ttlSeconds: number): Promise<boolean> {
    try {
      const serializedValue = JSON.stringify(value);
      return await client.set(key, serializedValue, {
        EX: ttlSeconds,
        NX: true,
      }) === 'OK';
    } catch (error) {
      logger.error(`Error setting cache key with NX: ${key}`, error);
      return false;
    }
  },
  
  /**
   * Increment a counter in Redis
   * @param key Counter key
   * @returns New counter value
   */
  async incr(key: string): Promise<number> {
    try {
      return await client.incr(key);
    } catch (error) {
      logger.error(`Error incrementing counter: ${key}`, error);
      return 0;
    }
  },
  
  /**
   * Add TTL to existing key
   * @param key Cache key
   * @param ttlSeconds TTL in seconds
   */
  async expire(key: string, ttlSeconds: number): Promise<boolean> {
    try {
      return await client.expire(key, ttlSeconds);
    } catch (error) {
      logger.error(`Error setting TTL for key: ${key}`, error);
      return false;
    }
  },
  
  /**
   * Get TTL of a key
   * @param key Cache key
   * @returns TTL in seconds, -1 if persistent, -2 if expired/not exists
   */
  async ttl(key: string): Promise<number> {
    try {
      return await client.ttl(key);
    } catch (error) {
      logger.error(`Error getting TTL for key: ${key}`, error);
      return -2;
    }
  },
  
  /**
   * Flush all cache
   * Use with caution - only for dev/testing
   */
  async flushAll(): Promise<void> {
    try {
      await client.flushAll();
      logger.warn('Redis cache flushed');
    } catch (error) {
      logger.error('Error flushing cache', error);
    }
  }
};