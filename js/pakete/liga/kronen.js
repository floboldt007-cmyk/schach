// Kronen und Liga-Stufen (Etappe B, Plan "Liga mit Kronen" unter docs/superpowers/plans/; Umbau Wochen-Gruppen 07.11.2026).
// Reine Rechnung ohne DOM und ohne Uhr: Stufen-Namen, Zonen der Wochen-Gruppe, Belohnung je Platz, Start aus Elo.
// Dieselben Zahlen stehen in supabase/kronen-schema.sql (kronen_konstanten()); tests/kronen-vertrag.test.mjs haelt beide gleich.
// Der Server entscheidet ueber Kronen, Gruppen und Auf-/Abstieg, diese Datei rechnet nur nach und zeigt an.
//
// Liga neu (Flo 07.11.2026, Konzept Abschnitt 5a): 18 Stufen, die Ligen heissen wie Figuren (Bauer bis Koenig, je III,
// II, I), die Farben bleiben Holz bis Krone. Jede Woche 30 Plaetze, Platz 1 bis 5 steigen auf, die letzten 5 ab.
import { KLASSEN_GRENZEN } from './wertung.js';

export const LIGEN = Object.freeze(['bauer', 'springer', 'laeufer', 'turm', 'dame', 'koenig']);
export const FARBEN = Object.freeze(['holz', 'bronze', 'silber', 'gold', 'diamant', 'krone']);
export const STUFEN_JE_LIGA = 3; // III, II, I aufsteigend
export const STUFEN_ANZAHL = LIGEN.length * STUFEN_JE_LIGA;
// entschieden 06.11.2026: Mensch aus der Gegnersuche, KI-Gegner aus der Gegnersuche (Bot nach 10 s), Bot-Leiter
export const KRONEN = Object.freeze({
  online: Object.freeze({ sieg: 30, remis: 10, niederlage: -15 }),
  ki: Object.freeze({ sieg: 20, remis: 5, niederlage: -10 }),
  bot: Object.freeze({ sieg: 15, remis: 5, niederlage: 0 }),
});
export const BOT_TAGESGRENZE = 10; // entschieden 06.11.2026: gewertete Bot-Leiter-Ergebnisse je Tag (Europe/Berlin)
export const KI_TAGESGRENZE = 20; // entschieden 06.11.2026: gewertete KI-Gegner-Ergebnisse je Tag (Europe/Berlin)
export const KI_MINDESTDAUER_S = 60; // entschieden 06.11.2026: Suchbeleg fruehestens 60 s nach Ausgabe einloesbar
// entschieden 06.11.2026 (Orchestrator, Schutz gegen Absprache zweier Konten): Online-Partien mit weniger als 4 Halbzuegen
// und ab der 4. gewerteten Partie am Tag (Europe/Berlin) gegen denselben Gegner bleiben ohne Kronen und ohne Elo
export const ONLINE_MINDEST_HALBZUEGE = 4;
export const PAAR_TAGESGRENZE = 3;
// Start-Liga (Task 6): der Server begrenzt die gemeldete Elo auf diesen Bereich (kronen_start, kronen_konstanten)
export const START_ELO_GRENZEN = Object.freeze([400, 2800]);
export const START_HOECHSTE_LIGA = 4; // Dame III
// Wochen-Gruppen (Flo 07.11.2026)
export const GRUPPE_GROESSE = 30;
export const AUFSTIEG_PLAETZE = 5;
export const ABSTIEG_PLAETZE = 5;
// Belohnung je Platz (Claudes Annahme 07.11.2026, Flo kann sie aendern): Platz 1 Banner, dann fallende Taler-Stapel
export const BELOHNUNG = Object.freeze([
  Object.freeze({ von: 1, bis: 1, art: 'banner', menge: 1 }),
  Object.freeze({ von: 2, bis: 2, art: 'taler', menge: 120 }),
  Object.freeze({ von: 3, bis: 3, art: 'taler', menge: 100 }),
  Object.freeze({ von: 4, bis: 5, art: 'taler', menge: 80 }),
  Object.freeze({ von: 6, bis: 10, art: 'taler', menge: 40 }),
  Object.freeze({ von: 11, bis: 20, art: 'taler', menge: 20 }),
]);
// Wochenziel eines Bots: 0 bis zu diesem Wert, je Liga (nur fuer den Vertragstest; die Bots rechnet der Server)
export const BOT_ZIEL_MAX = Object.freeze([150, 250, 350, 450, 600, 800]);

