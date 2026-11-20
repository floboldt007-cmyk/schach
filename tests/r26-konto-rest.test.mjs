// Konto-Rest R26 (Auftrag F-20:50, Review antworten-b):
//   1 Loeschseite (konto-loeschen.html / -en.html): "Mit Google anmelden" ist ohne Netz gesperrt, ein Hinweis
//     (Schluessel konto.brauchtNetz wie in den Einstellungen) sagt warum; online sofort wieder frei; offline startet ein
//     Tipp keine Anmeldung.
//   2 Einstellungen: kontoGruppe haengt je Aufruf online/offline-Listener an window. Mehrfaches Oeffnen der Einstellungen
//     darf sie nicht stapeln: hoechstens ein Paar je sichtbarer Konto-Gruppe. Gezaehlt ueber eine Huelle um
//     window.addEventListener/removeEventListener (laeuft in jedem Browser, kein CDP noetig).
// Netzwerk: alles ausser 127.0.0.1 wird abgebrochen, nie gegen die echte Supabase.
//   node tests/r26-konto-rest.test.mjs
import http from 'node:http';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { browserTyp } from './browser.mjs';

const require = createRequire(import.meta.url);
let pw;
for (const p of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
  try { pw = require(p); break; } catch (e) { /* naechster */ }
}
if (!pw) throw new Error('Playwright fehlt');
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

let ok = 0, gesamt = 0;
function pruefe(name, gut, detail = '') { gesamt++; if (gut) ok++; console.log(`${gut ? 'OK' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(detail)}`); }

const TYPEN = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.mp3': 'audio/mpeg',
  '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
