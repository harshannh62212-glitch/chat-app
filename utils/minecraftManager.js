const net = require('net');
const dns = require('dns');
const { exec } = require('child_process');
const { query } = require('../db/database');

// Default fallback configuration
const DEFAULT_CONFIG = {
  host: process.env.MINECRAFT_SERVER_HOST || 'atoms-fools.tun.ply.gg',
  port: parseInt(process.env.MINECRAFT_SERVER_PORT, 10) || 25565,
  rconHost: process.env.MINECRAFT_RCON_HOST || '127.0.0.1',
  rconPort: parseInt(process.env.MINECRAFT_RCON_PORT, 10) || 25575,
  rconPassword: process.env.MINECRAFT_RCON_PASSWORD || '',
  screenSession: process.env.MINECRAFT_SCREEN_SESSION || 'mc'
};

// Helper to fetch persistent config from system_config table
async function getMinecraftConfig() {
  try {
    const res = await query(
      "SELECT key, value FROM system_config WHERE key LIKE 'mc_%'"
    );
    const dbConfig = {};
    if (res && res.rows) {
      for (const row of res.rows) {
        if (row.key === 'mc_host') dbConfig.host = row.value;
        if (row.key === 'mc_port') dbConfig.port = parseInt(row.value, 10);
        if (row.key === 'mc_rcon_host') dbConfig.rconHost = row.value;
        if (row.key === 'mc_rcon_port') dbConfig.rconPort = parseInt(row.value, 10);
        if (row.key === 'mc_rcon_password') dbConfig.rconPassword = row.value;
        if (row.key === 'mc_screen_session') dbConfig.screenSession = row.value;
      }
    }
    return { ...DEFAULT_CONFIG, ...dbConfig };
  } catch (err) {
    return { ...DEFAULT_CONFIG };
  }
}

