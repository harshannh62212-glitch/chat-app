import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/FriendsPanel.css';

function FriendsPanel({ currentUser, onStartDM, onBack }) {
  const [activeSubTab, setActiveSubTab] = useState('chats'); // 'chats', 'all', 'pending', 'add'
  const [friends, setFriends] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [suggestedUsers, setSuggestedUsers] = useState([]);
  const [pendingIncoming, setPendingIncoming] = useState([]);
  const [pendingOutgoing, setPendingOutgoing] = useState([]);
  const [addUsername, setAddUsername] = useState('');
  const [addStatus, setAddStatus] = useState({ type: '', message: '' });
  const [loading, setLoading] = useState(false);

  // Discovery / search states
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    fetchFriendsData();
    fetchConversations();
    fetchSuggestedUsers();
  }, [activeSubTab]);

  const fetchFriendsData = async () => {
    try {
      const [friendsRes, pendingRes] = await Promise.all([
        axios.get('/api/users/friends/list'),
        axios.get('/api/users/friends/pending')
      ]);
      setFriends(Array.isArray(friendsRes.data) ? friendsRes.data : []);
      setPendingIncoming(pendingRes.data?.incoming || []);
      setPendingOutgoing(pendingRes.data?.outgoing || []);
    } catch (err) {
      console.error('Failed to fetch friends data:', err);
      setFriends([]);
      setPendingIncoming([]);
      setPendingOutgoing([]);
    }
  };

  const fetchConversations = async () => {
    try {
      const res = await axios.get('/api/messages/dm-conversations/list');
      setConversations(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to fetch DM conversations:', err);
      setConversations([]);
    }
  };

  const fetchSuggestedUsers = async () => {
    try {
      const res = await axios.get('/api/users/search', { params: { q: '' } });
      setSuggestedUsers(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to fetch suggested users:', err);
      setSuggestedUsers([]);
    }
  };

  // Search users for discoverability
  useEffect(() => {
    if (activeSubTab === 'add' || activeSubTab === 'chats') {
      const delayDebounceFn = setTimeout(() => {
        performUserSearch(searchQuery);
      }, 200);
      return () => clearTimeout(delayDebounceFn);
    } else {
      setSearchQuery('');
      setSearchResults([]);
    }
  }, [searchQuery, activeSubTab]);

  const performUserSearch = async (queryVal) => {
    if (!queryVal || !queryVal.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      setSearchLoading(true);
      const res = await axios.get('/api/users/search', {
        params: { q: queryVal }
      });
      setSearchResults(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to search users:', err);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSendFriendRequest = async (username) => {
    try {
      const res = await axios.post('/api/users/friends/request', { friendUsername: username });
      alert(res.data?.message || 'Friend request sent!');
      fetchFriendsData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to send friend request');
    }
  };

  const handleAddFriend = async (e) => {
    e.preventDefault();
    if (!addUsername.trim()) return;

    setLoading(true);
    setAddStatus({ type: '', message: '' });

    try {
      const res = await axios.post('/api/users/friends/request', {
        friendUsername: addUsername
      });
      setAddStatus({ type: 'success', message: res.data.message || 'Friend request sent successfully!' });
      setAddUsername('');
      fetchFriendsData();
    } catch (err) {
      setAddStatus({
        type: 'error',
        message: err.response?.data?.error || 'Failed to send friend request'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptRequest = async (requesterId) => {
    try {
      await axios.post('/api/users/friends/accept', { requesterId });
      fetchFriendsData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to accept friend request');
    }
  };

  const handleDeclineRequest = async (otherUserId) => {
    try {
      await axios.post('/api/users/friends/decline', { otherUserId });
      fetchFriendsData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to action friend request');
    }
  };

  const handleRemoveFriend = async (friendId) => {
    const confirmRemove = window.confirm('Are you sure you want to remove this friend?');
    if (!confirmRemove) return;

    try {
      await axios.post('/api/users/friends/decline', { otherUserId: friendId });
      fetchFriendsData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to remove friend');
    }
  };

  return (
    <div className="friends-panel">
      <div className="friends-header">
        <div className="friends-tab-title">
          {onBack && (
            <button 
              className="mobile-back-btn" 
              onClick={onBack}
              style={{
                background: 'none',
                border: 'none',
                color: '#fff',
                fontSize: '22px',
                cursor: 'pointer',
                marginRight: '8px',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '4px 8px',
                borderRadius: '6px'
              }}
              title="Go Back"
            >
              ←
            </button>
          )}
          <span>💬</span>
          <h3>Direct Messages & Friends</h3>
        </div>
        <div className="friends-sub-tabs">
          <button 
            className={`sub-tab-btn ${activeSubTab === 'chats' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('chats')}
          >
            💬 Messages
            {conversations.length > 0 && (
              <span className="count-badge">{conversations.length}</span>
            )}
          </button>
          <button 
            className={`sub-tab-btn ${activeSubTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('all')}
          >
            👥 Friends
            {friends.length > 0 && (
              <span className="count-badge">{friends.length}</span>
            )}
          </button>
          <button 
            className={`sub-tab-btn ${activeSubTab === 'pending' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('pending')}
          >
            ⏳ Pending
            {pendingIncoming.length > 0 && (
              <span className="pending-badge-count">{pendingIncoming.length}</span>
            )}
          </button>
          <button 
            className={`sub-tab-btn add-friend-tab-btn ${activeSubTab === 'add' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('add')}
          >
            ➕ Add Friend / Discover
          </button>
        </div>
      </div>

      <div className="friends-content-area">
        {/* TAB 1: ALL DIRECT MESSAGES / CONVERSATIONS */}
        {activeSubTab === 'chats' && (
          <div className="friends-list-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h4 style={{ margin: 0 }}>Recent Conversations ({conversations.length})</h4>
              <button 
                className="sub-tab-btn add-friend-tab-btn active"
                onClick={() => setActiveSubTab('add')}
                style={{ fontSize: '0.85em', padding: '6px 14px' }}
              >
                + New Chat
              </button>
            </div>

            {conversations.length > 0 ? (
              <div className="conversations-grid" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {conversations.map(conv => (
                  <div 
                    key={conv.other_user_id} 
                    className="friend-card glass-panel"
                    onClick={() => onStartDM(conv)}
                    style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
                  >
                    <div className="friend-card-info">
                      <div className="friend-avatar">
                        {conv.avatar_url ? (
                          <img src={conv.avatar_url} alt={conv.username} />
                        ) : (
                          <div className="avatar-placeholder">{conv.username ? conv.username[0].toUpperCase() : '?'}</div>
                        )}
                        <span className="status-indicator online"></span>
                      </div>
                      <div className="friend-details">
                        <span className="friend-name">{conv.username}</span>
                        <span className="friend-status-text" style={{ color: 'rgba(255,255,255,0.6)', maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {conv.last_message_content || 'Click to open conversation'}
                        </span>
                      </div>
                    </div>
                    <div className="friend-actions" style={{ alignItems: 'center', gap: '12px' }}>
                      {conv.last_message_at && (
                        <span style={{ fontSize: '0.75em', color: 'rgba(255,255,255,0.4)' }}>
                          {new Date(conv.last_message_at).toLocaleDateString()}
                        </span>
                      )}
                      <button 
                        className="friend-action-btn message-btn"
                        onClick={(e) => { e.stopPropagation(); onStartDM(conv); }}
                        title="Open Chat"
                      >
                        💬
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-friends-view" style={{ padding: '30px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>💬</div>
                <h3 style={{ margin: '0 0 8px 0', color: '#fff', fontSize: '1.4em' }}>Welcome to Direct Messages</h3>
                <p style={{ color: '#a4b0be', maxWidth: '450px', margin: '0 auto 24px auto', fontSize: '0.95em', lineHeight: '1.5' }}>
                  Connect 1-on-1 with anyone in the workspace. Select a member below to start chatting right away!
                </p>

                {suggestedUsers.length > 0 && (
                  <div style={{ marginTop: '20px', textAlign: 'left' }}>
                    <h4 style={{ marginBottom: '12px' }}>Active Community Members</h4>
                    <div className="friends-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px' }}>
                      {suggestedUsers.slice(0, 8).map(usr => (
                        <div key={usr.id} className="friend-card glass-panel" style={{ padding: '12px' }}>
                          <div className="friend-card-info" style={{ minWidth: 0 }}>
                            <div className="friend-avatar" style={{ width: '36px', height: '36px' }}>
                              {usr.avatar_url ? (
                                <img src={usr.avatar_url} alt={usr.username} />
                              ) : (
                                <div className="avatar-placeholder">{usr.username ? usr.username[0].toUpperCase() : '?'}</div>
                              )}
                              <span className="status-indicator online"></span>
                            </div>
                            <div className="friend-details" style={{ minWidth: 0 }}>
                              <span className="friend-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{usr.username}</span>
                              <span className="friend-status-text">Available</span>
                            </div>
                          </div>
                          <div className="friend-actions">
                            <button 
                              className="friend-action-btn message-btn"
                              onClick={() => onStartDM(usr)}
                              title="Start Direct Message"
                            >
                              💬
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: ALL FRIENDS */}
        {activeSubTab === 'all' && (
          <div className="friends-list-container">
            <h4>All Friends ({friends.length})</h4>
            {friends.length === 0 ? (
              <div className="empty-friends-view">
                <p>No friends added yet. Go to the "Add Friend / Discover" tab to find people to connect with!</p>
                <button 
                  className="sub-tab-btn add-friend-tab-btn active"
                  onClick={() => setActiveSubTab('add')}
                  style={{ marginTop: '16px', display: 'inline-block', padding: '10px 20px', fontWeight: 'bold' }}
                >
                  ➕ Discover People
                </button>
              </div>
            ) : (
              <div className="friends-grid">
                {friends.map(friend => (
                  <div key={friend.id} className="friend-card glass-panel">
                    <div className="friend-card-info">
                      <div className="friend-avatar">
                        {friend.avatar_url ? (
                          <img src={friend.avatar_url} alt={friend.username} />
                        ) : (
                          <div className="avatar-placeholder">{friend.username ? friend.username[0].toUpperCase() : '?'}</div>
                        )}
                        <span className="status-indicator online"></span>
                      </div>
                      <div className="friend-details">
                        <span className="friend-name">{friend.username}</span>
                        <span className="friend-status-text">Online</span>
                      </div>
                    </div>
                    <div className="friend-actions">
                      <button 
                        className="friend-action-btn message-btn"
                        onClick={() => onStartDM(friend)}
                        title="Start Chat"
                      >
                        💬
                      </button>
                      <button 
                        className="friend-action-btn remove-btn"
                        onClick={() => handleRemoveFriend(friend.id)}
                        title="Remove Friend"
                      >
                        ❌
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: PENDING REQUESTS */}
        {activeSubTab === 'pending' && (
          <div className="pending-list-container">
            <div className="pending-section">
              <h4>Incoming Requests ({pendingIncoming.length})</h4>
              {pendingIncoming.length === 0 ? (
                <p className="empty-pending-text">No incoming friend requests.</p>
              ) : (
                <div className="pending-list">
                  {pendingIncoming.map(req => (
                    <div key={req.user_id} className="pending-item glass-panel">
                      <div className="pending-user-info">
                        <div className="pending-avatar">
                          {req.avatar_url ? (
                            <img src={req.avatar_url} alt={req.username} />
                          ) : (
                            <div className="avatar-placeholder">{req.username ? req.username[0].toUpperCase() : '?'}</div>
                          )}
                        </div>
                        <span>{req.username}</span>
                      </div>
                      <div className="pending-actions">
                        <button 
                          className="accept-req-btn"
                          onClick={() => handleAcceptRequest(req.user_id)}
                        >
                          ✓ Accept
                        </button>
                        <button 
                          className="decline-req-btn"
                          onClick={() => handleDeclineRequest(req.user_id)}
                        >
                          ✕ Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pending-section" style={{ marginTop: '30px' }}>
              <h4>Sent Requests ({pendingOutgoing.length})</h4>
              {pendingOutgoing.length === 0 ? (
                <p className="empty-pending-text">No sent requests.</p>
              ) : (
                <div className="pending-list">
                  {pendingOutgoing.map(req => (
                    <div key={req.user_id} className="pending-item glass-panel">
                      <div className="pending-user-info">
                        <div className="pending-avatar">
                          {req.avatar_url ? (
                            <img src={req.avatar_url} alt={req.username} />
                          ) : (
                            <div className="avatar-placeholder">{req.username ? req.username[0].toUpperCase() : '?'}</div>
                          )}
                        </div>
                        <span>{req.username}</span>
                      </div>
                      <span className="outgoing-status-label">Request Sent</span>
                      <button 
                        className="cancel-req-btn"
                        onClick={() => handleDeclineRequest(req.user_id)}
                        title="Cancel Request"
                      >
                        ✕ Cancel
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: ADD FRIEND & DISCOVER USERS */}
        {activeSubTab === 'add' && (
          <div className="add-friend-container">
            <h4>Add Friend</h4>
            <p className="add-friend-description">You can add friends with their exact username (case-insensitive).</p>
            
            <form onSubmit={handleAddFriend} className="add-friend-form" style={{ marginBottom: '24px' }}>
              <input
                type="text"
                placeholder="Enter Username"
                value={addUsername}
                onChange={(e) => setAddUsername(e.target.value)}
                autoFocus
                required
              />
              <button type="submit" disabled={loading}>
                {loading ? 'Sending...' : 'Send Friend Request'}
              </button>
            </form>

            {addStatus.message && (
              <div className={`status-notification ${addStatus.type}`} style={{ marginBottom: '32px' }}>
                {addStatus.message}
              </div>
            )}

            <div className="discover-users-section" style={{ marginTop: '40px' }}>
              <h4 style={{ marginBottom: '12px' }}>Discover People & Quick Message</h4>
              <p className="add-friend-description" style={{ marginBottom: '16px' }}>Search and connect with anyone instantly in the workspace.</p>
              
              <input
                type="text"
                placeholder="Search users by username..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  color: '#fff',
                  fontSize: '0.95em',
                  marginBottom: '20px',
                  transition: 'border-color 0.2s'
                }}
              />

              {searchLoading ? (
                <div style={{ textAlign: 'center', color: '#72767d', padding: '20px 0' }}>Searching users...</div>
              ) : searchQuery.trim() && searchResults.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#72767d', padding: '20px 0', fontSize: '0.9em' }}>
                  No matching users found for "{searchQuery}"
                </div>
              ) : (
                <div className="pending-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {(searchQuery.trim() ? searchResults : suggestedUsers).map(usr => {
                    const isSelf = usr.id === currentUser.id;
                    const isFriend = friends.some(f => f.id === usr.id);
                    const isIncoming = pendingIncoming.some(p => p.user_id === usr.id);
                    const isOutgoing = pendingOutgoing.some(p => p.user_id === usr.id);

                    return (
                      <div key={usr.id} className="pending-item glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.04)' }}>
                        <div className="pending-user-info" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div className="pending-avatar" style={{ width: '34px', height: '34px' }}>
                            {usr.avatar_url ? (
                              <img src={usr.avatar_url} alt={usr.username} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                            ) : (
                              <div className="avatar-placeholder" style={{ width: '100%', height: '100%', borderRadius: '50%', background: 'rgba(255, 255, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: '#fff', fontSize: '12px' }}>
                                {usr.username ? usr.username[0].toUpperCase() : '?'}
                              </div>
                            )}
                          </div>
                          <div>
                            <span style={{ fontWeight: '600' }}>{usr.username}</span>
                            {isSelf && <span style={{ marginLeft: '8px', fontSize: '0.8em', color: 'rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '4px' }}>You</span>}
                          </div>
                        </div>
                        <div className="pending-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {!isSelf && (
                            <button
                              className="friend-action-btn message-btn"
                              onClick={() => onStartDM(usr)}
                              title="Direct Message"
                              style={{ width: '32px', height: '32px', fontSize: '14px' }}
                            >
                              💬
                            </button>
                          )}
                          {isFriend ? (
                            <span style={{ fontSize: '0.85em', color: '#3ba55d', fontWeight: '600', padding: '6px 12px', background: 'rgba(59, 165, 93, 0.1)', borderRadius: '4px' }}>
                              ✓ Friends
                            </span>
                          ) : isIncoming ? (
                            <button
                              className="accept-req-btn"
                              onClick={() => handleAcceptRequest(usr.id)}
                            >
                              ✓ Accept Request
                            </button>
                          ) : isOutgoing ? (
                            <span style={{ fontSize: '0.85em', color: '#72767d', fontStyle: 'italic', padding: '6px 12px' }}>
                              Request Sent
                            </span>
                          ) : isSelf ? null : (
                            <button
                              className="accept-req-btn"
                              onClick={() => handleSendFriendRequest(usr.username)}
                              style={{ background: '#5865f2' }}
                            >
                              + Add Friend
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default FriendsPanel;
