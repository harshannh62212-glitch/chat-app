const axios = require('axios');
const { io } = require('../frontend/node_modules/socket.io-client');
const { query } = require('../db/database');
const { containsBannedWords, filterContent } = require('../utils/contentFilter');
const fs = require('fs');

async function testEverything() {
  console.log('====================================================');
  console.log('🧪 DEEP FULL-SYSTEM E2E AUDIT & VALIDATION');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;
  const errors = [];

  function check(name, ok, details = '') {
    if (ok) {
      passed++;
      console.log(`✅ [PASS] ${name}${details ? ': ' + details : ''}`);
    } else {
      failed++;
      console.error(`❌ [FAIL] ${name}${details ? ': ' + details : ''}`);
      errors.push({ name, details });
    }
  }

  // 1. Database tests
  console.log('--- 1. DATABASE TESTS ---');
  try {
    const t0 = Date.now();
    const uRes = await query('SELECT count(*) FROM users');
    const sRes = await query('SELECT count(*) FROM servers');
    const cRes = await query('SELECT count(*) FROM chatrooms');
    const mRes = await query('SELECT count(*) FROM server_messages');
    const dRes = await query('SELECT count(*) FROM direct_messages');
    const lat = Date.now() - t0;
    check('Database Connection & Query Speed', true, `${lat}ms (Users: ${uRes.rows[0].count}, Servers: ${sRes.rows[0].count}, Chatrooms: ${cRes.rows[0].count}, Msgs: ${mRes.rows[0].count}, DMs: ${dRes.rows[0].count})`);
  } catch (e) {
    check('Database Connection', false, e.message);
  }

  // 2. Server Local Endpoints
  console.log('\n--- 2. SERVER LOCAL ENDPOINTS ---');
  try {
    const health = await axios.get('http://127.0.0.1:8000/api/health', { timeout: 3000 });
    check('Local /api/health', health.status === 200 && health.data.status === 'ok', JSON.stringify(health.data));
  } catch (e) {
    check('Local /api/health', false, e.message);
  }

  try {
    const ping = await axios.get('http://127.0.0.1:8000/ping', { timeout: 3000 });
    check('Local /ping', ping.status === 200 && ping.data.includes('pong'), ping.data);
  } catch (e) {
    check('Local /ping', false, e.message);
  }

  try {
    const status = await axios.get('http://127.0.0.1:8000/api/system/status', { timeout: 3000 });
    check('Local /api/system/status', status.status === 200 && status.data.status === 'active', `CPU: ${status.data.cpu?.usage || status.data.cpu?.load || 'N/A'}, Battery: ${status.data.battery?.percent || 'N/A'}%`);
  } catch (e) {
    check('Local /api/system/status', false, e.message);
  }

  // 3. Cloudflare Tunnel
  console.log('\n--- 3. CLOUDFLARE TUNNEL & PUBLIC NETWORK ---');
  let tunnelUrl = '';
  try {
    const res = await axios.get('http://127.0.0.1:8000/api/resolve-tunnel', { timeout: 3000 });
    tunnelUrl = res.data.url;
    check('Resolve Tunnel URL', !!tunnelUrl, tunnelUrl);
  } catch (e) {
    check('Resolve Tunnel URL', false, e.message);
  }

  if (tunnelUrl) {
    try {
      const pubPing = await axios.get(`${tunnelUrl}/ping`, {
        headers: { 'bypass-tunnel-reminder': 'true' },
        timeout: 8000
      });
      check('Public Tunnel /ping', pubPing.status === 200 && pubPing.data.includes('pong'), `Status: ${pubPing.status}`);
    } catch (e) {
      check('Public Tunnel /ping', false, e.message);
    }

    try {
      const pubHealth = await axios.get(`${tunnelUrl}/api/health`, {
        headers: { 'bypass-tunnel-reminder': 'true' },
        timeout: 8000
      });
      check('Public Tunnel /api/health', pubHealth.status === 200 && pubHealth.data.status === 'ok', `Status: ${pubHealth.status}`);
    } catch (e) {
      check('Public Tunnel /api/health', false, e.message);
    }

    try {
      const pubHtml = await axios.get(`${tunnelUrl}/`, {
        headers: { 'bypass-tunnel-reminder': 'true' },
        timeout: 8000
      });
      check('Public Tunnel Web App HTML', pubHtml.status === 200 && pubHtml.data.includes('<html'), `Received ${pubHtml.data.length} bytes`);
    } catch (e) {
      check('Public Tunnel Web App HTML', false, e.message);
    }
  }

  // 4. Hybrid Model & AI Moderation System
  console.log('\n--- 4. HYBRID MODEL & AI MODERATION SYSTEM ---');
  // Layer 1
  try {
    const clean1 = containsBannedWords('Good morning everyone! Hope you have a wonderful day.');
    const clean2 = containsBannedWords('Can someone explain how to use async/await in JavaScript?');
    const dirty1 = containsBannedWords('what the f*** is this?');
    const dirty2 = containsBannedWords('you are a f4ck1ng b1tch');
    const dirty3 = containsBannedWords('go kys right now');
    const dirty4 = containsBannedWords('check out this pr0n link');

    const l1Pass = !clean1.blocked && !clean2.blocked && dirty1.blocked && dirty2.blocked && dirty3.blocked && dirty4.blocked;
    check('Layer 1 Regex/Heuristic Filter', l1Pass, `Clean allowed: ${!clean1.blocked && !clean2.blocked}, Violations blocked: ${dirty1.blocked && dirty2.blocked && dirty3.blocked && dirty4.blocked}`);
  } catch (e) {
    check('Layer 1 Filter', false, e.message);
  }

  // Layer 2: Ollama Local Models
  try {
    const tStart = Date.now();
    const tagRes = await axios.get('http://127.0.0.1:11434/api/tags', { timeout: 3000 });
    const models = tagRes.data.models.map(m => m.name);
    check('Ollama Local AI Models Available', models.length > 0, `Models: ${models.join(', ')}`);

    // Test inference on local model
    const testModel = models.includes('qwen2.5-coder:7b') ? 'qwen2.5-coder:7b' : models[0];
    const genRes = await axios.post('http://127.0.0.1:11434/api/generate', {
      model: testModel,
      prompt: 'Is the message "I like ice cream" toxic or offensive? Answer strictly in JSON format: {"flagged": false}',
      format: 'json',
      stream: false
    }, { timeout: 10000 });
    const dur = Date.now() - tStart;
    check(`Ollama Local Inference (${testModel})`, genRes.status === 200 && genRes.data.response, `${dur}ms -> ${genRes.data.response.trim()}`);
  } catch (e) {
    check('Ollama Local Inference', false, e.message);
  }

  // Layer 3: Gemini Fallback
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      const geminiModels = [
        process.env.GEMINI_MODERATION_MODEL || 'gemma-4-26b-a4b-it',
        'gemma-4-26b-a4b-it',
        'gemini-3-flash-preview',
        'gemini-3.5-flash-lite',
        'gemini-3.6-flash',
        'gemini-3.1-flash-lite'
      ];
      let geminiSuccess = false;
      let usedModel = '';
      for (const model of geminiModels) {
        try {
          const gemRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(5000),
            body: JSON.stringify({
              contents: [{ parts: [{ text: 'Respond with JSON: {"status": "ok"}' }] }],
              generationConfig: { responseMimeType: 'application/json' }
            })
          });
          if (gemRes.ok) {
            geminiSuccess = true;
            usedModel = model;
            break;
          }
        } catch (e) {}
      }
      check('Gemini Cloud Fallback Model', geminiSuccess, geminiSuccess ? `Active with ${usedModel}` : 'Rate limited / Falling back to Ollama');
    } else {
      check('Gemini Cloud Fallback Model', true, 'Skipped (No API Key set, local Ollama handles)');
    }
  } catch (e) {
    check('Gemini Cloud Fallback Model', false, e.message);
  }

  // 5. Backend REST API End-to-End Workflow
  console.log('\n--- 5. BACKEND REST API END-TO-END WORKFLOW ---');
  let token1 = '', user1 = null;
  let token2 = '', user2 = null;
  const u1Name = 'system_test_runner';
  const u2Name = 'system_test_runner_2';

  try {
    try { await axios.post('http://127.0.0.1:8000/api/auth/register', { username: u1Name, email: `${u1Name}@test.local`, password: 'SecurePassword123!' }); } catch(e){}
    try { await axios.post('http://127.0.0.1:8000/api/auth/register', { username: u2Name, email: `${u2Name}@test.local`, password: 'SecurePassword123!' }); } catch(e){}

    const login1 = await axios.post('http://127.0.0.1:8000/api/auth/login', { username: u1Name, password: 'SecurePassword123!' }).catch(async () => {
      return await axios.post('http://127.0.0.1:8000/api/auth/login', { username: u1Name, password: 'TestPassword123!' });
    });
    token1 = login1.data.token;
    user1 = login1.data.user;
    check('Auth: User 1 Login', !!token1 && user1.username === u1Name, `ID: ${user1.id}`);

    const login2 = await axios.post('http://127.0.0.1:8000/api/auth/login', { username: u2Name, password: 'SecurePassword123!' }).catch(async () => {
      return await axios.post('http://127.0.0.1:8000/api/auth/login', { username: u2Name, password: 'StrongPassword123!' });
    });
    token2 = login2.data.token;
    user2 = login2.data.user;
    check('Auth: User 2 Login', !!token2 && user2.username === u2Name, `ID: ${user2.id}`);

    // Auth Me check
    const me1 = await axios.get('http://127.0.0.1:8000/api/auth/me', {
      headers: { Authorization: `Bearer ${token1}` }
    });
    check('Auth: Verify Session (/api/auth/me)', me1.data.id === user1.id, me1.data.username);

    // List Servers & Channels
    const srvRes = await axios.get('http://127.0.0.1:8000/api/servers', {
      headers: { Authorization: `Bearer ${token1}` }
    });
    check('Servers: List Servers', Array.isArray(srvRes.data) && srvRes.data.length > 0, `Found ${srvRes.data.length} servers`);

    const srvId = srvRes.data[0].id;
    const chanRes = await axios.get(`http://127.0.0.1:8000/api/servers/${srvId}/chatrooms`, {
      headers: { Authorization: `Bearer ${token1}` }
    });
    check('Servers: List Chatrooms', Array.isArray(chanRes.data) && chanRes.data.length > 0, `Found ${chanRes.data.length} channels`);

    const chanId = chanRes.data[0].id;
    const msgListRes = await axios.get(`http://127.0.0.1:8000/api/messages/chatroom/${chanId}`, {
      headers: { Authorization: `Bearer ${token1}` }
    });
    check('Messages: Fetch Chatroom Messages', Array.isArray(msgListRes.data), `Fetched ${msgListRes.data.length} messages`);

    // DM Conversation list
    const dmListRes = await axios.get('http://127.0.0.1:8000/api/messages/dm-conversations/list', {
      headers: { Authorization: `Bearer ${token1}` }
    });
    check('Messages: Fetch DM Conversations', Array.isArray(dmListRes.data), `Fetched ${dmListRes.data.length} DMs`);
  } catch (e) {
    check('Backend REST API', false, e.response?.data?.error || e.message);
  }

  // 6. Socket.IO Real-Time & Interactive Bot Test
  console.log('\n--- 6. SOCKET.IO REAL-TIME & INTERACTIVE BOT TEST ---');
  if (token1 && user1 && token2 && user2) {
    try {
      await new Promise((resolve, reject) => {
        const sock1 = io('http://127.0.0.1:8000', { auth: { token: token1 } });
        const sock2 = io('http://127.0.0.1:8000', { auth: { token: token2 } });

        let s1Connected = false;
        let s2Connected = false;
        let s2ReceivedMsg = false;
        let botReplied = false;

        const cleanup = () => {
          sock1.disconnect();
          sock2.disconnect();
          resolve();
        };

        const timeout = setTimeout(() => {
          if (!s2ReceivedMsg) {
            check('Socket.IO User-to-User Message Delivery', false, 'Timed out waiting for socket message');
          }
          if (!botReplied) {
            check('Socket.IO AI Bot Response', false, 'Timed out waiting for bot response');
          }
          cleanup();
        }, 15000);

        sock1.on('connect', () => {
          s1Connected = true;
          sock1.emit('user-joined', user1.id, 1);
          if (s1Connected && s2Connected) sendTestMsgs();
        });

        sock2.on('connect', () => {
          s2Connected = true;
          sock2.emit('user-joined', user2.id, 1);
          if (s1Connected && s2Connected) sendTestMsgs();
        });

        function sendTestMsgs() {
          const testText = `Hello from Alice ${Date.now()}`;
          sock1.emit('send-message', {
            id: `msg_test_${Date.now()}`,
            senderId: user1.id,
            sender_id: user1.id,
            username: user1.username,
            serverId: 1,
            chatroom_id: 1,
            content: testText
          });

          // Also trigger @bot
          setTimeout(() => {
            sock1.emit('send-message', {
              id: `msg_bot_${Date.now()}`,
              senderId: user1.id,
              sender_id: user1.id,
              username: user1.username,
              serverId: 1,
              chatroom_id: 1,
              content: '@bot calculate 25 * 4 and answer in one word'
            });
          }, 500);
        }

        sock2.on('new-message', (msg) => {
          if (msg.sender_id === user1.id) {
            s2ReceivedMsg = true;
            check('Socket.IO User-to-User Message Delivery', true, `Received "${msg.content}"`);
          }
          if (msg.sender_id === 'gemini-bot-id' || msg.username?.includes('Bot') || msg.username?.includes('Gemini')) {
            botReplied = true;
            check('Socket.IO AI Bot Response', true, `Bot answered: "${msg.content.trim()}"`);
            clearTimeout(timeout);
            cleanup();
          }
        });
      });
    } catch (e) {
      check('Socket.IO Real-time Communication', false, e.message);
    }
  }

  // 7. Cleanup Test Data (Keep persistent test accounts)
  if (user1 && user2) {
    try {
      await query('DELETE FROM friendships WHERE user_id IN ($1, $2) OR friend_id IN ($1, $2)', [user1.id, user2.id]);
    } catch (e) {}
  }

  // 8. Final Report
  console.log('\n====================================================');
  console.log('AUDIT SUMMARY');
  console.log('====================================================');
  console.log(`TOTAL CHECKS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  if (errors.length > 0) {
    console.log('\nFAILED ITEMS:');
    errors.forEach(e => console.log(`- ${e.name}: ${e.details}`));
  }
  console.log('====================================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

testEverything();
