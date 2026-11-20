// fc-14:10 Paket-CSS vor dem Aufbau (Befund kopfchips 20.11.2026: lernen.css kam erst nach dem Aufbau, der Screen wurde
// ohne Stil gemalt und danach die ganze Seite neu gerechnet). Gemessen wird je GEMALTEM Bild (MessageChannel aus dem rAF,
// also nach dem Rendern): kein Bild zeigt einen Screen, solange eines seiner Stylesheets noch laedt.
//   A) Start: kein gemaltes Bild mit Screen, waehrend ein Stylesheet laedt, das beim Start dazukam; der Start wartet nie
//      auf Paket-CSS, auch nicht, wenn es 8 s haengt oder ohne Netz abbricht (Startzeit gegen den normalen Start).
//   B) Erstes Oeffnen, waehrend das CSS des Screens noch laedt (1,5 s verzoegert): der Screen erscheint erst mit Stil.
//   C) CSS fehlt (404): der Screen baut trotzdem, sofort, und meldet 'schach:paket-fehler' mit grund 'fehler'.
//   D) CSS haengt: nach der Frist baut der Screen trotzdem und meldet grund 'frist'.
//
//   node tests/r25-paket-css.test.mjs
//   PORT=9797 node tests/r25-paket-css.test.mjs    Port des Testservers (sonst: frei)
import http from 'node:http';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { browserTyp } from './browser.mjs';

const require = createRequire(import.meta.url);
let pw;
for (const p of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
  try { pw = require(p); break; } catch (e) { /* naechster */ }
}
if (!pw) throw new Error('Playwright fehlt');
const root = fileURLToPath(new URL('../', import.meta.url));
const typen = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' };
const server = http.createServer((req, res) => {
  const p = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://test').pathname).replace(/\/$/, '/index.html'));
  if (!p.startsWith(root)) { res.writeHead(403); res.end(); return; }
  try { const d = readFileSync(p); res.writeHead(200, { 'Content-Type': typen[path.extname(p)] || 'application/octet-stream' }); res.end(d); }
  catch (e) { res.writeHead(404); res.end(); }
});
const PORT = Number(process.env.PORT) || await (await import('./freier-port.mjs')).freierPort();
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
const H = `http://127.0.0.1:${PORT}`;
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

let ok = 0, gesamt = 0;
function pruefe(name, gut, detail = '') {
  gesamt++; if (gut) ok++;
  // INTENTIONAL-SLOP[T4]: die Pruefzeile ist die Ausgabe des Tests (wie in tests/r22-tastatur.test.mjs)
  console.log(`${gut ? 'ok  ' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(detail)}`);
}

const UID = 'u1';
const SITZUNG = { access_token: 'a.' + Buffer.from(JSON.stringify({ sub: UID })).toString('base64url') + '.x', refresh_token: 'test-r',
  expires_at: 9999999999, user: { id: UID, email: 'spieler@example.invalid' } };

// Je gemaltem Bild: welcher Screen steht, welche Stylesheets laden noch (load/error noch nicht gekommen)
function rekorder({ sitzung }) {
  try {
    if (!sessionStorage.getItem('r25css-start')) {
      sessionStorage.setItem('r25css-start', '1');
      localStorage.clear();
      localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ klang: false, bewegung: 'normal', figuren: 'cburnett' }));
      localStorage.setItem('schach-arena:konto:sichtbar', '1');
      localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(sitzung));
      localStorage.setItem('schach-arena:v1:modul:start', JSON.stringify({ v: 1, gesehen: '2026-11-01' }));
      localStorage.setItem('schach-arena:v1:hinweis-installieren', '1');
    }
  } catch (e) { /* egal */ }
  const r = (window.__css = { bilder: [], fehler: [], t0: performance.now() });
  const merke = (l) => {
    if (l.__css) return;
    l.__css = { fertig: false };
    l.addEventListener('load', () => { l.__css.fertig = true; });
    l.addEventListener('error', () => { l.__css.fertig = true; });
  };
  new MutationObserver((ms) => {
    for (const m of ms) for (const n of m.addedNodes) if (n.tagName === 'LINK' && /stylesheet/.test(n.rel)) merke(n);
  }).observe(document, { childList: true, subtree: true });
  addEventListener('schach:paket-fehler', (e) => r.fehler.push({ paket: e.detail?.paket, art: e.detail?.art, grund: e.detail?.fehler?.grund,
    name: e.detail?.fehler?.name, t: performance.now() }));
  const mc = new MessageChannel();
  const nach = () => mc.port2.postMessage(0);
  mc.port1.onmessage = () => {
    // erst ein echter Screen zaehlt (html[data-screen] setzt app.js); davor steht der Lade-Platzhalter aus index.html
    const screen = document.querySelector('#app > .screen') ? document.documentElement.dataset.screen || null : null;
    const offen = [...document.querySelectorAll('link[rel~="stylesheet"]')].filter((l) => l.__css && !l.__css.fertig).map((l) => l.href.split('/').pop());
    r.bilder.push({ t: Math.round(performance.now()), screen, offen });
    requestAnimationFrame(nach);
  };
  requestAnimationFrame(nach);
}

