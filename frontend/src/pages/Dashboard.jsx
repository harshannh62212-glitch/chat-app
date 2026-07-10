import React, { useState, useEffect } from 'react';
import axios from 'axios';
import ServerList from '../components/ServerList';
import Discovery from '../components/Discovery';
import ServerChat from '../components/ServerChat';
import DMList from '../components/DMList';
import DirectMessage from '../components/DirectMessage';
import '../styles/Dashboard.css';

function Dashboard({ user, socket, onLogout }) {
  const [activeTab, setActiveTab] = useState('servers');
  const [selectedServer, setSelectedServer] = useState(null);
  const [selectedDM, setSelectedDM] = useState(null);
  const [showNewServerModal, setShowNewServerModal] = useState(false);
  const [servers, setServers] = useState([]);

  useEffect(() => {
    fetchServers();
  }, []);

  const fetchServers = async () => {
    try {
      const response = await axios.get('/api/servers/my-servers');
      setServers(response.data);
    } catch (err) {
      console.error('Failed to fetch servers:', err);
    }
  };

  const handleServerCreated = (newServer) => {
    setServers([newServer, ...servers]);
    setShowNewServerModal(false);
  };

  return (
    <div className="dashboard">
      <div className="sidebar">
        <div className="user-info">
          <h3>{user.username}</h3>
          <button onClick={onLogout} className="logout-btn">Logout</button>
        </div>

        <div className="tabs">
          <button 
            className={`tab ${activeTab === 'servers' ? 'active' : ''}`}
            onClick={() => { setActiveTab('servers'); setSelectedServer(null); setSelectedDM(null); }}
          >
            Servers
          </button>
          <button 
            className={`tab ${activeTab === 'dms' ? 'active' : ''}`}
            onClick={() => { setActiveTab('dms'); setSelectedServer(null); setSelectedDM(null); }}
          >
            DMs
          </button>
          <button 
            className={`tab ${activeTab === 'discovery' ? 'active' : ''}`}
            onClick={() => { setActiveTab('discovery'); setSelectedServer(null); setSelectedDM(null); }}
          >
            Discover
          </button>
        </div>

        {activeTab === 'servers' && (
          <>
            <button 
              className="create-server-btn"
              onClick={() => setShowNewServerModal(true)}
            >
              + New Server
            </button>
            <ServerList 
              servers={servers}
              onSelectServer={setSelectedServer}
              selectedServer={selectedServer}
            />
          </>
        )}

        {activeTab === 'dms' && (
          <DMList 
            onSelectDM={setSelectedDM}
            selectedDM={selectedDM}
          />
        )}

        {activeTab === 'discovery' && (
          <Discovery onServerJoined={fetchServers} />
        )}
      </div>

      <div className="main-content">
        {selectedServer && (
          <ServerChat 
            server={selectedServer}
            socket={socket}
            currentUser={user}
          />
        )}

        {selectedDM && (
          <DirectMessage 
            dmWith={selectedDM}
            socket={socket}
            currentUser={user}
          />
        )}

        {!selectedServer && !selectedDM && (
          <div className="welcome">
            <h2>Welcome to Chat App! 👋</h2>
            <p>Select a server or DM to start chatting</p>
          </div>
        )}
      </div>

      {showNewServerModal && (
        <CreateServerModal 
          onClose={() => setShowNewServerModal(false)}
          onServerCreated={handleServerCreated}
        />
      )}
    </div>
  );
}

function CreateServerModal({ onClose, onServerCreated }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    password: '',
    isPublic: true
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await axios.post('/api/servers', formData);
      onServerCreated(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>Create New Server</h2>
        {error && <div className="error-message">{error}</div>}
        
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            name="name"
            placeholder="Server Name"
            value={formData.name}
            onChange={handleChange}
            required
          />
          <textarea
            name="description"
            placeholder="Description (optional)"
            value={formData.description}
            onChange={handleChange}
            rows="3"
          />
          <input
            type="password"
            name="password"
            placeholder="Server Password (optional)"
            value={formData.password}
            onChange={handleChange}
          />
          <label>
            <input
              type="checkbox"
              name="isPublic"
              checked={formData.isPublic}
              onChange={handleChange}
            />
            Make server public (visible in discovery)
          </label>
          
          <div className="modal-actions">
            <button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create'}
            </button>
            <button type="button" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Dashboard;
