import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Logo from '../components/Logo';
import '../styles/ThermalsPage.css';

function ThermalsPage({ onBack }) {
  const [metrics, setMetrics] = useState({
    tempC: 45,
    rpm: 0,
    pwm: 0,
    speedPercent: 0,
    mode: 'auto',
    ramUsedGB: '1.0 GB',
    ramTotalGB: '24 GB',
    ramPercent: '4.5%',
    cpuLoad: '0.20',
    uptime: '18h 30m'
  });

  const [manualSpeed, setManualSpeed] = useState(50);
  const [history, setHistory] = useState(() => {
    const initial = [];
    const now = Date.now();
    for (let i = 20; i >= 0; i--) {
      initial.push({
        time: new Date(now - i * 2000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        tempC: 45 + Math.floor(Math.sin(i) * 3),
        rpm: 1200 + Math.floor(Math.cos(i) * 100),
        speedPercent: 40 + Math.floor(Math.sin(i) * 10),
        ramPercent: 4.5
      });
    }
    return initial;
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const canvasRef = useRef(null);

  const fetchThermalMetrics = async () => {
    try {
      const [fanRes, sysRes] = await Promise.all([
        axios.get('/api/system/fan'),
        axios.get('/api/system-status')
      ]);

      const fanData = fanRes.data || {};
      const sysData = sysRes.data || {};

      const newPoint = {
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        tempC: fanData.tempC || 45,
        rpm: fanData.rpm || 0,
        speedPercent: fanData.speedPercent || 0,
        ramPercent: parseFloat(sysData.memory?.usedPercent) || 4.5,
        cpuLoad: parseFloat(sysData.cpuLoadAverage?.['1min']) * 20 || 10
      };

      setMetrics({
        tempC: newPoint.tempC,
        rpm: newPoint.rpm,
        pwm: fanData.pwm || 0,
        speedPercent: newPoint.speedPercent,
        mode: fanData.mode || 'auto',
        ramUsedGB: sysData.memory?.usedGB || '1.0 GB',
        ramTotalGB: sysData.memory?.totalGB || '24 GB',
        ramPercent: sysData.memory?.usedPercent || '4.5%',
        cpuLoad: sysData.cpuLoadAverage?.['1min'] || '0.20',
        uptime: `${Math.floor((sysData.uptimeSeconds || 0) / 3600)}h ${Math.floor(((sysData.uptimeSeconds || 0) % 3600) / 60)}m`
      });

      setHistory(prev => [...prev.slice(-29), newPoint]);
    } catch (err) {
      console.error('Failed to fetch thermals:', err);
    }
  };

  useEffect(() => {
    fetchThermalMetrics();
    const interval = setInterval(fetchThermalMetrics, 2000);
    return () => clearInterval(interval);
  }, []);

  // Draw Animated Curve Line Chart
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || history.length < 2) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    // Draw Grid Lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    for (let y = 0; y <= height; y += height / 4) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    const stepX = width / (history.length - 1);

    // Draw Temperature Curve (Red/Orange Neon)
    drawCurve(ctx, history.map(h => h.tempC), stepX, height, '#ff4757', 'rgba(255, 71, 87, 0.2)', 0, 100);

    // Draw Fan Speed Curve (Cyan Neon)
    drawCurve(ctx, history.map(h => h.speedPercent), stepX, height, '#00ffff', 'rgba(0, 255, 255, 0.15)', 0, 100);

    // Draw RAM % Curve (Purple Neon)
    drawCurve(ctx, history.map(h => h.ramPercent), stepX, height, '#a55eea', 'rgba(165, 94, 234, 0.12)', 0, 100);

  }, [history]);

  const drawCurve = (ctx, data, stepX, height, color, fillColor, minVal, maxVal) => {
    if (data.length < 2) return;
    ctx.save();
    ctx.beginPath();

    const getY = (val) => {
      const normalized = Math.min(1, Math.max(0, (val - minVal) / (maxVal - minVal)));
      return height - (normalized * (height - 40) + 20);
    };

    ctx.moveTo(0, getY(data[0]));

    for (let i = 0; i < data.length - 1; i++) {
      const x0 = i * stepX;
      const y0 = getY(data[i]);
      const x1 = (i + 1) * stepX;
      const y1 = getY(data[i + 1]);
      const cpX = (x0 + x1) / 2;

      ctx.bezierCurveTo(cpX, y0, cpX, y1, x1, y1);
    }

    // Line Glow & Stroke
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.stroke();

    // Draw Glowing Data Points
    for (let i = 0; i < data.length; i++) {
      const x = i * stepX;
      const y = getY(data[i]);
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }

    // Area Fill
    ctx.lineTo((data.length - 1) * stepX, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();
    ctx.restore();
  };

  const handleSetFan = async (mode, speedPercent) => {
    try {
      setMessage('');
      setError('');
      const res = await axios.post('/api/system/fan/set', { mode, speedPercent });
      setMessage(res.data.message);
      fetchThermalMetrics();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to adjust fan speed');
    }
  };

  return (
    <div className="thermals-container">
      <div className="thermals-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {onBack && (
            <button className="btn-back" onClick={onBack} title="Back to App">
              ← Back
            </button>
          )}
          <Logo width={180} variant="full" />
        </div>
        <div style={{ textAlign: 'right' }}>
          <h2 style={{ margin: 0, fontSize: '1.4em', color: '#00ffff' }}>🔥 Dell Latitude Thermal & Hardware Dashboard</h2>
          <span style={{ fontSize: '0.8em', color: '#a4b0be' }}>Dell SMM Hardware Sensor & BIOS Controller</span>
        </div>
      </div>

      {message && <div className="thermal-alert success">{message}</div>}
      {error && <div className="thermal-alert error">{error}</div>}

      {/* Metrics Cards Grid */}
      <div className="thermals-grid">
        <div className="thermal-card highlight-red">
          <div className="card-label">CPU Temperature</div>
          <div className="card-val" style={{ color: metrics.tempC > 70 ? '#ff4757' : '#ffa502' }}>
            🌡️ {metrics.tempC} °C
          </div>
          <div className="card-sub">Intel Core i5-7300U</div>
        </div>

        <div className="thermal-card highlight-cyan">
          <div className="card-label">Fan Speed (RPM)</div>
          <div className="card-val" style={{ color: '#00ffff' }}>
            🌀 {metrics.rpm} RPM
          </div>
          <div className="card-sub">{metrics.mode === 'auto' ? 'AUTO (BIOS Controlled)' : `Manual (${metrics.speedPercent}%)`}</div>
        </div>

        <div className="thermal-card highlight-purple">
          <div className="card-label">RAM Memory Usage</div>
          <div className="card-val" style={{ color: '#a55eea' }}>
            🧠 {metrics.ramUsedGB} / {metrics.ramTotalGB}
          </div>
          <div className="card-sub">{metrics.ramPercent} Total RAM Used</div>
        </div>

        <div className="thermal-card highlight-green">
          <div className="card-label">System Uptime</div>
          <div className="card-val" style={{ color: '#2ed573' }}>
            ⏱️ {metrics.uptime}
          </div>
          <div className="card-sub">Dell Latitude 5290</div>
        </div>
      </div>

      {/* Real-time Animated Curve Chart */}
      <div className="chart-container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ margin: 0, color: '#fff', fontSize: '1.1em', display: 'flex', alignItems: 'center', gap: '8px' }}>
            📈 Live Real-time Thermal & Fan Curves (Updating every 2s)
          </h3>
          <div style={{ display: 'flex', gap: '16px', fontSize: '0.85em', fontWeight: 'bold' }}>
            <span style={{ color: '#ff4757' }}>● CPU Temp (°C)</span>
            <span style={{ color: '#00ffff' }}>● Fan Speed (%)</span>
            <span style={{ color: '#a55eea' }}>● RAM Usage (%)</span>
          </div>
        </div>

        <canvas ref={canvasRef} width={900} height={220} className="thermal-canvas" />
      </div>

      {/* Fan Controller Console */}
      <div className="fan-controller-box">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ margin: 0, color: '#00ffff', fontSize: '1.2em' }}>🌀 Hardware Fan Speed Controller</h3>
            <span style={{ fontSize: '0.85em', color: '#a4b0be' }}>Dell SMM Kernel Sysfs Interface (`/sys/class/hwmon`)</span>
          </div>
          <div style={{ fontSize: '1.2em', fontWeight: 'bold', color: metrics.mode === 'auto' ? '#2ed573' : '#ffa502' }}>
            {metrics.mode === 'auto' ? '🤖 Mode: AUTO (BIOS Managed)' : `🎛️ Mode: MANUAL (${metrics.speedPercent}%)`}
          </div>
        </div>

        <div className="fan-presets">
          <button 
            className={`btn-preset ${metrics.mode === 'auto' ? 'active-auto' : ''}`}
            onClick={() => handleSetFan('auto')}
          >
            🤖 AUTO FAN SPEED (BIOS Adaptive)
          </button>

          <button 
            className="btn-preset"
            onClick={() => handleSetFan('manual', 25)}
          >
            🤫 Quiet (25%)
          </button>

          <button 
            className="btn-preset"
            onClick={() => handleSetFan('manual', 50)}
          >
            ⚖️ Balanced (50%)
          </button>

          <button 
            className="btn-preset"
            onClick={() => handleSetFan('manual', 75)}
          >
            ❄️ Cool (75%)
          </button>

          <button 
            className="btn-preset max-btn"
            onClick={() => handleSetFan('manual', 100)}
          >
            🚀 Max Power (100%)
          </button>
        </div>

        <div className="slider-control">
          <span style={{ color: '#a4b0be', minWidth: '140px', fontSize: '0.9em' }}>Manual Speed ({manualSpeed}%):</span>
          <input 
            type="range" 
            min="0" 
            max="100" 
            value={manualSpeed}
            onChange={(e) => setManualSpeed(parseInt(e.target.value))}
            className="fan-slider"
          />
          <button 
            className="btn-apply"
            onClick={() => handleSetFan('manual', manualSpeed)}
          >
            Apply Speed
          </button>
        </div>
      </div>
    </div>
  );
}

export default ThermalsPage;
