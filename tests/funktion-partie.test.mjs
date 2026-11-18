// Funktionsprobe Bot-Partie (Feinschliff 12.11.2026, R5): spielt wie ein Mensch durch die Oberflaeche, je Geraet
// (iPhone 13 und PC 1280) in einer frischen Sitzung. Partie 1 gegen den ersten Bot (Fridolin) bis zum Sieg per
// Schaefermatt (der Bot antwortet nach Plan ueber window.__test.botZug, wie tests/siegblatt-tastatur.test.mjs), dabei
// einmal "Hinweis" antippen. Partie 2: Aufgeben ueber den Halte-Knopf. Je Handlung eine Pruefung "geht / geht nicht"
// und ein Bild. Netzwerk: keine Anmeldung, kein Aufruf an Supabase (jede Anfrage dorthin wird leer beantwortet).
// Findet die Probe spaeter eine Luecke, die nicht sofort repariert wird: Schalter wie in tests/online-ranked-probe.test.mjs.
//
//   node tests/funktion-partie.test.mjs
//   BILDER=<ordner> node tests/funktion-partie.test.mjs  Bilder dorthin (Standard: <tmp>/funktion-partie)
//   PORT=9631 node tests/funktion-partie.test.mjs        eigener Port (Standard: frei)
import http from 'node:http';
import { createRequire } from 'node:module';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';
import { browserTyp, fingerTreiber } from './browser.mjs';

const require = createRequire(import.meta.url);
let pw;
for (const p of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
  try { pw = require(p); break; } catch (e) { /* naechster */ }
}
if (!pw) throw new Error('Playwright fehlt');
const BILDER = process.env.BILDER || path.join(os.tmpdir(), 'funktion-partie');
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
  { name: 'iphone13', optionen: IPHONE, finger: true },
  { name: 'pc1280', optionen: { viewport: { width: 1280, height: 800 } }, finger: false },
];
// Schaefermatt: Fridolin antwortet nach Plan
const ZUEGE = ['e2e4', 'f1c4', 'd1h5', 'h5f7'];
const PLAN = { e2e4: 'e7e5', f1c4: 'b8c6', d1h5: 'g8f6' };
const SCREEN = '.screen.partie:not(.online-screen)';

let ok = 0, gesamt = 0;
function pruefe(name, gut, detail = '') {
  gesamt++; if (gut) ok++;
  console.log(`${gut ? 'OK' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(detail)}`);
  return gut;
}
const warte = ms => new Promise(r => setTimeout(r, ms));
const klappt = p => p.then(() => true).catch(() => false);
// sichtbar und bedienbar: Flaeche, nicht versteckt, nicht gesperrt
const bedienbar = (s, sel) => s.evaluate(sel => [...document.querySelectorAll(sel)].map(e => {
  const r = e.getBoundingClientRect();
  return { ziel: e.dataset.ziel || e.className, text: e.textContent.trim().slice(0, 40), ok: r.width > 0 && r.height > 0 && !e.hidden && !e.disabled
    && getComputedStyle(e).visibility !== 'hidden' && !e.closest('[inert]') };
}), sel);
const offenesBlatt = (s, art) => s.evaluate(art => {
  const o = document.querySelector('.ergebnis-overlay.' + art);
  return { da: !!o && !o.hidden && o.getBoundingClientRect().height > 0, wort: o?.querySelector('.erg-wort')?.textContent.trim() || null };
}, art);

async function zug(s, uci) {
  await s.waitForFunction(() => window.__partie.phase() === 'flo', null, { timeout: 30000 });
  for (const f of [uci.slice(0, 2), uci.slice(2, 4)]) await s.locator(`${SCREEN} .brett-felder .feld[data-feld="${f}"]`).click();
  // Zug bestaetigen (Vorschau): zweiter Tipp aufs Ziel
  if (await s.locator(`${SCREEN} .brett .lage.vorschau`).count()) await s.locator(`${SCREEN} .brett-felder .feld[data-feld="${uci.slice(2, 4)}"]`).click();
}
async function neuePartie(s, botZugPlan) {
  await s.evaluate(plan => {
    localStorage.removeItem('schach-arena:v1:laufend');
    window.__test = plan ? { botZug: () => { const v = window.__partie.chess().history({ verbose: true }); return plan[v[v.length - 1].lan] || null; } } : {};
    window.__app.gehe('partie', { botId: 'fridolin', farbe: 'w' });
  }, botZugPlan);
  return klappt(s.waitForFunction(sel => window.__partie && window.__partie.bereit === true && window.__partie.phase() === 'flo'
    && document.querySelectorAll(sel + ' .brett img.figur').length === 32, SCREEN, { timeout: 30000 }));
}

