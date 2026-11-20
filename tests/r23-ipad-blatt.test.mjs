// iPad-Probe Shop-Blatt (fc-06:20, Fenster 43): Der Knopf "Fertig" klebt im scrollenden Blatt (.sheet-karte.sa-blatt) unten.
// Mit position: sticky; bottom: -22px ohne eigenen Abstand unten sass er genau auf der Unterkante des Blatts: unterer Rand
// und runde Ecken vom Blatt abgeschnitten (gemessen iPad mini 744x1133: Knopf unten 1121, Blatt unten 1121).
// Geprueft je Groesse (iPad Air und mini hoch und quer, Handy, PC), oben im Blatt und ganz nach unten gescrollt:
//   - der Knopf liegt ganz im Blatt, mit mindestens 12 px Luft zur Unterkante
//   - ein Punkt 2 px ueber seiner Unterkante trifft den Knopf (nichts davor, nichts abgeschnitten)
//   - ganz unten ist die Luft hoechstens 30 px (kein doppelter Abstand)
//   node tests/r23-ipad-blatt.test.mjs        (PLAYWRIGHT_PFAD)
import http from 'node:http';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { browserTyp } from './browser.mjs';
import { freierPort } from './freier-port.mjs';

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
const GROESSEN = [['ipad-mini-hoch', 744, 1133], ['ipad-mini-quer', 1133, 744], ['ipad-air-hoch', 820, 1180], ['ipad-air-quer', 1180, 820],
  ['handy', 390, 844], ['pc', 1440, 900]];

const lage = (s) => s.evaluate(() => {
  const k = document.querySelector('.sheet-karte.sa-blatt');
  const f = k && [...k.querySelectorAll('.sheet-knoepfe button')].find((x) => x.getBoundingClientRect().width > 0);
  if (!f) return null;
  const kr = k.getBoundingClientRect(); const fr = f.getBoundingClientRect();
  const t = document.elementFromPoint(fr.left + fr.width / 2, fr.bottom - 2);
  return { luft: Math.round(kr.bottom - fr.bottom), drin: fr.top >= kr.top && fr.left >= kr.left && fr.right <= kr.right && fr.bottom <= kr.bottom,
    getroffen: !!t && (t === f || f.contains(t)), knopf: [Math.round(fr.top), Math.round(fr.bottom)], blatt: [Math.round(kr.top), Math.round(kr.bottom)],
    scrollt: k.scrollHeight > k.clientHeight + 2 };
});

const browser = await browserTyp(pw).launch({ headless: true });
try {
  for (const [g, w, h] of GROESSEN) {
    const k = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block', hasTouch: w < 1300, locale: 'de-DE' });
    await k.route('**/*', (r) => (new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort()));
    await k.addInitScript(() => {
      try { localStorage.setItem('schach-arena:v1:modul:start', JSON.stringify({ v: 1, gesehen: '2026-11-01' })); } catch (e) { /* egal */ } // INTENTIONAL-SLOP[F1]: Speicher gesperrt heisst Probe ohne Vorbelegung
    });
    const s = await k.newPage(); s.setDefaultTimeout(15000);
    const seitenfehler = [];
    s.on('pageerror', (e) => seitenfehler.push(e.message));
    try {
      await s.goto(`http://127.0.0.1:${PORT}/index.html?test#heim`);
      await s.waitForFunction(() => !!window.__app && !!document.documentElement.dataset.screen, null, { timeout: 30000 });
      await s.evaluate(() => window.__app.gehe('ich', { bereich: 'shop' }));
      const da = await s.waitForFunction(() => { const k = document.querySelector('.sheet-karte.sa-blatt');
        return !!k && [...k.querySelectorAll('.sheet-knoepfe button')].some((x) => x.getBoundingClientRect().width > 0); }, null, { timeout: 10000 }).then(() => true, () => false);
      pruefe(`${g}: Shop-Blatt mit Knopf "Fertig" offen`, da);
      if (da) {
        await s.waitForTimeout(800);
        const oben = await lage(s);
        pruefe(`${g}: oben im Blatt liegt "Fertig" ganz im Blatt, mindestens 12 px ueber der Unterkante, nichts davor`,
          !!oben && oben.drin && oben.luft >= 12 && oben.getroffen, oben);
        await s.evaluate(() => { const k = document.querySelector('.sheet-karte.sa-blatt'); k.scrollTop = k.scrollHeight; });
        await s.waitForTimeout(500);
        const unten = await lage(s);
        pruefe(`${g}: ganz unten gescrollt liegt "Fertig" ganz im Blatt, 12 bis 30 px ueber der Unterkante, nichts davor`,
          !!unten && unten.drin && unten.luft >= 12 && unten.luft <= 30 && unten.getroffen, unten);
      }
    } catch (e) {
      pruefe(`${g}: Ablauf ohne Abbruch`, false, e.message.split('\n')[0]);
    }
    pruefe(`${g}: keine Seitenfehler`, seitenfehler.length === 0, seitenfehler.slice(0, 3));
    await k.close();
  }
} finally {
  await browser.close();
  server.close();
}
console.log(`${ok}/${ok + fehler} bestanden`); // INTENTIONAL-SLOP[T4]: die Konsole ist der Ausgabeweg der Probe (tests/alle.mjs liest sie)
process.exit(fehler ? 1 : 0);
