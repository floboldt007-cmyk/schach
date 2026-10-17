// Tests fuer das Spiel-Fundament W0+a (Node, ohne Browser): js/tag.js (Tag, Woche, Zufall aus einem Seed),
// js/inhalte.js (statische Inhalte, Dateikopf, Spielplan-Format) und die Bot-Erweiterungen in js/bots.js
// (registriereBot, botZug mit nodes und vorliebe, Seed je Halbzug).
//   node tests/spiel.test.mjs
// Gerechnet wird in der Zeitzone Europe/Berlin (Sommerzeit-Ende am 25.10.2026).
process.env.TZ = 'Europe/Berlin';

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  TAG_GRENZE_STUNDE, tagSchluessel, wochenSchluessel, istSchluessel, addiereTage, tageZwischen, wochentag, kalenderwoche,
  beginnVon, seedAus, zufallAus, zugZufall,
} from '../js/tag.js';
import {
  RECHENSTAND, VORLAUF_TAGE, THEMEN, ladeInhalt, pruefeKopf, pruefeInhalt, registriereInhaltsart, setzeHoler, leereZwischenspeicher,
  pruefeSpielplan, pruefeSpielplanFolge, spielplanWoche, naechsteWochen, funkenWochenendeAktiv, funkenWochenendeVon, texteVon,
  SPIELPLAN_NAME, ladeSpielplan,
} from '../js/inhalte.js';
import {
  BOTS, botNachId, alleBots, registriereBot, botZug, botSatz, vorliebeWert, VORLIEBE_FENSTER_CP, BOT_ARTEN,
} from '../js/bots.js';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let ok = 0;
let fehler = 0;
function pruefe(name, bedingung, info) {
  if (bedingung) { ok++; console.log('OK     ' + name); } else { fehler++; console.log('FEHLER ' + name + (info !== undefined ? '  -> ' + JSON.stringify(info) : '')); }
}
function wirft(fn, muster) {
  try { fn(); } catch (e) { return !muster || muster.test(e.message); }
  return false;
}
const lokal = (j, m, t, h = 12, min = 0) => new Date(j, m - 1, t, h, min, 0, 0);

// =====================================================================
// tag.js
// =====================================================================
pruefe('Zeitzone der Tests: Europe/Berlin (Sommerzeit bis 25.10.2026)', new Date(Date.UTC(2026, 9, 24, 12)).getTimezoneOffset() === -120
  && new Date(Date.UTC(2026, 9, 26, 12)).getTimezoneOffset() === -60);
pruefe('Tagesgrenze 4:00', TAG_GRENZE_STUNDE === 4);
pruefe('tagSchluessel: 3:59 gehoert zum Vortag, 4:00 zum Tag', tagSchluessel(lokal(2026, 10, 17, 3, 59)) === '2026-10-16'
  && tagSchluessel(lokal(2026, 10, 17, 4, 0)) === '2026-10-17' && tagSchluessel(lokal(2026, 10, 17, 23, 59)) === '2026-10-17');
pruefe('tagSchluessel: auch mit Millisekunden', tagSchluessel(lokal(2026, 10, 17, 9).getTime()) === '2026-10-17');
pruefe('tagSchluessel: ungueltiges Datum wirft', wirft(() => tagSchluessel(new Date('quatsch'))) && wirft(() => tagSchluessel('2026-10-17')));
{
  // Sommerzeit-Ende 25.10.2026: um 3:00 MESZ wird es 2:00 MEZ, die Stunde 2 kommt zweimal
  const utc = (h, m = 0) => new Date(Date.UTC(2026, 9, 24, 0, 0) + (h * 60 + m) * 60000);   // ab 24.10. 00:00 UTC
  const proben = [
    [utc(22, 30), '2026-10-24'],      // 25.10. 00:30 MESZ
    [utc(24, 30), '2026-10-24'],      // 25.10. 02:30 MESZ (erste Stunde 2)
    [utc(25, 30), '2026-10-24'],      // 25.10. 02:30 MEZ (zweite Stunde 2)
    [utc(26, 30), '2026-10-24'],      // 25.10. 03:30 MEZ
    [utc(26, 59), '2026-10-24'],      // 25.10. 03:59 MEZ
    [utc(27, 0), '2026-10-25'],       // 25.10. 04:00 MEZ
  ];
  const falsch = proben.filter(([d, soll]) => tagSchluessel(d) !== soll).map(([d, soll]) => [d.toISOString(), tagSchluessel(d), soll]);
  pruefe('Sommerzeit-Ende 25.10.2026: Tag wechselt um 4:00 MEZ, nicht 4 Stunden nach Mitternacht', falsch.length === 0, falsch);
  // der Tag der Zeitumstellung hat 25 Stunden: 25.10. 4:00 MEZ bis 26.10. 4:00 MEZ
  pruefe('Sommerzeit-Ende: beginnVon liegt bei 4:00 Wanduhr, der Tag hat 25 bzw. 24 Stunden',
    beginnVon('2026-10-25').getHours() === 4 && (beginnVon('2026-10-26') - beginnVon('2026-10-25')) === 24 * 3600000
    && (beginnVon('2026-10-25') - beginnVon('2026-10-24')) === 25 * 3600000);
  pruefe('Sommerzeit-Beginn 29.03.2026: 3:30 MESZ gehoert noch zum Vortag', tagSchluessel(lokal(2026, 3, 29, 3, 30)) === '2026-03-28'
    && tagSchluessel(lokal(2026, 3, 29, 4, 0)) === '2026-03-29' && (beginnVon('2026-03-29') - beginnVon('2026-03-28')) === 23 * 3600000);
  pruefe('tageZwischen ueber die Zeitumstellung: ganze Tage', tageZwischen('2026-10-24', '2026-10-26') === 2 && tageZwischen('2026-03-28', '2026-03-30') === 2);
}
// Jahreswechsel
pruefe('Jahreswechsel: Silvester 23:59 und Neujahr 3:59 sind noch 2026-12-31, 4:00 ist 2027-01-01',
  tagSchluessel(lokal(2026, 12, 31, 23, 59)) === '2026-12-31' && tagSchluessel(lokal(2027, 1, 1, 3, 59)) === '2026-12-31'
  && tagSchluessel(lokal(2027, 1, 1, 4, 0)) === '2027-01-01');
