/**
 * Redis cache service
 */
export declare const redisCache: {
    /**
     * Set a value in Redis cache
     * @param key Cache key
     * @param value Value to cache
     * @param ttlSeconds TTL in seconds (optional)
     */
    set(key: string, value: any, ttlSeconds?: number): Promise<void>;
    /**
     * Get a value from Redis cache
     * @param key Cache key
     * @returns Cached value or null if not found
     */
    get<T>(key: string): Promise<T | null>;
    /**
     * Delete a value from Redis cache
     * @param key Cache key to delete
     */
    del(key: string): Promise<void>;
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
     * Get TTL of a key
     * @param key Cache key
     * @returns TTL in seconds, -1 if persistent, -2 if expired/not exists
     */
    ttl(key: string): Promise<number>;
    /**
     * Flush all cache
     * Use with caution - only for dev/testing
     */
    flushAll(): Promise<void>;
};
//# sourceMappingURL=cache.service.d.ts.map