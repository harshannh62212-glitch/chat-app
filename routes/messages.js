const express = require('express');
const { query } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');
const batchWriter = require('../utils/batchWriter');
const ramCache = require('../utils/ramCache');

const router = express.Router();

// Helper to get cached user profile
async function getCachedUserProfile(userId) {
  const cacheKey = `user_prof_${userId}`;
  const cached = ramCache.get(cacheKey);
  if (cached) return cached;

  const res = await query('SELECT username, avatar_url FROM users WHERE id = $1', [userId]);
  const user = res.rows[0] || { username: 'Unknown', avatar_url: '' };
  ramCache.set(cacheKey, user, 300000); // 5 min TTL
  return user;
}

// Get messages in a chatroom
router.get('/chatroom/:chatroomId', authMiddleware, async (req, res) => {
  try {
    const { chatroomId } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const result = await query(
      `SELECT sm.id, sm.content, sm.created_at, u.id as sender_id, u.username, u.avatar_url
       FROM server_messages sm
       INNER JOIN users u ON sm.sender_id = u.id
       WHERE sm.chatroom_id = $1
       ORDER BY sm.created_at DESC
       LIMIT $2 OFFSET $3`,
      [chatroomId, limit, offset]
    );

    res.json(result.rows.reverse());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Get DMs with a user
router.get('/dm/:otherUserId', authMiddleware, async (req, res) => {
  try {
    const { otherUserId } = req.params;
    const userId = req.userId;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const result = await query(
      `SELECT id, sender_id, content, created_at
       FROM direct_messages
       WHERE (sender_id = $1 AND recipient_id = $2) OR (sender_id = $2 AND recipient_id = $1)
       ORDER BY created_at DESC
       LIMIT $3 OFFSET $4`,
      [userId, otherUserId, limit, offset]
    );

    res.json(result.rows.reverse());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch DMs' });
  }
});

// Get user's DM conversations
router.get('/dm-conversations/list', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;

    const result = await query(
      `WITH latest_messages AS (
         SELECT DISTINCT ON (
           CASE 
             WHEN dm.sender_id = $1 THEN dm.recipient_id 
             ELSE dm.sender_id 
           END
         )
           CASE 
             WHEN dm.sender_id = $1 THEN dm.recipient_id 
             ELSE dm.sender_id 
           END as other_user_id,
           u.username,
           u.avatar_url,
           dm.content as last_message_content,
           dm.created_at as last_message_at
         FROM direct_messages dm
         INNER JOIN users u ON (
           CASE 
             WHEN dm.sender_id = $1 THEN dm.recipient_id = u.id
             ELSE dm.sender_id = u.id
           END
         )
         WHERE dm.sender_id = $1 OR dm.recipient_id = $1
         ORDER BY 
           CASE 
             WHEN dm.sender_id = $1 THEN dm.recipient_id 
             ELSE dm.sender_id 
           END,
           dm.created_at DESC
       )
       SELECT * FROM latest_messages
       ORDER BY last_message_at DESC`,
      [userId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch DMs' });
  }
});

// Post message in chatroom with ultra-fast batch database writer
router.post('/server', authMiddleware, async (req, res) => {
  try {
    const { chatroomId, content } = req.body;
    const senderId = req.userId;

    if (!chatroomId || !content || content.trim().length < 2) {
      return res.status(400).json({ error: 'Message must be at least 2 characters long' });
    }

    // High throughput batch write to database
    const message = await batchWriter.enqueue(senderId, chatroomId, content);
    const user = await getCachedUserProfile(senderId);

    const enriched = {
      ...message,
      username: user.username,
      avatar_url: user.avatar_url,
      serverId: message.server_id,
      chatroom_id: chatroomId
    };

    const io = req.app.get('io');
    if (io) {
      io.emit('new-message', enriched);
    }

    res.status(201).json(enriched);
  } catch (err) {
    console.error('[MESSAGES API ERROR]', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Post direct message
router.post('/dm', authMiddleware, async (req, res) => {
  try {
    const { recipientId, content } = req.body;
    const senderId = req.userId;

    if (!recipientId || !content || content.trim().length < 2) {
      return res.status(400).json({ error: 'Message must be at least 2 characters long' });
    }

    const insertResult = await query(
      `INSERT INTO direct_messages (sender_id, recipient_id, content) 
       VALUES ($1, $2, $3) 
       RETURNING id, sender_id, recipient_id, content, created_at`,
      [senderId, recipientId, content]
    );

    const msg = insertResult.rows[0];
    const io = req.app.get('io');
    if (io) {
      const payload = {
        id: msg.id,
        senderId: msg.sender_id,
        sender_id: msg.sender_id,
        recipient_id: msg.recipient_id,
        dmWith: recipientId,
        content: msg.content,
        created_at: msg.created_at,
        timestamp: msg.created_at
      };
      io.to(`user-${recipientId}`).emit('new-dm', payload);
      io.to(`user-${senderId}`).emit('dm-sent', payload);
      io.emit('new-dm-global', payload);
    }

    res.status(201).json(msg);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send direct message' });
  }
});

// Delete a server message (own messages only, or admin)
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    // Fetch the message to verify ownership
    const msgResult = await query(
      `SELECT id, sender_id, chatroom_id FROM server_messages WHERE id = $1`,
      [id]
    );

    if (msgResult.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const msg = msgResult.rows[0];

    // Check if user is the sender or an admin
    const userResult = await query(`SELECT is_admin FROM users WHERE id = $1`, [userId]);
    const isAdmin = userResult.rows[0]?.is_admin === true;

    if (msg.sender_id !== userId && !isAdmin) {
      return res.status(403).json({ error: 'You can only delete your own messages' });
    }

    await query(`DELETE FROM server_messages WHERE id = $1`, [id]);

    // Emit real-time event so message disappears for everyone instantly
    const io = req.app.get('io');
    if (io) {
      io.emit('message-deleted', { id, type: 'server' });
    }

    res.json({ message: 'Message deleted successfully' });
  } catch (err) {
    console.error('Failed to delete server message:', err);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

// Delete a direct message (own messages only)
router.delete('/dm/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const msgResult = await query(
      `SELECT id, sender_id, recipient_id FROM direct_messages WHERE id = $1`,
      [id]
    );

    if (msgResult.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const msg = msgResult.rows[0];

    if (msg.sender_id !== userId) {
      return res.status(403).json({ error: 'You can only delete your own messages' });
    }

    await query(`DELETE FROM direct_messages WHERE id = $1`, [id]);

    // Emit real-time event to both participants
    const io = req.app.get('io');
    if (io) {
      io.to(`user-${msg.sender_id}`).emit('message-deleted', { id, type: 'dm' });
      io.to(`user-${msg.recipient_id}`).emit('message-deleted', { id, type: 'dm' });
    }

    res.json({ message: 'Message deleted successfully' });
  } catch (err) {
    console.error('Failed to delete DM:', err);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

module.exports = router;
