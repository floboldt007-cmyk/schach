// Bilder der Online-Ansichten (Feinschliff R8, 13.11.2026): Lobby, Gegnersuche, laufende Partie und Ergebnis auf
// iPhone 13 und PC, je hell und dunkel. Die Funktionsproben (tests/online-ui.test.mjs, tests/gegnersuche.test.mjs)
// machen keine Bilder; dieses Skript schliesst die Luecke fuer die Sichtkritik. Kein Teil von tests/alle.mjs.
// Netzwerk ausschliesslich simuliert: jede Anfrage an *.supabase.co beantwortet die Attrappe unten, nie das echte Projekt.
//
//   node tests/bilder-online.mjs --bilder=<ordner>     16 Bilder: online-<geraet>-<hell|dunkel>-<lobby|suche|partie|ergebnis>.png
//   PORT=8991 node tests/bilder-online.mjs ...         eigener Port (Standard 8991)
// Exit 0, wenn alle 16 Bilder entstanden sind und jede Ansicht im erwarteten Modus stand; sonst 1.
import http from 'node:http';
import os from 'node:os';
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Chess } from '../vendor/chess/chess.js';
import { browserTyp } from './browser.mjs';

const require = createRequire(import.meta.url);
let pw;
for (const p of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
  try { pw = require(p); break; } catch (e) { /* naechster */ }
}
if (!pw) throw new Error('Playwright fehlt (PLAYWRIGHT_PFAD setzen)');
const arg = (n) => { const a = process.argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : null; };
const BILDER = arg('bilder') || path.join(os.tmpdir(), 'bilder-online');
mkdirSync(BILDER, { recursive: true });

const root = fileURLToPath(new URL('../', import.meta.url));
const typen = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg' };
const server = http.createServer((req, res) => {
  const p = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://test').pathname).replace(/\/$/, '/index.html'));
  if (!p.startsWith(root)) { res.writeHead(403); res.end(); return; }
  try { const d = readFileSync(p); res.writeHead(200, { 'Content-Type': typen[path.extname(p)] || 'application/octet-stream' }); res.end(d); }
  catch (e) { res.writeHead(404); res.end(); }
});
const PORT = Number(process.env.PORT || 8991);
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
const BASIS = `http://127.0.0.1:${PORT}/index.html?test`;
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

let ok = 0, gesamt = 0;
function pruefe(name, gut, detail = '') {
  gesamt++; if (gut) ok++;
  console.log(`${gut ? 'OK' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(detail)}`);
  return gut;
}

// ---- Server-Attrappe (je Lauf ein Zustand), Muster wie tests/gleichheit-ansichten.test.mjs ----
const UID = 'u1';
const token = (uid) => 'a.' + Buffer.from(JSON.stringify({ sub: uid })).toString('base64url') + '.x';
const SITZUNG = { access_token: token(UID), refresh_token: 'test-r', expires_at: 9999999999, user: { id: UID, email: 'u1@example.invalid' } };
const NAMEN = { u1: 'Spieler_1', u2: 'Spieler_2' };
const PARTIE = 'such-1';
const iso = (ms) => new Date(ms).toISOString();

function neuerZustand() {
  // treffer: false = die Suche wartet (Bild der Gegnersuche); true = der Server meldet die Paarung mit PARTIE
  return { partien: new Map(), treffer: false, sucheSeit: null, unerwartet: [] };
}
function legePartieAn(z) {
  const c = new Chess(), jetzt = iso(Date.now());
  z.partien.set(PARTIE, { id: PARTIE, code: null, weiss: 'u1', schwarz: 'u2', erstellt_von: 'u2', gewertet: true, status: 'laeuft',
    fen: c.fen(), am_zug: 'w', zuege: '', ergebnis: null, grund: null, remis_angebot: null, bedenkzeit_s: 300, inkrement_s: 3,
    uhr_weiss_ms: 300000, uhr_schwarz_ms: 300000, letzter_zug_am: jetzt, erstellt_am: jetzt, aktualisiert_am: jetzt });
}

