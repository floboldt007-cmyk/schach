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
// Start-Liga (Task 6): der Server begrenzt die gemeldete Elo auf diesen Bereich (kronen_start, kronen_konstanten)
export const START_ELO_GRENZEN = Object.freeze([400, 2800]);
export const START_HOECHSTE_LIGA = 2; // Laeufer III (Flo 07.11.2026: Geraete-Elo ist nur eine Behauptung)
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
// Schummel-Schutz (Flo 07.11.2026): Bot- und KI-Gewinne zusammen hoechstens so viele Kronen je Woche, der Server
// erzwingt das (kronen_einfach_buchen); hier nur fuer die Anzeige "diese Woche voll"
export const BOT_KI_WOCHEN_MAX = 60;
// Platzhalter fuer die Regel-Erklaerung der Gruppe (p-liga.gruppe.regeln.*): die Texte nennen keine eigene Zahl
export const kronenRegelWerte = () => ({
  os: KRONEN.online.sieg, or: KRONEN.online.remis, on: -KRONEN.online.niederlage,
  ks: KRONEN.ki.sieg, kr: KRONEN.ki.remis, kn: -KRONEN.ki.niederlage,
  bs: KRONEN.bot.sieg, br: KRONEN.bot.remis,
  gruppe: GRUPPE_GROESSE, auf: AUFSTIEG_PLAETZE, ab: ABSTIEG_PLAETZE, lohn: BELOHNUNG[BELOHNUNG.length - 1].bis,
  botTag: BOT_TAGESGRENZE, kiTag: KI_TAGESGRENZE, woche: BOT_KI_WOCHEN_MAX,
});

const MAX_INDEX = STUFEN_ANZAHL - 1;
const zahl = (v) => (Number.isFinite(v) ? v : 0);
const index = (i) => Math.min(MAX_INDEX, Math.max(0, Math.floor(zahl(i))));

// Stufe 0 (Bauer III) bis 17 (Koenig I): Liga, Farbe und Rang (3 = III, 1 = I); unsinnige Werte ergeben Bauer III
export function stufeInfo(i) {
  const s = index(i);
  const l = Math.floor(s / STUFEN_JE_LIGA);
  return { index: s, liga: LIGEN[l], farbe: FARBEN[l], rang: STUFEN_JE_LIGA - (s % STUFEN_JE_LIGA) };
}

// R19 Season (supabase/saison-schema.sql, Vorschlag): Antworten des Servers mit denselben Grenzen wie dort pruefen.
// Was nicht passt, wird null bzw. weggelassen, nie eine geratene Zahl.
const SAISON_TITEL_RE = /^(crownmaster|top10|top100)-s([1-9][0-9]{0,3})$/;
const ganz = (v, von, bis) => Number.isInteger(v) && v >= von && v <= bis;
const DATUM_RE = /^\d{4}-\d{2}-\d{2}$/;

export function saisonAbzeichen(x) {
  return x && typeof x === 'object' && ganz(x.saison, 1, 9999) && ganz(x.stufe, 0, MAX_INDEX) ? { saison: x.saison, stufe: x.stufe } : null;
}

export function saisonTitel(id) {
  const m = typeof id === 'string' ? SAISON_TITEL_RE.exec(id) : null;
  return m ? { id, art: m[1], saison: Number(m[2]) } : null;
}

// saison_mein_stand: { saison (0 = Vorsaison), start, woche, wochen, ende, bisher, stufe, abzeichen[], titel[], gewaehlt }
export function saisonStand(d) {
  if (!d || typeof d !== 'object' || !ganz(d.saison, 0, 9999) || typeof d.start !== 'string' || !DATUM_RE.test(d.start)) return null;
  const laeuft = d.saison > 0;
  if (laeuft && (!ganz(d.wochen, 1, 52) || !ganz(d.woche, 1, d.wochen) || typeof d.ende !== 'string' || !DATUM_RE.test(d.ende))) return null;
  const abzeichen = (Array.isArray(d.abzeichen) ? d.abzeichen : []).map(saisonAbzeichen).filter(Boolean);
  const titel = (Array.isArray(d.titel) ? d.titel : []).map(saisonTitel).filter(Boolean);
  const gewaehlt = saisonTitel(d.gewaehlt);
  return {
    saison: d.saison, start: d.start, woche: laeuft ? d.woche : null, wochen: laeuft ? d.wochen : null, ende: laeuft ? d.ende : null,
    bisher: ganz(d.bisher, 0, MAX_INDEX) ? d.bisher : null, stufe: ganz(d.stufe, 0, MAX_INDEX) ? d.stufe : null,
    abzeichen, titel, gewaehlt: gewaehlt && titel.some((x) => x.id === gewaehlt.id) ? gewaehlt.id : null,
  };
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

// Bestandsspieler: Spielklasse aus der Elo (KLASSEN_GRENZEN) wird zur Stufe III ihrer Liga, hoechstens Laeufer III.
export function startStufeAusElo(elo) {
  let klasse = 0;
  KLASSEN_GRENZEN.forEach((grenze, i) => { if (zahl(elo) >= grenze) klasse = i; });
  return Math.min(klasse, START_HOECHSTE_LIGA) * STUFEN_JE_LIGA;
}
