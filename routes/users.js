const express = require('express');
const { query } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Search users
router.get('/search', authMiddleware, async (req, res) => {
  try {
    const { q } = req.query;

    let result;
    if (!q || q.trim() === '') {
      // Return all users (excluding current user)
      result = await query(
        `SELECT id, username, avatar_url 
         FROM users 
         WHERE id != $1 
         ORDER BY username ASC 
         LIMIT 50`,
        [req.userId]
      );
    } else {
      // Search users matching query (excluding current user)
      result = await query(
        `SELECT id, username, avatar_url 
         FROM users 
         WHERE username ILIKE $1 AND id != $2 
         LIMIT 10`,
        [`%${q}%`, req.userId]
      );
    }

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

// Get user profile
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await query(
      'SELECT id, username, avatar_url, created_at FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Update user profile avatar URL
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { avatarUrl } = req.body;
    await query(
      'UPDATE users SET avatar_url = $1 WHERE id = $2',
      [avatarUrl || null, req.userId]
    );
    res.json({ message: 'Profile updated successfully', avatar_url: avatarUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

module.exports = router;
