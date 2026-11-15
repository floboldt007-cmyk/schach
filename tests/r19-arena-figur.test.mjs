// Feinschliff R19 (Flo 15.11.2026 12:44, live #arena PC dunkel, Welt 1 komplett, Janine besiegt): Flos eigene Figur hing
// halb hinter Janines Bild. Ziel: Die Figur steht bei jeder Stufe sichtbar und frei neben ihrer Station, auch bei fertiger
// Welt, nie hinter oder auf einem Bot, seinem Namensschild, seiner Nummer oder seinem Schild darueber.
// Browser (Playwright), iPhone 13, iPad quer, PC 1280; dunkel, ruhige Bewegung:
//   je Stufe n (alle Bots unter n besiegt): die Welt des naechsten Gegners, wie die Arena sie oeffnet
//   je fertiger Welt w (Endgegner besiegt): Welt w ueber den Pfeil zurueck (Flos Fall), dazu "alle 30 besiegt"
// Je Fall: .flo-figur sichtbar (kein display:none, kein .verdeckt), ganz in der Welt, Kreis der Figur ueberlappt keinen
// Stationskreis (.avatar) und kein Schild (.k-schild, .k-nr, .boss-krone, .fahne, .k-sterne) um mehr als 1 px.
import http from 'node:http';
import { createRequire } from 'node:module';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';
import { browserTyp } from './browser.mjs';
import { BOTS } from '../js/bots.js';

const require = createRequire(import.meta.url);
let pw;
for (const p of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
  try { pw = require(p); break; } catch (e) { /* naechster */ }
}
if (!pw) throw new Error('Playwright fehlt');
const BILDER = process.env.BILDER || path.join(os.tmpdir(), 'r19-arena-figur');
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
await mkdir(BILDER, { recursive: true });

let ok = 0, gesamt = 0;
const fehlerListe = [];
function pruefe(name, bed, info) {
  gesamt++;
  if (bed) { ok++; console.log('ok   ' + name); }
  else { const z = 'FEHLER ' + name + (info !== undefined ? ' ' + JSON.stringify(info).slice(0, 600) : ''); console.log(z); fehlerListe.push(z); }
}
const warte = (ms) => new Promise(r => setTimeout(r, ms));

const { defaultBrowserType: _a, ...IPHONE13 } = pw.devices['iPhone 13'];
const GERAETE = [
  { name: 'iphone13', optionen: IPHONE13 },
  { name: 'ipad-quer', optionen: { viewport: { width: 1180, height: 820 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } },
  { name: 'pc1280', optionen: { viewport: { width: 1280, height: 800 } } },
];
const SIEG = { sterne: [true, false, false], partien: 1, siege: 1, remis: 0, niederlagen: 0, besteGenauigkeit: 80 };
const saatBis = (stufe) => ({ bots: Object.fromEntries(BOTS.filter((b) => b.stufe <= stufe).map((b) => [b.id, SIEG])), brillanteZuege: [] });
const MAX = Math.max(...BOTS.map((b) => b.stufe));
const ENDGEGNER = BOTS.filter((b) => b.endgegner).sort((a, b) => a.stufe - b.stufe);
// Faelle: [name, Saat (hoechste besiegte Stufe), Welt ueber den Pfeil zurueck oder null]
const FAELLE = [];
for (let n = 1; n <= MAX; n++) FAELLE.push([`stufe${n}`, n - 1, null]);
for (const e of ENDGEGNER) if (e.stufe < MAX) FAELLE.push([`welt${e.welt}-fertig`, e.stufe, e.welt]);
FAELLE.push(['alle-besiegt', MAX, null]);

// Messung in der Seite: Kreis der Figur gegen Kreise der Stationen und Rechtecke ihrer Schilder
const messe = (s) => s.evaluate(() => {
  const sc = document.querySelector('.screen.arena');
  const fig = sc.querySelector('.flo-figur');
  const welt = sc.querySelector('.welt');
  const cs = getComputedStyle(fig);
  const f = fig.getBoundingClientRect();
  const w = welt.getBoundingClientRect();
  const kreis = (r) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2, r: Math.min(r.width, r.height) / 2 });
  const F = kreis(f);
  const treffer = [];
  for (const k of sc.querySelectorAll('.welt .knoten[data-bot]')) {
    const a = k.querySelector('.avatar');
    if (a) {
      const A = kreis(a.getBoundingClientRect());
      const tief = F.r + A.r - Math.hypot(F.x - A.x, F.y - A.y);
      if (tief > 1) treffer.push({ bot: k.dataset.bot, teil: 'bild', px: Math.round(tief) });
    }
    for (const t of k.querySelectorAll('.k-schild, .k-nr, .boss-krone, .fahne, .k-sterne')) {
      const r = t.getBoundingClientRect();
      if (!r.width || !r.height || getComputedStyle(t).visibility === 'hidden' || getComputedStyle(t).display === 'none') continue;
      const nx = Math.max(r.left, Math.min(F.x, r.right)), ny = Math.max(r.top, Math.min(F.y, r.bottom));
      const tief = F.r - Math.hypot(F.x - nx, F.y - ny);
      if (tief > 1) treffer.push({ bot: k.dataset.bot, teil: t.className.split(' ')[0], px: Math.round(tief) });
    }
  }
  return {
    sichtbar: cs.display !== 'none' && cs.visibility !== 'hidden' && !fig.classList.contains('verdeckt') && f.width > 0 && Number(cs.opacity) > 0.5,
    drin: f.left >= w.left - 1 && f.right <= w.right + 1 && f.top >= w.top - 1 && f.bottom <= w.bottom + 1,
    figur: { x: Math.round(F.x - w.left), y: Math.round(F.y - w.top), r: Math.round(F.r) },
    treffer,
  };
});

