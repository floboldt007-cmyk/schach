// Speicher des Pakets punkte (Modul-Speicher "punkte", Budget MODUL_BUDGET.punkte = 40.000 Zeichen). Rein bis auf den
// Modul-Speicher (storage.js); die Zeit kommt als Parameter. Kein Math.random (Fairness-Regel 1).
//
// Form (Rechenstand STAND = 1; neue Felder sind freiwillig, aeltere Staende laden):
//   { stand: 1,
//     tafeln: { [tafelId]: Tafel (tafel.js) },               eigene Eintraege, Chronik, "so nah wie noch nie"
//     rekorde: [{ tafel, w, vorher, t, id, n?, stand }],     Rekordbuch (neueste zuerst, hoechstens 30), n = Nachweis
//     freunde: [{ id, name, eintraege: [{ tafel, w, t, tag, f, z, e, pruef, n }] }]   hoechstens 12 Freunde, 24 Eintraege
//     letzte: [Ergebnis],                                    Abrechnung der letzten Partien (hoechstens 12)
//     ids: [partieId],                                       verarbeitete Partien (Ringpuffer, hoechstens 300)
//     neu: [partieId],                                       Zeilen mit Punkt "neu", bis sie angesehen wurden
//     offen: [{ id, laufId, nachHilfe }],                    beendet, Analyse steht noch aus (hoechstens 6)
//     lauf: { id, hilfe, nachHilfe: [ply] } | null,          laufende Partie: Zuege nach Hinweis oder Zuruecknehmen
//     level: Zahl | null,                                    letztes Level aus funken:geaendert (Spielerkarte)
//     umzug: boolean }                                       vorhandene Analysen einmal eingetragen (SPIELKONZEPT 6.3)
//
// Ergebnis einer Partie (Abrechnung, Ereignis punkte:geaendert):
//   { id, t, w, posten: { zugpunkte, theorie, ergebnis, verwertung, combo, weste, offen, entschieden, par, maxSerie },
//     tafel (Id oder null), grund (ohne Tafel: 'hilfe' | 'frei' | 'spiel' | 'gast' | 'stellung'), platz, platzVorher,
//     aufstieg, vorher, rekord, erster, platz1, ueberholt: [Name], wochenPlatz, sichtbar, bestwert,
//     fast: { prozent, anteil, wo } | null, post: { name, w } | null, satzBot: botId | null }
//   fast: Kandidat fuer "So nah wie noch nie"; festgeschrieben wird er erst, wenn die Abrechnung ihn zeigt (merkeFast).
//   post: die beste ueberholte Freundin (fuer die Ueberhol-Post, 3.13; nie automatisch). satzBot: der Bot, dessen Lauf
//   vorher Platz 1 war (Platz 1 einer Tafel: sein Satz in der Feier, 3.13).
//
// Vorlaeufige Bot-Laeufe (3.13 "Schon in S1 nicht leer"): daten/punkte/bot-laeufe.json (werkzeuge/nachbar-laeufe.mjs),
// index.js laedt die Datei nach app:bereit und reicht sie mit setzeBotLaeufe herein. Sie stehen als Gaeste (art 'bot')
// auf den Tafeln, nie im Modul-Speicher; nur mit demselben Rechenstand wie die Formel (sonst mischen sich Regeln).
//
// API:
//   STAND, MODUL, lade() -> Stand, speichere(st) -> { ok, ... } (duennt selbst aus), standard()
//   bewerte(st, d, { jetzt, nachHilfe, bossElo, tiefe, nachweis }) -> Ergebnis | null   aus partie:analysiert
//       ({ partieId, botId, modus, wertet, partie, review }); idempotent (zweites Mal: das gespeicherte Ergebnis)
//   ergebnisVon(st, partieId) -> Ergebnis | null
//   gaeste(st, tafelId) -> [Gast]   Freunde-Eintraege und Bot-Laeufe dieser Tafel (Gast-Zeilen, tafel.js)
//   merkeFast(st, ergebnis) -> boolean   "So nah wie noch nie" festschreiben (erst beim Zeigen; false: schon vergeben)
//   pruefeBotLaeufe(json) -> [Fehlertext]   Inhalt der Datei (art 'bot-laeufe', format 1)
//   setzeBotLaeufe(json | null) -> Anzahl   Laeufe uebernehmen (null: keine); botLaeufe(tafelId) -> [Gast]
//   fuegeFreundHinzu(st, { name, tafel, w, t, tag, f, z, e, pruef, n }) -> { ok, grund }   hoechstens 12 Freunde und
//       24 Eintraege (grund 'voll' bzw. 'eintraege'); ein besserer Code ersetzt den alten Eintrag auch bei vollem Speicher
//   entferneFreund(st, id)
//   merkeLauf / merkeHilfe / vergissAb / beende: Zuege nach Hilfe der laufenden Partie
//   tafelStatistik(st) -> { rekorde, platz1, tafeln, beste, partien }
import { ladeModul, speichereModul, MODUL_BUDGET, wertet, eigeneZuege } from '../../storage.js';
import { tagSchluessel, wochenSchluessel } from '../../tag.js';
import * as F from './formel.js';
import * as T from './tafel.js';

