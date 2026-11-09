// Einfuehrung ohne Scrollen (G-002, Kundenblick T 09.11.2026, Befunde 3 und 4): Auf jeder Seite der Einfuehrung
// (w1, w2, w3, frage, einstufung, nach-regeln) liegt JEDER Knopf ganz im sichtbaren Bereich, ohne dass jemand scrollt,
// und ist mindestens 44 x 44 px gross. Gemessen auf iPhone SE und iPhone 13 mit Safari-Leiste, iPad hoch und quer
// (mit Safari-Leiste) und PC. Vorher lagen "Lieber gleich spielen" (Einstufung) und "Nein, zeig sie mir" (Frage) auf dem
// iPhone 13 unter dem Rand.
// Dazu der Klartext beim ersten Kontakt (Befund 5): die Bauernmarsch-Zeile sagt in einfachen Worten, was zu tun ist.
//
//   node tests/einfuehrung-rand.test.mjs                 alles
//   BILDER=<ordner> node tests/einfuehrung-rand.test.mjs  mit Bildschirmfotos (sonst keine)
//
// Playwright: PLAYWRIGHT_PFAD, sonst 'playwright', sonst /opt/node-tools/node_modules/playwright. Eigener kleiner
// Node-Server (kein python3 noetig).
process.env.TZ = 'Europe/Berlin';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { browserTyp } from './browser.mjs';

const require = createRequire(import.meta.url);
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8893);
const BASIS = `http://127.0.0.1:${PORT}/index.html?test&kern&erw=pakete/start/index`;
const BILDER = process.env.BILDER ? path.join(process.env.BILDER, 'einfuehrung-rand') : '';
const warte = (ms) => new Promise((r) => setTimeout(r, ms));
let ok = 0;
let gesamt = 0;
const fehler = [];
function pruefe(name, bedingung, info) {
  gesamt++;
  if (bedingung) { ok++; console.log('ok     ' + name); } else { fehler.push(name); console.log('FEHLER ' + name + (info !== undefined ? '  -> ' + (typeof info === 'string' ? info : JSON.stringify(info)) : '')); }
}

// ---------- Klartext (ohne Browser) ----------
// texte.js registriert nur (kein Export): der erste Treffer steht im Block de, der zweite im Block en
const serieTexte = readFileSync(path.join(WURZEL, 'js/pakete/serie/texte.js'), 'utf8');
const heuteOffen = [...serieTexte.matchAll(/'heute\.offen': '([^']*)'/g)].map((m) => m[1]);
for (const [i, sprache] of ['de', 'en'].entries()) {
  const offen = heuteOffen[i] || '';
  pruefe(`${sprache}: Bauernmarsch-Zeile sagt in Klartext, was zu tun ist (ohne "Tageswerk"/"daily goal" als Fachwort)`,
    offen && !/Tageswerk|daily goal/i.test(offen) && (sprache === 'de' ? /Partie|Rätsel|Lektion/.test(offen) : /game|puzzle|lesson/i.test(offen)), offen);
}

// ---------- Browser ----------
const GERAETE = [
  { name: 'iPhone SE mit Safari-Leiste', w: 375, h: 548, handy: true },
  { name: 'iPhone 13 mit Safari-Leiste', w: 390, h: 664, handy: true },
  { name: 'iPhone 13 ohne Leiste', w: 390, h: 844, handy: true },
  { name: 'iPad hoch mit Safari-Leiste', w: 820, h: 1106, handy: true },
  { name: 'iPad quer mit Safari-Leiste', w: 1180, h: 746, handy: true },
  { name: 'PC', w: 1280, h: 720, handy: false },
];
const SEITEN = ['w1', 'w2', 'w3', 'frage', 'einstufung', 'nach-regeln'];

