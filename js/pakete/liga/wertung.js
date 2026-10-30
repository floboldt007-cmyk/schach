// Liga, Rechenstand 1. Reine Funktionen: kein DOM, keine eigene Uhr, kein Speicher.
// Die harte P4-Regel schuetzt auch die Wertungszahl. eloSchritt liefert die rohe Elo-Rechnung;
// buchePartie uebernimmt davon nur positive Aenderungen (offen in den Wertungsdetails erklaert).
import { tagSchluessel, wochenSchluessel, addiereTage, tageZwischen } from '../../tag.js';

export const RECHENSTAND = 1;
export const STARTWERT = 800; // [E] Platzhalter bis zur Eichung der Bot-Skala.
export const SAISON_1_START = '2026-10-19'; // [E] Startmontag, KW 43; beim Livegang pruefen.
export const SAISON_TAGE = 12 * 7;
export const KLASSEN = Object.freeze(['Bauernklasse', 'Springerklasse', 'Läuferklasse', 'Turmklasse', 'Damenklasse', 'Königsklasse']);
export const KLASSEN_GRENZEN = Object.freeze([0, 1000, 1200, 1400, 1600, 1900]); // [E] Bis zur Eichung.
export const STUFEN = Object.freeze([
  Object.freeze({ name: 'Holz', schwelle: 0 }),
  Object.freeze({ name: 'Bronze', schwelle: 100 }),
  Object.freeze({ name: 'Silber', schwelle: 250 }),
  Object.freeze({ name: 'Gold', schwelle: 450 }),
  Object.freeze({ name: 'Platin', schwelle: 700 }),
  Object.freeze({ name: 'Diamant', schwelle: 1000 }),
  Object.freeze({ name: 'Meister', schwelle: 1400 }),
]);
export const BELEGE_MAX = 100;
export const KURVE_MAX = 40;
const kopie = (x) => JSON.parse(JSON.stringify(x));
const objekt = (x) => x && typeof x === 'object' && !Array.isArray(x) ? x : {};
const ganz = (x, standard = 0, max = 1000000000) => Number.isFinite(x) && x >= 0 ? Math.min(max, Math.floor(x)) : standard;
const stufeZahl = (x) => ganz(x, 0, STUFEN.length - 1);
const klasseZahl = (x) => ganz(x, 0, KLASSEN.length - 1);
const punktwert = (ergebnis) => ({ sieg: 1, remis: 0.5, niederlage: 0 })[ergebnis];

export function erwartung(wert, botElo) {
  return 1 / (1 + 10 ** ((botElo - wert) / 400));
}

export function kFaktor(n, hinweise = 0) {
  return (n < 15 ? 40 : 24) / (hinweise > 0 ? 2 : 1);
}

export function unsicherheit(n) {
  return Math.max(50, Math.round(350 / Math.sqrt(Math.max(0, n) + 1)));
}

export function vorlaeufig(n) { return n < 10; }

export function istBlitz(partie) {
  return Number.isFinite(partie?.tempo?.grund) && partie.tempo.grund > 0 && partie.tempo.grund < 600;
}

export function eloSchritt({ wert = STARTWERT, n = 0 }, botElo, ergebnis, hinweise = 0) {
  const s = punktwert(ergebnis);
  if (!Number.isFinite(wert) || !Number.isFinite(botElo) || s == null) return null;
  const k = kFaktor(n, hinweise);
  const erwartet = erwartung(wert, botElo);
  const delta = Math.round(k * (s - erwartet)) || 0;
  return { wert: wert + delta, n: n + 1, delta, k, erwartet, unsicherheit: unsicherheit(n + 1) };
}

export function spielklasse(wert, n, erreicht = 0) {
  const alt = klasseZahl(erreicht);
  if (n < 10) return alt;
  let neu = 0;
  KLASSEN_GRENZEN.forEach((grenze, i) => { if (wert >= grenze) neu = i; });
  return Math.max(alt, neu);
}

