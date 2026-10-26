// Ende-zu-Ende-Test der ganzen App wie auf GitHub Pages: ein kleiner Node-Server liefert den
// Projektordner unter /schach/ aus (Port 8833), Chromium mit iPad-Viewport und Touch.
// Ablauf: Arena -> Sieg gegen Benno (Schaefermatt) -> Overlay -> Analyse (sofort fertig) ->
// Naechster Gegner / Nochmal -> Verlauf -> Analyse -> Einstellungen (Holz, Klang aus) ->
// Arena zeigt Paula frei -> echte Partie gegen Paula per Tippen (Live-Bewertung) ->
// Neuladen und Zurueck-Wisch auf jedem Screen -> offline neu laden (App + Engine laufen) ->
// Update auf eine neue Version (Hinweis "Neu laden" und Wechsel beim naechsten Start).
// Prueft ausserdem den Cache des Service Workers gegen die Liste in sw.js, keine 404,
// keine Konsolenfehler. Zum Schluss Bilder aller Screens (iPad quer und hoch):
// design/app-shots/final-*.png
//
//   node tests/e2e.test.mjs
//   node tests/e2e.test.mjs --ohne-bilder       ohne die Schluss-Bilder
//   node tests/e2e.test.mjs --bilder=/pfad      Bilder woanders hin
//
// Playwright: PLAYWRIGHT_PFAD, sonst 'playwright', sonst /opt/node-tools/node_modules/playwright.
import http from 'node:http';
import { begrenzt } from './zeitwaechter.mjs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readFileSync, statSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { leseSw } from './sw.test.mjs';
import { browserTyp } from './browser.mjs';

const require = createRequire(import.meta.url);
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8833);
const PRAEFIX = '/schach/';
const START = `http://127.0.0.1:${PORT}${PRAEFIX}`;
const APP = START + '?test&sw';
const bilderArg = process.argv.find((a) => a.startsWith('--bilder='));
const BILDER = bilderArg ? bilderArg.slice(9) : process.env.BILDER || path.join(WURZEL, 'design', 'app-shots');
const OHNE_BILDER = process.argv.includes('--ohne-bilder');
mkdirSync(BILDER, { recursive: true });

const IPAD_UA = 'Mozilla/5.0 (iPad; CPU OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1';
// Schaefermatt aus der Grundstellung (wertende Partie): Flo zieht SCHAEFER_ZUEGE, der Bot antwortet nach Plan.
// Seit Runde 4 wertet eine Partie aus einer eigenen Stellung nicht mehr (keine Sterne, keine Freischaltung),
// deshalb gewinnt der Ablauf nicht mehr mit einem Matt in 1 aus einer Stellung.
const SCHAEFER_ZUEGE = ['e2e4', 'f1c4', 'd1h5', 'h5f7'];
const SCHAEFER_PLAN = { e2e4: 'e7e5', f1c4: 'b8c6', d1h5: 'g8f6' };
const SW = leseSw();
let speicher = {};   // localStorage aus dem Hauptlauf (fuer die Schluss-Bilder)

// ---------- Server wie GitHub Pages (Unterordner /schach/) ----------
const TYPEN = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.wasm': 'application/wasm',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};
const serverLog = [];
const server404 = [];
let neueVersion = 0;   // > 0: der Server liefert eine "neue Version" (sw.js und index.html geaendert)

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  let pfad;
  try { pfad = decodeURIComponent(url.pathname); } catch (e) { pfad = url.pathname; }
  const nicht = (code = 404) => {
    server404.push(`${code} ${pfad}`);
    serverLog.push({ pfad, status: code });
    res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Nicht gefunden');
  };
  if (!pfad.startsWith(PRAEFIX)) return nicht();
  let rel = pfad.slice(PRAEFIX.length);
  if (rel === '' || rel.endsWith('/')) rel += 'index.html';
  const datei = path.resolve(WURZEL, rel);
  if (!datei.startsWith(WURZEL + path.sep)) return nicht(403);
  let st;
  try { st = statSync(datei); } catch (e) { return nicht(); }
  if (!st.isFile()) return nicht();
  let inhalt = readFileSync(datei);
  if (neueVersion && rel === 'sw.js') {
    inhalt = Buffer.from(inhalt.toString('utf8').replace(/const VERSION = \d+;/, `const VERSION = ${neueVersion};`));
  }
  if (neueVersion && rel === 'index.html') {
    inhalt = Buffer.from(inhalt.toString('utf8').replace('<title>', `<meta name="schach-test-version" content="${neueVersion}">\n<title>`));
  }
  const typ = TYPEN[path.extname(datei).toLowerCase()] || 'application/octet-stream';
  serverLog.push({ pfad, status: 200 });
  // wie GitHub Pages: 10 Minuten im HTTP-Cache
  res.writeHead(200, { 'Content-Type': typ, 'Content-Length': inhalt.length, 'Cache-Control': 'max-age=600' });
  res.end(req.method === 'HEAD' ? undefined : inhalt);
});

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

