// P4: deterministische Formeln, echte Speicher-/Bus-Anbindung und echte App in vier Browser-Lagen.
// node tests/liga.test.mjs [--nur-node]; PLAYWRIGHT_PFAD wie bei den anderen Suiten.
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { browserTyp } from './browser.mjs';
import * as W from '../js/pakete/liga/wertung.js';
import { BOTS } from '../js/bots.js';
import * as S from '../js/storage.js';
import { sende, hoere } from '../js/ereignisse.js';
import { fuerOverlay } from '../js/feier.js';

process.env.TZ = 'Europe/Berlin';
const DATUM = new Date(2026, 9, 23, 12);
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const ergebnisse = [];
function pruefe(name, fn) {
  try { fn(); ergebnisse.push({ name, ok: true }); console.log('ok   ' + name); }
  catch (e) { ergebnisse.push({ name, ok: false }); console.error('FEHLER ' + name + ': ' + e.message); }
}
async function browserPruefe(name, fn) {
  try { await fn(); ergebnisse.push({ name, ok: true }); console.log('ok   ' + name); }
  catch (e) { ergebnisse.push({ name, ok: false }); console.error('FEHLER ' + name + ': ' + e.message); }
}
const neu = () => W.neuerStand(DATUM);
const partie = (id, extra = {}) => ({ id, botId: 'rudi', ergebnis: 'sieg', ...extra });
const buche = (st, p, elo = 1200) => W.buchePartie(st, p, elo, DATUM);

