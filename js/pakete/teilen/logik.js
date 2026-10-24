// Paket "teilen" (Welle A, A1): Siegesbild. Reine Logik ohne DOM, in Node testbar (tests/teilen.test.mjs).
// Rechnet aus einer gespeicherten Partie die Daten des Bildes (nur eine feste Liste von Feldern, nie der ganze
// Datensatz: so kann nichts Persoenliches ins Bild rutschen), die Endstellung samt letztem Zug, die Lage aller
// Teile auf der Leinwand (1080 x 1350, Hochformat fuer Instagram und WhatsApp) und die Farben aus den Tokens des
// Themes (hell und dunkel, ohne den Modus der App umzuschalten).
//
//   RECHENSTAND                      Stand von Feldern und Aufbau des Bildes; bei jeder Aenderung hochzaehlen
//   BREITE, HOEHE                    Leinwand in Pixeln
//   FELDER                           die einzigen Schluessel, die bildDaten() liefert
//   TOKENS_THEMA, TOKENS_BRETT       Tokens, die das Bild braucht (Theme je Modus, Brett je data-brett)
//   teilbar(p) -> boolean            Sieg oder Remis, mit mindestens einem Zug, keine Uebung und keine Partie aus
//                                    einer eigenen Stellung (die sind keine echte Partie gegen den Bot)
//   endstellung(startFen, zuege) -> { fen, zuletzt: [von, nach] | [], plies }   spielt die UCI-Zuege nach (chess.js);
//                                    ein ungueltiger Zug beendet das Nachspielen (das Bild zeigt den Stand davor)
//   zugZahl(startFen, plies) -> Zahl Nummer des letzten Zugs (wie "Schachmatt im 23. Zug" im Ergebnis), 0 ohne Zug
//   kalenderTag(iso) -> 'JJJJ-MM-TT' | null   Kalendertag lokal (wie der Verlauf), nie ueber toISOString; bewusst NICHT
//                                    die Tagesgrenze 4:00 aus tag.js (die gilt fuer Tagesschluessel, nicht fuer ein
//                                    angezeigtes Datum: eine Partie um 01:30 am 23.10. steht im Verlauf am 23.)
//   datumText(iso) -> 'TT.MM.JJJJ' | null   derselbe Kalendertag fuers Bild (der Dateiname nimmt ihn auch)
//   MARKEN_ADRESSE                   feste Adresse fuer den Fuss des Bildes; leer: die Adresse der Seite (Flo entscheidet,
//                                    z. B. spaeter die Crownmate-Domain statt der GitHub-Adresse)
//   adresseAus(href) -> Text         Adresse der App ohne Protokoll, index.html, Suche und Anker; leer fuer alles, was
//                                    keine Web-Adresse ist (App-Huelle capacitor://localhost, https://localhost, file:)
//   appAdresse(href) -> Text         MARKEN_ADRESSE, sonst adresseAus(href)
//   gueltigerName(x) -> Text | null  nur ein Benutzername wie im Konto (3 bis 20 Zeichen A-Z, a-z, 0-9, _)
//   bildDaten(p, { bot, name, adresse }) -> eingefrorenes Objekt mit genau FELDERN (siehe unten)
//   layout() -> eingefrorene Lage aller Bereiche (Karte, Marke, Kopf, Portraet, Brett, Werte, Fuss)
//   feldRechteck(feld, unten = 'w', l = layout()) -> { x, y, s }   Feld 'e4' auf der Leinwand; unten: Farbe unten
//   themaTokens(regeln, themaId, modus) -> { '--name': Wert }      aus CSS-Regeln [{ selektor, decls: [[k, v]],
//                                    media }] wie im Theme (PLAN 1.8): hell aus :root[data-thema="id"], dunkel
//                                    zusaetzlich aus :root[data-thema="id"][data-modus="dunkel"]
//
// Kein Math.random (Fairness-Test: logik.js zaehlt zu den reinen Paket-Logik-Dateien).
import { Chess } from '../../../vendor/chess/chess.js';
import { wertet } from '../../storage.js';

