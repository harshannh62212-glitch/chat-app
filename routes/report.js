const express = require('express');
const { query } = require('../db/database');
const { authMiddleware, adminCheck } = require('../middleware/auth');

const router = express.Router();

// POST /report - user submits a bug/message report (with local AI evaluation)
router.post('/report', authMiddleware, async (req, res) => {
  const description = req.body.description || req.body.reason || req.body.content;
  const screenshot_url = req.body.screenshot_url || req.body.screenshotUrl;
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

// Robust JSON extractor for LLM outputs
function parseJsonFromLlm(rawText) {
  if (!rawText || typeof rawText !== 'string') return null;
  const trimmed = rawText.trim();
  try {
    return JSON.parse(trimmed);
  } catch (e) {
    const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (codeBlockMatch && codeBlockMatch[1]) {
      try {
        return JSON.parse(codeBlockMatch[1].trim());
      } catch (e2) {}
    }
    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
      } catch (e3) {}
    }
    const firstBracket = trimmed.indexOf('[');
    const lastBracket = trimmed.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket > firstBracket) {
      try {
        return JSON.parse(trimmed.slice(firstBracket, lastBracket + 1));
      } catch (e4) {}
    }
  }
  return null;
}

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

  // 1. Try local Ollama with dynamic model lookup and generous timeout
  try {
    let localModel = 'qwen2.5-coder:7b';
    try {
      const tagsRes = await fetch('http://127.0.0.1:11434/api/tags', { signal: AbortSignal.timeout(2000) });
      if (tagsRes.ok) {
        const tagsData = await tagsRes.json();
        if (tagsData?.models?.length > 0) {
          const pref = tagsData.models.find(m => m.name.includes('llama3.2:1b')) ||
                       tagsData.models.find(m => m.name.includes('llama3.2')) ||
                       tagsData.models.find(m => m.name.includes('gemma3')) ||
                       tagsData.models.find(m => m.name.includes('llama')) ||
                       tagsData.models.find(m => m.name.includes('qwen2.5-coder:7b')) ||
                       tagsData.models.find(m => m.name.includes('qwen'));
          localModel = pref ? pref.name : tagsData.models[0].name;
        }
      }
    } catch (e) {}

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch('http://127.0.0.1:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: localModel,
        prompt: prompt,
        format: 'json',
        stream: false,
        options: { temperature: 0.0 }
      })
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const json = await response.json();
      const parsed = parseJsonFromLlm(json.response);
      const ev = parsed?.evaluation?.toUpperCase();
      if (['LEGITIMATE', 'VAGUE', 'SPAM', 'ABUSIVE'].includes(ev)) {
        console.log(`[AI EVALUATION - OLLAMA] Local model (${localModel}) evaluated report: ${ev}`);
        return ev;
      }
    }
  } catch (err) {
    // Silent fail to move quickly to Gemini
  }

  // 2. Fallback to Gemini
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    const geminiModels = [
      process.env.GEMINI_MODERATION_MODEL || 'gemini-3.1-flash-lite',
      'gemini-3.1-flash-lite',
      'gemini-3.6-flash',
      'gemini-3.7-flash',
      'gemini-3.5-flash-lite'
    ];
    for (const model of [...new Set(geminiModels)]) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
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
          const parts = json.candidates?.[0]?.content?.parts || [];
          const answerPart = parts.find(p => !p.thought) || parts[parts.length - 1];
          const textResponse = answerPart?.text || '';
          const parsed = parseJsonFromLlm(textResponse);
          const ev = parsed?.evaluation?.toUpperCase();
          if (['LEGITIMATE', 'VAGUE', 'SPAM', 'ABUSIVE'].includes(ev)) {
            console.log(`[AI EVALUATION - GEMINI] Gemini (${model}) evaluated report: ${ev}`);
            return ev;
          }
        }
      } catch (err) {
        // Try next model
      }
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
