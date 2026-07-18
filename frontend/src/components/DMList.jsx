import React, { useState, useEffect } from 'react';
import axios from 'axios';

function DMList({ onSelectDM, selectedDM }) {
  const [conversations, setConversations] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    fetchConversations();
    const interval = setInterval(fetchConversations, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchConversations = async () => {
    try {
      const response = await axios.get('/api/messages/dm-conversations/list');
      setConversations(response.data);
    } catch (err) {
      console.error('Failed to fetch conversations:', err);
    }
  };

  // Perform search queries on all users in workspace
  useEffect(() => {
    if (showSearch) {
      const delayDebounceFn = setTimeout(() => {
        performSearch(searchQuery);
      }, 150);
      return () => clearTimeout(delayDebounceFn);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery, showSearch]);

  const performSearch = async (queryVal) => {
    try {
      const response = await axios.get('/api/users/search', {
        params: { q: queryVal }
      });
      setSearchResults(response.data);
    } catch (err) {
      console.error('Failed to search users:', err);
    }
  };

  const handleStartDM = (user) => {
    onSelectDM(user);
    setShowSearch(false);
    setSearchQuery('');
  };

  return (
    <div className="dm-list">
      <button 
        className="start-dm-btn"
        onClick={() => setShowSearch(!showSearch)}
      >
        {showSearch ? '✕ Close Search' : '+ New DM'}
      </button>

      {showSearch && (
        <div className="dm-search" style={{ position: 'relative', marginBottom: '12px' }}>
          <input
            type="text"
            placeholder="Search users to message..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
            style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.2)', color: '#fff' }}
          />
          {searchResults.length > 0 ? (
            <div className="search-results" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: '#181920', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', maxHeight: '200px', overflowY: 'auto', marginTop: '4px', boxShadow: '0 4px 15px rgba(0,0,0,0.5)' }}>
              {searchResults.map(user => (
                <div
                  key={user.id}
                  className="search-result"
                  onClick={() => handleStartDM(user)}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                >
                  <div className="search-result-avatar" style={{ width: '24px', height: '24px', position: 'relative' }}>
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt={user.username} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      <div className="avatar-placeholder-xs" style={{ width: '100%', height: '100%', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 'bold' }}>
                        {user.username ? user.username[0].toUpperCase() : '?'}
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize: '0.9em', color: '#fff' }}>{user.username}</span>
                </div>
              ))}
            </div>
          ) : (
            searchQuery.trim() && <div className="search-no-results" style={{ padding: '8px 12px', fontSize: '0.85em', color: '#72767d', textAlign: 'center' }}>No users found</div>
          )}
        </div>
      )}

      <div className="conversations">
        {conversations.length === 0 ? (
          <p className="empty-message">No conversations</p>
        ) : (
          conversations.map(conv => (
            <div
              key={conv.other_user_id}
              className={`conversation-item ${selectedDM?.id === conv.other_user_id ? 'active' : ''}`}
              onClick={() => onSelectDM(conv)}
            >
              <h4>{conv.username}</h4>
              <p className="last-message">Last: {new Date(conv.last_message_at).toLocaleDateString()}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default DMList;