export const STAND = 1;
export const MODUL = 'punkte';
export const IDS_MAX = 300;
export const LETZTE_MAX = 12;
export const REKORDE_MAX = 30;
export const FREUNDE_MAX = 12;
export const FREUND_EINTRAEGE_MAX = 24;
export const BOT_LAEUFE_MAX = 4;   // je Tafel und Nachbar hoechstens: bester und mittlerer Lauf (Reserve fuer S3)
const NEU_MAX = 40;
const OFFEN_MAX = 6;
const PLY_MAX = 600;

export function standard() {
  return { stand: STAND, tafeln: {}, rekorde: [], freunde: [], letzte: [], ids: [], neu: [], offen: [], lauf: null, level: null, umzug: false };
}

const zahl = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : null);
const liste = (x) => (Array.isArray(x) ? x : []);
const ms = (t) => (t instanceof Date ? t.getTime() : zahl(t) ?? Date.now());
const textId = (x, max = 40) => typeof x === 'string' && x.length > 0 && x.length <= max;
const plies = (l) => liste(l).filter((p) => Number.isInteger(p) && p >= 0 && p < PLY_MAX).slice(0, PLY_MAX);

function pruefeRekord(r) {
  if (!r || typeof r !== 'object' || !T.istTafelId(r.tafel) || zahl(r.w) == null || zahl(r.t) == null || !textId(r.id)) return null;
  const aus = { tafel: r.tafel, w: Math.round(r.w), vorher: zahl(r.vorher), t: r.t, id: r.id, stand: Number.isInteger(r.stand) ? r.stand : 1 };
  if (typeof r.n === 'string' && /^[0-9A-Z]{8,1400}$/.test(r.n)) aus.n = r.n;
  return aus;
}

function pruefeFreund(f) {
  if (!f || typeof f !== 'object' || !textId(f.id, 16) || typeof f.name !== 'string') return null;
  const eintraege = liste(f.eintraege).filter((e) => e && T.istTafelId(e.tafel) && zahl(e.w) != null && e.w >= 0).map((e) => ({
    tafel: e.tafel, w: Math.round(e.w), t: zahl(e.t) ?? 0, tag: typeof e.tag === 'string' ? e.tag.slice(0, 10) : '', f: e.f === 'b' ? 'b' : 'w',
    z: Number.isInteger(e.z) ? e.z : 0, e: ['s', 'r', 'n'].includes(e.e) ? e.e : 'n',
    pruef: ['angabe', 'nachgerechnet', 'bot'].includes(e.pruef) ? e.pruef : 'angabe', n: typeof e.n === 'string' ? e.n.slice(0, 1400) : '',
  }));
  return { id: f.id, name: f.name.slice(0, 24), eintraege };
}

