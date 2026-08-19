const express = require('express');
const { authMiddleware, adminCheck } = require('../middleware/auth');
const {
  getServerStatus,
  getMinecraftConfig,
  saveMinecraftConfig,
  broadcastMessage,
  sendAlert,
  executeCommand,
  kickPlayer
} = require('../utils/minecraftManager');

const router = express.Router();

// 1. Get Live Server Status & Online Players (Public / Authenticated)
router.get('/status', async (req, res) => {
  try {
    const status = await getServerStatus();
    res.json(status);
  } catch (err) {
    console.error('Failed to get Minecraft server status:', err);
    res.status(500).json({ error: 'Failed to retrieve server status' });
  }
});

// 2. Get Minecraft Server Config (Admin Only)
router.get('/config', authMiddleware, adminCheck, async (req, res) => {
  try {
    const config = await getMinecraftConfig();
    // Return sanitized config (masking password)
    res.json({
      host: config.host,
      port: config.port,
      rconHost: config.rconHost,
      rconPort: config.rconPort,
      hasRconPassword: !!config.rconPassword,
      screenSession: config.screenSession
    });
  } catch (err) {
    console.error('Failed to get Minecraft config:', err);
    res.status(500).json({ error: 'Failed to retrieve Minecraft config' });
  }
});

// 3. Update Minecraft Server Config (Admin Only)
router.put('/config', authMiddleware, adminCheck, async (req, res) => {
  try {
    const { host, port, rconHost, rconPort, rconPassword, screenSession } = req.body;
    const updated = await saveMinecraftConfig({
      host: host ? host.trim() : undefined,
      port: port ? parseInt(port, 10) : undefined,
      rconHost: rconHost ? rconHost.trim() : undefined,
      rconPort: rconPort ? parseInt(rconPort, 10) : undefined,
      rconPassword: rconPassword !== undefined ? rconPassword : undefined,
      screenSession: screenSession ? screenSession.trim() : undefined
    });
    res.json({
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
  } catch (err) {
    console.error('Failed to update Minecraft config:', err);
    res.status(500).json({ error: 'Failed to update configuration: ' + err.message });
  }
});

// 4. Send In-Game Broadcast Message (Admin Only)
router.post('/message', authMiddleware, adminCheck, async (req, res) => {
  try {
    const { message, sender, color } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message cannot be empty' });
    }

    const result = await broadcastMessage(
      message.trim(),
      sender || 'SERVER',
      color || 'gold'
    );

    res.json({
      success: true,
      message: 'In-game server message broadcasted successfully',
      details: result
    });
  } catch (err) {
    console.error('Failed to broadcast message:', err);
    res.status(500).json({ error: err.message || 'Failed to broadcast message' });
  }
});

// 5. Send In-Game On-Screen Title/Subtitle Alert (Admin Only)
router.post('/alert', authMiddleware, adminCheck, async (req, res) => {
  try {
    const { title, subtitle, level, playSound } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Alert title is required' });
    }

    const result = await sendAlert(
      title.trim(),
      subtitle ? subtitle.trim() : '',
      level || 'warning',
      playSound !== false
    );

    res.json({
      success: true,
      message: 'Server alert broadcasted to all online players',
      details: result
    });
  } catch (err) {
    console.error('Failed to send alert:', err);
    res.status(500).json({ error: err.message || 'Failed to send alert' });
  }
});

// 6. Execute Custom Console Command (Admin Only)
router.post('/command', authMiddleware, adminCheck, async (req, res) => {
  try {
    const { command } = req.body;
    if (!command || !command.trim()) {
      return res.status(400).json({ error: 'Command cannot be empty' });
    }

    const result = await executeCommand(command.trim());
    res.json({
      success: true,
      response: result.response || 'Command executed',
      method: result.method
    });
  } catch (err) {
    console.error('Failed to execute command:', err);
    res.status(500).json({ error: err.message || 'Failed to execute command' });
  }
});

// 7. Kick Online Player (Admin Only)
router.post('/kick', authMiddleware, adminCheck, async (req, res) => {
  try {
    const { username, reason } = req.body;
    if (!username || !username.trim()) {
      return res.status(400).json({ error: 'Username is required' });
    }

    const result = await kickPlayer(username.trim(), reason);
    res.json({
      success: true,
      message: `Player ${username.trim()} kicked from the server`,
      details: result
    });
  } catch (err) {
    console.error('Failed to kick player:', err);
    res.status(500).json({ error: err.message || 'Failed to kick player' });
  }
});

// 8. Bridge Worker: Long-poll or fetch pending commands for automatic Minecraft execution
router.get('/bridge/poll', async (req, res) => {
  try {
    const { query } = require('../db/database');
    const pending = await query(
      "SELECT id, command FROM minecraft_bridge_queue WHERE status = 'pending' ORDER BY id ASC LIMIT 10"
    );
    if (pending.rows.length > 0) {
      const ids = pending.rows.map(r => r.id);
      await query(
        "UPDATE minecraft_bridge_queue SET status = 'processing' WHERE id = ANY($1::int[])",
        [ids]
      );
    }
    res.json({ success: true, commands: pending.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 9. Bridge Worker: Acknowledge command execution
router.post('/bridge/ack', async (req, res) => {
  try {
    const { query } = require('../db/database');
    const { id, response } = req.body;
    if (id) {
      await query(
        "UPDATE minecraft_bridge_queue SET status = 'completed', response = $1, executed_at = NOW() WHERE id = $2",
        [response || 'OK', id]
      );
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
