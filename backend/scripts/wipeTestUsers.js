const { pool } = require('../../db/database');

async function wipeTestUsers() {
  console.log('🧹 Starting comprehensive cleanup of test, audit, diagnostic, and simulation users...');

  try {
    let loopCount = 0;
    while (loopCount < 20) {
      loopCount++;
      const selectQuery = `
        SELECT id, username, email FROM users
        WHERE (
              username LIKE 'diag_%'
           OR username LIKE 'audit_%'
           OR username LIKE 'sim_%'
           OR username LIKE 'test_%'
           OR username LIKE 'tester_%'
           OR username LIKE 'testuser_%'
           OR username LIKE 'suite_user_%'
           OR username LIKE 'route_%'
           OR username LIKE 'cf_test_%'
           OR username LIKE 'scan_test_%'
           OR username LIKE 'User_%'
           OR email LIKE '%@example.com'
           OR email LIKE '%@test.local'
           OR email LIKE '%@chat.local'
        )
        AND username != 'system_test_runner'
        AND username != 'system'
        AND id != 'gemini-bot-id'
        AND id != 'bot-id';
      `;

      const res = await pool.query(selectQuery);
      const testUsers = res.rows;
      if (testUsers.length === 0) {
        console.log('✅ No remaining test users found.');
        break;
      }
      console.log(`🔍 Loop ${loopCount}: Found ${testUsers.length} test/non-human user accounts to purge.`);

      const testUserIds = testUsers.map(u => u.id);

      // Find servers owned by test users AND servers where test users are members
      const testServersRes = await pool.query(`SELECT id FROM servers WHERE owner_id = ANY($1::varchar[])`, [testUserIds]);
      const testServerIds = testServersRes.rows.map(s => s.id);
      if (testServerIds.length > 0) {
        try {
          await pool.query(`DELETE FROM server_messages WHERE chatroom_id IN (SELECT id FROM chatrooms WHERE server_id = ANY($1::int[]))`, [testServerIds]);
          await pool.query(`DELETE FROM chatrooms WHERE server_id = ANY($1::int[])`, [testServerIds]);
          await pool.query(`DELETE FROM server_member_roles WHERE server_id = ANY($1::int[])`, [testServerIds]);
          await pool.query(`DELETE FROM server_members WHERE server_id = ANY($1::int[])`, [testServerIds]);
          await pool.query(`DELETE FROM server_roles WHERE server_id = ANY($1::int[])`, [testServerIds]);
          await pool.query(`DELETE FROM bans WHERE server_id = ANY($1::int[])`, [testServerIds]);
          await pool.query(`DELETE FROM servers WHERE id = ANY($1::int[])`, [testServerIds]);
          console.log(`✅ Deleted ${testServerIds.length} test servers.`);
        } catch (sErr) {
          console.error(`⚠️ Server deletion error: ${sErr.message}`);
        }
      }

      await pool.query(`DELETE FROM server_messages WHERE sender_id = ANY($1::varchar[])`, [testUserIds]);
      await pool.query(`DELETE FROM direct_messages WHERE sender_id = ANY($1::varchar[]) OR recipient_id = ANY($1::varchar[])`, [testUserIds]);
      await pool.query(`DELETE FROM friendships WHERE user_id = ANY($1::varchar[]) OR friend_id = ANY($1::varchar[])`, [testUserIds]);
      await pool.query(`DELETE FROM server_member_roles WHERE user_id = ANY($1::varchar[])`, [testUserIds]);
      await pool.query(`DELETE FROM server_members WHERE user_id = ANY($1::varchar[])`, [testUserIds]);
      await pool.query(`DELETE FROM reports WHERE user_id = ANY($1::varchar[])`, [testUserIds]);
      await pool.query(`DELETE FROM bans WHERE user_id = ANY($1::varchar[])`, [testUserIds]);
      
      try { await pool.query(`DELETE FROM user_blocks WHERE user_id = ANY($1::varchar[]) OR blocked_user_id = ANY($1::varchar[])`, [testUserIds]); } catch (e) {}
      try { await pool.query(`DELETE FROM spotify_history WHERE user_id = ANY($1::varchar[])`, [testUserIds]); } catch (e) {}
      try { await pool.query(`DELETE FROM spotify_liked_tracks WHERE user_id = ANY($1::varchar[])`, [testUserIds]); } catch (e) {}
      try { await pool.query(`DELETE FROM spotify_playlists WHERE user_id = ANY($1::varchar[])`, [testUserIds]); } catch (e) {}

      try {
        const deleteRes = await pool.query(`DELETE FROM users WHERE id = ANY($1::varchar[])`, [testUserIds]);
        console.log(`✅ Loop ${loopCount}: Wiped ${deleteRes.rowCount} test users.`);
      } catch (uErr) {
        console.error(`⚠️ User deletion error on loop ${loopCount}: ${uErr.message}`);
        // Fallback: Delete individually
        for (const user of testUsers) {
          try {
            const sRes = await pool.query(`SELECT id FROM servers WHERE owner_id = $1`, [user.id]);
            for (const sRow of sRes.rows) {
              await pool.query(`DELETE FROM server_messages WHERE chatroom_id IN (SELECT id FROM chatrooms WHERE server_id = $1)`, [sRow.id]);
              await pool.query(`DELETE FROM chatrooms WHERE server_id = $1`, [sRow.id]);
              await pool.query(`DELETE FROM server_member_roles WHERE server_id = $1`, [sRow.id]);
              await pool.query(`DELETE FROM server_members WHERE server_id = $1`, [sRow.id]);
              await pool.query(`DELETE FROM server_roles WHERE server_id = $1`, [sRow.id]);
              await pool.query(`DELETE FROM bans WHERE server_id = $1`, [sRow.id]);
              await pool.query(`DELETE FROM servers WHERE id = $1`, [sRow.id]);
            }
            await pool.query(`DELETE FROM server_messages WHERE sender_id = $1`, [user.id]);
            await pool.query(`DELETE FROM direct_messages WHERE sender_id = $1 OR recipient_id = $1`, [user.id]);
            await pool.query(`DELETE FROM friendships WHERE user_id = $1 OR friend_id = $1`, [user.id]);
            await pool.query(`DELETE FROM server_member_roles WHERE user_id = $1`, [user.id]);
            await pool.query(`DELETE FROM server_members WHERE user_id = $1`, [user.id]);
            await pool.query(`DELETE FROM reports WHERE user_id = $1`, [user.id]);
            await pool.query(`DELETE FROM bans WHERE user_id = $1`, [user.id]);
            await pool.query(`DELETE FROM users WHERE id = $1`, [user.id]);
          } catch (indErr) {
            console.error(`Failed to delete user ${user.username} (${user.id}): ${indErr.message}`);
          }
        }
      }
    }

    // Ensure single persistent test account exists
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash('TestPassword123!', 10);
    await pool.query(`
      INSERT INTO users (username, email, password)
      VALUES ('system_test_runner', 'system_test_runner@local.test', $1)
      ON CONFLICT (username) DO NOTHING;
    `, [hashedPassword]);
    console.log('✅ Standardized persistent test account "system_test_runner" ensured.');

  } catch (err) {
    console.error('❌ Error during test user cleanup:', err);
  } finally {
    await pool.end();
  }
}

wipeTestUsers();