pruefe('Jahreswechsel: addiereTage und tageZwischen', addiereTage('2026-12-31', 1) === '2027-01-01' && addiereTage('2027-01-01', -1) === '2026-12-31'
  && tageZwischen('2026-12-30', '2027-01-02') === 3 && addiereTage('2028-02-28', 1) === '2028-02-29' && addiereTage('2026-02-28', 1) === '2026-03-01');
pruefe('Jahreswechsel: Woche ueber Silvester beginnt Montag 28.12.2026', wochenSchluessel(lokal(2027, 1, 1, 12)) === '2026-12-28'
  && wochenSchluessel(lokal(2027, 1, 3, 23)) === '2026-12-28' && wochenSchluessel(lokal(2027, 1, 4, 3, 59)) === '2026-12-28'
  && wochenSchluessel(lokal(2027, 1, 4, 4, 0)) === '2027-01-04');
pruefe('Kalenderwoche (ISO): 01.01.2027 ist KW 53/2026, 04.01. KW 1, 11.01. KW 2 · 2027', JSON.stringify(kalenderwoche('2027-01-01')) === '{"jahr":2026,"kw":53}'
  && JSON.stringify(kalenderwoche('2027-01-04')) === '{"jahr":2027,"kw":1}' && JSON.stringify(kalenderwoche('2027-01-11')) === '{"jahr":2027,"kw":2}'
  && JSON.stringify(kalenderwoche('2026-10-17')) === '{"jahr":2026,"kw":42}' && JSON.stringify(kalenderwoche('2025-12-29')) === '{"jahr":2026,"kw":1}');
pruefe('Wochenschluessel: Montag 4:00 ist die Grenze', wochenSchluessel(lokal(2026, 10, 19, 3, 59)) === '2026-10-12'
  && wochenSchluessel(lokal(2026, 10, 19, 4, 0)) === '2026-10-19' && wochenSchluessel(lokal(2026, 10, 25, 23)) === '2026-10-19'
  && wochentag('2026-10-19') === 0 && wochentag('2026-10-25') === 6);
pruefe('istSchluessel: nur echte Daten', istSchluessel('2026-10-17') && !istSchluessel('2026-02-30') && !istSchluessel('2026-1-07')
  && !istSchluessel(null) && !istSchluessel('2026-10-17T00:00'));
