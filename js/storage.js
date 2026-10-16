// Speicher der Schach-Arena (localStorage): Einstellungen, Fortschritt (Sterne,
// Freischaltung), gespeicherte Partien, Spielanalysen und die laufende Partie.
// Robust: kaputte oder fehlende Daten liefern Standardwerte, ein gesperrter Speicher
// (privater Modus) faellt auf einen Speicher im Arbeitsspeicher zurueck.
// Rein ohne DOM, in Node testbar (setzeSpeicher(fake)).
//
// Runde 4 (Welle 0), Zusaetze:
//   MODI = ['normal', 'uebung']; wertet(p) -> boolean ((p.modus || 'normal') === 'normal' und keine eigene
//     Stellung: startFen leer oder gleich der Grundstellung).
//     Nicht wertende Partien (Uebung, Partie aus einer Stellung) buchen keine Sterne, keine Bot-Zaehler,
//     keine Freischaltung, keinen Bestwert, keine Schatzkiste und zaehlen nicht in statistik().
//     speicherePartie und ergaenzeAnalyse liefern zusaetzlich { wertet }.
//   Partie-Datensatz zusaetzlich: modus, ziel (nur Uebung: { partieId, ply, besterZug, alterZug,
//     alterSanDe, gewinnVorher }), extra (Objekt je Paket, JSON hoechstens EXTRA_MAX Zeichen, sonst
//     verworfen mit Warnung), maxSerie. Laufende Partie zusaetzlich modus, ziel, extra, liveTrivial
//     (ladeLaufendePartie prueft die Typen).
//   Modul-Speicher der Pakete unter schach-arena:v1:modul:<name>, Budget je Modul in MODUL_BUDGET:
//     ladeModul(name, standard) -> gespeicherte Daten oder tiefe Kopie von standard
//     speichereModul(name, daten) -> { ok, zeichen, grund? }   grund: 'unbekannt' | 'budget' | 'voll'
//   speicherStand() -> { zeichen, grenze, teile: { partien, reviews, fortschritt, module: { name: n },
//     sonst, fremd } }   (Zeichen = Schluessel + Wert; fortschritt umfasst Einstellungen und laufende
//     Partie; fremd = andere Seiten derselben Herkunft, die sich den Speicher teilen)
//   rohSpeicher() -> { praefix, schluessel(), lies(k), schreib(k, text), entferne(k) }  nur eigene
//     Schluessel, nur fuer die Sicherung
//   Reviews werden kompakt gespeichert (review.js kompaktReview/ergaenzeReviewFelder), MAX_REVIEWS 20.
//   Scheitert ein Schreiben trotz geopferter Analysen, kommt das Ereignis speicher:fehler
//     { schluessel, grund: 'voll' | 'fehler' }. Fortschritt wird immer vor der Partienliste geschrieben.
import { BOTS } from './bots.js';
import { sende } from './ereignisse.js';
import { kompaktReview, ergaenzeReviewFelder } from './review.js';

// Zug-Klassen (wie review.js KLASSEN), zum Pruefen gespeicherter Daten
const KLASSEN_LISTE = ['brillant', 'stark', 'bester', 'exzellent', 'gut', 'buch', 'ungenau', 'fehler', 'verpasst', 'patzer', 'erzwungen'];

export const SPEICHER_VERSION = 1;
const P = 'schach-arena:v1:';
const K = {
  einstellungen: P + 'einstellungen',
  fortschritt: P + 'fortschritt',
  partien: P + 'partien',
  laufend: P + 'laufend',
  review: (id) => P + 'review:' + id,
  modul: (name) => P + 'modul:' + name,
};

// So viele Spielanalysen bleiben gespeichert (aeltere lassen sich neu berechnen)
export const MAX_REVIEWS = 20;
// So viele Partien bleiben in der Liste
export const MAX_PARTIEN = 300;
export const GENAUIGKEIT_STERN = 80;
// Bestwert der Genauigkeit erst ab so vielen eigenen Zuegen (eine Aufgabe nach einem Zug zaehlt nicht)
export const BESTWERT_MIN_ZUEGE = 10;

