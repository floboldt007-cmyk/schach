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
//   Reviews werden kompakt gespeichert (review.js kompaktReview/ergaenzeReviewFelder), MAX_REVIEWS 12 (W0+a).
//   Scheitert ein Schreiben trotz geopferter Analysen, kommt das Ereignis speicher:fehler
//     { schluessel, grund: 'voll' | 'fehler' }. Fortschritt wird immer vor der Partienliste geschrieben.
//   Einstellungen der Pakete (w0-fix) unter schach-arena:v1:einstellungen:<name> (Namen wie MODUL_BUDGET),
//     hoechstens MODUL_EINSTELLUNGEN_MAX Zeichen; setzeZurueck() ohne mitEinstellungen verschont sie:
//     ladeModulEinstellungen(name, standard) -> gespeicherte Daten oder tiefe Kopie von standard
//     speichereModulEinstellungen(name, daten) -> { ok, zeichen, grund? }   grund: 'unbekannt' | 'budget' | 'voll'
//   setzeZurueck() sendet danach speicher:zurueckgesetzt { mitEinstellungen } (Pakete leeren ihren Zustand).
//   Partie-Datensatz (w0-fix): analysiert (true, sobald ergaenzeAnalyse eine Review bekam; Nachholen sucht
//     wertende Partien ohne dieses Feld) und genauigkeitQuelle ('live' | 'analyse'). Eine Genauigkeit aus
//     der Live-Bewertung ersetzt die erste volle Analyse genau einmal; eine aus einer Analyse bleibt.
//
// W0+a "Spiel-Fundament" (SPIELKONZEPT 6.2 und 6.6):
//   MODI = ['normal', 'uebung', 'boss', 'frei', 'spiel']; nur 'normal' aus der Grundstellung wertet (Bosse,
//     freie Partien und die Spielhalle buchen nie Sterne, Freischaltung oder Statistik).
//   Partie-Datensatz und laufende Partie zusaetzlich (alle optional, Falsches wird still weggelassen):
//     seed     ganze Zahl 0..2^32-1: Zufall der Bot-Zuege (tag.js zufallAus), fuer pruefbare Partien
//     tempo    { grund, zuschlag } in Sekunden (Schachuhr, W0+b); ohne: ohne Uhr
//     zeiten   [Zehntelsekunden je Halbzug] (verbrauchte Bedenkzeit, W0+b), hoechstens so viele wie Zuege
//     boss     { id, stufe: 'standard' | 'meister', woche?: 'JJJJ-MM-TT', staerke?: Zahl } nur im Modus 'boss'
//     liga     { saison, runde } (Vereinsmeisterschaft, S3-2)
//   MODUL_BUDGET neu (6.6): funken, punkte, boss, raetsel, lernen, liga, sammeln, freunde; dazu (w0plus-a-fix) finisher
//     (S1-7, Matt-Atlas) und die Pakete aus Schub 2b: ausdruck (Emote-Rad, Schnell-Chat, Banner), siegeslauf, werkstatt.
//     Jedes Paket hat sein eigenes Modul: Zwei Pakete in einem Modul wuerden sich gegenseitig ueberschreiben.
//   wertet(p) zusaetzlich (w0plus-a-fix): Partien gegen angemeldete Bots (registriereBot: Bosse, Sparring, Gaeste,
//     stufe null) werten nie, auch im Modus 'normal' aus der Grundstellung. Ohne botId zaehlen nur Modus und Stellung.
//   MAX_REVIEWS 12 (vorher 20); duenneAnalysenAus() entfernt still, was darueber liegt (app.js beim Start).
//   dauerhaftAnfragen() -> Promise<true | false | null>: navigator.storage.persist() (app.js beim Start;
//     Safari loescht sonst Speicher von Web-Apps nach Tagen ohne Nutzung), dauerhaftStatus() -> letzter Stand.
//     Fehler bleiben still (null: unbekannt). Angefragt wird nur, wo kein Dialog droht (persistOhneDialog): in der
//     Home-Bildschirm-App und in WebKit/Chromium. Firefox (Gecko) fragt den Nutzer per Dialog, dort wird nur der
//     Stand gelesen (persisted()).
//   persistOhneDialog({ userAgent, standalone }) -> boolean
//   Einstellungen zusaetzlich (Anzeigen in der Partie, SPIELKONZEPT 3.18): zaehlwerk (aus), funkenlinie (aus),
//     lebensleiste (an: Lebensleiste statt Balken bei Bossen).
//
// Premium-Umbau U1 (PLAN 4): alle neuen Einstellungen auf einmal, ladeEinstellungen() prueft erlaubte Werte
//   (EINSTELLUNG_WERTE), Bereiche (lautstaerke 0..1 in 0,05, tiefe 8..20) und die Teilschluessel von klanggruppen;
//   Falsches faellt still auf den Standard. Neu: klangpaket, lautstaerke, klangstufe ('alle', D4), klanggruppen
//   { brett, bewertung, feier, uhr, boss, finisher, bedienung }, zugBestaetigen, haltenAufgeben, turmRochade, autoDame,
//   steuerung, bewegung (Animationstempo), thema, modus, koordLage, pfeile, duellIntro ('besondere', D3), figuren,
//   coachStil, sprueche. speichereEinstellungen({ klanggruppen: { uhr: false } }) aendert nur diese Gruppe.
//   Alte Speicherstaende brauchen nichts: fehlende Schluessel bekommen ihren Standard.
//
// Daten-Fundament (DSGVO, 22.10.2026): datenfreigabe 'aus' | 'an' (Standard aus): angemeldete Spieler teilen fertige
//   Partien und anonyme Nutzung nur mit dieser ausdruecklichen Freigabe (js/daten.js). Falscher Wert -> 'aus'.
import { BOTS, botNachId } from './bots.js';
import { sende } from './ereignisse.js';
import { kompaktReview, ergaenzeReviewFelder } from './review.js';

