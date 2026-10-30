// Bewertung: Zug-Klassen, Genauigkeit, Coach-Texte, Spielanalyse.
// Rein, ohne DOM (laeuft auch in Node). Bewertungen {cp, mate} immer aus Sicht von Weiss.
// API siehe ARCHITEKTUR.md (js/review.js). Zusaetze Runde 4:
//   Zug-Eintrag zusaetzlich mit gewinnZweiter (Gewinnchance des zweitbesten Zugs, 0..1 oder null)
//     und trivial (selbstverstaendlicher Zug: Schlagen auf dem Feld, auf das der Gegner gerade
//     gezogen hat, oder Schachabwehr mit hoechstens 3 erlaubten Zuegen; die COMBO zaehlt ihn neutral)
//   spielphasen(fens, buchEnde) -> [{ name: 'Eröffnung'|'Mittelspiel'|'Endspiel', von, bis }]
//   coachKern(text) -> Coach-Satz ohne Klassenwort am Anfang, Gedankenstriche als Doppelpunkt,
//     Rochade als 0-0 (die einzige Stelle, die die Klassenwoerter der Coach-Texte kennt)
//   kompaktReview(review) / ergaenzeReviewFelder(review): Review ohne die ableitbaren Felder
//     (sanDe, besterZugSanDe, besteLinieSan, nummer, fenNachher ausser beim letzten Zug) und zurueck
// Zusaetze w0-fix:
//   seitenGenauigkeit(eintraege, farbe, plies) -> Genauigkeit einer Seite aus Zug-Eintraegen (Live-Bewertung)
//     nach demselben Verfahren wie analysierePartie (volatilitaetsgewichtet)
//   analysierePartie(..., { stueckeln: true }) gibt beim Einordnen der Zuege den Hauptthread frei (Nachholen)
// Englische Version (Teil 1): Coach-Saetze als ganze Saetze mit Platzhaltern aus js/sprachen/analyse.js (coach.*),
//   in der Sprache beim Erzeugen. sanAnzeige(san): SAN in der eingestellten Sprache (Deutsch = sanDeutsch). Gespeicherte
//   Daten bleiben wie bisher: notiz, spielphasen-Namen, eroeffnung, sanDe/besterZugSanDe/besteLinieSan (deutsch).
import { Chess } from '../vendor/chess/chess.js';
import { eroeffnung, stellungsSchluessel, eroeffnungsAnzeige } from './openings.js';
import { KLASSEN_NAME, KLASSEN_WORT, ALTE_WOERTER, klassenWoerterAllerSprachen } from './zugklassen.js';
import { t, sprache } from './sprache.js';
import './sprachen/allgemein.js';
import './sprachen/analyse.js';

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

// Reihenfolge fuer Zusammenfassungen (gut nach schlecht)
export const KLASSEN = ['brillant', 'stark', 'bester', 'exzellent', 'gut', 'buch',
  'ungenau', 'fehler', 'verpasst', 'patzer', 'erzwungen'];

export const KLASSEN_NAMEN = KLASSEN_NAME;

// Grenzen fuer den Erwartungsverlust (Gewinnchance 0..1, Sicht des Ziehenden)
export const GRENZEN = { exzellent: 0.02, gut: 0.05, ungenau: 0.10, fehler: 0.20 };

// Untergrenze in Centipawn (Sicht des Ziehenden), wenn die Gewinnchance gesaettigt ist: Steht man schon klar
// schlechter, kostet eine weitere Dame kaum noch Gewinnchance (-8 -> -17: 5 %). Ab hier ist es trotzdem
// mindestens Fehler bzw. Patzer. Die Schwelle waechst mit der Bewertung, weil Suchen in einseitigen Stellungen
// staerker streuen (BODEN_STREUUNG je cp ueber BODEN_STREUUNG_AB).
export const BODEN_CP = { fehler: 300, patzer: 600 };
const BODEN_STREUUNG = 0.10;
const BODEN_STREUUNG_AB = 400;
// Wer danach immer noch klar gewinnt (ab +5), bekommt hoechstens "ungenau"
const BODEN_GEWONNEN_CP = 500;
// So viel Gewinnchance zaehlt ein angehobener Zug mindestens (fuer Genauigkeit und Kartei)
const BODEN_VERLUST = { ungenau: GRENZEN.gut + 0.01, fehler: GRENZEN.ungenau + 0.01, patzer: GRENZEN.fehler + 0.01 };

const EPS = 1e-9;
const K_LICHESS = 0.00368208;
const WERT = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const ANGREIFER_WERT = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };
// Figur im Nominativ fuer die (gespeicherte) Notiz eines genialen Zugs; Coach-Saetze nehmen figurText()
const NOM = { p: 'der Bauer', n: 'der Springer', b: 'der Läufer', r: 'der Turm', q: 'die Dame', k: 'der König' };
const FEHLERKLASSEN = ['fehler', 'patzer', 'verpasst'];

// ---------------------------------------------------------------------------
// Grundfunktionen
// ---------------------------------------------------------------------------

// Gewinnchance 0..1 fuer farbe ('w'|'b') nach Lichess; Matt = 1 bzw. 0
export function gewinnChance(ev, farbe = 'w') {
  let p = 0.5;
  if (ev && ev.mate != null) p = ev.mate > 0 ? 1 : ev.mate < 0 ? 0 : 0.5;
  else if (ev && typeof ev.cp === 'number' && isFinite(ev.cp)) {
    p = 0.5 + 0.5 * (2 / (1 + Math.exp(-K_LICHESS * ev.cp)) - 1);
  }
  return farbe === 'b' ? 1 - p : p;
}

// Lichess-Zuggenauigkeit; Eingaben als Gewinnchance 0..1 (Werte > 1 gelten als Prozent)
export function zugGenauigkeit(winVorher, winNachher) {
  let v = Number(winVorher);
  let n = Number(winNachher);
  if (!isFinite(v) || !isFinite(n)) return null;
  if (v > 1 || n > 1) { v /= 100; n /= 100; }
  const diff = (v - n) * 100;
  if (diff <= 0) return 100;
  const roh = 103.1668 * Math.exp(-0.04354 * diff) - 3.1669;
  return Math.max(0, Math.min(100, roh));
}

// Gewichte je Zug aus der Schwankung der Gewinnchance (Lichess-Verfahren).
// gewinnWeiss: Gewinnchancen (0..1, Sicht Weiss) aller Stellungen, Laenge = Zuege + 1
export function volatilitaetsGewichte(gewinnWeiss) {
  const werte = (gewinnWeiss || []).map((x) => (x > 1 ? x : x * 100));
  const zuege = werte.length - 1;
  if (zuege <= 0) return [];
  const fenster = Math.max(2, Math.min(8, Math.floor(zuege / 10)));
  const liste = [];
  const erstes = werte.slice(0, fenster);
  for (let i = 0; i < fenster - 2; i++) liste.push(erstes);
  if (werte.length <= fenster) liste.push(werte.slice());
  else for (let i = 0; i + fenster <= werte.length; i++) liste.push(werte.slice(i, i + fenster));
  return liste.slice(0, zuege).map((f) => {
    const m = f.reduce((a, b) => a + b, 0) / f.length;
    const sd = Math.sqrt(f.reduce((a, b) => a + (b - m) ** 2, 0) / f.length);
    return Math.max(0.5, Math.min(12, sd));
  });
}

// Partie-Genauigkeit: Mittel aus gewichtetem und harmonischem Mittel (Lichess).
// liste: Zahlen (Zuggenauigkeiten) oder { genauigkeit, gewicht }
export function partieGenauigkeit(liste) {
  const eintraege = (liste || [])
    .map((x) => (typeof x === 'number' ? { g: x, w: 1 } : { g: x?.genauigkeit, w: x?.gewicht ?? 1 }))
    .filter((x) => typeof x.g === 'number' && isFinite(x.g));
  if (!eintraege.length) return null;
  const summeW = eintraege.reduce((a, x) => a + x.w, 0);
  const gewichtet = summeW > 0
    ? eintraege.reduce((a, x) => a + x.g * x.w, 0) / summeW
    : eintraege.reduce((a, x) => a + x.g, 0) / eintraege.length;
  const harmonisch = eintraege.length / eintraege.reduce((a, x) => a + 1 / Math.max(1, x.g), 0);
  return Math.max(0, Math.min(100, (gewichtet + harmonisch) / 2));
}

// Genauigkeit einer Seite aus einzelnen Zug-Eintraegen (z. B. der Live-Bewertung), nach demselben Verfahren
// wie analysierePartie (volatilitaetsgewichtet + harmonisch, auf eine Nachkommastelle).
// eintraege: Liste je Ply (Eintraege mit farbe, genauigkeit, evalVorher, evalNachher; fehlende Plies
// null), plies: Anzahl der Halbzuege der Partie. Die Kurve der Gewinnchancen setzt sich aus evalVorher und
// evalNachher zusammen; Stellungen ohne Bewertung (z. B. vor dem ersten Bot-Zug) uebernehmen den naechsten
// bekannten Wert. Mit allen Eintraegen einer Analyse ergibt das genau review.genauigkeit[farbe].
// Fehlt einem Zug der Seite die Genauigkeit oder hat die Seite keinen Zug: null.
export function seitenGenauigkeit(eintraege, farbe, plies = (eintraege || []).length) {
  const liste = eintraege || [];
  const n = Math.max(plies, liste.length);
  const kurve = new Array(n + 1).fill(null);
  for (let i = 0; i < liste.length; i++) {
    const e = liste[i];
    if (!e) continue;
    if (e.evalVorher) kurve[i] = gewinnChance(e.evalVorher, 'w');
    if (e.evalNachher) kurve[i + 1] = gewinnChance(e.evalNachher, 'w');
  }
  let letzter = null;
  for (let i = 0; i <= n; i++) {
    if (kurve[i] == null) kurve[i] = letzter;
    else letzter = kurve[i];
  }
  letzter = null;
  for (let i = n; i >= 0; i--) {
    if (kurve[i] == null) kurve[i] = letzter;
    else letzter = kurve[i];
  }
  if (kurve.some((x) => x == null)) return null;
  const gewichte = volatilitaetsGewichte(kurve);
  const eigene = [];
  for (let i = 0; i < liste.length; i++) {
    const e = liste[i];
    if (!e || e.farbe !== farbe) continue;
    if (typeof e.genauigkeit !== 'number' || !isFinite(e.genauigkeit)) return null;
    eigene.push({ genauigkeit: e.genauigkeit, gewicht: gewichte[i] ?? 1 });
  }
  const g = partieGenauigkeit(eigene);
  return g == null ? null : runde(g, 1);
}