// Spielmodi (weitere Modi, z. B. 'boss', nur mit einer neuen Welle)
export const MODI = Object.freeze(['normal', 'uebung']);
// Zeichen fuer partie.extra (alle Pakete zusammen)
export const EXTRA_MAX = 400;
// Budget je Paket-Modul in Zeichen
export const MODUL_BUDGET = Object.freeze({
  kartei: 160000, profil: 60000, alltag: 40000, uebung: 20000, bots: 20000,
  taktik: 8000, start: 6000, feier: 6000, serie: 4000,
});
// Grenze des Speichers (Safari ca. 5 MB je Herkunft, als UTF-16 ca. 2,5 Mio. Zeichen)
export const SPEICHER_GRENZE = 2500000;

// Zaehlt die Partie fuer Sterne, Freischaltung, Bestwerte und Statistik? Nur im Modus 'normal' und nicht
// aus einer eigenen Stellung. Eine startFen gleich der Grundstellung (Stellung, Zugrecht, Rochaderechte,
// en passant) ist keine eigene Stellung (wie in verlauf.js).
const GRUNDSTELLUNG = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -';
function eigeneStellung(fen) {
  if (!fen) return false;
  return String(fen).trim().split(/\s+/).slice(0, 4).join(' ') !== GRUNDSTELLUNG;
}
export function wertet(p) {
  return !!p && (p.modus || 'normal') === 'normal' && !eigeneStellung(p.startFen);
}

export const STANDARD_EINSTELLUNGEN = Object.freeze({
  klang: true,           // Klaenge an
  balken: true,          // Bewertungsbalken zeigen
  liveBewertung: true,   // Symbol + Coach nach jedem eigenen Zug zeigen (gerechnet wird immer)
  brett: 'nacht',        // 'nacht' | 'gruen' | 'holz'
  koordinaten: true,
  tiefe: 14,             // Rechentiefe der Live-Bewertung
});

// ---------------------------------------------------------------------------
// Speicher-Zugang
// ---------------------------------------------------------------------------
function speicherImArbeitsspeicher() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
    key: (i) => [...m.keys()][i] ?? null,
    get length() { return m.size; },
  };
}

function standardSpeicher() {
  try {
    const s = globalThis.localStorage;
    if (!s) return speicherImArbeitsspeicher();
    const t = P + 'test';
    s.setItem(t, '1');
    s.removeItem(t);
    return s;
  } catch (e) {
    return speicherImArbeitsspeicher();
  }
}

let speicher = null;
function sp() {
  if (!speicher) speicher = standardSpeicher();
  return speicher;
}

// Fuer Tests: eigenen Speicher setzen (null = Standard)
export function setzeSpeicher(s) {
  speicher = s;
}

function lies(k, rueckfall) {
  try {
    const t = sp().getItem(k);
    if (t == null) return rueckfall;
    const v = JSON.parse(t);
    return v == null ? rueckfall : v;
  } catch (e) {
    return rueckfall;
  }
}

function istVoll(e) {
  return e && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22 || e.code === 1014);
}

// Schreibt; bei vollem Speicher werden die aeltesten Analysen geopfert und erneut versucht.
// Scheitert es trotzdem, kommt das Ereignis speicher:fehler.
function schreib(k, v) {
  return schreibText(k, JSON.stringify(v));
}

function schreibText(k, t) {
  let grund = 'voll';
  for (let versuch = 0; versuch < 30; versuch++) {
    try {
      sp().setItem(k, t);
      return true;
    } catch (e) {
      if (!istVoll(e)) {
        grund = 'fehler';
        break;
      }
      if (!entferneAeltesteReview(k)) break;
    }
  }
  try { sende('speicher:fehler', { schluessel: k, grund }); } catch (e) { /* egal */ }
  return false;
}

function entferne(k) {
  try { sp().removeItem(k); } catch (e) { /* egal */ }
}

// ---------------------------------------------------------------------------
// Einstellungen
// ---------------------------------------------------------------------------
export function ladeEinstellungen() {
  const roh = lies(K.einstellungen, {});
  const e = { ...STANDARD_EINSTELLUNGEN };
  if (roh && typeof roh === 'object') {
    for (const [k, std] of Object.entries(STANDARD_EINSTELLUNGEN)) {
      if (typeof roh[k] === typeof std) e[k] = roh[k];
    }
  }
  if (!['nacht', 'gruen', 'holz'].includes(e.brett)) e.brett = STANDARD_EINSTELLUNGEN.brett;
  e.tiefe = Math.max(8, Math.min(20, Math.round(e.tiefe)));
  return e;
}

