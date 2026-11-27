// Coach-Kopf als Schalter (role=button): die Tippflaeche ist zu UND aufgeklappt mindestens 44 px hoch (fc-11:50 Nachtrag;
// Kaltreview 19 zu so/R24-coach-kopf: aufgeklappt nur 37 px, weil .c-text mit seiner Einblendung, animation both, die
// unsichtbare Flaeche von unten ueberdeckt). Gemessen wird, was ein Finger trifft: elementFromPoint in der Mitte des Kopfes,
// Pixel fuer Pixel von 13 px darueber bis 13 px darunter, die laengste Strecke, die den Kopf trifft.
//   node tests/r25-coach-kopf-offen.test.mjs     (PLAYWRIGHT_PFAD, BROWSER=webkit fuer WebKit)
import http from 'node:http';
import { appHeute } from './app-heute.mjs';
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

// laengste zusammenhaengende Strecke (in px), auf der ein Tipp in der Mitte des Kopfes den Kopf trifft; erst nach der
// Einblendung (laufende endliche Animationen im Coach abwarten, hoechstens 3 s)
const tippHoehe = async () => {
  const coach = document.querySelector('.coach');
  const laufend = coach.getAnimations({ subtree: true }).filter((a) => a.playState === 'running' && Number.isFinite(a.effect?.getComputedTiming().endTime));
  await Promise.race([Promise.all(laufend.map((a) => a.finished.catch(() => {}))), new Promise((r) => setTimeout(r, 3000))]);
  const kopf = coach.querySelector(':scope > .c-kopf[role="button"]');
  const r = kopf.getBoundingClientRect();
  const x = r.left + r.width / 2;
  let lang = 0; let jetzt = 0; let unten = null;
  for (let y = Math.floor(r.top - 13); y <= Math.ceil(r.bottom + 13); y++) {
    const e = document.elementFromPoint(x, y);
    if (e && (e === kopf || kopf.contains(e))) { jetzt++; lang = Math.max(lang, jetzt); } else { if (y > r.bottom && !unten && e) unten = e.className || e.tagName; jetzt = 0; }
  }
  return { hoehe: lang, kopf: Math.round(r.height * 10) / 10, offen: kopf.getAttribute('aria-expanded'), unten };
};

const browser = await browserTyp(pw).launch({ headless: true });
// T-072: "heute" wie die App (js/tag.js, Tagesgrenze 4 Uhr), nicht das UTC-Datum
const HEUTE = await appHeute(browser, `http://127.0.0.1:${PORT}/`);
try {
  for (const [w, h, geraet] of [[375, 667, 'iphonese'], [390, 844, 'iphone13']]) {
    const k = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true, serviceWorkers: 'block', locale: 'de-DE' });
    await k.route('**/*', (r) => (new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort()));
    await k.addInitScript((e) => {
      try {
        const P = 'schach-arena:v1:';
        localStorage.setItem(P + 'modul:start', JSON.stringify({ v: 1, gesehen: e.heute }));
        localStorage.setItem(P + 'hinweis-installieren', '1');
        localStorage.setItem(P + 'einstellungen', JSON.stringify({ sprache: 'de', spracheGewaehlt: true }));
      } catch (f) { /* egal */ } // INTENTIONAL-SLOP[F1]: Speicher gesperrt heisst Probe ohne Vorbelegung
    }, { heute: HEUTE });
    const s = await k.newPage();
    await s.goto(`http://127.0.0.1:${PORT}/?test#heim`);
    await s.waitForFunction(() => !!window.__app, null, { timeout: 20000 });
    await s.waitForTimeout(2000);
    await s.evaluate(() => window.__app.gehe('partie', { botId: 'fridolin', farbe: 'w', modus: 'frei' }));
    await s.waitForFunction(() => window.__partie?.bereit === true, null, { timeout: 30000 });
    for (const f of ['e2', 'e4']) await s.locator(`.screen.partie .brett .feld[data-feld="${f}"]`).first().click();
    const da = await s.waitForSelector('.coach > .c-kopf[role="button"]', { timeout: 40000 }).then(() => true).catch(() => false);
    pruefe(`${geraet}: der Coach-Kopf wird nach dem ersten Zug ein Schalter`, da);
    if (!da) { await k.close(); continue; }
    await s.waitForTimeout(1500);
    for (const runde of [1, 2]) {
      const m = await s.evaluate(tippHoehe);
      pruefe(`${geraet}: Coach ${m.offen === 'true' ? 'aufgeklappt' : 'zu'}, Tippflaeche des Kopfes mindestens 44 px (${m.hoehe} px, Text ${m.kopf} px)`, m.hoehe >= 44, m);
      if (runde === 1) {
        // umschalten: aufgeklappt <-> zu, damit beide Lagen gemessen werden
        await s.locator('.coach > .c-kopf[role="button"]').first().click();
        await s.waitForFunction((v) => document.querySelector('.coach > .c-kopf[role="button"]')?.getAttribute('aria-expanded') !== v, m.offen, { timeout: 5000 }).catch(() => {});
        await s.waitForTimeout(400);
      }
    }
    await k.close();
  }
} finally {
  await browser.close(); server.close();
}
console.log(`${ok}/${ok + fehler} bestanden`);
process.exit(fehler ? 1 : 0);
