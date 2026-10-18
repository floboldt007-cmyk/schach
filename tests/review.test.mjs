// Tests fuer js/review.js und js/openings.js.
//
//   node tests/review.test.mjs              Node-Tests (Fake-Engine) + Realitaets-Test im Browser
//   node tests/review.test.mjs --nur-node   nur die Node-Tests (ohne Browser/Stockfish)
//   Optionen: --tiefe=14 (Engine-Tiefe im Browser-Test), PORT=8822
//
// Playwright: Pfad per Umgebungsvariable PLAYWRIGHT_PFAD, sonst 'playwright' oder /opt/node-tools.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Chess } from '../vendor/chess/chess.js';
import {
  gewinnChance, klassifiziere, zugGenauigkeit, partieGenauigkeit, schaetzeSpielstaerke, coachText,
  sanDeutsch, materialBilanz, analysierePartie, bewerteZug, volatilitaetsGewichte, KLASSEN, START_FEN, warKnapp,
  GRENZEN, spielphasen, coachKern, seitenGenauigkeit,
} from '../js/review.js';
import { EROEFFNUNGEN, eroeffnung, tabellenFehler, stellungsSchluessel } from '../js/openings.js';

const require = createRequire(import.meta.url);
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8822);

// ---------------------------------------------------------------------------
// Mini-Testrahmen
// ---------------------------------------------------------------------------
const ergebnisse = [];
function pruefe(name, ok, detail = '') {
  ergebnisse.push({ name, ok: !!ok, detail });
  console.log((ok ? 'OK     ' : 'FEHLER ') + name + (detail && !ok ? '  (' + detail + ')' : ''));
}
const nahe = (a, b, tol = 1e-6) => typeof a === 'number' && Math.abs(a - b) <= tol;

// Gewinnchance (Sicht Weiss) -> Centipawn, Umkehrung der Lichess-Formel (logistisch)
const K = 0.00368208;
const cpAus = (p) => -Math.log(1 / p - 1) / K;
const ev = (cp) => ({ cp, mate: null });
const matt = (n) => ({ cp: null, mate: n });
// Bewertung so, dass die Seite farbe die Gewinnchance p hat
const evFuer = (p, farbe = 'w') => ev(cpAus(farbe === 'w' ? p : 1 - p));

// ---------------------------------------------------------------------------
// Fake-Engine: feste Bewertungen je Stellung, sonst cp 20 mit erstem legalem Zug
// ---------------------------------------------------------------------------
class FakeEngine {
  constructor(tabelle = {}) {
    this.tabelle = new Map(Object.entries(tabelle).map(([f, v]) => [stellungsSchluessel(f), v]));
    this.aufrufe = [];
    this.leer = false;
  }
  async analyse(fen, opts = {}) {
    this.aufrufe.push({ fen, ...opts });
    const c = new Chess(fen);
    const zuege = c.moves({ verbose: true });
    if (!zuege.length) {
      const schach = c.inCheck();
      const gewinner = schach ? (c.turn() === 'w' ? 'b' : 'w') : null;
      const e = schach ? matt(gewinner === 'w' ? 1 : -1) : ev(0);
      return { fen, turn: c.turn(), depth: 0, bestmove: null, lines: [{ multipv: 1, depth: 0, eval: e, pv: [] }] };
    }
    if (this.leer) return { fen, turn: c.turn(), depth: 0, bestmove: null, lines: [], abgebrochen: true };
    const t = this.tabelle.get(stellungsSchluessel(fen));
    const n = Math.min(opts.multipv || 1, zuege.length);
    const lines = t
      ? t.slice(0, n).map((l, i) => ({ multipv: i + 1, depth: opts.depth, eval: l.eval, pv: l.pv }))
      : [{ eval: ev(20), pv: [zuege[0].lan] }, { eval: ev(10), pv: [zuege[1]?.lan] }]
        .slice(0, n).map((l, i) => ({ multipv: i + 1, depth: opts.depth, ...l }));
    return { fen, turn: c.turn(), depth: opts.depth, bestmove: lines[0].pv[0], lines };
  }
}

function fenNach(sans, start = START_FEN) {
  const c = new Chess(start);
  for (const s of sans) c.move(s);
  return c.fen();
}
function uciListe(sans, start = START_FEN) {
  const c = new Chess(start);
  return sans.map((s) => c.move(s).lan);
}

