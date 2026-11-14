// Bilder des Shops (Feinschliff R19, 14.11.2026) fuer Flos Wahl "Shop wie Fortnite": heute und die Entwuerfe
// ?shopStil=a|b|c (js/pakete/sammlung/shop-entwurf.js) auf iPhone 13 und PC, hell. Je Ansicht der Shop-Start, der Shop
// weiter unten und die Vorschau eines Bretts (heute: Anprobieren der Edition, Entwurf: Brett Aurora auf dem echten Brett).
// Kein Teil von tests/alle.mjs. Netzwerk ausschliesslich simuliert (Attrappe wie tests/r19-shop-fortnite.test.mjs); die
// Edition hat dort KEINEN Preis, denn heute steht keiner im Katalog: die Karten zeigen "Preis folgt".
//
//   node tests/bilder-shop.mjs --bilder=<ordner>      Unterordner ist/, a/, b/, c/ mit shop-<geraet>-<start|unten|vorschau>.png
//   node tests/bilder-shop.mjs --nur=a,b ...          nur diese Stile (heute heisst ist)
//   PORT=8992 node tests/bilder-shop.mjs ...          eigener Port (Standard 8992)
// Exit 0, wenn alle Bilder entstanden sind und jede Ansicht im erwarteten Stil stand; sonst 1.
import http from 'node:http';
import os from 'node:os';
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { browserTyp } from './browser.mjs';

const require = createRequire(import.meta.url);
let pw;
for (const p of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
  try { pw = require(p); break; } catch (e) { /* naechster */ }
}
if (!pw) throw new Error('Playwright fehlt (PLAYWRIGHT_PFAD setzen)');
const arg = (n) => { const a = process.argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : null; };
const BILDER = arg('bilder') || path.join(os.tmpdir(), 'bilder-shop');
const NUR = arg('nur') ? arg('nur').split(',') : ['ist', 'a', 'b', 'c'];

const root = fileURLToPath(new URL('../', import.meta.url));
const typen = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg' };
const server = http.createServer((req, res) => {
  const p = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://test').pathname).replace(/\/$/, '/index.html'));
  if (!p.startsWith(root)) { res.writeHead(403); res.end(); return; }
  try { const d = readFileSync(p); res.writeHead(200, { 'Content-Type': typen[path.extname(p)] || 'application/octet-stream' }); res.end(d); }
  catch (e) { res.writeHead(404); res.end(); }
});
const PORT = Number(process.env.PORT || 8992);
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

let ok = 0, gesamt = 0;
function pruefe(name, gut, detail = '') {
  gesamt++; if (gut) ok++;
  // INTENTIONAL-SLOP[T4]: die Pruefzeile ist die Ausgabe des Werkzeugs (wie in tests/bilder-online.mjs)
  console.log(`${gut ? 'ok  ' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(detail)}`);
}

const UID = 'u1';
const SITZUNG = { access_token: 'a.' + Buffer.from(JSON.stringify({ sub: UID })).toString('base64url') + '.x', refresh_token: 'test-r',
  expires_at: 9999999999, user: { id: UID, email: 'spieler@example.invalid' } };
const EDITION = { produkt_id: 'brett-mitternacht', name: 'Mitternacht & Gold', auflage: 10, status: 'erhaeltlich', restzahl: 9,
  verkauf_ab: '2026-11-28T10:00:00Z' };
const bediener = async (route) => {
  const url = new URL(route.request().url());
  const antwort = (d) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
  if (url.pathname.startsWith('/auth/v1/')) return antwort({ id: UID, email: 'spieler@example.invalid' });
  if (url.pathname === '/rest/v1/altersangaben') return antwort([{ ab18: true }]);
  if (url.pathname === '/rest/v1/profile') return antwort([{ user_id: UID, benutzername: 'Mira' }]);
  const rpc = url.pathname.split('/').at(-1);
  if (rpc === 'edition_staende') return antwort([EDITION]);
  if (rpc === 'karte_melde_stufen' || rpc === 'karte_waehle') return antwort({ taler: 0, stufen: {}, banner: ['start'], wahl: { banner: 'start' } });
  return antwort([]);
};
function initSkript({ sitzung }) {
  try {
    if (!sessionStorage.getItem('shop-start')) {
      sessionStorage.setItem('shop-start', '1');
      localStorage.clear();
      localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ klang: false, bewegung: 'aus', figuren: 'cburnett' }));
      localStorage.setItem('schach-arena:konto:sichtbar', '1');
      localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(sitzung));
    }
  } catch (e) { /* egal */ }
}
// alle Bilder im Blatt geladen (Brett-SVGs, Figuren), dann ein Takt fuer die Schrift
const bilderFertig = (s, wurzel) => s.waitForFunction((w) => [...document.querySelectorAll(`${w} img`)].every((i) => i.complete), wurzel, { timeout: 15000 })
  .catch(() => {}).then(() => warte(400));

