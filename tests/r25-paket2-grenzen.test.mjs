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
// Zweiter Ort (Kaltreview 43): die Lobby "Gegner gefunden" mit zwei mittleren Karten nebeneinander, gebaut mit dem echten
// Modul js/ui/visitenkarte.js und allen Stylesheets der index.html
const STILE = [...readFileSync(path.join(root, 'index.html'), 'utf8').matchAll(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)].map((m) => m[1]);
const LOBBY = `<!doctype html><html lang="de" data-screen="lobby"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
${STILE.map((h) => `<link rel="stylesheet" href="/${h}">`).join('')}</head><body>
<div class="lb-suche"><div class="lb-suche-karte"><div class="lb-karten" id="lb"></div></div></div>
<script type="module">
import { visitenkarte } from '/js/ui/visitenkarte.js';
const karte = (n, name) => ({ name, avatar: '', kronenStufe: 17, elo: 1512, saison: { saison: n, stufe: 17 }, saisonTitel: 'crownmaster-s' + n });
window.baue = (n) => {
  const vs = Object.assign(document.createElement('b'), { className: 'lb-karten-vs', textContent: 'VS' });
  document.getElementById('lb').replaceChildren(visitenkarte(karte(n, 'Flo'), { groesse: 'mittel' }), vs, visitenkarte(karte(n, 'Gegnerin'), { groesse: 'mittel' }));
};
window.fertig = true;
</script></body></html>`;
const server = http.createServer((req, res) => {
  if (new URL(req.url, 'http://test').pathname === '/probe-lobby.html') { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(LOBBY); return; }
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
  // Lobby, zwei Karten nebeneinander: 641 px ist die erste Breite mit zwei Spalten (je 299 px), 320 px die schmalste.
  // Season 9998 darf bei 641 px zweizeilig werden (Grenzfall, fc 20.11.2026), der kurze Titel bleibt einzeilig.
  // "lang" ersetzt den Titel durch ein Wort ohne Leerzeichen, breiter als die Karte (Schutz fuer kuenftige Titel und
  // Uebersetzungen): nur overflow-wrap: anywhere bricht es um, nur max-width: 100% haelt den Chip in der Karte.
  const LANG = 'Weltranglistenkronenmeisterschaftstitel';
  for (const breite of [320, 641]) for (const fall of ['1', '9998', 'lang']) {
    const name = `Lobby ${breite} px Season ${fall}`;
    const k = await browser.newContext({ viewport: { width: breite, height: 900 }, locale: 'de-DE', serviceWorkers: 'block' });
    const s = await k.newPage(); s.setDefaultTimeout(15000);
    const fehlerListe = [];
    s.on('pageerror', (e) => fehlerListe.push(e.message));
    try {
      await s.goto(`${HERKUNFT}/probe-lobby.html`);
      await s.waitForFunction(() => window.fertig === true);
      await s.evaluate(([n, lang, wort]) => {
        window.baue(n);
        if (lang) for (const e of document.querySelectorAll('.vk-season-titel')) e.textContent = wort;
      }, [fall === 'lang' ? 1 : Number(fall), fall === 'lang', LANG]);
      await s.waitForTimeout(150);
      const m = await s.evaluate(() => [...document.querySelectorAll('.lb-karten .vk')].flatMap((vk) => {
        const v = vk.getBoundingClientRect();
        return [...vk.querySelectorAll('.vk-season-abz, .vk-season-titel')].map((e) => {
          const r = e.getBoundingClientRect();
          return { art: e.className, links: Math.round(r.left - v.left), rechts: Math.round(v.right - r.right),
            schneidet: e.scrollWidth > e.clientWidth + 1, hoch: Math.round(r.height) };
        });
      }));
      if (BILDER) await s.locator('.lb-karten').screenshot({ path: path.join(BILDER, `lobby-${breite}-s${fall}.png`) });
      pruefe(`${name}: beide Karten zeigen Abzeichen und Titel`, m.length === 4, m);
      pruefe(`${name}: kein Season-Chip ragt ueber die Karte hinaus`, m.every((x) => x.links >= 0 && x.rechts >= 0), m);
      pruefe(`${name}: kein Season-Chip schneidet seinen Text ab`, m.every((x) => !x.schneidet), m);
      if (fall === '1') pruefe(`${name}: der kurze Titel bleibt einzeilig`, m.every((x) => x.hoch <= 30), m);
      if (fall === 'lang') pruefe(`${name}: das lange Wort bricht um`, m.filter((x) => /titel/.test(x.art)).every((x) => x.hoch > 30), m);
    } catch (e) {
      pruefe(`${name}: Ablauf ohne Abbruch`, false, e.message.split('\n')[0]);
    }
    pruefe(`${name}: keine Seitenfehler`, fehlerListe.length === 0, fehlerListe.slice(0, 5));
    await k.close();
  }
} finally {
  await browser.close();
  server.close();
}
console.log(`${ok}/${ok + fehler} bestanden`); // INTENTIONAL-SLOP[T4]: die Konsole ist der Ausgabeweg der Probe (tests/alle.mjs liest sie)
process.exit(fehler ? 1 : 0);
