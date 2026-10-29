// Notfall-Waechter in index.html (Luecken-Check 7): bricht js/app.js beim Start ab, bleibt der Lade-Screen stehen und
// ein spaeteres Update kaeme nie an. Das Inline-Skript am Ende von index.html zeigt dann eine Tafel mit "Reparieren".
// Ein kleiner Node-Server liefert den Projektordner wie GitHub Pages unter /schach/ aus (Port 8879), dazu einen leeren
// Test-Service-Worker unter /schach/ und unter /andere/ (fremde App auf demselben Ursprung, wie auf github.io).
// Geprueft: normaler Start ohne Tafel; app.js als werfendes Modul (Deutsch, Englisch nach Wahl und nach Geraet);
// Sprache der Tafel gleich der App, auch bei alten gespeicherten Staenden; frueh (3 s) bei 404/Abbruch von app.js oder
// eines importierten Moduls und bei unbehandelter Promise-Ablehnung; app.js haengt ohne Fehler (Wartezeit, ?notfall
// nur mit ?test); Reparieren mit Service Worker, Caches, localStorage, sessionStorage, IndexedDB und Cookie (nur der
// eigene Worker und die eigenen Caches gehen, nichts sonst, ein Doppel-Tipp prueft das Netz nur einmal, der Fokus
// bleibt auf dem Knopf); ohne Netz wird nichts geloescht, ein zweites Enter repariert; "hat nicht geholfen" nach dem
// Neuladen; die Tafel geht, sobald die App doch startet; eine fehlende Schrift loest bei langsamem Start keine Tafel
// aus; ohne Service Worker (iOS-Huelle) und unter file:// nur Neuladen; ohne CSS und dunkel.
//
//   node tests/notfall.test.mjs
//   PORT=9740 node tests/notfall.test.mjs    eigener Port (Standard 8879)
//   BROWSER=webkit node tests/notfall.test.mjs
//
// Playwright: PLAYWRIGHT_PFAD, sonst 'playwright', sonst /opt/node-tools/node_modules/playwright.
import http from 'node:http';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { begrenzt } from './zeitwaechter.mjs';
import { browserTyp } from './browser.mjs';

const require = createRequire(import.meta.url);
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8879);
const PRAEFIX = '/schach/';
const START = `http://127.0.0.1:${PORT}${PRAEFIX}`;
const KURZ = 1200;   // ?test&notfall=<ms>: Wartezeit im Test statt 15 s
const MERKER = 'schach-arena:notfall-repariert';
const DE = {
  satz: 'Crownmate startet gerade nicht wie gewohnt.',
  erklaerung: '„Reparieren“ lädt die App frisch vom Server. Dein Spielstand bleibt erhalten.',
  offline: 'Zum Reparieren braucht es eine Internetverbindung. Es wurde nichts gelöscht.',
  nichtGeholfen: 'Die Reparatur hat nicht geholfen. Schließe die App ganz und versuche es später noch einmal.',
};
// app.js-Ersatz: wirft beim Auswerten (wie ein kaputtes Update) bzw. wird nie fertig (ohne Fehler)
const KAPUTT = "throw new Error('notfall-test: kaputt');\n";
const HAENGT = 'await new Promise(() => {});\n';
// leerer Service Worker: uebernimmt sofort, ohne fetch-Handler (Anfragen gehen am Worker vorbei, page.route greift)
const TEST_SW = "self.addEventListener('install', () => self.skipWaiting());\n"
  + "self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));\n";

// ---------- Server wie GitHub Pages (Unterordner /schach/) ----------
const TYPEN = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.wasm': 'application/wasm',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg',
};
const anfragen = [];          // { methode, pfad, suche }
let headVerzoegerung = 0;     // ms, damit ein Doppel-Tipp waehrend der Netzpruefung kommt
// Netz weg fuer die Netzpruefung: Der Server kappt die Verbindung. page.route allein reicht nicht: Unter WebKit greift
// es bei einer Seite mit Service Worker nicht (Playwright), die Pruefung kaeme dort doch beim Server an.
let netzWeg = false;
const gekappt = [];           // gekappte Netzpruefungen (zaehlen nicht als Anfrage beim Server)
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  let pfad;
  try { pfad = decodeURIComponent(url.pathname); } catch (e) { pfad = url.pathname; }
  if (netzWeg && pfad === PRAEFIX + 'sw.js' && /[?&]notfall=\d+/.test(url.search)) {
    gekappt.push({ methode: req.method });
    return req.socket.destroy();
  }
  anfragen.push({ methode: req.method, pfad, suche: url.search });
  // Connection: close, damit keine Verbindung wiederverwendet wird: Bricht eine wiederverwendete Verbindung ab, wiederholt
  // der Browser die Anfrage sonst womoeglich von selbst, und eine gekappte Netzpruefung zaehlte doppelt
  const sende = (status, typ, inhalt) => {
    res.writeHead(status, { 'Content-Type': typ, 'Content-Length': inhalt.length, 'Cache-Control': 'no-cache', Connection: 'close' });
    res.end(req.method === 'HEAD' ? undefined : inhalt);
  };
  if (pfad === PRAEFIX + 'notfall-test-sw.js' || pfad === '/andere/notfall-test-sw.js') {
    return sende(200, 'text/javascript; charset=utf-8', Buffer.from(TEST_SW));
  }
  if (!pfad.startsWith(PRAEFIX)) return sende(404, 'text/plain; charset=utf-8', Buffer.from('Nicht gefunden'));
  let rel = pfad.slice(PRAEFIX.length);
  if (rel === '' || rel.endsWith('/')) rel += 'index.html';
  const datei = path.resolve(WURZEL, rel);
  if (!datei.startsWith(WURZEL + path.sep)) return sende(403, 'text/plain; charset=utf-8', Buffer.from('Nein'));
  let st;
  try { st = statSync(datei); } catch (e) { return sende(404, 'text/plain; charset=utf-8', Buffer.from('Nicht gefunden')); }
  if (!st.isFile()) return sende(404, 'text/plain; charset=utf-8', Buffer.from('Nicht gefunden'));
  const typ = TYPEN[path.extname(datei).toLowerCase()] || 'application/octet-stream';
  const inhalt = readFileSync(datei);
  if (req.method === 'HEAD' && headVerzoegerung) setTimeout(() => sende(200, typ, inhalt), headVerzoegerung);
  else sende(200, typ, inhalt);
});
const netzPruefungen = () => anfragen.filter((a) => a.pfad === PRAEFIX + 'sw.js' && /[?&]notfall=\d+/.test(a.suche));

