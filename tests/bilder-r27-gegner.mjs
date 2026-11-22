// Probebilder R27 (Flo 22.11.2026): Gegner-Karte der Startseite und Standardbrett heute/warm, auf iPhone 13, iPad quer
// und PC, je hell und dunkel. Kein Test, nur Bilder fuer die Auswahlseite.
//
//   BILD_ART=gegner BILD_NAME=nachher BILD_ZIEL=<ordner> node tests/bilder-r27-gegner.mjs
//   BILD_ART=brett  BILD_ZIEL=<ordner> node tests/bilder-r27-gegner.mjs      (heute und warm aus diesem Baum)
//   BILD_WURZEL=<anderer baum>   liefert die App aus einem anderen Arbeitsbaum aus (fuer "vorher")
//
// Playwright: Pfad per Umgebungsvariable PLAYWRIGHT_PFAD, sonst 'playwright' oder /opt/node-tools.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { browserTyp } from './browser.mjs';

const require = createRequire(import.meta.url);
const HIER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WURZEL = path.resolve(process.env.BILD_WURZEL || HIER);
const ZIEL = path.resolve(process.env.BILD_ZIEL || path.join(HIER, 'bilder-r27'));
const ART = process.env.BILD_ART || 'gegner';
const PORT = Number(process.env.PORT) || await (await import('./freier-port.mjs')).freierPort();
const BASIS = `http://127.0.0.1:${PORT}/index.html`;
const P = 'schach-arena:v1:';
const warte = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(ZIEL, { recursive: true });

const GERAETE = [
  { name: 'iphone13', w: 390, h: 844, dpr: 3, touch: true },
  { name: 'ipad-quer', w: 1180, h: 820, dpr: 2, touch: true },
  { name: 'pc', w: 1440, h: 900, dpr: 1, touch: false },
];
// laufende Partie (wie tests/heim.test.mjs), damit ein Brett zu sehen ist
const ZUEGE = ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'g8f6', 'd2d3', 'f8c5', 'c2c3', 'd7d6'];
const LAUFEND = { botId: 'greta', spielerFarbe: 'w', startFen: null, zuege: ZUEGE, hinweise: 0, zuruecknahmen: 0,
  liveKlassen: [], gestartet: new Date().toISOString(), modus: 'normal', extra: {} };

async function bild(browser, g, schema, { suche, laufend, datei, partie = false }) {
  const kontext = await browser.newContext({ viewport: { width: g.w, height: g.h }, deviceScaleFactor: g.dpr, colorScheme: schema,
    hasTouch: g.touch, isMobile: g.touch && g.w < 600, serviceWorkers: 'block' });
  const s = await kontext.newPage();
  await s.addInitScript(({ P, laufend }) => {
    if (!location.protocol.startsWith('http') || sessionStorage.getItem('bild')) return;
    sessionStorage.setItem('bild', '1');
    localStorage.clear();
    const d = new Date(); if (d.getHours() < 4) d.setDate(d.getDate() - 1);
    const z = (n) => String(n).padStart(2, '0');
    localStorage.setItem(P + 'modul:start', JSON.stringify({ gesehen: `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}` }));
    localStorage.setItem(P + 'einstellungen', JSON.stringify({ sprache: 'de', spracheGewaehlt: true }));
    localStorage.setItem(P + 'hinweis-installieren', '1');
    if (laufend) localStorage.setItem(P + 'laufend', JSON.stringify(laufend));
  }, { P, laufend });
  await s.goto(BASIS + suche + '#heim');
  await s.waitForSelector('.heim-los', { state: 'visible', timeout: 20000 });
  await warte(1200);
  if (partie) {
    await s.click('.heim-los');
    await s.waitForSelector('.brett', { state: 'visible', timeout: 20000 });
    await warte(1500);
  }
  await s.screenshot({ path: path.join(ZIEL, datei) });
  await kontext.close();
  console.log('bild', datei);
}

let pw;
try { pw = require(process.env.PLAYWRIGHT_PFAD || 'playwright'); } catch (e) { pw = require('/opt/node-tools/node_modules/playwright'); }
const server = spawn(process.execPath, [path.join(HIER, 'tests', 'testserver.mjs'), String(PORT), '--bind', '127.0.0.1'], { cwd: WURZEL, stdio: 'ignore' });
let browser = null, fehler = 0;
try {
  let bereit = false;
  for (let i = 0; i < 60 && !bereit; i++) {
    try { const r = await fetch(BASIS); await r.arrayBuffer(); bereit = r.ok; } catch (e) { /* Server startet noch */ }
    if (!bereit) await warte(150);
  }
  if (!bereit) throw new Error('Testserver nicht erreichbar');
  browser = await browserTyp(pw).launch({ headless: true });
  for (const g of GERAETE) {
    for (const schema of ['light', 'dark']) {
      const m = schema === 'dark' ? 'dunkel' : 'hell';
      if (ART === 'gegner') {
        await bild(browser, g, schema, { suche: '?test', laufend: null, datei: `${process.env.BILD_NAME || 'nachher'}-${g.name}-${m}.png` });
      } else {
        for (const [name, suche] of [['heute', '?test'], ['warm', '?test&design=brett-warm']]) {
          await bild(browser, g, schema, { suche, laufend: LAUFEND, partie: true, datei: `${name}-${g.name}-${m}.png` });
        }
      }
    }
  }
} catch (e) {
  fehler = 1;
  console.error(String(e && e.stack || e));
} finally {
  if (browser) await browser.close().catch(() => {});
  server.kill();
}
process.exit(fehler);
