let supabaseUrl = process.env.VITE_SUPABASE_URL;
if (!supabaseUrl || !supabaseUrl.includes('supabase.co')) {
  supabaseUrl = 'https://aebntdjjniirnwthtwlx.supabase.co';
}

const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlYm50ZGpqbmlpcm53dGh0d2x4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4NzIwNTYsImV4cCI6MjA5ODQ0ODA1Nn0.la5aH5b2Tb5cj5yfVEWHhPKU4_ieCWydEPWH8V81eIg';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/system_config?key=eq.active_tunnel_url`, {
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`
      }
    });

    if (!response.ok) {
      throw new Error(`Supabase returned status ${response.status}`);
    }

    const data = await response.json();
    const tunnelUrl = data[0]?.value;

    if (tunnelUrl) {
      return res.status(200).json({ url: tunnelUrl });
    } else {
      return res.status(404).json({ error: 'Tunnel URL not found' });
    }
  } catch (err) {
    return res.status(500).json({ 
      error: err.message, 
      stack: err.stack,
      cause: err.cause ? { message: err.cause.message, code: err.cause.code } : null 
    });
  }
}
