// R25 Paket-2-Grenzen (fc-12:40, Belastungsprobe mit extremen Daten): die Season-Chips der Visitenkarte (bestes Abzeichen und
// gewaehlter Titel, css/visitenkarte.css .vk-season-abz / .vk-season-titel) passen in jede Breite. Gemessen 20.11.2026 auf
// 320 px (iPhone SE 1. Generation, zugleich die Reflow-Breite von WCAG 1.4.10): "Crownmaster Season 1" ragte 4 px, bei
// Season 9999 31 px ueber die Karte hinaus und wurde ohne Auslassung abgeschnitten (white-space: nowrap im Chip).
// Geprueft in der Vorschau "So sehen dich deine Gegner" auf "Ich" (Season-Leiste, js/pakete/liga/saison.js), DE und EN:
//   - kein Chip ragt links oder rechts ueber die Karte (.vk, overflow hidden) hinaus
//   - kein Chip schneidet seinen eigenen Text ab
//   - der kurze Titel bleibt ab 375 px einzeilig (der Fix bricht nur um, wo es sonst nicht passt)
// Supabase nur als Attrappe (saison_mein_stand), Paket 2 per ?test&paket2.
//   node tests/r25-paket2-grenzen.test.mjs        (PLAYWRIGHT_PFAD; BILDER=<ordner> legt Bilder ab)
import { createRequire } from 'node:module';
import http from 'node:http';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { browserTyp } from './browser.mjs';
import { freierPort } from './freier-port.mjs';

let ok = 0; let fehler = 0;
function pruefe(name, wert, info = '') {
  if (wert) { ok++; console.log('ok   ' + name); } else { fehler++; console.log('FEHLER ' + name + ' ' + (typeof info === 'string' ? info : JSON.stringify(info))); } // INTENTIONAL-SLOP[T4]: die Konsole ist der Ausgabeweg der Probe (tests/alle.mjs liest sie)
}
const require = createRequire(import.meta.url);
let pw = null;
for (const p of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
  try { pw = require(p); break; } catch (e) { /* naechster */ } // INTENTIONAL-SLOP[F1]: Fehlschlag heisst naechster Kandidat
}
if (!pw) { pruefe('Playwright gefunden', false); console.log(`${ok}/${ok + fehler} bestanden`); process.exit(1); } // INTENTIONAL-SLOP[T4]: die Konsole ist der Ausgabeweg der Probe

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
const HERKUNFT = `http://127.0.0.1:${PORT}`;
const BILDER = process.env.BILDER || '';
if (BILDER) mkdirSync(BILDER, { recursive: true });
const SITZUNG = { access_token: 'a.e30.x', refresh_token: 'r', expires_at: 9999999999, user: { id: 'u1', email: 'probe@example.invalid' } };
// Season mit Abzeichen und gewaehltem Titel; n = Nummer der vergangenen Season (1 = realistisch, 9998 = Hoechstwert, die laufende Season ist dann 9999)
const lauf = (n) => ({ saison: n + 1, start: '2027-03-01', woche: 8, wochen: 8, ende: '2027-04-25', bisher: 17, stufe: 17,
  abzeichen: [{ saison: n, stufe: 17 }], titel: [`crownmaster-s${n}`], gewaehlt: `crownmaster-s${n}`, sichtbar: true });
const BREITEN = [320, 375, 820];

const browser = await browserTyp(pw).launch({ headless: true });
try {
  for (const breite of BREITEN) for (const spr of ['de', 'en']) for (const n of [1, 9998]) {
    const name = `${breite} px ${spr} Season ${n}`;
    const k = await browser.newContext({ viewport: { width: breite, height: 800 }, hasTouch: breite < 700, locale: spr === 'de' ? 'de-DE' : 'en-US', serviceWorkers: 'block' });
    await k.route('**/*', (r) => {
      const url = r.request().url();
      if (url.startsWith(HERKUNFT)) return r.continue();
      if (!/supabase\.co/.test(url)) return r.abort();
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(url.includes('/rpc/saison_mein_stand') ? lauf(n) : []) });
    });
    await k.addInitScript(({ s, spr }) => {
      // ?test haelt die App ohne eigene Wahl auf Deutsch (js/app.js); Englisch nur als gespeicherte Wahl
      localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ sprache: spr, spracheGewaehlt: true }));
      localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(s));
      localStorage.setItem('schach-arena:v1:hinweis-installieren', '1');
      localStorage.setItem('schach-arena:v1:modul:start', JSON.stringify({ v: 1, gesehen: '2026-11-01' }));
      // das Blatt "Season ist vorbei" schon gesehen, sonst liegt es ueber der Leiste
      localStorage.setItem('schach-arena:v1:season-gesehen', JSON.stringify({ u1: 99999 }));
    }, { s: SITZUNG, spr });
    const s = await k.newPage(); s.setDefaultTimeout(15000);
    const fehlerListe = [];
    s.on('pageerror', (e) => fehlerListe.push(e.message));
    s.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource|ERR_FAILED/.test(m.text())) fehlerListe.push('console: ' + m.text()); });
    try {
      await s.goto(`${HERKUNFT}/index.html?test&paket2#ich`);
      await s.locator('.ss-vorschau .vk-season-titel').first().waitFor({ timeout: 20000 });
      const m = await s.evaluate(() => {
        const vk = document.querySelector('.ss-vorschau .vk').getBoundingClientRect();
        return [...document.querySelectorAll('.ss-vorschau .vk-season-abz, .ss-vorschau .vk-season-titel')].map((e) => {
          const r = e.getBoundingClientRect();
          return { art: e.className, text: e.textContent.trim(), links: Math.round(r.left - vk.left), rechts: Math.round(vk.right - r.right),
            schneidet: e.scrollWidth > e.clientWidth + 1, hoch: Math.round(r.height) };
        });
      });
      if (BILDER) await s.locator('.ss-vorschau').first().screenshot({ path: path.join(BILDER, `vorschau-${breite}-${spr}-s${n}.png`) });
      pruefe(`${name}: Abzeichen und Titel stehen in der Karte`, m.length === 2, m);
      pruefe(`${name}: kein Season-Chip ragt ueber die Karte hinaus`, m.every((x) => x.links >= 0 && x.rechts >= 0), m);
      pruefe(`${name}: kein Season-Chip schneidet seinen Text ab`, m.every((x) => !x.schneidet), m);
      if (breite >= 375 && n === 1) pruefe(`${name}: der kurze Titel bleibt einzeilig`, m.every((x) => x.hoch <= 30), m);
    } catch (e) {
      pruefe(`${name}: Ablauf ohne Abbruch`, false, e.message.split('\n')[0]);
    }
    pruefe(`${name}: keine Seiten- oder Konsolenfehler`, fehlerListe.length === 0, fehlerListe.slice(0, 5));
    await k.close();
  }
} finally {
  await browser.close();
  server.close();
}
console.log(`${ok}/${ok + fehler} bestanden`); // INTENTIONAL-SLOP[T4]: die Konsole ist der Ausgabeweg der Probe (tests/alle.mjs liest sie)
process.exit(fehler ? 1 : 0);
