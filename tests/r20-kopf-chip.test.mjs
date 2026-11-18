// Kopf-Chips ohne Stummel (Feinschliff R20 B3, Befund live 349, Bauvorlage 9b 18.11.2026): am Handy stand im Kopf der
// Meisterschule links vom Ton-Knopf nur ein kleiner Punkt statt des Chips "★ 0". Ein Chip steht entweder ganz da oder fehlt
// ganz (js/ui/seite.js passeChips, css/navigation.css:33-41); "/ 195" bleibt am Handy bewusst weg (navigation.css, Zahlenruhe,
// Flo 23.10.), am PC steht es.
//   Je Haupt-Kopf (Lernen, Arena, Liga, Ich): ist die Chip-Leiste sichtbar, dann ist jeder sichtbare Chip ganz zu sehen
//   (nicht vom Rand der Leiste angeschnitten) und mindestens 24 px breit; eine Leiste ohne sichtbaren Chip malt nichts.
//   320, 375, 390, 430, 768 und 1280 px, hell und dunkel, Deutsch und Englisch; gemessen direkt nach dem Zeichnen und
//   nachdem die Webschrift da ist, einmal normal und einmal mit verzoegerter Webschrift (der Titel wird erst spaeter breiter).
//   Netz nur simuliert.
//
//   node tests/r20-kopf-chip.test.mjs
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

function initSkript({ modus, sprache }) {
  try {
    if (sessionStorage.getItem('chip-start')) return;
    sessionStorage.setItem('chip-start', '1');
    localStorage.clear();
    const d = new Date(); if (d.getHours() < 4) d.setDate(d.getDate() - 1);
    const z = (n) => String(n).padStart(2, '0');
    localStorage.setItem('schach-arena:v1:modul:start', JSON.stringify({ v: 1, gesehen: `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}` }));
    localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ sprache, spracheGewaehlt: true, klang: false, modus, arenaKarteHinweis: true }));
    localStorage.setItem('schach-arena:v1:hinweis-installieren', '1');
  } catch (e) { /* egal */ }
}

// Jeder sichtbare Haupt-Kopf: Leiste, ihre sichtbaren Chips und was davon innerhalb der Leiste zu sehen ist
const messe = (s) => s.evaluate(() => {
  const sichtbar = (e) => { const st = getComputedStyle(e); return st.display !== 'none' && st.visibility !== 'hidden' && e.getClientRects().length > 0; };
  return [...document.querySelectorAll('.screen .haupt-kopf')].filter((k) => { const r = k.getBoundingClientRect();
    return sichtbar(k) && r.width > 0 && r.bottom > 0 && r.top < innerHeight; }).map((kopf) => {
    const leiste = kopf.querySelector('.kopf-chips');
    const titel = (kopf.querySelector('.titel, h1, h2')?.textContent || '').trim().slice(0, 30);
    if (!leiste || !sichtbar(leiste)) return { titel, leiste: 'aus', chips: [] };
    const lr = leiste.getBoundingClientRect();
    const chips = [...leiste.children].filter((c) => sichtbar(c) && c.offsetWidth > 0).map((c) => {
      const r = c.getBoundingClientRect();
      const zuSehen = Math.max(0, Math.min(r.right, lr.right) - Math.max(r.left, lr.left));
      const von = c.querySelector('.von');
      return { text: c.textContent.replace(/\s+/g, ' ').trim().slice(0, 40), breite: Math.round(r.width * 10) / 10,
        zuSehen: Math.round(zuSehen * 10) / 10, vonSichtbar: !!von && sichtbar(von) };
    });
    return { titel, leiste: 'an', leisteBreite: Math.round(lr.width * 10) / 10, chips, klassen: kopf.className };
  });
});

function bewerte(gruppe, wann, koepfe, pc) {
  pruefe(`${gruppe} ${wann}: ein Haupt-Kopf sichtbar`, koepfe.length > 0, koepfe);
  for (const k of koepfe) {
    const name = `${gruppe} ${wann} "${k.titel}"`;
    if (k.leiste === 'aus') { pruefe(`${name}: Leiste aus, kein Stummel`, true); continue; }
    // eine sichtbare Leiste ohne sichtbaren Chip darf keine Flaeche haben (ihr Polster war der Punkt)
    if (!k.chips.length) pruefe(`${name}: Leiste ohne Chip ist leer`, k.leisteBreite <= 0.5, k);
    for (const c of k.chips) {
      pruefe(`${name}: Chip "${c.text}" ganz zu sehen und >= 24 px`, c.breite >= 24 && c.zuSehen >= c.breite - 1, { ...c, leisteBreite: k.leisteBreite, klassen: k.klassen });
      if (/^★?\s*\d/.test(c.text) || c.vonSichtbar) {
        if (pc) pruefe(`${name}: am PC steht "/ max" im Sterne-Chip`, c.vonSichtbar, c);
        else pruefe(`${name}: am Handy bleibt "/ max" weg (Zahlenruhe)`, !c.vonSichtbar, c);
      }
    }
  }
}

const GROESSEN = [[320, 568], [375, 667], [390, 844], [430, 932], [768, 1024], [1280, 720]];
const SCREENS = ['lernen', 'arena', 'liga', 'ich'];
const seitenfehler = [];
const browser = await pw.chromium.launch({ headless: true });
try {
  for (const schrift of ['normal', 'spaet']) {
    for (const [w, h] of GROESSEN) {
      for (const farbe of ['hell', 'dunkel']) {
        for (const sprache of ['de', 'en']) {
          const gruppe = `${w}x${h} ${farbe} ${sprache} Schrift ${schrift}`;
          const touch = w < 1000;
          const k = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: touch, isMobile: touch && w < 700,
            serviceWorkers: 'block', colorScheme: farbe === 'dunkel' ? 'dark' : 'light', locale: sprache === 'de' ? 'de-DE' : 'en-US', timezoneId: 'Europe/Berlin' });
          await k.route('**/*.supabase.co/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
          // verzoegerte Webschrift: der Kopf wird zuerst mit der Ersatzschrift gemessen, der Titel wird danach breiter
          if (schrift === 'spaet') await k.route(/\.(woff2?|ttf|otf)(\?|$)/, async (r) => { await warte(1500); await r.continue(); });
          await k.addInitScript(initSkript, { modus: farbe, sprache });
          const s = await k.newPage(); s.setDefaultTimeout(20000);
          s.on('pageerror', (e) => seitenfehler.push(`${gruppe}: ${e.message}`));
          try {
            await s.goto(`http://127.0.0.1:${PORT}/index.html?test#arena`);
            await s.waitForFunction(() => window.__app && typeof window.__app.gehe === 'function', null, { timeout: 30000 });
            await s.waitForFunction(() => !!document.querySelector('#app > .screen:not(.lade-screen)'), null, { timeout: 30000 });
            for (const ziel of SCREENS) {
              await s.evaluate((z) => window.__app.gehe(z), ziel);
              await s.waitForSelector('.screen .haupt-kopf', { state: 'visible' });
              await s.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
              bewerte(`${gruppe} ${ziel}`, 'gleich', await messe(s), w > 700);
              await s.evaluate(() => document.fonts.ready);
              await warte(schrift === 'spaet' ? 1800 : 300);
              await s.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
              bewerte(`${gruppe} ${ziel}`, 'mit Schrift', await messe(s), w > 700);
            }
          } finally { await k.close(); }
        }
      }
    }
  }
  pruefe('keine Seitenfehler', !seitenfehler.length, seitenfehler);
} finally {
  await browser.close();
  server.close();
}
console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