// ---------- Hilfen ----------
function ladePlaywright() {
  const kandidaten = [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean);
  for (const k of kandidaten) {
    try { return require(k); } catch (e) { /* naechster */ }
  }
  throw new Error('Playwright nicht gefunden (PLAYWRIGHT_PFAD setzen)');
}

const ergebnisse = [];
let gruppe = '';
function pruefe(name, ok, detail = '') {
  ergebnisse.push({ name: (gruppe ? gruppe + ': ' : '') + name, ok: !!ok, detail });
  console.log(`${ok ? 'ok  ' : 'FEHLER'} ${gruppe ? gruppe + ': ' : ''}${name}${!ok && detail ? ' (' + detail + ')' : ''}`);
}
const warte = (ms) => new Promise((r) => setTimeout(r, ms));
const nurAbsicht = (fehler) => fehler.every((f) => /notfall-test: kaputt/.test(f));

async function neueSeite(browser, { locale = 'de-DE', schema = 'light', init = null, initArg } = {}) {
  const kontext = await browser.newContext({ viewport: { width: 1024, height: 768 }, deviceScaleFactor: 1, locale, colorScheme: schema });
  kontext.setDefaultTimeout(20000);
  kontext.setDefaultNavigationTimeout(20000);
  const seite = await kontext.newPage();
  const seitenfehler = [];
  const konsole = [];
  seite.on('pageerror', (e) => seitenfehler.push(e.message));
  seite.on('console', (m) => { if (m.type() === 'error') konsole.push(m.text()); });
  // merkt, ob die Tafel je erschienen ist (auch nur kurz)
  await seite.addInitScript(() => {
    new MutationObserver(() => { if (document.getElementById('notfall')) window.__notfallGesehen = true; })
      .observe(document, { childList: true, subtree: true });
  });
  if (init) await seite.addInitScript(init, initArg);
  return { kontext, seite, seitenfehler, konsole };
}
const ersetzeApp = (seite, body) => seite.route('**/js/app.js', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body }));