const GERAETE = [['iphone13', 390, 844], ['pc', 1280, 720]];
const seitenfehler = [];
let browser;
try {
  browser = await browserTyp(pw).launch({ headless: true });
  for (const stil of NUR) {
    const ordner = path.join(BILDER, stil);
    mkdirSync(ordner, { recursive: true });
    for (const [geraet, w, h] of GERAETE) {
      const gruppe = `${stil} ${geraet}`;
      const k = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true, serviceWorkers: 'block',
        colorScheme: 'light', locale: 'de-DE', timezoneId: 'Europe/Berlin' });
      await k.route('**/*.supabase.co/**', bediener);
      await k.addInitScript(initSkript, { sitzung: SITZUNG });
      const s = await k.newPage(); s.setDefaultTimeout(15000);
      s.on('pageerror', (e) => seitenfehler.push(`${gruppe}: ${e.message}`));
      const bild = async (teil) => {
        const da = await s.screenshot({ path: path.join(ordner, `shop-${geraet}-${teil}.png`) }).then(() => true).catch(() => false);
        pruefe(`${gruppe}: Bild ${teil}`, da);
      };
      try {
        await s.goto(`http://127.0.0.1:${PORT}/index.html?test${stil === 'ist' ? '' : '&shopStil=' + stil}#heim`);
        await s.waitForFunction(() => window.__app && typeof window.__app.gehe === 'function' && document.querySelector('.screen.heim-screen'), null, { timeout: 45000 });
        await s.evaluate(() => window.__app.gehe('ich'));
        await s.waitForSelector('.sa-screen', { timeout: 30000 });
        await warte(400);
        for (let i = 0; i < 12 && await s.locator('.st-moment .st-weiter').count(); i++) { await s.locator('.st-moment .st-weiter').first().click(); await warte(250); }
        await s.locator('.sa-platz[data-bereich="shop"], .sa-gross[data-bereich="shop"]').first().click();
        await s.waitForSelector(stil === 'ist' ? '.sa-blatt .sh-karte' : '.sa-blatt .shf .shf-karte', { timeout: 15000 });
        const steht = await s.evaluate(() => document.querySelector('.sa-blatt .shf')?.dataset.shopStil || 'ist');
        pruefe(`${gruppe}: Ansicht im Stil ${stil}`, steht === stil, steht);
        await bilderFertig(s, '.sa-blatt');
        await bild('start');
        await s.evaluate(() => { const b = document.querySelector('.sa-blatt'); b.scrollTop = b.scrollHeight * 0.45; });
        await bilderFertig(s, '.sa-blatt');
        await bild('unten');
        await s.evaluate(() => { document.querySelector('.sa-blatt').scrollTop = 0; });
        if (stil === 'ist') await s.locator('.sa-blatt .sh-anprobieren').first().click();
        else {
          const k2 = s.locator('.sa-blatt .shf-karte[data-id="aurora"]').first();
          await k2.scrollIntoViewIfNeeded();
          await k2.click();
        }
        await s.waitForSelector(stil === 'ist' ? '.sheet-karte .sh-anprobe' : '.sheet-karte .shf-vorschau .brett img.figur', { timeout: 10000 });
        await bilderFertig(s, '.sheet-karte');
        await warte(500);
        await bild('vorschau');
      } catch (e) {
        pruefe(`${gruppe}: Ablauf ohne Abbruch`, false, e.message.split('\n')[0]);
      }
      await k.close().catch(() => {});
    }
  }
} finally {
  if (browser) await browser.close().catch(() => {});
  server.close();
}
pruefe('keine Seitenfehler', seitenfehler.length === 0, seitenfehler);
console.log(`\n${ok}/${gesamt} Pruefungen, Bilder in ${BILDER}`);
process.exit(ok === gesamt ? 0 : 1);
