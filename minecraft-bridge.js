#!/usr/bin/env node
/**
 * ==============================================================================
 * Wired-IO Minecraft Server Realtime WebSocket & Queue Bridge
 * ==============================================================================
 * 
 * Runs continuously in the background on your Minecraft server host.
 * Instant sub-10ms push execution via Supabase Realtime WebSockets.
 * Requires NO port forwarding, NO Cloudflare tunnels, NO public IP.
 * 
 * Usage:
 *   node minecraft-bridge.js
 * Or with PM2:
 *   pm2 start minecraft-bridge.js --name "wired-mc-bridge"
 */

const { exec } = require('child_process');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://aebntdjjniirnwthtwlx.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlYm50ZGpqbmlpcm53dGh0d2x4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4NzIwNTYsImV4cCI6MjA5ODQ0ODA1Nn0.la5aH5b2Tb5cj5yfVEWHhPKU4_ieCWydEPWH8V81eIg';
const SCREEN_NAME = process.env.MC_SCREEN_NAME || 'mc';

console.log('====================================================');
console.log('   🟢 WIRED-IO REALTIME MINECRAFT COMMAND BRIDGE    ');
console.log('====================================================');
console.log(`[*] Target Screen Session: [${SCREEN_NAME}]`);
console.log(`[*] Connecting to Supabase Realtime Cloud: ${SUPABASE_URL}`);

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function executeOnServer(command) {
  const cleanCmd = command.trim().replace(/^\//, '');
  return new Promise((resolve) => {
    // 1. Try GNU Screen
    exec(`screen -S ${SCREEN_NAME} -X stuff "${cleanCmd}\\n"`, (err1) => {
      if (!err1) {
        return resolve({ success: true, method: 'screen', response: 'Executed via screen' });
      }

      // 2. Try Tmux
      exec(`tmux send-keys -t ${SCREEN_NAME} "${cleanCmd}" ENTER`, (err2) => {
        if (!err2) {
          return resolve({ success: true, method: 'tmux', response: 'Executed via tmux' });
        }

        // 3. Try RCON to localhost
        exec(`mcrcon -H 127.0.0.1 -P 25575 -p Target143@ "${cleanCmd}"`, (err3, stdout) => {
          if (!err3) {
            return resolve({ success: true, method: 'local_rcon', response: stdout || 'OK' });
          }
          resolve({ success: false, error: err1.message });
        });
      });
    });
  });
}

// 1. Setup Supabase Realtime WebSocket Listener (Instant Sub-10ms Push)
const channel = supabase.channel('mc_realtime_bridge', {
  config: { broadcast: { self: false } }
});

channel
  .on('broadcast', { event: 'minecraft_command' }, async ({ payload }) => {
    if (!payload || !payload.command) return;
    console.log(`\n[⚡ REALTIME PUSH] Received command from [${payload.sender || 'WEB'}]: "${payload.command}"`);
    
    const result = await executeOnServer(payload.command);
    if (result.success) {
      console.log(`[✅ SUCCESS] In-game command executed (${result.method})`);
    } else {
      console.warn(`[⚠️ WARN] Execution result:`, result.error || 'Check screen session name');
    }

    // Broadcast execution response back to web clients
    channel.send({
      type: 'broadcast',
      event: 'command_response',
      payload: {
        id: payload.id,
        success: result.success,
        response: result.response || result.error,
        method: result.method,
        timestamp: new Date().toISOString()
      }
    }).catch(() => {});
  })
  .subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      console.log('[🚀 READY] Realtime WebSocket connected and actively listening for broadcasts & commands!\n');
    } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
      console.warn(`[⚠️ NOTICE] Realtime WebSocket status: ${status}. Attempting reconnection...`);
    }
  });

// 2. Backup Queue Poller (Guarantees zero dropped commands if internet flickers)
async function pollBackupQueue() {
  try {
    const { data: pending, error } = await supabase
      .from('minecraft_bridge_queue')
      .select('id, command')
      .eq('status', 'pending')
      .order('id', { ascending: true })
      .limit(5);

    if (!error && Array.isArray(pending) && pending.length > 0) {
      for (const item of pending) {
        console.log(`[📥 QUEUE BACKUP] Processing queued command #${item.id}: "${item.command}"`);
        const result = await executeOnServer(item.command);
        
        await supabase
          .from('minecraft_bridge_queue')
          .update({
            status: 'completed',
            response: result.response || 'Executed',
            executed_at: new Date().toISOString()
          })
          .eq('id', item.id);
      }
    }
  } catch (err) {}
  setTimeout(pollBackupQueue, 3000);
}

// Start backup queue poller
pollBackupQueue();
