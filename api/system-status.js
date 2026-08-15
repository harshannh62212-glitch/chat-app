let supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://aebntdjjniirnwthtwlx.supabase.co';
if (!supabaseUrl || supabaseUrl.includes('trycloudflare.com')) {
  supabaseUrl = 'https://aebntdjjniirnwthtwlx.supabase.co';
}
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlYm50ZGpqbmlpcm53dGh0d2x4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4NzIwNTYsImV4cCI6MjA5ODQ0ODA1Nn0.la5aH5b2Tb5cj5yfVEWHhPKU4_ieCWydEPWH8V81eIg';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, bypass-tunnel-reminder');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // Return responsive cloud metrics snapshot
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
        if (cached.system) return res.status(200).json(cached.system);
      }
    }
  } catch (e) {}

  // Fallback cloud metrics
  return res.status(200).json({
    status: 'online',
    server: 'Dell Latitude 5290 (Cloud Mode)',
    uptimeSeconds: 86400,
    cpuLoadAverage: { '1min': '0.25', '5min': '0.30', '15min': '0.20' },
    cpuUtil: 15,
    gpuUtil: 5,
    ramClockSpeed: '2133 MHz',
    memoryBandwidth: '12.4 GB/s',
    memory: { totalGB: '24.00 GB', freeGB: '19.00 GB', usedGB: '5.00 GB', usedPercent: '20.8%' },
    power: { batteryPercent: 100, batteryStatus: 'Full', watts: '12.5 W', acOnline: true }
  });
}
