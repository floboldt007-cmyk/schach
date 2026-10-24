// Paket serie: Tageslogik des Bauernmarschs (SPIELKONZEPT 3.14). Rein, ohne DOM, in Node testbar. Kein Math.random.
// Rechnet nur mit Tagesschluesseln aus js/tag.js (Tag von 4:00 bis 4:00 Ortszeit, nie toISOString).
//
// Die Serie zaehlt Schachtage (Tage mit einem Tageswerk) und kann nur wachsen oder ruhen, nie zerbrechen:
//   - Ein einzelner freier Tag wird zur Bruecke (zaehlt nicht mit, unterbricht nicht). Erst zwei freie Tage hintereinander
//     lassen die Serie ruhen. Ruhetag und angesagte Pause sind nie frei (neutral, die Serie ist eingefroren).
//   - Strenge Serie (Einstellung): jeder freie Tag braucht einen von 2 Schonungstagen des Kalendermonats.
//   - Reise-Regel: Ueberspringt das Datum durch einen Zeitzonenwechsel genau einen Tag, gilt er als gezaehlt, wenn Tag davor
//     und danach zaehlten.
//   - Ruhen statt Null: Das naechste Tageswerk beginnt ein neues Kapitel; Rekord, Spieltage gesamt, Felder und Figuren
//     bleiben. Der Bauer laeuft nie zurueck.
//   - Uhr zurueckgestellt (Zeitreise): Ein Tag, der nicht nach dem zuletzt gezaehlten liegt, zaehlt nichts neu.
//
// Bauernmarsch: Jeder gezaehlte Tag ein Feld, nach FELDER Feldern eine Umwandlung (Figur nach Wahl, '?' bis gewaehlt),
// REIHE Figuren je Ehrenreihe, BRETT Figuren je Brett. Doppelschritt am ersten Tag nach mindestens 2 Tagen ohne Tageswerk,
// hoechstens einmal je Kalendermonat ("Willkommen zurueck"). Die Tageskrone (Tagesaufgaben) kennt dieses Paket noch nicht.
//
// API (alle Funktionen veraendern nur den uebergebenen Stand st):
//   STAND, WERK, FELDER, REIHE, BRETT, MEILENSTEINE, GESAMT_MEILENSTEINE, BRIEF_TAGE, GEWOHNHEIT_TAG, BEWEIS_AB,
//   PAUSE_JAHR_MAX, SCHONUNG_MONAT, RING_TAGE, TAGE_MAX, FIGUREN
//   leer() -> Stand                              frischer Stand (Rechenstand STAND)
//   istMeilenstein(n) -> boolean                 3, 5, 7, 10, 14, 21, 30, 50, 66, 100, 150, 200, 365, danach jedes volle Hundert
//   aktivitaet(st, { tag, art, schluessel }) -> quelle | null
//       zaehlt eine Aktivitaet zum Tageswerk dieses Tages (art 'partie' | 'karte' | 'uebung' | 'raetsel' | 'lektion';
//       schluessel macht Uebungen und Raetsel eindeutig). Liefert die Quelle des Tageswerks genau einmal je Tag, sobald
//       es erfuellt ist ('partie' | 'kartei' | 'uebung' | 'raetsel' | 'lektion'), sonst null.
//   zaehleTag(st, tag, { quelle, einst, tz }) -> Ergebnis | null
//       zaehlt den Tag (null: schon gezaehlt oder Zeitreise). Ergebnis = { tag, quelle, aktuell, vorher, kapitel,
//       neuesKapitel, bruecken, reise, doppelschritt, feldVorher, feld, umwandlungen: [nr], meilenstein, plakette,
//       gewohnheit, gesamtMeilenstein, brief }
//   lage(st, heute, einst) -> { art: 'neu' | 'laeuft' | 'ruht', aktuell, best, gesamt, kapitel, heuteGezaehlt,
//       gesternBruecke, pause, ruhetag, feld, bisUmwandlung, umwandlungen, offeneWahl, naechstesKapitel }
//   kalender(st, heute, einst, wochen = 6) -> [{ montag, kw, tage: [{ tag, art, heute }] }]   neueste Woche zuerst;
//       art 'gezaehlt' | 'reise' | 'bruecke' | 'ruhetag' | 'pause' | 'leer' | 'offen' (heute) | 'zukunft' | 'vorher' (vor dem
//       ersten bekannten Schachtag); Wochen nur ab der Woche des ersten bekannten Schachtags
//   ringStand(st, heute, einst) -> { n, best, woche: { gezaehlt, noetig } }   Wochen-Ring (Mo bis So, mindestens 4 Tage)
//   ringNachziehen(st, heute, einst)             wertet alle fertigen Wochen aus (beim Zaehlen)
//   pauseAnsagen(st, heute, { ab, tage }) -> { ok, tage: [...], grund? }   nur heute oder kuenftig, 30 Tage je Jahr
//   pauseBeenden(st, heute) -> Zahl              entfernt angesagte Pausentage ab heute (sie zaehlen wieder fuers Jahr)
//   waehleFigur(st, figur) -> boolean            erste offene Umwandlung ('?') bekommt 'D' | 'T' | 'L' | 'S'
//   beweis({ partien, von, bis, tage, z }) -> Text   Beweis-Karte eines Meilensteins (nur Verbesserungen, sonst Fakten)
//   kuerze(st)                                   haelt Listen klein (Budget des Moduls)
import { istSchluessel, addiereTage, tageZwischen, wochentag, tagSchluessel, kalenderwoche } from '../../tag.js';
import { t, zahl } from '../../sprache.js';
import { KLASSEN_NAME } from '../../zugklassen.js';
import './texte.js';

