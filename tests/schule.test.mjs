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
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { setzeSpeicher, ladeFortschritt, rohSpeicher } from '../js/storage.js';
import { setzeKontoFetch, SITZUNG_SCHLUESSEL, lokalerStand } from '../js/konto.js';
import {
  setzeSchuleFetch, setzeSchuleUhr, normalisiereCode, pruefeAnzeigename, pruefeKlassenname, fehlerText, meineKlassen, meineKlassenGespeichert,
  erstelleKlasse, trittBei, verlasse, uebersicht, aufgabeAnlegen, aufgabeLoeschen, entferneMitglied, schliesseKlasse, loescheKlasse,
  fortschrittJetzt, haeufigsteFehler, aufgabeStand, zielText, faelligText, offeneAufgabe, merkeRaetsel, planeMeldung, meldeJetzt, meldungOffen,
  aufraeumen, sortiereMitglieder, TEXTE, WAS_DIE_LEITUNG_SIEHT, STAND_SCHLUESSEL, OFFEN_SCHLUESSEL, GEMELDET_SCHLUESSEL, RAETSEL_SCHLUESSEL,
  STAND_MS, BUENDEL_MS, FEHLER_FENSTER, ALT_TAGE, MELDE_ABSTAND_MS, WARTE_MS, RAETSEL_AUFGABEN, setzeSchuleWartezeit,
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
  pruefe('Hinweis vor dem Beitritt ehrlich: Stand nach jeder Partie, gespeichert nur der Tag (keine Uhrzeit), kein Versprechen "Spielzeiten"',
    /nach jeder Partie aktualisiert/.test(WAS_DIE_LEITUNG_SIEHT) && /nur der Tag, keine Uhrzeit/.test(WAS_DIE_LEITUNG_SIEHT) && !/Spielzeit/.test(WAS_DIE_LEITUNG_SIEHT));
  // Raetsel-Aufgaben nur, wenn sie jemand erfuellen kann: der Schalter passt zum Code (sendet ein Paket raetsel:geloest?)
  const jsDateien = (dir) => readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? jsDateien(path.join(dir, e.name)) : e.name.endsWith('.js') ? [path.join(dir, e.name)] : []));
  const raetselSender = jsDateien(path.join(WURZEL, 'js')).filter((d) => /sende\(\s*['"`]raetsel:geloest['"`]/.test(readFileSync(d, 'utf8')))
    .map((d) => path.relative(WURZEL, d));
  pruefe('RAETSEL_AUFGABEN genau dann, wenn ein Paket raetsel:geloest sendet (heute keins: keine Raetsel-Aufgaben stellen)',
    RAETSEL_AUFGABEN === (raetselSender.length > 0), { RAETSEL_AUFGABEN, raetselSender });

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
  // grosszuegig warten (Rechner unter Last); vor Ablauf von MELDE_ABSTAND_MS kaeme ohnehin keine zweite Meldung
  for (let i = 0; i < 100 && aufrufe.filter((x) => x.name === 'schule_melde_fortschritt').length === vor; i++) await warte(100);
  await warte(300);
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
  // nachholen (Paket: app:bereit, app:sichtbar, online): ohne Buendel-Wartezeit, aber ebenfalls hoechstens eine je Minute
  const meldungen = () => aufrufe.filter((x) => x.name === 'schule_melde_fortschritt').length;
  const vorN = meldungen();
  pruefe('nachholen kurz nach einer Meldung: merkt vor, sendet aber nicht', planeMeldung({ nachholen: true }) === true && meldungOffen());
  await warte(400);
  pruefe('nachholen kurz nach einer Meldung: wartet ebenfalls (hoechstens eine je Minute)', meldungen() === vorN && meldungOffen(), meldungen() - vorN);
  jetzt += MELDE_ABSTAND_MS;
  planeMeldung({ nachholen: true });
  for (let i = 0; i < 100 && meldungen() === vorN; i++) await warte(10);
  await warte(30);
  pruefe(`nachholen eine Minute spaeter: geht ohne Buendel-Wartezeit (${BUENDEL_MS / 1000} s) raus`, meldungen() === vorN + 1 && !meldungOffen(), meldungen() - vorN);
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

  // ---------- Wettlauf: Aenderung waehrend "Meine Klassen" laeuft; Zeitgrenze fuer haengende Anfragen ----------
  {
    localStorage.setItem(SITZUNG_SCHLUESSEL, JSON.stringify(sitzungVon(UID_A, MAIL_A)));
    const KL = uuid(70);
    const net = { drin: false, langsam: 300, haengt: new Set(), koerperHaengt: false, log: [] };
    const antwort = (body) => ({ ok: true, status: 200, async json() { return body; } });
    setzeSchuleFetch(async (url) => {
      const name = String(url).replace(`${SUPA}/rest/v1/rpc/`, '');
      net.log.push(name);
      if (net.haengt.has(name)) {
        if (name === 'schule_tritt_bei') net.drin = true; // gebucht, aber die Antwort kommt nie an
        return new Promise(() => {});
      }
      if (name === 'schule_meine_klassen') {
        const drin = net.drin; // was der Server beim Eingang der Anfrage weiss
        await warte(net.langsam);
        if (net.koerperHaengt) return { ok: true, status: 200, json: () => new Promise(() => {}) };
        return antwort({ leitung: [], mitglied: drin ? [{ klasse: KL, name: 'Q2', aktiv: true, mitglied: uuid(71), anzeigename: 'Anna', aufgaben: [] }] : [] });
      }
      if (name === 'schule_tritt_bei') { net.drin = true; return antwort({ klasse: { id: KL, name: 'Q2' }, mitglied: { id: uuid(71), anzeigename: 'Anna' } }); }
      if (name === 'schule_verlasse') { net.drin = false; return antwort(true); }
      return antwort(1);
    });
    const zahl = (n) => net.log.filter((x) => x === n).length;
    const klassenImSpeicher = () => (meineKlassenGespeichert() || { mitglied: [] }).mitglied.length;
    // Einstellungen offen (holt neu, langsames Netz), waehrenddessen Beitritt
    const vorher = meineKlassen({ neu: true });
    const rb = await trittBei('K7Q2MX', 'Anna');
    pruefe('Beitritt waehrend "Meine Klassen" laeuft: danach neu geholt, die Klasse steht im Zwischenspeicher', rb.ok && zahl('schule_meine_klassen') >= 2
      && klassenImSpeicher() === 1, { log: net.log, im: klassenImSpeicher() });
    const rv0 = await vorher;
    pruefe('... die alte Antwort ueberschreibt ihn nicht, wer auf sie wartete, bekommt den neuen Stand', rv0.ok && rv0.daten.mitglied.length === 1
      && klassenImSpeicher() === 1 && !JSON.parse(m.get(STAND_SCHLUESSEL)).veraltet, rv0);
    pruefe('nach dem Beitritt: eine Partie wird gemeldet (Stand mit Klasse bekannt)', planeMeldung({ sofort: true }) === true);
    await warte(100);
    // Austritt, waehrend eine Anfrage laeuft
    const vorher2 = meineKlassen({ neu: true });
    const rv = await verlasse(KL);
    const r2 = await vorher2;
    pruefe('Austritt waehrend "Meine Klassen" laeuft: die Mitgliedschaft ist danach weg, auch fuer den Wartenden', rv.ok && klassenImSpeicher() === 0
      && r2.ok && r2.daten.mitglied.length === 0, { im: klassenImSpeicher(), r2 });
    net.langsam = 0;
    await warte(50);
    // Zeitgrenze: Standard und Testwert
    pruefe('Zeitgrenze je Anfrage: 15 s', WARTE_MS === 15000);
    setzeSchuleWartezeit(250);
    net.drin = true;
    net.haengt.add('schule_meine_klassen');
    let t = Date.now();
    const rh = await meineKlassen({ neu: true });
    pruefe('haengt "Meine Klassen": nach der Wartezeit offline mit dem letzten Stand (kein Festhaengen)', rh.ok && rh.offline === true && Date.now() - t < 5000, rh);
    net.haengt.clear();
    const rn = await meineKlassen({ neu: true });
    pruefe('danach geht es wieder (keine haengende Anfrage wird mitbenutzt)', rn.ok && !rn.offline && rn.daten.mitglied.length === 1, rn);
    net.koerperHaengt = true;
    t = Date.now();
    const rk = await meineKlassen({ neu: true });
    pruefe('haengt der Koerper der Antwort: ebenfalls offline mit dem letzten Stand, nie "ok ohne Daten"', rk.ok && rk.offline === true
      && rk.daten.mitglied.length === 1 && klassenImSpeicher() === 1 && Date.now() - t < 5000, rk);
    net.koerperHaengt = false;
    // haengender Beitritt (gebucht, Antwort verloren): Knopf wird wieder frei, der Stand gilt als veraltet
    await verlasse(KL);
    net.haengt.add('schule_tritt_bei');
    t = Date.now();
    const rt = await trittBei('K7Q2MX', 'Anna');
    pruefe('haengt der Beitritt: trittBei kommt mit "offline" zurueck', rt.ok === false && rt.grund === 'offline' && Date.now() - t < 5000, rt);
    net.haengt.clear();
    const n0 = zahl('schule_meine_klassen');
    const rs = await meineKlassen();
    pruefe('... danach fragt "Meine Klassen" den Server (der Beitritt kann gebucht sein), statt 12 h dem leeren Stand zu glauben',
      zahl('schule_meine_klassen') === n0 + 1 && rs.ok && rs.daten.mitglied.length === 1 && klassenImSpeicher() === 1, { rs, n: zahl('schule_meine_klassen') - n0 });
    // haengende Meldung: meldeJetzt kommt zurueck, die Meldung bleibt vorgemerkt
    net.haengt.add('schule_melde_fortschritt');
    m.delete(GEMELDET_SCHLUESSEL);
    m.set(OFFEN_SCHLUESSEL, JSON.stringify({ uid: UID_A, seit: jetzt }));
    t = Date.now();
    const rm = await meldeJetzt();
    pruefe('haengt die Meldung: meldeJetzt kommt mit "offline" zurueck, die Meldung bleibt vorgemerkt', rm.ok === false && rm.grund === 'offline'
      && meldungOffen() && Date.now() - t < 5000, rm);
    net.haengt.clear();
    const rm2 = await meldeJetzt();
    pruefe('... und geht beim naechsten Versuch raus', rm2.ok && rm2.gesendet === true && !meldungOffen(), rm2);
    setzeSchuleWartezeit(null);
    localStorage.removeItem(SITZUNG_SCHLUESSEL);
    aufraeumen();
  }

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
// Browser-Teil
// =====================================================================
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

// ---------- gefaelschter Supabase-Server (nur die schule_*-Funktionen, im Arbeitsspeicher) ----------
function neuerServer() {
  return { klassen: [], mitglieder: [], fortschritt: new Map(), aufgaben: [], aufrufe: [], meldungen: [], offline: false, n: 500, codes: 0 };
}
const fehler400 = (k) => ({ status: 400, body: { code: 'P0001', message: k } });
// aktualisiert_am ist auf dem Server ein Tag ohne Uhrzeit (date): der gefaelschte Server liefert es genauso
const tagIso = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const uidAus = (kopf) => {
  try { return JSON.parse(Buffer.from(String(kopf.authorization || '').replace(/^Bearer a\./, '').split('.')[0], 'base64url').toString()).sub; } catch (e) { return null; }
};
function rpcAntwort(s, name, uid, d) {
  const klasse = (id) => s.klassen.find((k) => k.id === id);
  const leitet = (id) => { const k = klasse(id); return k && k.leitung === uid ? k : null; };
  const aufgabenVon = (id) => s.aufgaben.filter((a) => a.klasse === id);
  if (!uid) return fehler400('SCHULE_NICHT_ANGEMELDET');
  switch (name) {
    case 'schule_meine_klassen':
      return { status: 200, body: {
        leitung: s.klassen.filter((k) => k.leitung === uid).map((k) => ({ id: k.id, name: k.name, code: k.code, aktiv: k.aktiv, erstellt_am: k.erstellt_am,
          geschlossen_am: k.geschlossen_am, mitglieder: s.mitglieder.filter((m) => m.klasse === k.id).length })),
        mitglied: s.mitglieder.filter((m) => m.uid === uid).map((m) => { const k = klasse(m.klasse); return { klasse: k.id, name: k.name, aktiv: k.aktiv,
          mitglied: m.id, anzeigename: m.anzeigename, beigetreten_am: m.beigetreten_am, erledigt: (s.fortschritt.get(m.id) || {}).erledigt || [],
          aufgaben: k.aktiv ? aufgabenVon(k.id).map(({ klasse: _, ...a }) => a) : [] }; }),
      } };
    case 'schule_erstelle_klasse': {
      const k = { id: uuid(++s.n), name: d.name, code: 'K7Q2M' + 'ABCDEFGHJKLMNPQRSTUVWXYZ'[s.codes++ % 24], leitung: uid, aktiv: true,
        erstellt_am: new Date().toISOString(), geschlossen_am: null };
      s.klassen.push(k);
      return { status: 200, body: { id: k.id, name: k.name, code: k.code, aktiv: true, erstellt_am: k.erstellt_am } };
    }
    case 'schule_tritt_bei': {
      const k = s.klassen.find((x) => x.code === d.code);
      if (!k) return { status: 200, body: { fehler: 'SCHULE_CODE_UNGUELTIG' } };
      if (!k.aktiv) return fehler400('SCHULE_KLASSE_GESCHLOSSEN');
      if (k.leitung === uid) return fehler400('SCHULE_EIGENE_KLASSE');
      if (s.mitglieder.some((m) => m.klasse === k.id && m.uid !== uid && m.anzeigename.toLowerCase() === d.anzeigename.toLowerCase())) return fehler400('SCHULE_NAME_VERGEBEN');
      let m = s.mitglieder.find((x) => x.klasse === k.id && x.uid === uid);
      if (!m) { m = { id: uuid(++s.n), klasse: k.id, uid, anzeigename: d.anzeigename, beigetreten_am: new Date().toISOString() }; s.mitglieder.push(m); }
      m.anzeigename = d.anzeigename;
      return { status: 200, body: { klasse: { id: k.id, name: k.name }, mitglied: { id: m.id, anzeigename: m.anzeigename, beigetreten_am: m.beigetreten_am } } };
    }
    case 'schule_verlasse': {
      const vorher = s.mitglieder.length;
      s.mitglieder = s.mitglieder.filter((m) => !(m.klasse === d.klasse && m.uid === uid));
      return { status: 200, body: s.mitglieder.length < vorher };
    }
    case 'schule_melde_fortschritt': {
      s.meldungen.push({ uid, d, t: Date.now() });
      let n = 0;
      for (const m of s.mitglieder.filter((x) => x.uid === uid && klasse(x.klasse).aktiv)) {
        const ids = aufgabenVon(m.klasse).map((a) => a.id);
        s.fortschritt.set(m.id, { bots_besiegt: d.bots_besiegt, sterne: d.sterne, partien: d.partien, genauigkeit_schnitt: d.genauigkeit_schnitt,
          haeufigste_fehler: d.haeufigste_fehler, erledigt: (d.erledigt || []).filter((x) => ids.includes(x)), aktualisiert_am: tagIso() });
        n++;
      }
      return { status: 200, body: n };
    }
    case 'schule_klassen_uebersicht': {
      const k = leitet(d.klasse);
      if (!k) return fehler400('SCHULE_KEINE_LEITUNG');
      const ms = s.mitglieder.filter((m) => m.klasse === k.id).sort((a, b) => a.anzeigename.toLowerCase().localeCompare(b.anzeigename.toLowerCase()));
      return { status: 200, body: { klasse: { id: k.id, name: k.name, code: k.code, aktiv: k.aktiv, erstellt_am: k.erstellt_am, geschlossen_am: k.geschlossen_am },
        mitglieder: ms.map((m) => ({ id: m.id, anzeigename: m.anzeigename, beigetreten_am: m.beigetreten_am, fortschritt: s.fortschritt.get(m.id) || null })),
        aufgaben: aufgabenVon(k.id).map(({ klasse: _, ...a }) => ({ ...a, erledigt: ms.filter((m) => ((s.fortschritt.get(m.id) || {}).erledigt || []).includes(a.id)).length })) } };
    }
    case 'schule_aufgabe_anlegen': {
      const k = leitet(d.klasse);
      if (!k) return fehler400('SCHULE_KEINE_LEITUNG');
      if (!k.aktiv) return fehler400('SCHULE_KLASSE_GESCHLOSSEN');
      const ziel = d.art === 'bot' ? { bot: d.ziel.bot, sterne: d.ziel.sterne || 1 } : { anzahl: d.ziel.anzahl };
      const a = { id: uuid(++s.n), klasse: k.id, titel: d.titel, art: d.art, ziel, faellig: d.faellig, erstellt_am: new Date().toISOString() };
      s.aufgaben.push(a);
      const { klasse: _, ...rest } = a;
      return { status: 200, body: { ...rest, erledigt: 0 } };
    }
    case 'schule_aufgabe_loeschen': {
      const a = s.aufgaben.find((x) => x.id === d.aufgabe);
      if (!a || !leitet(a.klasse)) return { status: 200, body: false };
      s.aufgaben = s.aufgaben.filter((x) => x !== a);
      return { status: 200, body: true };
    }
    case 'schule_entferne_mitglied': {
      const m = s.mitglieder.find((x) => x.id === d.mitglied);
      if (!m || !leitet(m.klasse)) return { status: 200, body: false };
      s.mitglieder = s.mitglieder.filter((x) => x !== m);
      s.fortschritt.delete(m.id);
      return { status: 200, body: true };
    }
    case 'schule_schliesse_klasse': {
      const k = leitet(d.klasse);
      if (!k) return fehler400('SCHULE_KEINE_LEITUNG');
      if (k.aktiv) { k.aktiv = false; k.geschlossen_am = new Date().toISOString(); }
      return { status: 200, body: true };
    }
    case 'schule_loesche_klasse': {
      const k = leitet(d.klasse);
      if (!k) return { status: 200, body: false };
      s.klassen = s.klassen.filter((x) => x !== k);
      s.mitglieder = s.mitglieder.filter((m) => m.klasse !== k.id);
      s.aufgaben = s.aufgaben.filter((a) => a.klasse !== k.id);
      return { status: 200, body: true };
    }
    default:
      return { status: 404, body: { code: 'PGRST202', message: 'Could not find the function ' + name } };
  }
}

const fremd = [];
async function neueSeite(browser, { w = 1180, h = 820, schema = 'light', handy = false, konto = true, sitzung = null, srv = neuerServer(), vorher = null } = {}) {
  const kontext = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: schema, deviceScaleFactor: 1, hasTouch: true, isMobile: handy });
  const seite = await kontext.newPage();
  const fehler = [];
  seite.on('pageerror', (e) => fehler.push('pageerror: ' + e.message));
  seite.on('console', (m) => { if (m.type() === 'error' && !/404|Failed to fetch dynamically imported module|ERR_FAILED|net::|status of 4\d\d|status of 5\d\d/.test(m.text())) fehler.push('console: ' + m.text()); });
  seite.on('request', (r) => {
    const u = r.url();
    if (u.startsWith(`http://127.0.0.1:${PORT}/`) || /^(data|blob):/.test(u) || u.startsWith(SUPA + '/')) return;
    fremd.push(u);
  });
  await seite.route(SUPA + '/**', async (r) => {
    const u = r.request().url();
    const m = u.match(/\/rest\/v1\/rpc\/(schule_[a-z_]+)/);
    if (!m) return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    let d = {};
    try { d = JSON.parse(r.request().postData() || '{}'); } catch (e) { d = {}; }
    srv.aufrufe.push({ name: m[1], d, kopf: r.request().headers() });
    if (srv.offline) return r.abort('internetdisconnected');
    const a = rpcAntwort(srv, m[1], uidAus(r.request().headers()), d);
    return r.fulfill({ status: a.status, contentType: 'application/json', body: JSON.stringify(a.body) });
  });
  await seite.addInitScript(({ konto, sitzung, vorher }) => {
    try {
      if (konto) localStorage.setItem('schach-arena:konto:sichtbar', '1');
      if (sitzung) localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(sitzung));
      if (vorher && !sessionStorage.getItem('schule-test-vorher')) {
        for (const [k, v] of Object.entries(vorher)) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
        sessionStorage.setItem('schule-test-vorher', '1');
      }
    } catch (e) { /* egal */ }
  }, { konto, sitzung, vorher });
  return { kontext, seite, fehler, srv };
}
async function bild(seite, name) {
  if (!BILDER) return;
  await seite.screenshot({ path: path.join(BILDER, name + '.png') });
}
async function bereit(seite, hash) {
  await seite.goto(BASIS + hash);
  await seite.waitForFunction(() => window.__app && document.documentElement.dataset.screen, null, { timeout: 30000 });
  for (let i = 0; i < 100; i++) {
    const n = await seite.evaluate(async () => (await import('./js/orte.js')).angeboten('arena:heute'));
    if (n >= 1) break;
    await warte(100);
  }
}
const cssDa = (seite) => seite.waitForFunction(() => {
  const l = document.querySelector('link[data-paket-css="schule"]');
  return !!l && !!l.sheet;
}, null, { timeout: 10000 });
// Rueckfrage (app.frage) mit dem Knopf text bestaetigen
async function antworte(seite, text) {
  await seite.waitForSelector('.dialog-ort .dialog-knoepfe button', { timeout: 10000 });
  await seite.locator('.dialog-ort .dialog-knoepfe button', { hasText: text }).first().click();
  await seite.waitForFunction(() => !document.querySelector('.dialog-ort'), null, { timeout: 10000 }).catch(() => {});
}
const zeilen = (seite) => seite.evaluate(() => [...document.querySelectorAll('.sm-tabelle tbody tr')].map((tr) => [...tr.children].map((c) => c.textContent.trim())));
const lage = (seite) => seite.evaluate(() => {
  const vw = innerWidth;
  const raus = [...document.querySelectorAll('.schule-screen button, .schule-screen input, .schule-screen select, .schule-gruppe button, .schule-gruppe input')]
    .filter((e) => e.offsetParent !== null && !e.closest('.sm-tabelle-huelle') && !e.closest('[hidden]'))
    .map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0 && (r.left < -1 || r.right > vw + 1)).length;
  const huelle = document.querySelector('.sm-tabelle-huelle');
  return { ueber: document.scrollingElement.scrollWidth - vw, raus, huelle: huelle ? { breit: huelle.scrollWidth, sicht: huelle.clientWidth, rechts: huelle.getBoundingClientRect().right } : null, vw };
});
const fair = (t) => !DRUCK.some((w) => t.toLowerCase().includes(w.toLowerCase())) && !COUNTDOWN_RE.test(t);

