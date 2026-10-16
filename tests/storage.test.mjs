// Tests fuer js/storage.js (Node, ohne Browser): node tests/storage.test.mjs
import {
  setzeSpeicher, ladeEinstellungen, speichereEinstellungen, STANDARD_EINSTELLUNGEN,
  ladeFortschritt, istFreigeschaltet, hoechsteFreieStufe, naechsterGegner, sterneZahl, gesamtSterne,
  besiegteBots, sterneFuerPartie, speicherePartie, ladePartien, ladePartie, aktualisierePartie,
  loeschePartie, ladeReview, speichereReview, hatReview, MAX_REVIEWS, speichereLaufendePartie,
  ladeLaufendePartie, loescheLaufendePartie, statistik, setzeZurueck,
} from '../js/storage.js';

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
function partie(teil) {
  t++;
  return {
    datum: new Date(Date.UTC(2026, 9, 16, 10, 0, t)).toISOString(), botId: 'benno', botStufe: 1,
    spielerFarbe: 'w', zuege: ['e2e4'], san: ['e4'], ergebnis: 'sieg', grund: 'matt',
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

// ---------- Partien ----------
const liste = ladePartien();
pruefe('Partien: neueste zuerst', liste.length === 3 && liste[0].datum > liste[1].datum && liste[1].datum > liste[2].datum);
pruefe('Partie laden', ladePartie(id2).botId === 'benno' && ladePartie('gibtsnicht') === null);
aktualisierePartie(id2, { eroeffnung: 'Italienisch', ergebnis: 'niederlage', sterne: [false, false, false] });
pruefe('Aktualisieren: Zusatzfelder ja, Ergebnis/Sterne nein', ladePartie(id2).eroeffnung === 'Italienisch' && ladePartie(id2).ergebnis === 'sieg' && ladePartie(id2).sterne[0] === true);
loeschePartie(id2);
pruefe('Loeschen: Partie und Review weg', !ladePartie(id2) && !hatReview(id2) && ladePartien().length === 2);

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

console.log(`\n${ok}/${ok + fehler} bestanden`);
process.exit(fehler ? 1 : 0);
