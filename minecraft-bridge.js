#!/usr/bin/env node
/**
 * Wired-IO Minecraft Server Automatic Bridge
 * 
 * Runs on your Minecraft server host machine (Latitude / Linux / Windows / Mac).
 * Requires NO port-forwarding or public RCON exposure.
 * Directly connects to Supabase database queue and automatically relays in-game broadcasts,
 * title alerts, player kicks, and admin console commands directly to Minecraft.
 */

const { exec } = require('child_process');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://aebntdjjniirnwthtwlx.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlYm50ZGpqbmlpcm53dGh0d2x4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4NzIwNTYsImV4cCI6MjA5ODQ0ODA1Nn0.la5aH5b2Tb5cj5yfVEWHhPKU4_ieCWydEPWH8V81eIg';
const SCREEN_NAME = process.env.MC_SCREEN_NAME || 'mc'; // GNU Screen session name

console.log('====================================================');
console.log('   🟢 WIRED-IO MINECRAFT AUTOMATIC COMMAND BRIDGE   ');
console.log('====================================================');
console.log(`[*] Connecting to Supabase Cloud: ${SUPABASE_URL}`);
console.log(`[*] Targeting local Minecraft Screen session: [${SCREEN_NAME}]`);
console.log('[*] Listening for in-game broadcasts, alerts, and console commands...\n');

let consecutiveErrors = 0;

async function executeOnServer(command) {
  const cleanCmd = command.trim().replace(/^\//, '');
  return new Promise((resolve) => {
    // 1. Try GNU Screen
    exec(`screen -S ${SCREEN_NAME} -X stuff "${cleanCmd}\\n"`, (err1) => {
      if (!err1) {
        return resolve({ success: true, method: 'screen', response: 'Executed via screen session' });
      }

      // 2. Try Tmux
      exec(`tmux send-keys -t ${SCREEN_NAME} "${cleanCmd}" ENTER`, (err2) => {
        if (!err2) {
          return resolve({ success: true, method: 'tmux', response: 'Executed via tmux session' });
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

async function pollQueue() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/minecraft_bridge_queue?status=eq.pending&order=id.asc&limit=10`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });

    if (res.ok) {
      consecutiveErrors = 0;
      const commands = await res.json();
      if (Array.isArray(commands) && commands.length > 0) {
        for (const item of commands) {
          console.log(`[⚡ RELAY] Executing command #${item.id}: [${item.command}]`);
          const execRes = await executeOnServer(item.command);
          
          if (execRes.success) {
            console.log(`[✅ SUCCESS] Command #${item.id} executed successfully (${execRes.method})`);
          } else {
            console.warn(`[⚠️ WARN] Command #${item.id} execution warning:`, execRes.error);
          }

          // Acknowledge execution in Supabase
          try {
            await fetch(`${SUPABASE_URL}/rest/v1/minecraft_bridge_queue?id=eq.${item.id}`, {
              method: 'PATCH',
              headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
              },
              body: JSON.stringify({
                status: 'completed',
                response: execRes.response || 'Executed',
                executed_at: new Date().toISOString()
              })
            });
          } catch (ackErr) {
            console.error('Failed to acknowledge command in Supabase:', ackErr.message);
          }
        }
      }
    }
  } catch (err) {
    consecutiveErrors++;
    if (consecutiveErrors === 1) {
      console.warn('[!] Network check connecting to Supabase queue. Retrying in background...');
    }
  }

  setTimeout(pollQueue, 1500);
}

// Start polling loop
pollQueue();
