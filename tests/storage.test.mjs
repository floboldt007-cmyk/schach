// Tests fuer js/storage.js (Node, ohne Browser): node tests/storage.test.mjs
import {
  setzeSpeicher, ladeEinstellungen, speichereEinstellungen, STANDARD_EINSTELLUNGEN,
  ladeFortschritt, istFreigeschaltet, hoechsteFreieStufe, naechsterGegner, sterneZahl, gesamtSterne,
  besiegteBots, sterneFuerPartie, speicherePartie, ladePartien, ladePartie, aktualisierePartie,
  loeschePartie, ladeReview, speichereReview, hatReview, MAX_REVIEWS, speichereLaufendePartie,
  ladeLaufendePartie, loescheLaufendePartie, statistik, setzeZurueck, ergaenzeAnalyse, eigeneZuege,
  MODI, wertet, EXTRA_MAX, MODUL_BUDGET, ladeModul, speichereModul, speicherStand, rohSpeicher, SPEICHER_GRENZE,
} from '../js/storage.js';
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
speichereEinstellungen({ klang: false, brett: 'holz' });
pruefe('Einstellungen: speichern + mischen', ladeEinstellungen().klang === false && ladeEinstellungen().brett === 'holz' && ladeEinstellungen().balken === true);
s.setItem('schach-arena:v1:einstellungen', '{kaputt');
pruefe('Einstellungen: kaputtes JSON -> Standard', ladeEinstellungen().klang === true);
s.setItem('schach-arena:v1:einstellungen', JSON.stringify({ brett: 'lila', klang: 'ja', tiefe: 99 }));
const e = ladeEinstellungen();
pruefe('Einstellungen: falsche Typen/Werte ignoriert, Tiefe begrenzt', e.brett === 'nacht' && e.klang === true && e.tiefe === 20);

// ---------- Fortschritt / Freischaltung ----------
s = fakeSpeicher();
setzeSpeicher(s);
let f = ladeFortschritt();
pruefe('Fortschritt: leer, 10 Bots', Object.keys(f.bots).length === 10 && gesamtSterne(f) === 0);
pruefe('Freischaltung: nur Stufe 1 frei', istFreigeschaltet(1, f) && !istFreigeschaltet(2, f) && hoechsteFreieStufe(f) === 1);
pruefe('Naechster Gegner: Benno', naechsterGegner(f).id === 'benno');

pruefe('Sterne: Niederlage 0', JSON.stringify(sterneFuerPartie(partie({ ergebnis: 'niederlage' }))) === '[false,false,false]');
pruefe('Sterne: Sieg 79,9 % mit Hinweis', JSON.stringify(sterneFuerPartie(partie({ genauigkeit: 79.9, hinweise: 1 }))) === '[true,false,false]');
pruefe('Sterne: Sieg 80 % ohne Hilfe', JSON.stringify(sterneFuerPartie(partie({ genauigkeit: 80 }))) === '[true,true,true]');
pruefe('Sterne: Genauigkeit null', JSON.stringify(sterneFuerPartie(partie({ genauigkeit: null, zuruecknahmen: 2 }))) === '[true,false,false]');

// Niederlage gegen Benno: nichts frei
let r = speicherePartie(partie({ ergebnis: 'niederlage', genauigkeit: 50 }));
f = ladeFortschritt();
pruefe('Niederlage: keine Sterne, nicht frei', !r.neuFreigeschaltet && gesamtSterne(f) === 0 && f.bots.benno.niederlagen === 1 && f.bots.benno.partien === 1);

// Sieg mit Hinweis -> Stern 1, Lisa? nein: Hilde frei
r = speicherePartie(partie({ genauigkeit: 85, hinweise: 1 }), { zuege: [{ ply: 0, farbe: 'w', san: 'e4', klasse: 'brillant' }, { ply: 1, farbe: 'b', san: 'e5', klasse: 'brillant' }] });
f = ladeFortschritt();
pruefe('Sieg mit Hinweis: Sterne 1+2 neu, Hilde frei', JSON.stringify(r.neueSterne) === '[true,true,false]' && r.neuFreigeschaltet && r.neuFreigeschaltet.id === 'hilde', r);
pruefe('Freischaltung: Stufe 2 frei, 3 nicht', istFreigeschaltet(2, f) && !istFreigeschaltet(3, f) && hoechsteFreieStufe(f) === 2 && besiegteBots(f) === 1);
pruefe('Naechster Gegner: Hilde', naechsterGegner(f).id === 'hilde');
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
    && sofort.neuFreigeschaltet && sofort.neuFreigeschaltet.id === 'hilde' && fs.bots.benno.sterne[1] === false);
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
  const ohne = speicherePartie(partie({ genauigkeit: null }));
  ergaenzeAnalyse(ohne.partie.id, null, { genauigkeit: 81 });
  pruefe('Ohne Analyse: Live-Genauigkeit nachgetragen', ladePartie(ohne.partie.id).genauigkeit === 81);
  ergaenzeAnalyse(ohne.partie.id, null, { genauigkeit: 50 });
  pruefe('Ohne Analyse: vorhandene Genauigkeit bleibt', ladePartie(ohne.partie.id).genauigkeit === 81);
  pruefe('Unbekannte Partie: null', ergaenzeAnalyse('gibtsnicht', review) === null);
}

