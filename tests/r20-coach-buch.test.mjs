// Feinschliff R20, Allround-Check 19.11.2026 Nr. 5 (Auftrag fc-00:40): Der Coach nannte 3. Lc4 nach 1. e4 e5 2. Sf3 Sf6
// "Unscharf" (?!). Gemessen mit dem Stockfish der App (Tiefe 8 bis 24): Lc4 kostet in jeder Tiefe 0,06 bis 0,09
// Gewinnchance, das liegt im Band "ungenau" (GRENZEN.gut 0,05 bis GRENZEN.ungenau 0,10); es liegt also nicht an der Tiefe.
// Die Ursache ist das Buch: 3. Lc4 ist bekannte Theorie (Russische Verteidigung, Italienische Variante, ECO C42), fehlte
// aber in js/openings.js, waehrend dort auch objektiv schwache Gambits (Lettisch, Elefant) als Buch stehen.
// Buchzuege bekommen "buch" statt ?!, solange die Engine sie nicht als groben Fehler sieht (js/review.js klassifiziere 2.).
//   node tests/r20-coach-buch.test.mjs
import { Chess } from '../vendor/chess/chess.js';
import { eroeffnung, eroeffnungsAnzeige } from '../js/openings.js';
import { klassifiziere } from '../js/review.js';
import { setzeSprache } from '../js/sprache.js';

let ok = 0;
let fehler = 0;
function pruefe(name, bed, info) {
  if (bed) { ok++; console.log('  ok   ' + name); }
  else { fehler++; console.log('FEHLER ' + name + (info === undefined ? '' : ' -- ' + JSON.stringify(info))); }
}

const NAME = 'Russische Verteidigung: Italienische Variante';
const e = eroeffnung(['e4', 'e5', 'Nf3', 'Nf6', 'Bc4']);
pruefe('3. Lc4 in der Russischen Verteidigung ist ein Buchzug', e.buch[4] === true, e);
pruefe(`... mit dem Namen "${NAME}"`, e.namen[4] === NAME, e.namen);
const u = eroeffnung(['e4', 'e5', 'Bc4', 'Nf6', 'Nf3']);
pruefe('Zugumstellung ueber das Laeuferspiel (1. e4 e5 2. Lc4 Sf6 3. Sf3): dieselbe Stellung, auch Buch', u.buch[4] === true && u.namen[4] === NAME, u);
const weiter = eroeffnung(['e4', 'e5', 'Nf3', 'Nf6', 'Bc4', 'Nxe4']);
pruefe('der Name bleibt fuer den naechsten Zug (3...Sxe4) stehen, ohne dass 3...Sxe4 selbst Buch wird', weiter.namen[5] === NAME && weiter.buch[5] === false, weiter);
setzeSprache('en');
const en = eroeffnungsAnzeige(NAME);
setzeSprache('de');
pruefe('Englischer Name "Petrov\'s Defense: Italian Variation"', en === 'Petrov\'s Defense: Italian Variation', en);

// der gemessene Fall (Tiefe 14: vorher +40 mit Sxe5, nach Lc4 -32 aus Sicht von Weiss)
const c = new Chess();
for (const z of ['e4', 'e5', 'Nf3', 'Nf6']) c.move(z);
const fall = { fenVorher: c.fen(), uci: 'f1c4', besterZug: 'f3e5', evalVorher: { cp: 40 }, evalNachher: { cp: -32 } };
const ohne = klassifiziere(fall);
const mit = klassifiziere({ ...fall, buch: e.buch[4], eroeffnung: e.namen[4] });
pruefe('ohne Buch waere es "ungenau" (die Schwelle bleibt, Verlust 0,066)', ohne.klasse === 'ungenau' && Math.abs(ohne.verlust - 0.066) < 0.005, { klasse: ohne.klasse, verlust: ohne.verlust });
pruefe('mit dem Buch aus js/openings.js: "buch"', mit.klasse === 'buch', { klasse: mit.klasse, notiz: mit.notiz });

console.log(`${ok}/${ok + fehler} bestanden`);
process.exit(fehler ? 1 : 0);