export function speichereEinstellungen(teil) {
  const e = { ...ladeEinstellungen(), ...(teil || {}) };
  schreib(K.einstellungen, e);
  return ladeEinstellungen();
}

// ---------------------------------------------------------------------------
// Fortschritt
// Fortschritt = { bots: { [botId]: { sterne: [bool,bool,bool], partien, siege, remis,
//                 niederlagen, besteGenauigkeit } }, brillanteZuege: [{ partieId, ply, san, botId, datum }] }
// Stern 1: Sieg. Stern 2: Sieg mit Genauigkeit >= 80 %. Stern 3: Sieg ohne Hinweis und
// ohne Zuruecknahme. Jeder Stern wird einzeln und fuer immer verdient (bester Stand zaehlt).
// ---------------------------------------------------------------------------
function leererBot() {
  return { sterne: [false, false, false], partien: 0, siege: 0, remis: 0, niederlagen: 0, besteGenauigkeit: null };
}

export function ladeFortschritt() {
  const roh = lies(K.fortschritt, {});
  const f = { bots: {}, brillanteZuege: [] };
  for (const b of BOTS) {
    const r = roh && roh.bots && roh.bots[b.id];
    const x = leererBot();
    if (r && typeof r === 'object') {
      if (Array.isArray(r.sterne)) x.sterne = [0, 1, 2].map((i) => !!r.sterne[i]);
      for (const k of ['partien', 'siege', 'remis', 'niederlagen']) if (Number.isFinite(r[k])) x[k] = r[k];
      if (Number.isFinite(r.besteGenauigkeit)) x.besteGenauigkeit = r.besteGenauigkeit;
    }
    f.bots[b.id] = x;
  }
  if (roh && Array.isArray(roh.brillanteZuege)) f.brillanteZuege = roh.brillanteZuege.filter((z) => z && typeof z === 'object');
  return f;
}

function speichereFortschritt(f) {
  schreib(K.fortschritt, f);
}

export function sterneZahl(botId, f = ladeFortschritt()) {
  const b = f.bots[botId];
  return b ? b.sterne.filter(Boolean).length : 0;
}

export function gesamtSterne(f = ladeFortschritt()) {
  return BOTS.reduce((s, b) => s + sterneZahl(b.id, f), 0);
}

export function besiegteBots(f = ladeFortschritt()) {
  return BOTS.filter((b) => f.bots[b.id] && f.bots[b.id].sterne[0]).length;
}

// Stufe 1 ist immer frei, jede weitere, sobald die Stufe davor besiegt ist.
export function istFreigeschaltet(stufe, f = ladeFortschritt()) {
  if (stufe <= 1) return true;
  const vorher = BOTS.find((b) => b.stufe === stufe - 1);
  return !!(vorher && f.bots[vorher.id] && f.bots[vorher.id].sterne[0]);
}

export function hoechsteFreieStufe(f = ladeFortschritt()) {
  let s = 1;
  for (const b of [...BOTS].sort((a, c) => a.stufe - c.stufe)) if (istFreigeschaltet(b.stufe, f)) s = Math.max(s, b.stufe);
  return s;
}

// Naechster Gegner: die niedrigste freie Stufe, die noch nicht besiegt ist (sonst die hoechste)
export function naechsterGegner(f = ladeFortschritt()) {
  const sortiert = [...BOTS].sort((a, c) => a.stufe - c.stufe);
  for (const b of sortiert) if (istFreigeschaltet(b.stufe, f) && !f.bots[b.id].sterne[0]) return b;
  return sortiert[sortiert.length - 1];
}

// Anzahl der eigenen Zuege einer Partie (Startfarbe aus startFen)
export function eigeneZuege(p) {
  const n = p && Array.isArray(p.zuege) ? p.zuege.length : 0;
  const start = p && typeof p.startFen === 'string' && p.startFen.split(' ')[1] === 'b' ? 'b' : 'w';
  const ich = p && p.spielerFarbe === 'b' ? 'b' : 'w';
  return start === ich ? Math.ceil(n / 2) : Math.floor(n / 2);
}

