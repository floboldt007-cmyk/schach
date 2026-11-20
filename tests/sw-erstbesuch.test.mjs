// Erstbesuch auf langsamem Netz (fc-06:00, 20.11.2026): Ein neuer Spieler, leerer Speicher, Slow 4G (150 ms, 1,6 Mbit/s).
// Gemessen auf a424fce3: WebKit beendet das install-Ereignis nach etwa 30 s. Mit allen 770 Dateien im install war die
// Registrierung danach weg (Slow 4G: 743 von 770 im Cache, Fast 3G: 292 von 770), also kein Offline und beim naechsten
// Besuch derselbe Download von vorn. Seitdem legt install nur den KERN ab, der Rest kommt in Haeppchen danach.
// Geprueft:
//   (1) nach dem Erstbesuch ist ein Worker aktiv und steuert die Seite
//   (2) der Kern liegt dann vollstaendig im Cache
//   (3) das Nachladen setzt bei jedem weiteren Besuch fort (der Cache waechst, schrumpft nie)
//   (4) danach liegt jede Datei aus DATEIEN im Cache, es gibt nur den einen Cache
// Das Netz drosselt der eigene Server (eine Leitung fuer alle Antworten, je Anfrage eine RTT, ETag/304 und gzip wie
// GitHub Pages), damit es in Chromium und WebKit gleich ist.
//   node tests/sw-erstbesuch.test.mjs            Chromium
//   BROWSER=webkit node tests/sw-erstbesuch.test.mjs
//   NETZ=fast3g ...                              562 ms, 1,44 Mbit/s
import http from 'node:http';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { browserTyp } from './browser.mjs';
import { begrenzt } from './zeitwaechter.mjs';

const require = createRequire(import.meta.url);
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const warte = (ms) => new Promise((r) => setTimeout(r, ms));
// grenze: hoechste Dauer der Installation. WebKit beendet install nach etwa 30 s. Fast 3G ueber HTTP/1.1 (dieser Server,
// hoechstens 6 Leitungen) hat bei 221 Dateien schon 37 x 562 ms = 20,8 s reine Wartezeit (bei 217 Dateien gemessen 25,3 s); GitHub Pages
// spricht HTTP/2 und braucht dort gerechnet etwa 9 s
const NETZE = { slow4g: { rtt: 150, kbps: 1600, grenze: 20000 }, fast3g: { rtt: 562, kbps: 1440, grenze: 28000 } };
const NETZ = NETZE[process.env.NETZ || 'slow4g'];
const BYTE_PRO_MS = (NETZ.kbps * 1000) / 8 / 1000;

const ergebnisse = [];
function pruefe(name, ok, detail = '') {
  ergebnisse.push({ name, ok: !!ok });
  console.log(`${ok ? 'ok  ' : 'FEHLER'} ${name}${!ok && detail ? ' (' + detail + ')' : ''}`); // INTENTIONAL-SLOP[T4]: die Konsole ist der Ausgabeweg der Probe
}
function ladePlaywright() {
  for (const k of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
    try { return require(k); } catch (e) { /* naechster */ } // INTENTIONAL-SLOP[F1]: Fehlschlag heisst naechster Kandidat
  }
  throw new Error('Playwright nicht gefunden (PLAYWRIGHT_PFAD setzen)');
}

// DATEIEN und KERN so, wie der Worker sie sieht
const SW_TEXT = readFileSync(path.join(WURZEL, 'sw.js'), 'utf8');
const sw = (() => {
  const kontext = { self: { location: new URL('https://example.org/schach/sw.js'), addEventListener() {}, navigator: {} }, URL, console };
  vm.createContext(kontext);
  vm.runInContext(SW_TEXT + '\n;globalThis.__sw = { DATEIEN, KERN: typeof KERN === "undefined" ? null : KERN, CACHE };', kontext);
  return kontext.__sw;
})();

const TYPEN = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.wasm': 'application/wasm',
  '.webmanifest': 'application/manifest+json', '.txt': 'text/plain', '.md': 'text/plain' };
