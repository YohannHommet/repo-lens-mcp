import { LRUCache } from 'lru-cache';
export class SearchCache {
    cache;
    constructor(config) {
        this.cache = new LRUCache({
            max: config.maxSize,
            ttl: config.ttl,
        });
    }
    generateKey(prefix, params) {
        return `${prefix}:${JSON.stringify(params)}`;
    }
    get(key) {
        return this.cache.get(key);
    }
    set(key, value) {
        this.cache.set(key, value);
    }
    has(key) {
        return this.cache.has(key);
    }
    delete(key) {
        this.cache.delete(key);
    }
    invalidateByPrefix(prefix) {
        for (const key of this.cache.keys()) {
            if (key.startsWith(prefix)) {
                this.cache.delete(key);
            }
        }
    }
    clear() {
        this.cache.clear();
    }
}
//# sourceMappingURL=cache.js.map