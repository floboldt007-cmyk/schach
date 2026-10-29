// Tests fuer js/storage.js (Node, ohne Browser): node tests/storage.test.mjs
import {
  setzeSpeicher, ladeEinstellungen, speichereEinstellungen, STANDARD_EINSTELLUNGEN, EINSTELLUNG_WERTE,
  ladeFortschritt, istFreigeschaltet, hoechsteFreieStufe, naechsterGegner, sterneZahl, gesamtSterne, hoechsterSieg, istWeltFrei, hatWeltsiegel,
  besiegteBots, sterneFuerPartie, speicherePartie, ladePartien, ladePartie, aktualisierePartie,
  loeschePartie, ladeReview, speichereReview, hatReview, MAX_REVIEWS, speichereLaufendePartie,
  ladeLaufendePartie, loescheLaufendePartie, statistik, setzeZurueck, ergaenzeAnalyse, eigeneZuege,
  MODI, wertet, EXTRA_MAX, MODUL_BUDGET, ladeModul, speichereModul, speicherStand, rohSpeicher, SPEICHER_GRENZE,
  ladeModulEinstellungen, speichereModulEinstellungen, MODUL_EINSTELLUNGEN_MAX,
  duenneAnalysenAus, dauerhaftAnfragen, dauerhaftStatus, BOSS_STUFEN, persistOhneDialog, pruefeZuzweit,
} from '../js/storage.js';
import { registriereBot, botNachId } from '../js/bots.js';
import { hoere, zuruecksetzen as busZuruecksetzen } from '../js/ereignisse.js';
import { analysierePartie, kompaktReview, ergaenzeReviewFelder } from '../js/review.js';
import { Chess } from '../vendor/chess/chess.js';

let ok = 0;
let fehler = 0;
function pruefe(name, bedingung, info) {
  if (bedingung) { ok++; console.log('OK     ' + name); } else { fehler++; console.log('FEHLER ' + name + (info !== undefined ? '  -> ' + JSON.stringify(info) : '')); }
}

// Fake-localStorage mit optionaler Groessengrenze
function fakeSpeicher(grenze = Infinity) {
  const m = new Map();
  const groesse = () => [...m.values()].reduce((s, v) => s + v.length, 0);
  return {
    m,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => {
      const alt = m.get(k);
      const neu = groesse() - (alt ? alt.length : 0) + String(v).length;
      if (neu > grenze) { const e = new Error('voll'); e.name = 'QuotaExceededError'; throw e; }
      m.set(k, String(v));
    },
    removeItem: (k) => { m.delete(k); },
    key: (i) => [...m.keys()][i] ?? null,
    get length() { return m.size; },
  };
}

let t = 0;
// 20 Halbzuege (10 eigene), damit die Genauigkeit fuer den Bestwert zaehlt
const ZWANZIG = Array.from({ length: 20 }, () => 'e2e4');
function partie(teil) {
  t++;
  return {
    datum: new Date(Date.UTC(2026, 9, 16, 10, 0, t)).toISOString(), botId: 'benno', botStufe: 1,
    spielerFarbe: 'w', zuege: ZWANZIG, san: ['e4'], ergebnis: 'sieg', grund: 'matt',
    hinweise: 0, zuruecknahmen: 0, liveKlassen: ['buch'], genauigkeit: 90, ...teil,
  };
}

// ---------- Einstellungen ----------
let s = fakeSpeicher();
setzeSpeicher(s);
pruefe('Einstellungen: Standard', JSON.stringify(ladeEinstellungen()) === JSON.stringify(STANDARD_EINSTELLUNGEN));
pruefe('Vorzüge: bei alten Speicherständen standardmäßig an', ladeEinstellungen().vorzuege === true);
speichereEinstellungen({ klang: false, brett: 'holz' });
pruefe('Einstellungen: speichern + mischen', ladeEinstellungen().klang === false && ladeEinstellungen().brett === 'holz' && ladeEinstellungen().balken === true);
speichereEinstellungen({ vorzuege: false });
pruefe('Vorzüge: erlaubter boolescher Wert bleibt gespeichert', ladeEinstellungen().vorzuege === false);
s.setItem('schach-arena:v1:einstellungen', '{kaputt');
pruefe('Einstellungen: kaputtes JSON -> Standard', ladeEinstellungen().klang === true);
s.setItem('schach-arena:v1:einstellungen', JSON.stringify({ brett: 'lila', klang: 'ja', tiefe: 99 }));
const e = ladeEinstellungen();
pruefe('Einstellungen: falsche Typen/Werte ignoriert, Tiefe begrenzt', e.brett === 'nacht' && e.klang === true && e.tiefe === 20);

// ---------- Premium-Umbau U1: neue Einstellungen (PLAN 4) ----------
{
  s.m.clear();
  const std = ladeEinstellungen();
  const erwartet = {
    klangpaket: '', lautstaerke: 0.8, klangstufe: 'alle', zugBestaetigen: 'aus', haltenAufgeben: true, turmRochade: false,
    autoDame: false, steuerung: 'beides', bewegung: 'normal', thema: 'modern', modus: 'system', koordLage: 'ecke', pfeile: true,
    duellIntro: 'besondere', figuren: 'cburnett', coachStil: 'ausfuehrlich', sprueche: 'an',
  };
  pruefe('U1: Standards der neuen Einstellungen (Klangstufe alle nach D4, Duell-Intro besondere nach D3)',
    Object.entries(erwartet).every(([k, v]) => std[k] === v && STANDARD_EINSTELLUNGEN[k] === v), std);
  pruefe('U1: Klanggruppen, alle an', JSON.stringify(std.klanggruppen) === '{"brett":true,"bewertung":true,"feier":true,"uhr":true,"boss":true,"finisher":true,"bedienung":true}');
  pruefe('U1: alte Einstellungen bleiben (klang, balken, liveBewertung, brett, koordinaten, tiefe, zaehlwerk, funkenlinie, lebensleiste)',
    std.klang === true && std.balken === true && std.liveBewertung === true && std.brett === 'nacht' && std.koordinaten === true && std.tiefe === 14
    && std.zaehlwerk === false && std.funkenlinie === false && std.lebensleiste === true);
  pruefe('U1: STANDARD_EINSTELLUNGEN eingefroren (auch die Klanggruppen)', Object.isFrozen(STANDARD_EINSTELLUNGEN) && Object.isFrozen(STANDARD_EINSTELLUNGEN.klanggruppen));
  std.klanggruppen.uhr = false;
  pruefe('U1: ladeEinstellungen liefert eine eigene Kopie der Klanggruppen', ladeEinstellungen().klanggruppen.uhr === true && STANDARD_EINSTELLUNGEN.klanggruppen.uhr === true);

  // alter Speicherstand ohne die neuen Schluessel: Standards, alte Werte bleiben
  s.setItem('schach-arena:v1:einstellungen', JSON.stringify({ klang: false, balken: true, liveBewertung: false, brett: 'holz', koordinaten: false, tiefe: 16 }));
  const alt = ladeEinstellungen();
  pruefe('U1: alter Speicherstand ohne neue Schluessel laedt (Standards ergaenzt, alte Werte bleiben)', alt.klang === false && alt.liveBewertung === false
    && alt.brett === 'holz' && alt.koordinaten === false && alt.tiefe === 16 && alt.klangstufe === 'alle' && alt.modus === 'system' && alt.klanggruppen.brett === true, alt);

  // falsche Werte fallen still auf den Standard
  s.setItem('schach-arena:v1:einstellungen', JSON.stringify({
    klangpaket: 'neon', lautstaerke: 3, klangstufe: 'laut', zugBestaetigen: true, haltenAufgeben: 'ja', turmRochade: 1, autoDame: null,
    steuerung: 'wischen', bewegung: 'turbo', thema: 'Neon Arena!', modus: 'grau', koordLage: 'mitte', pfeile: 'an', duellIntro: 'manchmal',
    figuren: 'staunton', coachStil: 'laut', sprueche: 'viele', klanggruppen: { brett: false, uhr: 'aus', fremd: false },
  }));
  const f = ladeEinstellungen();
  pruefe('U1: falsche Aufzaehlungen und Typen -> Standard', Object.entries(erwartet).filter(([k]) => k !== 'lautstaerke').every(([k, v]) => f[k] === v), f);
  pruefe('U1: Lautstaerke begrenzt auf 0..1', f.lautstaerke === 1);
  pruefe('U1: Klanggruppen einzeln geprueft (brett aus bleibt, falscher Typ -> an, fremde Gruppe weg)',
    f.klanggruppen.brett === false && f.klanggruppen.uhr === true && !('fremd' in f.klanggruppen) && Object.keys(f.klanggruppen).length === 7, f.klanggruppen);
  // Fassung 2 (23.10.): "Zug bestaetigen" Standard aus. Alte Staende trugen den alten Standard 'ohneUhr' mit, ob gewaehlt
  // oder nicht: einmal auf 'aus'. 'immer' bleibt, und wer nach der Umstellung 'ohneUhr' waehlt, behaelt es.
  s.setItem('schach-arena:v1:einstellungen', JSON.stringify({ brett: 'holz', zugBestaetigen: 'ohneUhr' }));
  const m1 = ladeEinstellungen();
  pruefe('Fassung 2: alter Stand mit ohneUhr -> aus, andere Werte bleiben, jetzt Fassung 3', m1.zugBestaetigen === 'aus' && m1.brett === 'holz' && m1.fassung === 3, m1);
  s.setItem('schach-arena:v1:einstellungen', JSON.stringify({ zugBestaetigen: 'immer' }));
  pruefe('Fassung 2: alter Stand mit immer bleibt immer', ladeEinstellungen().zugBestaetigen === 'immer');
  s.setItem('schach-arena:v1:einstellungen', JSON.stringify({ zugBestaetigen: 'ohneUhr', fassung: 2 }));
  pruefe('Fassung 2: neuer Stand mit ohneUhr bleibt ohneUhr', ladeEinstellungen().zugBestaetigen === 'ohneUhr');
  s.setItem('schach-arena:v1:einstellungen', JSON.stringify({ brett: 'gruen', zugBestaetigen: 'ohneUhr' }));
  const m2 = speichereEinstellungen({ zugBestaetigen: 'ohneUhr' });
  const m2roh = JSON.parse(s.getItem('schach-arena:v1:einstellungen'));
  pruefe('Fassung 2: nach der Umstellung gewaehltes ohneUhr wird mit Fassung 2 gespeichert und bleibt', m2.zugBestaetigen === 'ohneUhr' && m2roh.fassung === 3
    && ladeEinstellungen().zugBestaetigen === 'ohneUhr' && ladeEinstellungen().brett === 'gruen', m2roh);
  s.setItem('schach-arena:v1:einstellungen', JSON.stringify({ zugBestaetigen: 'ohneUhr', fassung: 'zwei' }));
  pruefe('Fassung 2: kaputte Fassung zaehlt als alt', ladeEinstellungen().zugBestaetigen === 'aus');
  // Fassung 3 (24.10.): "Automatisch Dame" Standard aus (Flo will die Figur waehlen); alte Staende mit an -> aus, danach bleibt an
  s.setItem('schach-arena:v1:einstellungen', JSON.stringify({ autoDame: true, fassung: 2, brett: 'holz' }));
  const m3 = ladeEinstellungen();
  pruefe('Fassung 3: alter Stand mit Automatisch Dame an -> aus, anderes bleibt', m3.autoDame === false && m3.brett === 'holz' && m3.fassung === 3, m3);
  s.setItem('schach-arena:v1:einstellungen', JSON.stringify({ autoDame: true, fassung: 3 }));
  pruefe('Fassung 3: danach gewaehltes Automatisch Dame bleibt an', ladeEinstellungen().autoDame === true);
  s.removeItem('schach-arena:v1:einstellungen');
  pruefe('Fassung 3: neuer Stand ohne Eintrag: Auswahl bei der Umwandlung (aus)', ladeEinstellungen().autoDame === false);
  s.setItem('schach-arena:v1:einstellungen', JSON.stringify({ lautstaerke: 0.333, klanggruppen: [false, false] }));
  const g = ladeEinstellungen();
  pruefe('U1: Lautstaerke auf 0,05 gerundet, Klanggruppen als Liste ignoriert', g.lautstaerke === 0.35 && Object.values(g.klanggruppen).every((x) => x === true), g);
  s.setItem('schach-arena:v1:einstellungen', JSON.stringify({ lautstaerke: -2 }));
  pruefe('U1: negative Lautstaerke -> 0', ladeEinstellungen().lautstaerke === 0);
  s.setItem('schach-arena:v1:einstellungen', JSON.stringify(['kaputt']));
  pruefe('U1: Einstellungen als Liste -> Standard', JSON.stringify(ladeEinstellungen()) === JSON.stringify(STANDARD_EINSTELLUNGEN));

  // erlaubte Werte werden uebernommen
  s.m.clear();
  speichereEinstellungen({ klangpaket: 'arcade', lautstaerke: 0.45, klangstufe: 'wichtig', zugBestaetigen: 'immer', haltenAufgeben: false,
    turmRochade: true, autoDame: false, steuerung: 'tippen', bewegung: 'aus', thema: 'edel', modus: 'dunkel', koordLage: 'rand', pfeile: false,
    duellIntro: 'aus', coachStil: 'knapp', sprueche: 'wenig' });
  const h = ladeEinstellungen();
  pruefe('U1: erlaubte Werte bleiben gespeichert', h.klangpaket === 'arcade' && h.lautstaerke === 0.45 && h.klangstufe === 'wichtig' && h.zugBestaetigen === 'immer'
    && h.haltenAufgeben === false && h.turmRochade === true && h.autoDame === false && h.steuerung === 'tippen' && h.bewegung === 'aus' && h.thema === 'edel'
    && h.modus === 'dunkel' && h.koordLage === 'rand' && h.pfeile === false && h.duellIntro === 'aus' && h.coachStil === 'knapp' && h.sprueche === 'wenig', h);
  speichereEinstellungen({ klanggruppen: { uhr: false } });
  speichereEinstellungen({ klanggruppen: { bedienung: false } });
  const kg = ladeEinstellungen().klanggruppen;
  pruefe('U1: speichereEinstellungen({ klanggruppen: { … } }) aendert nur die genannten Gruppen', kg.uhr === false && kg.bedienung === false
    && kg.brett === true && kg.feier === true && ladeEinstellungen().klangpaket === 'arcade', kg);
  pruefe('U1: EINSTELLUNG_WERTE nennt jede Aufzaehlung mit ihrem Standard', Object.entries(EINSTELLUNG_WERTE).every(([k, w]) => w.includes(STANDARD_EINSTELLUNGEN[k])));
  s.m.clear();
}

