// Paket "start" (Welle A, A4): reine Logik, ohne DOM, in Node testbar, kein Math.random und keine Uhr (Tage kommen als
// Schluessel aus tag.js herein, Grenze 4:00). Willkommen, Einstufungstest mit Empfehlung, Entdeckungs-Fahrplan, erster Sieg.
//
// Willkommen:
//   ersterScreenWahl(modul, { partienZahl, laufend }) -> 'start' | null   nur beim allerersten Start: keine gespeicherte
//     Partie, keine laufende Partie und das Willkommen noch nie gezeigt (modul.gesehen leer)
// Einstufung (8 Aufgaben aus aufgaben.js EINSTUFUNG, steigende Schwierigkeit):
//   punkteVon({ richtig, versuch }) -> 1 (erster Versuch) | 0,5 (spaeter geloest) | 0 (Loesung gezeigt)
//   auswerten(ergebnisse) -> { punkte, geloest, ersterVersuch, gesamt, je: [[id, p]] }   ergebnisse wie die
//     Zusammenfassung des Raetsel-Bildschirms ({ id, richtig, versuch }); fehlende Aufgaben zaehlen 0
//   botFuerPunkte(punkte) -> botId nach EMPFEHLUNG (hoechstens Professor Turm: 8 Aufgaben sagen ueber die oberen
//     Stufen zu wenig)
//   empfehlung({ ergebnisse, hoechsteFrei }) -> { botId, stufe, probe, punkte, geloest, ersterVersuch, gesamt, je, staerken,
//     luecke }   staerken: thema der zwei schwersten im ersten Versuch geloesten Aufgaben, luecke: naechstes der leichtesten
//     nicht geloesten. probe: der Bot steht ueber der hoechsten freigeschalteten Stufe; dann gibt es ihn nur als Probepartie
//     (Modus 'frei', wertet nie). Die Leiter bleibt: Sterne und Freischaltung nur der Reihe nach.
//   begruendung(e, { botName }) -> { kurz, saetze }   ehrliche Saetze aus den Ergebnissen (keine Elo-Schaetzung)
// Entdeckungs-Fahrplan (SPIELKONZEPT 3.16): hoechstens ein Hinweis "Neu fuer dich" je Tag in den ersten FAHRPLAN_TAGE
//   Tagen, nur fuer Funktionen, die es gibt (Bedingungen aus dem Kontext), nie fuer etwas, das Flo schon benutzt hat.
//   fahrplanStart(modul, { tag, partien }) -> modul   setzt den ersten Tag (und erfahren ab ERFAHREN_AB Partien: dann nur
//     neue Funktionen, keine Grundlagen wie Analyse oder Verlauf)
//   hinweisHeute(modul, { tag, an, partien, training, einstufungFertig }) -> { id | null, modul }   der Hinweis des Tages;
//     ein neu gewaehlter steht danach in modul.fahrplan.heute (der Aufrufer speichert), ein erledigter kommt heute nicht
//     wieder und kein anderer an seiner Stelle
//   erledige(modul, id) -> modul   angetippt oder ausgeblendet
//   merkeBenutzt(modul, screen) -> { modul, neu }   ein Screen einer Entdeckung wurde besucht (dann kein Hinweis mehr)
// Erster Sieg (SPIELKONZEPT 3.16 "schneller erster Sieg", Feier-Quelle erster-sieg):
//   istErsterSieg({ ergebnis, wertet, fortschritt }) -> boolean   wertender Sieg, und der Fortschritt kennt genau einen
// Modul-Speicher "start" (Budget 6.000, RECHENSTAND 1):
//   { v, gesehen: '' | Tag, regeln: null | { tag, geloest, gesamt },
//     einstufung: null | { tag, rechenstand, punkte, geloest, ersterVersuch, gesamt, je: [[id, p]], botId },
//     ersterSieg: '' | partieId, letzte: '' | partieId (letzte beendete Partie, fuer den Hinweis zur Analyse),
//     fahrplan: { start: '' | Tag, erfahren, heute: null | { tag, id }, erledigt: [id], benutzt: [screen] } }
//   normalisiereModul(roh) liest alles robust (Falsches faellt still weg), leeresModul() ist der Anfang.
import { istSchluessel, tageZwischen } from '../../tag.js';
import { BOTS } from '../../bots.js';
import { EINSTUFUNG } from './aufgaben.js';