function bediener(z) {
  return async (route) => {
    const req = route.request(), url = new URL(req.url());
    let body = {}; try { body = req.postDataJSON() || {}; } catch (e) { body = {}; }
    const antwort = (d, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(d) });
    if (url.pathname.startsWith('/auth/v1/')) return antwort({ id: UID, email: UID + '@example.invalid' });
    if (url.pathname === '/rest/v1/profile') return antwort([{ user_id: UID, benutzername: NAMEN[UID] }]);
    if (url.pathname === '/rest/v1/partien_online') {
      if (url.searchParams.has('status')) return antwort([...z.partien.values()].filter((p) => p.status === 'beendet'));
      const p = z.partien.get((url.searchParams.get('id') || '').slice(3));
      return antwort(p ? [p] : []);
    }
    if (url.pathname === '/functions/v1/online-zug') {
      const q = z.partien.get(body.partie);
      if (!q || q.status !== 'laeuft') return antwort({ message: 'ONLINE_PARTIE_BEENDET' }, 409);
      const c = new Chess(q.fen);
      let m; try { m = c.move({ from: body.zug.slice(0, 2), to: body.zug.slice(2, 4), promotion: body.zug[4] }); } catch (e) { return antwort({ message: 'ONLINE_ZUG_ILLEGAL' }, 422); }
      Object.assign(q, { zuege: (q.zuege + ' ' + m.lan).trim(), fen: c.fen(), am_zug: c.turn(), letzter_zug_am: iso(Date.now()), aktualisiert_am: iso(Date.now()) });
      return antwort(q);
    }
    const rpc = (url.pathname.match(/\/rest\/v1\/rpc\/([a-z_]+)/) || [])[1];
    if (rpc) {
      const p = z.partien.get(body.partie);
      // Suche wie das neue SQL (Konzept "Zwei Ligen"): Wartezeit 120 s, damit waehrend des Bildes kein KI-Gegner kommt
      const wartet = () => ({ wartet: true, warte_s: 120, ki_ab_s: 60, seit: iso(z.sucheSeit), zeit: '5+3' });
      if (rpc === 'online_suche_start') { z.sucheSeit = Date.now(); return antwort(wartet()); }
      if (rpc === 'online_suche_stand') { if (z.treffer) { legePartieAn(z); return antwort({ partie: PARTIE }); } return antwort(wartet()); }
      if (rpc === 'online_suche_ende') return antwort({});
      if (rpc === 'online_meine') return antwort([...z.partien.values()].filter((q) => q.status !== 'beendet'));
      if (rpc === 'online_live_bewertung_frei') return antwort({ frei: true, rest: 1, unbegrenzt: false });
      // Buchung beim ersten eigenen Zug wie tests/online-ui.test.mjs (sonst zeigt das Bild "heute schon genutzt")
      if (rpc === 'online_live_bewertung_nutzen') return antwort({ ok: true, frei: true, rest: 0, unbegrenzt: false, gebucht: true });
      if (rpc === 'karte_melde_stufen') return antwort({});
      if (rpc === 'online_pruefe_zeit' && p) return antwort(p);
      if (rpc === 'online_gib_auf' && p) { Object.assign(p, { status: 'beendet', grund: 'aufgabe', ergebnis: '0-1', aktualisiert_am: iso(Date.now()) }); return antwort(p); }
      if (rpc === 'karte_der_partie') {
        const karte = (u) => ({ name: NAMEN[u], banner: 'saison-silber', titel: 'erfolg-feuertaufe', vitrine: [], motiv: 'Q', grund: 'standard', rahmen: 'ohne', kronen_stufe: 7, du: u === UID });
        return antwort(p ? { w: karte(p.weiss), s: karte(p.schwarz) } : {});
      }
      if (rpc === 'kronen_mein_stand') return antwort({ stufe: 7, kronen: 140, platz: 3, ziel: 120, n: 30, woche: '2026-11-09' });
      z.unerwartet.push(rpc);
      return antwort([]);
    }
    return antwort([]);
  };
}

function initSkript({ sitzung }) {
  try {
    if (!sessionStorage.getItem('bilder-start')) {
      sessionStorage.setItem('bilder-start', '1');
      localStorage.clear();
      localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(sitzung));
      // Aufgeben mit Rueckfrage statt 1 s Halten (Einstellung haltenAufgeben); aendert nur den Weg zum Ende
      localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ haltenAufgeben: false }));
    }
  } catch (e) { /* egal */ }
}

async function tippe(s, brettSel, uci) {
  for (const f of [uci.slice(0, 2), uci.slice(2, 4)]) {
    const r = await s.locator(`${brettSel} .feld[data-feld="${f}"]`).first().boundingBox();
    await s.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2);
    await warte(120);
  }
}
async function bestaetige(s) {
  const knoepfe = s.locator('.dialog-ort:not(.weg) .dialog-knoepfe button');
  if (await knoepfe.first().waitFor({ timeout: 3000 }).then(() => true).catch(() => false)) await knoepfe.last().click();
}
const sichtbar = (s, sel, ms = 15000) => s.waitForFunction((sel) => [...document.querySelectorAll(sel)].some((e) => !e.hidden && e.getClientRects().length > 0), sel, { timeout: ms })
  .then(() => true).catch(() => false);

