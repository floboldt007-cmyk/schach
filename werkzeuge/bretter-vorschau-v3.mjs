// Bilder und Auswahl-Liste der 20 Motiv-Bretter, Fassung 3 (Flo 14.11.2026: Fassung 2 "zu brav", mutige Motive).
//   node werkzeuge/bretter-vorschau-v3.mjs --ziel "<Vault-Ordner>"
// Schreibt in den Ziel-Ordner: uebersicht.png (alle 20), einzeln/<nr>-<id>.png (iPhone-Breite 390, dreifache Pixeldichte,
// echte Stellung mit letztem Zug, Rahmen und Koordinaten) und Bretter-Auswahl.md (Liste zum Streichen, mit Seltenheit, Weg
// und am echten Brett gemessenem Kontrast). Braucht Playwright (PLAYWRIGHT_PFAD) und liefert das Repo selbst aus
// (tests/testserver.mjs). Schreibt nichts ins Repo.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { wegText } from './bretter-katalog.mjs';
import { WELTEN } from '../js/bots.js';
import { MOTIVE } from '../js/brett-motive.js';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const i = process.argv.indexOf('--ziel');
const ZIEL = i > 0 ? process.argv[i + 1] : null;
if (!ZIEL) { console.error('--ziel "<Ordner>" fehlt'); process.exit(2); }
mkdirSync(path.join(ZIEL, 'einzeln'), { recursive: true });

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PFAD || 'playwright');
const PORT = await (await import('../tests/freier-port.mjs')).freierPort();
const server = spawn(process.execPath, [path.join(WURZEL, 'tests/testserver.mjs'), String(PORT)], { cwd: WURZEL, stdio: 'ignore' });
const basis = `http://127.0.0.1:${PORT}/werkzeuge/bretter-vorschau-v3.html`;
const SELTEN = { selten: 'Selten', episch: 'Episch', legende: 'Legende' };
const weltName = (n) => (WELTEN.find((w) => w.nr === n) || {}).name || 'Welt ' + n;
const BODEN = { feld: 2.2, weissAufDunkel: 3.0, schwarzAufDunkel: 3.0, schwarzAufHell: 7.0 };
const datei = (m, n) => `einzeln/${String(n + 1).padStart(2, '0')}-${m.id}.png`;
let fehler = 0;
try {
  for (let v = 0; v < 50; v++) { try { await fetch(basis); break; } catch (e) { await new Promise((r) => setTimeout(r, 100)); } }
  const browser = await chromium.launch();
  const neu = async (opt) => { const p = await browser.newPage(opt); p.on('pageerror', (e) => { fehler++; console.error('Seitenfehler', e.message); }); return p; };
  const fertig = (p) => p.waitForFunction(() => window.vorschauFertig === true && [...document.images].every((b) => b.complete && b.naturalWidth > 0), null, { timeout: 30000 });

  const u = await neu({ viewport: { width: 1360, height: 900 }, deviceScaleFactor: 1 });
  await u.goto(basis);
  await fertig(u);
  // Glanz auf den Rahmen anhalten, damit jedes Bild gleich aussieht
  await u.evaluate(() => document.getAnimations().forEach((a) => { a.pause(); a.currentTime = 4500; }));
  await u.screenshot({ path: path.join(ZIEL, 'uebersicht.png'), fullPage: true });

  const e = await neu({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
  for (const [n, m] of MOTIVE.entries()) {
    await e.goto(`${basis}?brett=${m.id}`);
    await fertig(e);
    await e.evaluate(() => document.getAnimations().forEach((a) => { a.pause(); a.currentTime = 4500; }));
    await e.locator('main').screenshot({ path: path.join(ZIEL, datei(m, n)) });
  }

  // Kontrast am echten Brett: nur Felder, 400 px, je Feld ohne den aeussersten Pixel, 0,5-%-Quantil (wie tests/bretter-v3.test.mjs)
  const s = await neu({ viewport: { width: 420, height: 520 }, deviceScaleFactor: 1 });
  const mass = new Map();
  for (const m of MOTIVE) {
    await s.goto(`${basis}?brett=${m.id}&nur=felder`);
    await fertig(s);
    const r = await s.locator('.brett').boundingBox();
    const foto = (await s.screenshot({ clip: { x: Math.round(r.x), y: Math.round(r.y), width: 400, height: 400 } })).toString('base64');
    mass.set(m.id, await s.evaluate(async (foto) => {
      const lum = (R, G, B) => [R, G, B].map((v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; })
        .reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
      const k = (x, y) => (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
      const bild = new Image(); await new Promise((ok, f) => { bild.onload = ok; bild.onerror = f; bild.src = 'data:image/png;base64,' + foto; });
      const c = document.createElement('canvas'); c.width = 400; c.height = 400; const x = c.getContext('2d'); x.drawImage(bild, 0, 0);
      const d = x.getImageData(0, 0, 400, 400).data;
      const werte = (par) => {
        const L = [];
        for (let py = 0; py < 400; py++) for (let px = 0; px < 400; px++) {
          if ((Math.floor(px / 50) + Math.floor(py / 50)) % 2 !== par || px % 50 === 0 || py % 50 === 0 || px % 50 === 49 || py % 50 === 49) continue;
          const i = (py * 400 + px) * 4; L.push(lum(d[i], d[i + 1], d[i + 2]));
        }
        L.sort((a, b) => a - b);
        return { lo: L[Math.round(0.005 * (L.length - 1))], hi: L[Math.round(0.995 * (L.length - 1))] };
      };
      const H = werte(0), D = werte(1);
      return { feld: k(H.lo, D.hi), weissAufDunkel: k(1, D.hi), schwarzAufDunkel: k(0, D.lo), schwarzAufHell: k(0, H.lo) };
    }, foto));
  }
  await browser.close();

  const unter = MOTIVE.filter((m) => Object.entries(BODEN).some(([n, v]) => mass.get(m.id)[n] < v));
  const z = (v) => v.toFixed(1).replace('.', ',');
  const zeilen = ['---', 'tags: [schach-app, crownmate, feinschliff, auswahl]', 'date: 2026-11-14', 'status: aktiv', '---', '',
    '# Bretter-Auswahl, Fassung 3: 20 Motiv-Bretter', '',
    'Flo, 14.11.2026: Fassung 1 war "nur Farben, zu ähnlich", Fassung 2 "zu brav". Fassung 3 malt deshalb ein echtes Bild über das ganze Brett: Kirchenfenster, Seekarte, Sternbilder, Unterwasser und mehr. Jedes Brett hat dazu einen eigenen Rahmen und eine eigene Schrift für die Koordinaten.',
    'Alles ist selbst gezeichnet (SVG im Code), keine fremden Bilder. Die Bretter sind nur ein Entwurf im Zweig: nicht in der App, nicht freischaltbar, nichts an Shop oder Preisen.',
    '', '**So streichst du:** Mach ein `x` in die Klammer bei jedem Brett, das raus soll. Was stehen bleibt, kommt in die nächste Runde.',
    '', 'Alle 20 auf einen Blick: ![[uebersicht.png]]', '',
    '**Spielbar trotz Bild:** Jedes Bild wird zweimal gerechnet, einmal hell für die hellen Felder und einmal dunkel für die dunklen. Die Helligkeit jeder Farbe liegt fest in einem Band, nur Farbton und Form wechseln. So bleiben hell und dunkel klar getrennt.',
    'Die Kontraste sind am echten Brett gemessen (Bildschirmfoto, WCAG), jeweils an der schlechtesten Stelle (die dunkelsten bzw. hellsten 0,5 % der Pixel). Mindestwerte wie in Fassung 2: Feld 2,2, weiße Figur auf dunklem Feld 3,0, schwarze Figur auf dunklem Feld 3,0, schwarze Figur auf hellem Feld 7,0. '
      + (unter.length ? `**Unter einem Mindestwert:** ${unter.map((m) => m.name).join(', ')}.` : 'Alle 20 halten alle vier Mindestwerte.'),
    '"Bewegt sich" heißt: ein leiser Glanz läuft über den Rahmen, nie über die Felder. Bei "weniger Bewegung" steht er still.',
    '"Weg" heißt, wie das Brett später frei werden könnte. Jeder Vorschlag nutzt eine Mechanik, die es schon gibt: Level, Welt, Endgegner oder eine Stufe der Erfolge. Kein Brett kostet etwas.', ''];
  for (const sel of ['legende', 'episch', 'selten']) {
    const liste = MOTIVE.map((m, n) => [m, n]).filter(([m]) => m.seltenheit === sel);
    zeilen.push(`## ${SELTEN[sel]} (${liste.length})`, '');
    for (const [m, n] of liste) {
      const k = mass.get(m.id);
      zeilen.push(`- [ ] **${n + 1} ${m.name}**: ${m.idee} · Weg: ${wegText(m.weg, weltName)}${m.bewegung ? ' · bewegt sich (leiser Glanz am Rahmen)' : ''}`
        + ` · Kontrast Feld ${z(k.feld)} / weiß ${z(k.weissAufDunkel)} / schwarz auf dunkel ${z(k.schwarzAufDunkel)} / schwarz auf hell ${z(k.schwarzAufHell)} · [[${datei(m, n)}|Bild]]`);
    }
    zeilen.push('');
  }
  zeilen.push('Gebaut auf dem Zweig `so/R19-bretter-v3` (Repo schach), Motive in `js/brett-motive.js`, Vorschau `werkzeuge/bretter-vorschau-v3.html`, Test `tests/bretter-v3.test.mjs`. Bilder: `node werkzeuge/bretter-vorschau-v3.mjs --ziel <dieser Ordner>`.', '');
  writeFileSync(path.join(ZIEL, 'Bretter-Auswahl.md'), zeilen.join('\n'));
  console.log(`bretter-vorschau-v3: ${MOTIVE.length} Einzelbilder, Uebersicht, unter Mindestwert ${unter.length}, Seitenfehler ${fehler}`);
  process.exitCode = MOTIVE.length === 20 && !unter.length && !fehler ? 0 : 1;
} finally {
  server.kill();
}
