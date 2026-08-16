const express = require('express');
const axios = require('express/node_modules/axios') || require('axios');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Helper to parse YouTube initial data search results
function parseYouTubeSearchResults(html) {
  const videos = [];
  try {
    const jsonMatch = html.match(/var ytInitialData = ({.*?});<\/script>/s) ||
                      html.match(/ytInitialData\s*=\s*({.+?});/s);
    
    if (jsonMatch && jsonMatch[1]) {
      const data = JSON.parse(jsonMatch[1]);
      const contents = data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents;
      
      if (Array.isArray(contents)) {
        for (const section of contents) {
          const itemSection = section?.itemSectionRenderer?.contents;
          if (Array.isArray(itemSection)) {
            for (const item of itemSection) {
              const videoRenderer = item?.videoRenderer;
              if (videoRenderer && videoRenderer.videoId) {
                const videoId = videoRenderer.videoId;
                const title = videoRenderer.title?.runs?.[0]?.text || videoRenderer.title?.simpleText || 'Untitled';
                const channelTitle = videoRenderer.ownerText?.runs?.[0]?.text || videoRenderer.shortBylineText?.runs?.[0]?.text || 'YouTube Creator';
                const views = videoRenderer.viewCountText?.simpleText || videoRenderer.shortViewCountText?.simpleText || '';
                const duration = videoRenderer.lengthText?.simpleText || '';
                const publishedTime = videoRenderer.publishedTimeText?.simpleText || '';
                const thumbnail = videoRenderer.thumbnail?.thumbnails?.slice(-1)[0]?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
                
                videos.push({
                  videoId,
                  title,
                  channelTitle,
                  views,
                  duration,
                  publishedTime,
                  thumbnail
                });
              }
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('[YOUTUBE PARSER] Failed to parse JSON, falling back to regex:', err.message);
  }

  // Regex fallback if JSON parser didn't yield enough
  if (videos.length === 0) {
    const videoMatches = [...html.matchAll(/\/watch\?v=([a-zA-Z0-9_-]{11})/g)];
    const seen = new Set();
    for (const match of videoMatches) {
      const id = match[1];
      if (!seen.has(id) && id !== 'jfKfPfyJRdk') {
        seen.add(id);
        videos.push({
          videoId: id,
          title: 'YouTube Video',
          channelTitle: 'YouTube Creator',
          views: '',
          duration: '',
          publishedTime: '',
          thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
        });
      }
      if (videos.length >= 25) break;
    }
  }

  return videos;
}

// Search YouTube videos
router.get('/search', authMiddleware, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || !q.trim()) {
      return res.status(400).json({ error: 'Search query required' });
    }

    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(q.trim())}`;
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      timeout: 8000
    });

    const videos = parseYouTubeSearchResults(response.data);
    res.json({ results: videos });
  } catch (err) {
    console.error('[YOUTUBE SEARCH ERROR]:', err.message);
    res.status(500).json({ error: 'Failed to search YouTube', details: err.message });
  }
});

// Trending / curated feed endpoint
router.get('/trending', authMiddleware, async (req, res) => {
  try {
    const category = req.query.category || 'music';
    const queryMap = {
      all: 'trending popular videos',
      music: 'popular official music videos 2026',
      gaming: 'popular gaming highlights gameplay',
      news: 'top world news updates today',
      tech: 'latest tech reviews coding software',
      chill: 'lofi hip hop live chill beats'
    };

    const q = queryMap[category] || queryMap.music;
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      timeout: 8000
    });

    const videos = parseYouTubeSearchResults(response.data);
    res.json({ results: videos });
  } catch (err) {
    console.error('[YOUTUBE TRENDING ERROR]:', err.message);
    res.status(500).json({ error: 'Failed to fetch trending videos' });
  }
});

module.exports = router;
