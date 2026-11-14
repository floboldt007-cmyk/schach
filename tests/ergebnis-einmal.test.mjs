// Ergebnisblatt der Bot-Partie, alles nur einmal (Feinschliff R7, Befund B13 aus R6): je Geraet (iPhone 13 und PC 1280,
// helles Thema) eine Niederlage per Narrenmatt und ein Sieg per Schaefermatt gegen Fridolin (der Bot zieht nach Plan ueber
// window.__test.botZug, wie tests/funktion-partie.test.mjs). Geprueft wird am offenen Blatt:
//   1. der Abschiedsspruch des Bots steht genau einmal sichtbar (im Blatt, nicht zusaetzlich in der Blase am Brett)
//   2. nach der Niederlage gibt es genau EINEN Knopf fuer "nochmal spielen" (Revanche, wie die Online-Partie), nicht
//      "Revanche" und "Nochmal" nebeneinander
//   3. jeder sichtbare Knopf im Blatt ist mindestens 44 px hoch
//   4. kein alter Name "Arena" im sichtbaren Text des Blatts. Der Text "Arena-Wertung ±0" kommt aus
//      js/pakete/liga/texte.js ('abr.arena'), das dieser Auftrag nicht aendern darf: ohne ARENA_STRENG=1 meldet die
//      Probe ihn als OFFEN und zaehlt ihn nicht als Fehler.
//
//   node tests/ergebnis-einmal.test.mjs
//   BILDER=<ordner> node tests/ergebnis-einmal.test.mjs   Bilder dorthin (Standard: <tmp>/ergebnis-einmal)
//   PORT=8991 node tests/ergebnis-einmal.test.mjs          eigener Port (Standard: frei)
//   ARENA_STRENG=1 node tests/ergebnis-einmal.test.mjs     "Arena" im Blatt zaehlt als Fehler
import http from 'node:http';
import { createRequire } from 'node:module';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';
import { browserTyp } from './browser.mjs';

const require = createRequire(import.meta.url);
let pw;
for (const p of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
  try { pw = require(p); break; } catch (e) { /* naechster */ }
}
if (!pw) throw new Error('Playwright fehlt');
const BILDER = process.env.BILDER || path.join(os.tmpdir(), 'ergebnis-einmal');
const ARENA_STRENG = process.env.ARENA_STRENG === '1';
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

const { defaultBrowserType, ...IPHONE } = pw.devices['iPhone 13'];
const GERAETE = [
  { name: 'iphone13', optionen: IPHONE },
  { name: 'pc1280', optionen: { viewport: { width: 1280, height: 800 } } },
];
// Narrenmatt (Flo mit Weiss verliert) und Schaefermatt (Flo gewinnt)
const PARTIEN = [
  { art: 'niederlage', zuege: ['f2f3', 'g2g4'], plan: { f2f3: 'e7e5', g2g4: 'd8h4' } },
  { art: 'sieg', zuege: ['e2e4', 'f1c4', 'd1h5', 'h5f7'], plan: { e2e4: 'e7e5', f1c4: 'b8c6', d1h5: 'g8f6' } },
];
const SCREEN = '.screen.partie:not(.online-screen)';

let ok = 0, gesamt = 0;
const offen = [];
function pruefe(name, gut, detail = '') {
  gesamt++; if (gut) ok++;
  console.log(`${gut ? 'OK' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(detail)}`);
  return gut;
}
const warte = ms => new Promise(r => setTimeout(r, ms));

async function zug(s, uci) {
  await s.waitForFunction(() => window.__partie.phase() === 'flo', null, { timeout: 30000 });
  for (const f of [uci.slice(0, 2), uci.slice(2, 4)]) await s.locator(`${SCREEN} .brett-felder .feld[data-feld="${f}"]`).click();
  if (await s.locator(`${SCREEN} .brett .lage.vorschau`).count()) await s.locator(`${SCREEN} .brett-felder .feld[data-feld="${uci.slice(2, 4)}"]`).click();
}

// Lage am offenen Blatt: Spruch-Vorkommen, Knoepfe fuer "nochmal spielen", alle Knopf-Hoehen, sichtbarer Text
const lage = s => s.evaluate(() => {
  const o = document.querySelector('.ergebnis-overlay');
  const sichtbar = e => {
    if (!e || e.hidden || e.closest('[hidden]') || e.classList.contains('weg')) return false;
    const st = getComputedStyle(e);
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none' && Number(st.opacity) > 0;
  };
  const spruch = (o.querySelector('.erg-bot .sprechblase')?.textContent || '').trim();
  const blasen = [...document.querySelectorAll('.sprechblase')].filter(b => sichtbar(b) && b.textContent.trim() === spruch);
  const nochmal = [...o.querySelectorAll('.erg-knoepfe [data-ziel="nochmal"], .erg-knoepfe [data-ziel="ab-hier"], .gd-revanche')]
    .filter(sichtbar).map(b => b.textContent.replace(/\s+/g, ' ').trim());
  const knoepfe = [...o.querySelectorAll('button')].filter(sichtbar)
    .map(b => ({ text: (b.textContent.replace(/\s+/g, ' ').trim() || b.getAttribute('aria-label') || b.className).slice(0, 40), h: b.offsetHeight }));
  return { spruch, orte: blasen.map(b => b.closest('.erg-bot') ? 'blatt' : b.closest('.blase-ort') ? 'brett' : 'anderswo'),
    nochmal, knoepfe, text: o.querySelector('.ergebnis-karte').innerText };
});