export function lade() {
  const roh = ladeModul(MODUL, standard());
  const st = standard();
  if (!roh || typeof roh !== 'object') return st;
  const tafeln = roh.tafeln && typeof roh.tafeln === 'object' ? roh.tafeln : {};
  for (const [id, t] of Object.entries(tafeln)) if (T.istTafelId(id)) st.tafeln[id] = T.pruefeTafel(t, id);
  st.rekorde = liste(roh.rekorde).map(pruefeRekord).filter(Boolean).slice(0, REKORDE_MAX);
  st.freunde = liste(roh.freunde).map(pruefeFreund).filter(Boolean).slice(0, FREUNDE_MAX);
  st.letzte = liste(roh.letzte).filter((e) => e && typeof e === 'object' && textId(e.id) && zahl(e.w) != null).slice(0, LETZTE_MAX);
  st.ids = liste(roh.ids).filter((x) => textId(x)).slice(-IDS_MAX);
  st.neu = liste(roh.neu).filter((x) => textId(x)).slice(-NEU_MAX);
  st.offen = liste(roh.offen).filter((x) => x && textId(x.id) && textId(x.laufId)).map((x) => ({ id: x.id, laufId: x.laufId, nachHilfe: plies(x.nachHilfe) }))
    .slice(-OFFEN_MAX);
  const l = roh.lauf;
  st.lauf = l && textId(l.id) ? { id: l.id, hilfe: l.hilfe === true, nachHilfe: plies(l.nachHilfe) } : null;
  st.level = Number.isInteger(roh.level) && roh.level > 0 ? roh.level : null;
  st.umzug = roh.umzug === true;
  return st;
}

// Budget: zuerst die Abrechnungen alter Partien, dann alte Rekorde und Nachweise, verarbeitete IDs, Chronik-Monate,
// Freunde-Eintraege; Tafel-Eintraege (die Leistungen selbst) zuletzt
export function speichere(st) {
  const max = MODUL_BUDGET[MODUL] - 50;
  const laenge = () => JSON.stringify(st).length;
  const schritte = [
    () => { if (st.letzte.length > 3) { st.letzte = st.letzte.slice(0, 3); return true; } return false; },
    () => { if (st.rekorde.length > 10) { st.rekorde = st.rekorde.slice(0, 10); return true; } return false; },
    () => { const r = st.rekorde.find((x, i) => i > 2 && x.n); if (r) { delete r.n; return true; } return false; },
    () => { if (st.ids.length > 100) { st.ids = st.ids.slice(-100); return true; } return false; },
    () => { if (st.neu.length > 10) { st.neu = st.neu.slice(-10); return true; } return false; },
    () => {
      for (const t of Object.values(st.tafeln)) if (t.chronik.m.length > 3) { t.chronik.m = t.chronik.m.slice(0, 3); return true; }
      return false;
    },
    () => {
      const f = [...st.freunde].reverse().find((x) => x.eintraege.length > 1);
      if (f) { f.eintraege = f.eintraege.slice(0, -1); return true; }
      return false;
    },
    () => {
      for (const t of Object.values(st.tafeln)) {
        const ohne = t.eintraege.slice(1).find((e) => e.n);
        if (ohne) { delete ohne.n; return true; }
      }
      return false;
    },
    () => {
      // aeusserster Fall: die schwaechsten Eintraege der vollsten Tafel (nie den Bestwert)
      const voll = Object.values(st.tafeln).sort((a, b) => b.eintraege.length - a.eintraege.length)[0];
      if (voll && voll.eintraege.length > 1) { voll.eintraege = voll.eintraege.slice(0, -1); return true; }
      return false;
    },
  ];
  for (const s of schritte) {
    while (laenge() > max) if (!s()) break;
    if (laenge() <= max) break;
  }
  return speichereModul(MODUL, st);
}

