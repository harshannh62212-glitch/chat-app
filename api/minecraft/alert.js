const { authMiddleware, adminCheck } = require('../../middleware/auth');
const { sendAlert } = require('../../utils/minecraftManager');
const { initDB } = require('../../db/database');

let dbReady = false;
let dbPromise = null;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, bypass-tunnel-reminder');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!dbReady) {
      if (!dbPromise) {
        dbPromise = initDB().then(() => { dbReady = true; }).catch(err => console.error(err));
      }
      await dbPromise;
    }

    await new Promise((resolve, reject) => {
      authMiddleware(req, res, (err1) => {
        if (err1) return reject(err1);
        adminCheck(req, res, (err2) => {
          if (err2) return reject(err2);
          resolve();
        });
      });
    });

    const { title, subtitle, level, playSound } = req.body || {};
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Alert title is required' });
    }

    const result = await sendAlert(
      title.trim(),
      subtitle ? subtitle.trim() : '',
      level || 'warning',
      playSound !== false
    );

    return res.json({
      success: true,
      message: 'Server alert broadcasted to all online players',
      details: result
    });
  } catch (err) {
    if (res.headersSent) return;
    console.error('Failed to send alert:', err);
    return res.status(err.status || 500).json({ error: err.message || 'Failed to send alert' });
  }
};
