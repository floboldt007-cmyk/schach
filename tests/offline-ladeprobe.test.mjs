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
import vm from 'node:vm';
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
// Der Kern aus sw.js (fc-06:00, 20.11.2026): nur ihn legt die Installation ab, der Rest kommt danach in Haeppchen. Die Probe
// beschneidet den Cache vor dem Netz-Aus auf genau den Kern und Stockfish (ZUERST, der erste Happen danach), damit sie
// zeigt, dass das fuer alles unten reicht.
const KERN = (() => {
  const k = { self: { location: new URL('https://example.org/schach/sw.js'), addEventListener() {} }, URL };
  vm.createContext(k);
  vm.runInContext(readFileSync(path.join(root, 'sw.js'), 'utf8') + '\n;globalThis.__kern = typeof KERN === "undefined" ? null : KERN.concat(typeof ZUERST === "undefined" ? [] : ZUERST);', k);
  return k.__kern;
})();
const PRAEFIX = '/schach/';
const typen = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon' };
const server = http.createServer((req, res) => {
  const pfad = decodeURIComponent(new URL(req.url, 'http://test').pathname);
  if (!pfad.startsWith(PRAEFIX)) { res.writeHead(404); res.end(); return; }
  const p = path.resolve(root, '.' + pfad.slice(PRAEFIX.length - 1).replace(/\/$/, '/index.html'));
  if (!p.startsWith(root)) { res.writeHead(403); res.end(); return; }
  try { const d = readFileSync(p); res.writeHead(200, { 'Content-Type': typen[path.extname(p)] || 'application/octet-stream' }); res.end(d); }
  catch (e) { res.writeHead(404); res.end(); }
});
const PORT = Number(process.env.PORT) || await freierPort();
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
// im Testbetrieb registriert die App den Service Worker nur mit &sw (js/app.js registriereSW)
const EIGEN = `http://127.0.0.1:${PORT}/`;
const START = `${EIGEN}${PRAEFIX.slice(1)}index.html?test&sw`;
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
    // Zeit je Seitenfehler (gleicher Index) und je vollem Neuladen der Hauptseite: eine Navigationsanfrage der Hauptseite,
    // dann ihr framenavigated (ein Sprung nur im #-Teil hat keine Anfrage und zaehlt nicht)
    const seitenfehlerZeit = [], neuladenZeit = [];
    const beobachte = (s) => {
      // Kaltreview 43 (Mutant D): eine Navigation ohne neues Dokument (204, Abbruch) darf einen spaeteren #-Sprung nicht zum
      // Neuladen machen. Darum zaehlt framenavigated nur, wenn die offene Anfrage auf genau diese Adresse (ohne #) ging.
      let navAdresse = null;
      const ohneRaute = (u) => u.replace(/#.*$/, '');
      const istNav = (r) => r.isNavigationRequest() && r.frame() === s.mainFrame();
      s.on('request', (r) => { if (istNav(r)) navAdresse = ohneRaute(r.url()); });
      s.on('requestfailed', (r) => { if (istNav(r)) navAdresse = null; });
      s.on('response', (r) => { if (istNav(r.request()) && (r.status() === 204 || r.status() === 205)) navAdresse = null; });
      s.on('framenavigated', (f) => {
        if (f !== s.mainFrame()) return;
        if (navAdresse && navAdresse === ohneRaute(f.url())) neuladenZeit.push(Date.now());
        navAdresse = null;
      });
      s.on('pageerror', () => seitenfehlerZeit.push(Date.now()));
      s.on('pageerror', (e) => seitenfehler.push(`${offline ? 'offline' : 'online'} ${s.url().replace(/^.*#/, '#')}: ${e.message} ${(e.stack || '').split('\n').slice(0, 3).join(' | ')}`));
      s.on('console', (m) => { if (m.type() === 'error') konsole.push({ offline, text: m.text(), url: (m.location() && m.location().url) || '' }); });
      s.on('requestfailed', (r) => { if (offline) netz.push({ url: r.url().replace(/\?.*$/, ''), grund: r.failure() ? r.failure().errorText : '' }); });
    };
    const s = await k.newPage(); s.setDefaultTimeout(15000); beobachte(s);
    let offlineId = null;
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
      // Gegenprobe (PROBE_KLANG_GEGEN=1): derselbe Wortlaut wie der WebKit-Abbruch, aber ohne folgendes Neuladen -> muss rot sein
      if (process.env.PROBE_KLANG_GEGEN === '1') {
        await s.evaluate(() => setTimeout(() => { throw new Error(`Fetch API cannot load ${location.origin}/schach/assets/klang/arcade/brillant.mp3 due to access control checks.`); }, 0));
        await warte(1500);
      }
      const wieder = await ladeBisHeim(s, START);
      console.log(`MESSUNG ${tag} erstbesuch_ms=${erst} wiederbesuch_ms=${wieder}`); // INTENTIONAL-SLOP[T4]: Messwerte sind Ausgabe

      // ---------- (a) Netz aus ----------
      offline = true;
      await k.setOffline(true);
      // erst Netz aus (das Nachladen bricht ab), dann alles ausser dem Kern aus dem Cache: so laeuft der Rest wie bei einem
      // neuen Spieler, dessen Nachladen noch nicht fertig ist
      await s.waitForTimeout(500);
      const beschnitten = Array.isArray(KERN) && await s.evaluate(async (kern) => {
        const basis = location.pathname.replace(/index\.html$/, '');
        const behalten = new Set(kern.map((d) => basis + d));
        let rest = 0;
        for (const n of await caches.keys()) {
          const c = await caches.open(n);
          for (const r of await c.keys()) if (!behalten.has(new URL(r.url).pathname)) { await c.delete(r); rest++; }
        }
        return rest;
      }, KERN);
      pruefe(`${tag}: Cache auf den Kern beschnitten (${KERN ? KERN.length : 0} Dateien, ${beschnitten || 0} weitere entfernt)`, Array.isArray(KERN) && beschnitten !== false);
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
        const neu = nachPartien.filter((id) => !vorPartien.includes(id));
        if (neu.length === 1) offlineId = neu[0];
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
      // fc-03:30: ohne laufende Partie spricht der Hinweis nicht von "der Partie"; "Duell suchen" ist gesperrt und sagt warum
      const duellLage = () => s.evaluate(() => {
        const k = document.querySelector('[data-online="duell"]'), h = document.querySelector('.on-netz-hinweis');
        return { da: !!k, aus: !!k && k.disabled, aria: k && k.getAttribute('aria-disabled'), hinweis: !!h && !h.hidden && h.getClientRects().length > 0,
          hinweisText: h ? h.textContent : '', parteiText: /Partie bleibt auf dem Server|game is saved on the server/.test(document.body.innerText) };
      });
      const offen = await duellLage();
      pruefe(`${tag}: Online ohne laufende Partie hat einen eigenen Offline-Text (nicht "die Partie bleibt gespeichert")`, !offen.parteiText && onlineHinweis, offen);
      pruefe(`${tag}: ohne Netz ist "Duell suchen" gesperrt (disabled, aria-disabled) mit sichtbarem Hinweis`,
        offen.da && offen.aus && offen.aria === 'true' && offen.hinweis, offen);
      // (d) Konsole und Server waehrend offline
      // erwartet nur, wenn die Meldung nicht von einer eigenen Adresse stammt (Kaltreview B1c)
      const erwartet = (x) => !x.url.startsWith(EIGEN) && ERWARTET.some((re) => re.test(x.text));
      const unerwartet = konsole.filter((x) => x.offline && !erwartet(x));
      for (const x of konsole.filter((y) => y.offline && erwartet(y))) console.log(`NETZFEHLER ${tag} konsole: ${x.text.slice(0, 160)}`); // INTENTIONAL-SLOP[T4]: Liste fuer den Bericht
      for (const x of [...new Set(netz.map((y) => `${y.url} ${y.grund}`))]) console.log(`NETZFEHLER ${tag} anfrage: ${x.slice(0, 160)}`);
      pruefe(`${tag}: ohne Netz keine unerwarteten Konsolenfehler`, unerwartet.length === 0, unerwartet.slice(0, 5).map((x) => x.text));
      // Kaltreview B1 (f2, 20.11.): setOffline laesst offline nichts zum Server durch, ein Serverprotokoll bliebe immer leer.
      // Was fehlt, sieht man an der fehlgeschlagenen Anfrage: keine an die eigene App (ausser sw.js, dessen Update-Pruefung offline scheitern darf)
      const eigeneFehlt = [...new Set(netz.filter((x) => x.url.startsWith(EIGEN) && !x.url.endsWith('/sw.js')).map((x) => `${x.url} ${x.grund}`))];
      pruefe(`${tag}: ohne Netz kommt jede App-Datei aus dem Cache (keine eigene Anfrage scheitert)`, eigeneFehlt.length === 0, eigeneFehlt.slice(0, 5));

      // ---------- (b) Netz wieder an ----------
      offline = false;
      await k.setOffline(false);
      // ohne Neuladen: das online-Ereignis gibt den Knopf wieder frei
      await klappt(s.waitForFunction(() => { const x = document.querySelector('[data-online="duell"]'); return x && !x.disabled; }, null, { timeout: 10000 }));
      const zurueck = await duellLage();
      pruefe(`${tag}: Netz wieder an: "Duell suchen" ist ohne Neuladen wieder bedienbar, Hinweis weg`,
        zurueck.da && !zurueck.aus && zurueck.aria !== 'true' && !zurueck.hinweis, zurueck);
      await s.evaluate(() => localStorage.removeItem('schach-arena:konto:sitzung'));
      await ladeBisHeim(s, START);
      // Kaltreview B2: genau die offline gespielte Partie (Kennung von vorhin) muss in Speicher und Verlauf stehen
      const danach = await partien(s);
      await s.evaluate(() => window.__app.gehe('verlauf'));
      const zeile = !!offlineId && await klappt(s.locator(`.vl-zeile[data-id="${offlineId}"]`).waitFor({ timeout: 15000 }));
      await bild(s, '6-verlauf-online');
      pruefe(`${tag}: Netz wieder an: die offline gespielte Partie ist noch da und steht im Verlauf`,
        zeile && danach.includes(offlineId), { offlineId, zeile, partien: danach.length });
    } catch (e) {
      await bild(s, 'abbruch');
      pruefe(`${tag}: Ablauf ohne Abbruch`, false, e.message.split('\n')[0]);
    }
    // WebKit meldet einen abgefangenen Fetch-Fehler an Supabase (js/konto.js anfrage faengt ihn) als pageerror
    // "Fetch API cannot load ...supabase.co... due to access control checks", die Seite selbst sieht keinen ungefangenen
    // Fehler (belegt 20.11.2026 mit Gegenprobe). Darum zaehlen ungefangene Fehler im Fenster immer, diese Rohmeldung nur
    // offline als erwarteter Netzfehler. Ausnahme Klang: js/sounds.js hole() faengt jeden Abruf ab (.catch(() => null)),
    // WebKit meldet einen mp3-Abruf, den das Neuladen der Seite abbricht, trotzdem so, auch mit Netz. Gemessen 20.11.2026
    // (f2, 8 Laeufe WebKit unter Last): 55 von 55 Klang-Meldungen lagen 10 bis 60 ms VOR einem vollen Neuladen, keine
    // ohne; Playwright nannte "Load request cancelled". Darum gilt die Ausnahme nur mit einem Neuladen der Hauptseite
    // hoechstens KLANG_VOR_MS danach (oder KLANG_NACH_MS davor, falls die Meldung spaeter ankommt); ein Klang-Fehler ohne
    // Neuladen bleibt rot (Gegenprobe PROBE_KLANG_GEGEN=1).
    await sammleUngefangen(s);
    const ungefangen = UNGEFANGEN.splice(0);
    const klangMeldung = (x) => /Fetch API cannot load https?:\/\/127\.0\.0\.1:\d+\/schach\/assets\/klang\/\S+\.mp3 due to access control checks/.test(x);
    const KLANG_VOR_MS = 200, KLANG_NACH_MS = 100;
    const vorNeuladen = (i) => neuladenZeit.some((n) => n - seitenfehlerZeit[i] <= KLANG_VOR_MS && seitenfehlerZeit[i] - n <= KLANG_NACH_MS);
    const klangAbbruch = (x, i) => klangMeldung(x) && vorNeuladen(i);
    const netzSeitenfehler = (x, i) => (/^offline /.test(x) && /Fetch API cannot load https:\/\/[a-z0-9]+\.supabase\.co\//.test(x)) || klangAbbruch(x, i);
    // Kaltreview f2 (fc-0330b): jeder Klang-Treffer steht als eigene Zeile im Log, damit eine Haeufung in der CI zaehlbar ist
    // (grep -c "NETZFEHLER .* klang:"); die Ausnahme selbst bleibt auf klang/*.mp3 mit genau dieser WebKit-Meldung begrenzt
    seitenfehler.forEach((x, i) => { if (netzSeitenfehler(x, i)) console.log(`NETZFEHLER ${tag} ${klangAbbruch(x, i) ? 'klang' : 'seitenfehler'}: ${x.slice(0, 160)}`); }); // INTENTIONAL-SLOP[T4]: Liste fuer den Bericht
    pruefe(`${tag}: keine ungefangenen Fehler in der Seite`, ungefangen.length === 0, ungefangen.slice(0, 5));
    const unerwartet = seitenfehler.filter((x, i) => !netzSeitenfehler(x, i));
    pruefe(`${tag}: keine Seitenfehler ausser erwarteten Netzfehlern ohne Netz`, unerwartet.length === 0, unerwartet.slice(0, 5));
    await k.close();
  }
} finally {
  await browser.close();
  server.close();
}
console.log(`${ok}/${ok + fehler} bestanden`); // INTENTIONAL-SLOP[T4]: Ausgabeweg
process.exit(fehler ? 1 : 0);