function zaehltFuerBestwert(p) {
  return Number.isFinite(p.genauigkeit) && eigeneZuege(p) >= BESTWERT_MIN_ZUEGE;
}

// Nicht wertende Partien (Uebung, eigene Stellung) bekommen nie Sterne
export function sterneFuerPartie(p) {
  const sieg = !!p && p.ergebnis === 'sieg' && wertet(p);
  return [
    sieg,
    sieg && Number.isFinite(p.genauigkeit) && p.genauigkeit >= GENAUIGKEIT_STERN,
    sieg && !(p.hinweise > 0) && !(p.zuruecknahmen > 0),
  ];
}

// ---------------------------------------------------------------------------
// Partien
// Partie = { id, datum (ISO), botId, botStufe, spielerFarbe 'w'|'b', startFen, zuege: [uci],
//            san: [san englisch], ergebnis 'sieg'|'niederlage'|'remis',
//            grund 'matt'|'aufgabe'|'patt'|'wiederholung'|'50-zuege'|'material',
//            hinweise, zuruecknahmen, liveKlassen: [klasse|null je Ply],
//            genauigkeit (Spieler, 0..100|null), genauigkeitBot, spielstaerke (Elo-Schaetzung|null),
//            eroeffnung (Name|null), sterne [bool,bool,bool] (wird beim Speichern berechnet),
//            modus 'normal'|'uebung', ziel (nur Uebung), extra (Objekt je Paket), maxSerie }
// Die Spielanalyse (Review) liegt getrennt unter review:<id> (nur die letzten MAX_REVIEWS).
// ---------------------------------------------------------------------------
const UCI_RE = /^[a-h][1-8][a-h][1-8][qrbn]?$/;

// Ziel einer Uebung: { partieId, ply, besterZug, alterZug, alterSanDe, gewinnVorher } oder null
function pruefeZiel(z) {
  if (!z || typeof z !== 'object' || Array.isArray(z)) return null;
  if (typeof z.partieId !== 'string' || !z.partieId || z.partieId.length > 40) return null;
  if (!Number.isInteger(z.ply) || z.ply < 0 || z.ply > 2000) return null;
  if (typeof z.besterZug !== 'string' || !UCI_RE.test(z.besterZug)) return null;
  if (typeof z.alterZug !== 'string' || !UCI_RE.test(z.alterZug)) return null;
  return {
    partieId: z.partieId,
    ply: z.ply,
    besterZug: z.besterZug,
    alterZug: z.alterZug,
    alterSanDe: typeof z.alterSanDe === 'string' ? z.alterSanDe.slice(0, 16) : null,
    gewinnVorher: Number.isFinite(z.gewinnVorher) ? Math.max(0, Math.min(1, z.gewinnVorher)) : null,
  };
}

// Zusatzdaten der Pakete: einfaches Objekt, als JSON hoechstens EXTRA_MAX Zeichen, sonst null (mit Warnung)
function pruefeExtra(extra) {
  if (extra == null) return null;
  if (typeof extra !== 'object' || Array.isArray(extra)) {
    warne('extra ist kein Objekt und wird verworfen');
    return null;
  }
  let t = '';
  try { t = JSON.stringify(extra); } catch (e) { t = null; }
  if (t == null) {
    warne('extra laesst sich nicht speichern und wird verworfen');
    return null;
  }
  if (t.length > EXTRA_MAX) {
    warne(`extra hat ${t.length} Zeichen (hoechstens ${EXTRA_MAX}) und wird verworfen`);
    return null;
  }
  return t === '{}' ? null : JSON.parse(t);
}

function warne(text) {
  try { console.warn('Speicher: ' + text); } catch (e) { /* egal */ }
}

// Neue Felder einer Partie in Form bringen (modus, ziel, extra, maxSerie)
function normalisiere(p) {
  p.modus = p.modus == null || p.modus === '' ? 'normal' : String(p.modus);
  const ziel = p.modus === 'uebung' ? pruefeZiel(p.ziel) : null;
  if (ziel) p.ziel = ziel;
  else delete p.ziel;
  const extra = pruefeExtra(p.extra);
  if (extra) p.extra = extra;
  else delete p.extra;
  if (Number.isFinite(p.maxSerie)) p.maxSerie = Math.max(0, Math.round(p.maxSerie));
  else delete p.maxSerie;
  return p;
}
export function neueId(datum = new Date()) {
  return 'p' + datum.getTime().toString(36) + Math.floor(Math.random() * 1296).toString(36).padStart(2, '0');
}

