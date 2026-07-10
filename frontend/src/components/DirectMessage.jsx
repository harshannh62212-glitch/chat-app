import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

function DirectMessage({ dmWith, socket, currentUser }) {
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchMessages();
  }, [dmWith]);

  useEffect(() => {
    if (socket) {
      const targetUserId = dmWith.id || dmWith.other_user_id;
      socket.emit('user-joined', currentUser.id, null);

      const handleNewDM = (message) => {
        if (message.senderId === targetUserId) {
          setMessages(prev => [...prev, message]);
        }
      };

      const handleDMSent = (message) => {
        if (message.dmWith === targetUserId) {
          // Ensure senderId is populated so the UI renders it as 'sent'
          setMessages(prev => [...prev, { ...message, senderId: currentUser.id }]);
        }
      };

      socket.on('new-dm', handleNewDM);
      socket.on('dm-sent', handleDMSent);

      return () => {
        socket.off('new-dm', handleNewDM);
        socket.off('dm-sent', handleDMSent);
      };
    }
  }, [socket, dmWith, currentUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/messages/dm/${dmWith.id || dmWith.other_user_id}`);
      setMessages(response.data);
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!messageInput.trim()) return;

    socket.emit('send-message', {
      senderId: currentUser.id,
      senderUsername: currentUser.username,
      content: messageInput,
      dmWith: dmWith.id || dmWith.other_user_id
    });

    setMessageInput('');
  };

  const dmUserId = dmWith.id || dmWith.other_user_id;
  const dmUsername = dmWith.username;

  return (
    <div className="direct-message">
      <div className="chat-header">
        <h2>💬 {dmUsername}</h2>
      </div>

      <div className="messages">
        {loading ? (
          <p>Loading messages...</p>
        ) : messages.length === 0 ? (
          <p className="no-messages">No messages yet. Start the conversation!</p>
        ) : (
          messages.map((msg, idx) => (
            <div 
              key={idx} 
              className={`message ${msg.senderId === currentUser.id ? 'sent' : 'received'}`}
            >
              <p>{msg.content}</p>
              <span className="timestamp">
                {new Date(msg.timestamp || msg.created_at).toLocaleTimeString()}
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
        />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}

export default DirectMessage;
