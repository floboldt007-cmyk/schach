// Meisterschule, Kern und Bereich Mattbilder (Flo 31.10.2026: Premium-Lektionen "von leicht bis Meister", Plan und
// Lehrplan im Vault Schach-App/Meisterschule.md). Flo spielt, der Computer verteidigt so gut er kann (js/ui/lektion.js).
// Rein, ohne DOM, in Node testbar. Stellungen der Schachtheorie sind Allgemeingut; Texte eigene (texte.js).
// Weitere Bereiche liefern nur Daten (endspiele.js); Regeln, Sterne und Speicher gelten fuer alle hier.
//
//   LEKTIONEN [{ id, stufe, fen, ziel }]   Mattbilder; ziel = Flos Zuege bis Matt bei bester Verteidigung, mit Stockfish
//                                          nachgerechnet (werkzeuge/mattbilder-pruefen.mjs: kuerzeres aus Suche und Selbstspiel);
//                                          bis 7 Steine gilt die Tablebase (tests/mattbilder-tablebase.mjs)
//                                          zielAlsFrage: true (lange Grundmatts, Ziel = Tablebase, nur mit bestem Spiel):
//                                          der Ziel-Text fragt "Schaffst du es in N Zügen?" (Flos Antwort 4, 20.11.2026)
//   BEREICHE [{ id, lektionen }]           'matt' (Mattbilder), 'taktik' (taktik.js), 'end' (Endspiele, endspiele.js), 'eroeffnung' (Eroeffnungen,
//                                          eroeffnungen.js); ALLE = alle Lektionen
//   ARTEN ['matt', 'umwandeln', 'gewinnen', 'halten', 'folge', 'taktik']; artVon(l) (ohne art: 'matt'); bereichVon(l)
//   sterneFolge({ fehler, hinweise }) -> 1 | 2 | 3   Zugfolge: 3 ohne Fehler und Hinweis, 2 bei hoechstens zwei, sonst 1
//   STUFEN ['leicht', 'mittel', 'schwer', 'meister']
//   lektion(id) -> Lektion | null          sucht in allen Bereichen
//   rundenVon(l) -> [{ fen, ziel }]        Runde 1 = l selbst, dazu l.runden (R19: die 13 langen Lektionen haben drei Runden:
//                                          Lernen, Ueben, Meisterprobe ohne Hinweis); Sterne dort = geschaffte Runden
//   sterne({ ziel, zuege, hinweise }) -> 1 | 2 | 3   3: hoechstens ziel + ziel/4 Zuege, 2: hoechstens 1,5 * ziel + 2;
//                                                     mit Hinweis hoechstens 2 Sterne
//   grenze(ziel) -> Zahl                  Flos Zuege, nach denen die Lektion als nicht geschafft gilt (2 * ziel + 10)
//   bilanz(chess) -> { w: { mat, p, q, r }, b: {...} }   Material (Bauer 1, Leichtfigur 3, Turm 5, Dame 9)
//   pruefeZiel(l, start, chess, { wann, zuege }) -> 'geschafft' | Grund | null
//                                          wann 'flo' (nach Flos Zug) oder 'gegner' (nach dem Gegenzug); start = bilanz
//                                          der Ausgangsstellung. Gruende: patt, remis, zuViele, matt (gegen Flo),
//                                          verloren (Material weg), bauerWeg (umwandeln ohne Bauern)
//   pruefeLektion(l, Chess) -> [Fehlertext]   legale Stellung, Weiss am Zug, Schwarz nicht im Schach (sonst stuerzt
//                                             Stockfish ab), nicht schon vorbei, ziel ganzzahlig, art bekannt
//   stand(roh) -> { lek: { [id]: { s, z } } }   Speicherstand (Modul lernen) gesaeubert: s Sterne 1..3, z beste Zuege
//   merke(roh, id, { sterne, zuege }) -> neuer Stand   bessere Sterne bleiben, weniger Zuege bleiben
//   summe(st, bereichId?) -> { sterne, max, geschafft }   ohne bereichId ueber alle Bereiche
//   Kurs "Erste Schritte" (19.11.2026, ./erste-schritte.js): eigener Bereich KURS { id: 'erste', kurs: true }, in der
//   Uebersicht vorn (ANSICHT = [KURS, ...BEREICHE]). BEREICHE, ALLE und summe(st) ohne bereichId bleiben die Meisterschule
//   (Probe je Bereich, Zahl der Lektionen, Sammlung); lektion, bereichVon, stand, merke und summe(st, 'erste') kennen beide.
//   art 'sammeln': Flo sammelt mit einer Figur Sterne ein, ohne Gegner. ladeSammeln(fen) -> Chess ohne Koenige,
//   weissWieder(chess) setzt nach dem Zug Weiss wieder an den Zug, sternGeschafft(rest, feld) -> rest ohne das Feld;
//   pruefeZiel(l, _, chess, { zuege, rest }): geschafft ohne Sterne, zuViele ab grenze(ziel). Sterne nach sterneSammeln.
import { Chess } from '../../../vendor/chess/chess.js';
import { ENDSPIELE } from './endspiele.js';
import { EROEFFNUNGEN } from './eroeffnungen.js';
import { TAKTIK } from './taktik.js';
import { ERSTE_SCHRITTE } from './erste-schritte.js';

