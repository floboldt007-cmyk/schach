// R19 Gruender-Paket (Auftrag e7 15.11.2026), Vorschau-Seite design/gruender/index.html im Browser gemessen:
//   je Modus (hell, dunkel) und Geraet (iPhone 13, PC): laedt ohne Seitenfehler, ohne Konsolenfehler, ohne Antwort >= 400;
//   je Teil (Rahmen, Finisher, Zeichen) drei Varianten, genau eine empfohlen und die steht zuerst; kein seitliches Rollen;
//   keine Preise und kein Kaufknopf; mit Bewegung laufen Schleifen, bei "Bewegung aus" (ruhig=1) und weniger Bewegung keine.
//
//   node tests/r19-gruender.test.mjs
//   BILDER=<ordner> node tests/r19-gruender.test.mjs   legt dazu Standbilder (PNG) und Videos (WEBM) fuer Flo ab
//
// Playwright: PLAYWRIGHT_PFAD, sonst 'playwright', sonst /opt/node-tools/node_modules/playwright.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { mkdirSync, renameSync } from 'node:fs';
import path from 'node:path';
import { browserTyp } from './browser.mjs';

const require = createRequire(import.meta.url);
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || await (await import('./freier-port.mjs')).freierPort();
const BASIS = `http://127.0.0.1:${PORT}/design/gruender/index.html`;
const BILDER = process.env.BILDER ? path.resolve(process.env.BILDER) : null;
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

let gesamt = 0, ok = 0;
function pruefe(name, gut, detail = '') {
  gesamt++; if (gut) ok++;
  const d = typeof detail === 'string' ? detail : JSON.stringify(detail);
  console.log(`${gut ? 'ok    ' : 'FEHLER'} ${name}${!gut && d ? ' (' + d.slice(0, 600) + ')' : ''}`);
}

const GERAETE = { iphone13: { width: 390, height: 844, dsf: 3, touch: true }, pc: { width: 1440, height: 900, dsf: 1, touch: false } };

async function oeffne(browser, { geraet, modus, suche = '', bewegung = 'no-preference', video = null }) {
  const g = GERAETE[geraet];
  const k = await browser.newContext({ viewport: { width: g.width, height: g.height }, deviceScaleFactor: video ? 1 : g.dsf, hasTouch: g.touch,
    colorScheme: modus === 'hell' ? 'light' : 'dark', reducedMotion: bewegung, serviceWorkers: 'block',
    ...(video ? { recordVideo: { dir: video, size: { width: g.width, height: g.height } } } : {}) });
  const s = await k.newPage();
  const fehler = [], konsole = [], kaputt = [];
  s.on('pageerror', (e) => fehler.push(e.message));
  s.on('console', (m) => { if (m.type() === 'error') konsole.push(m.text()); });
  s.on('response', (r) => { if (r.status() >= 400) kaputt.push(`${r.status()} ${r.url()}`); });
  s.on('requestfailed', (r) => kaputt.push(`fehlgeschlagen ${r.url()}`));
  await s.goto(`${BASIS}?modus=${modus}${suche}`);
  await s.waitForFunction(() => window.__gruender && window.__gruender.fertig, null, { timeout: 15000 });
  await s.evaluate(() => document.fonts.ready);
  await warte(400);
  return { k, s, fehler, konsole, kaputt };
}
// alle Animationen anhalten und auf denselben Zeitpunkt stellen: Krone gelandet, Kranz offen, Schild sichtbar
const halte = (s, ms = 1900) => s.evaluate((t) => { for (const a of document.getAnimations()) { a.pause(); a.currentTime = t; } }, ms);