export const PAKET = 'start';
export const MODUL = 'start';
export const BUDGET = 6000;
export const RECHENSTAND = 1;
// Wahl-Ort app:erster-screen?: hinter Paketen mit eigener Wahl (Standard 50), damit ein Paket, das bewusst einen
// anderen ersten Screen will, nicht vom Willkommen verdraengt wird
export const WAHL_REIHENFOLGE = 80;
// Entdeckungs-Fahrplan: so viele Tage ab dem ersten Start, ab so vielen Partien beim ersten Start "erfahren"
export const FAHRPLAN_TAGE = 28;
export const ERFAHREN_AB = 5;
const ERLEDIGT_MAX = 20;

// Punkte -> Bot (bis einschliesslich). 8 Aufgaben: hoechstens Professor Turm (Stufe 6)
export const EMPFEHLUNG = Object.freeze([
  Object.freeze({ bis: 1.5, botId: 'benno' }),
  Object.freeze({ bis: 3, botId: 'hilde' }),
  Object.freeze({ bis: 4.5, botId: 'kalle' }),
  Object.freeze({ bis: 6, botId: 'lisa' }),
  Object.freeze({ bis: 7, botId: 'rudi' }),
  Object.freeze({ bis: 8, botId: 'turm' }),
]);

// Warum dieser Gegner (aus Bio und Eigenschaften der Bots in js/bots.js, eigene Saetze)
export const BOT_GRUND = Object.freeze({
  benno: 'Bauer Benno kennt die Zugregeln und freut sich über jede Figur. Gut für einen ersten Sieg.',
  hilde: 'Oma Hilde nimmt alles, was ungedeckt steht. Wer seine Figuren deckt, hat gegen sie gute Chancen.',
  kalle: 'Kalle greift sofort an und übersieht dabei viel. Wer Gabeln und Matt in 1 sieht, kommt gegen ihn weit.',
  lisa: 'Lisa Läufer sieht kurze Taktiken sofort, genau wie du. Eine Gegnerin auf Augenhöhe.',
  rudi: 'Ritter Rudi sucht Gabeln. Du findest sie auch, jetzt geht es darum, seine zu vermeiden.',
  turm: 'Professor Turm spielt geduldig und solide. Taktik allein reicht gegen ihn nicht, gerade das macht ihn lehrreich.',
});
export const SCHAETZUNG = 'Die Einstufung ist eine grobe Schätzung aus 8 Aufgaben. Du kannst jederzeit einen anderen Gegner wählen.';

// Entdeckungen in ihrer Reihenfolge. neu: auch fuer erfahrene Spieler (eine neue Funktion, keine Grundlage).
// screen: wer diesen Screen besucht, braucht den Hinweis nicht mehr. abTag: fruehestens am wievielten Tag nach dem ersten
// Start (0 = erster Tag; am ersten Tag nur die Analyse nach der ersten Partie, die Einstufung bot schon das Willkommen an).
// text: ein kurzer Satz, der in der Heute-Karte in eine Zeile passt (hoechstens 34 Zeichen; laengere schneidet das CSS ab).
// Eine zweizeilige Heute-Zeile schob auf dem iPad 1024 x 768 den Spielen-Knopf unter den Rand.
export const ENTDECKUNGEN = Object.freeze([
  Object.freeze({ id: 'analyse', screen: 'analyse', neu: false, abTag: 0, titel: 'Die Spielanalyse', text: 'Wo deine letzte Partie kippte.' }),
  Object.freeze({ id: 'einstufung', screen: null, neu: true, abTag: 1, titel: 'Die Einstufung', text: 'Finde den passenden Gegner.' }),
  Object.freeze({ id: 'training', screen: 'training', neu: true, abTag: 2, titel: 'Das Training', text: 'Deine Fehler als Rätsel.' }),
  Object.freeze({ id: 'einstellungen', screen: 'einstellungen', neu: false, abTag: 2, titel: 'Brett und Klang', text: 'Brettfarben, Klang, Hell, Dunkel.' }),
  Object.freeze({ id: 'verlauf', screen: 'verlauf', neu: false, abTag: 3, titel: 'Dein Verlauf', text: 'Alle Partien und deine Bilanz.' }),
]);
const BEDINGUNG = Object.freeze({
  analyse: (k) => k.partien >= 1,
  einstufung: (k) => !k.einstufungFertig,
  training: (k) => !!k.training,
  einstellungen: (k) => k.partien >= 2,
  verlauf: (k) => k.partien >= 3,
});
const ENTDECKUNG_IDS = new Set(ENTDECKUNGEN.map((e) => e.id));
const ENTDECKUNG_SCREENS = new Set(ENTDECKUNGEN.map((e) => e.screen).filter(Boolean));