// Grobe Schaetzung der Spielstaerke einer Partie (wie "Game Rating" bei chess.com)
const ELO_TABELLE = [[0, 100], [20, 200], [40, 400], [50, 550], [60, 750], [70, 1000], [75, 1150],
  [80, 1350], [85, 1600], [90, 1900], [94, 2250], [97, 2600], [100, 3000]];

// Bots spielen anders als Menschen (seltene grobe Fehlzuege, sonst fast Engine-Zuege) und erreichen
// deshalb bei gleicher Staerke eine viel hoehere Genauigkeit. Tabelle aus den Medianen von
// 80 Bot-gegen-Bot-Partien (Tiefe 14, MultiPV 2), monoton angepasst.
const ELO_TABELLE_BOT = [[0, 100], [50, 150], [60, 200], [66, 250], [72, 350], [76, 500], [78, 750], [80, 1000],
  [83, 1300], [86, 1600], [88, 1800], [91, 2000], [93, 2150], [96, 2500], [100, 3000]];

function ausTabelle(tabelle, g) {
  for (let i = 1; i < tabelle.length; i++) {
    const [g0, e0] = tabelle[i - 1];
    const [g1, e1] = tabelle[i];
    if (g <= g1) return e0 + ((g - g0) / (g1 - g0)) * (e1 - e0);
  }
  return tabelle[tabelle.length - 1][1];
}

// Leistung wie im Turnier (Flo, 30.10.2026: "Ich spiele viel schlechter als 2000 Elo", die Analyse zeigte "Leistung ≈ 2500"
// nach einem Sieg gegen einen schwachen Bot): gegen einen schwaecheren Gegner sind 97 % Genauigkeit leicht, weil seine Fehler
// einfach zu bestrafen sind. Ist die Gegnerstaerke bekannt, bleibt die Schaetzung deshalb an ihr: hoechstens LEISTUNG_UEBER
// darueber (wie ein Turniersieg, Leistung = Gegner + 400) und hoechstens LEISTUNG_UNTER darunter.
export const LEISTUNG_UEBER = 400;
export const LEISTUNG_UNTER = 500;
export function begrenzeLeistung(elo, gegnerElo) {
  if (typeof elo !== 'number' || !isFinite(elo)) return null;
  if (typeof gegnerElo !== 'number' || !isFinite(gegnerElo)) return elo;
  return gegnerElo + Math.max(-LEISTUNG_UNTER, Math.min(LEISTUNG_UEBER, elo - gegnerElo));
}

// anzahlZuege (optional): eigene Zuege; unter 20 wird zur Mitte (Gegner-Elo bzw. 1000) gezogen.
// { eigeneElo } (optional, fuer Bots): Bot-Tabelle, halber Weg zur eigenen Elo (eine Partie
// streut stark), kurze Partien zur eigenen Elo statt zur Mitte.
export function schaetzeSpielstaerke(genauigkeit, gegnerElo, anzahlZuege, { eigeneElo } = {}) {
  if (typeof genauigkeit !== 'number' || !isFinite(genauigkeit)) return null;
  const g = Math.max(0, Math.min(100, genauigkeit));
  const kurz = typeof anzahlZuege === 'number' && anzahlZuege >= 0 && anzahlZuege < 20;
  let elo;
  if (typeof eigeneElo === 'number' && isFinite(eigeneElo)) {
    elo = eigeneElo + 0.5 * (ausTabelle(ELO_TABELLE_BOT, g) - eigeneElo);
    if (kurz) elo = (anzahlZuege / 20) * elo + (1 - anzahlZuege / 20) * eigeneElo;
    return Math.max(100, Math.min(3200, Math.round(elo / 50) * 50));
  }
  elo = ausTabelle(ELO_TABELLE, g);
  const gegnerBekannt = typeof gegnerElo === 'number' && isFinite(gegnerElo);
  if (gegnerBekannt) elo = begrenzeLeistung(elo, gegnerElo);
  if (kurz) {
    const w = anzahlZuege / 20;
    elo = w * elo + (1 - w) * (gegnerBekannt ? gegnerElo : 1000);
  }
  return Math.max(100, Math.min(3200, Math.round(elo / 50) * 50));
}

// SAN auf Deutsch: K D T L S statt K Q R B N, Rochade mit Nullen (0-0, 0-0-0)
export function sanDeutsch(san) {
  if (san == null) return '';
  return String(san).replace(/[KQRBN]/g, (c) => ({ K: 'K', Q: 'D', R: 'T', B: 'L', N: 'S' }[c]))
    .replace(/O-O-O/g, '0-0-0').replace(/O-O/g, '0-0');
}

// SAN fuer die Anzeige in der eingestellten Sprache. Deutsch: genau sanDeutsch. Englisch: K Q R B N (auch aus
// deutscher SAN, z. B. gespeicherter besteLinieSan), Rochade wie im Deutschen mit Nullen (0-0, 0-0-0).
export function sanAnzeige(san) {
  if (sprache() === 'de') return sanDeutsch(san);
  if (san == null) return '';
  return String(san).replace(/[DTLS]/g, (c) => ({ D: 'Q', T: 'R', L: 'B', S: 'N' }[c]))
    .replace(/O-O-O/g, '0-0-0').replace(/O-O/g, '0-0');
}

// Material Weiss minus Schwarz in Bauerneinheiten (B1 S3 L3 T5 D9)
export function materialBilanz(fen) {
  const brett = String(fen || '').trim().split(/\s+/)[0] || '';
  let summe = 0;
  for (const ch of brett) {
    const w = WERT[ch.toLowerCase()];
    if (w) summe += ch === ch.toUpperCase() ? w : -w;
  }
  return summe;
}

// ---------------------------------------------------------------------------
// Schach-Hilfen
// ---------------------------------------------------------------------------

function istUci(z) {
  return typeof z === 'string' && /^[a-h][1-8][a-h][1-8][qrbnQRBN]?$/.test(z);
}

function spieleUci(chess, uci) {
  if (!istUci(uci)) return null;
  try {
    return chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] ? uci[4].toLowerCase() : undefined });
  } catch (e) {
    return null;
  }
}

// Zug als UCI, SAN oder {from, to, promotion} / {uci}
function spieleZug(chess, zug) {
  if (zug && typeof zug === 'object') {
    if (zug.uci) return spieleUci(chess, zug.uci);
    try { return chess.move({ from: zug.from, to: zug.to, promotion: zug.promotion }); } catch (e) { return null; }
  }
  const m = spieleUci(chess, zug);
  if (m) return m;
  try { return chess.move(String(zug)); } catch (e) { return null; }
}

function neuesBrett(fen) {
  try { return new Chess(fen); } catch (e) { return null; }
}

function gegnerVon(farbe) {
  return farbe === 'w' ? 'b' : 'w';
}

// Matt-Zahl aus Sicht von farbe: >0 farbe setzt matt in n, <0 farbe wird matt in n
function mattFuer(ev, farbe) {
  if (!ev || ev.mate == null || ev.mate === 0) return null;
  return farbe === 'w' ? ev.mate : -ev.mate;
}

function cpFuer(ev, farbe) {
  if (!ev || typeof ev.cp !== 'number') return null;
  return farbe === 'w' ? ev.cp : -ev.cp;
}

// Spielt zuege ab fen und zaehlt Material aus Sicht von farbe. Laeuft mindestens
// 'min' Halbzuege und verlaengert, solange zuletzt geschlagen wurde (ruhiges Ende).
// Umwandlungen stehen getrennt in 'umwandlungen' (nie als Bauernzahl): Wird die neue Figur
// geschlagen, zaehlt das wie ein geschlagener Bauer.
function materialFolge(fen, zuege, farbe, { min = 6, max = 10 } = {}) {
  const c = neuesBrett(fen);
  const ergebnis = { saldo: 0, verloren: [], gewonnen: [], schritte: [], umwandlungen: [] };
  if (!c) return ergebnis;
  const liste = (zuege || []).slice(0, max);
  for (let i = 0; i < liste.length; i++) {
    const letzter = ergebnis.schritte[i - 1];
    if (i >= min && !(letzter && letzter.captured)) break;
    const m = spieleUci(c, liste[i]);
    if (!m) break;
    const eigener = m.color === farbe;
    const delta = (m.captured ? WERT[m.captured] : 0) + (m.promotion ? WERT[m.promotion] - 1 : 0);
    // neue Figur aus einer Umwandlung: zieht sie weiter, wandert die Marke mit
    const neueFigur = ergebnis.umwandlungen.find((u) => u.feld === m.from);
    if (neueFigur) neueFigur.feld = m.to;
    if (m.captured) {
      const geschlagen = ergebnis.umwandlungen.findIndex((u) => u.feld === m.to && u.eigener !== eigener);
      const figur = geschlagen >= 0 ? 'p' : m.captured;
      if (geschlagen >= 0) ergebnis.umwandlungen.splice(geschlagen, 1);
      (eigener ? ergebnis.gewonnen : ergebnis.verloren).push({ figur, feld: m.to, san: m.san, ply: i });
    }
    if (m.promotion) ergebnis.umwandlungen.push({ eigener, figur: m.promotion, feld: m.to, san: m.san, ply: i });
    ergebnis.saldo += eigener ? delta : -delta;
    ergebnis.schritte.push({ san: m.san, captured: m.captured || null, saldo: ergebnis.saldo, farbe: m.color });
  }
  // gleichwertige Abtausche gegeneinander aufheben
  const v = [...ergebnis.verloren].sort((a, b) => WERT[b.figur] - WERT[a.figur]);
  const g = [...ergebnis.gewonnen].sort((a, b) => WERT[b.figur] - WERT[a.figur]);
  for (let i = v.length - 1; i >= 0; i--) {
    const j = g.findIndex((x) => WERT[x.figur] === WERT[v[i].figur]);
    if (j >= 0) {
      v.splice(i, 1);
      g.splice(j, 1);
    }
  }
  ergebnis.restVerloren = v;
  ergebnis.restGewonnen = g;
  return ergebnis;
}