// ---------- Daten-Fundament (DSGVO): datenfreigabe, Opt-in mit Standard aus ----------
{
  s.m.clear();
  pruefe('Daten: datenfreigabe Standard aus, erlaubt nur aus und an', STANDARD_EINSTELLUNGEN.datenfreigabe === 'aus' && ladeEinstellungen().datenfreigabe === 'aus'
    && JSON.stringify(EINSTELLUNG_WERTE.datenfreigabe) === '["aus","an"]' && Object.isFrozen(EINSTELLUNG_WERTE.datenfreigabe));
  speichereEinstellungen({ datenfreigabe: 'an' });
  pruefe('Daten: Freigabe an bleibt gespeichert, andere Einstellungen unberuehrt', ladeEinstellungen().datenfreigabe === 'an' && ladeEinstellungen().klang === true);
  for (const falsch of ['ja', true, 1, 'AN', '', null]) {
    s.setItem('schach-arena:v1:einstellungen', JSON.stringify({ datenfreigabe: falsch }));
    pruefe(`Daten: falscher Wert ${JSON.stringify(falsch)} -> aus`, ladeEinstellungen().datenfreigabe === 'aus');
  }
  s.setItem('schach-arena:v1:einstellungen', JSON.stringify({ klang: false, brett: 'holz' }));
  pruefe('Daten: alter Speicherstand ohne datenfreigabe -> aus, alte Werte bleiben', ladeEinstellungen().datenfreigabe === 'aus' && ladeEinstellungen().brett === 'holz');
  s.m.clear();
}

// ---------- Fortschritt / Freischaltung ----------
s = fakeSpeicher();
setzeSpeicher(s);
let f = ladeFortschritt();
pruefe('Fortschritt: leer, 30 Bots (Welten)', Object.keys(f.bots).length === 30 && gesamtSterne(f) === 0);
pruefe('Freischaltung: nur Stufe 1 frei', istFreigeschaltet(1, f) && !istFreigeschaltet(2, f) && hoechsteFreieStufe(f) === 1);
pruefe('Naechster Gegner: Willi (Welten: Stufe 1)', naechsterGegner(f).id === 'fridolin');
pruefe('Welten: der Endgegner der ersten Welt ist direkt herausforderbar, die Stufen dazwischen nicht', istFreigeschaltet(6, f) && !istFreigeschaltet(5, f) && !istFreigeschaltet(7, f) && !istFreigeschaltet(12, f));

pruefe('Sterne: Niederlage 0', JSON.stringify(sterneFuerPartie(partie({ ergebnis: 'niederlage' }))) === '[false,false,false]');
pruefe('Sterne: Sieg 79,9 % mit Hinweis', JSON.stringify(sterneFuerPartie(partie({ genauigkeit: 79.9, hinweise: 1 }))) === '[true,false,false]');
pruefe('Sterne: Sieg 80 % ohne Hilfe', JSON.stringify(sterneFuerPartie(partie({ genauigkeit: 80 }))) === '[true,true,true]');
pruefe('Sterne: Genauigkeit null', JSON.stringify(sterneFuerPartie(partie({ genauigkeit: null, zuruecknahmen: 2 }))) === '[true,false,false]');

// Niederlage gegen Lukas: nichts frei
let r = speicherePartie(partie({ ergebnis: 'niederlage', genauigkeit: 50 }));
f = ladeFortschritt();
pruefe('Niederlage: keine Sterne, nicht frei', !r.neuFreigeschaltet && gesamtSterne(f) === 0 && f.bots.benno.niederlagen === 1 && f.bots.benno.partien === 1);

// Sieg mit Hinweis gegen Lukas (Stufe 2) -> Stern 1 und 2, frei bis Paula (Stufe 3, der naechste Gegner)
r = speicherePartie(partie({ genauigkeit: 85, hinweise: 1 }), { zuege: [{ ply: 0, farbe: 'w', san: 'e4', klasse: 'brillant' }, { ply: 1, farbe: 'b', san: 'e5', klasse: 'brillant' }] });
f = ladeFortschritt();
pruefe('Sieg mit Hinweis: Sterne 1+2 neu, Paula frei', JSON.stringify(r.neueSterne) === '[true,true,false]' && r.neuFreigeschaltet && r.neuFreigeschaltet.id === 'paula', r.neuFreigeschaltet && r.neuFreigeschaltet.id);
pruefe('Freischaltung: bis Stufe 3 frei (Willi darunter auch), 4 nicht', istFreigeschaltet(1, f) && istFreigeschaltet(3, f) && !istFreigeschaltet(4, f) && hoechsteFreieStufe(f) === 3 && besiegteBots(f) === 1);
pruefe('Naechster Gegner: Paula (ueber dem besten Sieg, nicht zurueck zu Willi)', naechsterGegner(f).id === 'paula');
pruefe('Brillant-Sammlung: nur eigene Zuege', r.brillant === 1 && f.bots.benno.besteGenauigkeit === 85 && f.brillanteZuege.length === 1);
const id2 = r.partie.id;
pruefe('Review gespeichert', hatReview(id2) && ladeReview(id2).zuege.length === 2);

// Gleiche Partie nochmal speichern: kein doppeltes Buchen
r = speicherePartie({ ...r.partie, genauigkeit: 99 });
f = ladeFortschritt();
pruefe('Doppelt speichern bucht nicht doppelt', f.bots.benno.siege === 1 && f.bots.benno.partien === 2 && !r.neuFreigeschaltet && ladePartien().length === 2);

// Spaeter Stern 3 dazu
r = speicherePartie(partie({ genauigkeit: 60 }));
f = ladeFortschritt();
pruefe('Stern 3 einzeln nachgeholt', JSON.stringify(r.neueSterne) === '[false,false,true]' && sterneZahl('benno', f) === 3 && !r.neuFreigeschaltet);

// Bestwert: eine Aufgabe nach einem Zug zaehlt nicht
pruefe('Eigene Zuege: Weiss 3 von 5, Schwarz 2 von 5, Schwarz ab FEN 3 von 5',
  eigeneZuege({ zuege: [1, 2, 3, 4, 5], spielerFarbe: 'w' }) === 3 && eigeneZuege({ zuege: [1, 2, 3, 4, 5], spielerFarbe: 'b' }) === 2
  && eigeneZuege({ zuege: [1, 2, 3, 4, 5], spielerFarbe: 'b', startFen: '8/8/8/8/8/8/8/K6k b - - 0 1' }) === 3);
{
  const vorherBest = ladeFortschritt().bots.benno.besteGenauigkeit;
  const kurzId = speicherePartie(partie({ ergebnis: 'niederlage', grund: 'aufgabe', zuege: ['e2e4', 'e7e5'], genauigkeit: 97.6 })).partie.id;
  pruefe('Bestwert: Aufgabe nach einem Zug zaehlt nicht', ladeFortschritt().bots.benno.besteGenauigkeit === vorherBest, ladeFortschritt().bots.benno.besteGenauigkeit);
  pruefe('Bestwert: auch nicht in der Statistik', statistik().besteGenauigkeit !== 97.6, statistik().besteGenauigkeit);
  loeschePartie(kurzId);
}

// ---------- Welten (Flo 23.10.): Freischaltung ueber den besten Sieg, Endgegner direkt, Weltsiegel ----------
{
  const merk = s;
  const w = fakeSpeicher();
  setzeSpeicher(w);
  const sieg3 = { sterne: [true, true, true], partien: 1, siege: 1, remis: 0, niederlagen: 0, besteGenauigkeit: 90 };
  const sieg1 = { ...sieg3, sterne: [true, false, false] };
  // alter Spielstand bis Grossmeisterin Greta (frueher Stufe 9, jetzt 21): alles darunter bleibt frei, auch neue Bots
  w.setItem('schach-arena:v1:fortschritt', JSON.stringify({ bots: { benno: sieg1, hilde: sieg1, kalle: sieg1, lisa: sieg1, rudi: sieg1,
    turm: sieg1, delia: sieg1, koenig: sieg1, greta: sieg1 } }));
  let fw = ladeFortschritt();
  pruefe('Welten: alter Stand bis Greta: Willi, Paula und René frei, Ilka nicht, naechster Gegner René',
    istFreigeschaltet(1, fw) && istFreigeschaltet(3, fw) && istFreigeschaltet(22, fw) && !istFreigeschaltet(23, fw)
    && naechsterGegner(fw).id === 'henning' && hoechsteFreieStufe(fw) === 22);
  pruefe('Welten: Endgegner der eigenen Welt (Johann, 24) direkt frei, die Stockfisch-Tiefe noch zu',
    istFreigeschaltet(24, fw) && istWeltFrei(4, fw) && !istWeltFrei(5, fw) && !istFreigeschaltet(25, fw) && !istFreigeschaltet(30, fw));
  // frischer Stand: Endgegner Janine direkt besiegt -> ganze Welt 1 und Jan (Welt 2) frei, Jan ist der naechste Gegner
  w.removeItem('schach-arena:v1:fortschritt');
  const rj = speicherePartie(partie({ botId: 'janine', botStufe: 6, genauigkeit: 85 }));
  fw = ladeFortschritt();
  pruefe('Welten: Sieg gegen den Endgegner direkt oeffnet die ganze Welt und die naechste (neu frei: Jan)',
    [2, 3, 4, 5, 7].every((st) => istFreigeschaltet(st, fw)) && !istFreigeschaltet(8, fw) && istWeltFrei(2, fw)
    && rj.neuFreigeschaltet && rj.neuFreigeschaltet.id === 'bodo' && naechsterGegner(fw).id === 'bodo', rj.neuFreigeschaltet && rj.neuFreigeschaltet.id);
  // Weltsiegel: alle 18 Sterne der Welt
  w.setItem('schach-arena:v1:fortschritt', JSON.stringify({ bots: { fridolin: sieg3, benno: sieg3, paula: sieg3, gustav: sieg3, hilde: sieg3, janine: sieg1 } }));
  pruefe('Welten: Weltsiegel erst mit allen 18 Sternen', !hatWeltsiegel(1, ladeFortschritt()));
  w.setItem('schach-arena:v1:fortschritt', JSON.stringify({ bots: { fridolin: sieg3, benno: sieg3, paula: sieg3, gustav: sieg3, hilde: sieg3, janine: sieg3 } }));
  pruefe('Welten: Weltsiegel mit allen 18 Sternen, gesamt 90 moeglich', hatWeltsiegel(1, ladeFortschritt()) && !hatWeltsiegel(2, ladeFortschritt())
    && gesamtSterne(ladeFortschritt()) === 18 && hoechsterSieg(ladeFortschritt()) === 6);
  setzeSpeicher(merk);
}

// ---------- Partien ----------
const liste = ladePartien();
pruefe('Partien: neueste zuerst', liste.length === 3 && liste[0].datum > liste[1].datum && liste[1].datum > liste[2].datum);
pruefe('Partie laden', ladePartie(id2).botId === 'benno' && ladePartie('gibtsnicht') === null);
aktualisierePartie(id2, { eroeffnung: 'Italienisch', ergebnis: 'niederlage', sterne: [false, false, false] });
pruefe('Aktualisieren: Zusatzfelder ja, Ergebnis/Sterne nein', ladePartie(id2).eroeffnung === 'Italienisch' && ladePartie(id2).ergebnis === 'sieg' && ladePartie(id2).sterne[0] === true);
loeschePartie(id2);
pruefe('Loeschen: Partie und Review weg', !ladePartie(id2) && !hatReview(id2) && ladePartien().length === 2);