export const STUFEN = Object.freeze(['leicht', 'mittel', 'schwer', 'meister']);
// Runde 2 (Ueben) und 3 (Meisterprobe) der langen Lektionen (R19, Flo 14.11.2026: "Lektionen zu schnell durch"), Stellungen
// und Ziele mit Stockfish belegt in tests/r19-lektionen-besser.test.mjs
const R = (fen, ziel) => Object.freeze({ fen, ziel });

export const LEKTIONEN = Object.freeze([
  Object.freeze({ id: 'grundreihe', stufe: 'leicht', fen: '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1', ziel: 1 }),
  Object.freeze({ id: 'pillsbury', stufe: 'leicht', fen: '5rk1/5p1p/8/8/8/3R4/1B3PPP/6K1 w - - 0 1', ziel: 1 }),
  Object.freeze({ id: 'epaulette', stufe: 'leicht', fen: '3rkr2/pp4pp/8/3P4/8/7Q/5PPP/6K1 w - - 0 1', ziel: 1 }),
  Object.freeze({ id: 'todeskuss', stufe: 'leicht', fen: '3rk3/3p1p2/8/5N2/7Q/8/5PPP/6K1 w - - 0 1', ziel: 1 }),
  Object.freeze({ id: 'blackburne', stufe: 'leicht', fen: '5rk1/pp6/8/6N1/8/3B4/1B3PPP/6K1 w - - 0 1', ziel: 1 }),
  Object.freeze({ id: 'zwei-tuerme', stufe: 'leicht', fen: '8/8/8/3k4/8/8/8/R3K2R w - - 0 1', ziel: 5,
    runden: Object.freeze([R('8/8/2K5/2R5/4k3/8/6R1/8 w - - 0 1', 5), R('6K1/8/3k4/8/8/4R3/6R1/8 w - - 0 1', 6)]) }),
  Object.freeze({ id: 'anderssen', stufe: 'mittel', fen: '8/6Pk/5K2/8/8/8/8/R7 w - - 0 1', ziel: 2 }),
  Object.freeze({ id: 'lolli', stufe: 'mittel', fen: '5rk1/pp3p1p/5Pp1/8/8/8/3Q1PPP/6K1 w - - 0 1', ziel: 2 }),
  Object.freeze({ id: 'damiano', stufe: 'mittel', fen: '5rk1/pp3p2/6P1/8/8/8/3Q1PP1/6KR w - - 0 1', ziel: 2 }),
  Object.freeze({ id: 'greco', stufe: 'mittel', fen: '5r1k/pp4pp/8/8/2B5/7R/5PPP/3Q2K1 w - - 0 1', ziel: 2 }),
  Object.freeze({ id: 'anastasia', stufe: 'mittel', fen: '5r1k/4Nppp/8/7Q/8/3R4/5PPP/6K1 w - - 0 1', ziel: 2 }),
  Object.freeze({ id: 'oper', stufe: 'mittel', fen: '4kb1r/p2n1ppp/4q3/6B1/4P3/1Q6/PPP2PPP/2KR4 w - - 0 1', ziel: 2 }),
  Object.freeze({ id: 'boden', stufe: 'mittel', fen: '2kr4/pp1n1ppp/2n5/8/5B2/5Q2/5PPP/5BK1 w - - 0 1', ziel: 2 }),
  Object.freeze({ id: 'legal', stufe: 'mittel', fen: 'rn1qkbnr/ppp2p1p/3p2p1/4N3/2B1P3/2N5/PPPP1PPP/R1BbK2R w KQkq - 0 6', ziel: 2 }),
  Object.freeze({ id: 'arabisch', stufe: 'mittel', fen: 'r6k/1R6/p7/8/4N3/8/5PPP/6K1 w - - 0 1', ziel: 3 }),
  Object.freeze({ id: 'erstickt', stufe: 'mittel', fen: '4r2k/6pp/8/4N3/2Q5/8/5PPP/6K1 w - - 0 1', ziel: 4,
    runden: Object.freeze([R('4r2k/6pp/8/3QN3/8/8/5PPP/6K1 w - - 0 1', 4), R('4r1k1/6pp/8/4N3/8/8/5PPP/1Q4K1 w - - 0 1', 5)]) }),
  Object.freeze({ id: 'dame', stufe: 'mittel', fen: '8/8/8/4k3/8/8/8/3QK3 w - - 0 1', ziel: 7,
    runden: Object.freeze([R('1K6/1Q6/8/8/8/8/3k4/8 w - - 0 1', 8), R('6Q1/8/8/2k5/8/8/8/7K w - - 0 1', 9)]) }),
  // Ziele dieser drei laut Tablebase (fc-08:15, 20.11.2026; tests/r24-mattbilder-tablebase.test.mjs), vorher aus Stockfish
  // geschaetzt und bei allen neun Runden daneben (turm#1 und laeufer-springer#1 zu kurz, gegen beste Verteidigung nicht schaffbar)
  Object.freeze({ id: 'turm', stufe: 'schwer', fen: '8/8/8/4k3/8/8/8/R3K3 w - - 0 1', ziel: 14, zielAlsFrage: true,
    runden: Object.freeze([R('8/8/3R4/8/8/8/2k5/K7 w - - 0 1', 13), R('6R1/8/8/2k5/8/8/8/7K w - - 0 1', 15)]) }),
  Object.freeze({ id: 'zwei-laeufer', stufe: 'schwer', fen: '8/8/8/4k3/8/8/8/2B1KB2 w - - 0 1', ziel: 17, zielAlsFrage: true,
    runden: Object.freeze([R('8/8/4k3/8/8/8/3BK1B1/8 w - - 0 1', 15), R('8/8/5k2/8/8/8/3B1KB1/8 w - - 0 1', 15)]) }),
  Object.freeze({ id: 'laeufer-springer', stufe: 'meister', fen: '8/8/8/4k3/8/8/8/1N2KB2 w - - 0 1', ziel: 30, zielAlsFrage: true,
    runden: Object.freeze([R('8/3B2K1/8/8/8/k2N4/8/8 w - - 0 1', 23), R('8/8/8/7K/8/8/1N6/1B2k3 w - - 0 1', 24)]) }),
]);
export const ARTEN = Object.freeze(['matt', 'umwandeln', 'gewinnen', 'halten', 'folge', 'taktik', 'sammeln', 'schach', 'partie']);
// Zug-Zaehler: im Kurs vor dem ersten Zug nur der Ziel-Text, kein "Zug 0" (claude-code-60 19.11.); Meisterschule immer
export const zaehlerSichtbar = (bereich, zuege) => !(bereich && bereich.kurs && zuege === 0);
export const BEREICHE = Object.freeze([
  Object.freeze({ id: 'matt', lektionen: LEKTIONEN }),
  Object.freeze({ id: 'taktik', lektionen: TAKTIK }),
  Object.freeze({ id: 'end', lektionen: ENDSPIELE }),
  Object.freeze({ id: 'eroeffnung', lektionen: EROEFFNUNGEN }),
]);
export const ALLE = Object.freeze(BEREICHE.flatMap((b) => b.lektionen));
export const KURS = Object.freeze({ id: 'erste', kurs: true, lektionen: ERSTE_SCHRITTE });
export const ANSICHT = Object.freeze([KURS, ...BEREICHE]);
// Kurs und Meisterschule zusammen: Suche und Speicher
const JEDE = Object.freeze([...ERSTE_SCHRITTE, ...ALLE]);
export const artVon = (l) => (l && l.art) || 'matt';
export const bereichVon = (l) => ANSICHT.find((b) => b.lektionen.includes(l)) || BEREICHE[0];
export const lektion = (id) => JEDE.find((l) => l.id === id) || null;

