const fs = require('fs');
const { Pool } = require('pg');

const supabaseUrl = 'https://aebntdjjniirnwthtwlx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlYm50ZGpqbmlpcm53dGh0d2x4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4NzIwNTYsImV4cCI6MjA5ODQ0ODA1Nn0.la5aH5b2Tb5cj5yfVEWHhPKU4_ieCWydEPWH8V81eIg';

const localPool = new Pool({
  connectionString: 'postgresql://chat_user:secure_password_change_me@127.0.0.1:5432/chat_db'
});

async function fetchFromSupabase(endpoint) {
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/${endpoint}`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });
    if (!res.ok) {
      console.error(`Fetch ${endpoint} failed:`, res.statusText);
      return [];
    }
    return await res.json();
  } catch (err) {
    console.error(`Fetch ${endpoint} error:`, err.message);
    return [];
  }
}

async function runBackupAndMigration() {
  console.log('🚀 Starting Supabase data backup & migration...');
  const backupData = {};

  try {
    // 1. Fetch Users
    backupData.users = await fetchFromSupabase('users?select=*');
    console.log(`Fetched ${backupData.users.length} users from Supabase.`);

    // 2. Fetch Servers
    backupData.servers = await fetchFromSupabase('servers?select=*');
    console.log(`Fetched ${backupData.servers.length} servers from Supabase.`);

    // 3. Fetch Chatrooms
    backupData.chatrooms = await fetchFromSupabase('chatrooms?select=*');
    console.log(`Fetched ${backupData.chatrooms.length} chatrooms from Supabase.`);

    // 4. Fetch Server Members
    backupData.server_members = await fetchFromSupabase('server_members?select=*');
    console.log(`Fetched ${backupData.server_members.length} server members from Supabase.`);

    // 5. Fetch Server Messages
    backupData.server_messages = await fetchFromSupabase('server_messages?select=*');
    console.log(`Fetched ${backupData.server_messages.length} server messages from Supabase.`);

    // 6. Fetch Direct Messages
    backupData.direct_messages = await fetchFromSupabase('direct_messages?select=*');
    console.log(`Fetched ${backupData.direct_messages.length} direct messages from Supabase.`);

    // Save JSON backup file locally
    fs.writeFileSync('./supabase_backup.json', JSON.stringify(backupData, null, 2));
    console.log('💾 Local JSON backup saved to supabase_backup.json');

    // ----------------------------------------------------
    // MIGRATION TO LOCAL LAT5290 POSTGRESQL DB
    // ----------------------------------------------------
    const client = await localPool.connect();
    try {
      // Migrate Users
      for (const u of backupData.users) {
        await client.query(`
          INSERT INTO users (id, username, email, avatar_url, is_admin, created_at)
          VALUES ($1, $2, $3, $4, $5, COALESCE($6, CURRENT_TIMESTAMP))
          ON CONFLICT (id) DO UPDATE SET
            username = EXCLUDED.username,
            email = EXCLUDED.email,
            avatar_url = EXCLUDED.avatar_url,
            is_admin = EXCLUDED.is_admin;
        `, [u.id, u.username || (u.email ? u.email.split('@')[0] : 'user'), u.email || `${u.id}@chat.local`, u.avatar_url, u.is_admin || false, u.created_at]);
      }
      console.log(`✅ Migrated ${backupData.users.length} users to lat5290 PostgreSQL database.`);

      // Migrate Servers
      for (const s of backupData.servers) {
        await client.query(`
          INSERT INTO servers (id, name, description, owner_id, is_public, avatar_url, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, CURRENT_TIMESTAMP))
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            is_public = EXCLUDED.is_public;
        `, [s.id, s.name, s.description, s.owner_id, s.is_public !== false, s.avatar_url, s.created_at]);
      }
      console.log(`✅ Migrated ${backupData.servers.length} servers to lat5290 PostgreSQL database.`);

      // Migrate Chatrooms
      for (const c of backupData.chatrooms) {
        await client.query(`
          INSERT INTO chatrooms (id, server_id, name, is_general, description, created_at)
          VALUES ($1, $2, $3, $4, $5, COALESCE($6, CURRENT_TIMESTAMP))
          ON CONFLICT (id) DO NOTHING;
        `, [c.id, c.server_id, c.name, c.is_general || false, c.description, c.created_at]);
      }
      console.log(`✅ Migrated ${backupData.chatrooms.length} chatrooms to lat5290 PostgreSQL database.`);

      // Migrate Server Members
      for (const m of backupData.server_members) {
        await client.query(`
          INSERT INTO server_members (user_id, server_id, joined_at)
          VALUES ($1, $2, COALESCE($3, CURRENT_TIMESTAMP))
          ON CONFLICT (user_id, server_id) DO NOTHING;
        `, [m.user_id, m.server_id, m.joined_at]);
      }
      console.log(`✅ Migrated ${backupData.server_members.length} server members to lat5290 PostgreSQL database.`);

      // Migrate Server Messages
      for (const msg of backupData.server_messages) {
        await client.query(`
          INSERT INTO server_messages (id, sender_id, chatroom_id, content, created_at)
          VALUES ($1, $2, $3, $4, COALESCE($5, CURRENT_TIMESTAMP))
          ON CONFLICT (id) DO NOTHING;
        `, [msg.id, msg.sender_id, msg.chatroom_id, msg.content, msg.created_at]);
      }
      console.log(`✅ Migrated ${backupData.server_messages.length} server messages to lat5290 PostgreSQL database.`);

      // Migrate Direct Messages
      for (const dm of backupData.direct_messages) {
        await client.query(`
          INSERT INTO direct_messages (id, sender_id, recipient_id, content, created_at)
          VALUES ($1, $2, $3, $4, COALESCE($5, CURRENT_TIMESTAMP))
          ON CONFLICT (id) DO NOTHING;
        `, [dm.id, dm.sender_id, dm.recipient_id, dm.content, dm.created_at]);
      }
      console.log(`✅ Migrated ${backupData.direct_messages.length} direct messages to lat5290 PostgreSQL database.`);

    } finally {
      client.release();
    }

    console.log('\n🎉 ALL SUPABASE DATA BACKED UP & MIGRATED SUCCESSFULLY!');
  } catch (err) {
    console.error('Migration error:', err);
  } finally {
    await localPool.end();
  }
}

runBackupAndMigration();
