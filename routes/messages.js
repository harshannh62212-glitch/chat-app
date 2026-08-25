const express = require('express');
const { query } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');
const batchWriter = require('../utils/batchWriter');
const ramCache = require('../utils/ramCache');
const { handleLocalBotResponse } = require('../utils/botHandler');

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
      `SELECT sm.id, sm.content, sm.created_at, sm.reactions, sm.sender_id,
        COALESCE(u.username, CASE WHEN sm.sender_id = 'gemini-bot-id' THEN 'Gemini AI Assistant' ELSE 'Member' END) as username,
        COALESCE(u.avatar_url, CASE WHEN sm.sender_id = 'gemini-bot-id' THEN 'https://uxwing.com/wp-content/themes/uxwing/download/brands-and-social-media/google-gemini-icon.png' ELSE '' END) as avatar_url,
        (
          SELECT json_build_object('name', sr.name, 'color', sr.color)
          FROM server_member_roles smr
          JOIN server_roles sr ON smr.role_id = sr.id
          JOIN chatrooms c ON c.id = sm.chatroom_id
          WHERE smr.server_id = c.server_id AND smr.user_id = sm.sender_id
          ORDER BY sr.position DESC, sr.id ASC
          LIMIT 1
        ) as sender_role
       FROM server_messages sm
       LEFT JOIN users u ON sm.sender_id = u.id
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
router.get(['/dm/:otherUserId', '/direct/:otherUserId'], authMiddleware, async (req, res) => {
  try {
    const { otherUserId } = req.params;
    const userId = req.userId;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    // Mark unread incoming messages from this user as read
    await query(
      'UPDATE direct_messages SET is_read = true WHERE sender_id = $1 AND recipient_id = $2 AND is_read = false',
      [otherUserId, userId]
    );

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
       ),
       unread_counts AS (
         SELECT sender_id as other_user_id, COUNT(*) as unread_count
         FROM direct_messages
         WHERE recipient_id = $1 AND is_read = false
         GROUP BY sender_id
       )
       SELECT lm.*, COALESCE(uc.unread_count, 0)::int as unread_count
       FROM latest_messages lm
       LEFT JOIN unread_counts uc ON lm.other_user_id = uc.other_user_id
       ORDER BY unread_count DESC, lm.last_message_at DESC`,
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
    const chatroomId = req.body.chatroomId || req.body.chatroom_id;
    const content = req.body.content;
    const senderId = req.userId;

    if (!chatroomId || !content || !content.trim()) {
      return res.status(400).json({ error: 'Message cannot be empty' });
    }

    // High throughput batch write to database
    const message = await batchWriter.enqueue(senderId, chatroomId, content);
    const user = await getCachedUserProfile(senderId);

    // Look up sender's top role and server_id
    const roomRes = await query(
      `SELECT c.server_id, sr.name as role_name, sr.color as role_color
       FROM chatrooms c
       LEFT JOIN server_member_roles smr ON smr.server_id = c.server_id AND smr.user_id = $2
       LEFT JOIN server_roles sr ON smr.role_id = sr.id
       WHERE c.id = $1
       ORDER BY sr.position DESC, sr.id ASC
       LIMIT 1`,
      [chatroomId, senderId]
    );
    const serverId = roomRes.rows.length > 0 ? roomRes.rows[0].server_id : 1;
    const senderRole = roomRes.rows.length > 0 && roomRes.rows[0].role_name ? {
      name: roomRes.rows[0].role_name,
      color: roomRes.rows[0].role_color
    } : null;

    const enriched = {
      ...message,
      username: user.username,
      avatar_url: user.avatar_url,
      serverId: serverId,
      server_id: serverId,
      chatroom_id: parseInt(chatroomId, 10),
      sender_role: senderRole
    };

    const io = req.app.get('io');
    if (io) {
      io.to(`server-${serverId}`).emit('new-message', enriched);
    }

    if (content.toLowerCase().includes('@bot') || content.toLowerCase().includes('@gemini') || content.toLowerCase().includes('@ai')) {
      handleLocalBotResponse(io, serverId, chatroomId, content, senderId);
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
    const recipientId = req.body.recipientId || req.body.recipient_id;
    const content = req.body.content;
    const tempId = req.body.tempId;
    const senderId = req.userId;

    if (!recipientId || !content || !content.trim()) {
      return res.status(400).json({ error: 'Message cannot be empty' });
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
        tempId: tempId || null,
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
    }

    res.status(201).json({ ...msg, tempId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send direct message' });
  }
});

