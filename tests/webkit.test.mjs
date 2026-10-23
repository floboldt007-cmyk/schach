// WebKit-Pruefung der kompletten App in den drei wichtigsten Touch-Groessen.
// Spielt pro Groesse eine vollstaendige Partie gegen Bauer Benno und schreibt
// Screenshots von Arena, Partie, Ergebnis, Analyse, Verlauf und Einstellungen.
//
//   node tests/webkit.test.mjs
//   PORT=8891 node tests/webkit.test.mjs
import http from 'node:http';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { mkdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8890);
const PRAEFIX = '/schach/';
const START = `http://127.0.0.1:${PORT}${PRAEFIX}?test`;
const BILDER = path.join(WURZEL, 'tests', 'webkit-shots');
const GROESSEN = [
  { name: 'ipad-quer', width: 1180, height: 820 },
  { name: 'ipad-hoch', width: 820, height: 1180 },
  { name: 'iphone', width: 390, height: 844 },
];
const IPAD_UA = 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const ZUEGE = ['e2e4', 'f1c4', 'd1h5', 'h5f7'];
const BOT_PLAN = { e2e4: 'e7e5', f1c4: 'b8c6', d1h5: 'g8f6' };
mkdirSync(BILDER, { recursive: true });

const typen = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.wasm': 'application/wasm',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
};
const server = http.createServer((req, res) => {
  let url;
  try { url = new URL(req.url, 'http://x'); } catch { res.writeHead(400).end(); return; }
  if (!url.pathname.startsWith(PRAEFIX)) { res.writeHead(404).end(); return; }
  let rel = decodeURIComponent(url.pathname.slice(PRAEFIX.length));
  if (!rel || rel.endsWith('/')) rel += 'index.html';
  const datei = path.resolve(WURZEL, rel);
  if (!datei.startsWith(WURZEL + path.sep)) { res.writeHead(403).end(); return; }
  try {
    if (!statSync(datei).isFile()) throw new Error('keine Datei');
    const inhalt = readFileSync(datei);
    res.writeHead(200, { 'Content-Type': typen[path.extname(datei)] || 'application/octet-stream', 'Content-Length': inhalt.length });
    res.end(req.method === 'HEAD' ? undefined : inhalt);
  } catch { res.writeHead(404).end('Nicht gefunden'); }
});

function playwright() {
  for (const kandidat of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
    try { return require(kandidat); } catch { /* naechster Pfad */ }
  }
  throw new Error('Playwright nicht gefunden (PLAYWRIGHT_PFAD setzen)');
}

const ergebnisse = [];
function pruefe(ansicht, groesse, name, ok, detail = '') {
  ergebnisse.push({ ansicht, groesse, name, ok: !!ok, detail });
  console.log(`${ok ? 'ok    ' : 'BEFUND'} ${groesse} / ${ansicht}: ${name}${detail ? ` (${detail})` : ''}`);
}
const warte = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function tippe(seite, selector) {
  const el = seite.locator(selector).filter({ visible: true }).first();
  await el.scrollIntoViewIfNeeded();
  const b = await el.boundingBox();
  if (!b) throw new Error(`nicht sichtbar: ${selector}`);
  await seite.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
  await warte(150);
}
async function tippeFeld(seite, feld) {
  const b = await seite.locator(`.screen.partie .feld[data-feld="${feld}"]`).boundingBox();
  if (!b) throw new Error(`Feld nicht sichtbar: ${feld}`);
  await seite.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
  await warte(100);
}
async function screen(seite, name) {
  await seite.waitForFunction((n) => document.documentElement.dataset.screen === n, name, { timeout: 20000 });
  await warte(250);
}

