// Stand des Pakets funken im Modul-Speicher (schach-arena:v1:modul:funken, Budget MODUL_BUDGET.funken = 25.000 Zeichen).
// Ohne DOM; in Node testbar (storage.setzeSpeicher mit einem Fake-Speicher). Alle Zeitpunkte kommen als Parameter
// (jetzt), Tage und Wochen aus js/tag.js (Tagesgrenze 4:00, nie toISOString). Kein Zufall.
//
// Form (Rechenstand STAND, alte Spielstaende ohne Modul starten bei 0 Funken und Level 1):
//   { stand: 1, gesamt, level,
//     heute: { tag, partien, funken, bogen, boss, quellen: { partie, lernen, tag, meilenstein } },
//         bogen: Funken des Tages VOR Rueckenwind (Tagesbogen), boss: Boss-Partien heute (Funken nur fuer die ersten 3)
//     verlauf: [{ id, t, tag, bot, erg, modus, f, p, m, ba, z, th, e, v, lb, fa, fn, rw, halb, of, g, lv, s, gr, nt, lbg }]
//         die letzten VERLAUF_MAX Partien mit Funken, neueste zuerst (f gesamt, p Partie-Teil, m Meilensteine, ba Basis vor
//         Faktor, z Zugwerte, th Theorie, e Ergebnis, v Verwertung, lb Lichtblick-Texte, fa Faktor, fn Faktor-Name,
//         rw Rueckenwind 'karte' | 'wochenende' | null, halb Tagesbogen griff, of offene Zuege, g Funken gesamt danach,
//         lv [Level vorher, nachher], s gebuchte Sterne als Bits, gr Grund ohne Partie-Funken ('boss' | 'kurz'),
//         nt Nachtrag (Lichtblick nach der Analyse), lbg Genauigkeits-Lichtblick schon geprueft, lg Genauigkeit der
//         letzten Partie gegen diesen Bot vor dieser, ms Meilenstein-Arten)
//     freigeschaltet: [id ...]   Stuecke aus level.js (nur Schmuck und Titel)
//     rw: { karten, woche, aktiv, start, letzterTag, willkommen, gespielt: [woche], aufgehoben: [woche], neu, planBis }
//         Rueckenwind: karten im Fach, aktiv = Einheiten, die noch doppelt zaehlen (nach "Zuenden" 3); start erster Tag,
//         woche: Woche der letzten Wochenkarte (null bis zur ersten Karte an Tag 4); neu: 'erste' | 'willkommen' |
//         'aufgehoben' (Text der Heute-Zeile); planBis: letzte Woche, deren Funken-Wochenende schon geprueft ist
//     aufstiege: [{ level, von, t }]   letzte Aufstiege (fuer "Seit Level n" im Koennen-Satz)
//     gruss: boolean                    der naechste Partiestart gruesst das neue Level
//     ids: [partieId ...]               verarbeitete partie:beendet (Ringpuffer, hoechstens IDS_MAX)
//     lernen: { ueb: { 'pid:ply': n }, mom: { pid: n }, lek: { id: 'asg' }, karten: { tag, n }, siegel: ['boss:stufe'],
//               rekord: [pid], raetsel: [id], wort: [tag], sitzung: null | { id, rw } }   sitzung: laufende Stapel-Sitzung im Training
//               (rw: die Sitzung zaehlt doppelt, sie hat eine Rueckenwind-Einheit verbraucht)
//     lauf: null | { id, fa, fn, ab, start, hilfe, ref, z: { ply: [klasse, gv, gn, flags, gvv, matt] } },
//     lage: null | { wert, t } }   Arena-Wertung aus liga:geaendert (Paket Wertung), sonst rechnet funken die Lage selbst
//         die laufende Partie (Live-Bewertungen fuer die Rechnung am Ende; flags: 1 trivial, 2 nach Hilfe)
//
// API:
//   lade(jetzt, { plan }) -> Stand (normalisiert, Tageswechsel, Wochenkarte, "Willkommen zurueck", "fuer dich aufgehoben")
//   speichere(st) -> { ok, zeichen, grund? }   duennt selbst aus, damit das Budget nie reisst
//   zuenden(st) -> boolean                     eine Karte zuenden (3 Einheiten doppelt), nie zwei zugleich
//   bucheEinheit(st, { quelle, vor, einheit, wochenende, woche }) -> { menge, faktor, quelle, verbraucht, halb }
//   gutschrift(st, menge, quelle)              Tabelle C und Nachtraege: ohne Bogen, ohne Rueckenwind
//   buchePartie(st, d, { lauf, jetzt, wochenende, botName, gegner }) -> { eintrag, buchungen } | null
//   nachtragPartie(st, d, { jetzt }) -> { eintrag, buchungen } | null
//   lern*(st, d, ctx) -> buchungen              Tabelle B (Uebung, Schluesselmoment, Karte, Lektion, Raetsel)
//   pruefeKarten(st, jetzt, { plan }) -> boolean   Rueckenwind-Karten (erste an Tag 4, Montag, Extra-Karten)
//   siegel(st, d), rekord(st, d, partieId) -> buchungen   Tabelle C
//   schliesseLevel(st, vorher, jetzt) -> null | { vorher, nachher, neu, titel }
//   setzeLage(st, d, jetzt) -> boolean, lageVon(st) -> Zahl | null   Arena-Wertung (liga:geaendert)
import { ladeModul, speichereModul, MODUL_BUDGET } from '../../storage.js';
import { tagSchluessel, wochenSchluessel, tageZwischen, addiereTage, istSchluessel, wochentag } from '../../tag.js';
import { spielplanWoche } from '../../inhalte.js';
import * as L from './level.js';
import * as R from './rechnung.js';

