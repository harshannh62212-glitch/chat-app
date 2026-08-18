const { query } = require('../db/database');
const axios = require('axios');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

async function runPermissionTests() {
  console.log('--- Testing Granular Server Role Permission Functions ---');

  // 1. Get a non-general server (e.g. server id 4 or 2)
  const serverRes = await query('SELECT id, owner_id FROM servers WHERE id != 1 LIMIT 1');
  const targetServer = serverRes.rows[0];
  console.log(`Target Server #${targetServer.id} (Owner: ${targetServer.owner_id})`);

  // Get another user to test as a non-owner member
  const otherUserRes = await query('SELECT id, username FROM users WHERE id != $1 LIMIT 1', [targetServer.owner_id]);
  const otherUser = otherUserRes.rows[0];
  console.log(`Test Member: @${otherUser.username} (${otherUser.id})`);

  // Ensure otherUser is in server_members
  await query(
    'INSERT INTO server_members (server_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [targetServer.id, otherUser.id]
  );

  const ownerToken = jwt.sign({ userId: targetServer.owner_id }, JWT_SECRET, { expiresIn: '1h' });
  const memberToken = jwt.sign({ userId: otherUser.id }, JWT_SECRET, { expiresIn: '1h' });

  const ownerHeaders = { Authorization: `Bearer ${ownerToken}` };
  const memberHeaders = { Authorization: `Bearer ${memberToken}` };

  // TEST 1: Member tries to create channel without permission -> MUST FAIL 403
  try {
    await axios.post(
      `http://localhost:8000/api/servers/${targetServer.id}/chatrooms`,
      { name: 'unauthorized-channel' },
      { headers: memberHeaders }
    );
    throw new Error('Unauthorized channel creation succeeded!');
  } catch (err) {
    if (err.response && err.response.status === 403) {
      console.log('✅ Unpermitted member channel creation blocked (403)');
    } else {
      throw err;
    }
  }

  // TEST 2: Owner creates Role with manage_channels, manage_messages, kick_members
  const roleRes = await axios.post(
    `http://localhost:8000/api/servers/${targetServer.id}/roles`,
    {
      name: 'Server Admin Officer',
      color: '#EB459E',
      hoist: true,
      permissions: {
        administrator: false,
        manage_roles: true,
        manage_channels: true,
        manage_messages: true,
        kick_members: true
      }
    },
    { headers: ownerHeaders }
  );
  const officerRole = roleRes.data;
  console.log('✅ Created Officer Role with permissions:', officerRole.id);

  // TEST 3: Owner grants Officer Role to member
  await axios.post(
    `http://localhost:8000/api/servers/${targetServer.id}/members/${otherUser.id}/roles/${officerRole.id}`,
    {},
    { headers: ownerHeaders }
  );
  console.log(`✅ Granted Officer Role to @${otherUser.username}`);

  // TEST 4: Now member tries to create channel -> MUST SUCCEED (manage_channels permission)
  const channelRes = await axios.post(
    `http://localhost:8000/api/servers/${targetServer.id}/chatrooms`,
    { name: 'officer-lounge' },
    { headers: memberHeaders }
  );
  const createdChannel = channelRes.data;
  console.log('✅ Role holder successfully created channel:', createdChannel.name);

  // TEST 5: Owner posts a test message in that channel
  const postMsgRes = await axios.post(
    'http://localhost:8000/api/messages/server',
    { chatroomId: createdChannel.id, content: 'Testing message deletion by role holder' },
    { headers: ownerHeaders }
  );
  const ownerMsg = postMsgRes.data;
  console.log('✅ Owner posted message:', ownerMsg.id);

  // TEST 6: Member with manage_messages deletes owner message -> MUST SUCCEED
  await axios.delete(
    `http://localhost:8000/api/messages/${ownerMsg.id}`,
    { headers: memberHeaders }
  );
  console.log('✅ Role holder successfully deleted message using manage_messages permission');

  // TEST 7: Member deletes the created channel -> MUST SUCCEED
  await axios.delete(
    `http://localhost:8000/api/servers/${targetServer.id}/chatrooms/${createdChannel.id}`,
    { headers: memberHeaders }
  );
  console.log('✅ Role holder successfully deleted channel using manage_channels permission');

  // TEST 8: Clean up role
  await axios.delete(
    `http://localhost:8000/api/servers/${targetServer.id}/roles/${officerRole.id}`,
    { headers: ownerHeaders }
  );
  console.log('✅ Role cleaned up successfully');

  console.log('🎉 ALL GRANULAR ROLE PERMISSION FUNCTIONS VERIFIED AND WORKING!');
  process.exit(0);
}

runPermissionTests().catch(err => {
  console.error('Test failed:', err.response?.data || err.message);
  process.exit(1);
});