// Zustand der Tafel (null = keine)
const tafel = (seite) => seite.evaluate(() => {
  const t = document.getElementById('notfall');
  if (!t) return null;
  const k = t.querySelector('button');
  const satz = document.getElementById(t.getAttribute('aria-labelledby') || '');
  const erkl = document.getElementById(t.getAttribute('aria-describedby') || '');
  const hinweis = t.querySelector('[role="status"]');
  const r = t.getBoundingClientRect();
  const kb = k.getBoundingClientRect();
  const cs = getComputedStyle(t);
  return {
    rolle: t.getAttribute('role'), modal: t.getAttribute('aria-modal'), lang: t.getAttribute('lang'), zustand: t.dataset.zustand,
    satz: satz ? satz.textContent : null, erklaerung: erkl ? erkl.textContent : null, knopf: k.textContent,
    knopfAus: k.disabled || k.getAttribute('aria-disabled') === 'true',
    knoepfe: t.querySelectorAll('button').length, hinweis: hinweis ? hinweis.textContent : null, fokus: document.activeElement === k,
    deckt: r.left <= 0 && r.top <= 0 && r.right >= innerWidth && r.bottom >= innerHeight && cs.position === 'fixed',
    knopfHoch: Math.round(kb.height), knopfBreit: Math.round(kb.width), lade: !!document.querySelector('#app > .lade-screen'),
    grund: cs.backgroundColor, farbe: cs.color, knopfGrund: getComputedStyle(k).backgroundColor,
  };
});
const warteAufTafel = (seite, ms = 10000) => seite.waitForSelector('#notfall', { timeout: ms }).then(() => true, () => false);
const helligkeit = (rgb) => {
  const m = String(rgb).match(/[\d.]+/g);
  if (!m) return -1;
  const [r, g, b] = m.slice(0, 3).map((x) => { const c = Number(x) / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

// Service Worker unter /schach/ und /andere/, Caches mit und ohne Praefix, Spielstand an allen Orten
const richteEin = (seite) => seite.evaluate(async () => {
  const sw = navigator.serviceWorker;
  await sw.register('notfall-test-sw.js');
  const andere = await sw.register('/andere/notfall-test-sw.js', { scope: '/andere/' });
  await sw.ready;
  for (let i = 0; i < 100 && !andere.active; i++) await new Promise((r) => setTimeout(r, 50));
  for (let i = 0; i < 100 && !sw.controller; i++) await new Promise((r) => setTimeout(r, 50));
  await (await caches.open('schach-arena-test')).put('probe', new Response('alt'));
  await (await caches.open('schach-arena-v1')).put('probe', new Response('alt'));
  await (await caches.open('anderes-projekt-v1')).put('probe', new Response('fremd'));
  localStorage.setItem('schach-arena:v1:fortschritt', '{"probe":1}');
  localStorage.setItem('schach-arena:v1:partien', '[{"id":"p1"}]');
  localStorage.setItem('anderes-projekt', 'bleibt');
  sessionStorage.setItem('schach-arena:v1:probe', 'bleibt');
  document.cookie = 'notfall-probe=bleibt; path=/';
  await new Promise((fertig, fehler) => {
    const r = indexedDB.open('notfall-probe', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('s');
    r.onerror = () => fehler(r.error);
    r.onsuccess = () => {
      const db = r.result;
      const tx = db.transaction('s', 'readwrite');
      tx.objectStore('s').put({ partien: 3 }, 'stand');
      tx.oncomplete = () => { db.close(); fertig(); };
      tx.onerror = () => fehler(tx.error);
    };
  });
  return { gesteuert: !!sw.controller, andere: !!andere.active };
});
const bestand = (seite) => seite.evaluate(async () => {
  const regs = navigator.serviceWorker ? (await navigator.serviceWorker.getRegistrations()).map((r) => new URL(r.scope).pathname).sort() : null;
  const namen = typeof caches !== 'undefined' ? (await caches.keys()).sort() : null;
  const lokal = {};
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); lokal[k] = localStorage.getItem(k); }
  const sitzung = {};
  for (let i = 0; i < sessionStorage.length; i++) { const k = sessionStorage.key(i); sitzung[k] = sessionStorage.getItem(k); }
  const idb = await new Promise((fertig) => {
    const r = indexedDB.open('notfall-probe', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('s');
    r.onerror = () => fertig(null);
    r.onsuccess = () => {
      const db = r.result;
      const g = db.transaction('s').objectStore('s').get('stand');
      g.onsuccess = () => { db.close(); fertig(g.result === undefined ? null : g.result); };
      g.onerror = () => { db.close(); fertig(null); };
    };
  });
  return { regs, namen, lokal, sitzung, idb, keks: document.cookie };
});

// Klick (oder andere Handlung), danach auf das Neuladen warten; true, wenn wirklich neu geladen wurde
async function mitNeuladen(seite, handlung) {
  await seite.evaluate(() => { window.__vorher = 1; });
  const geladen = seite.waitForEvent('load', { timeout: 15000 });
  await handlung();
  await geladen;
  return seite.evaluate(() => window.__vorher === undefined);
}

// ---------- Teile ----------
async function testeNormalerStart(browser) {
  gruppe = 'Normaler Start';
  const { kontext, seite, seitenfehler, konsole } = await neueSeite(browser);
  await seite.goto(`${START}?test&notfall=${KURZ}#arena`);
  await seite.waitForSelector('.screen.arena .knoten', { timeout: 20000 });
  await warte(KURZ + 1500);
  const r = await seite.evaluate((m) => ({ jetzt: !!document.getElementById('notfall'), je: !!window.__notfallGesehen,
    lade: !!document.querySelector('#app > .lade-screen'), merker: sessionStorage.getItem(m) }), MERKER);
  pruefe('App startet, Lade-Screen weg', !r.lade);
  pruefe(`keine Tafel, auch nicht kurz (Wartezeit ${KURZ} ms abgelaufen)`, !r.jetzt && !r.je, JSON.stringify(r));
  pruefe('kein Merker, keine Seitenfehler, keine Konsolenfehler', r.merker === null && seitenfehler.length === 0 && konsole.length === 0,
    [...seitenfehler, ...konsole].join(' | '));
  await kontext.close();
}

async function testeKaputt(browser) {
  gruppe = 'app.js wirft (Deutsch)';
  {
    const { kontext, seite, seitenfehler } = await neueSeite(browser);
    await ersetzeApp(seite, KAPUTT);
    const t0 = Date.now();
    // ohne ?notfall: nach einem Skriptfehler 3 s statt 15 s
    await seite.goto(`${START}?test`);
    const da = await warteAufTafel(seite, 12000);
    const ms = Date.now() - t0;
    pruefe(`Tafel erscheint nach dem Fehler frueh (nach ${ms} ms, erwartet 3 bis 12 s statt 15 s)`, da && ms >= 2500 && ms < 12000, String(ms));
    const t = await tafel(seite);
    pruefe('alertdialog, aria-modal, lang de, Zustand bereit', t && t.rolle === 'alertdialog' && t.modal === 'true' && t.lang === 'de' && t.zustand === 'bereit', JSON.stringify(t));
    pruefe('ein Satz, ein Knopf "Reparieren", eine Zeile zur Erklaerung (Spielstand bleibt)', t && t.satz === DE.satz && t.knopf === 'Reparieren'
      && t.knoepfe === 1 && t.erklaerung === DE.erklaerung, JSON.stringify(t));
    pruefe('Knopf hat den Fokus, ist gross genug (mind. 44 px) und frei', t && t.fokus && t.knopfHoch >= 44 && !t.knopfAus && t.hinweis === '', JSON.stringify(t));
    pruefe('Tafel deckt den ganzen Bildschirm, der Lade-Screen steht noch', t && t.deckt && t.lade, JSON.stringify(t));
    pruefe('nur der absichtliche Fehler, keiner aus dem Waechter', seitenfehler.length >= 1 && nurAbsicht(seitenfehler), seitenfehler.join(' | '));
    await kontext.close();
  }
  gruppe = 'app.js wirft (Englisch)';
  {
    // gespeicherte Wahl (Einstellungen) gilt wie in der App
    const { kontext, seite } = await neueSeite(browser, {
      init: () => localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ sprache: 'en', spracheGewaehlt: true })),
    });
    await ersetzeApp(seite, KAPUTT);
    await seite.goto(`${START}?test&notfall=${KURZ}`);
    const t = await warteAufTafel(seite) && await tafel(seite);
    pruefe('gewaehlte Sprache Englisch: "Repair", lang en', t && t.lang === 'en' && t.knopf === 'Repair' && t.satz === 'Crownmate is not starting as expected.'
      && t.erklaerung === '“Repair” reloads the app fresh from the server. Your progress is kept.', JSON.stringify(t));
    await kontext.close();
  }
  {
    // ohne Wahl die Sprache des Geraets (?autosprache, sonst bleiben Testlaeufe deutsch wie in der App)
    const { kontext, seite } = await neueSeite(browser, { locale: 'en-US' });
    await ersetzeApp(seite, KAPUTT);
    await seite.goto(`${START}?test&autosprache&notfall=${KURZ}`);
    const t = await warteAufTafel(seite) && await tafel(seite);
    pruefe('englisches Geraet ohne Wahl: Englisch', t && t.lang === 'en' && t.knopf === 'Repair', JSON.stringify(t));
    await seite.goto(`${START}?test&notfall=${KURZ}`);
    const t2 = await warteAufTafel(seite) && await tafel(seite);
    pruefe('englisches Geraet im Testlauf ohne ?autosprache: Deutsch (wie js/app.js)', t2 && t2.lang === 'de' && t2.knopf === 'Reparieren', JSON.stringify(t2));
    await kontext.close();
  }
  {
    const { kontext, seite } = await neueSeite(browser, { locale: 'de-AT' });
    await ersetzeApp(seite, KAPUTT);
    await seite.goto(`${START}?test&autosprache&sprache=en&notfall=${KURZ}`);
    const t = await warteAufTafel(seite) && await tafel(seite);
    pruefe('?sprache=en schlaegt das deutsche Geraet', t && t.lang === 'en' && t.knopf === 'Repair', JSON.stringify(t));
    await kontext.close();
  }
}

