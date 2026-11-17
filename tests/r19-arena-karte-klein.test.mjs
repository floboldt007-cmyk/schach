// Funktionsprobe "Arena-Karte auf kleinen Handys" (R19, Auftrag Hauptfenster 17.11.2026), im Browser wie ein Mensch:
//   Spielen-Knopf: auf dem kleinsten iPhone SE (320 x 568), dem SE 375 x 667 und dem iPhone 13 ist er bei zugeklappter
//     und bei offener Gegner-Karte ganz zu sehen (Mitte und Raender treffen den Knopf, nichts liegt darueber, auch nicht
//     die Reiterleiste), mindestens 44 x 44 px gross und ohne Scrollen erreichbar (Karte und Seite stehen auf 0).
//   Groessenwechsel (Fenster kleiner, Drehen): von 1280 bzw. 1024 direkt auf 375 x 667 wechselt die Arena in die
//     Handy-Lage (.karte-weg.karte-leiste, kein .karte-quer) und die Karte ist nicht 0 px gross; zurueck auf 1280 wieder
//     .karte-quer mit voller Karte. Vorher blieb die Arena in .karte-quer haengen: unter der alten Lage war die Karte
//     bei 375 px 0 px breit, und layout() brach vor dem Lagewechsel ab.
//   Keine Seiten- und Konsolenfehler.
//
//   node tests/r19-arena-karte-klein.test.mjs
import http from 'node:http';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { BOTS } from '../js/bots.js';

const require = createRequire(import.meta.url);
let pw;
for (const p of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
  try { pw = require(p); break; } catch (e) { /* naechster */ }
}
if (!pw) throw new Error('Playwright fehlt');
const WURZEL = fileURLToPath(new URL('../', import.meta.url));
const TYPEN = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm', '.json': 'application/json', '.png': 'image/png', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json' };
const server = http.createServer(async (q, r) => {
  const p = path.resolve(WURZEL, '.' + decodeURIComponent(new URL(q.url, 'http://test').pathname).replace(/\/$/, '/index.html'));
  if (!p.startsWith(WURZEL)) { r.writeHead(403); r.end(); return; }
  try { const d = await readFile(p); r.writeHead(200, { 'Content-Type': TYPEN[path.extname(p)] || 'application/octet-stream' }); r.end(d); }
  catch (e) { r.writeHead(404); r.end(); }
});
await new Promise(r => server.listen(Number(process.env.PORT || 0), '127.0.0.1', r));

const { defaultBrowserType: _a, ...IPHONE13 } = pw.devices['iPhone 13'];
const { defaultBrowserType: _b, ...SE1 } = pw.devices['iPhone SE'];
const HANDYS = [
  { name: 'iphonese-320', optionen: SE1 },
  { name: 'iphonese-375', optionen: { ...IPHONE13, viewport: { width: 375, height: 667 }, screen: { width: 375, height: 667 } } },
  { name: 'iphone13', optionen: IPHONE13 },
];
const SIEG = { sterne: [true, false, false], partien: 1, siege: 1, remis: 0, niederlagen: 0, besteGenauigkeit: 80 };
// Welt 1 und zwei Bots von Welt 2 besiegt: Flos Figur steht mitten in Welt 2, der aktuelle Bot ist der dritte
const SAAT = { bots: Object.fromEntries(BOTS.filter((b) => b.welt === 1 || ['bodo', 'kalle'].includes(b.id)).map((b) => [b.id, SIEG])), brillanteZuege: [] };

let ok = 0, gesamt = 0;
function pruefe(name, gut, detail = '') {
  gesamt++; if (gut) ok++;
  console.log(`${gut ? 'OK' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(detail).slice(0, 700)}`);
  return gut;
}
const warte = ms => new Promise(r => setTimeout(r, ms));

async function oeffne(browser, g, { schema = 'light', modus = 'hell', ruhe = false, sprache = 'de', saat = SAAT } = {}) {
  const k = await browser.newContext({ ...g.optionen, locale: sprache === 'en' ? 'en-US' : 'de-DE', colorScheme: schema,
    reducedMotion: ruhe ? 'reduce' : 'no-preference', serviceWorkers: 'block' });
  await k.route('**/*.supabase.co/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await k.addInitScript(([modus, saat, sprache]) => {
    try {
      if (sessionStorage.getItem('probe-start')) return;
      sessionStorage.setItem('probe-start', '1');
      localStorage.clear();
      const d = new Date(); if (d.getHours() < 4) d.setDate(d.getDate() - 1);
      const z = n => String(n).padStart(2, '0');
      localStorage.setItem('schach-arena:v1:modul:start', JSON.stringify({ v: 1, gesehen: `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}` }));
      localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ sprache, spracheGewaehlt: true, klang: false, modus, arenaKarteHinweis: true }));
      localStorage.setItem('schach-arena:v1:hinweis-installieren', '1');
      if (saat) localStorage.setItem('schach-arena:v1:fortschritt', JSON.stringify(saat));
    } catch (e) { /* egal */ }
  }, [modus, saat, sprache]);
  const s = await k.newPage(); s.setDefaultTimeout(15000);
  const fehler = [];
  s.on('pageerror', e => fehler.push(e.message));
  s.on('console', x => { if (x.type() === 'error') fehler.push(x.text()); });
  await s.goto(`http://127.0.0.1:${server.address().port}/index.html?test#arena`);
  await s.waitForSelector('.screen.arena .knoten[data-bot]', { state: 'visible', timeout: 20000 });
  await s.evaluate(() => document.fonts.ready);
  await warte(900);
  return { k, s, fehler };
}

