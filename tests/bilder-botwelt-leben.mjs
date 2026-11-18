// Bilder "Bot-Welt lebendig" (R19, Flo 14.11. und 15.11.2026) fuer Flos Auswahl und den Kaltreview:
//   vorher  = Arena-Dateien der Basis (Stand fa24a72, Handy noch "kompakt", Weltname grau)
//   A       = Empfehlung (Arbeitsstand): Handy B, Plakette dunkel mit Gold-Kante und Wappen, je Welt ein eigenes
//             lebendiges Element (Karofelder Lichtschimmer, Springerforst Gluehwuermchen, Turmstadt Wolke,
//             Gezeitenkueste Wasserglanz, Stockfisch-Tiefe Blasen)
//   B       = Alternative (nur hier als Stil eingespielt, nicht in der App): helle Pergament-Plakette mit Wappen oben,
//             in allen Welten dasselbe Element (ein langsamer Lichtstreif)
// Je Geraet (iPhone 13, iPhone SE, iPad hoch, iPad quer, PC 1280) und Modus (hell, dunkel) Welt 2; auf dem iPhone 13
// dazu alle fuenf Welten in A. Bewegung an, damit das lebendige Element im Bild steht (Standbild bei weniger Bewegung
// prueft tests/r19-botwelt-leben.test.mjs).
//
//   node tests/bilder-botwelt-leben.mjs
//   BILDER=<ordner> node tests/bilder-botwelt-leben.mjs   (Standard: <tmp>/bilder-botwelt-leben)
import http from 'node:http';
import { createRequire } from 'node:module';
import { readFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';
import { BOTS, botsDerWelt, WELTEN } from '../js/bots.js';

const require = createRequire(import.meta.url);
let pw;
for (const p of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
  try { pw = require(p); break; } catch (e) { /* naechster */ }
}
if (!pw) throw new Error('Playwright fehlt');
const BILDER = process.env.BILDER || path.join(os.tmpdir(), 'bilder-botwelt-leben');
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
await new Promise(r => server.listen(0, '127.0.0.1', r));

const BASIS_REF = 'fa24a72';
const BASIS_DATEIEN = ['css/arena.css', 'js/ui/arena.js', 'js/sprachen/arena.js'];
const basis = Object.fromEntries(BASIS_DATEIEN.map((d) => [d, execFileSync('git', ['show', `${BASIS_REF}:${d}`], { cwd: WURZEL, encoding: 'utf8' })]));

// Variante B: nur fuer diese Bilder, als Stil ueber den Arbeitsstand gelegt
const STIL_B = `
.arena .ww-mitte { grid-template-columns: none !important; justify-items: center; padding: 20px 18px 6px !important; margin-top: 18px;
  background: #FBF4E2 !important; border: 1.5px solid #C9962E !important; box-shadow: 0 0 0 3px #FBF4E2, 0 0 0 4.5px #C9962E, var(--s2) !important;
  border-radius: 14px !important; }
.arena .ww-mitte .ww-name { color: #3A2A10 !important; }
.arena .ww-mitte .ww-unter { color: #6B5320 !important; }
.arena .ww-wappen { position: absolute !important; top: -24px; left: 50%; margin-left: -15px; width: 30px !important; height: 34px !important; grid-row: auto !important; }
.arena .ww-mitte { position: relative; }
.arena .welt .welt-leben::before { content: '' !important; inset: -20% -60% !important; width: auto !important; height: auto !important;
  background: linear-gradient(105deg, transparent 42%, rgba(255, 246, 214, .42) 50%, transparent 58%) !important;
  border-radius: 0 !important; box-shadow: none !important; animation: bl-b-streif 12s ease-in-out infinite !important; }
@keyframes bl-b-streif { from { transform: translateX(-30%); opacity: .2; } 50% { opacity: .9; } to { transform: translateX(30%); opacity: .2; } }
`;

const { defaultBrowserType: _a, ...IPHONE13 } = pw.devices['iPhone 13'];
const GERAETE = [
  { name: 'iphone13', optionen: IPHONE13 },
  { name: 'iphonese', optionen: { ...IPHONE13, viewport: { width: 375, height: 667 }, screen: { width: 375, height: 667 } } },
  { name: 'ipad-hoch', optionen: { viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } },
  { name: 'ipad-quer', optionen: { viewport: { width: 1180, height: 820 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } },
  { name: 'pc1280', optionen: { viewport: { width: 1280, height: 800 } } },
];
const MODI = [{ name: 'hell', schema: 'light' }, { name: 'dunkel', schema: 'dark' }];
const SIEG = { sterne: [true, false, false], partien: 1, siege: 1, remis: 0, niederlagen: 0, besteGenauigkeit: 80 };
const SAAT = { bots: Object.fromEntries(BOTS.filter((b) => b.welt === 1 || ['bodo', 'kalle'].includes(b.id)).map((b) => [b.id, SIEG])), brillanteZuege: [] };
const warte = ms => new Promise(r => setTimeout(r, ms));

let bilder = 0;
const fehlerAlle = [];
async function aufnahme(browser, g, m, variante, welten) {
  const k = await browser.newContext({ ...g.optionen, locale: 'de-DE', colorScheme: m.schema, reducedMotion: 'no-preference', serviceWorkers: 'block' });
  await k.route('**/*.supabase.co/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  if (variante === 'vorher') for (const d of BASIS_DATEIEN) {
    await k.route(u => new URL(u).pathname.endsWith('/' + d), r => r.fulfill({ status: 200, contentType: TYPEN[path.extname(d)], body: basis[d] }));
  }
  await k.addInitScript(([modus, saat]) => {
    try {
      if (sessionStorage.getItem('probe-start')) return;
      sessionStorage.setItem('probe-start', '1');
      localStorage.clear();
      const d = new Date(); if (d.getHours() < 4) d.setDate(d.getDate() - 1);
      const z = n => String(n).padStart(2, '0');
      localStorage.setItem('schach-arena:v1:modul:start', JSON.stringify({ v: 1, gesehen: `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}` }));
      localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ sprache: 'de', spracheGewaehlt: true, klang: false, modus, arenaKarteHinweis: true }));
      localStorage.setItem('schach-arena:v1:hinweis-installieren', '1');
      localStorage.setItem('schach-arena:v1:fortschritt', JSON.stringify(saat));
    } catch (e) { /* egal */ }
  }, [m.name, SAAT]);
  const s = await k.newPage(); s.setDefaultTimeout(15000);
  const fehler = [];
  s.on('pageerror', e => fehler.push(e.message));
  s.on('console', x => { if (x.type() === 'error') fehler.push(x.text()); });
  try {
    await s.goto(`http://127.0.0.1:${server.address().port}/index.html?test#arena`);
    await s.waitForSelector('.screen.arena .knoten[data-bot]', { state: 'visible', timeout: 20000 });
    if (variante === 'B') await s.addStyleTag({ content: STIL_B });
    await s.evaluate(() => document.fonts.ready);
    await warte(900);
    for (const nr of welten) {
      const ziel = botsDerWelt(nr)[0].id;
      for (let i = 0; i < WELTEN.length + 1 && !(await s.locator(`.screen.arena .knoten[data-bot="${ziel}"]`).count()); i++) {
        const id = await s.evaluate(() => document.querySelector('.screen.arena .welt')?.dataset.welt);
        const jetzt = WELTEN.find((w) => w.id === id)?.nr ?? 1;
        await s.locator(`.screen.arena .ww-pfeil[data-richtung="${nr > jetzt ? 1 : -1}"]`).click();
        await warte(450);
      }
      await warte(1600);
      const datei = path.join(BILDER, variante, `${g.name}-${m.name}-welt${nr}.png`);
      await mkdir(path.dirname(datei), { recursive: true });
      await s.screenshot({ path: datei });
      bilder++;
    }
  } finally {
    if (fehler.length) fehlerAlle.push({ wo: `${variante} ${g.name} ${m.name}`, fehler });
    await k.close();
  }
}

const browser = await pw.chromium.launch();
try {
  for (const g of GERAETE) for (const m of MODI) for (const v of ['vorher', 'A', 'B']) {
    await aufnahme(browser, g, m, v, v === 'A' && g.name === 'iphone13' ? WELTEN.map((w) => w.nr) : [2]);
  }
} finally {
  await browser.close();
  server.close();
}
console.log(`${bilder} Bilder in ${BILDER}`);
for (const f of fehlerAlle) console.log(`FEHLER ${f.wo}: ${JSON.stringify(f.fehler).slice(0, 400)}`);
console.log(fehlerAlle.length ? 'FEHLER: Seiten- oder Konsolenfehler' : 'OK: keine Seiten- und Konsolenfehler');
process.exit(fehlerAlle.length ? 1 : 0);
