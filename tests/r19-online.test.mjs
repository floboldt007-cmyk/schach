// Online-Seite "Zwei Tueren" (css/online.css, R19 online, 14.11.2026): Abgemeldet steht der Konto-Hinweis .on-konto UNTER den
// Tueren und ist so hoch wie sein Inhalt. Vorher fehlte ihm im R9-Raster (Hochformat ab 740 px Hoehe) die Zeile, er rutschte
// in die freie 1fr-Zeile 2 ueber den Tueren und wurde gestreckt (R18-Kritik E1: iPhone 13 Hinweis 70 bis 250, Tueren ab 297;
// iPad hoch 341 px hoch). Angemeldet gibt es keinen Konto-Hinweis; dort bleibt die Reihenfolge Liga, Tueren, Freunde-Zeile.
// Dazu die Ueberzeile der Tueren (.on-tuer-ueber) mit mindestens 12 px (E3, vorher 11,5 px).
// iPhone 13, iPhone SE, iPad hoch und quer, PC; hell und dunkel; abgemeldet und angemeldet. Netz nur simuliert.
//
//   node tests/r19-online.test.mjs
//   PORT=8975 node tests/r19-online.test.mjs   eigener Port (Standard: frei)
//
// Playwright: Pfad per Umgebungsvariable PLAYWRIGHT_PFAD, sonst 'playwright' oder /opt/node-tools.
import http from 'node:http';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { browserTyp } from './browser.mjs';

const require = createRequire(import.meta.url);
let pw;
for (const p of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
  try { pw = require(p); break; } catch (e) { /* naechster */ }
}
if (!pw) throw new Error('Playwright fehlt');
const root = fileURLToPath(new URL('../', import.meta.url));
const typen = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  const p = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://test').pathname).replace(/\/$/, '/index.html'));
  if (!p.startsWith(root)) { res.writeHead(403); res.end(); return; }
  try { const d = readFileSync(p); res.writeHead(200, { 'Content-Type': typen[path.extname(p)] || 'application/octet-stream' }); res.end(d); }
  catch (e) { res.writeHead(404); res.end(); }
});
const PORT = Number(process.env.PORT) || await (await import('./freier-port.mjs')).freierPort();
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
const BASIS = `http://127.0.0.1:${PORT}/index.html?test#online`;
const sitzung = { access_token: 'a.' + Buffer.from(JSON.stringify({ sub: 'u1' })).toString('base64url') + '.x', refresh_token: 'test-r',
  expires_at: 9999999999, user: { id: 'u1', email: 'spieler@example.invalid' } };

let ok = 0, gesamt = 0;
function pruefe(name, gut, detail = '') {
  gesamt++; if (gut) ok++;
  // INTENTIONAL-SLOP[T4]: die Pruefzeile ist die Ausgabe des Tests (wie in tests/r17-kopf.test.mjs)
  console.log(`${gut ? 'ok  ' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(detail)}`);
}

// Kaesten der Online-Seite; "gestreckt" heisst: der Kasten ist hoeher als seine eigene Hoehe ohne Dehnung (align-self: start,
// height: auto, kurz gesetzt und wieder entfernt). Die Kinder taugen dafuer nicht: der Fuss der Karte sitzt per margin-top: auto
// immer unten, eine gestreckte Karte sieht innen also voll aus.
const messen = (s) => s.evaluate(() => {
  const kasten = (sel) => {
    const e = document.querySelector(`.online-screen ${sel}`);
    if (!e || !e.getClientRects().length) return null;
    const r = e.getBoundingClientRect(), alt = e.getAttribute('style');
    e.style.alignSelf = 'start'; e.style.height = 'auto';
    const eigen = e.getBoundingClientRect().height;
    if (alt === null) e.removeAttribute('style'); else e.setAttribute('style', alt);
    return { oben: Math.round(r.top), unten: Math.round(r.bottom), hoehe: Math.round(r.height), ueberschuss: Math.round(r.height - eigen) };
  };
  const ueber = [...document.querySelectorAll('.online-screen .on-tuer-ueber')].map((e) => parseFloat(getComputedStyle(e).fontSize));
  return { konto: kasten('.on-konto'), tueren: kasten('.on-tueren'), liga: kasten('.on-liga'), freunde: kasten('.on-freunde'),
    ueber, quer: document.documentElement.scrollWidth <= innerWidth };
});

