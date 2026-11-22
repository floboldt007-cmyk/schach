// Funktionsprobe Online-Ende (fc-07:30): fest im Repo statt Wegwerf-Werkzeug (R20-Kritik/ergebnis-matrix/werkzeug/ab-0645
// und mess.mjs von 43 und 7b). ZWEI Browser-Sitzungen (Konto u1 und u2) spielen gegen EINEN nachgebauten Server (Kopf wie
// tests/online-ranked-probe.test.mjs, dazu Zeitablauf wie das SQL und Kronen je Ergebnis), auf iPhone 13 und PC.
//   Partie endet durch Matt (Narrenmatt), Zeitablauf (Weiss nach 2 Halbzuegen), Aufgeben nach Zug 10 (20 Halbzuege) und
//   Remis per Angebot; je Seite (Gewinner, Verlierer; beim Remis beide):
//   - richtiger Text (Wort und Grund), genau ein Hauptknopf, keine leeren Rahmen und keine doppelten Knoepfe
//   - Kronen-Zeile mit der Aenderung dieser Partie (+20 / −10 / +5 wie der Server unten bucht)
//   - "Meine Partien" fuehrt zur Online-Seite; eine neue Suche danach ergibt GENAU EINE neue Partie, nicht die alte
//   Raetsel-Duell-Ende fuer Niederlage und Remis (Sieg steht in tests/raetsel-duell-ui.test.mjs): Wort, Stand, Kronen,
//   Krone beim Sieger, beide Bilder geladen, Nochmal und Fertig je einmal, keine leeren Rahmen
//
//   node tests/online-ende.test.mjs
//   BILDER=<ordner> node tests/online-ende.test.mjs    je Blatt ein Bild (online-<ende>-<rolle>-<geraet>, duell-<erg>-<geraet>)
//   PORT=9797 node tests/online-ende.test.mjs          Port des Testservers (sonst: frei)
//   GERAETE=pc node tests/online-ende.test.mjs         nur ein Geraet (iphone13, pc)
//
// Playwright: PLAYWRIGHT_PFAD, sonst 'playwright', sonst /opt/node-tools/node_modules/playwright.
import http from 'node:http';
import { createRequire } from 'node:module';
import { readFileSync, readdirSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Chess } from '../vendor/chess/chess.js';
import { browserTyp } from './browser.mjs';

const require = createRequire(import.meta.url);
let pw;
for (const p of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
  try { pw = require(p); break; } catch (e) { /* naechster */ }
}
if (!pw) throw new Error('Playwright fehlt');
const BILDER = process.env.BILDER || null;
if (BILDER) mkdirSync(BILDER, { recursive: true });
const GROESSE = { iphone13: { width: 390, height: 844 }, pc: { width: 1280, height: 800 } };
const GERAETE = (process.env.GERAETE || 'iphone13,pc').split(',').filter((g) => GROESSE[g]);
const root = fileURLToPath(new URL('../', import.meta.url));
const typen = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.json': 'application/json',
  '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' };
const server = http.createServer((req, res) => {
  const p = path.resolve(root, '.' + new URL(req.url, 'http://test').pathname.replace(/\/$/, '/index.html'));
  if (!p.startsWith(root)) { res.writeHead(403); res.end(); return; }
  try { res.writeHead(200, { 'Content-Type': typen[path.extname(p)] || 'application/octet-stream' }); res.end(readFileSync(p)); }
  catch (e) { res.writeHead(404); res.end(); }
});
const PORT = Number(process.env.PORT) || await (await import('./freier-port.mjs')).freierPort();
await new Promise(r => server.listen(PORT, '127.0.0.1', r));

// Regel "laufende Partie statt neuer" aus dem SQL (wie tests/online-ranked-probe.test.mjs)
function partieRegelAusSql() {
  const ordner = path.join(root, 'supabase');
  const rang = f => (f === 'kronen-schema.sql' ? 0 : f === 'zwei-ligen-schema.sql' ? 1 : 2);
  const dateien = readdirSync(ordner).filter(f => /-schema\.sql$/.test(f)).sort((a, b) => rang(a) - rang(b) || a.localeCompare(b));
  let rumpf = null;
  for (const f of dateien) {
    const text = readFileSync(path.join(ordner, f), 'utf8');
    const re = /create or replace function public\.online_suche_partie\(uid uuid\)[\s\S]*?\$\$([\s\S]*?)\$\$/gi;
    for (let m; (m = re.exec(text));) rumpf = m[1];
  }
  if (!rumpf) throw new Error('online_suche_partie in supabase/*-schema.sql nicht gefunden');
  const fenster = rumpf.match(/interval\s+'(\d+)\s+seconds?'/i);
  return { fensterS: fenster ? Number(fenster[1]) : null };
}
const REGEL = partieRegelAusSql();

