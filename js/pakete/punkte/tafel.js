// Tafeln der Bestenliste (Paket punkte, SPIELKONZEPT 3.13 "Alle Tabellen" und "Rekord-Momente"). Rein: ohne DOM,
// ohne Speicher, ohne Zufall; die Zeit kommt als Parameter. In Node testbar.
//
// Eine Tafel ist eine Bestenliste aus EINZELNEN Partien, nie eine Summe: je Bot ("Rudis Tafel", id 'bot:rudi') und je
// Boss und Stufe (Wochen-Tafel, id 'boss:<boss>:standard|meister'). Regeln (3.13):
//   - 10 Zeilen, davon hoechstens 3 eigene (damit Gaeste sichtbar bleiben); dein Bestwert steht immer da, auch unter
//     Platz 10.
//   - Gleichstand: der fruehere Eintrag steht vorn (ein gleich guter Wert ist also kein neuer Rekord).
//   - Drei Fenster je Tafel: Woche (Montag 4:00 bis Montag 4:00, Standard), Monat (Tagesgrenze 4:00), Allzeit. Nur ein
//     Allzeit-Rekord ist ein grosser Moment, ein Wochenbestwert eine stille Zeile.
//   - Abgelaufene Fenster wandern in eine kleine Chronik (je 12 Saeulen fuer Wochen und Monate), nichts Erreichtes
//     verschwindet ohne Spur.
// Gaeste (Bot-Laeufe ab S3, Freunde aus Codes) kommen von aussen dazu, gespeichert werden hier nur eigene Eintraege.
//
// Eintrag (eigen): { id (partieId), w (Tafelwert), t (ms), tag, wo (Wochenschluessel), mo ('JJJJ-MM'), f ('w'|'b'),
//   z (eigene Zuege), e ('s'|'r'|'n'), g (Genauigkeit oder null), st (Boss-Staerke oder null), m (Ply mit dem
//   groessten Ausschlag oder null), n (Nachweis: SA1-Code ohne Striche, nur bei den Allzeit-Besten) }
// Gast: { id, name, art: 'bot'|'freund', w, t, pruef: 'angabe'|'nachgerechnet'|'bot' }
//
// API:
//   ZEILEN = 10, EIGENE_SICHTBAR = 3, FENSTER = ['woche', 'monat', 'allzeit'], CHRONIK_SAEULEN = 12, FAST_AB = 0.9
//   tafelId({ botId, boss, stufe }) -> 'bot:rudi' | 'boss:baron-gambit:meister' | null; zerlegeId(id) -> { art, botId, stufe }
//   neueTafel(id) -> { id, eintraege: [], chronik: { w: [], m: [] }, nah: null, fast: null }
//   pruefeTafel(roh, id) -> Tafel (kaputte Teile fallen weg; fuer alte Spielstaende)
//   vergleiche(a, b)                Sortierung: hoeherer Wert vorn, bei Gleichstand der fruehere
//   imFenster(e, fenster, jetzt) -> boolean
//   eigene(tafel, fenster, jetzt) -> eigene Eintraege im Fenster, sortiert
//   zeilen(tafel, { fenster, jetzt, gaeste }) -> [{ ...eintrag, eigen, platz }]   hoechstens 10 (plus dein Bestwert)
//   eintragen(tafel, e, { jetzt, gaeste }) -> { tafel, ergebnis } | null (schon da)
//       ergebnis: { platz, platzVorher, aufstieg, vorher, rekord, erster, bestwert, ueberholt: [Gast], platz1,
//       wochenPlatz, wochenBest, monatsBest, sichtbar }
//   fast(tafel, e, { vorher, jetzt }) -> { prozent } | null   "So nah wie noch nie": hoechstens einmal je Tafel und Woche,
//       nur unter dem eigenen Rekord und naeher als je zuvor (ab FAST_AB); setzt tafel.nah und tafel.fast
//   duenneAus(tafel, jetzt) -> tafel   behaelt die Allzeit-Besten und die Besten der laufenden Woche und des laufenden
//       Monats (je 3); Nachweise nur an den Allzeit-Besten
import { tagSchluessel, wochenSchluessel, istSchluessel } from '../../tag.js';

export const STAND = 1;
export const ZEILEN = 10;
export const EIGENE_SICHTBAR = 3;
export const FENSTER = Object.freeze(['woche', 'monat', 'allzeit']);
export const CHRONIK_SAEULEN = 12;
export const FAST_AB = 0.9;
const ID_RE = /^(bot:[a-z][a-z0-9-]{0,31}|boss:[a-z][a-z0-9-]{0,31}:(standard|meister))$/;
const BOT_RE = /^[a-z][a-z0-9-]{0,31}$/;

const zahl = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : null);

export function tafelId({ botId, boss = null, stufe = null } = {}) {
  if (boss && typeof boss === 'object') {
    const s = boss.stufe || stufe;
    return typeof boss.id === 'string' && BOT_RE.test(boss.id) && (s === 'standard' || s === 'meister') ? `boss:${boss.id}:${s}` : null;
  }
  return typeof botId === 'string' && BOT_RE.test(botId) ? 'bot:' + botId : null;
}

