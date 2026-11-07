// Kronen: die einzige sichtbare Rang-Zahl (Etappe B, Plan "Liga mit Kronen" unter docs/superpowers/plans/, Task 1).
// Hier steht bewusst kein Datum der Form JJJJ-MM-TT: der Vertragstest verbietet feste Saison-Startdaten in dieser Datei.
// Reine Rechnung ohne DOM und ohne Uhr: Stufen, Saison, Buchung mit Boden-Schutz, Rueckstufung, Start aus Elo.
// Dieselben Zahlen stehen in supabase/kronen-schema.sql (kronen_konstanten()); tests/kronen-vertrag.test.mjs haelt beide gleich.
// Der Server entscheidet ueber die Kronen, diese Datei rechnet nur nach und zeigt an.
import { KLASSEN_GRENZEN } from './wertung.js';

export const LIGEN = Object.freeze(['holz', 'bronze', 'silber', 'gold', 'diamant', 'krone']);
export const STUFEN_JE_LIGA = 3; // III, II, I aufsteigend
export const STUFE_KRONEN = 100; // entschieden 06.11.2026: 100 Kronen je Stufe, Krone I ab 1700
export const STUFEN_ANZAHL = LIGEN.length * STUFEN_JE_LIGA;
// entschieden 06.11.2026: Mensch aus der Gegnersuche, KI-Gegner aus der Gegnersuche (Bot nach 10 s), Bot-Leiter
export const KRONEN = Object.freeze({
  online: Object.freeze({ sieg: 30, remis: 10, niederlage: -15 }),
  ki: Object.freeze({ sieg: 20, remis: 5, niederlage: -10 }),
  bot: Object.freeze({ sieg: 15, remis: 5, niederlage: 0 }),
  // Etappe 5, Raetsel-Duell (supabase/raetsel-duell-schema.sql): gegen Menschen wie online, gegen den KI-Gegner wie ki
  duell: Object.freeze({ sieg: 30, remis: 10, niederlage: -15 }),
  duell_ki: Object.freeze({ sieg: 20, remis: 5, niederlage: -10 }),
});
export const BOT_TAGESGRENZE = 10; // entschieden 06.11.2026: gewertete Bot-Leiter-Ergebnisse je Tag (Europe/Berlin)
export const KI_TAGESGRENZE = 20; // entschieden 06.11.2026: gewertete KI-Gegner-Ergebnisse je Tag (Europe/Berlin)
export const KI_MINDESTDAUER_S = 60; // entschieden 06.11.2026: Suchbeleg fruehestens 60 s nach Ausgabe einloesbar
// entschieden 06.11.2026 (Orchestrator, Schutz gegen Absprache zweier Konten): Online-Partien mit weniger als 4 Halbzuegen
// und ab der 4. gewerteten Partie am Tag (Europe/Berlin) gegen denselben Gegner bleiben ohne Kronen und ohne Elo
export const ONLINE_MINDEST_HALBZUEGE = 4;
export const PAAR_TAGESGRENZE = 3;
export const SAISON_TAGE = 28; // entschieden 06.11.2026: 4 Wochen; der Start ist eine Einstellung, kein Wert im Code
export const RUECKSTUFUNG_STUFEN = 3; // entschieden 06.11.2026: eine ganze Liga zurueck
// Start-Liga (Task 6): der Server begrenzt die gemeldete Elo auf diesen Bereich (kronen_start, kronen_konstanten)
export const START_ELO_GRENZEN = Object.freeze([400, 2800]);

const LIGA_KRONEN = STUFE_KRONEN * STUFEN_JE_LIGA;
const MAX_INDEX = STUFEN_ANZAHL - 1;
const zahl = (v) => (Number.isFinite(v) ? v : 0);
const indexVon = (kronen) => Math.min(MAX_INDEX, Math.max(0, Math.floor(zahl(kronen) / STUFE_KRONEN)));

export function stufeVon(kronen) {
  const index = indexVon(kronen);
  return {
    index,
    liga: LIGEN[Math.floor(index / STUFEN_JE_LIGA)],
    rang: STUFEN_JE_LIGA - (index % STUFEN_JE_LIGA),
    boden: index * STUFE_KRONEN,
    naechste: index < MAX_INDEX ? (index + 1) * STUFE_KRONEN : null,
  };
}

export function ligaBoden(kronen) {
  return Math.floor(indexVon(kronen) / STUFEN_JE_LIGA) * LIGA_KRONEN;
}

// Innerhalb einer Saison nie unter den Anfang der erreichten Liga; der Boden steigt mit, faellt aber nie.
export function bucheKronen(stand, delta) {
  const boden = Math.max(0, zahl(stand && stand.boden));
  const kronen = Math.max(boden, 0, zahl(stand && stand.kronen) + zahl(delta));
  return { kronen, boden: Math.max(boden, ligaBoden(kronen)) };
}

export function kronenFuer(quelle, ergebnis) {
  const werte = Object.hasOwn(KRONEN, quelle) ? KRONEN[quelle] : null;
  return werte && Object.hasOwn(werte, ergebnis) ? werte[ergebnis] : 0;
}

// Kalendertage in UTC gerechnet: 'YYYY-MM-DD' ist schon der Tag in Europe/Berlin (vom Server), Sommerzeit spielt keine Rolle.
const TAG_MS = 86400000;
const alsTag = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / TAG_MS;
const alsText = (t) => new Date(t * TAG_MS).toISOString().slice(0, 10);

// Saison 0 laeuft ohne Wechsel, solange kein Start gesetzt ist oder der Start noch kommt; im zweiten Fall endet sie mit dem Start.
export function saisonAm(tag, start) {
  if (!start) return { nr: 0, start: null, ende: null };
  const seit = alsTag(tag) - alsTag(start);
  if (seit < 0) return { nr: 0, start: null, ende: start };
  const nr = Math.floor(seit / SAISON_TAGE) + 1;
  const beginn = alsTag(start) + (nr - 1) * SAISON_TAGE;
  return { nr, start: alsText(beginn), ende: alsText(beginn + SAISON_TAGE) };
}

export function neueSaisonKronen(kronen) {
  const ziel = Math.max(0, indexVon(kronen) - RUECKSTUFUNG_STUFEN) * STUFE_KRONEN;
  return { kronen: ziel, boden: ligaBoden(ziel) };
}

// Modul-Speicher "kronen" (js/storage.js), geprueft beim Lesen: { konto, stand, startGemeldet }. stand ist der letzte
// Server-Stand (kronen_mein_stand) und gilt nur fuer dasselbe Konto; die Startseite zeigt ihn sofort und offline (Task 7).
// startGemeldet ist der Merker fuer die Start-Liga (Task 6), nur ein echtes boolean zaehlt.
export function kronenSpeicher(roh) {
  const o = roh && typeof roh === 'object' && !Array.isArray(roh) ? roh : {};
  const st = o.stand && typeof o.stand === 'object' && !Array.isArray(o.stand) && Number.isFinite(o.stand.kronen) ? o.stand : null;
  return { konto: typeof o.konto === 'string' && o.konto ? o.konto : null, stand: st, startGemeldet: o.startGemeldet === true };
}

// Bestandsspieler: Spielklasse aus der Elo (KLASSEN_GRENZEN) wird zum Anfang der Liga (Stufe III), hoechstens Diamant III.
export function startKronenAusElo(elo) {
  let klasse = 0;
  KLASSEN_GRENZEN.forEach((grenze, i) => { if (zahl(elo) >= grenze) klasse = i; });
  return Math.min(klasse, LIGEN.indexOf('diamant')) * LIGA_KRONEN;
}