const browser = await browserTyp(pw).launch();
// art: { datei: Regex auf den Pfad, 'langsam' ms | 'fehlt' | 'abbruch' }
async function seite({ css = null } = {}) {
  const k = await browser.newContext({ viewport: { width: 375, height: 667 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true,
    serviceWorkers: 'block', colorScheme: 'light', locale: 'de-DE', timezoneId: 'Europe/Berlin' });
  await k.route('**/*.supabase.co/**', (route) => {
    const url = new URL(route.request().url());
    const a = (d) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
    if (url.pathname.startsWith('/auth/v1/')) return a({ id: UID, email: 'spieler@example.invalid' });
    if (url.pathname === '/rest/v1/altersangaben') return a([{ ab18: true }]);
    if (url.pathname === '/rest/v1/profile') return a([{ user_id: UID, benutzername: 'Mira' }]);
    return a([]);
  });
  if (css) {
    await k.route((u) => u.origin === H && css.datei.test(u.pathname), async (route) => {
      if (css.art === 'fehlt') return route.fulfill({ status: 404, body: '' });
      if (css.art === 'abbruch') return route.abort('internetdisconnected');
      await warte(css.ms);
      return route.continue().catch(() => {});
    });
  }
  await k.addInitScript(rekorder, { sitzung: SITZUNG });
  const s = await k.newPage();
  s.setDefaultTimeout(30000);
  const fehler = [];
  s.on('pageerror', (e) => fehler.push(e.message));
  return { k, s, fehler };
}
const bereit = (s) => s.waitForFunction(() => window.__app && typeof window.__app.gehe === 'function' && document.querySelector('#app > .screen'), null, { timeout: 45000 });
const bilder = (s) => s.evaluate(() => window.__css.bilder);
const ohneStil = (liste, screen = null) => liste.filter((b) => b.screen && (!screen || b.screen === screen) && b.offen.length);
const erstesBild = (liste, screen = null) => liste.find((b) => b.screen && (!screen || b.screen === screen));

// A) Start
const PAKET_CSS = /^\/css\/pakete\/[a-z-]+\.css$/;
const startZeit = {};
for (const [name, css] of [['normal', null], ['Paket-CSS 8 s verzoegert', { datei: PAKET_CSS, art: 'langsam', ms: 8000 }],
  ['Paket-CSS ohne Netz', { datei: PAKET_CSS, art: 'abbruch' }]]) {
  const { k, s, fehler } = await seite({ css });
  await s.goto(`${H}/index.html?test#heim`);
  await bereit(s);
  await warte(1500);
  const l = await bilder(s);
  const erst = erstesBild(l);
  startZeit[name] = erst ? erst.t : null;
  if (name === 'normal') {
    pruefe('Start: kein gemaltes Bild mit Screen, waehrend ein Stylesheet laedt', !!erst && ohneStil(l).length === 0, ohneStil(l).slice(0, 3));
    pruefe('Start: keine Seitenfehler', fehler.length === 0, fehler.slice(0, 3));
  }
  await k.close();
}
for (const name of ['Paket-CSS 8 s verzoegert', 'Paket-CSS ohne Netz']) {
  pruefe(`Start (${name}): der erste Screen kommt hoechstens 1 s spaeter als beim normalen Start`,
    startZeit.normal != null && startZeit[name] != null && startZeit[name] - startZeit.normal <= 1000, startZeit);
}
console.log('Startzeit erstes Bild mit Screen (ms seit Seitenbeginn):', JSON.stringify(startZeit));

// B) erstes Oeffnen, CSS des Screens 1,5 s verzoegert: erst mit Stil
// lobby fehlt bewusst: der Screen leitet im Test ohne Online-Paket mal zur Arena um, mal nicht (unabhaengig vom CSS)
const FAELLE = [['lernen', /^\/css\/pakete\/lernen\.css$/], ['start', /^\/css\/pakete\/start\.css$/],
  ['raetsel-duell', /^\/css\/pakete\/raetsel-duell\.css$/]];
for (const [ziel, datei] of FAELLE) {
  const { k, s, fehler } = await seite({ css: { datei, art: 'langsam', ms: 1500 } });
  await s.goto(`${H}/index.html?test#heim`);
  await bereit(s);
  await s.evaluate(() => { window.__css.bilder = []; });
  await s.evaluate((z) => window.__app.gehe(z), ziel);
  await warte(3000);
  const l = await bilder(s);
  const erst = erstesBild(l, ziel);
  pruefe(`Oeffnen ${ziel} (CSS 1,5 s verzoegert): der Screen erscheint, aber in keinem Bild ohne sein Stylesheet`,
    !!erst && ohneStil(l, ziel).length === 0, { erschienen: !!erst, ohneStil: ohneStil(l, ziel).slice(0, 2), zuletzt: l.slice(-1) });
  pruefe(`Oeffnen ${ziel}: keine Seitenfehler`, fehler.length === 0, fehler.slice(0, 3));
  await k.close();
}

// C) CSS fehlt (404) und D) CSS haengt
for (const [fall, css, grund, vonMs, bisMs] of [['fehlt (404)', { art: 'fehlt' }, 'fehler', 0, 1500], ['haengt', { art: 'langsam', ms: 20000 }, 'frist', 3000, 6500]]) {
  const { k, s, fehler } = await seite({ css: { datei: /^\/css\/pakete\/lernen\.css$/, ...css } });
  await s.goto(`${H}/index.html?test#heim`);
  await bereit(s);
  const t0 = await s.evaluate(() => { window.__css.bilder = []; return performance.now(); });
  await s.evaluate(() => window.__app.gehe('lernen'));
  await warte(bisMs + 1000);
  const l = await bilder(s);
  const erst = erstesBild(l, 'lernen');
  const nach = erst ? erst.t - t0 : null;
  const meld = await s.evaluate(() => window.__css.fehler);
  pruefe(`Lernen, CSS ${fall}: der Screen baut trotzdem, nach ${vonMs} bis ${bisMs} ms`, nach != null && nach >= vonMs && nach <= bisMs, { nach, letzte: l.slice(-1) });
  pruefe(`Lernen, CSS ${fall}: genau eine Meldung schach:paket-fehler (paket lernen, art css, grund ${grund}, PaketCssFehler)`,
    meld.length === 1 && meld[0].paket === 'lernen' && meld[0].art === 'css' && meld[0].grund === grund && meld[0].name === 'PaketCssFehler', meld);
  pruefe(`Lernen, CSS ${fall}: keine Seitenfehler`, fehler.length === 0, fehler.slice(0, 3));
  await k.close();
}

// Rest-Fall, nur gemessen: #raetsel als Einstieg, raetsel.css 1,5 s verzoegert (ui/raetsel.js laedt beim Start, stoesst nur an)
{
  const { k, s } = await seite({ css: { datei: /^\/css\/pakete\/raetsel\.css$/, art: 'langsam', ms: 1500 } });
  await s.goto(`${H}/index.html?test#raetsel`);
  await warte(4000);
  const l = await bilder(s);
  const ohne = ohneStil(l, 'raetsel');
  console.log(`Rest-Fall #raetsel beim Start (CSS 1,5 s verzoegert): ${ohne.length} gemalte Bilder ohne Stil, ${ohne.length ? ohne.at(-1).t - ohne[0].t : 0} ms`);
  await k.close();
}

await browser.close();
server.close();
console.log(`${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
