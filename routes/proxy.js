const express = require('express');
const axios = require('axios');
const router = express.Router();

router.get('/', async (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).send('Error: URL query parameter is required');
  }

  try {
    // Basic URL validation
    let targetUrl = url;
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = 'https://' + targetUrl;
    }

    const response = await axios({
      method: 'get',
      url: targetUrl,
      responseType: 'stream',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*'
      },
      timeout: 15000
    });

    // Copy essential headers
    if (response.headers['content-type']) {
      res.setHeader('Content-Type', response.headers['content-type']);
    }
    if (response.headers['content-length']) {
      res.setHeader('Content-Length', response.headers['content-length']);
    }
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Pipe the response data stream
    response.data.pipe(res);
  } catch (error) {
    console.error('[WEB PROXY ERROR]', error.message);
    res.status(500).send(`Web Proxy failed to fetch target: ${error.message}`);
  }
});

module.exports = router;