let browser;
try {
  browser = await browserTyp(pw).launch({ headless: true });
  for (const g of GERAETE) {
    const k = await browser.newContext({ ...g.optionen, locale: 'de-DE', colorScheme: 'light', serviceWorkers: 'block' });
    await k.route('**/*.supabase.co/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await k.addInitScript(() => {
      try {
        if (!localStorage.getItem('schach-arena:v1:modul:start')) localStorage.setItem('schach-arena:v1:modul:start', JSON.stringify({ v: 1, gesehen: '2026-11-01' }));
        if (!localStorage.getItem('schach-arena:v1:einstellungen')) localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ klang: false }));
      } catch (e) { /* egal */ }
    });
    const s = await k.newPage(); s.setDefaultTimeout(15000);
    const fehler = [];
    s.on('pageerror', e => fehler.push(e.message));
    try {
      await s.goto(`http://127.0.0.1:${server.address().port}/index.html?test#heim`);
      await s.waitForFunction(() => window.__app && typeof window.__app.gehe === 'function', null, { timeout: 30000 });
      await warte(1200);
      for (const p of PARTIEN) {
        await s.evaluate(plan => {
          localStorage.removeItem('schach-arena:v1:laufend');
          window.__test = { botZug: () => { const v = window.__partie.chess().history({ verbose: true }); return plan[v[v.length - 1].lan] || null; } };
          window.__app.gehe('partie', { botId: 'fridolin', farbe: 'w' });
        }, p.plan);
        await s.waitForFunction(sel => window.__partie && window.__partie.bereit === true && window.__partie.phase() === 'flo'
          && document.querySelectorAll(sel + ' .brett img.figur').length === 32, SCREEN, { timeout: 30000 });
        for (const z of p.zuege) await zug(s, z);
        await s.waitForSelector(`.ergebnis-overlay.${p.art}.gefuellt:not(.vorlaeufig)`, { timeout: 60000 });
        await warte(1500);   // Blatt eingefedert, Blase am Brett ggf. ausgeblendet
        await s.screenshot({ path: path.join(BILDER, `${g.name}-${p.art}.png`) }).catch(() => {});
        const l = await lage(s);
        pruefe(`${g.name} ${p.art}: Spruch des Bots steht genau einmal sichtbar, im Blatt`, l.spruch.length > 0 && l.orte.length === 1 && l.orte[0] === 'blatt', l);
        // R16 E2: nach einer Niederlage spricht der Bot als Sieger (Anlass gewinnt), nach einem Sieg als Verlierer
        const liste = await s.evaluate(async (anlass) => (await import('/js/bots.js')).BOTS.find((b) => b.id === 'fridolin').saetze[anlass],
          p.art === 'niederlage' ? 'gewinnt' : 'verliert');
        pruefe(`${g.name} ${p.art}: Spruch passt zum Ergebnis (Bot-Satz ${p.art === 'niederlage' ? 'gewinnt' : 'verliert'}), kein Lob als Sieger nach Niederlage`,
          liste.includes(l.spruch) && !(p.art === 'niederlage' && /du hast gewonnen|^gewonnen, aber du/i.test(l.spruch)), { spruch: l.spruch, liste });
        if (p.art === 'niederlage') {
          pruefe(`${g.name} ${p.art}: genau ein Knopf zum Nochmal-Spielen, und er heisst "Revanche" wie in der Online-Partie`,
            l.nochmal.length === 1 && /^Revanche/.test(l.nochmal[0]), l.nochmal);
        }
        const klein = l.knoepfe.filter(b => b.h < 44);
        pruefe(`${g.name} ${p.art}: alle ${l.knoepfe.length} sichtbaren Knoepfe im Blatt mindestens 44 px hoch`, l.knoepfe.length > 0 && !klein.length, klein);
        const arena = /Arena/.test(l.text);
        if (ARENA_STRENG) pruefe(`${g.name} ${p.art}: kein alter Name "Arena" im Blatt`, !arena, l.text);
        else if (arena) offen.push(`${g.name} ${p.art}: "${(l.text.match(/[^\n]*Arena[^\n]*/) || [''])[0]}" (js/pakete/liga/texte.js 'abr.arena', nicht in diesem Auftrag)`);
      }
      pruefe(`${g.name}: keine Seitenfehler`, !fehler.length, fehler);
    } catch (e) {
      await s.screenshot({ path: path.join(BILDER, `${g.name}-abbruch.png`) }).catch(() => {});
      pruefe(`${g.name}: Ablauf ohne Abbruch`, false, e.stack);
    }
    await k.close();
  }
} finally {
  if (browser) await browser.close();
  server.close();
}
for (const x of offen) console.log('OFFEN ' + x);
console.log(`\n${ok}/${gesamt} Pruefungen bestanden${offen.length ? `, ${offen.length} offen (Arena-Text, siehe oben)` : ''}`);
process.exit(ok === gesamt ? 0 : 1);