// ---------- Analyse nachtragen (Partie wird am Ende sofort gespeichert) ----------
s = fakeSpeicher();
setzeSpeicher(s);
{
  const sofort = speicherePartie(partie({ genauigkeit: null, hinweise: 1 }));
  let fs = ladeFortschritt();
  pruefe('Sofort gespeichert: Sieg und Freischaltung gebucht, Stern 2 offen', JSON.stringify(sofort.neueSterne) === '[true,false,false]'
    && sofort.neuFreigeschaltet && sofort.neuFreigeschaltet.id === 'paula' && fs.bots.benno.sterne[1] === false);
  const review = { genauigkeit: { w: 86.5, b: 70 }, spielstaerke: { w: 1600, b: 300 }, eroeffnung: 'Spanisch',
    zuege: [{ ply: 4, farbe: 'w', san: 'Nxf7', klasse: 'brillant' }, { ply: 5, farbe: 'b', san: 'Kxf7', klasse: 'gut' }] };
  const nach = ergaenzeAnalyse(sofort.partie.id, review);
  fs = ladeFortschritt();
  const pa = ladePartie(sofort.partie.id);
  pruefe('Analyse nachgetragen: Genauigkeit, Spielstaerke, Eroeffnung, Review', pa.genauigkeit === 86.5 && pa.genauigkeitBot === 70
    && pa.spielstaerke === 1600 && pa.eroeffnung === 'Spanisch' && hatReview(pa.id), pa);
  pruefe('Analyse nachgetragen: Stern 2 neu verdient', JSON.stringify(nach.neueSterne) === '[false,true,false]' && fs.bots.benno.sterne[1] === true
    && JSON.stringify(pa.sterne) === '[true,true,false]');
  pruefe('Analyse nachgetragen: Brillant-Zug und Bestwert', nach.brillant === 1 && fs.brillanteZuege.length === 1 && fs.bots.benno.besteGenauigkeit === 86.5);
  const nochmal = ergaenzeAnalyse(sofort.partie.id, { ...review, genauigkeit: { w: 60, b: 70 } });
  fs = ladeFortschritt();
  pruefe('Analyse nochmal: nichts doppelt, Stern bleibt', nochmal.brillant === 0 && fs.brillanteZuege.length === 1 && fs.bots.benno.sterne[1] === true
    && fs.bots.benno.siege === 1 && fs.bots.benno.partien === 1);
  // w0c: eine spaetere Analyse ersetzt die Genauigkeit nicht, auf der Stern 2 beruht
  const pn = ladePartie(sofort.partie.id);
  pruefe('Analyse nochmal: Genauigkeit, Spielstaerke und Partie-Sterne bleiben (nur leere Felder werden gefuellt)', pn.genauigkeit === 86.5
    && pn.genauigkeitBot === 70 && pn.spielstaerke === 1600 && JSON.stringify(pn.sterne) === '[true,true,false]'
    && JSON.stringify(nochmal.partie.sterne) === '[true,true,false]' && JSON.stringify(nochmal.neueSterne) === '[false,false,false]', pn);
  pruefe('Analyse nochmal: Review ist die neue (eigene Zahlen), Bestwert bleibt', ladeReview(sofort.partie.id).genauigkeit.w === 60
    && fs.bots.benno.besteGenauigkeit === 86.5);
  const ohne = speicherePartie(partie({ genauigkeit: null }));
  ergaenzeAnalyse(ohne.partie.id, null, { genauigkeit: 81 });
  pruefe('Ohne Analyse: Live-Genauigkeit nachgetragen', ladePartie(ohne.partie.id).genauigkeit === 81);
  ergaenzeAnalyse(ohne.partie.id, null, { genauigkeit: 50 });
  pruefe('Ohne Analyse: vorhandene Genauigkeit bleibt', ladePartie(ohne.partie.id).genauigkeit === 81);
  pruefe('Unbekannte Partie: null', ergaenzeAnalyse('gibtsnicht', review) === null);
}

// ---------- w0c: einmal verdiente Sterne bleiben, Genauigkeit wird nicht still ersetzt ----------
// Beleg vorher: 85 % -> Stern 2, dann neue Analyse mit 75 % (Review war aus der Liste gefallen):
// Partie-Sterne [T,F,T], Fortschritt [T,T,T]
s = fakeSpeicher();
setzeSpeicher(s);
{
  const p = speicherePartie(partie({ genauigkeit: null }));
  const r85 = { genauigkeit: { w: 85, b: 60 }, spielstaerke: { w: 1500, b: 300 }, zuege: [] };
  const erst = ergaenzeAnalyse(p.partie.id, r85);
  pruefe('Erste Analyse: 85 %, Stern 2 verdient', erst.partie.genauigkeit === 85 && JSON.stringify(erst.neueSterne) === '[false,true,false]'
    && JSON.stringify(ladePartie(p.partie.id).sterne) === '[true,true,true]');
  // Review faellt aus der Liste, die Analyse wird neu gerechnet und liefert weniger
  s.removeItem('schach-arena:v1:review:' + p.partie.id);
  const neu = ergaenzeAnalyse(p.partie.id, { genauigkeit: { w: 75, b: 70 }, spielstaerke: { w: 1100, b: 400 }, eroeffnung: 'Andere', zuege: [] });
  const pa = ladePartie(p.partie.id);
  const fs = ladeFortschritt();
  pruefe('Neue Analyse mit 75 %: Genauigkeit bleibt 85 %', pa.genauigkeit === 85 && pa.genauigkeitBot === 60 && pa.spielstaerke === 1500, pa);
  pruefe('Neue Analyse: Partie-Sterne und Fortschritt passen zusammen ([T,T,T])', JSON.stringify(pa.sterne) === '[true,true,true]'
    && JSON.stringify(fs.bots.benno.sterne) === '[true,true,true]' && JSON.stringify(neu.partie.sterne) === '[true,true,true]');
  pruefe('Neue Analyse: Review gespeichert, Eroeffnung nur wenn leer', hatReview(p.partie.id) && ladeReview(p.partie.id).genauigkeit.w === 75
    && pa.eroeffnung === 'Andere');
  // Sterne im Datensatz bleiben auch, wenn die gespeicherte Genauigkeit fehlt (z. B. alte Daten)
  const alt = speicherePartie(partie({ genauigkeit: 90 }));
  const roh = JSON.parse(s.getItem('schach-arena:v1:partien'));
  roh.find((x) => x.id === alt.partie.id).genauigkeit = null;
  s.setItem('schach-arena:v1:partien', JSON.stringify(roh));
  const e2 = ergaenzeAnalyse(alt.partie.id, { genauigkeit: { w: 70, b: 70 }, zuege: [] });
  pruefe('Leere Genauigkeit wird gefuellt (70 %), verdienter Stern 2 bleibt im Datensatz', e2.partie.genauigkeit === 70
    && JSON.stringify(ladePartie(alt.partie.id).sterne) === '[true,true,true]');
  // nicht wertende Partie: nie Sterne, auch nicht aus alten Daten
  const u = speicherePartie(partie({ modus: 'uebung', startFen: '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1', genauigkeit: null }));
  const rohU = JSON.parse(s.getItem('schach-arena:v1:partien'));
  rohU.find((x) => x.id === u.partie.id).sterne = [true, true, true];
  s.setItem('schach-arena:v1:partien', JSON.stringify(rohU));
  pruefe('Uebung: Sterne bleiben aus, auch bei alten Daten', JSON.stringify(ergaenzeAnalyse(u.partie.id, r85).partie.sterne) === '[false,false,false]');
}

// ---------- w0-fix: eine Genauigkeit aus der Live-Bewertung ist vorlaeufig ----------
// Beleg vorher: Flo tippt im vorlaeufigen Ergebnis auf "Zur Analyse": Live 78 % blieb fuer immer, die volle
// Analyse (82 %) wurde verworfen, Stern 2 fehlte (origin/main ersetzte sie noch und gab Stern 2)
s = fakeSpeicher();
setzeSpeicher(s);
{
  const p = speicherePartie(partie({ genauigkeit: null }));
  const live = ergaenzeAnalyse(p.partie.id, null, { genauigkeit: 78 });
  pruefe('Live 78: Genauigkeit vorlaeufig gesetzt (Quelle live), Stern 2 offen, nicht analysiert', live.partie.genauigkeit === 78
    && live.partie.genauigkeitQuelle === 'live' && live.partie.analysiert !== true && JSON.stringify(live.partie.sterne) === '[true,false,true]', live.partie);
  const voll = ergaenzeAnalyse(p.partie.id, { genauigkeit: { w: 82, b: 60 }, spielstaerke: { w: 1300, b: 300 }, zuege: [] });
  const pa = ladePartie(p.partie.id);
  pruefe('Live 78, dann Analyse 82: Genauigkeit 82 (Quelle analyse), Stern 2 neu, analysiert', pa.genauigkeit === 82 && pa.genauigkeitQuelle === 'analyse'
    && pa.analysiert === true && JSON.stringify(pa.sterne) === '[true,true,true]' && JSON.stringify(voll.neueSterne) === '[false,true,false]'
    && JSON.stringify(ladeFortschritt().bots.benno.sterne) === '[true,true,true]' && ladeFortschritt().bots.benno.besteGenauigkeit === 82, pa);
  ergaenzeAnalyse(p.partie.id, { genauigkeit: { w: 70, b: 60 }, zuege: [] });
  pruefe('Danach: eine weitere Analyse ersetzt die aus der Analyse nie', ladePartie(p.partie.id).genauigkeit === 82
    && JSON.stringify(ladePartie(p.partie.id).sterne) === '[true,true,true]');
  ergaenzeAnalyse(p.partie.id, null, { genauigkeit: 50 });
  pruefe('Danach: ein Live-Wert ersetzt sie auch nicht', ladePartie(p.partie.id).genauigkeit === 82 && ladePartie(p.partie.id).genauigkeitQuelle === 'analyse');

  // Live 85 (Stern 2 schon da), Analyse 75: Stern bleibt, Bestwert kommt nicht mehr aus dem ersetzten Live-Wert
  const q = speicherePartie(partie({ genauigkeit: null, botId: 'hilde', botStufe: 2 }));
  const r = speicherePartie(partie({ genauigkeit: 71, botId: 'hilde', botStufe: 2 }));
  ergaenzeAnalyse(q.partie.id, null, { genauigkeit: 85 });
  pruefe('Live 85: Stern 2 und Bestwert 85 (vorlaeufig)', ladeFortschritt().bots.hilde.sterne[1] === true && ladeFortschritt().bots.hilde.besteGenauigkeit === 85);
  const e75 = ergaenzeAnalyse(q.partie.id, { genauigkeit: { w: 75, b: 60 }, zuege: [] });
  const fh = ladeFortschritt().bots.hilde;
  pruefe('Live 85, dann Analyse 75: Genauigkeit 75, Stern 2 bleibt (nie entzogen), Bestwert aus den Partien neu (75)', e75.partie.genauigkeit === 75
    && JSON.stringify(e75.partie.sterne) === '[true,true,true]' && fh.sterne[1] === true && fh.besteGenauigkeit === 75 && r.partie.genauigkeit === 71, fh);

  // alte Datensaetze ohne Quelle: nur Genauigkeit gesetzt (wie aus der Live-Bewertung) -> einmal ersetzt
  const alt = speicherePartie(partie({ genauigkeit: null, botId: 'kalle', botStufe: 3 }));
  const roh = JSON.parse(s.getItem('schach-arena:v1:partien'));
  const x = roh.find((y) => y.id === alt.partie.id);
  x.genauigkeit = 79;
  delete x.genauigkeitQuelle;
  const y = { ...x, id: 'palt2', genauigkeit: 79, genauigkeitBot: 50, spielstaerke: 900 };
  roh.push(y);
  s.setItem('schach-arena:v1:partien', JSON.stringify(roh));
  ergaenzeAnalyse(alt.partie.id, { genauigkeit: { w: 81, b: 50 }, zuege: [] });
  ergaenzeAnalyse('palt2', { genauigkeit: { w: 81, b: 50 }, zuege: [] });
  pruefe('Alter Datensatz ohne Quelle, nur Genauigkeit: gilt als live und wird einmal ersetzt', ladePartie(alt.partie.id).genauigkeit === 81
    && ladePartie(alt.partie.id).genauigkeitQuelle === 'analyse');
  pruefe('Alter Datensatz ohne Quelle, aus einer Analyse (genauigkeitBot, spielstaerke): bleibt', ladePartie('palt2').genauigkeit === 79);

  // analysiert: kommt nur mit einer Review (auch beim Speichern mit Review)
  const z1 = speicherePartie(partie({ genauigkeit: null }));
  ergaenzeAnalyse(z1.partie.id, null, { genauigkeit: 90 });
  const z2 = speicherePartie(partie({ genauigkeit: null }), { zuege: [] });
  pruefe('analysiert nur mit Review (ergaenzeAnalyse ohne Review nicht, speicherePartie mit Review ja)', ladePartie(z1.partie.id).analysiert !== true
    && ladePartie(z2.partie.id).analysiert === true && z2.partie.genauigkeitQuelle === undefined);
  pruefe('Genauigkeit schon beim Speichern gilt als endgueltig (Quelle analyse)', speicherePartie(partie({ genauigkeit: 91 })).partie.genauigkeitQuelle === 'analyse'
    && speicherePartie(partie({ genauigkeit: 91, genauigkeitQuelle: 'live' })).partie.genauigkeitQuelle === 'live');
}

// ---------- w0c: neue IDs nie doppelt (Beleg vorher: in ca. 2 % der Laeufe zwei gleiche IDs unter 8 Partien) ----------
s = fakeSpeicher();
setzeSpeicher(s);
{
  const echt = Math.random;
  Math.random = () => 0.5;   // erzwingt denselben Zufallsteil: ohne Pruefung kaemen lauter gleiche IDs heraus
  let ids3;
  try {
    ids3 = [];
    for (let i = 0; i < 3; i++) ids3.push(speicherePartie(partie({})).partie.id);
  } catch (e) { ids3 = [String(e)]; } finally { Math.random = echt; }
  pruefe('Neue Partie-IDs sind eindeutig, auch in derselben Millisekunde', new Set(ids3).size === 3 && ladePartien().length === 3, ids3);
}