// Zug-Klassen (wie review.js KLASSEN), zum Pruefen gespeicherter Daten
const KLASSEN_LISTE = ['brillant', 'stark', 'bester', 'exzellent', 'gut', 'buch', 'ungenau', 'fehler', 'verpasst', 'patzer', 'erzwungen'];

export const SPEICHER_VERSION = 1;
const P = 'schach-arena:v1:';
const K = {
  einstellungen: P + 'einstellungen',
  modulEinstellungen: (name) => P + 'einstellungen:' + name,
  fortschritt: P + 'fortschritt',
  partien: P + 'partien',
  laufend: P + 'laufend',
  review: (id) => P + 'review:' + id,
  modul: (name) => P + 'modul:' + name,
};

// So viele Spielanalysen bleiben gespeichert (aeltere lassen sich neu berechnen; W0+a: 20 -> 12, SPIELKONZEPT 6.6)
export const MAX_REVIEWS = 12;
// So viele Partien bleiben in der Liste
export const MAX_PARTIEN = 300;
export const GENAUIGKEIT_STERN = 80;
// Bestwert der Genauigkeit erst ab so vielen eigenen Zuegen (eine Aufgabe nach einem Zug zaehlt nicht)
export const BESTWERT_MIN_ZUEGE = 10;

// Spielmodi (W0+a: boss, frei, spiel; weitere nur mit einer neuen Fundament-Runde)
export const MODI = Object.freeze(['normal', 'uebung', 'boss', 'frei', 'spiel', 'zuzweit']);
// Zeichen fuer partie.extra (alle Pakete zusammen)
export const EXTRA_MAX = 400;
// Budget je Paket-Modul in Zeichen
export const MODUL_BUDGET = Object.freeze({
  kartei: 160000, profil: 60000, alltag: 40000, uebung: 20000, bots: 20000,
  taktik: 8000, start: 6000, feier: 6000, serie: 4000, zuzweit: 2000,
  // W0+a (SPIELKONZEPT 6.6): zusammen 182.000
  funken: 25000, punkte: 40000, boss: 12000, raetsel: 30000, lernen: 30000, liga: 10000, sammeln: 20000, freunde: 15000,
  // w0plus-a-fix: Matt-Finisher (S1-7: Matt-Atlas, Mattbilder) und Schub 2b, zusammen 30.000
  finisher: 10000, ausdruck: 6000, siegeslauf: 6000, werkstatt: 8000,
  // Welle A: Siegesbild (A1, Paket teilen: Wahl hell/dunkel und Benutzername, gemerkte geteilte Partien)
  teilen: 2000,
  // Welle C: Tagesraetsel (S1-5): Ergebnisse der letzten 60 Tage, "Ein Wort"
  tagesraetsel: 4000,
});
// Einstellungen eines Pakets (Klangstufe, Ruhetag, Schalter ...) in Zeichen
export const MODUL_EINSTELLUNGEN_MAX = 2000;
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
// Angemeldete Bots (Bosse, Sparring, Gaeste) gehoeren nie zur Leiter: ihre Partien werten nie (keine Sterne, keine
// Freischaltung, keine Statistik, kein "Naechster Gegner"). Ob eine spaetere Art (z. B. geeichte Gaeste aus S3-1) fuer
// die Arena-Wertung zaehlt, entscheidet ein eigenes Feld, nie wertet().
const LEITER_IDS = new Set(BOTS.map((b) => b.id));
export function wertet(p) {
  return !!p && (p.modus || 'normal') === 'normal' && !eigeneStellung(p.startFen)
    && (p.botId == null || LEITER_IDS.has(p.botId));
}