export function zerlegeId(id) {
  if (typeof id !== 'string' || !ID_RE.test(id)) return null;
  const teile = id.split(':');
  return teile[0] === 'bot' ? { art: 'bot', botId: teile[1], stufe: null } : { art: 'boss', botId: teile[1], stufe: teile[2] };
}

export const istTafelId = (id) => typeof id === 'string' && ID_RE.test(id);

export function neueTafel(id) {
  return { id, eintraege: [], chronik: { w: [], m: [] }, nah: null, fast: null };
}

function pruefeEintrag(e) {
  if (!e || typeof e !== 'object' || typeof e.id !== 'string' || !e.id || e.id.length > 40) return null;
  if (zahl(e.w) == null || e.w < 0 || zahl(e.t) == null) return null;
  const tag = istSchluessel(e.tag) ? e.tag : tagSchluessel(e.t);
  const aus = {
    id: e.id, w: Math.round(e.w), t: e.t, tag, wo: istSchluessel(e.wo) ? e.wo : wochenSchluessel(e.t),
    mo: typeof e.mo === 'string' && /^\d{4}-\d{2}$/.test(e.mo) ? e.mo : tag.slice(0, 7),
    f: e.f === 'b' ? 'b' : 'w', z: Number.isInteger(e.z) && e.z >= 0 ? e.z : 0, e: ['s', 'r', 'n'].includes(e.e) ? e.e : 'n',
    g: zahl(e.g), st: zahl(e.st), m: Number.isInteger(e.m) && e.m >= 0 ? e.m : null,
  };
  if (typeof e.n === 'string' && /^[0-9A-Z]{8,1400}$/.test(e.n)) aus.n = e.n;
  return aus;
}

function pruefeSaeulen(l, re) {
  return (Array.isArray(l) ? l : []).filter((x) => Array.isArray(x) && x.length === 2 && re.test(String(x[0])) && zahl(x[1]) != null)
    .map(([k, w]) => [String(k), Math.round(w)]).slice(0, CHRONIK_SAEULEN);
}

export function pruefeTafel(roh, id) {
  const t = neueTafel(id);
  if (!roh || typeof roh !== 'object') return t;
  const gesehen = new Set();
  for (const e of Array.isArray(roh.eintraege) ? roh.eintraege : []) {
    const p = pruefeEintrag(e);
    if (p && !gesehen.has(p.id)) { gesehen.add(p.id); t.eintraege.push(p); }
  }
  t.eintraege.sort(vergleiche);
  const c = roh.chronik && typeof roh.chronik === 'object' ? roh.chronik : {};
  t.chronik = { w: pruefeSaeulen(c.w, /^\d{4}-\d{2}-\d{2}$/), m: pruefeSaeulen(c.m, /^\d{4}-\d{2}$/) };
  t.nah = zahl(roh.nah) != null && roh.nah > 0 && roh.nah < 1 ? roh.nah : null;
  t.fast = roh.fast && istSchluessel(roh.fast.wo) ? { wo: roh.fast.wo } : null;
  return t;
}

export function vergleiche(a, b) {
  return (b.w - a.w) || (a.t - b.t) || (String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0);
}

export function imFenster(e, fenster, jetzt = new Date()) {
  if (fenster === 'woche') return e.wo === wochenSchluessel(jetzt);
  if (fenster === 'monat') return e.mo === tagSchluessel(jetzt).slice(0, 7);
  return true;
}

export function eigene(tafel, fenster = 'allzeit', jetzt = new Date()) {
  return (tafel && Array.isArray(tafel.eintraege) ? tafel.eintraege : []).filter((e) => imFenster(e, fenster, jetzt)).sort(vergleiche);
}

// Gaeste sind an kein Fenster gebunden (Bot-Laeufe sind feste Marken; ein Wochenbestwert soll trotzdem erreichbar sein)
function gaesteListe(gaeste) {
  return (Array.isArray(gaeste) ? gaeste : []).filter((g) => g && typeof g === 'object' && zahl(g.w) != null)
    .map((g) => ({ ...g, t: zahl(g.t) ?? 0, eigen: false }));
}

export function zeilen(tafel, { fenster = 'woche', jetzt = new Date(), gaeste = [] } = {}) {
  const meine = eigene(tafel, fenster, jetzt).slice(0, EIGENE_SICHTBAR).map((e) => ({ ...e, eigen: true }));
  const alle = [...gaesteListe(gaeste), ...meine].sort(vergleiche);
  alle.forEach((r, i) => { r.platz = i + 1; });
  const oben = alle.slice(0, ZEILEN);
  // dein Bestwert steht immer da, auch unter Platz 10
  const best = alle.find((r) => r.eigen);
  if (best && !oben.includes(best)) oben.push(best);
  return oben;
}

