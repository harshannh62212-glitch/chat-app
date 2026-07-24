const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Helper to check if admin
const isAdmin = async (userId) => {
  const result = await query('SELECT is_admin, username FROM users WHERE id = $1', [userId]);
  const user = result.rows[0];
  return user && (user.is_admin || user.username === 'ADMIN');
};

// Admin middleware inside router
const adminCheck = async (req, res, next) => {
  if (await isAdmin(req.userId)) {
    next();
  } else {
    res.status(403).json({ error: 'Access denied: Admin privileges required' });
  }
};

// 1. List all users
router.get('/users', authMiddleware, adminCheck, async (req, res) => {
  try {
    const result = await query(
      `SELECT id, username, email, is_admin, timeout_until, created_at, FALSE as is_banned 
       FROM users 
       UNION ALL
       SELECT id, username, email, is_admin, timeout_until, created_at, TRUE as is_banned 
       FROM archived_users
       ORDER BY username ASC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// 2. Ban user globally
router.post('/users/:id/ban', authMiddleware, adminCheck, async (req, res) => {
  try {
    const { id } = req.params;
    await query('UPDATE users SET is_banned = TRUE WHERE id = $1', [id]);
    res.json({ message: 'User banned globally' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to ban user' });
  }
});

// 3. Unban user globally
router.post('/users/:id/unban', authMiddleware, adminCheck, async (req, res) => {
  try {
    const { id } = req.params;
    await query('SELECT public.unban_user($1)', [id]);
    res.json({ message: 'User unbanned globally' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to unban user' });
  }
});

// 4. Timeout user
router.post('/users/:id/timeout', authMiddleware, adminCheck, async (req, res) => {
  try {
    const { id } = req.params;
    const { durationMinutes } = req.body;
    
    const timeoutUntil = new Date(Date.now() + (durationMinutes || 10) * 60 * 1000);
    
    await query(
      'UPDATE users SET timeout_until = $1 WHERE id = $2',
      [timeoutUntil, id]
    );
    
    res.json({ message: `User timed out until ${timeoutUntil.toLocaleString()}`, timeoutUntil });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to timeout user' });
  }
});

// 5. Remove timeout
router.post('/users/:id/untimeout', authMiddleware, adminCheck, async (req, res) => {
  try {
    const { id } = req.params;
    await query('UPDATE users SET timeout_until = NULL WHERE id = $1', [id]);
    res.json({ message: 'Timeout removed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to remove timeout' });
  }
});

// 6. Kick user from all servers
const kickUserHandler = async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM server_members WHERE user_id = $1', [id]);
    res.json({ message: 'User kicked from all servers' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to kick user' });
  }
};

router.delete('/users/:id/kick', authMiddleware, adminCheck, kickUserHandler);
router.post('/users/:id/kick-all', authMiddleware, adminCheck, kickUserHandler);

// 7. Toggle admin role
router.post('/users/:id/role', authMiddleware, adminCheck, async (req, res) => {
  try {
    const { id } = req.params;
    const { makeAdmin } = req.body;
    await query('UPDATE users SET is_admin = $1 WHERE id = $2', [makeAdmin === true, id]);
    res.json({ message: `User administrative privileges ${makeAdmin ? 'granted' : 'revoked'} successfully` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update admin role' });
  }
});

// 8. List all servers
router.get('/servers', authMiddleware, adminCheck, async (req, res) => {
  try {
    const result = await query(
      `SELECT s.id, s.name, s.description, s.is_public, s.created_at, COALESCE(u.username, 'System') as owner_name 
       FROM servers s 
       LEFT JOIN users u ON s.owner_id = u.id 
       ORDER BY s.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch servers' });
  }
});

// 9. Delete server
router.delete('/servers/:id', authMiddleware, adminCheck, async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM servers WHERE id = $1', [id]);
    res.json({ message: 'Server deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete server' });
  }
});

// 10. Word Filter Handlers
const getBannedWords = async (req, res) => {
  try {
    const result = await query('SELECT word FROM banned_words ORDER BY word ASC');
    res.json(result.rows.map(r => ({ word: r.word })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch banned words' });
  }
};

const addBannedWord = async (req, res) => {
  try {
    const { word } = req.body;
    if (!word || !word.trim()) {
      return res.status(400).json({ error: 'Word is required' });
    }
    const formattedWord = word.trim().toLowerCase();
    await query('INSERT INTO banned_words (word) VALUES ($1) ON CONFLICT DO NOTHING', [formattedWord]);
    res.json({ message: `Word "${formattedWord}" added to blacklist` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add word' });
  }
};

const deleteBannedWord = async (req, res) => {
  try {
    const { word } = req.params;
    await query('DELETE FROM banned_words WHERE word = $1', [word.toLowerCase()]);
    res.json({ message: 'Word removed from blacklist' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete word' });
  }
};

router.get('/words', authMiddleware, adminCheck, getBannedWords);
router.get('/banned-words', authMiddleware, adminCheck, getBannedWords);
router.post('/words', authMiddleware, adminCheck, addBannedWord);
router.post('/banned-words', authMiddleware, adminCheck, addBannedWord);
router.delete('/words/:word', authMiddleware, adminCheck, deleteBannedWord);
router.delete('/banned-words/:word', authMiddleware, adminCheck, deleteBannedWord);

module.exports = router;