export const STANDARD_EINSTELLUNGEN = Object.freeze({
  klang: true,           // Klaenge an
  balken: true,          // Bewertungsbalken zeigen
  liveBewertung: true,   // Symbol + Coach nach jedem eigenen Zug zeigen (gerechnet wird immer)
  brett: 'nacht',        // 'nacht' | 'gruen' | 'holz'
  koordinaten: true,
  tiefe: 14,             // Rechentiefe der Live-Bewertung
  // W0+a: Anzeigen in der Partie (SPIELKONZEPT 3.18; die Schalter baut der Premium-Umbau)
  zaehlwerk: false,      // Zaehlwerk der Pakete (z. B. Punkte) waehrend der Partie
  funkenlinie: false,    // Funkenlinie am Brett waehrend der Partie
  lebensleiste: true,    // Boss-Partien: Lebensleiste statt Bewertungsbalken
  // Premium-Umbau (PLAN 4): Klang
  klangpaket: '',        // '' (Standard der Ansicht, modern: Arcade, D6) | 'holz' | 'arcade'
  lautstaerke: 0.8,      // 0..1 in Schritten von 0,05 (Master = Wert hoch 2)
  musik: false,          // ruhige Menue-Musik (bewusst standardmaessig aus)
  musikLautstaerke: 0.35,// getrennt von Zugklaengen
  musikMelodie: 'welt',  // 'welt' oder eine freigeschaltete Weltmelodie
  klangstufe: 'alle',    // 'alle' | 'wichtig' | 'aus' (Flo, D4: Standard alle)
  klanggruppen: Object.freeze({ brett: true, bewertung: true, feier: true, uhr: true, boss: true, finisher: true, bedienung: true }),
  // Spiel (Fingerschutz). Zug bestaetigen ist seit 23.10. Standard aus (Flo: ohne Hinweis wirkte das Spiel kaputt)
  zugBestaetigen: 'aus', // 'aus' | 'ohneUhr' | 'immer'
  vorzuege: true,        // eigene Zuege vormerken, waehrend der Gegner denkt
  haltenAufgeben: true,  // Aufgeben und Remis anbieten nur durch Halten
  turmRochade: false,    // Turm auf Koenig tippen rochiert
  autoDame: false,       // Umwandlung: Auswahl D T L S (Flo, 24.10.: "ich will waehlen"); an = Dame ohne Auswahl, Halten zeigt D T L S
  steuerung: 'beides',   // 'beides' | 'ziehen' | 'tippen'
  // Bewegung (heisst nicht "tempo": das ist im Partie-Datensatz die Bedenkzeit)
  bewegung: 'normal',    // 'langsam' | 'normal' | 'schnell' | 'aus'
  // Anzeige
  thema: 'modern',       // Ansicht (Theme): modern, spaeter edel, verspielt (unbekannt: thema.js nimmt modern)
  modus: 'system',       // 'system' | 'hell' | 'dunkel'
  koordLage: 'ecke',     // 'ecke' | 'rand'
  pfeile: true,          // Pfeile malen
  arenaKarteHinweis: false, // einmaliger Zieh-Hinweis auf der schmalen Weltkarte wurde geschlossen
  duellIntro: 'besondere', // 'immer' | 'besondere' | 'aus' (Flo, D3)
  figuren: 'cburnett',   // Figuren-Satz (vorbereitet)
  // Coach
  coachStil: 'ausfuehrlich', // 'ausfuehrlich' | 'knapp'
  sprueche: 'an',        // 'an' | 'wenig' | 'aus'
  // Daten (DSGVO): Partien und anonyme Nutzung mit dem Betreiber teilen, nur angemeldet und nur ausdruecklich
  datenfreigabe: 'aus',  // 'aus' | 'an' (Opt-in, Standard aus)
  // Sprache der Oberflaeche (js/sprache.js); Deutsch ist die Quelle
  sprache: 'de',         // 'de' | 'en' (gilt nur mit spracheGewaehlt; sonst die Sprache des Geraets, js/sprache.js)
  spracheGewaehlt: false, // true: in den Einstellungen (oder per ?sprache=) gewaehlt; false: Sprache des Geraets
  // Fassung des gespeicherten Stands (fuer einmalige Umstellungen in ladeEinstellungen)
  fassung: 3,
});

