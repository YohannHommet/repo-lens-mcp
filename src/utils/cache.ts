import { LRUCache } from 'lru-cache'

export interface CacheConfig {
  maxSize: number
  ttl: number
}

export class SearchCache<T extends object> {
  private cache: LRUCache<string, T>

  constructor(config: CacheConfig) {
    this.cache = new LRUCache<string, T>({
      max: config.maxSize,
      ttl: config.ttl,
    })
  }

  generateKey(prefix: string, params: Record<string, unknown>): string {
    return `${prefix}:${JSON.stringify(params)}`
  }

  get(key: string): T | undefined {
    return this.cache.get(key)
  }

  set(key: string, value: T): void {
    this.cache.set(key, value)
  }

  has(key: string): boolean {
    return this.cache.has(key)
  }

  delete(key: string): void {
    this.cache.delete(key)
  }

  invalidateByPrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key)
      }
    }
  }

  clear(): void {
    this.cache.clear()
  }
}
