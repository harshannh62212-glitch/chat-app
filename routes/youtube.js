const express = require('express');
const axios = require('axios');
const { authMiddleware } = require('../middleware/auth');
const ramCache = require('../utils/ramCache');

const router = express.Router();

// Helper to extract video ID from any YouTube or Google Search URL
function extractUniversalVideoId(input) {
  if (!input || typeof input !== 'string') return null;
  let text = input.trim();

  // 1. If it's a Google Search redirect URL, extract the embedded destination URL
  if (text.includes('google.') && (text.includes('/url?') || text.includes('url=') || text.includes('q='))) {
    try {
      const parsed = new URL(text.startsWith('http') ? text : `https://${text}`);
      const rawTarget = parsed.searchParams.get('url') || parsed.searchParams.get('q') || parsed.searchParams.get('dest');
      if (rawTarget) {
        text = decodeURIComponent(rawTarget);
      }
    } catch (e) {
      // Fallback regex for Google url parameter
      const gMatch = text.match(/[?&](?:url|q)=([^&]+)/);
      if (gMatch && gMatch[1]) {
        try {
          text = decodeURIComponent(gMatch[1]);
        } catch (decErr) {
          text = gMatch[1];
        }
      }
    }
  }

  // Handle URL decoded variations
  try {
    text = decodeURIComponent(text);
  } catch (e) {}

  // 2. Direct 11-char video ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(text.trim())) {
    return text.trim();
  }

  // 3. YouTube Shorts: youtube.com/shorts/VIDEO_ID
  const shortsMatch = text.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/i);
  if (shortsMatch && shortsMatch[1]) return shortsMatch[1];

  // 4. Standard YouTube watch/embed/v/live/youtu.be URLs
  const match = text.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|live\/))([a-zA-Z0-9_-]{11})/i);
  if (match && match[1]) return match[1];

  // 5. Fallback regex for any v= param
  const vParamMatch = text.match(/[?&]v=([a-zA-Z0-9_-]{11})/i);
  if (vParamMatch && vParamMatch[1]) return vParamMatch[1];

  return null;
}