function nodeTeil() {
  pruefe('Elo: gleiche Staerke ergibt Erwartung 0,5', () => assert.equal(W.erwartung(800, 800), 0.5));
  pruefe('Elo: 400 Punkte Abstand ergibt Erwartung 1/11', () => assert.equal(W.erwartung(800, 1200), 1 / 11));
  for (const [ergebnis, delta] of [['sieg', 20], ['remis', 0], ['niederlage', -20]]) {
    pruefe(`Rohe Elo, K40: ${ergebnis} gegen Gleichstarken = ${delta}`, () => assert.equal(W.eloSchritt({ wert: 800, n: 0 }, 800, ergebnis).delta, delta));
  }
  pruefe('Elo: Sieg gegen +400 = +36, Remis = +16, Niederlage = -4', () => {
    assert.deepEqual(['sieg', 'remis', 'niederlage'].map((e) => W.eloSchritt({ wert: 800, n: 0 }, 1200, e).delta), [36, 16, -4]);
  });
  pruefe('K-Faktor: erste 15 Partien 40, ab Partie 16 24', () => assert.deepEqual([W.kFaktor(0), W.kFaktor(14), W.kFaktor(15)], [40, 40, 24]));
  pruefe('Ein oder mehrere Hinweise halbieren K genau einmal', () => assert.deepEqual([W.kFaktor(14, 1), W.kFaktor(14, 2), W.kFaktor(15, 3)], [20, 20, 12]));
  pruefe('Hinweis halbiert das Rechenbeispiel auf +10', () => assert.equal(W.eloSchritt({ wert: 800, n: 0 }, 800, 'sieg', 1).delta, 10));
  pruefe('Unsicherheit: n0=350, n9=111, n48=50, Untergrenze 50', () => assert.deepEqual([0, 9, 48, 10000].map(W.unsicherheit), [350, 111, 50, 50]));
  pruefe('Vorlaeufig gilt fuer die ersten 9 Partien, ab 10 nicht mehr', () => assert.deepEqual([0, 9, 10, 11].map(W.vorlaeufig), [true, true, false, false]));
  pruefe('Blitz: 599 Sekunden ja, 600 Sekunden und ohne Uhr nein', () => assert.deepEqual([undefined, { grund: 599 }, { grund: 600 }, { grund: 0 }].map((tempo) => W.istBlitz({ tempo })), [false, true, false, false]));
  pruefe('Blitz und normale Wertung bleiben auch beim Zaehler getrennt', () => {
    const a = buche(neu(), partie('blitz', { tempo: { grund: 300 } })).stand;
    assert.deepEqual(a.wertung, { n: 0, wert: 800, blitz: { n: 1, wert: 836 } });
    const b = buche(a, partie('normal')).stand;
    assert.deepEqual(b.wertung, { n: 1, wert: 836, blitz: { n: 1, wert: 836 } });
  });
  pruefe('Harte P4-Regel: negative rohe Elo senkt die gespeicherte Zahl nie', () => {
    const r = buche(neu(), partie('verlust', { ergebnis: 'niederlage' }), 800);
    assert.equal(r.elo.delta, -20); assert.equal(r.stand.wertung.wert, 800); assert.equal(r.stand.wertung.n, 1);
  });
  pruefe('Klassen: alle fuenf Grenzen und Untergrenzen', () => {
    assert.deepEqual([999, 1000, 1199, 1200, 1400, 1600, 1900].map((w) => W.spielklasse(w, 10)), [0, 1, 1, 2, 3, 4, 5]);
  });
  pruefe('Klasse: vor 10 Partien kein Aufstieg, erreichte Klasse bleibt', () => {
    assert.equal(W.spielklasse(2200, 9), 0); assert.equal(W.spielklasse(800, 100, 5), 5);
  });
  pruefe('Klassen-Moment genau beim zehnten normalen Spiel und einmal je Klasse', () => {
    const st = neu(); st.wertung.n = 9; st.wertung.wert = 1190; st.klasse = { erreicht: 1, momente: [1] };
    const r = buche(st, partie('aufstieg'));
    assert.equal(r.stand.klasse.erreicht, 2); assert.deepEqual(r.aufstieg.filter((a) => a.art === 'klasse').map((a) => a.stufe), [2]);
    assert.equal(buche(r.stand, partie('danach')).aufstieg.filter((a) => a.art === 'klasse').length, 0);
  });
  pruefe('Blitz beschleunigt die Einstufung der Hauptklasse nicht', () => {
    const st = neu(); st.wertung.blitz = { n: 9, wert: 1990 };
    const r = buche(st, partie('blitz-klasse', { tempo: { grund: 300 } }), 2100);
    assert.equal(r.stand.klasse.erreicht, 0); assert.equal(r.stand.wertung.n, 0);
  });
  pruefe('Liga-Schwellen vollstaendig, jede Grenze genau', () => {
    assert.deepEqual(W.STUFEN.map((s) => s.schwelle), [0, 100, 250, 450, 700, 1000, 1400]);
    for (let i = 1; i < W.STUFEN.length; i++) {
      assert.equal(W.ligaStufe(W.STUFEN[i].schwelle), i); assert.equal(W.ligaStufe(W.STUFEN[i].schwelle - 1), i - 1);
    }
  });
  pruefe('Liga-Punkte: Sieg 10, staerkerer Bot Bonus, Deckel 25', () => assert.deepEqual([800, 801, 900, 901, 3000].map((e) => W.ligaPunkte('sieg', e, 800)), [10, 11, 11, 12, 25]));
  // Flo 30.10. abends: "harte, sinnvolle Bewertung", die Genauigkeit zaehlt stark
  pruefe('Liga-Punkte: Genauigkeit zaehlt stark (+8 ab 90 % bis -12 unter 40 %), Sieg bleibt ein Plus', () => {
    assert.deepEqual([95, 85, 75, 65, 55, 45, 30].map((g) => W.ligaPunkte('sieg', 800, 800, g)), [18, 15, 12, 10, 6, 2, 2]);
    assert.equal(W.ligaPunkte('sieg', 3000, 800, 100), 33);
    assert.deepEqual([95, 65, 30].map((g) => W.ligaPunkte('remis', 800, 800, g)), [12, 4, -8]);
    assert.deepEqual([95, 85, 65, 45, 30].map((g) => W.ligaPunkte('niederlage', 800, 800, g)), [0, -3, -8, -16, -20]);
  });
  pruefe('Liga-Punkte: Niederlage gegen einen schwaecheren Bot kostet mehr, gegen einen staerkeren weniger', () => {
    assert.deepEqual([200, 600, 800, 1000, 1400].map((e) => W.ligaPunkte('niederlage', e, 800)), [-20, -12, -8, -4, -2]);
    assert.deepEqual([200, 800, 1400].map((e) => W.ligaPunkte('remis', e, 800)), [0, 4, 12]);
    assert.equal(W.ligaPunkte('niederlage', 200, 800, 20), -32);
  });
  pruefe('Liga: jede erreichte Stufe haelt ihre Schwelle bei Verlusten', () => {
    for (let i = 0; i < W.STUFEN.length; i++) {
      const r = W.ligaSchritt({ stufe: i, punkte: W.STUFEN[i].schwelle + 1 }, -3);
      assert.equal(r.stufe, i); assert.equal(r.punkte, W.STUFEN[i].schwelle);
    }
  });
  pruefe('Liga-Aufstieg einmal; Rueckkehr zur Schwelle erzeugt keinen zweiten Moment', () => {
    const st = neu(); st.saison.punkte = 99;
    const r = buche(st, partie('bronze'));
    assert.equal(r.stand.saison.stufe, 1); assert.equal(r.aufstieg.filter((a) => a.art === 'liga').length, 1);
    let s = r.stand;
    for (let i = 0; i < 10; i++) s = buche(s, partie('n' + i, { ergebnis: 'niederlage' })).stand;
    assert.equal(s.saison.punkte, 100); assert.equal(buche(s, partie('wieder')).aufstieg.length, 0);
  });
  pruefe('Buchung ist rein und dieselbe Partie wird nicht doppelt gebucht', () => {
    const st = neu(), vorher = JSON.stringify(st), r = buche(st, partie('einmal'));
    assert.equal(JSON.stringify(st), vorher); assert.equal(buche(r.stand, partie('einmal')).gebucht, false);
  });
  pruefe('Genauigkeit wird erst aus finalen Daten und genau einmal ergaenzt', () => {
    const r = buche(neu(), partie('analyse', { genauigkeit: 99, genauigkeitQuelle: 'live' }));
    assert.equal(r.stand.saison.punkte, 14);
    const a = W.bucheGenauigkeit(r.stand, 'analyse', 80);
    assert.equal(a.stand.saison.punkte, 19); assert.equal(a.stand.wertung.n, 1);
    assert.equal(W.bucheGenauigkeit(a.stand, 'analyse', 100).gebucht, false);
  });
  pruefe('Verspaetete Genauigkeit und Stufen-Untergrenzen: gleiche Rechnung wie sofort', () => {
    for (const start of [0, 1, 2, 99, 100, 101, 102, 103, 248, 249, 250]) {
      const initial = neu(); initial.saison.punkte = start; initial.saison.stufe = W.ligaStufe(start);
      let sofort = initial, spaeter = initial;
      for (const [i, ergebnis] of ['niederlage', 'sieg', 'niederlage', 'niederlage', 'remis'].entries()) {
        sofort = buche(sofort, partie('r' + i, { ergebnis, genauigkeit: 80 })).stand;
        spaeter = buche(spaeter, partie('r' + i, { ergebnis })).stand;
      }
      for (const i of [3, 0, 4, 2, 1]) spaeter = W.bucheGenauigkeit(spaeter, 'r' + i, 80).stand;
      assert.deepEqual(spaeter.saison, sofort.saison, 'Startpunkte ' + start);
    }
  });
  pruefe('Nachtraeglicher Genauigkeits-Aufstieg erzeugt einen belegten Moment', () => {
    const st = neu(); st.saison.punkte = 89;
    const r = buche(st, partie('bonus'), 800); assert.equal(r.stand.saison.stufe, 0);
    const a = W.bucheGenauigkeit(r.stand, 'bonus', 80); assert.equal(a.stand.saison.stufe, 1);
    assert.equal(a.aufstieg[0].art, 'liga'); assert.equal(a.stand.saison.punkte, 104);
  });
  pruefe('Unbekannte oder ungueltige Analyse bucht nichts', () => {
    const st = buche(neu(), partie('gueltig')).stand;
    for (const g of [null, NaN, -1, 101]) assert.equal(W.bucheGenauigkeit(st, 'gueltig', g).gebucht, false);
    assert.equal(W.bucheGenauigkeit(st, 'unbekannt', 90).gebucht, false);
  });
  pruefe('Saison 1 startet am Montag 19.10.2026, Ende 11.01.2027', () => assert.deepEqual(W.saisonAm(new Date(2026, 9, 19, 4)), { nr: 1, start: '2026-10-19', ende: '2027-01-11', tage: 84 }));
  pruefe('Vor dem Start kein Liga-Punkt und keine Meisterschaft', () => {
    const d = new Date(2026, 9, 19, 3, 59), st = W.neuerStand(d);
    const r = W.buchePartie(st, partie('vor-start'), 1200, d);
    assert.equal(r.stand.saison.nr, 0); assert.equal(r.stand.saison.punkte, 0); assert.deepEqual(r.stand.meisterschaft, {});
    assert.equal(r.stand.wertung.n, 1);
    const neu = W.wechsleSaison(r.stand, DATUM).stand; assert.equal(neu.saison.nr, 1); assert.equal(neu.archiv.length, 0);
  });
  pruefe('Countdown wechselt an 4:00, auch ueber Sommerzeit-Ende', () => {
    for (const [d, tage] of [[new Date(2026, 9, 23, 3, 59), 81], [new Date(2026, 9, 23, 4), 80], [new Date(2026, 9, 25, 3, 59), 79], [new Date(2026, 9, 25, 4), 78]]) assert.equal(W.saisonAm(d).tage, tage);
  });
  pruefe('Saison-Grenze: 03:59 noch Saison 1, 04:00 Saison 2', () => {
    assert.equal(W.saisonAm(new Date(2027, 0, 11, 3, 59)).nr, 1); assert.equal(W.saisonAm(new Date(2027, 0, 11, 3, 59)).tage, 1);
    assert.equal(W.saisonAm(new Date(2027, 0, 11, 4)).nr, 2);
  });
  pruefe('Reset aller Stufen: Archiv mit Rechenstand, eine Stufe tiefer, Klasse und Wertung bleiben', () => {
    for (let i = 0; i < W.STUFEN.length; i++) {
      const st = neu(); st.saison.stufe = i; st.saison.punkte = W.STUFEN[i].schwelle + 17;
      st.klasse.erreicht = 4; st.wertung.wert = 1700; st.meisterschaft = { rudi: 3 };
      const r = W.wechsleSaison(st, new Date(2027, 0, 11, 4));
      assert.equal(r.stand.saison.stufe, Math.max(0, i - 1));
      assert.equal(r.stand.saison.punkte, W.STUFEN[Math.max(0, i - 1)].schwelle);
      assert.deepEqual(r.stand.archiv, [{ nr: 1, stufe: i, punkte: st.saison.punkte, stand: 1 }]);
      assert.equal(r.stand.klasse.erreicht, 4); assert.equal(r.stand.wertung.wert, 1700); assert.deepEqual(r.stand.meisterschaft, {});
      assert.equal(W.wechsleSaison(r.stand, new Date(2027, 0, 12, 12)).wechsel, false);
    }
  });
  pruefe('Laengere Pause: ein Reset, kein erfundenes Abzeichen fuer ausgelassene Saisons', () => {
    const st = neu(); st.saison.stufe = 6; st.saison.punkte = 1500;
    const r = W.wechsleSaison(st, new Date(2028, 9, 23, 12));
    assert.equal(r.stand.saison.stufe, 5); assert.equal(r.stand.archiv.length, 1);
  });
  pruefe('Zurueckgestellte Uhr rollt Saison und Archiv nie zurueck', () => {
    const st = W.wechsleSaison(neu(), new Date(2027, 0, 11, 4)).stand;
    assert.equal(W.wechsleSaison(st, DATUM).stand, st);
  });
  // Codex-Befund P2 (#24): Das Ergebnis darf nicht davon abhaengen, ob die Analyse vor oder nach 4:00 fertig wird.
  pruefe('Partie 3:59, Analyse 4:01: gleiches Archiv und gleicher Saisonstart wie mit Analyse vor 4:00', () => {
    const d359 = new Date(2027, 0, 11, 3, 59), d401 = new Date(2027, 0, 11, 4, 1), d410 = new Date(2027, 0, 11, 4, 10);
    let verschoben = 0;
    for (const start of [0, 88, 94, 98, 238, 240, 244, 438, 444, 448, 688, 694, 988, 994, 1388, 1394, 1500]) {
      for (const ergebnis of ['sieg', 'remis', 'niederlage']) {
        const initial = neu(); initial.saison.punkte = start; initial.saison.stufe = W.ligaStufe(start);
        const gebucht = W.buchePartie(initial, partie('grenze', { ergebnis }), 800, d359).stand;
        // a) Analyse vor 4:00, dann Saisonwechsel
        const vorher = W.wechsleSaison(W.bucheGenauigkeit(gebucht, 'grenze', 90).stand, d401).stand;
        // b) Saisonwechsel um 4:00, Analyse erst danach
        const nachher = W.bucheGenauigkeit(W.wechsleSaison(gebucht, d401).stand, 'grenze', 90).stand;
        assert.deepEqual(nachher, vorher, `Start ${start}, ${ergebnis}`);
        // c) dazwischen schon eine Partie der neuen Saison
        const mitPartie = (st) => W.buchePartie(st, partie('neu-saison', { ergebnis: 'sieg' }), 1200, d410).stand;
        const c1 = mitPartie(vorher);
        const c2 = W.bucheGenauigkeit(mitPartie(W.wechsleSaison(gebucht, d401).stand), 'grenze', 90).stand;
        assert.deepEqual(c2, c1, `Start ${start}, ${ergebnis}, mit Partie der neuen Saison`);
        if (vorher.saison.stufe !== W.wechsleSaison(gebucht, d401).stand.saison.stufe) verschoben++;
      }
    }
    assert.ok(verschoben >= 10, 'mindestens zehn Faelle, in denen die Analyse die Startstufe der neuen Saison hebt: ' + verschoben);
  });
  pruefe('Partie 3:59, Analyse 4:01: Aufstieg der alten Saison wird nicht als neuer Aufstieg gefeiert', () => {
    const initial = neu(); initial.saison.punkte = 438; initial.saison.stufe = 2;
    const gebucht = W.buchePartie(initial, partie('feier'), 800, new Date(2027, 0, 11, 3, 59)).stand;
    const gewechselt = W.wechsleSaison(gebucht, new Date(2027, 0, 11, 4, 1)).stand;
    assert.equal(gewechselt.saison.stufe, 1);
    const a = W.bucheGenauigkeit(gewechselt, 'feier', 95);
    assert.deepEqual(a.stand.archiv, [{ nr: 1, stufe: 3, punkte: 456, stand: 1 }]);
    assert.equal(a.stand.saison.stufe, 2); assert.equal(a.stand.saison.punkte, W.STUFEN[2].schwelle);
    assert.deepEqual(a.aufstieg, []);
  });
  pruefe('Analyse aus einer aelteren Saison veraendert weder Archiv noch laufende Saison', () => {
    const s2 = W.wechsleSaison(buche(neu(), partie('alt')).stand, new Date(2027, 0, 11, 4)).stand;
    const st = W.wechsleSaison(s2, new Date(2027, 3, 5, 4)).stand;
    assert.equal(st.saison.nr, 3); assert.equal(st.archiv.length, 2);
    const a = W.bucheGenauigkeit(st, 'alt', 99);
    assert.equal(a.gebucht, true); assert.deepEqual(a.stand.archiv, st.archiv); assert.deepEqual(a.stand.saison, st.saison);
    assert.equal(W.belegFuer(a.stand, 'alt')[5], 1);
  });
  pruefe('Kreuztabelle: alle Bots der Leiter (Welten: 30), nur bestes Ergebnis, maximal 3 Punkte je Bot', () => {
    let st = neu();
    for (const bot of BOTS) for (const [i, ergebnis] of ['niederlage', 'remis', 'sieg', 'niederlage'].entries()) st = buche(st, partie(bot.id + i, { botId: bot.id, ergebnis }), bot.elo).stand;
    const k = W.kreuztabelle(st.meisterschaft, BOTS); assert.equal(k.zeilen.length, BOTS.length); assert.equal(k.punkte, BOTS.length * 3); assert.equal(k.siege, BOTS.length);
  });
  pruefe('Kreuztabelle unterscheidet offen, gespielt und Remis', () => {
    const t = W.kreuztabelle({ benno: 0, hilde: 1, fremderBot: 3 }, BOTS);
    const zeile = (id) => t.zeilen[BOTS.findIndex((b) => b.id === id)];
    assert.equal(zeile('benno').gespielt, true); assert.equal(zeile('hilde').punkte, 1); assert.equal(zeile('kalle').gespielt, false); assert.equal(t.punkte, 1);
  });
  pruefe('Alte Spielstaende ohne Modul und unbekannter Rechenstand', () => {
    assert.deepEqual(W.normalisiereStand(null, DATUM), neu()); assert.equal(W.normalisiereStand({ stand: 2 }, DATUM), null);
  });
  pruefe('Defekte optionale Felder bleiben ohne Ausnahme lesbar', () => {
    const st = W.normalisiereStand({ stand: 1, wertung: { n: -5, wert: 'falsch' }, klasse: null, saison: { punkte: -99 }, archiv: [null], belege: [null], kurve: [null] }, DATUM);
    assert.equal(st.wertung.n, 0); assert.equal(st.wertung.wert, 800); assert.equal(st.saison.punkte, 0);
  });
  pruefe('Saison-Liga beenden: laufende Saison ins Archiv, Saison leer, idempotent, ueberlebt Speichern und Laden', () => {
    const datum = new Date(2027, 0, 12, 12);
    const st = buche(neu(), partie('vorher')).stand; const nr = st.saison.nr; const punkte = st.saison.punkte;
    const e = W.beendeSaisonLiga(st);
    assert.notEqual(e, st); assert.equal(st.saisonEnde, undefined, 'Eingabe bleibt unveraendert');
    assert.deepEqual(e.archiv.map((a) => [a.nr, a.punkte]), [[nr, punkte]]); assert.equal(e.saison.nr, 0); assert.equal(e.saison.punkte, 0);
    assert.deepEqual(e.meisterschaft, {}); assert.equal(e.wertung.n, st.wertung.n); assert.deepEqual(e.belege, st.belege);
    assert.equal(W.beendeSaisonLiga(e), e, 'zweites Beenden aendert nichts');
    const geladen = W.normalisiereStand(JSON.parse(JSON.stringify(e)), datum);
    assert.equal(geladen.saisonEnde, true); assert.deepEqual(geladen.archiv, e.archiv); assert.equal(geladen.saison.nr, 0);
    assert.equal(W.wechsleSaison(geladen, new Date(2028, 0, 12, 12)).wechsel, false, 'nach dem Ende kein Saisonwechsel');
    const leer = W.beendeSaisonLiga(neu()); assert.equal(leer.archiv.length, 0, 'ohne Partie kein leeres Abzeichen');
    const nach = W.buchePartie(e, partie('danach'), 800, datum).stand;
    assert.equal(nach.saison.punkte, 0); assert.deepEqual(nach.meisterschaft, {}); assert.equal(nach.wertung.n, e.wertung.n + 1);
    const a = W.bucheGenauigkeit(nach, 'danach', 95);
    assert.ok(a.gebucht); assert.deepEqual(a.stand.archiv, e.archiv); assert.equal(a.stand.saison.punkte, 0); assert.deepEqual(a.aufstieg, []);
  });
  pruefe('Speicher-Budget: 2000 Partien, Kurve und Belege begrenzt, Auszeichnungen bleiben', () => {
    const datum = new Date(2027, 0, 12, 12);
    let st = W.neuerStand(datum); st.archiv = [{ nr: 1, stufe: 3, punkte: 500, stand: 1 }];
    for (let i = 0; i < 2000; i++) st = W.imBudget(W.buchePartie(st, partie('p' + String(i).padStart(36, 'x')), 3000, datum).stand);
    assert.ok(JSON.stringify(st).length <= 10000); assert.ok(st.belege.length <= W.BELEGE_MAX); assert.equal(st.kurve.length, W.KURVE_MAX);
    assert.equal(st.archiv.length, 1); assert.equal(st.wertung.n, 2000); assert.equal(st.klasse.erreicht, 5);
  });
  pruefe('CSS nutzt nur Farb-Tokens und fuegt keine eigene Bewegung hinzu', () => {
    const css = readFileSync(path.join(WURZEL, 'css/pakete/liga.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    assert.ok(!/#[\da-f]{3,8}\b|rgba?\(|hsla?\(|animation\s*:|transition\s*:|--neon-/.test(css));
  });
}

async function integrationsTeil() {
  const speicher = new Map();
  S.setzeSpeicher({ getItem: (k) => speicher.get(k) ?? null, setItem: (k, v) => speicher.set(k, String(v)), removeItem: (k) => speicher.delete(k), key: (i) => [...speicher.keys()][i] ?? null, get length() { return speicher.size; } });
  await import('../js/pakete/liga/index.js');
  const jetzt = new Date(), frisch = () => W.neuerStand(jetzt);
  let ereignis;
  const ab = hoere('liga:geaendert', (d) => { ereignis = d; });
  const ende = (p, extra = {}) => {
    const r = S.speicherePartie({ ...p, spielerFarbe: 'w', zuege: ['e2e4', 'e7e5'], modus: p.modus || 'normal' });
    sende('partie:beendet', { laufId: 'lauf-' + p.id, partieId: p.id, wertet: r.wertet, botId: p.botId, ergebnis: p.ergebnis, ...extra });
    return r;
  };
  S.speichereModul('liga', frisch());
  pruefe('Echte Anbindung: Ende liest tempo aus dem Speicher und bucht Blitz', () => {
    ende(partie('echt-blitz', { tempo: { grund: 300, zuschlag: 0 } }));
    const st = S.ladeModul('liga'); assert.equal(st.wertung.n, 0); assert.equal(st.wertung.blitz.n, 1);
    assert.equal(ereignis.wertung.blitz.n, 1); assert.equal(ereignis.stufe, 'Holz'); assert.ok(Object.isFrozen(ereignis));
  });
  pruefe('Echte Anbindung: Widerspruch zu wertet beim Start wird geschuetzt', () => {
    sende('partie:gestartet', { laufId: 'lauf-startschutz', wertet: false }); ende(partie('startschutz'));
    assert.equal(S.ladeModul('liga').wertung.n, 0);
  });
  pruefe('Echte Anbindung: eigene Stellung und Boss werten trotz falschem Ereignis nie', () => {
    ende(partie('eigen', { startFen: '7k/8/5KQ1/8/8/8/8/8 w - - 0 1' }), { wertet: true });
    ende(partie('boss', { modus: 'boss' }), { wertet: true }); assert.equal(S.ladeModul('liga').wertung.n, 0);
  });
  pruefe('Echte Anbindung: Hinweis aus dem Ereignis halbiert K', () => {
    ende(partie('hilfe'), { hinweise: 1 }); assert.equal(S.ladeModul('liga').wertung.wert, 818);
  });
  pruefe('Echte Anbindung: normale Partie, Duplikat und finale Analyse (eine Liga: keine Liga-Punkte mehr)', () => {
    const r = ende(partie('echt-normal')); sende('partie:beendet', { partieId: r.partie.id, wertet: true });
    assert.equal(S.ladeModul('liga').wertung.n, 2);
    S.ergaenzeAnalyse(r.partie.id, { zuege: [], genauigkeit: { w: 85, b: 70 } });
    sende('partie:analysiert', { partieId: r.partie.id, wertet: true });
    const st = S.ladeModul('liga'); assert.equal(st.saisonEnde, true); assert.equal(st.saison.punkte, 0); assert.equal(st.saison.nr, 0);
    sende('partie:analysiert', { partieId: r.partie.id, wertet: true }); assert.deepEqual(S.ladeModul('liga'), st);
  });
  pruefe('Echte Anbindung: alte Analyse ohne Beleg startet keine Wertung', () => {
    const r = S.speicherePartie(partie('vor-paket')); const n = S.ladeModul('liga').wertung.n;
    sende('partie:analysiert', { partieId: r.partie.id, wertet: true, review: { genauigkeit: { w: 99 } } });
    assert.equal(S.ladeModul('liga').wertung.n, n);
  });
  pruefe('Echte Anbindung: Klasse steigt still weiter, keine Liga- oder Klassen-Feier, alte Saison als Abzeichen', () => {
    const st = frisch(); st.wertung = { ...st.wertung, wert: 1190, n: 9 }; st.klasse = { erreicht: 1, momente: [1] }; st.saison.punkte = 99; st.saison.partien = 3;
    const nr = st.saison.nr;
    S.speichereModul('liga', st); ende(partie('moment'));
    const neu = S.ladeModul('liga');
    assert.equal(neu.klasse.erreicht, 2); assert.equal(neu.saison.stufe, 0); assert.equal(neu.saisonEnde, true);
    assert.deepEqual(neu.archiv.map((a) => [a.nr, a.punkte]), [[nr, 99]], 'laufende Saison mit Punkten kommt ins Archiv');
    assert.equal(fuerOverlay('moment').length, 0, 'keine Feier');
    assert.equal(ereignis.aufstieg, false);
  });
  pruefe('Migration beim Start: alter Stand wird einmal beendet, Wertung und Abzeichen bleiben, zweiter Start aendert nichts', () => {
    const st = frisch(); st.wertung = { ...st.wertung, wert: 1300, n: 12 }; st.saison.punkte = 340; st.saison.partien = 8; st.saison.stufe = 2;
    st.saison.nr = 2; st.archiv = [{ nr: 1, stufe: 4, punkte: 900, stand: st.stand }]; st.meisterschaft = { benno: 3 };
    S.speichereModul('liga', st); sende('app:bereit');
    const m = S.ladeModul('liga');
    assert.equal(m.saisonEnde, true); assert.equal(m.wertung.wert, 1300); assert.equal(m.wertung.n, 12); assert.deepEqual(m.meisterschaft, {});
    assert.deepEqual(m.archiv.map((a) => [a.stufe, a.punkte]), [[4, 900], [2, 340]]);
    sende('app:bereit'); assert.deepEqual(S.ladeModul('liga'), m);
  });
  pruefe('Echte Anbindung: kuenftiger Rechenstand wird nicht ueberschrieben', () => {
    S.speichereModul('liga', { stand: 99, behalten: true }); ende(partie('zukunft'));
    assert.deepEqual(S.ladeModul('liga'), { stand: 99, behalten: true });
  });
  pruefe('Echte Anbindung: Fortschritt zuruecksetzen leert auch Paket und Merker', () => {
    S.setzeZurueck(); sende('app:bereit'); ende(partie('nach-reset'));
    assert.equal(S.ladeModul('liga').wertung.n, 1); assert.equal(S.ladeModul('liga').klasse.erreicht, 0);
  });
  ab(); S.setzeSpeicher(null);
}

// Etappe B Task 5: das Liga-Paket meldet Kronen beim (abgefangenen) Server, nie mehr als einmal, nie ohne Konto
async function kronenMeldeTeil() {
  const { setzeOnlineFetch } = await import('../js/online.js');
  // Meldungen der Partien aus integrationsTeil laufen verzoegert (das Paket laedt js/kronen.js erst beim Melden):
  // erst ohne Konto auslaufen lassen, dann die Sitzung anlegen
  await new Promise((r) => setTimeout(r, 300));
  const speicher = new Map();
  const lager = { getItem: (k) => speicher.get(k) ?? null, setItem: (k, v) => speicher.set(k, String(v)), removeItem: (k) => speicher.delete(k), key: (i) => [...speicher.keys()][i] ?? null, get length() { return speicher.size; } };
  S.setzeSpeicher(lager);
  const altLager = globalThis.localStorage;
  globalThis.localStorage = lager;
  const sitzung = { access_token: 'a.' + Buffer.from(JSON.stringify({ sub: '0f8b6c1e-2d3a-4b5c-8d9e-0a1b2c3d4e5f' })).toString('base64url') + '.x',
    refresh_token: 'r1', expires_at: 9999999999, user: { id: '0f8b6c1e-2d3a-4b5c-8d9e-0a1b2c3d4e5f', email: 'probe@example.invalid' } };
  speicher.set('schach-arena:konto:sitzung', JSON.stringify(sitzung));
  let aufrufe = [];
  let netzFehlt = false;
  setzeOnlineFetch(async (url, opt) => {
    aufrufe.push({ name: (String(url).match(/\/rest\/v1\/rpc\/([a-z_]+)/) || [])[1], daten: opt && opt.body ? JSON.parse(opt.body) : null });
    if (netzFehlt) throw new Error('offline');
    return { ok: true, status: 200, json: async () => antwort || { delta: 15, kronen: 15, stufe: 0 } };
  });
  let antwort = null;
  const kurz = () => new Promise((r) => setTimeout(r, 150)); // das Paket laedt js/kronen.js erst beim Melden
  const ende = (p, extra = {}) => {
    const r = S.speicherePartie({ ...p, spielerFarbe: 'w', zuege: ['e2e4', 'e7e5'], modus: p.modus || 'normal' });
    sende('partie:beendet', { laufId: 'lauf-' + p.id, partieId: r.partie.id, wertet: r.wertet, botId: p.botId, ergebnis: p.ergebnis, ...extra });
    return r;
  };
  const KI = '11111111-2222-4333-8444-555555555555';
  const rudi = BOTS.find((b) => b.id === 'rudi');
  try {
    S.speichereModul('liga', W.neuerStand(new Date()));
    await browserPruefe('liga meldet Bot-Sieg an den Server (genau ein Aufruf, ref, ergebnis, bot_elo)', async () => {
      const r = ende(partie('k-sieg')); sende('partie:beendet', { partieId: r.partie.id, wertet: true }); await kurz();
      assert.equal(aufrufe.length, 1); assert.equal(aufrufe[0].name, 'kronen_bot_ergebnis');
      assert.deepEqual(aufrufe[0].daten, { ref: r.partie.id, ergebnis: 'sieg', bot_elo: rudi.elo });
    });
    await browserPruefe('liga meldet nichts fuer eine ungewertete Partie (eigene Stellung)', async () => {
      aufrufe = []; ende(partie('k-eigen', { startFen: '7k/8/5KQ1/8/8/8/8/8 w - - 0 1' }), { wertet: true }); await kurz();
      assert.equal(aufrufe.length, 0);
    });
    await browserPruefe('liga: Netzfehler beim Melden wirft nicht, die lokale Liga bucht trotzdem', async () => {
      aufrufe = []; netzFehlt = true; const n = S.ladeModul('liga').wertung.n;
      ende(partie('k-netz')); await kurz();
      assert.equal(aufrufe.length, 1); assert.equal(S.ladeModul('liga').wertung.n, n + 1);
      netzFehlt = false;
    });
    await browserPruefe('liga meldet KI-Gegner mit Beleg (kronen_ki_ergebnis, nie kronen_bot_ergebnis)', async () => {
      aufrufe = []; ende(partie('k-ki', { ki: true, kiRef: KI, ergebnis: 'remis' })); await kurz();
      assert.deepEqual(aufrufe, [{ name: 'kronen_ki_ergebnis', daten: { ki_ref: KI, ergebnis: 'remis' } }]);
    });
    await browserPruefe('liga meldet einen KI-Gegner ohne Beleg gar nicht', async () => {
      aufrufe = []; ende(partie('k-ki-ohne', { ki: true })); await kurz();
      assert.equal(aufrufe.length, 0);
    });
    // Task 6: Start-Liga. Bis hier hat die lokale Liga gewertete Partien, also eine eigene Elo.
    const UID = sitzung.user.id;
    const k = await import('../js/kronen.js');
    const { setzeKontoFetch } = await import('../js/konto.js');
    const merker = () => S.ladeModul('kronen');
    const vergiss = () => S.speichereModul('kronen', { konto: null, stand: null, startGemeldet: false });
    const starts = () => aufrufe.filter((a) => a.name === 'kronen_start');
    await browserPruefe('setzeStartLiga sendet lokale Elo einmal (zwei Aufrufe, ein RPC), Merker je Konto', async () => {
      aufrufe = []; vergiss(); const elo = S.ladeModul('liga').wertung.wert;
      await Promise.all([k.setzeStartLiga(), k.setzeStartLiga()]); await k.setzeStartLiga();
      assert.deepEqual(aufrufe, [{ name: 'kronen_start', daten: { elo } }]);
      assert.deepEqual(merker(), { konto: UID, stand: null, startGemeldet: true });
    });
    await browserPruefe('setzeStartLiga: offline kein Merker, beim naechsten Mal nachgeholt', async () => {
      aufrufe = []; vergiss(); netzFehlt = true;
      await k.setzeStartLiga(); assert.equal(merker().startGemeldet, false);
      netzFehlt = false; await k.setzeStartLiga();
      assert.equal(starts().length, 2); assert.equal(merker().startGemeldet, true);
    });
    await browserPruefe('setzeStartLiga: KRONEN_START_VORBEI setzt den Merker, KRONEN_EINGABE nicht', async () => {
      aufrufe = []; vergiss(); antwort = { fehler: 'KRONEN_EINGABE' };
      await k.setzeStartLiga(); assert.equal(merker().startGemeldet, false);
      antwort = { fehler: 'KRONEN_START_VORBEI' }; await k.setzeStartLiga();
      assert.equal(starts().length, 2); assert.equal(merker().startGemeldet, true);
      antwort = null;
    });
    await browserPruefe('setzeStartLiga: Merker eines anderen Kontos zaehlt nicht', async () => {
      aufrufe = []; S.speichereModul('kronen', { konto: 'anderes-konto', stand: { kronen: 900 }, startGemeldet: true });
      await k.setzeStartLiga();
      assert.equal(starts().length, 1); assert.deepEqual(merker(), { konto: UID, stand: null, startGemeldet: true });
    });
    await browserPruefe('Liga-Paket startet die Start-Liga bei app:sichtbar', async () => {
      aufrufe = []; vergiss();
      setzeKontoFetch(async () => { throw new Error('offline'); }); // der Konto-Abgleich bei app:sichtbar bleibt so im Test
      try { sende('app:sichtbar', { sichtbar: true }); await kurz(); } finally { setzeKontoFetch(null); }
      assert.equal(starts().length, 1); assert.equal(merker().startGemeldet, true);
    });
    await browserPruefe('setzeStartLiga ohne gewertete Partie sendet nichts', async () => {
      aufrufe = []; vergiss(); const alt = S.ladeModul('liga'); S.speichereModul('liga', W.neuerStand(new Date()));
      try { await k.setzeStartLiga(); } finally { S.speichereModul('liga', alt); }
      assert.equal(aufrufe.length, 0); assert.equal(merker().startGemeldet, false);
    });
    await browserPruefe('liga meldet ohne Konto nichts', async () => {
      aufrufe = []; speicher.delete('schach-arena:konto:sitzung'); ende(partie('k-ohne-konto')); await kurz();
      assert.equal(aufrufe.length, 0);
    });
  } finally {
    setzeOnlineFetch(null);
    globalThis.localStorage = altLager;
    S.setzeSpeicher(null);
  }
}

const PROBE = `
import '../liga/index.js';
import { sende, hoere } from '../../ereignisse.js';
import * as speicher from '../../storage.js';
window.__ligaProbe = { sende, speicher, ereignisse: [] };
hoere('liga:geaendert', d => window.__ligaProbe.ereignisse.push(d));
`;

async function browserTeil(browser, start) {
  for (const [width, height] of [[1180, 820], [390, 844]]) for (const modus of ['hell', 'dunkel']) {
    const name = `${width}x${height} ${modus}`;
    const kontext = await browser.newContext({ viewport: { width, height }, hasTouch: true, isMobile: width < 700, timezoneId: 'Europe/Berlin', reducedMotion: 'reduce', serviceWorkers: 'block' });
    const saat = neu(); saat.wertung.wert = 1190; saat.wertung.n = 9; saat.klasse = { erreicht: 1, momente: [1] };
    saat.saison.punkte = 99; saat.kurve = [[8, 1170], [9, 1190]];
    await kontext.addInitScript(({ saat, modus }) => {
      const EchteDate = Date;
      window.__ligaZeit = new EchteDate(2026, 9, 23, 12).getTime();
      window.Date = class extends EchteDate {
        constructor(...args) { super(...(args.length ? args : [window.__ligaZeit])); }
        static now() { return window.__ligaZeit; }
      };
      if (!sessionStorage.getItem('liga-test-bereit')) {
        localStorage.clear();
        localStorage.setItem('schach-arena:v1:modul:liga', JSON.stringify(saat));
        localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ modus, bewegung: 'aus', klang: false, duellIntro: 'aus', haltenAufgeben: false }));
        const bots = Object.fromEntries(['benno', 'hilde', 'kalle', 'lisa'].map((id) => [id, { sterne: [true, true, true], partien: 1, siege: 1, remis: 0, niederlagen: 0 }]));
        localStorage.setItem('schach-arena:v1:fortschritt', JSON.stringify({ bots, brillanteZuege: [] }));
        sessionStorage.setItem('liga-test-bereit', 'ja');
      }
    }, { saat, modus });
    const page = await kontext.newPage(), fehler = [];
    page.on('pageerror', (e) => fehler.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/favicon/.test(m.location()?.url || '')) fehler.push(m.text()); });
    await page.route('**/js/pakete/liga-probe/index.js', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: PROBE }));
    try {
      await page.goto(start + '?test&erw=pakete/liga-probe/index#arena');
      await page.waitForSelector('.knoten');
      // Eine Liga (Flo 08.11.2026): die Bots-Seite zeigt keine Saison-Karte mehr; der alte Stand wird beim Start beendet
      await browserPruefe(name + ': keine Saison-Karte auf der Bots-Seite, alter Stand beim Start beendet, Saison 1 als Abzeichen', async () => {
        assert.equal(await page.locator('.liga-karte, .liga-titel, .liga-leiter').count(), 0);
        const st = await page.evaluate(() => window.__ligaProbe.speicher.ladeModul('liga'));
        assert.equal(st.saisonEnde, true); assert.equal(st.saison.nr, 0); assert.equal(st.wertung.wert, 1190);
        assert.deepEqual(st.archiv.map((a) => [a.nr, a.punkte]), [[1, 99]]);
        assert.equal(await page.locator('html').getAttribute('data-modus'), modus);
        assert.equal(await page.locator('html').getAttribute('data-bewegung'), 'aus');
      });
      if (process.env.BILDER) {
        mkdirSync(process.env.BILDER, { recursive: true });
        await page.screenshot({ path: path.join(process.env.BILDER, `liga-${width}-${modus}.png`) });
      }
      await page.evaluate(() => {
        const plan = { e2e4: 'e7e5', f1c4: 'b8c6', d1h5: 'g8f6' };
        window.__test = { botZug: () => { const v = window.__partie.chess().history({ verbose: true }); return plan[v[v.length - 1].lan] || null; } };
        window.__app.gehe('partie', { botId: 'rudi', farbe: 'w' });
      });
      await page.waitForSelector('.screen.partie .brett-felder');
      await browserPruefe(name + ': Liga zeigt waehrend der Partie nichts am Brett', async () => assert.equal(await page.locator('.screen.partie .liga-karte, .screen.partie .liga-wertung').count(), 0));
      for (const uci of ['e2e4', 'f1c4', 'd1h5', 'h5f7']) {
        await page.waitForFunction(() => window.__partie?.bereit && window.__partie.phase() === 'flo', null, { timeout: 30000 });
        await page.locator(`.screen.partie .brett-felder .feld[data-feld="${uci.slice(0, 2)}"]`).tap();
        await page.locator(`.screen.partie .brett-felder .feld[data-feld="${uci.slice(2, 4)}"]`).tap();
        if (await page.locator('.screen.partie .brett .lage.vorschau').count()) await page.locator(`.screen.partie .brett-felder .feld[data-feld="${uci.slice(2, 4)}"]`).tap();
      }
      // Sieg-Blatt C (Flo 09.11.): nach dem Sieg steht die Wertung nur im DOM, im Blatt ein Verweis in die Liga
      await page.waitForSelector('.ergebnis-overlay.gefuellt .liga-abrechnung', { state: 'attached', timeout: 60000 });
      await page.waitForFunction(() => window.__ligaProbe.ereignisse.some((d) => d.wertung.n === 10), null, { timeout: 30000 });
      await browserPruefe(name + ': echte Partie: Abrechnung nur mit der Wertung, keine Liga-Punkte und keine Klassen-Feier', async () => {
        assert.match(await page.locator('.liga-abrechnung').innerText(), /^Liga-Wertung \+\d+$/);
        assert.equal(await page.locator('.liga-abrechnung .liga-erg-stand, .liga-abrechnung .liga-erg-wappen').count(), 0);
        assert.equal(await page.locator('.liga-abrechnung').isVisible(), false);
        assert.equal(await page.locator('.erg-liga-verweis').isVisible(), true);
        const feier = await page.locator('.erg-feier').count() ? await page.locator('.erg-feier').innerText() : '';
        assert.ok(!/klasse|Liga \+/i.test(feier), feier);
        const st = await page.evaluate(() => window.__ligaProbe.speicher.ladeModul('liga'));
        assert.equal(st.saison.punkte, 0); assert.deepEqual(st.meisterschaft, {}); assert.equal(st.klasse.erreicht, 2, 'Klasse rechnet still weiter');
      });
      await page.waitForFunction(() => {
        const p = window.__ligaProbe.speicher.ladePartien().find((p) => p.botId === 'rudi');
        return p?.analysiert;
      }, null, { timeout: 60000 });
      await browserPruefe(name + ': doppelte Ende- und Analyse-Ereignisse buchen nichts nach', async () => {
        assert.ok(await page.evaluate(() => {
          const t = window.__ligaProbe, p = t.speicher.ladePartien().find((p) => p.botId === 'rudi');
          const vorher = JSON.stringify(t.speicher.ladeModul('liga'));
          t.sende('partie:beendet', { partieId: p.id, wertet: true });
          t.sende('partie:analysiert', { partieId: p.id, wertet: true });
          return JSON.stringify(t.speicher.ladeModul('liga')) === vorher;
        }));
      });
      await page.evaluate(() => window.__app.gehe('verlauf'));
      await page.waitForSelector('.liga-verlauf');
      await browserPruefe(name + ': Verlaufskarte mit Wertung als Zahl (ohne Klassennamen), Mini-Kurve und Saison-Abzeichen', async () => {
        assert.equal(await page.locator('.liga-kurve svg polyline').count(), 1);
        const wert = await page.locator('.liga-verlauf .liga-wertung').innerText();
        assert.match(wert, /1211/); assert.ok(!/klasse/i.test(wert), wert);
        assert.match(await page.locator('.liga-archiv').innerText(), /Saison 1: Holz/);
      });
      await page.reload(); await page.waitForSelector('.liga-verlauf');
      await browserPruefe(name + ': Neuladen bewahrt Wertung, Kurve und Abzeichen', async () => {
        assert.match(await page.locator('.liga-verlauf .liga-wertung').innerText(), /1211/);
        assert.equal(await page.locator('.liga-archiv li').count(), 1);
      });
      await page.evaluate(() => {
        window.__ligaZeit = new Date(2027, 0, 11, 4, 0, 1).getTime();
        window.__ligaProbe.sende('app:sichtbar', { sichtbar: true });
      });
      await browserPruefe(name + ': ein spaeterer Saisonstichtag startet keine neue Saison', async () => {
        const st = await page.evaluate(() => window.__ligaProbe.speicher.ladeModul('liga'));
        assert.equal(st.saison.nr, 0); assert.equal(st.archiv.length, 1);
      });
      await browserPruefe(name + ': keine JavaScript- oder Konsolenfehler', async () => assert.deepEqual(fehler, []));
    } finally { await kontext.close(); }
  }
}

