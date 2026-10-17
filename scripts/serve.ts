// npm start: serves the built site (out/, from npm run build) the way Cloudflare does, for a local check before deploying.
// /api/* and /healthz are forwarded to the API (API_URL, default http://127.0.0.1:8787: run `npm run dev` in backend/).
// Page headers come from public/_headers, the same file Cloudflare uses.
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { extname, resolve, sep, basename, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../out', import.meta.url)));
const TYPES: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8' };

/** The headers public/_headers sets for every path ("/*" block) */
function pageHeaders(): Record<string, string> {
  const out: Record<string, string> = {}; let inAll = false;
  for (const line of readFileSync(new URL('../public/_headers', import.meta.url), 'utf8').split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (!/^\s/.test(line)) { inAll = line.trim() === '/*'; continue; }
    const i = line.indexOf(':'); if (inAll && i > 0) out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return out;
}

// Passes the request on unchanged, Host included (as the Cloudflare service binding does): the API only accepts
// sign-in writes whose Origin matches the address the browser used.
function forward(req: http.IncomingMessage, res: http.ServerResponse, api: string): Promise<void> {
  const target = new URL(api);
  return new Promise(done => {
    const up = http.request({ hostname: target.hostname, port: target.port || 80, path: req.url || '/', method: req.method,
      headers: { ...req.headers, 'x-forwarded-for': req.socket.remoteAddress || '' } }, r => {
      res.writeHead(r.statusCode || 502, r.headers); r.pipe(res); r.on('end', () => done());
    });
    up.on('error', () => {
      if (!res.headersSent) res.writeHead(502, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'api_unreachable', message: 'The API is not running at ' + api })); done();
    });
    req.pipe(up);
  });
}

export function createSiteServer(api = process.env.API_URL || 'http://127.0.0.1:8787'): http.Server {
  const sec = pageHeaders();
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', 'http://x');
      if (url.pathname === '/healthz' || url.pathname.startsWith('/api/')) { await forward(req, res, api); return; }
      // posix-style URL path handling first, so this behaves the same on Windows, macOS and Linux
      let rel = posix.normalize(decodeURIComponent(url.pathname)); if (rel.endsWith('/')) rel += 'index.html';
      const file = resolve(root, '.' + rel);
      if (!file.startsWith(root + sep)) { res.writeHead(403, sec).end(); return; }
      if (/^_(headers|redirects|routes\.json)$/.test(basename(file))) { res.writeHead(404, sec).end('Not found'); return; } // Cloudflare config files, never served
      let st; try { st = await stat(file); } catch { res.writeHead(404, sec).end('Not found'); return; }
      if (st.isDirectory() && !rel.endsWith('/')) { res.writeHead(301, { location: url.pathname + '/' + url.search, ...sec }).end(); return; } // /builder -> /builder/
      if (!st.isFile()) { res.writeHead(404, sec).end('Not found'); return; }
      res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache', ...sec });
      res.end(await readFile(file));
    } catch (e) { console.error('server_error', e instanceof Error ? e.message : String(e)); if (!res.headersSent) res.writeHead(500); res.end('Server error'); }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT) || 3000;
  createSiteServer().listen(port, () => console.log(`MatchBee site on http://localhost:${port} (API: ${process.env.API_URL || 'http://127.0.0.1:8787'})`));
}
