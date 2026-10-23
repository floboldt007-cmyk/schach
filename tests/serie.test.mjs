// Tests fuer das Paket serie (Bauernmarsch und Siegeslauf, SPIELKONZEPT 3.14, 3.15, 3.10, 5.3).
// Node-Teil: Tagesgrenze 4:00, Tageswerk, Bruecken und Ruhen (Kapitel), Ruhetag, Pause, strenge Serie, Reise-Regel,
// Zeitreise, Bauernmarsch (Felder, Umwandlung, Ehrenreihe, Brett, Doppelschritt), Meilensteine, Wochen-Ring, Kalender,
// Beweis-Karte, Siegeslauf (Grenzen, Pausen, stilles Ende, Meilensteine), Speicher (Rechenstand, alte und kaputte Staende,
// Budget), Verdrahtung ueber den Ereignis-Bus, Optik-Regeln der Paket-Dateien.
// Browser-Teil (Playwright, Chromium) gegen die echte App mit ?test&erw=pakete/serie/index: Heute-Karte (neu, offen,
// geschafft, Bruecke, ruhend), Kopf-Chip mit Flamme, Serien-Blatt (Kalender, Ehrenreihe, Ruhetag, Pause, modal),
// Abrechnungszeile am ersten Werk des Tages, Meilenstein- und Umwandlungs-Moment, Umwandlung waehlen, Siegeslauf (Zeile,
// Flamme an Flos Namen, stilles Ende), Einstellungen, reduzierte Bewegung, Handy und dunkel.
//
//   node tests/serie.test.mjs              alles
//   node tests/serie.test.mjs --nur-node   ohne Browser
//   PORT=9600 BILDER=/pfad node tests/serie.test.mjs
//
// Playwright: PLAYWRIGHT_PFAD, sonst 'playwright', sonst /opt/node-tools/node_modules/playwright.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { mkdirSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { browserTyp } from './browser.mjs';
import { setzeSpeicher, MODUL_BUDGET, ladeModul, speicherePartie, ladeModulEinstellungen } from '../js/storage.js';
import { hoere, sende } from '../js/ereignisse.js';
import { fuerOverlay, nachlese } from '../js/feier.js';
import { tagSchluessel, addiereTage } from '../js/tag.js';
import * as T from '../js/pakete/serie/tag.js';
import * as LA from '../js/pakete/serie/lauf.js';
import * as S from '../js/pakete/serie/stand.js';

const require = createRequire(import.meta.url);
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8868);
const NUR_NODE = process.argv.includes('--nur-node');
const bilderArg = process.argv.find((a) => a.startsWith('--bilder='));
const BILDER = bilderArg ? bilderArg.slice(9) : process.env.BILDER || path.join(os.tmpdir(), 'crownmate-serie-bilder');

const ergebnisse = [];
let gruppe = '';
function pruefe(name, ok, detail = '') {
  ergebnisse.push({ name: (gruppe ? gruppe + ': ' : '') + name, ok: !!ok, detail });
  const d = typeof detail === 'string' ? detail : JSON.stringify(detail);
  console.log(`${ok ? 'ok  ' : 'FEHLER'} ${gruppe ? gruppe + ': ' : ''}${name}${!ok && d ? ' (' + d.slice(0, 600) + ')' : ''}`);
}
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

function fakeSpeicher() {
  const m = new Map();
  return {
    m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k),
    key: (i) => [...m.keys()][i] ?? null, get length() { return m.size; },
  };
}
// Datum in Ortszeit (tag.js rechnet mit der Wanduhr)
const ort = (j, mo, t, h = 12, mi = 0) => new Date(j, mo - 1, t, h, mi, 0, 0);
const plus = (k, n) => addiereTage(k, n);
// zaehlt die Tage von..von+n-1, ausser den Versaetzen in ohne
function marsch(st, von, n, { ohne = [], einst = {} } = {}) {
  const r = [];
  for (let i = 0; i < n; i++) if (!ohne.includes(i)) r.push(T.zaehleTag(st, plus(von, i), { quelle: 'partie', einst }));
  return r;
}

// =====================================================================
// Tagesgrenze und Tageswerk
// =====================================================================
gruppe = 'Tagesgrenze';
{
  pruefe('3:59 gehört zum Vortag, 4:00 ist der neue Tag', tagSchluessel(ort(2026, 10, 23, 3, 59)) === '2026-10-22' && tagSchluessel(ort(2026, 10, 23, 4, 0)) === '2026-10-23');
  const st = T.leer();
  const r1 = T.zaehleTag(st, tagSchluessel(ort(2026, 10, 23, 3, 59)), { quelle: 'partie' });
  const r2 = T.zaehleTag(st, tagSchluessel(ort(2026, 10, 23, 4, 1)), { quelle: 'partie' });
  pruefe('Partie um 3:59 zählt zum Vortag, die um 4:01 ist schon der nächste Schachtag', r1.tag === '2026-10-22' && r2.tag === '2026-10-23' && st.aktuell === 2 && r2.bruecken === 0, [r1, r2]);
  const r3 = T.zaehleTag(st, '2026-10-23', { quelle: 'raetsel' });
  pruefe('Derselbe Tag zählt nur einmal', r3 === null && st.aktuell === 2 && st.gesamt === 2);
  // Sommerzeit-Ende (25.10.2026): 2:00 bis 3:59 (zweimal) gehoert zum 24.10.
  pruefe('Ende der Sommerzeit: 3:30 am 25.10. ist noch der 24.10.', tagSchluessel(ort(2026, 10, 25, 3, 30)) === '2026-10-24');
}

gruppe = 'Tageswerk';
{
  const st = T.leer();
  const tag = '2026-10-23';
  pruefe('Werte aus 3.14: Partie ab 10 eigenen Zügen, 3 Karten, 2 Übungen, 3 Rätsel, 1 Lektion', T.WERK.partieZuege === 10 && T.WERK.karten === 3
    && T.WERK.uebungen === 2 && T.WERK.raetsel === 3 && T.WERK.lektionen === 1);
  const k = [T.aktivitaet(st, { tag, art: 'karte' }), T.aktivitaet(st, { tag, art: 'karte' }), T.aktivitaet(st, { tag, art: 'karte' })];
  pruefe('Kartei: die 3. Karte erfüllt das Tageswerk', k[0] === null && k[1] === null && k[2] === 'kartei', k);
  pruefe('Danach liefert dieser Tag keine zweite Quelle', T.aktivitaet(st, { tag, art: 'lektion' }) === null && T.aktivitaet(st, { tag, art: 'partie' }) === null);
  const st2 = T.leer();
  const r = ['r1', 'r1', 'r2', 'r2'].map((id) => T.aktivitaet(st2, { tag, art: 'raetsel', schluessel: id }));
  pruefe('Rätsel: dasselbe Rätsel zählt einmal (2 verschiedene reichen nicht)', r.every((x) => x === null) && st2.heute.r.length === 2, st2.heute);
  pruefe('Rätsel: das 3. verschiedene erfüllt', T.aktivitaet(st2, { tag, art: 'raetsel', schluessel: 'r3' }) === 'raetsel');
  const st3 = T.leer();
  const u = [T.aktivitaet(st3, { tag, art: 'uebung', schluessel: 'p1:12' }), T.aktivitaet(st3, { tag, art: 'uebung', schluessel: 'p1:12' }),
    T.aktivitaet(st3, { tag, art: 'uebung', schluessel: 'p2:30' })];
  pruefe('Zweite Chance: dieselbe Übung zählt einmal, 2 verschiedene erfüllen', u[0] === null && u[1] === null && u[2] === 'uebung', u);
  const st4 = T.leer();
  pruefe('Lektion: eine genügt; Partie: eine genügt', T.aktivitaet(st4, { tag, art: 'lektion' }) === 'lektion'
    && T.aktivitaet(T.leer(), { tag, art: 'partie' }) === 'partie');
  pruefe('Unbekannte Art oder falscher Tag zählt nie', T.aktivitaet(T.leer(), { tag, art: 'oeffnen' }) === null && T.aktivitaet(T.leer(), { tag: 'gestern', art: 'partie' }) === null);
  const st5 = T.leer();
  T.aktivitaet(st5, { tag, art: 'karte' });
  T.aktivitaet(st5, { tag, art: 'karte' });
  pruefe('Neuer Tag: die Zähler beginnen neu (2 Karten von gestern + 1 heute erfüllen nichts)', T.aktivitaet(st5, { tag: plus(tag, 1), art: 'karte' }) === null && st5.heute.k === 1);
}

// =====================================================================
// Bruecken, Ruhen, Kapitel
// =====================================================================
gruppe = 'Brücken und Ruhen';
{
  const st = T.leer();
  marsch(st, '2026-10-01', 5);
  const b = T.zaehleTag(st, '2026-10-07', { quelle: 'partie' });
  pruefe('Ein einzelner freier Tag wird zur Brücke: die Serie läuft weiter, zählt ihn aber nicht', b.aktuell === 6 && b.bruecken === 1
    && st.kapitel.br === 1 && st.gesamt === 6 && !b.neuesKapitel, b);
  const lg = T.lage(st, '2026-10-09', {});
  pruefe('Lage am Tag nach einer Brücke: läuft, „Gestern war ein Brückentag“ (nur im Nachhinein)', lg.art === 'laeuft' && lg.gesternBruecke && lg.aktuell === 6 && !lg.heuteGezaehlt, lg);
  const ruht = T.lage(st, '2026-10-10', {});
  pruefe('Zwei freie Tage hintereinander: die Serie ruht (nie 0: aktuell und Rekord bleiben)', ruht.art === 'ruht' && ruht.aktuell === 6 && ruht.best === 6
    && ruht.naechstesKapitel === 2, ruht);
  const neu = T.zaehleTag(st, '2026-10-10', { quelle: 'kartei' });
  pruefe('Das nächste Tageswerk beginnt Kapitel 2 mit Tag 1; Kapitel 1 steht in der Liste, Rekord und Spieltage bleiben',
    neu.neuesKapitel && neu.aktuell === 1 && neu.kapitel === 2 && st.kapitelListe.length === 1 && st.kapitelListe[0].tage === 6
    && st.kapitelListe[0].von === '2026-10-01' && st.kapitelListe[0].bis === '2026-10-07' && st.best === 6 && st.gesamt === 7, { neu, k: st.kapitelListe });
  marsch(st, '2026-10-11', 9);
  pruefe('Rekord wächst erst, wenn das neue Kapitel ihn übertrifft', st.aktuell === 10 && st.best === 10 && st.gesamt === 16);
  // Ruhetag: zaehlt nie als freier Tag
  const rt = T.leer();
  const einst = { ruhetag: 6 };   // Sonntag
  marsch(rt, '2026-10-12', 6, { einst });   // Mo bis Sa
  const mo = T.zaehleTag(rt, '2026-10-19', { quelle: 'partie', einst });
  pruefe('Ruhetag (Sonntag) ist kein freier Tag: keine Brücke, die Serie läuft', mo.aktuell === 7 && mo.bruecken === 0, mo);
  const rt2 = T.leer();
  marsch(rt2, '2026-10-12', 5, { einst });   // Mo bis Fr
  pruefe('Freier Samstag + Ruhetag Sonntag: eine Brücke, die Serie läuft', T.lage(rt2, '2026-10-19', einst).art === 'laeuft'
    && T.lage(rt2, '2026-10-19', {}).art === 'ruht');
  const rt3 = T.leer();
  marsch(rt3, '2026-10-12', 4, { einst });   // Mo bis Do
  pruefe('Freitag und Samstag frei (Ruhetag dazwischen hilft nicht): die Serie ruht', T.lage(rt3, '2026-10-19', einst).art === 'ruht');
  pruefe('Am Ruhetag selbst sagt die Lage „Ruhetag“', T.lage(rt, '2026-10-25', einst).ruhetag === true && T.lage(rt, '2026-10-24', einst).ruhetag === false);
}

