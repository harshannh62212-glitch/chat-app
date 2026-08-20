const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');

const { containsBannedWords } = require('../utils/contentFilter');

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const trimmedUsername = username.trim();

    if (trimmedUsername.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters long' });
    }

    const { blocked, reason } = containsBannedWords(trimmedUsername);
    if (blocked) {
      return res.status(400).json({ error: 'Username contains prohibited words or inappropriate content' });
    }

    const existing = await query('SELECT 1 FROM users WHERE LOWER(username) = LOWER($1)', [trimmedUsername]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    const result = await query(
      'INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id, username',
      [username, `${username}@chat.local`, hashedPassword]
    );

    const user = result.rows[0];
    const token = jwt.sign(
      { userId: user.id }, 
      process.env.JWT_SECRET || 'fallback_secret_key'
    );

    // Auto-join General server on registration
    try {
      const generalServerResult = await query("SELECT id FROM servers WHERE name = 'General' OR id = 1 LIMIT 1");
      if (generalServerResult.rows.length > 0) {
        const generalServerId = generalServerResult.rows[0].id;
        await query(
          "INSERT INTO server_members (user_id, server_id) VALUES ($1, $2) ON CONFLICT (user_id, server_id) DO NOTHING",
          [user.id, generalServerId]
        );
      }
    } catch (err) {
      console.error('Failed to auto-join General server on registration:', err);
    }

    const isAdmin = Boolean(
      user.is_admin || 
      user.username === 'ADMIN' || 
      user.username === 'Nxghtmare3621' || 
      user.username === 'admin'
    );

    res.status(201).json({ 
      user: { 
        id: user.id, 
        username: user.username, 
        is_admin: isAdmin,
        description: ''
      }, 
      token 
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Username already exists' });
    }
    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const result = await query('SELECT * FROM users WHERE LOWER(username) = LOWER($1)', [username.trim()]);
    const user = result.rows[0];

    if (!user) {
      // Check if user is archived (globally banned)
      const archivedResult = await query('SELECT 1 FROM archived_users WHERE LOWER(username) = LOWER($1)', [username.trim()]);
      if (archivedResult.rows.length > 0) {
        return res.status(403).json({ error: 'Your account has been globally banned' });
      }
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.is_banned) {
      return res.status(403).json({ error: 'Your account has been globally banned' });
    }

    if (!user.password || typeof user.password !== 'string') {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Auto-join General server on login if missing
    try {
      const generalServerResult = await query("SELECT id FROM servers WHERE name = 'General' OR id = 1 LIMIT 1");
      if (generalServerResult.rows.length > 0) {
        const generalServerId = generalServerResult.rows[0].id;
        await query(
          "INSERT INTO server_members (user_id, server_id) VALUES ($1, $2) ON CONFLICT (user_id, server_id) DO NOTHING",
          [user.id, generalServerId]
        );
      }
    } catch (err) {
      console.error('Failed to auto-join General server on login:', err);
    }

    const token = jwt.sign(
      { userId: user.id }, 
      process.env.JWT_SECRET || 'fallback_secret_key'
    );

    const isAdmin = Boolean(
      user.is_admin || 
      user.username === 'ADMIN' || 
      user.username === 'Nxghtmare3621' || 
      user.username === 'admin'
    );

    res.json({ 
      user: { 
        id: user.id, 
        username: user.username, 
        avatar_url: user.avatar_url,
        description: user.description || user.bio || '',
        is_admin: isAdmin
      }, 
      token 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const result = await query(
      'SELECT id, username, email, avatar_url, description, is_admin, is_banned, timeout_until FROM users WHERE id = $1', 
      [req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const user = result.rows[0];
    user.is_admin = Boolean(
      user.is_admin || 
      user.username === 'ADMIN' || 
      user.username === 'Nxghtmare3621' || 
      user.username === 'admin'
    );
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

module.exports = router;
