// Sprachen der App (Englische Version, Teil 1, 24.10.2026). Rein, ohne DOM, in Node testbar.
// Deutsch ist die Quelle: die Woerterbuecher unter js/sprachen/<bereich>.js enthalten die heutigen deutschen Texte
// woertlich und daneben die englischen. Ohne Wahl bleibt alles deutsch (alle Tests laufen auf Deutsch).
//
//   import { t, sprache } from '../sprache.js';
//   import '../sprachen/arena.js';                 // meldet die Texte des Bereichs an (Seiteneffekt)
//   el.textContent = t('arena.kopf.titel');         // "Fünf Welten, 30 Bots" | "Five worlds, 30 bots"
//   t('partie.zuege', { n: 2 })                     // Mehrzahl: Schluessel 'zuege.eins' (n = 1) und 'zuege.mehr'
//   t('ergebnis.gegen', { name: 'Benno' })          // Platzhalter {name}
//
// API:
//   SPRACHEN = ['de', 'en']
//   sprache() -> 'de' | 'en'
//   setzeSprache(code) -> code   unbekannt: 'de'; setzt auch <html lang> (falls es ein document gibt)
//   registriereTexte(bereich, { de: {...}, en: {...} })   bereich [a-z][a-z0-9-]*; Schluessel ohne den Bereich
//   t(schluessel, werte = {}) -> Text   'bereich.schluessel'. Fehlt er im Englischen: der deutsche Text; fehlt er ganz:
//       der Schluessel selbst (und mit ?test eine Warnung). Mit werte.n und ohne den Schluessel selbst: Mehrzahl
//       ueber '<schluessel>.eins' (n === 1) bzw. '<schluessel>.mehr'. Platzhalter {name} aus werte; Zahlen in werte
//       werden mit zahl() formatiert, wenn der Platzhalter {name:zahl} heisst.
//   zahl(n, opt) / datum(d, opt)   Intl mit der Sprache ('de-DE' | 'en-US')
//   locale() -> 'de-DE' | 'en-US'
//   texte(sprache) -> { 'bereich.schluessel': Text }   (Tests: alle angemeldeten Texte einer Sprache)
//   SPRACHWAHL   true seit Teil 2 (alle Screens und Pakete uebersetzt): die Einstellungen zeigen die Wahl. Dazu schaltet
//       weiter die Adresse um (?sprache=en, wird gemerkt) und die gespeicherte Einstellung gilt.
//
// Regeln fuer Woerterbuecher: t() erst beim Zeichnen aufrufen, nie beim Laden eines Moduls (sonst bliebe der Text in
// der Sprache von vor dem Start stehen). Texte ohne HTML; Markup bleibt im Code.
export const SPRACHEN = Object.freeze(['de', 'en']);
export const SPRACHWAHL = true;
const LOCALE = { de: 'de-DE', en: 'en-US' };
const BEREICH_RE = /^[a-z][a-z0-9-]*$/;

let aktuell = 'de';
const tabelle = { de: new Map(), en: new Map() };
const gewarnt = new Set();

export function sprache() {
  return aktuell;
}

export function locale() {
  return LOCALE[aktuell];
}

export function setzeSprache(code) {
  aktuell = SPRACHEN.includes(code) ? code : 'de';
  try {
    if (typeof document !== 'undefined' && document.documentElement) document.documentElement.lang = aktuell;
  } catch (e) { /* egal */ }
  return aktuell;
}

export function registriereTexte(bereich, { de = {}, en = {} } = {}) {
  if (typeof bereich !== 'string' || !BEREICH_RE.test(bereich)) throw new TypeError('registriereTexte: Bereich ungültig');
  for (const [s, quelle] of [['de', de], ['en', en]]) {
    for (const [k, v] of Object.entries(quelle || {})) {
      if (typeof v === 'string') tabelle[s].set(bereich + '.' + k, v);
    }
  }
}

function test() {
  return typeof location !== 'undefined' && /[?&]test\b/.test(location.search || '');
}

function suche(schluessel) {
  if (tabelle[aktuell].has(schluessel)) return tabelle[aktuell].get(schluessel);
  if (tabelle.de.has(schluessel)) return tabelle.de.get(schluessel);
  return null;
}

export function zahl(n, opt = {}) {
  try { return new Intl.NumberFormat(LOCALE[aktuell], opt).format(n); } catch (e) { return String(n); }
}

export function datum(d, opt = {}) {
  try { return new Intl.DateTimeFormat(LOCALE[aktuell], opt).format(d instanceof Date ? d : new Date(d)); } catch (e) { return ''; }
}

export function t(schluessel, werte = {}) {
  let text = suche(schluessel);
  if (text == null && werte && Number.isFinite(werte.n)) text = suche(schluessel + (werte.n === 1 ? '.eins' : '.mehr'));
  if (text == null) {
    if (test() && !gewarnt.has(schluessel)) {
      gewarnt.add(schluessel);
      console.warn('sprache: Text fehlt: ' + schluessel);
    }
    return schluessel;
  }
  if (!werte || typeof werte !== 'object') return text;
  return text.replace(/\{([a-zA-Z0-9_]+)(:zahl)?\}/g, (ganz, name, alsZahl) => {
    if (!Object.hasOwn(werte, name)) return ganz;
    const v = werte[name];
    return alsZahl && Number.isFinite(v) ? zahl(v) : String(v);
  });
}

export function texte(s = aktuell) {
  return Object.fromEntries(tabelle[SPRACHEN.includes(s) ? s : 'de']);
}
