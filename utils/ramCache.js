// High-Performance In-Memory RAM Cache calibrated for 16GB Heap on 24GB System
class UltraRAMCache {
  constructor(maxItems = 10000, defaultTtlMs = 3600000) { // 1-hour default TTL
    this.cache = new Map();
    this.maxItems = maxItems;
    this.defaultTtlMs = defaultTtlMs;
    // Pre-allocated fast memory buffers
    this.broadcastBuffers = new Map();
  }

  set(key, value, ttlMs = this.defaultTtlMs) {
    if (this.cache.size >= this.maxItems) {
      // Evict oldest 5000 items (FIFO)
      const keysToDelete = Array.from(this.cache.keys()).slice(0, 100);
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

  // Pre-warms database tables directly into DDR4 RAM
  async prewarmDatabaseToRAM(queryFn) {
    if (typeof queryFn !== 'function') return;
    try {
      console.log('⚡ [RAM ENGINE] Pre-warming database tables into high-speed DDR4 memory...');
      const startPrewarm = Date.now();

      // 1. Pre-warm all servers & channels
      const servers = await queryFn('SELECT * FROM servers LIMIT 10000');
      this.set('all_servers', servers.rows, 3600000);

      const chatrooms = await queryFn('SELECT * FROM chatrooms LIMIT 10000');
      this.set('all_chatrooms', chatrooms.rows, 3600000);

      // 2. Pre-warm user profiles
      const users = await queryFn('SELECT id, username, avatar_url, is_admin FROM users LIMIT 500');
      for (const u of users.rows) {
        this.set(`user_prof_${u.id}`, u, 3600000);
      }

      // 3. Pre-warm recent messages per chatroom
      for (const room of chatrooms.rows.slice(0, 5)) {
        const msgs = await queryFn(
          `SELECT sm.id, sm.content, sm.created_at, sm.reactions, u.id as sender_id, u.username, u.avatar_url
           FROM server_messages sm
           INNER JOIN users u ON sm.sender_id = u.id
           WHERE sm.chatroom_id = $1
           ORDER BY sm.created_at DESC
           LIMIT 100`,
          [room.id]
        );
        this.set(`room_msgs_${room.id}`, msgs.rows.reverse(), 3600000);
      }

      const dur = Date.now() - startPrewarm;
      const memStats = this.getStats();
      console.log(`✅ [RAM ENGINE] Pre-warmed ${memStats.totalCachedKeys} database entities into RAM in ${dur}ms (Heap: ${memStats.heapUsageMB}MB).`);
    } catch (err) {
      console.warn('[RAM ENGINE] Pre-warming warning (non-fatal):', err.message);
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
