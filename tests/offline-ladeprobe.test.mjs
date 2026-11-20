// Offline- und Ladeprobe (fc-03:10, Feinschliff R20): die App wie ein Mensch ohne Netz, je iPhone 13 und PC, in der Engine
// aus BROWSER (chromium Vorgabe, webkit: BROWSER=webkit). Ergaenzt tests/e2e.test.mjs testeOffline (Chromium, iPad-Groesse:
// Partie-Reload, Engine aus dem Cache, Analyse, Verlauf, Einstellungen, Neustart) und doppelt es nicht.
//   (a) Erstbesuch mit Netz, Service Worker steuert die Seite; dann Netz aus (context.setOffline): Neustart ueber die
//       Startadresse zeigt Heim, eine Bot-Partie laeuft bis zum Sieg (Schaefermatt gegen festen Zugplan), eine Lektion oeffnet,
//       Konto (abgemeldet, Code anfordern) und Online (angemeldet, Attrappe) zeigen "Keine Verbindung" statt Fehler oder
//       Endlos-Laden.
//   (b) Netz wieder an, neu laden: die offline gespielte Partie steht im Verlauf, nichts ist verloren.
//   (c) Ladezeit bis Heim bedienbar: Erstbesuch, Wiederbesuch mit Netz, Neustart ohne Netz. Nur gemessen (MESSUNG-Zeilen),
//       keine Grenze.
//   (d) Konsole offline: Seitenfehler sind immer rot; Konsolenfehler nur, wenn sie keine erwarteten Netzfehler sind
//       (Liste ERWARTET unten, jede Zeile als NETZFEHLER ausgegeben).
// Der Server liefert die App unter /schach/ wie GitHub Pages; Supabase beantwortet die Attrappe (mit Netz []).
//   node tests/offline-ladeprobe.test.mjs     (PLAYWRIGHT_PFAD; BROWSER=webkit; BILDER=<ordner> legt Bilder ab)
import { createRequire } from 'node:module';
import http from 'node:http';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { browserTyp } from './browser.mjs';
import { freierPort } from './freier-port.mjs';

let ok = 0; let fehler = 0;
function pruefe(name, wert, info = '') { // INTENTIONAL-SLOP[T4]: die Konsole ist der Ausgabeweg der Probe (tests/alle.mjs liest sie)
  if (wert) { ok++; console.log('ok   ' + name); } else { fehler++; console.log('FEHLER ' + name + ' ' + (typeof info === 'string' ? info : JSON.stringify(info))); }
}
const require = createRequire(import.meta.url);
let pw = null;
for (const p of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
  try { pw = require(p); break; } catch (e) { /* naechster */ } // INTENTIONAL-SLOP[F1]: Fehlschlag heisst naechster Kandidat
}
if (!pw) { pruefe('Playwright gefunden', false); console.log(`${ok}/${ok + fehler} bestanden`); process.exit(1); } // INTENTIONAL-SLOP[T4]: Ausgabeweg

