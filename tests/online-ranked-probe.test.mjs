// Funktionsprobe Ranked (Feinschliff 11.11.2026, R1 Auftrag A): ZWEI Browser-Sitzungen (Konto u1 und u2) spielen gegen
// EINEN gemeinsamen nachgebauten Server. Kein Test schreibt ins echte Supabase-Projekt; jede Anfrage an *.supabase.co
// beantwortet die Attrappe unten, je nach Konto aus dem Bearer-Token.
//
//   node tests/online-ranked-probe.test.mjs                  Probe (bekannte Luecken melden sich als ROT, ohne Abbruch)
//   PROBE_STRENG=1 node tests/online-ranked-probe.test.mjs   auch die harten Pruefungen zaehlen (fuer die Reparatur)
//   PORT=9631 node tests/online-ranked-probe.test.mjs        eigener Port (Standard 8899)
//
// Harte Pruefungen (hart: true) stehen fuer die Befunde vom 11.11. abends (Laufzettel Feinschliff 2026-11-11, Befund 1, 3,
// 4, 5): zweite Partie, Zurueckkehren, Skin, Brettgroesse. Auf dem Stand live 297 sind sie rot. Ohne PROBE_STRENG
// erscheinen sie als "ROT-ERWARTET" und blockieren die CI nicht (tests/alle.mjs zaehlt nur Zeilen mit "FEHLER" und den
// Exitcode). Sobald die Reparatur steht, PROBE_STRENG=1 in der CI setzen oder die Markierung entfernen.
//
// Die Paarungsregel der Attrappe kommt aus dem SQL: online_suche_partie (die laufende gewertete Partie, die eine erneute
// Suche zurueckgibt statt einer neuen) wird aus supabase/*-schema.sql gelesen, samt Zeitfenster ("interval 'N seconds'").
// Aendert die Server-Reparatur die Funktion, folgt die Attrappe von selbst. Reihenfolge des Einspielens (Annahme):
// kronen-schema.sql, dann zwei-ligen-schema.sql, dann alle weiteren alphabetisch; die letzte Fassung gilt.
import http from 'node:http';
import { createRequire } from 'node:module';
import { readFileSync, readdirSync } from 'node:fs';
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
// Seit der Reparatur R1 (sammel-r1, 11.11.) streng als Vorgabe; PROBE_STRENG=0 zeigt die alte Probe-Ansicht
const STRENG = process.env.PROBE_STRENG !== '0';
const root = fileURLToPath(new URL('../', import.meta.url));
const typen = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const p = path.resolve(root, '.' + new URL(req.url, 'http://test').pathname.replace(/\/$/, '/index.html'));
  if (!p.startsWith(root)) { res.writeHead(403); res.end(); return; }
  try { res.writeHead(200, { 'Content-Type': typen[path.extname(p)] || 'application/octet-stream' }); res.end(readFileSync(p)); }
  catch (e) { res.writeHead(404); res.end(); }
});
const PORT = Number(process.env.PORT || 8899);
await new Promise(r => server.listen(PORT, '127.0.0.1', r));

// Regel "laufende Partie statt neuer" aus dem SQL (siehe Kopf)
function partieRegelAusSql() {
  const ordner = path.join(root, 'supabase');
  const rang = f => (f === 'kronen-schema.sql' ? 0 : f === 'zwei-ligen-schema.sql' ? 1 : 2);
  const dateien = readdirSync(ordner).filter(f => /-schema\.sql$/.test(f)).sort((a, b) => rang(a) - rang(b) || a.localeCompare(b));
  let rumpf = null, quelle = null;
  for (const f of dateien) {
    const text = readFileSync(path.join(ordner, f), 'utf8');
    const re = /create or replace function public\.online_suche_partie\(uid uuid\)[\s\S]*?\$\$([\s\S]*?)\$\$/gi;
    for (let m; (m = re.exec(text));) { rumpf = m[1]; quelle = f; }
  }
  if (!rumpf) throw new Error('online_suche_partie in supabase/*-schema.sql nicht gefunden');
  const fenster = rumpf.match(/interval\s+'(\d+)\s+seconds?'/i);
  return { quelle, fensterS: fenster ? Number(fenster[1]) : null };
}
const REGEL = partieRegelAusSql();

