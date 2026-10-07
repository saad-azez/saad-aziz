// Serves demos/ (scripts/snapshot-sites.mjs) for development, each copy at the
// root of its own domain: http://<id>.localhost:5300/ (browsers send any
// *.localhost to this machine). Its own domain matters twice over: the copy's
// address is the one it was written for (a router or a reload finds its page),
// and the browser runs it in its own process, so a heavy site never shares a
// thread with the portfolio on localhost:5173 and the page never stutters.
// http://localhost:5300/ lists them; /<id>/ also works, for a host without subdomains.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..', 'demos');
const PORT = Number(process.env.PORT ?? 5300);
const TYPES = { '.html': 'text/html; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css' };

createServer(async (request, response) => {
  const host = (request.headers.host ?? '').split(':')[0].toLowerCase();
  const id = host.endsWith('.localhost') ? host.slice(0, -'.localhost'.length) : '';
  const path = decodeURIComponent(new URL(request.url, 'http://x').pathname);
  if (id && !/^[a-z0-9-]+$/.test(id)) { response.writeHead(400).end(); return; }
  // A copy is its one page: anything else it asks its own domain for does not exist here.
  if (id && path !== '/' && path !== '/index.html') {
    response.writeHead(404, { 'content-type': 'text/plain' }).end('Only the page itself is copied.');
    return;
  }
  let file = id ? join(ROOT, id, 'index.html') : normalize(join(ROOT, path));
  if (!file.startsWith(ROOT)) { response.writeHead(403).end(); return; }
  if (!id && path.endsWith('/')) file = join(file, 'index.html');
  try {
    const body = await readFile(file);
    response.writeHead(200, {
      'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
      'x-robots-tag': 'noindex, nofollow',
      'cache-control': 'no-cache',
    });
    response.end(body);
  } catch {
    response.writeHead(404, { 'content-type': 'text/plain' }).end('Not a demo.');
  }
}).listen(PORT, () => console.log(`demos at http://<id>.localhost:${PORT}/ (list: http://localhost:${PORT}/)`));