function ladeListe() {
  const l = lies(K.partien, []);
  return Array.isArray(l) ? l.filter((p) => p && typeof p === 'object' && typeof p.id === 'string') : [];
}

// Neueste zuerst, ohne Review
export function ladePartien() {
  return ladeListe().sort((a, b) => String(b.datum).localeCompare(String(a.datum)));
}

export function ladePartie(id) {
  return ladeListe().find((p) => p.id === id) || null;
}

// Speichert eine beendete Partie und bucht den Fortschritt (nur beim ersten Speichern und nur, wenn
// die Partie wertet). Reihenfolge: erst der kleine Fortschritt, dann die Liste, dann die Analyse.
// Rueckgabe { partie, neueSterne: [bool,bool,bool] (in dieser Partie neu verdient),
//             neuFreigeschaltet: Bot|null, brillant: Anzahl neu gesammelter Brillant-Zuege, wertet }
export function speicherePartie(partie, review = null) {
  if (!partie || typeof partie !== 'object') throw new Error('Partie fehlt');
  const p = normalisiere({ ...partie });
  if (!p.id) p.id = neueId();
  if (!p.datum) p.datum = new Date().toISOString();
  const wert = wertet(p);
  p.sterne = sterneFuerPartie(p);

  const liste = ladeListe();
  const schonDa = liste.some((x) => x.id === p.id);
  const neu = liste.filter((x) => x.id !== p.id);
  neu.push(p);
  neu.sort((a, b) => String(b.datum).localeCompare(String(a.datum)));
  const behalten = neu.slice(0, MAX_PARTIEN);

  const ergebnis = { partie: p, neueSterne: [false, false, false], neuFreigeschaltet: null, brillant: 0, wertet: wert };
  if (!schonDa && wert) bucheFortschritt(p, review, ergebnis);
  for (const weg of neu.slice(MAX_PARTIEN)) entferne(K.review(weg.id));
  schreib(K.partien, behalten);
  if (review) speichereReview(p.id, review);
  return ergebnis;
}

// Fortschritt einer neu gespeicherten, wertenden Partie buchen (Zaehler, Bestwert, Sterne,
// Freischaltung, Schatzkiste) und sofort schreiben
function bucheFortschritt(p, review, ergebnis) {
  const f = ladeFortschritt();
  const b = f.bots[p.botId];
  if (b) {
    const bot = BOTS.find((x) => x.id === p.botId);
    const vorherFrei = bot ? BOTS.filter((x) => istFreigeschaltet(x.stufe, f)).map((x) => x.id) : [];
    b.partien++;
    if (p.ergebnis === 'sieg') b.siege++;
    else if (p.ergebnis === 'remis') b.remis++;
    else b.niederlagen++;
    if (zaehltFuerBestwert(p) && (b.besteGenauigkeit == null || p.genauigkeit > b.besteGenauigkeit)) b.besteGenauigkeit = p.genauigkeit;
    p.sterne.forEach((s, i) => {
      if (s && !b.sterne[i]) {
        b.sterne[i] = true;
        ergebnis.neueSterne[i] = true;
      }
    });
    const jetztFrei = BOTS.filter((x) => istFreigeschaltet(x.stufe, f)).map((x) => x.id);
    const neuFrei = jetztFrei.filter((id) => !vorherFrei.includes(id));
    if (neuFrei.length) ergebnis.neuFreigeschaltet = BOTS.find((x) => x.id === neuFrei[0]) || null;
  }
  ergebnis.brillant = sammleBrillante(f, p, review);
  speichereFortschritt(f);
}

// Brillant-Sammlung (Schatzkiste); jeder Zug nur einmal
function sammleBrillante(f, p, review) {
  let n = 0;
  const zuege = review && Array.isArray(review.zuege) ? review.zuege : [];
  for (const z of zuege) {
    if (z && z.klasse === 'brillant' && z.farbe === p.spielerFarbe
      && !f.brillanteZuege.some((x) => x.partieId === p.id && x.ply === z.ply)) {
      f.brillanteZuege.push({ partieId: p.id, ply: z.ply, san: z.san, botId: p.botId, datum: p.datum });
      n++;
    }
  }
  return n;
}