const token = uid => 'a.' + Buffer.from(JSON.stringify({ sub: uid })).toString('base64url') + '.x';
const sitzungVon = uid => ({ access_token: token(uid), refresh_token: 'test-r-' + uid, expires_at: 9999999999, user: { id: uid, email: uid + '@example.invalid' } });
const NAMEN = { u1: 'Spieler_1', u2: 'Spieler_2' };
const START_FEN = new Chess().fen();
// PROBE_SKIN=neon: ein Labor-Satz (nur das Erfinder-Konto, js/labor.js); dann besitzt das Konto auch den Erfinder-Titel
const SKIN = process.env.PROBE_SKIN || 'blaupause';
const STUECKE = SKIN === 'blaupause' ? ['erfinder-figuren-blaupause'] : ['erfinder-figuren-blaupause', 'erfinder-titel'];

let ok = 0, gesamt = 0, rotErwartet = 0, stamp = Date.now(), nummer = 0;
const partien = new Map(), schlange = new Map(), calls = [], fehler = [], unerwartet = [], rot = [];
const jetzt = () => Date.now();
const aktualisieren = p => { p.aktualisiert_am = new Date(Math.max(++stamp, jetzt())).toISOString(); stamp = Date.parse(p.aktualisiert_am); return p; };
const farbeVon = (p, uid) => (p.weiss === uid ? 'w' : p.schwarz === uid ? 'b' : null);
const chessVon = p => { const c = new Chess(); for (const m of p.zuege.split(' ').filter(Boolean)) c.move({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] }); return c; };
const laufendeVon = uid => [...partien.values()].filter(p => p.gewertet && p.status === 'laeuft' && farbeVon(p, uid));

function pruefe(name, gut, detail = '', { hart = false } = {}) {
  if (hart && !STRENG && !gut) { rotErwartet++; rot.push(name); console.log(`ROT-ERWARTET ${name} ${JSON.stringify(detail)}`); return gut; }
  gesamt++; if (gut) ok++;
  console.log(`${gut ? 'OK' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(detail)}`);
  return gut;
}

// ---- Server-Attrappe (ein Zustand fuer beide Konten) ----
function sucheLaufende(uid) {
  // wie public.online_suche_partie: die juengste laufende gewertete Partie des Kontos, im Fenster des SQL
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
  calls.push({ uid, pfad: url.pathname, query: url.search, methode: req.method(), body, zeit: jetzt() });
  const antwort = (d, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(d) });
  const absage = (status, message) => antwort({ message, fehler: message }, status);
  if (url.pathname.startsWith('/auth/v1/')) return antwort(uid ? { id: uid, email: uid + '@example.invalid' } : {});
  if (url.pathname === '/rest/v1/spielstaende') return antwort([]);
  // Skin-Probe: beide Konten besitzen den Figurensatz "blaupause" (js/figurensatz.js gibt ihn nur dann frei)
  if (url.pathname === '/rest/v1/sonderstuecke') return antwort(STUECKE.map(stueck_id => ({ stueck_id })));
  if (url.pathname === '/rest/v1/profile') return antwort(uid ? [{ user_id: uid, benutzername: NAMEN[uid] }] : []);
  if (/freigabe/.test(url.pathname)) return antwort([]);
  if (url.pathname === '/rest/v1/partien_online') {
    // wie die RLS: nur eigene Partien
    if (url.searchParams.has('status')) return antwort([...partien.values()].filter(p => p.status === 'beendet' && farbeVon(p, uid)));
    const p = partien.get((url.searchParams.get('id') || '').slice(3));
    const seit = (url.searchParams.get('aktualisiert_am') || '').slice(3);
    return antwort(p && farbeVon(p, uid) && (!seit || p.aktualisiert_am > seit) ? [p] : []);
  }
  if (!uid) return absage(401, 'KRONEN_ANMELDUNG');
  const rpc = url.pathname.split('/').at(-1), p = partien.get(body.partie);
  if (rpc === 'kronen_mein_stand') return antwort({ stufe: 7, kronen: 140, platz: 3, ziel: 120, n: 30, woche: '2026-11-09' });
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
  // R2: Tageskontingent der Live-Bewertung wie supabase/zwei-ligen-schema.sql (ohne Premium, heute noch frei)
  if (rpc === 'online_live_bewertung_frei') return antwort({ frei: true, rest: 1, unbegrenzt: false });
  if (rpc === 'online_live_bewertung_nutzen') return antwort({ ok: true, frei: true, rest: 0, unbegrenzt: false, gebucht: true });
  if (rpc === 'online_meine') return antwort([...partien.values()].filter(q => q.status !== 'beendet' && farbeVon(q, uid)));
  if (url.pathname === '/functions/v1/online-zug') {
    const q = partien.get(body.partie);
    if (!q || q.status !== 'laeuft') return absage(409, 'ONLINE_PARTIE_BEENDET');
    if (farbeVon(q, uid) !== q.am_zug) return absage(409, 'ONLINE_NICHT_DEIN_ZUG');
    const c = chessVon(q); let m;
    try { m = c.move({ from: body.zug.slice(0, 2), to: body.zug.slice(2, 4), promotion: body.zug[4] }); } catch (e) { return absage(422, 'ONLINE_ZUG_ILLEGAL'); }
    // Uhr wie der Server: ab dem 2. Halbzug laeuft sie, je Zug + Inkrement
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
    // nur echte Abläufe beenden; die Probe dauert keine fuenf Minuten je Partie
    if (p.status === 'laeuft' && p.zuege.split(' ').filter(Boolean).length < 2 && jetzt() - Date.parse(p.letzter_zug_am) > 600000) {
      Object.assign(p, { status: 'beendet', grund: 'abgebrochen', ergebnis: null }); aktualisieren(p);
    }
    return antwort(p);
  }
  if (rpc === 'karte_melde_stufen' || rpc === 'karte_waehle') return antwort({ taler: 0, stufen: {}, banner: ['start'], wahl: { banner: 'start' } });
  if (rpc === 'karte_der_partie') {
    const karte = (u) => ({ name: NAMEN[u] || 'Gegner', banner: 'saison-silber', titel: 'erfolg-feuertaufe', vitrine: [], motiv: 'Q', grund: 'standard', rahmen: 'ohne', kronen_stufe: 7, du: u === uid });
    return antwort(p ? { w: karte(p.weiss), s: karte(p.schwarz) } : {});
  }
  unerwartet.push(`${uid} ${req.method()} ${url.pathname}`); return antwort([]);
}