export const STAND = 1;
// Tageswerk (3.14 Regel 2): eins davon genuegt
export const WERK = Object.freeze({ partieZuege: 10, karten: 3, uebungen: 2, raetsel: 3, lektionen: 1 });
export const FELDER = 6;
export const REIHE = 8;
export const BRETT = 64;
export const MEILENSTEINE = Object.freeze([3, 5, 7, 10, 14, 21, 30, 50, 66, 100, 150, 200, 365]);
export const GESAMT_MEILENSTEINE = Object.freeze([10, 25, 50, 100, 250, 500, 1000]);
export const BRIEF_TAGE = Object.freeze([7, 30, 100, 365]);
export const GEWOHNHEIT_TAG = 66;
export const BEWEIS_AB = 7;
export const PAUSE_JAHR_MAX = 30;
export const SCHONUNG_MONAT = 2;
export const RING_TAGE = 4;
// gezaehlte Tage im Speicher (reicht fuer 7 Wochen Kalender und den Wochen-Ring)
export const TAGE_MAX = 49;
// Namen der Figuren in der eingestellten Sprache (Getter, wie KLASSEN_NAME in js/zugklassen.js): FIGUREN.D, Object.entries
function figurenNamen() {
  const o = {};
  for (const f of ['D', 'T', 'L', 'S']) Object.defineProperty(o, f, { get: () => t('p-serie.figur.' + f), enumerable: true });
  return Object.freeze(o);
}
export const FIGUREN = figurenNamen();
const KAPITEL_MAX = 8;
const PLAKETTEN_MAX = 8;
const QUELLEN = { partie: 'partie', karte: 'kartei', uebung: 'uebung', raetsel: 'raetsel', lektion: 'lektion' };

export function leer() {
  return {
    stand: STAND,
    tage: [], reise: [], letzter: null, aktuell: 0, best: 0, gesamt: 0,
    kapitel: null, kapitelListe: [],
    felder: 0, doppel: null, figuren: '', figurTage: [], bretter: 0,
    plaketten: [], ms66: null, gesamtMs: [], vorzug: 0,
    ring: { n: 0, best: 0, bis: null, ab: null },
    pausen: [], pauseJahr: {}, schonung: {},
    heute: { tag: null, p: 0, k: 0, u: [], r: [], l: 0, werk: null },
    tz: null,
    lauf: { n: 0, best: 0, ms: [] },
    ids: [], abr: [], brief: null, hinweise: [], w: null,
  };
}

export function istMeilenstein(n) {
  return Number.isInteger(n) && (MEILENSTEINE.includes(n) || (n > 365 && n % 100 === 0));
}

const monatVon = (k) => k.slice(0, 7);
const jahrVon = (k) => k.slice(0, 4);
const montagVon = (k) => addiereTage(k, -wochentag(k));
const ruhetagVon = (einst) => (einst && Number.isInteger(einst.ruhetag) && einst.ruhetag >= 0 && einst.ruhetag <= 6 ? einst.ruhetag : null);

