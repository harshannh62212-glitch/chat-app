import React, { useState } from 'react';
import axios from 'axios';
import Logo from '../components/Logo';
import { containsBannedWords } from '../utils/contentFilter';
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
    const password = formData.password;

    if (isRegister) {
      if (usernameTrimmed.length < 3) {
        setError('Username must be at least 3 characters long.');
        setLoading(false);
        return;
      }
      const { blocked } = containsBannedWords(usernameTrimmed);
      if (blocked) {
        setError('Username contains prohibited words or offensive content.');
        setLoading(false);
        return;
      }
    }

    try {
      if (isRegister) {
        const res = await axios.post('/api/auth/register', {
          username: usernameTrimmed,
          password
        });
        const { user, token } = res.data;
        onLogin(token, user);
      } else {
        const res = await axios.post('/api/auth/login', {
          username: usernameTrimmed,
          password
        });
        const { user, token } = res.data;
        onLogin(token, user);
      }
    } catch (err) {
      console.error(err);
      let errMsg = 'Authentication failed';
      const rawError = err.response?.data?.error || err.response?.data || err.message;
      if (rawError) {
        if (typeof rawError === 'object') {
          errMsg = rawError.message || rawError.error || JSON.stringify(rawError);
        } else {
          errMsg = String(rawError);
        }
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