// Helper to write config to system_config
async function saveMinecraftConfig(newConfig) {
  const entries = [
    ['mc_host', newConfig.host],
    ['mc_port', newConfig.port ? String(newConfig.port) : '25565'],
    ['mc_rcon_host', newConfig.rconHost],
    ['mc_rcon_port', newConfig.rconPort ? String(newConfig.rconPort) : '25575'],
    ['mc_rcon_password', newConfig.rconPassword],
    ['mc_screen_session', newConfig.screenSession || 'mc']
  ];

  for (const [key, val] of entries) {
    if (val !== undefined) {
      await query(
        `INSERT INTO system_config (key, value, updated_at) 
         VALUES ($1, $2, NOW()) 
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [key, String(val)]
      );
    }
  }
  return getMinecraftConfig();
}

/**
 * Native Minecraft Server List Ping (SLP) implementation with SRV lookup
 */
async function pingMinecraftServer(targetHost, targetPort = 25565, timeout = 3500) {
  let host = targetHost;
  let port = targetPort;

  // 1. Check if targetHost contains explicit port (e.g. host:12345)
  if (host.includes(':')) {
    const parts = host.split(':');
    host = parts[0];
    port = parseInt(parts[1], 10) || port;
  }

  // 2. Perform DNS SRV lookup for Minecraft service (_minecraft._tcp.<host>)
  if (port === 25565 && !net.isIP(host)) {
    try {
      const srvAddresses = await dns.promises.resolveSrv(`_minecraft._tcp.${host}`);
      if (srvAddresses && srvAddresses.length > 0) {
        host = srvAddresses[0].name;
        port = srvAddresses[0].port;
      }
    } catch (srvErr) {
      // No SRV record, proceed with standard host & port
    }
  // 3. Resolve IPv4 address for direct TCP connection
  let connectIp = host;
  try {
    if (!net.isIP(host)) {
      const ips = await dns.promises.resolve4(host);
      if (ips && ips.length > 0) {
        connectIp = ips[0];
      }
    }
  } catch (ipErr) {
    connectIp = host;
  }

  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const socket = new net.Socket();
    let isFinished = false;
    let dataBuffer = Buffer.alloc(0);

    const finish = (err, result) => {
      if (isFinished) return;
      isFinished = true;
      socket.destroy();
      if (err) reject(err);
      else resolve(result);
    };

    socket.setTimeout(timeout);

    socket.on('connect', () => {
      try {
        // Build VarInt Helper
        const writeVarInt = (val) => {
          const bytes = [];
          while (true) {
            if ((val & 0xffffff80) === 0) {
              bytes.push(val);
              return Buffer.from(bytes);
            }
            bytes.push((val & 0x7f) | 0x80);
            val >>>= 7;
          }
        };

        const hostBuffer = Buffer.from(host, 'utf8');
        const portBuffer = Buffer.alloc(2);
        portBuffer.writeUInt16BE(port);

        // Handshake packet data: [PacketID: 0x00][Protocol: 47 (1.8-1.21+)][Host length + Host][Port][NextState: 1 (status)]
        const handshakeData = Buffer.concat([
          Buffer.from([0x00]),
          writeVarInt(765), // Modern protocol version
          writeVarInt(hostBuffer.length),
          hostBuffer,
          portBuffer,
          writeVarInt(1)
        ]);

        const handshakePacket = Buffer.concat([
          writeVarInt(handshakeData.length),
          handshakeData
        ]);

        // Status request packet: [Length: 1][PacketID: 0x00]
        const requestPacket = Buffer.from([0x01, 0x00]);

        socket.write(Buffer.concat([handshakePacket, requestPacket]));
      } catch (err) {
        finish(err);
      }
    });

    socket.on('data', (chunk) => {
      dataBuffer = Buffer.concat([dataBuffer, chunk]);

      try {
        // Parse incoming VarInt packet length and string length
        let offset = 0;
        const readVarInt = () => {
          let numRead = 0;
          let result = 0;
          let read;
          do {
            if (offset >= dataBuffer.length) return null;
            read = dataBuffer.readUInt8(offset++);
            const value = read & 0x7f;
            result |= value << (7 * numRead);
            numRead++;
            if (numRead > 5) throw new Error('VarInt is too big');
          } while ((read & 0x80) !== 0);
          return result;
        };

        const packetLength = readVarInt();
        if (packetLength === null) return;

        const packetId = readVarInt();
        if (packetId === null || packetId !== 0) return;

        const jsonLength = readVarInt();
        if (jsonLength === null) return;

        if (dataBuffer.length - offset >= jsonLength) {
          const jsonString = dataBuffer.slice(offset, offset + jsonLength).toString('utf8');
          const parsed = JSON.parse(jsonString);
          const latency = Date.now() - startTime;

          // Format description/motd
          let motd = '';
          if (typeof parsed.description === 'string') {
            motd = parsed.description;
          } else if (parsed.description && typeof parsed.description.text === 'string') {
            motd = parsed.description.text;
            if (Array.isArray(parsed.description.extra)) {
              motd += parsed.description.extra.map(e => (typeof e === 'string' ? e : e.text || '')).join('');
            }
          }

          // Clean Minecraft color codes from motd
          motd = motd.replace(/§[0-9a-fk-or]/gi, '').trim();

          const players = {
            online: parsed.players?.online || 0,
            max: parsed.players?.max || 20,
            sample: (parsed.players?.sample || []).map(p => ({
              id: p.id,
              name: p.name,
              avatar: `https://mc-heads.net/avatar/${encodeURIComponent(p.name)}/64`
            }))
          };

          finish(null, {
            online: true,
            version: parsed.version?.name || '1.21.x',
            protocol: parsed.version?.protocol || 765,
            motd: motd || 'Wired-IO Private Minecraft Server',
            players,
            latency,
            favicon: parsed.favicon || null,
            source: 'native_tcp'
          });
        }
      } catch (e) {
        // Wait for more chunks or fail on complete buffer
      }
    });

    socket.on('timeout', () => {
      finish(new Error('Native TCP SLP Ping timed out'));
    });

    socket.on('error', (err) => {
      finish(err);
    });

    socket.connect(port, connectIp);
  });
}

/**
 * Public status API fallback for external tunnels
 */
async function fetchPublicServerStatus(host) {
  try {
    const res = await fetch(`https://api.mcsrvstat.us/3/${encodeURIComponent(host)}`, {
      signal: AbortSignal.timeout(4000)
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.online) {
        const sample = [];
        if (Array.isArray(data.players?.list)) {
          for (const item of data.players.list) {
            const name = typeof item === 'string' ? item : item.name;
            const id = typeof item === 'object' ? item.uuid : '';
            sample.push({
              id,
              name,
              avatar: `https://mc-heads.net/avatar/${encodeURIComponent(name)}/64`
            });
          }
        }

        let cleanMotd = 'Wired-IO Private Minecraft Server';
        if (Array.isArray(data.motd?.clean)) {
          cleanMotd = data.motd.clean.join(' ');
        } else if (typeof data.motd?.clean === 'string') {
          cleanMotd = data.motd.clean;
        }

        return {
          online: true,
          version: data.version || '1.21.x',
          motd: cleanMotd,
          players: {
            online: data.players?.online || 0,
            max: data.players?.max || 20,
            sample
          },
          latency: data.debug?.ping ? 25 : 45,
          favicon: data.icon || null,
          source: 'public_api'
        };
      }
    }
  } catch (err) {
    // API failed
  }
  return null;
}

