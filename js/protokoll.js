// Fehlerprotokoll fuer den Tester-Bericht (Luecken-Check 10, BAUPLAN 2D Punkt 8, Gesamtschau T7). Rein lokal: Es faengt
// Laufzeitfehler (window 'error', dazu ein Skript, das nicht laedt), abgelehnte Promises ohne Fang ('unhandledrejection'),
// Paket-Ladefehler und Engine-Abbrueche (js/app.js ruft protokolliere()) und "Speicher voll" (Ereignis speicher:fehler).
// Die App sendet das Protokoll NIE. Es steht nur im "Bericht fuer die Testphase" (js/bericht.js), den Flo vorher ganz
// sieht und nur selbst kopiert oder teilt.
//
// Geladen wird die Datei als ERSTER Import von js/app.js: So haengen die Fenster-Hoerer, bevor die uebrigen Kern-Module
// auswerten, und ein Fehler beim Start steht danach im Protokoll. Sie haengt nur an js/ereignisse.js und darf selbst nie
// einen Fehler nach aussen geben (alles in try/catch). In Node ohne window: nur die Funktionen, keine Hoerer.
//
// Speicher: localStorage PROTOKOLL_SCHLUESSEL = 'schach-arena:protokoll', bewusst NICHT unter 'schach-arena:v1:'. Damit
//   sieht rohSpeicher() (js/storage.js) ihn nie: Er kommt weder in die Sicherung (js/sicherung.js) noch in den
//   Cloud-Spielstand (js/konto.js lokalerStand), ein Import oder Cloud-Stand loescht ihn nicht, und "Fortschritt
//   zuruecksetzen" laesst ihn stehen (Diagnose, kein Fortschritt). Leeren: "Fehlerliste leeren" im Bericht (leere()).
//   { v: 1, eintraege: [Eintrag], engine: { ms, z } | null }, eintraege neueste zuerst.
//   Eintrag { z (ms), art, text, datei?, zeile?, n? }   art: ARTEN
//     text   hoechstens TEXT_MAX Zeichen, bereinigt (bereinige): keine Adressen, Abfragen (?...), Anker (#...), Herkunft,
//            E-Mail-Adressen, Token, Kennungen oder lokalen Pfade
//     datei  nur der Dateiname (ohne Ordner, ohne ?... und #...), zeile nur die Zahl; nie ein Stack
//     n      wie oft derselbe Eintrag direkt hintereinander kam (statt einer neuen Zeile je Wiederholung)
//   Hoechstens MAX_EINTRAEGE und MAX_ZEICHEN (JSON des Ganzen), die aeltesten fallen weg. Geschrieben wird sofort und
//   danach hoechstens einmal je SCHREIB_MS (dazu beim Verlassen der Seite). Ist der Speicher voll, bleibt das Protokoll im
//   Arbeitsspeicher; protokoll.js sendet dabei nie speicher:fehler (keine Schleife).
//
// API:
//   protokolliere(art, fehler, { datei, zeile, vorsatz } = {}) -> Eintrag | null   fehler: Error, Text oder Wert
//   eintraege() -> [Eintrag]           Kopie, neueste zuerst
//   leere()                            Fehlerliste leeren (die gemessene Engine-Startzeit bleibt)
//   merkeEngineStart(ms), engineStart() -> { ms, z } | null   zuletzt gemessene Startzeit der Engine (js/app.js)
//   bereinige(text, max = TEXT_MAX) -> Text
//   dateiName(x) -> 'app.js' | ''      nur ein Dateiname mit Endung, sonst ''
//   ersterOrt(stack) -> { datei, zeile } | null   erste Stelle mit Datei und Zeile aus einem Stack-Text
//   kuerze(liste, { maxEintraege, maxZeichen }) -> liste   die neuesten, die in die Grenzen passen
//   setzeLager(fake | null)            nur fuer Tests (Node)
import { hoere } from './ereignisse.js';

export const PROTOKOLL_SCHLUESSEL = 'schach-arena:protokoll';
export const MAX_EINTRAEGE = 50;
export const MAX_ZEICHEN = 20000;
export const TEXT_MAX = 200;
export const ARTEN = Object.freeze(['fehler', 'promise', 'skript', 'paket', 'engine', 'speicher']);
const SCHREIB_MS = 1000;
const DATEI_MAX = 60;
// Platz fuer den Rahmen { v, eintraege: [], engine } im JSON (grosszuegig, damit das Ganze sicher unter MAX_ZEICHEN bleibt)
const RAHMEN = 100;