const GERAETE = [['iPhone 13', 390, 844], ['iPhone SE', 375, 667], ['iPad hoch', 820, 1180], ['iPad quer', 1180, 820], ['PC', 1440, 900]];
let browser;
try {
  browser = await browserTyp(pw).launch({ headless: true });
  for (const angemeldet of [false, true]) for (const [geraet, w, h] of GERAETE) for (const modus of ['hell', 'dunkel']) {
    const kontext = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, serviceWorkers: 'block' });
    const unerwartet = [];
    await kontext.route('**/*', (route) => {
      const url = new URL(route.request().url());
      if (url.hostname === '127.0.0.1') return route.continue();
      if (!url.hostname.endsWith('.supabase.co')) return route.abort();
      const antwort = (d) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
      const rpc = url.pathname.split('/').at(-1);
      if (rpc === 'kronen_mein_stand') return antwort({ stufe: 7, kronen: 140, platz: 3, ziel: 120, n: 30, woche: '2026-11-02' });
      if (url.pathname === '/rest/v1/profile') return antwort([{ user_id: 'u1', benutzername: 'Spieler_1' }]);
      if (rpc === 'online_suche_start' || rpc === 'online_suche_stand' || rpc === 'online_suche_ende') return antwort({});
      if (!/^\/(rest|auth|functions)\/v1\//.test(url.pathname)) unerwartet.push(url.pathname);
      return antwort([]);
    });
    await kontext.addInitScript(({ angemeldet, sitzung, modus }) => {
      if (sessionStorage.getItem('r19')) return;
      sessionStorage.setItem('r19', '1');
      localStorage.clear();
      localStorage.setItem('schach-arena:v1:modul:start', JSON.stringify({ v: 1, gesehen: '2026-11-01' }));
      localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ klang: false, bewegung: 'aus', modus }));
      if (angemeldet) localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(sitzung));
    }, { angemeldet, sitzung, modus });
    const s = await kontext.newPage();
    await s.goto(BASIS);
    await s.waitForFunction((m) => document.documentElement.dataset.modus === m, modus, { timeout: 15000 });
    await s.waitForFunction((a) => {
      const t = document.querySelector('.online-screen .on-tueren');
      if (!t) return false;
      if (!a) return !!document.querySelector('.online-screen .on-konto');
      const l = document.querySelector('.online-screen .on-liga');
      return !!document.querySelector('.online-screen .on-freunde') && l && !l.hasAttribute('data-laedt');
    }, angemeldet, { timeout: 15000 });
    await s.waitForTimeout(150);
    const m = await messen(s);
    const wer = `${geraet} ${modus} ${angemeldet ? 'angemeldet' : 'abgemeldet'}`;
    if (!angemeldet) {
      pruefe(`${wer}: Konto-Hinweis unter den Tueren`, m.konto && m.tueren && m.konto.oben >= m.tueren.unten - 1, m);
      pruefe(`${wer}: Konto-Hinweis nicht gestreckt (hoechstens 2 px hoeher als ohne Dehnung)`, m.konto && m.konto.ueberschuss <= 2, m.konto);
    } else {
      pruefe(`${wer}: kein Konto-Hinweis, Reihenfolge Liga, Tueren, Freunde-Zeile`, !m.konto && m.liga && m.tueren && m.freunde
        && m.liga.unten <= m.tueren.oben + 1 && m.freunde.oben >= m.tueren.unten - 1, m);
      pruefe(`${wer}: Freunde-Zeile nicht gestreckt`, m.freunde && m.freunde.ueberschuss <= 2, m.freunde);
    }
    pruefe(`${wer}: Ueberzeile der Tueren mindestens 12 px, kein Querscrollen`, m.ueber.length === 2 && m.ueber.every((p) => p >= 12) && m.quer,
      { ueber: m.ueber, quer: m.quer });
    pruefe(`${wer}: kein unerwarteter Netzaufruf`, unerwartet.length === 0, unerwartet);
    await kontext.close();
  }
} finally {
  if (browser) await browser.close();
  server.close();
}
console.log(`\n${ok}/${gesamt} Pruefungen bestanden`);
process.exit(ok === gesamt ? 0 : 1);
