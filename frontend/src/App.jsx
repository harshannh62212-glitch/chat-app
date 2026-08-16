import React, { useState, useEffect } from 'react';
import { loadCustomBannedWords } from './utils/contentFilter';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import SpotifyDashboard from './pages/SpotifyDashboard';
import GamesDashboard from './pages/GamesDashboard';
import YouTubeDashboard from './pages/YouTubeDashboard';
import LandingPage from './pages/LandingPage';
import axios from 'axios';
import './styles/App.css';

const fallbackURL = import.meta.env.VITE_RENDER_BACKEND_URL || 'https://chat-app-backend-render.onrender.com';

// Clear failover target on load so we always try the primary server first upon new session
if (localStorage.getItem('custom_proxy_target') === fallbackURL) {
  localStorage.removeItem('custom_proxy_target');
}

// In production (Vercel), use native same-origin API routes backed by Supabase
const savedProxyTarget = localStorage.getItem('custom_proxy_target');
axios.defaults.baseURL = savedProxyTarget || (import.meta.env.PROD ? '' : 'http://localhost:8000');
axios.defaults.headers.common['bypass-tunnel-reminder'] = 'true';

import ThermalsPage from './pages/ThermalsPage';
import AdminPanel from './components/AdminPanel';
import MinecraftPage from './pages/MinecraftPage';

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
  const [showThermals, setShowThermals] = useState(window.location.pathname === '/thermals');
  const [showModeration, setShowModeration] = useState(window.location.pathname === '/moderation');
  const [showMinecraft, setShowMinecraft] = useState(window.location.pathname === '/mc');
  const [loadingApp, setLoadingApp] = useState(true);
  const [moderationPassword, setModerationPassword] = useState('');
  const [moderationUnlocked, setModerationUnlocked] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [currentPortal, setCurrentPortal] = useState('chat');
  const [tunnelResolved, setTunnelResolved] = useState(!import.meta.env.PROD || !!localStorage.getItem('custom_proxy_target'));

  useEffect(() => {
    const handlePopState = () => {
      setShowThermals(window.location.pathname === '/thermals');
      setShowModeration(window.location.pathname === '/moderation');
      setShowMinecraft(window.location.pathname === '/mc');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (!showModeration) {
      setModerationUnlocked(false);
      setModerationPassword('');
      setPasswordError('');
    }
  }, [showModeration]);

  const [serverSleeping, setServerSleeping] = useState(false);
  const [batteryInfo, setBatteryInfo] = useState(null);

  useEffect(() => {
    if (!tunnelResolved) return;

    const checkSystemStatus = async () => {
      try {
        const res = await axios.get('/api/system/status');
        if (res.data) {
          if (res.data.status === 'sleeping') {
            setServerSleeping(true);
            localStorage.setItem('server_sleeping', 'true');
          } else {
            setServerSleeping(false);
            localStorage.setItem('server_sleeping', 'false');
          }
          if (res.data.battery) {
            setBatteryInfo(res.data.battery);
          }
        }
      } catch (err) {
        if (localStorage.getItem('server_sleeping') === 'true') {
          setServerSleeping(true);
        }
      }
    };
    checkSystemStatus();
    const interval = setInterval(checkSystemStatus, 10000);
    return () => clearInterval(interval);
  }, [tunnelResolved]);


  useEffect(() => {
    // Smart Multi-Cloud Load Balancer: tests cloud fleet -> Vercel edge -> Home server
    const resolveBestBackend = async () => {
      const saved = localStorage.getItem('custom_proxy_target');
      if (saved) {
        axios.defaults.baseURL = saved;
        return;
      }

      // Configure multi-cloud pool of free tiers
      const cloudBackends = [
        import.meta.env.VITE_KOYEB_BACKEND_URL,
        import.meta.env.VITE_FLY_BACKEND_URL,
        import.meta.env.VITE_RENDER_BACKEND_URL,
        'https://chat-app-backend-render.onrender.com'
      ].filter(Boolean);

      // Fast concurrent health ping utility
      const checkNodeHealth = async (url) => {
        if (!url || !url.startsWith('http')) return false;
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 1500);
          const res = await fetch(`${url}/ping`, {
            signal: controller.signal,
            headers: { 'bypass-tunnel-reminder': 'true' }
          });
          clearTimeout(timeout);
          return res.ok;
        } catch {
          return false;
        }
      };

      // 1. Check free cloud fleet first
      for (const nodeUrl of cloudBackends) {
        const isHealthy = await checkNodeHealth(nodeUrl);
        if (isHealthy) {
          console.log('[LOAD BALANCER] Connected to 24/7 Cloud Node:', nodeUrl);
          axios.defaults.baseURL = nodeUrl;
          return;
        }
      }

      // 2. Fetch home server tunnel from Supabase system_config
      let homeTunnel = '';
      try {
        let supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://aebntdjjniirnwthtwlx.supabase.co';
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlYm50ZGpqbmlpcm53dGh0d2x4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4NzIwNTYsImV4cCI6MjA5ODQ0ODA1Nn0.la5aH5b2Tb5cj5yfVEWHhPKU4_ieCWydEPWH8V81eIg';
        const res = await fetch(`${supabaseUrl}/rest/v1/system_config?key=eq.active_tunnel_url`, {
          headers: { 'apikey': supabaseAnonKey, 'Authorization': `Bearer ${supabaseAnonKey}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data[0]?.value) {
            homeTunnel = data[0].value;
          }
        }
      } catch (e) {
        console.warn('[LOAD BALANCER] Supabase lookup error:', e);
      }

      // 3. If Home Server is alive, use it
      if (homeTunnel && await checkNodeHealth(homeTunnel)) {
        console.log('[LOAD BALANCER] Connected to Bare-Metal Home Server:', homeTunnel);
        axios.defaults.baseURL = homeTunnel;
        return;
      }

      // 4. Default to Vercel Serverless Edge (always active same-origin)
      console.log('[LOAD BALANCER] Operating on Vercel Serverless Edge Cloud.');
      axios.defaults.baseURL = '';
    };

    resolveBestBackend().finally(() => {
      setTunnelResolved(true);
    });

    loadCustomBannedWords();
    
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (!tunnelResolved) return;

    // Load custom theme, typography, and letter spacing variables on mount
    const savedTheme = localStorage.getItem('theme') || 'cosmic-dark';
    const savedFont = localStorage.getItem('font') || 'Outfit';
    const savedSize = localStorage.getItem('font-size') || '15px';
    const savedSpacing = localStorage.getItem('letter-spacing') || 'normal';

    document.body.className = `theme-${savedTheme}`;
    document.documentElement.style.setProperty('--font-family', savedFont);
    document.documentElement.style.setProperty('--font-size', savedSize);
    document.documentElement.style.setProperty('--letter-spacing', savedSpacing);

    // Check stored JWT token
    const token = localStorage.getItem('chat_token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      axios.get('/api/auth/me')
        .then((res) => {
          setCurrentUser(res.data);
        })
        .catch(() => {
          localStorage.removeItem('chat_token');
          localStorage.removeItem('chat_user');
          delete axios.defaults.headers.common['Authorization'];
          setCurrentUser(null);
        })
        .finally(() => {
          setLoadingApp(false);
        });
    } else {
      setLoadingApp(false);
    }
  }, [tunnelResolved]);

  const handleLogin = (token, user) => {
    localStorage.setItem('chat_token', token);
    localStorage.setItem('chat_user', JSON.stringify(user));
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setCurrentUser(user);
  };

  const handleLogout = () => {
    localStorage.removeItem('chat_token');
    localStorage.removeItem('chat_user');
    delete axios.defaults.headers.common['Authorization'];
    setCurrentUser(null);
    setShowAuth(false);
  };

  if (loadingApp) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', width: '100vw', background: '#0f1015', color: '#00ffff', fontFamily: "'Outfit', sans-serif" }}>
        <div style={{ fontSize: '1.2em', fontWeight: 'bold', letterSpacing: '1px' }}>LOADING PORTAL...</div>
      </div>
    );
  }

  return (
    <div className={`app ${showThermals ? 'thermals-view' : showModeration ? 'moderation-view' : currentUser ? 'dashboard-view' : 'public-view'}`}>
      {serverSleeping && (
        <div style={{ background: '#ff9f43', color: '#000', padding: '10px', textAlign: 'center', fontWeight: 'bold', fontSize: '0.95em', fontFamily: "'Outfit', sans-serif", display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', zIndex: 9999, position: 'relative' }}>
          <span>💤</span>
          <span><strong>Notice:</strong> The host server has entered low-battery hibernation mode. Features are restricted until the server is powered back on.</span>
        </div>
      )}
      {!serverSleeping && batteryInfo && !batteryInfo.isCharging && (
        <div style={{ background: '#ee5253', color: '#fff', padding: '10px', textAlign: 'center', fontWeight: 'bold', fontSize: '0.95em', fontFamily: "'Outfit', sans-serif", display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', zIndex: 9999, position: 'relative' }}>
          <span>🔌</span>
          <span><strong>Notice:</strong> The host server is running on battery backup (Discharging: {batteryInfo.percent}%). It will automatically hibernate if battery drops under 20%.</span>
        </div>
      )}
      {currentUser && currentUser.is_banned ? (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', width: '100vw', background: '#0f1015', color: '#ff4757', textAlign: 'center', padding: '20px', fontFamily: "'Outfit', sans-serif" }}>
          <div className="welcome-island" style={{ maxWidth: '500px', padding: '40px', background: 'rgba(255, 71, 87, 0.04)', borderRadius: '24px', border: '1px solid rgba(255, 71, 87, 0.15)', boxShadow: '0 20px 50px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
            <h1 style={{ fontSize: '2.5em', fontWeight: '800', letterSpacing: '1px', margin: 0 }}>🚫 ACCESS DENIED</h1>
            <p style={{ fontSize: '1.1em', color: '#a4b0be', lineHeight: '1.6', margin: 0 }}>
              Your account has been globally banned from <strong>wired-io</strong> for violating community guidelines.
            </p>
            <button 
              onClick={handleLogout}
              style={{ marginTop: '10px', padding: '12px 28px', background: '#ff4757', color: '#fff', border: 'none', borderRadius: '30px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1em', boxShadow: '0 8px 20px rgba(255, 71, 87, 0.3)', transition: 'transform 0.2s' }}
              onMouseEnter={(e) => e.target.style.transform = 'scale(1.05)'}
              onMouseLeave={(e) => e.target.style.transform = 'none'}
            >
              Log Out
            </button>
          </div>
        </div>
      ) : showMinecraft ? (
        <MinecraftPage user={currentUser} onBack={() => { window.history.pushState({}, '', '/'); setShowMinecraft(false); }} />
      ) : showThermals ? (
        <ThermalsPage onBack={() => { window.history.pushState({}, '', '/'); setShowThermals(false); }} />
      ) : showModeration ? (
        currentUser && currentUser.is_admin ? (
          !moderationUnlocked ? (
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#0f1015', color: '#fff', fontFamily: "'Outfit', sans-serif" }}>
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  if (moderationPassword === 'Target143@') {
                    setModerationUnlocked(true);
                    setPasswordError('');
                  } else {
                    setPasswordError('Invalid key code. Access denied.');
                  }
                }}
                className="welcome-island" 
                style={{ width: '100%', maxWidth: '400px', padding: '40px', background: 'rgba(255,255,255,0.02)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.05)', boxShadow: '0 20px 50px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', gap: '20px' }}
              >
                <div style={{ textAlign: 'center' }}>
                  <span style={{ fontSize: '3em' }}>🛡️</span>
                  <h2 style={{ fontSize: '1.8em', margin: '10px 0 5px 0', fontWeight: '800' }}>Admin Gateway</h2>
                  <p style={{ color: '#a4b0be', fontSize: '0.9em', margin: 0 }}>Enter administrative authorization credentials.</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <input 
                    type="password" 
                    placeholder="Access Password" 
                    value={moderationPassword} 
                    onChange={(e) => setModerationPassword(e.target.value)}
                    style={{ width: '100%', padding: '14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', fontSize: '1em', outline: 'none' }}
                  />
                  {passwordError && <span style={{ color: '#ff4757', fontSize: '0.85em', fontWeight: 'bold' }}>{passwordError}</span>}
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button 
                    type="button"
                    onClick={() => { window.history.pushState({}, '', '/'); setShowModeration(false); }}
                    style={{ flex: 1, padding: '12px', background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    style={{ flex: 1, padding: '12px', background: '#5865f2', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    Unlock
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="moderation-page-container" style={{ padding: '20px', background: '#0f1015', minHeight: '100vh', color: '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '10px' }}>
                <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '1.8em', margin: 0 }}>🛡️ Global Moderation Panel</h1>
                <button 
                  onClick={() => { window.history.pushState({}, '', '/'); setShowModeration(false); }}
                  style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '6px', color: '#fff', cursor: 'pointer' }}
                >
                  Back to Portal
                </button>
              </div>
              <AdminPanel currentUser={currentUser} onSelectServer={(srv) => {
                window.history.pushState({}, '', '/');
                setShowModeration(false);
              }} />
            </div>
          )
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#0f1015', color: '#ff4757', textAlign: 'center', fontFamily: "'Outfit', sans-serif" }}>
            <h1>🚫 Access Denied</h1>
            <p style={{ color: '#a4b0be' }}>You must be logged in as an administrator to view this page.</p>
            <button onClick={() => { window.history.pushState({}, '', '/'); setShowModeration(false); }} style={{ marginTop: '20px', padding: '10px 20px', background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '6px', color: '#fff', cursor: 'pointer' }}>Back to Home</button>
          </div>
        )
      ) : currentUser ? (
        currentPortal === 'spotify' ? (
          <SpotifyDashboard 
            user={currentUser} 
            setUser={setCurrentUser} 
            onLogout={handleLogout} 
            onToggleToChat={() => setCurrentPortal('chat')}
            onToggleToYouTube={() => setCurrentPortal('youtube')}
            onToggleToGames={() => setCurrentPortal('games')}
          />
        ) : currentPortal === 'youtube' ? (
          <YouTubeDashboard
            user={currentUser}
            onLogout={handleLogout}
            onToggleToChat={() => setCurrentPortal('chat')}
            onToggleToSpotify={() => setCurrentPortal('spotify')}
            onToggleToGames={() => setCurrentPortal('games')}
          />
        ) : currentPortal === 'games' ? (
          <GamesDashboard
            user={currentUser}
            onLogout={handleLogout}
            onToggleToChat={() => setCurrentPortal('chat')}
            onToggleToSpotify={() => setCurrentPortal('spotify')}
            onToggleToYouTube={() => setCurrentPortal('youtube')}
          />
        ) : (
          <Dashboard 
            user={currentUser} 
            setUser={setCurrentUser} 
            onLogout={handleLogout} 
            batteryInfo={batteryInfo}
            onToggleToSpotify={() => setCurrentPortal('spotify')}
            onToggleToYouTube={() => setCurrentPortal('youtube')}
            onToggleToGames={() => setCurrentPortal('games')}
          />
        )
      ) : showAuth ? (
        <Auth onLogin={handleLogin} onBack={() => setShowAuth(false)} />
      ) : (
        <LandingPage onEnterPortal={() => setShowAuth(true)} />
      )}
    </div>
  );
}

export default App;