export const MODUL = 'funken';
export const STAND = 1;
export const VERLAUF_MAX = 30;
export const IDS_MAX = 300;
export const AUFSTIEGE_MAX = 12;
const QUELLEN = ['partie', 'lernen', 'tag', 'meilenstein'];
// Kurzform der Zugklassen im Speicher der laufenden Partie
const KLASSEN = ['brillant', 'stark', 'bester', 'exzellent', 'gut', 'buch', 'ungenau', 'fehler', 'verpasst', 'patzer', 'erzwungen'];

const zahl = (x, std = 0) => (typeof x === 'number' && Number.isFinite(x) ? x : std);
const ganz = (x, std = 0) => Math.max(0, Math.floor(zahl(x, std)));
const ms = (jetzt) => (jetzt instanceof Date ? jetzt.getTime() : zahl(jetzt, Date.now()));
const monat = (tag) => String(tag).slice(0, 7);
const liste = (x) => (Array.isArray(x) ? x : []);
const objekt = (x) => (x && typeof x === 'object' && !Array.isArray(x) ? x : {});

function leererTag(tag) {
  return { tag, partien: 0, funken: 0, bogen: 0, boss: 0, wort: 0, quellen: { partie: 0, lernen: 0, tag: 0, meilenstein: 0 } };
}

export function leer(jetzt = new Date()) {
  const tag = tagSchluessel(ms(jetzt));
  return {
    stand: STAND, gesamt: 0, level: 1, heute: leererTag(tag), verlauf: [],
    freigeschaltet: L.belohnungen(1).map((s) => s.id),
    rw: { karten: 0, woche: null, aktiv: 0, start: null, letzterTag: null, willkommen: null, gespielt: [], aufgehoben: [], neu: null,
      planBis: null },
    aufstiege: [], gruss: false, ids: [], lage: null,
    lernen: { ueb: {}, mom: {}, lek: {}, karten: { tag: null, n: 0 }, siegel: [], rekord: [], raetsel: [], wort: [], sitzung: null },
    lauf: null,
  };
}

