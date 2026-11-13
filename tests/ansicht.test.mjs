// Ansichts-Pruefung (Flo 30.10.2026: "Die Ansicht ist sehr wichtig ... nichts zu klein, nichts zu gross, nichts
// verbuggt"): jeder Hauptbildschirm der echten App (index.html?test, mit allen PAKETE) in sieben Groessen, vom
// kleinen Handy bis zum PC. Geprueft wird, was man sieht:
//   - nichts laeuft seitlich aus der Seite (kein waagrechtes Scrollen, kein Element ueber den Rand)
//   - Schrift nie unter 12 px (Brett-Koordinaten und die Zahl im Bewertungsbalken: 10 px)
//   - jeder Knopf, Link und jedes Feld mindestens 44 x 44 px Trefferflaeche (Apple HIG; ::before/::after mit
//     negativem Abstand zaehlt mit)
//   - keine zwei Bedienelemente uebereinander (die verschiebbare Weltkarte ausgenommen)
//   - kein Text abgeschnitten (ohne Auslassungspunkte)
//   - ganz nach unten gescrollt liegt nichts Bedienbares unter der Reiter-Leiste oder der klebenden Spielen-Flaeche
//   - keine Skriptfehler
//
//   node tests/ansicht.test.mjs                    alles
//   node tests/ansicht.test.mjs --nur=arena,ich    nur diese Ziele
//   BILDER=/pfad node tests/ansicht.test.mjs       dazu je Ziel und Groesse ein Foto (fuer Flo)
//   KONTRAST=1 node tests/ansicht.test.mjs         dazu je Ziel die Kontrast-Befunde als INFO (zaehlt nicht, Feinschliff R9)
//   PORT=8961 node tests/ansicht.test.mjs          eigener Port (Standard: frei)
//
// Playwright: Pfad per Umgebungsvariable PLAYWRIGHT_PFAD, sonst 'playwright' oder /opt/node-tools.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { browserTyp } from './browser.mjs';
import { befundeDerSeite, untenFrei, kontrastBefunde } from './ansicht-befunde.mjs';

const require = createRequire(import.meta.url);
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || await (await import('./freier-port.mjs')).freierPort();
const BASIS = `http://127.0.0.1:${PORT}/index.html?test#arena`;
const BILDER = process.env.BILDER ? path.join(process.env.BILDER, 'ansicht') : '';
if (BILDER) mkdirSync(BILDER, { recursive: true });
const nurArg = process.argv.find((a) => a.startsWith('--nur='));
const NUR = nurArg ? nurArg.slice(6).split(',') : null;
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

export const GROESSEN = [['handy-klein', 375, 667], ['handy', 390, 844], ['handy-quer', 667, 375], ['ipad-hoch', 820, 1180], ['ipad-quer', 1180, 820],
  // iPad quer im Browser mit Leisten (Flos Foto 30.10.: 1000 x 590 nutzbar)
  ['ipad-browser', 1000, 590], ['pc', 1440, 900]];
export const ZIELE = [
  ['heim', 'heim', {}], ['arena', 'arena', {}], ['partie', 'partie', { botId: 'benno' }], ['zuzweit', 'partie', { modus: 'zuzweit' }],
  ['verlauf', 'verlauf', {}], ['einstellungen', 'einstellungen', {}], ['training', 'training', {}],
  ['bestenliste-ich', 'bestenliste', { reiter: 'ich' }], ['bestenliste-bots', 'bestenliste', { reiter: 'bots' }],
  ['bestenliste-freunde', 'bestenliste', { reiter: 'freunde' }], ['ich', 'ich', {}], ['start', 'start', {}],
];

function ladePlaywright() {
  for (const k of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
    try { return require(k); } catch (e) { /* naechster */ }
  }
  throw new Error('Playwright nicht gefunden (PLAYWRIGHT_PFAD setzen)');
}
async function warteAufServer(url, ms = 10000) {
  const ende = Date.now() + ms;
  while (Date.now() < ende) {
    try { const r = await fetch(url); await r.arrayBuffer(); if (r.ok) return; } catch (e) { /* noch nicht da */ }
    await warte(150);
  }
  throw new Error('Server startet nicht: ' + url);
}

