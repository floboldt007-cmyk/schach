// Tests fuer js/online.js (Node, ohne Browser, mit gefaelschtem fetch): node tests/online.test.mjs
// Prueft jeden Aufruf mit Pfad, Methode, Kopfzeilen (apikey, Bearer) und Body, die Abfrage (Start, Pause bei
// verborgener Seite, Stopp, Fehler), die Fehlertexte, den Einladungslink und die Vertraege zu SQL und sw.js.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { setzeKontoFetch, sitzung, SITZUNG_SCHLUESSEL, SICHTBAR_SCHLUESSEL } from '../js/konto.js';
import { SUPABASE_URL, SUPABASE_KEY } from '../js/konto-config.js';
import {
  erstelleEinladung, tritteBei, ladePartie, sendeZug, gibAuf, bieteRemis, nimmRemisAn, meinePartien, beobachte, pruefeZeit,
  einladungsLink, codeAusLink, uebernimmEinladungsLink, gemerkteEinladung, vergissEinladung, meineFarbe, binAmZug,
  zuegeListe, normalisiereCode, setzeOnlineFetch, FEHLER_TEXTE, LINK_BASIS, EINLADUNG_SCHLUESSEL,
} from '../js/online.js';

let ok = 0, gesamt = 0;
function pruefe(name, wert, extra = '') { gesamt++; if (wert) ok++; else console.error('FEHLER ' + name, extra); }
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const quelle = (p) => readFileSync(path.join(WURZEL, p), 'utf8');

const m = new Map();
globalThis.localStorage = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), key: (i) => [...m.keys()][i] ?? null, get length() { return m.size; } };
Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'Test' }, configurable: true });

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const tokenFuer = (sub) => 'a.' + b64({ sub }) + '.x';
function anmelden({ sub = 'u1', expiresAt = 9999999999, token = tokenFuer(sub) } = {}) {
  localStorage.setItem(SITZUNG_SCHLUESSEL, JSON.stringify({ access_token: token, refresh_token: 'r', expires_at: expiresAt, user: { id: sub, email: 'a@b.de' } }));
}
const abmelden = () => localStorage.removeItem(SITZUNG_SCHLUESSEL);

const calls = []; const antworten = []; let fetchKaputt = null;
setzeOnlineFetch(async (url, opt = {}) => {
  calls.push({ url, methode: opt.method, headers: opt.headers || {}, body: opt.body, t: Date.now() });
  if (fetchKaputt) throw fetchKaputt;
  const x = antworten.shift() || { status: 200, body: [] };
  if (x.warte) await new Promise((r) => setTimeout(r, x.warte));
  return { ok: x.status < 400, status: x.status, async json() { if (x.body === undefined) throw new Error('leer'); return x.body; } };
});
const letzter = () => calls.at(-1);
const bodyVon = (c) => JSON.parse(c.body);
async function fehlerVon(fn) { try { await fn(); return null; } catch (e) { return e; } }
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const FEN_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
const ID = '0b1f6a2e-8c3d-4e5f-9a7b-1c2d3e4f5a6b';
const partie = { id: ID, code: 'ABC234', weiss: 'u1', schwarz: null, erstellt_von: 'u1', status: 'offen', fen: START, zuege: '', am_zug: 'w',
  ergebnis: null, grund: null, remis_angebot: null, bedenkzeit_s: 300, inkrement_s: 2, uhr_weiss_ms: 300000, uhr_schwarz_ms: 300000,
  letzter_zug_am: null, erstellt_am: '2026-10-22T10:00:00.000000+00:00', aktualisiert_am: '2026-10-22T10:00:00.000000+00:00' };

// ---------- ohne Anmeldung ----------
{
  const e = await fehlerVon(() => erstelleEinladung({ farbe: 'w' }));
  pruefe('Ohne Anmeldung: freundlicher Fehler, keine Anfrage', e?.message === FEHLER_TEXTE.ONLINE_NICHT_ANGEMELDET && /anmelden/.test(e.message) && calls.length === 0);
  const f = await fehlerVon(() => meinePartien());
  pruefe('Ohne Anmeldung: auch meinePartien bricht sauber ab', f?.message === FEHLER_TEXTE.ONLINE_NICHT_ANGEMELDET && calls.length === 0);
}