// Beste Schlagmoeglichkeit des Gegners (am Zug in c) auf eine Figur von farbe (optional nur
// auf feld): Gewinn = Wert der Figur minus Wert des Schlaegers, falls zurueckgeschlagen werden kann.
function haengendeFigur(c, farbe, feld = null) {
  let beste = null;
  for (const m of c.moves({ verbose: true })) {
    if (!m.captured || m.captured === 'p' || m.captured === 'k') continue;
    if (feld && m.to !== feld) continue;
    let zurueck = false;
    try {
      c.move({ from: m.from, to: m.to, promotion: m.promotion });
      zurueck = c.moves({ verbose: true }).some((r) => r.to === m.to && r.captured && r.color === farbe);
      c.undo();
    } catch (e) {
      continue;
    }
    const gewinn = WERT[m.captured] - (zurueck ? WERT[m.piece] : 0);
    if (!beste || gewinn > beste.gewinn) beste = { gewinn, figur: m.captured, feld: m.to, san: m.san };
  }
  return beste;
}

// Opfer-Pruefung fuer die gezogene Figur (Figur, nicht Bauer):
// a) der Gegner schlaegt sie sofort und der Ziehende liegt danach mindestens 2 Bauerneinheiten
//    zurueck, auch noch in den folgenden 3 Halbzuegen der Hauptvariante (kein blosser Abtausch);
// b) sie steht nach dem Zug im Schlag (Gewinn fuer den Gegner >= 2), der Gegner nimmt aber nicht.
function findeOpfer(fenVorher, uci, pvNachher, farbe) {
  const c = neuesBrett(fenVorher);
  if (!c) return null;
  const zug = spieleUci(c, uci);
  if (!zug) return null;
  if (c.isGameOver()) return null;
  const genommen = zug.captured ? WERT[zug.captured] : 0;
  // Verzweiflungszug: stand die Figur schon vorher verloren, ist es kein echtes Opfer
  const schonVerloren = haengtVorher(fenVorher, zug.from, farbe);
  const folge = materialFolge(fenVorher, [uci, ...(pvNachher || [])], farbe, { min: 5, max: 5 });
  const antwort = folge.schritte[1];
  if (antwort && antwort.captured && antwort.captured !== 'p') {
    const v = folge.verloren.find((x) => x.ply === 1);
    if (v && v.feld === zug.to) {
      const minimum = Math.min(...folge.schritte.slice(1, 5).map((s) => -s.saldo));
      if (minimum >= 2 && minimum > schonVerloren && !totNachSchlag(c, pvNachher[0])) {
        return { art: 'pv', figur: antwort.captured, feld: zug.to, wert: minimum, schlagzug: antwort.san };
      }
    }
    return null;
  }
  const h = haengendeFigur(c, farbe, zug.to);
  const wert = h ? h.gewinn - genommen : 0;
  if (h && wert >= 2 && wert > schonVerloren && !totNachSchlag(c, h.san)) return { art: 'haengt', figur: h.figur, feld: h.feld, wert };
  return null;
}

// Nimmt der Gegner das Opfer an und bleibt danach zu wenig Material (totes Remis)? Kein Opfer.
function totNachSchlag(c, zug) {
  let m = null;
  try { m = istUci(zug) ? spieleUci(c, zug) : c.move(zug); } catch (e) { m = null; }
  if (!m) return false;
  const tot = c.isInsufficientMaterial();
  c.undo();
  return tot;
}

// Was haette der Gegner gewonnen, wenn er vor dem Zug am Zug gewesen waere (Nullzug)?
function haengtVorher(fenVorher, feld, farbe) {
  const c0 = neuesBrett(fenVorher);
  if (!c0 || c0.inCheck()) return 0;
  const teile = fenVorher.trim().split(/\s+/);
  teile[1] = teile[1] === 'w' ? 'b' : 'w';
  teile[3] = '-';
  const cn = neuesBrett(teile.join(' '));
  if (!cn) return 0;
  const h = haengendeFigur(cn, farbe, feld);
  return h ? Math.max(0, h.gewinn) : 0;
}

// "Selbstverstaendliche" Zuege, die nicht als stark (Grossartig) zaehlen:
// Zurueckschlagen, Schlagen einer ungedeckten oder wertvolleren Figur, Flucht einer bedrohten Figur.
function selbstverstaendlich(fenVorher, zug, vorigerZug, farbe) {
  if (!zug) return false;
  if (zug.captured && vorigerZug && zug.to === String(vorigerZug).slice(2, 4)) return true;
  const c = neuesBrett(fenVorher);
  if (!c) return false;
  // Schach abwehren mit hoechstens drei erlaubten Zuegen sieht jeder
  if (c.inCheck() && c.moves().length <= 3) return true;
  const gegner = gegnerVon(farbe);
  if (zug.captured) {
    if (WERT[zug.captured] > WERT[zug.piece]) return true;
    try {
      c.move({ from: zug.from, to: zug.to, promotion: zug.promotion });
      const gedeckt = c.moves({ verbose: true }).some((r) => r.to === zug.to && r.captured);
      c.undo();
      if (!gedeckt) return true;
    } catch (e) { /* egal */ }
  }
  if (zug.piece !== 'p' && zug.piece !== 'k') {
    let angreifer = [];
    try { angreifer = c.attackers(zug.from, gegner) || []; } catch (e) { angreifer = []; }
    if (angreifer.length) {
      const billigster = Math.min(...angreifer.map((f) => ANGREIFER_WERT[c.get(f)?.type] ?? 100));
      const gedeckt = c.isAttacked(zug.from, farbe);
      if (!gedeckt || billigster < WERT[zug.piece]) return true;
    }
  }
  return false;
}

// Schlaegt der Zug auf dem Feld zurueck, auf dem der Gegner gerade geschlagen hat?
function istRueckschlag(d, zug) {
  return !!(zug && zug.captured && d.vorigerSchlag && d.vorigerZug && zug.to === String(d.vorigerZug).slice(2, 4));
}

// Selbstverstaendlicher Zug (Eintrag "trivial", fuer die COMBO neutral wie ein Theoriezug): wie in
// selbstverstaendlich() das Schlagen auf dem Feld, auf das der Gegner gerade gezogen hat, oder die
// Schachabwehr mit hoechstens drei erlaubten Zuegen; ausserdem jedes echte Zurueckschlagen.
function trivialerZug(d) {
  const zug = d.zug;
  if (!zug) return false;
  if (zug.captured && d.vorigerZug && zug.to === String(d.vorigerZug).slice(2, 4)) return true;
  if (istRueckschlag(d, zug)) return true;
  const c = d.fenVorher ? neuesBrett(d.fenVorher) : null;
  return !!(c && c.inCheck() && c.moves().length <= 3);
}

function pvAlsSan(fen, pv, max = 8) {
  const c = neuesBrett(fen);
  const aus = [];
  if (!c) return aus;
  for (const u of (pv || []).slice(0, max)) {
    const m = spieleUci(c, u);
    if (!m) break;
    aus.push(m.san);
  }
  return aus;
}

