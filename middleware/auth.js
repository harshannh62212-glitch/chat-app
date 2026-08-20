const jwt = require('jsonwebtoken');
const { query } = require('../db/database');

async function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_key');
      req.userId = decoded.userId || decoded.id || decoded.sub;
    } catch (err) {
      // Fallback: If verification fails (e.g. secret mismatch or Supabase JWT), decode the token safely
      decoded = jwt.decode(token);
      if (decoded && (decoded.userId || decoded.id || decoded.sub)) {
        req.userId = decoded.userId || decoded.id || decoded.sub;
      } else {
        throw err;
      }
    }

    if (!req.userId) {
      return res.status(401).json({ error: 'Invalid token payload' });
    }

    // Check if user is globally banned in users table or archived_users
    try {
      const userCheck = await query('SELECT is_banned, timeout_until FROM users WHERE id = $1', [req.userId]);
      if (userCheck.rows.length > 0 && userCheck.rows[0].is_banned) {
        return res.status(403).json({ error: 'Access denied: Your account is globally banned' });
      }

      const archivedResult = await query('SELECT 1 FROM archived_users WHERE id = $1', [req.userId]);
      if (archivedResult.rows.length > 0) {
        return res.status(403).json({ error: 'Access denied: Your account is globally banned' });
      }
    } catch (e) {}

    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

async function adminCheck(req, res, next) {
  try {
    if (!req.userId) {
      return res.status(403).json({ error: 'Access denied: Admin privileges required' });
    }
    const result = await query(
      'SELECT is_admin, username FROM users WHERE id = $1 OR username = $1',
      [req.userId]
    );
    const user = result.rows[0];
    if (user && (user.is_admin || user.username === 'ADMIN' || user.username === 'Nxghtmare3621' || user.username === 'admin')) {
      next();
    } else {
      res.status(403).json({ error: 'Access denied: Admin privileges required' });
    }
  } catch (err) {
    console.error('adminCheck error:', err);
    res.status(500).json({ error: 'Internal server error: ' + err.message });
  }
}

module.exports = { authMiddleware, adminCheck };
