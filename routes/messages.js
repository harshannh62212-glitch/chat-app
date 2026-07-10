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
      `SELECT DISTINCT 
         CASE 
           WHEN sender_id = $1 THEN recipient_id 
           ELSE sender_id 
         END as other_user_id,
         u.username,
         u.avatar_url,
         MAX(created_at) as last_message_at
       FROM direct_messages dm
       INNER JOIN users u ON (
         CASE 
           WHEN sender_id = $1 THEN recipient_id = u.id
           ELSE sender_id = u.id
         END
       )
       WHERE sender_id = $1 OR recipient_id = $1
       GROUP BY other_user_id, u.username, u.avatar_url
       ORDER BY last_message_at DESC`,
      [userId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch DMs' });
  }
});

module.exports = router;
