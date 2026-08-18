const { query } = require('../db/database');

async function deleteTestUsers() {
  console.log('--- Deleting all test users and test servers ---');

  // 1. Delete test audit servers (4, 5, 6)
  const delSrv = await query("DELETE FROM servers WHERE name LIKE 'Audit Server%' OR id IN (4, 5, 6) RETURNING id, name");
  console.log('Deleted test servers:', delSrv.rows);

  // 2. Identify test users by username pattern or email
  const testUserPatterns = [
    'audit_user_%',
    'diag_user_%',
    'check_%',
    'report_tester_%',
    'scan_test_%',
    'sim_%',
    'temp_probe_%',
    'test_%',
    'testuser_%',
    'Testuser11',
    'u1_%',
    'u2_%',
    'ytTester_%',
    'Test',
    'User',
    'abccc',
    'qefwefwe',
    'rthrthrth',
    'qwdqwd'
  ];

  // Build query
  const conditions = testUserPatterns.map((_, i) => `username LIKE $${i + 1}`).join(' OR ');
  
  // Find matching users first
  const findRes = await query(`SELECT id, username, email FROM users WHERE ${conditions}`, testUserPatterns);
  console.log(`Found ${findRes.rows.length} test users to delete:`, findRes.rows.map(u => u.username));

  const testUserIds = findRes.rows.map(u => u.id);

  if (testUserIds.length > 0) {
    // Delete references in direct messages, server member roles, server members, notifications, etc.
    await query('DELETE FROM server_member_roles WHERE user_id = ANY($1::varchar[])', [testUserIds]);
    await query('DELETE FROM server_members WHERE user_id = ANY($1::varchar[])', [testUserIds]);
    await query('DELETE FROM direct_messages WHERE sender_id = ANY($1::varchar[]) OR recipient_id = ANY($1::varchar[])', [testUserIds]);
    await query('DELETE FROM server_messages WHERE sender_id = ANY($1::varchar[])', [testUserIds]);
    
    // Delete the users
    const delUsers = await query('DELETE FROM users WHERE id = ANY($1::varchar[]) RETURNING username', [testUserIds]);
    console.log(`✅ Successfully deleted ${delUsers.rows.length} test users:`, delUsers.rows.map(u => u.username));
  }

  // 3. List remaining users
  const remaining = await query('SELECT id, username, email, is_admin FROM users ORDER BY username ASC');
  console.log('--- Remaining Users ---');
  console.table(remaining.rows);

  process.exit(0);
}

deleteTestUsers().catch(err => {
  console.error('Error deleting test users:', err);
  process.exit(1);
});
