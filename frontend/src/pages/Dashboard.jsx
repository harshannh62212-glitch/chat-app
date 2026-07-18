import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import ServerList from '../components/ServerList';
import Discovery from '../components/Discovery';
import ServerChat from '../components/ServerChat';
import DMList from '../components/DMList';
import DirectMessage from '../components/DirectMessage';
import AdminPanel from '../components/AdminPanel';
import FriendsPanel from '../components/FriendsPanel';
import Logo from '../components/Logo';
import '../styles/Dashboard.css';

function Dashboard({ user, setUser, onLogout }) {
  const [activeTab, setActiveTab] = useState('servers');
  const [selectedServer, setSelectedServer] = useState(null);
  const [selectedDM, setSelectedDM] = useState(null);
  const [showNewServerModal, setShowNewServerModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [servers, setServers] = useState([]);
  const [notifications, setNotifications] = useState([]);

  // Listen to the user's servers in real-time
  useEffect(() => {
    const fetchUserServers = async () => {
      try {
        const { data, error } = await supabase
          .from('server_members')
          .select('server_id, servers (*)')
          .eq('user_id', user.id);
        
        if (error) throw error;
        
        if (data) {
          const loadedServers = data.map(d => d.servers).filter(Boolean);
          loadedServers.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
          setServers(loadedServers);
        }
      } catch (err) {
        console.error('Failed to fetch user servers:', err);
      }
    };

    fetchUserServers();

    // Listen to changes on server memberships
    const channel = supabase
      .channel(`my-servers-${user.id}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'server_members', 
        filter: `user_id=eq.${user.id}` 
      }, () => {
        fetchUserServers();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user.id]);

  // Listen to new direct messages for toast notifications
  useEffect(() => {
    const channel = supabase
      .channel(`new-dms-${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'direct_messages',
        filter: `recipient_id=eq.${user.id}`
      }, (payload) => {
        const message = payload.new;
        const currentDmUserId = selectedDM?.id || selectedDM?.other_user_id;
        
        if (activeTab !== 'dms' || currentDmUserId !== message.sender_id) {
          const newNotification = {
            id: message.id,
            senderId: message.sender_id,
            senderUsername: message.sender_username || 'Someone',
            content: message.content,
            timestamp: new Date(message.created_at).getTime()
          };
          
          setNotifications(prev => {
            if (prev.some(n => n.id === newNotification.id)) return prev;
            return [...prev, newNotification];
          });

          setTimeout(() => {
            setNotifications(prev => prev.filter(n => n.id !== newNotification.id));
          }, 5000);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user.id, selectedDM, activeTab]);

  const handleNotificationClick = (notif) => {
    setActiveTab('dms');
    setSelectedServer(null);
    setSelectedDM({
      id: notif.senderId,
      other_user_id: notif.senderId,
      username: notif.senderUsername
    });
    setNotifications(prev => prev.filter(n => n.id !== notif.id));
  };

  const handleServerCreated = () => {
    setShowNewServerModal(false);
  };

  return (
    <div className="dashboard discord-layout">
      {/* 1. Leftmost Server Rail (Narrow Icon Column) */}
      <div className="discord-server-rail">
        <div className="brand-logo-container">
          <Logo width={36} height={36} />
        </div>

        <div className="rail-separator"></div>

        <div 
          className={`rail-icon home-icon ${activeTab === 'dms' && !selectedServer ? 'active' : ''}`}
          onClick={() => { setActiveTab('dms'); setSelectedServer(null); setSelectedDM(null); }}
          title="Direct Messages"
        >
          💬
        </div>
        
        <div className="rail-separator"></div>

        <div className="rail-servers">
          {servers.map(srv => (
            <div 
              key={srv.id}
              className={`rail-icon server-icon ${selectedServer?.id === srv.id ? 'active' : ''}`}
              onClick={() => { setSelectedServer(srv); setSelectedDM(null); setActiveTab('servers'); }}
              title={srv.name}
            >
              {srv.name.substring(0, 2).toUpperCase()}
            </div>
          ))}
        </div>

        <div 
          className="rail-icon add-server-icon"
          onClick={() => setShowNewServerModal(true)}
          title="Create a Server"
        >
          +
        </div>

        <div 
          className={`rail-icon discover-icon ${activeTab === 'discovery' ? 'active' : ''}`}
          onClick={() => { setActiveTab('discovery'); setSelectedServer(null); setSelectedDM(null); }}
          title="Explore Public Servers"
        >
          🧭
        </div>

        {user.is_admin && (
          <div 
            className={`rail-icon admin-icon ${activeTab === 'admin' ? 'active' : ''}`}
            onClick={() => { setActiveTab('admin'); setSelectedServer(null); setSelectedDM(null); }}
            title="Admin Moderation"
          >
            🛡️
          </div>
        )}
      </div>

      {/* 2. Sub-Sidebar Column (List for selected tab/view) */}
      {!selectedServer && (
        <div className="discord-sub-sidebar">
          <div className="sub-sidebar-header">
            {activeTab === 'dms' ? (
              <div className="brand-header-title">
                <h3>Direct Messages</h3>
                <span className="brand-subtext">wired-io</span>
              </div>
            ) : activeTab === 'discovery' ? (
              <div className="brand-header-title">
                <h3>Server Discovery</h3>
                <span className="brand-subtext">wired-io</span>
              </div>
            ) : activeTab === 'admin' ? (
              <div className="brand-header-title">
                <h3>Admin Panel</h3>
                <span className="brand-subtext">wired-io</span>
              </div>
            ) : (
              <div className="brand-header-title">
                <h3>wired-io</h3>
                <span className="brand-subtext">Main Lobby</span>
              </div>
            )}
          </div>

          <div className="sub-sidebar-content">
            {activeTab === 'dms' && (
              <DMList 
                onSelectDM={setSelectedDM}
                selectedDM={selectedDM}
                currentUser={user}
              />
            )}

            {activeTab === 'discovery' && (
              <Discovery currentUser={user} />
            )}

            {activeTab === 'admin' && (
              <div className="admin-menu-placeholder">
                <p>Welcome to Moderation Console. Use the main screen to moderate users, servers, and word filters.</p>
              </div>
            )}
          </div>

          {/* User Profile Bar at the bottom of sub-sidebar */}
          <UserProfileBar 
            user={user} 
            onOpenSettings={() => setShowSettingsModal(true)} 
          />
        </div>
      )}

      {/* 3. Main Chat Content Area */}
      <div className="main-content">
        {selectedServer && (
          <ServerChat 
            server={selectedServer}
            currentUser={user}
            onOpenSettings={() => setShowSettingsModal(true)}
            onStartDM={(otherUser) => {
              setSelectedServer(null);
              setSelectedDM(otherUser);
              setActiveTab('dms');
            }}
          />
        )}

        {selectedDM && (
          <DirectMessage 
            dmWith={selectedDM}
            currentUser={user}
            onOpenSettings={() => setShowSettingsModal(true)}
          />
        )}

        {activeTab === 'admin' && (
          <AdminPanel 
            currentUser={user}
            onSelectServer={(srv) => {
              setSelectedServer(srv);
              setSelectedDM(null);
              setActiveTab('servers');
            }}
          />
        )}

        {activeTab === 'dms' && !selectedDM && (
          <FriendsPanel 
            currentUser={user}
            onStartDM={(friend) => {
              setSelectedDM(friend);
            }}
          />
        )}

        {activeTab !== 'dms' && !selectedServer && !selectedDM && activeTab !== 'admin' && (
          <div className="welcome-container welcome-island">
            <div className="welcome-brand" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <Logo width={260} variant="full" />
              <span className="powered-by" style={{ marginTop: '8px' }}>powered by wired.inc</span>
            </div>
            <div className="welcome-info">
              <h2>Welcome to wired-io! 👋</h2>
              <p>Select a server on the left rail or start a direct message to begin your journey.</p>
            </div>
          </div>
        )}
      </div>

      {showNewServerModal && (
        <CreateServerModal 
          currentUser={user}
          onClose={() => setShowNewServerModal(false)}
          onServerCreated={handleServerCreated}
        />
      )}

      {showSettingsModal && (
        <SettingsModal 
          user={user}
          onClose={() => setShowSettingsModal(false)}
          onUpdateAvatar={(newUrl) => {
            setUser({ ...user, avatar_url: newUrl });
          }}
          onLogout={onLogout}
        />
      )}

      {/* Toast Notifications Container */}
      <div className="toasts-container">
        {notifications.map(notif => (
          <div 
            key={notif.id} 
            className="toast-notification"
            onClick={() => handleNotificationClick(notif)}
          >
            <div className="toast-header">
              <span className="toast-title">New DM from <strong>{notif.senderUsername}</strong></span>
              <button 
                className="toast-close-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setNotifications(prev => prev.filter(n => n.id !== notif.id));
                }}
              >
                &times;
              </button>
            </div>
            <div className="toast-body">
              {notif.content.length > 60 ? `${notif.content.substring(0, 60)}...` : notif.content}
            </div>
            <div className="toast-timeout-bar"></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CreateServerModal({ currentUser, onClose, onServerCreated }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    password: '',
    isPublic: true
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // 1. Create server document
      const { data: server, error: srvErr } = await supabase
        .from('servers')
        .insert({
          name: formData.name,
          description: formData.description || '',
          owner_id: currentUser.id,
          password_hash: formData.password || null,
          has_password: !!formData.password,
          is_public: formData.isPublic !== false,
          avatar_url: ''
        })
        .select('id')
        .single();

      if (srvErr) throw srvErr;

      // 2. Create mandatory general chatroom inside the server
      const { error: roomErr } = await supabase
        .from('chatrooms')
        .insert({
          server_id: server.id,
          name: 'general',
          is_general: true,
          description: 'General chatroom'
        });

      if (roomErr) throw roomErr;

      // 3. Create server membership for the owner
      const { error: memErr } = await supabase
        .from('server_members')
        .insert({
          user_id: currentUser.id,
          server_id: server.id,
          username: currentUser.username,
          avatar_url: currentUser.avatar_url || ''
        });

      if (memErr) throw memErr;

      onServerCreated();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to create server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>Create New Server</h2>
        {error && <div className="error-message">{error}</div>}
        
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            name="name"
            placeholder="Server Name"
            value={formData.name}
            onChange={handleChange}
            required
          />
          <textarea
            name="description"
            placeholder="Description (optional)"
            value={formData.description}
            onChange={handleChange}
            rows="3"
          />
          <input
            type="password"
            name="password"
            placeholder="Server Password (optional)"
            value={formData.password}
            onChange={handleChange}
          />
          <label>
            <input
              type="checkbox"
              name="isPublic"
              checked={formData.isPublic}
              onChange={handleChange}
            />
            Make server public (visible in discovery)
          </label>
          
          <div className="modal-actions">
            <button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create'}
            </button>
            <button type="button" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function UserProfileBar({ user, onOpenSettings }) {
  return (
    <div className="discord-user-bar">
      <div className="user-bar-profile">
        <div className="user-bar-avatar">
          {user.avatar_url ? (
            <img src={user.avatar_url} alt={user.username} />
          ) : (
            <div className="avatar-placeholder">{user.username ? user.username[0].toUpperCase() : '?'}</div>
          )}
          <span className="status-indicator online"></span>
        </div>
        <div className="user-bar-info">
          <span className="user-bar-name">{user.username}</span>
          <span className="user-bar-tag">#0001</span>
        </div>
      </div>
      <div className="user-bar-actions">
        <button className="user-bar-btn" onClick={onOpenSettings} title="Settings">⚙️</button>
      </div>
    </div>
  );
}

function SettingsModal({ user, onClose, onUpdateAvatar, onLogout }) {
  const [activeSettingsTab, setActiveSettingsTab] = useState('profile');
  const [avatarUrl, setAvatarUrl] = useState(user.avatar_url || '');
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'cosmic-dark');
  const [font, setFont] = useState(localStorage.getItem('font') || 'Outfit');
  const [fontSize, setFontSize] = useState(localStorage.getItem('font-size') || '15px');
  const [letterSpacing, setLetterSpacing] = useState(localStorage.getItem('letter-spacing') || 'normal');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const presets = [
    `https://robohash.org/${user.username}?set=set1`,
    `https://robohash.org/${user.username}?set=set2`,
    `https://robohash.org/${user.username}?set=set4`,
    `https://robohash.org/${user.username}?set=set3`
  ];

  useEffect(() => {
    localStorage.setItem('theme', theme);
    document.body.className = `theme-${theme}`;
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('font', font);
    document.documentElement.style.setProperty('--font-family', font);
  }, [font]);

  useEffect(() => {
    localStorage.setItem('font-size', fontSize);
    document.documentElement.style.setProperty('--font-size', fontSize);
  }, [fontSize]);

  useEffect(() => {
    localStorage.setItem('letter-spacing', letterSpacing);
    document.documentElement.style.setProperty('--letter-spacing', letterSpacing);
  }, [letterSpacing]);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    // Validate avatar URL against inappropriate content keywords
    const lowerUrl = (avatarUrl || '').toLowerCase();
    const isViolation = /(child\s*porn|childporn|cp|csam|pornography|porn|nudity|nude|sex|nsfw|naked|hentai)/.test(lowerUrl);
    if (isViolation) {
      setError('Inappropriate avatar URL detected. Please select a safe profile picture.');
      setLoading(false);
      return;
    }

    try {
      const { error: profileErr } = await supabase
        .from('users')
        .update({ avatar_url: avatarUrl })
        .eq('id', user.id);

      if (profileErr) throw profileErr;
      
      onUpdateAvatar(avatarUrl);
      setSuccess('Profile updated successfully!');
    } catch (err) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal settings-modal" onClick={e => e.stopPropagation()}>
        <div className="settings-container">
          <div className="settings-sidebar-menu">
            <h3>Settings</h3>
            <button 
              className={`settings-tab-btn ${activeSettingsTab === 'profile' ? 'active' : ''}`}
              onClick={() => setActiveSettingsTab('profile')}
            >
              👤 My Profile
            </button>
            <button 
              className={`settings-tab-btn ${activeSettingsTab === 'appearance' ? 'active' : ''}`}
              onClick={() => setActiveSettingsTab('appearance')}
            >
              🎨 Appearance
            </button>
            <button 
              className="settings-tab-btn settings-logout-btn" 
              onClick={() => {
                onClose();
                onLogout();
              }}
              style={{ color: '#ff4757', marginTop: 'auto' }}
            >
              🚪 Log Out
            </button>
            <button className="settings-close-btn-bottom" onClick={onClose}>Close</button>
            <div style={{ padding: '10px 0 0 0', fontSize: '11px', color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginTop: '12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              wired-io v1.0.0<br/>powered by wired.inc
            </div>
          </div>

          <div className="settings-content">
            <div className="settings-header">
              <h2>{activeSettingsTab === 'profile' ? 'My Profile Settings' : 'Appearance Settings'}</h2>
              <button className="settings-close-x" onClick={onClose}>&times;</button>
            </div>

            {error && <div className="error-message">{error}</div>}
            {success && <div className="success-message">{success}</div>}

            {activeSettingsTab === 'profile' && (
              <form onSubmit={handleSaveProfile} className="settings-form">
                <div className="avatar-preview-section">
                  <div className="avatar-large">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Preview" />
                    ) : (
                      <div className="avatar-placeholder-large">{user.username ? user.username[0].toUpperCase() : '?'}</div>
                    )}
                  </div>
                  <div className="presets-container">
                    <h4>Choose a Preset Avatar:</h4>
                    <div className="presets-list">
                      {presets.map((preset, idx) => (
                        <img 
                          key={idx}
                          src={preset} 
                          alt={`Preset ${idx + 1}`}
                          className={`preset-avatar-img ${avatarUrl === preset ? 'active' : ''}`}
                          onClick={() => setAvatarUrl(preset)}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="input-group">
                  <label htmlFor="avatar-url-input">Custom Avatar Image URL</label>
                  <input
                    id="avatar-url-input"
                    type="url"
                    placeholder="https://example.com/avatar.png"
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                  />
                </div>

                <button type="submit" className="save-settings-btn" disabled={loading}>
                  {loading ? 'Saving...' : 'Save Profile Changes'}
                </button>
              </form>
            )}

            {activeSettingsTab === 'appearance' && (
              <div className="settings-form">
                <div className="input-group">
                  <label>Select Theme</label>
                  <div className="theme-grid">
                    <button 
                      className={`theme-select-card cosmic ${theme === 'cosmic-dark' ? 'active' : ''}`}
                      onClick={() => setTheme('cosmic-dark')}
                    >
                      🔮 Cosmic Dark
                    </button>
                    <button 
                      className={`theme-select-card discord ${theme === 'discord-classic' ? 'active' : ''}`}
                      onClick={() => setTheme('discord-classic')}
                    >
                      💬 Discord Classic
                    </button>
                    <button 
                      className={`theme-select-card obsidian ${theme === 'midnight-obsidian' ? 'active' : ''}`}
                      onClick={() => setTheme('midnight-obsidian')}
                    >
                      🌑 Midnight Obsidian
                    </button>
                    <button 
                      className={`theme-select-card cyberpunk ${theme === 'cyberpunk-neon' ? 'active' : ''}`}
                      onClick={() => setTheme('cyberpunk-neon')}
                    >
                      ⚡ Cyberpunk Neon
                    </button>
                  </div>
                </div>

                <div className="input-group">
                  <label htmlFor="font-family-select">Font Style</label>
                  <select 
                    id="font-family-select"
                    value={font} 
                    onChange={(e) => setFont(e.target.value)}
                  >
                    <option value="Outfit">Outfit (Modern Rounded)</option>
                    <option value="'Segoe UI', sans-serif">Segoe UI (Classic clean)</option>
                    <option value="Courier New">Monospace (Code style)</option>
                    <option value="Comic Sans MS">Comic Sans (Funny)</option>
                  </select>
                </div>

                <div className="input-group">
                  <label htmlFor="font-size-slider">Font Size: {fontSize}</label>
                  <input 
                    id="font-size-slider"
                    type="range" 
                    min="13" 
                    max="19" 
                    step="1"
                    value={parseInt(fontSize)} 
                    onChange={(e) => setFontSize(`${e.target.value}px`)}
                  />
                </div>

                <div className="input-group">
                  <label htmlFor="letter-spacing-slider">Letter Spacing: {letterSpacing}</label>
                  <input 
                    id="letter-spacing-slider"
                    type="range" 
                    min="-1" 
                    max="4" 
                    step="0.5"
                    value={letterSpacing === 'normal' ? 0 : parseFloat(letterSpacing)} 
                    onChange={(e) => setLetterSpacing(e.target.value == 0 ? 'normal' : `${e.target.value}px`)}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
