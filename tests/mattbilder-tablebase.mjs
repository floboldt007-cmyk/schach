// Wahre Mattdistanz der Mattbild-Runden mit hoechstens 7 Steinen, aus der Lichess-Tablebase (tablebase.lichess.ovh,
// abgefragt am 20.11.2026 von Fenster 19 und Fenster 43 unabhaengig, beide gleich; R20-Kritik/fabrik-tiefe/bericht.md).
// dtm = Halbzuege bis Matt bei bester Verteidigung, Weiss am Zug. Flos Zuege bis Matt = dtm / 2 aufgerundet.
// Festgehalten, damit Tests ohne Netz pruefen. Genutzt von tests/r24-mattbilder-tablebase.test.mjs und
// tests/r19-lektionen-besser.test.mjs.
export const TABLEBASE_DTM = Object.freeze({
  '8/8/8/3k4/8/8/8/R3K2R w - - 0 1': 9,
  '8/8/2K5/2R5/4k3/8/6R1/8 w - - 0 1': 9,
  '6K1/8/3k4/8/8/4R3/6R1/8 w - - 0 1': 11,
  '8/6Pk/5K2/8/8/8/8/R7 w - - 0 1': 3,
  '8/8/8/4k3/8/8/8/3QK3 w - - 0 1': 13,
  '1K6/1Q6/8/8/8/8/3k4/8 w - - 0 1': 15,
  '6Q1/8/8/2k5/8/8/8/7K w - - 0 1': 17,
  '8/8/8/4k3/8/8/8/R3K3 w - - 0 1': 27,
  '8/8/3R4/8/8/8/2k5/K7 w - - 0 1': 25,
  '6R1/8/8/2k5/8/8/8/7K w - - 0 1': 29,
  '8/8/8/4k3/8/8/8/2B1KB2 w - - 0 1': 33,
  '8/8/4k3/8/8/8/3BK1B1/8 w - - 0 1': 29,
  '8/8/5k2/8/8/8/3B1KB1/8 w - - 0 1': 29,
  '8/8/8/4k3/8/8/8/1N2KB2 w - - 0 1': 59,
  '8/3B2K1/8/8/8/k2N4/8/8 w - - 0 1': 45,
  '8/8/8/7K/8/8/1N6/1B2k3 w - - 0 1': 47,
});
export const steine = (fen) => fen.split(' ')[0].replace(/[^a-zA-Z]/g, '').length;
// Flos Zuege bis Matt laut Tablebase, null wenn die Stellung nicht in der Tabelle steht
export const mattZuege = (fen) => (fen in TABLEBASE_DTM ? Math.ceil(TABLEBASE_DTM[fen] / 2) : null);
