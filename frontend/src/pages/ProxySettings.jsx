import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Logo from '../components/Logo';

export default function ProxySettings() {
  const [targetUrl, setTargetUrl] = useState('');
  const [testStatus, setTestStatus] = useState('idle'); // 'idle', 'testing', 'success', 'failed'
  const [testLatency, setTestLatency] = useState(null);
  const [testError, setTestError] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('custom_proxy_target');
    if (saved) {
      setTargetUrl(saved);
    }
  }, []);

  const handleSave = () => {
    if (targetUrl.trim() === '') {
      localStorage.removeItem('custom_proxy_target');
    } else {
      // Normalize URL (remove trailing slash)
      let normalized = targetUrl.trim();
      if (normalized.endsWith('/')) {
        normalized = normalized.slice(0, -1);
      }
      localStorage.setItem('custom_proxy_target', normalized);
    }
    alert('Proxy target configuration saved successfully! Reloading portal...');
    window.location.reload();
  };

  const handleReset = () => {
    localStorage.removeItem('custom_proxy_target');
    setTargetUrl('');
    alert('Reset to default Vercel proxy rewrite routing. Reloading portal...');
    window.location.reload();
  };

  const handleTestConnection = async () => {
    if (!targetUrl.trim()) {
      setTestStatus('failed');
      setTestError('Please enter a target URL to test');
      return;
    }

    setTestStatus('testing');
    setTestError('');
    setTestLatency(null);

    const startTime = Date.now();
    try {
      let testUrl = targetUrl.trim();
      if (testUrl.endsWith('/')) {
        testUrl = testUrl.slice(0, -1);
      }
      // Query system status
      const res = await axios.get(`${testUrl}/api/system/status`, { timeout: 5000 });
      if (res.data && res.data.status) {
        setTestStatus('success');
        setTestLatency(Date.now() - startTime);
      } else {
        throw new Error('Invalid status response format');
      }
    } catch (err) {
      setTestStatus('failed');
      setTestError(err.message || 'Connection timed out or failed CORS checks');
    }
  };

  const [proxyUrl, setProxyUrl] = useState('');
  const [proxyIframeSrc, setProxyIframeSrc] = useState('');

  const handleProxyFetch = () => {
    if (!proxyUrl.trim()) return;
    const baseUrl = localStorage.getItem('custom_proxy_target') || (import.meta.env.PROD ? '' : 'http://localhost:8000');
    let target = proxyUrl.trim();
    setProxyIframeSrc(`${baseUrl}/api/proxy?url=${encodeURIComponent(target)}`);
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      width: '100vw',
      background: '#040404',
      color: '#ffffff',
      fontFamily: "'Outfit', sans-serif",
      padding: '20px',
      boxSizing: 'border-box',
      position: 'relative',
      overflowX: 'hidden'
    }}>
      {/* Glow blobs */}
      <div style={{ position: 'absolute', top: '10%', left: '10%', width: '40vw', height: '40vw', borderRadius: '50%', background: 'radial-gradient(circle, rgba(138, 43, 226, 0.1) 0%, transparent 75%)', filter: 'blur(100px)', pointerEvents: 'none' }}></div>
      <div style={{ position: 'absolute', bottom: '10%', right: '10%', width: '45vw', height: '45vw', borderRadius: '50%', background: 'radial-gradient(circle, rgba(0, 255, 255, 0.08) 0%, transparent 75%)', filter: 'blur(120px)', pointerEvents: 'none' }}></div>

      <div style={{
        width: '100%',
        maxWidth: '680px',
        background: 'rgba(30, 30, 40, 0.4)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '24px',
        padding: '40px',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        zIndex: 1
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Logo width={40} height={40} />
          <div>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0 }}>wired-io</h1>
            <span style={{ color: '#00ffff', fontSize: '0.85rem', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>Sandbox Proxy Controller</span>
          </div>
        </div>

        <p style={{ margin: 0, color: '#a4b0be', fontSize: '0.95rem', lineHeight: '1.6' }}>
          Bypass production API paths by supplying a custom sandbox proxy URL. This is useful for testing local network backends or new Cloudflare Quick Tunnels without committing configuration updates.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#fff' }}>Sandbox Target Base URL</label>
          <input
            type="text"
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            placeholder="e.g. https://your-tunnel.trycloudflare.com or http://localhost:8000"
            style={{
              width: '100%',
              padding: '14px 18px',
              background: 'rgba(0, 0, 0, 0.3)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              color: '#fff',
              fontSize: '1rem',
              outline: 'none',
              transition: 'border-color 0.2s',
              boxSizing: 'border-box'
            }}
          />
        </div>

        {/* Quick Presets */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#a4b0be' }}>Presets</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            <button 
              onClick={() => setTargetUrl('http://localhost:8000')}
              style={{ padding: '8px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontSize: '0.85rem' }}
            >
              Local (Port 8000)
            </button>
            <button 
              onClick={() => setTargetUrl('http://192.168.1.27:8000')}
              style={{ padding: '8px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontSize: '0.85rem' }}
            >
              Server IP (192.168.1.27)
            </button>
            <button 
              onClick={() => setTargetUrl('')}
              style={{ padding: '8px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: '#ff4757', cursor: 'pointer', fontSize: '0.85rem' }}
            >
              Default (Vercel rewrite)
            </button>
          </div>
        </div>

        {/* Tester */}
        <div style={{
          background: 'rgba(0,0,0,0.2)',
          border: '1px solid rgba(255,255,255,0.05)',
          borderRadius: '16px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>Connectivity Diagnostics</span>
            <button
              onClick={handleTestConnection}
              style={{
                background: 'rgba(0, 255, 255, 0.1)',
                border: '1px solid rgba(0, 255, 255, 0.3)',
                color: '#00ffff',
                padding: '6px 14px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: 'bold'
              }}
            >
              {testStatus === 'testing' ? 'Testing...' : 'Test Route'}
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}>
            <span>Status:</span>
            {testStatus === 'idle' && <span style={{ color: '#a4b0be' }}>Ready to test</span>}
            {testStatus === 'testing' && <span style={{ color: '#ff9f43' }}>Sending ping...</span>}
            {testStatus === 'success' && (
              <span style={{ color: '#2ecc71', fontWeight: 'bold' }}>
                Online ({testLatency}ms latency)
              </span>
            )}
            {testStatus === 'failed' && (
              <span style={{ color: '#ff4757', fontWeight: 'bold' }}>
                Offline / CORS error
              </span>
            )}
          </div>
          {testError && (
            <div style={{ fontSize: '0.8rem', color: '#ff4757', wordBreak: 'break-all' }}>
              Error Details: {testError}
            </div>
          )}
        </div>

        {/* Web Proxy Sandbox */}
        <div style={{
          background: 'rgba(0,0,0,0.2)',
          border: '1px solid rgba(255,255,255,0.05)',
          borderRadius: '16px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <span style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>Web Proxy Sandbox</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={proxyUrl}
              onChange={(e) => setProxyUrl(e.target.value)}
              placeholder="Enter URL (e.g. https://news.ycombinator.com)"
              style={{
                flex: 1,
                padding: '10px 14px',
                background: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '0.9rem',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
            <button
              onClick={handleProxyFetch}
              style={{
                background: 'rgba(0, 255, 255, 0.1)',
                border: '1px solid rgba(0, 255, 255, 0.3)',
                color: '#00ffff',
                padding: '10px 16px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: 'bold'
              }}
            >
              Go
            </button>
          </div>
          {proxyIframeSrc && (
            <div style={{
              width: '100%',
              height: '350px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              overflow: 'hidden',
              background: '#fff'
            }}>
              <iframe
                src={proxyIframeSrc}
                title="Proxy Sandbox Output"
                style={{ width: '100%', height: '100%', border: 'none' }}
              />
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
          <button
            onClick={() => { window.history.pushState({}, '', '/'); window.location.reload(); }}
            style={{
              flex: 1,
              padding: '14px',
              background: 'rgba(255,255,255,0.05)',
              border: 'none',
              borderRadius: '12px',
              color: '#fff',
              fontWeight: 'bold',
              cursor: 'pointer',
              fontSize: '0.95rem'
            }}
          >
            Back to Portal
          </button>
          <button
            onClick={handleSave}
            style={{
              flex: 1,
              padding: '14px',
              background: 'linear-gradient(135deg, #8a2be2 0%, #00ffff 100%)',
              border: 'none',
              borderRadius: '12px',
              color: '#fff',
              fontWeight: 'bold',
              cursor: 'pointer',
              fontSize: '0.95rem',
              boxShadow: '0 4px 15px rgba(0, 255, 255, 0.2)'
            }}
          >
            Apply Target
          </button>
        </div>
      </div>
    </div>
  );
}