gruppe = 'Strenge Serie';
{
  const einst = { strenge: true };
  const st = T.leer();
  marsch(st, '2026-10-01', 3, { einst });
  const a = T.zaehleTag(st, '2026-10-06', { quelle: 'partie', einst });   // 4. und 5. frei: zwei Schonungstage
  pruefe('Zwei freie Tage im Monat trägt die strenge Serie (Schonungstage)', !a.neuesKapitel && a.aktuell === 4 && st.schonung['2026-10'] === 2, { a, s: st.schonung });
  pruefe('Ein dritter freier Tag im selben Monat lässt sie ruhen', T.lage(st, '2026-10-08', einst).art === 'ruht');
  const b = T.zaehleTag(st, '2026-10-08', { quelle: 'partie', einst });
  pruefe('… und das nächste Tageswerk beginnt ein Kapitel', b.neuesKapitel && b.aktuell === 1);
  const st2 = T.leer();
  marsch(st2, '2026-10-29', 2, { einst });   // 29., 30.
  const c = T.zaehleTag(st2, '2026-11-01', { quelle: 'partie', einst });   // 31.10. frei
  pruefe('Neuer Monat, neue Schonungstage', !c.neuesKapitel && st2.schonung['2026-10'] === 1 && T.lage(st2, '2026-11-04', einst).art === 'laeuft'
    && T.lage(st2, '2026-11-05', einst).art === 'ruht', st2.schonung);
}

gruppe = 'Pause';
{
  const st = T.leer();
  marsch(st, '2026-10-01', 4);
  const heute = '2026-10-05';
  const zurueck = T.pauseAnsagen(st, heute, { ab: '2026-10-04', tage: 3 });
  pruefe('Pause nie rückwirkend (nur heute oder künftige Tage)', !zurueck.ok && zurueck.grund === 'vergangen' && st.pausen.length === 0);
  const p = T.pauseAnsagen(st, heute, { ab: heute, tage: 5 });
  pruefe('Pause ab heute für 5 Tage', p.ok && p.tage.join() === '2026-10-05,2026-10-06,2026-10-07,2026-10-08,2026-10-09' && st.pauseJahr['2026'] === 5, p);
  pruefe('Während der Pause ist die Serie eingefroren (läuft, nie „0“)', T.lage(st, '2026-10-09', {}).art === 'laeuft' && T.lage(st, '2026-10-09', {}).pause
    && T.lage(st, '2026-10-10', {}).art === 'laeuft');
  const nach = T.zaehleTag(st, '2026-10-10', { quelle: 'partie' });
  pruefe('Nach der Pause: weiter mit Tag 5, keine Brücke; Rückkehr bringt einen Doppelschritt', nach.aktuell === 5 && nach.bruecken === 0 && nach.doppelschritt, nach);
  const voll = T.leer();
  const a = T.pauseAnsagen(voll, '2026-01-10', { ab: '2026-01-10', tage: 20 });
  const b = T.pauseAnsagen(voll, '2026-03-10', { ab: '2026-03-10', tage: 20 });
  const c = T.pauseAnsagen(voll, '2026-05-10', { ab: '2026-05-10', tage: 1 });
  pruefe('Höchstens 30 Pausentage im Jahr', a.tage.length === 20 && b.tage.length === 10 && !c.ok && c.grund === 'jahr' && voll.pauseJahr['2026'] === 30
    && T.pauseRest(voll, 2026) === 0, { a: a.tage.length, b: b.tage.length, c });
  const d = T.pauseAnsagen(voll, '2026-12-30', { ab: '2026-12-30', tage: 4 });
  pruefe('Das neue Jahr hat wieder 30', d.tage.join() === '2027-01-01,2027-01-02' && voll.pauseJahr['2027'] === 2, d);
  const st2 = T.leer();
  marsch(st2, '2026-10-01', 2);
  T.pauseAnsagen(st2, '2026-10-03', { ab: '2026-10-03', tage: 7 });
  const weg = T.pauseBeenden(st2, '2026-10-05');
  pruefe('Pause beenden: ab heute weg, die Tage zählen wieder fürs Jahr; vergangene Pausentage bleiben', weg === 5 && st2.pausen.join() === '2026-10-03,2026-10-04'
    && st2.pauseJahr['2026'] === 2, st2.pausen);
}

gruppe = 'Reise-Regel';
{
  const st = T.leer();
  T.zaehleTag(st, '2026-10-01', { quelle: 'partie', tz: -120 });
  T.zaehleTag(st, '2026-10-02', { quelle: 'partie', tz: -120 });
  const r = T.zaehleTag(st, '2026-10-04', { quelle: 'partie', tz: 420 });
  pruefe('Zeitzonenwechsel überspringt genau einen Tag: er gilt als gezählt (Serie +2, Felder +2, im Kalender gezählt)', r.reise === '2026-10-03'
    && r.aktuell === 4 && st.gesamt === 4 && st.felder === 4 && r.bruecken === 0 && st.tage.includes('2026-10-03')
    && T.kalender(st, '2026-10-04', {}, 1)[0].tage.find((d) => d.tag === '2026-10-03').art === 'reise', r);
  const st2 = T.leer();
  T.zaehleTag(st2, '2026-10-01', { quelle: 'partie', tz: -120 });
  T.zaehleTag(st2, '2026-10-02', { quelle: 'partie', tz: -120 });
  const r2 = T.zaehleTag(st2, '2026-10-04', { quelle: 'partie', tz: -120 });
  pruefe('Ohne Zeitzonenwechsel bleibt es eine Brücke', r2.reise === null && r2.aktuell === 3 && r2.bruecken === 1);
  const st3 = T.leer();
  T.zaehleTag(st3, '2026-10-01', { quelle: 'partie', tz: -120 });
  const r3 = T.zaehleTag(st3, '2026-10-04', { quelle: 'partie', tz: 420 });
  pruefe('Zwei übersprungene Tage sind keine Reise: die Serie ruht dazwischen', r3.reise === null && r3.neuesKapitel);
}

gruppe = 'Zeitreise';
{
  const st = T.leer();
  marsch(st, '2026-10-10', 5);
  const vorher = JSON.stringify(st);
  const z = T.zaehleTag(st, '2026-10-08', { quelle: 'partie' });
  pruefe('Uhr zurückgestellt: ein früherer Tag zählt nichts neu, nichts ändert sich', z === null && JSON.stringify(st) === vorher);
  const lg = T.lage(st, '2026-10-08', {});
  pruefe('Lage in der Vergangenheit: läuft, gilt als erledigt (nichts bricht)', lg.art === 'laeuft' && lg.heuteGezaehlt && lg.aktuell === 5);
  pruefe('Tageswerk-Zähler in der Vergangenheit: der Tag zählt trotzdem nicht', T.aktivitaet(st, { tag: '2026-10-08', art: 'partie' }) === 'partie'
    && T.zaehleTag(st, '2026-10-08', { quelle: 'partie' }) === null && st.aktuell === 5);
  const weiter = T.zaehleTag(st, '2026-10-15', { quelle: 'partie' });
  pruefe('Uhr wieder richtig: es geht normal weiter', weiter && weiter.aktuell === 6 && st.gesamt === 6);
  pruefe('Kalender und Ring vertragen eine Uhr in der Vergangenheit', T.kalender(st, '2026-09-01', {}, 6).length >= 1 && T.ringStand(st, '2026-09-01', {}).n >= 0);
}

// =====================================================================
// Bauernmarsch
// =====================================================================
gruppe = 'Bauernmarsch';
{
  const st = T.leer();
  const r = marsch(st, '2026-10-01', 6);
  pruefe('Jeder gezählte Tag ein Feld; nach 6 Feldern die Umwandlung (Figur nach Wahl, zuerst offen)', r.map((x) => x.feld).join() === '1,2,3,4,5,6'
    && r[5].umwandlungen.join() === '1' && r.slice(0, 5).every((x) => !x.umwandlungen.length) && st.figuren === '?' && st.figurTage.join() === '2026-10-06');
  pruefe('Lage: „noch 6 Felder bis zur Umwandlung“, eine Wahl offen', T.lage(st, '2026-10-07').bisUmwandlung === 6 && T.lage(st, '2026-10-07').offeneWahl === 1);
  pruefe('Figur wählen: Dame, Turm, Läufer, Springer (sonst nichts)', !T.waehleFigur(st, 'K') && T.waehleFigur(st, 'S') && st.figuren === 'S' && !T.waehleFigur(st, 'D'));
  const st2 = T.leer();
  marsch(st2, '2026-01-01', 48);
  pruefe('48 Felder: 8 Umwandlungen füllen die erste Ehrenreihe', st2.figuren.length === T.REIHE && st2.bretter === 0 && st2.felder === 48);
  st2.felder = 64 * 6 - 1;
  st2.figuren = 'D'.repeat(62) + '?';
  const voll = T.zaehleTag(st2, '2026-02-18', { quelle: 'partie' });
  const weiter = { ...st2 };
  pruefe('8 Reihen füllen das Brett (64 Figuren)', voll.umwandlungen.join() === '64' && st2.figuren.length === 64 && st2.bretter === 0, voll);
  st2.felder += 5;
  const naechstes = T.zaehleTag(st2, '2026-02-19', { quelle: 'partie' });
  pruefe('Die 65. Umwandlung beginnt ein neues Brett', naechstes.umwandlungen.join() === '65' && st2.bretter === 1 && st2.figuren === '?' && weiter.bretter === 0);
  // Doppelschritt
  const d = T.leer();
  marsch(d, '2026-10-01', 3);
  const nach2 = T.zaehleTag(d, '2026-10-06', { quelle: 'partie' });
  pruefe('Doppelschritt am ersten Tag nach mindestens 2 Tagen ohne Tageswerk (Serie ruht, Bauer zieht 2 Felder)', nach2.doppelschritt && nach2.neuesKapitel
    && d.felder === 5 && nach2.feldVorher === 3, nach2);
  const nochmal = T.zaehleTag(d, '2026-10-12', { quelle: 'partie' });
  pruefe('Höchstens einmal je Kalendermonat', !nochmal.doppelschritt && d.felder === 6);
  const nov = T.zaehleTag(d, '2026-11-02', { quelle: 'partie' });
  pruefe('Im neuen Monat wieder', nov.doppelschritt && d.felder === 8);
  const brueckeOhne = T.leer();
  marsch(brueckeOhne, '2026-10-01', 2);
  pruefe('Eine Brücke (1 freier Tag) bringt keinen Doppelschritt', !T.zaehleTag(brueckeOhne, '2026-10-04', { quelle: 'partie' }).doppelschritt);
  // nie zurueck
  let nieZurueck = true;
  const z = T.leer();
  let alt = 0;
  for (let i = 0; i < 200; i++) {
    if (i % 7 === 3 || i % 11 === 5 || i % 13 === 0) continue;
    T.zaehleTag(z, plus('2026-01-01', i), { quelle: 'partie' });
    if (z.felder < alt || z.gesamt < 0) nieZurueck = false;
    alt = z.felder;
  }
  pruefe('Der Bauer läuft nie zurück, Spieltage gesamt sinken nie (200 Tage mit Lücken)', nieZurueck && z.felder >= z.gesamt && z.kapitel.nr > 1);
}

