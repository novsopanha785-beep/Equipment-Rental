const { send, HttpError } = require('./lib/respond');
const { serveStatic } = require('./lib/static');

const resources = [
  require('./resources/equipment'),
  require('./resources/borrowers'),
  require('./resources/rentals')
];
// types.js is optional (groups of 4 delete it)
try {
  resources.push(require('./resources/types'));
} catch (e) {
  if (e.code !== 'MODULE_NOT_FOUND') throw e;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let tooLarge = false;
    const MAX_BODY = 1024 * 1024; // 1 MB is more than enough for this project.

    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        tooLarge = true;
        return; // Keep reading so the client receives a normal JSON error response.
      }
      if (!tooLarge) chunks.push(chunk);
    });
    req.on('end', () => {
      if (tooLarge) return reject(new HttpError(400, 'Request body is too large (max 1 MB)'));
      if (size === 0) return resolve({});
      const raw = Buffer.concat(chunks).toString('utf8');
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(new HttpError(400, 'Body is not valid JSON'));
      }
    });
    req.on('error', reject);
  });
}

async function router(req, res) {
  try {
    let url;
    try {
      url = new URL(req.url, 'http://localhost');
    } catch (e) {
      throw new HttpError(400, 'Invalid request URL');
    }
    let parts;
    try {
      parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
    } catch (e) {
      throw new HttpError(400, 'Invalid URL encoding');
    } // '/equipment/3' -> ['equipment','3']

    if (parts.length === 0) {
      if (req.method !== 'GET') throw new HttpError(405, 'Method not allowed');
      // The assignment requires the API root to return JSON for every client.
      return send(res, 200, {
        message: 'Equipment Rental API is running',
        dashboard: '/app',
        resources: resources.map((r) => r.path)
      });
    }

    // Keep the optional browser dashboard separate from the JSON API root.
    if (parts.length === 1 && parts[0] === 'app') {
      if (req.method !== 'GET') throw new HttpError(405, 'Method not allowed');
      if (await serveStatic(req, res, '/')) return;
      throw new HttpError(404, 'Dashboard not found');
    }

    const resource = resources.find((r) => r.path === '/' + parts[0]);
    if (!resource) {
      // not an API resource: maybe a website file (css, js, images)
      if (await serveStatic(req, res, url.pathname)) return;
      throw new HttpError(404, 'Not found');
    }

    let body = {};
    if (req.method === 'POST' || req.method === 'PUT') body = await readBody(req);

    await resource.handle(req, res, parts.slice(1), body);
  } catch (err) {
    let status = 500;
    let message = 'Internal server error';
    if (err instanceof HttpError) {
      status = err.status;
      message = err.message;
    } else {
      console.error(err);
    }
    if (res.headersSent) return res.end();
    send(res, status, { error: message });
  }
}

module.exports = router;
