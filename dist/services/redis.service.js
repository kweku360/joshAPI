"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisService = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const config_1 = __importDefault(require("../config"));
const logger_1 = require("../utils/logger");
// Create Redis client with better error handling
let redisClient = null;
/**
 * Initialize Redis connection with error handling
 */
const initRedis = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Only create client if null
        if (!redisClient) {
            // Prefer URL connection over individual parameters
            if (config_1.default.redis.url) {
                logger_1.logger.info(`Connecting to Redis using URL (cloud)`);
                redisClient = new ioredis_1.default(config_1.default.redis.url, {
                    lazyConnect: true,
                    connectTimeout: 10000,
                    // Limited retry strategy to prevent log spam
                    retryStrategy: (times) => {
                        if (times > 3) {
                            logger_1.logger.warn(`Redis connection failed after ${times} attempts. Will not retry automatically.`);
                            return null; // Stop retrying after 3 attempts
                        }
                        const delay = Math.min(times * 500, 3000);
                        return delay;
                    },
                    maxRetriesPerRequest: 1,
                    tls: config_1.default.redis.tls ? { rejectUnauthorized: false } : undefined,
                });
            }
            else {
                // Fallback to host/port connection
                logger_1.logger.info(`Connecting to Redis using host/port (local)`);
                redisClient = new ioredis_1.default({
                    host: config_1.default.redis.host,
                    port: config_1.default.redis.port,
                    username: config_1.default.redis.username,
                    password: config_1.default.redis.password,
                    lazyConnect: true,
                    connectTimeout: 5000,
                    // Limited retry strategy to prevent log spam
                    retryStrategy: (times) => {
                        if (times > 3) {
                            logger_1.logger.warn(`Redis connection failed after ${times} attempts. Will not retry automatically.`);
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
                if (!config_1.default.redis.errorLogged) {
                    logger_1.logger.error("Redis connection error, authentication or connection issues", err);
                    // Set flag to prevent repeated logging
                    config_1.default.redis.errorLogged = true;
                }
            });
            // Reset error logged flag on successful connection
            redisClient.on("connect", () => {
                logger_1.logger.info("Redis client connected successfully");
                config_1.default.redis.errorLogged = false;
                config_1.default.redis.unavailable = false;
            });
            // Try to connect
            yield redisClient.connect();
        }
        return true;
    }
    catch (error) {
        // Log once and set unavailable flag
        if (!config_1.default.redis.unavailable) {
            logger_1.logger.error("Failed to connect to Redis, service will operate in fallback mode", error);
            config_1.default.redis.unavailable = true;
        }
        return false;
    }
});
// Try to initialize Redis on service start but don't crash if it fails
initRedis().catch(() => {
    // Error already logged in initRedis
});
/**
 * Get Redis client with safety checks
 * @returns Redis client or null if unavailable
 */
const getRedisClient = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Attempt reconnection if client doesn't exist or is not ready
        if (!redisClient || redisClient.status !== "ready") {
            const connected = yield initRedis();
            if (!connected)
                return null;
        }
        return redisClient;
    }
    catch (error) {
        // Don't log here, just return null for fallback handling
        return null;
    }
});
/**
 * Redis service functions with fallback behavior when Redis is unavailable
 */
