// Bilder und Auswahl-Liste der 20 Motiv-Bretter, Fassung 4 (Flo 14.11.2026 zu Fassung 3: "man erkennt das Brett gar
// nicht mehr"; jetzt klares Brett, Motiv nur leise in den Feldern und im Rahmen).
//   node werkzeuge/bretter-vorschau-v4.mjs --ziel "<Vault-Ordner>"
// Schreibt in den Ziel-Ordner: uebersicht.png (alle 20, Seite hell), einzeln/<nr>-<id>.png (iPhone-Breite 390, dreifache
// Pixeldichte, echte Stellung mit letztem Zug, Rahmen und Koordinaten, Seite hell), einzeln/dunkel-<nr>-<id>.png (vier
// davon auf dunkler Seite) und Bretter-Auswahl.md (Liste zum Streichen mit Konkret-Satz, Messwerten und Top 5).
// Gemessen wird wie in tests/bretter-v4.test.mjs: nur Felder, 400 px, je Feld ohne den aeussersten Pixel, streng
// kleinster und groesster Pixel. Braucht Playwright (PLAYWRIGHT_PFAD oder node_modules), schreibt nichts ins Repo.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { wegText } from './bretter-katalog.mjs';
import { WELTEN } from '../js/bots.js';
import { MOTIVE, GRENZE } from '../js/brett-motive-v4.js';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const i = process.argv.indexOf('--ziel');
const ZIEL = i > 0 ? process.argv[i + 1] : null;
if (!ZIEL) { console.error('--ziel "<Ordner>" fehlt'); process.exit(2); }
mkdirSync(path.join(ZIEL, 'einzeln'), { recursive: true });

