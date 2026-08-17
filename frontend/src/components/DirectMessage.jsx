import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { filterContent } from '../utils/contentFilter';
import { checkRateLimit } from '../utils/rateLimiter';
import GiphyPanel from './GiphyPanel';
import ReportButton from './ReportButton';
import '../styles/DirectMessage.css';

const getActiveSocketUrl = () => {
  const saved = localStorage.getItem('custom_proxy_target');
  if (saved) return saved;
  const activeHome = localStorage.getItem('active_home_target');
  if (activeHome) return activeHome;
  const activeNode = localStorage.getItem('active_backend_target');
  if (activeNode && !activeNode.includes('vercel.app')) return activeNode;
  return import.meta.env.PROD ? 'https://garlic-survey-closed-volunteer.trycloudflare.com' : 'http://localhost:8000';
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

  // 1. Fetch DMs helper
  const fetchDMs = async () => {
    try {
      const res = await axios.get(`/api/messages/dm/${dmUserId}`);
      if (res.data && Array.isArray(res.data)) {
        const mapped = res.data.map(m => ({
          id: m.id,
          senderId: m.sender_id,
          sender_id: m.sender_id,
          recipient_id: m.recipient_id,
          content: m.content,
          created_at: m.created_at
        }));
        setMessages(prev => {
          // Reconcile optimistic messages
          const optimisticMsgs = prev.filter(m => m.isOptimistic);
          const mappedIds = new Set(mapped.map(m => m.id));
          const stillPending = optimisticMsgs.filter(opt => !mapped.some(m => m.content === opt.content));
          return [...mapped, ...stillPending];
        });
      }
    } catch (err) {
      console.error('Failed to fetch direct messages:', err);
    } finally {
      setLoading(false);
    }
  };

  // 2. Real-Time Socket.IO Streaming
  useEffect(() => {
    if (currentUser?.id && dmUserId) {
      socket.emit('user-joined', currentUser.id, dmUserId);
    }

    const handleNewDM = (data) => {
      if (data.senderId === dmUserId || data.sender_id === dmUserId || data.dmWith === dmUserId) {
        const newMsg = {
          id: data.id || `dm_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          senderId: data.senderId || data.sender_id,
          sender_id: data.senderId || data.sender_id,
          recipient_id: data.recipient_id,
          content: data.content,
          created_at: data.created_at || data.timestamp || new Date().toISOString()
        };
        setMessages(prev => {
          if (prev.some(m => m.id === newMsg.id)) return prev;
          if (prev.some(m => m.content === newMsg.content && m.isOptimistic)) {
            return prev.map(m => (m.content === newMsg.content && m.isOptimistic) ? { ...newMsg, isOptimistic: false } : m);
          }
          return [...prev, newMsg];
        });
      }
    };

    const handleDMSent = (data) => {
      if (data.dmWith === dmUserId || data.recipient_id === dmUserId) {
        setMessages(prev => {
          if (prev.some(m => m.isOptimistic && m.content === data.content)) {
            return prev.map(m => (m.isOptimistic && m.content === data.content) ? { ...m, isOptimistic: false, id: data.id || m.id } : m);
          }
          if (prev.some(m => m.id === data.id)) return prev;
          return [...prev, {
            id: data.id || `dm_${Date.now()}`,
            senderId: currentUser.id,
            sender_id: currentUser.id,
            content: data.content,
            created_at: data.created_at || data.timestamp || new Date().toISOString()
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
    socket.on('new-dm-global', handleNewDM);
    socket.on('dm-sent', handleDMSent);
    socket.on('message-deleted', handleMessageDeleted);

    // Initial load + silent 2-second background sync
    fetchDMs();
    const syncInterval = setInterval(fetchDMs, 2000);

    return () => {
      socket.off('new-dm', handleNewDM);
      socket.off('new-dm-global', handleNewDM);
      socket.off('dm-sent', handleDMSent);
      socket.off('message-deleted', handleMessageDeleted);
      clearInterval(syncInterval);
    };
  }, [currentUser?.id, dmUserId]);

  // 3. Friendship Verification
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
      sender_id: currentUser.id,
      recipient_id: dmUserId,
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

    // 3. Background DB persist
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

  const formatTimestamp = (dateStr) => {
    if (!dateStr) return 'Just now';
    const d = new Date(dateStr);
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return isToday ? `Today at ${time}` : `${d.toLocaleDateString([], { month: '2-digit', day: '2-digit', year: '2-digit' })} ${time}`;
  };

  return (
    <div className="discord-dm-container">
      {/* 1. DISCORD TOP HEADER */}
      <div className="discord-dm-header">
        <div className="discord-dm-header-left">
          {onBack && (
            <button className="dm-back-btn" onClick={onBack} title="Back to conversations">
              ←
            </button>
          )}
          <span className="dm-at-symbol">@</span>
          <div className="dm-avatar-badge">
            {dmWith.avatar_url ? (
              <img src={dmWith.avatar_url} alt={dmUsername} />
            ) : (
              dmUsername.substring(0, 2).toUpperCase()
            )}
            <div className="dm-online-indicator" title="Online" />
          </div>
          <div className="dm-user-meta">
            <span className="dm-title-username">{dmUsername}</span>
            <span className="dm-tag-chip">Direct Message</span>
          </div>
        </div>

        <div className="discord-dm-header-right">
          {friendCheckLoading ? (
            <span style={{ fontSize: '0.78rem', color: '#949ba4' }}>Checking...</span>
          ) : friendshipStatus === 'none' ? (
            <button className="dm-request-pill-btn" onClick={handleAddFriend}>
              ➕ Add Friend
            </button>
          ) : friendshipStatus === 'incoming_pending' ? (
            <div style={{ display: 'flex', gap: '6px' }}>
              <button className="dm-accept-btn" onClick={handleAcceptFriend}>
                ✓ Accept
              </button>
              <button className="dm-decline-btn" onClick={handleDeclineFriend}>
                ✕
              </button>
            </div>
          ) : friendshipStatus === 'outgoing_pending' ? (
            <span style={{ fontSize: '0.78rem', color: '#f0b232', fontWeight: '600' }}>⏳ Request Sent</span>
          ) : (
            <span className="dm-friend-badge">👥 Friends</span>
          )}

          <ReportButton 
            contentType="user" 
            targetId={dmUserId} 
            reportedUsername={dmUsername} 
          />
        </div>
      </div>

      {/* 2. DISCORD MESSAGE FEED */}
      <div className="discord-dm-messages">
        {/* Discord Hero Header at start of chat */}
        <div className="dm-hero-banner">
          <div className="dm-hero-avatar-large">
            {dmWith.avatar_url ? (
              <img src={dmWith.avatar_url} alt={dmUsername} />
            ) : (
              dmUsername.substring(0, 2).toUpperCase()
            )}
          </div>
          <h2 className="dm-hero-title">{dmUsername}</h2>
          <p className="dm-hero-desc">
            This is the beginning of your direct message history with <strong>@{dmUsername}</strong>.
          </p>
          <button 
            className="dm-wave-btn"
            onClick={() => sendDM(`👋 Hello @${dmUsername}!`)}
          >
            👋 Wave to @{dmUsername}
          </button>
        </div>

        {/* Message Items */}
        {loading && messages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px', color: '#949ba4' }}>Loading messages...</div>
        ) : (
          messages.map(msg => {
            const isSelf = msg.senderId === currentUser.id || msg.sender_id === currentUser.id;
            return (
              <div key={msg.id} className={`discord-msg-row ${msg.isOptimistic ? 'optimistic-message' : ''}`}>
                <div className="discord-msg-avatar">
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
                <div className="discord-msg-body">
                  <div className="discord-msg-meta">
                    <span className={`discord-author-name ${isSelf ? 'self' : ''}`}>
                      {isSelf ? currentUser.username : dmUsername}
                    </span>
                    <span className="discord-msg-time">
                      {formatTimestamp(msg.created_at)}
                    </span>
                  </div>
                  <div className="discord-msg-text">
                    {msg.content && msg.content.startsWith('http') && (msg.content.includes('.gif') || msg.content.includes('giphy.com') || msg.content.includes('tenor.com')) ? (
                      <img src={msg.content} alt="GIF" className="discord-msg-gif" />
                    ) : (
                      msg.content
                    )}
                  </div>
                </div>

                {/* Floating hover toolbar */}
                <div className="discord-msg-actions">
                  {isSelf && (
                    <button 
                      className="discord-action-btn delete-btn"
                      onClick={() => handleDeleteMessage(msg.id)}
                      title="Delete Message"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 3. DISCORD FLOATING PILL INPUT AREA */}
      <div className="discord-dm-input-wrapper">
        {showGiphy && (
          <div className="discord-giphy-popover">
            <GiphyPanel onSelectGif={handleSelectGif} onClose={() => setShowGiphy(false)} />
          </div>
        )}
        <form onSubmit={handleSendMessage} className="discord-input-pill">
          <button 
            type="button" 
            className="discord-attach-icon-btn"
            onClick={() => setShowGiphy(!showGiphy)}
            title="Add GIF or media"
          >
            +
          </button>
          <input
            type="text"
            className="discord-main-text-input"
            placeholder={`Message @${dmUsername}`}
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
          />
          <div className="discord-input-tools">
            <button 
              type="button" 
              className="discord-gif-btn"
              onClick={() => setShowGiphy(!showGiphy)}
              title="GIF Library"
            >
              GIF
            </button>
            <button 
              type="submit" 
              className="discord-send-icon-btn"
              disabled={!messageInput.trim()}
              title="Send Message"
            >
              ➤
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default DirectMessage;
