#!/usr/bin/env node
/**
 * Wired-IO Minecraft Server Automatic Bridge
 * 
 * Runs on your Minecraft server host machine (Latitude / Linux / Windows / Mac).
 * Requires NO port-forwarding or public RCON exposure.
 * Outbound connects to the Wired-IO backend and automatically relays in-game broadcasts,
 * title alerts, player kicks, and admin console commands directly to Minecraft.
 */

const { exec } = require('child_process');

const BACKEND_URL = process.env.WIRED_BACKEND_URL || 'https://chat-app-backend-render.onrender.com';
const SCREEN_NAME = process.env.MC_SCREEN_NAME || 'mc'; // GNU Screen session name

console.log('====================================================');
console.log('   🟢 WIRED-IO MINECRAFT AUTOMATIC COMMAND BRIDGE   ');
console.log('====================================================');
console.log(`[*] Connecting to Wired-IO Backend: ${BACKEND_URL}`);
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
    const res = await fetch(`${BACKEND_URL}/api/minecraft/bridge/poll`);
    if (res.ok) {
      consecutiveErrors = 0;
      const data = await res.json();
      if (data && Array.isArray(data.commands) && data.commands.length > 0) {
        for (const item of data.commands) {
          console.log(`[⚡ RELAY] Executing command #${item.id}: [${item.command}]`);
          const execRes = await executeOnServer(item.command);
          
          if (execRes.success) {
            console.log(`[✅ SUCCESS] Command #${item.id} executed successfully (${execRes.method})`);
          } else {
            console.warn(`[⚠️ WARN] Command #${item.id} execution warning:`, execRes.error);
          }

          // Acknowledge execution
          try {
            await fetch(`${BACKEND_URL}/api/minecraft/bridge/ack`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: item.id, response: execRes.response || 'Executed' })
            });
          } catch (ackErr) {}
        }
      }
    }
  } catch (err) {
    consecutiveErrors++;
    if (consecutiveErrors === 1) {
      console.warn('[!] Temporary network hiccup connecting to cloud backend. Retrying in background...');
    }
  }

  setTimeout(pollQueue, 1500);
}

// Start polling loop
pollQueue();
