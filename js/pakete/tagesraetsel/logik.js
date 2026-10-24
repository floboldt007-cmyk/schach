// Paket "tagesraetsel" (Welle C, S1-5): reine Logik des Tagesraetsels. Rein, ohne DOM, in Node testbar, kein
// Math.random und keine Uhr (Fairness-Test: Liste REIN). Tage kommen immer als Tagesschluessel aus js/tag.js (Grenze
// 4:00 lokal), nie aus toISOString.
//
// Die Raetsel stehen in daten/tagesraetsel/raetsel.json (art 'tagesraetsel', format 1), gebaut von
// werkzeuge/raetsel-fabrik.mjs: eigene Raetsel aus Partien der Engine gegen sich selbst und eigenen Lehr-Stellungen,
// jedes mit Stockfish geprueft. Keine fremden Raetsel (keine Datenbanken anderer Seiten, keine Buecher).
//   { kopf, quelle, start: 'JJJJ-MM-TT' (ein Montag), tage: [ { aufgaben: [Aufgabe] } ] }
//   Aufgabe der Datei: { id, fen, loesung: [uci, ...], motiv, stufe: 1..7, matt: n | null, titel }
//   Tag k gehoert zum Datum start + k. Fuer alle gleich: das Raetsel kommt nur aus dem Datum. Nach dem letzten Tag
//   geht es in ganzen Wochen von vorn weiter (Wochenkurve bleibt), die Nummer zaehlt weiter.
//
//   pruefeDatei(json) -> [Fehlertext]              fuer registriereInhaltsart('tagesraetsel', ...)
//   tagDaten(daten, tag) -> { nummer, tag, wochentag, aufgaben: [Aufgabe] } | null   null vor dem Start
//   alsAufgaben(td, { nur }) -> [Aufgabe fuer den Raetsel-Bildschirm] (ohne eigenen Titel: der Bildschirm zeigt "Finde den
//       besten Zug" und die Seite am Zug selbst; Text "Teil 1 von 2 · Rätsel 7 · Sonntag · Matt in 1")
//   ersteOffene(modul, td) -> Index der ersten offenen Aufgabe (fertig: 0), fuer Karte und Heute-Zeile
//   archivTage(daten, heute, modul) -> [tagDaten]  die letzten ARCHIV_TAGE Tage vor heute, juengste zuerst, nur offene
//   Modul (Speicher "tagesraetsel", Budget BUDGET Zeichen):
//     { v: RECHENSTAND, tage: { 'JJJJ-MM-TT': { e: [[fehlversuche, richtig 0|1] | null, ...], w?: 0|1, a?: 1 } } }
//     e je Aufgabe des Tages (das erste Ergebnis zaehlt), w = "Ein Wort" richtig (1) oder falsch (0), a = im Archiv
//     geloest (zaehlt nicht als Tagesraetsel des Tages). Hoechstens MAX_TAGE Tage, die aeltesten fallen weg.
//   normalisiereModul(m) -> Modul   kaputte oder fremde Daten -> leeres Modul, falsche Eintraege fallen weg
//   merkeErgebnis(modul, tag, index, { fehlversuche, richtig }, { archiv }) -> { modul, neu }   neu: false, wenn
//     schon ein Ergebnis da war (dann bleibt das Modul gleich)
//   merkeWort(modul, tag, richtig) -> modul
//   tagStand(modul, tag, anzahl) -> { fertig, geloest, archiv, wort }
//   wortWahl(aufgabe, alle) -> [motiv, motiv, motiv] | null   drei Woerter, eines richtig, Reihenfolge aus der id; die
//       falschen sind Motive, die KEINE Aufgabe des Tages hat (Sonntag: beide Teile)
//   teilText(td, eintrag) -> Text zum Teilen, ohne Link und ohne Loesung (SPIELKONZEPT 3.6)
// Texte: t('p-tagesraetsel.x') aus texte.js, in der Sprache der App (ohne gesetzte Sprache, z. B. in Node, deutsch).
//   WOCHENTAG und MOTIVE bleiben deutsche Daten; angezeigt werden sie ueber wochentagName(i) und motivName(k).
//   Die Fehlertexte von pruefeDatei sind fuer Entwickler (Konsole) und bleiben deutsch.
import { addiereTage, tageZwischen, wochentag, istSchluessel } from '../../tag.js';
import { t } from '../../sprache.js';
import './texte.js';

