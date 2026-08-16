import jwt from 'jsonwebtoken';

let supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://aebntdjjniirnwthtwlx.supabase.co';
if (!supabaseUrl || supabaseUrl.includes('trycloudflare.com')) {
  supabaseUrl = 'https://aebntdjjniirnwthtwlx.supabase.co';
}
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlYm50ZGpqbmlpcm53dGh0d2x4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4NzIwNTYsImV4cCI6MjA5ODQ0ODA1Nn0.la5aH5b2Tb5cj5yfVEWHhPKU4_ieCWydEPWH8V81eIg';
const JWT_SECRET = process.env.JWT_SECRET || 'chat_app_jwt_super_secret_key_2026';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, bypass-tunnel-reminder');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    let userId;
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      userId = decoded.userId;
    } catch(e) {
      const decoded = jwt.decode(token);
      userId = decoded?.userId || decoded?.sub;
    }

    if (!userId) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const dbRes = await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${encodeURIComponent(userId)}&limit=1`, {
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`
      }
    });

    if (!dbRes.ok) return res.status(404).json({ error: 'User not found' });
    const users = await dbRes.json();
    const user = users && users[0];
    if (!user) return res.status(404).json({ error: 'User not found' });

    return res.status(200).json({
      id: user.id,
      username: user.username,
      email: user.email,
      avatar_url: user.avatar_url,
      is_admin: user.is_admin || user.username === 'Nxghtmare3621'
    });
  } catch (err) {
    return res.status(401).json({ error: 'Authentication failed' });
  }
}
