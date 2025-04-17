import Redis from "ioredis";
import config from "../config";
import { logger } from "../utils/logger";

// Create Redis client with better error handling
let redisClient: Redis | null = null;

/**
 * Initialize Redis connection with error handling
 */
const initRedis = async () => {
  try {
    // Only create client if null
    if (!redisClient) {
      // Prefer URL connection over individual parameters
      if (config.redis.url) {
        logger.info(`Connecting to Redis using URL (cloud)`);
        redisClient = new Redis(config.redis.url, {
          lazyConnect: true,
          connectTimeout: 10000,
          // Limited retry strategy to prevent log spam
          retryStrategy: (times) => {
            if (times > 3) {
              logger.warn(
                `Redis connection failed after ${times} attempts. Will not retry automatically.`
              );
              return null; // Stop retrying after 3 attempts
            }
            const delay = Math.min(times * 500, 3000);
            return delay;
          },
          maxRetriesPerRequest: 1,
          tls: config.redis.tls ? { rejectUnauthorized: false } : undefined,
        });
      } else {
        // Fallback to host/port connection
        logger.info(`Connecting to Redis using host/port (local)`);
        redisClient = new Redis({
          host: config.redis.host,
          port: config.redis.port,
          username: config.redis.username,
          password: config.redis.password,
          lazyConnect: true,
          connectTimeout: 5000,
          // Limited retry strategy to prevent log spam
          retryStrategy: (times) => {
            if (times > 3) {
              logger.warn(
                `Redis connection failed after ${times} attempts. Will not retry automatically.`
              );
              return null; // Stop retrying after 3 attempts
            }
            const delay = Math.min(times * 500, 3000);
            return delay;
          },
          maxRetriesPerRequest: 1,
        });
      }

      // Handle connection errors silently to prevent log spam
      redisClient.on("error", (err) => {
        if (!config.redis.errorLogged) {
          logger.error(
            "Redis connection error, authentication or connection issues",
            err
          );
          // Set flag to prevent repeated logging
          config.redis.errorLogged = true;
        }
      });

      // Reset error logged flag on successful connection
      redisClient.on("connect", () => {
        logger.info("Redis client connected successfully");
        config.redis.errorLogged = false;
        config.redis.unavailable = false;
      });

      // Try to connect
      await redisClient.connect();
    }
    return true;
  } catch (error) {
    // Log once and set unavailable flag
    if (!config.redis.unavailable) {
      logger.error(
        "Failed to connect to Redis, service will operate in fallback mode",
        error
      );
      config.redis.unavailable = true;
    }
    return false;
  }
};

// Try to initialize Redis on service start but don't crash if it fails
initRedis().catch(() => {
  // Error already logged in initRedis
});

/**
 * Get Redis client with safety checks
 * @returns Redis client or null if unavailable
 */
const getRedisClient = async (): Promise<Redis | null> => {
  try {
    // Attempt reconnection if client doesn't exist or is not ready
    if (!redisClient || redisClient.status !== "ready") {
      const connected = await initRedis();
      if (!connected) return null;
    }
    return redisClient;
  } catch (error) {
    // Don't log here, just return null for fallback handling
    return null;
  }
};

/**
 * Redis service functions with fallback behavior when Redis is unavailable
 */