function istGezaehlt(st, k) {
  return st.tage.includes(k);
}
function istPause(st, k) {
  return st.pausen.includes(k);
}

// Art eines vergangenen, nicht gezaehlten Tags: 'pause' und 'ruhetag' sind neutral, sonst 'frei'
function artFrei(st, k, einst) {
  if (istPause(st, k)) return 'pause';
  const r = ruhetagVon(einst);
  if (r != null && wochentag(k) === r) return 'ruhetag';
  return 'frei';
}

// Tage echt zwischen von und bis (beide ausgenommen): freie und neutrale
function luecke(st, von, bis, einst) {
  const frei = [];
  const neutral = [];
  const n = tageZwischen(von, bis);
  // sehr lange Luecken (Monate): frei sind es ohnehin mehr als zwei; die Schleife bleibt kurz
  const grenze = Math.min(n - 1, 400);
  for (let i = 1; i <= grenze; i++) {
    const k = addiereTage(von, i);
    if (artFrei(st, k, einst) === 'frei') frei.push(k);
    else neutral.push(k);
  }
  if (n - 1 > grenze) frei.push('…');
  return { frei, neutral };
}

// Strenge Serie: reichen die Schonungstage der Monate fuer diese freien Tage?
function schonungReicht(st, frei) {
  if (frei.includes('…')) return false;
  const bedarf = {};
  for (const k of frei) bedarf[monatVon(k)] = (bedarf[monatVon(k)] || 0) + 1;
  return Object.entries(bedarf).every(([m, n]) => (st.schonung[m] || 0) + n <= SCHONUNG_MONAT);
}

function lebtUeber(st, frei, einst) {
  return einst && einst.strenge ? schonungReicht(st, frei) : frei.length <= 1;
}

// ---------- Tageswerk ----------
export function aktivitaet(st, { tag, art, schluessel = null } = {}) {
  if (!istSchluessel(tag) || !QUELLEN[art]) return null;
  const h = st.heute;
  if (h.tag !== tag) Object.assign(h, { tag, p: 0, k: 0, u: [], r: [], l: 0, werk: null });
  if (art === 'partie') h.p++;
  else if (art === 'karte') h.k++;
  else if (art === 'lektion') h.l++;
  else {
    const liste = art === 'uebung' ? h.u : h.r;
    const s = String(schluessel == null ? liste.length : schluessel).slice(0, 40);
    if (liste.includes(s)) return null;
    liste.push(s);
    if (liste.length > 8) liste.splice(0, liste.length - 8);
  }
  if (h.werk) return null;
  const erfuellt = (art === 'partie' && h.p >= 1) || (art === 'karte' && h.k >= WERK.karten)
    || (art === 'uebung' && h.u.length >= WERK.uebungen) || (art === 'raetsel' && h.r.length >= WERK.raetsel)
    || (art === 'lektion' && h.l >= WERK.lektionen);
  if (!erfuellt) return null;
  h.werk = QUELLEN[art];
  return h.werk;
}

// Zaehler je Kapitel (fuer die Beweis-Karte: "30 Tage Schach: 41 Partien, 120 Karten, 18 Lektionen")
export function zaehleEinheit(st, art) {
  if (!st.kapitel || !st.kapitel.z) return;
  const k = { partie: 'p', karte: 'k', raetsel: 'r', lektion: 'l', uebung: 'u' }[art];
  if (k) st.kapitel.z[k] = (st.kapitel.z[k] || 0) + 1;
}

