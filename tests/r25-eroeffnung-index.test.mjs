// R25 F1 (fc-11:00 Ergaenzung, Leistungsbericht von 19, R20-Kritik/leistung): beim Start der Bot-Partie baute
// zeichneKopf (js/ui/partie.js) ueber eroeffnung([]) den ganzen Eroeffnungs-Index (js/openings.js index(): alle Linien
// mit chess.js nachgespielt), bei 6x Drossel rund 465 ms im einen Long Task des Aufbaus. Mit 0 Zuegen braucht der Kopf
// keinen Index ("Grundstellung").
//   Node: eroeffnung([]) baut ihn nicht; eroeffnungVorbereiten() baut ihn in Stuecken und ergibt dieselben Antworten wie
//         der Aufbau in einem Zug, auch wenn mitten im Aufbau gefragt wird.
//   Browser (Chromium): beim Start der Bot-Partie ist der Index im ersten Bild mit Brett noch nicht gebaut, kurz danach
//         in Stuecken schon.
//   node tests/r25-eroeffnung-index.test.mjs
import http from 'node:http';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { browserTyp } from './browser.mjs';

let ok = 0, gesamt = 0;
function pruefe(name, gut, detail = '') { gesamt++; if (gut) ok++; console.log(`${gut ? 'ok  ' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(detail)}`); }

// ---- Node: je Pruefung eine frische Modul-Instanz (eigene Query), damit der Index jedes Mal neu entsteht ----
const modul = (k) => import(`../js/openings.js?${k}`);
const ref = await modul('ref');
const LINIEN = ref.EROEFFNUNGEN.map((e) => e.zuege.trim().split(/\s+/));
const antworten = (m) => LINIEN.map((l) => m.eroeffnung(l));
const soll = antworten(ref);
pruefe('Referenz: Tabelle ohne Fehler', ref.tabellenFehler().length === 0, ref.tabellenFehler());

const a = await modul('leer');
pruefe('openings.js exportiert eroeffnungVorbereiten und eroeffnungBereit',
  typeof a.eroeffnungVorbereiten === 'function' && typeof a.eroeffnungBereit === 'function');
if (typeof a.eroeffnungBereit === 'function') {
  pruefe('frisch: Index noch nicht gebaut', a.eroeffnungBereit() === false);
  const leer = a.eroeffnung([]);
  pruefe('eroeffnung([]) wie bisher: kein Name, leere Listen', leer.name === null && leer.buch.length === 0 && leer.namen.length === 0, leer);
  pruefe('eroeffnung([]) baut den Index nicht', a.eroeffnungBereit() === false);
  const leer2 = a.eroeffnung('');
  pruefe('eroeffnung("") ebenso', leer2.name === null && leer2.buch.length === 0 && a.eroeffnungBereit() === false, leer2);
}

if (typeof a.eroeffnungVorbereiten === 'function') {
  const b = await modul('stuecke');
  let stuecke = 0;
  const p = b.eroeffnungVorbereiten({ beiStueck: () => { stuecke++; }, stueckMs: 2 });
  pruefe('eroeffnungVorbereiten arbeitet nicht sofort (erstes Stueck erst spaeter)', b.eroeffnungBereit() === false && stuecke === 0, stuecke);
  await p;
  pruefe(`Aufbau in mehreren Stuecken (${stuecke})`, stuecke > 1, stuecke);
  pruefe('danach gebaut', b.eroeffnungBereit() === true);
  pruefe('Stueck-Aufbau: alle Antworten gleich dem Aufbau in einem Zug', JSON.stringify(antworten(b)) === JSON.stringify(soll));
  pruefe('Stueck-Aufbau: Tabelle ohne Fehler', b.tabellenFehler().length === 0);
  const b2 = b.eroeffnungVorbereiten();
  pruefe('zweiter Aufruf nach dem Aufbau: sofort erfuellt', b2 instanceof Promise && b.eroeffnungBereit());
  await b2;

  // mitten im Aufbau gefragt: der Rest wird sofort fertig gebaut, die Antwort stimmt, der Stueck-Aufbau endet still
  const c = await modul('mitten');
  let n = 0;
  const pc = c.eroeffnungVorbereiten({ beiStueck: () => { n++; }, stueckMs: 2 });
  await new Promise((r) => setTimeout(r, 0)); await new Promise((r) => setTimeout(r, 0));
  const mitte = c.eroeffnung(LINIEN[0]);
  pruefe(`mitten im Aufbau gefragt (nach ${n} Stueck(en)): Index fertig`, c.eroeffnungBereit() === true);
  pruefe('mitten im Aufbau: Antwort wie die Referenz', JSON.stringify(mitte) === JSON.stringify(soll[0]), mitte);
  await pc;
  pruefe('mitten im Aufbau: danach alle Antworten gleich', JSON.stringify(antworten(c)) === JSON.stringify(soll));
}

