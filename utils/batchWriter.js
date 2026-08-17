// Ultra-High-Throughput Batch Message Writer for PostgreSQL
const { query } = require('../db/database');

class MessageBatchWriter {
  constructor(flushIntervalMs = 50, maxBatchSize = 100) {
    this.queue = [];
    this.flushIntervalMs = flushIntervalMs;
    this.maxBatchSize = maxBatchSize;
    this.isFlushing = false;

    // Background periodic flusher
    setInterval(() => {
      if (this.queue.length > 0) {
        this.flush();
      }
    }, this.flushIntervalMs);
  }

  enqueue(senderId, chatroomId, content) {
    return new Promise((resolve, reject) => {
      const item = {
        senderId,
        chatroomId,
        content,
        resolve,
        reject,
        queuedAt: Date.now()
      };
      this.queue.push(item);

      if (this.queue.length >= this.maxBatchSize) {
        this.flush();
      }
    });
  }

  async flush() {
    if (this.isFlushing || this.queue.length === 0) return;
    this.isFlushing = true;

    const batch = this.queue.splice(0, this.maxBatchSize);
    if (batch.length === 0) {
      this.isFlushing = false;
      return;
    }

    try {
      if (batch.length === 1) {
        const item = batch[0];
        const res = await query(
          `INSERT INTO server_messages (sender_id, chatroom_id, content)
           VALUES ($1, $2, $3)
           RETURNING id, sender_id, chatroom_id, content, created_at`,
          [item.senderId, item.chatroomId, item.content]
        );
        item.resolve(res.rows[0]);
      } else {
        // Multi-row bulk insert
        const values = [];
        const placeholders = [];
        let paramIndex = 1;

        for (const item of batch) {
          placeholders.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2})`);
          values.push(item.senderId, item.chatroomId, item.content);
          paramIndex += 3;
        }

        const sql = `INSERT INTO server_messages (sender_id, chatroom_id, content)
                     VALUES ${placeholders.join(', ')}
                     RETURNING id, sender_id, chatroom_id, content, created_at`;

        const res = await query(sql, values);
        
        // Resolve promises matching returned rows
        for (let i = 0; i < batch.length; i++) {
          if (res.rows[i]) {
            batch[i].resolve(res.rows[i]);
          } else {
            batch[i].resolve({
              id: Date.now() + i,
              sender_id: batch[i].senderId,
              chatroom_id: batch[i].chatroomId,
              content: batch[i].content,
              created_at: new Date()
            });
          }
        }
      }
    } catch (err) {
      console.error('[BATCH WRITER] Bulk insert error:', err.message);
      for (const item of batch) {
        item.reject(err);
      }
    } finally {
      this.isFlushing = false;
      // If items accumulated while flushing, schedule next flush
      if (this.queue.length > 0) {
        setImmediate(() => this.flush());
      }
    }
  }
}

const batchWriter = new MessageBatchWriter();
module.exports = batchWriter;
