// Paket "gedaechtnis" (Welle A, A2): reine Logik, ohne DOM, in Node testbar, kein Math.random (Fairness-Test).
// Bots erinnern sich an die gemeinsame Geschichte (Begruessung), Revanche nach Niederlage oder Remis, Erzfeind.
//
// Begruessung (Wahl-Ort partie:begruessung?, auch die Sprechblase im Arena-Panel):
//   geschichte(partien, botId) -> wertende Partien gegen diesen Bot, neueste zuerst (Uebungen, eigene Stellungen,
//     Bosse und Gaeste zaehlen nicht; storage.wertet)
//   lage({ partien, botId, heute, memo }) -> Fakten der gemeinsamen Geschichte (Tage seit der letzten Partie ueber
//     tag.js mit der Tagesgrenze 4:00, nie toISOString)
//   anlassFuer(lage, { folgeGesamt }) -> { anlass, werte } | null   Vorrang wie ANLAESSE (erster Treffer gewinnt):
//     kennenlernen > ersterSieg > wiedersehen > mutmachen > genial > botPatzer > serieGegen > rueckkampf > revanche
//     > remisZuletzt. folgeGesamt() -> Niederlagen in Folge ueber alle Partien (nur bei Bedarf gerufen).
//   gesperrt(lage, folgeGesamt) -> boolean   Fairness-Sperre: FOLGE_NIEDERLAGEN Niederlagen in Folge gegen diesen
//     Bot oder insgesamt
//   begruessung({ botId, partien, heute, memo, bekannt, folgeGesamt, sprueche, saetze })
//     -> { anlass, werte, grund, stark, satz, gesperrt, vorn } | null. Sparsam: Die STARKEN Anlaesse kommen immer, die
//     anderen nur, wenn der Tageszufall es will (ANTEIL, also etwa jede zweite Partie). Zufall nur aus tag.js:
//     zufallAus(seedAus('gedaechtnis|RECHENSTAND|Tag|Bot|n')), n = Zahl der gemeinsamen Partien: gleicher Tag, gleiche
//     Geschichte, gleicher Satz (Panel und Partie sagen dasselbe). anlass ist der Schluessel EINER Variante
//     (variante(anlass, i)), damit botSatz() im Host, der mit Math.random waehlt, genau diesen Satz nimmt.
//     sprueche: 'aus' -> null, 'wenig' -> nur WENIG (unter der Fairness-Sperre statt Schweigen mutmachen).
//     vorn: die Wahl gehoert an den Wahl-Ort VOR die Begruessungen anderer Pakete (REIHENFOLGE.vorn), sonst dahinter
//     (REIHENFOLGE.hinten). Vorn steht nur, was vorn stehen muss: jede Wahl unter der Fairness-Sperre (sonst kaeme z. B.
//     der Level-Gruss von Funken, der selbst eine Stichelei ist) und die einmaligen Momente aus VORN.
//   Fairness (SPIELKONZEPT 3.12, 5.3): hoechstens eine Stichelei je Partie (nur die Begruessung, revanche) und keine
//   nach 3 Niederlagen in Folge (gegen diesen Bot oder insgesamt): dann spricht das Paket immer (kennenlernen,
//   ersterSieg, wiedersehen oder mutmachen, auch bei "Bot-Sprueche: Wenig"), und zwar vorn, damit weder eine
//   eingebaute Begruessung noch der Gruss eines anderen Pakets sticheln kann.
// Revanche (Ort ergebnis:karte): revanche(kontext) -> { botId, farbe, tempo? } | null, nur fuer Leiter-Bots nach
//   Niederlage oder Remis einer normalen Partie aus der Grundstellung; Farben getauscht, Bedenkzeit wie gehabt (wie
//   "Nochmal" im Host), ohne Liga (wie "Nochmal": eine Liga-Runde plant die Liga selbst).
// Erzfeind: erzfeind(fortschritt) -> { botId, siege, niederlagen } | null   der Leiter-Bot mit den meisten
//   Niederlagen von Flo (mindestens ERZFEIND_MIN und mehr Niederlagen als Siege; Gleichstand: groessere Differenz,
//   dann die hoehere Stufe aus BOTS, unabhaengig von der Reihenfolge im Fortschritt). Quelle: Fortschritt (wertende
//   Partien, storage.bucheFortschritt); Schluessel, die kein Leiter-Bot sind, zaehlen nicht.
//   erzfeindZeile(e) -> 'Dein Erzfeind · 1 Sieg · 4 Niederlagen'
//   erzfeindBezwungen({ fortschritt, botId, ergebnis, wertet, gefeiert }) -> { botId, niederlagen } | null
//     Sieg einer wertenden Partie gegen den Bot, der VOR dieser Partie Erzfeind war; einmal je neuer Niederlage
//     (gefeiert[botId] = Niederlagen beim letzten Feiern).
// Modul-Speicher "bots": { v: RECHENSTAND, memo: [[partieId, genial, botPatzer]] (hoechstens MEMO_MAX),
//   erzfeind: { [botId]: Niederlagen beim letzten Feiern } }
import { seedAus, zufallAus, tagSchluessel, tageZwischen, istSchluessel } from '../../tag.js';
import { wertet } from '../../storage.js';
import { BOTS } from '../../bots.js';
import { SAETZE } from './saetze.js';

