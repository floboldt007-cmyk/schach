// Schulmodus (Welle B3), Client: js/schule.js, das Paket js/pakete/schule/ und der Paket-Screen js/ui/schule.js.
// Node-Teil mit gefaelschtem fetch (Eingaben, Aufrufe und ihr Vertrag mit supabase/schule-schema.sql, Fehlergruende,
// Zwischenspeicher, offline, Fortschritt und Fehlerarten, Aufgaben-Stand, gebuendeltes Melden), danach Browser-Teil gegen
// die echte App (index.html?test) mit einem gefaelschten Supabase-Server ueber page.route: Lehrkraft-Ansicht (Klasse
// anlegen, Code gross, Mitglieder sortieren und entfernen, Aufgaben, schliessen, loeschen), Gruppe "Klasse" in den
// Einstellungen (beitreten mit Hinweis, austreten), Zeile in der Heute-Karte, Melden nach der Partie (auch offline),
// Handy und iPad, hell und dunkel. Die echte Supabase wird nie aufgerufen.
//
// Das Paket wird ueber ?test&erw=pakete/schule/index geladen, bis die Integration es in PAKETE eintraegt.
//   node tests/schule.test.mjs              alles
//   node tests/schule.test.mjs --nur-node   ohne Browser
//   PORT=9800 BILDER=<ordner> node tests/schule.test.mjs   eigener Port (Standard 8876), Bildschirmfotos in <ordner>
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { setzeSpeicher, ladeFortschritt, rohSpeicher } from '../js/storage.js';
import { setzeKontoFetch, SITZUNG_SCHLUESSEL, lokalerStand } from '../js/konto.js';
import {
  setzeSchuleFetch, setzeSchuleUhr, normalisiereCode, pruefeAnzeigename, pruefeKlassenname, fehlerText, meineKlassen, meineKlassenGespeichert,
  erstelleKlasse, trittBei, verlasse, uebersicht, aufgabeAnlegen, aufgabeLoeschen, entferneMitglied, schliesseKlasse, loescheKlasse,
  fortschrittJetzt, haeufigsteFehler, aufgabeStand, zielText, faelligText, offeneAufgabe, merkeRaetsel, planeMeldung, meldeJetzt, meldungOffen,
  aufraeumen, sortiereMitglieder, TEXTE, WAS_DIE_LEITUNG_SIEHT, STAND_SCHLUESSEL, OFFEN_SCHLUESSEL, GEMELDET_SCHLUESSEL, RAETSEL_SCHLUESSEL,
  STAND_MS, BUENDEL_MS, FEHLER_FENSTER, ALT_TAGE,
} from '../js/schule.js';
import { COUNTDOWN_RE } from '../js/inhalte.js';
import { tagSchluessel, addiereTage } from '../js/tag.js';
import { browserTyp } from './browser.mjs';

const require = createRequire(import.meta.url);
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8876);
// Das Paket steht noch nicht in PAKETE (das macht die Integration, js/erweiterungen.js): im Test ueber ?erw laden.
const BASIS = `http://127.0.0.1:${PORT}/index.html?test&erw=pakete/schule/index`;
const NUR_NODE = process.argv.includes('--nur-node');
const BILDER = process.env.BILDER ? path.join(process.env.BILDER, 'schule') : '';
if (BILDER) mkdirSync(BILDER, { recursive: true });
const SUPA = 'https://usaamcqypmvgqmsbfecb.supabase.co';
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

let ok = 0;
let gesamt = 0;
let gruppe = '';
function pruefe(name, bedingung, info) {
  gesamt++;
  const n = (gruppe ? gruppe + ': ' : '') + name;
  if (bedingung) { ok++; console.log('ok     ' + n); } else console.log('FEHLER ' + n + (info !== undefined ? '  -> ' + JSON.stringify(info) : ''));
}

const UID_L = '0c1d2e3f-4a5b-4c6d-8e7f-8091a2b3c4d5';
const UID_A = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
const MAIL_L = 'lehrkraft.probe@example.invalid';
const MAIL_A = 'schuelerin.probe@example.invalid';
const token = (sub) => 'a.' + Buffer.from(JSON.stringify({ sub })).toString('base64url') + '.x';
const sitzungVon = (uid, mail) => ({ access_token: token(uid), refresh_token: 'r1', expires_at: 9999999999, user: { id: uid, email: mail }, email: mail });
const DRUCK = ['nur heute', 'nur noch', 'letzte Chance', 'limitiert', 'endet in', 'läuft ab', 'verfällt', 'verpasst du', 'Beeil', 'Wir vermissen dich',
  'Serie verloren', 'wartet auf dich', 'hat dich überholt', 'Abstieg', 'zu spät'];
const T0 = Date.parse('2026-10-20T10:00:00Z');
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

// SQL-Parameter je Funktion (Vertrag: der Client schickt genau diese Namen)
const SQL = readFileSync(path.join(WURZEL, 'supabase/schule-schema.sql'), 'utf8').split('\n').map((z) => z.replace(/--.*$/, '')).join('\n');
const SQL_PARAMS = Object.fromEntries([...SQL.matchAll(/create or replace function public\.(schule_[a-z_]+)\(([^)]*)\)/g)]
  .map((m) => [m[1], m[2].split(',').map((p) => p.trim()).filter(Boolean).map((p) => p.split(/\s+/)[0])]));