// die vier Bretter, die zusaetzlich auf dunkler Seite fotografiert werden, und die Empfehlung (Top 5) mit Grund
const DUNKEL = ['kirchenfenster', 'sternbilder', 'goldthron', 'art-deco'];
const TOP = [
  ['seekarte', 'die Gradskala macht den Rahmen sofort erkennbar, die Felder bleiben ruhig wie Pergament und Meer'],
  ['jadepalast', 'roter Lack mit Goldmäander und Jadegrün: edel, ruhig und auf dem Handy sofort lesbar'],
  ['kirchenfenster', 'der farbigste Rahmen, trotzdem ist das Brett sofort klar'],
  ['goldthron', 'das Belohnungsbrett: Gold, Edelsteine und ein leiser Glanz am Rahmen'],
  ['intarsie', 'wirkt wie ein echtes Holzbrett, die Maserung wechselt die Richtung wie bei echter Einlegearbeit'],
];

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PFAD || 'playwright');
const PORT = await (await import('../tests/freier-port.mjs')).freierPort();
const server = spawn(process.execPath, [path.join(WURZEL, 'tests/testserver.mjs'), String(PORT)], { cwd: WURZEL, stdio: 'ignore' });
const basis = `http://127.0.0.1:${PORT}/werkzeuge/bretter-vorschau-v4.html`;
const SELTEN = { selten: 'Selten', episch: 'Episch', legende: 'Legende' };
const weltName = (n) => (WELTEN.find((w) => w.nr === n) || {}).name || 'Welt ' + n;
const BODEN = { feld: GRENZE.feld, weissAufDunkel: 3.0, schwarzAufDunkel: 3.0, schwarzAufHell: 7.0 };
const nr = (n) => String(n + 1).padStart(2, '0');
const datei = (m, n) => `einzeln/${nr(n)}-${m.id}.png`;
const dateiDunkel = (m, n) => `einzeln/dunkel-${nr(n)}-${m.id}.png`;
let fehler = 0, bilder = 0;
try {
  for (let v = 0; v < 50; v++) { try { await fetch(basis); break; } catch (e) { await new Promise((r) => setTimeout(r, 100)); } }
  const browser = await chromium.launch();
  const neu = async (opt) => { const p = await browser.newPage(opt); p.on('pageerror', (e) => { fehler++; console.error('Seitenfehler', e.message); }); return p; };
  const fertig = (p) => p.waitForFunction(() => window.vorschauFertig === true && [...document.images].every((b) => b.complete && b.naturalWidth > 0), null, { timeout: 30000 });
  // Glanz auf den Rahmen anhalten, damit jedes Bild gleich aussieht
  const anhalten = (p) => p.evaluate(() => document.getAnimations().forEach((a) => { a.pause(); a.currentTime = 4500; }));

  const u = await neu({ viewport: { width: 1360, height: 900 }, deviceScaleFactor: 1 });
  await u.goto(basis); await fertig(u); await anhalten(u);
  await u.screenshot({ path: path.join(ZIEL, 'uebersicht.png'), fullPage: true }); bilder++;

  const e = await neu({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
  for (const [n, m] of MOTIVE.entries()) {
    await e.goto(`${basis}?brett=${m.id}`); await fertig(e); await anhalten(e);
    await e.locator('main').screenshot({ path: path.join(ZIEL, datei(m, n)) }); bilder++;
    if (DUNKEL.includes(m.id)) {
      await e.goto(`${basis}?brett=${m.id}&modus=dunkel`); await fertig(e); await anhalten(e);
      await e.locator('main').screenshot({ path: path.join(ZIEL, dateiDunkel(m, n)) }); bilder++;
    }
  }

  const s = await neu({ viewport: { width: 420, height: 520 }, deviceScaleFactor: 1 });
  const mass = new Map();
  for (const m of MOTIVE) {
    await s.goto(`${basis}?brett=${m.id}&nur=felder`); await fertig(s);
    const r = await s.locator('.brett').boundingBox();
    const foto = (await s.screenshot({ clip: { x: Math.round(r.x), y: Math.round(r.y), width: 400, height: 400 } })).toString('base64');
    mass.set(m.id, await s.evaluate(async (foto) => {
      const lum = (R, G, B) => [R, G, B].map((v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; })
        .reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
      const k = (x, y) => (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
      const bild = new Image(); await new Promise((ok, f) => { bild.onload = ok; bild.onerror = f; bild.src = 'data:image/png;base64,' + foto; });
      const c = document.createElement('canvas'); c.width = 400; c.height = 400; const x = c.getContext('2d'); x.drawImage(bild, 0, 0);
      const d = x.getImageData(0, 0, 400, 400).data;
      let hMin = 1, dMax = 0, dMin = 1, textur = 1;
      for (let fy = 0; fy < 8; fy++) for (let fx = 0; fx < 8; fx++) {
        let lo = 1, hi = 0;
        for (let py = fy * 50 + 1; py < fy * 50 + 49; py++) for (let px = fx * 50 + 1; px < fx * 50 + 49; px++) {
          const i = (py * 400 + px) * 4, v = lum(d[i], d[i + 1], d[i + 2]); if (v < lo) lo = v; if (v > hi) hi = v;
        }
        textur = Math.max(textur, k(lo, hi));
        if ((fx + fy) % 2 === 0) hMin = Math.min(hMin, lo); else { dMax = Math.max(dMax, hi); dMin = Math.min(dMin, lo); }
      }
      return { feld: k(hMin, dMax), weissAufDunkel: k(1, dMax), schwarzAufDunkel: k(0, dMin), schwarzAufHell: k(0, hMin), textur };
    }, foto));
  }
  await browser.close();

  const unter = MOTIVE.filter((m) => { const k = mass.get(m.id); return Object.entries(BODEN).some(([n, v]) => k[n] < v) || k.textur > GRENZE.textur; });
  const zahl = (v, st = 1) => v.toFixed(st).replace('.', ',');
  const name = (id) => { const n = MOTIVE.findIndex((m) => m.id === id); return `${n + 1} ${MOTIVE[n].name}`; };
  const zeilen = ['---', 'tags: [schach-app, crownmate, feinschliff, auswahl]', 'date: 2026-11-14', 'status: aktiv', '---', '',
    '# Bretter-Auswahl, Fassung 4: 20 Motiv-Bretter', '',
    'Flo, 14.11.2026, zu Fassung 3: "man erkennt das Brett gar nicht mehr". Fassung 4 dreht das um: **das Brett ist auf den ersten Blick ein klares Schachbrett**, helle und dunkle Felder deutlich getrennt. Das Motiv lebt nur noch leise **in** den Feldern (feine Körnung, Maserung, Punkte) und laut im **Rahmen** (Ornament und Schrift der Koordinaten). Kein Bild läuft mehr über die Felder hinweg: jede Feld-Textur hört an der Feldkante auf.',
    'Alles ist selbst gezeichnet (SVG im Code), keine fremden Bilder. Nur ein Entwurf im Zweig: nicht in der App, nicht freischaltbar, nichts an Shop oder Preisen.',
    '', '**So streichst du:** Mach ein `x` in die Klammer bei jedem Brett, das raus soll. Was stehen bleibt, kommt in die nächste Runde.',
    '', 'Alle 20 auf einen Blick: ![[uebersicht.png]]', '',
    `Vier Bretter gibt es zusätzlich auf dunkler Seite (wie im Dunkelmodus der App): ${DUNKEL.map((id) => { const n = MOTIVE.findIndex((m) => m.id === id); return `[[${dateiDunkel(MOTIVE[n], n)}|${MOTIVE[n].name}]]`; }).join(', ')}.`, '',
    '## Empfehlung: Top 5', '',
    ...TOP.map(([id, grund], n) => `${n + 1}. **${name(id)}**: ${grund}.`), '',
    '## Gemessen am echten Brett', '',
    `Bildschirmfoto der Felder, WCAG-Kontrast, jetzt **streng am schlechtesten Pixel** (Fassung 3 nahm die schlechtesten 0,5 %). Mindestwerte: hell gegen dunkel ${zahl(GRENZE.feld)} (Fassung 3: 2,2), weiße Figur auf dunkel 3,0, schwarze auf dunkel 3,0, schwarze auf hell 7,0. Neu: die Textur innerhalb eines Feldes höchstens ${zahl(GRENZE.textur, 2)}, damit sie leise bleibt. Die Koordinaten sind am Brett gemessen (mit und ohne Schrift fotografiert), alle über 3,0. `
      + (unter.length ? `**Unter einem Mindestwert:** ${unter.map((m) => m.name).join(', ')}.` : 'Alle 20 halten alle Werte.'),
    '"Bewegt sich" heißt: ein leiser Glanz läuft über den Rahmen, nie über die Felder (der Test prüft, worauf jede Animation läuft). Bei "weniger Bewegung" steht er still.',
    '"Weg" heißt, wie das Brett später frei werden könnte, mit einer Mechanik, die es schon gibt. Kein Brett kostet etwas.', ''];
  for (const sel of ['legende', 'episch', 'selten']) {
    const liste = MOTIVE.map((m, n) => [m, n]).filter(([m]) => m.seltenheit === sel);
    zeilen.push(`## ${SELTEN[sel]} (${liste.length})`, '');
    for (const [m, n] of liste) {
      const k = mass.get(m.id);
      zeilen.push(`- [ ] **${n + 1} ${m.name}** · Weg: ${wegText(m.weg, weltName)}${m.bewegung ? ' · bewegt sich (Glanz am Rahmen)' : ''} · [[${datei(m, n)}|Bild]]${DUNKEL.includes(m.id) ? ` · [[${dateiDunkel(m, n)}|dunkel]]` : ''}`,
        `  Konkret: ${m.konkret}`,
        `  Gemessen: hell gegen dunkel ${zahl(k.feld)} · weiß ${zahl(k.weissAufDunkel)} · schwarz auf dunkel ${zahl(k.schwarzAufDunkel)} · schwarz auf hell ${zahl(k.schwarzAufHell)} · Textur ${zahl(k.textur, 2)}`);
    }
    zeilen.push('');
  }
  zeilen.push('Gebaut auf dem Zweig `so/R19-bretter-v4` (Repo schach), Motive in `js/brett-motive-v4.js`, Vorschau `werkzeuge/bretter-vorschau-v4.html`, Test `tests/bretter-v4.test.mjs`. Bilder: `node werkzeuge/bretter-vorschau-v4.mjs --ziel <dieser Ordner>`.', '');
  writeFileSync(path.join(ZIEL, 'Bretter-Auswahl.md'), zeilen.join('\n'));
  console.log(`bretter-vorschau-v4: ${bilder} Bilder (1 Uebersicht, ${MOTIVE.length} hell, ${DUNKEL.length} dunkel), unter Mindestwert ${unter.length}, Seitenfehler ${fehler}`);
  process.exitCode = MOTIVE.length === 20 && bilder === 1 + 20 + DUNKEL.length && TOP.length === 5 && !unter.length && !fehler ? 0 : 1;
} finally {
  server.kill();
}