export const PAKET = 'tagesraetsel';
export const MODUL = 'tagesraetsel';
export const DATEI = 'tagesraetsel/raetsel';
export const ART = 'tagesraetsel';
export const RECHENSTAND = 1;
export const BUDGET = 4000;
export const ARCHIV_TAGE = 30;
export const MAX_TAGE = 60;
export const STUFEN = 7;
export const WOCHENTAG = Object.freeze(['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag']);
export const MOTIVE = Object.freeze({
  gabel: 'Gabel', fesselung: 'Fesselung', spiess: 'Spieß', abzug: 'Abzug', grundreihe: 'Grundreihe', matt: 'Matt',
});
// Namen zum Anzeigen (Sprache der App)
export const wochentagName = (i) => t('p-tagesraetsel.wochentag.' + i);
export const motivName = (k) => (Object.hasOwn(MOTIVE, k) ? t('p-tagesraetsel.motiv.' + k) : '');
const UCI_RE = /^[a-h][1-8][a-h][1-8][qrbn]?$/;
const FIGUR = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };

const ganz = (x, min, max) => Number.isInteger(x) && x >= min && x <= max;

// ---------- Datei ----------
function aufgabeFehler(a, wo) {
  if (!a || typeof a !== 'object') return [wo + ': keine Aufgabe'];
  const f = [];
  if (typeof a.id !== 'string' || !/^[a-z0-9-]{1,40}$/.test(a.id)) f.push(wo + ': id fehlt oder ungültig');
  if (typeof a.fen !== 'string' || a.fen.split(/\s+/).length < 4) f.push(wo + ': fen fehlt');
  if (!Array.isArray(a.loesung) || !a.loesung.length || a.loesung.length > 7 || a.loesung.length % 2 === 0
    || !a.loesung.every((u) => typeof u === 'string' && UCI_RE.test(u))) f.push(wo + ': loesung ungültig');
  if (a.motiv != null && !Object.hasOwn(MOTIVE, a.motiv)) f.push(wo + ': motiv unbekannt');
  if (!ganz(a.stufe, 1, STUFEN)) f.push(wo + ': stufe nicht 1 bis 7');
  if (a.matt != null && !ganz(a.matt, 1, 4)) f.push(wo + ': matt ungültig');
  return f;
}

export function pruefeDatei(json) {
  const f = [];
  if (!json || typeof json !== 'object') return ['keine Daten'];
  if (!istSchluessel(json.start) || wochentag(json.start) !== 0) f.push('start ist kein Montag (JJJJ-MM-TT)');
  if (!Array.isArray(json.tage) || json.tage.length < 7) return [...f, 'tage fehlt oder kürzer als eine Woche'];
  const ids = new Set();
  json.tage.forEach((t, k) => {
    const l = t && Array.isArray(t.aufgaben) ? t.aufgaben : null;
    if (!l || !l.length || l.length > 2) { f.push(`Tag ${k}: 1 oder 2 Aufgaben`); return; }
    l.forEach((a, i) => {
      f.push(...aufgabeFehler(a, `Tag ${k}.${i}`));
      if (a && ids.has(a.id)) f.push(`Tag ${k}.${i}: id doppelt`);
      if (a) ids.add(a.id);
    });
  });
  return f.slice(0, 20);
}

// Tag k der Datei fuer ein Datum (nach dem Ende in ganzen Wochen von vorn)
export function tagIndex(daten, tag) {
  if (!daten || !Array.isArray(daten.tage) || !istSchluessel(daten.start) || !istSchluessel(tag)) return null;
  const k = tageZwischen(daten.start, tag);
  if (k < 0) return null;
  if (k < daten.tage.length) return k;
  const wochen = Math.floor(daten.tage.length / 7) * 7;
  return wochen ? k % wochen : null;
}

