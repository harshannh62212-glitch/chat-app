import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import '../styles/YouTube.css';

// In-memory RAM cache so repeated searches and videos don't hit the server repeatedly
const ramVideoCache = new Map();

export default function YouTubeDashboard({ user, onLogout, onToggleToChat, onToggleToSpotify, onToggleToGames }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('music');
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [currentView, setCurrentView] = useState('feed'); // 'feed', 'watch', 'history', 'liked'
  const [activeVideo, setActiveVideo] = useState(null);
  const [showTutorial, setShowTutorial] = useState(false);

  // Client-side RAM / LocalStorage state (Zero database pollution)
  const [watchHistory, setWatchHistory] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('wiredtube_history') || '[]');
    } catch {
      return [];
    }
  });

  const [likedVideos, setLikedVideos] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('wiredtube_liked') || '[]');
    } catch {
      return [];
    }
  });

  // Check if first-time tutorial should be shown
  useEffect(() => {
    const tutorialSeen = localStorage.getItem('wiredtube_tutorial_seen');
    if (!tutorialSeen) {
      setShowTutorial(true);
    }
  }, []);

  // Fetch trending/feed videos on category change
  useEffect(() => {
    if (currentView === 'feed') {
      fetchCategoryVideos(activeCategory);
    }
  }, [activeCategory, currentView]);

  const fetchCategoryVideos = async (category) => {
    const cacheKey = `cat_${category}`;
    if (ramVideoCache.has(cacheKey)) {
      setVideos(ramVideoCache.get(cacheKey));
      return;
    }

    setLoading(true);
    try {
      const res = await axios.get('/api/youtube/trending', {
        params: { category }
      });
      const results = res.data?.results || [];
      ramVideoCache.set(cacheKey, results);
      setVideos(results);
    } catch (err) {
      console.error('Error loading YouTube category feed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    const trimmed = searchQuery.trim().toLowerCase();
    const cacheKey = `search_${trimmed}`;
    if (ramVideoCache.has(cacheKey)) {
      setVideos(ramVideoCache.get(cacheKey));
      setCurrentView('feed');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.get('/api/youtube/search', {
        params: { q: trimmed }
      });
      const results = res.data?.results || [];
      ramVideoCache.set(cacheKey, results);
      setVideos(results);
      setCurrentView('feed');
    } catch (err) {
      console.error('Error searching YouTube:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectVideo = (video) => {
    setActiveVideo(video);
    setCurrentView('watch');

    // Add to RAM + localStorage history (Deduplicated)
    setWatchHistory(prev => {
      const updated = [video, ...prev.filter(v => v.videoId !== video.videoId)].slice(0, 50);
      try {
        localStorage.setItem('wiredtube_history', JSON.stringify(updated));
      } catch (e) {
        console.warn('Storage error:', e);
      }
      return updated;
    });
  };

  const handleToggleLike = (video) => {
    setLikedVideos(prev => {
      const isAlready = prev.some(v => v.videoId === video.videoId);
      let updated;
      if (isAlready) {
        updated = prev.filter(v => v.videoId !== video.videoId);
      } else {
        updated = [video, ...prev];
      }
      try {
        localStorage.setItem('wiredtube_liked', JSON.stringify(updated));
      } catch (e) {
        console.warn('Storage error:', e);
      }
      return updated;
    });
  };

  const dismissTutorial = () => {
    setShowTutorial(false);
    localStorage.setItem('wiredtube_tutorial_seen', 'true');
  };

  const categories = [
    { id: 'music', label: '🎵 Music & Songs' },
    { id: 'all', label: '🔥 All Trending' },
    { id: 'chill', label: '☕ Lofi & Chill' },
    { id: 'gaming', label: '🎮 Gaming' },
    { id: 'tech', label: '💻 Tech & Dev' },
    { id: 'news', label: '📰 News' },
  ];

  return (
    <div className="yt-container">
      {/* 1. Header Bar */}
      <header className="yt-header">
        <div className="yt-header-left">
          <button 
            className="yt-menu-toggle"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            title="Toggle Sidebar"
          >
            ☰
          </button>
          <div 
            className="yt-brand"
            onClick={() => {
              setCurrentView('feed');
              fetchCategoryVideos(activeCategory);
            }}
          >
            <div className="yt-brand-logo-icon">▶</div>
            <div className="yt-brand-title">
              Wired<span style={{ color: 'var(--yt-red)' }}>Tube</span>
              <span className="yt-brand-badge">PRO</span>
            </div>
          </div>
        </div>

        <div className="yt-header-center">
          <form className="yt-search-form" onSubmit={handleSearch}>
            <input 
              type="text"
              className="yt-search-input"
              placeholder="Search millions of songs, videos, podcasts & live streams..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button type="submit" className="yt-search-btn" title="Search">
              🔍
            </button>
          </form>
        </div>

        <div className="yt-header-right">
          <button 
            className="yt-nav-btn guide-btn"
            onClick={() => setShowTutorial(true)}
            title="Open Interactive Tutorial"
          >
            💡 Tutorial
          </button>
          <button 
            className="yt-nav-btn"
            onClick={onToggleToChat}
            title="Switch to Chat Portal"
          >
            💬 Chat
          </button>
          <button 
            className="yt-nav-btn"
            onClick={onToggleToSpotify}
            title="Switch to Spotify Portal"
            style={{ color: '#1db954' }}
          >
            🎵 Spotify
          </button>
          <button 
            className="yt-nav-btn"
            onClick={onToggleToGames}
            title="Switch to Games Portal"
            style={{ color: '#a55eea' }}
          >
            🎮 Games
          </button>
          <div className="yt-user-avatar" title={`Logged in as ${user?.username || 'User'}`}>
            {(user?.username || 'U').substring(0, 2).toUpperCase()}
          </div>
        </div>
      </header>

      {/* 2. Body Layout */}
      <div className="yt-body">
        {/* Left Nav Sidebar */}
        <aside className={`yt-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
          <div 
            className={`yt-sidebar-item ${currentView === 'feed' ? 'active' : ''}`}
            onClick={() => setCurrentView('feed')}
          >
            <span className="yt-sidebar-icon">🏠</span>
            {!sidebarCollapsed && <span>Home</span>}
          </div>

          <div 
            className={`yt-sidebar-item ${currentView === 'history' ? 'active' : ''}`}
            onClick={() => setCurrentView('history')}
          >
            <span className="yt-sidebar-icon">⏱️</span>
            {!sidebarCollapsed && <span>History</span>}
          </div>

          <div 
            className={`yt-sidebar-item ${currentView === 'liked' ? 'active' : ''}`}
            onClick={() => setCurrentView('liked')}
          >
            <span className="yt-sidebar-icon">👍</span>
            {!sidebarCollapsed && <span>Liked Videos</span>}
          </div>

          {!sidebarCollapsed && (
            <>
              <div className="yt-sidebar-divider"></div>
              <div className="yt-sidebar-heading">Explore</div>
              {categories.map(cat => (
                <div 
                  key={cat.id}
                  className={`yt-sidebar-item ${activeCategory === cat.id && currentView === 'feed' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveCategory(cat.id);
                    setCurrentView('feed');
                  }}
                >
                  <span className="yt-sidebar-icon">{cat.label.split(' ')[0]}</span>
                  <span>{cat.label.split(' ').slice(1).join(' ')}</span>
                </div>
              ))}
            </>
          )}
        </aside>

        {/* Main Content View */}
        <main className="yt-main">
          {/* Top Categories Filter */}
          {currentView === 'feed' && (
            <div className="yt-chips-bar">
              {categories.map(cat => (
                <button 
                  key={cat.id}
                  className={`yt-chip ${activeCategory === cat.id ? 'active' : ''}`}
                  onClick={() => setActiveCategory(cat.id)}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          )}

          {/* WATCH VIEW */}
          {currentView === 'watch' && activeVideo && (
            <div className="yt-watch-view">
              <div className="yt-watch-primary">
                <div className="yt-player-container">
                  <iframe 
                    src={`https://www.youtube.com/embed/${activeVideo.videoId}?autoplay=1&enablejsapi=1&origin=${window.location.origin}`}
                    title={activeVideo.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                </div>

                <div className="yt-watch-info">
                  <div className="yt-watch-title">{activeVideo.title}</div>
                  <div className="yt-watch-actions-bar">
                    <div className="yt-watch-channel-info">
                      <div className="yt-channel-avatar-lg">
                        {activeVideo.channelTitle.substring(0, 1).toUpperCase()}
                      </div>
                      <div className="yt-channel-details">
                        <div className="yt-channel-title-lg">{activeVideo.channelTitle}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--yt-text-secondary)' }}>Verified Creator</div>
                      </div>
                      <button className="yt-subscribe-btn">Subscribe</button>
                    </div>

                    <div className="yt-watch-buttons">
                      <button 
                        className={`yt-action-btn ${likedVideos.some(v => v.videoId === activeVideo.videoId) ? 'liked' : ''}`}
                        onClick={() => handleToggleLike(activeVideo)}
                      >
                        👍 {likedVideos.some(v => v.videoId === activeVideo.videoId) ? 'Liked' : 'Like'}
                      </button>
                      <button 
                        className="yt-action-btn"
                        onClick={() => {
                          navigator.clipboard.writeText(`https://www.youtube.com/watch?v=${activeVideo.videoId}`);
                          alert('Video link copied to clipboard!');
                        }}
                      >
                        🔗 Share
                      </button>
                      <button 
                        className="yt-action-btn"
                        onClick={() => setCurrentView('feed')}
                      >
                        ✕ Close Player
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recommended Side Column */}
              <div className="yt-watch-secondary">
                <div style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '8px' }}>Up Next & Recommended</div>
                {videos.filter(v => v.videoId !== activeVideo.videoId).slice(0, 15).map(rec => (
                  <div 
                    key={rec.videoId}
                    className="yt-rec-card"
                    onClick={() => handleSelectVideo(rec)}
                  >
                    <div className="yt-rec-thumbnail">
                      <img src={rec.thumbnail} alt={rec.title} loading="lazy" />
                      {rec.duration && <span className="yt-video-duration">{rec.duration}</span>}
                    </div>
                    <div className="yt-rec-meta">
                      <div className="yt-rec-title">{rec.title}</div>
                      <div className="yt-rec-channel">{rec.channelTitle}</div>
                      {rec.views && <div style={{ fontSize: '0.75rem', color: 'var(--yt-text-secondary)' }}>{rec.views}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* FEED / SEARCH VIEW */}
          {currentView === 'feed' && (
            <div>
              {loading ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--yt-text-secondary)', fontSize: '1.2rem' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '10px' }}>⚡</div>
                  Streaming library catalog...
                </div>
              ) : videos.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--yt-text-secondary)' }}>
                  <h3>No videos found</h3>
                  <p>Try searching for a song, artist, creator, or topic above!</p>
                </div>
              ) : (
                <div className="yt-video-grid">
                  {videos.map(vid => (
                    <div 
                      key={vid.videoId}
                      className="yt-video-card"
                      onClick={() => handleSelectVideo(vid)}
                    >
                      <div className="yt-thumbnail-wrapper">
                        <img src={vid.thumbnail} alt={vid.title} className="yt-thumbnail-img" loading="lazy" />
                        {vid.duration && <span className="yt-video-duration">{vid.duration}</span>}
                      </div>
                      <div className="yt-video-details">
                        <div className="yt-channel-avatar">
                          {vid.channelTitle.substring(0, 1).toUpperCase()}
                        </div>
                        <div className="yt-video-meta">
                          <div className="yt-video-title" title={vid.title}>{vid.title}</div>
                          <div className="yt-channel-name">{vid.channelTitle}</div>
                          <div className="yt-video-stats">
                            {vid.views && <span>{vid.views}</span>}
                            {vid.views && vid.publishedTime && <span> • </span>}
                            {vid.publishedTime && <span>{vid.publishedTime}</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* HISTORY VIEW */}
          {currentView === 'history' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ margin: 0 }}>⏱️ Watch History (Client RAM Caching)</h2>
                {watchHistory.length > 0 && (
                  <button 
                    className="yt-action-btn"
                    onClick={() => {
                      setWatchHistory([]);
                      localStorage.removeItem('wiredtube_history');
                    }}
                  >
                    Clear History
                  </button>
                )}
              </div>

              {watchHistory.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--yt-text-secondary)' }}>
                  <p>Your watch history is empty. Start streaming songs or videos to see them here!</p>
                </div>
              ) : (
                <div className="yt-video-grid">
                  {watchHistory.map(vid => (
                    <div 
                      key={vid.videoId}
                      className="yt-video-card"
                      onClick={() => handleSelectVideo(vid)}
                    >
                      <div className="yt-thumbnail-wrapper">
                        <img src={vid.thumbnail} alt={vid.title} className="yt-thumbnail-img" />
                        {vid.duration && <span className="yt-video-duration">{vid.duration}</span>}
                      </div>
                      <div className="yt-video-details">
                        <div className="yt-video-meta">
                          <div className="yt-video-title">{vid.title}</div>
                          <div className="yt-channel-name">{vid.channelTitle}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* LIKED VIDEOS VIEW */}
          {currentView === 'liked' && (
            <div>
              <h2 style={{ marginBottom: '20px' }}>👍 Liked Videos & Music</h2>
              {likedVideos.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--yt-text-secondary)' }}>
                  <p>No liked videos yet. Tap the Like button on any video or music track to save it here!</p>
                </div>
              ) : (
                <div className="yt-video-grid">
                  {likedVideos.map(vid => (
                    <div 
                      key={vid.videoId}
                      className="yt-video-card"
                      onClick={() => handleSelectVideo(vid)}
                    >
                      <div className="yt-thumbnail-wrapper">
                        <img src={vid.thumbnail} alt={vid.title} className="yt-thumbnail-img" />
                        {vid.duration && <span className="yt-video-duration">{vid.duration}</span>}
                      </div>
                      <div className="yt-video-details">
                        <div className="yt-video-meta">
                          <div className="yt-video-title">{vid.title}</div>
                          <div className="yt-channel-name">{vid.channelTitle}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* 3. Interactive First-Time Tutorial Modal */}
      {showTutorial && (
        <div className="yt-modal-backdrop" onClick={dismissTutorial}>
          <div className="yt-tutorial-modal" onClick={(e) => e.stopPropagation()}>
            <div className="yt-tutorial-header">
              <div className="yt-tutorial-icon">▶️</div>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.4rem' }}>Welcome to WiredTube!</h2>
                <span style={{ color: 'var(--yt-text-secondary)', fontSize: '0.88rem' }}>
                  The worldwide video & music hub directly integrated into wired-io.
                </span>
              </div>
            </div>

            <div className="yt-tutorial-steps">
              <div className="yt-tutorial-step">
                <div className="yt-step-num">1</div>
                <div className="yt-step-text">
                  <strong>Giant Global Library</strong>
                  <p>Type any song, artist, podcast, or gaming video in the top search bar to immediately stream full audio and 1080p HD video.</p>
                </div>
              </div>

              <div className="yt-tutorial-step">
                <div className="yt-step-num">2</div>
                <div className="yt-step-text">
                  <strong>Client-Side RAM Caching</strong>
                  <p>All videos, history, and liked tracks are cached directly in your browser's RAM and local storage — zero database strain or server slowdowns.</p>
                </div>
              </div>

              <div className="yt-tutorial-step">
                <div className="yt-step-num">3</div>
                <div className="yt-step-text">
                  <strong>Cinema Mode & Sidebar Switcher</strong>
                  <p>Click any video card to open theater view with full controls, or jump back to Chat, Spotify, or Games with the top-right portal buttons.</p>
                </div>
              </div>
            </div>

            <div className="yt-tutorial-footer">
              <button className="yt-tutorial-btn" onClick={dismissTutorial}>
                Start Watching Now 🚀
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