// Erlaubte Werte der Einstellungen (Aufzaehlungen); alles andere faellt auf den Standard zurueck
export const EINSTELLUNG_WERTE = Object.freeze({
  brett: Object.freeze(['nacht', 'gruen', 'holz']),
  klangpaket: Object.freeze(['', 'holz', 'arcade']),
  klangstufe: Object.freeze(['alle', 'wichtig', 'aus']),
  musikMelodie: Object.freeze(['welt', 'karofelder', 'springerforst', 'turmstadt', 'gezeitenkueste', 'stockfisch-tiefe']),
  zugBestaetigen: Object.freeze(['aus', 'ohneUhr', 'immer']),
  steuerung: Object.freeze(['beides', 'ziehen', 'tippen']),
  bewegung: Object.freeze(['langsam', 'normal', 'schnell', 'aus']),
  modus: Object.freeze(['system', 'hell', 'dunkel']),
  koordLage: Object.freeze(['ecke', 'rand']),
  duellIntro: Object.freeze(['immer', 'besondere', 'aus']),
  figuren: Object.freeze(['cburnett', 'blaupause']),   // blaupause nur mit Sonderstueck (js/figurensatz.js)
  coachStil: Object.freeze(['ausfuehrlich', 'knapp']),
  sprueche: Object.freeze(['an', 'wenig', 'aus']),
  datenfreigabe: Object.freeze(['aus', 'an']),
  sprache: Object.freeze(['de', 'en']),
});
// Theme-IDs wie in js/thema.js (registriereThema); welche es gibt, weiss erst thema.js
const THEMA_ID = /^[a-z][a-z0-9-]{1,31}$/;

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
  const e = { ...STANDARD_EINSTELLUNGEN, klanggruppen: { ...STANDARD_EINSTELLUNGEN.klanggruppen } };
  if (roh && typeof roh === 'object' && !Array.isArray(roh)) {
    for (const [k, std] of Object.entries(STANDARD_EINSTELLUNGEN)) {
      if (k === 'klanggruppen') continue;
      if (typeof roh[k] === typeof std) e[k] = roh[k];
    }
    // Teilschluessel einzeln: fehlende oder falsche Gruppen bleiben an
    const g = roh.klanggruppen;
    if (g && typeof g === 'object' && !Array.isArray(g)) {
      for (const k of Object.keys(e.klanggruppen)) if (typeof g[k] === 'boolean') e.klanggruppen[k] = g[k];
    }
  }
  for (const [k, werte] of Object.entries(EINSTELLUNG_WERTE)) {
    if (!werte.includes(e[k])) e[k] = STANDARD_EINSTELLUNGEN[k];
  }
  // Fassung 2 (23.10.): Bis dahin stand der alte Standard 'ohneUhr' von "Zug bestaetigen" in jedem gespeicherten Stand,
  // ob gewaehlt oder nicht. Einmal auf den neuen Standard 'aus'; wer danach 'ohneUhr' waehlt, behaelt es.
  if (roh && typeof roh === 'object' && !(Number(roh.fassung) >= 2) && e.zugBestaetigen === 'ohneUhr') e.zugBestaetigen = 'aus';
  // Fassung 3 (24.10.): "Automatisch Dame" war Standard an und stand so in jedem Stand; Flo will bei der Umwandlung die
  // Figur waehlen. Einmal auf aus; wer es danach anschaltet, behaelt es.
  if (roh && typeof roh === 'object' && !(Number(roh.fassung) >= 3) && e.autoDame === true) e.autoDame = false;
  // Sprache nach Geraet (24.10.): Vorher war Deutsch der Standard und stand in jedem gespeicherten Stand. Nur Englisch
  // kann also bewusst gewaehlt sein: das bleibt als Wahl, alles andere folgt ab jetzt dem Geraet. Der Notfall-Waechter
  // in index.html bildet diese Regel nach (tests/notfall.test.mjs vergleicht).
  if (roh && typeof roh === 'object' && typeof roh.spracheGewaehlt !== 'boolean' && roh.sprache === 'en') e.spracheGewaehlt = true;
  e.fassung = STANDARD_EINSTELLUNGEN.fassung;
  if (!THEMA_ID.test(e.thema)) e.thema = STANDARD_EINSTELLUNGEN.thema;
  e.tiefe = Number.isFinite(e.tiefe) ? Math.max(8, Math.min(20, Math.round(e.tiefe))) : STANDARD_EINSTELLUNGEN.tiefe;
  e.lautstaerke = Number.isFinite(e.lautstaerke)
    ? Math.round(Math.max(0, Math.min(1, e.lautstaerke)) * 20) / 20 : STANDARD_EINSTELLUNGEN.lautstaerke;
  e.musikLautstaerke = Number.isFinite(e.musikLautstaerke)
    ? Math.round(Math.max(0, Math.min(1, e.musikLautstaerke)) * 20) / 20 : STANDARD_EINSTELLUNGEN.musikLautstaerke;
  return e;
}

