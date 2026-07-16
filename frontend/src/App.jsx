import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { loadCustomBannedWords } from './utils/contentFilter';
import { ensureGeneralServerAndMembership } from './utils/generalServer';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import LandingPage from './pages/LandingPage';
import './styles/App.css';

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
    <div className="app">
      {currentUser ? (
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