// ---------- Einladung erstellen ----------
anmelden();
{
  antworten.push({ status: 200, body: partie });
  const p = await erstelleEinladung({ farbe: 'w', bedenkzeit: 300, inkrement: 2 });
  const c = letzter();
  pruefe('erstelleEinladung: POST auf rpc/online_erstelle', c.url === `${SUPABASE_URL}/rest/v1/rpc/online_erstelle` && c.methode === 'POST');
  pruefe('erstelleEinladung: apikey, Bearer und JSON-Kopf', c.headers.apikey === SUPABASE_KEY && c.headers.Authorization === `Bearer ${tokenFuer('u1')}` && c.headers['Content-Type'] === 'application/json');
  pruefe('erstelleEinladung: Body mit farbe, bedenkzeit_s, inkrement_s', JSON.stringify(bodyVon(c)) === JSON.stringify({ farbe: 'w', bedenkzeit_s: 300, inkrement_s: 2 }));
  pruefe('erstelleEinladung: liefert die Partie', p.id === ID && p.code === 'ABC234');
  antworten.push({ status: 200, body: [partie] });
  const p2 = await erstelleEinladung();
  pruefe('erstelleEinladung: Standard ist Zufall ohne Uhr, Liste vom Server wird zum Objekt', JSON.stringify(bodyVon(letzter())) === JSON.stringify({ farbe: 'zufall', bedenkzeit_s: null, inkrement_s: null }) && p2.id === ID);
  antworten.push({ status: 200, body: partie });
  await erstelleEinladung({ farbe: 'b', bedenkzeit: 60 });
  pruefe('erstelleEinladung: Bedenkzeit ohne Zuschlag ergibt Zuschlag 0', JSON.stringify(bodyVon(letzter())) === JSON.stringify({ farbe: 'b', bedenkzeit_s: 60, inkrement_s: 0 }));
  const n = calls.length;
  const e1 = await fehlerVon(() => erstelleEinladung({ farbe: 'x' }));
  const e2 = await fehlerVon(() => erstelleEinladung({ farbe: 'w', bedenkzeit: 0 }));
  const e3 = await fehlerVon(() => erstelleEinladung({ farbe: 'w', bedenkzeit: 300, inkrement: 601 }));
  const e4 = await fehlerVon(() => erstelleEinladung({ farbe: 'w', bedenkzeit: 10801 }));
  pruefe('erstelleEinladung: falsche Farbe oder Zeiten werden vor der Anfrage abgefangen', e1?.message === FEHLER_TEXTE.ONLINE_FARBE && e2?.message === FEHLER_TEXTE.ONLINE_BEDENKZEIT && e3?.message === FEHLER_TEXTE.ONLINE_BEDENKZEIT && e4?.message === FEHLER_TEXTE.ONLINE_BEDENKZEIT && calls.length === n);
  antworten.push({ status: 200, body: null });
  const e5 = await fehlerVon(() => erstelleEinladung({ farbe: 'w' }));
  pruefe('erstelleEinladung: leere Antwort ist ein lesbarer Fehler', /keine Partie/.test(e5?.message || ''));
}

// ---------- beitreten ----------
{
  antworten.push({ status: 200, body: { ...partie, status: 'laeuft', schwarz: 'u2' } });
  const p = await tritteBei(' ab-c2 34 ');
  pruefe('tritteBei: Code wird gross und ohne Fuellzeichen gesendet', letzter().url.endsWith('/rest/v1/rpc/online_tritt_bei') && bodyVon(letzter()).code === 'ABC234' && p.status === 'laeuft');
  const n = calls.length;
  const e1 = await fehlerVon(() => tritteBei('ABC'));
  const e2 = await fehlerVon(() => tritteBei('ABC0I1'));
  pruefe('tritteBei: ungueltiger Code wird vor der Anfrage abgefangen, Text wie vereinbart', e1?.message === 'Dieser Code ist ungültig oder die Partie ist schon voll.' && e2?.message === e1.message && calls.length === n);
  antworten.push({ status: 400, body: { code: 'P0001', message: 'ONLINE_CODE_UNGUELTIG' } });
  const e3 = await fehlerVon(() => tritteBei('ZZZZZZ'));
  pruefe('tritteBei: Serverkennung wird uebersetzt, Kennung bleibt am Fehler', e3?.message === FEHLER_TEXTE.ONLINE_CODE_UNGUELTIG && e3.kennung === 'ONLINE_CODE_UNGUELTIG' && e3.status === 400);
  antworten.push({ status: 400, body: { code: 'P0001', message: 'ONLINE_EIGENE_PARTIE' } });
  const e4 = await fehlerVon(() => tritteBei('ABC234'));
  pruefe('tritteBei: eigene Einladung freundlich', /eigene Einladung/.test(e4?.message || ''));
}

// ---------- Partie laden ----------
{
  antworten.push({ status: 200, body: [partie] });
  const p = await ladePartie(ID);
  const c = letzter();
  pruefe('ladePartie: GET auf die Zeile mit select=*, ohne Body', c.url === `${SUPABASE_URL}/rest/v1/partien_online?id=eq.${ID}&select=*` && c.methode === 'GET' && c.body === undefined && !('Content-Type' in c.headers) && c.headers.Authorization.startsWith('Bearer '));
  pruefe('ladePartie: liefert die Zeile', p.id === ID);
  antworten.push({ status: 200, body: [] });
  const e = await fehlerVon(() => ladePartie(ID));
  pruefe('ladePartie: leere Liste (fremd oder unbekannt) ist ein lesbarer Fehler', e?.message === FEHLER_TEXTE.ONLINE_PARTIE_UNBEKANNT);
}

