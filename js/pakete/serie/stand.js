// Paket serie: Speicher (Modul "serie", Budget MODUL_BUDGET.serie) und Einstellungen. Ohne DOM, in Node testbar.
// Kein Math.random.
//
// Form (Rechenstand STAND = 1; alles nur erweitern, alte Staende bleiben gueltig):
//   { stand, tage: [Tagesschluessel, hoechstens 49], reise: [...], letzter, aktuell, best, gesamt,
//     kapitel: { nr, von, br (Bruecken), z: { p, k, r, l, u } }, kapitelListe: [{ nr, von, bis, tage }],
//     felder, doppel ('JJJJ-MM'), figuren ('DTLS?', hoechstens 64), figurTage, bretter,
//     plaketten: [{ n, von, bis }], ms66, gesamtMs, vorzug, ring: { n, best, bis, ab },
//     pausen, pauseJahr: { JJJJ: n }, schonung: { 'JJJJ-MM': n }, heute: { tag, p, k, u, r, l, werk }, tz,
//     lauf: { n, best, ms }, ids, abr: [{ id, t, f, u, m, l, e, b }], brief: { n, tag }, hinweise: [{ tag, art, n }], w: { wert, n } }
// Ein Stand aus einer neueren App (stand > STAND) wird gelesen, aber nie ueberschrieben.
//
// Einstellungen (speichereModulEinstellungen('serie'), "Fortschritt zuruecksetzen" verschont sie):
//   { anzeigen: true, ruhetag: null | 0..6 (0 = Montag), strenge: false, leise: false }
//
// API: MODUL, STAND, lade() -> st, speichere(st) -> { ok, zeichen, grund? }, nurLesen(st) -> boolean,
//      normalisiere(roh) -> st, einstellungen() -> e, speichereEinstellungen(e) -> { ok }, EINSTELLUNGEN
import { ladeModul, speichereModul, MODUL_BUDGET, ladeModulEinstellungen, speichereModulEinstellungen } from '../../storage.js';
import { istSchluessel, addiereTage, wochentag } from '../../tag.js';
import * as T from './tag.js';

export const MODUL = 'serie';
export const STAND = T.STAND;
export const EINSTELLUNGEN = Object.freeze({ anzeigen: true, ruhetag: null, strenge: false, leise: false });

const neuer = new WeakSet();
const ganz = (x, min = 0) => (Number.isInteger(x) && x >= min ? x : min);
const schluessel = (x) => (istSchluessel(x) ? x : null);
const schluesselListe = (l) => (Array.isArray(l) ? l.filter(istSchluessel) : []);
const objekt = (x) => (x && typeof x === 'object' && !Array.isArray(x) ? x : null);
const zahlenMap = (x, re) => {
  const o = objekt(x) || {};
  const aus = {};
  for (const [k, v] of Object.entries(o)) if (re.test(k) && Number.isInteger(v) && v >= 0) aus[k] = v;
  return aus;
};

