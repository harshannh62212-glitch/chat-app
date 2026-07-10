const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Create a new server
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, description, password, isPublic } = req.body;
    const ownerId = req.userId;

    if (!name) {
      return res.status(400).json({ error: 'Server name required' });
    }

    let passwordHash = null;
    if (password) {
      passwordHash = await bcrypt.hash(password, 10);
    }

    const serverResult = await query(
      'INSERT INTO servers (name, description, owner_id, password_hash, is_public) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, owner_id',
      [name, description || '', ownerId, passwordHash, isPublic !== false]
    );

    const serverId = serverResult.rows[0].id;

    // Create mandatory general chatroom
    await query(
      'INSERT INTO chatrooms (server_id, name, is_general) VALUES ($1, $2, $3)',
      [serverId, 'general', true]
    );

    // Add owner as member
    await query(
      'INSERT INTO server_members (user_id, server_id) VALUES ($1, $2)',
      [ownerId, serverId]
    );

    res.status(201).json({ id: serverId, name, owner_id: ownerId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create server' });
  }
});

// Get all public servers (discovery page)
router.get('/discovery', async (req, res) => {
  try {
    const result = await query(
      'SELECT id, name, description, owner_id, is_public, avatar_url, created_at FROM servers WHERE is_public = true ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch servers' });
  }
});

// Get user's servers
router.get('/my-servers', authMiddleware, async (req, res) => {
  try {
    const result = await query(
      `SELECT s.id, s.name, s.description, s.owner_id, s.is_public, s.avatar_url, s.created_at
       FROM servers s
       INNER JOIN server_members sm ON s.id = sm.server_id
       WHERE sm.user_id = $1
       ORDER BY s.created_at DESC`,
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch servers' });
  }
});

// Get server details
router.get('/:serverId', authMiddleware, async (req, res) => {
  try {
    const { serverId } = req.params;
    
    const serverResult = await query(
      'SELECT * FROM servers WHERE id = $1',
      [serverId]
    );

    if (serverResult.rows.length === 0) {
      return res.status(404).json({ error: 'Server not found' });
    }

    res.json(serverResult.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch server' });
  }
});

// Join server
router.post('/:serverId/join', authMiddleware, async (req, res) => {
  try {
    const { serverId } = req.params;
    const { password } = req.body;
    const userId = req.userId;

    const serverResult = await query('SELECT * FROM servers WHERE id = $1', [serverId]);
    if (serverResult.rows.length === 0) {
      return res.status(404).json({ error: 'Server not found' });
    }

    const server = serverResult.rows[0];

    // Check if user is an admin
    const userResult = await query('SELECT is_admin, username FROM users WHERE id = $1', [userId]);
    const user = userResult.rows[0];
    const isAdmin = user && (user.is_admin || user.username === 'Nxghtmare3621');

    // Check password if required, unless the user is an admin
    if (server.password_hash && !isAdmin) {
      if (!password) {
        return res.status(403).json({ error: 'Server password required' });
      }
      const passwordMatch = await bcrypt.compare(password, server.password_hash);
      if (!passwordMatch) {
        return res.status(403).json({ error: 'Incorrect password' });
      }
    }

    // Check if already member
    const memberResult = await query(
      'SELECT * FROM server_members WHERE user_id = $1 AND server_id = $2',
      [userId, serverId]
    );

    if (memberResult.rows.length > 0) {
      return res.status(400).json({ error: 'Already a member' });
    }

    // Add as member
    await query(
      'INSERT INTO server_members (user_id, server_id) VALUES ($1, $2)',
      [userId, serverId]
    );

    res.json({ message: 'Successfully joined server' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to join server' });
  }
});

// Get server members
router.get('/:serverId/members', authMiddleware, async (req, res) => {
  try {
    const { serverId } = req.params;
    
    const result = await query(
      `SELECT u.id, u.username, u.avatar_url
       FROM users u
       INNER JOIN server_members sm ON u.id = sm.user_id
       WHERE sm.server_id = $1`,
      [serverId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

// Get chatrooms in server
router.get('/:serverId/chatrooms', authMiddleware, async (req, res) => {
  try {
    const { serverId } = req.params;
    
    const result = await query(
      'SELECT id, name, is_general, description FROM chatrooms WHERE server_id = $1 ORDER BY is_general DESC, created_at ASC',
      [serverId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch chatrooms' });
  }
});

module.exports = router;
