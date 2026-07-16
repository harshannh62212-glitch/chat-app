import React, { useState } from 'react';
import { supabase } from '../supabase';
import { ensureGeneralServerAndMembership } from '../utils/generalServer';
import Logo from '../components/Logo';
import '../styles/Auth.css';

function Auth({ onLogin, onBack }) {
  const [isRegister, setIsRegister] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [acceptedTos, setAcceptedTos] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (isRegister && !acceptedTos) {
      setError('You must accept the Terms of Service to register.');
      setLoading(false);
      return;
    }

    const usernameTrimmed = formData.username.trim();
    const email = `${usernameTrimmed.toLowerCase().replace(/[^a-z0-9]/g, '')}@chat.com`;
    const password = formData.password;

    try {
      if (isRegister) {
        // Register via Supabase Auth
        const { data, error: authError } = await supabase.auth.signUp({
          email,
          password
        });

        if (authError) throw authError;
        if (!data.user) throw new Error('Registration failed');

        // Create Public Profile Doc
        const userData = {
          id: data.user.id,
          username: usernameTrimmed,
          email: email,
          is_admin: usernameTrimmed === 'Nxghtmare3621'
        };

        const { error: userError } = await supabase
          .from('users')
          .insert(userData);

        if (userError) throw userError;

        // Auto-heal / Ensure default "General" server exists and join it
        await ensureGeneralServerAndMembership(data.user.id, usernameTrimmed, '');

        const session = data.session || (await supabase.auth.getSession()).data.session;
        onLogin(session?.access_token || '', userData);
      } else {
        // Login via Supabase Auth
        const { data, error: authError } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (authError) throw authError;
        if (!data.user) throw new Error('Login failed');

        // Fetch public profile
        const { data: userProfiles, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('id', data.user.id);

        if (userError) throw userError;

        let userData = userProfiles?.[0];

        if (!userData) {
          // Auto-heal: profile doesn't exist in public.users, create it
          const newProfile = {
            id: data.user.id,
            username: data.user.email.split('@')[0],
            email: data.user.email,
            is_admin: data.user.email.split('@')[0] === 'Nxghtmare3621'
          };
          const { data: inserted, error: insertErr } = await supabase
            .from('users')
            .insert(newProfile)
            .select()
            .single();
          if (insertErr) throw insertErr;
          userData = inserted;
        }

        // Check if timed out
        if (userData.timeout_until) {
          const timeoutDate = new Date(userData.timeout_until);
          if (timeoutDate > new Date()) {
            throw new Error(`Your account is timed out until ${timeoutDate.toLocaleString()}`);
          }
        }

        // Check if banned
        if (userData.is_banned) {
          throw new Error('Your account has been globally banned');
        }

        // Auto-heal / Ensure default "General" server exists and join it
        await ensureGeneralServerAndMembership(data.user.id, userData.username, userData.avatar_url);

        const session = data.session || (await supabase.auth.getSession()).data.session;
        onLogin(session?.access_token || '', userData);
      }
    } catch (err) {
      console.error(err);
      let errMsg = err.message || 'Authentication failed';
      if (err.message?.includes('already registered')) {
        errMsg = 'Username already exists';
      } else if (err.message?.includes('Invalid login credentials')) {
        errMsg = 'Invalid credentials';
      }
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <div className="auth-brand" onClick={onBack} style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }} title="Back to landing page">
          <Logo width={220} variant="full" className="auth-logo" />
          <span className="auth-powered-by" style={{ marginTop: '4px' }}>powered by wired.inc</span>
        </div>
        
        <h2>{isRegister ? 'Create Account' : 'Portal Login'}</h2>
        
        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            name="username"
            placeholder="Username"
            value={formData.username}
            onChange={handleChange}
            required
          />
          <input
            type="password"
            name="password"
            placeholder="Password"
            value={formData.password}
            onChange={handleChange}
            required
          />

          {isRegister && (
            <div className="tos-container">
              <input
                type="checkbox"
                id="tos"
                checked={acceptedTos}
                onChange={(e) => setAcceptedTos(e.target.checked)}
                required
              />
              <label htmlFor="tos">
                I accept the <a href="#" className="tos-link" onClick={(e) => { e.preventDefault(); alert("Terms of Service:\n1. Be respectful to others.\n2. Do not spam or bypass rate limits.\n3. Content moderation policies apply."); }}>Terms of Service</a>
              </label>
            </div>
          )}

          <button type="submit" disabled={loading}>
            {loading ? 'Loading...' : (isRegister ? 'Register & Enter' : 'Authenticate')}
          </button>
        </form>

        <p className="toggle-auth">
          {isRegister ? 'Already registered?' : "Need a new account?"} {' '}
          <button 
            type="button" 
            onClick={() => {
              setIsRegister(!isRegister);
              setError('');
              setAcceptedTos(false);
              setFormData({ username: '', password: '' });
            }}
          >
            {isRegister ? 'Login here' : 'Register here'}
          </button>
        </p>

        <div className="back-to-home" style={{ marginTop: '20px', textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px' }}>
          <button 
            type="button" 
            className="back-btn" 
            onClick={onBack}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(255, 255, 255, 0.4)',
              cursor: 'pointer',
              fontSize: '0.85em',
              fontWeight: '500',
              transition: 'color 0.2s',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
            onMouseEnter={(e) => e.target.style.color = '#00ffff'}
            onMouseLeave={(e) => e.target.style.color = 'rgba(255, 255, 255, 0.4)'}
          >
            ← Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}

export default Auth;