// Die Sprache der Tafel muss genau der Sprache der App folgen, auch bei alten gespeicherten Staenden (js/storage.js
// ladeEinstellungen): je Fall einmal die echte App (<html lang>), einmal die Tafel mit kaputter app.js
async function testeSpracheWieApp(browser) {
  gruppe = 'Sprache wie die App';
  const faelle = [
    { name: 'alter Stand {sprache:en} ohne spracheGewaehlt (vor dem 24.10.), deutsches Geraet', locale: 'de-DE', e: { sprache: 'en' }, soll: 'en' },
    { name: 'alter Stand {sprache:de} ohne spracheGewaehlt, englisches Geraet', locale: 'en-US', e: { sprache: 'de' }, soll: 'en' },
    { name: 'spracheGewaehlt:false mit en, deutsches Geraet', locale: 'de-DE', e: { sprache: 'en', spracheGewaehlt: false }, soll: 'de' },
    { name: 'gewaehlt, aber unbekannte Sprache, englisches Geraet', locale: 'en-US', e: { sprache: 'fr', spracheGewaehlt: true }, soll: 'de' },
  ];
  for (const f of faelle) {
    const { kontext, seite } = await neueSeite(browser, {
      locale: f.locale, init: (e) => localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify(e)), initArg: f.e,
    });
    await seite.goto(`${START}?test&autosprache`);
    const app = await seite.waitForFunction(() => !document.querySelector('#app > .lade-screen'), null, { timeout: 20000 })
      .then(() => seite.evaluate(() => document.documentElement.lang), () => null);
    await ersetzeApp(seite, KAPUTT);
    await seite.goto(`${START}?test&autosprache&notfall=${KURZ}`);
    const t = await warteAufTafel(seite) && await tafel(seite);
    pruefe(`${f.name}: App und Tafel ${f.soll}`, app === f.soll && t && t.lang === f.soll && t.knopf === (f.soll === 'en' ? 'Repair' : 'Reparieren'),
      JSON.stringify({ app, tafel: t && t.lang }));
    await kontext.close();
  }
}

// Laedt ein Skript nicht (404, Abbruch, auch ein importiertes Modul) oder endet der Start in einer unbehandelten
// Promise-Ablehnung, kommt die Tafel 3 s danach, nicht erst nach der vollen Wartezeit. LANG trennt frueh und spaet.
const LANG = 10000;
async function testeFrueh(browser) {
  gruppe = 'Frueh erkannt';
  const faelle = [
    { name: 'app.js 404', route: (s) => s.route('**/js/app.js', (r) => r.fulfill({ status: 404, contentType: 'text/plain', body: 'Nicht gefunden' })) },
    { name: 'app.js bricht ab', route: (s) => s.route('**/js/app.js', (r) => r.abort('failed')) },
    { name: 'importiertes Modul js/sprache.js 404', route: (s) => s.route('**/js/sprache.js', (r) => r.fulfill({ status: 404, contentType: 'text/plain', body: 'Nicht gefunden' })) },
    { name: 'unbehandelte Promise-Ablehnung', route: (s) => ersetzeApp(s, "Promise.resolve().then(() => { throw new Error('notfall-test: kaputt'); });\n"), ablehnung: true },
  ];
  for (const f of faelle) {
    const { kontext, seite, seitenfehler } = await neueSeite(browser);
    await f.route(seite);
    const t0 = Date.now();
    await seite.goto(`${START}?test&notfall=${LANG}`);
    const da = await warteAufTafel(seite, LANG + 3000);
    const ms = Date.now() - t0;
    pruefe(`${f.name}: Tafel frueh (nach ${ms} ms, erwartet 2,5 bis 6 s statt ${LANG / 1000} s)`, da && ms >= 2500 && ms < 6000, String(ms));
    const t = da && await tafel(seite);
    pruefe(`${f.name}: Tafel bereit, Lade-Screen steht`, t && t.zustand === 'bereit' && t.lade && t.knopf === 'Reparieren', JSON.stringify(t));
    // ein Ladefehler ist kein Seitenfehler; bei der Ablehnung nur der absichtliche
    pruefe(`${f.name}: kein Seitenfehler aus dem Waechter`, f.ablehnung ? nurAbsicht(seitenfehler) : seitenfehler.length === 0, seitenfehler.join(' | '));
    await kontext.close();
  }
}