// ---------------------------------------------------------------------------
// Eingabe vorbereiten (fuer klassifiziere und coachText)
// ---------------------------------------------------------------------------
//
// eingabe = {
//   fenVorher, uci (oder san), farbe?, fenNachher?,
//   evalVorher, evalNachher, evalZweiter?,     // Sicht Weiss; evalVorher = bester Zug
//   besterZug?, pvVorher?, pvNachher?,          // UCI; pvNachher beginnt mit dem Gegnerzug
//   buch?, eroeffnung?, gegnerKlasse? | gegnerFehler?, vorigerZug?, anzahlZuege?, du?
//   // alternativ: analyseVorher / analyseNachher (Engine-Analyse-Objekte)
// }
function vorbereiten(e = {}) {
  const aV = e.analyseVorher || null;
  const aN = e.analyseNachher || null;
  const evalVorher = e.evalVorher ?? aV?.lines?.[0]?.eval ?? null;
  const evalNachher = e.evalNachher ?? aN?.lines?.[0]?.eval ?? null;
  const evalZweiter = e.evalZweiter !== undefined ? e.evalZweiter : (aV?.lines?.[1]?.eval ?? null);
  const pvVorher = e.pvVorher ?? aV?.lines?.[0]?.pv ?? [];
  const pvNachher = e.pvNachher ?? aN?.lines?.[0]?.pv ?? [];
  const besterZug = e.besterZug ?? pvVorher[0] ?? aV?.bestmove ?? null;
  const fenVorher = e.fenVorher ?? aV?.fen ?? null;

  const d = {
    fenVorher, fenNachher: e.fenNachher ?? aN?.fen ?? null,
    farbe: [e.farbe, String(fenVorher || '').split(' ')[1]].find((f) => f === 'w' || f === 'b') || 'w',
    uci: e.uci ?? null, san: e.san ?? null, zug: null,
    evalVorher, evalNachher, evalZweiter, pvVorher, pvNachher, besterZug,
    besterSan: null, anzahl: e.anzahlZuege ?? null,
    matt: false, patt: false,
    buch: !!e.buch, eroeffnung: e.eroeffnung ?? null,
    gegnerFehler: e.gegnerFehler ?? FEHLERKLASSEN.includes(e.gegnerKlasse),
    vorigerZug: null,
    vorigerSchlag: false,
    du: e.du !== false,
  };

  // voriger Gegnerzug: UCI-Text oder chess.js-Zug ({ lan, to, captured })
  const vz = e.vorigerZug;
  if (vz && typeof vz === 'object') {
    d.vorigerZug = vz.lan || (vz.from && vz.to ? vz.from + vz.to : null);
    d.vorigerSchlag = e.vorigerSchlag ?? !!vz.captured;
  } else if (typeof vz === 'string') {
    d.vorigerZug = vz;
    d.vorigerSchlag = !!e.vorigerSchlag;
  }

  const c = fenVorher ? neuesBrett(fenVorher) : null;
  if (c) {
    d.farbe = c.turn();
    if (d.anzahl == null) d.anzahl = c.moves().length;
    if (besterZug) {
      const b = spieleUci(c, besterZug);
      if (b) {
        d.besterSan = b.san;
        c.undo();
      }
    }
    const m = d.uci ? spieleUci(c, d.uci) : (d.san ? spieleZug(c, d.san) : null);
    if (m) {
      d.zug = m;
      d.uci = m.lan;
      d.san = m.san;
      d.fenNachher = c.fen();
      d.matt = c.isCheckmate();
      d.patt = c.isStalemate();
    }
  }
  d.istBester = !!(d.uci && besterZug && d.uci === besterZug);
  d.wv = gewinnChance(evalVorher, d.farbe);
  d.wn = gewinnChance(evalNachher, d.farbe);
  d.w2 = evalZweiter ? gewinnChance(evalZweiter, d.farbe) : null;
  d.mattVorher = mattFuer(evalVorher, d.farbe);
  d.mattNachher = mattFuer(evalNachher, d.farbe);
  return d;
}

// ---------------------------------------------------------------------------
// Klassifizierung
// ---------------------------------------------------------------------------

function nachSchwelle(verlust) {
  if (verlust <= GRENZEN.exzellent + EPS) return 'exzellent';
  if (verlust <= GRENZEN.gut + EPS) return 'gut';
  if (verlust <= GRENZEN.ungenau + EPS) return 'ungenau';
  if (verlust <= GRENZEN.fehler + EPS) return 'fehler';
  return 'patzer';
}

const RANG = { exzellent: 0, gut: 1, ungenau: 2, fehler: 3, verpasst: 3, patzer: 4 };

export function klassifiziere(eingabe) {
  const d = vorbereiten(eingabe);
  const roh = Math.max(0, d.wv - d.wn);
  const ergebnis = (klasse, verlust, notiz, extra = {}) => ({
    klasse, verlust, notiz, details: { ...d, verlustRoh: roh, ...extra },
  });

  // 1. einziger legaler Zug
  if (d.anzahl === 1) return ergebnis('erzwungen', 0, 'einziger legaler Zug');

  // 2. Theoriezug (nur, wenn die Engine ihn nicht als grober Fehlzug sieht)
  const basis = nachSchwelle(roh);
  if (d.buch && basis !== 'patzer') return ergebnis('buch', roh, d.eroeffnung || 'Eröffnungstheorie');

  const fastBester = d.istBester || roh <= GRENZEN.exzellent + EPS;

  // 3. brillant: (fast) bester Zug mit Figurenopfer, danach weiter gut, vorher nicht schon klar gewonnen.
  // "Vorher" misst die beste Alternative, wenn der Opferzug selbst der Engine-Zug ist.
  if (fastBester && d.fenVorher && d.uci && d.wn >= 0.5 - EPS) {
    const ref = d.istBester && d.w2 != null ? Math.min(d.wv, d.w2) : d.wv;
    if (ref < 0.95) {
      const opfer = findeOpfer(d.fenVorher, d.uci, d.pvNachher, d.farbe);
      if (opfer) {
        return ergebnis('brillant', d.istBester ? 0 : roh, `Opfer: ${NOM[opfer.figur]}`, { opfer });
      }
    }
  }

  // 4. stark: einziger guter Zug (zweitbester >= 0.10 schlechter), Stellung offen
  if (d.istBester && d.w2 != null && d.wv > 0.03 && d.wv < 0.97 && d.wv - d.w2 >= 0.10 - EPS) {
    if (!selbstverstaendlich(d.fenVorher, d.zug, d.vorigerZug, d.farbe)) {
      return ergebnis('stark', 0, 'einziger guter Zug', { abstand: d.wv - d.w2 });
    }
  }

  // Matt in hoechstens 3 ausgelassen und danach kein Matt mehr ("Miss" bei chess.com):
  // mindestens "Verschenkt", auch wenn die Stellung gewonnen bleibt
  const mattVerpasst = !d.istBester && !d.matt && d.mattVorher != null && d.mattVorher > 0 && d.mattVorher <= 3
    && !(d.mattNachher != null && d.mattNachher > 0);
  const mattNotiz = mattVerpasst ? `Matt in ${d.mattVorher} verpasst` : '';

  // 5. bester Zug: der Engine-Zug oder ein anderer Zug mit wirklich gleicher Bewertung
  if (d.istBester) return ergebnis('bester', 0, 'Engine-Zug');
  if (roh <= EPS) {
    if (mattVerpasst) return ergebnis('verpasst', roh, mattNotiz);
    // Matt-Saettigung: beide Bewertungen Matt fuer dieselbe Seite -> Mattlaenge vergleichen
    const mv = d.mattVorher;
    const mn = d.mattNachher;
    if (mv != null && mn != null && Math.sign(mv) === Math.sign(mn)) {
      if (mv > 0 && mn > mv + 2) return ergebnis(mn > mv + 5 ? 'gut' : 'exzellent', 0, 'Matt dauert länger');
      if (mv < 0 && -mn < -mv - 1) {
        // Matt in hoechstens 2, obwohl es mindestens 3 Zuege laenger gehalten haette: Fehler
        if (-mn <= 2 && -mv + mn >= 3) return ergebnis('fehler', BODEN_VERLUST.fehler, 'Matt kommt viel schneller');
        return ergebnis(-mn < -mv - 2 ? 'gut' : 'exzellent', 0, 'Matt kommt schneller');
      }
    }
    // Gewinnchance gesaettigt (klar gewonnen/verloren): dann zaehlt die Bewertung selbst
    if (!gleichGut(d)) return ergebnis('exzellent', 0, 'fast so gut wie der Engine-Zug');
    return ergebnis('bester', 0, 'so gut wie der Engine-Zug');
  }

  // 6. Verschenkt: Gegner hatte gerade gepatzt, Vorteil >= 0.70 verspielt (< 0.55).
  // Bleibt die Stellung danach offen (>= 0.30, kein Matt gegen sich), ist es kein schwerer Fehlzug.
  let klasse = basis;
  let notiz = `Gewinnchance −${Math.round(roh * 100)} %`;
  const offenDanach = d.wn >= 0.30 && !(d.mattNachher != null && d.mattNachher < 0);
  if (d.gegnerFehler && d.wv >= 0.70 - EPS && d.wn < 0.55 && (basis !== 'patzer' || offenDanach)) {
    klasse = 'verpasst';
    notiz = 'Gegnerfehler nicht genutzt';
  }

  // 7. Stellung vorher und nachher klar entschieden: hoechstens ungenau
  const entschieden = (d.wv >= 0.97 && d.wn >= 0.97) || (d.wv <= 0.03 && d.wn <= 0.03);
  if (entschieden && RANG[klasse] > RANG.ungenau) {
    klasse = 'ungenau';
    notiz = 'Stellung bereits entschieden';
  }
  if (mattVerpasst && RANG[klasse] < RANG.verpasst) {
    klasse = 'verpasst';
    notiz = mattNotiz;
  }

  // 8. Untergrenze aus Bewertung und Matt: Flo 30.10. "Moves, die komplett schlecht von mir sind, werden als gut
  // bewertet". In klar verlorener Stellung kostet Dame weg oder ein Zug ins Matt kaum Gewinnchance.
  let verlust = roh;
  const boden = untergrenze(d);
  if (boden && RANG[klasse] < RANG[boden.klasse]) {
    klasse = boden.klasse;
    notiz = boden.notiz;
    verlust = Math.max(roh, BODEN_VERLUST[klasse]);
  }
  return ergebnis(klasse, verlust, notiz);
}