pruefe('addiereTage: nur ganze Zahlen, nur gueltige Schluessel', wirft(() => addiereTage('2026-10-17', 0.5)) && wirft(() => addiereTage('17.10.2026', 1)));
{
  // Uhr springt zurueck (Hand-Einstellung): Schluessel werden frueher, tageZwischen negativ
  const vorher = tagSchluessel(lokal(2026, 10, 17, 22, 0));
  const zurueck = tagSchluessel(lokal(2026, 10, 16, 23, 0));
  const woVorher = wochenSchluessel(lokal(2026, 10, 19, 10, 0));
  const woZurueck = wochenSchluessel(lokal(2026, 10, 18, 10, 0));
  pruefe('Uhr springt zurueck: der neue Tag liegt vor dem gemerkten (tageZwischen negativ, nichts doppelt zaehlen)',
    vorher === '2026-10-17' && zurueck === '2026-10-16' && tageZwischen(vorher, zurueck) === -1 && tageZwischen(vorher, vorher) === 0);
  pruefe('Uhr springt zurueck: auch ueber die Wochengrenze (Woche davor)', woVorher === '2026-10-19' && woZurueck === '2026-10-12' && tageZwischen(woVorher, woZurueck) === -7);
  // Zeitzone wechselt (Reise): derselbe Augenblick ergibt den Tag der neuen Wanduhr
  const augenblick = new Date(Date.UTC(2026, 9, 17, 3, 0));   // Berlin 05:00, New York 23:00 am Vortag
  const berlin = tagSchluessel(augenblick);
  process.env.TZ = 'America/New_York';
  const newYork = tagSchluessel(augenblick);
  process.env.TZ = 'Europe/Berlin';
  pruefe('Zeitzonenwechsel: der Tag folgt der Wanduhr des Geraets (nie UTC)', berlin === '2026-10-17' && newYork === '2026-10-16', { berlin, newYork });
}
{
  const z1 = zufallAus(1);
  const z2 = zufallAus(1);
  const a = Array.from({ length: 5 }, () => z1());
  const b = Array.from({ length: 5 }, () => z2());
  pruefe('zufallAus: gleicher Seed, gleiche Folge (mulberry32, erster Wert fuer Seed 1)', JSON.stringify(a) === JSON.stringify(b) && a[0] === 0.6270739405881613, a);
  const t1 = zufallAus('2026-10-17');
  const t2 = zufallAus('2026-10-17');
  pruefe('zufallAus: Text-Seed (z. B. Tagesschluessel) fuer alle gleich, anderer Tag andere Folge',
    t1() === t2() && zufallAus('2026-10-18')() !== zufallAus('2026-10-17')());
  const z = zufallAus(42);
  let summe = 0;
  let min = 1;
  let max = 0;
  for (let i = 0; i < 20000; i++) { const x = z(); summe += x; min = Math.min(min, x); max = Math.max(max, x); }
  pruefe('zufallAus: Werte in [0, 1), Mittel um 0,5', min >= 0 && max < 1 && Math.abs(summe / 20000 - 0.5) < 0.01, { min, max, mittel: summe / 20000 });
  pruefe('seedAus: Zahl bleibt (32 Bit), Text wird gehasht, sonst Fehler', seedAus(7) === 7 && seedAus(2 ** 32 + 5) === 5 && seedAus('abc') === seedAus('abc')
    && seedAus('abc') !== seedAus('abd') && wirft(() => seedAus(null)) && wirft(() => seedAus({})));
  pruefe('zugZufall: je Seed und Halbzug fest, unabhaengig von der Reihenfolge der Aufrufe', zugZufall(99, 3)() === zugZufall(99, 3)()
    && zugZufall(99, 3)() !== zugZufall(99, 5)() && zugZufall(99, 3)() !== zugZufall(98, 3)() && wirft(() => zugZufall(1, -1)));
}

// =====================================================================
// inhalte.js: Dateikopf, Laden, Spielplan
// =====================================================================
const BEISPIEL = JSON.parse(readFileSync(path.join(WURZEL, 'daten/beispiel/spielplan.json'), 'utf8'));
const kopie = (x) => JSON.parse(JSON.stringify(x));
pruefe('RECHENSTAND der App ist 1, Vorlauf 28 Tage, Themen der Themen-Wochen', RECHENSTAND === 1 && VORLAUF_TAGE === 28
  && JSON.stringify(THEMEN) === '["gambit","endspiel","taktik","eroeffnung","uhr"]' && Object.isFrozen(THEMEN));
