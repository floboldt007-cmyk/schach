// Paket "start" (Welle A, A4): die Aufgaben der Regel-Hilfe und des Einstufungstests. Reine Daten, kein DOM.
//
// Quelle aller Stellungen: selbst erstellt fuer Crownmate (keine Stellung aus einer Datenbank, einem Buch oder einer
// anderen App). Jede Aufgabe ist mit chess.js geprueft (tests/start.test.mjs): Stellung gueltig, Loesung spielbar und
// eindeutig.
//   Regel-Hilfe:  genau ein Zug erreicht das Ziel der Aufgabe (ziel: Feld der Figur, die zu schlagen ist, oder 'matt'),
//                 und er wird mit der genannten Figur gespielt (figur).
//   Einstufung:   jeder Zug von Flo in der Loesung ist der einzige beste (Suche mit Material und Matt, Tiefe 4, das
//                 Endspiel Tiefe 7); der naechstbeste Zug liegt mindestens 2 Bauern dahinter oder setzt nicht matt.
//                 Antworten des Gegners in der Loesung sind erzwungen (einziger Zug).
//
// Format wie der Raetsel-Bildschirm (js/ui/raetsel.js, Aufgabe): { id, fen, loesung: [uci, ...], titel, text, hinweis,
// erklaerung, marke, vorZug }, dazu fuer die Pruefung und die Begruendung:
//   Regel-Hilfe:  figur ('k' 'q' 'r' 'b' 'n' 'p'), ziel (Feld oder 'matt')
//   Einstufung:   stufe (1 leicht bis 8 knifflig), thema (Akkusativ fuer "Gut gesehen: die Gabel"), naechstes (Infinitiv
//                 mit zu fuer "Als Naechstes lohnt es sich, Gabeln zu finden.")
// Texte: Oberflaeche mit echten Umlauten, hoechstens 240 Zeichen je Text (raetsel.js kuerzt sonst).

