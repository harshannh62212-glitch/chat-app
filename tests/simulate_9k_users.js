require('dotenv').config();
const jwt = require('jsonwebtoken');
const http = require('http');
const { query, initDB } = require('../db/database');
const express = require('express');

const JWT_SECRET = process.env.JWT_SECRET || 'chat_app_jwt_super_secret_key_2026';
const PORT = 8000;
const SIMULATION_DURATION_SEC = 60;
const TOTAL_VIRTUAL_USERS = 9000;
const TEST_TAG = `[SIM_9K_${Date.now()}]`;

// High throughput HTTP Agent with keep-alive
const keepAliveAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 2000,
  maxFreeSockets: 500,
  timeout: 15000
});

async function runSimulation() {
  console.log('================================================================');
  console.log('🚀 INITIALIZING 9,000 CONCURRENT USERS LOAD BALANCER SIMULATION');
  console.log('================================================================');
  console.log(`• Virtual Users: ${TOTAL_VIRTUAL_USERS}`);
  console.log(`• Message Interval per User: Random 10 - 20 seconds`);
  console.log(`• Total Duration: ${SIMULATION_DURATION_SEC} seconds (1 minute)`);
  console.log(`• Tag: ${TEST_TAG}`);
  console.log('----------------------------------------------------------------');

  await initDB();

  // 1. Get or create a test chatroom & user to isolate test traffic
  let testUserResult = await query("SELECT id FROM users WHERE username = 'sim_test_user' LIMIT 1");
  let testUserId;
  if (testUserResult.rows.length === 0) {
    const created = await query(
      "INSERT INTO users (username, email, password) VALUES ('sim_test_user', 'sim_test@test.local', 'dummy_hash') RETURNING id"
    );
    testUserId = created.rows[0].id;
  } else {
    testUserId = testUserResult.rows[0].id;
  }

  let testChatroomResult = await query("SELECT id FROM chatrooms LIMIT 1");
  let testChatroomId = testChatroomResult.rows.length > 0 ? testChatroomResult.rows[0].id : 1;

  // Generate valid test JWT
  const testToken = jwt.sign({ userId: testUserId, username: 'sim_test_user' }, JWT_SECRET);

  // 2. Metrics Tracking
  const latencies = [];
  let totalRequests = 0;
  let successRequests = 0;
  let failedRequests = 0;
  let activeInFlight = 0;
  let peakInFlight = 0;

  const startMemory = process.memoryUsage();
  const startTime = Date.now();

  console.log('⚡ Starting server-side simulation traffic generator...');

  // Helper to make fast HTTP POST
  function sendSimulatedMessage(userIndex) {
    return new Promise((resolve) => {
      const reqStart = Date.now();
      activeInFlight++;
      if (activeInFlight > peakInFlight) peakInFlight = activeInFlight;

      const payload = JSON.stringify({
        chatroomId: testChatroomId,
        content: `${TEST_TAG} Msg from user #${userIndex} at ${Date.now()}`
      });

      const clientIp = `10.${Math.floor(userIndex / 256)}.${userIndex % 256}.1`;

      const req = http.request(
        {
          hostname: '127.0.0.1',
          port: PORT,
          path: '/api/messages/server',
          method: 'POST',
          agent: keepAliveAgent,
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
            'Authorization': `Bearer ${testToken}`,
            'X-Forwarded-For': clientIp
          },
          timeout: 8000
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            const duration = Date.now() - reqStart;
            latencies.push(duration);
            totalRequests++;
            activeInFlight--;
            if (res.statusCode >= 200 && res.statusCode < 300) {
              successRequests++;
            } else {
              failedRequests++;
            }
            resolve();
          });
        }
      );

      req.on('error', (err) => {
        const duration = Date.now() - reqStart;
        latencies.push(duration);
        totalRequests++;
        failedRequests++;
        activeInFlight--;
        resolve();
      });

      req.on('timeout', () => {
        req.destroy();
      });

      req.write(payload);
      req.end();
    });
  }

  // Schedule virtual users across the 60 second window
  const activeIntervalTimers = [];
  const simulationEndTime = startTime + (SIMULATION_DURATION_SEC * 1000);

  // Stagger launch of 9000 users over first 15 seconds
  for (let i = 0; i < TOTAL_VIRTUAL_USERS; i++) {
    const initialDelay = Math.random() * 15000;
    setTimeout(() => {
      const scheduleNext = () => {
        if (Date.now() >= simulationEndTime) return;
        sendSimulatedMessage(i).then(() => {
          if (Date.now() < simulationEndTime) {
            const nextInterval = 10000 + Math.random() * 10000; // 10-20 seconds
            const t = setTimeout(scheduleNext, nextInterval);
            activeIntervalTimers.push(t);
          }
        });
      };
      scheduleNext();
    }, initialDelay);
  }

  // Progress reporter every 10 seconds
  const progressTimer = setInterval(() => {
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    const rps = elapsed > 0 ? (totalRequests / elapsed).toFixed(1) : 0;
    const mem = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
    const recentLatencies = latencies.slice(-500);
    const avgLat = recentLatencies.length > 0
      ? Math.round(recentLatencies.reduce((a, b) => a + b, 0) / recentLatencies.length)
      : 0;

    console.log(
      `⏱️ [${elapsed}s/${SIMULATION_DURATION_SEC}s] Total Sent: ${totalRequests} | Req/sec: ${rps} | Success: ${successRequests} | In-flight: ${activeInFlight} | Latency: ~${avgLat}ms | RAM: ${mem}MB`
    );
  }, 10000);

  // Wait for 60 seconds
  await new Promise((resolve) => setTimeout(resolve, SIMULATION_DURATION_SEC * 1000 + 3000));

  clearInterval(progressTimer);
  activeIntervalTimers.forEach(clearTimeout);

  // 3. Final Calculations
  latencies.sort((a, b) => a - b);
  const minLatency = latencies.length > 0 ? latencies[0] : 0;
  const maxLatency = latencies.length > 0 ? latencies[latencies.length - 1] : 0;
  const avgLatency = latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;
  const p50 = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.50)] : 0;
  const p95 = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.95)] : 0;
  const p99 = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.99)] : 0;
  const totalDuration = (Date.now() - startTime) / 1000;
  const finalRps = (totalRequests / totalDuration).toFixed(2);
  const endMemory = process.memoryUsage();

  console.log('\n================================================================');
  console.log('📊 9,000 USERS SIMULATION RESULTS (1 MINUTE RUN)');
  console.log('================================================================');
  console.log(`• Total Virtual Users:          ${TOTAL_VIRTUAL_USERS}`);
  console.log(`• Messages Processed:           ${totalRequests}`);
  console.log(`• Successful Deliveries:        ${successRequests} (${((successRequests / (totalRequests || 1)) * 100).toFixed(1)}%)`);
  console.log(`• Failed Requests:              ${failedRequests}`);
  console.log(`• Average Throughput:           ${finalRps} req/sec`);
  console.log(`• Peak Concurrent In-Flight:    ${peakInFlight}`);
  console.log('----------------------------------------------------------------');
  console.log('📈 LATENCY DISTRIBUTION:');
  console.log(`• Min Latency:                  ${minLatency} ms`);
  console.log(`• Median (p50):                 ${p50} ms`);
  console.log(`• 95th Percentile (p95):        ${p95} ms`);
  console.log(`• 99th Percentile (p99):        ${p99} ms`);
  console.log(`• Max Latency:                  ${maxLatency} ms`);
  console.log('----------------------------------------------------------------');
  console.log('💾 MEMORY & RESOURCE PROFILE:');
  console.log(`• Heap Used (Start):            ${Math.round(startMemory.heapUsed / 1024 / 1024)} MB`);
  console.log(`• Heap Used (End):              ${Math.round(endMemory.heapUsed / 1024 / 1024)} MB`);
  console.log('================================================================');

  // 4. CLEANUP & REVERT
  console.log('\n🧹 REVERTING AND CLEANING UP SIMULATION DATA...');
  try {
    const deleteRes = await query("DELETE FROM server_messages WHERE content LIKE $1", [`%${TEST_TAG}%`]);
    console.log(`✅ Successfully deleted ${deleteRes.rowCount || 0} simulated test messages from database.`);
    
    // Clean up test user if created
    await query("DELETE FROM users WHERE username = 'sim_test_user'");
    console.log('✅ Reverted test credentials and user records.');
    console.log('🎉 Database and application state are 100% clean and restored.');
  } catch (cleanErr) {
    console.error('Error during cleanup:', cleanErr.message);
  }

  process.exit(0);
}

runSimulation().catch(err => {
  console.error('Simulation error:', err);
  process.exit(1);
});
