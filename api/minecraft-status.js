import net from 'net';
import dns from 'dns';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const targetHost = req.query.host || 'atoms-fools.tun.ply.gg';
  let host = targetHost;
  let port = parseInt(req.query.port, 10) || 25565;
  let connectIp = host;

  if (host.includes(':')) {
    const parts = host.split(':');
    host = parts[0];
    port = parseInt(parts[1], 10) || port;
  }

  // 1. Resolve SRV record
  if (port === 25565 && !net.isIP(host)) {
    try {
      const srvs = await dns.promises.resolveSrv(`_minecraft._tcp.${host}`);
      if (srvs && srvs.length > 0) {
        host = srvs[0].name;
        port = srvs[0].port;
      }
    } catch (e) {}
  }

  // 2. Resolve IPv4
  try {
    if (!net.isIP(host)) {
      const ips = await dns.promises.resolve4(host);
      if (ips && ips.length > 0) {
        connectIp = ips[0];
      }
    } else {
      connectIp = host;
    }
  } catch (e) {
    connectIp = host;
  }

  // 3. Perform SLP Ping
  const pingSLP = () => new Promise(async (resolve) => {
    const startTime = Date.now();
    const socket = new net.Socket();
    let isFinished = false;
    let buf = Buffer.alloc(0);

    const finish = async (result) => {
      if (isFinished) return;
      isFinished = true;
      socket.destroy();

      if (result && result.online) {
        return resolve(result);
      }

      // HTTP fallback via minetools.eu for serverless
      try {
        const httpRes = await fetch(`https://api.minetools.eu/ping/${encodeURIComponent(host)}/${port}`);
        if (httpRes.ok) {
          const data = await httpRes.json();
          if (!data.error && data.version) {
            let motd = '';
            if (typeof data.description === 'string') motd = data.description;
            else if (data.description?.text) motd = data.description.text;

            return resolve({
              online: true,
              version: data.version?.name || '1.21.11',
              motd: motd || 'Wired-IO Private Minecraft Server',
              players: {
                online: data.players?.online || 0,
                max: data.players?.max || 20,
                sample: Array.isArray(data.players?.sample) ? data.players.sample : []
              },
              latency: Math.round(data.latency || 120),
              host: targetHost,
              port,
              source: 'minetools_api'
            });
          }
        }
      } catch (httpErr) {}

      resolve(result || { online: false, host: targetHost, port });
    };

    socket.setTimeout(2500);

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

    socket.on('connect', () => {
      const hostBuffer = Buffer.from(targetHost, 'utf8');
      const portBuffer = Buffer.alloc(2);
      portBuffer.writeUInt16BE(port);

      const handshakeData = Buffer.concat([
        Buffer.from([0x00]),
        writeVarInt(765),
        writeVarInt(hostBuffer.length),
        hostBuffer,
        portBuffer,
        writeVarInt(1)
      ]);

      const handshakePacket = Buffer.concat([writeVarInt(handshakeData.length), handshakeData]);
      const requestPacket = Buffer.from([0x01, 0x00]);
      socket.write(Buffer.concat([handshakePacket, requestPacket]));
    });

    socket.on('data', (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      try {
        let offset = 0;
        const readVarInt = () => {
          let numRead = 0, result = 0, read;
          do {
            if (offset >= buf.length) return null;
            read = buf.readUInt8(offset++);
            const value = read & 0x7f;
            result |= value << (7 * numRead);
            numRead++;
            if (numRead > 5) throw new Error('VarInt is too big');
          } while ((read & 0x80) !== 0);
          return result;
        };

        const packetLength = readVarInt();
        const packetId = readVarInt();
        const jsonLength = readVarInt();
        if (jsonLength !== null && buf.length - offset >= jsonLength) {
          const jsonStr = buf.slice(offset, offset + jsonLength).toString('utf8');
          const parsed = JSON.parse(jsonStr);
          const latency = Date.now() - startTime;
          
          let motd = '';
          if (typeof parsed.description === 'string') motd = parsed.description;
          else if (parsed.description?.text) motd = parsed.description.text;
          else if (Array.isArray(parsed.description?.extra)) {
            motd = parsed.description.extra.map(e => (typeof e === 'string' ? e : e.text || '')).join('');
          }

          finish({
            online: true,
            version: parsed.version?.name || '1.21.11',
            motd: motd || 'Wired-IO Private Minecraft Server',
            players: {
              online: parsed.players?.online || 0,
              max: parsed.players?.max || 20,
              sample: parsed.players?.sample || []
            },
            latency,
            host: targetHost,
            port,
            source: 'native_slp'
          });
        }
      } catch (e) {}
    });

    socket.on('timeout', () => finish({ online: false, host: targetHost, port, error: 'timeout' }));
    socket.on('error', (err) => finish({ online: false, host: targetHost, port, error: err.message }));

    socket.connect(port, connectIp);
  });

  const result = await pingSLP();
  return res.status(200).json(result);
}
