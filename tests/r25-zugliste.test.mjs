// R25 F4 (fc-11:00 Ergaenzung, Leistungsbericht von 19, R20-Kritik/leistung): zeichneZugliste (js/ui/partie.js) baute
// Zugliste und Zugstreifen bei jedem Zug per innerHTML neu, samt den Pfeilknoepfen im Streifen, und las danach
// scrollHeight/scrollWidth (erzwungenes Layout, beim ersten Zug bei 6x 75 bis 171 ms). Lag der Tastatur-Fokus auf einem
// Pfeil, waehrend der Bot zog, verschwand der fokussierte Knopf und mit ihm der Fokus.
// Jetzt: die Liste wird nur ergaenzt (alte Zellen bleiben dieselben Knoten), die Pfeile bleiben stehen, der Fokus
// ueberlebt den Bot-Zug, Enter auf dem Pfeil blaettert weiter; Aufbau der Liste wie bisher.
//   node tests/r25-zugliste.test.mjs          (BROWSER=webkit fuer WebKit)
import http from 'node:http';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { browserTyp } from './browser.mjs';

const require = createRequire(import.meta.url);
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const warte = (ms) => new Promise((r) => setTimeout(r, ms));
let ok = 0, gesamt = 0;
function pruefe(name, gut, detail = '') { gesamt++; if (gut) ok++; console.log(`${gut ? 'ok  ' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(detail)}`); }

let pw;
for (const k of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
  try { pw = require(k); break; } catch (e) { /* naechster */ }
}
if (!pw) throw new Error('Playwright nicht gefunden (PLAYWRIGHT_PFAD setzen)');
const TYPEN = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json' };
const server = http.createServer(async (q, r) => {
  try {
    const p = decodeURIComponent(new URL(q.url, 'http://x').pathname);
    const d = await readFile(path.join(WURZEL, p === '/' ? 'index.html' : p));
    r.writeHead(200, { 'Content-Type': TYPEN[path.extname(p)] || 'application/octet-stream' });
    r.end(d);
  } catch (e) { r.writeHead(404); r.end(); }
});

// Benno antwortet nach Plan
const PLAN = { e2e4: 'e7e5', g1f3: 'b8c6', f1c4: 'g8f6' };

// Aufbau der Liste: Zellen in Zugfolge, genau eine .aktuell auf dem letzten Zug, Nummern 1., 2., ...
const aufbau = () => {
  const n = window.__partie.chess().history().length;
  const pruef = (sel) => {
    const zellen = [...document.querySelectorAll(`.screen.partie ${sel} .z[data-ply]`)];
    const plys = zellen.map((z) => Number(z.dataset.ply));
    const aktuell = zellen.filter((z) => z.classList.contains('aktuell')).map((z) => Number(z.dataset.ply));
    return { plys: plys.join(','), soll: [...Array(n).keys()].join(','), aktuell: aktuell.join(','), sollAktuell: String(n - 1) };
  };
  const nr = [...document.querySelectorAll('.screen.partie .zugliste .nr')].map((e) => e.textContent).join(' ');
  return { liste: pruef('.zugliste'), leiste: pruef('.zugleiste'), nr, n };
};

