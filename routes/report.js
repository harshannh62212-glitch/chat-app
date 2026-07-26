const express = require('express');
const { query } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');
const { adminCheck } = require('../middleware/adminCheck'); // if separate file, else import from admin.js

const router = express.Router();

// POST /report - user submits a bug report
router.post('/report', authMiddleware, async (req, res) => {
  const { description, screenshot_url } = req.body;
  if (!description || !description.trim()) {
    return res.status(400).json({ error: 'Description is required' });
  }
  try {
    await query(
      `INSERT INTO reports (user_id, description, screenshot_url) VALUES ($1, $2, $3)`,
      [req.userId, description.trim(), screenshot_url || null]
    );
    res.json({ message: 'Report submitted successfully' });
  } catch (err) {
    console.error('Failed to insert report:', err);
    res.status(500).json({ error: 'Failed to submit report' });
  }
});

// GET /admin/reports - admin fetches all reports
router.get('/admin/reports', authMiddleware, adminCheck, async (req, res) => {
  try {
    const result = await query(
      `SELECT r.id, r.user_id, u.username, r.description, r.screenshot_url, r.status, r.created_at
       FROM reports r
       JOIN users u ON r.user_id = u.id
       ORDER BY r.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Failed to fetch reports:', err);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

// PATCH /admin/reports/:id - admin updates status (e.g., resolve)
router.patch('/admin/reports/:id', authMiddleware, adminCheck, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!status) {
    return res.status(400).json({ error: 'Status is required' });
  }
  try {
    await query(`UPDATE reports SET status = $1 WHERE id = $2`, [status, id]);
    res.json({ message: 'Report status updated' });
  } catch (err) {
    console.error('Failed to update report status:', err);
    res.status(500).json({ error: 'Failed to update report' });
  }
});

module.exports = router;
