// Mattbilder: "Matt in N" (ziel) jeder Runde mit hoechstens 7 Steinen ist die wahre Mattdistanz bei bester Verteidigung
// (fc-08:15 Punkt 4, Fenster 43; Befund R20-Kritik/fabrik-tiefe/bericht.md). Vorher kamen die Ziele aus Stockfish-Suche
// und Selbstspiel, und neun Runden lagen daneben, zwei davon zu kurz (gegen beste Verteidigung nicht schaffbar).
// Ohne Netz: die Tablebase-Werte stehen in tests/mattbilder-tablebase.mjs.
//   node tests/r24-mattbilder-tablebase.test.mjs
import { LEKTIONEN, rundenVon } from '../js/pakete/lernen/mattbilder.js';
import { TABLEBASE_DTM, steine, mattZuege } from './mattbilder-tablebase.mjs';

let ok = 0; let fehler = 0;
function pruefe(name, wert, info = '') {
  if (wert) { ok++; console.log('ok   ' + name); } else { fehler++; console.log('FEHLER ' + name + ' ' + info); } // INTENTIONAL-SLOP[T4]: die Konsole ist der Ausgabeweg der Probe
}

const runden = LEKTIONEN.flatMap((l) => rundenVon(l).map((r, i) => ({ tag: `${l.id}#${i + 1}`, ...r })));
const klein = runden.filter((r) => steine(r.fen) <= 7);
pruefe(`jede Runde mit hoechstens 7 Steinen steht in der Tablebase-Tabelle (${klein.length})`,
  klein.every((r) => r.fen in TABLEBASE_DTM), klein.filter((r) => !(r.fen in TABLEBASE_DTM)).map((r) => r.tag).join(', '));
pruefe('keine Tabellenzeile ohne Runde (Tabelle und Daten passen zusammen)',
  Object.keys(TABLEBASE_DTM).every((f) => klein.some((r) => r.fen === f)));
for (const r of klein) {
  const n = mattZuege(r.fen);
  pruefe(`${r.tag}: Matt in ${r.ziel} = Tablebase ${n} (DTM ${TABLEBASE_DTM[r.fen]} Halbzuege)`, r.ziel === n);
}
console.log(`${ok}/${ok + fehler} bestanden`);
process.exit(fehler ? 1 : 0);
