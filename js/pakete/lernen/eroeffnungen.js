// Meisterschule, Bereich Eroeffnungen (Flo 31.10.2026: "Ich mag die Meisterschule, gibt's noch mehr? Eroeffnungen oder
// ... du entscheidest"; Lehrplan im Vault Schach-App/Meisterschule.md, "Eroeffnungen Teil 1"). Reine Daten, keine Importe.
// Die Zugfolgen sind Allgemeingut der Schachtheorie; Texte eigene (texte.js: titel, idee und je eigenem Zug ein Satz
// zug.<id>.<k>, warum man ihn spielt).
//
//   art 'folge'   Zugfolge-Trainer (js/ui/lektion.js): Flo spielt seine Seite, der Computer antwortet mit den Zuegen der
//                 Folge. Ein anderer Zug wird zurueckgenommen und erklaert; der Hinweis zeigt den Zug der Eroeffnung.
//   farbe         'w' oder 'b': Flos Seite (bei 'b' beginnt der Computer mit Weiss, das Brett steht gedreht)
//   folge         alle Zuege in englischer Kurzschrift (chess.js SAN), abwechselnd ab Weiss; der letzte gehoert Flo
//   ziel          Zahl von Flos Zuegen in der Folge (tests/lernen.test.mjs rechnet nach)
export const GRUNDSTELLUNG = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const e = (id, stufe, farbe, folge, ziel) => Object.freeze({ id, art: 'folge', stufe, farbe, fen: GRUNDSTELLUNG,
  folge: Object.freeze(folge.split(' ')), ziel });

export const EROEFFNUNGEN = Object.freeze([
  e('italienisch', 'leicht', 'w', 'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d4', 5),
  e('schottisch', 'leicht', 'w', 'e4 e5 Nf3 Nc6 d4 exd4 Nxd4', 4),
  e('schaefer-abwehr', 'leicht', 'b', 'e4 e5 Bc4 Nc6 Qh5 g6 Qf3 Nf6', 4),
  e('skandinavisch', 'leicht', 'b', 'e4 d5 exd5 Qxd5 Nc3 Qa5 d4 Nf6', 4),
  e('spanisch', 'mittel', 'w', 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O', 5),
  e('londoner', 'mittel', 'w', 'd4 d5 Bf4 Nf6 e3 e6 Nf3 c5 c3', 5),
  e('damengambit', 'mittel', 'w', 'd4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3', 5),
  e('caro-kann', 'mittel', 'b', 'e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5', 4),
  e('franzoesisch', 'mittel', 'b', 'e4 e6 d4 d5 e5 c5 c3 Nc6', 4),
  e('sizilianisch', 'mittel', 'b', 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6', 5),
  e('legal-falle', 'mittel', 'w', 'e4 e5 Nf3 d6 Bc4 Bg4 Nc3 g6 Nxe5 Bxd1 Bxf7+ Ke7 Nd5#', 7),
]);