// Speichert einen Teil der Einstellungen; klanggruppen darf auch nur einzelne Gruppen nennen
export function speichereEinstellungen(teil) {
  const alt = ladeEinstellungen();
  const t = teil && typeof teil === 'object' ? teil : {};
  const e = { ...alt, ...t };
  if (t.klanggruppen && typeof t.klanggruppen === 'object') e.klanggruppen = { ...alt.klanggruppen, ...t.klanggruppen };
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

// Welten (Flo, 23.10.): frei ist Stufe 1 und jede Stufe bis eine ueber dem hoechsten Sieg. Wer frueher Greta besiegt
// hat, behaelt damit alles darunter, auch neu eingezogene Bots (niemand wird zu Willi zurueckgeschickt). Dazu ist
// der Endgegner jeder Welt frei, deren erste Stufe frei ist (direkt herausfordern, freiwillig): sein Sieg oeffnet die
// ganze Welt und die naechste. Welten schliessen sich nie wieder.
export function hoechsterSieg(f = ladeFortschritt()) {
  let s = 0;
  for (const b of BOTS) if (f.bots[b.id] && f.bots[b.id].sterne[0]) s = Math.max(s, b.stufe);
  return s;
}

export function istFreigeschaltet(stufe, f = ladeFortschritt()) {
  if (stufe <= 1) return true;
  const grenze = hoechsterSieg(f) + 1;
  if (stufe <= grenze) return true;
  const b = BOTS.find((x) => x.stufe === stufe);
  if (!b || !b.endgegner) return false;
  const erste = Math.min(...BOTS.filter((x) => x.welt === b.welt).map((x) => x.stufe));
  return erste <= grenze;
}

// Welt frei = ihre erste Stufe frei; Weltsiegel = alle Sterne ihrer Bots
export function istWeltFrei(nr, f = ladeFortschritt()) {
  const stufen = BOTS.filter((x) => x.welt === nr).map((x) => x.stufe);
  return stufen.length > 0 && istFreigeschaltet(Math.min(...stufen), f);
}
export function hatWeltsiegel(nr, f = ladeFortschritt()) {
  const bots = BOTS.filter((x) => x.welt === nr);
  return bots.length > 0 && bots.every((x) => f.bots[x.id] && f.bots[x.id].sterne.every(Boolean));
}

// Hoechste Stufe auf dem normalen Weg (ohne die direkt herausforderbaren Endgegner): Massstab fuer Empfehlungen
export function hoechsteFreieStufe(f = ladeFortschritt()) {
  const max = Math.max(1, ...BOTS.map((b) => b.stufe));
  return Math.min(max, hoechsterSieg(f) + 1);
}

// Naechster Gegner: der Bot direkt ueber dem hoechsten Sieg (Welten: nie zurueck zu neu eingezogenen Bots darunter).
// Ist der Endgegner der letzten Welt besiegt: die niedrigste noch nicht besiegte Stufe, sonst die hoechste.
export function naechsterGegner(f = ladeFortschritt()) {
  const sortiert = [...BOTS].sort((a, c) => a.stufe - c.stufe);
  const ueber = sortiert.find((b) => b.stufe === hoechsterSieg(f) + 1);
  if (ueber) return ueber;
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
//            modus 'normal'|'uebung', ziel (nur Uebung), extra (Objekt je Paket), maxSerie,
//            genauigkeitQuelle 'live'|'analyse' (sobald genauigkeit gesetzt), analysiert true (Review nachgetragen),
//            W0+a: seed, tempo, zeiten, boss (nur Modus 'boss'), liga }
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

// ---------- W0+a: Seed, Tempo, Zeiten, Boss, Liga ----------
const ID_RE = /^[a-z][a-z0-9-]{0,39}$/;
const TAG_RE = /^\d{4}-\d{2}-\d{2}$/;
export const BOSS_STUFEN = Object.freeze(['standard', 'meister']);

export function pruefeSeed(x) {
  return Number.isInteger(x) && x >= 0 && x <= 4294967295 ? x : null;
}
// Bedenkzeit in Sekunden: Grundzeit 1 s bis 3 Stunden, Zuschlag 0 bis 10 Minuten
export function pruefeTempo(t) {
  if (!t || typeof t !== 'object' || Array.isArray(t)) return null;
  if (!Number.isInteger(t.grund) || t.grund < 1 || t.grund > 10800) return null;
  if (!Number.isInteger(t.zuschlag) || t.zuschlag < 0 || t.zuschlag > 600) return null;
  return { grund: t.grund, zuschlag: t.zuschlag };
}
// Namen bleiben auf dem Geraet. Steuerzeichen entfernen, hoechstens 20 Unicode-Zeichen je Person.
export function pruefeZuzweit(z) {
  const name = (wert, standard) => typeof wert === 'string'
    ? [...wert.replace(/[\u0000-\u001f\u007f]/g, '').trim()].slice(0, 20).join('') || standard : standard;
  return { weiss: name(z?.weiss, 'Weiß'), schwarz: name(z?.schwarz, 'Schwarz'), drehen: z?.drehen === true };
}
// verbrauchte Bedenkzeit je Halbzug in Zehntelsekunden (kompakt: ganze Zahlen)
export function pruefeZeiten(z, maxLaenge = 2000) {
  if (!Array.isArray(z) || z.length > maxLaenge) return null;
  if (!z.every((x) => Number.isInteger(x) && x >= 0 && x <= 864000)) return null;
  return z.slice();
}
export function pruefeBoss(b) {
  if (!b || typeof b !== 'object' || Array.isArray(b)) return null;
  if (typeof b.id !== 'string' || !ID_RE.test(b.id) || !BOSS_STUFEN.includes(b.stufe)) return null;
  const aus = { id: b.id, stufe: b.stufe };
  if (typeof b.woche === 'string' && TAG_RE.test(b.woche)) aus.woche = b.woche;
  if (Number.isFinite(b.staerke)) aus.staerke = Math.round(b.staerke);
  return aus;
}
export function pruefeLiga(l) {
  if (!l || typeof l !== 'object' || Array.isArray(l)) return null;
  if (typeof l.saison !== 'string' || !ID_RE.test(l.saison) || !Number.isInteger(l.runde) || l.runde < 1 || l.runde > 99) return null;
  return { saison: l.saison, runde: l.runde };
}
// Felder setzen oder (falsch/leer) entfernen
function setzeOderWeg(p, feld, wert) {
  if (wert == null) delete p[feld];
  else p[feld] = wert;
}
function normalisiereSpiel(p) {
  setzeOderWeg(p, 'zuzweit', p.modus === 'zuzweit' ? pruefeZuzweit(p.zuzweit) : null);
  setzeOderWeg(p, 'seed', pruefeSeed(p.seed));
  setzeOderWeg(p, 'tempo', pruefeTempo(p.tempo));
  setzeOderWeg(p, 'zeiten', pruefeZeiten(p.zeiten, Array.isArray(p.zuege) ? p.zuege.length : 2000));
  setzeOderWeg(p, 'boss', p.modus === 'boss' ? pruefeBoss(p.boss) : null);
  setzeOderWeg(p, 'liga', pruefeLiga(p.liga));
  return p;
}

// Neue Felder einer Partie in Form bringen (modus, ziel, extra, maxSerie; W0+a: seed, tempo, zeiten, boss, liga)
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
  return normalisiereSpiel(p);
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
//             neuFreigeschaltet: Bot|null, brillant: Anzahl neu gesammelter geniale Züge, wertet }
export function speicherePartie(partie, review = null) {
  if (!partie || typeof partie !== 'object') throw new Error('Partie fehlt');
  const p = normalisiere({ ...partie });
  const liste = ladeListe();
  // neue ID nie doppelt (zwei Partien in derselben Millisekunde haetten sonst in 1 von 1296 Faellen dieselbe)
  if (!p.id) {
    p.id = neueId();
    for (let n = 1; liste.some((x) => x.id === p.id); n++) p.id = neueId() + (n > 8 ? n.toString(36) : '');
  }
  if (!p.datum) p.datum = new Date().toISOString();
  // Genauigkeit schon beim Speichern (ohne Quelle): gilt als endgueltig wie eine aus einer Analyse
  if (!Number.isFinite(p.genauigkeit)) delete p.genauigkeitQuelle;
  else if (p.genauigkeitQuelle !== 'live') p.genauigkeitQuelle = 'analyse';
  if (review) p.analysiert = true;
  const wert = wertet(p);
  p.sterne = sterneFuerPartie(p);

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
    // Welten: oeffnet ein Sieg mehrere Stufen (Endgegner direkt besiegt), zeigt die Arena den neuen naechsten Gegner
    const naechster = naechsterGegner(f);
    const neuId = neuFrei.includes(naechster.id) ? naechster.id : neuFrei[0];
    if (neuFrei.length) ergebnis.neuFreigeschaltet = BOTS.find((x) => x.id === neuId) || null;
  }
  ergebnis.brillant = sammleBrillante(f, p, review);
  speichereFortschritt(f);
}

// Genial-Sammlung (Schatzkiste); jeder Zug nur einmal
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
// geniale Züge und Bestwert.
// Regel (w0c): Es werden nur LEERE Felder gefuellt (genauigkeit, genauigkeitBot, spielstaerke,
// eroeffnung). Die erste Genauigkeit einer Partie aus einer Analyse (am Spielende, sonst die erste
// spaetere, z. B. beim Nachholen) bleibt; auf ihr beruht Stern 2. Eine spaetere Neuberechnung (z. B. wenn
// die Review aus der Liste gefallen ist) speichert nur ihre eigene Review. Sterne werden nur dazugewonnen,
// nie entzogen, im Partie-Datensatz wie im Fortschritt.
// Ausnahme (w0-fix): Eine Genauigkeit aus der Live-Bewertung (genauigkeitQuelle 'live') ist vorlaeufig, die
// erste volle Analyse ersetzt sie genau einmal (sonst haenge Stern 2 davon ab, wann Flo das Ergebnis
// verlaesst). Alte Datensaetze ohne Quelle gelten als live, wenn nur die Genauigkeit gesetzt ist (die
// Live-Bewertung fuellt weder genauigkeitBot noch spielstaerke). War der ersetzte Live-Wert der Bestwert
// des Bots, wird der Bestwert aus den gespeicherten Partien neu bestimmt.
// Ohne Review: { genauigkeit } (z. B. aus der Live-Bewertung), nur, wenn noch keine da ist.
// Mit Review: analysiert = true (Nachholen laesst die Partie dann aus).
// Nicht wertende Partien: keine Sterne, kein Bestwert, keine Schatzkiste.
// Rueckgabe { partie, neueSterne, brillant, wertet } oder null.
export function ergaenzeAnalyse(id, review = null, { genauigkeit = null } = {}) {
  const liste = ladeListe();
  const i = liste.findIndex((x) => x.id === id);
  if (i < 0) return null;
  const p = { ...liste[i] };
  const sf = p.spielerFarbe === 'b' ? 'b' : 'w';
  const bf = sf === 'w' ? 'b' : 'w';
  const leer = (x) => !Number.isFinite(x);
  const ausLive = !leer(p.genauigkeit) && (p.genauigkeitQuelle === 'live'
    || (p.genauigkeitQuelle == null && leer(p.genauigkeitBot) && leer(p.spielstaerke)));
  let ersetzt = null;   // ersetzter Live-Wert
  if (review && review.genauigkeit) {
    if ((leer(p.genauigkeit) || ausLive) && Number.isFinite(review.genauigkeit[sf])) {
      if (ausLive) ersetzt = p.genauigkeit;
      p.genauigkeit = review.genauigkeit[sf];
      p.genauigkeitQuelle = 'analyse';
    }
    if (leer(p.genauigkeitBot) && Number.isFinite(review.genauigkeit[bf])) p.genauigkeitBot = review.genauigkeit[bf];
    if (leer(p.spielstaerke) && review.spielstaerke && Number.isFinite(review.spielstaerke[sf])) p.spielstaerke = review.spielstaerke[sf];
    if (!p.eroeffnung && review.eroeffnung) p.eroeffnung = review.eroeffnung;
  } else if (Number.isFinite(genauigkeit) && leer(p.genauigkeit)) {
    p.genauigkeit = genauigkeit;
    p.genauigkeitQuelle = 'live';
  }
  if (review) p.analysiert = true;
  const wert = wertet(p);
  const alt = Array.isArray(liste[i].sterne) ? liste[i].sterne : [];
  p.sterne = wert ? sterneFuerPartie(p).map((s, k) => s || alt[k] === true) : [false, false, false];
  liste[i] = p;

  const ergebnis = { partie: p, neueSterne: [false, false, false], brillant: 0, wertet: wert };
  // erst der kleine Fortschritt, dann die Liste
  if (wert) {
    const f = ladeFortschritt();
    const b = f.bots[p.botId];
    if (b) {
      // Bestwert aus einem jetzt ersetzten Live-Wert: aus den gespeicherten Partien neu bestimmen
      if (ersetzt != null && b.besteGenauigkeit === ersetzt) {
        const werte = liste.filter((x) => x.botId === p.botId && wertet(x) && zaehltFuerBestwert(x)).map((x) => x.genauigkeit);
        b.besteGenauigkeit = werte.length ? Math.max(...werte) : null;
      }
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

// W0+a: Analysen ueber MAX_REVIEWS still entfernen (alte Speicherstaende hatten bis zu 20). Liest nur die
// Schluessel, nicht die grossen Werte. Die neuesten Partien behalten ihre Analyse; Analysen ohne Partie gehen
// zuerst. -> Zahl der entfernten Analysen
export function duenneAnalysenAus(max = MAX_REVIEWS) {
  const praefix = P + 'review:';
  const ids = [];
  try {
    const s = sp();
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i);
      if (k && k.startsWith(praefix)) ids.push(k.slice(praefix.length));
    }
  } catch (e) { return 0; }
  if (ids.length <= max) return 0;
  const rang = new Map(ladePartien().map((p, i) => [p.id, i]));
  const wo = (id) => (rang.has(id) ? rang.get(id) : 1e9);
  ids.sort((a, b) => wo(a) - wo(b));
  const weg = ids.slice(Math.max(0, max));
  for (const id of weg) entferne(K.review(id));
  return weg.length;
}

// W0+a: dauerhaften Speicher anfragen (navigator.storage.persist), Fehler still.
// w0plus-a-fix: Firefox (Gecko) zeigt dafuer einen Berechtigungs-Dialog; dort nur in der installierten App anfragen.
// Safari und Chrome entscheiden still. Firefox auf iOS (FxiOS) ist WebKit und meldet kein "Firefox/".
export function persistOhneDialog({ userAgent = '', standalone = false } = {}) {
  if (standalone) return true;
  const ua = String(userAgent || '');
  const gecko = /\bFirefox\//.test(ua) && !/like Gecko/.test(ua);
  return !gecko;
}
function istStandalone() {
  try {
    const nav = globalThis.navigator;
    if (nav && nav.standalone === true) return true;
    const mq = typeof globalThis.matchMedia === 'function' ? globalThis.matchMedia('(display-mode: standalone)') : null;
    return !!(mq && mq.matches);
  } catch (e) {
    return false;
  }
}
let dauerhaft = null;
export async function dauerhaftAnfragen() {
  try {
    const st = globalThis.navigator && globalThis.navigator.storage;
    if (!st || typeof st.persist !== 'function') { dauerhaft = null; return dauerhaft; }
    if (typeof st.persisted === 'function' && (await st.persisted()) === true) { dauerhaft = true; return dauerhaft; }
    if (!persistOhneDialog({ userAgent: globalThis.navigator.userAgent, standalone: istStandalone() })) {
      // kein Dialog: nur den Stand merken (false, sonst unbekannt)
      dauerhaft = typeof st.persisted === 'function' ? false : null;
      return dauerhaft;
    }
    dauerhaft = (await st.persist()) === true;
  } catch (e) {
    dauerhaft = null;
  }
  return dauerhaft;
}
export function dauerhaftStatus() {
  return dauerhaft;
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
//             modus 'normal'|'uebung', ziel (nur Uebung) | null, extra {}, liveTrivial: [bool],
//             W0+a: seed, tempo, zeiten, boss (nur Modus 'boss'), liga }
// Der Bot einer laufenden Partie kann auch ein angemeldeter sein (registriereBot, z. B. ein Boss); fehlt er
// (Paket nicht geladen), gibt es keine laufende Partie.
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
  if (!s || typeof s !== 'object' || !Array.isArray(s.zuege) || (s.modus !== 'zuzweit' && !botNachId(s.botId))) return null;
  if (s.startFen != null && typeof s.startFen !== 'string') return null;
  // von Hand veraenderte Daten: nur bekannte Klassen und gueltige Zuege uebernehmen
  const zuege = s.zuege.filter((u) => typeof u === 'string' && UCI_RE.test(u));
  if (zuege.length !== s.zuege.length) return null;
  const liveKlassen = Array.isArray(s.liveKlassen) ? s.liveKlassen.map((k) => (KLASSEN_LISTE.includes(k) ? k : null)) : [];
  const liveTrivial = Array.isArray(s.liveTrivial) ? s.liveTrivial.map((x) => x === true) : [];
  const modus = MODI.includes(s.modus) ? s.modus : 'normal';
  const ziel = modus === 'uebung' ? pruefeZiel(s.ziel) : null;
  const extra = pruefeExtra(s.extra) || {};
  return normalisiereSpiel({ ...s, liveKlassen, liveTrivial, modus, ziel, extra });
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

// Einstellungen eines Pakets (getrennt vom Modul-Speicher, damit "Fortschritt zuruecksetzen" sie verschont)
export function ladeModulEinstellungen(name, standard = {}) {
  const kopie = () => (standard === undefined ? null : JSON.parse(JSON.stringify(standard)));
  if (!istModul(name)) {
    warne('unbekanntes Modul ' + String(name));
    return kopie();
  }
  const v = lies(K.modulEinstellungen(name), null);
  if (v == null) return kopie();
  if (standard != null) {
    const art = (x) => (Array.isArray(x) ? 'liste' : typeof x);
    if (art(v) !== art(standard)) return kopie();
  }
  return v;
}

export function speichereModulEinstellungen(name, daten) {
  if (!istModul(name)) return { ok: false, zeichen: 0, grund: 'unbekannt' };
  const t = JSON.stringify(daten === undefined ? null : daten);
  const zeichen = t.length;
  if (zeichen > MODUL_EINSTELLUNGEN_MAX) return { ok: false, zeichen, grund: 'budget' };
  return schreibText(K.modulEinstellungen(name), t) ? { ok: true, zeichen } : { ok: false, zeichen, grund: 'voll' };
}

// Belegung des Speichers in Zeichen (Schluessel + Wert); Einstellungen der Pakete zaehlen zu fortschritt
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
      else if (k === K.fortschritt || k === K.einstellungen || k === K.laufend || k.startsWith(K.einstellungen + ':')) teile.fortschritt += n;
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

// Alles loeschen (Einstellungen bleiben, wenn mitEinstellungen false: die der App und die der Pakete).
// Erfasst alle eigenen Schluessel ueber das Praefix, also auch die Modul-Speicher der Pakete. Danach kommt
// speicher:zurueckgesetzt { mitEinstellungen }, damit Pakete ihren Zustand im Arbeitsspeicher leeren.
export function setzeZurueck({ mitEinstellungen = false } = {}) {
  const s = sp();
  const weg = [];
  const istEinstellung = (k) => k === K.einstellungen || k.startsWith(K.einstellungen + ':');
  try {
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i);
      if (k && k.startsWith(P) && (mitEinstellungen || !istEinstellung(k))) weg.push(k);
    }
  } catch (e) { /* egal */ }
  for (const k of weg) entferne(k);
  try { sende('speicher:zurueckgesetzt', { mitEinstellungen: !!mitEinstellungen }); } catch (e) { /* egal */ }
}
