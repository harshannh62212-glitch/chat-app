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
  return app(req, res);
};