export function ligaStufe(punkte) {
  let stufe = 0;
  STUFEN.forEach((s, i) => { if (punkte >= s.schwelle) stufe = i; });
  return stufe;
}

// Flo 30.10. abends (Rueckfrage zu "Liga -3"): "harte, sinnvolle Bewertung". Die Genauigkeit zaehlt stark:
// Grundwert aus Ergebnis und Staerke des Gegners, dazu die Qualitaet der Partie. Die Schwelle der erreichten Stufe
// bleibt geschuetzt (ligaSchritt).
//   Sieg 10..25 (+1 je angefangenen 100 Punkten staerkerem Bot), Remis 0..12, Niederlage -20..-2 (gegen einen
//   schwaecheren Bot teurer); Qualitaet +8 (ab 90 %) bis -12 (unter 40 %); ein Sieg bleibt immer mindestens +2.
export function ligaBasis(ergebnis, botElo, eigenerWert) {
  const abstand = (botElo - eigenerWert) / 100;   // > 0: der Bot ist staerker
  if (ergebnis === 'sieg') return 10 + Math.min(15, Math.max(0, Math.ceil(abstand)));
  if (ergebnis === 'remis') return 4 + Math.max(-4, Math.min(8, Math.round(abstand * 2)));
  if (ergebnis === 'niederlage') return -8 + Math.max(-12, Math.min(6, Math.round(abstand * 2)));
  return 0;
}
export const QUALITAET = Object.freeze([[90, 8], [80, 5], [70, 2], [60, 0], [50, -4], [40, -8], [0, -12]]);
export function ligaQualitaet(ergebnis, genauigkeit, basis = 0) {
  if (!Number.isFinite(genauigkeit) || genauigkeit < 0 || genauigkeit > 100 || punktwert(ergebnis) == null) return 0;
  const q = QUALITAET.find(([ab]) => genauigkeit >= ab)[1];
  return ergebnis === 'sieg' ? Math.max(q, 2 - basis) : q;
}
export function ligaPunkte(ergebnis, botElo, eigenerWert, genauigkeit = null) {
  const basis = ligaBasis(ergebnis, botElo, eigenerWert);
  return basis + ligaQualitaet(ergebnis, genauigkeit, basis);
}
// Ergebnis im Beleg (Feld 11): 0 Niederlage, 1 Remis, 2 Sieg
const ERGEBNIS = ['niederlage', 'remis', 'sieg'];

export function ligaSchritt(saison, delta) {
  const alt = Math.max(stufeZahl(saison.stufe), ligaStufe(saison.punkte));
  const punkte = Math.max(STUFEN[alt].schwelle, saison.punkte + delta);
  const stufe = Math.max(alt, ligaStufe(punkte));
  return { ...saison, punkte, stufe };
}

export function saisonAm(datum) {
  const tag = tagSchluessel(datum);
  const nr = Math.max(0, Math.floor(tageZwischen(SAISON_1_START, wochenSchluessel(datum)) / SAISON_TAGE) + 1);
  const start = addiereTage(SAISON_1_START, Math.max(0, nr - 1) * SAISON_TAGE);
  const ende = nr ? addiereTage(start, SAISON_TAGE) : start;
  return { nr, start, ende, tage: Math.max(0, tageZwischen(tag, ende)) };
}

export function neuerStand(datum) {
  const { nr, start } = saisonAm(datum);
  return {
    stand: RECHENSTAND,
    wertung: { n: 0, wert: STARTWERT, blitz: { n: 0, wert: STARTWERT } },
    klasse: { erreicht: 0, momente: [] },
    saison: { nr, start, punkte: 0, stufe: 0, partien: 0, momente: [] },
    archiv: [], meisterschaft: {}, kurve: [], belege: [],
  };
}

