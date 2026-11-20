// Funktionsprobe Season-Schalter auf der echten Einstellungen-Seite (fc-02:30, Luecke aus der Funktionsprobe 371;
// tests/r19-saison.test.mjs prueft den Baustein losgeloest). Angemeldet (Attrappe), Season laeuft (saison_mein_stand,
// sichtbar false). Erwartet: die Gruppe "Season" steht in den Einstellungen (am Handy als Unterseite "Season"), der Schalter
// ist aus und gesperrt, der 16-Haken leer; erst mit Haken ist er bedienbar, bleibt aber aus; Antippen schaltet ihn an und
// schickt saison_sichtbar_setzen mit Altersbestaetigung.
// Paket 2 ist hinter js/freigaben.js paket2Frei(): der Test oeffnet die App mit ?test&paket2 (auf 127.0.0.1 frei, siehe
// tests/r19-paket2-schalter.test.mjs) und laeuft damit vor und nach dem Schalter-Commit gleich. Ohne &paket2 erwartet er die
// Gruppe genau dann, wenn paket2Frei() auf der Seite true sagt.
//   node tests/funktion-einstellungen-season.test.mjs        (PLAYWRIGHT_PFAD; BILDER=<ordner> legt Bilder ab)
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
const HERKUNFT = `http://127.0.0.1:${PORT}`;
const BILDER = process.env.BILDER || '';
if (BILDER) mkdirSync(BILDER, { recursive: true });
const warte = (ms) => new Promise((r) => setTimeout(r, ms));
const SITZUNG = { access_token: 'a.e30.x', refresh_token: 'r', expires_at: 9999999999, user: { id: 'u1', email: 'probe@example.invalid' } };
const LAUF = { saison: 2, start: '2027-03-01', woche: 3, wochen: 8, ende: '2027-04-25', bisher: 11, stufe: 14, abzeichen: [], titel: [], gewaehlt: null, sichtbar: false };
const { defaultBrowserType: _typ, ...IPHONE } = pw.devices['iPhone 13'];
const GERAETE = [
  { name: 'iphone13-hell', opt: { ...IPHONE, colorScheme: 'light' }, handy: true },
  { name: 'pc1280-dunkel', opt: { viewport: { width: 1280, height: 800 }, colorScheme: 'dark' }, handy: false },
];

async function neuerKontext(browser, g) {
  const k = await browser.newContext({ ...g.opt, locale: 'de-DE', serviceWorkers: 'block' });
  const gesendet = [];
  await k.route('**/*', (r) => {
    const url = r.request().url();
    if (url.startsWith(HERKUNFT)) return r.continue();
    if (!/supabase\.co/.test(url)) return r.abort();
    if (url.includes('/rpc/saison_mein_stand')) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(LAUF) });
    if (url.includes('/rpc/saison_sichtbar_setzen')) {
      gesendet.push('saison_sichtbar_setzen:' + r.request().postData());
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ sichtbar: JSON.parse(r.request().postData()).an }) });
    }
    return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  await k.addInitScript((sitzung) => {
    localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(sitzung));
    localStorage.setItem('schach-arena:v1:hinweis-installieren', '1');
    localStorage.setItem('schach-arena:v1:modul:start', JSON.stringify({ v: 1, gesehen: '2026-11-01' }));
  }, SITZUNG);
  const s = await k.newPage(); s.setDefaultTimeout(15000);
  const fehlerListe = [];
  s.on('pageerror', (e) => fehlerListe.push(e.message));
  s.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource|ERR_FAILED/.test(m.text())) fehlerListe.push('console: ' + m.text()); });
  return { k, s, gesendet, fehlerListe };
}
// Einstellungen oeffnen; am Handy ist "Season" eine Unterseite der Liste (.es-nav-punkt data-seite="season")
async function oeffneSeason(s, handy) {
  await s.waitForFunction(() => !!window.__app, null, { timeout: 30000 });
  await s.waitForSelector('.ss-einstellungen .ss-sichtbar', { state: 'attached', timeout: 15000 });
  if (handy) {
    await s.locator('.es-nav-punkt[data-seite="season"]').click();
    await warte(1000);
  }
  await s.locator('.ss-sichtbar').scrollIntoViewIfNeeded();
}
const schalter = (s) => s.evaluate(() => {
  const k = document.querySelector('.ss-sichtbar'); const h = document.querySelector('.ss-alter input');
  if (!k) return null;
  const r = k.getBoundingClientRect();
  return { an: k.getAttribute('aria-checked'), gesperrt: !!k.disabled, haken: h ? h.checked : null, sichtbar: r.width > 0 && r.height > 0 };
});

