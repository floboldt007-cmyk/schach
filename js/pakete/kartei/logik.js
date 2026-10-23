// Paket "kartei" (Welle A, A3): reine Logik der Fehler-Kartei. Rein, ohne DOM, in Node testbar, kein Math.random
// (Fairness-Test: Liste REIN). Tage kommen immer als Tagesschluessel aus js/tag.js (Grenze 4:00 lokal), nie aus
// toISOString.
//
// Karten entstehen aus der Spielanalyse einer Partie (Ereignis partie:analysiert, Review aus js/review.js):
//   kandidaten(review, partie) -> [Entwurf]   eigene Zuege der Klassen Patzer ("Weit daneben"), Verschenkt (verpasst)
//       und Fehler ("Daneben") mit eindeutiger Loesung: Gewinnchance vorher (beim besten Zug) mindestens MIN_GEWINN und
//       der zweitbeste Zug mindestens MIN_ABSTAND schlechter (MultiPV 2 der Analyse). Hoechstens JE_PARTIE, die mit dem
//       groessten Verlust zuerst (gleich: Patzer vor Verschenkt vor Fehler, dann der fruehere Zug). Uebungen nie.
//   fuegeHinzu(modul, partie, review, heute) -> { modul, neu: [id], rueckfall: [id], doppelt }   idempotent je Partie
//       (verarbeitete IDs, hoechstens MAX_VERARBEITET). Gleiche Stellung (stellungsSchluessel) schon in der Kartei:
//       keine neue Karte, sondern rueckfaelle + 1 und wieder Stufe 0 (heute faellig), Inhalt aus der neuen Partie.
//
// Wiederholung (Stufen): 0 = neu (am Tag der Partie faellig, solange die Erinnerung frisch ist), 1..5 = Abstand
// ABSTAENDE[stufe - 1] Tage (1, 3, 7, 14, 30), GELOEST (6) = fuer immer geloest.
//   beantworte(modul, id, { richtig, versuch, heute }) -> { modul, karte, info } | null
//       Nur der erste Versuch zaehlt als richtig: Stufe + 1 (nach Stufe 5, also 30 Tagen: fuer immer geloest).
//       Alles andere (zweiter Versuch, Loesung gezeigt) zurueck auf Stufe 1, wieder morgen.
//   faellige(modul, heute) -> [Karte]   der Stapel des Tages: faellige Karten, aelteste zuerst, hoechstens TAGES_MAX
//       je Tag (SPIELKONZEPT 2.2; heute schon beantwortete zaehlen mit). Ueberhang bleibt still faellig und kommt an
//       den Folgetagen dran: nichts verfaellt, keine rote Zahl.
//   stand(modul, heute) -> { faellig, gesamt, gemeistert }   (Ereignis training:stand)
//   naechsterTag(modul, heute) -> heute (noch Karten im Stapel), morgen (Deckel erreicht) oder der naechste Tag mit
//       einer faelligen Karte | null (keine Karte im Training)
//   duenneAus(modul, budget) -> modul   ueber MAX_KARTEN Karten oder ueber dem Budget fallen zuerst die aeltesten
//       fuer immer geloesten (ihr Zaehler bleibt), dann die aeltesten der Stufe 5, dann die aeltesten ueberhaupt
//   normalisiereModul(m) -> Modul      kaputte oder fremde Daten -> leeres Modul, falsche Karten fallen weg
//   alsAufgabe(karte, { botName, heute }) -> Aufgabe fuer den Raetsel-Bildschirm (js/ui/raetsel.js)
//   rueckmeldung(info), endeText(ergebnisse), neueKartenText(n), stapelText(...)   Texte
//
// Modul (Speicher "kartei", Budget 160.000 Zeichen): { v: RECHENSTAND, karten: [Karte], verarbeitet: [partieId],
//   heute: { tag, ids }, zaehler: { erstellt, gemeistert, richtig, falsch } }
// Karte: { id: 'partieId:ply', fen, besterZug, gespielt, klasse, partieId, ply, botId, farbe, vor (Zug davor oder
//   null), san (gespielter Zug, deutsch), loesungSan, nummer, coach, datum (Tag der Partie), gewinn, verlust,
//   stufe, faellig ('' wenn geloest), erstellt, geuebt, richtig, falsch, rueckfaelle }
import { stellungsSchluessel } from '../../openings.js';
import { sanDeutsch, coachKern } from '../../review.js';
import { KLASSEN_NAME } from '../../zugklassen.js';
import { istSchluessel, addiereTage, tageZwischen } from '../../tag.js';

