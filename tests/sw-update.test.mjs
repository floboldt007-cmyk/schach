// Service-Worker-Update im Browser (Leistungsmessung 09.11.2026): ein Besucher mit der installierten Fassung bekommt
// eine neue Fassung, ohne dass unveraenderte Dateien neu durchs Netz muessen, und ohne dass eine alte Datei in den
// neuen Cache rutscht.
//   Phase 1: Erstbesuch, die App installiert sw.js aus dem Repo.
//   Phase 2: der Server liefert eine "neue Fassung": sw.js mit VERSION + 1 und js/ui/heim.js mit einer Zusatzzeile.
//            Der Server antwortet wie GitHub Pages mit ETag und 304 auf If-None-Match und zaehlt volle Antworten.
//   Phase 3: die neue Fassung uebernimmt; heim.js muss die neue Zeile haben, die App laeuft.
// Vorher (cache: 'reload') lud jedes Update alle Dateien neu, gemessen 744 Anfragen und 8,3 MB.
// Aufruf: node tests/sw-update.test.mjs
import http from 'node:http';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { browserTyp } from './browser.mjs';

const require = createRequire(import.meta.url);
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const warte = (ms) => new Promise((r) => setTimeout(r, ms));
const PROBE = '// sw-update-probe';
const P = 'schach-arena:v1:';