const token = uid => 'a.' + Buffer.from(JSON.stringify({ sub: uid })).toString('base64url') + '.x';
const sitzungVon = uid => ({ access_token: token(uid), refresh_token: 'test-r-' + uid, expires_at: 9999999999, user: { id: uid, email: uid + '@example.invalid' } });
const NAMEN = { u1: 'Spieler_1', u2: 'Spieler_2' };
const START_FEN = new Chess().fen();
// Kronen je Ergebnis einer gewerteten Partie (die Zahl selbst ist Sache des SQL; hier zaehlt, dass das Blatt sie zeigt)
const KRONEN = { sieg: 20, niederlage: -10, remis: 5 };

let ok = 0, gesamt = 0, stamp = Date.now(), nummer = 0;
const partien = new Map(), schlange = new Map(), fehler = [], unerwartet = [];
const jetzt = () => Date.now();
const aktualisieren = p => { p.aktualisiert_am = new Date(Math.max(++stamp, jetzt())).toISOString(); stamp = Date.parse(p.aktualisiert_am); return p; };
const farbeVon = (p, uid) => (p.weiss === uid ? 'w' : p.schwarz === uid ? 'b' : null);
const chessVon = p => { const c = new Chess(); for (const m of p.zuege.split(' ').filter(Boolean)) c.move({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] }); return c; };
const laufendeVon = uid => [...partien.values()].filter(p => p.gewertet && p.status === 'laeuft' && farbeVon(p, uid));
const artFuer = (p, uid) => (p.ergebnis === '1/2-1/2' ? 'remis' : (p.ergebnis === '1-0' ? 'w' : 'b') === farbeVon(p, uid) ? 'sieg' : 'niederlage');
const kronenVon = uid => 140 + [...partien.values()].filter(p => p.status === 'beendet' && p.ergebnis && farbeVon(p, uid))
  .reduce((n, p) => n + KRONEN[artFuer(p, uid)], 0);

function pruefe(name, gut, detail = '') {
  gesamt++; if (gut) ok++;
  const d = typeof detail === 'string' ? detail : JSON.stringify(detail);
  console.log(`${gut ? 'ok    ' : 'FEHLER'} ${name}${!gut && d ? ' ' + d.slice(0, 600) : ''}`);
  return gut;
}

// ---- Server-Attrappe (ein Zustand fuer beide Konten) ----
function sucheLaufende(uid) {
  const grenze = REGEL.fensterS == null ? -Infinity : jetzt() - REGEL.fensterS * 1000;
  return laufendeVon(uid).filter(p => Date.parse(p.erstellt_am) > grenze).sort((a, b) => Date.parse(b.erstellt_am) - Date.parse(a.erstellt_am))[0] || null;
}
function paaren(uid) {
  const ich = schlange.get(uid); if (!ich) return null;
  const g = [...schlange.entries()].filter(([u, q]) => u !== uid && q.zeit === ich.zeit).sort((a, b) => a[1].seit - b[1].seit)[0];
  if (!g) return null;
  const [w, s] = Math.random() < 0.5 ? [uid, g[0]] : [g[0], uid];
  const p = aktualisieren({ id: 'ranked-' + ++nummer, code: null, weiss: w, schwarz: s, erstellt_von: g[0], gewertet: true, status: 'laeuft',
    fen: START_FEN, am_zug: 'w', zuege: '', ergebnis: null, grund: null, remis_angebot: null, bedenkzeit_s: 300, inkrement_s: 3,
    uhr_weiss_ms: 300000, uhr_schwarz_ms: 300000, letzter_zug_am: new Date().toISOString(), erstellt_am: new Date().toISOString() });
  partien.set(p.id, p); schlange.delete(uid); schlange.delete(g[0]);
  return p;
}
const warten = uid => { const q = schlange.get(uid); return q ? { wartet: true, seit: new Date(q.seit).toISOString(), warte_s: 30, ki_ab_s: 1, zeit: '5+3' } : null; };

