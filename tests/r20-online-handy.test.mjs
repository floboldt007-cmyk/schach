// R20 B1 (Kritik auf den Livebildern VERSION 349, Befund 1, Bauvorlage Fix 1): Online-Seite abgemeldet am Handy hoch.
// Im R9-Raster (Hochformat ab 740 px Hoehe, unter 760 px Breite) stehen die zwei Tueren mit einer Mittelreihe bis 36 px
// plus zweimal 12 px Rasterluecke auseinander. Angemeldet ist das gewollt (Lobby mittig, Liga-Streifen darueber);
// abgemeldet fehlt der Streifen, die Tueren tragen nur "Mit Konto spielbar", und zwischen ihnen blieb rund 60 px Leere.
// Fix: nur abgemeldet (.on-tueren[data-zustand="ohne"]) ist die Mittelreihe 0, der Block bleibt mittig.
// Bewusst NICHT geaendert (Flo-Entscheidungen, Bauvorlage B1): Raster mittig (R9-LobbyLeere B), Strichrand der Tueren
// (Befund V 6), Kopfsatz am Handy weg (Flo 31.10.), "Mit Konto spielbar" in den Tueren (R5-1).
//
// Gegenprobe: jede Ansicht wird zweimal gemessen, mit css/online.css und mit derselben Datei OHNE die Fix-Regel (die
// Basis). Ausser der Luecke zwischen den Tueren auf dem iPhone 13 abgemeldet darf sich nichts bewegen (Fingerabdruck
// aller Kaesten), angemeldet und auf allen anderen Geraeten auch dort nicht.
//
//   node tests/r20-online-handy.test.mjs
//   ONLINE_CSS=<datei> node tests/r20-online-handy.test.mjs   misst eine andere online.css (Probe mit einer Mutante)
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

// Die Fix-Regel: ein Block, dessen Selektor die Tueren abgemeldet nennt und der ihre Reihen setzt
const FIX_BLOCK = /[^{}]*\.on-tueren\[data-zustand="ohne"\][^{}]*\{[^{}]*grid-template-rows[^{}]*\}/g;
const css = readFileSync(process.env.ONLINE_CSS || path.join(root, 'css/online.css'), 'utf8');
const fixBloecke = css.match(FIX_BLOCK) || [];
const basisCss = css.replace(FIX_BLOCK, '');

let ok = 0, gesamt = 0;
function pruefe(name, gut, detail = '') {
  gesamt++; if (gut) ok++;
  // INTENTIONAL-SLOP[T4]: die Pruefzeile ist die Ausgabe des Tests (wie in tests/r19-online.test.mjs)
  console.log(`${gut ? 'ok  ' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(detail)}`);
}

// Kaesten der Online-Seite (gerundet) und die Luecke zwischen den zwei Tueren; nebeneinander (ab 760 px) ist sie null
const messen = (s) => s.evaluate(() => {
  const r = (e) => { if (!e || !e.getClientRects().length) return null; const b = e.getBoundingClientRect();
    return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)]; };
  const q = (sel) => document.querySelector(`.online-screen ${sel}`);
  const tueren = [...document.querySelectorAll('.online-screen .on-tueren > .on-tuer')];
  const [a, b] = tueren.map((t) => t.getBoundingClientRect());
  const untereinander = a && b && b.top >= a.bottom - 1;
  const rumpf = q('.on-rumpf').getBoundingClientRect(), pad = parseFloat(getComputedStyle(q('.on-rumpf')).paddingTop);
  const bloecke = [...q('.on-inhalt').children].filter((e) => e.getClientRects().length && getComputedStyle(e).position !== 'absolute');
  const erster = bloecke[0]?.getBoundingClientRect(), letzter = bloecke.at(-1)?.getBoundingClientRect();
  return {
    luecke: untereinander ? Math.round(b.top - a.bottom) : null,
    oben: erster ? Math.round(erster.top - rumpf.top - pad) : null, unten: letzter ? Math.round(rumpf.bottom - pad - letzter.bottom) : null,
    hinweise: [...document.querySelectorAll('.online-screen .on-tuer-hinweis')].filter((e) => e.getClientRects().length).length,
    finger: { kopf: r(q('.seiten-kopf')), liga: r(q('.on-liga')), tueren: tueren.map(r), konto: r(q('.on-konto')), freunde: r(q('.on-freunde')),
      knopf: r(q('.on-konto .knopf')) },
    quer: document.documentElement.scrollWidth <= innerWidth,
  };
});

