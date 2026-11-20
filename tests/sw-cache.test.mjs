// Aufraeumen der Caches beim Versionswechsel, ohne Browser (Punkt 28, 09.11.2026): sw.js laeuft zweimal in einer
// Sandbox (alte Fassung VERSION, neue Fassung VERSION + 1) ueber EINEM nachgebauten CacheStorage mit den Regeln aus
// der Spezifikation: caches.open legt einen fehlenden Cache an, caches.match mit cacheName legt nichts an, ein
// geloeschter Cache bleibt als Objekt benutzbar, gehoert aber nicht mehr zum Speicher.
// Der Fall aus der CI (f92d7ee, chromium (1), "nur ihr Cache bleibt" mit v283 und v284): Die neue Fassung loescht in
// activate den alten Cache. Bis clients.claim() steuert noch die alte Fassung die Seite, eine Anfrage in diesem
// Moment landet bei ihr. Legt ihr Fetch-Handler dabei den alten Cache neu an, bleibt er bis zum naechsten Update liegen.
//   node tests/sw-cache.test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import path from 'node:path';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEXT = readFileSync(path.join(WURZEL, 'sw.js'), 'utf8');
const VERSION = Number(TEXT.match(/const VERSION = (\d+);/)[1]);
const ORT = 'https://example.org/schach/';
const { DATEIEN, KERN } = (() => {
  const k = { self: { location: new URL(ORT + 'sw.js'), addEventListener() {} }, URL };
  vm.createContext(k);
  vm.runInContext(TEXT + '\n;globalThis.__l = { DATEIEN, KERN };', k);
  return k.__l;
})();