async function bediene(route) {
  const req = route.request(), url = new URL(req.url());
  let body = {}; try { body = req.postDataJSON() || {}; } catch (e) { body = {}; }
  const auth = (req.headers().authorization || '').replace(/^Bearer\s+/, '');
  let uid = null; try { uid = JSON.parse(Buffer.from(auth.split('.')[1] || '', 'base64url').toString()).sub || null; } catch (e) { uid = null; }
  const antwort = (d, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(d) });
  const absage = (status, message) => antwort({ message, fehler: message }, status);
  if (url.pathname.startsWith('/auth/v1/')) return antwort(uid ? { id: uid, email: uid + '@example.invalid' } : {});
  if (url.pathname === '/rest/v1/spielstaende' || url.pathname === '/rest/v1/sonderstuecke' || /freigabe/.test(url.pathname)) return antwort([]);
  if (url.pathname === '/rest/v1/profile') return antwort(uid ? [{ user_id: uid, benutzername: NAMEN[uid] }] : []);
  if (url.pathname === '/rest/v1/partien_online') {
    if (url.searchParams.has('status')) return antwort([...partien.values()].filter(p => p.status === 'beendet' && farbeVon(p, uid)));
    const p = partien.get((url.searchParams.get('id') || '').slice(3));
    const seit = (url.searchParams.get('aktualisiert_am') || '').slice(3);
    return antwort(p && farbeVon(p, uid) && (!seit || p.aktualisiert_am > seit) ? [p] : []);
  }
  if (!uid) return absage(401, 'KRONEN_ANMELDUNG');
  const rpc = url.pathname.split('/').at(-1), p = partien.get(body.partie);
  if (rpc === 'kronen_mein_stand') return antwort({ stufe: 7, kronen: kronenVon(uid), platz: 3, ziel: 120, n: 30, woche: '2026-11-16' });
  if (rpc === 'bestaetigte_namen') return antwort([]); // R27 Haken fremder Namen (js/konto.js): hier ohne bestaetigten Namen
  if (rpc === 'online_suche_start') {
    const lauf = sucheLaufende(uid); if (lauf) return antwort({ partie: lauf.id });
    const alt = schlange.get(uid); schlange.set(uid, { zeit: '5+3', seit: alt ? alt.seit : jetzt() });
    const neu = paaren(uid); if (neu) return antwort({ partie: neu.id });
    return antwort(warten(uid));
  }
  if (rpc === 'online_suche_stand') {
    const lauf = sucheLaufende(uid) || paaren(uid); if (lauf) return antwort({ partie: lauf.id });
    return antwort(warten(uid) || { wartet: true });
  }
  if (rpc === 'online_suche_ende') { schlange.delete(uid); return antwort({}); }
  if (rpc === 'online_live_bewertung_frei') return antwort({ frei: true, rest: 1, unbegrenzt: false });
  if (rpc === 'online_live_bewertung_nutzen') return antwort({ ok: true, frei: true, rest: 0, unbegrenzt: false, gebucht: true });
  if (rpc === 'online_meine') return antwort([...partien.values()].filter(q => q.status !== 'beendet' && farbeVon(q, uid)));
  if (url.pathname === '/functions/v1/online-zug') {
    const q = partien.get(body.partie);
    if (!q || q.status !== 'laeuft') return absage(409, 'ONLINE_PARTIE_BEENDET');
    if (farbeVon(q, uid) !== q.am_zug) return absage(409, 'ONLINE_NICHT_DEIN_ZUG');
    const c = chessVon(q); let m;
    try { m = c.move({ from: body.zug.slice(0, 2), to: body.zug.slice(2, 4), promotion: body.zug[4] }); } catch (e) { return absage(422, 'ONLINE_ZUG_ILLEGAL'); }
    const halb = q.zuege.split(' ').filter(Boolean).length, feld = q.am_zug === 'w' ? 'uhr_weiss_ms' : 'uhr_schwarz_ms';
    if (halb >= 2) q[feld] = Math.max(0, q[feld] - (jetzt() - Date.parse(q.letzter_zug_am))) + q.inkrement_s * 1000;
    q.zuege = (q.zuege + ' ' + m.lan).trim(); q.fen = c.fen(); q.am_zug = c.turn(); q.letzter_zug_am = new Date().toISOString(); q.remis_angebot = null;
    if (c.isGameOver()) { q.status = 'beendet'; q.ergebnis = c.isCheckmate() ? (c.turn() === 'b' ? '1-0' : '0-1') : '1/2-1/2'; q.grund = c.isCheckmate() ? 'matt' : 'patt'; }
    return antwort(aktualisieren(q));
  }
  if (rpc === 'online_biete_remis' && p && p.status === 'laeuft') { p.remis_angebot = farbeVon(p, uid); return antwort(aktualisieren(p)); }
  if (rpc === 'online_nimm_remis_an' && p && p.status === 'laeuft') {
    if (!p.remis_angebot || p.remis_angebot === farbeVon(p, uid)) return absage(400, 'ONLINE_KEIN_ANGEBOT');
    Object.assign(p, { status: 'beendet', ergebnis: '1/2-1/2', grund: 'remis', remis_angebot: null }); return antwort(aktualisieren(p));
  }
  if (rpc === 'online_gib_auf' && p && p.status === 'laeuft') {
    Object.assign(p, { status: 'beendet', grund: 'aufgabe', ergebnis: farbeVon(p, uid) === 'w' ? '0-1' : '1-0' }); return antwort(aktualisieren(p));
  }
  if (rpc === 'online_pruefe_zeit' && p) {
    // wie das SQL: ab dem 2. Halbzug ist die Uhr der Seite am Zug abgelaufen -> Zeit (Matrix von 43, ab-0645/bau.cjs)
    const feldZ = p.am_zug === 'w' ? 'uhr_weiss_ms' : 'uhr_schwarz_ms';
    if (p.status === 'laeuft' && p.zuege.split(' ').filter(Boolean).length >= 2 && p[feldZ] - (jetzt() - Date.parse(p.letzter_zug_am)) <= 0) {
      Object.assign(p, { status: 'beendet', grund: 'zeit', ergebnis: p.am_zug === 'w' ? '0-1' : '1-0', [feldZ]: 0 }); aktualisieren(p);
    }
    return antwort(p);
  }
  if (rpc === 'karte_melde_stufen' || rpc === 'karte_waehle') return antwort({ taler: 0, stufen: {}, banner: ['start'], wahl: { banner: 'start' } });
  if (rpc === 'karte_der_partie') {
    const karte = (u) => ({ name: NAMEN[u] || 'Gegner', banner: 'saison-silber', titel: 'erfolg-feuertaufe', vitrine: [], motiv: 'Q', grund: 'standard', rahmen: 'ohne', kronen_stufe: 7, du: u === uid });
    return antwort(p ? { w: karte(p.weiss), s: karte(p.schwarz) } : {});
  }
  if (rpc === 'saison_karte_der_partie') return antwort({ w: { abzeichen: null, titel: null }, s: { abzeichen: null, titel: null } });
  // Effekte vom Gegner (R26, tests/r26-gegner-effekte.test.mjs): nur Kennungen melden, beide Seiten ohne Besitz
  if (rpc === 'effekte_waehle') return antwort(true);
  if (rpc === 'effekte_der_partie') return antwort({ w: { figuren: null, zug: null, finisher: null }, s: { figuren: null, zug: null, finisher: null } });
  unerwartet.push(`${uid} ${req.method()} ${url.pathname}`); return antwort([]);
}

