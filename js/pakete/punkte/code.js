// Freunde-Code SA1 (Paket punkte, SPIELKONZEPT 3.13 "Freunde-Vergleich ohne Server"). Rein: ohne DOM, ohne Speicher,
// ohne Uhr, ohne Zufall; braucht nur chess.js (erlaubte Zuege). In Node testbar.
//
// Eine Code-Familie fuer alles, was man teilt: "SA1-" plus Crockford-Base32 (ohne I, L, O, U; Eingabe ohne Gross- und
// Kleinschreibung, O wird 0, I und L werden 1) in Vierergruppen. Inhalt (Bytes, Version 1, alle Zahlen big-endian):
//   0 Version (1) / 1 Rechenstand / 2 Art (1 Partie gegen einen Leiter-Bot, 2 Boss) / 3 Merker (Bit 0 Farbe Schwarz,
//   Bit 1-2 Boss-Stufe 0 keine/1 Standard/2 Meister, Bit 3-4 Ergebnis 0 Sieg/1 Remis/2 Niederlage) / 4-7 Seed /
//   8-9 Datum (Tage seit 2020-01-01) / 10 Analysetiefe (0 unbekannt) / 11 Laenge L der Bot-ID, dann L Zeichen /
//   2 Byte Boss-Staerke (0 keine) / 1 Byte Laenge N des Namens (UTF-8, hoechstens 12 Zeichen), dann N Bytes /
//   2 Byte Zahl H der Halbzuege, dann H Bytes: je Halbzug der Index in der Liste der erlaubten Zuege (sortiert nach
//   UCI, 1 Byte je Halbzug) / 2 Byte Pruefsumme (CRC-16/CCITT ueber alles davor).
// Eine Partie mit 80 Halbzuegen ergibt so rund 170 Zeichen.
//
// Drei ehrliche Pruefstufen (3.13): Die Pruefsumme schuetzt nur gegen Tippfehler (der Code der App ist offen);
// "nachgerechnet" heisst: die App spielt die Partie aus den Zuegen nach und rechnet die Punkte selbst (zuegeAusIndizes,
// dann die Spielanalyse und formel.tafelwert). "Bot-geprueft" braucht Bots mit fester Knotenzahl (S3-0), noch nicht.
//
// API:
//   PRAEFIX 'SA1', VERSION 1, ALPHABET, NAME_MAX 12, ZUEGE_MAX 600
//   base32(bytes) -> Text, ausBase32(text) -> Uint8Array | null, crc16(bytes) -> 0..65535
//   normalisiere(text) -> Base32-Zeichen ohne Praefix, Striche und Leerzeichen (O->0, I/L->1) | null (fremdes Zeichen)
//   gruppiert(roh) -> 'SA1-XXXX-XXXX-...'
//   zugIndizes(uciListe, startFen) -> { ok, indizes, grund }   Index je Halbzug in den erlaubten Zuegen (nach UCI sortiert)
//   zuegeAusIndizes(indizes, startFen) -> { ok, uci, san, fen, matt, remis, grund }   spielt die Partie nach
//   erzeugeCode({ art, botId, farbe, stufe, ergebnis, seed, tag, tiefe, staerke, name, zuege, startFen, stand })
//       -> { ok: true, code, roh, zeichen } | { ok: false, grund }
//   leseCode(text) -> { ok: true, daten: { version, stand, art, botId, farbe, stufe, ergebnis, seed, tag, tiefe, staerke,
//       name, indizes } } | { ok: false, grund, text }
// Kein Math.random in dieser Datei (Fairness-Regel 1).
import { Chess } from '../../../vendor/chess/chess.js';
import { addiereTage, tageZwischen, istSchluessel } from '../../tag.js';

export const PRAEFIX = 'SA1';
export const VERSION = 1;
export const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const NAME_MAX = 12;
export const ZUEGE_MAX = 600;
export const GRUNDSTELLUNG = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const TAG_NULL = '2020-01-01';
const ART_ZAHL = { partie: 1, boss: 2 };
const ZAHL_ART = { 1: 'partie', 2: 'boss' };
const STUFE_ZAHL = { standard: 1, meister: 2 };
const ZAHL_STUFE = { 1: 'standard', 2: 'meister' };
const ERG_ZAHL = { sieg: 0, remis: 1, niederlage: 2 };
const ZAHL_ERG = { 0: 'sieg', 1: 'remis', 2: 'niederlage' };
const BOT_RE = /^[a-z][a-z0-9-]{0,31}$/;

const TEXT = (s) => new TextEncoder().encode(s);
const AUS_TEXT = (b) => new TextDecoder('utf-8', { fatal: true }).decode(b);