pruefe('Beispiel-Spielplan (daten/beispiel/spielplan.json) ist gueltig', pruefeInhalt(BEISPIEL, { art: 'spielplan' }).ok, pruefeInhalt(BEISPIEL).fehler);
{
  const k = (kopf) => pruefeKopf({ kopf });
  const gut = { art: 'spielplan', format: 1, rechenstand: 1, stand: '2026-10-19' };
  pruefe('Dateikopf: vollstaendig ok, nicht veraltet', k(gut).ok && k(gut).veraltet === false);
  pruefe('Dateikopf fehlt oder unvollstaendig: grund kopf', pruefeKopf({}).grund === 'kopf' && k({ ...gut, format: 0 }).grund === 'kopf'
    && k({ ...gut, rechenstand: 'eins' }).grund === 'kopf' && k({ ...gut, stand: '19.10.2026' }).grund === 'kopf' && k({ ...gut, art: 'Spielplan!' }).grund === 'kopf');
  pruefe('Dateikopf: falsche Art', pruefeKopf({ kopf: gut }, { art: 'raetsel-jahr' }).grund === 'art');
  pruefe('Dateikopf: unbekanntes Format einer bekannten Art', k({ ...gut, format: 2 }).grund === 'format');
  pruefe('Dateikopf: hoeherer Rechenstand braucht eine neuere App', k({ ...gut, rechenstand: RECHENSTAND + 1 }).grund === 'rechenstand');
  // eigene Inhaltsart eines Pakets, mit einem aelteren Rechenstand als die App (nur testbar, wenn die App weiter ist)
  const ab = registriereInhaltsart('test-tafel', { formate: [1, 2], pruefe: (j) => (Array.isArray(j.zeilen) ? [] : ['zeilen fehlt']) });
  pruefe('registriereInhaltsart: eigene Art mit eigener Pruefung', pruefeInhalt({ kopf: { ...gut, art: 'test-tafel', format: 2 }, zeilen: [] }).ok
    && pruefeInhalt({ kopf: { ...gut, art: 'test-tafel' } }).grund === 'inhalt' && pruefeInhalt({ kopf: { ...gut, art: 'test-tafel', format: 3 } }).grund === 'format');
  pruefe('registriereInhaltsart: doppelt oder ungueltig wirft', wirft(() => registriereInhaltsart('test-tafel', {})) && wirft(() => registriereInhaltsart('Gross', {}))
    && wirft(() => registriereInhaltsart('spielplan', {})));
  ab();
  pruefe('registriereInhaltsart: abmelden', pruefeInhalt({ kopf: { ...gut, art: 'test-tafel', format: 3 } }).ok);
}
{
  // Laden ueber einen eigenen Holer (in der App: fetch, offline aus dem Cache des Service Workers)
  const anfragen = [];
  const dateien = {
    'daten/spielplan.json': JSON.stringify(BEISPIEL),
    'daten/kaputt.json': '{ kein json',
    'daten/neuer.json': JSON.stringify({ ...BEISPIEL, kopf: { ...BEISPIEL.kopf, rechenstand: 99 } }),
    'daten/falsch.json': JSON.stringify({ ...BEISPIEL, wochen: [{ montag: '2026-11-17', boss: 'x', funkenWochenende: false }] }),
  };
  setzeHoler(async (url) => {
    const rel = url.slice(url.indexOf('daten/'));
    anfragen.push(rel);
    if (rel === 'daten/netzfehler.json') throw new Error('offline');
    return dateien[rel] ? { ok: true, status: 200, text: async () => dateien[rel] } : { ok: false, status: 404, text: async () => '' };
  });
  leereZwischenspeicher();
  const r = await ladeInhalt('spielplan', { art: 'spielplan' });
  pruefe('ladeInhalt: Spielplan laden (Pfad daten/<name>.json relativ zum Modul)', r.ok && r.daten.wochen.length === 6 && r.kopf.stand === '2026-10-19'
    && r.veraltet === false && anfragen[0] === 'daten/spielplan.json', r);
  await ladeInhalt('spielplan', { art: 'spielplan' });
  pruefe('ladeInhalt: einmal geladen bleibt im Arbeitsspeicher', anfragen.length === 1);
  await ladeInhalt('spielplan', { art: 'spielplan', neu: true });
  pruefe('ladeInhalt: neu: true laedt erneut', anfragen.length === 2);
  const gruende = await Promise.all([
    ladeInhalt('fehlt'), ladeInhalt('kaputt'), ladeInhalt('neuer', { art: 'spielplan' }), ladeInhalt('falsch', { art: 'spielplan' }),
    ladeInhalt('spielplan', { art: 'raetsel-jahr', neu: true }), ladeInhalt('../geheim'), ladeInhalt('Gross'), ladeInhalt('netzfehler'),
  ]);
  pruefe('ladeInhalt: Fehler als grund (netz, json, rechenstand, inhalt, art, name), wirft nie',
    JSON.stringify(gruende.map((x) => x.grund)) === '["netz","json","rechenstand","inhalt","art","name","name","netz"]' && gruende.every((x) => x.ok === false),
    gruende.map((x) => [x.grund, x.text]));
  const vorher = anfragen.length;
  await ladeInhalt('fehlt');
  pruefe('ladeInhalt: ein Fehler wird nicht gemerkt (beim naechsten Mal neu versucht)', anfragen.length === vorher + 1);
  pruefe('ladeInhalt: ungueltige Namen fragen nie an', !anfragen.some((a) => a.includes('..') || a.includes('Gross')));
  // Ort des Spielplans: daten/boss/spielplan.json (S1-6 legt ihn an, S1-1 und S1-6 lesen ihn ueber ladeSpielplan)
  const vorSpielplan = anfragen.length;
  const ohne = await ladeSpielplan();
  dateien['daten/boss/spielplan.json'] = JSON.stringify(BEISPIEL);
  const mit = await ladeSpielplan();
  const nochmal = await ladeSpielplan();
  pruefe('ladeSpielplan: daten/boss/spielplan.json (art spielplan); fehlt die Datei: grund netz, beim naechsten Mal neu versucht',
    SPIELPLAN_NAME === 'boss/spielplan' && ohne.ok === false && ohne.grund === 'netz' && mit.ok === true && mit.daten.wochen.length === 6
    && nochmal === mit && JSON.stringify(anfragen.slice(vorSpielplan)) === '["daten/boss/spielplan.json","daten/boss/spielplan.json"]', anfragen.slice(vorSpielplan));
  dateien['daten/boss/spielplan.json'] = JSON.stringify({ ...BEISPIEL, kopf: { ...BEISPIEL.kopf, art: 'raetsel-jahr' } });
  const falscheArt = await ladeSpielplan({ neu: true });
  pruefe('ladeSpielplan: prueft die Art (eine andere Datei an diesem Ort wird abgelehnt)', falscheArt.ok === false && falscheArt.grund === 'art', falscheArt);
  setzeHoler(null);
  leereZwischenspeicher();
}
{
  const p = (aendern) => { const x = kopie(BEISPIEL); aendern(x); return pruefeSpielplan(x); };
  const hat = (f, re) => f.some((t) => re.test(t));
  pruefe('Spielplan: Montag Pflicht', hat(p((x) => { x.wochen[0].montag = '2026-11-17'; }), /kein Montag/));
  pruefe('Spielplan: Wochen lueckenlos', hat(p((x) => { x.wochen.splice(1, 1); }), /lückenlos/));
  pruefe('Spielplan: Boss Pflicht, Thema aus der Liste, funkenWochenende true/false', hat(p((x) => { delete x.wochen[0].boss; }), /boss fehlt/)
    && hat(p((x) => { x.wochen[0].thema = 'blitz'; }), /unbekanntes thema/) && hat(p((x) => { x.wochen[0].funkenWochenende = 'ja'; }), /funkenWochenende/));
  pruefe('Spielplan: kein Feld fuer ein Ende (verfuegbarBis, bis) und keine fremden Felder', hat(p((x) => { x.wochen[0].verfuegbarBis = '2026-11-20'; }), /unbekanntes Feld "verfuegbarBis"/)
    && hat(p((x) => { x.endetAm = 'x'; }), /unbekanntes Feld "endetAm"/));
  pruefe('Spielplan: Funken-Wochenende und Themen-Woche mindestens 28 Tage nach dem Stand (Fairness 19)',
    hat(p((x) => { x.kopf.stand = '2026-11-10'; }), /Funken-Wochenende weniger als 28 Tage/)
    && hat(p((x) => { x.kopf.stand = '2026-11-01'; }), /Themen-Woche weniger als 28 Tage/)
    && p((x) => { x.kopf.stand = '2026-10-26'; }).length === 0);
  pruefe('Spielplan: kein Uhrzeit-Countdown im Text', hat(p((x) => { x.wochen[0].text = 'Nur noch 3 h!'; }), /Countdown/)
    && hat(p((x) => { x.wochen[0].text = 'Start in 10 min'; }), /Countdown/) && hat(p((x) => { x.saison.name = 'Saison 2 Std'; }), /Countdown/));
  pruefe('Spielplan: hoechstens 2 Klassiker, Text hoechstens 140 Zeichen', hat(p((x) => { x.wochen[0].klassiker = ['a1', 'b1', 'c1']; }), /klassiker/)
    && hat(p((x) => { x.wochen[0].text = 'x'.repeat(141); }), /140/));
  pruefe('Spielplan: leer oder kaputt', pruefeSpielplan({ kopf: BEISPIEL.kopf, wochen: [] }).length > 0 && pruefeSpielplan(null).length > 0);
  pruefe('texteVon: alle Texte einer Datei', texteVon({ a: 'x', b: [1, 'y', { c: 'z' }] }).join() === 'x,y,z');
}
{
  // Hilfen
  pruefe('spielplanWoche und naechsteWochen (die naechsten 4 ab der laufenden Woche)', spielplanWoche(BEISPIEL, '2026-11-30').boss === 'springerzuechterin'
    && spielplanWoche(BEISPIEL, '2027-01-04') === null
    && naechsteWochen(BEISPIEL, lokal(2026, 11, 25, 10)).map((w) => w.montag).join() === '2026-11-23,2026-11-30,2026-12-07,2026-12-14'
    && naechsteWochen(BEISPIEL, lokal(2027, 3, 1)).length === 0);
  const fw = funkenWochenendeVon(spielplanWoche(BEISPIEL, '2026-11-30'));
  pruefe('Funken-Wochenende: Freitag 16:00 bis Montag 4:00 (lokal)', fw.beginn.getTime() === lokal(2026, 12, 4, 16).getTime()
    && fw.ende.getTime() === lokal(2026, 12, 7, 4).getTime() && funkenWochenendeVon(spielplanWoche(BEISPIEL, '2026-11-23')) === null);
  pruefe('funkenWochenendeAktiv an den Grenzen', !funkenWochenendeAktiv(BEISPIEL, lokal(2026, 12, 4, 15, 59)) && funkenWochenendeAktiv(BEISPIEL, lokal(2026, 12, 4, 16))
    && funkenWochenendeAktiv(BEISPIEL, lokal(2026, 12, 6, 23, 59)) && funkenWochenendeAktiv(BEISPIEL, lokal(2026, 12, 7, 3, 59))
    && !funkenWochenendeAktiv(BEISPIEL, lokal(2026, 12, 7, 4)) && !funkenWochenendeAktiv(BEISPIEL, lokal(2026, 11, 28, 12)));
  // Funken-Wochenende ueber das Sommerzeit-Ende (Woche ab 19.10.2026): Montag 3:30 MEZ zaehlt noch
  const plan = { kopf: { art: 'spielplan', format: 1, rechenstand: 1, stand: '2026-09-01' }, wochen: [{ montag: '2026-10-19', boss: 'bergwirt', thema: null, funkenWochenende: true }] };
  pruefe('Funken-Wochenende ueber die Zeitumstellung: gueltig, Montag 3:30 noch, 4:00 nicht mehr', pruefeSpielplan(plan).length === 0
    && funkenWochenendeAktiv(plan, lokal(2026, 10, 25, 2, 30)) && funkenWochenendeAktiv(plan, lokal(2026, 10, 26, 3, 30)) && !funkenWochenendeAktiv(plan, lokal(2026, 10, 26, 4, 0))
    && (funkenWochenendeVon(plan.wochen[0]).ende - funkenWochenendeVon(plan.wochen[0]).beginn) === 61 * 3600000);
  // Folge zweier Plan-Dateien: Angekuendigtes bleibt
  const neu = kopie(BEISPIEL);
  neu.kopf.stand = '2026-11-02';
  pruefe('pruefeSpielplanFolge: gleiche Wochen ok, Texte duerfen sich aendern', pruefeSpielplanFolge(BEISPIEL, neu).length === 0
    && (() => { const n = kopie(neu); n.wochen[0].text = 'Tippfehler korrigiert'; return pruefeSpielplanFolge(BEISPIEL, n).length === 0; })());
  // Angekuendigt ist, was der Spielplan-Screen schon zeigen konnte: Wochen vor neu.kopf.stand + 28 Tage
  const verschoben = kopie(neu);
  verschoben.wochen[1].thema = 'taktik';            // Woche 23.11.: schon angekuendigt (vor 02.11. + 28 Tage)
  const weg = kopie(neu);
  weg.kopf.stand = '2026-11-09';
  weg.wochen[2].funkenWochenende = false;           // Woche 30.11. mit Funken-Wochenende: ab 09.11. angekuendigt
  const spaet = kopie(neu);
  spaet.wochen[5].boss = 'eiserne-dame';           // Woche 21.12.: noch nicht angekuendigt
  spaet.wochen[2].funkenWochenende = false;        // Woche 30.11.: am 02.11. noch nicht sichtbar
  pruefe('pruefeSpielplanFolge: Angekuendigtes bleibt (Thema, Funken-Wochenende), spaetere Wochen duerfen sich aendern',
    pruefeSpielplanFolge(BEISPIEL, verschoben).some((t) => /2026-11-23/.test(t)) && pruefeSpielplanFolge(BEISPIEL, weg).some((t) => /2026-11-30/.test(t))
    && pruefeSpielplanFolge(BEISPIEL, spaet).length === 0, [pruefeSpielplanFolge(BEISPIEL, verschoben), pruefeSpielplanFolge(BEISPIEL, weg), pruefeSpielplanFolge(BEISPIEL, spaet)]);
}

