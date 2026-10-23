// Tests fuer das Paket funken (Funken und Level, SPIELKONZEPT 3.2, 3.3, 3.10, 5.3).
// Node-Teil: Formeln gegen die Tabellen des Konzepts (jede Zeile ein Pruefwert), Tagesbogen, Rueckenwind, Level-Kurve,
// Belohnungen bis 50, Speicher (Rechenstand, alte Spielstaende, Budget), Verdrahtung ueber den Ereignis-Bus.
// Browser-Teil (Playwright, Chromium) gegen die echte App mit ?test&erw=pakete/funken/index: Chip im Kopf und Spiegel,
// Heute-Zeile mit Zuenden, Faktor im Panel, Abrechnungszeile mit Balken und Aufschluesselung, Level-Aufstieg als grosser
// Moment (Klang, reduzierte Bewegung), Funken-Wochenende, Bot-Gruss, Verlaufskarte, Funkenlinie an/aus, Spieler-Leiste,
// spielplan:tage in der Test-Huelle, Handy und dunkel.
//
//   node tests/funken.test.mjs              alles
//   node tests/funken.test.mjs --nur-node   ohne Browser
//   PORT=9600 BILDER=/pfad node tests/funken.test.mjs
//
// Playwright: PLAYWRIGHT_PFAD, sonst 'playwright', sonst /opt/node-tools/node_modules/playwright.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { mkdirSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { browserTyp } from './browser.mjs';
import { setzeSpeicher, ladeFortschritt, statistik, MODUL_BUDGET, speicherePartie, ladeModul } from '../js/storage.js';
import { hoere, sende } from '../js/ereignisse.js';
import { fuerOverlay } from '../js/feier.js';
import * as L from '../js/pakete/funken/level.js';
import * as R from '../js/pakete/funken/rechnung.js';
import * as S from '../js/pakete/funken/stand.js';

const require = createRequire(import.meta.url);
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8866);
const NUR_NODE = process.argv.includes('--nur-node');
const bilderArg = process.argv.find((a) => a.startsWith('--bilder='));
const BILDER = bilderArg ? bilderArg.slice(9) : process.env.BILDER || path.join(os.tmpdir(), 'crownmate-funken-bilder');

const ergebnisse = [];
let gruppe = '';
function pruefe(name, ok, detail = '') {
  ergebnisse.push({ name: (gruppe ? gruppe + ': ' : '') + name, ok: !!ok, detail });
  const d = typeof detail === 'string' ? detail : JSON.stringify(detail);
  console.log(`${ok ? 'ok  ' : 'FEHLER'} ${gruppe ? gruppe + ': ' : ''}${name}${!ok && d ? ' (' + d.slice(0, 600) + ')' : ''}`);
}
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

function fakeSpeicher() {
  const m = new Map();
  return {
    m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k),
    key: (i) => [...m.keys()][i] ?? null, get length() { return m.size; },
  };
}
const offen = (klasse, n = 1, extra = {}) => Array.from({ length: n }, () => ({ klasse, gewinnVorher: 0.5, gewinnNachher: 0.5, ...extra }));
// Datum in Ortszeit (die Tests laufen mit der Zeitzone des Rechners; tag.js rechnet mit der Wanduhr)
const ort = (j, mo, t, h = 12, mi = 0) => new Date(j, mo - 1, t, h, mi, 0, 0);

// =====================================================================
// Level-Kurve, Titel, Belohnungen (level.js)
// =====================================================================
gruppe = 'Level-Kurve';
{
  // SPIELKONZEPT 3.3 "Die Level-Kurve": Level -> [Funken gesamt, naechstes Level kostet]
  const TABELLE = { 2: [100, 140], 3: [240, 180], 5: [640, 260], 10: [2340, 460], 15: [5040, 660], 20: [8740, 860], 30: [19140, 1260],
    40: [33540, 1660], 50: [51940, 2060], 75: [104400, 2100], 100: [156900, 2100] };
  for (const [l, [gesamt, naechstes]] of Object.entries(TABELLE)) {
    const lv = Number(l);
    pruefe(`Level ${lv}: ${gesamt} Funken gesamt, nächstes Level kostet ${naechstes}`, L.funkenBis(lv) === gesamt && L.kostet(lv) === naechstes
      && L.levelVon(gesamt) === lv && L.levelVon(gesamt - 1) === lv - 1, [L.funkenBis(lv), L.kostet(lv)]);
  }
  pruefe('Level 1 bei 0 Funken, Level 51 bei 54.000, danach je 2.100', L.levelVon(0) === 1 && L.funkenBis(51) === 54000
    && L.funkenBis(52) === 56100 && L.kostet(51) === 2100 && L.kostet(200) === 2100);
  let monoton = true;
  let alt = 1;
  for (let f = 0; f <= 170000; f += 37) {
    const lv = L.levelVon(f);
    if (lv < alt) monoton = false;
    alt = lv;
  }
  let umkehr = true;
  for (let lv = 2; lv <= 130; lv++) if (L.levelVon(L.funkenBis(lv)) !== lv || L.levelVon(L.funkenBis(lv) - 1) !== lv - 1) umkehr = false;
  let kosten = true;
  for (let lv = 1; lv <= 130; lv++) if (L.funkenBis(lv + 1) - L.funkenBis(lv) !== L.kostet(lv) || L.kostet(lv + 1) < L.kostet(lv)) kosten = false;
  pruefe('Kurve monoton, kein Höchstlevel, levelVon und funkenBis passen zusammen', monoton && umkehr && kosten && L.levelVon(1e7) > 4000);
  const fs = L.fortschritt(2340 + 100);
  pruefe('fortschritt: Level, Titel, im Level, bis zum nächsten, Anteil, nächster Titel', fs.level === 10 && fs.titel === 'Fackelträger'
    && fs.inLevel === 100 && fs.kostet === 460 && fs.bis === 360 && Math.abs(fs.anteil - 100 / 460) < 1e-9
    && fs.naechsterTitel.level === 15 && fs.naechsterTitel.name === 'Lagerfeuer', fs);
  pruefe('Rechenstand der Kurve ist 1', L.STAND === 1 && R.STAND === 1 && S.STAND === 1);
}

gruppe = 'Titel und Belohnungen';
{
  const TITEL = { 1: 'Funke', 5: 'Glut', 10: 'Fackelträger', 15: 'Lagerfeuer', 20: 'Fackel', 25: 'Kaminfeuer', 30: 'Esse', 35: 'Leuchtfeuer',
    40: 'Sonnwendfeuer', 45: 'Leuchtturm', 50: 'Morgenstern', 60: 'Komet', 75: 'Polarlicht', 100: 'Sonne' };
  for (const [l, name] of Object.entries(TITEL)) {
    const lv = Number(l);
    pruefe(`Titel ab Level ${lv}: ${name}`, L.titelVon(lv) === name && L.istTitelLevel(lv) && (lv === 1 || L.titelVon(lv - 1) !== name));
  }
  const VERBOTEN = /meister|großmeister|grossmeister|profi|experte|elo/i;
  pruefe('Kein Titel mit Meister, Großmeister, Profi, Experte oder Elo (Fairness 12)', L.TITEL.every(([, n]) => !VERBOTEN.test(n)));
  const ARTEN = new Set(['titel', 'zugspur', 'kartenrahmen', 'banner', 'brettrahmen', 'emote', 'finisher', 'figuren', 'oberflaeche', 'wappen', 'wahl', 'brief', 'sonst']);
  const fehlt = [];
  const ids = new Set();
  let doppelt = 0;
  for (let lv = 1; lv <= 50; lv++) {
    const b = L.belohnungen(lv);
    if (!b.length) fehlt.push(lv);
    for (const s of b) {
      if (ids.has(s.id)) doppelt++;
      ids.add(s.id);
      if (!ARTEN.has(s.art) || !/^[a-z0-9-]+$/.test(s.id) || !s.name) fehlt.push(`${lv}:${s.id}`);
    }
    if (L.istTitelLevel(lv) && !b.some((s) => s.art === 'titel' && s.name === `Titel ${L.titelVon(lv)}`)) fehlt.push(`Titel ${lv}`);
  }
  pruefe('Belohnungen vollständig bis Level 50 (jedes Level mindestens ein Stück, Titel an jedem 5. Level, IDs eindeutig)',
    fehlt.length === 0 && doppelt === 0 && L.alleStuecke().length === ids.size, { fehlt, doppelt });
  const name = (lv) => L.belohnungen(lv).map((s) => s.name).join(' | ');
  pruefe('Stichproben aus der Tabelle (2, 7, 13, 20, 26, 50)', /Zugspur Bleistift/.test(name(2)) && /Brett-Rahmen Eiche/.test(name(7))
    && /Brett-Rahmen Ahorn/.test(name(13)) && /Titel Fackel\b/.test(name(20)) && /Wahl: Brett-Oberfläche/.test(name(20))
    && /zweite Brett-Oberfläche/i.test(name(26)) && /Morgenstern/.test(name(50)) && /Blattgold/.test(name(50)) && /Brief vom Stockfisch/.test(name(50)));
  pruefe('Nach Level 50: Titel bei 60, 75, 100, jedes 10. Level eine Wahl aus dem Katalog', L.belohnungen(60).map((s) => s.id).join() === 'titel-komet,wahl-katalog-60'
    && L.belohnungen(70).map((s) => s.id).join() === 'wahl-katalog-70' && L.belohnungen(75).map((s) => s.id).join() === 'titel-polarlicht'
    && L.belohnungen(100).map((s) => s.id).join() === 'titel-sonne,wahl-katalog-100' && L.belohnungen(51).length === 0);
  pruefe('Belohnungen nur Schmuck und Titel (keine Bots, Analyse, Lektionen, Klangpakete)', L.alleStuecke().every((s) => !/bot|analyse|lektion|klang/i.test(s.art + s.id)));
}

// =====================================================================
// Rechnung (rechnung.js)
// =====================================================================
gruppe = 'Zugwerte';
{
  const TAB = { brillant: 12, stark: 8, bester: 5, exzellent: 4, gut: 3, ungenau: 1, fehler: 0, verpasst: 0, patzer: 0 };
  const NAME = { brillant: 'Genial', stark: 'Goldrichtig', bester: 'Präzise', exzellent: 'Sauber', gut: 'Solide', ungenau: 'Unscharf',
    fehler: 'Daneben', verpasst: 'Verschenkt', patzer: 'Weit daneben' };
  for (const [k, f] of Object.entries(TAB)) {
    const z = R.zugwerte(offen(k));
    pruefe(`${NAME[k]}: ${f} Funken je offenem Zug, belegt einen Platz`, z.zugwerte === f && z.offen === 1, z);
  }
  const grenze = R.zugwerte([...offen('bester', 1, { gewinnVorher: 0.10 }), ...offen('bester', 1, { gewinnVorher: 0.90 }),
    ...offen('brillant', 1, { gewinnVorher: 0.0999 }), ...offen('brillant', 1, { gewinnVorher: 0.9001 }), ...offen('stark', 1, { gewinnVorher: 1 })]);
  pruefe('Offen: Gewinnchance vorher 10 bis 90 % (Grenzen zählen), außerhalb 0 Funken ohne Platz', grenze.zugwerte === 10 && grenze.offen === 2
    && grenze.entschieden === 3, grenze);
  const deckel = R.zugwerte(offen('bester', 50));
  pruefe('Deckel: höchstens 40 offene Züge (50 Präzise ergeben 200)', deckel.zugwerte === 200 && deckel.offen === 40 && deckel.deckel === 10, deckel);
  const platz = R.zugwerte([...offen('patzer', 40), ...offen('bester', 3)]);
  pruefe('Daneben, Verschenkt, Weit daneben: nie Abzug, aber sie belegen einen der 40 Plätze', platz.zugwerte === 0 && platz.offen === 40, platz);
  const ohne = R.zugwerte([...offen('bester', 39), ...offen('stark', 3, { trivial: true }), ...offen('brillant', 2, { nachHilfe: true }),
    { klasse: 'erzwungen', gewinnVorher: 0.5 }, ...offen('bester', 1)]);
  pruefe('Pflichtzug, triviale Züge, Zug nach Hinweis oder Zurücknehmen: 0 Funken und kein Platz', ohne.zugwerte === 200 && ohne.offen === 40
    && ohne.ohnePlatz === 6, ohne);
  const theorie = R.zugwerte([...Array.from({ length: 10 }, () => ({ klasse: 'buch', gewinnVorher: 0.98 })), { klasse: 'buch', nachHilfe: true }]);
  pruefe('Theorie: 1 je Buchzug, höchstens 8, zählt immer (auch außerhalb 10 bis 90 %), belegt keinen Platz', theorie.theorie === 8
    && theorie.offen === 0, theorie);
  const unbekannt = R.zugwerte([{ klasse: 'brillant' }, { klasse: null, gewinnVorher: 0.5 }, null]);
  pruefe('Ohne Live-Bewertung (keine Gewinnchance, keine Klasse): 0 Funken', unbekannt.zugwerte === 0 && unbekannt.unbekannt === 3, unbekannt);
}

