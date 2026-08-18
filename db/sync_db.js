const { Pool } = require('pg');
const dns = require('dns');
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

console.log('[SYNC] sync_db message syncing is permanently disabled to prevent restoring purged messages.');