// Gespeicherte Daten pruefen; Falsches wird still ersetzt (alte oder kaputte Spielstaende starten sauber)
export function normalisiere(roh, jetzt = new Date()) {
  const st = leer(jetzt);
  const r = objekt(roh);
  st.gesamt = ganz(r.gesamt);
  // Level sinkt nie: es folgt den Funken, die nie weniger werden
  st.level = Math.max(L.levelVon(st.gesamt), 1);
  const h = objekt(r.heute);
  if (istSchluessel(h.tag)) {
    st.heute = { tag: h.tag, partien: ganz(h.partien), funken: ganz(h.funken), bogen: Math.max(0, zahl(h.bogen)), boss: ganz(h.boss), wort: ganz(h.wort),
      quellen: Object.fromEntries(QUELLEN.map((q) => [q, ganz(objekt(h.quellen)[q])])) };
  }
  st.verlauf = liste(r.verlauf).filter((e) => e && typeof e.id === 'string' && Number.isFinite(e.f)).slice(0, VERLAUF_MAX);
  const frei = new Set(st.freigeschaltet);
  for (const id of liste(r.freigeschaltet)) if (typeof id === 'string' && /^[a-z0-9-]{1,40}$/.test(id)) frei.add(id);
  // Was das Level verspricht, ist immer freigeschaltet (auch nach einem Formelwechsel)
  for (let l = 2; l <= Math.min(st.level, 200); l++) for (const s of L.belohnungen(l)) frei.add(s.id);
  st.freigeschaltet = [...frei];
  const w = objekt(r.rw);
  st.rw = {
    karten: Math.min(R.KARTEN_MAX_EXTRA, ganz(w.karten)), woche: istSchluessel(w.woche) ? w.woche : null,
    aktiv: Math.min(R.RUECKENWIND_EINHEITEN, ganz(w.aktiv)), start: istSchluessel(w.start) ? w.start : null,
    letzterTag: istSchluessel(w.letzterTag) ? w.letzterTag : null, willkommen: /^\d{4}-\d{2}$/.test(w.willkommen || '') ? w.willkommen : null,
    gespielt: liste(w.gespielt).filter(istSchluessel).slice(-8), aufgehoben: liste(w.aufgehoben).filter(istSchluessel).slice(-8),
    neu: ['erste', 'willkommen', 'aufgehoben'].includes(w.neu) ? w.neu : null, planBis: istSchluessel(w.planBis) ? w.planBis : null,
  };
  st.aufstiege = liste(r.aufstiege).filter((a) => a && Number.isInteger(a.level) && Number.isFinite(a.t)).slice(0, AUFSTIEGE_MAX);
  st.gruss = r.gruss === true;
  const lg = objekt(r.lage);
  st.lage = Number.isFinite(lg.wert) ? { wert: Math.round(lg.wert), t: zahl(lg.t, 0) } : null;
  st.ids = liste(r.ids).filter((x) => typeof x === 'string').slice(-IDS_MAX);
  const le = objekt(r.lernen);
  const kar = objekt(le.karten);
  st.lernen = {
    ueb: objekt(le.ueb), mom: objekt(le.mom), lek: objekt(le.lek),
    karten: { tag: istSchluessel(kar.tag) ? kar.tag : null, n: ganz(kar.n) },
    siegel: liste(le.siegel).filter((x) => typeof x === 'string'), rekord: liste(le.rekord).filter((x) => typeof x === 'string').slice(-40),
    raetsel: liste(le.raetsel).filter((x) => typeof x === 'string').slice(-400),
    wort: [...new Set(liste(le.wort).filter(istSchluessel))].slice(-60),
    sitzung: typeof objekt(le.sitzung).id === 'string' ? { id: le.sitzung.id.slice(0, 40), rw: le.sitzung.rw === true } : null,
  };
  const lauf = objekt(r.lauf);
  st.lauf = typeof lauf.id === 'string' ? { ...lauf, z: objekt(lauf.z) } : null;
  return st;
}

// Neuer Tag ab 4:00: Tageszaehler leeren. Springt die Uhr zurueck (Schluessel frueher), zaehlt der alte Tag weiter.
export function tagWechsel(st, jetzt = new Date()) {
  const tag = tagSchluessel(ms(jetzt));
  if (st.heute.tag === tag) return false;
  if (istSchluessel(st.heute.tag) && tageZwischen(st.heute.tag, tag) <= 0) return false;
  st.heute = leererTag(tag);
  return true;
}

// Rueckenwind-Karten (SPIELKONZEPT 3.3 "Rueckenwind", 3.16 Entdeckungs-Fahrplan): die erste Karte kommt an Tag 4 (3 Tage
// nach dem ersten Start), danach jeden Montag 4:00 eine (hoechstens 3 im Fach); "Willkommen zurueck" nach mindestens
// 2 Tagen ohne Tageswerk (hoechstens einmal je Kalendermonat); "fuer dich aufgehoben" fuer jedes verpasste
// Funken-Wochenende seit dem ersten Start, auch wenn die App erst Wochen spaeter wieder aufgeht (jede Woche wird genau
// einmal geprueft, planBis). Karten im Fach bleiben liegen, bis Flo sie zuendet.
export const ERSTE_KARTE_TAG = 4;
// so weit schaut "fuer dich aufgehoben" hoechstens zurueck (zwei Jahre; mehr als 4 Karten passen ohnehin nicht ins Fach)
const AUFGEHOBEN_WOCHEN = 104;
export function pruefeKarten(st, jetzt = new Date(), { plan = null } = {}) {
  const t = ms(jetzt);
  const tag = tagSchluessel(t);
  const woche = wochenSchluessel(t);
  const rw = st.rw;
  let geaendert = false;
  if (!rw.start) { rw.start = tag; geaendert = true; }
  if (!rw.woche) {
    if (tageZwischen(rw.start, tag) >= ERSTE_KARTE_TAG - 1) {
      rw.karten = Math.max(rw.karten, Math.min(R.KARTEN_MAX, rw.karten + 1));
      rw.woche = woche;
      rw.neu = 'erste';
      geaendert = true;
    }
  } else {
    const d = tageZwischen(rw.woche, woche);
    if (d >= 7) {
      const neu = Math.floor(d / 7);
      rw.karten = Math.max(rw.karten, Math.min(R.KARTEN_MAX, rw.karten + neu));
      rw.woche = woche;
      geaendert = true;
    }
  }
  if (rw.letzterTag && tageZwischen(rw.letzterTag, tag) >= 3 && rw.willkommen !== monat(tag)) {
    rw.karten = Math.min(R.KARTEN_MAX_EXTRA, rw.karten + 1);
    rw.willkommen = monat(tag);
    rw.neu = 'willkommen';
    geaendert = true;
  }
  if (plan) {
    // alle abgeschlossenen Wochen seit der zuletzt geprueften (ohne planBis: seit der Woche des ersten Starts); die
    // laufende Woche erst, wenn ihr Wochenende vorbei ist (Montag 4:00)
    const vorige = addiereTage(woche, -7);
    const startWoche = addiereTage(rw.start, -wochentag(rw.start));
    let w = rw.planBis ? addiereTage(rw.planBis, 7) : startWoche;
    if (tageZwischen(w, vorige) > AUFGEHOBEN_WOCHEN * 7) w = addiereTage(vorige, -AUFGEHOBEN_WOCHEN * 7);
    for (; tageZwischen(w, vorige) >= 0; w = addiereTage(w, 7)) {
      const pw = spielplanWoche(plan, w);
      const freitag = addiereTage(w, 4);
      if (pw && pw.funkenWochenende === true && tageZwischen(rw.start, freitag) >= 0
        && !rw.gespielt.includes(w) && !rw.aufgehoben.includes(w)) {
        rw.karten = Math.min(R.KARTEN_MAX_EXTRA, rw.karten + 1);
        rw.aufgehoben = [...rw.aufgehoben, w].slice(-8);
        rw.neu = 'aufgehoben';
        geaendert = true;
      }
    }
    if (rw.planBis !== vorige && tageZwischen(rw.planBis || startWoche, vorige) >= 0) { rw.planBis = vorige; geaendert = true; }
  }
  return geaendert;
}

