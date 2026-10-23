// Tests fuer das Paket "kartei" (Welle A, A3: Fehler-Kartei) und den Raetsel-Bildschirm (js/ui/raetsel.js).
// Node-Teil ohne Browser: Karten aus einer Beispiel-Analyse (Auswahlregel, eindeutige Loesung, hoechstens 3, die
// schwersten zuerst, Uebungen nie, idempotent, Rueckfall), Wiederholung 1, 3, 7, 14, 30 Tage ueber die Tagesgrenze 4:00
// und das Ende der Sommerzeit, fuer immer geloest, Tagesdeckel 10, Ausduennen, kaputte Daten, Aufgaben und Texte,
// Test-Raetsel mit chess.js geprueft, CSS nur mit Tokens. Danach Browser-Teil (Playwright, Chromium) gegen die echte App
// mit ?test&erw=pakete/kartei/index: Raetsel-Bildschirm (richtig, falsch mit Hinweis, zweimal falsch und Loesung mit
// Pfeil, mehrzuegig mit Antwort des Gegners, gedrehtes Brett, Zusammenfassung, ohne Aufgaben zur Arena), Kartei im
// Training und in der Heute-Karte, Antworten im Modul und als Ereignisse, Leer-Zustaende, eine echte Partie mit Fehler
// (Feier-Zeile im Ergebnis, Karte, Loesen), Nachtrag gespeicherter Analysen, Handy hell und dunkel, Laden ueber PAKETE.
//
//   node tests/kartei.test.mjs                 alles
//   node tests/kartei.test.mjs --nur-node      ohne Browser
//   node tests/kartei.test.mjs --ohne-bilder   ohne Bildschirmfotos
//   PORT=9700 BILDER=<ordner> node tests/kartei.test.mjs
//
// Playwright: PLAYWRIGHT_PFAD, sonst 'playwright', sonst /opt/node-tools/node_modules/playwright.
// Tage und Tagesgrenze wie auf Flos iPad (Node und Browser rechnen in derselben Zeitzone)
process.env.TZ = 'Europe/Berlin';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readFileSync, mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { browserTyp } from './browser.mjs';

const require = createRequire(import.meta.url);
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8863);
const ERW = 'pakete/kartei/index';
const BASIS = `http://127.0.0.1:${PORT}/index.html?test&erw=${ERW}`;
const NUR_NODE = process.argv.includes('--nur-node');
const OHNE_BILDER = process.argv.includes('--ohne-bilder');
// Bilder nie ins Repo (REGELN): Standard ist ein Ordner unter dem Temp-Verzeichnis
const BILDER = process.env.BILDER || path.join(os.tmpdir(), 'crownmate-bilder', 'kartei');
const lies = (d) => readFileSync(path.join(WURZEL, d), 'utf8');
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

const ergebnisse = [];
let gruppe = '';
function pruefe(name, ok, detail = '') {
  ergebnisse.push({ name: (gruppe ? gruppe + ': ' : '') + name, ok: !!ok, detail });
  console.log(`${ok ? 'ok  ' : 'FEHLER'} ${gruppe ? gruppe + ': ' : ''}${name}${!ok && detail ? ' (' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) + ')' : ''}`);
}

// ---------- Test-Raetsel (im Node-Teil mit chess.js geprueft) ----------
// Weiss gewinnt die Dame (Sxh4); anderes verliert sofort (Dxf2#). Dieselbe Stellung spielt die echte Partie unten.
const FEN_DAME = 'rnb1k1nr/pppp1ppp/8/2b1p3/4P2q/5N2/PPPP1PPP/RNBQKB1R w KQkq - 4 4';
const R_MATT1 = { id: 'r-matt1', fen: 'k7/8/1K6/8/8/8/8/7Q w - - 0 1', loesung: ['h1h8'], titel: 'Matt in 1', hinweis: 'Die Dame hat einen weiten Weg.' };
const R_DAME = { id: 'r-dame', fen: FEN_DAME, loesung: ['f3h4'], titel: 'Finde den besseren Zug', text: 'Probe', hinweis: 'Schau dir den Springer auf f3 an.', marke: 'Weit daneben', klasse: 'patzer', vorZug: 'e7e5' };
const R_GRUND = { id: 'r-grund', fen: '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1', loesung: ['a1a8'], titel: 'Grundreihe', erklaerung: 'Die Grundreihe ist dicht.' };
const R_ZWEI = { id: 'r-zwei', fen: '4r1k1/3q1ppp/8/8/8/8/4QPPP/4R1K1 w - - 0 1', loesung: ['e2e8', 'd7e8', 'e1e8'], titel: 'Matt in 2' };
const R_SCHWARZ = { id: 'r-schwarz', fen: 'r5k1/5ppp/8/8/8/8/5PPP/6K1 b - - 0 1', loesung: ['a8a1'], titel: 'Schwarz setzt matt' };
const TEST_LISTE = [R_MATT1, R_DAME, R_GRUND, R_ZWEI, R_SCHWARZ];

// Beispiel-Analyse: Felder wie js/review.js baueEintrag (gewinnVorher/-Zweiter aus Sicht des Ziehenden)
const E = (ply, farbe, klasse, uci, besterZug, gewinnVorher, gewinnZweiter, verlust, extra = {}) => ({
  ply, farbe, nummer: Math.floor(ply / 2) + 1, san: 'Sf3', sanDe: 'Sf3', uci, fenVorher: FEN_DAME.replace(' w ', farbe === 'w' ? ' w ' : ' b '),
  besterZug, besterZugSan: 'Nxh4', besterZugSanDe: 'Sxh4', klasse, verlust, gewinnVorher, gewinnNachher: gewinnVorher - verlust, gewinnZweiter,
  coach: 'Weit daneben! Lässt Matt in 1 zu. Besser war Sxh4.', ...extra,
});
// je Zug eine eigene Stellung (der Halbzugzaehler macht den Stellungsschluessel nicht verschieden, das Brett schon)
const FENS = [
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
  'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2', 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2',
  'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3', 'r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3',
  'r1bqkbnr/1ppp1ppp/p1n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4', 'r1bqkbnr/1ppp1ppp/p1n5/4p3/B3P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 1 4',
  'r1bqkb1r/1ppp1ppp/p1n2n2/4p3/B3P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 2 5', 'r1bqkb1r/1ppp1ppp/p1n2n2/4p3/B3P3/5N2/PPPP1PPP/RNBQ1RK1 b kq - 3 5',
  'r1bqk2r/1pppbppp/p1n2n2/4p3/B3P3/5N2/PPPP1PPP/RNBQ1RK1 w kq - 4 6', 'r1bqk2r/1pppbppp/p1n2n2/4p3/B3P3/5N2/PPPP1PPP/RNBQR1K1 b kq - 5 6',
  'r1bqk2r/2ppbppp/p1n2n2/1p2p3/B3P3/5N2/PPPP1PPP/RNBQR1K1 w kq - 0 7', 'r1bqk2r/2ppbppp/p1n2n2/1p2p3/4P3/1B3N2/PPPP1PPP/RNBQR1K1 b kq - 1 7',
  'r1bqk2r/2p1bppp/p1np1n2/1p2p3/4P3/1B3N2/PPPP1PPP/RNBQR1K1 w kq - 0 8', 'r1bqk2r/2p1bppp/p1np1n2/1p2p3/4P3/1BP2N2/PP1P1PPP/RNBQR1K1 b kq - 0 8',
];
function beispielReview() {
  const z = [];
  for (let i = 0; i < 16; i++) {
    const farbe = i % 2 === 0 ? 'w' : 'b';
    z.push({ ply: i, farbe, nummer: Math.floor(i / 2) + 1, san: 'e4', sanDe: 'e4', uci: i === 0 ? 'e2e4' : 'a2a3', fenVorher: FENS[i],
      besterZug: 'g1f3', besterZugSan: 'Nf3', besterZugSanDe: 'Sf3', klasse: 'gut', verlust: 0.02, gewinnVorher: 0.55, gewinnNachher: 0.53, gewinnZweiter: 0.54,
      coach: 'Solide.' });
  }
  const setze = (i, teil) => Object.assign(z[i], teil);
  setze(2, { klasse: 'patzer', uci: 'd1h5', san: 'Qh5', sanDe: 'Dh5', besterZug: 'g1f3', besterZugSanDe: 'Sf3', verlust: 0.6, gewinnVorher: 0.9, gewinnZweiter: 0.5, coach: 'Weit daneben! Verliert die Dame. Besser war Sf3.' });
  setze(4, { klasse: 'fehler', uci: 'f1c4', besterZug: 'f1b5', verlust: 0.15, gewinnVorher: 0.6, gewinnZweiter: 0.4 });
  setze(6, { klasse: 'verpasst', uci: 'b5c6', besterZug: 'b5a4', verlust: 0.3, gewinnVorher: 0.8, gewinnZweiter: 0.55 });
  setze(8, { klasse: 'fehler', uci: 'e1g1', besterZug: 'd2d3', verlust: 0.12, gewinnVorher: 0.5, gewinnZweiter: 0.3 });   // vierte: faellt weg
  setze(10, { klasse: 'patzer', uci: 'f1e1', besterZug: 'c2c3', verlust: 0.5, gewinnVorher: 0.7, gewinnZweiter: 0.65 });  // nicht eindeutig
  setze(12, { klasse: 'fehler', uci: 'a4b3', besterZug: 'a4c2', verlust: 0.18, gewinnVorher: 0.2, gewinnZweiter: 0.01 }); // vorher schon verloren
  setze(14, { klasse: 'patzer', uci: 'c2c3', besterZug: 'h2h3', verlust: 0.4, gewinnVorher: 0.8, gewinnZweiter: null });  // keine zweite Linie
  setze(9, { klasse: 'patzer', uci: 'e8g8', besterZug: 'd7d6', verlust: 0.7, gewinnVorher: 0.9, gewinnZweiter: 0.2 });     // Zug des Bots
  setze(11, { klasse: 'ungenau', verlust: 0.08 });
  return { zuege: z, genauigkeit: { w: 70, b: 60 } };
}

