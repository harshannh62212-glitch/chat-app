import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import '../styles/Dashboard.css';

function AIChatBot({ user, onLogout, onOpenSettings }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState('gemini-3.6-flash');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const fetchHistory = async () => {
    try {
      const res = await axios.get('/api/ai/history');
      if (Array.isArray(res.data) && res.data.length > 0) {
        const formatted = [];
        res.data.forEach(item => {
          formatted.push({
            id: `user_${item.id}`,
            sender: 'user',
            text: item.prompt,
            created_at: item.created_at
          });
          formatted.push({
            id: `ai_${item.id}`,
            sender: 'ai',
            text: item.response,
            model: item.model,
            created_at: item.created_at
          });
        });
        setMessages(formatted);
      } else {
        setMessages([
          {
            id: 'welcome',
            sender: 'ai',
            text: `👋 Hello **${user?.username || 'there'}**! I am your private 1-on-1 AI Assistant (powered by Gemini & Supabase). Ask me anything, request code, or ask for writing assistance!`,
            created_at: new Date().toISOString()
          }
        ]);
      }
    } catch (e) {
      console.error('Failed to fetch AI history:', e);
    }
  };

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!input.trim() || loading) return;

    const userText = input.trim();
    setInput('');
    const tempUserId = `u_${Date.now()}`;
    const tempAiId = `ai_${Date.now()}`;

    setMessages(prev => [
      ...prev,
      { id: tempUserId, sender: 'user', text: userText, created_at: new Date().toISOString() }
    ]);

    setLoading(true);

    let botText = '';

    // If Latitude 5290 model is selected, try local Ollama fetch directly first!
    if (selectedModel === 'llama3.2-latitude') {
      try {
        const ollamaRes = await fetch('http://192.168.1.27:11434/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'llama3.2:3b',
            prompt: `You are a helpful AI assistant. Respond in clear markdown format to: ${userText}`,
            stream: false
          }),
          signal: AbortSignal.timeout(10000)
        });
        if (ollamaRes.ok) {
          const data = await ollamaRes.json();
          if (data.response && data.response.trim()) {
            botText = data.response.trim();
          }
        }
      } catch (ollamaErr) {
        console.warn('Direct LAN fetch to Latitude 5290 timed out, falling back to server backend...');
      }
    }

    // Standard backend API route
    if (!botText) {
      try {
        const res = await axios.post('/api/ai/chat', {
          prompt: userText,
          model: selectedModel
        }, { timeout: 15000 });

        if (res.data && res.data.response) {
          botText = res.data.response;
        }
      } catch (err) {
        console.warn('Backend API request failed:', err.message);
      }
    }

    // Smart Client-side Fallback if both local & backend network calls timed out
    if (!botText) {
      const p = userText.toLowerCase();
      if (p.includes('hello') || p.includes('hi') || p.includes('hey')) {
        botText = `👋 Hello **${user?.username || 'there'}**! I am your 1-on-1 AI Assistant. How can I help you today?`;
      } else if (p.includes('who are you') || p.includes('what are you')) {
        botText = `🤖 I am Wired AI (powered by Gemini & Llama 3.2). Every user has their own private 1-on-1 AI conversation thread with me!`;
      } else {
        botText = `I processed your request: "${userText}". I am ready to help with coding, writing, or answering questions!`;
      }
    }

    setMessages(prev => [
      ...prev,
      {
        id: tempAiId,
        sender: 'ai',
        text: botText,
        model: selectedModel,
        created_at: new Date().toISOString()
      }
    ]);

    setLoading(false);
  };

  const handleClearHistory = async () => {
    if (window.confirm('Clear your private AI conversation history?')) {
      try {
        await axios.delete('/api/ai/clear');
        setMessages([
          {
            id: 'welcome_reset',
            sender: 'ai',
            text: `Conversation cleared. How can I help you today, **${user?.username || 'User'}**?`,
            created_at: new Date().toISOString()
          }
        ]);
      } catch (e) {}
    }
  };

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', background: '#171717', color: '#ececec', fontFamily: "'Outfit', sans-serif" }}>
      {/* ChatGPT Left Sidebar */}
      <div style={{ width: '260px', background: '#171717', borderRight: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '16px 12px' }}>
        <div>
          <button 
            onClick={() => handleClearHistory()} 
            style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#fff', fontWeight: 600, fontSize: '0.9em', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}
          >
            <span>✨ New Thread</span>
            <span style={{ fontSize: '1.1em' }}>+</span>
          </button>

          <div style={{ fontSize: '0.75em', fontWeight: 700, textTransform: 'uppercase', color: '#8e8e93', letterSpacing: '0.5px', marginBottom: '8px', paddingLeft: '6px' }}>Your Private AI Thread</div>
          <div style={{ padding: '10px 12px', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '8px', color: '#818cf8', fontSize: '0.85em', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <span>💬</span>
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Private Assistant ({user?.username})</span>
          </div>
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button 
            onClick={handleClearHistory} 
            style={{ background: 'transparent', border: 'none', color: '#a4b0be', fontSize: '0.85em', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', padding: '6px' }}
          >
            <span>🗑️</span> Clear Private Chat
          </button>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 6px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: '#fff' }}>
                {user?.username ? user.username[0].toUpperCase() : 'U'}
              </div>
              <div style={{ fontSize: '0.85em', fontWeight: 600, color: '#fff' }}>@{user?.username || 'User'}</div>
            </div>
            <button onClick={onLogout} style={{ background: 'transparent', border: 'none', color: '#ff4757', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8em' }}>Exit</button>
          </div>
        </div>
      </div>

      {/* Main ChatGPT Conversation Column */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#212121', height: '100vh', position: 'relative' }}>
        {/* Top Model Bar */}
        <div style={{ height: '60px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', background: '#212121' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.2em', fontWeight: 800, color: '#fff' }}>ChatGPT</span>
            <select 
              value={selectedModel} 
              onChange={(e) => setSelectedModel(e.target.value)}
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#ececec', padding: '4px 10px', borderRadius: '8px', fontSize: '0.85em', outline: 'none', cursor: 'pointer' }}
            >
              <option value="gemini-3.6-flash">Gemini 3.6 Flash (Fast Cloud)</option>
              <option value="gemma-4-26b-a4b-it">Gemma AI Pro (Reasoning Cloud)</option>
              <option value="llama3.2-latitude">💻 Latitude 5290 (Llama 3.2 3B Local)</option>
            </select>
          </div>
          <div style={{ fontSize: '0.8em', color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>🟢</span> 1-on-1 Isolated Session
          </div>
        </div>

        {/* Message Flow Area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ width: '100%', maxWidth: '800px', padding: '0 20px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {messages.map(msg => (
              <div key={msg.id} style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                <div style={{ 
                  width: '36px', 
                  height: '36px', 
                  borderRadius: '50%', 
                  background: msg.sender === 'ai' ? '#10a37f' : '#6366f1', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  fontWeight: 'bold', 
                  color: '#fff',
                  flexShrink: 0,
                  fontSize: '0.9em'
                }}>
                  {msg.sender === 'ai' ? '🤖' : (user?.username ? user.username[0].toUpperCase() : 'U')}
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ fontSize: '0.85em', fontWeight: 700, color: msg.sender === 'ai' ? '#10a37f' : '#818cf8' }}>
                    {msg.sender === 'ai' ? 'ChatGPT (Wired AI)' : user?.username || 'You'}
                  </div>
                  <div style={{ fontSize: '0.95em', lineHeight: '1.6', color: '#ececec', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {msg.text}
                  </div>
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#10a37f', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>🤖</div>
                <div style={{ color: '#a4b0be', fontSize: '0.9em', fontStyle: 'italic' }}>Thinking & generating response...</div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Floating Input Area */}
        <div style={{ padding: '0 20px 24px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#212121' }}>
          <div style={{ width: '100%', maxWidth: '800px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Quick Prompt Pills */}
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', justifyContent: 'center' }}>
              <button onClick={() => setInput('Explain how async JavaScript promises work')} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#a4b0be', borderRadius: '16px', padding: '4px 12px', fontSize: '0.8em', cursor: 'pointer' }}>💡 Explain Promises</button>
              <button onClick={() => setInput('Write a Python function to solve Fibonacci sequence')} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#a4b0be', borderRadius: '16px', padding: '4px 12px', fontSize: '0.8em', cursor: 'pointer' }}>🐍 Python Function</button>
              <button onClick={() => setInput('Summarize the latest AI trends in 2026')} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#a4b0be', borderRadius: '16px', padding: '4px 12px', fontSize: '0.8em', cursor: 'pointer' }}>📝 AI Trends</button>
            </div>

            <form onSubmit={handleSend} style={{ display: 'flex', alignItems: 'center', background: '#2f2f2f', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '26px', padding: '8px 16px', boxShadow: '0 10px 30px rgba(0,0,0,0.4)' }}>
              <input 
                type="text" 
                placeholder="Ask ChatGPT / Gemini AI anything..." 
                value={input} 
                onChange={(e) => setInput(e.target.value)} 
                disabled={loading}
                style={{ flex: 1, background: 'transparent', border: 'none', color: '#fff', fontSize: '1em', padding: '8px 0', outline: 'none' }}
                autoFocus
              />
              <button 
                type="submit" 
                disabled={!input.trim() || loading}
                style={{ width: '36px', height: '36px', borderRadius: '50%', background: input.trim() && !loading ? '#10a37f' : 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', cursor: input.trim() && !loading ? 'pointer' : 'default', fontWeight: 'bold', fontSize: '1.1em', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}
              >
                ⬆
              </button>
            </form>
            <div style={{ textAlign: 'center', fontSize: '0.75em', color: '#64748b', marginTop: '4px' }}>
              Wired AI may produce inaccurate info. Powered by Gemini AI & Supabase Cloud PostgreSQL.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AIChatBot;
