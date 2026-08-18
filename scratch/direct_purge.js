const { query } = require('../db/database');

async function directPurge() {
  console.log('--- DIRECT SQL PURGE ---');
  
  const keep = ['Nxghtmare3621', 'ADMIN', 'system', 'Gemini AI Assistant', 'bot', 'dizzyok', 'MrBeast', 'larp', 'lol111', 'youareodd1234eg?', 'youtuber11'];
  
  await query(`
    DELETE FROM server_messages WHERE chatroom_id IN (
      SELECT c.id FROM chatrooms c JOIN servers s ON c.server_id = s.id 
      JOIN users u ON s.owner_id = u.id WHERE u.username NOT IN (${keep.map(k => `'${k}'`).join(',')}) OR s.name LIKE 'Audit%'
    );
    DELETE FROM chatrooms WHERE server_id IN (
      SELECT s.id FROM servers s JOIN users u ON s.owner_id = u.id 
      WHERE u.username NOT IN (${keep.map(k => `'${k}'`).join(',')}) OR s.name LIKE 'Audit%'
    );
    DELETE FROM server_member_roles WHERE server_id IN (
      SELECT s.id FROM servers s JOIN users u ON s.owner_id = u.id 
      WHERE u.username NOT IN (${keep.map(k => `'${k}'`).join(',')}) OR s.name LIKE 'Audit%'
    );
    DELETE FROM server_roles WHERE server_id IN (
      SELECT s.id FROM servers s JOIN users u ON s.owner_id = u.id 
      WHERE u.username NOT IN (${keep.map(k => `'${k}'`).join(',')}) OR s.name LIKE 'Audit%'
    );
    DELETE FROM server_members WHERE server_id IN (
      SELECT s.id FROM servers s JOIN users u ON s.owner_id = u.id 
      WHERE u.username NOT IN (${keep.map(k => `'${k}'`).join(',')}) OR s.name LIKE 'Audit%'
    );
    DELETE FROM servers WHERE owner_id IN (
      SELECT id FROM users WHERE username NOT IN (${keep.map(k => `'${k}'`).join(',')})
    ) OR name LIKE 'Audit%';

    DELETE FROM server_member_roles WHERE user_id IN (
      SELECT id FROM users WHERE username NOT IN (${keep.map(k => `'${k}'`).join(',')})
    );
    DELETE FROM server_members WHERE user_id IN (
      SELECT id FROM users WHERE username NOT IN (${keep.map(k => `'${k}'`).join(',')})
    );
    DELETE FROM direct_messages WHERE sender_id IN (
      SELECT id FROM users WHERE username NOT IN (${keep.map(k => `'${k}'`).join(',')})
    ) OR recipient_id IN (
      SELECT id FROM users WHERE username NOT IN (${keep.map(k => `'${k}'`).join(',')})
    );
    DELETE FROM server_messages WHERE sender_id IN (
      SELECT id FROM users WHERE username NOT IN (${keep.map(k => `'${k}'`).join(',')})
    );
    DELETE FROM friendships WHERE user_id IN (
      SELECT id FROM users WHERE username NOT IN (${keep.map(k => `'${k}'`).join(',')})
    ) OR friend_id IN (
      SELECT id FROM users WHERE username NOT IN (${keep.map(k => `'${k}'`).join(',')})
    );
    DELETE FROM bans WHERE user_id IN (
      SELECT id FROM users WHERE username NOT IN (${keep.map(k => `'${k}'`).join(',')})
    );
    DELETE FROM reports WHERE user_id IN (
      SELECT id FROM users WHERE username NOT IN (${keep.map(k => `'${k}'`).join(',')})
    );
    DELETE FROM users WHERE username NOT IN (${keep.map(k => `'${k}'`).join(',')});
    DELETE FROM archived_users;
  `);

  const users = await query('SELECT id, username, email FROM users ORDER BY username ASC');
  const archived = await query('SELECT id, username, email FROM archived_users ORDER BY username ASC');
  
  console.log('=== FINAL REMAINING USERS (' + users.rows.length + ') ===');
  console.table(users.rows);
  console.log('=== FINAL REMAINING ARCHIVED (' + archived.rows.length + ') ===');
  console.table(archived.rows);
  
  process.exit(0);
}

directPurge().catch(err => {
  console.error(err);
  process.exit(1);
});