export function tagDaten(daten, tag) {
  const i = tagIndex(daten, tag);
  if (i == null) return null;
  const roh = daten.tage[i];
  const aufgaben = roh && Array.isArray(roh.aufgaben) ? roh.aufgaben.filter((a) => !aufgabeFehler(a, '').length) : [];
  if (!aufgaben.length) return null;
  return { nummer: tageZwischen(daten.start, tag) + 1, tag, wochentag: wochentag(tag), aufgaben };
}

const amZug = (fen) => (String(fen).split(/\s+/)[1] === 'b' ? 'b' : 'w');
export const amZugText = (fen) => (amZug(fen) === 'b' ? t('allgemein.schwarzAmZug') : t('allgemein.weissAmZug'));

export function zuegeText(a) {
  const n = Math.ceil(a.loesung.length / 2);
  if (a.matt) return t('p-tagesraetsel.matt', { n: a.matt });
  return t('p-tagesraetsel.zuege', { n });
}

// Aufgaben fuer den Raetsel-Bildschirm; die id traegt den Tag, damit Archiv und heute nie durcheinander kommen
export function alsAufgaben(td, { nur = null } = {}) {
  if (!td) return [];
  const zwei = td.aufgaben.length > 1;
  return td.aufgaben.map((a, i) => ({ a, i })).filter(({ i }) => !nur || nur.includes(i)).map(({ a, i }) => ({
    id: `${td.tag}:${i}`,
    fen: a.fen,
    loesung: a.loesung.slice(),
    text: t(zwei ? 'p-tagesraetsel.aufgabe.textTeil' : 'p-tagesraetsel.aufgabe.text',
      { teil: i + 1, nummer: td.nummer, tag: wochentagName(td.wochentag), zuege: zuegeText(a) }),
    hinweis: a.matt ? t('p-tagesraetsel.hinweis.matt', { n: a.matt }) : t('p-tagesraetsel.hinweis.zwang'),
  }));
}

// "2026-10-26:1" -> { tag, index }
export function teileId(id) {
  const m = /^(\d{4}-\d{2}-\d{2}):(\d)$/.exec(String(id || ''));
  if (!m || !istSchluessel(m[1])) return null;
  return { tag: m[1], index: Number(m[2]) };
}

// ---------- Modul ----------
export function leeresModul() {
  return { v: RECHENSTAND, tage: {} };
}

function eintragOk(e) {
  if (!e || typeof e !== 'object' || !Array.isArray(e.e) || e.e.length > 2) return null;
  const ergebnisse = e.e.map((x) => (Array.isArray(x) && ganz(x[0], 0, 99) && (x[1] === 0 || x[1] === 1) ? [x[0], x[1]] : null));
  const r = { e: ergebnisse };
  if (e.w === 0 || e.w === 1) r.w = e.w;
  if (e.a === 1) r.a = 1;
  return r;
}

export function normalisiereModul(m) {
  const leer = leeresModul();
  if (!m || typeof m !== 'object' || !m.tage || typeof m.tage !== 'object' || Array.isArray(m.tage)) return leer;
  const tage = {};
  for (const tag of Object.keys(m.tage).filter(istSchluessel).sort().slice(-MAX_TAGE)) {
    const e = eintragOk(m.tage[tag]);
    if (e) tage[tag] = e;
  }
  return { v: Number.isInteger(m.v) ? m.v : RECHENSTAND, tage };
}

function mitTag(modul, tag, aendere) {
  const m = normalisiereModul(modul);
  const alt = m.tage[tag] || { e: [] };
  const neu = aendere({ ...alt, e: alt.e.slice() });
  const tage = { ...m.tage, [tag]: neu };
  const behalten = Object.keys(tage).sort().slice(-MAX_TAGE);
  return { ...m, tage: Object.fromEntries(behalten.map((t) => [t, tage[t]])) };
}