const ergebnisse = [];
function pruefe(name, ok, detail = '') {
  ergebnisse.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'ok  ' : 'FEHLER'} ${name}${!ok && detail ? ' (' + detail + ')' : ''}`);
}

// Befunde und "unten frei": tests/ansicht-befunde.mjs (dort an festen Probe-Seiten geprueft)

const server = spawn(process.execPath, ['tests/testserver.mjs', String(PORT), '--bind', '127.0.0.1'], { cwd: WURZEL, stdio: 'ignore' });
let browser;
try {
  await warteAufServer(BASIS.replace(/#.*$/, ''));
  browser = await browserTyp(ladePlaywright()).launch();
  for (const [gname, w, h] of GROESSEN) {
    const k = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, serviceWorkers: 'block',
      timezoneId: 'Europe/Berlin', locale: 'de-DE', hasTouch: w < 1300 });
    const s = await k.newPage();
    const fehler = [];
    s.on('pageerror', (e) => fehler.push(e.message));
    await s.goto(BASIS);
    await s.waitForFunction(() => !!window.__app && !!document.documentElement.dataset.screen, null, { timeout: 30000 });
    await warte(1200);
    for (const [ziel, screen, params] of ZIELE) {
      if (NUR && !NUR.includes(ziel)) continue;
      await s.evaluate(([n, p]) => window.__app.gehe(n, p), [screen, params]);
      await warte(screen === 'partie' ? 3000 : 1200);
      const b = await s.evaluate(befundeDerSeite);
      b.unten = await s.evaluate(untenFrei);
      if (process.env.KONTRAST) {
        const kb = await kontrastBefunde(s);
        console.log(`INFO Kontrast ${ziel} @ ${gname}: ${kb.befunde.length} Befunde, ${kb.pixel} per Pixel, ${kb.unklar.length} unklar, ${kb.gemessen} Texte`
          + (kb.befunde.length ? ' ' + JSON.stringify(kb.befunde.slice(0, 4)) : ''));
      }
      const name = `${ziel} @ ${gname} (${w}x${h})`;
      pruefe(`${name}: nichts laeuft seitlich raus`, b.ueberlauf <= 1 && !b.rand.length, b.rand.slice(0, 3).join('; ') || `+${b.ueberlauf}px`);
      pruefe(`${name}: Schrift ab 12 px`, !b.klein.length, b.klein.slice(0, 3).join('; '));
      pruefe(`${name}: Knoepfe ab 44 px`, !b.knopf.length, b.knopf.slice(0, 3).join('; '));
      pruefe(`${name}: keine Ueberlappung`, !b.ueberlapp.length, b.ueberlapp.slice(0, 3).join('; '));
      pruefe(`${name}: nichts abgeschnitten`, !b.abgeschnitten.length, b.abgeschnitten.slice(0, 3).join('; '));
      pruefe(`${name}: alles erreichbar (nichts unten abgeschnitten ohne Scrollen)`, !b.gekappt.length, b.gekappt.slice(0, 3).join('; '));
      pruefe(`${name}: unten frei`, !b.unten.length, b.unten.slice(0, 3).join('; '));
      pruefe(`${name}: keine Skriptfehler`, !fehler.length, fehler.splice(0).slice(0, 2).join('; '));
      if (BILDER) await s.screenshot({ path: path.join(BILDER, `${ziel}-${gname}.png`) });
    }
    await k.close();
  }
} catch (e) {
  pruefe('Ansichts-Pruefung laeuft durch', false, e.message);
} finally {
  if (browser) await browser.close();
  server.kill();
}
const fehlend = ergebnisse.filter((e) => !e.ok);
console.log(`\n${ergebnisse.length - fehlend.length}/${ergebnisse.length} bestanden`);
if (fehlend.length) { console.log('FEHLER: ' + fehlend.map((e) => e.name).join(' | ')); process.exit(1); }