// =====================================================================
// bots.js: registriereBot, botZug mit nodes und vorliebe
// =====================================================================
const AVATAR = 'assets/avatare/06-professor-turm.svg';
const PROFIL = {
  id: 'bergwirt', art: 'boss', archiv: true, name: 'Der Bergwirt', avatar: AVATAR, farbe: '#a07040', titel: 'Wochen-Boss',
  staerke: { ...botNachId('turm').staerke }, regel: 'Startet aus dem Spanier nach sechs Zügen und bietet nie Remis an.',
  startFen: 'r1bqkb1r/1ppp1ppp/p1n2n2/4p3/B3P3/5N2/PPPP1PPP/RNBQ1RK1 b kq - 5 5',
  saetze: { begruessung: ['Grüß Gott! Heute gibt es kein Remis.'], gewinnt: ['Prost!'] }, elo: 1100,
};
{
  pruefe('BOT_ARTEN: boss, sparring, gast', JSON.stringify(BOT_ARTEN) === '["boss","sparring","gast"]');
  const ab = registriereBot(PROFIL);
  const b = botNachId('bergwirt');
  pruefe('registriereBot: angemeldet, botNachId findet ihn, stufe null, eingefroren', b && b.name === 'Der Bergwirt' && b.stufe === null && b.art === 'boss'
    && b.archiv === true && Object.isFrozen(b) && Object.isFrozen(b.staerke) && b.elo === 1100 && alleBots().length === BOTS.length + 1);
  pruefe('registriereBot: Leiter unveraendert (10 Bots, Stufen 1 bis 10)', BOTS.length === 10 && BOTS.every((x, i) => x.stufe === i + 1));
  pruefe('registriereBot: Satzbuch des Bosses ueber botSatz', botSatz(b, 'begruessung', () => 0) === 'Grüß Gott! Heute gibt es kein Remis.');
  pruefe('registriereBot: doppelte id oder id eines Leiter-Bots wirft', wirft(() => registriereBot(PROFIL), /schon vergeben/)
    && wirft(() => registriereBot({ ...PROFIL, id: 'rudi' }), /schon vergeben/));
  ab();
  pruefe('registriereBot: abmelden', botNachId('bergwirt') === null && alleBots().length === BOTS.length);
  const falsch = [
    [{ ...PROFIL, archiv: false }, /archiv/],
    [{ ...PROFIL, archiv: undefined }, /archiv/],
    [{ ...PROFIL, id: 'B' }, /id/],
    [{ ...PROFIL, name: '' }, /name/],
    [{ ...PROFIL, avatar: null }, /avatar/],
    [{ ...PROFIL, staerke: null }, /staerke/],
    [{ ...PROFIL, art: 'held' }, /art/],
    [{ ...PROFIL, startFen: 'kein fen' }, /startFen/],
    [{ ...PROFIL, regel: 'x'.repeat(141) }, /regel/],
    [{ ...PROFIL, nodes: 0 }, /nodes/],
    [{ ...PROFIL, vorliebe: 'rochade' }, /vorliebe/],
    [{ ...PROFIL, saetze: { begruessung: 'Hallo' } }, /saetze/],
  ];
  const nichtGeworfen = falsch.filter(([p, re]) => !wirft(() => registriereBot(p), re)).map(([p]) => Object.keys(p).find((k) => p[k] !== PROFIL[k]) || 'archiv');
  pruefe('registriereBot: falsche Profile werfen (auch: Boss ohne archiv: true, Fairness 5.3)', nichtGeworfen.length === 0, nichtGeworfen);
  const gast = registriereBot({ id: 'sparring-1', art: 'sparring', name: 'Sparring', avatar: AVATAR, staerke: { voll: true, movetime: 200 } });
  pruefe('registriereBot: Sparring ohne archiv geht, Standardwerte', botNachId('sparring-1').archiv === false && botNachId('sparring-1').farbe === '#8a93a8'
    && botNachId('sparring-1').startFen === null && botNachId('sparring-1').nodes === null);
  gast();
}

