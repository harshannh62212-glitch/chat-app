import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { GENERAL_SERVER_ID } from '../utils/generalServer';

function Discovery({ currentUser }) {
  const [servers, setServers] = useState([]);
  const [joinedServerIds, setJoinedServerIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [joiningServer, setJoiningServer] = useState(null);
  const [passwordPrompt, setPasswordPrompt] = useState(null);

  useEffect(() => {
    fetchDiscoveryServers();
  }, []);

  const fetchDiscoveryServers = async () => {
    try {
      setLoading(true);
      
      const [discRes, myRes] = await Promise.all([
        axios.get('/api/servers/discovery'),
        axios.get('/api/servers/my-servers')
      ]);

      const publicServers = Array.isArray(discRes?.data) ? discRes.data : [];
      const myServers = Array.isArray(myRes?.data) ? myRes.data : [];

      const ids = new Set(myServers.map(m => m.id));
      setJoinedServerIds(ids);
      setServers(publicServers);
    } catch (err) {
      console.error('Failed to fetch discovery servers:', err);
      setServers([]);
      setJoinedServerIds(new Set());
    } finally {
      setLoading(false);
    }
  };

  const handleJoinServer = async (serverId, password = null) => {
    const serverDoc = servers.find(s => s.id === serverId);
    if (!serverDoc) return;

    try {
      setJoiningServer(serverId);
      
      await axios.post(`/api/servers/${serverId}/join`, { password });

      setJoinedServerIds(prev => {
        const next = new Set(prev);
        next.add(serverId);
        return next;
      });
      setPasswordPrompt(null);
    } catch (err) {
      const errMsg = err.response?.data?.error || err.message || 'Failed to join server';
      if (errMsg.includes('password required')) {
        setPasswordPrompt(serverId);
      } else {
        alert(errMsg);
      }
    } finally {
      setJoiningServer(null);
    }
  };

  const handleLeaveServer = async (serverId) => {
    const serverDoc = servers.find(s => s.id === serverId);
    const isGeneral = serverDoc && (serverDoc.id === GENERAL_SERVER_ID || serverDoc.name === 'General');
    if (isGeneral) {
      alert('Cannot leave the General server.');
      return;
    }

    const serverName = serverDoc ? serverDoc.name : 'this server';
    
    const confirmLeave = window.confirm(`Are you sure you want to leave ${serverName}?`);
    if (!confirmLeave) return;

    try {
      await axios.delete(`/api/servers/${serverId}/leave`);

      setJoinedServerIds(prev => {
        const next = new Set(prev);
        next.delete(serverId);
        return next;
      });
    } catch (err) {
      console.error('Failed to leave server:', err);
      alert(err.response?.data?.error || 'Failed to leave server');
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
          {servers.map(server => {
            const isGeneral = server.id === GENERAL_SERVER_ID || server.name === 'General';
            const isJoined = isGeneral || joinedServerIds.has(server.id);
            
            return (
              <div key={server.id} className="discovery-card">
                <h4>{server.name}</h4>
                <p>{server.description || 'No description'}</p>
                
                {isGeneral ? (
                  <span className="joined-badge" style={{ color: '#5865F2', background: 'rgba(88, 101, 242, 0.15)', padding: '5px 10px', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.85em' }}>
                    Default Server
                  </span>
                ) : isJoined ? (
                  <button
                    className="leave-server-btn"
                    onClick={() => handleLeaveServer(server.id)}
                  >
                    ❌ Leave Server
                  </button>
                ) : (
                  <button
                    onClick={() => handleJoinServer(server.id)}
                    disabled={joiningServer === server.id}
                  >
                    {joiningServer === server.id ? 'Joining...' : 'Join Server'}
                  </button>
                )}
              </div>
            );
          })}
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
