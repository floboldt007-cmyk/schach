// Knoepfe der Startseite (css/heim.css) in Ruhe, unter dem Zeiger, mit Fokus und gedrueckt (R17 heim-hover, 14.11.2026):
// jeder Text im Knopf mindestens 4,5:1 gegen seine Flaeche, unter dem Zeiger sichtbar anders als in Ruhe, mit Tastatur-Fokus
// ein Rahmen. Hell und dunkel, iPad hoch (820 x 1180, dort steht ohne Partie die Leiter) und PC (1440 x 900), ohne und mit
// laufender Partie (dann "Weiter" und die Zeile "Zurueck zur Partie"). Nur Geraete mit Zeiger (hasTouch aus): der Zeiger-
// Zustand steht in css/heim.css unter @media (hover: hover).
//
//   node tests/r17-heim-hover.test.mjs
//   PORT=8973 node tests/r17-heim-hover.test.mjs   eigener Port (Standard: frei)
//
// Playwright: Pfad per Umgebungsvariable PLAYWRIGHT_PFAD, sonst 'playwright' oder /opt/node-tools.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { browserTyp } from './browser.mjs';

const require = createRequire(import.meta.url);
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || await (await import('./freier-port.mjs')).freierPort();
const BASIS = `http://127.0.0.1:${PORT}/index.html?test`;
const P = 'schach-arena:v1:';
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

let ok = 0, gesamt = 0;
function pruefe(name, gut, detail = '') {
  gesamt++; if (gut) ok++;
  console.log(`${gut ? 'ok  ' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(detail)}`);
}

// wie tests/heim.test.mjs: laufende Partie gegen Greta nach zehn Halbzuegen
const ZUEGE = ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'g8f6', 'd2d3', 'f8c5', 'c2c3', 'd7d6'];
const laufend = { botId: 'greta', spielerFarbe: 'w', startFen: null, zuege: ZUEGE, hinweise: 0, zuruecknahmen: 0,
  liveKlassen: [], gestartet: new Date().toISOString(), modus: 'normal', extra: {} };

// Text eines Knopfs gegen seine Flaeche: jedes Element mit eigenem Text, Hintergrund = naechste deckende Flaeche nach oben
// (durchscheinende Schichten darueber gemischt), Aufhellung per filter am Knopf zaehlt mit. Dazu, was einen Zustand sichtbar
// macht (Flaeche, Schatten, filter, Rahmen).
const zustand = (s, sel) => s.evaluate((sel) => {
  const knopf = document.querySelector(sel);
  const farbe = (c) => { const p = (c.match(/rgba?\(([^)]+)\)/) || [, '0,0,0,0'])[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; };
  const ueber = (o, u) => [0, 1, 2].map((i) => o[i] * o[3] + u[i] * (1 - o[3])).concat(1);
  const lum = (f) => f.slice(0, 3).map((v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }).reduce((x, v, i) => x + v * [0.2126, 0.7152, 0.0722][i], 0);
  const kontrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const flaeche = (el) => {
    const schichten = [];
    for (let e = el; e; e = e.parentElement) {
      const f = farbe(getComputedStyle(e).backgroundColor);
      if (f[3] > 0) { schichten.push(f); if (f[3] >= 1) break; }
    }
    let u = [255, 255, 255, 1];
    for (const f of schichten.reverse()) u = ueber(f, u);
    return u;
  };
  const st = getComputedStyle(knopf);
  const hell = Number((/brightness\(([\d.]+)\)/.exec(st.filter) || [, 1])[1]);
  const auf = (f) => f.map((v, i) => (i < 3 ? Math.min(255, v * hell) : v));
  const texte = [knopf, ...knopf.querySelectorAll('*')].filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
    && e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden');
  let min = Infinity, schwach = '';
  for (const e of texte) {
    const g = flaeche(e);
    const k = kontrast(auf(ueber(farbe(getComputedStyle(e).color), g)), auf(g));
    if (k < min) { min = k; schwach = e.textContent.trim().slice(0, 24); }
  }
  return { kontrast: Math.round(min * 100) / 100, schwach, texte: texte.length,
    sicht: [st.backgroundColor, st.boxShadow, st.filter, st.transform].join(' | '),
    rahmen: st.outlineStyle !== 'none' && parseFloat(st.outlineWidth) > 0 };
}, sel);

async function vierZustaende(s, sel) {
  const erg = {};
  await s.mouse.move(1, 1); await warte(250);
  erg.ruhe = await zustand(s, sel);
  await s.locator(sel).hover(); await warte(350);
  erg.zeiger = await zustand(s, sel);
  await s.mouse.move(1, 1); await warte(250);
  // Tastatur-Fokus: erst eine Taste, dann focus(), damit :focus-visible gilt
  await s.keyboard.press('Shift'); await s.locator(sel).focus(); await warte(250);
  erg.fokus = await zustand(s, sel);
  await s.evaluate(() => document.activeElement?.blur());
  await s.locator(sel).hover(); await s.mouse.down(); await warte(250);
  erg.gedrueckt = await zustand(s, sel);
  await s.mouse.move(1, 1); await s.mouse.up(); await warte(250);
  return erg;
}