export function merkeErgebnis(modul, tag, index, { fehlversuche = 0, richtig = false } = {}, { archiv = false } = {}) {
  const m = normalisiereModul(modul);
  if (!istSchluessel(tag) || !ganz(index, 0, 1)) return { modul: m, neu: false };
  const alt = m.tage[tag];
  if (alt && alt.e[index]) return { modul: m, neu: false };
  const f = ganz(fehlversuche, 0, 99) ? fehlversuche : 0;
  return {
    modul: mitTag(m, tag, (e) => {
      while (e.e.length < index) e.e.push(null);
      e.e[index] = [f, richtig ? 1 : 0];
      // Archiv nur, wenn der Tag nicht schon am eigenen Tag angefangen wurde
      if (archiv && !alt) e.a = 1;
      return e;
    }),
    neu: true,
  };
}

export function merkeWort(modul, tag, richtig) {
  const m = normalisiereModul(modul);
  if (!istSchluessel(tag) || (m.tage[tag] && m.tage[tag].w != null)) return m;
  return mitTag(m, tag, (e) => ({ ...e, w: richtig ? 1 : 0 }));
}

export function tagStand(modul, tag, anzahl = 1) {
  const e = normalisiereModul(modul).tage[tag];
  const ergebnisse = e ? e.e : [];
  const fertig = anzahl > 0 && ergebnisse.length >= anzahl && ergebnisse.slice(0, anzahl).every(Boolean);
  return {
    fertig,
    geloest: fertig && ergebnisse.slice(0, anzahl).every((x) => x[1] === 1),
    archiv: !!(e && e.a),
    wort: e && e.w != null ? e.w : null,
    ergebnisse: ergebnisse.slice(),
  };
}

// offene Aufgaben eines Tages (Indizes); alle, wenn der Tag fertig ist (dann darf man ihn wiederholen)
export function offeneIndizes(modul, td) {
  if (!td) return [];
  const st = tagStand(modul, td.tag, td.aufgaben.length);
  const alle = td.aufgaben.map((_, i) => i);
  return st.fertig ? alle : alle.filter((i) => !st.ergebnisse[i]);
}

export function ersteOffene(modul, td) {
  const l = offeneIndizes(modul, td);
  return l.length ? l[0] : 0;
}

export function archivTage(daten, heute, modul) {
  const l = [];
  for (let n = 1; n <= ARCHIV_TAGE; n++) {
    const tag = addiereTage(heute, -n);
    const td = tagDaten(daten, tag);
    if (!td) break;
    if (!tagStand(modul, tag, td.aufgaben.length).fertig) l.push(td);
  }
  return l;
}