// 2: Fairness-Sperre auch bei "Wenig", Plaetze vorn und hinten am Wahl-Ort, Erzfeind nach Stufe, Komma bei Greta
export const RECHENSTAND = 2;
export const MODUL = 'bots';
export const PAKET = 'gedaechtnis';
// Vorrang: der erste passende Anlass gewinnt
export const ANLAESSE = Object.freeze(['kennenlernen', 'ersterSieg', 'wiedersehen', 'mutmachen', 'genial', 'botPatzer',
  'serieGegen', 'rueckkampf', 'revanche', 'remisZuletzt']);
// Kommen immer (ein besonderer Moment oder Fairness), die anderen nur etwa jede zweite Partie
export const STARK = Object.freeze(['kennenlernen', 'ersterSieg', 'wiedersehen', 'mutmachen', 'genial']);
// Einstellung "Bot-Sprueche: Wenig"
export const WENIG = Object.freeze(['kennenlernen', 'ersterSieg', 'mutmachen']);
// Einmalige Momente, die vor den Begruessungen anderer Pakete stehen (dazu jede Wahl unter der Fairness-Sperre)
export const VORN = Object.freeze(['kennenlernen', 'ersterSieg', 'mutmachen']);
// Plaetze am Wahl-Ort partie:begruessung? (Funken steht mit dem einmaligen Level-Gruss auf 40)
export const REIHENFOLGE = Object.freeze({ vorn: 10, hinten: 60 });
// leichte Sticheleien (hoechstens eine je Partie, nie nach FOLGE_NIEDERLAGEN Niederlagen in Folge)
export const STICHELEI = Object.freeze(['revanche']);
export const ANTEIL = 0.5;
export const PAUSE_TAGE = 7;
export const SERIE_MIN = 3;
export const FOLGE_NIEDERLAGEN = 3;
export const ERSTER_SIEG_NACH = 3;
export const ERZFEIND_MIN = 3;
export const MEMO_MAX = 60;
export const PRAEFIX = 'gedaechtnis.';
export const STANDARD_MODUL = Object.freeze({ v: RECHENSTAND, memo: [], erzfeind: {} });

const ERGEBNISSE = ['sieg', 'niederlage', 'remis'];
const PLATZHALTER_RE = /\{([a-zA-Z]+)\}/g;
const GRUNDSTELLUNG = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -';

// Schluessel einer Variante im Satz-Register (je Variante genau ein Satz je Bot)
export function variante(anlass, i) {
  return PRAEFIX + anlass + '.' + i;
}

// Platzhalter eines Satzes
export function platzhalter(satz) {
  return [...String(satz).matchAll(PLATZHALTER_RE)].map((m) => m[1]);
}

// Alle Saetze im Satz-Register anmelden: je Variante ein eigener Anlass (bestimmte Wahl) und unter dem schlichten
// Namen alle Varianten (fuer andere Pakete, z. B. botSatz(bot, 'wiedersehen')). -> abmelden()
export function registriereAlle(registriereSaetze, saetze = SAETZE) {
  const ab = [];
  for (const anlass of Object.keys(saetze)) {
    const jeBot = saetze[anlass];
    ab.push(registriereSaetze(anlass, jeBot));
    const max = Math.max(0, ...Object.values(jeBot).map((l) => l.length));
    for (let i = 0; i < max; i++) {
      const eins = {};
      for (const [botId, liste] of Object.entries(jeBot)) if (liste[i]) eins[botId] = [liste[i]];
      ab.push(registriereSaetze(variante(anlass, i), eins));
    }
  }
  return () => { for (const f of ab) { try { f(); } catch (e) { /* egal */ } } };
}

