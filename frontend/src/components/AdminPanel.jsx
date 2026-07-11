import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
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

  useEffect(() => {
    fetchData();
  }, [activeSubTab]);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      if (activeSubTab === 'users') {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .order('username', { ascending: true });
        
        if (error) throw error;
        setUsers(data || []);
      } else if (activeSubTab === 'servers') {
        // Query server details along with owner username using joins
        const { data, error } = await supabase
          .from('servers')
          .select('*, users (username)')
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        const mapped = (data || []).map(s => ({
          ...s,
          owner_name: s.users?.username || 'Unknown'
        }));
        setServers(mapped);
      } else if (activeSubTab === 'words') {
        const { data, error } = await supabase
          .from('banned_words')
          .select('word')
          .order('word', { ascending: true });
        
        if (error) throw error;
        setWords((data || []).map(w => w.word));
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch administration data');
    } finally {
      setLoading(false);
    }
  };

  // User Actions
  const handleBanUser = async (userId) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ is_banned: true })
        .eq('id', userId);

      if (error) throw error;
      setMessage('User banned globally');
      fetchData();
    } catch (err) {
      setError(err.message || 'Failed to ban user');
    }
  };

  const handleUnbanUser = async (userId) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ is_banned: false })
        .eq('id', userId);

      if (error) throw error;
      setMessage('User unbanned globally');
      fetchData();
    } catch (err) {
      setError(err.message || 'Failed to unban user');
    }
  };

  const handleKickUser = async (userId) => {
    try {
      const { error } = await supabase
        .from('server_members')
        .delete()
        .eq('user_id', userId);

      if (error) throw error;
      setMessage('User kicked from all servers');
      fetchData();
    } catch (err) {
      setError(err.message || 'Failed to kick user');
    }
  };

  const handleTimeoutUser = async (userId) => {
    const mins = parseInt(timeoutMinutes[userId]);
    if (!mins || mins <= 0) {
      alert('Please enter a valid duration in minutes');
      return;
    }
    try {
      const timeoutUntil = new Date(Date.now() + mins * 60 * 1000).toISOString();
      const { error } = await supabase
        .from('users')
        .update({ timeout_until: timeoutUntil })
        .eq('id', userId);

      if (error) throw error;
      setMessage(`User timed out for ${mins} minutes`);
      setTimeoutMinutes(prev => ({ ...prev, [userId]: '' }));
      fetchData();
    } catch (err) {
      setError(err.message || 'Failed to timeout user');
    }
  };

  const handleRemoveTimeout = async (userId) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ timeout_until: null })
        .eq('id', userId);

      if (error) throw error;
      setMessage('Timeout removed');
      fetchData();
    } catch (err) {
      setError(err.message || 'Failed to remove timeout');
    }
  };

  const handleToggleAdmin = async (userId, makeAdmin) => {
    const confirmAction = window.confirm(`Are you sure you want to ${makeAdmin ? 'promote' : 'demote'} this user?`);
    if (!confirmAction) return;

    try {
      const { error } = await supabase
        .from('users')
        .update({ is_admin: makeAdmin })
        .eq('id', userId);

      if (error) throw error;
      setMessage(`User administrative privileges ${makeAdmin ? 'granted' : 'revoked'} successfully`);
      fetchData();
    } catch (err) {
      setError(err.message || 'Failed to update administrative permissions');
    }
  };

  // Server Actions
  const handleJoinServer = async (server) => {
    try {
      const { error } = await supabase
        .from('server_members')
        .insert({
          user_id: currentUser.id,
          server_id: server.id,
          username: currentUser.username,
          avatar_url: currentUser.avatar_url || ''
        });

      // Ignore duplicates, select either way
      if (error && !error.message?.includes('duplicate')) throw error;
      onSelectServer(server);
    } catch (err) {
      setError(err.message || 'Failed to join server');
    }
  };

  const handleDeleteServer = async (serverId) => {
    const confirmAction = window.confirm('Are you sure you want to delete this server permanently? All channels and memberships will be deleted.');
    if (!confirmAction) return;

    try {
      const { error } = await supabase
        .from('servers')
        .delete()
        .eq('id', serverId);

      if (error) throw error;
      setMessage('Server deleted successfully');
      fetchData();
    } catch (err) {
      setError(err.message || 'Failed to delete server');
    }
  };

  // Word Filter Actions
  const handleAddWord = async (e) => {
    e.preventDefault();
    if (!newWord.trim()) return;
    const formattedWord = newWord.trim().toLowerCase();
    try {
      const { error } = await supabase
        .from('banned_words')
        .insert({ word: formattedWord });

      if (error) throw error;
      await loadCustomBannedWords();
      setMessage(`Word "${formattedWord}" added to filter`);
      setNewWord('');
      fetchData();
    } catch (err) {
      setError(err.message || 'Failed to add word');
    }
  };

  const handleDeleteWord = async (word) => {
    try {
      const { error } = await supabase
        .from('banned_words')
        .delete()
        .eq('word', word.toLowerCase());

      if (error) throw error;
      await loadCustomBannedWords();
      setMessage(`Word "${word}" removed from filter`);
      fetchData();
    } catch (err) {
      setError(err.message || 'Failed to delete word');
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
