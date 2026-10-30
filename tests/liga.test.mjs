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
  pruefe('Echte Anbindung: normale Partie, Duplikat und finale Analyse', () => {
    const vorher = S.ladeModul('liga').saison.punkte;
    const r = ende(partie('echt-normal')); sende('partie:beendet', { partieId: r.partie.id, wertet: true });
    assert.equal(S.ladeModul('liga').wertung.n, 2);
    S.ergaenzeAnalyse(r.partie.id, { zuege: [], genauigkeit: { w: 85, b: 70 } });
    sende('partie:analysiert', { partieId: r.partie.id, wertet: true });
    const st = S.ladeModul('liga'); assert.ok(st.saison.punkte > vorher);
    sende('partie:analysiert', { partieId: r.partie.id, wertet: true }); assert.deepEqual(S.ladeModul('liga'), st);
  });
  pruefe('Echte Anbindung: alte Analyse ohne Beleg startet keine Wertung', () => {
    const r = S.speicherePartie(partie('vor-paket')); const n = S.ladeModul('liga').wertung.n;
    sende('partie:analysiert', { partieId: r.partie.id, wertet: true, review: { genauigkeit: { w: 99 } } });
    assert.equal(S.ladeModul('liga').wertung.n, n);
  });
  pruefe('Echte Anbindung: beide Aufstiege laufen durch das Feier-Budget', () => {
    const st = frisch(); st.wertung = { ...st.wertung, wert: 1190, n: 9 }; st.klasse = { erreicht: 1, momente: [1] }; st.saison.punkte = 99;
    S.speichereModul('liga', st); ende(partie('moment'));
    assert.equal(S.ladeModul('liga').klasse.erreicht, 2); assert.equal(S.ladeModul('liga').saison.stufe, 1);
    const feier = fuerOverlay('moment'); assert.ok(feier.length <= 3); assert.equal(feier.filter((f) => f.art === 'gross').length, 1);
    assert.equal(feier[0].titel, 'AUFSTIEG: Läuferklasse'); assert.equal(feier[0].klang, 'rekord');
    assert.equal(ereignis.aufstieg, true);
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
      await page.waitForSelector('.liga-titel');
      // Flo 30.10. (Entwurf Bestenliste): vorn nur Liga, Saison mit Enddatum (kein Countdown), Weg und Regel;
      // Wertung und Klasse stehen in den Details
      await browserPruefe(name + ': Saison-Karte vorn nur Liga, Enddatum, Weg und Regel; Wertung und Klasse in den Details', async () => {
        assert.match(await page.locator('.liga-titel').innerText(), /^Liga Holz$/);
        assert.match(await page.locator('.liga-unter').innerText(), /^Saison 1 · bis 10\. Januar$/);
        assert.match(await page.locator('.liga-weg').innerText(), /von 100 Punkten bis Bronze/);
        assert.match(await page.locator('.liga-regel').innerText(), /Sieg 3 Punkte · Remis 1 Punkt/);
        assert.ok(!/noch \d+ Tag/.test(await page.locator('.liga-karte').innerText()), 'kein Countdown');
        assert.ok(await page.locator('.liga-karte .liga-wertung').isHidden(), 'Wertung erst in den Details');
        assert.match(await page.locator('.liga-karte .liga-wertung').textContent(), /Springerklasse.*1190.*111.*vorläufig/);
        assert.equal(await page.locator('.kopf-chips .liga-karte').count(), 0);
      });
      await page.locator('.liga-summary').tap();
      await browserPruefe(name + ': Details mit Kreuztabelle und ehrlichem Verlustschutz', async () => {
        assert.equal(await page.locator('.liga-tabelle tbody tr').count(), 30);
        assert.match(await page.locator('.liga-details').innerText(), /Verlustschutz/);
        assert.equal(await page.locator('html').getAttribute('data-modus'), modus);
        assert.equal(await page.locator('html').getAttribute('data-bewegung'), 'aus');
      });
      await browserPruefe(name + ': Saison-Karte passt ohne horizontalen Ueberlauf', async () => {
        assert.ok(await page.locator('.liga-karte').evaluate((e) => e.scrollWidth <= e.clientWidth + 1));
        const box = await page.locator('.liga-karte').boundingBox(); assert.ok(box.x >= -1 && box.x + box.width <= width + 1);
      });
      await page.locator('.liga-summary').tap();
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
      await page.waitForSelector('.ergebnis-overlay.gefuellt .liga-abrechnung', { timeout: 60000 });
      await page.waitForFunction(() => window.__ligaProbe.ereignisse.some((d) => d.wertung.n === 10), null, { timeout: 30000 });
      await browserPruefe(name + ': echte Partie bucht Liga-Zeile und belegten Klassen-Aufstieg', async () => {
        // Liga als Karte (Flo 30.10. abends): Stand, Aenderung und Wappen; die Summe liest die Bedienhilfe im Label
        assert.match(await page.locator('.liga-abrechnung').getAttribute('title'), /^Liga \+\d+ · Bronze$/);
        assert.match(await page.locator('.liga-abrechnung .liga-erg-stand').innerText(), /^Bronze · \d+ Punkte$/);
        assert.equal(await page.locator('.liga-abrechnung .liga-erg-wappen svg').count(), 1);
        assert.match(await page.locator('.erg-feier').innerText(), /AUFSTIEG: Läuferklasse/);
        assert.equal(await page.locator('.erg-feier .gross').count(), 1);
        assert.ok(await page.locator('.erg-feier .erg-f-zeile').count() <= 3);
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
      // Welten: nach dem Sieg ueber Thorsten (Endgegner Welt 2) zeigt die Arena die Turmstadt; Thorsten steht in Welt 2
      await page.evaluate(() => window.__app.gehe('arena', { welt: 2 }));
      await page.waitForSelector('.liga-bilanz');
      await page.locator('.knoten[data-bot="rudi"]').tap();
      await browserPruefe(name + ': Bot-Bilanz und Vereinsmeisterschaft zeigen den echten Sieg', async () => {
        assert.match(await page.locator('.liga-bilanz').innerText(), /Thorsten: 1 Sieg/);
        assert.match(await page.locator('.liga-karte .liga-club').textContent(), /1 von 30 Bots geschlagen/);
      });
      await page.evaluate(() => window.__app.gehe('verlauf'));
      await page.waitForSelector('.liga-verlauf');
      await browserPruefe(name + ': Verlaufskarte mit Mini-Kurve', async () => assert.equal(await page.locator('.liga-kurve svg polyline').count(), 1));
      await page.reload(); await page.waitForSelector('.liga-verlauf');
      await browserPruefe(name + ': Neuladen bewahrt Klasse, Wertung und Kurve', async () => {
        assert.match(await page.locator('.liga-verlauf .liga-wertung').innerText(), /Läuferklasse.*1211/);
      });
      await page.evaluate(() => {
        window.__test = { botAnhalten: true }; window.__app.gehe('partie', { botId: 'rudi', farbe: 'w' });
      });
      await page.waitForFunction(() => window.__partie?.bereit);
      await page.evaluate(() => {
        window.__ligaZeit = new Date(2027, 0, 11, 4, 0, 1).getTime();
        window.__ligaProbe.sende('app:sichtbar', { sichtbar: true });
      });
      await browserPruefe(name + ': Saisonwechsel unterbricht keine laufende Partie', async () => {
        assert.equal(await page.locator('.screen.partie').count(), 1);
        assert.equal(await page.evaluate(() => window.__ligaProbe.speicher.ladeModul('liga').saison.nr), 1);
      });
      await page.evaluate(() => window.__app.gehe('arena'));
      await page.waitForFunction(() => document.querySelector('.liga-unter')?.textContent.includes('Saison 2'));
      await browserPruefe(name + ': neue Saison, ruhige Karte und Reset um eine Stufe', async () => {
        assert.match(await page.locator('.liga-titel').innerText(), /^Liga Holz$/);
        assert.match(await page.locator('.liga-unter').innerText(), /^Saison 2 · bis 4\. April$/);
        assert.match(await page.locator('.liga-wechsel').innerText(), /Neue Saison, neue Chance/);
        assert.match(await page.locator('.liga-karte .liga-wertung').textContent(), /Läuferklasse.*1211/);
      });
      await page.locator('.liga-knopf').tap();
      await browserPruefe(name + ': Saison-Hinweis laesst sich schliessen', async () => assert.ok(await page.locator('.liga-wechsel').isHidden()));
      await page.evaluate(() => window.__app.gehe('verlauf')); await page.waitForSelector('.liga-archiv');
      await browserPruefe(name + ': Saison-Abzeichen bleibt im Archiv', async () => assert.match(await page.locator('.liga-archiv').innerText(), /Saison 1: Bronze/));
      await browserPruefe(name + ': keine JavaScript- oder Konsolenfehler', async () => assert.deepEqual(fehler, []));
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