gruppe = 'Meilensteine';
{
  pruefe('Meilensteine: 3, 5, 7, 10, 14, 21, 30, 50, 66, 100, 150, 200, 365, danach jedes volle Hundert',
    [3, 5, 7, 10, 14, 21, 30, 50, 66, 100, 150, 200, 365, 400, 500, 1000].every(T.istMeilenstein) && ![1, 2, 4, 6, 8, 20, 99, 300, 366, 450].some(T.istMeilenstein));
  const st = T.leer();
  const r = marsch(st, '2026-01-01', 110);
  const ms = r.filter((x) => x.meilenstein).map((x) => x.meilenstein);
  pruefe('Je Meilenstein genau ein Tag (3 bis 100)', ms.join() === '3,5,7,10,14,21,30,50,66,100', ms);
  const m30 = r.find((x) => x.meilenstein === 30);
  pruefe('Plakette mit Zeitraum (30 Schachtage, 01.01. bis 30.01.)', m30.plakette.n === 30 && m30.plakette.von === '2026-01-01' && m30.plakette.bis === '2026-01-30');
  pruefe('Bot-Brief bei 7, 30, 100 (und 365)', r.filter((x) => x.brief).map((x) => x.brief).join() === '7,30,100' && st.brief.n === 100);
  pruefe('Tag 66 genau einmal', r.filter((x) => x.gewohnheit).length === 1 && st.ms66 === '2026-03-07');
  pruefe('Spieltage gesamt: 10, 25, 50, 100 (je ein Vorzug für später)', r.filter((x) => x.gesamtMeilenstein).map((x) => x.gesamtMeilenstein).join() === '10,25,50,100'
    && st.vorzug === 4 && st.gesamtMs.join() === '10,25,50,100');
  // neues Kapitel: Serien-Meilensteine wieder, Spieltage-Meilensteine nie doppelt
  T.zaehleTag(st, plus('2026-01-01', 113), { quelle: 'partie' });
  const r2 = marsch(st, plus('2026-01-01', 114), 4);
  pruefe('Neues Kapitel: die Plakette „3 Schachtage“ gibt es wieder (anderer Zeitraum)', r2.some((x) => x.meilenstein === 3) && st.plaketten[0].von === plus('2026-01-01', 113));
  pruefe('Tag 66 kommt im neuen Kapitel nicht noch einmal', !r2.some((x) => x.gewohnheit));
}

