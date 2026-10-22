// Tests fuer das Daten-Fundament (js/daten.js, DSGVO): Datenfreigabe nur angemeldet und mit Zustimmung,
// Partien-Archiv, Nutzungsereignisse, Warteschlange, Buendelung, Konto loeschen, Datenauskunft, Geraetekuerzel.
// Teil 1 in Node mit gefaelschtem fetch und dem echten Ereignis-Bus (Muster tests/konto.test.mjs).
// Teil 2 im Browser (Playwright, Chromium): die echte App mit der Gruppe "Daten" in den Einstellungen; alle
// Anfragen an Supabase beantwortet die Testseite selbst (page.route), es geht nichts ins Netz.
//
//   node tests/daten.test.mjs              beides
//   node tests/daten.test.mjs --nur-node   nur Teil 1
//   PORT=9500 node tests/daten.test.mjs    Port des Testservers (sonst 8840)
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { browserTyp } from './browser.mjs';

const require = createRequire(import.meta.url);
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8840);

let ok = 0, gesamt = 0;
function pruefe(name, wert, extra = '') {
  gesamt++;
  if (wert) { ok++; console.log('ok     ' + name); } else console.log('FEHLER ' + name + (extra ? ' (' + (typeof extra === 'string' ? extra : JSON.stringify(extra)) + ')' : ''));
}
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- Teil 1: Node ----------
const m = new Map();
globalThis.localStorage = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k),
  key: (i) => [...m.keys()][i] ?? null, get length() { return m.size; } };
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
Object.defineProperty(globalThis, 'navigator', { value: { userAgent: IPHONE, maxTouchPoints: 5 }, configurable: true });

const storage = await import('../js/storage.js');
storage.setzeSpeicher(globalThis.localStorage);
const { sende } = await import('../js/ereignisse.js');
const konto = await import('../js/konto.js');
const daten = await import('../js/daten.js');
const { SUPABASE_URL, SUPABASE_KEY } = await import('../js/konto-config.js');
const { darfTeilen, setzeFreigabe, merkeNutzung, warteschlange, leereWarteschlange, sendeJetzt, archivDatensatz, geraetKurz,
  loescheKonto, meineDaten, dateiFuerAuskunft, fehlerEreignis, setzeDatenFetch, konfiguriere,
  WARTESCHLANGE_SCHLUESSEL, WARTESCHLANGE_MAX, ZUSTIMMUNG_SCHLUESSEL, BUENDEL_MS, JE_ANFRAGE_MAX, FEHLER_MAX, FEHLER_JE_SITZUNG } = daten;

const anfragen = [];
const antworten = [];
let netzAus = false;
const fake = async (url, opt = {}) => {
  if (netzAus) throw new TypeError('Failed to fetch');
  anfragen.push({ url, ...opt, daten: opt.body ? JSON.parse(opt.body) : undefined });
  const x = antworten.shift() || { status: url.includes('/rest/v1/') && !url.includes('/rpc/') ? 201 : 200, body: null };
  return { ok: x.status < 400, status: x.status, async json() { if (x.body == null) throw new Error('leer'); return x.body; } };
};
setzeDatenFetch(fake);
konto.setzeKontoFetch(fake);
konfiguriere({ buendelMs: 60 });

const token = (sub, email) => 'a.' + Buffer.from(JSON.stringify({ sub, email })).toString('base64url') + '.x';
const SITZUNG = 'schach-arena:konto:sitzung';
const meldeAn = (sub = 'u1') => m.set(SITZUNG, JSON.stringify({ access_token: token(sub, sub + '@b.de'), refresh_token: 'r-' + sub, expires_at: 9999999999, email: sub + '@b.de' }));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const nurRest = () => anfragen.filter((a) => a.url.includes('/rest/v1/'));

// --- ohne Anmeldung und ohne Freigabe: nichts
{
  pruefe('Standard: Freigabe aus, nicht angemeldet -> darfTeilen() false', storage.ladeEinstellungen().datenfreigabe === 'aus' && darfTeilen() === false);
  sende('app:screen', { name: 'arena', params: {} });
  pruefe('ohne Anmeldung: kein Nutzungsereignis gemerkt', warteschlange().length === 0 && merkeNutzung('screen', { name: 'x' }) === false);
  pruefe('ohne Anmeldung: Freigabe lässt sich nicht einschalten', setzeFreigabe(true) === false && storage.ladeEinstellungen().datenfreigabe === 'aus' && !m.has(ZUSTIMMUNG_SCHLUESSEL));
  meldeAn('u1');
  sende('app:screen', { name: 'arena', params: {} });
  sende('partie:gestartet', { botId: 'benno', modus: 'normal', farbe: 'w' });
  pruefe('angemeldet, Freigabe aus: nichts gemerkt', warteschlange().length === 0 && darfTeilen() === false);
  m.set(WARTESCHLANGE_SCHLUESSEL, JSON.stringify([{ art: 'nutzung', daten: { user_id: 'u1', ereignis: 'alt' } }]));
  const r = await sendeJetzt();
  pruefe('angemeldet, Freigabe aus: kein Versand, auch nicht aus einer alten Warteschlange', r === false && anfragen.length === 0);
  m.delete(WARTESCHLANGE_SCHLUESSEL);
  storage.speichereEinstellungen({ datenfreigabe: 'an' });
  pruefe('Einstellung an, aber keine Zustimmung dieses Kontos: weiter aus', darfTeilen() === false);
  storage.speichereEinstellungen({ datenfreigabe: 'aus' });
}

