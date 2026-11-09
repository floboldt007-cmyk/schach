// Raetsel fuer das Raetsel-Duell (Etappe 5): waehlt aus der Lichess-Raetsel-Datenbank eine feste Auswahl und schreibt
// supabase/raetsel-duell-daten.sql. Werkzeug am PC, laeuft unter Node (zstd aus node:zlib, ab Node 22.15), wird nicht
// ausgeliefert. Die Raetsel liegen nur auf dem Server (Tabelle duell_raetsel), nie in der App: das Geraet sieht immer nur
// das aktuelle Raetsel, nie eine Loesung.
//
// Quelle und Lizenz (abgerufen 07.11.2026, https://database.lichess.org/): "Database exports are released under the
// Creative Commons CC0 license." Datei lichess_db_puzzle.csv.zst, Spalten
//   PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags,DailyDate
// Laut Lichess ist FEN die Stellung VOR dem Zug des Gegners; gezeigt wird die Stellung nach dem ersten Zug, der zweite Zug
// beginnt die Loesung (UCI). Bei Matt in 1 gilt jeder Mattzug (das prueft die Edge Function raetsel-duell).
//
//   node werkzeuge/duell-raetsel.mjs --quelle=<lichess_db_puzzle.csv.zst>   auswaehlen und die SQL-Datei schreiben
//   node werkzeuge/duell-raetsel.mjs --pruefen                               die geschriebene SQL-Datei mit chess.js pruefen
//   Optionen: --aus=<datei> (Standard supabase/raetsel-duell-daten.sql)
//
// Auswahl (deterministisch, gleiche Quelldatei ergibt dieselbe SQL-Datei):
//   - Beliebtheit >= MIN_BELIEBT, mindestens MIN_GESPIELT Mal gespielt, Rating-Abweichung <= MAX_ABWEICHUNG
//   - nach dem Zug des Gegners hoechstens MAX_HALBZUEGE Halbzuege Loesung (also hoechstens 3 eigene Zuege)
//   - je 100er-Stufe von RATING_VON bis RATING_BIS (ausschliesslich) JE_STUFE Raetsel: die mit dem kleinsten sha256(id)
//   - jedes Raetsel wird mit vendor/chess nachgespielt (Stellung legal, jeder Zug legal, der letzte eigene Zug gewinnt
//     nicht durch Zufall: nur geprueft, dass er legal ist; die Loesung selbst stammt von Lichess)
import { readFileSync, writeFileSync } from 'node:fs';
import { zstdDecompressSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Chess } from '../vendor/chess/chess.js';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const MIN_BELIEBT = 90;
export const MIN_GESPIELT = 1000;
export const MAX_ABWEICHUNG = 80;
export const MAX_HALBZUEGE = 5;
export const RATING_VON = 600;
export const RATING_BIS = 2500;
export const JE_STUFE = 160;
const UCI = /^[a-h][1-8][a-h][1-8][qrbn]?$/;
const ID = /^[A-Za-z0-9]{3,12}$/;

const argument = (name) => {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : null;
};

function ziehe(c, uci) {
  return c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.length === 5 ? uci[4] : undefined });
}

// Lichess-Zeile -> { id, fen, loesung, rating, themen } | null (Stellung nach dem Zug des Gegners)
export function ausZeile(zeile) {
  const t = zeile.split(',');
  if (t.length < 8) return null;
  const [id, fen, zuege, rating, abweichung, beliebt, gespielt, themen] = t;
  if (!ID.test(id)) return null;
  const r = Number(rating);
  if (!Number.isInteger(r) || r < RATING_VON || r >= RATING_BIS) return null;
  if (!(Number(abweichung) <= MAX_ABWEICHUNG) || !(Number(beliebt) >= MIN_BELIEBT) || !(Number(gespielt) >= MIN_GESPIELT)) return null;
  const z = zuege.split(' ');
  if (z.length < 2 || z.length - 1 > MAX_HALBZUEGE || !z.every((u) => UCI.test(u))) return null;
  let c;
  try { c = new Chess(fen); ziehe(c, z[0]); } catch (e) { return null; }
  const start = c.fen();
  const loesung = z.slice(1);
  if (loesung.length % 2 !== 1) return null;
  try { for (const u of loesung) ziehe(c, u); } catch (e) { return null; }
  return { id, fen: start, loesung, rating: r, themen: themen.replace(/[^a-zA-Z0-9 ]/g, '').slice(0, 200) };
}

export function pruefeRaetsel(a) {
  if (!a || !ID.test(a.id) || !Array.isArray(a.loesung) || a.loesung.length % 2 !== 1 || a.loesung.length > MAX_HALBZUEGE) return false;
  if (!Number.isInteger(a.rating) || a.rating < RATING_VON || a.rating >= RATING_BIS) return false;
  try {
    const c = new Chess(a.fen);
    for (const u of a.loesung) { if (!UCI.test(u)) return false; ziehe(c, u); }
  } catch (e) { return false; }
  return true;
}

const hash = (id) => createHash('sha256').update(id).digest('hex');
const sqlText = (s) => `'${String(s).replace(/'/g, "''")}'`;

