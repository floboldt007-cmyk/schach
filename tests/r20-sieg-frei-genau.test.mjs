// fc-04:00 a (Zustands-Bericht 20.11.): Nach einem Sieg in einer NICHT wertenden Partie (frei, Kurs Kapitel 6) stand
// unter "Schachmatt im 4. Zug ..." eine leere Flaeche. js/ui/partie.js baut dort ohne Sterne nur die grosse Genauigkeit
// (.erg-genau.gross in .erg-mitte, min-height 80px); css/ergebnis.css versteckte beim Sieg aber jede .erg-genau, weil sie
// in Variante C (Flos Wahl 09.11.) im mittleren Stern steht. Ohne Sterne gibt es diesen Stern nicht.
//   - frei und Kurs: die Genauigkeit ist sichtbar, .erg-mitte ist kein leerer Rahmen (hell, dunkel, Bewegung reduziert)
//   - wertend (Gegenprobe Variante C): Sterne sichtbar, die Genauigkeit neben ihnen weiter versteckt
//
//   node tests/r20-sieg-frei-genau.test.mjs
//   PORT=9793 node tests/r20-sieg-frei-genau.test.mjs    Port des Testservers (sonst: frei)
//
// Playwright: PLAYWRIGHT_PFAD, sonst 'playwright', sonst /opt/node-tools/node_modules/playwright.
import http from 'node:http';
import { appHeute } from './app-heute.mjs';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..') + path.sep;
let pw = null;
for (const k of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
  try { pw = require(k); break; } catch (e) { /* naechster */ }
}
if (!pw) throw new Error('Playwright fehlt (PLAYWRIGHT_PFAD setzen)');

let gesamt = 0, ok = 0;
function pruefe(name, gut, detail = '') {
  gesamt++; if (gut) ok++;
  const d = typeof detail === 'string' ? detail : JSON.stringify(detail);
  console.log(`${gut ? 'ok    ' : 'FEHLER'} ${name}${!gut && d ? ' ' + d : ''}`);
}

const typen = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' };
const server = http.createServer((req, res) => {
  const p = path.resolve(WURZEL, '.' + decodeURIComponent(new URL(req.url, 'http://test').pathname).replace(/\/$/, '/index.html'));
  if (!p.startsWith(WURZEL)) { res.writeHead(403); res.end(); return; }
  try { res.writeHead(200, { 'Content-Type': typen[path.extname(p)] || 'application/octet-stream' }); res.end(readFileSync(p)); }
  catch (e) { res.writeHead(404); res.end(); }
});
const PORT = Number(process.env.PORT) || await (await import('./freier-port.mjs')).freierPort();
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
const HOST = `http://127.0.0.1:${PORT}/`;
const P = 'schach-arena:v1:';
const PS = '.screen.partie:not(.online-screen)';
const MATT = ['e2e4', 'f1c4', 'd1h5', 'h5f7'];

const browser = await pw.chromium.launch();
// T-072: "heute" wie die App (js/tag.js, Tagesgrenze 4 Uhr), nicht das UTC-Datum
const HEUTE = await appHeute(browser, HOST);
const fehler = [];
async function seite({ modus = 'hell', breite = 390, hoehe = 844, bewegung = 'no-preference' } = {}) {
  const k = await browser.newContext({ viewport: { width: breite, height: hoehe }, hasTouch: true, reducedMotion: bewegung });
  await k.route('**/*', (r) => (new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort()));
  await k.addInitScript((sp) => {
    if (sessionStorage.getItem('vorbelegt')) return; sessionStorage.setItem('vorbelegt', '1');
    for (const [s, w] of Object.entries(sp)) localStorage.setItem(s, typeof w === 'string' ? w : JSON.stringify(w));
  }, { [P + 'modul:start']: { gesehen: HEUTE }, [P + 'hinweis-installieren']: '1', [P + 'einstellungen']: { sprache: 'de', spracheGewaehlt: true, modus } });
  const s = await k.newPage();
  s.on('pageerror', (e) => fehler.push(e.message));
  await s.goto(HOST + '?test#heim');
  await s.waitForFunction(() => !!window.__app, null, { timeout: 15000 });
  // die Startseite fertig aufbauen lassen: ein Sprung gleich nach dem Laden fuehrt sonst die Partie zur Arena (Router-Start)
  await s.waitForTimeout(2500);
  return { k, s };
}
// der Bot spielt das Schaefermatt mit (Testplan wie tests/r20-kurs-zurueck.test.mjs)
const botPlan = (s) => s.evaluate(() => { const plan = { e2e4: 'e7e5', f1c4: 'b8c6', d1h5: 'g8f6' };
  window.__test = { ...(window.__test || {}), botZug: () => { const v = window.__partie.chess().history({ verbose: true }); return plan[v[v.length - 1].lan] || null; } }; });
