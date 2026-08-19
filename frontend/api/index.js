const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { initDB } = require('../db/database');

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());

// Routes
const authRoutes = require('../routes/auth');
const serverRoutes = require('../routes/servers');
const messageRoutes = require('../routes/messages');
const userRoutes = require('../routes/users');
const adminRoutes = require('../routes/admin');
const minecraftRoutes = require('../routes/minecraft');
const reportRoutes = require('../routes/report');
const spotifyRoutes = require('../routes/spotify');
const youtubeRoutes = require('../routes/youtube');
const gamesRoutes = require('../routes/games');

app.use('/api/auth', authRoutes);
app.use('/api/servers', serverRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/minecraft', minecraftRoutes);
app.use('/api/spotify', spotifyRoutes);
app.use('/api/youtube', youtubeRoutes);
app.use('/api/games', gamesRoutes);
app.use('/api', reportRoutes);

app.get('/ping', (req, res) => res.send('pong-32bytes-payload-status-okay'));
app.get('/api/ping', (req, res) => res.send('pong-32bytes-payload-status-okay'));

// Database Initialization Guard
let dbReady = false;
let dbPromise = null;

module.exports = async (req, res) => {
  if (!dbReady) {
    if (!dbPromise) {
      dbPromise = initDB().then(() => {
        dbReady = true;
      }).catch(err => {
        console.error('[SERVERLESS DB INIT ERROR]', err);
      });
    }
    await dbPromise;
  }
  return app(req, res);
};