export function lade(jetzt = new Date(), { plan = null } = {}) {
  let roh = null;
  try { roh = ladeModul(MODUL, null); } catch (e) { roh = null; }
  const st = normalisiere(roh, jetzt);
  tagWechsel(st, jetzt);
  pruefeKarten(st, jetzt, { plan });
  return st;
}

// Im Budget bleiben: erst die verarbeiteten IDs halbieren, dann alte Lern-Merker, dann den Verlauf kuerzen
export function speichere(st) {
  const max = MODUL_BUDGET[MODUL] - 200;
  const laenge = () => JSON.stringify(st).length;
  let schutz = 0;
  while (laenge() > max && schutz++ < 60) {
    if (st.ids.length > 40) { st.ids = st.ids.slice(Math.ceil(st.ids.length / 2)); continue; }
    const ueb = Object.keys(st.lernen.ueb);
    if (ueb.length > 20) { for (const k of ueb.slice(0, ueb.length - 20)) delete st.lernen.ueb[k]; continue; }
    const mom = Object.keys(st.lernen.mom);
    if (mom.length > 20) { for (const k of mom.slice(0, mom.length - 20)) delete st.lernen.mom[k]; continue; }
    if (st.lernen.raetsel.length > 100) { st.lernen.raetsel = st.lernen.raetsel.slice(-100); continue; }
    if (st.verlauf.length > 10) { st.verlauf = st.verlauf.slice(0, st.verlauf.length - 5); continue; }
    if (st.aufstiege.length > 3) { st.aufstiege = st.aufstiege.slice(0, 3); continue; }
    break;
  }
  return speichereModul(MODUL, st);
}

export function zuenden(st) {
  if (st.rw.aktiv > 0 || st.rw.karten < 1) return false;
  st.rw.karten--;
  st.rw.aktiv = R.RUECKENWIND_EINHEITEN;
  st.rw.neu = null;
  return true;
}

export function gutschrift(st, menge, quelle) {
  const m = Math.max(0, Math.round(zahl(menge)));
  st.gesamt += m;
  st.heute.funken += m;
  if (QUELLEN.includes(quelle)) st.heute.quellen[quelle] += m;
  return m;
}

function aktiv(st) {
  st.rw.letzterTag = st.heute.tag;
}

// Partie- oder Lern-Einheit: Tagesbogen (vor Rueckenwind), dann Rueckenwind (Karte oder Funken-Wochenende, nie x4).
// weiter: Teil einer Einheit, die schon eine Karte verbraucht hat (weitere Karten einer Stapel-Sitzung): doppelt, ohne
// eine weitere Einheit zu verbrauchen
export function bucheEinheit(st, { quelle = 'partie', vor = 0, einheit = false, wochenende = false, woche = null, weiter = false } = {}) {
  const v = Math.max(0, zahl(vor));
  const r = R.endMenge({ vor: v, schonHeute: st.heute.bogen, wochenende, kartenAktiv: weiter ? 1 : st.rw.aktiv, einheit: einheit || weiter });
  st.heute.bogen += v;
  if (r.verbraucht && !weiter) st.rw.aktiv = Math.max(0, st.rw.aktiv - 1);
  if (wochenende && woche && v > 0 && !st.rw.gespielt.includes(woche)) st.rw.gespielt = [...st.rw.gespielt, woche].slice(-8);
  gutschrift(st, r.menge, quelle);
  return r;
}

