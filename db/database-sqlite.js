const Database = require('better-sqlite3');
const path = require('path');

// Create/connect to database file
const dbPath = path.join(__dirname, '../chat_app.db');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

async function initDB() {
  try {
    console.log('✅ Database connected (SQLite)');
    await createTables();
  } catch (err) {
    console.error('Database error:', err);
    throw err;
  }
}

async function createTables() {
  try {
    // Users table
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255),
        password VARCHAR(255) NOT NULL,
        avatar_url VARCHAR(255),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Servers table
    db.exec(`
      CREATE TABLE IF NOT EXISTS servers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        owner_id INTEGER NOT NULL REFERENCES users(id),
        password_hash VARCHAR(255),
        is_public BOOLEAN DEFAULT 1,
        avatar_url VARCHAR(255),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Chatrooms table
    db.exec(`
      CREATE TABLE IF NOT EXISTS chatrooms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        server_id INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        is_general BOOLEAN DEFAULT 0,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(server_id, is_general)
      )
    `);

    // Server members
    db.exec(`
      CREATE TABLE IF NOT EXISTS server_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        server_id INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
        joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, server_id)
      )
    `);

    // Server messages
    db.exec(`
      CREATE TABLE IF NOT EXISTS server_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        chatroom_id INTEGER NOT NULL REFERENCES chatrooms(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Direct messages
    db.exec(`
      CREATE TABLE IF NOT EXISTS direct_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        is_read BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Bans table
    db.exec(`
      CREATE TABLE IF NOT EXISTS bans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        server_id INTEGER REFERENCES servers(id) ON DELETE CASCADE,
        reason TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME
      )
    `);

    console.log('✅ Tables created successfully');
  } catch (err) {
    console.error('Error creating tables:', err);
    throw err;
  }
}

// Wrapper for database queries - convert to promise
function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    try {
      if (sql.trim().toUpperCase().startsWith('SELECT')) {
        const stmt = db.prepare(sql);
        const result = stmt.all(...params);
        resolve({ rows: result });
      } else {
        const stmt = db.prepare(sql);
        const result = stmt.run(...params);
        resolve({ 
          rows: result.changes > 0 ? [{ id: result.lastInsertRowid, ...params }] : [],
          lastID: result.lastInsertRowid
        });
      }
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  initDB,
  query,
  db
};
