// Effekt-Vorschau im Shop (Feinschliff R20): Regal "Effekte" mit den 9 Effekten aus assets/shop/vorrat.json, gesperrt mit
// Schloss und "Bald". Ein Tipp spielt den Effekt einmal auf dem echten Brett (js/board.js) an der richtigen Stelle ab:
//   Zug-Effekte auf dem Zielfeld f3 des gezeigten Zuges g1-f3, die Funkenspur auf dem Weg von g1 nach f3,
//   Sieg-Effekte ueber das ganze Brett, die Lichtsaeule mit dem Fusspunkt auf dem Koenigsfeld e1.
// Der Effekt endet von selbst; bei "weniger Bewegung" steht ein ruhiges Standbild. Das Blatt springt dabei nicht.
// iPhone 13 und PC, hell und dunkel. Netz nur simuliert, die Vorschau ruft nichts beim Server auf.
//
//   node tests/r20-effekt-vorschau.test.mjs
//   PORT=8978 node tests/r20-effekt-vorschau.test.mjs   eigener Port (Standard: frei)
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
  '.wasm': 'application/wasm', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg' };
const server = http.createServer((req, res) => {
  const p = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://test').pathname).replace(/\/$/, '/index.html'));
  if (!p.startsWith(root)) { res.writeHead(403); res.end(); return; }
  try { const d = readFileSync(p); res.writeHead(200, { 'Content-Type': typen[path.extname(p)] || 'application/octet-stream' }); res.end(d); }
  catch (e) { res.writeHead(404); res.end(); }
});
const PORT = Number(process.env.PORT) || await (await import('./freier-port.mjs')).freierPort();
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

let ok = 0, gesamt = 0;
function pruefe(name, gut, detail = '') {
  gesamt++; if (gut) ok++;
  // INTENTIONAL-SLOP[T4]: die Pruefzeile ist die Ausgabe des Tests (wie in tests/r19-shop-fortnite.test.mjs)
  console.log(`${gut ? 'ok  ' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(detail)}`);
}

const VORRAT = JSON.parse(readFileSync(new URL('../assets/shop/vorrat.json', import.meta.url), 'utf8'));
const EFFEKTE = VORRAT.stuecke.filter((v) => v.art === 'effekt').map((v) => v.id);
const AUSLAGE = JSON.parse(readFileSync(new URL('../assets/shop/auslage.json', import.meta.url), 'utf8'));
pruefe('Vorrat: 9 Effekte', EFFEKTE.length === 9, EFFEKTE);
pruefe('Auslage: das Regal Effekte zeigt alle 9 in der Reihenfolge des Vorrats',
  JSON.stringify((AUSLAGE.regale?.effekt || []).map((x) => x.id)) === JSON.stringify(EFFEKTE), AUSLAGE.regale?.effekt);

const UID = 'u1';
const SITZUNG = { access_token: 'a.' + Buffer.from(JSON.stringify({ sub: UID })).toString('base64url') + '.x', refresh_token: 'test-r',
  expires_at: 9999999999, user: { id: UID, email: 'spieler@example.invalid' } };
function bediener(z) {
  return async (route) => {
    const url = new URL(route.request().url());
    const antwort = (d) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
    if (url.pathname.startsWith('/auth/v1/')) return antwort({ id: UID, email: 'spieler@example.invalid' });
    if (url.pathname === '/rest/v1/altersangaben') return antwort([{ ab18: true }]);
    if (url.pathname === '/rest/v1/profile') return antwort([{ user_id: UID, benutzername: 'Mira' }]);
    if (url.pathname === '/rest/v1/sonderstuecke') return antwort([]);
    const rpc = url.pathname.split('/').at(-1);
    // spielstaende ist der Abgleich des Kontos im Hintergrund (js/konto.js, alle 30 Sekunden), keine Folge der Vorschau
    if (rpc !== 'spielstaende') z.aufrufe.push(rpc);
    if (rpc === 'karte_melde_stufen' || rpc === 'karte_waehle') return antwort({ taler: 0, stufen: {}, banner: ['start'], wahl: { banner: 'start' } });
    return antwort([]);
  };
}
function initSkript({ sitzung }) {
  try {
    if (sessionStorage.getItem('shop-start')) return;
    sessionStorage.setItem('shop-start', '1');
    localStorage.clear();
    localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ klang: false, bewegung: 'normal', figuren: 'cburnett' }));
    localStorage.setItem('schach-arena:konto:sichtbar', '1');
    localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(sitzung));
  } catch (e) { /* egal */ }
}

