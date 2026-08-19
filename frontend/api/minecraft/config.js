const { authMiddleware, adminCheck } = require('../../middleware/auth');
const { getMinecraftConfig, saveMinecraftConfig } = require('../../utils/minecraftManager');
const { initDB } = require('../../db/database');

let dbReady = false;
let dbPromise = null;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
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

    if (req.method === 'GET') {
      const config = await getMinecraftConfig();
      return res.json({
        host: config.host,
        port: config.port,
        rconHost: config.rconHost,
        rconPort: config.rconPort,
        hasRconPassword: !!config.rconPassword,
        screenSession: config.screenSession
      });
    }

    if (req.method === 'PUT') {
      await new Promise((resolve, reject) => {
        authMiddleware(req, res, (err1) => {
          if (err1) return reject(err1);
          adminCheck(req, res, (err2) => {
            if (err2) return reject(err2);
            resolve();
          });
        });
      });

      const { host, port, rconHost, rconPort, rconPassword, screenSession } = req.body || {};
      const updated = await saveMinecraftConfig({
        host: host ? host.trim() : undefined,
        port: port ? parseInt(port, 10) : undefined,
        rconHost: rconHost ? rconHost.trim() : undefined,
        rconPort: rconPort ? parseInt(rconPort, 10) : undefined,
        rconPassword: rconPassword !== undefined ? rconPassword : undefined,
        screenSession: screenSession ? screenSession.trim() : undefined
      });
      return res.json({
        success: true,
        message: 'Minecraft server configuration updated successfully',
        config: {
          host: updated.host,
          port: updated.port,
          rconHost: updated.rconHost,
          rconPort: updated.rconPort,
          hasRconPassword: !!updated.rconPassword,
          screenSession: updated.screenSession
        }
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    if (res.headersSent) return;
    console.error('Config API error:', err);
    return res.status(err.status || 500).json({ error: err.message || 'Server error' });
  }
};