// ---- Browser ----
let browser;
const kontexte = [];
async function neuerKontext(uid, viewport = { width: 1180, height: 820 }) {
  const k = await browser.newContext({ viewport, hasTouch: true, serviceWorkers: 'block', locale: 'de-DE', timezoneId: 'Europe/Berlin' });
  kontexte.push(k);
  await k.route('**/*.supabase.co/**', bediene);
  await k.addInitScript(({ s, skin }) => {
    localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(s));
    localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ klang: false, bewegung: 'aus', figuren: skin }));
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
  }, { s: sitzungVon(uid), skin: SKIN });
  const seite = await k.newPage(); seite.setDefaultTimeout(15000);
  seite.on('pageerror', e => fehler.push(`${uid}: ${e.message}`));
  seite.uid = uid;
  return seite;
}
const START = () => `http://127.0.0.1:${PORT}/?test&kern&erw=pakete/online/index`;
// Beim Bildschirmwechsel ist das neue Brett einen Moment 0 px breit (R2 gemessen: 0, 800 ms spaeter 738 px); ein Tipp
// ginge ins Leere. Erst bereit, wenn genau ein Screen steht und das Brett Flaeche hat (wie tests/online-ui.test.mjs)
const bereit = s => s.waitForFunction(() => window.__online?.brett() && !window.__online.busy()
  && document.querySelectorAll('.screen').length === 1 && document.querySelector('.on-brett')?.getBoundingClientRect().width > 100, null, { timeout: 15000 });