// ---------- einen Tag zaehlen ----------
export function zaehleTag(st, tag, { quelle = 'partie', einst = {}, tz = null } = {}) {
  if (!istSchluessel(tag)) return null;
  if (st.letzter && tageZwischen(st.letzter, tag) <= 0) return null;
  const vorher = st.aktuell;
  const r = {
    tag, quelle, vorher, aktuell: 0, kapitel: 0, neuesKapitel: false, bruecken: 0, reise: null, doppelschritt: false,
    feldVorher: st.felder, feld: 0, umwandlungen: [], meilenstein: null, plakette: null, gewohnheit: false, gesamtMeilenstein: null, brief: null,
  };
  let reise = null;
  if (!st.letzter) {
    st.kapitel = { nr: 1, von: tag, br: 0, z: {} };
    st.aktuell = 1;
    r.neuesKapitel = true;
    st.ring.ab = montagVon(tag);
  } else {
    const l = luecke(st, st.letzter, tag, einst);
    // Reise-Regel: genau ein uebersprungener Tag und die Zeitzone hat sich seit dem letzten Zaehlen geaendert
    if (l.frei.length === 1 && tageZwischen(st.letzter, tag) === 2 && Number.isFinite(tz) && Number.isFinite(st.tz) && tz !== st.tz) {
      reise = l.frei[0];
      l.frei = [];
    }
    if (lebtUeber(st, l.frei, einst)) {
      if (einst && einst.strenge) for (const k of l.frei) st.schonung[monatVon(k)] = (st.schonung[monatVon(k)] || 0) + 1;
      st.aktuell += 1 + (reise ? 1 : 0);
      st.kapitel.br += l.frei.length;
      r.bruecken = l.frei.length;
    } else {
      st.kapitelListe.push({ nr: st.kapitel.nr, von: st.kapitel.von, bis: st.letzter, tage: st.aktuell });
      st.kapitel = { nr: st.kapitel.nr + 1, von: tag, br: 0, z: {} };
      st.aktuell = 1;
      r.neuesKapitel = true;
      r.vorher = 0;
    }
    // Doppelschritt: mindestens 2 Tage ohne Tageswerk davor, hoechstens einmal je Kalendermonat
    if (tageZwischen(st.letzter, tag) - 1 >= 2 && st.doppel !== monatVon(tag)) {
      st.doppel = monatVon(tag);
      r.doppelschritt = true;
    }
  }
  if (reise) {
    st.tage.push(reise);
    st.reise.push(reise);
    r.reise = reise;
  }
  st.tage.push(tag);
  st.letzter = tag;
  if (Number.isFinite(tz)) st.tz = tz;
  const neueTage = 1 + (reise ? 1 : 0);
  const gesamtVorher = st.gesamt;
  st.gesamt += neueTage;
  st.best = Math.max(st.best, st.aktuell);
  r.aktuell = st.aktuell;
  r.kapitel = st.kapitel.nr;
  // Bauernmarsch: Felder, Umwandlungen
  const feldVorher = st.felder;
  st.felder += neueTage + (r.doppelschritt ? 1 : 0);
  r.feld = st.felder;
  for (let u = Math.floor(feldVorher / FELDER) + 1; u <= Math.floor(st.felder / FELDER); u++) {
    if (st.figuren.length >= BRETT) {
      st.bretter++;
      st.figuren = '';
    }
    st.figuren += '?';
    st.figurTage.push(tag);
    r.umwandlungen.push(u);
  }
  // Meilensteine in Serie (der hoechste ueberschrittene), Plakette mit Zeitraum, Bot-Brief, Tag 66
  const von = r.neuesKapitel ? 0 : r.vorher;
  for (let n = von + 1; n <= st.aktuell; n++) if (istMeilenstein(n)) r.meilenstein = n;
  if (r.meilenstein) {
    r.plakette = { n: r.meilenstein, von: st.kapitel.von, bis: tag };
    st.plaketten.unshift(r.plakette);
    if (BRIEF_TAGE.includes(r.meilenstein)) {
      r.brief = r.meilenstein;
      st.brief = { n: r.meilenstein, tag };
    }
  }
  if (!st.ms66 && von < GEWOHNHEIT_TAG && st.aktuell >= GEWOHNHEIT_TAG) {
    st.ms66 = tag;
    r.gewohnheit = true;
  }
  for (const n of GESAMT_MEILENSTEINE) {
    if (gesamtVorher < n && st.gesamt >= n && !st.gesamtMs.includes(n)) {
      st.gesamtMs.push(n);
      st.vorzug++;
      r.gesamtMeilenstein = n;
    }
  }
  ringNachziehen(st, tag, einst);
  kuerze(st);
  return r;
}

