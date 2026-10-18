// Visueller Rundgang fuer den halb fertigen Look "Modern und klar".
// Startet die echte App auf einem eigenen Port, spielt gegen Benno, besucht alle
// vorhandenen Ansichten und legt belegbare Screenshots in rundgang-shots ab.
//
//   PORT=8895 node tests/rundgang.test.mjs
//   PLAYWRIGHT_PFAD=/pfad/zu/playwright node tests/rundgang.test.mjs
import http from 'node:http';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { mkdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8895);
const START = `http://127.0.0.1:${PORT}/index.html?test&reiter=training,verlauf`;
const SHOTS = path.join(WURZEL, 'tests', 'rundgang-shots');
const GROESSEN = [
  { name: 'ipad-quer', width: 1180, height: 820, mobile: false },
  { name: 'ipad-hoch', width: 820, height: 1180, mobile: false },
  { name: 'iphone', width: 390, height: 844, mobile: true },
];
const TYPEN = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.wasm': 'application/wasm',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8' };

function playwrightLaden() {
  for (const kandidat of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
    try { return require(kandidat); } catch (e) { /* naechster Kandidat */ }
  }
  throw new Error('Playwright nicht gefunden (PLAYWRIGHT_PFAD setzen)');
}

const server = http.createServer((req, res) => {
  let rel;
  try { rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html'; } catch (e) { rel = ''; }
  const datei = path.resolve(WURZEL, rel);
  if (!rel || !datei.startsWith(WURZEL + path.sep)) { res.writeHead(403).end(); return; }
  try {
    if (!statSync(datei).isFile()) throw new Error('keine Datei');
    const inhalt = readFileSync(datei);
    res.writeHead(200, { 'Content-Type': TYPEN[path.extname(datei)] || 'application/octet-stream', 'Content-Length': inhalt.length });
    res.end(inhalt);
  } catch (e) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Nicht gefunden'); }
});

const warten = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function serverBereit() {
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(START)).ok) return; } catch (e) { /* Server faehrt noch hoch */ }
    await warten(100);
  }
  throw new Error(`Server auf Port ${PORT} startet nicht`);
}

async function screen(page, browserName, groesse, name, selector = '#app > .screen') {
  await page.locator(selector).first().waitFor({ state: 'visible', timeout: 20000 });
  await warten(250);
  const datei = `${browserName}-${groesse.name}-${name}.png`;
  await page.screenshot({ path: path.join(SHOTS, datei), fullPage: false });
  const messung = await page.evaluate(() => {
    const sichtbar = (el) => { const s = getComputedStyle(el); const b = el.getBoundingClientRect(); return s.display !== 'none' && s.visibility !== 'hidden' && b.width > 0 && b.height > 0; };
    const klein = [...document.querySelectorAll('button, [role="button"], input, select')].filter(sichtbar).map((el) => {
      const b = el.getBoundingClientRect();
      return { text: (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 45), w: Math.round(b.width), h: Math.round(b.height) };
    }).filter((x) => x.w < 44 || x.h < 44);
    const abgeschnitten = [...document.querySelectorAll('h1,h2,h3,p,button,span')].filter(sichtbar).filter((el) =>
      el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1).slice(0, 12).map((el) =>
      `${el.tagName.toLowerCase()}.${el.className || '-'}: ${(el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 55)}`);
    return { ueberlauf: document.scrollingElement.scrollWidth - innerWidth, klein, abgeschnitten };
  });
  console.log(`  ${datei}: Ueberlauf ${messung.ueberlauf}px, kleine Ziele ${messung.klein.length}, abgeschnitten ${messung.abgeschnitten.length}`);
  return { datei, ...messung };
}

async function tippeZug(page, uci) {
  for (const feld of [uci.slice(0, 2), uci.slice(2, 4)]) {
    const box = await page.locator(`.brett-felder .feld[data-feld="${feld}"]`).boundingBox();
    if (!box) throw new Error(`Feld ${feld} nicht sichtbar`);
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await warten(120);
  }
}

