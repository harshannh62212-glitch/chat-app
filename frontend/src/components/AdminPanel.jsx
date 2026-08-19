import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { loadCustomBannedWords } from '../utils/contentFilter';

function AdminPanel({ currentUser, onSelectServer }) {
  const [activeSubTab, setActiveSubTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [servers, setServers] = useState([]);
  const [reports, setReports] = useState([]);
  const [words, setWords] = useState([]);
  const [newWord, setNewWord] = useState('');
  const [timeoutMinutes, setTimeoutMinutes] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [systemStatus, setSystemStatus] = useState(null);
  const [fanStatus, setFanStatus] = useState(null);
  const [manualSpeed, setManualSpeed] = useState(50);

  const [dbStats, setDbStats] = useState(null);
  const [selectedTable, setSelectedTable] = useState(null);
  const [tableRows, setTableRows] = useState(null);
  const [tableLoading, setTableLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, [activeSubTab]);

  const fetchFanStatus = async () => {
    try {
      const res = await axios.get('/api/system/fan');
      setFanStatus(res.data);
    } catch (err) {
      console.error('Failed to fetch fan status:', err);
    }
  };

  const handleSetFan = async (mode, speedPercent) => {
    try {
      const res = await axios.post('/api/system/fan/set', { mode, speedPercent });
      setMessage(res.data.message);
      fetchFanStatus();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to adjust fan speed');
    }
  };

  const handleDbAction = async (action) => {
    try {
      setMessage('');
      setError('');
      const res = await axios.post('/api/admin/database/action', { action });
      setMessage(res.data.message);
      const statsRes = await axios.get('/api/admin/database/stats');
      setDbStats(statsRes.data);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Database maintenance action failed');
    }
  };

  const handleInspectTable = async (tableName) => {
    try {
      setSelectedTable(tableName);
      setTableLoading(true);
      setTableRows(null);
      const res = await axios.get(`/api/admin/database/table/${tableName}`);
      setTableRows(res.data.rows || []);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to inspect table records');
    } finally {
      setTableLoading(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      if (activeSubTab === 'users') {
        const res = await axios.get('/api/admin/users');
        setUsers(res.data || []);
      } else if (activeSubTab === 'servers') {
        const res = await axios.get('/api/admin/servers');
        setServers(res.data || []);
      } else if (activeSubTab === 'words') {
        const res = await axios.get('/api/admin/banned-words');
        setWords((res.data || []).map(w => w.word || w));
      } else if (activeSubTab === 'reports') {
        const res = await axios.get('/api/admin/reports');
        setReports(res.data || []);
      } else if (activeSubTab === 'system') {
        const res = await axios.get('/api/system-status');
        setSystemStatus(res.data);
        fetchFanStatus();
      } else if (activeSubTab === 'database') {
        const res = await axios.get('/api/admin/database/stats');
        setDbStats(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to fetch administration data');
    } finally {
      setLoading(false);
    }
  };

  // User Actions
  const handleBanUser = async (userId) => {
    try {
      await axios.post(`/api/admin/users/${userId}/ban`);
      setMessage('User banned globally');
      fetchData();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to ban user');
    }
  };

  const handleUnbanUser = async (userId) => {
    try {
      await axios.post(`/api/admin/users/${userId}/unban`);
      setMessage('User unbanned globally');
      fetchData();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to unban user');
    }
  };

  const handleKickUser = async (userId) => {
    try {
      await axios.delete(`/api/admin/users/${userId}/kick`);
      setMessage('User kicked from all servers');
      fetchData();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to kick user');
    }
  };

  const handleTimeoutUser = async (userId) => {
    const mins = parseInt(timeoutMinutes[userId]);
    if (!mins || mins <= 0) {
      alert('Please enter a valid duration in minutes');
      return;
    }
    try {
      await axios.post(`/api/admin/users/${userId}/timeout`, { durationMinutes: mins });
      setMessage(`User timed out for ${mins} minutes`);
      setTimeoutMinutes(prev => ({ ...prev, [userId]: '' }));
      fetchData();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to timeout user');
    }
  };

  const handleRemoveTimeout = async (userId) => {
    try {
      await axios.post(`/api/admin/users/${userId}/untimeout`);
      setMessage('Timeout removed');
      fetchData();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to remove timeout');
    }
  };

  const handleToggleAdmin = async (userId, makeAdmin) => {
    const confirmAction = window.confirm(`Are you sure you want to ${makeAdmin ? 'promote' : 'demote'} this user?`);
    if (!confirmAction) return;

    try {
      await axios.post(`/api/admin/users/${userId}/role`, { makeAdmin });
      setMessage(`User administrative privileges ${makeAdmin ? 'granted' : 'revoked'} successfully`);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to update administrative permissions');
    }
  };

  // Server Actions
  const handleJoinServer = async (server) => {
    try {
      await axios.post(`/api/servers/${server.id}/join`);
      onSelectServer(server);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to join server');
    }
  };

  const handleDeleteServer = async (serverId) => {
    const confirmAction = window.confirm('Are you sure you want to delete this server permanently? All channels and memberships will be deleted.');
    if (!confirmAction) return;

    try {
      await axios.delete(`/api/admin/servers/${serverId}`);
      setMessage('Server deleted successfully');
      fetchData();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to delete server');
    }
  };

  // Word Filter Actions
  const handleAddWord = async (e) => {
    e.preventDefault();
    if (!newWord.trim()) return;
    const formattedWord = newWord.trim().toLowerCase();
    try {
      await axios.post('/api/admin/banned-words', { word: formattedWord });
      await loadCustomBannedWords();
      setMessage(`Word "${formattedWord}" added to filter`);
      setNewWord('');
      fetchData();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to add word');
    }
  };

  const handleDeleteWord = async (word) => {
    try {
      await axios.delete(`/api/admin/banned-words/${word}`);
      await loadCustomBannedWords();
      setMessage(`Word "${word}" removed from filter`);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to delete word');
    }
  };

  const handleResolveReport = async (reportId) => {
    try {
      await axios.patch(`/api/admin/reports/${reportId}`, { status: 'resolved' });
      setMessage('Report marked as resolved');
      fetchData();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to update report status');
    }
  };

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <h2>🛠️ wired-io Administration Dashboard</h2>
        <span style={{ fontSize: '11px', color: '#00ffff', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 'bold', marginTop: '-10px' }}>Secured by wired.inc</span>
        <div className="admin-subtabs">
          <button 
            className={`admin-subtab ${activeSubTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('users')}
          >
            Users
          </button>
          <button 
            className={`admin-subtab ${activeSubTab === 'servers' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('servers')}
          >
            Servers
          </button>
          <button 
            className={`admin-subtab ${activeSubTab === 'words' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('words')}
          >
            Filter Blacklist
          </button>
          <button 
            className={`admin-subtab ${activeSubTab === 'reports' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('reports')}
          >
            🚩 Reports
          </button>
          <button 
            className={`admin-subtab ${activeSubTab === 'system' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('system')}
          >
            📊 System Health Hub
          </button>
          <button 
            className={`admin-subtab ${activeSubTab === 'database' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('database')}
          >
            🗄️ Database Hub
          </button>
          <button 
            className={`admin-subtab ${activeSubTab === 'minecraft' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('minecraft')}
          >
            ⛏️ Minecraft Server
          </button>
        </div>
      </div>

      {message && <div className="admin-message success">{message}</div>}
      {error && <div className="admin-message error">{error}</div>}

      <div className="admin-content">
        {loading ? (
          <p className="admin-loading">Loading configuration data...</p>
        ) : (
          <>
            {activeSubTab === 'database' && dbStats && (
              <div className="admin-db-section" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px' }}>
                  <div style={{ background: '#181b24', border: '1px solid rgba(0, 255, 255, 0.2)', padding: '16px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: '0.85em', color: '#72767d', fontWeight: '600' }}>DATABASE ENGINE</span>
                    <span style={{ fontSize: '1.2em', color: '#00ffff', fontWeight: 'bold' }}>PostgreSQL 15</span>
                    <span style={{ fontSize: '0.75em', color: '#43b581' }}>🟢 Active & Operational</span>
                  </div>

                  <div style={{ background: '#181b24', border: '1px solid rgba(0, 255, 255, 0.2)', padding: '16px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: '0.85em', color: '#72767d', fontWeight: '600' }}>TOTAL DB DISK SIZE</span>
                    <span style={{ fontSize: '1.4em', color: '#fff', fontWeight: 'bold' }}>{dbStats.size}</span>
                    <span style={{ fontSize: '0.75em', color: '#b9bbbe' }}>{dbStats.tables ? dbStats.tables.length : 0} Tables Managed</span>
                  </div>

                  <div style={{ background: '#181b24', border: '1px solid rgba(0, 255, 255, 0.2)', padding: '16px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: '0.85em', color: '#72767d', fontWeight: '600' }}>ACTIVE CONNECTIONS</span>
                    <span style={{ fontSize: '1.4em', color: '#faa61a', fontWeight: 'bold' }}>{dbStats.activeConnections} Connections</span>
                    <span style={{ fontSize: '0.75em', color: '#b9bbbe' }}>Pooled Express & System Queries</span>
                  </div>
                </div>

                <div style={{ background: '#181b24', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <h4 style={{ margin: '0 0 12px 0', color: '#fff', fontSize: '1em' }}>⚡ Maintenance & Storage Optimization</h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                    <button 
                      className="btn-cyan"
                      style={{ padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85em', border: 'none' }}
                      onClick={() => handleDbAction('vacuum')}
                    >
                      🧹 Run VACUUM ANALYZE
                    </button>
                    <button 
                      className="btn-green"
                      style={{ padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85em', border: 'none' }}
                      onClick={() => handleDbAction('health_check')}
                    >
                      🩺 Run Integrity Health Check
                    </button>
                    <button 
                      className="btn-orange"
                      style={{ padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85em', border: 'none' }}
                      onClick={() => handleDbAction('clean_orphans')}
                    >
                      🧼 Purge Orphaned Records
                    </button>
                  </div>
                </div>

                <div style={{ background: '#181b24', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <h4 style={{ margin: '0 0 12px 0', color: '#fff', fontSize: '1em' }}>📋 PostgreSQL Table Footprints & Row Counts</h4>
                  <div className="admin-table-container">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Table Name</th>
                          <th>Est. Row Count</th>
                          <th>Disk Footprint</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dbStats.tables && dbStats.tables.map(t => (
                          <tr key={t.table_name}>
                            <td className="bold" style={{ color: '#00ffff' }}>{t.table_name}</td>
                            <td>{t.row_count} rows</td>
                            <td>{t.total_size}</td>
                            <td>
                              <button 
                                className="btn-cyan"
                                style={{ padding: '4px 10px', fontSize: '0.75em', borderRadius: '6px' }}
                                onClick={() => handleInspectTable(t.table_name)}
                              >
                                🔍 Inspect Records
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {selectedTable && (
                  <div style={{ background: '#13151b', padding: '20px', borderRadius: '12px', border: '1px solid #00ffff', marginTop: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                      <h4 style={{ margin: 0, color: '#00ffff' }}>🔍 Inspecting Table: <code>{selectedTable}</code> (Recent Rows)</h4>
                      <button 
                        style={{ background: '#ff4757', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                        onClick={() => setSelectedTable(null)}
                      >
                        ✕ Close Inspector
                      </button>
                    </div>

                    {tableLoading ? (
                      <p style={{ color: '#00ffff' }}>Fetching records from PostgreSQL database...</p>
                    ) : !tableRows || tableRows.length === 0 ? (
                      <p style={{ color: '#72767d' }}>No records found in table `{selectedTable}`.</p>
                    ) : (
                      <div className="admin-table-container" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                        <table className="admin-table" style={{ fontSize: '0.8em' }}>
                          <thead>
                            <tr>
                              {Object.keys(tableRows[0]).map(k => (
                                <th key={k}>{k}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {tableRows.map((row, i) => (
                              <tr key={i}>
                                {Object.values(row).map((val, j) => (
                                  <td key={j} style={{ whiteSpace: 'nowrap', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {val === null ? <em style={{ color: '#72767d' }}>null</em> : typeof val === 'object' ? JSON.stringify(val) : String(val)}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            {activeSubTab === 'system' && systemStatus && (
              <div className="admin-section" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3>🖥️ {systemStatus.server || 'Dell Latitude 5290'} Hardware Metrics</h3>
                  <button onClick={fetchData} style={{ padding: '6px 16px', background: '#00ffff', color: '#000', fontWeight: 'bold', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                    🔄 Refresh Metrics
                  </button>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                  <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '16px' }}>
                    <div style={{ fontSize: '0.85em', color: '#a4b0be' }}>Status</div>
                    <div style={{ fontSize: '1.4em', fontWeight: 'bold', color: '#2ed573', marginTop: '4px' }}>🟢 {systemStatus.status?.toUpperCase()}</div>
                    <div style={{ fontSize: '0.8em', color: '#747d8c', marginTop: '4px' }}>Uptime: {Math.floor(systemStatus.uptimeSeconds / 3600)}h {Math.floor((systemStatus.uptimeSeconds % 3600) / 60)}m</div>
                  </div>

                  <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '16px' }}>
                    <div style={{ fontSize: '0.85em', color: '#a4b0be' }}>CPU Model ({systemStatus.cpus} Cores)</div>
                    <div style={{ fontSize: '0.95em', fontWeight: 'bold', color: '#fff', marginTop: '4px' }}>{systemStatus.cpuModel}</div>
                    <div style={{ fontSize: '0.8em', color: '#00ffff', marginTop: '4px' }}>Load: {systemStatus.cpuLoadAverage?.['1min']} (1m) | {systemStatus.cpuLoadAverage?.['5min']} (5m)</div>
                  </div>

                  <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '16px' }}>
                    <div style={{ fontSize: '0.85em', color: '#a4b0be' }}>System Memory (RAM)</div>
                    <div style={{ fontSize: '1.4em', fontWeight: 'bold', color: '#ffa502', marginTop: '4px' }}>{systemStatus.memory?.usedGB} / {systemStatus.memory?.totalGB}</div>
                    <div style={{ fontSize: '0.8em', color: '#747d8c', marginTop: '4px' }}>{systemStatus.memory?.usedPercent} RAM Used ({systemStatus.memory?.freeGB} Free)</div>
                  </div>

                  <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '16px' }}>
                    <div style={{ fontSize: '0.85em', color: '#a4b0be' }}>Node.js API Footprint</div>
                    <div style={{ fontSize: '1.4em', fontWeight: 'bold', color: '#70a1ff', marginTop: '4px' }}>{systemStatus.processMemoryMB}</div>
                    <div style={{ fontSize: '0.8em', color: '#747d8c', marginTop: '4px' }}>Adaptive Memory Scaling</div>
                  </div>
                </div>

                {/* Dell Latitude Hardware Fan Control Panel */}
                <div style={{ background: 'rgba(0, 255, 255, 0.04)', border: '1px solid rgba(0, 255, 255, 0.2)', borderRadius: '12px', padding: '20px', marginTop: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '1.1em', color: '#00ffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        🌀 Dell Latitude Fan & Thermal Control
                      </h4>
                      <span style={{ fontSize: '0.8em', color: '#a4b0be' }}>
                        Dell SMM Kernel Controller (Hardware HWMON)
                      </span>
                    </div>
                    {fanStatus && (
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '1.1em', fontWeight: 'bold', color: fanStatus.mode === 'auto' ? '#2ed573' : '#ffa502' }}>
                          {fanStatus.mode === 'auto' ? '🤖 AUTO (BIOS Managed)' : `🎛️ MANUAL (${fanStatus.speedPercent}%)`}
                        </span>
                        <div style={{ fontSize: '0.8em', color: '#747d8c' }}>
                          Current Fan Speed: {fanStatus.rpm} RPM
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', marginTop: '12px' }}>
                    <button 
                      onClick={() => handleSetFan('auto')}
                      style={{ 
                        padding: '8px 18px', 
                        background: fanStatus?.mode === 'auto' ? '#2ed573' : 'rgba(255,255,255,0.1)', 
                        color: fanStatus?.mode === 'auto' ? '#000' : '#fff',
                        fontWeight: 'bold',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer'
                      }}
                    >
                      🤖 AUTO FAN SPEED (BIOS Adaptive)
                    </button>

                    <button 
                      onClick={() => handleSetFan('manual', 25)}
                      style={{ padding: '8px 14px', background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', cursor: 'pointer' }}
                    >
                      🤫 Quiet (25%)
                    </button>

                    <button 
                      onClick={() => handleSetFan('manual', 50)}
                      style={{ padding: '8px 14px', background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', cursor: 'pointer' }}
                    >
                      ⚖️ Balanced (50%)
                    </button>

                    <button 
                      onClick={() => handleSetFan('manual', 75)}
                      style={{ padding: '8px 14px', background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', cursor: 'pointer' }}
                    >
                      ❄️ Cool (75%)
                    </button>

                    <button 
                      onClick={() => handleSetFan('manual', 100)}
                      style={{ padding: '8px 14px', background: '#ff4757', color: '#fff', fontWeight: 'bold', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                    >
                      🚀 Max Power (100%)
                    </button>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '16px' }}>
                    <span style={{ fontSize: '0.85em', color: '#a4b0be', minWidth: '120px' }}>Custom Speed ({manualSpeed}%):</span>
                    <input 
                      type="range" 
                      min="0" 
                      max="100" 
                      value={manualSpeed}
                      onChange={(e) => setManualSpeed(parseInt(e.target.value))}
                      style={{ flex: 1, cursor: 'pointer' }}
                    />
                    <button 
                      onClick={() => handleSetFan('manual', manualSpeed)}
                      style={{ padding: '6px 14px', background: '#00ffff', color: '#000', fontWeight: 'bold', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                    >
                      Apply Custom Speed
                    </button>
                  </div>
                </div>
              </div>
            )}
            {activeSubTab === 'users' && (
              <div className="admin-section">
                <h3>User Accounts Management</h3>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Username</th>
                      <th>Email</th>
                      <th>Admin?</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id} className={u.is_banned ? 'row-banned' : ''}>
                        <td className="bold">{u.username}</td>
                        <td>{u.email}</td>
                        <td>{u.is_admin ? '✅ Yes' : 'No'}</td>
                        <td>
                          {u.is_banned && <span className="status-badge ban">Banned</span>}
                          {u.timeout_until && new Date(u.timeout_until) > new Date() ? (
                            <span className="status-badge timeout">
                              Timeout (until {new Date(u.timeout_until).toLocaleTimeString()})
                            </span>
                          ) : (
                            !u.is_banned && <span className="status-badge active">Active</span>
                          )}
                        </td>
                        <td>
                          <div className="action-buttons">
                            {u.is_banned ? (
                              <button className="btn-green" onClick={() => handleUnbanUser(u.id)}>Unban</button>
                            ) : (
                              u.id !== currentUser.id && (
                                <button className="btn-red" onClick={() => handleBanUser(u.id)}>Ban</button>
                              )
                            )}

                            {u.id !== currentUser.id && (
                              <button className="btn-orange" onClick={() => handleKickUser(u.id)}>Kick All</button>
                            )}

                            {u.id !== currentUser.id && (
                              u.is_admin ? (
                                <button className="btn-grey" onClick={() => handleToggleAdmin(u.id, false)}>Demote</button>
                              ) : (
                                <button className="btn-green" onClick={() => handleToggleAdmin(u.id, true)}>Promote</button>
                              )
                            )}

                            {u.id !== currentUser.id && (
                              <div className="timeout-control">
                                <input
                                  type="number"
                                  placeholder="Mins"
                                  value={timeoutMinutes[u.id] || ''}
                                  onChange={(e) => setTimeoutMinutes({ ...timeoutMinutes, [u.id]: e.target.value })}
                                />
                                {u.timeout_until && new Date(u.timeout_until) > new Date() ? (
                                  <button className="btn-blue" onClick={() => handleRemoveTimeout(u.id)}>Untimeout</button>
                                ) : (
                                  <button className="btn-grey" onClick={() => handleTimeoutUser(u.id)}>Timeout</button>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeSubTab === 'servers' && (
              <div className="admin-section">
                <h3>Chat Servers Management</h3>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Server Name</th>
                      <th>Owner</th>
                      <th>Visibility</th>
                      <th>Created At</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {servers.map(s => (
                      <tr key={s.id}>
                        <td className="bold">{s.name}</td>
                        <td>{s.owner_name}</td>
                        <td>{s.is_public ? '🌐 Public' : '🔒 Private'}</td>
                        <td>{new Date(s.created_at).toLocaleDateString()}</td>
                        <td>
                          <div className="action-buttons">
                            <button className="btn-blue" onClick={() => handleJoinServer(s)}>Join Chat</button>
                            <button className="btn-red" onClick={() => handleDeleteServer(s.id)}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeSubTab === 'words' && (
              <div className="admin-section">
                <h3>Dynamic Word Blacklist</h3>
                <p className="description">
                  Add words or slurs that will be dynamically filtered and replaced with asterisks (`***`) in real-time messages.
                </p>
                <form onSubmit={handleAddWord} className="word-filter-form">
                  <input
                    type="text"
                    placeholder="Type a word to blacklist..."
                    value={newWord}
                    onChange={(e) => setNewWord(e.target.value)}
                    required
                  />
                  <button type="submit" className="btn-blue">Add Word</button>
                </form>

                <div className="blacklist-container">
                  <h4>Currently Blacklisted Custom Words ({words.length})</h4>
                  {words.length === 0 ? (
                    <p className="empty-blacklist">No custom words added yet. Default profanity filters are active.</p>
                  ) : (
                    <div className="blacklist-tags">
                      {words.map(w => (
                        <div key={w} className="blacklist-tag">
                          <span>{w}</span>
                          <button onClick={() => handleDeleteWord(w)}>&times;</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeSubTab === 'reports' && (
              <div className="admin-section">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3>User Bug/Issue Reports</h3>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      onClick={() => setSelectedTable('inbox')}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '6px',
                        border: 'none',
                        background: selectedTable !== 'spam' ? '#00ffff' : 'rgba(255, 255, 255, 0.1)',
                        color: selectedTable !== 'spam' ? '#000' : '#fff',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                      }}
                    >
                      📥 Inbox ({reports.filter(r => r.status !== 'spam' && r.status !== 'rejected').length})
                    </button>
                    <button
                      onClick={() => setSelectedTable('spam')}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '6px',
                        border: 'none',
                        background: selectedTable === 'spam' ? '#ff4757' : 'rgba(255, 255, 255, 0.1)',
                        color: '#fff',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                      }}
                    >
                      🗑️ Spam Box ({reports.filter(r => r.status === 'spam' || r.status === 'rejected' || r.ai_evaluation === 'SPAM' || r.ai_evaluation === 'ABUSIVE').length})
                    </button>
                  </div>
                </div>

                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Reporter</th>
                      <th>Description</th>
                      <th>Date</th>
                      <th>AI Triage</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports
                      .filter(r => {
                        const isSpam = r.status === 'spam' || r.status === 'rejected' || r.ai_evaluation === 'SPAM' || r.ai_evaluation === 'ABUSIVE';
                        return selectedTable === 'spam' ? isSpam : !isSpam;
                      })
                      .length === 0 ? (
                      <tr>
                        <td colSpan="6" style={{ textAlign: 'center', padding: '20px', color: '#a4b0be' }}>
                          {selectedTable === 'spam' ? 'No spam reports detected.' : 'No active reports in inbox.'}
                        </td>
                      </tr>
                    ) : (
                      reports
                        .filter(r => {
                          const isSpam = r.status === 'spam' || r.status === 'rejected' || r.ai_evaluation === 'SPAM' || r.ai_evaluation === 'ABUSIVE';
                          return selectedTable === 'spam' ? isSpam : !isSpam;
                        })
                        .map(r => (
                          <tr key={r.id}>
                            <td className="bold">{r.username}</td>
                            <td>{r.description}</td>
                            <td>{new Date(r.created_at).toLocaleDateString()}</td>
                            <td>
                              <span className={`status-badge ${r.ai_evaluation === 'LEGITIMATE' ? 'active' : r.ai_evaluation === 'SPAM' || r.ai_evaluation === 'ABUSIVE' ? 'ban' : 'timeout'}`}>
                                🤖 {r.ai_evaluation ? r.ai_evaluation.toUpperCase() : 'UNEVALUATED'}
                              </span>
                            </td>
                            <td>
                              <span className={`status-badge ${r.status === 'resolved' ? 'active' : r.status === 'spam' ? 'ban' : 'timeout'}`}>
                                {r.status.toUpperCase()}
                              </span>
                            </td>
                            <td>
                              {r.status !== 'resolved' && r.status !== 'spam' && (
                                <button className="btn-green" onClick={() => handleResolveReport(r.id)}>Resolve</button>
                              )}
                              {r.status === 'spam' && (
                                <button className="btn-blue" onClick={() => handleResolveReport(r.id)}>Mark Resolved</button>
                              )}
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {activeSubTab === 'minecraft' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{
                  background: 'linear-gradient(135deg, rgba(56, 176, 0, 0.12) 0%, rgba(20, 25, 35, 0.9) 100%)',
                  border: '1px solid rgba(56, 176, 0, 0.3)',
                  borderRadius: '16px',
                  padding: '24px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '15px'
                }}>
                  <div>
                    <h3 style={{ margin: '0 0 6px 0', fontSize: '1.4em', color: '#70e000', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>⛏️</span> Minecraft Network & Live Player Console
                    </h3>
                    <p style={{ margin: 0, color: '#a4b0be', fontSize: '0.95em' }}>
                      Monitor online players, send live in-game server chat broadcasts, dispatch on-screen title alerts, and run console commands.
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      window.history.pushState({}, '', '/mc');
                      window.dispatchEvent(new PopStateEvent('popstate'));
                    }}
                    style={{
                      background: '#38b000',
                      color: '#000',
                      border: 'none',
                      padding: '12px 24px',
                      borderRadius: '12px',
                      fontWeight: '800',
                      fontSize: '1em',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 15px rgba(56, 176, 0, 0.4)',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <span>🚀</span> Open Full Minecraft Command Hub
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default AdminPanel;