// Wochen-Gruppen (07.11.2026): Reiter "Gruppe" der Bestenliste mit abgefangenem Server (liga_meine_gruppe).
// Gruppe Laeufer II (Stufe 7), du auf Platz 3, 27 Menschen und 3 Bots ("KI"), dazu eine gemerkte Belohnung.
function probeGruppe({ platz = 3, stufe = 7, botKi = { genutzt: 120, max: 300 } } = {}) {
  const mitglieder = [];
  for (let p = 1; p <= 30; p++) {
    const ki = p === 6 || p === 18 || p === 27;
    mitglieder.push({ platz: p, name: p === platz ? 'flo' : (ki ? ['Rosa', 'Udo', 'Kira'][[6, 18, 27].indexOf(p)] : 'Spieler ' + p),
      kronen: 400 - p * 12, ki, ich: p === platz });
  }
  // G-002: Profilbild und Banner (supabase/liga-bild-schema.sql); Platz 4 traegt ein unbekanntes Banner -> Start-Banner
  Object.assign(mitglieder[1], { motiv: 'Q', grund: 'welt-1', rahmen: 'liga-2', banner: 'saison-gold' });
  Object.assign(mitglieder[3], { motiv: 'karo', grund: 'standard', rahmen: 'ohne', banner: 'fremd' });
  return { woche: '2026-11-02', ende: '2026-11-08', stufe, gruppe: 41, platz, n: 30, mitglieder,
    belohnung: [], offen: [{ woche: '2026-10-26', platz: 4, art: 'taler', menge: 80 }], bot_ki: botKi };
}
const SUPA = 'https://usaamcqypmvgqmsbfecb.supabase.co';
const GR_UID = '0f8b6c1e-2d3a-4b5c-8d9e-0a1b2c3d4e5f';
const GR_SITZUNG = { access_token: 'a.' + Buffer.from(JSON.stringify({ sub: GR_UID })).toString('base64url') + '.x', refresh_token: 'r1',
  expires_at: 9999999999, user: { id: GR_UID, email: 'probe@example.invalid' } };

