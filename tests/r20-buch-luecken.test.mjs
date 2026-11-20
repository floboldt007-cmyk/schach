// Feinschliff R20, Auftrag fc-01:30 (Folge von Allround-Check 19.11.2026 Nr. 5): bekannte Linien, die im Buch fehlten
// und deshalb vom Coach "?!" bekamen. Gemessen gegen lichess-org/chess-openings (CC0-1.0, Stand 3ba6b20d): 1764 Linien
// bis 8 Halbzuege, 1472 davon nicht im Buch; 422 bekamen bei Stockfish Tiefe 14 (wie die App) ungenau oder schlechter.
// Die lichess-Liste benennt auch Scherzlinien (z. B. 1. f3 e5 2. Kf2), darum zaehlt als "bekannt" nur, was in der
// lichess-Meisterdatenbank mindestens 100-mal vorkommt: 41 Linien, alle "ungenau". Die deutschen Namen sind eigene.
// Jede ist jetzt Buch, mit deutschem Namen und englischem Anzeigenamen. Schwellen und js/review.js unveraendert.
//   node tests/r20-buch-luecken.test.mjs
import { eroeffnung, eroeffnungsAnzeige, tabellenFehler } from '../js/openings.js';
import { setzeSprache } from '../js/sprache.js';

let ok = 0;
let fehler = 0;
function pruefe(name, bed, info) {
  if (bed) { ok++; console.log('  ok   ' + name); }
  else { fehler++; console.log('FEHLER ' + name + (info === undefined ? '' : ' -- ' + JSON.stringify(info))); }
}

