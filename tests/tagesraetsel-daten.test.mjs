// Tests fuer die Daten des Tagesraetsels: daten/tagesraetsel/raetsel.json (geschrieben von werkzeuge/raetsel-fabrik.mjs)
// und die Fabrik selbst ohne Engine. Nur Node, schnell, ohne Stockfish und ohne Browser.
// Prueft: Dateikopf (pruefeInhalt aus js/inhalte.js, art 'tagesraetsel', Rechenstand), Aufbau, start ist ein Montag,
// mindestens 126 Tage in ganzen Wochen, jede Aufgabe mit pruefeAufgabe (js/ui/raetsel.js) gueltig und mit chess.js
// spielbar (legal, Loesung ungerade lang, 1 bis 4 eigene Zuege), Matt genau dann, wenn matt gesetzt ist, Titel passt zur
// Seite am Zug, Motive nur aus der Liste und gleich der geometrischen Pruefung der Fabrik, Stufe 1 bis 7, IDs und
// Stellungen eindeutig, Wochenkurve (Montag 1-2 ... Samstag 6-7, jeden Tag schwerer, Sonntag mittel + schwer),
// Tageswechsel um 4:00 (3:59 gehoert zum Vortag), Datei unter 120 KB, eigene Lehr-Stellungen, und dass die Fabrik
// deterministisch ist (zweimal --probe: gleiche Ausgabe).
//
//   node tests/tagesraetsel-daten.test.mjs
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import { Chess } from '../vendor/chess/chess.js';
import { pruefeInhalt, RECHENSTAND } from '../js/inhalte.js';
import { pruefeAufgabe } from '../js/ui/raetsel.js';
import { wochentag, addiereTage, istSchluessel, tagSchluessel, tageZwischen } from '../js/tag.js';
import * as F from '../werkzeuge/raetsel-fabrik.mjs';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATEI = path.join(WURZEL, 'daten/tagesraetsel/raetsel.json');
const FABRIK = path.join(WURZEL, 'werkzeuge/raetsel-fabrik.mjs');
const MOTIVE = ['gabel', 'fesselung', 'spiess', 'abzug', 'grundreihe', 'matt'];
const TAG_STUFEN = [[1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7]];
const AUFGABE_FELDER = ['id', 'fen', 'loesung', 'motiv', 'stufe', 'matt', 'titel'];

const ergebnisse = [];
let gruppe = '';
function pruefe(name, ok, detail = '') {
  ergebnisse.push({ name: (gruppe ? gruppe + ': ' : '') + name, ok: !!ok, detail });
  const d = typeof detail === 'string' ? detail : JSON.stringify(detail);
  console.log(`${ok ? 'ok  ' : 'FEHLER'} ${gruppe ? gruppe + ': ' : ''}${name}${!ok && d ? ' (' + d.slice(0, 600) + ')' : ''}`);
}
const ersteFehler = (liste, n = 5) => liste.slice(0, n).join(' · ') + (liste.length > n ? ` · (+${liste.length - n})` : '');
const stellung = (fen) => String(fen).trim().split(/\s+/).slice(0, 4).join(' ');

// ---------------------------------------------------------------------------
gruppe = 'Datei';
const roh = fs.existsSync(DATEI) ? fs.readFileSync(DATEI) : null;
pruefe('daten/tagesraetsel/raetsel.json existiert', !!roh);
let json = null;
try { json = JSON.parse(roh.toString('utf8')); } catch (e) { /* unten gemeldet */ }
pruefe('gueltiges JSON', !!json);
pruefe('kleiner als 120 KB', roh && roh.length < 120 * 1024, roh && roh.length + ' Bytes');
const tage = json && Array.isArray(json.tage) ? json.tage : [];
const aufgaben = tage.flatMap((t) => (t && Array.isArray(t.aufgaben) ? t.aufgaben : []));

gruppe = 'Kopf';
const inhalt = json ? pruefeInhalt(json, { art: 'tagesraetsel' }) : { ok: false, fehler: ['keine Datei'] };
pruefe('pruefeInhalt mit art tagesraetsel', inhalt.ok, inhalt.fehler);
pruefe('format 1, Rechenstand der App, nicht veraltet', json && json.kopf.format === 1 && json.kopf.rechenstand === RECHENSTAND && !inhalt.veraltet,
  json && json.kopf);
pruefe('Felder: kopf, quelle, start, tage (sonst nichts)', json && JSON.stringify(Object.keys(json)) === JSON.stringify(['kopf', 'quelle', 'start', 'tage']),
  json && Object.keys(json));
const q = json && json.quelle;
pruefe('quelle: partien, kandidaten, behalten, nodes als Zahlen, engine als Text',
  q && ['partien', 'kandidaten', 'behalten', 'nodes'].every((k) => Number.isInteger(q[k]) && q[k] >= 0) && typeof q.engine === 'string' && q.engine.length > 0, q);