const datumZahl = (p) => {
  const t = Date.parse(p && p.datum);
  return Number.isFinite(t) ? t : NaN;
};

// Wertende Partien gegen diesen Bot mit Ergebnis, neueste zuerst
export function geschichte(partien, botId) {
  if (!Array.isArray(partien) || !botId) return [];
  return partien
    .filter((p) => p && typeof p === 'object' && p.botId === botId && ERGEBNISSE.includes(p.ergebnis)
      && Number.isFinite(datumZahl(p)) && wertet(p))
    .sort((a, b) => datumZahl(b) - datumZahl(a));
}

// Wie oft dasselbe Ergebnis von vorn an in Folge (liste: neueste zuerst)
function inFolge(liste, ergebnis, ab = 0) {
  let n = 0;
  for (let i = ab; i < liste.length; i++) {
    if (liste[i].ergebnis === ergebnis) n++;
    else break;
  }
  return n;
}

// Zuege einer Partie wie "Schachmatt im 4. Zug" (aus der Grundstellung: Halbzuege / 2 aufgerundet)
function zugZahl(p) {
  const n = Array.isArray(p.zuege) ? p.zuege.length : 0;
  return Math.ceil(n / 2);
}

// memo: Map partieId -> { g, p } (aus der Spielanalyse) oder Liste [[id, g, p]]
function memoVon(memo, id) {
  if (!memo || !id) return null;
  if (memo instanceof Map) return memo.get(id) || null;
  if (Array.isArray(memo)) {
    const e = memo.find((x) => Array.isArray(x) && x[0] === id);
    return e ? { g: e[1] | 0, p: e[2] | 0 } : null;
  }
  return null;
}

// bekannt: wertende Partien gegen diesen Bot laut Fortschritt (zaehlt fuer immer, die Partienliste nur die letzten
// MAX_PARTIEN): ohne Partie in der Liste, aber mit Fortschritt ist es kein erstes Treffen, sondern ein Wiedersehen.
export function lage({ partien, botId, heute, memo = null, bekannt = 0 } = {}) {
  const g = geschichte(partien, botId);
  if (!g.length) return Number.isFinite(bekannt) && bekannt > 0 ? { n: 0, bekannt: Math.floor(bekannt) } : { n: 0 };
  const letzte = g[0];
  let tage = null;
  try {
    const t = tagSchluessel(new Date(datumZahl(letzte)));
    if (istSchluessel(heute) && istSchluessel(t)) tage = tageZwischen(t, heute);
  } catch (e) { tage = null; }
  const m = memoVon(memo, letzte.id);
  const live = Array.isArray(letzte.liveKlassen) && letzte.liveKlassen.includes('brillant');
  return {
    n: g.length,
    letzte: letzte.ergebnis,
    letzteId: letzte.id,
    siegFolge: inFolge(g, 'sieg'),
    niederlageFolge: inFolge(g, 'niederlage'),
    // Niederlagen in Folge direkt vor der letzten Partie
    davorNiederlagen: inFolge(g, 'niederlage', 1),
    tage,
    zuege: zugZahl(letzte),
    genial: m ? m.g > 0 : live,
    botPatzer: m ? m.p > 0 : false,
  };
}

// Fairness-Sperre: FOLGE_NIEDERLAGEN Niederlagen in Folge gegen diesen Bot (aus der Lage) oder insgesamt (folgeGesamt)
export function gesperrt(l, folgeGesamt = () => 0) {
  if (l && Number.isFinite(l.niederlageFolge) && l.niederlageFolge >= FOLGE_NIEDERLAGEN) return true;
  let gesamt = 0;
  try { gesamt = Number(folgeGesamt()) || 0; } catch (e) { gesamt = 0; }
  return gesamt >= FOLGE_NIEDERLAGEN;
}

// Anlass ohne Sparsamkeit und Einstellung (Vorrang wie ANLAESSE)
export function anlassFuer(l, { folgeGesamt = () => 0 } = {}) {
  if (!l || !Number.isInteger(l.n)) return null;
  if (l.n === 0) return { anlass: l.bekannt > 0 ? 'wiedersehen' : 'kennenlernen', werte: null };
  if (l.letzte === 'sieg' && l.davorNiederlagen >= ERSTER_SIEG_NACH) return { anlass: 'ersterSieg', werte: null };
  if (Number.isFinite(l.tage) && l.tage >= PAUSE_TAGE) return { anlass: 'wiedersehen', werte: { tage: l.tage } };
  if (gesperrt(l, folgeGesamt)) return { anlass: 'mutmachen', werte: null };
  if (l.genial) return { anlass: 'genial', werte: null };
  if (l.botPatzer) return { anlass: 'botPatzer', werte: null };
  if (l.siegFolge >= SERIE_MIN) return { anlass: 'serieGegen', werte: null };
  if (l.letzte === 'sieg') return { anlass: 'rueckkampf', werte: l.zuege > 0 ? { zuege: l.zuege } : null };
  if (l.letzte === 'niederlage') return { anlass: 'revanche', werte: null };
  if (l.letzte === 'remis') return { anlass: 'remisZuletzt', werte: null };
  return null;
}