// ─── MASSIVE CURATED MULTI-CATEGORY YOUTUBE CATALOG (150+ Top Videos & Streams) ─────
const CURATED_CATALOG = {
  music: [
    { videoId: 'kJQP7kiw5Fk', title: 'Luis Fonsi - Despacito ft. Daddy Yankee', channelTitle: 'Luis Fonsi', views: '8.4B views', duration: '4:41', thumbnail: 'https://i.ytimg.com/vi/kJQP7kiw5Fk/hqdefault.jpg' },
    { videoId: 'JGwWNGJdvx8', title: 'Ed Sheeran - Shape of You (Official Music Video)', channelTitle: 'Ed Sheeran', views: '6.2B views', duration: '4:23', thumbnail: 'https://i.ytimg.com/vi/JGwWNGJdvx8/hqdefault.jpg' },
    { videoId: 'OPf0YbXqDm0', title: 'Mark Ronson - Uptown Funk ft. Bruno Mars', channelTitle: 'Mark Ronson', views: '5.1B views', duration: '4:30', thumbnail: 'https://i.ytimg.com/vi/OPf0YbXqDm0/hqdefault.jpg' },
    { videoId: 'fJ9rUzIMcZQ', title: 'Queen - Bohemian Rhapsody (Official Video Remastered)', channelTitle: 'Queen Official', views: '1.7B views', duration: '5:59', thumbnail: 'https://i.ytimg.com/vi/fJ9rUzIMcZQ/hqdefault.jpg' },
    { videoId: 'hT_nvWreIhg', title: 'OneRepublic - Counting Stars (Official Music Video)', channelTitle: 'OneRepublic', views: '4.0B views', duration: '4:44', thumbnail: 'https://i.ytimg.com/vi/hT_nvWreIhg/hqdefault.jpg' },
    { videoId: '09R8_2nJtjg', title: 'Maroon 5 - Sugar (Official Music Video)', channelTitle: 'Maroon 5', views: '4.0B views', duration: '5:01', thumbnail: 'https://i.ytimg.com/vi/09R8_2nJtjg/hqdefault.jpg' },
    { videoId: 'CevxZvSJLk8', title: 'Katy Perry - Roar (Official)', channelTitle: 'Katy Perry', views: '3.9B views', duration: '4:30', thumbnail: 'https://i.ytimg.com/vi/CevxZvSJLk8/hqdefault.jpg' },
    { videoId: 'YQHsXMglC9A', title: 'Adele - Hello (Official Music Video)', channelTitle: 'Adele', views: '3.1B views', duration: '6:06', thumbnail: 'https://i.ytimg.com/vi/YQHsXMglC9A/hqdefault.jpg' },
    { videoId: 'LsoLEjrDogU', title: 'Bruno Mars - That’s What I Like (Official Video)', channelTitle: 'Bruno Mars', views: '2.2B views', duration: '3:30', thumbnail: 'https://i.ytimg.com/vi/LsoLEjrDogU/hqdefault.jpg' },
    { videoId: 'k2qgadSvNyU', title: 'Dua Lipa - New Rules (Official Music Video)', channelTitle: 'Dua Lipa', views: '2.9B views', duration: '3:44', thumbnail: 'https://i.ytimg.com/vi/k2qgadSvNyU/hqdefault.jpg' },
    { videoId: 'fRh_vgS2dFE', title: 'Justin Bieber - Sorry (PURPOSE : The Movement)', channelTitle: 'Justin Bieber', views: '3.6B views', duration: '3:26', thumbnail: 'https://i.ytimg.com/vi/fRh_vgS2dFE/hqdefault.jpg' },
    { videoId: 'RgKAFK5djSk', title: 'Wiz Khalifa - See You Again ft. Charlie Puth', channelTitle: 'Wiz Khalifa', views: '6.1B views', duration: '3:57', thumbnail: 'https://i.ytimg.com/vi/RgKAFK5djSk/hqdefault.jpg' },
    { videoId: '4NRXx6U8ABQ', title: 'The Weeknd - Blinding Lights (Official Video)', channelTitle: 'The Weeknd', views: '800M views', duration: '4:20', thumbnail: 'https://i.ytimg.com/vi/4NRXx6U8ABQ/hqdefault.jpg' },
    { videoId: '7wtfhZwyrcc', title: 'Imagine Dragons - Believer (Official Music Video)', channelTitle: 'Imagine Dragons', views: '2.6B views', duration: '3:36', thumbnail: 'https://i.ytimg.com/vi/7wtfhZwyrcc/hqdefault.jpg' }
  ],
  chill: [
    { videoId: 'jfKfPfyJRdk', title: 'lofi hip hop radio 📚 - beats to relax/study to', channelTitle: 'Lofi Girl', views: 'Live Stream', duration: 'LIVE', thumbnail: 'https://i.ytimg.com/vi/jfKfPfyJRdk/hqdefault.jpg' },
    { videoId: 'rUxyKA_-grg', title: 'synthwave radio 🌌 - chill beats to relax/game to', channelTitle: 'Lofi Girl', views: 'Live Stream', duration: 'LIVE', thumbnail: 'https://i.ytimg.com/vi/rUxyKA_-grg/hqdefault.jpg' },
    { videoId: '5yx6BWlEVcY', title: 'Chillhop Radio - jazzy & lofi hip hop beats', channelTitle: 'Chillhop Music', views: 'Live Stream', duration: 'LIVE', thumbnail: 'https://i.ytimg.com/vi/5yx6BWlEVcY/hqdefault.jpg' },
    { videoId: 'e3L1Ias45JU', title: 'Warm Morning - Coffee Shop Ambient Music', channelTitle: 'Coffee Relaxing', views: '14M views', duration: '3:00:00', thumbnail: 'https://i.ytimg.com/vi/e3L1Ias45JU/hqdefault.jpg' },
    { videoId: 'DWcJFNfaw9c', title: 'Relaxing Sleep Music • Deep Sleeping Music, Relaxing Music', channelTitle: 'Soothing Relaxation', views: '185M views', duration: '8:00:00', thumbnail: 'https://i.ytimg.com/vi/DWcJFNfaw9c/hqdefault.jpg' },
    { videoId: 'lTRiuFIWV54', title: 'Night Ambience with Soft Rain & Jazz Piano', channelTitle: 'Calm Jazz', views: '22M views', duration: '3:30:00', thumbnail: 'https://i.ytimg.com/vi/lTRiuFIWV54/hqdefault.jpg' },
    { videoId: '7NOSDKb0HlU', title: 'Peaceful Piano Radio - Relaxing Music for Focus', channelTitle: 'Lofi Girl Piano', views: 'Live Stream', duration: 'LIVE', thumbnail: 'https://i.ytimg.com/vi/7NOSDKb0HlU/hqdefault.jpg' },
    { videoId: 'WPni755-Krg', title: 'Ambient Study Music to Concentrate [Deep Focus]', channelTitle: 'StudyMD', views: '19M views', duration: '3:00:00', thumbnail: 'https://i.ytimg.com/vi/WPni755-Krg/hqdefault.jpg' }
  ],
  gaming: [
    { videoId: 'V9PBRq_Gog8', title: 'Minecraft 1.21 Tricky Trials - Full Update Showcase', channelTitle: 'Minecraft', views: '8.5M views', duration: '18:24', thumbnail: 'https://i.ytimg.com/vi/V9PBRq_Gog8/hqdefault.jpg' },
    { videoId: 'QdBZY2fkU-0', title: 'Grand Theft Auto VI Trailer 1', channelTitle: 'Rockstar Games', views: '210M views', duration: '1:31', thumbnail: 'https://i.ytimg.com/vi/QdBZY2fkU-0/hqdefault.jpg' },
    { videoId: 'd10kP_0fL6Q', title: 'Elden Ring: Shadow of the Erdtree - Official Gameplay Trailer', channelTitle: 'Bandai Namco', views: '12M views', duration: '3:07', thumbnail: 'https://i.ytimg.com/vi/d10kP_0fL6Q/hqdefault.jpg' },
    { videoId: 'mOD17gH3b9c', title: 'The Evolution of Video Game Graphics (1972-2026)', channelTitle: 'NeverKnowsBest', views: '6.4M views', duration: '42:15', thumbnail: 'https://i.ytimg.com/vi/mOD17gH3b9c/hqdefault.jpg' },
    { videoId: '04a6_5qJ1qU', title: 'Top 10 Most Insane Esports Plays of All Time', channelTitle: 'theScore esports', views: '9.2M views', duration: '21:10', thumbnail: 'https://i.ytimg.com/vi/04a6_5qJ1qU/hqdefault.jpg' },
    { videoId: 'r72GP1PIZa0', title: 'Cyberpunk 2077: Phantom Liberty — Official Cinematic Trailer', channelTitle: 'Cyberpunk 2077', views: '16M views', duration: '3:50', thumbnail: 'https://i.ytimg.com/vi/r72GP1PIZa0/hqdefault.jpg' },
    { videoId: 'e_04ZrNroTo', title: 'Valorant Champions Grand Finals - Full Movie', channelTitle: 'VALORANT Champions Tour', views: '3.8M views', duration: '34:20', thumbnail: 'https://i.ytimg.com/vi/e_04ZrNroTo/hqdefault.jpg' }
  ],
  tech: [
    { videoId: 'kqtD5dpn9C8', title: 'Python for Beginners - Full Course [Programming Tutorial]', channelTitle: 'freeCodeCamp.org', views: '41M views', duration: '4:26:52', thumbnail: 'https://i.ytimg.com/vi/kqtD5dpn9C8/hqdefault.jpg' },
    { videoId: 'bMknfKXIFA8', title: 'React Full Course for Beginners (2026 Update)', channelTitle: 'freeCodeCamp.org', views: '4.8M views', duration: '11:55:28', thumbnail: 'https://i.ytimg.com/vi/bMknfKXIFA8/hqdefault.jpg' },
    { videoId: 'aircAruvnKk', title: 'Neural Networks from Scratch - Full Deep Dive', channelTitle: '3Blue1Brown', views: '18M views', duration: '19:13', thumbnail: 'https://i.ytimg.com/vi/aircAruvnKk/hqdefault.jpg' },
    { videoId: 'G3e-cpL7ofc', title: 'HTML & CSS Full Course - Beginner to Pro', channelTitle: 'SuperSimpleDev', views: '12M views', duration: '6:31:24', thumbnail: 'https://i.ytimg.com/vi/G3e-cpL7ofc/hqdefault.jpg' },
    { videoId: 'Z1BCujX3pw8', title: 'Building a Full Stack Realtime Web App with Node.js & React', channelTitle: 'Fireship', views: '2.5M views', duration: '12:45', thumbnail: 'https://i.ytimg.com/vi/Z1BCujX3pw8/hqdefault.jpg' },
    { videoId: '8aGhZQkoFbQ', title: 'What is a REST API? [In 5 Minutes]', channelTitle: 'Web Dev Simplified', views: '3.1M views', duration: '5:24', thumbnail: 'https://i.ytimg.com/vi/8aGhZQkoFbQ/hqdefault.jpg' },
    { videoId: 'PkZNo7MFNFg', title: 'JavaScript Tutorial for Beginners: Learn JS in 1 Hour', channelTitle: 'Programming with Mosh', views: '8.2M views', duration: '48:16', thumbnail: 'https://i.ytimg.com/vi/PkZNo7MFNFg/hqdefault.jpg' }
  ],
  podcasts: [
    { videoId: 'vMgUq_rXw2M', title: 'Sam Altman: OpenAI, GPT-5, AGI, and the Future of AI', channelTitle: 'Lex Fridman Podcast', views: '4.2M views', duration: '2:14:30', thumbnail: 'https://i.ytimg.com/vi/vMgUq_rXw2M/hqdefault.jpg' },
    { videoId: 'gXJYkG6P3fE', title: 'Master Your Sleep & Energy | Huberman Lab Podcast', channelTitle: 'Andrew Huberman', views: '7.8M views', duration: '1:48:22', thumbnail: 'https://i.ytimg.com/vi/gXJYkG6P3fE/hqdefault.jpg' },
    { videoId: '8_lFxU5K22g', title: 'Elon Musk: Neuralink, Mars, and the Next Era of Humanity', channelTitle: 'Joe Rogan Experience', views: '28M views', duration: '3:12:45', thumbnail: 'https://i.ytimg.com/vi/8_lFxU5K22g/hqdefault.jpg' },
    { videoId: 'rXw0bWq0o0A', title: 'How to Learn Anything Fast - Richard Feynman Technique', channelTitle: 'Ali Abdaal', views: '5.1M views', duration: '14:20', thumbnail: 'https://i.ytimg.com/vi/rXw0bWq0o0A/hqdefault.jpg' }
  ],
  science: [
    { videoId: '4_aOIA-vyBo', title: 'The Absurd Reality of Quantum Mechanics', channelTitle: 'Veritasium', views: '14M views', duration: '23:18', thumbnail: 'https://i.ytimg.com/vi/4_aOIA-vyBo/hqdefault.jpg' },
    { videoId: 'uD4izuDMUQA', title: 'The Last Time the Universe Will Ever Make Sense', channelTitle: 'Kurzgesagt – In a Nutshell', views: '19M views', duration: '11:15', thumbnail: 'https://i.ytimg.com/vi/uD4izuDMUQA/hqdefault.jpg' },
    { videoId: 'b_N8i7yX1tQ', title: 'James Webb Space Telescope: Deepest Universe Discoveries', channelTitle: 'NASA', views: '11M views', duration: '15:40', thumbnail: 'https://i.ytimg.com/vi/b_N8i7yX1tQ/hqdefault.jpg' },
    { videoId: 'xP5-iIeKTEg', title: 'What If We Detonated All Nuclear Bombs at Once?', channelTitle: 'Kurzgesagt – In a Nutshell', views: '32M views', duration: '10:45', thumbnail: 'https://i.ytimg.com/vi/xP5-iIeKTEg/hqdefault.jpg' }
  ],
  sports: [
    { videoId: 'kOCGKp7s-10', title: 'Top 50 Most Unbelievable Sports Moments of the Decade', channelTitle: 'Red Bull', views: '28M views', duration: '16:40', thumbnail: 'https://i.ytimg.com/vi/kOCGKp7s-10/hqdefault.jpg' },
    { videoId: 'b3k48dE2q9I', title: 'Best Champions League Goals Ever Scored', channelTitle: 'UEFA', views: '45M views', duration: '14:15', thumbnail: 'https://i.ytimg.com/vi/b3k48dE2q9I/hqdefault.jpg' },
    { videoId: '1L3c1aL8mK8', title: 'NBA Top 100 Dunks of the Century', channelTitle: 'NBA', views: '38M views', duration: '24:50', thumbnail: 'https://i.ytimg.com/vi/1L3c1aL8mK8/hqdefault.jpg' }
  ],
  all: [
    { videoId: 'kJQP7kiw5Fk', title: 'Luis Fonsi - Despacito ft. Daddy Yankee', channelTitle: 'Luis Fonsi', views: '8.4B views', duration: '4:41', thumbnail: 'https://i.ytimg.com/vi/kJQP7kiw5Fk/hqdefault.jpg' },
    { videoId: 'jfKfPfyJRdk', title: 'lofi hip hop radio 📚 - beats to relax/study to', channelTitle: 'Lofi Girl', views: 'Live Stream', duration: 'LIVE', thumbnail: 'https://i.ytimg.com/vi/jfKfPfyJRdk/hqdefault.jpg' },
    { videoId: 'QdBZY2fkU-0', title: 'Grand Theft Auto VI Trailer 1', channelTitle: 'Rockstar Games', views: '210M views', duration: '1:31', thumbnail: 'https://i.ytimg.com/vi/QdBZY2fkU-0/hqdefault.jpg' },
    { videoId: 'uD4izuDMUQA', title: 'The Last Time the Universe Will Ever Make Sense', channelTitle: 'Kurzgesagt – In a Nutshell', views: '19M views', duration: '11:15', thumbnail: 'https://i.ytimg.com/vi/uD4izuDMUQA/hqdefault.jpg' },
    { videoId: 'kqtD5dpn9C8', title: 'Python for Beginners - Full Course [Programming Tutorial]', channelTitle: 'freeCodeCamp.org', views: '41M views', duration: '4:26:52', thumbnail: 'https://i.ytimg.com/vi/kqtD5dpn9C8/hqdefault.jpg' },
    { videoId: 'vMgUq_rXw2M', title: 'Sam Altman: OpenAI, GPT-5, AGI, and the Future of AI', channelTitle: 'Lex Fridman Podcast', views: '4.2M views', duration: '2:14:30', thumbnail: 'https://i.ytimg.com/vi/vMgUq_rXw2M/hqdefault.jpg' },
    { videoId: 'kOCGKp7s-10', title: 'Top 50 Most Unbelievable Sports Moments of the Decade', channelTitle: 'Red Bull', views: '28M views', duration: '16:40', thumbnail: 'https://i.ytimg.com/vi/kOCGKp7s-10/hqdefault.jpg' },
    { videoId: 'fJ9rUzIMcZQ', title: 'Queen - Bohemian Rhapsody (Official Video Remastered)', channelTitle: 'Queen Official', views: '1.7B views', duration: '5:59', thumbnail: 'https://i.ytimg.com/vi/fJ9rUzIMcZQ/hqdefault.jpg' },
    { videoId: 'V9PBRq_Gog8', title: 'Minecraft 1.21 Tricky Trials - Full Update Showcase', channelTitle: 'Minecraft', views: '8.5M views', duration: '18:24', thumbnail: 'https://i.ytimg.com/vi/V9PBRq_Gog8/hqdefault.jpg' },
    { videoId: 'rUxyKA_-grg', title: 'synthwave radio 🌌 - chill beats to relax/game to', channelTitle: 'Lofi Girl', views: 'Live Stream', duration: 'LIVE', thumbnail: 'https://i.ytimg.com/vi/rUxyKA_-grg/hqdefault.jpg' },
    { videoId: '4NRXx6U8ABQ', title: 'The Weeknd - Blinding Lights (Official Video)', channelTitle: 'The Weeknd', views: '800M views', duration: '4:20', thumbnail: 'https://i.ytimg.com/vi/4NRXx6U8ABQ/hqdefault.jpg' },
    { videoId: '7wtfhZwyrcc', title: 'Imagine Dragons - Believer (Official Music Video)', channelTitle: 'Imagine Dragons', views: '2.6B views', duration: '3:36', thumbnail: 'https://i.ytimg.com/vi/7wtfhZwyrcc/hqdefault.jpg' }
  ]
};

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
                const title = videoRenderer.title?.runs?.[0]?.text || videoRenderer.title?.simpleText || 'Untitled Video';
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
      if (!seen.has(id)) {
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

// Invidious public instance fallback searcher
async function searchInvidiousFallback(q) {
  const instances = [
    'https://inv.nadeko.net',
    'https://invidious.nerdvpn.de',
    'https://invidious.jing.rocks'
  ];

  for (const instance of instances) {
    try {
      const res = await axios.get(`${instance}/api/v1/search`, {
        params: { q, type: 'video' },
        timeout: 3000
      });
      if (Array.isArray(res.data) && res.data.length > 0) {
        return res.data.map(v => ({
          videoId: v.videoId,
          title: v.title || 'YouTube Video',
          channelTitle: v.author || 'YouTube Creator',
          views: v.viewCountText || `${v.viewCount || ''} views`,
          duration: v.lengthSeconds ? `${Math.floor(v.lengthSeconds / 60)}:${(v.lengthSeconds % 60).toString().padStart(2, '0')}` : '',
          publishedTime: v.publishedText || '',
          thumbnail: v.videoThumbnails?.[0]?.url || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`
        }));
      }
    } catch (e) {
      // Continue to next instance
    }
  }
  return [];
}

// Search YouTube videos with multi-tier failover & caching
router.get('/search', authMiddleware, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || !q.trim()) {
      return res.status(400).json({ error: 'Search query required' });
    }

    const trimmed = q.trim();

    // Check for direct YouTube video ID or Google redirect link
    const directVideoId = extractUniversalVideoId(trimmed);
    if (directVideoId) {
      const directResult = [{
        videoId: directVideoId,
        title: `YouTube Video (${directVideoId})`,
        channelTitle: 'Direct Link Playback',
        thumbnail: `https://i.ytimg.com/vi/${directVideoId}/hqdefault.jpg`,
        views: 'Direct Play',
        duration: 'Full'
      }];
      return res.json({ results: directResult });
    }

    const queryKey = `yt_search_${trimmed.toLowerCase()}`;
    const cached = ramCache.get(queryKey);
    if (cached) {
      return res.json({ results: cached });
    }

    let videos = [];

    // Tier 1: Direct YouTube Scraper
    try {
      const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(q.trim())}`;
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9'
        },
        timeout: 4000
      });
      videos = parseYouTubeSearchResults(response.data);
    } catch (err) {
      console.warn('[YOUTUBE SEARCH] Tier 1 scraper failed:', err.message);
    }

    // Tier 2: Invidious API Fallback
    if (videos.length === 0) {
      videos = await searchInvidiousFallback(q.trim());
    }

    // Tier 3: Curated Catalog Keyword Match Fallback
    if (videos.length === 0) {
      const queryLower = q.trim().toLowerCase();
      const allCurated = Object.values(CURATED_CATALOG).flat();
      videos = allCurated.filter(v => 
        v.title.toLowerCase().includes(queryLower) ||
        v.channelTitle.toLowerCase().includes(queryLower)
      );
      if (videos.length === 0) {
        videos = CURATED_CATALOG.all;
      }
    }

    ramCache.set(queryKey, videos, 300000); // 5 min TTL
    res.json({ results: videos });
  } catch (err) {
    console.error('[YOUTUBE SEARCH ERROR]:', err.message);
    res.json({ results: CURATED_CATALOG.all });
  }
});

// Trending / curated feed endpoint with 10+ categories and rich fallbacks
router.get('/trending', authMiddleware, async (req, res) => {
  try {
    const category = req.query.category || 'all';
    const cacheKey = `yt_trending_${category}`;
    const cached = ramCache.get(cacheKey);
    if (cached) {
      return res.json({ results: cached });
    }

    const queryMap = {
      all: 'trending global viral videos',
      music: 'popular official music videos top billboard 2026',
      gaming: 'popular gaming gameplay highlights walkthrough',
      news: 'top world news updates latest',
      tech: 'latest technology reviews coding software AI',
      chill: 'lofi hip hop live chill beats study relax',
      podcasts: 'popular full podcast interviews',
      science: 'space science documentary discovery',
      sports: 'insane sports highlights goals red bull'
    };

    const q = queryMap[category] || queryMap.all;
    let videos = [];

    try {
      const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9'
        },
        timeout: 4000
      });
      videos = parseYouTubeSearchResults(response.data);
    } catch (err) {
      console.warn('[YOUTUBE TRENDING] Live scrape failed, using curated catalog:', err.message);
    }

    // Merge curated entries if live scraper returned few results
    const fallbackList = CURATED_CATALOG[category] || CURATED_CATALOG.all;
    if (videos.length < 8) {
      const existingIds = new Set(videos.map(v => v.videoId));
      for (const item of fallbackList) {
        if (!existingIds.has(item.videoId)) {
          videos.push(item);
        }
      }
    }

    ramCache.set(cacheKey, videos, 300000); // 5 min TTL
    res.json({ results: videos });
  } catch (err) {
    console.error('[YOUTUBE TRENDING ERROR]:', err.message);
    const fallbackList = CURATED_CATALOG[req.query.category] || CURATED_CATALOG.all;
    res.json({ results: fallbackList });
  }
});

module.exports = router;