gruppe = 'Ergebnis und Verwertung';
{
  const e = (ergebnis, eigeneZuege, hilfe = false) => R.ergebnisFunken({ ergebnis, eigeneZuege, hilfe });
  pruefe('Sieg 40 · Remis 25 (ab dem 10. eigenen Zug)', e('sieg', 10) === 40 && e('remis', 10) === 25 && e('sieg', 80) === 40);
  pruefe('Niederlage ab 15 eigenen Zügen 10 („Kampfgeist“), davor 0', e('niederlage', 15) === 10 && e('niederlage', 14) === 0);
  pruefe('Ende vor dem 10. eigenen Zug: 0 für jedes Ergebnis', e('sieg', 9) === 0 && e('remis', 9) === 0 && e('niederlage', 9) === 0 && e('sieg', 0) === 0);
  pruefe('Hilfe (Hinweis oder Zurücknehmen): Ergebnis halbiert', e('sieg', 30, true) === 20 && e('remis', 30, true) === 12.5 && e('niederlage', 30, true) === 5);
  const reihe = (vor, nach, matt = null) => [...offen('bester', vor, { gewinnNachher: 0.6 }), { klasse: 'stark', gewinnVorher: 0.6, gewinnNachher: 0.93, matt },
    ...offen('exzellent', nach, { gewinnVorher: 0.95, gewinnNachher: 0.97 })];
  const v1 = R.verwertung({ ergebnis: 'sieg', zuege: reihe(10, 5, 2) });
  const v2 = R.verwertung({ ergebnis: 'sieg', zuege: reihe(10, 8, 2) });
  pruefe('Verwertung: Par = Mattdistanz + 3; 5 Züge bis zum Matt (Par 5) ergeben 30, 8 Züge ergeben 27', v1.funken === 30 && v1.par === 5
    && v2.funken === 27 && v2.ueber === 3, [v1, v2]);
  const v3 = R.verwertung({ ergebnis: 'sieg', zuege: reihe(5, 40) });
  const v4 = R.verwertung({ ergebnis: 'sieg', zuege: reihe(5, 75) });
  pruefe('Verwertung ohne Matt: Par 30, 1 Funke weniger je Zug darüber, nie unter 0 (Schleppen lohnt sich nie)', v3.par === 30 && v3.funken === 20
    && v4.funken === 0, [v3, v4]);
  pruefe('Verwertung nur bei Sieg; nie über 90 %: volle 30; ganz ohne Live-Bewertung: 0',
    R.verwertung({ ergebnis: 'remis', zuege: reihe(5, 5) }).funken === 0 && R.verwertung({ ergebnis: 'sieg', zuege: offen('bester', 20) }).funken === 30
    && R.verwertung({ ergebnis: 'sieg', zuege: [{ klasse: 'bester' }, { klasse: 'buch' }] }).funken === 0);
}

gruppe = 'Lichtblicke';
{
  const g = { partien: 3, maxZuege: 30, letzteGenauigkeit: 70 };
  const lb = (o) => R.lichtblicke({ ergebnis: 'niederlage', eigeneZuege: 31, botName: 'Ritter Rudi', gegner: g, ...o });
  pruefe('So lange wie noch nie gegen diesen Gegner (nur, wenn es schon eine Partie gab)', lb({}).map((x) => x.art).join() === 'lang'
    && lb({ gegner: { ...g, partien: 0 } }).length === 0 && lb({ eigeneZuege: 30 }).length === 0 && /So lange wie noch nie gegen Ritter Rudi/.test(lb({})[0].text));
  pruefe('Genauigkeit mindestens 5 Punkte über der letzten Partie gegen ihn', lb({ eigeneZuege: 10, genauigkeit: 75 }).map((x) => x.art).join() === 'genau'
    && lb({ eigeneZuege: 10, genauigkeit: 74.9 }).length === 0);
  const strafe = [{ klasse: 'bester', gewinnVorigerZug: 0.45, gewinnVorher: 0.7 }];
  pruefe('Fehler des Bots sofort bestraft (Sprung um mindestens 0,20, danach Sauber oder besser)', lb({ eigeneZuege: 10, zuege: strafe }).map((x) => x.art).join() === 'strafe'
    && lb({ eigeneZuege: 10, zuege: [{ ...strafe[0], klasse: 'gut' }] }).length === 0 && lb({ eigeneZuege: 10, zuege: [{ ...strafe[0], gewinnVorher: 0.6 }] }).length === 0);
  pruefe('Höchstens 2 Lichtblicke, nur bei Remis und Niederlage', lb({ genauigkeit: 80, zuege: strafe }).length === 2
    && R.lichtblicke({ ergebnis: 'sieg', eigeneZuege: 50, genauigkeit: 99, gegner: g, zuege: strafe }).length === 0
    && R.lichtblicke({ ergebnis: 'remis', eigeneZuege: 31, gegner: g }).length === 1);
}

gruppe = 'Herausforderungs-Faktor';
{
  const F = [[300, 1.5, 'Brocken'], [299, 1.25, 'Herausforderung'], [100, 1.25, 'Herausforderung'], [99, 1, 'Augenhöhe'], [-99, 1, 'Augenhöhe'],
    [-100, 0.75, 'Sparring'], [-299, 0.75, 'Sparring'], [-300, 0.5, 'Training'], [-499, 0.5, 'Training'], [-500, 0.25, 'Aufwärmen'], [-2000, 0.25, 'Aufwärmen']];
  for (const [ab, f, n] of F) {
    const r = R.faktorVon(ab, 10);
    pruefe(`Abstand ${ab}: × ${String(f).replace('.', ',')} „${n}“`, r.faktor === f && r.name === n, r);
  }
  pruefe('In den ersten 10 wertenden Partien immer × 1 (auch gegen einen Brocken)', R.faktorVon(900, 9).faktor === 1 && R.faktorVon(-900, 0).faktor === 1
    && R.faktorVon(900, 10).faktor === 1.5 && R.faktorVon(null, 50).faktor === 1);
  const zwoelf = Array.from({ length: 12 }, () => ({ ergebnis: 'sieg', elo: 250 }));
  const misch = [...Array.from({ length: 6 }, () => ({ ergebnis: 'sieg', elo: 250 })), { ergebnis: 'sieg', elo: 500 },
    ...Array.from({ length: 3 }, () => ({ ergebnis: 'niederlage', elo: 500 }))];
  pruefe('Lage bis zur Arena-Wertung: Leistungswert der letzten 20 Partien (12 Siege gegen 250: 650; gemischt: 510)',
    R.lageAusPartien(zwoelf, (p) => p.elo) === 650 && R.lageAusPartien(misch, (p) => p.elo) === 510 && R.lageAusPartien([], () => 0) === null
    && R.lageAusPartien(Array.from({ length: 30 }, (_, i) => ({ ergebnis: 'sieg', elo: i < 20 ? 1000 : 3000 })), (p) => p.elo) === 1400);
}

gruppe = 'Rechenbeispiele aus 3.2 und 3.10';
{
  // 1. Tapfere Niederlage gegen Ritter Rudi (x1,25): 4 Theorie, offen 1 Goldrichtig, 6 Praezise, 8 Sauber, 6 Solide, 2 Unscharf,
  //    1 Daneben, 1 Weit daneben, 3 triviale; Kampfgeist 10, Lichtblick 10 -> (94 + 10 + 10) x 1,25 = 143
  const z1 = [...Array.from({ length: 4 }, () => ({ klasse: 'buch' })), ...offen('stark', 1), ...offen('bester', 6), ...offen('exzellent', 8),
    ...offen('gut', 6), ...offen('ungenau', 2), ...offen('fehler', 1), ...offen('patzer', 1), ...offen('gut', 3, { trivial: true }),
    ...offen('gut', 6, { gewinnVorher: 0.04 })];
  const p1 = R.partieFunken({ zuege: z1, ergebnis: 'niederlage', eigeneZuege: 38, faktor: 1.25, gegner: { partien: 4, maxZuege: 35 }, botName: 'Rudi' });
  pruefe('Beispiel 1: tapfere Niederlage gegen Rudi = 143 Funken', p1.zugwerte + p1.theorie === 94 && p1.ergebnis === 10 && p1.lichtblicke.length === 1
    && R.endMenge({ vor: p1.vorRueckenwind }).menge === 143, p1);
  // 2. Pflichtsieg gegen Benno (x0,25): 3 Buch, 6 offene Zuege (30), Sieg 40, Verwertung 30 -> 103 x 0,25 = 26
  const z2 = [...Array.from({ length: 3 }, () => ({ klasse: 'buch' })), ...offen('bester', 6, { gewinnNachher: 0.95 }),
    ...offen('exzellent', 13, { gewinnVorher: 0.97, gewinnNachher: 0.99 })];
  const p2 = R.partieFunken({ zuege: z2, ergebnis: 'sieg', eigeneZuege: 22, faktor: 0.25 });
  pruefe('Beispiel 2: Pflichtsieg gegen Benno = 26 Funken (Mut und gute Züge zählen, Menge nicht)', p2.basis === 103
    && R.endMenge({ vor: p2.vorRueckenwind }).menge === 26 && R.endMenge({ vor: p1.vorRueckenwind }).menge > 5 * 26, p2);
  // 3. Sieg gegen Rudi mit neuem Stern: 165 x 1,25 = 206, Stern 50, erster Sieg 100 -> 356
  const p3 = R.endMenge({ vor: 165 * 1.25 }).menge + R.sternFunken([true, false, false], { botId: 'rudi' }).reduce((s, x) => s + x.menge, 0);
  pruefe('Beispiel 3: Sieg gegen Rudi mit neuem Stern = 356 Funken', p3 === 356, p3);
  const k = R.endMenge({ vor: 164 * 1.25, kartenAktiv: 3, einheit: true });
  pruefe('3.10: 164 × 1,25 × 2 = 410 (Rückenwind-Karte)', k.menge === 410 && k.faktor === 2 && k.quelle === 'karte' && k.verbraucht, k);
  pruefe('Kaufmännisch gerundet, nie negativ', R.runde(142.5) === 143 && R.runde(25.75) === 26 && R.runde(0.49) === 0 && R.runde(-12) === 0 && R.runde(NaN) === 0);
}

gruppe = 'Tagesbogen und Rückenwind';
{
  const b = R.endMenge({ vor: 200, schonHeute: 700 });
  pruefe('Bis 800 Funken am Tag voll, darüber halb (700 + 200: 100 voll, 100 halb = 150)', b.menge === 150 && b.halb, b);
  const rw = R.endMenge({ vor: 200, schonHeute: 700, kartenAktiv: 1, einheit: true });
  pruefe('Der Bogen misst vor dem Rückenwind: Doppel-Funken werden nicht aufgefressen (150 × 2 = 300)', rw.menge === 300 && rw.bogen.nach === 150, rw);
  pruefe('Unter 800 greift der Bogen nicht', !R.endMenge({ vor: 799 }).halb && R.endMenge({ vor: 799 }).menge === 799);
  const we = R.rueckenwindFaktor({ wochenende: true, kartenAktiv: 3, einheit: true, vor: 100 });
  pruefe('Nie mehr als × 2: am Funken-Wochenende wird keine Karte verbraucht', we.faktor === 2 && we.quelle === 'wochenende' && !we.verbraucht, we);
  pruefe('Karte nur für Einheiten mit Funken (nichts verdoppeln, was nicht verdient ist)', !R.rueckenwindFaktor({ kartenAktiv: 3, einheit: false, vor: 10 }).verbraucht
    && !R.rueckenwindFaktor({ kartenAktiv: 3, einheit: true, vor: 0 }).verbraucht && R.rueckenwindFaktor({ kartenAktiv: 0, einheit: true, vor: 9 }).faktor === 1);
}

gruppe = 'Lernen und Meilensteine';
{
  pruefe('„Ab hier nochmal“: getroffen 15, nicht getroffen 5', R.uebungFunken(true) === 15 && R.uebungFunken(false) === 5);
  const r = (o) => R.raetselFunken({ richtig: true, versuch: 1, ...o });
  pruefe('Rätsel im 1. Versuch nach Abstand Wertung minus Blick: ab +200 12 · −199 bis +199 8 · −200 bis −399 4 · darunter 1',
    r({ wertung: 1400, blick: 1200 }) === 12 && r({ wertung: 1399, blick: 1200 }) === 8 && r({ wertung: 1001, blick: 1200 }) === 8
    && r({ wertung: 1000, blick: 1200 }) === 4 && r({ wertung: 801, blick: 1200 }) === 4 && r({ wertung: 800, blick: 1200 }) === 1);
  pruefe('Rätsel: schon gelöst 0, falsch 1', r({ schonGeloest: true, wertung: 2000, blick: 0 }) === 0 && R.raetselFunken({ richtig: false, versuch: 1 }) === 1
    && R.raetselFunken({ richtig: false, versuch: 2 }) === 0);
  pruefe('Karteikarte richtig im 1. / 2. Versuch: 10 / 4', R.kartenFunken({ richtig: true, versuch: 1 }) === 10 && R.kartenFunken({ richtig: true, versuch: 2 }) === 4
    && R.kartenFunken({ richtig: true, versuch: 3 }) === 0 && R.kartenFunken({ richtig: false, versuch: 1 }) === 0);
  const l1 = R.lektionFunken({ alt: '', ringe: { gelernt: true, sicher: false, gemeistert: false } });
  const l2 = R.lektionFunken({ alt: l1.neu, ringe: { sicher: true } });
  const l3 = R.lektionFunken({ alt: l2.neu, ringe: { sicher: true, gemeistert: true } });
  pruefe('Lektion 40, Ring „Sicher“ +20, Ring „Gemeistert“ +40, jedes nur einmal', l1.funken === 40 && l2.funken === 20 && l3.funken === 40
    && R.lektionFunken({ alt: l3.neu, ringe: { sicher: true, gemeistert: true } }).funken === 0);
  pruefe('Boss-Siegel Bronze 50 · Silber 50 · Gold 100', R.siegelFunken('bronze') === 50 && R.siegelFunken('silber') === 50 && R.siegelFunken('gold') === 100
    && R.siegelFunken('platin') === 0);
  const st = R.sternFunken([true, false, true], { botId: 'rudi' });
  const sf = R.sternFunken([true, false, false], { botId: 'stockfisch' });
  pruefe('Neuer Stern 50 · Bot zum ersten Mal besiegt 100 · erster Sieg gegen den Stockfisch 1.000', st.reduce((s, x) => s + x.menge, 0) === 200
    && sf.find((x) => x.art === 'stockfisch').menge === 1000 && !sf.some((x) => x.art === 'ersterSieg') && R.sternFunken([false, true, false]).length === 1);
}