// Traegt die Spielanalyse einer schon gespeicherten Partie nach (die Partie wird am Ende sofort
// gesichert, die Analyse kommt spaeter): Genauigkeit, Spielstaerke, Eroeffnung, Review,
// Brillant-Zuege und Bestwert. Sterne werden nur dazugewonnen, nie entzogen.
// Ohne Review: { genauigkeit } (z. B. aus der Live-Bewertung) nur, wenn noch keine da ist.
// Nicht wertende Partien: keine Sterne, kein Bestwert, keine Schatzkiste.
// Rueckgabe { partie, neueSterne, brillant, wertet } oder null.
export function ergaenzeAnalyse(id, review = null, { genauigkeit = null } = {}) {
  const liste = ladeListe();
  const i = liste.findIndex((x) => x.id === id);
  if (i < 0) return null;
  const p = { ...liste[i] };
  const sf = p.spielerFarbe === 'b' ? 'b' : 'w';
  const bf = sf === 'w' ? 'b' : 'w';
  if (review && review.genauigkeit) {
    if (Number.isFinite(review.genauigkeit[sf])) p.genauigkeit = review.genauigkeit[sf];
    if (Number.isFinite(review.genauigkeit[bf])) p.genauigkeitBot = review.genauigkeit[bf];
    if (review.spielstaerke && Number.isFinite(review.spielstaerke[sf])) p.spielstaerke = review.spielstaerke[sf];
    if (review.eroeffnung) p.eroeffnung = review.eroeffnung;
  } else if (Number.isFinite(genauigkeit) && !Number.isFinite(p.genauigkeit)) {
    p.genauigkeit = genauigkeit;
  }
  const wert = wertet(p);
  p.sterne = sterneFuerPartie(p);
  liste[i] = p;

  const ergebnis = { partie: p, neueSterne: [false, false, false], brillant: 0, wertet: wert };
  // erst der kleine Fortschritt, dann die Liste
  if (wert) {
    const f = ladeFortschritt();
    const b = f.bots[p.botId];
    if (b) {
      if (zaehltFuerBestwert(p) && (b.besteGenauigkeit == null || p.genauigkeit > b.besteGenauigkeit)) b.besteGenauigkeit = p.genauigkeit;
      p.sterne.forEach((s, k) => {
        if (s && !b.sterne[k]) {
          b.sterne[k] = true;
          ergebnis.neueSterne[k] = true;
        }
      });
    }
    ergebnis.brillant = sammleBrillante(f, p, review);
    speichereFortschritt(f);
  }
  schreib(K.partien, liste);
  if (review) speichereReview(id, review);
  return ergebnis;
}

export function aktualisierePartie(id, teil) {
  const liste = ladeListe();
  const i = liste.findIndex((p) => p.id === id);
  if (i < 0) return null;
  // Fortschritt-relevante Felder bleiben, wie sie beim Speichern waren (auch alles, was wertet() prueft)
  const { id: _i, sterne: _s, ergebnis: _e, botId: _b, modus: _m, startFen: _f, ...rest } = teil || {};
  liste[i] = { ...liste[i], ...rest };
  schreib(K.partien, liste);
  return liste[i];
}

export function loeschePartie(id) {
  schreib(K.partien, ladeListe().filter((p) => p.id !== id));
  entferne(K.review(id));
}

// ---------------------------------------------------------------------------
// Spielanalysen (Review-Objekte aus review.js analysierePartie)
// ---------------------------------------------------------------------------
// Gespeichert wird kompakt (ohne ableitbare Felder), geladen wird wieder vollstaendig.
// Alte, volle Reviews laden unveraendert.
export function ladeReview(id) {
  const r = lies(K.review(id), null);
  if (!r || typeof r !== 'object' || !Array.isArray(r.zuege)) return null;
  try { return ergaenzeReviewFelder(r); } catch (e) { return r; }
}