// Mindestklasse eines Zugs aus der Bewertung selbst (siehe BODEN_CP), oder null
function untergrenze(d) {
  const mv = d.mattVorher;
  const mn = d.mattNachher;
  const v = cpFuer(d.evalVorher, d.farbe);
  // laesst ein Matt zu, das es vorher nicht gab (war man schon matt, entscheidet die Mattlaenge, siehe oben)
  if (mn != null && mn < 0) {
    if (mv != null) return null;
    const notiz = `lässt Matt in ${-mn} zu`;
    if (-mn <= 3) return { klasse: 'patzer', notiz };
    return { klasse: v != null && v <= -1000 ? 'ungenau' : 'fehler', notiz };
  }
  const n = cpFuer(d.evalNachher, d.farbe);
  if (v == null || n == null) return null;
  const minus = v - n;
  const streuung = BODEN_STREUUNG * Math.max(0, Math.abs(v) - BODEN_STREUUNG_AB);
  if (minus < BODEN_CP.fehler + streuung) return null;
  const notiz = `Bewertung −${(minus / 100).toFixed(1).replace('.', ',')}`;
  if (n >= BODEN_GEWONNEN_CP) return { klasse: 'ungenau', notiz };
  return { klasse: minus >= BODEN_CP.patzer + streuung ? 'patzer' : 'fehler', notiz };
}

// Ist der gespielte Zug wirklich so gut wie der Engine-Zug (gleiche oder bessere Bewertung)?
// Matt fuer sich: der beste Zug verkuerzt "Matt in n" auf n - 1 (Stockfish zaehlt ganze Zuege). Bleibt es bei
// "Matt in n", dauert das Matt einen Zug laenger (an 62 Stellungen mit Tiefe 20 nachgeprueft: in 50 Faellen
// wirklich langsamer, w0c); nur ein Zug, der selbst mattsetzt, ist dann so gut. Wird man selbst matt, haelt die
// beste Verteidigung "Matt in n".
function gleichGut(d) {
  const mv = d.mattVorher;
  const mn = d.mattNachher;
  const rang = (m) => (m == null ? 0 : m > 0 ? 1 : -1);   // selbst Matt > Bewertung > wird matt
  if (rang(mv) !== rang(mn)) return rang(mn) > rang(mv);
  if (mv != null) return mv > 0 ? (d.matt || mn < mv) : -mn >= -mv;
  const v = cpFuer(d.evalVorher, d.farbe);
  const n = cpFuer(d.evalNachher, d.farbe);
  return v == null || n == null || n >= v;
}

// ---------------------------------------------------------------------------
// Coach-Texte
// ---------------------------------------------------------------------------

function farbName(farbe) {
  return t(farbe === 'w' ? 'allgemein.weiss' : 'allgemein.schwarz');
}

function gross(text) {
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}

// Figur im Coach-Satz; art: nom | akk | einAkk | neuAkk | neuNom (Woerterbuch analyse.figur.*)
function figurText(art, figur) {
  return t(`analyse.figur.${art}.${figur}`);
}

function bauernText(n, kasus) {
  if (n === 1) return t(kasus === 'nom' ? 'analyse.bauern.nom.eins' : 'analyse.bauern.akk.eins');
  return t('analyse.bauern.mehr', { anzahl: n >= 2 && n <= 8 ? t(`analyse.zahlwort.${n}`) : n });
}

// Materialtext aus einer materialFolge: 'gewinn' oder 'verlust' aus Sicht der Folge-Farbe
// Liefert { text, mehrzahl } oder bei einer Umwandlung { umwandlung: { figur, san } }.
function materialText(folge, art, kasus = 'akk') {
  const netto = art === 'verlust' ? -folge.saldo : folge.saldo;
  if (netto < 1) return null;
  const liste = art === 'verlust' ? folge.restVerloren : folge.restGewonnen;
  const gegen = art === 'verlust' ? folge.restGewonnen : folge.restVerloren;
  const figur = liste.find((x) => x.figur !== 'p' && x.figur !== 'k');
  // Gewinn durch eine Umwandlung (eigene bei 'gewinn', gegnerische bei 'verlust')
  const umw = (folge.umwandlungen || []).find((u) => u.eigener === (art === 'gewinn'));
  if (umw && (!figur || WERT[umw.figur] - 1 > WERT[figur.figur])) {
    return { text: `${figurText(kasus === 'nom' ? 'neuNom' : 'neuAkk', umw.figur)} (${sanAnzeige(umw.san)})`, mehrzahl: false, umwandlung: umw };
  }
  if (figur) {
    if (figur.figur === 'r' && netto < 3 && gegen.some((x) => x.figur === 'n' || x.figur === 'b')) {
      return { text: t('analyse.figur.qualitaet'), mehrzahl: false };
    }
    let text = t('analyse.figur.auf', { figur: figurText(kasus === 'nom' ? 'nom' : 'akk', figur.figur), feld: figur.feld });
    const komp = gegen.filter((x) => x.figur !== 'k').sort((a, b) => WERT[b.figur] - WERT[a.figur]);
    if (komp.length) {
      const bauern = komp.filter((x) => x.figur === 'p').length;
      text = t('analyse.figur.gegen', { material: text, gegen: komp[0].figur !== 'p' ? figurText('einAkk', komp[0].figur) : bauernText(bauern, 'akk') });
    }
    return { text, mehrzahl: false };
  }
  const n = Math.round(netto);
  return { text: bauernText(n, kasus), mehrzahl: n > 1 };
}

function variante(fen, pv, max) {
  return pvAlsSan(fen, pv, max).map(sanAnzeige).join(' ');
}

// Was hat der Gegner nach dem gespielten Zug? (Matt, Materialgewinn)
function folgenText(d) {
  if (d.mattNachher != null && d.mattNachher < 0 && d.pvNachher.length) {
    const n = -d.mattNachher;
    const erster = sanAnzeige(pvAlsSan(d.fenNachher, d.pvNachher, 1)[0] || '');
    if (!erster) return t('analyse.coach.folge.matt', { n });
    return n === 1 ? t('analyse.coach.folge.mattEins', { zug: erster }) : t('analyse.coach.folge.mattBeispiel', { n, zug: erster });
  }
  if (!d.fenVorher || !d.uci || !d.pvNachher.length) return null;
  const folge = materialFolge(d.fenVorher, [d.uci, ...d.pvNachher], d.farbe, { min: 5, max: 9 });
  const mt = materialText(folge, 'verlust', d.du ? 'akk' : 'nom');
  if (!mt) return null;
  // verliert die beste Linie auch Material, liegt es nicht an diesem Zug
  if (d.pvVorher.length) {
    const besteFolge = materialFolge(d.fenVorher, d.pvVorher, d.farbe, { min: 5, max: 9 });
    if (besteFolge.saldo < 0 || besteFolge.saldo - folge.saldo < 1) return null;
  }
  if (mt.umwandlung) {
    const figur = figurText('einAkk', mt.umwandlung.figur);
    const zug = sanAnzeige(mt.umwandlung.san);
    return d.du ? t('analyse.coach.folge.umwandlung.du', { figur, zug })
      : t('analyse.coach.folge.umwandlung.farbe', { farbe: farbName(gegnerVon(d.farbe)), figur, zug });
  }
  const erster = sanAnzeige(pvAlsSan(d.fenNachher, d.pvNachher, 1)[0] || '');
  if (d.du) {
    return erster ? t('analyse.coach.folge.verlierstNach', { zug: erster, material: mt.text })
      : t('analyse.coach.folge.verlierstDamit', { material: mt.text });
  }
  if (erster) return t(mt.mehrzahl ? 'analyse.coach.folge.gehenNach' : 'analyse.coach.folge.gehtNach', { zug: erster, material: mt.text });
  return t(mt.mehrzahl ? 'analyse.coach.folge.gehenDamit' : 'analyse.coach.folge.gehtDamit', { material: mt.text });
}

// Warum war der beste Zug besser? (Matt, Materialgewinn, Zurueckschlagen)
// 'zurückschlagen' ist ein Merker (kein Anzeigetext), die Saetze dazu baut besserText
function grundBester(d) {
  if (d.mattVorher != null && d.mattVorher > 0) {
    return d.mattVorher === 1 ? t('analyse.coach.grund.mattSofort') : t('analyse.coach.grund.mattIn', { n: d.mattVorher });
  }
  if (!d.fenVorher || !d.pvVorher.length) return null;
  const c = neuesBrett(d.fenVorher);
  const b = c && spieleUci(c, d.besterZug);
  if (istRueckschlag(d, b)) return 'zurückschlagen';
  const folge = materialFolge(d.fenVorher, d.pvVorher, d.farbe, { min: 4 });
  const mt = materialText(folge, 'gewinn', 'akk');
  return mt ? t(mt.umwandlung ? 'analyse.coach.grund.bringt' : 'analyse.coach.grund.gewinnt', { material: mt.text }) : null;
}

function besserText(d) {
  if (!d.besterSan || d.istBester) return null;
  const b = sanAnzeige(d.besterSan);
  const grund = grundBester(d);
  if (grund === 'zurückschlagen') return t('analyse.coach.besser.zurueck', { zug: b });
  return grund ? t('analyse.coach.besser.grund', { zug: b, grund }) : t('analyse.coach.besser.zug', { zug: b });
}

// Flo 30.10. abends ("Das sieht noch nicht gut aus"): die Zahlen stehen schon im Chip neben dem Zug; der Satz beschreibt
// die Lage danach (klar schlechter, Vorteil weg, schlechter) statt "Die Bewertung ... sinkt von X auf Y"
function bewertungsText(d) {
  const v = cpFuer(d.evalVorher, d.farbe);
  const n = cpFuer(d.evalNachher, d.farbe);
  if (v == null || n == null) return null;
  const art = d.wn < 0.2 ? 'klar' : d.wv >= 0.6 && d.wn < 0.55 ? 'vorteil' : 'schlechter';
  return t(`analyse.an.coach.lage.${art}.${d.du ? 'du' : 'gegner'}`, { name: farbName(d.farbe) });
}

function auswahl(d, texte) {
  const s = `${d.fenVorher || ''}${d.uci || ''}`;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return texte[h % texte.length];
}