gruppe = 'Können-Satz';
{
  const partie = (i, patzer, datum) => {
    const k = [];
    for (let j = 0; j < 40; j++) k.push(j % 2 ? null : (j < patzer * 2 ? 'patzer' : 'bester'));
    return { datum: new Date(datum + i * 60000).toISOString(), spielerFarbe: 'w', liveKlassen: k, genauigkeit: 80,
      san: Array.from({ length: 40 }, (_, j) => (j % 4 === 0 ? 'Nf3' : 'e4')) };
  };
  const seit = Date.UTC(2026, 9, 10);
  // vor dem Aufstieg 3 "Weit daneben" je 20 eigene Zuege (1,5 je 10), danach 2 (1,0 je 10)
  const vorher = Array.from({ length: 8 }, (_, i) => partie(i, 3, seit - 86400000 * 3));
  const nachher = Array.from({ length: 8 }, (_, i) => partie(i, 2, seit + 3600000));
  const s = R.koennenSatz({ partien: [...nachher].reverse().concat([...vorher].reverse()), seit, levelVorher: 6 });
  pruefe('Größte Verbesserung mit Beleg („Seit Level 6: „Weit daneben“-Züge je 10 Züge 1,5 → 1,0“)', s && s.art === 'patzer'
    && s.text === 'Seit Level 6: „Weit daneben“-Züge je 10 Züge 1,5 → 1,0' && /8 gewertete Partien seit dem vorigen Level gegen 8/.test(s.herkunft), s);
  const n = R.koennenSatz({ partien: nachher.slice(0, 3), seit, levelVorher: 6 });
  pruefe('Zu wenig Daten (unter 5 Partien je Fenster): neutraler Fakt aus echten Zahlen', n && n.art === 'fakt' && n.text === '60 Züge gespielt, die meisten mit Bauern', n);
  pruefe('Ohne Partien kein Satz', R.koennenSatz({ partien: [] }) === null);
}

// =====================================================================
// Speicher (stand.js) mit Fake-Speicher
// =====================================================================
gruppe = 'Speicher';
{
  let sp = fakeSpeicher();
  setzeSpeicher(sp);
  // alter Spielstand: Partien und Fortschritt, aber kein Modul funken
  sp.setItem('schach-arena:v1:fortschritt', JSON.stringify({ bots: { benno: { sterne: [true, true, true], partien: 3, siege: 3 } } }));
  let st = S.lade(ort(2026, 10, 22, 20));
  pruefe('Alter Spielstand ohne Modul startet bei 0 Funken, Level 1, mit den Stücken von Level 1', st.gesamt === 0 && st.level === 1 && st.stand === 1
    && st.freigeschaltet.join() === 'titel-funke,namensschild,finisher-tinte,emotes-grund' && st.verlauf.length === 0, st);
  // Entdeckungs-Fahrplan 3.16: die erste Karte kommt an Tag 4 (Start Donnerstag 22.10.: Tag 4 = Sonntag 25.10. ab 4:00)
  pruefe('Erster Start: Tag gemerkt, noch keine Rückenwind-Karte', st.rw.karten === 0 && st.rw.woche === null && st.rw.start === '2026-10-22', st.rw);
  {
    const k = (x, t) => { S.pruefeKarten(x, t); return x.rw.karten; };
    const a = S.lade(ort(2026, 10, 22, 20));
    const tag3 = k(a, ort(2026, 10, 24, 12));
    const vorVier = k(a, ort(2026, 10, 25, 3, 59));
    const tag4 = k(a, ort(2026, 10, 25, 4, 0));
    const neu = a.rw.neu;
    const montag = k(a, ort(2026, 10, 26, 4, 0));
    // Start Samstag 24.10.: Montag 26.10. ist erst Tag 3, die Montagskarte kommt nicht vor der ersten Karte (Tag 4 = Dienstag)
    sp.removeItem('schach-arena:v1:modul:funken');
    const b = S.lade(ort(2026, 10, 24, 10));
    const bMontag = k(b, ort(2026, 10, 26, 12));
    const bTag4 = k(b, ort(2026, 10, 27, 12));
    const bWoche = b.rw.woche;
    const bNaechster = k(b, ort(2026, 11, 2, 12));
    pruefe('Rückenwind: erste Karte an Tag 4 („Neu für dich“, Tagesgrenze 4:00), danach jeden Montag; nie eine Montagskarte vor der ersten',
      tag3 === 0 && vorVier === 0 && tag4 === 1 && neu === 'erste' && a.rw.woche === '2026-10-26' && montag === 2
      && bMontag === 0 && bTag4 === 1 && bWoche === '2026-10-26' && bNaechster === 2 && b.rw.woche === '2026-11-02',
    { tag3, vorVier, tag4, neu, montag, bMontag, bTag4, bWoche, bNaechster });
  }
  sp.setItem('schach-arena:v1:modul:funken', JSON.stringify({ gesamt: 'viel', verlauf: 'x', rw: { karten: 99, aktiv: -3 }, ids: [1, 'a'], lauf: 5 }));
  st = S.lade(ort(2026, 10, 22, 20));
  pruefe('Kaputte Daten werden still ersetzt (Zahlen, Listen, Karten höchstens 4)', st.gesamt === 0 && Array.isArray(st.verlauf) && st.rw.karten === 4
    && st.rw.aktiv === 0 && st.ids.join() === 'a' && st.lauf === null, st.rw);
  sp.setItem('schach-arena:v1:modul:funken', JSON.stringify({ gesamt: 2400, level: 99, freigeschaltet: [] }));
  st = S.lade(ort(2026, 10, 22, 20));
  pruefe('Level folgt den Funken (2.400 = Level 10), alle Stücke bis dahin sind frei', st.level === 10 && st.freigeschaltet.includes('titel-fackeltraeger')
    && st.freigeschaltet.includes('zugspur-federkiel') === false && st.freigeschaltet.includes('brettrahmen-eiche'));

  // Tageswechsel um 4:00 (Wanduhr), Uhr zurueck zaehlt nichts neu
  sp = fakeSpeicher();
  setzeSpeicher(sp);
  st = S.lade(ort(2026, 10, 22, 23, 30));
  S.bucheEinheit(st, { quelle: 'partie', vor: 500 });
  pruefe('Buchung zählt für heute (Bogen vor Rückenwind, Quellen)', st.heute.bogen === 500 && st.heute.funken === 500 && st.heute.quellen.partie === 500);
  S.tagWechsel(st, ort(2026, 10, 23, 3, 59));
  const vorVier = st.heute.tag;
  S.tagWechsel(st, ort(2026, 10, 23, 4, 0));
  pruefe('Tagesgrenze 4:00: um 3:59 noch der alte Tag, um 4:00 beginnt der Bogen neu', vorVier === '2026-10-22' && st.heute.tag === '2026-10-23' && st.heute.bogen === 0);
  st.heute.bogen = 300;
  S.tagWechsel(st, ort(2026, 10, 21, 12));
  pruefe('Uhr zurückgestellt: der Tag zählt weiter, nichts beginnt neu', st.heute.tag === '2026-10-23' && st.heute.bogen === 300);

  // Wochenkarte: Montag 4:00 (die erste Karte kam schon: Woche gesetzt)
  st = S.lade(ort(2026, 10, 22, 12));
  st.rw.karten = 0;
  st.rw.woche = '2026-10-19';
  S.pruefeKarten(st, ort(2026, 10, 26, 3, 59));
  const vorMontag = st.rw.karten;
  S.pruefeKarten(st, ort(2026, 10, 26, 4, 0));
  pruefe('Rückenwind: Montag 4:00 kommt eine Karte (3:59 noch nicht)', vorMontag === 0 && st.rw.karten === 1 && st.rw.woche === '2026-10-26');
  S.pruefeKarten(st, ort(2026, 12, 14, 12));
  pruefe('Höchstens 3 Karten im Fach, Karten bleiben liegen (auch nach Wochen)', st.rw.karten === 3);
  pruefe('Zünden: die nächsten 3 Einheiten zählen doppelt, nie zwei Karten zugleich', S.zuenden(st) && st.rw.aktiv === 3 && st.rw.karten === 2
    && !S.zuenden(st) && st.rw.karten === 2);
  const m = [1, 2, 3, 4].map(() => S.bucheEinheit(st, { quelle: 'partie', vor: 10, einheit: true }).menge);
  pruefe('Eine Karte deckt genau 3 Einheiten', m.join() === '20,20,20,10' && st.rw.aktiv === 0, m);
  st.rw.aktiv = 2;
  const w = S.bucheEinheit(st, { quelle: 'lernen', vor: 10, einheit: true, wochenende: true, woche: '2026-12-14' });
  pruefe('Funken-Wochenende: doppelt, die Karte bleibt aktiv (nie × 4)', w.menge === 20 && st.rw.aktiv === 2 && st.rw.gespielt.includes('2026-12-14'));

  // Willkommen zurueck (hoechstens einmal je Kalendermonat); woche jeweils auf die Pruefwoche, damit keine Wochenkarte mitzaehlt
  st = S.lade(ort(2026, 10, 22, 12));
  const wk = (tag, letzter) => { st.rw.woche = tag; if (letzter) st.rw.letzterTag = letzter; };
  st.rw.karten = 0;
  wk('2026-11-02', '2026-11-02');
  S.pruefeKarten(st, ort(2026, 11, 4, 18));
  const nachEinem = st.rw.karten;
  S.pruefeKarten(st, ort(2026, 11, 5, 18));
  const nachZwei = st.rw.karten;
  wk('2026-11-16', '2026-11-10');
  S.pruefeKarten(st, ort(2026, 11, 20, 18));
  const gleicherMonat = st.rw.karten;
  wk('2026-11-30', '2026-11-28');
  S.pruefeKarten(st, ort(2026, 12, 2, 18));
  pruefe('„Willkommen zurück“: nach mindestens 2 Tagen ohne Tageswerk eine Extra-Karte, höchstens einmal im Monat', nachEinem === 0 && nachZwei === 1
    && gleicherMonat === 1 && st.rw.karten === 2 && st.rw.neu === 'willkommen' && st.rw.willkommen === '2026-12',
  { nachEinem, nachZwei, gleicherMonat, jetzt: st.rw.karten });
  st.rw.karten = 4;
  st.rw.letzterTag = '2026-12-02';
  st.rw.willkommen = null;
  S.pruefeKarten(st, ort(2026, 12, 6, 18));
  pruefe('Extra-Karten legen höchstens eine vierte Karte ins Fach', st.rw.karten === 4);

  // Fuer dich aufgehoben: verpasstes Funken-Wochenende (woche schon die Pruefwoche: nur die Extra-Karte zaehlt)
  const plan = { wochen: [{ montag: '2026-11-30', boss: 'x', thema: null, funkenWochenende: true }, { montag: '2026-12-07', boss: 'y', thema: null, funkenWochenende: false }] };
  const fach = (start, gespielt = []) => {
    const x = S.lade(ort(2026, 11, 26, 12));
    Object.assign(x.rw, { karten: 0, woche: '2026-12-07', start, gespielt });
    S.pruefeKarten(x, ort(2026, 12, 7, 10), { plan });
    return x.rw;
  };
  const a = fach('2026-11-26');
  const b = fach('2026-11-26', ['2026-11-30']);
  const c = fach('2026-12-06');
  pruefe('„Für dich aufgehoben“: Montag eine Karte, wer am Funken-Wochenende nicht gespielt hat (nicht, wer gespielt hat oder später kam)',
    a.karten === 1 && a.neu === 'aufgehoben' && a.aufgehoben.includes('2026-11-30') && b.karten === 0 && c.karten === 0, [a, b.karten, c.karten]);
  // die Karte verfaellt nie: wer erst Wochen spaeter wieder oeffnet, bekommt sie trotzdem, genau einmal
  const spaet = (tage) => {
    sp.removeItem('schach-arena:v1:modul:funken');
    const x = S.lade(ort(2026, 11, 20, 12), { plan });
    Object.assign(x.rw, { karten: 0, woche: '2026-11-16' });
    S.speichere(x);
    const kartenNach = tage.map((t) => { const y = S.lade(t, { plan }); S.speichere(y); return [y.rw.karten, y.rw.aufgehoben.join(), y.rw.planBis]; });
    return kartenNach;
  };
  const zweiWochen = spaet([ort(2026, 12, 15, 12), ort(2026, 12, 16, 12), ort(2026, 12, 22, 12)]);
  const direkt = spaet([ort(2026, 12, 8, 12), ort(2026, 12, 15, 12)]);
  pruefe('„Für dich aufgehoben“ auch nach zwei Wochen ohne Öffnen (verfällt nie), jede Woche nur einmal geprüft',
    zweiWochen[0][0] === 4 && zweiWochen[0][1] === '2026-11-30' && zweiWochen[0][2] === '2026-12-07' && zweiWochen[1][0] === 4
    && zweiWochen[2][1] === '2026-11-30' && direkt[0][1] === '2026-11-30' && direkt[1][1] === '2026-11-30', { zweiWochen, direkt });
}