// --- Freigabe einschalten: Zustimmung mit Datum, gilt nur fuer dieses Konto
{
  pruefe('Freigabe einschalten (angemeldet)', setzeFreigabe(true) === true && darfTeilen() === true && storage.ladeEinstellungen().datenfreigabe === 'an');
  const z = JSON.parse(m.get(ZUSTIMMUNG_SCHLUESSEL) || 'null');
  pruefe('Zustimmung gemerkt: Konto, Datum, Fassung', z && z.konto === 'u1' && !Number.isNaN(Date.parse(z.datum)) && z.fassung === 1, z);
  const w = warteschlange();
  pruefe('Ereignis "freigabe" gemerkt (Nachweis der Einwilligung)', w.length === 1 && w[0].art === 'nutzung' && w[0].daten.ereignis === 'freigabe'
    && w[0].daten.daten.an === true && w[0].daten.daten.fassung === 1, w);
  leereWarteschlange();
  meldeAn('u2');
  pruefe('anderes Konto auf demselben Gerät: Freigabe gilt nicht (eigene Zustimmung nötig)', darfTeilen() === false && merkeNutzung('screen', { name: 'x' }) === false);
  meldeAn('u1');
  pruefe('zurück zum zustimmenden Konto: Freigabe gilt wieder', darfTeilen() === true);
  m.set('schach-arena:v1:einstellungen', JSON.stringify({ ...JSON.parse(m.get('schach-arena:v1:einstellungen')), datenfreigabe: 'ja' }));
  pruefe('datenfreigabe mit falschem Wert fällt auf aus (kein Teilen)', storage.ladeEinstellungen().datenfreigabe === 'aus' && darfTeilen() === false);
  storage.speichereEinstellungen({ datenfreigabe: 'an' });
}

// --- Nutzungsereignisse ueber den Ereignis-Bus
{
  leereWarteschlange();
  sende('app:screen', { name: 'analyse', params: { partieId: 'p-geheim', ply: 3 } });
  sende('partie:gestartet', { laufId: 1, botId: 'benno', botStufe: 1, farbe: 'b', startFen: null, modus: 'normal', fortgesetzt: false, buehne: { gross: true } });
  const w = warteschlange();
  pruefe('app:screen -> Ereignis "screen" nur mit dem Namen (keine Parameter)', w[0]?.daten.ereignis === 'screen' && JSON.stringify(w[0].daten.daten) === '{"name":"analyse"}', w[0]);
  pruefe('partie:gestartet -> "partie_start" mit Bot, Modus, Farbe', w[1]?.daten.ereignis === 'partie_start'
    && JSON.stringify(w[1].daten.daten) === '{"bot":"benno","modus":"normal","farbe":"b","fortgesetzt":false}', w[1]);
  const z = w[0].daten;
  pruefe('jede Zeile: eigene uuid, user_id des Kontos, Gerätekürzel, App-Version-Feld', UUID.test(z.id) && z.id !== w[1].daten.id && z.user_id === 'u1'
    && z.geraet === 'iOS Safari' && 'app_version' in z, z);
  pruefe('Gerätekürzel enthält nichts vom User-Agent-String', !JSON.stringify(w).match(/Mozilla|AppleWebKit|KHTML|17_5|604\.1/));
  leereWarteschlange();
}

