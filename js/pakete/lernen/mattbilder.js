// Meisterschule, Kern und Bereich Mattbilder (Flo 31.10.2026: Premium-Lektionen "von leicht bis Meister", Plan und
// Lehrplan im Vault Schach-App/Meisterschule.md). Flo spielt, der Computer verteidigt so gut er kann (js/ui/lektion.js).
// Rein, ohne DOM, in Node testbar. Stellungen der Schachtheorie sind Allgemeingut; Texte eigene (texte.js).
// Weitere Bereiche liefern nur Daten (endspiele.js); Regeln, Sterne und Speicher gelten fuer alle hier.
//
//   LEKTIONEN [{ id, stufe, fen, ziel }]   Mattbilder; ziel = Flos Zuege bis Matt bei bester Verteidigung, mit Stockfish
//                                          nachgerechnet (werkzeuge/mattbilder-pruefen.mjs: kuerzeres aus Suche und Selbstspiel)
//   BEREICHE [{ id, lektionen }]           'matt' (Mattbilder), 'end' (Endspiele, endspiele.js), 'eroeffnung' (Eroeffnungen,
//                                          eroeffnungen.js); ALLE = alle Lektionen
//   ARTEN ['matt', 'umwandeln', 'gewinnen', 'halten', 'folge']; artVon(l) (ohne art: 'matt'); bereichVon(l)
//   sterneFolge({ fehler, hinweise }) -> 1 | 2 | 3   Zugfolge: 3 ohne Fehler und Hinweis, 2 bei hoechstens zwei, sonst 1
//   STUFEN ['leicht', 'mittel', 'schwer', 'meister']
//   lektion(id) -> Lektion | null          sucht in allen Bereichen
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
import { ENDSPIELE } from './endspiele.js';
import { EROEFFNUNGEN } from './eroeffnungen.js';

export const STUFEN = Object.freeze(['leicht', 'mittel', 'schwer', 'meister']);

export const LEKTIONEN = Object.freeze([
  Object.freeze({ id: 'grundreihe', stufe: 'leicht', fen: '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1', ziel: 1 }),
  Object.freeze({ id: 'pillsbury', stufe: 'leicht', fen: '5rk1/5p1p/8/8/8/3R4/1B3PPP/6K1 w - - 0 1', ziel: 1 }),
  Object.freeze({ id: 'epaulette', stufe: 'leicht', fen: '3rkr2/pp4pp/8/3P4/8/7Q/5PPP/6K1 w - - 0 1', ziel: 1 }),
  Object.freeze({ id: 'todeskuss', stufe: 'leicht', fen: '3rk3/3p1p2/8/5N2/7Q/8/5PPP/6K1 w - - 0 1', ziel: 1 }),
  Object.freeze({ id: 'blackburne', stufe: 'leicht', fen: '5rk1/pp6/8/6N1/8/3B4/1B3PPP/6K1 w - - 0 1', ziel: 1 }),
  Object.freeze({ id: 'zwei-tuerme', stufe: 'leicht', fen: '8/8/8/3k4/8/8/8/R3K2R w - - 0 1', ziel: 5 }),
  Object.freeze({ id: 'anderssen', stufe: 'mittel', fen: '8/6Pk/5K2/8/8/8/8/R7 w - - 0 1', ziel: 2 }),
  Object.freeze({ id: 'lolli', stufe: 'mittel', fen: '5rk1/pp3p1p/5Pp1/8/8/8/3Q1PPP/6K1 w - - 0 1', ziel: 2 }),
  Object.freeze({ id: 'damiano', stufe: 'mittel', fen: '5rk1/pp3p2/6P1/8/8/8/3Q1PP1/6KR w - - 0 1', ziel: 2 }),
  Object.freeze({ id: 'greco', stufe: 'mittel', fen: '5r1k/pp4pp/8/8/2B5/7R/5PPP/3Q2K1 w - - 0 1', ziel: 2 }),
  Object.freeze({ id: 'anastasia', stufe: 'mittel', fen: '5r1k/4Nppp/8/7Q/8/3R4/5PPP/6K1 w - - 0 1', ziel: 2 }),
  Object.freeze({ id: 'oper', stufe: 'mittel', fen: '4kb1r/p2n1ppp/4q3/6B1/4P3/1Q6/PPP2PPP/2KR4 w - - 0 1', ziel: 2 }),
  Object.freeze({ id: 'boden', stufe: 'mittel', fen: '2kr4/pp1n1ppp/2n5/8/5B2/5Q2/5PPP/5BK1 w - - 0 1', ziel: 2 }),
  Object.freeze({ id: 'legal', stufe: 'mittel', fen: 'rn1qkbnr/ppp2p1p/3p2p1/4N3/2B1P3/2N5/PPPP1PPP/R1BbK2R w KQkq - 0 6', ziel: 2 }),
  Object.freeze({ id: 'arabisch', stufe: 'mittel', fen: 'r6k/1R6/p7/8/4N3/8/5PPP/6K1 w - - 0 1', ziel: 3 }),
  Object.freeze({ id: 'erstickt', stufe: 'mittel', fen: '4r2k/6pp/8/4N3/2Q5/8/5PPP/6K1 w - - 0 1', ziel: 4 }),
  Object.freeze({ id: 'dame', stufe: 'mittel', fen: '8/8/8/4k3/8/8/8/3QK3 w - - 0 1', ziel: 7 }),
  Object.freeze({ id: 'turm', stufe: 'schwer', fen: '8/8/8/4k3/8/8/8/R3K3 w - - 0 1', ziel: 13 }),
  Object.freeze({ id: 'zwei-laeufer', stufe: 'schwer', fen: '8/8/8/4k3/8/8/8/2B1KB2 w - - 0 1', ziel: 18 }),
  Object.freeze({ id: 'laeufer-springer', stufe: 'meister', fen: '8/8/8/4k3/8/8/8/1N2KB2 w - - 0 1', ziel: 23 }),
]);
export const ARTEN = Object.freeze(['matt', 'umwandeln', 'gewinnen', 'halten', 'folge']);
export const BEREICHE = Object.freeze([
  Object.freeze({ id: 'matt', lektionen: LEKTIONEN }),
  Object.freeze({ id: 'end', lektionen: ENDSPIELE }),
  Object.freeze({ id: 'eroeffnung', lektionen: EROEFFNUNGEN }),
]);
export const ALLE = Object.freeze(BEREICHE.flatMap((b) => b.lektionen));
export const artVon = (l) => (l && l.art) || 'matt';
export const bereichVon = (l) => BEREICHE.find((b) => b.lektionen.includes(l)) || BEREICHE[0];
export const lektion = (id) => ALLE.find((l) => l.id === id) || null;

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