// Platz eines Wertes unter Gaesten und eigenen Eintraegen (die sichtbaren eigenen: die drei besten im Fenster)
function platzIn(liste, e) {
  const i = liste.indexOf(e);
  return i < 0 ? null : i + 1;
}

function saeule(liste, schluessel, wert) {
  const l = liste.filter(([k]) => k !== schluessel);
  const alt = liste.find(([k]) => k === schluessel);
  l.push([schluessel, Math.max(wert, alt ? alt[1] : 0)]);
  return l.sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0)).slice(0, CHRONIK_SAEULEN);
}

export function eintragen(tafel, roh, { jetzt = new Date(), gaeste = [] } = {}) {
  const e = pruefeEintrag(roh);
  if (!e || !tafel) return null;
  if (tafel.eintraege.some((x) => x.id === e.id)) return null;
  const g = gaesteListe(gaeste);
  const vorherAlle = eigene(tafel, 'allzeit', jetzt);
  const alterBest = vorherAlle[0] || null;
  // Platz des alten Bestwerts vor dem Eintrag (unter Gaesten und den drei besten eigenen)
  const vorherSicht = [...g, ...vorherAlle.slice(0, EIGENE_SICHTBAR)].sort(vergleiche);
  const platzVorher = alterBest ? platzIn(vorherSicht, alterBest) : null;
  const neu = { ...tafel, eintraege: [...tafel.eintraege, e].sort(vergleiche), chronik: {
    w: saeule(tafel.chronik.w, e.wo, e.w), m: saeule(tafel.chronik.m, e.mo, e.w),
  } };
  const nachAlle = eigene(neu, 'allzeit', jetzt);
  const sichtbar = nachAlle.slice(0, EIGENE_SICHTBAR).includes(e);
  const nachSicht = [...g, ...nachAlle.slice(0, EIGENE_SICHTBAR)].sort(vergleiche);
  const platz = sichtbar ? platzIn(nachSicht, e) : null;
  const rekord = !!alterBest && vergleiche(e, alterBest) < 0;
  const erster = !alterBest;
  // ueberholte Gaeste: vorher vor deinem alten Bestwert, jetzt hinter dem neuen (nur bei einem neuen Rekord; ein erster
  // Eintrag steigt neu ein und ueberholt niemanden)
  const ueberholt = rekord ? g.filter((x) => vergleiche(x, e) > 0 && vergleiche(x, alterBest) < 0) : [];
  const aufstieg = rekord && platzVorher != null && platz != null ? Math.max(0, platzVorher - platz) : 0;
  // Platz 1 einer Tafel ist nur ein Moment, wenn dabei Gaeste hinter dir landen (allein auf der Tafel ist Platz 1 nichts)
  const platz1 = platz === 1 && (erster ? g.length > 0 : ueberholt.length > 0);
  const woche = eigene(neu, 'woche', jetzt);
  const monat = eigene(neu, 'monat', jetzt);
  const wochenSicht = [...g, ...woche.slice(0, EIGENE_SICHTBAR)].sort(vergleiche);
  const wochenPlatz = woche.slice(0, EIGENE_SICHTBAR).includes(e) ? platzIn(wochenSicht, e) : null;
  const ergebnis = {
    platz, platzVorher, aufstieg, vorher: alterBest ? alterBest.w : null, rekord, erster, bestwert: nachAlle[0].w,
    ueberholt, platz1, wochenPlatz,
    wochenBest: woche[0] === e && woche.length > 1, monatsBest: monat[0] === e && monat.length > 1, sichtbar,
  };
  if (rekord) neu.nah = null;
  return { tafel: neu, ergebnis };
}

export function fast(tafel, e, { vorher = null, jetzt = new Date() } = {}) {
  if (!tafel || !e || zahl(vorher) == null || vorher <= 0 || zahl(e.w) == null || e.w >= vorher) return null;
  const anteil = e.w / vorher;
  if (anteil < FAST_AB) return null;
  const wo = wochenSchluessel(jetzt);
  if (tafel.fast && tafel.fast.wo === wo) return null;
  if (tafel.nah != null && anteil <= tafel.nah + 1e-9) return null;
  tafel.nah = anteil;
  tafel.fast = { wo };
  return { prozent: Math.floor(anteil * 100) };
}

export function duenneAus(tafel, jetzt = new Date()) {
  if (!tafel) return tafel;
  const alle = [...tafel.eintraege].sort(vergleiche);
  const behalten = new Set(alle.slice(0, EIGENE_SICHTBAR));
  for (const f of ['woche', 'monat']) for (const e of alle.filter((x) => imFenster(x, f, jetzt)).slice(0, EIGENE_SICHTBAR)) behalten.add(e);
  const spitze = new Set(alle.slice(0, EIGENE_SICHTBAR));
  tafel.eintraege = alle.filter((e) => behalten.has(e)).map((e) => {
    if (spitze.has(e) || !e.n) return e;
    const { n, ...rest } = e;
    return rest;
  });
  return tafel;
}
