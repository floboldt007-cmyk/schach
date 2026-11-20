// fable-check 19.11. Nr 6, Freigabe fc-00:35 d: im Shop als Gast reagierte die Karte "Mit Konto" (Edition) auf keinen Tipp.
// Jetzt oeffnet sie ein kleines Blatt mit dem vorhandenen Text shop.anmelden und dem Knopf shop.zumKonto (Konto-Seite der
// Einstellungen). Der Knopf schaltet die Testbereiche NICHT frei (kein kontoFreigeschaltet wie im alten Shop-Weg).
// Die Karten "Bald" oeffnen weiter ihre Vorschau. Geraete: iPhone 13 (Touch) und PC; dazu die Tastatur am PC.
//
//   node tests/r20-shop-gast.test.mjs
//   PORT=9794 node tests/r20-shop-gast.test.mjs    Port des Testservers (sonst: frei)
//
// Playwright: PLAYWRIGHT_PFAD, sonst 'playwright', sonst /opt/node-tools/node_modules/playwright.
import http from 'node:http';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..') + path.sep;
let pw = null;
for (const k of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
  try { pw = require(k); break; } catch (e) { /* naechster */ }
}
if (!pw) throw new Error('Playwright fehlt (PLAYWRIGHT_PFAD setzen)');

let gesamt = 0, ok = 0;
function pruefe(name, gut, detail = '') {
  gesamt++; if (gut) ok++;
  const d = typeof detail === 'string' ? detail : JSON.stringify(detail);
  console.log(`${gut ? 'ok    ' : 'FEHLER'} ${name}${!gut && d ? ' ' + d : ''}`);
}

const typen = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' };
const server = http.createServer((req, res) => {
  const p = path.resolve(WURZEL, '.' + decodeURIComponent(new URL(req.url, 'http://test').pathname).replace(/\/$/, '/index.html'));
  if (!p.startsWith(WURZEL)) { res.writeHead(403); res.end(); return; }
  try { res.writeHead(200, { 'Content-Type': typen[path.extname(p)] || 'application/octet-stream' }); res.end(readFileSync(p)); }
  catch (e) { res.writeHead(404); res.end(); }
});
const PORT = Number(process.env.PORT) || await (await import('./freier-port.mjs')).freierPort();
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
const HOST = `http://127.0.0.1:${PORT}/`;
const HEUTE = new Date().toISOString().slice(0, 10);
const FREI = 'schach-arena:konto:sichtbar';

const browser = await pw.chromium.launch();
const fehler = [];
async function shopOffen({ w, h, sprache = 'de' }) {
  const touch = w < 900;
  const k = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch });
  await k.route('**/*', (r) => (new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort()));
  await k.addInitScript((sp) => {
    if (sessionStorage.getItem('vorbelegt')) return; sessionStorage.setItem('vorbelegt', '1');
    localStorage.setItem('schach-arena:v1:modul:start', JSON.stringify({ gesehen: sp.heute }));
    localStorage.setItem('schach-arena:v1:hinweis-installieren', '1');
    localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ sprache: sp.sprache, spracheGewaehlt: true }));
  }, { heute: HEUTE, sprache });
  const s = await k.newPage();
  s.on('pageerror', (e) => fehler.push(e.message));
  await s.goto(HOST + '?test#ich');
  await s.waitForFunction(() => !!window.__app, null, { timeout: 15000 });
  await s.waitForTimeout(2000);
  const kachel = s.locator('.sa-plaetze button', { hasText: 'Shop' }).first();
  await kachel.scrollIntoViewIfNeeded().catch(() => {});
  if (touch) await kachel.tap().catch(() => {}); else await kachel.click().catch(() => {});
  await s.waitForSelector('.shf-karte[data-gast]', { timeout: 10000 }).catch(() => {});
  return { k, s, touch };
}
const blatt = (s) => s.evaluate(() => { const b = document.querySelector('.sheet-ort .sheet-karte');
  return b ? { titel: b.querySelector('h3')?.textContent || '', text: b.querySelector('p')?.textContent || '',
    knoepfe: [...b.querySelectorAll('.sheet-knoepfe button')].map((x) => x.textContent.trim()) } : null; });

