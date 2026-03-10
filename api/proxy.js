// Vercel serverless function — proxies all /api/* requests to Railway server-side.
// Because this runs on the server, the browser never makes a cross-origin request → no CORS.

const RAILWAY = 'https://nchisecapi-production.up.railway.app';

export default async function handler(req, res) {
  // req.query.path is the [...path] catch-all array, e.g. ['auth','login']
  const path = Array.isArray(req.query.path) ? req.query.path.join('/') : (req.query.path || '');
  const url  = `${RAILWAY}/${path}${req.url.includes('?') ? '?' + req.url.split('?')[1] : ''}`;

  const headers = { 'Content-Type': 'application/json' };
  if (req.headers['authorization']) {
    headers['Authorization'] = req.headers['authorization'];
  }

  const fetchOptions = {
    method:  req.method,
    headers,
  };

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    fetchOptions.body = JSON.stringify(req.body);
  }

  try {
    const upstream = await fetch(url, fetchOptions);
    const text     = await upstream.text();

    // Forward status and content-type back to the browser
    res.status(upstream.status);
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
    res.send(text);
  } catch (err) {
    res.status(502).json({ error: 'Proxy error', detail: err.message });
  }
}
