const { query } = require('../../../db/database');
const { initDB } = require('../../../db/database');

let dbReady = false;
let dbPromise = null;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (!dbReady) {
      if (!dbPromise) {
        dbPromise = initDB().then(() => { dbReady = true; }).catch(err => console.error(err));
      }
      await dbPromise;
    }

    const pending = await query(
      "SELECT id, command FROM minecraft_bridge_queue WHERE status = 'pending' ORDER BY id ASC LIMIT 10"
    );
    if (pending.rows.length > 0) {
      const ids = pending.rows.map(r => r.id);
      await query(
        "UPDATE minecraft_bridge_queue SET status = 'processing' WHERE id = ANY($1::int[])",
        [ids]
      );
    }
    return res.json({ success: true, commands: pending.rows });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