const L = sitzungVon(UID_L, MAIL_L);
const A = sitzungVon(UID_A, MAIL_A);
const HEUTE = tagSchluessel();
const IN_7 = addiereTage(HEUTE, 7);
// Server mit einer Klasse von L (Code K7Q2MX), einer Bot- und einer Raetsel-Aufgabe
function serverMitKlasse() {
  const s = neuerServer();
  s.klassen.push({ id: uuid(1), name: 'Q1 Schach-AG', code: 'K7Q2MX', leitung: UID_L, aktiv: true, erstellt_am: new Date(Date.now() - 864e5).toISOString(), geschlossen_am: null });
  s.aufgaben.push({ id: uuid(11), klasse: uuid(1), titel: 'Gabeln mit Rudi', art: 'bot', ziel: { bot: 'rudi', sterne: 1 }, faellig: IN_7, erstellt_am: new Date(Date.now() - 36e5).toISOString() });
  s.aufgaben.push({ id: uuid(12), klasse: uuid(1), titel: 'Zwei Rätsel', art: 'raetsel', ziel: { anzahl: 2 }, faellig: null, erstellt_am: new Date(Date.now() - 72e5).toISOString() });
  return s;
}
// Spielstand, in dem Benno bis Lisa besiegt sind (Rudi ist frei)
function fortschrittBisLisa(rudi = false) {
  const bots = {};
  for (const id of ['benno', 'hilde', 'kalle', 'lisa']) bots[id] = { sterne: [true, false, false], partien: 1, siege: 1, remis: 0, niederlagen: 0, besteGenauigkeit: 70 };
  if (rudi) bots.rudi = { sterne: [true, false, false], partien: 1, siege: 1, remis: 0, niederlagen: 0, besteGenauigkeit: 70 };
  return { bots, brillanteZuege: [] };
}

