// Prueft die Mattbilder der Meisterschule (js/pakete/lernen/mattbilder.js) mit Stockfish in Node und rechnet je Lektion
// das Ziel nach: das kuerzere aus tiefer Suche ("mate N") und Selbstspiel (beide Seiten Stockfish, 300 ms je Zug).
// Aufruf: node werkzeuge/mattbilder-pruefen.mjs [Sekunden je tiefer Suche, Standard 10]
// Ausgabe je Lektion: Ziel in den Daten, Matt aus der Suche, Laenge im Selbstspiel, Vorschlag. Aendert nichts.
// Bei langen Matts (Turm, zwei Laeufer, Laeufer und Springer) schwankt die Laenge mit der Rechenzeit; in den Daten
// steht der kuerzeste je gefundene Weg. Gemeldet wird nur ein noch kuerzerer.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Chess } from '../vendor/chess/chess.js';
import { LEKTIONEN, pruefeLektion } from '../js/pakete/lernen/mattbilder.js';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SF = path.join(WURZEL, 'vendor/stockfish/stockfish-19-lite-single.js');
const SEKUNDEN = Number(process.argv[2]) || 10;

function stockfish() {
  const p = spawn(process.execPath, [SF], { stdio: ['pipe', 'pipe', 'inherit'] });
  let puffer = '';
  const warter = [];
  p.stdout.on('data', (d) => {
    puffer += d;
    let i;
    while ((i = puffer.indexOf('\n')) >= 0) {
      const z = puffer.slice(0, i);
      puffer = puffer.slice(i + 1);
      for (const w of [...warter]) w(z);
    }
  });
  const sende = (s) => p.stdin.write(s + '\n');
  const warte = (pruef) => new Promise((r) => {
    const w = (z) => { if (pruef(z)) { warter.splice(warter.indexOf(w), 1); r(z); } };
    warter.push(w);
  });
  return {
    async init() { sende('uci'); await warte((z) => z === 'uciok'); sende('setoption name Hash value 64'); sende('isready'); await warte((z) => z === 'readyok'); },
    async neu() { sende('ucinewgame'); sende('isready'); await warte((z) => z === 'readyok'); },
    async suche(fen, go) {
      let mate = null;
      const w = (z) => { const m = / multipv 1 .*score (mate|cp) (-?\d+)/.exec(z); if (m) mate = m[1] === 'mate' ? Number(m[2]) : null; };
      warter.push(w);
      sende('position fen ' + fen);
      sende('go ' + go);
      const z = await warte((x) => x.startsWith('bestmove'));
      warter.splice(warter.indexOf(w), 1);
      return { best: z.split(' ')[1], mate };
    },
    ende() { p.kill(); },
  };
}

async function selbstspiel(sf, fen) {
  const c = new Chess(fen);
  let halb = 0;
  while (!c.isGameOver() && halb < 240) {
    const r = await sf.suche(c.fen(), 'movetime 300');
    if (!r.best || r.best === '(none)') break;
    c.move({ from: r.best.slice(0, 2), to: r.best.slice(2, 4), promotion: r.best[4] });
    halb++;
  }
  return c.isCheckmate() && c.turn() === 'b' ? Math.ceil(halb / 2) : null;
}

const sf = stockfish();
await sf.init();
let fehler = 0;
for (const l of LEKTIONEN) {
  const f = pruefeLektion(l, Chess);
  if (f.length) { fehler++; console.log(`${l.id}: FEHLER ${f.join('; ')}`); continue; }
  await sf.neu();
  const tief = await sf.suche(l.fen, `movetime ${SEKUNDEN * 1000}`);
  await sf.neu();
  const spiel = await selbstspiel(sf, l.fen);
  const kandidaten = [tief.mate > 0 ? tief.mate : null, spiel].filter((x) => x != null);
  const vorschlag = kandidaten.length ? Math.min(...kandidaten) : null;
  console.log(`${l.id}: Ziel ${l.ziel} | Suche ${tief.mate ?? '-'} | Selbstspiel ${spiel ?? '-'} | Vorschlag ${vorschlag ?? '-'}`
    + (vorschlag != null && vorschlag < l.ziel ? '  <- kuerzerer Weg gefunden, Ziel senken' : ''));
}
sf.ende();
process.exit(fehler ? 1 : 0);