gruppe = 'Partie buchen';
{
  setzeSpeicher(fakeSpeicher());
  const jetzt = ort(2026, 10, 22, 20);
  let st = S.lade(jetzt);
  const lauf = { id: 'l1', farbe: 'w', fa: 1.25, fn: 'Herausforderung', z: {} };
  const klassen = [];
  for (let ply = 0; ply < 60; ply++) {
    if (ply % 2) { klassen.push(null); continue; }
    const k = ply < 8 ? 'buch' : 'bester';
    klassen.push(k);
    S.merkeZug(lauf, { ply, klasse: k, gewinnVorher: 0.5, gewinnNachher: ply >= 52 ? 0.95 : 0.5 });
  }
  S.merkeMatt(lauf, 52, 3);
  const d = { partieId: 'p1', laufId: 'l1', botId: 'rudi', modus: 'normal', wertet: true, ergebnis: 'sieg', eigeneZuege: 30, liveKlassen: klassen,
    hinweise: 0, zuruecknahmen: 0, neueSterne: [true, false, false] };
  const r = S.buchePartie(st, d, { lauf, jetzt, botName: 'Ritter Rudi' });
  // 26 offene Praezise (130) + 4 Theorie + Sieg 40 + Verwertung (Par 3 + 3 = 6, 3 Zuege danach: 30) = 204 x 1,25 = 255; Stern 50 + erster Sieg 100
  pruefe('Wertende Partie: (130 + 4 + 40 + 30) × 1,25 = 255, dazu Stern 50 und erster Sieg 100', r.eintrag.p === 255 && r.eintrag.m === 150 && r.eintrag.f === 405
    && r.eintrag.ba === 204 && r.eintrag.v === 30 && st.gesamt === 405 && st.heute.partien === 1, r.eintrag);
  pruefe('Buchungen je Quelle (Partie, Meilenstein) für funken:gebucht', JSON.stringify(r.buchungen) === '[{"quelle":"partie","menge":255},{"quelle":"meilenstein","menge":150}]');
  pruefe('Jede Partie nur einmal (partie:beendet ist idempotent)', S.buchePartie(st, d, { lauf, jetzt }) === null && st.gesamt === 405);
  const auf = S.schliesseLevel(st, 1, jetzt);
  pruefe('Aufstieg 1 → 3 schaltet Zugspur Bleistift und Kartenrahmen Fichte frei', auf && auf.vorher === 1 && auf.nachher === 3 && auf.titel === null
    && auf.neu.map((s) => s.id).join() === 'zugspur-bleistift,kartenrahmen-fichte' && st.freigeschaltet.includes('kartenrahmen-fichte') && st.gruss === true);
  pruefe('Level sinkt nie (ein Abschluss mit höherem Vorher ändert nichts)', S.schliesseLevel(st, 9, jetzt) === null && st.level === 3);
  const mitHilfe = S.buchePartie(st, { ...d, partieId: 'p2', hinweise: 1, neueSterne: [false, false, false] }, { lauf, jetzt });
  pruefe('Hilfe: Ergebnis halbiert, Abrechnung gibt es trotzdem', mitHilfe.eintrag.e === 20 && mitHilfe.eintrag.hilfe === true);
  const nichts = ['uebung', 'frei', 'spiel'].map((modus, i) => S.buchePartie(st, { ...d, partieId: 'n' + i, modus, wertet: false }, { lauf, jetzt }));
  const gast = S.buchePartie(st, { ...d, partieId: 'gast', botId: 'gast-1', wertet: false }, { lauf, jetzt });
  pruefe('Übung, freie Partie, Spielhalle und Gäste bringen keine Partie-Funken', nichts.every((x) => x === null) && gast === null);
  const boss = [1, 2, 3, 4].map((i) => S.buchePartie(st, { ...d, partieId: 'b' + i, modus: 'boss', wertet: false, neueSterne: [true, true, true] }, { lauf, jetzt }));
  pruefe('Boss: die ersten 3 Versuche am Tag bringen Funken, der 4. nicht (spielbar bleibt er), keine Sterne-Funken',
    boss.slice(0, 3).every((x) => x.eintrag.p > 0 && x.eintrag.m === 0) && boss[3].eintrag.p === 0 && boss[3].eintrag.gr === 'boss', boss.map((x) => x.eintrag.p));
  st.rw.aktiv = 3;
  st.heute.bogen = 0;
  const kurz = S.buchePartie(st, { ...d, partieId: 'k1', eigeneZuege: 3, liveKlassen: [null, null], neueSterne: [false, false, false] }, { lauf: null, jetzt });
  pruefe('Partie ohne Funken (zu kurz, ohne Live-Daten): 0, Grund „kurz“, die Rückenwind-Karte bleibt', kurz.eintrag.p === 0 && kurz.eintrag.gr === 'kurz' && st.rw.aktiv === 3);
  const rw = S.buchePartie(st, { ...d, partieId: 'rw1', neueSterne: [false, false, false] }, { lauf, jetzt });
  pruefe('Rückenwind-Karte: Partie zählt doppelt, eine Einheit weniger', rw.eintrag.rw === 'karte' && rw.eintrag.p === 510 && st.rw.aktiv === 2, rw.eintrag);
  // Nachtrag: Stern 2 erst nach der Analyse
  const n1 = S.nachtragPartie(st, { partieId: 'p1', wertet: true, botId: 'rudi', neueSterne: [true, true, false], partie: { genauigkeit: 88 } }, { jetzt });
  const n2 = S.nachtragPartie(st, { partieId: 'p1', wertet: true, botId: 'rudi', neueSterne: [true, true, false], partie: { genauigkeit: 88 } }, { jetzt });
  pruefe('Nachtrag: Stern 2 nach der Analyse +50, nur einmal (partie:analysiert kann zweimal kommen)', n1.buchungen.length === 1 && n1.buchungen[0].menge === 50
    && n2.buchungen.length === 0 && n1.eintrag.f === 455, n1.eintrag);
  // Genauigkeits-Lichtblick (Niederlage)
  const nl = S.buchePartie(st, { ...d, partieId: 'nl', ergebnis: 'niederlage', neueSterne: [false, false, false] },
    { lauf, jetzt, gegner: { partien: 2, maxZuege: 50, letzteGenauigkeit: 70 } });
  const vor = nl.eintrag.f;
  const vorBa = nl.eintrag.ba;
  const rwf = nl.eintrag.rw ? 2 : 1;
  const n3 = S.nachtragPartie(st, { partieId: 'nl', wertet: true, partie: { genauigkeit: 76 } }, { jetzt });
  const n4 = S.nachtragPartie(st, { partieId: 'nl', wertet: true, partie: { genauigkeit: 90 } }, { jetzt });
  pruefe('Genauigkeits-Lichtblick nach der Analyse: 10 × Faktor × Rückenwind (wie von Anfang an gerechnet), nur einmal',
    n3.buchungen[0].menge === R.runde((vorBa + 10) * 1.25 * rwf) - R.runde(vorBa * 1.25 * rwf) && n3.eintrag.f === vor + n3.buchungen[0].menge
    && n3.eintrag.ba === vorBa + 10 && n3.eintrag.lb.some((t) => /Genauigkeit 76/.test(t)) && n4.buchungen.length === 0 && n3.eintrag.nt > 0,
  [vor, n3.eintrag, n4.buchungen]);
  const sieg = S.buchePartie(st, { ...d, partieId: 'sg', neueSterne: [false, false, false] }, { lauf, jetzt, gegner: { partien: 2, maxZuege: 50, letzteGenauigkeit: 10 } });
  pruefe('Kein Genauigkeits-Lichtblick nach einem Sieg', S.nachtragPartie(st, { partieId: 'sg', wertet: true, partie: { genauigkeit: 99 } }, { jetzt }).buchungen.length === 0
    && sieg.eintrag.lb.length === 0);
}

gruppe = 'Lernen buchen';
{
  setzeSpeicher(fakeSpeicher());
  const st = S.lade(ort(2026, 10, 22, 20));
  const u = [1, 2, 3].map(() => S.lernUebung(st, { partieId: 'p9', ply: 14, getroffen: true }));
  pruefe('„Ab hier nochmal“: 2 Versuche je Stellung bringen Funken, eine Einheit (Rückenwind)', u[0][0].menge === 15 && u[1][0].menge === 15 && u[2].length === 0
    && S.lernUebung(st, { partieId: 'p9', ply: 16, getroffen: false })[0].menge === 5);
  const mo = [10, 10, 12, 14, 16].map((ply) => S.lernMoment(st, { partieId: 'p9', ply, moment: true }));
  pruefe('Schlüsselmoment angesehen: 5, höchstens 3 je Partie, jeder nur einmal', mo.map((x) => x.length).join() === '1,0,1,1,0' && mo[0][0].menge === 5
    && S.lernMoment(st, { partieId: 'p8', ply: 3, moment: false }).length === 0);
  const ka = Array.from({ length: 10 }, (_, i) => S.lernKarte(st, { karteId: 'k' + i, richtig: true, versuch: 1 }));
  pruefe('Karteikarte: höchstens 8 am Tag', ka.filter((x) => x.length).length === 8 && ka[0][0].menge === 10);
  {
    // Stapel-Sitzung als eine Einheit (3.3 Rueckenwind), nur faellige Karten (freiwillige Felder sitzung und faellig)
    setzeSpeicher(fakeSpeicher());
    const s2 = S.lade(ort(2026, 10, 22, 20));
    s2.rw.karten = 1;
    const nichtFaellig = S.lernKarte(s2, { karteId: 'k0', richtig: true, versuch: 1, quelle: 'kartei', faellig: false });
    const einzeln = S.lernKarte(s2, { karteId: 'k1', richtig: true, versuch: 1, quelle: 'kartei' });
    S.zuenden(s2);
    const ohneSitzung = S.lernKarte(s2, { karteId: 'k2', richtig: true, versuch: 1, quelle: 'kartei' });
    const aktivVor = s2.rw.aktiv;
    const s1 = [1, 1, 2].map((v, i) => S.lernKarte(s2, { karteId: 'a' + i, richtig: true, versuch: v, quelle: 'kartei', faellig: true, sitzung: 'sitzung-a' }));
    const aktivNachA = s2.rw.aktiv;
    const sB = S.lernKarte(s2, { karteId: 'b0', richtig: true, versuch: 1, quelle: 'kartei', sitzung: 'sitzung-b' });
    pruefe('Karteikarte: nur fällige zählen; eine Stapel-Sitzung ist EINE Einheit (Rückenwind: alle Karten doppelt, eine Einheit verbraucht), einzelne Karten ohne Sitzung einfach',
      nichtFaellig.length === 0 && einzeln[0].menge === 10 && ohneSitzung[0].menge === 10 && aktivVor === 3
      && s1.map((x) => x[0].menge).join() === '20,20,8' && s1.every((x) => x[0].rw === 'karte') && aktivNachA === 2
      && sB[0].menge === 20 && s2.rw.aktiv === 1 && s2.lernen.sitzung.id === 'sitzung-b', { s1, aktivVor, aktivNachA, sB, aktiv: s2.rw.aktiv });
  }
  const le = [S.lernLektion(st, { id: 'rudi-1', ringe: { gelernt: true } }), S.lernLektion(st, { id: 'rudi-1', ringe: { gelernt: true } }),
    S.lernLektion(st, { id: 'rudi-1', ringe: { sicher: true } })];
  pruefe('Lektion: 40 beim ersten Abschluss, Ring „Sicher“ einmal +20', le.map((x) => (x[0] ? x[0].menge : 0)).join() === '40,0,20');
  const ohneBlick = S.lernRaetsel(st, { id: 'r1', richtig: true, versuch: 1, quelle: 'tag', wertung: 1500 });
  pruefe('Rätsel nach dem Vertrag in ARCHITEKTUR.md ({ id, richtig, versuch, quelle, wertung }, ohne blick): wie auf Augenhöhe 8 Funken',
    ohneBlick.length === 1 && ohneBlick[0].menge === 8 && ohneBlick[0].quelle === 'lernen'
    && S.lernRaetsel(st, { id: 'r4', richtig: true, versuch: 1, quelle: 'archiv', wertung: null })[0].menge === 8
    && S.lernRaetsel(st, { id: 'r5', richtig: false, versuch: 1, quelle: 'pool', wertung: 1500 })[0].menge === 1, ohneBlick);
  pruefe('Rätsel mit Rätsel-Blick nach Abstand, je Rätsel einmal, Treppenlauf nie einzeln', S.lernRaetsel(st, { id: 'r1', richtig: true, versuch: 1, wertung: 1500 }).length === 0
    && S.lernRaetsel(st, { id: 'r2', richtig: true, versuch: 1, wertung: 1500, blick: 1200 })[0].menge === 12
    && S.lernRaetsel(st, { id: 'r2', richtig: true, versuch: 1, wertung: 1500, blick: 1200 }).length === 0
    && S.lernRaetsel(st, { id: 'r3', richtig: true, versuch: 1, wertung: 1500, blick: 1200, quelle: 'treppe' }).length === 0);
  pruefe('Boss-Siegel einmal je Boss und Stufe', S.siegel(st, { bossId: 'baron', stufe: 'gold' })[0].menge === 100 && S.siegel(st, { bossId: 'baron', stufe: 'gold' }).length === 0
    && S.siegel(st, { bossId: 'baron', stufe: 'bronze' })[0].menge === 50);
  pruefe('Tafel-Rekord nur Allzeit (Platz 1), höchstens einer je Partie (auch mit Bestmarke)', S.rekord(st, { tafel: 'bot:rudi', platz: 1, fenster: 'woche' }, 'pA').length === 0
    && S.rekord(st, { tafel: 'bot:rudi', platz: 2 }, 'pA').length === 0 && S.rekord(st, { tafel: 'bot:rudi', platz: 1 }, 'pA')[0].menge === 25
    && S.rekord(st, { kategorie: 'x', partieId: 'pA' }, 'pA').length === 0 && S.rekord(st, { kategorie: 'x' }, 'pB')[0].menge === 25);
  pruefe('Lern-Funken stehen unter „lernen“, Meilensteine unter „meilenstein“', st.heute.quellen.lernen > 0 && st.heute.quellen.meilenstein === 200);
}

gruppe = 'Arena-Wertung';
{
  setzeSpeicher(fakeSpeicher());
  const st = S.lade(ort(2026, 10, 22, 20));
  pruefe('Ohne Paket Wertung: keine Lage gespeichert (funken rechnet den Leistungswert)', S.lageVon(st) === null);
  pruefe('liga:geaendert mit Wertung (Zahl oder { wert }) wird zur Lage, Unsinn nicht', S.setzeLage(st, { wertung: 1183.6 }) && S.lageVon(st) === 1184
    && S.setzeLage(st, { wertung: { wert: 1096, n: 14 } }) && S.lageVon(st) === 1096 && !S.setzeLage(st, { wertung: 'viel' }) && !S.setzeLage(st, { wertung: -5 })
    && S.lageVon(st) === 1096);
  S.speichere(st);
  pruefe('Lage bleibt gespeichert (normalisiert)', S.lageVon(S.lade(ort(2026, 10, 22, 21))) === 1096);
}

gruppe = 'Speicher-Budget';
{
  setzeSpeicher(fakeSpeicher());
  const st = S.lade(ort(2026, 10, 22, 20));
  st.gesamt = 150000;
  st.level = L.levelVon(150000);
  for (let i = 0; i < 400; i++) st.ids.push('p' + (1e12 + i).toString(36) + 'xy');
  for (let i = 0; i < 40; i++) {
    st.verlauf.push({ id: 'p' + i, t: 1, tag: '2026-10-22', bot: 'greta', erg: 'niederlage', modus: 'normal', f: 300, p: 300, m: 0, ba: 240, z: 160, th: 8, e: 10,
      v: 0, lb: ['So lange wie noch nie gegen Großmeisterin Greta (88 Züge)', 'Genauigkeit 81,2 % (letzte Partie 74,9 %)'], fa: 1.25, fn: 'Herausforderung',
      rw: 'karte', halb: true, of: 40, g: 150000, lv: [70, 71], s: 0, ms: [], gr: null, hilfe: false, nt: 13, lbg: true, lg: 74.9, lf: true });
  }
  for (let i = 0; i < 200; i++) st.lernen.ueb[`p${1e12 + i}:${i}`] = 2;
  for (let i = 0; i < 200; i++) st.lernen.mom['p' + (1e12 + i)] = [1, 2, 3];
  for (let i = 0; i < 300; i++) st.lernen.lek['lektion-' + i] = 'asg';
  const r = S.speichere(st);
  const gelesen = ladeModul('funken', null);
  pruefe(`Voller Stand bleibt im Budget (${r.zeichen} von ${MODUL_BUDGET.funken} Zeichen), Funken und Level bleiben`, r.ok && r.zeichen <= MODUL_BUDGET.funken
    && gelesen && gelesen.gesamt === 150000 && gelesen.verlauf.length >= 10, r);
  pruefe('Modul funken steht in MODUL_BUDGET (25.000)', MODUL_BUDGET.funken === 25000);
}

