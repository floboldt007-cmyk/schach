// Knopfleiste der Blaetter (css/bauteile.css .sheet-knoepfe, Auftrag M-12:55): Ein einzelner Knopf geht ueber die ganze
// Breite und steht mittig, auch ueber 440 px. Vorher stand er dort in der linken von zwei Spalten. Zwei Knoepfe bleiben
// wie bisher: nebeneinander ab 441 px, untereinander bis 440 px.
// Die Blaetter werden mit sheet() (js/ui/bauteile.js) und der Klasse des echten Blatts geoeffnet, damit dessen eigene
// Regeln (Breite, Reihenfolge) mitwirken. Die Effekt-Vorschau im Shop prueft tests/r20-effekt-vorschau.test.mjs im echten Ablauf.
//
//   node tests/sheet-knoepfe.test.mjs
//   node tests/sheet-knoepfe.test.mjs --bilder=<ordner>   je Blatt ein Bild bei 1440 (hell), dazu 390 hell und 1440 dunkel
import http from 'node:http';
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { browserTyp } from './browser.mjs';

const require = createRequire(import.meta.url);
let pw;
for (const p of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
  try { pw = require(p); break; } catch (e) { /* naechster */ }
}
if (!pw) throw new Error('Playwright fehlt');
const root = fileURLToPath(new URL('../', import.meta.url));
const typen = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' };
const server = http.createServer((req, res) => {
  const p = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://test').pathname).replace(/\/$/, '/index.html'));
  if (!p.startsWith(root)) { res.writeHead(403); res.end(); return; }
  try { const d = readFileSync(p); res.writeHead(200, { 'Content-Type': typen[path.extname(p)] || 'application/octet-stream' }); res.end(d); }
  catch (e) { res.writeHead(404); res.end(); }
});
const PORT = Number(process.env.PORT) || await (await import('./freier-port.mjs')).freierPort();
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
const bilder = (process.argv.find((a) => a.startsWith('--bilder=')) || '').slice(9);
if (bilder) mkdirSync(bilder, { recursive: true });

let ok = 0, gesamt = 0;
function pruefe(name, gut, detail = '') {
  gesamt++; if (gut) ok++;
  // INTENTIONAL-SLOP[T4]: die Pruefzeile ist die Ausgabe des Tests (wie in tests/r20-effekt-vorschau.test.mjs)
  console.log(`${gut ? 'ok  ' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(detail)}`);
}

// die Blaetter mit genau einem Knopf (Stand 19.11.2026, Liste im Bericht zu M-12:55); dazu eines mit zwei Knoepfen
const EIN = [
  ['steckbrief', 'js/ui/arena.js'], ['bericht-blatt', 'js/bericht.js'], ['vw-karte', 'js/pakete/verwaltung/index.js'],
  ['gegner-profil', 'js/ui/gegner-profil.js'], ['lg-mini-blatt', 'js/pakete/liga/gruppe.js'], ['ss-ligen-blatt', 'js/pakete/liga/saison.js'],
  ['ss-blatt', 'js/pakete/liga/saison.js'], ['bl-fr-sheet', 'js/pakete/punkte/freunde.js'], ['pr-blatt', 'js/pakete/sammlung/profil.js'],
  ['shf-sheet', 'js/pakete/sammlung/shop-entwurf.js'], ['', 'js/pakete/sammlung/shop.js, app.frage mit einem Knopf'],
];

async function oeffne(s, klasse, knoepfe) {
  await s.evaluate(({ klasse, knoepfe }) => import('./js/ui/bauteile.js').then((m) => {
    m.sheet({ titel: 'Probe ' + (klasse || 'ohne Klasse'), text: 'Ein kurzer Satz im Blatt.', klasse, knoepfe, abbrechen: false });
  }), { klasse, knoepfe });
  await s.waitForSelector('.sheet-karte .sheet-knoepfe button');
  await s.waitForTimeout(450);   // das Blatt faehrt ein
  return s.evaluate(() => {
    const l = document.querySelector('.sheet-karte .sheet-knoepfe').getBoundingClientRect();
    return { leiste: Math.round(l.width), knoepfe: [...document.querySelectorAll('.sheet-karte .sheet-knoepfe button')].map((b) => {
      const r = b.getBoundingClientRect();
      return { breite: Math.round(r.width), hoehe: Math.round(r.height), links: Math.round(r.left - l.left), oben: Math.round(r.top - l.top),
        mitte: Math.round((r.left + r.width / 2) - (l.left + l.width / 2)) };
    }) };
  });
}
const zu = (s) => s.evaluate(() => import('./js/ui/bauteile.js').then((m) => m.schliesseSheet())).then(() => s.waitForTimeout(350));

const browser = await browserTyp(pw).launch({ headless: true });
try {
  for (const [w, farbe] of [[1440, 'hell'], [1440, 'dunkel'], [390, 'hell']]) {
    const k = await browser.newContext({ viewport: { width: w, height: 900 }, deviceScaleFactor: 1, colorScheme: farbe === 'dunkel' ? 'dark' : 'light',
      serviceWorkers: 'block', locale: 'de-DE', reducedMotion: 'reduce' });
    const s = await k.newPage();
    const fehler = [];
    s.on('pageerror', (e) => fehler.push(e.message));
    try {
      await s.goto(`http://127.0.0.1:${PORT}/index.html?test#heim`);
      await s.waitForFunction(() => window.__app && document.querySelector('.screen.heim-screen'), null, { timeout: 45000 });
      for (const [klasse, datei] of EIN) {
        const m = await oeffne(s, klasse, [{ text: 'Schließen', wert: false }]);
        const [b] = m.knoepfe;
        pruefe(`${w} ${farbe} ${klasse || 'ohne Klasse'} (${datei}): ein Knopf, volle Breite, mittig, mindestens 44 px hoch`,
          m.knoepfe.length === 1 && Math.abs(b.breite - m.leiste) <= 1 && Math.abs(b.mitte) <= 1 && b.hoehe >= 44, m);
        if (bilder && (farbe === 'hell' && w === 1440 || klasse === 'shf-sheet')) {
          await s.screenshot({ path: path.join(bilder, `${w}-${farbe}-${klasse || 'ohne-klasse'}.png`) });
        }
        await zu(s);
      }
      // zwei Knoepfe: unveraendert
      const m = await oeffne(s, '', [{ text: 'Abbrechen', wert: false }, { text: 'Weiter', wert: true, art: 'primaer' }]);
      const [a, b] = m.knoepfe;
      const nebeneinander = a.oben === b.oben && Math.abs(a.breite - b.breite) <= 1 && a.breite < m.leiste / 2 + 1;
      const untereinander = a.oben !== b.oben && Math.abs(a.breite - m.leiste) <= 1 && Math.abs(b.breite - m.leiste) <= 1;
      pruefe(`${w} ${farbe} zwei Knoepfe: ${w > 440 ? 'nebeneinander, je halbe Breite' : 'untereinander, volle Breite'} (wie bisher)`,
        w > 440 ? nebeneinander : untereinander, m);
      if (bilder) await s.screenshot({ path: path.join(bilder, `${w}-${farbe}-zwei-knoepfe.png`) });
      await zu(s);
      pruefe(`${w} ${farbe}: keine Seitenfehler`, fehler.length === 0, fehler);
    } catch (e) {
      pruefe(`${w} ${farbe}: Ablauf ohne Abbruch`, false, String(e.message).slice(0, 200));
    } finally { await k.close().catch(() => {}); }
  }
} finally {
  await browser.close();
  server.close();
}
console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