const seitenfehler = [];
async function oeffneShop(browser, { w, h, farbe, reduziert = false }) {
  const z = { aufrufe: [] };
  const k = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: w < 700, serviceWorkers: 'block',
    colorScheme: farbe === 'dunkel' ? 'dark' : 'light', reducedMotion: reduziert ? 'reduce' : 'no-preference', locale: 'de-DE', timezoneId: 'Europe/Berlin' });
  await k.route('**/*.supabase.co/**', bediener(z));
  await k.addInitScript(initSkript, { sitzung: SITZUNG });
  const s = await k.newPage();
  s.setDefaultTimeout(15000);
  s.on('pageerror', (e) => seitenfehler.push(`${w} ${farbe}: ${e.message}`));
  await s.goto(`http://127.0.0.1:${PORT}/index.html?test#heim`);
  await s.waitForFunction(() => window.__app && typeof window.__app.gehe === 'function' && document.querySelector('.screen.heim-screen'), null, { timeout: 45000 });
  await s.evaluate(() => window.__app.gehe('ich'));
  await s.waitForSelector('.sa-screen', { timeout: 30000 });
  await warte(400);
  for (let i = 0; i < 12 && await s.locator('.st-moment .st-weiter').count(); i++) { await s.locator('.st-moment .st-weiter').first().click(); await warte(250); }
  await s.locator('.sa-platz[data-bereich="shop"], .sa-gross[data-bereich="shop"]').first().click();
  await s.waitForSelector('.sa-blatt .shf .shf-karte', { timeout: 15000 });
  return { k, s, z };
}

const KARTE = (id) => `.sa-blatt .shf-regal[data-art="effekt"] .shf-rk[data-id="${id}"]`;
async function tippe(s, id) {
  const karte = s.locator(KARTE(id));
  await karte.waitFor({ state: 'attached', timeout: 15000 });
  await karte.scrollIntoViewIfNeeded();
  await karte.click();
  await s.waitForSelector('.sheet-karte .shf-effekt-ebene', { timeout: 10000 });
}
async function schliesse(s) {
  await s.locator('.sheet-karte.shf-sheet .sheet-knoepfe button', { hasText: 'Schließen' }).first().click();
  await s.waitForSelector('.sheet-karte.shf-sheet', { state: 'detached', timeout: 5000 }).catch(() => {});
  await warte(300);
}

// Lage im Brett in Feldern (0 bis 8, a8 oben links), gemessen an den echten Rechtecken
const messeLage = (s) => s.evaluate(() => {
  const brett = document.querySelector('.sheet-karte .shf-vorschau-brett').getBoundingClientRect();
  const feld = brett.width / 8;
  const inFeldern = (el) => { const r = el.getBoundingClientRect(); return [(r.left + r.width / 2 - brett.left) / feld, (r.top + r.height / 2 - brett.top) / feld]; };
  const svg = document.querySelector('.sheet-karte .shf-effekt-ebene svg');
  const r = svg.getBoundingClientRect();
  return { mitte: inFeldern(svg), breite: r.width / feld, hoehe: r.height / feld,
    funken: [...svg.querySelectorAll('circle')].map(inFeldern), fuss: svg.querySelector('ellipse') ? inFeldern(svg.querySelector('ellipse')) : null };
});
const masse = (s) => s.evaluate(() => ['.sheet-karte.shf-sheet', '.sheet-karte.shf-sheet .shf-vorschau-brett'].map((w) => {
  const r = document.querySelector(w).getBoundingClientRect();
  return [r.left, r.top, r.width, r.height].map((n) => Math.round(n));
}).join('|'));
const abstand = ([a, b], [c, d]) => Math.hypot(a - c, b - d);
// Abstand eines Punktes zur Strecke von p nach q
function zurStrecke(x, p, q) {
  const [dx, dy] = [q[0] - p[0], q[1] - p[1]];
  const t = Math.max(0, Math.min(1, ((x[0] - p[0]) * dx + (x[1] - p[1]) * dy) / (dx * dx + dy * dy)));
  return abstand(x, [p[0] + t * dx, p[1] + t * dy]);
}
const G1 = [6.5, 7.5], F3 = [5.5, 5.5], E1 = [4.5, 7.5];

