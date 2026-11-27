// fc-02:20 a: Kapitel 6 (es-partie) zaehlte JEDE beendete freie Partie gegen den ersten Bot als Kurs-Partie
// (mattbilder.js kursPartieSterne). Frei startet aber nicht nur der Kurs: auch die Probe-Partie der Einstufung
// (js/pakete/start/dienst.js starteSpiel probe) und "Ab hier" einer freien Partie. Jetzt zaehlt nur eine Partie mit
// der Kurs-Kennung extra.lernen.kurs === 'es-partie' (gesetzt von js/ui/lektion.js ueber js/ui/partie.js).
// Wer den Stern schon hat, behaelt ihn (gespeicherte Sterne werden nicht zurueckgebaut).
//
//   node tests/r20-kurs-sterne.test.mjs
//   PORT=9795 node tests/r20-kurs-sterne.test.mjs    Port des Testservers (sonst: frei)
//
// Playwright: PLAYWRIGHT_PFAD, sonst 'playwright', sonst /opt/node-tools/node_modules/playwright.
import http from 'node:http';
import { appHeute } from './app-heute.mjs';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

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

// ---------- die Regel selbst (Node) ----------
const { kursPartieSterne } = await import(pathToFileURL(path.join(WURZEL, 'js/pakete/lernen/mattbilder.js')).href);
const zuege = ['e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6', 'Qxf7#'];
const kurs = { lernen: { kurs: 'es-partie' } };
pruefe('Regel: freie Partie gegen Bot 0 OHNE Kurs-Kennung zaehlt nicht',
  kursPartieSterne([{ modus: 'frei', botId: 'fridolin', ergebnis: 'sieg', zuege }], 'fridolin') === null,
  kursPartieSterne([{ modus: 'frei', botId: 'fridolin', ergebnis: 'sieg', zuege }], 'fridolin'));
const mit = kursPartieSterne([{ modus: 'frei', botId: 'fridolin', ergebnis: 'sieg', zuege, extra: kurs }], 'fridolin');
pruefe('Regel: Kurs-Partie gewonnen = 2 Sterne, 4 eigene Zuege', !!mit && mit.sterne === 2 && mit.zuege === 4, mit);
const verloren = kursPartieSterne([{ modus: 'frei', botId: 'fridolin', ergebnis: 'niederlage', zuege, extra: kurs }], 'fridolin');
pruefe('Regel: Kurs-Partie zu Ende gespielt = 1 Stern', !!verloren && verloren.sterne === 1, verloren);
pruefe('Regel: fremde Kennung, anderer Bot oder gewertete Partie zaehlen nicht', [
  { modus: 'frei', botId: 'fridolin', ergebnis: 'sieg', zuege, extra: { lernen: { kurs: 'andere' } } },
  { modus: 'frei', botId: 'benno', ergebnis: 'sieg', zuege, extra: kurs },
  { modus: 'normal', botId: 'fridolin', ergebnis: 'sieg', zuege, extra: kurs },
].every((p) => kursPartieSterne([p], 'fridolin') === null));

// ---------- in der App ----------
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
async function seite(extra = {}) {
  const k = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  await k.route('**/*', (r) => (new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort()));
  await k.addInitScript((sp) => {
    if (sessionStorage.getItem('vorbelegt')) return; sessionStorage.setItem('vorbelegt', '1');
    for (const [s, w] of Object.entries(sp)) localStorage.setItem(s, typeof w === 'string' ? w : JSON.stringify(w));
  }, { [P + 'modul:start']: { gesehen: HEUTE }, [P + 'hinweis-installieren']: '1', [P + 'einstellungen']: { sprache: 'de', spracheGewaehlt: true }, ...extra });
  const s = await k.newPage();
  s.on('pageerror', (e) => fehler.push(e.message));
  await s.goto(HOST + '?test#heim');
  await s.waitForFunction(() => !!window.__app, null, { timeout: 15000 });
  await s.waitForTimeout(2500);  // Startseite fertig, sonst fuehrt der Router die Partie zur Arena
  return { k, s };
}
const botPlan = (s) => s.evaluate(() => { const plan = { e2e4: 'e7e5', f1c4: 'b8c6', d1h5: 'g8f6' };
  window.__test = { ...(window.__test || {}), botZug: () => { const v = window.__partie.chess().history({ verbose: true }); return plan[v[v.length - 1].lan] || null; } }; });
