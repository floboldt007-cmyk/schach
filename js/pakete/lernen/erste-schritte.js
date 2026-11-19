// Kurs "Erste Schritte" (Flo 19.11.2026, Vorlage im Vault Schach-App/Feinschliff 2026-11-11/R19-Auswahl/erste-schritte.md):
// fuer ganz frische Anfaenger, vor der Meisterschule. Reine Daten, Regeln und Speicher in ./mattbilder.js (KURS, ANSICHT),
// Texte in ./texte.js (titel, idee, je Folgezug zug.<id>.<k>). Ids mit es-, weil turm und dame schon Mattbild-Lektionen sind.
// Stufe A: Kapitel 1 und 5. Kapitel 2 bis 4 und 6 folgen.
//
//   art 'sammeln' (Kapitel 1): nur Flos Figur auf dem Brett, ohne Koenige (chess.js mit skipValidation), Sterne auf den
//                 Feldern sterne; kein Gegner. ziel = kleinste Zugzahl ueber alle Reihenfolgen (tests/r20-erste-schritte
//                 rechnet sie nach). Bauer nur bis Reihe 6, kein Stern auf Reihe 7/8 (Falle in pruefeLektion).
//   art 'folge'   (Kapitel 5): wie die Eroeffnungen (./eroeffnungen.js), der letzte Zug gehoert Flo.
//   kapitel       Nummer des Kapitels (Gruppen der Uebersicht js/ui/lernen.js)
import { GRUNDSTELLUNG } from './eroeffnungen.js';

const s = (id, fen, sterne, ziel) => Object.freeze({ id, art: 'sammeln', stufe: 'leicht', kapitel: 1, fen, sterne: Object.freeze(sterne), ziel });
const f = (id, farbe, folge, ziel) => Object.freeze({ id, art: 'folge', stufe: 'leicht', kapitel: 5, farbe, fen: GRUNDSTELLUNG,
  folge: Object.freeze(folge.split(' ')), ziel });

export const ERSTE_SCHRITTE = Object.freeze([
  s('es-turm', '8/8/8/8/8/8/8/R7 w - - 0 1', ['a8', 'h8', 'h1'], 3),
  s('es-laeufer', '8/8/8/8/8/8/8/2B5 w - - 0 1', ['a3', 'f4', 'h6'], 4),
  s('es-springer', '8/8/8/8/8/8/8/6N1 w - - 0 1', ['f3', 'e5', 'c6'], 3),
  s('es-dame', '8/8/8/8/8/8/8/3Q4 w - - 0 1', ['d8', 'a5', 'h5', 'e2'], 4),
  s('es-koenig', '8/8/8/8/8/8/8/4K3 w - - 0 1', ['e3', 'f2', 'd3'], 3),
  f('es-mitte', 'w', 'e4 e5 d4', 2),
  f('es-figuren', 'w', 'e4 e5 Nf3 Nc6 Bc4', 3),
  f('es-rochade', 'w', 'e4 e5 Nf3 Nc6 Bc4 Bc5 O-O', 4),
  // Dame nicht zu frueh: dieselbe Folge wie die Eroeffnung schaefer-abwehr, hier aus Sicht des Anfaengers erklaert
  f('es-dame-frueh', 'b', 'e4 e5 Bc4 Nc6 Qh5 g6 Qf3 Nf6', 4),
]);