async function testeHaengt(browser) {
  gruppe = 'app.js haengt ohne Fehler';
  const { kontext, seite, seitenfehler } = await neueSeite(browser);
  await ersetzeApp(seite, HAENGT);
  // ?notfall ohne ?test gilt nicht: die Wartezeit bleibt 15 s
  await seite.goto(`${START}?notfall=300`);
  await warte(2500);
  const ohne = await seite.evaluate(() => ({ je: !!window.__notfallGesehen, lade: !!document.querySelector('#app > .lade-screen') }));
  pruefe('?notfall ohne ?test wird ignoriert (nach 2,5 s keine Tafel, Lade-Screen steht)', !ohne.je && ohne.lade, JSON.stringify(ohne));
  const t0 = Date.now();
  await seite.goto(`${START}?test&notfall=${KURZ}`);
  const da = await warteAufTafel(seite, 8000);
  const ms = Date.now() - t0;
  pruefe(`mit ?test&notfall=${KURZ}: Tafel nach der Wartezeit (nach ${ms} ms)`, da && ms >= KURZ - 200 && ms < KURZ + 5000, String(ms));
  pruefe('keine Seitenfehler', seitenfehler.length === 0, seitenfehler.join(' | '));
  await kontext.close();
}

async function testeReparieren(browser) {
  gruppe = 'Reparieren';
  const { kontext, seite, seitenfehler } = await neueSeite(browser);
  await ersetzeApp(seite, KAPUTT);
  await seite.goto(`${START}?test&notfall=${KURZ}`);
  const ein = await richteEin(seite);
  pruefe('Vorbereitung: Test-Worker steuert die Seite, fremder Worker unter /andere/ aktiv', ein.gesteuert && ein.andere, JSON.stringify(ein));
  const vorher = await bestand(seite);
  pruefe('Vorbereitung: zwei Worker, drei Caches', JSON.stringify(vorher.regs) === JSON.stringify(['/andere/', '/schach/'])
    && JSON.stringify(vorher.namen) === JSON.stringify(['anderes-projekt-v1', 'schach-arena-test', 'schach-arena-v1']), JSON.stringify(vorher));
  pruefe('Tafel erscheint', await warteAufTafel(seite));
  const anzahl = netzPruefungen().length;
  headVerzoegerung = 400;
  let zwischen = null;
  const neu = await mitNeuladen(seite, async () => {
    // zweimal hintereinander (Doppel-Tipp): die Reparatur laeuft nur einmal
    zwischen = await seite.evaluate(() => {
      const k = document.querySelector('#notfall button');
      k.click();
      k.click();
      k.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      const t = document.getElementById('notfall');
      return { aus: k.getAttribute('aria-disabled') === 'true', fokus: document.activeElement === k, zustand: t.dataset.zustand,
        hinweis: t.querySelector('[role="status"]').textContent };
    });
  });
  headVerzoegerung = 0;
  pruefe('waehrend der Reparatur: Knopf gesperrt (aria-disabled), Fokus bleibt darauf, "Einen Moment …"', zwischen && zwischen.aus
    && zwischen.fokus && zwischen.zustand === 'arbeitet' && zwischen.hinweis === 'Einen Moment …', JSON.stringify(zwischen));
  pruefe('Seite wurde neu geladen', neu);
  const pruefungen = netzPruefungen().slice(anzahl);
  pruefe('Netz genau einmal geprueft: HEAD auf sw.js (am Cache des Workers vorbei)', pruefungen.length === 1 && pruefungen[0].methode === 'HEAD',
    JSON.stringify(pruefungen));
  const nachher = await bestand(seite);
  pruefe('eigener Service Worker abgemeldet, der fremde unter /andere/ bleibt', JSON.stringify(nachher.regs) === JSON.stringify(['/andere/']), JSON.stringify(nachher.regs));
  pruefe('nur die Caches mit schach-arena- geloescht', JSON.stringify(nachher.namen) === JSON.stringify(['anderes-projekt-v1']), JSON.stringify(nachher.namen));
  pruefe('localStorage unveraendert', JSON.stringify(nachher.lokal) === JSON.stringify(vorher.lokal), JSON.stringify(nachher.lokal));
  pruefe('sessionStorage des Spiels bleibt, Merker gesetzt', nachher.sitzung['schach-arena:v1:probe'] === 'bleibt'
    && Number(nachher.sitzung[MERKER]) > Date.now() - 60000, JSON.stringify(nachher.sitzung));
  pruefe('IndexedDB und Cookie unveraendert', nachher.idb && nachher.idb.partien === 3 && /notfall-probe=bleibt/.test(nachher.keks), JSON.stringify(nachher));
  // app.js ist immer noch kaputt: nach dem Neuladen sagt die Tafel, dass es nicht geholfen hat
  const da = await warteAufTafel(seite);
  const t = da && await tafel(seite);
  pruefe('danach weiter kaputt: "hat nicht geholfen", App ganz schliessen, spaeter noch einmal', t && t.zustand === 'nicht-geholfen'
    && t.satz === DE.nichtGeholfen && t.knopf === 'Reparieren' && t.erklaerung === DE.erklaerung, JSON.stringify(t));
  await warte(KURZ + 500);
  pruefe('keine automatische Reparatur (kein weiteres Neuladen, keine weitere Netzpruefung)',
    netzPruefungen().length === anzahl + 1 && await seite.evaluate(() => !!document.getElementById('notfall')), String(netzPruefungen().length - anzahl));
  pruefe('nur der absichtliche Fehler', nurAbsicht(seitenfehler), seitenfehler.join(' | '));
  await kontext.close();
}

