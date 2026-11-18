// Messung fuer R19 Lektionen besser: je Lektion und Runde die Zuege bis zum Ziel (beide Seiten Stockfish, wie die App
// wertet) und der Anteil der Zuege, die man ohne Nachdenken findet: In jeder Stellung vor Flos Zug bewertet Stockfish
// ALLE legalen Zuege; "ohne Nachdenken" heisst, mindestens die Haelfte davon ist fast so gut wie der beste (nahBest).
// Aufruf: node werkzeuge/lektionen-messen.mjs [ids, kommagetrennt]   Ausgabe: eine Zeile je Runde und eine Summe. Aendert nichts.
import { stockfish, spiele, nahBest, artVon, Chess } from '../tests/lektion-engine.mjs';
import * as M from '../js/pakete/lernen/mattbilder.js';

export const SCHWERE_13 = ['dame', 'zwei-tuerme', 'turm', 'zwei-laeufer', 'erstickt', 'laeufer-springer',
  'erst-koenig', 'opposition', 'schluesselfelder', 'patt-vermeiden', 'philidor', 'lucena', 'dame-bauer'];
const ids = process.argv[2] ? process.argv[2].split(',') : SCHWERE_13;
const runden = (l) => (typeof M.rundenVon === 'function' ? M.rundenVon(l) : [{ fen: l.fen, ziel: l.ziel }]);

const sf = stockfish();
await sf.init();
let summeZuege = 0, summeStellungen = 0, summeFrei = 0, summeRunden = 0;
for (const id of ids) {
  const l = M.lektion(id);
  if (!l) { console.log(`${id}: unbekannt`); continue; }
  const rs = runden(l);
  for (let i = 0; i < rs.length; i++) {
    const r = { ...l, fen: rs[i].fen, ziel: rs[i].ziel };
    const s = await spiele(sf, r, r.fen, { go: 'nodes 150000', goGegner: 'nodes 400000' });
    let frei = 0;
    for (const fen of s.zugliste) {
      const n = new Chess(fen).moves().length;
      const e = await sf.alle(fen, 'nodes 60000', n);
      if (e.filter((x) => nahBest(x, e[0], artVon(l))).length * 2 >= n) frei++;
    }
    summeZuege += s.zuege; summeStellungen += s.zugliste.length; summeFrei += frei; summeRunden++;
    console.log(`${id} runde ${i + 1}/${rs.length}: ende=${s.ende} zuege=${s.zuege} ziel=${r.ziel} ohneNachdenken=${frei}/${s.zugliste.length}`
      + ` (${Math.round(100 * frei / Math.max(1, s.zugliste.length))} %)`);
  }
}
console.log(`SUMME lektionen=${ids.length} runden=${summeRunden} zuege=${summeZuege} ohneNachdenken=${summeFrei}/${summeStellungen}`
  + ` (${Math.round(100 * summeFrei / Math.max(1, summeStellungen))} %)`);
sf.ende();
