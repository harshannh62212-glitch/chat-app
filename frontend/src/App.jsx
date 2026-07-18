import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { loadCustomBannedWords } from './utils/contentFilter';
import { ensureGeneralServerAndMembership } from './utils/generalServer';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import LandingPage from './pages/LandingPage';
import axios from 'axios';
import './styles/App.css';

axios.defaults.baseURL = import.meta.env.PROD 
  ? (import.meta.env.VITE_API_URL || '') 
  : '';

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [showAuth, setShowAuth] = useState(false);

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

    let unsubUser = () => {};

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        axios.defaults.headers.common['Authorization'] = `Bearer ${session.access_token}`;
        unsubUser();
        const userId = session.user.id;
        
        // Initial fetch
        const { data: userProfiles, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', userId);
        
        let profile = userProfiles?.[0];

        if (!profile) {
          // Auto-create profile if missing (e.g. signed up manually via Supabase Dashboard)
          const newProfile = {
            id: userId,
            username: session.user.email.split('@')[0],
            email: session.user.email,
            is_admin: session.user.email.split('@')[0] === 'Nxghtmare3621'
          };
          const { data: inserted, error: insertErr } = await supabase
            .from('users')
            .insert(newProfile)
            .select()
            .single();
          if (!insertErr) {
            profile = inserted;
          }
        }
        
        if (profile) {
          await ensureGeneralServerAndMembership(userId, profile.username, profile.avatar_url);
          setCurrentUser({ id: userId, ...profile });
        }

        // Listen for updates on the current user profile
        const channel = supabase
          .channel(`user-profile-${userId}`)
          .on('postgres_changes', { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'users', 
            filter: `id=eq.${userId}` 
          }, (payload) => {
            setCurrentUser({ id: userId, ...payload.new });
          })
          .subscribe();

        unsubUser = () => {
          supabase.removeChannel(channel);
        };
      } else {
        unsubUser();
        setCurrentUser(null);
        delete axios.defaults.headers.common['Authorization'];
      }
    });

    return () => {
      subscription.unsubscribe();
      unsubUser();
    };
  }, []);

  const handleLogin = (token, user) => {
    setCurrentUser(user);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setShowAuth(false); // Reset to landing page on logout
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
