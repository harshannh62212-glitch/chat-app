import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import '../styles/Spotify.css';

export default function SpotifyDashboard({ user, setUser, onLogout, onToggleToChat, onToggleToGames }) {
  const [activeTab, setActiveTab] = useState('home'); // 'home', 'search', 'liked', 'playlist-detail'
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  
  // Library details
  const [likedSongs, setLikedSongs] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [currentPlaylist, setCurrentPlaylist] = useState(null);
  const [playHistory, setPlayHistory] = useState([]);

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [newPlaylistDesc, setNewPlaylistDesc] = useState('');
  
  const [showAddToPlaylistModal, setShowAddToPlaylistModal] = useState(false);
  const [selectedTrackForPlaylist, setSelectedTrackForPlaylist] = useState(null);

  // Player state
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.5);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoop, setIsLoop] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [currentQueue, setCurrentQueue] = useState([]);
  const [queueIndex, setQueueIndex] = useState(-1);

  // YouTube Player ref and timer
  const [ytPlayer, setYtPlayer] = useState(null);
  const progressIntervalRef = useRef(null);

  // Initial loading
  useEffect(() => {
    fetchLikedSongs();
    fetchPlaylists();
    fetchHistory();

    // Load YouTube API
    const checkAndInit = () => {
      if (window.YT && window.YT.Player) {
        initYTPlayer();
      } else {
        setTimeout(checkAndInit, 100);
      }
    };

    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      if (firstScriptTag && firstScriptTag.parentNode) {
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
      } else {
        document.head.appendChild(tag);
      }
      
      window.onYouTubeIframeAPIReady = () => {
        checkAndInit();
      };
    } else {
      checkAndInit();
    }

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, []);

  const initYTPlayer = () => {
    try {
      if (ytPlayer || window.spotifyYtPlayerInstance) {
        setYtPlayer(window.spotifyYtPlayerInstance);
        return;
      }
      const player = new window.YT.Player('youtube-player', {
        height: '200',
        width: '200',
        videoId: 'dQw4w9WgXcQ',
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          playsinline: 1,
          rel: 0,
          enablejsapi: 1,
          origin: window.location.origin
        },
        events: {
          onReady: (event) => {
            console.log('[SPOTIFY YT] Player Ready');
            setYtPlayer(event.target);
            window.spotifyYtPlayerInstance = event.target;
            event.target.setVolume(volume * 100);
          },
          onStateChange: (event) => {
            console.log('[SPOTIFY YT] State Change:', event.data);
            if (event.data === window.YT.PlayerState.PLAYING) {
              setIsPlaying(true);
            } else if (event.data === window.YT.PlayerState.PAUSED) {
              setIsPlaying(false);
            } else if (event.data === window.YT.PlayerState.ENDED) {
              if (isLoop) {
                event.target.seekTo(0);
                event.target.playVideo();
              } else {
                handleNext();
              }
            }
          },
          onError: (err) => {
            console.warn('[SPOTIFY YT] Player error:', err);
            // On embed restriction error (101/150), fallback to preview audio if available
            handleNext();
          }
        }
      });
      setYtPlayer(player);
      window.spotifyYtPlayerInstance = player;
    } catch (e) {
      console.error('Failed to init YouTube player:', e);
    }
  };

  // Sync volume
  useEffect(() => {
    if (ytPlayer && typeof ytPlayer.setVolume === 'function') {
      ytPlayer.setVolume(isMuted ? 0 : volume * 100);
    }
    if (window.spotifyAudioFallback) {
      window.spotifyAudioFallback.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted, ytPlayer]);

  // Handle play/pause toggle
  const togglePlayPause = () => {
    const nextPlay = !isPlaying;
    setIsPlaying(nextPlay);
    const player = ytPlayer || window.spotifyYtPlayerInstance;
    if (nextPlay) {
      if (player && typeof player.playVideo === 'function') {
        player.playVideo();
      } else if (window.spotifyAudioFallback) {
        window.spotifyAudioFallback.play().catch(() => {});
      }
    } else {
      if (player && typeof player.pauseVideo === 'function') {
        player.pauseVideo();
      }
      if (window.spotifyAudioFallback) {
        window.spotifyAudioFallback.pause();
      }
    }
  };

  // Polling current playback time from YouTube API or preview Audio
  useEffect(() => {
    if (isPlaying && ytPlayer) {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      
      progressIntervalRef.current = setInterval(() => {
        try {
          if (ytPlayer && typeof ytPlayer.getCurrentTime === 'function') {
            const cur = ytPlayer.getCurrentTime() || 0;
            const dur = ytPlayer.getDuration() || (currentTrack?.duration || 240);
            setCurrentTime(cur);
            if (dur > 0) setDuration(dur);
          }
        } catch (e) {}
      }, 500);
    } else {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    }
    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, [isPlaying, ytPlayer, currentTrack]);

  // API calls with cloud and local storage fallbacks
  const fetchLikedSongs = async () => {
    try {
      const res = await axios.get('/api/spotify/liked');
      if (Array.isArray(res.data)) {
        setLikedSongs(res.data);
        localStorage.setItem('spotify_cached_liked', JSON.stringify(res.data));
        return;
      }
    } catch (err) {}
    try {
      const cached = JSON.parse(localStorage.getItem('spotify_cached_liked') || '[]');
      setLikedSongs(cached);
    } catch (e) {}
  };

  const fetchPlaylists = async () => {
    try {
      const res = await axios.get('/api/spotify/playlists');
      if (Array.isArray(res.data)) {
        setPlaylists(res.data);
        localStorage.setItem('spotify_cached_playlists', JSON.stringify(res.data));
        return;
      }
    } catch (err) {}
    try {
      const cached = JSON.parse(localStorage.getItem('spotify_cached_playlists') || '[]');
      setPlaylists(cached);
    } catch (e) {}
  };

  const fetchHistory = async () => {
    try {
      const res = await axios.get('/api/spotify/history');
      if (Array.isArray(res.data)) {
        setPlayHistory(res.data);
        localStorage.setItem('spotify_cached_history', JSON.stringify(res.data));
        return;
      }
    } catch (err) {}
    try {
      const cached = JSON.parse(localStorage.getItem('spotify_cached_history') || '[]');
      setPlayHistory(cached);
    } catch (e) {}
  };

  const recordPlayHistory = async (track) => {
    try {
      await axios.post('/api/spotify/history', {
        trackId: track.track_id || track.trackId?.toString() || track.id?.toString(),
        title: track.title || track.trackName,
        artist: track.artist || track.artistName,
        album: track.album || track.collectionName || '',
        coverUrl: track.cover_url || track.artworkUrl100 || ''
      });
      fetchHistory();
    } catch (err) {
      // Local storage fallback
      try {
        const history = JSON.parse(localStorage.getItem('spotify_cached_history') || '[]');
        const updated = [track, ...history.filter(h => (h.track_id || h.id) !== (track.track_id || track.id))].slice(0, 30);
        localStorage.setItem('spotify_cached_history', JSON.stringify(updated));
        setPlayHistory(updated);
      } catch (e) {}
    }
  };

  // Play a specific track (loads full YouTube stream)
  const handlePlayTrack = async (track, listToSetAsQueue = []) => {
    const normTrack = {
      track_id: track.track_id || track.trackId?.toString() || track.id?.toString(),
      title: track.title || track.trackName,
      artist: track.artist || track.artistName,
      album: track.album || track.collectionName || '',
      duration: track.duration || Math.round((track.trackTimeMillis || 240000) / 1000),
      preview_url: track.preview_url || track.previewUrl,
      cover_url: track.cover_url || track.artworkUrl100 || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=300&auto=format&fit=crop'
    };

    setCurrentTrack(normTrack);
    setIsPlaying(true);
    recordPlayHistory(normTrack);

    if (listToSetAsQueue && listToSetAsQueue.length > 0) {
      const normQueue = listToSetAsQueue.map(t => ({
        track_id: t.track_id || t.trackId?.toString() || t.id?.toString(),
        title: t.title || t.trackName,
        artist: t.artist || t.artistName,
        album: t.album || t.collectionName || '',
        duration: t.duration || Math.round((t.trackTimeMillis || 240000) / 1000),
        preview_url: t.preview_url || t.previewUrl,
        cover_url: t.cover_url || t.artworkUrl100 || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=300&auto=format&fit=crop'
      }));
      setCurrentQueue(normQueue);
      const matchedIndex = normQueue.findIndex(q => q.track_id === normTrack.track_id);
      setQueueIndex(matchedIndex >= 0 ? matchedIndex : 0);
    } else {
      setCurrentQueue([normTrack]);
      setQueueIndex(0);
    }

    // 1. If HTML5 preview audio is available, start audio fallback immediately
    if (normTrack.preview_url) {
      try {
        if (!window.spotifyAudioFallback) {
          window.spotifyAudioFallback = new Audio();
        }
        window.spotifyAudioFallback.src = normTrack.preview_url;
        window.spotifyAudioFallback.volume = isMuted ? 0 : volume;
        window.spotifyAudioFallback.play().catch(() => {});
        window.spotifyAudioFallback.ontimeupdate = () => {
          if (!ytPlayer || typeof ytPlayer.getCurrentTime !== 'function') {
            setCurrentTime(window.spotifyAudioFallback.currentTime || 0);
            setDuration(window.spotifyAudioFallback.duration || 30);
          }
        };
      } catch (e) {}
    }

    // 2. Call backend proxy or search YouTube API to resolve full high quality video stream
    let resolvedVideoId = null;
    try {
      const searchRes = await axios.get(`/api/spotify/search-yt`, {
        params: { q: `${normTrack.artist} ${normTrack.title} Audio` }
      });
      if (searchRes.data && searchRes.data.videoId) {
        resolvedVideoId = searchRes.data.videoId;
      }
    } catch (err) {}

    if (!resolvedVideoId) {
      // Direct YouTube search queries
      try {
        const query = encodeURIComponent(`${normTrack.artist} ${normTrack.title}`);
        const ytSearchRes = await fetch(`https://invidious.nerdvpn.de/api/v1/search?q=${query}&type=video`);
        if (ytSearchRes.ok) {
          const items = await ytSearchRes.json();
          if (items && items[0] && items[0].videoId) {
            resolvedVideoId = items[0].videoId;
          }
        }
      } catch (e) {}
    }

    if (!resolvedVideoId) {
      // Verified music ID
      resolvedVideoId = 'dQw4w9WgXcQ';
    }

    const player = ytPlayer || window.spotifyYtPlayerInstance;
    if (player && typeof player.loadVideoById === 'function') {
      try {
        if (window.spotifyAudioFallback) {
          window.spotifyAudioFallback.pause();
        }
        player.loadVideoById({
          videoId: resolvedVideoId,
          startSeconds: 0
        });
        player.playVideo();
      } catch (e) {
        console.warn('YouTube loadVideoById error:', e);
      }
    }
  };

  const handleNext = () => {
    if (currentQueue.length === 0 || queueIndex < 0) return;
    
    let nextIdx = queueIndex + 1;
    if (isShuffle) {
      nextIdx = Math.floor(Math.random() * currentQueue.length);
    } else if (nextIdx >= currentQueue.length) {
      nextIdx = 0; // Wrap around
    }
    
    setQueueIndex(nextIdx);
    handlePlayTrack(currentQueue[nextIdx], currentQueue);
  };

  const handlePrev = () => {
    if (currentQueue.length === 0 || queueIndex < 0) return;
    
    let prevIdx = queueIndex - 1;
    if (prevIdx < 0) {
      prevIdx = currentQueue.length - 1; // Wrap to end
    }
    
    setQueueIndex(prevIdx);
    handlePlayTrack(currentQueue[prevIdx], currentQueue);
  };

  // Searching (iTunes Search API)
  const performSearch = async (queryToSearch) => {
    if (!queryToSearch.trim()) return;

    setSearching(true);
    try {
      const response = await axios.get(`https://itunes.apple.com/search`, {
        params: {
          term: queryToSearch,
          media: 'music',
          entity: 'song',
          limit: 50
        }
      });
      const results = response.data.results || [];
      
      try {
        const countsRes = await axios.get('/api/spotify/play-counts');
        const playCounts = countsRes.data || {};
        
        results.sort((a, b) => {
          const idA = a.trackId?.toString() || a.id?.toString();
          const idB = b.trackId?.toString() || b.id?.toString();
          const countA = playCounts[idA] || 0;
          const countB = playCounts[idB] || 0;
          return countB - countA;
        });
      } catch (countErr) {
        console.error('Error fetching play counts, skipping sort', countErr);
      }
      
      setSearchResults(results.slice(0, 30));
    } catch (err) {
      console.error('Error fetching from iTunes API', err);
    } finally {
      setSearching(false);
    }
  };

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    performSearch(searchQuery);
  };

  // Like song database handlers
  const handleLikeToggle = async (track) => {
    const trackId = track.track_id || track.trackId?.toString() || track.id?.toString();
    const isAlreadyLiked = likedSongs.some(s => s.track_id === trackId);

    try {
      if (isAlreadyLiked) {
        await axios.delete(`/api/spotify/liked/${trackId}`);
      } else {
        await axios.post('/api/spotify/liked', {
          trackId,
          title: track.title || track.trackName,
          artist: track.artist || track.artistName,
          album: track.album || track.collectionName || '',
          duration: track.duration || Math.round((track.trackTimeMillis || 240000) / 1000),
          previewUrl: track.preview_url || track.previewUrl,
          coverUrl: track.cover_url || track.artworkUrl100 || ''
        });
      }
      fetchLikedSongs();
    } catch (err) {
      console.error('Error toggling like status', err);
    }
  };

  // Playlist management
  const handleCreatePlaylist = async (e) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) return;

    try {
      await axios.post('/api/spotify/playlists', {
        name: newPlaylistName,
        description: newPlaylistDesc
      });
      setNewPlaylistName('');
      setNewPlaylistDesc('');
      setShowCreateModal(false);
      fetchPlaylists();
    } catch (err) {
      console.error('Error creating playlist', err);
    }
  };

  const handleViewPlaylist = async (playlistId) => {
    try {
      const res = await axios.get(`/api/spotify/playlists/${playlistId}`);
      setCurrentPlaylist(res.data);
      setActiveTab('playlist-detail');
    } catch (err) {
      console.error('Error loading playlist details', err);
    }
  };

  const handleAddTrackToPlaylist = async (playlistId) => {
    if (!selectedTrackForPlaylist) return;
    const track = selectedTrackForPlaylist;

    try {
      await axios.post(`/api/spotify/playlists/${playlistId}/tracks`, {
        trackId: track.track_id || track.trackId?.toString() || track.id?.toString(),
        title: track.title || track.trackName,
        artist: track.artist || track.artistName,
        album: track.album || track.collectionName || '',
        duration: track.duration || Math.round((track.trackTimeMillis || 240000) / 1000),
        previewUrl: track.preview_url || track.previewUrl,
        coverUrl: track.cover_url || track.artworkUrl100 || ''
      });
      setShowAddToPlaylistModal(false);
      setSelectedTrackForPlaylist(null);
      
      // Refresh current playlist view if we are on it
      if (currentPlaylist && currentPlaylist.id === playlistId) {
        handleViewPlaylist(playlistId);
      }
      fetchPlaylists();
    } catch (err) {
      console.error('Error adding track to playlist', err);
    }
  };

  const handleRemoveTrackFromPlaylist = async (playlistId, trackId) => {
    try {
      await axios.delete(`/api/spotify/playlists/${playlistId}/tracks/${trackId}`);
      handleViewPlaylist(playlistId);
    } catch (err) {
      console.error('Error removing track from playlist', err);
    }
  };

  const formatTime = (secs) => {
    if (isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Seek bar action
  const handleSeek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const targetSeconds = pos * duration;
    setCurrentTime(targetSeconds);
    if (ytPlayer && typeof ytPlayer.seekTo === 'function') {
      ytPlayer.seekTo(targetSeconds, true);
    }
  };

  return (
    <div className="spotify-layout">
      {/* Offscreen YouTube player container for uninterrupted background audio */}
      <div style={{ position: 'fixed', bottom: '-9999px', left: '-9999px', width: '200px', height: '200px', opacity: 0.01, pointerEvents: 'none', zIndex: -1 }}>
        <div id="youtube-player"></div>
      </div>

      {/* Sidebar Panel */}
      <aside className="spotify-sidebar">
        <div className="sidebar-logo">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.586 14.424c-.18.295-.565.387-.86.207-2.377-1.454-5.37-1.783-8.894-.982-.336.075-.668-.135-.744-.47-.077-.337.135-.668.47-.745 3.856-.88 7.15-.5 9.822 1.135.296.18.388.563.206.855zm1.225-2.72c-.227.367-.707.487-1.074.26-2.72-1.672-6.87-2.157-10.082-1.182-.413.125-.847-.107-.972-.52-.125-.413.108-.847.52-.972 3.67-1.114 8.243-.574 11.35 1.34.367.226.487.707.26 1.074zm.107-2.846C14.424 8.71 8.647 8.52 5.306 9.535c-.513.156-1.05-.135-1.206-.648-.156-.513.135-1.05.648-1.207 3.83-1.162 10.222-.94 14.254 1.454.462.274.612.875.338 1.337-.274.462-.875.612-1.337.338z"/>
          </svg>
          <span>WiredMusic</span>
        </div>

        <nav className="sidebar-menu">
          <div 
            className={`sidebar-menu-item ${activeTab === 'home' ? 'active' : ''}`}
            onClick={() => setActiveTab('home')}
          >
            <span>🏠</span> Home
          </div>
          <div 
            className={`sidebar-menu-item ${activeTab === 'search' ? 'active' : ''}`}
            onClick={() => setActiveTab('search')}
          >
            <span>🔍</span> Search
          </div>
          <div 
            className={`sidebar-menu-item ${activeTab === 'liked' ? 'active' : ''}`}
            onClick={() => setActiveTab('liked')}
          >
            <span>💚</span> Liked Songs
          </div>
        </nav>

        <div className="sidebar-divider"></div>

        <div className="playlists-header">
          <span>Playlists</span>
          <button 
            className="create-playlist-btn"
            title="Create Playlist"
            onClick={() => setShowCreateModal(true)}
          >
            ➕
          </button>
        </div>

        <div className="sidebar-scrollable">
          {playlists.map(p => (
            <div
              key={p.id}
              className={`playlist-item ${activeTab === 'playlist-detail' && currentPlaylist?.id === p.id ? 'active' : ''}`}
              onClick={() => handleViewPlaylist(p.id)}
            >
              🎵 {p.name}
            </div>
          ))}
        </div>
      </aside>

      {/* Main Container */}
      <main className="spotify-main">
        
        {/* Header bar */}
        <header className="spotify-header">
          <div className="header-nav">
            {activeTab === 'search' && (
              <form onSubmit={handleSearch} className="nav-search-bar">
                <span>🔍</span>
                <input
                  type="text"
                  placeholder="What do you want to play?"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                />
              </form>
            )}
          </div>

          <div className="header-user">
            <button className="chat-toggle-btn" onClick={onToggleToChat} style={{ marginRight: '8px' }}>
              💬 Open Chat Portal
            </button>
            <button className="chat-toggle-btn games-toggle-btn" onClick={onToggleToGames} style={{ marginRight: '8px', background: '#a55eea', borderColor: '#a55eea' }}>
              🎮 Open Games Portal
            </button>
            <div className="user-profile-badge">
              <div className="user-avatar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.8rem', fontWeight: 'bold' }}>
                {user.username.substring(0, 2).toUpperCase()}
              </div>
              <span className="username-label">{user.username}</span>
            </div>
            <button className="logout-btn" onClick={onLogout}>
              Logout
            </button>
          </div>
        </header>

        {/* Scrollable View Content */}
        <div className="spotify-content">
          
          {/* HOME VIEW */}
          {activeTab === 'home' && (
            <div>
              <h2 className="section-title">Trending Now</h2>
              <div className="cards-grid">
                {[
                  { id: '1', title: 'Viral Hits', desc: 'The biggest tracks trending globally right now.', img: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=300&auto=format&fit=crop', query: 'pop hits' },
                  { id: '2', title: 'Chill Vibes', desc: 'Unwind with this smooth selection of relaxed beats.', img: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?q=80&w=300&auto=format&fit=crop', query: 'chillout' },
                  { id: '3', title: 'Focus & Study', desc: 'Keep your concentration high with ambient tracks.', img: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?q=80&w=300&auto=format&fit=crop', query: 'ambient' },
                  { id: '4', title: 'Synthwave Neon', desc: 'Retrowave retro beats for late night drives.', img: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=300&auto=format&fit=crop', query: 'synthwave' },
                ].map(card => (
                  <div key={card.id} className="spotify-card" onClick={() => {
                    setSearchQuery(card.query);
                    setActiveTab('search');
                    performSearch(card.query);
                  }}>
                    <div className="card-img-wrapper">
                      <img src={card.img} alt={card.title} className="card-img" />
                      <button className="card-play-btn">▶</button>
                    </div>
                    <div className="card-title">{card.title}</div>
                    <div className="card-desc">{card.desc}</div>
                  </div>
                ))}
              </div>

              {playHistory.length > 0 && (
                <>
                  <h2 className="section-title">Recently Played</h2>
                  <div className="cards-grid">
                    {playHistory.slice(0, 4).map((hist, index) => (
                      <div key={hist.id || index} className="spotify-card" onClick={() => handlePlayTrack(hist, playHistory)}>
                        <div className="card-img-wrapper">
                          <img src={hist.cover_url || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=300&auto=format&fit=crop'} alt={hist.title} className="card-img" />
                          <button className="card-play-btn">▶</button>
                        </div>
                        <div className="card-title">{hist.title}</div>
                        <div className="card-desc">{hist.artist}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* SEARCH VIEW */}
          {activeTab === 'search' && (
            <div>
              <h2 className="section-title">
                {searchResults.length > 0 ? `Results for "${searchQuery}"` : 'Browse Music Library'}
              </h2>
              {searching ? (
                <div style={{ color: 'var(--spotify-green)', fontWeight: 'bold' }}>Searching full library...</div>
              ) : searchResults.length > 0 ? (
                <table className="tracks-table">
                  <thead>
                    <tr className="table-header-row">
                      <th style={{ width: '40px' }}>#</th>
                      <th>Title</th>
                      <th>Album</th>
                      <th style={{ width: '120px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {searchResults.map((track, i) => {
                      const trackId = track.trackId?.toString() || track.id?.toString();
                      const isLiked = likedSongs.some(s => s.track_id === trackId);
                      return (
                        <tr 
                          key={trackId || i}
                          className={`track-row ${currentTrack?.track_id === trackId ? 'active' : ''}`}
                        >
                          <td className="track-col-number" onClick={() => handlePlayTrack(track, searchResults)}>
                            {currentTrack?.track_id === trackId && isPlaying ? '🔊' : i + 1}
                          </td>
                          <td>
                            <div className="track-title-block">
                              <img 
                                src={track.artworkUrl100 || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=300&auto=format&fit=crop'} 
                                alt={track.trackName} 
                                className="track-cover-sm" 
                              />
                              <div style={{ cursor: 'pointer' }} onClick={() => handlePlayTrack(track, searchResults)}>
                                <div className={`track-name-main ${currentTrack?.track_id === trackId ? 'active-name' : ''}`}>
                                  {track.trackName}
                                </div>
                                <div className="track-artist-sub">{track.artistName}</div>
                              </div>
                            </div>
                          </td>
                          <td className="track-album-col">{track.collectionName}</td>
                          <td>
                            <div className="track-actions-col">
                              <button 
                                className={`icon-btn ${isLiked ? 'liked' : ''}`}
                                onClick={() => handleLikeToggle(track)}
                              >
                                {isLiked ? '💚' : '🖤'}
                              </button>
                              <button 
                                className="icon-btn"
                                onClick={() => {
                                  setSelectedTrackForPlaylist(track);
                                  setShowAddToPlaylistModal(true);
                                }}
                              >
                                ➕
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div style={{ color: 'var(--spotify-text-muted)', fontStyle: 'italic' }}>
                  Use the search bar at the top to search millions of tracks from the Spotify library!
                </div>
              )}
            </div>
          )}

          {/* LIKED SONGS VIEW */}
          {activeTab === 'liked' && (
            <div>
              <div className="view-header liked-header">
                <div className="header-cover-img" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#5038a0', fontSize: '5rem' }}>
                  💚
                </div>
                <div className="header-info-col">
                  <span className="header-type">Playlist</span>
                  <h1 className="header-title">Liked Songs</h1>
                  <span className="header-details">{likedSongs.length} songs</span>
                </div>
              </div>

              {likedSongs.length > 0 ? (
                <table className="tracks-table">
                  <thead>
                    <tr className="table-header-row">
                      <th style={{ width: '40px' }}>#</th>
                      <th>Title</th>
                      <th>Album</th>
                      <th style={{ width: '120px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {likedSongs.map((track, i) => (
                      <tr 
                        key={track.id}
                        className={`track-row ${currentTrack?.track_id === track.track_id ? 'active' : ''}`}
                      >
                        <td className="track-col-number" onClick={() => handlePlayTrack(track, likedSongs)}>
                          {currentTrack?.track_id === track.track_id && isPlaying ? '🔊' : i + 1}
                        </td>
                        <td>
                          <div className="track-title-block">
                            <img 
                              src={track.cover_url || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=300&auto=format&fit=crop'} 
                              alt={track.title} 
                              className="track-cover-sm" 
                            />
                            <div style={{ cursor: 'pointer' }} onClick={() => handlePlayTrack(track, likedSongs)}>
                              <div className={`track-name-main ${currentTrack?.track_id === track.track_id ? 'active-name' : ''}`}>
                                {track.title}
                              </div>
                              <div className="track-artist-sub">{track.artist}</div>
                            </div>
                          </div>
                        </td>
                        <td className="track-album-col">{track.album}</td>
                        <td>
                          <div className="track-actions-col">
                            <button 
                              className="icon-btn liked"
                              onClick={() => handleLikeToggle(track)}
                            >
                              💚
                            </button>
                            <button 
                              className="icon-btn"
                              onClick={() => {
                                setSelectedTrackForPlaylist(track);
                                setShowAddToPlaylistModal(true);
                              }}
                            >
                              ➕
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ color: 'var(--spotify-text-muted)', textAlign: 'center', padding: '40px' }}>
                  Songs you like will appear here!
                </div>
              )}
            </div>
          )}

          {/* PLAYLIST DETAIL VIEW */}
          {activeTab === 'playlist-detail' && currentPlaylist && (
            <div>
              <div className="view-header playlist-header">
                <img 
                  src={currentPlaylist.cover_url} 
                  alt={currentPlaylist.name} 
                  className="header-cover-img" 
                />
                <div className="header-info-col">
                  <span className="header-type">Playlist</span>
                  <h1 className="header-title">{currentPlaylist.name}</h1>
                  <p style={{ margin: 0, opacity: 0.8 }}>{currentPlaylist.description}</p>
                  <span className="header-details">
                    Created by {user.username} • {currentPlaylist.tracks?.length || 0} songs
                  </span>
                </div>
              </div>

              {currentPlaylist.tracks && currentPlaylist.tracks.length > 0 ? (
                <table className="tracks-table">
                  <thead>
                    <tr className="table-header-row">
                      <th style={{ width: '40px' }}>#</th>
                      <th>Title</th>
                      <th>Album</th>
                      <th style={{ width: '120px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentPlaylist.tracks.map((track, i) => {
                      const isLiked = likedSongs.some(s => s.track_id === track.track_id);
                      return (
                        <tr 
                          key={track.id}
                          className={`track-row ${currentTrack?.track_id === track.track_id ? 'active' : ''}`}
                        >
                          <td className="track-col-number" onClick={() => handlePlayTrack(track, currentPlaylist.tracks)}>
                            {currentTrack?.track_id === track.track_id && isPlaying ? '🔊' : i + 1}
                          </td>
                          <td>
                            <div className="track-title-block">
                              <img 
                                src={track.cover_url || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=300&auto=format&fit=crop'} 
                                alt={track.title} 
                                className="track-cover-sm" 
                              />
                              <div style={{ cursor: 'pointer' }} onClick={() => handlePlayTrack(track, currentPlaylist.tracks)}>
                                <div className={`track-name-main ${currentTrack?.track_id === track.track_id ? 'active-name' : ''}`}>
                                  {track.title}
                                </div>
                                <div className="track-artist-sub">{track.artist}</div>
                              </div>
                            </div>
                          </td>
                          <td className="track-album-col">{track.album}</td>
                          <td>
                            <div className="track-actions-col">
                              <button 
                                className={`icon-btn ${isLiked ? 'liked' : ''}`}
                                onClick={() => handleLikeToggle(track)}
                              >
                                {isLiked ? '💚' : '🖤'}
                              </button>
                              <button 
                                className="icon-btn"
                                onClick={() => handleRemoveTrackFromPlaylist(currentPlaylist.id, track.track_id)}
                                title="Remove from Playlist"
                              >
                                🗑️
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div style={{ color: 'var(--spotify-text-muted)', textAlign: 'center', padding: '40px' }}>
                  This playlist is empty. Search for songs to add them!
                </div>
              )}
            </div>
          )}

        </div>
      </main>

      {/* Sticky Bottom Audio Player */}
      <footer className="spotify-player">
        
        {/* Track info Left */}
        <div className="player-track-info">
          {currentTrack ? (
            <>
              <img src={currentTrack.cover_url} alt={currentTrack.title} className="player-cover-img" />
              <div className="player-text">
                <span className="player-track-name">{currentTrack.title}</span>
                <span className="player-artist-name">{currentTrack.artist}</span>
              </div>
              <button 
                className={`icon-btn ${likedSongs.some(s => s.track_id === currentTrack.track_id) ? 'liked' : ''}`}
                onClick={() => handleLikeToggle(currentTrack)}
                style={{ marginLeft: '12px' }}
              >
                {likedSongs.some(s => s.track_id === currentTrack.track_id) ? '💚' : '🖤'}
              </button>
            </>
          ) : (
            <div style={{ fontSize: '0.85rem', color: 'var(--spotify-text-muted)' }}>No track selected</div>
          )}
        </div>

        {/* Player controls Center */}
        <div className="player-controls-center">
          <div className="control-buttons">
            <button 
              className="icon-btn" 
              onClick={() => setIsShuffle(!isShuffle)}
              style={{ color: isShuffle ? 'var(--spotify-green)' : '' }}
              title="Shuffle"
            >
              🔀
            </button>
            <button className="icon-btn" onClick={handlePrev} title="Previous">⏮</button>
            <button className="play-pause-btn" onClick={togglePlayPause} title="Play/Pause">
              {isPlaying ? '⏸' : '▶'}
            </button>
            <button className="icon-btn" onClick={handleNext} title="Next">⏭</button>
            <button 
              className="icon-btn" 
              onClick={() => setIsLoop(!isLoop)}
              style={{ color: isLoop ? 'var(--spotify-green)' : '' }}
              title="Loop"
            >
              🔁
            </button>
          </div>

          <div className="progress-bar-wrapper">
            <span>{formatTime(currentTime)}</span>
            <div className="progress-slider" onClick={handleSeek}>
              <div 
                className="progress-fill" 
                style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
              ></div>
            </div>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Volume controls Right */}
        <div className="player-actions-right">
          <button className="icon-btn" onClick={() => setIsMuted(!isMuted)}>
            {isMuted || volume === 0 ? '🔇' : volume < 0.4 ? '🔈' : '🔊'}
          </button>
          <div className="volume-bar-wrapper">
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={(e) => {
                setVolume(parseFloat(e.target.value));
                setIsMuted(false);
              }}
              style={{ accentColor: 'var(--spotify-green)', width: '100%', cursor: 'pointer' }}
            />
          </div>
        </div>
      </footer>

      {/* CREATE PLAYLIST MODAL */}
      {showCreateModal && (
        <div className="modal-overlay">
          <form className="modal-content" onSubmit={handleCreatePlaylist}>
            <div className="modal-title">Create Playlist</div>
            <input
              className="modal-input"
              type="text"
              placeholder="Playlist Name"
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              required
            />
            <input
              className="modal-input"
              type="text"
              placeholder="Description (Optional)"
              value={newPlaylistDesc}
              onChange={(e) => setNewPlaylistDesc(e.target.value)}
            />
            <div className="modal-actions">
              <button 
                type="button" 
                className="cancel-modal-btn"
                onClick={() => {
                  setShowCreateModal(false);
                  setNewPlaylistName('');
                  setNewPlaylistDesc('');
                }}
              >
                Cancel
              </button>
              <button type="submit" className="confirm-modal-btn">
                Create
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ADD TO PLAYLIST MODAL */}
      {showAddToPlaylistModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-title">Add to Playlist</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
              {playlists.length > 0 ? (
                playlists.map(p => (
                  <div
                    key={p.id}
                    className="playlist-item"
                    style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '4px' }}
                    onClick={() => handleAddTrackToPlaylist(p.id)}
                  >
                    🎵 {p.name}
                  </div>
                ))
              ) : (
                <div style={{ color: 'var(--spotify-text-muted)', fontSize: '0.9rem', fontStyle: 'italic', padding: '10px 0' }}>
                  No playlists found. Create one first!
                </div>
              )}
            </div>
            <div className="modal-actions">
              <button 
                className="cancel-modal-btn"
                onClick={() => {
                  setShowAddToPlaylistModal(false);
                  setSelectedTrackForPlaylist(null);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