async function ziehe(s, liste) {
  for (const uci of liste) {
    await s.waitForFunction(() => window.__partie && window.__partie.bereit === true && window.__partie.phase() === 'flo', null, { timeout: 30000 }).catch(() => {});
    for (const f of [uci.slice(0, 2), uci.slice(2, 4)]) await s.locator(`${PS} .brett-felder .feld[data-feld="${f}"]`).click({ timeout: 5000 }).catch(() => {});
    if (await s.locator(`${PS} .brett .lage.vorschau`).count()) await s.locator(`${PS} .brett-felder .feld[data-feld="${uci.slice(2, 4)}"]`).click({ timeout: 5000 }).catch(() => {});
  }
}
const ergebnisDa = (s) => s.waitForSelector('.ergebnis-overlay.sieg.gefuellt', { timeout: 40000 }).then(() => true).catch(() => false);
async function kursSterne(s) {
  await s.evaluate(() => window.__app.gehe('lernen', { bereich: 'erste' }));
  await s.waitForSelector('.ms-lektion[data-id="es-partie"]', { timeout: 10000 }).catch(() => {});
  await s.waitForTimeout(600);
  return s.evaluate(() => ({ sterne: document.querySelector('.ms-lektion[data-id="es-partie"] .ms-sterne')?.dataset.sterne ?? null,
    lek: (JSON.parse(localStorage.getItem('schach-arena:v1:modul:lernen') || '{}').lek || {})['es-partie'] || null }));
}

// freie Partie gegen Bot 0 wie die Probe-Partie der Einstufung (dienst.js: { botId, farbe: 'w', modus: 'frei' }), gewonnen
{
  const { k, s } = await seite();
  await s.evaluate(() => window.__app.gehe('partie', { botId: 'fridolin', farbe: 'w', modus: 'frei' }));
  await s.waitForFunction(() => window.__partie && window.__partie.bereit === true, null, { timeout: 30000 }).catch(() => {});
  await botPlan(s);
  await ziehe(s, MATT);
  const sieg = await ergebnisDa(s);
  await s.waitForTimeout(1200);
  const r = await kursSterne(s);
  pruefe('App: gewonnene freie Partie gegen Bot 0 ausserhalb des Kurses gibt Kapitel 6 KEINEN Stern',
    sieg && (r.sterne === '0' || r.sterne === '') && r.lek === null, { sieg, ...r });
  await k.close();
}

// die Kurs-Partie (aus der Lektion gestartet) gibt weiter 2 Sterne
{
  const { k, s } = await seite();
  await s.evaluate(() => window.__app.gehe('lektion', { id: 'es-partie' }));
  await s.waitForSelector('.ls-partie [data-a="partie"]', { timeout: 15000 }).catch(() => {});
  await botPlan(s);
  await s.locator('.ls-partie [data-a="partie"]').click({ timeout: 5000 }).catch(() => {});
  await ziehe(s, MATT);
  const sieg = await ergebnisDa(s);
  await s.waitForTimeout(1200);
  const r = await kursSterne(s);
  pruefe('App: gewonnene Kurs-Partie gibt Kapitel 6 zwei Sterne', sieg && r.sterne === '2' && !!r.lek && r.lek.s === 2, { sieg, ...r });
  await k.close();
}

// Bestand: wer den Stern schon hat (alter Spielstand ohne Kurs-Partie in der Liste), behaelt ihn
{
  const { k, s } = await seite({ [P + 'modul:lernen']: { lek: { 'es-partie': { s: 2, z: 4 } } } });
  const r = await kursSterne(s);
  pruefe('App: gespeicherte 2 Sterne aus der Zeit davor bleiben', r.sterne === '2' && !!r.lek && r.lek.s === 2, r);
  await k.close();
}

pruefe('keine Seitenfehler', fehler.length === 0, fehler);
await browser.close(); server.close();
console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