async function rundgang(browser, browserName, groesse) {
  const context = await browser.newContext({ viewport: { width: groesse.width, height: groesse.height }, hasTouch: true,
    isMobile: groesse.mobile, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const fehler = [];
  page.on('pageerror', (e) => fehler.push(`Seitenfehler: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    // Ein nicht gebauter optionaler Paket-Screen antwortet beim ausdruecklichen Verfuegbarkeitstest mit 404.
    if (/404|dynamically imported module/.test(m.text())) return;
    fehler.push(`Konsole: ${m.text()}`);
  });
  await page.goto(`${START}#arena`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__app && document.documentElement.dataset.screen === 'arena');
  await page.evaluate(() => window.__app.setzeEinstellungen({ bewegung: 'aus', klang: false, liveBewertung: false, tiefe: 8 }));
  const bilder = [];
  bilder.push(await screen(page, browserName, groesse, '01-arena', '.screen.arena'));

  // Zwei eigene und zwei kontrollierte Bot-Zuege: reproduzierbar und ohne Wartezeit auf die Bot-Engine.
  await page.evaluate(() => {
    const plan = { e2e4: 'e7e5', g1f3: 'b8c6' };
    window.__test = { botZug: () => { const h = window.__partie.chess().history({ verbose: true }); return plan[h.at(-1)?.lan] || null; } };
    window.__app.gehe('partie', { botId: 'benno', farbe: 'w' });
  });
  await page.waitForFunction(() => window.__partie && window.__partie.bereit && window.__partie.phase() === 'flo', null, { timeout: 30000 });
  await tippeZug(page, 'e2e4');
  await page.waitForFunction(() => window.__partie.phase() === 'flo' && window.__partie.z.zuege.length === 2, null, { timeout: 10000 });
  await tippeZug(page, 'g1f3');
  await page.waitForFunction(() => window.__partie.phase() === 'flo' && window.__partie.z.zuege.length === 4, null, { timeout: 10000 });
  bilder.push(await screen(page, browserName, groesse, '02-partie', '.screen.partie'));

  await page.locator('[data-aktion="aufgeben"]').click();
  await page.getByRole('button', { name: 'Aufgeben', exact: true }).last().click();
  await page.locator('.ergebnis-overlay').waitFor({ state: 'visible', timeout: 10000 });
  bilder.push(await screen(page, browserName, groesse, '03-ergebnis', '.ergebnis-overlay'));

  const analyseKnopf = page.locator('.ergebnis-overlay [data-ziel="analyse"]');
  await analyseKnopf.waitFor({ state: 'visible', timeout: 10000 });
  await analyseKnopf.click();
  await page.waitForFunction(() => document.documentElement.dataset.screen === 'analyse', null, { timeout: 30000 });
  bilder.push(await screen(page, browserName, groesse, '04-analyse', '.an-screen'));

  await page.evaluate(() => window.__app.gehe('verlauf'));
  await page.waitForFunction(() => document.documentElement.dataset.screen === 'verlauf');
  bilder.push(await screen(page, browserName, groesse, '05-verlauf', '.vl-screen'));
  await page.evaluate(() => window.__app.gehe('training'));
  await page.waitForFunction(() => document.documentElement.dataset.screen === 'training');
  bilder.push(await screen(page, browserName, groesse, '06-training', '.training-screen'));
  await page.evaluate(() => window.__app.gehe('einstellungen'));
  await page.waitForFunction(() => document.documentElement.dataset.screen === 'einstellungen');
  bilder.push(await screen(page, browserName, groesse, '07-einstellungen', '.es-screen'));

  // Werkstatt gehoert zu einem spaeteren Paket. Nur ablichten, wenn der Screen in diesem Zweig wirklich vorhanden ist.
  await page.evaluate(() => window.__app.gehe('werkstatt'));
  await warten(500);
  const werkstattVorhanden = await page.evaluate(() => document.documentElement.dataset.screen === 'werkstatt');
  if (werkstattVorhanden) bilder.push(await screen(page, browserName, groesse, '08-werkstatt'));
  else console.log('  Werkstatt: in diesem Zweig nicht vorhanden (Weiterleitung zur Arena)');

  if (fehler.length) throw new Error(fehler.join('\n'));
  if (bilder.some((b) => b.ueberlauf > 1)) throw new Error('Waagrechter Seitenueberlauf gefunden');
  await context.close();
  return bilder;
}

mkdirSync(SHOTS, { recursive: true });
rmSync(SHOTS, { recursive: true, force: true });
mkdirSync(SHOTS, { recursive: true });
server.listen(PORT, '127.0.0.1');
await serverBereit();
const pw = playwrightLaden();
let laeufe = 0;
try {
  for (const [name, typ] of [['chromium', pw.chromium], ['webkit', pw.webkit]]) {
    let browser;
    try { browser = await typ.launch({ headless: true }); } catch (e) {
      console.log(`UEBERSPRUNGEN ${name}: Browser nicht installiert (${e.message.split('\n')[0]})`);
      continue;
    }
    try {
      for (const groesse of GROESSEN) {
        console.log(`\n${name}, ${groesse.name} (${groesse.width}x${groesse.height})`);
        await rundgang(browser, name, groesse);
        laeufe++;
      }
    } finally { await browser.close(); }
  }
} finally { await new Promise((resolve) => server.close(resolve)); }
if (!laeufe) throw new Error('Kein Playwright-Browser installiert');
console.log(`\nRundgang bestanden: ${laeufe} Browser-/Viewport-Laeufe; Bilder in tests/rundgang-shots/`);
