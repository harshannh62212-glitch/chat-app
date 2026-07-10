import React, { useState, useEffect } from 'react';
import axios from 'axios';

const GIPHY_API_KEY = import.meta.env.VITE_GIPHY_API_KEY || 'LIVDxiqcx5KoGLG6m8tB5X6s64FCX50B';

function GiphyPanel({ onSelectGif, onClose }) {
  const [query, setQuery] = useState('');
  const [gifs, setGifs] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchTrending();
  }, []);

  const fetchTrending = async () => {
    setLoading(true);
    try {
      const res = await axios.get(
        `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=16`
      );
      setGifs(res.data.data);
    } catch (err) {
      console.error('Failed to fetch trending GIFs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (val) => {
    setQuery(val);
    if (!val.trim()) {
      fetchTrending();
      return;
    }

    setLoading(true);
    try {
      const res = await axios.get(
        `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(val)}&limit=16`
      );
      setGifs(res.data.data);
    } catch (err) {
      console.error('Failed to search GIFs:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="giphy-panel glass-panel">
      <div className="giphy-header">
        <input
          type="text"
          placeholder="Search GIPHY..."
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          autoFocus
        />
        <button type="button" className="giphy-close-btn" onClick={onClose}>&times;</button>
      </div>

      <div className="giphy-content">
        {loading ? (
          <div className="giphy-loading">Searching GIPHY...</div>
        ) : gifs.length === 0 ? (
          <div className="giphy-empty">No GIFs found</div>
        ) : (
          <div className="giphy-grid">
            {gifs.map((gif) => {
              const gifUrl = gif.images.fixed_height.url;
              return (
                <div 
                  key={gif.id} 
                  className="giphy-item"
                  onClick={() => onSelectGif(gifUrl)}
                >
                  <img src={gif.images.fixed_height_downsampled.url || gifUrl} alt={gif.title} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default GiphyPanel;