// Klassen und Live-Daten der laufenden Partie in die Liste der eigenen Zuege (fuer rechnung.partieFunken).
// liveKlassen (aus partie:beendet, null fuer Bot-Zuege) und die gemerkten Live-Eintraege werden vereinigt; waehrend
// der Partie (Funkenlinie) reicht der Lauf allein.
export function eigeneZuege(liveKlassen, lauf) {
  const z = lauf && lauf.z ? lauf.z : {};
  const k = liste(liveKlassen);
  const plies = new Set();
  k.forEach((x, i) => { if (x) plies.add(i); });
  for (const p of Object.keys(z)) if (/^\d+$/.test(p)) plies.add(Number(p));
  const aus = [];
  for (const ply of [...plies].sort((a, b) => a - b)) {
    const e = Array.isArray(z[ply]) ? z[ply] : null;
    const flags = e ? ganz(e[3]) : 0;
    const klasse = k[ply] || (e && e[0] >= 0 ? KLASSEN[e[0]] : null) || null;
    aus.push({
      ply, klasse,
      gewinnVorher: e && Number.isFinite(e[1]) ? e[1] / 1000 : null,
      gewinnNachher: e && Number.isFinite(e[2]) ? e[2] / 1000 : null,
      trivial: (flags & 1) === 1, nachHilfe: (flags & 2) === 2,
      gewinnVorigerZug: e && Number.isFinite(e[4]) ? e[4] / 1000 : null,
      matt: e && Number.isFinite(e[5]) ? e[5] : null,
    });
  }
  return aus;
}

// Ein Live-Eintrag fuer die laufende Partie (zug:bewertet); bestehende Flags (nach Hilfe) bleiben
export function merkeZug(lauf, d) {
  if (!lauf || !d || !Number.isInteger(d.ply)) return false;
  const alt = Array.isArray(lauf.z[d.ply]) ? lauf.z[d.ply] : [];
  const k = KLASSEN.indexOf(d.klasse);
  const tausend = (x) => (typeof x === 'number' && Number.isFinite(x) ? Math.round(x * 1000) : null);
  const flags = (ganz(alt[3]) & 2) | (d.trivial === true ? 1 : 0);
  lauf.z[d.ply] = [k, tausend(d.gewinnVorher), tausend(d.gewinnNachher), flags, tausend(d.gewinnVorigerZug), Number.isFinite(alt[5]) ? alt[5] : null];
  return true;
}

export function merkeHilfe(lauf, ply) {
  if (!lauf || !Number.isInteger(ply)) return;
  const alt = Array.isArray(lauf.z[ply]) ? lauf.z[ply] : [-1, null, null, 0, null, null];
  alt[3] = ganz(alt[3]) | 2;
  lauf.z[ply] = alt;
}

export function merkeMatt(lauf, ply, matt) {
  if (!lauf || !Number.isInteger(ply) || ply < 0) return;
  if (!Array.isArray(lauf.z[ply])) lauf.z[ply] = [-1, null, null, 0, null, null];
  lauf.z[ply][5] = Number.isFinite(matt) && matt > 0 ? matt : null;
}

export function vergissAb(lauf, abPly) {
  if (!lauf) return;
  for (const k of Object.keys(lauf.z)) if (Number(k) >= abPly) delete lauf.z[k];
}

function sternBits(neueSterne) {
  const s = liste(neueSterne);
  return (s[0] === true ? 1 : 0) | (s[1] === true ? 2 : 0) | (s[2] === true ? 4 : 0);
}

