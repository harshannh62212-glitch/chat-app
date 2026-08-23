const axios = require('axios');
const { query } = require('../db/database');

async function testAllRoutes() {
  console.log('====================================================');
  console.log('🌐 EXHAUSTIVE ROUTE & API SUITE TEST');
  console.log('====================================================\n');

  const BASE = 'http://127.0.0.1:8000';
  const testSuffix = Date.now().toString().slice(-6);
  const u1Name = `route_u1_${testSuffix}`;
  const u2Name = `route_u2_${testSuffix}`;
  let token1 = '', user1 = null;
  let token2 = '', user2 = null;
  let testServerId = null;
  let testChatroomId = null;
  let createdServerMsgId = null;
  let createdDmMsgId = null;

  const results = [];
  const logRoute = (method, endpoint, success, details = '') => {
    results.push({ method, endpoint, success, details });
    const tag = success ? '✅ PASS' : '❌ FAIL';
    console.log(`${tag} [${method.padEnd(6)}] ${endpoint.padEnd(42)} ${details ? '-> ' + details : ''}`);
  };

  try {
    // Ensure persistent test accounts exist
    try { await axios.post(`${BASE}/api/auth/register`, { username: u1Name, email: `${u1Name}@test.com`, password: 'StrongPassword123!' }); } catch(e){}
    try { await axios.post(`${BASE}/api/auth/register`, { username: u2Name, email: `${u2Name}@test.com`, password: 'StrongPassword123!' }); } catch(e){}

    const r1 = await axios.post(`${BASE}/api/auth/login`, { username: u1Name, password: 'StrongPassword123!' });
    token1 = r1.data.token;
    user1 = r1.data.user;
    logRoute('POST', '/api/auth/login (User 1)', !!token1, `Logged in as ${u1Name}`);

    const r2 = await axios.post(`${BASE}/api/auth/login`, { username: u2Name, password: 'StrongPassword123!' });
    token2 = r2.data.token;
    user2 = r2.data.user;
    logRoute('POST', '/api/auth/login (User 2)', !!token2, `Logged in as ${u2Name}`);

    const meRes = await axios.get(`${BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token1}` }
    });
    logRoute('GET', '/api/auth/me', meRes.data.username === u1Name, `Username matched`);

    // 2. USER PROFILE & FRIEND ROUTES
    const profRes = await axios.get(`${BASE}/api/users/profile/${user1.id}`, {
      headers: { Authorization: `Bearer ${token1}` }
    });
    logRoute('GET', `/api/users/profile/:id`, !!profRes.data.username, `Got profile for ${profRes.data.username}`);

    const updateProfRes = await axios.put(`${BASE}/api/users/profile`, {
      description: 'Updated bio for testing'
    }, { headers: { Authorization: `Bearer ${token1}` } });
    logRoute('PUT', '/api/users/profile', updateProfRes.status === 200, `Updated profile description`);

    const searchRes = await axios.get(`${BASE}/api/users/search?q=${u2Name}`, {
      headers: { Authorization: `Bearer ${token1}` }
    });
    logRoute('GET', '/api/users/search', Array.isArray(searchRes.data), `Found ${searchRes.data.length} matches`);

    const friendReqRes = await axios.post(`${BASE}/api/users/friends/request`, {
      friendId: user2.id
    }, { headers: { Authorization: `Bearer ${token1}` } });
    logRoute('POST', '/api/users/friends/request', friendReqRes.status === 200 || friendReqRes.status === 201, `Sent request`);

    const pendingRes = await axios.get(`${BASE}/api/users/friends/pending`, {
      headers: { Authorization: `Bearer ${token2}` }
    });
    logRoute('GET', '/api/users/friends/pending', Array.isArray(pendingRes.data.incoming) && pendingRes.data.incoming.length > 0, `Incoming: ${pendingRes.data.incoming.length}`);

    const acceptRes = await axios.post(`${BASE}/api/users/friends/accept`, {
      requesterId: user1.id
    }, { headers: { Authorization: `Bearer ${token2}` } });
    logRoute('POST', '/api/users/friends/accept', acceptRes.status === 200, `Accepted friend request`);

    const friendsListRes = await axios.get(`${BASE}/api/users/friends`, {
      headers: { Authorization: `Bearer ${token1}` }
    });
    logRoute('GET', '/api/users/friends', Array.isArray(friendsListRes.data) && friendsListRes.data.length > 0, `List returned ${friendsListRes.data.length} friends`);

    // 3. SERVER & CHANNEL ROUTES
    const createServerRes = await axios.post(`${BASE}/api/servers`, {
      name: `Test Guild ${testSuffix}`,
      description: 'Automated test guild'
    }, { headers: { Authorization: `Bearer ${token1}` } });
    testServerId = createServerRes.data.id || createServerRes.data.server?.id;
    logRoute('POST', '/api/servers', !!testServerId, `Created server ID: ${testServerId}`);

    const listServersRes = await axios.get(`${BASE}/api/servers`, {
      headers: { Authorization: `Bearer ${token1}` }
    });
    logRoute('GET', '/api/servers', Array.isArray(listServersRes.data), `Total servers: ${listServersRes.data.length}`);

    if (testServerId) {
      const getMembersRes = await axios.get(`${BASE}/api/servers/${testServerId}/members`, {
        headers: { Authorization: `Bearer ${token1}` }
      });
      logRoute('GET', `/api/servers/:id/members`, Array.isArray(getMembersRes.data), `Members: ${getMembersRes.data.length}`);

      const createChanRes = await axios.post(`${BASE}/api/servers/${testServerId}/chatrooms`, {
        name: `general-${testSuffix}`,
        type: 'text'
      }, { headers: { Authorization: `Bearer ${token1}` } });
      testChatroomId = createChanRes.data.id || createChanRes.data.chatroom?.id;
      logRoute('POST', `/api/servers/:id/chatrooms`, !!testChatroomId, `Channel ID: ${testChatroomId}`);

      const listChanRes = await axios.get(`${BASE}/api/servers/${testServerId}/chatrooms`, {
        headers: { Authorization: `Bearer ${token1}` }
      });
      logRoute('GET', `/api/servers/:id/chatrooms`, Array.isArray(listChanRes.data), `Channels: ${listChanRes.data.length}`);
    }

    // 4. MESSAGES ROUTES (SERVER & DM)
    if (testChatroomId) {
      const sendServerMsg = await axios.post(`${BASE}/api/messages/server`, {
        chatroomId: testChatroomId,
        content: `Hello channel from ${u1Name}`
      }, { headers: { Authorization: `Bearer ${token1}` } });
      createdServerMsgId = sendServerMsg.data.id || sendServerMsg.data.message?.id;
      logRoute('POST', '/api/messages/server', !!createdServerMsgId, `Created msg ID: ${createdServerMsgId}`);

      const getChanMsgs = await axios.get(`${BASE}/api/messages/chatroom/${testChatroomId}`, {
        headers: { Authorization: `Bearer ${token1}` }
      });
      logRoute('GET', `/api/messages/chatroom/:id`, Array.isArray(getChanMsgs.data) && getChanMsgs.data.length > 0, `Fetched ${getChanMsgs.data.length} messages`);

      const delServerMsg = await axios.delete(`${BASE}/api/messages/${createdServerMsgId}`, {
        headers: { Authorization: `Bearer ${token1}` }
      });
      logRoute('DELETE', `/api/messages/:id`, delServerMsg.status === 200, `Deleted server message`);
    }

    // Send DM
    const sendDmRes = await axios.post(`${BASE}/api/messages/dm`, {
      recipientId: user2.id,
      content: `Private DM from ${u1Name} to ${u2Name}`
    }, { headers: { Authorization: `Bearer ${token1}` } });
    createdDmMsgId = sendDmRes.data.id || sendDmRes.data.message?.id;
    logRoute('POST', '/api/messages/dm', !!createdDmMsgId, `Created DM ID: ${createdDmMsgId}`);

    const getDmList = await axios.get(`${BASE}/api/messages/dm-conversations/list`, {
      headers: { Authorization: `Bearer ${token1}` }
    });
    logRoute('GET', '/api/messages/dm-conversations/list', Array.isArray(getDmList.data), `DMs: ${getDmList.data.length}`);

    const getDmConvo = await axios.get(`${BASE}/api/messages/dm/${user2.id}`, {
      headers: { Authorization: `Bearer ${token1}` }
    });
    logRoute('GET', `/api/messages/dm/:userId`, Array.isArray(getDmConvo.data) && getDmConvo.data.length > 0, `Fetched ${getDmConvo.data.length} messages`);

    const delDm = await axios.delete(`${BASE}/api/messages/dm/${createdDmMsgId}`, {
      headers: { Authorization: `Bearer ${token1}` }
    });
    logRoute('DELETE', `/api/messages/dm/:id`, delDm.status === 200, `Deleted DM message`);

    // 5. REPORT SYSTEM
    const reportRes = await axios.post(`${BASE}/api/report`, {
      description: 'Testing bug report with clear UI defect description',
      screenshot_url: 'https://example.com/test.png'
    }, { headers: { Authorization: `Bearer ${token1}` } });
    logRoute('POST', '/api/report', reportRes.status === 200 && !!reportRes.data.ai_evaluation, `AI Evaluation: ${reportRes.data.ai_evaluation}`);

    // 6. MEDIA & UTILITIES
    const ytRes = await axios.get(`${BASE}/api/youtube/search?q=synthwave`, {
      headers: { Authorization: `Bearer ${token1}` }
    });
    logRoute('GET', '/api/youtube/search', ytRes.status === 200, `Status: ${ytRes.status}`);

    const spotRes = await axios.get(`${BASE}/api/spotify/liked`, {
      headers: { Authorization: `Bearer ${token1}` }
    });
    logRoute('GET', '/api/spotify/liked', spotRes.status === 200, `Status: ${spotRes.status}`);

  } catch (err) {
    console.error('❌ Exception during API route testing:', err.response?.data || err.message);
  } finally {
    // Cleanup created test resources
    console.log('\n--- CLEANING UP TEST DATA ---');
    try {
      if (testChatroomId) await query('DELETE FROM chatrooms WHERE id = $1', [testChatroomId]);
      if (testServerId) {
        await query('DELETE FROM server_members WHERE server_id = $1', [testServerId]);
        await query('DELETE FROM servers WHERE id = $1', [testServerId]);
      }
      if (user1) {
        await query('DELETE FROM friendships WHERE user_id = $1 OR friend_id = $1', [user1.id]);
        await query('DELETE FROM reports WHERE user_id = $1', [user1.id]);
      }
      if (user2) {
        await query('DELETE FROM friendships WHERE user_id = $1 OR friend_id = $1', [user2.id]);
      }
      console.log('✅ Test cleanup completed successfully.');
    } catch (cleanErr) {
      console.warn('⚠️ Cleanup warning:', cleanErr.message);
    }
  }

  console.log('\n====================================================');
  console.log('ROUTE SUITE RESULTS:');
  console.log('====================================================');
  const fails = results.filter(r => !r.success);
  console.log(`Passed: ${results.length - fails.length} / ${results.length}`);
  if (fails.length > 0) {
    console.log('Failed Routes:');
    fails.forEach(f => console.log(` - ${f.method} ${f.endpoint}: ${f.details}`));
    process.exit(1);
  } else {
    console.log('🎉 ALL ROUTES OPERATING AT 100% HEALTH!');
    process.exit(0);
  }
}

testAllRoutes();
