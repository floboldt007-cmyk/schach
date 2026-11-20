// Funktionsprobe Funken beim Aufgeben in der Oberflaeche (fc-02:30, Luecke aus der Funktionsprobe 371). Regel seit e0c200af
// (js/pakete/funken/rechnung.js MIN_ZUEGE): vor dem 10. eigenen Zug zaehlt nur ein Sieg. Wer frueher aufgibt, bekommt 0 Funken,
// und der Verlauf nennt den Grund (gr 'kurz', js/pakete/funken/stand.js). Nach 10 eigenen Zuegen bringt Aufgeben Funken wie bisher.
// Gespielt wird ueber das Brett (Felder antippen) und den Knopf "Aufgeben" (1,4 s halten, am Handy mit dem Finger),
// iPhone 13 dunkel und PC hell. Gegner fridolin, ohne Zugplan (die Engine zieht). Netz: jede Anfrage an Supabase beantwortet
// die Attrappe mit [].
//   node tests/funktion-funken-aufgeben.test.mjs        (PLAYWRIGHT_PFAD; BILDER=<ordner> legt Bilder ab)
import { createRequire } from 'node:module';
import http from 'node:http';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { browserTyp, fingerTreiber } from './browser.mjs';
import { freierPort } from './freier-port.mjs';
import { MIN_ZUEGE } from '../js/pakete/funken/rechnung.js';

let ok = 0; let fehler = 0;
function pruefe(name, wert, info = '') {
  if (wert) { ok++; console.log('ok   ' + name); } else { fehler++; console.log('FEHLER ' + name + ' ' + (typeof info === 'string' ? info : JSON.stringify(info))); } // INTENTIONAL-SLOP[T4]: die Konsole ist der Ausgabeweg der Probe (tests/alle.mjs liest sie)
}
const require = createRequire(import.meta.url);
let pw = null;
for (const p of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
  try { pw = require(p); break; } catch (e) { /* naechster */ } // INTENTIONAL-SLOP[F1]: Fehlschlag heisst naechster Kandidat bzw. egal, wie tests/r20-erste-schritte.test.mjs
}
if (!pw) { pruefe('Playwright gefunden', false); console.log(`${ok}/${ok + fehler} bestanden`); process.exit(1); } // INTENTIONAL-SLOP[T4]: die Konsole ist der Ausgabeweg der Probe (tests/alle.mjs liest sie)

const root = fileURLToPath(new URL('../', import.meta.url));
const typen = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg' };
const server = http.createServer((req, res) => {
  const p = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://test').pathname).replace(/\/$/, '/index.html'));
  if (!p.startsWith(root)) { res.writeHead(403); res.end(); return; }
  try { const d = readFileSync(p); res.writeHead(200, { 'Content-Type': typen[path.extname(p)] || 'application/octet-stream' }); res.end(d); }
  catch (e) { res.writeHead(404); res.end(); }
});
const PORT = Number(process.env.PORT) || await freierPort();
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
const BASIS = `http://127.0.0.1:${PORT}/index.html?test`;
const BILDER = process.env.BILDER || '';
if (BILDER) mkdirSync(BILDER, { recursive: true });
const SCREEN = '.screen.partie:not(.online-screen)';
const warte = (ms) => new Promise((r) => setTimeout(r, ms));
const klappt = (p) => p.then(() => true, () => false);
const { defaultBrowserType: _typ, ...IPHONE } = pw.devices['iPhone 13'];
const GERAETE = [
  { name: 'iphone13-dunkel', opt: { ...IPHONE, colorScheme: 'dark' }, finger: true },
  { name: 'pc1280-hell', opt: { viewport: { width: 1280, height: 800 }, colorScheme: 'light' }, finger: false },
];

const funken = (s) => s.evaluate(async () => { const S = await import('/js/pakete/funken/stand.js'); const st = S.lade();
  return { gesamt: st.gesamt, letzte: (st.verlauf && st.verlauf[0]) || null }; });
const eigeneZuege = (s) => s.evaluate(() => Math.ceil(window.__partie.chess().history().length / 2));
async function zug(s, uci) {
  await s.waitForFunction(() => window.__partie.phase() === 'flo', null, { timeout: 40000 });
  for (const f of [uci.slice(0, 2), uci.slice(2, 4)]) await s.locator(`${SCREEN} .brett-felder .feld[data-feld="${f}"]`).click();
  if (await s.locator(`${SCREEN} .brett .lage.vorschau`).count()) await s.locator(`${SCREEN} .brett-felder .feld[data-feld="${uci.slice(2, 4)}"]`).click();
}
// ein ruhiger legaler Zug (kein Schlagen, keine Umwandlung, kein Koenig), damit die Partie lange genug laeuft
const ruhigerZug = (s) => s.evaluate(() => {
  const m = window.__partie.chess().moves({ verbose: true });
  const r = m.filter((x) => !x.captured && !x.promotion && x.piece !== 'k');
  const w = (r.length ? r : m)[0];
  return w.from + w.to;
});
// zieht, bis n eigene Zuege auf dem Brett stehen und Flo wieder am Zug ist (ein Tipp, der nicht zieht, wird wiederholt)
async function spieleBis(s, n) {
  for (let runde = 0; runde < 3 * n; runde++) {
    const h = await s.evaluate(() => window.__partie.chess().history().length);
    if (Math.ceil(h / 2) >= n && h % 2 === 0) break;
    await zug(s, await ruhigerZug(s));
    await klappt(s.waitForFunction((m) => window.__partie.chess().history().length > m, h, { timeout: 5000 }));
  }
  await s.waitForFunction(() => window.__partie.phase() === 'flo', null, { timeout: 60000 });
}
async function neuePartie(s) {
  await s.evaluate(() => {
    localStorage.removeItem('schach-arena:v1:laufend');
    window.__test = {};
    window.__app.gehe('partie', { botId: 'fridolin', farbe: 'w' });
  });
  return klappt(s.waitForFunction((sel) => window.__partie && window.__partie.bereit === true && window.__partie.phase() === 'flo'
    && document.querySelectorAll(sel + ' .brett img.figur').length === 32, SCREEN, { timeout: 30000 }));
}
// "Aufgeben" ist ein Halteknopf: 1,4 s druecken (Handy: Finger, PC: Maus)
async function aufgeben(s, finger) {
  const r = await s.locator(`${SCREEN} .spielknoepfe > [data-aktion="aufgeben"]`).boundingBox();
  const [x, y] = [r.x + r.width / 2, r.y + r.height / 2];
  if (finger) { const f = fingerTreiber(s); await f.runter(x, y); await warte(1400); await f.hoch(x, y); }
  else { await s.mouse.move(x, y); await s.mouse.down(); await warte(1400); await s.mouse.up(); }
  return klappt(s.waitForSelector('.ergebnis-overlay.niederlage.gefuellt', { timeout: 20000 }));
}

