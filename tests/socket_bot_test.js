const { io } = require('../frontend/node_modules/socket.io-client');

async function testSocketAndBot() {
  console.log('Testing Socket.IO and @bot response...');

  const socket = io('http://127.0.0.1:8000', {
    transports: ['websocket', 'polling']
  });

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.disconnect();
      reject(new Error('Socket test timed out after 15s'));
    }, 15000);

    socket.on('connect', () => {
      console.log('✅ SOCKET.IO: Connected to local server on port 8000, socket ID:', socket.id);
      
      const serverId = '1';
      const chatroomId = 1;

      socket.emit('user-joined', 'test_user_id', serverId);

      socket.on('new-message', (msg) => {
        console.log(`📩 SOCKET.IO MESSAGE RECEIVED: [${msg.username || msg.sender_id}]: "${msg.content}"`);
        if (msg.sender_id === 'gemini-bot-id' || msg.username?.includes('Bot') || msg.username?.includes('Gemini')) {
          console.log('✅ SOCKET.IO & BOT: AI Bot replied successfully!');
          clearTimeout(timeout);
          socket.disconnect();
          resolve(true);
        }
      });

      setTimeout(() => {
        console.log('📤 Sending message: "@bot What is 2 + 2?"');
        socket.emit('send-message', {
          id: `msg_${Date.now()}`,
          senderId: 'test_user_id',
          username: 'TestUser',
          serverId: serverId,
          chatroom_id: chatroomId,
          content: '@bot What is 2 + 2?'
        });
      }, 500);
    });

    socket.on('connect_error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

testSocketAndBot()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ SOCKET/BOT TEST ERROR:', err.message);
    process.exit(1);
  });