const server = http.createServer(async (q, r) => {
  try {
    const p = decodeURIComponent(new URL(q.url, 'http://x').pathname);
    const datei = path.resolve(WURZEL, '.' + (p === '/' ? '/index.html' : p));
    if (!datei.startsWith(WURZEL)) { r.writeHead(403); r.end(); return; }
    const d = await readFile(datei);
    r.writeHead(200, { 'Content-Type': TYPEN[path.extname(datei)] || 'application/octet-stream' });
    r.end(d);
  } catch (e) { r.writeHead(404); r.end(); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const HOST = `http://127.0.0.1:${server.address().port}`;
const browser = await browserTyp(pw).launch({ headless: true });

async function kontext() {
  const k = await browser.newContext({ viewport: { width: 1024, height: 768 }, serviceWorkers: 'block', locale: 'de-DE' });
  await k.addInitScript(() => {
    try {
      localStorage.setItem('schach-arena:v1:modul:start', JSON.stringify({ v: 1, gesehen: '2026-11-01' }));
      localStorage.setItem('schach-arena:v1:hinweis-installieren', '1');
    } catch (e) { /* egal */ }
    // aktive online/offline-Listener an window zaehlen
    const aktiv = { online: new Set(), offline: new Set() };
    const an = window.addEventListener.bind(window), ab = window.removeEventListener.bind(window);
    window.addEventListener = (typ, fn, opt) => { if (aktiv[typ]) aktiv[typ].add(fn); return an(typ, fn, opt); };
    window.removeEventListener = (typ, fn, opt) => { if (aktiv[typ]) aktiv[typ].delete(fn); return ab(typ, fn, opt); };
    window.__netzListener = () => ({ online: aktiv.online.size, offline: aktiv.offline.size });
  });
  await k.route('**/*', (route) => (new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort()));
  const s = await k.newPage();
  const fehler = []; s.on('pageerror', (e) => fehler.push(e.message));
  return { k, s, fehler };
}

try {
  // ---------- 1 Loeschseite: Google offline ----------
  for (const [sp, datei, muster] of [['de', 'konto-loeschen.html', /Internet/], ['en', 'konto-loeschen-en.html', /internet/]]) {
    const { k, s, fehler } = await kontext();
    await s.goto(`${HOST}/${datei}?test`);
    await s.waitForSelector('[data-kl="google"]', { state: 'attached', timeout: 10000 });
    await warte(400);
    const stand = () => s.evaluate(() => {
      const g = document.querySelector('[data-kl="google"]');
      const h = document.querySelector('.kl-netz-hinweis');
      return { gesperrt: !!g?.disabled, hinweis: !!h && !h.hidden && h.getClientRects().length > 0, text: h?.textContent || '' };
    });
    const online = await stand();
    pruefe(`1 ${sp} online: Google-Knopf frei, kein Netz-Hinweis`, !online.gesperrt && !online.hinweis, online);
    await k.setOffline(true); await warte(300);
    const aus = await stand();
    pruefe(`1 ${sp} offline: Google-Knopf gesperrt`, aus.gesperrt, aus);
    pruefe(`1 ${sp} offline: sichtbarer Hinweis "braucht Internet"`, aus.hinweis && muster.test(aus.text), aus);
    const anfragen = [];
    s.on('request', (q) => { if (q.url().includes('/auth/v1/authorize')) anfragen.push(q.url()); });
    await s.locator('[data-kl="google"]').click({ force: true, timeout: 2000 }).catch(() => {});
    await warte(300);
    pruefe(`1 ${sp} offline: ein Tipp startet keine Anmeldung`, anfragen.length === 0 && s.url().includes(datei), { anfragen, url: s.url() });
    await k.setOffline(false); await warte(300);
    const wieder = await stand();
    pruefe(`1 ${sp} wieder online: Knopf sofort frei, Hinweis weg`, !wieder.gesperrt && !wieder.hinweis, wieder);
    pruefe(`1 ${sp} keine Seitenfehler`, fehler.length === 0, fehler);
    await k.close();
  }

  // ---------- 2 Einstellungen: keine gestapelten Netz-Listener ----------
  {
    const { k, s, fehler } = await kontext();
    await s.goto(`${HOST}/index.html?test#heim`);
    await s.waitForFunction(() => window.__app && document.documentElement.dataset.screen, null, { timeout: 30000 });
    await warte(1000);
    const vorher = await s.evaluate(() => window.__netzListener());
    const zaehlen = [];
    for (let i = 0; i < 5; i++) {
      await s.evaluate(() => window.__app.gehe('einstellungen', { gruppe: 'konto' }));
      await s.waitForSelector('.konto-gruppe .konto-google', { state: 'attached', timeout: 10000 });
      await warte(250);
      zaehlen.push(await s.evaluate(() => window.__netzListener()));
      await s.evaluate(() => window.__app.gehe('heim')); await warte(200);
    }
    await s.evaluate(() => window.__app.gehe('einstellungen', { gruppe: 'konto' }));
    await s.waitForSelector('.konto-gruppe .konto-google', { state: 'attached', timeout: 10000 }); await warte(250);
    const offen = await s.evaluate(() => ({ ...window.__netzListener(), gruppen: document.querySelectorAll('.konto-gruppe').length }));
    const mehr = (z) => Math.max(z.online - vorher.online, z.offline - vorher.offline);
    pruefe('2 fuenfmal Einstellungen oeffnen stapelt keine Netz-Listener (hoechstens ein Paar je sichtbarer Konto-Gruppe)',
      zaehlen.every((z) => mehr(z) <= 1) && mehr(offen) <= offen.gruppen, { vorher, zaehlen, offen });
    // die sichtbare Gruppe folgt dem Netz weiterhin
    await k.setOffline(true); await warte(300);
    const aus = await s.evaluate(() => !!document.querySelector('.konto-gruppe .konto-google')?.disabled);
    await k.setOffline(false); await warte(300);
    const an = await s.evaluate(() => !document.querySelector('.konto-gruppe .konto-google')?.disabled);
    pruefe('2 die sichtbare Konto-Gruppe sperrt offline und gibt online frei', aus && an, { aus, an });
    pruefe('2 keine Seitenfehler', fehler.length === 0, fehler);
    await k.close();
  }
} finally {
  await browser.close(); server.close();
}
console.log(`${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