// ---------- Ein Wort ----------
// kleiner fester Hash (FNV-1a), damit die Reihenfolge fuer alle gleich ist und ohne Math.random auskommt
function hash(text) {
  let h = 0x811c9dc5;
  for (const c of String(text)) {
    h ^= c.codePointAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function wortWahl(a, alle = [a]) {
  if (!a || !a.motiv || !Object.hasOwn(MOTIVE, a.motiv)) return null;
  // Falsche Woerter: Motive, die keine Aufgabe des Tages hat. "Matt" ist bei einem Matt-Raetsel nie falsch,
  // "Grundreihe" endet immer im Matt. Es bleiben immer mindestens zwei (sechs Motive, hoechstens vier gesperrt).
  const liste = (Array.isArray(alle) ? alle : [a]).filter(Boolean);
  const verboten = new Set([a.motiv, ...liste.map((x) => x.motiv).filter(Boolean)]);
  if (liste.some((x) => x.matt || x.motiv === 'grundreihe' || x.motiv === 'matt')) { verboten.add('matt'); verboten.add('grundreihe'); }
  const falsch = Object.keys(MOTIVE).filter((k) => !verboten.has(k));
  const h = hash(a.id);
  const erst = falsch[h % falsch.length];
  const rest = falsch.filter((k) => k !== erst);
  const zweit = rest[(h >>> 8) % rest.length];
  const drei = [a.motiv, erst, zweit];
  const p = (h >>> 16) % 3;
  return [drei[p], drei[(p + 1) % 3], drei[(p + 2) % 3]];
}

export const motivAufgabe = (td) => (td ? td.aufgaben.find((a) => a.motiv) || null : null);

// ---------- Teilen (SPIELKONZEPT 3.6, ohne Link und ohne Loesung) ----------
// Zeile 1: Name, Nummer, Wochentag und Schwierigkeit als sieben Punkte. Zeile 2: Figur des ersten eigenen Zugs und
// Laenge, dann je Aufgabe ein Kaestchen je Fehlversuch und ein volles fuer das Loesen (x: Loesung angesehen), am Ende
// das Motiv, wenn "Ein Wort" stimmte.
export function figurDesErstenZugs(a) {
  const feld = a.loesung[0].slice(0, 2);
  const reihen = String(a.fen).split(/\s+/)[0].split('/');
  const r = reihen[8 - Number(feld[1])] || '';
  let f = 0;
  for (const z of r) {
    if (/[1-8]/.test(z)) f += Number(z);
    else {
      if ('abcdefgh'[f] === feld[0]) return z.toLowerCase();
      f++;
    }
  }
  return null;
}

export function punkte(stufe) {
  const s = ganz(stufe, 1, STUFEN) ? stufe : 1;
  return '●'.repeat(s) + '○'.repeat(STUFEN - s);
}

export function kaestchen(ergebnis) {
  if (!ergebnis) return '';
  const [f, richtig] = ergebnis;
  return '□'.repeat(Math.min(f, 5)) + (richtig ? '■' : '✕');
}

export function teilText(td, eintrag = null) {
  if (!td) return '';
  const a = td.aufgaben[0];
  const stufe = Math.max(...td.aufgaben.map((x) => x.stufe));
  const fig = FIGUR[figurDesErstenZugs(a)] || '';
  const ergebnisse = eintrag && Array.isArray(eintrag.ergebnisse) ? eintrag.ergebnisse : [];
  const kaesten = td.aufgaben.map((_, i) => kaestchen(ergebnisse[i])).filter(Boolean).join(' ');
  const m = motivAufgabe(td);
  const teile = [`${fig ? fig + ' ' : ''}${zuegeText(a)}`];
  if (td.aufgaben.length > 1) teile[0] += ' · ' + t('p-tagesraetsel.teilen.zweiTeile');
  if (kaesten) teile.push(kaesten);
  if (m && eintrag && eintrag.wort === 1) teile.push(t('p-tagesraetsel.teilen.motiv', { motiv: motivName(m.motiv) }));
  const kopf = t('p-tagesraetsel.teilen.kopf', { nummer: td.nummer, tag: wochentagName(td.wochentag), punkte: punkte(stufe) });
  return `${kopf}\n${teile.join(' · ')}`;
}

// ---------- Texte ----------
export function rueckmeldung({ richtig, fehlversuche }) {
  if (!richtig) return { titel: t('p-tagesraetsel.rueck.gezeigt'), text: t('p-tagesraetsel.rueck.kostenlos') };
  if (!fehlversuche) return { titel: t('p-tagesraetsel.rueck.ersterVersuch'), text: '' };
  return { titel: t('p-tagesraetsel.rueck.geloest'), text: t('p-tagesraetsel.rueck.kostenlos') };
}

export function endeText({ archiv = false, anzahl = 0, td = null } = {}) {
  if (archiv) {
    return { titel: t('p-tagesraetsel.ende.archiv', { n: anzahl }), text: t('p-tagesraetsel.ende.archivText') };
  }
  return { titel: td ? t('p-tagesraetsel.ende.titel', { nummer: td.nummer }) : t('p-tagesraetsel.ende.geschafft'), text: t('p-tagesraetsel.ende.text') };
}