export const PAKET = 'kartei';
export const MODUL = 'kartei';
// Rechenstand: zaehlt hoch, wenn Auswahlregel, Stufen oder Tagesdeckel sich aendern (im Modul als v gespeichert)
export const RECHENSTAND = 1;
export const ABSTAENDE = Object.freeze([1, 3, 7, 14, 30]);
export const GELOEST = ABSTAENDE.length + 1;
export const TAGES_MAX = 10;
export const JE_PARTIE = 3;
// Reihenfolge bei gleichem Verlust: die schwerere Klasse zuerst
export const KLASSEN = Object.freeze(['patzer', 'verpasst', 'fehler']);
export const MIN_GEWINN = 0.25;
export const MIN_ABSTAND = 0.15;
export const MAX_KARTEN = 380;
export const MAX_VERARBEITET = 300;
export const COACH_MAX = 160;
export const BUDGET = 160000;

const UCI_RE = /^[a-h][1-8][a-h][1-8][qrbn]?$/;
const ID_RE = /^[A-Za-z0-9_-]{1,40}:\d{1,4}$/;
const FIGUR_AKK = { p: 'den Bauern', n: 'den Springer', b: 'den Läufer', r: 'den Turm', q: 'die Dame', k: 'den König' };
const MONATE = ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sept.', 'Okt.', 'Nov.', 'Dez.'];

export function leeresModul() {
  return { v: RECHENSTAND, karten: [], verarbeitet: [], heute: { tag: '', ids: [] }, zaehler: { erstellt: 0, gemeistert: 0, richtig: 0, falsch: 0 } };
}

const zahl = (x, std = 0) => (Number.isFinite(x) ? x : std);
const ganz = (x, min, max, std) => (Number.isInteger(x) && x >= min && x <= max ? x : std);
const text = (x, max) => (typeof x === 'string' ? x.slice(0, max) : '');

// Grobe Pruefung einer FEN (Brett mit 8 Reihen, Zugrecht); die volle Pruefung macht chess.js im Raetsel-Bildschirm
export function fenOk(fen) {
  if (typeof fen !== 'string' || fen.length > 100) return false;
  const t = fen.trim().split(/\s+/);
  if (t.length < 2 || !/^[wb]$/.test(t[1])) return false;
  const reihen = t[0].split('/');
  if (reihen.length !== 8) return false;
  return reihen.every((r) => {
    let n = 0;
    for (const z of r) {
      if (/[1-8]/.test(z)) n += Number(z);
      else if (/[pnbrqkPNBRQK]/.test(z)) n += 1;
      else return false;
    }
    return n === 8;
  });
}

// Figur auf einem Feld der FEN ('wN', 'bQ' ...) oder null
export function figurAuf(fen, feld) {
  if (!fenOk(fen) || typeof feld !== 'string' || !/^[a-h][1-8]$/.test(feld)) return null;
  const reihe = fen.trim().split(/\s+/)[0].split('/')[8 - Number(feld[1])];
  const spalte = feld.charCodeAt(0) - 97;
  let n = 0;
  for (const z of reihe) {
    if (/[1-8]/.test(z)) n += Number(z);
    else {
      if (n === spalte) return (z === z.toUpperCase() ? 'w' : 'b') + z.toUpperCase();
      n += 1;
    }
    if (n > spalte) return null;
  }
  return null;
}

