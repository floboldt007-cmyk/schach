// Raetsel-Fabrik fuer das Tagesraetsel (codex-auftraege/tagesraetsel.md, Abschnitt 1). Werkzeug am PC, laeuft unter
// Node, wird nicht ausgeliefert. Schreibt daten/tagesraetsel/raetsel.json, nur aus EIGENEN Stellungen:
//   1. Partien der App-Bots gegeneinander: js/bots.js botZug mit den Leiter-Bots Jan (700) bis Greta (2100), Zufall
//      je Halbzug aus tag.js zugZufall(seed, ply), feste Knotenzahl. Die Bots waehlen selbst unter ihren MultiPV-
//      Kandidaten (Rauschen, Uebersehen, Spontanzuege), daher die menschenaehnlichen Fehler.
//   2. eigene Lehr-Stellungen aus werkzeuge/raetsel-eigene.json (selbst gebaut, nicht ausgeliefert: Grundreihe, Gabel,
//      Spiess, Abzug, Fesselung, ersticktes Matt); die Fabrik prueft sie wie Partie-Stellungen und verlangt ihre Loesung
//   Nichts aus der Lichess-Datenbank, nichts von chess.com, keine Buch-Raetsel.
// Stockfish 19 lite aus vendor/stockfish laeuft wie in werkzeuge/nachbar-laeufe.mjs als Kindprozess (nice -n 19) hinter
// js/engine.js. Deterministisch: nur feste Knotenzahlen (go nodes), ein Thread, feste Seeds und je Partie ein frischer
// Engine-Prozess (kein Hash aus der Partie davor). Gleicher Aufruf, gleiche Datei, egal wie die Partien auf Prozesse
// verteilt werden. Bewusst NICHT benutzt: UCI_Elo und Skill Level (die Leiter-Bots ab 2200). Stockfish waehlt dort mit
// einem Zufall aus der Uhrzeit (Skill::pick_best), das waere nicht wiederholbar.
//
//   node werkzeuge/raetsel-fabrik.mjs --cache=<a.jsonl>                     rechnen und auswerten (fortsetzbar)
//   node werkzeuge/raetsel-fabrik.mjs --cache=<a.jsonl> --teil=0/2 --nur-rechnen   zwei Prozesse teilen sich
//   node werkzeuge/raetsel-fabrik.mjs --cache=<b.jsonl> --teil=1/2 --nur-rechnen   die Partien (hoechstens 2!)
//   node werkzeuge/raetsel-fabrik.mjs --cache=<a.jsonl,b.jsonl> --auswerten  nur auswerten (ohne Engine, Sekunden)
//   node werkzeuge/raetsel-fabrik.mjs --probe                               ohne Engine (fuer den Test): eigene
//        Lehr-Stellungen mit chess.js pruefen und die Tage aus einer festen Liste verteilen, Ergebnis als JSON
//   Optionen: --partien=N (Standard 600, nur Partien 0..N-1 zaehlen), --aus=<datei> (Standard
//   daten/tagesraetsel/raetsel.json), --stand=JJJJ-MM-TT, --start=JJJJ-MM-TT (ein Montag), --wochen=<max>.
//   Rechenlast: jeder Prozess ist eine Engine mit nice -n 19. Erst klein probieren (--partien=4), dann gross.
//   Stand 24.10.2026: 600 Partien in rund 50 Minuten mit zwei Prozessen (etwa 10 s je Partie), Auswerten 3 s.
//
// Ein Kandidat zaehlt, wenn alles stimmt (PRUEF_NODES Knoten je Suche):
//   - die Stellung ist legal (chess.js, je ein Koenig, die Seite ohne Zugrecht steht nicht im Schach)
//   - jeder eigene Zug der Loesung ist eindeutig: MultiPV 2, Abstand zum zweitbesten mindestens ABSTAND (0,15)
//     Gewinnchance (js/review.js gewinnChance); der erste Zug gewinnt (Matt oder mindestens +2,00)
//   - 1 bis 4 eigene Zuege; die Gegenzuege sind der beste Engine-Zug (MultiPV 1)
//   - am Ende Matt, oder ein gehaltener Gewinn: nach der besten Antwort mindestens 2 Bauerneinheiten mehr Material als
//     vor dem Fehler des Gegners und Bewertung mindestens +2,00 ('material'); oder Bewertung mindestens +2,00, wenn der
//     naechste eigene Zug nicht mehr eindeutig waere bzw. nach 4 Zuegen ('bewertung')
//   Partie-Stellungen zusaetzlich (Vorfilter mit SCAN_NODES): ab Halbzug MIN_PLY, und der letzte Gegnerzug war ein
//   Fehler (er gab mindestens FEHLER_SCHWELLE Gewinnchance ab; ausser bei erzwungenem Matt). So entstehen keine
//   "Rette deine Dame"-Raetsel.
// Motiv nur bei sicherer geometrischer Pruefung (sonst null): 'grundreihe' (Matt, Koenig auf der Grundreihe hinter
//   mindestens zwei eigenen Figuren, Schach von Turm/Dame auf der Grundreihe), 'matt' (andere Matts), 'gabel' (die
//   gezogene Figur greift zwei lohnende Ziele an und schlaegt im naechsten eigenen Zug eins davon, mindestens eine
//   Leichtfigur), 'spiess' (Langschrittler greift A an, dahinter B, A ist mehr wert oder der Koenig, A weicht, B
//   faellt), 'abzug' (Abzugsschach, oder ein Abzugsangriff, dessen Langschrittler im naechsten eigenen Zug schlaegt),
//   'fesselung' (absolute Fesselung einer Figur an den Koenig, die Figur faellt spaeter in der Loesung).
// Stufe 1 bis 7 aus Loesungslaenge, Zahl der plausiblen Fehlzuege (andere schlagende oder Schach gebende Zuege; ein
//   ruhiger Loesungszug macht sie alle plausibel) und der Staerke der Partie (mittlere Elo der Bots; eigene
//   Lehr-Stellungen zaehlen als die schwaechste Partie). Feste Schwellen in STUFEN_SCHWELLEN.
//
// Ausgabe (art 'tagesraetsel', format 1, rechenstand = RECHENSTAND aus js/inhalte.js):
//   { kopf, quelle: { partien, kandidaten, behalten, engine, nodes }, start: 'JJJJ-MM-TT' (Montag),
//     tage: [ { aufgaben: [Aufgabe] } ] }   Tag k = start + k Tage (die Grenze 4:00 macht die App), ganze Wochen
//   Aufgabe = { id: 'tr-0001', fen, loesung: [uci], motiv, stufe, matt: n | null, titel: 'Weiß am Zug' | 'Schwarz am Zug' }
//   loesung wie js/ui/raetsel.js: gerade Stellen der Loesende, ungerade die Antwort des Gegners.
//   Wochenkurve: Montag Stufe 1-2, Dienstag 2-3, ... Samstag 6-7, jeden Tag echt schwerer als am Vortag; Sonntag zwei
//   Aufgaben (zweiteilig): eine mittlere (3-5) und eine schwere (6-7). Keine Stellung doppelt.
//   quelle.kandidaten = mit PRUEF_NODES gepruefte Stellungen (Partien + eigene), quelle.behalten = davon alle Kriterien
//   erfuellt (nach Doppel- und Je-Partie-Grenze, hoechstens MAX_JE_PARTIE je Partie); die Datei nutzt so viele davon,
//   wie ganze Wochen hineinpassen (hoechstens WOCHEN_MAX, mindestens WOCHEN_MIN, sonst Abbruch).
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import { Chess } from '../vendor/chess/chess.js';
import { gewinnChance } from '../js/review.js';
import { RECHENSTAND } from '../js/inhalte.js';
import { zugZufall, zufallAus, seedAus, wochentag, istSchluessel } from '../js/tag.js';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const WURZEL = path.resolve(HIER, '..');