const LEITER = new Map(BOTS.map((b) => [b.id, b]));
const EINSTUFUNG_IDS = new Set(EINSTUFUNG.map((a) => a.id));
const PARTIE_ID = /^[A-Za-z0-9_-]{1,40}$/;
const ganz = (x, min, max) => (Number.isInteger(x) && x >= min && x <= max ? x : null);

// ---------- Modul ----------
export function leeresModul() {
  return {
    v: RECHENSTAND, gesehen: '', regeln: null, einstufung: null, ersterSieg: '', letzte: '',
    fahrplan: { start: '', erfahren: false, heute: null, erledigt: [], benutzt: [] },
  };
}

function normalisiereEinstufung(e) {
  if (!e || typeof e !== 'object' || !istSchluessel(e.tag) || !LEITER.has(e.botId)) return null;
  const gesamt = ganz(e.gesamt, 1, 40);
  const geloest = ganz(e.geloest, 0, 40);
  const ersterVersuch = ganz(e.ersterVersuch, 0, 40);
  const punkte = typeof e.punkte === 'number' && e.punkte >= 0 && e.punkte <= 40 ? e.punkte : null;
  if (gesamt == null || geloest == null || ersterVersuch == null || punkte == null || geloest > gesamt || ersterVersuch > geloest) return null;
  const je = Array.isArray(e.je) ? e.je.filter((x) => Array.isArray(x) && typeof x[0] === 'string' && [0, 0.5, 1].includes(x[1]))
    .map((x) => [x[0].slice(0, 40), x[1]]).slice(0, 40) : [];
  return { tag: e.tag, rechenstand: ganz(e.rechenstand, 1, 1e6) || 1, punkte, geloest, ersterVersuch, gesamt, je, botId: e.botId };
}

export function normalisiereModul(roh) {
  const m = leeresModul();
  if (!roh || typeof roh !== 'object' || Array.isArray(roh)) return m;
  m.v = ganz(roh.v, 1, 1e6) || RECHENSTAND;
  if (istSchluessel(roh.gesehen)) m.gesehen = roh.gesehen;
  const r = roh.regeln;
  if (r && typeof r === 'object' && istSchluessel(r.tag) && ganz(r.gesamt, 1, 40) != null && ganz(r.geloest, 0, r.gesamt) != null) {
    m.regeln = { tag: r.tag, geloest: r.geloest, gesamt: r.gesamt };
  }
  m.einstufung = normalisiereEinstufung(roh.einstufung);
  if (typeof roh.ersterSieg === 'string' && PARTIE_ID.test(roh.ersterSieg)) m.ersterSieg = roh.ersterSieg;
  if (typeof roh.letzte === 'string' && PARTIE_ID.test(roh.letzte)) m.letzte = roh.letzte;
  const f = roh.fahrplan;
  if (f && typeof f === 'object' && !Array.isArray(f)) {
    if (istSchluessel(f.start)) m.fahrplan.start = f.start;
    m.fahrplan.erfahren = f.erfahren === true;
    if (f.heute && typeof f.heute === 'object' && istSchluessel(f.heute.tag) && ENTDECKUNG_IDS.has(f.heute.id)) {
      m.fahrplan.heute = { tag: f.heute.tag, id: f.heute.id };
    }
    if (Array.isArray(f.erledigt)) m.fahrplan.erledigt = [...new Set(f.erledigt.filter((x) => ENTDECKUNG_IDS.has(x)))].slice(-ERLEDIGT_MAX);
    if (Array.isArray(f.benutzt)) m.fahrplan.benutzt = [...new Set(f.benutzt.filter((x) => ENTDECKUNG_SCREENS.has(x)))];
  }
  return m;
}