function normalisiereKarte(k) {
  if (!k || typeof k !== 'object' || typeof k.id !== 'string' || !ID_RE.test(k.id)) return null;
  if (!fenOk(k.fen) || typeof k.besterZug !== 'string' || !UCI_RE.test(k.besterZug)) return null;
  if (!KLASSEN.includes(k.klasse)) return null;
  const stufe = ganz(k.stufe, 0, GELOEST, 0);
  const faellig = stufe === GELOEST ? '' : (istSchluessel(k.faellig) ? k.faellig : (istSchluessel(k.erstellt) ? k.erstellt : null));
  if (faellig == null) return null;
  return {
    id: k.id,
    fen: k.fen,
    besterZug: k.besterZug,
    gespielt: typeof k.gespielt === 'string' && UCI_RE.test(k.gespielt) ? k.gespielt : '',
    klasse: k.klasse,
    partieId: text(k.partieId, 40),
    ply: ganz(k.ply, 0, 9999, 0),
    botId: text(k.botId, 40),
    farbe: k.farbe === 'b' ? 'b' : 'w',
    vor: typeof k.vor === 'string' && UCI_RE.test(k.vor) ? k.vor : null,
    san: text(k.san, 12),
    loesungSan: text(k.loesungSan, 12),
    nummer: ganz(k.nummer, 1, 9999, 1),
    coach: text(k.coach, COACH_MAX),
    datum: istSchluessel(k.datum) ? k.datum : '',
    gewinn: Math.max(0, Math.min(1, zahl(k.gewinn, 0))),
    verlust: Math.max(0, Math.min(1, zahl(k.verlust, 0))),
    stufe,
    faellig,
    erstellt: istSchluessel(k.erstellt) ? k.erstellt : faellig,
    geuebt: istSchluessel(k.geuebt) ? k.geuebt : '',
    richtig: ganz(k.richtig, 0, 1e6, 0),
    falsch: ganz(k.falsch, 0, 1e6, 0),
    rueckfaelle: ganz(k.rueckfaelle, 0, 1e6, 0),
  };
}

// Modul in Form bringen. Unbekanntes oder Kaputtes -> leeres Modul; ein hoeherer Rechenstand (neuere App) bleibt
// lesbar, wird aber nicht veraendert gespeichert (index.js prueft v).
export function normalisiereModul(m) {
  const leer = leeresModul();
  if (!m || typeof m !== 'object' || Array.isArray(m)) return leer;
  const karten = [];
  const ids = new Set();
  for (const k of Array.isArray(m.karten) ? m.karten : []) {
    const n = normalisiereKarte(k);
    if (n && !ids.has(n.id)) { ids.add(n.id); karten.push(n); }
  }
  const verarbeitet = (Array.isArray(m.verarbeitet) ? m.verarbeitet : []).filter((x) => typeof x === 'string' && x.length <= 40).slice(-MAX_VERARBEITET);
  const h = m.heute && typeof m.heute === 'object' ? m.heute : {};
  const heute = { tag: istSchluessel(h.tag) ? h.tag : '', ids: (Array.isArray(h.ids) ? h.ids : []).filter((x) => typeof x === 'string').slice(0, 50) };
  const z = m.zaehler && typeof m.zaehler === 'object' ? m.zaehler : {};
  const zaehler = {
    erstellt: ganz(z.erstellt, 0, 1e7, 0), gemeistert: ganz(z.gemeistert, 0, 1e7, 0),
    richtig: ganz(z.richtig, 0, 1e7, 0), falsch: ganz(z.falsch, 0, 1e7, 0),
  };
  const v = Number.isInteger(m.v) && m.v > 0 ? m.v : RECHENSTAND;
  return { v, karten, verarbeitet, heute, zaehler };
}

// ---------------------------------------------------------------------------
// Karten aus einer Spielanalyse
// ---------------------------------------------------------------------------
const RANG = { patzer: 0, verpasst: 1, fehler: 2 };