// Alte Spielstaende ohne Modul beginnen mit Standardwerten. Unbekannte Rechenstaende werden
// nicht ueberschrieben. Beschaedigte optionale Felder eines bekannten Stands werden abgefangen.
export function normalisiereStand(daten, datum) {
  if (daten == null) return neuerStand(datum);
  const d = objekt(daten);
  if (d.stand !== RECHENSTAND) return null;
  const st = neuerStand(datum);
  const w = objekt(d.wertung), b = objekt(w.blitz), k = objekt(d.klasse), s = objekt(d.saison);
  st.wertung = { n: ganz(w.n), wert: ganz(w.wert, STARTWERT), blitz: { n: ganz(b.n), wert: ganz(b.wert, STARTWERT) } };
  st.klasse = { erreicht: klasseZahl(k.erreicht), momente: [...new Set((Array.isArray(k.momente) ? k.momente : []).filter((v) => Number.isInteger(v) && v > 0 && v < KLASSEN.length))] };
  const nr = ganz(s.nr, st.saison.nr, 35000);
  const start = addiereTage(SAISON_1_START, Math.max(0, nr - 1) * SAISON_TAGE);
  const punkte = ganz(s.punkte);
  const stufe = Math.max(stufeZahl(s.stufe), ligaStufe(punkte));
  st.saison = { nr, start, punkte: Math.max(punkte, STUFEN[stufe].schwelle), stufe, partien: ganz(s.partien),
    momente: [...new Set((Array.isArray(s.momente) ? s.momente : []).filter((v) => Number.isInteger(v) && v > 0 && v < STUFEN.length))] };
  st.archiv = (Array.isArray(d.archiv) ? d.archiv : []).filter((a) => a && Number.isInteger(a.nr) && a.nr > 0 && a.nr < nr)
    .map((a) => ({ nr: a.nr, stufe: stufeZahl(a.stufe), punkte: ganz(a.punkte), stand: ganz(a.stand, RECHENSTAND) }));
  st.archiv = [...new Map(st.archiv.map((a) => [a.nr, a])).values()].sort((a, b) => a.nr - b.nr);
  for (const [id, v] of Object.entries(objekt(d.meisterschaft))) {
    if (/^[a-z][a-z0-9-]{0,39}$/.test(id) && [0, 1, 3].includes(v)) st.meisterschaft[id] = v;
  }
  st.kurve = (Array.isArray(d.kurve) ? d.kurve : []).filter((p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite))
    .map(([n, wert]) => [ganz(n), ganz(wert)]).slice(-KURVE_MAX);
  // Beleg: [ID, Saison, Wertungsplus, Liga-Aenderung, Blitz, Analyse erledigt, Basis, Qualitaet, Punkte vorher, Stufe vorher,
  // Ergebnis]. Belege vor dem 30.10.2026 haben 10 Felder (ohne Ergebnis, Qualitaet nur +2 ab 80 %).
  st.belege = (Array.isArray(d.belege) ? d.belege : []).filter((r) => Array.isArray(r) && (r.length === 10 || r.length === 11)
    && typeof r[0] === 'string' && r[0].length <= 40 && r.slice(1).every(Number.isFinite)).slice(-BELEGE_MAX).map((r) => r.slice());
  if (d.wechsel && Number.isInteger(d.wechsel.von) && Number.isInteger(d.wechsel.nach)) st.wechsel = { von: d.wechsel.von, nach: d.wechsel.nach };
  return st;
}

export function wechsleSaison(stand, datum) {
  const jetzt = saisonAm(datum);
  if (jetzt.nr <= stand.saison.nr) return { stand, wechsel: false };
  const st = kopie(stand), alt = st.saison;
  if (alt.nr > 0) st.archiv.push({ nr: alt.nr, stufe: alt.stufe, punkte: alt.punkte, stand: RECHENSTAND });
  // Pausen erzeugen keine erfundenen Abzeichen und keinen wiederholten Reset je verpasster Saison.
  const stufe = alt.nr > 0 ? Math.max(0, alt.stufe - 1) : 0;
  st.saison = { nr: jetzt.nr, start: jetzt.start, punkte: STUFEN[stufe].schwelle, stufe, partien: 0,
    momente: Array.from({ length: stufe }, (_, i) => i + 1) };
  st.meisterschaft = {};
  if (alt.nr > 0) st.wechsel = { von: alt.nr, nach: jetzt.nr };
  return { stand: st, wechsel: true };
}