// Partie-Funken einer beendeten Partie (partie:beendet). Partie-Funken gibt es fuer wertende Partien und
// Boss-Partien (die ersten BOSS_VERSUCHE am Tag); Uebungen, freie Partien, Spielhalle und Gaeste buchen nichts.
export function buchePartie(st, d, { lauf = null, jetzt = new Date(), wochenende = false, botName = 'den Bot', gegner = null } = {}) {
  if (!d || typeof d.partieId !== 'string' || st.ids.includes(d.partieId)) return null;
  st.ids = [...st.ids, d.partieId].slice(-IDS_MAX);
  const boss = d.modus === 'boss';
  if (d.wertet !== true && !boss) return null;
  tagWechsel(st, jetzt);
  aktiv(st);
  const t = ms(jetzt);
  const woche = wochenSchluessel(t);
  const g0 = st.gesamt;
  const l0 = L.levelVon(g0);
  let grund = null;
  if (boss) {
    st.heute.boss++;
    if (st.heute.boss > R.BOSS_VERSUCHE) grund = 'boss';
  }
  const eigene = ganz(d.eigeneZuege);
  const hilfe = ganz(d.hinweise) > 0 || ganz(d.zuruecknahmen) > 0;
  const pf = R.partieFunken({
    zuege: eigeneZuege(d.liveKlassen, lauf), ergebnis: d.ergebnis, eigeneZuege: eigene, hilfe, gegner, genauigkeit: null,
    faktor: lauf && Number.isFinite(lauf.fa) ? lauf.fa : 1, botName,
  });
  if (!grund && eigene < R.MIN_ZUEGE && pf.basis === 0) grund = 'kurz';
  const r = bucheEinheit(st, { quelle: 'partie', vor: grund === 'boss' ? 0 : pf.vorRueckenwind, einheit: true, wochenende, woche });
  // Meilensteine (Tabelle C): neue Sterne, erster Sieg gegen diesen Bot, erster Sieg gegen den Stockfisch
  const posten = d.wertet === true ? R.sternFunken(d.neueSterne, { botId: d.botId }) : [];
  let m = 0;
  for (const p of posten) m += gutschrift(st, p.menge, 'meilenstein');
  st.heute.partien++;
  const eintrag = {
    id: d.partieId, t, tag: st.heute.tag, bot: typeof d.botId === 'string' ? d.botId : '', erg: d.ergebnis || null,
    modus: d.modus || 'normal', f: r.menge + m, p: r.menge, m, ba: pf.basis, z: pf.zugwerte, th: pf.theorie, e: pf.ergebnis,
    v: pf.verwertung, lb: pf.lichtblicke.map((x) => x.text), fa: pf.faktor, fn: lauf && typeof lauf.fn === 'string' ? lauf.fn : null,
    rw: r.quelle, halb: r.halb, of: pf.offen, g: st.gesamt, lv: [l0, L.levelVon(st.gesamt)], s: d.wertet === true ? sternBits(d.neueSterne) : 0,
    ms: posten.map((p) => p.art), gr: grund, hilfe: pf.hilfe, nt: 0, lbg: false,
    lg: gegner && Number.isFinite(gegner.letzteGenauigkeit) ? gegner.letzteGenauigkeit : null,
  };
  st.verlauf = [eintrag, ...st.verlauf.filter((e) => e.id !== d.partieId)].slice(0, VERLAUF_MAX);
  if (st.lauf && st.lauf.id === d.laufId) st.lauf = null;
  const buchungen = [{ quelle: 'partie', menge: r.menge }];
  if (m) buchungen.push({ quelle: 'meilenstein', menge: m });
  return { eintrag, buchungen };
}

// Nachtrag nach der Spielanalyse (partie:analysiert, kann je Partie zweimal kommen): Stern 2 (braucht die Genauigkeit)
// und der Genauigkeits-Lichtblick (Remis und Niederlage). Nie weniger Funken, jede Pruefung nur einmal.
export function nachtragPartie(st, d, { jetzt = new Date() } = {}) {
  if (!d || typeof d.partieId !== 'string') return null;
  const e = st.verlauf.find((x) => x.id === d.partieId);
  if (!e) return null;
  tagWechsel(st, jetzt);
  const buchungen = [];
  // neue Sterne (nur wertende Partien)
  if (d.wertet === true) {
    const bits = sternBits(d.neueSterne);
    const neu = bits & ~e.s;
    if (neu) {
      const posten = R.sternFunken([!!(neu & 1), !!(neu & 2), !!(neu & 4)], { botId: d.botId || e.bot });
      let m = 0;
      for (const p of posten) m += gutschrift(st, p.menge, 'meilenstein');
      e.s |= neu;
      e.m += m;
      e.f += m;
      e.ms = [...(e.ms || []), ...posten.map((p) => p.art)];
      if (m) buchungen.push({ quelle: 'meilenstein', menge: m });
    }
  }
  // Genauigkeits-Lichtblick: die Genauigkeit gibt es erst nach der Analyse
  const genau = d.partie && Number.isFinite(d.partie.genauigkeit) ? d.partie.genauigkeit : null;
  if (!e.lbg && genau != null && (e.erg === 'remis' || e.erg === 'niederlage')) {
    e.lbg = true;
    const lb = R.lichtblicke({ ergebnis: e.erg, eigeneZuege: 0, genauigkeit: genau, gegner: { partien: 0, letzteGenauigkeit: e.lg } });
    const g = lb.find((x) => x.art === 'genau');
    if (g && e.lb.length < R.LICHTBLICK_MAX && e.gr !== 'boss') {
      const rwf = e.rw ? 2 : 1;
      const vorDelta = R.LICHTBLICK_FUNKEN * e.fa;
      let menge;
      if (!e.halb && st.heute.tag === e.tag && st.heute.bogen + vorDelta <= R.TAGESBOGEN) {
        // genau wie eine Rechnung mit dem Lichtblick von Anfang an (ein Mal gerundet)
        menge = Math.max(0, R.runde((e.ba + R.LICHTBLICK_FUNKEN) * e.fa * rwf) - R.runde(e.ba * e.fa * rwf));
        st.heute.bogen += vorDelta;
      } else {
        const b = R.bogen({ vor: vorDelta, schonHeute: st.heute.bogen });
        st.heute.bogen += vorDelta;
        menge = R.runde(b.nach * rwf);
      }
      gutschrift(st, menge, 'partie');
      e.ba += R.LICHTBLICK_FUNKEN;
      e.lb = [...e.lb, g.text];
      e.p += menge;
      e.f += menge;
      e.nt += menge;
      if (menge) buchungen.push({ quelle: 'partie', menge });
    }
  }
  if (!buchungen.length) return { eintrag: e, buchungen };
  e.g = st.gesamt;
  e.lv = [e.lv[0], Math.max(e.lv[1], L.levelVon(st.gesamt))];
  return { eintrag: e, buchungen };
}

