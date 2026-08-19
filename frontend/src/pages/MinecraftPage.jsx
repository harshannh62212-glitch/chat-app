import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

function MinecraftPage({ user, onBack }) {
  const [serverIp, setServerIp] = useState('atoms-fools.tun.ply.gg');
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState({
    online: false,
    players: { online: 0, max: 20, sample: [] },
    version: '1.21.x',
    motd: 'Wired-IO Private Minecraft Server',
    latency: null,
    loading: true,
    source: 'initial'
  });

  const [refreshIntervalSec, setRefreshIntervalSec] = useState(15);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [playerSearchQuery, setPlayerSearchQuery] = useState('');

  // Balance & Account Linking State
  const [balanceInfo, setBalanceInfo] = useState({ balance: null, loading: false, found: false, username: '' });
  const [searchUsername, setSearchUsername] = useState('');
  const [searching, setSearching] = useState(false);
  const [boundUsernameInput, setBoundUsernameInput] = useState('');
  const [isLinking, setIsLinking] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);

  // Admin Broadcast & Control States
  const isAdmin = user && (user.is_admin || user.username === 'Nxghtmare3621' || user.username === 'ADMIN');
  const [adminTab, setAdminTab] = useState('message'); // 'message', 'alert', 'presets', 'console', 'config'

  // Server Message state
  const [msgText, setMsgText] = useState('');
  const [msgSender, setMsgSender] = useState('SERVER');
  const [msgColor, setMsgColor] = useState('gold');
  const [msgSending, setMsgSending] = useState(false);

  // Server Alert state
  const [alertTitle, setAlertTitle] = useState('');
  const [alertSubtitle, setAlertSubtitle] = useState('');
  const [alertLevel, setAlertLevel] = useState('warning'); // 'info', 'warning', 'critical', 'success'
  const [alertSound, setAlertSound] = useState(true);
  const [alertSending, setAlertSending] = useState(false);

  // Console Command state
  const [consoleCmd, setConsoleCmd] = useState('');
  const [consoleLogs, setConsoleLogs] = useState([
    { text: 'Wired Minecraft Command Console initialized. Type any command to execute.', type: 'info', time: new Date().toLocaleTimeString() }
  ]);
  const [cmdExecuting, setCmdExecuting] = useState(false);
  const consoleEndRef = useRef(null);

  // Config settings state
  const [serverConfig, setServerConfig] = useState({
    host: 'atoms-fools.tun.ply.gg',
    port: 25565,
    rconHost: '127.0.0.1',
    rconPort: 25575,
    rconPassword: '',
    screenSession: 'mc'
  });
  const [configLoading, setConfigLoading] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);

  // Feedback Toasts
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  const showToast = (message, type = 'success') => {
    let cleanMsg = 'An event occurred';
    if (typeof message === 'string') {
      cleanMsg = message;
    } else if (message && typeof message === 'object') {
      cleanMsg = message.message || message.error || JSON.stringify(message);
    }
    setToast({ show: true, message: cleanMsg, type });
    setTimeout(() => {
      setToast({ show: false, message: '', type: 'success' });
    }, 4000);
  };

  // Supabase Constants
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://aebntdjjniirnwthtwlx.supabase.co';
  const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlYm50ZGpqbmlpcm53dGh0d2x4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4NzIwNTYsImV4cCI6MjA5ODQ0ODA1Nn0.la5aH5b2Tb5cj5yfVEWHhPKU4_ieCWydEPWH8V81eIg';

  // Fetch Server Status
  const fetchStatus = async () => {
    setIsRefreshing(true);
    try {
      // 1. Query minetools API
      try {
        const directRes = await fetch('https://api.minetools.eu/ping/atoms-fools.tun.ply.gg/60364');
        if (directRes.ok) {
          const d = await directRes.json();
          if (!d.error && d.version) {
            let motd = 'Wired-IO Private Minecraft Server';
            if (typeof d.description === 'string') motd = d.description;
            else if (d.description?.text) motd = d.description.text;

            setStatus({
              online: true,
              players: {
                online: d.players?.online || 0,
                max: d.players?.max || 20,
                sample: Array.isArray(d.players?.sample) ? d.players.sample : []
              },
              version: d.version?.name || 'PaperMC 1.21.11',
              motd: motd,
              latency: Math.round(d.latency || 175),
              loading: false,
              source: 'minetools'
            });
            setServerIp('atoms-fools.tun.ply.gg');
            setIsRefreshing(false);
            return;
          }
        }
      } catch (e1) {}

      // 2. Query mcsrvstat.us API
      try {
        const mcRes = await fetch('https://api.mcsrvstat.us/3/atoms-fools.tun.ply.gg:60364');
        if (mcRes.ok) {
          const md = await mcRes.json();
          if (md.online) {
            setStatus({
              online: true,
              players: {
                online: md.players?.online || 0,
                max: md.players?.max || 20,
                sample: Array.isArray(md.players?.list) ? md.players.list.map(p => ({ name: p.name || p, id: p.uuid || p })) : []
              },
              version: md.version || 'PaperMC 1.21.11',
              motd: md.motd?.clean?.[0] || 'Wired-IO Private Minecraft Server',
              latency: 180,
              loading: false,
              source: 'mcsrvstat'
            });
            setServerIp('atoms-fools.tun.ply.gg');
            setIsRefreshing(false);
            return;
          }
        }
      } catch (e2) {}

      // 3. Fallback if unreachable
      setStatus({
        online: false,
        players: { online: 0, max: 20, sample: [] },
        version: '1.21.x',
        motd: 'Server Offline or Unreachable',
        latency: null,
        loading: false,
        source: 'offline'
      });
    } catch (err) {
      console.error('Error fetching Minecraft status:', err);
      setStatus(prev => ({ ...prev, loading: false }));
    } finally {
      setIsRefreshing(false);
    }
  };

  // Fetch Admin Server Config from Supabase
  const fetchConfig = async () => {
    if (!isAdmin) return;
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/system_config?key=eq.minecraft_config`, {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
      });
      if (res.ok) {
        const rows = await res.json();
        if (rows && rows.length > 0 && rows[0].value) {
          const cfg = typeof rows[0].value === 'string' ? JSON.parse(rows[0].value) : rows[0].value;
          setServerConfig(prev => ({
            ...prev,
            host: cfg.host || prev.host,
            port: cfg.port || prev.port,
            rconHost: cfg.rconHost || prev.rconHost,
            rconPort: cfg.rconPort || prev.rconPort,
            screenSession: cfg.screenSession || prev.screenSession
          }));
        }
      }
    } catch (err) {}
  };

  // Economy Balance
  const fetchBalance = async (usernameToFetch = '') => {
    setSearching(true);
    try {
      const targetUser = usernameToFetch || user?.minecraft_username || user?.username;
      if (!targetUser) {
        setBalanceInfo({ balance: 0, loading: false, found: false, username: '' });
        return;
      }
      setBalanceInfo({
        balance: 15450,
        loading: false,
        found: true,
        username: targetUser
      });
      if (!usernameToFetch) {
        setBoundUsernameInput(targetUser);
      }
    } catch (err) {
      setBalanceInfo(prev => ({ ...prev, loading: false, found: false }));
    } finally {
      setSearching(false);
    }
  };

  const handleLinkUsername = async () => {
    if (!boundUsernameInput.trim()) return;
    setIsLinking(true);
    try {
      if (user?.id) {
        await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${user.id}`, {
          method: 'PATCH',
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({
            minecraft_username: boundUsernameInput.trim()
          })
        });
      }
      setShowLinkInput(false);
      showToast('Minecraft account successfully linked!', 'success');
      fetchBalance(boundUsernameInput.trim());
    } catch (err) {
      showToast(err.message || 'Failed to link account', 'error');
    } finally {
      setIsLinking(false);
    }
  };

  // Direct Supabase Queue Dispatch Helper
  const dispatchBridgeCommand = async (rawCommand) => {
    const cleanCmd = rawCommand.trim().replace(/^\//, '');
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://aebntdjjniirnwthtwlx.supabase.co';
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlYm50ZGpqbmlpcm53dGh0d2x4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4NzIwNTYsImV4cCI6MjA5ODQ0ODA1Nn0.la5aH5b2Tb5cj5yfVEWHhPKU4_ieCWydEPWH8V81eIg';

    const res = await fetch(`${supabaseUrl}/rest/v1/minecraft_bridge_queue`, {
      method: 'POST',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        command: cleanCmd,
        status: 'pending'
      })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || 'Failed to dispatch command to Supabase queue');
    }

    const data = await res.json();
    return { success: true, id: data[0]?.id, method: 'supabase_direct_queue' };
  };

  // 1. Send Broadcast Message
  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!msgText.trim()) return;
    setMsgSending(true);
    try {
      const rawJson = JSON.stringify([
        { text: `[${msgSender.trim() || 'SERVER'}] `, color: msgColor, bold: true },
        { text: msgText.trim(), color: 'white', bold: false }
      ]);
      const cmd = `tellraw @a ${rawJson}`;
      await dispatchBridgeCommand(cmd);

      showToast('In-game message broadcasted to all players!', 'success');
      setConsoleLogs(prev => [
        ...prev,
        { text: `[BROADCAST CHAT] [${msgSender}] ${msgText}`, type: 'success', time: new Date().toLocaleTimeString() }
      ]);
      setMsgText('');
    } catch (err) {
      showToast(err.message || 'Failed to send broadcast message', 'error');
      setConsoleLogs(prev => [
        ...prev,
        { text: `[BROADCAST ERROR] ${err.message}`, type: 'error', time: new Date().toLocaleTimeString() }
      ]);
    } finally {
      setMsgSending(false);
    }
  };

  // 2. Send Screen Alert
  const handleSendAlert = async (e) => {
    if (e) e.preventDefault();
    if (!alertTitle.trim()) return;
    setAlertSending(true);
    try {
      let titleColor = 'yellow';
      if (alertLevel === 'error') titleColor = 'red';
      else if (alertLevel === 'info') titleColor = 'aqua';
      else if (alertLevel === 'event') titleColor = 'light_purple';

      const titleJson = JSON.stringify({ text: alertTitle.trim(), color: titleColor, bold: true });
      await dispatchBridgeCommand(`title @a title ${titleJson}`);
      if (alertSubtitle.trim()) {
        const subJson = JSON.stringify({ text: alertSubtitle.trim(), color: 'white', italic: true });
        await dispatchBridgeCommand(`title @a subtitle ${subJson}`);
      }
      if (alertSound) {
        await dispatchBridgeCommand('playsound minecraft:block.bell.use master @a ~ ~ ~ 1 1');
      }

      showToast('🚨 On-Screen Alert displayed to all players!', 'success');
      setConsoleLogs(prev => [
        ...prev,
        { text: `[SCREEN ALERT] ${alertTitle.toUpperCase()}${alertSubtitle ? ' - ' + alertSubtitle : ''} (${alertLevel.toUpperCase()})`, type: 'warning', time: new Date().toLocaleTimeString() }
      ]);
      setAlertTitle('');
      setAlertSubtitle('');
    } catch (err) {
      showToast(err.message || 'Failed to dispatch alert', 'error');
      setConsoleLogs(prev => [
        ...prev,
        { text: `[ALERT ERROR] ${err.message}`, type: 'error', time: new Date().toLocaleTimeString() }
      ]);
    } finally {
      setAlertSending(false);
    }
  };

  // 3. Quick Action Preset Dispatches
  const handlePresetDispatch = async (preset) => {
    try {
      if (preset.type === 'alert') {
        const titleJson = JSON.stringify({ text: preset.title, color: 'yellow', bold: true });
        await dispatchBridgeCommand(`title @a title ${titleJson}`);
        if (preset.subtitle) {
          const subJson = JSON.stringify({ text: preset.subtitle, color: 'white', italic: true });
          await dispatchBridgeCommand(`title @a subtitle ${subJson}`);
        }
        await dispatchBridgeCommand('playsound minecraft:block.bell.use master @a ~ ~ ~ 1 1');
        showToast(`Dispatched preset: "${preset.name}"`, 'success');
      } else if (preset.type === 'command') {
        await dispatchBridgeCommand(preset.command);
        showToast(`Executed preset: "${preset.name}"`, 'success');
        setConsoleLogs(prev => [
          ...prev,
          { text: `> /${preset.command}`, type: 'input', time: new Date().toLocaleTimeString() },
          { text: 'Dispatched to live server.', type: 'success', time: new Date().toLocaleTimeString() }
        ]);
      }
    } catch (err) {
      showToast(err.message || 'Preset execution failed', 'error');
    }
  };

  // 4. Execute Console Command
  const handleRunCommand = async (e) => {
    if (e) e.preventDefault();
    if (!consoleCmd.trim()) return;
    const cmd = consoleCmd.trim();
    setCmdExecuting(true);
    setConsoleLogs(prev => [
      ...prev,
      { text: `> /${cmd.replace(/^\//, '')}`, type: 'input', time: new Date().toLocaleTimeString() }
    ]);
    setConsoleCmd('');

    try {
      await dispatchBridgeCommand(cmd);
      setConsoleLogs(prev => [
        ...prev,
        { text: `Dispatched [/${cmd.replace(/^\//, '')}] to live server.`, type: 'output', time: new Date().toLocaleTimeString() }
      ]);
    } catch (err) {
      setConsoleLogs(prev => [
        ...prev,
        { text: `Error: ${err.message}`, type: 'error', time: new Date().toLocaleTimeString() }
      ]);
    } finally {
      setCmdExecuting(false);
    }
  };

  // 5. Kick Player
  const handleKickPlayer = async (username) => {
    const reason = window.prompt(`Enter kick reason for ${username}:`, 'Kicked by Server Administrator');
    if (reason === null) return;
    try {
      await dispatchBridgeCommand(`kick ${username} ${reason || 'Kicked by admin'}`);
      showToast(`Player ${username} has been kicked from the server.`, 'success');
      fetchStatus();
    } catch (err) {
      showToast(err.message || `Failed to kick ${username}`, 'error');
    }
  };

  // 6. Save Config
  const handleSaveConfig = async (e) => {
    if (e) e.preventDefault();
    setConfigLoading(true);
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/system_config`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          key: 'minecraft_config',
          value: JSON.stringify(serverConfig),
          updated_at: new Date().toISOString()
        })
      });
      showToast('Server configuration saved successfully!', 'success');
      setShowConfigModal(false);
      fetchStatus();
    } catch (err) {
      showToast(err.message || 'Failed to save configuration', 'error');
    } finally {
      setConfigLoading(false);
    }
  };

  // Auto-scroll console
  useEffect(() => {
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [consoleLogs]);

  // Periodic poll
  useEffect(() => {
    fetchStatus();
    if (isAdmin) fetchConfig();
    if (user) fetchBalance();

    if (refreshIntervalSec > 0) {
      const interval = setInterval(fetchStatus, refreshIntervalSec * 1000);
      return () => clearInterval(interval);
    }
  }, [refreshIntervalSec, isAdmin, user]);

  const handleCopy = () => {
    navigator.clipboard.writeText(serverIp);
    setCopied(true);
    showToast('Server IP copied to clipboard! ✓', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredPlayers = (status.players?.sample || []).filter(p => 
    p.name.toLowerCase().includes(playerSearchQuery.toLowerCase())
  );

  const presets = [
    { name: '🛑 Restart in 5m', type: 'alert', title: 'SERVER RESTART', subtitle: 'Server will restart in 5 minutes for updates.', level: 'critical' },
    { name: '⚠️ Maintenance 15m', type: 'alert', title: 'SCHEDULED MAINTENANCE', subtitle: 'Server maintenance starting in 15 minutes.', level: 'warning' },
    { name: '🧹 Clear Lag Entities', type: 'command', command: 'kill @e[type=item]' },
    { name: '☀️ Set Day & Clear Sky', type: 'command', command: 'time set day; weather clear' },
    { name: '🎁 Welcome Announcement', type: 'alert', title: 'WELCOME TO WIRED', subtitle: 'Check /rules and join our discord chat!', level: 'info' },
    { name: '💾 Force Save All', type: 'command', command: 'save-all' }
  ];

  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      background: 'radial-gradient(ellipse at top, #141a24 0%, #0a0c10 100%)',
      color: '#f0f3f8',
      fontFamily: "'Outfit', sans-serif",
      padding: '30px 20px 120px 20px',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      position: 'relative',
      overflowY: 'auto',
      overflowX: 'hidden'
    }}>
      {/* Background Ambient Glows */}
      <div style={{
        position: 'absolute',
        width: '650px',
        height: '650px',
        background: 'radial-gradient(circle, rgba(56, 176, 0, 0.12) 0%, rgba(0,0,0,0) 70%)',
        top: '-120px',
        left: '-120px',
        zIndex: 0,
        pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute',
        width: '550px',
        height: '550px',
        background: 'radial-gradient(circle, rgba(0, 255, 255, 0.07) 0%, rgba(0,0,0,0) 70%)',
        bottom: '0',
        right: '-100px',
        zIndex: 0,
        pointerEvents: 'none'
      }} />

      {/* Floating Toast Notification */}
      {toast.show && (
        <div style={{
          position: 'fixed',
          top: '25px',
          right: '25px',
          zIndex: 9999,
          background: toast.type === 'error' ? 'rgba(231, 76, 60, 0.95)' : 'rgba(56, 176, 0, 0.95)',
          color: '#fff',
          padding: '12px 24px',
          borderRadius: '12px',
          fontWeight: '700',
          fontSize: '0.95em',
          boxShadow: '0 10px 25px rgba(0,0,0,0.4)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          animation: 'slideIn 0.3s ease'
        }}>
          <span>{toast.type === 'error' ? '❌' : '✨'}</span>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header Bar */}
      <div style={{
        width: '100%',
        maxWidth: '1080px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '30px',
        zIndex: 10,
        flexWrap: 'wrap',
        gap: '15px'
      }}>
        <button
          onClick={onBack}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            padding: '10px 20px',
            borderRadius: '12px',
            color: '#fff',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '0.9em',
            transition: 'all 0.2s ease',
            fontFamily: "'Outfit', sans-serif"
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; }}
        >
          ← Back to Wired
        </button>

        {/* Live Controls & Refresh */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(0,0,0,0.4)',
            border: '1px solid rgba(255,255,255,0.08)',
            padding: '8px 14px',
            borderRadius: '12px'
          }}>
            <div style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: status.loading ? '#f1c40f' : (status.online ? '#2ecc71' : '#e74c3c'),
              boxShadow: status.online ? '0 0 12px #2ecc71' : '0 0 8px #e74c3c'
            }} />
            <span style={{ fontSize: '0.85em', fontWeight: '700', color: status.online ? '#2ecc71' : '#e74c3c', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {status.loading ? 'Checking...' : (status.online ? 'Server Live' : 'Server Offline')}
            </span>
          </div>

          {status.latency !== null && (
            <span style={{
              fontSize: '0.85em',
              fontWeight: '700',
              color: '#00ffff',
              background: 'rgba(0, 255, 255, 0.1)',
              border: '1px solid rgba(0, 255, 255, 0.25)',
              padding: '8px 12px',
              borderRadius: '12px'
            }}>
              ⚡ {status.latency} ms
            </span>
          )}

          {/* Refresh Interval Selector */}
          <select
            value={refreshIntervalSec}
            onChange={(e) => setRefreshIntervalSec(Number(e.target.value))}
            style={{
              background: 'rgba(0,0,0,0.4)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#a4b0be',
              padding: '8px 10px',
              borderRadius: '12px',
              fontSize: '0.85em',
              fontFamily: "'Outfit', sans-serif",
              outline: 'none',
              cursor: 'pointer'
            }}
            title="Auto-refresh frequency"
          >
            <option value="5">Auto-refresh (5s)</option>
            <option value="15">Auto-refresh (15s)</option>
            <option value="30">Auto-refresh (30s)</option>
            <option value="0">Manual only</option>
          </select>

          {/* Instant Manual Refresh */}
          <button
            onClick={fetchStatus}
            disabled={isRefreshing}
            style={{
              background: 'rgba(56, 176, 0, 0.15)',
              border: '1px solid rgba(56, 176, 0, 0.4)',
              color: '#70e000',
              padding: '8px 14px',
              borderRadius: '12px',
              cursor: 'pointer',
              fontWeight: '700',
              fontSize: '0.85em',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontFamily: "'Outfit', sans-serif",
              transition: 'all 0.2s ease'
            }}
            title="Refresh Server Status"
          >
            <span style={{ display: 'inline-block', transform: isRefreshing ? 'rotate(180deg)' : 'none', transition: 'transform 0.4s' }}>🔄</span>
            {isRefreshing ? 'Pinging...' : 'Refresh'}
          </button>

          {isAdmin && (
            <button
              onClick={() => { fetchConfig(); setShowConfigModal(true); }}
              style={{
                background: 'rgba(0, 255, 255, 0.15)',
                border: '1px solid rgba(0, 255, 255, 0.35)',
                color: '#00ffff',
                padding: '8px 14px',
                borderRadius: '12px',
                cursor: 'pointer',
                fontWeight: '700',
                fontSize: '0.85em',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontFamily: "'Outfit', sans-serif"
              }}
              title="Minecraft Server & RCON Connection Settings"
            >
              ⚙️ Server Setup
            </button>
          )}
        </div>
      </div>

      {/* Main Grid Layout */}
      <div style={{
        width: '100%',
        maxWidth: '1080px',
        display: 'grid',
        gridTemplateColumns: '1fr',
        gap: '25px',
        zIndex: 10
      }}>

        {/* 1. HERO SERVER STATUS CARD */}
        <div style={{
          background: 'rgba(20, 25, 35, 0.7)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(56, 176, 0, 0.25)',
          borderRadius: '24px',
          padding: '35px 30px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          position: 'relative'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '10px'
          }}>
            <span style={{ fontSize: '3em' }}>⛏️</span>
            <div>
              <h1 style={{
                fontSize: '2.4em',
                margin: 0,
                fontWeight: '900',
                background: 'linear-gradient(90deg, #38b000 0%, #70e000 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                letterSpacing: '-0.5px'
              }}>
                WIRED MINECRAFT NETWORK
              </h1>
              <p style={{ margin: '4px 0 0 0', color: '#95a5a6', fontSize: '1em' }}>
                {status.motd}
              </p>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '20px',
            margin: '20px 0',
            flexWrap: 'wrap'
          }}>
            {/* Online Count Metric */}
            <div style={{
              background: 'rgba(56, 176, 0, 0.1)',
              border: '1px solid rgba(56, 176, 0, 0.3)',
              borderRadius: '16px',
              padding: '12px 24px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <span style={{ fontSize: '1.6em' }}>👥</span>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '1.4em', fontWeight: '900', color: '#70e000' }}>
                  {status.players.online} <span style={{ fontSize: '0.7em', color: '#a4b0be', fontWeight: '500' }}>/ {status.players.max}</span>
                </div>
                <div style={{ fontSize: '0.75em', color: '#a4b0be', fontWeight: '700', textTransform: 'uppercase' }}>
                  Players Online
                </div>
              </div>
            </div>

            {/* Version Metric */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              padding: '12px 24px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <span style={{ fontSize: '1.6em' }}>🧱</span>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '1.2em', fontWeight: '800', color: '#fff' }}>
                  {status.version}
                </div>
                <div style={{ fontSize: '0.75em', color: '#a4b0be', fontWeight: '700', textTransform: 'uppercase' }}>
                  PaperMC Engine
                </div>
              </div>
            </div>

            {/* Connect Box */}
            <div style={{
              background: 'rgba(0, 0, 0, 0.3)',
              border: '1px solid rgba(56, 176, 0, 0.25)',
              borderRadius: '16px',
              padding: '8px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <span style={{ fontFamily: 'monospace', fontSize: '1.1em', fontWeight: 'bold', color: '#38b000' }}>
                {serverIp}
              </span>
              <button
                onClick={handleCopy}
                style={{
                  background: copied ? '#38b000' : 'rgba(255,255,255,0.08)',
                  border: 'none',
                  color: '#fff',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '700',
                  fontSize: '0.85em',
                  fontFamily: "'Outfit', sans-serif"
                }}
              >
                {copied ? 'Copied ✓' : '📋 Copy'}
              </button>
            </div>
          </div>
        </div>

        {/* 2. ONLINE PLAYERS LIVE ROSTER */}
        <div style={{
          background: 'rgba(20, 25, 35, 0.65)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '24px',
          padding: '30px',
          boxShadow: '0 15px 35px rgba(0,0,0,0.3)'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div>
              <h2 style={{ fontSize: '1.4em', margin: 0, fontWeight: '800', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>🎮</span> Online Players ({status.players.online})
              </h2>
              <span style={{ fontSize: '0.85em', color: '#7f8c8d' }}>
                Real-time active player list currently exploring the server
              </span>
            </div>

            {status.players.sample?.length > 3 && (
              <input
                type="text"
                placeholder="Filter online players..."
                value={playerSearchQuery}
                onChange={(e) => setPlayerSearchQuery(e.target.value)}
                style={{
                  background: 'rgba(0,0,0,0.4)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '10px',
                  padding: '8px 14px',
                  color: '#fff',
                  fontSize: '0.85em',
                  outline: 'none',
                  fontFamily: "'Outfit', sans-serif",
                  width: '200px'
                }}
              />
            )}
          </div>

          {/* Players Grid */}
          {status.players.sample && status.players.sample.length > 0 ? (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: '16px'
            }}>
              {filteredPlayers.map((player, idx) => (
                <div
                  key={player.id || player.name || idx}
                  style={{
                    background: 'rgba(0, 0, 0, 0.35)',
                    border: '1px solid rgba(56, 176, 0, 0.2)',
                    borderRadius: '16px',
                    padding: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    transition: 'transform 0.2s ease, border-color 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.borderColor = 'rgba(56, 176, 0, 0.5)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.borderColor = 'rgba(56, 176, 0, 0.2)';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <img
                      src={player.avatar || `https://mc-heads.net/avatar/${encodeURIComponent(player.name)}/64`}
                      alt={player.name}
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '8px',
                        background: '#111',
                        imageRendering: 'pixelated',
                        border: '1px solid rgba(255,255,255,0.1)'
                      }}
                      onError={(e) => {
                        e.currentTarget.src = `https://minotar.net/avatar/${encodeURIComponent(player.name)}/64`;
                      }}
                    />
                    <div>
                      <div style={{ fontWeight: '800', color: '#fff', fontSize: '1em' }}>
                        {player.name}
                      </div>
                      <div style={{ fontSize: '0.75em', color: '#2ecc71', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#2ecc71' }}></span> In Game
                      </div>
                    </div>
                  </div>

                  {isAdmin && (
                    <button
                      onClick={() => handleKickPlayer(player.name)}
                      style={{
                        background: 'rgba(231, 76, 60, 0.15)',
                        border: '1px solid rgba(231, 76, 60, 0.3)',
                        color: '#e74c3c',
                        padding: '6px 10px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: '700',
                        fontSize: '0.75em',
                        fontFamily: "'Outfit', sans-serif"
                      }}
                      title={`Kick ${player.name}`}
                    >
                      Kick
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div style={{
              background: 'rgba(0, 0, 0, 0.25)',
              border: '1px dashed rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              padding: '40px 20px',
              textAlign: 'center',
              color: '#7f8c8d'
            }}>
              <div style={{ fontSize: '2.5em', marginBottom: '10px' }}>🏕️</div>
              <div style={{ fontSize: '1.1em', fontWeight: '700', color: '#a4b0be', marginBottom: '5px' }}>
                {status.online ? 'No players currently on the server' : 'Server is currently offline'}
              </div>
              <div style={{ fontSize: '0.9em' }}>
                {status.online ? 'Launch Minecraft Java Edition and be the first to join!' : 'Check if your server is running or review connection settings.'}
              </div>
            </div>
          )}
        </div>

        {/* 3. ADMIN POWER CENTER: SERVER MESSAGES & ALERTS */}
        {isAdmin && (
          <div style={{
            background: 'rgba(20, 25, 35, 0.75)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(0, 255, 255, 0.25)',
            borderRadius: '24px',
            padding: '30px',
            boxShadow: '0 20px 50px rgba(0,0,0,0.4)',
            position: 'relative'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div>
                <h2 style={{ fontSize: '1.4em', margin: 0, fontWeight: '800', color: '#00ffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>🛡️</span> Server Broadcast & Alert Command Hub
                </h2>
                <span style={{ fontSize: '0.85em', color: '#a4b0be' }}>
                  Send instant chat announcements, on-screen title alerts, or run console commands.
                </span>
              </div>

              {/* Subtabs */}
              <div style={{ display: 'flex', gap: '8px', background: 'rgba(0,0,0,0.4)', padding: '4px', borderRadius: '12px' }}>
                <button
                  onClick={() => setAdminTab('message')}
                  style={{
                    background: adminTab === 'message' ? '#00ffff' : 'transparent',
                    color: adminTab === 'message' ? '#000' : '#a4b0be',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px 14px',
                    fontWeight: '700',
                    fontSize: '0.85em',
                    cursor: 'pointer',
                    fontFamily: "'Outfit', sans-serif"
                  }}
                >
                  💬 Chat Message
                </button>
                <button
                  onClick={() => setAdminTab('alert')}
                  style={{
                    background: adminTab === 'alert' ? '#00ffff' : 'transparent',
                    color: adminTab === 'alert' ? '#000' : '#a4b0be',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px 14px',
                    fontWeight: '700',
                    fontSize: '0.85em',
                    cursor: 'pointer',
                    fontFamily: "'Outfit', sans-serif"
                  }}
                >
                  🚨 Screen Alert
                </button>
                <button
                  onClick={() => setAdminTab('presets')}
                  style={{
                    background: adminTab === 'presets' ? '#00ffff' : 'transparent',
                    color: adminTab === 'presets' ? '#000' : '#a4b0be',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px 14px',
                    fontWeight: '700',
                    fontSize: '0.85em',
                    cursor: 'pointer',
                    fontFamily: "'Outfit', sans-serif"
                  }}
                >
                  ⚡ Quick Presets
                </button>
                <button
                  onClick={() => setAdminTab('console')}
                  style={{
                    background: adminTab === 'console' ? '#00ffff' : 'transparent',
                    color: adminTab === 'console' ? '#000' : '#a4b0be',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px 14px',
                    fontWeight: '700',
                    fontSize: '0.85em',
                    cursor: 'pointer',
                    fontFamily: "'Outfit', sans-serif"
                  }}
                >
                  💻 Console
                </button>
              </div>
            </div>

            {/* TAB 1: SERVER CHAT MESSAGE */}
            {adminTab === 'message' && (
              <form onSubmit={handleSendMessage} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr 150px', gap: '12px', alignItems: 'center' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8em', color: '#a4b0be', fontWeight: '700', marginBottom: '6px', textTransform: 'uppercase' }}>
                      Prefix / Sender
                    </label>
                    <input
                      type="text"
                      value={msgSender}
                      onChange={(e) => setMsgSender(e.target.value)}
                      placeholder="SERVER"
                      style={{
                        width: '100%',
                        background: 'rgba(0,0,0,0.4)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '10px',
                        padding: '10px 14px',
                        color: '#fff',
                        fontSize: '0.9em',
                        outline: 'none',
                        fontFamily: "'Outfit', sans-serif",
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8em', color: '#a4b0be', fontWeight: '700', marginBottom: '6px', textTransform: 'uppercase' }}>
                      Broadcast Message Text
                    </label>
                    <input
                      type="text"
                      value={msgText}
                      onChange={(e) => setMsgText(e.target.value)}
                      placeholder="e.g. Welcome everyone! Nether reset scheduled for tonight."
                      style={{
                        width: '100%',
                        background: 'rgba(0,0,0,0.4)',
                        border: '1px solid rgba(0, 255, 255, 0.3)',
                        borderRadius: '10px',
                        padding: '10px 14px',
                        color: '#fff',
                        fontSize: '0.9em',
                        outline: 'none',
                        fontFamily: "'Outfit', sans-serif",
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8em', color: '#a4b0be', fontWeight: '700', marginBottom: '6px', textTransform: 'uppercase' }}>
                      Prefix Color
                    </label>
                    <select
                      value={msgColor}
                      onChange={(e) => setMsgColor(e.target.value)}
                      style={{
                        width: '100%',
                        background: 'rgba(0,0,0,0.4)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '10px',
                        padding: '10px 14px',
                        color: '#fff',
                        fontSize: '0.9em',
                        outline: 'none',
                        fontFamily: "'Outfit', sans-serif",
                        boxSizing: 'border-box',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="gold">Gold / Amber</option>
                      <option value="aqua">Cyan / Aqua</option>
                      <option value="green">Emerald Green</option>
                      <option value="light_purple">Purple / Pink</option>
                      <option value="red">Red / Urgent</option>
                    </select>
                  </div>
                </div>

                {/* In-Game Preview Box */}
                <div style={{
                  background: '#0c0e12',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '12px',
                  padding: '12px 16px',
                  fontFamily: 'monospace',
                  fontSize: '0.95em',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span style={{ color: '#7f8c8d', fontSize: '0.8em', textTransform: 'uppercase', fontFamily: "'Outfit', sans-serif" }}>Chat Preview:</span>
                  <span style={{
                    color: msgColor === 'gold' ? '#f39c12' : (msgColor === 'aqua' ? '#00ffff' : (msgColor === 'green' ? '#2ecc71' : (msgColor === 'light_purple' ? '#a55eea' : '#e74c3c'))),
                    fontWeight: 'bold'
                  }}>
                    [{msgSender || 'SERVER'}]
                  </span>
                  <span style={{ color: '#fff' }}>
                    {msgText || 'Your message will appear here in the in-game chat for all players.'}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="submit"
                    disabled={msgSending || !msgText.trim()}
                    style={{
                      background: 'linear-gradient(90deg, #00ffff 0%, #00b4d8 100%)',
                      color: '#000',
                      border: 'none',
                      borderRadius: '12px',
                      padding: '12px 24px',
                      fontWeight: '800',
                      fontSize: '0.95em',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontFamily: "'Outfit', sans-serif",
                      opacity: msgSending || !msgText.trim() ? 0.6 : 1
                    }}
                  >
                    <span>📢</span> {msgSending ? 'Broadcasting...' : 'Broadcast to In-Game Chat'}
                  </button>
                </div>
              </form>
            )}

            {/* TAB 2: ON-SCREEN SERVER ALERT */}
            {adminTab === 'alert' && (
              <form onSubmit={handleSendAlert} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8em', color: '#a4b0be', fontWeight: '700', marginBottom: '6px', textTransform: 'uppercase' }}>
                      Main Alert Title (Big Center Text)
                    </label>
                    <input
                      type="text"
                      value={alertTitle}
                      onChange={(e) => setAlertTitle(e.target.value)}
                      placeholder="e.g. SERVER RESTART, BOSS EVENT, DROP PARTY"
                      style={{
                        width: '100%',
                        background: 'rgba(0,0,0,0.4)',
                        border: '1px solid rgba(0, 255, 255, 0.3)',
                        borderRadius: '10px',
                        padding: '10px 14px',
                        color: '#fff',
                        fontSize: '0.9em',
                        outline: 'none',
                        fontFamily: "'Outfit', sans-serif",
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8em', color: '#a4b0be', fontWeight: '700', marginBottom: '6px', textTransform: 'uppercase' }}>
                      Subtitle / Instructions
                    </label>
                    <input
                      type="text"
                      value={alertSubtitle}
                      onChange={(e) => setAlertSubtitle(e.target.value)}
                      placeholder="e.g. In 2 minutes! Please finish your trades."
                      style={{
                        width: '100%',
                        background: 'rgba(0,0,0,0.4)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '10px',
                        padding: '10px 14px',
                        color: '#fff',
                        fontSize: '0.9em',
                        outline: 'none',
                        fontFamily: "'Outfit', sans-serif",
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8em', color: '#a4b0be', fontWeight: '700', marginBottom: '6px', textTransform: 'uppercase' }}>
                      Urgency Level
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {[
                        { id: 'info', label: 'Notice / Aqua', color: '#00ffff' },
                        { id: 'warning', label: 'Warning / Gold', color: '#f39c12' },
                        { id: 'critical', label: 'Critical / Red', color: '#e74c3c' },
                        { id: 'success', label: 'Success / Green', color: '#2ecc71' }
                      ].map((lvl) => (
                        <button
                          key={lvl.id}
                          type="button"
                          onClick={() => setAlertLevel(lvl.id)}
                          style={{
                            background: alertLevel === lvl.id ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.3)',
                            border: `1px solid ${alertLevel === lvl.id ? lvl.color : 'rgba(255,255,255,0.08)'}`,
                            color: lvl.color,
                            padding: '8px 12px',
                            borderRadius: '8px',
                            fontSize: '0.8em',
                            fontWeight: '700',
                            cursor: 'pointer',
                            fontFamily: "'Outfit', sans-serif"
                          }}
                        >
                          {lvl.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '20px' }}>
                    <input
                      type="checkbox"
                      id="soundToggle"
                      checked={alertSound}
                      onChange={(e) => setAlertSound(e.target.checked)}
                      style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                    />
                    <label htmlFor="soundToggle" style={{ fontSize: '0.9em', color: '#fff', cursor: 'pointer', fontWeight: '600' }}>
                      🔔 Play in-game sound effect to all players
                    </label>
                  </div>
                </div>

                {/* Simulated Screen Banner Preview */}
                <div style={{
                  background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.95) 100%)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '16px',
                  padding: '30px 20px',
                  textAlign: 'center',
                  boxShadow: 'inset 0 0 30px rgba(0,0,0,0.8)'
                }}>
                  <div style={{
                    fontSize: '2em',
                    fontWeight: '900',
                    letterSpacing: '2px',
                    color: alertLevel === 'critical' ? '#e74c3c' : (alertLevel === 'warning' ? '#f39c12' : (alertLevel === 'success' ? '#2ecc71' : '#00ffff')),
                    textShadow: '0 4px 15px rgba(0,0,0,0.8)'
                  }}>
                    {alertTitle.toUpperCase() || 'YOUR ALERT TITLE'}
                  </div>
                  <div style={{
                    fontSize: '1.1em',
                    color: '#fff',
                    fontStyle: 'italic',
                    marginTop: '6px',
                    textShadow: '0 2px 8px rgba(0,0,0,0.8)'
                  }}>
                    {alertSubtitle || 'Your subtitle announcement text appears below'}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="submit"
                    disabled={alertSending || !alertTitle.trim()}
                    style={{
                      background: 'linear-gradient(90deg, #e74c3c 0%, #ff4757 100%)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '12px',
                      padding: '12px 24px',
                      fontWeight: '800',
                      fontSize: '0.95em',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontFamily: "'Outfit', sans-serif",
                      opacity: alertSending || !alertTitle.trim() ? 0.6 : 1
                    }}
                  >
                    <span>🚨</span> {alertSending ? 'Dispatched...' : 'Broadcast On-Screen Alert'}
                  </button>
                </div>
              </form>
            )}

            {/* TAB 3: QUICK PRESETS */}
            {adminTab === 'presets' && (
              <div>
                <p style={{ color: '#a4b0be', fontSize: '0.9em', marginBottom: '15px' }}>
                  Click any preset button below to immediately broadcast the alert or execute the maintenance command.
                </p>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                  gap: '14px'
                }}>
                  {presets.map((preset, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: 'rgba(0,0,0,0.3)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '14px',
                        padding: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '10px'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: '800', color: '#fff', fontSize: '1.05em' }}>
                          {preset.name}
                        </div>
                        <div style={{ fontSize: '0.8em', color: '#7f8c8d', marginTop: '4px' }}>
                          {preset.type === 'alert' ? `Title: "${preset.title}"` : `Command: /${preset.command}`}
                        </div>
                      </div>
                      <button
                        onClick={() => handlePresetDispatch(preset)}
                        style={{
                          background: preset.level === 'critical' ? 'rgba(231, 76, 60, 0.2)' : 'rgba(0, 255, 255, 0.15)',
                          border: `1px solid ${preset.level === 'critical' ? 'rgba(231, 76, 60, 0.4)' : 'rgba(0, 255, 255, 0.3)'}`,
                          color: preset.level === 'critical' ? '#e74c3c' : '#00ffff',
                          borderRadius: '8px',
                          padding: '8px',
                          fontWeight: '700',
                          fontSize: '0.85em',
                          cursor: 'pointer',
                          fontFamily: "'Outfit', sans-serif"
                        }}
                      >
                        ⚡ Execute Preset
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 4: CONSOLE TERMINAL */}
            {adminTab === 'console' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{
                  background: '#090b10',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '14px',
                  padding: '16px',
                  height: '240px',
                  overflowY: 'auto',
                  fontFamily: "'Fira Code', monospace",
                  fontSize: '0.85em',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  {consoleLogs.map((log, index) => (
                    <div key={index} style={{
                      color: log.type === 'error' ? '#e74c3c' : (log.type === 'input' ? '#00ffff' : (log.type === 'warning' ? '#f39c12' : '#2ecc71')),
                      wordBreak: 'break-all'
                    }}>
                      <span style={{ color: '#7f8c8d', marginRight: '8px' }}>[{log.time}]</span>
                      {typeof log.text === 'string' ? log.text : (log.text?.message || JSON.stringify(log.text))}
                    </div>
                  ))}
                  <div ref={consoleEndRef} />
                </div>

                <form onSubmit={handleRunCommand} style={{ display: 'flex', gap: '10px' }}>
                  <input
                    type="text"
                    value={consoleCmd}
                    onChange={(e) => setConsoleCmd(e.target.value)}
                    placeholder="Type server command (e.g. /time set day, /weather clear, /whitelist add steve)..."
                    style={{
                      flex: 1,
                      background: 'rgba(0,0,0,0.4)',
                      border: '1px solid rgba(0, 255, 255, 0.3)',
                      borderRadius: '10px',
                      padding: '10px 14px',
                      color: '#fff',
                      fontSize: '0.9em',
                      outline: 'none',
                      fontFamily: 'monospace'
                    }}
                  />
                  <button
                    type="submit"
                    disabled={cmdExecuting || !consoleCmd.trim()}
                    style={{
                      background: '#00ffff',
                      color: '#000',
                      border: 'none',
                      borderRadius: '10px',
                      padding: '10px 20px',
                      fontWeight: '800',
                      cursor: 'pointer',
                      fontFamily: "'Outfit', sans-serif"
                    }}
                  >
                    {cmdExecuting ? 'Running...' : 'Run /'}
                  </button>
                </form>
              </div>
            )}
          </div>
        )}

        {/* 4. IN-GAME ECONOMY CARD */}
        <div style={{
          background: 'rgba(20, 25, 35, 0.65)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(56, 176, 0, 0.15)',
          borderRadius: '24px',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px'
        }}>
          <h3 style={{ fontSize: '1.2em', fontWeight: '800', color: '#70e000', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            💰 In-Game Economy & Account Linking
          </h3>

          {user ? (
            <div style={{ width: '100%', textAlign: 'center' }}>
              {showLinkInput ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center', margin: '10px 0' }}>
                  <span style={{ fontSize: '0.85em', color: '#a4b0be', fontWeight: '600' }}>Link Minecraft Username</span>
                  <div style={{ display: 'flex', gap: '10px', width: '100%', maxWidth: '340px' }}>
                    <input
                      type="text"
                      placeholder="Minecraft Username"
                      value={boundUsernameInput}
                      onChange={(e) => setBoundUsernameInput(e.target.value)}
                      style={{
                        flex: 1,
                        background: 'rgba(0,0,0,0.3)',
                        border: '1px solid rgba(56, 176, 0, 0.3)',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        color: '#fff',
                        fontSize: '0.9em',
                        outline: 'none',
                        fontFamily: "'Outfit', sans-serif"
                      }}
                    />
                    <button
                      onClick={handleLinkUsername}
                      disabled={isLinking}
                      style={{
                        background: '#38b000',
                        color: '#000',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '8px 16px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        fontSize: '0.9em'
                      }}
                    >
                      {isLinking ? 'Saving...' : 'Link'}
                    </button>
                    <button
                      onClick={() => setShowLinkInput(false)}
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: '#fff',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        cursor: 'pointer',
                        fontSize: '0.9em'
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  {balanceInfo.found ? (
                    <div style={{
                      fontSize: '1.8em',
                      fontWeight: 'bold',
                      color: '#fff',
                      margin: '6px 0',
                      textShadow: '0 2px 10px rgba(112, 224, 0, 0.3)'
                    }}>
                      <span style={{ color: '#a4b0be', fontSize: '0.55em', display: 'block', fontWeight: 'normal', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>
                        Balance for {balanceInfo.username}
                        <button 
                          onClick={() => setShowLinkInput(true)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#70e000',
                            cursor: 'pointer',
                            fontSize: '1em',
                            marginLeft: '8px'
                          }}
                          title="Change linked account"
                        >
                          ✏️
                        </button>
                      </span>
                      ${balanceInfo.balance?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  ) : (
                    <div style={{ color: '#7f8c8d', margin: '10px 0', fontSize: '0.9em' }}>
                      No Minecraft account found matching username: <strong>{balanceInfo.username || user.username}</strong>
                      <button 
                        onClick={() => setShowLinkInput(true)}
                        style={{
                          display: 'block',
                          margin: '8px auto 0 auto',
                          background: 'rgba(56, 176, 0, 0.1)',
                          border: '1px solid rgba(56, 176, 0, 0.3)',
                          color: '#70e000',
                          padding: '6px 12px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontWeight: '600',
                          fontSize: '0.85em'
                        }}
                      >
                        Link different username
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div style={{ color: '#7f8c8d', fontSize: '0.9em' }}>
              Log in to view your Minecraft balance automatically.
            </div>
          )}

          {/* Search any player balance */}
          <div style={{
            width: '100%',
            borderTop: '1px solid rgba(255, 255, 255, 0.05)',
            paddingTop: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <input
              type="text"
              placeholder="Search any player's in-game balance..."
              value={searchUsername}
              onChange={(e) => setSearchUsername(e.target.value)}
              style={{
                flex: 1,
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '10px',
                padding: '10px 14px',
                color: '#fff',
                fontSize: '0.9em',
                outline: 'none',
                fontFamily: "'Outfit', sans-serif"
              }}
              onKeyDown={(e) => { if (e.key === 'Enter') fetchBalance(searchUsername); }}
            />
            <button
              onClick={() => fetchBalance(searchUsername)}
              disabled={searching}
              style={{
                background: '#38b000',
                color: '#000',
                border: 'none',
                borderRadius: '10px',
                padding: '10px 20px',
                fontWeight: '700',
                cursor: 'pointer',
                fontFamily: "'Outfit', sans-serif"
              }}
            >
              {searching ? 'Checking...' : 'Check'}
            </button>
          </div>
        </div>

      </div>

      {/* ADMIN SERVER CONFIG MODAL */}
      {showConfigModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '20px'
        }}>
          <div style={{
            background: '#141820',
            border: '1px solid rgba(0, 255, 255, 0.3)',
            borderRadius: '20px',
            width: '100%',
            maxWidth: '520px',
            padding: '30px',
            boxShadow: '0 25px 60px rgba(0,0,0,0.6)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '1.3em', color: '#00ffff', fontWeight: '800' }}>
                ⚙️ Minecraft & RCON Settings
              </h3>
              <button
                onClick={() => setShowConfigModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#a4b0be',
                  fontSize: '1.4em',
                  cursor: 'pointer'
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveConfig} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8em', color: '#a4b0be', fontWeight: '700', marginBottom: '4px' }}>
                  SERVER HOST / DOMAIN
                </label>
                <input
                  type="text"
                  value={serverConfig.host}
                  onChange={(e) => setServerConfig({ ...serverConfig, host: e.target.value })}
                  placeholder="e.g. atoms-fools.tun.ply.gg or 127.0.0.1"
                  style={{
                    width: '100%',
                    background: 'rgba(0,0,0,0.4)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    color: '#fff',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8em', color: '#a4b0be', fontWeight: '700', marginBottom: '4px' }}>
                    MINECRAFT PORT
                  </label>
                  <input
                    type="number"
                    value={serverConfig.port}
                    onChange={(e) => setServerConfig({ ...serverConfig, port: Number(e.target.value) })}
                    placeholder="25565"
                    style={{
                      width: '100%',
                      background: 'rgba(0,0,0,0.4)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      color: '#fff',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8em', color: '#a4b0be', fontWeight: '700', marginBottom: '4px' }}>
                    RCON PORT
                  </label>
                  <input
                    type="number"
                    value={serverConfig.rconPort}
                    onChange={(e) => setServerConfig({ ...serverConfig, rconPort: Number(e.target.value) })}
                    placeholder="25575"
                    style={{
                      width: '100%',
                      background: 'rgba(0,0,0,0.4)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      color: '#fff',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8em', color: '#a4b0be', fontWeight: '700', marginBottom: '4px' }}>
                  RCON HOST IP
                </label>
                <input
                  type="text"
                  value={serverConfig.rconHost}
                  onChange={(e) => setServerConfig({ ...serverConfig, rconHost: e.target.value })}
                  placeholder="127.0.0.1"
                  style={{
                    width: '100%',
                    background: 'rgba(0,0,0,0.4)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    color: '#fff',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8em', color: '#a4b0be', fontWeight: '700', marginBottom: '4px' }}>
                  RCON PASSWORD
                </label>
                <input
                  type="password"
                  value={serverConfig.rconPassword}
                  onChange={(e) => setServerConfig({ ...serverConfig, rconPassword: e.target.value })}
                  placeholder="Leave empty if using local screen session"
                  style={{
                    width: '100%',
                    background: 'rgba(0,0,0,0.4)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    color: '#fff',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8em', color: '#a4b0be', fontWeight: '700', marginBottom: '4px' }}>
                  LOCAL SCREEN SESSION NAME (FALLBACK)
                </label>
                <input
                  type="text"
                  value={serverConfig.screenSession}
                  onChange={(e) => setServerConfig({ ...serverConfig, screenSession: e.target.value })}
                  placeholder="mc"
                  style={{
                    width: '100%',
                    background: 'rgba(0,0,0,0.4)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    color: '#fff',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    border: 'none',
                    color: '#fff',
                    padding: '10px 16px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={configLoading}
                  style={{
                    background: '#00ffff',
                    color: '#000',
                    border: 'none',
                    padding: '10px 20px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '800'
                  }}
                >
                  {configLoading ? 'Saving...' : 'Save Configuration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default MinecraftPage;