export function coachText(eingabe, ergebnis) {
  const e = ergebnis && ergebnis.klasse ? ergebnis : klassifiziere(eingabe);
  const d = e.details || vorbereiten(eingabe);
  const sanDe = sanAnzeige(d.san || '');
  const besserB = d.besterSan ? sanAnzeige(d.besterSan) : '';
  const W = KLASSEN_WORT;

  switch (e.klasse) {
    case 'erzwungen':
      return t('analyse.coach.erzwungen', { wort: W.erzwungen });

    case 'buch': {
      const satz = auswahl(d, [t('analyse.coach.buch.satz1'), t('analyse.coach.buch.satz2'), t('analyse.coach.buch.satz3')]);
      return d.eroeffnung ? t('analyse.coach.buch.name', { wort: W.buch, eroeffnung: eroeffnungsAnzeige(d.eroeffnung), satz })
        : t('analyse.coach.buch.ohne', { wort: W.buch, satz });
    }

    case 'brillant': {
      const o = d.opfer || findeOpfer(d.fenVorher, d.uci, d.pvNachher, d.farbe);
      if (!o) return t('analyse.coach.brillant.zug', { wort: W.brillant, zug: sanDe });
      const mitFeld = (text) => (o.feld ? t('analyse.figur.auf', { figur: text, feld: o.feld }) : text);
      if (o.art === 'haengt') {
        return t(d.du ? 'analyse.coach.brillant.haengt.du' : 'analyse.coach.brillant.haengt.gegner',
          { wort: W.brillant, figur: gross(mitFeld(figurText('nom', o.figur))) });
      }
      const figur = mitFeld(figurText('akk', o.figur));
      const farbe = farbName(d.farbe);
      if (d.mattNachher != null && d.mattNachher > 0) {
        const n = d.mattNachher;
        const linie = n <= 2 ? variante(d.fenNachher, d.pvNachher, 2 * n) : '';
        // Mehrzahl ueber n: ...matt.eins (in 1 Zug) / ...matt.mehr (in n Zuegen)
        return t(d.du ? 'analyse.coach.brillant.mattDu' : 'analyse.coach.brillant.matt',
          { wort: W.brillant, farbe, figur, n, linie: linie ? ` (${linie})` : '' });
      }
      return t(d.du ? 'analyse.coach.brillant.rechnung.du' : 'analyse.coach.brillant.rechnung.gegner', { wort: W.brillant, farbe, figur });
    }

    case 'stark': {
      const haelt = d.wv >= 0.7 ? 'vorteil' : d.wv >= 0.4 ? 'stellung' : 'schaden';
      return t(`analyse.coach.stark.${haelt}`, { wort: W.stark, zug: sanDe });
    }

    case 'bester': {
      if (d.matt) return t('analyse.coach.schachmatt', { zug: sanDe });
      if (d.patt) return d.wv < 0.4 ? t('analyse.coach.patt.gerettet') : t('analyse.coach.patt.remis');
      if (d.mattNachher != null && d.mattNachher > 0) {
        return t('analyse.coach.bester.mattKommt', { wort: W.bester, n: d.mattNachher });
      }
      if (istRueckschlag(d, d.zug)) return t('analyse.coach.bester.zurueck', { wort: W.bester });
      if (d.fenVorher && d.uci && d.pvNachher.length) {
        const folge = materialFolge(d.fenVorher, [d.uci, ...d.pvNachher], d.farbe, { min: 4 });
        const mt = materialText(folge, 'gewinn', 'akk');
        if (mt) return t(mt.umwandlung ? 'analyse.coach.bester.bringt' : 'analyse.coach.bester.gewinnt', { wort: W.bester, material: mt.text });
      }
      // "Genau das hätte auch die Engine gespielt" nur fuer den Engine-Zug selbst
      const satz = (k) => t(`analyse.coach.bester.${k}`, { wort: W.bester });
      return auswahl(d, d.istBester ? [satz('engine'), satz('genau'), satz('staerker')] : [satz('genau'), satz('wieEngine')]);
    }

    case 'exzellent':
    case 'gut': {
      // ausgelassenes Matt immer nennen
      if (d.mattVorher != null && d.mattVorher > 0 && !(d.mattNachher != null && d.mattNachher > 0) && besserB && !d.istBester) {
        return t('analyse.coach.gut.mattAber', { wort: W[e.klasse], n: d.mattVorher, zug: besserB });
      }
      if (e.klasse === 'gut') {
        return besserB && !d.istBester ? t('analyse.coach.gut.genauer', { wort: W.gut, zug: besserB }) : W.gut;
      }
      return besserB && !d.istBester
        ? t('analyse.coach.exzellent.fast', { wort: W.exzellent, zug: besserB })
        : t('analyse.coach.exzellent.stark', { wort: W.exzellent });
    }

    default: {
      // ungenau, fehler, patzer, verpasst
      const kopf = W[e.klasse] || '';
      let grund = null;
      let besser = besserText(d);
      if (d.patt && d.wv >= 0.6) {
        grund = t('analyse.coach.patt.siegWeg');
      } else if (d.mattNachher != null && d.mattNachher < 0) {
        grund = folgenText(d);
      } else if (d.mattVorher != null && d.mattVorher > 0 && !(d.mattNachher != null && d.mattNachher > 0) && besserB) {
        grund = t('analyse.coach.mattMoeglich', { n: d.mattVorher, zug: besserB });
        besser = null;
      } else if (e.klasse !== 'ungenau') {
        grund = folgenText(d);
      }
      if (e.klasse === 'verpasst') {
        // nach dem Fehler deines Gegners (du) bzw. des Gegners
        const wer = d.du ? 'du' : 'gegner';
        const gb = grundBester(d);
        if (besserB && grund == null) {
          if (gb && gb !== 'zurückschlagen') return t(`analyse.coach.verpasst.grund.${wer}`, { wort: kopf, zug: besserB, grund: gb });
          return t(`analyse.coach.verpasst.stark.${wer}`, { wort: kopf, zug: besserB });
        }
        if (!grund) grund = t(`analyse.coach.verpasst.mehr.${wer}`);
      }
      if (!grund) grund = bewertungsText(d);
      return [kopf, grund, besser].filter(Boolean).join(' ');
    }
  }
}

// ---------------------------------------------------------------------------
// Zug-Eintrag (fuer Spielanalyse und Live-Bewertung)
// ---------------------------------------------------------------------------

function baueEintrag(p) {
  const { ply, fenVorher, fenNachher, zug, aV, aN, buch, name, gegnerKlasse, vorigerZug, du } = p;
  const eingabe = {
    fenVorher, fenNachher, uci: zug.lan, san: zug.san, farbe: zug.color,
    evalVorher: aV.lines[0].eval,
    evalNachher: aN.lines[0].eval,
    evalZweiter: aV.lines[1] ? aV.lines[1].eval : null,
    besterZug: aV.lines[0].pv[0] || aV.bestmove || null,
    pvVorher: aV.lines[0].pv || [],
    pvNachher: aN.lines[0].pv || [],
    buch, eroeffnung: name, gegnerKlasse, vorigerZug, du,
  };
  const erg = klassifiziere(eingabe);
  const d = erg.details;
  const genauigkeit = zugGenauigkeit(d.wv, d.wv - erg.verlust);
  const besteLinieSan = pvAlsSan(fenVorher, eingabe.pvVorher, 8);
  const zugnr = Number(fenVorher.split(' ')[5]) || 1;
  return {
    ply,
    farbe: zug.color,
    nummer: zugnr,
    san: zug.san,
    sanDe: sanDeutsch(zug.san),
    uci: zug.lan,
    fenVorher,
    fenNachher,
    evalVorher: eingabe.evalVorher,
    evalNachher: eingabe.evalNachher,
    besterZug: eingabe.besterZug,
    besterZugSan: d.besterSan,
    besterZugSanDe: d.besterSan ? sanDeutsch(d.besterSan) : null,
    besteLinie: eingabe.pvVorher.slice(0, 8),
    besteLinieSan: besteLinieSan.map(sanDeutsch),
    klasse: erg.klasse,
    verlust: runde(erg.verlust, 4),
    genauigkeit: genauigkeit == null ? null : runde(genauigkeit, 1),
    gewinnVorher: runde(d.wv, 4),
    gewinnNachher: runde(d.wn, 4),
    gewinnZweiter: d.w2 == null ? null : runde(d.w2, 4),
    buch: !!buch,
    trivial: trivialerZug(d),
    notiz: erg.notiz,
    coach: coachText(eingabe, erg),
  };
}

function runde(x, stellen) {
  if (typeof x !== 'number' || !isFinite(x)) return x;
  const f = 10 ** stellen;
  return Math.round(x * f) / f;
}

// Abgebrochene (engine.stop) oder leere Suchen beenden die Bewertung mit Fehler.abgebrochen = true
function pruefeAnalyse(a, fen) {
  if (!a || a.abgebrochen || !Array.isArray(a.lines) || !a.lines.length || !a.lines[0].eval) {
    const f = new Error('Analyse abgebrochen: ' + fen);
    f.abgebrochen = true;
    throw f;
  }
  return a;
}