exports.redisService = {
    /**
     * Check if Redis is connected
     * @returns True if connected
     */
    isConnected() {
        return __awaiter(this, void 0, void 0, function* () {
            const client = yield getRedisClient();
            return !!client && client.status === "ready";
        });
    },
    /**
     * Test Redis connection by setting and getting a test key
     * @returns True if test passes
     */
    testConnection() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const client = yield getRedisClient();
                if (!client)
                    return false;
                const testKey = "test_connection";
                const testValue = Date.now().toString();
                yield client.set(testKey, testValue, "EX", 10);
                const retrieved = yield client.get(testKey);
                return retrieved === testValue;
            }
            catch (error) {
                if (!config_1.default.redis.unavailable) {
                    logger_1.logger.error("Redis connection test failed", error);
                    config_1.default.redis.unavailable = true;
                }
                return false;
            }
        });
    },
    /**
     * Set value in Redis with expiry
     * @param key Redis key
     * @param value Value to store
     * @param expireSeconds Expiry in seconds
     */
    set(key, value, expireSeconds) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const client = yield getRedisClient();
                if (!client)
                    return; // Fail silently
                const stringValue = typeof value === "string" ? value : JSON.stringify(value);
                if (expireSeconds) {
                    yield client.set(key, stringValue, "EX", expireSeconds);
                }
                else {
                    yield client.set(key, stringValue);
                }
            }
            catch (error) {
                // Don't throw, just log the error once
                if (!config_1.default.redis.unavailable) {
                    logger_1.logger.error(`Redis set error for key: ${key}`, error);
                    config_1.default.redis.unavailable = true;
                }
            }
        });
    },
    /**
     * Get value from Redis
     * @param key Redis key
     * @returns Value or null if not found
     */
    get(key) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const client = yield getRedisClient();
                if (!client)
                    return null;
                const value = yield client.get(key);
                if (!value) {
                    return null;
                }
                try {
                    return JSON.parse(value);
                }
                catch (_a) {
                    return value;
                }
            }
            catch (error) {
                // Just return null for fallback behavior
                return null;
            }
        });
    },
    /**
     * Delete key from Redis
     * @param key Redis key
     */
    del(key) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const client = yield getRedisClient();
                if (!client)
                    return;
                yield client.del(key);
            }
            catch (error) {
                // Fail silently
            }
        });
    },
    /**
     * Check TTL (time to live) of a key
     * @param key Redis key
     * @returns TTL in seconds or -2 if key doesn't exist, -1 if no expiry
     */
    ttl(key) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const client = yield getRedisClient();
                if (!client)
                    return -2;
                return yield client.ttl(key);
            }
            catch (error) {
                return -2; // Return -2 (key doesn't exist) as a fallback
            }
        });
    },
    /**
     * Check if a key exists in Redis cache
     * @param key Cache key
     */
    exists(key) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const client = yield getRedisClient();
                if (!client)
                    return false;
                return (yield client.exists(key)) === 1;
            }
            catch (error) {
                return false;
            }
        });
    },
    /**
     * Set a key with expiration if it doesn't exist
     * @param key Cache key
     * @param value Value to cache
     * @param ttlSeconds TTL in seconds
     * @returns true if set, false if key already exists
     */
    setNX(key, value, ttlSeconds) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const client = yield getRedisClient();
                if (!client)
                    return false;
                const serializedValue = JSON.stringify(value);
                const result = yield client.set(key, serializedValue, "EX", ttlSeconds, "NX");
                return result === "OK";
            }
            catch (error) {
                return false;
            }
        });
    },
    /**
     * Increment a counter in Redis
     * @param key Counter key
     * @returns New counter value
     */
    incr(key) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const client = yield getRedisClient();
                if (!client)
                    return 0;
                return yield client.incr(key);
            }
            catch (error) {
                return 0;
            }
        });
    },
    /**
     * Add TTL to existing key
     * @param key Cache key
     * @param ttlSeconds TTL in seconds
     */
    expire(key, ttlSeconds) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const client = yield getRedisClient();
                if (!client)
                    return false;
                return (yield client.expire(key, ttlSeconds)) === 1;
            }
            catch (error) {
                return false;
            }
        });
    },
    /**
     * Add item to a list
     * @param key List key
     * @param value Value to add
     * @returns Length of list after operation
     */
    rpush(key, value) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const client = yield getRedisClient();
                if (!client)
                    return 0;
                const serializedValue = JSON.stringify(value);
                return yield client.rpush(key, serializedValue);
            }
            catch (error) {
                logger_1.logger.error(`Error pushing to Redis list: ${key}`, error);
                return 0;
            }
        });
    },
    /**
     * Get items from a list
     * @param key List key
     * @param start Start index
     * @param end End index
     * @returns List items
     */
    lrange(key, start, end) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const client = yield getRedisClient();
                if (!client)
                    return [];
                const items = yield client.lrange(key, start, end);
                return items.map((item) => JSON.parse(item));
            }
            catch (error) {
                logger_1.logger.error(`Error getting Redis list range: ${key}`, error);
                return [];
            }
        });
    },
    /**
     * Publish a message to a channel
     * @param channel Channel name
     * @param message Message to publish
     */
    publish(channel, message) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const client = yield getRedisClient();
                if (!client)
                    return 0;
                const serializedMessage = JSON.stringify(message);
                return yield client.publish(channel, serializedMessage);
            }
            catch (error) {
                logger_1.logger.error(`Error publishing to Redis channel: ${channel}`, error);
                return 0;
            }
        });
    },
    /**
     * Subscribe to a channel
     * @param channel Channel name
     * @param callback Callback function to handle messages
     */
    subscribe(channel, callback) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const client = yield getRedisClient();
                if (!client)
                    return;
                yield client.subscribe(channel);
                client.on("message", (ch, message) => {
                    if (ch === channel) {
                        try {
                            const parsedMessage = JSON.parse(message);
                            callback(parsedMessage);
                        }
                        catch (error) {
                            logger_1.logger.error(`Error parsing Redis message: ${message}`, error);
                        }
                    }
                });
            }
            catch (error) {
                logger_1.logger.error(`Error subscribing to Redis channel: ${channel}`, error);
            }
        });
    },
    /**
     * Add a value to a sorted set
     * @param key Sorted set key
     * @param score Score
     * @param value Value
     */
    zadd(key, score, value) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const client = yield getRedisClient();
                if (!client)
                    return 0;
                const serializedValue = JSON.stringify(value);
                return yield client.zadd(key, score, serializedValue);
            }
            catch (error) {
                logger_1.logger.error(`Error adding to Redis sorted set: ${key}`, error);
                return 0;
            }
        });
    },
    /**
     * Get values from a sorted set
     * @param key Sorted set key
     * @param min Minimum score
     * @param max Maximum score
     */
    zrangebyscore(key, min, max) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const client = yield getRedisClient();
                if (!client)
                    return [];
                const items = yield client.zrangebyscore(key, min, max);
                return items.map((item) => JSON.parse(item));
            }
            catch (error) {
                logger_1.logger.error(`Error getting Redis sorted set range: ${key}`, error);
                return [];
            }
        });
    },
    /**
     * Flush all cache
     * Use with caution - only for dev/testing
     */
    flushAll() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const client = yield getRedisClient();
                if (!client)
                    return;
                yield client.flushall();
                logger_1.logger.warn("Redis cache flushed");
            }
            catch (error) {
                logger_1.logger.error("Error flushing Redis cache", error);
            }
        });
    },
};
//# sourceMappingURL=redis.service.js.map