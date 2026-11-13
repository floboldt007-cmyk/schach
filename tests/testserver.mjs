// Gemeinsamer statischer Test-Server der Browser-Suiten, Ersatz fuer "python3 -m http.server" mit derselben Aufrufform:
//   node tests/testserver.mjs <port> [--bind <host>]        liefert das Arbeitsverzeichnis aus (cwd des spawn)
// Warum: unter Windows verweigerte python http.server unter Last Verbindungen (ERR_CONNECTION_REFUSED, gemessen
// 12.11.2026: 69 bis 121 von 400 gleichzeitigen Anfragen), die Suiten wurden zufaellig rot. Node nimmt sie an.
// Eigener Prozess wie bisher (nicht im Testprozess), damit eine beschaeftigte Suite das Ausliefern nicht blockiert und
// server.kill() in den Suiten unveraendert bleibt. Verhalten wie python: GET/HEAD, Ordner ohne "/" -> 301, index.html,
// sonst Ordnerliste, 404, Last-Modified/304. Vertrag: tests/testserver.test.mjs.
import http from 'node:http';
import { createReadStream, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

// Typen wie python http.server (3.12) fuer alles, was es kannte, ohne charset (python sendet keinen);
// .woff2/.woff/.ttf/.webp/.map kannte python nicht (application/octet-stream), hier mit ihrem richtigen Typ
const TYPEN = {
  '.html': 'text/html', '.htm': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.map': 'application/json', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.opus': 'audio/ogg', '.wav': 'audio/wav', '.m4a': 'audio/mp4',
  '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.wasm': 'application/wasm', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf',
  '.txt': 'text/plain', '.md': 'text/markdown', '.xml': 'text/xml',
};

const args = process.argv.slice(2);
const PORT = Number(args.find((a) => /^\d+$/.test(a)) || 8000);
const bindIndex = args.indexOf('--bind');
const HOST = bindIndex >= 0 ? args[bindIndex + 1] : '127.0.0.1';
const WURZEL = path.resolve(process.cwd());

function fehler(res, status, text) {
  const koerper = `<!DOCTYPE html><title>${status}</title><h1>${status} ${text}</h1>`;
  res.writeHead(status, { 'Content-Type': 'text/html;charset=utf-8', 'Content-Length': Buffer.byteLength(koerper) });
  res.end(koerper);
}

const ohneHtml = (s) => s.replace(/[&<>"]/g, (z) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[z]);

function liste(req, res, ordner, pfad) {
  const eintraege = readdirSync(ordner, { withFileTypes: true }).map((e) => e.name + (e.isDirectory() ? '/' : '')).sort();
  const koerper = `<!DOCTYPE html><meta charset="utf-8"><title>${ohneHtml(pfad)}</title><ul>`
    + eintraege.map((n) => `<li><a href="${encodeURI(n)}">${ohneHtml(n)}</a></li>`).join('') + '</ul>';
  res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8', 'Content-Length': Buffer.byteLength(koerper) });
  res.end(req.method === 'HEAD' ? undefined : koerper);
}

function datei(req, res, voll, st) {
  // python vergleicht auf ganze Sekunden (Last-Modified hat keine Millisekunden)
  const sekunden = Math.floor(st.mtimeMs / 1000);
  const seit = Date.parse(req.headers['if-modified-since'] || '');
  if (Number.isFinite(seit) && sekunden <= Math.floor(seit / 1000)) {
    res.writeHead(304, { 'Last-Modified': new Date(sekunden * 1000).toUTCString() });
    res.end();
    return;
  }
  res.writeHead(200, {
    'Content-Type': TYPEN[path.extname(voll).toLowerCase()] || 'application/octet-stream',
    'Content-Length': st.size,
    'Last-Modified': new Date(sekunden * 1000).toUTCString(),
  });
  if (req.method === 'HEAD') { res.end(); return; }
  createReadStream(voll).on('error', () => res.destroy()).pipe(res);
}

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') { fehler(res, 501, 'Unsupported method'); return; }
  const roh = req.url || '/';
  const anfrage = roh.includes('?') ? roh.slice(roh.indexOf('?')) : '';
  let pfad;
  try { pfad = decodeURIComponent(roh.split(/[?#]/)[0]); } catch (e) { fehler(res, 400, 'Bad request'); return; }
  const voll = path.resolve(WURZEL, '.' + path.posix.normalize('/' + pfad));
  if (voll !== WURZEL && !voll.startsWith(WURZEL + path.sep)) { fehler(res, 404, 'File not found'); return; }
  let st;
  try { st = statSync(voll); } catch (e) { fehler(res, 404, 'File not found'); return; }
  if (st.isDirectory()) {
    if (!pfad.endsWith('/')) {
      res.writeHead(301, { Location: encodeURI(pfad + '/') + anfrage, 'Content-Length': 0 });
      res.end();
      return;
    }
    for (const index of ['index.html', 'index.htm']) {
      try { const ist = statSync(path.join(voll, index)); if (ist.isFile()) { datei(req, res, path.join(voll, index), ist); return; } } catch (e) { /* weiter */ }
    }
    liste(req, res, voll, pfad);
    return;
  }
  datei(req, res, voll, st);
});

// grosse Warteschlange: viele Browser-Kontexte laden gleichzeitig
server.listen({ port: PORT, host: HOST, backlog: 1024 });
server.on('error', (e) => { console.error(e); process.exit(1); });
const ende = () => { server.close(); server.closeAllConnections(); process.exit(0); };
process.on('SIGTERM', ende);
process.on('SIGINT', ende);