// ---- Browser ----
let browser;
const kontexte = [];
async function neuerKontext(uid, viewport) {
  const k = await browser.newContext({ viewport, hasTouch: true, serviceWorkers: 'block', locale: 'de-DE', timezoneId: 'Europe/Berlin', colorScheme: 'light' });
  kontexte.push(k);
  await k.route('**/*.supabase.co/**', bediene);
  await k.addInitScript(({ s }) => {
    localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(s));
    localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ klang: false, bewegung: 'aus' }));
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
  }, { s: sitzungVon(uid) });
  // Lage des Bretts je Bild ab seinem Erscheinen, nur beobachtet (bereit(): Frist und Deckel fuer den Sprung)
  await k.addInitScript(() => {
    const uhr = (window.__brettUhr = { el: null, t0: 0, zuletzt: 0, lage: null, lagen: [], gemessen: false });
    const schau = () => {
      const b = document.querySelector('.on-brett'), t = performance.now();
      if (b !== uhr.el) Object.assign(uhr, { el: b, t0: t, zuletzt: t, lage: null, lagen: [], gemessen: false });
      if (b) {
        const r = b.getBoundingClientRect(), lage = [r.x, r.y, r.width].map(Math.round).join();
        if (lage !== uhr.lage) { uhr.lage = lage; uhr.zuletzt = t; uhr.lagen = [...uhr.lagen, `${Math.round(t - uhr.t0)} ms ${lage}`].slice(-6); }
      }
      requestAnimationFrame(schau);
    };
    requestAnimationFrame(schau);
  });
  const seite = await k.newPage(); seite.setDefaultTimeout(15000);
  seite.on('pageerror', e => fehler.push(`${uid}: ${e.message}`));
  seite.uid = uid;
  return seite;
}
const START = () => `http://127.0.0.1:${PORT}/?test&kern&erw=pakete/online/index`;
// erst bereit, wenn genau ein Screen steht und das Brett Flaeche hat (wie tests/online-ranked-probe.test.mjs)
// und erst, wenn das Brett zwei Bilder lang dieselbe Lage hat: auf dem iPhone steht es beim Erscheinen ein Bild lang mit 280 statt 384 px
// (gemessen 20.11.2026, Chromium und WebKit, 16 bis 24 ms); ein Tipp genau dann traf das alte Feld und ging verloren
async function bereit(s) {
  await s.waitForFunction(() => window.__online?.brett() && !window.__online.busy()
    && document.querySelectorAll('.screen').length === 1 && document.querySelector('.on-brett')?.getBoundingClientRect().width > 100, null, { timeout: 15000 });
  // Frist (Nachpruefung f2, M11): ein Brett, das nie ruhig wird, hielt die Probe ohne Meldung an
  const sprung = await s.evaluate((frist) => new Promise((fertig, scheitern) => {
    let vorher = null, gleich = 0;
    const ende = performance.now() + frist, uhr = window.__brettUhr;
    const schau = () => {
      const r = document.querySelector('.on-brett').getBoundingClientRect();
      const lage = [r.x, r.y, r.width].map(Math.round).join();
      gleich = lage === vorher ? gleich + 1 : 0; vorher = lage;
      if (gleich >= 2) {
        // je Brett einmal: wie lange es vom Erscheinen bis zur letzten Lageaenderung sprang (M13: Warten verdeckte jede Laenge)
        if (!uhr || uhr.gemessen) { fertig(null); return; }
        uhr.gemessen = true;
        fertig({ ms: Math.round(uhr.zuletzt - uhr.t0), lagen: uhr.lagen.join(' / ') });
      } else if (performance.now() > ende) scheitern(new Error(`Brett nach ${frist / 1000} s nicht ruhig: ${(uhr?.lagen || [lage]).join(' / ')}`));
      else requestAnimationFrame(schau);
    };
    schau();
  }), RUHE_FRIST_MS);
  if (sprung) spruenge.push({ wer: s.uid, ...sprung });
}
// Ein Brett steht nach dem Erscheinen spaetestens nach einem Bild still. Gemessen 20.11.2026, 16 Bretter je Lauf: auf
// so/R25-brett-start c3e02f03 0 ms (Chromium und WebKit); davor sprang es bei "Bewegung aus" bis 71 ms (Chromium) bzw.
// 120 ms (WebKit), 280 -> 384 px
const RUHE_FRIST_MS = 3000;
const SPRUNG_DECKEL_MS = 17;
const spruenge = [];
const sucheBereit = s => s.waitForFunction(() => ['bereit', 'laufend'].includes(document.querySelector('.on-art[data-art="partie"]')?.dataset.zustand), null, { timeout: 15000 });
async function tippe(s, uci) {
  for (const f of [uci.slice(0, 2), uci.slice(2, 4)]) {
    const r = await s.locator(`.on-brett .feld[data-feld="${f}"]`).boundingBox();
    await s.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2);
  }
}
// Beide suchen; liefert die Partie-ID, in der beide landen (oder null)
async function beideSuchen(a, b) {
  await a.locator('[data-online="suchen"]').click();
  await a.locator('.on-suche:not([hidden])').waitFor();
  await b.locator('[data-online="suchen"]').click();
  const ids = await Promise.all([a, b].map(s => s.waitForFunction(() => window.__online?.brett() && window.__online.partie()?.status === 'laeuft'
    && window.__online.partie().id, null, { timeout: 12000 }).then(h => h.jsonValue()).catch(() => null)));
  return ids[0] && ids[0] === ids[1] ? ids[0] : null;
}
const sieht = (s, uci) => s.waitForFunction(u => (window.__online?.partie()?.zuege || '').split(' ').includes(u), uci, { timeout: 10000 }).then(() => true).catch(() => false);
// Tipps je Zug der letzten spiele()-Runde; jeder Zug muss beim ersten Tipp ankommen (Pruefung im Hauptteil, Kaltreview f2:
// eine stille Wiederholung verdeckte ein Brett, das Tipps verschluckt). Die Wiederholung unten haelt die Probe nur am Laufen,
// damit ein verschluckter Tipp als Zahl sichtbar wird statt als Abbruch
let versuche = [];
async function spiele(weiss, schwarz, zuege) {
  versuche = [];
  for (let i = 0; i < zuege.length; i++) {
    const [am, gegen] = i % 2 === 0 ? [weiss, schwarz] : [schwarz, weiss];
    let n = 0;
    while (n < 3) {
      n++;
      await bereit(am); await tippe(am, zuege[i]);
      if (await am.waitForFunction(u => (window.__online?.partie()?.zuege || '').split(' ').includes(u), zuege[i], { timeout: 3000 }).then(() => true, () => false)) break;
      await am.evaluate(() => document.activeElement?.blur?.());
    }
    versuche.push(n);
    if (!(await sieht(gegen, zuege[i]))) {
      const st = await am.evaluate(() => ({ id: window.__online?.partie()?.id, zuege: window.__online?.partie()?.zuege, busy: window.__online?.busy(), screens: document.querySelectorAll('.screen').length,
        dialog: !!document.querySelector('.dialog-ort:not(.weg)'), blatt: !!document.querySelector('.ergebnis-overlay:not([hidden])') }));
      throw new Error(`Zug ${i + 1} ${zuege[i]} kam nicht an ${JSON.stringify({ am: am.uid, st, server: [...partien.values()].filter((p) => p.status === 'laeuft').map((p) => [p.id, p.zuege]) })}`);
    }
  }
}
const meineFarbe = s => s.evaluate(() => (window.__online.partie().weiss === JSON.parse(localStorage.getItem('schach-arena:konto:sitzung')).user.id ? 'w' : 'b'));
const blattOffen = s => s.waitForFunction(() => window.__online?.partie()?.status === 'beendet'
  && [...document.querySelectorAll('.ergebnis-overlay')].some(o => !o.hidden && o.getBoundingClientRect().height > 50), null, { timeout: 25000 }).then(() => true).catch(() => false);

