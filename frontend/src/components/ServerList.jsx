import React from 'react';

function ServerList({ servers, onSelectServer, selectedServer }) {
  return (
    <div className="server-list">
      {servers.length === 0 ? (
        <p className="empty-message">No servers yet</p>
      ) : (
        servers.map(server => (
          <div
            key={server.id}
            className={`server-item ${selectedServer?.id === server.id ? 'active' : ''}`}
            onClick={() => onSelectServer(server)}
          >
            <div className="server-avatar">
              {server.avatar_url ? (
                <img src={server.avatar_url} alt={server.name} />
              ) : (
                <span>{server.name.charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div className="server-info">
              <h4>{server.name}</h4>
              <p className="server-desc">{server.description || 'No description'}</p>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export default ServerList;