async function testeOffline(browser) {
  gruppe = 'Ohne Netz';
  const { kontext, seite, seitenfehler } = await neueSeite(browser);
  await ersetzeApp(seite, KAPUTT);
  await seite.goto(`${START}?test&notfall=${KURZ}`);
  await richteEin(seite);
  const vorher = await bestand(seite);
  await warteAufTafel(seite);
  const anzahl = netzPruefungen().length;
  const gekapptVorher = gekappt.length;
  let abgefangen = 0;
  // Chromium: page.route bricht die Pruefung im Browser ab; WebKit: dort kommt sie am Service Worker vorbei beim
  // Server an, und der kappt die Verbindung (netzWeg). Beides ist fuer die Seite ein Netzfehler.
  netzWeg = true;
  await seite.route(/\/sw\.js\?notfall=\d+/, (r) => { abgefangen++; return r.abort('internetdisconnected'); });
  await seite.evaluate(() => { window.__vorher = 1; });
  // per Tastatur wie auf dem iPad mit Tastatur: Enter auf dem Knopf, der beim Erscheinen den Fokus bekommt
  const vorFokus = await tafel(seite);
  pruefe('Knopf hat vor dem ersten Enter den Fokus', vorFokus && vorFokus.fokus, JSON.stringify(vorFokus));
  await seite.keyboard.press('Enter');
  await seite.waitForFunction(() => document.getElementById('notfall').dataset.zustand !== 'arbeitet', null, { timeout: 15000 });
  const t = await tafel(seite);
  pruefe('Netzpruefung scheitert: Hinweis, nichts geloescht gemeldet', t && t.zustand === 'offline' && t.hinweis === DE.offline, JSON.stringify(t));
  pruefe('Knopf wieder frei, kein Neuladen', t && !t.knopfAus && await seite.evaluate(() => window.__vorher === 1), JSON.stringify(t));
  pruefe('Fokus bleibt auf "Reparieren" (nicht auf body)', t && t.fokus,
    await seite.evaluate(() => document.activeElement && document.activeElement.tagName));
  const kappt = gekappt.length - gekapptVorher;
  pruefe('die Pruefung lief genau einmal und scheiterte am Netz (nie beim Server beantwortet)',
    abgefangen + kappt === 1 && netzPruefungen().length === anzahl, `abgefangen ${abgefangen}, gekappt ${kappt}, beantwortet ${netzPruefungen().length - anzahl}`);
  const nachher = await bestand(seite);
  pruefe('Service Worker, Caches, Speicher unveraendert, kein Merker', JSON.stringify(nachher.regs) === JSON.stringify(vorher.regs)
    && JSON.stringify(nachher.namen) === JSON.stringify(vorher.namen) && JSON.stringify(nachher.lokal) === JSON.stringify(vorher.lokal)
    && !(MERKER in nachher.sitzung), JSON.stringify(nachher));
  // wieder online: ein zweites Enter (ohne Tab zurueck) repariert
  await seite.unroute(/\/sw\.js\?notfall=\d+/);
  netzWeg = false;
  const neu = await mitNeuladen(seite, () => seite.keyboard.press('Enter')).catch(() => false);
  const danach = await bestand(seite);
  pruefe('wieder online: zweites Enter repariert (neu geladen, eigene Caches weg)', neu && JSON.stringify(danach.namen) === JSON.stringify(['anderes-projekt-v1']),
    JSON.stringify(danach.namen));
  pruefe('nur der absichtliche Fehler', nurAbsicht(seitenfehler), seitenfehler.join(' | '));
  await kontext.close();
}

