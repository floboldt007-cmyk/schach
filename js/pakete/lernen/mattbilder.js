// Meisterschule, Bereich Mattbilder (Flo 31.10.2026: Premium-Lektionen "von leicht bis Meister", Etappe 1 im Vault
// Schach-App/Meisterschule.md). Flo setzt matt, der Computer verteidigt so gut er kann (js/ui/lektion.js). Rein, ohne
// DOM, in Node testbar. Stellungen der Schachtheorie sind Allgemeingut; Texte eigene (js/pakete/lernen/texte.js).
//
//   LEKTIONEN [{ id, stufe, fen, ziel }]   ziel = Flos Zuege bis Matt bei bester Verteidigung, mit Stockfish nachgerechnet
//                                          (werkzeuge/mattbilder-pruefen.mjs: kuerzeres aus tiefer Suche und Selbstspiel)
//   STUFEN ['leicht', 'mittel', 'schwer', 'meister']
//   lektion(id) -> Lektion | null
//   sterne({ ziel, zuege, hinweise }) -> 1 | 2 | 3   3: hoechstens ziel + ziel/4 Zuege, 2: hoechstens 1,5 * ziel + 2;
//                                                     mit Hinweis hoechstens 2 Sterne
//   grenze(ziel) -> Zahl                  Flos Zuege, nach denen die Lektion als nicht geschafft gilt (2 * ziel + 10)
//   pruefeLektion(l, Chess) -> [Fehlertext]   legale Stellung, Weiss am Zug, nicht schon vorbei, ziel ganzzahlig
//   stand(roh) -> { lek: { [id]: { s, z } } }   Speicherstand (Modul lernen) gesaeubert: s Sterne 1..3, z beste Zuege
//   merke(roh, id, { sterne, zuege }) -> neuer Stand   bessere Sterne bleiben, weniger Zuege bleiben
//   summe(st) -> { sterne, max, geschafft }
export const STUFEN = Object.freeze(['leicht', 'mittel', 'schwer', 'meister']);

export const LEKTIONEN = Object.freeze([
  Object.freeze({ id: 'grundreihe', stufe: 'leicht', fen: '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1', ziel: 1 }),
  Object.freeze({ id: 'zwei-tuerme', stufe: 'leicht', fen: '8/8/8/3k4/8/8/8/R3K2R w - - 0 1', ziel: 5 }),
  Object.freeze({ id: 'anastasia', stufe: 'mittel', fen: '5r1k/4Nppp/8/7Q/8/3R4/5PPP/6K1 w - - 0 1', ziel: 2 }),
  Object.freeze({ id: 'dame', stufe: 'mittel', fen: '8/8/8/4k3/8/8/8/3QK3 w - - 0 1', ziel: 7 }),
  Object.freeze({ id: 'erstickt', stufe: 'mittel', fen: '4r2k/6pp/8/4N3/2Q5/8/5PPP/6K1 w - - 0 1', ziel: 4 }),
  Object.freeze({ id: 'turm', stufe: 'schwer', fen: '8/8/8/4k3/8/8/8/R3K3 w - - 0 1', ziel: 13 }),
  Object.freeze({ id: 'zwei-laeufer', stufe: 'schwer', fen: '8/8/8/4k3/8/8/8/2B1KB2 w - - 0 1', ziel: 18 }),
  Object.freeze({ id: 'laeufer-springer', stufe: 'meister', fen: '8/8/8/4k3/8/8/8/1N2KB2 w - - 0 1', ziel: 25 }),
]);

export const lektion = (id) => LEKTIONEN.find((l) => l.id === id) || null;

export function sterne({ ziel, zuege, hinweise = 0 } = {}) {
  const z = Math.max(1, Math.round(Number(ziel) || 1));
  const n = Math.max(1, Math.round(Number(zuege) || 1));
  let s = n <= z + Math.floor(z / 4) ? 3 : n <= Math.ceil(z * 1.5) + 2 ? 2 : 1;
  if (Number(hinweise) > 0) s = Math.min(s, 2);
  return s;
}

export const grenze = (ziel) => Math.max(1, Math.round(Number(ziel) || 1)) * 2 + 10;

export function pruefeLektion(l, Chess) {
  const f = [];
  if (!l || typeof l.id !== 'string' || !/^[a-z][a-z0-9-]*$/.test(l.id)) return ['id ungueltig'];
  if (!STUFEN.includes(l.stufe)) f.push(`${l.id}: Stufe ${l.stufe}`);
  if (!Number.isInteger(l.ziel) || l.ziel < 1) f.push(`${l.id}: ziel ${l.ziel}`);
  let c = null;
  try { c = new Chess(l.fen); } catch (e) { f.push(`${l.id}: FEN ${e.message}`); return f; }
  if (c.turn() !== 'w') f.push(`${l.id}: Weiss muss am Zug sein`);
  if (c.isGameOver()) f.push(`${l.id}: Stellung ist schon vorbei`);
  return f;
}

export function stand(roh) {
  const lek = {};
  const quelle = roh && typeof roh === 'object' && roh.lek && typeof roh.lek === 'object' ? roh.lek : {};
  for (const l of LEKTIONEN) {
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

export function summe(st) {
  const lek = stand(st).lek;
  return {
    sterne: LEKTIONEN.reduce((a, l) => a + (lek[l.id] ? lek[l.id].s : 0), 0),
    max: LEKTIONEN.length * 3,
    geschafft: LEKTIONEN.filter((l) => lek[l.id]).length,
  };
}