const ergebnisse = [];
function pruefe(name, ok, detail = '') {
  ergebnisse.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'ok  ' : 'FEHLER'} ${name}${!ok && detail ? ' (' + detail + ')' : ''}`);
}

// ---------- CacheStorage wie im Browser (nur was sw.js braucht) ----------
const adresse = (r) => new URL(typeof r === 'string' ? r : r.url, ORT).href;
const ohneSuche = (u) => u.split('?')[0];
class Cache {
  constructor() { this.eintraege = new Map(); }
  async match(r, o = {}) {
    const u = adresse(r);
    for (const [k, v] of this.eintraege) if (k === u || (o.ignoreSearch && ohneSuche(k) === ohneSuche(u))) return v;
    return undefined;
  }
  async put(r, antwort) { this.eintraege.set(adresse(r), antwort); }
  async keys() { return [...this.eintraege.keys()].map((url) => ({ url })); }
}
class CacheStorage {
  constructor() { this.speicher = new Map(); this.geoeffnet = []; }
  async open(n) { this.geoeffnet.push(n); if (!this.speicher.has(n)) this.speicher.set(n, new Cache()); return this.speicher.get(n); }
  async has(n) { return this.speicher.has(n); }
  async delete(n) { return this.speicher.delete(n); }
  async keys() { return [...this.speicher.keys()]; }
  async match(r, o = {}) {
    if (o.cacheName) return this.speicher.has(o.cacheName) ? this.speicher.get(o.cacheName).match(r, o) : undefined;
    for (const c of this.speicher.values()) { const t = await c.match(r, o); if (t) return t; }
    return undefined;
  }
}

// ---------- eine Fassung von sw.js als "Worker" ----------
function worker(version, caches, netz) {
  const hoerer = {};
  const self = { location: new URL(ORT + 'sw.js'), addEventListener: (t, f) => { hoerer[t] = f; },
    clients: { claim: async () => {} }, skipWaiting: async () => {} };
  // wie im Browser: eine relative Adresse gilt relativ zu sw.js (Node verlangt sonst eine volle)
  const ImWorker = class extends Request { constructor(u, o) { super(typeof u === 'string' ? new URL(u, self.location).href : u, o); } }; // INTENTIONAL-SLOP[R3]: self ist hier das nachgebaute Worker-Objekt
  const kontext = { self, caches, fetch: netz, Response, Request: ImWorker, Headers, URL, console };
  vm.createContext(kontext);
  vm.runInContext(TEXT.replace(`const VERSION = ${VERSION};`, `const VERSION = ${version};`), kontext);
  return {
    async ereignis(typ, extra = {}) {
      let arbeit = Promise.resolve(), antwort;
      hoerer[typ]({ ...extra, waitUntil: (p) => { arbeit = p; }, respondWith: (p) => { antwort = p; } });
      await arbeit;
      return antwort && await antwort;
    },
  };
}
const netz = async () => { const r = new Response('// aus dem Netz', { status: 200 }); Object.defineProperty(r, 'type', { value: 'basic' }); return r; };
const anfrage = (pfad) => ({ request: new Request(ORT + pfad) });
const alt = `schach-arena-v${VERSION}`, neu = `schach-arena-v${VERSION + 1}`;

async function lage() {
  const caches = new CacheStorage();
  (await caches.open(alt)).put(ORT + 'index.html', new Response('alt'));
  // der neue Cache ist vollstaendig: dann loescht activate den alten (mit Luecken behaelt es ihn, Fall 4 unten)
  const voll = await caches.open(neu);
  for (const d of DATEIEN) await voll.put(ORT + d, new Response(d === 'index.html' ? 'neu' : '// ' + d));
  const a = worker(VERSION, caches, netz), n = worker(VERSION + 1, caches, netz);
  await n.ereignis('activate');
  caches.geoeffnet = [];
  return { caches, a, n };
}

// 1) Anfrage nach einer Datei, die nicht im Cache liegt, bei der alten Fassung nach dem activate der neuen
{
  const { caches, a } = await lage();
  pruefe('Wechsel: activate der neuen Fassung loescht den alten Cache', JSON.stringify(await caches.keys()) === JSON.stringify([neu]), (await caches.keys()).join());
  const antwort = await a.ereignis('fetch', anfrage('js/spaet-geladen.js'));
  pruefe('Wechsel: die alte Fassung beantwortet die Anfrage trotzdem (aus dem Netz)', antwort && antwort.status === 200);
  pruefe('Wechsel: eine spaete Anfrage bei der alten Fassung legt ihren geloeschten Cache nicht wieder an',
    JSON.stringify(await caches.keys()) === JSON.stringify([neu]), (await caches.keys()).join(', '));
}
// 2) dasselbe fuer die Startseite (Neuladen genau im Wechsel)
{
  const { caches, a } = await lage();
  const antwort = await a.ereignis('fetch', anfrage('index.html?test'));
  pruefe('Wechsel: Neuladen der Startseite bei der alten Fassung kommt an', antwort && antwort.status === 200);
  pruefe('Wechsel: Neuladen der Startseite bei der alten Fassung legt keinen Cache an',
    JSON.stringify(await caches.keys()) === JSON.stringify([neu]), (await caches.keys()).join(', '));
}
// 3) Normalbetrieb bleibt: Treffer aus dem eigenen Cache, Nachladen landet im eigenen Cache
{
  const caches = new CacheStorage();
  (await caches.open(neu)).put(ORT + 'index.html', new Response('neu'));
  const n = worker(VERSION + 1, caches, netz);
  const start = await n.ereignis('fetch', anfrage('index.html?test'));
  pruefe('Normal: Startseite kommt aus dem eigenen Cache', start && await start.text() === 'neu');
  await n.ereignis('fetch', anfrage('js/nachgeladen.js'));
  pruefe('Normal: nachgeladene Datei landet im eigenen Cache', !!(await (await caches.open(neu)).match(ORT + 'js/nachgeladen.js')));
  const zweit = await n.ereignis('fetch', anfrage('js/nachgeladen.js'));
  pruefe('Normal: beim zweiten Mal kommt sie aus dem Cache', zweit && await zweit.text() === '// aus dem Netz');
}

// 4) Update, die Installation hat nur den Kern abgelegt (fc-06:00, 20.11.2026): activate behaelt den alten Cache, damit das
// Nachladen den Rest per ETag (304) aus ihm nimmt statt voll aus dem Netz, und raeumt ihn erst weg, wenn alles da ist
{
  const caches = new CacheStorage();
  const altCache = await caches.open(alt);
  for (const d of DATEIEN) await altCache.put(ORT + d, new Response('// alt ' + d, { headers: { ETag: '"e1"' } }));
  const neuCache = await caches.open(neu);
  for (const d of KERN) await neuCache.put(ORT + d, new Response('// neu ' + d));
  let voll = 0, bedingt = 0;
  const netz304 = async (r) => {
    if (r.headers.get('If-None-Match')) { bedingt++; return new Response(null, { status: 304 }); }
    voll++; return netz();
  };
  const n = worker(VERSION + 1, caches, netz304);
  await n.ereignis('activate');
  pruefe('Update mit Luecken: activate behaelt den alten Cache fuer das Nachladen', JSON.stringify(await caches.keys()) === JSON.stringify([alt, neu]),
    (await caches.keys()).join(', '));
  for (let i = 0; i < 5 && (await caches.keys()).includes(alt); i++) await n.ereignis('fetch', anfrage('index.html'));
  pruefe('Update mit Luecken: das Nachladen nimmt den Rest per 304 aus dem alten Cache, kein voller Abruf',
    voll === 0 && bedingt === DATEIEN.length - KERN.length, `voll ${voll}, bedingt ${bedingt}, Rest ${DATEIEN.length - KERN.length}`);
  const rest = DATEIEN.find((d) => !KERN.includes(d));
  pruefe('Update mit Luecken: danach liegt jede Datei im neuen Cache, der alte ist weg', JSON.stringify(await caches.keys()) === JSON.stringify([neu])
    && (await (await caches.open(neu)).keys()).length === DATEIEN.length && /alt/.test(await (await (await caches.open(neu)).match(ORT + rest)).text()),
    (await caches.keys()).join(', '));
}

// 5) Das Nachladen der aktiven Fassung raeumt nur aeltere Caches weg, nie einen neueren (der kann gerade installieren),
// und eine geloeschte Fassung legt beim Nachladen ihren Cache nicht wieder an
{
  const caches = new CacheStorage();
  const eigen = await caches.open(alt);
  for (const d of KERN) await eigen.put(ORT + d, new Response('// ' + d));
  (await caches.open(neu)).put(ORT + 'index.html', new Response('neu'));
  const a = worker(VERSION, caches, netz);
  await a.ereignis('fetch', anfrage('index.html'));
  pruefe('Nachladen: fuellt den eigenen Cache und laesst den neueren stehen', JSON.stringify(await caches.keys()) === JSON.stringify([alt, neu])
    && (await eigen.keys()).length === DATEIEN.length, `${(await caches.keys()).join(', ')}; ${(await eigen.keys()).length} von ${DATEIEN.length}`);
  await caches.delete(alt);
  await a.ereignis('fetch', anfrage('js/spaet.js'));
  pruefe('Nachladen: eine geloeschte Fassung legt ihren Cache nicht wieder an', JSON.stringify(await caches.keys()) === JSON.stringify([neu]),
    (await caches.keys()).join(', '));
}

// 6) Update mit Luecken, dann ohne Netz (Kaltreview fc-08:50, 20.11.2026): eine Datei, die der neue Cache noch nicht hat,
// kommt aus dem von activate behaltenen alten Cache statt als Netzfehler; der alte Cache wird dabei nicht neu angelegt
{
  const caches = new CacheStorage();
  const altCache = await caches.open(alt);
  for (const d of DATEIEN) await altCache.put(ORT + d, new Response('// alt ' + d));
  const neuCache = await caches.open(neu);
  for (const d of KERN) await neuCache.put(ORT + d, new Response('// neu ' + d));
  const ohneNetz = async () => { throw new TypeError('Failed to fetch'); };
  const n = worker(VERSION + 1, caches, ohneNetz);
  await n.ereignis('activate');
  const rest = DATEIEN.find((d) => !KERN.includes(d));
  let antwort = null, fehlerText = '';
  try { antwort = await n.ereignis('fetch', anfrage(rest)); } catch (e) { fehlerText = e.message; }
  pruefe('ohne Netz nach einem Update: eine Datei ausserhalb des Kerns kommt aus dem behaltenen alten Cache',
    !!antwort && (await antwort.text()) === '// alt ' + rest, fehlerText || rest);
  const kern = await n.ereignis('fetch', anfrage(KERN.find((d) => d !== 'index.html')));
  pruefe('ohne Netz nach einem Update: eine Kern-Datei kommt weiter aus dem neuen Cache', !!kern && /^\/\/ neu /.test(await kern.text()));
  let weg = '';
  try { await n.ereignis('fetch', anfrage('js/gibt-es-nirgends.js')); } catch (e) { weg = e.message; }
  pruefe('ohne Netz: eine Datei, die kein Cache hat, bleibt ein Netzfehler', weg === 'Failed to fetch', weg);
  pruefe('ohne Netz: es entsteht kein weiterer Cache', JSON.stringify(await caches.keys()) === JSON.stringify([alt, neu]), (await caches.keys()).join(', '));
}

const gut = ergebnisse.filter((e) => e.ok).length;
console.log(`\n${gut}/${ergebnisse.length} bestanden`);
process.exit(gut === ergebnisse.length ? 0 : 1);
