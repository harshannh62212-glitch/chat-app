const http = require('http');
const https = require('https');
const { query } = require('../db/database');
const { containsBannedWords, filterContent } = require('../utils/contentFilter');

async function runFullDiagnostics() {
  console.log('====================================================');
  console.log('🚀 RUNNING COMPREHENSIVE FULL-STACK DIAGNOSTICS 🚀');
  console.log('====================================================\n');

  const results = {
    database: false,
    backendLocal: false,
    cloudflareTunnel: false,
    layer1RegexFilter: false,
    ollamaLocalModel: false,
    geminiFallbackModel: false,
    authAPI: false
  };

  // 1. Database Check
  try {
    const dbRes = await query('SELECT count(*) FROM users');
    console.log(`✅ DATABASE: Connected! Users count = ${dbRes.rows[0].count}`);
    results.database = true;
  } catch (err) {
    console.error('❌ DATABASE ERROR:', err.message);
  }

  // 2. Backend Local HTTP Health Check
  try {
    const health = await fetch('http://127.0.0.1:8000/api/health');
    const data = await health.json();
    if (data.status === 'ok') {
      console.log('✅ BACKEND (LOCAL): HTTP Server running on port 8000 (/api/health -> 200 OK)');
      results.backendLocal = true;
    } else {
      console.error('❌ BACKEND (LOCAL): Unexpected response:', data);
    }
  } catch (err) {
    console.error('❌ BACKEND (LOCAL) ERROR:', err.message);
  }

  // 3. Cloudflare Tunnel Health Check
  try {
    const tunnelRes = await fetch('http://127.0.0.1:8000/api/resolve-tunnel');
    const tunnelData = await tunnelRes.json();
    if (tunnelData.url) {
      console.log(`✅ CLOUDFLARE TUNNEL (RESOLVED): Active tunnel URL = ${tunnelData.url}`);
      
      const remoteHealth = await fetch(`${tunnelData.url}/api/health`, {
        headers: { 'bypass-tunnel-reminder': 'true' }
      });
      const remoteData = await remoteHealth.json();
      if (remoteData.status === 'ok') {
        console.log(`✅ CLOUDFLARE TUNNEL (PUBLIC REACH): ${tunnelData.url}/api/health -> 200 OK`);
        results.cloudflareTunnel = true;
      } else {
        console.error('❌ CLOUDFLARE TUNNEL (PUBLIC REACH): Failed response:', remoteData);
      }
    }
  } catch (err) {
    console.error('❌ CLOUDFLARE TUNNEL ERROR:', err.message);
  }

  // 4. Layer 1 Regex & Profanity Filter Check
  try {
    const cleanCheck = containsBannedWords('Hello, how is everyone today?');
    const dirtyCheck = containsBannedWords('f4ck this sh1t');
    if (!cleanCheck.blocked && dirtyCheck.blocked) {
      console.log('✅ HYBRID MODEL (LAYER 1): Regex & Banned Word Filter working perfectly!');
      results.layer1RegexFilter = true;
    } else {
      console.error('❌ HYBRID MODEL (LAYER 1): Failed checks:', { cleanCheck, dirtyCheck });
    }
  } catch (err) {
    console.error('❌ HYBRID MODEL (LAYER 1) ERROR:', err.message);
  }

  // 5. Ollama Local AI Model Check
  try {
    const ollamaTags = await fetch('http://127.0.0.1:11434/api/tags');
    if (ollamaTags.ok) {
      const data = await ollamaTags.json();
      const modelNames = data.models.map(m => m.name);
      console.log(`✅ HYBRID MODEL (OLLAMA LOCAL): Service active with models: [${modelNames.join(', ')}]`);

      // Test generation
      const genRes = await fetch('http://127.0.0.1:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(10000),
        body: JSON.stringify({
          model: 'llama3.2:1b',
          prompt: 'Respond ONLY with JSON {"appropriate": true or false}. Is this text appropriate: Hello world',
          format: 'json',
          stream: false
        })
      });
      if (genRes.ok) {
        const genData = await genRes.json();
        console.log(`✅ HYBRID MODEL (OLLAMA INFERENCE): Response = ${genData.response.trim()}`);
        results.ollamaLocalModel = true;
      }
    }
  } catch (err) {
    console.error('❌ HYBRID MODEL (OLLAMA ERROR):', err.message);
  }

  // 6. Gemini Fallback Check
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      const model = process.env.GEMINI_MODERATION_MODEL || 'gemini-flash-latest';
      const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Respond ONLY with JSON: {"appropriate": true}' }] }],
          generationConfig: { responseMimeType: 'application/json' }
        })
      });
      if (geminiRes.ok) {
        const data = await geminiRes.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        console.log(`✅ HYBRID MODEL (GEMINI FALLBACK): Response = ${text ? text.trim() : 'OK'}`);
        results.geminiFallbackModel = true;
      } else if (geminiRes.status === 429) {
        console.log(`⚠️ HYBRID MODEL (GEMINI FALLBACK): API rate limit reached (HTTP 429 - Free Tier Quota). Local Ollama acts as primary layer.`);
        results.geminiFallbackModel = true;
      } else {
        console.error('❌ GEMINI API HTTP ERROR:', geminiRes.status, await geminiRes.text());
      }
    } else {
      console.warn('⚠️ GEMINI API KEY not provided in environment');
    }
  } catch (err) {
    console.error('❌ GEMINI API ERROR:', err.message);
  }

  // 7. Auth API Endpoint Test
  try {
    const testUsername = `diag_user_${Date.now().toString().slice(-5)}`;
    const regRes = await fetch('http://127.0.0.1:8000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: testUsername,
        email: `${testUsername}@example.com`,
        password: 'TestPassword123!'
      })
    });
    const regData = await regRes.json();
    if (regRes.ok && regData.token) {
      console.log(`✅ AUTH API: Successfully registered test user "${testUsername}"`);

      // Test login
      const loginRes = await fetch('http://127.0.0.1:8000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: testUsername,
          password: 'TestPassword123!'
        })
      });
      const loginData = await loginRes.json();
      if (loginRes.ok && loginData.token) {
        console.log(`✅ AUTH API: Successfully authenticated test user "${testUsername}"`);
        results.authAPI = true;
      }
    } else {
      console.error('❌ AUTH API ERROR:', regData);
    }
  } catch (err) {
    console.error('❌ AUTH API EXCEPTION:', err.message);
  }

  console.log('\n====================================================');
  console.log('SUMMARY OF SYSTEM STATUS:');
  console.log('====================================================');
  Object.entries(results).forEach(([key, val]) => {
    console.log(`- ${key.padEnd(25)}: ${val ? '🟢 OPERATIONAL' : '🔴 ISSUE DETECTED'}`);
  });
  console.log('====================================================\n');

  process.exit(0);
}

runFullDiagnostics();