// ---------- Sammeln (Kurs, Kapitel 1) ----------
export const ladeSammeln = (fen) => new Chess(fen, { skipValidation: true });
export function weissWieder(chess) {
  const teile = chess.fen().split(' ');
  if (teile[1] === 'w') return chess;
  teile[1] = 'w';
  teile[3] = '-';
  chess.load(teile.join(' '), { skipValidation: true });
  return chess;
}
export const sternGeschafft = (rest, feld) => (rest || []).filter((x) => x !== feld);
// 3 bei der kleinsten Zugzahl, 2 bei hoechstens zwei Zuegen mehr, sonst 1
export function sterneSammeln({ ziel, zuege }) {
  const z = Math.max(1, Math.round(Number(ziel) || 1));
  const n = Math.max(1, Math.round(Number(zuege) || 1));
  return n <= z ? 3 : n <= z + 2 ? 2 : 1;
}
// Runde 1 ist die Lektionsstellung selbst; Lektionen ohne runden haben genau diese eine
export const rundenVon = (l) => (l ? [{ fen: l.fen, ziel: l.ziel }, ...(Array.isArray(l.runden) ? l.runden : [])] : []);

const WERT = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
export function bilanz(chess) {
  const leer = () => ({ mat: 0, p: 0, q: 0, r: 0 });
  const b = { w: leer(), b: leer() };
  for (const zeile of chess.board()) {
    for (const f of zeile) {
      if (!f) continue;
      const seite = b[f.color];
      seite.mat += WERT[f.type] || 0;
      if (f.type === 'p' || f.type === 'q' || f.type === 'r') seite[f.type]++;
    }
  }
  return b;
}

