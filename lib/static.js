// Serves the website files from the /public folder (plain Node.js, no Express)
const fs = require('fs').promises;
const path = require('path');

const ROOT = path.join(__dirname, '..', 'public');
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

// Returns true if a file was sent, false if there is no such file.
async function serveStatic(req, res, pathname) {
  if (req.method !== 'GET') return false;
  let rel;
  try {
    rel = decodeURIComponent(pathname);
  } catch (e) {
    return false;
  }
  if (rel === '/') rel = '/index.html';
  const file = path.resolve(ROOT, '.' + rel);
  if (file !== ROOT && !file.startsWith(ROOT + path.sep)) return false; // block ../ tricks
  try {
    const data = await fs.readFile(file);
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-cache'
    });
    res.end(data);
    return true;
  } catch (err) {
    return false;
  }
}

module.exports = { serveStatic };