const GERAETE = [['iphone-13', 390, 844], ['pc', 1280, 720]];
const SCHEMATA = [['hell', 'light', 'hell'], ['dunkel', 'dark', 'dunkel']];
const seitenfehler = [];

async function lauf(browser, [geraet, w, h], [wort, schema, modus]) {
  const gruppe = `${geraet} ${wort}`;
  const k = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: true, serviceWorkers: 'block',
    colorScheme: schema, locale: 'de-DE', timezoneId: 'Europe/Berlin' });
  const z = neuerZustand();
  await k.route('**/*.supabase.co/**', bediener(z));
  await k.addInitScript(initSkript, { sitzung: SITZUNG });
  const s = await k.newPage(); s.setDefaultTimeout(15000);
  s.on('pageerror', (e) => seitenfehler.push(`${gruppe}: ${e.message}`));
  const bild = async (teil) => {
    const datei = path.join(BILDER, `online-${geraet}-${wort}-${teil}.png`);
    const da = await s.screenshot({ path: datei }).then(() => true).catch(() => false);
    pruefe(`${gruppe}: Bild ${teil}`, da, datei);
  };
  try {
    // 1) Lobby: Tuer "Partie" mit dem Suchknopf (Konto vorhanden, Liga bekannt)
    await s.goto(BASIS + '#online');
    const lobby = await sichtbar(s, '[data-online="suchen"]:not([disabled])', 30000);
    pruefe(`${gruppe}: Lobby mit Suchknopf`, lobby);
    // Modus "Automatisch" folgt dem Geraet (colorScheme); gemessen am Seitengrund, den js/thema.js setzt
    const grund = await s.evaluate(() => getComputedStyle(document.body).backgroundColor);
    const hell = (grund.match(/\d+/g) || []).slice(0, 3).reduce((a, b) => a + Number(b), 0) > 3 * 128;
    pruefe(`${gruppe}: Modus ${modus} (Seitengrund ${grund})`, hell === (modus === 'hell'), grund);
    await warte(600);
    await bild('lobby');
    // 2) Gegnersuche: Ring mit Restzeit, "Jetzt gegen KI", Abbrechen
    await s.locator('[data-online="suchen"]').filter({ visible: true }).first().click();
    pruefe(`${gruppe}: Gegnersuche laeuft`, await sichtbar(s, '.on-suche'));
    await warte(1500);
    await bild('suche');
    // 3) Treffer: der Server paart, die Online-Partie oeffnet; ein eigener Zug, dann das Bild
    z.treffer = true;
    const partie = await s.waitForFunction(() => window.__online?.brett() && !window.__online.busy()
      && document.querySelector('.on-brett')?.getBoundingClientRect().width > 100, null, { timeout: 20000 }).then(() => true).catch(() => false);
    pruefe(`${gruppe}: Partie nach dem Treffer offen`, partie);
    await warte(2000); // Visitenkarten und Intro (js/ui/duell.js)
    await s.waitForFunction(() => !document.querySelector('.duell'), null, { timeout: 12000 }).catch(() => {});
    await warte(600);
    await tippe(s, '.on-brett', 'e2e4');
    await warte(1000);
    await bild('partie');
    // 4) Ergebnis: Aufgeben mit Rueckfrage
    await s.locator('[data-online="aufgeben"]').filter({ visible: true }).first().click();
    await bestaetige(s);
    pruefe(`${gruppe}: Ergebnis sichtbar`, await sichtbar(s, '.on-ergebnis'));
    await warte(1200);
    await bild('ergebnis');
  } catch (e) {
    pruefe(`${gruppe}: Ablauf ohne Abbruch`, false, e.message.split('\n')[0]);
  }
  if (z.unerwartet.length) console.log(`  Hinweis ${gruppe}: unbekannte RPCs ${[...new Set(z.unerwartet)].join(', ')}`);
  await k.close().catch(() => {});
}

let browser;
try {
  browser = await browserTyp(pw).launch({ headless: true });
  for (const g of GERAETE) for (const sc of SCHEMATA) await lauf(browser, g, sc);
} finally {
  if (browser) await browser.close().catch(() => {});
  server.close();
}
pruefe('keine Seitenfehler', seitenfehler.length === 0, seitenfehler);
console.log(`\nBilder in ${BILDER}\n${ok}/${gesamt} Pruefungen bestanden`);
process.exit(ok === gesamt ? 0 : 1);