// Varianten, deren Platzhalter alle einen Wert haben
function nutzbar(liste, werte) {
  const aus = [];
  liste.forEach((satz, i) => {
    if (typeof satz !== 'string' || !satz.trim()) return;
    const ok = platzhalter(satz).every((n) => werte && werte[n] != null && werte[n] !== '');
    if (ok) aus.push(i);
  });
  return aus;
}

export function zufallFuer(heute, botId, n) {
  return zufallAus(seedAus(`gedaechtnis|${RECHENSTAND}|${heute}|${botId}|${n}`));
}

const MUT = Object.freeze({ anlass: 'mutmachen', werte: null });

export function begruessung({ botId, partien, heute, memo = null, bekannt = 0, folgeGesamt = () => 0, sprueche = 'an', saetze = SAETZE } = {}) {
  if (!botId || sprueche === 'aus' || !istSchluessel(heute)) return null;
  const l = lage({ partien, botId, heute, memo, bekannt });
  // Niederlagen in Folge insgesamt: hoechstens einmal gelesen
  let gesamt = null;
  const folge = () => {
    if (gesamt === null) {
      try { gesamt = Number(folgeGesamt()) || 0; } catch (e) { gesamt = 0; }
    }
    return gesamt;
  };
  let a = anlassFuer(l, { folgeGesamt: folge });
  if (!a) return null;
  // Unter der Fairness-Sperre spricht das Paket immer (nie Schweigen, sonst begruesst der Host oder ein anderes
  // Paket, und das kann sticheln): bei "Wenig" statt eines Anlasses ausserhalb von WENIG der Mut-Satz
  const sperre = gesperrt(l, folge);
  if (sprueche === 'wenig' && !WENIG.includes(a.anlass)) {
    if (!sperre) return null;
    a = MUT;
  }
  const stark = sperre || STARK.includes(a.anlass);
  let liste = saetze[a.anlass] && saetze[a.anlass][botId];
  if (!Array.isArray(liste) || !liste.length) return null;
  const z = zufallFuer(heute, botId, l.n);
  const wurf = z();
  if (!stark && wurf >= ANTEIL) return null;
  let frei = nutzbar(liste, a.werte);
  if (!frei.length && sperre && a.anlass !== MUT.anlass) {
    a = MUT;
    liste = (saetze[a.anlass] && saetze[a.anlass][botId]) || [];
    frei = nutzbar(liste, a.werte);
  }
  if (!frei.length) return null;
  const i = frei[Math.min(frei.length - 1, Math.floor(z() * frei.length))];
  return { anlass: variante(a.anlass, i), werte: a.werte, grund: a.anlass, stark, satz: liste[i], gesperrt: sperre,
    vorn: sperre || VORN.includes(a.anlass) };
}

// ---------- Revanche ----------
function eigeneStellung(fen) {
  if (!fen) return false;
  return String(fen).trim().split(/\s+/).slice(0, 4).join(' ') !== GRUNDSTELLUNG;
}
export function revanche(k) {
  // nur Leiter-Bots (angemeldete Gaeste, Bosse und Sparring haben stufe null und eigene Ablaeufe)
  if (!k || !k.bot || typeof k.bot.id !== 'string' || !Number.isInteger(k.bot.stufe)) return null;
  if (k.ergebnis !== 'niederlage' && k.ergebnis !== 'remis') return null;
  if ((k.modus || 'normal') !== 'normal') return null;
  const p = k.erg && k.erg.partie;
  if (!p || eigeneStellung(p.startFen)) return null;
  const farbe = k.farbe === 'b' ? 'w' : 'b';
  const params = { botId: k.bot.id, farbe };
  const t = p.tempo;
  if (t && typeof t === 'object' && Number.isFinite(t.grund)) params.tempo = { grund: t.grund, zuschlag: Number.isFinite(t.zuschlag) ? t.zuschlag : 0 };
  return params;
}