// ---------- Willkommen ----------
export function ersterScreenWahl(modul, { partienZahl = 0, laufend = false } = {}) {
  const m = normalisiereModul(modul);
  if (m.gesehen || laufend || !(Number(partienZahl) === 0)) return null;
  return 'start';
}

// ---------- Einstufung ----------
export function punkteVon(erg) {
  if (!erg || erg.richtig !== true) return 0;
  return erg.versuch === 1 ? 1 : 0.5;
}

export function auswerten(ergebnisse) {
  const nachId = new Map();
  for (const e of Array.isArray(ergebnisse) ? ergebnisse : []) {
    if (e && EINSTUFUNG_IDS.has(e.id) && !nachId.has(e.id)) nachId.set(e.id, punkteVon(e));
  }
  const je = EINSTUFUNG.map((a) => [a.id, nachId.has(a.id) ? nachId.get(a.id) : 0]);
  const punkte = je.reduce((s, [, p]) => s + p, 0);
  return {
    punkte, gesamt: EINSTUFUNG.length, je,
    geloest: je.filter(([, p]) => p > 0).length,
    ersterVersuch: je.filter(([, p]) => p === 1).length,
  };
}

export function botFuerPunkte(punkte) {
  const p = Number.isFinite(punkte) ? punkte : 0;
  const i = EMPFEHLUNG.findIndex((x) => p <= x.bis);
  // fehlt ein Bot der Tabelle in der Leiter (z. B. nach einem Umbau der Leiter), der naechstschwaechere, zuletzt Stufe 1
  for (let j = i < 0 ? EMPFEHLUNG.length - 1 : i; j >= 0; j--) if (LEITER.has(EMPFEHLUNG[j].botId)) return EMPFEHLUNG[j].botId;
  return BOTS[0].id;
}

export function empfehlung({ ergebnisse = [], hoechsteFrei = 1 } = {}) {
  const a = auswerten(ergebnisse);
  const botId = botFuerPunkte(a.punkte);
  const stufe = LEITER.get(botId).stufe;
  const frei = Number.isInteger(hoechsteFrei) && hoechsteFrei >= 1 ? hoechsteFrei : 1;
  const p = new Map(a.je);
  // Staerken: die zwei schwersten im ersten Versuch geloesten Aufgaben; Luecke: die leichteste nicht geloeste
  const staerken = EINSTUFUNG.filter((x) => p.get(x.id) === 1).sort((x, y) => y.stufe - x.stufe).slice(0, 2).map((x) => x.thema);
  const offen = EINSTUFUNG.filter((x) => p.get(x.id) === 0).sort((x, y) => x.stufe - y.stufe);
  return { ...a, botId, stufe, probe: stufe > frei, staerken, luecke: offen.length ? offen[0].naechstes : null };
}

