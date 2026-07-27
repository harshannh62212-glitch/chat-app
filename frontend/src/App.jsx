import React, { useState, useEffect } from 'react';
import { loadCustomBannedWords } from './utils/contentFilter';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import LandingPage from './pages/LandingPage';
import axios from 'axios';
import './styles/App.css';

// In production (Vercel), always use same-origin proxy ('') so browser avoids CORS/Mixed Content errors
axios.defaults.baseURL = import.meta.env.PROD ? '' : 'http://localhost:8000';
axios.defaults.headers.common['bypass-tunnel-reminder'] = 'true';

import ThermalsPage from './pages/ThermalsPage';
import AdminPanel from './components/AdminPanel';

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
  const [showThermals, setShowThermals] = useState(window.location.pathname === '/thermals');
  const [showModeration, setShowModeration] = useState(window.location.pathname === '/moderation');
  const [loadingApp, setLoadingApp] = useState(true);
  const [moderationPassword, setModerationPassword] = useState('');
  const [moderationUnlocked, setModerationUnlocked] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    const handlePopState = () => {
      setShowThermals(window.location.pathname === '/thermals');
      setShowModeration(window.location.pathname === '/moderation');
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
  }, []);

  useEffect(() => {
    loadCustomBannedWords();
    
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
  }, []);

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
        <Dashboard 
          user={currentUser} 
          setUser={setCurrentUser} 
          onLogout={handleLogout} 
          batteryInfo={batteryInfo}
        />
      ) : showAuth ? (
        <Auth onLogin={handleLogin} onBack={() => setShowAuth(false)} />
      ) : (
        <LandingPage onEnterPortal={() => setShowAuth(true)} />
      )}
    </div>
  );
}

export default App;