let lagerFn = () => globalThis.localStorage;
let zustand = null;
let dreckig = false;
let uhr = null;

export function setzeLager(lager) {
  lagerFn = lager ? () => lager : () => globalThis.localStorage;
  zustand = null;
  dreckig = false;
  if (uhr) { clearTimeout(uhr); uhr = null; }
}

// ---------- Bereinigen ----------
// "https://host/a/b/app.js?x=1#y" -> "/a/b/app.js?x=1#y" (ohne Schema und Herkunft)
function pfadVon(adresse) {
  const m = /^[a-z][a-z0-9+.-]*:\/\/[^/?#]*(.*)$/i.exec(String(adresse || ''));
  return m ? m[1] : String(adresse || '');
}

export function dateiName(x) {
  const pfad = pfadVon(x).split(/[?#]/)[0];
  const teil = pfad.split(/[\\/]/).pop() || '';
  return teil.length <= DATEI_MAX && /^[\w.-]+\.[a-z0-9]{1,6}$/i.test(teil) ? teil : '';
}

// Werte hinter diesen Namen fallen weg ("token=abc", "email: x"); die kurzen, mehrdeutigen nur mit "=" (Adress-Abfragen)
const SCHLUESSEL_WOERTER = 'access_token|refresh_token|id_token|token|apikey|api_key|secret|password|passwort|otp'
  + '|user_id|userid|uid|email|e-mail|session|sitzung|auth|authorization|signature|jwt';
const SCHLUESSEL_KURZ = 'key|code|sub|mail|sig|id|user|name';

export function bereinige(text, max = TEXT_MAX) {
  let s = String(text ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
  // Adressen: blob: und data: ganz weg, sonst nur der Dateiname einer Datei (Herkunft, Ordner, ?... und #... fallen weg)
  s = s.replace(/\b(?:blob|data):[^\s'"<>()]*/gi, '[adresse]');
  s = s.replace(/\b[a-z][a-z0-9+.-]*:\/\/[^\s'"<>()]*/gi, (u) => dateiName(u) || '[adresse]');
  s = s.replace(/\b(?:localhost|\d{1,3}(?:\.\d{1,3}){3})(?::\d+)?(?:\/[^\s'"<>()]*)?/gi, (u) => dateiName(u.replace(/^[^/]*/, '')) || '[adresse]');
  s = s.replace(/\bwww\.[^\s'"<>()]+/gi, '[adresse]');
  // E-Mail-Adressen und alles andere mit @ in der Mitte
  s = s.replace(/[^\s<>()"']+@[^\s<>()"']+/g, '[e-mail]');
  // Token und Kennungen
  s = s.replace(/\beyJ[\w-]{4,}(?:\.[\w-]{4,}){1,2}/g, '[token]');
  s = s.replace(/\bBearer\s+[^\s,;)]+/gi, 'Bearer [weg]');
  s = s.replace(new RegExp(`\\b(${SCHLUESSEL_WOERTER})(\\s*[=:]\\s*)("[^"]*"|'[^']*'|[^\\s&,;)]+)`, 'gi'), '$1$2[weg]');
  s = s.replace(new RegExp(`\\b(${SCHLUESSEL_KURZ})(=)("[^"]*"|'[^']*'|[^\\s&,;)]+)`, 'gi'), '$1$2[weg]');
  s = s.replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '[id]');
  // lange Zeichenfolgen aus Buchstaben und Ziffern (Kennungen, Schluessel), aber nicht der Name einer Datei
  s = s.replace(/\b(?=[\w-]*\d)(?=[\w-]*[A-Za-z])[\w-]{20,}\b(?!\.[a-z0-9]{1,6}\b)/g, '[id]');
  s = s.replace(/\b\d{10,}\b/g, '[zahl]');
  // Abfragen und Anker: an einem Dateinamen abschneiden, allein stehend ganz weg
  s = s.replace(/([\w.-]+\.[a-z0-9]{1,6})[?#][^\s'"<>()]*/gi, '$1');
  s = s.replace(/\?[^\s'"<>()]*=[^\s'"<>()]*/g, '');
  s = s.replace(/#[^\s'"<>()]*[/=][^\s'"<>()]*/g, '');
  // Lokale Pfade (koennen den Benutzernamen enthalten): nur der Dateiname
  s = s.replace(/(^|[\s('"=])((?:[A-Za-z]:)?(?:[\\/][^\s\\/'"()<>]+)+)/g, (m, vor, pfad) => {
    const [, ohne, zeile = ''] = /^(.*?)(:\d+)?(?::\d+)?$/.exec(pfad);
    const name = dateiName(ohne);
    return vor + (name ? name + zeile : '[pfad]');
  });
  s = s.replace(/\s+/g, ' ').trim();
  if (s.length > max) s = s.slice(0, Math.max(0, max - 1)).trimEnd() + '…';
  return s;
}

// erste Stelle "datei.js:12" in einem Stack (Chrome "at f (https://x/js/app.js:12:5)", Safari "f@https://x/js/app.js:12:5")
export function ersterOrt(stack) {
  const m = /([^/\\\s()@]+\.m?js)(?:[?#][^:\s)]*)?:(\d+)(?::\d+)?/.exec(String(stack || ''));
  if (!m) return null;
  const datei = dateiName(m[1]);
  const zeile = Number(m[2]);
  return datei && Number.isInteger(zeile) && zeile > 0 ? { datei, zeile } : null;
}

// Text und Ort eines Fehlers (Error, Text oder sonst ein Wert); Objekte ohne Meldung nur mit ihrem Typ, nie als JSON
function beschreibe(fehler) {
  if (fehler == null) return { text: String(fehler), ort: null };
  if (typeof fehler === 'string') return { text: fehler, ort: null };
  if (typeof fehler !== 'object' && typeof fehler !== 'function') return { text: String(fehler), ort: null };
  let meldung = '';
  let name = '';
  let stack = '';
  try { meldung = fehler.message != null ? String(fehler.message) : ''; } catch (e) { /* egal */ }
  try { name = typeof fehler.name === 'string' && /^[A-Za-z][\w]{0,39}$/.test(fehler.name) ? fehler.name : ''; } catch (e) { /* egal */ }
  try { stack = typeof fehler.stack === 'string' ? fehler.stack : ''; } catch (e) { /* egal */ }
  if (!meldung && !name) {
    let typ = 'Objekt';
    try { typ = (fehler.constructor && /^[A-Za-z]\w{0,39}$/.test(fehler.constructor.name) && fehler.constructor.name) || typ; } catch (e) { /* egal */ }
    return { text: '(' + typ + ')', ort: null };
  }
  const text = name && !meldung.startsWith(name) ? (meldung ? `${name}: ${meldung}` : name) : meldung;
  return { text, ort: ersterOrt(stack) };
}

// ---------- Liste ----------
const groesse = (e) => JSON.stringify(e).length + 1;

export function kuerze(liste, { maxEintraege = MAX_EINTRAEGE, maxZeichen = MAX_ZEICHEN } = {}) {
  const l = (Array.isArray(liste) ? liste : []).slice(0, Math.max(0, maxEintraege));
  let summe = RAHMEN + l.reduce((a, e) => a + groesse(e), 0);
  while (l.length && summe > maxZeichen) summe -= groesse(l.pop());
  return l;
}

// gespeicherte (oder von Hand veraenderte) Eintraege pruefen und noch einmal bereinigen
function pruefeEintrag(e) {
  if (!e || typeof e !== 'object' || !ARTEN.includes(e.art) || !Number.isFinite(Number(e.z))) return null;
  const x = { z: Number(e.z), art: e.art, text: bereinige(e.text) };
  const datei = dateiName(e.datei);
  if (datei) x.datei = datei;
  if (Number.isInteger(e.zeile) && e.zeile > 0) x.zeile = e.zeile;
  if (Number.isInteger(e.n) && e.n > 1) x.n = Math.min(e.n, 9999);
  return x;
}

function leer() {
  return { v: 1, eintraege: [], engine: null };
}

function lade() {
  if (zustand) return zustand;
  zustand = leer();
  try {
    const roh = JSON.parse(lagerFn().getItem(PROTOKOLL_SCHLUESSEL) || 'null');
    if (roh && typeof roh === 'object') {
      if (Array.isArray(roh.eintraege)) zustand.eintraege = kuerze(roh.eintraege.map(pruefeEintrag).filter(Boolean));
      const ms = roh.engine ? Number(roh.engine.ms) : NaN;
      if (Number.isFinite(ms) && ms >= 0) zustand.engine = { ms: Math.min(Math.round(ms), 600000), z: Number(roh.engine.z) || 0 };
    }
  } catch (e) { /* kaputt oder gesperrt: leer anfangen */ }
  return zustand;
}

function schreibeJetzt() {
  dreckig = false;
  try {
    const z = lade();
    const lager = lagerFn();
    if (!z.eintraege.length && !z.engine) lager.removeItem(PROTOKOLL_SCHLUESSEL);
    else lager.setItem(PROTOKOLL_SCHLUESSEL, JSON.stringify(z));
  } catch (e) { /* voll oder gesperrt: bleibt im Arbeitsspeicher */ }
}

// sofort schreiben, danach hoechstens einmal je SCHREIB_MS (eine Fehlerflut schreibt nicht jedes Mal den Speicher)
function planeSchreiben() {
  dreckig = true;
  if (uhr) return;
  schreibeJetzt();
  uhr = setTimeout(() => { uhr = null; if (dreckig) schreibeJetzt(); }, SCHREIB_MS);
  if (uhr && typeof uhr.unref === 'function') uhr.unref();
}

export function protokolliere(art, fehler, { datei = '', zeile = null, vorsatz = '' } = {}) {
  try {
    const { text, ort } = beschreibe(fehler);
    const e = { z: Date.now(), art: ARTEN.includes(art) ? art : 'fehler', text: bereinige(vorsatz ? `${vorsatz}: ${text}` : text) };
    const d = dateiName(datei);
    const zl = Number(zeile);
    if (d) {
      e.datei = d;
      if (Number.isInteger(zl) && zl > 0) e.zeile = zl;
    } else if (ort) {
      e.datei = ort.datei;
      e.zeile = ort.zeile;
    }
    const z = lade();
    const letzter = z.eintraege[0];
    if (letzter && letzter.art === e.art && letzter.text === e.text && letzter.datei === e.datei && letzter.zeile === e.zeile) {
      letzter.n = Math.min((letzter.n || 1) + 1, 9999);
      letzter.z = e.z;
    } else z.eintraege = kuerze([e, ...z.eintraege]);
    planeSchreiben();
    return { ...e };
  } catch (f) {
    return null;
  }
}

export function eintraege() {
  try { return lade().eintraege.map((e) => ({ ...e })); } catch (e) { return []; }
}

export function leere() {
  try {
    lade().eintraege = [];
    schreibeJetzt();
  } catch (e) { /* egal */ }
}

export function merkeEngineStart(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n) || n < 0) return;
  try {
    lade().engine = { ms: Math.min(Math.round(n), 600000), z: Date.now() };
    planeSchreiben();
  } catch (e) { /* egal */ }
}

export function engineStart() {
  try { const e = lade().engine; return e ? { ...e } : null; } catch (e) { return null; }
}

// ---------- Hoerer ----------
// "partien", "modul:kartei", "review" (ohne Partie-ID): nur der Bereich des Schluessels
function bereichVon(schluessel) {
  const k = String(schluessel || '').replace(/^schach-arena:(v1:)?/, '');
  return k.startsWith('review:') ? 'review' : bereinige(k, 40);
}

function beiFehler(ev) {
  try {
    const ziel = ev && ev.target;
    // Fehler an einem Element (nur im Capture zu sehen): ein Skript, das nicht laedt, zaehlt; Bild, Stylesheet, Schrift nicht
    if (ziel && typeof window !== 'undefined' && ziel !== window && ziel.tagName) {
      if (String(ziel.tagName).toUpperCase() === 'SCRIPT') protokolliere('skript', '', { datei: ziel.src || '' });
      return;
    }
    const f = ev && ev.error;
    const mitMeldung = f && typeof f === 'object' && f.message != null;
    protokolliere('fehler', mitMeldung ? f : (ev && ev.message) || f, { datei: ev && ev.filename, zeile: ev && ev.lineno });
  } catch (e) { /* nie nach aussen */ }
}

function beiAblehnung(ev) {
  try { protokolliere('promise', ev ? ev.reason : null); } catch (e) { /* nie nach aussen */ }
}

try {
  hoere('speicher:fehler', (d) => {
    protokolliere('speicher', `${d && d.grund === 'fehler' ? 'fehler' : 'voll'} (${bereichVon(d && d.schluessel)})`);
  });
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('error', beiFehler, true);
    window.addEventListener('unhandledrejection', beiAblehnung);
    window.addEventListener('pagehide', () => { if (dreckig) schreibeJetzt(); });
  }
  if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && dreckig) schreibeJetzt(); });
  }
} catch (e) { /* die App laeuft auch ohne Protokoll */ }