// ---------- laufende Partie: Zuege nach Hinweis oder Zuruecknehmen (0 Punkte, kein Platz) ----------
export function merkeLauf(st, laufId, { fortgesetzt = false } = {}) {
  if (!textId(laufId)) return;
  if (st.lauf && st.lauf.id === laufId && fortgesetzt) return;
  if (!st.lauf || st.lauf.id !== laufId) st.lauf = { id: laufId, hilfe: false, nachHilfe: [] };
}
export function merkeHilfe(st, laufId) {
  if (st.lauf && st.lauf.id === laufId) st.lauf.hilfe = true;
}
// eigener Zug: kam vorher ein Hinweis oder ein Zuruecknehmen, zaehlt dieser Zug nicht
export function merkeZug(st, laufId, ply) {
  if (!st.lauf || st.lauf.id !== laufId || !st.lauf.hilfe || !Number.isInteger(ply)) return;
  st.lauf.nachHilfe = plies([...st.lauf.nachHilfe.filter((p) => p !== ply), ply]);
  st.lauf.hilfe = false;
}
export function vergissAb(st, laufId, bisPly) {
  if (!st.lauf || st.lauf.id !== laufId) return;
  if (Number.isInteger(bisPly)) st.lauf.nachHilfe = st.lauf.nachHilfe.filter((p) => p < bisPly);
  st.lauf.hilfe = true;
}
export function beende(st, laufId, partieId) {
  if (!textId(partieId)) return;
  const nach = st.lauf && st.lauf.id === laufId ? st.lauf.nachHilfe : [];
  st.offen = [...st.offen.filter((o) => o.id !== partieId), { id: partieId, laufId: String(laufId || '-'), nachHilfe: nach }].slice(-OFFEN_MAX);
  if (st.lauf && st.lauf.id === laufId) st.lauf = null;
}

// ---------- Bewerten ----------
export function ergebnisVon(st, partieId) {
  return st.letzte.find((e) => e.id === partieId) || null;
}

// ---------- Vorlaeufige Bot-Laeufe (Gaeste aus daten/punkte/bot-laeufe.json) ----------
let laeufe = new Map();   // tafelId -> [Gast]
const BOT_RE = /^[a-z][a-z0-9-]{0,31}$/;
const LAUF_ARTEN = ['best', 'mittel'];

export function pruefeBotLaeufe(json) {
  const fehler = [];
  const t = json && json.tafeln;
  if (!t || typeof t !== 'object' || Array.isArray(t)) return ['tafeln fehlt'];
  for (const [id, l] of Object.entries(t)) {
    if (!T.istTafelId(id)) { fehler.push('Tafel ' + id + ': ungueltige ID'); continue; }
    if (!Array.isArray(l) || l.length > 2 * BOT_LAEUFE_MAX) { fehler.push('Tafel ' + id + ': keine Liste'); continue; }
    l.forEach((x, i) => {
      if (!x || typeof x !== 'object' || !BOT_RE.test(String(x.bot)) || !LAUF_ARTEN.includes(x.lauf) || zahl(x.w) == null || x.w < 0
        || 'bot:' + x.bot === id) {
        fehler.push(`Tafel ${id}, Lauf ${i}: ungueltig`);
      }
    });
  }
  return fehler;
}

export function setzeBotLaeufe(json) {
  laeufe = new Map();
  if (!json || pruefeBotLaeufe(json).length) return 0;
  let n = 0;
  for (const [id, l] of Object.entries(json.tafeln)) {
    laeufe.set(id, l.map((x) => ({
      id: `b:${x.bot}:${x.lauf}`, art: 'bot', bot: x.bot, lauf: x.lauf, w: Math.round(x.w), t: 0, pruef: null, vorlaeufig: true,
      f: x.f === 'b' ? 'b' : 'w', e: ['s', 'r', 'n'].includes(x.e) ? x.e : null, z: Number.isInteger(x.z) ? x.z : null, g: zahl(x.g),
    })));
    n += l.length;
  }
  return n;
}

