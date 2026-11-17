// Kontrast der Seltenheits-Marke im Shop A (Feinschliff R19, Auftrag Hauptfenster 18.11.2026): die kleine Marke "Exklusiv"
// (.shf-selten, 12 px, css/pakete/sammlung.css) hatte auf ihrer Karte nur 4,16:1. Text braucht mindestens 4,5:1 (WCAG 1.4.3).
//   Jede Marke (Haeufig, Selten, Episch, Exklusiv) auf jeder Karte des Schaufensters, auch die ausgegraute Gast-Karte:
//   Schriftfarbe gegen den deckend zusammengesetzten Grund darunter, in Ruhe, mit dem Zeiger auf der Karte und mit dem
//   Tastatur-Fokus auf der Karte; iPhone SE, iPhone 13 und PC, hell und dunkel. Die Marke bleibt golden (Farbton um 40 Grad).
//   Keine Seitenfehler. Netz nur simuliert.
//
//   node tests/r19-exklusiv-kontrast.test.mjs
import http from 'node:http';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

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

const UID = 'u1';
const SITZUNG = { access_token: 'a.' + Buffer.from(JSON.stringify({ sub: UID })).toString('base64url') + '.x', refresh_token: 'test-r',
  expires_at: 9999999999, user: { id: UID, email: 'spieler@example.invalid' } };
const EDITION = { produkt_id: 'brett-mitternacht', name: 'Mitternacht & Gold', auflage: 10, status: 'erhaeltlich', restzahl: 9,
  verkauf_ab: '2026-11-28T10:00:00Z', betrag_cent: 499, waehrung: 'eur' };
function bediener() {
  return async (route) => {
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
}
function initSkript({ sitzung }) {
  try {
    if (!sessionStorage.getItem('shop-start')) {
      sessionStorage.setItem('shop-start', '1');
      localStorage.clear();
      localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ klang: false, bewegung: 'normal', figuren: 'cburnett' }));
      localStorage.setItem('schach-arena:konto:sichtbar', '1');
      if (sitzung) localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(sitzung));
    }
  } catch (e) { /* egal */ }
}

async function oeffneShop(s) {
  await s.goto(`http://127.0.0.1:${PORT}/index.html?test#heim`);
  await s.waitForFunction(() => window.__app && typeof window.__app.gehe === 'function' && document.querySelector('.screen.heim-screen'), null, { timeout: 45000 });
  await s.evaluate(() => window.__app.gehe('ich'));
  await s.waitForSelector('.sa-screen', { timeout: 30000 });
  await warte(400);
  for (let i = 0; i < 12 && await s.locator('.st-moment .st-weiter').count(); i++) { await s.locator('.st-moment .st-weiter').first().click(); await warte(250); }
  await s.locator('.sa-platz[data-bereich="shop"], .sa-gross[data-bereich="shop"]').first().click();
  await s.waitForSelector('.sa-blatt .shf .shf-karte .shf-selten', { timeout: 15000 });
  await warte(500);
}

