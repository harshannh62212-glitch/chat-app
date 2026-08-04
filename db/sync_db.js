const { Pool } = require('pg');

const localConnectionString = process.env.LOCAL_DATABASE_URL || 'postgresql://chat_user:secure_password_change_me@127.0.0.1:5432/chat_db';
const supabaseConnectionString = process.env.DATABASE_URL || 'postgresql://postgres:ALLsystems143%40%40@db.aebntdjjniirnwthtwlx.supabase.co:5432/postgres';

const localPool = new Pool({ connectionString: localConnectionString });
const supabasePool = new Pool({ connectionString: supabaseConnectionString });

async function syncTable(tableName, pkeyCol, columns) {
  try {
    const localRes = await localPool.query(`SELECT * FROM ${tableName}`);
    const supabaseRes = await supabasePool.query(`SELECT * FROM ${tableName}`);

    const localRows = localRes.rows;
    const supabaseRows = supabaseRes.rows;

    const localMap = new Map(localRows.map(r => [r[pkeyCol].toString(), r]));
    const supabaseMap = new Map(supabaseRows.map(r => [r[pkeyCol].toString(), r]));

    for (const localRow of localRows) {
      const key = localRow[pkeyCol].toString();
      if (!supabaseMap.has(key)) {
        console.log(`[SYNC] Copying ${tableName} key ${key} from Local to Supabase`);
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
        const values = columns.map(col => localRow[col]);
        try {
          await supabasePool.query(
            `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
            values
          );
        } catch (e) {
          console.error(`[SYNC] Insert failed for ${tableName} key ${key} to Supabase:`, e.message, '\nQuery:', `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`, '\nValues:', values);
        }
      }
    }

    for (const supabaseRow of supabaseRows) {
      const key = supabaseRow[pkeyCol].toString();
      if (!localMap.has(key)) {
        console.log(`[SYNC] Copying ${tableName} key ${key} from Supabase to Local`);
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
        const values = columns.map(col => supabaseRow[col]);
        try {
          await localPool.query(
            `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
            values
          );
        } catch (e) {
          console.error(`[SYNC] Insert failed for ${tableName} key ${key} to Local:`, e.message);
        }
      }
    }
  } catch (err) {
    console.error(`[SYNC] Error syncing table ${tableName}:`, err.message);
  }
}

async function syncMessages(tableName, columns) {
  try {
    const localRes = await localPool.query(`SELECT * FROM ${tableName} ORDER BY created_at ASC`);
    const supabaseRes = await supabasePool.query(`SELECT * FROM ${tableName} ORDER BY created_at ASC`);

    const makeSig = (r) => `${r.sender_id}_${r.content ? r.content.substring(0, 50) : ''}_${new Date(r.created_at).getTime()}`;

    const localSigs = new Set(localRes.rows.map(makeSig));
    const supabaseSigs = new Set(supabaseRes.rows.map(makeSig));

    for (const localRow of localRes.rows) {
      const sig = makeSig(localRow);
      if (!supabaseSigs.has(sig)) {
        console.log(`[SYNC] Copying new message from Local to Supabase`);
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
        const values = columns.map(col => localRow[col]);
        await supabasePool.query(
          `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`,
          values
        );
      }
    }

    for (const supabaseRow of supabaseRes.rows) {
      const sig = makeSig(supabaseRow);
      if (!localSigs.has(sig)) {
        console.log(`[SYNC] Copying new message from Supabase to Local`);
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
        const values = columns.map(col => supabaseRow[col]);
        await localPool.query(
          `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`,
          values
        );
      }
    }
  } catch (err) {
    console.error(`[SYNC] Error syncing messages in ${tableName}:`, err.message);
  }
}

async function initSyncDB() {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS system_config (
      key VARCHAR(255) PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
  try {
    await localPool.query(createTableQuery);
    await supabasePool.query(createTableQuery);
    console.log('[SYNC] system_config table ensured on both local and Supabase databases.');
  } catch (err) {
    console.error('[SYNC] Failed to initialize system_config tables:', err.message);
  }
}

async function runSyncCycle() {
  console.log('[SYNC] Starting synchronization cycle...');
  try {
    await syncTable('users', 'id', ['id', 'username', 'email', 'password', 'avatar_url']);
    await syncTable('servers', 'id', ['id', 'name', 'owner_id', 'avatar_url']);
    await syncTable('chatrooms', 'id', ['id', 'server_id', 'name', 'is_general']);
    await syncTable('server_members', 'id', ['id', 'user_id', 'server_id']);
    await syncTable('system_config', 'key', ['key', 'value']);

    await syncMessages('server_messages', ['sender_id', 'chatroom_id', 'content', 'created_at', 'reactions']);
    await syncMessages('direct_messages', ['sender_id', 'recipient_id', 'content', 'created_at', 'reactions']);
  } catch (err) {
    console.error('[SYNC] Cycle encountered error:', err.message);
  }
  console.log('[SYNC] Sync cycle completed.');
}

console.log('🚀 Starting background database synchronizer daemon...');
(async () => {
  await initSyncDB();
  setInterval(runSyncCycle, 15000);
  runSyncCycle();
})();
