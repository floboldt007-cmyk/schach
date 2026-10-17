// Feier-Warteschlange der Schach-Arena (Runde 4, Welle 0). Rein, ohne DOM, in Node testbar.
// Pakete melden Feier-Momente einer Partie; das Ergebnis-Overlay zeigt hoechstens BUDGET davon,
// der Rest erscheint spaeter still als Nachlese oben im Arena-Panel. Kein Zufall (Fairness-Regel 1).
// Gespeichert ueber ladeModul/speichereModul('feier') (hoechstens MODUL_BUDGET.feier = 6.000 Zeichen).
//
//   import { melde, fuerOverlay, nachlese } from './feier.js';
//   melde({ partieId, quelle: 'serie-rekord', titel: 'Längste Serie: ×7', text: '(vorher ×5)' });
//
// API:
//   BUDGET = { gross: 1, zeilen: 3, nachlese: 3 }   je Partie hoechstens 3 Eintraege im Overlay, davon
//                                                   hoechstens 1 grosser; Nachlese hoechstens 3
//   QUELLEN                                         feste Prioritaeten (BAUPLAN 3.6, W0+a: SPIELKONZEPT 3.10):
//                                                   quelle -> { art, prio }. Fuer diese Quellen gelten art und
//                                                   prio aus der Tabelle (rang und kette: alte Namen von klasse
//                                                   und marsch, gleiche Werte).
//   BRETT_FEIER = { dauerMs: 1800, kurzMs: 800 }    W0+a: Grenzen des Matt-Finishers (Ort partie:matt)
//   melde({ partieId, quelle, prio = 10, art = 'zeile', titel, text, symbol, klang }) -> true | false
//       idempotent: gleiche partieId + quelle + titel nur einmal (false beim zweiten Mal).
//       partieId darf null sein (dann nur Nachlese). quelle und titel Pflicht, art 'zeile' | 'gross',
//       sonst TypeError. Texte werden gekuerzt (titel 80, text 200 Zeichen).
//   fuerOverlay(partieId) -> Feier[]   die Eintraege dieser Partie fuers Overlay, nach prio absteigend.
//       Schon gezeigte bleiben dabei (das Overlay rendert bei jedem fuelle neu, auch beim Nachtrag),
//       freie Plaetze fuellen neue Meldungen nach prio. Markiert sie als gezeigt.
//   nachlese() -> Feier[]   Ungezeigtes (hoechstens 3, juenger als 7 Tage, nach prio), danach leer.
//       Der Host merkt sich das Ergebnis fuer die Lebensdauer seines Screens.
//   setzeUhr(fn | null)     nur Tests: eigene Uhr (ms), null = Date.now
// Feier = eingefroren { partieId, quelle, prio, art, titel, text, symbol, klang, zeit (ms) }
import { ladeModul, speichereModul, MODUL_BUDGET } from './storage.js';

export const BUDGET = Object.freeze({ gross: 1, zeilen: 3, nachlese: 3 });

// Feste Prioritaeten fuer alle Pakete (SPIELKONZEPT 3.10, W0+a; ergaenzt die Tabelle aus Welle 0).
// klasse ersetzt rang, marsch ersetzt kette: die alten Namen bleiben mit denselben Werten gueltig.
// tageskrone ist seit 3.10 eine Zeile (vorher gross).
export const QUELLEN = Object.freeze({
  'erster-sieg': Object.freeze({ art: 'gross', prio: 95 }),
  klasse: Object.freeze({ art: 'gross', prio: 90 }),
  rang: Object.freeze({ art: 'gross', prio: 90 }),
  'boss-siegel': Object.freeze({ art: 'gross', prio: 88 }),
  erzfeind: Object.freeze({ art: 'gross', prio: 85 }),
  'liga-saison': Object.freeze({ art: 'gross', prio: 82 }),
  'bot-rekord': Object.freeze({ art: 'gross', prio: 78 }),
  'medaille-gold': Object.freeze({ art: 'gross', prio: 76 }),
  'level-titel': Object.freeze({ art: 'gross', prio: 75 }),
  meilenstein: Object.freeze({ art: 'gross', prio: 72 }),
  bestmarke: Object.freeze({ art: 'gross', prio: 70 }),
  umwandlung: Object.freeze({ art: 'gross', prio: 66 }),
  'serie-rekord': Object.freeze({ art: 'zeile', prio: 60 }),
  rekord: Object.freeze({ art: 'zeile', prio: 58 }),
  level: Object.freeze({ art: 'zeile', prio: 55 }),
  marsch: Object.freeze({ art: 'zeile', prio: 50 }),
  kette: Object.freeze({ art: 'zeile', prio: 50 }),
  liga: Object.freeze({ art: 'zeile', prio: 45 }),
  siegeslauf: Object.freeze({ art: 'zeile', prio: 44 }),
  medaille: Object.freeze({ art: 'zeile', prio: 40 }),
  tageskrone: Object.freeze({ art: 'zeile', prio: 38 }),
  tagesdreier: Object.freeze({ art: 'zeile', prio: 35 }),
  karten: Object.freeze({ art: 'zeile', prio: 30 }),
});

// Feier auf dem Brett (Matt-Finisher, SPIELKONZEPT 3.9): laeuft vor dem Ergebnis, zaehlt nicht ins Budget und
// ersetzt jeden anderen Brett-Effekt. Hoechstens dauerMs (volle Laenge), Kurzfassung hoechstens kurzMs.
// partie.js wartet am Aufruf-Ort partie:matt nie laenger als dauerMs (Fairness-Test 5.3).
export const BRETT_FEIER = Object.freeze({ dauerMs: 1800, kurzMs: 800 });

