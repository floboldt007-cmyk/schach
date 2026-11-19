// Analyse zeigt Matt, obwohl kein Matt moeglich war (Flos Meldung 19.11.2026, Partie seines Opas, liegt nicht vor).
// Node, ohne Browser: echter Stockfish (vendor/stockfish) als Kindprozess hinter einem Worker-Ersatz, dazu js/engine.js
// und js/review.js wie in der App.
//
// Gefundene Ursache: Fertige Bewertungen werden ueber den Stellungsschluessel wiederverwendet (app.vorab, Live-Bewertung,
// Spielanalyse). Der Schluessel liess den Zaehler der 50-Zuege-Regel weg. Kommt dieselbe Stellung spaeter mit hohem
// Zaehler wieder (Hin- und Herziehen im Endspiel), zeigte die App das alte "Matt in 2", obwohl die Partie vorher mit
// 50 Zuegen remis endet (js/ui/partie.js beendet sie dann selbst). Die uebrigen Faelle halten fest, was schon stimmt.
//
//   node tests/r20-analyse-matt.test.mjs
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Chess } from '../vendor/chess/chess.js';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SF = path.join(WURZEL, 'vendor/stockfish/stockfish-19-lite-single.js');

const ergebnisse = [];
function pruefe(name, ok, detail = '') {
  ergebnisse.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'ok  ' : 'FEHL'} ${name}${!ok && detail ? '  -> ' + detail : ''}`);
}

// Web-Worker-Ersatz: Stockfish als Kindprozess, jede Ausgabezeile eine Nachricht
globalThis.Worker = class {
  constructor() {
    this.p = spawn(process.execPath, [SF], { stdio: ['pipe', 'pipe', 'ignore'] });
    let rest = '';
    this.p.stdout.on('data', (d) => {
      rest += d.toString();
      const z = rest.split(/\r?\n/);
      rest = z.pop();
      for (const l of z) if (l && this.onmessage) this.onmessage({ data: l });
    });
  }
  postMessage(s) { this.p.stdin.write(s + '\n'); }
  terminate() { this.p.kill(); }
};

const { Engine } = await import('../js/engine.js');
const R = await import('../js/review.js');
const { stellungsSchluessel } = await import('../js/openings.js');

const MATT2 = '6k1/8/5K2/8/8/8/8/1Q6 w - - 0 80';      // Weiss setzt in 2 Zuegen matt (Qg6, dann Qg7#)
const MATT2_SPAET = '6k1/8/5K2/8/8/8/8/1Q6 w - - 98 80'; // gleiche Stellung, 50-Zuege-Regel greift vor dem Matt
const mattIn = (a) => a?.lines?.[0]?.eval?.mate ?? null;

// ---------- 1. Die Ursache: Wiederverwendung ohne 50-Zuege-Zaehler (Fake-Engine, rechnet wie Stockfish) ----------
{
  // Stockfish (gemessen 19.11.2026, depth 16): Zaehler 0 und 97 -> mate 2, Zaehler 98 und 99 -> cp 0
  const fake = {
    aufrufe: [],
    async analyse(fen) {
      this.aufrufe.push(fen);
      const hm = Number(fen.split(' ')[4]);
      const ev = stellungsSchluessel(fen) === stellungsSchluessel(MATT2) && hm < 98 ? { cp: null, mate: 2 } : { cp: 0, mate: null };
      return { fen, depth: 20, bestmove: 'b1g6', lines: [{ multipv: 1, depth: 20, eval: ev, pv: ['b1g6'] }, { multipv: 2, depth: 20, eval: ev, pv: ['b1b2'] }] };
    },
  };
  const frueher = await fake.analyse(MATT2);   // die Live-Bewertung, als die Stellung das erste Mal auf dem Brett stand
  const vorab = new Map([[stellungsSchluessel(MATT2), frueher]]);
  const r = await R.analysierePartie(fake, ['b1b2'], { startFen: MATT2_SPAET, vorab, vorabMinTiefe: 14 });
  pruefe('Spielanalyse: alte Matt-Bewertung bei 50-Zuege-Zaehler 98 nicht wiederverwendet', r.zuege[0].evalVorher.mate == null,
    JSON.stringify(r.zuege[0].evalVorher));
  const text = R.coachText(r.zuege[0]) || '';
  pruefe('Spielanalyse: Coach nennt dort kein Matt', !/matt/i.test(text), text);

  const zug = await R.bewerteZug(fake, MATT2_SPAET, 'b1b2', { analyseVorher: frueher, tiefe: 14 });
  pruefe('Live-Bewertung (bewerteZug): alte Analyse mit anderem Zaehler wird neu gerechnet', zug.evalVorher.mate == null,
    JSON.stringify(zug.evalVorher));

  // gleiche Stellung mit gleichem Zaehler darf weiter aus dem Vorrat kommen (sonst rechnet die Analyse alles doppelt)
  fake.aufrufe = [];
  const vorab2 = new Map([[R.analyseSchluessel ? R.analyseSchluessel(MATT2) : stellungsSchluessel(MATT2), frueher]]);
  await R.analysierePartie(fake, ['b1b2'], { startFen: MATT2, vorab: vorab2, vorabMinTiefe: 14 });
  pruefe('Spielanalyse: gleiche Stellung mit gleichem Zaehler kommt weiter aus dem Vorrat', !fake.aufrufe.includes(MATT2), fake.aufrufe.join(' | '));

  // Die Live-Bewertung der Partie (js/ui/partie.js) legt app.vorab unter demselben Schluessel ab wie die Analyse
  const partie = readFileSync(path.join(WURZEL, 'js/ui/partie.js'), 'utf8');
  pruefe('partie.js: app.vorab nur ueber analyseSchluessel (mit 50-Zuege-Zaehler)',
    /analyseSchluessel/.test(partie) && !/app\.vorab\.(get|set)\(stellungsSchluessel/.test(partie) && !/const key = stellungsSchluessel/.test(partie));
}

// ---------- 2. Echter Stockfish ueber js/engine.js ----------
const e = new Engine();
await e.init();
try {
  // Perspektive: Bewertungen kommen immer aus Sicht von Weiss
  const w = await e.analyse(MATT2, { depth: 12 });
  pruefe('Perspektive: Weiss am Zug setzt matt -> mate +2', mattIn(w) === 2, JSON.stringify(w.lines[0]?.eval));
  const s = await e.analyse('1q6/8/8/8/8/5k2/8/6K1 b - - 0 80', { depth: 12 });
  pruefe('Perspektive: Schwarz am Zug setzt matt -> mate -2 (Sicht Weiss)', mattIn(s) === -2, JSON.stringify(s.lines[0]?.eval));

  // 50-Zuege-Regel: Stockfish selbst rechnet sie richtig, wenn der Zaehler mitkommt
  const sp = await e.analyse(MATT2_SPAET, { depth: 16 });
  pruefe('50-Zuege-Regel: Zaehler 98 -> kein Matt, Bewertung 0', mattIn(sp) == null && sp.lines[0].eval.cp === 0, JSON.stringify(sp.lines[0]?.eval));

  // Ungenuegendes Material: nie Matt, in keiner Tiefe
  for (const [name, fen] of [['K+L gegen K', '8/8/4k3/8/8/3BK3/8/8 w - - 0 1'], ['K+S gegen K', '8/8/4k3/8/8/3NK3/8/8 b - - 0 1']]) {
    const tiefen = [];
    for (const depth of [1, 4, 8, 14]) tiefen.push(mattIn(await e.analyse(fen, { depth, multipv: 2 })));
    pruefe(`Ungenuegendes Material ${name}: kein Matt (Tiefe 1, 4, 8, 14)`, tiefen.every((m) => m == null), JSON.stringify(tiefen));
  }

  // Patt und Matt auf dem Brett beantwortet engine.js ohne Suche
  const patt = await e.analyse('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
  pruefe('Patt: ende patt, Bewertung 0, kein Matt', patt.ende === 'patt' && mattIn(patt) == null && patt.lines[0].eval.cp === 0);
  const matt = await e.analyse('6k1/6Q1/5K2/8/8/8/8/8 b - - 1 81');
  pruefe('Matt auf dem Brett: ende matt, Gewinner Weiss', matt.ende === 'matt' && matt.gewinner === 'w' && mattIn(matt) === 1);

  // Flache Suche (wie die Live-Bewertung mit Zeitgrenze): jede Matt-Angabe haelt der tiefen Suche stand
  const flachFens = [
    'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4',
    '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1',
    'r4rk1/ppp2ppp/8/3q4/8/2N5/PPP2PPP/R2QR1K1 b - - 0 1',
    '8/8/8/8/8/5k2/4q3/6K1 b - - 0 1',
  ];
  for (const fen of flachFens) {
    const f = await e.analyse(fen, { movetime: 40, multipv: 2 });
    const t = await e.analyse(fen, { depth: 20 });
    const ok = mattIn(f) == null || (mattIn(t) != null && Math.sign(mattIn(t)) === Math.sign(mattIn(f)));
    pruefe(`Flache Suche haelt: ${fen.split(' ')[0]}`, ok, `flach ${JSON.stringify(f.lines[0]?.eval)} tief ${JSON.stringify(t.lines[0]?.eval)}`);
  }

  // Ende durch Aufgabe (keine Endstellung): die Analyse zeigt Matt nur mit einer Hauptvariante, die wirklich mattsetzt
  const zuege = ['e2e4', 'e7e5', 'd1h5', 'b8c6', 'f1c4', 'g8f6'];   // Schwarz uebersieht Qxf7#, dann gibt jemand auf
  const r = await R.analysierePartie(e, zuege, { tiefe: 12 });
  const fen = new Chess();
  for (const z of zuege) fen.move({ from: z.slice(0, 2), to: z.slice(2, 4) });
  const letzte = r.bewertungen[r.bewertungen.length - 1];
  pruefe('Ende durch Aufgabe: letzte Stellung zeigt das echte Matt in 1 fuer Weiss', letzte.mate === 1, JSON.stringify(letzte));
  const pruefeVariante = (startFen, ev, pv) => {
    const c = new Chess(startFen);
    for (const u of pv) if (!c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] })) return false;
    return c.isCheckmate() && pv.length === 2 * Math.abs(ev.mate) - (Math.sign(ev.mate) === (startFen.split(' ')[1] === 'w' ? 1 : -1) ? 1 : 0);
  };
  const a = await e.analyse(fen.fen(), { depth: 12 });
  pruefe('Matt-Angabe stimmt mit der Hauptvariante ueberein (Zuege, nicht Halbzuege)', pruefeVariante(fen.fen(), a.lines[0].eval, a.lines[0].pv),
    JSON.stringify(a.lines[0]));
} finally {
  e.terminate();
}

const fehl = ergebnisse.filter((x) => !x.ok).length;
console.log(`\n${ergebnisse.length - fehl}/${ergebnisse.length} bestanden`);
process.exit(fehl ? 1 : 0);
