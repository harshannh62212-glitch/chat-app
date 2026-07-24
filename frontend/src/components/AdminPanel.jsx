import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { loadCustomBannedWords } from '../utils/contentFilter';

function AdminPanel({ currentUser, onSelectServer }) {
  const [activeSubTab, setActiveSubTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [servers, setServers] = useState([]);
  const [words, setWords] = useState([]);
  const [newWord, setNewWord] = useState('');
  const [timeoutMinutes, setTimeoutMinutes] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [systemStatus, setSystemStatus] = useState(null);

  useEffect(() => {
    fetchData();
  }, [activeSubTab]);

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
      } else if (activeSubTab === 'system') {
        const res = await axios.get('/api/system-status');
        setSystemStatus(res.data);
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
            className={`admin-subtab ${activeSubTab === 'system' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('system')}
          >
            📊 System Health Hub
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
          </>
        )}
      </div>
    </div>
  );
}

export default AdminPanel;