export function base32(bytes) {
  let aus = '';
  let puffer = 0;
  let bits = 0;
  for (const b of bytes) {
    puffer = (puffer << 8) | b;
    bits += 8;
    while (bits >= 5) {
      aus += ALPHABET[(puffer >> (bits - 5)) & 31];
      bits -= 5;
    }
    puffer &= (1 << bits) - 1;
  }
  if (bits > 0) aus += ALPHABET[(puffer << (5 - bits)) & 31];
  return aus;
}

export function ausBase32(text) {
  const t = String(text || '');
  const bytes = [];
  let puffer = 0;
  let bits = 0;
  for (const c of t) {
    const v = ALPHABET.indexOf(c);
    if (v < 0) return null;
    puffer = (puffer << 5) | v;
    bits += 5;
    if (bits >= 8) {
      bytes.push((puffer >> (bits - 8)) & 255);
      bits -= 8;
    }
    puffer &= (1 << bits) - 1;
  }
  // uebrige Bits muessen Fuellnullen sein (sonst war der Code abgeschnitten oder verschrieben)
  if (bits >= 5 || puffer !== 0) return null;
  return Uint8Array.from(bytes);
}

export function crc16(bytes) {
  let crc = 0xffff;
  for (const b of bytes) {
    crc ^= b << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc;
}

export function normalisiere(text) {
  // erst die Verwechsler ersetzen (auch im Praefix: "SAl-" ist "SA1-"), dann das Praefix weg. Eindeutig, weil der Inhalt
  // nie mit S beginnt: das erste Byte ist die Version (1), also beginnt der Code immer mit 0.
  let t = String(text || '').toUpperCase().replace(/[\s\u2010-\u2015\u2212-]+/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
  if (t.startsWith(PRAEFIX)) t = t.slice(PRAEFIX.length);
  return /^[0-9A-HJKMNP-TV-Z]*$/.test(t) && t.length ? t : null;
}

export function gruppiert(roh) {
  const g = String(roh || '').match(/.{1,4}/g) || [];
  return [PRAEFIX, ...g].join('-');
}

function brett(startFen) {
  try { return new Chess(startFen || GRUNDSTELLUNG); } catch (e) { return null; }
}
function erlaubte(c) {
  return c.moves({ verbose: true }).map((m) => m.lan || (m.from + m.to + (m.promotion || ''))).sort();
}

export function zugIndizes(uciListe, startFen = GRUNDSTELLUNG) {
  const c = brett(startFen);
  if (!c) return { ok: false, grund: 'stellung', indizes: [] };
  const l = Array.isArray(uciListe) ? uciListe : [];
  if (l.length > ZUEGE_MAX) return { ok: false, grund: 'zuege', indizes: [] };
  const indizes = [];
  for (const u of l) {
    const zuege = erlaubte(c);
    const i = zuege.indexOf(String(u));
    if (i < 0 || i > 255) return { ok: false, grund: 'zug', indizes };
    indizes.push(i);
    c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u.length > 4 ? u[4] : undefined });
  }
  return { ok: true, indizes };
}

export function zuegeAusIndizes(indizes, startFen = GRUNDSTELLUNG) {
  const c = brett(startFen);
  if (!c) return { ok: false, grund: 'stellung', uci: [], san: [] };
  const uci = [];
  const san = [];
  for (const i of Array.isArray(indizes) ? indizes : []) {
    const zuege = erlaubte(c);
    if (!Number.isInteger(i) || i < 0 || i >= zuege.length) return { ok: false, grund: 'zug', uci, san };
    const u = zuege[i];
    const m = c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u.length > 4 ? u[4] : undefined });
    uci.push(u);
    san.push(m.san);
  }
  return { ok: true, uci, san, fen: c.fen(), matt: c.isCheckmate(), remis: c.isDraw() || c.isStalemate() };
}