export const REGEL_AUFGABEN = Object.freeze([
  Object.freeze({
    id: 'regel-turm', figur: 'r', ziel: 'd7',
    fen: '7k/3n4/8/8/8/8/3R4/7K w - - 0 1', loesung: Object.freeze(['d2d7']),
    titel: 'Der Turm',
    text: 'Der Turm zieht gerade: vor, zurück und zur Seite, so weit der Weg frei ist. Tippe ihn an, die Punkte zeigen, wohin er kann. Schlage den Springer.',
    hinweis: 'Der Turm auf d2 kann gerade nach oben ziehen.',
    erklaerung: 'Genau. Bis d7 war der Weg frei.',
  }),
  Object.freeze({
    id: 'regel-laeufer', figur: 'b', ziel: 'g5',
    fen: 'k7/8/8/6r1/8/8/8/2B4K w - - 0 1', loesung: Object.freeze(['c1g5']),
    titel: 'Der Läufer',
    text: 'Der Läufer zieht schräg, so weit er will, und bleibt immer auf seiner Feldfarbe. Schlage den Turm.',
    hinweis: 'Folge der Schräge vom Läufer auf c1 nach rechts oben.',
    erklaerung: 'Richtig. Ein Läufer trifft auch über das halbe Brett.',
  }),
  Object.freeze({
    id: 'regel-dame', figur: 'q', ziel: 'h5',
    fen: 'k7/8/8/7b/8/8/8/K2Q4 w - - 0 1', loesung: Object.freeze(['d1h5']),
    titel: 'Die Dame',
    text: 'Die Dame zieht wie Turm und Läufer zusammen: gerade und schräg, so weit der Weg frei ist. Sie ist die stärkste Figur. Schlage den Läufer.',
    hinweis: 'Diesmal geht es schräg nach rechts oben.',
    erklaerung: 'Stark. Die Dame hatte den Läufer längst im Blick.',
  }),
  Object.freeze({
    id: 'regel-springer', figur: 'n', ziel: 'e2',
    fen: 'k7/8/8/8/8/8/4bPPP/K5N1 w - - 0 1', loesung: Object.freeze(['g1e2']),
    titel: 'Der Springer',
    text: 'Der Springer springt wie ein L: zwei Felder in eine Richtung, dann eins zur Seite. Andere Figuren stören ihn nicht. Schlage den Läufer.',
    hinweis: 'Zwei Felder nach links, eins nach oben.',
    erklaerung: 'Sauber gesprungen. Nur der Springer darf über Figuren hinweg.',
  }),
  Object.freeze({
    id: 'regel-koenig', figur: 'k', ziel: 'e5',
    fen: '7k/8/1p6/2n1n3/3K4/8/8/8 w - - 0 1', loesung: Object.freeze(['d4e5']),
    titel: 'Der König',
    text: 'Der König zieht ein Feld weit, in jede Richtung. Er darf nie auf ein Feld, das der Gegner angreift. Schlage den Springer, der nicht gedeckt ist.',
    hinweis: 'Der Springer auf c5 ist vom Bauern auf b6 gedeckt, der auf e5 nicht.',
    erklaerung: 'Richtig. Auf c5 hätte der Bauer den König angegriffen, deshalb ging das nicht.',
  }),
  Object.freeze({
    id: 'regel-bauer', figur: 'p', ziel: 'd5',
    fen: 'k7/8/8/3nn3/4P3/8/8/7K w - - 0 1', loesung: Object.freeze(['e4d5']),
    titel: 'Der Bauer',
    text: 'Der Bauer zieht geradeaus, beim ersten Zug auch zwei Felder. Schlagen kann er nur schräg nach vorn. Schlage mit dem Bauern.',
    hinweis: 'Geradeaus ist der Weg versperrt. Schau schräg nach vorn.',
    erklaerung: 'Genau. Kommt ein Bauer auf der letzten Reihe an, wird er zu einer Dame.',
  }),
  Object.freeze({
    id: 'regel-matt', figur: 'r', ziel: 'matt',
    fen: '7k/6pp/8/8/8/8/8/R5K1 w - - 0 1', loesung: Object.freeze(['a1a8']),
    titel: 'Das Ziel: Schachmatt',
    text: 'Wer den gegnerischen König so angreift, dass er nicht mehr entkommt, gewinnt. Das heißt Schachmatt. Setze matt.',
    hinweis: 'Der König steckt hinter seinen eigenen Bauern fest.',
    erklaerung: 'Schachmatt! Die eigenen Bauern versperren dem König die Flucht.',
  }),
]);

