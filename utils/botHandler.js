const { query } = require('../db/database');
const fetch = globalThis.fetch || require('node-fetch');

async function handleLocalBotResponse(io, serverId, chatroomId, content, senderId) {
  let promptText = content.replace(/@(bot|gemini|Gemini AI Assistant|ai)/gi, '').trim();
  if (!promptText) {
    promptText = 'hello';
  }

  // Resolve chatroomId if missing or invalid
  let targetChatroomId = chatroomId;
  try {
    if (!targetChatroomId || isNaN(parseInt(targetChatroomId, 10))) {
      let targetServerId = serverId;
      if (parseInt(serverId, 10) === 1 || serverId === '1') {
        const genRes = await query("SELECT id FROM servers WHERE name = 'General' OR id = 1 LIMIT 1");
        if (genRes.rows.length > 0) targetServerId = genRes.rows[0].id;
      }
      const roomRes = await query(
        "SELECT id FROM chatrooms WHERE server_id = $1 ORDER BY is_general DESC, created_at ASC LIMIT 1",
        [targetServerId]
      );
      if (roomRes.rows.length > 0) {
        targetChatroomId = roomRes.rows[0].id;
      }
    }
  } catch (e) {}

  const botSocketRoom = `server-${serverId}`;
  if (io) {
    io.to(botSocketRoom).emit('user-typing', { userId: 'gemini-bot-id' });
  }

  try {
    let botResponse = '';

    // 1. Try local Ollama if available
    try {
      const response = await fetch('http://127.0.0.1:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama3.2:1b',
          prompt: `You are a helpful, friendly AI assistant for the wired-io chat platform. Respond concisely and helpfully to: ${promptText}`,
          stream: false,
          options: {
            num_thread: 2,
            num_predict: 120
          }
        }),
        signal: AbortSignal.timeout(3000)
      });
      if (response.ok) {
        const json = await response.json();
        if (json.response && json.response.trim()) {
          botResponse = json.response.trim();
        }
      }
    } catch (e) {}

    // 2. Try Gemini API fallback (gemini-1.5-flash / gemini-2.0-flash)
    if (!botResponse) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (apiKey) {
        const geminiModels = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro'];
        for (const model of geminiModels) {
          try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: `You are a helpful, friendly AI assistant inside the wired-io chat platform. Respond concisely to: ${promptText}` }] }]
              }),
              signal: AbortSignal.timeout(4000)
            });
            if (response.ok) {
              const json = await response.json();
              const text = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
              if (text) {
                botResponse = text;
                break;
              }
            }
          } catch (gemErr) {}
        }
      }
    }

    // 3. Smart built-in heuristic fallback
    if (!botResponse) {
      const p = promptText.toLowerCase();
      if (p.includes('hello') || p.includes('hi') || p.includes('hey')) {
        botResponse = `👋 Hello! I'm your AI assistant. How can I help you today? You can ask me questions, chat, or test platform features!`;
      } else if (p.includes('who are you') || p.includes('what are you')) {
        botResponse = `🤖 I am the built-in AI assistant for wired-io! I can assist with discussions, answer questions, and keep the community active.`;
      } else if (p.includes('help')) {
        botResponse = `💡 **Wired-IO Tips**:
• Chat in channels or send Direct Messages in the DMs tab
• Add friends using their usernames
• Explore YouTube & Spotify tabs in the left rail
• Type \`@bot\` anytime to chat with me!`;
      } else if (p.includes('time') || p.includes('date')) {
        botResponse = `🕒 Current system time is ${new Date().toLocaleTimeString()} on ${new Date().toLocaleDateString()}.`;
      } else if (p.includes('joke')) {
        const jokes = [
          "Why do programmers prefer dark mode? Because light attracts bugs! 🐛",
          "There are 10 types of people in the world: those who understand binary, and those who don't.",
          "Why was the JavaScript developer sad? Because they didn't know how to `null` their feelings."
        ];
        botResponse = jokes[Math.floor(Math.random() * jokes.length)];
      } else {
        botResponse = `🤖 You said: "${promptText}". I'm actively monitoring the chat! Feel free to ask me questions, request a joke, or explore channels.`;
      }
    }

    // Ensure bot user exists in database
    await query(
      `INSERT INTO users (id, username, email, password, avatar_url)
       VALUES ('gemini-bot-id', 'Gemini AI Assistant', 'gemini-bot@ai.local', 'bot-no-password-hash', 'https://uxwing.com/wp-content/themes/uxwing/download/brands-and-social-media/google-gemini-icon.png')
       ON CONFLICT (id) DO NOTHING`
    );

    let newMsgId = `bot_${Date.now()}`;
    let createdAt = new Date().toISOString();

    if (targetChatroomId) {
      try {
        const result = await query(
          `INSERT INTO server_messages (sender_id, chatroom_id, content, is_moderated)
           VALUES ($1, $2, $3, true) RETURNING id, created_at`,
          ['gemini-bot-id', targetChatroomId, botResponse]
        );
        if (result.rows.length > 0) {
          newMsgId = result.rows[0].id;
          createdAt = result.rows[0].created_at;
        }
      } catch (dbErr) {
        console.warn('[LOCAL BOT] Message DB insert skipped, broadcasting directly:', dbErr.message);
      }
    }

    if (io) {
      const payload = {
        id: newMsgId,
        senderId: 'gemini-bot-id',
        sender_id: 'gemini-bot-id',
        username: 'Gemini AI Assistant',
        avatar_url: 'https://uxwing.com/wp-content/themes/uxwing/download/brands-and-social-media/google-gemini-icon.png',
        content: botResponse,
        serverId: serverId || 1,
        server_id: serverId || 1,
        chatroom_id: targetChatroomId || 1,
        created_at: createdAt,
        timestamp: createdAt,
        isDM: false,
        reactions: {}
      };

      io.to(botSocketRoom).emit('new-message', payload);
      if (botSocketRoom !== 'server-1') {
        io.to('server-1').emit('new-message', payload);
      }
    }
  } catch (err) {
    console.error('[LOCAL BOT] Error generating response:', err);
  }
}

module.exports = { handleLocalBotResponse };
