const express = require('express');
const { query } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
const axios = require('axios');

// Search YouTube to get full track videoId
router.get('/search-yt', authMiddleware, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: 'Query required' });
    
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      timeout: 6000
    });
    
    const html = response.data;
    let videoId = null;
    
    // Pattern 1: JSON videoId structure
    const jsonMatch = html.match(/"videoId"\s*:\s*"([^"]+)"/);
    if (jsonMatch && jsonMatch[1]) {
      videoId = jsonMatch[1];
    }
    
    // Pattern 2: watch?v= link structure
    if (!videoId) {
      const linkMatch = html.match(/\/watch\?v=([a-zA-Z0-9_-]{11})/);
      if (linkMatch && linkMatch[1]) {
        videoId = linkMatch[1];
      }
    }

    // Pattern 3: watch URL inside text
    if (!videoId) {
      const textMatch = html.match(/watch\?v=([a-zA-Z0-9_-]{11})/);
      if (textMatch && textMatch[1]) {
        videoId = textMatch[1];
      }
    }
    
    if (videoId) {
      res.json({ videoId });
    } else {
      console.warn(`[YOUTUBE SCRAPER] No video found for "${q}". Using chill music fallback.`);
      res.json({ videoId: 'jfKfPfyJRdk' }); // Fallback to Lofi Girl
    }
  } catch (err) {
    console.error('Error searching YouTube:', err.message);
    res.json({ videoId: 'jfKfPfyJRdk' }); // Graceful fallback
  }
});

// ==========================================
// LIKED SONGS
// ==========================================

// Get all liked songs
router.get('/liked', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const result = await query(
      'SELECT * FROM spotify_liked_tracks WHERE user_id = $1 ORDER BY liked_at DESC',
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching liked tracks:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Like a song
router.post('/liked', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const { trackId, title, artist, album, duration, previewUrl, coverUrl } = req.body;

    if (!trackId || !title || !artist) {
      return res.status(400).json({ error: 'Missing track details' });
    }

    const result = await query(
      `INSERT INTO spotify_liked_tracks (user_id, track_id, title, artist, album, duration, preview_url, cover_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (user_id, track_id) DO UPDATE SET liked_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [userId, trackId, title, artist, album || '', duration || 0, previewUrl || '', coverUrl || '']
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error liking track:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Unlike a song
router.delete('/liked/:trackId', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const { trackId } = req.params;

    await query(
      'DELETE FROM spotify_liked_tracks WHERE user_id = $1 AND track_id = $2',
      [userId, trackId]
    );

    res.json({ success: true, message: 'Track unliked' });
  } catch (err) {
    console.error('Error unliking track:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


// ==========================================
// PLAYLISTS
// ==========================================

// Get user playlists
router.get('/playlists', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const result = await query(
      'SELECT * FROM spotify_playlists WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching playlists:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create playlist
router.post('/playlists', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const { name, description, coverUrl } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Playlist name is required' });
    }

    const result = await query(
      `INSERT INTO spotify_playlists (user_id, name, description, cover_url)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [userId, name, description || '', coverUrl || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=300&auto=format&fit=crop']
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating playlist:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get playlist details and tracks
router.get('/playlists/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;
    const parsedId = parseInt(id, 10);

    if (isNaN(parsedId)) {
      return res.status(400).json({ error: 'Invalid playlist ID' });
    }

    // Check playlist ownership
    const playlistResult = await query(
      'SELECT * FROM spotify_playlists WHERE id = $1 AND user_id = $2',
      [parsedId, userId]
    );

    if (playlistResult.rows.length === 0) {
      return res.status(404).json({ error: 'Playlist not found' });
    }

    const playlist = playlistResult.rows[0];

    // Get tracks in playlist
    const tracksResult = await query(
      'SELECT * FROM spotify_playlist_tracks WHERE playlist_id = $1 ORDER BY added_at ASC',
      [parsedId]
    );

    res.json({
      ...playlist,
      tracks: tracksResult.rows
    });
  } catch (err) {
    console.error('Error fetching playlist details:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add track to playlist
router.post('/playlists/:id/tracks', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;
    const parsedId = parseInt(id, 10);
    const { trackId, title, artist, album, duration, previewUrl, coverUrl } = req.body;

    if (isNaN(parsedId)) {
      return res.status(400).json({ error: 'Invalid playlist ID' });
    }

    if (!trackId || !title || !artist) {
      return res.status(400).json({ error: 'Missing track details' });
    }

    // Verify playlist ownership
    const playlistResult = await query(
      'SELECT 1 FROM spotify_playlists WHERE id = $1 AND user_id = $2',
      [parsedId, userId]
    );

    if (playlistResult.rows.length === 0) {
      return res.status(404).json({ error: 'Playlist not found' });
    }

    const result = await query(
      `INSERT INTO spotify_playlist_tracks (playlist_id, track_id, title, artist, album, duration, preview_url, cover_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [parsedId, trackId, title, artist, album || '', duration || 0, previewUrl || '', coverUrl || '']
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error adding track to playlist:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Remove track from playlist
router.delete('/playlists/:id/tracks/:trackId', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const { id, trackId } = req.params;
    const parsedId = parseInt(id, 10);

    if (isNaN(parsedId)) {
      return res.status(400).json({ error: 'Invalid playlist ID' });
    }

    // Verify playlist ownership
    const playlistResult = await query(
      'SELECT 1 FROM spotify_playlists WHERE id = $1 AND user_id = $2',
      [parsedId, userId]
    );

    if (playlistResult.rows.length === 0) {
      return res.status(404).json({ error: 'Playlist not found' });
    }

    await query(
      'DELETE FROM spotify_playlist_tracks WHERE playlist_id = $1 AND track_id = $2',
      [parsedId, trackId]
    );

    res.json({ success: true, message: 'Track removed from playlist' });
  } catch (err) {
    console.error('Error removing track from playlist:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


// ==========================================
// HISTORY
// ==========================================

// Get history
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const result = await query(
      'SELECT * FROM spotify_history WHERE user_id = $1 ORDER BY played_at DESC LIMIT 50',
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching history:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add history item
router.post('/history', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const { trackId, title, artist, album, coverUrl } = req.body;

    if (!trackId || !title || !artist) {
      return res.status(400).json({ error: 'Missing track details' });
    }

    const result = await query(
      `INSERT INTO spotify_history (user_id, track_id, title, artist, album, cover_url)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [userId, trackId, title, artist, album || '', coverUrl || '']
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error recording history:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
