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
//     aufstieg, vorher, rekord, erster, platz1, ueberholt: [Name], wochenPlatz, sichtbar, bestwert, fast: { prozent } | null,
//     post: { name, w } | null }   post: die beste ueberholte Freundin (fuer die Ueberhol-Post, 3.13; nie automatisch)
//
// API:
//   STAND, MODUL, lade() -> Stand, speichere(st) -> { ok, ... } (duennt selbst aus), standard()
//   bewerte(st, d, { jetzt, nachHilfe, bossElo, tiefe, nachweis }) -> Ergebnis | null   aus partie:analysiert
//       ({ partieId, botId, modus, wertet, partie, review }); idempotent (zweites Mal: das gespeicherte Ergebnis)
//   ergebnisVon(st, partieId) -> Ergebnis | null
//   gaeste(st, tafelId) -> [Gast]   Freunde-Eintraege dieser Tafel (Gast-Zeilen, tafel.js)
//   fuegeFreundHinzu(st, { name, tafel, w, t, tag, f, z, e, pruef, n }) -> { ok, grund }   hoechstens 12 Freunde
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

export function gaeste(st, tafelId) {
  const aus = [];
  for (const f of st.freunde) {
    f.eintraege.forEach((e, i) => {
      if (e.tafel === tafelId) aus.push({ id: `f:${f.id}:${i}`, name: f.name || 'Freund', art: 'freund', w: e.w, t: e.t, pruef: e.pruef, freund: f.id });
    });
  }
  return aus;
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
    wochenPlatz: null, sichtbar: false, bestwert: null, fast: null, post: null,
  };
  if (tafelId) {
    const tafel = st.tafeln[tafelId] || T.neueTafel(tafelId);
    const e = {
      id: d.partieId, w: r.wert, t: eintragT, tag: tagSchluessel(eintragT), wo: wochenSchluessel(eintragT), mo: tagSchluessel(eintragT).slice(0, 7),
      f: farbe, z: n, e: ERG_KURZ[p.ergebnis] || 'n', g: g == null ? null : Math.round(g * 10) / 10,
      st: zahl(bossElo), m: groessterAusschlag(review),
    };
    if (typeof nachweis === 'string' && nachweis) e.n = nachweis;
    const neu = T.eintragen(tafel, e, { jetzt: t, gaeste: gaeste(st, tafelId) });
    if (neu) {
      const res = neu.ergebnis;
      Object.assign(ergebnis, {
        platz: res.platz, platzVorher: res.platzVorher, aufstieg: res.aufstieg, vorher: res.vorher, rekord: res.rekord, erster: res.erster,
        platz1: res.platz1, ueberholt: res.ueberholt.map((x) => x.name).slice(0, 3), wochenPlatz: res.wochenPlatz, sichtbar: res.sichtbar,
        bestwert: res.bestwert,
      });
      const freund = res.ueberholt.filter((x) => x.art === 'freund').sort(T.vergleiche)[0];
      if (freund) ergebnis.post = { name: String(freund.name || 'Freund').slice(0, 24), w: Math.round(freund.w) };
      const eNeu = neu.tafel.eintraege.find((x) => x.id === d.partieId);
      if (!res.rekord && !res.erster) ergebnis.fast = T.fast(neu.tafel, eNeu, { vorher: res.vorher, jetzt: t });
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
  let freund = st.freunde.find((x) => x.name.toLowerCase() === nm.toLowerCase());
  if (!freund) {
    if (st.freunde.length >= FREUNDE_MAX) return { ok: false, grund: 'voll' };
    let nr = st.freunde.length + 1;
    while (st.freunde.some((x) => x.id === 'f' + nr)) nr++;
    freund = { id: 'f' + nr, name: nm, eintraege: [] };
    st.freunde.push(freund);
  }
  if (freund.eintraege.some((x) => x.n && x.n === n)) return { ok: false, grund: 'doppelt', freund: freund.id };
  const gesamt = st.freunde.reduce((s, x) => s + x.eintraege.length, 0);
  if (gesamt >= FREUND_EINTRAEGE_MAX) return { ok: false, grund: 'voll' };
  // je Tafel zaehlt der beste Code eines Freundes (Gaeste-Zeilen bleiben uebersichtlich)
  const alt = freund.eintraege.find((x) => x.tafel === tafel);
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
