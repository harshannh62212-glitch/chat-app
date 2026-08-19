const { authMiddleware, adminCheck } = require('../../middleware/auth');
const { executeCommand } = require('../../utils/minecraftManager');
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

    const { command } = req.body || {};
    if (!command || !command.trim()) {
      return res.status(400).json({ error: 'Command cannot be empty' });
    }

    const result = await executeCommand(command.trim());
    return res.json({
      success: true,
      response: result.response || 'Command executed',
      method: result.method
    });
  } catch (err) {
    if (res.headersSent) return;
    console.error('Failed to execute command:', err);
    return res.status(err.status || 500).json({ error: err.message || 'Failed to execute command' });
  }
};
