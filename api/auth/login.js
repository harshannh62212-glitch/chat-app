import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

let supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://aebntdjjniirnwthtwlx.supabase.co';
if (!supabaseUrl || supabaseUrl.includes('trycloudflare.com')) {
  supabaseUrl = 'https://aebntdjjniirnwthtwlx.supabase.co';
}
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlYm50ZGpqbmlpcm53dGh0d2x4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4NzIwNTYsImV4cCI6MjA5ODQ0ODA1Nn0.la5aH5b2Tb5cj5yfVEWHhPKU4_ieCWydEPWH8V81eIg';
const JWT_SECRET = process.env.JWT_SECRET || 'chat_app_jwt_super_secret_key_2026';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, bypass-tunnel-reminder');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch(e) {}
    }
    const { username, password } = body || {};

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const trimmed = username.trim();
    const queryUrl = `${supabaseUrl}/rest/v1/users?username=ilike.${encodeURIComponent(trimmed)}&limit=1`;
    
    const dbRes = await fetch(queryUrl, {
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`
      }
    });

    if (!dbRes.ok) {
      throw new Error(`Database error: ${dbRes.status}`);
    }

    const users = await dbRes.json();
    const user = users && users[0];

    if (!user || !user.password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET);

    return res.status(200).json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatar_url: user.avatar_url,
        is_admin: user.is_admin || user.username === 'Nxghtmare3621'
      },
      token
    });
  } catch (err) {
    console.error('[AUTH LOGIN] Error:', err);
    return res.status(500).json({ error: 'Login failed: ' + (err.message || 'Server error') });
  }
}