export function kandidaten(review, partie) {
  if (!review || !Array.isArray(review.zuege) || !partie || typeof partie !== 'object') return [];
  if ((partie.modus || 'normal') === 'uebung') return [];
  const farbe = partie.spielerFarbe === 'b' ? 'b' : 'w';
  const zuege = review.zuege;
  const liste = [];
  for (let i = 0; i < zuege.length; i++) {
    const z = zuege[i];
    if (!z || z.farbe !== farbe || !KLASSEN.includes(z.klasse)) continue;
    const ply = Number.isInteger(z.ply) ? z.ply : i;
    if (!fenOk(z.fenVorher) || typeof z.besterZug !== 'string' || !UCI_RE.test(z.besterZug) || z.besterZug === z.uci) continue;
    const vorher = zahl(z.gewinnVorher, NaN);
    const zweiter = zahl(z.gewinnZweiter, NaN);
    // eindeutige Loesung: ohne zweite Linie nicht belegbar
    if (!Number.isFinite(vorher) || !Number.isFinite(zweiter)) continue;
    if (vorher < MIN_GEWINN || vorher - zweiter < MIN_ABSTAND - 1e-9) continue;
    const vor = i > 0 && zuege[i - 1] && typeof zuege[i - 1].uci === 'string' && UCI_RE.test(zuege[i - 1].uci) ? zuege[i - 1].uci : null;
    const nummer = Number.isInteger(z.nummer) ? z.nummer : (Number(String(z.fenVorher).trim().split(/\s+/)[5]) || 1);
    liste.push({
      id: `${partie.id}:${ply}`,
      fen: z.fenVorher,
      besterZug: z.besterZug,
      gespielt: typeof z.uci === 'string' && UCI_RE.test(z.uci) ? z.uci : '',
      klasse: z.klasse,
      partieId: String(partie.id),
      ply,
      botId: String(partie.botId || ''),
      farbe,
      vor,
      san: z.sanDe || sanDeutsch(z.san || ''),
      loesungSan: z.besterZugSanDe || (z.besterZugSan ? sanDeutsch(z.besterZugSan) : ''),
      nummer,
      coach: coachKern(z.coach || '').slice(0, COACH_MAX),
      gewinn: Math.round(vorher * 1e4) / 1e4,
      verlust: Math.round(zahl(z.verlust, 0) * 1e4) / 1e4,
    });
  }
  liste.sort((a, b) => b.verlust - a.verlust || RANG[a.klasse] - RANG[b.klasse] || a.ply - b.ply);
  return liste.slice(0, JE_PARTIE);
}

// Tag der Partie aus ihrem Datum (ISO-Zeitpunkt) ueber die Tagesgrenze: tagVon(ms) kommt von aussen (tag.js
// tagSchluessel), damit diese Datei keine Uhr braucht
export function fuegeHinzu(modul, partie, review, heute, { tagVon = null } = {}) {
  const m = normalisiereModul(modul);
  const ergebnis = { modul: m, neu: [], rueckfall: [], doppelt: false };
  if (!partie || typeof partie.id !== 'string' || !istSchluessel(heute)) return ergebnis;
  if (m.verarbeitet.includes(partie.id)) { ergebnis.doppelt = true; return ergebnis; }
  let datum = '';
  try {
    const t = tagVon && partie.datum ? tagVon(Date.parse(partie.datum)) : '';
    datum = istSchluessel(t) ? t : '';
  } catch (e) { datum = ''; }
  for (const e of kandidaten(review, partie)) {
    if (m.karten.some((k) => k.id === e.id)) continue;
    const schluessel = stellungsSchluessel(e.fen);
    const alt = m.karten.find((k) => stellungsSchluessel(k.fen) === schluessel);
    if (alt) {
      // dieselbe Stellung, derselbe Fehler noch einmal: zurueck an den Anfang, mit dem Bild der neuen Partie
      Object.assign(alt, { ...e, id: alt.id, datum: datum || alt.datum, stufe: 0, faellig: heute, rueckfaelle: alt.rueckfaelle + 1 });
      ergebnis.rueckfall.push(alt.id);
      continue;
    }
    m.karten.push({ ...e, datum, stufe: 0, faellig: heute, erstellt: heute, geuebt: '', richtig: 0, falsch: 0, rueckfaelle: 0 });
    m.zaehler.erstellt += 1;
    ergebnis.neu.push(e.id);
  }
  m.verarbeitet = [...m.verarbeitet, partie.id].slice(-MAX_VERARBEITET);
  ergebnis.modul = duenneAus(m);
  return ergebnis;
}

// ---------------------------------------------------------------------------
// Stapel des Tages
// ---------------------------------------------------------------------------
function heuteIds(m, heute) {
  return m.heute && m.heute.tag === heute ? m.heute.ids : [];
}

export function geuebtHeute(modul, heute) {
  return heuteIds(normalisiereModul(modul), heute).length;
}