// Kontrast jeder Marke: Schriftfarbe und Grund werden per Canvas in sRGB-Bytes umgerechnet (color-mix ergibt color(srgb ...)),
// der Grund ist die Kette der Hintergruende vom Element bis zur Wurzel, von hinten deckend zusammengesetzt. Ein Verlauf oder
// Bild in der Kette laesst die Messung als unbekannt enden (zaehlt als Fehler).
const messe = (s) => s.evaluate(() => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 1;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  const rgba = (farbe) => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = farbe; cx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = cx.getImageData(0, 0, 1, 1).data; return [r, g, b, a / 255]; };
  const ueber = (o, u) => [0, 1, 2].map((i) => o[i] * o[3] + u[i] * (1 - o[3])).concat(1);
  const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const ton = ([r, g, b]) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (!d) return null;
    const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return Math.round((h * 60 + 360) % 360); };
  return [...document.querySelectorAll('.sa-blatt .shf-karte')].map((k) => {
    const m = k.querySelector('.shf-selten'); if (!m) return null;
    const schichten = []; let unbekannt = '';
    for (let e = m; e; e = e.parentElement) {
      const st = getComputedStyle(e);
      if (st.backgroundImage !== 'none') { unbekannt = `Bild/Verlauf an ${e.className || e.tagName}`; break; }
      if (Number(st.opacity) < 1) { unbekannt = `Deckkraft an ${e.className || e.tagName}`; break; }
      schichten.push(rgba(st.backgroundColor));
    }
    let grund = [255, 255, 255, 1];
    for (const sch of schichten.reverse()) grund = ueber(sch, grund);
    const schrift = ueber(rgba(getComputedStyle(m).color), grund);
    const [l1, l2] = [lum(schrift), lum(grund)].sort((a, b) => b - a);
    return { selten: k.dataset.seltenheit, art: k.dataset.art, gast: k.hasAttribute('data-gast'), text: m.textContent.trim(),
      kontrast: Math.round(((l1 + 0.05) / (l2 + 0.05)) * 100) / 100, ton: ton(schrift), schrift: schrift.slice(0, 3).map(Math.round),
      grund: grund.slice(0, 3).map(Math.round), unbekannt };
  }).filter(Boolean);
});

const GERAETE = [['iPhone SE', 375, 667], ['iPhone 13', 390, 844], ['PC', 1280, 720]];
const seitenfehler = [];
const browser = await pw.chromium.launch({ headless: true });
try {
  for (const [geraet, w, h] of GERAETE) {
    for (const farbe of ['hell', 'dunkel']) {
      const gruppe = `${geraet} ${farbe}`;
      const k = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: geraet !== 'PC', serviceWorkers: 'block',
        colorScheme: farbe === 'dunkel' ? 'dark' : 'light', locale: 'de-DE', timezoneId: 'Europe/Berlin' });
      await k.route('**/*.supabase.co/**', bediener());
      await k.addInitScript(initSkript, { sitzung: SITZUNG });
      const s = await k.newPage(); s.setDefaultTimeout(15000);
      s.on('pageerror', (e) => seitenfehler.push(`${gruppe}: ${e.message}`));
      try {
        await oeffneShop(s);
        const ruhe = await messe(s);
        pruefe(`${gruppe}: Marke Exklusiv vorhanden`, ruhe.some((x) => x.selten === 'exklusiv'), ruhe.map((x) => x.selten));
        for (const zustand of ['Ruhe', 'Zeiger', 'Fokus']) {
          const karten = s.locator('.sa-blatt .shf-karte');
          const n = await karten.count();
          for (let i = 0; i < n; i++) {
            const karte = karten.nth(i);
            await karte.scrollIntoViewIfNeeded();
            if (zustand === 'Zeiger' && geraet === 'PC') { await karte.hover(); await warte(250); }
            if (zustand === 'Zeiger' && geraet !== 'PC') continue; // Touch: kein haengender Zeiger
            if (zustand === 'Fokus') { await karte.focus(); await s.keyboard.press('Shift'); await warte(150); }
            const x = (await messe(s))[i]; if (!x) continue;
            pruefe(`${gruppe} ${zustand}: Marke "${x.text}" (${x.selten}, ${x.art}${x.gast ? ', Gast' : ''}) mind. 4,5:1`,
              !x.unbekannt && x.kontrast >= 4.5, x);
            if (x.selten === 'exklusiv' && !x.gast) {
              if (zustand === 'Ruhe') console.log(`     Messwert ${gruppe}: Exklusiv ${x.kontrast}:1, Farbton ${x.ton} Grad, Schrift rgb(${x.schrift})`);
              pruefe(`${gruppe} ${zustand}: Marke Exklusiv bleibt golden (Farbton 30 bis 50 Grad)`, x.ton !== null && x.ton >= 30 && x.ton <= 50, x);
            }
          }
          if (zustand !== 'Ruhe') { await s.mouse.move(0, 0); await s.evaluate(() => document.activeElement?.blur()); }
        }
      } finally { await k.close(); }
    }
  }
  pruefe('keine Seitenfehler', !seitenfehler.length, seitenfehler);
} finally {
  await browser.close();
  server.close();
}
console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