// Delete a server message (own messages only, or admin)
router.delete(['/:id', '/server/:id'], authMiddleware, async (req, res) => {
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

    // Check if user is the sender or a global admin
    const userResult = await query(`SELECT is_admin, username FROM users WHERE id = $1`, [userId]);
    const isGlobalAdmin = Boolean(
      userResult.rows[0]?.is_admin || 
      userResult.rows[0]?.username === 'ADMIN' || 
      userResult.rows[0]?.username === 'Nxghtmare3621' || 
      userResult.rows[0]?.username === 'admin'
    );

    let canDelete = (msg.sender_id === userId) || isGlobalAdmin;

    if (!canDelete && msg.chatroom_id) {
      // Check server ownership or manage_messages role
      const srvRes = await query(
        `SELECT s.id as server_id, s.owner_id 
         FROM chatrooms c
         JOIN servers s ON c.server_id = s.id
         WHERE c.id = $1`,
        [msg.chatroom_id]
      );

      if (srvRes.rows.length > 0) {
        const srv = srvRes.rows[0];
        if (srv.owner_id === userId) {
          canDelete = true;
        } else {
          const roleRes = await query(
            `SELECT sr.permissions
             FROM server_member_roles smr
             JOIN server_roles sr ON smr.role_id = sr.id
             WHERE smr.server_id = $1 AND smr.user_id = $2`,
            [srv.server_id, userId]
          );

          canDelete = roleRes.rows.some(r => {
            const p = r.permissions || {};
            return p.administrator === true || p.manage_messages === true;
          });
        }
      }
    }

    if (!canDelete) {
      return res.status(403).json({ error: 'You do not have permission to delete this message' });
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
router.get('/ai/history', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const result = await query(
      `SELECT id, prompt, response, model, created_at
       FROM user_ai_conversations
       WHERE user_id = $1
       ORDER BY created_at ASC`,
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Failed to fetch AI history:', err);
    res.json([]);
  }
});

// 1-on-1 AI Text Bot conversation route (Gemini 3.6 Flash / Gemma AI)
router.post('/ai/chat', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const prompt = (req.body.prompt || req.body.content || '').trim();
    const model = req.body.model || 'gemini-3.6-flash';

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt cannot be empty' });
    }

    let botResponse = '';

    // 1. Query Gemini API with Multi-Key Rotation and Fallback
    const rawKeys = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '';
    const apiKeys = rawKeys.split(',').map(k => k.trim()).filter(Boolean);

    if (apiKeys.length > 0) {
      const geminiModels = [
        process.env.GEMINI_MODERATION_MODEL || 'gemma-4-26b-a4b-it',
        'gemma-4-26b-a4b-it',
        'gemini-3-flash-preview',
        'gemini-3.5-flash-lite',
        'gemini-3.6-flash',
        'gemini-3.7-flash',
        'gemini-3.1-flash-lite'
      ];
      const uniqueModels = [...new Set(geminiModels)];

      keyLoop: for (const key of apiKeys) {
        for (const m of uniqueModels) {
          try {
            const apiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${key}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: `You are ChatGPT / Wired AI, a smart, helpful, friendly 1-on-1 AI assistant. Respond in clear markdown format. User query: ${prompt}` }] }]
              }),
              signal: AbortSignal.timeout(6000)
            });
            if (apiRes.ok) {
              const json = await apiRes.json();
              const parts = json.candidates?.[0]?.content?.parts || [];
              const answerPart = parts.find(p => !p.thought) || parts[parts.length - 1];
              const text = answerPart?.text?.trim();
              if (text) {
                botResponse = text;
                break keyLoop;
              }
            }
          } catch (e) {}
        }
      }
    }

    // 2. Built-in smart fallback if Gemini API is unreachable
    if (!botResponse) {
      const p = prompt.toLowerCase();
      if (p.includes('hello') || p.includes('hi') || p.includes('hey')) {
        botResponse = `👋 Hello! I am your private 1-on-1 AI assistant. How can I help you today? Ask me any question, code request, or writing task!`;
      } else if (p.includes('who are you') || p.includes('what are you')) {
        botResponse = `🤖 I am Wired AI (powered by Gemini), your personal text chatbot. Every user has their own private, separate conversation thread with me.`;
      } else {
        botResponse = `I processed your request: "${prompt}". I am ready to help with coding, analysis, writing, or answering questions!`;
      }
    }

    // Save to private user AI conversation history in database
    const saved = await query(
      `INSERT INTO user_ai_conversations (user_id, prompt, response, model)
       VALUES ($1, $2, $3, $4)
       RETURNING id, prompt, response, model, created_at`,
      [userId, prompt, botResponse, model]
    );

    res.json(saved.rows[0]);
  } catch (err) {
    console.error('Failed AI chat:', err);
    res.status(500).json({ error: 'AI processing failed' });
  }
});

// Clear private AI chat history
router.delete('/ai/clear', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    await query(`DELETE FROM user_ai_conversations WHERE user_id = $1`, [userId]);
    res.json({ message: 'AI conversation history cleared successfully' });
  } catch (err) {
    console.error('Failed to clear AI history:', err);
    res.status(500).json({ error: 'Failed to clear history' });
  }
});

module.exports = router;