// ---------- Lage fuer die Anzeige ----------
export function lage(st, heute, einst = {}) {
  const pos = st.felder % FELDER;
  const r = {
    art: 'neu', aktuell: st.aktuell, best: st.best, gesamt: st.gesamt, kapitel: st.kapitel ? st.kapitel.nr : 0,
    heuteGezaehlt: false, gesternBruecke: false, pause: istSchluessel(heute) && istPause(st, heute),
    ruhetag: istSchluessel(heute) && ruhetagVon(einst) != null && wochentag(heute) === ruhetagVon(einst),
    feld: pos, bisUmwandlung: FELDER - pos, umwandlungen: Math.floor(st.felder / FELDER),
    offeneWahl: (st.figuren.match(/\?/g) || []).length, naechstesKapitel: (st.kapitel ? st.kapitel.nr : 0) + 1,
    seit: st.kapitel ? st.kapitel.von : null, bruecken: st.kapitel ? st.kapitel.br : 0,
  };
  if (!st.letzter || !istSchluessel(heute)) return r;
  const d = tageZwischen(st.letzter, heute);
  if (d <= 0) {
    r.art = 'laeuft';
    r.heuteGezaehlt = true;
    return r;
  }
  const l = luecke(st, st.letzter, heute, einst);
  if (lebtUeber(st, l.frei, einst)) {
    r.art = 'laeuft';
    r.gesternBruecke = l.frei.length >= 1 && l.frei[l.frei.length - 1] === addiereTage(heute, -1);
    // die laufende Bruecke zaehlt im Kapitel schon mit (sie steht im Kalender)
    r.bruecken += l.frei.length;
  } else {
    r.art = 'ruht';
  }
  return r;
}

// ---------- Kalender ----------
function kapitelStarts(st) {
  const s = new Set(st.kapitelListe.map((k) => k.von));
  if (st.kapitel) s.add(st.kapitel.von);
  return s;
}

export function kalender(st, heute, einst = {}, wochen = 6) {
  if (!istSchluessel(heute)) return [];
  const starts = kapitelStarts(st);
  const sortiert = st.tage.slice().sort();
  const lg = lage(st, heute, einst);
  const naechsterGezaehlt = (k) => sortiert.find((x) => x > k) || null;
  const vorigerGezaehlt = (k) => { let v = null; for (const x of sortiert) { if (x < k) v = x; else break; } return v; };
  const aus = [];
  const montag0 = montagVon(heute);
  // nur Wochen ab dem ersten bekannten Schachtag (davor gibt es nichts zu zeigen), mindestens die laufende
  const erster = sortiert.length ? sortiert[0] : heute;
  const anzahl = Math.max(1, Math.min(wochen, Math.floor(tageZwischen(montagVon(erster), montag0) / 7) + 1));
  for (let w = 0; w < anzahl; w++) {
    const montag = addiereTage(montag0, -7 * w);
    const tage = [];
    for (let i = 0; i < 7; i++) {
      const k = addiereTage(montag, i);
      const diff = tageZwischen(k, heute);
      let art;
      if (istGezaehlt(st, k)) art = st.reise.includes(k) ? 'reise' : 'gezaehlt';
      else if (k < erster && diff > 0) art = 'vorher';
      else if (istPause(st, k)) art = 'pause';
      else if (diff < 0) art = 'zukunft';
      else if (ruhetagVon(einst) != null && wochentag(k) === ruhetagVon(einst)) art = 'ruhetag';
      else if (diff === 0) art = 'offen';
      else {
        // freier Tag: Bruecke, wenn die Serie ueber ihn weiterlief
        const a = vorigerGezaehlt(k);
        const b = naechsterGezaehlt(k);
        if (a && b) art = starts.has(b) ? 'leer' : 'bruecke';
        else if (a && !b) art = lg.art === 'laeuft' ? 'bruecke' : 'leer';
        else art = 'leer';
      }
      tage.push({ tag: k, art, heute: diff === 0 });
    }
    aus.push({ montag, kw: kalenderwoche(montag).kw, tage });
  }
  return aus;
}

// ---------- Wochen-Ring ----------
function wochenWert(st, montag, einst) {
  let gezaehlt = 0;
  let pause = 0;
  for (let i = 0; i < 7; i++) {
    const k = addiereTage(montag, i);
    if (istGezaehlt(st, k)) gezaehlt++;
    else if (istPause(st, k)) pause++;
  }
  const verfuegbar = 7 - pause - (ruhetagVon(einst) != null ? 1 : 0);
  return { gezaehlt, noetig: Math.max(0, Math.min(RING_TAGE, verfuegbar)) };
}