async function gruppeSeite(browser, start, { antwort, ligen = null, konto = true, w = 390, h = 844, modus = 'hell', sprache = 'de' }) {
  const kontext = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: w < 700, reducedMotion: 'reduce', serviceWorkers: 'block' });
  const page = await kontext.newPage();
  const fehler = [];
  page.on('pageerror', (e) => fehler.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) fehler.push(m.text()); });
  const rpc = [];
  await page.route(SUPA + '/**', (r) => {
    const name = (r.request().url().match(/\/rpc\/([a-z_]+)/) || [])[1];
    if (name) rpc.push(name);
    if (name === 'liga_meine_gruppe') {
      if (antwort === 'fehler') return r.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"kaputt"}' });
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(antwort) });
    }
    // Zwei Ligen (G-005): ligen = { online, raetsel } je Antwort, 'fehlt' = Funktion noch nicht eingespielt (404 PGRST202)
    if (name === 'liga_gruppe' && ligen) {
      const liga = r.request().postDataJSON()?.liga;
      if (ligen === 'fehlt') return r.fulfill({ status: 404, contentType: 'application/json', body: '{"code":"PGRST202","message":"Could not find the function"}' });
      if (ligen[liga] === 'fehler') return r.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"kaputt"}' });
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ligen[liga] ?? null) });
    }
    return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  await kontext.addInitScript(({ sitzung, modus, sprache }) => {
    if (sessionStorage.getItem('gruppe-probe')) return;
    sessionStorage.setItem('gruppe-probe', '1');
    localStorage.clear();
    if (sitzung) localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(sitzung));
    localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ modus, sprache, spracheGewaehlt: true, bewegung: 'aus', klang: false,
      duellIntro: 'aus' }));
  }, { sitzung: konto ? GR_SITZUNG : null, modus, sprache });
  await page.goto(start + '?test#bestenliste');
  await page.waitForSelector('.lg-gr[data-zustand]:not([data-zustand="laedt"])', { timeout: 15000 });
  return { kontext, page, fehler, rpc };
}