const browser = await browserTyp(pw).launch();
try {
  for (const g of GERAETE) {
    for (const [fall, bis, zurueck] of FAELLE) {
      const k = await browser.newContext({ ...g.optionen, locale: 'de-DE', colorScheme: 'dark', reducedMotion: 'reduce', serviceWorkers: 'block' });
      await k.route('**/*.supabase.co/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
      await k.addInitScript(([saat]) => {
        try {
          if (sessionStorage.getItem('probe-start')) return;
          sessionStorage.setItem('probe-start', '1');
          localStorage.clear();
          const d = new Date(); if (d.getHours() < 4) d.setDate(d.getDate() - 1);
          const z = n => String(n).padStart(2, '0');
          localStorage.setItem('schach-arena:v1:modul:start', JSON.stringify({ v: 1, gesehen: `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}` }));
          localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ sprache: 'de', spracheGewaehlt: true, klang: false, modus: 'dunkel' }));
          localStorage.setItem('schach-arena:v1:hinweis-installieren', '1');
          localStorage.setItem('schach-arena:v1:fortschritt', JSON.stringify(saat));
        } catch (e) { /* egal */ }
      }, [saatBis(bis)]);
      const s = await k.newPage(); s.setDefaultTimeout(15000);
      await s.goto(`http://127.0.0.1:${server.address().port}/index.html?test#arena`);
      await s.waitForSelector('.screen.arena .knoten[data-bot]', { state: 'visible', timeout: 20000 });
      await s.evaluate(() => document.fonts.ready);
      await warte(700);
      if (zurueck) {
        const ziel = BOTS.find((b) => b.welt === zurueck && b.endgegner).id;
        for (let i = 0; i < 6 && !(await s.locator(`.screen.arena .knoten[data-bot="${ziel}"]`).count()); i++) {
          await s.locator('.screen.arena .ww-pfeil[data-richtung="-1"]').click();
          await warte(450);
        }
        await s.waitForSelector(`.screen.arena .knoten[data-bot="${ziel}"]`);
        await warte(600);
      }
      // die Figur in den sichtbaren Bereich (Handy: die Karte scrollt)
      await s.evaluate(() => { const f = document.querySelector('.screen.arena .flo-figur'); if (f) f.scrollIntoView({ block: 'center' }); });
      await warte(300);
      const m = await messe(s);
      pruefe(`${g.name} ${fall}: Figur sichtbar, ganz in der Welt, frei von Bot, Nummer und Schildern`,
        m.sichtbar && m.drin && m.treffer.length === 0, { sichtbar: m.sichtbar, drin: m.drin, figur: m.figur, treffer: m.treffer });
      if (/^stufe(1|2|6|7|12|13)$|fertig|alle/.test(fall)) {
        const fig = await s.$('.screen.arena .flo-figur');
        const box = fig && await fig.boundingBox();
        if (box) await s.screenshot({ path: path.join(BILDER, `${g.name}-${fall}.png`),
          clip: { x: Math.max(0, box.x - 140), y: Math.max(0, box.y - 140), width: Math.min(320, (g.optionen.viewport || IPHONE13.viewport).width), height: 300 } });
        else await s.screenshot({ path: path.join(BILDER, `${g.name}-${fall}.png`) });
      }
      await k.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}
console.log(`\n${ok}/${gesamt} bestanden`);
if (fehlerListe.length) console.log(`${fehlerListe.length} Pruefung(en) nicht bestanden`);
process.exit(fehlerListe.length ? 1 : 0);
