import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { filterContent } from '../utils/contentFilter';
import { checkRateLimit } from '../utils/rateLimiter';
import GiphyPanel from './GiphyPanel';
import ReportButton from './ReportButton';


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

  // Verify friendship status
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

    try {
      const res = await axios.post('/api/messages/dm', {
        recipientId: dmUserId,
        content: filteredContent
      });
      const newMsg = res.data;
      setMessages(prev => [...prev, {
        id: newMsg.id,
        senderId: newMsg.sender_id,
        content: newMsg.content,
        created_at: newMsg.created_at
      }]);
    } catch (err) {
      console.error('Failed to send direct message:', err);
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
      <div className="chat-header">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                display: 'none',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '4px 8px',
                borderRadius: '6px',
                transition: 'background 0.2s'
              }}
            >
              ←
            </button>
          )}
          💬 {dmUsername}
        </h2>
        <div className="header-info">
          <span className="chat-header-brand" style={{ color: '#00ffff', fontWeight: 'bold', letterSpacing: '0.5px', fontSize: '0.85em', textTransform: 'uppercase', marginRight: '10px' }}>wired-io</span>
          <button 
            className="header-settings-btn"
            onClick={onOpenSettings}
            title="Settings"
          >
            ⚙️
          </button>
        </div>
      </div>

      {friendCheckLoading ? (
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#72767d' }}>
          Loading profile...
        </div>
      ) : friendshipStatus !== 'friend' ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '40px', textAlign: 'center' }}>
          <div className="welcome-island" style={{ maxWidth: '480px', padding: '40px', background: 'rgba(23, 25, 35, 0.5)', borderRadius: '24px', border: '1px solid rgba(255, 255, 255, 0.06)', boxShadow: '0 20px 50px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
            <div style={{ position: 'relative', width: '100px', height: '100px' }}>
              {dmWith.avatar_url ? (
                <img src={dmWith.avatar_url} alt={dmUsername} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', border: '2px solid #5865f2' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: 'rgba(255, 255, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '36px', fontWeight: 'bold', border: '2px solid #5865f2' }}>
                  {dmUsername ? dmUsername[0].toUpperCase() : '?'}
                </div>
              )}
            </div>
            <div>
              <h2 style={{ fontSize: '1.8em', marginBottom: '8px', color: '#fff' }}>{dmUsername}</h2>
              <p style={{ color: '#72767d', fontSize: '0.95em', lineHeight: '1.5' }}>
                You are not friends with {dmUsername} yet. Direct messaging is restricted to friends only.
              </p>
            </div>
            
            <div style={{ width: '100%', marginTop: '10px' }}>
              {friendshipStatus === 'incoming_pending' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <p style={{ color: '#00ffff', fontSize: '0.85em', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '4px' }}>
                    Sent you a friend request
                  </p>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                      onClick={handleAcceptFriend}
                      style={{ flex: 1, padding: '12px', background: '#248046', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
                    >
                      ✓ Accept Request
                    </button>
                    <button
                      onClick={handleDeclineFriend}
                      style={{ flex: 1, padding: '12px', background: 'rgba(240,71,71,0.1)', color: '#f04747', border: '1px solid rgba(240,71,71,0.3)', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
                    >
                      ✕ Decline
                    </button>
                  </div>
                </div>
              ) : friendshipStatus === 'outgoing_pending' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.9em', color: '#b9bbbe', fontStyle: 'italic' }}>
                    Friend request is pending
                  </span>
                  <button
                    onClick={handleDeclineFriend}
                    style={{ width: '100%', padding: '12px', background: 'rgba(255, 255, 255, 0.05)', color: '#fff', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
                  >
                    Cancel Sent Request
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleAddFriend}
                  style={{ width: '100%', padding: '12px', background: '#5865f2', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
                >
                  + Add Friend
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="messages">
            {loading ? (
              <p>Loading messages...</p>
            ) : messages.length === 0 ? (
              <p className="no-messages">No messages yet. Start the conversation!</p>
            ) : (
              messages.map((msg) => (
                <div 
                  key={msg.id} 
                  className={`message ${msg.senderId === currentUser.id ? 'sent' : 'received'}`}
                  style={{ position: 'relative' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: '0.85em', color: '#72767d', fontWeight: 'bold' }}>
                      {msg.senderId === currentUser.id ? 'You' : dmUsername}
                    </span>
                    {(msg.senderId === currentUser.id || currentUser.is_admin) && (
                      <button
                        className="delete-msg-btn"
                        onClick={() => handleDeleteMessage(msg.id)}
                        title="Delete Message"
                      >
                        🗑️
                      </button>
                    )}
                    <ReportButton messageId={msg.id} />
                  </div>
                  {msg.content.startsWith('http') && msg.content.includes('giphy.com') ? (
                    <img src={msg.content} className="message-gif" alt="GIF" />
                  ) : (
                    <p>{msg.content}</p>
                  )}
                  <span className="timestamp">
                    {new Date(msg.created_at).toLocaleTimeString()}
                  </span>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSendMessage} className="message-input-form-wrapper">
            {showGiphy && (
              <GiphyPanel 
                onSelectGif={handleSelectGif}
                onClose={() => setShowGiphy(false)}
              />
            )}
            <div className="message-input">
              <button 
                type="button" 
                className="giphy-toggle-btn"
                onClick={() => setShowGiphy(!showGiphy)}
                title="Send a GIF"
              >
                GIF
              </button>
              <input
                type="text"
                placeholder="Type a message..."
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
              />
              <button type="submit">Send</button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}

export default DirectMessage;