export function normalisiere(roh) {
  const st = T.leer();
  const r = objekt(roh);
  if (!r) return st;
  st.stand = Number.isInteger(r.stand) && r.stand >= 1 ? r.stand : STAND;
  st.tage = [...new Set(schluesselListe(r.tage))].sort();
  st.reise = schluesselListe(r.reise);
  st.letzter = schluessel(r.letzter) || (st.tage.length ? st.tage[st.tage.length - 1] : null);
  st.aktuell = ganz(r.aktuell);
  st.best = Math.max(ganz(r.best), st.aktuell);
  st.gesamt = Math.max(ganz(r.gesamt), st.tage.length);
  const k = objekt(r.kapitel);
  if (k && Number.isInteger(k.nr) && k.nr >= 1 && istSchluessel(k.von)) {
    const z = objekt(k.z) || {};
    st.kapitel = { nr: k.nr, von: k.von, br: ganz(k.br), z: {} };
    for (const n of ['p', 'k', 'r', 'l', 'u']) if (Number.isInteger(z[n]) && z[n] > 0) st.kapitel.z[n] = z[n];
  } else if (st.letzter) {
    st.kapitel = { nr: 1, von: st.tage[0] || st.letzter, br: 0, z: {} };
  }
  if (st.letzter && st.aktuell < 1) st.aktuell = 1;
  st.kapitelListe = (Array.isArray(r.kapitelListe) ? r.kapitelListe : [])
    .filter((x) => objekt(x) && Number.isInteger(x.nr) && istSchluessel(x.von) && istSchluessel(x.bis) && Number.isInteger(x.tage))
    .map((x) => ({ nr: x.nr, von: x.von, bis: x.bis, tage: Math.max(1, x.tage) }));
  st.felder = Math.max(ganz(r.felder), st.gesamt);
  st.doppel = typeof r.doppel === 'string' && /^\d{4}-\d{2}$/.test(r.doppel) ? r.doppel : null;
  st.figuren = typeof r.figuren === 'string' ? r.figuren.replace(/[^DTLS?]/g, '').slice(0, T.BRETT) : '';
  st.figurTage = schluesselListe(r.figurTage);
  st.bretter = ganz(r.bretter);
  // jede volle Umwandlung hat eine Figur (fehlende werden als offene Wahl nachgetragen: der Bauer laeuft nie zurueck)
  const soll = Math.floor(st.felder / T.FELDER) - st.bretter * T.BRETT;
  if (soll > st.figuren.length && soll <= T.BRETT) st.figuren += '?'.repeat(soll - st.figuren.length);
  st.plaketten = (Array.isArray(r.plaketten) ? r.plaketten : [])
    .filter((x) => objekt(x) && Number.isInteger(x.n) && istSchluessel(x.von) && istSchluessel(x.bis)).map((x) => ({ n: x.n, von: x.von, bis: x.bis }));
  st.ms66 = schluessel(r.ms66);
  st.gesamtMs = Array.isArray(r.gesamtMs) ? r.gesamtMs.filter((n) => T.GESAMT_MEILENSTEINE.includes(n)) : [];
  st.vorzug = ganz(r.vorzug);
  const ring = objekt(r.ring) || {};
  st.ring = { n: ganz(ring.n), best: Math.max(ganz(ring.best), ganz(ring.n)), bis: schluessel(ring.bis), ab: schluessel(ring.ab) };
  if (!st.ring.ab && st.tage.length) st.ring.ab = addiereTage(st.tage[0], -wochentag(st.tage[0]));
  st.pausen = [...new Set(schluesselListe(r.pausen))].sort();
  st.pauseJahr = zahlenMap(r.pauseJahr, /^\d{4}$/);
  st.schonung = zahlenMap(r.schonung, /^\d{4}-\d{2}$/);
  const h = objekt(r.heute) || {};
  st.heute = {
    tag: schluessel(h.tag), p: ganz(h.p), k: ganz(h.k), l: ganz(h.l),
    u: Array.isArray(h.u) ? h.u.filter((x) => typeof x === 'string').slice(-8) : [],
    r: Array.isArray(h.r) ? h.r.filter((x) => typeof x === 'string').slice(-8) : [],
    werk: typeof h.werk === 'string' ? h.werk : null,
  };
  st.tz = Number.isFinite(r.tz) ? r.tz : null;
  const l = objekt(r.lauf) || {};
  st.lauf = { n: ganz(l.n), best: Math.max(ganz(l.best), ganz(l.n)), ms: Array.isArray(l.ms) ? l.ms.filter((n) => Number.isInteger(n)) : [] };
  st.ids = Array.isArray(r.ids) ? r.ids.filter((x) => typeof x === 'string').slice(-24) : [];
  st.abr = (Array.isArray(r.abr) ? r.abr : []).filter((x) => objekt(x) && typeof x.id === 'string').slice(-3);
  const b = objekt(r.brief);
  st.brief = b && Number.isInteger(b.n) && istSchluessel(b.tag) ? { n: b.n, tag: b.tag } : null;
  st.hinweise = (Array.isArray(r.hinweise) ? r.hinweise : [])
    .filter((hw) => objekt(hw) && istSchluessel(hw.tag) && typeof hw.art === 'string')
    .map((hw) => ({ tag: hw.tag, art: hw.art.slice(0, 20), n: Number.isInteger(hw.n) ? hw.n : null })).slice(-3);
  const w = objekt(r.w);
  st.w = w && Number.isFinite(w.wert) ? { wert: w.wert, n: ganz(w.n) } : null;
  return st;
}

export function lade() {
  const roh = ladeModul(MODUL, null);
  const st = normalisiere(roh);
  if (st.stand > STAND) neuer.add(st);
  else st.stand = STAND;
  return st;
}

export function nurLesen(st) {
  return neuer.has(st);
}

// Im Budget bleiben: erst Merker, dann alte Listen kuerzen (die Zahlen selbst bleiben immer)
export function speichere(st) {
  if (neuer.has(st)) return { ok: false, zeichen: 0, grund: 'neuer' };
  T.kuerze(st);
  const max = MODUL_BUDGET[MODUL] - 50;
  const schritte = [
    () => { st.ids = st.ids.slice(-8); },
    () => { st.abr = st.abr.slice(-1); },
    () => { st.plaketten = st.plaketten.slice(0, 3); },
    () => { st.kapitelListe = st.kapitelListe.slice(-3); },
    () => { st.tage = st.tage.slice(-28); },
    () => { st.figurTage = st.figurTage.slice(-2); },
    () => { st.pausen = st.letzter ? st.pausen.filter((k) => k >= st.letzter) : st.pausen; },
  ];
  for (const s of schritte) {
    if (JSON.stringify(st).length <= max) break;
    s();
  }
  return speichereModul(MODUL, st);
}

export function einstellungen() {
  const roh = ladeModulEinstellungen(MODUL, {});
  const e = { ...EINSTELLUNGEN };
  if (roh && typeof roh === 'object') {
    if (typeof roh.anzeigen === 'boolean') e.anzeigen = roh.anzeigen;
    if (Number.isInteger(roh.ruhetag) && roh.ruhetag >= 0 && roh.ruhetag <= 6) e.ruhetag = roh.ruhetag;
    if (typeof roh.strenge === 'boolean') e.strenge = roh.strenge;
    if (typeof roh.leise === 'boolean') e.leise = roh.leise;
  }
  return e;
}

export function speichereEinstellungen(teil) {
  const roh = ladeModulEinstellungen(MODUL, {});
  const neu = { ...(roh && typeof roh === 'object' ? roh : {}), ...einstellungen(), ...teil };
  if (!(Number.isInteger(neu.ruhetag) && neu.ruhetag >= 0 && neu.ruhetag <= 6)) neu.ruhetag = null;
  return speichereModulEinstellungen(MODUL, neu);
}