// =====================================================================
// Node-Teil
// =====================================================================
async function nodeTeil() {
  const sp = new Map();
  globalThis.localStorage = {
    get length() { return sp.size; }, key: (i) => [...sp.keys()][i] ?? null, getItem: (k) => (sp.has(k) ? sp.get(k) : null),
    setItem: (k, v) => sp.set(k, String(v)), removeItem: (k) => sp.delete(k), clear: () => sp.clear(),
  };
  const storage = await import('../js/storage.js');
  storage.setzeSpeicher(globalThis.localStorage);
  const L = await import('../js/pakete/kartei/logik.js');
  const T = await import('../js/tag.js');
  const { Chess } = await import('../vendor/chess/chess.js');
  const { stellungsSchluessel } = await import('../js/openings.js');
  const { QUELLEN } = await import('../js/feier.js');
  const { EREIGNISSE } = await import('../js/ereignisse.js');
  const { ORTE } = await import('../js/orte.js');

  gruppe = 'Grundwerte';
  pruefe('Abstaende 1, 3, 7, 14, 30 Tage, danach fuer immer geloest (Stufe 6)', JSON.stringify(L.ABSTAENDE) === '[1,3,7,14,30]' && L.GELOEST === 6 && Object.isFrozen(L.ABSTAENDE));
  pruefe('Tagesdeckel 10 (SPIELKONZEPT 2.2), hoechstens 3 Karten je Partie', L.TAGES_MAX === 10 && L.JE_PARTIE === 3);
  pruefe('Modul "kartei" im Budget (160.000 Zeichen), Paket rechnet mit demselben Wert', storage.MODUL_BUDGET.kartei === 160000 && L.BUDGET === 160000 && L.MODUL === 'kartei');
  pruefe('Feier-Quelle "karten" ist eine Zeile mit Prio 30', QUELLEN.karten && QUELLEN.karten.art === 'zeile' && QUELLEN.karten.prio === 30);
  pruefe('Ereignisse training:geloest und training:stand, Orte training:karten und arena:heute gibt es', EREIGNISSE.includes('training:geloest')
    && EREIGNISSE.includes('training:stand') && ORTE['training:karten'] === 'dom' && ORTE['arena:heute'] === 'dom');

  // ---------- Karten aus einer Beispiel-Analyse ----------
  gruppe = 'Karten';
  const partie = { id: 'pbsp1', spielerFarbe: 'w', botId: 'rudi', datum: new Date(2026, 9, 20, 18, 30).toISOString(), modus: 'normal' };
  const kand = L.kandidaten(beispielReview(), partie);
  pruefe('genau 3 Kandidaten: Patzer, Verschenkt, Fehler, nach Verlust (0,6 · 0,3 · 0,15)', kand.length === 3
    && kand.map((k) => k.klasse).join() === 'patzer,verpasst,fehler' && kand.map((k) => k.ply).join() === '2,6,4', kand.map((k) => `${k.klasse}@${k.ply}`));
  pruefe('nie: Zug des Bots, ungenau, nicht eindeutig (zweitbester 0,05 dahinter), vorher schon verloren (0,2), ohne zweite Linie, vierter Fehler',
    !kand.some((k) => [9, 10, 11, 12, 14, 8].includes(k.ply)));
  const k0 = kand[0];
  pruefe('Karte: { fen, besterZug, gespielt, klasse, partieId, ply, botId } aus der Analyse, dazu Zug davor und deutsche Zuege', k0.id === 'pbsp1:2'
    && k0.fen === FENS[2] && k0.besterZug === 'g1f3' && k0.gespielt === 'd1h5' && k0.klasse === 'patzer' && k0.partieId === 'pbsp1' && k0.ply === 2
    && k0.botId === 'rudi' && k0.vor === 'a2a3' && k0.san === 'Dh5' && k0.loesungSan === 'Sf3' && k0.nummer === 2 && k0.farbe === 'w', k0);
  pruefe('Coach-Satz ohne Klassenwort (coachKern), hoechstens 160 Zeichen', k0.coach === 'Verliert die Dame. Besser war Sf3.' && k0.coach.length <= L.COACH_MAX, k0.coach);
  const kandS = L.kandidaten(beispielReview(), { ...partie, spielerFarbe: 'b' });
  pruefe('Flo mit Schwarz: nur schwarze Zuege (der Patzer im 9. Halbzug)', kandS.length === 1 && kandS[0].ply === 9 && kandS[0].farbe === 'b', kandS);
  pruefe('Uebung: keine Karten (auch bei Fehlern)', L.kandidaten(beispielReview(), { ...partie, modus: 'uebung' }).length === 0);
  pruefe('ohne Review oder Partie: nichts', L.kandidaten(null, partie).length === 0 && L.kandidaten({ zuege: [] }, partie).length === 0 && L.kandidaten(beispielReview(), null).length === 0);

  const heute = '2026-10-21';
  const tagVon = (ms) => T.tagSchluessel(ms);
  const r1 = L.fuegeHinzu(null, partie, beispielReview(), heute, { tagVon });
  pruefe('fuegeHinzu: 3 neue Karten, Stufe 0, heute faellig, Tag der Partie aus tag.js', r1.neu.length === 3 && r1.modul.karten.every((k) => k.stufe === 0
    && k.faellig === heute && k.erstellt === heute && k.datum === '2026-10-20') && r1.modul.zaehler.erstellt === 3 && r1.modul.verarbeitet.join() === 'pbsp1', r1.modul.karten.map((k) => [k.stufe, k.faellig, k.datum]));
  const r2 = L.fuegeHinzu(r1.modul, partie, beispielReview(), heute, { tagVon });
  pruefe('zweimal partie:analysiert derselben Partie: keine Doppelten (doppelt, Modul gleich)', r2.doppelt && r2.neu.length === 0 && r2.modul.karten.length === 3
    && JSON.stringify(r2.modul) === JSON.stringify(r1.modul));
  // dieselbe Stellung in einer neuen Partie: Rueckfall, auch wenn die Karte schon fuer immer geloest war
  const m3 = JSON.parse(JSON.stringify(r1.modul));
  Object.assign(m3.karten[0], { stufe: 6, faellig: '', richtig: 6 });
  m3.zaehler.gemeistert = 1;
  const z2 = beispielReview();
  const partie2 = { ...partie, id: 'pbsp2', datum: new Date(2026, 9, 22, 21, 0).toISOString() };
  const r3 = L.fuegeHinzu(m3, partie2, z2, '2026-10-22', { tagVon });
  const rk = r3.modul.karten.find((k) => k.id === 'pbsp1:2');
  pruefe('gleiche Stellung noch einmal: keine neue Karte, rueckfaelle + 1, wieder Stufe 0 und heute faellig, Bild der neuen Partie', r3.neu.length === 0
    && r3.rueckfall.length === 3 && r3.modul.karten.length === 3 && rk.rueckfaelle === 1 && rk.stufe === 0 && rk.faellig === '2026-10-22' && rk.partieId === 'pbsp2'
    && rk.datum === '2026-10-22' && rk.richtig === 6, rk);
  pruefe('Rueckfall: der Zaehler "fuer immer geloest" sinkt nie', r3.modul.zaehler.gemeistert === 1 && r3.modul.zaehler.erstellt === 3);
  let mv = L.leeresModul();
  for (let i = 0; i < 320; i++) mv = L.fuegeHinzu(mv, { ...partie, id: 'pv' + i }, { zuege: [] }, heute, { tagVon }).modul;
  pruefe('verarbeitete Partien: hoechstens 300 (die neuesten)', mv.verarbeitet.length === 300 && mv.verarbeitet[0] === 'pv20' && mv.verarbeitet[299] === 'pv319');

  // ---------- Wiederholung ueber Tagesgrenzen ----------
  gruppe = 'Wiederholung';
  const tag = (j, mo, t, h, mi = 0) => T.tagSchluessel(new Date(j, mo - 1, t, h, mi));
  let m = L.fuegeHinzu(null, { ...partie, id: 'pw1' }, beispielReview(), tag(2026, 10, 21, 18), { tagVon }).modul;
  const id = 'pw1:2';
  const karte = (mm) => mm.karten.find((k) => k.id === id);
  const faelligAm = (mm, t) => L.faellige(mm, t).some((k) => k.id === id);
  let b = L.beantworte(m, id, { richtig: true, versuch: 1, heute: tag(2026, 10, 21, 18) });
  m = b.modul;
  pruefe('neu und richtig im ersten Versuch: Stufe 1, wieder morgen', b.info.stufe === 1 && karte(m).faellig === '2026-10-22' && b.info.tage === 1 && b.info.ersterVersuch);
  pruefe('22.10. 03:59 gehoert noch zum 21.10. (nicht faellig), 04:00 ist faellig', !faelligAm(m, tag(2026, 10, 22, 3, 59)) && faelligAm(m, tag(2026, 10, 22, 4, 0)));
  b = L.beantworte(m, id, { richtig: true, versuch: 1, heute: tag(2026, 10, 23, 2, 30) });   // nachts: zaehlt zum 22.10.
  m = b.modul;
  pruefe('richtig um 02:30 am 23.10. zaehlt fuer den 22.10.: Stufe 2, faellig 3 Tage spaeter (25.10.)', b.info.stufe === 2 && karte(m).faellig === '2026-10-25' && karte(m).geuebt === '2026-10-22');
  // Ende der Sommerzeit am 25.10.2026: 02:00 bis 02:59 kommen doppelt vor und gehoeren noch zum 24.10.
  pruefe('Sommerzeit-Ende: 25.10. 02:30 (doppelte Stunde) ist noch der 24.10., nicht faellig; 25.10. 04:00 faellig',
    !faelligAm(m, tag(2026, 10, 25, 2, 30)) && T.tagSchluessel(new Date(2026, 9, 25, 2, 30)) === '2026-10-24' && faelligAm(m, tag(2026, 10, 25, 4)));
  b = L.beantworte(m, id, { richtig: true, versuch: 1, heute: '2026-10-25' });
  m = b.modul;
  pruefe('Stufe 3: 7 Tage (01.11.)', b.info.stufe === 3 && karte(m).faellig === '2026-11-01');
  b = L.beantworte(m, id, { richtig: true, versuch: 1, heute: '2026-11-01' });
  m = b.modul;
  pruefe('Stufe 4: 14 Tage (15.11.)', b.info.stufe === 4 && karte(m).faellig === '2026-11-15');
  b = L.beantworte(m, id, { richtig: true, versuch: 1, heute: '2026-11-15' });
  m = b.modul;
  pruefe('Stufe 5: 30 Tage (15.12.)', b.info.stufe === 5 && karte(m).faellig === '2026-12-15' && !b.info.gemeistert);
  pruefe('vorher nicht faellig (14.12.), am 15.12. faellig', !faelligAm(m, '2026-12-14') && faelligAm(m, '2026-12-15'));
  b = L.beantworte(m, id, { richtig: true, versuch: 1, heute: '2026-12-20' });
  m = b.modul;
  pruefe('nach Stufe 30 Tage richtig: fuer immer geloest (Stufe 6, nie mehr faellig, Zaehler + 1)', b.info.stufe === 6 && b.info.gemeistert
    && karte(m).faellig === '' && m.zaehler.gemeistert === 1 && !faelligAm(m, '2027-06-01'), karte(m));
  // falsch: zurueck auf 1
  let mf = L.fuegeHinzu(null, { ...partie, id: 'pf1' }, beispielReview(), '2026-10-21', { tagVon }).modul;
  for (const t of ['2026-10-21', '2026-10-22', '2026-10-25']) mf = L.beantworte(mf, 'pf1:2', { richtig: true, versuch: 1, heute: t }).modul;
  const vor = mf.karten.find((k) => k.id === 'pf1:2').stufe;
  const bf = L.beantworte(mf, 'pf1:2', { richtig: false, versuch: 2, heute: '2026-11-01' });
  pruefe('falsch (Loesung gezeigt) auf Stufe 3: zurueck auf Stufe 1, wieder morgen, falsch + 1', vor === 3 && bf.info.stufe === 1 && bf.info.faellig === '2026-11-02'
    && bf.karte.falsch === 1 && !bf.info.ersterVersuch);
  const b2 = L.beantworte(bf.modul, 'pf1:2', { richtig: true, versuch: 2, heute: '2026-11-02' });
  pruefe('im zweiten Versuch geloest zaehlt fuer den Plan nicht als richtig: Stufe 1, wieder morgen (richtig + 1 fuer die Statistik)',
    b2.info.stufe === 1 && b2.info.faellig === '2026-11-03' && b2.karte.richtig === 4 && b2.info.richtig && !b2.info.ersterVersuch);
  pruefe('unbekannte Karte oder kein Tag: null', L.beantworte(mf, 'gibtsnicht:1', { richtig: true, heute: '2026-11-01' }) === null
    && L.beantworte(mf, 'pf1:2', { richtig: true, heute: 'gestern' }) === null);

  // ---------- Tagesdeckel ----------
  gruppe = 'Tagesdeckel';
  const viele = L.leeresModul();
  for (let i = 0; i < 15; i++) {
    viele.karten.push({ ...kand[0], id: `pd${i}:2`, fen: FENS[i], partieId: 'pd' + i, stufe: 0, faellig: i < 5 ? '2026-10-18' : '2026-10-21',
      erstellt: '2026-10-18', geuebt: '', richtig: 0, falsch: 0, rueckfaelle: 0, datum: '2026-10-18' });
  }
  const f1 = L.faellige(viele, '2026-10-21');
  pruefe('15 faellige Karten: der Stapel des Tages hat 10, die aeltesten zuerst', f1.length === 10 && f1.slice(0, 5).every((k) => k.faellig === '2026-10-18'));
  let md = viele;
  for (const k of f1.slice(0, 4)) md = L.beantworte(md, k.id, { richtig: true, versuch: 1, heute: '2026-10-21' }).modul;
  const f2 = L.faellige(md, '2026-10-21');
  pruefe('4 geuebt: noch 6 im Stapel, obwohl 11 faellig sind (Ueberhang bleibt still faellig)', f2.length === 6 && L.stand(md, '2026-10-21').faellig === 6
    && md.karten.filter((k) => k.faellig <= '2026-10-21').length === 11, f2.length);
  pruefe('auch neue Karten nach dem Deckel warten (geuebt heute zaehlt mit)', L.geuebtHeute(md, '2026-10-21') === 4 && L.faellige(md, '2026-10-21').every((k) => !md.heute.ids.includes(k.id)));
  for (const k of f2) md = L.beantworte(md, k.id, { richtig: false, versuch: 1, heute: '2026-10-21' }).modul;
  pruefe('10 geuebt: Stapel leer, naechster Tag ist morgen (5 Karten warten)', L.faellige(md, '2026-10-21').length === 0 && L.naechsterTag(md, '2026-10-21') === '2026-10-22');
  pruefe('am naechsten Tag (Grenze 4:00) wieder bis zu 10: 6 von gestern falsch + 5 Ueberhang = 11, also 10', L.faellige(md, '2026-10-22').length === 10
    && L.stand(md, '2026-10-22').faellig === 10);
  pruefe('stand(): faellig, gesamt (ohne geloeste), gemeistert', JSON.stringify(L.stand(md, '2026-10-22')) === '{"faellig":10,"gesamt":15,"gemeistert":0}');
  pruefe('naechsterTag: heute, wenn noch etwas im Stapel; ohne Karten null', L.naechsterTag(md, '2026-10-22') === '2026-10-22' && L.naechsterTag(L.leeresModul(), '2026-10-22') === null);
  const nurSpaeter = L.beantworte(L.fuegeHinzu(null, { ...partie, id: 'pn1' }, { zuege: [beispielReview().zuege[2]] }, '2026-10-21', { tagVon }).modul, 'pn1:2',
    { richtig: true, versuch: 1, heute: '2026-10-21' }).modul;
  pruefe('naechsterTag: sonst der Tag der naechsten faelligen Karte', L.naechsterTag(nurSpaeter, '2026-10-21') === '2026-10-22');

  // ---------- Ausduennen, kaputte Daten ----------
  gruppe = 'Speicher';
  const voll = L.leeresModul();
  for (let i = 0; i < 420; i++) {
    voll.karten.push({ ...kand[0], id: `px${i}:2`, partieId: 'px' + i, coach: 'x'.repeat(150), stufe: i < 30 ? 6 : i < 60 ? 5 : 1,
      faellig: i < 30 ? '' : '2026-10-30', erstellt: `2026-0${1 + (i % 9)}-1${i % 10}`, geuebt: '', richtig: 0, falsch: 0, rueckfaelle: 0, datum: '2026-01-10' });
  }
  voll.zaehler.gemeistert = 30;
  const duenn = L.duenneAus(L.normalisiereModul(voll));
  const laenge = JSON.stringify(duenn).length;
  pruefe('ueber 380 Karten oder dem Budget: zuerst die fuer immer geloesten, dann Stufe 5, erst danach Stufe 1; der Zaehler bleibt',
    duenn.karten.length <= L.MAX_KARTEN && !duenn.karten.some((k) => k.stufe === 6)
    && (duenn.karten.filter((k) => k.stufe === 1).length === 360 || !duenn.karten.some((k) => k.stufe === 5)) && duenn.zaehler.gemeistert === 30,
    { n: duenn.karten.length, s5: duenn.karten.filter((k) => k.stufe === 5).length, s1: duenn.karten.filter((k) => k.stufe === 1).length });
  pruefe('danach unter dem Budget von 160.000 Zeichen', laenge <= 160000, laenge);
  const eng = L.duenneAus(L.normalisiereModul(voll), 40000);
  pruefe('kleines Budget: Stufe 1 bleibt am laengsten (aelteste zuerst raus)', JSON.stringify(eng).length <= 40000 && eng.karten.every((k) => k.stufe === 1), eng.karten.length);
  const kaputt = L.normalisiereModul({ v: 1, karten: [null, 5, { id: 'x' }, { ...kand[0], id: 'pk:1', fen: 'kein fen', stufe: 0, faellig: '2026-10-21' },
    { ...kand[0], id: 'pk:2', besterZug: 'e9e4', stufe: 0, faellig: '2026-10-21' }, { ...kand[0], id: 'pk:3', klasse: 'gut', stufe: 0, faellig: '2026-10-21' },
    { ...kand[0], id: 'pk:4', stufe: 0, faellig: '2026-10-21' }, { ...kand[0], id: 'pk:4', stufe: 3, faellig: '2026-10-21' }], verarbeitet: 'x', heute: 7, zaehler: { gemeistert: -1 } });
  pruefe('kaputte Karten fallen weg (FEN, Zug, Klasse, doppelte ID), Rest bleibt, Zaehler nie negativ', kaputt.karten.length === 1 && kaputt.karten[0].id === 'pk:4'
    && kaputt.karten[0].stufe === 0 && kaputt.verarbeitet.length === 0 && kaputt.heute.tag === '' && kaputt.zaehler.gemeistert === 0, kaputt);
  pruefe('Muell statt Modul: leeres Modul', JSON.stringify(L.normalisiereModul([1, 2])) === JSON.stringify(L.leeresModul())
    && JSON.stringify(L.normalisiereModul('x')) === JSON.stringify(L.leeresModul()) && L.normalisiereModul(null).karten.length === 0);
  storage.speichereModul('kartei', r1.modul);
  pruefe('Modul passt in den Speicher (speichereModul ok, ladeModul liest es gleich)', JSON.stringify(L.normalisiereModul(storage.ladeModul('kartei', L.leeresModul()))) === JSON.stringify(r1.modul));

  // ---------- Aufgaben und Texte ----------
  gruppe = 'Aufgabe';
  const a = L.alsAufgabe(r1.modul.karten[0], { botName: 'Ritter Rudi', heute: '2026-10-21' });
  pruefe('Aufgabe fuer den Raetsel-Bildschirm: { fen, loesung: [besterZug], titel, hinweis } und mehr', a.fen === FENS[2] && JSON.stringify(a.loesung) === '["g1f3"]'
    && a.titel === 'Finde den besseren Zug' && a.hinweis === 'Schau dir den Springer auf g1 an.' && a.vorZug === 'a2a3' && a.marke === 'Weit daneben' && a.klasse === 'patzer', a);
  pruefe('Satz: "Gestern gegen Ritter Rudi hast du hier 2. Dh5 gespielt." (geschuetztes Leerzeichen)', a.text === 'Gestern gegen Ritter Rudi hast du hier 2. Dh5 gespielt.', a.text);
  const a2 = L.alsAufgabe({ ...r1.modul.karten[0], farbe: 'b', datum: '2026-10-12' }, { botName: '', heute: '2026-10-21' });
  pruefe('Schwarz und ohne Bot: "Am 12. Okt. hast du hier 2. … Dh5 gespielt."', a2.text === 'Am 12. Okt. hast du hier 2. … Dh5 gespielt.', a2.text);
  pruefe('heute: "Heute gegen …"', L.alsAufgabe({ ...r1.modul.karten[0], datum: '2026-10-21' }, { botName: 'Bauer Benno', heute: '2026-10-21' }).text.startsWith('Heute gegen Bauer Benno'));
  pruefe('Erklaerung aus dem Coach-Satz, mit dem alten Zug davor', a.erklaerung === '2.\u00a0Dh5: Verliert die Dame. Besser war Sf3.', a.erklaerung);
  pruefe('Loesung jeder Aufgabe aus der Kartei ist mit chess.js spielbar', r1.modul.karten.every((k) => {
    const c = new Chess(k.fen);
    try { return !!c.move({ from: k.besterZug.slice(0, 2), to: k.besterZug.slice(2, 4), promotion: k.besterZug[4] }); } catch (e) { return false; }
  }));
  pruefe('Rueckmeldungen: Abstand in Worten, fuer immer geloest, zweiter Anlauf, Loesung', L.rueckmeldung({ ersterVersuch: true, tage: 3 }).text === 'Die Karte kommt in 3 Tagen wieder.'
    && L.rueckmeldung({ ersterVersuch: true, tage: 1 }).text === 'Die Karte kommt morgen wieder.' && L.rueckmeldung({ gemeistert: true }).titel === 'Für immer gelöst!'
    && L.rueckmeldung({ richtig: true, tage: 1 }).titel === 'Gelöst im zweiten Anlauf.' && /^Kein Problem/.test(L.rueckmeldung({ richtig: false, tage: 1 }).text));
  const ende = L.endeText([{ info: { ersterVersuch: true } }, { info: { ersterVersuch: true, gemeistert: true } }, { info: { ersterVersuch: false } }]);
  pruefe('Zusammenfassung: "2 Karten weiter, 1 für immer gelöst, 1 Karte kommt morgen wieder."', ende.text === '2 Karten weiter, 1 für immer gelöst, 1 Karte kommt morgen wieder.', ende);
  pruefe('Feier-Text: 1 neue Karte / 2 neue Karten in deinem Stapel', L.neueKartenText(1) === '1 neue Karte in deinem Stapel' && L.neueKartenText(2) === '2 neue Karten in deinem Stapel');
  pruefe('Feier nach einer Partie: neue Karten zuerst (Rueckfaelle im Text), sonst "wieder in deinem Stapel", ohne beides keine Zeile',
    JSON.stringify(L.kartenFeier(2, 1)) === '{"titel":"2 neue Karten in deinem Stapel","text":"1 Karte ist wieder dabei."}'
    && L.kartenFeier(0, 2).titel === '2 Karten wieder in deinem Stapel' && L.kartenFeier(0, 1).titel === '1 Karte wieder in deinem Stapel'
    && L.kartenFeier(1, 0).text === '' && L.kartenFeier(0, 0) === null);
  const texte = [a.text, a.hinweis, ...['ersterVersuch', 'gemeistert', 'richtig'].map((x) => JSON.stringify(L.rueckmeldung({ [x]: true, tage: 3 }))), JSON.stringify(ende),
    lies('js/pakete/kartei/index.js'), lies('js/ui/raetsel.js')].join(' ');
  pruefe('kein Druck in den Texten (nichts "offen", nichts verfaellt, keine Restzeit)', !/noch offen|verfällt|läuft ab|nur noch|letzte Chance|beeil/i.test(texte));
  pruefe('keine rote Zahl: die Zahl der faelligen Karten steht in Text-Farben (CSS ohne --warn, --schlecht, --k-patzer an Zahlen)',
    !/--warn|--schlecht/.test(lies('css/pakete/kartei.css') + lies('css/pakete/raetsel.css')) && !/rs-punkte > i\.durch \{[^}]*--k-/.test(lies('css/pakete/raetsel.css')));

  // ---------- Test-Raetsel mit chess.js ----------
  gruppe = 'Test-Rätsel';
  const spiele = (r) => { const c = new Chess(r.fen); for (const u of r.loesung) c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }); return c; };
  pruefe('Matt in 1 (Dh8#), Grundreihe (Ta8#), Matt in 2 (Dxe8+ Dxe8 Txe8#), Schwarz (Ta1#): Loesungen setzen matt',
    [R_MATT1, R_GRUND, R_ZWEI, R_SCHWARZ].every((r) => spiele(r).isCheckmate()));
  pruefe('Matt in 2: die Antwort des Gegners ist erzwungen (einziger Zug)', (() => { const c = new Chess(R_ZWEI.fen); c.move('Qxe8+'); return c.moves().length === 1 && c.moves()[0] === 'Qxe8'; })());
  pruefe('Damen-Stellung: Sxh4 legal, a3 laesst Dxf2# zu', (() => { const c = new Chess(FEN_DAME); c.move('a3'); c.move('Qxf2#'); return c.isCheckmate(); })()
    && (() => { const c = new Chess(FEN_DAME); return !!c.move('Nxh4'); })());
  pruefe('Schwarz am Zug wird gedreht gezeigt', new Chess(R_SCHWARZ.fen).turn() === 'b');
  pruefe('Stellungsschluessel ohne Zugzaehler (Rueckfall auch bei anderer Zugnummer)', stellungsSchluessel(FEN_DAME) === stellungsSchluessel(FEN_DAME.replace('4 4', '9 12')));

  // ---------- Dateien ----------
  gruppe = 'Dateien';
  const tokens = new Set([...lies('css/tokens.css').matchAll(/(--[a-z0-9-]+)\s*:/g), ...lies('css/themes/modern.css').matchAll(/(--[a-z0-9-]+)\s*:/g)].map((x) => x[1]));
  for (const datei of ['css/pakete/kartei.css', 'css/pakete/raetsel.css']) {
    const css = lies(datei).replace(/\/\*[\s\S]*?\*\//g, '');
    const genutzt = [...new Set([...css.matchAll(/var\((--[a-z0-9-]+)/g)].map((x) => x[1]))].filter((t) => !['--rs-b', '--rs-seite', '--rs-luft', '--brett-radius'].includes(t));
    pruefe(`${datei}: nur Tokens (keine Hex-, rgb- oder Farbnamen-Werte)`, !/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|(?<![-\w])(white|black|red|green|blue)(?![-\w])/.test(css));
    pruefe(`${datei}: nur vorhandene Tokens`, genutzt.length > 5 && genutzt.every((t) => tokens.has(t)), genutzt.filter((t) => !tokens.has(t)));
    pruefe(`${datei}: animiert nur transform und opacity (Transitions)`, [...css.matchAll(/transition:\s*([^;]+);/g)].every((x) => x[1].split(',')
      .every((t) => /^\s*(transform|opacity|background-color)\b/.test(t))), [...css.matchAll(/transition:\s*([^;]+);/g)].map((x) => x[1]));
  }
  const app = lies('js/app.js');
  pruefe('app.js unveraendert: raetsel ist ein Paket-Screen (fehlt die Datei, geht es zur Arena)', /PAKET_SCREENS = new Set\(\[[^\]]*'raetsel'/.test(app));
  // vor der Integration nur ein Hinweis; steht das Paket in PAKETE, muessen Raetsel-Bildschirm und Paket-Dateien offline
  // da sein (sw.test.mjs erzwingt css/pakete/raetsel.css nicht: die Datei gehoert dem Namen nach dem Paket "raetsel")
  const eingetragen = /['"]pakete\/kartei\/index['"]/.test(lies('js/erweiterungen.js').replace(/\/\/.*$/gm, ''));
  const swText = lies('sw.js');
  const noetig = ['js/ui/raetsel.js', 'css/pakete/raetsel.css', 'css/pakete/kartei.css', 'js/pakete/kartei/index.js', 'js/pakete/kartei/logik.js'];
  pruefe(eingetragen ? 'in PAKETE: Raetsel-Bildschirm, sein CSS und alle Paket-Dateien im Offline-Cache (sw.js DATEIEN)'
    : 'noch nicht in PAKETE (traegt die Integration ein, dann mit Raetsel-Bildschirm und CSS in sw.js DATEIEN)',
  !eingetragen || noetig.every((d) => swText.includes(`'${d}'`)), noetig.filter((d) => !swText.includes(`'${d}'`)));
  const logikCode = lies('js/pakete/kartei/logik.js').replace(/\/\/.*$/gm, '');
  pruefe('logik.js: kein Math.random, kein toISOString, keine Uhr (Date.now/new Date)', !/Math\.random|toISOString|Date\.now|new Date/.test(logikCode));
}

// =====================================================================
// Browser-Teil
// =====================================================================
function ladePlaywright() {
  for (const k of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
    try { return require(k); } catch (e) { /* naechster */ }
  }
  throw new Error('Playwright nicht gefunden (PLAYWRIGHT_PFAD setzen)');
}
async function warteAufServer(url, ms = 10000) {
  const ende = Date.now() + ms;
  while (Date.now() < ende) {
    try { const r = await fetch(url); if (r.ok) return; } catch (e) { /* noch nicht da */ }
    await warte(150);
  }
  throw new Error('Server startet nicht: ' + url);
}

async function neueSeite(browser, { w = 1180, h = 820, handy = false, dunkel = false } = {}) {
  const kontext = await browser.newContext({
    viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: handy, isMobile: handy, colorScheme: dunkel ? 'dark' : 'light',
    timezoneId: 'Europe/Berlin',
  });
  const seite = await kontext.newPage();
  const fehler = [];
  seite.on('console', (m) => {
    if (m.type() !== 'error') return;
    const url = (m.location() && m.location().url) || '';
    if (/favicon/.test(url)) return;
    fehler.push(m.text() + (url ? ' @ ' + url : ''));
  });
  seite.on('pageerror', (e) => fehler.push('Seitenfehler: ' + e.message));
  return { kontext, seite, fehler };
}

// Bild erst, wenn Eintritte und Meldungen fertig eingeblendet sind (sonst halb durchsichtig)
const bild = async (seite, name) => { if (OHNE_BILDER) return; await warte(650); await seite.screenshot({ path: path.join(BILDER, name + '.png') }); };

// Speicher vorbereiten und neu laden
async function bereite(seite, { modul = null, partien = null, einstellungen = null } = {}, hash = '#arena') {
  await seite.evaluate(({ modul, partien, einstellungen }) => {
    localStorage.clear();
    if (modul) localStorage.setItem('schach-arena:v1:modul:kartei', JSON.stringify(modul));
    if (partien) localStorage.setItem('schach-arena:v1:partien', JSON.stringify(partien));
    if (einstellungen) localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify(einstellungen));
  }, { modul, partien, einstellungen });
  await seite.goto(BASIS + hash);
  await seite.reload();
  await seite.waitForFunction(() => !!window.__app && !!document.querySelector('link[data-paket="kartei"]') && !!document.querySelector('.screen'), null, { timeout: 20000 });
}

const rz = (seite) => seite.evaluate(async () => (await import('/js/ui/raetsel.js')).zustand());
const kz = (seite) => seite.evaluate(async () => (await import('/js/pakete/kartei/index.js')).zustand());
const heuteImBrowser = (seite) => seite.evaluate(async () => (await import('/js/tag.js')).tagSchluessel());

async function feld(seite, f, sel = '.screen.rs-screen') {
  const b = await seite.locator(`${sel} .brett-felder .feld[data-feld="${f}"]`).boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}
async function ziehe(seite, uci, { handy = false, sel = '.screen.rs-screen' } = {}) {
  for (const f of [uci.slice(0, 2), uci.slice(2, 4)]) {
    const p = await feld(seite, f, sel);
    if (handy) await seite.touchscreen.tap(p.x, p.y);
    else await seite.mouse.click(p.x, p.y);
    await warte(90);
  }
}
const figurAuf = (seite, f) => seite.evaluate((ff) => {
  const el = document.querySelector(`.screen.rs-screen .brett > .figur[data-feld="${ff}"]:not(.geht)`);
  return el ? el.dataset.figur : null;
}, f);
// synchron ueber window.__raetsel (waitForFunction wartet nicht auf ein Promise: eine async-Bedingung waere sofort wahr)
async function warteZustand(seite, fn, arg, ms = 8000) {
  await seite.waitForFunction(([f, a]) => {
    const z = window.__raetsel ? window.__raetsel.zustand() : { offen: false };
    return new Function('z', 'a', 'return ' + f)(z, a);
  }, [fn, arg], { timeout: ms });
}

// Karte fuer das Modul im Browser (heute faellig)
function karte(i, heute, extra = {}) {
  return { id: `pb${i}x:0`, fen: FEN_DAME, besterZug: 'f3h4', gespielt: 'a2a3', klasse: 'patzer', partieId: `pb${i}x`, ply: 0, botId: 'rudi', farbe: 'w',
    vor: null, san: 'a3', loesungSan: 'Sxh4', nummer: 4, coach: 'Lässt Matt in 1 zu. Besser war Sxh4.', datum: heute, gewinn: 0.93, verlust: 0.9,
    stufe: 0, faellig: heute, erstellt: heute, geuebt: '', richtig: 0, falsch: 0, rueckfaelle: 0, ...extra };
}
const modulMit = (karten, extra = {}) => ({ v: 1, karten, verarbeitet: [], heute: { tag: '', ids: [] }, zaehler: { erstellt: karten.length, gemeistert: 0, richtig: 0, falsch: 0 }, ...extra });

async function browserTeil(browser) {
  if (!OHNE_BILDER) mkdirSync(BILDER, { recursive: true });
  const { kontext, seite, fehler } = await neueSeite(browser);
  await seite.goto(BASIS + '#arena');
  await seite.waitForSelector('.screen.arena', { timeout: 20000 });
  const heute = await heuteImBrowser(seite);

  gruppe = 'Laden';
  const geladen = await seite.evaluate(async () => {
    const o = await import('/js/orte.js');
    const i = await import('/js/ui/icons.js');
    return { training: o.angeboten('training:karten'), heute: o.angeboten('arena:heute'), icon: i.iconNamen().includes('kartei'),
      css: !!document.querySelector('link[data-paket="kartei"]') };
  });
  pruefe('ueber ?erw geladen: Anbieter an training:karten und arena:heute, Icon, eigenes CSS', geladen.training === 1 && geladen.heute === 1 && geladen.icon && geladen.css, JSON.stringify(geladen));

  // ---------- Raetsel-Bildschirm mit einer festen Liste ----------
  gruppe = 'Rätsel';
  await seite.evaluate(() => { window.__ev = []; });
  await seite.evaluate((liste) => window.__app.gehe('raetsel', { liste, titel: 'Test-Rätsel', unter: 'Probe' }), TEST_LISTE);
  await seite.waitForSelector('.rs-screen .rs-brett .figur', { timeout: 10000 });
  let z = await rz(seite);
  const kopf = await seite.evaluate(() => ({ titel: document.querySelector('.rs-screen .marke-titel').textContent, zaehler: document.querySelector('.rs-zaehler').textContent,
    punkte: document.querySelectorAll('.rs-fortschritt .rs-punkte > i').length, css: !!document.querySelector('link[data-screen="raetsel"]'), hash: location.hash,
    amZug: document.querySelector('.rs-amzug').textContent.trim(), aus: document.querySelector('.rs-screen .brett').dataset.ausrichtung }));
  pruefe('Bildschirm offen: Kopf, Fortschritt oben "1 von 5" mit 5 Punkten, eigenes CSS, #raetsel', kopf.titel === 'Test-Rätsel' && kopf.zaehler === '1 von 5'
    && kopf.punkte === 5 && kopf.css && kopf.hash === '#raetsel' && z.gesamt === 5 && z.phase === 'flo', JSON.stringify({ kopf, z }));
  pruefe('Weiss am Zug: Brett nicht gedreht', kopf.amZug === 'Weiß am Zug' && kopf.aus === 'w');
  // 1) richtig im ersten Versuch
  await ziehe(seite, 'h1h8');
  await warteZustand(seite, 'z.phase === "geloest"');
  const r1 = await seite.evaluate(() => ({ haken: !!document.querySelector('.rs-screen .brett-striche .strich[data-art="haken"][data-nach="h8"]'),
    feld: !!document.querySelector('.rs-screen .lage.mark-k-bester[data-feld="h8"]'),
    meldung: document.querySelector('.rs-meldung').dataset.art, titel: document.querySelector('.rs-meldung b').textContent,
    weiter: !document.querySelector('.rs-weiter').hidden, zeigen: document.querySelector('.rs-zeigen').hidden, punkt: document.querySelector('.rs-fortschritt .rs-punkte > i').className }));
  z = await rz(seite);
  pruefe('richtig: Feder-Haken am Zielfeld (brett.striche, Feld markiert), Meldung "Richtig!", Knopf Weiter, Punkt gut', r1.haken && r1.feld && r1.meldung === 'richtig' && r1.titel === 'Richtig!'
    && r1.weiter && r1.zeigen && r1.punkt === 'gut' && z.ergebnisse[0].richtig && z.ergebnisse[0].versuch === 1, JSON.stringify({ r1, e: z.ergebnisse }));
  await bild(seite, 'raetsel-richtig-ipad');
  await seite.locator('.rs-weiter').click();
  await warteZustand(seite, 'z.index === 1 && z.phase === "flo"');
  // 2) falsch: Figur schnappt zurueck, Hinweis markiert die Figur, dann richtig im zweiten Versuch
  const vorMarke = await seite.evaluate(() => ({ marke: document.querySelector('.rs-marke').hidden ? '' : document.querySelector('.rs-marke').textContent.trim(),
    text: document.querySelector('.rs-status p').textContent, zuletzt: [...document.querySelectorAll('.rs-screen .lage.zuletzt')].map((l) => l.dataset.feld).sort().join() }));
  pruefe('Status mit Klasse des alten Zugs ("Weit daneben"), Text und dem Zug davor als letzter Zug', vorMarke.marke === 'Weit daneben' && vorMarke.text === 'Probe'
    && vorMarke.zuletzt === 'e5,e7', JSON.stringify(vorMarke));
  await ziehe(seite, 'a2a3');
  const mitten = await figurAuf(seite, 'a3');
  await warteZustand(seite, 'z.fehlversuche === 1 && z.phase === "flo"');
  await warte(300);
  const r2 = await seite.evaluate(() => ({ meldung: document.querySelector('.rs-meldung').dataset.art, text: document.querySelector('.rs-meldung > div > span').textContent,
    hinweis: [...document.querySelectorAll('.rs-screen .lage.mark-hinweis')].map((l) => l.dataset.feld).join() }));
  pruefe('falsch: die Figur stand kurz auf a3 und schnappt zurueck nach a2', mitten === 'wP' && await figurAuf(seite, 'a2') === 'wP' && await figurAuf(seite, 'a3') === null, mitten);
  pruefe('falsch: zweiter Versuch mit markierter Figur (f3) und Hinweis-Satz', r2.meldung === 'hinweis' && r2.hinweis === 'f3' && r2.text === 'Schau dir den Springer auf f3 an.', JSON.stringify(r2));
  await bild(seite, 'raetsel-hinweis-ipad');
  await ziehe(seite, 'f3h4');
  await warteZustand(seite, 'z.phase === "geloest"');
  z = await rz(seite);
  pruefe('im zweiten Versuch geloest: versuch 2, Meldung "Gelöst!", Punkt grau (nie rot)', z.ergebnisse[1].richtig && z.ergebnisse[1].versuch === 2
    && await seite.locator('.rs-meldung b').textContent() === 'Gelöst!' && (await seite.evaluate(() => document.querySelectorAll('.rs-fortschritt .rs-punkte > i')[1].className)) === 'durch', z.ergebnisse[1]);
  await seite.locator('.rs-weiter').click();
  await warteZustand(seite, 'z.index === 2 && z.phase === "flo"');
  // 3) zweimal falsch, dann "Loesung zeigen" mit Pfeil
  await ziehe(seite, 'g1f1');
  await warteZustand(seite, 'z.fehlversuche === 1 && z.phase === "flo"');
  await ziehe(seite, 'g1h1');
  await warteZustand(seite, 'z.fehlversuche === 2 && z.phase === "aus"');
  const r3 = await seite.evaluate(() => ({ primaer: document.querySelector('.rs-zeigen').classList.contains('primaer'), fokus: document.activeElement === document.querySelector('.rs-zeigen'),
    meldung: document.querySelector('.rs-meldung').dataset.art, ziele: document.querySelectorAll('.rs-screen .lage.ziel').length }));
  pruefe('zweimal falsch: Brett ruht, "Lösung zeigen" wird die Hauptaktion (Fokus)', r3.primaer && r3.fokus && r3.meldung === 'falsch', JSON.stringify(r3));
  await seite.locator('.rs-zeigen').click();
  await seite.waitForSelector('.rs-screen .brett-pfeile .pfeil[data-von="a1"][data-nach="a8"]', { timeout: 5000 });
  await bild(seite, 'raetsel-loesung-pfeil-ipad');
  await warteZustand(seite, 'z.phase === "gezeigt"');
  z = await rz(seite);
  const r4 = await seite.evaluate(() => ({ meldung: document.querySelector('.rs-meldung').dataset.art, text: document.querySelector('.rs-meldung').textContent,
    pfeil: !!document.querySelector('.rs-screen .brett-pfeile .pfeil[data-von="a1"][data-nach="a8"]') }));
  pruefe('Lösung zeigen: Pfeil a1-a8 (brett.pfeile), der Zug wird vorgespielt (Turm auf a8), Erklaerung', r4.pfeil && await figurAuf(seite, 'a8') === 'wR'
    && r4.meldung === 'loesung' && /Grundreihe ist dicht/.test(r4.text) && z.ergebnisse[2].loesungGezeigt && !z.ergebnisse[2].richtig && z.ergebnisse[2].versuch === 2, JSON.stringify({ r4, e: z.ergebnisse[2] }));
  await bild(seite, 'raetsel-loesung-ipad');
  await seite.locator('.rs-weiter').click();
  await warteZustand(seite, 'z.index === 3 && z.phase === "flo"');
  // 4) mehrzuegig: der Gegner antwortet von selbst
  await ziehe(seite, 'e2e8');
  await warteZustand(seite, 'z.schritt === 2 && z.phase === "flo"', null, 8000);
  pruefe('mehrzuegig: nach Dxe8+ antwortet Schwarz von selbst mit Dxe8', await figurAuf(seite, 'e8') === 'bQ' && await figurAuf(seite, 'd7') === null);
  await ziehe(seite, 'e1e8');
  await warteZustand(seite, 'z.phase === "geloest"');
  z = await rz(seite);
  pruefe('mehrzuegig: Txe8# loest die Aufgabe (3 Halbzuege)', z.schritt === 3 && z.ergebnisse[3].richtig && z.ergebnisse[3].versuch === 1);
  await seite.locator('.rs-weiter').click();
  await warteZustand(seite, 'z.index === 4 && z.phase === "flo"');
  // 5) gedrehtes Brett (Schwarz am Zug)
  const g = await seite.evaluate(() => {
    const b = document.querySelector('.rs-screen .brett');
    const a8 = b.querySelector('.feld[data-feld="a8"]').getBoundingClientRect();
    const h1 = b.querySelector('.feld[data-feld="h1"]').getBoundingClientRect();
    return { aus: b.dataset.ausrichtung, amZug: document.querySelector('.rs-amzug').textContent.trim(), unten: a8.top > h1.top, weiter: document.querySelector('.rs-weiter').textContent };
  });
  pruefe('Schwarz am Zug: Brett gedreht (a8 unten), "Schwarz am Zug", letzter Knopf heisst "Zum Abschluss"', g.aus === 'b' && g.unten && g.amZug === 'Schwarz am Zug'
    && /Zum Abschluss/.test(g.weiter), JSON.stringify(g));
  await bild(seite, 'raetsel-gedreht-ipad');
  await ziehe(seite, 'a8a1');
  await warteZustand(seite, 'z.phase === "geloest"');
  await seite.locator('.rs-weiter').click();
  await seite.waitForSelector('.rs-ende:not([hidden]) .rs-ende-karte');
  await warte(700);
  const e = await seite.evaluate(() => ({ zahl: document.querySelector('.rs-ende-zahl').textContent.replace(/\s+/g, ' ').trim(), titel: document.querySelector('.rs-ende-karte h2').textContent,
    punkte: [...document.querySelectorAll('.rs-ende-punkte > i')].map((i) => i.className).join(), fokus: document.activeElement === document.querySelector('.rs-fertig') }));
  z = await rz(seite);
  pruefe('Zusammenfassung: "4 von 5 gelöst", je Aufgabe ein Punkt, Fokus auf "Fertig"', e.zahl === '4 von 5 gelöst' && e.punkte === 'gut,durch,durch,gut,gut'
    && e.titel === 'Geschafft' && e.fokus && z.phase === 'ende', JSON.stringify(e));
  await bild(seite, 'raetsel-ende-ipad');
  await seite.locator('.rs-fertig').click();
  await seite.waitForFunction(() => location.hash === '#arena' && !!document.querySelector('.screen.arena'));
  pruefe('"Fertig" geht zurueck (hier zur Arena)', true);
  // ohne Quelle und ohne Liste: still zur Arena (wie ohne Paket-Screen)
  await seite.goto(BASIS + '#raetsel');
  await seite.waitForFunction(() => location.hash === '#arena' && !!document.querySelector('.screen.arena'), null, { timeout: 8000 }).catch(() => {});
  pruefe('#raetsel ohne Aufgaben: still zur Arena, kein Platzhalter', await seite.evaluate(() => location.hash === '#arena' && !document.querySelector('.screen.platzhalter')));
  await seite.evaluate(() => window.__app.gehe('raetsel', { quelle: 'gibt-es-nicht' }));
  await seite.waitForFunction(() => location.hash === '#arena' && !!document.querySelector('.screen.arena'), null, { timeout: 8000 }).catch(() => {});
  pruefe('unbekannte Quelle (Paket nicht geladen): still zur Arena', await seite.evaluate(() => location.hash === '#arena'));
  await seite.evaluate((liste) => window.__app.gehe('raetsel', { liste }), [{ fen: 'kaputt', loesung: ['e2e4'] }, { fen: FEN_DAME, loesung: ['e2e5'] }]);
  await seite.waitForSelector('.rs-ende:not([hidden])');
  pruefe('nur ungueltige Aufgaben (FEN, unmoeglicher Zug): ruhige Karte statt Brett', await seite.evaluate(() => document.querySelector('.rs-ende').dataset.art === 'leer'
    && !document.querySelector('.rs-inhalt:not([hidden])')));
  await seite.locator('.rs-fertig').click();
  await seite.waitForFunction(() => location.hash !== '#raetsel');

  // ---------- Kartei im Training ----------
  gruppe = 'Kartei';
  await bereite(seite, {});
  await seite.evaluate(() => window.__app.gehe('training'));
  await seite.waitForSelector('.training-gitter .kt-karte');
  const leer = await seite.evaluate(() => ({ h2: document.querySelector('.kt-karte h2').textContent, knopf: !!document.querySelector('.kt-karte .kt-los') }));
  pruefe('ohne Karten: freundlicher Leer-Zustand "Noch keine Karten", kein Knopf', leer.h2 === 'Noch keine Karten' && !leer.knopf, JSON.stringify(leer));
  await bild(seite, 'training-leer-ipad');
  await seite.evaluate(() => window.__app.gehe('arena'));
  await seite.waitForSelector('.screen.arena');
  pruefe('ohne faellige Karten keine Zeile in der Heute-Karte', await seite.locator('.kt-heute').count() === 0);

  // Karte 1 ist schwarz (gedreht) und am laengsten faellig, sie kommt zuerst; Karte 0 als zweite
  const zwoelf = Array.from({ length: 12 }, (_, i) => karte(i, heute, i === 1
    ? { farbe: 'b', fen: R_SCHWARZ.fen, besterZug: 'a8a1', san: 'h6', faellig: '2026-01-01', erstellt: '2026-01-01' }
    : i === 0 ? { faellig: '2026-01-02', erstellt: '2026-01-02' } : {}));
  await bereite(seite, { modul: modulMit(zwoelf) });
  await seite.waitForSelector('.screen.arena .heute-karte:not([hidden]) .kt-heute');
  const hz = await seite.evaluate(() => document.querySelector('.kt-heute').textContent.replace(/\s+/g, ' ').trim());
  pruefe('Heute-Karte: "Fehler wiederholen · 10 fällig" (Deckel 10 von 12) mit Knopf Üben', hz === 'Fehler wiederholen · 10 fällig Üben', hz);
  await warte(600);
  await bild(seite, 'arena-heute-ipad');
  await seite.evaluate(() => window.__app.gehe('training'));
  await seite.waitForSelector('.training-gitter .kt-karte .kt-los');
  const tk = await seite.evaluate(() => ({ h2: document.querySelector('.kt-karte h2').textContent, stapel: document.querySelectorAll('.kt-karte .kartei-stapel .kk .mini').length,
    zahlen: document.querySelector('.kt-zahlen').textContent, faellig: document.querySelector('.kt-karte').dataset.faellig }));
  pruefe('Training: Karte "Fehler wiederholen · 10 fällig", Stapel mit 4 Mini-Brettern, "12 im Training"', tk.h2 === 'Fehler wiederholen · 10 fällig' && tk.stapel === 4
    && tk.zahlen === '12 im Training' && tk.faellig === '10', JSON.stringify(tk));
  await warte(800);
  await bild(seite, 'training-kartei-ipad');
  await seite.evaluate(async () => {
    const E = await import('/js/ereignisse.js');
    window.__ev = [];
    E.hoere('training:geloest', (d) => window.__ev.push(['geloest', { ...d }]));
    E.hoere('training:stand', (d) => window.__ev.push(['stand', { ...d }]));
  });
  await seite.locator('.kt-karte .kt-los').click();
  await seite.waitForSelector('.rs-screen .rs-brett .figur');
  z = await rz(seite);
  const kk = await seite.evaluate(() => ({ titel: document.querySelector('.rs-screen .marke-titel').textContent, aus: document.querySelector('.rs-screen .brett').dataset.ausrichtung,
    text: document.querySelector('.rs-status p').textContent }));
  pruefe('Üben oeffnet den Raetsel-Bildschirm mit 10 Karten der Kartei, aelteste zuerst (die schwarze Karte: gedreht)', z.quelle === 'kartei' && z.gesamt === 10
    && z.aufgabe === 'pb1x:0' && kk.titel === 'Fehler wiederholen' && kk.aus === 'b', JSON.stringify({ z, kk }));
  pruefe('Satz der Karte: "Heute gegen Ritter Rudi hast du hier 4. … h6 gespielt."', kk.text === 'Heute gegen Ritter Rudi hast du hier 4. … h6 gespielt.', kk.text);
  await ziehe(seite, 'a8a1');
  await warteZustand(seite, 'z.phase === "geloest"');
  const nach1 = await kz(seite);
  const k1 = nach1.modul.karten.find((k) => k.id === 'pb1x:0');
  const morgen = await seite.evaluate(async (t) => (await import('/js/tag.js')).addiereTage(t, 1), heute);
  const ev1 = await seite.evaluate(() => window.__ev.slice());
  pruefe('richtig: Karte auf Stufe 1, wieder morgen, heute geuebt', k1.stufe === 1 && k1.faellig === morgen && k1.geuebt === heute && nach1.modul.heute.ids.join() === 'pb1x:0', JSON.stringify(k1));
  pruefe('Ereignisse: training:geloest { karteId, richtig, versuch, quelle: "kartei" }, dann training:stand { faellig 9, gesamt 12 }',
    JSON.stringify(ev1[0]) === JSON.stringify(['geloest', { karteId: 'pb1x:0', richtig: true, versuch: 1, quelle: 'kartei' }])
    && ev1[1][0] === 'stand' && ev1[1][1].faellig === 9 && ev1[1][1].gesamt === 12 && ev1[1][1].gemeistert === 0, JSON.stringify(ev1));
  pruefe('Rueckmeldung der Kartei: "Richtig!" und "Die Karte kommt morgen wieder."', await seite.locator('.rs-meldung').textContent() === 'Richtig!Die Karte kommt morgen wieder.');
  await bild(seite, 'kartei-richtig-ipad');
  await seite.locator('.rs-weiter').click();
  await warteZustand(seite, 'z.index === 1 && z.phase === "flo"');
  await ziehe(seite, 'a2a3');
  await warteZustand(seite, 'z.fehlversuche === 1 && z.phase === "flo"');
  await ziehe(seite, 'a2a4');
  await warteZustand(seite, 'z.phase === "aus"');
  await seite.locator('.rs-zeigen').click();
  await warteZustand(seite, 'z.phase === "gezeigt"');
  const nach2 = await kz(seite);
  const k2 = nach2.modul.karten.find((k) => k.id === 'pb0x:0');
  const ev2 = await seite.evaluate(() => window.__ev.slice(2));
  pruefe('Loesung gezeigt: Stufe 1, wieder morgen, falsch + 1; training:geloest mit richtig false', k2.stufe === 1 && k2.faellig === morgen && k2.falsch === 1
    && ev2[0][1].richtig === false && ev2[0][1].karteId === 'pb0x:0' && ev2[0][1].quelle === 'kartei', JSON.stringify({ k2, ev2 }));
  await bild(seite, 'kartei-loesung-ipad');
  // Zurueck mitten in der Sitzung: der Stapel zeigt den Rest
  await seite.locator('.rs-screen .kopf-zurueck').click();
  await seite.waitForSelector('.training-gitter .kt-karte');
  pruefe('zurueck ins Training: "· 8 fällig" (2 geuebt, Deckel 10)', await seite.locator('.kt-karte h2').textContent() === 'Fehler wiederholen · 8 fällig');

  // Stapel leer: alles fuer heute geuebt
  const zwei = [karte(20, heute), karte(21, heute, { fen: R_GRUND.fen, besterZug: 'a1a8', san: 'Kh1' })];
  await bereite(seite, { modul: modulMit(zwei) }, '#training');
  await seite.waitForSelector('.kt-karte .kt-los');
  await seite.locator('.kt-karte .kt-los').click();
  await seite.waitForSelector('.rs-screen .rs-brett .figur');
  await ziehe(seite, 'f3h4');
  await warteZustand(seite, 'z.phase === "geloest"');
  await seite.locator('.rs-weiter').click();
  await warteZustand(seite, 'z.index === 1 && z.phase === "flo"');
  await ziehe(seite, 'a1a8');
  await warteZustand(seite, 'z.phase === "geloest"');
  await seite.locator('.rs-weiter').click();
  await seite.waitForSelector('.rs-ende:not([hidden])');
  const ende = await seite.evaluate(() => ({ titel: document.querySelector('.rs-ende-karte h2').textContent, text: document.querySelector('.rs-ende-karte p').textContent }));
  pruefe('Abschluss der Kartei: "Alles richtig", "2 Karten weiter."', ende.titel === 'Alles richtig' && ende.text === '2 Karten weiter.', JSON.stringify(ende));
  await seite.locator('.rs-fertig').click();
  await seite.waitForSelector('.training-gitter .kt-karte');
  const ruhig = await seite.evaluate(() => ({ h2: document.querySelector('.kt-karte h2').textContent, p: document.querySelector('.kt-karte p').textContent,
    knopf: !!document.querySelector('.kt-karte .kt-los') }));
  pruefe('danach: "Stapel leer. Gut gemacht." mit "Die nächste Karte kommt morgen.", kein Knopf', ruhig.h2 === 'Stapel leer. Gut gemacht.'
    && ruhig.p === 'Die nächste Karte kommt morgen.' && !ruhig.knopf, JSON.stringify(ruhig));
  await bild(seite, 'training-stapel-leer-ipad');
  await seite.evaluate(() => window.__app.gehe('raetsel', { quelle: 'kartei' }));
  await seite.waitForSelector('.rs-ende:not([hidden])');
  pruefe('Raetsel mit leerem Stapel: ruhige Karte "Stapel leer. Gut gemacht."', await seite.locator('.rs-ende-karte h2').textContent() === 'Stapel leer. Gut gemacht.');

  // partie:analysiert (Uebung nie, sonst Karten und Feier-Zeile, zweimal kommt nichts doppelt)
  await bereite(seite, {});
  const an = await seite.evaluate(async ({ fen }) => {
    const E = await import('/js/ereignisse.js');
    const F = await import('/js/feier.js');
    const zug = { ply: 0, farbe: 'w', nummer: 4, san: 'a3', sanDe: 'a3', uci: 'a2a3', fenVorher: fen, besterZug: 'f3h4', besterZugSanDe: 'Sxh4', klasse: 'patzer',
      verlust: 0.93, gewinnVorher: 0.93, gewinnZweiter: 0.6, coach: 'Weit daneben! Lässt Matt in 1 zu. Besser war Sxh4.' };
    const review = { zuege: [zug, { ply: 1, farbe: 'b', uci: 'h4f2', klasse: 'bester', fenVorher: fen }] };
    const partie = (id, modus) => ({ id, spielerFarbe: 'w', botId: 'lisa', modus, datum: new Date().toISOString() });
    E.sende('partie:analysiert', { partieId: 'pue1', botId: 'lisa', modus: 'uebung', wertet: false, partie: partie('pue1', 'uebung'), review, quelle: 'partie' });
    E.sende('partie:analysiert', { partieId: 'pan1', botId: 'lisa', modus: 'normal', wertet: true, partie: partie('pan1', 'normal'), review, quelle: 'nachholen' });
    E.sende('partie:analysiert', { partieId: 'pan1', botId: 'lisa', modus: 'normal', wertet: true, partie: partie('pan1', 'normal'), review, quelle: 'analyse' });
    await new Promise((r) => setTimeout(r, 80));
    return { modul: JSON.parse(localStorage.getItem('schach-arena:v1:modul:kartei') || 'null'), feier: F.nachlese().map((f) => f.titel) };
  }, { fen: FEN_DAME });
  pruefe('partie:analysiert: eine Karte aus der normalen Partie, keine aus der Uebung, zweimal ergibt nichts doppelt', an.modul && an.modul.karten.length === 1
    && an.modul.karten[0].id === 'pan1:0' && JSON.stringify(an.modul.verarbeitet) === '["pan1"]', JSON.stringify(an.modul));
  pruefe('Feier-Zeile (Nachlese, weil kein Ergebnis offen): "1 neue Karte in deinem Stapel", genau einmal', JSON.stringify(an.feier) === '["1 neue Karte in deinem Stapel"]', an.feier);
  pruefe('Kartei: keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
  await kontext.close();

  // ---------- Eine echte Partie mit Fehler: Karte, Feier-Zeile im Ergebnis, loesen ----------
  gruppe = 'Partie';
  {
    const { kontext: k2, seite: s2, fehler: f2 } = await neueSeite(browser);
    await s2.goto(BASIS + '#arena');
    await s2.waitForSelector('.screen.arena', { timeout: 20000 });
    await bereite(s2, { einstellungen: { duellIntro: 'aus' } });
    await s2.evaluate(() => {
      localStorage.removeItem('schach-arena:v1:laufend');
      window.__test = { botZug: () => 'h4f2' };
    });
    await s2.evaluate((fen) => window.__app.gehe('partie', { botId: 'benno', farbe: 'w', startFen: fen }), FEN_DAME);
    await s2.waitForFunction(() => window.__partie && window.__partie.bereit === true, null, { timeout: 30000 });
    await s2.waitForFunction(() => window.__partie && window.__partie.phase() === 'flo', null, { timeout: 30000 });
    await ziehe(s2, 'a2a3', { sel: '.screen.partie' });
    await s2.waitForFunction(() => [...document.querySelectorAll('.erg-feier .erg-f-zeile b')].some((b) => /neue Karte/.test(b.textContent)), null, { timeout: 60000 });
    const fz = await s2.evaluate(() => [...document.querySelectorAll('.erg-feier .erg-f-zeile b')].map((b) => b.textContent));
    pruefe('nach der Analyse: Feier-Zeile "1 neue Karte in deinem Stapel" im Ergebnis', fz.includes('1 neue Karte in deinem Stapel'), fz);
    await s2.waitForFunction(() => ((JSON.parse(localStorage.getItem('schach-arena:v1:modul:kartei') || 'null') || {}).karten || []).length === 1, null, { timeout: 10000 });
    const kp = (await kz(s2)).modul.karten[0];
    pruefe('Karte aus der echten Analyse: Stellung vor a3, bester Zug Sxh4 (f3h4), gespielt a2a3, Weit daneben, Benno', kp.fen.startsWith(FEN_DAME.split(' ').slice(0, 2).join(' '))
      && kp.besterZug === 'f3h4' && kp.gespielt === 'a2a3' && kp.klasse === 'patzer' && kp.botId === 'benno' && kp.stufe === 0, JSON.stringify(kp));
    await bild(s2, 'ergebnis-feier-ipad');
    await s2.evaluate(() => window.__app.gehe('training'));
    await s2.waitForSelector('.kt-karte .kt-los');
    await s2.locator('.kt-karte .kt-los').click();
    await s2.waitForSelector('.rs-screen .rs-brett .figur');
    await ziehe(s2, 'f3h4');
    await warteZustand(s2, 'z.phase === "geloest"');
    const kn = (await kz(s2)).modul.karten[0];
    pruefe('dieselbe Karte im Training geloest: Stufe 1', kn.stufe === 1 && kn.richtig === 1);
    pruefe('Partie: keine Konsolenfehler', f2.length === 0, f2.join(' | '));
    await k2.close();
  }

  // ---------- Nachtrag: gespeicherte Analysen von vor dem Paket ----------
  gruppe = 'Nachtrag';
  {
    const { kontext: k3, seite: s3, fehler: f3 } = await neueSeite(browser);
    await s3.goto(BASIS + '#arena');
    await s3.waitForSelector('.screen.arena', { timeout: 20000 });
    await s3.evaluate(async ({ fen }) => {
      localStorage.clear();
      const S = await import('/js/storage.js');
      const p = { id: 'palt1', botId: 'kalle', botStufe: 3, spielerFarbe: 'w', startFen: fen, zuege: ['a2a3', 'h4f2'], san: ['a3', 'Qxf2#'], ergebnis: 'niederlage', grund: 'matt',
        modus: 'normal', analysiert: true, datum: new Date(Date.now() - 3 * 86400000).toISOString(), hinweise: 0, zuruecknahmen: 0, liveKlassen: [null, null] };
      const u = { ...p, id: 'palt2', modus: 'uebung' };
      localStorage.setItem('schach-arena:v1:partien', JSON.stringify([p, u]));
      const zug = { ply: 0, farbe: 'w', nummer: 4, san: 'a3', uci: 'a2a3', fenVorher: fen, fenNachher: fen, besterZug: 'f3h4', besterZugSan: 'Nxh4', klasse: 'patzer',
        verlust: 0.93, gewinnVorher: 0.93, gewinnNachher: 0, gewinnZweiter: 0.6, coach: 'Weit daneben! Lässt Matt in 1 zu.' };
      S.speichereReview('palt1', { zuege: [zug] });
      S.speichereReview('palt2', { zuege: [zug] });
    }, { fen: FEN_DAME });
    await s3.reload();
    await s3.waitForFunction(() => {
      const m = JSON.parse(localStorage.getItem('schach-arena:v1:modul:kartei') || 'null');
      return m && m.karten.length >= 1;
    }, null, { timeout: 15000 });
    await warte(400);
    const nt = await kz(s3);
    const fe = await s3.evaluate(async () => (await import('/js/feier.js')).nachlese().length);
    pruefe('nach dem Start: Karte aus der gespeicherten Analyse (palt1), die Uebung nicht, keine Feier', nt.modul.karten.length === 1 && nt.modul.karten[0].id === 'palt1:0'
      && nt.modul.karten[0].botId === 'kalle' && JSON.stringify(nt.modul.verarbeitet) === '["palt1"]' && fe === 0, JSON.stringify({ k: nt.modul.karten.map((k) => k.id), v: nt.modul.verarbeitet, fe }));
    pruefe('Nachtrag: keine Konsolenfehler', f3.length === 0, f3.join(' | '));
    await k3.close();
  }

  // ---------- Handy und iPad hoch: eine Spalte, hell und dunkel ----------
  gruppe = 'Handy';
  for (const [w, h, name, dunkel, handy] of [[390, 844, 'handy-hell', false, true], [390, 844, 'handy-dunkel', true, true], [820, 1180, 'ipad-hoch', false, false], [1180, 820, 'ipad-dunkel', true, false]]) {
    const hs = await neueSeite(browser, { w, h, handy, dunkel });
    await hs.seite.goto(BASIS + '#arena');
    await hs.seite.waitForSelector('.screen.arena', { timeout: 20000 });
    const t = await heuteImBrowser(hs.seite);
    await bereite(hs.seite, { modul: modulMit([karte(30, t, { coach: 'Lässt Matt in 1 zu. Besser war Sxh4.' }), karte(31, t, { fen: R_SCHWARZ.fen, besterZug: 'a8a1', farbe: 'b', san: 'h6' })]) }, '#training');
    await hs.seite.waitForSelector('.kt-karte .kt-los');
    await warte(700);
    await bild(hs.seite, `training-${name}`);
    await hs.seite.locator('.kt-karte .kt-los').click();
    await hs.seite.waitForSelector('.rs-screen .rs-brett .figur');
    await warte(900);
    const lage = await hs.seite.evaluate(() => {
      const b = document.querySelector('.rs-brettzone').getBoundingClientRect();
      const s = document.querySelector('.rs-seite').getBoundingClientRect();
      const f = document.querySelector('.rs-fortschritt').getBoundingClientRect();
      const brett = document.querySelector('.rs-screen .brett').getBoundingClientRect();
      return { untereinander: s.top >= b.bottom - 1, nebeneinander: s.left >= b.right - 1, fortschrittOben: f.bottom <= b.top + 1, breite: Math.round(brett.width),
        quer: document.documentElement.scrollWidth <= window.innerWidth + 1 && document.querySelector('.rs-rumpf').scrollWidth <= document.querySelector('.rs-rumpf').clientWidth + 1,
        fenster: innerWidth };
    });
    const soll = w < 900 ? lage.untereinander : lage.nebeneinander;
    pruefe(`${name}: ${w < 900 ? 'eine Spalte (Brett, darunter Status)' : 'zwei Spalten'}, Fortschritt oben, nichts ragt seitlich heraus, Brett mindestens 300 px`, soll && lage.fortschrittOben
      && lage.quer && lage.breite >= 300, JSON.stringify(lage));
    await ziehe(hs.seite, 'a2a3', { handy });
    await warteZustand(hs.seite, 'z.fehlversuche === 1 && z.phase === "flo"');
    await warte(500);
    await bild(hs.seite, `raetsel-hinweis-${name}`);
    await ziehe(hs.seite, 'f3h4', { handy });
    await warteZustand(hs.seite, 'z.phase === "geloest"');
    await warte(600);
    const tippen = await hs.seite.evaluate(() => [...document.querySelectorAll('.rs-screen button:not([hidden])')].filter((b) => b.getClientRects().length)
      .map((b) => Math.round(b.getBoundingClientRect().height)).filter((x) => x < 44));
    pruefe(`${name}: alle Knoepfe mindestens 44 px hoch`, tippen.length === 0, tippen);
    await bild(hs.seite, `raetsel-richtig-${name}`);
    await hs.seite.locator('.rs-weiter').click();
    await warteZustand(hs.seite, 'z.index === 1 && z.phase === "flo"');
    pruefe(`${name}: zweite Karte (Schwarz) gedreht`, await hs.seite.evaluate(() => document.querySelector('.rs-screen .brett').dataset.ausrichtung) === 'b');
    pruefe(`${name}: keine Konsolenfehler`, hs.fehler.length === 0, hs.fehler.join(' | '));
    await hs.kontext.close();
  }

  // ---------- Produktion: das Paket aus der Liste PAKETE (wie nach der Integration) ----------
  gruppe = 'PAKETE';
  const pr = await neueSeite(browser);
  await pr.seite.route('**/js/erweiterungen.js', (r) => r.fulfill({ status: 200, contentType: 'text/javascript',
    body: `export const PAKETE = Object.freeze(['sicherung', '${ERW}']);\nexport const REITER = Object.freeze(['training']);\n` }));
  await pr.seite.goto(`http://127.0.0.1:${PORT}/index.html#training`);
  await pr.seite.waitForSelector('.training-gitter .kt-karte', { timeout: 20000 });
  const prod = await pr.seite.evaluate(async () => {
    const o = await import('./js/orte.js');
    return { training: o.angeboten('training:karten'), css: !!document.querySelector('link[data-paket="kartei"]'), h2: document.querySelector('.kt-karte h2').textContent };
  });
  pruefe('ohne ?test aus PAKETE geladen: Karte im Training ("Noch keine Karten"), eigenes CSS', prod.training === 1 && prod.css && prod.h2 === 'Noch keine Karten', JSON.stringify(prod));
  pruefe('keine Konsolenfehler (Produktion)', pr.fehler.length === 0, pr.fehler.join(' | '));
  await pr.kontext.close();
}

// =====================================================================
// Ablauf
// =====================================================================
const t0 = Date.now();
let code = 1;
let server = null;
let browser = null;
try {
  await nodeTeil();
  if (!NUR_NODE) {
    server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: WURZEL, stdio: 'ignore' });
    await warteAufServer(`http://127.0.0.1:${PORT}/index.html`);
    browser = await browserTyp(ladePlaywright()).launch();
    await browserTeil(browser);
  }
  const fehlend = ergebnisse.filter((r) => !r.ok);
  console.log(`\n${ergebnisse.length - fehlend.length}/${ergebnisse.length} bestanden in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  for (const f of fehlend) console.log('FEHLER: ' + f.name + (f.detail ? ' (' + (typeof f.detail === 'string' ? f.detail : JSON.stringify(f.detail)) + ')' : ''));
  if (!NUR_NODE && !OHNE_BILDER) console.log('Bilder: ' + BILDER);
  code = fehlend.length ? 1 : 0;
} catch (e) {
  console.error(e);
  code = 1;
} finally {
  if (browser) await browser.close();
  if (server) server.kill();
}
process.exit(code);