// ---------- Zug senden ----------
{
  antworten.push({ status: 200, body: { ...partie, zuege: 'e2e4', am_zug: 'b', fen: FEN_E4 } });
  const p = await sendeZug(ID, { uci: 'e2e4', fenDanach: FEN_E4, amZugDanach: 'b' });
  const c = letzter();
  pruefe('sendeZug: POST auf rpc/online_zug', c.url.endsWith('/rest/v1/rpc/online_zug') && c.methode === 'POST');
  pruefe('sendeZug: Body mit partie, zug, fen_danach, am_zug_danach, ergebnis und grund null', JSON.stringify(bodyVon(c)) === JSON.stringify({ partie: ID, zug: 'e2e4', fen_danach: FEN_E4, am_zug_danach: 'b', ergebnis: null, grund: null }) && p.zuege === 'e2e4');
  antworten.push({ status: 200, body: { ...partie, status: 'beendet' } });
  await sendeZug(ID, { uci: 'd8h4', fenDanach: 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3', amZugDanach: 'w', ergebnis: '0-1', grund: 'matt' });
  pruefe('sendeZug: Ergebnis und Grund werden mitgeschickt', bodyVon(letzter()).ergebnis === '0-1' && bodyVon(letzter()).grund === 'matt');
  antworten.push({ status: 200, body: partie });
  await sendeZug(ID, { uci: 'e2e4', fenDanach: FEN_E4, amZugDanach: 'b', grund: 'matt' });
  pruefe('sendeZug: Grund ohne Ergebnis wird nicht gesendet', bodyVon(letzter()).grund === null);
  const n = calls.length;
  const e1 = await fehlerVon(() => sendeZug(ID, { uci: 'e2e9', fenDanach: FEN_E4, amZugDanach: 'b' }));
  const e2 = await fehlerVon(() => sendeZug(ID, { uci: 'e2e4', fenDanach: 'kaputt', amZugDanach: 'b' }));
  const e3 = await fehlerVon(() => sendeZug(ID, { uci: 'e2e4', fenDanach: FEN_E4, amZugDanach: 'x' }));
  const e4 = await fehlerVon(() => sendeZug(ID, { uci: 'e2e4', fenDanach: FEN_E4, amZugDanach: 'b', ergebnis: 'gewonnen' }));
  const e5 = await fehlerVon(() => sendeZug(ID, { uci: 'e2e4 e7e5', fenDanach: FEN_E4, amZugDanach: 'b' }));
  pruefe('sendeZug: Zug, FEN, Seite und Ergebnis werden vor der Anfrage geprueft', e1?.message === FEHLER_TEXTE.ONLINE_ZUG_FORM && e2?.message === FEHLER_TEXTE.ONLINE_FEN_FORM && e3?.message === FEHLER_TEXTE.ONLINE_AM_ZUG_FORM && e4?.message === FEHLER_TEXTE.ONLINE_ERGEBNIS_FORM && e5?.message === FEHLER_TEXTE.ONLINE_ZUG_FORM && calls.length === n);
  antworten.push({ status: 400, body: { code: 'P0001', message: 'ONLINE_NICHT_DEIN_ZUG' } });
  const e6 = await fehlerVon(() => sendeZug(ID, { uci: 'e2e4', fenDanach: FEN_E4, amZugDanach: 'b' }));
  antworten.push({ status: 400, body: { code: 'P0001', message: 'ONLINE_PARTIE_BEENDET' } });
  const e7 = await fehlerVon(() => sendeZug(ID, { uci: 'e2e4', fenDanach: FEN_E4, amZugDanach: 'b' }));
  antworten.push({ status: 400, body: { code: 'P0001', message: 'ONLINE_PARTIE_NICHT_GESTARTET' } });
  const e8 = await fehlerVon(() => sendeZug(ID, { uci: 'e2e4', fenDanach: FEN_E4, amZugDanach: 'b' }));
  pruefe('sendeZug: Serverkennungen werden zu Saetzen', e6?.message === 'Du bist nicht am Zug.' && e7?.message === FEHLER_TEXTE.ONLINE_PARTIE_BEENDET && /noch nicht begonnen/.test(e8?.message || ''));
}

// ---------- aufgeben, Remis, meine Partien ----------
{
  antworten.push({ status: 200, body: { ...partie, status: 'beendet', grund: 'aufgabe' } });
  const p = await gibAuf(ID);
  pruefe('gibAuf: rpc/online_gib_auf mit { partie }', letzter().url.endsWith('/rest/v1/rpc/online_gib_auf') && JSON.stringify(bodyVon(letzter())) === JSON.stringify({ partie: ID }) && p.grund === 'aufgabe');
  antworten.push({ status: 200, body: { ...partie, remis_angebot: 'w' } });
  const r = await bieteRemis(ID);
  pruefe('bieteRemis: rpc/online_biete_remis mit { partie }', letzter().url.endsWith('/rest/v1/rpc/online_biete_remis') && JSON.stringify(bodyVon(letzter())) === JSON.stringify({ partie: ID }) && r.remis_angebot === 'w');
  antworten.push({ status: 200, body: { ...partie, status: 'beendet', ergebnis: '1/2-1/2' } });
  const a = await nimmRemisAn(ID);
  pruefe('nimmRemisAn: rpc/online_nimm_remis_an mit { partie }', letzter().url.endsWith('/rest/v1/rpc/online_nimm_remis_an') && JSON.stringify(bodyVon(letzter())) === JSON.stringify({ partie: ID }) && a.ergebnis === '1/2-1/2');
  antworten.push({ status: 200, body: { ...partie, status: 'beendet', ergebnis: '1-0', grund: 'zeit' } });
  const z = await pruefeZeit(ID);
  pruefe('pruefeZeit: rpc/online_pruefe_zeit mit { partie }, liefert die Partie', letzter().url.endsWith('/rest/v1/rpc/online_pruefe_zeit') && letzter().methode === 'POST' && JSON.stringify(bodyVon(letzter())) === JSON.stringify({ partie: ID }) && z.grund === 'zeit');
  antworten.push({ status: 400, body: { code: 'P0001', message: 'ONLINE_CODE_ABGELAUFEN' } });
  const ea = await fehlerVon(() => tritteBei('ABC234'));
  pruefe('tritteBei: abgelaufene Einladung freundlich (24 Stunden)', ea?.message === FEHLER_TEXTE.ONLINE_CODE_ABGELAUFEN && /24 Stunden/.test(ea.message) && ea.kennung === 'ONLINE_CODE_ABGELAUFEN');
  antworten.push({ status: 400, body: { code: 'P0001', message: 'ONLINE_KEIN_REMISANGEBOT' } });
  const e = await fehlerVon(() => nimmRemisAn(ID));
  pruefe('nimmRemisAn: ohne Angebot freundlich', e?.message === FEHLER_TEXTE.ONLINE_KEIN_REMISANGEBOT);
  antworten.push({ status: 200, body: [partie, { ...partie, id: 'zwei' }] });
  const liste = await meinePartien();
  pruefe('meinePartien: POST auf rpc/online_meine mit leerem Objekt, liefert die Liste', letzter().url.endsWith('/rest/v1/rpc/online_meine') && letzter().methode === 'POST' && letzter().body === '{}' && liste.length === 2 && liste[1].id === 'zwei');
  antworten.push({ status: 200, body: null });
  pruefe('meinePartien: keine Liste vom Server ergibt eine leere Liste', (await meinePartien()).length === 0);
  antworten.push({ status: 200, body: [partie] }, { status: 200, body: [{ ...partie, id: 'fertig', status: 'beendet', aktualisiert_am: '2026-10-23T12:00:00Z' }] });
  const mitArchiv = await meinePartien({ beendete: true });
  pruefe('meinePartien mit Archiv: authentifizierter Lesezugriff auf beendete Partien, neueste zuerst',
    letzter().url.endsWith('/rest/v1/partien_online?status=eq.beendet&select=*&order=aktualisiert_am.desc&limit=100')
    && letzter().methode === 'GET' && letzter().headers.Authorization.startsWith('Bearer ')
    && mitArchiv.length === 2 && mitArchiv[0].id === 'fertig' && mitArchiv[1].id === ID);
}

// ---------- Sitzung erneuern, offline, Serverfehler ----------
{
  anmelden({ expiresAt: 1 });
  const kontoCalls = [];
  setzeKontoFetch(async (url, opt) => { kontoCalls.push({ url, ...opt }); return { ok: true, status: 200, async json() { return { access_token: tokenFuer('u1').replace(/^a\./, 'neu.'), refresh_token: 'r2', expires_at: 9999999999, user: { id: 'u1', email: 'a@b.de' } }; } }; });
  antworten.push({ status: 200, body: [partie] });
  await ladePartie(ID);
  pruefe('Abgelaufene Sitzung: erst erneuern (konto.js), dann mit dem neuen Token anfragen', kontoCalls.length === 1 && kontoCalls[0].url.includes('grant_type=refresh_token') && letzter().headers.Authorization === `Bearer ${tokenFuer('u1').replace(/^a\./, 'neu.')}` && sitzung().refresh_token === 'r2');
  setzeKontoFetch(null);
  fetchKaputt = new Error('offline');
  const e1 = await fehlerVon(() => ladePartie(ID));
  pruefe('Offline: freundlicher Fehler, kein Absturz', /Keine Verbindung/.test(e1?.message || ''));
  fetchKaputt = null;
  antworten.push({ status: 401, body: { message: 'JWT expired' } });
  const e2 = await fehlerVon(() => meinePartien());
  antworten.push({ status: 404, body: { code: 'PGRST202', message: 'Could not find the function public.online_meine' } });
  const e3 = await fehlerVon(() => meinePartien());
  antworten.push({ status: 500, body: undefined });
  const e4 = await fehlerVon(() => meinePartien());
  antworten.push({ status: 409, body: { code: '23505', message: 'duplicate key' } });
  const e5 = await fehlerVon(() => meinePartien());
  antworten.push({ status: 400, body: { code: '23514', message: 'new row for relation "partien_online" violates check constraint "partien_online_zuege_groesse"' } });
  const e6 = await fehlerVon(() => meinePartien());
  antworten.push({ status: 403, body: { code: '42501', message: 'permission denied for table partien_online' } });
  const e7 = await fehlerVon(() => meinePartien());
  pruefe('Serverfehler: 401 abgelaufen, 404 nicht eingerichtet, 500 mit Status und "noch einmal", sonst deutscher Satz mit Originaltext in detail',
    /neu anmelden/.test(e2?.message || '') && /noch nicht eingerichtet/.test(e3?.message || '') && /\(500\)/.test(e4?.message || '') && /noch einmal/.test(e4?.message || '')
    && e5?.message === 'Das gibt es auf dem Server schon.' && e5.detail === 'duplicate key' && e5.code === '23505' && e5.status === 409
    && /abgelehnt/.test(e6?.message || '') && /check constraint/.test(e6?.detail || '') && /Berechtigung/.test(e7?.message || '') && e7.status === 403);
  pruefe('Serverfehler: nie roher englischer Text in der Meldung', [e2, e3, e4, e5, e6, e7].every((x) => x && !/duplicate|violates|constraint|permission|denied|Could not find|JWT/i.test(x.message)), [e2, e3, e4, e5, e6, e7].map((x) => x?.message).join(' | '));
}

// ---------- beobachte (Abfrage) ----------
{
  const hoerer = {};
  globalThis.document = { hidden: false, addEventListener(n, f) { (hoerer[n] ||= []).push(f); }, removeEventListener(n, f) { hoerer[n] = (hoerer[n] || []).filter((x) => x !== f); } };
  const sichtbarkeit = () => (hoerer.visibilitychange || []).forEach((f) => f());
  const aenderungen = []; const fehler = [];
  const n0 = calls.length;
  antworten.push({ status: 200, body: [partie] });
  const b = beobachte(ID, { alle: 10, beiAenderung: (p) => aenderungen.push(p), beiFehler: (e) => fehler.push(e.message) });
  await warte(5);
  pruefe('beobachte: erste Abfrage sofort, ohne Zeitfilter, mit Bearer', calls.length === n0 + 1 && letzter().url === `${SUPABASE_URL}/rest/v1/partien_online?id=eq.${ID}&select=*` && letzter().methode === 'GET' && letzter().headers.Authorization.startsWith('Bearer '));
  pruefe('beobachte: beiAenderung mit der Partie, Stand gemerkt', aenderungen.length === 1 && aenderungen[0].id === ID && b.stand() === partie.aktualisiert_am && b.laeuft());
  await warte(45);
  pruefe('beobachte: weitere Abfragen nur nach Neuerem (aktualisiert_am=gt.), keine Meldung ohne Aenderung', calls.length >= n0 + 3 && letzter().url === `${SUPABASE_URL}/rest/v1/partien_online?id=eq.${ID}&select=*&aktualisiert_am=gt.${encodeURIComponent(partie.aktualisiert_am)}` && aenderungen.length === 1);
  const partie2 = { ...partie, status: 'laeuft', schwarz: 'u2', aktualisiert_am: '2026-10-22T10:00:05.000000+00:00' };
  antworten.push({ status: 200, body: [partie2] });
  await warte(30);
  pruefe('beobachte: Aenderung erkannt, neuer Stand', aenderungen.length === 2 && aenderungen[1].status === 'laeuft' && b.stand() === partie2.aktualisiert_am);
  document.hidden = true; sichtbarkeit();
  await warte(15); const nVerborgen = calls.length; await warte(50);
  pruefe('beobachte: pausiert, solange die Seite verborgen ist', calls.length === nVerborgen);
  document.hidden = false; sichtbarkeit();
  await warte(5);
  pruefe('beobachte: nach dem Sichtbarwerden sofort wieder eine Abfrage', calls.length === nVerborgen + 1);
  const nVorOffline = calls.length;
  fetchKaputt = new Error('offline');
  await warte(160);
  pruefe('beobachte: offline meldet einmal freundlich und fragt weiter', fehler.length === 1 && /Keine Verbindung/.test(fehler[0]) && calls.length >= nVorOffline + 3 && b.laeuft());
  // Zeitpunkte aus dem Fake-Fetch: Last verspaetet Timer nur, sie feuern nie frueher. Darum Untergrenzen
  // (10 ms Takt, dann 20 und 40 ms), nicht "zweiter Abstand groesser als der erste".
  const zeitenOffline = calls.slice(nVorOffline).map((c) => c.t);
  const abstaende = zeitenOffline.slice(1).map((t, i) => t - zeitenOffline[i]);
  pruefe('beobachte: bei Fehlern waechst der Abstand (nicht alle 10 ms weiter)', zeitenOffline.length <= 5 && abstaende.length >= 2 && abstaende[0] >= 18 && abstaende[1] >= 36, `${zeitenOffline.length} Abfragen in 160 ms, Abstaende ${abstaende.join(',')}`);
  fetchKaputt = null;
  await warte(250); // der letzte Fehler-Abstand kann bis 160 ms dauern
  const nWieder = calls.length; await warte(35);
  pruefe('beobachte: nach dem Fehler wieder im normalen Takt', calls.length >= nWieder + 2 && b.laeuft());
  // 401, obwohl die Sitzung lokal noch gilt: genau einmal erneuern, sofort neu fragen, keine Meldung
  const kontoAufrufe = [];
  setzeKontoFetch(async (url, opt) => { kontoAufrufe.push(url); return { ok: true, status: 200, async json() { return { access_token: tokenFuer('u1').replace(/^a\./, 'frisch.'), refresh_token: 'r3', expires_at: 9999999999, user: { id: 'u1', email: 'a@b.de' } }; } }; });
  antworten.push({ status: 401, body: { message: 'JWT expired' } });
  await warte(40);
  pruefe('beobachte: 401 erneuert die Sitzung genau einmal und fragt sofort mit dem neuen Token, ohne Meldung', kontoAufrufe.length === 1 && /grant_type=refresh_token/.test(kontoAufrufe[0]) && fehler.length === 1 && b.laeuft() && letzter().headers.Authorization === `Bearer ${tokenFuer('u1').replace(/^a\./, 'frisch.')}` && aenderungen.length === 2);
  setzeKontoFetch(null);
  b.stop();
  const nStop = calls.length;
  await warte(50);
  pruefe('beobachte: stop beendet die Abfrage und meldet den Sichtbarkeits-Hoerer ab', calls.length === nStop && !b.laeuft() && (hoerer.visibilitychange || []).length === 0);
  b.stop();
  pruefe('beobachte: stop ist mehrfach erlaubt', !b.laeuft());

  // stop() waehrend einer laufenden Anfrage: die Antwort erreicht keinen Hoerer mehr
  const aenderungen7 = []; const fehler7 = [];
  antworten.push({ status: 200, body: [partie], warte: 30 });
  const b7 = beobachte(ID, { alle: 10, beiAenderung: (p) => aenderungen7.push(p), beiFehler: (e) => fehler7.push(e) });
  await warte(5);
  b7.stop();
  await warte(60);
  pruefe('beobachte: nach stop() kommt auch aus einer laufenden Anfrage kein beiAenderung mehr', aenderungen7.length === 0 && fehler7.length === 0 && !b7.laeuft() && b7.grund() === 'stop');

  // 401 und das Erneuern scheitert (totes Refresh-Token): einmal "neu anmelden", dann Schluss
  anmelden();
  const kontoAufrufe8 = [];
  setzeKontoFetch(async (url) => { kontoAufrufe8.push(url); return { ok: false, status: 400, async json() { return { error: 'invalid_grant', error_description: 'Invalid Refresh Token: Refresh Token Not Found' }; } }; });
  const fehler8 = [];
  antworten.push({ status: 401, body: { message: 'JWT expired' } });
  const n8 = calls.length;
  const b8 = beobachte(ID, { alle: 10, beiFehler: (e) => fehler8.push(e) });
  await warte(80);
  pruefe('beobachte: totes Refresh-Token: ein Erneuerungsversuch, eine deutsche Meldung, Abfrage endet', kontoAufrufe8.length === 1 && fehler8.length === 1 && /neu anmelden/.test(fehler8[0].message) && fehler8[0].abgemeldet === true && !/Invalid|Refresh Token/.test(fehler8[0].message) && !b8.laeuft() && b8.grund() === 'abgemeldet' && calls.length === n8 + 1);
  // abgelaufene Sitzung und das Erneuern scheitert: keine Abfrage, ein Versuch, Ende
  anmelden({ expiresAt: 1 });
  kontoAufrufe8.length = 0;
  const fehler9 = []; const n9 = calls.length;
  const b9 = beobachte(ID, { alle: 10, beiFehler: (e) => fehler9.push(e) });
  await warte(60);
  pruefe('beobachte: abgelaufene Sitzung, Erneuern abgelehnt: keine Partie-Abfrage, kein Dauer-Erneuern', kontoAufrufe8.length === 1 && calls.length === n9 && fehler9.length === 1 && fehler9[0].abgemeldet === true && !b9.laeuft());
  // 401 und das Erneuern scheitert nur am Netz: wie offline weiter (keine Abmeldung), naechster 401 erneuert wieder
  let kontoNetz = 0;
  setzeKontoFetch(async () => { kontoNetz++; throw new Error('netz weg'); });
  anmelden();
  const fehler12 = [];
  antworten.push({ status: 401, body: { message: 'JWT expired' } }, { status: 401, body: { message: 'JWT expired' } }, { status: 200, body: [partie] });
  const b12 = beobachte(ID, { alle: 10, beiFehler: (e) => fehler12.push(e) });
  await warte(120);
  pruefe('beobachte: Erneuern ohne Netz meldet "Keine Verbindung", meldet nicht ab und versucht beim naechsten 401 wieder', kontoNetz === 2 && b12.laeuft() && fehler12.length >= 1 && fehler12.every((e) => !e.abgemeldet) && /Keine Verbindung/.test(fehler12[0].message));
  b12.stop();
  setzeKontoFetch(null);
  anmelden();

  // beendete Partie: einmal melden, dann haelt die Abfrage an (mit bisEnde: false laeuft sie weiter)
  const aenderungen10 = [];
  antworten.push({ status: 200, body: [{ ...partie2, status: 'beendet', ergebnis: '1-0', grund: 'matt' }] });
  const b10 = beobachte(ID, { alle: 10, beiAenderung: (p) => aenderungen10.push(p) });
  await warte(15); const n10 = calls.length; await warte(40);
  pruefe('beobachte: beendete Partie wird gemeldet, danach keine Abfrage mehr', aenderungen10.length === 1 && aenderungen10[0].status === 'beendet' && !b10.laeuft() && b10.grund() === 'beendet' && calls.length === n10);
  antworten.push({ status: 200, body: [{ ...partie2, status: 'beendet', ergebnis: '1-0', grund: 'matt' }] });
  const b11 = beobachte(ID, { alle: 10, bisEnde: false });
  await warte(40);
  pruefe('beobachte: mit bisEnde: false laeuft sie weiter', b11.laeuft() && b11.grund() === null);
  b11.stop();

  const b2 = beobachte(ID, { alle: 10, seit: partie2.aktualisiert_am });
  await warte(5);
  pruefe('beobachte: seit uebernimmt den bekannten Stand (erste Abfrage schon mit Zeitfilter)', letzter().url.includes(`&aktualisiert_am=gt.${encodeURIComponent(partie2.aktualisiert_am)}`) && b2.stand() === partie2.aktualisiert_am);
  b2.stop();

  const fehler3 = [];
  const n3 = calls.length;
  antworten.push({ status: 200, body: [] });
  const b3 = beobachte(ID, { alle: 10, beiFehler: (e) => fehler3.push(e.message) });
  await warte(5);
  pruefe('beobachte: unbekannte Partie wird gemeldet', fehler3.length === 1 && fehler3[0] === FEHLER_TEXTE.ONLINE_PARTIE_UNBEKANNT && calls.length === n3 + 1);
  await warte(40);
  pruefe('beobachte: unbekannte Partie nur einmal gemeldet, danach keine Abfrage mehr', fehler3.length === 1 && calls.length === n3 + 1 && !b3.laeuft() && b3.grund() === 'unbekannt');
  b3.stop();

  abmelden();
  const fehler4 = []; const n4 = calls.length;
  const b4 = beobachte(ID, { alle: 10, beiFehler: (e) => fehler4.push(e.message) });
  await warte(25);
  pruefe('beobachte: ohne Anmeldung einmal freundlich, keine Anfrage, kein Absturz', fehler4.length === 1 && fehler4[0] === FEHLER_TEXTE.ONLINE_NICHT_ANGEMELDET && calls.length === n4);
  pruefe('beobachte: ohne Anmeldung haelt die Abfrage an (abgemeldet)', !b4.laeuft() && b4.grund() === 'abgemeldet');
  b4.stop();
  anmelden();
  const alterError = console.error; let gemeldet = 0; console.error = () => { gemeldet++; };
  const b5 = beobachte(ID, { alle: 10, beiAenderung: () => { throw new Error('kaputter Hoerer'); } });
  antworten.push({ status: 200, body: [partie] });
  await warte(25);
  console.error = alterError;
  pruefe('beobachte: ein werfender Hoerer stoppt die Abfrage nicht und landet in der Konsole', b5.laeuft() && gemeldet === 1);
  b5.stop();
  delete globalThis.document;
}

// ---------- Einladungslink ----------
{
  pruefe('einladungsLink: Basis plus #online/CODE', einladungsLink('abc234', 'https://floboldt007-cmyk.github.io/schach/') === 'https://floboldt007-cmyk.github.io/schach/#online/ABC234');
  pruefe('einladungsLink: alter Hash der Basis wird entfernt', einladungsLink('ABC234', 'https://floboldt007-cmyk.github.io/schach/#arena') === 'https://floboldt007-cmyk.github.io/schach/#online/ABC234');
  pruefe('einladungsLink: ohne location die Live-Adresse', einladungsLink('ABC234') === `${LINK_BASIS}#online/ABC234` && LINK_BASIS === 'https://floboldt007-cmyk.github.io/schach/');
  globalThis.location = { origin: 'http://localhost:9400', pathname: '/schach/', hash: '#arena' };
  pruefe('einladungsLink: Basis aus location', einladungsLink('ABC234') === 'http://localhost:9400/schach/#online/ABC234');
  globalThis.location = { origin: 'null', pathname: '/x/index.html', hash: '' };
  pruefe('einladungsLink: file:// faellt auf die Live-Adresse zurueck', einladungsLink('ABC234') === `${LINK_BASIS}#online/ABC234`);
  delete globalThis.location;
  pruefe('einladungsLink: ungueltiger Code wirft', (await fehlerVon(async () => einladungsLink('ABC')))?.message === FEHLER_TEXTE.ONLINE_CODE_UNGUELTIG);
  pruefe('codeAusLink: aus Hash und ganzer Adresse, gross geschrieben', codeAusLink('#online/abc234') === 'ABC234' && codeAusLink('https://floboldt007-cmyk.github.io/schach/#online/ABC234') === 'ABC234' && codeAusLink('#online/ABC234/') === 'ABC234');
  pruefe('codeAusLink: nichts bei anderen Hashes, falscher Laenge oder verbotenen Zeichen', codeAusLink('#arena') === null && codeAusLink('#online/ABC') === null && codeAusLink('#online/ABC2340') === null && codeAusLink('#online/ABC0I1') === null && codeAusLink('') === null && codeAusLink(null) === null);
  pruefe('normalisiereCode', normalisiereCode(' ab-c2 34 ') === 'ABC234' && normalisiereCode(null) === '');
  vergissEinladung();
  localStorage.removeItem(SICHTBAR_SCHLUESSEL);
  pruefe('Ungueltiger Einladungslink schaltet kein Konto frei', uebernimmEinladungsLink({ hash: '#online/ABC0I1' }) === null
    && localStorage.getItem(SICHTBAR_SCHLUESSEL) === null && gemerkteEinladung() === null);
  pruefe('uebernimmEinladungsLink: merkt den Code aus #online/CODE', uebernimmEinladungsLink({ hash: '#online/abc234' }) === 'ABC234' && gemerkteEinladung() === 'ABC234' && localStorage.getItem(EINLADUNG_SCHLUESSEL) === 'ABC234');
  pruefe('Gueltiger Einladungslink schaltet das Konto dauerhaft frei', localStorage.getItem(SICHTBAR_SCHLUESSEL) === '1');
  pruefe('uebernimmEinladungsLink: andere Hashes lassen den Merker in Ruhe', uebernimmEinladungsLink({ hash: '#arena' }) === null && gemerkteEinladung() === 'ABC234');
  vergissEinladung();
  pruefe('vergissEinladung: Merker leer', gemerkteEinladung() === null);
  localStorage.setItem(EINLADUNG_SCHLUESSEL, 'kaputt');
  pruefe('gemerkteEinladung: kaputter Merker zaehlt nicht', gemerkteEinladung() === null);
  vergissEinladung();
}

// ---------- Helfer ----------
{
  anmelden({ sub: 'u1' });
  const laeuft = { ...partie, status: 'laeuft', schwarz: 'u2', zuege: 'e2e4 e7e5', am_zug: 'w' };
  pruefe('meineFarbe: aus der Sitzung', meineFarbe(laeuft) === 'w' && meineFarbe({ ...laeuft, weiss: 'u2', schwarz: 'u1' }) === 'b' && meineFarbe({ ...laeuft, weiss: 'x', schwarz: 'y' }) === null && meineFarbe(null) === null);
  pruefe('meineFarbe: Sitzung nur mit Token (ohne user) ueber sub', meineFarbe(laeuft, { access_token: tokenFuer('u1') }) === 'w' && meineFarbe(laeuft, null) === null);
  pruefe('binAmZug: nur laufend und eigene Farbe am Zug', binAmZug(laeuft) === true && binAmZug({ ...laeuft, am_zug: 'b' }) === false && binAmZug({ ...laeuft, status: 'beendet' }) === false && binAmZug({ ...laeuft, status: 'offen' }) === false);
  pruefe('zuegeListe: UCI-Zuege als Liste', JSON.stringify(zuegeListe(laeuft)) === '["e2e4","e7e5"]' && zuegeListe(partie).length === 0 && zuegeListe(null).length === 0);
}

// ---------- Vertraege zu SQL, sw.js, app.js, alle.mjs ----------
{
  const sql = quelle('supabase/online-schema.sql');
  const kennungen = [...new Set([...sql.matchAll(/raise exception '(ONLINE_[A-Z_]+)'/g)].map((x) => x[1]))];
  pruefe('online-schema.sql: jede Fehlerkennung des Servers ist in FEHLER_TEXTE uebersetzt', kennungen.length >= 12 && kennungen.every((k) => typeof FEHLER_TEXTE[k] === 'string' && FEHLER_TEXTE[k].length > 10), kennungen.filter((k) => !FEHLER_TEXTE[k]).join(', '));
  const funktionen = ['online_erstelle', 'online_tritt_bei', 'online_zug', 'online_gib_auf', 'online_biete_remis', 'online_nimm_remis_an', 'online_meine', 'online_pruefe_zeit'];
  pruefe('online-schema.sql: alle Funktionen, die online.js aufruft, sind definiert und nur fuer authenticated freigegeben', funktionen.every((n) => new RegExp(`create or replace function public\\.${n}\\(`).test(sql) && new RegExp(`grant execute on function public\\.${n}\\([^)]*\\) to authenticated;`).test(sql) && new RegExp(`revoke all on function public\\.${n}\\([^)]*\\) from anon, public;`).test(sql)));
  pruefe('online-schema.sql: kein insert, update und delete fuer authenticated (nur lesen), RLS an', /revoke all on table public\.partien_online from anon, authenticated, public;/.test(sql) && /grant select on table public\.partien_online to authenticated;/.test(sql) && !/grant[^;]*\b(insert|update|delete)\b[^;]*partien_online/.test(sql) && !/create policy[^;]*for insert/.test(sql) && /alter table public\.partien_online enable row level security;/.test(sql));
  pruefe('online-schema.sql: Uhr-Pruefung in Zug, Remis, Remis-Annahme und Aufgabe; Helfer intern', (sql.match(/p := public\.online_uhr_pruefen\(p\);/g) || []).length >= 4 && /revoke all on function public\.online_uhr_pruefen\(public\.partien_online\) from anon, authenticated, public;/.test(sql) && !/grant execute on function public\.online_uhr_pruefen/.test(sql));
  pruefe('online-schema.sql: Code aus gen_random_uuid (nicht random()), Einladungen 24 Stunden', /gen_random_uuid/.test(sql.slice(sql.indexOf('online_vor_anlegen'), sql.indexOf('online_erstelle('))) && !/random\(\) \* 32/.test(sql) && /interval '24 hours'/.test(sql));
  pruefe('online-schema.sql: Zugregel (UCI) und Code-Alphabet wie in online.js', sql.includes("'^[a-h][1-8][a-h][1-8][qrbn]?$'") && sql.includes('ABCDEFGHJKLMNPQRSTUVWXYZ23456789'));
  const rls = quelle('supabase/online-rls-test.sql');
  pruefe('online-rls-test.sql: drei Nutzer, Erfolgsmeldung, rollback am Ende', (rls.match(/@example\.invalid/g) || []).length === 3 && /Online-RLS-Test erfolgreich/.test(rls) && /rollback;\s*$/.test(rls));
  pruefe('app.js uebernimmt Einladungen vor dem Routing und registriert den Online-Screen',
    /import \{ uebernimmEinladungsLink \} from '\.\/online\.js'/.test(quelle('js/app.js'))
    && /const einladung = uebernimmEinladungsLink\(\);\s*const ziel = einladung/.test(quelle('js/app.js'))
    && /const SCREENS = \[[^\]]*'online'/.test(quelle('js/app.js')) && /online: 'Gegen Freunde'/.test(quelle('js/app.js')));
  const eigene = quelle('js/online.js');
  pruefe('online.js importiert nur Konfiguration, Konto und Sprache, nie app.js, partie.js oder arena.js', [...eigene.matchAll(/from '([^']+)'/g)].map((x) => x[1]).sort().join(',') === './konto-config.js,./konto.js,./sprache.js'
    && [...eigene.matchAll(/import '([^']+)'/g)].map((x) => x[1]).join(',') === './sprachen/online.js');
  pruefe('online.js: kein setInterval, keine Supabase-Bibliothek, kein geheimer Schluessel', !/setInterval|@supabase|service_role|eyJ[A-Za-z0-9_-]{20,}/.test(eigene));
  pruefe('sw.js: js/online.js im Offline-Cache', /'js\/online\.js'/.test(quelle('sw.js')));
  const alle = quelle('tests/alle.mjs');
  pruefe('tests/alle.mjs: Suite online direkt nach konto', alle.indexOf("name: 'online'") > alle.indexOf("name: 'konto'") && alle.indexOf("name: 'online'") < alle.indexOf("name: 'storage'") && /datei: 'online\.test\.mjs'/.test(alle));
}

console.log(`${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
