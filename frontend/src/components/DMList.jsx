import React, { useState, useEffect } from 'react';
import axios from 'axios';

function DMList({ onSelectDM, selectedDM, socket }) {
  const [conversations, setConversations] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    fetchConversations();
    const interval = setInterval(fetchConversations, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (socket) {
      const handleRefresh = () => {
        fetchConversations();
      };
      socket.on('new-dm', handleRefresh);
      socket.on('dm-sent', handleRefresh);
      return () => {
        socket.off('new-dm', handleRefresh);
        socket.off('dm-sent', handleRefresh);
      };
    }
  }, [socket]);

  useEffect(() => {
    if (showSearch) {
      const delayDebounce = setTimeout(() => {
        fetchUsers();
      }, 300);
      return () => clearTimeout(delayDebounce);
    } else {
      setSearchResults([]);
    }
  }, [showSearch, searchQuery]);

  const fetchConversations = async () => {
    try {
      const response = await axios.get('/api/messages/dm-conversations/list');
      setConversations(response.data);
    } catch (err) {
      console.error('Failed to fetch conversations:', err);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await axios.get('/api/users/search', {
        params: { q: searchQuery }
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
        {showSearch ? 'Cancel' : '+ New DM'}
      </button>

      {showSearch && (
        <form onSubmit={(e) => e.preventDefault()} className="dm-search">
          <input
            type="text"
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />
          {searchResults.length > 0 && (
            <div className="search-results">
              {searchResults.map(user => (
                <div
                  key={user.id}
                  className="search-result"
                  onClick={() => handleStartDM(user)}
                >
                  <span>{user.username}</span>
                </div>
              ))}
            </div>
          )}
        </form>
      )}

      <div className="conversations">
        {conversations.length === 0 ? (
          <p className="empty-message">No conversations</p>
        ) : (
          conversations.map(conv => (
            <div
              key={conv.other_user_id}
              className={`conversation-item ${(selectedDM?.id || selectedDM?.other_user_id) === conv.other_user_id ? 'active' : ''}`}
              onClick={() => onSelectDM(conv)}
              style={{ position: 'relative' }}
            >
              <div className="conversation-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ margin: 0 }}>{conv.username}</h4>
                <span className="last-message-time" style={{ fontSize: '0.75em', color: '#72767d' }}>
                  {new Date(conv.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="last-message" style={{ margin: '4px 0 0 0' }}>
                {conv.last_message_content || 'No messages yet'}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default DMList;
