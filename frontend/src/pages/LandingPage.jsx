import React, { useState } from 'react';
import Logo from '../components/Logo';
import axios from 'axios';
import '../styles/LandingPage.css';

function LandingPage({ onEnterPortal }) {
  const [showPublicReportModal, setShowPublicReportModal] = useState(false);
  const [bugDescription, setBugDescription] = useState('');
  const [bugSubmitting, setBugSubmitting] = useState(false);
  const [bugMessage, setBugMessage] = useState('');
  const [bugError, setBugError] = useState('');

  const handleFeatureClick = () => {
    onEnterPortal();
  };

  const handlePublicReportSubmit = async (e) => {
    e.preventDefault();
    if (!bugDescription.trim()) return;

    setBugSubmitting(true);
    setBugMessage('');
    setBugError('');

    try {
      const res = await axios.post('/api/public-report', {
        description: bugDescription
      });
      setBugMessage(res.data.message || 'Thank you! Your report has been submitted.');
      setBugDescription('');
      setTimeout(() => {
        setShowPublicReportModal(false);
        setBugMessage('');
      }, 2500);
    } catch (err) {
      setBugError(err.response?.data?.error || 'Failed to submit report. Please try again.');
    } finally {
      setBugSubmitting(false);
    }
  };

  return (
    <div className="landing-container">
      {/* Background blobs for premium glow style */}
      <div className="landing-glow-blob-1"></div>
      <div className="landing-glow-blob-2"></div>

      {/* Navigation */}
      <nav className="landing-nav">
        <div className="landing-nav-brand" onClick={onEnterPortal}>
          <Logo width={34} height={34} />
          <h1>wired-io</h1>
        </div>
        <div className="landing-nav-links">
          <a href="#features" className="landing-nav-link">Features</a>
          <a href="#technology" className="landing-nav-link">Technology</a>
          <a href="/thermals" className="landing-nav-link" style={{ color: '#00ffff', fontWeight: 'bold' }}>🔥 Hardware Thermals</a>
          <button className="landing-nav-btn" onClick={onEnterPortal}>Launch Portal</button>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="landing-hero">
        <div className="hero-tag">
          <span className="dot"></span>
          NEW: cosmic customization active
        </div>
        <h2>
          Where teams connect.
          <span className="gradient-text">And music streams.</span>
        </h2>
        <p className="hero-subtitle">
          The ultimate real-time workspace for modern teams and developers, now featuring integrated Spotify-style playback. Express yourself with GIFs, stream music, and customize your experience.
        </p>

        <div className="hero-ctas">
          <button className="btn-primary" onClick={onEnterPortal}>Launch Portal</button>
          <a href="#features" className="btn-secondary" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            Explore Features
          </a>
        </div>

        {/* Dynamic App Preview Mockup */}
        <div className="landing-preview-container">
          <div className="landing-preview-shadow"></div>
          <div className="landing-preview-card">
            <div className="preview-bar">
              <div className="preview-dots">
                <span className="preview-dot red"></span>
                <span className="preview-dot yellow"></span>
                <span className="preview-dot green"></span>
              </div>
              <div className="preview-title">wired-io — chat & music workspace</div>
              <div style={{ width: '40px' }}></div>
            </div>
            <img 
              src="/wired_io_hero.png" 
              alt="wired-io chat workspace interface preview" 
              className="preview-img" 
            />
          </div>
        </div>
      </header>

      {/* Metrics Section */}
      <section className="landing-metrics">
        <div className="metric-card">
          <div className="metric-num">Sub-10ms</div>
          <div className="metric-label">Message Latency</div>
        </div>
        <div className="metric-card">
          <div className="metric-num">Millions</div>
          <div className="metric-label">Songs Available</div>
        </div>
        <div className="metric-card">
          <div className="metric-num">100%</div>
          <div className="metric-label">Secure Data Layers</div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="landing-features">
        <h3>Designed for high-speed collaboration</h3>
        <p className="section-desc">Experience a workspace built from the ground up to support rich text, interactive media, and powerful moderation.</p>
        
        <div className="features-grid">
          <div className="feature-card" onClick={handleFeatureClick} style={{ cursor: 'pointer' }}>
            <div className="feature-icon-wrapper">💬</div>
            <h4>Real-time Chat & Servers</h4>
            <p>Create Discord-style community servers, voice & video channels, rich markdown DMs, and real-time typing indicators.</p>
          </div>

          <div className="feature-card" onClick={handleFeatureClick} style={{ cursor: 'pointer' }}>
            <div className="feature-icon-wrapper">🎵</div>
            <h4>WiredMusic Streaming</h4>
            <p>Stream millions of songs in high quality, create custom playlists, search global charts, and listen uninterrupted in the background.</p>
          </div>

          <div className="feature-card" onClick={handleFeatureClick} style={{ cursor: 'pointer' }}>
            <div className="feature-icon-wrapper">▶️</div>
            <h4>WiredTube Video Portal</h4>
            <p>Watch trending videos, music videos, podcasts, and gaming streams with distraction-free cinema mode and instant URL playback.</p>
          </div>

          <div className="feature-card" onClick={handleFeatureClick} style={{ cursor: 'pointer' }}>
            <div className="feature-icon-wrapper">🎮</div>
            <h4>Wired Arcade (150+ Games)</h4>
            <p>Play 150+ full-screen self-hosted web games including 1v1.lol, FNAF, Subway Surfers, 2048, and 10 retro canvas arcade classics.</p>
          </div>

          <div className="feature-card" onClick={handleFeatureClick} style={{ cursor: 'pointer' }}>
            <div className="feature-icon-wrapper">🎬</div>
            <h4>GIF & Reaction Suite</h4>
            <p>Search and send trending animations instantly with our native Giphy integration, emoji reactions, and message threads.</p>
          </div>

          <div className="feature-card" onClick={handleFeatureClick} style={{ cursor: 'pointer' }}>
            <div className="feature-icon-wrapper">🛡️</div>
            <h4>AI-Powered Moderation</h4>
            <p>Keep communities safe with automated content evaluation, active word filtering, spam detection, and instant server controls.</p>
          </div>
        </div>
      </section>

      {/* Tech Stack Overview */}
      <section id="technology" className="landing-tech">
        <h3>Engineered with a modern stack</h3>
        <p className="tech-subtitle">Built using cutting-edge technologies to guarantee real-time updates and lightning-fast loading speeds.</p>
        
        <div className="tech-badges">
          <div className="tech-badge">
            <span className="tech-icon">⚛️</span>
            <span>React Framework</span>
          </div>
          <div className="tech-badge">
            <span className="tech-icon">⚡</span>
            <span>Vite Bundler</span>
          </div>
          <div className="tech-badge">
            <span className="tech-icon">🎵</span>
            <span>iTunes & YT Streaming</span>
          </div>
          <div className="tech-badge">
            <span className="tech-icon">🛠️</span>
            <span>PostgreSQL Relational DB</span>
          </div>
          <div className="tech-badge">
            <span className="tech-icon">🎨</span>
            <span>Vanilla CSS Glows</span>
          </div>
        </div>
      </section>

      {/* Non-Logged In Users Section */}
      <section className="landing-nonlogged-section" style={{ padding: '80px 20px', background: 'rgba(255,255,255,0.01)', borderTop: '1px solid rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.04)', textAlign: 'center' }}>
        <h3 style={{ fontSize: '24px', letterSpacing: '2px', color: '#ff4757', margin: 0, fontWeight: 'bold' }}>NON-LOGGED IN USERS</h3>
        <p className="section-desc" style={{ maxWidth: '600px', margin: '16px auto 32px', color: 'rgba(255,255,255,0.6)', fontSize: '15px', lineHeight: '1.6' }}>
          Encountered a bug or system glitch before launching the portal? Submit a public report. Our AI engine evaluates all submissions in real-time and discards casual chatter immediately.
        </p>
        <button 
          className="btn-primary" 
          onClick={() => setShowPublicReportModal(true)}
          style={{ background: '#ff4757', border: 'none', padding: '14px 32px', fontSize: '14px', borderRadius: '30px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 20px rgba(255, 71, 87, 0.3)' }}
        >
          🪲 Submit Public Bug Report
        </button>
      </section>

      {/* CTA Showcase Banner */}
      <section className="landing-cta-banner" id="about">
        <div className="cta-banner-content">
          <h3>Ready to upgrade your workspace?</h3>
          <p>Join the next generation of real-time messaging. Start channels, send private messages, and customize your view in seconds.</p>
          <button className="btn-primary" onClick={onEnterPortal}>Enter Portal Now</button>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-top">
          <div className="footer-brand">
            <Logo width={28} height={28} />
            <span>wired-io</span>
          </div>
          <div className="footer-socials">
            <a href="#" className="social-link" onClick={(e) => e.preventDefault()}>Twitter</a>
            <a href="#" className="social-link" onClick={(e) => e.preventDefault()}>GitHub</a>
            <a href="#" className="social-link" onClick={(e) => e.preventDefault()}>Discord</a>
          </div>
        </div>
        <div className="footer-bottom">
          <div>&copy; 2026 wired.inc. All rights reserved.</div>
          <div className="footer-bottom-links">
            <a href="#" className="footer-bottom-link" onClick={(e) => { e.preventDefault(); alert("Wired Privacy Policy:\n1. Your chat logs are stored securely.\n2. We do not sell user metadata.\n3. Cookies are used strictly to maintain your session."); }}>Privacy Policy</a>
            <a href="#" className="footer-bottom-link" onClick={(e) => { e.preventDefault(); alert("Wired Terms:\n1. Respect community channels.\n2. Malicious automation is strictly prohibited.\n3. Content violates terms may be moderated."); }}>Terms of Service</a>
          </div>
        </div>
      </footer>

      {/* Public Report Modal */}
      {showPublicReportModal && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999
          }}
          onClick={() => setShowPublicReportModal(false)}
        >
          <div 
            style={{
              background: 'rgba(30, 30, 40, 0.95)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '16px',
              padding: '32px',
              width: '90%',
              maxWidth: '480px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
              color: '#fff',
              position: 'relative'
            }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 8px 0', fontSize: '20px', fontFamily: "'Outfit', sans-serif" }}>Submit Public Bug Report</h3>
            <p style={{ margin: '0 0 20px 0', color: 'rgba(255,255,255,0.6)', fontSize: '13px', lineHeight: '1.5' }}>
              Describe the bug or system glitch you encountered. Our AI system will evaluate your report in real-time. Casual chatter, greeting, or spam will be discarded immediately.
            </p>
            
            <form onSubmit={handlePublicReportSubmit}>
              <textarea 
                value={bugDescription}
                onChange={e => setBugDescription(e.target.value)}
                placeholder="Describe what happened, step-by-step..."
                required
                rows={5}
                style={{
                  width: '100%',
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  padding: '12px',
                  color: '#fff',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                  resize: 'none',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
              
              {bugMessage && (
                <div style={{ marginTop: '12px', color: '#2ecc71', fontSize: '13px', fontWeight: 'bold' }}>
                  {bugMessage}
                </div>
              )}
              {bugError && (
                <div style={{ marginTop: '12px', color: '#e74c3c', fontSize: '13px', fontWeight: 'bold' }}>
                  {bugError}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                <button 
                  type="button"
                  onClick={() => setShowPublicReportModal(false)}
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.2)',
                    color: '#fff',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '13px'
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
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    opacity: bugSubmitting || !bugDescription.trim() ? 0.5 : 1
                  }}
                >
                  {bugSubmitting ? 'Evaluating...' : 'Submit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default LandingPage;
