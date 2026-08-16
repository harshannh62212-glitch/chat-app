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

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch(e) {}
    }
    const { username, password } = body || {};

    if (!username || !password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const trimmed = username.trim();
    if (trimmed.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters long' });
    }

    // Check existing user
    const checkRes = await fetch(`${supabaseUrl}/rest/v1/users?username=ilike.${encodeURIComponent(trimmed)}&limit=1`, {
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`
      }
    });
    const existing = await checkRes.json();
    if (existing && existing.length > 0) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const createRes = await fetch(`${supabaseUrl}/rest/v1/users`, {
      method: 'POST',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        username: trimmed,
        email: `${trimmed}@chat.local`,
        password: hashedPassword
      })
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      return res.status(400).json({ error: 'Registration failed: ' + errText });
    }

    const createdUsers = await createRes.json();
    const user = createdUsers[0];
    const token = jwt.sign({ userId: user.id }, JWT_SECRET);

    return res.status(201).json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        is_admin: user.username === 'Nxghtmare3621'
      },
      token
    });
  } catch (err) {
    console.error('[AUTH REGISTER] Error:', err);
    return res.status(500).json({ error: 'Registration failed: ' + err.message });
  }
}
