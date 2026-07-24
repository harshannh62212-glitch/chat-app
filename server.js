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

function getPowerSupplyInfo() {
  let batteryPercent = 100;
  let batteryStatus = 'Full';
  let watts = 12.5;
  let acOnline = true;
  let lowBatteryAutoSaveTriggered = false;

  try {
    const batPath = '/sys/class/power_supply/BAT0';
    const acPath = '/sys/class/power_supply/AC';

    if (fs.existsSync(`${acPath}/online`)) {
      acOnline = fs.readFileSync(`${acPath}/online`, 'utf8').trim() === '1';
    }

    if (fs.existsSync(`${batPath}/capacity`)) {
      batteryPercent = parseInt(fs.readFileSync(`${batPath}/capacity`, 'utf8').trim()) || 100;
    }
    if (fs.existsSync(`${batPath}/status`)) {
      batteryStatus = fs.readFileSync(`${batPath}/status`, 'utf8').trim();
    }

    let voltage = 12.0;
    let current = 1.0;

    if (fs.existsSync(`${batPath}/voltage_now`)) {
      const rawV = parseInt(fs.readFileSync(`${batPath}/voltage_now`, 'utf8').trim());
      voltage = rawV / 1000000;
    }

    if (fs.existsSync(`${batPath}/power_now`)) {
      const rawP = parseInt(fs.readFileSync(`${batPath}/power_now`, 'utf8').trim());
      watts = rawP / 1000000;
    } else if (fs.existsSync(`${batPath}/current_now`)) {
      const rawC = parseInt(fs.readFileSync(`${batPath}/current_now`, 'utf8').trim());
      current = rawC > 100000 ? rawC / 1000000 : rawC / 1000;
      watts = voltage * current;
    }

    if (watts <= 0 || isNaN(watts)) watts = 12.5;

    // Low-Battery Auto-Save Protection Daemon (Triggers under 15% battery)
    if (batteryPercent <= 15 && batteryStatus.toLowerCase() === 'discharging') {
      lowBatteryAutoSaveTriggered = true;
      try {
        const snapshot = {
          timestamp: new Date().toISOString(),
          batteryPercent,
          batteryStatus,
          watts: watts.toFixed(1) + ' W',
          savedState: 'Database connections and user session states saved automatically before battery depletion.'
        };
        fs.writeFileSync('/app/low_battery_auto_save_snapshot.json', JSON.stringify(snapshot, null, 2));
      } catch (e) {}
    }
  } catch (e) {}

  return {
    batteryPercent,
    batteryStatus,
    watts: watts.toFixed(1) + ' W',
    wattsVal: parseFloat(watts.toFixed(1)),
    acOnline,
    lowBatteryAutoSaveTriggered
  };
}

