import React, { useState, useEffect } from 'react';
import axios from 'axios';

function Discovery({ onServerJoined }) {
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [joiningServer, setJoiningServer] = useState(null);
  const [passwordPrompt, setPasswordPrompt] = useState(null);

  useEffect(() => {
    fetchDiscoveryServers();
  }, []);

  const fetchDiscoveryServers = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/servers/discovery');
      setServers(response.data);
    } catch (err) {
      console.error('Failed to fetch discovery servers:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinServer = async (serverId, password = null) => {
    try {
      setJoiningServer(serverId);
      await axios.post(`/api/servers/${serverId}/join`, { password });
      onServerJoined();
      setServers(servers.filter(s => s.id !== serverId));
      setPasswordPrompt(null);
    } catch (err) {
      if (err.response?.status === 403 && err.response?.data?.error.includes('password')) {
        setPasswordPrompt(serverId);
      } else {
        alert(err.response?.data?.error || 'Failed to join server');
      }
    } finally {
      setJoiningServer(null);
    }
  };

  if (loading) return <div className="discovery">Loading servers...</div>;

  return (
    <div className="discovery">
      <h3>Discover Servers</h3>
      {servers.length === 0 ? (
        <p>No public servers available</p>
      ) : (
        <div className="discovery-list">
          {servers.map(server => (
            <div key={server.id} className="discovery-card">
              <h4>{server.name}</h4>
              <p>{server.description || 'No description'}</p>
              <button
                onClick={() => handleJoinServer(server.id)}
                disabled={joiningServer === server.id}
              >
                {joiningServer === server.id ? 'Joining...' : 'Join Server'}
              </button>
            </div>
          ))}
        </div>
      )}

      {passwordPrompt && (
        <PasswordPrompt
          onSubmit={(pwd) => handleJoinServer(passwordPrompt, pwd)}
          onCancel={() => setPasswordPrompt(null)}
        />
      )}
    </div>
  );
}

function PasswordPrompt({ onSubmit, onCancel }) {
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(password);
    setPassword('');
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3>Server Password Required</h3>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            placeholder="Enter server password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoFocus
          />
          <div className="modal-actions">
            <button type="submit">Join</button>
            <button type="button" onClick={onCancel}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Discovery;