async function gruppeTeil(browser, start) {
  {
    const { kontext, page, fehler, rpc } = await gruppeSeite(browser, start, { antwort: probeGruppe() });
    try {
      await browserPruefe('Gruppe: ist der erste Reiter und Standard, Freunde gleich dahinter, ohne Zeitfenster', async () => {
        const reiter = await page.locator('.bl-steuer-reiter [role="radio"], .bl-steuer-reiter button').allInnerTexts();
        assert.deepEqual(reiter.slice(0, 2).map((x) => x.trim()), ['Gruppe', 'Freunde'], JSON.stringify(reiter));
        assert.equal(await page.locator('.bl-screen').getAttribute('data-reiter'), 'gruppe');
        assert.ok(await page.locator('.bl-steuer-fenster').isHidden());
        assert.ok(rpc.includes('liga_meine_gruppe'));
      });
      await browserPruefe('Gruppe: Buehne mit Wappen, "Läufer II", "Platz 3 von 30", Aufstiegskurs, naechste Stufe Läufer I', async () => {
        assert.equal(await page.locator('.lg-gr-titel h2').innerText(), 'Läufer II');
        assert.equal(await page.locator('.lg-gr-titel p').innerText(), 'Platz 3 von 30');
        assert.match(await page.locator('.lg-gr-zone').innerText(), /Auf Aufstiegskurs/);
        assert.match(await page.locator('.lg-gr-naechste').innerText(), /Läufer I$/);
        assert.match(await page.locator('.lg-gr-wappen').getAttribute('src'), /assets\/liga\/laeufer\.svg$/);
        assert.ok(await page.locator('.lg-gr-wappen').evaluate((i) => i.complete && i.naturalWidth > 0), 'Wappen geladen');
        assert.equal(await page.locator('.lg-gr-ende').innerText(), 'Ende am Sonntag, 08.11.');
        assert.match(await page.locator('.lg-gr-offen').innerText(), /Gemerkt: 1 Belohnung aus einer früheren Woche/);
        assert.equal(await page.locator('.lg-gr-botvoll').count(), 0, '120 von 300 Bot-Kronen: kein Hinweis');
      });
      await browserPruefe('Gruppe: Abschnitte 5 / 20 / 5, "Eine Stufe tiefer" statt Druck-Wort, eigene Zeile gold', async () => {
        const n = (z) => page.locator(`.lg-gr-abschnitt[data-zone="${z}"] .lg-gr-zeile`).count();
        assert.deepEqual([await n('auf'), await n('bleib'), await n('ab')], [5, 20, 5]);
        assert.equal(await page.locator('.lg-gr-abschnitt[data-zone="ab"] h3').innerText(), 'Eine Stufe tiefer');
        assert.ok(!/Abstieg/i.test(await page.locator('.lg-gr').innerText()));
        assert.equal(await page.locator('.lg-gr-zeile.ich').count(), 1);
        assert.equal(await page.locator('.lg-gr-zeile.ich .lg-gr-platz').innerText(), '3');
        assert.equal(await page.locator('.lg-gr-zeile.ich .lg-gr-name b').innerText(), 'Du');
      });
      await browserPruefe('Gruppe: Bots tragen "KI", Bleiben eingeklappt bis zum Knopf', async () => {
        assert.equal(await page.locator('.lg-gr-zeile[data-ki] .lg-gr-ki').count(), 3);
        assert.equal(await page.locator('.lg-gr-abschnitt[data-zone="bleib"] .lg-gr-zeile:visible').count(), 1);
        const mehr = page.locator('.lg-gr-mehr');
        assert.equal(await mehr.innerText(), '19 weitere anzeigen');
        await mehr.click();
        assert.equal(await page.locator('.lg-gr-abschnitt[data-zone="bleib"] .lg-gr-zeile:visible').count(), 20);
        assert.equal(await mehr.getAttribute('aria-expanded'), 'true');
      });
      await browserPruefe('Gruppe: Belohnungs-Kacheln bis Platz 20 (Banner fuer Platz 1), Tipp zeigt den Inhalt', async () => {
        assert.equal(await page.locator('.lg-gr-lohn').count(), 20);
        assert.equal(await page.locator('.lg-gr-zeile[data-platz="1"] .lg-gr-lohn').getAttribute('data-art'), 'banner');
        const lohn = page.locator('.lg-gr-zeile.ich .lg-gr-lohn');
        await lohn.click();
        assert.equal(await lohn.getAttribute('aria-expanded'), 'true');
        assert.match(await page.locator('.lg-gr-zeile.ich .lg-gr-info').innerText(), /Belohnung für Platz 3: 100 Taler/);
        assert.equal(await page.locator('.lg-gr-zeile[data-platz="21"] .lg-gr-lohn').count(), 0);
      });
      await browserPruefe('Gruppe (G-002): Bild und Banner-Streifen je Mensch, Initialen ohne Bild, unbekanntes Banner wird Start', async () => {
        const z2 = page.locator('.lg-gr-zeile[data-platz="2"]');
        assert.equal(await z2.getAttribute('data-banner'), 'saison-gold');
        assert.equal(await z2.locator('.lg-gr-streifen').count(), 1);
        assert.equal(await z2.locator('.lg-gr-avatar.bild').count(), 1);
        assert.equal(await page.locator('.lg-gr-zeile[data-platz="4"]').getAttribute('data-banner'), 'start');
        assert.equal(await page.locator('.lg-gr-zeile[data-platz="1"] .lg-gr-avatar.bild').count(), 0, 'ohne Bild: Initialen');
        const hoehen = await page.locator('.lg-gr-zeile:visible .lg-gr-wer').evaluateAll((l) => l.map((b) => b.getBoundingClientRect().height));
        assert.ok(hoehen.length > 0 && hoehen.every((x) => x >= 44), JSON.stringify(hoehen));
      });
      await browserPruefe('Gruppe (G-002): Tipp auf eine Zeile oeffnet die Mini-Karte mit Platz, Kronen und Stufe', async () => {
        await page.locator('.lg-gr-zeile[data-platz="2"] .lg-gr-wer').click();
        await page.waitForSelector('.lg-mini-blatt');
        assert.equal((await page.locator('.lg-mini-blatt h3').innerText()).trim(), 'Spieler 2');
        const werte = await page.locator('.lg-mini-blatt .lg-mini-werte').innerText();
        assert.match(werte, /Platz[\s\S]*2/);
        assert.match(werte, /376/);
        assert.match(werte, /Läufer II/);
        assert.match(await page.locator('.lg-mini-satz').innerText(), /Titel und Erfolge sieht nur/);
        assert.equal(await page.locator('.lg-mini-blatt .lg-mini-av.bild').count(), 1);
        await page.locator('.lg-mini-blatt .sheet-knoepfe button').click();
        await page.waitForSelector('.lg-mini-blatt', { state: 'detached' });
        await page.locator('.lg-gr-zeile[data-platz="6"] .lg-gr-wer').click();
        await page.waitForSelector('.lg-mini-blatt');
        assert.equal(await page.locator('.lg-mini-blatt .lg-mini-ki').count(), 1);
        await page.locator('.lg-mini-blatt .sheet-knoepfe button').click();
        await page.waitForSelector('.lg-mini-blatt', { state: 'detached' });
      });
      await browserPruefe('Gruppe: keine Konsolenfehler, kein NaN, keine Kennung', async () => {
        assert.deepEqual(fehler, []);
        const text = await page.locator('.lg-gr').innerText();
        assert.ok(!/NaN|undefined|null|[0-9a-f]{8}-[0-9a-f]{4}-/.test(text), text.slice(0, 200));
      });
    } finally { await kontext.close(); }
  }
  {
    const { kontext, page } = await gruppeSeite(browser, start, { antwort: probeGruppe(), konto: false });
    try {
      await browserPruefe('Gruppe ohne Konto: ruhige Karte mit Link zum Konto, kein Server-Abruf der Gruppe', async () => {
        assert.equal(await page.locator('.lg-gr').getAttribute('data-zustand'), 'ohne-konto');
        assert.match(await page.locator('.lg-gr-karte p').innerText(), /Gruppe mit 30 Plätzen/);
        assert.equal(await page.locator('.lg-gr-konto').getAttribute('href'), '#einstellungen/konto');
      });
      // Design-Durchsicht U 09.11.2026: auch ohne Konto soll man lesen koennen, wie Kronen zaehlen
      await browserPruefe('Gruppe ohne Konto: Regeln eingeklappt unter der Karte', async () => {
        assert.equal(await page.locator('.lg-gr details.lg-gr-regeln').count(), 1);
        assert.equal(await page.locator('.lg-gr details.lg-gr-regeln').getAttribute('open'), null);
      });
      // Kundenblick 09.11.2026: ohne Pfeil sah „So zählen Kronen“ wie ein Satz aus, nicht wie etwas zum Aufklappen
      await browserPruefe('Gruppe ohne Konto: „So zählen Kronen“ zeigt einen Aufklapp-Pfeil, der sich beim Öffnen dreht', async () => {
        const pfeil = () => page.evaluate(() => { const c = getComputedStyle(document.querySelector('.lg-gr-regeln summary'), '::after');
          return { inhalt: c.content, rand: c.borderRightStyle, drehung: c.transform }; });
        const zu = await pfeil();
        assert.ok(zu.inhalt !== 'none' && zu.rand === 'solid', JSON.stringify(zu));
        await page.locator('.lg-gr-regeln summary').click();
        await page.waitForTimeout(300);
        assert.notEqual((await pfeil()).drehung, zu.drehung);
      });
    } finally { await kontext.close(); }
  }
  {
    const leer = { woche: '2026-11-02', ende: '2026-11-08', stufe: 3, gruppe: null, platz: null, n: 30, mitglieder: [], belohnung: [], offen: [] };
    const { kontext, page } = await gruppeSeite(browser, start, { antwort: leer });
    try {
      await browserPruefe('Gruppe ohne Partie diese Woche: Buehne Springer III mit Einladung, keine Liste', async () => {
        assert.equal(await page.locator('.lg-gr').getAttribute('data-zustand'), 'leer');
        assert.equal(await page.locator('.lg-gr-titel h2').innerText(), 'Springer III');
        assert.match(await page.locator('.lg-gr-titel p').innerText(), /Spiel eine Partie/);
        assert.equal(await page.locator('.lg-gr-liste').count(), 0);
      });
    } finally { await kontext.close(); }
  }
  {
    const { kontext, page, fehler } = await gruppeSeite(browser, start, { antwort: 'fehler' });
    try {
      await browserPruefe('Gruppe bei Server-Fehler: ruhige Fehlerkarte, App laeuft weiter', async () => {
        assert.equal(await page.locator('.lg-gr').getAttribute('data-zustand'), 'fehler');
        assert.ok(!fehler.some((f) => /pageerror|TypeError/.test(f)), fehler.join(' | '));
      });
    } finally { await kontext.close(); }
  }
  {
    const { kontext, page } = await gruppeSeite(browser, start, { antwort: probeGruppe({ platz: 28, stufe: 17, botKi: { genutzt: 300, max: 300 } }),
      sprache: 'en', modus: 'dunkel' });
    try {
      await browserPruefe('Gruppe englisch, dunkel, Koenig I auf Platz 28: "King I", "Place 28 of 30", ruhiges Abzeichen', async () => {
        assert.equal(await page.locator('.lg-gr-titel h2').innerText(), 'King I');
        assert.equal(await page.locator('.lg-gr-titel p').innerText(), 'Place 28 of 30');
        assert.equal(await page.locator('.lg-gr-zone').getAttribute('data-zone'), 'ab');
        assert.match(await page.locator('.lg-gr-zone').innerText(), /Everything is open until Sunday/);
        assert.equal(await page.locator('.lg-gr-naechste').count(), 0, 'ueber Koenig I gibt es nichts');
        assert.equal(await page.locator('.lg-gr-abschnitt[data-zone="auf"]').count(), 0, 'in Koenig I steigt niemand auf');
      });
      await browserPruefe('Gruppe: Bot-Kronen-Deckel voll (300 von 300): ruhiger Hinweis in Grau wie "Ends on Sunday", nie rot', async () => {
        assert.equal(await page.locator('.lg-gr-botvoll').innerText(), 'Bot crowns are full for this week. Online games still count.');
        const farbe = (s) => page.locator(s).evaluate((e) => getComputedStyle(e).color);
        assert.equal(await farbe('.lg-gr-botvoll'), await farbe('.lg-gr-ende'));
      });
    } finally { await kontext.close(); }
  }
  // Zwei Ligen (G-005, Konzept Zwei Ligen Abschnitt 4): liga_gruppe('online'/'raetsel') liefert beide -> Leiste mit zwei Reitern
  {
    const raetsel = { ...probeGruppe({ platz: 9, stufe: 4 }), liga: 'raetsel', offen: [] };
    const { kontext, page, fehler, rpc } = await gruppeSeite(browser, start, { antwort: probeGruppe(),
      ligen: { online: { ...probeGruppe(), liga: 'online' }, raetsel } });
    try {
      await browserPruefe('Zwei Ligen: Leiste "Online | Rätsel" mit Platz je Liga, Online gewählt, liga_meine_gruppe nicht gefragt', async () => {
        assert.deepEqual((await page.locator('.lg-liga b').allInnerTexts()).map((x) => x.trim()), ['Online', 'Rätsel']);
        assert.deepEqual((await page.locator('.lg-liga small').allInnerTexts()).map((x) => x.trim()), ['Platz 3', 'Platz 9']);
        assert.equal(await page.locator('.lg-liga[data-liga="online"]').getAttribute('aria-selected'), 'true');
        assert.equal(await page.locator('.lg-liga[data-liga="online"]').getAttribute('data-zone'), 'auf');
        assert.equal(await page.locator('[role="tablist"].lg-ligen [role="tab"]').count(), 2);
        assert.equal(await page.locator('.lg-gr').getAttribute('data-liga'), 'online');
        assert.equal(await page.locator('.lg-gr-titel h2').innerText(), 'Läufer II');
        assert.ok(rpc.includes('liga_gruppe') && !rpc.includes('liga_meine_gruppe'), JSON.stringify(rpc));
        assert.match(await page.locator('.lg-gr-regeln').evaluate((d) => d.textContent), /zwei Ligen/);
      });
      await browserPruefe('Zwei Ligen: Tipp auf Rätsel zeigt die Rätsel-Gruppe (Springer II, Platz 9), Pfeiltaste zurück auf Online', async () => {
        await page.locator('.lg-liga[data-liga="raetsel"]').click();
        assert.equal(await page.locator('.lg-gr').getAttribute('data-liga'), 'raetsel');
        assert.equal(await page.locator('.lg-gr-titel h2').innerText(), 'Springer II');
        assert.equal(await page.locator('.lg-gr-titel p').innerText(), 'Platz 9 von 30');
        assert.equal(await page.locator('.lg-liga[data-liga="raetsel"]').getAttribute('aria-selected'), 'true');
        assert.equal(await page.locator('.lg-ligen-feld').getAttribute('aria-labelledby'), 'lg-liga-raetsel');
        await page.locator('.lg-liga[data-liga="raetsel"]').focus();
        await page.keyboard.press('ArrowLeft');
        assert.equal(await page.locator('.lg-gr-titel h2').innerText(), 'Läufer II');
        assert.equal(await page.evaluate(() => document.activeElement?.dataset.liga), 'online', 'Fokus folgt dem Reiter');
      });
      await browserPruefe('Zwei Ligen: keine JavaScript- oder Konsolenfehler', async () => assert.deepEqual(fehler, []));
    } finally { await kontext.close(); }
  }
  // Ohne neues SQL (liga_gruppe fehlt, 404): wie heute ein Reiter aus liga_meine_gruppe, keine Leiste
  {
    const { kontext, page, fehler, rpc } = await gruppeSeite(browser, start, { antwort: probeGruppe(), ligen: 'fehlt' });
    try {
      await browserPruefe('Zwei Ligen ohne SQL: liga_gruppe fehlt -> Rückfall auf liga_meine_gruppe, eine Liga, keine Leiste', async () => {
        assert.ok(rpc.includes('liga_gruppe') && rpc.includes('liga_meine_gruppe'), JSON.stringify(rpc));
        assert.equal(await page.locator('.lg-ligen').count(), 0);
        assert.equal(await page.locator('.lg-gr').getAttribute('data-liga'), null);
        assert.equal(await page.locator('.lg-gr-titel h2').innerText(), 'Läufer II');
        assert.doesNotMatch(await page.locator('.lg-gr-regeln').evaluate((d) => d.textContent), /zwei Ligen/);
      });
      await browserPruefe('Zwei Ligen ohne SQL: keine JavaScript- oder Konsolenfehler', async () => assert.deepEqual(fehler, []));
    } finally { await kontext.close(); }
  }
  // Nur die Raetsel-Liga scheitert: Online bleibt allein, kein halber Reiter
  {
    const { kontext, page, rpc } = await gruppeSeite(browser, start, { antwort: probeGruppe(),
      ligen: { online: { ...probeGruppe(), liga: 'online' }, raetsel: 'fehler' } });
    try {
      await browserPruefe('Zwei Ligen: Rätsel-Liga gibt einen Fehler -> nur Online, keine Leiste, kein liga_meine_gruppe', async () => {
        assert.equal(await page.locator('.lg-ligen').count(), 0);
        assert.equal(await page.locator('.lg-gr-titel h2').innerText(), 'Läufer II');
        assert.ok(!rpc.includes('liga_meine_gruppe'), JSON.stringify(rpc));
      });
    } finally { await kontext.close(); }
  }
}