pruefe('quelle: behalten <= kandidaten, alle Aufgaben aus dem Vorrat', q && q.behalten <= q.kandidaten && aufgaben.length <= q.behalten, q);
pruefe('quelle: Stockfish 19 lite wie die App', q && /Stockfish 19 lite/.test(q.engine), q && q.engine);
pruefe('start ist ein Montag', json && istSchluessel(json.start) && wochentag(json.start) === 0, json && json.start);
pruefe('start ist 2026-10-19', json && json.start === '2026-10-19', json && json.start);

gruppe = 'Tage';
pruefe('mindestens 126 Tage (18 Wochen)', tage.length >= 126, tage.length);
pruefe('ganze Wochen (Laenge ein Vielfaches von 7)', tage.length > 0 && tage.length % 7 === 0, tage.length);
pruefe('jeder Tag hat nur das Feld aufgaben', tage.every((t) => t && JSON.stringify(Object.keys(t)) === '["aufgaben"]' && Array.isArray(t.aufgaben)));
{
  const f = [];
  tage.forEach((t, k) => {
    const tag = addiereTage(json.start, k);
    const wt = wochentag(tag);
    const a = t.aufgaben || [];
    if (wt <= 5) {
      if (a.length !== 1) { f.push(`${tag}: ${a.length} Aufgaben`); return; }
      const [lo, hi] = TAG_STUFEN[wt];
      if (!(a[0].stufe >= lo && a[0].stufe <= hi)) f.push(`${tag} (Wochentag ${wt}): Stufe ${a[0].stufe}, erwartet ${lo}-${hi}`);
      if (wt > 0) {
        const vortag = tage[k - 1] && tage[k - 1].aufgaben[0];
        if (!vortag || !(a[0].stufe > vortag.stufe)) f.push(`${tag}: nicht schwerer als der Vortag`);
      }
    } else {
      if (a.length !== 2) { f.push(`${tag} (Sonntag): ${a.length} Aufgaben statt 2`); return; }
      if (!(a[0].stufe >= 3 && a[0].stufe <= 5)) f.push(`${tag} (Sonntag) Teil 1: Stufe ${a[0].stufe}, erwartet 3-5`);
      if (!(a[1].stufe >= 6 && a[1].stufe <= 7)) f.push(`${tag} (Sonntag) Teil 2: Stufe ${a[1].stufe}, erwartet 6-7`);
    }
  });
  pruefe('Wochenkurve: Montag 1-2 bis Samstag 6-7, jeden Tag schwerer, Sonntag mittel (3-5) und schwer (6-7)', f.length === 0, ersteFehler(f));
}
{
  // Tageswechsel wie die App (js/tag.js, Grenze 4:00 lokal): Tag k = start + k
  const index = (datum) => tageZwischen(json.start, tagSchluessel(datum));
  const [j, m, t] = json.start.split('-').map(Number);
  pruefe('Tageswechsel 4:00: start 3:59 gehoert zum Vortag, 4:00 ist Tag 0',
    index(new Date(j, m - 1, t, 3, 59)) === -1 && index(new Date(j, m - 1, t, 4, 0)) === 0 && index(new Date(j, m - 1, t + 1, 3, 59)) === 0
    && index(new Date(j, m - 1, t + 1, 4, 0)) === 1);
  const heute = index(new Date(2026, 9, 24, 12, 0));
  pruefe('Samstag 24.10.2026 ist Tag 5 (das Archiv hat schon Tage)', heute === 5 && wochentag(addiereTage(json.start, heute)) === 5, heute);
}