// 'laufend': bei einer laufenden Partie zeigt die Partie-Tuer "Partie fortsetzen" statt der Suche (seit R1-C)
const sucheBereit = s => s.waitForFunction(() => ['bereit', 'laufend'].includes(document.querySelector('.on-art[data-art="partie"]')?.dataset.zustand), null, { timeout: 15000 });
const partieId = s => s.evaluate(() => window.__online?.partie()?.id || null);
async function zurOnlineSeite(s) {
  await s.evaluate(() => window.__app.gehe('online'));
  await sucheBereit(s);
}
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
async function fahne(s, welcher) {
  // Seit R1-C sind Remis und Aufgeben eigene Knoepfe; der Aufgeben-Dialog hat nur Weiterspielen/Aufgeben
  if (welcher === 'remis') return s.locator('[data-online="remis"]').click();
  await s.locator('[data-online="aufgeben"]').click();
  const knoepfe = s.locator('.dialog-ort:not(.weg) .dialog-knoepfe button');
  await knoepfe.first().waitFor();
  await knoepfe.last().click();
}
// Figurensatz auf einem Brett: steht der Skin-Pfad in den Bildern oder Hintergruenden?
const skinAuf = (s, sel) => s.evaluate(({ sel, skin }) => {
  const b = document.querySelector(sel); if (!b) return { da: false, pfade: [] };
  const pfade = [...b.querySelectorAll('img, [style], .figur, piece, *')].map(e => (e.getAttribute('src') || '') + ' ' + getComputedStyle(e).backgroundImage)
    .filter(t => /pieces\//.test(t)).slice(0, 3);
  return { da: pfade.some(t => t.includes('/' + skin + '/')), pfade };
}, { sel, skin: SKIN });

try {
  console.log(`Paarungsregel aus ${REGEL.quelle}: laufende Partie zaehlt ${REGEL.fensterS == null ? 'ohne Zeitfenster' : `nur ${REGEL.fensterS} s nach dem Start`}`);
  browser = await browserTyp(pw).launch({ headless: true });
  const a = await neuerKontext('u1'), b = await neuerKontext('u2');
  await Promise.all([a, b].map(async s => { await s.goto(START() + '#online'); await sucheBereit(s); }));

  // 1. Paarung in 5+3
  const id1 = await beideSuchen(a, b);
  pruefe('Paarung: beide suchen Ranked und landen in derselben gewerteten Partie', !!id1, { a: await partieId(a), b: await partieId(b) });
  if (!id1) throw new Error('ohne Paarung kein weiterer Ablauf');
  const uhr = await a.evaluate(() => ({ p: window.__online.partie(), uhren: [...document.querySelectorAll('.on-spiel .uhr')].map(u => ({ t: u.textContent.trim(), sichtbar: !u.hidden })) }));
  pruefe('Uhr zeigt 5+3: Partie mit 300 s und 3 s Zuschlag, beide Uhren sichtbar auf 5:00', uhr.p.bedenkzeit_s === 300 && uhr.p.inkrement_s === 3
    && uhr.uhren.length === 2 && uhr.uhren.every(u => u.sichtbar && /^5:00/.test(u.t)), uhr.uhren);
  const farbe = s => s.evaluate(() => ({ meine: window.__online.partie().weiss === JSON.parse(localStorage.getItem('schach-arena:konto:sitzung')).user.id ? 'w' : 'b', unten: window.__online.brett().ausrichtung }));
  const [fa, fb] = await Promise.all([farbe(a), farbe(b)]);
  pruefe('Jede Sitzung sieht ihre eigene Farbe unten, die Farben sind verschieden (Befund 2)', fa.meine !== fb.meine && fa.unten === fa.meine && fb.unten === fb.meine, { fa, fb });
  let [weiss, schwarz] = fa.meine === 'w' ? [a, b] : [b, a];

  // 2. Weiss zieht, Schwarz sieht und zieht
  await bereit(weiss); await tippe(weiss, 'e2e4');
  pruefe('Weiss zieht e2-e4, Schwarz sieht den Zug', await sieht(schwarz, 'e2e4'), await schwarz.evaluate(() => window.__online.partie().zuege));
  await bereit(schwarz); await tippe(schwarz, 'e7e5');
  pruefe('Schwarz zieht e7-e5, Weiss sieht den Zug', await sieht(weiss, 'e7e5'), await weiss.evaluate(() => window.__online.partie().zuege));

  // 3. Remis anbieten und annehmen
  await bereit(weiss); await fahne(weiss, 'remis');
  const angebot = await schwarz.locator('[data-online="annehmen"]').waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
  pruefe('Remis: Weiss bietet an (Fahne), Schwarz sieht "Annehmen"', angebot, partien.get(id1));
  if (angebot) await schwarz.locator('[data-online="annehmen"]').click();
  const remisEnde = await Promise.all([weiss, schwarz].map(s => s.waitForFunction(() => window.__online?.partie()?.status === 'beendet'
    && !document.querySelector('.on-ergebnis').hidden, null, { timeout: 10000 }).then(() => true).catch(() => false)));
  pruefe('Remis angenommen: beide sehen das Ergebnis 1/2-1/2', remisEnde.every(Boolean) && partien.get(id1).ergebnis === '1/2-1/2', { remisEnde, p: partien.get(id1) });

  // 4. Neue Partie, Aufgeben
  await Promise.all([a, b].map(zurOnlineSeite));
  const id2 = await beideSuchen(a, b);
  pruefe('Neue Partie: erneute Suche nach dem Ende paart beide in einer neuen Partie', !!id2 && id2 !== id1, { id1, id2 });
  if (!id2) throw new Error('ohne zweite Paarung kein weiterer Ablauf');
  await bereit(a); await fahne(a, 'aufgeben');
  const aufgabe = await b.waitForFunction(() => window.__online?.partie()?.status === 'beendet' && !document.querySelector('.on-ergebnis').hidden, null, { timeout: 10000 })
    .then(() => true).catch(() => false);
  pruefe('Aufgeben: u1 gibt auf, u2 sieht das Ende mit Grund Aufgabe', aufgabe && partien.get(id2).grund === 'aufgabe', partien.get(id2));

  // 5. Dritte Partie laeuft; Seite neu laden und zurueckkehren
  await Promise.all([a, b].map(zurOnlineSeite));
  const id3 = await beideSuchen(a, b);
  pruefe('Dritte Partie laeuft (fuer Neuladen, zweite Partie, Skin, Brett)', !!id3, { id3 });
  if (!id3) throw new Error('ohne dritte Paarung kein weiterer Ablauf');
  const fa3 = await farbe(a); [weiss, schwarz] = fa3.meine === 'w' ? [a, b] : [b, a];
  await bereit(weiss); await tippe(weiss, 'd2d4'); await sieht(schwarz, 'd2d4');
  await a.reload(); await a.goto(START() + '#online'); await sucheBereit(a);
  await a.waitForTimeout(2500); // Liste und Karten laden lassen
  const anzeige = await a.evaluate((id) => {
    // Ein Eintrag in der zugeklappten Freunde-Box (details ohne open) hat zwar Masse, ist aber nicht zu sehen
    const imBild = e => !!e && !e.closest('details:not([open])') && e.checkVisibility?.({ visibilityProperty: true, opacityProperty: true }) !== false
      && e.getClientRects().length > 0 && e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().bottom > 0;
    const offen = window.__online?.partie()?.id === id;
    const alle = [...document.querySelectorAll(`[data-partie="${id}"]`)];
    const eintrag = alle.find(imBild);
    return { offen, eintrag: !!eintrag, versteckt: alle.length - (eintrag ? 1 : 0), inZugeklappt: alle.some(e => !!e.closest('details:not([open])')),
      text: eintrag?.textContent.trim().slice(0, 60) || null };
  }, id3);
  pruefe('Nach Neuladen zeigt die Online-Seite die laufende Partie (offen oder sichtbarer Eintrag, Befund 3)', anzeige.offen || anzeige.eintrag, anzeige, { hart: true });
  let zurueck = anzeige.offen;
  if (!zurueck && anzeige.eintrag) {
    await a.locator(`[data-partie="${id3}"]`).filter({ visible: true }).first().click({ timeout: 5000 }).catch(() => {});
    zurueck = await a.waitForFunction(id => window.__online?.partie()?.id === id && window.__online.brett(), id3, { timeout: 10000 }).then(() => true).catch(() => false);
  }
  // ohne Rueckweg die Partie direkt oeffnen, damit die weiteren Pruefungen laufen
  if (!zurueck) { await a.evaluate(id => window.__app.gehe('online', { partieId: id }), id3); await bereit(a); }
  // Die Zuege kommen nach dem Oeffnen nach (Laden vom Server); bis zu 5 s darauf warten, dann den Stand nehmen
  if (zurueck) await a.waitForFunction(() => window.__online.partie()?.zuege === 'd2d4', null, { timeout: 5000 }).catch(() => {});
  const zuegeZurueck = zurueck ? await a.evaluate(() => window.__online.partie().zuege) : null;
  pruefe('Zurueckkehren: ein Tipp fuehrt in dieselbe Partie mit allen Zuegen (Befund 3)', zurueck && zuegeZurueck === 'd2d4', { zurueck, zuegeZurueck }, { hart: true });

  // 6. Erneute Suche waehrend der laufenden Partie: nie eine zweite (Befund 1, DB 20:09:58 und 20:11:45)
  // Die Partie laeuft seit mehr als einer Minute (wie am Abend); das Fenster des SQL ist damit vorbei
  partien.get(id3).erstellt_am = new Date(jetzt() - 61000).toISOString();
  await Promise.all([a, b].map(async s => { await s.evaluate(() => window.__app.gehe('online')); await sucheBereit(s).catch(() => {}); }));
  const angeboten = await Promise.all([a, b].map(s => s.evaluate(() => { const k = document.querySelector('[data-online="suchen"]'); return !!k && !k.hidden && !k.disabled && k.getClientRects().length > 0; })));
  const vorher = partien.size;
  if (angeboten.every(Boolean)) {
    await a.locator('[data-online="suchen"]').click();
    await b.locator('[data-online="suchen"]').click();
    await Promise.all([a, b].map(s => s.waitForFunction(() => window.__online?.brett(), null, { timeout: 8000 }).catch(() => {})));
  }
  const laufendU1 = laufendeVon('u1').map(p => p.id), laufendU2 = laufendeVon('u2').map(p => p.id);
  pruefe('Erneute Suche waehrend einer laufenden Partie erzeugt keine zweite (Oberflaeche, Befund 1)',
    laufendU1.length <= 1 && laufendU2.length <= 1 && partien.size === vorher, { angeboten, laufendU1, laufendU2 }, { hart: true });
  // Server-Regel allein (ohne die Oberflaeche): online_suche_start bei laufender Partie gibt die laufende zurueck
  for (const q of laufendeVon('u1')) if (q.id !== id3) Object.assign(q, { status: 'beendet', grund: 'abgebrochen' });
  const nachVorher = partien.size;
  // nacheinander, damit die Reihenfolge fest ist (u1 wartet, u2 trifft ihn)
  const direkt = [];
  for (const s of [a, b]) direkt.push(await s.evaluate(async () => (await import('./js/online.js')).rpc('online_suche_start', { zeit: '5+3' })));
  await Promise.all([a, b].map(s => s.evaluate(async () => (await import('./js/online.js')).rpc('online_suche_ende', { ki: false }))));
  pruefe(`Server-Regel (aus ${REGEL.quelle}): online_suche_start bei laufender Partie liefert sie statt einer neuen (Befund 1)`,
    direkt.every(d => d?.partie === id3) && partien.size === nachVorher, { direkt, fensterS: REGEL.fensterS }, { hart: true });

  // 7. Skin und Brettgroesse, je Fenstergroesse eine frische Sitzung von u1 (Befund 4 und 5)
  partien.get(id3).status = 'laeuft';
  for (const [name, w, h] of [['handy-klein', 375, 667], ['pc', 1280, 720]]) {
    const s = await neuerKontext('u1', { width: w, height: h });
    await s.goto(START() + '#online'); await sucheBereit(s);
    await s.evaluate(id => window.__app.gehe('online', { partieId: id }), id3); await bereit(s);
    await s.waitForTimeout(800);
    const online = await s.evaluate(() => Math.round(document.querySelector('.on-brett').getBoundingClientRect().width));
    const skinOnline = await skinAuf(s, '.on-brett');
    await s.evaluate(() => window.__app.gehe('partie', { botId: 'benno' }));
    await s.waitForSelector('.brett-rahmen > .brett:not(.on-brett)', { timeout: 20000 });
    await s.waitForTimeout(1500);
    const bot = await s.evaluate(() => Math.round(document.querySelector('.brett-rahmen > .brett:not(.on-brett)').getBoundingClientRect().width));
    const skinBot = await skinAuf(s, '.brett-rahmen > .brett:not(.on-brett)');
    if (name === 'handy-klein') {
      // Kontrolle: ohne Skin in der Bot-Partie ist die Skin-Pruefung nicht aussagekraeftig
      pruefe(`Kontrolle Skin: die Bot-Partie zeigt den gewaehlten Figurensatz "${SKIN}"`, skinBot.da, skinBot);
      pruefe(`Skin: das Online-Brett zeigt den gewaehlten Figurensatz "${SKIN}" (Befund 4)`, skinOnline.da, skinOnline, { hart: true });
    }
    pruefe(`Brettgroesse @ ${name} (${w}x${h}): Online-Brett mindestens so gross wie in der Bot-Partie (Befund 5)`, online >= bot - 1, { online, bot }, { hart: true });
  }

  pruefe('Keine Seitenfehler oder unerwarteten API-Aufrufe', !fehler.length && !unerwartet.length, { fehler, unerwartet: [...new Set(unerwartet)] });
} catch (e) { pruefe('Ablauf ohne Abbruch', false, e.stack); }
finally { for (const k of kontexte) await k.close().catch(() => {}); await browser?.close(); await new Promise(r => server.close(r)); }
if (rotErwartet) console.log(`\n${rotErwartet} harte Pruefung(en) ROT-ERWARTET (zaehlen erst mit PROBE_STRENG=1): ${rot.join(' | ')}`);
console.log(`\n${ok}/${gesamt} bestanden`); process.exitCode = ok === gesamt ? 0 : 1;