const TYPEN = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.wasm': 'application/wasm', '.webmanifest': 'application/manifest+json' };
const server = createServer(async (req, res) => {
  try {
    const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const datei = path.join(WURZEL, p === '/' ? 'index.html' : p);
    if (!datei.startsWith(WURZEL)) throw new Error('aussen');
    const inhalt = await readFile(datei);
    res.writeHead(200, { 'Content-Type': TYPEN[path.extname(datei)] || 'application/octet-stream' });
    res.end(inhalt);
  } catch (e) { res.writeHead(404); res.end(); }
});

function ladePlaywright() {
  for (const k of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
    try { return require(k); } catch (e) { /* naechster */ }
  }
  throw new Error('Playwright nicht gefunden (PLAYWRIGHT_PFAD setzen)');
}

// alle sichtbaren Knoepfe der Einfuehrung (Kopf und Buehne): ganz im Bild, ohne Scrollen, mindestens 44 x 44
const messe = (seite) => seite.evaluate(() => {
  const s = document.querySelector('.st-screen');
  const r = document.querySelector('.st-rumpf');
  const knoepfe = [...s.querySelectorAll('button')].filter((b) => b.getClientRects().length && getComputedStyle(b).visibility !== 'hidden')
    .map((b) => { const k = b.getBoundingClientRect(); return { t: (b.textContent.trim() || b.getAttribute('aria-label') || '').slice(0, 24),
      oben: Math.round(k.top), unten: Math.round(k.bottom), links: Math.round(k.left), rechts: Math.round(k.right), h: Math.round(k.height), b: Math.round(k.width) }; });
  const draussen = knoepfe.filter((k) => k.oben < 0 || k.unten > innerHeight || k.links < 0 || k.rechts > innerWidth + 1);
  const klein = knoepfe.filter((k) => k.h < 44 || k.b < 44);
  return { seite: s.dataset.seite, gescrollt: r.scrollTop, n: knoepfe.length, draussen, klein, hoehe: innerHeight };
});

let browser = null;
let code = 1;
try {
  await new Promise((ok2) => server.listen(PORT, '127.0.0.1', ok2));
  browser = await browserTyp(ladePlaywright()).launch();
  if (BILDER) mkdirSync(BILDER, { recursive: true });
  for (const g of GERAETE) {
    const kontext = await browser.newContext({ viewport: { width: g.w, height: g.h }, deviceScaleFactor: 1, hasTouch: g.handy, isMobile: g.handy,
      timezoneId: 'Europe/Berlin' });
    const seite = await kontext.newPage();
    const seitenfehler = [];
    seite.on('pageerror', (e) => seitenfehler.push(e.message));
    await seite.goto(BASIS);
    await seite.waitForSelector('.st-screen .st-titel', { timeout: 20000 });
    for (const name of SEITEN) {
      if (name !== 'w1') {
        await seite.evaluate((n) => window.__app.gehe('start', { seite: n }, { ersetzen: true }), name);
        await seite.waitForFunction((n) => document.querySelector('.st-screen') && document.querySelector('.st-screen').dataset.seite === n, name, { timeout: 10000 });
      }
      await warte(800);   // Eintritte fertig
      const m = await messe(seite);
      pruefe(`${g.name} (${g.w} x ${g.h}), Seite ${name}: alle ${m.n} Knoepfe ganz sichtbar ohne Scrollen`, m.seite === name && m.n > 0 && m.gescrollt === 0 && !m.draussen.length, m.draussen);
      pruefe(`${g.name}, Seite ${name}: jeder Knopf mindestens 44 x 44 px`, !m.klein.length, m.klein);
      if (BILDER) await seite.screenshot({ path: path.join(BILDER, `${g.w}x${g.h}-${name}.png`) });
    }
    pruefe(`${g.name}: keine Seitenfehler`, !seitenfehler.length, seitenfehler);
    await kontext.close();
  }
  code = fehler.length ? 1 : 0;
} catch (e) {
  console.error(e);
  code = 1;
} finally {
  if (browser) await browser.close();
  server.close();
}
console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(code);
