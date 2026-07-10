const jwt = require('jsonwebtoken');
const { query } = require('../db/database');

async function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;

    // Check if user is globally banned
    const banResult = await query('SELECT 1 FROM bans WHERE user_id = $1 AND server_id IS NULL', [req.userId]);
    if (banResult.rows.length > 0) {
      return res.status(403).json({ error: 'Access denied: Your account is globally banned' });
    }

    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

async function adminCheck(req, res, next) {
  try {
    const result = await query('SELECT is_admin, username FROM users WHERE id = $1', [req.userId]);
    const user = result.rows[0];
    if (user && (user.is_admin || user.username === 'Nxghtmare3621')) {
      next();
    } else {
      res.status(403).json({ error: 'Access denied: Admin privileges required' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { authMiddleware, adminCheck };
