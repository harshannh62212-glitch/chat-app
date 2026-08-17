// High-Performance In-Memory RAM Cache calibrated for 16GB Heap on 24GB System
class UltraRAMCache {
  constructor(maxItems = 600000, defaultTtlMs = 120000) {
    this.cache = new Map();
    this.maxItems = maxItems;
    this.defaultTtlMs = defaultTtlMs;
  }

  set(key, value, ttlMs = this.defaultTtlMs) {
    if (this.cache.size >= this.maxItems) {
      // Evict oldest 1000 items (FIFO)
      const keysToDelete = Array.from(this.cache.keys()).slice(0, 1000);
      for (const k of keysToDelete) this.cache.delete(k);
    }
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs
    });
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return item.value;
  }

  invalidate(keyPattern) {
    if (!keyPattern) {
      this.cache.clear();
      return;
    }
    for (const key of this.cache.keys()) {
      if (key.includes(keyPattern)) {
        this.cache.delete(key);
      }
    }
  }

  getStats() {
    return {
      totalCachedKeys: this.cache.size,
      heapUsageMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      rssMB: Math.round(process.memoryUsage().rss / 1024 / 1024)
    };
  }
}

const ramCache = new UltraRAMCache();
module.exports = ramCache;