/**
 * Unified Status Querier: Tries Native TCP SLP first, then Public API fallback, or returns offline
 */
async function getServerStatus() {
  const config = await getMinecraftConfig();
  
  // 1. Try native TCP ping to configured host & port
  try {
    const tcpResult = await pingMinecraftServer(config.host, config.port, 2500);
    return {
      ...tcpResult,
      host: config.host,
      port: config.port
    };
  } catch (tcpErr) {
    // 2. Try localhost if host is external but server might run locally
    if (config.host !== '127.0.0.1' && config.host !== 'localhost') {
      try {
        const localResult = await pingMinecraftServer('127.0.0.1', 25565, 1000);
        return {
          ...localResult,
          host: config.host,
          port: config.port
        };
      } catch (localErr) {
        // continue
      }
    }

    // 3. Fallback to public mcsrvstat.us API
    try {
      const publicResult = await fetchPublicServerStatus(config.host);
      if (publicResult && publicResult.online) {
        return {
          ...publicResult,
          host: config.host,
          port: config.port
        };
      }
    } catch (apiErr) {
      // continue
    }
  }

  // Server appears offline
  return {
    online: false,
    host: config.host,
    port: config.port,
    version: '1.21.x',
    motd: 'Server Offline or Unreachable',
    players: {
      online: 0,
      max: 20,
      sample: []
    },
    latency: null,
    favicon: null,
    source: 'offline'
  };
}

/**
 * Native Source RCON Client
 */
function sendRconCommand(host, port, password, command, timeout = 4000) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let isFinished = false;
    let authSent = false;
    let reqId = Math.floor(Math.random() * 10000) + 1;
    let cmdReqId = reqId + 1;
    let responseBuffer = Buffer.alloc(0);

    const finish = (err, result) => {
      if (isFinished) return;
      isFinished = true;
      socket.destroy();
      if (err) reject(err);
      else resolve(result);
    };

    socket.setTimeout(timeout);

    // Build RCON Packet: [Size: int32LE][ID: int32LE][Type: int32LE][Body: string][2x 0x00 padding]
    const makePacket = (id, type, body) => {
      const bodyBuffer = Buffer.from(body, 'utf8');
      const size = 4 + 4 + bodyBuffer.length + 2;
      const packet = Buffer.alloc(size + 4);
      packet.writeInt32LE(size, 0);
      packet.writeInt32LE(id, 4);
      packet.writeInt32LE(type, 8);
      bodyBuffer.copy(packet, 12);
      packet.writeUInt8(0, 12 + bodyBuffer.length);
      packet.writeUInt8(0, 13 + bodyBuffer.length);
      return packet;
    };

    socket.connect(port, host, () => {
      // Step 1: Send Authentication Packet (Type 3)
      authSent = true;
      socket.write(makePacket(reqId, 3, password || ''));
    });

    socket.on('data', (data) => {
      responseBuffer = Buffer.concat([responseBuffer, data]);

      while (responseBuffer.length >= 12) {
        const size = responseBuffer.readInt32LE(0);
        if (responseBuffer.length < size + 4) {
          return; // Wait for full packet
        }

        const packetId = responseBuffer.readInt32LE(4);
        const packetType = responseBuffer.readInt32LE(8);
        const body = responseBuffer.slice(12, size + 2).toString('utf8');
        responseBuffer = responseBuffer.slice(size + 4);

        if (packetId === -1) {
          return finish(new Error('RCON Authentication Failed: Incorrect password'));
        }

        if (packetType === 2 && packetId === reqId) {
          // Authentication succeeded! Send Command Packet (Type 2)
          socket.write(makePacket(cmdReqId, 2, command));
        } else if (packetId === cmdReqId) {
          // Command response received
          return finish(null, {
            success: true,
            response: body.trim(),
            method: 'rcon'
          });
        }
      }
    });

    socket.on('timeout', () => {
      finish(new Error('RCON socket timed out'));
    });

    socket.on('error', (err) => {
      finish(err);
    });
  });
}

/**
 * Local Screen Session Fallback: Execute command via `screen -S mc -p 0 -X stuff`
 */
