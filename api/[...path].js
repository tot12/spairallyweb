// Vercel catch-all serverless function.
// Automatically handles ALL requests to /api/* — no rewrite rule needed.
// Runs server-side: browser calls spairally.com/api/auth/login → this function
// calls Railway internally → no CORS ever reaches the browser.

const RAILWAY = 'https://nchisecapi-production.up.railway.app';

module.exports = async function handler(req, res) {
  // req.query.path is the catch-all array, e.g. /api/auth/login → ['auth','login']
  const segments = Array.isArray(req.query.path)
    ? req.query.path
    : [req.query.path].filter(Boolean);

  const queryString = req.url.includes('?') ? '?' + req.url.split('?')[1] : '';
  const url = `${RAILWAY}/${segments.join('/')}${queryString}`;

  const headers = { 'Content-Type': 'application/json' };
  if (req.headers['authorization']) {
    headers['Authorization'] = req.headers['authorization'];
  }

  const options = { method: req.method, headers };
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    options.body = JSON.stringify(req.body);
  }

  try {
    const upstream = await fetch(url, options);
    const text = await upstream.text();
    res.status(upstream.status)
       .setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json')
       .send(text);
  } catch (err) {
    res.status(502).json({ error: 'Proxy error', detail: err.message });
  }
}
