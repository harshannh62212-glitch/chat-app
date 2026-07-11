import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

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
      
      // 1. Get all public servers
      const { data: publicServers, error: srvErr } = await supabase
        .from('servers')
        .select('*')
        .eq('is_public', true);
      
      if (srvErr) throw srvErr;

      // 2. Get user memberships
      const { data: memberships, error: memErr } = await supabase
        .from('server_members')
        .select('server_id')
        .eq('user_id', currentUser.id);

      if (memErr) throw memErr;

      const ids = new Set(memberships.map(m => m.server_id));
      setJoinedServerIds(ids);
      setServers(publicServers || []);
    } catch (err) {
      console.error('Failed to fetch discovery servers:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinServer = async (serverId, password = null) => {
    const serverDoc = servers.find(s => s.id === serverId);
    if (!serverDoc) return;

    try {
      setJoiningServer(serverId);
      
      // Call secure join RPC database function
      const { data: joinedSuccessfully, error } = await supabase.rpc('join_server', {
        target_server_id: serverId,
        provided_password: password || ''
      });

      if (error) throw error;

      if (joinedSuccessfully) {
        // Update joined state
        setJoinedServerIds(prev => {
          const next = new Set(prev);
          next.add(serverId);
          return next;
        });
        setPasswordPrompt(null);
      } else {
        // Password verification failed
        if (serverDoc.has_password && !password) {
          setPasswordPrompt(serverId);
        } else {
          alert('Incorrect password or unauthorized to join');
        }
      }
    } catch (err) {
      console.error('Failed to join server:', err);
      alert(err.message || 'Failed to join server');
    } finally {
      setJoiningServer(null);
    }
  };

  const handleLeaveServer = async (serverId) => {
    const serverDoc = servers.find(s => s.id === serverId);
    const serverName = serverDoc ? serverDoc.name : 'this server';
    
    const confirmLeave = window.confirm(`Are you sure you want to leave ${serverName}?`);
    if (!confirmLeave) return;

    try {
      const { error } = await supabase
        .from('server_members')
        .delete()
        .eq('user_id', currentUser.id)
        .eq('server_id', serverId);

      if (error) throw error;

      // Update joined state
      setJoinedServerIds(prev => {
        const next = new Set(prev);
        next.delete(serverId);
        return next;
      });
    } catch (err) {
      console.error('Failed to leave server:', err);
      alert(err.message || 'Failed to leave server');
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
            const isJoined = joinedServerIds.has(server.id);
            const isGeneral = server.id === '00000000-0000-0000-0000-000000000000';
            
            return (
              <div key={server.id} className="discovery-card">
                <h4>{server.name}</h4>
                <p>{server.description || 'No description'}</p>
                
                {isJoined ? (
                  isGeneral ? (
                    <span className="joined-badge" style={{ color: '#72767d', fontWeight: 'bold', fontSize: '0.85em' }}>
                      Default Server
                    </span>
                  ) : (
                    <button
                      className="leave-server-btn"
                      onClick={() => handleLeaveServer(server.id)}
                    >
                      ❌ Leave Server
                    </button>
                  )
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