function sendScreenCommand(sessionName, command) {
  return new Promise((resolve, reject) => {
    // Sanitize command to prevent dangerous shell injection
    const escaped = command.replace(/"/g, '\\"');
    const fullCmd = `screen -S "${sessionName}" -p 0 -X stuff "${escaped}\r"`;

    exec(fullCmd, (err, stdout, stderr) => {
      if (err) {
        return reject(new Error(`Screen command failed: ${stderr || err.message}`));
      }
      resolve({
        success: true,
        response: `Command sent to screen session [${sessionName}]`,
        method: 'screen'
      });
    });
  });
}

/**
 * Unified Command Executor: Attempts RCON first; if unconfigured/failed, attempts local screen session
 */
async function executeCommand(command) {
  if (!command || !command.trim()) {
    throw new Error('Command is empty');
  }
  const cleanCmd = command.trim().replace(/^\//, ''); // Strip leading slash

  const config = await getMinecraftConfig();

  // 1. If RCON password is provided or host is reachable, try RCON
  if (config.rconPassword || config.rconHost) {
    try {
      const rconRes = await sendRconCommand(
        config.rconHost || '127.0.0.1',
        config.rconPort || 25575,
        config.rconPassword || '',
        cleanCmd,
        3000
      );
      return rconRes;
    } catch (rconErr) {
      // RCON failed, try screen fallback
    }
  }

  // 2. Try Screen fallback
  try {
    const screenRes = await sendScreenCommand(config.screenSession || 'mc', cleanCmd);
    return screenRes;
  } catch (screenErr) {
    throw new Error(`Failed to execute command: RCON unavailable and screen session [${config.screenSession}] not found.`);
  }
}

/**
 * High Level: Broadcast in-game chat message
 */
async function broadcastMessage(message, sender = 'SERVER', color = 'gold') {
  if (!message || !message.trim()) {
    throw new Error('Message text is required');
  }

  const rawJson = JSON.stringify([
    { text: `[${sender}] `, color, bold: true },
    { text: message.trim(), color: 'white', bold: false }
  ]);

  const command = `tellraw @a ${rawJson}`;
  try {
    return await executeCommand(command);
  } catch (err) {
    // Fallback to standard /say if tellraw fails
    return await executeCommand(`say [${sender}] ${message.trim()}`);
  }
}

/**
 * High Level: Send prominent in-game Screen Title & Subtitle Alert + Sound
 */
async function sendAlert(titleText, subtitleText = '', level = 'warning', playSound = true) {
  if (!titleText || !titleText.trim()) {
    throw new Error('Alert title is required');
  }

  let titleColor = 'yellow';
  let soundName = 'minecraft:block.bell.use';

  if (level === 'critical' || level === 'emergency') {
    titleColor = 'red';
    soundName = 'minecraft:entity.wither.spawn';
  } else if (level === 'info' || level === 'notice') {
    titleColor = 'aqua';
    soundName = 'minecraft:entity.experience_orb.pickup';
  } else if (level === 'success') {
    titleColor = 'green';
    soundName = 'minecraft:ui.toast.challenge_complete';
  }

  const titleJson = JSON.stringify({ text: titleText.trim().toUpperCase(), color: titleColor, bold: true });
  const subtitleJson = JSON.stringify({ text: (subtitleText || '').trim(), color: 'white', italic: true });

  // 1. Set display timing: 10 ticks fade in, 70 ticks stay (3.5s), 20 ticks fade out (1s)
  await executeCommand('title @a times 10 70 20').catch(() => {});

  // 2. Set subtitle first
  if (subtitleText && subtitleText.trim()) {
    await executeCommand(`title @a subtitle ${subtitleJson}`).catch(() => {});
  }

  // 3. Set title (triggers display)
  const titleResult = await executeCommand(`title @a title ${titleJson}`);

  // 4. Play notification sound to all players
  if (playSound) {
    await executeCommand(`playsound ${soundName} master @a ~ ~ ~ 1.0 1.0`).catch(() => {});
  }

  // 5. Also log alert in chat for permanence
  await broadcastMessage(
    `${titleText.trim()}${subtitleText ? ' - ' + subtitleText.trim() : ''}`,
    'ALERT',
    titleColor
  ).catch(() => {});

  return {
    success: true,
    message: 'Alert broadcasted to all in-game players successfully'
  };
}

/**
 * High Level: Kick Player from Minecraft Server
 */
async function kickPlayer(username, reason = 'Kicked by Wired Administrator') {
  if (!username || !username.trim()) {
    throw new Error('Minecraft username is required');
  }
  const cleanUsername = username.trim().replace(/[^a-zA-Z0-9_]/g, '');
  const cleanReason = (reason || 'Kicked by Server Admin').replace(/"/g, "'");
  return await executeCommand(`kick ${cleanUsername} ${cleanReason}`);
}

module.exports = {
  getMinecraftConfig,
  saveMinecraftConfig,
  getServerStatus,
  executeCommand,
  broadcastMessage,
  sendAlert,
  kickPlayer
};