export function botLaeufe(tafelId) {
  return (laeufe.get(tafelId) || []).map((x) => ({ ...x }));
}

// name: wie der Gast heisst (Freunde aus dem Code, Bots ueber botName, standardmaessig die ID)
let botName = (id) => id;
export function setzeBotNamen(fn) {
  botName = typeof fn === 'function' ? fn : (id) => id;
}

export function gaeste(st, tafelId) {
  const aus = [];
  for (const f of st.freunde) {
    f.eintraege.forEach((e, i) => {
      if (e.tafel === tafelId) aus.push({ id: `f:${f.id}:${i}`, name: f.name || 'Freund', art: 'freund', w: e.w, t: e.t, pruef: e.pruef, freund: f.id });
    });
  }
  for (const b of botLaeufe(tafelId)) aus.push({ ...b, name: String(botName(b.bot) || b.bot) });
  return aus;
}

// "So nah wie noch nie" erst festschreiben, wenn die Abrechnung den Satz zeigt (sonst verbraucht ein ungesehener
// Satz, z. B. beim Umzug oder beim Nachholen in der Arena, den Moment der Woche)
export function merkeFast(st, e) {
  if (!e || !e.fast || !e.tafel || !st.tafeln[e.tafel]) return false;
  return T.merkeFast(st.tafeln[e.tafel], e.fast, { id: e.id });
}

// ohne Tafel: warum (Abrechnung sagt es ehrlich)
export function grundOhneTafel(d, p, hilfe) {
  const modus = (p && p.modus) || d.modus || 'normal';
  if (modus === 'uebung') return 'uebung';
  if (modus === 'frei' || modus === 'spiel') return modus;
  if (modus === 'boss') return hilfe ? 'hilfe' : (p && p.boss ? null : 'gast');
  if (hilfe) return 'hilfe';
  if (p && typeof p.startFen === 'string' && p.startFen && !wertet({ modus: 'normal', startFen: p.startFen })) return 'stellung';
  if (!wertet(p)) return 'gast';
  return null;
}

// Ply mit dem groessten Ausschlag (groesster Verlust einer Seite): dorthin springt eine Tafel-Zeile in der Analyse
function groessterAusschlag(review) {
  let best = null;
  let max = -1;
  liste(review && review.zuege).forEach((z, i) => {
    const v = z && zahl(z.gewinnVorher) != null && zahl(z.gewinnNachher) != null ? Math.abs(z.gewinnVorher - z.gewinnNachher) : null;
    if (v != null && v > max + 1e-9) { max = v; best = Number.isInteger(z.ply) ? z.ply : i; }
  });
  return best;
}

const ERG_KURZ = { sieg: 's', remis: 'r', niederlage: 'n' };

