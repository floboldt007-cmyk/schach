// Ereignis-Bus der Schach-Arena (Runde 4, Welle 0). Rein, ohne DOM, in Node testbar.
// Ueber diesen Bus klinken sich die Pakete ein, ohne fremde Dateien zu aendern.
//
//   import { hoere, sende } from './ereignisse.js';
//   const ab = hoere('zug:bewertet', (d) => { ... });   // ab() meldet wieder ab
//   sende('zug:bewertet', { laufId, ply, klasse, ... });
//
// API:
//   EREIGNISSE                     eingefrorene Liste aller erlaubten Namen (Vertrag: BAUPLAN 3.3,
//                                  ARCHITEKTUR.md "Runde 4: Erweiterungspunkte"; W0+a: SPIELKONZEPT 6.2,
//                                  ARCHITEKTUR.md "W0+a: Spiel-Fundament")
//   hoere(name, fn) -> abmelden()  unbekannter Name oder fn keine Funktion: Fehler (Tippfehler fallen
//                                  sofort auf). Abmelden ist idempotent.
//   sende(name, daten = {})        synchron, Hoerer in Anmelde-Reihenfolge. Die Hoerer bekommen eine
//                                  flach eingefrorene Kopie der Daten (der Aufrufer behaelt sein Objekt).
//                                  Jeder Hoerer laeuft in try/catch: ein Fehler stoppt nie die Partie
//                                  (er landet als console.error in der Konsole). Unbekannter Name: Fehler.
//                                  Ohne Hoerer (und ohne Protokoll) kehrt sende sofort zurueck.
//   protokoll() -> [{ name, t }]   die letzten 200 gesendeten Ereignisse (t = performance.now() bzw.
//                                  Date.now()); nur mit ?test in der Adresse bzw. in Node, sonst leer
//   zuruecksetzen()                alle Hoerer und das Protokoll entfernen (nur fuer Tests)
//
// Regeln fuer Hoerer: hoechstens 2 ms, schwere Arbeit per setTimeout(fn, 0); idempotent
// (partie:analysiert kann je partieId zweimal kommen).

export const EREIGNISSE = Object.freeze([
  'app:bereit', 'app:screen', 'app:sichtbar',
  'partie:gestartet', 'partie:verlassen',
  'zug:gespielt', 'stellung:analysiert', 'zug:bewertet', 'zug:zurueckgenommen',
  'hilfe:genutzt',
  'partie:beendet', 'partie:analysiert',
  'analyse:gesehen',
  'speicher:fehler', 'speicher:zurueckgesetzt',
  'training:geloest', 'training:stand',
  'uebung:ergebnis',
  'bestmarke:neu',
  'liga:geaendert',
  // W0+a "Spiel-Fundament" (SPIELKONZEPT 6.2 und 3.18), Datenvertrag in ARCHITEKTUR.md
  'funken:gebucht', 'level:aufstieg', 'tag:gezaehlt', 'raetsel:geloest', 'lektion:beendet',
  'boss:treffer', 'boss:siegel', 'rekord:neu', 'uhr:knapp', 'zug:abgelehnt',
  // Paket funken (S1-1): Summe einer Buchung fuer Serie, Liga und andere Pakete, Vertrag in ARCHITEKTUR.md
  'funken:geaendert',
  // Paket boss (S1-6) meldet, dass daten/boss/spielplan.json geladen ist; erst dann liest funken den Spielplan (kein 404)
  'spielplan:geladen',
  // Paket punkte (S1-3): { punkte, platz, tafel, rekord } je bewerteter Partie, Vertrag in ARCHITEKTUR.md
  'punkte:geaendert',
  // Paket serie (P3): { tag, lauf, meilenstein, ... } nach jedem gezaehlten Tag und jeder Aenderung am Siegeslauf
  'serie:geaendert',
]);

const BEKANNT = new Set(EREIGNISSE);
const PROTOKOLL_MAX = 200;

// Protokoll nur im Testmodus (?test) und in Node (kein window)
const MIT_PROTOKOLL = typeof window === 'undefined'
  || (typeof location !== 'undefined' && /[?&]test\b/.test(location.search || ''));

const uhr = typeof performance !== 'undefined' && typeof performance.now === 'function'
  ? () => performance.now()
  : () => Date.now();

// name -> Array von { fn }; Kopie beim An- und Abmelden, damit sende ohne Kopie laufen kann
let hoererListe = new Map();
let protokollListe = [];

function pruefeName(name) {
  if (!BEKANNT.has(name)) throw new Error('Unbekanntes Ereignis: ' + String(name));
}

export function hoere(name, fn) {
  pruefeName(name);
  if (typeof fn !== 'function') throw new TypeError('hoere(' + name + '): fn ist keine Funktion');
  const eintrag = { fn };
  const alt = hoererListe.get(name) || [];
  hoererListe.set(name, [...alt, eintrag]);
  let aktiv = true;
  return function abmelden() {
    if (!aktiv) return;
    aktiv = false;
    const jetzt = hoererListe.get(name);
    if (!jetzt) return;
    const neu = jetzt.filter((e) => e !== eintrag);
    if (neu.length) hoererListe.set(name, neu);
    else hoererListe.delete(name);
  };
}

export function sende(name, daten = {}) {
  pruefeName(name);
  const liste = hoererListe.get(name);
  if (MIT_PROTOKOLL) {
    protokollListe.push(Object.freeze({ name, t: uhr() }));
    // selten kuerzen (nicht bei jedem Aufruf), protokoll() liefert nur die letzten 200
    if (protokollListe.length >= 2 * PROTOKOLL_MAX) protokollListe = protokollListe.slice(-PROTOKOLL_MAX);
  }
  if (!liste) return;
  const d = Object.freeze(daten && typeof daten === 'object' ? { ...daten } : {});
  for (const e of liste) {
    try {
      e.fn(d);
    } catch (f) {
      try { console.error('Ereignis-Hoerer fuer ' + name + ' fehlgeschlagen:', f); } catch (x) { /* egal */ }
    }
  }
}

export function protokoll() {
  return MIT_PROTOKOLL ? protokollListe.slice(-PROTOKOLL_MAX) : [];
}

export function zuruecksetzen() {
  hoererListe = new Map();
  protokollListe = [];
}
