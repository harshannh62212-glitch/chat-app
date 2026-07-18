import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import { filterContent } from '../utils/contentFilter';
import { checkRateLimit } from '../utils/rateLimiter';
import GiphyPanel from './GiphyPanel';

function ServerChat({ server, currentUser, onOpenSettings, onStartDM }) {
  const [chatrooms, setChatrooms] = useState([]);
  const [selectedChatroom, setSelectedChatroom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [members, setMembers] = useState([]);
  const [showMembers, setShowMembers] = useState(true);
  const [showGiphy, setShowGiphy] = useState(false);
  const messagesEndRef = useRef(null);

  // Listen to chatrooms of the server
  useEffect(() => {
    const fetchChatrooms = async () => {
      try {
        const { data, error } = await supabase
          .from('chatrooms')
          .select('*')
          .eq('server_id', server.id)
          .order('is_general', { ascending: false })
          .order('created_at', { ascending: true });
        
        if (error) throw error;
        if (data) {
          setChatrooms(data);
          if (data.length > 0) {
            if (!selectedChatroom || !data.some(r => r.id === selectedChatroom.id)) {
              setSelectedChatroom(data[0]);
            }
          }
        }
      } catch (err) {
        console.error('Failed to fetch chatrooms:', err);
      }
    };

    fetchChatrooms();

    const channel = supabase
      .channel(`chatrooms-${server.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'chatrooms',
        filter: `server_id=eq.${server.id}`
      }, () => {
        fetchChatrooms();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [server.id]);

  // Listen to members of the server
  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const { data, error } = await supabase
          .from('server_members')
          .select('user_id, users(id, username, avatar_url)')
          .eq('server_id', server.id);
        
        if (error) throw error;
        if (data) {
          const formatted = data.map(m => m.users).filter(Boolean);
          setMembers(formatted);
        }
      } catch (err) {
        console.error('Failed to fetch members:', err);
      }
    };

    fetchMembers();

    const channel = supabase
      .channel(`members-${server.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'server_members',
        filter: `server_id=eq.${server.id}`
      }, () => {
        fetchMembers();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [server.id]);

  // Listen to messages in the active chatroom
  useEffect(() => {
    if (!selectedChatroom) {
      setMessages([]);
      return;
    }

    const fetchMessages = async () => {
      try {
        const { data, error } = await supabase
          .from('server_messages')
          .select('*, users(username, avatar_url)')
          .eq('chatroom_id', selectedChatroom.id)
          .order('created_at', { ascending: true });
        
        if (error) throw error;
        if (data) {
          const formatted = data.map(m => ({
            ...m,
            username: m.users?.username || 'Unknown',
            avatar_url: m.users?.avatar_url || ''
          }));
          setMessages(formatted);
        }
      } catch (err) {
        console.error('Failed to fetch messages:', err);
      }
    };

    fetchMessages();

    const channel = supabase
      .channel(`messages-${selectedChatroom.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'server_messages',
        filter: `chatroom_id=eq.${selectedChatroom.id}`
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const newMsg = payload.new;
          supabase
            .from('users')
            .select('username, avatar_url')
            .eq('id', newMsg.sender_id)
            .single()
            .then(({ data: userData }) => {
              const enrichedMsg = {
                ...newMsg,
                username: userData?.username || 'Unknown',
                avatar_url: userData?.avatar_url || ''
              };
              setMessages(prev => {
                if (prev.some(m => m.id === newMsg.id)) return prev;
                return [...prev, enrichedMsg];
              });
            });
        } else if (payload.eventType === 'DELETE') {
          setMessages(prev => prev.filter(m => m.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [server.id, selectedChatroom]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!messageInput.trim() || !selectedChatroom) return;

    if (!checkRateLimit(currentUser.is_admin)) {
      alert('Slow down! You can only send 1 message per second.');
      return;
    }

    const content = messageInput;
    setMessageInput('');
    await sendMsg(content);
  };

  const sendMsg = async (contentStr) => {
    const filteredContent = filterContent(contentStr);

    try {
      const { error } = await supabase.from('server_messages').insert({
        sender_id: currentUser.id,
        chatroom_id: selectedChatroom.id,
        content: filteredContent
      });
      if (error) throw error;
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  const handleSelectGif = async (gifUrl) => {
    if (!checkRateLimit(currentUser.is_admin)) {
      alert('Slow down! You can only send 1 message per second.');
      return;
    }

    setShowGiphy(false);
    await sendMsg(gifUrl);
  };

  const handleDeleteMessage = async (msgId) => {
    const confirmDelete = window.confirm('Are you sure you want to delete this message?');
    if (!confirmDelete) return;

    try {
      const { error } = await supabase
        .from('server_messages')
        .delete()
        .eq('id', msgId);
      if (error) throw error;
    } catch (err) {
      console.error('Failed to delete message:', err);
    }
  };

  return (
    <div className="server-chat">
      <div className="chat-header">
        <h2>{server.name} {selectedChatroom && <span className="channel-hash"># {selectedChatroom.name}</span>}</h2>
        <div className="header-info">
          <span className="chat-header-brand" style={{ color: '#00ffff', fontWeight: 'bold', letterSpacing: '0.5px', fontSize: '0.85em', textTransform: 'uppercase', marginRight: '10px' }}>wired-io</span>
          <span>{members.length} members</span>
          <button 
            className="toggle-members-btn"
            onClick={() => setShowMembers(!showMembers)}
            title="Toggle Members List"
          >
            👥
          </button>
          <button 
            className="header-settings-btn"
            onClick={onOpenSettings}
            title="Settings"
          >
            ⚙️
          </button>
        </div>
      </div>

      <div className="chat-container">
        <div className="chatroom-selector">
          <div className="chatroom-list-wrapper">
            <h4>Chatrooms</h4>
            {chatrooms.map(room => (
              <button
                key={room.id}
                className={`chatroom-btn ${selectedChatroom?.id === room.id ? 'active' : ''}`}
                onClick={() => setSelectedChatroom(room)}
              >
                # {room.name}
                {room.is_general && ' (general)'}
              </button>
            ))}
          </div>

          {/* User profile details at the bottom of the column */}
          <div className="discord-user-bar">
            <div className="user-bar-profile">
              <div className="user-bar-avatar">
                {currentUser.avatar_url ? (
                  <img src={currentUser.avatar_url} alt={currentUser.username} />
                ) : (
                  <div className="avatar-placeholder">{currentUser.username ? currentUser.username[0].toUpperCase() : '?'}</div>
                )}
                <span className="status-indicator online"></span>
              </div>
              <div className="user-bar-info">
                <span className="user-bar-name">{currentUser.username}</span>
                <span className="user-bar-tag">#0001</span>
              </div>
            </div>
            <div className="user-bar-actions">
              <button className="user-bar-btn" onClick={onOpenSettings} title="Settings">⚙️</button>
            </div>
          </div>
        </div>

        <div className="chat-main">
          <div className="messages">
            {messages.length === 0 ? (
              <p className="no-messages">No messages yet. Be the first to say hello!</p>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className="message-wrapper">
                  <div className="message-avatar">
                    {msg.avatar_url ? (
                      <img src={msg.avatar_url} alt={msg.username} />
                    ) : (
                      <span>{msg.username ? msg.username[0].toUpperCase() : '?'}</span>
                    )}
                  </div>
                  <div className="message-content-col">
                    <div className="message-meta">
                      <span className="message-username">{msg.username}</span>
                      <span className="message-timestamp">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {(msg.sender_id === currentUser.id || currentUser.is_admin) && (
                        <button
                          className="delete-msg-btn"
                          onClick={() => handleDeleteMessage(msg.id)}
                          title="Delete Message"
                          style={{ marginLeft: '8px' }}
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                    {msg.content.startsWith('http') && msg.content.includes('giphy.com') ? (
                      <img src={msg.content} className="message-gif" alt="GIF" />
                    ) : (
                      <div className="message-text">{msg.content}</div>
                    )}
                  </div>
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
                disabled={!selectedChatroom}
                title="Send a GIF"
              >
                GIF
              </button>
              <input
                type="text"
                placeholder="Type a message..."
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                disabled={!selectedChatroom}
              />
              <button type="submit" disabled={!selectedChatroom}>Send</button>
            </div>
          </form>
        </div>

        {showMembers && (
          <div className="members-sidebar">
            <h4>Members ({members.length})</h4>
            <div className="members-list">
              {members.map(member => (
                <div 
                  key={member.id} 
                  className={`member-item ${member.id !== currentUser.id ? 'clickable' : ''}`}
                  onClick={() => member.id !== currentUser.id && onStartDM && onStartDM(member)}
                  title={member.id !== currentUser.id ? `DM ${member.username}` : 'You'}
                  style={{ cursor: member.id !== currentUser.id ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '4px' }}
                >
                  <div className="member-avatar-small" style={{ display: 'flex', alignItems: 'center' }}>
                    {member.avatar_url ? (
                      <img src={member.avatar_url} alt={member.username} style={{ width: '20px', height: '20px', borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      <div className="avatar-placeholder-small" style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 'bold', color: '#fff' }}>
                        {member.username ? member.username[0].toUpperCase() : '?'}
                      </div>
                    )}
                  </div>
                  <span>{member.username}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ServerChat;
