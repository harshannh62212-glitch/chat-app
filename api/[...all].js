const app = require('../server');
const { initDB } = require('../db/database');

let dbInitialized = false;
let dbInitPromise = null;

module.exports = async (req, res) => {
  if (!dbInitialized) {
    if (!dbInitPromise) {
      dbInitPromise = initDB().then(() => {
        dbInitialized = true;
      }).catch((err) => {
        console.error('[SERVERLESS] DB init error:', err);
      });
    }
    await dbInitPromise;
  }

  // Ensure req.url matches Express route mounts starting with /api
  if (req.url && !req.url.startsWith('/api') && !req.url.startsWith('/ping') && !req.url.startsWith('/socket.io')) {
    req.url = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
  }

  return app(req, res);
};
