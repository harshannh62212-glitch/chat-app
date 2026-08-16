import React, { useState, useEffect } from 'react';
import axios from 'axios';
import ServerList from '../components/ServerList';
import Discovery from '../components/Discovery';
import ServerChat from '../components/ServerChat';
import DMList from '../components/DMList';
import DirectMessage from '../components/DirectMessage';
import AdminPanel from '../components/AdminPanel';
import FriendsPanel from '../components/FriendsPanel';
import Logo from '../components/Logo';
import '../styles/Dashboard.css';

function Dashboard({ user, setUser, onLogout, batteryInfo, onToggleToSpotify, onToggleToGames, onToggleToYouTube }) {
  const [activeTab, setActiveTab] = useState('servers');
  const [selectedServer, setSelectedServer] = useState(null);
  const [selectedDM, setSelectedDM] = useState(null);
  const [showNewServerModal, setShowNewServerModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [servers, setServers] = useState([]);
  const [notifications, setNotifications] = useState([]);

  const [showGlobalReportModal, setShowGlobalReportModal] = useState(false);
  const [bugDescription, setBugDescription] = useState('');
  const [bugSubmitting, setBugSubmitting] = useState(false);
  const [bugSuccess, setBugSuccess] = useState(false);
  const [bugError, setBugError] = useState('');


  const [viewingFriends, setViewingFriends] = useState(false);

  const fetchUserServers = async () => {
    try {
      const res = await axios.get('/api/servers/my-servers');
      if (res.data) {
        setServers(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch user servers:', err);
    }
  };

  useEffect(() => {
    fetchUserServers();
  }, [user.id]);

  const handleNotificationClick = (notif) => {
    setActiveTab('dms');
    setSelectedServer(null);
    setViewingFriends(false);
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

  const handleGlobalReportSubmit = async (e) => {
    e.preventDefault();
    if (!bugDescription.trim()) return;

    setBugSubmitting(true);
    setBugError('');
    setBugSuccess(false);

    try {
      const res = await axios.post('/api/global-report', {
        description: bugDescription,
      });
      
      if (res.data.status === 'rejected') {
        setBugError('AI classified your report as SPAM/test. Please enter a valid defect description.');
      } else {
        setBugSuccess(true);
        setBugDescription('');
        setTimeout(() => {
          setShowGlobalReportModal(false);
          setBugSuccess(false);
        }, 2500);
      }
    } catch (err) {
      setBugError(err.response?.data?.error || 'Failed to submit report. Please try again.');
    } finally {
      setBugSubmitting(false);
    }
  };

  const handleBack = () => {
    setSelectedServer(null);
    setSelectedDM(null);
    setViewingFriends(false);
  };

  const hasActiveView = !!(selectedServer || selectedDM || viewingFriends);

  return (
    <div className={`dashboard discord-layout ${hasActiveView ? 'has-active-view' : 'show-navigation'}`} style={{ position: 'relative' }}>
      {/* 1. Leftmost Server Rail (Narrow Icon Column) */}
      <div className="discord-server-rail">

        <div className="brand-logo-container">
          <Logo width={36} height={36} />
        </div>

        <div className="rail-separator"></div>



        <div 
          className={`rail-icon home-icon ${activeTab === 'dms' && !selectedServer ? 'active' : ''}`}
          onClick={() => { setActiveTab('dms'); setSelectedServer(null); setSelectedDM(null); setViewingFriends(false); }}
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
              onClick={() => { setSelectedServer(srv); setSelectedDM(null); setActiveTab('servers'); setViewingFriends(false); }}
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
          onClick={() => { setActiveTab('discovery'); setSelectedServer(null); setSelectedDM(null); setViewingFriends(false); }}
          title="Explore Public Servers"
        >
          🧭
        </div>

        {/* Bottom utility icons */}
        <div className="rail-separator" style={{ marginTop: 'auto' }}></div>

        {/* Spotify Portal Button */}
        <div 
          className="rail-icon spotify-rail-btn"
          onClick={onToggleToSpotify}
          title="Open Spotify Portal"
          style={{
            background: 'rgba(29, 185, 84, 0.15)',
            border: '1px solid rgba(29, 185, 84, 0.4)',
            color: '#1db954',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px',
            marginBottom: '10px'
          }}
        >
          🎵
        </div>

        {/* YouTube Portal Button */}
        <div 
          className="rail-icon youtube-rail-btn"
          onClick={onToggleToYouTube}
          title="Open WiredTube (YouTube & Video Portal)"
          style={{
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '10px'
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
          </svg>
        </div>

        {/* Games Portal Button */}
        <div 
          className="rail-icon games-rail-btn"
          onClick={onToggleToGames}
          title="Open Games Arcade"
          style={{
            background: 'rgba(165, 94, 234, 0.15)',
            border: '1px solid rgba(165, 94, 234, 0.4)',
            color: '#a55eea',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px',
            marginBottom: '10px'
          }}
        >
          🎮
        </div>

        {/* YouTube Web App Portal Button */}
        <div 
          className="rail-icon youtube-rail-btn"
          onClick={onToggleToYouTube || (() => { window.history.pushState({}, '', '/youtube'); window.dispatchEvent(new PopStateEvent('popstate')); })}
          title="Open YouTube Portal"
          style={{
            background: 'rgba(255, 0, 0, 0.15)',
            border: '1px solid rgba(255, 0, 0, 0.4)',
            color: '#ff0000',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px',
            marginBottom: '10px',
            transition: 'all 0.2s ease'
          }}
        >
          ▶️
        </div>

        {user && user.is_admin && (
          <div 
            className="rail-icon admin-rail-btn"
            onClick={() => {
              window.history.pushState({}, '', '/moderation');
              window.dispatchEvent(new PopStateEvent('popstate'));
            }}
            title="Admin & Database Management Hub"
            style={{
              background: 'rgba(0, 255, 255, 0.12)',
              border: '1px solid rgba(0, 255, 255, 0.3)',
              color: '#00ffff',
              marginBottom: '10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              transition: 'all 0.2s ease'
            }}
          >
            🛡️
          </div>
        )}

        {/* Global Bug Report Button at the bottom of the server rail */}
        <div 
          className="rail-icon bug-report-rail-btn"
          onClick={() => setShowGlobalReportModal(true)}
          title="Report Bug / System Glitch"
          style={{
            background: 'rgba(255, 71, 87, 0.1)',
            border: '1px solid rgba(255, 71, 87, 0.2)',
            color: '#ff4757',
            marginBottom: '16px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px',
            transition: 'background 0.2s, transform 0.2s, border-radius 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 71, 87, 0.25)';
            e.currentTarget.style.transform = 'scale(1.15)';
            e.currentTarget.style.borderRadius = '16px';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 71, 87, 0.1)';
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.borderRadius = '50%';
          }}
        >
          🪲
        </div>

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
            ) : (
              <div className="brand-header-title" style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                  <h3 style={{ margin: 0 }}>wired-io</h3>
                  {batteryInfo && (
                    <span 
                      style={{ fontSize: '0.75em', padding: '2px 6px', borderRadius: '10px', background: batteryInfo.isCharging ? 'rgba(46, 204, 113, 0.15)' : 'rgba(231, 76, 60, 0.15)', color: batteryInfo.isCharging ? '#2ecc71' : '#e74c3c', fontWeight: 'bold', fontFamily: "'Outfit', sans-serif" }}
                      title={`Host Server Battery: ${batteryInfo.percent}% (${batteryInfo.status})`}
                    >
                      {batteryInfo.isCharging ? '⚡' : '🔋'} {batteryInfo.percent}%
                    </span>
                  )}
                </div>
                <span className="brand-subtext">Main Lobby</span>
              </div>
            )}
          </div>

          <div className="sub-sidebar-content" style={{ overflowY: 'auto' }}>
            {activeTab === 'servers' && !selectedServer && (
              <div className="lobby-menu" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <h4 style={{ margin: '0 0 10px 0', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '1px' }}>Your Servers</h4>
                  {servers.length === 0 ? (
                    <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem', padding: '10px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px' }}>No servers joined yet. Tap the 🧭 Discover icon to explore public servers, or tap the ➕ icon to create your own.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {servers.map(srv => (
                        <div 
                          key={srv.id}
                          onClick={() => { setSelectedServer(srv); setSelectedDM(null); setActiveTab('servers'); setViewingFriends(false); }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '10px 12px',
                            borderRadius: '8px',
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.05)',
                            cursor: 'pointer',
                            transition: 'background 0.2s'
                          }}
                        >
                          <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            background: '#5865f2',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 'bold',
                            color: '#fff',
                            fontSize: '0.9rem'
                          }}>
                            {srv.name.substring(0, 2).toUpperCase()}
                          </div>
                          <span style={{ fontWeight: '600', color: '#fff', fontSize: '0.95rem' }}>{srv.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ marginTop: '8px' }}>
                  <h4 style={{ margin: '0 0 10px 0', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '1px' }}>Quick Actions</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div 
                      onClick={() => { setActiveTab('dms'); setSelectedServer(null); setSelectedDM(null); setViewingFriends(true); }}
                      style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: '8px', background: 'rgba(88, 101, 242, 0.1)', border: '1px solid rgba(88, 101, 242, 0.2)', cursor: 'pointer' }}
                    >
                      <span style={{ fontSize: '1.1rem' }}>💬</span>
                      <span style={{ fontWeight: '600', color: '#fff', fontSize: '0.9rem' }}>Direct Messages / Friends</span>
                    </div>

                    <div 
                      onClick={() => { setActiveTab('discovery'); setSelectedServer(null); setSelectedDM(null); setViewingFriends(false); }}
                      style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: '8px', background: 'rgba(0, 255, 255, 0.05)', border: '1px solid rgba(0, 255, 255, 0.15)', cursor: 'pointer' }}
                    >
                      <span style={{ fontSize: '1.1rem' }}>🧭</span>
                      <span style={{ fontWeight: '600', color: '#fff', fontSize: '0.9rem' }}>Discover Public Servers</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'dms' && (
              <DMList 
                onSelectDM={(dm) => { setSelectedDM(dm); setViewingFriends(false); }}
                selectedDM={selectedDM}
                currentUser={user}
                viewingFriends={viewingFriends}
                onShowFriends={() => { setViewingFriends(true); setSelectedDM(null); }}
              />
            )}

            {activeTab === 'discovery' && (
              <Discovery currentUser={user} />
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
              setViewingFriends(false);
            }}
            batteryInfo={batteryInfo}
            onBack={handleBack}
          />
        )}

        {selectedDM && (
          <DirectMessage 
            dmWith={selectedDM}
            currentUser={user}
            onOpenSettings={() => setShowSettingsModal(true)}
            onBack={handleBack}
          />
        )}



        {activeTab === 'dms' && !selectedDM && (
          <FriendsPanel 
            currentUser={user}
            onStartDM={(friend) => {
              setSelectedDM(friend);
              setViewingFriends(false);
            }}
            onBack={handleBack}
          />
        )}

        {activeTab !== 'dms' && !selectedServer && !selectedDM && (
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

      {showGlobalReportModal && (
        <div
          className="report-modal-overlay"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 9999,
            backdropFilter: 'blur(4px)',
          }}
          onClick={() => setShowGlobalReportModal(false)}
        >
          <div
            className="report-modal-content"
            style={{
              background: '#1e272e',
              border: '1px solid rgba(0, 255, 255, 0.2)',
              borderRadius: '12px',
              padding: '24px',
              width: '90%',
              maxWidth: '400px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
              color: '#fff',
              fontFamily: 'inherit',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px', color: '#ff4757' }}>
              🪲 Report App Bug / Glitch
            </h3>
            
            {bugSuccess ? (
              <div style={{ color: '#2ed573', textAlign: 'center', padding: '16px 0' }}>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>✓</div>
                Report submitted and evaluated by AI!
              </div>
            ) : (
              <form onSubmit={handleGlobalReportSubmit}>
                <p style={{ fontSize: '13px', color: '#a4b0be', margin: '0 0 16px 0' }}>
                  Describe the bug or system glitch you encountered. Our AI system will evaluate your report in real-time.
                </p>
                
                {bugError && (
                  <div style={{ background: 'rgba(255, 71, 87, 0.1)', border: '1px solid #ff4757', color: '#ff4757', borderRadius: '6px', padding: '8px 12px', fontSize: '12px', marginBottom: '12px' }}>
                    {bugError}
                  </div>
                )}

                <textarea
                  required
                  placeholder="Describe the issue (e.g., the chat app shows a 502 error when sending files)..."
                  value={bugDescription}
                  onChange={(e) => setBugDescription(e.target.value)}
                  style={{
                    width: '95%',
                    height: '100px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    padding: '12px',
                    color: '#fff',
                    fontSize: '14px',
                    resize: 'none',
                    outline: 'none',
                    marginBottom: '16px',
                  }}
                />

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setShowGlobalReportModal(false)}
                    style={{
                      background: 'rgba(255, 255, 255, 0.1)',
                      border: 'none',
                      color: '#fff',
                      padding: '8px 16px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '13px',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={bugSubmitting || !bugDescription.trim()}
                    style={{
                      background: '#ff4757',
                      border: 'none',
                      color: '#fff',
                      padding: '8px 16px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: 'bold',
                      opacity: bugSubmitting || !bugDescription.trim() ? 0.5 : 1,
                    }}
                  >
                    {bugSubmitting ? 'Submitting...' : 'Submit Report'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
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
      await axios.post('/api/servers', {
        name: formData.name,
        description: formData.description || '',
        password: formData.password || null,
        isPublic: formData.isPublic !== false
      });

      onServerCreated();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || err.message || 'Failed to create server');
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
      await axios.put('/api/users/profile', { avatarUrl });
      onUpdateAvatar(avatarUrl);
      setSuccess('Profile updated successfully!');
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to update profile');
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