export function bewerte(st, d, { jetzt = new Date(), nachHilfe = null, bossElo = null, tiefe = null, nachweis = null } = {}) {
  if (!d || !textId(d.partieId)) return null;
  const schon = ergebnisVon(st, d.partieId);
  if (st.ids.includes(d.partieId)) return schon;
  const p = d.partie && typeof d.partie === 'object' ? d.partie : null;
  const review = d.review && typeof d.review === 'object' ? d.review : null;
  if (!p || !review || !Array.isArray(review.zuege)) return null;
  const modus = p.modus || d.modus || 'normal';
  if (modus === 'uebung') return null;
  const t = ms(jetzt);
  const farbe = p.spielerFarbe === 'b' ? 'b' : 'w';
  const offen = st.offen.find((o) => o.id === d.partieId);
  const hilfePlies = Array.isArray(nachHilfe) ? nachHilfe : offen ? offen.nachHilfe : [];
  const hilfe = (zahl(p.hinweise) || 0) > 0 || (zahl(p.zuruecknahmen) || 0) > 0;
  const zuege = F.zuegeAusReview(review, farbe, { nachHilfe: hilfePlies });
  const n = eigeneZuege(p);
  const r = F.tafelwert({ zuege, ergebnis: p.ergebnis, eigeneZuege: n, hilfe });
  const grund = grundOhneTafel(d, p, hilfe);
  const tafelId = grund ? null : T.tafelId({ botId: p.botId, boss: modus === 'boss' ? p.boss : null });
  const datumT = Date.parse(p.datum);
  const eintragT = Number.isFinite(datumT) ? datumT : t;
  const g = review.genauigkeit && zahl(review.genauigkeit[farbe]) != null ? review.genauigkeit[farbe] : zahl(p.genauigkeit);
  const ergebnis = {
    id: d.partieId, t, w: r.wert, stand: STAND,
    posten: { zugpunkte: r.zugpunkte, theorie: r.theorie, ergebnis: r.ergebnis, verwertung: r.verwertung, combo: r.combo, weste: r.weste,
      offen: r.offen, entschieden: r.entschieden, par: r.par, maxSerie: r.maxSerie, eigeneZuege: n, kurz: n < F.MIN_ZUEGE },
    erg: p.ergebnis || null, bot: p.botId || null, tafel: tafelId, grund: grund || (tafelId ? null : 'gast'),
    platz: null, platzVorher: null, aufstieg: 0, vorher: null, rekord: false, erster: false, platz1: false, ueberholt: [],
    wochenPlatz: null, sichtbar: false, bestwert: null, fast: null, post: null, satzBot: null,
  };
  if (tafelId) {
    const tafel = st.tafeln[tafelId] || T.neueTafel(tafelId);
    const e = {
      id: d.partieId, w: r.wert, t: eintragT, tag: tagSchluessel(eintragT), wo: wochenSchluessel(eintragT), mo: tagSchluessel(eintragT).slice(0, 7),
      f: farbe, z: n, e: ERG_KURZ[p.ergebnis] || 'n', g: g == null ? null : Math.round(g * 10) / 10,
      st: zahl(bossElo), m: groessterAusschlag(review),
    };
    if (typeof nachweis === 'string' && nachweis) e.n = nachweis;
    const gs = gaeste(st, tafelId);
    const neu = T.eintragen(tafel, e, { jetzt: t, gaeste: gs });
    if (neu) {
      const res = neu.ergebnis;
      Object.assign(ergebnis, {
        platz: res.platz, platzVorher: res.platzVorher, aufstieg: res.aufstieg, vorher: res.vorher, rekord: res.rekord, erster: res.erster,
        platz1: res.platz1, ueberholt: [...new Set(res.ueberholt.sort(T.vergleiche).map((x) => String(x.name || 'Gast')))].slice(0, 3),
        wochenPlatz: res.wochenPlatz, sichtbar: res.sichtbar, bestwert: res.bestwert,
      });
      const freund = res.ueberholt.filter((x) => x.art === 'freund').sort(T.vergleiche)[0];
      if (freund) ergebnis.post = { name: String(freund.name || 'Freund').slice(0, 24), w: Math.round(freund.w) };
      // Platz 1: der Bot, der vorher vorn stand, sagt etwas (3.13); beim ersten Eintrag ist das der beste Gast
      const vorn = !res.platz1 ? null : (res.erster ? gs.slice().sort(T.vergleiche)[0] : res.ueberholt.slice().sort(T.vergleiche)[0]);
      if (vorn && vorn.art === 'bot' && BOT_RE.test(String(vorn.bot))) ergebnis.satzBot = vorn.bot;
      const eNeu = neu.tafel.eintraege.find((x) => x.id === d.partieId);
      // nur ein Kandidat: festgeschrieben wird "So nah" erst, wenn die Abrechnung ihn zeigt (merkeFast)
      if (!res.rekord && !res.erster) ergebnis.fast = T.fastPruefen(neu.tafel, eNeu, { vorher: res.vorher, jetzt: t });
      st.tafeln[tafelId] = T.duenneAus(neu.tafel, t);
      if (res.rekord) {
        st.rekorde = [{ tafel: tafelId, w: r.wert, vorher: res.vorher, t: eintragT, id: d.partieId, stand: STAND, ...(e.n ? { n: e.n } : {}) },
          ...st.rekorde].slice(0, REKORDE_MAX);
      }
      if (res.sichtbar || res.wochenPlatz != null) st.neu = [...st.neu.filter((x) => x !== d.partieId), d.partieId].slice(-NEU_MAX);
    }
  }
  st.letzte = [ergebnis, ...st.letzte.filter((x) => x.id !== d.partieId)].slice(0, LETZTE_MAX);
  st.ids = [...st.ids, d.partieId].slice(-IDS_MAX);
  st.offen = st.offen.filter((o) => o.id !== d.partieId);
  return ergebnis;
}