async function pruefeEffekt(s, id, gruppe) {
  await tippe(s, id);
  await s.waitForSelector('.sheet-karte .shf-effekt-ebene[data-zustand="laeuft"]', { timeout: 10000 });
  const vorher = await masse(s);
  const lage = await messeLage(s);
  if (id === 'funkenspur') {
    pruefe(`${gruppe} funkenspur: alle Funken liegen auf dem Weg g1-f3`, lage.funken.length >= 2 && lage.funken.every((f) => zurStrecke(f, G1, F3) < 0.2), lage.funken);
    const enden = [lage.funken[0], lage.funken.at(-1)];
    pruefe(`${gruppe} funkenspur: die Spur reicht von g1 bis f3`, abstand(enden[0], G1) < 0.4 && abstand(enden[1], F3) < 0.4, enden);
  } else if (id === 'lichtsaeule') {
    pruefe(`${gruppe} lichtsaeule: Fusspunkt auf dem Koenigsfeld e1`, lage.fuss && abstand(lage.fuss, E1) < 0.25, lage.fuss);
  } else if (VORRAT.stuecke.find((v) => v.id === id).anlass === 'zug') {
    pruefe(`${gruppe} ${id}: Mitte auf dem Zielfeld f3`, abstand(lage.mitte, F3) < 0.1, lage.mitte);
  } else {
    pruefe(`${gruppe} ${id}: ueber das ganze Brett`, Math.abs(lage.breite - 8) < 0.1 && abstand(lage.mitte, [4, 4]) < 0.1, lage);
  }
  const ebene = await s.evaluate(() => getComputedStyle(document.querySelector('.sheet-karte .shf-effekt-ebene')).pointerEvents);
  pruefe(`${gruppe} ${id}: der Effekt faengt keine Tipps ab`, ebene === 'none', ebene);
  await warte(350);
  pruefe(`${gruppe} ${id}: kein Sprung waehrend des Ablaufs`, await masse(s) === vorher, vorher);
  const fertig = await s.waitForSelector('.sheet-karte .shf-effekt-ebene', { state: 'detached', timeout: 9000 }).then(() => true).catch(() => false);
  pruefe(`${gruppe} ${id}: endet von selbst`, fertig);
  pruefe(`${gruppe} ${id}: kein Sprung nach dem Ende`, await masse(s) === vorher, vorher);
  await schliesse(s);
}

