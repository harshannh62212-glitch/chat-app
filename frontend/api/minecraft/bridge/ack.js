const { query } = require('../../../db/database');
const { initDB } = require('../../../db/database');

let dbReady = false;
let dbPromise = null;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (!dbReady) {
      if (!dbPromise) {
        dbPromise = initDB().then(() => { dbReady = true; }).catch(err => console.error(err));
      }
      await dbPromise;
    }

    const { id, response } = req.body || {};
    if (id) {
      await query(
        "UPDATE minecraft_bridge_queue SET status = 'completed', response = $1, executed_at = NOW() WHERE id = $2",
        [response || 'OK', id]
      );
    }
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
