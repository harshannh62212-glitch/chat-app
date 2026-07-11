import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

function DMList({ onSelectDM, selectedDM, currentUser }) {
  const [conversations, setConversations] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearch, setShowSearch] = useState(false);

  // Listen to DM conversations in real-time
  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const { data, error } = await supabase
          .from('dm_conversations')
          .select('*')
          .contains('participants', [currentUser.id])
          .order('last_message_at', { ascending: false });
        
        if (error) throw error;

        if (data) {
          const convList = data.map(conv => {
            const otherUserId = conv.participants.find(p => p !== currentUser.id);
            const otherUsername = conv.usernames?.[otherUserId] || 'Someone';
            return {
              id: otherUserId,
              other_user_id: otherUserId,
              username: otherUsername,
              last_message_content: conv.last_message_content || 'No messages yet',
              last_message_at: conv.last_message_at
            };
          });
          setConversations(convList);
        }
      } catch (err) {
        console.error('Failed to fetch conversations:', err);
      }
    };

    fetchConversations();

    const channel = supabase
      .channel(`dm-conv-list-${currentUser.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'dm_conversations'
      }, () => {
        fetchConversations();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser.id]);

  // Debounce search input
  useEffect(() => {
    if (showSearch && searchQuery.trim().length > 0) {
      const delayDebounce = setTimeout(() => {
        searchUsers();
      }, 300);
      return () => clearTimeout(delayDebounce);
    } else {
      setSearchResults([]);
    }
  }, [showSearch, searchQuery]);

  const searchUsers = async () => {
    const term = searchQuery.trim();
    if (!term) return;

    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, username')
        .ilike('username', `${term}%`)
        .neq('id', currentUser.id)
        .eq('is_banned', false);
      
      if (error) throw error;
      if (data) setSearchResults(data);
    } catch (err) {
      console.error('Failed to search users:', err);
    }
  };

  const handleStartDM = (targetUser) => {
    onSelectDM({
      id: targetUser.id,
      other_user_id: targetUser.id,
      username: targetUser.username
    });
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
              {searchResults.map(u => (
                <div
                  key={u.id}
                  className="search-result"
                  onClick={() => handleStartDM(u)}
                >
                  <span>{u.username}</span>
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
                  {conv.last_message_at ? new Date(conv.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
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