// Messung eines sichtbaren Ergebnisblatts (werkzeug/mess.mjs von 7b, ohne Abschneide-Teil): Wort, Grund, Kronen-Zeile,
// leere Rahmen (sichtbar, ueber 20 px, ohne Text, Bild, Flaeche oder Rand), doppelte Knoepfe, Hauptknoepfe
const messeBlatt = (s, wahl) => s.evaluate((wahl) => {
  const o = [...document.querySelectorAll(wahl)].find((e) => !e.hidden && e.getClientRects().length);
  if (!o) return null;
  const sicht = (e) => { const r = e.getBoundingClientRect(); const st = getComputedStyle(e); return r.width > 0 && r.height > 0 && st.visibility === 'visible' && +st.opacity > 0.05; };
  const eigenInhalt = (e) => { const st = getComputedStyle(e);
    if ([...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) return true;
    if (/^(IMG|SVG|CANVAS|VIDEO|INPUT|svg)$/i.test(e.tagName)) return true;
    if (st.backgroundImage !== 'none') return true;
    const bg = st.backgroundColor.match(/[\d.]+/g); if (bg && (bg[3] === undefined || +bg[3] > 0.05)) return true;
    if (parseFloat(st.borderTopWidth) + parseFloat(st.borderBottomWidth) + parseFloat(st.borderLeftWidth) > 0 && st.borderTopStyle !== 'none') return true;
    return false; };
  const hatInhalt = (e) => eigenInhalt(e) || [...e.querySelectorAll('*')].some((c) => sicht(c) && eigenInhalt(c));
  const name = (e) => (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).join('.') : e.tagName.toLowerCase());
  const leer = [...o.querySelectorAll('*')].filter((e) => !e.closest('svg') && sicht(e) && e.getBoundingClientRect().height > 20 && e.getBoundingClientRect().width > 20 && !hatInhalt(e))
    .filter((e, i, a) => !a.some((x) => x !== e && x.contains(e))).map((e) => `${name(e)} h${Math.round(e.getBoundingClientRect().height)}`);
  const knoepfe = [...o.querySelectorAll('button, a[href]')].filter(sicht).map((e) => ({ t: e.textContent.replace(/\s+/g, ' ').trim(), primaer: e.classList.contains('primaer') }));
  const zaehl = {}; for (const kn of knoepfe) if (kn.t) zaehl[kn.t] = (zaehl[kn.t] || 0) + 1;
  const kr = o.querySelector('.on-erg-kronen');
  return { wort: o.querySelector('.erg-wort')?.textContent.trim() || '', unter: o.querySelector('.erg-unter')?.textContent.replace(/\s+/g, ' ').trim() || '',
    // Zahl und Wort stehen in eigenen Elementen (b, span), der Abstand kommt aus dem CSS
    kronen: kr && !kr.hidden && kr.getClientRects().length ? [...kr.childNodes].map((n) => n.textContent.trim()).filter(Boolean).join(' ') : null,
    leer, doppelt: Object.entries(zaehl).filter(([, n]) => n > 1).map(([t, n]) => `${t} x${n}`),
    haupt: knoepfe.filter((x) => x.primaer).map((x) => x.t), knoepfe: knoepfe.map((x) => x.t).filter(Boolean) };
}, wahl);

