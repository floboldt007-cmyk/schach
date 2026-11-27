// T-031 Shop-Tempo (27.11.2026): das Shop-Blatt antwortet am PC in unter 100 ms auf den Klick.
// Ursache (Trace PC, 27.11.): im Klick lief ein erzwungenes Layout von rund 100 ms fuer nur 490 Layout-Objekte. Jedes Kartenbild
// (.shf-bild, aspect-ratio 1) war im Grid der Karte gestreckt, und Chrome legte es in den verschachtelten Grids (Regal, Karte,
// Bild) ein zweites Mal aus. Mit align-self: start (css/pakete/sammlung.css) sieht es gleich aus, die Zeile ist "auto".
// Geprueft:
//   1. jedes Kartenbild im offenen Shop-Blatt steht auf align-self: start (gleichbleibend, unabhaengig von der Rechnerlast)
//   2. Klick bis zum naechsten Bild (Event Timing, wie INP) am PC, Median aus 5 Oeffnungen, unter 100 ms (vorher rund 200 ms);
//      in der CI (Umgebung CI gesetzt) nur als Messwert ausgegeben, weil fremde Last auf dem Runner die Wanduhr verschiebt
//   3. das erste Layout des Shop-Inhalts im Blatt, Median aus 5, unter 30 ms (vorher 55 bis 100 ms, nachher rund 7 ms)
//   node tests/shop-tempo.test.mjs   (PC 1280 x 800, Chromium ungedrosselt, Netz nur simuliert)
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

const GRENZE_MS = 100;
const LAYOUT_GRENZE_MS = 30;
const RUNDEN = 5;
const median = (w) => { const a = [...w].sort((x, y) => x - y); return a[Math.floor(a.length / 2)]; };

let ok = 0, gesamt = 0;
function pruefe(name, gut, detail = '') {
  gesamt++; if (gut) ok++;
  // INTENTIONAL-SLOP[T4]: die Pruefzeile ist die Ausgabe des Tests (wie in tests/r27-blatt-tempo.test.mjs)
  console.log(`${gut ? 'ok  ' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(detail).slice(0, 400)}`);
}

function initSkript() {
  try {
    if (sessionStorage.getItem('shop-tempo')) return;
    sessionStorage.setItem('shop-tempo', '1');
    localStorage.clear();
    const d = new Date(); if (d.getHours() < 4) d.setDate(d.getDate() - 1);
    const z = (n) => String(n).padStart(2, '0');
    localStorage.setItem('schach-arena:v1:modul:start', JSON.stringify({ v: 1, gesehen: `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}` }));
    localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ sprache: 'de', spracheGewaehlt: true, klang: false, modus: 'hell', arenaKarteHinweis: true }));
    localStorage.setItem('schach-arena:v1:hinweis-installieren', '1');
  } catch (e) { /* egal */ }
}

const SHOP = '.sa-platz[data-bereich="shop"], .sa-gross[data-bereich="shop"]';
const browser = await pw.chromium.launch();
const seitenfehler = [];
try {
  const k = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block', colorScheme: 'light', locale: 'de-DE', timezoneId: 'Europe/Berlin' });
  await k.route('**/*.supabase.co/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await k.addInitScript(initSkript);
  const s = await k.newPage();
  s.on('pageerror', (e) => seitenfehler.push(e.message));
  try {
    await s.goto(`http://127.0.0.1:${PORT}/index.html?test#ich`);
    await s.waitForSelector('.sa-bereich[data-bereich="shop"] .shf', { state: 'attached', timeout: 20000 });
    for (let i = 0; i < 12 && await s.locator('.st-moment .st-weiter').count(); i++) { await s.locator('.st-moment .st-weiter').first().click(); await s.waitForTimeout(250); }
    await s.waitForTimeout(1000);
    await s.evaluate(() => {
      window.__klicks = [];
      new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.name === 'click') window.__klicks.push(e.duration); })
        .observe({ type: 'event', durationThreshold: 16, buffered: false });
    });

    // 1 und 2: echte Klicks, je Runde oeffnen, ruhig werden lassen, mit Escape schliessen
    const klickMs = []; let bilder = null;
    for (let i = 0; i < RUNDEN; i++) {
      const knopf = s.locator(SHOP).first();
      await knopf.scrollIntoViewIfNeeded();
      const vorher = await s.evaluate(() => window.__klicks.length);
      await knopf.click();
      await s.waitForSelector('.sheet-karte.sa-blatt .shf');
      await s.waitForTimeout(700);
      // Event Timing meldet einen Klick erst ab 16 ms; ein schnellerer Klick fehlt in der Liste und zaehlt mit 16 ms
      klickMs.push(await s.evaluate((n) => (window.__klicks.length > n ? window.__klicks[n] : 16), vorher));
      if (!bilder) bilder = await s.evaluate(() => [...document.querySelectorAll('.sheet-karte.sa-blatt .shf-bild')].map((b) => getComputedStyle(b).alignSelf));
      await s.keyboard.press('Escape');
      await s.waitForSelector('.sheet-karte.sa-blatt', { state: 'detached' });
      await s.waitForTimeout(500);
    }
    pruefe(`jedes Kartenbild im Shop-Blatt steht auf align-self: start (${bilder ? bilder.length : 0} Bilder)`,
      bilder && bilder.length >= 10 && bilder.every((a) => a === 'start'), bilder);
    const klickName = `PC: Klick bis zum naechsten Bild unter ${GRENZE_MS} ms (Median ${median(klickMs).toFixed(0)} ms aus ${klickMs.map((m) => m.toFixed(0)).join(' ')})`;
    // In der CI (geteilte Runner, --parallel=3) haengt eine Wanduhr-Zeit an fremder Last: dort nur Messwert, sonst kaeme ein Wackel-Rot.
    // Lastfest pruefen dort Punkt 1 (Stilwert) und Punkt 3 (Layout-Kosten, Abstand rund 3x zur Grenze).
    if (process.env.CI) console.log(`info ${klickName} (Messwert, in der CI keine Pruefung)`);
    else pruefe(klickName, median(klickMs) < GRENZE_MS, klickMs);

    // 3: erstes Layout des Shop-Inhalts in einem Blatt, ohne Klick und ohne Animation gemessen
    const layoutMs = [];
    for (let i = 0; i < RUNDEN; i++) layoutMs.push(await s.evaluate(() => {
      const x = document.querySelector('.sa-bereich[data-bereich="shop"]');
      const heim = x.parentNode;
      const ort = document.createElement('div');
      ort.className = 'sheet-ort';
      ort.innerHTML = '<div class="sheet-schleier"></div><div class="sheet-karte sa-blatt"><h3>Shop</h3><div class="sa-blatt-inhalt"></div><div class="sheet-knoepfe"></div></div>';
      document.body.append(ort);
      void document.body.offsetHeight;
      x.hidden = false;
      ort.querySelector('.sa-blatt-inhalt').append(x);
      const t = performance.now();
      void document.body.offsetHeight;
      const d = performance.now() - t;
      x.hidden = true; heim.append(x); ort.remove();
      void document.body.offsetHeight;
      return d;
    }));
    pruefe(`PC: erstes Layout des Shop-Inhalts im Blatt unter ${LAYOUT_GRENZE_MS} ms (Median ${median(layoutMs).toFixed(1)} ms aus ${layoutMs.map((m) => m.toFixed(0)).join(' ')})`,
      median(layoutMs) < LAYOUT_GRENZE_MS, layoutMs);
  } finally { await k.close(); }
  pruefe('keine Seitenfehler', !seitenfehler.length, seitenfehler);
} finally {
  await browser.close();
  server.close();
}
console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