// ---------- Tabelle B: Lern-Funken (ohne Faktor, mal Rueckenwind; Einheiten verbrauchen eine Karte) ----------
function lernBuchung(st, vor, { einheit, wochenende, woche, weiter = false }) {
  if (vor <= 0) return [];
  aktiv(st);
  const r = bucheEinheit(st, { quelle: 'lernen', vor, einheit, wochenende, woche, weiter });
  return r.menge ? [{ quelle: 'lernen', menge: r.menge, rw: r.quelle }] : [];
}

// "Ab hier nochmal" (uebung:ergebnis): 15 getroffen, 5 nicht getroffen, 2 Versuche je Stellung; eine Einheit
export function lernUebung(st, d, ctx = {}) {
  if (!d || typeof d.partieId !== 'string' || !Number.isInteger(d.ply)) return [];
  const k = `${d.partieId.slice(0, 24)}:${d.ply}`;
  const n = ganz(st.lernen.ueb[k]);
  if (n >= R.LERN.uebungVersuche) return [];
  st.lernen.ueb[k] = n + 1;
  return lernBuchung(st, R.uebungFunken(d.getroffen === true), { ...ctx, einheit: true });
}

// Schluesselmoment in der Analyse angesehen (analyse:gesehen mit moment): 5, hoechstens 3 je Partie
export function lernMoment(st, d, ctx = {}) {
  if (!d || !d.moment || typeof d.partieId !== 'string') return [];
  const k = d.partieId.slice(0, 24);
  const gesehen = liste(st.lernen.mom[k]);
  if (gesehen.length >= R.LERN.momenteMax || gesehen.includes(d.ply)) return [];
  st.lernen.mom[k] = [...gesehen, d.ply];
  return lernBuchung(st, R.LERN.moment, { ...ctx, einheit: false });
}

// Faellige Karteikarte richtig (training:geloest): 10 im 1., 4 im 2. Versuch, hoechstens 8 am Tag. Zwei Felder im
// Ereignis sind freiwillig (das Kartei-Paket gibt es noch nicht, Vertrag in ARCHITEKTUR.md): faellig === false bringt
// nichts (nur faellige Karten zaehlen), sitzung (ID der Stapel-Sitzung) macht die Sitzung zu EINER Einheit: die erste
// Karte mit Funken verbraucht eine Rueckenwind-Einheit, alle weiteren Karten derselben Sitzung zaehlen dann auch doppelt.
// Ohne sitzung zaehlt jede Karte einfach und verbraucht nichts.
export function lernKarte(st, d, ctx = {}) {
  if (!d || d.richtig !== true || d.faellig === false) return [];
  const f = R.kartenFunken({ richtig: true, versuch: d.versuch });
  if (!f) return [];
  if (st.lernen.karten.tag !== st.heute.tag) st.lernen.karten = { tag: st.heute.tag, n: 0 };
  if (st.lernen.karten.n >= R.LERN.kartenTag) return [];
  st.lernen.karten.n++;
  const sid = typeof d.sitzung === 'string' && d.sitzung ? d.sitzung.slice(0, 40) : null;
  if (!sid) return lernBuchung(st, f, { ...ctx, einheit: false });
  const s = st.lernen.sitzung;
  if (s && s.id === sid) return lernBuchung(st, f, { ...ctx, einheit: false, weiter: s.rw });
  const b = lernBuchung(st, f, { ...ctx, einheit: true });
  st.lernen.sitzung = { id: sid, rw: b.length > 0 && b[0].rw === 'karte' };
  return b;
}

// Lektion (lektion:beendet): 40 beim ersten Abschluss, Ring "Sicher" +20, "Gemeistert" +40, je einmal; eine Einheit
export function lernLektion(st, d, ctx = {}) {
  if (!d || typeof d.id !== 'string' || !d.id) return [];
  const id = d.id.slice(0, 40);
  const r = R.lektionFunken({ alt: st.lernen.lek[id] || '', ringe: d.ringe });
  if (!r.funken) return [];
  st.lernen.lek[id] = r.neu;
  return lernBuchung(st, r.funken, { ...ctx, einheit: true });
}

