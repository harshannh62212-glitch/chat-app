const { Pool } = require('pg');
require('dotenv').config();

const defaultSupabaseUrl = 'postgresql://postgres:ALLsystems143%40%40@db.aebntdjjniirnwthtwlx.supabase.co:5432/postgres';
const connectionString = process.env.DATABASE_URL || defaultSupabaseUrl;
const isVercel = Boolean(process.env.VERCEL);

const pool = new Pool({
  connectionString: connectionString,
  min: 2,
  max: parseInt(process.env.DB_POOL_MAX || '20', 10),
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 4000,
  ssl: { rejectUnauthorized: false }
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

async function initDB() {
  try {
    await pool.query('SELECT NOW()');
    console.log('Database connection successful');
    if (!isVercel) {
      await createTables();
    }
  } catch (err) {
    console.error('Database connection failed:', err);
    if (!isVercel) {
      throw err;
    }
  }
}

async function createTables() {
  const client = await pool.connect();
  try {
    // Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::varchar,
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255),
        avatar_url VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE users ALTER COLUMN id SET DEFAULT gen_random_uuid()::varchar;
    `);

    // Servers table
    await client.query(`
      CREATE TABLE IF NOT EXISTS servers (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        owner_id VARCHAR(255) NOT NULL REFERENCES users(id),
        password_hash VARCHAR(255),
        is_public BOOLEAN DEFAULT true,
        avatar_url VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Central chatroom (mandatory in each server)
    await client.query(`
      CREATE TABLE IF NOT EXISTS chatrooms (
        id SERIAL PRIMARY KEY,
        server_id INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        is_general BOOLEAN DEFAULT false,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(server_id, is_general)
      );
    `);

    // Server members
    await client.query(`
      CREATE TABLE IF NOT EXISTS server_members (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        server_id INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, server_id)
      );
    `);

    // Server messages
    await client.query(`
      CREATE TABLE IF NOT EXISTS server_messages (
        id SERIAL PRIMARY KEY,
        sender_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        chatroom_id INTEGER NOT NULL REFERENCES chatrooms(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Direct messages
    await client.query(`
      CREATE TABLE IF NOT EXISTS direct_messages (
        id SERIAL PRIMARY KEY,
        sender_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        recipient_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        is_read BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Ultra-High-Performance Compound Indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_server_messages_chatroom_time ON server_messages (chatroom_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_server_messages_sender ON server_messages (sender_id);
      CREATE INDEX IF NOT EXISTS idx_dm_pair_time ON direct_messages (sender_id, recipient_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_dm_recipient ON direct_messages (recipient_id);
      CREATE INDEX IF NOT EXISTS idx_users_username_lower ON users (LOWER(username));
      CREATE INDEX IF NOT EXISTS idx_server_members_composite ON server_members (server_id, user_id);
      CREATE INDEX IF NOT EXISTS idx_chatrooms_server ON chatrooms (server_id);
    `);

    // Add reactions support to messages if not present
    await client.query(`
      ALTER TABLE server_messages ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '{}'::jsonb;
      ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '{}'::jsonb;
    `);

    // Friendships table
    await client.query(`
      CREATE TABLE IF NOT EXISTS friendships (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        friend_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, friend_id)
      );
    `);

    // Bans table
    await client.query(`
      CREATE TABLE IF NOT EXISTS bans (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        server_id INTEGER REFERENCES servers(id) ON DELETE CASCADE,
        reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP
      );
    `);

    // Banned words table
    await client.query(`
      CREATE TABLE IF NOT EXISTS banned_words (
        id SERIAL PRIMARY KEY,
        word VARCHAR(255) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Reports table
    await client.query(`
      CREATE TABLE IF NOT EXISTS reports (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
        description TEXT NOT NULL,
        screenshot_url TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'open',
        ai_evaluation VARCHAR(20) NOT NULL DEFAULT 'unevaluated',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Performance Indexes for high concurrency (80+ users)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_server_messages_chatroom ON server_messages(chatroom_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_direct_messages_users ON direct_messages(sender_id, recipient_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_server_members_user_server ON server_members(user_id, server_id);
      CREATE INDEX IF NOT EXISTS idx_chatrooms_server_id ON chatrooms(server_id);
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower_unique ON users(LOWER(username));
    `);

    // Column Migrations
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS timeout_until TIMESTAMP;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT false;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_moderated BOOLEAN DEFAULT false;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS minecraft_username VARCHAR(255);
      ALTER TABLE server_messages ADD COLUMN IF NOT EXISTS is_moderated BOOLEAN DEFAULT false;
      ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS is_moderated BOOLEAN DEFAULT false;
      ALTER TABLE reports ADD COLUMN IF NOT EXISTS ai_evaluation VARCHAR(20) DEFAULT 'unevaluated';
    `);

    // Seed Administrator role
    await client.query(`
      UPDATE users SET is_admin = true WHERE username = 'Nxghtmare3621';
    `);

    // Clean up duplicate/legacy 'bot-id' user if it exists and migrate its references
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM users WHERE id = 'bot-id') THEN
          -- Reassign any existing messages or references to 'gemini-bot-id'
          UPDATE server_messages SET sender_id = 'gemini-bot-id' WHERE sender_id = 'bot-id';
          UPDATE direct_messages SET sender_id = 'gemini-bot-id' WHERE sender_id = 'bot-id';
          UPDATE direct_messages SET recipient_id = 'gemini-bot-id' WHERE recipient_id = 'bot-id';
          DELETE FROM server_members WHERE user_id = 'bot-id';
          DELETE FROM users WHERE id = 'bot-id';
        END IF;
      END $$;
    `);

    // Seed Gemini Bot user
    await client.query(`
      INSERT INTO users (id, username, email, password, avatar_url)
      VALUES (
        'gemini-bot-id', 
        'Gemini AI Assistant', 
        'gemini-bot@ai.local', 
        'bot-no-password-hash', 
        'https://uxwing.com/wp-content/themes/uxwing/download/brands-and-social-media/google-gemini-icon.png'
      )
      ON CONFLICT (id) DO NOTHING;
    `);

    // Spotify Playlists table
    await client.query(`
      CREATE TABLE IF NOT EXISTS spotify_playlists (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        cover_url VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Spotify Playlist Tracks table
    await client.query(`
      CREATE TABLE IF NOT EXISTS spotify_playlist_tracks (
        id SERIAL PRIMARY KEY,
        playlist_id INTEGER NOT NULL REFERENCES spotify_playlists(id) ON DELETE CASCADE,
        track_id VARCHAR(255) NOT NULL,
        title VARCHAR(255) NOT NULL,
        artist VARCHAR(255) NOT NULL,
        album VARCHAR(255),
        duration INTEGER,
        preview_url TEXT,
        cover_url TEXT,
        added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Spotify Liked Tracks table
    await client.query(`
      CREATE TABLE IF NOT EXISTS spotify_liked_tracks (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        track_id VARCHAR(255) NOT NULL,
        title VARCHAR(255) NOT NULL,
        artist VARCHAR(255) NOT NULL,
        album VARCHAR(255),
        duration INTEGER,
        preview_url TEXT,
        cover_url TEXT,
        liked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, track_id)
      );
    `);

    // Spotify History table
    await client.query(`
      CREATE TABLE IF NOT EXISTS spotify_history (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        track_id VARCHAR(255) NOT NULL,
        title VARCHAR(255) NOT NULL,
        artist VARCHAR(255) NOT NULL,
        album VARCHAR(255),
        cover_url TEXT,
        played_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Archive tables for banned users
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.archived_users (
        id VARCHAR(255) PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255),
        avatar_url VARCHAR(255),
        is_admin BOOLEAN DEFAULT false,
        timeout_until TIMESTAMP,
        created_at TIMESTAMP,
        updated_at TIMESTAMP,
        archived_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS public.archived_server_members (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        server_id INTEGER NOT NULL,
        joined_at TIMESTAMP,
        archived_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, server_id)
      );

      CREATE TABLE IF NOT EXISTS public.archived_friendships (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        friend_id VARCHAR(255) NOT NULL,
        status VARCHAR(50),
        created_at TIMESTAMP,
        archived_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, friend_id)
      );

      CREATE TABLE IF NOT EXISTS public.system_config (
        key VARCHAR(255) PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Archive trigger function and trigger
    await client.query(`
      CREATE OR REPLACE FUNCTION public.archive_banned_user_trigger()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.is_banned = TRUE AND (OLD.is_banned = FALSE OR OLD.is_banned IS NULL) THEN
          -- Archive user details
          INSERT INTO public.archived_users (id, username, email, password, avatar_url, is_admin, timeout_until, created_at, updated_at)
          VALUES (NEW.id, NEW.username, NEW.email, NEW.password, NEW.avatar_url, NEW.is_admin, NEW.timeout_until, NEW.created_at, NEW.updated_at)
          ON CONFLICT (id) DO UPDATE SET
            username = EXCLUDED.username,
            email = EXCLUDED.email,
            password = EXCLUDED.password,
            avatar_url = EXCLUDED.avatar_url,
            is_admin = EXCLUDED.is_admin,
            timeout_until = EXCLUDED.timeout_until,
            updated_at = EXCLUDED.updated_at;

          -- Archive memberships
          INSERT INTO public.archived_server_members (user_id, server_id, joined_at)
          SELECT user_id, server_id, joined_at
          FROM public.server_members
          WHERE user_id = NEW.id
          ON CONFLICT (user_id, server_id) DO NOTHING;

          -- Archive friendships
          INSERT INTO public.archived_friendships (user_id, friend_id, status, created_at)
          SELECT user_id, friend_id, status, created_at
          FROM public.friendships
          WHERE user_id = NEW.id OR friend_id = NEW.id
          ON CONFLICT (user_id, friend_id) DO NOTHING;

          -- Delete/archive servers owned by the user first to avoid FK violation
          DELETE FROM public.servers WHERE owner_id = NEW.id;

          -- Now delete from public.users
          DELETE FROM public.users WHERE id = NEW.id;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS tr_archive_banned_user ON public.users;
      CREATE TRIGGER tr_archive_banned_user
        AFTER UPDATE OF is_banned ON public.users
        FOR EACH ROW
        EXECUTE FUNCTION public.archive_banned_user_trigger();
    `);

    // Unban function
    await client.query(`
      CREATE OR REPLACE FUNCTION public.unban_user(target_user_id VARCHAR)
      RETURNS VOID AS $$
      BEGIN
        -- Restore user details to public.users
        INSERT INTO public.users (id, username, email, password, avatar_url, is_admin, timeout_until, created_at, updated_at, is_banned)
        SELECT id, username, email, password, avatar_url, is_admin, timeout_until, created_at, updated_at, FALSE
        FROM public.archived_users
        WHERE id = target_user_id
        ON CONFLICT (id) DO UPDATE SET
          is_banned = FALSE;

        -- Restore memberships
        INSERT INTO public.server_members (user_id, server_id, joined_at)
        SELECT user_id, server_id, joined_at
        FROM public.archived_server_members
        WHERE user_id = target_user_id
        ON CONFLICT (user_id, server_id) DO NOTHING;

        -- Restore friendships
        INSERT INTO public.friendships (user_id, friend_id, status, created_at)
        SELECT user_id, friend_id, status, created_at
        FROM public.archived_friendships
        WHERE user_id = target_user_id OR friend_id = target_user_id
        ON CONFLICT (user_id, friend_id) DO NOTHING;

        -- Delete from archived tables
        DELETE FROM public.archived_users WHERE id = target_user_id;
        DELETE FROM public.archived_server_members WHERE user_id = target_user_id;
        DELETE FROM public.archived_friendships WHERE user_id = target_user_id OR friend_id = target_user_id;
      END;
      $$ LANGUAGE plpgsql;
    `);


    // Seed/Ensure default "General" server exists
    const serverCheck = await client.query("SELECT id FROM servers WHERE name = 'General' LIMIT 1");
    let generalServerId;
    if (serverCheck.rows.length === 0) {
      // Ensure a system user exists first
      const systemUserId = '00000000-0000-0000-0000-000000000000';
      await client.query(`
        INSERT INTO users (id, username, email, password, is_admin)
        VALUES ($1, 'system', 'system@chat.com', 'system_hashed_placeholder', true)
        ON CONFLICT (id) DO NOTHING;
      `, [systemUserId]);

      // Find a suitable owner ID (prefer Nxghtmare3621, fallback to first user or default to systemUserId)
      let ownerId = systemUserId;
      const adminCheck = await client.query("SELECT id FROM users WHERE username = 'Nxghtmare3621' LIMIT 1");
      if (adminCheck.rows.length > 0) {
        ownerId = adminCheck.rows[0].id;
      } else {
        const firstUser = await client.query("SELECT id FROM users WHERE id <> $1 LIMIT 1", [systemUserId]);
        if (firstUser.rows.length > 0) {
          ownerId = firstUser.rows[0].id;
        }
      }

      // Insert "General" server
      const createServer = await client.query(
        "INSERT INTO servers (name, description, owner_id, is_public) VALUES ('General', 'Default server for all members', $1, true) RETURNING id",
        [ownerId]
      );
      generalServerId = createServer.rows[0].id;

      // Create default general chatroom inside the General server
      await client.query(
        "INSERT INTO chatrooms (server_id, name, is_general) VALUES ($1, 'general', true)",
        [generalServerId]
      );
      console.log('Seeded "General" server and chatroom.');
    } else {
      generalServerId = serverCheck.rows[0].id;
    }

    // Auto-join all existing users to General server if they are not members
    await client.query(`
      INSERT INTO server_members (user_id, server_id)
      SELECT id, $1 FROM users u
      WHERE NOT EXISTS (
        SELECT 1 FROM server_members sm 
        WHERE sm.user_id = u.id AND sm.server_id = $1
      )
    `, [generalServerId]);

    // Auto-Moderation Trigger
    await client.query(`
      CREATE OR REPLACE FUNCTION public.check_message_content_moderation()
      RETURNS TRIGGER AS $$
      DECLARE
        violation_found BOOLEAN := FALSE;
        forbidden_regex TEXT := '\\\\y(child\\\\s*porn|childporn|cp|csam|pornography|porn|nudity|nude|illegal\\\\s*weapons|illegal\\\\s*drugs|cocaine|heroin|methamphetamine|meth)\\\\y';
      BEGIN
        IF NEW.content ~* forbidden_regex THEN
          violation_found := TRUE;
        END IF;

        IF violation_found THEN
          UPDATE public.users SET is_banned = TRUE WHERE id = NEW.sender_id;
          RAISE EXCEPTION 'Message blocked by auto-moderation. Your account has been globally banned.';
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;

      DROP TRIGGER IF EXISTS tr_server_msg_moderation ON public.server_messages;
      CREATE TRIGGER tr_server_msg_moderation
        BEFORE INSERT ON public.server_messages
        FOR EACH ROW
        EXECUTE FUNCTION public.check_message_content_moderation();

      DROP TRIGGER IF EXISTS tr_direct_msg_moderation ON public.direct_messages;
      CREATE TRIGGER tr_direct_msg_moderation
        BEFORE INSERT ON public.direct_messages
        FOR EACH ROW
        EXECUTE FUNCTION public.check_message_content_moderation();
    `);

      // Auto-sync sequence counters for tables with SERIAL primary keys
      const serialTables = ['servers', 'chatrooms', 'server_members', 'server_messages', 'direct_messages', 'friendships', 'bans', 'banned_words', 'reports', 'archived_friendships'];
      for (const table of serialTables) {
        try {
          await client.query(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE(MAX(id), 1)) FROM ${table};`);
        } catch (seqErr) {
          // ignore if sequence doesn't exist
        }
      }

      console.log('Tables created successfully');
    } catch (err) {
    console.error('Error creating tables:', err);
    throw err;
  } finally {
    client.release();
  }
}

async function query(text, params) {
  const result = await pool.query(text, params);
  return result;
}

module.exports = {
  initDB,
  query,
  pool
};
