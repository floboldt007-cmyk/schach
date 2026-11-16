// Bilder fuer Flo (R19 Titel und Erfolge): Profil mit Vitrine, Erfolgsliste und Titelliste, hell und dunkel, iPhone 13 und
// PC. Spielstand zum Zeigen: zehn Bots besiegt, einige Taten-Titel und lokale Stufen erspielt (nichts davon ist echt).
//   PLAYWRIGHT_PFAD=... node werkzeuge/titel-erfolge-bilder.mjs --ziel "<Vault-Ordner>"
import http from 'node:http';
import { createRequire } from 'node:module';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { BOTS } from '../js/bots.js';

const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT_PFAD || 'playwright');
const i = process.argv.indexOf('--ziel');
const ZIEL = i > 0 ? process.argv[i + 1] : null;
if (!ZIEL) { console.error('--ziel "<Ordner>" fehlt'); process.exit(2); }
await mkdir(ZIEL, { recursive: true });

const WURZEL = fileURLToPath(new URL('../', import.meta.url));
const TYPEN = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.mp3': 'audio/mpeg',
  '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
const server = http.createServer(async (q, r) => {
  const p = path.resolve(WURZEL, '.' + decodeURIComponent(new URL(q.url, 'http://bild').pathname).replace(/\/$/, '/index.html'));
  if (!p.startsWith(WURZEL)) { r.writeHead(403); r.end(); return; }
  try { const d = await readFile(p); r.writeHead(200, { 'Content-Type': TYPEN[path.extname(p)] || 'application/octet-stream' }); r.end(d); }
  catch (e) { r.writeHead(404); r.end(); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASIS = `http://127.0.0.1:${server.address().port}/index.html?test`;
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

// zehn Bots besiegt (die ersten drei mit drei Sternen), Taten-Titel und lokale Stufen erspielt
const FORTSCHRITT = JSON.stringify({ bots: Object.fromEntries(BOTS.slice(0, 10).map((b, n) => [b.id, { sterne: [true, n < 3, n < 3], siege: 2 }])), brillanteZuege: [] });
const SAMMELN = JSON.stringify({
  profil: { vitrine: ['stufe-besuch', 'stufe-siege', 'stufe-schattenseite'], titel: 'tat-honigwabe' },
  titelFrei: ['tat-strohhut', 'tat-postsack', 'tat-strickkorb', 'tat-honigwabe', 'tat-siegel-knight', 'koennen-gleichgewicht'],
  lokalStufen: ['besuch-1', 'besuch-2', 'schattenseite-1', 'ohnenetz-1', 'friedenspfeife-1', 'eroeffnungen-1', 'sternenhagel-1'],
});
const GERAETE = [['iphone13', { width: 390, height: 844 }, 3], ['pc', { width: 1440, height: 900 }, 1]];

const browser = await pw.chromium.launch({ headless: true });
const fehler = [];
let n = 0;
for (const schema of ['light', 'dark']) {
  for (const [geraet, viewport, dpr] of GERAETE) {
    const k = await browser.newContext({ viewport, deviceScaleFactor: dpr, colorScheme: schema, locale: 'de-DE', timezoneId: 'Europe/Berlin',
      serviceWorkers: 'block', reducedMotion: 'reduce', hasTouch: geraet !== 'pc', isMobile: geraet !== 'pc' });
    await k.route('**/*', (route) => {
      const u = new URL(route.request().url());
      if (u.hostname === '127.0.0.1') return route.continue();
      if (u.hostname.endsWith('.supabase.co')) return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      return route.abort();
    });
    await k.addInitScript(({ fortschritt, sammeln }) => {
      try {
        localStorage.setItem('schach-arena:v1:modul:start', JSON.stringify({ v: 1, gesehen: '2026-11-01' }));
        localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ klang: false }));
        localStorage.setItem('schach-arena:v1:hinweis-installieren', '1');
        localStorage.setItem('schach-arena:v1:fortschritt', fortschritt);
        localStorage.setItem('schach-arena:v1:einstellungen:sammeln', sammeln);
      } catch (e) { /* egal */ }
    }, { fortschritt: FORTSCHRITT, sammeln: SAMMELN });
    const s = await k.newPage();
    s.on('pageerror', (e) => fehler.push(`${schema}/${geraet}: ${e.message}`));
    await s.goto(BASIS + '#ich');
    await s.waitForSelector('.sa-screen', { timeout: 30000 });
    await warte(600);
    // Freischalt-Momente wegtippen, wie ein Spieler es tut
    for (let m = 0; m < 12 && await s.locator('.st-moment .st-weiter').count(); m++) { await s.locator('.st-moment .st-weiter').first().click(); await warte(250); }
    const hell = schema === 'light' ? 'hell' : 'dunkel';
    await s.screenshot({ path: path.join(ZIEL, `profil-vitrine-${hell}-${geraet}.png`) }); n++;
    for (const bereich of ['erfolge', 'titel']) {
      await s.locator(`.sa-platz[data-bereich="${bereich}"], .sa-gross[data-bereich="${bereich}"]`).first().click();
      await s.waitForSelector(`.sa-blatt .sa-bereich[data-bereich="${bereich}"]:not([hidden])`, { timeout: 10000 });
      await warte(500);
      await s.screenshot({ path: path.join(ZIEL, `${bereich === 'erfolge' ? 'erfolgsliste' : 'titelliste'}-${hell}-${geraet}.png`) }); n++;
      // die ganze Liste: das Blatt bis unten in Schritten, je ein Bild
      // scrollt das Blatt selbst oder ein Teil darin: das hoechste scrollbare Element nehmen
      const rolle = () => [document.querySelector('.sa-blatt'), ...document.querySelectorAll('.sa-blatt *')]
        .filter((x) => x && x.scrollHeight > x.clientHeight + 4 && /auto|scroll/.test(getComputedStyle(x).overflowY)).sort((a, b) => b.scrollHeight - a.scrollHeight)[0];
      const hoehe = await s.evaluate((f) => { const x = new Function('return (' + f + ')()')(); return x ? [x.scrollHeight, x.clientHeight] : [0, 0]; }, rolle.toString());
      for (let teil = 1, oben = hoehe[1] * 0.9; oben < hoehe[0] && teil <= 8; teil++, oben += hoehe[1] * 0.9) {
        await s.evaluate(([f, y]) => { const x = new Function('return (' + f + ')()')(); if (x) x.scrollTop = y; }, [rolle.toString(), oben]);
        await warte(250);
        await s.screenshot({ path: path.join(ZIEL, `${bereich === 'erfolge' ? 'erfolgsliste' : 'titelliste'}-${hell}-${geraet}-teil${teil + 1}.png`) }); n++;
      }
      await s.locator('.sa-blatt .sheet-knoepfe button').first().click();
      await s.waitForSelector('.sa-blatt', { state: 'detached', timeout: 10000 }).catch(() => {});
      await warte(300);
    }
    await k.close();
  }
}
await browser.close();
server.close();
console.log(`titel-erfolge-bilder: ${n} Bilder, Seitenfehler ${fehler.length}${fehler.length ? ' ' + fehler.join(' | ') : ''}`);
process.exit(fehler.length ? 1 : 0);