export function ringNachziehen(st, heute, einst = {}) {
  const ring = st.ring;
  if (!ring.ab || !istSchluessel(heute)) return;
  const aktuell = montagVon(heute);
  let w = ring.bis ? addiereTage(ring.bis, 7) : ring.ab;
  for (let i = 0; i < 600 && tageZwischen(w, aktuell) > 0; i++) {
    const { gezaehlt, noetig } = wochenWert(st, w, einst);
    if (noetig > 0) {
      if (gezaehlt >= noetig) {
        ring.n++;
        ring.best = Math.max(ring.best, ring.n);
      } else ring.n = 0;
    }
    ring.bis = w;
    w = addiereTage(w, 7);
  }
}

export function ringStand(st, heute, einst = {}) {
  const kopie = { ring: { ...st.ring }, tage: st.tage, pausen: st.pausen };
  ringNachziehen(kopie, heute, einst);
  const woche = istSchluessel(heute) ? wochenWert(st, montagVon(heute), einst) : { gezaehlt: 0, noetig: RING_TAGE };
  return { n: kopie.ring.n, best: kopie.ring.best, woche };
}

// ---------- Pause ----------
export function pauseAnsagen(st, heute, { ab, tage } = {}) {
  if (!istSchluessel(heute) || !istSchluessel(ab)) return { ok: false, tage: [], grund: 'datum' };
  // nur heute (bis 4:00 des Folgetags) oder kuenftige Tage, nie rueckwirkend
  if (tageZwischen(heute, ab) < 0) return { ok: false, tage: [], grund: 'vergangen' };
  const n = Math.max(0, Math.min(PAUSE_JAHR_MAX, Math.floor(Number(tage) || 0)));
  if (!n) return { ok: false, tage: [], grund: 'dauer' };
  const neu = [];
  for (let i = 0; i < n; i++) {
    const k = addiereTage(ab, i);
    if (istPause(st, k) || istGezaehlt(st, k)) continue;
    const j = jahrVon(k);
    if ((st.pauseJahr[j] || 0) >= PAUSE_JAHR_MAX) continue;
    st.pauseJahr[j] = (st.pauseJahr[j] || 0) + 1;
    st.pausen.push(k);
    neu.push(k);
  }
  st.pausen.sort();
  if (!neu.length) return { ok: false, tage: [], grund: 'jahr' };
  return { ok: true, tage: neu };
}

export function pauseBeenden(st, heute) {
  if (!istSchluessel(heute)) return 0;
  const weg = st.pausen.filter((k) => tageZwischen(heute, k) >= 0);
  for (const k of weg) st.pauseJahr[jahrVon(k)] = Math.max(0, (st.pauseJahr[jahrVon(k)] || 0) - 1);
  st.pausen = st.pausen.filter((k) => tageZwischen(heute, k) < 0);
  return weg.length;
}

export function pauseRest(st, jahr) {
  return Math.max(0, PAUSE_JAHR_MAX - (st.pauseJahr[String(jahr)] || 0));
}

// ---------- Umwandlung waehlen ----------
export function waehleFigur(st, figur) {
  if (!FIGUREN[figur]) return false;
  const i = st.figuren.indexOf('?');
  if (i < 0) return false;
  st.figuren = st.figuren.slice(0, i) + figur + st.figuren.slice(i + 1);
  return true;
}

