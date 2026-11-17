// Zufallsstellungen mit den Figuren von Runde 1, Mattsuche + Selbstspiel. node erzeuge.mjs <wurzel> <id> <anzahl> <saat>
import { pathToFileURL } from 'node:url';
const [W, id, anzahl, saat] = process.argv.slice(2);
const E = await import(pathToFileURL(W + '/tests/lektion-engine.mjs').href);
const M = await import(pathToFileURL(W + '/js/pakete/lernen/mattbilder.js').href);
const l = M.lektion(id);
const stuecke = [];
const c0 = new E.Chess(l.fen);
for (const r of c0.board()) for (const q of r) if (q) stuecke.push(q);
let x = Number(saat) || 1;
const zufall = () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; };
const sf = E.stockfish(); await sf.init();
const gesehen = new Set();
for (let i = 0; i < Number(anzahl); i++) {
  const c = new E.Chess(); c.clear();
  const frei = [...Array(64).keys()];
  for (const p of stuecke) {
    let f; do { f = frei.splice(Math.floor(zufall() * frei.length), 1)[0]; } while (p.type === 'p' && (f < 8 || f > 55));
    c.put({ type: p.type, color: p.color }, 'abcdefgh'[f % 8] + (8 - Math.floor(f / 8)));
  }
  const fen = c.fen().split(' ')[0] + ' w - - 0 1';
  if (gesehen.has(fen)) continue; gesehen.add(fen);
  const f = M.pruefeLektion({ ...l, fen, ziel: 40 }, E.Chess);
  if (f.length) continue;
  const m = await E.mattIn(sf, fen, 'nodes 3000000');
  if (m == null || m < l.ziel) continue;
  const s = await E.spiele(sf, { ...l, fen, ziel: 40 }, fen, { go: 'nodes 150000', goGegner: 'nodes 400000' });
  console.log(`${id} ${fen} matt=${m} spiel=${s.ende}/${s.zuege}`);
}
sf.ende();
