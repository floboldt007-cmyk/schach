// Fokus beim Oeffnen der Blaetter (Feinschliff R20 B7, Befund live 349, Bauvorlage 9b 18.11.2026): auf Live-Bildern trug der
// erste Knopf eines frisch geoeffneten Blatts ("Fertig") einen Fokusring. sheet() (js/ui/bauteile.js) setzt den Fokus beim
// Oeffnen per Skript auf den ersten sicheren Knopf; ob der Ring erscheint, entscheidet die :focus-visible-Regel des Browsers.
// Diese Probe misst es mit echtem Tippen statt mit einem Aufnahme-Skript.
//   iPhone 13 mit Touch: Bretter, Shop und "Profilbild aendern" per Tipp oeffnen -> der fokussierte Knopf zeigt KEINEN Ring
//   (kein :focus-visible, keine sichtbare Kontur). PC mit Tastatur: dieselben Blaetter per Tab und Enter -> der Ring IST da
//   (WCAG 2.4.7). Rueckfrage mit "Aufgeben" (art gefahr): der Fokus liegt auf dem sicheren Knopf, nie auf "Aufgeben".
//   Netz nur simuliert.
//
//   node tests/r20-blatt-fokus.test.mjs
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
  // INTENTIONAL-SLOP[T4]: die Pruefzeile ist die Ausgabe des Tests (wie in tests/r19-sterne.test.mjs)
  console.log(`${gut ? 'ok  ' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(detail).slice(0, 400)}`);
}

function initSkript() {
  try {
    if (sessionStorage.getItem('fokus-start')) return;
    sessionStorage.setItem('fokus-start', '1');
    localStorage.clear();
    const d = new Date(); if (d.getHours() < 4) d.setDate(d.getDate() - 1);
    const z = (n) => String(n).padStart(2, '0');
    localStorage.setItem('schach-arena:v1:modul:start', JSON.stringify({ v: 1, gesehen: `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}` }));
    localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ sprache: 'de', spracheGewaehlt: true, klang: false, modus: 'hell', arenaKarteHinweis: true }));
    localStorage.setItem('schach-arena:v1:hinweis-installieren', '1');
  } catch (e) { /* egal */ }
}

// Zustand des fokussierten Elements im offenen Blatt
const fokus = (s) => s.evaluate(() => {
  const a = document.activeElement;
  const imBlatt = !!a && !!a.closest('.sheet-ort');
  const st = a ? getComputedStyle(a) : null;
  return { imBlatt, text: (a?.textContent || '').trim().slice(0, 30), sichtbar: !!a && a.matches(':focus-visible'),
    kontur: st ? `${st.outlineStyle} ${st.outlineWidth}` : '', ring: !!st && st.outlineStyle !== 'none' && parseFloat(st.outlineWidth) > 0,
    gefahr: !!a && a.classList.contains('gefahr') };
});
const blattZu = async (s) => { await s.keyboard.press('Escape'); await s.waitForSelector('.sheet-ort', { state: 'detached', timeout: 5000 }).catch(() => {}); await warte(300); };

async function zuIch(s) {
  await s.evaluate(() => window.__app.gehe('ich'));
  await s.waitForSelector('.sa-screen', { timeout: 30000 });
  await warte(400);
  for (let i = 0; i < 12 && await s.locator('.st-moment .st-weiter').count(); i++) { await s.locator('.st-moment .st-weiter').first().click(); await warte(250); }
}

const OEFFNER = [
  ['Bretter', '.sa-platz[data-bereich="bretter"], .sa-gross[data-bereich="bretter"]'],
  ['Shop', '.sa-platz[data-bereich="shop"], .sa-gross[data-bereich="shop"]'],
  ['Profilbild aendern', '.pr-aendern'],
];
const seitenfehler = [];
const browser = await pw.chromium.launch({ headless: true });
try {
  for (const [geraet, opt, art] of [['iPhone 13', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }, 'Tipp'],
    ['PC', { viewport: { width: 1280, height: 800 } }, 'Tastatur']]) {
    const k = await browser.newContext({ ...opt, deviceScaleFactor: 2, serviceWorkers: 'block', colorScheme: 'light', locale: 'de-DE', timezoneId: 'Europe/Berlin' });
    await k.route('**/*.supabase.co/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await k.addInitScript(initSkript);
    const s = await k.newPage(); s.setDefaultTimeout(20000);
    s.on('pageerror', (e) => seitenfehler.push(`${geraet}: ${e.message}`));
    try {
      await s.goto(`http://127.0.0.1:${PORT}/index.html?test#arena`);
      await s.waitForFunction(() => window.__app && typeof window.__app.gehe === 'function', null, { timeout: 30000 });
      await zuIch(s);
      for (const [name, sel] of OEFFNER) {
        const knopf = s.locator(sel).first();
        if (!(await knopf.count())) { pruefe(`${geraet}: Oeffner ${name} vorhanden`, false, sel); continue; }
        await knopf.scrollIntoViewIfNeeded();
        if (art === 'Tipp') await knopf.tap();
        else { await knopf.focus(); await s.keyboard.press('Shift'); await s.keyboard.press('Enter'); }
        await s.waitForSelector('.sheet-ort', { timeout: 10000 });
        await warte(700);
        const f = await fokus(s);
        pruefe(`${geraet} ${art} ${name}: Fokus liegt im Blatt`, f.imBlatt, f);
        if (art === 'Tipp') pruefe(`${geraet} ${art} ${name}: kein Fokusring nach dem Tippen`, !f.sichtbar && !f.ring, f);
        else pruefe(`${geraet} ${art} ${name}: Fokusring sichtbar nach Tastatur (2.4.7)`, f.sichtbar && f.ring, f);
        console.log(`     Messwert ${geraet} ${art} ${name}: "${f.text}" focus-visible=${f.sichtbar} outline=${f.kontur}`);
        await blattZu(s);
        if (name === 'Shop' || !(await s.locator('.sa-screen').count())) await zuIch(s);
      }
      // Rueckfrage mit gefahr-Knopf: der sichere Knopf bekommt den Fokus (Enter loest nie "Aufgeben" aus)
      await s.evaluate(async () => {
        const { sheet } = await import('/js/ui/bauteile.js');
        window.__probeWert = 'offen'; sheet({ titel: 'Aufgeben?', knoepfe: [{ text: 'Aufgeben', wert: 'auf', art: 'gefahr' }, { text: 'Weiterspielen', wert: false }] }).then((w) => { window.__probeWert = w; });
      });
      await s.waitForSelector('.sheet-ort', { timeout: 10000 });
      await warte(500);
      const g = await fokus(s);
      pruefe(`${geraet}: Rueckfrage fokussiert den sicheren Knopf`, g.imBlatt && !g.gefahr && /Weiter/.test(g.text), g);
      await s.keyboard.press('Enter'); await warte(600);
      pruefe(`${geraet}: Enter in der Rueckfrage gibt nicht auf`, (await s.evaluate(() => window.__probeWert)) === false, await s.evaluate(() => window.__probeWert));
    } finally { await k.close(); }
  }
  pruefe('keine Seitenfehler', !seitenfehler.length, seitenfehler);
} finally {
  await browser.close();
  server.close();
}
console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