const ergebnisse = [];
function pruefe(name, ok, detail = '') {
  ergebnisse.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'ok  ' : 'FEHLER'} ${name}${!ok && detail ? ' (' + detail + ')' : ''}`);
}

function ladePlaywright() {
  for (const k of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
    try { return require(k); } catch (e) { /* naechster */ }
  }
  throw new Error('Playwright nicht gefunden (PLAYWRIGHT_PFAD setzen)');
}

const TYPEN = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm', '.json': 'application/json', '.png': 'image/png', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json', '.txt': 'text/plain', '.md': 'text/plain' };
const VERSION = Number(readFileSync(path.join(WURZEL, 'sw.js'), 'utf8').match(/const VERSION = (\d+);/)[1]);

let neueFassung = false;
let zaehler = { voll: 0, nicht: 0, volleDateien: [] };
async function inhalt(p) {
  let d = await readFile(path.join(WURZEL, p));
  if (neueFassung && p === '/sw.js') d = Buffer.from(d.toString('utf8').replace(`const VERSION = ${VERSION};`, `const VERSION = ${VERSION + 1};`));
  if (neueFassung && p === '/js/ui/heim.js') d = Buffer.concat([d, Buffer.from('\n' + PROBE + '\n')]);
  return d;
}
const server = http.createServer(async (q, r) => {
  let p = decodeURIComponent(new URL(q.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  let d;
  try { d = await inhalt(p); } catch (e) { r.writeHead(404); return r.end(); }
  const etag = '"' + crypto.createHash('md5').update(d).digest('hex').slice(0, 16) + '"';
  if (q.headers['if-none-match'] === etag) { zaehler.nicht++; r.writeHead(304, { ETag: etag }); return r.end(); }
  zaehler.voll++; zaehler.volleDateien.push(p);
  r.writeHead(200, { 'Content-Type': TYPEN[path.extname(p)] || 'application/octet-stream', ETag: etag, 'Cache-Control': 'max-age=600' });
  r.end(d);
});

// Wechselt der Service Worker, laedt die App von selbst neu (js/app.js registriereSW). Eine Auswertung, die genau
// dann laeuft, bricht mit "Execution context was destroyed" ab: auf die neue Seite warten und wiederholen.
const KONTEXT_WEG = /Execution context was destroyed|Cannot find context|frame was detached|navigation/i;
async function werte(s, fn, arg) {
  for (let versuch = 0; ; versuch++) {
    try { return await s.evaluate(fn, arg); } catch (e) {
      if (versuch >= 3 || !KONTEXT_WEG.test(e.message)) throw e;
      await s.waitForLoadState('load').catch(() => {});
      await warte(200);
    }
  }
}
const swVersion = (s) => werte(s, () => new Promise((res) => {
  const c = navigator.serviceWorker.controller;
  if (!c) return res(null);
  navigator.serviceWorker.addEventListener('message', (e) => { if (e.data && e.data.typ === 'version') res(e.data.version); }, { once: true });
  c.postMessage({ typ: 'version' });
  setTimeout(() => res('keine Antwort'), 3000);
}));
const startBereit = (s) => s.waitForFunction(() => !!document.querySelector('.screen.heim, #app > .screen'), null, { timeout: 30000 });

// Wartet auf den Endzustand nach einem Wechsel des Service Workers, statt einmal zu pruefen: die Zielversion steuert
// die Seite, keine Fassung wartet mehr, nur ihr Cache ist uebrig (activate hat den alten geloescht), und die Seite laedt
// nicht mehr neu (zweimal hintereinander dieselbe fertig geladene Seite, performance.timeOrigin).
async function warteAufVersion(s, version, ms = 60000) {
  const ende = Date.now() + ms;
  const soll = JSON.stringify(['schach-arena-v' + version]);
  let zuletzt = null;
  while (Date.now() < ende) {
    let jetzt = null;
    try {
      const v = await swVersion(s);
      const lage = await s.evaluate(async () => {
        const r = await navigator.serviceWorker.getRegistration();
        return { seite: document.readyState === 'complete' ? performance.timeOrigin : null, caches: await caches.keys(),
          ruhig: !!r && !r.waiting && !r.installing && !!r.active && r.active.state === 'activated' };
      });
      if (v === version && lage.seite && lage.ruhig && JSON.stringify(lage.caches) === soll) jetzt = lage.seite;
    } catch (e) { /* die Seite laedt gerade neu */ }
    if (jetzt && jetzt === zuletzt) { await startBereit(s).catch(() => {}); return true; }
    zuletzt = jetzt;
    await warte(600);
  }
  return false;
}

async function main() {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  // ?sw: im Testmodus registriert die App den Service Worker nur mit diesem Schalter (js/app.js registriereSW)
  const basis = `http://127.0.0.1:${server.address().port}/index.html?test&sw#heim`;
  const browser = await browserTyp(ladePlaywright()).launch();
  const k = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'de-DE' });
  await k.addInitScript((schl) => { if (!localStorage.getItem(schl)) localStorage.setItem(schl, JSON.stringify({ gesehen: '2026-01-01' })); }, P + 'modul:start');
  const s = await k.newPage();
  const fehler = [];
  s.on('pageerror', (e) => fehler.push(e.message));
  try {
    await s.goto(basis); await startBereit(s);
    await s.evaluate(() => navigator.serviceWorker.ready);
    await s.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 30000 });
    pruefe(`Erstbesuch: Version ${VERSION} installiert und steuert die Seite`, await swVersion(s) === VERSION);

    // die neue Fassung liegt online; der Besucher kommt spaeter wieder (SW_MERKER "kuerzlich" = 15 s abwarten)
    neueFassung = true; zaehler = { voll: 0, nicht: 0, volleDateien: [] };
    await warte(16000);
    await s.reload(); await startBereit(s);
    const hinweis = await s.waitForSelector('.update-hinweis', { timeout: 60000 }).then(() => true).catch(() => false);
    pruefe('Update: neue Fassung installiert, der Hinweis "Neu laden" erscheint', hinweis);
    const voll = zaehler.volleDateien.slice().sort();
    pruefe('Update: nur die geänderten Dateien kommen voll (sw.js und js/ui/heim.js), der Rest als 304 aus dem alten Cache',
      JSON.stringify(voll) === JSON.stringify(['/js/ui/heim.js', '/sw.js']) && zaehler.nicht > 500, JSON.stringify({ voll: voll.slice(0, 12), anzahl: voll.length, nicht: zaehler.nicht }));

    // naechster Besuch: die wartende Fassung uebernimmt von selbst
    await warte(16000);
    await s.reload(); await startBereit(s);
    await warteAufVersion(s, VERSION + 1);
    const lage = await werte(s, () => navigator.serviceWorker.getRegistration().then(async (r) => ({ caches: await caches.keys(),
      wartet: !!r.waiting, aktiv: r.active && r.active.state, merker: sessionStorage.getItem('schach-arena:sw-wechsel') })));
    pruefe(`Übernahme: Version ${VERSION + 1} steuert die Seite, nur ihr Cache bleibt`, await swVersion(s) === VERSION + 1
      && JSON.stringify(lage.caches) === JSON.stringify([`schach-arena-v${VERSION + 1}`]), JSON.stringify(lage));
    const probe = await werte(s, (x) => fetch('js/ui/heim.js').then((r) => r.text()).then((t) => t.includes(x)), PROBE);
    pruefe('Übernahme: die geänderte Datei kommt in der neuen Fassung aus dem Cache (keine alte Datei im neuen Cache)', probe);
    pruefe('Übernahme: die App läuft (Start sichtbar), keine Seitenfehler', await s.locator('#app > .screen').count() > 0 && fehler.length === 0, fehler.join(' | '));
  } catch (e) {
    pruefe('Ablauf ohne Abbruch', false, e.message.split('\n')[0]);
  } finally {
    await browser.close(); server.close();
  }
  const gut = ergebnisse.filter((e) => e.ok).length;
  console.log(`\n${gut}/${ergebnisse.length} bestanden`);
  process.exit(gut === ergebnisse.length ? 0 : 1);
}
main();
