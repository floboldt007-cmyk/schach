// Grenze gegen grobe Fehler (Auftrag P-13:55): Bots von 1600 bis 2100 spielen keinen Zug mehr, den ihre eigene Analyse um mehr
// als staerke.grenze (Centipawn) schlechter sieht als den besten; Charakter-Boni und Rauschen wirken nur innerhalb der Grenze.
// Ohne Stockfish: eine Engine-Attrappe liefert eine feste Bewertung, der Zufall kommt aus festen Seeds.
//
//   node tests/bot-grenze.test.mjs
import { Chess } from '../vendor/chess/chess.js';
import { BOTS, botZug, botNachId } from '../js/bots.js';
import { zufallAus } from '../js/tag.js';

let ok = 0;
let fehler = 0;
function pruefe(name, bedingung, info) {
  if (bedingung) { ok++; console.log('ok   ' + name); } else { fehler++; console.log('FEHLER ' + name + (info !== undefined ? '  -> ' + JSON.stringify(info) : '')); }
}

// Weiss am Zug: Dame d1 kann mit Schach nach d7 oder d8 laufen und steht dort ungedeckt neben dem schwarzen Koenig.
const FEN = '4k3/8/8/8/8/8/8/K2Q4 w - - 0 1';
// Attrappe: der ruhige Zug d1d4 ist der beste (+50), das Schach d1d8 liegt um `abstand` darunter; alle anderen Zuege fehlen in
// der Analyse (Schaetzung im Bot: schlechtester bewerteter minus 50)
function attrappe(abstand) {
  return {
    analyse: async (fen) => ({
      fen, bestmove: 'd1d4', depth: 5,
      lines: [{ multipv: 1, depth: 5, eval: { cp: 50 }, pv: ['d1d4'] }, { multipv: 2, depth: 5, eval: { cp: 50 - abstand }, pv: ['d1d8'] }],
    }),
  };
}
async function schachQuote(bot, abstand, seeds = 400) {
  let schach = 0;
  for (let i = 0; i < seeds; i++) {
    const z = await botZug(attrappe(abstand), FEN, bot, { ohnePause: true, zufall: zufallAus(`grenze-${bot.id}-${abstand}-${i}`) });
    if (z && z.uci === 'd1d8' && z.art !== 'patzer') schach++;
  }
  return schach;
}

const delia = botNachId('delia');
const lasse = botNachId('lasse');
pruefe('Stellung: d1d8 ist Schach und laesst die Dame haengen', new Chess(FEN).moves({ verbose: true }).some((z) => z.lan === 'd1d8' && z.san.endsWith('+')));

// Delia (Grenze 300, Schach-Bonus 250): ein Schach 3,2 Bauern unter dem besten Zug spielt sie nicht mehr ...
const d320 = await schachQuote(delia, 320);
pruefe('Delia: Schach 320 cp unter dem besten Zug wird nie gewaehlt (Grenze 300, Bonus traegt keinen groben Fehler)', d320 === 0, d320);
// ... eines knapp innerhalb der Grenze darf ihr Charakter weiter tragen
const d250 = await schachQuote(delia, 250);
pruefe('Delia: Schach 250 cp unter dem besten Zug bleibt moeglich (Charakter innerhalb der Grenze)', d250 > 0, d250);
// Lasse (Grenze 200)
const l260 = await schachQuote(lasse, 260);
pruefe('Lasse: Schach 260 cp unter dem besten Zug wird nie gewaehlt (Grenze 200)', l260 === 0, l260);

// Genau die sechs Bots von 1600 bis 2100 haben eine Grenze
const mitGrenze = BOTS.filter((b) => b.staerke && b.staerke.grenze != null).map((b) => `${b.id}:${b.staerke.grenze}`);
pruefe('Grenze genau bei Delia, Ottilie, Koenig (300) und Lasse, Wiebke, Greta (200)',
  JSON.stringify(mitGrenze) === JSON.stringify(['delia:300', 'ottilie:300', 'koenig:300', 'lasse:200', 'wiebke:200', 'greta:200']), mitGrenze);

// Auftrag fc-18:05: die tiefere Suche endet auf langsamen Geraeten in der Regel innerhalb der kuerzesten Denkpause
// (movetime ist weich: gemessene Ueberschreitung hoechstens 5 ms am PC, Handy geschaetzt etwa 30 ms, Vault Messung Leiter neu geeicht)
// (maxZeit = zeit[0]), und botZug gibt genau diesen Deckel als movetime an die Engine
const deckel = BOTS.filter((b) => b.staerke && b.staerke.grenze != null).map((b) => `${b.id}:${b.staerke.maxZeit}/${b.staerke.zeit[0]}`);
pruefe('maxZeit gleich der kuerzesten Denkpause bei allen Bots mit Grenze (Suche endet in der Regel innerhalb der Pause)',
  BOTS.filter((b) => b.staerke && b.staerke.grenze != null).every((b) => b.staerke.maxZeit === b.staerke.zeit[0]), deckel);
const gesehen = [];
for (const bot of [delia, botNachId('koenig')]) {
  await botZug({ analyse: async (fen, o) => { gesehen.push(`${bot.id}:${o.movetime}`); return attrappe(100).analyse(fen); } }, FEN, bot, { ohnePause: true, zufall: () => 0.5 });
}
pruefe('botZug sucht mit movetime = maxZeit', JSON.stringify(gesehen) === JSON.stringify([`delia:${delia.staerke.zeit[0]}`, `koenig:${botNachId('koenig').staerke.zeit[0]}`]), gesehen);

// Bots unter 1600 und ab 2200 unveraendert (Abdruck vor dem Umbau, Stand 5c6444f9)
const abdruck = (s) => { let h = 2166136261; for (const c of JSON.stringify(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h.toString(16); };
const unveraendert = BOTS.filter((b) => b.elo < 1600 || b.elo >= 2200).map((b) => b.staerke);
pruefe('Staerke der Bots unter 1600 und ab 2200 unveraendert', abdruck(unveraendert) === '11167248', abdruck(unveraendert));

// Der Spontanzug bleibt: mit Zufall unter der Patzer-Schwelle spielt Delia ohne Engine (art 'patzer')
const spontan = await botZug({ analyse: async () => { throw new Error('keine Suche erwartet'); } }, FEN, delia, { ohnePause: true, zufall: () => 0.001 });
pruefe('Spontanzug bleibt (Zufall unter staerke.patzer: Zug ohne Engine)', spontan && spontan.art === 'patzer', spontan);

console.log(`\n${ok}/${ok + fehler} bestanden`);
process.exit(fehler ? 1 : 0);