// Vorsprung des Gegners (Schwarz) in Punkten; waechst er gegenueber dem Start um 3 oder mehr, hat Flo Material verloren
const vorsprung = (bl) => bl.b.mat - bl.w.mat;

export function pruefeZiel(l, start, chess, { wann = 'flo', zuege = 0, rest = null } = {}) {
  const art = artVon(l);
  if (art === 'folge') return null;   // der Zugfolge-Trainer (js/ui/lektion.js) zaehlt selbst
  // Sammeln: kein Gegner, nur Flos Zuege zaehlen; rest = noch liegende Sterne
  if (art === 'sammeln') return Array.isArray(rest) && rest.length === 0 ? 'geschafft' : zuege >= grenze(l.ziel) ? 'zuViele' : null;
  const halten = art === 'halten';
  if (wann === 'flo') {
    if (chess.isCheckmate()) return 'geschafft';
    // Schach geben (Kurs, Kapitel 3): geschafft, sobald der Gegner im Schach steht; sonst wie matt weiter
    if (art === 'schach' && chess.inCheck()) return 'geschafft';
    if (chess.isStalemate()) return halten ? 'geschafft' : 'patt';
    if (chess.isDraw()) return halten ? 'geschafft' : 'remis';
    if (art !== 'matt') {
      const jetzt = bilanz(chess);
      // ein bewusstes Opfer (Taktik: l.opfer) ist noch kein Verlust
      if (vorsprung(jetzt) - vorsprung(start) >= 3 + (Number(l.opfer) || 0)) return 'verloren';
      if (art === 'umwandeln' && jetzt.w.p === 0 && jetzt.w.q <= start.w.q) return 'bauerWeg';
    }
    if (!halten && zuege >= grenze(l.ziel)) return 'zuViele';
    return null;
  }
  if (chess.isCheckmate()) return 'matt';
  if (chess.isStalemate() || chess.isDraw()) return halten ? 'geschafft' : 'remis';
  if (art === 'matt') return null;
  const jetzt = bilanz(chess);
  if (art === 'umwandeln') return jetzt.w.q > start.w.q && jetzt.b.q <= start.b.q ? 'geschafft' : null;
  // Taktik: nach dem Gegenzug zaehlt, was bleibt (die Rueckeroberung ist dann schon geschehen)
  if (art === 'taktik') return vorsprung(start) - vorsprung(jetzt) >= (Number(l.gewinn) || 3) ? 'geschafft' : null;
  if (art === 'gewinnen') {
    return jetzt.b.p === 0 && jetzt.w.mat - jetzt.b.mat >= 5 && (jetzt.w.q > 0 || jetzt.w.r > 0) ? 'geschafft' : null;
  }
  // Die Regeln darunter gelten nur fuer halten. Jede andere Art (schach, partie, kuenftige) fiel bis 20.11. hierher durch
  // und galt nach einem ruhigen Zug mit Antwort als geschafft (Befund 19: es-schach mit 3 Sternen, tests/r20-lernen-gegner.test.mjs);
  // zuViele prueft fuer sie der flo-Zweig
  if (!halten) return null;
  // halten: Verlust wird erst nach Flos naechstem Zug gewertet (er darf zurueckschlagen)
  if (vorsprung(jetzt) - vorsprung(start) >= 3) return null;
  if (jetzt.b.p === 0 && jetzt.b.mat - jetzt.w.mat <= 2) return 'geschafft';
  return zuege >= Math.max(1, Math.round(Number(l.ziel) || 1)) ? 'geschafft' : null;
}