// ---------- Einstellungen (aendert sich hier etwas, FABRIK_STAND hochzaehlen: alte Cache-Zeilen gelten dann nicht) ----------
export const FABRIK_STAND = 1;
export const BOT_NODES = 60000;       // Deckel je Bot-Zug (die Bots rechnen ausserdem nur bis zu ihrer Tiefe)
export const SCAN_NODES = 20000;      // Vorfilter: jede Stellung der Partie, MultiPV 2
export const PRUEF_NODES = 250000;    // Pruefung der Kandidaten, MultiPV 2 (eigener Zug) bzw. 1 (Antwort)
export const ABSTAND = 0.15;          // Mindestabstand bester zu zweitbestem Zug (Gewinnchance)
const VOR_ABSTAND = 0.10;             // Vorfilter lockerer (Rauschen der kurzen Suche; streng prueft erst PRUEF_NODES)
const FEHLER_SCHWELLE = 0.08;         // so viel Gewinnchance gab der letzte Gegnerzug mindestens ab
const GEWINN_CP = 200;                // "gewonnen": Matt oder mindestens +2,00
const VOR_GEWINN_CP = 150;
const GEWINN_MATERIAL = 2;            // gehaltener Materialgewinn in Bauerneinheiten
const MAX_EIGENE_ZUEGE = 4;
const MAX_PLIES = 160;
const MIN_PLY = 10;
const MAX_PRUEF_JE_PARTIE = 10;
const MAX_JE_PARTIE = 2;
const PARTIEN_STANDARD = 600;
const WOCHEN_MIN = 18;
const WOCHEN_MAX = 26;
const STAND_STANDARD = '2026-10-24';
const START_STANDARD = '2026-10-19';
const ENGINE_NAME = 'Stockfish 19 lite (wie die App)';
export const MOTIVE = Object.freeze(['gabel', 'fesselung', 'spiess', 'abzug', 'grundreihe', 'matt']);
// Bots der Partien (Leiter, Elo 700 bis 2100, alle ohne UCI_Elo); Paare: Nachbarn (k, k+1) und (k, k+2)
const BOT_IDS = ['bodo', 'kalle', 'leo', 'lisa', 'edda', 'rudi', 'luke', 'turm', 'moritz', 'delia', 'ottilie', 'koenig',
  'lasse', 'wiebke', 'greta'];
const PAARE = (() => {
  const p = [];
  for (let i = 0; i + 1 < BOT_IDS.length; i++) p.push([BOT_IDS[i], BOT_IDS[i + 1]]);
  for (let i = 0; i + 2 < BOT_IDS.length; i++) p.push([BOT_IDS[i], BOT_IDS[i + 2]]);
  return p;
})();
// Stufe: Punkte = 1,5 je weiterem eigenen Zug + 0,3 je plausiblem Fehlzug (hoechstens 8) + 1 fuer einen ruhigen
// ersten Zug + bis 1,5 fuer die Staerke der Partie (Elo 700 -> 0, 2100 -> 1,5). Stufe = 1 + Zahl der erreichten Schwellen.
// Die Schwellen sind am Vorrat der 600 Partien geeicht (etwa 150/90/80/60/50/40/30 Aufgaben je Stufe 1..7), damit die
// Wochenkurve 26 Wochen lang traegt: lange Loesungen, ruhige Zuege und starke Partien landen oben.
export const STUFEN_SCHWELLEN = Object.freeze([1.35, 1.9, 2.4, 3.0, 3.6, 4.5]);
// Wochenkurve: Montag bis Samstag [von, bis], Sonntag eine mittlere und eine schwere Aufgabe
export const TAG_STUFEN = Object.freeze([[1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7]]);
export const SONNTAG_MITTEL = Object.freeze([3, 4, 5]);
export const SONNTAG_SCHWER = Object.freeze([6, 7]);

const WERT = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const RANG = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };

const arg = (n, s = null) => {
  const a = process.argv.find((x) => x.startsWith('--' + n + '=') || x === '--' + n);
  if (!a) return s;
  return a.includes('=') ? a.slice(n.length + 3) : true;
};

// ---------------------------------------------------------------------------
// Schach-Hilfen (rein, chess.js)
// ---------------------------------------------------------------------------
const gegnerVon = (f) => (f === 'w' ? 'b' : 'w');
const stellungsSchluessel = (fen) => String(fen).trim().split(/\s+/).slice(0, 4).join(' ');

function spiele(chess, uci) {
  try {
    return chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }) || null;
  } catch (e) {
    return null;
  }
}

function material(chess, farbe) {
  let s = 0;
  for (const reihe of chess.board()) for (const f of reihe) if (f) s += (f.color === farbe ? 1 : -1) * WERT[f.type];
  return s;
}

// Bewertung aus Sicht von farbe als Zahl zum Vergleichen (Matt = +-100000 minus Zuege)
function punkteFuer(ev, farbe) {
  if (!ev) return 0;
  const vz = farbe === 'w' ? 1 : -1;
  if (ev.mate != null) {
    if (ev.mate === 0) return 0;
    const m = ev.mate * vz;
    return m > 0 ? 100000 - m : -100000 - m;
  }
  return (ev.cp || 0) * vz;
}
const gewinnt = (ev, farbe, grenze = GEWINN_CP) => punkteFuer(ev, farbe) >= grenze;
const wc = (ev, farbe) => gewinnChance(ev, farbe);

