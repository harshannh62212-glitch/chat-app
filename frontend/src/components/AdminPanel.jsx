import React, { useState, useEffect } from 'react';
import axios from 'axios';

function AdminPanel({ socket, currentUser, onSelectServer }) {
  const [activeSubTab, setActiveSubTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [servers, setServers] = useState([]);
  const [words, setWords] = useState([]);
  const [newWord, setNewWord] = useState('');
  const [timeoutMinutes, setTimeoutMinutes] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchData();
  }, [activeSubTab]);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      if (activeSubTab === 'users') {
        const response = await axios.get('/api/admin/users');
        setUsers(response.data);
      } else if (activeSubTab === 'servers') {
        const response = await axios.get('/api/admin/servers');
        setServers(response.data);
      } else if (activeSubTab === 'words') {
        const response = await axios.get('/api/admin/words');
        setWords(response.data);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch administration data');
    } finally {
      setLoading(false);
    }
  };

  // User Actions
  const handleBanUser = async (userId) => {
    if (!window.confirm('Are you sure you want to ban this user globally? They will be signed out and blocked from logging in.')) return;
    try {
      await axios.post(`/api/admin/users/${userId}/ban`);
      setMessage('User banned globally');
      fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to ban user');
    }
  };

  const handleUnbanUser = async (userId) => {
    try {
      await axios.post(`/api/admin/users/${userId}/unban`);
      setMessage('User unbanned globally');
      fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to unban user');
    }
  };

  const handleKickUser = async (userId) => {
    if (!window.confirm('Are you sure you want to kick this user from all servers?')) return;
    try {
      await axios.post(`/api/admin/users/${userId}/kick-all`);
      setMessage('User kicked from all servers');
      fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to kick user');
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
      setError(err.response?.data?.error || 'Failed to timeout user');
    }
  };

  const handleRemoveTimeout = async (userId) => {
    try {
      await axios.post(`/api/admin/users/${userId}/untimeout`);
      setMessage('Timeout removed');
      fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to remove timeout');
    }
  };

  // Server Actions
  const handleJoinServer = async (server) => {
    try {
      // Admins bypass password checking on /join endpoint!
      await axios.post(`/api/servers/${server.id}/join`, {});
      onSelectServer(server);
    } catch (err) {
      // If already a member, we can still select it!
      if (err.response?.data?.error === 'Already a member') {
        onSelectServer(server);
      } else {
        setError(err.response?.data?.error || 'Failed to join server');
      }
    }
  };

  const handleDeleteServer = async (serverId) => {
    if (!window.confirm('Are you sure you want to delete this server permanently? This deletes all channels and messages.')) return;
    try {
      await axios.delete(`/api/admin/servers/${serverId}`);
      setMessage('Server deleted successfully');
      fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete server');
    }
  };

  // Word Filter Actions
  const handleAddWord = async (e) => {
    e.preventDefault();
    if (!newWord.trim()) return;
    try {
      await axios.post('/api/admin/words', { word: newWord });
      setMessage(`Word "${newWord}" added to filter`);
      setNewWord('');
      fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add word');
    }
  };

  const handleDeleteWord = async (word) => {
    try {
      await axios.delete(`/api/admin/words/${word}`);
      setMessage(`Word "${word}" removed from filter`);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete word');
    }
  };

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <h2>🛠️ Administrator Dashboard</h2>
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
        </div>
      </div>

      {message && <div className="admin-message success">{message}</div>}
      {error && <div className="admin-message error">{error}</div>}

      <div className="admin-content">
        {loading ? (
          <p className="admin-loading">Loading configuration data...</p>
        ) : (
          <>
            {activeSubTab === 'users' && (
              <div className="admin-section">
                <h3>User Accounts Management</h3>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>ID</th>
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
                        <td>{u.id}</td>
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
                      <th>ID</th>
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
                        <td>{s.id}</td>
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
