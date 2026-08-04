// backend/scripts/healthCheck.js
// This script runs periodically (every 5 minutes) to verify that the system APIs are responsive.
// It pings the health endpoint, writes a status JSON file, and optionally sends an SMS notification.

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Optional Twilio SMS support – set the following env vars to enable:
// TWILIO_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM (Twilio phone), TWILIO_TO (your phone)
let smsClient = null;
if (process.env.TWILIO_SID && process.env.TWILIO_AUTH_TOKEN) {
  try {
    const twilio = require('twilio');
    smsClient = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);
  } catch (e) {
    console.warn('Twilio module not installed – SMS notifications disabled');
  }
}

function sendSMS(message) {
  if (!smsClient) return;
  const from = process.env.TWILIO_FROM;
  const to = process.env.TWILIO_TO;
  if (!from || !to) {
    console.warn('TWILIO_FROM or TWILIO_TO not set – SMS not sent');
    return;
  }
  smsClient.messages
    .create({ body: message, from, to })
    .then(() => console.log('SMS sent'))
    .catch(err => console.error('SMS send error:', err.message));
}
module.exports = { sendSMS };


const HEALTH_URL = process.env.HEALTH_URL || `http://localhost:${process.env.PORT || 8000}/api/health`;
const STATUS_FILE = path.resolve(__dirname, '../../public/healthStatus.json');

async function checkHealth() {
  try {
    const res = await axios.get(HEALTH_URL, { timeout: 5000 });
    const status = {
      ok: true,
      timestamp: new Date().toISOString(),
      message: res.data?.message || 'OK'
    };
    fs.writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2));
    console.log('Health check OK');
    // Notify via SMS (optional)
    sendSMS(`✅ Health check OK at ${status.timestamp}`);
  } catch (err) {
    const status = {
      ok: false,
      timestamp: new Date().toISOString(),
      error: err.message
    };
    fs.writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2));
    console.error('Health check failed:', err.message);
    // Notify via SMS (optional)
    sendSMS(`❌ Health check FAILED at ${status.timestamp}: ${status.error}`);
  }
}

function startHealthCheck() {
  if (process.env.VERCEL) return;
  checkHealth();
  setInterval(checkHealth, 5 * 60 * 1000);
}

if (require.main === module) {
  startHealthCheck();
}

module.exports = { sendSMS, checkHealth, startHealthCheck };
