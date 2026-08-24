const { pool } = require('../../db/database');

async function wipeTestUsers() {
  console.log('🧹 Starting comprehensive cleanup of test, audit, diagnostic, and simulation users...');

  const sub = `
    SELECT id FROM users
    WHERE (
          username ILIKE 'diag_%'
       OR username ILIKE 'audit_%'
       OR username ILIKE 'sim_%'
       OR username ILIKE 'test_%'
       OR username ILIKE 'tester_%'
       OR username ILIKE 'testuser_%'
       OR username ILIKE 'report_%'
       OR username ILIKE 'suite_%'
       OR username ILIKE 'route_%'
       OR username ILIKE 'cf_test_%'
       OR username ILIKE 'scan_%'
       OR username ILIKE 'User_%'
       OR username ILIKE 'Test%'
       OR email ILIKE '%@example.com'
       OR email ILIKE '%@test.local'
       OR email ILIKE '%@chat.local'
    )
    AND username NOT IN ('system_test_runner', 'system_test_runner_2', 'system', 'Gemini AI Assistant', 'bot', 'ADMIN', 'rthrthrth', 'lol111', 'youtuber11')
    AND id NOT IN ('gemini-bot-id', 'bot-id')
  `;

  try {
    let loopCount = 0;
    while (loopCount < 10) {
      loopCount++;

      // 1. Reassign any server owned by test users to system user to break FK constraint
      await pool.query(`UPDATE servers SET owner_id = '00000000-0000-0000-0000-000000000000' WHERE owner_id IN (${sub})`);

      // 2. Delete test user activity across child tables
      await pool.query(`DELETE FROM server_messages WHERE sender_id IN (${sub})`);
      await pool.query(`DELETE FROM direct_messages WHERE sender_id IN (${sub}) OR recipient_id IN (${sub})`);
      await pool.query(`DELETE FROM friendships WHERE user_id IN (${sub}) OR friend_id IN (${sub})`);
      await pool.query(`DELETE FROM server_member_roles WHERE user_id IN (${sub})`);
      await pool.query(`DELETE FROM server_members WHERE user_id IN (${sub})`);
      await pool.query(`DELETE FROM reports WHERE user_id IN (${sub})`);
      await pool.query(`DELETE FROM bans WHERE user_id IN (${sub})`);

      // 3. Delete target test users
      const deleteRes = await pool.query(`DELETE FROM users WHERE id IN (${sub})`);
      console.log(`✅ Loop ${loopCount}: Wiped ${deleteRes.rowCount} test users.`);

      if (deleteRes.rowCount === 0) {
        console.log('✅ No remaining test users found.');
        break;
      }
    }

    // Ensure persistent test runner accounts exist
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash('TestPassword123!', 10);
    await pool.query(`
      INSERT INTO users (username, email, password)
      VALUES ('system_test_runner', 'system_test_runner@local.test', $1)
      ON CONFLICT (username) DO NOTHING;
    `, [hashedPassword]);
    await pool.query(`
      INSERT INTO users (username, email, password)
      VALUES ('system_test_runner_2', 'system_test_runner_2@local.test', $1)
      ON CONFLICT (username) DO NOTHING;
    `, [hashedPassword]);
    console.log('✅ Standardized persistent test accounts "system_test_runner" and "system_test_runner_2" ensured.');

  } catch (err) {
    console.error('❌ Error during test user cleanup:', err.message);
  } finally {
    await pool.end();
  }
}

wipeTestUsers();