export function bestesErgebnis(bisher, ergebnis) {
  return Math.max([0, 1, 3].includes(bisher) ? bisher : 0, ergebnis === 'sieg' ? 3 : ergebnis === 'remis' ? 1 : 0);
}

export function kreuztabelle(meisterschaft, bots) {
  const zeilen = bots.map((b) => ({ id: b.id, name: b.name, punkte: [0, 1, 3].includes(meisterschaft[b.id]) ? meisterschaft[b.id] : 0,
    gespielt: Object.prototype.hasOwnProperty.call(meisterschaft, b.id) }));
  return { zeilen, punkte: zeilen.reduce((summe, z) => summe + z.punkte, 0), siege: zeilen.filter((z) => z.punkte === 3).length };
}

export function belegFuer(stand, partieId) { return stand.belege.find((r) => r[0] === partieId) || null; }

function aufstiege(st, altKlasse, altStufe) {
  const momente = [];
  for (let i = altKlasse + 1; i <= st.klasse.erreicht; i++) {
    if (st.klasse.momente.includes(i)) continue;
    st.klasse.momente.push(i);
    momente.push({ art: 'klasse', stufe: i, vorher: altKlasse });
  }
  for (let i = altStufe + 1; i <= st.saison.stufe; i++) {
    if (st.saison.momente.includes(i)) continue;
    st.saison.momente.push(i);
    momente.push({ art: 'liga', stufe: i, vorher: altStufe });
  }
  return momente;
}

export function buchePartie(stand, partie, botElo, datum) {
  if (!partie || typeof partie.id !== 'string' || partie.id.length > 40 || !partie.id || punktwert(partie.ergebnis) == null
    || !Number.isFinite(botElo) || belegFuer(stand, partie.id)) return { stand, gebucht: false, aufstieg: [] };
  const st = kopie(wechsleSaison(stand, datum).stand);
  const blitz = istBlitz(partie), w = blitz ? st.wertung.blitz : st.wertung;
  const altWert = w.wert, altKlasse = st.klasse.erreicht, altStufe = st.saison.stufe;
  const elo = eloSchritt(w, botElo, partie.ergebnis, partie.hinweise);
  w.wert = Math.max(altWert, elo.wert);
  w.n = elo.n;
  // Die Hauptklasse gehoert zur normalen Wertung; Blitz fuehrt seine eigene Einstufung.
  if (!blitz) {
    st.klasse.erreicht = spielklasse(w.wert, w.n, st.klasse.erreicht);
    st.kurve.push([w.n, w.wert]);
    st.kurve = st.kurve.slice(-KURVE_MAX);
  }
  const basis = ligaBasis(partie.ergebnis, botElo, altWert);
  const fertig = Number.isFinite(partie.genauigkeit) && partie.genauigkeit >= 0 && partie.genauigkeit <= 100 && partie.genauigkeitQuelle !== 'live';
  const qualitaet = fertig ? ligaQualitaet(partie.ergebnis, partie.genauigkeit, basis) : 0;
  let ligaDelta = 0;
  const punkteVorher = st.saison.punkte;
  if (st.saison.nr > 0) {
    const vorher = st.saison.punkte;
    st.saison = ligaSchritt(st.saison, basis + qualitaet);
    st.saison.partien++;
    ligaDelta = st.saison.punkte - vorher;
    st.meisterschaft[partie.botId] = bestesErgebnis(st.meisterschaft[partie.botId], partie.ergebnis);
  }
  st.belege.push([partie.id, st.saison.nr, w.wert - altWert, ligaDelta, blitz ? 1 : 0, fertig ? 1 : 0, basis, qualitaet, punkteVorher, altStufe,
    punktwert(partie.ergebnis) * 2]);
  st.belege = st.belege.slice(-BELEGE_MAX);
  return { stand: st, gebucht: true, elo, aufstieg: aufstiege(st, altKlasse, altStufe) };
}