// Fake-Engine: feste Linien, merkt sich die Suchoptionen
function fakeEngine(linien, bestmove) {
  const optionen = [];
  return {
    optionen,
    async analyse(fen, o) { optionen.push({ ...o }); return { bestmove: bestmove || linien[0].pv[0], lines: linien.map((l) => ({ ...l })) }; },
  };
}
const ITAL = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 12';   // Zugzaehler 12: kein Eroeffnungs-Rauschen
const LINIEN = [
  { pv: ['f1c4'], eval: { cp: 40, mate: null } }, { pv: ['f1b5'], eval: { cp: 35, mate: null } },
  { pv: ['b1c3'], eval: { cp: 20, mate: null } }, { pv: ['f3e5'], eval: { cp: -100, mate: null } },
];
const RUHIG = { tiefe: 2, kurzTiefe: 2, kurzChance: 0, breite: 4, intuition: 4, blick: 0, rauschen: 0, patzer: 0, mattInEins: 1, zeit: [0, 0], maxZeit: 3000 };
const testBot = (staerke) => ({ id: 'test', stufe: 5, name: 'Test', staerke });
{
  pruefe('VORLIEBE_FENSTER_CP = 30 (0,3 Bauern)', VORLIEBE_FENSTER_CP === 30);
  // ohne neue Angaben: dieselben Suchoptionen wie vorher (Staerke-Logik unveraendert)
  const e0 = fakeEngine(LINIEN);
  const z0 = await botZug(e0, ITAL, testBot(RUHIG), { ohnePause: true, zufall: () => 0.5 });
  pruefe('botZug ohne nodes/vorliebe: Suche mit movetime wie vorher, bester Zug', z0.uci === 'f1c4' && !('vorliebe' in z0)
    && JSON.stringify(e0.optionen[0]) === '{"depth":2,"multipv":4,"movetime":3000}', e0.optionen);
  const e1 = fakeEngine(LINIEN);
  await botZug(e1, ITAL, testBot(RUHIG), { ohnePause: true, zufall: () => 0.5, nodes: 20000 });
  pruefe('botZug mit nodes: feste Knotenzahl statt movetime', JSON.stringify(e1.optionen[0]) === '{"depth":2,"multipv":4,"nodes":20000}', e1.optionen);
  const e2 = fakeEngine(LINIEN);
  const sf = botNachId('stockfisch');
  await botZug(e2, ITAL, sf, { ohnePause: true, nodes: 50000 });
  pruefe('botZug (volle Staerke) mit nodes: nodes statt movetime', e2.optionen[0].nodes === 50000 && !('movetime' in e2.optionen[0]) && e2.optionen[0].multipv === 1, e2.optionen);
  const e3 = fakeEngine(LINIEN);
  await botZug(e3, ITAL, sf, { ohnePause: true });
  pruefe('botZug (volle Staerke) ohne nodes: movetime 1500 wie vorher', e3.optionen[0].movetime === 1500 && !e3.optionen[0].nodes && e3.optionen[0].multipv === 1);

  // Vorliebe: nur im Fenster von 0,3 Bauern um den besten Zug
  const mit = async (vorliebe, staerke = RUHIG) => botZug(fakeEngine(LINIEN), ITAL, testBot(staerke), { ohnePause: true, zufall: () => 0.5, vorliebe });
  const springer = await mit({ springer: 1 });
  pruefe('Vorliebe Springer: Sc3 (0,2 schlechter, im Fenster) statt Lc4', springer.uci === 'b1c3' && springer.vorliebe === true, springer);
  const bauer = await mit((z) => (z.piece === 'p' ? 1 : 0));
  pruefe('Vorliebe ohne passenden Zug im Fenster: der beste Zug bleibt', bauer.uci === 'f1c4' && !bauer.vorliebe, bauer);
  const schlagen = await mit({ schlagen: 5 });
  pruefe('Vorliebe Schlagen: Sxe5 ist 1,4 Bauern schlechter, bleibt also aus', schlagen.uci === 'f1c4' && !schlagen.vorliebe, schlagen);
  const gleich = await mit({ laeufer: 1 });
  pruefe('Vorliebe mit Gleichstand: der bessere Zug (Lc4 vor Lb5)', gleich.uci === 'f1c4', gleich);
  // der Bot waehlt aus eigenem Charakter einen schwachen Zug (ausserhalb des Fensters): die Vorliebe aendert ihn nicht
  const gierig = { ...RUHIG, vorlieben: { schlagen: 500 } };
  const g1 = await botZug(fakeEngine(LINIEN), ITAL, testBot(gierig), { ohnePause: true, zufall: () => 0.5 });
  const g2 = await mit({ springer: 1 }, gierig);
  pruefe('Vorliebe macht keinen Bot staerker: sein Fehler (Sxe5) bleibt', g1.uci === 'f3e5' && g2.uci === 'f3e5' && !g2.vorliebe, [g1, g2]);
  const patzer = await mit({ springer: 1 }, { ...RUHIG, patzer: 1 });
  pruefe('Vorliebe gilt nie fuer Spontanzuege (Patzer)', patzer.art === 'patzer' && !patzer.vorliebe, patzer);
  pruefe('vorliebeWert: Gewichte und Funktion, Fehler zaehlen 0', vorliebeWert({ springer: 2, schach: 1 }, { piece: 'n', flags: 'n', san: 'Nf3+', to: 'f3' }, { farbe: 'w' }) === 3
    && vorliebeWert({ rochadeLang: 4, koenig: 9 }, { piece: 'k', flags: 'q', san: 'O-O-O', to: 'c1' }, { farbe: 'w' }) === 4
    && vorliebeWert(() => { throw new Error('x'); }, { piece: 'p', flags: 'n', san: 'e4', to: 'e4' }) === 0 && vorliebeWert(() => 'viel', {}) === 0);
  // Vorliebe bei voller Staerke: mehrere Linien, dann Auswahl im Fenster
  const e4 = fakeEngine(LINIEN);
  const v = await botZug(e4, ITAL, sf, { ohnePause: true, vorliebe: { springer: 1 } });
  pruefe('Vorliebe bei voller Staerke: MultiPV 5, Sc3 im Fenster', v.uci === 'b1c3' && v.vorliebe === true && e4.optionen[0].multipv === 5, [v, e4.optionen]);
}
{
  // Seed: gleicher Seed und Halbzug ergeben denselben Zug (auch mit Rauschen und Spontanzuegen), Math.random wird nicht benutzt
  const kalle = botNachId('kalle');
  const linien = LINIEN.map((l, i) => ({ ...l, eval: { cp: 40 - i * 15, mate: null } }));
  const zuege = async (seed) => {
    const aus = [];
    for (let ply = 0; ply < 12; ply++) {
      const z = await botZug(fakeEngine(linien), ITAL, kalle, { ohnePause: true, zufall: zugZufall(seed, ply) });
      aus.push(z.uci + ':' + z.art);
    }
    return aus;
  };
  const alt = Math.random;
  let benutzt = 0;
  Math.random = () => { benutzt++; return alt(); };
  const a = await zuege(1234);
  const b = await zuege(1234);
  const c = await zuege(98765);
  Math.random = alt;
  pruefe('Seed: gleicher Seed, gleiche Bot-Zuege (je Halbzug), Math.random unbenutzt', JSON.stringify(a) === JSON.stringify(b) && benutzt === 0, { a, benutzt });
  pruefe('Seed: ein anderer Seed spielt anders (Rauschen und Spontanzuege bleiben)', JSON.stringify(a) !== JSON.stringify(c), c);
}

console.log(`\n${ok}/${ok + fehler} bestanden`);
process.exit(fehler ? 1 : 0);