// Live-Bewertung eines einzelnen Zugs (Zusatz zur Spielanalyse).
// Liefert den gleichen Eintrag wie in Review.zuege plus analyseVorher/analyseNachher.
// opts.analyseVorher/analyseNachher: schon gerechnete Analysen, die Engine rechnet dann nur den Rest.
export async function bewerteZug(engine, fenVorher, zug, opts = {}) {
  const { tiefe = 14, multipv = 2, analyseVorher = null, analyseNachher = null, buch = false, eroeffnung: name = null,
    gegnerKlasse = null, vorigerZug = null, vorigerSchlag, du = true, ply = null } = opts;
  const c = neuesBrett(fenVorher);
  if (!c) throw new Error('Ungültige Stellung: ' + fenVorher);
  const anzahl = c.moves().length;
  const m = spieleZug(c, zug);
  if (!m) throw new Error('Ungültiger Zug: ' + JSON.stringify(zug));
  const fenNachher = c.fen();
  // schon gerechnete Analysen (z. B. aus der Live-Warteschlange) wiederverwenden
  const passt = (a, fen, n) => a && !a.abgebrochen && a.lines && a.lines.length >= n
    && stellungsSchluessel(a.fen || fen) === stellungsSchluessel(fen);
  const aV = pruefeAnalyse(passt(analyseVorher, fenVorher, Math.min(multipv, anzahl)) ? analyseVorher
    : await engine.analyse(fenVorher, { depth: tiefe, multipv }), fenVorher);
  const anzahlNachher = c.moves().length;
  const aN = pruefeAnalyse(passt(analyseNachher, fenNachher, Math.min(1, anzahlNachher)) ? analyseNachher
    : await engine.analyse(fenNachher, { depth: tiefe, multipv }), fenNachher);
  const vorher = typeof vorigerZug === 'string' && vorigerSchlag != null
    ? { lan: vorigerZug, to: vorigerZug.slice(2, 4), captured: vorigerSchlag ? 'x' : undefined }
    : vorigerZug;
  const eintrag = baueEintrag({ ply, fenVorher, fenNachher, zug: m, aV, aN, buch, name, gegnerKlasse, vorigerZug: vorher, du });
  return { ...eintrag, analyseVorher: aV, analyseNachher: aN };
}

// ---------------------------------------------------------------------------
// Spielanalyse
// ---------------------------------------------------------------------------

// Schon gerechnete Analyse (z. B. aus der Live-Bewertung) wiederverwenden.
// vorab: Map oder Objekt, Schluessel = stellungsSchluessel(fen), Wert = Analyse.
function ausVorab(vorab, fen, multipv, minTiefe) {
  if (!vorab) return null;
  const s = stellungsSchluessel(fen);
  const a = typeof vorab.get === 'function' ? vorab.get(s) : vorab[s];
  if (!a || a.abgebrochen || !Array.isArray(a.lines) || !a.lines.length || !a.lines[0].eval) return null;
  const c = neuesBrett(fen);
  const anzahl = c ? c.moves().length : 0;
  if (anzahl > 0 && (a.lines.length < Math.min(multipv, anzahl) || !((a.depth ?? a.lines[0].depth ?? 0) >= minTiefe))) return null;
  return a;
}

// So viele Zuege ordnet analysierePartie mit stueckeln am Stueck ein (ca. 25 ms im Desktop-Browser)
const STUECK_ZUEGE = 10;

// zuege: UCI-Liste (SAN oder {from,to,promotion} gehen auch)
// opts: { tiefe = 16, multipv = 2, beiFortschritt(fertig, gesamt), startFen,
//         spielerFarbe ('w'|'b': Du-Form nur fuer diese Seite), elo: { w, b }, signal,
//         vorab (Map stellungsSchluessel -> Analyse, z. B. aus der Live-Bewertung), vorabMinTiefe = 1,
//         vorabMerken (true: neu gerechnete Analysen auch in vorab ablegen, fuer einen Abbruch mit Neustart),
//         stueckeln (true: beim Nachspielen und Einordnen der Zuege den Hauptthread regelmaessig per
//         setTimeout freigeben, fuer das stille Nachholen; das Ergebnis ist dasselbe) }
// Abbruch: signal.abort() oder engine.stop() -> Promise wird mit Fehler (fehler.abgebrochen) abgelehnt.
export async function analysierePartie(engine, zuege, opts = {}) {
  const tiefe = opts.tiefe ?? 16;
  const multipv = opts.multipv ?? 2;
  const startFen = opts.startFen || START_FEN;
  const beiFortschritt = typeof opts.beiFortschritt === 'function' ? opts.beiFortschritt : null;

  const chess = neuesBrett(startFen);
  if (!chess) throw new Error('Ungültige Startstellung: ' + startFen);
  // stueckeln: zwischendurch den Hauptthread freigeben (setTimeout, nicht requestIdleCallback)
  const pause = () => new Promise((r) => setTimeout(r, 0));
  const daten = [];
  for (const z of zuege || []) {
    if (opts.stueckeln && daten.length && daten.length % (2 * STUECK_ZUEGE) === 0) await pause();
    const fenVorher = chess.fen();
    const m = spieleZug(chess, z);
    if (!m) throw new Error('Ungültiger Zug: ' + JSON.stringify(z));
    daten.push({ fenVorher, fenNachher: chess.fen(), zug: m });
  }
  const fens = daten.length ? [...daten.map((x) => x.fenVorher), daten[daten.length - 1].fenNachher] : [startFen];

  const ausStart = stellungsSchluessel(startFen) === stellungsSchluessel(START_FEN);
  // die Eroeffnungstabelle baut beim ersten Aufruf ihren Index (einmalig, ca. 50 ms)
  if (opts.stueckeln) await pause();
  const er = ausStart ? eroeffnung(daten.map((x) => x.zug.san)) : { name: null, buch: [], namen: [] };

  // Alle Stellungen nacheinander bewerten
  const melde = (fertig) => {
    if (!beiFortschritt) return;
    try { beiFortschritt(fertig, fens.length); } catch (e) { /* Anzeige-Fehler ignorieren */ }
  };
  const abbruch = () => {
    const f = new Error('Analyse abgebrochen');
    f.abgebrochen = true;
    return f;
  };
  melde(0);
  const analysen = [];
  const signal = opts.signal || null;
  const stopp = () => { try { if (typeof engine.stop === 'function') engine.stop(); } catch (e) { /* egal */ } };
  if (signal) signal.addEventListener('abort', stopp, { once: true });
  try {
    for (let k = 0; k < fens.length; k++) {
      if (signal && signal.aborted) throw abbruch();
      const alt = ausVorab(opts.vorab, fens[k], multipv, opts.vorabMinTiefe ?? 1);
      const a = alt || await engine.analyse(fens[k], { depth: tiefe, multipv });
      if (signal && signal.aborted) throw abbruch();
      analysen.push(pruefeAnalyse(a, fens[k]));
      if (!alt && opts.vorabMerken && opts.vorab && typeof opts.vorab.set === 'function') opts.vorab.set(stellungsSchluessel(fens[k]), a);
      melde(k + 1);
    }
  } finally {
    if (signal) signal.removeEventListener('abort', stopp);
  }

  // Zuege einordnen (mit stueckeln in Portionen, dazwischen ist der Hauptthread frei)
  const eintraege = [];
  for (let i = 0; i < daten.length; i++) {
    if (opts.stueckeln && i > 0 && i % STUECK_ZUEGE === 0) {
      await pause();
      if (signal && signal.aborted) throw abbruch();
    }
    const x = daten[i];
    const du = !opts.spielerFarbe || opts.spielerFarbe === x.zug.color;
    eintraege.push(baueEintrag({
      ply: i, fenVorher: x.fenVorher, fenNachher: x.fenNachher, zug: x.zug,
      aV: analysen[i], aN: analysen[i + 1],
      buch: !!er.buch[i], name: er.namen[i] || er.name,
      gegnerKlasse: i > 0 ? eintraege[i - 1].klasse : null,
      vorigerZug: i > 0 ? daten[i - 1].zug : null,
      du,
    }));
  }

  // Genauigkeit je Seite (volatilitaetsgewichtet + harmonisch)
  const kurve = analysen.map((a) => gewinnChance(a.lines[0].eval, 'w'));
  const gewichte = volatilitaetsGewichte(kurve);
  const genauigkeit = { w: null, b: null };
  for (const f of ['w', 'b']) {
    const liste = eintraege
      .map((z, i) => ({ genauigkeit: z.genauigkeit, gewicht: gewichte[i] ?? 1, farbe: z.farbe }))
      .filter((z) => z.farbe === f);
    const g = partieGenauigkeit(liste);
    genauigkeit[f] = g == null ? null : runde(g, 1);
  }

  const anzahl = { w: {}, b: {} };
  for (const k of KLASSEN) {
    anzahl.w[k] = 0;
    anzahl.b[k] = 0;
  }
  for (const z of eintraege) anzahl[z.farbe][z.klasse]++;

  // Bekannte eigene Elo (Bot-Seite): Bot-Tabelle und Zug zur eigenen Elo
  const elo = opts.elo || {};
  const zahl = (f) => eintraege.filter((z) => z.farbe === f).length;
  const staerke = (f) => {
    const eigene = elo[f];
    if (typeof eigene === 'number' && isFinite(eigene) && opts.spielerFarbe !== f) {
      return schaetzeSpielstaerke(genauigkeit[f], undefined, zahl(f), { eigeneElo: eigene });
    }
    return schaetzeSpielstaerke(genauigkeit[f], elo[gegnerVon(f)], zahl(f));
  };
  const spielstaerke = { w: staerke('w'), b: staerke('b') };

  return {
    zuege: eintraege,
    genauigkeit,
    anzahl,
    eroeffnung: er.name || (ausStart && eintraege.length ? 'Unbekannte Eröffnung' : null),
    spielstaerke,
    schluesselmomente: schluesselmomente(eintraege),
    // Zusatzfelder
    kurve,
    bewertungen: analysen.map((a) => a.lines[0].eval),
    tiefe,
    startFen,
  };
}

// War die Partie fuer farbe knapp? Ja, wenn ihre Gewinnchance im letzten Drittel (vor der
// Schlussstellung) noch mindestens 40 % betrug. kurve: Gewinnchancen Sicht Weiss je Stellung.
export function warKnapp(kurve, farbe) {
  if (!Array.isArray(kurve) || kurve.length < 3) return false;
  const n = kurve.length - 1;
  for (let i = Math.floor((n * 2) / 3); i < n; i++) {
    const c = farbe === 'b' ? 1 - kurve[i] : kurve[i];
    if (Number.isFinite(c) && c >= 0.4) return true;
  }
  return false;
}

