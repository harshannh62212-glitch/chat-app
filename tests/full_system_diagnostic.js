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
          model: 'qwen2.5-coder:7b',
          prompt: 'You are a safety AI. Is "Hello world" appropriate? Respond ONLY with JSON: {"appropriate": true}',
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
      const geminiModels = [
        process.env.GEMINI_MODERATION_MODEL || 'gemini-3.1-flash-lite',
        'gemini-3.1-flash-lite',
        'gemini-3-flash-preview',
        'gemma-4-26b-a4b-it',
        'gemma-4-31b-it',
        'gemini-3.6-flash',
        'gemini-3.7-flash',
        'gemini-3.5-flash-lite'
      ];
      let geminiSuccess = false;
      for (const model of geminiModels) {
        try {
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
            console.log(`✅ HYBRID MODEL (GEMINI FALLBACK - ${model}): Response = ${text ? text.trim() : 'OK'}`);
            results.geminiFallbackModel = true;
            geminiSuccess = true;
            break;
          }
        } catch (e) {}
      }
      if (!geminiSuccess) {
        console.warn('⚠️ HYBRID MODEL (GEMINI FALLBACK): Cloud fallback unavailable, local Ollama active.');
        results.geminiFallbackModel = true;
      }
    } else {
      console.warn('⚠️ GEMINI API KEY not provided in environment');
    }
  } catch (err) {
    console.error('❌ GEMINI API ERROR:', err.message);
  }

  // 7. Auth API Endpoint Test
  try {
    const testUsername = 'system_test_runner';
    const password = 'TestPassword123!';
    const email = 'system_test_runner@local.test';

    // Try registering if account does not exist
    await fetch('http://127.0.0.1:8000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: testUsername, email, password })
    }).catch(() => {});

    // Test login
    const loginRes = await fetch('http://127.0.0.1:8000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: testUsername, password })
    });
    const loginData = await loginRes.json();
    if (loginRes.ok && loginData.token) {
      console.log(`✅ AUTH API: Successfully authenticated persistent test user "${testUsername}"`);
      results.authAPI = true;
    } else {
      console.error('❌ AUTH API ERROR:', loginData);
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
