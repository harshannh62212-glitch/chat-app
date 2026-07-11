import React from 'react';
import Logo from '../components/Logo';
import '../styles/LandingPage.css';

function LandingPage({ onEnterPortal }) {
  const handleFeatureClick = () => {
    onEnterPortal();
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
          <a href="#about" className="landing-nav-link">About</a>
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
          <span className="gradient-text">Where ideas spark.</span>
        </h2>
        <p className="hero-subtitle">
          The ultimate real-time workspace for modern teams and developers. Express yourself with GIFs, personalize your theme, and moderate with advanced filters.
        </p>

        <div className="hero-ctas">
          <button className="btn-primary" onClick={onEnterPortal}>Launch App</button>
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
              <div className="preview-title">wired-io — main-lobby</div>
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
          <div className="metric-num">99.99%</div>
          <div className="metric-label">Uptime Guarantee</div>
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
            <h4>Real-time Channels</h4>
            <p>Create server rooms instantly for focused discussions, developer logs, and project check-ins with sub-second sync.</p>
          </div>

          <div className="feature-card" onClick={handleFeatureClick} style={{ cursor: 'pointer' }}>
            <div className="feature-icon-wrapper">🔒</div>
            <h4>Secure Direct Messages</h4>
            <p>Directly chat with team members in isolated private sessions, featuring instant status alerts and active indicators.</p>
          </div>

          <div className="feature-card" onClick={handleFeatureClick} style={{ cursor: 'pointer' }}>
            <div className="feature-icon-wrapper">🎬</div>
            <h4>GIF Panel Integration</h4>
            <p>Search and send trending animations instantly with our native Giphy system, bringing chats to life in real-time.</p>
          </div>

          <div className="feature-card" onClick={handleFeatureClick} style={{ cursor: 'pointer' }}>
            <div className="feature-icon-wrapper">✨</div>
            <h4>Cosmic Theme Customization</h4>
            <p>Personalize your experience by switching cosmic themes, adapting font selections, adjusting sizes, and spacing details.</p>
          </div>

          <div className="feature-card" onClick={handleFeatureClick} style={{ cursor: 'pointer' }}>
            <div className="feature-icon-wrapper">🛠️</div>
            <h4>Admin Control Panel</h4>
            <p>Power tools for workspace admins to enforce content filters, timeout users, ban abusers, and monitor channels.</p>
          </div>

          <div className="feature-card" onClick={handleFeatureClick} style={{ cursor: 'pointer' }}>
            <div className="feature-icon-wrapper">⚡</div>
            <h4>Automated Word Filtering</h4>
            <p>Maintain healthy workspaces by leveraging our dynamic content system to censor unwanted terms immediately.</p>
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
            <span className="tech-icon">⚡</span>
            <span>Supabase Backend</span>
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
    </div>
  );
}

export default LandingPage;
