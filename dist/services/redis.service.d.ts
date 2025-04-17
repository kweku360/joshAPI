/**
 * Redis service functions with fallback behavior when Redis is unavailable
 */
export declare const redisService: {
    /**
     * Check if Redis is connected
     * @returns True if connected
     */
    isConnected(): Promise<boolean>;
    /**
     * Test Redis connection by setting and getting a test key
     * @returns True if test passes
     */
    testConnection(): Promise<boolean>;
    /**
     * Set value in Redis with expiry
     * @param key Redis key
     * @param value Value to store
     * @param expireSeconds Expiry in seconds
     */
    set(key: string, value: any, expireSeconds?: number): Promise<void>;
    /**
     * Get value from Redis
     * @param key Redis key
     * @returns Value or null if not found
     */
    get<T>(key: string): Promise<T | null>;
    /**
     * Delete key from Redis
     * @param key Redis key
     */
    del(key: string): Promise<void>;
    /**
     * Check TTL (time to live) of a key
     * @param key Redis key
     * @returns TTL in seconds or -2 if key doesn't exist, -1 if no expiry
     */
    ttl(key: string): Promise<number>;
    /**
     * Check if a key exists in Redis cache
     * @param key Cache key
     */
    exists(key: string): Promise<boolean>;
    /**
     * Set a key with expiration if it doesn't exist
     * @param key Cache key
     * @param value Value to cache
     * @param ttlSeconds TTL in seconds
     * @returns true if set, false if key already exists
     */
    setNX(key: string, value: any, ttlSeconds: number): Promise<boolean>;
    /**
     * Increment a counter in Redis
     * @param key Counter key
     * @returns New counter value
     */
    incr(key: string): Promise<number>;
    /**
     * Add TTL to existing key
     * @param key Cache key
     * @param ttlSeconds TTL in seconds
     */
    expire(key: string, ttlSeconds: number): Promise<boolean>;
    /**
     * Add item to a list
     * @param key List key
     * @param value Value to add
     * @returns Length of list after operation
     */
    rpush(key: string, value: any): Promise<number>;
    /**
     * Get items from a list
     * @param key List key
     * @param start Start index
     * @param end End index
     * @returns List items
     */
    lrange<T>(key: string, start: number, end: number): Promise<T[]>;
    /**
     * Publish a message to a channel
     * @param channel Channel name
     * @param message Message to publish
     */
    publish(channel: string, message: any): Promise<number>;
    /**
     * Subscribe to a channel
     * @param channel Channel name
     * @param callback Callback function to handle messages
     */
    subscribe(channel: string, callback: (message: any) => void): Promise<void>;
    /**
     * Add a value to a sorted set
     * @param key Sorted set key
     * @param score Score
     * @param value Value
     */
    zadd(key: string, score: number, value: any): Promise<number>;
    /**
     * Get values from a sorted set
     * @param key Sorted set key
     * @param min Minimum score
     * @param max Maximum score
     */
    zrangebyscore<T>(key: string, min: number, max: number): Promise<T[]>;
    /**
     * Flush all cache
     * Use with caution - only for dev/testing
     */
    flushAll(): Promise<void>;
};
//# sourceMappingURL=redis.service.d.ts.map