export function speichereReview(id, review) {
  if (!review) return false;
  let kompakt = review;
  try { kompakt = kompaktReview(review); } catch (e) { kompakt = review; }
  const ok = schreib(K.review(id), kompakt);
  // Nur die neuesten MAX_REVIEWS behalten
  const ids = ladePartien().map((p) => p.id);
  const mitReview = ids.filter((x) => hatReview(x));
  for (const alt of mitReview.slice(MAX_REVIEWS)) if (alt !== id) entferne(K.review(alt));
  return ok;
}

export function hatReview(id) {
  try { return sp().getItem(K.review(id)) != null; } catch (e) { return false; }
}

function entferneAeltesteReview(ausser) {
  const ids = ladePartien().map((p) => p.id).filter((x) => K.review(x) !== ausser && hatReview(x));
  const alt = ids[ids.length - 1];
  if (!alt) return false;
  entferne(K.review(alt));
  return true;
}

// ---------------------------------------------------------------------------
// Laufende Partie (zum Fortsetzen, wenn das iPad den Tab beendet)
// Laufend = { botId, spielerFarbe, startFen, zuege: [uci], hinweise, zuruecknahmen,
//             liveKlassen: [klasse|null], gestartet (ISO),
//             modus 'normal'|'uebung', ziel (nur Uebung) | null, extra {}, liveTrivial: [bool] }
// ---------------------------------------------------------------------------
export function speichereLaufendePartie(stand) {
  if (!stand) return loescheLaufendePartie();
  const s = { ...stand };
  if (s.extra != null) {
    const extra = pruefeExtra(s.extra);
    if (extra) s.extra = extra;
    else delete s.extra;
  }
  schreib(K.laufend, s);
}

export function ladeLaufendePartie() {
  const s = lies(K.laufend, null);
  if (!s || typeof s !== 'object' || !Array.isArray(s.zuege) || !BOTS.some((b) => b.id === s.botId)) return null;
  if (s.startFen != null && typeof s.startFen !== 'string') return null;
  // von Hand veraenderte Daten: nur bekannte Klassen und gueltige Zuege uebernehmen
  const zuege = s.zuege.filter((u) => typeof u === 'string' && UCI_RE.test(u));
  if (zuege.length !== s.zuege.length) return null;
  const liveKlassen = Array.isArray(s.liveKlassen) ? s.liveKlassen.map((k) => (KLASSEN_LISTE.includes(k) ? k : null)) : [];
  const liveTrivial = Array.isArray(s.liveTrivial) ? s.liveTrivial.map((x) => x === true) : [];
  const modus = MODI.includes(s.modus) ? s.modus : 'normal';
  const ziel = modus === 'uebung' ? pruefeZiel(s.ziel) : null;
  const extra = pruefeExtra(s.extra) || {};
  return { ...s, liveKlassen, liveTrivial, modus, ziel, extra };
}

export function loescheLaufendePartie() {
  entferne(K.laufend);
}

// ---------------------------------------------------------------------------
// Statistik ueber alle wertenden Partien (ohne Uebungen und Partien aus einer Stellung).
// Durchschnitts-Genauigkeit nur aus Partien ab BESTWERT_MIN_ZUEGE eigenen Zuegen.
// ---------------------------------------------------------------------------
export function statistik() {
  const l = ladePartien().filter(wertet);
  const gen = l.filter(zaehltFuerBestwert).map((p) => p.genauigkeit);
  const st = l.slice(0, 10).map((p) => p.spielstaerke).filter(Number.isFinite);
  return {
    partien: l.length,
    siege: l.filter((p) => p.ergebnis === 'sieg').length,
    remis: l.filter((p) => p.ergebnis === 'remis').length,
    niederlagen: l.filter((p) => p.ergebnis === 'niederlage').length,
    schnittGenauigkeit: gen.length ? Math.round((gen.reduce((a, b) => a + b, 0) / gen.length) * 10) / 10 : null,
    spielstaerke: st.length ? Math.round(st.reduce((a, b) => a + b, 0) / st.length / 50) * 50 : null,
    besteGenauigkeit: (() => {
      const best = l.filter(zaehltFuerBestwert).map((p) => p.genauigkeit);
      return best.length ? Math.max(...best) : null;
    })(),
  };
}

