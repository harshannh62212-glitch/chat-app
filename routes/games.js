const express = require('express');
const axios = require('axios');
const router = express.Router();

const BASE_ORIGIN = 'https://house-hunters.epusara.com';
const memoryCache = new Map();
const CACHE_MAX_ITEMS = 300;

// Helper to sanitize and process game HTML
function processGameHtml(rawHtml, originalUrl) {
  let html = rawHtml;

  // 1. Ensure <base> tag exists pointing to the origin games folder so relative scripts, assets, wasm resolve
  const hasBaseTag = /<base\s+[^>]*href=/i.test(html);
  if (!hasBaseTag) {
    const baseHref = originalUrl.endsWith('/') ? originalUrl : originalUrl.substring(0, originalUrl.lastIndexOf('/') + 1);
    const baseTag = `<base href="${baseHref}">`;
    
    if (/<head[^>]*>/i.test(html)) {
      html = html.replace(/<head[^>]*>/i, `$&${baseTag}`);
    } else {
      html = baseTag + html;
    }
  }

  // 2. Neutralize frame-busting scripts (top.location = self.location, window.top.location.href, etc.)
  html = html.replace(/if\s*\(\s*(?:top\s*!==?\s*self|window\.top\s*!==?\s*window\.self|self\s*!==?\s*top)\s*\)\s*(?:top\.location|window\.top\.location)[^;{}]+;/gi, '/* neutralized framebuster */');
  html = html.replace(/top\.location\.href\s*=/gi, '// top.location.href =');
  html = html.replace(/window\.top\.location\s*=/gi, '// window.top.location =');

  // 3. Inject responsive container CSS styling if needed
  const injectedStyle = `
  <style id="wired-game-style">
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      width: 100% !important;
      height: 100% !important;
      overflow: hidden !important;
      background-color: #0d0f17 !important;
    }
  </style>
  `;
  if (/<head[^>]*>/i.test(html)) {
    html = html.replace(/<\/head>/i, `${injectedStyle}</head>`);
  } else {
    html = injectedStyle + html;
  }

  return html;
}

// 1. Game Player Endpoint: /api/games/play?file=...
router.get('/play', async (req, res) => {
  try {
    let { file, url } = req.query;
    let targetUrl = file || url;

    if (!targetUrl) {
      return res.status(400).send('Missing "file" query parameter.');
    }

    // Resolve relative path to BASE_ORIGIN
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      if (targetUrl.startsWith('/')) {
        targetUrl = `${BASE_ORIGIN}${targetUrl}`;
      } else {
        targetUrl = `${BASE_ORIGIN}/games/${targetUrl}`;
      }
    }

    // Check memory cache
    if (memoryCache.has(targetUrl)) {
      const cached = memoryCache.get(targetUrl);
      res.removeHeader('X-Frame-Options');
      res.removeHeader('Content-Security-Policy');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(cached);
    }

    // Fetch game HTML
    const response = await axios.get(targetUrl, {
      responseType: 'text',
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Referer': BASE_ORIGIN + '/'
      }
    });

    const processedHtml = processGameHtml(response.data, targetUrl);

    // Save to cache (manage size)
    if (memoryCache.size >= CACHE_MAX_ITEMS) {
      const firstKey = memoryCache.keys().next().value;
      memoryCache.delete(firstKey);
    }
    memoryCache.set(targetUrl, processedHtml);

    // Headers allowing iframe embedding
    res.removeHeader('X-Frame-Options');
    res.removeHeader('Content-Security-Policy');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(processedHtml);

  } catch (error) {
    console.error('[GAMES] Error proxying game:', error.message);
    res.status(502).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Game Load Error</title>
        <style>
          body { background: #0b0e14; color: #fff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
          .card { background: #1a1e29; padding: 32px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); max-width: 450px; }
          h2 { margin-top: 0; color: #ff4757; }
          p { color: #8892b0; line-height: 1.5; font-size: 0.95rem; }
          button { background: #5865f2; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: bold; margin-top: 15px; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>⚠️ Unable to Load Game</h2>
          <p>The game resource could not be reached or timed out (${error.message}).</p>
          <button onclick="window.location.reload()">Retry Loading</button>
        </div>
      </body>
      </html>
    `);
  }
});

// 2. Cover / Logo Proxy Endpoint: /api/games/cover?url=...
router.get('/cover', async (req, res) => {
  try {
    let { url } = req.query;
    if (!url) {
      return res.status(400).send('Missing url parameter');
    }

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `${BASE_ORIGIN}${url.startsWith('/') ? '' : '/'}${url}`;
    }

    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Referer': BASE_ORIGIN + '/'
      }
    });

    const contentType = response.headers['content-type'] || 'image/webp';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=604800'); // 7 days
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.send(Buffer.from(response.data));
  } catch (error) {
    // Fallback SVG placeholder
    const fallbackSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200">
        <rect width="300" height="200" fill="#151922"/>
        <text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" fill="#5865f2" font-size="42" font-family="sans-serif">🎮</text>
        <text x="50%" y="75%" dominant-baseline="middle" text-anchor="middle" fill="#8892b0" font-size="14" font-family="sans-serif">Wired Arcade</text>
      </svg>
    `;
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(fallbackSvg);
  }
});

// 3. Asset Proxy Endpoint: /api/games/asset?url=...
router.get('/asset', async (req, res) => {
  try {
    let { url } = req.query;
    if (!url) return res.status(400).send('Missing url parameter');

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `${BASE_ORIGIN}${url.startsWith('/') ? '' : '/'}${url}`;
    }

    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 20000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        'Referer': BASE_ORIGIN + '/'
      }
    });

    const contentType = response.headers['content-type'] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=604800');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.send(Buffer.from(response.data));
  } catch (err) {
    res.status(500).send('Asset fetch error');
  }
});

module.exports = router;