// =====================================================================
// Node-Teil
// =====================================================================
async function nodeTeil() {
  gruppe = 'Node';
  const m = new Map();
  globalThis.localStorage = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k),
    key: (i) => [...m.keys()][i] ?? null, get length() { return m.size; } };
  Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'Test', onLine: true }, configurable: true });
  setzeSpeicher(globalThis.localStorage);
  let jetzt = T0;
  setzeSchuleUhr(() => jetzt);

  // ---------- Eingaben ----------
  pruefe('normalisiereCode: klein, Leerzeichen, Bindestrich werden zum Code', normalisiereCode('k7q-2mx') === 'K7Q2MX' && normalisiereCode(' K7Q 2MX ') === 'K7Q2MX');
  pruefe('normalisiereCode: 0, O, 1, I und falsche Laenge gibt es nicht', normalisiereCode('K7Q2M0') === null && normalisiereCode('K7Q2MO') === null
    && normalisiereCode('K7Q2M1') === null && normalisiereCode('K7Q2MI') === null && normalisiereCode('K7Q2M') === null && normalisiereCode('K7Q2MXX') === null
    && normalisiereCode(null) === null);
  const gut = ['Anna', 'Anna-Lena', "O'Neil", 'Änne', 'Max M.', 'Jo', 'Øyvind', 'Ślęzak', 'Kim 2'];
  const schlecht = ['A', '12', 'anna@schule.de', '<b>x', 'x'.repeat(25), '', '   ', 'Anna_Lena', 'Ann;a'];
  pruefe('pruefeAnzeigename: Vornamen und Spitznamen (auch mit Akzent) ja', gut.every((n) => pruefeAnzeigename(n).ok), gut.filter((n) => !pruefeAnzeigename(n).ok));
  pruefe('pruefeAnzeigename: E-Mail, ohne Buchstaben, zu kurz, zu lang, Sonderzeichen nein', schlecht.every((n) => !pruefeAnzeigename(n).ok
    && pruefeAnzeigename(n).grund === 'SCHULE_NAME_UNGUELTIG'), schlecht.filter((n) => pruefeAnzeigename(n).ok));
  pruefe('pruefeAnzeigename: Leerraum zusammengefasst', pruefeAnzeigename('  Anna   Lena ').name === 'Anna Lena');
  pruefe('pruefeKlassenname: 2 bis 40 Zeichen, ohne @ und Spitzklammern', pruefeKlassenname(' Q1  Schach-AG ').name === 'Q1 Schach-AG' && pruefeKlassenname('Q1 Schach-AG').ok
    && !pruefeKlassenname('x').ok && !pruefeKlassenname('lehrer@schule.de').ok && !pruefeKlassenname('a'.repeat(41)).ok && !pruefeKlassenname('<i>x</i>').ok);
  pruefe('fehlerText: Klassenname und Anzeigename mit eigenem Satz, Unbekanntes als Serverfehler',
    fehlerText('SCHULE_NAME_UNGUELTIG', { was: 'klasse' }) === TEXTE.SCHULE_NAME_UNGUELTIG_KLASSE && /Anzeigename/.test(fehlerText('SCHULE_NAME_UNGUELTIG'))
    && fehlerText('quatsch') === TEXTE.server);

  // ---------- gefaelschter Server ----------
  const srv = { modus: 'ok', status: 200, antworten: {}, stand: { leitung: [], mitglied: [] } };
  const aufrufe = [];
  setzeSchuleFetch(async (url, opt) => {
    const name = String(url).replace(`${SUPA}/rest/v1/rpc/`, '');
    aufrufe.push({ url, name, ...opt, daten: opt.body ? JSON.parse(opt.body) : null });
    if (srv.modus === 'offline') throw new Error('offline');
    const fehler = srv.fehler && srv.fehler[name];
    if (fehler) return { ok: false, status: fehler.status, async json() { return fehler.body; } };
    const body = name === 'schule_meine_klassen' ? srv.stand : (name in srv.antworten ? srv.antworten[name] : true);
    return { ok: true, status: 200, async json() { return typeof body === 'function' ? body(JSON.parse(opt.body || '{}')) : body; } };
  });
  setzeKontoFetch(async () => { throw new Error('nicht aufrufen'); });

  // ---------- ohne Anmeldung ----------
  pruefe('ohne Anmeldung: meineKlassen abgemeldet, ohne Netz', (await meineKlassen()).grund === 'abgemeldet' && aufrufe.length === 0);
  pruefe('ohne Anmeldung: Beitreten abgemeldet, ohne Netz', (await trittBei('K7Q2MX', 'Anna')).grund === 'abgemeldet' && aufrufe.length === 0);
  pruefe('ohne Anmeldung: nichts zu melden', planeMeldung() === false && !m.has(OFFEN_SCHLUESSEL));

  // ---------- Meine Klassen ----------
  localStorage.setItem(SITZUNG_SCHLUESSEL, JSON.stringify(sitzungVon(UID_A, MAIL_A)));
  const KLASSE = uuid(1);
  const A_BOT = uuid(11);
  const A_PARTIEN = uuid(12);
  const A_RAETSEL = uuid(13);
  srv.stand = { leitung: [], mitglied: [{ klasse: KLASSE, name: 'Q1 Schach-AG', aktiv: true, mitglied: uuid(5), anzeigename: 'Anna', erledigt: [],
    beigetreten_am: new Date(T0 - 86400e3).toISOString(),
    aufgaben: [
      { id: A_BOT, titel: 'Gabeln mit Rudi', art: 'bot', ziel: { bot: 'rudi', sterne: 1 }, faellig: '2026-10-30', erstellt_am: new Date(T0 - 3600e3).toISOString() },
      { id: A_PARTIEN, titel: 'Drei Partien', art: 'partien', ziel: { anzahl: 3 }, faellig: null, erstellt_am: new Date(T0 - 7200e3).toISOString() },
      { id: A_RAETSEL, titel: 'Zwei Rätsel', art: 'raetsel', ziel: { anzahl: 2 }, faellig: null, erstellt_am: new Date(T0 - 7200e3).toISOString() },
    ] }] };
  const r1 = await meineKlassen();
  const q = aufrufe.at(-1);
  pruefe('meineKlassen: POST an rpc/schule_meine_klassen mit Token und apikey', r1.ok && q.url === `${SUPA}/rest/v1/rpc/schule_meine_klassen` && q.method === 'POST'
    && q.headers.Authorization === 'Bearer ' + token(UID_A) && !!q.headers.apikey && JSON.stringify(q.daten) === '{}');
  pruefe('meineKlassen: Daten im Zwischenspeicher je Nutzer (ausserhalb von schach-arena:v1:)', meineKlassenGespeichert().mitglied[0].name === 'Q1 Schach-AG'
    && JSON.parse(m.get(STAND_SCHLUESSEL)).uid === UID_A && !STAND_SCHLUESSEL.startsWith('schach-arena:v1:'));
  const n0 = aufrufe.length;
  await meineKlassen();
  jetzt = T0 + STAND_MS - 1000;
  await meineKlassen();
  pruefe('meineKlassen: innerhalb von STAND_MS aus dem Zwischenspeicher', aufrufe.length === n0);
  jetzt = T0 + STAND_MS + 1000;
  await meineKlassen();
  await meineKlassen({ neu: true });
  pruefe('meineKlassen: danach und mit neu: true wieder vom Server', aufrufe.length === n0 + 2);
  srv.modus = 'offline';
  const off = await meineKlassen({ neu: true });
  pruefe('meineKlassen offline: letzter Stand mit offline: true', off.ok && off.offline === true && off.daten.mitglied.length === 1);
  srv.modus = 'ok';
  localStorage.setItem(SITZUNG_SCHLUESSEL, JSON.stringify(sitzungVon(UID_L, MAIL_L)));
  pruefe('anderes Konto auf dem Geraet: kein fremder Zwischenspeicher', meineKlassenGespeichert() === null);
  srv.modus = 'offline';
  pruefe('anderes Konto offline ohne Zwischenspeicher: offline', (await meineKlassen()).grund === 'offline');
  srv.modus = 'ok';

  // ---------- Fehlergruende ----------
  const faelle = [
    ['400 mit Kennung', { status: 400, body: { code: 'P0001', message: 'SCHULE_NAME_VERGEBEN' } }, 'SCHULE_NAME_VERGEBEN'],
    ['401', { status: 401, body: { message: 'JWT expired' } }, 'abgemeldet'],
    ['404 (Schema fehlt)', { status: 404, body: { code: 'PGRST202', message: 'Could not find the function' } }, 'nicht_eingerichtet'],
    ['500', { status: 500, body: { message: 'boom' } }, 'server'],
    ['502 ohne Koerper', { status: 502, body: undefined }, 'server'],
  ];
  for (const [name, fehler, grund] of faelle) {
    srv.fehler = { schule_tritt_bei: fehler };
    const r = await trittBei('K7Q2MX', 'Anna');
    pruefe(`Fehler ${name} -> ${grund}`, r.ok === false && r.grund === grund, r);
  }
  srv.fehler = null;
  srv.antworten.schule_tritt_bei = { fehler: 'SCHULE_CODE_UNGUELTIG' };
  pruefe('falscher Code (Server zaehlt ohne raise): SCHULE_CODE_UNGUELTIG', (await trittBei('K7Q2MX', 'Anna')).grund === 'SCHULE_CODE_UNGUELTIG');
  const nVorher = aufrufe.length;
  pruefe('sichtbar falscher Code und falscher Name gehen nicht zum Server (zaehlen dort nicht als Fehlversuch)',
    (await trittBei('K7Q2M0', 'Anna')).grund === 'SCHULE_CODE_UNGUELTIG' && (await trittBei('K7Q2MX', 'a@b.de')).grund === 'SCHULE_NAME_UNGUELTIG'
    && (await erstelleKlasse('x')).grund === 'SCHULE_NAME_UNGUELTIG' && aufrufe.length === nVorher);
  srv.modus = 'offline';
  pruefe('offline: grund offline (kein Absturz)', (await uebersicht(KLASSE)).grund === 'offline' && (await verlasse(KLASSE)).grund === 'offline');
  srv.modus = 'ok';
  pruefe('alle Saetze deutsch und ohne Druck oder Countdown', Object.values(TEXTE).every((t) => t.length > 10 && !DRUCK.some((w) => t.toLowerCase().includes(w.toLowerCase()))
    && !COUNTDOWN_RE.test(t)));
  pruefe('Hinweis vor dem Beitritt: was die Lehrkraft sieht und was nicht (E-Mail, Partien), Austreten jederzeit',
    /Anzeigenamen/.test(WAS_DIE_LEITUNG_SIEHT) && /Genauigkeit/.test(WAS_DIE_LEITUNG_SIEHT) && /Nicht: deine E-Mail-Adresse, deine Partien/.test(WAS_DIE_LEITUNG_SIEHT)
    && /Austreten geht jederzeit/.test(WAS_DIE_LEITUNG_SIEHT));

  // ---------- Vertrag: jeder Aufruf schickt genau die Parameter der SQL-Funktion ----------
  srv.antworten = {
    schule_erstelle_klasse: { id: KLASSE, name: 'Q1 Schach-AG', code: 'K7Q2MX', aktiv: true },
    schule_tritt_bei: { klasse: { id: KLASSE, name: 'Q1 Schach-AG' }, mitglied: { id: uuid(5), anzeigename: 'Anna Lena' } },
    schule_klassen_uebersicht: { klasse: { id: KLASSE }, mitglieder: [], aufgaben: [] },
    schule_aufgabe_anlegen: { id: uuid(20), titel: 'X', art: 'partien', ziel: { anzahl: 2 } },
    schule_melde_fortschritt: 1,
  };
  aufrufe.length = 0;
  const e1 = await erstelleKlasse('  Q1   Schach-AG ');
  const e2 = await trittBei('k7q-2mx', '  Anna   Lena ');
  await verlasse(KLASSE);
  await uebersicht(KLASSE);
  await aufgabeAnlegen(KLASSE, { titel: '  Zwei   Partien ', art: 'partien', ziel: { anzahl: 2 }, faellig: '' });
  await aufgabeLoeschen(uuid(20));
  await entferneMitglied(uuid(5));
  await schliesseKlasse(KLASSE);
  await loescheKlasse(KLASSE);
  await meldeJetzt();
  const gesendet = Object.fromEntries(aufrufe.filter((a) => a.name !== 'schule_meine_klassen').map((a) => [a.name, Object.keys(a.daten)]));
  const falsch = Object.entries(gesendet).filter(([n, keys]) => JSON.stringify(keys) !== JSON.stringify(SQL_PARAMS[n]));
  pruefe('Vertrag: jede Funktion bekommt genau ihre SQL-Parameter (11 Funktionen)', Object.keys(gesendet).length === 10 && falsch.length === 0
    && aufrufe.some((a) => a.name === 'schule_meine_klassen'), { falsch, gesendet: Object.keys(gesendet) });
  pruefe('Werte: Name und Anzeigename sauber, Code normalisiert, leeres Datum als null', e1.ok && e1.klasse.code === 'K7Q2MX' && e2.ok
    && aufrufe.find((a) => a.name === 'schule_erstelle_klasse').daten.name === 'Q1 Schach-AG'
    && JSON.stringify(aufrufe.find((a) => a.name === 'schule_tritt_bei').daten) === '{"code":"K7Q2MX","anzeigename":"Anna Lena"}'
    && JSON.stringify(aufrufe.find((a) => a.name === 'schule_aufgabe_anlegen').daten)
      === JSON.stringify({ klasse: KLASSE, titel: 'Zwei Partien', art: 'partien', ziel: { anzahl: 2 }, faellig: null }));
  pruefe('nach jeder Aenderung ist "Meine Klassen" neu geholt', aufrufe.filter((a) => a.name === 'schule_meine_klassen').length >= 8);
  pruefe('keine Anfrage traegt die E-Mail-Adresse oder die Nutzer-ID im Koerper', aufrufe.every((a) => !String(a.body || '').includes(MAIL_L)
    && !String(a.body || '').includes(UID_L)));

  // ---------- Aufgaben: Texte ----------
  pruefe('zielText', zielText({ art: 'bot', ziel: { bot: 'rudi', sterne: 1 } }) === 'Ritter Rudi besiegen'
    && zielText({ art: 'bot', ziel: { bot: 'benno', sterne: 2 } }) === 'Bauer Benno besiegen mit 2 Sternen'
    && zielText({ art: 'partien', ziel: { anzahl: 5 } }) === '5 Partien spielen' && zielText({ art: 'partien', ziel: { anzahl: 1 } }) === '1 Partie spielen'
    && zielText({ art: 'raetsel', ziel: { anzahl: 10 } }) === '10 Rätsel lösen');
  pruefe('faelligText: ein Termin mit Wochentag, kein Countdown', faelligText('2026-10-30') === 'bis Fr 30.10.' && faelligText('2026-11-02') === 'bis Mo 02.11.'
    && faelligText(null) === '' && faelligText('30.10.2026') === '' && !COUNTDOWN_RE.test(faelligText('2026-10-30')));

  // ---------- Fortschritt ----------
  const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const partie = (i, extra) => ({ id: 'p' + i, datum: new Date(T0 - (100 - i) * 60e3).toISOString(), botId: 'benno', spielerFarbe: 'w', startFen: START,
    zuege: ['e2e4', 'e7e5'], liveKlassen: [null, null], modus: 'normal', ...extra });
  const weiss = partie(90, { zuege: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'f8c5'], liveKlassen: ['fehler', 'patzer', 'ungenau', null, 'fehler', null] });
  const schwarz = partie(91, { spielerFarbe: 'b', zuege: ['e2e4', 'e7e5', 'g1f3', 'b8c6'], liveKlassen: ['fehler', 'patzer', null, 'verpasst'] });
  const uebung = partie(92, { modus: 'uebung', liveKlassen: ['patzer', 'patzer'] });
  const fremdeStellung = partie(93, { startFen: '8/8/8/8/8/8/8/K6k w - - 0 1', liveKlassen: ['patzer', null] });
  const hf = haeufigsteFehler([weiss, schwarz, uebung, fremdeStellung]);
  pruefe('haeufigsteFehler: nur eigene Zuege wertender Partien, Gleichstand in fester Reihenfolge', JSON.stringify(hf) === JSON.stringify({ zuege: 5,
    arten: [{ art: 'fehler', anzahl: 2 }, { art: 'patzer', anzahl: 1 }, { art: 'verpasst', anzahl: 1 }, { art: 'ungenau', anzahl: 1 }] }), hf);
  const viele = Array.from({ length: FEHLER_FENSTER + 5 }, (_, i) => partie(i, { liveKlassen: [i < 5 ? 'patzer' : 'fehler', null] }));
  const hv = haeufigsteFehler(viele);
  pruefe(`haeufigsteFehler: nur die letzten ${FEHLER_FENSTER} Partien`, hv.zuege === FEHLER_FENSTER && hv.arten.length === 1 && hv.arten[0].art === 'fehler', hv);
  pruefe('haeufigsteFehler: ohne Partien leer', JSON.stringify(haeufigsteFehler([])) === '{"zuege":0,"arten":[]}');

  localStorage.setItem(SITZUNG_SCHLUESSEL, JSON.stringify(sitzungVon(UID_A, MAIL_A)));
  await meineKlassen({ neu: true });
  const f = ladeFortschritt();
  f.bots.benno.sterne = [true, true, false];
  f.bots.hilde.sterne = [true, false, true];
  const stand = meineKlassenGespeichert();
  const nachher = (min) => new Date(T0 - 3600e3 + min * 60e3).toISOString();
  const partienSeit = [partie(1, { datum: nachher(10) }), partie(2, { datum: nachher(20), modus: 'uebung' }), partie(3, { datum: new Date(T0 - 9e6).toISOString() })];
  const fj = fortschrittJetzt({ stand, fortschritt: f, partien: partienSeit, statistikWerte: { partien: 12, schnittGenauigkeit: 81.46 }, geloest: {} });
  pruefe('fortschrittJetzt: Bots, Sterne, Partien, Genauigkeit gerundet, genau die Felder der SQL-Funktion', fj.bots_besiegt === 2 && fj.sterne === 4
    && fj.partien === 12 && fj.genauigkeit_schnitt === 81.5 && JSON.stringify(Object.keys(fj)) === JSON.stringify(SQL_PARAMS.schule_melde_fortschritt), fj);
  pruefe('fortschrittJetzt: noch nichts erledigt (Rudi nicht besiegt, 1 von 3 Partien seit der Aufgabe, Übung zählt nicht)', fj.erledigt.length === 0
    && JSON.stringify(aufgabeStand(stand.mitglied[0].aufgaben[1], { partien: partienSeit })) === '{"erledigt":false,"stand":1,"ziel":3}', fj.erledigt);
  f.bots.rudi.sterne = [true, false, false];
  const zwei = [...partienSeit, partie(4, { datum: nachher(30) }), partie(5, { datum: nachher(40) })];
  const fj2 = fortschrittJetzt({ stand, fortschritt: f, partien: zwei, statistikWerte: { partien: 14, schnittGenauigkeit: null }, geloest: { [A_RAETSEL]: ['r1', 'r2'] } });
  pruefe('fortschrittJetzt: Rudi besiegt, 3 Partien, 2 Rätsel -> alle drei erledigt; Genauigkeit ohne Wert null',
    JSON.stringify([...fj2.erledigt].sort()) === JSON.stringify([A_BOT, A_PARTIEN, A_RAETSEL].sort()) && fj2.genauigkeit_schnitt === null, fj2);
  pruefe('aufgabeStand Bot mit 2 Sternen: Sieg allein reicht nicht', aufgabeStand({ art: 'bot', ziel: { bot: 'rudi', sterne: 2 } }, { fortschritt: f }).erledigt === false
    && aufgabeStand({ art: 'bot', ziel: { bot: 'benno', sterne: 2 } }, { fortschritt: f }).erledigt === true);
  f.bots.rudi.sterne = [false, false, false];

  // ---------- Raetsel zaehlen ----------
  jetzt = T0;
  pruefe('merkeRaetsel: falsch geloest zaehlt nicht', merkeRaetsel({ id: 'r1', richtig: false }) === false);
  pruefe('merkeRaetsel: richtig geloest zaehlt fuer die Raetsel-Aufgabe', merkeRaetsel({ id: 'r1', richtig: true }) === true
    && JSON.stringify(JSON.parse(m.get(RAETSEL_SCHLUESSEL)).geloest[A_RAETSEL]) === '["r1"]');
  pruefe('merkeRaetsel: dasselbe Raetsel zaehlt einmal', merkeRaetsel({ id: 'r1', richtig: true }) === false);
  merkeRaetsel({ id: 'r2', richtig: true });
  merkeRaetsel({ id: 'r3', richtig: true });
  pruefe('merkeRaetsel: hoechstens so viele wie das Ziel', JSON.parse(m.get(RAETSEL_SCHLUESSEL)).geloest[A_RAETSEL].length === 2
    && aufgabeStand(stand.mitglied[0].aufgaben[2]).erledigt === true);
  m.delete(RAETSEL_SCHLUESSEL);
  jetzt = T0 - 3 * 3600e3;
  pruefe('merkeRaetsel: vor der Aufgabe geloest zaehlt nicht', merkeRaetsel({ id: 'r9', richtig: true }) === false);
  jetzt = T0;

  // ---------- Offene Aufgabe fuer die Heute-Karte ----------
  const heute = '2026-10-20';
  const st = (aufgaben, aktiv = true) => ({ leitung: [], mitglied: [{ klasse: KLASSE, name: 'Q1', aktiv, aufgaben }] });
  const a = (id, faellig, erstellt, extra = {}) => ({ id: uuid(id), titel: 'A' + id, art: 'partien', ziel: { anzahl: 50 }, faellig, erstellt_am: new Date(erstellt).toISOString(), ...extra });
  const o1 = offeneAufgabe(st([a(1, null, T0 - 5e6), a(2, '2026-10-25', T0 - 9e6), a(3, '2026-10-22', T0 - 8e6), a(4, null, T0 - 1e6)]), { heute, partien: [] });
  pruefe('offeneAufgabe: der naechste Termin zuerst', o1 && o1.aufgabe.id === uuid(3), o1 && o1.aufgabe.id);
  const o2 = offeneAufgabe(st([a(1, null, T0 - 5e6), a(4, null, T0 - 1e6)]), { heute, partien: [] });
  pruefe('offeneAufgabe: ohne Termin die neueste', o2 && o2.aufgabe.id === uuid(4));
  const alt = addiereTage(heute, -(ALT_TAGE + 1));
  pruefe('offeneAufgabe: laenger ueberfaellig, erledigt, geschlossene Klasse oder unbekannte Art nicht', offeneAufgabe(st([a(5, alt, T0 - 9e9)]), { heute, partien: [] }) === null
    && offeneAufgabe(st([a(6, null, T0 - 5e6, { ziel: { anzahl: 1 } })]), { heute, partien: [partie(7, { datum: new Date(T0).toISOString() })] }) === null
    && offeneAufgabe(st([a(7, null, T0)], false), { heute, partien: [] }) === null && offeneAufgabe(st([a(8, null, T0, { art: 'lesen' })]), { heute, partien: [] }) === null
    && offeneAufgabe(null) === null);
  pruefe('offeneAufgabe: gerade ueberfaellig (bis 14 Tage) noch dabei', offeneAufgabe(st([a(9, addiereTage(heute, -ALT_TAGE), T0 - 9e9)]), { heute, partien: [] }) !== null);

  // ---------- Melden ----------
  srv.antworten.schule_melde_fortschritt = 1;
  m.delete(GEMELDET_SCHLUESSEL);
  aufrufe.length = 0;
  const g1 = await meldeJetzt();
  const melde = aufrufe.filter((x) => x.name === 'schule_melde_fortschritt');
  pruefe('meldeJetzt: sendet einmal, merkt sich die Meldung', g1.ok && g1.gesendet === true && melde.length === 1 && !meldungOffen()
    && JSON.parse(m.get(GEMELDET_SCHLUESSEL)).uid === UID_A, g1);
  const g2 = await meldeJetzt();
  pruefe('meldeJetzt: dieselbe Meldung geht nicht zweimal', g2.ok && g2.gesendet === false && g2.grund === 'gleich'
    && aufrufe.filter((x) => x.name === 'schule_melde_fortschritt').length === 1);
  f.bots.lisa.sterne = [true, false, false];
  localStorage.setItem('schach-arena:v1:fortschritt', JSON.stringify(f));
  planeMeldung({ sofort: true });
  pruefe('planeMeldung: merkt die Meldung vor', meldungOffen() && JSON.parse(m.get(OFFEN_SCHLUESSEL)).uid === UID_A);
  await warte(30);
  pruefe('planeMeldung sofort: neuer Stand geht raus, danach nichts mehr offen', aufrufe.filter((x) => x.name === 'schule_melde_fortschritt').length === 2 && !meldungOffen());
  // offline: vorgemerkt lassen (still), beim naechsten Versuch senden
  f.bots.lisa.sterne = [true, true, false];
  localStorage.setItem('schach-arena:v1:fortschritt', JSON.stringify(f));
  srv.modus = 'offline';
  jetzt = T0 + 10 * STAND_MS;
  planeMeldung({ sofort: true });
  await warte(30);
  pruefe('offline: Meldung bleibt vorgemerkt', meldungOffen());
  srv.modus = 'ok';
  const g3 = await meldeJetzt();
  pruefe('wieder online: vorgemerkte Meldung geht raus', g3.ok && g3.gesendet && !meldungOffen());
  // Buendeln: drei Partien kurz hintereinander, eine Anfrage nach BUENDEL_MS
  jetzt = T0 + 20 * STAND_MS;
  const vor = aufrufe.filter((x) => x.name === 'schule_melde_fortschritt').length;
  for (const s of ['benno', 'hilde', 'kalle']) { f.bots[s].sterne = [true, true, true]; localStorage.setItem('schach-arena:v1:fortschritt', JSON.stringify(f)); planeMeldung(); await warte(5); }
  await warte(BUENDEL_MS / 2);
  const mitte = aufrufe.filter((x) => x.name === 'schule_melde_fortschritt').length;
  await warte(BUENDEL_MS / 2 + 600);
  const danach = aufrufe.filter((x) => x.name === 'schule_melde_fortschritt');
  pruefe(`gebuendelt: drei Partien kurz hintereinander, eine Meldung nach ${BUENDEL_MS / 1000} s mit dem letzten Stand`, mitte === vor && danach.length === vor + 1
    && danach.at(-1).daten.sterne === JSON.parse(JSON.stringify(fortschrittJetzt({ stand: meineKlassenGespeichert() }))).sterne, { vor, mitte, danach: danach.length });
  // hoechstens eine Meldung je MELDE_ABSTAND_MS: kurz nach einer Meldung wartet die naechste
  f.bots.lisa.sterne = [true, true, true];
  localStorage.setItem('schach-arena:v1:fortschritt', JSON.stringify(f));
  planeMeldung();
  await warte(BUENDEL_MS + 600);
  pruefe('kurz nach einer Meldung wartet die naechste (hoechstens eine je Minute)', aufrufe.filter((x) => x.name === 'schule_melde_fortschritt').length === vor + 1 && meldungOffen());
  // Fehler, der sich nicht von selbst gibt: nicht endlos wiederholen
  srv.fehler = { schule_melde_fortschritt: { status: 400, body: { code: 'P0001', message: 'SCHULE_FORTSCHRITT_UNGUELTIG' } } };
  const g4 = await meldeJetzt();
  pruefe('abgelehnte Meldung (400): nicht mehr vorgemerkt', g4.grund === 'SCHULE_FORTSCHRITT_UNGUELTIG' && !meldungOffen());
  srv.fehler = null;
  // nur geschlossene Klassen: keine Meldung, kein Netz
  srv.stand = { leitung: [], mitglied: [{ ...srv.stand.mitglied[0], aktiv: false, aufgaben: [] }] };
  await meineKlassen({ neu: true });
  const nG = aufrufe.length;
  pruefe('ohne aktive Klasse: planeMeldung tut nichts', planeMeldung() === false && !meldungOffen());
  const g5 = await meldeJetzt();
  pruefe('ohne aktive Klasse: meldeJetzt ohne Meldung', g5.grund === 'keine_klasse' && aufrufe.slice(nG).every((x) => x.name === 'schule_meine_klassen'));

  // ---------- Aufraeumen nach dem Abmelden ----------
  m.set(OFFEN_SCHLUESSEL, JSON.stringify({ uid: UID_A, seit: T0 }));
  m.set(RAETSEL_SCHLUESSEL, JSON.stringify({ uid: UID_A, geloest: {} }));
  pruefe('aufraeumen mit Anmeldung: nichts', aufraeumen() === false && m.has(STAND_SCHLUESSEL));
  localStorage.removeItem(SITZUNG_SCHLUESSEL);
  pruefe('aufraeumen ohne Anmeldung: Stand, Vormerkung, Meldung und Raetsel vom Geraet', aufraeumen() === true
    && ![STAND_SCHLUESSEL, OFFEN_SCHLUESSEL, GEMELDET_SCHLUESSEL, RAETSEL_SCHLUESSEL].some((k) => m.has(k)));
  m.set(STAND_SCHLUESSEL, JSON.stringify({ uid: UID_A, daten: srv.stand, geholtAm: T0 }));
  pruefe('Speicher des Schulmodus nicht im Cloud-Spielstand und nicht in der Sicherung', !Object.keys(lokalerStand()).some((k) => k.includes(':schule:'))
    && !rohSpeicher().schluessel().some((k) => k.includes(':schule:')));
  m.delete(STAND_SCHLUESSEL);

  // ---------- Sortieren ----------
  const mit = (name, f2) => ({ id: name, anzeigename: name, fortschritt: f2 });
  const liste = [mit('ben', null), mit('Anna', { sterne: 7, bots_besiegt: 3, partien: 12, genauigkeit_schnitt: 81.5, erledigt: [1], aktualisiert_am: '2026-10-20T10:00:00Z' }),
    mit('Cem', { sterne: 12, bots_besiegt: 4, partien: 3, genauigkeit_schnitt: null, erledigt: [], aktualisiert_am: '2026-10-21T10:00:00Z' }),
    mit('Ömer', { sterne: 7, bots_besiegt: 1, partien: 40, genauigkeit_schnitt: 90, erledigt: [1, 2], aktualisiert_am: '2026-10-19T10:00:00Z' })];
  const namen = (l) => l.map((x) => x.anzeigename).join(',');
  pruefe('sortiere: Name (deutsch, ohne Gross/Klein)', namen(sortiereMitglieder(liste, 'name', 'auf')) === 'Anna,ben,Cem,Ömer' && namen(sortiereMitglieder(liste, 'name', 'ab')) === 'Ömer,Cem,ben,Anna');
  pruefe('sortiere: Sterne absteigend, Gleichstand nach Name, ohne Stand immer unten', namen(sortiereMitglieder(liste, 'sterne', 'ab')) === 'Cem,Anna,Ömer,ben'
    && namen(sortiereMitglieder(liste, 'sterne', 'auf')) === 'Anna,Ömer,Cem,ben');
  pruefe('sortiere: Genauigkeit, Aufgaben, Stand, Partien', namen(sortiereMitglieder(liste, 'genauigkeit', 'ab')) === 'Ömer,Anna,ben,Cem'
    && namen(sortiereMitglieder(liste, 'aufgaben', 'ab')) === 'Ömer,Anna,Cem,ben' && namen(sortiereMitglieder(liste, 'aktualisiert', 'ab')) === 'Cem,Anna,Ömer,ben'
    && namen(sortiereMitglieder(liste, 'partien', 'ab')) === 'Ömer,Anna,Cem,ben' && namen(sortiereMitglieder(liste, 'quatsch')) === 'Anna,ben,Cem,Ömer');
  pruefe('sortiere: Liste selbst unveraendert', namen(liste) === 'ben,Anna,Cem,Ömer');

  // ---------- Paket ----------
  const paket = await import('../js/pakete/schule/index.js');
  const orte = await import('../js/orte.js');
  pruefe('Paket bietet an: einstellungen:gruppen (mit dem Konto) und arena:heute', orte.angeboten('arena:heute') === 1 && orte.angeboten('einstellungen:gruppen') >= 2);
  pruefe('ohne DOM: keine Gruppe, keine Zeile (defensiv)', paket.schuleGruppe({}) === null && paket.heuteZeile({}) === null);
  const ui = await import('../js/ui/schule.js');
  pruefe('Screen exportiert zeige()', typeof ui.zeige === 'function');
  const sw = readFileSync(path.join(WURZEL, 'sw.js'), 'utf8');
  pruefe('Dateien des Pakets schon im Offline-Cache (sw.js)', ['js/schule.js', 'js/pakete/schule/index.js', 'js/ui/schule.js', 'css/pakete/schule.css']
    .every((d) => sw.includes(`'${d}'`)));
  const erw = readFileSync(path.join(WURZEL, 'js/erweiterungen.js'), 'utf8');
  pruefe('Paket noch nicht in PAKETE (das traegt die Integration ein, wie beim Abo)', !/PAKETE = Object\.freeze\(\[[^\]]*schule/.test(erw));
  const app = readFileSync(path.join(WURZEL, 'js/app.js'), 'utf8');
  pruefe("app.js: schule in SCREENS, PAKET_SCREENS und TITEL ('Schulmodus')", /const SCREENS = \[[^\]]*'schule'\]/.test(app)
    && /const PAKET_SCREENS = new Set\(\[[^\]]*'schule'\]\)/.test(app) && /schule: 'Schulmodus'/.test(app));
  const quellen = ['js/schule.js', 'js/pakete/schule/index.js', 'js/ui/schule.js'].map((d) => readFileSync(path.join(WURZEL, d), 'utf8'));
  pruefe('Quellen: kein Math.random, kein Tag ueber toISOString', quellen.every((q) => !/Math\.random|toISOString\(\)\.slice/.test(q)));
  // Zeichenketten der drei Dateien (grob: '...' und `...`, ohne Kommentare); die Verbotsliste prueft zusaetzlich tests/fairness.test.mjs
  const texte = quellen.map((q) => q.split('\n').filter((z) => !/^\s*\/\//.test(z)).join('\n'))
    .flatMap((q) => [...q.matchAll(/'((?:[^'\\\n]|\\.)*)'|`((?:[^`\\]|\\.)*)`/g)].map((x) => x[1] || x[2] || '')).join('\n').toLowerCase();
  pruefe('Texte von Paket und Screen: ohne Druck, ohne Countdown', texte.length > 2000 && !DRUCK.some((w) => texte.includes(w.toLowerCase())) && !COUNTDOWN_RE.test(texte),
    DRUCK.filter((w) => texte.includes(w.toLowerCase())));

  // ---------- Optik: nur Tokens (tests/thema.test.mjs liest css/pakete/ nicht) ----------
  const css = readFileSync(path.join(WURZEL, 'css/pakete/schule.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const definiert = new Set([...readFileSync(path.join(WURZEL, 'css/tokens.css'), 'utf8').matchAll(/(--[a-z0-9-]+)\s*:/g),
    ...readFileSync(path.join(WURZEL, 'css/themes/modern.css'), 'utf8').matchAll(/(--[a-z0-9-]+)\s*:/g)].map((x) => x[1]));
  const benutzt = [...new Set([...css.matchAll(/var\((--[a-z0-9-]+)/g)].map((x) => x[1]))];
  pruefe('schule.css: keine festen Farben, kein Schatten, kein Leuchten, kein Verlauf, kein Neon', !/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|shadow|gradient|glow|--neon-/i.test(css));
  pruefe('schule.css: jede benutzte Variable ist ein Token aus tokens.css oder themes/modern.css', benutzt.length > 10 && benutzt.every((v) => definiert.has(v)),
    benutzt.filter((v) => !definiert.has(v)));
  pruefe('schule.css: keine Animationen per CSS (Bewegung nur ueber js/bewegung.js)', !/@keyframes|transition\s*:|animation\s*:/.test(css));
  setzeSchuleFetch(null);
  setzeKontoFetch(null);
  setzeSchuleUhr(null);
}

// =====================================================================
await nodeTeil();
console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