export function sterne({ ziel, zuege, hinweise = 0 } = {}) {
  const z = Math.max(1, Math.round(Number(ziel) || 1));
  const n = Math.max(1, Math.round(Number(zuege) || 1));
  let s = n <= z + Math.floor(z / 4) ? 3 : n <= Math.ceil(z * 1.5) + 2 ? 2 : 1;
  if (Number(hinweise) > 0) s = Math.min(s, 2);
  return s;
}

export function sterneFolge({ fehler = 0, hinweise = 0 } = {}) {
  const n = Math.max(0, Math.round(Number(fehler) || 0)) + Math.max(0, Math.round(Number(hinweise) || 0));
  return n === 0 ? 3 : n <= 2 ? 2 : 1;
}

export const grenze = (ziel) => Math.max(1, Math.round(Number(ziel) || 1)) * 2 + 10;

export function pruefeLektion(l, Chess) {
  const f = [];
  if (!l || typeof l.id !== 'string' || !/^[a-z][a-z0-9-]*$/.test(l.id)) return ['id ungueltig'];
  if (!STUFEN.includes(l.stufe)) f.push(`${l.id}: Stufe ${l.stufe}`);
  if (!ARTEN.includes(artVon(l))) f.push(`${l.id}: Art ${l.art}`);
  if (!Number.isInteger(l.ziel) || l.ziel < 1) f.push(`${l.id}: ziel ${l.ziel}`);
  if (artVon(l) === 'taktik' && !(Number.isInteger(l.gewinn) && l.gewinn >= 1 && l.gewinn <= 9)) f.push(`${l.id}: gewinn ${l.gewinn}`);
  if (artVon(l) === 'sammeln') return f.concat(pruefeSammeln(l));
  let c = null;
  try { c = new Chess(l.fen); } catch (e) { f.push(`${l.id}: FEN ${e.message}`); return f; }
  // Zugfolgen duerfen mit Schwarz am Zug beginnen (Gegner-Vorzug, Kurs Erste Schritte: Schach geben, d7-d5 vor en passant)
  if (c.turn() !== 'w' && artVon(l) !== 'folge') f.push(`${l.id}: Weiss muss am Zug sein`);
  if (c.isGameOver()) f.push(`${l.id}: Stellung ist schon vorbei`);
  const teile = l.fen.split(' ');
  teile[1] = 'b'; teile[3] = '-';
  try { if (new Chess(teile.join(' ')).isCheck()) f.push(`${l.id}: Schwarz steht schon im Schach`); } catch (e) { /* oben gemeldet */ }
  if (artVon(l) === 'folge') {
    // Zugfolge: Flos Seite, jeder Zug legal und genau so geschrieben, wie chess.js ihn schreibt, der letzte gehoert Flo,
    // ziel = Zahl seiner Zuege
    if (l.farbe !== 'w' && l.farbe !== 'b') f.push(`${l.id}: farbe ${l.farbe}`);
    const folge = Array.isArray(l.folge) ? l.folge : [];
    if (folge.length < 2) f.push(`${l.id}: Folge zu kurz`);
    const g = new Chess(l.fen);
    let eigene = 0;
    for (const san of folge) {
      const dran = g.turn();
      let m = null;
      try { m = g.move(san); } catch (e) { m = null; }
      if (!m) { f.push(`${l.id}: Zug ${san} nicht legal`); break; }
      if (m.san !== san) f.push(`${l.id}: ${san} heisst bei chess.js ${m.san}`);
      if (dran === l.farbe) eigene++;
    }
    // vom Anzieher der Stellung aus gezaehlt: der letzte Zug gehoert dem, der bei gerader Laenge-1 anfaengt
    if (folge.length && (folge.length - 1) % 2 !== (c.turn() === l.farbe ? 0 : 1)) f.push(`${l.id}: der letzte Zug gehoert nicht Flo`);
    if (eigene !== l.ziel) f.push(`${l.id}: ziel ${l.ziel}, aber ${eigene} eigene Zuege`);
  }
  return f;
}