function vergleich(a, b) {
  return (a.faellig < b.faellig ? -1 : a.faellig > b.faellig ? 1 : 0) || a.stufe - b.stufe
    || (a.erstellt < b.erstellt ? -1 : a.erstellt > b.erstellt ? 1 : 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

export function faellige(modul, heute) {
  const m = normalisiereModul(modul);
  if (!istSchluessel(heute)) return [];
  const schon = new Set(heuteIds(m, heute));
  const frei = Math.max(0, TAGES_MAX - schon.size);
  return m.karten
    .filter((k) => k.stufe < GELOEST && k.faellig && k.faellig <= heute && !schon.has(k.id))
    .sort(vergleich)
    .slice(0, frei);
}

export function stand(modul, heute) {
  const m = normalisiereModul(modul);
  return {
    faellig: faellige(m, heute).length,
    gesamt: m.karten.filter((k) => k.stufe < GELOEST).length,
    gemeistert: m.zaehler.gemeistert,
  };
}

export function naechsterTag(modul, heute) {
  const m = normalisiereModul(modul);
  const aktiv = m.karten.filter((k) => k.stufe < GELOEST && k.faellig);
  if (!aktiv.length || !istSchluessel(heute)) return null;
  if (faellige(m, heute).length) return heute;
  // faellige ohne Platz im heutigen Stapel (Deckel erreicht) kommen morgen dran
  if (aktiv.some((k) => k.faellig <= heute)) return addiereTage(heute, 1);
  return aktiv.map((k) => k.faellig).sort()[0];
}

// ---------------------------------------------------------------------------
// Antwort
// ---------------------------------------------------------------------------
export function beantworte(modul, id, { richtig = false, versuch = 1, heute } = {}) {
  const m = normalisiereModul(modul);
  if (!istSchluessel(heute)) return null;
  const k = m.karten.find((x) => x.id === id);
  if (!k) return null;
  const vorher = k.stufe;
  const ersterVersuch = !!richtig && versuch === 1;
  let stufe;
  if (ersterVersuch) stufe = Math.min(GELOEST, vorher + 1);
  else stufe = 1;
  // eine schon geloeste Karte (z. B. aus einem alten Stapel) bleibt geloest, wenn sie wieder stimmt
  if (vorher === GELOEST && ersterVersuch) stufe = GELOEST;
  const gemeistert = stufe === GELOEST && vorher !== GELOEST;
  k.stufe = stufe;
  k.faellig = stufe === GELOEST ? '' : addiereTage(heute, ABSTAENDE[stufe - 1]);
  k.geuebt = heute;
  if (richtig) k.richtig += 1;
  else k.falsch += 1;
  if (ersterVersuch) m.zaehler.richtig += 1;
  else m.zaehler.falsch += 1;
  if (gemeistert) m.zaehler.gemeistert += 1;
  const ids = heuteIds(m, heute).filter((x) => x !== id);
  m.heute = { tag: heute, ids: [...ids, id].slice(-50) };
  const tage = k.faellig ? tageZwischen(heute, k.faellig) : null;
  return { modul: m, karte: { ...k }, info: { vorher, stufe, faellig: k.faellig, tage, gemeistert, richtig: !!richtig, versuch, ersterVersuch } };
}

// ---------------------------------------------------------------------------
// Ausduennen (Budget des Moduls)
// ---------------------------------------------------------------------------
export function duenneAus(modul, budget = BUDGET) {
  const m = modul;
  const laenge = (x) => JSON.stringify(x).length + 1;
  let gesamt = JSON.stringify({ ...m, karten: [] }).length;
  const groessen = new Map(m.karten.map((k) => [k, laenge(k)]));
  for (const g of groessen.values()) gesamt += g;
  const grenze = Math.floor(budget * 0.97);
  const aelter = (a, b) => (a.erstellt < b.erstellt ? -1 : a.erstellt > b.erstellt ? 1 : 0) || (a.id < b.id ? -1 : 1);
  while (m.karten.length && (m.karten.length > MAX_KARTEN || gesamt > grenze)) {
    const geloest = m.karten.filter((k) => k.stufe === GELOEST).sort((a, b) => (a.geuebt < b.geuebt ? -1 : a.geuebt > b.geuebt ? 1 : 0) || aelter(a, b));
    const fuenf = m.karten.filter((k) => k.stufe === GELOEST - 1).sort(aelter);
    const opfer = geloest[0] || fuenf[0] || [...m.karten].sort(aelter)[0];
    m.karten = m.karten.filter((k) => k !== opfer);
    gesamt -= groessen.get(opfer) || 0;
  }
  return m;
}

// ---------------------------------------------------------------------------
// Texte (Deutsch, freundlich, ohne Druck)
// ---------------------------------------------------------------------------
export function datumText(tag, heute) {
  if (!istSchluessel(tag) || !istSchluessel(heute)) return '';
  const d = tageZwischen(tag, heute);
  if (d === 0) return 'Heute';
  if (d === 1) return 'Gestern';
  const [, mo, t] = tag.split('-').map(Number);
  return `Am ${t}. ${MONATE[mo - 1]}`;
}

export function zugText(karte) {
  const san = karte.san || '';
  if (!san) return '';
  // geschuetzte Leerzeichen: "4. a3" bricht nie zwischen Nummer und Zug um
  return karte.farbe === 'b' ? `${karte.nummer}.\u00a0…\u00a0${san}` : `${karte.nummer}.\u00a0${san}`;
}

export function abstandText(tage) {
  if (tage == null) return '';
  if (tage <= 1) return 'morgen';
  return `in ${tage} Tagen`;
}

export function alsAufgabe(karte, { botName = '', heute = '' } = {}) {
  const k = normalisiereKarte(karte);
  if (!k) return null;
  const wann = datumText(k.datum, heute);
  const gegen = botName ? `gegen ${botName}` : '';
  const zug = zugText(k);
  let satz = '';
  if (zug) satz = `${[wann, gegen].filter(Boolean).join(' ')}${wann || gegen ? ' ' : ''}hast du hier ${zug} gespielt.`;
  satz = satz ? satz.charAt(0).toUpperCase() + satz.slice(1) : 'Hier ging in deiner Partie etwas daneben.';
  const von = k.besterZug.slice(0, 2);
  const figur = figurAuf(k.fen, von);
  const akk = figur ? FIGUR_AKK[figur[1].toLowerCase()] : null;
  return {
    id: k.id,
    fen: k.fen,
    loesung: [k.besterZug],
    vorZug: k.vor,
    titel: 'Finde den besseren Zug',
    text: satz,
    hinweis: akk ? `Schau dir ${akk} auf ${von} an.` : `Schau dir die Figur auf ${von} an.`,
    erklaerung: k.coach || (k.loesungSan ? `Besser war ${k.loesungSan}.` : ''),
    marke: KLASSEN_NAME[k.klasse] || '',
    klasse: k.klasse,
  };
}

// Rueckmeldung nach einer Antwort (info aus beantworte) -> { titel, text }
export function rueckmeldung(info) {
  if (!info) return { titel: '', text: '' };
  if (info.gemeistert) return { titel: 'Für immer gelöst!', text: 'Diese Stellung sitzt. Die Karte kommt nicht mehr wieder.' };
  const wann = abstandText(info.tage);
  if (info.ersterVersuch) return { titel: 'Richtig!', text: `Die Karte kommt ${wann} wieder.` };
  if (info.richtig) return { titel: 'Gelöst im zweiten Anlauf.', text: `Die Karte kommt ${wann} wieder.` };
  return { titel: 'So geht es', text: `Kein Problem. Die Karte kommt ${wann} wieder.` };
}

const karten = (n) => (n === 1 ? '1 Karte' : `${n} Karten`);

// Zusammenfassung einer Sitzung: ergebnisse [{ info }]
export function endeText(ergebnisse) {
  const liste = (ergebnisse || []).map((e) => e && e.info).filter(Boolean);
  const weiter = liste.filter((i) => i.ersterVersuch).length;
  const geloest = liste.filter((i) => i.gemeistert).length;
  const zurueck = liste.length - weiter;
  const teile = [];
  if (weiter) teile.push(`${karten(weiter)} weiter`);
  if (geloest) teile.push(`${geloest} für immer gelöst`);
  if (zurueck) teile.push(`${karten(zurueck)} ${zurueck === 1 ? 'kommt' : 'kommen'} morgen wieder`);
  return {
    titel: liste.length && weiter === liste.length ? 'Alles richtig' : 'Gut geübt',
    text: teile.length ? teile.join(', ') + '.' : 'Für heute ist der Stapel durch.',
  };
}

export function neueKartenText(n) {
  return n === 1 ? '1 neue Karte in deinem Stapel' : `${n} neue Karten in deinem Stapel`;
}

// Zeile fuer die Karte im Training und die Heute-Karte
export function stapelText(st) {
  return `Fehler wiederholen · ${st.faellig} fällig`;
}