const GZIP = /\.(html|js|mjs|css|json|svg|webmanifest|txt|md)$/;
const fertig = new Map();   // Pfad -> { etag, roh, gz }
async function datei(p) {
  if (!fertig.has(p)) {
    const roh = await readFile(path.join(WURZEL, p));
    fertig.set(p, { roh, gz: GZIP.test(p) ? zlib.gzipSync(roh) : null, etag: '"' + crypto.createHash('md5').update(roh).digest('hex').slice(0, 16) + '"' });
  }
  return fertig.get(p);
}
// eine Leitung fuer alle Antworten: jedes Stueck wartet, bis die Leitung frei ist
let leitungFrei = 0;
async function sende(res, puffer) {
  for (let i = 0; i < puffer.length; i += 4096) {
    const teil = puffer.subarray(i, i + 4096);
    leitungFrei = Math.max(Date.now(), leitungFrei) + teil.length / BYTE_PRO_MS;
    const w = leitungFrei - Date.now();
    if (w > 1) await warte(w);
    if (!res.write(teil)) await new Promise((r) => res.once('drain', r));
  }
  res.end();
}
let anfragen = 0;
const server = http.createServer(async (q, res) => {
  let p = decodeURIComponent(new URL(q.url, 'http://x').pathname);
  if (!p.startsWith('/schach/')) { res.writeHead(404); return res.end(); }
  p = p.slice('/schach/'.length) || 'index.html';
  if (p.endsWith('/')) p += 'index.html';
  let d;
  try { d = await datei(p); } catch (e) { res.writeHead(404); return res.end(); }
  anfragen++;
  await warte(NETZ.rtt);
  if (q.headers['if-none-match'] === d.etag) { res.writeHead(304, { ETag: d.etag }); return res.end(); }
  const gz = d.gz && /gzip/.test(q.headers['accept-encoding'] || '');
  res.writeHead(200, { 'Content-Type': TYPEN[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'max-age=600', ETag: d.etag,
    ...(gz ? { 'Content-Encoding': 'gzip' } : {}) });
  await sende(res, gz ? d.gz : d.roh);
});

async function main() {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const pw = ladePlaywright();
  const typ = browserTyp(pw);
  const geraet = process.env.BROWSER === 'webkit' ? pw.devices['iPhone 13'] : pw.devices['Pixel 5'];
  const browser = await typ.launch();
  const k = await browser.newContext({ ...geraet, locale: 'de-DE' });
  const s = await k.newPage();
  const seitenfehler = [];
  s.on('pageerror', (e) => seitenfehler.push(e.message.slice(0, 160)));
  const adresse = `http://127.0.0.1:${server.address().port}/schach/index.html?test&sw`;
  // Lage des Workers aus Sicht der Seite; liest den Cache der eigenen Fassung
  const lage = () => begrenzt('Lage', () => s.evaluate(async (name) => {
    const r = await navigator.serviceWorker.getRegistration();
    const c = (await caches.keys()).includes(name) ? await caches.open(name) : null;
    const im = c ? (await c.keys()).map((q) => new URL(q.url).pathname.replace(/^\/schach\//, '')) : [];
    return { reg: !!r, aktiv: r && r.active ? r.active.state : null, installiert: !!(r && r.installing), steuert: !!navigator.serviceWorker.controller,
      caches: await caches.keys(), im };
  }, sw.CACHE), 20000).catch((e) => ({ fehler: e.message.slice(0, 80) }));
  const t0 = Date.now();
  try {
    await s.goto(adresse, { waitUntil: 'commit', timeout: 120000 });
    await s.waitForFunction(() => !!document.querySelector('#app > .screen:not(.lade-screen)'), null, { timeout: 120000 });
    // (1) ein Worker wird aktiv: hoechstens 120 s nach dem Aufruf; auf a424fce3 verschwand die Registrierung unter WebKit
    let l = await lage();
    let warReg = false, installSeit = null;
    while (Date.now() - t0 < 120000 && !(l.aktiv === 'activated')) {
      if (l.reg) warReg = true;
      if (l.installiert && installSeit === null) installSeit = Date.now();
      if (warReg && !l.reg && !l.fehler) break;   // Registrierung weg: install ist gescheitert
      await warte(500);
      l = await lage();
    }
    const aktivNach = Date.now() - t0;
    const installMs = installSeit === null ? null : Date.now() - installSeit;
    pruefe(`Erstbesuch: ein Worker ist aktiv (${Math.round(aktivNach / 1000)} s)`, l.aktiv === 'activated',
      JSON.stringify({ reg: l.reg, aktiv: l.aktiv, installiert: l.installiert, caches: l.caches, im: l.im && l.im.length }));
    // Die Grenze gilt fuer WebKit (dort endet install nach etwa 30 s); Chromium kennt diese Grenze nicht, dort nur grob 60 s
    const grenze = process.env.BROWSER === 'webkit' ? NETZ.grenze : 60000;
    pruefe(`Erstbesuch: die Installation dauert hoechstens ${grenze / 1000} s (${installMs === null ? '?' : (installMs / 1000).toFixed(1)} s)`,
      l.aktiv === 'activated' && installMs !== null && installMs <= grenze);
    // (2) der Kern liegt dann vollstaendig im Cache
    const kern = Array.isArray(sw.KERN) ? sw.KERN : null;
    const fehltKern = kern ? kern.filter((d) => !(l.im || []).includes(d)) : ['KERN fehlt in sw.js'];
    pruefe(`Erstbesuch: der Kern (${kern ? kern.length : 0} Dateien) liegt im Cache`, l.aktiv === 'activated' && fehltKern.length === 0,
      fehltKern.slice(0, 5).join(', '));
    // (3) und (4) weitere Besuche, bis alles da ist: der Cache waechst und schrumpft nie
    let vorher = (l.im || []).length, geschrumpft = '', besuche = 0;
    while (Date.now() - t0 < 420000 && l.aktiv === 'activated' && (l.im || []).length < sw.DATEIEN.length) {
      await warte(15000);
      await s.reload({ waitUntil: 'commit', timeout: 60000 }).catch(() => {});
      besuche++;
      await s.waitForFunction(() => !!document.querySelector('#app > .screen:not(.lade-screen)'), null, { timeout: 60000 }).catch(() => {});
      l = await lage();
      const n = (l.im || []).length;
      if (n < vorher) geschrumpft = `${vorher} -> ${n} beim Besuch ${besuche + 1}`;
      vorher = Math.max(vorher, n);
    }
    pruefe('Nachladen: der Cache schrumpft bei keinem weiteren Besuch', !geschrumpft, geschrumpft);
    const fehlt = sw.DATEIEN.filter((d) => !(l.im || []).includes(d));
    pruefe(`Nachladen: nach ${besuche} weiteren Besuchen liegt jede Datei im Cache (${Math.round((Date.now() - t0) / 1000)} s)`,
      fehlt.length === 0, `${fehlt.length} fehlen: ${fehlt.slice(0, 5).join(', ')}`);
    pruefe('Nachladen: danach gibt es nur den eigenen Cache', JSON.stringify(l.caches) === JSON.stringify([sw.CACHE]), JSON.stringify(l.caches));
    pruefe('keine Seitenfehler', seitenfehler.length === 0, seitenfehler.slice(0, 3).join(' | '));
  } catch (e) {
    pruefe('Ablauf ohne Abbruch', false, e.message.split('\n')[0]);
  } finally {
    console.log(`MESSUNG ${process.env.BROWSER || 'chromium'} netz=${process.env.NETZ || 'slow4g'} anfragen=${anfragen} dauer_s=${Math.round((Date.now() - t0) / 1000)}`); // INTENTIONAL-SLOP[T4]: Messwert fuer den Bericht
    await browser.close().catch(() => {});
    server.close();
  }
  const gut = ergebnisse.filter((e) => e.ok).length;
  console.log(`\n${gut}/${ergebnisse.length} bestanden`); // INTENTIONAL-SLOP[T4]: Ausgabeweg
  process.exit(gut === ergebnisse.length ? 0 : 1);
}
main();