// --- Archiv-Datensatz
{
  const zuege = ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'g8f6', 'f3g5', 'd7d5'];
  const p = { id: 'p1', datum: '2026-10-22T10:00:00.000Z', botId: 'benno', botStufe: 1, spielerFarbe: 'b', startFen: null, zuege, san: [],
    ergebnis: 'niederlage', grund: 'matt', hinweise: 2, zuruecknahmen: 1, liveKlassen: [null, 'buch', null, 'gut', null, 'patzer', null, null],
    genauigkeit: 71.26, modus: 'normal' };
  const d = { partieId: 'p1', botId: 'benno', farbe: 'b', modus: 'normal', ergebnis: 'niederlage', grund: 'matt', eigeneZuege: 4,
    liveKlassen: p.liveKlassen, hinweise: 2, zuruecknahmen: 1, dauerMs: 125400, datum: p.datum };
  const a = archivDatensatz(d, p);
  pruefe('Archiv: Züge als UCI mit Leerzeichen, Klassen nur der eigenen Züge (fehlende als "-")', a.zuege === zuege.join(' ') && a.klassen === 'buch gut patzer -', a);
  pruefe('Archiv: Bot, Farbe, Ergebnis, Grund, Modus, Hinweise, Zurücknahmen, Dauer in s, Genauigkeit, Datum', a.bot_id === 'benno' && a.farbe === 'b'
    && a.ergebnis === 'niederlage' && a.grund === 'matt' && a.modus === 'normal' && a.hinweise === 2 && a.zuruecknahmen === 1 && a.dauer_s === 125
    && a.genauigkeit === 71.3 && a.gespielt_am === p.datum, a);
  pruefe('Archiv: genau die Spalten der Tabelle partien_archiv', JSON.stringify(Object.keys(a).sort()) === JSON.stringify(['app_version', 'bot_id', 'dauer_s',
    'ergebnis', 'farbe', 'genauigkeit', 'gespielt_am', 'grund', 'hinweise', 'klassen', 'modus', 'zuege', 'zuruecknahmen'].sort()), Object.keys(a));
  pruefe('Archiv: Partie aus eigener Stellung oder ohne Züge -> kein Datensatz (ohne Startstellung wären die Züge wertlos)',
    archivDatensatz(d, { ...p, startFen: '8/8/8/8/8/8/8/K6k w - - 0 1' }) === null && archivDatensatz(d, { ...p, zuege: [] }) === null);
  pruefe('Archiv: Grundstellung als FEN zählt nicht als eigene Stellung',
    archivDatensatz(d, { ...p, startFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' })?.zuege === a.zuege);
  const lang = archivDatensatz(d, { ...p, zuege: Array.from({ length: 5000 }, (_, i) => (i % 2 ? 'g8f6' : 'g1f3')) });
  pruefe('Archiv: zu lange Partie an einer Zuggrenze gekürzt (<= 20000 Zeichen, kein halber Zug)', lang.zuege.length <= 20000
    && lang.zuege.split(' ').every((z) => /^[a-h][1-8][a-h][1-8]$/.test(z)) && lang.klassen.length <= 4000, lang.zuege.length);

  // ueber den Bus: partie:beendet liest den gespeicherten Datensatz (nach dem Hoerer, setTimeout 0)
  m.set('schach-arena:v1:partien', JSON.stringify([p]));
  sende('partie:beendet', d);
  pruefe('partie:beendet: Hörer arbeitet nicht synchron (höchstens 2 ms)', warteschlange().length === 0);
  await warte(5);
  const w = warteschlange();
  pruefe('partie:beendet -> Archiv-Zeile und Ereignis "partie_ende"', w.length === 2 && w[0].art === 'partie' && w[0].daten.zuege === a.zuege
    && w[0].daten.user_id === 'u1' && UUID.test(w[0].daten.id) && w[1].daten.ereignis === 'partie_ende' && w[1].daten.daten.archiviert === true, w);
}

// --- Buendelung und Versand
{
  pruefe('Bündelung: höchstens alle 20 s', BUENDEL_MS === 20000);
  anfragen.length = 0;
  merkeNutzung('screen', { name: 'verlauf' });
  merkeNutzung('screen', { name: 'arena' });
  pruefe('Bündelung: nicht sofort gesendet', anfragen.length === 0);
  await warte(150);
  const rest = nurRest();
  pruefe('Bündelung: eine Anfrage je Tabelle mit allen Einträgen', rest.length === 2 && rest[0].url === SUPABASE_URL + '/rest/v1/partien_archiv'
    && rest[1].url === SUPABASE_URL + '/rest/v1/nutzung' && rest[0].daten.length === 1 && rest[1].daten.length === 3, rest.map((r) => [r.url, r.daten.length]));
  const k = rest[1].headers || {};
  pruefe('Versand: POST, Prefer: return=minimal, Bearer-Token, öffentlicher Schlüssel', rest.every((r) => r.method === 'POST') && k.Prefer === 'return=minimal'
    && k.Authorization === 'Bearer ' + token('u1', 'u1@b.de') && k.apikey === SUPABASE_KEY && /^sb_publishable_/.test(SUPABASE_KEY), k);
  pruefe('Versand: Zeilen einer Tabelle haben dieselben Schlüssel (PostgREST-Sammeleinfügen)', rest.every((r) => r.daten.every((z) => JSON.stringify(Object.keys(z)) === JSON.stringify(Object.keys(r.daten[0])))));
  pruefe('Versand: Warteschlange danach leer', warteschlange().length === 0 && !m.has(WARTESCHLANGE_SCHLUESSEL));

  // mehr als JE_ANFRAGE_MAX: in Runden
  anfragen.length = 0;
  for (let i = 0; i < JE_ANFRAGE_MAX + 5; i++) merkeNutzung('screen', { name: 's' + i });
  await sendeJetzt();
  pruefe(`Versand: höchstens ${JE_ANFRAGE_MAX} Zeilen je Anfrage, der Rest in der nächsten Runde`, nurRest().length === 1 && nurRest()[0].daten.length === JE_ANFRAGE_MAX
    && warteschlange().length === 5);
  await warte(150);
  pruefe('Versand: nächste Runde holt den Rest', nurRest().length === 2 && nurRest()[1].daten.length === 5 && warteschlange().length === 0);
}

// --- Warteschlange begrenzt, offline still, Fehlerantworten
{
  konfiguriere({ buendelMs: 100000 });
  for (let i = 0; i < WARTESCHLANGE_MAX + 50; i++) merkeNutzung('screen', { name: 'n' + i });
  const w = warteschlange();
  pruefe(`Warteschlange: höchstens ${WARTESCHLANGE_MAX} Einträge, die ältesten fallen weg`, WARTESCHLANGE_MAX === 100 && w.length === 100
    && w[0].daten.daten.name === 'n50' && w[99].daten.daten.name === 'n149');
  netzAus = true;
  let geworfen = false; let r;
  try { r = await sendeJetzt(); } catch (e) { geworfen = true; }
  pruefe('offline: still (kein Fehler nach außen), Einträge bleiben', !geworfen && r === false && warteschlange().length === 100);
  netzAus = false;
  leereWarteschlange();
  anfragen.length = 0;
  merkeNutzung('screen', { name: 'a' });
  antworten.push({ status: 503, body: { message: 'kurz weg' } });
  pruefe('Serverfehler 5xx: Einträge bleiben für später', (await sendeJetzt()) === false && warteschlange().length === 1);
  antworten.push({ status: 401, body: { message: 'JWT expired' } });
  pruefe('401: Einträge bleiben (Sitzung wird erneuert)', (await sendeJetzt()) === false && warteschlange().length === 1);
  antworten.push({ status: 409, body: { code: '23505' } });
  pruefe('409 (schon angelegt) und andere 4xx: Einträge fallen weg statt ewig zu wiederholen', (await sendeJetzt()) === true && warteschlange().length === 0);
  m.set(WARTESCHLANGE_SCHLUESSEL, '{kaputt');
  pruefe('kaputte Warteschlange: leer statt Fehler', warteschlange().length === 0 && merkeNutzung('screen', { name: 'b' }) === true && warteschlange().length === 1);
  m.set(WARTESCHLANGE_SCHLUESSEL, JSON.stringify([...warteschlange(), { art: 'nutzung', daten: { id: 'x', user_id: 'fremd', ereignis: 'screen' } }]));
  anfragen.length = 0;
  await sendeJetzt();
  pruefe('Einträge eines anderen Kontos werden nie unter diesem Konto gesendet', nurRest().length === 1 && nurRest()[0].daten.every((z) => z.user_id === 'u1')
    && warteschlange().length === 0);
}

// --- Fehler der App: nur Typ und kurze Meldung, keine Adressen, kein Stack
{
  leereWarteschlange();
  fehlerEreignis({ message: 'Uncaught ReferenceError: x is not defined at https://floboldt007-cmyk.github.io/schach/js/app.js:12:5', error: { name: 'ReferenceError', stack: 'ReferenceError\n    at https://x/js/app.js:1:1' } });
  fehlerEreignis({ reason: Object.assign(new Error('Kaputt in /home/flo/schach/js/ui/partie.js:99 ' + 'x'.repeat(400)), { name: 'TypeError' }) });
  const w = warteschlange().map((e) => e.daten);
  pruefe('Fehler: Ereignis "fehler" mit Typ und Meldung', w.length === 2 && w[0].ereignis === 'fehler' && w[0].daten.typ === 'ReferenceError' && w[1].daten.typ === 'TypeError', w);
  pruefe(`Fehler: Meldung <= ${FEHLER_MAX} Zeichen, ohne Adressen und Dateipfade, ohne Stack`, w.every((z) => z.daten.meldung.length <= FEHLER_MAX
    && !/https?:|github|\/home\/|\.js|stack|\n/.test(z.daten.meldung) && !('stack' in z.daten)), w.map((z) => z.daten.meldung));
  for (let i = 0; i < 20; i++) fehlerEreignis({ message: 'Schleife ' + i });
  pruefe(`Fehler: höchstens ${FEHLER_JE_SITZUNG} je Sitzung (keine Flut)`, warteschlange().filter((e) => e.daten.ereignis === 'fehler').length === FEHLER_JE_SITZUNG);
  leereWarteschlange();
}

// --- Freigabe ausschalten: verwirft noch nicht Gesendetes, danach nichts mehr
{
  merkeNutzung('screen', { name: 'x' });
  pruefe('Ausschalten: Warteschlange verworfen, Einstellung aus, Zustimmung entfernt', setzeFreigabe(false) === false && warteschlange().length === 0
    && storage.ladeEinstellungen().datenfreigabe === 'aus' && !m.has(ZUSTIMMUNG_SCHLUESSEL));
  sende('app:screen', { name: 'arena', params: {} });
  pruefe('Ausschalten: danach wird nichts mehr gemerkt', warteschlange().length === 0);
}

// --- Datenauskunft (Art. 15/20)
{
  setzeFreigabe(true);
  leereWarteschlange();
  merkeNutzung('screen', { name: 'wartet' });
  anfragen.length = 0;
  antworten.push({ status: 200, body: { konto: { email: 'u1@b.de' }, partien_archiv: [{ zuege: 'e2e4' }], nutzung: [] } });
  const d = await meineDaten();
  const a = anfragen[0];
  pruefe('Auskunft: rpc/meine_daten per POST mit dem Token', a.url === SUPABASE_URL + '/rest/v1/rpc/meine_daten' && a.method === 'POST' && a.headers.Authorization.startsWith('Bearer '));
  pruefe('Auskunft: Server-Daten, lokaler Stand, noch nicht Gesendetes, Zustimmung', d.format === 'crownmate-datenauskunft' && d.server.konto.email === 'u1@b.de'
    && d.geraet['schach-arena:v1:partien'] && d.noch_nicht_gesendet.length === 1 && d.noch_nicht_gesendet[0].ereignis === 'screen' && d.noch_nicht_gesendet[0].daten.name === 'wartet' && d.zustimmung.konto === 'u1', Object.keys(d));
  const f = dateiFuerAuskunft(d);
  const inhalt = JSON.parse(await f.text());
  pruefe('Auskunft: JSON-Datei crownmate-meine-daten-JJJJ-MM-TT.json', /^crownmate-meine-daten-\d{4}-\d{2}-\d{2}\.json$/.test(f.name) && f.type === 'application/json'
    && inhalt.server.partien_archiv[0].zuege === 'e2e4', f.name);
  antworten.push({ status: 401, body: { message: 'JWT expired' } });
  let fehler = ''; try { await meineDaten(); } catch (e) { fehler = e.message; }
  pruefe('Auskunft: Serverfehler kommt als lesbare Meldung', /JWT expired/.test(fehler), fehler);
}

// --- Konto loeschen (Art. 17)
{
  anfragen.length = 0;
  antworten.push({ status: 500, body: { message: 'Datenbank nicht erreichbar' } });
  let fehler = ''; try { await loescheKonto(); } catch (e) { fehler = e.message; }
  pruefe('Löschen scheitert am Server: Meldung, Sitzung und Freigabe bleiben (nichts halb gelöscht)', /Datenbank/.test(fehler) && konto.sitzung() && darfTeilen() === true, fehler);
  anfragen.length = 0;
  antworten.push({ status: 204, body: null }, { status: 204, body: null });
  await loescheKonto();
  pruefe('Löschen: rpc/konto_loeschen per POST mit dem Token, danach Abmelden', anfragen[0].url === SUPABASE_URL + '/rest/v1/rpc/konto_loeschen' && anfragen[0].method === 'POST'
    && anfragen[0].headers.Authorization === 'Bearer ' + token('u1', 'u1@b.de') && anfragen[1].url === SUPABASE_URL + '/auth/v1/logout', anfragen.map((x) => x.url));
  pruefe('Löschen: lokal abgemeldet, Warteschlange leer, Freigabe aus, Zustimmung entfernt', konto.sitzung() === null && warteschlange().length === 0
    && storage.ladeEinstellungen().datenfreigabe === 'aus' && !m.has(ZUSTIMMUNG_SCHLUESSEL) && darfTeilen() === false);
  pruefe('Löschen: Spielstand auf dem Gerät bleibt', !!m.get('schach-arena:v1:partien'));
  fehler = ''; try { await loescheKonto(); } catch (e) { fehler = e.message; }
  pruefe('Löschen ohne Anmeldung: "Nicht angemeldet", keine Anfrage', /Nicht angemeldet/.test(fehler) && anfragen.length === 2, fehler);
}

// --- Geraetekuerzel
{
  const faelle = [
    [IPHONE, {}, 'iOS Safari'],
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0 Mobile/15E148 Safari/604.1', {}, 'iOS Chrome'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15', { maxTouchPoints: 5 }, 'iPadOS Safari'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15', { maxTouchPoints: 0 }, 'Desktop Safari'],
    ['Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36', {}, 'Android Chrome'],
    ['Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36', {}, 'Android Samsung'],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0', {}, 'Desktop Firefox'],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0', {}, 'Desktop Edge'],
    ['', {}, 'Unbekannt'],
  ];
  const falsch = faelle.filter(([ua, nav, soll]) => geraetKurz(ua, nav) !== soll).map(([ua, nav, soll]) => `${soll} != ${geraetKurz(ua, nav)}`);
  pruefe('Gerätekürzel: nur Familie und System ("iOS Safari", "Android Chrome", "Desktop Firefox" ...)', falsch.length === 0, falsch.join(' | '));
  pruefe('Gerätekürzel: nie Versionsnummern oder Teile des User-Agent-Strings', faelle.every(([ua, nav]) => /^(iOS|iPadOS|Android|Desktop|Unbekannt)( [A-Za-z]+)?$/.test(geraetKurz(ua, nav))));
}

console.log(`Node-Teil: ${ok}/${gesamt}`);

// ---------- Teil 2: Browser ----------
if (!process.argv.includes('--nur-node')) await browserTeil();
console.log(`${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);

function ladePlaywright() {
  for (const k of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
    try { return require(k); } catch (e) { /* naechster */ }
  }
  throw new Error('Playwright nicht gefunden (PLAYWRIGHT_PFAD setzen)');
}
async function warteAufServer(url, ms = 10000) {
  const ende = Date.now() + ms;
  while (Date.now() < ende) {
    try { const r = await fetch(url); if (r.ok) return; } catch (e) { /* noch nicht da */ }
    await warte(150);
  }
  throw new Error('Server startet nicht: ' + url);
}

async function browserTeil() {
  const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: WURZEL, stdio: 'ignore' });
  let browser;
  try {
    await warteAufServer(`http://127.0.0.1:${PORT}/index.html`);
    browser = await browserTyp(ladePlaywright()).launch();
    await browserAblauf(browser);
  } catch (e) {
    pruefe('Browser-Teil läuft durch', false, e.stack || e.message);
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
}

async function browserAblauf(browser) {
  const BASIS = `http://127.0.0.1:${PORT}/`;
  const kontext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', acceptDownloads: true });
  const seite = await kontext.newPage();
  const fehler = [];
  seite.on('pageerror', (e) => fehler.push('pageerror: ' + e.message));
  seite.on('console', (x) => { if (x.type() === 'error') fehler.push('console: ' + x.text()); });
  // Supabase beantwortet die Testseite selbst; alles wird mitgeschrieben
  const netz = [];
  await kontext.route(SUPABASE_URL + '/**', async (route) => {
    const r = route.request();
    const url = r.url();
    netz.push({ url, methode: r.method(), body: r.postData(), kopf: r.headers() });
    if (url.includes('/rpc/meine_daten')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ konto: { email: 'b@b.de' }, partien_archiv: [], nutzung: [] }) });
    if (url.includes('/auth/v1/authorize')) return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Google-Attrappe</title><p>Anmeldung</p>' });
    return route.fulfill({ status: url.includes('/rest/v1/') && !url.includes('/rpc/') ? 201 : 204, body: '' });
  });

  // ohne Konto-Freischaltung: keine Gruppe "Daten"
  await seite.goto(BASIS + '?test#einstellungen');
  await seite.waitForSelector('.es-inhalt');
  pruefe('Browser: ohne #konto keine Gruppe "Daten" (wie die Konto-Gruppe)', (await seite.locator('.daten-gruppe').count()) === 0);
  pruefe('Browser: Info verlinkt Datenschutzerklärung und Impressum', await seite.evaluate(() => {
    const a = [...document.querySelectorAll('.es-info a')].map((x) => x.getAttribute('href'));
    return a.some((h) => /datenschutz\.html$/.test(h)) && a.some((h) => /impressum\.html$/.test(h));
  }));

  // freigeschaltet, nicht angemeldet: Hinweis, Schalter aus und gesperrt, keine Knoepfe; Google-Knopf in der Konto-Gruppe
  // #konto schaltet beim Laden der Seite frei (wie ein geteilter Link), danach direkt in die Einstellungen
  await seite.goto('about:blank');
  await seite.goto(BASIS + '?test#konto');
  await seite.waitForFunction(() => localStorage.getItem('schach-arena:konto:sichtbar') === '1');
  await seite.evaluate(() => { location.hash = '#einstellungen'; });
  await seite.waitForSelector('.daten-gruppe');
  const vorKonto = await seite.evaluate(() => {
    const g = document.querySelector('.daten-gruppe');
    const kg = document.querySelector('.konto-gruppe');
    const s = g.querySelector('.schalter[data-schalter="datenfreigabe"]');
    return { reihe: !!(kg && kg.compareDocumentPosition(g) & Node.DOCUMENT_POSITION_FOLLOWING), text: g.textContent, an: s.getAttribute('aria-checked'), gesperrt: s.disabled,
      knoepfe: g.querySelectorAll('[data-daten]').length, google: kg.querySelector('[data-konto="google"]')?.textContent, loeschenAlt: !!kg.querySelector('[data-konto="loeschen"]') };
  });
  pruefe('Browser: Gruppe "Daten" direkt nach der Konto-Gruppe', vorKonto.reihe);
  pruefe('Browser: ohne Anmeldung "Zum Teilen erst anmelden", Schalter aus und gesperrt, keine Knöpfe', /Zum Teilen erst anmelden/.test(vorKonto.text) && vorKonto.an === 'false'
    && vorKonto.gesperrt && vorKonto.knoepfe === 0, vorKonto);
  pruefe('Browser: Erklärtext nennt was, wozu, wo, wer, Widerruf und Eltern unter 16', ['Partien', 'Bots', 'Coach', 'Trainingspläne', 'Frankfurt', 'Betreiber', 'Dritte',
    'Werbung', 'Ausschalten', 'Unter 16', 'Eltern'].every((w) => vorKonto.text.includes(w)));
  pruefe('Browser: Konto-Gruppe bietet "Mit Google anmelden" (nur Text), der Platzhalter "per E-Mail" ist weg', vorKonto.google === 'Mit Google anmelden' && !vorKonto.loeschenAlt);
  await seite.click('.daten-gruppe .daten-zeile .es-text');
  pruefe('Browser: gesperrter Schalter bleibt aus (auch per Tipp auf den Text)', (await seite.evaluate(() => JSON.parse(localStorage.getItem('schach-arena:v1:einstellungen') || '{}').datenfreigabe)) !== 'an');

  // Google-Anmeldung: Weiterleitung zu Supabase /auth/v1/authorize
  await Promise.all([seite.waitForURL(/\/auth\/v1\/authorize/), seite.click('[data-konto="google"]')]);
  const ziel = new URL(seite.url());
  pruefe('Browser: "Mit Google anmelden" leitet zu /auth/v1/authorize?provider=google mit redirect_to auf die App (#konto)',
    ziel.origin + ziel.pathname === SUPABASE_URL + '/auth/v1/authorize' && ziel.searchParams.get('provider') === 'google'
    && ziel.searchParams.get('redirect_to') === BASIS + '?test#konto', seite.url());
  // Rueckkehr wie von Supabase: #konto#access_token=...
  const tok = token('b-user', 'b@b.de');
  await seite.goto(`${BASIS}?test#konto#access_token=${tok}&expires_at=9999999999&expires_in=3600&provider_token=GOOGLE&refresh_token=rb&token_type=bearer`);
  await seite.waitForSelector('.daten-gruppe [data-daten="auskunft"]');
  const zurueck = await seite.evaluate(() => ({ hash: location.hash, s: JSON.parse(localStorage.getItem('schach-arena:konto:sitzung') || 'null') }));
  pruefe('Browser: Rückkehr von Google angemeldet, Tokens aus der Adresse entfernt, Einstellungen offen', zurueck.hash === '#einstellungen' && zurueck.s?.refresh_token === 'rb'
    && !JSON.stringify(zurueck.s).includes('GOOGLE'), zurueck);

  // angemeldet: Schalter an (per Tipp auf den Text), Zustimmung
  const angemeldet = await seite.evaluate(() => {
    const s = document.querySelector('.daten-gruppe .schalter[data-schalter="datenfreigabe"]');
    return { an: s.getAttribute('aria-checked'), gesperrt: s.disabled, text: document.querySelector('.daten-gruppe').textContent };
  });
  pruefe('Browser: angemeldet Schalter bedienbar, Standard aus, Knöpfe da', angemeldet.an === 'false' && !angemeldet.gesperrt
    && /Meine Daten herunterladen/.test(angemeldet.text) && /Konto löschen/.test(angemeldet.text), angemeldet);
  await seite.click('.daten-gruppe .schalter[data-schalter="datenfreigabe"]');
  const nachAn = await seite.evaluate(() => ({ e: JSON.parse(localStorage.getItem('schach-arena:v1:einstellungen')).datenfreigabe,
    z: JSON.parse(localStorage.getItem('schach-arena:daten:zustimmung') || 'null'), w: JSON.parse(localStorage.getItem('schach-arena:daten:warteschlange') || '[]'),
    status: document.querySelector('.daten-status').textContent, an: document.querySelector('.daten-gruppe .schalter').getAttribute('aria-checked') }));
  pruefe('Browser: Schalter an -> Einstellung an, Zustimmung dieses Kontos, Ereignis "freigabe", Meldung', nachAn.e === 'an' && nachAn.z?.konto === 'b-user'
    && nachAn.w.some((x) => x.daten.ereignis === 'freigabe') && nachAn.an === 'true' && /geteilt/.test(nachAn.status), nachAn);
  // Verlassen der Seite (Tab im Hintergrund) sendet sofort, nur mit return=minimal
  netz.length = 0;
  await seite.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await seite.waitForFunction(() => !localStorage.getItem('schach-arena:daten:warteschlange'), null, { timeout: 5000 }).catch(() => {});
  const gesendet = netz.filter((x) => x.url.endsWith('/rest/v1/nutzung'));
  pruefe('Browser: beim Verlassen (visibilitychange) gebündelt gesendet, Prefer: return=minimal, kein User-Agent-String im Inhalt', gesendet.length === 1
    && gesendet[0].kopf.prefer === 'return=minimal' && !/Mozilla|HeadlessChrome|AppleWebKit/.test(gesendet[0].body) && JSON.parse(gesendet[0].body)[0].user_id === 'b-user',
    netz.map((x) => x.url));
  await seite.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); });

  // Meine Daten herunterladen
  const [download] = await Promise.all([seite.waitForEvent('download'), seite.click('[data-daten="auskunft"]')]);
  const pfad = await download.path();
  const inhalt = JSON.parse((await import('node:fs')).readFileSync(pfad, 'utf8'));
  pruefe('Browser: "Meine Daten herunterladen" liefert die JSON-Datei mit Server- und Gerätedaten', /^crownmate-meine-daten-\d{4}-\d{2}-\d{2}\.json$/.test(download.suggestedFilename())
    && inhalt.server.konto.email === 'b@b.de' && typeof inhalt.geraet === 'object' && netz.some((x) => x.url.endsWith('/rest/v1/rpc/meine_daten')), download.suggestedFilename());

  // Konto loeschen: zweistufig, Abbrechen loescht nichts
  netz.length = 0;
  await seite.click('[data-daten="loeschen"]');
  await seite.waitForSelector('.sheet-karte');
  const blatt1 = await seite.locator('.sheet-karte').textContent();
  pruefe('Browser: Löschen Stufe 1 nennt, was gelöscht wird', ['Konto', 'E-Mail', 'Benutzername', 'Cloud-Spielstand', 'Partien', 'Nutzungsdaten', 'Gerät bleibt'].every((w) => blatt1.includes(w)), blatt1);
  await seite.click('.sheet-knoepfe .knopf:not(.gefahr)');
  await seite.waitForFunction(() => !document.querySelector('.sheet-ort:not(.weg)'));
  pruefe('Browser: Abbrechen in Stufe 1 löscht nichts', !netz.some((x) => x.url.includes('konto_loeschen')) && await seite.evaluate(() => !!localStorage.getItem('schach-arena:konto:sitzung')));
  await seite.click('[data-daten="loeschen"]');
  await seite.click('.sheet-ort:not(.weg) .sheet-knoepfe .knopf.gefahr');
  await seite.waitForFunction(() => /endgültig/.test(document.querySelector('.sheet-ort:not(.weg) .sheet-karte')?.textContent || ''));
  pruefe('Browser: Stufe 2 fragt noch einmal, noch nichts gelöscht', !netz.some((x) => x.url.includes('konto_loeschen')));
  await seite.click('.sheet-ort:not(.weg) .sheet-knoepfe .knopf.gefahr');
  await seite.waitForFunction(() => !localStorage.getItem('schach-arena:konto:sitzung'), null, { timeout: 5000 }).catch(() => {});
  const nachLoeschen = await seite.evaluate(() => ({ s: localStorage.getItem('schach-arena:konto:sitzung'), e: JSON.parse(localStorage.getItem('schach-arena:v1:einstellungen')).datenfreigabe,
    text: document.querySelector('.daten-gruppe')?.textContent || '', toast: document.querySelector('.toast')?.textContent || '' }));
  pruefe('Browser: nach Stufe 2 rpc/konto_loeschen, abgemeldet, Freigabe aus, Meldung', netz.some((x) => x.url.endsWith('/rest/v1/rpc/konto_loeschen') && x.methode === 'POST')
    && nachLoeschen.s === null && nachLoeschen.e === 'aus' && /Konto gelöscht/.test(nachLoeschen.text + nachLoeschen.toast) && /Zum Teilen erst anmelden/.test(nachLoeschen.text), nachLoeschen);
  await seite.waitForSelector('.konto-gruppe .konto-email', { timeout: 3000 }).catch(() => {});
  pruefe('Browser: Konto-Gruppe zeigt danach wieder die Anmeldung (nicht mehr "Angemeldet als")', await seite.evaluate(() => {
    const kg = document.querySelector('.konto-gruppe');
    return !!kg.querySelector('.konto-email') && !/Angemeldet als/.test(kg.textContent);
  }));

  // Datenschutzerklaerung und Impressum: erreichbar, Entwurf-Kasten, nur Platzhalter
  for (const [datei, muss] of [['datenschutz.html', ['Entwurf', 'fachkundigen Person', 'Frankfurt', 'GitHub', 'Google', 'Art. 6 Abs. 1 lit. a', 'Art. 6 Abs. 1 lit. b', 'Eltern', 'Werbung', 'Beschwerde']],
    ['impressum.html', ['Entwurf', '§ 5 DDG', '[Vor- und Nachname]']]]) {
    const s2 = await kontext.newPage();
    const r = await s2.goto(BASIS + datei);
    const t = await s2.evaluate(() => document.body.innerText);
    const css = await s2.evaluate(() => ({ grund: getComputedStyle(document.body).backgroundColor, text: getComputedStyle(document.body).color }));
    pruefe(`Browser: ${datei} erreichbar, Entwurf-Hinweis und Pflichtinhalte`, r.status() === 200 && muss.every((w) => t.includes(w)), muss.filter((w) => !t.includes(w)).join(', '));
    pruefe(`Browser: ${datei} ohne echte persönliche Daten (nur Platzhalter in eckigen Klammern)`, !/[A-Za-z0-9._%+-]+@(?!example\b)[A-Za-z0-9-]+\.[a-z]{2,}|\+49|\b\d{5}\s+[A-ZÄÖÜ][a-zäöü]+/.test(t) && /\[[^\]]+\]/.test(t));
    pruefe(`Browser: ${datei} nutzt die Farben der App (Tokens)`, css.grund !== 'rgba(0, 0, 0, 0)' && css.grund !== css.text, css);
    await s2.close();
  }
  pruefe('Browser: keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
  await kontext.close();
}
