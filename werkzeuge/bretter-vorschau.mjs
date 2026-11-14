// Bilder und Auswahl-Liste der 65 Bretter fuer Flo (14.11.2026: "65 Bretter-Skins ... damit Flo streichen kann").
//   node werkzeuge/bretter-vorschau.mjs --ziel "<Vault-Ordner>"
// Schreibt in den Ziel-Ordner: uebersicht.png (alle 65), familie-<id>.png (je Familie), einzeln/<nr>-<id>.png (ein grosses
// Brett je Id mit html[data-brett], Legendaere mitten im Glanz) und Bretter-Auswahl.md (Liste zum Streichen, mit Weg und
// gemessenem Kontrast). Braucht Playwright (PLAYWRIGHT_PFAD oder tests/browser.mjs) und liefert das Repo selbst aus
// (tests/testserver.mjs). Schreibt nichts ins Repo.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { alleBretter, wegText, brettMass } from './bretter-katalog.mjs';
import { BRETT_FAMILIEN } from '../js/labor.js';
import { WELTEN } from '../js/bots.js';
import { t } from '../js/sprache.js';
import '../js/pakete/sammlung/texte.js';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const i = process.argv.indexOf('--ziel');
const ZIEL = i > 0 ? process.argv[i + 1] : null;
if (!ZIEL) { console.error('--ziel "<Ordner>" fehlt'); process.exit(2); }
mkdirSync(path.join(ZIEL, 'einzeln'), { recursive: true });

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PFAD || 'playwright');
const PORT = await (await import('../tests/freier-port.mjs')).freierPort();
const server = spawn(process.execPath, [path.join(WURZEL, 'tests/testserver.mjs'), String(PORT)], { cwd: WURZEL, stdio: 'ignore' });
const basis = `http://127.0.0.1:${PORT}/werkzeuge/bretter-vorschau.html`;
const FAMILIE = { klassik: 'Klassik', natur: 'Natur', edelstein: 'Edelstein', welten: 'Welten', 'nacht-neon': 'Nacht und Neon', legendaer: 'Legendär' };
const SELTEN = { frei: 'Frei', selten: 'Selten', episch: 'Episch', legende: 'Legende' };
const weltName = (n) => (WELTEN.find((w) => w.nr === n) || {}).name || 'Welt ' + n;
let fehler = 0;
try {
  for (let v = 0; v < 50; v++) { try { await fetch(basis); break; } catch (e) { await new Promise((r) => setTimeout(r, 100)); } }
  const browser = await chromium.launch();
  const s = await browser.newPage({ viewport: { width: 1360, height: 900 }, deviceScaleFactor: 1 });
  s.on('pageerror', (e) => { fehler++; console.error('Seitenfehler', e.message); });
  await s.goto(basis);
  await s.waitForFunction(() => window.vorschauFertig === true, null, { timeout: 30000 });
  await s.waitForFunction(() => [...document.images].every((b) => b.complete && b.naturalWidth > 0), null, { timeout: 30000 });
  const karten = await s.locator('.karte').count();
  await s.screenshot({ path: path.join(ZIEL, 'uebersicht.png'), fullPage: true });
  for (const f of BRETT_FAMILIEN) await s.locator(`.raster[data-familie="${f}"]`).screenshot({ path: path.join(ZIEL, `familie-${f}.png`) });
  const bretter = alleBretter();
  const e = await browser.newPage({ viewport: { width: 560, height: 560 } });
  e.on('pageerror', (x) => { fehler++; console.error('Seitenfehler', x.message); });
  for (const [n, b] of bretter.entries()) {
    await e.goto(`${basis}?brett=${b.id}`);
    await e.waitForFunction(() => window.vorschauFertig === true && [...document.images].every((x) => x.complete && x.naturalWidth > 0), null, { timeout: 30000 });
    // Legendaere: den Glanz mitten auf dem Feld anhalten (4,5 s von 9 s)
    await e.evaluate(() => document.getAnimations().forEach((a) => { a.pause(); a.currentTime = 4500; }));
    await e.locator('.einzel').screenshot({ path: path.join(ZIEL, 'einzeln', `${String(n + 1).padStart(2, '0')}-${b.id}.png`) });
  }
  await browser.close();

  const zeilen = ['---', 'tags: [schach-app, crownmate, feinschliff, auswahl]', 'date: 2026-11-14', 'status: aktiv', '---', '',
    '# Bretter-Auswahl (65)', '',
    'Flo, 14.11.2026: "65 Bretter-Skins, schöne, überdenken". Hier sind 13 vorhandene und 52 neue Bretter. Die neuen liegen bisher nur im Labor, also nur im Erfinder-Konto. Freigeschaltet wird erst nach deiner Wahl.',
    '', '**So streichst du:** Mach ein `x` in die Klammer bei jedem Brett, das raus soll. Was stehen bleibt, kommt in die nächste Runde.',
    'Alle 65 auf einen Blick: ![[uebersicht.png]]', '',
    '"Weg" heißt, wie das Brett später frei wird. Jeder Weg nutzt eine Mechanik, die es schon gibt: Level, Welt, Endgegner oder eine Stufe der Erfolge. Kein Brett kostet etwas.',
    'Die Kontraste sind gemessen (WCAG), jeweils an der schlechtesten Stelle mit Feldzeichnung und Glanz. Die Mindestwerte stammen von Nacht, Grün und Holz: Feld 2,2, weiße Figur auf dunklem Feld 3,0, schwarze Figur auf dunklem Feld 3,0, schwarze Figur auf hellem Feld 7,0.', ''];
  for (const f of BRETT_FAMILIEN) {
    const liste = bretter.map((b, n) => [b, n + 1]).filter(([b]) => b.familie === f);
    zeilen.push(`## ${FAMILIE[f]} (${liste.length})`, '', `![[familie-${f}.png]]`, '');
    for (const [b, n] of liste) {
      const m = brettMass(b);
      const bild = `einzeln/${String(n).padStart(2, '0')}-${b.id}.png`;
      zeilen.push(`- [ ] **${n} ${t('p-sammlung.brett.' + b.id)}**${b.alt ? ' (vorhanden)' : ' (neu)'} · ${SELTEN[b.seltenheit]} · Weg: ${wegText(b.weg, weltName)}`
        + `${b.bewegung ? ' · bewegt sich (leiser Glanz, aus bei "weniger Bewegung")' : ''} · Kontrast ${m.feld.toFixed(1)} / ${m.weissAufDunkel.toFixed(1)} / ${m.schwarzAufDunkel.toFixed(1)} · [[${bild}|Bild]]`);
    }
    zeilen.push('');
  }
  zeilen.push('Gebaut auf dem Zweig `so/R19-sammlung-65` (Repo schach), Vorschau: `werkzeuge/bretter-vorschau.html`. Bilder: `node werkzeuge/bretter-vorschau.mjs --ziel <dieser Ordner>`.', '');
  writeFileSync(path.join(ZIEL, 'Bretter-Auswahl.md'), zeilen.join('\n'));
  console.log(`bretter-vorschau: ${karten} Karten im Raster, ${bretter.length} Einzelbilder, ${BRETT_FAMILIEN.length} Familien, Seitenfehler ${fehler}`);
  process.exitCode = karten === 65 && bretter.length === 65 && !fehler ? 0 : 1;
} finally {
  server.kill();
}