const WORT = { sieg: 'Sieg!', niederlage: 'Niederlage', remis: 'Remis' };
const GRUND = { matt: 'Schachmatt', zeit: 'Zeit abgelaufen', aufgabe: 'Aufgabe', remis: 'Remis vereinbart' };
const KRONEN_TEXT = { sieg: '+20 Kronen', niederlage: '−10 Kronen', remis: '+5 Kronen' };
async function pruefeBlatt(s, g, ende, rolle, art, grund) {
  const offen = await blattOffen(s);
  // die Kronen-Zeile kommt nach der zweiten Abfrage von kronen_mein_stand (js/ui/online.js zeigeKronen)
  await s.waitForFunction(() => { const k = document.querySelector('.ergebnis-overlay:not([hidden]) .on-erg-kronen'); return k && !k.hidden; }, null, { timeout: 8000 }).catch(() => {});
  const m = offen ? await messeBlatt(s, '.ergebnis-overlay') : null;
  const n = `${g} ${ende} ${rolle}`;
  if (BILDER) await s.screenshot({ path: path.join(BILDER, `online-${ende}-${rolle}-${g}.png`) }).catch(() => {});
  pruefe(`${n}: Ergebnisblatt offen`, !!m, { offen });
  if (!m) return;
  pruefe(`${n}: Text "${WORT[art]}" / "${GRUND[grund]}"`, m.wort === WORT[art] && m.unter === GRUND[grund], { wort: m.wort, unter: m.unter });
  pruefe(`${n}: genau ein Hauptknopf, keine doppelten Knoepfe`, m.haupt.length === 1 && m.doppelt.length === 0, { haupt: m.haupt, doppelt: m.doppelt, knoepfe: m.knoepfe });
  pruefe(`${n}: keine leeren Rahmen`, m.leer.length === 0, m.leer);
  pruefe(`${n}: Kronen-Zeile "${KRONEN_TEXT[art]}"`, m.kronen === KRONEN_TEXT[art], { kronen: m.kronen });
}

