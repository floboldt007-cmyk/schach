// Scrollposition nach Zurueck (R13 CLS-1, Flo 10.11.2026: "beim Scrollen springt nichts hoch"): wer in einer langen Liste
// scrollt, weiterspringt und mit Zurueck heimkehrt, landet wieder an derselben Stelle. Ein neuer Aufruf desselben
// Bildschirms und ein Neuladen beginnen dagegen oben (Gegenprobe). Gemessen auf dem iPhone SE (375 x 667).
// Aufruf: node tests/scroll-zurueck.test.mjs
import http from 'node:http';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { browserTyp } from './browser.mjs';

const require = createRequire(import.meta.url);
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

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
  '.webmanifest': 'application/manifest+json' };
const server = http.createServer(async (q, r) => {
  try {
    const p = decodeURIComponent(new URL(q.url, 'http://x').pathname);
    const d = await readFile(path.join(WURZEL, p === '/' ? 'index.html' : p));
    r.writeHead(200, { 'Content-Type': TYPEN[path.extname(p)] || 'application/octet-stream' });
    r.end(d);
  } catch (e) { r.writeHead(404); r.end(); }
});

// das Element, das im Bildschirm wirklich scrollt (wie js/app.js scrollerIn; die Wiederherstellung steht dort in
// merkeScroll und stelleScrollHer, R13 CLS-1, seit PR #230)
const FLAECHE = () => {
  let best = null, flaeche = 0;
  for (const el of document.querySelectorAll('#app *')) {
    if (!/(auto|scroll)/.test(getComputedStyle(el).overflowY) || el.scrollHeight <= el.clientHeight + 1) continue;
    const r = el.getBoundingClientRect();
    if (r.width * r.height > flaeche) { best = el; flaeche = r.width * r.height; }
  }
  const s = document.scrollingElement;
  return s.scrollHeight > s.clientHeight + 1 && (!best || s.clientWidth * s.clientHeight > flaeche) ? s : best;
};
const stand = (s) => s.evaluate((f) => { const el = (0, eval)('(' + f + ')')(); return el ? { top: Math.round(el.scrollTop), max: el.scrollHeight - el.clientHeight } : null; }, FLAECHE.toString());
const scrolleAuf = (s, anteil) => s.evaluate(([f, a]) => { const el = (0, eval)('(' + f + ')')(); el.scrollTop = Math.round((el.scrollHeight - el.clientHeight) * a); return Math.round(el.scrollTop); }, [FLAECHE.toString(), anteil]);
const gehe = (s, n, p = {}) => s.evaluate(([n, p]) => window.__app.gehe(n, p), [n, p]);

const FAELLE = [['lernen', 'lernen', {}], ['ich', 'ich', {}], ['freunde', 'bestenliste', { reiter: 'freunde' }]];

async function main() {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const browser = await browserTyp(ladePlaywright()).launch();
  const k = await browser.newContext({ viewport: { width: 375, height: 667 }, locale: 'de-DE', hasTouch: true });
  await k.addInitScript(() => {
    try { if (!localStorage.getItem('schach-arena:v1:modul:start')) localStorage.setItem('schach-arena:v1:modul:start', JSON.stringify({ v: 1, gesehen: '2026-11-01' })); } catch (e) { /* egal */ }
  });
  const s = await k.newPage();
  const fehler = [];
  s.on('pageerror', (e) => fehler.push(e.message));
  try {
    await s.goto(`http://127.0.0.1:${server.address().port}/index.html?test#heim`);
    await s.waitForFunction(() => window.__app, null, { timeout: 30000 });
    await warte(1200);
    for (const [fall, name, params] of FAELLE) {
      await gehe(s, name, params); await warte(1500);
      const vor = await stand(s);
      if (!vor || vor.max < 60) { pruefe(`${fall}: scrollt auf dem SE`, false, JSON.stringify(vor)); continue; }
      const ziel = await scrolleAuf(s, 0.6);
      await warte(300);
      await gehe(s, 'einstellungen'); await warte(1000);
      await s.goBack(); await warte(1800);
      const nach = { ...(await stand(s)), state: await s.evaluate(() => JSON.stringify(history.state)) };
      pruefe(`${fall}: nach Zurueck wieder bei ${ziel} px`, nach && Math.abs(nach.top - ziel) <= 2, JSON.stringify(nach));
      // Gegenprobe 1: derselbe Bildschirm neu aufgerufen (nicht ueber Zurueck) beginnt oben
      await gehe(s, 'heim'); await warte(800);
      await gehe(s, name, params); await warte(1500);
      const neu = await stand(s);
      pruefe(`${fall}: neuer Aufruf beginnt oben`, neu && neu.top === 0, JSON.stringify(neu));
    }
    // Gegenprobe 2: Neuladen beginnt oben, auch wenn der Verlaufseintrag eine Position kennt
    await gehe(s, 'lernen'); await warte(1500);
    await scrolleAuf(s, 0.6);
    await gehe(s, 'einstellungen'); await warte(800);
    await s.goBack(); await warte(1500);
    await s.reload(); await s.waitForFunction(() => window.__app, null, { timeout: 30000 }); await warte(1800);
    const geladen = await stand(s);
    pruefe('Neuladen beginnt oben', geladen && geladen.top === 0, JSON.stringify(geladen));
    pruefe('Keine Seitenfehler', fehler.length === 0, fehler.join(' | '));
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