// Raetsel (raetsel:geloest { id, richtig, versuch, quelle, wertung, blick? }): je Raetsel einmal (das erste Ergebnis
// zaehlt); Treppenlauf-Raetsel buchen nie einzeln. Die Stufe haengt am Abstand Raetselwertung minus Raetsel-Blick; das
// Feld blick ist freiwillig: ohne blick (oder ohne wertung) zaehlt das Raetsel wie auf Augenhoehe (Abstand 0: 8 Funken
// im 1. Versuch), damit ein Raetsel-Paket, das sich an die Tabelle in ARCHITEKTUR.md haelt, nie leer ausgeht
export function lernRaetsel(st, d, ctx = {}) {
  if (!d || typeof d.id !== 'string' || !d.id || d.quelle === 'treppe') return [];
  const id = String(d.id).slice(0, 40);
  if (st.lernen.raetsel.includes(id)) return [];
  st.lernen.raetsel = [...st.lernen.raetsel, id].slice(-400);
  const f = R.raetselFunken({ richtig: d.richtig === true, versuch: ganz(d.versuch, 1), wertung: d.wertung,
    blick: Number.isFinite(d.blick) ? d.blick : null });
  return lernBuchung(st, f, { ...ctx, einheit: false });
}

// Ein Wort: das erste Ergebnis je Tag zaehlt, richtig gibt Lern-Funken ohne Kartenverbrauch.
export function lernWort(st, d, ctx = {}) {
  if (!d || !istSchluessel(d.tag) || typeof d.richtig !== 'boolean') return [];
  const tage = liste(st.lernen.wort);
  if (tage.includes(d.tag)) return [];
  st.lernen.wort = [...tage, d.tag].slice(-60);
  if (!d.richtig) return [];
  const b = lernBuchung(st, R.LERN.wort, { ...ctx, einheit: false });
  st.heute.wort = ganz(st.heute.wort) + b.reduce((n, x) => n + x.menge, 0);
  return b;
}

// ---------- Tabelle C ----------
export function siegel(st, d) {
  if (!d || typeof d.bossId !== 'string') return [];
  const k = `${d.bossId}:${d.stufe}`;
  const f = R.siegelFunken(d.stufe);
  if (!f || st.lernen.siegel.includes(k)) return [];
  st.lernen.siegel = [...st.lernen.siegel, k];
  return [{ quelle: 'meilenstein', menge: gutschrift(st, f, 'meilenstein') }];
}

// Neuer Tafel-Rekord (nur Allzeit, Platz 1) oder neue Bestmarke: 25, hoechstens einer je Partie
export function rekord(st, d, partieId) {
  if (!d || typeof partieId !== 'string' || !partieId) return [];
  if (d.fenster != null && d.fenster !== 'allzeit') return [];
  if (d.tafel != null && d.platz !== 1) return [];
  const k = partieId.slice(0, 24);
  if (st.lernen.rekord.includes(k)) return [];
  st.lernen.rekord = [...st.lernen.rekord, k].slice(-40);
  return [{ quelle: 'meilenstein', menge: gutschrift(st, R.MEILENSTEIN.rekord, 'meilenstein') }];
}

// Arena-Wertung aus dem Paket Wertung/Liga (Ereignis liga:geaendert, sobald es das gibt): wertung als Zahl oder
// { wert }. Sie ersetzt fuer den Herausforderungs-Faktor den Leistungswert aus den Partien.
export function setzeLage(st, d, jetzt = new Date()) {
  const w = d && (typeof d.wertung === 'number' ? d.wertung : d.wertung && typeof d.wertung === 'object' ? d.wertung.wert : null);
  if (!Number.isFinite(w) || w < 0 || w > 4000) return false;
  st.lage = { wert: Math.round(w), t: ms(jetzt) };
  return true;
}

export function lageVon(st) {
  return st && st.lage && Number.isFinite(st.lage.wert) ? st.lage.wert : null;
}

// Nach den Buchungen: Level nachziehen (sinkt nie), Stuecke freischalten, Aufstieg merken
export function schliesseLevel(st, vorher, jetzt = new Date()) {
  const nachher = Math.max(L.levelVon(st.gesamt), st.level);
  st.level = nachher;
  if (nachher <= vorher) return null;
  const neu = [];
  const frei = new Set(st.freigeschaltet);
  for (let l = vorher + 1; l <= nachher; l++) {
    for (const s of L.belohnungen(l)) {
      neu.push({ ...s, level: l });
      frei.add(s.id);
    }
  }
  st.freigeschaltet = [...frei];
  let titel = null;
  for (let l = vorher + 1; l <= nachher; l++) if (L.istTitelLevel(l)) titel = L.titelVon(l);
  st.aufstiege = [{ level: nachher, von: vorher, t: ms(jetzt) }, ...st.aufstiege].slice(0, AUFSTIEGE_MAX);
  st.gruss = true;
  return { vorher, nachher, neu, titel };
}
