export interface CacheConfig {
    maxSize: number;
    ttl: number;
}
export declare class SearchCache<T extends object> {
    private cache;
    constructor(config: CacheConfig);
    generateKey(prefix: string, params: Record<string, unknown>): string;
    get(key: string): T | undefined;
    set(key: string, value: T): void;
    has(key: string): boolean;
    delete(key: string): void;
    invalidateByPrefix(prefix: string): void;
    clear(): void;
}
//# sourceMappingURL=cache.d.ts.map