// Belege einer Saison ab Beleg "ab" in Buchungsreihenfolge neu rechnen, ausgehend von Stand s. Liefert den Endstand.
function nachrechnen(belege, ab, saisonNr, s) {
  for (const b of belege.slice(belege.indexOf(ab)).filter((b) => b[1] === saisonNr)) {
    b[8] = s.punkte; b[9] = s.stufe;
    const neu = ligaSchritt(s, b[6] + b[7]);
    b[3] = neu.punkte - s.punkte;
    s = neu;
  }
  return { punkte: s.punkte, stufe: s.stufe };
}

export function bucheGenauigkeit(stand, partieId, genauigkeit) {
  const vorher = belegFuer(stand, partieId);
  if (!vorher || vorher[5] || !Number.isFinite(genauigkeit) || genauigkeit < 0 || genauigkeit > 100) return { stand, gebucht: false, aufstieg: [] };
  const st = kopie(stand), r = belegFuer(st, partieId);
  r[5] = 1;
  const altStufe = st.saison.stufe;
  const letzte = st.archiv[st.archiv.length - 1];
  const laufend = r[1] === st.saison.nr;
  // Zaehlt fuer die laufende Saison oder die zuletzt archivierte (deren Stufe bestimmt den Start der laufenden).
  // Aeltere Analysen aendern nichts mehr.
  // Belege mit Ergebnis (seit 30.10.2026): volle Qualitaet aus der Genauigkeit, auch ins Minus. Aeltere: +2 ab 80 %.
  const qualitaet = r.length > 10 ? ligaQualitaet(ERGEBNIS[r[10]], genauigkeit, r[6])
    : genauigkeit >= 80 ? (r[6] >= 10 ? Math.min(2, 25 - r[6]) : 2) : 0;
  if (r[1] > 0 && qualitaet !== 0 && (laufend || (letzte && r[1] === letzte.nr))) {
    r[7] = qualitaet;
    // In Buchungsreihenfolge nachrechnen: auch an einer Stufengrenze ist das Ergebnis unabhaengig
    // davon, ob die Genauigkeit vor oder nach der naechsten Partie ankommt.
    if (laufend) {
      const s = nachrechnen(st.belege, r, r[1], { punkte: r[8], stufe: r[9] });
      st.saison.punkte = s.punkte;
      st.saison.stufe = s.stufe;
    } else {
      // Die Analyse einer Partie der alten Saison kam erst nach dem Saisonwechsel (Partie 3:59, Analyse 4:01).
      // Archiv und Startstufe der laufenden Saison werden so nachgezogen, als waere sie vor dem Wechsel gekommen.
      const startVorher = Math.max(0, letzte.stufe - 1);
      const ende = nachrechnen(st.belege, r, r[1], { punkte: r[8], stufe: r[9] });
      letzte.punkte = ende.punkte;
      letzte.stufe = ende.stufe;
      const start = Math.max(0, ende.stufe - 1);
      if (start > startVorher) {
        // Startstufen gelten wie in wechsleSaison als erreicht, ohne Feier.
        for (let i = 1; i <= start; i++) if (!st.saison.momente.includes(i)) st.saison.momente.push(i);
        const erster = st.belege.find((b) => b[1] === st.saison.nr);
        const s0 = { punkte: STUFEN[start].schwelle, stufe: start };
        const s = erster ? nachrechnen(st.belege, erster, st.saison.nr, s0) : s0;
        st.saison.punkte = s.punkte;
        st.saison.stufe = s.stufe;
      }
    }
  }
  return { stand: st, gebucht: true, aufstieg: aufstiege(st, st.klasse.erreicht, altStufe) };
}

// Nur entbehrliche Kurvenpunkte und alte Belege kuerzen, nie Klassen oder Saison-Abzeichen.
export function imBudget(stand, budget = 10000) {
  const st = kopie(stand);
  while (JSON.stringify(st).length > budget && (st.belege.length > 1 || st.kurve.length)) {
    if (st.belege.length > 1) st.belege.shift();
    else st.kurve.shift();
  }
  return st;
}
