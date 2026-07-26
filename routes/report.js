const express = require('express');
const { query } = require('../db/database');
const { authMiddleware, adminCheck } = require('../middleware/auth');

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
      `SELECT r.id, r.user_id, COALESCE(u.username, 'Anonymous') AS username, r.description, r.screenshot_url, r.status, r.created_at
       FROM reports r
       LEFT JOIN users u ON r.user_id = u.id
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

// POST /api/global-report - user submits a global bug/glitch report (with Gemini AI evaluation)
router.post('/global-report', authMiddleware, async (req, res) => {
  const { description } = req.body;
  if (!description || !description.trim()) {
    return res.status(400).json({ error: 'Description is required' });
  }

  let aiEvaluation = 'unevaluated';
  let reportStatus = 'open';

  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    try {
      const prompt = `You are a software bug report triage assistant. Read the user's description and evaluate if it contains a legitimate bug, glitch, system error, UI issue, crash, performance problem, or technical defect (e.g., 'the screen freezes', 'can't send DMs', 'getting 502 error', 'the delete button does not work').
      
      If it is a real technical problem description, respond with 'LEGITIMATE'.
      If it is spam, test, greeting, casual chatter, gibberish, or nonsense (e.g., 'hello', 'test', 'asdf', 'yo', 'great app'), respond with 'SPAM'.

      User description: "${description.trim()}"

      Respond with a JSON object in this exact format:
      {
        "evaluation": "LEGITIMATE" or "SPAM"
      }`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' }
        })
      });

      if (response.ok) {
        const json = await response.json();
        const textResponse = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const parsed = JSON.parse(textResponse.trim());
        if (parsed && (parsed.evaluation === 'LEGITIMATE' || parsed.evaluation === 'SPAM')) {
          aiEvaluation = parsed.evaluation;
          if (aiEvaluation === 'SPAM') {
            reportStatus = 'rejected';
          }
        }
      }
    } catch (err) {
      console.error('Failed to evaluate report with Gemini:', err);
    }
  }

  try {
    await query(
      `INSERT INTO reports (user_id, description, status, ai_evaluation) VALUES ($1, $2, $3, $4)`,
      [req.userId, description.trim(), reportStatus, aiEvaluation]
    );
    res.json({ 
      message: 'Bug report submitted successfully', 
      ai_evaluation: aiEvaluation,
      status: reportStatus
    });
  } catch (err) {
    console.error('Failed to insert global report:', err);
    res.status(500).json({ error: 'Failed to submit bug report' });
  }
});

// POST /public-report - public bug report (no auth required)
router.post('/public-report', async (req, res) => {
  const { description } = req.body;
  if (!description || !description.trim()) {
    return res.status(400).json({ error: 'Description is required' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    try {
      const prompt = `You are a software bug report triage assistant. Read the user's description and evaluate if it contains a legitimate bug, glitch, system error, UI issue, crash, performance problem, or technical defect.
      
      If it is a real technical problem description, respond with 'LEGITIMATE'.
      If it is spam, test, casual chatter, nonsense, gibberish, or anything stupid/silly (e.g., 'hello', 'test', 'asdf', 'you suck', 'silly app', 'yo'), respond with 'SPAM'.

      User description: "${description.trim()}"

      Respond with a JSON object in this exact format:
      {
        "evaluation": "LEGITIMATE" or "SPAM"
      }`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' }
        })
      });

      if (response.ok) {
        const json = await response.json();
        const textResponse = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const parsed = JSON.parse(textResponse.trim());
        if (parsed && parsed.evaluation === 'SPAM') {
          // Discard it (delete it) and return a 400 bad request rejecting it
          return res.status(400).json({ error: 'AI classified your report as SPAM or casual chatter. Discarding.' });
        }
      }
    } catch (err) {
      console.error('Failed to evaluate public report with Gemini:', err);
    }
  }

  try {
    await query(
      `INSERT INTO reports (user_id, description, status, ai_evaluation) VALUES ($1, $2, $3, $4)`,
      [null, description.trim(), 'open', 'LEGITIMATE']
    );
    res.json({ message: 'Bug report submitted successfully!' });
  } catch (err) {
    console.error('Failed to insert public report:', err);
    res.status(500).json({ error: 'Failed to submit bug report' });
  }
});

module.exports = router;