// Raetsel-Duell (Tuer "3 Minuten"): ein in diesem Tab laufendes Duell (sessionStorage, js/ui/raetsel-duell.js ladeLauf)
// kennt der Server als beendet; die Seite zeigt sofort die Ende-Karte
const DUELL = '7d0c9a52-1b3e-4f6a-9c8d-2e1f0a9b8c7d';
const DUELL_UID = '0f8b6c1e-2d3a-4b5c-8d9e-0a1b2c3d4e5f';
async function duellEnde(g, erg) {
  const k = await browser.newContext({ viewport: GROESSE[g], hasTouch: true, serviceWorkers: 'block', locale: 'de-DE', colorScheme: 'light' });
  kontexte.push(k);
  const ich = erg === 'niederlage' ? 1 : 2, gegner = erg === 'niederlage' ? 3 : 2;
  const iso = (ms) => new Date(ms).toISOString(), start = Date.now() - 200000;
  const stand = { duell: DUELL, art: 'ki', status: 'beendet', jetzt: iso(Date.now()), start_am: iso(start),
    ich: { geloest: ich, fehler: 1, ende_am: iso(start + 175000) }, gegner: { geloest: gegner, fehler: 0, ende_am: iso(start + 180000), ki: true, elo: 1200 },
    raetsel: null, ergebnis: erg, kronen_delta: KRONEN[erg] };
  await k.route('**/*.supabase.co/**', (r) => {
    const name = (r.request().url().match(/\/rest\/v1\/rpc\/([a-z_]+)/) || [])[1];
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(name === 'duell_stand' ? stand : []) });
  });
  await k.addInitScript(({ s, duell }) => {
    if (sessionStorage.getItem('probe-start')) return;
    sessionStorage.setItem('probe-start', '1');
    localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(s));
    localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ klang: false, bewegung: 'aus' }));
    sessionStorage.setItem('schach-arena:raetsel-duell:laufend', JSON.stringify({ id: duell, reihe: ['g', 'r', 'g'], um: Date.now() }));
  }, { s: { ...sitzungVon(DUELL_UID), user: { id: DUELL_UID, email: 'probe@example.invalid' } }, duell: DUELL });
  const s = await k.newPage(); s.setDefaultTimeout(15000);
  s.on('pageerror', e => fehler.push(`duell: ${e.message}`));
  await s.goto(`http://127.0.0.1:${PORT}/index.html?test#raetsel-duell`);
  const da = await s.waitForSelector('.screen.raetsel-duell[data-phase="beendet"] .rd-ende', { timeout: 20000 }).then(() => true, () => false);
  // Bilder: das eigene (Profilbild, SVG) und das des KI-Gegners (img) muessen geladen sein
  await s.waitForFunction(() => [...document.querySelectorAll('.rd-ende img')].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 8000 }).catch(() => {});
  const n = `${g} Duell ${erg}`;
  pruefe(`${n}: Ende-Karte steht`, da);
  if (!da) { await k.close(); return; }
  const e = await s.evaluate(() => {
    const karte = document.querySelector('.rd-ende');
    const seiten = [...karte.querySelectorAll('.rd-ende-wer')];
    const bild = (w) => { const i = w.querySelector('img'); const sv = w.querySelector('svg:not(.rd-krone svg)');
      return !!((i && i.complete && i.naturalWidth > 0 && i.getClientRects().length) || (sv && sv.getClientRects().length)); };
    return { erg: karte.dataset.ergebnis, titel: karte.querySelector('h2')?.textContent.trim(), gross: karte.querySelector('.rd-gross')?.textContent.trim(),
      kronen: karte.querySelector('.rd-kronen')?.textContent.trim(),
      krone: seiten.map((w) => !!w.querySelector('.rd-krone')), bilder: seiten.map(bild),
      knoepfe: [...karte.querySelectorAll('button')].filter((b) => b.getClientRects().length).map((b) => b.textContent.trim()) };
  });
  const m = await messeBlatt(s, '.rd-ende');
  if (BILDER) await s.screenshot({ path: path.join(BILDER, `duell-${erg}-${g}.png`) }).catch(() => {});
  const titel = { niederlage: 'Verloren', remis: 'Unentschieden' }[erg];
  pruefe(`${n}: "${titel}", ${ich} : ${gegner}, "${KRONEN_TEXT[erg]}"`, e.erg === erg && e.titel === titel && e.gross === `${ich} : ${gegner}` && e.kronen === KRONEN_TEXT[erg], e);
  pruefe(`${n}: Krone ${erg === 'niederlage' ? 'nur beim Gegner' : 'bei keinem'}`, JSON.stringify(e.krone) === JSON.stringify(erg === 'niederlage' ? [false, true] : [false, false]), e.krone);
  pruefe(`${n}: beide Bilder geladen und sichtbar`, e.bilder.length === 2 && e.bilder.every(Boolean), e.bilder);
  pruefe(`${n}: Nochmal und Fertig je einmal, keine leeren Rahmen`, JSON.stringify(e.knoepfe) === JSON.stringify(['Nochmal', 'Fertig']) && m && m.leer.length === 0, { knoepfe: e.knoepfe, leer: m && m.leer });
  await k.close();
}