// ---- Browser: Partie-Start ----
const require = createRequire(import.meta.url);
let pw;
for (const pfad of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
  try { pw = require(pfad); break; } catch (e) { /* naechster */ }
}
if (!pw) throw new Error('Playwright fehlt (PLAYWRIGHT_PFAD setzen)');
const root = fileURLToPath(new URL('../', import.meta.url));
const typen = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg' };
const server = http.createServer((req, res) => {
  const p = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://test').pathname).replace(/\/$/, '/index.html'));
  if (!p.startsWith(root)) { res.writeHead(403); res.end(); return; }
  try { const d = readFileSync(p); res.writeHead(200, { 'Content-Type': typen[path.extname(p)] || 'application/octet-stream' }); res.end(d); }
  catch (e) { res.writeHead(404); res.end(); }
});
const PORT = Number(process.env.PORT) || await (await import('./freier-port.mjs')).freierPort();
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
let browser;
try {
  browser = await browserTyp(pw).launch({ headless: true });
  const k = await browser.newContext({ viewport: { width: 375, height: 667 }, deviceScaleFactor: 1, hasTouch: true, serviceWorkers: 'block', locale: 'de-DE' });
  const s = await k.newPage();
  const fehler = [];
  s.on('pageerror', (e) => fehler.push(e.message));
  await s.goto(`http://127.0.0.1:${PORT}/index.html?test#arena`);
  await s.waitForFunction(() => window.__app && document.documentElement.dataset.screen === 'arena', null, { timeout: 30000 });
  await new Promise((r) => setTimeout(r, 600));
  const m = await s.evaluate(async () => {
    const o = await import('./js/openings.js');
    const vorher = typeof o.eroeffnungBereit === 'function' ? o.eroeffnungBereit() : null;
    window.__app.gehe('partie', { botId: 'benno' });
    // erstes Bild, in dem das Brett Felder hat: dann ist der Aufbau durch
    const imBild = await new Promise((r) => { const f = () => { if (document.querySelector('.screen.partie .brett-rahmen > .brett .feld')) r(typeof o.eroeffnungBereit === 'function' ? o.eroeffnungBereit() : 'fehlt'); else requestAnimationFrame(f); }; requestAnimationFrame(f); });
    const t0 = performance.now();
    while (typeof o.eroeffnungBereit === 'function' && !o.eroeffnungBereit() && performance.now() - t0 < 8000) await new Promise((r) => setTimeout(r, 50));
    return { vorher, imBild, spaeter: typeof o.eroeffnungBereit === 'function' ? o.eroeffnungBereit() : 'fehlt', ms: Math.round(performance.now() - t0) };
  });
  pruefe('Arena: Index noch nicht gebaut', m.vorher === false, m);
  pruefe('Bot-Partie: im ersten Bild mit Brett ist der Index noch nicht gebaut (nicht im Aufbau)', m.imBild === false, m);
  pruefe(`Bot-Partie: kurz danach in Stuecken gebaut (${m.ms} ms)`, m.spaeter === true, m);
  pruefe('keine Seitenfehler', !fehler.length, fehler);
  await k.close();
} catch (e) { pruefe('Browser-Teil laeuft', false, e.stack); }
finally { await browser?.close(); await new Promise((r) => server.close(r)); }
console.log(`${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