let browser;
try {
  browser = await browserTyp(pw).launch({ headless: true });
  for (const g of GERAETE) {
    const fehler = [];
    const k = await browser.newContext({ ...g.optionen, locale: 'de-DE', serviceWorkers: 'block' });
    await k.route('**/*.supabase.co/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await k.addInitScript(() => {
      try {
        if (!localStorage.getItem('schach-arena:v1:modul:start')) localStorage.setItem('schach-arena:v1:modul:start', JSON.stringify({ v: 1, gesehen: '2026-11-01' }));
        if (!localStorage.getItem('schach-arena:v1:einstellungen')) localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ klang: false }));
      } catch (e) { /* egal */ }
    });
    const s = await k.newPage(); s.setDefaultTimeout(15000);
    s.on('pageerror', e => fehler.push(e.message));
    const bild = name => s.screenshot({ path: path.join(BILDER, `${g.name}-${name}.png`) }).catch(() => {});
    try {
      await s.goto(`http://127.0.0.1:${server.address().port}/index.html?test#heim`);
      await s.waitForFunction(() => window.__app && typeof window.__app.gehe === 'function' && document.documentElement.dataset.screen, null, { timeout: 30000 });
      await warte(1200);   // Start fertig laden lassen (wie tests/siegblatt-tastatur.test.mjs)

      // 1) Partie gegen den ersten Bot starten
      const gestartet = await neuePartie(s, PLAN);
      await bild('01-start');
      pruefe(`${g.name}: Partie gegen Fridolin startet (Brett mit 32 Figuren, Flo am Zug)`, gestartet,
        await s.evaluate(() => ({ phase: window.__partie?.phase?.(), bereit: window.__partie?.bereit })));
      if (!gestartet) throw new Error('ohne Partie kein weiterer Ablauf');

      // 2) Erster Zug, Bot antwortet, dann "Hinweis" antippen
      await zug(s, ZUEGE[0]);
      const geantwortet = await klappt(s.waitForFunction(() => window.__partie.phase() === 'flo' && window.__partie.chess().history().length === 2, null, { timeout: 15000 }));
      pruefe(`${g.name}: Zug e2-e4 per Tipp, Fridolin antwortet`, geantwortet, await s.evaluate(() => window.__partie.chess().history()));
      await s.locator(`${SCREEN} .spielknoepfe > [data-aktion="hinweis"]`).click();
      const hinweis = await klappt(s.waitForSelector(`${SCREEN} .brett .lage.mark-hinweis`, { timeout: 25000 }));
      await bild('02-hinweis');
      pruefe(`${g.name}: Hinweis antippen markiert ein Feld auf dem Brett`, hinweis,
        await s.evaluate(sel => [...document.querySelectorAll(sel + ' .brett .lage')].map(e => e.className), SCREEN));

      // 3) Weiter bis zum Matt: Sieg-Blatt mit seinen Knoepfen
      for (const z of ZUEGE.slice(1)) await zug(s, z);
      const sieg = await klappt(s.waitForSelector('.ergebnis-overlay.sieg.gefuellt', { timeout: 40000 }));
      await warte(1500);
      await bild('03-sieg');
      const siegBlatt = await offenesBlatt(s, 'sieg');
      pruefe(`${g.name}: Schaefermatt, das Sieg-Blatt erscheint`, sieg && siegBlatt.da, { sieg, ...siegBlatt, zuege: await s.evaluate(() => window.__partie.chess().history()) });
      // R14-G2: "Siegesbild teilen" und "Freund herausfordern" sind EIN Knopf "Teilen …" (Paket teilen) mit Auswahl
      const siegKnoepfe = await bedienbar(s, '.ergebnis-overlay.sieg :is(.erg-knoepfe [data-ziel], .erg-zu, .erg-lobby, .erg-freund, .tl-teilen)');
      const ziele = siegKnoepfe.filter(b => b.ok).map(b => b.ziel);
      pruefe(`${g.name}: Sieg-Blatt zeigt bedienbar "Naechster Gegner", "Zur Analyse", "Zu den Bots", "Teilen …" (statt eigenem "Freund herausfordern"), "Brett ansehen"`,
        ['weiter', 'analyse'].every(z => ziele.includes(z)) && ['erg-zu', 'erg-lobby', 'tl-teilen'].every(c => ziele.some(z => z.includes(c)))
        && !ziele.some(z => z.includes('erg-freund')), siegKnoepfe);
      // "Brett ansehen" schliesst das Blatt, "Ergebnis" holt es zurueck
      await s.locator('.ergebnis-overlay.sieg .erg-zu').click();
      const brettFrei = await klappt(s.waitForFunction(() => { const o = document.querySelector('.ergebnis-overlay'); return !o || o.hidden || o.getBoundingClientRect().height === 0; }, null, { timeout: 5000 }));
      await bild('04-brett-ansehen');
      const ergKnopf = await bedienbar(s, `${SCREEN} .ergebnis-zeigen`);
      pruefe(`${g.name}: "Brett ansehen" schliesst das Blatt, der Knopf "Ergebnis" steht bereit`, brettFrei && ergKnopf.some(b => b.ok), { brettFrei, ergKnopf });
      if (ergKnopf.some(b => b.ok)) await s.locator(`${SCREEN} .ergebnis-zeigen`).click();
      const wieder = await klappt(s.waitForFunction(() => { const o = document.querySelector('.ergebnis-overlay.sieg'); return !!o && !o.hidden && o.getBoundingClientRect().height > 0; }, null, { timeout: 5000 }));
      pruefe(`${g.name}: "Ergebnis" oeffnet das Sieg-Blatt wieder`, wieder);
      await s.locator('.ergebnis-overlay.sieg .erg-knoepfe [data-ziel="weiter"]').click({ timeout: 5000 }).catch(() => {});
      const arena = await klappt(s.waitForSelector('.screen.arena', { timeout: 10000 }));
      await warte(800);
      await bild('05-naechster-gegner');
      pruefe(`${g.name}: "Naechster Gegner" fuehrt zur Bot-Auswahl`, arena, await s.evaluate(() => [...document.querySelectorAll('.screen')].map(e => e.className)));

      // 4) Zweite Partie: Aufgeben ueber den Halte-Knopf (1 s halten)
      const zweite = await neuePartie(s, null);
      await bild('06-partie2');
      pruefe(`${g.name}: zweite Partie startet`, zweite);
      const knopf = s.locator(`${SCREEN} .spielknoepfe > [data-aktion="aufgeben"]`);
      const halten = await knopf.evaluate(e => e.classList.contains('halte-knopf')).catch(() => false);
      const r = await knopf.boundingBox();
      const [x, y] = [r.x + r.width / 2, r.y + r.height / 2];
      if (g.finger) { const f = fingerTreiber(s); await f.runter(x, y); await warte(1400); await f.hoch(x, y); }
      else { await s.mouse.move(x, y); await s.mouse.down(); await warte(1400); await s.mouse.up(); }
      const niederlage = await klappt(s.waitForSelector('.ergebnis-overlay.niederlage.gefuellt', { timeout: 20000 }));
      await warte(1500);
      await bild('07-niederlage');
      const nBlatt = await offenesBlatt(s, 'niederlage');
      pruefe(`${g.name}: Aufgeben (1 s halten) beendet die Partie, das Niederlage-Blatt erscheint`, halten && niederlage && nBlatt.da, { halten, niederlage, ...nBlatt });
      const nKnoepfe = await bedienbar(s, '.ergebnis-overlay.niederlage :is(.erg-knoepfe [data-ziel], .erg-zu, .erg-lobby, .gd-revanche)');
      const nZiele = nKnoepfe.filter(b => b.ok).map(b => b.ziel);
      // R7 (B13): "Revanche" ersetzt "Nochmal", ein Knopf fuer dasselbe statt zwei
      pruefe(`${g.name}: Niederlage-Blatt zeigt bedienbar "Zur Analyse", "Revanche", "Zu den Bots", "Brett ansehen" (ohne zweites "Nochmal")`,
        nZiele.includes('analyse') && !nZiele.includes('nochmal') && ['erg-zu', 'erg-lobby', 'gd-revanche'].every(c => nZiele.some(z => z.includes(c))), nKnoepfe);
      await s.locator('.ergebnis-overlay.niederlage .erg-knoepfe [data-ziel="analyse"]').click({ timeout: 5000 }).catch(() => {});
      const analyse = await klappt(s.waitForSelector('.screen.an-screen', { timeout: 15000 }));
      await warte(1000);
      await bild('08-analyse');
      pruefe(`${g.name}: "Zur Analyse" oeffnet die Analyse der Partie`, analyse, await s.evaluate(() => [...document.querySelectorAll('.screen')].map(e => e.className)));
    } catch (e) {
      await bild('abbruch');
      pruefe(`${g.name}: Ablauf ohne Abbruch`, false, e.stack);
    }
    pruefe(`${g.name}: keine Seitenfehler`, fehler.length === 0, fehler);
    await k.close().catch(() => {});
  }
} catch (e) { pruefe('Ablauf ohne Abbruch', false, e.stack); }
finally { await browser?.close(); await new Promise(r => server.close(r)); }
console.log(`\nBilder: ${BILDER}`);
console.log(`\n${ok}/${gesamt} bestanden`); process.exitCode = ok === gesamt ? 0 : 1;