// Einstufung: 8 Aufgaben mit steigender Schwierigkeit (stufe 1 bis 8)
export const EINSTUFUNG = Object.freeze([
  Object.freeze({
    id: 'stufe-1', stufe: 1, thema: 'das Matt in 1', naechstes: 'Mattbilder in einem Zug zu erkennen',
    fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4', loesung: Object.freeze(['h5f7']), vorZug: 'g8f6',
    titel: 'Matt in 1', text: 'Weiß am Zug setzt matt.', marke: 'Leicht',
    hinweis: 'Das Feld f7 deckt nur der König.',
    erklaerung: 'Die Dame schlägt auf f7, der Läufer auf c4 deckt sie. Schachmatt.',
  }),
  Object.freeze({
    id: 'stufe-2', stufe: 2, thema: 'den Damengewinn', naechstes: 'ungedeckte Figuren zu schlagen',
    fen: 'r1b1kbnr/pppp1ppp/2n5/4p3/3qP3/2N2N2/PPPP1PPP/R1BQKB1R w KQkq - 0 4', loesung: Object.freeze(['f3d4']),
    titel: 'Gewinne Material', text: 'Weiß am Zug. Was kannst du mitnehmen?', marke: 'Leicht',
    hinweis: 'Schau dir die schwarze Dame an.',
    erklaerung: 'Der Springer schlägt die Dame. Selbst wenn Schwarz zurückschlägt, ist die Dame gegen einen Springer getauscht.',
  }),
  Object.freeze({
    id: 'stufe-3', stufe: 3, thema: 'das Matt mit Schwarz', naechstes: 'das Brett auch mit Schwarz zu lesen',
    fen: 'r1b1k1nr/pppp1ppp/2n5/2b1p3/2B1P2q/5N2/PPPP1PP1/RNBQK2R b KQkq - 0 5', loesung: Object.freeze(['h4f2']), vorZug: 'g1f3',
    titel: 'Matt in 1', text: 'Diesmal spielst du Schwarz. Setze matt.', marke: 'Mittel',
    hinweis: 'Das Feld f2 ist die Schwachstelle.',
    erklaerung: 'Die Dame schlägt auf f2, der Läufer auf c5 deckt sie. Der König kann nicht weg.',
  }),
  Object.freeze({
    id: 'stufe-4', stufe: 4, thema: 'die Gabel', naechstes: 'Gabeln zu finden',
    fen: 'r3k2r/pp3ppp/8/1q1N4/8/8/PPP2PPP/R4RK1 w kq - 0 1', loesung: Object.freeze(['d5c7']),
    titel: 'Gewinne Material', text: 'Weiß am Zug. Ein Zug greift mehrere Figuren zugleich an.', marke: 'Mittel',
    hinweis: 'Der Springer auf d5 hat ein Feld mit Schach.',
    erklaerung: 'Eine Gabel: Der Springer bietet Schach und greift zugleich Dame und Turm an.',
  }),
  Object.freeze({
    id: 'stufe-5', stufe: 5, thema: 'den Spieß', naechstes: 'Spieße zu erkennen',
    fen: '8/3k3q/8/1pp5/8/8/5PPP/R5K1 w - - 0 1', loesung: Object.freeze(['a1a7']),
    titel: 'Gewinne Material', text: 'Weiß am Zug. Hinter dem König steht etwas Wertvolles.', marke: 'Mittel',
    hinweis: 'König und Dame stehen auf derselben Reihe.',
    erklaerung: 'Ein Spieß: Der Turm bietet Schach, der König muss weg, dahinter fällt die Dame.',
  }),
  Object.freeze({
    id: 'stufe-6', stufe: 6, thema: 'die Fesselung', naechstes: 'Fesselungen auszunutzen',
    fen: 'r5k1/ppp3pp/4q3/8/8/1P6/P1P2PPP/R4BK1 w - - 0 1', loesung: Object.freeze(['f1c4']),
    titel: 'Gewinne Material', text: 'Weiß am Zug. Die Dame steht auf einer gefährlichen Schräge.', marke: 'Knifflig',
    hinweis: 'Der Läufer auf f1 kann die Dame am König festhalten.',
    erklaerung: 'Eine Fesselung: Die Dame darf nicht aus der Schräge, sonst stünde der König im Schach. Sie geht verloren.',
  }),
  Object.freeze({
    id: 'stufe-7', stufe: 7, thema: 'das Matt in 2', naechstes: 'zwei Züge vorauszudenken',
    fen: '3r2k1/5ppp/8/8/8/8/4QPPP/4R1K1 w - - 0 1', loesung: Object.freeze(['e2e8', 'd8e8', 'e1e8']),
    titel: 'Matt in 2', text: 'Weiß am Zug setzt in zwei Zügen matt. Ein Opfer hilft.', marke: 'Knifflig',
    hinweis: 'Die Grundreihe von Schwarz hat nur einen Wächter.',
    erklaerung: 'Die Dame lenkt den Turm ab, danach setzt der Turm auf der Grundreihe matt.',
  }),
  Object.freeze({
    id: 'stufe-8', stufe: 8, thema: 'das Endspiel', naechstes: 'Bauernendspiele zu rechnen',
    fen: '8/8/5k2/1P6/8/8/8/7K w - - 0 1', loesung: Object.freeze(['b5b6']),
    titel: 'Endspiel', text: 'Weiß am Zug gewinnt. Wie?', marke: 'Knifflig',
    hinweis: 'Zähle: Wer ist schneller, der Bauer oder der König?',
    erklaerung: 'Der schwarze König kommt zu spät: Der Bauer läuft durch und wird zur Dame (Quadratregel).',
  }),
]);
