// Brett-Koordinaten lesbar (fc-08:15, Fenster 43; Flos Wahl 20.11.2026: Variante 3 "dunkle Schrift", Vault
// R20-Kritik/zustaende/koordinaten/auswahl.md): die kleinen Buchstaben und Zahlen in der Feldecke (Lage "ecke") haben auf
// JEDEM Brett, auf hellen und dunklen Feldern, im hellen und dunklen Modus mindestens 4,5:1 gegen die Feldfarbe (WCAG 1.4.3,
// kleine Schrift). Gemessen werden alle Bretter: die Liste der Einstellungen (js/storage.js EINSTELLUNG_WERTE.brett) und
// alle Labor- und Motiv-Bretter (js/labor.js), jeweils mit ihrer Flaeche (brettFlaeche, frei), auf der Partie, iPhone 13.
//   node tests/r24-koord-kontrast.test.mjs [--bilder <ordner>]     (PLAYWRIGHT_PFAD)
// Mit --bilder: je Modus ein Bild der unteren linken Brettecke fuer nacht, holz, gruen, marmor (vorher/nachher).
import http from 'node:http';
import { appHeute } from './app-heute.mjs';
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { browserTyp } from './browser.mjs';
import { freierPort } from './freier-port.mjs';

const GRENZE = 4.5;
let ok = 0; let fehler = 0;
function pruefe(name, wert, info = '') {
  if (wert) { ok++; console.log('ok   ' + name); } else { fehler++; console.log('FEHLER ' + name + ' ' + (typeof info === 'string' ? info : JSON.stringify(info))); } // INTENTIONAL-SLOP[T4]: die Konsole ist der Ausgabeweg der Probe
}
const require = createRequire(import.meta.url);
let pw = null;
for (const p of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
  try { pw = require(p); break; } catch (e) { /* naechster */ } // INTENTIONAL-SLOP[F1]: Fehlschlag heisst naechster Kandidat
}
if (!pw) { pruefe('Playwright gefunden', false); console.log(`${ok}/${ok + fehler} bestanden`); process.exit(1); } // INTENTIONAL-SLOP[T4]: Ausgabeweg der Probe
const bi = process.argv.indexOf('--bilder');
const BILDER = bi > 0 ? path.resolve(process.argv[bi + 1]) : null;
if (BILDER) mkdirSync(BILDER, { recursive: true });

const root = fileURLToPath(new URL('../', import.meta.url));
const typen = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' };
const server = http.createServer((req, res) => {
  const p = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://test').pathname).replace(/\/$/, '/index.html'));
  if (!p.startsWith(root)) { res.writeHead(403); res.end(); return; }
  try { const d = readFileSync(p); res.writeHead(200, { 'Content-Type': typen[path.extname(p)] || 'application/octet-stream' }); res.end(d); }
  catch (e) { res.writeHead(404); res.end(); }
});
const PORT = Number(process.env.PORT) || await freierPort();
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

// misst im Browser: Koordinate auf hellem und dunklem Feld gegen die Hintergrundfarbe ihres Feldes
const messen = () => {
  const zuRgb = (t) => { const c = document.createElement('canvas').getContext('2d'); c.fillStyle = '#000'; c.fillStyle = t; c.fillRect(0, 0, 1, 1); return [...c.getImageData(0, 0, 1, 1).data]; };
  const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const kon = (a, b) => { const x = lum(a), y = lum(b); return Math.round(((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)) * 100) / 100; };
  const o = {};
  for (const art of ['h', 'd']) {
    const e = document.querySelector(`.screen.partie .brett .feld.${art} .koord`);
    if (!e) { o[art] = null; continue; }
    const schrift = zuRgb(getComputedStyle(e).color); const feld = zuRgb(getComputedStyle(e.closest('.feld')).backgroundColor);
    // Deckkraft des Schattens (0..255): die Farbe steht in text-shadow vor den Laengen, "none" heisst 0
    const ts = getComputedStyle(e).textShadow;
    const schatten = ts && ts !== 'none' ? zuRgb(ts.replace(/(\s+-?[\d.]+px){2,3}\s*$/, ''))[3] : 0;
    o[art] = { kontrast: kon(schrift, feld), deckend: schrift[3] === 255 && feld[3] === 255, groesse: getComputedStyle(e).fontSize,
      feld: feld.slice(0, 3), schrift: schrift.slice(0, 3), weiss: lum(schrift) > 0.5, schatten };
  }
  return o;
};