export function pruefeZiel(l, start, chess, { wann = 'flo', zuege = 0 } = {}) {
  const art = artVon(l);
  if (art === 'folge') return null;   // der Zugfolge-Trainer (js/ui/lektion.js) zaehlt selbst
  const halten = art === 'halten';
  if (wann === 'flo') {
    if (chess.isCheckmate()) return 'geschafft';
    if (chess.isStalemate()) return halten ? 'geschafft' : 'patt';
    if (chess.isDraw()) return halten ? 'geschafft' : 'remis';
    if (art !== 'matt') {
      const jetzt = bilanz(chess);
      if (vorsprung(jetzt) - vorsprung(start) >= 3) return 'verloren';
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
  if (art === 'gewinnen') {
    return jetzt.b.p === 0 && jetzt.w.mat - jetzt.b.mat >= 5 && (jetzt.w.q > 0 || jetzt.w.r > 0) ? 'geschafft' : null;
  }
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
  let c = null;
  try { c = new Chess(l.fen); } catch (e) { f.push(`${l.id}: FEN ${e.message}`); return f; }
  if (c.turn() !== 'w') f.push(`${l.id}: Weiss muss am Zug sein`);
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
    if (folge.length && (folge.length - 1) % 2 !== (l.farbe === 'w' ? 0 : 1)) f.push(`${l.id}: der letzte Zug gehoert nicht Flo`);
    if (eigene !== l.ziel) f.push(`${l.id}: ziel ${l.ziel}, aber ${eigene} eigene Zuege`);
  }
  return f;
}

export function stand(roh) {
  const lek = {};
  const quelle = roh && typeof roh === 'object' && roh.lek && typeof roh.lek === 'object' ? roh.lek : {};
  for (const l of ALLE) {
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
  const b = bereichId ? BEREICHE.find((x) => x.id === bereichId) : null;
  const liste = b ? b.lektionen : ALLE;
  return {
    sterne: liste.reduce((a, l) => a + (lek[l.id] ? lek[l.id].s : 0), 0),
    max: liste.length * 3,
    geschafft: liste.filter((l) => lek[l.id]).length,
  };
}