// Ist der Spielen-Knopf ganz zu sehen? Fuenf Punkte (Mitte, links/rechts auf halber Hoehe um den Radius eingerueckt,
// oben/unten in der Mitte) muessen den Knopf selbst treffen
const spielenSicht = (s) => s.evaluate(() => {
  const a = document.querySelector('.screen.arena'), d = a.querySelector('.detail'), sp = d.querySelector('[data-aktion="spielen"]');
  const r = sp.getBoundingClientRect(), rad = Math.min(parseFloat(getComputedStyle(sp).borderTopLeftRadius) || 0, r.height / 2);
  const mx = r.left + r.width / 2, my = r.top + r.height / 2;
  const punkte = [[mx, my], [r.left + rad + 2, my], [r.right - rad - 2, my], [mx, r.top + 2], [mx, r.bottom - 2]];
  const daneben = punkte.map(([x, y]) => { const e = document.elementFromPoint(x, y); return !e ? 'nichts' : sp.contains(e) ? '' : String(e.className || e.tagName); }).filter(Boolean);
  return { w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top), bottom: Math.round(r.bottom), vh: innerHeight, daneben,
    karteScroll: Math.round(d.scrollTop), seiteScroll: Math.round(document.scrollingElement.scrollTop) };
});
const lage = (s) => s.evaluate(() => {
  const a = document.querySelector('.screen.arena'), k = a.querySelector('.karte');
  return { klassen: [...a.classList].filter((c) => c.startsWith('karte-')).sort().join(' '), kw: k.clientWidth, kh: k.clientHeight,
    stationen: [...a.querySelectorAll('.knoten[data-bot]')].filter((x) => x.getBoundingClientRect().width > 0).length };
});
const sichtbarGut = (x) => x.w >= 44 && x.h >= 44 && x.top >= 0 && x.bottom <= x.vh && !x.daneben.length && x.karteScroll === 0 && x.seiteScroll === 0;

const browser = await pw.chromium.launch({ headless: true });
try {
  for (const g of HANDYS) {
    const { k, s, fehler } = await oeffne(browser, g);
    try {
      pruefe(`${g.name}: Karte zu, Spielen ganz sichtbar, mind. 44 px, ohne Scrollen`, sichtbarGut(await spielenSicht(s)), await spielenSicht(s));
      await s.locator('.screen.arena .detail .karte-griff').click(); await warte(500);
      const auf = await spielenSicht(s);
      pruefe(`${g.name}: Karte offen, Spielen ganz sichtbar (nicht unter der Reiterleiste), mind. 44 px, ohne Scrollen`, sichtbarGut(auf), auf);
      pruefe(`${g.name}: keine Seiten- und Konsolenfehler`, !fehler.length, fehler);
    } finally { await k.close(); }
  }

  for (const start of [{ width: 1280, height: 800 }, { width: 1024, height: 768 }]) {
    const { k, s, fehler } = await oeffne(browser, { name: `pc${start.width}`, optionen: { viewport: start } });
    try {
      const vorher = await lage(s);
      pruefe(`${start.width}: Start quer mit voller Karte`, vorher.klassen === 'karte-quer' && vorher.kw > 0 && vorher.kh > 0, vorher);
      await s.setViewportSize({ width: 375, height: 667 }); await warte(900);
      const klein = await lage(s);
      pruefe(`${start.width} -> 375x667: Handy-Lage (karte-leiste karte-weg), Karte nicht 0 px, Stationen zu sehen`,
        /karte-leiste/.test(klein.klassen) && /karte-weg/.test(klein.klassen) && !/karte-quer/.test(klein.klassen) && klein.kw > 0 && klein.kh > 0 && klein.stationen > 0, klein);
      const sp = await spielenSicht(s);
      pruefe(`${start.width} -> 375x667: Spielen ganz sichtbar`, sichtbarGut(sp), sp);
      await s.setViewportSize(start); await warte(900);
      const zurueck = await lage(s);
      pruefe(`${start.width} -> 375 -> ${start.width}: wieder quer mit voller Karte`, zurueck.klassen === 'karte-quer' && zurueck.kw > 0 && zurueck.kh > 0 && zurueck.stationen > 0, zurueck);
      pruefe(`${start.width} Groessenwechsel: keine Seiten- und Konsolenfehler`, !fehler.length, fehler);
    } finally { await k.close(); }
  }
} finally {
  await browser.close();
  server.close();
}
console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