async function layoutPruefen(seite, ansicht, groesse) {
  const layout = await seite.evaluate(() => {
    const sichtbar = (el) => {
      const s = getComputedStyle(el);
      const b = el.getBoundingClientRect();
      return s.visibility !== 'hidden' && s.display !== 'none' && b.width > 0 && b.height > 0;
    };
    // Dekorative Partikel duerfen waehrend der Ergebnisfeier bewusst ueber ihre
    // Karte fliegen. Geprueft werden deshalb der Dokumentfluss und bedienbare
    // bzw. inhaltstragende Elemente, nicht jedes leere Animations-<i>.
    const rand = [...document.querySelectorAll('#app > .screen button, #app > .screen a, #app > .screen img, #app > .screen h1, #app > .screen h2, #app > .screen h3, #app > .screen p')].filter(sichtbar).filter((el) => {
      const b = el.getBoundingClientRect();
      return b.left < -1 || b.right > innerWidth + 1;
    }).slice(0, 8).map((el) => `${el.tagName.toLowerCase()}.${el.className || ''}`);
    const kleine = [...document.querySelectorAll('button, [role="button"]')].filter(sichtbar).map((el) => {
      const b = el.getBoundingClientRect();
      return { text: el.getAttribute('aria-label') || el.textContent.trim().replace(/\s+/g, ' ').slice(0, 45), w: b.width, h: b.height };
    }).filter((x) => x.w < 43.5 || x.h < 43.5);
    const namen = [...document.querySelectorAll('h1, h2, h3, .name, .titel, .gegner-name, .gegner-titel')].filter(sichtbar)
      .filter((el) => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)
      .map((el) => el.textContent.trim().replace(/\s+/g, ' ').slice(0, 70));
    return { breit: document.documentElement.scrollWidth - innerWidth, rand, kleine, namen };
  });
  pruefe(ansicht, groesse, 'kein horizontaler Überlauf', layout.breit <= 0 && layout.rand.length === 0, JSON.stringify({ breit: layout.breit, elemente: layout.rand }));
  pruefe(ansicht, groesse, 'Namen und Titel nicht abgeschnitten', layout.namen.length === 0, layout.namen.join(' | '));
  pruefe(ansicht, groesse, 'sichtbare Knöpfe mindestens 44 × 44 px', layout.kleine.length === 0, JSON.stringify(layout.kleine));
}
async function bild(seite, ansicht, groesse) {
  await layoutPruefen(seite, ansicht, groesse);
  await seite.screenshot({ path: path.join(BILDER, `${groesse}-${ansicht}.png`), fullPage: true });
}