export const redisService = {
  /**
   * Check if Redis is connected
   * @returns True if connected
   */
  async isConnected(): Promise<boolean> {
    const client = await getRedisClient();
    return !!client && client.status === "ready";
  },

  /**
   * Test Redis connection by setting and getting a test key
   * @returns True if test passes
   */
  async testConnection(): Promise<boolean> {
    try {
      const client = await getRedisClient();
      if (!client) return false;

      const testKey = "test_connection";
      const testValue = Date.now().toString();

      await client.set(testKey, testValue, "EX", 10);
      const retrieved = await client.get(testKey);

      return retrieved === testValue;
    } catch (error) {
      if (!config.redis.unavailable) {
        logger.error("Redis connection test failed", error);
        config.redis.unavailable = true;
      }
      return false;
    }
  },

  /**
   * Set value in Redis with expiry
   * @param key Redis key
   * @param value Value to store
   * @param expireSeconds Expiry in seconds
   */
  async set(key: string, value: any, expireSeconds?: number): Promise<void> {
    try {
      const client = await getRedisClient();
      if (!client) return; // Fail silently

      const stringValue =
        typeof value === "string" ? value : JSON.stringify(value);

      if (expireSeconds) {
        await client.set(key, stringValue, "EX", expireSeconds);
      } else {
        await client.set(key, stringValue);
      }
    } catch (error) {
      // Don't throw, just log the error once
      if (!config.redis.unavailable) {
        logger.error(`Redis set error for key: ${key}`, error);
        config.redis.unavailable = true;
      }
    }
  },

  /**
   * Get value from Redis
   * @param key Redis key
   * @returns Value or null if not found
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const client = await getRedisClient();
      if (!client) return null;

      const value = await client.get(key);

      if (!value) {
        return null;
      }

      try {
        return JSON.parse(value) as T;
      } catch {
        return value as unknown as T;
      }
    } catch (error) {
      // Just return null for fallback behavior
      return null;
    }
  },

  /**
   * Delete key from Redis
   * @param key Redis key
   */
  async del(key: string): Promise<void> {
    try {
      const client = await getRedisClient();
      if (!client) return;

      await client.del(key);
    } catch (error) {
      // Fail silently
    }
  },

  /**
   * Check TTL (time to live) of a key
   * @param key Redis key
   * @returns TTL in seconds or -2 if key doesn't exist, -1 if no expiry
   */
  async ttl(key: string): Promise<number> {
    try {
      const client = await getRedisClient();
      if (!client) return -2;

      return await client.ttl(key);
    } catch (error) {
      return -2; // Return -2 (key doesn't exist) as a fallback
    }
  },

  /**
   * Check if a key exists in Redis cache
   * @param key Cache key
   */
  async exists(key: string): Promise<boolean> {
    try {
      const client = await getRedisClient();
      if (!client) return false;

      return (await client.exists(key)) === 1;
    } catch (error) {
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
      const client = await getRedisClient();
      if (!client) return false;

      const serializedValue = JSON.stringify(value);
      const result = await client.set(
        key,
        serializedValue,
        "EX",
        ttlSeconds,
        "NX"
      );
      return result === "OK";
    } catch (error) {
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
      const client = await getRedisClient();
      if (!client) return 0;

      return await client.incr(key);
    } catch (error) {
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
      const client = await getRedisClient();
      if (!client) return false;

      return (await client.expire(key, ttlSeconds)) === 1;
    } catch (error) {
      return false;
    }
  },

  /**
   * Add item to a list
   * @param key List key
   * @param value Value to add
   * @returns Length of list after operation
   */
  async rpush(key: string, value: any): Promise<number> {
    try {
      const client = await getRedisClient();
      if (!client) return 0;

      const serializedValue = JSON.stringify(value);
      return await client.rpush(key, serializedValue);
    } catch (error) {
      logger.error(`Error pushing to Redis list: ${key}`, error);
      return 0;
    }
  },

  /**
   * Get items from a list
   * @param key List key
   * @param start Start index
   * @param end End index
   * @returns List items
   */
  async lrange<T>(key: string, start: number, end: number): Promise<T[]> {
    try {
      const client = await getRedisClient();
      if (!client) return [];

      const items = await client.lrange(key, start, end);
      return items.map((item) => JSON.parse(item)) as T[];
    } catch (error) {
      logger.error(`Error getting Redis list range: ${key}`, error);
      return [];
    }
  },

  /**
   * Publish a message to a channel
   * @param channel Channel name
   * @param message Message to publish
   */
  async publish(channel: string, message: any): Promise<number> {
    try {
      const client = await getRedisClient();
      if (!client) return 0;

      const serializedMessage = JSON.stringify(message);
      return await client.publish(channel, serializedMessage);
    } catch (error) {
      logger.error(`Error publishing to Redis channel: ${channel}`, error);
      return 0;
    }
  },

  /**
   * Subscribe to a channel
   * @param channel Channel name
   * @param callback Callback function to handle messages
   */
  async subscribe(
    channel: string,
    callback: (message: any) => void
  ): Promise<void> {
    try {
      const client = await getRedisClient();
      if (!client) return;

      await client.subscribe(channel);

      client.on("message", (ch, message) => {
        if (ch === channel) {
          try {
            const parsedMessage = JSON.parse(message);
            callback(parsedMessage);
          } catch (error) {
            logger.error(`Error parsing Redis message: ${message}`, error);
          }
        }
      });
    } catch (error) {
      logger.error(`Error subscribing to Redis channel: ${channel}`, error);
    }
  },

  /**
   * Add a value to a sorted set
   * @param key Sorted set key
   * @param score Score
   * @param value Value
   */
  async zadd(key: string, score: number, value: any): Promise<number> {
    try {
      const client = await getRedisClient();
      if (!client) return 0;

      const serializedValue = JSON.stringify(value);
      return await client.zadd(key, score, serializedValue);
    } catch (error) {
      logger.error(`Error adding to Redis sorted set: ${key}`, error);
      return 0;
    }
  },

  /**
   * Get values from a sorted set
   * @param key Sorted set key
   * @param min Minimum score
   * @param max Maximum score
   */
  async zrangebyscore<T>(key: string, min: number, max: number): Promise<T[]> {
    try {
      const client = await getRedisClient();
      if (!client) return [];

      const items = await client.zrangebyscore(key, min, max);
      return items.map((item) => JSON.parse(item)) as T[];
    } catch (error) {
      logger.error(`Error getting Redis sorted set range: ${key}`, error);
      return [];
    }
  },

  /**
   * Flush all cache
   * Use with caution - only for dev/testing
   */
  async flushAll(): Promise<void> {
    try {
      const client = await getRedisClient();
      if (!client) return;

      await client.flushall();
      logger.warn("Redis cache flushed");
    } catch (error) {
      logger.error("Error flushing Redis cache", error);
    }
  },
};