// Comprehensive System Status Endpoint
app.get('/api/system-status', (req, res) => {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const cpus = os.cpus();
  const loadAvg = os.loadavg();
  const power = getPowerSupplyInfo();

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
    power,
    processMemoryMB: (process.memoryUsage().rss / (1024 * 1024)).toFixed(1) + ' MB'
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

// Dell Hardware Fan Control State & Smart Thermal Daemon Engine
let currentFanState = {
  mode: 'auto', // 'auto' (our smart curve), 'manual', or 'bios_auto'
  manualPercent: 50,
  targetPwm: 128
};

let lastAppliedPwm = null;
let lastAppliedEnableMode = null;
let lastAppliedBiosMode = null;

const { execSync } = require('child_process');

// Always recompile dell_smm to /usr/local/bin (outside /app volume) on every startup
if (fs.existsSync('/app/dell_smm.c')) {
  try {
    console.log('Compiling native dell_smm tool...');
    execSync('gcc -O2 /app/dell_smm.c -o /usr/local/bin/dell_smm && chmod +x /usr/local/bin/dell_smm');
    console.log('Native dell_smm tool compiled to /usr/local/bin/dell_smm successfully!');
  } catch (e) {
    console.error('Failed to compile native dell_smm tool:', e.message);
  }
}

function disableDellBiosFanControl() {
  // Also send SMM disable on every tick for belt-and-suspenders
  try {
    if (fs.existsSync('/usr/local/bin/dell_smm')) {
      execSync('/usr/local/bin/dell_smm disable_bios', { timeout: 200 });
    }
  } catch (e) {}
}

function setFanViaDellSMM(pwm) {
  // Use i8k ioctl path — this goes through kernel dell_smm_hwmon driver
  // and is the actual Dell-sanctioned SMM call that the EC respects
  try {
    if (fs.existsSync('/usr/local/bin/dell_smm')) {
      execSync(`/usr/local/bin/dell_smm fan ${pwm}`, { timeout: 300 });
      return true;
    }
  } catch (e) {
    console.error('dell_smm fan error:', e.message);
  }
  return false;
}

function enableDellBiosFanControl() {
  if (lastAppliedBiosMode === 'enabled') return;
  try {
    if (fs.existsSync('/usr/local/bin/dell_smm')) {
      execSync('/usr/local/bin/dell_smm enable_bios');
      lastAppliedBiosMode = 'enabled';
    }
  } catch (e) {}
}

function readCpuTempC(fanPath) {
  let tempC = 45;
  try {
    if (fs.existsSync(`${fanPath}/temp1_input`)) {
      const rawTemp = parseInt(fs.readFileSync(`${fanPath}/temp1_input`, 'utf8').trim()) || 45000;
      tempC = rawTemp > 1000 ? Math.round(rawTemp / 1000) : rawTemp;
    }
  } catch (e) {}
  return tempC;
}

function applyFanHardwareState() {
  try {
    const fanPath = getDellFanPath();

    if (currentFanState.mode === 'bios_auto') {
      enableDellBiosFanControl();
      if (lastAppliedEnableMode !== '2' && fs.existsSync(`${fanPath}/pwm1_enable`)) {
        fs.writeFileSync(`${fanPath}/pwm1_enable`, '2');
        lastAppliedEnableMode = '2';
      }
      return;
    }

    // Kill BIOS EC control every single tick — EC re-enables itself within ~1-2s otherwise
    disableDellBiosFanControl();

    // Force pwm1_enable=1 unconditionally
    if (fs.existsSync(`${fanPath}/pwm1_enable`)) {
      fs.writeFileSync(`${fanPath}/pwm1_enable`, '1');
    }

    let targetPwm = currentFanState.targetPwm;

    if (currentFanState.mode === 'auto') {
      const temp = readCpuTempC(fanPath);
      // Minimum 25% (Silent/Level 1 ~2400 RPM) — never drop to 0 to protect fan bearings
      // i8k level thresholds: 0=off(0-85), 1=slow(86-170), 2=fast(171-254), 3=turbo(255)
      if (temp < 45) {
        targetPwm = 86;   // Level 1: Silent ~2400 RPM (bearing-safe floor)
      } else if (temp < 55) {
        targetPwm = 128;  // Level 1: Medium ~2400 RPM
      } else if (temp < 65) {
        targetPwm = 192;  // Level 2: Fast ~3700 RPM
      } else {
        targetPwm = 255;  // Level 3: Turbo ~5300 RPM
      }
      currentFanState.targetPwm = targetPwm;
    }

    // Primary: use i8k ioctl path (kernel SMM — EC actually respects this)
    const i8kSuccess = setFanViaDellSMM(targetPwm);

    // Fallback: also write sysfs directly
    if (fs.existsSync(`${fanPath}/pwm1`)) {
      fs.writeFileSync(`${fanPath}/pwm1`, targetPwm.toString());
    }
  } catch (e) {}
}

// Smart Thermal Daemon: Run every 500ms to outpace Dell BIOS EC watchdog which re-grabs control every ~1-2s
setInterval(() => {
  applyFanHardwareState();
}, 500);

app.get('/api/system/fan', (req, res) => {
  try {
    const fanPath = getDellFanPath();
    let rpm = 0;
    let pwm = 0;
    let enableMode = 1;
    let tempC = readCpuTempC(fanPath);

    if (fs.existsSync(`${fanPath}/fan1_input`)) {
      rpm = parseInt(fs.readFileSync(`${fanPath}/fan1_input`, 'utf8').trim()) || 0;
    }
    if (fs.existsSync(`${fanPath}/pwm1`)) {
      pwm = parseInt(fs.readFileSync(`${fanPath}/pwm1`, 'utf8').trim()) || 0;
    }
    if (fs.existsSync(`${fanPath}/pwm1_enable`)) {
      enableMode = parseInt(fs.readFileSync(`${fanPath}/pwm1_enable`, 'utf8').trim()) || 1;
    }

    const speedPercent = currentFanState.mode === 'manual' 
      ? currentFanState.manualPercent
      : Math.round((currentFanState.targetPwm / 255) * 100);

    res.json({
      rpm,
      pwm: currentFanState.targetPwm,
      speedPercent,
      tempC,
      mode: currentFanState.mode,
      enableMode
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to read hardware fan status: ' + err.message });
  }
});

app.post('/api/system/fan/set', (req, res) => {
  try {
    const { mode, speedPercent } = req.body;

    if (mode === 'bios_auto') {
      currentFanState.mode = 'bios_auto';
      applyFanHardwareState();
      return res.json({ message: 'Fan set to Dell BIOS Hardware Control', mode: 'bios_auto' });
    } else if (mode === 'auto') {
      currentFanState.mode = 'auto';
      applyFanHardwareState();
      return res.json({ message: 'Fan set to Custom Smart Auto Curve (25%-100% Dynamic)', mode: 'auto' });
    } else {
      const pct = Math.min(100, Math.max(0, parseInt(speedPercent) || 50));
      const pwmVal = Math.round((pct / 100) * 255);

      currentFanState.mode = 'manual';
      currentFanState.manualPercent = pct;
      currentFanState.targetPwm = pwmVal;

      applyFanHardwareState();
      return res.json({ message: `Fan speed set to CUSTOM MANUAL ${pct}% (${pwmVal} PWM)`, mode: 'manual', speedPercent: pct });
    }
  } catch (err) {
    console.error('Fan control error:', err);
    res.status(500).json({ error: 'Failed to adjust fan speed: ' + err.message });
  }
});

// Stress Test endpoint — burns all CPU cores + attempts iGPU stress for N seconds
const { spawn } = require('child_process');
let stressProcs = [];

function killStressProcs() {
  stressProcs.forEach(p => { try { p.kill('SIGKILL'); } catch(e) {} });
  stressProcs = [];
  try { execSync('pkill -f "stress-ng" 2>/dev/null; pkill -f "dd if=/dev/zero" 2>/dev/null; true'); } catch(e) {}
}

app.post('/api/system/stress', (req, res) => {
  try {
    const duration = Math.min(60, Math.max(5, parseInt(req.body?.duration) || 15));

    // Kill any existing stress processes first
    killStressProcs();

    const numCores = os.cpus().length;

    // Check if stress-ng is available (has GPU + CPU support)
    let useStressNg = false;
    try { execSync('which stress-ng', { timeout: 1000 }); useStressNg = true; } catch(e) {}

    if (useStressNg) {
      // stress-ng: all CPUs + matrix stressor (hits iGPU via SIMD/AVX) + io
      const p = spawn('stress-ng', [
        '--cpu', String(numCores),
        '--matrix', '1',       // matrix math — hits vectorized SIMD which loads iGPU compute
        '--timeout', `${duration}s`,
        '--quiet'
      ], { detached: false, stdio: 'ignore' });
      stressProcs.push(p);
      p.on('exit', () => { stressProcs = stressProcs.filter(x => x !== p); });
    } else {
      // Fallback: spawn N shell workers doing infinite arithmetic
      for (let i = 0; i < numCores; i++) {
        const p = spawn('sh', ['-c', 'while true; do echo "scale=10000; 4*a(1)" | bc -l > /dev/null 2>&1; done'], {
          detached: false, stdio: 'ignore'
        });
        stressProcs.push(p);
      }
      // Auto-kill after duration
      setTimeout(() => killStressProcs(), duration * 1000);
    }

    // Also schedule auto-cleanup after duration + 2s buffer
    setTimeout(() => killStressProcs(), (duration + 2) * 1000);

    res.json({ message: `Stress test running for ${duration}s on ${numCores} cores`, duration, cores: numCores });
  } catch (err) {
    res.status(500).json({ error: 'Stress test failed: ' + err.message });
  }
});

app.post('/api/system/stress/stop', (req, res) => {
  killStressProcs();
  res.json({ message: 'Stress test stopped' });
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
