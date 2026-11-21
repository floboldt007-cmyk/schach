// fc-00:35 c (Wunsch von 43): "Zurück zum Kurs" auf dem Ergebnisblatt der Kapitel-6-Partie (Kurs Erste Schritte, es-partie).
//   - nur die Kurs-Partie zeigt den Knopf; eine freie Partie gegen denselben Bot (gleiche Params ohne Kurs) nicht
//   - er fuehrt zur Kurs-Uebersicht (lernen, bereich 'erste'), dort stehen die Sterne der Partie sofort
//   - die Kennung haelt ein Neuladen mitten in der Partie aus (laufende Partie, extra.lernen)
//   - Wortlaut DE "Zurück zum Kurs", EN "Back to the course"
//
//   node tests/r20-kurs-zurueck.test.mjs
//   PORT=9793 node tests/r20-kurs-zurueck.test.mjs    Port des Testservers (sonst: frei)
//
// Playwright: PLAYWRIGHT_PFAD, sonst 'playwright', sonst /opt/node-tools/node_modules/playwright.
import http from 'node:http';
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
const HEUTE = new Date().toISOString().slice(0, 10);
const PS = '.screen.partie:not(.online-screen)';
const MATT = ['e2e4', 'f1c4', 'd1h5', 'h5f7'];
// Knopf und freie Partie auf beiden Geraeten (fc-05:20: eine Probe je Haupthandlung auf iPhone 13 und PC)
const GERAETE = [['iPhone 13', { viewport: { width: 390, height: 844 }, hasTouch: true }], ['PC', { viewport: { width: 1280, height: 800 } }]];

const browser = await pw.chromium.launch();
const fehler = [];
async function seite({ sprache = 'de', geraet = GERAETE[0][1] } = {}) {
  const k = await browser.newContext(geraet);
  await k.route('**/*', (r) => (new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort()));
  await k.addInitScript((sp) => {
    if (sessionStorage.getItem('vorbelegt')) return; sessionStorage.setItem('vorbelegt', '1');
    for (const [s, w] of Object.entries(sp)) localStorage.setItem(s, typeof w === 'string' ? w : JSON.stringify(w));
  }, { [P + 'modul:start']: { gesehen: HEUTE }, [P + 'hinweis-installieren']: '1', [P + 'einstellungen']: { sprache, spracheGewaehlt: true } });
  const s = await k.newPage();
  s.on('pageerror', (e) => fehler.push(e.message));
  await s.goto(HOST + '?test#heim');
  await s.waitForFunction(() => !!window.__app, null, { timeout: 15000 });
  // die Startseite fertig aufbauen lassen: ein Sprung gleich nach dem Laden fuehrt sonst die Partie zur Arena (Router-Start)
  await s.waitForTimeout(2500);
  return { k, s };
}
// der Bot spielt das Schaefermatt mit (Testplan wie tests/r20-erste-schritte.test.mjs)
const botPlan = (s) => s.evaluate(() => { const plan = { e2e4: 'e7e5', f1c4: 'b8c6', d1h5: 'g8f6' };
  window.__test = { ...(window.__test || {}), botZug: () => { const v = window.__partie.chess().history({ verbose: true }); return plan[v[v.length - 1].lan] || null; } }; });
async function ziehe(s, zuege) {
  for (const uci of zuege) {
    await s.waitForFunction(() => window.__partie && window.__partie.bereit === true && window.__partie.phase() === 'flo', null, { timeout: 30000 }).catch(() => {});
    for (const f of [uci.slice(0, 2), uci.slice(2, 4)]) await s.locator(`${PS} .brett-felder .feld[data-feld="${f}"]`).click({ timeout: 5000 }).catch(() => {});
    if (await s.locator(`${PS} .brett .lage.vorschau`).count()) await s.locator(`${PS} .brett-felder .feld[data-feld="${uci.slice(2, 4)}"]`).click({ timeout: 5000 }).catch(() => {});
  }
}
const ergebnisDa = (s) => s.waitForSelector('.ergebnis-overlay.sieg.gefuellt', { timeout: 40000 }).then(() => true).catch(() => false);
const kursKnopf = (s) => s.evaluate(() => { const b = document.querySelector('.ergebnis-overlay [data-ziel="kurs"]');
  return b ? { text: b.textContent.replace(/\s+/g, ' ').trim(), sichtbar: !!(b.offsetWidth && b.offsetHeight) } : null; });