// ---------- Beweis-Karte ----------
const median = (l) => {
  const s = l.slice().sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
// gerundet wie bisher, Komma oder Punkt nach der Sprache ("1,5" | "1.5")
const komma = (x, n = 0) => zahl(Math.round(x * 10 ** n) / 10 ** n, { minimumFractionDigits: n, maximumFractionDigits: n });
function datumText(k) {
  return t('p-serie.datum.kurz', { t: k.slice(8, 10), m: k.slice(5, 7) });
}
export { datumText };

// partien: [{ datum (ISO), genauigkeit, liveKlassen, eigeneZuege, modus }]; von/bis: Tagesschluessel des Zeitraums;
// tage: Schachtage; z: Zaehler des Kapitels { p, k, r, l, u }
export function beweis({ partien = [], von, bis, tage = 0, z = {} } = {}) {
  const zeit = t('p-serie.zeitraum', { von: datumText(von), bis: datumText(bis) });
  const dauer = tageZwischen(von, bis) + 1;
  const davorVon = addiereTage(von, -dauer);
  const tagVon = (p) => { try { return tagSchluessel(new Date(p.datum)); } catch (e) { return null; } };
  const rein = (p) => p && (p.modus || 'normal') !== 'uebung' && Number(p.eigeneZuege) >= WERK.partieZuege;
  const imZeitraum = [];
  const davor = [];
  for (const p of partien) {
    if (!rein(p)) continue;
    const t = tagVon(p);
    if (!t) continue;
    if (t >= von && t <= bis) imZeitraum.push(p);
    else if (t >= davorVon && t < von) davor.push(p);
  }
  const teile = [];
  const g = (l) => l.filter((p) => Number.isFinite(p.genauigkeit)).map((p) => p.genauigkeit);
  const g1 = g(imZeitraum);
  const g0 = g(davor);
  if (g1.length >= 3 && g0.length >= 3 && median(g1) > median(g0)) teile.push(t('p-serie.beweis.genauigkeit', {
    vor: t('p-serie.prozent', { wert: komma(median(g0)) }), nach: t('p-serie.prozent', { wert: komma(median(g1)) }),
  }));
  const patzer = (l) => {
    let n = 0;
    let z2 = 0;
    for (const p of l) {
      if (!Array.isArray(p.liveKlassen)) continue;
      n += Number(p.eigeneZuege) || 0;
      z2 += p.liveKlassen.filter((k) => k === 'patzer').length;
    }
    return n >= 50 ? (z2 / n) * 10 : null;
  };
  const p1 = patzer(imZeitraum);
  const p0 = patzer(davor);
  if (p1 != null && p0 != null && p1 < p0) teile.push(t('p-serie.beweis.patzer', { klasse: KLASSEN_NAME.patzer, vor: komma(p0, 1), nach: komma(p1, 1) }));
  if (teile.length) return `${zeit} · ${teile.join(' · ')}`;
  const fakten = [[z.p, 'partie'], [z.k, 'karte'], [z.r, 'raetsel'], [z.l, 'lektion'], [z.u, 'uebung']]
    .filter(([n]) => n > 0).map(([n, art]) => t('p-serie.beweis.' + art, { n }));
  if (!fakten.length) return zeit;
  return t('p-serie.beweis.fakten', { zeit, tage, liste: fakten.join(', ') });
}

// ---------- klein halten ----------
export function kuerze(st) {
  st.tage = [...new Set(st.tage)].sort();
  if (st.tage.length > TAGE_MAX) st.tage = st.tage.slice(-TAGE_MAX);
  const aeltester = st.tage[0] || null;
  st.reise = st.reise.filter((k) => aeltester && k >= aeltester).slice(-8);
  if (st.kapitelListe.length > KAPITEL_MAX) st.kapitelListe = st.kapitelListe.slice(-KAPITEL_MAX);
  if (st.plaketten.length > PLAKETTEN_MAX) st.plaketten = st.plaketten.slice(0, PLAKETTEN_MAX);
  if (st.figurTage.length > REIHE) st.figurTage = st.figurTage.slice(-REIHE);
  // vergangene Pausentage nur so lange, wie der Kalender sie zeigt
  if (st.letzter) {
    const grenze = addiereTage(st.letzter, -TAGE_MAX);
    st.pausen = st.pausen.filter((k) => k >= grenze);
  }
  const jahre = Object.keys(st.pauseJahr).sort();
  for (const j of jahre.slice(0, Math.max(0, jahre.length - 2))) delete st.pauseJahr[j];
  const monate = Object.keys(st.schonung).sort();
  for (const m of monate.slice(0, Math.max(0, monate.length - 3))) delete st.schonung[m];
  if (st.ids.length > 24) st.ids = st.ids.slice(-24);
  if (st.abr.length > 3) st.abr = st.abr.slice(-3);
  if (st.gesamtMs.length > 12) st.gesamtMs = st.gesamtMs.slice(-12);
  return st;
}
