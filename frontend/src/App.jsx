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

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
  const [showThermals, setShowThermals] = useState(window.location.pathname === '/thermals');
  const [loadingApp, setLoadingApp] = useState(true);

  useEffect(() => {
    const handlePopState = () => {
      setShowThermals(window.location.pathname === '/thermals');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
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

  return (
    <div className={`app ${currentUser ? 'dashboard-view' : 'public-view'}`}>
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
      ) : currentUser ? (
        <Dashboard 
          user={currentUser} 
          setUser={setCurrentUser} 
          onLogout={handleLogout} 
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