try {
  browser = await browserTyp(pw).launch({ headless: true });
  for (const g of GERAETE) {
    // jedes Geraet beginnt mit leerem Server (die letzte neue Suche hat eine laufende Partie derselben Konten hinterlassen)
    partien.clear(); schlange.clear();
    const a = await neuerKontext('u1', GROESSE[g]), b = await neuerKontext('u2', GROESSE[g]);
    await Promise.all([a, b].map(async s => { await s.goto(START() + '#online'); await sucheBereit(s); }));
    let id = await beideSuchen(a, b);
    pruefe(`${g}: erste Paarung`, !!id);
    for (const ende of ['matt', 'zeit', 'aufgeben', 'remis']) {
      if (!id) break;
      const [weiss, schwarz] = (await meineFarbe(a)) === 'w' ? [a, b] : [b, a];
      if (ende === 'matt') {
        await spiele(weiss, schwarz, ['f2f3', 'e7e5', 'g2g4', 'd8h4']);
        await pruefeBlatt(schwarz, g, ende, 'gewinner', 'sieg', 'matt'); await pruefeBlatt(weiss, g, ende, 'verlierer', 'niederlage', 'matt');
      } else if (ende === 'zeit') {
        await spiele(weiss, schwarz, ['e2e4', 'e7e5']);
        // Weiss am Zug, Uhr fast leer: der Stand kommt per Abfrage zu beiden, die App reklamiert die Zeit
        const p = partien.get(id); Object.assign(p, { uhr_weiss_ms: 1500, letzter_zug_am: new Date().toISOString() }); aktualisieren(p);
        await pruefeBlatt(schwarz, g, ende, 'gewinner', 'sieg', 'zeit'); await pruefeBlatt(weiss, g, ende, 'verlierer', 'niederlage', 'zeit');
      } else if (ende === 'aufgeben') {
        await spiele(weiss, schwarz, 'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 c2c3 g8f6 d2d3 d7d6 b1d2 a7a6 a2a4 h7h6 h2h3 c8e6 b2b4 c5a7 d1e2 d8e7'.split(' '));
        await bereit(weiss);
        await weiss.locator('[data-online="aufgeben"]').click();
        const knoepfe = weiss.locator('.dialog-ort:not(.weg) .dialog-knoepfe button');
        await knoepfe.first().waitFor(); await knoepfe.last().click();
        await pruefeBlatt(schwarz, g, ende, 'gewinner', 'sieg', 'aufgabe'); await pruefeBlatt(weiss, g, ende, 'verlierer', 'niederlage', 'aufgabe');
      } else {
        await spiele(weiss, schwarz, ['e2e4', 'e7e5']);
        await bereit(weiss); await weiss.locator('[data-online="remis"]').click();
        await schwarz.locator('[data-online="annehmen"]').click({ timeout: 10000 }).catch(() => {});
        await pruefeBlatt(weiss, g, ende, 'anbietend', 'remis', 'remis'); await pruefeBlatt(schwarz, g, ende, 'annehmend', 'remis', 'remis');
      }
      pruefe(`${g} ${ende}: jeder Zug kommt beim ersten Tipp an`, versuche.every((n) => n === 1), versuche);
      // "Meine Partien" fuehrt zur Online-Seite, die Suche steht wieder bereit
      const zurueck = await Promise.all([a, b].map(async s => {
        await s.locator('.ergebnis-overlay:not([hidden]) [data-online="liste-zurueck"]').click({ timeout: 5000 }).catch(() => {});
        return s.waitForFunction(() => /^#online/.test(location.hash) && document.querySelectorAll('.screen').length === 1
          && !!document.querySelector('.screen .on-art[data-art="partie"]') && !document.querySelector('.ergebnis-overlay:not([hidden])'), null, { timeout: 10000 })
          .then(() => true, () => false);
      }));
      pruefe(`${g} ${ende}: "Meine Partien" fuehrt beide zur Online-Seite`, zurueck.every(Boolean), zurueck);
      // neue Suche: genau eine neue Partie, nicht die alte, und keine zweite laufende je Konto
      await Promise.all([a, b].map(sucheBereit)).catch(() => {});
      const alt = id;
      id = await beideSuchen(a, b).catch(() => null);
      const laufend = ['u1', 'u2'].map((u) => laufendeVon(u).length);
      pruefe(`${g} ${ende}: neue Suche ergibt genau eine neue Partie`, !!id && id !== alt && partien.get(alt).status === 'beendet' && laufend.every((n) => n === 1),
        { alt, neu: id, laufend });
    }
    await a.context().close(); await b.context().close();
    for (const erg of ['niederlage', 'remis']) await duellEnde(g, erg);
  }
  pruefe(`jedes Brett steht nach dem Erscheinen spaetestens nach ${SPRUNG_DECKEL_MS} ms still (gemessen: ${spruenge.map((x) => x.ms).join(', ') || 'keins'})`,
    spruenge.length > 0 && spruenge.every((x) => x.ms <= SPRUNG_DECKEL_MS), spruenge.filter((x) => x.ms > SPRUNG_DECKEL_MS).slice(0, 3));
  pruefe('keine Seitenfehler oder unerwarteten API-Aufrufe', !fehler.length && !unerwartet.length, { fehler, unerwartet: [...new Set(unerwartet)] });
} catch (e) { pruefe('Ablauf ohne Abbruch', false, e.stack); }
finally {
  for (const k of kontexte) await k.close().catch(() => {});
  await browser?.close(); await new Promise(r => server.close(r));
}
console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