// [Zuege, deutscher Name, englischer Name, Meisterpartien bei der Messung]
export const LUECKEN = [
  ['c4 Nf6 d4 c5 Nf3', 'Englische Eröffnung: Symmetrische Variante, Anti-Benoni', 'English Opening: Symmetrical Variation, Anti-Benoni Variation', 5334],
  ['d4 e6 c4 b6', 'Englische Verteidigung', 'English Defense', 4743],
  ['e4 e6 d4 d5 Nd2 Nc6', 'Französische Verteidigung: Tarrasch-Variante, Guimard-Verteidigung', 'French Defense: Tarrasch Variation, Guimard Defense', 3102],
  ['e4 c6 d4 d5 Nc3 g6', 'Caro-Kann-Verteidigung: Gurgenidse-System', 'Caro-Kann Defense: Gurgenidze System', 2070],
  ['e4 e6 d4 d5 Nc3 Nc6', 'Französische Verteidigung: Hecht-Reefschläger-Variante', 'French Defense: Hecht-Reefschlaeger Variation', 1742],
  ['e4 c5 Nc3 e6 g3', 'Sizilianische Verteidigung: Geschlossene Variante mit g3', 'Sicilian Defense: Closed, 2...e6 3. g3', 1576],
  ['e4 e6 d4 d5 Bd3', 'Französische Verteidigung: Schlechter-Variante', 'French Defense: Schlechter Variation', 1375],
  ['e4 e6 d4 c5', 'Französische Verteidigung: Franco-Sizilianisch', 'French Defense: Franco-Sicilian Defense', 989],
  ['d4 b5', 'Polnische Verteidigung', 'Polish Defense', 676],
  ['e4 e5 Nf3 Nc6 Nc3 g6', 'Dreispringerspiel: Steinitz-Verteidigung', 'Three Knights Opening: Steinitz Defense', 558],
  ['e4 Nf6 d3', 'Aljechin-Verteidigung: Maróczy-Variante', 'Alekhine Defense: Maroczy Variation', 503],
  ['Nf3 b5', 'Réti-Eröffnung: Polnische Verteidigung', 'Réti Opening: Polish Defense', 470],
  ['d4 Nf6 Nc3 c5', 'Indische Verteidigung: Umgekehrte Tschigorin-Verteidigung', 'Indian Defense: Reversed Chigorin Defense', 361],
  ['e4 c5 d4 cxd4 c3 d3', 'Sizilianische Verteidigung: Abgelehntes Morra-Gambit mit d3', 'Sicilian Defense: Smith-Morra Gambit Declined, Push Variation', 359],
  ['Nf3 f5 e4', 'Réti-Eröffnung: Lisitsin-Gambit', 'Réti Opening: Lisitsin Gambit', 333],
  ['e4 e5 Nc3 Nc6 f4', 'Wiener Gambit mit Max-Lange-Verteidigung', 'Vienna Gambit, with Max Lange Defense', 319],
  ['d4 c5 d5 f5', 'Benoni-Verteidigung: Alt-Benoni, Mujannah-Aufbau', 'Benoni Defense: Old Benoni, Mujannah Formation', 313],
  ['e4 e5 Nf3 Qe7', 'Gunderam-Verteidigung', 'Gunderam Defense', 304],
  ['e4 e5 Nf3 Nc6 Be2', 'Königsspringerspiel: Tayler-Eröffnung', 'King\'s Pawn Game: Tayler Opening', 284],
  ['e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Qh4', 'Schottische Partie: Steinitz-Variante', 'Scotch Game: Steinitz Variation', 277],
  ['e4 e6 d4 d5 Nc3 Bb4 Bd2', 'Französische Verteidigung: Winawer-Variante, Fingerslip-Variante', 'French Defense: Winawer Variation, Fingerslip Variation', 242],
  ['e4 c6 d4 Na6', 'Caro-Kann-Verteidigung: De-Bruycker-Verteidigung', 'Caro-Kann Defense: De Bruycker Defense', 219],
  ['e4 Nc6 d4 d5 Nc3 Nf6', 'Nimzowitsch-Verteidigung: Skandinavische Variante mit Sf6', 'Nimzowitsch Defense: Scandinavian Variation, Vehre Variation', 215],
  ['e4 c5 f4 d5 Nc3', 'Sizilianische Verteidigung: McDonnell-Angriff mit Sc3', 'Sicilian Defense: McDonnell Attack, 3. Nc3', 204],
  ['e4 e5 f4 exf4 Nf3 Ne7', 'Königsgambit: Bonsch-Osmolowski-Variante', 'King\'s Gambit Accepted: Bonsch-Osmolovsky Variation', 204],
  ['e4 g6 d4 Bg7 Nc3 c5 dxc5 Qa5', 'Pterodactylus-Verteidigung: Östliche Variante', 'Pterodactyl Defense: Eastern, Rhamphorhynchus', 203],
  ['e4 e5 f4 d5 exd5 c6', 'Falkbeer-Gegengambit: Nimzowitsch-Marshall-Variante', 'Falkbeer Countergambit: Nimzowitsch-Marshall Variation', 200],
  ['e4 e5 f4 d5 exd5 e4', 'Falkbeer-Gegengambit: Staunton-Linie', 'Falkbeer Countergambit: Staunton Line', 198],
  ['e4 e5 Nf3 Nf6 Nxe5 d6 Nxf7', 'Russische Verteidigung: Cochrane-Gambit', 'Petrov\'s Defense: Cochrane Gambit', 181],
  ['e4 c5 Nf3 e6 b4', 'Sizilianische Verteidigung: Verzögertes Flügelgambit', 'Sicilian Defense: Wing Gambit Deferred', 178],
  ['e4 c5 Nf3 g6 d4 Bg7 Nc3 Qa5', 'Sizilianische Verteidigung: Pterodactylus-Variante', 'Sicilian Defense: Pterodactyl Variation', 176],
  ['Nf3 d5 d4 Bg4', 'Damenbauernspiel: Anti-Torre', 'Queen\'s Pawn Game: Anti-Torre', 175],
  ['e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 d5', 'Sizilianische Verteidigung: Nimzo-Amerikanische Variante', 'Sicilian Defense: Nimzo-American Variation', 170],
  ['d4 Nf6 Nc3 d5 e4', 'Damenbauernspiel: Hübsch-Gambit', 'Queen\'s Pawn Game: Huebsch Gambit', 161],
  ['e4 Nc6 Nf3 f5', 'Nimzowitsch-Verteidigung: Colorado-Gegengambit', 'Nimzowitsch Defense: Colorado Countergambit', 152],
  ['e4 Nc6 Nf3 e6', 'Nimzowitsch-Verteidigung: Franco-Nimzowitsch-Variante', 'Nimzowitsch Defense: Franco-Nimzowitsch Variation', 150],
  ['e4 e6 d4 d5 e5 c5 Qg4', 'Französische Verteidigung: Vorstoßvariante, Nimzowitsch-Angriff', 'French Defense: Advance Variation, Nimzowitsch Attack', 142],
  ['e4 e5 Nf3 Nc6 Bb5 Bb4', 'Spanische Partie: Alapin-Verteidigung', 'Ruy Lopez: Alapin Defense', 125],
  ['e4 c5 Nf3 Nc6 b4', 'Sizilianische Verteidigung: Portsmouth-Gambit', 'Sicilian Defense: Portsmouth Gambit', 122],
  ['e4 c6 d4 d5 Nc3 b5', 'Caro-Kann-Verteidigung: Gurgenidse-Gegenangriff', 'Caro-Kann Defense: Gurgenidze Counterattack', 111],
  ['d4 Nf6 f3', 'Indische Verteidigung: Paleface-Angriff', 'Indian Defense: Paleface Attack', 104],
];

pruefe('41 Linien in der Liste', LUECKEN.length === 41, LUECKEN.length);
pruefe('Tabelle ohne ungueltige Zeilen', tabellenFehler().length === 0, tabellenFehler());
for (const [zuege, de, en] of LUECKEN) {
  const san = zuege.split(' ');
  const e = eroeffnung(san);
  pruefe(`${zuege}: letzter Zug ist Buch`, e.buch[san.length - 1] === true, e.buch);
  pruefe(`${zuege}: Name "${de}"`, e.namen[san.length - 1] === de, e.namen[san.length - 1]);
  setzeSprache('en');
  const anzeige = eroeffnungsAnzeige(de);
  setzeSprache('de');
  pruefe(`${zuege}: englisch "${en}"`, anzeige === en, anzeige);
}

console.log(`${ok}/${ok + fehler} bestanden`);
process.exit(fehler ? 1 : 0);
