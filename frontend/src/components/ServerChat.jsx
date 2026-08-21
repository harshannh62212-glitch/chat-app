import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { filterContent } from '../utils/contentFilter';
import { checkRateLimit } from '../utils/rateLimiter';
import GiphyPanel from './GiphyPanel';
import ReportButton from './ReportButton';
import ServerSettingsModal from './ServerSettingsModal';
import MemberProfileCard from './MemberProfileCard';
import '../styles/ServerSettings.css';


const getActiveSocketUrl = () => {
  const custom = localStorage.getItem('custom_proxy_target');
  if (custom) return custom;
  const active = localStorage.getItem('active_backend_target');
  if (active && active.startsWith('http') && !active.includes('vercel.app')) return active;
  if (axios.defaults.baseURL && axios.defaults.baseURL.startsWith('http') && !axios.defaults.baseURL.includes('vercel.app')) return axios.defaults.baseURL;
  return import.meta.env.PROD ? (import.meta.env.VITE_RENDER_BACKEND_URL || 'https://chat-app-backend-render.onrender.com') : 'http://localhost:8000';
};

// Lazy socket — created with autoConnect:false, connected on first component mount
// (App.jsx blocks rendering until backend is resolved, so this is safe)
let socket = null;
const getSocket = () => {
  if (!socket) {
    const url = getActiveSocketUrl();
    socket = io(url, {
      autoConnect: false,
      withCredentials: true,
      extraHeaders: {
        'bypass-tunnel-reminder': 'true'
      },
      transports: ['websocket', 'polling']
    });
    socket.connect();
  } else if (!socket.connected && !socket.connecting) {
    // Reconnect if URL changed
    const currentUrl = getActiveSocketUrl();
    if (socket.io?.uri !== currentUrl) {
      socket.disconnect();
      socket = io(currentUrl, {
        autoConnect: true,
        withCredentials: true,
        extraHeaders: {
          'bypass-tunnel-reminder': 'true'
        },
        transports: ['websocket', 'polling']
      });
    } else {
      socket.connect();
    }
  }
  return socket;
};

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