const browser = await browserTyp(pw).launch({ headless: true });
try {
  for (const [w, h, farbe, stuecke] of [[390, 844, 'hell', EFFEKTE], [390, 844, 'dunkel', ['funkenspur', 'lichtsaeule']],
    [1440, 900, 'hell', ['funkenspur', 'kronenregen']], [1440, 900, 'dunkel', ['lichtsaeule', 'wellenring']]]) {
    const gruppe = `${w} ${farbe}`;
    const { k, s, z } = await oeffneShop(browser, { w, h, farbe });
    try {
      await s.waitForSelector('.sa-blatt .shf-regal[data-art="effekt"]', { timeout: 10000 });
      const regal = await s.evaluate(() => {
        const r = document.querySelector('.sa-blatt .shf-regal[data-art="effekt"]');
        const karten = [...r.querySelectorAll('.shf-rk')];
        return { titel: r.querySelector('.shf-regal-titel')?.textContent.trim(), ids: karten.map((x) => x.dataset.id),
          preise: karten.map((x) => x.querySelector('.shf-preis').textContent.trim()), schloss: karten.every((x) => !!x.querySelector('.shf-preis svg.shf-schloss')),
          standbild: karten.every((x) => { const v = x.querySelector('.shf-bild svg'); return v && v.animationsPaused && v.animationsPaused(); }),
          euro: /€|EUR|kaufen/i.test(r.textContent), ueber: document.documentElement.scrollWidth > innerWidth };
      });
      pruefe(`${gruppe}: Regal "Effekte" mit 9 Karten`, regal.titel === 'Effekte' && JSON.stringify(regal.ids) === JSON.stringify(EFFEKTE), regal);
      pruefe(`${gruppe}: jede Karte gesperrt mit Schloss und "Bald", kein Preis`, regal.preise.every((x) => x === 'Bald') && regal.schloss && !regal.euro, regal);
      pruefe(`${gruppe}: Kartenbilder stehen still`, regal.standbild, regal);
      pruefe(`${gruppe}: kein Ueberlauf der Seite`, !regal.ueber);
      const vor = z.aufrufe.length;
      for (const id of stuecke) await pruefeEffekt(s, id, gruppe);
      pruefe(`${gruppe}: die Vorschau ruft nichts beim Server auf`, z.aufrufe.length === vor, z.aufrufe.slice(vor));
      await tippe(s, 'konfetti');
      const knoepfe = await s.locator('.sheet-karte.shf-sheet .sheet-knoepfe button').allTextContents();
      pruefe(`${gruppe}: im Blatt nur "Schließen", kein Kaufknopf`, JSON.stringify(knoepfe.map((x) => x.trim())) === '["Schließen"]', knoepfe);
      await schliesse(s);
      pruefe(`${gruppe}: Schliessen waehrend des Ablaufs raeumt auf`, await s.locator('.shf-effekt-ebene').count() === 0);
    } catch (e) {
      pruefe(`${gruppe}: Ablauf ohne Abbruch`, false, String(e.message).slice(0, 200));
    } finally { await k.close().catch(() => {}); }
  }
  // Weniger Bewegung: ruhiges Standbild, kein gezeigter Zug, nichts laeuft ab
  for (const [id, feld] of [['funkenspur', null], ['lichtsaeule', E1]]) {
    const { k, s } = await oeffneShop(browser, { w: 390, h: 844, farbe: 'hell', reduziert: true });
    try {
      await s.waitForSelector(KARTE(id), { state: 'attached', timeout: 10000 });
      await tippe(s, id);
      await s.waitForSelector('.sheet-karte .shf-effekt-ebene[data-zustand="still"]', { timeout: 10000 });
      const zeit = () => s.evaluate(() => { const v = document.querySelector('.sheet-karte .shf-effekt-ebene svg'); return { an: v.animationsPaused(), t: v.getCurrentTime() }; });
      const a = await zeit();
      await warte(4500);
      const b = await zeit();
      pruefe(`weniger Bewegung ${id}: Standbild steht still`, a.an && b.an && a.t === b.t, { a, b });
      pruefe(`weniger Bewegung ${id}: bleibt stehen, solange das Blatt offen ist`, await s.locator('.sheet-karte .shf-effekt-ebene').count() === 1);
      if (feld) { const lage = await messeLage(s); pruefe(`weniger Bewegung ${id}: Fusspunkt auf e1`, lage.fuss && abstand(lage.fuss, feld) < 0.25, lage.fuss); }
      await schliesse(s);
    } catch (e) {
      pruefe(`weniger Bewegung ${id}: Ablauf ohne Abbruch`, false, String(e.message).slice(0, 200));
    } finally { await k.close().catch(() => {}); }
  }
} finally {
  await browser.close().catch(() => {});
  server.close();
}
pruefe('keine Seitenfehler', seitenfehler.length === 0, seitenfehler);
console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