const browser = await browserTyp(pw).launch({ headless: true });
try {
  for (const g of GERAETE) {
    const bild = (s, n) => (BILDER ? s.screenshot({ path: path.join(BILDER, `${g.name}-${n}.png`) }).catch(() => {}) : null);
    { // mit &paket2: die Season-Gruppe steht da und verhaelt sich wie vereinbart
      const { k, s, gesendet, fehlerListe } = await neuerKontext(browser, g);
      try {
        await s.goto(`${HERKUNFT}/index.html?test&paket2#einstellungen`);
        await oeffneSeason(s, g.handy);
        await bild(s, 'season-vor-haken');
        const vor = await schalter(s);
        pruefe(`${g.name}: Einstellungen zeigen "Season", Schalter aus und gesperrt, 16-Haken leer`,
          !!vor && vor.sichtbar && vor.an === 'false' && vor.gesperrt && vor.haken === false, vor);
        await s.locator('.ss-sichtbar').click({ force: true });
        await warte(300);
        const ohneHaken = await schalter(s);
        pruefe(`${g.name}: ohne Haken geht der Schalter nicht an, nichts an den Server`,
          ohneHaken.an === 'false' && !gesendet.length, { ohneHaken, gesendet });
        await s.locator('.ss-alter').click();
        await warte(300);
        const mitHaken = await schalter(s);
        await bild(s, 'season-nach-haken');
        pruefe(`${g.name}: mit Haken ist der Schalter bedienbar und bleibt aus`, mitHaken.haken === true && !mitHaken.gesperrt && mitHaken.an === 'false', mitHaken);
        await s.locator('.ss-sichtbar').click();
        await s.waitForFunction(() => document.querySelector('.ss-sichtbar').getAttribute('aria-checked') === 'true', null, { timeout: 5000 }).catch(() => {});
        const an = await schalter(s);
        await bild(s, 'season-an');
        pruefe(`${g.name}: Antippen schaltet Season an und schickt saison_sichtbar_setzen mit Altersbestaetigung`,
          an.an === 'true' && gesendet.join() === 'saison_sichtbar_setzen:{"an":true,"alter_bestaetigt":true}', { an, gesendet });
      } catch (e) {
        await bild(s, 'abbruch');
        pruefe(`${g.name}: Ablauf mit &paket2 ohne Abbruch`, false, e.message.split('\n')[0]);
      }
      pruefe(`${g.name}: keine Seiten- oder Konsolenfehler (mit &paket2)`, fehlerListe.length === 0, fehlerListe.slice(0, 5));
      await k.close();
    }
    { // ohne &paket2: die Gruppe gibt es genau dann, wenn paket2Frei() auf der Seite frei gibt (Schalter-Commit)
      const { k, s, fehlerListe } = await neuerKontext(browser, g);
      try {
        await s.goto(`${HERKUNFT}/index.html?test#einstellungen`);
        await s.waitForFunction(() => !!window.__app, null, { timeout: 30000 });
        await warte(2500);
        const frei = await s.evaluate(async () => (await import('/js/freigaben.js')).paket2Frei());
        const da = await s.evaluate(() => !!document.querySelector('.ss-einstellungen .ss-sichtbar') || !!document.querySelector('.es-nav-punkt[data-seite="season"]'));
        pruefe(`${g.name}: ohne &paket2 steht "Season" nur bei freigegebenem Paket 2 da (paket2Frei ${frei})`, da === frei, { frei, da });
      } catch (e) {
        pruefe(`${g.name}: Ablauf ohne &paket2 ohne Abbruch`, false, e.message.split('\n')[0]);
      }
      pruefe(`${g.name}: keine Seiten- oder Konsolenfehler (ohne &paket2)`, fehlerListe.length === 0, fehlerListe.slice(0, 5));
      await k.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}
console.log(`${ok}/${ok + fehler} bestanden`); // INTENTIONAL-SLOP[T4]: die Konsole ist der Ausgabeweg der Probe (tests/alle.mjs liest sie)
process.exit(fehler ? 1 : 0);