// ---------- Freunde ----------
export function fuegeFreundHinzu(st, { name = '', tafel, w, t = 0, tag = '', f = 'w', z = 0, e = 'n', pruef = 'nachgerechnet', n = '' } = {}) {
  if (!T.istTafelId(tafel) || zahl(w) == null || w < 0) return { ok: false, grund: 'daten' };
  const nm = String(name || '').trim().slice(0, 24) || 'Freund';
  const gesamt = st.freunde.reduce((s, x) => s + x.eintraege.length, 0);
  let freund = st.freunde.find((x) => x.name.toLowerCase() === nm.toLowerCase());
  if (!freund) {
    if (st.freunde.length >= FREUNDE_MAX) return { ok: false, grund: 'voll' };
    if (gesamt >= FREUND_EINTRAEGE_MAX) return { ok: false, grund: 'eintraege' };
    let nr = st.freunde.length + 1;
    while (st.freunde.some((x) => x.id === 'f' + nr)) nr++;
    freund = { id: 'f' + nr, name: nm, eintraege: [] };
    st.freunde.push(freund);
  }
  if (freund.eintraege.some((x) => x.n && x.n === n)) return { ok: false, grund: 'doppelt', freund: freund.id };
  // je Tafel zaehlt der beste Code eines Freundes (Gaeste-Zeilen bleiben uebersichtlich); ein besserer Code ersetzt den
  // alten Eintrag, braucht also keinen neuen Platz
  const alt = freund.eintraege.find((x) => x.tafel === tafel);
  if (!alt && gesamt >= FREUND_EINTRAEGE_MAX) return { ok: false, grund: 'eintraege' };
  const neu = { tafel, w: Math.round(w), t: zahl(t) ?? 0, tag: String(tag || '').slice(0, 10), f: f === 'b' ? 'b' : 'w', z: Number.isInteger(z) ? z : 0,
    e: ['s', 'r', 'n'].includes(e) ? e : 'n', pruef, n: String(n || '').slice(0, 1400) };
  if (alt && alt.w >= neu.w) return { ok: true, freund: freund.id, besser: false };
  freund.eintraege = [...freund.eintraege.filter((x) => x !== alt), neu];
  return { ok: true, freund: freund.id, besser: !!alt };
}

export function entferneFreund(st, id) {
  const vorher = st.freunde.length;
  st.freunde = st.freunde.filter((f) => f.id !== id);
  return st.freunde.length < vorher;
}

// ---------- Spielerkarte ----------
export function tafelStatistik(st) {
  const tafeln = Object.values(st.tafeln).filter((t) => t.eintraege.length);
  let platz1 = 0;
  let beste = null;
  for (const t of tafeln) {
    const z = T.zeilen(t, { fenster: 'allzeit', gaeste: gaeste(st, t.id) });
    const ich = z.find((x) => x.eigen);
    if (ich && ich.platz === 1 && z.some((x) => !x.eigen)) platz1++;
    const b = t.eintraege[0];
    if (b && (!beste || T.vergleiche(b, beste.e) < 0)) beste = { e: b, tafel: t.id };
  }
  return { rekorde: st.rekorde.length, platz1, tafeln: tafeln.length, beste, partien: st.ids.length };
}