async function lauf(browser, { w, h, schema, mitPartie }) {
  const kontext = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: schema, deviceScaleFactor: 1,
    hasTouch: false, serviceWorkers: 'block' });
  const s = await kontext.newPage();
  const fehler = [];
  s.on('pageerror', (e) => fehler.push(e.message));
  // Tag des Willkommens wie im Paket start (Grenze 4:00), Sprache gewaehlt, keine Hinweise
  await s.addInitScript(({ P, laufend }) => {
    try {
      if (sessionStorage.getItem('hh-probe')) return;
      sessionStorage.setItem('hh-probe', '1');
      localStorage.clear();
      const d = new Date(); if (d.getHours() < 4) d.setDate(d.getDate() - 1);
      const z = (n) => String(n).padStart(2, '0');
      localStorage.setItem(P + 'modul:start', JSON.stringify({ gesehen: `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}` }));
      localStorage.setItem(P + 'einstellungen', JSON.stringify({ sprache: 'de', spracheGewaehlt: true }));
      localStorage.setItem(P + 'hinweis-installieren', '1');
      if (laufend) localStorage.setItem(P + 'laufend', JSON.stringify(laufend));
    } catch (e) { /* egal */ }
  }, { P, laufend: mitPartie ? laufend : null });
  await s.goto(BASIS + '#heim');
  await s.waitForSelector('.heim-los', { state: 'visible', timeout: 20000 });
  await warte(1200);
  const name = `${w} x ${h} ${schema === 'dark' ? 'dunkel' : 'hell'} ${mitPartie ? 'mit Partie' : 'ohne Partie'}`;
  // alle sichtbaren Knoepfe aus css/heim.css (jede Zeile, jeder Weg einzeln), markiert mit data-hh fuer eindeutige Selektoren
  const ziele = await s.evaluate(() => {
    const sichtbar = (e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden';
    const z = [];
    for (const k of ['heim-los', 'heim-zeile', 'heim-leiter-liste', 'heim-modus']) {
      for (const e of document.querySelectorAll('.' + k)) {
        if (!sichtbar(e)) continue;
        e.dataset.hh = String(z.length);
        z.push(`.${k}[data-hh="${e.dataset.hh}"]`);
      }
    }
    return z;
  });
  const erwartet = ['.heim-los', '.heim-modus'].concat(mitPartie ? ['.heim-zeile'] : w === 820 ? ['.heim-leiter-liste'] : []);
  pruefe(`${name}: alle Knopfarten da (${erwartet.join(', ')})`, erwartet.every((k) => ziele.some((z) => z.startsWith(k))), ziele);
  for (const sel of ziele) {
    await s.evaluate((sel) => document.querySelector(sel).scrollIntoView({ block: 'center' }), sel);
    await warte(200);
    const z = await vierZustaende(s, sel);
    const werte = Object.fromEntries(Object.entries(z).map(([k, v]) => [k, v.kontrast]));
    pruefe(`${name} ${sel}: Text in Ruhe, unter dem Zeiger, mit Fokus und gedrueckt mindestens 4,5:1`,
      z.ruhe.texte > 0 && Math.min(...Object.values(werte)) >= 4.5, { werte, schwach: z.ruhe.schwach });
    pruefe(`${name} ${sel}: unter dem Zeiger sichtbar anders als in Ruhe`, z.zeiger.sicht !== z.ruhe.sicht, { ruhe: z.ruhe.sicht, zeiger: z.zeiger.sicht });
    pruefe(`${name} ${sel}: mit Tastatur-Fokus ein Rahmen`, z.fokus.rahmen, z.fokus);
  }
  pruefe(`${name}: keine Seitenfehler`, fehler.length === 0, fehler);
  await kontext.close();
}

let pw;
try { pw = require(process.env.PLAYWRIGHT_PFAD || 'playwright'); } catch (e) { pw = require('/opt/node-tools/node_modules/playwright'); }
const server = spawn(process.execPath, ['tests/testserver.mjs', String(PORT), '--bind', '127.0.0.1'], { cwd: WURZEL, stdio: 'ignore' });
let browser = null;
try {
  for (let i = 0; i < 60; i++) { try { const r = await fetch(BASIS); await r.arrayBuffer(); if (r.ok) break; } catch (e) { /* noch nicht */ } await warte(150); }
  browser = await browserTyp(pw).launch({ headless: true });
  for (const [w, h] of [[820, 1180], [1440, 900]]) {
    for (const schema of ['light', 'dark']) {
      for (const mitPartie of [false, true]) await lauf(browser, { w, h, schema, mitPartie });
    }
  }
} catch (e) {
  pruefe('Lauf ohne Ausnahme', false, String(e && e.stack || e));
} finally {
  if (browser) await browser.close().catch(() => {});
  server.kill();
}
console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
