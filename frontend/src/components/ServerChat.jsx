import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { filterContent } from '../utils/contentFilter';
import { checkRateLimit } from '../utils/rateLimiter';
import GiphyPanel from './GiphyPanel';
import ReportButton from './ReportButton';


const savedProxyTarget = localStorage.getItem('custom_proxy_target');
const socketUrl = savedProxyTarget || (import.meta.env.PROD ? window.location.origin : 'http://localhost:8000');
const socket = io(socketUrl, {
  autoConnect: true,
  extraHeaders: {
    'bypass-tunnel-reminder': 'true'
  }
});

function VideoParticipant({ stream, username, isLocal }) {
  const videoRef = useRef(null);
  
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="video-participant-card">
      <video ref={videoRef} autoPlay playsInline muted={isLocal} />
      <div className="participant-overlay">
        <span className="participant-name">{username} {isLocal && '(You)'}</span>
      </div>
    </div>
  );
}

function ServerChat({ server, currentUser, onOpenSettings, onStartDM, batteryInfo, onBack }) {
  const [chatrooms, setChatrooms] = useState([]);
  const [selectedChatroom, setSelectedChatroom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [members, setMembers] = useState([]);
  const [showMembers, setShowMembers] = useState(true);
  const [showGiphy, setShowGiphy] = useState(false);
  const [showTunnelWarning, setShowTunnelWarning] = useState(false);

  useEffect(() => {
    const handleConnectError = (err) => {
      console.warn('[SOCKET] Connection error:', err.message);
      if (import.meta.env.PROD || socketUrl.includes('trycloudflare') || socketUrl.includes('localtunnel')) {
        setShowTunnelWarning(true);
      }
    };
    socket.on('connect_error', handleConnectError);
    return () => {
      socket.off('connect_error', handleConnectError);
    };
  }, []);

  // WebRTC Video Rooms state & refs
  const [inVoiceRoom, setInVoiceRoom] = useState(false);
  const [voiceUsers, setVoiceUsers] = useState([]); // Array of { socketId, username, stream }
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  
  const localStreamRef = useRef(null);
  const peersRef = useRef(new Map());

  const leaveVoiceRoom = () => {
    socket.emit('leave-voice', { voiceRoomId: server.id });
    
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    setLocalStream(null);
    
    peersRef.current.forEach(pc => pc.close());
    peersRef.current.clear();
    
    setInVoiceRoom(false);
    setVoiceUsers([]);
  };

  const joinVoiceRoom = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      localStreamRef.current = stream;
      setLocalStream(stream);
      
      if (isMuted) {
        stream.getAudioTracks().forEach(t => t.enabled = false);
      }
      if (isVideoOff) {
        stream.getVideoTracks().forEach(t => t.enabled = false);
      }

      setInVoiceRoom(true);
      
      socket.emit('join-voice', {
        voiceRoomId: server.id,
        userId: currentUser.id,
        username: currentUser.username
      });
    } catch (err) {
      console.error('[WEBRTC] Failed to get camera/microphone stream:', err);
      alert('Could not access camera or microphone. Please check permissions.');
    }
  };

  const toggleMute = () => {
    const newState = !isMuted;
    setIsMuted(newState);
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !newState;
      });
    }
  };

  const toggleVideo = () => {
    const newState = !isVideoOff;
    setIsVideoOff(newState);
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(track => {
        track.enabled = !newState;
      });
    }
  };

  useEffect(() => {
    if (!inVoiceRoom) return;

    const createPeerConnection = (targetSocketId, otherUserInfo) => {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          pc.addTrack(track, localStreamRef.current);
        });
      }

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('voice-signal', {
            targetSocketId,
            signal: { candidate: event.candidate }
          });
        }
      };

      pc.ontrack = (event) => {
        const remoteStream = event.streams[0];
        setVoiceUsers(prev => prev.map(u => {
          if (u.socketId === targetSocketId) {
            return { ...u, stream: remoteStream };
          }
          return u;
        }));
      };

      peersRef.current.set(targetSocketId, pc);
      return pc;
    };

    const handleVoiceRoomUsers = async (users) => {
      setVoiceUsers(users.map(u => ({ ...u, stream: null })));
      for (const u of users) {
        const pc = createPeerConnection(u.socketId, u);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('voice-signal', {
          targetSocketId: u.socketId,
          signal: { offer }
        });
      }
    };

    const handleVoiceUserJoined = (user) => {
      setVoiceUsers(prev => {
        if (prev.some(u => u.socketId === user.socketId)) return prev;
        return [...prev, { ...user, stream: null }];
      });
    };

    const handleVoiceSignal = async (data) => {
      const { senderSocketId, signal } = data;
      let pc = peersRef.current.get(senderSocketId);

      if (signal.offer) {
        pc = createPeerConnection(senderSocketId);
        await pc.setRemoteDescription(new RTCSessionDescription(signal.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('voice-signal', {
          targetSocketId: senderSocketId,
          signal: { answer }
        });
      } else if (signal.answer) {
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.answer));
        }
      } else if (signal.candidate) {
        if (pc) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
          } catch (e) {
            console.error('[WEBRTC] Error adding ICE candidate:', e);
          }
        }
      }
    };

    const handleVoiceUserLeft = (data) => {
      const { socketId } = data;
      setVoiceUsers(prev => prev.filter(u => u.socketId !== socketId));
      
      const pc = peersRef.current.get(socketId);
      if (pc) {
        pc.close();
        peersRef.current.delete(socketId);
      }
    };

    socket.on('voice-room-users', handleVoiceRoomUsers);
    socket.on('voice-user-joined', handleVoiceUserJoined);
    socket.on('voice-signal', handleVoiceSignal);
    socket.on('voice-user-left', handleVoiceUserLeft);

    return () => {
      socket.off('voice-room-users', handleVoiceRoomUsers);
      socket.off('voice-user-joined', handleVoiceUserJoined);
      socket.off('voice-signal', handleVoiceSignal);
      socket.off('voice-user-left', handleVoiceUserLeft);
    };
  }, [inVoiceRoom, server.id]);

  useEffect(() => {
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      peersRef.current.forEach(pc => pc.close());
    };
  }, []);

  useEffect(() => {
    const requestPermissions = async () => {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
          stream.getTracks().forEach(track => track.stop());
        }
      } catch (err) {
        console.warn('[PERMISSION] Mic/Camera permission denied or not available:', err);
      }
    };
    requestPermissions();
  }, []);

  useEffect(() => {
    const resolveSocketTunnel = async () => {
      const saved = localStorage.getItem('custom_proxy_target');
      if (!saved && import.meta.env.PROD) {
        try {
          let tunnel = '';
          // Try fetching dedicated tunnel.json first
          try {
            const tunnelRes = await fetch('/tunnel.json');
            if (tunnelRes.ok && tunnelRes.headers.get('content-type')?.includes('application/json')) {
              const data = await tunnelRes.json();
              if (data && data.url) {
                tunnel = data.url;
              }
            }
          } catch (e) {
            // Ignore and fall back to vercel.json
          }

          // Fall back to vercel.json
          if (!tunnel) {
            const res = await fetch('/vercel.json');
            if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
              const config = await res.json();
              if (config.rewrites) {
                const apiRewrite = config.rewrites.find(r => r.source === '/api/(.*)');
                if (apiRewrite && apiRewrite.destination && apiRewrite.destination.startsWith('http')) {
                  tunnel = apiRewrite.destination.split('/api/')[0];
                }
              } else if (config.routes) {
                const apiRoute = config.routes.find(r => r.src === '/api/(.*)');
                if (apiRoute && apiRoute.dest && apiRoute.dest.startsWith('http')) {
                  tunnel = apiRoute.dest.split('/api/')[0];
                }
              }
            }
          }

          if (tunnel && socket.io.uri !== tunnel) {
            console.log('[SOCKET] Reconnecting socket directly to tunnel:', tunnel);
            socket.io.uri = tunnel;
            socket.disconnect().connect();
          }
        } catch (err) {
          console.error('[SOCKET] Failed to resolve direct tunnel URL:', err);
        }
      }
    };
    resolveSocketTunnel();

    const handleFailover = (e) => {
      const fallbackUrl = e.detail.url;
      if (socket.io.uri !== fallbackUrl) {
        console.log('[SOCKET] Reconnecting socket to fallback server:', fallbackUrl);
        socket.io.uri = fallbackUrl;
        socket.disconnect().connect();
      }
    };
    window.addEventListener('api-failover-activated', handleFailover);
    return () => {
      window.removeEventListener('api-failover-activated', handleFailover);
    };
  }, []);
  const [viewingChat, setViewingChat] = useState(true);
  const messagesEndRef = useRef(null);

  // Reset selected chatroom and messages immediately when the server changes
  useEffect(() => {
    setSelectedChatroom(null);
    setMessages([]);
  }, [server.id]);

  // Fetch chatrooms of the server
  useEffect(() => {
    const fetchChatrooms = async () => {
      try {
        const res = await axios.get(`/api/servers/${server.id}/chatrooms`);
        if (res.data) {
          setChatrooms(res.data);
          if (res.data.length > 0) {
            if (!selectedChatroom || !res.data.some(r => r.id === selectedChatroom.id)) {
              setSelectedChatroom(res.data[0]);
            }
          }
        }
      } catch (err) {
        console.error('Failed to fetch chatrooms:', err);
      }
    };

    fetchChatrooms();
  }, [server.id]);

  // Fetch members of the server
  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const res = await axios.get(`/api/servers/${server.id}/members`);
        if (res.data) {
          setMembers(res.data);
        }
      } catch (err) {
        console.error('Failed to fetch members:', err);
      }
    };

    fetchMembers();
  }, [server.id]);

  // Fetch & listen to messages in the active chatroom
  useEffect(() => {
    if (!selectedChatroom || !currentUser) {
      setMessages([]);
      return;
    }

    const fetchMessages = async () => {
      try {
        const res = await axios.get(`/api/messages/chatroom/${selectedChatroom.id}`);
        if (res.data) {
          setMessages(res.data);
        }
      } catch (err) {
        console.error('Failed to fetch messages:', err);
      }
    };

    fetchMessages();

    socket.emit('user-joined', currentUser.id, server.id);

    const handleNewMessage = (msgData) => {
      const isSelf = msgData.senderId === currentUser.id || msgData.sender_id === currentUser.id;
      if (!isSelf && document.visibilityState !== 'visible' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification(`New message in #${server.name}`, {
          body: `${msgData.username || 'Someone'}: ${msgData.content}`,
          icon: msgData.avatar_url || ''
        });
      }

      if (msgData.serverId === server.id || msgData.chatroom_id === selectedChatroom.id) {
        setMessages(prev => {
          if (prev.some(m => m.id === msgData.id)) return prev;
          return [...prev, msgData];
        });
      }
    };

    const handleMessageDeleted = (data) => {
      setMessages(prev => prev.filter(m => m.id.toString() !== data.id.toString()));
    };

    const handleReactionUpdated = (data) => {
      if (data.type === 'server') {
        setMessages(prev => prev.map(m => m.id === data.messageId ? { ...m, reactions: data.reactions } : m));
      }
    };

    socket.on('new-message', handleNewMessage);
    socket.on('message-deleted', handleMessageDeleted);
    socket.on('reaction-updated', handleReactionUpdated);

    return () => {
      socket.off('new-message', handleNewMessage);
      socket.off('message-deleted', handleMessageDeleted);
      socket.off('reaction-updated', handleReactionUpdated);
      if (currentUser) {
        socket.emit('user-left', currentUser.id, server.id);
      }
    };
  }, [selectedChatroom, server.id, currentUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleToggleReaction = (messageId, emoji, hasReacted) => {
    const eventName = hasReacted ? 'remove-reaction' : 'add-reaction';
    socket.emit(eventName, {
      messageId,
      type: 'server',
      emoji,
      userId: currentUser.id,
      serverId: server.id
    });
  };

  const handleReplyTo = (username) => {
    setMessageInput(prev => `@${username} ` + prev);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!messageInput.trim() || !selectedChatroom) return;

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
    await sendMsg(content);
  };

  const sendMsg = async (contentStr) => {
    if (!contentStr.trim() || !selectedChatroom) return;
    const filteredContent = filterContent(contentStr);

    try {
      const res = await axios.post('/api/messages/server', {
        chatroomId: selectedChatroom.id,
        content: filteredContent
      });

      const newMsg = res.data;
      socket.emit('send-message', {
        ...newMsg,
        senderId: currentUser.id,
        serverId: server.id
      });
      setMessages(prev => {
        if (prev.some(m => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
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
      await axios.delete(`/api/messages/${msgId}`);
      setMessages(prev => prev.filter(m => m.id !== msgId));
    } catch (err) {
      console.error('Failed to delete message:', err);
    }
  };

  if (!currentUser) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#b9bbbe' }}>Loading chat...</div>;
  }

  return (
    <div className={`server-chat ${viewingChat ? 'mobile-show-chat' : 'mobile-show-rooms'}`}>
      {showTunnelWarning && (
        <div style={{
          backgroundColor: '#faa61a',
          color: '#000',
          padding: '10px',
          textAlign: 'center',
          fontWeight: 'bold',
          fontSize: '0.85em',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '12px',
          zIndex: 1000,
          borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
          width: '100%',
          boxSizing: 'border-box'
        }}>
          <span>⚠️ Backend connection failed. If you are using a local tunnel, please authorize it to enable messaging:</span>
          <a href={socketUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#000', textDecoration: 'underline', fontWeight: '800' }}>
            Authorize Tunnel
          </a>
          <button 
            onClick={() => setShowTunnelWarning(false)} 
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '1.2em', color: '#000' }}
          >
            ✕
          </button>
        </div>
      )}
      <div className="chat-header">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {onBack && (
            <button 
              className="mobile-back-btn" 
              onClick={() => {
                if (viewingChat) {
                  setViewingChat(false);
                } else {
                  onBack();
                }
              }}
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
          {server.name} 
          {selectedChatroom && viewingChat && <span className="channel-hash"># {selectedChatroom.name}</span>}
          {batteryInfo && (
            <span 
              style={{ fontSize: '0.55em', padding: '1px 5px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#b9bbbe', fontWeight: 'normal', fontFamily: "'Outfit', sans-serif" }}
              title={`Server Battery: ${batteryInfo.percent}% (${batteryInfo.status})`}
            >
              {batteryInfo.isCharging ? '⚡' : '🔋'} {batteryInfo.percent}%
            </span>
          )}
        </h2>
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
                onClick={() => { setSelectedChatroom(room); setViewingChat(true); }}
              >
                # {room.name}
                {room.is_general && ' (general)'}
              </button>
            ))}
          </div>

          {/* Voice Channels Section */}
          <div className="voice-rooms-wrapper" style={{ marginTop: '20px', padding: '0 10px' }}>
            <h4 style={{ margin: '10px 0 5px 0', fontSize: '0.8em', textTransform: 'uppercase', color: '#72767d', letterSpacing: '0.5px' }}>Voice Channels</h4>
            {!inVoiceRoom ? (
              <button className="voice-join-btn" onClick={joinVoiceRoom} style={{
                width: '100%',
                padding: '8px 10px',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#fff',
                borderRadius: '6px',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '0.9em',
                transition: 'background-color 0.2s'
              }}>
                🔊 Join Voice Room
              </button>
            ) : (
              <div className="voice-active-panel" style={{
                backgroundColor: 'rgba(78, 93, 148, 0.15)',
                border: '1px solid rgba(88, 101, 242, 0.3)',
                padding: '10px',
                borderRadius: '8px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ color: '#5865f2', fontWeight: 'bold', fontSize: '0.85em' }}>🟢 Connected Voice</span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={toggleMute} style={{
                      background: 'none',
                      border: 'none',
                      color: isMuted ? '#f04747' : '#fff',
                      cursor: 'pointer',
                      fontSize: '1.1em'
                    }} title={isMuted ? 'Unmute' : 'Mute'}>
                      {isMuted ? '🎙️❌' : '🎙️'}
                    </button>
                    <button onClick={toggleVideo} style={{
                      background: 'none',
                      border: 'none',
                      color: isVideoOff ? '#f04747' : '#fff',
                      cursor: 'pointer',
                      fontSize: '1.1em'
                    }} title={isVideoOff ? 'Turn Camera On' : 'Turn Camera Off'}>
                      {isVideoOff ? '📹❌' : '📹'}
                    </button>
                    <button onClick={leaveVoiceRoom} style={{
                      background: 'none',
                      border: 'none',
                      color: '#f04747',
                      cursor: 'pointer',
                      fontSize: '1.1em'
                    }} title="Disconnect">
                      📴
                    </button>
                  </div>
                </div>
                
                <div className="voice-users-list" style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '5px' }}>
                  <div style={{ fontSize: '0.8em', color: '#b9bbbe' }}>👤 {currentUser.username} (You)</div>
                  {voiceUsers.map(user => (
                    <div key={user.socketId} style={{ fontSize: '0.8em', color: '#b9bbbe' }}>
                      👤 {user.username}
                    </div>
                  ))}
                </div>
              </div>
            )}
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
          {inVoiceRoom && (
            <div className="video-meeting-grid-container">
              {localStream && <VideoParticipant stream={localStream} username={currentUser.username} isLocal={true} />}
              {voiceUsers.map(user => {
                if (!user.stream) return null;
                return <VideoParticipant key={user.socketId} stream={user.stream} username={user.username} isLocal={false} />;
              })}
            </div>
          )}
          <div className="messages">
            {messages.length === 0 ? (
              <p className="no-messages">No messages yet. Be the first to say hello!</p>
            ) : (
              messages.map((msg) => {
                const isMentioned = msg.content && msg.content.toLowerCase().includes('@' + currentUser.username.toLowerCase());
                return (
                  <div key={msg.id} className={`message-wrapper ${isMentioned ? 'mentioned-message' : ''}`}>
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
                        <ReportButton messageId={msg.id} />
                        <button
                          className="reply-msg-btn"
                          onClick={() => handleReplyTo(msg.username)}
                          title="Reply"
                          style={{ marginLeft: '8px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px' }}
                        >
                          ↩️
                        </button>
                      </div>

                      {msg.content.startsWith('http') && msg.content.includes('giphy.com') ? (
                        <img src={msg.content} className="message-gif" alt="GIF" />
                      ) : (
                        <div className="message-text">{msg.content}</div>
                      )}

                      <div className="message-reactions-row">
                        {msg.reactions && Object.entries(msg.reactions).map(([emoji, userIds]) => {
                          if (!Array.isArray(userIds) || userIds.length === 0) return null;
                          const hasReacted = userIds.includes(currentUser.id);
                          return (
                            <button
                              key={emoji}
                              className={`reaction-tag ${hasReacted ? 'active' : ''}`}
                              onClick={() => handleToggleReaction(msg.id, emoji, hasReacted)}
                              title={userIds.length + ' reactions'}
                            >
                              <span>{emoji}</span>
                              <span className="reaction-count">{userIds.length}</span>
                            </button>
                          );
                        })}
                        
                        <div className="add-reaction-inline-dropdown">
                          <button className="add-reaction-trigger-btn" title="Add Reaction">😀+</button>
                          <div className="reaction-picker-menu">
                            {['👍', '❤️', '😂', '😮', '😢', '🙏'].map(emoji => {
                              const hasReacted = msg.reactions && Array.isArray(msg.reactions[emoji]) && msg.reactions[emoji].includes(currentUser.id);
                              return (
                                <button
                                  key={emoji}
                                  onClick={() => handleToggleReaction(msg.id, emoji, hasReacted)}
                                >
                                  {emoji}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
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
