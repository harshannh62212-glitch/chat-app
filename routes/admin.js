const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Helper to check if admin
const isAdmin = async (userId) => {
  const result = await query('SELECT is_admin, username FROM users WHERE id = $1', [userId]);
  const user = result.rows[0];
  return user && (user.is_admin || user.username === 'Nxghtmare3621');
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
      `SELECT id, username, email, is_admin, timeout_until, created_at 
       FROM users 
       ORDER BY username ASC`
    );
    // Add active ban status
    const bansResult = await query('SELECT user_id FROM bans WHERE server_id IS NULL');
    const bannedUserIds = new Set(bansResult.rows.map(r => r.user_id));
    
    const users = result.rows.map(user => ({
      ...user,
      is_banned: bannedUserIds.has(user.id)
    }));
    
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// 2. Ban user globally
router.post('/users/:id/ban', authMiddleware, adminCheck, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    // Remove any existing global ban first to avoid duplicates
    await query('DELETE FROM bans WHERE user_id = $1 AND server_id IS NULL', [id]);

    // Insert into bans (global ban has server_id = null)
    await query(
      `INSERT INTO bans (user_id, server_id, reason) 
       VALUES ($1, NULL, $2)`,
      [id, reason || 'Global ban by Administrator']
    );
    
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
    await query('DELETE FROM bans WHERE user_id = $1 AND server_id IS NULL', [id]);
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
    const { durationMinutes } = req.body; // duration in minutes
    
    const timeoutUntil = new Date(Date.now() + durationMinutes * 60 * 1000);
    
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
router.post('/users/:id/kick-all', authMiddleware, adminCheck, async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM server_members WHERE user_id = $1', [id]);
    res.json({ message: 'User kicked from all servers' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to kick user' });
  }
});

// 7. List all servers
router.get('/servers', authMiddleware, adminCheck, async (req, res) => {
  try {
    const result = await query(
      `SELECT s.id, s.name, s.description, s.is_public, s.created_at, u.username as owner_name 
       FROM servers s 
       INNER JOIN users u ON s.owner_id = u.id 
       ORDER BY s.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch servers' });
  }
});

// 8. Delete server
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

// 9. List custom banned words
router.get('/words', authMiddleware, adminCheck, async (req, res) => {
  try {
    const result = await query('SELECT word FROM banned_words ORDER BY word ASC');
    res.json(result.rows.map(r => r.word));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch banned words' });
  }
});

// 10. Add custom banned word
router.post('/words', authMiddleware, adminCheck, async (req, res) => {
  try {
    const { word } = req.body;
    if (!word || !word.trim()) {
      return res.status(400).json({ error: 'Word is required' });
    }
    
    const formattedWord = word.trim().toLowerCase();
    await query('INSERT INTO banned_words (word) VALUES ($1) ON CONFLICT DO NOTHING', [formattedWord]);
    
    // Refresh content filter cache
    const { loadCustomBannedWords } = require('../utils/contentFilter');
    await loadCustomBannedWords();
    
    res.json({ message: `Word "${formattedWord}" added to blacklist` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add word' });
  }
});

// 11. Delete custom banned word
router.delete('/words/:word', authMiddleware, adminCheck, async (req, res) => {
  try {
    const { word } = req.params;
    await query('DELETE FROM banned_words WHERE word = $1', [word.toLowerCase()]);
    
    // Refresh content filter cache
    const { loadCustomBannedWords } = require('../utils/contentFilter');
    await loadCustomBannedWords();
    
    res.json({ message: 'Word removed from blacklist' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete word' });
  }
});

// 12. Toggle user admin status (requires Nxghtmare3621's password to authorize)
router.post('/users/:id/toggle-admin', authMiddleware, adminCheck, async (req, res) => {
  try {
    const { id } = req.params;
    const { adminPassword, makeAdmin } = req.body;

    if (!adminPassword) {
      return res.status(400).json({ error: 'Super-admin verification password is required' });
    }

    // Fetch super-admin (Nxghtmare3621) password hash from database
    const superAdminResult = await query("SELECT password FROM users WHERE username = 'Nxghtmare3621'");
    const superAdmin = superAdminResult.rows[0];

    if (!superAdmin) {
      return res.status(500).json({ error: 'Super-admin account not found' });
    }

    // Verify password matches Nxghtmare3621's hash
    const passwordMatch = await bcrypt.compare(adminPassword, superAdmin.password);
    if (!passwordMatch) {
      return res.status(403).json({ error: 'Verification failed: Incorrect super-admin password' });
    }

    // Update user role
    await query('UPDATE users SET is_admin = $1 WHERE id = $2', [makeAdmin === true, id]);

    res.json({ 
      message: `User administrative privileges ${makeAdmin ? 'granted' : 'revoked'} successfully` 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update admin role status' });
  }
});

module.exports = router;
