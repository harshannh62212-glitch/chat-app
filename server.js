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
const { filterContent, containsBannedWords } = require('./utils/contentFilter');

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
    const { senderId, senderUsername, content, serverId, chatroomId, dmWith } = data;
    
    let isAdmin = false;

    // Check if user is currently timed out and retrieve admin status
    try {
      const userCheck = await query('SELECT timeout_until, is_admin, username FROM users WHERE id = $1', [senderId]);
      const user = userCheck.rows[0];
      isAdmin = user && (user.is_admin || user.username === 'Nxghtmare3621');

      const timeoutUntil = user?.timeout_until;
      if (timeoutUntil && new Date(timeoutUntil) > new Date()) {
        socket.emit('timeout-error', { 
          message: `You are timed out until ${new Date(timeoutUntil).toLocaleString()}` 
        });
        return;
      }
    } catch (err) {
      console.error('Socket timeout check failed:', err);
    }

    // Enforce 20 Giphy GIFs daily limit for standard users (unlimited for admins)
    if (content.includes('giphy.com') && !isAdmin) {
      try {
        const serverGiphs = await query(
          "SELECT COUNT(*) FROM server_messages WHERE sender_id = $1 AND content LIKE '%giphy.com%' AND created_at > NOW() - INTERVAL '1 day'",
          [senderId]
        );
        const dmGiphs = await query(
          "SELECT COUNT(*) FROM direct_messages WHERE sender_id = $1 AND content LIKE '%giphy.com%' AND created_at > NOW() - INTERVAL '1 day'",
          [senderId]
        );
        const totalGiphs = parseInt(serverGiphs.rows[0].count) + parseInt(dmGiphs.rows[0].count);

        if (totalGiphs >= 20) {
          socket.emit('timeout-error', { 
            message: 'You have reached your daily limit of 20 Giphy GIFs. Admins get unlimited access!' 
          });
          return; // Block message from being sent!
        }
      } catch (err) {
        console.error('Failed to verify Giphy daily limit:', err);
      }
    }

    // Auto-timeout user for 30 seconds if message contains profanity or slurs, EXCEPT if they are admin
    if (containsBannedWords(content) && !isAdmin) {
      try {
        const timeoutUntil = new Date(Date.now() + 30 * 1000);
        await query('UPDATE users SET timeout_until = $1 WHERE id = $2', [timeoutUntil, senderId]);
        socket.emit('timeout-error', { 
          message: 'You have been automatically timed out for 30 seconds for sending profanity or slurs.' 
        });
        return;
      } catch (err) {
        console.error('Failed to auto-timeout user:', err);
      }
    }

    const filteredContent = filterContent(content);

    try {
      if (serverId && chatroomId) {
        // Insert into server_messages table
        const insertResult = await query(
          `INSERT INTO server_messages (chatroom_id, sender_id, content) 
           VALUES ($1, $2, $3) 
           RETURNING id, created_at`,
          [chatroomId, senderId, filteredContent]
        );
        const createdMsg = insertResult.rows[0];

        // Fetch sender username to display correctly
        const senderCheck = await query('SELECT username, avatar_url FROM users WHERE id = $1', [senderId]);
        const sender = senderCheck.rows[0];

        io.to(`server-${serverId}`).emit('new-message', {
          id: createdMsg.id,
          sender_id: senderId,
          username: sender?.username || 'Unknown',
          avatar_url: sender?.avatar_url,
          content: filteredContent,
          serverId,
          chatroomId,
          created_at: createdMsg.created_at,
          isDM: false
        });
      } else if (dmWith) {
        // Insert into direct_messages table
        const insertResult = await query(
          `INSERT INTO direct_messages (sender_id, recipient_id, content) 
           VALUES ($1, $2, $3) 
           RETURNING id, created_at`,
          [senderId, dmWith, filteredContent]
        );
        const createdMsg = insertResult.rows[0];

        io.to(`user-${dmWith}`).emit('new-dm', {
          id: createdMsg.id,
          senderId,
          senderUsername,
          content: filteredContent,
          timestamp: createdMsg.created_at
        });

        io.to(`user-${senderId}`).emit('dm-sent', {
          id: createdMsg.id,
          senderId,
          dmWith,
          content: filteredContent,
          timestamp: createdMsg.created_at
        });
      }
    } catch (err) {
      console.error('Failed to save message to database:', err);
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