await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await browserTyp(pw).launch();
const fehler = [];
try {
  // grosses iPhone hoch: der Zugstreifen mit Pfeilen steht nur hochkant bis 600 px Breite ab 760 px Hoehe (css/partie.css)
  const k = await browser.newContext({ viewport: { width: 430, height: 932 }, locale: 'de-DE', serviceWorkers: 'block', hasTouch: true });
  await k.addInitScript(() => {
    try { if (!localStorage.getItem('schach-arena:v1:modul:start')) localStorage.setItem('schach-arena:v1:modul:start', JSON.stringify({ v: 1, gesehen: '2026-11-01' })); } catch (e) { /* egal */ }
  });
  const s = await k.newPage();
  s.on('pageerror', (e) => fehler.push(e.message));
  await s.goto(`http://127.0.0.1:${server.address().port}/index.html?test#heim`);
  await s.waitForFunction(() => window.__app && document.documentElement.dataset.screen, null, { timeout: 30000 });
  await warte(1200);
  await s.evaluate((p) => {
    localStorage.removeItem('schach-arena:v1:laufend');
    window.__test = { botZug: () => { const v = window.__partie.chess().history({ verbose: true }); return p[v[v.length - 1].lan] || null; } };
  }, PLAN);
  await s.evaluate(() => window.__app.gehe('partie', { botId: 'benno', farbe: 'w' }));
  await s.waitForFunction(() => window.__partie && window.__partie.bereit === true && window.__partie.phase() === 'flo', null, { timeout: 30000 });
  pruefe('Zugstreifen sichtbar (Handy hoch)', await s.evaluate(() => !!document.querySelector('.screen.partie .zugleiste')?.getClientRects().length));

  for (const [i, z] of ['e2e4', 'g1f3', 'f1c4'].entries()) {
    await s.waitForFunction(() => window.__partie.phase() === 'flo', null, { timeout: 30000 });
    for (const f of [z.slice(0, 2), z.slice(2, 4)]) await s.locator(`.screen.partie .brett-felder .feld[data-feld="${f}"]`).click();
    // gleich nach dem eigenen Zug: Fokus auf den Pfeil "zurueck" im Streifen, dann zieht der Bot
    const vor = await s.evaluate(() => {
      const p = document.querySelector('.screen.partie .zugleiste .zl-zurueck');
      p.focus();
      window.__pfeil = p;
      // die Nummer "1." aendert sich nie (die Zelle des letzten Zugs dagegen verliert .aktuell und wird ersetzt)
      window.__zelle0 = document.querySelector('.screen.partie .zugliste .nr');
      return { fokus: document.activeElement === p, zuege: window.__partie.chess().history().length };
    });
    pruefe(`Zug ${i + 1}: Fokus auf dem Pfeil, bevor der Bot zieht`, vor.fokus && vor.zuege === 2 * i + 1, vor);
    await s.waitForFunction((n) => window.__partie.chess().history().length >= n && window.__partie.phase() === 'flo', 2 * i + 2, { timeout: 30000 });
    await s.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const nach = await s.evaluate(() => ({
      gleicherPfeil: window.__pfeil.isConnected && document.querySelector('.screen.partie .zugleiste .zl-zurueck') === window.__pfeil,
      fokus: document.activeElement === window.__pfeil,
      aktiv: document.activeElement ? document.activeElement.className : null,
      zelleBleibt: !!window.__zelle0 && window.__zelle0.isConnected,
    }));
    pruefe(`Zug ${i + 1}: der Pfeil ist nach dem Bot-Zug derselbe Knopf`, nach.gleicherPfeil, nach);
    pruefe(`Zug ${i + 1}: der Fokus ueberlebt den Bot-Zug`, nach.fokus, nach);
    pruefe(`Zug ${i + 1}: alte Zelle bleibt derselbe Knoten (Liste nur ergaenzt)`, nach.zelleBleibt, nach);
    const a = await s.evaluate(aufbau);
    pruefe(`Zug ${i + 1}: Liste und Streifen in Zugfolge, .aktuell auf dem letzten Zug`,
      a.liste.plys === a.liste.soll && a.leiste.plys === a.leiste.soll && a.liste.aktuell === a.liste.sollAktuell && a.leiste.aktuell === a.leiste.sollAktuell, a);
    pruefe(`Zug ${i + 1}: Zugnummern ${a.nr}`, a.nr === [...Array(Math.ceil(a.n / 2)).keys()].map((x) => `${x + 1}.`).join(' '), a);
  }
  // Tastatur: Enter auf dem fokussierten Pfeil blaettert einen Zug zurueck
  await s.keyboard.press('Enter');
  await warte(300);
  const b = await s.evaluate(() => ({ angesehen: document.querySelector('.screen.partie .zugleiste .z.angesehen')?.dataset.ply ?? null, fokus: document.activeElement === window.__pfeil }));
  pruefe('Enter auf dem Pfeil blaettert zurueck (Zug 5 angesehen), Fokus bleibt', b.angesehen === '4' && b.fokus, b);
  pruefe('keine Seitenfehler', !fehler.length, fehler);
  await k.close();
} catch (e) { pruefe('Browser-Teil laeuft', false, e.stack); }
finally { await browser.close(); server.close(); }
console.log(`${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
