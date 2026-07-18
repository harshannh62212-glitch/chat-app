import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { supabase } from '../supabase';
import { filterContent } from '../utils/contentFilter';
import { checkRateLimit } from '../utils/rateLimiter';
import GiphyPanel from './GiphyPanel';

function DirectMessage({ dmWith, currentUser, onOpenSettings }) {
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [showGiphy, setShowGiphy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isFriend, setIsFriend] = useState(false);
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
        const res = await axios.get('/api/users/friends/list');
        const friendsList = res.data || [];
        const isFound = friendsList.some(f => f.id === dmUserId);
        setIsFriend(isFound);
      } catch (err) {
        console.error('Failed to verify friendship status:', err);
        setIsFriend(false);
      } finally {
        setFriendCheckLoading(false);
      }
    };
    checkFriendship();
  }, [dmUserId]);

  // Listen to messages in real-time
  useEffect(() => {
    setLoading(true);
    const fetchDMs = async () => {
      try {
        const { data, error } = await supabase
          .from('direct_messages')
          .select('*')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true });
        
        if (error) throw error;
        if (data) {
          const mapped = data.map(m => ({
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

    const channel = supabase
      .channel(`dms-${conversationId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'direct_messages',
        filter: `conversation_id=eq.${conversationId}`
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const newMsg = payload.new;
          setMessages(prev => [...prev, {
            id: newMsg.id,
            senderId: newMsg.sender_id,
            content: newMsg.content,
            created_at: newMsg.created_at
          }]);
        } else if (payload.eventType === 'DELETE') {
          setMessages(prev => prev.filter(m => m.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!messageInput.trim()) return;

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
      // 1. Add DM message
      const { error: msgErr } = await supabase.from('direct_messages').insert({
        conversation_id: conversationId,
        sender_id: currentUser.id,
        recipient_id: dmUserId,
        sender_username: currentUser.username,
        content: filteredContent
      });

      if (msgErr) throw msgErr;
    } catch (err) {
      console.error('Failed to send DM:', err);
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
      const { error } = await supabase
        .from('direct_messages')
        .delete()
        .eq('id', msgId);
      if (error) throw error;
    } catch (err) {
      console.error('Failed to delete message:', err);
    }
  };

  return (
    <div className="direct-message">
      <div className="chat-header">
        <h2>💬 {dmUsername}</h2>
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
        {friendCheckLoading ? (
          <div className="message-input" style={{ justifyContent: 'center', alignItems: 'center', color: '#72767d', fontSize: '0.9em' }}>
            Verifying friendship status...
          </div>
        ) : !isFriend ? (
          <div className="message-input friendship-lock" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '16px 20px', background: 'rgba(240, 71, 71, 0.05)', borderTop: '1px solid rgba(240, 71, 71, 0.2)', textAlign: 'center' }}>
            <span style={{ fontSize: '1.2em' }}>🔒</span>
            <span style={{ fontSize: '0.9em', color: '#ff5b5b', fontWeight: '500' }}>
              You can only send messages to friends. Send a friend request to <strong>{dmUsername}</strong> to chat!
            </span>
          </div>
        ) : (
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
        )}
      </form>
    </div>
  );
}

export default DirectMessage;
