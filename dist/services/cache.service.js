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
exports.redisCache = void 0;
const redis_1 = require("redis");
const config_1 = __importDefault(require("../config"));
const logger_1 = require("../utils/logger");
// Create Redis client
const client = (0, redis_1.createClient)({
    url: config_1.default.redis.url,
});
client.on('error', (err) => logger_1.logger.error('Redis Client Error', err));
client.on('connect', () => logger_1.logger.info('Redis client connected'));
client.on('reconnecting', () => logger_1.logger.info('Redis client reconnecting'));
client.on('ready', () => logger_1.logger.info('Redis client ready'));
// Connect to Redis
(() => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield client.connect();
    }
    catch (err) {
        logger_1.logger.error('Failed to connect to Redis', err);
    }
}))();
/**
 * Redis cache service
 */
exports.redisCache = {
    /**
     * Set a value in Redis cache
     * @param key Cache key
     * @param value Value to cache
     * @param ttlSeconds TTL in seconds (optional)
     */
    set(key, value, ttlSeconds) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const serializedValue = JSON.stringify(value);
                if (ttlSeconds) {
                    yield client.set(key, serializedValue, { EX: ttlSeconds });
                }
                else {
                    yield client.set(key, serializedValue);
                }
            }
            catch (error) {
                logger_1.logger.error(`Error setting cache key: ${key}`, error);
                // Continue without caching - application should not break if cache fails
            }
        });
    },
    /**
     * Get a value from Redis cache
     * @param key Cache key
     * @returns Cached value or null if not found
     */
    get(key) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const data = yield client.get(key);
                if (!data)
                    return null;
                return JSON.parse(data);
            }
            catch (error) {
                logger_1.logger.error(`Error getting cache key: ${key}`, error);
                return null;
            }
        });
    },
    /**
     * Delete a value from Redis cache
     * @param key Cache key to delete
     */
    del(key) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield client.del(key);
            }
            catch (error) {
                logger_1.logger.error(`Error deleting cache key: ${key}`, error);
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
                return (yield client.exists(key)) === 1;
            }
            catch (error) {
                logger_1.logger.error(`Error checking if cache key exists: ${key}`, error);
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
                const serializedValue = JSON.stringify(value);
                return (yield client.set(key, serializedValue, {
                    EX: ttlSeconds,
                    NX: true,
                })) === 'OK';
            }
            catch (error) {
                logger_1.logger.error(`Error setting cache key with NX: ${key}`, error);
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
                return yield client.incr(key);
            }
            catch (error) {
                logger_1.logger.error(`Error incrementing counter: ${key}`, error);
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
                return yield client.expire(key, ttlSeconds);
            }
            catch (error) {
                logger_1.logger.error(`Error setting TTL for key: ${key}`, error);
                return false;
            }
        });
    },
    /**
     * Get TTL of a key
     * @param key Cache key
     * @returns TTL in seconds, -1 if persistent, -2 if expired/not exists
     */
    ttl(key) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield client.ttl(key);
            }
            catch (error) {
                logger_1.logger.error(`Error getting TTL for key: ${key}`, error);
                return -2;
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
                yield client.flushAll();
                logger_1.logger.warn('Redis cache flushed');
            }
            catch (error) {
                logger_1.logger.error('Error flushing cache', error);
            }
        });
    }
};
//# sourceMappingURL=cache.service.js.map