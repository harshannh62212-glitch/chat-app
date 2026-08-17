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

function VideoParticipant({ stream, username, avatarUrl, isLocal, isMuted, isDeafened, isSpeaking }) {
  const videoRef = useRef(null);
  const [hasVideoTrack, setHasVideoTrack] = useState(false);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      const vTracks = stream.getVideoTracks();
      setHasVideoTrack(vTracks.length > 0 && vTracks.some(t => t.enabled));

      const handleTrackChange = () => {
        setHasVideoTrack(stream.getVideoTracks().some(t => t.enabled));
      };

      stream.addEventListener('addtrack', handleTrackChange);
      stream.addEventListener('removetrack', handleTrackChange);
      return () => {
        stream.removeEventListener('addtrack', handleTrackChange);
        stream.removeEventListener('removetrack', handleTrackChange);
      };
    } else {
      setHasVideoTrack(false);
    }
  }, [stream]);

  return (
    <div className={`voice-participant-tile ${isSpeaking ? 'speaking' : ''}`}>
      {hasVideoTrack ? (
        <video ref={videoRef} autoPlay playsInline muted={isLocal} className="participant-video" />
      ) : (
        <div className="participant-avatar-container">
          <div className={`avatar-wrapper ${isSpeaking ? 'speaking' : ''}`}>
            {avatarUrl ? (
              <img src={avatarUrl} alt={username} className="stage-avatar-img" />
            ) : (
              <div className="stage-avatar-fallback">
                {username ? username[0].toUpperCase() : '?'}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="participant-overlay-bottom">
        <div className="participant-name-tag">
          {username} {isLocal && '(You)'}
        </div>
        <div className="status-icons-group">
          {isMuted && (
            <div className="status-icon-badge danger" title="Muted">
              🎙️
            </div>
          )}
          {isDeafened && (
            <div className="status-icon-badge danger" title="Deafened">
              🎧
            </div>
          )}
        </div>
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
  const [currentSocketUrl, setCurrentSocketUrl] = useState(getActiveSocketUrl());

  useEffect(() => {
    const handleConnectError = (err) => {
      console.warn('[SOCKET] Connection error:', err.message);
    };
    socket.on('connect_error', handleConnectError);
    return () => {
      socket.off('connect_error', handleConnectError);
    };
  }, []);

  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const [tagQuery, setTagQuery] = useState('');

  // WebRTC Video Rooms state & refs
  const [inVoiceRoom, setInVoiceRoom] = useState(false);
  const [voiceUsers, setVoiceUsers] = useState([]); // Array of { socketId, username, stream }
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [isLocalSpeaking, setIsLocalSpeaking] = useState(false);
  
  const localStreamRef = useRef(null);
  const peersRef = useRef(new Map());
  const audioContextRef = useRef(null);

  const toggleDeafen = () => {
    const newState = !isDeafened;
    setIsDeafened(newState);
    // Mute incoming audio from all peers
    peersRef.current.forEach(pc => {
      pc.getReceivers().forEach(receiver => {
        if (receiver.track && receiver.track.kind === 'audio') {
          receiver.track.enabled = !newState;
        }
      });
    });
  };

  useEffect(() => {
    if (!localStream || isMuted) {
      setIsLocalSpeaking(false);
      return;
    }

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      const source = audioCtx.createMediaStreamSource(localStream);
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      let intervalId;

      const checkVolume = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const average = sum / dataArray.length;
        setIsLocalSpeaking(average > 15);
      };

      intervalId = setInterval(checkVolume, 100);

      return () => {
        clearInterval(intervalId);
        if (audioCtx.state !== 'closed') {
          audioCtx.close();
        }
      };
    } catch (err) {
      console.warn('[AUDIO] Failed to start audio analyser:', err);
    }
  }, [localStream, isMuted]);

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
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      } catch (err) {
        console.warn('[WEBRTC] Could not get both audio and video, falling back to audio only:', err);
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        setIsVideoOff(true);
      }
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
          let stream;
          try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
          } catch (err) {
            console.warn('[PERMISSION] Could not request both, falling back to audio only:', err);
            stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          }
          if (stream) {
            stream.getTracks().forEach(track => track.stop());
          }
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
          // Try fetching from Vercel Serverless resolver first (same-origin, bypasses ad-blockers)
          try {
            const resolverRes = await fetch('/api/resolve-tunnel');
            if (resolverRes.ok) {
              const data = await resolverRes.json();
              if (data && data.url) {
                tunnel = data.url;
                console.log('[SOCKET] Resolved active tunnel URL from Vercel Resolver:', tunnel);
              }
            }
          } catch (resolverErr) {
            console.warn('[SOCKET] Failed to fetch tunnel URL from Vercel Resolver:', resolverErr);
          }

          // Try fetching from Supabase REST API fallback
          if (!tunnel) {
            try {
              let supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            if (!supabaseUrl || supabaseUrl.includes('trycloudflare.com')) {
              supabaseUrl = 'https://aebntdjjniirnwthtwlx.supabase.co';
            }
            const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlYm50ZGpqbmlpcm53dGh0d2x4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4NzIwNTYsImV4cCI6MjA5ODQ0ODA1Nn0.la5aH5b2Tb5cj5yfVEWHhPKU4_ieCWydEPWH8V81eIg';
            if (supabaseUrl && supabaseAnonKey) {
              const res = await fetch(`${supabaseUrl}/rest/v1/system_config?key=eq.active_tunnel_url`, {
                headers: {
                  'apikey': supabaseAnonKey,
                  'Authorization': `Bearer ${supabaseAnonKey}`
                }
              });
              if (res.ok) {
                const data = await res.json();
                if (data && data[0] && data[0].value) {
                  tunnel = data[0].value;
                  console.log('[SOCKET] Resolved active tunnel URL from Supabase:', tunnel);
                }
              }
            }
          } catch (supabaseErr) {
            console.warn('[SOCKET] Failed to fetch tunnel URL from Supabase:', supabaseErr);
          }
        }

          // Try fetching dedicated tunnel.json first
          if (!tunnel) {
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
            setCurrentSocketUrl(tunnel);
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
        setCurrentSocketUrl(fallbackUrl);
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
          if (isSelf && prev.some(m => m.isOptimistic && m.content === msgData.content)) {
            return prev.map(m => (m.isOptimistic && m.content === msgData.content) ? { ...m, id: msgData.id, isOptimistic: false } : m);
          }
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

  const handleInputChange = (e) => {
    const val = e.target.value;
    setMessageInput(val);

    const selectionStart = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, selectionStart);
    const words = textBeforeCursor.split(/\s+/);
    const lastWord = words[words.length - 1];

    if (lastWord.startsWith('@')) {
      setShowTagDropdown(true);
      setTagQuery(lastWord.slice(1).toLowerCase());
    } else {
      setShowTagDropdown(false);
    }
  };

  const selectTagUser = (username) => {
    const textarea = document.getElementById('message-input-textarea');
    if (!textarea) return;

    const selectionStart = textarea.selectionStart;
    const textBeforeCursor = messageInput.slice(0, selectionStart);
    const textAfterCursor = messageInput.slice(selectionStart);

    const words = textBeforeCursor.split(/\s+/);
    words[words.length - 1] = `@${username}`;

    const newTextBefore = words.join(' ');
    setMessageInput(newTextBefore + ' ' + textAfterCursor);
    setShowTagDropdown(false);
    setTimeout(() => textarea.focus(), 10);
  };

  const allMentionableUsers = [
    { id: 'gemini-bot-id', username: 'bot' },
    ...members.filter(u => u.id !== 'gemini-bot-id' && u.id !== 'bot-id')
  ];
  const filteredTags = allMentionableUsers.filter(u => 
    u.username && u.username.toLowerCase().includes(tagQuery)
  );

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

    const tempId = `opt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const optimisticMsg = {
      id: tempId,
      senderId: currentUser.id,
      sender_id: currentUser.id,
      username: currentUser.username,
      avatar_url: currentUser.avatar_url,
      content: filteredContent,
      serverId: server.id,
      chatroom_id: selectedChatroom.id,
      created_at: new Date().toISOString(),
      timestamp: new Date().toISOString(),
      isOptimistic: true
    };

    // 1. INSTANT (0ms) local state update
    setMessages(prev => [...prev, optimisticMsg]);

    // 2. INSTANT Socket.IO broadcast to room
    socket.emit('send-message', optimisticMsg);

    // 3. Asynchronous DB persistence in background
    try {
      const res = await axios.post('/api/messages/server', {
        chatroomId: selectedChatroom.id,
        content: filteredContent
      });

      const newMsg = res.data;
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, id: newMsg.id, isOptimistic: false } : m));
    } catch (err) {
      console.error('Failed to persist message to DB:', err);
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
                🔊 General Voice
              </button>
            ) : (
              <div className="voice-active-panel" style={{
                backgroundColor: 'rgba(35, 165, 90, 0.1)',
                border: '1px solid rgba(35, 165, 90, 0.3)',
                padding: '10px',
                borderRadius: '8px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ color: '#23a55a', fontWeight: 'bold', fontSize: '0.85em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    🟢 Voice Connected
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#949ba4' }}>
                    {voiceUsers.length + 1} user{voiceUsers.length > 0 ? 's' : ''}
                  </span>
                </div>
                
                <div className="voice-users-list" style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingLeft: '5px' }}>
                  <div style={{ fontSize: '0.8em', color: '#f2f3f5', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: isLocalSpeaking ? '#23a55a' : '#949ba4' }}>👤</span>
                    <span>{currentUser.username} (You)</span>
                  </div>
                  {voiceUsers.map(user => (
                    <div key={user.socketId} style={{ fontSize: '0.8em', color: '#b5bac1', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>👤</span>
                      <span>{user.username}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Discord Bottom Voice Control Panel */}
          {inVoiceRoom && (
            <div className="discord-voice-control-panel">
              <div className="voice-connection-status">
                <div className="connection-info">
                  <span className="connection-title">
                    <span>📡</span> Voice Connected
                  </span>
                  <span className="connection-sub">RTC / General Stage</span>
                </div>
                <span className="stage-ping-badge">24ms</span>
              </div>
              <div className="voice-action-buttons">
                <button
                  className={`discord-voice-btn ${isMuted ? 'active-red' : ''}`}
                  onClick={toggleMute}
                  title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
                >
                  {isMuted ? '🎙️❌' : '🎙️'}
                </button>
                <button
                  className={`discord-voice-btn ${isDeafened ? 'active-red' : ''}`}
                  onClick={toggleDeafen}
                  title={isDeafened ? 'Undeafen Audio' : 'Deafen Audio'}
                >
                  {isDeafened ? '🎧❌' : '🎧'}
                </button>
                <button
                  className={`discord-voice-btn ${isVideoOff ? 'active-red' : ''}`}
                  onClick={toggleVideo}
                  title={isVideoOff ? 'Turn Camera On' : 'Turn Camera Off'}
                >
                  {isVideoOff ? '📹❌' : '📹'}
                </button>
                <button
                  className="discord-voice-btn disconnect-btn"
                  onClick={leaveVoiceRoom}
                  title="Disconnect Call"
                >
                  📴
                </button>
              </div>
            </div>
          )}

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
            <div className="discord-voice-stage">
              <div className="discord-stage-header">
                <div className="stage-title-group">
                  <span className="stage-channel-icon">🔊</span>
                  <span className="stage-channel-name">【🔊】 VC 1</span>
                </div>
              </div>
              <div className="discord-stage-grid">
                <VideoParticipant
                  stream={localStream}
                  username={currentUser.username}
                  avatarUrl={currentUser.avatar_url}
                  isLocal={true}
                  isMuted={isMuted}
                  isDeafened={isDeafened}
                  isSpeaking={isLocalSpeaking}
                />
                {voiceUsers.map(user => (
                  <VideoParticipant
                    key={user.socketId}
                    stream={user.stream}
                    username={user.username}
                    avatarUrl={user.avatar_url}
                    isLocal={false}
                    isMuted={false}
                    isDeafened={false}
                    isSpeaking={false}
                  />
                ))}
              </div>

              {/* Floating Bottom Control Bar matching screenshot */}
              <div className="discord-stage-floating-controls">
                <div className="floating-bar-pill">
                  <button
                    className={`stage-action-btn ${isMuted ? 'active-red' : ''}`}
                    onClick={toggleMute}
                    title={isMuted ? 'Unmute' : 'Mute'}
                  >
                    {isMuted ? '🎙️❌' : '🎙️'}
                  </button>
                  <button
                    className={`stage-action-btn ${isDeafened ? 'active-red' : ''}`}
                    onClick={toggleDeafen}
                    title={isDeafened ? 'Undeafen' : 'Deafen'}
                  >
                    {isDeafened ? '🎧❌' : '🎧'}
                  </button>
                  <button
                    className={`stage-action-btn ${isVideoOff ? 'active-red' : ''}`}
                    onClick={toggleVideo}
                    title={isVideoOff ? 'Turn Camera On' : 'Turn Camera Off'}
                  >
                    {isVideoOff ? '📹❌' : '📹'}
                  </button>
                  <button className="stage-action-btn" title="Share Screen">
                    🖥️
                  </button>
                  <button className="stage-action-btn" title="Activities">
                    🚀
                  </button>
                  <button className="stage-action-btn disconnect-red-btn" onClick={leaveVoiceRoom} title="Disconnect">
                    📴
                  </button>
                </div>
              </div>
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
            {showTagDropdown && filteredTags.length > 0 && (
              <div className="tag-autocomplete-dropdown">
                {filteredTags.map(u => (
                  <div key={u.id} className="tag-autocomplete-item" onClick={() => selectTagUser(u.username)}>
                    👤 @{u.username}
                  </div>
                ))}
              </div>
            )}
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
                id="message-input-textarea"
                type="text"
                placeholder="Type a message..."
                value={messageInput}
                onChange={handleInputChange}
                disabled={!selectedChatroom}
              />
              <button type="submit" disabled={!selectedChatroom}>Send</button>
            </div>
          </form>
        </div>

        {showMembers && (
          <div className="members-sidebar">
            <h4>Members ({members.filter(m => m.id !== 'bot-id').length})</h4>
            <div className="members-list">
              {members.filter(m => m.id !== 'bot-id').map(member => (
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