export function erzeugeCode({ art = 'partie', botId, farbe = 'w', stufe = null, ergebnis = 'sieg', seed = 0, tag, tiefe = 0,
  staerke = null, name = '', zuege = [], startFen = GRUNDSTELLUNG, stand = 1 } = {}) {
  if (!ART_ZAHL[art]) return { ok: false, grund: 'art' };
  if (typeof botId !== 'string' || !BOT_RE.test(botId)) return { ok: false, grund: 'bot' };
  if (!istSchluessel(tag)) return { ok: false, grund: 'datum' };
  const tage = tageZwischen(TAG_NULL, tag);
  if (tage < 0 || tage > 65535) return { ok: false, grund: 'datum' };
  if (art === 'boss' && !STUFE_ZAHL[stufe]) return { ok: false, grund: 'stufe' };
  if (!(ergebnis in ERG_ZAHL)) return { ok: false, grund: 'ergebnis' };
  const nameText = String(name || '').replace(/[\u0000-\u001f\u007f]/g, '').trim();
  if ([...nameText].length > NAME_MAX) return { ok: false, grund: 'name' };
  const nameBytes = TEXT(nameText);
  const z = zugIndizes(zuege, startFen);
  if (!z.ok) return { ok: false, grund: z.grund };
  const s = Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff ? seed : 0;
  const st = Number.isFinite(staerke) && staerke > 0 ? Math.min(65535, Math.round(staerke)) : 0;
  const bytes = [
    VERSION, Math.max(1, Math.min(255, Math.round(stand) || 1)), ART_ZAHL[art],
    (farbe === 'b' ? 1 : 0) | ((STUFE_ZAHL[stufe] || 0) << 1) | (ERG_ZAHL[ergebnis] << 3),
    (s >>> 24) & 255, (s >>> 16) & 255, (s >>> 8) & 255, s & 255,
    (tage >> 8) & 255, tage & 255,
    Math.max(0, Math.min(255, Math.round(tiefe) || 0)),
    botId.length, ...TEXT(botId),
    (st >> 8) & 255, st & 255,
    nameBytes.length, ...nameBytes,
    (z.indizes.length >> 8) & 255, z.indizes.length & 255, ...z.indizes,
  ];
  const pruef = crc16(bytes);
  bytes.push((pruef >> 8) & 255, pruef & 255);
  const roh = base32(bytes);
  const code = gruppiert(roh);
  return { ok: true, code, roh, zeichen: code.length };
}

function fehler(grund, text) {
  return { ok: false, grund, text };
}

const FEHLERTEXT = {
  leer: 'Kein Code eingefügt.',
  zeichen: 'Der Code enthält Zeichen, die es in SA1-Codes nicht gibt.',
  pruefsumme: 'Das Prüfzeichen passt nicht: Vermutlich hat sich ein Tippfehler eingeschlichen.',
  version: 'Dieser Code stammt aus einer neueren App. Bitte die App aktualisieren.',
  format: 'Der Code ist unvollständig oder beschädigt.',
};

export function leseCode(text) {
  const roh = String(text || '').trim();
  if (!roh) return fehler('leer', FEHLERTEXT.leer);
  const n = normalisiere(roh);
  if (!n) return fehler('zeichen', FEHLERTEXT.zeichen);
  const b = ausBase32(n);
  if (!b || b.length < 18) return fehler('format', FEHLERTEXT.format);
  const inhalt = b.subarray(0, b.length - 2);
  if (crc16(inhalt) !== ((b[b.length - 2] << 8) | b[b.length - 1])) return fehler('pruefsumme', FEHLERTEXT.pruefsumme);
  if (b[0] !== VERSION) return fehler('version', FEHLERTEXT.version);
  let i = 0;
  const lies = (n2) => {
    if (i + n2 > inhalt.length) throw new Error('kurz');
    const s = inhalt.subarray(i, i + n2);
    i += n2;
    return s;
  };
  try {
    const [version, stand, artZahl, merker] = lies(4);
    const sb = lies(4);
    const seed = ((sb[0] << 24) >>> 0) + (sb[1] << 16) + (sb[2] << 8) + sb[3];
    const tb = lies(2);
    const tag = addiereTage(TAG_NULL, (tb[0] << 8) | tb[1]);
    const [tiefe] = lies(1);
    const [lb] = lies(1);
    const botId = String.fromCharCode(...lies(lb));
    const stb = lies(2);
    const staerke = (stb[0] << 8) | stb[1];
    const [nl] = lies(1);
    const name = AUS_TEXT(lies(nl));
    const hb = lies(2);
    const h = (hb[0] << 8) | hb[1];
    const indizes = [...lies(h)];
    if (i !== inhalt.length) return fehler('format', FEHLERTEXT.format);
    const art = ZAHL_ART[artZahl];
    const stufe = ZAHL_STUFE[(merker >> 1) & 3] || null;
    const ergebnis = ZAHL_ERG[(merker >> 3) & 3];
    if (!art || !BOT_RE.test(botId) || !ergebnis || (art === 'boss') !== !!stufe || [...name].length > NAME_MAX || h > ZUEGE_MAX
      || (merker >> 5) !== 0) {
      return fehler('format', FEHLERTEXT.format);
    }
    return {
      ok: true,
      daten: { version, stand, art, botId, farbe: merker & 1 ? 'b' : 'w', stufe, ergebnis, seed, tag, tiefe: tiefe || null,
        staerke: staerke || null, name, indizes },
    };
  } catch (e) {
    return fehler('format', FEHLERTEXT.format);
  }
}
