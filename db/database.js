const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

async function initDB() {
  try {
    await pool.query('SELECT NOW()');
    console.log('Database connection successful');
    await createTables();
  } catch (err) {
    console.error('Database connection failed:', err);
    throw err;
  }
}

async function createTables() {
  const client = await pool.connect();
  try {
    // Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        avatar_url VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Servers table
    await client.query(`
      CREATE TABLE IF NOT EXISTS servers (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        owner_id INTEGER NOT NULL REFERENCES users(id),
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
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        server_id INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, server_id)
      );
    `);

    // Server messages
    await client.query(`
      CREATE TABLE IF NOT EXISTS server_messages (
        id SERIAL PRIMARY KEY,
        sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
        sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        is_read BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Bans table
    await client.query(`
      CREATE TABLE IF NOT EXISTS bans (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        server_id INTEGER REFERENCES servers(id) ON DELETE CASCADE,
        reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP
      );
    `);

    // Column Migrations
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS timeout_until TIMESTAMP;
    `);

    // Seed Administrator role
    await client.query(`
      UPDATE users SET is_admin = true WHERE username = 'Nxghtmare3621';
    `);

    // Banned words table
    await client.query(`
      CREATE TABLE IF NOT EXISTS banned_words (
        id SERIAL PRIMARY KEY,
        word VARCHAR(255) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Seed/Ensure default "General" server exists
    const serverCheck = await client.query("SELECT id FROM servers WHERE name = 'General' LIMIT 1");
    let generalServerId;
    if (serverCheck.rows.length === 0) {
      // Find a suitable owner ID (prefer Nxghtmare3621, fallback to first user or default to 1)
      let ownerId = 1;
      const adminCheck = await client.query("SELECT id FROM users WHERE username = 'Nxghtmare3621' LIMIT 1");
      if (adminCheck.rows.length > 0) {
        ownerId = adminCheck.rows[0].id;
      } else {
        const firstUser = await client.query("SELECT id FROM users LIMIT 1");
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
        "INSERT INTO chatrooms (server_id, name) VALUES ($1, 'general')",
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
