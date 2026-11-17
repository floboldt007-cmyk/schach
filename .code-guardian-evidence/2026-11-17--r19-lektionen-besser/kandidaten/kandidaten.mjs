// Kandidaten fuer Runden pruefen: node kandidaten.mjs <wurzel> <datei.json>  json: [[id, fen], ...]
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
const [W, datei] = process.argv.slice(2);
const E = await import(pathToFileURL(W + '/tests/lektion-engine.mjs').href);
const M = await import(pathToFileURL(W + '/js/pakete/lernen/mattbilder.js').href);
const sf = E.stockfish(); await sf.init();
for (const [id, fen] of JSON.parse(readFileSync(datei, 'utf8'))) {
  const l = M.lektion(id);
  const r = { ...l, fen, ziel: 40 };
  const f = M.pruefeLektion(r, E.Chess);
  if (f.length) { console.log(`${id} ${fen}: UNGUELTIG ${f.join('; ')}`); continue; }
  const s = await E.spiele(sf, r, fen, { go: 'nodes 150000', goGegner: 'nodes 400000' });
  const m = E.artVon(l) === 'matt' ? await E.mattIn(sf, fen, 'nodes 3000000') : null;
  const n = new E.Chess(fen).moves().length;
  const alle = await sf.alle(fen, 'nodes 200000', n);
  const gut = alle.filter((x) => E.gut(x, E.artVon(l))).length;
  console.log(`${id} ${fen}: ende=${s.ende} zuege=${s.zuege} matt=${m ?? '-'} gute=${gut}/${n} (r1 ziel ${l.ziel})`);
}
sf.ende();