for (const [g, w, h] of [['iPhone 13', 390, 844], ['PC', 1440, 900]]) {
  const { k, s, touch } = await shopOffen({ w, h });
  const gast = s.locator('.shf-karte[data-gast]').first();
  const karte = await s.evaluate(() => { const c = document.querySelector('.shf-karte[data-gast]');
    return c ? { role: c.getAttribute('role'), tab: c.tabIndex, name: c.querySelector('.shf-name')?.textContent || '' } : null; });
  await gast.scrollIntoViewIfNeeded().catch(() => {});
  if (touch) await gast.tap().catch(() => {}); else await gast.click().catch(() => {});
  await s.waitForFunction(() => { const h = document.querySelector('.sheet-ort .sheet-karte h3'); return h && h.textContent !== 'Shop'; }, null, { timeout: 5000 }).catch(() => {});
  const b = await blatt(s);
  pruefe(`${g}: Tipp auf "Mit Konto" oeffnet ein Blatt mit dem Hinweis und "Zum Konto"`,
    !!karte && karte.role === 'button' && karte.tab === 0 && !!b && b.titel === karte.name
      && b.text === 'Editionen gibt es mit Konto und ab 18 Jahren.' && b.knoepfe.includes('Zum Konto'), { karte, b });
  const zum = s.locator('.sheet-ort .sheet-knoepfe button', { hasText: 'Zum Konto' });
  if (touch) await zum.tap().catch(() => {}); else await zum.click().catch(() => {});
  await s.waitForFunction(() => location.hash === '#einstellungen/konto', null, { timeout: 8000 }).catch(() => {});
  await s.waitForTimeout(800);
  const ziel = await s.evaluate((F) => ({ hash: location.hash, screen: document.querySelector('.screen')?.className || '',
    blattZu: !document.querySelector('.sheet-ort .sheet-karte'), freigeschaltet: localStorage.getItem(F) }), FREI);
  pruefe(`${g}: "Zum Konto" fuehrt zur Konto-Seite der Einstellungen, schaltet keine Testbereiche frei`,
    ziel.hash === '#einstellungen/konto' && /es-screen/.test(ziel.screen) && ziel.blattZu && ziel.freigeschaltet !== '1', ziel);
  await k.close();
}

// Tastatur (PC): Fokus auf die Karte, Enter oeffnet; "Schliessen" fuehrt zurueck in den Shop (wie die Vorschau, sa:oeffne)
{
  const { k, s } = await shopOffen({ w: 1440, h: 900 });
  await s.locator('.shf-karte[data-gast]').first().focus().catch(() => {});
  await s.keyboard.press('Enter');
  await s.waitForFunction(() => document.querySelector('.sheet-ort .sheet-karte h3')?.textContent !== 'Shop', null, { timeout: 5000 }).catch(() => {});
  const b = await blatt(s);
  const vorher = await s.evaluate(() => location.hash);
  await s.locator('.sheet-ort .sheet-knoepfe button', { hasText: 'Schließen' }).click().catch(() => {});
  await s.waitForSelector('.shf-karte[data-gast]', { timeout: 5000 }).catch(() => {});
  await s.waitForTimeout(600);
  const nach = await s.evaluate(() => ({ hash: location.hash, shop: !!document.querySelector('.sheet-ort .shf-karte[data-gast]') }));
  pruefe('PC Tastatur: Enter auf der Karte oeffnet das Blatt, "Schließen" fuehrt zurueck in den Shop ohne Navigation',
    !!b && b.knoepfe.includes('Zum Konto') && nach.shop && nach.hash === vorher, { b, vorher, nach });
  await k.close();
}

// Englisch: dieselben vorhandenen Texte in der App-Sprache
{
  const { k, s } = await shopOffen({ w: 390, h: 844, sprache: 'en' });
  await s.locator('.shf-karte[data-gast]').first().tap().catch(() => {});
  await s.waitForFunction(() => { const h = document.querySelector('.sheet-ort .sheet-karte h3'); return h && h.textContent !== 'Shop'; }, null, { timeout: 5000 }).catch(() => {});
  const b = await blatt(s);
  pruefe('iPhone 13 (en): "Editions need an account and are for ages 18 and up." und "Go to account"',
    !!b && b.text === 'Editions need an account and are for ages 18 and up.' && b.knoepfe.includes('Go to account'), b);
  await k.close();
}

// Gegenprobe: eine Karte "Bald" oeffnet weiter die Vorschau (kein Konto-Blatt)
{
  const { k, s } = await shopOffen({ w: 390, h: 844 });
  await s.locator('button.shf-karte').first().tap().catch(() => {});
  await s.waitForFunction(() => { const h = document.querySelector('.sheet-ort .sheet-karte h3'); return h && h.textContent !== 'Shop'; }, null, { timeout: 5000 }).catch(() => {});
  const b = await blatt(s);
  pruefe('Karte "Bald": weiter die Vorschau, kein Konto-Hinweis', !!b && !b.knoepfe.includes('Zum Konto')
    && !!(await s.locator('.sheet-ort .shf-vorschau').count()), b);
  await k.close();
}

pruefe('keine Seitenfehler', fehler.length === 0, fehler);
await browser.close(); server.close();
console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