const zeilen = [];
const browser = await browserTyp(pw).launch({ headless: true });
// T-072: "heute" wie die App (js/tag.js, Tagesgrenze 4 Uhr), nicht das UTC-Datum
const HEUTE = await appHeute(browser, `http://127.0.0.1:${PORT}/`);
try {
  for (const modus of ['hell', 'dunkel']) {
    const k = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, serviceWorkers: 'block', hasTouch: true, locale: 'de-DE' });
    await k.route('**/*', (r) => (new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort()));
    await k.addInitScript((e) => {
      try {
        const P = 'schach-arena:v1:';
        localStorage.setItem(P + 'modul:start', JSON.stringify({ v: 1, gesehen: e.heute }));
        localStorage.setItem(P + 'hinweis-installieren', '1');
        localStorage.setItem(P + 'einstellungen', JSON.stringify({ sprache: 'de', spracheGewaehlt: true, modus: e.modus, brett: 'nacht', koordinaten: true, koordLage: 'ecke' }));
      } catch (f) { /* egal */ } // INTENTIONAL-SLOP[F1]: Speicher gesperrt heisst Probe ohne Vorbelegung
    }, { heute: HEUTE, modus });
    const s = await k.newPage();
    await s.goto(`http://127.0.0.1:${PORT}/?test#heim`);
    await s.waitForFunction(() => !!window.__app, null, { timeout: 20000 });
    await s.waitForTimeout(2500);   // der Start leitet erst noch um (Heim/Arena); danach erst zur Partie
    await s.evaluate(() => window.__app.gehe('partie', { botId: 'fridolin', farbe: 'w', modus: 'frei' }));
    await s.waitForFunction(() => !!document.querySelector('.screen.partie .brett .feld.d .koord'), null, { timeout: 20000 })
      .catch(async (f) => { console.log(await s.evaluate(() => [location.hash, [...document.querySelectorAll('.screen')].map((x) => x.className).join(' | '), document.querySelectorAll('.brett .koord').length].join(' ~ '))); throw f; });
    await s.waitForTimeout(800);
    const ids = await s.evaluate(async () => {
      const L = await import('/js/labor.js'); const S = await import('/js/storage.js');
      return [...new Set([...S.EINSTELLUNG_WERTE.brett, ...L.LABOR_BRETTER.map((b) => b.id), ...L.MOTIV_BRETTER.map((b) => b.id)])];
    });
    // Motiv-Bretter setzen ihre Koordinaten selbst, ohne Schatten (js/brett-motive.js, brett-motive-v4.js: text-shadow none)
    const motive = new Set(await s.evaluate(async () => (await import('/js/labor.js')).MOTIV_BRETTER.map((b) => b.id)));
    if (modus === 'hell') pruefe(`Bretter gefunden (${ids.length})`, ids.length >= 60, ids.length);
    for (const id of ids) {
      await s.evaluate(async (b) => {
        const L = await import('/js/labor.js'); const html = document.documentElement;
        html.dataset.brett = b; await L.brettFlaeche(html, b, true);
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      }, id);
      const m = await s.evaluate(messen);
      zeilen.push({ modus, brett: id, hell: m.h?.kontrast, dunkel: m.d?.kontrast, groesse: m.d?.groesse, feldH: m.h?.feld, feldD: m.d?.feld });
      const schlecht = ['h', 'd'].filter((a) => !m[a] || !m[a].deckend || m[a].kontrast < GRENZE);
      pruefe(`${id} ${modus}: helles Feld ${m.h?.kontrast}:1, dunkles Feld ${m.d?.kontrast}:1 (mind. ${GRENZE})`, schlecht.length === 0, m);
      // Kaltreview 7b Befund 4: der Schatten bleibt unter weisser Schrift (Halt ueber dem Fuss einer Figur), unter dunkler nicht
      if (!motive.has(id)) pruefe(`${id} ${modus}: dunkles Feld, Schatten nur unter weisser Schrift`, !!m.d && (m.d.weiss ? m.d.schatten > 0 : m.d.schatten === 0), m.d);
      if (BILDER && ['nacht', 'holz', 'gruen', 'marmor'].includes(id)) {
        const r = await s.evaluate(() => { const x = document.querySelector('.screen.partie .brett').getBoundingClientRect(); return { x: x.left, y: x.top + x.height * 0.625, width: x.width * 0.375, height: x.height * 0.375 }; });
        await s.screenshot({ path: path.join(BILDER, `${id}-${modus}.png`), clip: r });
      }
    }
    await k.close();
  }
} finally {
  await browser.close(); server.close();
}
if (BILDER) writeFileSync(path.join(BILDER, 'messung.json'), JSON.stringify(zeilen, null, 1));
const schwach = zeilen.flatMap((z) => [z.hell, z.dunkel]).filter((x) => x != null);
console.log(`schwaechster Wert ${Math.min(...schwach)}:1 ueber ${zeilen.length} Brett-Modus-Paare`);
console.log(`${ok}/${ok + fehler} bestanden`);
process.exit(fehler ? 1 : 0);
