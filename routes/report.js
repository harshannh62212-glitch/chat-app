const express = require('express');
const { query } = require('../db/database');
const { authMiddleware, adminCheck } = require('../middleware/auth');

const router = express.Router();

// POST /report - user submits a bug/message report (with local AI evaluation)
router.post('/report', authMiddleware, async (req, res) => {
  const { description, screenshot_url } = req.body;
  if (!description || !description.trim()) {
    return res.status(400).json({ error: 'Description is required' });
  }

  const aiEvaluation = await evaluateReport(description);
  let reportStatus = 'open';
  if (aiEvaluation === 'SPAM' || aiEvaluation === 'ABUSIVE') {
    reportStatus = 'spam';
  } else if (aiEvaluation === 'VAGUE') {
    reportStatus = 'needs_info';
  }

  try {
    await query(
      `INSERT INTO reports (user_id, description, screenshot_url, status, ai_evaluation) VALUES ($1, $2, $3, $4, $5)`,
      [req.userId, description.trim(), screenshot_url || null, reportStatus, aiEvaluation]
    );
    res.json({
      message: 'Report submitted successfully',
      ai_evaluation: aiEvaluation,
      status: reportStatus
    });
  } catch (err) {
    console.error('Failed to insert report:', err);
    res.status(500).json({ error: 'Failed to submit report' });
  }
});

// GET /admin/reports - admin fetches all reports
router.get('/admin/reports', authMiddleware, adminCheck, async (req, res) => {
  try {
    const result = await query(
      `SELECT r.id, r.user_id, COALESCE(u.username, 'Anonymous') AS username, r.description, r.screenshot_url, r.status, r.ai_evaluation, r.created_at
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

// AI Report Evaluator helper (Local Ollama llama3.2:3b with Gemini fallback)
async function evaluateReport(description) {
  const prompt = `You are a professional software QA triage assistant. You are an expert at identifying high-quality bug reports.

Classify the user's report into one of these four categories:
1. LEGITIMATE: The report describes a specific, technical, reproducible, or descriptive functional defect, UI glitch, or performance bottleneck (e.g. "can't send DMs", "Spotify volume bar doesn't update").
2. VAGUE: The report lacks details, is too short, or is not actionable (e.g. "broken", "it doesn't work", "please help", "error").
3. SPAM: The report consists of casual greetings, idle chit-chat, nonsense characters, gibberish, or placeholders (e.g. "test", "hello", "...", "nice app").
4. ABUSIVE: The report contains offensive, toxic, or abusive language.

User report: "${description.trim()}"

Respond ONLY with this JSON structure:
{ "evaluation": "LEGITIMATE" | "VAGUE" | "SPAM" | "ABUSIVE" }`;

  // 1. Try local Ollama (llama3.2:3b) with a strict timeout to prevent hangs
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1200);

    const response = await fetch('http://127.0.0.1:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: 'llama3.2:3b',
        prompt: prompt,
        format: 'json',
        stream: false
      })
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const json = await response.json();
      const parsed = JSON.parse(json.response.trim());
      const ev = parsed?.evaluation?.toUpperCase();
      if (['LEGITIMATE', 'VAGUE', 'SPAM', 'ABUSIVE'].includes(ev)) {
        console.log(`[AI EVALUATION - OLLAMA] Local model evaluated report: ${ev}`);
        return ev;
      }
    }
  } catch (err) {
    // Silent fail to move quickly to Gemini
  }

  // 2. Fallback to Gemini
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' }
        })
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const json = await response.json();
        const textResponse = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const parsed = JSON.parse(textResponse.trim());
        const ev = parsed?.evaluation?.toUpperCase();
        if (['LEGITIMATE', 'VAGUE', 'SPAM', 'ABUSIVE'].includes(ev)) {
          console.log(`[AI EVALUATION - GEMINI] Gemini fallback evaluated report: ${ev}`);
          return ev;
        }
      }
    } catch (err) {
      console.error('[GEMINI] Fallback evaluation failed:', err.message);
    }
  }

  return 'LEGITIMATE'; // Default to legitimate to avoid false-positives when offline
}

// POST /api/global-report - user submits a global bug/glitch report (with local AI evaluation)
router.post('/global-report', authMiddleware, async (req, res) => {
  const { description } = req.body;
  if (!description || !description.trim()) {
    return res.status(400).json({ error: 'Description is required' });
  }

  const aiEvaluation = await evaluateReport(description);
  let reportStatus = 'open';
  if (aiEvaluation === 'SPAM' || aiEvaluation === 'ABUSIVE') {
    reportStatus = 'spam';
  } else if (aiEvaluation === 'VAGUE') {
    reportStatus = 'needs_info';
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

// POST /public-report - public bug report (no auth required, optimistic: accepts then evaluates async)
router.post('/public-report', async (req, res) => {
  const { description } = req.body;
  if (!description || !description.trim()) {
    return res.status(400).json({ error: 'Description is required' });
  }

  const trimmed = description.trim();
  if (trimmed.length < 10) {
    return res.status(400).json({ error: 'Please provide more detail in your bug report.' });
  }

  let reportId;
  try {
    const result = await query(
      `INSERT INTO reports (user_id, description, status, ai_evaluation) VALUES ($1, $2, $3, $4) RETURNING id`,
      [null, trimmed, 'pending', 'pending']
    );
    reportId = result.rows[0]?.id;
    res.json({ message: 'Bug report received! Our team will review it shortly.' });
  } catch (err) {
    console.error('Failed to insert public report:', err);
    return res.status(500).json({ error: 'Failed to submit bug report' });
  }

  if (reportId) {
    setImmediate(async () => {
      try {
        const aiEvaluation = await evaluateReport(trimmed);
        if (aiEvaluation === 'SPAM' || aiEvaluation === 'ABUSIVE') {
          await query(`DELETE FROM reports WHERE id = $1`, [reportId]);
          console.log(`[SPAM FILTER] Async-deleted spam/abusive report id=${reportId}: "${trimmed.substring(0, 60)}"`);
        } else {
          const reportStatus = aiEvaluation === 'VAGUE' ? 'needs_info' : 'open';
          await query(
            `UPDATE reports SET status = $1, ai_evaluation = $2 WHERE id = $3`,
            [reportStatus, aiEvaluation, reportId]
          );
        }
      } catch (err) {
        console.error(`[SPAM FILTER] Async evaluation failed for report ${reportId}:`, err.message);
      }
    });
  }
});

module.exports = router;
