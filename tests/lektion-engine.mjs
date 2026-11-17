// Stockfish in Node fuer die Meisterschule (R19 Lektionen besser): eine Lektion so durchspielen, wie die App sie wertet
// (pruefeZiel aus js/pakete/lernen/mattbilder.js), beide Seiten Stockfish; dazu Mattsuche und Zugbewertung fuer die
// Messung "ohne Nachdenken". Genutzt von tests/r19-lektionen-besser.test.mjs und werkzeuge/lektionen-messen.mjs.
//
//   stockfish() -> { init, neu, suche(fen, go) -> { best, mate, cp }, alle(fen, go, n) -> [{ uci, mate, cp }], ende }
//   spiele(sf, l, fen, { go }) -> { ende: 'geschafft' | Grund, zuege, zugliste: [fen vor Flos Zug] }
//   mattIn(sf, fen, go) -> N | null       Suche (go z. B. 'nodes 3000000') nach "mate N" fuer Weiss
//   gut(eintrag, art) -> boolean         ein Zug haelt das Ziel (Matt/Gewinn: mate > 0 oder cp >= 400; halten: cp >= -150)
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Chess } from '../vendor/chess/chess.js';
import { pruefeZiel, bilanz, artVon, grenze } from '../js/pakete/lernen/mattbilder.js';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SF = path.join(WURZEL, 'vendor/stockfish/stockfish-19-lite-single.js');

export function stockfish() {
  const p = spawn(process.execPath, [SF], { stdio: ['pipe', 'pipe', 'inherit'] });
  let puffer = '';
  const warter = [];
  p.stdout.on('data', (d) => {
    puffer += d;
    let i;
    while ((i = puffer.indexOf('\n')) >= 0) {
      const z = puffer.slice(0, i).trim();
      puffer = puffer.slice(i + 1);
      for (const w of [...warter]) w(z);
    }
  });
  const sende = (s) => p.stdin.write(s + '\n');
  const warte = (pruef) => new Promise((r) => {
    const w = (z) => { if (pruef(z)) { warter.splice(warter.indexOf(w), 1); r(z); } };
    warter.push(w);
  });
  const lies = (z, ziel) => {
    const m = /\bmultipv (\d+) .*score (mate|cp) (-?\d+).* pv (\S+)/.exec(z);
    if (m) ziel[Number(m[1]) - 1] = { uci: m[4], mate: m[2] === 'mate' ? Number(m[3]) : null, cp: m[2] === 'cp' ? Number(m[3]) : null };
  };
  return {
    async init() { sende('uci'); await warte((z) => z === 'uciok'); sende('setoption name Hash value 32'); sende('isready'); await warte((z) => z === 'readyok'); },
    async neu() { sende('setoption name MultiPV value 1'); sende('ucinewgame'); sende('isready'); await warte((z) => z === 'readyok'); },
    async suche(fen, go) {
      const zeilen = [];
      const w = (z) => lies(z.replace(/^info depth \d+ seldepth \d+ (?!multipv)/, '$& multipv 1 '), zeilen);
      warter.push(w);
      sende('position fen ' + fen);
      sende('go ' + go);
      const z = await warte((x) => x.startsWith('bestmove'));
      warter.splice(warter.indexOf(w), 1);
      const e = zeilen[0] || {};
      return { best: z.split(' ')[1], mate: e.mate ?? null, cp: e.cp ?? null };
    },
    async alle(fen, go, n) {
      sende(`setoption name MultiPV value ${n}`);
      const zeilen = [];
      const w = (z) => lies(z, zeilen);
      warter.push(w);
      sende('position fen ' + fen);
      sende('go ' + go);
      await warte((x) => x.startsWith('bestmove'));
      warter.splice(warter.indexOf(w), 1);
      sende('setoption name MultiPV value 1');
      return zeilen.filter(Boolean);
    },
    ende() { p.kill(); },
  };
}

const uciZug = (c, u) => c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] || 'q' });

// wie js/ui/lektion.js: Flo zieht, pruefeZiel 'flo'; Gegner zieht, pruefeZiel 'gegner'
// goGegner: die App verteidigt mit voller Staerke und 450 ms (js/ui/lektion.js ZEIT_GEGNER), also nie schwaecher als Flo
export async function spiele(sf, l, fen, { go = 'movetime 150', goGegner = go } = {}) {
  const c = new Chess(fen);
  const start = bilanz(c);
  const zugliste = [];
  let zuege = 0;
  await sf.neu();
  for (let runde = 0; runde < grenze(l.ziel) + 5; runde++) {
    zugliste.push(c.fen());
    const f = await sf.suche(c.fen(), go);
    if (!f.best || f.best === '(none)') return { ende: 'keinZug', zuege, zugliste };
    uciZug(c, f.best);
    zuege++;
    let e = pruefeZiel(l, start, c, { wann: 'flo', zuege });
    if (e) return { ende: e, zuege, zugliste };
    const g = await sf.suche(c.fen(), goGegner);
    if (!g.best || g.best === '(none)') return { ende: 'keinZug', zuege, zugliste };
    uciZug(c, g.best);
    e = pruefeZiel(l, start, c, { wann: 'gegner', zuege });
    if (e) return { ende: e, zuege, zugliste };
  }
  return { ende: 'zuViele', zuege, zugliste };
}

export async function mattIn(sf, fen, go) {
  await sf.neu();
  const r = await sf.suche(fen, go);
  return r.mate > 0 ? r.mate : null;
}

export function gut(e, art) {
  if (!e) return false;
  if (art === 'halten') return e.mate != null ? e.mate > 0 : e.cp >= -150;
  return e.mate != null ? e.mate > 0 : e.cp >= 400;
}

export { artVon, Chess };