const MODUL = 'feier';
const TAG_MS = 24 * 60 * 60 * 1000;
const NACHLESE_MS = 7 * TAG_MS;
const MAX_EINTRAEGE = 16;
const MAX_GEMELDET = 40;
const ARTEN = ['zeile', 'gross'];
const STANDARD = { eintraege: [], gemeldet: [] };

let uhr = () => Date.now();
export function setzeUhr(fn) {
  uhr = typeof fn === 'function' ? fn : () => Date.now();
}

const kuerze = (x, max) => (x == null ? null : String(x).slice(0, max));

// kurzer, fester Hash (fuer den Merker der schon gemeldeten Feiern)
function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(36);
}
const schluessel = (partieId, quelle, titel) => `${partieId || ''}|${quelle}|${hash(titel)}`;

function lade() {
  const st = ladeModul(MODUL, STANDARD);
  const eintraege = Array.isArray(st.eintraege)
    ? st.eintraege.filter((e) => e && typeof e === 'object' && typeof e.titel === 'string' && typeof e.quelle === 'string')
    : [];
  const gemeldet = Array.isArray(st.gemeldet) ? st.gemeldet.filter((k) => typeof k === 'string') : [];
  return { eintraege, gemeldet };
}

// Aelteste zuerst opfern: erst schon Erledigtes, dann Neues
function opfereAeltesten(st) {
  if (!st.eintraege.length) return false;
  let i = -1;
  st.eintraege.forEach((e, k) => {
    if (e.status === 'neu') return;
    if (i < 0 || e.zeit < st.eintraege[i].zeit) i = k;
  });
  if (i < 0) st.eintraege.forEach((e, k) => { if (i < 0 || e.zeit < st.eintraege[i].zeit) i = k; });
  st.eintraege.splice(i, 1);
  return true;
}

function speichere(st) {
  const grenze = uhr() - NACHLESE_MS;
  st.eintraege = st.eintraege.filter((e) => e.zeit > grenze);
  while (st.eintraege.length > MAX_EINTRAEGE) opfereAeltesten(st);
  if (st.gemeldet.length > MAX_GEMELDET) st.gemeldet = st.gemeldet.slice(-MAX_GEMELDET);
  // im Budget bleiben (Reserve fuer die Schreibweise)
  const max = MODUL_BUDGET[MODUL] - 50;
  while (JSON.stringify(st).length > max) {
    if (!opfereAeltesten(st)) {
      if (!st.gemeldet.length) break;
      st.gemeldet = st.gemeldet.slice(Math.ceil(st.gemeldet.length / 2));
    }
  }
  return speichereModul(MODUL, st);
}

const nachPrio = (a, b) => b.prio - a.prio || a.zeit - b.zeit;

function kopie(e) {
  return Object.freeze({
    partieId: e.partieId, quelle: e.quelle, prio: e.prio, art: e.art, titel: e.titel,
    text: e.text, symbol: e.symbol, klang: e.klang, zeit: e.zeit,
  });
}

export function melde({ partieId = null, quelle, prio, art = 'zeile', titel, text: t = null, symbol = null, klang = null } = {}) {
  if (typeof quelle !== 'string' || !quelle) throw new TypeError('melde: quelle fehlt');
  if (typeof titel !== 'string' || !titel.trim()) throw new TypeError('melde: titel fehlt');
  const fest = Object.prototype.hasOwnProperty.call(QUELLEN, quelle) ? QUELLEN[quelle] : null;
  const a = fest ? fest.art : art;
  if (!ARTEN.includes(a)) throw new TypeError('melde: art muss "zeile" oder "gross" sein');
  const p = fest ? fest.prio : (Number.isFinite(prio) ? prio : 10);
  const id = partieId == null ? null : kuerze(partieId, 40);
  const ti = kuerze(titel, 80);
  const k = schluessel(id, quelle, ti);
  const st = lade();
  if (st.gemeldet.includes(k) || st.eintraege.some((e) => schluessel(e.partieId, e.quelle, e.titel) === k)) return false;
  st.eintraege.push({
    partieId: id, quelle: kuerze(quelle, 40), prio: p, art: a, titel: ti, text: kuerze(t, 200),
    symbol: kuerze(symbol, 60), klang: kuerze(klang, 40), zeit: uhr(), status: 'neu',
  });
  st.gemeldet.push(k);
  speichere(st);
  return true;
}

export function fuerOverlay(partieId) {
  if (partieId == null) return [];
  const st = lade();
  const dieser = st.eintraege.filter((e) => e.partieId === partieId && e.status !== 'nachlese');
  const gezeigt = dieser.filter((e) => e.status === 'overlay');
  let anzahl = gezeigt.length;
  let gross = gezeigt.filter((e) => e.art === 'gross').length;
  let geaendert = false;
  for (const e of dieser.filter((x) => x.status === 'neu').sort(nachPrio)) {
    if (anzahl >= BUDGET.zeilen) break;
    if (e.art === 'gross' && gross >= BUDGET.gross) continue;
    e.status = 'overlay';
    anzahl++;
    if (e.art === 'gross') gross++;
    geaendert = true;
  }
  if (geaendert) speichere(st);
  return dieser.filter((e) => e.status === 'overlay').sort(nachPrio).map(kopie);
}

export function nachlese() {
  const st = lade();
  const offen = st.eintraege.filter((e) => e.status === 'neu');
  if (!offen.length) return [];
  const grenze = uhr() - NACHLESE_MS;
  const frisch = offen.filter((e) => e.zeit > grenze).sort(nachPrio).slice(0, BUDGET.nachlese);
  for (const e of offen) e.status = 'nachlese';
  speichere(st);
  return frisch.map(kopie);
}