async function durchlauf(browser, vp) {
  const kontext = await browser.newContext({
    viewport: { width: vp.width, height: vp.height }, screen: { width: vp.width, height: vp.height },
    hasTouch: true, isMobile: true, deviceScaleFactor: 1, userAgent: IPAD_UA,
  });
  const seite = await kontext.newPage();
  const fehler = [];
  const wasm = [];
  seite.on('console', (m) => { if (m.type() === 'error') fehler.push(`Konsole: ${m.text()}`); });
  seite.on('pageerror', (e) => fehler.push(`Seite: ${e.message}`));
  seite.on('request', (r) => { if (/\.wasm(?:$|[?#])/.test(r.url())) wasm.push(r.url()); });
  seite.on('response', (r) => { if (r.status() >= 400) fehler.push(`HTTP ${r.status()}: ${r.url()}`); });

  await seite.goto(`${START}#arena`, { waitUntil: 'domcontentloaded' });
  await screen(seite, 'arena');
  // Erster echter Touch muss WebAudio unter WebKit ohne Ausnahme entsperren.
  await tippe(seite, '.screen.arena [data-aktion="verlauf"]');
  await screen(seite, 'verlauf');
  const klang = await seite.evaluate(async () => (await import('./js/sounds.js')).klang.zustand());
  pruefe('Arena', vp.name, 'Klang nach erstem Tipp freigeschaltet', klang === 'bereit', klang);
  await tippe(seite, '.screen [data-aktion="zurueck"]');
  await screen(seite, 'arena');
  await bild(seite, 'arena', vp.name);

  // Minimales gueltiges Modul: () -> v128, i32.const 0, i8x16.splat.
  const simd = await seite.evaluate(() => WebAssembly.validate(Uint8Array.from([
    0,97,115,109,1,0,0,0,1,5,1,96,0,1,123,3,2,1,0,10,8,1,6,0,65,0,253,15,11,
  ])));
  const engine = await seite.evaluate(async () => {
    const e = await window.__app.engine('bot');
    const a = await e.analyse('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1', { depth: 6 });
    return { pfad: e.pfad, depth: a.depth, bestmove: a.bestmove };
  });
  pruefe('Partie', vp.name, 'WebAssembly-SIMD wird unterstützt', simd, String(simd));
  pruefe('Partie', vp.name, 'Stockfish-WASM lädt und rechnet', wasm.length > 0 && engine.depth >= 6 && !!engine.bestmove, JSON.stringify({ wasm, engine }));

  await seite.evaluate((plan) => {
    window.__test = { botZug: () => {
      const z = window.__partie.chess().history({ verbose: true });
      return plan[z[z.length - 1].lan] || null;
    } };
    window.__app.gehe('partie', { botId: 'benno', farbe: 'w' });
  }, BOT_PLAN);
  await screen(seite, 'partie');
  await seite.waitForFunction(() => window.__partie?.bereit && window.__partie.phase() === 'flo', null, { timeout: 40000 });
  await bild(seite, 'partie', vp.name);
  for (const zug of ZUEGE) {
    await seite.waitForFunction(() => window.__partie?.phase() === 'flo', null, { timeout: 40000 });
    const vorher = await seite.evaluate(() => window.__partie.z.zuege.length);
    await tippeFeld(seite, zug.slice(0, 2));
    await tippeFeld(seite, zug.slice(2, 4));
    // U7: "Zug bestaetigen" (seit 23.10. Standard aus; die Vorschau prueft board.test auch in WebKit): steht sie, macht ein
    // zweiter Tipp aufs Ziel den Zug fest
    if (await seite.evaluate(() => !!document.querySelector('.screen.partie .brett .lage.vorschau'))) await tippeFeld(seite, zug.slice(2, 4));
    await seite.waitForFunction((n) => window.__partie.z.zuege.length > n, vorher, { timeout: 5000 });
  }
  await seite.evaluate(() => { window.__test = {}; });
  await seite.waitForSelector('.ergebnis-overlay.gefuellt', { timeout: 40000 });
  await warte(2600);
  // U7 (PLAN 2.6): Kopfwort "Sieg!" mit goldenem Ausrufezeichen statt "SIEG!"
  pruefe('Ergebnis', vp.name, 'ganze Partie per Tippen beendet', /^Sieg!$/.test((await seite.locator('.erg-wort').innerText()).trim()), await seite.locator('.erg-wort').innerText());
  await bild(seite, 'ergebnis', vp.name);

  await tippe(seite, '.erg-knoepfe [data-ziel="analyse"]');
  await screen(seite, 'analyse');
  await seite.waitForSelector('.an-inhalt', { timeout: 60000 });
  await bild(seite, 'analyse', vp.name);
  await seite.evaluate(() => window.__app.gehe('verlauf'));
  await screen(seite, 'verlauf');
  await bild(seite, 'verlauf', vp.name);
  await seite.evaluate(() => window.__app.gehe('einstellungen'));
  await screen(seite, 'einstellungen');
  await bild(seite, 'einstellungen', vp.name);

  pruefe('Gesamt', vp.name, 'keine Konsolen-, Seiten- oder HTTP-Fehler', fehler.length === 0, fehler.join(' | '));
  await kontext.close();
}

let browser;
let code = 1;
try {
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(PORT, '127.0.0.1', resolve); });
  browser = await playwright().webkit.launch();
  for (const vp of GROESSEN) await durchlauf(browser, vp);
  const befunde = ergebnisse.filter((x) => !x.ok);
  console.log(`\n${ergebnisse.length - befunde.length}/${ergebnisse.length} Prüfungen bestanden; ${befunde.length} Befund(e).`);
  for (const b of befunde) console.log(`BEFUND: ${b.groesse} / ${b.ansicht}: ${b.name} (${b.detail})`);
  // Dies ist eine Bestandsaufnahme: fachliche Befunde stehen im Bericht und
  // machen einen vollstaendig ausgefuehrten Prueflauf nicht zum Infrastrukturfehler.
  code = 0;
} catch (e) {
  console.error(e);
} finally {
  if (browser) await browser.close();
  server.close();
}
process.exit(code);
