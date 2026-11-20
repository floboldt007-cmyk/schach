// Wegwerf-Werkzeug (fc-04:00 b): Varianten fuer die Brett-Koordinaten messen und fotografieren, nichts am App-Code.
// Je Variante (jetzt + v*.css hier im Ordner) x Brett (nacht, holz) x Modus (hell, dunkel): Kontrast der Koordinate
// gegen ihr Feld (helles und dunkles Feld) und ein Bild der unteren linken Brettecke, iPhone 13.
//   node werkzeuge/koord-varianten/messen.mjs <bildordner>      (Server auf 9812 startet das Skript selbst)
import http from 'node:http';
import path from 'node:path';
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT_PFAD);
const HIER = path.dirname(fileURLToPath(import.meta.url));
const WURZEL = path.resolve(HIER, '../..') + path.sep;
const ziel = process.argv[2]; mkdirSync(ziel, { recursive: true });
const typen = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' };
const server = http.createServer((req, res) => {
  const p = path.resolve(WURZEL, '.' + decodeURIComponent(new URL(req.url, 'http://t').pathname).replace(/\/$/, '/index.html'));
  if (!p.startsWith(WURZEL)) { res.writeHead(403); res.end(); return; }
  try { res.writeHead(200, { 'Content-Type': typen[path.extname(p)] || 'application/octet-stream' }); res.end(readFileSync(p)); }
  catch (e) { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(9812, '127.0.0.1', r));

const VARIANTEN = [['jetzt', ''], ...readdirSync(HIER).filter((f) => /^v\d.*\.css$/.test(f)).sort().map((f) => [f.replace(/\.css$/, ''), readFileSync(path.join(HIER, f), 'utf8')])];
const HEUTE = new Date().toISOString().slice(0, 10);
const b = await pw.chromium.launch();
const zeilen = [];
for (const brett of ['nacht', 'holz']) for (const modus of ['hell', 'dunkel']) {
  const k = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true });
  await k.addInitScript((e) => {
    if (sessionStorage.getItem('v')) return; sessionStorage.setItem('v', '1');
    const P = 'schach-arena:v1:';
    localStorage.setItem(P + 'modul:start', JSON.stringify({ gesehen: e.heute }));
    localStorage.setItem(P + 'hinweis-installieren', '1');
    localStorage.setItem(P + 'einstellungen', JSON.stringify({ sprache: 'de', spracheGewaehlt: true, modus: e.modus, brett: e.brett }));
  }, { heute: HEUTE, modus, brett });
  const s = await k.newPage();
  await s.goto('http://127.0.0.1:9812/?test#heim');
  await s.waitForFunction(() => !!window.__app, null, { timeout: 15000 });
  await s.waitForTimeout(2500);
  await s.evaluate(() => window.__app.gehe('partie', { botId: 'fridolin', farbe: 'w', modus: 'frei' }));
  await s.waitForSelector('.screen.partie .brett .koord', { timeout: 20000 });
  await s.waitForTimeout(1200);
  for (const [name, css] of VARIANTEN) {
    await s.evaluate(() => document.getElementById('koord-variante')?.remove());
    if (css) await s.addStyleTag({ content: css }).then((h) => h.evaluate((e) => { e.id = 'koord-variante'; }));
    await s.waitForTimeout(150);
    const m = await s.evaluate(() => {
      const zuRgb = (t) => { const c = document.createElement('canvas').getContext('2d'); c.fillStyle = '#000'; c.fillStyle = t; c.fillRect(0, 0, 1, 1); return [...c.getImageData(0, 0, 1, 1).data].slice(0, 3); };
      const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
      const kon = (a, b) => { const x = lum(a), y = lum(b); return +((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)).toFixed(2); };
      const o = {};
      for (const art of ['h', 'd']) {
        const e = document.querySelector(`.screen.partie .brett .feld.${art} .koord`); if (!e) continue;
        const st = getComputedStyle(e);
        o[art] = { kontrast: kon(zuRgb(st.color), zuRgb(getComputedStyle(e.closest('.feld')).backgroundColor)), groesse: st.fontSize, schatten: st.textShadow !== 'none' };
      }
      const r = document.querySelector('.screen.partie .brett').getBoundingClientRect();
      return { ...o, clip: { x: r.left, y: r.top + r.height * 0.5, width: r.width * 0.5, height: r.height * 0.5 } };
    });
    const datei = `${name}-${brett}-${modus}.png`;
    await s.screenshot({ path: path.join(ziel, datei), clip: m.clip });
    zeilen.push({ variante: name, brett, modus, hell: m.h?.kontrast, dunkel: m.d?.kontrast, groesse: m.d?.groesse, schatten: m.d?.schatten, bild: datei });
    console.log(`${name.padEnd(14)} ${brett.padEnd(6)} ${modus.padEnd(7)} helles Feld ${m.h?.kontrast}:1  dunkles Feld ${m.d?.kontrast}:1  ${m.d?.groesse}${m.d?.schatten ? ' +Schatten' : ''}`);
  }
  await k.close();
}
writeFileSync(path.join(ziel, 'messung.json'), JSON.stringify(zeilen, null, 1));
await b.close(); server.close();
