// Design-Probe Leiste neu R27 (R19-Auswahl leiste-neu-r27, NICHT live): drei Richtungen der Reiter-Leiste
// (css/navigation.css "Design-Probe Leiste neu R27") NUR hinter ?test&design=l1|l2|l3 (Probe-Schalter in js/app.js).
// Geprueft: ohne Schalter, ohne ?test und mit fremdem Wert bleibt die Leiste wie heute (Spiel-Symbole, Pille, Glas);
// mit Schalter traegt jeder Reiter das Masken-Symbol der Richtung statt des Spiel-Symbols, die Pille ist weg, genau ein
// Reiter ist aktiv, jede Richtung zeigt ihre Markierung (l1 massive Figur, l2 Feld-Ecken, l3 Goldfeld auf der Kante),
// Symbole und Namen haben gegen den Grund der Leiste mindestens 3:1 bzw. 4,5:1, bei "Bewegung aus" laeuft nichts, keine Seitenfehler.
//   node tests/r27-leiste-neu.test.mjs            (BROWSER=webkit fuer Safari)
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
    const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
    // color-mix() liefert color(srgb 0..1), rgb() 0..255
    const farbe = (t) => { const s = /^color\(srgb /.test(t) ? 255 : 1; const m = (t.match(/[\d.]+/g) || [0, 0, 0]).map(Number); return { r: m[0] * s, g: m[1] * s, b: m[2] * s, a: m.length > 3 ? m[3] : 1 }; };
    const L = (f) => 0.2126 * lin(f.r) + 0.7152 * lin(f.g) + 0.0722 * lin(f.b);
    const kr = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    const nav = document.querySelector('.reiter-leiste');
    const ns = getComputedStyle(nav);
    const grund = farbe(ns.backgroundColor);
    const pille = nav.querySelector('.reiter-pille');
    const reiter = [...nav.querySelectorAll('.reiter')].map((r) => {
      const vor = getComputedStyle(r, '::before');
      const nach = getComputedStyle(r, '::after');
      const sy = r.querySelector(':scope > .sy');
      const maske = vor.maskImage || vor.webkitMaskImage || 'none';
      return { name: r.dataset.reiter, an: r.classList.contains('an'), sy: !!sy && getComputedStyle(sy).display !== 'none',
        maske: maske !== 'none' && /url\(/.test(maske) ? maske.length + ':' + maske.slice(-40) : null,
        symbol: Math.round(kr(farbe(vor.backgroundColor), grund) * 10) / 10, schrift: Math.round(kr(farbe(getComputedStyle(r).color), grund) * 10) / 10,
        ecken: /gradient/.test(nach.backgroundImage) && nach.content !== 'none', feld: nach.content !== 'none' && nach.height === '3px',
        uebergang: vor.transitionDuration };
    });
    return { lage: nav.dataset.lage, design: document.documentElement.dataset.design || '', grundDeckend: grund.a === 1,
      glas: (ns.backdropFilter || ns.webkitBackdropFilter || 'none') !== 'none', pille: !!pille && getComputedStyle(pille).display !== 'none', reiter };
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

  // ohne Schalter, ohne Testmodus und mit fremdem Wert: Leiste wie heute
  for (const suche of ['?test', '?design=l1', '?test&design=k1', '?test&design=l9']) for (const breite of [390, 1280]) {
    const l = await lage(browser, { suche, breite, hoehe: breite > 1000 ? 800 : 844 });
    pruefe(`${suche} ${breite}: Leiste wie heute (Spiel-Symbole, Pille, Glas, keine Maske)`, l.reiter.length === 4
      && l.reiter.every((r) => r.sy && !r.maske && !r.ecken) && l.pille && l.glas, l);
    pruefe(`${suche} ${breite}: keine Seitenfehler`, l.fehlerListe.length === 0, l.fehlerListe);
  }

  for (const v of ['l1', 'l2', 'l3']) for (const [breite, hoehe, geraet, sollLage] of [[390, 844, 'iPhone', 'unten'], [1280, 800, 'PC', 'seite']]) for (const modus of ['hell', 'dunkel']) {
    const wer = `${v} ${geraet} ${modus}`;
    const l = await lage(browser, { suche: `?test&design=${v}`, breite, hoehe, modus });
    pruefe(`${wer}: Schalter gesetzt, Lage ${sollLage}`, l.design.split(' ').includes(v) && l.lage === sollLage, { design: l.design, lage: l.lage });
    pruefe(`${wer}: vier Reiter mit Masken-Symbol statt Spiel-Symbol, keine Pille, kein Glas, Grund deckend`, l.reiter.length === 4
      && l.reiter.every((r) => r.maske && !r.sy) && !l.pille && !l.glas && l.grundDeckend, l);
    const an = l.reiter.filter((r) => r.an);
    pruefe(`${wer}: genau ein aktiver Reiter (Start)`, an.length === 1 && l.reiter[0].an, l.reiter);
    pruefe(`${wer}: Symbole mindestens 3:1, Namen mindestens 4,5:1 gegen die Leiste`, l.reiter.every((r) => r.symbol >= 3 && r.schrift >= 4.5),
      l.reiter.map((r) => [r.name, r.symbol, r.schrift]));
    const aus = l.reiter.filter((r) => !r.an);
    const markierung = {
      l1: an[0].maske !== aus[0].maske && aus.every((r) => !r.ecken && !r.feld),   // aktiv massiv, inaktiv Umriss
      l2: an[0].ecken && aus.every((r) => !r.ecken),                               // Feld-Ecken nur am aktiven
      l3: sollLage === 'unten' ? an[0].feld && aus.every((r) => !r.feld) : aus.every((r) => !r.ecken),
    };
    pruefe(`${wer}: Markierung der Richtung nur am aktiven Reiter`, markierung[v], l.reiter);
    pruefe(`${wer}: Bewegung aus, kein Uebergang am Symbol`, l.reiter.every((r) => /^0s(, 0s)*$/.test(r.uebergang)), l.reiter.map((r) => r.uebergang));
    pruefe(`${wer}: keine Seitenfehler`, l.fehlerListe.length === 0, l.fehlerListe);
  }
} finally {
  if (browser) await browser.close();
  server.kill();
}
console.log(`\n${ok}/${ok + fehler} Pruefungen bestanden`);
process.exit(fehler === 0 && ok > 0 ? 0 : 1);