export const RECHENSTAND = 1;
export const MARKEN_ADRESSE = '';
export const BREITE = 1080;
export const HOEHE = 1350;

// Alles, was im Bild stehen kann. bildDaten() liefert genau diese Schluessel und sonst nichts.
export const FELDER = Object.freeze([
  'stand', 'ergebnis', 'wort', 'ausruf', 'gegner', 'titel', 'ueber', 'fen', 'zuletzt', 'unten',
  'botId', 'botName', 'avatar', 'sterne', 'genauigkeit', 'zuege', 'datum', 'name', 'marke', 'fuss', 'adresse', 'dateiname',
]);

export const TOKENS_THEMA = Object.freeze([
  '--grund', '--flaeche', '--flaeche-2', '--flaeche-3', '--linie', '--linie-2', '--text', '--text-2',
  '--tinte', '--auf-tinte', '--gold', '--sockel', '--balken-weiss', '--balken-schwarz', '--schrift', '--display',
]);
export const TOKENS_BRETT = Object.freeze(['--feld-hell', '--feld-dunkel', '--zuletzt']);

const GRUNDSTELLUNG = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const GRUND = Object.freeze({
  patt: 'Patt', wiederholung: 'Dreifache Stellungswiederholung', '50-zuege': '50-Züge-Regel',
  material: 'Zu wenig Material zum Mattsetzen', zeit: 'Auf Zeit',
});
const MODUS_TEXT = Object.freeze({ boss: 'Boss', frei: 'Freie Partie', spiel: 'Spielhalle' });
const NAME = /^[A-Za-z0-9_]{3,20}$/;

function eigeneStellung(fen) {
  if (!fen) return false;
  return String(fen).trim().split(/\s+/).slice(0, 4).join(' ') !== GRUNDSTELLUNG.split(' ').slice(0, 4).join(' ');
}

export function teilbar(p) {
  if (!p || typeof p !== 'object') return false;
  if (p.ergebnis !== 'sieg' && p.ergebnis !== 'remis') return false;
  if (!Array.isArray(p.zuege) || !p.zuege.length) return false;
  const modus = p.modus || 'normal';
  if (modus === 'uebung') return false;
  if (modus === 'normal' && eigeneStellung(p.startFen)) return false;
  return true;
}

export function endstellung(startFen, zuege) {
  let c;
  try { c = new Chess(startFen || GRUNDSTELLUNG); } catch (e) { c = new Chess(GRUNDSTELLUNG); }
  let zuletzt = [];
  let plies = 0;
  for (const uci of Array.isArray(zuege) ? zuege : []) {
    const u = String(uci || '');
    if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(u)) break;
    try {
      const m = c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] || undefined });
      if (!m) break;
    } catch (e) { break; }
    zuletzt = [u.slice(0, 2), u.slice(2, 4)];
    plies++;
  }
  return { fen: c.fen().split(' ')[0], zuletzt, plies };
}

export function zugZahl(startFen, plies) {
  const n = Math.max(0, Math.floor(Number(plies) || 0));
  if (!n) return 0;
  const teile = String(startFen || GRUNDSTELLUNG).trim().split(/\s+/);
  const startFarbe = teile[1] === 'b' ? 'b' : 'w';
  const startNummer = Math.max(1, parseInt(teile[5], 10) || 1);
  return startNummer + Math.floor((n - 1 + (startFarbe === 'b' ? 1 : 0)) / 2);
}