let pw;
try { pw = require(process.env.PLAYWRIGHT_PFAD || 'playwright'); } catch (e) { pw = require('/opt/node-tools/node_modules/playwright'); }
const server = spawn(process.execPath, ['tests/testserver.mjs', String(PORT), '--bind', '127.0.0.1'], { cwd: WURZEL, stdio: 'ignore' });
const browser = await browserTyp(pw).launch({ headless: true });
try {
  for (let i = 0; i < 60; i++) { try { if ((await fetch(BASIS)).ok) break; } catch (e) { /* noch nicht */ } await warte(150); }
  if (BILDER) mkdirSync(BILDER, { recursive: true });

  for (const modus of ['dunkel', 'hell']) for (const geraet of Object.keys(GERAETE)) {
    const name = `${geraet} ${modus}`;
    const { k, s, fehler, konsole, kaputt } = await oeffne(browser, { geraet, modus });
    pruefe(`${name}: keine Seitenfehler, keine Konsolenfehler, nichts >= 400`, !fehler.length && !konsole.length && !kaputt.length, { fehler, konsole, kaputt });
    const m = await s.evaluate(() => {
      const teile = {};
      for (const t of ['rahmen', 'finisher', 'zeichen']) {
        const karten = [...document.querySelectorAll(`.gr-teil[data-teil="${t}"] .gr-karte`)];
        teile[t] = { n: karten.length, empfohlen: karten.filter((x) => x.classList.contains('ist-empfohlen')).length,
          erste: karten[0] && karten[0].classList.contains('ist-empfohlen') && !!karten[0].querySelector('.pm-plan-schild') };
      }
      const text = document.body.innerText;
      const schleifen = document.getAnimations().filter((a) => a.playState === 'running' && a.effect.getComputedTiming().iterations === Infinity).length;
      return { teile, breit: document.scrollingElement.scrollWidth - innerWidth, stufen: document.querySelectorAll('.gr-stufe').length,
        preis: /€|\bEUR\b|Preis|kaufen|Kaufen|Abo\b/.test(text), schleifen, modus: document.documentElement.dataset.modus,
        leer: [...document.querySelectorAll('.gr-profil svg, .gr-av svg, .gf-brett')].filter((e) => !e.getBoundingClientRect().width).length };
    });
    for (const [t, v] of Object.entries(m.teile)) pruefe(`${name}: ${t} hat 3 Varianten, genau eine empfohlen, sie steht zuerst`, v.n === 3 && v.empfohlen === 1 && v.erste, v);
    pruefe(`${name}: Steigerung zeigt erspielt, Premium, Gruender`, m.stufen === 3, m);
    pruefe(`${name}: kein seitliches Rollen`, m.breit <= 0, m);
    pruefe(`${name}: kein Preis, kein Kaufknopf, kein Abo-Text`, !m.preis, m);
    pruefe(`${name}: Modus ${modus} gesetzt`, m.modus === modus, m);
    pruefe(`${name}: jedes Bild hat Groesse`, m.leer === 0, m);
    pruefe(`${name}: mit Bewegung laufen Schleifen (Rahmen, Siegel, Finisher)`, m.schleifen >= 20, m);
    if (BILDER) {
      await halte(s);
      await s.screenshot({ path: path.join(BILDER, `uebersicht-${geraet}-${modus}.png`), fullPage: true });
      for (const teil of ['steigerung', 'rahmen', 'finisher', 'zeichen']) {
        await s.goto(`${BASIS}?modus=${modus}&nur=${teil}`);
        await s.waitForFunction(() => window.__gruender && window.__gruender.fertig);
        await s.evaluate(() => document.fonts.ready); await warte(300); await halte(s);
        await s.screenshot({ path: path.join(BILDER, `${teil}-${geraet}-${modus}.png`), fullPage: true });
      }
    }
    await k.close();
  }

  // Standbild: "Bewegung aus" der App (ruhig=1) und "weniger Bewegung" des Geraets
  for (const [art, opt] of [['Bewegung aus', { suche: '&ruhig=1' }], ['weniger Bewegung', { bewegung: 'reduce' }]]) {
    const { k, s, fehler } = await oeffne(browser, { geraet: 'pc', modus: 'dunkel', ...opt });
    await warte(300);
    const m = await s.evaluate(() => ({
      schleifen: document.getAnimations().filter((a) => a.playState === 'running' && a.effect.getComputedTiming().iterations === Infinity).length,
      krone: getComputedStyle(document.querySelector('.gf-kroenung .gf-krone')).opacity,
      schild: getComputedStyle(document.querySelector('.gf-kroenung .gf-schild')).opacity }));
    pruefe(`${art}: keine laufende Schleife, Finisher als Standbild (Krone und Schild sichtbar)`, !fehler.length && m.schleifen === 0 && m.krone === '1' && m.schild === '1', { m, fehler });
    if (BILDER && art === 'Bewegung aus') await s.screenshot({ path: path.join(BILDER, 'standbild-bewegung-aus-pc-dunkel.png'), fullPage: true });
    await k.close();
  }

  // Videos fuer Flo: Rahmen und Finisher in Bewegung, je 2 Schleifen
  if (BILDER) {
    const roh = path.join(BILDER, 'roh'); mkdirSync(roh, { recursive: true });
    for (const [teil, geraet, modus] of [['finisher', 'pc', 'dunkel'], ['rahmen', 'pc', 'dunkel'], ['zeichen', 'pc', 'dunkel'],
      ['finisher', 'iphone13', 'dunkel'], ['rahmen', 'iphone13', 'hell']]) {
      const { k, s } = await oeffne(browser, { geraet, modus, suche: `&nur=${teil}`, video: roh });
      await warte(10500);
      const v = s.video(); await k.close();
      renameSync(await v.path(), path.join(BILDER, `video-${teil}-${geraet}-${modus}.webm`));
    }
  }
} finally {
  await browser.close(); server.kill();
}
console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