const MAX_INDEX = STUFEN_ANZAHL - 1;
const zahl = (v) => (Number.isFinite(v) ? v : 0);
const index = (i) => Math.min(MAX_INDEX, Math.max(0, Math.floor(zahl(i))));

// Stufe 0 (Bauer III) bis 17 (Koenig I): Liga, Farbe und Rang (3 = III, 1 = I); unsinnige Werte ergeben Bauer III
export function stufeInfo(i) {
  const s = index(i);
  const l = Math.floor(s / STUFEN_JE_LIGA);
  return { index: s, liga: LIGEN[l], farbe: FARBEN[l], rang: STUFEN_JE_LIGA - (s % STUFEN_JE_LIGA) };
}

export const naechsteStufe = (i) => (index(i) < MAX_INDEX ? index(i) + 1 : null);
export const vorigeStufe = (i) => (index(i) > 0 ? index(i) - 1 : null);

// Zone eines Platzes in einer Gruppe von n (Standard 30) auf einer Stufe: 'auf' (Platz 1 bis 5), 'ab' (die letzten 5),
// sonst 'bleib'. Am Rand wie der Server: in Koenig I steigt niemand auf, in Bauer III niemand ab.
export function zoneVon(platz, { n = GRUPPE_GROESSE, stufe = 0 } = {}) {
  const p = Math.floor(zahl(platz));
  if (p < 1) return 'bleib';
  if (p <= AUFSTIEG_PLAETZE) return naechsteStufe(stufe) === null ? 'bleib' : 'auf';
  if (p > n - ABSTIEG_PLAETZE) return vorigeStufe(stufe) === null ? 'bleib' : 'ab';
  return 'bleib';
}

export function belohnungFuer(platz) {
  const p = Math.floor(zahl(platz));
  return BELOHNUNG.find((b) => p >= b.von && p <= b.bis) || null;
}

export function kronenFuer(quelle, ergebnis) {
  const werte = Object.hasOwn(KRONEN, quelle) ? KRONEN[quelle] : null;
  return werte && Object.hasOwn(werte, ergebnis) ? werte[ergebnis] : 0;
}

// Modul-Speicher "kronen" (js/storage.js), geprueft beim Lesen: { konto, stand, startGemeldet }. stand ist der letzte
// Server-Stand (kronen_mein_stand: { stufe, kronen, platz, n, woche }) und gilt nur fuer dasselbe Konto; die Startseite
// zeigt ihn sofort und offline. startGemeldet ist der Merker fuer die Start-Liga (Task 6), nur ein echtes boolean zaehlt.
export function kronenSpeicher(roh) {
  const o = roh && typeof roh === 'object' && !Array.isArray(roh) ? roh : {};
  const st = o.stand && typeof o.stand === 'object' && !Array.isArray(o.stand) && Number.isFinite(o.stand.kronen) ? o.stand : null;
  return { konto: typeof o.konto === 'string' && o.konto ? o.konto : null, stand: st, startGemeldet: o.startGemeldet === true };
}

// Bestandsspieler: Spielklasse aus der Elo (KLASSEN_GRENZEN) wird zur Stufe III ihrer Liga, hoechstens Dame III.
export function startStufeAusElo(elo) {
  let klasse = 0;
  KLASSEN_GRENZEN.forEach((grenze, i) => { if (zahl(elo) >= grenze) klasse = i; });
  return Math.min(klasse, START_HOECHSTE_LIGA) * STUFEN_JE_LIGA;
}
