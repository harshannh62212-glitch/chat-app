// backend/scripts/deleteGeneralMessages.js
// Script to delete all messages in 'general' chatrooms.

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { pool } = require('../../db/database');

async function deleteGeneralMessages() {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Starting cleanup of general chatroom messages...`);
  
  try {
    const result = await pool.query(`
      DELETE FROM server_messages
      WHERE chatroom_id IN (
        SELECT id FROM chatrooms WHERE is_general = true OR name = 'general'
      );
    `);
    
    console.log(`[${new Date().toISOString()}] Successfully deleted ${result.rowCount} messages from general chatroom(s).`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Error deleting general chatroom messages:`, err);
  } finally {
    await pool.end();
  }
}

deleteGeneralMessages();