function ServerChat({ server, currentUser, onOpenSettings, onStartDM, batteryInfo, onBack, onServerDeleted }) {
  // Initialize lazy socket on first render (backend URL is guaranteed resolved by App.jsx)
  if (!socket) getSocket();
  const [chatrooms, setChatrooms] = useState([]);
  const [selectedChatroom, setSelectedChatroom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [members, setMembers] = useState([]);
  const [serverRoles, setServerRoles] = useState([]);
  const [showServerSettingsModal, setShowServerSettingsModal] = useState(false);
  const [activeMemberPopover, setActiveMemberPopover] = useState(null);
  const [showMembers, setShowMembers] = useState(true);
  const [showGiphy, setShowGiphy] = useState(false);
  const [showTunnelWarning, setShowTunnelWarning] = useState(false);
  const [currentSocketUrl, setCurrentSocketUrl] = useState(getActiveSocketUrl());

  // Check currentUser server permissions
  const safeUser = currentUser || {};
  const isServerOwner = Boolean(server && server.owner_id && server.owner_id === safeUser.id);
  const isGlobalAdmin = Boolean(
    safeUser.is_admin || 
    safeUser.username === 'ADMIN' || 
    safeUser.username === 'Nxghtmare3621' || 
    safeUser.username === 'admin'
  );

  const currentUserMember = Array.isArray(members) ? members.find(m => m && safeUser.id && m.id === safeUser.id) : null;
  const currentUserRoles = currentUserMember?.roles || [];

  const hasPerm = (permKey) => {
    if (isServerOwner || isGlobalAdmin) return true;
    return currentUserRoles.some(r => {
      const p = r?.permissions || {};
      return p.administrator === true || p[permKey] === true;
    });
  };

  const isGeneralServer = Boolean(server && (server.id === 1 || String(server.id) === '1' || server.name === 'General'));
  const canManageRoles = (isServerOwner || isGlobalAdmin || hasPerm('manage_roles')) && !isGeneralServer;
  const canManageMessages = hasPerm('manage_messages');
  const canManageChannels = hasPerm('manage_channels');
  const canKickMembers = hasPerm('kick_members') && !isGeneralServer;

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
  const [tagCursorPos, setTagCursorPos] = useState(0);

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

  const [viewingChat, setViewingChat] = useState(true);
  const messagesEndRef = useRef(null);
  const DEFAULT_GEN_ROOM = { id: 1, name: 'general', is_general: true, server_id: server.id };

  // Reset selected chatroom and messages immediately when the server changes
  useEffect(() => {
    if (isGeneralServer) {
      setSelectedChatroom(DEFAULT_GEN_ROOM);
      setChatrooms([DEFAULT_GEN_ROOM]);
    } else {
      setSelectedChatroom(null);
      setChatrooms([]);
    }
    setMessages([]);
  }, [server.id, isGeneralServer]);

  // Fetch chatrooms of the server
  useEffect(() => {
    const fetchChatrooms = async () => {
      try {
        const res = await axios.get(`/api/servers/${server.id}/chatrooms`);
        if (Array.isArray(res.data) && res.data.length > 0) {
          setChatrooms(res.data);
          setSelectedChatroom(prev => {
            if (prev && res.data.some(r => r.id === prev.id)) {
              return res.data.find(r => r.id === prev.id);
            }
            return res.data.find(r => r.is_general) || res.data[0];
          });
        } else if (isGeneralServer) {
          setChatrooms([DEFAULT_GEN_ROOM]);
          setSelectedChatroom(DEFAULT_GEN_ROOM);
        }
      } catch (err) {
        console.error('Failed to fetch chatrooms:', err);
        if (isGeneralServer) {
          setChatrooms([DEFAULT_GEN_ROOM]);
          setSelectedChatroom(DEFAULT_GEN_ROOM);
        }
      }
    };

    fetchChatrooms();
  }, [server.id, isGeneralServer]);

  // Fetch members and roles of the server
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

  const fetchServerRoles = async () => {
    if (isGeneralServer) {
      setServerRoles([]);
      return;
    }
    try {
      const res = await axios.get(`/api/servers/${server.id}/roles`);
      if (res.data) {
        setServerRoles(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch server roles:', err);
    }
  };

  useEffect(() => {
    fetchMembers();
    fetchServerRoles();
  }, [server.id]);

  // Real-time listener for role and member changes
  useEffect(() => {
    const handleRolesUpdated = (data) => {
      if (!data || data.serverId === server.id) {
        fetchServerRoles();
        fetchMembers();
      }
    };

    const handleMemberRolesUpdated = (data) => {
      if (!data || data.serverId === server.id) {
        fetchMembers();
      }
    };

    const handleChatroomCreated = (data) => {
      if (data && data.serverId === server.id) {
        fetchChatrooms();
      }
    };

    const handleChatroomDeleted = (data) => {
      if (data && data.serverId === server.id) {
        fetchChatrooms();
      }
    };

    const handleMemberKicked = (data) => {
      if (data && data.serverId === server.id) {
        fetchMembers();
        if (data.userId === currentUser.id) {
          alert('You have been kicked from this server.');
          if (onBack) onBack();
        }
      }
    };

    socket.on('server-roles-updated', handleRolesUpdated);
    socket.on('member-roles-updated', handleMemberRolesUpdated);
    socket.on('chatroom-created', handleChatroomCreated);
    socket.on('chatroom-deleted', handleChatroomDeleted);
    socket.on('member-kicked', handleMemberKicked);

    return () => {
      socket.off('server-roles-updated', handleRolesUpdated);
      socket.off('member-roles-updated', handleMemberRolesUpdated);
      socket.off('chatroom-created', handleChatroomCreated);
      socket.off('chatroom-deleted', handleChatroomDeleted);
      socket.off('member-kicked', handleMemberKicked);
    };
  }, [server?.id, safeUser?.id]);

  const handleCreateChannel = async () => {
    const name = window.prompt('Enter new channel name (e.g. announcements, gaming):');
    if (!name || !name.trim()) return;
    try {
      const res = await axios.post(`/api/servers/${server.id}/chatrooms`, {
        name: name.trim()
      });
      if (res.data) {
        await fetchChatrooms();
        setSelectedChatroom(res.data);
      }
    } catch (err) {
      console.error('Failed to create channel:', err);
      alert(err.response?.data?.error || 'Failed to create channel');
    }
  };

  const handleDeleteChannel = async (channel, e) => {
    e.stopPropagation();
    if (channel.is_general) {
      alert('Cannot delete the mandatory general channel');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete #${channel.name}? All messages will be permanently deleted.`)) return;
    try {
      await axios.delete(`/api/servers/${server.id}/chatrooms/${channel.id}`);
      await fetchChatrooms();
      if (selectedChatroom?.id === channel.id) {
        const general = chatrooms.find(c => c.is_general) || chatrooms[0];
        if (general) setSelectedChatroom(general);
      }
    } catch (err) {
      console.error('Failed to delete channel:', err);
      alert(err.response?.data?.error || 'Failed to delete channel');
    }
  };

  // Helper to get top role of a member
  const getMemberTopRole = (member) => {
    if (!Array.isArray(member.roles) || member.roles.length === 0) return null;
    return member.roles[0];
  };

  // Organize members into hoisted role groups + online members
  const getGroupedMembers = () => {
    const cleanMembers = members.filter(m => m.id !== 'bot-id');
    const hoistedRoles = serverRoles.filter(r => r.hoist).sort((a, b) => b.position - a.position);
    
    const groups = [];
    const assignedMemberIds = new Set();

    hoistedRoles.forEach(role => {
      const roleMembers = cleanMembers.filter(m => {
        if (assignedMemberIds.has(m.id)) return false;
        const hasRole = Array.isArray(m.roles) && m.roles.some(r => r.id === role.id);
        return hasRole;
      });

      if (roleMembers.length > 0) {
        roleMembers.forEach(m => assignedMemberIds.add(m.id));
        groups.push({
          id: `role-${role.id}`,
          title: `${role.name.toUpperCase()} — ${roleMembers.length}`,
          color: role.color,
          members: roleMembers
        });
      }
    });

    const remaining = cleanMembers.filter(m => !assignedMemberIds.has(m.id));
    if (remaining.length > 0) {
      groups.push({
        id: 'online-members',
        title: `ONLINE — ${remaining.length}`,
        color: '#949ba4',
        members: remaining
      });
    }

    return groups;
  };

  const handleOpenMemberCard = (member, e) => {
    if (!member) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const top = Math.min(rect.top, window.innerHeight - 340);
    const left = Math.min(rect.right + 12, window.innerWidth - 320);

    setActiveMemberPopover({
      member,
      position: { top: `${top}px`, left: `${left}px`, isFixedCenter: false }
    });
  };

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
    const interval = setInterval(fetchMessages, 1000);

    // Join the server room — must wait for socket to be connected
    const joinRoom = () => {
      socket.emit('user-joined', currentUser.id, server.id);
    };

    if (socket.connected) {
      joinRoom();
    }
    // Also join (or re-join) whenever socket connects/reconnects
    socket.on('connect', joinRoom);

    const handleNewMessage = (msgData) => {
      const isSelf = msgData.senderId === currentUser.id || msgData.sender_id === currentUser.id;
      if (!isSelf && document.visibilityState !== 'visible' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification(`New message in #${server.name}`, {
          body: `${msgData.username || 'Someone'}: ${msgData.content}`,
          icon: msgData.avatar_url || ''
        });
      }

      const isMatch = String(msgData.serverId) === String(server.id) || 
                      String(msgData.chatroom_id) === String(selectedChatroom?.id) ||
                      (isGeneralServer && (String(msgData.chatroom_id) === '1' || String(msgData.serverId) === '1' || selectedChatroom?.is_general));

      if (isMatch) {
        setMessages(prev => {
          if (prev.some(m => String(m.id) === String(msgData.id))) return prev;
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
      clearInterval(interval);
      socket.off('connect', joinRoom);
      socket.off('new-message', handleNewMessage);
      socket.off('message-deleted', handleMessageDeleted);
      socket.off('reaction-updated', handleReactionUpdated);
      if (currentUser) {
        socket.emit('user-left', currentUser.id, server.id);
      }
    };
  }, [selectedChatroom, server.id, currentUser, isGeneralServer]);

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

  const handleOpenTagDropdown = (query, startPos) => {
    setTagQuery(query.toLowerCase());
    setTagCursorPos(startPos);
    setShowTagDropdown(true);
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setMessageInput(val);

    const cursorPos = e.target.selectionStart;
    const textBefore = val.slice(0, cursorPos);
    const lastAtIndex = textBefore.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const query = textBefore.slice(lastAtIndex + 1);
      if (!query.includes(' ') && (lastAtIndex === 0 || textBefore[lastAtIndex - 1] === ' ')) {
        handleOpenTagDropdown(query, lastAtIndex);
        return;
      }
    }
    setShowTagDropdown(false);
  };

  const selectTagUser = (username) => {
    const textarea = document.getElementById('message-input-textarea');
    if (!textarea) return;

    const selectionStart = tagCursorPos;
    const textBeforeCursor = messageInput.slice(0, selectionStart);
    const textAfterCursor = messageInput.slice(textarea.selectionStart);

    const newTextBefore = textBeforeCursor + '@' + username;
    setMessageInput(newTextBefore + ' ' + textAfterCursor);
    setShowTagDropdown(false);
    setTimeout(() => textarea.focus(), 10);
  };

  const allMentionableUsers = [
    { id: 'gemini-bot-id', username: 'bot' },
    { id: 'gemini-bot-id-2', username: 'gemini' },
    { id: 'gemini-bot-id-3', username: 'ai' },
    ...members.filter(u => u && u.id !== 'gemini-bot-id' && u.id !== 'bot-id')
  ];
  const filteredTags = allMentionableUsers.filter(u => 
    u.username && u.username.toLowerCase().includes(tagQuery)
  );

  const handleSendMessage = async (e) => {
    e.preventDefault();
    const activeTargetRoom = selectedChatroom || (isGeneralServer ? DEFAULT_GEN_ROOM : (chatrooms && chatrooms[0]) || null);
    if (!messageInput.trim() || !activeTargetRoom) return;

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
    await sendMsg(content, activeTargetRoom);
  };

  const sendMsg = async (contentStr, activeRoom = null) => {
    const targetRoom = activeRoom || selectedChatroom || (isGeneralServer ? DEFAULT_GEN_ROOM : (chatrooms && chatrooms[0]) || null);
    if (!contentStr.trim() || !targetRoom) return;
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
      chatroom_id: targetRoom.id,
      created_at: new Date().toISOString(),
      timestamp: new Date().toISOString(),
      isOptimistic: true
    };

    // 1. INSTANT local state update (optimistic)
    setMessages(prev => [...prev, optimisticMsg]);

    // 2. Persist to DB — the server POST handler broadcasts to the room via io.to()
    // This single-path approach prevents double-delivery to other users
    try {
      const res = await axios.post('/api/messages/server', {
        chatroomId: targetRoom.id,
        content: filteredContent
      });

      const newMsg = res.data;
      // Replace optimistic with confirmed DB message
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
          {isGeneralServer && (
            <span style={{
              fontSize: '0.45em',
              background: 'rgba(0, 255, 255, 0.15)',
              border: '1px solid rgba(0, 255, 255, 0.3)',
              color: '#00ffff',
              padding: '2px 8px',
              borderRadius: '6px',
              marginLeft: '8px',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              verticalAlign: 'middle'
            }}>
              🔒 Mandatory
            </span>
          )}
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px', marginBottom: '8px' }}>
              <h4 style={{ margin: 0, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#949ba4', letterSpacing: '0.5px' }}>Chatrooms</h4>
              {canManageChannels && (
                <button
                  onClick={handleCreateChannel}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#949ba4',
                    cursor: 'pointer',
                    fontSize: '14px',
                    lineHeight: '1',
                    padding: '2px 4px'
                  }}
                  title="Create Channel"
                >
                  ➕
                </button>
              )}
            </div>
            {chatrooms.map(room => (
              <div
                key={room.id}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <button
                  className={`chatroom-btn ${selectedChatroom?.id === room.id ? 'active' : ''}`}
                  onClick={() => { setSelectedChatroom(room); setViewingChat(true); }}
                  style={{ flex: 1, textAlign: 'left' }}
                >
                  # {room.name}
                  {room.is_general && ' (general)'}
                </button>
                {!room.is_general && canManageChannels && (
                  <button
                    onClick={(e) => handleDeleteChannel(room, e)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#949ba4',
                      cursor: 'pointer',
                      fontSize: '12px',
                      padding: '4px 6px'
                    }}
                    title="Delete Channel"
                  >
                    🗑️
                  </button>
                )}
              </div>
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
                {safeUser.avatar_url ? (
                  <img src={safeUser.avatar_url} alt={safeUser.username || 'User'} />
                ) : (
                  <div className="avatar-placeholder">{safeUser.username ? safeUser.username[0].toUpperCase() : '?'}</div>
                )}
                <span className="status-indicator online"></span>
              </div>
              <div className="user-bar-info">
                <span className="user-bar-name">{safeUser.username || 'User'}</span>
                <span className="user-bar-tag">#0001</span>
              </div>
            </div>
            <div className="user-bar-actions">
              <button className="user-bar-btn" onClick={onOpenSettings} title="Settings">⚙️</button>
            </div>
          </div>
        </div>

        <div className="chat-main">
          {/* Main Stage Grid (Discord Video Style) */}
          {inVoiceRoom && (
            <div className="voice-video-stage">
              <div className="voice-stage-grid">
                {/* Local user tile */}
                <VideoParticipant
                  stream={localStream}
                  username={currentUser.username}
                  avatarUrl={currentUser.avatar_url}
                  isLocal={true}
                  isMuted={isMuted}
                  isDeafened={isDeafened}
                  isSpeaking={isLocalSpeaking}
                />

                {/* Remote users tiles */}
                {voiceUsers.map(u => (
                  <VideoParticipant
                    key={u.socketId}
                    stream={u.stream}
                    username={u.username}
                    avatarUrl={u.avatarUrl}
                    isLocal={false}
                    isMuted={false}
                    isDeafened={false}
                    isSpeaking={false}
                  />
                ))}
              </div>

              {/* Floating Bottom Control Bar */}
              <div className="voice-stage-controls">
                <div className="stage-controls-group">
                  <button 
                    className={`stage-action-btn ${isMuted ? 'active-red' : ''}`}
                    onClick={toggleMute}
                    title={isMuted ? 'Unmute Mic' : 'Mute Mic'}
                  >
                    {isMuted ? '🎙️❌' : '🎙️'}
                  </button>
                  <button 
                    className={`stage-action-btn ${isDeafened ? 'active-red' : ''}`}
                    onClick={toggleDeafen}
                    title={isDeafened ? 'Undeafen Audio' : 'Deafen Audio'}
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
                const senderRole = msg.sender_role;
                const senderColor = senderRole?.color || '#ffffff';

                return (
                  <div key={msg.id} className={`message-wrapper ${isMentioned ? 'mentioned-message' : ''}`}>
                    <div 
                      className="message-avatar"
                      style={{ cursor: 'pointer' }}
                      onClick={(e) => {
                        const senderMember = members.find(m => m.id === (msg.sender_id || msg.senderId));
                        if (senderMember) handleOpenMemberCard(senderMember, e);
                      }}
                    >
                      {msg.avatar_url ? (
                        <img src={msg.avatar_url} alt={msg.username} />
                      ) : (
                        <span>{msg.username ? msg.username[0].toUpperCase() : '?'}</span>
                      )}
                    </div>
                    <div className="message-content-col">
                      <div className="message-meta">
                        <span 
                          className="message-username"
                          style={{ color: senderColor, cursor: 'pointer', fontWeight: 600 }}
                          onClick={(e) => {
                            const senderMember = members.find(m => m.id === (msg.sender_id || msg.senderId));
                            if (senderMember) handleOpenMemberCard(senderMember, e);
                          }}
                        >
                          {msg.username}
                        </span>
                        {senderRole && (
                          <span 
                            className="sender-role-pill"
                            style={{
                              fontSize: '10px',
                              fontWeight: 600,
                              color: senderRole.color,
                              background: 'rgba(255,255,255,0.06)',
                              border: `1px solid ${senderRole.color}40`,
                              borderRadius: '3px',
                              padding: '1px 5px',
                              marginLeft: '6px'
                            }}
                          >
                            ● {senderRole.name}
                          </span>
                        )}
                        <span className="message-timestamp">
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {(msg.sender_id === currentUser.id || canManageMessages) && (
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

                      {(() => {
                        const content = msg.content || '';
                        
                        // Single GIF / Image link
                        if (typeof content === 'string' && (content.startsWith('http://') || content.startsWith('https://')) && !content.includes(' ')) {
                          const isGif = content.includes('.gif') || content.includes('giphy.com') || content.includes('tenor.com');
                          const isImage = /\.(png|jpg|jpeg|webp|svg)($|\?)/i.test(content);
                          if (isGif || isImage) {
                            return (
                              <div style={{ marginTop: '6px' }}>
                                <img 
                                  src={content} 
                                  className="message-gif" 
                                  alt="Media" 
                                  style={{ maxWidth: '320px', maxHeight: '240px', borderRadius: '8px', objectFit: 'contain' }}
                                  loading="lazy"
                                />
                              </div>
                            );
                          }
                        }

                        // Parse URLs and text
                        const urlRegex = /(https?:\/\/[^\s]+)/gi;
                        const parts = content.split(urlRegex);
                        const ytMatch = content.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/|live\/))([a-zA-Z0-9_-]{11})/i);
                        const ytId = ytMatch ? ytMatch[1] : null;

                        return (
                          <div className="message-content-wrapper">
                            <div className="message-text">
                              {parts.map((part, idx) => {
                                if (part.match(urlRegex)) {
                                  return (
                                    <a 
                                      key={idx} 
                                      href={part} 
                                      target="_blank" 
                                      rel="noopener noreferrer" 
                                      style={{ color: '#00ffff', textDecoration: 'underline', wordBreak: 'break-all' }}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {part}
                                    </a>
                                  );
                                }
                                return (
                                  <span key={idx}>
                                    {part.split(/(@[a-zA-Z0-9_?!-]+)/g).map((token, tIdx) => {
                                      if (token.startsWith('@')) {
                                        const isBotMention = /^@(bot|gemini|ai)$/i.test(token);
                                        return (
                                          <span
                                            key={tIdx}
                                            style={{
                                              background: isBotMention ? 'rgba(138, 43, 226, 0.25)' : 'rgba(0, 255, 255, 0.15)',
                                              color: isBotMention ? '#d8b4fe' : '#00ffff',
                                              border: isBotMention ? '1px solid rgba(138, 43, 226, 0.45)' : '1px solid rgba(0, 255, 255, 0.35)',
                                              padding: '1px 6px',
                                              borderRadius: '4px',
                                              fontWeight: '600',
                                              display: 'inline-block',
                                              margin: '0 2px'
                                            }}
                                          >
                                            {token}
                                          </span>
                                        );
                                      }
                                      return token;
                                    })}
                                  </span>
                                );
                              })}
                            </div>

                            {ytId && (
                              <div style={{ marginTop: '8px', maxWidth: '420px', borderRadius: '10px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                                <iframe
                                  src={`https://www.youtube.com/embed/${ytId}`}
                                  title="YouTube Video"
                                  style={{ width: '100%', height: '220px', border: 'none', display: 'block' }}
                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                  allowFullScreen
                                />
                              </div>
                            )}
                          </div>
                        );
                      })()}

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
                disabled={!selectedChatroom && !isGeneralServer}
                title="Send a GIF"
              >
                GIF
              </button>
              <input
                id="message-input-textarea"
                type="text"
                placeholder={selectedChatroom?.name ? `Message #${selectedChatroom.name}...` : isGeneralServer ? 'Message #general...' : 'Type a message...'}
                value={messageInput}
                onChange={handleInputChange}
                disabled={!selectedChatroom && !isGeneralServer && chatrooms.length === 0}
                autoFocus
              />
              <button type="submit" disabled={!selectedChatroom && !isGeneralServer && chatrooms.length === 0}>Send</button>
            </div>
          </form>
        </div>

        {showMembers && (
          <div className="members-sidebar">
            <div className="members-list">
              {getGroupedMembers().map(group => (
                <div key={group.id} className="member-group-section" style={{ marginBottom: '14px' }}>
                  <h4 style={{ 
                    fontSize: '11px', 
                    fontWeight: 700, 
                    textTransform: 'uppercase', 
                    color: '#949ba4', 
                    letterSpacing: '0.5px',
                    padding: '4px 8px',
                    margin: 0
                  }}>
                    {group.title}
                  </h4>
                  <div className="group-members-list" style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px' }}>
                    {group.members.map(member => {
                      const topRole = getMemberTopRole(member);
                      const nameColor = topRole?.color || '#dbdee1';
                      return (
                        <div 
                          key={member.id} 
                          className="member-item clickable"
                          onClick={(e) => handleOpenMemberCard(member, e)}
                          title={`${member.username}${topRole ? ` (${topRole.name})` : ''}`}
                          style={{ 
                            cursor: 'pointer', 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '8px', 
                            padding: '6px 8px', 
                            borderRadius: '4px',
                            transition: 'background 0.15s'
                          }}
                        >
                          <div className="member-avatar-small" style={{ display: 'flex', alignItems: 'center' }}>
                            {member.avatar_url ? (
                              <img src={member.avatar_url} alt={member.username} style={{ width: '22px', height: '22px', borderRadius: '50%', objectFit: 'cover' }} />
                            ) : (
                              <div className="avatar-placeholder-small" style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 'bold', color: '#fff' }}>
                                {member.username ? member.username[0].toUpperCase() : '?'}
                              </div>
                            )}
                          </div>
                          <span style={{ color: nameColor, fontWeight: 500, fontSize: '13px' }}>
                            {member.username}
                          </span>
                          {member.id === server.owner_id && (
                            <span title="Server Owner" style={{ fontSize: '12px', marginLeft: 'auto' }}>👑</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Discord-style Server Settings & Roles Manager Modal */}
      {showServerSettingsModal && (
        <ServerSettingsModal
          server={server}
          currentUser={currentUser}
          onClose={() => setShowServerSettingsModal(false)}
          onServerDeleted={onServerDeleted}
        />
      )}

      {/* Discord-style Member Profile & Roles Card */}
      {activeMemberPopover && (
        <MemberProfileCard
          member={activeMemberPopover.member}
          server={server}
          currentUser={currentUser}
          serverRoles={serverRoles}
          canManageRoles={canManageRoles}
          canKickMembers={canKickMembers}
          position={activeMemberPopover.position}
          onStartDM={onStartDM}
          onRolesUpdated={() => {
            fetchMembers();
            fetchServerRoles();
          }}
          onClose={() => setActiveMemberPopover(null)}
        />
      )}
    </div>
  );
}

export default ServerChat;