gruppe = 'Wochen-Ring';
{
  const st = T.leer();
  // KW 41 (5.10. bis 11.10.): Mo, Di, Mi, Do = 4 Tage
  for (const k of ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08']) T.zaehleTag(st, k, { quelle: 'partie' });
  // KW 42: 4 Tage (jeder zweite Tag + ein Paar)
  for (const k of ['2026-10-12', '2026-10-14', '2026-10-16', '2026-10-17']) T.zaehleTag(st, k, { quelle: 'partie' });
  T.zaehleTag(st, '2026-10-19', { quelle: 'partie' });
  pruefe('Zwei Wochen mit mindestens 4 Tagen: 2 volle Wochen in Folge', st.ring.n === 2 && st.ring.best === 2 && st.ring.bis === '2026-10-12', st.ring);
  for (const k of ['2026-10-21', '2026-10-23']) T.zaehleTag(st, k, { quelle: 'partie' });
  const r = T.ringStand(st, '2026-10-24', {});
  pruefe('Laufende Woche: 3 von 4 Tagen', r.n === 2 && r.woche.gezaehlt === 3 && r.woche.noetig === 4, r);
  const naechste = T.ringStand(st, '2026-10-27', {});
  pruefe('Woche mit nur 3 Tagen: der Ring beginnt neu (Rekord bleibt)', naechste.n === 0 && naechste.best === 2, naechste);
  const p = T.leer();
  T.zaehleTag(p, '2026-10-05', { quelle: 'partie' });
  T.zaehleTag(p, '2026-10-06', { quelle: 'partie' });
  T.zaehleTag(p, '2026-10-07', { quelle: 'partie' });
  T.zaehleTag(p, '2026-10-08', { quelle: 'partie' });
  T.pauseAnsagen(p, '2026-10-12', { ab: '2026-10-12', tage: 7 });
  pruefe('Eine ganz pausierte Woche ist neutral (der Ring bleibt)', T.ringStand(p, '2026-10-20', {}).n === 1);
}

gruppe = 'Kalender';
{
  const st = T.leer();
  marsch(st, '2026-10-05', 3);                                // Mo bis Mi
  T.zaehleTag(st, '2026-10-09', { quelle: 'partie' });        // Do frei: Ruhe? nein, Brücke ueber Do? (Do 8. frei) -> Fr 9.
  T.zaehleTag(st, '2026-10-13', { quelle: 'partie' });        // Sa, So, Mo frei -> neues Kapitel
  T.pauseAnsagen(st, '2026-10-14', { ab: '2026-10-15', tage: 2 });
  const k = T.kalender(st, '2026-10-14', { ruhetag: 6 }, 6);
  const art = (tag) => k.flatMap((w) => w.tage).find((d) => d.tag === tag).art;
  pruefe('Wochen nur ab dem ersten Schachtag, neueste zuerst, mit Kalenderwoche', k.length === 2 && k[0].montag === '2026-10-12' && k[0].kw === 42 && k[1].kw === 41);
  pruefe('Tage: gezählt, Brücke (Serie lief weiter), leer (Serie ruhte danach), Ruhetag, heute, Pause, Zukunft',
    art('2026-10-05') === 'gezaehlt' && art('2026-10-08') === 'bruecke' && art('2026-10-10') === 'leer' && art('2026-10-11') === 'ruhetag'
    && art('2026-10-12') === 'leer' && art('2026-10-14') === 'offen' && art('2026-10-15') === 'pause' && art('2026-10-17') === 'zukunft',
    k.map((w) => w.tage.map((d) => d.art).join(' ')));
  pruefe('Leere Tage sind nie „rot“: es gibt keine Art für Fehler', !k.flatMap((w) => w.tage).some((d) => /fehl|verlor|rot/.test(d.art)));
}

gruppe = 'Beweis-Karte';
{
  const p = (tag, genauigkeit, patzer = 0) => ({ datum: new Date(`${tag}T18:00:00`).toISOString(), genauigkeit, eigeneZuege: 25, modus: 'normal',
    liveKlassen: [...Array(patzer).fill('patzer'), ...Array(25 - patzer).fill('gut')] });
  const partien = [p('2026-09-03', 60, 4), p('2026-09-05', 62, 3), p('2026-09-08', 64, 4),
    p('2026-10-02', 70, 1), p('2026-10-05', 71, 1), p('2026-10-08', 75, 0)];
  const t = T.beweis({ partien, von: '2026-10-01', bis: '2026-10-30', tage: 30, z: { p: 3 } });
  pruefe('Nur Verbesserungen mit echten Zahlen aus genau diesem Zeitraum gegen die Zeit davor', t === '01.10. bis 30.10. · Genauigkeit (Median) 62 % → 71 % · „Weit daneben“ je 10 Züge 1,5 → 0,3', t);
  const schlechter = [p('2026-09-03', 80), p('2026-09-05', 81), p('2026-09-08', 82), p('2026-10-02', 70), p('2026-10-05', 71), p('2026-10-08', 72)];
  const t2 = T.beweis({ partien: schlechter, von: '2026-10-01', bis: '2026-10-30', tage: 30, z: { p: 41, k: 120, l: 18 } });
  pruefe('Nichts verbessert: neutrale Fakten („30 Tage Schach: 41 Partien, 120 Karten, 18 Lektionen“)',
    t2 === '01.10. bis 30.10. · 30 Tage Schach: 41 Partien, 120 Karten, 18 Lektionen. Auf diesem Boden wächst die Form.', t2);
  pruefe('Zu wenig Daten: nur der Zeitraum', T.beweis({ partien: [], von: '2026-10-01', bis: '2026-10-07', tage: 7, z: {} }) === '01.10. bis 07.10.');
}

// =====================================================================
// Siegeslauf
// =====================================================================
gruppe = 'Siegeslauf';
{
  const sieg = (extra = {}) => ({ modus: 'normal', wertet: true, ergebnis: 'sieg', hinweise: 0, zuruecknahmen: 0, botStufe: 5, ...extra });
  const k = { hoechsteStufe: 5 };
  pruefe('Vor der Eichung: ab dem höchsten freigeschalteten Bot minus eine Stufe', LA.gleichStark({ botStufe: 4, hoechsteStufe: 5 })
    && LA.gleichStark({ botStufe: 5, hoechsteStufe: 5 }) && !LA.gleichStark({ botStufe: 3, hoechsteStufe: 5 }) && LA.gleichStark({ botStufe: 1, hoechsteStufe: 1 }));
  pruefe('Mit Arena-Wertung (ab 10 Partien): Bot-Stärke mindestens Wertung minus 150', LA.gleichStark({ botElo: 1050, wertung: 1200, wertungPartien: 10 })
    && !LA.gleichStark({ botElo: 1049, wertung: 1200, wertungPartien: 10, botStufe: 5, hoechsteStufe: 5 })
    && LA.gleichStark({ botElo: 800, wertung: 1200, wertungPartien: 9, botStufe: 5, hoechsteStufe: 5 }), 'in den ersten 10 Partien gilt die Stufe');
  const lauf = { n: 0, best: 0, ms: [] };
  const r = [1, 2, 3].map(() => LA.buche(lauf, sieg(), k));
  pruefe('Drei Siege: 1, 2, 3; Meilenstein 3 (Flamme ab 3)', r.map((x) => x.n).join() === '1,2,3' && r[2].meilenstein === 3 && !r[1].meilenstein && LA.FLAMME_AB === 3);
  const pausen = [sieg({ hinweise: 1 }), sieg({ zuruecknahmen: 2 }), sieg({ botStufe: 3 }), sieg({ modus: 'uebung', wertet: false }),
    sieg({ modus: 'frei', wertet: false }), sieg({ modus: 'boss', wertet: false }), sieg({ modus: 'spiel', wertet: false }), sieg({ wertet: false }),
    sieg({ ergebnis: 'niederlage', hinweise: 1 }), sieg({ ergebnis: 'remis', botStufe: 2 }), sieg({ ergebnis: 'niederlage', modus: 'boss', wertet: false })];
  const w = pausen.map((d) => LA.buche(lauf, d, k));
  pruefe('Hilfe, schwächere Gegner, Übung, freie, Boss-, Spielhallen- und Gast-Partien pausieren: zählen nicht und brechen nicht',
    w.every((x) => x.wirkung === 'pause') && lauf.n === 3 && w.map((x) => x.grund).join() === 'hilfe,hilfe,schwaecher,modus,modus,modus,modus,wertet,hilfe,schwaecher,modus', w.map((x) => x.grund));
  LA.buche(lauf, sieg(), k);
  const f = LA.buche(lauf, sieg(), k);
  pruefe('Meilenstein 5', f.n === 5 && f.meilenstein === 5);
  const ende = LA.buche(lauf, sieg({ ergebnis: 'remis' }), k);
  pruefe('Remis beendet still („beendet bei 5“), der Rekord bleibt', ende.wirkung === 'ende' && ende.endeBei === 5 && lauf.n === 0 && lauf.best === 5 && ende.best === 5);
  pruefe('Niederlage ohne laufenden Lauf: nichts', LA.buche(lauf, sieg({ ergebnis: 'niederlage' }), k).wirkung === 'nichts');
  const r3 = [1, 2, 3].map(() => LA.buche(lauf, sieg(), k));
  pruefe('Neuer Lauf: Meilenstein 3 wieder (je Lauf einmal)', r3[2].meilenstein === 3);
  const lang = { n: 0, best: 0, ms: [] };
  const ms = [];
  for (let i = 0; i < 16; i++) { const x = LA.buche(lang, sieg(), k); if (x.meilenstein) ms.push(x.meilenstein); }
  pruefe('Meilensteine 3, 5, 10, 15 je einmal', ms.join() === '3,5,10,15', ms);
}

// =====================================================================
// Speicher
// =====================================================================
gruppe = 'Speicher';
{
  const sp = fakeSpeicher();
  setzeSpeicher(sp);
  pruefe('Modul serie hat ein Budget (4.000 Zeichen, schon im Fundament)', MODUL_BUDGET.serie === 4000);
  const leer = S.lade();
  pruefe('Leerer Speicher: frischer Stand mit Rechenstand 1', leer.stand === 1 && T.STAND === 1 && LA.STAND === 1 && S.STAND === 1 && leer.aktuell === 0 && leer.tage.length === 0);
  // Viel genutzt: 400 Tage mit Luecken, 2 Bretter, Pausen, Plaketten
  const st = T.leer();
  for (let i = 0; i < 520; i++) {
    if (i % 9 === 4 || i % 31 === 7) continue;
    const tag = plus('2025-01-01', i);
    T.zaehleEinheit(st, 'partie');
    T.zaehleTag(st, tag, { quelle: 'partie', tz: -60 });
    if (i % 50 === 0) T.pauseAnsagen(st, tag, { ab: plus(tag, 1), tage: 2 });
    st.ids.push('p' + i.toString(36).padStart(11, '0'));
    st.abr.push({ id: 'p' + i, t: st.aktuell, fv: 1, f: 2, u: 0, m: null, d: false, l: null, e: null, b: 0 });
    while (st.figuren.includes('?')) T.waehleFigur(st, 'DTLS'[i % 4]);
  }
  const zahlenVor = { aktuell: st.aktuell, best: st.best, gesamt: st.gesamt, felder: st.felder, bretter: st.bretter, figuren: st.figuren };
  const r = S.speichere(st);
  const geladen = S.lade();
  pruefe('Viel genutzter Stand (über 400 Schachtage, Bretter, Pausen) passt ins Budget', r.ok && r.zeichen <= MODUL_BUDGET.serie, r);
  pruefe('Kürzen nimmt nur Listen, nie die Zahlen', geladen.aktuell === zahlenVor.aktuell && geladen.best === zahlenVor.best && geladen.gesamt === zahlenVor.gesamt
    && geladen.felder === zahlenVor.felder && geladen.bretter === zahlenVor.bretter && geladen.figuren === zahlenVor.figuren && geladen.tage.length <= T.TAGE_MAX,
    { zahlenVor, g: { aktuell: geladen.aktuell, gesamt: geladen.gesamt, felder: geladen.felder } });
  // kaputte Daten
  sp.setItem('schach-arena:v1:modul:serie', JSON.stringify({ stand: 1, tage: ['2026-10-01', 'quatsch', 7, '2026-02-30', '2026-10-02'], aktuell: -3, best: 'x',
    figuren: 'DXQ?!', felder: 'viel', kapitel: { nr: 'eins' }, lauf: { n: 2.5, best: -1 }, pausen: 5, ring: null }));
  const k = S.lade();
  pruefe('Kaputte Daten: falsche Felder fallen still weg, nichts wirft', k.tage.join() === '2026-10-01,2026-10-02' && k.aktuell === 1 && k.best === 1
    && k.figuren === 'D?' && k.felder === 2 && k.kapitel.nr === 1 && k.lauf.n === 0 && k.pausen.length === 0 && k.letzter === '2026-10-02', k);
  sp.setItem('schach-arena:v1:modul:serie', '{kaputt');
  pruefe('Kein JSON: frischer Stand', S.lade().aktuell === 0);
  // alter, schmaler Stand (nur Kernzahlen): bleibt gueltig, fehlende Umwandlungen werden zur offenen Wahl
  sp.setItem('schach-arena:v1:modul:serie', JSON.stringify({ stand: 1, tage: ['2026-10-01'], aktuell: 14, best: 20, gesamt: 12, felder: 13 }));
  const alt = S.lade();
  pruefe('Alter Stand ohne neue Felder: gültig, Figuren für 2 Umwandlungen als offene Wahl', alt.aktuell === 14 && alt.best === 20 && alt.gesamt === 12
    && alt.figuren === '??' && alt.lauf.n === 0 && alt.ring.ab === '2026-09-28', alt);
  // Stand einer neueren App: lesen ja, schreiben nie
  sp.setItem('schach-arena:v1:modul:serie', JSON.stringify({ stand: 2, tage: ['2026-10-01'], aktuell: 3, best: 3, gesamt: 3, felder: 3, zukunft: { x: 1 } }));
  const zukunft = S.lade();
  const sz = S.speichere(zukunft);
  pruefe('Stand einer neueren App (Rechenstand 2): gelesen, nie überschrieben', S.nurLesen(zukunft) && !sz.ok && sz.grund === 'neuer'
    && JSON.parse(sp.getItem('schach-arena:v1:modul:serie')).zukunft.x === 1);
  // Einstellungen
  pruefe('Einstellungen: Standard anzeigen, kein Ruhetag, nicht streng, nicht leise', JSON.stringify(S.einstellungen()) === '{"anzeigen":true,"ruhetag":null,"strenge":false,"leise":false}');
  S.speichereEinstellungen({ ruhetag: 6, stufe: 'wichtig' });
  S.speichereEinstellungen({ ruhetag: 9 });
  pruefe('Ruhetag 0..6, Unbekanntes bleibt erhalten (fremde Schlüssel werden nicht gelöscht)', S.einstellungen().ruhetag === null
    && ladeModulEinstellungen('serie', {}).stufe === 'wichtig');
}

// =====================================================================
// Optik und Texte
// =====================================================================
gruppe = 'Optik (Look A)';
{
  const lies = (d) => readFileSync(path.join(WURZEL, d), 'utf8');
  const css = lies('css/pakete/serie.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const tokens = lies('css/tokens.css') + '\n' + lies('css/themes/modern.css');
  const feste = css.match(/#[0-9a-f]{3,8}\b|\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color-mix)\(/gi) || [];
  pruefe('css/pakete/serie.css: keine festen Farben (nur Tokens)', feste.length === 0, feste);
  const eigene = new Set(['--zelle', '--feld']);
  const namen = [...new Set((css.match(/var\(--[a-z0-9-]+/gi) || []).map((v) => v.slice(4)))].filter((n) => !eigene.has(n));
  const fehlen = namen.filter((n) => !new RegExp(`${n}\\s*:`).test(tokens));
  pruefe(`css/pakete/serie.css: alle ${namen.length} Variablen stehen in tokens.css oder themes/modern.css (dazu nur die eigenen --zelle und --feld)`, namen.length > 15 && fehlen.length === 0, fehlen);
  pruefe('css/pakete/serie.css: kein Neon, kein Glow (keine --neon-Variablen, kein text-shadow, kein filter/blur)', !/var\(--neon-|text-shadow|filter\s*:|blur\(|drop-shadow/i.test(css));
  const uebergaenge = [...css.matchAll(/transition(?:-property)?\s*:\s*([^;}]+)/gi)].map((m) => m[1].trim()).filter((t) => t !== 'none');
  pruefe('css/pakete/serie.css: keine Übergänge außer transform/opacity, keine @keyframes', uebergaenge.every((t) => t.split(',').every((teil) => /^(transform|opacity)\b/.test(teil.trim())))
    && !/@keyframes/.test(css), uebergaenge);
  const js = lies('js/pakete/serie/ansicht.js');
  const bilder = [...js.matchAll(/anim\(\s*[a-zA-Z.()'"\s-]+\s*,\s*\[([^\]]*)\]/g)].map((m) => m[1]);
  const schluessel = new Set(bilder.flatMap((b) => [...b.matchAll(/([a-zA-Z]+)\s*:/g)].map((m) => m[1])));
  pruefe(`ansicht.js: ${bilder.length} Animationen über anim(), Keyframes nur transform, opacity, offset`, bilder.length >= 4
    && [...schluessel].every((k) => ['transform', 'opacity', 'offset'].includes(k)) && !/\.animate\(/.test(js), [...schluessel]);
  // geschrieben wird nur transform (Balken) und die eigene Variable --feld (Feld des Bauern); Lesen ist frei
  const stile = [...js.matchAll(/style(?:\.([a-zA-Z]+)\s*=(?!=)|\.setProperty\('([^']+)'|="([a-z-]+):)/g)].map((m) => m[1] || m[2] || m[3]);
  pruefe('ansicht.js: Inline-Stile nur transform und die eigene Variable --feld (kein Layout aus dem Code)', stile.length >= 2
    && stile.every((s) => ['transform', '--feld'].includes(s)), stile);
  const kommentare = ['tag.js', 'lauf.js', 'stand.js', 'ansicht.js', 'index.js'].flatMap((d) => lies('js/pakete/serie/' + d).split('\n')
    .filter((z) => /^\s*\/\/.*[^\x00-\x7F]/.test(z)).map((z) => d + ': ' + z.trim().slice(0, 60)));
  pruefe('Kommentare in den Paket-Dateien nur ASCII (Umlaute als ae/oe/ue/ss)', kommentare.length === 0, kommentare);
}

gruppe = 'Texte';
{
  const lies = (d) => readFileSync(path.join(WURZEL, d), 'utf8');
  const alle = ['tag.js', 'lauf.js', 'stand.js', 'ansicht.js', 'index.js'].map((d) => lies('js/pakete/serie/' + d)).join('\n');
  const VERBOTEN = ['am Stück', 'Serie in Gefahr', 'rette deine', 'wartet auf dich', 'nur noch', 'verfällt', 'läuft ab', 'endet in', 'letzte Chance',
    'Serie verloren', 'Streak-Schutz', 'kaufen', 'Funken'];
  const treffer = VERBOTEN.filter((w) => {
    // "Funken" nur als Hinweis, dass die Serie keine bringt
    if (w === 'Funken') return /\+\s*\d+\s*Funken|Funken für die Serie/.test(alle);
    return alle.toLowerCase().includes(w.toLowerCase());
  });
  pruefe('Keine Druck- oder Verlust-Texte, kein „am Stück“, nichts kaufbar, keine Funken für die Serie', treffer.length === 0, treffer);
  const A = await import('../js/pakete/serie/ansicht.js');
  pruefe('Schachtage statt Kalendertage („12 Schachtage in Serie“, „1 Schachtag in Serie“), Felder und Siege mit Einzahl',
    A.schachtage(12) === '12 Schachtage in Serie' && A.schachtage(1) === '1 Schachtag in Serie' && A.bisText(1) === 'noch 1 Feld bis zur Umwandlung'
    && A.bisText(5) === 'noch 5 Felder bis zur Umwandlung' && A.laufText(3) === '3 Siege in Folge' && A.endeText(4, 7) === 'Siegeslauf beendet bei 4. Dein Rekord: 7.');
}

// =====================================================================
// Verdrahtung ueber den Ereignis-Bus (index.js in Node)
// =====================================================================
gruppe = 'Ereignisse';
{
  const sp = fakeSpeicher();
  setzeSpeicher(sp);
  const index = await import('../js/pakete/serie/index.js');
  const log = [];
  for (const n of ['tag:gezaehlt', 'serie:geaendert']) hoere(n, (d) => log.push({ n, d: JSON.parse(JSON.stringify(d)) }));
  const partie = (id, extra = {}) => ({ laufId: 'l' + id, partieId: id, botId: 'benno', botStufe: 1, farbe: 'w', modus: 'normal', wertet: true,
    ergebnis: 'sieg', eigeneZuege: 12, hinweise: 0, zuruecknahmen: 0, neueSterne: [true, false, false], neuFreigeschaltet: null, ...extra });
  sende('partie:beendet', partie('g1', { datum: ort(2026, 10, 23, 3, 59).toISOString() }));
  const g = log.filter((x) => x.n === 'tag:gezaehlt');
  pruefe('Partie um 3:59 (Datum der Partie): tag:gezaehlt { tag: Vortag, quelle, serie, kapitel }', g.length === 1
    && JSON.stringify(g[0].d) === '{"tag":"2026-10-22","quelle":"partie","serie":1,"kapitel":1}', g);
  const ae = log.filter((x) => x.n === 'serie:geaendert');
  pruefe('serie:geaendert { tag, lauf, meilenstein, ruht, kapitel, rekord, gesamt, heute }', ae.length === 1 && ae[0].d.tag >= 0 && ae[0].d.lauf === 1
    && ae[0].d.meilenstein === null && ['ruht', 'kapitel', 'rekord', 'gesamt', 'heute'].every((k) => k in ae[0].d), ae);
  log.length = 0;
  sende('partie:beendet', partie('g1', { datum: ort(2026, 10, 23, 3, 59).toISOString() }));
  pruefe('Dieselbe Partie zweimal: nichts doppelt', log.length === 0 && S.lade().lauf.n === 1);
  sende('partie:beendet', partie('g2', { datum: ort(2026, 10, 22, 20, 0).toISOString() }));
  pruefe('Zweite Partie am selben Schachtag: kein tag:gezaehlt, aber der Siegeslauf zählt', !log.some((x) => x.n === 'tag:gezaehlt') && S.lade().lauf.n === 2
    && log.some((x) => x.n === 'serie:geaendert' && x.d.lauf === 2));
  log.length = 0;
  sende('partie:beendet', partie('g3', { datum: ort(2026, 10, 23, 18, 0).toISOString(), eigeneZuege: 9, ergebnis: 'niederlage' }));
  const st3 = S.lade();
  pruefe('Partie mit 9 eigenen Zügen ist kein Tageswerk; die Niederlage beendet den Lauf still', !log.some((x) => x.n === 'tag:gezaehlt') && st3.letzter === '2026-10-22'
    && st3.lauf.n === 0 && st3.abr.find((a) => a.id === 'g3').e === 2, st3.abr);
  // Abrechnungs-Eintraege
  const a1 = st3.abr.find((a) => a.id === 'g1');
  pruefe('Abrechnungs-Eintrag nur am ersten Werk des Tages mit Tag-Zahl', a1 && a1.t === 1 && a1.fv === 0 && a1.f === 1 && st3.abr.find((a) => a.id === 'g2').t === null, st3.abr);
  // Uebung: partie:gestartet (Ziel), uebung:ergebnis und partie:beendet derselben Uebung zaehlen einmal
  index.setzeUhr(ort(2026, 10, 24, 15).getTime());
  log.length = 0;
  sende('partie:gestartet', { laufId: 'lu1', botId: 'benno', farbe: 'w', modus: 'uebung', wertet: false, ziel: { partieId: 'g1', ply: 12 }, buehne: null });
  sende('uebung:ergebnis', { partieId: 'g1', ply: 12, getroffen: true });
  sende('partie:beendet', partie('u1', { laufId: 'lu1', modus: 'uebung', wertet: false, eigeneZuege: 15 }));
  pruefe('Eine Übung (Ergebnis und Partie-Ende) zählt einmal: noch kein Tageswerk', !log.some((x) => x.n === 'tag:gezaehlt') && S.lade().heute.u.length === 1, S.lade().heute);
  sende('uebung:ergebnis', { partieId: 'g2', ply: 20, getroffen: false });
  const u = log.filter((x) => x.n === 'tag:gezaehlt');
  pruefe('Zweite Übung: Tageswerk „uebung“ (auch nicht getroffen: Schacharbeit zählt)', u.length === 1 && u[0].d.quelle === 'uebung' && u[0].d.tag === '2026-10-24' && u[0].d.serie === 2, u);
  pruefe('Übung ändert den Siegeslauf nicht', S.lade().lauf.n === 0);
  // Feier ausserhalb einer Partie: Zeile "Tag 2 der Serie" in der Nachlese (partieId null)
  const nl = nachlese();
  pruefe('Tageswerk ohne Partie: Feier-Zeile „Tag 2 der Serie“ (Nachlese), Quelle marsch', nl.some((f) => f.quelle === 'marsch' && f.titel === 'Tag 2 der Serie' && f.art === 'zeile'), nl);
  // Karten: nur mit eigenem Versuch; Raetsel: verschiedene IDs; Lektion
  index.setzeUhr(ort(2026, 10, 25, 15).getTime());
  log.length = 0;
  sende('training:geloest', { karteId: 'k1', richtig: false, versuch: 0, quelle: 'kartei' });
  sende('training:geloest', { karteId: 'k2', richtig: true, versuch: 1, quelle: 'kartei' });
  sende('training:geloest', { karteId: 'k3', richtig: false, versuch: 2, quelle: 'kartei' });
  pruefe('Karteikarte nur angesehen (ohne Zug) zählt nicht', !log.some((x) => x.n === 'tag:gezaehlt') && S.lade().heute.k === 2);
  sende('training:geloest', { karteId: 'k4', richtig: true, versuch: 1, quelle: 'kartei' });
  pruefe('3 Karten mit eigenem Versuch: Tageswerk „kartei“', log.filter((x) => x.n === 'tag:gezaehlt').map((x) => x.d.quelle).join() === 'kartei');
  index.setzeUhr(ort(2026, 10, 26, 15).getTime());
  log.length = 0;
  for (const id of ['t1', 't1', 't2']) sende('raetsel:geloest', { id, richtig: true, versuch: 1, quelle: 'tag', wertung: null });
  pruefe('Rätsel: zweimal dasselbe zählt einmal', !log.some((x) => x.n === 'tag:gezaehlt'));
  sende('raetsel:geloest', { id: 't3', richtig: false, versuch: 1, quelle: 'pool', wertung: 900 });
  pruefe('Drittes Rätsel: Tageswerk „raetsel“', log.filter((x) => x.n === 'tag:gezaehlt').map((x) => x.d.quelle).join() === 'raetsel');
  index.setzeUhr(ort(2026, 10, 27, 15).getTime());
  log.length = 0;
  sende('lektion:beendet', { id: 'rudi-1', ringe: { gelernt: true, sicher: false, gemeistert: false } });
  const lek = log.filter((x) => x.n === 'tag:gezaehlt');
  pruefe('Lektion: Tageswerk „lektion“, Serie Tag 5 (22.10., Brücke am 23.10., dann 24. bis 27.10.)', lek.length === 1 && lek[0].d.quelle === 'lektion'
    && lek[0].d.serie === 5, lek);
  // Meilenstein und Umwandlung in einer Partie: grosser Moment (nur einer gross, der andere in die Nachlese)
  const st = S.lade();
  st.felder = 5;
  S.speichere(st);
  index.setzeUhr(ort(2026, 10, 28, 15).getTime());
  log.length = 0;
  sende('partie:beendet', partie('g9', { eigeneZuege: 20 }));
  const fo = fuerOverlay('g9');
  pruefe('Partie am 6. Schachtag mit Umwandlung: kein Meilenstein, Umwandlung groß (Klang umwandlung), keine marsch-Zeile in der Partie',
    fo.length === 1 && fo[0].quelle === 'umwandlung' && fo[0].art === 'gross' && fo[0].klang === 'umwandlung' && /^Umwandlung! Deine 1\. Figur/.test(fo[0].titel), fo);
  const st7 = S.lade();
  st7.felder = 11;
  st7.lauf = { n: 2, best: 2, ms: [] };
  S.speichere(st7);
  index.setzeUhr(ort(2026, 10, 29, 15).getTime());
  sende('partie:beendet', partie('g10', { eigeneZuege: 20, botStufe: 1 }));
  const fo2 = fuerOverlay('g10');
  pruefe('Tag 7: Meilenstein (groß, Plakette mit Zeitraum) vor der Umwandlung; Siegeslauf 3 als Zeile; höchstens ein großer Moment',
    fo2.filter((f) => f.art === 'gross').length === 1 && fo2[0].quelle === 'meilenstein' && fo2[0].titel === '7 Schachtage in Serie' && /^22\.10\. bis 29\.10\./.test(fo2[0].text)
    && fo2.some((f) => f.quelle === 'siegeslauf' && f.titel === 'Siegeslauf 3 · Flamme') && fo2[0].klang === 'siegel', fo2);
  pruefe('Bot-Brief zum 7. Tag gemerkt', S.lade().brief.n === 7);
  const umwNachlese = nachlese();
  pruefe('Die Umwandlung dieses Tages kommt still in die Nachlese', umwNachlese.some((f) => f.quelle === 'umwandlung'), umwNachlese);
  // ausgeblendet: zaehlt weiter, feiert nicht
  S.speichereEinstellungen({ anzeigen: false });
  const st8 = S.lade();
  st8.felder = 17;
  S.speichere(st8);
  index.setzeUhr(ort(2026, 10, 30, 15).getTime());
  sende('partie:beendet', partie('g11', { eigeneZuege: 20 }));
  pruefe('Serie ausgeblendet: gezählt wird weiter, gefeiert nicht', S.lade().aktuell === 8 && fuerOverlay('g11').length === 0 && S.lade().figuren.length === 3);
  S.speichereEinstellungen({ anzeigen: true });
  // Siegeslauf: der Bot, der gerade freigeschaltet wurde, hebt die Grenze erst fuer die naechste Partie
  setzeSpeicher(fakeSpeicher());
  for (let i = 0; i < 4; i++) {
    const b = ['benno', 'hilde', 'kalle', 'lisa'][i];
    speicherePartie({ datum: new Date(Date.UTC(2026, 9, 1, 10, i)).toISOString(), botId: b, botStufe: i + 1, spielerFarbe: 'w', zuege: Array(30).fill('e2e4'),
      san: ['e4'], ergebnis: 'sieg', grund: 'matt', hinweise: 0, zuruecknahmen: 0, liveKlassen: [] });
  }
  index.setzeUhr(ort(2026, 11, 2, 15).getTime());
  sende('partie:beendet', partie('h1', { botId: 'lisa', botStufe: 4, neuFreigeschaltet: 'rudi' }));
  sende('partie:beendet', partie('h2', { botId: 'kalle', botStufe: 3 }));
  const lst = S.lade();
  pruefe('Freischaltung durch diese Partie zählt erst danach (Lisa zählt, Kalle danach nicht mehr: Rudi ist frei)', lst.lauf.n === 1
    && lst.abr.find((a) => a.id === 'h2').l === null, lst.lauf);
  // Reset: nur Arbeitsspeicher, nie schreiben
  const sp2 = fakeSpeicher();
  setzeSpeicher(sp2);
  sende('speicher:zurueckgesetzt', { mitEinstellungen: false });
  pruefe('speicher:zurueckgesetzt schreibt nichts (das Modul bleibt leer)', ladeModul('serie', null) === null);
  index.setzeUhr(null);
}

// =====================================================================
// Browser
// =====================================================================
function ladePlaywright() {
  const kandidaten = [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean);
  for (const k of kandidaten) {
    try { return require(k); } catch (e) { /* naechster */ }
  }
  throw new Error('Playwright nicht gefunden (PLAYWRIGHT_PFAD setzen)');
}

async function warteAufServer(url, ms = 10000) {
  const ende = Date.now() + ms;
  while (Date.now() < ende) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch (e) { /* noch nicht da */ }
    await warte(150);
  }
  throw new Error('Server startet nicht: ' + url);
}

const BASIS = `http://127.0.0.1:${PORT}/index.html?test`;
const MIT = (extra = '') => `${BASIS}&erw=pakete/serie/index${extra}`;
// 10 eigene Zuege bis zum Matt (Bot nach Plan): 1.e4 Sa6 2.Lc4 Sb8 3.Dh5 ... 10.Dxf7#
const LANG_ZUEGE = ['e2e4', 'f1c4', 'd1h5', 'g1f3', 'b1c3', 'd2d3', 'a2a3', 'b2b3', 'h2h3', 'h5f7'];
const LANG_PLAN = { e2e4: 'b8a6', f1c4: 'a6b8', d1h5: 'b8a6', g1f3: 'a6b8', b1c3: 'b8a6', d2d3: 'a6b8', a2a3: 'b8a6', b2b3: 'a6b8', h2h3: 'b8a6' };
// Narrenmatt gegen Flo (2 eigene Zuege, Niederlage)
const NARR_ZUEGE = ['f2f3', 'g2g4'];
const NARR_PLAN = { f2f3: 'e7e5', g2g4: 'd8h4' };
const MODUL = 'schach-arena:v1:modul:serie';

async function neueSeite(browser, { w = 1180, h = 820, handy = false, farbe = 'light', reduziert = false, lokal = null } = {}) {
  const kontext = await browser.newContext({
    viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: true, isMobile: handy, colorScheme: farbe,
    reducedMotion: reduziert ? 'reduce' : 'no-preference',
  });
  if (lokal) {
    await kontext.addInitScript((daten) => {
      if (sessionStorage.getItem('se-gesaet')) return;
      sessionStorage.setItem('se-gesaet', '1');
      for (const [k, v] of Object.entries(daten)) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
    }, lokal);
  }
  const seite = await kontext.newPage();
  const fehler = [];
  seite.on('console', (m) => {
    if (m.type() !== 'error') return;
    const url = (m.location() && m.location().url) || '';
    if (/favicon/.test(url)) return;
    fehler.push(m.text() + (url ? ' @ ' + url : ''));
  });
  seite.on('pageerror', (e) => fehler.push('Seitenfehler: ' + e.message));
  return { kontext, seite, fehler };
}

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
    async zugTippen(uci) {
      await h.tippeFeld(uci.slice(0, 2));
      await h.tippeFeld(uci.slice(2, 4));
    },
    async tippe(sel) {
      const loc = seite.locator(sel).first();
      await loc.waitFor({ state: 'visible', timeout: 10000 });
      const b = await loc.boundingBox();
      await seite.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
      await warte(150);
    },
    async warteFlo(ms = 30000) {
      await seite.waitForFunction(() => window.__partie && window.__partie.phase() === 'flo', null, { timeout: ms });
    },
    async starte(params) {
      await seite.evaluate((p) => window.__app.gehe('partie', p), params);
      await seite.waitForFunction(() => window.__partie && window.__partie.bereit === true, null, { timeout: 30000 });
    },
    async plan(p) {
      await seite.evaluate((plan) => {
        localStorage.removeItem('schach-arena:v1:laufend');
        window.__test = { botZug: () => {
          const v = window.__partie.chess().history({ verbose: true });
          return plan[v[v.length - 1].lan] || null;
        } };
      }, p);
    },
    // Partie nach Plan bis zum Ergebnis (wertend gegen Benno)
    async spiele(zuege, plan, { botId = 'benno', warteAuf = '.ergebnis-overlay.gefuellt:not(.vorlaeufig)' } = {}) {
      await h.plan(plan);
      await h.starte({ botId, farbe: 'w' });
      for (const zug of zuege) {
        await h.warteFlo();
        await h.zugTippen(zug);
      }
      await seite.waitForSelector('.ergebnis-overlay', { timeout: 40000 });
      await seite.waitForSelector(warteAuf, { timeout: 60000 });
      await seite.evaluate(() => { window.__test = {}; });
    },
    stand: () => seite.evaluate(() => window.__serie.stand()),
    // Stand setzen: tage = Versaetze relativ zu heute (z. B. [-3, -2, -1]), dazu weitere Felder
    async setze({ tage = [], ...teil } = {}) {
      await seite.evaluate(async ({ tage: versatz, teil: t }) => {
        const tg = await import('./js/tag.js');
        const S = window.__serie;
        const st = S.T.leer();
        const heute = S.heute();
        for (const v of versatz) S.T.zaehleTag(st, tg.addiereTage(heute, v), { quelle: 'partie' });
        Object.assign(st, t);
        S.speichere(st);
      }, { tage, teil });
    },
    async klangSpion() {
      await seite.evaluate(async () => {
        const s = await import('./js/sounds.js');
        window.__klaenge = [];
        if (s.klang.__spion) return;
        const orig = s.klang.spiele;
        s.klang.spiele = (n, ...a) => { window.__klaenge.push(n); return orig.call(s.klang, n, ...a); };
        s.klang.__spion = true;
      });
    },
    klaenge: () => seite.evaluate(() => (window.__klaenge || []).slice()),
    async arena() {
      await seite.evaluate(() => window.__app.gehe('arena'));
      await seite.waitForSelector('.screen.arena');
      await warte(500);
    },
    async abrFertig(ms = 8000) {
      await seite.waitForSelector('.ergebnis-overlay .se-abr[data-fertig="1"]', { timeout: ms }).catch(() => {});
    },
    // Feld des Bauern im Streifen einer Zeile (aus --feld) und hervorgehobenes Feld
    streifen: (sel) => seite.evaluate((s) => {
      const st = document.querySelector(s + ' .se-streifen');
      if (!st) return null;
      const felder = [...st.querySelectorAll('.se-feld')];
      return { feld: Number(getComputedStyle(st).getPropertyValue('--feld').trim() || st.style.getPropertyValue('--feld')),
        heute: felder.findIndex((f) => f.classList.contains('heute')), naechstes: felder.findIndex((f) => f.classList.contains('naechstes')) };
    }, sel),
  };
  return h;
}

async function bild(seite, name) {
  await seite.screenshot({ path: path.join(BILDER, name + '.png') });
}

// Tippflaeche eines Elements (elementFromPoint senkrecht und waagrecht durch die Mitte)
const tippflaeche = (sel) => {
  const e = document.querySelector(sel);
  if (!e) return null;
  const b = e.getBoundingClientRect();
  const trifft = (x, y) => { const t = document.elementFromPoint(x, y); return !!t && (t === e || e.contains(t)); };
  let hoch = 0;
  for (let y = Math.floor(b.top) - 12; y <= Math.ceil(b.bottom) + 12; y++) if (trifft(b.left + b.width / 2, y + 0.5)) hoch++;
  let breit = 0;
  for (let x = Math.floor(b.left) - 12; x <= Math.ceil(b.right) + 12; x++) if (trifft(x + 0.5, b.top + b.height / 2)) breit++;
  return { w: breit, h: hoch };
};

async function testeBrowser(browser) {
  // ---------- 1. Arena frisch: noch kein Schachtag ----------
  gruppe = 'Arena frisch';
  const { kontext, seite, fehler } = await neueSeite(browser);
  const h = hilfen(seite);
  await seite.goto(MIT() + '#arena');
  await seite.waitForSelector('.screen.arena .heute-karte:not([hidden]) .se-heute');
  await warte(400);
  pruefe('arena:kopf: noch kein Chip (erst ab dem ersten gezählten Tag)', await seite.locator('.se-chip').count() === 0);
  const neuText = await seite.locator('.se-heute').innerText();
  pruefe('arena:heute: Bauernmarsch mit Bauer am Start, „Heute noch offen · Tageswerk in 5 Minuten“, erklärt das Bild',
    /Bauernmarsch/.test(neuText) && /Heute noch offen · Tageswerk in 5 Minuten/.test(neuText) && /Jeder Schachtag schiebt deinen Bauern ein Feld vor/.test(neuText)
    && await seite.locator('.se-heute[data-art="neu"] .se-streifen .se-feld').count() === 7, neuText);
  const s0 = await h.streifen('.se-heute');
  pruefe('Streifen: Bauer auf dem Startfeld, das nächste Feld (heute) gestrichelt', s0.feld === 0 && s0.naechstes === 1 && s0.heute === -1, s0);
  pruefe('Heute-Karte ganz oben (Reihenfolge 10, vor anderen Zeilen)', await seite.evaluate(() => document.querySelector('.ort-heute').firstElementChild.matches('.se-heute')));
  pruefe('Ohne Trainings-Karten kein Knopf „Zum Training“ (ehrlich: nichts anzubieten)', await seite.locator('.se-h-training').count() === 0);
  await bild(seite, 'arena-neu');

  // ---------- 2. Erste Partie mit 10 eigenen Zuegen: Tag 1 ----------
  gruppe = 'Abrechnung';
  await h.klangSpion();
  await h.spiele(LANG_ZUEGE, LANG_PLAN);
  await h.abrFertig();
  const st1 = await h.stand();
  pruefe('Partie ab 10 eigenen Zügen: Tag 1 gezählt (Speicher)', st1.aktuell === 1 && st1.gesamt === 1 && st1.felder === 1 && st1.letzter === await seite.evaluate(() => window.__serie.heute()), st1);
  const abr = await seite.locator('.erg-karte-ort .abrechnung > .se-abr[data-zeile="serie"]');
  pruefe('ergebnis:abrechnung: eine Zeile data-zeile="serie" „Serie · Tag 1 · Bauernmarsch“', await abr.count() === 1
    && /Tag 1 · Bauernmarsch/.test(await abr.innerText()) && /noch 5 Felder bis zur Umwandlung/.test(await abr.innerText()), await abr.innerText().catch(() => ''));
  const s1 = await h.streifen('.ergebnis-overlay .se-abr');
  pruefe('Der Bauer ist sichtbar ein Feld gezogen (Endbild: Feld 1, hervorgehoben)', s1.feld === 1 && s1.heute === 1, s1);
  const k1 = await h.klaenge();
  pruefe('Klang „bauer“ genau einmal zum Schritt', k1.filter((n) => n === 'bauer').length === 1, k1);
  pruefe('Keine eigene Feier-Zeile in der Partie (die Abrechnung ist der Zähl-Moment)', await seite.locator('.erg-feier [data-quelle="marsch"]').count() === 0);
  const ereignisse = await seite.evaluate(async () => (await import('./js/ereignisse.js')).protokoll().filter((e) => /tag:gezaehlt|serie:geaendert/.test(e.name)).map((e) => e.name));
  pruefe('Ereignisse: tag:gezaehlt einmal, serie:geaendert', ereignisse.filter((n) => n === 'tag:gezaehlt').length === 1 && ereignisse.includes('serie:geaendert'), ereignisse);
  await bild(seite, 'ergebnis-tag1');
  await seite.locator('.ergebnis-overlay .erg-zu').click();

  // ---------- 3. Arena danach: Chip und "Tageswerk geschafft" ----------
  gruppe = 'Arena nach dem Tageswerk';
  await h.arena();
  const chip = seite.locator('.haupt-kopf .se-chip');
  pruefe('arena:kopf: Chip mit Bauer und „1“ nach den Chips des Kerns', await chip.count() === 1 && (await chip.innerText()).trim() === '1'
    && await seite.evaluate(() => { const c = [...document.querySelector('.kopf-chips').children]; return c.indexOf(document.querySelector('.se-chip')) >= 2; }));
  const tipp = await seite.evaluate(tippflaeche, '.haupt-kopf .se-chip');
  pruefe('Chip antippbar (role=button, Tastatur) mit Tippfläche mindestens 44 x 44', tipp.w >= 44 && tipp.h >= 44
    && await chip.getAttribute('role') === 'button' && await chip.getAttribute('tabindex') === '0' && /Bauernmarsch: 1 Schachtag in Serie/.test(await chip.getAttribute('aria-label')), tipp);
  const geschafft = await seite.locator('.se-heute').innerText();
  pruefe('Heute-Karte: „Tageswerk geschafft. Alles Weitere ist Kür.“, Tag 1', /Tageswerk geschafft\. Alles Weitere ist Kür\./.test(geschafft) && /Tag 1/.test(geschafft), geschafft);
  const s2 = await h.streifen('.se-heute');
  pruefe('Heute hervorgehoben: das Feld des Bauern', s2.feld === 1 && s2.heute === 1 && s2.naechstes === -1, s2);

  // ---------- 4. Serien-Blatt ----------
  gruppe = 'Serien-Blatt';
  await h.tippe('.haupt-kopf .se-chip');
  await seite.waitForSelector('.se-blatt-ort .se-blatt');
  await warte(500);
  const blatt = await seite.locator('.se-blatt').innerText();
  pruefe('Antippen des Chips öffnet das Serien-Blatt (Serie, Rekord, Kapitel, Felder bis zur Umwandlung, Kalender, Ring, Spieltage, Siegeslauf, Ruhetag, Pause, Regeln)',
    /1 Schachtag in Serie · Rekord 1 · Kapitel 1/.test(blatt) && /noch 5 Felder bis zur Umwandlung/.test(blatt) && /KW \d+/.test(blatt)
    && /Wochen-Ring/.test(blatt) && /Spieltage gesamt/.test(blatt) && /Siegeslauf/.test(blatt) && /Ruhetag/i.test(blatt) && /Pause ansagen/i.test(blatt)
    && /So zählt der Bauernmarsch/.test(blatt) && !/am Stück/i.test(blatt), blatt.slice(0, 400));
  pruefe('Kalender: heute gezählt (mit Bauer), keine roten Tage', await seite.locator('.se-kalender .se-k-tag.gezaehlt.heute').count() === 1
    && await seite.locator('.se-kalender .se-k-tag.gezaehlt .ico').count() === 1);
  await bild(seite, 'blatt');
  // modal: Tab bleibt im Blatt
  const imBlatt = [];
  for (let i = 0; i < 8; i++) {
    await seite.keyboard.press('Tab');
    imBlatt.push(await seite.evaluate(() => !!document.activeElement && !!document.activeElement.closest('.se-blatt')));
  }
  await seite.keyboard.press('Shift+Tab');
  imBlatt.push(await seite.evaluate(() => !!document.activeElement && !!document.activeElement.closest('.se-blatt')));
  pruefe('Serien-Blatt ist modal: Tab und Umschalt+Tab bleiben im Blatt', imBlatt.every(Boolean), imBlatt);
  // Ruhetag waehlen
  await seite.locator('.se-blatt .se-rt[data-wert="6"]').click();
  await warte(200);
  pruefe('Ruhetag Sonntag gewählt (gespeichert in den Einstellungen des Pakets, das Blatt zeigt ihn)', await seite.evaluate(() => window.__serie.einstellungen().ruhetag) === 6
    && await seite.locator('.se-blatt .se-rt[data-wert="6"][aria-checked="true"]').count() === 1);
  await seite.locator('.se-blatt .se-rt[data-wert=""]').click();
  // Pause ansagen
  await seite.locator('.se-blatt .se-p-tage[data-tage="3"]').click();
  await warte(200);
  const pst = await h.stand();
  pruefe('Pause für 3 Tage angesagt, ab morgen (heute ist schon gezählt); Kalender zeigt den Liegestuhl, Text nennt den Zeitraum', pst.pausen.length === 3
    && pst.pausen[0] === await seite.evaluate(async () => (await import('./js/tag.js')).addiereTage(window.__serie.heute(), 1))
    && /Pause angesagt: .* \(3 Tage\)/.test(await seite.locator('.se-blatt .se-p-info').innerText())
    && await seite.locator('.se-blatt .se-k-tag.pause').count() >= 2, pst.pausen);
  await seite.locator('.se-blatt .se-p-ende').click();
  await warte(200);
  pruefe('Pause beenden: weg, die Tage zählen wieder fürs Jahr', (await h.stand()).pausen.length === 0 && /noch 30 von 30 Pausentagen/.test(await seite.locator('.se-blatt .se-p-info').innerText()));
  await seite.keyboard.press('Escape');
  await seite.waitForFunction(() => !document.querySelector('.se-blatt-ort'), null, { timeout: 2000 }).catch(() => {});
  pruefe('Escape schließt das Blatt, Fokus zurück auf dem Chip', await seite.locator('.se-blatt-ort').count() === 0
    && await seite.evaluate(() => document.activeElement && document.activeElement.matches('.se-chip')));
  await seite.keyboard.press('Enter');
  const perTaste = await seite.waitForSelector('.se-blatt-ort .se-blatt', { timeout: 3000 }).then(() => true).catch(() => false);
  await seite.keyboard.press('Escape');
  await seite.waitForFunction(() => !document.querySelector('.se-blatt-ort'), null, { timeout: 2000 }).catch(() => {});
  pruefe('Tastatur: Enter auf dem Chip öffnet das Blatt', perTaste);

  // ---------- 5. Meilenstein-Moment (Tag 3) ----------
  gruppe = 'Meilenstein';
  await h.setze({ tage: [-2, -1], lauf: { n: 1, best: 1, ms: [] } });
  await h.arena();
  pruefe('Vorbereitet: Tag 2 bis gestern, heute offen (das nächste Feld gestrichelt)', /Tag 2/.test(await seite.locator('.se-heute').innerText())
    && (await h.streifen('.se-heute')).naechstes === 3);
  await seite.evaluate(() => { window.__klaenge = []; });
  await h.spiele(LANG_ZUEGE, LANG_PLAN);
  await h.abrFertig();
  await warte(900);
  const gross = await seite.locator('.erg-feier .erg-f-zeile.gross[data-quelle="meilenstein"]').allInnerTexts();
  pruefe('Tag 3: der große Moment „3 Schachtage in Serie“ mit Zeitraum', gross.length === 1 && /3 Schachtage in Serie/.test(gross[0]) && /\d\d\.\d\d\. bis \d\d\.\d\d\./.test(gross[0]), gross);
  const k3 = await h.klaenge();
  pruefe('Klang „siegel“ für die Plakette; die Zeile bleibt still (ein Klang je Moment)', k3.filter((n) => n === 'siegel').length === 1 && !k3.includes('bauer'), k3);
  const abr3 = await seite.locator('.se-abr').innerText();
  pruefe('Abrechnung: Tag 3 · Bauernmarsch, dazu „2 Siege in Folge“', /Tag 3 · Bauernmarsch/.test(abr3) && /2 Siege in Folge/.test(abr3), abr3);
  await bild(seite, 'ergebnis-meilenstein');
  await seite.locator('.ergebnis-overlay .erg-zu').click();

  // ---------- 6. Umwandlung und Siegeslauf 3 ----------
  gruppe = 'Umwandlung';
  // Tag 4 heute (kein Meilenstein), Feld 5 -> 6
  await h.setze({ tage: [-3, -2, -1], felder: 5, lauf: { n: 2, best: 2, ms: [] } });
  await h.arena();
  await seite.evaluate(() => { window.__klaenge = []; });
  await h.spiele(LANG_ZUEGE, LANG_PLAN);
  await h.abrFertig();
  await warte(900);
  const umw = await seite.locator('.erg-feier .erg-f-zeile.gross[data-quelle="umwandlung"]').allInnerTexts();
  pruefe('Feld 6: der große Moment „Umwandlung! Deine 1. Figur zieht in die Ehrenreihe.“', umw.length === 1 && /Umwandlung! Deine 1\. Figur zieht in die Ehrenreihe\./.test(umw[0]), umw);
  const lauf3 = await seite.locator('.erg-feier .erg-f-zeile[data-quelle="siegeslauf"]').allInnerTexts();
  pruefe('Siegeslauf 3 als Feier-Zeile', lauf3.length === 1 && /Siegeslauf 3 · Flamme/.test(lauf3[0]), lauf3);
  const k4 = await h.klaenge();
  pruefe('Klang „umwandlung“ einmal, kein „bauer“', k4.filter((n) => n === 'umwandlung').length === 1 && !k4.includes('bauer'), k4);
  const abr4 = seite.locator('.se-abr');
  pruefe('Abrechnung: Umwandlung (Bauer auf dem Umwandlungsfeld) und „3 Siege in Folge“ mit Flamme', /Umwandlung!/.test(await abr4.innerText())
    && (await h.streifen('.ergebnis-overlay .se-abr')).feld === 6 && await seite.locator('.se-abr .se-abr-lauf[data-flamme="1"]').count() === 1
    && /3 Siege in Folge/.test(await abr4.innerText()));
  await bild(seite, 'ergebnis-umwandlung');
  await seite.locator('.ergebnis-overlay .erg-zu').click();
  await h.arena();
  pruefe('Kopf-Chip mit Flamme „3“', await seite.locator('.se-chip .se-chip-flamme').count() === 1 && /3/.test(await seite.locator('.se-chip .se-chip-flamme').innerText()));
  pruefe('Heute-Karte: Umwandlung wählen (Dame, Turm, Läufer, Springer; je mindestens 44 x 44)', await seite.locator('.se-heute .se-wahl .se-wahl-knopf').count() === 4
    && await seite.evaluate(() => [...document.querySelectorAll('.se-wahl-knopf')].every((k) => k.getBoundingClientRect().width >= 44 && k.getBoundingClientRect().height >= 44)));
  await bild(seite, 'arena-wahl');
  await seite.evaluate(() => { window.__klaenge = []; });
  await h.tippe('.se-heute .se-wahl-knopf[data-figur="S"]');
  await warte(300);
  pruefe('Springer gewählt: steht in der Ehrenreihe, die Wahl ist weg, Klang umwandlung', (await h.stand()).figuren === 'S' && await seite.locator('.se-heute .se-wahl').count() === 0
    && (await h.klaenge()).includes('umwandlung'));
  await h.tippe('.se-heute .se-h-titel');
  await seite.waitForSelector('.se-blatt .se-ehren');
  pruefe('Serien-Blatt: Ehrenreihe mit dem Springer', await seite.locator('.se-blatt .se-ehren .se-ehre[aria-label="Springer"]').count() === 1);
  await seite.keyboard.press('Escape');
  await seite.waitForFunction(() => !document.querySelector('.se-blatt-ort'), null, { timeout: 2000 }).catch(() => {});

  // ---------- 7. Flamme an Flos Namen, stilles Ende ----------
  gruppe = 'Siegeslauf';
  await seite.evaluate(() => { window.__klaenge = []; });
  await h.plan(NARR_PLAN);
  await h.starte({ botId: 'benno', farbe: 'w' });
  pruefe('partie:spieler-leiste: Flamme mit „3“ an Flos Namen', await seite.locator('.ort-spieler-leiste .se-spieler-flamme').count() === 1
    && /3/.test(await seite.locator('.ort-spieler-leiste .se-spieler-flamme').innerText()));
  await bild(seite, 'partie-flamme');
  for (const zug of NARR_ZUEGE) {
    await h.warteFlo();
    await h.zugTippen(zug);
  }
  await seite.waitForSelector('.ergebnis-overlay.gefuellt:not(.vorlaeufig)', { timeout: 60000 });
  await warte(1200);
  const ende = await seite.locator('.se-abr').innerText().catch(() => '');
  pruefe('Niederlage gegen einen gleich starken Bot: „Siegeslauf beendet bei 3. Dein Rekord: 3.“ still (kein Tag, keine Farbe, kein Klang)',
    /Siegeslauf beendet bei 3\. Dein Rekord: 3\./.test(ende) && !/Tag \d/.test(ende) && await seite.locator('.se-abr .se-abr-lauf[data-flamme]').count() === 0
    && !(await h.klaenge()).some((n) => ['bauer', 'feier', 'siegel'].includes(n)), ende);
  pruefe('Lauf auf 0, Rekord 3', (await h.stand()).lauf.n === 0 && (await h.stand()).lauf.best === 3);
  await seite.locator('.ergebnis-overlay .erg-zu').click();
  await h.arena();
  pruefe('Ohne Lauf keine Flamme mehr im Kopf', await seite.locator('.se-chip .se-chip-flamme').count() === 0);

  // ---------- 8. Bruecke und Ruhen ----------
  gruppe = 'Brücke und Ruhen';
  await h.setze({ tage: [-6, -5, -4, -3, -2] });
  await h.arena();
  const br = await seite.locator('.se-heute').innerText();
  pruefe('Gestern frei: „Gestern war ein Brückentag. Deine Serie läuft: 5 Schachtage.“ (nur im Nachhinein)', /Gestern war ein Brückentag\. Deine Serie läuft: 5 Schachtage in Serie\./.test(br), br);
  await h.setze({ tage: [-9, -8, -7, -6, -5, -4, -3] });
  await h.arena();
  const ruht = await seite.locator('.se-heute').innerText();
  const chipRuht = seite.locator('.se-chip[data-ruht="1"]');
  pruefe('Zwei freie Tage: Chip „ruht“ in Grau, nie „0“; Heute-Karte nennt Rekord und das nächste Kapitel', await chipRuht.count() === 1
    && (await chipRuht.innerText()).trim() === 'ruht' && !/\b0\b/.test(await chipRuht.innerText()) && /ruht · Rekord 7/.test(ruht)
    && /Dein nächstes Tageswerk beginnt Kapitel 2/.test(ruht) && !/\b0 Schachtage/.test(ruht), { ruht, chip: await chipRuht.innerText() });
  await bild(seite, 'arena-ruht');

  // ---------- 9. Einstellungen ----------
  gruppe = 'Einstellungen';
  await seite.evaluate(() => window.__app.gehe('einstellungen'));
  await seite.waitForSelector('.es-ort .se-es');
  const gruppeText = await seite.locator('.es-ort .se-es').innerText();
  pruefe('einstellungen:gruppen: Gruppe „Bauernmarsch“ (anzeigen, streng, leise, Ruhetag)', /Bauernmarsch/i.test(gruppeText) && /Serie anzeigen/.test(gruppeText)
    && /Strenge Serie/.test(gruppeText) && /Leise Serie/.test(gruppeText) && /Ruhetag/.test(gruppeText), gruppeText);
  await seite.locator('.se-es .se-schalter[data-key="anzeigen"]').click();
  await warte(150);
  pruefe('Schalter „Serie anzeigen“ aus: gespeichert', (await seite.evaluate(() => window.__serie.einstellungen())).anzeigen === false);
  await h.arena();
  pruefe('Ausgeblendet: kein Chip, keine Heute-Zeile', await seite.locator('.se-chip').count() === 0 && await seite.locator('.se-heute').count() === 0);
  await seite.evaluate(() => window.__serie.setzeEinstellungen({ anzeigen: true }));
  pruefe('Keine Konsolenfehler im ganzen Ablauf', fehler.length === 0, fehler.join(' | '));
  await kontext.close();

  // ---------- 10. Tag 66 und leise Serie ----------
  gruppe = 'Tag 66';
  {
    const { kontext: k, seite: s, fehler: f } = await neueSeite(browser);
    const hh = hilfen(s);
    await s.goto(MIT() + '#arena');
    await s.waitForSelector('.screen.arena .se-heute');
    await s.evaluate(async () => {
      const tg = await import('./js/tag.js');
      const S = window.__serie;
      const st = S.T.leer();
      const heute = S.heute();
      for (let i = 65; i >= 0; i--) S.T.zaehleTag(st, tg.addiereTage(heute, -i), { quelle: 'partie' });
      S.speichere(st);
    });
    await hh.arena();
    const t66 = await s.locator('.se-heute').innerText();
    pruefe('Am Tag 66 eine ruhige Karte mit dem Angebot, leiser zu werden', /66 Schachtage: laut einer Studie der Median/.test(t66) && await s.locator('.se-h-leise').count() === 1, t66);
    await hh.tippe('.se-h-leise');
    await hh.arena();
    const leise = await s.locator('.se-chip').getAttribute('aria-label');
    pruefe('Leise Serie: der Kopf zeigt den Wochen-Ring', /^Wochen-Ring: \d+ volle/.test(leise) && await s.locator('.se-chip .ico').count() >= 1, leise);
    pruefe('Keine Konsolenfehler', f.length === 0, f.join(' | '));
    await k.close();
  }

  // ---------- 11. Reduzierte Bewegung: sofort das Endbild, Klang bleibt ----------
  gruppe = 'Reduzierte Bewegung';
  {
    const { kontext: k, seite: s, fehler: f } = await neueSeite(browser, { reduziert: true });
    const hh = hilfen(s);
    await s.goto(MIT() + '#arena');
    await s.waitForSelector('.screen.arena .se-heute');
    await hh.klangSpion();
    await hh.spiele(LANG_ZUEGE, LANG_PLAN, { warteAuf: '.ergebnis-overlay .se-abr' });
    const sofort = await s.evaluate(() => {
      const z = document.querySelector('.se-abr');
      return { fertig: z.dataset.fertig, rollt: z.classList.contains('abr-rollt'), feld: getComputedStyle(z.querySelector('.se-streifen')).getPropertyValue('--feld').trim() };
    });
    pruefe('Endbild sofort (kein Einrollen, Bauer schon auf Feld 1)', sofort.fertig === '1' && !sofort.rollt && sofort.feld === '1', sofort);
    await warte(1200);
    pruefe('Klang „bauer“ bleibt (Klang ist keine Bewegung)', (await hh.klaenge()).filter((n) => n === 'bauer').length === 1);
    pruefe('Keine Konsolenfehler', f.length === 0, f.join(' | '));
    await k.close();
  }

  // ---------- 12. Handy und dunkel ----------
  for (const [w, hgt, name] of [[390, 844, 'handy'], [820, 1180, 'ipad-hoch']]) {
    gruppe = name === 'handy' ? 'Handy dunkel' : 'iPad hoch';
    const { kontext: k, seite: s, fehler: f } = await neueSeite(browser, { w, h: hgt, handy: name === 'handy', farbe: name === 'handy' ? 'dark' : 'light' });
    const hh = hilfen(s);
    await s.goto(MIT() + '#arena');
    await s.waitForSelector('.screen.arena .se-heute');
    await hh.setze({ tage: [-12, -11, -10, -9, -8, -7, -5, -4, -3, -2, -1], felder: 11, lauf: { n: 4, best: 4, ms: [3] } });
    await hh.arena();
    const mass = await s.evaluate(() => {
      const z = document.querySelector('.se-heute');
      const k2 = z.closest('.heute-karte');
      const r = z.getBoundingClientRect();
      const kr = k2.getBoundingClientRect();
      return { innen: r.right <= kr.right + 1 && r.left >= kr.left - 1, quer: document.documentElement.scrollWidth <= window.innerWidth + 1,
        streifen: document.querySelector('.se-heute .se-streifen').getBoundingClientRect().right <= kr.right + 1 };
    });
    pruefe('Heute-Karte passt (nichts ragt heraus, kein waagrechtes Scrollen)', mass.innen && mass.quer && mass.streifen, mass);
    await s.locator('.heute-karte').scrollIntoViewIfNeeded();
    await bild(s, `${name}-arena`);
    await hh.spiele(LANG_ZUEGE, LANG_PLAN);
    await hh.abrFertig();
    const abrMass = await s.evaluate(() => {
      const z = document.querySelector('.se-abr');
      const r = z.getBoundingClientRect();
      const h2 = z.closest('.abrechnung').getBoundingClientRect();
      const st = z.querySelector('.se-streifen').getBoundingClientRect();
      return { innen: r.right <= h2.right + 1, streifen: st.right <= r.right + 1, hoehe: Math.round(r.height) };
    });
    const kopfZeile = await s.evaluate(() => { const k = document.querySelector('.se-abr .se-abr-wert'); return k.scrollWidth <= k.clientWidth + 1; });
    pruefe('Abrechnungszeile passt (Streifen in der Zeile, „Tag 12 · Bauernmarsch“ ungekürzt, höchstens 96 px hoch)', abrMass.innen && abrMass.streifen
      && abrMass.hoehe <= 96 && kopfZeile, { abrMass, kopfZeile });
    await warte(1600);
    await bild(s, `${name}-ergebnis`);
    await s.locator('.ergebnis-overlay .erg-zu').click();
    await hh.arena();
    await hh.tippe('.se-heute .se-h-titel');
    await s.waitForSelector('.se-blatt');
    await warte(500);
    const blattMass = await s.evaluate(() => {
      const b = document.querySelector('.se-blatt');
      const kal = document.querySelector('.se-kalender').getBoundingClientRect();
      const r = b.getBoundingClientRect();
      return { kalender: kal.right <= r.right + 1, quer: b.scrollWidth <= b.clientWidth + 1 };
    });
    pruefe('Serien-Blatt: Kalender passt, kein waagrechtes Scrollen', blattMass.kalender && blattMass.quer, blattMass);
    await bild(s, `${name}-blatt`);
    pruefe('Keine Konsolenfehler', f.length === 0, f.join(' | '));
    await k.close();
  }
}

// =====================================================================
// Ablauf
// =====================================================================
if (!NUR_NODE) {
  mkdirSync(BILDER, { recursive: true });
  const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: WURZEL, stdio: 'ignore' });
  let browser = null;
  try {
    await warteAufServer(`http://127.0.0.1:${PORT}/index.html`);
    browser = await browserTyp(ladePlaywright()).launch();
    await testeBrowser(browser);
  } catch (e) {
    pruefe('Browser-Teil ohne Abbruch', false, String(e && e.stack || e));
  } finally {
    if (browser) await browser.close().catch(() => {});
    server.kill();
  }
}

const bestanden = ergebnisse.filter((e) => e.ok).length;
console.log(`\n${bestanden}/${ergebnisse.length} bestanden${NUR_NODE ? ' (nur Node)' : ''}`);
process.exit(bestanden === ergebnisse.length ? 0 : 1);
