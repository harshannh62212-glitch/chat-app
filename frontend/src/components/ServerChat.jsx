import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

function ServerChat({ server, socket, currentUser }) {
  const [chatrooms, setChatrooms] = useState([]);
  const [selectedChatroom, setSelectedChatroom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [members, setMembers] = useState([]);
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
        if (message.serverId === server.id) {
          setMessages(prev => [...prev, message]);
        }
      });

      return () => {
        socket.off('new-message');
      };
    }
  }, [socket, server, currentUser]);

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
        <h2>{server.name}</h2>
        <div className="header-info">
          <span>{members.length} members</span>
        </div>
      </div>

      <div className="chat-container">
        <div className="chatroom-selector">
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

        <div className="chat-main">
          <div className="messages">
            {messages.length === 0 ? (
              <p className="no-messages">No messages yet. Be the first to say hello!</p>
            ) : (
              messages.map((msg, idx) => (
                <div key={idx} className="message">
                  <strong>{msg.username}</strong>
                  <p>{msg.content}</p>
                  <span className="timestamp">
                    {new Date(msg.created_at).toLocaleTimeString()}
                  </span>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSendMessage} className="message-input">
            <input
              type="text"
              placeholder="Type a message..."
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              disabled={!selectedChatroom}
            />
            <button type="submit" disabled={!selectedChatroom}>Send</button>
          </form>
        </div>

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
      </div>
    </div>
  );
}

export default ServerChat;