async function neuerKontext(browser, { w = 1180, h = 820 } = {}) {
  const kontext = await browser.newContext({
    viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: true, isMobile: false, userAgent: IPAD_UA,
  });
  kontext.setDefaultTimeout(30000);
  kontext.setDefaultNavigationTimeout(30000);
  const fehler = [];
  const fehlgeschlagen = [];
  const beobachte = (seite) => {
    const auswerten = seite.evaluate.bind(seite);
    seite.evaluate = (...args) => begrenzt(`${gruppe}: Browserauswertung`, () => auswerten(...args));
    seite.on('console', (m) => {
      if (m.type() !== 'error') return;
      const url = (m.location() && m.location().url) || '';
      fehler.push(m.text() + (url ? ' @ ' + url : ''));
    });
    seite.on('pageerror', (e) => fehler.push('Seitenfehler: ' + e.message));
    seite.on('requestfailed', (r) => {
      const grund = r.failure() ? r.failure().errorText : '?';
      // beim Neuladen abgebrochen: kein Fehler (Chromium ERR_ABORTED, WebKit: Load request cancelled, Firefox NS_BINDING_ABORTED)
      if (/ERR_ABORTED|Load request cancelled|NS_BINDING_ABORTED/.test(grund)) return;
      fehlgeschlagen.push(`${grund} ${r.url()}`);
    });
    seite.on('response', (r) => { if (r.status() >= 400) fehlgeschlagen.push(`${r.status()} ${r.url()}`); });
  };
  kontext.on('page', beobachte);
  // Abrufe der 1,8-MB-.wasm ueber ihre Adresse (Seite und Worker; Blob-Abrufe zaehlen nicht)
  kontext.on('request', (r) => {
    if (/\.wasm$/.test(r.url().split(/[?#]/)[0]) && !/^blob:/.test(r.url())) wasmAbrufe.push({ url: r.url(), sw: !!r.serviceWorker() });
  });
  if (process.env.TEST_E2E_SW_STILL === '1') await kontext.addInitScript(() => {
    Object.defineProperty(navigator.serviceWorker, 'ready', { get: () => new Promise(() => {}) });
  });
  const seite = await kontext.newPage();
  return { kontext, seite, fehler, fehlgeschlagen };
}
const wasmAbrufe = [];
// beide Engines bereit: Adresse der Worker und eine kurze Suche
const engineInfo = (seite) => seite.evaluate(async () => {
  const [a, b] = await Promise.all([window.__app.engine('bot'), window.__app.engine('bewertung')]);
  const r = await b.analyse('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1', { depth: 6 });
  return { pfade: [a.pfad, b.pfad], tiefe: r.depth, direkt: localStorage.getItem('schach-arena:v1:wasm-direkt') };
});

// Wartet, bis ein Element ruhig steht (Lage in drei Bildern gleich, hoechstens 1,5 s). Ohne das trifft ein Tipp
// waehrend einer Einblend-Animation daneben, z. B. die Ergebnis-Karte (karte-ein: 0,1 s Verzoegerung plus 0,5 s,
// verschoben und verkleinert): der kleine Knopf "Brett ansehen" lag dann woanders, der Tipp ging ins Leere.
const stehtStill = (loc) => loc.evaluate((el) => new Promise((fertig) => {
  const t0 = performance.now();
  let alt = '';
  let gleich = 0;
  const schritt = () => {
    const b = el.getBoundingClientRect();
    const k = [b.x, b.y, b.width, b.height].map((x) => Math.round(x * 4)).join();
    gleich = k === alt ? gleich + 1 : 0;
    alt = k;
    if (gleich >= 2 || performance.now() - t0 > 1500) fertig();
    else requestAnimationFrame(schritt);
  };
  requestAnimationFrame(schritt);
})).catch(() => {});
function hilfen(seite) {
  const h = {
    async mitte(feld) {
      const b = await seite.locator(`.screen.partie .brett-felder .feld[data-feld="${feld}"]`).boundingBox();
      return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    },
    async tippeFeld(feld) {
      const p = await h.mitte(feld);
      await seite.touchscreen.tap(p.x, p.y);
      await warte(90);
    },
    // U7: "Zug bestaetigen" (Einstellung, seit 23.10. Standard aus): steht nach dem Tipp aufs Ziel die Vorschau, macht ein
    // zweiter Tipp aufs Ziel den Zug fest
    async zugTippen(uci) {
      await h.tippeFeld(uci.slice(0, 2));
      await h.tippeFeld(uci.slice(2, 4));
      if (await seite.evaluate(() => !!document.querySelector('.screen.partie .brett .lage.vorschau'))) await h.tippeFeld(uci.slice(2, 4));
    },
    // U7: Aufgeben mit Rueckfrage: mit "Halten zum Aufgeben" (Standard) ueber die Tastatur (Rueckfrage app.frage)
    async aufgebenFragen() {
      const k = seite.locator('.spielknoepfe > [data-aktion="aufgeben"]');
      if (await k.evaluate((el) => el.classList.contains('halte-knopf'))) {
        await k.focus();
        await seite.keyboard.press('Enter');
        await warte(140);
      } else await h.tippe('.spielknoepfe > [data-aktion="aufgeben"]');
    },
    // tippt das erste sichtbare Element (Finger)
    async tippe(sel) {
      const alle = seite.locator(sel);
      const n = await alle.count();
      for (let i = 0; i < n; i++) {
        const el = alle.nth(i);
        if (!(await el.isVisible())) continue;
        await el.scrollIntoViewIfNeeded();
        await stehtStill(el);
        const b = await el.boundingBox();
        if (!b) continue;
        await seite.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
        await warte(140);
        return;
      }
      throw new Error('nicht sichtbar: ' + sel);
    },
    hash: () => seite.evaluate(() => location.hash),
    phase: () => seite.evaluate(() => (window.__partie ? window.__partie.phase() : null)),
    zuege: () => seite.evaluate(() => (window.__partie ? window.__partie.z.zuege.slice() : [])),
    legal: () => seite.evaluate(() => window.__partie.chess().moves({ verbose: true }).map((m) => m.lan)),
    async warteBereit(ms = 40000) {
      await seite.waitForFunction(() => window.__partie && window.__partie.bereit === true, null, { timeout: ms });
    },
    async warteFlo(ms = 40000) {
      await seite.waitForFunction(() => window.__partie && window.__partie.phase() === 'flo', null, { timeout: ms });
    },
    async warteAbzeichen(ply, ms = 40000) {
      await seite.waitForFunction((p) => window.__partie && window.__partie.protokoll.some((e) => e.typ === 'abzeichen' && e.ply === p), ply, { timeout: ms });
      return seite.evaluate((p) => window.__partie.protokoll.find((e) => e.typ === 'abzeichen' && e.ply === p).klasse, ply);
    },
    async screen(name, ms = 15000) {
      await seite.waitForFunction((n) => document.documentElement.dataset.screen === n && document.querySelector('#app > .screen'), name, { timeout: ms });
      await warte(150);
    },
    laufend: () => seite.evaluate(() => JSON.parse(localStorage.getItem('schach-arena:v1:laufend') || 'null')),
    partien: () => seite.evaluate(() => JSON.parse(localStorage.getItem('schach-arena:v1:partien') || '[]')),
    // Inhalt des Service-Worker-Caches (Pfade)
    cache: () => seite.evaluate(async () => {
      const namen = await caches.keys();
      const inhalt = {};
      for (const n of namen) inhalt[n] = (await (await caches.open(n)).keys()).map((r) => new URL(r.url).pathname);
      return inhalt;
    }),
    swVersion: () => seite.evaluate(() => new Promise((resolve) => {
      const sw = navigator.serviceWorker;
      if (!sw.controller) { resolve(null); return; }
      const t = setTimeout(() => resolve(null), 3000);
      sw.addEventListener('message', function an(e) {
        if (!e.data || e.data.typ !== 'version') return;
        clearTimeout(t);
        sw.removeEventListener('message', an);
        resolve(e.data.version);
      });
      sw.controller.postMessage({ typ: 'version' });
    })),
    async ueberlauf() {
      return seite.evaluate(() => {
        const sc = document.querySelector('#app > .screen');
        return { seite: document.documentElement.scrollWidth - innerWidth, screen: sc ? sc.scrollWidth - sc.clientWidth : 0 };
      });
    },
  };
  return h;
}

// Schaefermatt gegen Benno in einer normalen (wertenden) Partie, endet mit 4. Dxf7#
async function schaefermatt(seite, h, { pruefeHash = false } = {}) {
  await seite.evaluate((plan) => {
    localStorage.removeItem('schach-arena:v1:laufend');
    window.__test = { botZug: () => {
      const v = window.__partie.chess().history({ verbose: true });
      return plan[v[v.length - 1].lan] || null;
    } };
    window.__app.gehe('partie', { botId: 'benno', farbe: 'w' });
  }, SCHAEFER_PLAN);
  await h.screen('partie');
  await h.warteBereit();
  await h.warteFlo();
  if (pruefeHash) pruefe('Hash #partie', (await h.hash()) === '#partie');
  for (const zug of SCHAEFER_ZUEGE) {
    await h.warteFlo();
    await h.zugTippen(zug);
  }
  await seite.evaluate(() => { window.__test = {}; });
}

// spielt einen sinnvollen Zug fuer Weiss per Tippen und wartet auf Bewertung und Bot
async function spieleZug(seite, h, wunsch) {
  const legal = await h.legal();
  const zug = wunsch.find((u) => legal.includes(u)) || legal[0];
  const ply = (await h.zuege()).length;
  await h.zugTippen(zug);
  const klasse = await h.warteAbzeichen(ply);
  await h.warteFlo();
  return { zug, ply, klasse };
}

// ---------- 1. Start: Service Worker, Manifest, Icons ----------
async function testeStart(seite, h, fehler, fehlgeschlagen) {
  gruppe = 'Start';
  await seite.goto(APP + '#arena');
  await h.screen('arena');
  pruefe('Arena unter /schach/ geladen (eine Welt mit sechs Stationen)', await seite.locator('.screen.arena .knoten').count() === 6);
  pruefe('Seitentitel', (await seite.title()) === 'Crownmate');
  const links = await seite.evaluate(() => ({
    manifest: document.querySelector('link[rel="manifest"]')?.href,
    apple: document.querySelector('link[rel="apple-touch-icon"]')?.href,
    icon: document.querySelector('link[rel="icon"]')?.href,
  }));
  pruefe('Manifest verlinkt', links.manifest === START + 'manifest.webmanifest', links.manifest);
  pruefe('Apple-Touch-Icon verlinkt', links.apple === START + 'assets/icons/apple-touch-icon.png', links.apple);
  pruefe('Favicon verlinkt', links.icon === START + 'assets/icons/favicon.svg', links.icon);
  const man = await seite.evaluate(async () => {
    const r = await fetch('manifest.webmanifest');
    const j = await r.json();
    const icons = [];
    for (const i of j.icons) {
      const a = await fetch(new URL(i.src, r.url));
      const blob = await a.blob();
      let groesse = null;
      if (i.type === 'image/png') {
        const bild = await createImageBitmap(blob);
        groesse = `${bild.width}x${bild.height}`;
      }
      icons.push({ src: i.src, status: a.status, typ: a.headers.get('content-type'), sizes: i.sizes, groesse, zweck: i.purpose });
    }
    return { typ: r.headers.get('content-type'), name: j.name, kurz: j.short_name, start: new URL(j.start_url, r.url).href, scope: new URL(j.scope, r.url).href, display: j.display, icons };
  });
  pruefe('Manifest: Typ application/manifest+json', /manifest\+json/.test(man.typ), man.typ);
  pruefe('Manifest: Name und Kurzname', man.name === 'Crownmate' && man.kurz === 'Crownmate');
  pruefe('Manifest: start_url und scope = /schach/', man.start === START && man.scope === START, `${man.start} ${man.scope}`);
  pruefe('Manifest: standalone', man.display === 'standalone');
  pruefe('Manifest: alle Icons laden', man.icons.length >= 3 && man.icons.every((i) => i.status === 200), JSON.stringify(man.icons.filter((i) => i.status !== 200)));
  pruefe('Manifest: PNG-Größen stimmen', man.icons.filter((i) => i.groesse).every((i) => i.groesse === i.sizes), JSON.stringify(man.icons.map((i) => [i.sizes, i.groesse])));
  pruefe('Manifest: maskable-Icon', man.icons.some((i) => i.zweck === 'maskable' && i.sizes === '512x512'));

  // Service Worker: registriert, aktiv, steuert die Seite
  const reg = await begrenzt('Service Worker aktivieren', () => seite.evaluate(async () => {
    const r = await navigator.serviceWorker.ready;
    return { scope: r.scope, skript: r.active && r.active.scriptURL };
  }), process.env.TEST_E2E_SW_STILL === '1' ? 2000 : 30000);
  pruefe('Service Worker aktiv, Bereich /schach/', reg.scope === START && reg.skript === START + 'sw.js', JSON.stringify(reg));
  await seite.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15000 });
  pruefe('Service Worker steuert die Seite (clients.claim)', await seite.evaluate(() => !!navigator.serviceWorker.controller));
  const cache = await h.cache();
  const name = SW.CACHE;
  const soll = SW.DATEIEN.map((d) => PRAEFIX + d);
  const ist = cache[name] || [];
  const fehlt = soll.filter((p) => !ist.includes(p));
  pruefe(`Cache ${name} enthält alle ${soll.length} Dateien`, fehlt.length === 0, fehlt.join(', '));
  pruefe('Nur ein Cache der App', Object.keys(cache).filter((n) => n.startsWith('schach-arena-')).length === 1, Object.keys(cache).join(', '));
  pruefe('Service Worker meldet seine Version', (await h.swVersion()) === SW.VERSION);
  pruefe('Keine 404 beim Vorladen', server404.length === 0, server404.join(', '));
  const lizenz = await seite.evaluate(async () => { const r = await fetch('LICENSE'); return { status: r.status, typ: r.headers.get('content-type'), text: (await r.text()).slice(0, 300) }; });
  pruefe('LICENSE kommt als Text (nicht als Download)', lizenz.status === 200 && /text\/plain/.test(lizenz.typ) && /GNU GENERAL PUBLIC LICENSE/.test(lizenz.text), JSON.stringify(lizenz));
  // w0c: die .wasm kommt beim ersten Start genau einmal (Hauptthread, Adresse relativ zum Modul unter /schach/),
  // beide Worker starten als Blob mit den geprueften Bytes (vorher 3 Abrufe: Pruefung plus je Worker einer)
  const info = await engineInfo(seite);
  const eigene = wasmAbrufe.filter((a) => !a.sw);
  pruefe('Engine-Datei beim ersten Start nur einmal geholt (Worker per Blob)', eigene.length === 1
    && eigene[0].url === START + 'vendor/stockfish/stockfish-19-lite-single.wasm', JSON.stringify(eigene));
  pruefe('Beide Engines laufen als Blob-Worker mit der .wasm als Blob-URL', info.tiefe === 6 && info.direkt == null
    && info.pfade.every((p) => /^blob:/.test(p) && /#blob%3A/.test(p)), JSON.stringify(info));
  pruefe('Keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
  pruefe('Keine fehlgeschlagenen Anfragen', fehlgeschlagen.length === 0, fehlgeschlagen.join(' | '));
}

// ---------- 2. Sieg gegen Benno, Overlay, Analyse, Naechster Gegner, Nochmal ----------
async function testeSieg(seite, h, fehler) {
  gruppe = 'Sieg';
  pruefe('Fridolin ist der aktuelle Gegner', await seite.locator('.knoten.aktuell[data-bot="fridolin"]').count() === 1);
  pruefe('Paula ist gesperrt', await seite.locator('.knoten.gesperrt[data-bot="paula"]').count() === 1);
  await schaefermatt(seite, h, { pruefeHash: true });
  await seite.waitForSelector('.ergebnis-overlay.sieg.gefuellt', { timeout: 40000 });
  await warte(2600);
  pruefe('Overlay "Sieg!"', /^Sieg!$/.test(await seite.locator('.erg-wort').innerText()));
  pruefe('Drei Sterne', await seite.locator('.erg-stern.an').count() === 3);
  pruefe('Kachel: Postbotin Paula freigeschaltet (nach Benno ist Paula frei)', /Postbotin Paula/.test(await seite.locator('.erg-frei').innerText()));
  const partien = await h.partien();
  const id = partien[0] && partien[0].id;
  pruefe('Partie gespeichert', partien.length === 1 && partien[0].ergebnis === 'sieg', JSON.stringify(partien).slice(0, 120));
  pruefe('Analyse vorab gespeichert', await seite.evaluate((i) => localStorage.getItem('schach-arena:v1:review:' + i) != null, id));
  // Erweiterungspunkte (Runde 4): Ereignisse einer echten Partie im Protokoll des Busses (gleiches Modul wie die App)
  const ereignisse = await seite.evaluate(async () => (await import('./js/ereignisse.js')).protokoll().map((e) => e.name));
  const kern = ereignisse.filter((n) => /^(app:bereit|partie:|zug:gespielt|zug:bewertet)/.test(n));
  pruefe('Ereignisse: app:bereit, partie:gestartet, Züge, partie:beendet (ohne Pakete)', kern[0] === 'app:bereit' && kern.includes('partie:gestartet')
    && kern.filter((n) => n === 'zug:gespielt').length === 7 && kern.indexOf('partie:beendet') > kern.lastIndexOf('zug:gespielt'), kern.join(' '));
  pruefe('html[data-sichtbar="ja"]', (await seite.evaluate(() => document.documentElement.dataset.sichtbar)) === 'ja');

  gruppe = 'Analyse';
  await h.tippe('.erg-knoepfe [data-ziel="analyse"]');
  await h.screen('analyse');
  pruefe('Hash #analyse/<id>', (await h.hash()) === '#analyse/' + id);
  pruefe('Sofort fertig (kein Rechnen dank vorab)', await seite.locator('.an-laden').count() === 0 && await seite.locator('.an-inhalt').count() === 1);
  pruefe('Freischalt-Banner: Postbotin Paula', /Postbotin Paula/.test(await seite.locator('.an-banner').innerText()));
  // gezeigt wird genau die gespeicherte Genauigkeit der Partie (auf ihr beruht Stern 2), mit Komma
  const genau = await seite.locator('.an-genau .an-ich-wert').innerText();
  const gespeichert = ((await h.partien())[0] || {}).genauigkeit;
  pruefe('Genauigkeit sichtbar: genau der gespeicherte Wert (mindestens 80 %)', Number.isFinite(gespeichert) && gespeichert >= 80
    && genau.trim() === gespeichert.toFixed(1).replace('.', ','), `${genau} / ${gespeichert}`);
  await seite.reload();
  await h.screen('analyse');
  pruefe('Neuladen: Analyse bleibt', (await h.hash()) === '#analyse/' + id && await seite.locator('.an-inhalt').count() === 1);
  pruefe('Neuladen: Banner bleibt', await seite.locator('.an-banner').count() === 1);

  gruppe = 'Nächster Gegner';
  await h.tippe('[data-aktion="weiter"]');
  await h.screen('arena');
  pruefe('Arena mit Freischalt-Animation', await seite.locator('.knoten.wird-frei[data-bot="paula"]').count() === 1);
  pruefe('Panel zeigt Paula', /Postbotin Paula/.test(await seite.locator('.detail h2').innerText()));
  await warte(3000);
  pruefe('Paula frei und aktuell', await seite.locator('.knoten.aktuell[data-bot="paula"]:not(.gesperrt)').count() === 1);
  await seite.goBack();
  await h.screen('analyse');
  pruefe('Zurück-Wisch: wieder in der Analyse', (await h.hash()) === '#analyse/' + id && await seite.locator('.an-inhalt').count() === 1);
  await seite.goForward();
  await h.screen('arena');
  await warte(300);
  pruefe('Vorwärts: keine zweite Freischalt-Animation', await seite.locator('.knoten.wird-frei').count() === 0);
  pruefe('Vorwärts: Paula bleibt gewählt', /Postbotin Paula/.test(await seite.locator('.detail h2').innerText()));
  await seite.reload();
  await h.screen('arena');
  await warte(300);
  pruefe('Neuladen der Arena: keine Animation, Paula gewählt', await seite.locator('.knoten.wird-frei').count() === 0 && /Postbotin Paula/.test(await seite.locator('.detail h2').innerText()));

  gruppe = 'Nochmal';
  await seite.goBack();
  await h.screen('analyse');
  await h.tippe('[data-aktion="nochmal"]');
  await h.screen('partie');
  await h.warteBereit();
  pruefe('Nochmal: neue Partie gegen Benno', /Benno/.test(await seite.locator('.screen.partie .kopf').innerText()) && (await h.zuege()).length === 0);
  pruefe('Nochmal: Grundstellung (32 Figuren)', await seite.locator('.screen.partie .brett > img.figur').count() === 32);
  await h.tippe('.screen.partie [data-aktion="zurueck"]');
  await h.screen('arena');
  pruefe('Zurück ohne Zug: direkt zur Arena, nichts offen', (await h.hash()) === '#arena' && (await h.laufend()) === null);
  pruefe('Keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
  return id;
}

// ---------- 3. Verlauf und Einstellungen ----------
async function testeVerlaufEinstellungen(seite, h, fehler, id) {
  gruppe = 'Verlauf';
  await h.tippe('.screen.arena [data-aktion="verlauf"]');
  await h.screen('verlauf');
  pruefe('Hash #verlauf', (await h.hash()) === '#verlauf');
  pruefe('Eine Partie in der Liste', await seite.locator('.vl-zeile').count() === 1);
  await seite.reload();
  await h.screen('verlauf');
  pruefe('Neuladen: Verlauf bleibt', await seite.locator('.vl-zeile').count() === 1);
  await h.tippe('.vl-zeile .vl-oeffnen');
  await h.screen('analyse');
  pruefe('Zeile öffnet die Analyse sofort', (await h.hash()) === '#analyse/' + id && await seite.locator('.an-inhalt').count() === 1 && await seite.locator('.an-laden').count() === 0);
  pruefe('Ohne Freischalt-Banner (aus dem Verlauf)', await seite.locator('.an-banner').count() === 0);
  await h.tippe('.an-screen .kopf [data-aktion="zurueck"]');
  await h.screen('verlauf');
  pruefe('Zurück: wieder im Verlauf', (await h.hash()) === '#verlauf');
  await h.tippe('.screen [data-aktion="zurueck"]');
  await h.screen('arena');
  pruefe('Zurück: Arena', (await h.hash()) === '#arena');

  gruppe = 'Einstellungen';
  await h.tippe('.screen.arena [data-aktion="einstellungen"]');
  await h.screen('einstellungen');
  pruefe('Hash #einstellungen', (await h.hash()) === '#einstellungen');
  await h.tippe('.es-brett[data-wert="holz"]');
  pruefe('Holz gewählt, wirkt sofort', (await seite.evaluate(() => document.documentElement.dataset.brett)) === 'holz'
    && await seite.locator('.es-brett[data-wert="holz"][aria-checked="true"]').count() === 1);
  await h.tippe('.es-schalter[data-key="klang"]');
  pruefe('Klang aus', await seite.locator('.es-schalter[data-key="klang"][aria-checked="false"]').count() === 1);
  await seite.reload();
  await h.screen('einstellungen');
  pruefe('Neuladen: Einstellungen bleiben (Holz, Klang aus)', await seite.locator('.es-brett[data-wert="holz"][aria-checked="true"]').count() === 1
    && await seite.locator('.es-schalter[data-key="klang"][aria-checked="false"]').count() === 1);
  await seite.goBack();
  await h.screen('arena');
  pruefe('Zurück-Wisch: Arena', (await h.hash()) === '#arena');
  pruefe('Arena zeigt Paula frei', await seite.locator('.knoten[data-bot="paula"]:not(.gesperrt)').count() === 1
    && await seite.locator('.knoten[data-bot="paula"] .schloss').count() === 0);
  pruefe('Gustav noch gesperrt', await seite.locator('.knoten.gesperrt[data-bot="gustav"]').count() === 1);
  pruefe('Keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
}

// ---------- 4. Echte Partie gegen Paula per Tippen ----------
async function testePartie(seite, h, fehler) {
  gruppe = 'Partie';
  await h.tippe('.knoten[data-bot="paula"]');
  await h.tippe('.farbwahl [data-farbe="w"]');
  await h.tippe('.detail [data-aktion="spielen"]');
  await h.screen('partie');
  await h.warteBereit();
  pruefe('Partie gegen Postbotin Paula', /Paula/.test(await seite.locator('.screen.partie .kopf').innerText()));
  const hell = await seite.evaluate(() => getComputedStyle(document.querySelector('.screen.partie .feld.h')).backgroundColor);
  pruefe('Brettfarbe Holz wirkt in der Partie', hell === 'rgb(240, 217, 181)', hell);
  pruefe('Klang aus wirkt (klang.aus)', await seite.evaluate(async () => (await import('./js/sounds.js')).klang.aus === true));
  await h.warteFlo();
  const z1 = await spieleZug(seite, h, ['e2e4']);
  pruefe('Zug 1 per Tippen: e4, Live-Bewertung kommt', z1.zug === 'e2e4' && !!z1.klasse, JSON.stringify(z1));
  pruefe('Coach zeigt die Klasse', (await seite.locator('.screen.partie .coach .c-klasse').innerText()).length > 2);
  const z2 = await spieleZug(seite, h, ['g1f3', 'b1c3', 'd2d4', 'f1c4']);
  pruefe('Zug 2 bewertet, Bot antwortet', !!z2.klasse && (await h.zuege()).length === 4, JSON.stringify(z2));
  const z3 = await spieleZug(seite, h, ['f1c4', 'd2d4', 'b1c3', 'f1e2']);
  pruefe('Zug 3 bewertet, Bot antwortet', !!z3.klasse && (await h.zuege()).length === 6, JSON.stringify(z3));
  pruefe('Zugliste mit Symbolen', await seite.locator('.zugliste .z.du .z-sym').count() >= 3);
  const balken = await seite.evaluate(() => !!document.querySelector('.screen.partie .evalbalken'));
  pruefe('Bewertungsbalken da', balken);
  const zuege = await h.zuege();

  gruppe = 'Neuladen/Zurück';
  await warte(500);
  await seite.reload();
  await h.screen('partie');
  await h.warteBereit();
  pruefe('Neuladen setzt die Partie fort', JSON.stringify(await h.zuege()) === JSON.stringify(zuege));
  await seite.goBack();
  await h.screen('arena');
  pruefe('Zurück-Wisch aus der Partie: Arena mit "Fortsetzen"', await seite.locator('.detail .fortsetzen [data-aktion="fortsetzen"]').count() === 1);
  const lauf = await h.laufend();
  pruefe('Laufende Partie gesichert', lauf && lauf.botId === 'paula' && lauf.zuege.length === zuege.length);
  await seite.goForward();
  await h.screen('partie');
  await h.warteBereit();
  pruefe('Vorwärts: Partie geht weiter', JSON.stringify(await h.zuege()) === JSON.stringify(zuege));
  // Einstellungen aus der Partie und zurueck
  await h.tippe('.screen.partie [data-aktion="einstellungen"]');
  await h.screen('einstellungen');
  await h.tippe('.es-brett[data-wert="nacht"]');
  await h.tippe('.es-screen .kopf [data-aktion="zurueck"]');
  await h.screen('partie');
  await h.warteBereit();
  const hell2 = await seite.evaluate(() => getComputedStyle(document.querySelector('.screen.partie .feld.h')).backgroundColor);
  pruefe('Partie → Einstellungen → zurück: Partie läuft, Brett Nacht', JSON.stringify(await h.zuege()) === JSON.stringify(zuege) && hell2 === 'rgb(228, 232, 246)', hell2);
  pruefe('Keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
  return zuege;
}

// ---------- 5. Offline ----------
async function testeOffline(kontext, seite, h, fehler, fehlgeschlagen, id) {
  gruppe = 'Offline';
  const vorher = serverLog.length;
  const anfragenVorher = fehlgeschlagen.length;
  await kontext.setOffline(true);
  const wasmVorher = wasmAbrufe.length;
  await seite.reload();
  await h.screen('partie');
  await h.warteBereit(60000);
  pruefe('Offline neu geladen: Partie da', await seite.locator('.screen.partie .brett > img.figur').count() > 20);
  // w0c: offline holt nur der Hauptthread die .wasm (aus dem Cache), die Worker laufen per Blob
  const infoOffline = await engineInfo(seite);
  const offlineAbrufe = wasmAbrufe.slice(wasmVorher).filter((a) => !a.sw);
  pruefe('Offline: Engines als Blob-Worker, .wasm nur einmal aus dem Cache', infoOffline.tiefe === 6
    && infoOffline.pfade.every((p) => /^blob:/.test(p)) && offlineAbrufe.length === 1, JSON.stringify({ infoOffline, offlineAbrufe }));
  const zuege = await h.zuege();
  await h.warteFlo();
  const z = await spieleZug(seite, h, ['e1g1', 'd2d3', 'd2d4', 'b1c3', 'c2c3', 'h2h3']);
  pruefe('Offline: Live-Bewertung kommt (Engine läuft)', !!z.klasse, JSON.stringify(z));
  pruefe('Offline: Bot antwortet', (await h.zuege()).length === zuege.length + 2, (await h.zuege()).join(' '));
  // Weitere Screens offline (Module aus dem Cache)
  await seite.evaluate((i) => window.__app.gehe('analyse', { partieId: i }), id);
  await h.screen('analyse');
  pruefe('Offline: Analyse-Screen', await seite.locator('.an-inhalt').count() === 1);
  // "Nochmal" in der Analyse ueberschreibt die pausierte Partie nicht ungefragt
  await h.tippe('[data-aktion="nochmal"]');
  await seite.waitForSelector('.dialog-ort .dialog', { timeout: 5000 });
  pruefe('Nochmal fragt nach, wenn eine Partie pausiert ist', /offene Partie gegen Postbotin Paula/.test(await seite.locator('.dialog').innerText()));
  await h.tippe('.dialog-knoepfe .knopf:not(.primaer)');
  await warte(300);
  pruefe('Abbrechen: Analyse bleibt, Partie bleibt gespeichert', (await h.hash()) === '#analyse/' + id && (await h.laufend()) && (await h.laufend()).botId === 'paula');
  await seite.evaluate(() => window.__app.gehe('verlauf'));
  await h.screen('verlauf');
  pruefe('Offline: Verlauf-Screen', await seite.locator('.vl-zeile').count() >= 1);
  await seite.evaluate(() => window.__app.gehe('einstellungen'));
  await h.screen('einstellungen');
  pruefe('Offline: Einstellungen-Screen', await seite.locator('.es-brett').count() === 3);
  // Ganz neuer Start ohne Netz (neuer Tab, Startadresse wie vom Home-Bildschirm)
  const neu = await kontext.newPage();
  await neu.goto(START);
  await neu.waitForSelector('.screen.arena .knoten', { timeout: 20000 });
  pruefe('Offline: Start über ./ (wie vom Home-Bildschirm)', await neu.locator('.screen.arena .knoten').count() === 6);
  await neu.close();
  // (die Update-Pruefung des Browsers auf sw.js laeuft an der Offline-Simulation vorbei: zaehlt nicht)
  const abrufe = serverLog.slice(vorher).filter((l) => l.pfad !== PRAEFIX + 'sw.js');
  pruefe('Offline: kein Abruf beim Server', abrufe.length === 0, abrufe.map((l) => l.pfad).join(', '));
  pruefe('Offline: keine fehlgeschlagenen Anfragen', fehlgeschlagen.length === anfragenVorher, fehlgeschlagen.slice(anfragenVorher).join(' | '));
  await kontext.setOffline(false);
  pruefe('Keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
}

// ---------- 6. Aufgeben nach Fortsetzen: Overlay, Analyse ----------
async function testeAufgabe(seite, h, fehler) {
  gruppe = 'Aufgabe';
  await seite.evaluate(() => window.__app.gehe('arena'));
  await h.screen('arena');
  await h.tippe('.detail .fortsetzen [data-aktion="fortsetzen"]');
  await h.screen('partie');
  await h.warteBereit();
  const n = (await h.zuege()).length;
  pruefe('Fortsetzen aus der Arena', n >= 8, String(n));
  await h.aufgebenFragen();
  await seite.waitForSelector('.dialog-ort .dialog');
  await h.tippe('.dialog-knoepfe .knopf.gefahr');
  await seite.waitForSelector('.ergebnis-overlay.niederlage.gefuellt', { timeout: 90000 });
  pruefe('Overlay: Niederlage mit Genauigkeit', /^Partie verloren$/.test(await seite.locator('.erg-wort').innerText())
    && /\d/.test(await seite.locator('.erg-genau b').innerText()));
  const p = (await h.partien()).find((x) => x.botId === 'paula');
  pruefe('Partie mit Analyse gespeichert', p && p.zuege.length === n && Number.isFinite(p.genauigkeit)
    && await seite.evaluate((i) => localStorage.getItem('schach-arena:v1:review:' + i) != null, p && p.id));
  await h.tippe('.erg-knoepfe [data-ziel="analyse"]');
  await h.screen('analyse');
  pruefe('Analyse sofort fertig', await seite.locator('.an-inhalt').count() === 1 && await seite.locator('.an-laden').count() === 0);
  const gesamt = await seite.locator('.an-kl-gesamt .an-n').first().textContent();
  pruefe('Analyse: Klassen-Tabelle zählt alle eigenen Züge', gesamt.trim() === String(Math.ceil(n / 2)), `${gesamt} statt ${Math.ceil(n / 2)}`);
  await h.tippe('[data-aktion="nochmal"]');
  await h.screen('partie');
  await h.warteBereit();
  pruefe('Nochmal: neue Partie gegen Paula mit Weiß', /Paula/.test(await seite.locator('.screen.partie .kopf').innerText())
    && await seite.locator('.screen.partie .brett[data-ausrichtung="w"]').count() === 1 && (await h.zuege()).length === 0);
  await h.tippe('.screen.partie [data-aktion="zurueck"]');
  await h.screen('arena');
  pruefe('Keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
}

// ---------- 7. Update auf eine neue Version ----------
async function testeUpdate(seite, h, fehler) {
  gruppe = 'Update';
  await seite.evaluate(() => window.__app.gehe('arena'));
  await h.screen('arena');
  // a) Neue Version erscheint, waehrend die App offen ist: Hinweis "Neu laden"
  neueVersion = Number(SW.VERSION) + 100;
  await seite.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r.update()).then(() => true));
  await seite.waitForSelector('.update-hinweis', { timeout: 30000 });
  pruefe('Hinweis "Neue Version verfügbar"', /Neue Version/.test(await seite.locator('.update-hinweis').innerText()));
  const knopf = await seite.locator('.update-hinweis [data-aktion="neu-laden"]').boundingBox();
  pruefe('Knopf "Neu laden" mindestens 44 px', knopf && knopf.height >= 43.5, JSON.stringify(knopf));
  pruefe('Alte Version läuft weiter, bis Flo tippt', (await h.swVersion()) === SW.VERSION);
  if (!OHNE_BILDER) await seite.screenshot({ path: path.join(BILDER, 'final-update-ipad-quer.png') });
  const geladen = seite.waitForEvent('load', { timeout: 20000 });
  await h.tippe('.update-hinweis [data-aktion="neu-laden"]');
  await geladen;
  await h.screen('arena');
  pruefe('Nach "Neu laden": neue Version aktiv', (await h.swVersion()) === neueVersion);
  pruefe('Neue Dateien geladen (am HTTP-Cache vorbei)', await seite.evaluate((v) => document.querySelector('meta[name="schach-test-version"]')?.content === String(v), neueVersion));
  let cache = await h.cache();
  pruefe('Alter Cache gelöscht, neuer vollständig', Object.keys(cache).join() === 'schach-arena-v' + neueVersion
    && SW.DATEIEN.every((d) => cache['schach-arena-v' + neueVersion].includes(PRAEFIX + d)), Object.keys(cache).join(', '));
  pruefe('Kein Hinweis mehr', await seite.locator('.update-hinweis').count() === 0);

  // b) Neue Version liegt beim Start schon bereit: sie uebernimmt sofort
  await seite.evaluate(() => sessionStorage.clear());
  neueVersion += 1;
  await seite.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r.update()).then(() => true));
  await seite.waitForFunction(() => navigator.serviceWorker.getRegistration().then((r) => !!r.waiting), null, { timeout: 30000, polling: 200 });
  await seite.evaluate(() => { document.querySelector('.update-hinweis')?.remove(); });
  await seite.reload();
  await seite.waitForFunction((v) => document.querySelector('meta[name="schach-test-version"]')?.content === String(v), neueVersion, { timeout: 20000 });
  await h.screen('arena');
  pruefe('Beim nächsten Start: neue Version übernimmt', (await h.swVersion()) === neueVersion);
  cache = await h.cache();
  pruefe('Beim nächsten Start: nur der neue Cache', Object.keys(cache).join() === 'schach-arena-v' + neueVersion, Object.keys(cache).join(', '));
  neueVersion = 0;
  pruefe('Keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
}

// ---------- 8. Schluss-Bilder aller Screens (iPad quer und hoch) ----------
async function bilder(browser, id) {
  gruppe = 'Bilder';
  // Stand aus dem Ablauf: eine gewonnene Partie, Paula frei; dazu ein paar Sterne wie im Mockup
  for (const vp of [{ name: 'ipad-quer', w: 1180, h: 820 }, { name: 'ipad-hoch', w: 820, h: 1180 }]) {
    const { kontext, seite, fehler } = await neuerKontext(browser, vp);
    const h = hilfen(seite);
    await seite.goto(APP + '#arena');
    await h.screen('arena');
    // Fortschritt und eine Partie aus dem Hauptlauf uebernehmen
    await seite.evaluate((daten) => { for (const [k, v] of Object.entries(daten)) localStorage.setItem(k, v); }, speicher);
    await seite.reload();
    await h.screen('arena');
    await warte(1200);
    let u = await h.ueberlauf();
    pruefe(`${vp.name}: Arena ohne Überlauf`, u.seite <= 0 && u.screen <= 0, JSON.stringify(u));
    await seite.screenshot({ path: path.join(BILDER, `final-arena-${vp.name}.png`) });

    await seite.evaluate(() => window.__app.gehe('partie', { botId: 'paula', farbe: 'w' }));
    await h.screen('partie');
    await h.warteBereit();
    await h.warteFlo();
    await spieleZug(seite, h, ['e2e4']);
    await spieleZug(seite, h, ['g1f3', 'b1c3']);
    await seite.evaluate(() => { window.__test = { botAnhalten: true }; });
    const legal = await h.legal();
    const zug = ['f1c4', 'd2d4', 'f1b5'].find((x) => legal.includes(x)) || legal[0];
    const ply = (await h.zuege()).length;
    await h.zugTippen(zug);
    await h.warteAbzeichen(ply);
    await warte(900);
    u = await h.ueberlauf();
    pruefe(`${vp.name}: Partie ohne Überlauf`, u.seite <= 0 && u.screen <= 0, JSON.stringify(u));
    await seite.screenshot({ path: path.join(BILDER, `final-partie-${vp.name}.png`) });
    await seite.evaluate(() => { window.__test = {}; });

    await schaefermatt(seite, h);
    await seite.waitForSelector('.ergebnis-overlay.gefuellt', { timeout: 40000 });
    await warte(2600);
    await seite.screenshot({ path: path.join(BILDER, `final-ergebnis-${vp.name}.png`) });
    await h.tippe('.erg-knoepfe [data-ziel="analyse"]');
    await h.screen('analyse');
    await warte(600);
    u = await h.ueberlauf();
    pruefe(`${vp.name}: Analyse ohne Überlauf`, u.seite <= 0 && u.screen <= 0, JSON.stringify(u));
    await seite.screenshot({ path: path.join(BILDER, `final-analyse-${vp.name}.png`) });
    // Analyse der laengeren Partie aus dem Hauptlauf, an einem Zug in der Mitte
    await seite.evaluate((i) => window.__app.gehe('analyse', { partieId: i, ply: 4 }), id);
    await h.screen('analyse');
    await seite.waitForSelector('.an-inhalt', { timeout: 60000 });
    await warte(600);
    await seite.screenshot({ path: path.join(BILDER, `final-analyse-zug-${vp.name}.png`) });

    await seite.evaluate(() => window.__app.gehe('verlauf'));
    await h.screen('verlauf');
    await warte(400);
    u = await h.ueberlauf();
    pruefe(`${vp.name}: Verlauf ohne Überlauf`, u.seite <= 0 && u.screen <= 0, JSON.stringify(u));
    await seite.screenshot({ path: path.join(BILDER, `final-verlauf-${vp.name}.png`) });
    await seite.evaluate(() => window.__app.gehe('einstellungen'));
    await h.screen('einstellungen');
    await warte(400);
    u = await h.ueberlauf();
    pruefe(`${vp.name}: Einstellungen ohne Überlauf`, u.seite <= 0 && u.screen <= 0, JSON.stringify(u));
    await seite.screenshot({ path: path.join(BILDER, `final-einstellungen-${vp.name}.png`) });
    pruefe(`${vp.name}: keine Konsolenfehler`, fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }
}

// ---------- Kern ohne Spielpakete (?test&kern): die Pakete aus PAKETE aendern das Ergebnis, der Kern allein nicht ----------
async function testeOhnePakete(browser) {
  gruppe = 'Kern';
  const { kontext, seite, fehler, fehlgeschlagen } = await neuerKontext(browser);
  const h = hilfen(seite);
  const paketAbrufe = [];
  seite.on('request', (r) => { if (/\/pakete\//.test(r.url())) paketAbrufe.push(r.url()); });
  await seite.goto(START + '?test&kern#arena');
  await h.screen('arena');
  await schaefermatt(seite, h);
  await seite.waitForSelector('.ergebnis-overlay.sieg.gefuellt', { timeout: 40000 });
  await warte(2600);
  pruefe('Ohne Pakete: keine Feier, kein Ort im Ergebnis', await seite.locator('.erg-feier').isHidden() && await seite.locator('.erg-karte-ort').isHidden());
  pruefe('Ohne Pakete: keine Paket-Datei geladen', paketAbrufe.length === 0, paketAbrufe.join(' | '));
  pruefe('Ohne Pakete: keine Konsolenfehler, keine fehlgeschlagenen Anfragen', fehler.length === 0 && fehlgeschlagen.length === 0, [...fehler, ...fehlgeschlagen].join(' | '));
  await kontext.close();
}

// ---------- Kopf mit den echten Paketen: Zahlenruhe (Flo 23.10.: Sterne, Level, Serie) ----------
// Mit Level (funken) und Serie im Kopf tritt "Besiegt" zurueck; jeder sichtbare Chip steht ganz in der Chip-Reihe, auf dem
// iPad (quer 1180 und 1024, hoch 820) und am Handy (390, dort ohne die Marke und ohne die Flamme der Serie).
async function testeKopfZahlenruhe(browser) {
  gruppe = 'Kopf';
  for (const [name, w, h, mobil] of [['iPad quer', 1180, 820, false], ['iPad 1024', 1024, 768, false], ['iPad hoch', 820, 1180, false], ['Handy', 390, 844, true]]) {
    const kontext = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: true, isMobile: mobil });
    kontext.setDefaultTimeout(30000);
    kontext.setDefaultNavigationTimeout(30000);
    const seite = await kontext.newPage();
    const auswerten = seite.evaluate.bind(seite);
    seite.evaluate = (...args) => begrenzt(`${gruppe}: Browserauswertung`, () => auswerten(...args));
    await seite.goto(START + '?test#arena');
    await seite.waitForFunction(() => !!window.__serie, null, { timeout: 20000 });
    await seite.waitForSelector('.screen.arena .kopf-chips .fk-chip', { timeout: 20000 });
    const neu = await seite.evaluate(() => [...document.querySelectorAll('.kopf-chips > *')].filter((c) => c.getClientRects().length)
      .map((c) => (c.classList.contains('chip-sterne') ? 'sterne' : c.classList.contains('fk-chip') ? 'level' : c.classList.contains('chip-pokal') ? 'besiegt' : c.className)).join(','));
    pruefe(`${name}: neuer Spieler (noch keine Serie): Sterne und Level, kein Besiegt`, neu === 'sterne,level', neu);
    await seite.evaluate(async () => {
      const tg = await import('./js/tag.js');
      const S = window.__serie;
      const st = S.T.leer();
      for (let i = 11; i >= 1; i--) S.T.zaehleTag(st, tg.addiereTage(S.heute(), -i), { quelle: 'partie' });
      Object.assign(st, { lauf: { n: 4, best: 4, ms: [3] } });
      S.speichere(st);
    });
    // neu zeichnen statt neu laden (beim Verlassen der Seite koennte ein Paket seinen alten Stand zurueckschreiben)
    await seite.evaluate(() => window.__app.gehe('arena'));
    await seite.waitForSelector('.screen.arena .kopf-chips .se-chip', { timeout: 20000 });
    await warte(800);
    const k = await seite.evaluate(() => {
      const box = document.querySelector('.kopf-chips').getBoundingClientRect();
      const chips = [...document.querySelectorAll('.kopf-chips > *')].filter((c) => c.getClientRects().length);
      return { sichtbar: chips.map((c) => (c.classList.contains('chip-sterne') ? 'sterne' : c.classList.contains('fk-chip') ? 'level'
        : c.classList.contains('se-chip') ? 'serie' : c.classList.contains('chip-pokal') ? 'besiegt' : c.className)),
        ganz: chips.every((c) => { const r = c.getBoundingClientRect(); return r.left >= box.left - 1 && r.right <= box.right + 1; }),
        quer: document.documentElement.scrollWidth <= innerWidth + 1, titel: document.querySelector('.haupt-kopf h1, .haupt-kopf .marke-titel')?.textContent.trim() };
    });
    pruefe(`${name}: im Kopf genau Sterne, Level, Serie, alle ganz im Bild, die Marke bleibt im Dokument`, k.sichtbar.join(',') === 'sterne,level,serie'
      && k.ganz && k.quer && k.titel === 'Crownmate', JSON.stringify(k));
    await kontext.close();
  }
}

async function abschnitt(name, arbeit, ms = 180000) {
  const start = Date.now();
  gruppe = name;
  console.log(`… e2e: ${name}`);
  const puls = setInterval(() => console.log(`… e2e: ${name}, Gruppe ${gruppe}, ${Math.round((Date.now() - start) / 1000)} s`), 15000);
  try {
    return await begrenzt(`e2e ${name} (Gruppe ${gruppe})`, arbeit, ms);
  } catch (e) {
    throw new Error(`e2e ${name}, letzte Gruppe ${gruppe}: ${e.message}`, { cause: e });
  } finally { clearInterval(puls); }
}

// ---------- Ablauf ----------
let browser;
let code = 1;
const t0 = Date.now();
try {
  await abschnitt('Serverstart', () => new Promise((resolve, reject) => { server.once('error', reject); server.listen(PORT, '127.0.0.1', resolve); }), 10000);
  browser = await abschnitt('Browserstart', () => browserTyp(ladePlaywright()).launch(), 45000);
  const { kontext, seite, fehler, fehlgeschlagen } = await neuerKontext(browser);
  const h = hilfen(seite);
  await abschnitt('Start, Cache und Engines', () => testeStart(seite, h, fehler, fehlgeschlagen));
  const id = await abschnitt('Sieg und Analyse', () => testeSieg(seite, h, fehler));
  await abschnitt('Verlauf und Einstellungen', () => testeVerlaufEinstellungen(seite, h, fehler, id));
  await abschnitt('Partie und Fortsetzen', () => testePartie(seite, h, fehler));
  await abschnitt('Offline', () => testeOffline(kontext, seite, h, fehler, fehlgeschlagen, id));
  await abschnitt('Aufgabe', () => testeAufgabe(seite, h, fehler));
  await abschnitt('Update', () => testeUpdate(seite, h, fehler));
  await abschnitt('Kern ohne Pakete', () => testeOhnePakete(browser));
  await abschnitt('Kopf und Zahlenruhe', () => testeKopfZahlenruhe(browser));
  gruppe = 'Gesamt';
  pruefe('Keine 404 im ganzen Ablauf', server404.length === 0, server404.join(', '));
  pruefe('Keine fehlgeschlagenen Anfragen', fehlgeschlagen.length === 0, fehlgeschlagen.join(' | '));
  speicher = await seite.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter((k) => k.startsWith('schach-arena:') && !k.endsWith(':laufend')).map((k) => [k, localStorage.getItem(k)])));
  const lang = (JSON.parse(speicher['schach-arena:v1:partien'] || '[]').find((p) => p.botId === 'paula') || {}).id;
  await kontext.close();
  if (!OHNE_BILDER) await abschnitt('Schlussbilder', () => bilder(browser, lang || id), 300000);
  const schlecht = ergebnisse.filter((r) => !r.ok);
  console.log(`\n${ergebnisse.length - schlecht.length}/${ergebnisse.length} bestanden in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  for (const f of schlecht) console.log('FEHLER: ' + f.name + (f.detail ? ' (' + f.detail + ')' : ''));
  if (!OHNE_BILDER) console.log('Bilder: ' + BILDER);
  code = schlecht.length ? 1 : 0;
} catch (e) {
  console.error(e);
  code = 1;
} finally {
  if (browser) await begrenzt('Browser schliessen', () => browser.close(), 10000).catch(e => { console.error(e); code = 1; });
  server.closeAllConnections();
  await begrenzt('Server schliessen', () => new Promise(resolve => server.close(resolve)), 5000).catch(e => { console.error(e); code = 1; });
}
process.exit(code);
