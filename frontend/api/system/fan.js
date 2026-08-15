let supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://aebntdjjniirnwthtwlx.supabase.co';
if (!supabaseUrl || supabaseUrl.includes('trycloudflare.com')) {
  supabaseUrl = 'https://aebntdjjniirnwthtwlx.supabase.co';
}
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlYm50ZGpqbmlpcm53dGh0d2x4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4NzIwNTYsImV4cCI6MjA5ODQ0ODA1Nn0.la5aH5b2Tb5cj5yfVEWHhPKU4_ieCWydEPWH8V81eIg';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, bypass-tunnel-reminder');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'POST') {
    return res.status(200).json({ message: 'Fan profile updated (Cloud Simulated Mode)', mode: req.body?.mode || 'auto' });
  }

  try {
    const cacheRes = await fetch(`${supabaseUrl}/rest/v1/system_config?key=eq.latest_thermals_cache`, {
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`
      }
    });
    if (cacheRes.ok) {
      const rows = await cacheRes.json();
      if (rows && rows[0] && rows[0].value) {
        const cached = JSON.parse(rows[0].value);
        if (cached.fan) return res.status(200).json(cached.fan);
      }
    }
  } catch (e) {}

  return res.status(200).json({
    rpm: 2850,
    pwm: 130,
    speedPercent: 50,
    tempC: 46,
    mode: 'auto',
    enableMode: 1
  });
}