// legal genug fuer ein Raetsel: chess.js laedt sie, je ein Koenig, die Seite ohne Zugrecht steht nicht im Schach,
// keine Bauern auf der ersten oder letzten Reihe, Spiel noch nicht vorbei
export function stellungLegal(fen) {
  let c;
  try { c = new Chess(fen); } catch (e) { return { ok: false, grund: 'fen' }; }
  const brett = c.board().flat().filter(Boolean);
  for (const f of ['w', 'b']) if (brett.filter((x) => x.type === 'k' && x.color === f).length !== 1) return { ok: false, grund: 'koenig' };
  for (const [i, reihe] of c.board().entries()) {
    if (i !== 0 && i !== 7) continue;
    if (reihe.some((x) => x && x.type === 'p')) return { ok: false, grund: 'bauer-grundreihe' };
  }
  const anderer = gegnerVon(c.turn());
  const k = c.findPiece({ type: 'k', color: anderer })[0];
  if (c.isAttacked(k, c.turn())) return { ok: false, grund: 'schach-ohne-zugrecht' };
  if (c.isGameOver()) return { ok: false, grund: 'ende' };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Motive (rein, nur sichere geometrische Pruefungen)
// ---------------------------------------------------------------------------
const FILES = 'abcdefgh';
const feld = (x, y) => (x >= 0 && x < 8 && y >= 0 && y < 8 ? FILES[x] + (y + 1) : null);
const xy = (sq) => [FILES.indexOf(sq[0]), Number(sq[1]) - 1];
const GERADE = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const SCHRAEG = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const richtungen = (typ) => (typ === 'r' ? GERADE : typ === 'b' ? SCHRAEG : typ === 'q' ? [...GERADE, ...SCHRAEG] : []);

// erste besetzte Felder auf einem Strahl ab sq (ohne sq)
function strahl(chess, sq, [dx, dy], n = 2) {
  const aus = [];
  let [x, y] = xy(sq);
  for (;;) {
    x += dx; y += dy;
    const f = feld(x, y);
    if (!f) break;
    const p = chess.get(f);
    if (p) { aus.push({ sq: f, p }); if (aus.length >= n) break; }
  }
  return aus;
}

// liegt m echt zwischen a und b auf einer Linie (gerade oder schraeg)?
function zwischen(a, m, b) {
  const [ax, ay] = xy(a); const [mx, my] = xy(m); const [bx, by] = xy(b);
  const dx = Math.sign(bx - ax); const dy = Math.sign(by - ay);
  if (!(ax === bx || ay === by || Math.abs(bx - ax) === Math.abs(by - ay))) return false;
  let x = ax + dx; let y = ay + dy;
  while (x !== bx || y !== by) {
    if (x === mx && y === my) return true;
    x += dx; y += dy;
  }
  return false;
}

export function istGrundreihenmatt(chess) {
  if (!chess.isCheckmate()) return false;
  const opfer = chess.turn();
  const sieger = gegnerVon(opfer);
  const k = chess.findPiece({ type: 'k', color: opfer })[0];
  const grund = opfer === 'w' ? '1' : '8';
  if (!k || k[1] !== grund) return false;
  const geber = chess.attackers(k, sieger);
  if (!geber.length) return false;
  for (const g of geber) {
    const p = chess.get(g);
    if (!p || (p.type !== 'r' && p.type !== 'q') || g[1] !== grund) return false;
  }
  const [kx, ky] = xy(k);
  const vor = ky + (opfer === 'w' ? 1 : -1);
  let eigene = 0;
  for (const dx of [-1, 0, 1]) {
    const f = feld(kx + dx, vor);
    if (!f) continue;
    const p = chess.get(f);
    if (p && p.color === opfer) eigene++;
  }
  return eigene >= 2;
}

function istGabel(nachher, zug, weiter) {
  if (!weiter) return false;
  const s = zug.slice(2, 4);
  const x = nachher.get(s);
  if (!x || weiter.slice(0, 2) !== s) return false;
  const flo = x.color; const gegner = gegnerVon(flo);
  const ziele = new Map();
  for (const reihe of nachher.board()) {
    for (const p of reihe) {
      if (!p || p.color !== gegner) continue;
      if (!nachher.attackers(p.square, flo).includes(s)) continue;
      const lohnt = p.type === 'k' || RANG[p.type] > RANG[x.type] || nachher.attackers(p.square, gegner).length === 0;
      if (lohnt) ziele.set(p.square, p.type);
    }
  }
  if (ziele.size < 2) return false;
  const t = weiter.slice(2, 4);
  return ziele.has(t) && ziele.get(t) !== 'k' && WERT[ziele.get(t)] >= 3;
}

function istSpiess(nachher, zug, antwort, weiter) {
  if (!antwort || !weiter) return false;
  const s = zug.slice(2, 4);
  const x = nachher.get(s);
  if (!x || !'brq'.includes(x.type) || weiter.slice(0, 2) !== s) return false;
  for (const r of richtungen(x.type)) {
    const [a, b] = strahl(nachher, s, r, 2);
    if (!a || !b || a.p.color === x.color || b.p.color === x.color) continue;
    if (!(a.p.type === 'k' || RANG[a.p.type] > RANG[b.p.type])) continue;
    if (antwort.slice(0, 2) === a.sq && weiter.slice(2, 4) === b.sq && WERT[b.p.type] >= 3) return true;
  }
  return false;
}

function istAbzug(nachher, zug, weiter) {
  const f = zug.slice(0, 2); const s = zug.slice(2, 4);
  const x = nachher.get(s);
  if (!x || x.type === 'k') return false;
  const flo = x.color; const gegner = gegnerVon(flo);
  const k = nachher.findPiece({ type: 'k', color: gegner })[0];
  // Abzugsschach: Schach von einer anderen Figur, deren Linie ueber das Ausgangsfeld laeuft
  for (const g of nachher.attackers(k, flo)) if (g !== s && zwischen(g, f, k)) return true;
  // Abzugsangriff: der Langschrittler hinter dem Ausgangsfeld schlaegt im naechsten eigenen Zug, was dahinter stand
  if (!weiter) return false;
  const von = weiter.slice(0, 2); const ziel = weiter.slice(2, 4);
  const opfer = nachher.get(ziel);
  if (von === s || !opfer || opfer.color !== gegner || WERT[opfer.type] < 3) return false;
  const l = nachher.get(von);
  if (!l || l.color !== flo || !'brq'.includes(l.type)) return false;
  return zwischen(von, f, ziel) && nachher.attackers(ziel, flo).includes(von);
}

// absolute Fesselungen: Figur (Springer bis Dame) des Gegners zwischen eigenem Langschrittler und gegnerischem Koenig
function fesselungen(chess, flo) {
  const gegner = gegnerVon(flo);
  const k = chess.findPiece({ type: 'k', color: gegner })[0];
  const aus = [];
  for (const r of [...GERADE, ...SCHRAEG]) {
    const [a, b] = strahl(chess, k, r, 2);
    if (!a || !b || a.p.color !== gegner || !'nbrq'.includes(a.p.type) || b.p.color !== flo) continue;
    const gerade = r[0] === 0 || r[1] === 0;
    if (b.p.type === 'q' || (gerade && b.p.type === 'r') || (!gerade && b.p.type === 'b')) aus.push(a.sq);
  }
  return aus;
}

// Motiv einer geprueften Loesung (fen, loesung, matt) -> eins aus MOTIVE oder null
export function motivVon(fen, loesung, matt) {
  const c = new Chess(fen);
  const flo = c.turn();
  const stellungen = [new Chess(fen)];
  for (const u of loesung) {
    if (!spiele(c, u)) return null;
    stellungen.push(new Chess(c.fen()));
  }
  if (matt) return istGrundreihenmatt(c) ? 'grundreihe' : (c.isCheckmate() ? 'matt' : null);
  const fesselTreffer = (start, gefesselt) => {
    let g = gefesselt;
    for (let j = start; j < loesung.length; j++) {
      const u = loesung[j];
      if (j % 2 === 0 && u.slice(2, 4) === g) {
        const p = stellungen[j].get(g);
        return !!p && p.color !== flo;
      }
      if (j % 2 === 1 && u.slice(0, 2) === g) g = u.slice(2, 4);
    }
    return false;
  };
  // Fesselung schon in der Ausgangsstellung (ausgenutzt ab dem zweiten eigenen Zug)
  for (const g of fesselungen(stellungen[0], flo)) if (fesselTreffer(2, g)) return 'fesselung';
  for (let i = 0; i < loesung.length; i += 2) {
    const nachher = stellungen[i + 1];
    const antwort = loesung[i + 1] || null;
    const weiter = loesung[i + 2] || null;
    if (istGabel(nachher, loesung[i], weiter)) return 'gabel';
    if (istSpiess(nachher, loesung[i], antwort, weiter)) return 'spiess';
    if (istAbzug(nachher, loesung[i], weiter)) return 'abzug';
    for (const g of fesselungen(nachher, flo)) if (fesselTreffer(i + 2, g)) return 'fesselung';
  }
  return null;
}

// ---------------------------------------------------------------------------
// Stufe (rein)
// ---------------------------------------------------------------------------
export function merkmaleVon(fen, loesung) {
  const c = new Chess(fen);
  const zuege = c.moves({ verbose: true });
  const erster = zuege.find((z) => z.lan === loesung[0]);
  const forsch = (z) => !!z.captured || /[+#]/.test(z.san) || !!z.promotion;
  const fehlzuege = zuege.filter((z) => z.lan !== loesung[0] && (z.captured || /[+#]/.test(z.san))).length;
  return { eigeneZuege: Math.ceil(loesung.length / 2), fehlzuege, ruhig: !!erster && !forsch(erster) };
}

export function stufeVon({ eigeneZuege, fehlzuege, ruhig, elo }) {
  const staerke = Math.max(0, Math.min(1, ((Number.isFinite(elo) ? elo : 700) - 700) / 1400));
  const punkte = 1.5 * (eigeneZuege - 1) + 0.3 * Math.min(8, fehlzuege) + (ruhig ? 1 : 0) + 1.5 * staerke;
  let s = 1;
  for (const t of STUFEN_SCHWELLEN) if (punkte >= t - 1e-9) s++;
  return { stufe: Math.min(7, s), punkte: Math.round(punkte * 100) / 100 };
}

// ---------------------------------------------------------------------------
// Tage verteilen (rein, deterministisch)
// ---------------------------------------------------------------------------
// eintraege: [{ schluessel, stufe, motiv, partie, rang }] (rang: kleiner = zuerst). -> { wochen: [[Eintrag x 8]] }
// Montag bis Samstag echt steigend in [1,2] [2,3] ... [6,7]: so ein Wochenmuster nimmt sechs der sieben Stufen und
// laesst genau eine aus (Montag 1 bis Freitag 5 und Samstag 7 laesst die 6 aus, Montag 2 bis Samstag 7 die 1). Dazu
// Sonntag mittel (3-5) und schwer (6-7). planeWochen rechnet fuer W Wochen exakt, wie oft jede Stufe ausgelassen und
// sonntags genommen wird; genommen wird das groesste W (hoechstens wochenMax), fuer das der Vorrat reicht. Je Stufe gehen
// die Eintraege mit kleinem rang zuerst weg (moeglichst nicht dasselbe Motiv wie am Vortag und keine Partie zweimal in
// einer Woche). Die Reihenfolge der Wochenmuster und danach die der fertigen Wochen kommt aus einem festen Seed.
export function planeWochen(W, vorrat) {
  const S = (s) => vorrat[s] || 0;
  let bester = null;
  for (let m3 = 0; m3 <= W; m3++) {
    for (let m4 = 0; m3 + m4 <= W; m4++) {
      for (let h6 = 0; h6 <= W; h6++) {
        const sonntag = { 3: m3, 4: m4, 5: W - m3 - m4, 6: h6, 7: W - h6 };
        // jede Stufe s wird W-mal gebraucht, ausser in den Wochen, die sie auslassen (x[s]), plus Sonntag
        const x = {};
        let summe = 0;
        for (let s = 1; s <= 7; s++) { x[s] = Math.max(0, W + (sonntag[s] || 0) - S(s)); summe += x[s]; }
        if (summe > W) continue;
        // freie Auslassungen auf die knappsten Stufen
        for (let k = summe; k < W; k++) {
          let s0 = 1;
          for (let s = 2; s <= 7; s++) if (S(s) - (W - x[s] + (sonntag[s] || 0)) < S(s0) - (W - x[s0] + (sonntag[s0] || 0))) s0 = s;
          x[s0]++;
        }
        let rest = Infinity;
        for (let s = 1; s <= 7; s++) rest = Math.min(rest, S(s) - (W - x[s] + (sonntag[s] || 0)));
        if (!bester || rest > bester.rest) bester = { W, x, sonntag, rest };
      }
    }
  }
  return bester;
}

export function verteileTage(eintraege, { wochenMin = WOCHEN_MIN, wochenMax = WOCHEN_MAX } = {}) {
  const eimer = new Map();
  for (let s = 1; s <= 7; s++) eimer.set(s, []);
  const sortiert = [...eintraege].sort((a, b) => (a.rang - b.rang) || (a.schluessel < b.schluessel ? -1 : a.schluessel > b.schluessel ? 1 : 0));
  for (const e of sortiert) if (eimer.has(e.stufe)) eimer.get(e.stufe).push(e);
  const vorrat = {};
  for (const [s, l] of eimer) vorrat[s] = l.length;
  let plan = null;
  for (let W = wochenMax; W >= Math.max(1, wochenMin) && !plan; W--) plan = planeWochen(W, vorrat);
  if (!plan) throw new Error(`keine ${wochenMin} ganzen Wochen moeglich (Vorrat je Stufe ${JSON.stringify(vorrat)})`);
  const z = zufallAus('tagesraetsel/wochen');
  const gemischt = (zaehl) => {
    const l = [];
    for (const s of Object.keys(zaehl).map(Number).sort((a, b) => a - b)) for (let i = 0; i < zaehl[s]; i++) l.push(s);
    for (let i = l.length - 1; i > 0; i--) {
      const j = Math.floor(z() * (i + 1));
      [l[i], l[j]] = [l[j], l[i]];
    }
    return l;
  };
  const aus = gemischt(plan.x);
  const mittel = gemischt({ 3: plan.sonntag[3], 4: plan.sonntag[4], 5: plan.sonntag[5] });
  const schwer = gemischt({ 6: plan.sonntag[6], 7: plan.sonntag[7] });
  const wochen = [];
  for (let w = 0; w < plan.W; w++) {
    const stufen = [1, 2, 3, 4, 5, 6, 7].filter((s) => s !== aus[w]).concat([mittel[w], schwer[w]]);
    const woche = [];
    const partien = new Set();
    for (const s of stufen) {
      const liste = eimer.get(s);
      const vorher = woche.length ? woche[woche.length - 1].motiv : null;
      let i = liste.findIndex((e) => (e.motiv == null || e.motiv !== vorher) && (e.partie == null || !partien.has(e.partie)));
      if (i < 0) i = liste.findIndex((e) => e.partie == null || !partien.has(e.partie));
      if (i < 0) i = 0;
      const e = liste.splice(i, 1)[0];
      if (e.partie != null) partien.add(e.partie);
      woche.push(e);
    }
    wochen.push(woche);
  }
  // die besten Eintraege (kleiner rang) stuenden sonst alle in den ersten Wochen: fertige Wochen ebenfalls mischen
  for (let i = wochen.length - 1; i > 0; i--) {
    const j = Math.floor(z() * (i + 1));
    [wochen[i], wochen[j]] = [wochen[j], wochen[i]];
  }
  return { wochen };
}

// ---------------------------------------------------------------------------
// Eigene Lehr-Stellungen
// ---------------------------------------------------------------------------
const EIGENE_DATEI = path.join(WURZEL, 'werkzeuge/raetsel-eigene.json');
export function ladeEigene(datei = EIGENE_DATEI) {
  const j = JSON.parse(fs.readFileSync(datei, 'utf8'));
  if (!j || !j.kopf || j.kopf.art !== 'raetsel-eigene' || !Array.isArray(j.stellungen)) throw new Error('raetsel-eigene.json: Kopf oder stellungen fehlt');
  return j.stellungen;
}

// Pruefung ohne Engine: legal, Loesung spielbar, ungerade Laenge, Matt wie angegeben, Motiv wie angegeben
export function pruefeEigeneOhneEngine(e) {
  const fehler = [];
  if (!e || typeof e.id !== 'string' || !/^[a-z][a-z0-9-]{1,39}$/.test(e.id)) fehler.push('id');
  const legal = stellungLegal(e && e.fen);
  if (!legal.ok) fehler.push('stellung: ' + legal.grund);
  const l = Array.isArray(e && e.loesung) ? e.loesung : [];
  if (!l.length || l.length % 2 !== 1 || l.length > 2 * MAX_EIGENE_ZUEGE - 1) fehler.push('loesung: Laenge');
  let matt = null;
  let motiv = null;
  if (legal.ok && l.length) {
    const c = new Chess(e.fen);
    let ok = true;
    for (const u of l) if (!spiele(c, u)) { ok = false; break; }
    if (!ok) fehler.push('loesung: nicht spielbar');
    else {
      matt = c.isCheckmate() ? Math.ceil(l.length / 2) : null;
      if ((e.matt ?? null) !== matt) fehler.push(`matt: angegeben ${e.matt ?? null}, gespielt ${matt}`);
      motiv = motivVon(e.fen, l, matt);
      if ((e.motiv ?? null) !== motiv) fehler.push(`motiv: angegeben ${e.motiv ?? null}, erkannt ${motiv}`);
    }
  }
  if (typeof e.quelle !== 'string' || !e.quelle.trim()) fehler.push('quelle fehlt');
  return { id: e && e.id, ok: fehler.length === 0, fehler, matt, motiv };
}

// ---------------------------------------------------------------------------
// Engine (nur im Rechen-Teil)
// ---------------------------------------------------------------------------
const laufend = new Set();
class ProzessWorker {
  constructor(pfad) {
    const p = String(pfad).startsWith('file:') ? fileURLToPath(pfad) : String(pfad);
    this.kind = spawn('nice', ['-n', '19', process.execPath, p], { cwd: path.dirname(p), stdio: ['pipe', 'pipe', 'ignore'] });
    this.pid = this.kind.pid;
    laufend.add(this);
    this.onmessage = null;
    this.onerror = null;
    let rest = '';
    this.kind.stdout.setEncoding('utf8');
    this.kind.stdout.on('data', (stueck) => {
      rest += stueck;
      const zeilen = rest.split(/\r?\n/);
      rest = zeilen.pop();
      for (const z of zeilen) if (z && this.onmessage) this.onmessage({ data: z });
    });
    this.kind.on('error', (e) => { if (this.onerror) this.onerror({ message: e.message }); });
    this.kind.on('exit', () => laufend.delete(this));
  }
  postMessage(befehl) {
    if (this.kind.stdin.writable) this.kind.stdin.write(befehl + '\n');
  }
  terminate() {
    try { this.kind.stdin.end(); } catch (e) { /* egal */ }
    try { process.kill(this.pid, 'SIGTERM'); } catch (e) { /* schon weg */ }
    laufend.delete(this);
  }
}
export const alleBeenden = () => { for (const w of [...laufend]) w.terminate(); };

export async function neueEngine() {
  globalThis.Worker = ProzessWorker;
  const { Engine } = await import('../js/engine.js');
  const e = new Engine(undefined, { zeitlimitMs: 60000 });
  await e.init();
  return e;
}

async function analyse(engine, fen, multipv, nodes) {
  for (let versuch = 0; versuch < 2; versuch++) {
    const a = await engine.analyse(fen, { nodes, multipv });
    if (a && !a.fehler) return a;
  }
  throw new Error('Engine abgestuerzt bei ' + fen);
}

// Loesung ab fen0 suchen und pruefen. matRef: Material (Sicht der Loesenden) vor dem Fehler des Gegners.
// -> { ok: true, loesung, ende, matt, gewinn, eval, abstand } | { ok: false, grund }
export async function loesungSuchen(engine, fen0, matRef) {
  const legal = stellungLegal(fen0);
  if (!legal.ok) return { ok: false, grund: 'stellung-' + legal.grund };
  const c = new Chess(fen0);
  const flo = c.turn();
  const loesung = [];
  let abstand = null;
  let a = await analyse(engine, c.fen(), 2, PRUEF_NODES);
  let letzte = null;   // { gewinn, ev } nach der letzten Antwort
  const fertig = (ende, matt = null) => ({
    ok: true, loesung: loesung.slice(), ende, matt,
    gewinn: letzte ? letzte.gewinn : null, eval: letzte ? letzte.ev : null, abstand: Math.round(abstand * 1000) / 1000,
  });
  for (let k = 1; k <= MAX_EIGENE_ZUEGE; k++) {
    const l1 = a.lines[0]; const l2 = a.lines[1];
    if (!l1 || !l1.pv || !l1.pv.length) return { ok: false, grund: 'engine' };
    const legale = c.moves().length;
    const w1 = wc(l1.eval, flo);
    const w2 = l2 ? wc(l2.eval, flo) : (legale === 1 ? 0 : null);
    if (w2 == null) return { ok: false, grund: 'engine' };
    const eindeutig = w1 - w2 >= ABSTAND - 1e-9;
    if (k === 1) {
      if (!eindeutig) return { ok: false, grund: 'nicht-eindeutig' };
      if (!gewinnt(l1.eval, flo)) return { ok: false, grund: 'kein-gewinn' };
      abstand = w1 - w2;
    } else if (!eindeutig) {
      loesung.pop();   // die Antwort davor gehoert nicht mehr dazu
      if (letzte && gewinnt(letzte.ev, flo)) return fertig('bewertung');
      return { ok: false, grund: 'folgezug-nicht-eindeutig' };
    }
    const zug = l1.pv[0];
    if (!spiele(c, zug)) return { ok: false, grund: 'engine' };
    loesung.push(zug);
    if (c.isCheckmate()) { letzte = null; return fertig('matt', k); }
    if (c.isGameOver()) return { ok: false, grund: 'remis' };
    const b = await analyse(engine, c.fen(), 1, PRUEF_NODES);
    const antwort = b.bestmove || (b.lines[0] && b.lines[0].pv[0]);
    if (!antwort || !spiele(c, antwort)) return { ok: false, grund: 'engine' };
    if (c.isGameOver()) return { ok: false, grund: 'ende-nach-antwort' };
    a = await analyse(engine, c.fen(), 2, PRUEF_NODES);
    const ev = a.lines[0] ? a.lines[0].eval : null;
    if (!ev) return { ok: false, grund: 'engine' };
    letzte = { gewinn: material(c, flo) - matRef, ev };
    if (letzte.gewinn >= GEWINN_MATERIAL && gewinnt(ev, flo)) return fertig('material');
    if (k === MAX_EIGENE_ZUEGE) return gewinnt(ev, flo) ? fertig('bewertung') : { ok: false, grund: 'kein-gehaltener-gewinn' };
    loesung.push(antwort);
  }
  return { ok: false, grund: 'zu-lang' };
}

function partieVon(nr) {
  const paar = PAARE[nr % PAARE.length];
  const tausch = Math.floor(nr / PAARE.length) % 2 === 1;
  return { weiss: tausch ? paar[1] : paar[0], schwarz: tausch ? paar[0] : paar[1], seed: `crownmate-tagesraetsel/${nr}` };
}

async function rechnePartie(nr) {
  const { botNachId, botZug } = await import('../js/bots.js');
  const { weiss, schwarz, seed } = partieVon(nr);
  const bw = botNachId(weiss); const bs = botNachId(schwarz);
  const engine = await neueEngine();
  try {
    // 1. Partie
    const c = new Chess();
    const fens = [c.fen()];
    const zuege = [];
    for (let ply = 0; ply < MAX_PLIES && !c.isGameOver(); ply++) {
      const bot = c.turn() === 'w' ? bw : bs;
      const z = await botZug(engine, c.fen(), bot, { zufall: zugZufall(seed, ply), nodes: BOT_NODES, ohnePause: true, zugNummer: ply + 1 });
      if (!z || !spiele(c, z.uci)) break;
      zuege.push(z.uci);
      fens.push(c.fen());
    }
    const ergebnis = c.isCheckmate() ? (c.turn() === 'w' ? 0 : 1) : (c.isGameOver() ? 0.5 : null);
    // 2. Vorfilter: jede Stellung ab MIN_PLY - 1 mit SCAN_NODES
    const scan = new Array(fens.length).fill(null);
    for (let i = MIN_PLY - 1; i < fens.length; i++) {
      if (new Chess(fens[i]).isGameOver()) break;
      scan[i] = await analyse(engine, fens[i], 2, SCAN_NODES);
    }
    const vor = [];
    for (let i = MIN_PLY; i < fens.length; i++) {
      const a = scan[i]; const v = scan[i - 1];
      if (!a || !v || a.lines.length < 2 || !v.lines.length) continue;
      const s = new Chess(fens[i]).turn();
      const [l1, l2] = a.lines;
      if (!gewinnt(l1.eval, s, VOR_GEWINN_CP)) continue;
      const luecke = wc(l1.eval, s) - wc(l2.eval, s);
      if (luecke < VOR_ABSTAND) continue;
      // ein erzwungenes Matt ist immer ein Raetsel; sonst muss der letzte Gegnerzug ein Fehler gewesen sein
      const matt = l1.eval.mate != null && punkteFuer(l1.eval, s) > 0;
      if (!matt && wc(l1.eval, s) - wc(v.lines[0].eval, s) < FEHLER_SCHWELLE) continue;
      vor.push({ i, luecke });
    }
    vor.sort((x, y) => (y.luecke - x.luecke) || (x.i - y.i));
    const pruefen = vor.slice(0, MAX_PRUEF_JE_PARTIE).sort((x, y) => x.i - y.i);
    // 3. Pruefung
    const raetsel = [];
    const abgelehnt = {};
    for (const { i } of pruefen) {
      const p = new Chess(fens[i]);
      const flo = p.turn();
      const matRef = Math.max(material(p, flo), material(new Chess(fens[i - 1]), flo));
      const r = await loesungSuchen(engine, fens[i], matRef);
      if (r.ok) raetsel.push({ ply: i, fen: fens[i], loesung: r.loesung, ende: r.ende, matt: r.matt, gewinn: r.gewinn, eval: r.eval, abstand: r.abstand });
      else abgelehnt[r.grund] = (abgelehnt[r.grund] || 0) + 1;
    }
    return {
      typ: 'partie', nr, fabrik: FABRIK_STAND, einst: einstellungen(), weiss, schwarz, elo: [bw.elo, bs.elo], seed,
      zuege, ergebnis, vorfilter: vor.length, geprueft: pruefen.length, abgelehnt, raetsel,
    };
  } finally {
    engine.terminate();
  }
}

async function rechneEigene(e) {
  const engine = await neueEngine();
  try {
    const c = new Chess(e.fen);
    const r = await loesungSuchen(engine, e.fen, material(c, c.turn()));
    const gleich = r.ok && JSON.stringify(r.loesung) === JSON.stringify(e.loesung);
    return {
      typ: 'eigen', id: e.id, schluessel: eigenSchluessel(e), fabrik: FABRIK_STAND, einst: einstellungen(),
      ok: gleich, grund: r.ok ? (gleich ? null : 'andere-loesung ' + r.loesung.join(' ')) : r.grund,
      loesung: r.ok ? r.loesung : null, ende: r.ok ? r.ende : null, matt: r.ok ? r.matt : null, abstand: r.ok ? r.abstand : null,
    };
  } finally {
    engine.terminate();
  }
}

// alles, was das Ergebnis einer Partie bestimmt (Cache-Zeilen mit anderen Werten gelten nicht)
const einstellungen = () => ({
  bot: BOT_NODES, scan: SCAN_NODES, pruef: PRUEF_NODES, abstand: ABSTAND, vor: [VOR_ABSTAND, FEHLER_SCHWELLE, VOR_GEWINN_CP, 'matt-frei'],
  gewinn: [GEWINN_CP, GEWINN_MATERIAL], zuege: MAX_EIGENE_ZUEGE, plies: [MIN_PLY, MAX_PLIES], jePartie: MAX_PRUEF_JE_PARTIE,
});
const eigenSchluessel = (e) => String(seedAus(JSON.stringify([e.fen, e.loesung])));
const passt = (x) => x && x.fabrik === FABRIK_STAND && JSON.stringify(x.einst) === JSON.stringify(einstellungen());

function liesJsonl(datei) {
  if (!fs.existsSync(datei)) return [];
  const aus = [];
  for (const z of fs.readFileSync(datei, 'utf8').split('\n')) {
    if (!z.trim()) continue;
    try { aus.push(JSON.parse(z)); } catch (e) { /* halbe Zeile eines abgebrochenen Laufs */ }
  }
  return aus;
}

function liesCache(dateien) {
  const partien = new Map();
  const eigene = new Map();
  for (const d of dateien) {
    for (const x of liesJsonl(d)) {
      if (!passt(x)) continue;
      if (x.typ === 'partie' && Number.isInteger(x.nr) && !partien.has(x.nr)) partien.set(x.nr, x);
      if (x.typ === 'eigen' && typeof x.id === 'string') eigene.set(x.id + '|' + x.schluessel, x);
    }
  }
  return { partien, eigene };
}

async function rechnen({ cache, anzahl, teilK, teilN }) {
  const datei = cache[0];
  fs.mkdirSync(path.dirname(path.resolve(datei)), { recursive: true });
  const t0 = Date.now();
  if (teilK === 0) {
    const { eigene: fertigE } = liesCache(cache);
    for (const e of ladeEigene()) {
      if (fertigE.has(e.id + '|' + eigenSchluessel(e))) continue;
      const r = await rechneEigene(e);
      fs.appendFileSync(datei, JSON.stringify(r) + '\n');
      console.log(`eigen ${e.id}: ${r.ok ? 'ok ' + r.ende + (r.matt ? ' matt ' + r.matt : '') : 'NEIN ' + r.grund}`);
    }
  }
  const fertig = liesCache(cache).partien;
  const offen = [];
  for (let nr = 0; nr < anzahl; nr++) if (nr % teilN === teilK && !fertig.has(nr)) offen.push(nr);
  console.log(`${new Date().toISOString()} ${path.basename(datei)}: ${offen.length} Partien offen (Teil ${teilK}/${teilN})`);
  let n = 0;
  for (const nr of offen) {
    const t = Date.now();
    const r = await rechnePartie(nr);
    fs.appendFileSync(datei, JSON.stringify(r) + '\n');
    n++;
    console.log(`${new Date().toISOString()} Partie ${nr} ${r.weiss}-${r.schwarz}: ${r.zuege.length} Halbzuege, Vorfilter ${r.vorfilter}, `
      + `geprueft ${r.geprueft}, behalten ${r.raetsel.length} (${((Date.now() - t) / 1000).toFixed(1)} s; ${n}/${offen.length}, `
      + `gesamt ${((Date.now() - t0) / 60000).toFixed(1)} min)`);
  }
}

// ---------------------------------------------------------------------------
// Auswerten (ohne Engine)
// ---------------------------------------------------------------------------
const titelVon = (fen) => (new Chess(fen).turn() === 'w' ? 'Weiß am Zug' : 'Schwarz am Zug');

// Pool aus Cache und raetsel-eigene.json: [{ schluessel, fen, loesung, motiv, stufe, matt, partie, rang, ... }]
function baueVorrat(cache, anzahl) {
  const { partien, eigene } = liesCache(cache);
  const vorrat = [];
  let gezaehlt = 0;
  let kandidaten = 0;
  const fehlend = [];
  const eigeneListe = ladeEigene();
  for (const e of eigeneListe) {
    const x = eigene.get(e.id + '|' + eigenSchluessel(e));
    if (!x) { fehlend.push('eigen ' + e.id); continue; }
    kandidaten++;
    const ohne = pruefeEigeneOhneEngine(e);
    if (!x.ok || !ohne.ok) { console.log(`eigen ${e.id} faellt weg: ${x.grund || ohne.fehler.join(', ')}`); continue; }
    vorrat.push({ fen: e.fen, loesung: e.loesung, matt: x.matt, ende: x.ende, partie: null, elo: null, herkunft: 'eigen:' + e.id });
  }
  for (let nr = 0; nr < anzahl; nr++) {
    const p = partien.get(nr);
    if (!p) { fehlend.push('partie ' + nr); continue; }
    gezaehlt++;
    kandidaten += p.geprueft;
    const elo = (p.elo[0] + p.elo[1]) / 2;
    // je Partie hoechstens MAX_JE_PARTIE, bevorzugt Matt/Material, dann groesserer Abstand
    const liste = p.raetsel.slice().sort((a, b) => ((a.ende === 'bewertung') - (b.ende === 'bewertung')) || (b.abstand - a.abstand) || (a.ply - b.ply));
    const genommen = [];
    for (const r of liste) {
      if (genommen.length >= MAX_JE_PARTIE) break;
      if (genommen.some((g) => Math.abs(g.ply - r.ply) < 6)) continue;
      genommen.push(r);
    }
    for (const r of genommen) vorrat.push({ fen: r.fen, loesung: r.loesung, matt: r.matt, ende: r.ende, partie: nr, elo, herkunft: `partie ${nr} ply ${r.ply}` });
  }
  if (fehlend.length) console.log(`Noch nicht gerechnet: ${fehlend.length} (${fehlend.slice(0, 6).join(', ')}${fehlend.length > 6 ? ', ...' : ''})`);
  // doppelte Stellungen raus (die erste gewinnt: eigene vor Partien, Partien nach Nummer)
  const gesehen = new Set();
  const einzeln = [];
  for (const v of vorrat) {
    const k = stellungsSchluessel(v.fen);
    if (gesehen.has(k)) continue;
    gesehen.add(k);
    const m = merkmaleVon(v.fen, v.loesung);
    const { stufe, punkte } = stufeVon({ ...m, elo: v.elo });
    const motiv = motivVon(v.fen, v.loesung, v.matt);
    // zuerst die eigenen Lehr-Stellungen, dann Matt/Material mit Motiv, dann ohne Motiv, zuletzt Ende nach Bewertung
    const klasse = v.partie == null ? 0 : v.ende === 'bewertung' ? 3 : motiv ? 1 : 2;
    einzeln.push({ ...v, schluessel: k, motiv, stufe, punkte, merkmale: m, rang: klasse * 1e10 + (seedAus('rang/' + k) % 1e9) });
  }
  return { vorrat: einzeln, gezaehlt, kandidaten };
}

function schreibeDatei({ wochen, quelle, start, stand, aus }) {
  const tage = [];
  let nr = 0;
  const aufgabe = (e) => ({
    id: 'tr-' + String(++nr).padStart(4, '0'), fen: e.fen, loesung: e.loesung, motiv: e.motiv, stufe: e.stufe,
    matt: e.matt ?? null, titel: titelVon(e.fen),
  });
  for (const w of wochen) {
    for (let d = 0; d < 6; d++) tage.push({ aufgaben: [aufgabe(w[d])] });
    tage.push({ aufgaben: [aufgabe(w[6]), aufgabe(w[7])] });
  }
  const kopf = { art: 'tagesraetsel', format: 1, rechenstand: RECHENSTAND, stand, titel: 'Tagesraetsel, eigene Raetsel, mit Stockfish geprueft' };
  const text = `{\n "kopf": ${JSON.stringify(kopf)},\n "quelle": ${JSON.stringify(quelle)},\n "start": ${JSON.stringify(start)},\n "tage": [\n`
    + tage.map((t) => '  ' + JSON.stringify(t)).join(',\n') + '\n ]\n}\n';
  JSON.parse(text);
  fs.mkdirSync(path.dirname(aus), { recursive: true });
  fs.writeFileSync(aus, text);
  return { tage: tage.length, bytes: Buffer.byteLength(text) };
}

function auswerten({ cache, anzahl, aus, start, stand, wochenMax }) {
  const { vorrat, gezaehlt, kandidaten } = baueVorrat(cache, anzahl);
  const je = {};
  for (const v of vorrat) je[v.stufe] = (je[v.stufe] || 0) + 1;
  const motive = {};
  for (const v of vorrat) motive[v.motiv ?? 'null'] = (motive[v.motiv ?? 'null'] || 0) + 1;
  const enden = {};
  for (const v of vorrat) enden[v.ende] = (enden[v.ende] || 0) + 1;
  console.log(`Vorrat ${vorrat.length}: Stufen ${JSON.stringify(je)}, Motive ${JSON.stringify(motive)}, Ende ${JSON.stringify(enden)}`);
  const { wochen } = verteileTage(vorrat, { wochenMax });
  const quelle = { partien: gezaehlt, kandidaten, behalten: vorrat.length, engine: ENGINE_NAME, nodes: PRUEF_NODES };
  const r = schreibeDatei({ wochen, quelle, start, stand, aus });
  console.log(`${path.relative(WURZEL, aus)}: ${r.tage} Tage (${wochen.length} Wochen), ${r.bytes} Bytes`);
}

// ---------------------------------------------------------------------------
// Probe (ohne Engine, fuer tests/tagesraetsel-daten.test.mjs)
// ---------------------------------------------------------------------------
function probe() {
  const eigene = ladeEigene().map((e) => {
    const r = pruefeEigeneOhneEngine(e);
    const m = r.ok ? merkmaleVon(e.fen, e.loesung) : null;
    return { ...r, stufe: m ? stufeVon({ ...m, elo: null }).stufe : null };
  });
  // feste Liste: 200 erfundene Eintraege mit Stufe und Motiv aus einem Seed
  const liste = [];
  for (let i = 0; i < 200; i++) {
    const h = seedAus('probe/' + i);
    liste.push({
      schluessel: 'probe-' + String(i).padStart(3, '0'), stufe: 1 + (h % 7), motiv: [...MOTIVE, null][(h >>> 3) % 7],
      partie: (h >>> 7) % 40, rang: (h >>> 11) % 1000,
    });
  }
  const { wochen } = verteileTage(liste, { wochenMin: WOCHEN_MIN, wochenMax: WOCHEN_MAX });
  return {
    eigene,
    wochen: wochen.map((w) => w.map((e) => `${e.schluessel}/${e.stufe}/${e.motiv ?? '-'}`)),
    stufen: { schwellen: STUFEN_SCHWELLEN, beispiele: [[1, 0, false, 700], [2, 3, false, 1300], [3, 5, true, 2100], [4, 8, true, 2100]]
      .map(([z, f, r, e]) => stufeVon({ eigeneZuege: z, fehlzuege: f, ruhig: r, elo: e })) },
  };
}

// ---------------------------------------------------------------------------
// Aufruf
// ---------------------------------------------------------------------------
const istHaupt = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (istHaupt) {
  try {
    if (arg('probe', false) === true) {
      process.stdout.write(JSON.stringify(probe(), null, 1) + '\n');
    } else {
      const cache = String(arg('cache', '')).split(',').filter(Boolean);
      if (!cache.length) {
        console.error('Aufruf: node werkzeuge/raetsel-fabrik.mjs --cache=<partien.jsonl> [--teil=k/n --nur-rechnen | --auswerten] [--partien=N] | --probe');
        process.exit(2);
      }
      const anzahl = Number(arg('partien', PARTIEN_STANDARD));
      const [teilK, teilN] = String(arg('teil', '0/1')).split('/').map(Number);
      const start = arg('start', START_STANDARD);
      const stand = arg('stand', STAND_STANDARD);
      if (!istSchluessel(start) || wochentag(start) !== 0) throw new Error('--start muss ein Montag sein (JJJJ-MM-TT)');
      if (!istSchluessel(stand)) throw new Error('--stand ist kein Datum');
      if (!Number.isInteger(anzahl) || anzahl < 1 || !(teilN >= 1) || !(teilK >= 0 && teilK < teilN)) throw new Error('--partien oder --teil ungueltig');
      if (arg('auswerten', false) !== true) await rechnen({ cache, anzahl, teilK, teilN });
      if (arg('nur-rechnen', false) !== true) {
        auswerten({
          cache, anzahl, start, stand, wochenMax: Number(arg('wochen', WOCHEN_MAX)),
          aus: path.resolve(WURZEL, arg('aus', 'daten/tagesraetsel/raetsel.json')),
        });
      }
    }
  } catch (e) {
    console.error('FEHLER', e && e.stack || e);
    process.exitCode = 1;
  } finally {
    alleBeenden();
  }
  process.exit(process.exitCode || 0);
}
