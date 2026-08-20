module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('bypass-tunnel-reminder', 'true');
  if (req.method === 'OPTIONS') return res.status(200).end();
  return res.status(200).send('pong-32bytes-payload-status-okay');
};