// ---------- Kurs-Partie: Knopf, Wortlaut, Ziel, Sterne sofort ----------
for (const [g, geraet] of GERAETE) for (const [sprache, wort] of [['de', 'Zurück zum Kurs'], ['en', 'Back to the course']]) {
  const { k, s } = await seite({ sprache, geraet });
  await s.evaluate(() => window.__app.gehe('lektion', { id: 'es-partie' }));
  await s.waitForSelector('.ls-partie [data-a="partie"]', { timeout: 15000 }).catch(() => {});
  await botPlan(s);
  await s.locator('.ls-partie [data-a="partie"]').click({ timeout: 5000 }).catch(() => {});
  await ziehe(s, MATT);
  const sieg = await ergebnisDa(s);
  await s.waitForTimeout(1500);
  const knopf = await kursKnopf(s);
  pruefe(`${g} Kurs-Partie (${sprache}): Ergebnisblatt zeigt "${wort}"`, sieg && !!knopf && knopf.sichtbar && knopf.text === wort, { sieg, knopf });
  await s.locator('.ergebnis-overlay [data-ziel="kurs"]').click({ timeout: 5000 }).catch(() => {});
  await s.waitForSelector('.ms-lektion[data-id="es-partie"]', { timeout: 10000 }).catch(() => {});
  const ziel = await s.evaluate(() => ({ hash: location.hash, screen: document.querySelector('.screen')?.className || '',
    kurs: !!document.querySelector('.ms-lektion[data-id="es-partie"]'),
    sterne: document.querySelector('.ms-lektion[data-id="es-partie"] .ms-sterne')?.dataset.sterne || '' }));
  pruefe(`${g} Kurs-Partie (${sprache}): der Knopf fuehrt zur Kurs-Uebersicht, es-partie dort sofort mit 2 Sternen`,
    ziel.kurs && /ms-screen/.test(ziel.screen) && ziel.sterne === '2', ziel);
  await k.close();
}

// ---------- freie Partie gegen denselben Bot, nicht aus dem Kurs: kein Knopf ----------
for (const [g, geraet] of GERAETE) {
  const { k, s } = await seite({ geraet });
  await s.evaluate(() => window.__app.gehe('partie', { botId: 'fridolin', farbe: 'w', modus: 'frei' }));
  await s.waitForFunction(() => window.__partie && window.__partie.bereit === true, null, { timeout: 30000 }).catch(() => {});
  await botPlan(s);
  await ziehe(s, MATT);
  const sieg = await ergebnisDa(s);
  await s.waitForTimeout(1500);
  const knopf = await kursKnopf(s);
  pruefe(`${g} freie Partie ohne Kurs: kein "Zurück zum Kurs"`, sieg && knopf === null, { sieg, knopf });
  await k.close();
}

// ---------- Kurs-Partie nach Neuladen mitten in der Partie: Knopf bleibt ----------
{
  const { k, s } = await seite();
  await s.evaluate(() => window.__app.gehe('lektion', { id: 'es-partie' }));
  await s.waitForSelector('.ls-partie [data-a="partie"]', { timeout: 15000 }).catch(() => {});
  await botPlan(s);
  await s.locator('.ls-partie [data-a="partie"]').click({ timeout: 5000 }).catch(() => {});
  await ziehe(s, MATT.slice(0, 2));
  await s.waitForFunction(() => window.__partie && window.__partie.phase() === 'flo' && window.__partie.chess().history().length === 4, null, { timeout: 30000 }).catch(() => {});
  await s.reload();
  await s.waitForFunction(() => !!window.__app, null, { timeout: 15000 });
  await s.locator('[data-aktion="heim-weiter"]').click({ timeout: 15000 }).catch(() => {});
  await botPlan(s);
  await ziehe(s, MATT.slice(2));
  const sieg = await ergebnisDa(s);
  await s.waitForTimeout(1500);
  const knopf = await kursKnopf(s);
  pruefe('Kurs-Partie nach Neuladen fortgesetzt: "Zurück zum Kurs" steht weiter da', sieg && !!knopf && knopf.sichtbar, { sieg, knopf });
  await k.close();
}

pruefe('keine Seitenfehler', fehler.length === 0, fehler);
await browser.close(); server.close();
console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