// ---------- Reviews: Begrenzung und voller Speicher ----------
s = fakeSpeicher();
setzeSpeicher(s);
const ids = [];
for (let i = 0; i < MAX_REVIEWS + 5; i++) ids.push(speicherePartie(partie({}), { zuege: [{ ply: 0, farbe: 'w', klasse: 'gut' }] }).partie.id);
const mit = ids.filter(hatReview);
pruefe('Reviews: nur die neuesten ' + MAX_REVIEWS, mit.length === MAX_REVIEWS && !hatReview(ids[0]) && hatReview(ids[ids.length - 1]), mit.length);

s = fakeSpeicher(6000);
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
pruefe('MODI = normal, uebung (eingefroren)', JSON.stringify(MODI) === '["normal","uebung"]' && Object.isFrozen(MODI));
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
  pruefe('Uebung nachgetragen: Genauigkeit ja, Sterne/Bestwert/Schatzkiste nein, wertet false', e.wertet === false && e.partie.genauigkeit === 99
    && JSON.stringify(e.neueSterne) === '[false,false,false]' && fs.bots.benno.besteGenauigkeit === null && fs.brillanteZuege.length === 0 && e.brillant === 0, e);

  const st = speicherePartie(partie({ startFen: UEBUNG_FEN, genauigkeit: 100 }));
  fs = ladeFortschritt();
  pruefe('Partie aus Stellung (normal): bucht nichts, modus normal', st.wertet === false && st.partie.modus === 'normal' && fs.bots.benno.partien === 0
    && gesamtSterne(fs) === 0 && !st.neuFreigeschaltet);

  const n = speicherePartie(partie({ genauigkeit: 91, maxSerie: 7.2 }), brillantReview);
  fs = ladeFortschritt();
  pruefe('normale Partie: wertet true, bucht wie bisher', n.wertet === true && JSON.stringify(n.neueSterne) === '[true,true,true]'
    && n.neuFreigeschaltet && n.neuFreigeschaltet.id === 'hilde' && fs.bots.benno.partien === 1 && n.brillant === 1);
  pruefe('normale Partie: modus normal, maxSerie gerundet, kein ziel', ladePartie(n.partie.id).modus === 'normal' && ladePartie(n.partie.id).maxSerie === 7
    && !('ziel' in ladePartie(n.partie.id)));
  const nNochmal = ergaenzeAnalyse(n.partie.id, { genauigkeit: { w: 93, b: 10 }, zuege: [] });
  pruefe('ergaenzeAnalyse normal: wertet true', nNochmal.wertet === true && ladeFortschritt().bots.benno.besteGenauigkeit === 93);

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
  s.setItem('schach-arena:v1:laufend', JSON.stringify({ botId: 'rudi', zuege: ['e2e4'], modus: 'boss', ziel: ZIEL, extra: 'x', liveTrivial: [1, true, 'ja'] }));
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
  pruefe('MODUL_BUDGET wie im Bauplan (Summe 324.000)', Object.isFrozen(MODUL_BUDGET) && MODUL_BUDGET.kartei === 160000 && MODUL_BUDGET.feier === 6000
    && MODUL_BUDGET.serie === 4000 && Object.values(MODUL_BUDGET).reduce((a, b) => a + b, 0) === 324000);
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
    && sieg.neuFreigeschaltet && sieg.neuFreigeschaltet.id === 'hilde', fs.bots.benno);
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
  pruefe('MAX_REVIEWS = 20', MAX_REVIEWS === 20);
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

console.log(`\n${ok}/${ok + fehler} bestanden`);
process.exit(fehler ? 1 : 0);