async function ziehe(s, zuege) {
  for (const uci of zuege) {
    await s.waitForFunction(() => window.__partie && window.__partie.bereit === true && window.__partie.phase() === 'flo', null, { timeout: 30000 }).catch(() => {});
    for (const f of [uci.slice(0, 2), uci.slice(2, 4)]) await s.locator(`${PS} .brett-felder .feld[data-feld="${f}"]`).click({ timeout: 5000 }).catch(() => {});
    if (await s.locator(`${PS} .brett .lage.vorschau`).count()) await s.locator(`${PS} .brett-felder .feld[data-feld="${uci.slice(2, 4)}"]`).click({ timeout: 5000 }).catch(() => {});
  }
}
async function siegBlatt(s, start) {
  await start(s);
  await s.waitForFunction(() => window.__partie && window.__partie.bereit === true, null, { timeout: 30000 }).catch(() => {});
  await botPlan(s);
  await ziehe(s, MATT);
  const sieg = await s.waitForSelector('.ergebnis-overlay.sieg.gefuellt', { timeout: 40000 }).then(() => true).catch(() => false);
  // Genauigkeit wird nachgerechnet (erg-rechnet), danach steht sie fest
  await s.waitForFunction(() => !document.querySelector('.ergebnis-overlay .erg-rechnet'), null, { timeout: 20000 }).catch(() => {});
  await s.waitForTimeout(1200);
  return { sieg, ...(await s.evaluate(() => {
    const sicht = (e) => { if (!e) return false; const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && getComputedStyle(e).visibility === 'visible'; };
    const mitte = document.querySelector('.ergebnis-overlay .erg-mitte');
    const g = document.querySelector('.ergebnis-overlay .erg-genau');
    return { chip: document.querySelector('.ergebnis-overlay .erg-kopf .chip')?.textContent.trim() || '',
      genauSichtbar: sicht(g), genauText: g ? g.textContent.replace(/\s+/g, ' ').trim().slice(0, 40) : '',
      sterneSichtbar: sicht(document.querySelector('.ergebnis-overlay .erg-sterne')),
      mitteHoehe: mitte ? Math.round(mitte.getBoundingClientRect().height) : -1,
      mitteSichtbareKinder: mitte ? [...mitte.querySelectorAll('*')].filter(sicht).length : -1 };
  })) };
}
const frei = (s) => s.evaluate(() => window.__app.gehe('partie', { botId: 'fridolin', farbe: 'w', modus: 'frei' }));
const kurs = async (s) => {
  await s.evaluate(() => window.__app.gehe('lektion', { id: 'es-partie' }));
  await s.waitForSelector('.ls-partie [data-a="partie"]', { timeout: 15000 }).catch(() => {});
  await botPlan(s);
  await s.locator('.ls-partie [data-a="partie"]').click({ timeout: 5000 }).catch(() => {});
};
const wertend = (s) => s.evaluate(() => { localStorage.removeItem('schach-arena:v1:laufend'); window.__app.gehe('partie', { botId: 'benno', farbe: 'w' }); });

for (const [name, start, opt] of [
  ['freie Partie, iPhone 13 hell', frei, {}],
  ['freie Partie, iPhone 13 dunkel', frei, { modus: 'dunkel' }],
  ['freie Partie, PC dunkel, Bewegung reduziert', frei, { modus: 'dunkel', breite: 1280, hoehe: 800, bewegung: 'reduce' }],
  ['Kurs-Partie (es-partie), iPhone SE hell', kurs, { breite: 375, hoehe: 667 }],
]) {
  const { k, s } = await seite(opt);
  const r = await siegBlatt(s, start);
  pruefe(`${name}: Genauigkeit sichtbar, kein leerer Rahmen unter der Unterzeile`,
    r.sieg && !r.sterneSichtbar && r.genauSichtbar && /%/.test(r.genauText) && r.mitteSichtbareKinder > 0, r);
  await k.close();
}
{
  const { k, s } = await seite();
  const r = await siegBlatt(s, wertend);
  pruefe('wertende Partie (Variante C): Sterne sichtbar, Genauigkeit daneben versteckt', r.sieg && r.sterneSichtbar && !r.genauSichtbar, r);
  await k.close();
}

pruefe('keine Seitenfehler', fehler.length === 0, fehler);
await browser.close(); server.close();
console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