async function browserTeil(browser) {
  // ---------- Lehrkraft: Klasse anlegen, Code, Aufgaben, Mitglieder, schliessen, loeschen ----------
  gruppe = 'Lehrkraft';
  {
    const { kontext, seite, fehler, srv } = await neueSeite(browser, { sitzung: L });
    await bereit(seite, '#schule');
    await seite.waitForSelector('.schule-screen .sm-inhalt[data-ansicht="liste"]', { timeout: 20000 });
    await cssDa(seite);
    await warte(tempoWarte);
    const start = await seite.evaluate(() => ({ titel: document.title, neu: !!document.querySelector('.sm-neu'), karten: document.querySelectorAll('.sm-klasse-karte').length,
      ueber: document.querySelector('.seiten-kopf .ueberzeile')?.textContent, satz: document.querySelector('.seiten-kopf p')?.textContent }));
    pruefe('Screen schule: Titel, leere Liste mit "Klasse anlegen", Oberstufe und Verein ab 16', start.titel === 'Schulmodus · Crownmate' && start.neu && start.karten === 0
      && start.ueber === 'Für Lehrkräfte und Vereine' && /ab 16/.test(start.satz), start);
    await bild(seite, 'lehrkraft-leer-ipad-hell');
    await seite.fill('.sm-neu-name', 'x');
    await seite.click('.sm-neu [type="submit"]');
    pruefe('zu kurzer Name: Satz am Formular, keine Anfrage', (await seite.textContent('.sm-neu .sm-status')) === TEXTE.SCHULE_NAME_UNGUELTIG_KLASSE
      && !srv.aufrufe.some((a) => a.name === 'schule_erstelle_klasse'));
    await seite.fill('.sm-neu-name', '  Q1   Schach-AG ');
    await seite.click('.sm-neu [type="submit"]');
    await seite.waitForSelector('.sm-inhalt[data-ansicht="klasse"]', { timeout: 15000 });
    await seite.waitForSelector('.sm-tafel:not([hidden])', { timeout: 5000 });
    const k = srv.klassen[0];
    const tafel = await seite.evaluate(() => ({ code: [...document.querySelectorAll('.sm-tafel-code span')].map((x) => x.textContent).join(''),
      name: document.querySelector('.sm-tafel-name').textContent, fokus: document.activeElement?.className || '', label: document.querySelector('.sm-tafel').getAttribute('aria-label') }));
    pruefe('neue Klasse: Code gleich gross fuer die Tafel (Dialog, Fokus auf Schliessen)', k && k.name === 'Q1 Schach-AG' && tafel.code === k.code && tafel.name === k.name
      && /sm-tafel-zu/.test(tafel.fokus) && tafel.label.includes([...k.code].join(' ')), tafel);
    await bild(seite, 'lehrkraft-tafel-ipad-hell');
    await seite.keyboard.press('Escape');
    const nachEsc = await seite.evaluate(() => ({ zu: document.querySelector('.sm-tafel').hidden, code: [...document.querySelectorAll('.sm-code span')].map((x) => x.textContent).join(''),
      name: document.querySelector('.sm-klasse-name').textContent, leer: !document.querySelector('.sm-leer').hidden }));
    pruefe('Escape schliesst die Tafel; Klasse mit Code (6 Felder) und leerer Mitgliederliste', nachEsc.zu && nachEsc.code === k.code && nachEsc.name === 'Q1 Schach-AG' && nachEsc.leer, nachEsc);
    await seite.click('.sm-gross');
    await seite.waitForSelector('.sm-tafel:not([hidden])');
    await seite.click('.sm-tafel', { position: { x: 5, y: 5 } });
    pruefe('"Groß zeigen" oeffnet die Tafel, Tipp schliesst sie', await seite.evaluate(() => document.querySelector('.sm-tafel').hidden));
    // mit der Tastatur: Tab und Shift+Tab bleiben in der offenen Tafel, Escape bringt den Fokus zurueck
    await seite.focus('.sm-gross');
    await seite.keyboard.press('Enter');
    await seite.waitForSelector('.sm-tafel:not([hidden])');
    for (const taste of ['Tab', 'Tab', 'Shift+Tab', 'Tab']) await seite.keyboard.press(taste);
    const falle = await seite.evaluate(() => ({ drin: !!document.activeElement?.closest('.sm-tafel'), cls: document.activeElement?.className || '' }));
    pruefe('Tafel offen: Tab und Shift+Tab bleiben in der Tafel (Fokusfalle)', falle.drin && /sm-tafel-zu/.test(falle.cls), falle);
    await seite.keyboard.press('Escape');
    pruefe('... Escape schliesst sie, der Fokus steht wieder auf "Groß zeigen"', await seite.evaluate(() => document.querySelector('.sm-tafel').hidden
      && document.activeElement?.classList.contains('sm-gross')));

    // Aufgaben
    const arten = await seite.evaluate(() => [...document.querySelectorAll('.sm-aufgabe-neu input[name="sm-art"]')].map((x) => x.value));
    pruefe('Arten im Formular: Raetsel nur, wenn ein Paket Raetsel zaehlt (RAETSEL_AUFGABEN, heute aus)', JSON.stringify(arten)
      === JSON.stringify(RAETSEL_AUFGABEN ? ['bot', 'raetsel', 'partien'] : ['bot', 'partien']), arten);
    await seite.fill('.sm-a-titel', 'Gabeln mit Rudi');
    await seite.selectOption('.sm-a-bot', 'rudi');
    await seite.fill('.sm-a-faellig', IN_7);
    await seite.click('.sm-aufgabe-neu [type="submit"]');
    await seite.waitForSelector('.sm-aufgaben li', { timeout: 10000 });
    const a1 = await seite.evaluate(() => [...document.querySelectorAll('.sm-aufgaben li')].map((li) => li.innerText.replace(/\s+/g, ' ').trim()));
    pruefe('Bot-Aufgabe gestellt: Ziel und Termin, 0 von 0 erledigt; Server bekommt { bot, sterne } und das Datum', a1.length === 1 && a1[0].includes('Ritter Rudi besiegen · bis ')
      && a1[0].includes('0 von 0 erledigt') && JSON.stringify(srv.aufgaben[0].ziel) === '{"bot":"rudi","sterne":1}' && srv.aufgaben[0].faellig === IN_7, a1);
    await seite.click('.sm-art:has(input[value="partien"])');
    const felder = await seite.evaluate(() => ({ bot: document.querySelector('.sm-a-bot').closest('label').hidden, anzahl: document.querySelector('.sm-a-anzahl').closest('label').hidden }));
    pruefe('Art "Partien spielen": Anzahl statt Bot', felder.bot && !felder.anzahl, felder);
    await seite.fill('.sm-a-titel', 'Drei Partien');
    await seite.fill('.sm-a-anzahl', '0');
    await seite.click('.sm-aufgabe-neu [type="submit"]');
    pruefe('Anzahl 0: Satz am Formular, keine Anfrage', /1 bis 100/.test(await seite.textContent('.sm-aufgabe-neu .sm-status')) && srv.aufgaben.length === 1);
    await seite.fill('.sm-a-anzahl', '3');
    await seite.click('.sm-aufgabe-neu [type="submit"]');
    await seite.waitForFunction(() => document.querySelectorAll('.sm-aufgaben li').length === 2);
    pruefe('Partien-Aufgabe gestellt', JSON.stringify(srv.aufgaben[1].ziel) === '{"anzahl":3}' && srv.aufgaben[1].faellig === null
      && /Aufgabe „Drei Partien“ gestellt/.test(await seite.textContent('.sm-aufgabe-neu .sm-status')));

    // Mitglieder kommen dazu (wie aus der Klasse heraus beigetreten)
    const mitglied = (id, name, f) => { srv.mitglieder.push({ id, klasse: k.id, uid: 'x-' + id, anzeigename: name, beigetreten_am: new Date().toISOString() }); if (f) srv.fortschritt.set(id, f); };
    mitglied(uuid(31), 'Anna', { bots_besiegt: 3, sterne: 7, partien: 12, genauigkeit_schnitt: 81.5, erledigt: [srv.aufgaben[0].id], aktualisiert_am: tagIso(),
      haeufigste_fehler: { zuege: 240, arten: [{ art: 'fehler', anzahl: 9 }, { art: 'ungenau', anzahl: 7 }] } });
    mitglied(uuid(32), 'Ben', null);
    mitglied(uuid(33), 'Cem', { bots_besiegt: 4, sterne: 12, partien: 3, genauigkeit_schnitt: null, erledigt: [], aktualisiert_am: tagIso(),
      haeufigste_fehler: { zuege: 40, arten: [{ art: 'patzer', anzahl: 2 }] } });
    await seite.click('.sm-neu-laden');
    await seite.waitForFunction(() => document.querySelectorAll('.sm-tabelle tbody tr').length === 3);
    const z1 = await zeilen(seite);
    pruefe('Mitglieder: Name, Bots, Sterne, Partien, Genauigkeit, häufigste Fehler (Klartext-Namen), Aufgaben, Stand', z1.length === 3 && z1[0][0] === 'Anna'
      && z1[0][1] === '3 / 10' && z1[0][2] === '7 / 30' && z1[0][3] === '12' && z1[0][4] === '81,5 %' && z1[0][5] === 'Daneben 9 · Unscharf 7' && z1[0][6] === '1 / 2'
      && z1[1][0] === 'Ben' && z1[1][7] === 'noch nichts' && z1[2][4] === '–' && z1[2][5] === 'Weit daneben 2', z1);
    const [jj, mm, tt] = tagIso().split('-');
    pruefe('Stand: nur der Tag der letzten Meldung ("TT.MM.", ohne Uhrzeit), Hilfe sagt es so', z1[0][7] === `${tt}.${mm}.` && jj.length === 4
      && /an welchem Tag zuletzt ein Fortschritt kam/.test(await seite.textContent('.sm-mitglieder-karte .sm-hilfe')), z1[0][7]);
    const titel = await seite.textContent('#sm-m-titel');
    const aufg = await seite.evaluate(() => document.querySelector('.sm-aufgaben li').innerText);
    pruefe('Kopf zaehlt die Mitglieder, Aufgabe zaehlt die Erledigten', titel === 'Mitglieder (3)' && /1 von 3 erledigt/.test(aufg), { titel, aufg });
    const text = await seite.evaluate(() => document.querySelector('.sm-mitglieder-karte').innerText);
    pruefe('Tabelle ohne E-Mail und ohne Konto-ID', !text.includes('@') && !text.includes('x-' + '0000'), text.slice(0, 200));
    await seite.click('.sm-sort[data-spalte="sterne"]');
    const z2 = (await zeilen(seite)).map((z) => z[0]);
    const sort2 = await seite.getAttribute('th[data-spalte="sterne"]', 'aria-sort');
    await seite.click('.sm-sort[data-spalte="sterne"]');
    const z3 = (await zeilen(seite)).map((z) => z[0]);
    const sort3 = await seite.getAttribute('th[data-spalte="sterne"]', 'aria-sort');
    pruefe('sortieren nach Sternen: erst absteigend, dann aufsteigend, ohne Stand immer unten (aria-sort)', z2.join() === 'Cem,Anna,Ben' && sort2 === 'descending'
      && z3.join() === 'Anna,Cem,Ben' && sort3 === 'ascending' && (await seite.getAttribute('th[data-spalte="name"]', 'aria-sort')) === 'none', { z2, z3, sort2, sort3 });
    await bild(seite, 'lehrkraft-klasse-ipad-hell');
    // Ben entfernen
    await seite.click(`tr[data-mitglied="${uuid(32)}"] .sm-entfernen`);
    await antworte(seite, 'Entfernen');
    await seite.waitForFunction(() => document.querySelectorAll('.sm-tabelle tbody tr').length === 2);
    pruefe('Mitglied entfernen (mit Rueckfrage): Zeile weg, Server weiss es', !srv.mitglieder.some((m) => m.anzeigename === 'Ben')
      && /Ben ist nicht mehr in der Klasse/.test(await seite.textContent('.sm-mitglieder-karte .sm-status')));
    // Aufgabe loeschen
    await seite.click(`li[data-aufgabe="${srv.aufgaben[1].id}"] .sm-a-loeschen`);
    await antworte(seite, 'Löschen');
    await seite.waitForFunction(() => document.querySelectorAll('.sm-aufgaben li').length === 1);
    pruefe('Aufgabe loeschen (mit Rueckfrage)', srv.aufgaben.length === 1 && srv.aufgaben[0].titel === 'Gabeln mit Rudi');
    // Zurueck im Kopf: aus der Klasse zur Liste
    await seite.click('.schule-screen .kopf-zurueck');
    await seite.waitForSelector('.sm-inhalt[data-ansicht="liste"] .sm-klasse-karte');
    const karte = await seite.evaluate(() => document.querySelector('.sm-klasse-karte').innerText.replace(/\s+/g, ' '));
    pruefe('Zurueck im Kopf fuehrt aus der Klasse zur Liste (Karte mit Code und Mitgliederzahl)', karte.includes('Q1 Schach-AG') && karte.includes(k.code) && karte.includes('2 Mitglieder'), karte);
    await seite.click('.sm-klasse-karte');
    await seite.waitForSelector('.sm-inhalt[data-ansicht="klasse"]');
    // schliessen
    await seite.click('.sm-ende-knopf');
    await antworte(seite, 'Schließen');
    await seite.waitForSelector('.sm-inhalt[data-ansicht="klasse"] .sm-geschlossen', { timeout: 10000 });
    const zu = await seite.evaluate(() => ({ code: !!document.querySelector('.sm-code-karte'), form: !!document.querySelector('.sm-aufgabe-neu'),
      knopf: document.querySelector('.sm-ende-knopf').textContent, zeilen: document.querySelectorAll('.sm-tabelle tbody tr').length, text: document.querySelector('.sm-ende-text').textContent }));
    pruefe('geschlossen: kein Code, keine neue Aufgabe, Übersicht bleibt, Knopf "Klasse löschen", 90 Tage genannt', !zu.code && !zu.form && zu.knopf === 'Klasse löschen' && zu.zeilen === 2
      && /90 Tage/.test(zu.text) && k.aktiv === false, zu);
    await seite.click('.sm-ende-knopf');
    await antworte(seite, 'Endgültig löschen');
    await seite.waitForFunction(() => document.querySelector('.sm-inhalt')?.dataset.ansicht === 'liste' && !document.querySelector('.sm-klasse-karte'), null, { timeout: 10000 });
    pruefe('loeschen: zurueck zur leeren Liste, Server leer', srv.klassen.length === 0 && srv.mitglieder.length === 0);
    const alle = await seite.evaluate(() => document.querySelector('.schule-screen').innerText);
    pruefe('Texte der Lehrkraft-Ansicht ohne Druck und Countdown', fair(alle));
    pruefe('keine Fehler in der Konsole', fehler.length === 0, fehler);
    await kontext.close();
  }

  // ---------- ohne Konto ----------
  gruppe = 'Ohne Konto';
  {
    const { kontext, seite, fehler } = await neueSeite(browser, { sitzung: null });
    await bereit(seite, '#schule');
    await seite.waitForSelector('.sm-inhalt[data-ansicht="abgemeldet"]', { timeout: 20000 });
    await seite.click('[data-sm="einstellungen"]');
    await seite.waitForFunction(() => document.documentElement.dataset.screen === 'einstellungen');
    const g = await seite.evaluate(() => {
      const el = document.querySelector('.schule-gruppe');
      return el ? { an: el.dataset.angemeldet, hinweis: !el.querySelector('.sm-abgemeldet').hidden, form: !el.querySelector('.sm-beitreten').hidden } : null;
    });
    pruefe('ohne Anmeldung: Screen sagt "braucht ein Konto" und fuehrt zu den Einstellungen; Gruppe nur mit Hinweis', g && g.an === 'nein' && g.hinweis && !g.form, g);
    pruefe('keine Fehler', fehler.length === 0, fehler);
    await kontext.close();
    const zwei = await neueSeite(browser, { sitzung: A, konto: false });
    await bereit(zwei.seite, '#einstellungen');
    await zwei.seite.waitForSelector('.es-ort', { state: 'attached' });
    await warte(300);
    pruefe('Konto nicht freigeschaltet: keine Gruppe "Klasse"', (await zwei.seite.locator('.schule-gruppe').count()) === 0);
    await zwei.kontext.close();
    const drei = await neueSeite(browser, { sitzung: null, konto: false });
    await bereit(drei.seite, '#schule');
    await drei.seite.waitForSelector('.sm-inhalt[data-ansicht="nicht-frei"]', { timeout: 20000 });
    const nf = await drei.seite.evaluate(() => ({ text: document.querySelector('.sm-inhalt').innerText, einstellungen: !!document.querySelector('[data-sm="einstellungen"]') }));
    await drei.seite.click('[data-sm="arena"]');
    await drei.seite.waitForFunction(() => document.documentElement.dataset.screen === 'arena', null, { timeout: 10000 });
    pruefe('Konten nicht sichtbar: #schule sagt "noch nicht freigeschaltet" und fuehrt zur Arena (keine Sackgasse in den Einstellungen)',
      /noch nicht freigeschaltet/.test(nf.text) && !nf.einstellungen && fair(nf.text), nf);
    pruefe('keine Fehler (nicht freigeschaltet)', drei.fehler.length === 0, drei.fehler);
    await drei.kontext.close();
  }

  // ---------- Schuelerin: beitreten und austreten in den Einstellungen ----------
  gruppe = 'Beitreten';
  {
    const srv = serverMitKlasse();
    const { kontext, seite, fehler } = await neueSeite(browser, { sitzung: A, srv, w: 390, h: 844, handy: true });
    await bereit(seite, '#einstellungen');
    await seite.waitForSelector('.schule-gruppe[data-angemeldet="ja"]', { timeout: 20000 });
    await cssDa(seite);
    const g = await seite.evaluate(() => {
      const gr = [...document.querySelectorAll('.es-gruppe')];
      return { nachKonto: gr.indexOf(document.querySelector('.schule-gruppe')) === gr.indexOf(document.querySelector('.konto-gruppe')) + 1,
        sieht: document.querySelector('.schule-gruppe .sm-sieht').textContent, mitglied: document.querySelectorAll('.sm-mitgliedschaft').length,
        leiten: !document.querySelector('.sm-leiten').hidden };
    });
    pruefe('Gruppe "Klasse" direkt unter dem Konto, mit dem Satz, was die Lehrkraft sieht, und "Klassen leiten"', g.nachKonto && g.sieht === WAS_DIE_LEITUNG_SIEHT
      && g.mitglied === 0 && g.leiten, g);
    await seite.fill('.sm-code-eingabe', 'ABCDEF');
    await seite.fill('.sm-name-eingabe', 'Anna');
    await seite.click('[data-schule="beitreten"]');
    await seite.waitForFunction(() => document.querySelector('.schule-gruppe .sm-status').dataset.fehler === 'ja');
    pruefe('unbekannter Code: ruhiger Satz', (await seite.textContent('.schule-gruppe .sm-status')) === TEXTE.SCHULE_CODE_UNGUELTIG);
    const n = srv.aufrufe.length;
    await seite.fill('.sm-code-eingabe', 'k7q-2mx');
    await seite.fill('.sm-name-eingabe', 'anna@schule.de');
    await seite.click('[data-schule="beitreten"]');
    pruefe('E-Mail als Anzeigename: abgelehnt, ohne Anfrage', (await seite.textContent('.schule-gruppe .sm-status')) === TEXTE.SCHULE_NAME_UNGUELTIG && srv.aufrufe.length === n);
    await seite.fill('.sm-name-eingabe', '  Anna  ');
    await seite.click('[data-schule="beitreten"]');
    await seite.waitForSelector('.sm-mitgliedschaft', { timeout: 10000 });
    const m = await seite.evaluate(() => ({ titel: document.querySelector('.sm-m-titel').textContent, aufgaben: [...document.querySelectorAll('.sm-m-aufgaben li')].map((li) => li.innerText.replace(/\s+/g, ' ')),
      status: document.querySelector('.schule-gruppe .sm-status').textContent, code: document.querySelector('.sm-code-eingabe').value }));
    pruefe('Austreten: sichtbarer Text steht im zugaenglichen Namen', (await seite.getAttribute('.sm-austreten', 'aria-label')) === 'Austreten aus „Q1 Schach-AG“');
    pruefe('beigetreten: Klasse mit Anzeigename und Aufgaben (Ziel, Stand, Termin), Felder leer', m.titel === 'Q1 Schach-AG als „Anna“' && m.aufgaben.length === 2
      && m.aufgaben.some((t) => t.includes('Gabeln mit Rudi') && t.includes('Ritter Rudi besiegen') && t.includes('bis '))
      && m.aufgaben.some((t) => t.includes('2 Rätsel lösen · 0 von 2')) && m.status === 'Willkommen in „Q1 Schach-AG“.' && m.code === '', m);
    pruefe('Server: Code normalisiert, Name sauber', srv.mitglieder.length === 1 && srv.mitglieder[0].anzeigename === 'Anna' && srv.mitglieder[0].uid === UID_A);
    await seite.waitForFunction(() => true);
    for (let i = 0; i < 100 && !srv.meldungen.length; i++) await warte(100);
    const mel = srv.meldungen[0];
    pruefe('gleich nach dem Beitritt: Fortschritt gemeldet (genau die Felder der SQL-Funktion)', mel && JSON.stringify(Object.keys(mel.d)) === JSON.stringify(SQL_PARAMS.schule_melde_fortschritt)
      && mel.d.bots_besiegt === 0 && mel.d.partien === 0 && Array.isArray(mel.d.erledigt), mel && mel.d);
    const l1 = await lage(seite);
    pruefe('Handy: nichts ragt aus dem Bildschirm', l1.ueber <= 1 && l1.raus === 0, l1);
    await seite.evaluate(() => document.querySelector('.schule-gruppe').scrollIntoView());
    await bild(seite, 'einstellungen-klasse-handy-hell');
    await seite.click('[data-schule="verlassen"]');
    await antworte(seite, 'Austreten');
    await seite.waitForFunction(() => !document.querySelector('.sm-mitgliedschaft'), null, { timeout: 10000 });
    pruefe('austreten (mit Rueckfrage): Mitgliedschaft weg, Server weiss es', srv.mitglieder.length === 0
      && /ausgetreten/.test(await seite.textContent('.schule-gruppe .sm-status')));
    const gt = await seite.evaluate(() => document.querySelector('.schule-gruppe').innerText);
    pruefe('Texte der Gruppe ohne Druck und Countdown', fair(gt));
    pruefe('keine Fehler', fehler.length === 0, fehler);
    await kontext.close();
  }

  // ---------- Heute-Karte in der Arena ----------
  gruppe = 'Heute-Karte';
  {
    const srv = serverMitKlasse();
    srv.mitglieder.push({ id: uuid(41), klasse: uuid(1), uid: UID_A, anzeigename: 'Anna', beigetreten_am: new Date().toISOString() });
    const stand = rpcAntwort(srv, 'schule_meine_klassen', UID_A, {}).body;
    const vorher = { 'schach-arena:schule:stand': { uid: UID_A, daten: stand, geholtAm: Date.now() }, 'schach-arena:v1:fortschritt': fortschrittBisLisa() };
    const { kontext, seite, fehler } = await neueSeite(browser, { sitzung: A, srv, vorher });
    await bereit(seite, '#arena');
    await seite.waitForSelector('.heute-karte:not([hidden]) .sm-heute', { timeout: 20000 });
    await cssDa(seite);
    // Rudi ist der naechste Gegner und schon gewaehlt: kein Knopf; mit Benno im Panel steht "Zu Rudi" da
    const ohneKnopf = await seite.evaluate(() => ({ bot: document.querySelector('.arena .detail .detail-name')?.textContent || '',
      knopf: document.querySelectorAll('.sm-heute .sm-heute-los').length }));
    pruefe('Rudi schon gewaehlt: Zeile ohne Knopf', /Ritter Rudi/.test(ohneKnopf.bot) && ohneKnopf.knopf === 0, ohneKnopf);
    await seite.evaluate(() => window.__app.gehe('arena', { waehle: 'benno' }, { ersetzen: true }));
    await seite.waitForFunction(() => /Benno/.test(document.querySelector('.arena .detail .detail-name')?.textContent || '') && document.querySelector('.sm-heute'), null, { timeout: 10000 });
    const z = await seite.evaluate(() => {
      const el = document.querySelector('.sm-heute');
      return { titel: el.querySelector('b').textContent, text: el.querySelector('.sm-heute-text').textContent.replace(/\s+/g, ' '), knopf: el.querySelector('.sm-heute-los')?.textContent || null,
        breit: el.scrollWidth <= el.clientWidth + 1, art: el.dataset.art };
    });
    pruefe('Knoepfe: der sichtbare Text steht im zugaenglichen Namen (WCAG 2.5.3)', await seite.evaluate(() => [...document.querySelectorAll('.sm-heute button')]
      .every((k) => !k.hasAttribute('aria-label') || k.getAttribute('aria-label').includes(k.textContent.trim()))));
    pruefe('Heute-Karte: naechste Aufgabe mit Ziel, Termin, Klasse (zuletzt) und Knopf zum Bot', z.titel === 'Gabeln mit Rudi'
      && z.text.includes('Gabeln mit Rudi · Ritter Rudi besiegen · bis ') && z.text.endsWith('· Q1 Schach-AG') && z.knopf === 'Zu Rudi' && z.art === 'bot' && fair(z.text), z);
    const sicht = await seite.evaluate(() => {
      const z = document.querySelector('.sm-heute .sm-heute-ziel');
      const t = document.querySelector('.sm-heute .sm-heute-text').getBoundingClientRect();
      const r = document.createRange();
      r.selectNodeContents(z);
      const teile = [...r.getClientRects()];
      return { text: z.innerText.replace(/\s+/g, ' '), innen: teile.length > 0 && teile.every((x) => x.left >= t.left - 1 && x.right <= t.right + 1 && x.bottom <= t.bottom + 1) };
    });
    pruefe('iPad neben "Zu Rudi": Ziel, Termin und Klasse ganz zu sehen (zweite Zeile, nichts abgeschnitten)', sicht.innen && /bis \S+ \d\d\.\d\d\./.test(sicht.text)
      && sicht.text.endsWith('Q1 Schach-AG'), sicht);
    await bild(seite, 'heute-aufgabe-ipad-hell');
    await seite.click('.sm-heute-los');
    await seite.waitForFunction(() => /Rudi/.test(document.querySelector('.arena .detail .detail-name')?.textContent || ''), null, { timeout: 10000 }).catch(() => {});
    const gewaehlt = await seite.evaluate(() => document.querySelector('.arena .detail .detail-name')?.textContent || '');
    pruefe('"Zu Rudi" waehlt Ritter Rudi in der Arena (dann ohne eigenen Knopf)', /Ritter Rudi/.test(gewaehlt)
      && (await seite.locator('.sm-heute .sm-heute-los').count()) === 0, gewaehlt);
    // Rudi besiegt: die Raetsel-Aufgabe ist dran, Knopf "Ueben" fuehrt ins Training
    await seite.evaluate((f) => { localStorage.setItem('schach-arena:v1:fortschritt', JSON.stringify(f)); window.__app.gehe('arena', {}, { ersetzen: true }); }, fortschrittBisLisa(true));
    await seite.waitForFunction(() => document.querySelector('.sm-heute')?.dataset.art === 'raetsel', null, { timeout: 10000 });
    const r = await seite.evaluate(() => ({ text: document.querySelector('.sm-heute').innerText.replace(/\s+/g, ' '), knopf: document.querySelector('.sm-heute-los')?.textContent }));
    pruefe('Bot-Aufgabe erledigt: die Raetsel-Aufgabe mit "0 von 2" und "Üben"', r.text.includes('Zwei Rätsel') && r.text.includes('0 von 2') && r.knopf === 'Üben', r);
    await seite.click('.sm-heute-los');
    await seite.waitForFunction(() => document.documentElement.dataset.screen === 'training', null, { timeout: 10000 });
    pruefe('"Üben" fuehrt ins Training', true);
    // Raetsel geloest (Ereignis wie vom Raetsel-Paket): zaehlt, beide erledigt, keine Zeile mehr
    await seite.evaluate(async () => {
      const { sende } = await import('./js/ereignisse.js');
      sende('raetsel:geloest', { id: 'r-1', richtig: true, versuch: 1, quelle: 'tag', wertung: null });
      sende('raetsel:geloest', { id: 'r-2', richtig: true, versuch: 1, quelle: 'tag', wertung: null });
      window.__app.gehe('arena', {}, { ersetzen: true });
    });
    await seite.waitForFunction(() => document.documentElement.dataset.screen === 'arena');
    await warte(400);
    pruefe('alle Aufgaben erledigt: keine Zeile in der Heute-Karte', (await seite.locator('.sm-heute').count()) === 0);
    pruefe('keine Fehler', fehler.length === 0, fehler);
    await kontext.close();
  }

  // ---------- Melden nach der Partie, auch offline ----------
  gruppe = 'Melden';
  {
    const srv = serverMitKlasse();
    srv.mitglieder.push({ id: uuid(41), klasse: uuid(1), uid: UID_A, anzeigename: 'Anna', beigetreten_am: new Date().toISOString() });
    const stand = rpcAntwort(srv, 'schule_meine_klassen', UID_A, {}).body;
    const vorher = { 'schach-arena:schule:stand': { uid: UID_A, daten: stand, geholtAm: Date.now() }, 'schach-arena:v1:fortschritt': fortschrittBisLisa() };
    srv.offline = true;
    const { kontext, seite, fehler } = await neueSeite(browser, { sitzung: A, srv, vorher });
    await bereit(seite, '#arena');
    const beendet = () => seite.evaluate(async () => {
      const { sende } = await import('./js/ereignisse.js');
      sende('partie:beendet', { laufId: 'l1', partieId: 'p1', botId: 'lisa', botStufe: 4, farbe: 'w', modus: 'normal', wertet: true, ergebnis: 'sieg', grund: 'matt',
        eigeneZuege: 20, liveKlassen: [], maxSerie: 3, hinweise: 0, zuruecknahmen: 0, neueSterne: [], neuFreigeschaltet: null, extra: {}, datum: new Date().toISOString(), dauerMs: 1000 });
    });
    await beendet();
    // der Versuch kommt fruehestens nach BUENDEL_MS (unter Last spaeter): auf ihn warten, dann noch kurz
    for (let i = 0; i < 150 && !srv.aufrufe.some((a) => a.name === 'schule_melde_fortschritt'); i++) await warte(100);
    await warte(300);
    const off = await seite.evaluate((k) => ({ offen: !!localStorage.getItem(k), toast: [...document.querySelectorAll('.toast')].map((t) => t.textContent) }), OFFEN_SCHLUESSEL);
    pruefe('offline nach der Partie: Meldung vorgemerkt, still (kein Hinweis)', off.offen && off.toast.length === 0 && srv.meldungen.length === 0
      && srv.aufrufe.some((a) => a.name === 'schule_melde_fortschritt'), off);
    srv.offline = false;
    await seite.evaluate(async () => { const { sende } = await import('./js/ereignisse.js'); sende('app:sichtbar', { sichtbar: true }); });
    for (let i = 0; i < 100 && !srv.meldungen.length; i++) await warte(100);
    await warte(200);
    const nachher = await seite.evaluate((k) => !!localStorage.getItem(k), OFFEN_SCHLUESSEL);
    pruefe('zurueck in der App (wieder online): Meldung geht raus, nichts mehr vorgemerkt', srv.meldungen.length === 1 && !nachher
      && srv.meldungen[0].d.bots_besiegt === 4 && srv.meldungen[0].d.sterne === 4 && srv.meldungen[0].uid === UID_A, srv.meldungen.map((x) => x.d));
    // zwei Partien kurz hintereinander: hoechstens eine Meldung je Minute
    await beendet();
    await beendet();
    await warte(BUENDEL_MS + 1500);
    pruefe('zwei weitere Partien kurz danach: keine zweite Meldung in derselben Minute', srv.meldungen.length === 1);
    // neuer Stand (Rudi besiegt), dann zurueck in die App und wieder online, alles in derselben Minute: auch das
    // Nachholen wartet die Minute ab (die gleich-Sperre greift hier nicht, der Stand ist ein anderer)
    await seite.evaluate((f) => localStorage.setItem('schach-arena:v1:fortschritt', JSON.stringify(f)), fortschrittBisLisa(true));
    await beendet();
    await seite.evaluate(async () => { const { sende } = await import('./js/ereignisse.js'); sende('app:sichtbar', { sichtbar: true }); window.dispatchEvent(new Event('online')); });
    await warte(BUENDEL_MS + 1500);
    const nochOffen = await seite.evaluate((k) => !!localStorage.getItem(k), OFFEN_SCHLUESSEL);
    pruefe('neuer Stand, zurueck in der App und wieder online in derselben Minute: keine zweite Meldung, sie bleibt vorgemerkt',
      srv.meldungen.length === 1 && nochOffen, { meldungen: srv.meldungen.length, nochOffen });
    pruefe('keine Fehler', fehler.length === 0, fehler);
    await kontext.close();
  }

  // ---------- Handy und dunkel: Lehrkraft-Ansicht ----------
  gruppe = 'Handy';
  for (const [w, h, schema, name] of [[375, 740, 'dark', 'handy-dunkel'], [1180, 820, 'dark', 'ipad-dunkel'], [820, 1180, 'light', 'ipad-hoch-hell']]) {
    const srv = serverMitKlasse();
    for (const [i, n] of ['Anna-Lena Großmann', 'Ben', 'Cem', 'Dörte', 'Emil'].entries()) {
      srv.mitglieder.push({ id: uuid(60 + i), klasse: uuid(1), uid: 'x' + i, anzeigename: n, beigetreten_am: new Date().toISOString() });
      if (i !== 1) srv.fortschritt.set(uuid(60 + i), { bots_besiegt: i + 2, sterne: 3 * i + 1, partien: 10 * i + 4, genauigkeit_schnitt: 70 + i, erledigt: i % 2 ? [uuid(11)] : [],
        aktualisiert_am: tagIso(), haeufigste_fehler: { zuege: 300, arten: [{ art: 'verpasst', anzahl: 12 }, { art: 'patzer', anzahl: 4 }] } });
    }
    const { kontext, seite, fehler } = await neueSeite(browser, { sitzung: L, srv, w, h, schema, handy: w < 500 });
    await bereit(seite, '#schule');
    await seite.waitForSelector('.sm-klasse-karte', { timeout: 20000 });
    await cssDa(seite);
    await seite.click('.sm-klasse-karte');
    await seite.waitForSelector('.sm-tabelle tbody tr', { timeout: 10000 });
    await warte(tempoWarte);
    const l = await lage(seite);
    pruefe(`${name}: Seite ohne waagrechtes Scrollen, Knoepfe und Felder im Bild, die Tabelle scrollt in ihrer Huelle`, l.ueber <= 1 && l.raus === 0
      && l.huelle && l.huelle.rechts <= l.vw + 1, l);
    await bild(seite, `lehrkraft-klasse-${name}`);
    if (name === 'handy-dunkel') {
      // Neu laden ohne Netz: Satz an der Karte, die Klasse bleibt
      srv.offline = true;
      await seite.click('.sm-neu-laden');
      await seite.waitForFunction(() => document.querySelector('.sm-mitglieder-karte .sm-status')?.dataset.fehler === 'ja', null, { timeout: 10000 });
      pruefe('Neu laden ohne Netz: ruhiger Satz an der Karte, Tabelle bleibt', (await seite.textContent('.sm-mitglieder-karte .sm-status')) === TEXTE.offline
        && (await seite.locator('.sm-tabelle tbody tr').count()) === 5);
      srv.offline = false;
    }
    await seite.click('.sm-gross');
    await seite.waitForSelector('.sm-tafel:not([hidden])');
    await warte(tempoWarte);
    const t = await seite.evaluate(() => {
      const r = document.querySelector('.sm-tafel-code').getBoundingClientRect();
      const k = document.querySelector('.sm-tafel-karte').getBoundingClientRect();
      const felder = [...document.querySelectorAll('.sm-tafel-code span')].map((x) => x.getBoundingClientRect());
      return { links: r.left, rechts: r.right, vw: innerWidth, hoch: r.height, karte: [k.left, k.right], eineZeile: new Set(felder.map((f) => Math.round(f.top))).size === 1,
        innen: felder.every((f) => f.left >= k.left && f.right <= k.right) };
    });
    pruefe(`${name}: Code gross, in einer Zeile, ganz in der Karte und im Bild`, t.links >= 0 && t.rechts <= t.vw && t.hoch >= 40 && t.eineZeile && t.innen, t);
    const c = await seite.evaluate(() => {
      const k = document.querySelector('.sm-code-karte').getBoundingClientRect();
      const f = [...document.querySelectorAll('.sm-code span')].map((x) => x.getBoundingClientRect());
      return { eineZeile: new Set(f.map((x) => Math.round(x.top))).size === 1, innen: f.every((x) => x.left >= k.left && x.right <= k.right) };
    });
    pruefe(`${name}: Code in der Karte in einer Zeile`, c.eineZeile && c.innen, c);
    await bild(seite, `lehrkraft-tafel-${name}`);
    pruefe(`${name}: keine Fehler`, fehler.length === 0, fehler);
    await kontext.close();
  }

  // Klasse auf einem anderen Geraet geloescht: Neu laden fuehrt zur Liste mit einem Satz
  gruppe = 'Klasse weg';
  {
    const srv = serverMitKlasse();
    const { kontext, seite, fehler } = await neueSeite(browser, { sitzung: L, srv });
    await bereit(seite, '#schule');
    await seite.waitForSelector('.sm-klasse-karte', { timeout: 20000 });
    await seite.click('.sm-klasse-karte');
    await seite.waitForSelector('.sm-inhalt[data-ansicht="klasse"]');
    srv.klassen = [];
    await seite.click('.sm-neu-laden');
    await seite.waitForFunction(() => document.querySelector('.sm-inhalt')?.dataset.ansicht === 'liste' && document.querySelector('.sm-neu .sm-status')?.textContent, null, { timeout: 10000 });
    pruefe('geloeschte Klasse: zurueck zur Liste mit Satz statt Fehlerseite', (await seite.textContent('.sm-neu .sm-status')) === TEXTE.SCHULE_KEINE_LEITUNG
      && (await seite.locator('.sm-klasse-karte').count()) === 0);
    pruefe('keine Fehler', fehler.length === 0, fehler);
    await kontext.close();
  }

  gruppe = 'Netz';
  pruefe('keine Anfragen ausser an die App und den gefaelschten Supabase-Server', fremd.length === 0, fremd.slice(0, 5));
}
// Eintritts-Animationen auslaufen lassen, bevor gemessen wird
const tempoWarte = 900;

// =====================================================================
await nodeTeil();
if (!NUR_NODE) {
  let server = null;
  let browser = null;
  try {
    const pw = ladePlaywright();
    server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: WURZEL, stdio: 'ignore' });
    await warteAufServer(`http://127.0.0.1:${PORT}/index.html`);
    browser = await browserTyp(pw).launch();
    await browserTeil(browser);
  } catch (e) {
    pruefe('Browser-Teil lief ohne Ausnahme', false, e && (e.stack || e.message));
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (server) server.kill();
  }
}
console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
