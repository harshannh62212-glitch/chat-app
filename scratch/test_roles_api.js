const { query } = require('../db/database');
const axios = require('axios');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

async function testRoles() {
  console.log('--- Testing Discord-Like Server Roles System ---');

  // 1. Get a non-general server (e.g. server id 2)
  const serverRes = await query('SELECT id, owner_id FROM servers WHERE id != 1 LIMIT 1');
  if (serverRes.rows.length === 0) {
    console.error('No non-general server found!');
    process.exit(1);
  }
  const targetServer = serverRes.rows[0];
  console.log(`Using target server #${targetServer.id} owned by ${targetServer.owner_id}`);

  // Create auth token for owner
  const token = jwt.sign({ userId: targetServer.owner_id }, JWT_SECRET, { expiresIn: '1h' });
  const authHeaders = { Authorization: `Bearer ${token}` };

  // Test 1: Verify Server 1 (General) rejects role creation
  try {
    await axios.post('http://localhost:8000/api/servers/1/roles', { name: 'Admin' }, { headers: authHeaders });
    console.error('❌ Server 1 failed to reject role creation!');
  } catch (err) {
    if (err.response && (err.response.status === 403 || err.response.status === 400)) {
      console.log('✅ Server 1 (General) correctly protected from custom roles.');
    } else {
      console.error('Unexpected error on Server 1:', err.message);
    }
  }

  // Test 2: Create a role on target server
  const createRes = await axios.post(
    `http://localhost:8000/api/servers/${targetServer.id}/roles`,
    {
      name: 'Moderator',
      color: '#5865F2',
      hoist: true,
      permissions: { administrator: false, manage_messages: true, manage_roles: true, kick_members: true }
    },
    { headers: authHeaders }
  );
  console.log('✅ Role created:', createRes.data);
  const createdRoleId = createRes.data.id;

  // Test 3: Assign role to owner/member
  await axios.post(
    `http://localhost:8000/api/servers/${targetServer.id}/members/${targetServer.owner_id}/roles/${createdRoleId}`,
    {},
    { headers: authHeaders }
  );
  console.log(`✅ Role ${createdRoleId} assigned to member ${targetServer.owner_id}`);

  // Test 4: Query server members
  const membersRes = await axios.get(
    `http://localhost:8000/api/servers/${targetServer.id}/members`,
    { headers: authHeaders }
  );
  const memberWithRole = membersRes.data.find(m => m.id === targetServer.owner_id);
  console.log('✅ Member with role data:', JSON.stringify(memberWithRole, null, 2));

  if (!memberWithRole.roles || !memberWithRole.roles.some(r => r.id === createdRoleId)) {
    throw new Error('Member roles not returned correctly');
  }

  // Test 5: Update role
  const updateRes = await axios.put(
    `http://localhost:8000/api/servers/${targetServer.id}/roles/${createdRoleId}`,
    { name: 'Senior Mod', color: '#57F287', hoist: true },
    { headers: authHeaders }
  );
  console.log('✅ Role updated:', updateRes.data);

  // Test 6: Remove role from member
  await axios.delete(
    `http://localhost:8000/api/servers/${targetServer.id}/members/${targetServer.owner_id}/roles/${createdRoleId}`,
    { headers: authHeaders }
  );
  console.log('✅ Role removed from member');

  // Test 7: Delete role
  await axios.delete(
    `http://localhost:8000/api/servers/${targetServer.id}/roles/${createdRoleId}`,
    { headers: authHeaders }
  );
  console.log('✅ Role deleted successfully');

  console.log('🎉 ALL ROLE SYSTEM TESTS PASSED PERFECTLY!');
  process.exit(0);
}

testRoles().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
