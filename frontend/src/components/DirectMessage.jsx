import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { filterContent } from '../utils/contentFilter';
import { checkRateLimit } from '../utils/rateLimiter';
import GiphyPanel from './GiphyPanel';
import ReportButton from './ReportButton';

const getActiveSocketUrl = () => {
  const saved = localStorage.getItem('custom_proxy_target');
  if (saved) return saved;
  const activeNode = localStorage.getItem('active_backend_target');
  if (activeNode) return activeNode;
  return import.meta.env.PROD ? window.location.origin : 'http://localhost:8000';
};

const socket = io(getActiveSocketUrl(), {
  autoConnect: true,
  extraHeaders: {
    'bypass-tunnel-reminder': 'true'
  }
});

function DirectMessage({ dmWith, currentUser, onOpenSettings, onBack }) {
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [showGiphy, setShowGiphy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [friendshipStatus, setFriendshipStatus] = useState('none'); // 'none', 'friend', 'incoming_pending', 'outgoing_pending'
  const [friendCheckLoading, setFriendCheckLoading] = useState(true);
  const messagesEndRef = useRef(null);

  const dmUserId = dmWith.id || dmWith.other_user_id;
  const dmUsername = dmWith.username;

  // Sorted alphabetical ID to be unique for the pair
  const conversationId = currentUser.id < dmUserId 
    ? `${currentUser.id}_${dmUserId}` 
    : `${dmUserId}_${currentUser.id}`;

  // 1. Socket.IO Real-time Room Joining & Listeners
  useEffect(() => {
    if (currentUser?.id && dmUserId) {
      socket.emit('user-joined', currentUser.id, dmUserId);
    }

    const handleNewDM = (data) => {
      // Received a DM from this person
      if (data.senderId === dmUserId) {
        const newMsg = {
          id: data.id || `dm_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          senderId: data.senderId,
          content: data.content,
          created_at: data.timestamp || new Date().toISOString()
        };
        setMessages(prev => {
          if (prev.some(m => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
      }
    };

    const handleDMSent = (data) => {
      // Confirmation/echo of DM sent to this person
      if (data.dmWith === dmUserId) {
        setMessages(prev => {
          if (prev.some(m => m.isOptimistic && m.content === data.content)) {
            return prev.map(m => (m.isOptimistic && m.content === data.content) ? { ...m, isOptimistic: false } : m);
          }
          if (prev.some(m => m.id === data.id)) return prev;
          return [...prev, {
            id: data.id || `dm_${Date.now()}`,
            senderId: currentUser.id,
            content: data.content,
            created_at: data.timestamp || new Date().toISOString()
          }];
        });
      }
    };

    const handleMessageDeleted = (data) => {
      if (data.type === 'dm') {
        setMessages(prev => prev.filter(m => m.id.toString() !== data.id.toString()));
      }
    };

    socket.on('new-dm', handleNewDM);
    socket.on('dm-sent', handleDMSent);
    socket.on('message-deleted', handleMessageDeleted);

    return () => {
      socket.off('new-dm', handleNewDM);
      socket.off('dm-sent', handleDMSent);
      socket.off('message-deleted', handleMessageDeleted);
    };
  }, [currentUser?.id, dmUserId]);

  // 2. Verify friendship status
  useEffect(() => {
    const checkFriendship = async () => {
      try {
        setFriendCheckLoading(true);
        const [friendsRes, pendingRes] = await Promise.all([
          axios.get('/api/users/friends/list'),
          axios.get('/api/users/friends/pending')
        ]);
        
        const friendsList = friendsRes.data || [];
        const incomingList = pendingRes.data?.incoming || [];
        const outgoingList = pendingRes.data?.outgoing || [];
        
        if (friendsList.some(f => f.id === dmUserId)) {
          setFriendshipStatus('friend');
        } else if (incomingList.some(p => p.user_id === dmUserId)) {
          setFriendshipStatus('incoming_pending');
        } else if (outgoingList.some(p => p.user_id === dmUserId)) {
          setFriendshipStatus('outgoing_pending');
        } else {
          setFriendshipStatus('none');
        }
      } catch (err) {
        console.error('Failed to verify friendship status:', err);
        setFriendshipStatus('none');
      } finally {
        setFriendCheckLoading(false);
      }
    };
    checkFriendship();
  }, [dmUserId]);

  const handleAddFriend = async () => {
    try {
      setFriendCheckLoading(true);
      await axios.post('/api/users/friends/request', { friendUsername: dmUsername });
      setFriendshipStatus('outgoing_pending');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to send friend request');
    } finally {
      setFriendCheckLoading(false);
    }
  };

  const handleAcceptFriend = async () => {
    try {
      setFriendCheckLoading(true);
      await axios.post('/api/users/friends/accept', { requesterId: dmUserId });
      setFriendshipStatus('friend');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to accept friend request');
    } finally {
      setFriendCheckLoading(false);
    }
  };

  const handleDeclineFriend = async () => {
    try {
      setFriendCheckLoading(true);
      await axios.post('/api/users/friends/decline', { otherUserId: dmUserId });
      setFriendshipStatus('none');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to action request');
    } finally {
      setFriendCheckLoading(false);
    }
  };

  // Fetch DMs
  useEffect(() => {
    setLoading(true);
    const fetchDMs = async () => {
      try {
        const res = await axios.get(`/api/messages/dm/${dmUserId}`);
        if (res.data) {
          const mapped = res.data.map(m => ({
            id: m.id,
            senderId: m.sender_id,
            content: m.content,
            created_at: m.created_at
          }));
          setMessages(mapped);
        }
      } catch (err) {
        console.error('Failed to fetch direct messages:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDMs();
  }, [dmUserId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!messageInput.trim()) return;

    if (messageInput.trim().length < 2) {
      alert('Message must be at least 2 characters long.');
      return;
    }

    if (!checkRateLimit(currentUser.is_admin)) {
      alert('Slow down! You can only send 1 message per second.');
      return;
    }

    const content = messageInput;
    setMessageInput('');
    await sendDM(content);
  };

  const sendDM = async (contentStr) => {
    const filteredContent = filterContent(contentStr);
    const tempId = `opt_dm_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;

    const optimisticMsg = {
      id: tempId,
      senderId: currentUser.id,
      recipientId: dmUserId,
      content: filteredContent,
      created_at: new Date().toISOString(),
      isOptimistic: true
    };

    // 1. INSTANT (0ms) local state update
    setMessages(prev => [...prev, optimisticMsg]);

    // 2. INSTANT Socket.IO broadcast to recipient
    socket.emit('send-message', {
      id: tempId,
      senderId: currentUser.id,
      dmWith: dmUserId,
      content: filteredContent
    });

    // 3. Asynchronous DB persist in background
    try {
      const res = await axios.post('/api/messages/dm', {
        recipientId: dmUserId,
        content: filteredContent
      });
      const newMsg = res.data;
      setMessages(prev => prev.map(m => m.id === tempId ? {
        ...m,
        id: newMsg.id,
        isOptimistic: false
      } : m));
    } catch (err) {
      console.error('Failed to persist direct message:', err);
    }
  };

  const handleSelectGif = async (gifUrl) => {
    if (!checkRateLimit(currentUser.is_admin)) {
      alert('Slow down! You can only send 1 message per second.');
      return;
    }

    setShowGiphy(false);
    await sendDM(gifUrl);
  };

  const handleDeleteMessage = async (msgId) => {
    const confirmDelete = window.confirm('Are you sure you want to delete this message?');
    if (!confirmDelete) return;

    try {
      await axios.delete(`/api/messages/dm/${msgId}`);
      setMessages(prev => prev.filter(m => m.id !== msgId));
    } catch (err) {
      console.error('Failed to delete message:', err);
    }
  };

  return (
    <div className="direct-message">
      <div className="dm-header">
        <div className="dm-header-left">
          {onBack && (
            <button className="mobile-back-btn" onClick={onBack} title="Back to conversations">
              ←
            </button>
          )}
          <div className="dm-avatar">
            {dmWith.avatar_url ? (
              <img src={dmWith.avatar_url} alt={dmUsername} />
            ) : (
              dmUsername.substring(0, 2).toUpperCase()
            )}
          </div>
          <div className="dm-user-info">
            <span className="dm-username">@{dmUsername}</span>
            <span className="dm-status-badge">Direct Conversation</span>
          </div>
        </div>
        <div className="dm-header-actions">
          {friendCheckLoading ? (
            <span className="friend-status-loading">Checking...</span>
          ) : friendshipStatus === 'none' ? (
            <button className="add-friend-btn" onClick={handleAddFriend}>
              ➕ Add Friend
            </button>
          ) : friendshipStatus === 'incoming_pending' ? (
            <div className="friend-action-group">
              <button className="accept-friend-btn" onClick={handleAcceptFriend}>
                ✓ Accept Friend Request
              </button>
              <button className="decline-friend-btn" onClick={handleDeclineFriend}>
                ✕
              </button>
            </div>
          ) : friendshipStatus === 'outgoing_pending' ? (
            <span className="pending-status-text">⏳ Friend Request Sent</span>
          ) : (
            <span className="friend-badge">👥 Friends</span>
          )}
          <ReportButton 
            contentType="user" 
            targetId={dmUserId} 
            reportedUsername={dmUsername} 
          />
        </div>
      </div>

      <div className="dm-messages">
        {loading ? (
          <div className="dm-loading">Loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="dm-empty">
            <div className="dm-empty-avatar">
              {dmWith.avatar_url ? (
                <img src={dmWith.avatar_url} alt={dmUsername} />
              ) : (
                dmUsername.substring(0, 2).toUpperCase()
              )}
            </div>
            <h3>This is the beginning of your direct message history with @{dmUsername}.</h3>
            <p>Say hello to start the conversation!</p>
          </div>
        ) : (
          messages.map(msg => {
            const isSelf = msg.senderId === currentUser.id;
            return (
              <div key={msg.id} className={`dm-message ${isSelf ? 'self' : 'other'} ${msg.isOptimistic ? 'optimistic-message' : ''}`}>
                <div className="dm-message-avatar">
                  {isSelf ? (
                    currentUser.avatar_url ? (
                      <img src={currentUser.avatar_url} alt={currentUser.username} />
                    ) : (
                      currentUser.username.substring(0, 2).toUpperCase()
                    )
                  ) : dmWith.avatar_url ? (
                    <img src={dmWith.avatar_url} alt={dmUsername} />
                  ) : (
                    dmUsername.substring(0, 2).toUpperCase()
                  )}
                </div>
                <div className="dm-message-content">
                  <div className="dm-message-header">
                    <span className="dm-message-author">
                      {isSelf ? currentUser.username : dmUsername}
                    </span>
                    <span className="dm-message-time">
                      {msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                    </span>
                    {isSelf && (
                      <button 
                        className="delete-msg-btn"
                        onClick={() => handleDeleteMessage(msg.id)}
                        title="Delete Message"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                  <div className="dm-message-body">
                    {msg.content.startsWith('http') && (msg.content.includes('.gif') || msg.content.includes('giphy.com') || msg.content.includes('tenor.com')) ? (
                      <img src={msg.content} alt="GIF" className="chat-gif" />
                    ) : (
                      msg.content
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="dm-input-area">
        {showGiphy && (
          <div className="giphy-popover">
            <GiphyPanel onSelectGif={handleSelectGif} onClose={() => setShowGiphy(false)} />
          </div>
        )}
        <form onSubmit={handleSendMessage} className="dm-form">
          <button 
            type="button" 
            className="gif-btn"
            onClick={() => setShowGiphy(!showGiphy)}
            title="Choose a GIF"
          >
            GIF
          </button>
          <input
            type="text"
            placeholder={`Message @${dmUsername}`}
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
          />
          <button type="submit" className="dm-send-btn">
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

export default DirectMessage;
