// Tag, Woche und Zufall aus einem Seed (Runde 4, W0+a "Spiel-Fundament"). Rein, ohne DOM, in Node testbar.
// Grundlage fuer alles, was am Datum haengt: Funken (Tagesbogen, Rueckenwind), Bauernmarsch, Tagesraetsel,
// Wochen-Boss, Spielplan. Ein Tag reicht von 4:00 bis 4:00 Uhr LOKALER Zeit, eine Woche von Montag 4:00 bis
// Montag 4:00. Gerechnet wird immer mit der Wanduhr (getFullYear/getMonth/getDate/getHours), nie mit
// toISOString() und nie mit "minus 4 Stunden in Millisekunden": Am Tag der Zeitumstellung waere 4:00 sonst nicht
// 4 Stunden nach Mitternacht.
//
//   import { tagSchluessel, wochenSchluessel, zufallAus } from './tag.js';
//   tagSchluessel(new Date())            // '2026-10-17' (vor 4:00 Uhr: der Vortag)
//   wochenSchluessel(new Date())         // '2026-10-12' (der Montag, an dem die Woche um 4:00 begann)
//   const z = zufallAus('2026-10-17');   // z() -> [0, 1), fuer alle Geraete gleich
//
// API:
//   TAG_GRENZE_STUNDE = 4
//   tagSchluessel(datum = new Date()) -> 'JJJJ-MM-TT'      Tag mit Grenze 4:00 lokal. datum: Date oder ms
//   wochenSchluessel(datum = new Date()) -> 'JJJJ-MM-TT'   der Montag der Woche (Grenze Montag 4:00 lokal)
//   istSchluessel(text) -> boolean                         gueltiger Schluessel 'JJJJ-MM-TT' (echtes Datum)
//   addiereTage(schluessel, n) -> 'JJJJ-MM-TT'             Kalendertage dazu (n auch negativ)
//   tageZwischen(von, bis) -> ganze Zahl                   bis minus von in Kalendertagen (negativ, wenn bis
//                                                          frueher liegt, z. B. weil die Uhr zurueckgestellt wurde)
//   wochentag(schluessel) -> 0..6                          0 = Montag ... 6 = Sonntag
//   kalenderwoche(schluessel) -> { jahr, kw }              ISO-Kalenderwoche (wie "KW 2 · 2027" auf einem Siegel)
//   beginnVon(schluessel) -> Date                          Beginn des Tags (4:00 lokal) als Date
//   seedAus(wert) -> ganze Zahl 0..2^32-1                  Zahl bleibt (auf 32 Bit), Text wird gehasht (FNV-1a)
//   zufallAus(seed) -> () => Zahl in [0, 1)                mulberry32; gleicher Seed, gleiche Folge, auf jedem
//                                                          Geraet. seed: Zahl oder Text (z. B. ein Tagesschluessel)
//
// Uhr springt zurueck (Hand-Einstellung, Zeitzone): Die Schluessel sind dann frueher als der zuletzt gemerkte.
// Wer zaehlt (Serie, Tagesbogen), vergleicht mit tageZwischen und zaehlt bei Werten <= 0 nichts neu.
// Kein Math.random in dieser Datei (Fairness-Regel 1: Zufall nur fuer Inhalte, aus dem Datum, fuer alle gleich).

export const TAG_GRENZE_STUNDE = 4;

const SCHLUESSEL_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const zwei = (n) => String(n).padStart(2, '0');

function alsDatum(datum) {
  if (datum instanceof Date) return datum;
  if (typeof datum === 'number' && Number.isFinite(datum)) return new Date(datum);
  if (datum == null) return new Date();
  throw new TypeError('Datum erwartet (Date oder Millisekunden)');
}

// Kalendertag (lokal) als Schluessel, ohne Grenze
function kalenderSchluessel(j, m, t) {
  // ueber 12:00 normieren: Monatsueberlauf und Zeitumstellung (nie um Mittag) sind so harmlos
  const d = new Date(j, m, t, 12, 0, 0, 0);
  return `${d.getFullYear()}-${zwei(d.getMonth() + 1)}-${zwei(d.getDate())}`;
}

function teile(schluessel) {
  const m = typeof schluessel === 'string' ? schluessel.match(SCHLUESSEL_RE) : null;
  if (!m) throw new TypeError('Ungültiger Tagesschlüssel: ' + String(schluessel));
  const j = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const t = Number(m[3]);
  if (kalenderSchluessel(j, mo, t) !== schluessel) throw new TypeError('Ungültiger Tagesschlüssel: ' + schluessel);
  return [j, mo, t];
}

export function istSchluessel(text) {
  try { teile(text); return true; } catch (e) { return false; }
}

export function tagSchluessel(datum = new Date()) {
  const d = alsDatum(datum);
  if (Number.isNaN(d.getTime())) throw new TypeError('Ungültiges Datum');
  // Wanduhr: vor 4:00 gehoert die Zeit zum Vortag (auch in der doppelten Stunde am Ende der Sommerzeit)
  const vortag = d.getHours() < TAG_GRENZE_STUNDE ? 1 : 0;
  return kalenderSchluessel(d.getFullYear(), d.getMonth(), d.getDate() - vortag);
}

export function wochentag(schluessel) {
  const [j, m, t] = teile(schluessel);
  return (new Date(j, m, t, 12).getDay() + 6) % 7;
}

export function addiereTage(schluessel, n) {
  const [j, m, t] = teile(schluessel);
  if (!Number.isInteger(n)) throw new TypeError('addiereTage: n muss eine ganze Zahl sein');
  return kalenderSchluessel(j, m, t + n);
}

export function wochenSchluessel(datum = new Date()) {
  const tag = tagSchluessel(datum);
  return addiereTage(tag, -wochentag(tag));
}

// Kalendertage zwischen zwei Schluesseln (ueber UTC gerechnet, damit Zeitumstellungen nicht zaehlen)
export function tageZwischen(von, bis) {
  const [j1, m1, t1] = teile(von);
  const [j2, m2, t2] = teile(bis);
  return Math.round((Date.UTC(j2, m2, t2) - Date.UTC(j1, m1, t1)) / 86400000);
}

// ISO-Kalenderwoche: die Woche mit dem ersten Donnerstag des Jahres ist KW 1
export function kalenderwoche(schluessel) {
  const montag = addiereTage(schluessel, -wochentag(schluessel));
  const donnerstag = addiereTage(montag, 3);
  const [jahr] = teile(donnerstag);
  const ersterJan = `${jahr}-01-01`;
  return { jahr, kw: Math.floor(tageZwischen(ersterJan, donnerstag) / 7) + 1 };
}

export function beginnVon(schluessel) {
  const [j, m, t] = teile(schluessel);
  return new Date(j, m, t, TAG_GRENZE_STUNDE, 0, 0, 0);
}

// ---------------------------------------------------------------------------
// Zufall aus einem Seed (mulberry32): fuer Inhalte, die fuer alle gleich sein sollen (Tagesraetsel aus dem
// Datum) und fuer pruefbare Bot-Zuege (Seed im Partie-Datensatz).
// ---------------------------------------------------------------------------
export function seedAus(wert) {
  if (typeof wert === 'number' && Number.isFinite(wert)) return Math.floor(Math.abs(wert)) >>> 0;
  if (typeof wert !== 'string') throw new TypeError('Seed muss eine Zahl oder ein Text sein');
  let h = 2166136261;
  for (let i = 0; i < wert.length; i++) {
    h ^= wert.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function zufallAus(seed) {
  let a = seedAus(seed);
  return function zufall() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
