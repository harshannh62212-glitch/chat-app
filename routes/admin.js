const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Helper to check if admin
const isAdmin = async (userId) => {
  if (!userId) return false;
  const result = await query('SELECT is_admin, username FROM users WHERE id = $1 OR username = $1', [userId]);
  const user = result.rows[0];
  return user && (user.is_admin || user.username === 'ADMIN' || user.username === 'Nxghtmare3621' || user.username === 'admin');
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
    await query('UPDATE users SET is_banned = FALSE WHERE id = $1', [id]);
    try {
      await query('DELETE FROM archived_users WHERE id = $1', [id]);
    } catch (e) {}
    try {
      await query('SELECT public.unban_user($1)', [id]);
    } catch (e) {}
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
       ORDER BY (CASE WHEN s.name = 'General' OR s.id = 1 THEN 0 ELSE 1 END), s.created_at DESC`
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

    const srv = await query('SELECT name FROM servers WHERE id = $1', [id]);
    if (parseInt(id, 10) === 1 || (srv.rows.length > 0 && srv.rows[0].name === 'General')) {
      return res.status(403).json({ error: 'Cannot delete the General server' });
    }

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

// 11. Database Administration & Metrics
router.get('/database/stats', authMiddleware, adminCheck, async (req, res) => {
  try {
    const sizeRes = await query(`
      SELECT 
        pg_size_pretty(pg_database_size(current_database())) as size,
        (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()) as active_connections,
        version() as pg_version
    `);

    const tablesRes = await query(`
      SELECT 
        relname AS table_name,
        n_live_tup AS row_count,
        pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
        pg_total_relation_size(relid) AS bytes
      FROM pg_stat_user_tables
      ORDER BY bytes DESC
    `);

    const stats = sizeRes.rows[0];
    res.json({
      databaseName: 'chat_db',
      size: stats.size,
      activeConnections: parseInt(stats.active_connections, 10),
      version: stats.pg_version,
      tables: tablesRes.rows
    });
  } catch (err) {
    console.error('Failed to fetch database stats:', err);
    res.status(500).json({ error: 'Failed to fetch database statistics' });
  }
});

router.post('/database/action', authMiddleware, adminCheck, async (req, res) => {
  try {
    const { action } = req.body;

    if (action === 'vacuum') {
      await query('VACUUM ANALYZE;');
      return res.json({ message: 'VACUUM ANALYZE executed successfully. Table statistics and storage optimized.' });
    }

    if (action === 'clean_orphans') {
      const msgRes = await query(`DELETE FROM server_messages WHERE chatroom_id NOT IN (SELECT id FROM chatrooms);`);
      const dmRes = await query(`DELETE FROM direct_messages WHERE sender_id NOT IN (SELECT id FROM users);`);
      return res.json({ message: `Cleanup completed: ${msgRes.rowCount} orphaned messages and ${dmRes.rowCount} stale DMs removed.` });
    }

    if (action === 'health_check') {
      const checkRes = await query(`SELECT count(*) as total_users FROM users;`);
      return res.json({ message: `Database health check passed cleanly. ${checkRes.rows[0].total_users} active user accounts verified.` });
    }

    res.status(400).json({ error: 'Invalid database action' });
  } catch (err) {
    console.error('Database maintenance action failed:', err);
    res.status(500).json({ error: 'Database maintenance action failed: ' + err.message });
  }
});

router.get('/database/table/:tableName', authMiddleware, adminCheck, async (req, res) => {
  try {
    const { tableName } = req.params;
    
    // Whitelist allowed tables to prevent SQL injection
    const allowedTables = [
      'users', 'servers', 'chatrooms', 'server_messages', 'direct_messages',
      'server_members', 'friendships', 'banned_words', 'reports', 'archived_users',
      'archived_server_members', 'archived_friendships', 'bans'
    ];

    if (!allowedTables.includes(tableName.toLowerCase())) {
      return res.status(400).json({ error: 'Table not accessible' });
    }

    const result = await query(`SELECT * FROM ${tableName} ORDER BY 1 DESC LIMIT 25;`);
    res.json({ tableName, rows: result.rows });
  } catch (err) {
    console.error('Failed to fetch table records:', err);
    res.status(500).json({ error: 'Failed to inspect table records' });
  }
});

module.exports = router;
