const { query } = require('../db/database');

async function purgeAll() {
  console.log('--- PURGING TEST USERS AND ALL FOREIGN KEY DEPENDENCIES ---');

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

  const conditions = testUserPatterns.map((_, i) => `username LIKE $${i + 1}`).join(' OR ');

  // 1. Find all matching test users
  const found = await query(`SELECT id, username FROM users WHERE ${conditions}`, testUserPatterns);
  const foundArchived = await query(`SELECT id, username FROM archived_users WHERE ${conditions}`, testUserPatterns);

  const allTestUserIds = [...found.rows.map(u => u.id), ...foundArchived.rows.map(u => u.id)];
  console.log(`Found ${allTestUserIds.length} test user IDs total.`);

  if (allTestUserIds.length > 0) {
    // 2. Find any servers owned by test users
    for (const userId of allTestUserIds) {
      const srvs = await query('SELECT id FROM servers WHERE owner_id = $1', [userId]);
      for (const s of srvs.rows) {
        await query('DELETE FROM server_messages WHERE chatroom_id IN (SELECT id FROM chatrooms WHERE server_id = $1)', [s.id]);
        await query('DELETE FROM chatrooms WHERE server_id = $1', [s.id]);
        await query('DELETE FROM server_member_roles WHERE server_id = $1', [s.id]);
        await query('DELETE FROM server_roles WHERE server_id = $1', [s.id]);
        await query('DELETE FROM server_members WHERE server_id = $1', [s.id]);
        await query('DELETE FROM servers WHERE id = $1', [s.id]);
      }

      // Clean up test user references
      await query('DELETE FROM server_member_roles WHERE user_id = $1', [userId]);
      await query('DELETE FROM server_members WHERE user_id = $1', [userId]);
      await query('DELETE FROM direct_messages WHERE sender_id = $1 OR recipient_id = $1', [userId]);
      await query('DELETE FROM server_messages WHERE sender_id = $1', [userId]);
      await query('DELETE FROM reports WHERE user_id = $1', [userId]);
      await query('DELETE FROM bans WHERE user_id = $1', [userId]);
      await query('DELETE FROM users WHERE id = $1', [userId]);
      await query('DELETE FROM archived_users WHERE id = $1', [userId]);
    }
  }

  // 3. Query remaining users in users and archived_users
  const remUsers = await query('SELECT id, username, email FROM users ORDER BY username ASC');
  const remArchived = await query('SELECT id, username, email FROM archived_users ORDER BY username ASC');

  console.log('=== REMAINING ACTIVE USERS (' + remUsers.rows.length + ') ===');
  console.table(remUsers.rows);

  console.log('=== REMAINING ARCHIVED USERS (' + remArchived.rows.length + ') ===');
  console.table(remArchived.rows);

  process.exit(0);
}

purgeAll().catch(err => {
  console.error('Fatal purge error:', err);
  process.exit(1);
});