const root = fileURLToPath(new URL('../', import.meta.url));
const PRAEFIX = '/schach/';
const typen = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon' };
const serverLog = [];
const server = http.createServer((req, res) => {
  const pfad = decodeURIComponent(new URL(req.url, 'http://test').pathname);
  serverLog.push(pfad);
  if (!pfad.startsWith(PRAEFIX)) { res.writeHead(404); res.end(); return; }
  const p = path.resolve(root, '.' + pfad.slice(PRAEFIX.length - 1).replace(/\/$/, '/index.html'));
  if (!p.startsWith(root)) { res.writeHead(403); res.end(); return; }
  try { const d = readFileSync(p); res.writeHead(200, { 'Content-Type': typen[path.extname(p)] || 'application/octet-stream' }); res.end(d); }
  catch (e) { res.writeHead(404); res.end(); }
});
const PORT = Number(process.env.PORT) || await freierPort();
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
// im Testbetrieb registriert die App den Service Worker nur mit &sw (js/app.js registriereSW)
const START = `http://127.0.0.1:${PORT}${PRAEFIX}index.html?test&sw`;
const BILDER = process.env.BILDER || '';
if (BILDER) mkdirSync(BILDER, { recursive: true });
const ENGINE = process.env.BROWSER || 'chromium';
const warte = (ms) => new Promise((r) => setTimeout(r, ms));
const klappt = (p) => p.then(() => true, () => false);
const SCREEN = '.screen.partie:not(.online-screen)';
const HEIM = '.heim-screen .heim-buehne';
const SITZUNG = { access_token: 'a.e30.x', refresh_token: 'r', expires_at: 9999999999, user: { id: 'u1', email: 'probe@example.invalid' } };
const PLAN = { e2e4: 'e7e5', f1c4: 'b8c6', d1h5: 'g8f6' };
const KEINE_VERBINDUNG = /Keine Verbindung/;
// erwartete Netzfehler ohne Netz: fehlgeschlagene Anfragen ans Konto-Backend (Supabase) und an fremde Adressen sowie die
// Browser-Meldung dazu. Alles andere in der Konsole ist offline ein Fehler.
const ERWARTET = [/Failed to load resource/i, /ERR_INTERNET_DISCONNECTED/, /net::ERR_/, /supabase\.co/, /NetworkError|Load failed|Failed to fetch/i,
  /internet connection appears to be offline/i, /Keine Verbindung/];
const { defaultBrowserType: _typ, ...IPHONE } = pw.devices['iPhone 13'];
// WebKit kennt isMobile nicht als Geraet-Schalter, die Groesse und der Touch reichen fuer die Ansicht
const GERAETE = [
  { name: 'iphone13', opt: ENGINE === 'webkit' ? { ...IPHONE, isMobile: false } : IPHONE },
  { name: 'pc1280', opt: { viewport: { width: 1280, height: 800 } } },
];

// bis Heim bedienbar: App bereit und die Buehne sichtbar; misst ab dem Aufruf
const UNGEFANGEN = [];
const sammleUngefangen = async (s) => UNGEFANGEN.push(...(await s.evaluate(() => window.__ungefangen || []).catch(() => [])));
async function ladeBisHeim(s, adresse) {
  await sammleUngefangen(s);
  const t0 = Date.now();
  await s.goto(adresse);
  await s.waitForFunction((sel) => window.__app && document.querySelector(sel) && document.querySelector(sel).getBoundingClientRect().height > 0, HEIM, { timeout: 30000 });
  await s.locator(HEIM).waitFor({ state: 'visible', timeout: 5000 });
  return Date.now() - t0;
}
async function zug(s, uci) {
  await s.waitForFunction(() => window.__partie.phase() === 'flo', null, { timeout: 40000 });
  for (const f of [uci.slice(0, 2), uci.slice(2, 4)]) await s.locator(`${SCREEN} .brett-felder .feld[data-feld="${f}"]`).click();
  if (await s.locator(`${SCREEN} .brett .lage.vorschau`).count()) await s.locator(`${SCREEN} .brett-felder .feld[data-feld="${uci.slice(2, 4)}"]`).click();
}
const partien = (s) => s.evaluate(() => { try { return (JSON.parse(localStorage.getItem('schach-arena:v1:partien')) || []).map((p) => p && p.id); } catch (e) { return []; } }); // INTENTIONAL-SLOP[E5]: kaputter Speicher heisst leere Liste, die Datenverlust-Pruefung wird dann rot (verlangt >= 1)
const zeigtHinweis = (s) => s.evaluate((q) => new RegExp(q).test(document.body.innerText), KEINE_VERBINDUNG.source);

