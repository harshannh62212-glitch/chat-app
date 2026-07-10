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
