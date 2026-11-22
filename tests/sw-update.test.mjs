// Service-Worker-Update im Browser (Leistungsmessung 09.11.2026): ein Besucher mit der installierten Fassung bekommt
// eine neue Fassung, ohne dass unveraenderte Dateien neu durchs Netz muessen, und ohne dass eine alte Datei in den
// neuen Cache rutscht.
//   Phase 1: Erstbesuch, die App installiert sw.js aus dem Repo.
//   Phase 2: der Server liefert eine "neue Fassung": sw.js mit VERSION + 1 und js/ui/heim.js mit einer Zusatzzeile.
//            Der Server antwortet wie GitHub Pages mit ETag und 304 auf If-None-Match und zaehlt volle Antworten.
//   Phase 3: die neue Fassung uebernimmt; heim.js muss die neue Zeile haben, die App laeuft.
// Vorher (cache: 'reload') lud jedes Update alle Dateien neu, gemessen 744 Anfragen und 8,3 MB.
// Aufruf: node tests/sw-update.test.mjs
import http from 'node:http';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { browserTyp } from './browser.mjs';
import { begrenzt } from './zeitwaechter.mjs';

const require = createRequire(import.meta.url);
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const warte = (ms) => new Promise((r) => setTimeout(r, ms));
const PROBE = '// sw-update-probe';
const P = 'schach-arena:v1:';

