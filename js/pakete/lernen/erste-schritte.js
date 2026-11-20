// Kurs "Erste Schritte" (Flo 19.11.2026, Vorlage im Vault Schach-App/Feinschliff 2026-11-11/R19-Auswahl/erste-schritte.md):
// fuer ganz frische Anfaenger, vor der Meisterschule. Reine Daten, Regeln und Speicher in ./mattbilder.js (KURS, ANSICHT),
// Texte in ./texte.js (titel, idee, je Folgezug zug.<id>.<k>). Ids mit es-, weil turm und dame schon Mattbild-Lektionen sind.
// Stufe A: Kapitel 1 und 5. Stufe B: Kapitel 2 bis 4 (Stellungen mit Stockfish belegt, tests/r20-erste-schritte). Kapitel 6
// (fc-20:01): die erste ganze Partie.
//
//   art 'sammeln' (Kapitel 1, 4): nur Flos Figur auf dem Brett, ohne Koenige (chess.js mit skipValidation), Sterne auf den
//                 Feldern sterne; kein Gegner. ziel = kleinste Zugzahl ueber alle Reihenfolgen (tests/r20-erste-schritte
//                 rechnet sie nach). Bauer nur bis Reihe 6, kein Stern auf Reihe 7/8 (Falle in pruefeLektion).
//   art 'folge'   (Kapitel 3, 4, 5): wie die Eroeffnungen (./eroeffnungen.js), der letzte Zug gehoert Flo. Steht in fen
//                 Schwarz am Zug, spielt der Computer zuerst (Gegner-Vorzug: Schach geben, d7-d5 vor en passant).
//   art 'schach'  (Kapitel 3): geschafft, sobald Flos Zug Schach gibt.
//   taktik, halten, matt, umwandeln wie in der Meisterschule (Engine verteidigt).
//   art 'partie'  (Kapitel 6): eine ganze Partie gegen den ersten Bot der Leiter, modus 'frei', also ohne Wertung (Flo
//                 19.11.2026). Gestartet wird sie in js/ui/lektion.js, die Sterne traegt js/ui/lernen.js kursPartieAbgleich
//                 aus den gespeicherten Partien ein (mattbilder.js kursPartieSterne: 1 zu Ende, 2 gewonnen; es zaehlt nur
//                 die Partie mit der Kurs-Kennung extra.lernen.kurs, nicht jede freie Partie gegen den Bot).
//   kapitel       Nummer des Kapitels (Gruppen der Uebersicht js/ui/lernen.js)
import { GRUNDSTELLUNG } from './eroeffnungen.js';

const s = (id, fen, sterne, ziel, kapitel = 1) => Object.freeze({ id, art: 'sammeln', stufe: 'leicht', kapitel, fen, sterne: Object.freeze(sterne), ziel });
const f = (id, farbe, folge, ziel, { fen = GRUNDSTELLUNG, kapitel = 5 } = {}) => Object.freeze({ id, art: 'folge', stufe: 'leicht', kapitel, farbe,
  fen, folge: Object.freeze(folge.split(' ')), ziel });
const a = (id, art, kapitel, fen, ziel, mehr = {}) => Object.freeze({ id, art, stufe: 'leicht', kapitel, fen, ziel, ...mehr });

