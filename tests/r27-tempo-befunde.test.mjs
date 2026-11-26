// R27 Tempo-Fix, Codex-Kaltreview 22.11.2026 (Vault: Schach-App/Feinschliff 2026-11-11/R27-Codex/kaltreview-tempo-fix-2026-11-22.md):
// echte Seite, echter Zeiger und echte Tasten fuer die Befunde, die nur im Browser sichtbar werden.
//   B3. Shop-Vorschau schnell (waehrend das Shop-Blatt noch wegfaehrt) schliessen fuehrt zurueck in den Shop, nicht auf die
//       Uebersicht von "Ich". Mit Escape und "Schliessen", sofort, kurz danach und mit normalem Abstand.
//   node tests/r27-tempo-befunde.test.mjs   (iPhone 13, Netz nur simuliert, Gast ohne Konto)
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
  // INTENTIONAL-SLOP[T4]: die Pruefzeile ist die Ausgabe des Tests (wie in tests/r27-blatt-tempo.test.mjs)
  console.log(`${gut ? 'ok  ' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(detail).slice(0, 400)}`);
}

function initSkript() {
  try {
    if (sessionStorage.getItem('tempo-befunde')) return;
    sessionStorage.setItem('tempo-befunde', '1');
    localStorage.clear();
    localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ sprache: 'de', spracheGewaehlt: true, klang: false, bewegung: 'normal', figuren: 'cburnett' }));
    localStorage.setItem('schach-arena:v1:hinweis-installieren', '1');
    localStorage.setItem('schach-arena:konto:sichtbar', '1');
  } catch (e) { /* egal */ }
}

const seitenfehler = [];
const browser = await pw.chromium.launch({ headless: true });
try {
  const k = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2,
    serviceWorkers: 'block', colorScheme: 'light', locale: 'de-DE', timezoneId: 'Europe/Berlin' });
  await k.route('**/*.supabase.co/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await k.addInitScript(initSkript);
  const s = await k.newPage(); s.setDefaultTimeout(20000);
  s.on('pageerror', (e) => seitenfehler.push(e.message));
  try {
    await s.goto(`http://127.0.0.1:${PORT}/index.html?test#heim`);
    await s.waitForFunction(() => window.__app && typeof window.__app.gehe === 'function' && document.querySelector('.screen.heim-screen'), null, { timeout: 45000 });
    await s.evaluate(() => window.__app.gehe('ich'));
    await s.waitForSelector('.sa-screen', { timeout: 30000 });
    await warte(400);
    for (let i = 0; i < 12 && await s.locator('.st-moment .st-weiter').count(); i++) { await s.locator('.st-moment .st-weiter').first().click(); await warte(250); }

    // ---------- B3: Vorschau schnell schliessen ----------
    const imShop = () => s.locator('.sheet-ort:not(.weg) .sa-blatt-inhalt > .sa-bereich[data-bereich="shop"]:not([hidden])').count();
    const shopAuf = async () => {
      await s.locator('.sa-platz[data-bereich="shop"], .sa-gross[data-bereich="shop"]').first().click();
      await s.waitForSelector('.sa-blatt .sa-bereich[data-bereich="shop"]:not([hidden]) .shf-karte', { timeout: 15000 });
      await warte(600);
    };
    const vorschauAuf = async () => {
      const karte = s.locator('.sa-blatt .shf-karte[data-art="figur"]').first();
      await karte.scrollIntoViewIfNeeded();
      await karte.click();
      await s.waitForSelector('.sheet-karte .shf-vorschau', { timeout: 10000 });
    };
    for (const [name, wie, pause] of [['Escape sofort', 'Escape', 0], ['Escape nach 150 ms', 'Escape', 150], ['Schliessen sofort', 'knopf', 0],
      ['Escape nach 270 ms (Shop-Blatt eben vom Dokument)', 'Escape', 270], ['Schliessen nach 800 ms', 'knopf', 800]]) {
      await shopAuf();
      await vorschauAuf();
      if (pause) await warte(pause);
      if (wie === 'Escape') await s.keyboard.press('Escape');
      else await s.locator('.sheet-karte .sheet-knoepfe button', { hasText: 'Schließen' }).first().click();
      await s.waitForSelector('.sheet-karte .shf-vorschau', { state: 'detached', timeout: 5000 }).catch(() => {});
      await warte(900);
      const zurueck = await imShop();
      const bild = await s.evaluate(() => ({ blatt: [...document.querySelectorAll('.sheet-ort:not(.weg) .sheet-karte')].map((x) => x.className),
        bereiche: [...document.querySelectorAll('.sa-ort > .sa-bereich')].map((x) => x.dataset.bereich + (x.hidden ? ':zu' : ':auf')) }));
      pruefe(`B3 ${name}: Schliessen der Vorschau fuehrt zurueck in den Shop`, zurueck === 1, bild);
      if (await s.locator('.sheet-ort:not(.weg)').count()) await s.keyboard.press('Escape');
      await s.waitForSelector('.sheet-ort', { state: 'detached', timeout: 5000 }).catch(() => {});
      await warte(400);
    }
  } finally { await k.close(); }

  // ---------- B2: Vorrat der Eroeffnungen auf der Bots-Seite nur in Ruhe ----------
  // je Fall ein frisches Fenster (der Index lebt im Modul); bereit = js/openings.js eroeffnungBereit()
  for (const [name, mitEingabe] of [['ruhige Bots-Seite: der Vorrat wird gebaut', false], ['Eingabefeld mit Fokus: kein Vorrat', true]]) {
    const k2 = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, serviceWorkers: 'block', locale: 'de-DE' });
    await k2.route('**/*.supabase.co/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await k2.addInitScript(initSkript);
    const s2 = await k2.newPage(); s2.setDefaultTimeout(20000);
    s2.on('pageerror', (e) => seitenfehler.push(e.message));
    try {
      if (mitEingabe) {
        // das Feld steht, bevor die Bots-Seite vorzuladen beginnt (ladePartieScreen nach 900 ms)
        await s2.addInitScript(() => document.addEventListener('DOMContentLoaded', () => {
          const f = document.createElement('input'); f.id = 'probe-eingabe';
          f.style.cssText = 'position:fixed;left:0;top:0;width:10px;height:10px;opacity:.01;z-index:99';
          document.body.append(f); f.focus();
          setInterval(() => { if (document.activeElement !== f) f.focus(); }, 50);
        }));
      }
      await s2.goto(`http://127.0.0.1:${PORT}/index.html?test#arena`);
      await s2.waitForSelector('.screen.arena', { timeout: 45000 });
      await warte(5000);
      const bereit = await s2.evaluate(() => import('/js/openings.js').then((o) => o.eroeffnungBereit()));
      pruefe(`B2 ${name}`, mitEingabe ? bereit === false : bereit === true, { bereit });
    } finally { await k2.close(); }
  }
  pruefe('keine Seitenfehler', !seitenfehler.length, seitenfehler);
} finally {
  await browser.close();
  server.close();
}
console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
