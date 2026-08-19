const { getServerStatus } = require('../../utils/minecraftManager');
const { initDB } = require('../../db/database');

let dbReady = false;
let dbPromise = null;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, bypass-tunnel-reminder');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (!dbReady) {
      if (!dbPromise) {
        dbPromise = initDB().then(() => { dbReady = true; }).catch(err => console.error(err));
      }
      await dbPromise;
    }

    const status = await getServerStatus();
    return res.json(status);
  } catch (err) {
    console.error('Failed to get Minecraft server status:', err);
    return res.status(500).json({ error: 'Failed to retrieve server status' });
  }
};