gruppe = 'Aufgaben';
pruefe('mindestens 144 Aufgaben (18 Wochen zu 8)', aufgaben.length >= 144, aufgaben.length);
{
  const f = [];
  for (const a of aufgaben) {
    const n = a && a.id;
    if (!a || typeof a !== 'object') { f.push('kein Objekt'); continue; }
    const fremd = Object.keys(a).filter((k) => !AUFGABE_FELDER.includes(k));
    if (fremd.length || AUFGABE_FELDER.some((k) => !(k in a))) f.push(`${n}: Felder ${Object.keys(a).join(',')}`);
    if (!pruefeAufgabe(a)) f.push(`${n}: pruefeAufgabe sagt nein`);
  }
  pruefe('jede Aufgabe hat genau die Felder und besteht pruefeAufgabe (js/ui/raetsel.js)', f.length === 0, ersteFehler(f));
}
{
  const f = [];
  for (const a of aufgaben) {
    let c;
    try { c = new Chess(a.fen); } catch (e) { f.push(`${a.id}: FEN`); continue; }
    const steine = c.board().flat().filter(Boolean);
    const koenige = ['w', 'b'].map((farbe) => steine.filter((s) => s.type === 'k' && s.color === farbe).length);
    if (koenige[0] !== 1 || koenige[1] !== 1) f.push(`${a.id}: Koenige`);
    if (steine.some((s) => s.type === 'p' && (s.square[1] === '1' || s.square[1] === '8'))) f.push(`${a.id}: Bauer auf der Grundreihe`);
    const anderer = c.turn() === 'w' ? 'b' : 'w';
    if (c.isAttacked(c.findPiece({ type: 'k', color: anderer })[0], c.turn())) f.push(`${a.id}: Seite ohne Zugrecht steht im Schach`);
    if (c.isGameOver()) f.push(`${a.id}: Stellung ist schon zu Ende`);
    if (a.titel !== (c.turn() === 'w' ? 'Weiß am Zug' : 'Schwarz am Zug')) f.push(`${a.id}: Titel "${a.titel}"`);
    if (!Array.isArray(a.loesung) || a.loesung.length % 2 !== 1 || a.loesung.length > 7) { f.push(`${a.id}: Loesungslaenge`); continue; }
    let gespielt = true;
    for (const [i, u] of a.loesung.entries()) {
      if (c.isGameOver()) { f.push(`${a.id}: Partie vor Zug ${i + 1} zu Ende`); gespielt = false; break; }
      let zug = null;
      try { zug = c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }); } catch (e) { zug = null; }
      if (!zug) { f.push(`${a.id}: Zug ${u} illegal`); gespielt = false; break; }
    }
    if (!gespielt) continue;
    const eigene = (a.loesung.length + 1) / 2;
    if (a.matt != null) {
      if (!(Number.isInteger(a.matt) && a.matt === eigene && c.isCheckmate())) f.push(`${a.id}: matt ${a.matt}, aber kein Matt in ${eigene}`);
    } else if (c.isCheckmate()) f.push(`${a.id}: endet im Matt, matt fehlt`);
  }
  pruefe('jede Aufgabe ist legal und mit chess.js spielbar (1 bis 4 eigene Zuege), matt stimmt, Titel passt', f.length === 0, ersteFehler(f));
}
pruefe('Stufe ist 1 bis 7', aufgaben.every((a) => Number.isInteger(a.stufe) && a.stufe >= 1 && a.stufe <= 7));
pruefe('Motiv nur aus der Liste oder null', aufgaben.every((a) => a.motiv === null || MOTIVE.includes(a.motiv)),
  aufgaben.filter((a) => !(a.motiv === null || MOTIVE.includes(a.motiv))).map((a) => a.motiv));
pruefe('Motive der Fabrik entsprechen der Liste', JSON.stringify([...F.MOTIVE].sort()) === JSON.stringify([...MOTIVE].sort()));
{
  const f = aufgaben.filter((a) => F.motivVon(a.fen, a.loesung, a.matt) !== a.motiv).map((a) => `${a.id}: ${a.motiv} statt ${F.motivVon(a.fen, a.loesung, a.matt)}`);
  pruefe('jedes Motiv besteht die geometrische Pruefung der Fabrik', f.length === 0, ersteFehler(f));
}
pruefe('mattsetzende Aufgaben tragen das Motiv matt oder grundreihe',
  aufgaben.every((a) => (a.matt != null) === (a.motiv === 'matt' || a.motiv === 'grundreihe')));
{
  const ids = aufgaben.map((a) => a.id);
  pruefe('IDs eindeutig und fortlaufend (tr-0001 ...)', new Set(ids).size === ids.length && ids.every((id, i) => id === 'tr-' + String(i + 1).padStart(4, '0')),
    ids.slice(0, 3));
  const st = aufgaben.map((a) => stellung(a.fen));
  pruefe('keine Stellung doppelt', new Set(st).size === st.length, st.length - new Set(st).size);
}
{
  const motive = new Set(aufgaben.map((a) => a.motiv).filter(Boolean));
  pruefe('Motive kommen vor (mindestens 4 verschiedene)', motive.size >= 4, [...motive]);
  const farben = new Set(aufgaben.map((a) => a.titel));
  pruefe('Weiss und Schwarz am Zug kommen vor', farben.size === 2);
  const stufen = new Set(aufgaben.map((a) => a.stufe));
  pruefe('alle sieben Stufen kommen vor', stufen.size === 7, [...stufen].sort());
}