pruefe('Fix-Regel: online.css setzt genau einmal die Reihen der Tueren abgemeldet', fixBloecke.length === 1, fixBloecke);

// Geraet, Breite, Hoehe, greift die Regel (Hochformat ab 740 px Hoehe und unter 760 px Breite)
const GERAETE = [['iPhone 13', 390, 844, true], ['iPhone SE', 375, 667, false], ['schmal 320', 320, 568, false],
  ['iPad hoch', 820, 1180, false], ['PC', 1280, 720, false]];
let browser;
async function ansicht({ w, h, modus, angemeldet, cssText }) {
  const kontext = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, serviceWorkers: 'block' });
  const unerwartet = [];
  await kontext.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1') {
      if (url.pathname.endsWith('/css/online.css')) return route.fulfill({ status: 200, contentType: 'text/css', body: cssText });
      return route.continue();
    }
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
    if (sessionStorage.getItem('r20')) return;
    sessionStorage.setItem('r20', '1');
    localStorage.clear();
    localStorage.setItem('schach-arena:v1:modul:start', JSON.stringify({ v: 1, gesehen: '2026-11-01' }));
    localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ klang: false, bewegung: 'aus', modus }));
    if (angemeldet) localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(sitzung));
  }, { angemeldet, sitzung, modus });
  const s = await kontext.newPage();
  await s.goto(BASIS);
  await s.waitForFunction((m) => document.documentElement.dataset.modus === m, modus, { timeout: 15000 });
  await s.waitForFunction((a) => {
    if (!document.querySelector('.online-screen .on-tueren')) return false;
    if (!a) return !!document.querySelector('.online-screen .on-konto');
    const l = document.querySelector('.online-screen .on-liga');
    return !!document.querySelector('.online-screen .on-freunde') && l && !l.hasAttribute('data-laedt');
  }, angemeldet, { timeout: 15000 });
  await s.waitForTimeout(150);
  const m = await messen(s);
  await kontext.close();
  return { ...m, unerwartet };
}

try {
  browser = await browserTyp(pw).launch({ headless: true });
  for (const angemeldet of [false, true]) for (const [geraet, w, h, greift] of GERAETE) for (const modus of ['hell', 'dunkel']) {
    const wer = `${geraet} ${modus} ${angemeldet ? 'angemeldet' : 'abgemeldet'}`;
    const neu = await ansicht({ w, h, modus, angemeldet, cssText: css });
    const alt = await ansicht({ w, h, modus, angemeldet, cssText: basisCss });
    pruefe(`${wer}: kein unerwarteter Netzaufruf, kein Querscrollen`, !neu.unerwartet.length && !alt.unerwartet.length && neu.quer,
      { neu: neu.unerwartet, alt: alt.unerwartet, quer: neu.quer });
    if (!angemeldet && greift) {
      pruefe(`${wer}: Luecke zwischen den Tueren hoechstens 24 px (Basis ${alt.luecke} px)`, neu.luecke !== null && neu.luecke <= 24, neu.luecke);
      pruefe(`${wer}: Tueren, Konto-Karte und Knopf gleich gross wie in der Basis`,
        JSON.stringify(neu.finger.tueren.map((t) => t?.slice(2))) === JSON.stringify(alt.finger.tueren.map((t) => t?.slice(2)))
        && JSON.stringify(neu.finger.konto?.slice(2)) === JSON.stringify(alt.finger.konto?.slice(2)), { neu: neu.finger, alt: alt.finger });
      pruefe(`${wer}: Block bleibt mittig (oben und unten frei hoechstens 2 px verschieden)`,
        neu.oben !== null && Math.abs(neu.oben - neu.unten) <= 2, { oben: neu.oben, unten: neu.unten });
      pruefe(`${wer}: weiter zweimal "Mit Konto spielbar" plus Konto-Karte mit Knopf (gewollt, R5-1)`,
        neu.hinweise === 2 && alt.hinweise === 2 && !!neu.finger.knopf, { neu: neu.hinweise, alt: alt.hinweise });
    } else {
      pruefe(`${wer}: unveraendert gegen die Basis (Fingerabdruck aller Kaesten)`,
        JSON.stringify(neu.finger) === JSON.stringify(alt.finger) && neu.hinweise === alt.hinweise, { neu: neu.finger, alt: alt.finger });
    }
  }
} finally {
  if (browser) await browser.close();
  server.close();
}
console.log(`\n${ok}/${gesamt} Pruefungen bestanden`);
process.exit(ok === gesamt ? 0 : 1);