async function testeMerker(browser) {
  gruppe = 'Merker';
  {
    const { kontext, seite } = await neueSeite(browser, { init: (m) => sessionStorage.setItem(m, String(Date.now() - 1000)), initArg: MERKER });
    await ersetzeApp(seite, KAPUTT);
    await seite.goto(`${START}?test&notfall=${KURZ}`);
    const t = await warteAufTafel(seite) && await tafel(seite);
    pruefe('frischer Merker: "hat nicht geholfen"', t && t.zustand === 'nicht-geholfen' && t.satz === DE.nichtGeholfen, JSON.stringify(t));
    await kontext.close();
  }
  {
    const { kontext, seite } = await neueSeite(browser, { init: (m) => sessionStorage.setItem(m, String(Date.now() - 11 * 60000)), initArg: MERKER });
    await ersetzeApp(seite, KAPUTT);
    await seite.goto(`${START}?test&notfall=${KURZ}`);
    const t = await warteAufTafel(seite) && await tafel(seite);
    const merker = await seite.evaluate((m) => sessionStorage.getItem(m), MERKER);
    pruefe('alter Merker (11 Minuten): wieder die normale Tafel, Merker weg', t && t.zustand === 'bereit' && t.satz === DE.satz && merker === null,
      JSON.stringify({ t, merker }));
    await kontext.close();
  }
  {
    // App startet nach einer Reparatur wieder: Merker weg, keine Tafel
    const { kontext, seite, seitenfehler } = await neueSeite(browser, { init: (m) => sessionStorage.setItem(m, String(Date.now() - 1000)), initArg: MERKER });
    await seite.goto(`${START}?test&notfall=${KURZ}#arena`);
    await seite.waitForSelector('.screen.arena .knoten', { timeout: 20000 });
    const r = await seite.evaluate((m) => ({ merker: sessionStorage.getItem(m), je: !!window.__notfallGesehen }), MERKER);
    pruefe('App laeuft nach der Reparatur: Merker geloest, keine Tafel', r.merker === null && !r.je, JSON.stringify(r));
    pruefe('keine Seitenfehler', seitenfehler.length === 0, seitenfehler.join(' | '));
    await kontext.close();
  }
}

async function testeSpaeterStart(browser) {
  gruppe = 'App startet spaeter';
  const { kontext, seite, seitenfehler } = await neueSeite(browser);
  // die echte app.js kommt erst nach der Wartezeit (langsames Netz)
  await seite.route('**/js/app.js', async (r) => { await warte(KURZ + 1800); await r.continue(); });
  await seite.goto(`${START}?test&notfall=${KURZ}#arena`, { waitUntil: 'commit' });
  const da = await warteAufTafel(seite, 8000);
  pruefe('Tafel erscheint, solange die App noch laedt', da);
  await seite.waitForSelector('.screen.arena .knoten', { timeout: 20000 });
  const r = await seite.evaluate(() => ({ tafel: !!document.getElementById('notfall'), lade: !!document.querySelector('#app > .lade-screen') }));
  pruefe('App laeuft: Tafel verschwindet von selbst', !r.tafel && !r.lade, JSON.stringify(r));
  await warte(500);
  pruefe('Tafel bleibt weg, keine Seitenfehler', !(await seite.evaluate(() => !!document.getElementById('notfall'))) && seitenfehler.length === 0,
    seitenfehler.join(' | '));
  await kontext.close();
}

// Eine fehlende Schrift (Preload-<link>, Fehler im Capture sichtbar) ist kein Startfehler: Bei einem gesunden, aber
// langsamen Start darf die Tafel nicht frueh aufblitzen. Die Schrift fehlt nach 1,5 s, app.js kommt nach 6 s; zaehlte
// der Fehler, stuende die Tafel ab etwa 4,5 s bis zum Start. Die Wartezeit (20 s) liegt weit hinter dem Start.
async function testeAssetFehler(browser) {
  gruppe = 'Fehlende Schrift, langsamer Start';
  const { kontext, seite, seitenfehler } = await neueSeite(browser, {
    init: () => {
      window.__linkFehler = 0;
      addEventListener('error', (e) => { if (e.target && e.target.tagName === 'LINK') window.__linkFehler++; }, true);
    },
  });
  let schrift = 0;
  await seite.route('**/assets/schriften/manrope.woff2', async (r) => {
    schrift++;
    await warte(1500);
    await r.fulfill({ status: 404, contentType: 'text/plain', body: 'Nicht gefunden' });
  });
  await seite.route('**/js/app.js', async (r) => { await warte(6000); await r.continue(); });
  await seite.goto(`${START}?test&notfall=20000#arena`, { waitUntil: 'commit' });
  await seite.waitForSelector('.screen.arena .knoten', { timeout: 25000 });
  const r = await seite.evaluate(() => ({ je: !!window.__notfallGesehen, linkFehler: window.__linkFehler,
    lade: !!document.querySelector('#app > .lade-screen') }));
  pruefe('die Schrift fehlte wirklich (Fehler am <link> vor dem Start)', schrift >= 1 && r.linkFehler >= 1, JSON.stringify({ schrift, ...r }));
  pruefe('App startet, keine Tafel, auch nicht kurz', !r.lade && !r.je, JSON.stringify(r));
  pruefe('keine Seitenfehler', seitenfehler.length === 0, seitenfehler.join(' | '));
  await kontext.close();
}