// ---------- Reviews: Begrenzung und voller Speicher ----------
s = fakeSpeicher();
setzeSpeicher(s);
const ids = [];
for (let i = 0; i < MAX_REVIEWS + 5; i++) ids.push(speicherePartie(partie({}), { zuege: [{ ply: 0, farbe: 'w', klasse: 'gut' }] }).partie.id);
const mit = ids.filter(hatReview);
pruefe('Reviews: nur die neuesten ' + MAX_REVIEWS, mit.length === MAX_REVIEWS && !hatReview(ids[0]) && hatReview(ids[ids.length - 1]), mit.length);

// Grenze 6500 (vorher 6000): seit w0-fix traegt jeder Datensatz genauigkeitQuelle und analysiert (ca. 48 Zeichen),
// sonst passte nicht einmal die neueste Analyse neben die Liste; die Pruefung selbst bleibt gleich
s = fakeSpeicher(9000);   // Welten: der Fortschritt hat 30 statt 10 Bots (gut 2000 Zeichen mehr; geht von 8700 bis ueber 9500)
setzeSpeicher(s);
const gross = { zuege: Array.from({ length: 10 }, (_, i) => ({ ply: i, farbe: 'w', klasse: 'gut', coach: 'x'.repeat(100) })) };
const ids2 = [];
for (let i = 0; i < 8; i++) ids2.push(speicherePartie(partie({}), gross).partie.id);
pruefe('Voller Speicher: aelteste Reviews geopfert, neueste da', hatReview(ids2[7]) && !hatReview(ids2[0]) && ladePartien().length === 8);

// ---------- Laufende Partie ----------
s = fakeSpeicher();
setzeSpeicher(s);
pruefe('Laufend: leer', ladeLaufendePartie() === null);
speichereLaufendePartie({ botId: 'rudi', spielerFarbe: 'b', zuege: ['e2e4'], hinweise: 0, zuruecknahmen: 1, liveKlassen: [] });
pruefe('Laufend: gespeichert', ladeLaufendePartie().botId === 'rudi' && ladeLaufendePartie().zuruecknahmen === 1);
speichereLaufendePartie({ botId: 'rudi', spielerFarbe: 'w', zuege: ['e2e4', 'e7e5'], liveKlassen: 'x' });
pruefe('Laufend: liveKlassen kein Array -> leer', JSON.stringify(ladeLaufendePartie().liveKlassen) === '[]');
speichereLaufendePartie({ botId: 'rudi', spielerFarbe: 'w', zuege: ['e2e4'], liveKlassen: ['x"><img src=x onerror=alert(1)>', 'buch'] });
pruefe('Laufend: unbekannte Klasse -> null', JSON.stringify(ladeLaufendePartie().liveKlassen) === '[null,"buch"]');
speichereLaufendePartie({ botId: 'rudi', spielerFarbe: 'w', zuege: ['e2e4', '<b>'] });
pruefe('Laufend: kaputter Zug -> keine laufende Partie', ladeLaufendePartie() === null);
speichereLaufendePartie({ botId: 'unbekannt', zuege: [] });
pruefe('Laufend: unbekannter Bot -> null', ladeLaufendePartie() === null);
speichereLaufendePartie({ botId: 'rudi', zuege: [] });
loescheLaufendePartie();
pruefe('Laufend: geloescht', ladeLaufendePartie() === null);

// ---------- Statistik / Zuruecksetzen ----------
speicherePartie(partie({ genauigkeit: 70, spielstaerke: 900 }));
speicherePartie(partie({ ergebnis: 'remis', genauigkeit: 80, spielstaerke: 1000 }));
speichereEinstellungen({ klang: false });
const st = statistik();
pruefe('Statistik', st.partien === 2 && st.siege === 1 && st.remis === 1 && st.schnittGenauigkeit === 75 && st.spielstaerke === 950 && st.besteGenauigkeit === 80, st);
setzeZurueck();
pruefe('Zuruecksetzen: Fortschritt weg, Einstellungen bleiben', ladePartien().length === 0 && gesamtSterne() === 0 && ladeEinstellungen().klang === false);
setzeZurueck({ mitEinstellungen: true });
pruefe('Zuruecksetzen mit Einstellungen', ladeEinstellungen().klang === true && s.m.size === 0);

// ---------- Kein localStorage ----------
setzeSpeicher(null);
pruefe('Ohne localStorage: Arbeitsspeicher als Ersatz', (() => { speichereEinstellungen({ balken: false }); return ladeEinstellungen().balken === false; })());

// =====================================================================
// Runde 4 (Welle 0): Modus, Wertungs-Schutz, Modul-Speicher, Budget, kompakte Reviews
// =====================================================================
function still(fn) {
  const alt = console.warn;
  const w = [];
  console.warn = (...a) => w.push(a.join(' '));
  try { return { wert: fn(), warnungen: w }; } finally { console.warn = alt; }
}
const UEBUNG_FEN = 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4';
const ZIEL = { partieId: 'pquelle1', ply: 6, besterZug: 'h5f7', alterZug: 'h5f3', alterSanDe: 'Df3', gewinnVorher: 0.99 };

// ---------- wertet / MODI ----------
pruefe('MODI mit zuzweit, eingefroren', JSON.stringify(MODI) === '["normal","uebung","boss","frei","spiel","zuzweit"]' && Object.isFrozen(MODI));
pruefe('Zu zweit: nie gewertet, auch bei Sieg mit hoher Genauigkeit', !wertet(partie({ modus: 'zuzweit' })));
pruefe('Zu zweit: Namen begrenzt, Steuerzeichen entfernt, fehlende Namen ersetzt',
  JSON.stringify(pruefeZuzweit({ weiss: '  Anna\u0000  ', schwarz: 'x'.repeat(40), drehen: true })) === JSON.stringify({ weiss: 'Anna', schwarz: 'x'.repeat(20), drehen: true })
  && JSON.stringify(pruefeZuzweit(null)) === JSON.stringify({ weiss: 'Weiß', schwarz: 'Schwarz', drehen: false }));
{
  setzeSpeicher(fakeSpeicher());
  const vor = JSON.stringify(ladeFortschritt());
  const p = speicherePartie(partie({ modus: 'zuzweit', botId: null, zuzweit: { weiss: 'Anna', schwarz: 'Ben' } }));
  pruefe('Zu zweit: Namen im Verlauf, keine Sterne und unveraenderter Fortschritt', p.wertet === false
    && ladePartie(p.partie.id).zuzweit.weiss === 'Anna' && !p.neueSterne.some(Boolean) && JSON.stringify(ladeFortschritt()) === vor);
  speichereLaufendePartie({ modus: 'zuzweit', zuzweit: { weiss: 'Anna', schwarz: 'Ben' }, zuege: ['e2e4'] });
  pruefe('Zu zweit: laufende Partie ohne Bot ladbar', ladeLaufendePartie()?.modus === 'zuzweit' && ladeLaufendePartie().zuege[0] === 'e2e4');
  speichereLaufendePartie({ botId: 'benno', zuege: ['d2d4'] });
  pruefe('Alter Stand: Bot-Partie ohne Modus weiter gueltig, keine lokalen Namen', ladeLaufendePartie()?.modus === 'normal' && !('zuzweit' in ladeLaufendePartie()));
}
pruefe('wertet: normale Partie ja, ohne modus ja', wertet({ modus: 'normal' }) && wertet({}));
pruefe('wertet: Uebung, eigene Stellung, unbekannter Modus nein', !wertet({ modus: 'uebung', startFen: UEBUNG_FEN }) && !wertet({ startFen: UEBUNG_FEN })
  && !wertet({ modus: 'uebung' }) && !wertet({ modus: 'boss' }) && !wertet(null));
