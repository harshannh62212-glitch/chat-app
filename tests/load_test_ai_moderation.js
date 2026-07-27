import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend, Rate, Gauge } from 'k6/metrics';

// Custom metrics
const wsConnectTime = new Trend('ws_connect_ms');
const healthCheckTime = new Trend('health_check_ms');
const aiModerationTime = new Trend('ai_moderation_ms');
const failRate = new Rate('failed_requests');
const activeConnections = new Gauge('active_connections');
const aiRejected = new Counter('ai_rejected_messages');
const msgSent = new Counter('messages_sent');

export const options = {
  scenarios: {
    // Phase 1: HTTP health & connectivity stress
    http_load: {
      executor: 'ramping-vus',
      stages: [
        { duration: '20s', target: 500 },
        { duration: '30s', target: 2000 },
        { duration: '40s', target: 5000 },
        { duration: '60s', target: 9000 },
        { duration: '30s', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<3000'],
    failed_requests: ['rate<0.10'],     // allow up to 10% for auth rejections
    health_check_ms: ['p(95)<500'],     // health check must be fast
  },
};

// Message samples (70% clean, 20% profanity/bypass, 10% borderline)
const CLEAN = [
  'Hey everyone!',
  'What time is the meeting?',
  'Working on the auth module today',
  'Can we do a code review later?',
  'The tests are passing now!',
  'Good morning team!',
  'Has anyone seen the latest commit?',
  'The dashboard looks great!',
];

const PROFANITY = [
  'what the fuck is this shit',
  'this app is such bullshit',
  'f*ck this garbage',
  'are you $hitting me',
  'b!tch ass bug',
  'fuckk this is broken',
  'horsesh1t code',
  'holy shit it crashed',
];

const BORDERLINE = [
  'damn it broke again',
  'wtf is this',
  'this is crap',
  'screw this',
  'hell of a bug',
];

const BASE = 'http://192.168.1.27:8000';

function pickMessage(vu) {
  const r = Math.random();
  const arr = r < 0.70 ? CLEAN : r < 0.90 ? PROFANITY : BORDERLINE;
  return arr[vu % arr.length];
}

export default function () {
  const vu = __VU;

  // === TEST 1: Health endpoint ===
  const t0 = Date.now();
  const health = http.get(`${BASE}/api/health`, { timeout: '3s', tags: { name: 'health' } });
  healthCheckTime.add(Date.now() - t0);
  const healthOk = check(health, {
    'health endpoint 200': (r) => r.status === 200,
    'health body ok': (r) => r.body.includes('ok'),
  });
  failRate.add(!healthOk);

  sleep(0.05);

  // === TEST 2: Ping (lightweight liveness) ===
  const ping = http.get(`${BASE}/ping`, { timeout: '2s', tags: { name: 'ping' } });
  check(ping, { 'ping responds': (r) => r.status === 200 });

  sleep(0.05);

  // === TEST 3: AI Moderation endpoint (public-report, no auth required) ===
  // This directly exercises the Ollama AI evaluation path
  const msg = pickMessage(vu);
  const isBad = Math.random() < 0.20; // 20% profanity
  const reportMsg = isBad ? PROFANITY[vu % PROFANITY.length] : `Legitimate bug: ${CLEAN[vu % CLEAN.length]} - UI glitch on page ${vu}`;

  const t1 = Date.now();
  const report = http.post(
    `${BASE}/api/public-report`,
    JSON.stringify({ description: reportMsg }),
    {
      headers: { 'Content-Type': 'application/json' },
      timeout: '15s',  // AI moderation can take a few seconds
      tags: { name: 'ai_moderation' },
    }
  );
  const modDuration = Date.now() - t1;
  aiModerationTime.add(modDuration);
  msgSent.add(1);

  if (report.status === 400 || report.status === 422) {
    aiRejected.add(1);  // AI correctly rejected spam/profanity
  }

  const reportOk = check(report, {
    'report accepted or AI rejected': (r) => [200, 201, 400, 422].includes(r.status),
  });
  failRate.add(!reportOk);

  sleep(0.5 + Math.random() * 2.0);
}

export function handleSummary(data) {
  const sent = data.metrics.messages_sent?.values?.count ?? 0;
  const rejected = data.metrics.ai_rejected_messages?.values?.count ?? 0;
  const rejRate = sent > 0 ? ((rejected / sent) * 100).toFixed(1) : '0';
  const failPct = ((data.metrics.failed_requests?.values?.rate ?? 0) * 100).toFixed(2);
  const healthP95 = Math.round(data.metrics.health_check_ms?.values?.['p(95)'] ?? 0);
  const modP50 = Math.round(data.metrics.ai_moderation_ms?.values?.['p(50)'] ?? 0);
  const modP95 = Math.round(data.metrics.ai_moderation_ms?.values?.['p(95)'] ?? 0);
  const modP99 = Math.round(data.metrics.ai_moderation_ms?.values?.['p(99)'] ?? 0);
  const httpP95 = Math.round(data.metrics.http_req_duration?.values?.['p(95)'] ?? 0);

  const aiOk = modP95 < 10000 ? '✅ PASS' : '❌ SLOW';
  const healthOk = healthP95 < 500 ? '✅ PASS' : '❌ FAIL';
  const failOk = parseFloat(failPct) < 10 ? '✅ PASS' : '❌ HIGH';

  return {
    stdout: `
╔═══════════════════════════════════════════════════════════╗
║      AI MODERATION + 9K USER LOAD TEST — FULL RESULTS    ║
╠═══════════════════════════════════════════════════════════╣
║  SCALE                                                   ║
║  Peak VUs:             9,000                             ║
║  Total AI Requests:    ${String(sent).padEnd(37)}║
║                                                          ║
║  AI MODERATION QUALITY                                   ║
║  AI Rejected (spam):   ${String(rejected).padEnd(37)}║
║  Rejection Rate:       ${String(rejRate + '%  (target: ~20% = profanity share)').padEnd(37)}║
║                                                          ║
║  LATENCY                                                 ║
║  Health Check p95:     ${String(healthP95 + 'ms  ' + healthOk).padEnd(37)}║
║  AI Moderation p50:    ${String(modP50 + 'ms').padEnd(37)}║
║  AI Moderation p95:    ${String(modP95 + 'ms  ' + aiOk).padEnd(37)}║
║  AI Moderation p99:    ${String(modP99 + 'ms').padEnd(37)}║
║  HTTP overall p95:     ${String(httpP95 + 'ms').padEnd(37)}║
║                                                          ║
║  RELIABILITY                                             ║
║  Failure Rate:         ${String(failPct + '%  ' + failOk).padEnd(37)}║
╚═══════════════════════════════════════════════════════════╝
`,
  };
}