export function kalenderTag(iso) {
  if (iso == null || iso === '') return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const zwei = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${zwei(d.getMonth() + 1)}-${zwei(d.getDate())}`;
}

export function datumText(iso) {
  const tag = kalenderTag(iso);
  if (!tag) return null;
  const [j, m, t] = tag.split('-');
  return `${t}.${m}.${j}`;
}

export function adresseAus(href) {
  try {
    const u = new URL(String(href));
    // in einer App-Huelle waere die Adresse nutzlos (localhost) oder gar keine (capacitor:, file:): dann keine
    if (!/^https?:$/.test(u.protocol) || u.hostname === 'localhost') return '';
    let pfad = u.pathname.replace(/\/index\.html$/, '/').replace(/\/+$/, '');
    if (pfad === '/') pfad = '';
    return (u.host.replace(/^www\./, '') + pfad).slice(0, 80);
  } catch (e) {
    return '';
  }
}

export function appAdresse(href) {
  const fest = typeof MARKEN_ADRESSE === 'string' ? MARKEN_ADRESSE.trim() : '';
  return fest ? fest.slice(0, 80) : adresseAus(href);
}

export function gueltigerName(x) {
  const t = typeof x === 'string' ? x.trim() : '';
  return NAME.test(t) ? t : null;
}

const komma1 = (x) => (Math.round(x * 10) / 10).toFixed(1).replace('.', ',');

export function bildDaten(p, { bot = null, name = null, adresse = '' } = {}) {
  const partie = p && typeof p === 'object' ? p : {};
  const ergebnis = partie.ergebnis === 'remis' ? 'remis' : 'sieg';
  const stellung = endstellung(partie.startFen, partie.zuege);
  const zuege = zugZahl(partie.startFen, stellung.plies);
  const botName = bot && typeof bot.name === 'string' && bot.name.trim() ? bot.name.trim().slice(0, 40) : 'deinen Gegner';
  const wort = ergebnis === 'sieg' ? 'Sieg' : 'Remis';
  let grund = '';
  if (partie.grund === 'matt' && ergebnis === 'sieg' && zuege) grund = `Schachmatt im ${zuege}. Zug`;
  else if (partie.grund === 'aufgabe' && ergebnis === 'sieg') grund = 'Gegner gibt auf';
  else if (GRUND[partie.grund]) grund = GRUND[partie.grund];
  const modus = MODUS_TEXT[partie.modus] || '';
  const ueber = [modus, grund].filter(Boolean).join(' · ');
  // Sterne nur bei einem wertenden Sieg (Remis und nicht wertende Partien zeigen keine leeren Sterne)
  const sterne = ergebnis === 'sieg' && wertet(partie) && Array.isArray(partie.sterne)
    ? [0, 1, 2].map((i) => partie.sterne[i] === true) : null;
  const genau = Number(partie.genauigkeit);
  const datum = datumText(partie.datum);
  const tag = kalenderTag(partie.datum) || '';
  const daten = {
    stand: RECHENSTAND,
    ergebnis,
    wort,
    ausruf: ergebnis === 'sieg' ? '!' : '',
    gegner: `gegen ${botName}`,
    titel: `${wort} gegen ${botName}`,
    ueber,
    fen: stellung.fen,
    zuletzt: Object.freeze(stellung.zuletzt.slice()),
    unten: partie.spielerFarbe === 'b' ? 'b' : 'w',
    botId: bot && typeof bot.id === 'string' && /^[a-z0-9-]+$/.test(bot.id) ? bot.id : '',
    botName,
    avatar: bot && typeof bot.avatar === 'string' ? bot.avatar : '',
    sterne: sterne ? Object.freeze(sterne) : null,
    genauigkeit: partie.genauigkeit != null && Number.isFinite(genau) && genau >= 0 && genau <= 100 ? komma1(genau) + ' %' : null,
    zuege,
    datum,
    name: gueltigerName(name),
    marke: 'Crownmate',
    fuss: 'crownmate',
    adresse: typeof adresse === 'string' ? adresse.slice(0, 80) : '',
    dateiname: `crownmate-${ergebnis}${/^\d{4}-\d{2}-\d{2}$/.test(tag) ? '-' + tag : ''}.png`,
  };
  return Object.freeze(daten);
}

// ---------- Lage auf der Leinwand ----------
// Karte mit Rand 40, innen 56 Polster. Kopf: Marke links, Datum rechts. Darunter Ueberzeile, das grosse Wort,
// der Gegner und (nur wenn gewaehlt) der Benutzername, rechts das Portraet. Das Brett links im Sockel, rechts die
// Werte (Sterne, Genauigkeit, Zuege) untereinander. Unten Haarlinie, "crownmate" und die Adresse.
export function layout() {
  const karte = { x: 40, y: 40, w: BREITE - 80, h: HOEHE - 80, r: 56 };
  const links = karte.x + 56;            // 96
  const rechts = karte.x + karte.w - 56; // 984
  const sockel = 12;
  const feld = 78;
  const brettGroesse = feld * 8;          // 624
  const brett = { x: links + sockel, y: 492 + sockel, feld, groesse: brettGroesse, sockel, r: 14, rs: 22 };
  const brettRechts = brett.x + brettGroesse + sockel;
  const werteX = brettRechts + 40;
  return Object.freeze({
    breite: BREITE,
    hoehe: HOEHE,
    karte: Object.freeze(karte),
    links,
    rechts,
    marke: Object.freeze({ x: links, y: 92, s: 72, r: 22 }),
    markeText: Object.freeze({ x: links + 72 + 22, y: 128, gr: 40 }),
    datum: Object.freeze({ x: rechts, y: 128, gr: 26 }),
    ueber: Object.freeze({ x: links, y: 222, gr: 24 }),
    wort: Object.freeze({ x: links, y: 334, gr: 112 }),
    gegner: Object.freeze({ x: links, y: 404, gr: 46, max: 700 }),
    name: Object.freeze({ x: links, y: 452, gr: 28, max: 700 }),
    portraet: Object.freeze({ x: rechts - 152, y: 200, s: 152, r: 36, innen: 16 }),
    brett: Object.freeze(brett),
    sockelBox: Object.freeze({ x: links, y: 492, w: brettGroesse + 2 * sockel, h: brettGroesse + 2 * sockel }),
    werte: Object.freeze({ x: werteX, y: 520, w: rechts - werteX, abstand: 196, wert: 54, label: 24, stern: 54 }),
    linie: Object.freeze({ y: 1196 }),
    fuss: Object.freeze({ y: 1252, gr: 34, adresseGr: 24 }),
  });
}

export function feldRechteck(feld, unten = 'w', l = layout()) {
  const m = /^([a-h])([1-8])$/.exec(String(feld || ''));
  if (!m) return null;
  const spalte = m[1].charCodeAt(0) - 97;
  const reihe = Number(m[2]) - 1;
  const sx = unten === 'b' ? 7 - spalte : spalte;
  const sy = unten === 'b' ? reihe : 7 - reihe;
  const s = l.brett.feld;
  return { x: l.brett.x + sx * s, y: l.brett.y + sy * s, s };
}

// ---------- Farben aus den Theme-Regeln ----------
export function themaTokens(regeln, themaId = 'modern', modus = 'hell') {
  const w = {};
  const liste = Array.isArray(regeln) ? regeln : [];
  const teile = (s) => String(s || '').split(',').map((x) => x.trim().replace(/'/g, '"'));
  const nimm = (r) => { for (const [k, v] of r.decls || []) if (typeof k === 'string' && k.startsWith('--')) w[k] = String(v).trim(); };
  const hell = `:root[data-thema="${themaId}"]`;
  const dunkel = `:root[data-thema="${themaId}"][data-modus="dunkel"]`;
  liste.filter((r) => !r.media && teile(r.selektor).includes(hell)).forEach(nimm);
  if (modus === 'dunkel') liste.filter((r) => !r.media && teile(r.selektor).includes(dunkel)).forEach(nimm);
  return w;
}
