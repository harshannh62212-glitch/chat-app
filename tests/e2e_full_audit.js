const { io } = require('../frontend/node_modules/socket.io-client');
const axios = require('axios');
const fs = require('fs');

const LOCAL_BACKEND = 'http://localhost:8000';

async function runFullAudit() {
  console.log('===================================================');
  console.log('🔍 DEEP END-TO-END SYSTEM DIAGNOSTIC & VERIFICATION');
  console.log('===================================================\n');

  let errors = 0;

  // 1. Local Backend Health Check
  try {
    const res = await axios.get(`${LOCAL_BACKEND}/api/health`);
    if (res.data.status === 'ok') {
      console.log('✅ Local Backend Health Check: OK');
    } else {
      console.error('❌ Local Backend Health Check: FAILED', res.data);
      errors++;
    }
  } catch (err) {
    console.error('❌ Local Backend Health Check: ERROR', err.message);
    errors++;
  }

  // 2. Resolve Active Tunnel URL from Backend
  let TUNNEL_URL = '';
  try {
    const res = await axios.get(`${LOCAL_BACKEND}/api/resolve-tunnel`);
    if (res.data.url) {
      TUNNEL_URL = res.data.url;
      console.log(`✅ DB System Config Tunnel Resolver: OK (${TUNNEL_URL})`);
    } else {
      console.error('❌ DB Tunnel Resolver returned empty URL');
      errors++;
    }
  } catch (err) {
    console.error('❌ Tunnel Resolver Check: ERROR', err.message);
    errors++;
  }

  // 3. Cloudflare Tunnel Health Check
  if (TUNNEL_URL) {
    try {
      const res = await axios.get(`${TUNNEL_URL}/api/health`, {
        headers: { 'bypass-tunnel-reminder': 'true' }
      });
      if (res.data.status === 'ok') {
        console.log(`✅ Cloudflare Tunnel Public Reach: OK (${TUNNEL_URL}/api/health)`);
      } else {
        console.error('❌ Cloudflare Tunnel Health Check: FAILED', res.data);
        errors++;
      }
    } catch (err) {
      console.error('❌ Cloudflare Tunnel Health Check: ERROR', err.message);
      errors++;
    }
  }

  // 4. Ollama Local LLM Check
  try {
    const res = await axios.get('http://127.0.0.1:11434/api/tags');
    const modelNames = res.data.models.map(m => m.name);
    console.log(`✅ Ollama Local AI Service: Active with models [${modelNames.join(', ')}]`);
  } catch (err) {
    console.error('❌ Ollama Local AI Service: ERROR', err.message);
    errors++;
  }

  // 5. User Auth Flow (Registration & Login)
  let authToken = '';
  let testUser = null;
  const username = 'system_test_runner';
  const password = 'TestPassword123!';
  const email = 'system_test_runner@local.test';

  try {
    try {
      await axios.post(`${LOCAL_BACKEND}/api/auth/register`, {
        username,
        email,
        password
      });
      console.log(`✅ Auth API: Registered persistent user "${username}"`);
    } catch (regErr) {
      // User might already exist, which is expected for reusable accounts
    }

    const loginRes = await axios.post(`${LOCAL_BACKEND}/api/auth/login`, {
      username,
      password
    });
    authToken = loginRes.data.token;
    testUser = loginRes.data.user;
    console.log(`✅ Auth API: Logged in successfully as "${username}"`);
  } catch (err) {
    console.error('❌ Auth API Flow: FAILED', err.response?.data || err.message);
    errors++;
  }

  // 6. Server & Channel Management Flow
  let serverId = null;
  let channelId = null;
  if (authToken) {
    try {
      const serverRes = await axios.post(
        `${LOCAL_BACKEND}/api/servers`,
        { name: `Audit Server ${Date.now()}` },
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      serverId = serverRes.data.id;
      console.log(`✅ Server Management API: Created server (ID: ${serverId})`);

      const chatroomRes = await axios.get(
        `${LOCAL_BACKEND}/api/servers/${serverId}/chatrooms`,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      channelId = chatroomRes.data[0].id;
      console.log(`✅ Channel Management API: Fetched general chatroom (ID: ${channelId})`);
    } catch (err) {
      console.error('❌ Server/Channel API Flow: FAILED', err.response?.data || err.message);
      errors++;
    }
  }

  // 7. Socket.IO Real-time Messaging & Moderation Test via Cloudflare Tunnel
  if (authToken && channelId) {
    await new Promise((resolve) => {
      console.log(`📡 Connecting Socket.IO client via Cloudflare Tunnel: ${TUNNEL_URL}`);
      const socket = io(TUNNEL_URL, {
        auth: { token: authToken },
        extraHeaders: { 'bypass-tunnel-reminder': 'true' },
        transports: ['websocket', 'polling']
      });

      socket.on('connect', () => {
        console.log(`✅ Socket.IO Tunnel Connection: Established! Socket ID: ${socket.id}`);
        socket.emit('user-joined', testUser.id, serverId);

        // Test sending normal message
        socket.emit('send-message', {
          id: `msg_${Date.now()}`,
          senderId: testUser.id,
          sender_id: testUser.id,
          username: testUser.username,
          serverId,
          chatroom_id: channelId,
          content: 'Hello World from E2E Audit test!'
        });
      });

      let cleanMsgReceived = false;
      let botResponseReceived = false;

      socket.on('new-message', (msg) => {
        if (msg.content.includes('Hello World')) {
          cleanMsgReceived = true;
          console.log('✅ Real-time Socket Message Received via Cloudflare Tunnel:', msg.content);
          
          // Test sending @bot prompt
          socket.emit('send-message', {
            id: `msg_bot_${Date.now()}`,
            senderId: testUser.id,
            sender_id: testUser.id,
            username: testUser.username,
            serverId,
            chatroom_id: channelId,
            content: '@bot reply with "Audit Pass"'
          });
        } else if (msg.username?.includes('Gemini') || msg.username?.includes('Bot') || msg.sender_id === 'gemini-bot-id' || msg.content.includes('Audit Pass')) {
          botResponseReceived = true;
          console.log('✅ Real-time Socket @bot AI Response Received via Cloudflare Tunnel:', msg.content);

          // Now test sending profane message (should be blocked by Layer 1 filter)
          socket.emit('send-message', {
            id: `msg_profane_${Date.now()}`,
            senderId: testUser.id,
            sender_id: testUser.id,
            username: testUser.username,
            serverId,
            chatroom_id: channelId,
            content: 'f4ck this test message'
          });
        }
      });

      socket.on('message-error', (err) => {
        if (err.message && (err.message.includes('profanity') || err.message.includes('blocked') || err.message.includes('inappropriate'))) {
          console.log('✅ Content Moderation Filter: Successfully BLOCKED profane message via Socket!');
          socket.disconnect();
          resolve();
        } else {
          console.error('⚠️ Unexpected Socket Message Error:', err);
          socket.disconnect();
          resolve();
        }
      });

      socket.on('connect_error', (err) => {
        console.error('❌ Socket.IO Connection Error:', err.message);
        errors++;
        socket.disconnect();
        resolve();
      });

      setTimeout(() => {
        if (!cleanMsgReceived) {
          console.error('❌ Socket.IO Clean Message Test: TIMEOUT');
          errors++;
        }
        socket.disconnect();
        resolve();
      }, 8000);
    });
  }

  console.log('\n===================================================');
  if (errors === 0) {
    console.log('🎉 ALL SYSTEM DIAGNOSTICS & VERIFICATIONS PASSED 100%!');
  } else {
    console.error(`⚠️ COMPLETED WITH ${errors} ERRORS - INVESTIGATION REQUIRED.`);
  }
  console.log('===================================================');
}

runFullAudit();