export function begruendung(e, { botName = '' } = {}) {
  const saetze = [];
  if (!e || !e.geloest) {
    saetze.push('Diesmal ging keine Aufgabe auf. Kein Problem: Die Leiter fängt ganz unten an.');
  } else {
    const zweite = e.geloest - e.ersterVersuch;
    const zahl = `${e.geloest} von ${e.gesamt} Aufgaben`;
    let rest;
    if (zweite === 0) rest = e.geloest === 1 ? ', im ersten Versuch.' : ', alle im ersten Versuch.';
    else if (e.ersterVersuch === 0) rest = e.geloest === 1 ? ', im zweiten Versuch.' : ', alle mit einem zweiten Versuch.';
    else rest = `, ${e.ersterVersuch} davon im ersten Versuch.`;
    saetze.push(`Du hast ${zahl} gelöst${rest}`);
  }
  if (e && e.staerken && e.staerken.length) saetze.push(`Gut gesehen: ${e.staerken.join(' und ')}.`);
  if (e && e.luecke && e.geloest) saetze.push(`Als Nächstes lohnt es sich, ${e.luecke}.`);
  const grund = e && BOT_GRUND[e.botId];
  if (grund) saetze.push(grund);
  const kurz = [saetze[0], grund].filter(Boolean).join(' ');
  return { kurz: kurz || (botName ? `Empfehlung: ${botName}.` : ''), saetze };
}

// ---------- Entdeckungs-Fahrplan ----------
export function fahrplanStart(modul, { tag, partien = 0 } = {}) {
  const m = normalisiereModul(modul);
  if (m.fahrplan.start || !istSchluessel(tag)) return m;
  m.fahrplan.start = tag;
  m.fahrplan.erfahren = Number(partien) >= ERFAHREN_AB;
  return m;
}

function passt(e, k, f, tage) {
  if (tage < e.abTag || f.erledigt.includes(e.id)) return false;
  if (e.screen && f.benutzt.includes(e.screen)) return false;
  if (f.erfahren && !e.neu) return false;
  const b = BEDINGUNG[e.id];
  return !!(b && b(k));
}

export function hinweisHeute(modul, k = {}) {
  const m = normalisiereModul(modul);
  const f = m.fahrplan;
  const kontext = { partien: Number(k.partien) || 0, training: !!k.training, einstufungFertig: !!k.einstufungFertig };
  if (!k.an || !f.start || !istSchluessel(k.tag)) return { id: null, modul: m };
  const tage = tageZwischen(f.start, k.tag);
  if (tage < 0 || tage >= FAHRPLAN_TAGE) return { id: null, modul: m };
  if (f.heute && f.heute.tag === k.tag) {
    // heute ist schon einer dran: derselbe (solange er passt), nie ein zweiter
    const e = ENTDECKUNGEN.find((x) => x.id === f.heute.id);
    return { id: e && passt(e, kontext, f, tage) ? e.id : null, modul: m };
  }
  const e = ENTDECKUNGEN.find((x) => passt(x, kontext, f, tage));
  if (!e) return { id: null, modul: m };
  m.fahrplan.heute = { tag: k.tag, id: e.id };
  return { id: e.id, modul: m };
}

export function erledige(modul, id) {
  const m = normalisiereModul(modul);
  if (!ENTDECKUNG_IDS.has(id) || m.fahrplan.erledigt.includes(id)) return m;
  m.fahrplan.erledigt = [...m.fahrplan.erledigt, id].slice(-ERLEDIGT_MAX);
  return m;
}

export function merkeBenutzt(modul, screen) {
  const m = normalisiereModul(modul);
  if (!ENTDECKUNG_SCREENS.has(screen) || m.fahrplan.benutzt.includes(screen)) return { modul: m, neu: false };
  m.fahrplan.benutzt = [...m.fahrplan.benutzt, screen];
  return { modul: m, neu: true };
}

export function entdeckung(id) {
  return ENTDECKUNGEN.find((e) => e.id === id) || null;
}

// ---------- Erster Sieg ----------
export function istErsterSieg({ ergebnis, wertet, fortschritt } = {}) {
  if (ergebnis !== 'sieg' || wertet !== true || !fortschritt || !fortschritt.bots) return false;
  let siege = 0;
  for (const b of BOTS) {
    const x = fortschritt.bots[b.id];
    if (x && Number.isFinite(x.siege)) siege += x.siege;
  }
  return siege === 1;
}