// ---------------------------------------------------------------------------
// Modul-Speicher der Pakete (Runde 4): schach-arena:v1:modul:<name>, Budget in MODUL_BUDGET
// ---------------------------------------------------------------------------
const istModul = (name) => typeof name === 'string' && Object.prototype.hasOwnProperty.call(MODUL_BUDGET, name);

// Gespeicherte Daten des Moduls oder eine tiefe Kopie von standard (auch bei kaputten Daten, bei
// unbekanntem Namen oder wenn die Art nicht passt: Objekt, Liste, Zahl ...)
export function ladeModul(name, standard = null) {
  const kopie = () => (standard === undefined ? null : JSON.parse(JSON.stringify(standard)));
  if (!istModul(name)) {
    warne('unbekanntes Modul ' + String(name));
    return kopie();
  }
  const v = lies(K.modul(name), null);
  if (v == null) return kopie();
  if (standard != null) {
    const art = (x) => (Array.isArray(x) ? 'liste' : typeof x);
    if (art(v) !== art(standard)) return kopie();
  }
  return v;
}

// Schreibt die Daten des Moduls. Ueber dem Budget wird nichts geschrieben (das Paket duennt selbst aus).
export function speichereModul(name, daten) {
  if (!istModul(name)) return { ok: false, zeichen: 0, grund: 'unbekannt' };
  const t = JSON.stringify(daten === undefined ? null : daten);
  const zeichen = t.length;
  if (zeichen > MODUL_BUDGET[name]) return { ok: false, zeichen, grund: 'budget' };
  return schreibText(K.modul(name), t) ? { ok: true, zeichen } : { ok: false, zeichen, grund: 'voll' };
}

// Belegung des Speichers in Zeichen (Schluessel + Wert)
export function speicherStand() {
  const teile = { partien: 0, reviews: 0, fortschritt: 0, module: {}, sonst: 0, fremd: 0 };
  for (const name of Object.keys(MODUL_BUDGET)) teile.module[name] = 0;
  let zeichen = 0;
  const pm = P + 'modul:';
  try {
    const s = sp();
    const schluessel = [];
    for (let i = 0; i < s.length; i++) schluessel.push(s.key(i));
    for (const k of schluessel) {
      if (k == null) continue;
      const v = s.getItem(k);
      const n = k.length + (v == null ? 0 : String(v).length);
      zeichen += n;
      if (!k.startsWith(P)) teile.fremd += n;
      else if (k === K.partien) teile.partien += n;
      else if (k.startsWith(P + 'review:')) teile.reviews += n;
      else if (k === K.fortschritt || k === K.einstellungen || k === K.laufend) teile.fortschritt += n;
      else if (k.startsWith(pm)) {
        const name = k.slice(pm.length);
        teile.module[name] = (teile.module[name] || 0) + n;
      } else teile.sonst += n;
    }
  } catch (e) { /* egal */ }
  return { zeichen, grenze: SPEICHER_GRENZE, teile };
}

// Roher Zugang zu den eigenen Schluesseln (nur fuer die Sicherung, Paket 2D)
export function rohSpeicher() {
  const eigen = (k) => typeof k === 'string' && k.startsWith(P) && k.length > P.length;
  return Object.freeze({
    praefix: P,
    schluessel() {
      const l = [];
      try {
        const s = sp();
        for (let i = 0; i < s.length; i++) {
          const k = s.key(i);
          if (eigen(k) && k !== P + 'test') l.push(k);
        }
      } catch (e) { /* egal */ }
      return l.sort();
    },
    lies(k) {
      if (!eigen(k)) return null;
      try { return sp().getItem(k); } catch (e) { return null; }
    },
    schreib(k, text) {
      if (!eigen(k) || typeof text !== 'string') return false;
      return schreibText(k, text);
    },
    entferne(k) {
      if (eigen(k)) entferne(k);
    },
  });
}

// Alles loeschen (Einstellungen bleiben, wenn mitEinstellungen false). Erfasst alle eigenen
// Schluessel ueber das Praefix, also auch die Modul-Speicher der Pakete.
export function setzeZurueck({ mitEinstellungen = false } = {}) {
  const s = sp();
  const weg = [];
  try {
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i);
      if (k && k.startsWith(P) && (mitEinstellungen || k !== K.einstellungen)) weg.push(k);
    }
  } catch (e) { /* egal */ }
  for (const k of weg) entferne(k);
}