pruefe('wertet: startFen gleich der Grundstellung ist keine eigene Stellung', wertet({ startFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' })
  && wertet({ startFen: ' rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 5 9 ' })
  && !wertet({ startFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1' })
  && !wertet({ startFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w Kkq - 0 1' }));
pruefe('Sterne: Sieg aus eigener Stellung bringt keine Sterne', JSON.stringify(sterneFuerPartie(partie({ startFen: UEBUNG_FEN }))) === '[false,false,false]');

// ---------- Wertungs-Schutz in speicherePartie ----------
s = fakeSpeicher();
setzeSpeicher(s);
{
  const brillantReview = { zuege: [{ ply: 0, farbe: 'w', san: 'Qxf7#', klasse: 'brillant' }] };
  const u = speicherePartie(partie({ modus: 'uebung', startFen: UEBUNG_FEN, ziel: ZIEL, genauigkeit: 95 }), brillantReview);
  let fs = ladeFortschritt();
  pruefe('Uebung: Rueckgabe wertet false, keine Sterne, keine Freischaltung', u.wertet === false && JSON.stringify(u.neueSterne) === '[false,false,false]'
    && u.neuFreigeschaltet === null && JSON.stringify(u.partie.sterne) === '[false,false,false]', u);
  pruefe('Uebung: keine Bot-Zaehler, kein Bestwert, keine Schatzkiste', fs.bots.benno.partien === 0 && fs.bots.benno.siege === 0
    && fs.bots.benno.besteGenauigkeit === null && fs.brillanteZuege.length === 0 && u.brillant === 0, fs.bots.benno);
  pruefe('Uebung: Partie mit modus und ziel gespeichert', ladePartie(u.partie.id).modus === 'uebung' && JSON.stringify(ladePartie(u.partie.id).ziel) === JSON.stringify(ZIEL));
  pruefe('Freischaltung: Hilde bleibt gesperrt', !istFreigeschaltet(2, fs) && gesamtSterne(fs) === 0);
  const e = ergaenzeAnalyse(u.partie.id, { genauigkeit: { w: 99, b: 20 }, zuege: brillantReview.zuege });
  fs = ladeFortschritt();
  // w0c: vorhandene Genauigkeit (95) bleibt, das leere Feld genauigkeitBot wird gefuellt
  pruefe('Uebung nachgetragen: Genauigkeit ja, Sterne/Bestwert/Schatzkiste nein, wertet false', e.wertet === false && e.partie.genauigkeit === 95
    && e.partie.genauigkeitBot === 20
    && JSON.stringify(e.neueSterne) === '[false,false,false]' && fs.bots.benno.besteGenauigkeit === null && fs.brillanteZuege.length === 0 && e.brillant === 0, e);

  const st = speicherePartie(partie({ startFen: UEBUNG_FEN, genauigkeit: 100 }));
  fs = ladeFortschritt();
  pruefe('Partie aus Stellung (normal): bucht nichts, modus normal', st.wertet === false && st.partie.modus === 'normal' && fs.bots.benno.partien === 0
    && gesamtSterne(fs) === 0 && !st.neuFreigeschaltet);

  const n = speicherePartie(partie({ genauigkeit: 91, maxSerie: 7.2 }), brillantReview);
  fs = ladeFortschritt();
  pruefe('normale Partie: wertet true, bucht wie bisher', n.wertet === true && JSON.stringify(n.neueSterne) === '[true,true,true]'
    && n.neuFreigeschaltet && n.neuFreigeschaltet.id === 'paula' && fs.bots.benno.partien === 1 && n.brillant === 1);
  pruefe('normale Partie: modus normal, maxSerie gerundet, kein ziel', ladePartie(n.partie.id).modus === 'normal' && ladePartie(n.partie.id).maxSerie === 7
    && !('ziel' in ladePartie(n.partie.id)));
  const nNochmal = ergaenzeAnalyse(n.partie.id, { genauigkeit: { w: 93, b: 10 }, zuege: [] });
  // w0c: die Genauigkeit 91 vom Speichern bleibt (vorher wurde sie durch 93 ersetzt, Bestwert 93)
  pruefe('ergaenzeAnalyse normal: wertet true, vorhandene Genauigkeit bleibt', nNochmal.wertet === true
    && ladeFortschritt().bots.benno.besteGenauigkeit === 91 && ladePartie(n.partie.id).genauigkeit === 91 && ladePartie(n.partie.id).genauigkeitBot === 10);

  // Uebung mit ungueltigem Ziel, ziel bei normaler Partie
  const kaputt = speicherePartie(partie({ modus: 'uebung', startFen: UEBUNG_FEN, ziel: { ...ZIEL, besterZug: '<b>' } }));
  pruefe('Uebung mit ungueltigem ziel: ziel verworfen', !('ziel' in ladePartie(kaputt.partie.id)));
  const ohneZiel = speicherePartie(partie({ ziel: ZIEL }));
  pruefe('ziel nur bei Uebung', !('ziel' in ladePartie(ohneZiel.partie.id)));

  // aktualisierePartie aendert nichts, was die Wertung bestimmt
  aktualisierePartie(u.partie.id, { modus: 'normal', startFen: null, eroeffnung: 'Italienisch' });
  pruefe('aktualisierePartie: modus und startFen bleiben', ladePartie(u.partie.id).modus === 'uebung' && ladePartie(u.partie.id).startFen === UEBUNG_FEN
    && ladePartie(u.partie.id).eroeffnung === 'Italienisch');
}

// ---------- extra ----------
s = fakeSpeicher();
setzeSpeicher(s);
{
  const klein = { uebung: { getroffen: true, versuche: 1 }, taktik: [{ ply: 12, g: 1 }] };
  const a = speicherePartie(partie({ extra: klein }));
  pruefe('extra bis EXTRA_MAX bleibt', EXTRA_MAX === 400 && JSON.stringify(ladePartie(a.partie.id).extra) === JSON.stringify(klein));
  const r = still(() => speicherePartie(partie({ extra: { gross: 'x'.repeat(EXTRA_MAX) } })));
  pruefe('extra ueber 400 Zeichen wird verworfen und gewarnt', !('extra' in ladePartie(r.wert.partie.id)) && r.warnungen.length === 1 && /extra/.test(r.warnungen[0]), r.warnungen);
  const r2 = still(() => speicherePartie(partie({ extra: ['liste'] })));
  pruefe('extra als Liste wird verworfen', !('extra' in ladePartie(r2.wert.partie.id)) && r2.warnungen.length === 1);
  const r3 = speicherePartie(partie({ extra: {} }));
  pruefe('leeres extra wird nicht gespeichert', !('extra' in ladePartie(r3.partie.id)));
}

// ---------- Statistik nur wertende Partien, Durchschnitt ohne Kurzpartien ----------
s = fakeSpeicher();
setzeSpeicher(s);
{
  speicherePartie(partie({ genauigkeit: 70 }));
  speicherePartie(partie({ ergebnis: 'niederlage', genauigkeit: 80 }));
  speicherePartie(partie({ modus: 'uebung', startFen: UEBUNG_FEN, ziel: ZIEL, genauigkeit: 100, ergebnis: 'sieg' }));
  speicherePartie(partie({ startFen: UEBUNG_FEN, genauigkeit: 100 }));
  speicherePartie(partie({ ergebnis: 'remis', zuege: ['e2e4'], genauigkeit: 100 }));
  const st = statistik();
  pruefe('Statistik: Uebung und eigene Stellung zaehlen nicht', st.partien === 3 && st.siege === 1 && st.niederlagen === 1 && st.remis === 1, st);
  pruefe('Statistik: Ø Genauigkeit ohne Kurzpartie (1 Zug mit 100 %)', st.schnittGenauigkeit === 75, st.schnittGenauigkeit);
  pruefe('Statistik: Bestwert ohne Uebung und Kurzpartie', st.besteGenauigkeit === 80, st.besteGenauigkeit);
  pruefe('Verlauf zeigt trotzdem alle Partien', ladePartien().length === 5);
}

// ---------- Laufende Partie mit modus, ziel, extra, liveTrivial ----------
s = fakeSpeicher();
setzeSpeicher(s);
{
  speichereLaufendePartie({ botId: 'rudi', spielerFarbe: 'w', startFen: UEBUNG_FEN, zuege: ['h5f7'], hinweise: 0, zuruecknahmen: 0,
    liveKlassen: ['bester'], liveTrivial: [false], modus: 'uebung', ziel: ZIEL, extra: { uebung: { versuche: 2 } }, gestartet: '2026-10-16T10:00:00.000Z' });
  const l = ladeLaufendePartie();
  pruefe('Laufend: modus, ziel, extra, liveTrivial ueberstehen Speichern und Laden', l && l.modus === 'uebung' && JSON.stringify(l.ziel) === JSON.stringify(ZIEL)
    && JSON.stringify(l.extra) === '{"uebung":{"versuche":2}}' && JSON.stringify(l.liveTrivial) === '[false]' && l.startFen === UEBUNG_FEN, l);
  speichereLaufendePartie({ botId: 'rudi', spielerFarbe: 'w', zuege: ['e2e4'], liveKlassen: ['buch'] });
  const alt = ladeLaufendePartie();
  pruefe('Laufend ohne neue Felder (alter Stand): Standardwerte', alt.modus === 'normal' && alt.ziel === null && JSON.stringify(alt.extra) === '{}'
    && JSON.stringify(alt.liveTrivial) === '[]', alt);
  // W0+a: 'boss' ist jetzt ein Modus; ein unbekannter Modus ist hier 'turnier'
  s.setItem('schach-arena:v1:laufend', JSON.stringify({ botId: 'rudi', zuege: ['e2e4'], modus: 'turnier', ziel: ZIEL, extra: 'x', liveTrivial: [1, true, 'ja'] }));
  const falsch = still(() => ladeLaufendePartie()).wert;
  pruefe('Laufend: falsche Typen werden ersetzt (modus, ziel, extra, liveTrivial)', falsch.modus === 'normal' && falsch.ziel === null
    && JSON.stringify(falsch.extra) === '{}' && JSON.stringify(falsch.liveTrivial) === '[false,true,false]', falsch);
  s.setItem('schach-arena:v1:laufend', JSON.stringify({ botId: 'rudi', zuege: ['e2e4'], modus: 'uebung', ziel: { ...ZIEL, ply: -1 } }));
  pruefe('Laufend: Uebung mit kaputtem ziel -> ziel null', ladeLaufendePartie().ziel === null && ladeLaufendePartie().modus === 'uebung');
  s.setItem('schach-arena:v1:laufend', JSON.stringify({ botId: 'rudi', zuege: ['e2e4'], startFen: 42 }));
  pruefe('Laufend: startFen keine Zeichenkette -> keine laufende Partie', ladeLaufendePartie() === null);
  const gross = still(() => speichereLaufendePartie({ botId: 'rudi', zuege: [], extra: { x: 'y'.repeat(500) } }));
  pruefe('Laufend: zu grosses extra wird beim Speichern verworfen', gross.warnungen.length === 1 && JSON.stringify(ladeLaufendePartie().extra) === '{}'
    && !('extra' in JSON.parse(s.getItem('schach-arena:v1:laufend'))));
}

// ---------- Modul-Speicher ----------
s = fakeSpeicher();
setzeSpeicher(s);
{
  pruefe('MODUL_BUDGET wie im Bauplan (Welle 0: 324.000, unveraendert)', Object.isFrozen(MODUL_BUDGET) && MODUL_BUDGET.kartei === 160000 && MODUL_BUDGET.feier === 6000
    && MODUL_BUDGET.serie === 4000 && ['kartei', 'profil', 'alltag', 'uebung', 'bots', 'taktik', 'start', 'feier', 'serie'].reduce((a, k) => a + MODUL_BUDGET[k], 0) === 324000);
  const NEU = { funken: 25000, punkte: 40000, boss: 12000, raetsel: 30000, lernen: 30000, liga: 10000, sammeln: 20000, freunde: 15000 };
  pruefe('MODUL_BUDGET W0+a (SPIELKONZEPT 6.6): neue Module, zusammen 182.000',
    Object.entries(NEU).every(([k, v]) => MODUL_BUDGET[k] === v) && Object.keys(NEU).reduce((a, k) => a + MODUL_BUDGET[k], 0) === 182000);
  // w0plus-a-fix: S1-7 (Matt-Atlas) und Schub 2b bekommen eigene Module (vorher hatte finisher keins: "unbekanntes Modul")
  const FIX = { finisher: 10000, ausdruck: 6000, siegeslauf: 6000, werkstatt: 8000 };
  // Zu den 21 Modulen von w0plus-a-fix (536.000) kommen zuzweit (#26), Welle A (A1 teilen) und Welle C (S1-5
  // tagesraetsel); alle anderen Zahlen bleiben fest
  const DAZU = { zuzweit: 2000, teilen: 2000, tagesraetsel: 4000 };
  const summeNeu = Object.values(DAZU).reduce((a, b) => a + b, 0);
  pruefe('MODUL_BUDGET: 21 Module (536.000) plus zuzweit, teilen und tagesraetsel, zusammen 24 Module, 544.000',
    Object.entries(FIX).every(([k, v]) => MODUL_BUDGET[k] === v) && Object.keys(MODUL_BUDGET).length === 21 + Object.keys(DAZU).length
    && Object.values(MODUL_BUDGET).reduce((a, b) => a + b, 0) === 536000 + summeNeu, MODUL_BUDGET);
  pruefe('MODUL_BUDGET neu: zuzweit 2.000 (Zu zweit), teilen 2.000 (A1 Siegesbild), tagesraetsel 4.000 (S1-5)', Object.entries(DAZU).every(([k, v]) => MODUL_BUDGET[k] === v));
  const neuePakete = Object.keys(FIX).map((name) => {
    const m = speichereModul(name, { probe: name });
    const e = speichereModulEinstellungen(name, { stil: 'voll' });
    return [name, m.ok && e.ok && ladeModul(name, {}).probe === name && ladeModulEinstellungen(name, {}).stil === 'voll'];
  }).filter(([, gut]) => !gut);
  pruefe('w0plus-a-fix: finisher und die Pakete aus Schub 2b speichern Modul und Einstellungen (S1-7: Matt-Atlas und "Finisher: voll · kurz · aus")',
    neuePakete.length === 0, neuePakete);
  const atlas = {};
  for (const r of '12345678') for (const sp of 'abcdefgh') atlas[sp + r] = { figur: 'wQ', metall: 'weissgold', partieId: 'p' + 'x'.repeat(10) };
  const ids = Array.from({ length: 300 }, (_, i) => 'p' + String(i).padStart(10, '0'));
  pruefe('w0plus-a-fix: Matt-Atlas mit allen 64 Feldern (Figur, Metall, Partie) und 300 verarbeiteten IDs passt ins finisher-Budget',
    speichereModul('finisher', { atlas, mattbilder: ['grundreihe', 'erstickt', 'anastasia'], ids }).ok === true);
  for (const name of Object.keys(FIX)) s.removeItem('schach-arena:v1:modul:' + name);
  const std = { karten: [], stand: { n: 0 } };
  const leer = ladeModul('kartei', std);
  leer.stand.n = 5;
  pruefe('ladeModul ohne Daten: tiefe Kopie des Standards', JSON.stringify(leer) === '{"karten":[],"stand":{"n":5}}' && std.stand.n === 0);
  const r = speichereModul('kartei', { karten: [1, 2], stand: { n: 2 } });
  pruefe('speichereModul: ok mit Zeichenzahl, Schluessel modul:kartei', r.ok === true && r.zeichen === 32 && !r.grund
    && s.getItem('schach-arena:v1:modul:kartei') === '{"karten":[1,2],"stand":{"n":2}}', r);
  pruefe('ladeModul: gespeicherte Daten', JSON.stringify(ladeModul('kartei', std)) === '{"karten":[1,2],"stand":{"n":2}}');
  const zuGross = speichereModul('serie', { rekord: 'x'.repeat(MODUL_BUDGET.serie) });
  pruefe('speichereModul ueber Budget: abgelehnt (budget), nichts geschrieben', zuGross.ok === false && zuGross.grund === 'budget'
    && zuGross.zeichen > MODUL_BUDGET.serie && s.getItem('schach-arena:v1:modul:serie') === null, zuGross);
  pruefe('speichereModul genau am Budget: ok', speichereModul('serie', 'x'.repeat(MODUL_BUDGET.serie - 2)).ok === true);
  const unbekannt = speichereModul('kartie', { a: 1 });
  pruefe('speichereModul mit unbekanntem Namen: unbekannt', unbekannt.ok === false && unbekannt.grund === 'unbekannt' && s.getItem('schach-arena:v1:modul:kartie') === null);
  pruefe('ladeModul mit unbekanntem Namen: Standard (mit Warnung)', still(() => JSON.stringify(ladeModul('kartie', { a: 0 }))).wert === '{"a":0}');
  s.setItem('schach-arena:v1:modul:profil', '{kaputt');
  pruefe('ladeModul: kaputte Daten -> Standard', JSON.stringify(ladeModul('profil', { w: 800 })) === '{"w":800}');
  speichereModul('profil', [1, 2, 3]);
  pruefe('ladeModul: falsche Art (Liste statt Objekt) -> Standard', JSON.stringify(ladeModul('profil', { w: 800 })) === '{"w":800}');
  pruefe('ladeModul: ohne Standard null', ladeModul('taktik') === null);
  speichereModul('alltag', { tage: 3 });
  setzeZurueck();
  pruefe('setzeZurueck erfasst die Modul-Schluessel', s.getItem('schach-arena:v1:modul:kartei') === null && s.getItem('schach-arena:v1:modul:alltag') === null
    && ladeModul('kartei', null) === null);
}

// ---------- w0-fix: Einstellungen der Pakete ueberstehen "Fortschritt zuruecksetzen" ----------
// Beleg vorher: Reset loeschte modul:serie (Klangstufe) und modul:alltag (Ruhetag, Anzeige), obwohl daneben
// "Die Einstellungen bleiben." steht, und kein Paket erfuhr davon
s = fakeSpeicher();
setzeSpeicher(s);
{
  busZuruecksetzen();
  const resets = [];
  hoere('speicher:zurueckgesetzt', (d) => resets.push(d));
  const std = { stufe: 'alle' };
  const leer = ladeModulEinstellungen('serie', std);
  leer.stufe = 'x';
  pruefe('ladeModulEinstellungen ohne Daten: tiefe Kopie des Standards', JSON.stringify(ladeModulEinstellungen('serie', std)) === '{"stufe":"alle"}' && std.stufe === 'alle');
  const r = speichereModulEinstellungen('serie', { stufe: 'wichtig' });
  pruefe('speichereModulEinstellungen: Schluessel einstellungen:serie', r.ok === true && r.zeichen === 19
    && s.getItem('schach-arena:v1:einstellungen:serie') === '{"stufe":"wichtig"}', r);
  pruefe('speichereModulEinstellungen: Budget, unbekannter Name, falsche Art', speichereModulEinstellungen('alltag', { x: 'y'.repeat(MODUL_EINSTELLUNGEN_MAX) }).grund === 'budget'
    && speichereModulEinstellungen('kartie', {}).grund === 'unbekannt' && still(() => ladeModulEinstellungen('kartie', { a: 1 })).wert.a === 1
    && (speichereModulEinstellungen('taktik', [1]).ok && JSON.stringify(ladeModulEinstellungen('taktik', { an: true })) === '{"an":true}'));
  speichereModulEinstellungen('alltag', { ruhetag: 0, anzeigen: false });
  speichereModul('serie', { rekord: 7 });
  speichereModul('alltag', { tage: [1, 2] });
  speichereEinstellungen({ klang: false });
  speicherePartie(partie({}));
  const stand = speicherStand();
  const laenge = (k) => k.length + s.getItem(k).length;
  const P = 'schach-arena:v1:';
  pruefe('speicherStand: Einstellungen der Pakete zaehlen zu fortschritt', stand.teile.fortschritt === laenge(P + 'fortschritt') + laenge(P + 'einstellungen')
    + laenge(P + 'einstellungen:serie') + laenge(P + 'einstellungen:alltag') + laenge(P + 'einstellungen:taktik') && stand.teile.sonst === 0, stand.teile);
  setzeZurueck();
  pruefe('Reset: Modul-Daten weg, Einstellungen der App und der Pakete bleiben', ladeModul('serie', null) === null && ladeModul('alltag', null) === null
    && ladePartien().length === 0 && ladeEinstellungen().klang === false && ladeModulEinstellungen('serie', std).stufe === 'wichtig'
    && ladeModulEinstellungen('alltag', {}).ruhetag === 0);
  pruefe('Reset: Ereignis speicher:zurueckgesetzt { mitEinstellungen: false }', resets.length === 1 && resets[0].mitEinstellungen === false, resets);
  setzeZurueck({ mitEinstellungen: true });
  pruefe('Reset mit Einstellungen: auch die der Pakete weg', ladeModulEinstellungen('serie', std).stufe === 'alle' && ladeEinstellungen().klang === true
    && [...s.m.keys()].length === 0 && resets.length === 2 && resets[1].mitEinstellungen === true, [...s.m.keys()]);
  busZuruecksetzen();
}

// ---------- speicherStand / rohSpeicher ----------
s = fakeSpeicher();
setzeSpeicher(s);
{
  speichereEinstellungen({ klang: false });
  const r1 = speicherePartie(partie({}), { zuege: [{ ply: 0, farbe: 'w', klasse: 'gut' }] });
  speichereLaufendePartie({ botId: 'rudi', zuege: [] });
  speichereModul('kartei', { k: 'x'.repeat(100) });
  speichereModul('feier', { e: [] });
  s.setItem('andere-app:daten', 'abc');
  s.setItem('schach-arena:v1:sonstwas', 'xy');
  const stand = speicherStand();
  const laenge = (k) => k.length + s.getItem(k).length;
  const P = 'schach-arena:v1:';
  const t = stand.teile;
  pruefe('speicherStand: Grenze 2.500.000', stand.grenze === 2500000 && SPEICHER_GRENZE === 2500000);
  pruefe('speicherStand: Partien und Reviews', t.partien === laenge(P + 'partien') && t.reviews === laenge(P + 'review:' + r1.partie.id), t);
  pruefe('speicherStand: Fortschritt mit Einstellungen und laufender Partie', t.fortschritt === laenge(P + 'fortschritt') + laenge(P + 'einstellungen') + laenge(P + 'laufend'), t);
  pruefe('speicherStand: Module einzeln, unbenutzte mit 0', t.module.kartei === laenge(P + 'modul:kartei') && t.module.feier === laenge(P + 'modul:feier')
    && t.module.profil === 0 && Object.keys(t.module).length === Object.keys(MODUL_BUDGET).length, t.module);
  pruefe('speicherStand: fremde Seiten und Sonstiges getrennt', t.fremd === laenge('andere-app:daten') && t.sonst === laenge(P + 'sonstwas'), t);
  const summe = t.partien + t.reviews + t.fortschritt + t.sonst + t.fremd + Object.values(t.module).reduce((a, b) => a + b, 0);
  const alles = [...s.m.keys()].reduce((a, k) => a + laenge(k), 0);
  pruefe('speicherStand summiert richtig', stand.zeichen === summe && stand.zeichen === alles, { zeichen: stand.zeichen, summe, alles });

  const roh = rohSpeicher();
  const sch = roh.schluessel();
  pruefe('rohSpeicher: nur eigene Schluessel, sortiert', roh.praefix === P && sch.every((k) => k.startsWith(P)) && !sch.includes('andere-app:daten')
    && sch.includes(P + 'modul:kartei') && JSON.stringify(sch) === JSON.stringify([...sch].sort()), sch);
  pruefe('rohSpeicher: lies liefert den Rohtext', roh.lies(P + 'modul:feier') === '{"e":[]}' && roh.lies('andere-app:daten') === null);
  pruefe('rohSpeicher: schreib nur eigene Schluessel und nur Text', roh.schreib(P + 'modul:start', '{"fertig":true}') === true
    && roh.schreib('andere-app:daten', 'x') === false && roh.schreib(P + 'modul:start', { a: 1 }) === false
    && s.getItem('andere-app:daten') === 'abc' && ladeModul('start', {}).fertig === true);
  roh.entferne(P + 'modul:start');
  roh.entferne('andere-app:daten');
  pruefe('rohSpeicher: entferne nur eigene Schluessel', s.getItem(P + 'modul:start') === null && s.getItem('andere-app:daten') === 'abc');
}

// ---------- speicher:fehler und Reihenfolge Fortschritt vor Liste ----------
{
  busZuruecksetzen();
  const fehlerEreignisse = [];
  hoere('speicher:fehler', (d) => fehlerEreignisse.push(d));
  s = fakeSpeicher(400);
  setzeSpeicher(s);
  const r = speichereModul('kartei', { k: 'x'.repeat(1000) });
  pruefe('voller Speicher: speichereModul meldet voll', r.ok === false && r.grund === 'voll', r);
  pruefe('voller Speicher: Ereignis speicher:fehler mit Schluessel und Grund', fehlerEreignisse.length === 1
    && fehlerEreignisse[0].schluessel === 'schach-arena:v1:modul:kartei' && fehlerEreignisse[0].grund === 'voll', fehlerEreignisse);

  // Liste passt nicht mehr, der kleine Fortschritt schon: der Sieg bleibt gebucht
  s = fakeSpeicher(Infinity);
  const setze = s.setItem;
  s.setItem = (k, v) => {
    if (k === 'schach-arena:v1:partien') { const e = new Error('voll'); e.name = 'QuotaExceededError'; throw e; }
    setze(k, v);
  };
  setzeSpeicher(s);
  fehlerEreignisse.length = 0;
  const sieg = speicherePartie(partie({ genauigkeit: 90 }));
  const fs = ladeFortschritt();
  pruefe('Reihenfolge: Fortschritt vor der Liste (Sieg und Freischaltung gebucht)', fs.bots.benno.sterne[0] === true && fs.bots.benno.siege === 1
    && sieg.neuFreigeschaltet && sieg.neuFreigeschaltet.id === 'paula', fs.bots.benno);
  pruefe('Liste scheitert: speicher:fehler fuer die Partienliste', fehlerEreignisse.length === 1 && fehlerEreignisse[0].schluessel === 'schach-arena:v1:partien', fehlerEreignisse);

  // anderer Fehler als "voll" (z. B. gesperrter Speicher): grund fehler
  s = fakeSpeicher();
  s.setItem = () => { throw new Error('SecurityError'); };
  setzeSpeicher(s);
  fehlerEreignisse.length = 0;
  speichereEinstellungen({ klang: true });
  pruefe('anderer Schreibfehler: speicher:fehler mit grund fehler', fehlerEreignisse.length === 1 && fehlerEreignisse[0].grund === 'fehler', fehlerEreignisse);
  busZuruecksetzen();
}

// ---------- Kompakte Reviews ----------
// Echte Analyse wie in den Review-Tests (analysierePartie), mit einer Fake-Engine, die lange
// Hauptvarianten liefert (erste legale Zuege), damit besteLinie/besteLinieSan wirklich gefuellt sind.
class LinienEngine {
  async analyse(fen, opts = {}) {
    const c = new Chess(fen);
    const zuege = c.moves({ verbose: true });
    if (!zuege.length) {
      const e = c.inCheck() ? { cp: null, mate: c.turn() === 'w' ? -1 : 1 } : { cp: 0, mate: null };
      return { fen, turn: c.turn(), depth: 0, bestmove: null, lines: [{ multipv: 1, depth: 0, eval: e, pv: [] }] };
    }
    const linie = (start) => {
      const b = new Chess(fen);
      const pv = [];
      let m = start;
      while (m && pv.length < 10) {
        pv.push(b.move(m).lan);
        const n = b.moves({ verbose: true });
        m = n.length ? n[n.length - 1] : null;
      }
      return pv;
    };
    const lines = [zuege[0], zuege[zuege.length - 1]].slice(0, Math.min(opts.multipv || 1, zuege.length))
      .map((m, i) => ({ multipv: i + 1, depth: opts.depth, eval: { cp: 30 - 25 * i + (fen.length % 7), mate: null }, pv: linie(m) }));
    return { fen, turn: c.turn(), depth: opts.depth, bestmove: lines[0].pv[0], lines };
  }
}
const OPER = 'e4 e5 Nf3 d6 d4 Bg4 dxe5 Bxf3 Qxf3 dxe5 Bc4 Nf6 Qb3 Qe7 Nc3 c6 Bg5 b5 Nxb5 cxb5 Bxb5+ Nbd7 O-O-O Rd8 Rxd7 Rxd7 Rd1 Qe6 Bxd7+ Nxd7 Qb8+ Nxb8 Rd8#';
const operUci = (() => { const c = new Chess(); return OPER.split(' ').map((x) => c.move(x).lan); })();
const operReview = await analysierePartie(new LinienEngine(), operUci, { spielerFarbe: 'w', elo: { b: 1500 }, tiefe: 12 });

// tiefer Vergleich ohne Ruecksicht auf die Reihenfolge der Schluessel
function gleich(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return Number.isNaN(a) && Number.isNaN(b);
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && gleich(a[k], b[k]));
}

{
  pruefe('MAX_REVIEWS = 12 (W0+a, vorher 20)', MAX_REVIEWS === 12);
  const z = operReview.zuege;
  pruefe('Testanalyse: 33 Zuege mit langer bester Linie', z.length === 33 && z.filter((x) => x.besteLinie.length >= 6 && x.besteLinieSan.length === x.besteLinie.length).length >= 30,
    z.map((x) => x.besteLinie.length));
  const t0 = performance.now();
  const k = kompaktReview(operReview);
  const t1 = performance.now();
  const voll = ergaenzeReviewFelder(JSON.parse(JSON.stringify(k)));
  const t2 = performance.now();
  console.log(`       Messung: 33 Zuege kompakt ${(t1 - t0).toFixed(1)} ms, ergaenzen ${(t2 - t1).toFixed(1)} ms; `
    + `Zeichen ${JSON.stringify(operReview).length} -> ${JSON.stringify(k).length}`);
  pruefe('kompakt: Merker kompakt, ableitbare Felder fehlen (fenNachher nur beim letzten Zug)', k.kompakt === 1
    && k.zuege.every((x) => !('sanDe' in x) && !('besterZugSanDe' in x) && !('besteLinieSan' in x) && !('nummer' in x))
    && k.zuege.slice(0, -1).every((x) => !('fenNachher' in x)) && 'fenNachher' in k.zuege[32]);
  pruefe('kompakt: Original unveraendert', 'sanDe' in operReview.zuege[0] && !('kompakt' in operReview));
  pruefe('kompakt: mindestens 20 % kleiner', JSON.stringify(k).length < 0.8 * JSON.stringify(operReview).length,
    [JSON.stringify(k).length, JSON.stringify(operReview).length]);
  pruefe('kompakt hin und zurueck: dieselben Felder (tiefer Vergleich)', gleich(voll, operReview));
  pruefe('kompakt hin und zurueck: auch dieselbe Reihenfolge der Felder', JSON.stringify(voll) === JSON.stringify(operReview));

  s = fakeSpeicher();
  setzeSpeicher(s);
  const id = speicherePartie(partie({}), operReview).partie.id;
  const roh = JSON.parse(s.getItem('schach-arena:v1:review:' + id));
  pruefe('speichereReview speichert kompakt', roh.kompakt === 1 && !('sanDe' in roh.zuege[0]));
  pruefe('ladeReview liefert wieder die volle Analyse', gleich(ladeReview(id), operReview));
  {
    const geladen = ladeReview(id);
    const art = (z) => (Object.getOwnPropertyDescriptor(z, 'besteLinieSan').get ? 'faul' : 'wert');
    pruefe('besteLinieSan: erst beim Lesen berechnet (faules Feld)', geladen.zuege.every((z) => art(z) === 'faul' && 'besteLinieSan' in z));
    const linie = geladen.zuege[22].besteLinieSan;
    pruefe('besteLinieSan: beim Lesen richtig und danach ein normales Feld', JSON.stringify(linie) === JSON.stringify(operReview.zuege[22].besteLinieSan)
      && art(geladen.zuege[22]) === 'wert' && art(geladen.zuege[21]) === 'faul');
    const nochmal = kompaktReview(geladen);
    pruefe('erneut kompakt: faule Felder werden nicht ausgerechnet', art(geladen.zuege[5]) === 'faul' && nochmal.zuege.every((z) => !('besteLinieSan' in z)));
    geladen.zuege[3].besteLinieSan = ['x'];
    pruefe('faules Feld laesst sich ueberschreiben', JSON.stringify(geladen.zuege[3].besteLinieSan) === '["x"]');
    pruefe('Spread und JSON wie bei einem normalen Feld', JSON.stringify({ ...ladeReview(id).zuege[7] }) === JSON.stringify(operReview.zuege[7]));
  }
  // altes, volles Review (vor Runde 4 gespeichert) laedt unveraendert
  s.setItem('schach-arena:v1:review:' + id, JSON.stringify(operReview));
  pruefe('altes volles Review laedt unveraendert', JSON.stringify(ladeReview(id)) === JSON.stringify(operReview));
  // unvollstaendige Eintraege (z. B. aus Tests) bleiben, wie sie sind
  const teil = { genauigkeit: { w: 80, b: 70 }, zuege: [{ ply: 0, farbe: 'w', san: 'e4', klasse: 'gut' }] };
  speichereReview(id, teil);
  pruefe('unvollstaendiges Review: unveraendert hin und zurueck', JSON.stringify(ladeReview(id)) === JSON.stringify(teil) && !('kompakt' in JSON.parse(s.getItem('schach-arena:v1:review:' + id))));
  pruefe('kompakt: doppelt kompakt aendert nichts, ergaenzen ohne Merker auch nicht', kompaktReview(k) === k && ergaenzeReviewFelder(operReview) === operReview);
  pruefe('kompakt: leeres oder kaputtes Review bleibt', kompaktReview(null) === null && kompaktReview({ zuege: [] }).zuege.length === 0
    && ergaenzeReviewFelder({ kompakt: 1, zuege: [null] }).zuege[0] === null);
  // Rechenzeit einer langen Partie (80 Halbzuege) fuer das iPad abschaetzen
  const lang = { ...operReview, zuege: [] };
  for (let i = 0; i < 80; i++) lang.zuege.push({ ...operReview.zuege[i % 33], ply: i });
  const tl0 = performance.now();
  ergaenzeReviewFelder(kompaktReview(lang));
  console.log(`       Messung: 80 Halbzuege kompakt und zurueck ${(performance.now() - tl0).toFixed(1)} ms`);
}

// ---------- w0c: fehlende Analysen im Hintergrund nachholen (js/nachholen.js) ----------
// Beleg vorher: App waehrend der Auswertung beendet -> Genauigkeit null, Stern 2 fehlt, bis Flo genau diese
// Analyse oeffnet. Die Arena holt das jetzt nach (hier mit einer Fake-Engine, im Browser in app.test).
{
  const { offenePartien, starteNachholen, zustand } = await import('../js/nachholen.js');
  const { nachlese } = await import('../js/feier.js');
  const { stellungsSchluessel } = await import('../js/openings.js');
  // Fake-Engine: gleiche Bewertung ueberall (jeder Zug Verlust 0), optional langsam, stop() bricht ab
  class Fake {
    constructor(ms = 0) { this.ms = ms; this.aufrufe = []; this.stops = 0; this.offen = null; }
    analyse(fen, o = {}) {
      this.aufrufe.push({ fen, ...o });
      const c = new Chess(fen);
      const zuege = c.moves({ verbose: true });
      const fertig = () => {
        if (!zuege.length) {
          const m = c.inCheck() ? (c.turn() === 'w' ? -1 : 1) : null;
          return { fen, depth: 0, lines: [{ multipv: 1, depth: 0, eval: m ? { cp: null, mate: m } : { cp: 0, mate: null }, pv: [] }] };
        }
        const lines = zuege.slice(0, Math.min(o.multipv || 1, zuege.length)).map((z, i) => ({ multipv: i + 1, depth: o.depth, eval: { cp: 20, mate: null }, pv: [z.lan] }));
        return { fen, depth: o.depth, bestmove: lines[0].pv[0], lines };
      };
      if (!this.ms) return Promise.resolve(fertig());
      return new Promise((r) => {
        const u = setTimeout(() => { this.offen = null; r(fertig()); }, this.ms);
        this.offen = () => { clearTimeout(u); this.offen = null; r({ fen, depth: 1, lines: [], abgebrochen: true }); };
      });
    }
    stop() { this.stops++; if (this.offen) this.offen(); }
  }
  const SCHAEFER = ['e2e4', 'e7e5', 'f1c4', 'b8c6', 'd1h5', 'g8f6', 'h5f7'];
  let n = 0;
  const datum = () => new Date(Date.UTC(2026, 9, 17, 9, 0, ++n)).toISOString();
  const sieg = (teil = {}) => ({ datum: datum(), botId: 'benno', botStufe: 1, spielerFarbe: 'w', zuege: SCHAEFER, ergebnis: 'sieg',
    grund: 'matt', hinweise: 0, zuruecknahmen: 0, genauigkeit: null, ...teil });
  s = fakeSpeicher();
  setzeSpeicher(s);
  busZuruecksetzen();
  const kaputt = speicherePartie(sieg({ zuege: ['e2e4', 'e2e4'] })).partie.id;          // ungueltig: wird einmal versucht
  const alt = speicherePartie(sieg()).partie.id;                                         // aelteste offene
  const fertigP = speicherePartie(sieg({ genauigkeit: 70, analysiert: true })).partie.id;   // schon analysiert (Review weg)
  // w0-fix: Ergebnis verlassen, bevor die Analyse fertig war: Genauigkeit nur aus der Live-Bewertung
  const nurLive = speicherePartie(sieg({ botId: 'lisa', botStufe: 4, genauigkeit: 99.6, genauigkeitQuelle: 'live' })).partie.id;
  // vor Runde 4 gespeichert (ohne modus): mit Genauigkeit gilt sie als fertig, wie bisher
  const vorRunde4 = speicherePartie(sieg({ genauigkeit: 72 })).partie.id;
  {
    const roh = JSON.parse(s.getItem('schach-arena:v1:partien'));
    delete roh.find((x) => x.id === vorRunde4).modus;
    s.setItem('schach-arena:v1:partien', JSON.stringify(roh));
  }
  const uebung = speicherePartie(sieg({ modus: 'uebung', startFen: '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1', zuege: ['a1a8'] })).partie.id;
  const ohneZug = speicherePartie(sieg({ zuege: [] })).partie.id;
  const mitReview = speicherePartie(sieg(), { genauigkeit: { w: null, b: null }, zuege: [] }).partie.id;
  const neu = speicherePartie(sieg({ botId: 'hilde', botStufe: 2 })).partie.id;          // neueste offene
  pruefe('Nachholen: Fortschritt vorher wie nach einem Abbruch (Stern 2 fehlt)', JSON.stringify(ladeFortschritt().bots.benno.sterne) === '[true,false,true]');
  const offen = offenePartien({ max: 5 }).map((p) => p.id);
  // w0-fix (Befund: partie:analysiert kam nie, wenn Flo das Ergebnis vor dem Ende der Analyse verliess): offen ist
  // jede wertende Partie ohne volle Analyse (Feld analysiert), auch mit Live-Genauigkeit; alte ohne modus nur ohne Genauigkeit
  pruefe('Nachholen: offen sind wertende Partien ohne volle Analyse (auch mit Live-Genauigkeit), ohne Review, mit eigenem Zug, neueste zuerst',
    JSON.stringify(offen) === JSON.stringify([neu, nurLive, alt, kaputt]), { offen, neu, nurLive, alt, kaputt, fertigP, vorRunde4, uebung, ohneZug, mitReview });
  pruefe('Nachholen: hoechstens max, nur unter den neuesten', offenePartien({ max: 1 }).map((p) => p.id)[0] === neu
    && offenePartien({ max: 5, aus: 1 }).length === 1 && offenePartien({ max: 5, aus: 0 }).length === 0);

  const ereignisse = [];
  const abmelden = hoere('partie:analysiert', (d) => ereignisse.push(d));
  const fake = new Fake();
  const vorab = new Map();
  // die Stellung nach 1.e4 liegt schon tief genug vor, die Grundstellung nur flach (Zeitlimit): wird neu gerechnet
  const START = new Chess().fen();
  const NACH_E4 = (() => { const c = new Chess(); c.move('e4'); return c.fen(); })();
  vorab.set(stellungsSchluessel(NACH_E4), { fen: NACH_E4, depth: 12, lines: [{ multipv: 1, depth: 12, eval: { cp: 20, mate: null }, pv: ['e7e5'] }, { multipv: 2, depth: 12, eval: { cp: 25, mate: null }, pv: ['c7c5'] }] });
  vorab.set(stellungsSchluessel(START), { fen: START, depth: 5, lines: [{ multipv: 1, depth: 5, eval: { cp: 20, mate: null }, pv: ['e2e4'] }, { multipv: 2, depth: 5, eval: { cp: 20, mate: null }, pv: ['d2d4'] }] });
  const app = { engine: async () => fake, einstellungen: () => ({ tiefe: 12 }), vorab };
  const gezeichnet = [];
  const lauf = starteNachholen(app, { max: 4, beiPartie: (x) => gezeichnet.push(x.partie.id) });
  pruefe('Nachholen: zustand() laeuft', zustand().laeuft === true);
  const anzahl = await lauf.fertig;
  const pn = ladePartie(neu);
  const pa = ladePartie(alt);
  const pl = ladePartie(nurLive);
  pruefe('Nachholen: drei Partien nachgerechnet (die kaputte nicht), neueste zuerst', anzahl === 3 && JSON.stringify(zustand().fertig.slice(-3)) === JSON.stringify([neu, nurLive, alt])
    && JSON.stringify(gezeichnet) === JSON.stringify([neu, nurLive, alt]), { anzahl, z: zustand(), gezeichnet });
  pruefe('Nachholen: Genauigkeit, Review und Stern 2 da (Datensatz und Fortschritt)', pa.genauigkeit === 100 && hatReview(alt) && pa.analysiert === true
    && pa.genauigkeitQuelle === 'analyse'
    && JSON.stringify(pa.sterne) === '[true,true,true]' && JSON.stringify(ladeFortschritt().bots.benno.sterne) === '[true,true,true]'
    && JSON.stringify(ladeFortschritt().bots.hilde.sterne) === '[true,true,true]', pa);
  pruefe('Nachholen: Live-Genauigkeit durch die volle Analyse ersetzt (einmal), Review gespeichert', pl.genauigkeit === 100 && pl.genauigkeitQuelle === 'analyse'
    && pl.analysiert === true && hatReview(nurLive), pl);
  pruefe('Nachholen: Ereignis partie:analysiert mit quelle "nachholen" je Partie (auch fuer die mit Live-Genauigkeit)', ereignisse.length === 3
    && ereignisse.every((e) => e.quelle === 'nachholen' && e.wertet === true && e.review)
    && ereignisse[0].partieId === neu && ereignisse[1].partieId === nurLive && JSON.stringify(ereignisse[2].neueSterne) === '[false,true,false]',
    ereignisse.map((e) => [e.partieId, e.quelle, e.neueSterne]));
  const tiefen = fake.aufrufe.map((a) => a.depth);
  pruefe('Nachholen: eingestellte Tiefe, flache Vorab-Analyse neu, tiefe wiederverwendet', tiefen.every((t) => t === 12)
    && fake.aufrufe.some((a) => stellungsSchluessel(a.fen) === stellungsSchluessel(START))
    && !fake.aufrufe.some((a) => stellungsSchluessel(a.fen) === stellungsSchluessel(NACH_E4)), fake.aufrufe.length);
  const nl = nachlese();
  pruefe('Nachholen: neu verdienter Stern kommt in die Nachlese (still, nicht ins Overlay)', nl.length === 2 && nl.every((f) => f.quelle === 'stern-nachgeholt' && f.art === 'zeile')
    && nl.some((f) => f.titel === 'Neuer Stern gegen Bauer Lukas' && /Nachträglich ausgewertet: 100 % Genauigkeit\./.test(f.text)), nl);
  pruefe('Nachholen: kaputte Partie nur einmal versucht', offenePartien({ max: 5 }).length === 0 && zustand().laeuft === false);

  // Abbruch (Arena verlassen, Partie startet): laufende Suche gestoppt, nichts gespeichert, spaeter weiter
  const spaet = speicherePartie(sieg({ botId: 'kalle', botStufe: 3 })).partie.id;
  const lahm = new Fake(40);
  const app2 = { engine: async () => lahm, einstellungen: () => ({ tiefe: 12 }), vorab: new Map() };
  const l2 = starteNachholen(app2, { max: 2 });
  await new Promise((r) => setTimeout(r, 100));
  const vorStop = lahm.aufrufe.length;
  l2.stop();
  const anz2 = await l2.fertig;
  pruefe('Nachholen: stop() bricht die laufende Suche ab, nichts gespeichert', anz2 === 0 && lahm.stops >= 1 && vorStop >= 1 && vorStop < 7
    && ladePartie(spaet).genauigkeit === null && !hatReview(spaet) && zustand().laeuft === false, { anz2, stops: lahm.stops, vorStop });
  pruefe('Nachholen: abgebrochene Partie bleibt offen (wird spaeter nachgeholt)', offenePartien().some((p) => p.id === spaet));
  // ein neuer Start stoppt den alten; stop() vor dem ersten Schritt wirkt sofort
  const l3 = starteNachholen(app2, { max: 2 });
  const l4 = starteNachholen({ ...app2, engine: async () => fake }, { max: 2 });
  const [a3, a4] = await Promise.all([l3.fertig, l4.fertig]);
  pruefe('Nachholen: neuer Start beendet den alten', a3 === 0 && a4 === 1 && Number.isFinite(ladePartie(spaet).genauigkeit), { a3, a4 });
  const l5 = starteNachholen(app2);
  l5.stop();
  pruefe('Nachholen: stop() vor dem ersten Schritt', (await l5.fertig) === 0);
  // w0plus-a-fix (Befund des Pruefers): Boss-Partien (und frei, Spielhalle) wurden nie nachgeholt; Funken und Boss-Tafel
  // haengen an partie:analysiert. Uebungen bleiben aussen vor.
  s = fakeSpeicher();
  setzeSpeicher(s);
  ereignisse.length = 0;
  const bossP = speicherePartie(sieg({ botId: 'baron-pruef', botStufe: null, modus: 'boss', boss: { id: 'baron-pruef', stufe: 'standard', staerke: 1080 } })).partie.id;
  const freiP = speicherePartie(sieg({ modus: 'frei' })).partie.id;
  const spielP = speicherePartie(sieg({ modus: 'spiel' })).partie.id;
  const uebungP = speicherePartie(sieg({ modus: 'uebung', startFen: '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1', zuege: ['a1a8'] })).partie.id;
  const offen2 = offenePartien({ max: 5 }).map((p) => p.id);
  pruefe('Nachholen: auch Boss-, freie und Spielhallen-Partien sind offen, Uebungen nie', JSON.stringify(offen2) === JSON.stringify([spielP, freiP, bossP])
    && !offen2.includes(uebungP), { offen2, bossP, freiP, spielP, uebungP });
  const fake3 = new Fake();
  const n3 = await starteNachholen({ engine: async () => fake3, einstellungen: () => ({ tiefe: 12 }), vorab: new Map() }, { max: 5 }).fertig;
  const bossEreignis = ereignisse.find((e) => e.partieId === bossP);
  pruefe('Nachholen: Boss-Partie bekommt partie:analysiert (modus boss, wertet false, keine Sterne), Review gespeichert',
    n3 === 3 && !!bossEreignis && bossEreignis.modus === 'boss' && bossEreignis.wertet === false && JSON.stringify(bossEreignis.neueSterne) === '[false,false,false]'
    && hatReview(bossP) && ladePartie(bossP).analysiert === true && JSON.stringify(ladePartie(bossP).sterne) === '[false,false,false]'
    && offenePartien({ max: 5 }).length === 0, { n3, bossEreignis: bossEreignis && [bossEreignis.modus, bossEreignis.wertet] });
  abmelden();
}


// =====================================================================
// W0+a "Spiel-Fundament": neue Felder, Modi, Ausduennen, dauerhafter Speicher
// =====================================================================
{
  s = fakeSpeicher();
  setzeSpeicher(s);
  pruefe('Einstellungen W0+a: zaehlwerk und funkenlinie aus, lebensleiste an', STANDARD_EINSTELLUNGEN.zaehlwerk === false
    && STANDARD_EINSTELLUNGEN.funkenlinie === false && STANDARD_EINSTELLUNGEN.lebensleiste === true && ladeEinstellungen().lebensleiste === true);
  // Datensatz: gueltige Felder bleiben, falsche fallen still weg
  const BOSS = { id: 'bergwirt', stufe: 'meister', woche: '2026-11-16', staerke: 1080.4 };
  const gut = speicherePartie(partie({
    modus: 'boss', seed: 4294967295, tempo: { grund: 900, zuschlag: 10 }, zeiten: [12, 40, 0], boss: BOSS, liga: { saison: 'saison-1', runde: 5 },
  })).partie;
  const gelesen = ladePartie(gut.id);
  pruefe('Datensatz W0+a: seed, tempo, zeiten, boss, liga bleiben', gelesen.seed === 4294967295 && JSON.stringify(gelesen.tempo) === '{"grund":900,"zuschlag":10}'
    && JSON.stringify(gelesen.zeiten) === '[12,40,0]' && JSON.stringify(gelesen.boss) === '{"id":"bergwirt","stufe":"meister","woche":"2026-11-16","staerke":1080}'
    && JSON.stringify(gelesen.liga) === '{"saison":"saison-1","runde":5}', gelesen);
  const schlecht = speicherePartie(partie({
    seed: -1, tempo: { grund: 0, zuschlag: 5 }, zeiten: [1, 2.5], boss: BOSS, liga: { saison: 'X', runde: 0 },
  })).partie;
  const g2 = ladePartie(schlecht.id);
  pruefe('Datensatz W0+a: falsche Felder fallen still weg (boss nur im Modus boss)', !('seed' in g2) && !('tempo' in g2) && !('zeiten' in g2)
    && !('boss' in g2) && !('liga' in g2), Object.keys(g2));
  pruefe('Datensatz W0+a: mehr Zeiten als Zuege fallen weg', !('zeiten' in ladePartie(speicherePartie(partie({ zeiten: Array(21).fill(5) })).partie.id)));
  pruefe('Datensatz W0+a: Boss-Stufe nur standard oder meister', JSON.stringify(BOSS_STUFEN) === '["standard","meister"]'
    && !('boss' in ladePartie(speicherePartie(partie({ modus: 'boss', boss: { id: 'bergwirt', stufe: 'leicht' } })).partie.id)));
  // Boss, frei, Spielhalle: werten nie (keine Sterne, kein Fortschritt, nicht in der Statistik)
  s = fakeSpeicher();
  setzeSpeicher(s);
  const vorher = statistik().partien;
  const erg = ['boss', 'frei', 'spiel'].map((m) => speicherePartie(partie({ modus: m, boss: m === 'boss' ? BOSS : undefined })));
  pruefe('Modi boss, frei, spiel: werten nie (keine Sterne, keine Freischaltung, nicht in der Statistik)', erg.every((e) => e.wertet === false
    && JSON.stringify(e.partie.sterne) === '[false,false,false]' && e.neuFreigeschaltet === null) && gesamtSterne() === 0
    && statistik().partien === vorher && !istFreigeschaltet(2), erg.map((e) => e.wertet));
  pruefe('wertet: boss, frei, spiel nie, auch aus der Grundstellung', ['boss', 'frei', 'spiel'].every((m) => !wertet({ modus: m })));
  // w0plus-a-fix (Befund des Pruefers): ein angemeldeter Gast im Modus normal wertete wie ein Leiter-Bot (3 Sterne,
  // Statistik, "Nächster Gegner" Lukas). Angemeldete Bots gehoeren nie zur Leiter.
  const abGast = registriereBot({ id: 'pruefer-gast', art: 'gast', name: 'Gast Maik', avatar: 'assets/avatare/01-bauer-benno.svg',
    staerke: { ...botNachId('benno').staerke } });
  const vorGast = statistik().partien;
  const gastErg = speicherePartie(partie({ botId: 'pruefer-gast', botStufe: null, modus: 'normal' }));
  pruefe('wertet: Partie gegen einen angemeldeten Gast (Modus normal, Grundstellung) wertet nie: keine Sterne, nicht in der Statistik',
    gastErg.wertet === false && JSON.stringify(gastErg.partie.sterne) === '[false,false,false]' && statistik().partien === vorGast
    && !wertet({ modus: 'normal', botId: 'pruefer-gast' }) && wertet({ modus: 'normal', botId: 'rudi' }) && wertet({ modus: 'normal' }),
    { wertet: gastErg.wertet, sterne: gastErg.partie.sterne });
  abGast();
  pruefe('wertet: auch nach dem Abmelden (Paket nicht geladen) wertet die Gast-Partie nicht', !wertet(ladePartie(gastErg.partie.id)));

  // laufende Partie: Felder und angemeldete Bots
  const ab = registriereBot({ id: 'bergwirt', art: 'boss', archiv: true, name: 'Der Bergwirt', avatar: 'assets/avatare/06-professor-turm.svg',
    staerke: { ...botNachId('turm').staerke } });
  speichereLaufendePartie({ botId: 'bergwirt', spielerFarbe: 'w', zuege: ['e2e4'], modus: 'boss', boss: BOSS, seed: 7, tempo: { grund: 600, zuschlag: 5 },
    zeiten: [30, 99], liga: null });
  const l = ladeLaufendePartie();
  pruefe('Laufend W0+a: angemeldeter Bot (Boss) wird geladen, mit seed, boss und tempo', l && l.botId === 'bergwirt' && l.seed === 7
    && l.boss && l.boss.stufe === 'meister' && l.tempo.grund === 600 && !('zeiten' in l), l);
  ab();
  pruefe('Laufend W0+a: Bot nicht mehr angemeldet -> keine laufende Partie', ladeLaufendePartie() === null);
  speichereLaufendePartie({ botId: 'rudi', spielerFarbe: 'w', zuege: [], modus: 'normal', boss: BOSS, seed: 1.5 });
  const l2 = ladeLaufendePartie();
  pruefe('Laufend W0+a: boss ausserhalb des Boss-Modus und ein krummer Seed fallen weg', l2 && !('boss' in l2) && !('seed' in l2), l2);

  // alte Speicherstaende: 20 Analysen -> still auf 12 ausduennen, die neuesten bleiben
  s = fakeSpeicher();
  setzeSpeicher(s);
  const alt = [];
  for (let i = 0; i < 20; i++) alt.push(speicherePartie(partie({}), null).partie.id);
  // wie vor W0+a gespeichert: 20 Analysen direkt in den Speicher (speichereReview kuerzt schon auf 12)
  for (const id of alt) s.setItem('schach-arena:v1:review:' + id, JSON.stringify({ zuege: [{ ply: 0, farbe: 'w', klasse: 'gut' }] }));
  s.setItem('schach-arena:v1:review:pverwaist', JSON.stringify({ zuege: [] }));
  const neueste = ladePartien().map((p) => p.id);
  let gelesenReviews = 0;
  const getItem = s.getItem;
  s.getItem = (k) => { if (String(k).includes(':review:')) gelesenReviews++; return getItem(k); };
  const weg = duenneAnalysenAus();
  s.getItem = getItem;
  const uebrig = neueste.filter((id) => hatReview(id));
  pruefe('Ausduennen: 21 Analysen (eine ohne Partie) -> 12, die neuesten bleiben', weg === 9 && uebrig.length === 12
    && JSON.stringify(uebrig) === JSON.stringify(neueste.slice(0, 12)) && s.getItem('schach-arena:v1:review:pverwaist') === null, { weg, n: uebrig.length });
  pruefe('Ausduennen liest keine Analysen (nur Schluessel)', gelesenReviews === 0, gelesenReviews);
  pruefe('Ausduennen: zweites Mal nichts zu tun, alte Analysen laden weiter', duenneAnalysenAus() === 0 && ladeReview(neueste[0]) && ladeReview(neueste[0]).zuege.length === 1);
  pruefe('Ausduennen: Partien bleiben alle', ladePartien().length === 20);

  // dauerhafter Speicher (navigator.storage.persist), Fehler still
  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const setzeNavi = (storage) => Object.defineProperty(globalThis, 'navigator', { value: storage === undefined ? {} : { storage }, configurable: true, writable: true });
  let persistAufrufe = 0;
  setzeNavi({ persisted: async () => false, persist: async () => { persistAufrufe++; return true; } });
  const a1 = await dauerhaftAnfragen();
  setzeNavi({ persisted: async () => true, persist: async () => { persistAufrufe++; return true; } });
  const a2 = await dauerhaftAnfragen();
  pruefe('dauerhaftAnfragen: fragt an, wenn noch nicht dauerhaft, sonst nicht', a1 === true && a2 === true && persistAufrufe === 1 && dauerhaftStatus() === true);
  setzeNavi({ persisted: async () => false, persist: async () => false });
  pruefe('dauerhaftAnfragen: abgelehnt -> false', (await dauerhaftAnfragen()) === false && dauerhaftStatus() === false);
  setzeNavi({ persisted: async () => { throw new Error('x'); }, persist: async () => true });
  let still = true;
  let a3;
  try { a3 = await dauerhaftAnfragen(); } catch (e) { still = false; }
  pruefe('dauerhaftAnfragen: Fehler still (null)', still && a3 === null && dauerhaftStatus() === null);
  setzeNavi(undefined);
  pruefe('dauerhaftAnfragen: ohne navigator.storage -> null', (await dauerhaftAnfragen()) === null);
  // w0plus-a-fix: Firefox (Gecko) fragt per Dialog; dort nur in der installierten App anfragen, sonst nur den Stand lesen
  const FIREFOX = 'Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0';
  const FX_ANDROID = 'Mozilla/5.0 (Android 14; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0';
  const FX_IOS = 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/131.0 Mobile/15E148 Safari/605.1.15';
  const SAFARI = 'Mozilla/5.0 (iPad; CPU OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1';
  const CHROME = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';
  pruefe('persistOhneDialog: Safari, Chrome, Firefox auf iOS ja; Firefox (Gecko) nur als installierte App',
    persistOhneDialog({ userAgent: SAFARI }) && persistOhneDialog({ userAgent: CHROME }) && persistOhneDialog({ userAgent: FX_IOS })
    && !persistOhneDialog({ userAgent: FIREFOX }) && !persistOhneDialog({ userAgent: FX_ANDROID })
    && persistOhneDialog({ userAgent: FIREFOX, standalone: true }) && persistOhneDialog({}));
  let fxAufrufe = 0;
  Object.defineProperty(globalThis, 'navigator', { value: { userAgent: FIREFOX, storage: { persisted: async () => false, persist: async () => { fxAufrufe++; return true; } } },
    configurable: true, writable: true });
  const fx = await dauerhaftAnfragen();
  Object.defineProperty(globalThis, 'navigator', { value: { userAgent: FIREFOX, standalone: true, storage: { persisted: async () => false, persist: async () => { fxAufrufe++; return true; } } },
    configurable: true, writable: true });
  const fxApp = await dauerhaftAnfragen();
  pruefe('dauerhaftAnfragen in Firefox: kein persist() im Browser-Tab (Stand false), in der installierten App schon', fx === false && fxApp === true && fxAufrufe === 1,
    { fx, fxApp, fxAufrufe });
  if (original) Object.defineProperty(globalThis, 'navigator', original);
  else delete globalThis.navigator;
}

console.log(`\n${ok}/${ok + fehler} bestanden`);
process.exit(fehler ? 1 : 0);
