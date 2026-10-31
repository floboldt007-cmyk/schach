// Meisterschule, Bereich Endspiele (Flo 31.10.2026: "nicht nur Matt-Lektionen ... Mittelspiel und Endspiele"; Lehrplan im
// Vault Schach-App/Meisterschule.md). Teil 1: leicht und mittel. Reine Daten, keine Importe; die Regeln (Ziel erreicht,
// Sterne, Speicher) stehen in mattbilder.js. Stellungen der Endspieltheorie sind Allgemeingut; Texte eigene (texte.js).
// Flo spielt immer Weiss, auch beim Halten (die Stellungen sind dafuer gespiegelt).
//
//   art 'umwandeln'  Bauer zur Dame machen; geschafft, wenn die neue Dame nach dem Gegenzug noch steht
//   art 'gewinnen'   Gegner ohne Bauern und du mit mindestens 5 Punkten mehr (Dame oder Turm auf dem Brett), oder Matt
//   art 'halten'     ziel Zuege ueberstehen, ohne Material zu verlieren; Remis (Patt, zu wenig Material,
//                    Wiederholung) und ein geschlagener letzter Bauer des Gegners zaehlen sofort als geschafft
//   ziel             Flos Zuege bei bester Verteidigung, mit Stockfish nachgerechnet (Selbstspiel); beim Halten die Zahl
//                    der Zuege, die man ueberstehen muss
export const ENDSPIELE = Object.freeze([
  Object.freeze({ id: 'koenig-sechste', art: 'umwandeln', stufe: 'leicht', fen: '4k3/8/4K3/4P3/8/8/8/8 w - - 0 1', ziel: 5 }),
  Object.freeze({ id: 'erst-koenig', art: 'umwandeln', stufe: 'leicht', fen: '8/8/4k3/8/8/4K3/4P3/8 w - - 0 1', ziel: 10 }),
  Object.freeze({ id: 'schluesselfelder', art: 'umwandeln', stufe: 'leicht', fen: '8/8/3k4/8/3K4/8/3P4/8 w - - 0 1', ziel: 9 }),
  Object.freeze({ id: 'quadrat', art: 'halten', stufe: 'leicht', fen: '7k/8/8/p7/5K2/8/8/8 w - - 0 1', ziel: 8 }),
  Object.freeze({ id: 'randbauer', art: 'halten', stufe: 'leicht', fen: '8/8/8/8/7p/6k1/8/4K3 w - - 0 1', ziel: 10 }),
  Object.freeze({ id: 'springer-bauer', art: 'halten', stufe: 'mittel', fen: '7k/8/8/2N5/8/p7/8/7K w - - 0 1', ziel: 10 }),
  Object.freeze({ id: 'durchbruch', art: 'umwandeln', stufe: 'mittel', fen: '6k1/ppp5/8/PPP5/8/8/8/6K1 w - - 0 1', ziel: 4 }),
  Object.freeze({ id: 'entfernter-freibauer', art: 'umwandeln', stufe: 'mittel', fen: '8/5kpp/8/8/P7/6P1/5PKP/8 w - - 0 1', ziel: 5 }),
  Object.freeze({ id: 'lucena', art: 'gewinnen', stufe: 'mittel', fen: '3K4/3P1k2/8/8/8/8/2r5/4R3 w - - 0 1', ziel: 6 }),
  Object.freeze({ id: 'philidor', art: 'halten', stufe: 'mittel', fen: '8/8/8/8/3pk3/R7/7r/3K4 w - - 0 1', ziel: 12 }),
  Object.freeze({ id: 'dame-bauer', art: 'gewinnen', stufe: 'mittel', fen: '7K/Q7/8/8/8/8/3pk3/8 w - - 0 1', ziel: 22 }),
]);
