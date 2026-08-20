import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[CRITICAL UI ERROR CAUGHT BY BOUNDARY]', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    } else {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: this.props.inline ? '200px' : '100vh',
          background: '#0f1015',
          color: '#fff',
          fontFamily: "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          padding: '24px',
          textAlign: 'center'
        }}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(0, 255, 255, 0.2)',
            borderRadius: '20px',
            padding: '36px 32px',
            maxWidth: '500px',
            width: '100%',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(16px)'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>🛡️</div>
            <h2 style={{ fontSize: '1.6em', margin: '0 0 8px 0', color: '#00ffff' }}>
              {this.props.title || 'Component Recovered'}
            </h2>
            <p style={{ color: '#a4b0be', fontSize: '0.95em', margin: '0 0 24px 0', lineHeight: 1.5 }}>
              A rendering glitch was safely prevented from crashing your workspace. Your session and messages remain secure.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={this.handleReset}
                style={{
                  background: 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)',
                  border: 'none',
                  color: '#000',
                  padding: '12px 24px',
                  borderRadius: '10px',
                  fontWeight: 'bold',
                  fontSize: '0.95em',
                  cursor: 'pointer',
                  boxShadow: '0 4px 15px rgba(0, 242, 254, 0.3)'
                }}
              >
                🔄 Resume Workspace
              </button>
              <button
                onClick={() => {
                  window.history.pushState({}, '', '/');
                  window.location.reload();
                }}
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#fff',
                  padding: '12px 20px',
                  borderRadius: '10px',
                  fontWeight: '600',
                  fontSize: '0.95em',
                  cursor: 'pointer'
                }}
              >
                🏠 Return Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