gruppe = 'Eigene Lehr-Stellungen';
{
  const eigene = F.ladeEigene();
  pruefe('werkzeuge/raetsel-eigene.json hat Stellungen', eigene.length >= 8, eigene.length);
  const r = eigene.map((e) => F.pruefeEigeneOhneEngine(e));
  pruefe('jede ist legal, die Loesung spielbar, matt und motiv wie angegeben, Quelle genannt', r.every((x) => x.ok),
    r.filter((x) => !x.ok).map((x) => x.id + ': ' + x.fehler.join(', ')));
  const ids = eigene.map((e) => e.id);
  pruefe('IDs der Lehr-Stellungen eindeutig', new Set(ids).size === ids.length);
  const nachStellung = new Map(eigene.map((e) => [stellung(e.fen), e]));
  const imJahr = aufgaben.filter((a) => nachStellung.has(stellung(a.fen)));
  pruefe('Lehr-Stellungen stehen mit ihrer Loesung in der Datei', imJahr.length > 0
    && imJahr.every((a) => JSON.stringify(a.loesung) === JSON.stringify(nachStellung.get(stellung(a.fen)).loesung)), imJahr.length);
  pruefe('daten/raetsel/ gibt es nicht (Inhalte gehoeren nach daten/tagesraetsel/)', !fs.existsSync(path.join(WURZEL, 'daten/raetsel')));
}

gruppe = 'Fabrik';
{
  const lauf = () => spawnSync(process.execPath, [FABRIK, '--probe'], { cwd: WURZEL, encoding: 'utf8', timeout: 60000 });
  const a = lauf();
  const b = lauf();
  pruefe('--probe laeuft ohne Engine durch (Exitcode 0)', a.status === 0 && b.status === 0, (a.stderr || '') + (b.stderr || ''));
  pruefe('--probe ist deterministisch (zweimal gleiche Ausgabe)', a.stdout.length > 0 && a.stdout === b.stdout);
  let p = null;
  try { p = JSON.parse(a.stdout); } catch (e) { /* unten */ }
  pruefe('--probe liefert JSON mit eigene und wochen', p && Array.isArray(p.eigene) && Array.isArray(p.wochen));
  pruefe('--probe: alle Lehr-Stellungen bestehen', p && p.eigene.length > 0 && p.eigene.every((e) => e.ok), p && p.eigene.filter((e) => !e.ok));
  const f = [];
  for (const [w, woche] of (p ? p.wochen : []).entries()) {
    const st = woche.map((x) => Number(x.split('/')[1]));
    if (st.length !== 8) { f.push(`Woche ${w}: ${st.length} Eintraege`); continue; }
    for (let d = 0; d < 6; d++) {
      if (!(st[d] >= TAG_STUFEN[d][0] && st[d] <= TAG_STUFEN[d][1])) f.push(`Woche ${w} Tag ${d}: Stufe ${st[d]}`);
      if (d > 0 && !(st[d] > st[d - 1])) f.push(`Woche ${w} Tag ${d}: nicht schwerer`);
    }
    if (!(st[6] >= 3 && st[6] <= 5 && st[7] >= 6 && st[7] <= 7)) f.push(`Woche ${w} Sonntag: ${st[6]}, ${st[7]}`);
  }
  pruefe('--probe: Tage aus der festen Liste folgen der Wochenkurve (mindestens 18 Wochen)', p && p.wochen.length >= 18 && f.length === 0,
    p ? `${p.wochen.length} Wochen; ${ersteFehler(f)}` : '');
  const schl = p ? p.wochen.flat().map((x) => x.split('/')[0]) : [];
  pruefe('--probe: kein Eintrag doppelt verteilt', schl.length > 0 && new Set(schl).size === schl.length);
  // reine Funktionen: Stufen-Schwellen steigen, Ein- und Ausgabe stabil
  pruefe('Stufen-Schwellen steigen', F.STUFEN_SCHWELLEN.every((t, i) => i === 0 || t > F.STUFEN_SCHWELLEN[i - 1]));
  pruefe('Stufe: kurz/schwache Partie leicht, lang/starke Partie schwer',
    F.stufeVon({ eigeneZuege: 1, fehlzuege: 0, ruhig: false, elo: 700 }).stufe === 1
    && F.stufeVon({ eigeneZuege: 4, fehlzuege: 6, ruhig: true, elo: 2100 }).stufe === 7);
  let wirft = false;
  try { F.verteileTage([{ schluessel: 'x', stufe: 1, motiv: null, partie: null, rang: 0 }], { wochenMin: 1, wochenMax: 2 }); } catch (e) { wirft = true; }
  pruefe('verteileTage bricht ab, wenn keine ganze Woche moeglich ist', wirft);
}

const fehlend = ergebnisse.filter((r) => !r.ok);
console.log(`\n${ergebnisse.length - fehlend.length}/${ergebnisse.length} bestanden`);
for (const f of fehlend) console.log('FEHLER: ' + f.name);
process.exit(fehlend.length ? 1 : 0);
