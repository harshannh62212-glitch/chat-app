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

const adminRoutes = require('./routes/admin');

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/servers', serverRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);

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
    processMemoryMB: (processMemoryUsage().rss / (1024 * 1024)).toFixed(1) + ' MB'
  });
});

// Dell Hardware Fan Control API
const fs = require('fs');

function getDellFanPath() {
  const hwmonPath = '/sys/class/hwmon';
  if (fs.existsSync(hwmonPath)) {
    try {
      const dirs = fs.readdirSync(hwmonPath);
      for (const dir of dirs) {
        const namePath = `${hwmonPath}/${dir}/name`;
        if (fs.existsSync(namePath)) {
          const name = fs.readFileSync(namePath, 'utf8').trim();
          if (name === 'dell_smm' || name === 'dell_smm_hwmon') {
            return `${hwmonPath}/${dir}`;
          }
        }
      }
    } catch (e) {}
  }
  return '/sys/class/hwmon/hwmon7';
}

app.get('/api/system/fan', (req, res) => {
  try {
    const fanPath = getDellFanPath();
    let rpm = 0;
    let pwm = 0;
    let enableMode = 2; // Default to Auto

    if (fs.existsSync(`${fanPath}/fan1_input`)) {
      rpm = parseInt(fs.readFileSync(`${fanPath}/fan1_input`, 'utf8').trim()) || 0;
    }
    if (fs.existsSync(`${fanPath}/pwm1`)) {
      pwm = parseInt(fs.readFileSync(`${fanPath}/pwm1`, 'utf8').trim()) || 0;
    }
    if (fs.existsSync(`${fanPath}/pwm1_enable`)) {
      enableMode = parseInt(fs.readFileSync(`${fanPath}/pwm1_enable`, 'utf8').trim()) || 2;
    }

    const speedPercent = Math.round((pwm / 255) * 100);

    res.json({
      rpm,
      pwm,
      speedPercent,
      mode: enableMode === 2 ? 'auto' : 'manual',
      enableMode
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to read hardware fan status: ' + err.message });
  }
});

app.post('/api/system/fan/set', (req, res) => {
  try {
    const { mode, speedPercent } = req.body;
    const fanPath = getDellFanPath();

    if (mode === 'auto') {
      if (fs.existsSync(`${fanPath}/pwm1_enable`)) {
        fs.writeFileSync(`${fanPath}/pwm1_enable`, '2');
      }
      return res.json({ message: 'Fan set to AUTO mode (Dell BIOS Dynamic Control)', mode: 'auto' });
    } else {
      const pct = Math.min(100, Math.max(0, parseInt(speedPercent) || 50));
      const pwmVal = Math.round((pct / 100) * 255);

      if (fs.existsSync(`${fanPath}/pwm1_enable`)) {
        fs.writeFileSync(`${fanPath}/pwm1_enable`, '1');
      }
      if (fs.existsSync(`${fanPath}/pwm1`)) {
        fs.writeFileSync(`${fanPath}/pwm1`, pwmVal.toString());
      }
      return res.json({ message: `Fan speed set to MANUAL ${pct}% (${pwmVal} PWM)`, mode: 'manual', speedPercent: pct });
    }
  } catch (err) {
    console.error('Fan control error:', err);
    res.status(500).json({ error: 'Failed to adjust fan speed: ' + err.message });
  }
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
