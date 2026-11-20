// Tagesraetsel tr-0101 (fc-08:15, Fenster 43; Flos JA 20.11.2026, Befund R20-Kritik/lektionen-schach/bericht.md): die alte
// Aufgabe (8/2k5/1p6/7R/3P3P/p1P2KP1/5P2/4r3 b, Loesung a2) hatte drei gleich gute erste Zuege (a2, Te7, Te8, Tiefe 26 je
// rund -7); js/ui/raetsel.js nimmt nur den hinterlegten Zug an, Te7 und Te8 galten als falsch. Der Ersatz kommt aus der
// Raetsel-Fabrik (werkzeuge/raetsel-fabrik.mjs, gleicher Lauf, ungenutzter Kandidat) und wird hier gegen Stockfish
// nachgerechnet, tiefer als die Fabrik (Tiefe 22, MultiPV 3, statt 250.000 Knoten, MultiPV 2), mit ihrer eigenen Regel:
//   - Stellung legal, Titel nennt die Seite am Zug, die Loesung ist spielbar, keine Stellung doppelt in der Datei
//   - jeder eigene Zug ist der beste und eindeutig: Abstand der Gewinnchance zum zweitbesten mindestens 0,15
//     (js/review.js gewinnChance, wie ABSTAND in der Fabrik); der erste Zug gewinnt (Matt oder mindestens +2,00)
//   - jede Antwort des Gegners ist sein bester Zug
//   - der Tag behaelt seine Stufe in der Wochenkurve (Vortag leichter, Folgetag schwerer)
//   node tests/r24-raetsel-tr0101.test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Chess } from '../vendor/chess/chess.js';
import { gewinnChance } from '../js/review.js';
import { stockfish } from './lektion-engine.mjs';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ALT_FEN = '8/2k5/1p6/7R/3P3P/p1P2KP1/5P2/4r3 b - - 2 43';
const TIEFE = 'depth 22';   // tiefer als die Fabrik; MultiPV 3, frische Engine je Stellung (MultiPV 2 uebersah Te7 im alten Raetsel)
const ABSTAND = 0.15;
let ok = 0; let fehler = 0;
function pruefe(name, wert, info = '') {
  if (wert) { ok++; console.log('ok   ' + name); } else { fehler++; console.log('FEHLER ' + name + ' ' + info); } // INTENTIONAL-SLOP[T4]: die Konsole ist der Ausgabeweg der Probe
}

const daten = JSON.parse(readFileSync(path.join(WURZEL, 'daten/tagesraetsel/raetsel.json'), 'utf8'));
const tagVon = (id) => daten.tage.findIndex((t) => t.aufgaben.some((a) => a.id === id));
const k = tagVon('tr-0101');
const a = k >= 0 ? daten.tage[k].aufgaben.find((x) => x.id === 'tr-0101') : null;
pruefe('tr-0101 ist in der Datei', !!a);
if (!a) { console.log(`${ok}/${ok + fehler} bestanden`); process.exit(1); }
pruefe('tr-0101 ist nicht mehr die mehrdeutige Stellung', a.fen !== ALT_FEN, a.fen);
const fens = daten.tage.flatMap((t) => t.aufgaben.map((x) => x.fen.split(' ').slice(0, 4).join(' ')));
pruefe('keine Stellung doppelt in der Datei', new Set(fens).size === fens.length);
const stufe = (t) => Math.max(...t.aufgaben.map((x) => x.stufe));
pruefe(`Wochenkurve: Vortag leichter, Folgetag schwerer (${stufe(daten.tage[k - 1])} < ${a.stufe} < ${stufe(daten.tage[k + 1])})`,
  stufe(daten.tage[k - 1]) < a.stufe && a.stufe < stufe(daten.tage[k + 1]));

const c = new Chess(a.fen);
pruefe('Titel nennt die Seite am Zug', a.titel === (c.turn() === 'w' ? 'Weiß am Zug' : 'Schwarz am Zug'), a.titel);
pruefe('Loesung ungerade lang (endet mit eigenem Zug)', a.loesung.length % 2 === 1);
const sf = stockfish();
try {
  await sf.init(); await sf.neu();
  for (let i = 0; i < a.loesung.length; i++) {
    const u = a.loesung[i];
    const fen = c.fen();
    let m = null;
    try { m = c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }); } catch (e) { m = null; }
    pruefe(`Zug ${i + 1} ${u} ist legal`, !!m);
    if (!m) break;
    if (i % 2 === 0) {
      await sf.neu();
      const [b1, ...rest] = await sf.alle(fen, TIEFE, 3);
      const p1 = gewinnChance(b1, 'w');
      const b2 = rest.sort((x, y) => gewinnChance(y, 'w') - gewinnChance(x, 'w'))[0];
      const p2 = b2 ? gewinnChance(b2, 'w') : 0;
      pruefe(`Zug ${i + 1} ${m.san} ist der beste (Engine ${b1.uci})`, b1.uci === u || (m.san.endsWith('#') && b1.mate === 1), JSON.stringify(b1));
      pruefe(`Zug ${i + 1} ${m.san} eindeutig: Abstand ${(p1 - p2).toFixed(3)} >= ${ABSTAND} (zweitbester ${b2?.uci} ${b2?.mate != null ? '#' + b2.mate : b2?.cp})`,
        c.isCheckmate() || p1 - p2 >= ABSTAND, JSON.stringify([b1, b2]));
      if (i === 0) pruefe(`erster Zug gewinnt (Matt oder mindestens +2,00): ${b1.mate != null ? '#' + b1.mate : b1.cp}`, (b1.mate != null && b1.mate > 0) || b1.cp >= 200);
    } else {
      await sf.neu();
      const b = await sf.suche(fen, TIEFE);
      pruefe(`Antwort ${i + 1} ${m.san} ist der beste Zug des Gegners (Engine ${b.best})`, b.best === u, JSON.stringify(b));
    }
  }
} finally {
  sf.ende();
}
console.log(`${ok}/${ok + fehler} bestanden`);
process.exit(fehler ? 1 : 0);
