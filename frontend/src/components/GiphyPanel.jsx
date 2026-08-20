import React, { useState, useEffect } from 'react';

// Fallback curated GIFs if external rate limits occur
const CURATED_FALLBACK_GIFS = [
  { id: 'c1', url: 'https://media.giphy.com/media/ICOgUNjpvO0PC/giphy.gif', title: 'Happy Cat' },
  { id: 'c2', url: 'https://media.giphy.com/media/3o7TKSjRrfIPjeiVyM/giphy.gif', title: 'Dance Party' },
  { id: 'c3', url: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif', title: 'Thumbs Up' },
  { id: 'c4', url: 'https://media.giphy.com/media/26AHONQ79FdWZhAI0/giphy.gif', title: 'Mind Blown' },
  { id: 'c5', url: 'https://media.giphy.com/media/11ISwac542JMw8/giphy.gif', title: 'Popcorn' },
  { id: 'c6', url: 'https://media.giphy.com/media/artj92V8o75VPL7AeQ/giphy.gif', title: 'Laughing' },
  { id: 'c7', url: 'https://media.giphy.com/media/xT9IgG50Fb7Mi0prBC/giphy.gif', title: 'Excited' },
  { id: 'c8', url: 'https://media.giphy.com/media/5GoVLqeAOo6PK/giphy.gif', title: 'Celebration' },
  { id: 'c9', url: 'https://media.giphy.com/media/d3mlE7uhX8KFgEmY/giphy.gif', title: 'Smart Thinking' },
  { id: 'c10', url: 'https://media.giphy.com/media/13HgwGsXF0aiGY/giphy.gif', title: 'Clapping' },
  { id: 'c11', url: 'https://media.giphy.com/media/g9582DNuQppxC/giphy.gif', title: 'Cheers Gatsby' },
  { id: 'c12', url: 'https://media.giphy.com/media/l3q2K5jinAlChoCLS/giphy.gif', title: 'Blinking Guy' },
  { id: 'c13', url: 'https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy.gif', title: 'Cat Typing' },
  { id: 'c14', url: 'https://media.giphy.com/media/unQ3IJU2RG7DO/giphy.gif', title: 'Awkward Look' },
  { id: 'c15', url: 'https://media.giphy.com/media/yr7n0u3qzO9nG/giphy.gif', title: 'Elmo Fire' },
  { id: 'c16', url: 'https://media.giphy.com/media/ule4akeXnY9A50XD87/giphy.gif', title: 'Nice' }
];

const GIPHY_KEYS = [
  import.meta.env.VITE_GIPHY_API_KEY,
  'sXpGFDGZs0Dv1mmNFvYaGUvYwKX0PWIh',
  'dc6zaTOxFJmzC',
  'pX0Qe3rFkI4N4c8Qf3pB8v9V2N9P9p6k'
].filter(Boolean);

function GiphyPanel({ onSelectGif, onClose }) {
  const [query, setQuery] = useState('');
  const [gifs, setGifs] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchTrending();
  }, []);

  // Use clean browser fetch to avoid attaching custom axios auth headers that trigger CORS preflight blocks
  const fetchFromGiphy = async (url) => {
    for (const key of GIPHY_KEYS) {
      try {
        const fullUrl = url.replace('__KEY__', key);
        const res = await fetch(fullUrl, {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.data && Array.isArray(data.data) && data.data.length > 0) {
            return data.data.map(g => ({
              id: g.id,
              url: g.images?.fixed_height?.url || g.images?.original?.url,
              preview: g.images?.fixed_height_downsampled?.url || g.images?.fixed_height_small?.url || g.images?.fixed_height?.url,
              title: g.title || 'GIF'
            })).filter(g => g.url);
          }
        }
      } catch (e) {
        // Try next key
      }
    }
    return null;
  };

  // Tenor search fallback
  const fetchFromTenor = async (searchTerm) => {
    try {
      const q = searchTerm ? encodeURIComponent(searchTerm) : 'trending';
      const tenorUrl = `https://tenor.googleapis.com/v2/search?q=${q}&key=LIVDSRZULELA&limit=16&client_key=chat_app`;
      const res = await fetch(tenorUrl);
      if (res.ok) {
        const data = await res.json();
        if (data?.results && Array.isArray(data.results)) {
          return data.results.map(r => ({
            id: r.id,
            url: r.media_formats?.gif?.url || r.media_formats?.mediumgif?.url || r.itemurl,
            preview: r.media_formats?.tinygif?.url || r.media_formats?.gif?.url,
            title: r.content_description || 'GIF'
          })).filter(g => g.url);
        }
      }
    } catch (e) {}
    return null;
  };

  const fetchTrending = async () => {
    setLoading(true);
    let results = await fetchFromGiphy(`https://api.giphy.com/v1/gifs/trending?api_key=__KEY__&limit=20&rating=g`);
    if (!results || results.length === 0) {
      results = await fetchFromTenor('');
    }
    if (!results || results.length === 0) {
      results = CURATED_FALLBACK_GIFS.map(g => ({ ...g, preview: g.url }));
    }
    setGifs(results);
    setLoading(false);
  };

  const handleSearch = async (val) => {
    setQuery(val);
    if (!val.trim()) {
      fetchTrending();
      return;
    }

    setLoading(true);
    let results = await fetchFromGiphy(`https://api.giphy.com/v1/gifs/search?api_key=__KEY__&q=${encodeURIComponent(val.trim())}&limit=20&rating=g`);
    if (!results || results.length === 0) {
      results = await fetchFromTenor(val.trim());
    }
    if (!results || results.length === 0) {
      const qLower = val.trim().toLowerCase();
      results = CURATED_FALLBACK_GIFS
        .filter(g => g.title.toLowerCase().includes(qLower))
        .map(g => ({ ...g, preview: g.url }));
      if (results.length === 0) {
        results = CURATED_FALLBACK_GIFS.map(g => ({ ...g, preview: g.url }));
      }
    }
    setGifs(results);
    setLoading(false);
  };

  return (
    <div className="giphy-panel glass-panel">
      <div className="giphy-header">
        <input
          type="text"
          placeholder="Search GIFs across GIPHY & Tenor..."
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          autoFocus
        />
        <button type="button" className="giphy-close-btn" onClick={onClose}>&times;</button>
      </div>

      <div className="giphy-content">
        {loading ? (
          <div className="giphy-loading">Searching GIFs...</div>
        ) : gifs.length === 0 ? (
          <div className="giphy-empty">No GIFs found</div>
        ) : (
          <div className="giphy-grid">
            {gifs.map((gif) => (
              <div 
                key={gif.id} 
                className="giphy-item"
                onClick={() => onSelectGif(gif.url)}
              >
                <img src={gif.preview || gif.url} alt={gif.title} loading="lazy" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default GiphyPanel;