export function alsSql(liste, { abgerufen }) {
  const kopf = [
    '-- Raetsel fuer das Raetsel-Duell (Tabelle duell_raetsel aus supabase/raetsel-duell-schema.sql).',
    '-- ERZEUGT von werkzeuge/duell-raetsel.mjs, nicht von Hand aendern. Nach raetsel-duell-schema.sql einspielen.',
    `-- Quelle: Lichess-Raetsel-Datenbank (https://database.lichess.org/, abgerufen ${abgerufen}), Lizenz CC0`,
    '-- ("Database exports are released under the Creative Commons CC0 license"). Je Raetsel: Lichess-PuzzleId, die',
    '-- Stellung nach dem Zug des Gegners, die Loesung in UCI, die Lichess-Wertung und die Themen.',
    `-- ${liste.length} Raetsel. Wiederholbar (on conflict do nothing).`,
    '',
  ];
  const zeilen = liste.map((a) => `(${sqlText(a.id)}, ${sqlText(a.fen)}, array[${a.loesung.map(sqlText).join(', ')}], ${a.rating}, ${sqlText(a.themen)})`);
  const bloecke = [];
  for (let i = 0; i < zeilen.length; i += 500) {
    bloecke.push('insert into public.duell_raetsel (id, fen, loesung, rating, themen) values\n'
      + zeilen.slice(i, i + 500).join(',\n') + '\non conflict (id) do nothing;\n');
  }
  return kopf.join('\n') + bloecke.join('\n');
}

// Liest die SQL-Datei zurueck (fuer --pruefen und den Test)
export function ausSql(text) {
  const re = /^\('([A-Za-z0-9]+)', '([^']+)', array\[([^\]]*)\], (\d+), '([^']*)'\)/gm;
  return [...text.matchAll(re)].map((m) => ({
    id: m[1], fen: m[2], loesung: m[3].split(',').map((s) => s.trim().replace(/^'|'$/g, '')), rating: Number(m[4]), themen: m[5],
  }));
}

// Die Lichess-Datei ist im pzstd-Format: vor jedem zstd-Block steht ein Zusatzblock (skippable frame, Kennung
// 0x184D2A50 bis 0x184D2A5F) mit der Laenge des naechsten Blocks. node:zlib ueberspringt solche Bloecke nicht, deshalb
// wird hier Block fuer Block entpackt. Liefert die Zeilen der CSV-Datei.
function* zeilenAusPzstd(datei) {
  const roh = readFileSync(datei);
  let pos = 0;
  let rest = '';
  while (pos + 8 <= roh.length) {
    const kennung = roh.readUInt32LE(pos);
    if ((kennung & 0xfffffff0) === 0x184d2a50) {
      const groesse = roh.readUInt32LE(pos + 4);
      const naechster = groesse === 4 ? roh.readUInt32LE(pos + 8) : null;
      pos += 8 + groesse;
      if (naechster === null) continue; // anderer Zusatzblock (z. B. Sprungtabelle am Ende)
      const text = rest + zstdDecompressSync(roh.subarray(pos, pos + naechster)).toString('utf8');
      pos += naechster;
      const teile = text.split('\n');
      rest = teile.pop();
      yield* teile;
    } else {
      // reiner zstd-Rest ohne Zusatzblock davor: den Rest der Datei als einen Block entpacken
      const text = rest + zstdDecompressSync(roh.subarray(pos)).toString('utf8');
      const teile = text.split('\n');
      rest = teile.pop();
      yield* teile;
      break;
    }
  }
  if (rest) yield rest;
}

async function auswaehlen(quelle) {
  const stufen = new Map();
  let n = 0;
  for (const roheZeile of zeilenAusPzstd(quelle)) {
    const zeile = roheZeile.replace(/\r$/, '');
    if (n++ === 0 && zeile.startsWith('PuzzleId')) continue;
    // billige Filter zuerst (Zahlen), chess.js nur fuer die Kandidaten
    const t = zeile.split(',', 8);
    const r = Number(t[3]);
    if (!(r >= RATING_VON && r < RATING_BIS) || !(Number(t[4]) <= MAX_ABWEICHUNG) || !(Number(t[5]) >= MIN_BELIEBT)
      || !(Number(t[6]) >= MIN_GESPIELT)) continue;
    const stufe = Math.floor(r / 100);
    const h = hash(t[0]);
    const liste = stufen.get(stufe) || [];
    if (liste.length >= JE_STUFE && h >= liste[liste.length - 1].h) continue;
    const a = ausZeile(zeile);
    if (!a) continue;
    liste.push({ h, a });
    liste.sort((x, y) => (x.h < y.h ? -1 : 1));
    if (liste.length > JE_STUFE) liste.pop();
    stufen.set(stufe, liste);
  }
  return [...stufen.keys()].sort((x, y) => x - y).flatMap((s) => stufen.get(s).map((e) => e.a))
    .sort((x, y) => x.rating - y.rating || (x.id < y.id ? -1 : 1));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const aus = path.resolve(WURZEL, argument('aus') || 'supabase/raetsel-duell-daten.sql');
  if (process.argv.includes('--pruefen')) {
    const liste = ausSql(readFileSync(aus, 'utf8'));
    const schlecht = liste.filter((a) => !pruefeRaetsel(a));
    const ids = new Set(liste.map((a) => a.id));
    const stufen = {};
    for (const a of liste) stufen[Math.floor(a.rating / 100) * 100] = (stufen[Math.floor(a.rating / 100) * 100] || 0) + 1;
    console.log(`${liste.length} Raetsel, ${liste.length - schlecht.length} gueltig, ${schlecht.length} ungueltig, ${liste.length - ids.size} doppelt`);
    console.log('je Stufe: ' + JSON.stringify(stufen));
    process.exit(schlecht.length === 0 && ids.size === liste.length && liste.length > 0 ? 0 : 1);
  }
  const quelle = argument('quelle');
  if (!quelle) { console.log('Aufruf: node werkzeuge/duell-raetsel.mjs --quelle=<lichess_db_puzzle.csv.zst> | --pruefen'); process.exit(2); }
  const liste = await auswaehlen(quelle);
  writeFileSync(aus, alsSql(liste, { abgerufen: '07.11.2026' }));
  console.log(`${liste.length} Raetsel nach ${path.relative(WURZEL, aus)} geschrieben`);
}