// ---------- Erzfeind ----------
const ganz = (x) => (Number.isFinite(x) && x > 0 ? Math.floor(x) : 0);
// Stufe der Leiter-Bots (Gleichstand beim Erzfeind: die hoehere Stufe, egal in welcher Reihenfolge der Fortschritt kommt)
const STUFE = new Map(BOTS.filter((b) => Number.isInteger(b.stufe)).map((b) => [b.id, b.stufe]));
export function erzfeind(fortschritt) {
  const bots = fortschritt && fortschritt.bots && typeof fortschritt.bots === 'object' ? fortschritt.bots : null;
  if (!bots) return null;
  let best = null;
  Object.keys(bots).forEach((botId) => {
    const b = bots[botId];
    const rang = STUFE.get(botId);
    if (!b || typeof b !== 'object' || rang === undefined) return;
    const n = ganz(b.niederlagen);
    const s = ganz(b.siege);
    if (n < ERZFEIND_MIN || n <= s) return;
    const besser = !best || n > best.niederlagen || (n === best.niederlagen && (n - s > best.niederlagen - best.siege
      || (n - s === best.niederlagen - best.siege && rang > best.rang)));
    if (besser) best = { botId, siege: s, niederlagen: n, rang };
  });
  return best ? { botId: best.botId, siege: best.siege, niederlagen: best.niederlagen } : null;
}

export function erzfeindZeile(e) {
  const s = ganz(e && e.siege);
  const n = ganz(e && e.niederlagen);
  return `Dein Erzfeind · ${s} ${s === 1 ? 'Sieg' : 'Siege'} · ${n} ${n === 1 ? 'Niederlage' : 'Niederlagen'}`;
}

export function erzfeindBezwungen({ fortschritt, botId, ergebnis, wertet: zaehlt, gefeiert = {} } = {}) {
  if (!zaehlt || ergebnis !== 'sieg' || !botId) return null;
  const bots = fortschritt && fortschritt.bots;
  if (!bots || !bots[botId]) return null;
  // Stand vor dieser Partie (der Sieg ist schon gebucht)
  const vorher = { bots: {} };
  for (const [id, b] of Object.entries(bots)) vorher.bots[id] = { ...b };
  vorher.bots[botId].siege = Math.max(0, ganz(bots[botId].siege) - 1);
  const e = erzfeind(vorher);
  if (!e || e.botId !== botId) return null;
  const schon = gefeiert && Number.isFinite(gefeiert[botId]) ? gefeiert[botId] : -1;
  if (schon >= e.niederlagen) return null;
  return { botId, niederlagen: e.niederlagen };
}

// ---------- Modul-Speicher ----------
export function memoAus(review, spielerFarbe) {
  const sf = spielerFarbe === 'b' ? 'b' : 'w';
  const zuege = review && Array.isArray(review.zuege) ? review.zuege : [];
  let g = 0;
  let p = 0;
  for (const z of zuege) {
    if (!z || typeof z !== 'object') continue;
    if (z.farbe === sf && z.klasse === 'brillant') g++;
    else if (z.farbe && z.farbe !== sf && z.klasse === 'patzer') p++;
  }
  return { g, p };
}

const ID_RE = /^[A-Za-z0-9_-]{1,40}$/;
export function normalisiereModul(m) {
  const aus = { v: RECHENSTAND, memo: [], erzfeind: {} };
  if (!m || typeof m !== 'object') return aus;
  if (Array.isArray(m.memo)) {
    aus.memo = m.memo.filter((e) => Array.isArray(e) && typeof e[0] === 'string' && ID_RE.test(e[0]))
      .map((e) => [e[0], ganz(e[1]), ganz(e[2])]).slice(-MEMO_MAX);
  }
  if (m.erzfeind && typeof m.erzfeind === 'object' && !Array.isArray(m.erzfeind)) {
    for (const [id, n] of Object.entries(m.erzfeind)) if (/^[a-z][a-z0-9-]{0,39}$/.test(id) && Number.isFinite(n)) aus.erzfeind[id] = ganz(n);
  }
  return aus;
}

export function merkeMemo(m, partieId, { g, p }) {
  const aus = normalisiereModul(m);
  if (typeof partieId !== 'string' || !ID_RE.test(partieId)) return aus;
  aus.memo = aus.memo.filter((e) => e[0] !== partieId);
  aus.memo.push([partieId, ganz(g), ganz(p)]);
  aus.memo = aus.memo.slice(-MEMO_MAX);
  return aus;
}
