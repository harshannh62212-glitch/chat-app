const express = require('express');
const { query } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

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

// Post message in chatroom
router.post('/server', authMiddleware, async (req, res) => {
  try {
    const { chatroomId, content } = req.body;
    const senderId = req.userId;

    if (!chatroomId || !content) {
      return res.status(400).json({ error: 'chatroomId and content required' });
    }

    const insertResult = await query(
      `INSERT INTO server_messages (sender_id, chatroom_id, content) 
       VALUES ($1, $2, $3) 
       RETURNING id, sender_id, chatroom_id, content, created_at`,
      [senderId, chatroomId, content]
    );

    const message = insertResult.rows[0];

    const userResult = await query('SELECT username, avatar_url FROM users WHERE id = $1', [senderId]);
    const user = userResult.rows[0];

    const enriched = {
      ...message,
      username: user ? user.username : 'Unknown',
      avatar_url: user ? user.avatar_url : ''
    };

    res.status(201).json(enriched);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Post direct message
router.post('/dm', authMiddleware, async (req, res) => {
  try {
    const { recipientId, content } = req.body;
    const senderId = req.userId;

    if (!recipientId || !content) {
      return res.status(400).json({ error: 'recipientId and content required' });
    }

    const insertResult = await query(
      `INSERT INTO direct_messages (sender_id, recipient_id, content) 
       VALUES ($1, $2, $3) 
       RETURNING id, sender_id, recipient_id, content, created_at`,
      [senderId, recipientId, content]
    );

    res.status(201).json(insertResult.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send direct message' });
  }
});

module.exports = router;
