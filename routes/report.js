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

// AI Report Evaluator helper (Local Ollama llama3.2:3b with Gemini fallback)
async function evaluateReport(description) {
  const prompt = `You are a professional software QA triage assistant. You are an expert at identifying high-quality bug reports.

Classify as LEGITIMATE if the report contains:
- A specific, reproducible, or descriptive technical issue
- Clear steps to reproduce, expected vs actual behavior, or diagnostic details
- Evidence of a genuine functional defect, UI glitch, or performance bottleneck

Classify as SPAM if the report:
- Contains casual greeting, idle chit-chat, or "hello"
- Is unintelligible, nonsense characters, or repeated symbols
- Is offensive, toxic, or abusive content
- Is a placeholder or incomplete message (e.g., "test", "...", "bug")

User report: "${description.trim()}"

Respond ONLY with this JSON:
{ "evaluation": "LEGITIMATE" or "SPAM" }`;

  // 1. Try local Ollama (llama3.2:3b) first
  try {
    const response = await fetch('http://host.docker.internal:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3.2:3b',
        prompt: prompt,
        format: 'json',
        stream: false
      })
    });

    if (response.ok) {
      const json = await response.json();
      const parsed = JSON.parse(json.response.trim());
      if (parsed && (parsed.evaluation === 'LEGITIMATE' || parsed.evaluation === 'SPAM')) {
        console.log(`[AI EVALUATION - OLLAMA] Local model evaluated report: ${parsed.evaluation}`);
        return parsed.evaluation;
      }
    }
  } catch (err) {
    console.warn('[OLLAMA] Local model unavailable, falling back to Gemini:', err.message);
  }

  // 2. Fallback to Gemini
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    try {
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
          console.log(`[AI EVALUATION - GEMINI] Gemini fallback evaluated report: ${parsed.evaluation}`);
          return parsed.evaluation;
        }
      }
    } catch (err) {
      console.error('[GEMINI] Fallback evaluation failed:', err.message);
    }
  }

  return 'unevaluated';
}

// POST /api/global-report - user submits a global bug/glitch report (with local AI evaluation)
router.post('/global-report', authMiddleware, async (req, res) => {
  const { description } = req.body;
  if (!description || !description.trim()) {
    return res.status(400).json({ error: 'Description is required' });
  }

  const aiEvaluation = await evaluateReport(description);
  const reportStatus = aiEvaluation === 'SPAM' ? 'rejected' : 'open';

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

  // Quick basic sanity check (no AI, instant) - reject obviously empty/short inputs
  const trimmed = description.trim();
  if (trimmed.length < 10) {
    return res.status(400).json({ error: 'Please provide more detail in your bug report.' });
  }

  // INSERT immediately so the user gets instant feedback
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

  // AI evaluation happens AFTER response is sent (non-blocking)
  if (reportId) {
    setImmediate(async () => {
      try {
        const aiEvaluation = await evaluateReport(trimmed);
        if (aiEvaluation === 'SPAM') {
          // Delete the row — spam is discarded silently
          await query(`DELETE FROM reports WHERE id = $1`, [reportId]);
          console.log(`[SPAM FILTER] Async-deleted spam report id=${reportId}: "${trimmed.substring(0, 60)}"`);
        } else {
          // Update status to open now that AI confirmed it's legitimate
          await query(
            `UPDATE reports SET status = 'open', ai_evaluation = $1 WHERE id = $2`,
            [aiEvaluation, reportId]
          );
        }
      } catch (err) {
        console.error(`[SPAM FILTER] Async evaluation failed for report ${reportId}:`, err.message);
        // Leave as 'pending' — admin can review manually
      }
    });
  }
});

module.exports = router;