let server, browser;
try {
  nodeTeil();
  const EchteDate = Date;
  try {
    // Auch die Ereignis-Anbindung bleibt unabhaengig vom Datum des Testrechners.
    globalThis.Date = class extends EchteDate {
      constructor(...args) { super(...(args.length ? args : [DATUM.getTime()])); }
      static now() { return DATUM.getTime(); }
    };
    await integrationsTeil();
    await kronenMeldeTeil();
  } finally { globalThis.Date = EchteDate; }
  if (!process.argv.includes('--nur-node')) {
    let pw;
    for (const kandidat of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
      try { pw = require(kandidat); break; } catch (e) { /* naechster Installationspfad */ }
    }
    if (!pw) throw new Error('Playwright nicht gefunden (PLAYWRIGHT_PFAD setzen)');
    server = createServer((req, res) => {
      const rel = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      const voll = path.resolve(WURZEL, '.' + (rel === '/' ? '/index.html' : rel));
      if (!voll.startsWith(WURZEL + path.sep)) { res.writeHead(403).end(); return; }
      try {
        const daten = readFileSync(voll);
        const typen = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.woff2': 'font/woff2', '.json': 'application/json', '.mp3': 'audio/mpeg' };
        res.writeHead(200, { 'Content-Type': typen[path.extname(voll)] || 'application/octet-stream' }); res.end(daten);
      } catch (e) { res.writeHead(404).end(); }
    });
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(8847, '127.0.0.1', resolve); });
    browser = await browserTyp(pw).launch();
    await browserTeil(browser, 'http://127.0.0.1:8847/index.html');
    await gruppeTeil(browser, 'http://127.0.0.1:8847/index.html');
  }
} catch (e) {
  ergebnisse.push({ name: 'Testlauf', ok: false }); console.error('FEHLER Testlauf: ' + e.stack);
} finally {
  if (browser) await browser.close();
  if (server?.listening) await new Promise((r) => server.close(r));
}
const falsch = ergebnisse.filter((r) => !r.ok);
console.log(`\n${ergebnisse.length - falsch.length}/${ergebnisse.length} bestanden`);
process.exitCode = falsch.length ? 1 : 0;