// ===========================================================================
// Node-Tests
// ===========================================================================
function nodeTests() {
  // ---------- Gewinnchance ----------
  pruefe('gewinnChance cp 0 = 0.5', nahe(gewinnChance(ev(0), 'w'), 0.5));
  pruefe('gewinnChance cp 100 (Lichess-Formel)', nahe(gewinnChance(ev(100), 'w'), 0.5910258971916129, 1e-9));
  pruefe('gewinnChance Schwarz = 1 - Weiss', nahe(gewinnChance(ev(100), 'b'), 1 - 0.5910258971916129, 1e-9));
  pruefe('gewinnChance cp -300 Weiss', nahe(gewinnChance(ev(-300), 'w'), 0.5 + 0.5 * (2 / (1 + Math.exp(K * 300)) - 1), 1e-12));
  pruefe('gewinnChance Matt fuer Weiss', gewinnChance(matt(3), 'w') === 1 && gewinnChance(matt(3), 'b') === 0);
  pruefe('gewinnChance Matt fuer Schwarz', gewinnChance(matt(-2), 'w') === 0 && gewinnChance(matt(-2), 'b') === 1);
  pruefe('gewinnChance ohne Bewertung = 0.5', gewinnChance(null, 'w') === 0.5);

  // ---------- Zuggenauigkeit (bekannte Werte) ----------
  pruefe('zugGenauigkeit ohne Verlust = 100', zugGenauigkeit(0.5, 0.5) === 100);
  pruefe('zugGenauigkeit Verbesserung = 100', zugGenauigkeit(0.5, 0.6) === 100);
  pruefe('zugGenauigkeit 10 Prozentpunkte = 63.58', nahe(zugGenauigkeit(0.6, 0.5), 63.5826, 1e-3), zugGenauigkeit(0.6, 0.5));
  pruefe('zugGenauigkeit 20 Prozentpunkte = 40.02', nahe(zugGenauigkeit(0.7, 0.5), 40.0204, 1e-3));
  pruefe('zugGenauigkeit 5 Prozentpunkte = 79.82', nahe(zugGenauigkeit(0.55, 0.5), 79.8170, 1e-3));
  pruefe('zugGenauigkeit 50 Prozentpunkte = 8.53', nahe(zugGenauigkeit(0.75, 0.25), 103.1668 * Math.exp(-0.04354 * 50) - 3.1669, 1e-9));
  pruefe('zugGenauigkeit 100 Prozentpunkte = 0', zugGenauigkeit(1, 0) === 0);
  pruefe('zugGenauigkeit auch in Prozent', nahe(zugGenauigkeit(60, 50), 63.5826, 1e-3));

  // ---------- Partiegenauigkeit ----------
  pruefe('partieGenauigkeit [100,50] = 70.83', nahe(partieGenauigkeit([100, 50]), (75 + 200 / 3) / 2, 1e-9));
  pruefe('partieGenauigkeit gewichtet', nahe(partieGenauigkeit([{ genauigkeit: 100, gewicht: 3 }, { genauigkeit: 50, gewicht: 1 }]), (87.5 + 200 / 3) / 2, 1e-9));
  pruefe('partieGenauigkeit [100,100] = 100', nahe(partieGenauigkeit([100, 100]), 100));
  pruefe('partieGenauigkeit mit 0 (harmonisch, min 1)', nahe(partieGenauigkeit([0, 100]), (50 + 2 / (1 + 0.01)) / 2, 1e-9));
  pruefe('partieGenauigkeit leer = null', partieGenauigkeit([]) === null);
  const gew = volatilitaetsGewichte([0.5, 0.5, 0.5, 0.5, 0.5]);
  pruefe('Volatilitaet: Laenge = Zuege, ruhig = 0.5', gew.length === 4 && gew.every((g) => g === 0.5), JSON.stringify(gew));
  const kurve = [0.5, 0.52, 0.4, 0.9, 0.1, 0.5, 0.55, 0.5, 0.6, 0.5, 0.5, 0.45, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
  const gew2 = volatilitaetsGewichte(kurve);
  pruefe('Volatilitaet: 22 Zuege -> 22 Gewichte in [0.5,12]', gew2.length === 22 && gew2.every((g) => g >= 0.5 && g <= 12) && Math.max(...gew2) === 12);

  // ---------- Spielstaerke ----------
  const s80 = schaetzeSpielstaerke(80);
  pruefe('Spielstaerke 80 % ~ 1350', s80 === 1350, s80);
  pruefe('Spielstaerke monoton', schaetzeSpielstaerke(50) < schaetzeSpielstaerke(70) && schaetzeSpielstaerke(70) < schaetzeSpielstaerke(90));
  pruefe('Spielstaerke staerkerer Gegner hebt leicht', schaetzeSpielstaerke(70, 2000) > schaetzeSpielstaerke(70) && schaetzeSpielstaerke(70, 2000) <= schaetzeSpielstaerke(70) + 150);
  pruefe('Spielstaerke kurze Partie zur Mitte', schaetzeSpielstaerke(100, undefined, 2) < 1500);
  pruefe('Spielstaerke ohne Genauigkeit = null', schaetzeSpielstaerke(null) === null);

  // ---------- Deutsche SAN ----------
  const san = [['Nf3', 'Sf3'], ['Qxd8+', 'Dxd8+'], ['exd8=Q#', 'exd8=D#'], ['O-O', '0-0'], ['O-O-O+', '0-0-0+'],
    ['Bb5', 'Lb5'], ['Rxe1', 'Txe1'], ['Kxf7', 'Kxf7'], ['e4', 'e4'], ['bxc6', 'bxc6'], ['Nbd7', 'Sbd7'], ['b8=N', 'b8=S']];
  for (const [a, b] of san) pruefe(`sanDeutsch ${a} -> ${b}`, sanDeutsch(a) === b, sanDeutsch(a));
  pruefe('sanDeutsch null -> leer', sanDeutsch(null) === '');

  // ---------- Materialbilanz ----------
  pruefe('materialBilanz Start = 0', materialBilanz(START_FEN) === 0);
  pruefe('materialBilanz ohne schwarzen Springer = +3', materialBilanz('r1bqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1') === 3);
  pruefe('materialBilanz ohne weisse Dame = -9', materialBilanz('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNB1KBNR w KQkq - 0 1') === -9);
  pruefe('materialBilanz K+T gegen K+L+B = +1', materialBilanz('4k3/8/8/3b4/8/8/p7/4K2R w - - 0 1') === 1);

  // ---------- Klassen-Grenzen ----------
  const MITTE = 'r1bq1rk1/pp2bppp/2n1pn2/2pp4/3P4/2PBPN2/PP1N1PPP/R1BQ1RK1 w - - 0 8';
  const basis = (verlust, extra = {}) => ({
    fenVorher: MITTE, uci: 'h2h3', besterZug: 'd4c5', pvVorher: ['d4c5'], pvNachher: [],
    evalVorher: evFuer(0.6), evalNachher: evFuer(0.6 - verlust), ...extra,
  });
  const grenzen = [[0.0001, 'exzellent'], [0.02, 'exzellent'], [0.0201, 'gut'], [0.05, 'gut'], [0.0501, 'ungenau'],
    [0.10, 'ungenau'], [0.1001, 'fehler'], [0.20, 'fehler'], [0.2001, 'patzer'], [0.5, 'patzer']];
  for (const [v, k] of grenzen) {
    const r = klassifiziere(basis(v));
    pruefe(`Grenze Verlust ${v} -> ${k}`, r.klasse === k && nahe(r.verlust, v, 1e-9), `${r.klasse} ${r.verlust}`);
  }
  // Schwarz am Zug: Verlust aus Sicht von Schwarz
  const MITTE_S = 'r1bq1rk1/pp2bppp/2n1pn2/2pp4/3P4/2PBPN2/PP1N1PPP/R1BQ1RK1 b - - 0 8';
  const rs = klassifiziere({ fenVorher: MITTE_S, uci: 'h7h6', besterZug: 'c5d4', evalVorher: evFuer(0.55, 'b'), evalNachher: evFuer(0.40, 'b') });
  pruefe('Schwarz: Verlust 0.15 -> fehler', rs.klasse === 'fehler' && nahe(rs.verlust, 0.15, 1e-9), `${rs.klasse} ${rs.verlust}`);
  const rbs = klassifiziere({ fenVorher: MITTE_S, uci: 'h7h6', besterZug: 'c5d4', evalVorher: ev(-100), evalNachher: ev(200) });
  pruefe('Schwarz: -1.0 -> +2.0 ist patzer', rbs.klasse === 'patzer', rbs.klasse);

  // bester Zug
  const rb = klassifiziere(basis(0.3, { uci: 'd4c5' }));
  pruefe('bester: Engine-Zug, Verlust 0 trotz Suchrauschen', rb.klasse === 'bester' && rb.verlust === 0, `${rb.klasse} ${rb.verlust}`);
  const rb0 = klassifiziere(basis(0));
  pruefe('bester: anderer Zug ohne Verlust', rb0.klasse === 'bester', rb0.klasse);
  const rbBesser = klassifiziere(basis(-0.05));
  pruefe('bester: Nachher besser als vorher -> Verlust 0', rbBesser.klasse === 'bester' && rbBesser.verlust === 0);

  // Buch
  const rbuch = klassifiziere(basis(0.03, { buch: true, eroeffnung: 'Testeröffnung' }));
  pruefe('buch: Theorie', rbuch.klasse === 'buch', rbuch.klasse);
  const rbuchP = klassifiziere(basis(0.3, { buch: true }));
  pruefe('buch: Patzer laut Engine bleibt patzer', rbuchP.klasse === 'patzer', rbuchP.klasse);

  // erzwungen
  const EINZIG = '4k3/8/8/8/8/8/4q3/4K3 w - - 0 1';
  const rerz = klassifiziere({ fenVorher: EINZIG, uci: 'e1e2', evalVorher: ev(0), evalNachher: ev(-50), besterZug: 'e1e2' });
  pruefe('erzwungen: einziger legaler Zug', rerz.klasse === 'erzwungen' && rerz.verlust === 0, rerz.klasse);
  pruefe('erzwungen: Coach-Text', /einzige legale Zug/.test(coachText({ fenVorher: EINZIG, uci: 'e1e2', evalVorher: ev(0), evalNachher: ev(0) }, rerz)));

  // verpasst
  const verp = (wv, wn, gk) => klassifiziere(basis(0, { evalVorher: evFuer(wv), evalNachher: evFuer(wn), gegnerKlasse: gk }));
  pruefe('verpasst: nach Gegnerpatzer 0.72 -> 0.54', verp(0.72, 0.54, 'patzer').klasse === 'verpasst');
  pruefe('verpasst: nach Gegnerfehler 0.70 -> 0.52', verp(0.70, 0.52, 'fehler').klasse === 'verpasst');
  pruefe('verpasst: nicht, wenn danach >= 0.55', verp(0.72, 0.56, 'patzer').klasse === 'fehler');
  pruefe('verpasst: nicht, wenn vorher < 0.70', verp(0.69, 0.53, 'patzer').klasse === 'fehler');
  pruefe('verpasst: nicht ohne Gegnerfehler', verp(0.72, 0.54, 'gut').klasse === 'fehler');
  pruefe('verpasst: auch grosser Verlust, wenn die Stellung offen bleibt (0.80 -> 0.50)', verp(0.80, 0.50, 'patzer').klasse === 'verpasst');
  pruefe('verpasst: danach verloren (< 0.30) bleibt patzer', verp(0.80, 0.25, 'patzer').klasse === 'patzer');
  pruefe('verpasst: laesst Matt zu bleibt patzer', klassifiziere(basis(0, { evalVorher: evFuer(0.8), evalNachher: matt(-3), gegnerKlasse: 'patzer' })).klasse === 'patzer');
  pruefe('verpasst: auch mit gegnerFehler=true', klassifiziere(basis(0, { evalVorher: evFuer(0.72), evalNachher: evFuer(0.54), gegnerFehler: true })).klasse === 'verpasst');

  // entschiedene Stellungen: hoechstens ungenau
  const rent = klassifiziere(basis(0, { evalVorher: matt(5), evalNachher: ev(950) }));
  pruefe('entschieden: Matt in 5 -> +9.5 hoechstens ungenau', ['exzellent', 'gut', 'ungenau'].includes(rent.klasse), rent.klasse);
  pruefe('entschieden: Coach nennt das ausgelassene Matt', /Hier war aber Matt in 5 mit dxc5 möglich/.test(coachText(basis(0, { evalVorher: matt(5), evalNachher: ev(950) }))));
  // ausgelassenes Matt in hoechstens 3: "Chance verpasst" (wie "Miss" bei chess.com)
  const rm3 = klassifiziere(basis(0, { evalVorher: matt(3), evalNachher: ev(950) }));
  pruefe('Matt in 3 ausgelassen (+9,5) -> verpasst', rm3.klasse === 'verpasst' && /Matt in 3 verpasst/.test(rm3.notiz), rm3.klasse);
  pruefe('Matt in 2 ausgelassen (+50,0, Gewinnchance gesaettigt) -> verpasst', klassifiziere(basis(0, { evalVorher: matt(2), evalNachher: ev(5000) })).klasse === 'verpasst');
  const MISS = 'r1b1k2B/ppqpp2Q/2p5/8/8/1P3P2/P1P2PPP/RN2KB1R w KQkq - 1 12';
  const miss = { fenVorher: MISS, uci: 'h8d4', besterZug: 'h7g8', pvVorher: ['h7g8'], evalVorher: matt(1), evalNachher: ev(1604), pvNachher: [] };
  const rmiss = klassifiziere(miss);
  const tmiss = coachText(miss, rmiss);
  pruefe('Matt in 1 ausgelassen (Lh8-d4 statt Dg8#) -> verpasst', rmiss.klasse === 'verpasst', rmiss.klasse);
  pruefe('Coach: "Hier war Matt in 1 mit Dg8# möglich"', /^Verschenkt! Hier war Matt in 1 mit Dg8# möglich/.test(tmiss), tmiss);
  pruefe('Matt in 2 statt Matt in 1 bleibt gut (Matt-Saettigung)', klassifiziere({ ...miss, evalNachher: matt(2) }).klasse !== 'verpasst');
  const rmatt = klassifiziere(basis(0, { evalVorher: matt(2), evalNachher: matt(5) }));
  pruefe('Matt-Saettigung: Matt in 2 -> Matt in 5 = exzellent', rmatt.klasse === 'exzellent', rmatt.klasse);
  const rmatt2 = klassifiziere(basis(0, { evalVorher: matt(2), evalNachher: matt(1) }));
  pruefe('Matt-Saettigung: Matt in 2 -> Matt in 1 = bester', rmatt2.klasse === 'bester', rmatt2.klasse);
  // w0c: Der beste Zug verkuerzt Matt in n auf n - 1. Bleibt es bei Matt in n, dauert das Matt einen Zug laenger:
  // nicht mehr "bester" (vorher ja; Tiefe-20-Nachpruefung an 62 echten Stellungen: 50 wirklich langsamer)
  const rmatt3 = klassifiziere(basis(0, { evalVorher: matt(3), evalNachher: matt(3) }));
  pruefe('Matt-Saettigung: Matt in 3 -> Matt in 3 (anderer Zug) = exzellent, nicht bester', rmatt3.klasse === 'exzellent', rmatt3.klasse);
  pruefe('Matt-Saettigung: Matt in 3 -> Matt in 2 (anderer Zug) = bester', klassifiziere(basis(0, { evalVorher: matt(3), evalNachher: matt(2) })).klasse === 'bester');
  pruefe('Matt-Saettigung: Engine-Zug bleibt bester, auch wenn Matt in 3 bleibt', klassifiziere(basis(0, { uci: 'd4c5', evalVorher: matt(3), evalNachher: matt(3) })).klasse === 'bester');
  const ZWEI_MATT = 'k7/8/1K6/8/8/8/8/6RR w - - 0 1';   // Tg8# und Th8#
  const rmatt4 = klassifiziere({ fenVorher: ZWEI_MATT, uci: 'h1h8', besterZug: 'g1g8', pvVorher: ['g1g8'], pvNachher: [], evalVorher: matt(1), evalNachher: matt(1) });
  pruefe('Matt-Saettigung: ein anderer Zug, der selbst mattsetzt, ist bester', rmatt4.klasse === 'bester', rmatt4.klasse);
  pruefe('Matt-Saettigung: wer matt wird und Matt in 3 haelt, spielt bester', klassifiziere(basis(0, { evalVorher: matt(-3), evalNachher: matt(-3) })).klasse === 'bester');
  pruefe('Matt-Saettigung: wer matt wird und es auf Matt in 2 verkuerzt, nicht bester', klassifiziere(basis(0, { evalVorher: matt(-3), evalNachher: matt(-2) })).klasse !== 'bester');

  // stark
  const STARK = START_FEN;
  const stark = (zweiter, extra = {}) => klassifiziere({ fenVorher: STARK, uci: 'g1f3', besterZug: 'g1f3', evalVorher: ev(30), evalNachher: ev(30), evalZweiter: zweiter, ...extra });
  const zweiterBei = (abstand) => ev(cpAus(gewinnChance(ev(30), 'w') - abstand));
  pruefe('stark: Abstand 0.10 -> stark', stark(zweiterBei(0.10)).klasse === 'stark', stark(zweiterBei(0.10)).klasse);
  pruefe('stark: Abstand 0.0999 -> bester', stark(zweiterBei(0.0999)).klasse === 'bester');
  pruefe('stark: ohne zweite Linie -> bester', stark(null).klasse === 'bester');
  pruefe('stark: entschiedene Stellung -> bester', klassifiziere({ fenVorher: STARK, uci: 'g1f3', besterZug: 'g1f3', evalVorher: ev(1200), evalNachher: ev(1200), evalZweiter: ev(400) }).klasse === 'bester');
  pruefe('stark: nur fuer den Engine-Zug', klassifiziere({ fenVorher: STARK, uci: 'b1c3', besterZug: 'g1f3', evalVorher: ev(30), evalNachher: ev(30), evalZweiter: ev(-300) }).klasse === 'bester');
  // Zurueckschlagen ist selbstverstaendlich
  const NACH_EXD5 = fenNach(['e4', 'd5', 'exd5']);
  const rueck = klassifiziere({ fenVorher: NACH_EXD5, uci: 'd8d5', besterZug: 'd8d5', evalVorher: ev(30), evalNachher: ev(30), evalZweiter: ev(150), vorigerZug: 'e4d5', vorigerSchlag: true });
  pruefe('stark: Zurueckschlagen -> bester', rueck.klasse === 'bester', rueck.klasse);
  pruefe('Coach: "Richtig zurückgeschlagen"', /zurückgeschlagen/.test(coachText({ fenVorher: NACH_EXD5, uci: 'd8d5', besterZug: 'd8d5', evalVorher: ev(30), evalNachher: ev(30), vorigerZug: 'e4d5', vorigerSchlag: true }, rueck)));
  // Flucht einer angegriffenen Figur ist selbstverstaendlich
  const NACH_E5 = fenNach(['e4', 'Nf6', 'e5']);
  const flucht = klassifiziere({ fenVorher: NACH_E5, uci: 'f6d5', besterZug: 'f6d5', evalVorher: ev(-30), evalNachher: ev(-30), evalZweiter: ev(250) });
  pruefe('stark: Flucht vor Bauernangriff -> bester', flucht.klasse === 'bester', flucht.klasse);
  // Schachabwehr mit nur zwei erlaubten Zuegen (5.g3 nach 4...Dh4+) ist selbstverstaendlich
  const SCHACH_G3 = 'r1b1kbnr/pppp1pp1/2n1p2p/8/4PP1q/8/PPPP2PP/RNBQKBNR w KQkq - 1 5';
  const abwehr = klassifiziere({ fenVorher: SCHACH_G3, uci: 'g2g3', besterZug: 'g2g3', evalVorher: ev(0), evalNachher: ev(0), evalZweiter: ev(-236) });
  pruefe('stark: Schachabwehr mit 2 Zuegen -> bester', abwehr.klasse === 'bester', abwehr.klasse);

  // bester nur fuer den Engine-Zug oder gleiche Bewertung
  const GLEICH = '8/5r2/p3k3/3p4/1P1P4/4K3/4R3/8 w - - 1 49';
  const gleich = { fenVorher: GLEICH, uci: 'e2d2', besterZug: 'e2h2', evalVorher: ev(0), evalNachher: ev(0) };
  const rgl = klassifiziere(gleich);
  pruefe('bester: anderer Zug mit gleicher Bewertung', rgl.klasse === 'bester', rgl.klasse);
  pruefe('bester: kein "Genau das hätte auch die Engine gespielt" fuer einen anderen Zug', !/hätte auch die Engine/.test(coachText(gleich, rgl)), coachText(gleich, rgl));
  const kh1 = klassifiziere(basis(0, { evalVorher: ev(8400), evalNachher: ev(6100) }));
  pruefe('exzellent: +84 -> +61 (Gewinnchance gesaettigt) ist nicht "bester"', kh1.klasse === 'exzellent', kh1.klasse);
  pruefe('bester: Engine-Zug darf "hätte auch die Engine gespielt" sagen', [0, 1, 2, 3, 4, 5].some((i) =>
    /hätte auch die Engine/.test(coachText(basis(0, { uci: 'd4c5', fenVorher: MITTE.replace(' 0 8', ` 0 ${8 + i}`) })))));

  // Umwandlung nie als "acht Bauern"
  const UMW = '8/1P6/8/8/8/2k5/8/K7 w - - 0 1';
  const tumw = coachText({ fenVorher: UMW, uci: 'b7b8q', besterZug: 'b7b8q', pvVorher: ['b7b8q', 'c3d3'], evalVorher: ev(900), evalNachher: ev(900), pvNachher: ['c3d3', 'b8b3'] });
  pruefe('Coach Umwandlung: "neue Dame (b8=D)", keine Bauernzahl', /neue Dame \(b8=D\)/.test(tumw) && !/Bauern/.test(tumw), tumw);
  const UMW_G = '8/8/8/8/8/2K5/1p6/7k w - - 0 1';
  const tumwG = coachText({ fenVorher: UMW_G, uci: 'c3d3', besterZug: 'c3b2', pvVorher: ['c3b2'], evalVorher: ev(0), evalNachher: ev(-900), pvNachher: ['b2b1q', 'd3e3'] });
  pruefe('Coach Umwandlung des Gegners: "wandelt dein Gegner in eine Dame um"', /wandelt dein Gegner in eine Dame um \(b1=D\+?\)/.test(tumwG) && !/(sieben|acht|neun) Bauern/.test(tumwG), tumwG);
  const tumwB = coachText({ fenVorher: UMW_G, uci: 'c3d3', besterZug: 'c3b2', pvVorher: ['c3b2'], evalVorher: ev(0), evalNachher: ev(-900), pvNachher: ['b2b1q', 'd3e3'], du: false });
  pruefe('Coach Umwandlung (Bot-Sicht): "wandelt Schwarz in eine Dame um"', /wandelt Schwarz in eine Dame um/.test(tumwB), tumwB);

  // kein Genial, wenn nach dem Annehmen des Opfers totes Remis bleibt
  const TOT = '5B2/8/7K/3k4/2b5/8/8/8 w - - 6 76';
  const tot = klassifiziere({ fenVorher: TOT, uci: 'f8c5', besterZug: 'f8c5', evalVorher: ev(7), evalNachher: ev(0), evalZweiter: ev(0), pvNachher: ['d5c5'] });
  pruefe('kein brillant: Laeufer einstellen ins tote Remis', tot.klasse !== 'brillant', tot.klasse);

  // Spielstaerke der Bot-Seite (eigene Elo bekannt): Bot-Tabelle, halber Weg zur eigenen Elo
  const bot = (g, elo, n = 40) => schaetzeSpielstaerke(g, undefined, n, { eigeneElo: elo });
  pruefe('Spielstaerke Bot: Benno 65,7 % ~ 250', Math.abs(bot(65.7, 250) - 250) <= 50, bot(65.7, 250));
  pruefe('Spielstaerke Bot: Hilde 75,9 % ~ 500', Math.abs(bot(75.9, 500) - 500) <= 50, bot(75.9, 500));
  pruefe('Spielstaerke Bot: Kalle 78,5 % ~ 800', Math.abs(bot(78.5, 800) - 800) <= 100, bot(78.5, 800));
  pruefe('Spielstaerke Bot: Greta 92,9 % ~ 2100', Math.abs(bot(92.9, 2100) - 2100) <= 100, bot(92.9, 2100));
  pruefe('Spielstaerke Bot: kurze Partie zur eigenen Elo (nicht 1000)', bot(45, 500, 10) <= 500, bot(45, 500, 10));
  pruefe('Spielstaerke Mensch unveraendert (80 % ~ 1350)', schaetzeSpielstaerke(80) === 1350);

  // "Knapp!" nur, wenn die Partie im letzten Drittel noch offen war
  pruefe('warKnapp: frueh gekippt -> nein', warKnapp([0.5, 0.5, 0.3, 0.2, 0.1, 0], 'w') === false);
  pruefe('warKnapp: bis spaet offen -> ja', warKnapp([0.5, 0.5, 0.55, 0.5, 0.45, 0], 'w') === true);
  pruefe('warKnapp: Sicht Schwarz', warKnapp([0.5, 0.5, 0.55, 0.5, 0.45, 1], 'b') === true && warKnapp([0.5, 0.6, 0.8, 0.9, 0.95, 1], 'b') === false);
  pruefe('warKnapp: Matt im 1. Zug (nur Schlussstellung) -> nein', warKnapp([0.3, 0], 'w') === false);

  // brillant
  const ERSTICKT = '5r1k/pp4pp/7N/3Q4/8/8/5PPP/6K1 w - - 0 1';
  const opferMatt = { fenVorher: ERSTICKT, uci: 'd5g8', besterZug: 'd5g8', pvVorher: ['d5g8', 'f8g8', 'h6f7'],
    evalVorher: matt(2), evalNachher: matt(1), evalZweiter: ev(300), pvNachher: ['f8g8', 'h6f7'] };
  const rbr = klassifiziere(opferMatt);
  pruefe('brillant: Damenopfer mit Matt (Alternative nur +3)', rbr.klasse === 'brillant', rbr.klasse);
  const tbr = coachText(opferMatt, rbr);
  pruefe('brillant: Coach nennt Dame, Feld und Matt', /Dame auf g8/.test(tbr) && /matt/.test(tbr) && /Txg8 Sf7#/.test(tbr), tbr);
  pruefe('brillant: ohne Alternative (vorher Matt) -> bester', klassifiziere({ ...opferMatt, evalZweiter: null }).klasse === 'bester');
  pruefe('brillant: Alternative auch Matt -> bester', klassifiziere({ ...opferMatt, evalZweiter: matt(4) }).klasse === 'bester');
  const GRIECHE = 'r1bq1rk1/pppnbppp/4p3/3pP3/3P4/3B1N2/PPP2PPP/RNBQR1K1 w - - 0 8';
  const griechisch = { fenVorher: GRIECHE, uci: 'd3h7', besterZug: 'd3h7', evalVorher: ev(150), evalNachher: ev(160), evalZweiter: ev(60), pvNachher: ['g8h7', 'f3g5', 'h7g8', 'd1h5'] };
  pruefe('brillant: Laeuferopfer auf h7 (Hauptvariante)', klassifiziere(griechisch).klasse === 'brillant');
  pruefe('brillant: nicht, wenn danach schlecht (< 0.5)', klassifiziere({ ...griechisch, evalNachher: ev(-80) }).klasse !== 'brillant');
  pruefe('brillant: nicht, wenn vorher klar gewonnen', klassifiziere({ ...griechisch, evalVorher: ev(900), evalNachher: ev(900), evalZweiter: ev(850) }).klasse !== 'brillant');
  pruefe('brillant: auch fast bester Zug (Verlust <= 0.02)', klassifiziere({ ...griechisch, besterZug: 'f3g5', evalNachher: ev(140) }).klasse === 'brillant');
  pruefe('brillant: nicht bei Verlust > 0.02', klassifiziere({ ...griechisch, besterZug: 'f3g5', evalVorher: ev(150), evalNachher: ev(100) }).klasse !== 'brillant');
  // haengende Figur, Gegner nimmt nicht
  const HAENGT = '6k1/8/4p3/8/8/2N5/8/6K1 w - - 0 1';
  const haengt = { fenVorher: HAENGT, uci: 'c3d5', besterZug: 'c3d5', evalVorher: ev(0), evalNachher: ev(0), evalZweiter: ev(-10), pvNachher: ['g8f7'] };
  const rh = klassifiziere(haengt);
  pruefe('brillant: Springer bewusst im Schlag', rh.klasse === 'brillant', rh.klasse);
  pruefe('brillant: Coach "steht bewusst im Schlag"', /Springer auf d5 steht bewusst im Schlag/.test(coachText(haengt, rh)), coachText(haengt, rh));
  // Abtausch ist kein Opfer
  const VIERSPR = fenNach(['e4', 'e5', 'Nf3', 'Nf6', 'Nc3', 'Nc6']);
  const tausch = { fenVorher: VIERSPR, uci: 'c3d5', besterZug: 'c3d5', evalVorher: ev(20), evalNachher: ev(20), evalZweiter: ev(15), pvNachher: ['f6d5', 'e4d5', 'e5e4'] };
  pruefe('kein brillant: Springertausch auf d5', klassifiziere(tausch).klasse === 'bester', klassifiziere(tausch).klasse);
  const NACH_D5 = 'r1bqkb1r/pppp1ppp/2n2n2/3Np3/4P3/5N2/PPPP1PPP/R1BQKB1R b KQkq - 5 4';
  const schlag = { fenVorher: NACH_D5, uci: 'f6d5', besterZug: 'f6d5', evalVorher: ev(20), evalNachher: ev(20), evalZweiter: ev(40), pvNachher: ['e4d5', 'e5e4'] };
  pruefe('kein brillant: Springer schlaegt, wird zurueckgeschlagen', klassifiziere(schlag).klasse !== 'brillant', klassifiziere(schlag).klasse);
  // Zwischenzug: Gegner schlaegt, Ziehender holt die Figur nach Schach zurueck
  const ZWISCHEN = 'r3k2r/ppp2ppp/2n5/3q4/8/2N5/PPP2PPP/R2QK2R w KQkq - 0 1';
  const zw = { fenVorher: ZWISCHEN, uci: 'd1d5', besterZug: 'd1d5', evalVorher: ev(0), evalNachher: ev(0), evalZweiter: ev(-50), pvNachher: ['e8c8'] };
  pruefe('kein brillant: Damentausch', klassifiziere(zw).klasse !== 'brillant', klassifiziere(zw).klasse);
  // Fehlalarme aus echten Bot-Partien (Engine-Linien Tiefe 14)
  const schonHaengend = { fenVorher: 'r1b2rk1/ppq2ppp/2pbB3/4n3/8/2N1BQ2/PPP2PPP/1K1R2NR w - - 1 13', uci: 'f3g3', besterZug: 'f3g3',
    evalVorher: ev(44), evalNachher: ev(57), evalZweiter: ev(30), pvNachher: ['c8e6', 'c3e4', 'a8d8', 'g1f3', 'f7f6', 'b2b3'] };
  pruefe('kein brillant: Figur stand schon vorher im Schlag (Dg3, Lxe6)', klassifiziere(schonHaengend).klasse !== 'brillant', klassifiziere(schonHaengend).klasse);
  const spaeterTausch = { fenVorher: '2rq1bnr/p2n1kp1/4p2p/2p3N1/2pP4/5N2/PP3PPP/R1B1KB1R b KQ - 2 12', uci: 'h6g5', besterZug: 'h6g5',
    evalVorher: ev(-647), evalNachher: ev(-661), evalZweiter: ev(-454), pvNachher: ['d4d5', 'e6d5', 'f3g5', 'f7e8', 'f1e2', 'c8c6'] };
  pruefe('kein brillant: Bauer schlaegt Springer (hxg5)', klassifiziere(spaeterTausch).klasse !== 'brillant', klassifiziere(spaeterTausch).klasse);
  const andereFigur = { fenVorher: '3r1r2/5ppk/p1P5/1p6/5B2/2P2n1P/4KP2/7R b - - 1 31', uci: 'd8c8', besterZug: 'f3h4',
    evalVorher: ev(-597), evalNachher: ev(-601), evalZweiter: ev(-570), pvNachher: ['c6c7', 'f3g5', 'f4g5', 'c8c7', 'e2d3', 'f8c8'] };
  pruefe('kein brillant: andere Figur haengt (Tc8, Sf3)', klassifiziere(andereFigur).klasse !== 'brillant', klassifiziere(andereFigur).klasse);
  const verzweiflung = { fenVorher: 'rnbqkb1r/pppp1pp1/5n1p/4p1N1/4P3/8/PPPP1PPP/RNBQKB1R w KQkq - 0 4', uci: 'g5f7', besterZug: 'g5f7',
    evalVorher: ev(10), evalNachher: ev(10), evalZweiter: ev(-80), pvNachher: ['e8f7', 'f1c4', 'd7d5'] };
  pruefe('kein brillant: Verzweiflungszug (Sxf7 mit bedrohtem Springer)', klassifiziere(verzweiflung).klasse !== 'brillant', klassifiziere(verzweiflung).klasse);
  const NICHT_BEDROHT = 'rnbqkb1r/pppp1ppp/5n2/4p1N1/4P3/8/PPPP1PPP/RNBQKB1R w KQkq - 0 4';
  pruefe('brillant: gleicher Springer ohne Bedrohung (Sxf7 Kxf7)', klassifiziere({ ...verzweiflung, fenVorher: NICHT_BEDROHT }).klasse === 'brillant');

  // ---------- Coach-Texte ----------
  const NARR = fenNach(['f3', 'e5']);
  const narr = { fenVorher: NARR, uci: 'g2g4', besterZug: 'e2e4', pvVorher: ['e2e4', 'd7d5'], evalVorher: ev(-30), evalNachher: matt(-1), pvNachher: ['d8h4'] };
  const rn = klassifiziere(narr);
  const tn = coachText(narr, rn);
  pruefe('Coach: Narrenmatt ist patzer', rn.klasse === 'patzer', rn.klasse);
  pruefe('Coach: "Das erlaubt Matt in 1: Dh4#"', /Matt in 1: Dh4#/.test(tn), tn);
  pruefe('Coach: besserer Zug deutsch ("Besser war e4")', /Besser war e4/.test(tn), tn);
  const MATT2 = { ...narr, evalNachher: matt(-2), pvNachher: ['d8h4', 'a2a3'] };
  pruefe('Coach: "Matt in 2, zum Beispiel mit"', /Matt in 2, zum Beispiel mit Dh4/.test(coachText(MATT2)), coachText(MATT2));

  const DAME = fenNach(['e4', 'e5', 'Nf3']);
  const dame = { fenVorher: DAME, uci: 'd8g5', besterZug: 'b8c6', pvVorher: ['b8c6', 'f1b5'], evalVorher: ev(40), evalNachher: ev(900), pvNachher: ['f3g5', 'g8f6', 'd2d3'] };
  const rd = klassifiziere(dame);
  const td = coachText(dame, rd);
  pruefe('Coach: haengende Dame ist patzer', rd.klasse === 'patzer');
  pruefe('Coach: "verlierst du die Dame auf g5" + "Sxg5" + "Sc6"', /Nach Sxg5 verlierst du die Dame auf g5/.test(td) && /Besser war Sc6/.test(td), td);
  pruefe('Coach: neutral fuer den Gegner', /Nach Sxg5 geht die Dame auf g5 verloren/.test(coachText({ ...dame, du: false })), coachText({ ...dame, du: false }));
  pruefe('Coach: Verlust nicht behaupten, wenn die beste Linie ihn auch hat', !/verlierst/.test(coachText({ ...dame, besterZug: 'd8h4', pvVorher: ['d8h4', 'f3h4'] })));

  const mattVerpasst = { fenVorher: ERSTICKT, uci: 'd5b7', besterZug: 'd5g8', pvVorher: ['d5g8', 'f8g8', 'h6f7'], evalVorher: matt(2), evalNachher: ev(500), pvNachher: ['g7h6'] };
  const rmv = klassifiziere(mattVerpasst);
  const tmv = coachText(mattVerpasst, rmv);
  pruefe('Coach: verpasstes Matt ("Matt in 2 mit Dg8+")', /Matt in 2 mit Dg8\+/.test(tmv), `${rmv.klasse}: ${tmv}`);

  const FIGUR = '6k1/5ppp/8/8/4n3/3B4/5PPP/6K1 w - - 0 1';
  const figur = { fenVorher: FIGUR, uci: 'g1f1', besterZug: 'd3e4', pvVorher: ['d3e4', 'g8f8'], evalVorher: ev(350), evalNachher: ev(60), pvNachher: ['e4d2', 'f1e2'] };
  const rf = klassifiziere(figur);
  const tf = coachText(figur, rf);
  pruefe('Coach: "Besser war Lxe4, das gewinnt den Springer auf e4"', /Besser war Lxe4, das gewinnt den Springer auf e4/.test(tf), tf);
  pruefe('Coach: Bewertung mit Komma ("+3,5 auf +0,6")', /von \+3,5 auf \+0,6/.test(tf), tf);

  const gut = coachText(basis(0.03));
  pruefe('Coach gut: "Noch etwas genauer war dxc5"', /genauer war dxc5/.test(gut), gut);
  pruefe('Coach exzellent: "Fast so stark wie dxc5"', /Fast so stark wie dxc5/.test(coachText(basis(0.01))));
  pruefe('Coach buch: nennt Eroeffnung', /Theorie: Testeröffnung/.test(coachText(basis(0.01, { buch: true, eroeffnung: 'Testeröffnung' }))));
  const MATTZUG = fenNach(['f3', 'e5', 'g4']);
  pruefe('Coach Matt: "Schachmatt! Dh4#"', /Schachmatt! Dh4#/.test(coachText({ fenVorher: MATTZUG, uci: 'd8h4', besterZug: 'd8h4', evalVorher: matt(-1), evalNachher: matt(-1) })));
  pruefe('Coach stark: "Großartig"', /^Goldrichtig! Sf3 ist der einzige Zug/.test(coachText({ fenVorher: STARK, uci: 'g1f3', besterZug: 'g1f3', evalVorher: ev(30), evalNachher: ev(30), evalZweiter: ev(-200) })));
  const verpT = coachText(basis(0, { fenVorher: FIGUR, uci: 'g1f1', besterZug: 'd3e4', pvVorher: ['d3e4', 'g8f8'], evalVorher: evFuer(0.72), evalNachher: evFuer(0.54), gegnerKlasse: 'patzer', pvNachher: ['e4d2'] }));
  pruefe('Coach verpasst: "Verschenkt! ... Lxe4 ... gewinnt den Springer"', /^Verschenkt!/.test(verpT) && /Lxe4/.test(verpT) && /Springer/.test(verpT), verpT);
  // Alle Klassen haben einen nicht-leeren Text
  for (const [name, e] of [['patzer', narr], ['brillant', opferMatt], ['erzwungen', { fenVorher: EINZIG, uci: 'e1e2', evalVorher: ev(0), evalNachher: ev(0) }], ['ungenau', basis(0.07)], ['fehler', basis(0.15)]]) {
    const t = coachText(e);
    pruefe(`Coach ${name}: 1-3 Saetze, nicht leer`, t.length > 10 && t.length < 260 && (t.match(/[.!?](\s|$)/g) || []).length <= 3, t);
  }

  // ---------- Eroeffnungen ----------
  pruefe(`Eroeffnungen: mindestens 80 (${EROEFFNUNGEN.length})`, EROEFFNUNGEN.length >= 80);
  pruefe('Eroeffnungen: alle Zeilen legal', tabellenFehler().length === 0, tabellenFehler().join(', '));
  pruefe('Eroeffnungen: keine doppelten Zugfolgen', new Set(EROEFFNUNGEN.map((e) => e.zuege)).size === EROEFFNUNGEN.length);
  pruefe('Eroeffnungen: Namen mit echten Umlauten', EROEFFNUNGEN.some((e) => /ö|ä|ü/.test(e.name)) && !EROEFFNUNGEN.some((e) => /oe|ae|ue/.test(e.name.replace(/Bogoljubow|Kmoch|Blumenfeld|Steinitz|Benoni|Queen|Grünfeld/g, '')) && /Koenig|Eroeffnung|Laeufer/.test(e.name)));
  const pflicht = ['Italienische Partie', 'Spanische Partie', 'Sizilianische Verteidigung: Najdorf-Variante', 'Damengambit',
    'Königsindische Verteidigung', 'Caro-Kann-Verteidigung', 'Französische Verteidigung', 'Englische Eröffnung', 'Londoner System', 'Skandinavische Verteidigung'];
  for (const n of pflicht) pruefe(`Eroeffnung vorhanden: ${n}`, EROEFFNUNGEN.some((e) => e.name === n));
  const sp = eroeffnung(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5']);
  pruefe('eroeffnung: Spanische Partie, alles Buch', sp.name === 'Spanische Partie' && sp.buch.every(Boolean));
  const nj = eroeffnung('e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be2'.split(' '));
  pruefe('eroeffnung: Najdorf, 11. Halbzug kein Buch', nj.name === 'Sizilianische Verteidigung: Najdorf-Variante' && nj.buch.slice(0, 10).every(Boolean) && !nj.buch[10], JSON.stringify(nj));
  pruefe('eroeffnung: Zugumstellung Caro-Kann (Sd2)', eroeffnung('e4 c6 d4 d5 Nd2 dxe4 Nxe4 Bf5'.split(' ')).name === 'Caro-Kann-Verteidigung: Klassische Variante');
  pruefe('eroeffnung: Zugumstellung Damengambit ueber Sf6', eroeffnung('d4 Nf6 c4 e6 Nc3 d5'.split(' ')).buch.every(Boolean));
  pruefe('eroeffnung: Koenigsindisch ueber Reti', eroeffnung('Nf3 Nf6 c4 g6 Nc3 Bg7 e4 d6 d4'.split(' ')).name === 'Königsindische Verteidigung');
  const nm = eroeffnung(['f3', 'e5', 'g4', 'Qh4#']);
  pruefe('eroeffnung: Narrenmatt-Patzer g4 ist kein Buch', nm.buch[0] && !nm.buch[2] && !nm.buch[3], JSON.stringify(nm.buch));
  pruefe('eroeffnung: leer -> name null', eroeffnung([]).name === null && eroeffnung([]).buch.length === 0);
  pruefe('eroeffnung: SAN-Text mit Schach-Zeichen', eroeffnung('e4 c5 Nf3 d6 Bb5+'.split(' ')).name === 'Sizilianische Verteidigung: Moskauer Variante');
  pruefe('eroeffnung: London ueber d4 Sf6 Lf4', eroeffnung(['d4', 'Nf6', 'Bf4']).name === 'Londoner System');
}

// ---------- analysierePartie / bewerteZug mit Fake-Engine ----------
async function asyncTests() {
  const sans = ['e4', 'e5', 'Qh5', 'Nc6', 'Bc4', 'Nf6', 'Qxf7#'];
  const zuege = uciListe(sans);
  const vorNf6 = fenNach(sans.slice(0, 5));
  const nachNf6 = fenNach(sans.slice(0, 6));
  const fake = new FakeEngine({
    [vorNf6]: [{ eval: ev(30), pv: ['g7g6', 'h5f3'] }, { eval: ev(45), pv: ['d8e7', 'g1f3'] }],
    [nachNf6]: [{ eval: matt(1), pv: ['h5f7'] }, { eval: ev(300), pv: ['h5f3'] }],
  });
  const fortschritt = [];
  const r = await analysierePartie(fake, zuege, { beiFortschritt: (a, b) => fortschritt.push([a, b]), elo: { w: 800 }, spielerFarbe: 'b' });
  pruefe('Partie: 7 Zuege bewertet', r.zuege.length === 7);
  pruefe('Partie: Engine 8x mit Tiefe 16, MultiPV 2', fake.aufrufe.length === 8 && fake.aufrufe.every((a) => a.depth === 16 && a.multipv === 2));
  pruefe('Partie: Fortschritt 0..8 von 8', fortschritt.length === 9 && fortschritt[8][0] === 8 && fortschritt.every(([, g]) => g === 8));
  pruefe('Partie: Eroeffnung Parham-Angriff', r.eroeffnung === 'Parham-Angriff', r.eroeffnung);
  pruefe('Partie: e4/e5/Dh5 sind Buch', r.zuege.slice(0, 3).every((z) => z.klasse === 'buch'), r.zuege.map((z) => z.klasse).join(','));
  pruefe('Partie: 3...Sf6 ist patzer', r.zuege[5].klasse === 'patzer' && r.zuege[5].farbe === 'b');
  pruefe('Partie: Coach zu Sf6 nennt Matt und g6', /Matt in 1: Dxf7#/.test(r.zuege[5].coach) && /Besser war g6/.test(r.zuege[5].coach), r.zuege[5].coach);
  pruefe('Partie: Dxf7# ist bester, Coach "Schachmatt"', r.zuege[6].klasse === 'bester' && /Schachmatt/.test(r.zuege[6].coach));
  pruefe('Partie: Felder je Zug vollstaendig', r.zuege.every((z) => ['ply', 'farbe', 'san', 'uci', 'fenVorher', 'fenNachher', 'evalVorher', 'evalNachher', 'besterZug', 'besterZugSan', 'klasse', 'verlust', 'genauigkeit', 'coach'].every((k) => k in z)));
  pruefe('Partie: ply/farbe/uci', r.zuege[2].ply === 2 && r.zuege[2].farbe === 'w' && r.zuege[2].uci === 'd1h5' && r.zuege[2].san === 'Qh5' && r.zuege[2].sanDe === 'Dh5');
  pruefe('Partie: besterZugSan englisch, De deutsch', r.zuege[5].besterZugSan === 'g6' && r.zuege[4].besterZugSanDe != null);
  pruefe('Partie: Genauigkeit 0..100', r.genauigkeit.w >= 0 && r.genauigkeit.w <= 100 && r.genauigkeit.b >= 0 && r.genauigkeit.b < r.genauigkeit.w, JSON.stringify(r.genauigkeit));
  pruefe('Partie: Zaehler je Klasse', r.anzahl.b.patzer === 1 && r.anzahl.w.buch === 2 && KLASSEN.every((k) => k in r.anzahl.w && k in r.anzahl.b), JSON.stringify(r.anzahl.b));
  pruefe('Partie: Schluesselmoment Sf6 (ply 5)', r.schluesselmomente.includes(5), JSON.stringify(r.schluesselmomente));
  pruefe('Partie: Spielstaerke beider Seiten', typeof r.spielstaerke.w === 'number' && typeof r.spielstaerke.b === 'number' && r.spielstaerke.b < r.spielstaerke.w);
  pruefe('Partie: Kurve (n+1 Werte, Ende 1.0)', r.kurve.length === 8 && r.kurve[7] === 1);
  pruefe('Partie: Du-Form nur fuer spielerFarbe', /verlierst|deine/.test(r.zuege[5].coach) || !/deinen Gegner/.test(r.zuege[6].coach));

  // Zug als SAN, Startstellung aus FEN
  const ERSTICKT = '5r1k/pp4pp/7N/3Q4/8/8/5PPP/6K1 w - - 0 1';
  const fake2 = new FakeEngine({
    [ERSTICKT]: [{ eval: matt(2), pv: ['d5g8', 'f8g8', 'h6f7'] }, { eval: ev(300), pv: ['h6f5'] }],
    [fenNach(['Qg8+'], ERSTICKT)]: [{ eval: matt(1), pv: ['f8g8', 'h6f7'] }],
    [fenNach(['Qg8+', 'Rxg8'], ERSTICKT)]: [{ eval: matt(1), pv: ['h6f7'] }, { eval: ev(0), pv: ['h6g8'] }],
  });
  const r2 = await analysierePartie(fake2, ['Qg8+', 'Rxg8', 'Nf7#'], { startFen: ERSTICKT, tiefe: 10 });
  pruefe('Partie aus FEN: Dg8+ brillant, Txg8 erzwungen, Sf7# bester',
    r2.zuege.map((z) => z.klasse).join(',') === 'brillant,erzwungen,bester', r2.zuege.map((z) => z.klasse).join(','));
  pruefe('Partie aus FEN: keine Buchzuege, Eroeffnung null', r2.eroeffnung === null && r2.zuege.every((z) => !z.buch));
  pruefe('Partie aus FEN: Tiefe 10 genutzt', fake2.aufrufe.every((a) => a.depth === 10));

  // Fehlerfaelle
  let fehler = null;
  try { await analysierePartie(new FakeEngine(), ['e2e4', 'e2e4']); } catch (e) { fehler = e; }
  pruefe('Partie: ungueltiger Zug wirft Fehler', fehler && /Ungültiger Zug/.test(fehler.message));
  const leer = new FakeEngine();
  leer.leer = true;
  fehler = null;
  try { await analysierePartie(leer, ['e2e4']); } catch (e) { fehler = e; }
  pruefe('Partie: leere Analyse -> Fehler mit abgebrochen', fehler && fehler.abgebrochen === true);
  const gestoppt = new FakeEngine();
  const original = gestoppt.analyse.bind(gestoppt);
  gestoppt.analyse = async (fen, o) => ({ ...(await original(fen, o)), abgebrochen: true });
  fehler = null;
  try { await analysierePartie(gestoppt, ['e2e4']); } catch (e) { fehler = e; }
  pruefe('Partie: engine.stop (abgebrochen=true) -> Fehler', fehler && fehler.abgebrochen === true);
  // Abbruch waehrend der Analyse: signal ruft engine.stop
  const langsam = new FakeEngine();
  const orig2 = langsam.analyse.bind(langsam);
  let stopps = 0;
  langsam.stop = () => { stopps++; };
  const ac2 = new AbortController();
  langsam.analyse = async (fen, o) => { if (langsam.aufrufe.length === 2) ac2.abort(); return orig2(fen, o); };
  fehler = null;
  try { await analysierePartie(langsam, ['e2e4', 'e7e5', 'g1f3'], { signal: ac2.signal }); } catch (e) { fehler = e; }
  pruefe('Partie: signal.abort waehrend der Analyse ruft engine.stop und bricht ab', fehler && fehler.abgebrochen === true && stopps === 1 && langsam.aufrufe.length === 3, `${stopps} ${langsam.aufrufe.length}`);
  const ac = new AbortController();
  ac.abort();
  fehler = null;
  try { await analysierePartie(new FakeEngine(), ['e2e4'], { signal: ac.signal }); } catch (e) { fehler = e; }
  pruefe('Partie: AbortSignal bricht ab', fehler && fehler.abgebrochen === true);
  // vorab: Analysen aus der Live-Bewertung werden wiederverwendet, fehlende neu gerechnet
  const vorab = new Map();
  for (const a of fake.aufrufe.slice(0, 5)) vorab.set(stellungsSchluessel(a.fen), await fake.analyse(a.fen, { depth: 14, multipv: 2 }));
  const fakeV = new FakeEngine({
    [vorNf6]: [{ eval: ev(30), pv: ['g7g6', 'h5f3'] }, { eval: ev(45), pv: ['d8e7', 'g1f3'] }],
    [nachNf6]: [{ eval: matt(1), pv: ['h5f7'] }, { eval: ev(300), pv: ['h5f3'] }],
  });
  const rv = await analysierePartie(fakeV, zuege, { vorab, spielerFarbe: 'b' });
  pruefe('Partie mit vorab: nur 3 von 8 Stellungen neu gerechnet', fakeV.aufrufe.length === 3, fakeV.aufrufe.length);
  pruefe('Partie mit vorab: gleiches Ergebnis', JSON.stringify(rv.zuege.map((z) => z.klasse)) === JSON.stringify(r.zuege.map((z) => z.klasse)));
  const einzeilig = new Map([...vorab].map(([k, a]) => [k, { ...a, lines: a.lines.slice(0, 1) }]));
  const fakeE = new FakeEngine();
  await analysierePartie(fakeE, zuege, { vorab: einzeilig });
  pruefe('Partie mit vorab: MultiPV 1 reicht nicht, wird neu gerechnet', fakeE.aufrufe.length === 8, fakeE.aufrufe.length);
  const fakeT = new FakeEngine();
  await analysierePartie(fakeT, zuege, { vorab, vorabMinTiefe: 16 });
  pruefe('Partie mit vorab: zu flache Analyse wird neu gerechnet', fakeT.aufrufe.length === 8, fakeT.aufrufe.length);
  const r0 = await analysierePartie(new FakeEngine(), []);
  pruefe('Partie: leere Zugliste', r0.zuege.length === 0 && r0.genauigkeit.w === null && r0.eroeffnung === null);

  // Live-Bewertung eines einzelnen Zugs
  const DAME = fenNach(['e4', 'e5', 'Nf3']);
  const fake3 = new FakeEngine({
    [DAME]: [{ eval: ev(40), pv: ['b8c6', 'f1b5'] }, { eval: ev(50), pv: ['d7d6'] }],
    [fenNach(['Qg5'], DAME)]: [{ eval: ev(900), pv: ['f3g5', 'g8f6'] }],
  });
  const live = await bewerteZug(fake3, DAME, 'd8g5', { tiefe: 12, ply: 3 });
  pruefe('bewerteZug: Dg5 ist patzer mit Coach', live.klasse === 'patzer' && /Dame auf g5/.test(live.coach) && live.ply === 3, live.coach);
  pruefe('bewerteZug: liefert beide Analysen', live.analyseVorher && live.analyseNachher && fake3.aufrufe.length === 2);
  const live2 = await bewerteZug(fake3, DAME, 'Nc6', { analyseVorher: live.analyseVorher });
  pruefe('bewerteZug: nutzt vorhandene Analyse, SAN-Eingabe', fake3.aufrufe.length === 3 && live2.uci === 'b8c6' && live2.klasse === 'bester');
  const live3 = await bewerteZug(fake3, DAME, 'd8g5', { analyseVorher: live.analyseVorher, analyseNachher: live.analyseNachher });
  pruefe('bewerteZug: beide Analysen vorhanden -> keine Engine-Suche', fake3.aufrufe.length === 3 && live3.klasse === 'patzer', fake3.aufrufe.length);
  // vorabMerken: neu gerechnete Stellungen landen in vorab (Neustart nach Abbruch rechnet nichts doppelt)
  const merk = new Map();
  const fakeM = new FakeEngine();
  await analysierePartie(fakeM, uciListe(['e4', 'e5', 'Nf3']), { vorab: merk, vorabMerken: true });
  pruefe('Partie mit vorabMerken: 4 Stellungen in vorab', merk.size === 4 && fakeM.aufrufe.length === 4, merk.size);
  const fakeM2 = new FakeEngine();
  await analysierePartie(fakeM2, uciListe(['e4', 'e5', 'Nf3']), { vorab: merk });
  pruefe('Partie danach: nichts neu gerechnet', fakeM2.aufrufe.length === 0, fakeM2.aufrufe.length);
  // Bot-Seite mit bekannter Elo: Schaetzung nahe der eigenen Elo
  const rBot = await analysierePartie(new FakeEngine(), uciListe(['e4', 'e5']), { elo: { b: 500 }, spielerFarbe: 'w' });
  pruefe('Partie: kurze Partie, Bot-Seite nahe der eigenen Elo', Math.abs(rBot.spielstaerke.b - 500) <= 100, JSON.stringify(rBot.spielstaerke));
}

// ---------- Runde 4: gewinnZweiter, trivial, spielphasen, coachKern ----------
// Die alten Funktionen aus analyse.js (phasen) und partie.js (coachSatz) vor dem Umzug, als Massstab
function altePhasen(fens, buchEnde) {
  let mitte = null;
  let ende = null;
  fens.forEach((fen, i) => {
    const reihen = fen.split(' ')[0].split('/');
    const figuren = (reihen.join('').match(/[nbrqNBRQ]/g) || []).length;
    const weissHinten = (reihen[7].match(/[A-Z]/g) || []).length;
    const schwarzHinten = (reihen[0].match(/[a-z]/g) || []).length;
    if (ende == null && figuren <= 6) ende = i;
    if (mitte == null && i >= buchEnde && (figuren <= 10 || weissHinten < 4 || schwarzHinten < 4 || i >= 30)) mitte = i;
  });
  const n = fens.length - 1;
  const liste = [];
  const m = mitte == null ? n + 1 : mitte;
  const en = ende == null ? n + 1 : Math.max(ende, 1);
  const mEff = Math.min(m, en);
  if (mEff > 0) liste.push({ name: 'Eröffnung', von: 0, bis: Math.min(mEff, n) });
  if (en > mEff && mEff <= n) liste.push({ name: 'Mittelspiel', von: mEff, bis: Math.min(en, n) });
  if (en <= n) liste.push({ name: 'Endspiel', von: en, bis: n });
  return liste.filter((p) => p.bis > p.von || n === 0);
}
function alterCoachSatz(t) {
  const text = String(t || '').replace(/\s*[–—]\s*/g, ': ').replace(/O-O-O/g, '0-0-0').replace(/O-O/g, '0-0');
  const rest = text.replace(/^(Genial!|Goldrichtig!|Präzise!|Sauber!|Solide\.|Unscharf\.|Daneben\.|Weit daneben!|Verschenkt!|Theorie[.:]|Pflichtzug:)\s+/, '');
  if (!rest.trim()) return text;
  return /^[a-h][1-8x]/.test(rest) ? rest : rest.charAt(0).toUpperCase() + rest.slice(1);
}
function fensAus(sans, start = START_FEN) {
  const c = new Chess(start);
  const fens = [c.fen()];
  for (const x of sans) { c.move(x); fens.push(c.fen()); }
  return fens;
}

async function runde4Tests() {
  const runde = (x) => Math.round(x * 1e4) / 1e4;
  // gewinnZweiter: Gewinnchance der zweiten Linie aus Sicht des Ziehenden
  const sans = ['e4', 'd5', 'exd5', 'Qxd5', 'Nc3'];
  const r = await analysierePartie(new FakeEngine(), uciListe(sans), { spielerFarbe: 'w' });
  pruefe('gewinnZweiter: aus der zweiten Linie (Sicht des Ziehenden), 0..1', r.zuege.every((z) => z.gewinnZweiter === runde(gewinnChance(ev(10), z.farbe))),
    r.zuege.map((z) => z.gewinnZweiter).join(','));
  const r1 = await analysierePartie(new FakeEngine(), uciListe(['e4']), { multipv: 1 });
  pruefe('gewinnZweiter: null ohne zweite Linie', r1.zuege[0].gewinnZweiter === null, r1.zuege[0].gewinnZweiter);
  const zweiter = await bewerteZug(new FakeEngine(), START_FEN, 'e2e4', { tiefe: 8 });
  pruefe('gewinnZweiter: auch in der Live-Bewertung', zweiter.gewinnZweiter === runde(gewinnChance(ev(10), 'w')) && zweiter.trivial === false);

  // trivial: Zurueckschlagen und Schachabwehr mit hoechstens 3 Zuegen, sonst nicht
  pruefe('trivial: Eintrag hat das Feld (boolean)', r.zuege.every((z) => typeof z.trivial === 'boolean'));
  pruefe('trivial: 1.e4 und 1...d5 nicht', r.zuege[0].trivial === false && r.zuege[1].trivial === false);
  pruefe('trivial: 2.exd5 (schlaegt die gerade gezogene Figur) ja', r.zuege[2].trivial === true);
  pruefe('trivial: 2...Dxd5 (Zurueckschlagen) ja', r.zuege[3].trivial === true);
  pruefe('trivial: 3.Sc3 (greift die Dame an, kein Schlagen) nein', r.zuege[4].trivial === false);
  const rueck = await bewerteZug(new FakeEngine(), fenNach(['e4', 'd5', 'exd5']), 'd8d5', { vorigerZug: 'e4d5', vorigerSchlag: true });
  pruefe('trivial: Zurueckschlagen in der Live-Bewertung (vorigerZug als UCI)', rueck.trivial === true);
  const ohneVorher = await bewerteZug(new FakeEngine(), fenNach(['e4', 'd5', 'exd5']), 'd8d5');
  pruefe('trivial: ohne vorigen Zug kein Zurueckschlagen', ohneVorher.trivial === false);
  // Schach mit 2 erlaubten Zuegen (Kxd2, Kf1)
  const SCHACH_ZWEI = '4k3/8/8/8/8/8/3q4/4K3 w - - 0 1';
  const kf1 = await bewerteZug(new FakeEngine(), SCHACH_ZWEI, 'e1f1');
  pruefe('trivial: Schachabwehr mit 2 erlaubten Zuegen ja', new Chess(SCHACH_ZWEI).moves().length === 2 && kf1.trivial === true);
  // Schach mit 5 erlaubten Zuegen (Kd2, Ke2, Kf2, Sf1, Sxh1)
  const SCHACH_FUENF = '4k3/8/8/8/8/6N1/8/4K2r w - - 0 1';
  const kd2 = await bewerteZug(new FakeEngine(), SCHACH_FUENF, 'e1d2');
  pruefe('trivial: Schachabwehr mit 5 erlaubten Zuegen nein', new Chess(SCHACH_FUENF).moves().length === 5 && kd2.trivial === false, new Chess(SCHACH_FUENF).moves().join(' '));
  // Schach mit genau 3 Zuegen (Kd2, Ke2, Kf2)
  const SCHACH_DREI = '4k3/8/8/8/8/8/8/4K2r w - - 0 1';
  const ke2 = await bewerteZug(new FakeEngine(), SCHACH_DREI, 'e1e2');
  pruefe('trivial: Schachabwehr mit genau 3 erlaubten Zuegen ja', new Chess(SCHACH_DREI).moves().length === 3 && ke2.trivial === true);

  // spielphasen = altes phasen() aus analyse.js
  const OPER_SAN = 'e4 e5 Nf3 d6 d4 Bg4 dxe5 Bxf3 Qxf3 dxe5 Bc4 Nf6 Qb3 Qe7 Nc3 c6 Bg5 b5 Nxb5 cxb5 Bxb5+ Nbd7 O-O-O Rd8 Rxd7 Rxd7 Rd1 Qe6 Bxd7+ Nxd7 Qb8+ Nxb8 Rd8#'.split(' ');
  const LANG = ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6', 'O-O', 'Be7', 'Re1', 'b5', 'Bb3', 'd6', 'c3', 'O-O', 'h3', 'Nb8', 'd4', 'Nbd7',
    'c4', 'c6', 'cxb5', 'axb5', 'Nc3', 'Bb7', 'Bg5', 'b4', 'Nb1', 'h6', 'Bh4', 'c5', 'dxe5', 'Nxe4', 'Bxe7', 'Qxe7', 'exd6', 'Qf6', 'Nbd2', 'Nxd6'];
  const ENDSPIEL = '8/5k2/8/3K4/8/8/5P2/8 w - - 0 1';
  const faelle = [
    ['Operpartie, Buch bis 4', fensAus(OPER_SAN), 4],
    ['Operpartie, kein Buch', fensAus(OPER_SAN), 0],
    ['Operpartie, Buch bis 12', fensAus(OPER_SAN), 12],
    ['lange Partie (40 Halbzuege)', fensAus(LANG), 8],
    ['nur Startstellung', [START_FEN], 0],
    ['ein Zug', fensAus(['e4']), 1],
    ['Endspiel ab Stellung', fensAus(['Kd4', 'Ke6', 'f4'], ENDSPIEL), 0],
    ['Mattpartie Narrenmatt', fensAus(['f3', 'e5', 'g4', 'Qh4#']), 3],
  ];
  for (const [name, fens, buchEnde] of faelle) {
    const neu = spielphasen(fens, buchEnde);
    const alt = altePhasen(fens, buchEnde);
    pruefe('spielphasen = altes phasen(): ' + name, JSON.stringify(neu) === JSON.stringify(alt), JSON.stringify(neu) + ' / ' + JSON.stringify(alt));
  }
  pruefe('spielphasen: Operpartie hat alle drei Phasen (Endspiel ab dem Matt-Opfer)', JSON.stringify(spielphasen(fensAus(OPER_SAN), 4))
    === '[{"name":"Eröffnung","von":0,"bis":17},{"name":"Mittelspiel","von":17,"bis":32},{"name":"Endspiel","von":32,"bis":33}]',
  JSON.stringify(spielphasen(fensAus(OPER_SAN), 4)));
  pruefe('spielphasen: ab einer Endspielstellung ohne Eroeffnung', spielphasen(fensAus(['Kd4', 'Ke6', 'f4'], ENDSPIEL), 0).map((x) => x.name).join(',') === 'Mittelspiel,Endspiel');

  // coachKern: Klassenwort am Anfang weg, Gedankenstriche zu Doppelpunkt, O-O zu 0-0
  const BEISPIELE = [
    ['Genial! Du opferst den Springer auf f7, und die Rechnung geht auf.', 'Du opferst den Springer auf f7, und die Rechnung geht auf.'],
    ['Goldrichtig! e5 ist der einzige Zug, der den Vorteil hält.', 'e5 ist der einzige Zug, der den Vorteil hält.'],
    ['Goldrichtig! Sf3 ist der einzige Zug, der die Stellung hält.', 'Sf3 ist der einzige Zug, der die Stellung hält.'],
    ['Präzise! Genau das hätte auch die Engine gespielt.', 'Genau das hätte auch die Engine gespielt.'],
    ['Sauber! Fast so stark wie Sf3.', 'Fast so stark wie Sf3.'],
    ['Solide. Noch etwas genauer war d4.', 'Noch etwas genauer war d4.'],
    ['Unscharf. Die Bewertung aus deiner Sicht sinkt von +0,4 auf −0,1. Besser war Sf3.', 'Die Bewertung aus deiner Sicht sinkt von +0,4 auf −0,1. Besser war Sf3.'],
    ['Daneben. Nach Sxf7 verlierst du den Turm auf h8.', 'Nach Sxf7 verlierst du den Turm auf h8.'],
    ['Weit daneben! Das erlaubt Matt in 1: Dh4#. Besser war Sf3.', 'Das erlaubt Matt in 1: Dh4#. Besser war Sf3.'],
    ['Verschenkt! Nach dem Fehler deines Gegners war Dxd5 stark.', 'Nach dem Fehler deines Gegners war Dxd5 stark.'],
    ['Theorie: Spanische Partie. Ein bewährter Theoriezug.', 'Spanische Partie. Ein bewährter Theoriezug.'],
    ['Theorie. So spielen es auch die Profis.', 'So spielen es auch die Profis.'],
    ['Pflichtzug: Das war der einzige legale Zug.', 'Das war der einzige legale Zug.'],
    ['Präzise! exd5 gewinnt einen Bauern.', 'exd5 gewinnt einen Bauern.'],
    ['Sauber! fast perfekt.', 'Fast perfekt.'],
    ['Patt – die Partie endet remis.', 'Patt: die Partie endet remis.'],
    ['Weit daneben! Patt — damit ist der Sieg weg.', 'Patt: damit ist der Sieg weg.'],
    ['Präzise! O-O-O bringt den König in Sicherheit, O-O ging nicht.', '0-0-0 bringt den König in Sicherheit, 0-0 ging nicht.'],
    ['Schachmatt! Dxf7# beendet die Partie.', 'Schachmatt! Dxf7# beendet die Partie.'],
    ['Solide.', 'Solide.'],
    ['Brillant! Alter gespeicherter Text.', 'Alter gespeicherter Text.'],
    ['Buchzug: Alte Eröffnung.', 'Alte Eröffnung.'],
    ['', ''],
  ];
  for (const [ein, aus] of BEISPIELE) pruefe('coachKern: ' + (ein.slice(0, 22) || '(leer)'), coachKern(ein) === aus, coachKern(ein));
  pruefe('coachKern: null und undefined -> leer', coachKern(null) === '' && coachKern(undefined) === '');
  // Alle Klassen: echte Coach-Texte beginnen nach coachKern nie mit einem Klassenwort, und coachKern
  // liefert dasselbe wie das alte coachSatz() aus partie.js
  const KOPF = /^(Genial!|Goldrichtig!|Präzise!|Sauber!|Solide\.|Unscharf\.|Daneben\.|Weit daneben!|Verschenkt!|Theorie|Pflichtzug)/;
  const eingaben = [
    { fenVorher: START_FEN, uci: 'e2e4', evalVorher: ev(30), evalNachher: ev(25), besterZug: 'd2d4', pvVorher: ['d2d4'], pvNachher: ['e7e5'], eroeffnung: 'Königsbauernspiel' },
    { fenVorher: fenNach(['e4', 'e5', 'Nf3']), uci: 'd8g5', evalVorher: ev(40), evalNachher: ev(900), besterZug: 'b8c6', pvVorher: ['b8c6'], pvNachher: ['f3g5'] },
    { fenVorher: fenNach(['e4', 'e5', 'Nf3', 'Nc6']), uci: 'e1g1', evalVorher: ev(40), evalNachher: ev(30), besterZug: 'f1b5', pvVorher: ['f1b5'], pvNachher: [] },
  ];
  let geprueft = 0;
  let gleichAlt = 0;
  for (const k of KLASSEN) {
    for (const e of eingaben) {
      const t = coachText(e, { klasse: k, verlust: 0.12, notiz: '' });
      geprueft++;
      if (alterCoachSatz(t) === coachKern(t)) gleichAlt++;
      if (KOPF.test(coachKern(t))) pruefe(`coachKern: ${k} ohne Klassenwort`, false, t);
    }
  }
  pruefe(`coachKern: alle ${KLASSEN.length} Klassen ohne Klassenwort am Anfang (${geprueft} Texte)`, geprueft === KLASSEN.length * eingaben.length);
  pruefe('coachKern = altes coachSatz() aus partie.js fuer alle Texte', gleichAlt === geprueft, `${gleichAlt}/${geprueft}`);
  pruefe('GRENZEN unveraendert', JSON.stringify(GRENZEN) === '{"exzellent":0.02,"gut":0.05,"ungenau":0.1,"fehler":0.2}');
}

// ===========================================================================
// Realitaets-Test im Browser mit echter Engine
// ===========================================================================
function ladePlaywright() {
  const kandidaten = [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean);
  for (const k of kandidaten) {
    try { return require(k); } catch (e) { /* naechster */ }
  }
  return null;
}

async function warteAufServer(url, ms = 10000) {
  const ende = Date.now() + ms;
  while (Date.now() < ende) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch (e) { /* noch nicht da */ }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error('Server startet nicht: ' + url);
}

// Laeuft im Browser (wird serialisiert, keine Closures!)
async function browserTeil(tiefe) {
  const { Engine } = await import('/js/engine.js');
  const R = await import('/js/review.js');
  const { Chess } = await import('/vendor/chess/chess.js');
  const engine = new Engine();
  await engine.init();
  const uci = (text, fen) => {
    const c = new Chess(fen);
    return text.split(' ').map((s) => c.move(s).lan);
  };
  const kurz = (r) => r.zuege.map((z) => `${z.ply} ${z.sanDe} ${z.klasse} | ${z.coach}`);
  const out = {};
  const t0 = performance.now();
  out.narr = await R.analysierePartie(engine, uci('f3 e5 g4 Qh4#'), { tiefe });
  out.schaefer = await R.analysierePartie(engine, uci('e4 e5 Qh5 Nc6 Bc4 Nf6 Qxf7#'), { tiefe });
  out.dame = await R.analysierePartie(engine, uci('e4 e5 Nf3 Qg5 Nxg5'), { tiefe });
  out.oper = await R.analysierePartie(engine, uci('e4 e5 Nf3 d6 d4 Bg4 dxe5 Bxf3 Qxf3 dxe5 Bc4 Nf6 Qb3 Qe7 Nc3 c6 Bg5 b5 Nxb5 cxb5 Bxb5+ Nbd7 O-O-O Rd8 Rxd7 Rxd7 Rd1 Qe6 Bxd7+ Nxd7 Qb8+ Nxb8 Rd8#'), { tiefe, elo: { b: 1500 } });
  const ERSTICKT = '5r1k/pp4pp/7N/3Q4/8/8/5PPP/6K1 w - - 0 1';
  out.ersticktes = await R.analysierePartie(engine, uci('Qg8+ Rxg8 Nf7#', ERSTICKT), { tiefe, startFen: ERSTICKT });
  out.live = await R.bewerteZug(engine, new Chess().fen(), 'e2e4', { tiefe: 10, buch: true, eroeffnung: 'Königsbauernspiel' });
  const sekunden = Math.round((performance.now() - t0) / 100) / 10;
  // Abbruch mitten in einer tiefen Suche
  const ac = new AbortController();
  const tA = performance.now();
  setTimeout(() => ac.abort(), 400);
  let abbruch = 'nicht abgebrochen';
  try {
    await R.analysierePartie(engine, uci('e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O h3'), { tiefe: 30, signal: ac.signal });
  } catch (e) {
    abbruch = e.abgebrochen ? 'ok' : e.message;
  }
  const abbruchMs = Math.round(performance.now() - tA);
  const danach = await engine.analyse(new Chess().fen(), { depth: 8 });
  const danachOk = danach.lines.length > 0 && !danach.abgebrochen;
  engine.terminate();
  const zus = (r) => ({ klassen: r.zuege.map((z) => z.klasse), coach: r.zuege.map((z) => z.coach), eroeffnung: r.eroeffnung,
    genauigkeit: r.genauigkeit, spielstaerke: r.spielstaerke, schluesselmomente: r.schluesselmomente, text: kurz(r) });
  return {
    sekunden,
    narr: zus(out.narr), schaefer: zus(out.schaefer), dame: zus(out.dame), oper: zus(out.oper), ersticktes: zus(out.ersticktes),
    live: { klasse: out.live.klasse, coach: out.live.coach },
    abbruch, abbruchMs, danachOk,
  };
}

async function browserTests() {
  const pw = ladePlaywright();
  if (!pw) {
    pruefe('Browser-Test: Playwright gefunden', false, 'PLAYWRIGHT_PFAD setzen oder --nur-node');
    return;
  }
  const tiefe = Number((process.argv.find((a) => a.startsWith('--tiefe=')) || '--tiefe=14').slice(8));
  const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: WURZEL, stdio: 'ignore' });
  let browser;
  try {
    await warteAufServer(`http://127.0.0.1:${PORT}/js/review.js`);
    browser = await pw.chromium.launch();
    const seite = await browser.newPage();
    seite.on('pageerror', (e) => console.log('Seitenfehler: ' + e.message));
    await seite.goto(`http://127.0.0.1:${PORT}/`);
    const r = await seite.evaluate(browserTeil, tiefe);
    console.log(`\nBrowser-Analyse (Tiefe ${tiefe}) in ${r.sekunden} s`);
    for (const n of ['narr', 'schaefer', 'dame', 'oper', 'ersticktes']) {
      console.log(`--- ${n}: ${r[n].eroeffnung || '-'} | Genauigkeit W ${r[n].genauigkeit.w} S ${r[n].genauigkeit.b} | Spielstärke ${JSON.stringify(r[n].spielstaerke)}`);
      for (const z of r[n].text) console.log('   ' + z);
    }
    const k = (n) => r[n].klassen;
    pruefe('Echt: Narrenmatt 2.g4 ist patzer', k('narr')[2] === 'patzer', k('narr').join(','));
    pruefe('Echt: Narrenmatt Coach nennt Matt in 1 und Dh4#', /Matt in 1: Dh4#/.test(r.narr.coach[2]), r.narr.coach[2]);
    pruefe('Echt: Narrenmatt 1.f3 ist Buch', k('narr')[0] === 'buch');
    pruefe('Echt: Schaefermatt 3...Sf6 ist patzer', k('schaefer')[5] === 'patzer', k('schaefer').join(','));
    pruefe('Echt: Schaefermatt e4 e5 sind Buch', k('schaefer')[0] === 'buch' && k('schaefer')[1] === 'buch');
    pruefe('Echt: Schaefermatt Dxf7# bester', k('schaefer')[6] === 'bester');
    pruefe('Echt: haengende Dame 2...Dg5 ist patzer', k('dame')[3] === 'patzer', k('dame').join(','));
    pruefe('Echt: Coach "verlierst du die Dame auf g5"', /verlierst du die Dame auf g5/.test(r.dame.coach[3]), r.dame.coach[3]);
    pruefe('Echt: Sxg5 gewinnt die Dame (kein "zurückgeschlagen")', /gewinnt die Dame/.test(r.dame.coach[4]), r.dame.coach[4]);
    pruefe('Echt: Operpartie 1.e4 e5 2.Sf3 d6 sind Buch', k('oper').slice(0, 4).every((x) => x === 'buch'), k('oper').slice(0, 6).join(','));
    pruefe('Echt: Operpartie Eroeffnung Philidor', r.oper.eroeffnung === 'Philidor-Verteidigung', r.oper.eroeffnung);
    pruefe('Echt: Operpartie 16.Db8+ brillant oder bester', ['brillant', 'bester'].includes(k('oper')[30]), k('oper')[30]);
    pruefe('Echt: Operpartie 16...Sxb8 erzwungen', k('oper')[31] === 'erzwungen');
    pruefe('Echt: Operpartie 17.Td8# bester', k('oper')[32] === 'bester');
    pruefe('Echt: Operpartie Weiss genauer als Schwarz', r.oper.genauigkeit.w > r.oper.genauigkeit.b);
    pruefe('Echt: Operpartie Morphy ohne Fehler/Patzer', !k('oper').some((x, i) => i % 2 === 0 && ['fehler', 'patzer'].includes(x)));
    pruefe('Echt: Ersticktes Matt Dg8+ brillant oder bester', ['brillant', 'bester'].includes(k('ersticktes')[0]), k('ersticktes')[0]);
    pruefe('Echt: Ersticktes Matt Txg8 erzwungen', k('ersticktes')[1] === 'erzwungen');
    pruefe('Echt: Live-Bewertung 1.e4 als Buch', r.live.klasse === 'buch', r.live.klasse);
    pruefe('Echt: Abbruch per signal waehrend Tiefe-30-Suche (< 3 s)', r.abbruch === 'ok' && r.abbruchMs < 3000, `${r.abbruch} ${r.abbruchMs} ms`);
    pruefe('Echt: Engine nach Abbruch weiter nutzbar', r.danachOk);
  } catch (e) {
    pruefe('Browser-Test lief durch', false, e.message);
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
}

// ---------- w0-fix: Live-Genauigkeit wie die Analyse, Nachholen in Portionen ----------
async function w0fixTests() {
  // Partie mit starken Schwankungen (Morphys Operpartie), feste Bewertungen je Stellung
  const sans = 'e4 e5 Nf3 d6 d4 Bg4 dxe5 Bxf3 Qxf3 dxe5 Bc4 Nf6 Qb3 Qe7 Nc3 c6 Bg5 b5 Nxb5 cxb5 Bxb5+ Nbd7 O-O-O Rd8 Rxd7 Rxd7 Rd1 Qe6 Bxd7+ Nxd7 Qb8+ Nxb8 Rd8#'.split(' ');
  const zuege = uciListe(sans);
  const c = new Chess();
  const tabelle = {};
  const cps = [30, 40, 20, 90, 60, 150, 140, 320, 300, 280, 260, 400, 380, 500, 420, 300, 350, 700, 650, 600, 900, 850, 1200, 1100, 1500, 1400];
  for (let i = 0; i < zuege.length; i++) {
    const fen = c.fen();
    const legal = c.moves({ verbose: true });
    const cp = cps[i % cps.length] * (i % 3 === 0 ? 1 : 0.8);
    tabelle[fen] = [{ eval: ev(Math.round(cp)), pv: [legal[0].lan] }, { eval: ev(Math.round(cp) - 60), pv: [(legal[1] || legal[0]).lan] }];
    c.move(sans[i]);
  }
  const r = await analysierePartie(new FakeEngine(tabelle), zuege, { spielerFarbe: 'w' });
  const voll = (f) => seitenGenauigkeit(r.zuege, f, r.zuege.length);
  pruefe('seitenGenauigkeit: mit allen Eintraegen genau die Genauigkeit der Analyse (beide Seiten)', voll('w') === r.genauigkeit.w && voll('b') === r.genauigkeit.b,
    `${voll('w')}/${r.genauigkeit.w} ${voll('b')}/${r.genauigkeit.b}`);
  // wie in der Partie: nur Flos Eintraege (der letzte Zug ist seiner, alle Stellungen sind bekannt)
  const nurFlo = r.zuege.map((z) => (z.farbe === 'w' ? z : null));
  pruefe('seitenGenauigkeit: nur die eigenen Eintraege (Live-Bewertung) ergeben dieselbe Zahl', seitenGenauigkeit(nurFlo, 'w', zuege.length) === r.genauigkeit.w,
    `${seitenGenauigkeit(nurFlo, 'w', zuege.length)} / ${r.genauigkeit.w}`);
  const ungewichtet = Math.round(partieGenauigkeit(r.zuege.filter((z) => z.farbe === 'w').map((z) => z.genauigkeit)) * 10) / 10;
  pruefe('seitenGenauigkeit: gewichtet wie die Analyse (das alte ungewichtete Mittel weicht hier ab)', Math.abs(ungewichtet - r.genauigkeit.w) >= 0.1,
    `ungewichtet ${ungewichtet}, Analyse ${r.genauigkeit.w}`);
  const luecke = nurFlo.slice();
  luecke[4] = { ...luecke[4], genauigkeit: null };
  pruefe('seitenGenauigkeit: null, wenn einem eigenen Zug die Genauigkeit fehlt oder es keinen gibt', seitenGenauigkeit(luecke, 'w', zuege.length) === null
    && seitenGenauigkeit([], 'w', 0) === null && seitenGenauigkeit(nurFlo, 'b', zuege.length) === null);
  // Flo mit Schwarz: die Stellung vor dem ersten Bot-Zug fehlt, sie uebernimmt den naechsten Wert (keine Luecke)
  const nurSchwarz = r.zuege.map((z) => (z.farbe === 'b' ? z : null));
  const gs = seitenGenauigkeit(nurSchwarz, 'b', zuege.length);
  pruefe('seitenGenauigkeit: mit Luecken am Anfang (Bot zieht zuerst) eine Zahl nahe der Analyse', Number.isFinite(gs) && Math.abs(gs - r.genauigkeit.b) < 3,
    `${gs} / ${r.genauigkeit.b}`);

  // stueckeln: gleiches Ergebnis, der Hauptthread wird beim Einordnen regelmaessig frei
  const echt = globalThis.setTimeout;
  let frei = 0;
  globalThis.setTimeout = (fn, ms, ...a) => { if (!ms) frei++; return echt(fn, ms, ...a); };
  let rs;
  try {
    rs = await analysierePartie(new FakeEngine(tabelle), zuege, { spielerFarbe: 'w', stueckeln: true });
  } finally { globalThis.setTimeout = echt; }
  pruefe('stueckeln: dasselbe Ergebnis wie ohne', JSON.stringify(rs) === JSON.stringify(r));
  pruefe('stueckeln: gibt beim Einordnen von 33 Zuegen mindestens 3-mal frei', frei >= 3, frei);
  const ac = new AbortController();
  let fehler = null;
  globalThis.setTimeout = (fn, ms, ...a) => { if (!ms) ac.abort(); return echt(fn, ms, ...a); };
  try {
    await analysierePartie(new FakeEngine(tabelle), zuege, { stueckeln: true, signal: ac.signal });
  } catch (e) { fehler = e; } finally { globalThis.setTimeout = echt; }
  pruefe('stueckeln: Abbruch waehrend einer Pause bricht ab (abgebrochen)', fehler && fehler.abgebrochen === true, fehler && fehler.message);
}

// ===========================================================================
const start = Date.now();
nodeTests();
await asyncTests();
await runde4Tests();
await w0fixTests();
if (!process.argv.includes('--nur-node')) await browserTests();
const fehlgeschlagen = ergebnisse.filter((r) => !r.ok);
console.log(`\n${ergebnisse.length - fehlgeschlagen.length}/${ergebnisse.length} bestanden in ${Math.round((Date.now() - start) / 100) / 10} s`);
for (const f of fehlgeschlagen) console.log('FEHLER: ' + f.name + (f.detail ? ' (' + f.detail + ')' : ''));
process.exit(fehlgeschlagen.length ? 1 : 0);