pruefe(`Regel: MIN_ZUEGE ist 10 (Grenze dieser Probe)`, MIN_ZUEGE === 10, { MIN_ZUEGE });
const browser = await browserTyp(pw).launch({ headless: true });
try {
  for (const g of GERAETE) {
    const k = await browser.newContext({ ...g.opt, locale: 'de-DE', serviceWorkers: 'block' });
    await k.route('**/*.supabase.co/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await k.addInitScript(() => {
      try {
        if (!localStorage.getItem('schach-arena:v1:modul:start')) localStorage.setItem('schach-arena:v1:modul:start', JSON.stringify({ v: 1, gesehen: '2026-11-01' }));
        if (!localStorage.getItem('schach-arena:v1:einstellungen')) localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ klang: false }));
      } catch (e) { /* egal */ } // INTENTIONAL-SLOP[F1]: Fehlschlag heisst naechster Kandidat bzw. egal, wie tests/r20-erste-schritte.test.mjs
    });
    const s = await k.newPage(); s.setDefaultTimeout(15000);
    const seitenfehler = [];
    s.on('pageerror', (e) => seitenfehler.push(e.message));
    const bild = (n) => (BILDER ? s.screenshot({ path: path.join(BILDER, `${g.name}-${n}.png`) }).catch(() => {}) : null);
    try {
      await s.goto(BASIS + '#heim');
      await s.waitForFunction(() => window.__app && document.documentElement.dataset.screen, null, { timeout: 30000 });
      await warte(1200);
      // kurz: 2 eigene Zuege, dann aufgeben
      pruefe(`${g.name}: Partie gegen fridolin startet`, await neuePartie(s));
      await spieleBis(s, 2);
      const kurzZuege = await eigeneZuege(s);
      const k0 = await funken(s);
      const kurzAus = await aufgeben(s, g.finger);
      await warte(2500);
      await bild('aufgeben-zug2');
      const k1 = await funken(s);
      pruefe(`${g.name}: Aufgeben nach ${kurzZuege} eigenen Zuegen zeigt das Niederlage-Blatt`, kurzAus && kurzZuege < MIN_ZUEGE, { kurzAus, kurzZuege });
      pruefe(`${g.name}: Aufgeben vor Zug ${MIN_ZUEGE} bringt 0 Funken, der Verlauf nennt den Grund "kurz"`,
        k1.gesamt === k0.gesamt && !!k1.letzte && k1.letzte.id !== (k0.letzte && k0.letzte.id) && k1.letzte.gr === 'kurz' && k1.letzte.f === 0,
        { vorher: k0.gesamt, nachher: k1.gesamt, letzte: k1.letzte });
      // lang: 10 eigene Zuege, dann aufgeben
      pruefe(`${g.name}: zweite Partie startet`, await neuePartie(s));
      await spieleBis(s, MIN_ZUEGE);
      const langZuege = await eigeneZuege(s);
      const l0 = await funken(s);
      const langAus = await aufgeben(s, g.finger);
      await warte(2500);
      await bild('aufgeben-zug10');
      const l1 = await funken(s);
      pruefe(`${g.name}: Aufgeben nach ${langZuege} eigenen Zuegen zeigt das Niederlage-Blatt`, langAus && langZuege >= MIN_ZUEGE, { langAus, langZuege });
      pruefe(`${g.name}: Aufgeben ab Zug ${MIN_ZUEGE} bringt Funken wie bisher (mehr als 0, Grund nicht "kurz")`,
        l1.gesamt > l0.gesamt && !!l1.letzte && l1.letzte.id !== (k1.letzte && k1.letzte.id) && l1.letzte.gr !== 'kurz' && l1.letzte.f > 0,
        { vorher: l0.gesamt, nachher: l1.gesamt, letzte: l1.letzte });
    } catch (e) {
      await bild('abbruch');
      pruefe(`${g.name}: Ablauf ohne Abbruch`, false, e.message.split('\n')[0]);
    }
    pruefe(`${g.name}: keine Seitenfehler`, seitenfehler.length === 0, seitenfehler.slice(0, 5));
    await k.close();
  }
} finally {
  await browser.close();
  server.close();
}
console.log(`${ok}/${ok + fehler} bestanden`); // INTENTIONAL-SLOP[T4]: die Konsole ist der Ausgabeweg der Probe (tests/alle.mjs liest sie)
process.exit(fehler ? 1 : 0);