// =====================================================================
// Optik (Look A): tests/thema.test.mjs liest nur css/*.css, deshalb prueft das Paket seine eigene Datei
// =====================================================================
gruppe = 'Optik (Look A)';
{
  const lies = (d) => readFileSync(path.join(WURZEL, d), 'utf8');
  const css = lies('css/pakete/funken.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const tokens = lies('css/tokens.css') + '\n' + lies('css/themes/modern.css');
  const feste = css.match(/#[0-9a-f]{3,8}\b|\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color-mix)\(/gi) || [];
  pruefe('css/pakete/funken.css: keine festen Farben (nur Tokens)', feste.length === 0, feste);
  const namen = [...new Set((css.match(/var\(--[a-z0-9-]+/gi) || []).map((v) => v.slice(4)))];
  const fehlen = namen.filter((n) => !new RegExp(`${n}\\s*:`).test(tokens));
  pruefe(`css/pakete/funken.css: alle ${namen.length} Variablen stehen in tokens.css oder themes/modern.css`, namen.length > 10 && fehlen.length === 0, fehlen);
  pruefe('css/pakete/funken.css: kein Neon, kein Glow (keine --neon-Variablen, kein text-shadow, kein filter/blur)',
    !/var\(--neon-|text-shadow|filter\s*:|blur\(|drop-shadow/i.test(css));
  const uebergaenge = [...css.matchAll(/transition(?:-property)?\s*:\s*([^;}]+)/gi)].map((m) => m[1].trim()).filter((t) => t !== 'none');
  pruefe('css/pakete/funken.css: Übergänge nur auf transform oder opacity', uebergaenge.every((t) => t.split(',').every((teil) => /^(transform|opacity)\b/.test(teil.trim()))) &&!/@keyframes/.test(css), uebergaenge);
  pruefe('css/pakete/funken.css: Funkenlinie ohne Übergang bei reduzierter Bewegung und Bewegung „aus“',
    /prefers-reduced-motion:\s*reduce\)\s*\{[^}]*\.fk-linie\s*\{\s*transition:\s*none/.test(css) && /\[data-bewegung="aus"\]\s*\.fk-linie\s*\{\s*transition:\s*none/.test(css));
  // Bewegung in ansicht.js nur ueber anim() aus js/bewegung.js und nur mit transform/opacity (Schluessel der Keyframes)
  const js = lies('js/pakete/funken/ansicht.js');
  const bilder = [...js.matchAll(/anim\(\s*[a-zA-Z.]+\s*,\s*\[([^\]]*)\]/g)].map((m) => m[1]);
  const schluessel = new Set(bilder.flatMap((b) => [...b.matchAll(/([a-zA-Z]+)\s*:/g)].map((m) => m[1])));
  pruefe(`ansicht.js: ${bilder.length} Animationen über anim(), Keyframes nur transform, opacity, offset`, bilder.length >= 8
    && [...schluessel].every((k) => ['transform', 'opacity', 'offset'].includes(k)) && !/\.animate\(/.test(js), [...schluessel]);
  pruefe('ansicht.js: Inline-Stile nur für transform (Balken), kein Layout aus dem Code', [...js.matchAll(/style(?:\.([a-zA-Z]+)\s*=|="([a-z-]+):)/g)]
    .every((m) => (m[1] || m[2]) === 'transform'));
}

// =====================================================================
// Verdrahtung ueber den Ereignis-Bus (index.js in Node)
// =====================================================================
gruppe = 'Ereignisse';
{
  setzeSpeicher(fakeSpeicher());
  await import('../js/pakete/funken/index.js');
  const log = [];
  for (const n of ['funken:gebucht', 'funken:geaendert', 'level:aufstieg']) hoere(n, (d) => log.push({ n, d: JSON.parse(JSON.stringify(d)) }));
  const klassen = ['buch', null, 'buch', null, 'bester', null, 'stark'];
  sende('partie:gestartet', { laufId: 'lx', botId: 'benno', farbe: 'w', modus: 'normal', wertet: true, fortgesetzt: false, buehne: null });
  await warte(10);
  sende('zug:bewertet', { laufId: 'lx', ply: 4, klasse: 'bester', gewinnVorher: 0.5, gewinnNachher: 0.6, trivial: false });
  sende('hilfe:genutzt', { laufId: 'lx', art: 'hinweis', stufe: 1 });
  sende('zug:gespielt', { laufId: 'lx', ply: 6, wer: 'flo' });
  sende('zug:bewertet', { laufId: 'lx', ply: 6, klasse: 'stark', gewinnVorher: 0.6, gewinnNachher: 0.92, trivial: false });
  sende('partie:beendet', { laufId: 'lx', partieId: 'pz1', botId: 'benno', modus: 'normal', wertet: true, ergebnis: 'sieg', eigeneZuege: 4,
    liveKlassen: klassen, hinweise: 1, zuruecknahmen: 0, neueSterne: [true, false, false] });
  const geb = log.filter((x) => x.n === 'funken:gebucht');
  const aen = log.filter((x) => x.n === 'funken:geaendert');
  // Theorie 2 + Praezise 5 (der Zug nach dem Hinweis zaehlt 0) + Verwertung 30 = 37; Stern 50 + erster Sieg 100
  pruefe('partie:beendet → funken:gebucht je Quelle { quelle, menge, gesamt, level }', geb.length === 2 && geb[0].d.quelle === 'partie' && geb[0].d.menge === 37
    && geb[1].d.quelle === 'meilenstein' && geb[1].d.menge === 150 && geb[1].d.gesamt === 187 && geb[1].d.level === 2, geb);
  pruefe('funken:geaendert { funken, level, delta, aufstieg } einmal je Ereignis', aen.length === 1 && JSON.stringify(aen[0].d) === '{"funken":187,"level":2,"delta":187,"aufstieg":true}', aen);
  const auf = log.filter((x) => x.n === 'level:aufstieg');
  pruefe('level:aufstieg { level, titel: null bei normalem Level, neu: Stücke }', auf.length === 1 && auf[0].d.level === 2 && auf[0].d.titel === null
    && auf[0].d.neu.map((s) => s.id).join() === 'zugspur-bleistift', auf);
  pruefe('Die Level-Feier wartet auf partie:analysiert (die Analyse kommt noch)', fuerOverlay('pz1').length === 0);
  sende('partie:analysiert', { partieId: 'pz1', botId: 'benno', modus: 'normal', wertet: true, partie: { genauigkeit: 91 }, neueSterne: [true, true, false], quelle: 'partie' });
  const feier = fuerOverlay('pz1');
  pruefe('Nach der Analyse: Stern 2 gebucht und genau eine Level-Zeile mit dem endgültigen Level', feier.length === 1 && feier[0].quelle === 'level'
    && /^Level 2 · Neu: Zugspur Bleistift/.test(feier[0].titel) && feier[0].klang === 'level', feier);
  log.length = 0;
  // auf Level 5 (Titel Glut): der grosse Moment
  const st = S.lade();
  st.gesamt = L.funkenBis(5) - 2;
  S.speichere(st);
  sende('partie:beendet', { laufId: 'ly', partieId: 'pz2', botId: 'benno', modus: 'normal', wertet: true, ergebnis: 'sieg', eigeneZuege: 3,
    liveKlassen: ['buch', null, 'buch', null, 'buch'], hinweise: 0, zuruecknahmen: 0, neueSterne: [false, false, false] });
  sende('partie:analysiert', { partieId: 'pz2', botId: 'benno', wertet: true, partie: { genauigkeit: 50 }, neueSterne: [false, false, false] });
  const f2 = fuerOverlay('pz2');
  const a2 = log.find((x) => x.n === 'level:aufstieg');
  pruefe('Level 5: level:aufstieg mit Titel „Glut“, Feier groß („LEVEL 5 · Glut“) mit Klang level', a2 && a2.d.level === 5 && a2.d.titel === 'Glut'
    && f2.length >= 1 && f2[0].art === 'gross' && f2[0].quelle === 'level-titel' && f2[0].titel === 'LEVEL 5 · Glut' && f2[0].klang === 'level', { a2, f2 });
  log.length = 0;
  sende('tag:gezaehlt', { tag: '2026-10-22', quelle: 'partie', serie: 3, kapitel: 1 });
  pruefe('tag:gezaehlt bringt nie Funken', log.length === 0);
  sende('partie:beendet', { laufId: 'lz', partieId: 'pz3', botId: 'benno', modus: 'uebung', wertet: false, ergebnis: 'sieg', eigeneZuege: 20,
    liveKlassen: ['bester'], hinweise: 0, zuruecknahmen: 0, neueSterne: [false, false, false] });
  pruefe('Übungs-Partie bucht keine Partie-Funken', log.length === 0);
  const fortschrittVor = JSON.stringify(ladeFortschritt());
  const statistikVor = JSON.stringify(statistik());
  sende('uebung:ergebnis', { partieId: 'pz1', ply: 4, getroffen: true });
  pruefe('Übung erhöht die Funken (Lernen), nie Wertung, Sterne oder Statistik', log.some((x) => x.n === 'funken:gebucht' && x.d.quelle === 'lernen' && x.d.menge === 15)
    && JSON.stringify(ladeFortschritt()) === fortschrittVor && JSON.stringify(statistik()) === statistikVor);
  // Faktor aus echten Partien: 12 Siege gegen Benno -> Lage 650, Kalle (800) +150 -> x1,25
  setzeSpeicher(fakeSpeicher());
  for (let i = 0; i < 12; i++) {
    speicherePartie({ datum: new Date(Date.UTC(2026, 9, 1, 10, i)).toISOString(), botId: 'benno', botStufe: 1, spielerFarbe: 'w',
      zuege: Array.from({ length: 30 }, () => 'e2e4'), san: ['e4'], ergebnis: 'sieg', grund: 'matt', hinweise: 0, zuruecknahmen: 0, liveKlassen: [] });
  }
  log.length = 0;
  sende('partie:gestartet', { laufId: 'lk', botId: 'kalle', farbe: 'w', modus: 'normal', wertet: true, fortgesetzt: false, buehne: null });
  await warte(10);
  const lauf = S.lade().lauf;
  pruefe('Faktor wird beim Start festgelegt (12 Siege gegen Benno: Kalle ist „Herausforderung · × 1,25“)', lauf && lauf.id === 'lk' && lauf.fa === 1.25
    && lauf.fn === 'Herausforderung' && lauf.ab === 150, lauf);
}

// =====================================================================
// Browser
// =====================================================================
function ladePlaywright() {
  const kandidaten = [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean);
  for (const k of kandidaten) {
    try { return require(k); } catch (e) { /* naechster */ }
  }
  throw new Error('Playwright nicht gefunden (PLAYWRIGHT_PFAD setzen)');
}

async function warteAufServer(url, ms = 10000) {
  const ende = Date.now() + ms;
  while (Date.now() < ende) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch (e) { /* noch nicht da */ }
    await warte(150);
  }
  throw new Error('Server startet nicht: ' + url);
}

const BASIS = `http://127.0.0.1:${PORT}/index.html?test`;
const MIT = (extra = '') => `${BASIS}&erw=pakete/funken/index${extra}`;
const SCHAEFER_ZUEGE = ['e2e4', 'f1c4', 'd1h5', 'h5f7'];
const SCHAEFER_PLAN = { e2e4: 'e7e5', f1c4: 'b8c6', d1h5: 'g8f6' };
const MODUL = 'schach-arena:v1:modul:funken';
const zahlText = (n) => Math.round(Number(n) || 0).toLocaleString('de-DE');
// kleines Test-Paket wie das Boss-Paket (S1-6): meldet einen Boss an, laedt den Spielplan und meldet spielplan:geladen
// (erst dann liest funken den Spielplan)
const TEST_BOSS = `
import { registriereBot, botNachId } from '../../bots.js';
import { ladeSpielplan } from '../../inhalte.js';
import { hoere, sende } from '../../ereignisse.js';
registriereBot({ id: 'fk-testboss', art: 'boss', archiv: true, name: 'Testboss', avatar: 'assets/avatare/01-bauer-benno.svg', staerke: { ...botNachId('rudi').staerke } });
// nach app:bereit (dann sind alle Pakete angemeldet, sie laden parallel)
hoere('app:bereit', () => ladeSpielplan().then((r) => { if (r.ok) sende('spielplan:geladen', {}); }));
`;
// Boss ohne Spielplan-Datei und ohne Signal (wie das Test-Paket in tests/app.test.mjs mit wpboss)
const TEST_BOSS_OHNE_PLAN = `
import { registriereBot, botNachId } from '../../bots.js';
registriereBot({ id: 'fk-ohneplan', art: 'boss', archiv: true, name: 'Testboss', avatar: 'assets/avatare/01-bauer-benno.svg', staerke: { ...botNachId('rudi').staerke } });
`;

async function neueSeite(browser, { w = 1180, h = 820, handy = false, farbe = 'light', reduziert = false, lokal = null } = {}) {
  const kontext = await browser.newContext({
    viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: true, isMobile: handy, colorScheme: farbe,
    reducedMotion: reduziert ? 'reduce' : 'no-preference',
  });
  if (lokal) {
    await kontext.addInitScript((daten) => {
      if (sessionStorage.getItem('fk-gesaet')) return;
      sessionStorage.setItem('fk-gesaet', '1');
      for (const [k, v] of Object.entries(daten)) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
    }, lokal);
  }
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

function hilfen(seite) {
  const h = {
    async mitte(feld) {
      const b = await seite.locator(`.screen.partie .brett-felder .feld[data-feld="${feld}"]`).boundingBox();
      return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    },
    async tippeFeld(feld) {
      const p = await h.mitte(feld);
      await seite.touchscreen.tap(p.x, p.y);
      await warte(90);
    },
    async zugTippen(uci) {
      await h.tippeFeld(uci.slice(0, 2));
      await h.tippeFeld(uci.slice(2, 4));
    },
    async tippe(sel) {
      const loc = seite.locator(sel).first();
      await loc.waitFor({ state: 'visible', timeout: 10000 });
      const b = await loc.boundingBox();
      await seite.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
      await warte(150);
    },
    async warteFlo(ms = 30000) {
      await seite.waitForFunction(() => window.__partie && window.__partie.phase() === 'flo', null, { timeout: ms });
    },
    async starte(params) {
      await seite.evaluate((p) => window.__app.gehe('partie', p), params);
      await seite.waitForFunction(() => window.__partie && window.__partie.bereit === true, null, { timeout: 30000 });
    },
    async planBot() {
      await seite.evaluate((plan) => {
        localStorage.removeItem('schach-arena:v1:laufend');
        window.__test = { botZug: () => {
          const v = window.__partie.chess().history({ verbose: true });
          return plan[v[v.length - 1].lan] || null;
        } };
      }, SCHAEFER_PLAN);
    },
    // Schaefermatt gegen Benno (wertende Partie), endet mit 4. Dxf7#
    async schaefermatt() {
      await h.planBot();
      await h.starte({ botId: 'benno', farbe: 'w' });
      for (const zug of SCHAEFER_ZUEGE) {
        await h.warteFlo();
        await h.zugTippen(zug);
      }
      await seite.waitForSelector('.ergebnis-overlay .erg-karte-ort .fk-abr', { timeout: 40000 });
      await seite.waitForSelector('.ergebnis-overlay.gefuellt:not(.vorlaeufig)', { timeout: 60000 });
      await seite.evaluate(() => { window.__test = {}; });
    },
    stand: () => seite.evaluate(() => window.__funken.stand()),
    async setzeStand(teil) {
      await seite.evaluate((t) => { const st = window.__funken.stand(); Object.assign(st, t); window.__funken.speichere(st); }, teil);
    },
    async klangSpion() {
      await seite.evaluate(async () => {
        const s = await import('./js/sounds.js');
        window.__klaenge = [];
        if (s.klang.__spion) return;
        const orig = s.klang.spiele;
        s.klang.spiele = (n, ...a) => { window.__klaenge.push(n); return orig.call(s.klang, n, ...a); };
        s.klang.__spion = true;
      });
    },
    klaenge: () => seite.evaluate(() => (window.__klaenge || []).slice()),
    async arena() {
      await seite.evaluate(() => window.__app.gehe('arena'));
      await seite.waitForSelector('.screen.arena');
      await warte(500);
    },
    // wartet, bis die Abrechnungszeile ihr Endbild zeigt (Wert wie im Speicher)
    async abrFertig(ms = 8000) {
      const st = await h.stand();
      const e = st.verlauf[0];
      await seite.waitForFunction((t) => {
        const w = document.querySelector('.ergebnis-overlay .fk-wert');
        const z = document.querySelector('.ergebnis-overlay .fk-abr[data-fertig="1"]');
        return w && z && w.textContent.trim() === t;
      }, '+' + zahlText(e.f), { timeout: ms }).catch(() => {});
      return { st, e };
    },
  };
  return h;
}

async function bild(seite, name) {
  await seite.screenshot({ path: path.join(BILDER, name + '.png') });
}

// Faktor eines Elements (transform: matrix(a, ...) -> a)
const skala = (seite, sel) => seite.evaluate((s) => {
  const el = document.querySelector(s);
  if (!el) return null;
  const m = getComputedStyle(el).transform;
  if (!m || m === 'none') return 1;
  const z = m.match(/matrix\(([^,]+)/);
  return z ? Number(z[1]) : null;
}, sel);

// Kontrast zweier Farben (rgb/rgba) nach WCAG
const kontrast = (seite, textSel, grundSel) => seite.evaluate(([t, g]) => {
  const farbe = (el, eig) => {
    let e = el;
    while (e) {
      const c = getComputedStyle(e)[eig];
      const m = c && c.match(/rgba?\(([^)]+)\)/);
      if (m) {
        const [r, gg, b, a = 1] = m[1].split(',').map(Number);
        if (eig === 'color' || a > 0.5) return [r, gg, b];
      }
      if (eig === 'color') return null;
      e = e.parentElement;
    }
    return [255, 255, 255];
  };
  const lum = ([r, g, b]) => {
    const f = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const te = document.querySelector(t);
  const ge = document.querySelector(g);
  if (!te || !ge) return 0;
  const a = lum(farbe(te, 'color'));
  const b = lum(farbe(ge, 'backgroundColor'));
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}, [textSel, grundSel]);

// Mass des Level-Chips im Kopf (im Browser ausgewertet): sichtbarer Chip, Sterne-Chip daneben, echte Tippflaeche (Punkte,
// an denen elementFromPoint den Chip trifft, senkrecht durch die Mitte und waagrecht auf halber Hoehe), Oberkanten der
// Chip-Reihe (eine Zeile, wie navigation.test.mjs), ganz sichtbar in der Reihe; knoepfeKopf: alle Knoepfe im Kopf >= 44 x 44
const kopfChipMass = () => {
  const r = (e) => { const b = e ? e.getBoundingClientRect() : { width: 0, height: 0 }; return { w: Math.round(b.width), h: Math.round(b.height) }; };
  const chip = document.querySelector('.haupt-kopf .fk-chip');
  const chips = document.querySelector('.haupt-kopf .kopf-chips');
  if (!chip || !chips) return { fehlt: true };
  const b = chip.getBoundingClientRect();
  const trifft = (x, y) => { const e = document.elementFromPoint(x, y); return !!e && !!e.closest('.fk-chip'); };
  let hoch = 0;
  for (let y = Math.floor(b.top) - 12; y <= Math.ceil(b.bottom) + 12; y++) if (trifft(b.left + b.width / 2, y + 0.5)) hoch++;
  let breit = 0;
  for (let x = Math.floor(b.left) - 12; x <= Math.ceil(b.right) + 12; x++) if (trifft(x + 0.5, b.top + b.height / 2)) breit++;
  const c = chips.getBoundingClientRect();
  return {
    sicht: r(chip), sterne: r(chips.querySelector('.chip:not(.fk-chip)')), tipp: { w: breit, h: hoch },
    rolle: chip.getAttribute('role') === 'button' && chip.tabIndex === 0 && /^Level \d+/.test(chip.getAttribute('aria-label') || ''),
    oben: new Set([...chips.children].filter((x) => x.getBoundingClientRect().width > 0).map((x) => Math.round(x.getBoundingClientRect().top))).size,
    ganz: b.left >= c.left - 1 && b.right <= c.right + 1,
    knoepfeKopf: [...document.querySelectorAll('.haupt-kopf button')].filter((x) => x.getBoundingClientRect().width)
      .every((x) => x.getBoundingClientRect().width >= 44 && x.getBoundingClientRect().height >= 44),
  };
};

async function testeBrowser(browser) {
  // ---------- 1. Arena frisch: Chip, Spiegel, Heute-Zeile, Faktor, Zuenden ----------
  gruppe = 'Arena';
  const { kontext, seite, fehler } = await neueSeite(browser);
  const h = hilfen(seite);
  await seite.goto(MIT() + '#arena');
  await seite.waitForSelector('.screen.arena .fk-chip');
  await warte(600);
  const kopf = await seite.evaluate(() => [...document.querySelector('.kopf-chips').children].map((c) => c.className));
  pruefe('arena:kopf: Chip „Level 1“ mit Mini-Balken nach den Chips Sterne und Pokal', /Level\s*1/.test(await seite.locator('.fk-chip').innerText())
    && await seite.locator('.fk-chip .fk-mini > i').count() === 1 && kopf.findIndex((k) => /fk-chip/.test(k)) > kopf.findIndex((k) => /chip-pokal/.test(k)), kopf);
  pruefe('arena:heute: am ersten Tag noch keine Rückenwind-Zeile (die erste Karte kommt an Tag 4, SPIELKONZEPT 3.16)',
    await seite.locator('.fk-heute').count() === 0 && (await h.stand()).rw.karten === 0);
  // vier Tage spaeter (Start 3 Tage zurueck): die erste Karte stellt sich vor
  await seite.evaluate(async () => {
    const t = await import('./js/tag.js');
    const st = window.__funken.stand();
    st.rw.start = t.addiereTage(t.tagSchluessel(), -3);
    st.rw.woche = null;
    window.__funken.speichere(st);
  });
  await h.arena();
  const tag4 = await h.stand();
  pruefe('arena:heute an Tag 4: „Neu für dich: eine Rückenwind-Karte“ mit „Zünden“ (erste Karte liegt im Fach)',
    /^Neu für dich: eine Rückenwind-Karte\. Zünden: Die nächsten 3 Einheiten zählen doppelt\.$/.test((await seite.locator('.heute-karte:not([hidden]) .fk-heute .fk-h-text').innerText()).trim())
    && await seite.locator('.fk-heute .fk-zuenden').count() === 1 && tag4.rw.karten === 1 && tag4.rw.neu === 'erste', tag4.rw);
  const kopfMass = await seite.evaluate(kopfChipMass);
  pruefe('arena:kopf: Level-Chip antippbar (role=button, Tastatur) mit Tippfläche mindestens 44 x 44, sichtbar so hoch wie der Sterne-Chip, '
    + 'eine Oberkante in der Chip-Reihe, Kopf-Knöpfe weiter mindestens 44 x 44', kopfMass.rolle && kopfMass.tipp.w >= 44 && kopfMass.tipp.h >= 44
    && Math.abs(kopfMass.sicht.h - kopfMass.sterne.h) <= 1 && kopfMass.oben === 1 && kopfMass.ganz && kopfMass.knoepfeKopf, kopfMass);
  const tipp = await seite.evaluate(() => Math.round(document.querySelector('.fk-heute .fk-zuenden').getBoundingClientRect().height));
  pruefe('Tippfläche „Zünden“ mindestens 44 px', tipp >= 44, tipp);
  pruefe('arena:panel-bot: Faktor vor der Partie („Einstieg · Funken × 1“)', (await seite.locator('.ort-panel-bot .fk-faktor').innerText()).trim() === 'Einstieg · Funken × 1');
  await bild(seite, 'arena-frisch');
  await h.tippe('.fk-chip');
  await seite.waitForSelector('.fk-spiegel-ort .fk-spiegel');
  await warte(500);
  const spiegel = await seite.locator('.fk-spiegel').innerText();
  pruefe('Antippen des Chips öffnet den Funken-Spiegel (Level, Balken, heute, Tagesbogen, Rückenwind, nächste Freischaltung, Regeln)',
    /Funken-Spiegel/.test(spiegel) && /Level 1 · Funke/.test(spiegel) && /0 von 100 bis Level 2/.test(spiegel) && /Heute zählen noch 800 Funken voll/.test(spiegel)
    && /1 Rückenwind-Karte im Fach/.test(spiegel) && /Level 2: Zugspur Bleistift/.test(spiegel) && /So entstehen Funken/.test(spiegel), spiegel.slice(0, 300));
  await bild(seite, 'spiegel');
  await seite.keyboard.press('Escape');
  // wie navigation.test.mjs beim Blatt: hoechstens 2 s auf das Wegfahren warten (unter Last laeuft es spaeter aus)
  await seite.waitForFunction(() => !document.querySelector('.fk-spiegel-ort'), null, { timeout: 2000 }).catch(() => {});
  pruefe('Escape schließt den Spiegel', await seite.locator('.fk-spiegel-ort').count() === 0);
  // Tastatur: der Chip ist fokussierbar, Enter oeffnet den Spiegel, nach Escape steht der Fokus wieder auf dem Chip
  await seite.locator('.fk-chip').focus();
  await seite.keyboard.press('Enter');
  const perTaste = await seite.waitForSelector('.fk-spiegel-ort .fk-spiegel', { timeout: 3000 }).then(() => true).catch(() => false);
  await warte(300);
  // modal: Tab und Umschalt+Tab bleiben im Blatt (wie bauteile.sheet)
  const imBlatt = [];
  for (let i = 0; i < 6; i++) {
    await seite.keyboard.press('Tab');
    imBlatt.push(await seite.evaluate(() => !!document.activeElement && !!document.activeElement.closest('.fk-spiegel')));
  }
  for (let i = 0; i < 3; i++) {
    await seite.keyboard.press('Shift+Tab');
    imBlatt.push(await seite.evaluate(() => !!document.activeElement && !!document.activeElement.closest('.fk-spiegel')));
  }
  pruefe('Funken-Spiegel ist modal: Tab und Umschalt+Tab bleiben im Blatt', perTaste && imBlatt.every(Boolean), imBlatt);
  await seite.keyboard.press('Escape');
  await seite.waitForFunction(() => !document.querySelector('.fk-spiegel-ort'), null, { timeout: 2000 }).catch(() => {});
  pruefe('Tastatur: Enter auf dem Level-Chip öffnet den Spiegel, Escape schließt ihn, Fokus zurück auf dem Chip', perTaste
    && await seite.locator('.fk-spiegel-ort').count() === 0 && await seite.evaluate(() => document.activeElement && document.activeElement.matches('.fk-chip')));
  await h.tippe('.fk-heute .fk-zuenden');
  await warte(300);
  const nachZuenden = await h.stand();
  pruefe('„Zünden“: die nächsten 3 Einheiten zählen doppelt, die Zeile sagt es ruhig, kein Knopf mehr',
    /Rückenwind an: Die nächsten 3 Einheiten zählen doppelt\./.test(await seite.locator('.fk-heute').innerText())
    && await seite.locator('.fk-heute .fk-zuenden').count() === 0 && nachZuenden.rw.aktiv === 3 && nachZuenden.rw.karten === 0, nachZuenden.rw);

  // ---------- 2. Partie: Abrechnungszeile, Balken, Aufschluesselung, Feier, Klang ----------
  gruppe = 'Abrechnung';
  await h.klangSpion();
  await h.schaefermatt();
  const { st: st1, e: e1 } = await h.abrFertig();
  const fs1 = await seite.evaluate((g) => window.__funken.L.fortschritt(g), e1.g);
  pruefe('ergebnis:abrechnung: eine Zeile data-zeile="funken" in der Abrechnung', await seite.locator('.erg-karte-ort .abrechnung > .fk-abr[data-zeile="funken"]').count() === 1);
  pruefe('Zeile „+Funken“ wie gebucht (Rückenwind-Karte: × 2 in der Formel)', (await seite.locator('.fk-wert').innerText()).trim() === '+' + zahlText(e1.f)
    && e1.rw === 'karte' && /× 2/.test(await seite.locator('.fk-formel').innerText()) && st1.rw.aktiv === 2, { e1, formel: await seite.locator('.fk-formel').innerText() });
  const sk1 = await skala(seite, '.fk-abr .fk-balken > i');
  pruefe('Level-Balken steht auf dem neuen Stand', Math.abs(sk1 - fs1.anteil) < 0.02 && (await seite.locator('.fk-abr .fk-level').innerText()).trim() === `Level ${fs1.level}`
    && (await seite.locator('.fk-abr .fk-bis').innerText()).trim() === `${zahlText(fs1.bis)} bis Level ${fs1.level + 1}`, { sk1, fs1 });
  pruefe('Erste Partie: Aufstieg (data-aufstieg), Zahl im Emblem umgeklappt', e1.lv[1] > e1.lv[0] && await seite.locator(`.fk-abr[data-aufstieg="${fs1.level}"]`).count() === 1
    && (await seite.locator('.fk-abr .fk-z-neu').innerText()).trim() === String(fs1.level), e1.lv);
  const feier1 = await seite.locator('.erg-feier .erg-f-zeile[data-quelle="level"]').allInnerTexts();
  pruefe('Feier-Zeile „Level n · Neu: …“ mit Können-Satz (genau eine Level-Zeile)', feier1.length === 1 && new RegExp(`^Level ${fs1.level} · Neu: Zugspur Bleistift`).test(feier1[0])
    && /Züge gespielt|Seit Level/.test(feier1[0]), feier1);
  await warte(600);
  const k1 = await h.klaenge();
  pruefe('Klang „level“ genau einmal beim Aufstieg', k1.filter((n) => n === 'level').length === 1, k1);
  await h.tippe('.fk-abr-knopf');
  const det = await seite.locator('.fk-details').innerText();
  pruefe('Antippen zeigt die Aufschlüsselung (Züge, Theorie, Verwertung, × 2 Rückenwind-Karte, Meilensteine)', await seite.locator('.fk-details:not([hidden])').count() === 1
    && await seite.locator('.fk-abr-knopf[aria-expanded="true"]').count() === 1 && /Züge \(\d+ offen\)/.test(det) && /Theorie/.test(det) && /Verwertung/.test(det)
    && /× 2 Rückenwind-Karte/.test(det) && /Meilensteine: neue Sterne, erster Sieg gegen Bauer Benno/.test(det), det);
  pruefe('Kurzer Sieg (Schäfermatt, 4 Züge): die Aufschlüsselung sagt, warum der Ergebnis-Bonus fehlt', e1.e === 0 && e1.erg === 'sieg' && e1.p > 0
    && /Vor dem 10\. eigenen Zug beendet: kein Ergebnis-Bonus/.test(det), { e: e1.e, p: e1.p, det });
  await bild(seite, 'ergebnis-aufstieg');
  await seite.locator('.ergebnis-overlay .erg-zu').click();

  // ---------- 3. Bot gruesst das neue Level, dann der grosse Moment (Level 5, Titel Glut) ----------
  gruppe = 'Level-Aufstieg';
  await h.arena();
  pruefe('Kopf-Chip zeigt das neue Level', new RegExp(`Level\\s*${fs1.level}`).test(await seite.locator('.fk-chip').innerText()));
  pruefe('Merker: der nächste Partiestart grüßt das neue Level', (await h.stand()).gruss === true);
  const fuenf = await seite.evaluate(() => window.__funken.L.funkenBis(5));
  await h.setzeStand({ gesamt: fuenf - 3 });
  await h.planBot();
  await h.starte({ botId: 'benno', farbe: 'w' });
  await warte(300);
  const blase = await seite.locator('.blase-ort .sprechblase').first().innerText().catch(() => '');
  pruefe('Benno grüßt einmal das neue Level (eigener Satz, kein fremder Text)', /Ein neues Level\? Donnerwetter/.test(blase), blase);
  pruefe('Der Gruß kommt nur einmal (Merker gelöscht)', (await h.stand()).gruss === false);
  await seite.evaluate(() => { window.__klaenge = []; });
  for (const zug of SCHAEFER_ZUEGE) {
    await h.warteFlo();
    await h.zugTippen(zug);
  }
  await seite.waitForSelector('.ergebnis-overlay .fk-abr', { timeout: 40000 });
  await seite.waitForSelector('.ergebnis-overlay.gefuellt:not(.vorlaeufig)', { timeout: 60000 });
  const { e: e2 } = await h.abrFertig();
  await warte(900);
  const gross = await seite.locator('.erg-feier .erg-f-zeile.gross[data-quelle="level-titel"]').allInnerTexts();
  pruefe('Level 5 ist der große Moment: „LEVEL 5 · Glut“ mit Beleg-Satz', gross.length === 1 && /^LEVEL 5 · Glut/.test(gross[0]) && e2.lv[1] === 5, { gross, lv: e2.lv });
  pruefe('Balken lief über: Zeile aufgestiegen, Emblem zeigt 5', await seite.locator('.fk-abr.aufgestiegen[data-aufstieg="5"]').count() === 1
    && (await seite.locator('.fk-abr .fk-z-neu').innerText()).trim() === '5');
  const k2 = await h.klaenge();
  pruefe('Klang „level“ genau einmal (die große Feier-Zeile spielt ihn)', k2.filter((n) => n === 'level').length === 1, k2);
  pruefe('Titel gewechselt, Stück freigeschaltet (Speicher)', (await h.stand()).freigeschaltet.includes('titel-glut'));
  await bild(seite, 'ergebnis-level5');
  await seite.locator('.ergebnis-overlay .erg-zu').click();

  // ---------- 4. Verlauf: Karte "Level und Funken" ----------
  gruppe = 'Verlauf';
  await seite.evaluate(() => window.__app.gehe('verlauf'));
  await seite.waitForSelector('.vl-ort .fk-karte');
  const karte = await seite.locator('.vl-ort .fk-karte').innerText();
  const stv = await h.stand();
  pruefe('verlauf:seite: Karte mit Level, Titel, Balken, heute und den letzten Partien', /Level 5 · Glut/.test(karte) && await seite.locator('.fk-karte .fk-balken').count() === 1
    && new RegExp(`Heute ${zahlText(stv.heute.funken)} Funken`).test(karte) && await seite.locator('.fk-karte .fk-partien li').count() === 2
    && /Bauer Benno/.test(karte) && new RegExp(`\\+${zahlText(stv.verlauf[0].f)}`).test(karte), karte);
  await bild(seite, 'verlauf');
  await h.tippe('.fk-karte .fk-k-mehr');
  await seite.waitForSelector('.fk-spiegel');
  const sp2 = await seite.locator('.fk-spiegel').innerText();
  pruefe('Funken-Spiegel aus dem Verlauf: letzter Aufstieg mit Satz und Herkunft, heute nach Quellen', /Letzter Aufstieg/.test(sp2) && /Level 5:/.test(sp2)
    && /Partien \d/.test(sp2) && /Meilensteine \d/.test(sp2) && /Gezählt in deinen letzten|Verglichen/.test(sp2), sp2.slice(0, 400));
  await seite.locator('.fk-spiegel .fk-schliessen').click();
  await warte(400);
  pruefe('Partie-Wechsel räumt auf: keine Konsolenfehler im Ablauf', fehler.length === 0, fehler.join(' | '));
  await kontext.close();

  // ---------- 5. Reduzierte Bewegung: sofort das Endbild, Klang bleibt ----------
  gruppe = 'Reduzierte Bewegung';
  {
    const lokal = { [MODUL]: { gesamt: 2340 - 3, rw: { karten: 0, woche: null } } };
    const { kontext: k, seite: s, fehler: f } = await neueSeite(browser, { reduziert: true, lokal });
    const hh = hilfen(s);
    await s.goto(MIT() + '#arena');
    await s.waitForSelector('.screen.arena .fk-chip');
    await hh.klangSpion();
    await hh.planBot();
    await hh.starte({ botId: 'benno', farbe: 'w' });
    for (const zug of SCHAEFER_ZUEGE) {
      await hh.warteFlo();
      await hh.zugTippen(zug);
    }
    await s.waitForSelector('.ergebnis-overlay .fk-abr', { timeout: 40000 });
    const st = await hh.stand();
    const sofort = (await s.locator('.fk-wert').innerText()).trim();
    pruefe('Endbild sofort (kein Hochzählen, kein Einrollen)', sofort === '+' + zahlText(st.verlauf[0].f) && await s.locator('.fk-abr.abr-rollt').count() === 0, sofort);
    await s.waitForSelector('.erg-feier .erg-f-zeile.gross[data-quelle="level-titel"]', { timeout: 20000 });
    await warte(2500);
    pruefe('Level 10 (Fackelträger) als große Feier, Klang „level“ trotzdem', /LEVEL 10 · Fackelträger/.test(await s.locator('.erg-feier').innerText())
      && (await hh.klaenge()).filter((n) => n === 'level').length === 1, await hh.klaenge());
    pruefe('Keine Konsolenfehler', f.length === 0, f.join(' | '));
    await k.close();
  }

  // ---------- 6. Alter Spielstand und Faktor aus echten Partien ----------
  gruppe = 'Faktor';
  {
    const partien = Array.from({ length: 12 }, (_, i) => ({ id: 'palt' + i, datum: new Date(Date.UTC(2026, 9, 1, 10, i)).toISOString(), botId: 'benno', botStufe: 1,
      spielerFarbe: 'w', zuege: Array.from({ length: 30 }, () => 'e2e4'), san: ['e4'], ergebnis: 'sieg', grund: 'matt', hinweise: 0, zuruecknahmen: 0,
      liveKlassen: [], genauigkeit: 70, modus: 'normal', sterne: [true, true, true] }));
    const fortschritt = { bots: { benno: { sterne: [true, true, true], partien: 12, siege: 12, remis: 0, niederlagen: 0, besteGenauigkeit: 70 },
      hilde: { sterne: [true, false, false], partien: 1, siege: 1, remis: 0, niederlagen: 0, besteGenauigkeit: 60 } }, brillanteZuege: [] };
    const lokal = { 'schach-arena:v1:partien': partien, 'schach-arena:v1:fortschritt': fortschritt };
    const { kontext: k, seite: s, fehler: f } = await neueSeite(browser, { lokal });
    const hh = hilfen(s);
    await s.goto(MIT() + '#arena');
    await s.waitForSelector('.screen.arena .fk-chip');
    await warte(500);
    pruefe('Alter Spielstand (12 Partien, kein Modul): Level 1, 0 Funken', /Level\s*1/.test(await s.locator('.fk-chip').innerText()) && (await hh.stand()).gesamt === 0);
    await hh.tippe('.fk-chip');
    await s.waitForSelector('.fk-spiegel-ort .fk-spiegel');
    pruefe('Funken-Spiegel vor der ersten Karte: „Die erste Rückenwind-Karte kommt an deinem 4. Tag, danach jeden Montag eine.“',
      /Die erste Rückenwind-Karte kommt an deinem 4\. Tag, danach jeden Montag eine\./.test(await s.locator('.fk-spiegel .fk-s-rw').innerText()));
    await s.locator('.fk-spiegel .fk-schliessen').click();
    await s.waitForFunction(() => !document.querySelector('.fk-spiegel-ort'), null, { timeout: 2000 }).catch(() => {});
    await hh.tippe('.knoten[data-bot="benno"]');
    await warte(300);
    pruefe('Benno nach 12 Siegen: „Training · Funken × 0,5“ (Lage 650, Abstand −400)', (await s.locator('.ort-panel-bot .fk-faktor').innerText()).trim() === 'Training · Funken × 0,5');
    await hh.tippe('.knoten[data-bot="kalle"]');
    await warte(300);
    pruefe('Kalle: „Herausforderung · Funken × 1,25“ (Abstand +150)', (await s.locator('.ort-panel-bot .fk-faktor').innerText()).trim() === 'Herausforderung · Funken × 1,25');
    // Antippen der Ergebnis-Karte zeigt sofort alles (auch die Funken-Zeile springt auf ihr Endbild)
    await hh.planBot();
    await hh.starte({ botId: 'benno', farbe: 'w' });
    for (const zug of SCHAEFER_ZUEGE) {
      await hh.warteFlo();
      await hh.zugTippen(zug);
    }
    await s.waitForSelector('.ergebnis-overlay .erg-karte-ort .fk-abr', { timeout: 40000 });
    const vorTipp = await s.evaluate(() => !!document.querySelector('.fk-abr[data-fertig="1"]'));
    await s.locator('.ergebnis-overlay .erg-unter').click();
    await warte(250);
    const st6 = await hh.stand();
    const nachTipp = await s.evaluate(() => ({ fertig: !!document.querySelector('.fk-abr[data-fertig="1"]'), wert: document.querySelector('.fk-wert').textContent.trim() }));
    pruefe('Antippen der Ergebnis-Karte zeigt die Funken-Zeile sofort fertig', !vorTipp && nachTipp.fertig && nachTipp.wert === '+' + zahlText(st6.verlauf[0].f), { vorTipp, nachTipp });
    const hoehe = await s.evaluate(() => Math.round(document.querySelector('.fk-abr-knopf').getBoundingClientRect().height));
    pruefe('Tippfläche der Abrechnungszeile mindestens 44 px', hoehe >= 44, hoehe);
    await s.waitForSelector('.ergebnis-overlay.gefuellt:not(.vorlaeufig)', { timeout: 60000 });
    const { e } = await hh.abrFertig();
    pruefe('Die Partie gegen Benno rechnet mit dem angesagten Faktor × 0,5', e.fa === 0.5 && e.fn === 'Training' && /× 0,5/.test(await s.locator('.fk-formel').innerText()), e);
    pruefe('Keine Konsolenfehler', f.length === 0, f.join(' | '));
    await k.close();
  }

  // ---------- 7. Funkenlinie an und aus, Spieler-Leiste ----------
  gruppe = 'Funkenlinie';
  {
    const lokal = { 'schach-arena:v1:einstellungen': { funkenlinie: true } };
    const { kontext: k, seite: s, fehler: f } = await neueSeite(browser, { lokal });
    const hh = hilfen(s);
    await s.goto(MIT() + '#arena');
    await s.waitForSelector('.screen.arena .fk-chip');
    await hh.planBot();
    await hh.starte({ botId: 'benno', farbe: 'w' });
    await hh.warteFlo();
    pruefe('partie:spieler-leiste: Level-Emblem an Flos Namen', (await s.locator('.ort-spieler-leiste .fk-spieler').first().innerText()).trim() === '1');
    await hh.zugTippen('e2e4');
    await s.waitForFunction(() => { const l = document.querySelector('.p-funkenlinie .fk-linie'); return l && /matrix\((0\.0[1-9]|0\.[1-9])/.test(getComputedStyle(l).transform); }, null, { timeout: 30000 }).catch(() => {});
    const an = await s.evaluate(() => {
      const p = document.querySelector('.p-funkenlinie');
      const l = p && p.querySelector('.fk-linie');
      return { da: !!p, sichtbar: !!p && !p.hidden && p.getBoundingClientRect().height > 0, linie: !!l, anteil: p ? Number(p.dataset.anteil) : null };
    });
    pruefe('Anzeige an: dünne Linie am Brett, füllt sich mit dem ersten guten Zug (ohne Zahl)', an.da && an.sichtbar && an.linie && an.anteil > 0
      && !(await s.locator('.p-funkenlinie').innerText()).trim(), an);
    await bild(s, 'funkenlinie');
    await s.evaluate(async () => { const st = await import('./js/storage.js'); st.speichereEinstellungen({ ...st.ladeEinstellungen(), funkenlinie: false }); });
    await hh.arena();
    await hh.starte({ botId: 'benno', farbe: 'w' });
    await hh.warteFlo();
    await hh.zugTippen('e2e4');
    await warte(1500);
    pruefe('Anzeige aus (Standard): keine Funkenlinie über oder am Brett', await s.locator('.p-funkenlinie:not([hidden])').count() === 0
      && await s.locator('.fk-linie').count() === 0);
    pruefe('Keine Konsolenfehler', f.length === 0, f.join(' | '));
    await k.close();
  }

  // ---------- 8. Funken-Wochenende (Spielplan des Boss-Pakets) ----------
  gruppe = 'Funken-Wochenende';
  {
    // eine Karte im Fach und 2 aktive Einheiten: am Funken-Wochenende wird nichts davon verbraucht (nie x 4)
    const lokal = { [MODUL]: { rw: { karten: 1, aktiv: 2, woche: '2026-11-30', start: '2026-11-20' } } };
    const { kontext: k, seite: s, fehler: f } = await neueSeite(browser, { lokal });
    const hh = hilfen(s);
    const plan = readFileSync(path.join(WURZEL, 'daten/beispiel/spielplan.json'), 'utf8');
    await s.route('**/daten/boss/spielplan.json', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: plan }));
    await s.route('**/js/pakete/fk-test/index.js', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: TEST_BOSS }));
    // Samstag, 5.12.2026, 12 Uhr (Woche ab 30.11. hat ein Funken-Wochenende): nur die Uhr steht, Timer laufen weiter
    await s.clock.setFixedTime(new Date(2026, 11, 5, 12, 0, 0));
    await s.goto(`${BASIS}&erw=pakete/fk-test/index,pakete/funken/index#arena`);
    await s.waitForSelector('.screen.arena .fk-chip');
    await s.waitForFunction(() => window.__funken && window.__funken.plan(), null, { timeout: 10000 }).catch(() => {});
    await hh.arena();
    pruefe('Heute-Karte: „Funken-Wochenende: Partien und Lernen zählen doppelt.“', /Funken-Wochenende: Partien und Lernen zählen doppelt\./.test(await s.locator('.fk-heute').innerText()));
    await hh.schaefermatt();
    const { e } = await hh.abrFertig();
    const rwNach = (await hh.stand()).rw;
    pruefe('Partie am Funken-Wochenende zählt doppelt (Quelle Wochenende, Karte bleibt im Fach, aktive Einheiten bleiben)', e.rw === 'wochenende'
      && rwNach.karten === 1 && rwNach.aktiv === 2 && /× 2 Funken-Wochenende/.test(await s.locator('.fk-details').innerHTML()), { e, rw: rwNach });
    pruefe('Keine Konsolenfehler (der Spielplan wird erst nach spielplan:geladen gelesen)', f.length === 0, f.join(' | '));
    await k.close();
  }
  {
    // ohne Boss: kein Abruf des Spielplans (sonst 404 in der Konsole)
    const { kontext: k, seite: s, fehler: f } = await neueSeite(browser);
    const anfragen = [];
    s.on('request', (r) => { if (/spielplan\.json/.test(r.url())) anfragen.push(r.url()); });
    await s.goto(MIT() + '#arena');
    await s.waitForSelector('.screen.arena .fk-chip');
    await warte(1200);
    pruefe('Ohne Boss-Paket fragt funken nie nach dem Spielplan (kein 404)', anfragen.length === 0 && f.length === 0, anfragen);
    await k.close();
  }
  {
    // Boss angemeldet, aber ohne Spielplan-Datei und ohne spielplan:geladen (wie wpboss in tests/app.test.mjs): kein Abruf
    const { kontext: k, seite: s, fehler: f } = await neueSeite(browser);
    const hh = hilfen(s);
    const anfragen = [];
    s.on('request', (r) => { if (/spielplan\.json/.test(r.url())) anfragen.push(r.url()); });
    await s.route('**/js/pakete/fk-ohneplan/index.js', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: TEST_BOSS_OHNE_PLAN }));
    await s.goto(`${BASIS}&erw=pakete/fk-ohneplan/index,pakete/funken/index#arena`);
    await s.waitForSelector('.screen.arena .fk-chip');
    await hh.starte({ botId: 'benno', farbe: 'w' });
    await hh.arena();
    await warte(800);
    pruefe('Boss ohne Spielplan und ohne spielplan:geladen: funken fragt nicht nach dem Spielplan (kein 404, keine Konsolenfehler)',
      anfragen.length === 0 && f.length === 0 && await s.evaluate(() => window.__funken.plan() === null), { anfragen, f });
    await k.close();
  }

  // ---------- 9. spielplan:tage in der Test-Huelle ----------
  gruppe = 'Spielplan';
  {
    const { kontext: k, seite: s, fehler: f } = await neueSeite(browser);
    const huelle = async (woche, tag) => {
      await s.goto(`http://127.0.0.1:${PORT}/tests/orte-huelle.html?ort=spielplan:tage&erw=pakete/funken/index&woche=${woche}&tag=${tag}`);
      await s.waitForFunction(() => window.__huelle && window.__huelle.bereit, null, { timeout: 15000 });
      return s.evaluate(() => ({ anzahl: window.__huelle.anzahl, text: (document.querySelector('.fk-spielplan') || {}).textContent || '', fehler: window.__huelle.fehler }));
    };
    const sa = await huelle('2026-11-30', '2026-12-05');
    const di = await huelle('2026-11-30', '2026-12-01');
    const ohne = await huelle('2026-11-23', '2026-11-28');
    pruefe('Steckbrief Samstag: „Funken-Wochenende ab Freitag 16 Uhr …“ (nur Anfänge, kein Countdown)', sa.anzahl === 1
      && /^Funken-Wochenende ab Freitag 16 Uhr: Partien und Lernen zählen doppelt\./.test(sa.text), sa);
    pruefe('Dienstag derselben Woche und Wochen ohne Funken-Wochenende: nichts', di.anzahl === 0 && ohne.anzahl === 0, [di, ohne]);
    pruefe('Keine Konsolenfehler', f.length === 0, f.join(' | '));
    await k.close();
  }

  // ---------- 10. Kopf nach Platz: Level-Chip im iPad-Hochformat ganz sichtbar, die Form folgt dem Platz ----------
  gruppe = 'Kopf nach Platz';
  {
    const form = (s) => s.evaluate(() => {
      const c = document.querySelector('.haupt-kopf .fk-chip');
      const w = c && c.querySelector('.fk-chip-wort');
      return { schmal: !!c && c.classList.contains('fk-schmal'), wort: !!w && getComputedStyle(w).display !== 'none' };
    });
    const passt = (m) => m.rolle && m.ganz && m.tipp.w >= 44 && m.tipp.h >= 44 && m.oben === 1 && Math.abs(m.sicht.h - m.sterne.h) <= 1;
    // frisch geladen im Hochformat des iPad mini (744 x 1133): gleich die schmale Form, ganz sichtbar
    const { kontext: k1, seite: s1, fehler: f1 } = await neueSeite(browser, { w: 744, h: 1133 });
    await s1.goto(MIT() + '#arena');
    await s1.waitForSelector('.screen.arena .fk-chip');
    await warte(500);
    const frisch = { ...(await s1.evaluate(kopfChipMass)), ...(await form(s1)) };
    pruefe('iPad mini hoch (744 px), frisch geladen: Level-Chip schmal und ganz sichtbar, Tippfläche mindestens 44 x 44', passt(frisch) && frisch.schmal, frisch);
    await s1.screenshot({ path: path.join(BILDER, 'kopf-744.png'), clip: { x: 0, y: 0, width: 744, height: 90 } });
    pruefe('744 px: keine Konsolenfehler', f1.length === 0, f1.join(' | '));
    await k1.close();
    // Groesse aendern: die Form folgt (ResizeObserver), auch zurueck
    const { kontext: k, seite: s, fehler: f } = await neueSeite(browser);
    await s.goto(MIT() + '#arena');
    await s.waitForSelector('.screen.arena .fk-chip');
    await warte(500);
    const breit = { ...(await s.evaluate(kopfChipMass)), ...(await form(s)) };
    const mass = {};
    for (const w of [744, 768, 810, 834]) {
      await s.setViewportSize({ width: w, height: 1100 });
      await warte(300);
      mass[w] = { ...(await s.evaluate(kopfChipMass)), ...(await form(s)) };
    }
    await s.setViewportSize({ width: 1180, height: 820 });
    await warte(300);
    const zurueck = { ...(await s.evaluate(kopfChipMass)), ...(await form(s)) };
    pruefe('iPad hoch (744, 768, 810, 834 px): Level-Chip ganz sichtbar, Tippfläche mindestens 44 x 44, eine Oberkante, so hoch wie Sterne',
      Object.values(mass).every(passt), mass);
    pruefe('Form folgt dem Platz: 1180 px ganz („Level n“ mit Balken), 744 px schmal (nur die Zahl), zurück auf 1180 px wieder ganz',
      passt(breit) && !breit.schmal && breit.wort && mass[744].schmal && !mass[744].wort && passt(zurueck) && !zurueck.schmal && zurueck.wort,
    { breit, m744: mass[744], zurueck });
    pruefe('Größenwechsel: keine Konsolenfehler (keine ResizeObserver-Schleife)', f.length === 0, f.join(' | '));
    await k.close();
  }

  // ---------- 11. Handy und dunkel ----------
  gruppe = 'Handy und dunkel';
  for (const [name, o] of [['handy', { w: 390, h: 844, handy: true }], ['dunkel', { farbe: 'dark' }], ['handy-dunkel', { w: 390, h: 844, handy: true, farbe: 'dark' }]]) {
    const { kontext: k, seite: s, fehler: f } = await neueSeite(browser, o);
    const hh = hilfen(s);
    await s.goto(MIT() + '#arena');
    await s.waitForSelector('.screen.arena');
    await warte(700);
    await bild(s, `arena-${name}`);
    const ueber = await s.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    pruefe(`${name}: Arena ohne waagrechten Überlauf`, ueber <= 0, ueber);
    const chip = await s.evaluate(kopfChipMass);
    pruefe(`${name}: Level-Chip im Kopf ganz sichtbar, Tippfläche mindestens 44 x 44, so hoch wie der Sterne-Chip, eine Oberkante`,
      chip.rolle && chip.tipp.w >= 44 && chip.tipp.h >= 44 && Math.abs(chip.sicht.h - chip.sterne.h) <= 1 && chip.oben === 1 && chip.ganz, chip);
    await hh.schaefermatt();
    await hh.abrFertig();
    await warte(800);
    await bild(s, `ergebnis-${name}`);
    const lage = await s.evaluate(() => {
      const z = document.querySelector('.fk-abr').getBoundingClientRect();
      const k2 = document.querySelector('.ergebnis-karte').getBoundingClientRect();
      const w = document.querySelector('.fk-wert').getBoundingClientRect();
      return { innen: z.left >= k2.left - 1 && z.right <= k2.right + 1, wert: w.right <= z.right + 1, breite: z.width };
    });
    pruefe(`${name}: Abrechnungszeile passt in die Karte (Wert rechts sichtbar)`, lage.innen && lage.wert, lage);
    const kw = await kontrast(s, '.fk-wert', '.fk-abr');
    const kl = await kontrast(s, '.fk-unter', '.fk-abr');
    pruefe(`${name}: lesbar (Wert ${kw.toFixed(1)}:1, Unterzeile ${kl.toFixed(1)}:1, mindestens 4,5:1)`, kw >= 4.5 && kl >= 4.5);
    pruefe(`${name}: keine Konsolenfehler`, f.length === 0, f.join(' | '));
    await k.close();
  }
}

if (!NUR_NODE) {
  mkdirSync(BILDER, { recursive: true });
  const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: WURZEL, stdio: 'ignore' });
  let browser;
  try {
    await warteAufServer(BASIS);
    browser = await browserTyp(ladePlaywright()).launch();
    await testeBrowser(browser);
  } catch (e) {
    console.error(e);
    pruefe('Browser-Teil lief durch', false, String(e && e.stack || e));
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
  console.log('Bilder: ' + BILDER);
}

const fehlend = ergebnisse.filter((r) => !r.ok);
console.log(`\n${ergebnisse.length - fehlend.length}/${ergebnisse.length} bestanden`);
for (const f of fehlend) console.log('FEHLER: ' + f.name);
process.exit(fehlend.length ? 1 : 0);