async function testeOhneServiceWorker(browser) {
  gruppe = 'Ohne Service Worker (iOS-Huelle)';
  {
    const { kontext, seite, seitenfehler } = await neueSeite(browser, {
      init: () => { Object.defineProperty(navigator, 'serviceWorker', { value: undefined, configurable: true }); },
    });
    await ersetzeApp(seite, KAPUTT);
    await seite.goto(`${START}?test&notfall=${KURZ}`);
    pruefe('Tafel erscheint', await warteAufTafel(seite));
    const anzahl = netzPruefungen().length;
    const neu = await mitNeuladen(seite, () => seite.click('#notfall button'));
    pruefe('Reparieren laedt nur neu (keine Netzpruefung, nichts zum Abmelden)', neu && netzPruefungen().length === anzahl, String(netzPruefungen().length - anzahl));
    const t = await warteAufTafel(seite) && await tafel(seite);
    pruefe('danach "hat nicht geholfen"', t && t.zustand === 'nicht-geholfen', JSON.stringify(t));
    pruefe('kein Absturz des Waechters', nurAbsicht(seitenfehler), seitenfehler.join(' | '));
    await kontext.close();
  }
  gruppe = 'file://';
  {
    const { kontext, seite, seitenfehler } = await neueSeite(browser);
    const adresse = pathToFileURL(path.join(WURZEL, 'index.html')).href + `?test&notfall=${KURZ}`;
    await seite.goto(adresse);
    // Chromium laedt Module unter file:// nicht (Ursprung null): die App bleibt auf dem Lade-Screen
    const was = await seite.waitForFunction(() => (document.getElementById('notfall') ? 'tafel'
      : document.querySelector('#app > .screen:not(.lade-screen)') ? 'app' : null), null, { timeout: 12000 }).then((h) => h.jsonValue(), () => null);
    if (was === 'tafel') {
      const neu = await mitNeuladen(seite, () => seite.click('#notfall button'));
      pruefe('Tafel erscheint, Reparieren laedt nur neu', neu && await warteAufTafel(seite));
    } else pruefe('App startet unter file:// selbst, dann keine Tafel', was === 'app' && !(await seite.evaluate(() => !!window.__notfallGesehen)), String(was));
    pruefe('kein Seitenfehler aus dem Waechter', seitenfehler.length === 0, seitenfehler.join(' | '));
    await kontext.close();
  }
}

async function testeOhneCss(browser) {
  gruppe = 'Ohne CSS';
  {
    const { kontext, seite } = await neueSeite(browser, { schema: 'dark' });
    await seite.route('**/*.css', (r) => r.abort());
    await ersetzeApp(seite, KAPUTT);
    await seite.goto(`${START}?test&notfall=${KURZ}`);
    const t = await warteAufTafel(seite) && await tafel(seite);
    pruefe('Tafel steht auch ohne CSS: ganzer Bildschirm, Knopf mind. 44 px', t && t.deckt && t.knopfHoch >= 44 && t.knopfBreit >= 120, JSON.stringify(t));
    pruefe('dunkles Geraet: dunkler Grund, heller Text, Knopf hell (Systemfarben)', t && helligkeit(t.grund) < 0.1 && helligkeit(t.farbe) > 0.6
      && helligkeit(t.knopfGrund) > 0.6, JSON.stringify(t && [t.grund, t.farbe, t.knopfGrund]));
    await kontext.close();
  }
  {
    // gespeichert "hell" auf dunklem Geraet: die Tafel folgt der Wahl wie die App
    const { kontext, seite } = await neueSeite(browser, {
      schema: 'dark', init: () => localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ modus: 'hell' })),
    });
    await ersetzeApp(seite, KAPUTT);
    await seite.goto(`${START}?test&notfall=${KURZ}`);
    const t = await warteAufTafel(seite) && await tafel(seite);
    pruefe('gewaehlt hell auf dunklem Geraet: heller Grund, dunkler Text', t && helligkeit(t.grund) > 0.6 && helligkeit(t.farbe) < 0.1,
      JSON.stringify(t && [t.grund, t.farbe]));
    await kontext.close();
  }
}

async function abschnitt(name, arbeit, ms = 120000) {
  gruppe = name;
  console.log(`… notfall: ${name}`);
  try {
    return await begrenzt(`notfall ${name} (Gruppe ${gruppe})`, arbeit, ms);
  } catch (e) {
    pruefe(`Abschnitt ohne Abbruch (${e.message})`, false);
    return null;
  }
}

// ---------- Ablauf ----------
let browser;
let code = 1;
const t0 = Date.now();
try {
  await begrenzt('Serverstart', () => new Promise((resolve, reject) => { server.once('error', reject); server.listen(PORT, '127.0.0.1', resolve); }), 10000);
  browser = await begrenzt('Browserstart', () => browserTyp(ladePlaywright()).launch(), 45000);
  await abschnitt('Normaler Start', () => testeNormalerStart(browser));
  await abschnitt('app.js wirft', () => testeKaputt(browser));
  await abschnitt('Sprache wie die App', () => testeSpracheWieApp(browser));
  await abschnitt('Frueh erkannt', () => testeFrueh(browser));
  await abschnitt('app.js haengt', () => testeHaengt(browser));
  await abschnitt('Reparieren', () => testeReparieren(browser));
  await abschnitt('Ohne Netz', () => testeOffline(browser));
  await abschnitt('Merker', () => testeMerker(browser));
  await abschnitt('App startet spaeter', () => testeSpaeterStart(browser));
  await abschnitt('Fehlende Schrift', () => testeAssetFehler(browser));
  await abschnitt('Ohne Service Worker', () => testeOhneServiceWorker(browser));
  await abschnitt('Ohne CSS', () => testeOhneCss(browser));
  const schlecht = ergebnisse.filter((r) => !r.ok);
  console.log(`\n${ergebnisse.length - schlecht.length}/${ergebnisse.length} bestanden in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  for (const f of schlecht) console.log('FEHLER: ' + f.name + (f.detail ? ' (' + f.detail + ')' : ''));
  code = schlecht.length ? 1 : 0;
} catch (e) {
  console.error(e);
  code = 1;
} finally {
  if (browser) await begrenzt('Browser schliessen', () => browser.close(), 10000).catch((e) => { console.error(e); code = 1; });
  server.closeAllConnections();
  await begrenzt('Server schliessen', () => new Promise((resolve) => server.close(resolve)), 5000).catch((e) => { console.error(e); code = 1; });
}
process.exit(code);