// Kurs Kapitel 6 (art 'partie', fc-20:01): Sterne aus den gespeicherten Partien (storage ladePartien). Es zaehlt eine beendete
// FREIE Partie (modus 'frei', ohne Wertung) gegen botId mit der Kurs-Kennung extra.lernen.kurs === kurs (js/ui/lektion.js gibt
// sie ueber js/ui/partie.js mit). Frei starten auch die Probe-Partie der Einstufung und "Ab hier"; die zaehlten bis 20.11.
// mit (fc-02:20 a, tests/r20-kurs-sterne.test.mjs). 1 = zu Ende gespielt, 2 = gewonnen, zuege = Flos Zuege der besten
// (fuer merke). Keine Partie: null.
export function kursPartieSterne(partien, botId, kurs = 'es-partie') {
  let best = null;
  for (const p of Array.isArray(partien) ? partien : []) {
    if (!p || p.modus !== 'frei' || p.botId !== botId || !['sieg', 'remis', 'niederlage'].includes(p.ergebnis)) continue;
    if (!p.extra || !p.extra.lernen || p.extra.lernen.kurs !== kurs) continue;
    const s = p.ergebnis === 'sieg' ? 2 : 1;
    const z = Math.max(1, Math.min(999, Math.ceil((Array.isArray(p.zuege) ? p.zuege.length : 1) / 2)));
    if (!best || s > best.sterne || (s === best.sterne && z < best.zuege)) best = { sterne: s, zuege: z };
  }
  return best;
}

