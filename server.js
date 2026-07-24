const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIO = require('socket.io');
require('dotenv').config();
const authRoutes = require('./routes/auth');
const serverRoutes = require('./routes/servers');
const messageRoutes = require('./routes/messages');
const userRoutes = require('./routes/users');
const { initDB } = require('./db/database');
const { filterContent } = require('./utils/contentFilter');

const app = express();
const server = http.createServer(app);
const allowedOrigin = (origin, callback) => {
  callback(null, true);
};

const io = socketIO(server, {
  cors: {
    origin: allowedOrigin,
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

app.use((req, res, next) => {
  const origin = req.headers.origin || '*';
  res.header('Access-Control-Allow-Origin', origin);
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, bypass-tunnel-reminder');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/servers', serverRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/users', userRoutes);

const os = require('os');

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Comprehensive System Status Endpoint
app.get('/api/system-status', (req, res) => {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const cpus = os.cpus();
  const loadAvg = os.loadavg();

  res.json({
    status: 'online',
    server: 'Dell Latitude 5290',
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    uptimeSeconds: Math.floor(os.uptime()),
    cpus: cpus.length,
    cpuModel: cpus[0]?.model || 'Intel Core i5/i7',
    cpuLoadAverage: {
      '1min': loadAvg[0].toFixed(2),
      '5min': loadAvg[1].toFixed(2),
      '15min': loadAvg[2].toFixed(2)
    },
    memory: {
      totalGB: (totalMem / (1024 ** 3)).toFixed(2) + ' GB',
      freeGB: (freeMem / (1024 ** 3)).toFixed(2) + ' GB',
      usedGB: (usedMem / (1024 ** 3)).toFixed(2) + ' GB',
      usedPercent: ((usedMem / totalMem) * 100).toFixed(1) + '%'
    },
    processMemoryMB: (process.memoryUsage().rss / (1024 * 1024)).toFixed(1) + ' MB'
  });
});

// Socket.io connection
const connectedUsers = new Map();

io.on('connection', (socket) => {
  console.log('New user connected:', socket.id);

  socket.on('user-joined', (userId, serverIdOrDmWith) => {
    connectedUsers.set(socket.id, { userId, serverIdOrDmWith });
    socket.join(`user-${userId}`);
    if (serverIdOrDmWith) {
      socket.join(`server-${serverIdOrDmWith}`);
    }
  });

  socket.on('send-message', (data) => {
    const { senderId, content, serverId, dmWith } = data;
    const filteredContent = filterContent(content);

    if (serverId) {
      io.to(`server-${serverId}`).emit('new-message', {
        senderId,
        content: filteredContent,
        serverId,
        timestamp: new Date(),
        isDM: false
      });
    } else if (dmWith) {
      io.to(`user-${dmWith}`).emit('new-dm', {
        senderId,
        content: filteredContent,
        timestamp: new Date()
      });
      io.to(`user-${senderId}`).emit('dm-sent', {
        dmWith,
        content: filteredContent,
        timestamp: new Date()
      });
    }
  });

  socket.on('user-typing', (data) => {
    const { userId, serverId } = data;
    if (serverId) {
      io.to(`server-${serverId}`).emit('user-typing', { userId });
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    connectedUsers.delete(socket.id);
  });
});

module.exports = { io };
const PORT = process.env.PORT || 5000;

(async () => {
  try {
    await initDB();
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
})();

module.exports = { io };