export const ERSTE_SCHRITTE = Object.freeze([
  // Kapitel 1: Brett und Figuren
  s('es-turm', '8/8/8/8/8/8/8/R7 w - - 0 1', ['a8', 'h8', 'h1'], 3),
  s('es-laeufer', '8/8/8/8/8/8/8/2B5 w - - 0 1', ['a3', 'f4', 'h6'], 4),
  s('es-springer', '8/8/8/8/8/8/8/6N1 w - - 0 1', ['f3', 'e5', 'c6'], 3),
  s('es-dame', '8/8/8/8/8/8/8/3Q4 w - - 0 1', ['d8', 'a5', 'h5', 'e2'], 4),
  s('es-koenig', '8/8/8/8/8/8/8/4K3 w - - 0 1', ['e3', 'f2', 'd3'], 3),
  // Kapitel 2: Schlagen und Schuetzen
  // freier Springer d5, der Laeufer a1 ist vom Turm a8 gedeckt
  a('es-schlagen', 'taktik', 2, 'r5k1/8/8/3n4/8/8/8/b2R2K1 w - - 0 1', 1, { gewinn: 3 }),
  // Bauer a4 frei, Dame d6 vom Bauern e7 gedeckt: Txd6 exd6 bringt 9 gegen 5
  a('es-tausch', 'taktik', 2, '6k1/4p1pp/3q4/8/p2R4/8/5PPP/2B3K1 w - - 0 1', 1, { gewinn: 4 }),
  // der Springer c6 greift die Dame d4 an
  a('es-weglaufen', 'halten', 2, '6k1/1p6/2n5/8/3Q4/8/5PPP/6K1 w - - 0 1', 1),
  // der Springer a1 ist eingesperrt (b3, c2), der Turm a8 greift ihn an
  a('es-schuetzen', 'halten', 2, 'r5k1/8/8/8/8/1P6/2PR4/N5K1 w - - 0 1', 1),
  // Kapitel 3: Schach und Matt
  a('es-schach', 'schach', 3, '4k3/8/8/8/8/8/8/3R2K1 w - - 0 1', 1),
  // Schwarz gibt Schach (Te8-e1+); je Aufgabe ist nur der geuebte Weg legal
  f('es-raus-weg', 'w', 'Re1+ Kh2', 1, { fen: '4r1k1/5ppp/8/8/8/8/5PP1/6K1 b - - 0 1', kapitel: 3 }),
  f('es-raus-dazwischen', 'w', 'Re1+ Bf1', 1, { fen: '4r1k1/5ppp/8/8/8/3B4/6PP/7K b - - 0 1', kapitel: 3 }),
  f('es-raus-schlagen', 'w', 'Re1+ Rxe1', 1, { fen: '4r1k1/5ppp/8/8/8/8/6PP/R6K b - - 0 1', kapitel: 3 }),
  a('es-matt1', 'matt', 3, '7k/6pp/8/8/8/8/8/R5K1 w - - 0 1', 1),
  // Kapitel 4: Sonderregeln
  s('es-bauer', '8/8/8/8/8/8/4P3/8 w - - 0 1', ['e4', 'e6'], 3, 4),
  a('es-umwandeln', 'umwandeln', 4, '8/4P3/8/8/8/2k5/8/4K3 w - - 0 1', 1),
  f('es-rochade-regel', 'w', 'Nf6 O-O', 1, { fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3', kapitel: 4 }),
  f('es-en-passant', 'w', 'd5 exd6', 1, { fen: 'rnbqkbnr/1ppppppp/p7/4P3/8/8/PPPP1PPP/RNBQKBNR b KQkq - 0 2', kapitel: 4 }),
  // Patt-Falle: Qg6 sperrt den Koenig ein (Patt); Matt in 2 ist moeglich (Stockfish, tests/r20-erste-schritte)
  a('es-patt', 'matt', 4, '7k/8/8/5K2/8/8/8/6Q1 w - - 0 1', 2),
  // Kapitel 5: Gut anfangen
  f('es-mitte', 'w', 'e4 e5 d4', 2),
  f('es-figuren', 'w', 'e4 e5 Nf3 Nc6 Bc4', 3),
  f('es-rochade', 'w', 'e4 e5 Nf3 Nc6 Bc4 Bc5 O-O', 4),
  // Dame nicht zu frueh: dieselbe Folge wie die Eroeffnung schaefer-abwehr, hier aus Sicht des Anfaengers erklaert
  f('es-dame-frueh', 'b', 'e4 e5 Bc4 Nc6 Qh5 g6 Qf3 Nf6', 4),
  // Kapitel 6: Deine erste Partie
  a('es-partie', 'partie', 6, GRUNDSTELLUNG, 1),
]);
