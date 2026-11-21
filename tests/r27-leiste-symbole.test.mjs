// Design-Probe Leiste R27 (R19-Auswahl leiste-symbole-r27, NICHT live): Reiter-Symbole im Stil des Premium-Wappens
// (js/ui/icons.js kronSymbol, css/navigation.css "Design-Probe Leiste R27") NUR hinter ?test&design=k1|k2|k3.
// Geprueft: ohne Schalter und ohne ?test bleibt die Leiste wie heute (Spiel-Symbole), mit Schalter traegt jeder Reiter das
// Wappen-Symbol, die Variante zeigt genau ihre Teile (k1 Funkel am aktiven, k2 Scheibe an allen und Kranz am aktiven,
// k3 Kranz nur am aktiven), die Figur ist mit dem Gold-Verlauf gefuellt, keine Seitenfehler.
//   node tests/r27-leiste-symbole.test.mjs            (BROWSER=webkit fuer Safari)
// Playwright: PLAYWRIGHT_PFAD, sonst 'playwright', sonst /opt/node-tools/node_modules/playwright.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { browserTyp } from './browser.mjs';

const require = createRequire(import.meta.url);
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || await (await import('./freier-port.mjs')).freierPort();
let pw;
for (const p of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
  try { pw = require(p); break; } catch (e) { /* naechster */ }
}
if (!pw) throw new Error('Playwright fehlt (PLAYWRIGHT_PFAD setzen)');
const warte = (ms) => new Promise((r) => setTimeout(r, ms));
let ok = 0, fehler = 0;
function pruefe(name, gut, detail) {
  if (gut) ok++; else fehler++;
  console.log(`${gut ? 'ok    ' : 'FEHLER'} ${name}${!gut && detail !== undefined ? ' ' + JSON.stringify(detail) : ''}`);
}

async function lage(browser, { suche, breite = 390, hoehe = 844, modus = 'dunkel' }) {
  const k = await browser.newContext({ viewport: { width: breite, height: hoehe }, locale: 'de-DE' });
  await k.addInitScript((m) => {
    localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ klang: false, bewegung: 'aus', modus: m }));
  }, modus);
  const s = await k.newPage();
  const fehlerListe = [];
  s.on('pageerror', (e) => fehlerListe.push(e.message));
  await s.goto(`http://127.0.0.1:${PORT}/index.html${suche}#heim`);
  await s.waitForSelector('.reiter-leiste:not([hidden]) .reiter', { timeout: 20000 });
  await warte(400);
  const l = await s.evaluate(() => {
    const sicht = (e) => !!e && getComputedStyle(e).display !== 'none';
    const reiter = [...document.querySelectorAll('.reiter-leiste .reiter')].map((r) => {
      const kj = r.querySelector(':scope > .kj');
      const figur = kj && kj.querySelector('.kj-figur .kj-gold');
      return { an: r.classList.contains('an'), sy: !!r.querySelector(':scope > .sy'), kj: !!kj,
        scheibe: !!kj && sicht(kj.querySelector('.kj-scheibe')), kranz: !!kj && sicht(kj.querySelector('.kj-strahlen')),
        funkel: !!kj && sicht(kj.querySelector('.kj-funkel')), verlauf: figur ? /url\(/.test(getComputedStyle(figur).fill) : false,
        breite: kj ? Math.round(kj.getBoundingClientRect().width) : 0 };
    });
    return { design: document.documentElement.dataset.designLeiste || null, reiter };
  });
  await k.close();
  return { ...l, fehlerListe };
}

const server = spawn(process.execPath, ['tests/testserver.mjs', String(PORT), '--bind', '127.0.0.1'], { cwd: WURZEL, stdio: 'ignore' });
let browser;
try {
  const ende = Date.now() + 10000;
  for (;;) {
    try { const r = await fetch(`http://127.0.0.1:${PORT}/index.html`); await r.arrayBuffer(); if (r.ok) break; } catch (e) { /* noch nicht da */ }
    if (Date.now() > ende) throw new Error('Server startet nicht');
    await warte(150);
  }
  browser = await browserTyp(pw).launch({ headless: true });

  // ohne Schalter, ohne Testmodus und mit unbekanntem Wert: Leiste wie heute
  for (const suche of ['?test', '?design=k1', '?test&design=w1b', '?test&design=k9']) {
    const l = await lage(browser, { suche });
    pruefe(`${suche}: kein Schalter, jeder Reiter mit Spiel-Symbol, kein Wappen-Symbol`, l.design === null && l.reiter.length === 4
      && l.reiter.every((r) => r.sy && !r.kj), l);
    pruefe(`${suche}: keine Seitenfehler`, l.fehlerListe.length === 0, l.fehlerListe);
  }

  const soll = {
    k1: (r) => !r.scheibe && !r.kranz && r.funkel === r.an,
    k2: (r) => r.scheibe && r.kranz === r.an && !r.funkel,
    k3: (r) => !r.scheibe && r.kranz === r.an && r.funkel === r.an,
  };
  for (const v of ['k1', 'k2', 'k3']) for (const [breite, hoehe, geraet] of [[390, 844, 'iPhone'], [1280, 800, 'PC']]) for (const modus of ['hell', 'dunkel']) {
    const wer = `${v} ${geraet} ${modus}`;
    const l = await lage(browser, { suche: `?test&design=${v}`, breite, hoehe, modus });
    pruefe(`${wer}: Schalter gesetzt, vier Reiter mit Wappen-Symbol statt Spiel-Symbol`, l.design === v && l.reiter.length === 4
      && l.reiter.every((r) => r.kj && !r.sy), l);
    pruefe(`${wer}: genau ein aktiver Reiter (Start)`, l.reiter.filter((r) => r.an).length === 1 && l.reiter[0].an, l.reiter);
    pruefe(`${wer}: Teile der Variante (Scheibe, Kranz, Funkel) wie vorgesehen`, l.reiter.every(soll[v]), l.reiter);
    pruefe(`${wer}: Figur mit Gold-Verlauf gefuellt, Symbol 28 bis 34 px`, l.reiter.every((r) => r.verlauf && r.breite >= 28 && r.breite <= 37), l.reiter);
    pruefe(`${wer}: keine Seitenfehler`, l.fehlerListe.length === 0, l.fehlerListe);
  }
} finally {
  if (browser) await browser.close();
  server.kill();
}
console.log(`\n${ok}/${ok + fehler} Pruefungen bestanden`);
process.exit(fehler === 0 && ok > 0 ? 0 : 1);