const browser = await browserTyp(pw).launch({ headless: true });
try {
  for (const g of GERAETE) {
    const tag = `${ENGINE} ${g.name}`;
    const k = await browser.newContext({ ...g.opt, locale: 'de-DE' });
    let offline = false;
    await k.route('**/*.supabase.co/**', (r) => (offline ? r.abort('internetdisconnected') : r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })));
    await k.addInitScript(() => {
      try {
        if (!localStorage.getItem('schach-arena:v1:modul:start')) localStorage.setItem('schach-arena:v1:modul:start', JSON.stringify({ v: 1, gesehen: '2026-11-01' }));
        if (!localStorage.getItem('schach-arena:v1:einstellungen')) localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ klang: false }));
        localStorage.setItem('schach-arena:v1:hinweis-installieren', '1');
        localStorage.setItem('schach-arena:konto:sichtbar', '1');
        window.__ungefangen = [];
        addEventListener('error', (e) => window.__ungefangen.push('error: ' + e.message));
        addEventListener('unhandledrejection', (e) => window.__ungefangen.push('rejection: ' + (e.reason && e.reason.message || e.reason)));
      } catch (e) { /* egal */ } // INTENTIONAL-SLOP[F1]: Speicher gesperrt heisst Probe ohne Vorbelegung
    });
    const seitenfehler = [], konsole = [], netz = [];
    const beobachte = (s) => {
      s.on('pageerror', (e) => seitenfehler.push(`${offline ? 'offline' : 'online'} ${s.url().replace(/^.*#/, '#')}: ${e.message} ${(e.stack || '').split('\n').slice(0, 3).join(' | ')}`));
      s.on('console', (m) => { if (m.type() === 'error') konsole.push({ offline, text: m.text() }); });
      s.on('requestfailed', (r) => { if (offline) netz.push(`${r.url().replace(/\?.*$/, '')} ${r.failure() ? r.failure().errorText : ''}`); });
    };
    const s = await k.newPage(); s.setDefaultTimeout(15000); beobachte(s);
    const bild = (p, n) => (BILDER ? p.screenshot({ path: path.join(BILDER, `${ENGINE}-${g.name}-${n}.png`) }).catch(() => {}) : null);
    try {
      // ---------- (c) Erstbesuch, Service Worker ----------
      const erst = await ladeBisHeim(s, START);
      const sw = await klappt(s.waitForFunction(() => !!(navigator.serviceWorker && navigator.serviceWorker.controller), null, { timeout: 30000 }));
      pruefe(`${tag}: Erstbesuch zeigt Heim, Service Worker steuert die Seite`, sw);
      // der Cache ist voll, wenn die Installation fertig ist (ready) und index.html darin liegt
      const imCache = sw && await s.evaluate(async () => {
        const fertig = await Promise.race([navigator.serviceWorker.ready.then(() => true), new Promise((r) => setTimeout(() => r(false), 30000))]);
        if (!fertig) return false;
        for (const c of await caches.keys()) if (await (await caches.open(c)).match(location.pathname.replace(/index\.html$/, '') + 'index.html')) return true;
        return false;
      });
      if (!imCache) throw new Error('ohne fertigen Service Worker ist der Offline-Teil sinnlos');
      pruefe(`${tag}: Startseite liegt im Cache des Service Workers`, imCache);
      const wieder = await ladeBisHeim(s, START);
      console.log(`MESSUNG ${tag} erstbesuch_ms=${erst} wiederbesuch_ms=${wieder}`); // INTENTIONAL-SLOP[T4]: Messwerte sind Ausgabe

      // ---------- (a) Netz aus ----------
      offline = true;
      await k.setOffline(true);
      const vorServer = serverLog.length;
      const ohneNetz = await ladeBisHeim(s, START).catch((e) => { throw new Error('Neustart ohne Netz: ' + e.message.split('\n')[0]); });
      console.log(`MESSUNG ${tag} neustart_offline_ms=${ohneNetz}`); // INTENTIONAL-SLOP[T4]: Messwerte sind Ausgabe
      await bild(s, '1-heim-offline');
      pruefe(`${tag}: ohne Netz startet die App neu und zeigt Heim`, await s.locator(HEIM).isVisible());
      // Bot-Partie bis zum Sieg
      const vorPartien = await partien(s);
      await s.evaluate((p) => {
        localStorage.removeItem('schach-arena:v1:laufend');
        window.__test = { ...(window.__test || {}), botZug: () => { const v = window.__partie.chess().history({ verbose: true }); return p[v[v.length - 1].lan] || null; } };
        window.__app.gehe('partie', { botId: 'fridolin', farbe: 'w' });
      }, PLAN);
      const bereit = await klappt(s.waitForFunction((sel) => window.__partie && window.__partie.bereit === true && window.__partie.phase() === 'flo'
        && document.querySelectorAll(sel + ' .brett img.figur').length === 32, SCREEN, { timeout: 40000 }));
      pruefe(`${tag}: ohne Netz startet eine Bot-Partie (Engine aus dem Cache)`, bereit);
      if (bereit) {
        for (const u of ['e2e4', 'f1c4', 'd1h5', 'h5f7']) await zug(s, u);
        const sieg = await klappt(s.waitForSelector('.ergebnis-overlay.sieg.gefuellt', { timeout: 40000 }));
        await warte(2000);
        await bild(s, '2-sieg-offline');
        const nachPartien = await partien(s);
        pruefe(`${tag}: ohne Netz laeuft die Partie bis zum Sieg und wird gespeichert`, sieg && nachPartien.length === vorPartien.length + 1,
          { sieg, vorher: vorPartien.length, nachher: nachPartien.length });
      }
      // Lektion
      await s.evaluate(() => window.__app.gehe('lektion', { id: 'grundreihe' }));
      const lektion = await klappt(s.locator('.ls-aktionen [data-a="los"]').waitFor({ timeout: 15000 }));
      await bild(s, '3-lektion-offline');
      pruefe(`${tag}: ohne Netz oeffnet eine Lektion`, lektion);
      // Konto (abgemeldet): Code anfordern zeigt "Keine Verbindung"
      await s.evaluate(() => window.__app.gehe('einstellungen', window.innerWidth <= 700 ? { seite: 'konto' } : { gruppe: 'konto' }));
      const kontoDa = await klappt(s.locator('.konto-email').waitFor({ state: 'visible', timeout: 15000 }));
      if (kontoDa) {
        await s.locator('.konto-email').fill('probe@example.invalid');
        await s.locator('[data-konto="code"]').click();
        await klappt(s.waitForFunction((q) => new RegExp(q).test(document.querySelector('.konto-status')?.textContent || ''), KEINE_VERBINDUNG.source, { timeout: 15000 }));
      }
      await bild(s, '4-konto-offline');
      const kontoText = await s.evaluate(() => document.querySelector('.konto-status')?.textContent || '');
      pruefe(`${tag}: Konto ohne Netz sagt "Keine Verbindung" statt Fehler oder Endlos-Laden`, kontoDa && KEINE_VERBINDUNG.test(kontoText), { kontoDa, kontoText });
      // Online (angemeldet, Attrappe): Online-Seite oeffnen; nach 10 s muss "Keine Verbindung" dastehen
      await s.evaluate((x) => localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(x)), SITZUNG);
      await ladeBisHeim(s, START);
      await s.evaluate(() => window.__app.gehe('online'));
      await warte(1500);
      if (await s.locator('.lb-suchen').count()) await s.locator('.lb-suchen').first().click().catch(() => {});
      const onlineHinweis = await klappt(s.waitForFunction((q) => new RegExp(q).test(document.body.innerText), KEINE_VERBINDUNG.source, { timeout: 10000 }));
      await bild(s, '5-online-offline');
      const onlineLage = await s.evaluate(() => ({ hash: location.hash, laedt: [...document.querySelectorAll('[aria-busy="true"]')].filter((e) => e.getClientRects().length).length,
        text: document.body.innerText.replace(/\s+/g, ' ').slice(0, 160) }));
      pruefe(`${tag}: Online ohne Netz sagt "Keine Verbindung" und laedt nicht endlos`, onlineHinweis && onlineLage.laedt === 0, onlineLage);
      // (d) Konsole und Server waehrend offline
      const unerwartet = konsole.filter((x) => x.offline && !ERWARTET.some((re) => re.test(x.text)));
      for (const x of konsole.filter((y) => y.offline && ERWARTET.some((re) => re.test(y.text)))) console.log(`NETZFEHLER ${tag} konsole: ${x.text.slice(0, 160)}`); // INTENTIONAL-SLOP[T4]: Liste fuer den Bericht
      for (const x of [...new Set(netz)]) console.log(`NETZFEHLER ${tag} anfrage: ${x.slice(0, 160)}`);
      pruefe(`${tag}: ohne Netz keine unerwarteten Konsolenfehler`, unerwartet.length === 0, unerwartet.slice(0, 5).map((x) => x.text));
      const anServer = serverLog.slice(vorServer).filter((p) => !p.endsWith('/sw.js'));
      pruefe(`${tag}: ohne Netz geht keine Anfrage an den App-Server (alles aus dem Cache)`, anServer.length === 0, anServer.slice(0, 5));

      // ---------- (b) Netz wieder an ----------
      offline = false;
      await k.setOffline(false);
      await s.evaluate(() => localStorage.removeItem('schach-arena:konto:sitzung'));
      await ladeBisHeim(s, START);
      const danach = await partien(s);
      await s.evaluate(() => window.__app.gehe('verlauf'));
      const zeilen = await klappt(s.locator('.vl-zeile').first().waitFor({ timeout: 15000 }));
      await bild(s, '6-verlauf-online');
      pruefe(`${tag}: Netz wieder an: die offline gespielte Partie ist noch da und steht im Verlauf`,
        zeilen && danach.length >= 1 && danach.length === (await partien(s)).length, { zeilen, partien: danach.length });
    } catch (e) {
      await bild(s, 'abbruch');
      pruefe(`${tag}: Ablauf ohne Abbruch`, false, e.message.split('\n')[0]);
    }
    // WebKit meldet einen abgefangenen Fetch-Fehler an Supabase (js/konto.js anfrage faengt ihn) als pageerror
    // "Fetch API cannot load ...supabase.co... due to access control checks", die Seite selbst sieht keinen ungefangenen
    // Fehler (belegt 20.11.2026 mit Gegenprobe). Darum zaehlen ungefangene Fehler im Fenster immer, diese Rohmeldung nur
    // offline als erwarteter Netzfehler.
    await sammleUngefangen(s);
    const ungefangen = UNGEFANGEN.splice(0);
    const netzSeitenfehler = (x) => /^offline /.test(x) && /Fetch API cannot load https:\/\/[a-z0-9]+\.supabase\.co\//.test(x);
    for (const x of seitenfehler.filter(netzSeitenfehler)) console.log(`NETZFEHLER ${tag} seitenfehler: ${x.slice(0, 160)}`); // INTENTIONAL-SLOP[T4]: Liste fuer den Bericht
    pruefe(`${tag}: keine ungefangenen Fehler in der Seite`, ungefangen.length === 0, ungefangen.slice(0, 5));
    pruefe(`${tag}: keine Seitenfehler ausser erwarteten Netzfehlern ohne Netz`, seitenfehler.filter((x) => !netzSeitenfehler(x)).length === 0,
      seitenfehler.filter((x) => !netzSeitenfehler(x)).slice(0, 5));
    await k.close();
  }
} finally {
  await browser.close();
  server.close();
}
console.log(`${ok}/${ok + fehler} bestanden`); // INTENTIONAL-SLOP[T4]: Ausgabeweg
process.exit(fehler ? 1 : 0);
