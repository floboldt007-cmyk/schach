// Raetsel-Duell (Etappe 5), Client-Logik: js/pakete/lobby/raetsel-duell.js (rein, ohne DOM) und der Vertrag mit dem
// Server (duell_konstanten in supabase/raetsel-duell-schema.sql).
//   node tests/raetsel-duell.test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Chess } from '../vendor/chess/chess.js';
import {
  KONST, versatzAus, restMs, uhrText, phaseAus, anteil, stellungAus, normalisiereStand, codeAusHash, duellLink, kronenText,
} from '../js/pakete/lobby/raetsel-duell.js';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lies = (d) => readFileSync(path.join(WURZEL, d), 'utf8');
let ok = 0;
let gesamt = 0;
function pruefe(name, bedingung, info) {
  gesamt++;
  if (bedingung) { ok++; console.log('ok     ' + name); } else console.log('FEHLER ' + name + (info !== undefined ? '  -> ' + JSON.stringify(info) : ''));
}

// ---------- Vertrag mit dem Server ----------
{
  const sql = lies('supabase/raetsel-duell-schema.sql');
  const k = sql.slice(sql.indexOf('function public.duell_konstanten()'), sql.indexOf('$$;', sql.indexOf('function public.duell_konstanten()')));
  const zahl = (s) => Number((k.match(new RegExp(`'${s}',\\s*(\\d+)`)) || [])[1]);
  pruefe('3 Minuten, 5 s Abzug, 3 s Vorlauf, KI nach 10 s, 50 Raetsel: gleich wie duell_konstanten',
    zahl('dauer_s') === KONST.DAUER_S && zahl('strafe_s') === KONST.STRAFE_S && zahl('vorlauf_s') === KONST.VORLAUF_S
      && zahl('ki_warte_s') === KONST.KI_WARTE_S && zahl('raetsel_anzahl') === KONST.RAETSEL_ANZAHL
      && KONST.DAUER_S === 180 && KONST.STRAFE_S === 5 && KONST.KI_WARTE_S === 10,
    { sql: [zahl('dauer_s'), zahl('strafe_s'), zahl('vorlauf_s'), zahl('ki_warte_s'), zahl('raetsel_anzahl')], js: KONST });
}

// ---------- Uhr ----------
const T0 = Date.parse('2026-11-07T12:00:00.000Z');
pruefe('Versatz: Serveruhr 2 s vor', versatzAus('2026-11-07T12:00:02.000Z', T0) === 2000);
pruefe('Versatz: unlesbar = 0', versatzAus('quatsch', T0) === 0);
pruefe('Restzeit nach Serverzeit', restMs('2026-11-07T12:03:00.000Z', 2000, T0) === 178000);
pruefe('Restzeit nie unter 0', restMs('2026-11-07T11:00:00.000Z', 0, T0) === 0);
pruefe('Uhr: 3:00, 0:05, 0:00 (aufgerundet)', uhrText(180000) === '3:00' && uhrText(4100) === '0:05' && uhrText(0) === '0:00', [uhrText(180000), uhrText(4100), uhrText(0)]);

// ---------- Stand ----------
const roh = {
  duell: '11111111-2222-4333-8444-555555555555', art: 'ki', status: 'laeuft', jetzt: '2026-11-07T12:00:10.000Z',
  start_am: '2026-11-07T12:00:03.000Z', dauer_s: 180,
  ich: { geloest: 2, fehler: 1, ende_am: '2026-11-07T12:02:58.000Z' },
  gegner: { geloest: 3, fehler: 0, ende_am: '2026-11-07T12:03:03.000Z', ki: true, elo: 1200 },
  raetsel: { nr: 4, fen: '6k1/5ppp/8/8/8/8/8/R3R1K1 w - - 0 1', bisher: [], rating: 640 },
  ergebnis: null, kronen_delta: null,
};
const st = normalisiereStand(roh);
pruefe('Stand wird gelesen (KI-Gegner mit Elo)', st && st.art === 'ki' && st.gegner.ki === true && st.gegner.elo === 1200 && st.ich.geloest === 2);
pruefe('Stand: fehlerhafte Antwort ist null', normalisiereStand({ fehler: 'DUELL_UNBEKANNT' }) === null && normalisiereStand(null) === null);
pruefe('Stand: unbekannte Art ist null', normalisiereStand({ ...roh, art: 'boese' }) === null);
pruefe('Stand: Loesung im Raetsel wird nie uebernommen', !('loesung' in (normalisiereStand({ ...roh, raetsel: { ...roh.raetsel, loesung: ['a1a8'] } }).raetsel)));
const v = versatzAus(roh.jetzt, T0);
pruefe('Phase: vor dem Start Vorlauf', phaseAus(st, v, T0 - 10000 + 1000) === 'vorlauf');
pruefe('Phase: laeuft', phaseAus(st, v, T0) === 'laeuft');
pruefe('Phase: eigene Zeit um, Gegner spielt noch', phaseAus(st, v, T0 + 170000) === 'zeit_um');
pruefe('Phase: beendet', phaseAus({ ...st, status: 'beendet' }, v, T0) === 'beendet');
pruefe('Phase: offen (Einladung)', phaseAus({ ...st, status: 'offen', start_am: null }, v, T0) === 'offen');

// ---------- Anzeige ----------
pruefe('Balken: Anteil an mindestens 10', anteil(2, 3) === 0.2 && anteil(12, 15) === 0.8 && anteil(0, 0) === 0);
pruefe('Kronen: +30, −15, 0', kronenText(30) === '+30' && kronenText(-15) === '−15' && kronenText(0) === '0' && kronenText(null) === '');
const s1 = stellungAus(Chess, { fen: '6k1/5ppp/8/8/8/8/8/R3R1K1 w - - 0 1', bisher: [] });
pruefe('Stellung ohne bisherige Zuege: Weiss am Zug', s1 && s1.chess.turn() === 'w' && s1.letzterZug === null && s1.seite === 'w');
const s2 = stellungAus(Chess, { fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3', bisher: ['f1c4', 'g8f6'] });
pruefe('Stellung mit Zwischenzug und Antwort: wieder am Zug, letzter Zug ist die Antwort, Seite bleibt',
  s2 && s2.chess.turn() === 'w' && s2.letzterZug.join('') === 'g8f6' && s2.seite === 'w', s2 && s2.letzterZug);
pruefe('Stellung: kaputte Zuege ergeben null', stellungAus(Chess, { fen: '6k1/5ppp/8/8/8/8/8/R3R1K1 w - - 0 1', bisher: ['a1a9'] }) === null);

// ---------- Link ----------
pruefe('Link #raetsel-duell/CODE', duellLink('abc-234', 'https://x.example/schach/') === 'https://x.example/schach/#raetsel-duell/ABC234');
pruefe('Code aus dem Hash', codeAusHash('#raetsel-duell/abc234') === 'ABC234' && codeAusHash('#raetsel-duell') === null && codeAusHash('#online/ABC234') === null
  && codeAusHash('#raetsel-duell/ABC10I') === null);

console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