const ergebnisse = [];
function pruefe(name, ok, detail = '') {
  ergebnisse.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'ok  ' : 'FEHLER'} ${name}${!ok && detail ? ' (' + detail + ')' : ''}`);
}

// Spuren fuer die Fehlermeldung: die Zeilen "SW-Ablauf" der App (js/app.js registriereSW) und die Schritte des Tests
const spuren = [];
let letzterSchritt = 'Start';
const merke = (t) => { spuren.push(new Date().toISOString().slice(11, 23) + ' ' + t); if (spuren.length > 200) spuren.shift(); };
const schritt = (t) => { letzterSchritt = t; merke('Schritt: ' + t); };

function ladePlaywright() {
  for (const k of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
    try { return require(k); } catch (e) { /* naechster */ }
  }
  throw new Error('Playwright nicht gefunden (PLAYWRIGHT_PFAD setzen)');
}

const TYPEN = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm', '.json': 'application/json', '.png': 'image/png', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json', '.txt': 'text/plain', '.md': 'text/plain' };
const VERSION = Number(readFileSync(path.join(WURZEL, 'sw.js'), 'utf8').match(/const VERSION = (\d+);/)[1]);
const [DATEIEN_ZAHL, KERN_ZAHL] = (() => {
  const k = { self: { location: new URL('https://example.org/schach/sw.js'), addEventListener() {} }, URL };
  vm.createContext(k);
  vm.runInContext(readFileSync(path.join(WURZEL, 'sw.js'), 'utf8') + '\n;globalThis.__n = [DATEIEN.length, KERN.length];', k);
  return k.__n;
})();

// 0 = Ausgangsfassung, 1 und 2 = die naechsten Fassungen; heim.js sagt der laufenden Seite, aus welcher Fassung ihr Code kommt
let fassung = 0;
let zaehler = { voll: 0, nicht: 0, volleDateien: [] };
async function inhalt(p) {
  let d = await readFile(path.join(WURZEL, p));
  if (fassung && p === '/sw.js') d = Buffer.from(d.toString('utf8').replace(`const VERSION = ${VERSION};`, `const VERSION = ${VERSION + fassung};`));
  if (fassung && p === '/js/ui/heim.js') d = Buffer.concat([d, Buffer.from(`\n${PROBE}\nglobalThis.__swFassung = ${fassung};\n`)]);
  return d;
}
const server = http.createServer(async (q, r) => {
  let p = decodeURIComponent(new URL(q.url, 'http://x').pathname);
  // eine Anfrage, die nicht im Cache liegt, bleibt so lange offen und laeuft dabei durch den alten Worker (Runde 2)
  if (p === '/__halten') { const ms = Number(new URL(q.url, 'http://x').searchParams.get('ms')) || 0; await warte(ms); r.writeHead(200, { 'Content-Type': 'text/plain' }); return r.end('ok'); }
  if (p.endsWith('/')) p += 'index.html';
  let d;
  try { d = await inhalt(p); } catch (e) { r.writeHead(404); return r.end(); }
  const etag = '"' + crypto.createHash('md5').update(d).digest('hex').slice(0, 16) + '"';
  if (q.headers['if-none-match'] === etag) { zaehler.nicht++; r.writeHead(304, { ETag: etag }); return r.end(); }
  zaehler.voll++; zaehler.volleDateien.push(p);
  r.writeHead(200, { 'Content-Type': TYPEN[path.extname(p)] || 'application/octet-stream', ETag: etag, 'Cache-Control': 'max-age=600' });
  r.end(d);
});

// Wechselt der Service Worker, laedt die App von selbst neu (js/app.js registriereSW). Eine Auswertung, die genau
// dann laeuft, bricht mit "Execution context was destroyed" ab: auf die neue Seite warten und wiederholen.
const KONTEXT_WEG = /Execution context was destroyed|Cannot find context|frame was detached|navigation/i;
// page.evaluate hat keine eigene Frist: Antwortete die Seite nicht, hing der Test bis zum Suite-Zeitlimit von 20 Minuten
// (CI 44375911031, 44367424082, 44220110183). Abgelaufen heisst rot, ohne Wiederholung, damit kein App-Fehler verdeckt wird.
const AUSWERTUNG_MS = 20000;
const auswerten = (s, fn, arg) => begrenzt('Seitenauswertung', () => s.evaluate(fn, arg), AUSWERTUNG_MS);
const fristAbgelaufen = (e) => e.message.startsWith('Zeitlimit: Seitenauswertung');
async function werte(s, fn, arg) {
  for (let versuch = 0; ; versuch++) {
    try { return await auswerten(s, fn, arg); } catch (e) {
      if (versuch >= 3 || !KONTEXT_WEG.test(e.message)) throw e;
      await s.waitForLoadState('load').catch(() => {});
      await warte(200);
    }
  }
}
const swVersion = (s) => werte(s, () => new Promise((res) => {
  const c = navigator.serviceWorker.controller;
  if (!c) return res(null);
  navigator.serviceWorker.addEventListener('message', (e) => { if (e.data && e.data.typ === 'version') res(e.data.version); }, { once: true });
  c.postMessage({ typ: 'version' });
  setTimeout(() => res('keine Antwort'), 3000);
}));
const startBereit = (s) => s.waitForFunction(() => !!document.querySelector('.screen.heim, #app > .screen'), null, { timeout: 30000 });

// Wartet auf den Endzustand nach einem Wechsel des Service Workers, statt einmal zu pruefen: die Zielversion steuert
// die Seite, keine Fassung wartet mehr, nur ihr Cache ist uebrig (activate hat den alten geloescht), und die Seite laedt
// nicht mehr neu (zweimal hintereinander dieselbe fertig geladene Seite, performance.timeOrigin).
// Zuletzt gesehene Lage, damit ein Fehlschlag zeigt, woran es hing (CI 44657402343: Runde 2 rot unter Linux-WebKit,
// nur die Versionsnummer im Detail; lokal 3 von 3 gruen)
let letzteLage = null;
async function frischerBlick(s) {
  const f = await s.context().newPage();
  try {
    await f.goto(new URL('/__frischer-blick', s.url()).href).catch(() => {});
    return await begrenzt('Frischer Blick', () => f.evaluate(async () => {
      const r = await navigator.serviceWorker.getRegistration(); return r && r.active ? r.active.state : null;
    }), AUSWERTUNG_MS);
  } catch (e) { return 'fehler: ' + e.message.slice(0, 80); } finally { await f.close().catch(() => {}); }
}
async function warteAufVersion(s, version, ms = 60000) {
  const ende = Date.now() + ms;
  letzteLage = null;
  const soll = JSON.stringify(['schach-arena-v' + version]);
  let zuletzt = null;
  while (Date.now() < ende) {
    let jetzt = null;
    try {
      const v = await swVersion(s);
      const lage = await auswerten(s, async () => {
        const r = await navigator.serviceWorker.getRegistration();
        return { seite: document.readyState === 'complete' ? performance.timeOrigin : null, caches: await caches.keys(),
          ruhig: !!r && !r.waiting && !r.installing && !!r.active && r.active.state === 'activated',
          worker: r ? { installing: r.installing && r.installing.state, waiting: r.waiting && r.waiting.state, active: r.active && r.active.state } : null,
          controller: !!navigator.serviceWorker.controller };
      });
      letzteLage = { version: v, ...lage };
      // WebKit meldet den Schritt activating -> activated nicht an eine Seite, die WAEHREND activating geladen wurde: deren
      // Bild bleibt auf "activating", obwohl activate laengst fertig ist (20.11.2026, Linux-CI 44663587812 und lokal unter
      // Last 2 von 12: activate lief in 12 ms durch, eine frische Seite und ein Neuladen sahen "activated", die alte Seite
      // 60 s lang "activating"). Die App wartet nach dem Neuladen auf keinen dieser Zustaende. Darum bestaetigt dann eine
      // frische Seite (404-Adresse: startet die App nicht und landet nicht im Cache) den Zustand des Workers.
      if (v === version && lage.seite && !lage.ruhig && lage.worker && lage.worker.active === 'activating'
        && !lage.worker.waiting && !lage.worker.installing && JSON.stringify(lage.caches) === soll) {
        lage.frisch = await frischerBlick(s);
        lage.ruhig = lage.frisch === 'activated';
        letzteLage.frisch = lage.frisch;
      }
      if (v === version && lage.seite && lage.ruhig && JSON.stringify(lage.caches) === soll) jetzt = lage.seite;
    } catch (e) { if (fristAbgelaufen(e)) throw e; /* sonst: die Seite laedt gerade neu */ }
    if (jetzt && jetzt === zuletzt) { await startBereit(s).catch(() => {}); return true; }
    zuletzt = jetzt;
    await warte(600);
  }
  return false;
}

async function main() {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  // ?sw: im Testmodus registriert die App den Service Worker nur mit diesem Schalter (js/app.js registriereSW)
  const basis = `http://127.0.0.1:${server.address().port}/index.html?test&sw#heim`;
  const browser = await browserTyp(ladePlaywright()).launch();
  const k = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'de-DE' });
  await k.addInitScript((schl) => { if (!localStorage.getItem(schl)) localStorage.setItem(schl, JSON.stringify({ gesehen: '2026-01-01' })); }, P + 'modul:start');
  const s = await k.newPage();
  const fehler = [];
  // wie tests/e2e.test.mjs: WebKit meldet einen beim Neuladen abgebrochenen Abruf der eigenen Seite (ein Klang, der gerade
  // laedt) als "<Adresse> due to access control checks."; hier gemessen 19.11.2026 in 8 von 10 WebKit-Laeufen, mit und ohne
  // sw.js ohneFrische, nur in den Teilen mit Neuladen. Abrufe anderer Adressen bleiben ein Fehler: die eigene Adresse muss
  // am ANFANG stehen (WebKit schreibt "/127.0.0.1:<port>/..." bzw. mit http:), nicht irgendwo, etwa im Abfrage-Teil.
  const eigenerAbbruch = (m) => new RegExp(`^(https?:/)?/127\\.0\\.0\\.1:${server.address().port}/\\S* due to access control checks\\.?$`).test(m);
  const port = server.address().port;
  pruefe('Ausnahme "access control checks" nur fuer die eigene Adresse am Anfang (fremde Adresse mit der eigenen im Abfrage-Teil bleibt ein Fehler)',
    eigenerAbbruch(`/127.0.0.1:${port}/assets/klang/arcade/combo.mp3 due to access control checks.`)
    && eigenerAbbruch(`http://127.0.0.1:${port}/assets/klang/arcade/combo.mp3 due to access control checks.`)
    && !eigenerAbbruch(`https://fremd.example/x.mp3?von=127.0.0.1:${port}/ due to access control checks.`)
    && !eigenerAbbruch(`/127.0.0.1:${port + 1}/x.mp3 due to access control checks.`));
  s.on('pageerror', (e) => {
    if (eigenerAbbruch(e.message)) return;
    fehler.push(e.message);
  });
  // offene Anfragen der Seite: haengt eine davon im alten Service Worker, wartet die neue Fassung nach skipWaiting
  const offen = new Map();
  s.on('request', (q) => offen.set(q, Date.now()));
  s.on('requestfinished', (q) => offen.delete(q));
  s.on('requestfailed', (q) => offen.delete(q));
  const offeneListe = () => [...offen].map(([q, t]) => `${q.url().replace(/^https?:\/\/[^/]+/, '')} seit ${Date.now() - t} ms`).join(', ') || 'keine';
  s.on('console', (m) => {
    if (m.type() !== 'info' || !/^SW-Ablauf/.test(m.text())) return;
    merke(m.text());
    if (/^SW-Ablauf (aktiviere|neu laden: Notbremse)/.test(m.text())) merke('offene Anfragen: ' + offeneListe());
  });
  let adresse = basis;
  try {
    schritt('Erstbesuch');
    await s.goto(basis); await startBereit(s);
    await auswerten(s, () => navigator.serviceWorker.ready);
    await s.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 30000 });
    pruefe(`Erstbesuch: Version ${VERSION} installiert und steuert die Seite`, await swVersion(s) === VERSION);
    // Seit fc-06:00 (20.11.2026) legt install nur den Kern ab, den Rest holt der Worker danach, angestossen von Anfragen der
    // Seite. Der Fall unten ist ein Spieler, der die App schon ganz hat; ohne diesen Schritt holte der alte Worker seinen Rest
    // genau im Messfenster des Updates voll aus dem Netz
    schritt('Erstbesuch: Nachladen, bis jede Datei im Cache liegt');
    let imCache = 0;
    for (let i = 0; i < 15; i++) {
      imCache = await auswerten(s, async () => {
        let n = 0;
        for (const c of await caches.keys()) n = Math.max(n, (await (await caches.open(c)).keys()).length);
        return n;
      });
      if (imCache >= DATEIEN_ZAHL) break;
      await warte(2000);
      await s.reload(); await startBereit(s);
    }
    pruefe(`Erstbesuch: das Nachladen legt jede Datei ab (${imCache} von ${DATEIEN_ZAHL})`, imCache >= DATEIEN_ZAHL);
    // Ruhe vor dem Umschalten: eine Update-Pruefung des Erstbesuchs, die erst danach kommt, faende schon Fassung 1, die
    // waere beim Neuladen unten bereit und uebernaehme sofort ohne Hinweis (gemessen 20.11.2026: register 16 ms nach dem
    // Umschalten, seit die Installation nur noch den Kern holt und der Erstbesuch Sekunden schneller ist)
    await warte(5000);

    // die neue Fassung liegt online; der Besucher kommt spaeter wieder (SW_MERKER "kuerzlich" = 15 s abwarten)
    schritt('Update: neue Fassung installieren');
    fassung = 1; zaehler = { voll: 0, nicht: 0, volleDateien: [] };
    await warte(16000);
    await s.reload(); await startBereit(s);
    const hinweis = await s.waitForSelector('.update-hinweis', { timeout: 60000 }).then(() => true).catch(() => false);
    pruefe('Update: neue Fassung installiert, der Hinweis "Neu laden" erscheint', hinweis);
    const voll = zaehler.volleDateien.slice().sort();
    pruefe('Update: nur die geänderten Dateien kommen voll (sw.js und js/ui/heim.js), der Rest als 304 aus dem alten Cache',
      // die Installation prueft nur den Kern (ohne heim.js, die kommt voll); den Rest prueft das Nachladen nach der Uebernahme,
      // ebenfalls per 304 aus dem alten Cache (tests/sw-cache.test.mjs, Fall 4)
      JSON.stringify(voll) === JSON.stringify(['/js/ui/heim.js', '/sw.js']) && zaehler.nicht >= KERN_ZAHL - 1,
      JSON.stringify({ voll: voll.slice(0, 12), anzahl: voll.length, nicht: zaehler.nicht, kern: KERN_ZAHL }));

    // naechster Besuch: die wartende Fassung uebernimmt von selbst
    schritt('Uebernahme: auf die neue Fassung warten');
    await warte(16000);
    await s.reload(); await startBereit(s);
    await warteAufVersion(s, VERSION + 1);
    schritt('Uebernahme: Endzustand pruefen');
    const lage = await werte(s, () => navigator.serviceWorker.getRegistration().then(async (r) => ({ caches: await caches.keys(),
      wartet: !!r.waiting, aktiv: r.active && r.active.state, merker: sessionStorage.getItem('schach-arena:sw-wechsel') })));
    pruefe(`Übernahme: Version ${VERSION + 1} steuert die Seite, nur ihr Cache bleibt`, await swVersion(s) === VERSION + 1
      && JSON.stringify(lage.caches) === JSON.stringify([`schach-arena-v${VERSION + 1}`]), JSON.stringify(lage));
    const probe = await werte(s, (x) => fetch('js/ui/heim.js').then((r) => r.text()).then((t) => t.includes(x)), PROBE);
    pruefe('Übernahme: die geänderte Datei kommt in der neuen Fassung aus dem Cache (keine alte Datei im neuen Cache)', probe);
    // nicht nur der Cache, auch der laufende Code: WebKit lud Module beim Neuladen aus dem eigenen Speicher (max-age des
    // Servers) am Worker vorbei, die Seite lief mit heim.js aus Fassung 0 (19.11.2026, sw.js ohneFrische)
    const lauf1 = await werte(s, () => globalThis.__swFassung);
    pruefe('Übernahme: die Seite läuft mit dem Code der neuen Fassung (nicht alter Code unter neuem Worker)', lauf1 === 1, String(lauf1));
    pruefe('Übernahme: die App läuft (Start sichtbar), keine Seitenfehler', await werte(s, () => document.querySelectorAll('#app > .screen').length) > 0 && fehler.length === 0, fehler.join(' | '));

    // Runde 2 (CI 44472043484 und 44367424082): Nach skipWaiting uebernimmt die neue Fassung erst, wenn der alte Worker
    // keine Anfrage mehr offen hat. Haengt eine, laedt die Notbremse neu (im Test nach 3 s statt 30 s, ?swnot). Danach muss
    // die neue Fassung die Seite trotzdem uebernehmen, ohne Neuladen-Schleife, und die Seite laeuft mit ihrem Code.
    schritt('Runde 2: dritte Fassung installieren');
    // gleich neu laden, solange der letzte Wechsel "kuerzlich" ist: die dritte Fassung installiert nur und wartet
    fassung = 2;
    await s.reload(); await startBereit(s);
    pruefe('Runde 2: die dritte Fassung ist installiert, der Hinweis "Neu laden" erscheint',
      await s.waitForSelector('.update-hinweis', { timeout: 60000 }).then(() => true).catch(() => false));
    schritt('Runde 2: Uebernahme mit haengender Anfrage');
    await k.addInitScript(() => {
      if (sessionStorage.getItem('sw-halten')) return;
      sessionStorage.setItem('sw-halten', '1');
      fetch('__halten?ms=12000').catch(() => {});
    });
    await warte(16000);
    let ladungen = 0;
    s.on('load', () => { ladungen++; });
    await s.goto(basis.replace('?test&sw', '?test&sw&swnot=3000')); await startBereit(s);
    const da = await warteAufVersion(s, VERSION + 2);
    schritt('Runde 2: Endzustand pruefen');
    pruefe(`Runde 2: Version ${VERSION + 2} steuert die Seite, nur ihr Cache bleibt`, da, JSON.stringify({ jetzt: await swVersion(s), zuletzt: letzteLage }));
    // Herkunft von js/ui/heim.js, falls die Seite alten Code hat: im Cache der neuen Fassung, ueber den Worker, laut Timing
    const herkunft = () => werte(s, async (v) => {
      const fassungIn = (t) => (t.match(/__swFassung = (\d+)/) || [])[1] || '0';
      const c = await caches.open('schach-arena-v' + v);
      const imCache = await c.match('js/ui/heim.js');
      const ueberSW = await fetch('js/ui/heim.js').then((r) => r.text()).catch((e) => 'Fehler ' + e.message);
      const t = performance.getEntriesByType('resource').filter((e) => e.name.includes('js/ui/heim.js'))
        .map((e) => `${e.deliveryType || '-'}/${e.transferSize}/${e.workerStart > 0 ? 'sw' : 'ohne-sw'}`);
      const nav = performance.getEntriesByType('navigation')[0];
      return JSON.stringify({ cache: imCache ? fassungIn(await imCache.text()) : 'fehlt', ueberSW: fassungIn(ueberSW), timing: t,
        nav: nav && `${nav.type}/${nav.workerStart > 0 ? 'sw' : 'ohne-sw'}`, laeuft: String(globalThis.__swFassung) });
    }, VERSION + 2);
    const fassungJetzt = await werte(s, () => globalThis.__swFassung);
    pruefe('Runde 2: die Seite läuft mit dem Code der neuen Fassung (nicht alter Code unter neuem Worker)',
      fassungJetzt === 2, fassungJetzt === 2 ? '' : await herkunft());
    pruefe('Runde 2: höchstens dreimal geladen (Aufruf, Notbremse, Wechsel), keine Schleife', ladungen <= 3, `${ladungen} Ladungen`);
    pruefe('Runde 2: keine Seitenfehler', fehler.length === 0, fehler.join(' | '));
  } catch (e) {
    pruefe('Ablauf ohne Abbruch', false, e.message.split('\n')[0]);
  } finally {
    adresse = s.url();
    await begrenzt('Browser schliessen', () => browser.close(), AUSWERTUNG_MS).catch((e) => console.log(e.message));
    server.close();
  }
  const gut = ergebnisse.filter((e) => e.ok).length;
  if (gut !== ergebnisse.length || process.env.SW_SPUREN) console.log(`\nLetzter Schritt: ${letzterSchritt}\nSeite: ${adresse}\nSpuren:\n${spuren.join('\n')}`);
  console.log(`\n${gut}/${ergebnisse.length} bestanden`);
  process.exit(gut === ergebnisse.length ? 0 : 1);
}
main();