// Wichtigste Momente: Brillanz, starke Zuege, Fehler, schwere Fehlzuege, verpasste Chancen (max. 8)
function schluesselmomente(eintraege) {
  const gewicht = { brillant: 2, stark: 1.2, verpasst: 1.5, patzer: 1, fehler: 0.6 };
  return eintraege
    .filter((z) => gewicht[z.klasse] != null)
    .map((z) => ({ ply: z.ply, wert: gewicht[z.klasse] + (z.verlust || 0) }))
    .sort((a, b) => b.wert - a.wert)
    .slice(0, 8)
    .map((x) => x.ply)
    .sort((a, b) => a - b);
}

// ---------------------------------------------------------------------------
// Spielphasen (aus analyse.js phasen() hierher verschoben, Runde 4)
// ---------------------------------------------------------------------------

// Spielphasen grob nach Lichess (Divider): Mittelspiel ab wenigen Leichtfiguren/duenner
// Grundreihe, Endspiel ab hoechstens 6 Leicht- und Schwerfiguren.
// fens: alle Stellungen der Partie (Laenge = Zuege + 1), buchEnde: erster Ply nach dem Buch.
export function spielphasen(fens, buchEnde) {
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

// ---------------------------------------------------------------------------
// Coach-Kern: der Coach-Satz ohne das Klassenwort am Anfang (das steht in Partie und Analyse
// schon gross ueber dem Satz). Die einzige Stelle, die die Klassenwoerter der Coach-Texte kennt.
// Keine langen Gedankenstriche in UI-Texten (werden zu ": "), Rochade wie in der Zugliste (0-0).
// ---------------------------------------------------------------------------
const regexSicher = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Klassenwoerter aller Sprachen (Englische Version: auch ein gespeicherter Satz der anderen Sprache) und die alten
// deutschen; "Theorie"/"Theory" nur mit Punkt oder Doppelpunkt. Einmal beim ersten Aufruf gebaut.
let klassenwortAmAnfang = null;
function klassenwortRegex() {
  if (klassenwortAmAnfang) return klassenwortAmAnfang;
  const woerter = klassenWoerterAllerSprachen();
  const liste = [...woerter.filter((w) => w.id !== 'buch').map((w) => w.wort), ...ALTE_WOERTER].map(regexSicher);
  for (const w of woerter) if (w.id === 'buch') liste.push(`${regexSicher(w.wort)}[.:]`);
  klassenwortAmAnfang = new RegExp(`^(?:${liste.join('|')})\\s+`);
  return klassenwortAmAnfang;
}

export function coachKern(t) {
  const text = String(t || '').replace(/\s*[–—]\s*/g, ': ').replace(/O-O-O/g, '0-0-0').replace(/O-O/g, '0-0');
  const rest = text.replace(klassenwortRegex(), '');
  if (!rest.trim()) return text;
  // Bauernzug am Satzanfang bleibt klein ("exd5", nicht "Exd5" wie ein Damenzug)
  return /^[a-h][1-8x]/.test(rest) ? rest : rest.charAt(0).toUpperCase() + rest.slice(1);
}

// ---------------------------------------------------------------------------
// Kompakte Reviews fuer den Speicher (storage.js speichereReview/ladeReview)
// Weggelassen werden nur Felder, die sich wieder genau gleich ableiten lassen: sanDe,
// besterZugSanDe, besteLinieSan, nummer und fenNachher (= fenVorher des naechsten Zugs; beim
// letzten Zug bleibt er stehen). Kompakt wird nur ein Review, dessen Zuege alle diese Felder haben
// (Merker kompakt: 1); alles andere bleibt unveraendert. Alte, volle Reviews laden wie bisher.
// besteLinieSan braucht chess.js (teuer, ca. 1 ms je Zug) und nur die Coach-Karte des gezeigten
// Zugs: ergaenzeReviewFelder legt es deshalb als Feld an, das sich beim ersten Lesen selbst
// berechnet und danach ein normales Feld ist (JSON.stringify, Spread und "in" wie gewohnt).
// ---------------------------------------------------------------------------
const ABLEITBAR = ['sanDe', 'besterZugSanDe', 'besteLinieSan', 'nummer', 'fenNachher'];
// Reihenfolge der Felder wie in baueEintrag (fuer einen gleich aussehenden Eintrag nach dem Ergaenzen)
const EINTRAG_FELDER = ['ply', 'farbe', 'nummer', 'san', 'sanDe', 'uci', 'fenVorher', 'fenNachher', 'evalVorher',
  'evalNachher', 'besterZug', 'besterZugSan', 'besterZugSanDe', 'besteLinie', 'besteLinieSan', 'klasse', 'verlust',
  'genauigkeit', 'gewinnVorher', 'gewinnNachher', 'gewinnZweiter', 'buch', 'trivial', 'notiz', 'coach'];
const FAUL = Symbol('faul');

// Ist besteLinieSan so ableitbar? Faules Feld: ja (ohne es auszurechnen). Sonst: gleiche Laenge
// wie besteLinie (pvAlsSan bricht nur an einem ungueltigen Zug ab; dann bleibt das Feld stehen).
function linieAbleitbar(z) {
  const d = Object.getOwnPropertyDescriptor(z, 'besteLinieSan');
  if (d && d.get && d.get[FAUL]) return true;
  return Array.isArray(z.besteLinieSan) && Array.isArray(z.besteLinie) && z.besteLinieSan.length === Math.min(8, z.besteLinie.length)
    && z.besteLinieSan.every((x) => typeof x === 'string');
}

function istAbleitbar(feld, z, naechster) {
  switch (feld) {
    case 'sanDe': return z.sanDe === sanDeutsch(z.san);
    case 'besterZugSanDe': return z.besterZugSanDe === (z.besterZugSan ? sanDeutsch(z.besterZugSan) : null);
    case 'besteLinieSan': return linieAbleitbar(z);
    case 'nummer': return z.nummer === (Number(String(z.fenVorher).split(' ')[5]) || 1);
    case 'fenNachher': return !!naechster && z.fenNachher === naechster.fenVorher;
    default: return false;
  }
}

export function kompaktReview(review) {
  if (!review || typeof review !== 'object' || review.kompakt || !Array.isArray(review.zuege) || !review.zuege.length) return review;
  const zuege = review.zuege;
  const voll = zuege.every((z) => z && typeof z === 'object' && typeof z.fenVorher === 'string' && typeof z.san === 'string'
    && Array.isArray(z.besteLinie) && ABLEITBAR.every((f) => f in z));
  if (!voll) return review;
  const neu = zuege.map((z, i) => {
    const naechster = zuege[i + 1] && zuege[i + 1].ply === z.ply + 1 && typeof zuege[i + 1].fenVorher === 'string' ? zuege[i + 1] : null;
    const weg = ABLEITBAR.filter((f) => istAbleitbar(f, z, naechster));
    const k = {};
    for (const f of Object.keys(z)) if (!weg.includes(f)) k[f] = z[f];
    return k;
  });
  const aus = {};
  for (const [schl, wert] of Object.entries(review)) aus[schl] = schl === 'zuege' ? neu : wert;
  aus.kompakt = 1;
  return aus;
}

// besteLinieSan als Feld, das sich beim ersten Lesen berechnet
function faulesLinienFeld(ziel, fenVorher, besteLinie) {
  const feld = (obj, wert) => Object.defineProperty(obj, 'besteLinieSan', { value: wert, enumerable: true, configurable: true, writable: true });
  const get = function () {
    const wert = pvAlsSan(fenVorher, besteLinie, 8).map(sanDeutsch);
    try { feld(this, wert); } catch (e) { /* eingefroren: dann jedes Mal neu */ }
    return wert;
  };
  get[FAUL] = true;
  Object.defineProperty(ziel, 'besteLinieSan', {
    enumerable: true, configurable: true, get,
    set(wert) { feld(this, wert); },
  });
}

export function ergaenzeReviewFelder(review) {
  if (!review || typeof review !== 'object' || !review.kompakt || !Array.isArray(review.zuege)) return review;
  const zuege = review.zuege;
  const neu = zuege.map((z, i) => {
    if (!z || typeof z !== 'object') return z;
    const naechster = zuege[i + 1];
    const fehlt = (f) => !(f in z);
    const wert = {
      sanDe: () => sanDeutsch(z.san),
      besterZugSanDe: () => (z.besterZugSan ? sanDeutsch(z.besterZugSan) : null),
      nummer: () => Number(String(z.fenVorher).split(' ')[5]) || 1,
      fenNachher: () => (naechster && typeof naechster.fenVorher === 'string' ? naechster.fenVorher : undefined),
    };
    const aus = {};
    const setze = (f) => {
      if (!fehlt(f)) { aus[f] = z[f]; return; }
      if (f === 'besteLinieSan') {
        if (typeof z.fenVorher === 'string' && Array.isArray(z.besteLinie)) faulesLinienFeld(aus, z.fenVorher, z.besteLinie);
        return;
      }
      const w = wert[f] ? wert[f]() : undefined;
      if (w !== undefined) aus[f] = w;
    };
    for (const f of EINTRAG_FELDER) setze(f);
    for (const f of Object.keys(z)) if (!(f in aus)) aus[f] = z[f];
    return aus;
  });
  const aus = {};
  for (const [schl, wert] of Object.entries(review)) if (schl !== 'kompakt') aus[schl] = schl === 'zuege' ? neu : wert;
  return aus;
}
