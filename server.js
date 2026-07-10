const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIO = require('socket.io');
require('dotenv').config();
const authRoutes = require('./routes/auth');
const serverRoutes = require('./routes/servers');
const messageRoutes = require('./routes/messages');
const userRoutes = require('./routes/users');
const adminRoutes = require('./routes/admin');
const { initDB, query } = require('./db/database');
const { filterContent } = require('./utils/contentFilter');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/servers', serverRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
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

  socket.on('send-message', async (data) => {
    const { senderId, senderUsername, content, serverId, dmWith } = data;
    
    // Check if user is currently timed out
    try {
      const userCheck = await query('SELECT timeout_until FROM users WHERE id = $1', [senderId]);
      const timeoutUntil = userCheck.rows[0]?.timeout_until;
      if (timeoutUntil && new Date(timeoutUntil) > new Date()) {
        socket.emit('timeout-error', { 
          message: `You are timed out until ${new Date(timeoutUntil).toLocaleString()}` 
        });
        return;
      }
    } catch (err) {
      console.error('Socket timeout check failed:', err);
    }

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
        senderUsername,
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
const PORT = process.env.PORT || 8000;

(async () => {
  try {
    await initDB();
    
    // Load custom banned words cache on startup
    const { loadCustomBannedWords } = require('./utils/contentFilter');
    await loadCustomBannedWords();

    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
})();

module.exports = { io };
