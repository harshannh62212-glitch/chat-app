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

// Universal bulletproof message updater that guarantees ZERO duplicate bubbles
const upsertMessage = (prev, newMsg) => {
  if (!newMsg || !newMsg.content) return prev;

  const newSenderId = newMsg.sender_id || newMsg.senderId;

  // 1. Match by exact permanent ID
  const matchById = prev.findIndex(m => m.id && newMsg.id && String(m.id) === String(newMsg.id));
  if (matchById !== -1) {
    const updated = [...prev];
    updated[matchById] = { ...updated[matchById], ...newMsg, isOptimistic: false };
    return updated;
  }

  // 2. Match by temporary client nonce / tempId
  if (newMsg.tempId) {
    const matchByTemp = prev.findIndex(m => (m.tempId && m.tempId === newMsg.tempId) || (m.id && m.id === newMsg.tempId));
    if (matchByTemp !== -1) {
      const updated = [...prev];
      updated[matchByTemp] = { ...updated[matchByTemp], ...newMsg, tempId: undefined, isOptimistic: false };
      return updated;
    }
  }

  // 3. Match pending optimistic message by same author + same content
  const matchOptimistic = prev.findIndex(m => 
    m.isOptimistic && 
    (m.sender_id === newSenderId || m.senderId === newSenderId) && 
    m.content.trim() === newMsg.content.trim()
  );
  if (matchOptimistic !== -1) {
    const updated = [...prev];
    updated[matchOptimistic] = { ...updated[matchOptimistic], ...newMsg, tempId: undefined, isOptimistic: false };
    return updated;
  }

  // 4. Match identical content from the same author sent within 4 seconds (prevents duplicate echoes)
  const isDuplicate = prev.some(m => {
    const mSenderId = m.sender_id || m.senderId;
    if (mSenderId !== newSenderId) return false;
    if (m.content.trim() !== newMsg.content.trim()) return false;
    const timeDiff = Math.abs(new Date(m.created_at || Date.now()).getTime() - new Date(newMsg.created_at || Date.now()).getTime());
    return timeDiff < 4000;
  });

  if (isDuplicate) {
    return prev;
  }

  return [...prev, newMsg];
};

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
          // Keep only optimistic messages that haven't landed in the DB yet
          const stillPending = prev.filter(p => 
            p.isOptimistic && 
            !mapped.some(m => String(m.id) === String(p.id) || (m.content.trim() === p.content.trim() && (m.sender_id === p.sender_id || m.sender_id === p.senderId)))
          );
          return [...mapped, ...stillPending];
        });
      }
    } catch (err) {
      console.error('Failed to fetch direct messages:', err);
    } finally {
      setLoading(false);
    }
  };

  // 2. Real-Time Socket.IO Streaming with precise targeted handlers
  useEffect(() => {
    if (currentUser?.id && dmUserId) {
      socket.emit('user-joined', currentUser.id, dmUserId);
    }

    // Handle incoming DM from partner
    const handleNewDM = (data) => {
      const sender = data.sender_id || data.senderId;
      const recipient = data.recipient_id || data.recipientId;
      
      // Strict filter: ONLY messages FROM the partner TO current user
      if (sender === dmUserId) {
        const newMsg = {
          id: data.id || `dm_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          senderId: sender,
          sender_id: sender,
          recipient_id: recipient,
          content: data.content,
          created_at: data.created_at || data.timestamp || new Date().toISOString()
        };

        setMessages(prev => upsertMessage(prev, newMsg));
      }
    };

    // Handle confirmation of sent message
    const handleDMSent = (data) => {
      const recipient = data.recipient_id || data.dmWith;
      const sender = data.sender_id || data.senderId;

      if ((sender === currentUser.id || !sender) && (recipient === dmUserId)) {
        const confirmedMsg = {
          id: data.id,
          tempId: data.tempId,
          senderId: currentUser.id,
          sender_id: currentUser.id,
          recipient_id: dmUserId,
          content: data.content,
          created_at: data.created_at || data.timestamp || new Date().toISOString()
        };

        setMessages(prev => upsertMessage(prev, confirmedMsg));
      }
    };

    const handleMessageDeleted = (data) => {
      if (data.type === 'dm') {
        setMessages(prev => prev.filter(m => String(m.id) !== String(data.id)));
      }
    };

    socket.on('new-dm', handleNewDM);
    socket.on('dm-sent', handleDMSent);
    socket.on('message-deleted', handleMessageDeleted);

    // Initial load + silent 3-second background sync
    fetchDMs();
    const syncInterval = setInterval(fetchDMs, 3000);

    return () => {
      socket.off('new-dm', handleNewDM);
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
    const tempId = `opt_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    const optimisticMsg = {
      id: tempId,
      tempId: tempId,
      senderId: currentUser.id,
      sender_id: currentUser.id,
      recipient_id: dmUserId,
      content: filteredContent,
      created_at: new Date().toISOString(),
      isOptimistic: true
    };

    // 1. Instant 0ms local state insertion
    setMessages(prev => upsertMessage(prev, optimisticMsg));

    // 2. Background DB persist with tempId (routes/messages.js will emit socket event on success)
    try {
      const res = await axios.post('/api/messages/dm', {
        recipientId: dmUserId,
        content: filteredContent,
        tempId: tempId
      });
      const newMsg = res.data;
      setMessages(prev => upsertMessage(prev, {
        ...newMsg,
        tempId: tempId,
        senderId: currentUser.id,
        sender_id: currentUser.id,
        recipient_id: dmUserId
      }));
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
      setMessages(prev => prev.filter(m => String(m.id) !== String(msgId)));
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
              <div key={msg.id || msg.tempId} className={`discord-msg-row ${msg.isOptimistic ? 'optimistic-message' : ''}`}>
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