// Sammeln: genau eine weisse Figur, kein Koenig noetig, 1 bis 6 Sterne auf freien gueltigen Feldern. Falle (in Node belegt,
// tests/r20-erste-schritte.test.mjs): ohne Koenige stuerzt chess.js moves({ verbose: true }) mit einem Bauern AUF Reihe 1/8
// ab; dazu gehoert die Umwandlung erst in Kapitel 4. Darum Bauer nur auf Reihe 2 bis 5 und kein Bauern-Stern ueber Reihe 6.
function pruefeSammeln(l) {
  const f = [];
  let c = null;
  try { c = ladeSammeln(l.fen); } catch (e) { return [`${l.id}: FEN ${e.message}`]; }
  if (c.turn() !== 'w') f.push(`${l.id}: Weiss muss am Zug sein`);
  const figuren = c.board().flat().filter(Boolean);
  if (figuren.length !== 1 || figuren[0].color !== 'w') return f.concat(`${l.id}: genau eine weisse Figur`);
  const fig = figuren[0];
  const reihe = Number(fig.square[1]);
  const sterne = Array.isArray(l.sterne) ? l.sterne : [];
  if (sterne.length < 1 || sterne.length > 6) f.push(`${l.id}: 1 bis 6 Sterne`);
  if (new Set(sterne).size !== sterne.length) f.push(`${l.id}: Stern doppelt`);
  for (const z of sterne) {
    if (!/^[a-h][1-8]$/.test(z)) f.push(`${l.id}: Stern ${z} ungueltig`);
    else if (z === fig.square) f.push(`${l.id}: Stern ${z} unter der Figur`);
  }
  if (fig.type === 'p') {
    if (reihe < 2 || reihe > 5) f.push(`${l.id}: Bauer nur auf Reihe 2 bis 5 (Falle Reihe 1/8, Umwandlung erst Kapitel 4)`);
    if (sterne.some((z) => Number(z[1]) > 6)) f.push(`${l.id}: Bauern-Stern ueber Reihe 6`);
  }
  if (!Number.isInteger(l.ziel) || l.ziel < 1) f.push(`${l.id}: ziel ${l.ziel}`);
  return f;
}

export function stand(roh) {
  const lek = {};
  const quelle = roh && typeof roh === 'object' && roh.lek && typeof roh.lek === 'object' ? roh.lek : {};
  for (const l of JEDE) {
    const e = quelle[l.id];
    if (!e || typeof e !== 'object') continue;
    const s = Math.round(Number(e.s));
    const z = Math.round(Number(e.z));
    if (s >= 1 && s <= 3 && z >= 1 && z <= 999) lek[l.id] = { s, z };
  }
  return { lek };
}

export function merke(roh, id, { sterne: s, zuege } = {}) {
  const st = stand(roh);
  if (!lektion(id)) return st;
  const alt = st.lek[id];
  const neuS = Math.max(1, Math.min(3, Math.round(Number(s) || 1)));
  const neuZ = Math.max(1, Math.min(999, Math.round(Number(zuege) || 1)));
  st.lek[id] = alt ? { s: Math.max(alt.s, neuS), z: Math.min(alt.z, neuZ) } : { s: neuS, z: neuZ };
  return st;
}

export function summe(st, bereichId = null) {
  const lek = stand(st).lek;
  const b = bereichId ? ANSICHT.find((x) => x.id === bereichId) : null;
  const liste = b ? b.lektionen : ALLE;
  return {
    sterne: liste.reduce((a, l) => a + (lek[l.id] ? lek[l.id].s : 0), 0),
    max: liste.length * 3,
    geschafft: liste.filter((l) => lek[l.id]).length,
  };
}
