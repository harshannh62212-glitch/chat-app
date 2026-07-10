import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import GiphyPanel from './GiphyPanel';

function ServerChat({ server, socket, currentUser, onOpenSettings, onLogout }) {
  const [chatrooms, setChatrooms] = useState([]);
  const [selectedChatroom, setSelectedChatroom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [members, setMembers] = useState([]);
  const [showMembers, setShowMembers] = useState(true);
  const [showGiphy, setShowGiphy] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchChatrooms();
    fetchMembers();
  }, [server]);

  useEffect(() => {
    if (selectedChatroom) {
      fetchMessages();
    }
  }, [selectedChatroom]);

  useEffect(() => {
    if (socket) {
      socket.emit('user-joined', currentUser.id, server.id);

      socket.on('new-message', (message) => {
        if (message.serverId === server.id && message.chatroomId === selectedChatroom?.id) {
          setMessages(prev => [...prev, message]);
        }
      });

      return () => {
        socket.off('new-message');
      };
    }
  }, [socket, server, currentUser, selectedChatroom]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchChatrooms = async () => {
    try {
      const response = await axios.get(`/api/servers/${server.id}/chatrooms`);
      setChatrooms(response.data);
      if (response.data.length > 0) {
        setSelectedChatroom(response.data[0]);
      }
    } catch (err) {
      console.error('Failed to fetch chatrooms:', err);
    }
  };

  const fetchMessages = async () => {
    try {
      const response = await axios.get(`/api/messages/chatroom/${selectedChatroom.id}`);
      setMessages(response.data);
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    }
  };

  const fetchMembers = async () => {
    try {
      const response = await axios.get(`/api/servers/${server.id}/members`);
      setMembers(response.data);
    } catch (err) {
      console.error('Failed to fetch members:', err);
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!messageInput.trim() || !selectedChatroom) return;

    socket.emit('send-message', {
      senderId: currentUser.id,
      content: messageInput,
      serverId: server.id,
      chatroomId: selectedChatroom.id
    });

    setMessageInput('');
  };

  return (
    <div className="server-chat">
      <div className="chat-header">
        <h2>{server.name} {selectedChatroom && <span className="channel-hash"># {selectedChatroom.name}</span>}</h2>
        <div className="header-info">
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
                  <div className="avatar-placeholder">{currentUser.username[0].toUpperCase()}</div>
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
              <button className="user-bar-btn" onClick={onLogout} title="Logout">🚪</button>
            </div>
          </div>
        </div>

        <div className="chat-main">
          <div className="messages">
            {messages.length === 0 ? (
              <p className="no-messages">No messages yet. Be the first to say hello!</p>
            ) : (
              messages.map((msg, idx) => (
                <div key={idx} className="message">
                  <strong>{msg.username}</strong>
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
                onSelectGif={(gifUrl) => {
                  socket.emit('send-message', {
                    senderId: currentUser.id,
                    content: gifUrl,
                    serverId: server.id,
                    chatroomId: selectedChatroom.id
                  });
                  setShowGiphy(false);
                }}
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
                <div key={member.id} className="member-item">
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
