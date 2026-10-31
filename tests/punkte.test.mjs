// Tests fuer das Paket punkte (Punkte, Abrechnung und Bestenliste, SPIELKONZEPT 3.2, 3.10, 3.13, 3.17, 5.3).
// Node-Teil: Punkte-Formel gegen die Tabellen und Rechenbeispiele des Konzepts, Tafeln (Einfuegen, Verdraengen,
// Gleichstand, Fenster, Platz, Chronik, "so nah wie noch nie"), SA1-Codes (Pruefsumme, Tippfehler, Nachspielen, festes
// Beispiel), Speicher (Rechenstand, alte Spielstaende, Budget, Freunde), Verdrahtung ueber den Ereignis-Bus (Feier-Budget).
// Browser-Teil (Playwright, Chromium) gegen die echte App mit ?test&erw=pakete/punkte/index&reiter=bestenliste: Abrechnung
// nach einer Partie (erster Eintrag, Rekord als grosser Moment, Platz 1 mit Ueberholen, "so nah", Hilfe), "Punkte werden
// gezaehlt", Bestenliste mit Daten und leer, Reiter, Fenster, Zeile in die Analyse, Freunde-Code teilen und einlesen
// (nachgerechnet), Umzug vorhandener Analysen, Router ohne Paket, Bilder 1180 x 820 und 390 x 844 hell und dunkel.
//
//   node tests/punkte.test.mjs              alles
//   node tests/punkte.test.mjs --nur-node   ohne Browser
//   node tests/punkte.test.mjs --schnell    Bilder und Layout nur in 2 statt 5 Fenstern (1180 hell, 390 dunkel; alle --schnell)
//   PORT=9600 BILDER=/pfad node tests/punkte.test.mjs
//
// Playwright: PLAYWRIGHT_PFAD, sonst 'playwright', sonst /opt/node-tools/node_modules/playwright.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { mkdirSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { browserTyp } from './browser.mjs';
import { setzeSpeicher, MODUL_BUDGET, speicherePartie, ladeModul } from '../js/storage.js';
import { hoere, sende, EREIGNISSE } from '../js/ereignisse.js';
import { fuerOverlay, melde } from '../js/feier.js';
import { addiereTage, wochenSchluessel } from '../js/tag.js';
import { pruefeInhalt, RECHENSTAND } from '../js/inhalte.js';
import { BOTS, botNachId } from '../js/bots.js';
import * as F from '../js/pakete/punkte/formel.js';
import * as T from '../js/pakete/punkte/tafel.js';
import * as C from '../js/pakete/punkte/code.js';
import * as S from '../js/pakete/punkte/stand.js';
import * as A from '../js/pakete/punkte/ansicht.js';

const require = createRequire(import.meta.url);
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8868);
const NUR_NODE = process.argv.includes('--nur-node');
const SCHNELL = process.argv.includes('--schnell');
const bilderArg = process.argv.find((a) => a.startsWith('--bilder='));
const BILDER = bilderArg ? bilderArg.slice(9) : process.env.BILDER || path.join(os.tmpdir(), 'crownmate-punkte-bilder');

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
// n eigene Zuege einer Klasse (offen: Gewinnchance vorher 50 %)
const z = (klasse, n = 1, extra = {}) => Array.from({ length: n }, () => ({ klasse, gewinnVorher: 0.5, gewinnNachher: 0.5, ...extra }));
const ort = (j, mo, t, h = 12, mi = 0) => new Date(j, mo - 1, t, h, mi, 0, 0);

// =====================================================================
// Punkte-Formel (formel.js)
// =====================================================================
gruppe = 'Zugpunkte';
{
  const TABELLE = { brillant: 1200, stark: 800, bester: 500, exzellent: 400, gut: 300, ungenau: 100, fehler: 0, verpasst: 0, patzer: 0 };
  for (const [k, p] of Object.entries(TABELLE)) {
    const r = F.zugpunkte(z(k));
    pruefe(`${k}: ${p} Punkte je offenem Zug, belegt einen Platz`, r.zugpunkte === p && r.offen === 1, r);
  }
  pruefe('Rechenstand 1 in Formel, Tafel und Speicher', F.STAND === 1 && T.STAND === 1 && S.STAND === 1);
  const grenzen = [[0.0999, 0], [0.1, 1], [0.5, 1], [0.9, 1], [0.9001, 0], [0, 0], [1, 0]]
    .map(([g, offen]) => F.zugpunkte(z('bester', 1, { gewinnVorher: g })).offen === offen);
  pruefe('Offen nur zwischen 10 % und 90 % (Grenzen eingeschlossen), außerhalb 0 und kein Platz', grenzen.every(Boolean), grenzen);
  const theorie = F.zugpunkte(z('buch', 10));
  pruefe('Theorie je 100, höchstens 8 (10 Theorie-Züge = 800), zählen immer und belegen keinen Platz', theorie.theorie === 800 && theorie.offen === 0
    && F.zugpunkte(z('buch', 3, { gewinnVorher: 0.99 })).theorie === 300);
  const deckel = F.zugpunkte(z('brillant', 100, { trivial: false }).map((x, i) => ({ ...x, klasse: i % 2 ? 'brillant' : 'gut' })));
  pruefe('Deckel: höchstens 40 offene Züge', deckel.offen === 40 && deckel.deckel === 60 && deckel.zugpunkte === 20 * 1200 + 20 * 300, deckel);
  const ohne = F.zugpunkte([...z('erzwungen'), ...z('bester', 1, { trivial: true }), ...z('stark', 1, { nachHilfe: true }), { klasse: 'bester', gewinnVorher: null }, { klasse: null }]);
  pruefe('Pflichtzug, trivialer Zug, Zug nach Hilfe und Zug ohne Bewertung: 0 Punkte, kein Platz', ohne.zugpunkte === 0 && ohne.offen === 0
    && ohne.ohnePlatz === 3 && ohne.unbekannt === 2, ohne);
  const falsch = F.zugpunkte([...z('fehler'), ...z('verpasst'), ...z('patzer')]);
  pruefe('Daneben, Verschenkt, Weit daneben: 0 Punkte, aber ein Platz (nie Abzug)', falsch.zugpunkte === 0 && falsch.offen === 3 && !falsch.fehlerfrei);
}

gruppe = 'Ergebnis, Verwertung, Kür';
{
  const e = (ergebnis, n) => F.ergebnisPunkte({ ergebnis, eigeneZuege: n });
  pruefe('Ergebnis: Sieg 4.000, Remis 2.500, Niederlage ab 15 Zügen 1.000 (Kampfgeist)', e('sieg', 30) === 4000 && e('remis', 30) === 2500
    && e('niederlage', 15) === 1000 && e('niederlage', 14) === 0);
  pruefe('Ende vor dem 10. eigenen Zug: 0', e('sieg', 9) === 0 && e('remis', 9) === 0 && e('sieg', 10) === 4000);
  const ab = (n, extra = {}) => [...z('bester', 5), { klasse: 'bester', gewinnVorher: 0.6, gewinnNachher: 0.95, ...extra }, ...z('gut', n, { gewinnVorher: 0.97, gewinnNachher: 0.97 })];
  pruefe('Verwertung: Par = Mattdistanz + 3, innerhalb von Par volle 3.000', F.verwertung({ ergebnis: 'sieg', zuege: ab(8, { matt: 5 }) }).punkte === 3000
    && F.verwertung({ ergebnis: 'sieg', zuege: ab(8, { matt: 5 }) }).par === 8);
  pruefe('Verwertung: je Zug über Par 100 weniger (Par 8, 12 Züge: 2.600)', F.verwertung({ ergebnis: 'sieg', zuege: ab(12, { matt: 5 }) }).punkte === 2600);
  pruefe('Verwertung: ohne Matt Par 30 (35 Züge danach: 2.500), nie unter 0 (90 Züge: 0)', F.verwertung({ ergebnis: 'sieg', zuege: ab(35) }).punkte === 2500
    && F.verwertung({ ergebnis: 'sieg', zuege: ab(90) }).punkte === 0);
  pruefe('Verwertung nur bei Sieg; ohne jede Bewertung 0; nie über 90 % (Matt aus offener Stellung) volle 3.000',
    F.verwertung({ ergebnis: 'remis', zuege: ab(1) }).punkte === 0 && F.verwertung({ ergebnis: 'sieg', zuege: [{ klasse: 'bester' }] }).punkte === 0
    && F.verwertung({ ergebnis: 'sieg', zuege: z('bester', 6) }).punkte === 3000);
  const combo = (n) => F.zugpunkte(z('bester', n)).combo;
  pruefe('COMBO: ab ×3 +50 %, ab ×5 +100 %, ab ×8 +150 %, ab ×12 +200 % der Zugpunkte (6 × Präzise: 1.500)',
    combo(2) === 0 && combo(3) === 250 && combo(5) === 250 + 250 + 500 && combo(6) === 1500 && combo(8) === 250 * 2 + 500 * 3 + 750
    && combo(12) === 250 * 2 + 500 * 3 + 750 * 4 + 1000, [combo(3), combo(5), combo(6), combo(8), combo(12)]);
  const neutral = F.zugpunkte([...z('bester', 2), ...z('buch'), ...z('erzwungen'), ...z('gut', 1, { trivial: true }), ...z('bester')]);
  const bricht = F.zugpunkte([...z('bester', 2), ...z('ungenau', 1, { trivial: true }), ...z('bester')]);
  const sauber = F.zugpunkte([...z('bester', 2), ...z('exzellent'), ...z('bester')]);
  pruefe('COMBO wie in der Partie: Theorie, Pflichtzug und trivialer Zug ohne Verlust neutral; trivialer Zug mit Verlust und „Sauber“ brechen',
    neutral.combo === 250 && neutral.maxSerie === 3 && bricht.combo === 0 && sauber.combo === 0, { neutral, bricht, sauber });
  pruefe('COMBO nur auf offene Züge (entschieden: kein Zuschlag)', F.zugpunkte(z('bester', 6, { gewinnVorher: 0.95 })).combo === 0);
  const weste = (zuege, ergebnis = 'sieg') => F.tafelwert({ zuege, ergebnis, eigeneZuege: zuege.length }).weste;
  pruefe('Weiße Weste: Sieg ohne Daneben, Verschenkt, Weit daneben ab 20 offenen Zügen +2.000', weste(z('gut', 20)) === 2000 && weste(z('gut', 19)) === 0
    && weste([...z('gut', 20), ...z('fehler')]) === 0 && weste([...z('gut', 20), ...z('patzer', 1, { gewinnVorher: 0.99 })]) === 0
    && weste(z('gut', 20), 'remis') === 0 && weste([...z('gut', 20), ...z('ungenau')]) === 2000);
  pruefe('Uhr-Bonus (Uhr-Tafeln, S2): 1.000 × verbliebener Anteil, nur bei Sieg', F.uhrBonus({ ergebnis: 'sieg', anteil: 0.375 }) === 375
    && F.uhrBonus({ ergebnis: 'sieg', anteil: 2 }) === 1000 && F.uhrBonus({ ergebnis: 'remis', anteil: 0.5 }) === 0 && F.uhrBonus({ ergebnis: 'sieg' }) === 0);
  pruefe('Leistungspunkte (nur intern, Phase 2): Tafelwert × (0,5 + Stärke / 2.000)', F.leistungspunkte(20000, 1200) === 22000 && F.leistungspunkte(10000, 0) === 5000);
  const hilfe = F.tafelwert({ zuege: z('bester', 12), ergebnis: 'sieg', eigeneZuege: 12, hilfe: true });
  pruefe('Mit Hilfe: Punkte gibt es trotzdem, aber keinen Tafeleintrag (tafel: false)', hilfe.wert > 0 && hilfe.tafel === false && hilfe.hilfe === true);
}

gruppe = 'Rechenbeispiele aus 3.2 und 3.13';
{
  // 1. Tapfere Niederlage gegen Ritter Thorsten: 4 Theorie, offen 1 Goldrichtig, 6 Praezise, 8 Sauber, 6 Solide, 2 Unscharf, 1 Daneben,
  // 1 Weit daneben (25 Plaetze), 3 trivial (kein Platz), ab Zug 33 verloren (6 Zuege entschieden). Punkte 9.000 + 400 + 1.000 = 10.400
  // (ohne COMBO-Serie: hoechstens zwei Praezise hintereinander)
  const b1 = [...z('buch', 4), ...z('stark'), ...z('exzellent'), ...z('bester', 2), ...z('gut'), ...z('bester', 2), ...z('exzellent'), ...z('bester', 2),
    ...z('exzellent', 6), ...z('gut', 5), ...z('ungenau', 2), ...z('fehler'), ...z('patzer'), ...z('gut', 3, { trivial: true }), ...z('gut', 6, { gewinnVorher: 0.04 })];
  const r1 = F.tafelwert({ zuege: b1, ergebnis: 'niederlage', eigeneZuege: 38 });
  pruefe('Beispiel 1: tapfere Niederlage gegen Thorsten = 10.400 Punkte (Zugpunkte 9.000, Theorie 400, Kampfgeist 1.000)', b1.length === 38 && r1.wert === 10400
    && r1.zugpunkte === 9000 && r1.theorie === 400 && r1.ergebnis === 1000 && r1.offen === 25 && r1.ohnePlatz === 3 && r1.entschieden === 6 && r1.combo === 0, r1);
  // 3. Sieg gegen Thorsten: Zugwerte und Theorie 9.500 (95 Funken), Sieg 4.000, Verwertung 3.000, COMBO-Zuschlag 1.500 = 18.000.
  // 5 Theorie (500), 6 Praezise in Folge (3.000, Zuschlag 250 + 250 + 500 + 500 = 1.500), dann 6 Sauber, 6 Solide, 2 Unscharf,
  // 4 Sauber (6.000), ein Daneben (0, keine Weisse Weste), ab 90 % zuegig verwertet (5 Zuege, Par 30)
  const b3 = [...z('buch', 5), ...z('bester', 6), ...z('exzellent', 6), ...z('gut', 6), ...z('ungenau', 2), ...z('fehler'), ...z('exzellent', 3),
    { klasse: 'exzellent', gewinnVorher: 0.7, gewinnNachher: 0.93, matt: null }, ...z('gut', 5, { gewinnVorher: 0.96, gewinnNachher: 0.97 })];
  const r3 = F.tafelwert({ zuege: b3, ergebnis: 'sieg', eigeneZuege: b3.length });
  pruefe('Beispiel 3: Sieg gegen Thorsten mit COMBO-Zuschlag 1.500 = 18.000 Punkte', r3.zugpunkte + r3.theorie === 9500 && r3.combo === 1500
    && r3.ergebnis === 4000 && r3.verwertung === 3000 && r3.weste === 0 && r3.wert === 18000 && r3.maxSerie === 6, r3);
  // 4. Schutz gegen Schleppen (3.2 und 3.13): 120 Zuege gegen Lukas bis zum Matt 6.400, zuegig verwertet 9.400
  // 3 Theorie (300) und 2.100 Zugpunkte bis zum ersten Erreichen von 90 % (Zug 9), danach entschieden (0 Punkte)
  const offen = [...z('buch', 3), ...z('exzellent', 3), ...z('gut', 2), { klasse: 'gut', gewinnVorher: 0.6, gewinnNachher: 0.95, matt: null }];
  const schleppen = [...offen, ...z('gut', 111, { gewinnVorher: 0.97, gewinnNachher: 0.97 })];
  const zuegig = [...offen, ...z('gut', 25, { gewinnVorher: 0.97, gewinnNachher: 0.97 })];
  const s4 = F.tafelwert({ zuege: schleppen, ergebnis: 'sieg', eigeneZuege: schleppen.length });
  const z4 = F.tafelwert({ zuege: zuegig, ergebnis: 'sieg', eigeneZuege: zuegig.length });
  pruefe('Beispiel 4: 120 Züge Schleppen gegen Lukas 6.400, dieselbe Partie zügig verwertet 9.400', schleppen.length === 120 && s4.wert === 6400 && z4.wert === 9400
    && s4.verwertung === 0 && z4.verwertung === 3000, [s4.wert, z4.wert]);
  // 3.13: tapfere Niederlage gegen Dame Delia mit 40 offenen Zuegen ca. 14.900 (8 Theorie 800, 13.100 Zugpunkte, Kampfgeist 1.000)
  const delia = [...z('buch', 8), ...z('stark'), ...z('exzellent', 5), ...z('stark'), ...z('exzellent', 5), ...z('gut', 25), ...z('fehler', 3),
    ...z('gut', 4, { gewinnVorher: 0.02 })];
  const rd = F.tafelwert({ zuege: delia, ergebnis: 'niederlage', eigeneZuege: delia.length });
  pruefe('3.13: tapfere Niederlage gegen Delia mit 40 offenen Zügen 14.900 (Fortschritt auch nach einer Niederlage)', rd.offen === 40 && rd.wert === 14900
    && rd.theorie === 800 && rd.ergebnis === 1000, rd);
  // 3.13: Sieg gegen Thorsten in 34 Zuegen, Matt nach Par 8 in 4 Zuegen ca. 20.100: 4 Theorie (400), 26 offene Zuege (11.200, darunter
  // ein Daneben, also keine Weisse Weste), 6 Praezise in Folge (COMBO 1.500), ab 90 % Matt in 5 (Par 8), danach 4 Zuege
  const rudi34 = [...z('buch', 4), ...z('bester', 6), ...z('exzellent', 8), ...z('gut', 2), ...z('stark'), ...z('gut', 2), ...z('fehler'), ...z('brillant'),
    ...z('gut'), ...z('stark'), ...z('ungenau', 2), { klasse: 'bester', gewinnVorher: 0.8, gewinnNachher: 0.98, matt: 5 },
    ...z('bester', 4, { gewinnVorher: 0.99, gewinnNachher: 1 })];
  const r34 = F.tafelwert({ zuege: rudi34, ergebnis: 'sieg', eigeneZuege: rudi34.length });
  pruefe('3.13: Sieg gegen Thorsten in 34 Zügen mit Matt nach Par 8 in 4 Zügen 20.100 (volle Verwertung, COMBO 1.500, keine Weiße Weste)',
    rudi34.length === 34 && r34.par === 8 && r34.verwertung === 3000 && r34.combo === 1500 && r34.weste === 0 && r34.offen === 26 && r34.wert === 20100, r34);
  // 3.13: Sieg mit Matt nach Par 8 in 4 Zuegen bekommt die volle Verwertung
  const par8 = [...z('bester', 1), { klasse: 'bester', gewinnVorher: 0.7, gewinnNachher: 0.99, matt: 5 }, ...z('bester', 4, { gewinnVorher: 0.99, gewinnNachher: 1 })];
  const v8 = F.verwertung({ ergebnis: 'sieg', zuege: par8 });
  pruefe('3.13: Matt nach Par 8 in 4 Zügen: volle Verwertung 3.000', v8.par === 8 && v8.punkte === 3000, v8);
}

gruppe = 'Eigene Züge aus der Spielanalyse';
{
  const review = { zuege: [
    { ply: 0, farbe: 'w', klasse: 'buch', gewinnVorher: 0.5, gewinnNachher: 0.5 },
    { ply: 1, farbe: 'b', klasse: 'bester', gewinnVorher: 0.5, gewinnNachher: 0.5 },
    { ply: 2, farbe: 'w', klasse: 'stark', gewinnVorher: 0.55, gewinnNachher: 0.95, evalNachher: { mate: 3 } },
    { ply: 3, farbe: 'b', klasse: 'patzer', gewinnVorher: 0.05, gewinnNachher: 0.0, evalNachher: { mate: 2 } },
    { ply: 4, farbe: 'w', klasse: 'bester', gewinnVorher: 1, gewinnNachher: 1, trivial: true, evalNachher: { mate: -1 } },
  ] };
  const w = F.zuegeAusReview(review, 'w', { nachHilfe: [2] });
  const b = F.zuegeAusReview(review, 'b');
  pruefe('zuegeAusReview: nur die eigene Farbe, Ply, Klasse, Gewinnchancen, trivial, nach Hilfe', w.length === 3 && w.map((x) => x.ply).join() === '0,2,4'
    && w[1].nachHilfe === true && w[0].nachHilfe === false && w[2].trivial === true && b.length === 2 && b[0].klasse === 'bester', w);
  pruefe('zuegeAusReview: Mattdistanz aus evalNachher (Sicht Weiß) in eigene Züge umgerechnet, nur wenn man selbst mattsetzt',
    w[1].matt === 3 && w[2].matt === null && b[1].matt === null && F.zuegeAusReview({ zuege: [{ ply: 1, farbe: 'b', klasse: 'bester', evalNachher: { mate: -4 } }] }, 'b')[0].matt === 4);
}

// =====================================================================
// Tafeln (tafel.js)
// =====================================================================
const jetzt = ort(2026, 10, 22, 20);   // Donnerstag, Woche ab Montag 19.10.
const E = (id, w, t = jetzt, extra = {}) => ({ id, w, t: t instanceof Date ? t.getTime() : t, f: 'w', z: 30, e: 's', g: 80, ...extra });
const G = (id, w, name = 'Jule') => ({ id, w, name, art: 'freund', t: 0, pruef: 'nachgerechnet' });

gruppe = 'Tafel: Einfügen, Verdrängen, Gleichstand';
{
  pruefe('tafelId: je Bot und je Boss und Stufe, sonst null', T.tafelId({ botId: 'rudi' }) === 'bot:rudi'
    && T.tafelId({ botId: 'baron-gambit', boss: { id: 'baron-gambit', stufe: 'meister' } }) === 'boss:baron-gambit:meister'
    && T.tafelId({ botId: 'Thorsten!' }) === null && T.tafelId({ boss: { id: 'x', stufe: 'gold' } }) === null
    && JSON.stringify(T.zerlegeId('boss:baron-gambit:standard')) === '{"art":"boss","botId":"baron-gambit","stufe":"standard"}');
  let t = T.neueTafel('bot:rudi');
  let r = T.eintragen(t, E('a', 12000, ort(2026, 10, 20)), { jetzt });
  pruefe('Erster Eintrag: erster, Platz 1, kein Rekord, kein Platz-1-Moment (allein auf der Tafel)', r.ergebnis.erster && r.ergebnis.platz === 1
    && !r.ergebnis.rekord && !r.ergebnis.platz1 && r.ergebnis.vorher === null && r.ergebnis.bestwert === 12000, r.ergebnis);
  t = r.tafel;
  pruefe('Dieselbe Partie zweimal: kein zweiter Eintrag (null)', T.eintragen(t, E('a', 12000), { jetzt }) === null);
  r = T.eintragen(t, E('b', 12000, ort(2026, 10, 21)), { jetzt });
  pruefe('Gleichstand: der frühere Eintrag steht vorn, gleich gut ist kein Rekord', !r.ergebnis.rekord && r.ergebnis.platz === 2
    && r.tafel.eintraege.map((x) => x.id).join() === 'a,b', r.ergebnis);
  t = r.tafel;
  r = T.eintragen(t, E('c', 15000), { jetzt });
  pruefe('Neuer Bestwert: Rekord mit altem Wert (vorher), Platz 1, Aufstieg 0 ohne Gäste', r.ergebnis.rekord && r.ergebnis.vorher === 12000
    && r.ergebnis.platz === 1 && r.ergebnis.aufstieg === 0 && !r.ergebnis.platz1, r.ergebnis);
  t = r.tafel;
  r = T.eintragen(t, E('d', 9000), { jetzt });
  pruefe('Schwächer als die drei eigenen Besten: nicht sichtbar (Platz null), Wochenplatz nur unter den drei Wochenbesten', r.ergebnis.platz === null
    && !r.ergebnis.sichtbar && r.ergebnis.wochenPlatz === null, r.ergebnis);
  t = r.tafel;
  const zeilen = T.zeilen(t, { fenster: 'allzeit', jetzt });
  pruefe('zeilen: höchstens 3 eigene, nach Wert sortiert, Platz fortlaufend', zeilen.length === 3 && zeilen.map((x) => x.id).join() === 'c,a,b'
    && zeilen.map((x) => x.platz).join() === '1,2,3' && zeilen.every((x) => x.eigen));
  const gaeste = Array.from({ length: 12 }, (_, i) => G('g' + i, 20000 + i * 100, 'Gast ' + i));
  const mitGaesten = T.zeilen(t, { fenster: 'allzeit', jetzt, gaeste });
  pruefe('10 Zeilen; dein Bestwert steht immer da, auch unter Platz 10 (hier Platz 13)', mitGaesten.length === 11 && mitGaesten.slice(0, 10).every((x) => !x.eigen)
    && mitGaesten[10].eigen && mitGaesten[10].platz === 13 && mitGaesten[10].id === 'c', mitGaesten.map((x) => x.platz + (x.eigen ? '*' : '')).join());
}

gruppe = 'Tafel: Platz, Überholen, Platz 1';
{
  let t = T.neueTafel('bot:rudi');
  const gaeste = [G('j', 21800, 'Jule'), G('k', 16000, 'Kim'), G('m', 9000, 'Mo')];
  let r = T.eintragen(t, E('a', 12000), { jetzt, gaeste });
  pruefe('Erster Eintrag mitten zwischen Gästen: Platz 3, niemand überholt', r.ergebnis.platz === 3 && r.ergebnis.ueberholt.length === 0 && !r.ergebnis.platz1);
  t = r.tafel;
  r = T.eintragen(t, E('b', 17000), { jetzt, gaeste });
  pruefe('Rekord mit Überholen: Platz 2 ▲ 1 (vorher Platz 3), überholt Kim', r.ergebnis.rekord && r.ergebnis.platz === 2 && r.ergebnis.platzVorher === 3
    && r.ergebnis.aufstieg === 1 && r.ergebnis.ueberholt.map((x) => x.name).join() === 'Kim' && !r.ergebnis.platz1, r.ergebnis);
  t = r.tafel;
  r = T.eintragen(t, E('c', 23100), { jetzt, gaeste });
  pruefe('Platz 1 mit Überholen: platz1 (großer Moment), ▲ 1, überholt Jule', r.ergebnis.platz1 && r.ergebnis.platz === 1 && r.ergebnis.aufstieg === 1
    && r.ergebnis.ueberholt.map((x) => x.name).join() === 'Jule', r.ergebnis);
  t = r.tafel;
  r = T.eintragen(t, E('d', 24000), { jetzt, gaeste });
  pruefe('Schon Platz 1 und noch besser: Rekord, aber kein zweiter Platz-1-Moment', r.ergebnis.rekord && r.ergebnis.platz === 1 && !r.ergebnis.platz1);
  const ersterVorne = T.eintragen(T.neueTafel('bot:greta'), E('x', 30000), { jetzt, gaeste });
  pruefe('Erster Eintrag vor allen Gästen: Platz 1 als Moment', ersterVorne.ergebnis.platz1 && ersterVorne.ergebnis.erster);
}

gruppe = 'Tafel: Fenster Woche, Monat, Allzeit';
{
  let t = T.neueTafel('bot:lisa');
  for (const [id, w, d] of [['alt', 20000, ort(2026, 8, 3)], ['monat', 15000, ort(2026, 10, 2)], ['vorwoche', 16000, ort(2026, 10, 18, 22)],
    ['montag-frueh', 14000, ort(2026, 10, 19, 3, 59)], ['woche', 11000, ort(2026, 10, 19, 4, 0)]]) {
    t = T.eintragen(t, E(id, w, d), { jetzt }).tafel;
  }
  const ids = (f) => T.eigene(t, f, jetzt).map((x) => x.id).join();
  pruefe('Woche ab Montag 4:00 (3:59 gehört noch zur Vorwoche)', ids('woche') === 'woche', ids('woche'));
  pruefe('Monat (Tagesgrenze 4:00) und Allzeit', ids('monat') === 'vorwoche,monat,montag-frueh,woche' && ids('allzeit').startsWith('alt,vorwoche,monat'), [ids('monat'), ids('allzeit')]);
  const r = T.eintragen(t, E('neu', 12000), { jetzt });
  pruefe('Wochenbestwert ist erreichbar, auch wenn der Allzeit-Rekord hart ist (Woche: Platz 1, Allzeit: nicht sichtbar)', r.ergebnis.wochenPlatz === 1
    && r.ergebnis.platz === null && r.ergebnis.wochenBest && !r.ergebnis.rekord, r.ergebnis);
  const zw = T.zeilen(r.tafel, { fenster: 'woche', jetzt });
  pruefe('zeilen im Fenster Woche: nur Einträge dieser Woche', zw.map((x) => x.id).join() === 'neu,woche');
  const d = T.duenneAus(JSON.parse(JSON.stringify(r.tafel)), jetzt);
  pruefe('Ausdünnen: behält Allzeit-Beste, Monats- und Wochenbeste (je 3), sonst nichts', d.eintraege.map((x) => x.id).sort().join() === 'alt,monat,montag-frueh,neu,vorwoche,woche'
    && !T.duenneAus(JSON.parse(JSON.stringify(T.eintragen(r.tafel, E('schwach', 500, ort(2026, 9, 1)), { jetzt }).tafel)), jetzt).eintraege.some((x) => x.id === 'schwach')
    , d.eintraege.map((x) => x.id).join());
  pruefe('Chronik: je Woche und Monat der beste Wert, neueste zuerst, höchstens 12 Säulen', r.tafel.chronik.w[0][0] === '2026-10-19' && r.tafel.chronik.w[0][1] === 12000
    && r.tafel.chronik.w.find(([k]) => k === '2026-10-12')[1] === 16000 && r.tafel.chronik.m.find(([k]) => k === '2026-10')[1] === 16000, r.tafel.chronik);
  let c = T.neueTafel('bot:benno');
  for (let i = 0; i < 20; i++) c = T.eintragen(c, E('w' + i, 1000 + i, ort(2026, 3, 2 + i * 7)), { jetzt }).tafel;
  pruefe('Chronik bleibt bei 12 Säulen (neueste Wochen)', c.chronik.w.length === 12 && c.chronik.w[0][1] === 1019);
  // drei starke Partien im August, eine schwache in dieser Woche: die bleibt (Wochenbeste), verliert aber ihren Nachweis
  const alteN = [2, 3, 4].map((i) => ({ ...E('n' + i, 1000 * i), tag: '2026-08-05', wo: '2026-08-03', mo: '2026-08', n: 'ABCDEFGH' + i }));
  const mitN = T.duenneAus({ ...T.neueTafel('bot:kalle'), eintraege: [...alteN, { ...E('n1', 1000), tag: '2026-10-22', wo: '2026-10-19', mo: '2026-10', n: 'ABCDEFGH1' }] }, jetzt);
  pruefe('Nachweis nur an den drei Allzeit-Besten (die Wochenbeste bleibt, ohne Nachweis)', mitN.eintraege.filter((x) => x.n).map((x) => x.id).join() === 'n4,n3,n2'
    && !!mitN.eintraege.find((x) => x.id === 'n1') && !mitN.eintraege.find((x) => x.id === 'n1').n, mitN.eintraege);
}

gruppe = 'Tafel: so nah wie noch nie';
{
  const t = T.neueTafel('bot:rudi');
  const f1 = T.fast(t, { w: 22000 }, { vorher: 23000, jetzt });
  pruefe('97 % des Rekords: „So nah wie noch nie“ mit abgerundeter Prozentzahl', f1 && f1.prozent === 95 && t.nah > 0.95, f1);
  pruefe('höchstens einmal je Tafel und Woche', T.fast(t, { w: 22900 }, { vorher: 23000, jetzt }) === null);
  const naechste = new Date(jetzt.getTime() + 7 * 86400000);
  pruefe('nächste Woche nur, wenn näher als je zuvor', T.fast(t, { w: 21000 }, { vorher: 23000, jetzt: naechste }) === null
    && T.fast(t, { w: 22900 }, { vorher: 23000, jetzt: naechste }).prozent === 99);
  pruefe('unter 90 %, als Rekord oder ohne Rekord: nichts', T.fast(T.neueTafel('x'), { w: 20000 }, { vorher: 23000, jetzt }) === null
    && T.fast(T.neueTafel('x'), { w: 24000 }, { vorher: 23000, jetzt }) === null && T.fast(T.neueTafel('x'), { w: 24000 }, { vorher: null, jetzt }) === null);
  const kaputt = T.pruefeTafel({ eintraege: [{ id: 'a', w: 'x', t: 1 }, { id: 'b', w: 500, t: 5 }, { id: 'b', w: 600, t: 6 }, null, { id: 'c', w: -3, t: 1 }],
    chronik: { w: [['2026-10-19', 500], ['kaputt', 1]], m: 'nein' }, nah: 7 }, 'bot:rudi');
  pruefe('pruefeTafel: kaputte Einträge und Felder fallen weg (alte Spielstände laden)', kaputt.eintraege.length === 1 && kaputt.eintraege[0].w === 500
    && kaputt.chronik.w.length === 1 && kaputt.chronik.m.length === 0 && kaputt.nah === null, kaputt);
}

gruppe = 'Tafel: so nah erst beim Zeigen';
{
  // Pruefer-Befund: der Moment wurde in bewerte() verbraucht, auch wenn die Abrechnung "Platz 2" zeigte; jetzt pruefen
  // und festschreiben getrennt (festgeschrieben wird beim Zeigen)
  const t = T.neueTafel('bot:rudi');
  const k = T.fastPruefen(t, { w: 22000 }, { vorher: 23000, jetzt });
  pruefe('fastPruefen: Kandidat mit Prozent, Anteil und Woche, die Tafel bleibt unverändert', k && k.prozent === 95 && k.wo === wochenSchluessel(jetzt)
    && Math.abs(k.anteil - 22000 / 23000) < 1e-9 && t.nah === null && t.fast === null, { k, t });
  pruefe('merkeFast: schreibt den Moment fest (Anteil, Woche, Partie)', T.merkeFast(t, k, { id: 'p1' }) && t.fast.wo === k.wo && t.fast.id === 'p1' && t.nah === k.anteil, t);
  pruefe('merkeFast: dieselbe Partie noch einmal ja (der Nachtrag baut die Zeile neu), eine andere in derselben Woche nein',
    T.merkeFast(t, k, { id: 'p1' }) && !T.merkeFast(t, { ...k }, { id: 'p2' }) && T.fastPruefen(t, { w: 22900 }, { vorher: 23000, jetzt }) === null);
  const geladen = T.pruefeTafel(JSON.parse(JSON.stringify(t)), 'bot:rudi');
  pruefe('pruefeTafel: Woche und Partie des Moments bleiben gespeichert', geladen.fast.id === 'p1' && geladen.fast.wo === k.wo && geladen.nah === t.nah);
}

// =====================================================================
// SA1-Codes (code.js)
// =====================================================================
const SCHAEFER = ['e2e4', 'e7e5', 'f1c4', 'b8c6', 'd1h5', 'g8f6', 'h5f7'];
gruppe = 'SA1-Code';
{
  const bytes = Uint8Array.from([0, 1, 2, 250, 255, 128, 64, 7]);
  pruefe('Crockford-Base32 hin und zurück, Alphabet ohne I, L, O, U', JSON.stringify([...C.ausBase32(C.base32(bytes))]) === JSON.stringify([...bytes])
    && !/[ILOU]/.test(C.ALPHABET) && C.ALPHABET.length === 32);
  pruefe('CRC-16/CCITT (Prüfwert "123456789" = 0x29B1)', C.crc16([...'123456789'].map((c) => c.charCodeAt(0))) === 0x29b1);
  const r = C.erzeugeCode({ botId: 'rudi', farbe: 'w', ergebnis: 'sieg', seed: 123456, tag: '2026-10-23', tiefe: 14, zuege: SCHAEFER, name: 'Jule' });
  // festes Beispiel: aendert sich das Format, muss VERSION hoch (alte Codes bleiben lesbar oder werden ehrlich abgelehnt)
  const BEISPIEL = 'SA1-040G-2000-07H4-02DQ-1R27-4XB4-D400-012A-ENP6-A007-1C51-218K-34HV-02G';
  pruefe('Festes Beispiel (Thorsten, Weiß, Sieg, Seed 123456, 23.10.2026, Tiefe 14, „Jule“, Schäfermatt)', r.ok && r.code === BEISPIEL, r.code);
  const l = C.leseCode(BEISPIEL);
  pruefe('leseCode: alles, was im Code steht', l.ok && l.daten.version === 1 && l.daten.stand === 1 && l.daten.art === 'partie' && l.daten.botId === 'rudi'
    && l.daten.farbe === 'w' && l.daten.ergebnis === 'sieg' && l.daten.seed === 123456 && l.daten.tag === '2026-10-23' && l.daten.tiefe === 14
    && l.daten.name === 'Jule' && l.daten.indizes.length === 7 && l.daten.stufe === null && l.daten.staerke === null, l);
  const n = C.zuegeAusIndizes(l.daten.indizes);
  pruefe('Nachspielen: dieselben Züge, Matt erkannt', n.ok && n.uci.join() === SCHAEFER.join() && n.matt && n.san[6] === 'Qxf7#', n);
  pruefe('Eingabe ohne Groß- und Kleinschreibung, ohne Striche, mit Leerzeichen, O als 0 und I/L als 1',
    C.leseCode(BEISPIEL.toLowerCase()).ok && C.leseCode(BEISPIEL.replace(/-/g, ' ')).ok && C.leseCode(BEISPIEL.replace(/0/g, 'O')).ok
    && C.leseCode(BEISPIEL.replace(/1/g, 'l')).ok && C.leseCode(BEISPIEL.slice(4)).ok);
  // jeder einzelne Tippfehler faellt auf (CRC-16 erkennt jeden Fehler in einem Zeichen)
  const roh = C.normalisiere(BEISPIEL);
  let erkannt = 0;
  let faelle = 0;
  for (let i = 0; i < roh.length; i++) {
    for (const c of ['0', 'Z', 'K']) {
      if (roh[i] === c) continue;
      faelle++;
      const kaputt = C.leseCode(roh.slice(0, i) + c + roh.slice(i + 1));
      if (!kaputt.ok) erkannt++;
    }
  }
  pruefe(`Jeder Tippfehler in einem Zeichen fällt auf (${faelle} Fälle)`, erkannt === faelle, `${erkannt}/${faelle}`);
  const tipp = C.leseCode(roh.slice(0, 10) + (roh[10] === 'A' ? 'B' : 'A') + roh.slice(11));
  pruefe('Tippfehler: ehrlicher Satz zur Prüfsumme', !tipp.ok && tipp.grund === 'pruefsumme' && /Prüfzeichen passt nicht/.test(tipp.text), tipp);
  pruefe('Abgeschnitten, leer, fremde Zeichen: abgelehnt', !C.leseCode(BEISPIEL.slice(0, 30)).ok && C.leseCode('').grund === 'leer'
    && C.leseCode('SA1-UUUU').grund === 'zeichen');
  const v2 = [...C.ausBase32(roh)];
  v2[0] = 2;
  const inhalt = v2.slice(0, -2);
  const p2 = C.crc16(inhalt);
  pruefe('Neuere Version: „Bitte die App aktualisieren“', C.leseCode(C.base32([...inhalt, p2 >> 8, p2 & 255])).grund === 'version');
  const boss = C.erzeugeCode({ art: 'boss', botId: 'baron-gambit', farbe: 'b', stufe: 'meister', ergebnis: 'remis', seed: 4294967295, tag: '2027-01-14',
    staerke: 1230, name: 'Ärger Ötzi', zuege: ['e2e4', 'e7e5'] });
  const lb = C.leseCode(boss.code);
  pruefe('Boss-Code: Stufe, Stärke, Schwarz, Remis, größter Seed, Umlaute im Namen', boss.ok && lb.ok && lb.daten.art === 'boss' && lb.daten.stufe === 'meister'
    && lb.daten.staerke === 1230 && lb.daten.farbe === 'b' && lb.daten.ergebnis === 'remis' && lb.daten.seed === 4294967295 && lb.daten.name === 'Ärger Ötzi', lb);
  pruefe('Erzeugen lehnt Unsinn ab (Name über 12 Zeichen, unerlaubter Zug, kaputtes Datum, Boss ohne Stufe)',
    !C.erzeugeCode({ botId: 'rudi', tag: '2026-10-23', name: 'Dreizehn Zeich', zuege: [] }).ok && C.erzeugeCode({ botId: 'rudi', tag: '2026-10-23', zuege: ['e2e5'] }).grund === 'zug'
    && C.erzeugeCode({ botId: 'rudi', tag: '2026-13-01', zuege: [] }).grund === 'datum' && C.erzeugeCode({ art: 'boss', botId: 'x', tag: '2026-10-23', zuege: [] }).grund === 'stufe');
  // eine Partie mit 80 Halbzuegen (Springer hin und her)
  const hin = ['g1f3', 'g8f6', 'f3g1', 'f6g8'];
  const lang = Array.from({ length: 80 }, (_, i) => hin[i % 4]);
  const rl = C.erzeugeCode({ botId: 'kalle', tag: '2026-10-23', zuege: lang, ergebnis: 'remis' });
  pruefe('Länge: 80 Halbzüge ergeben rund 170 Code-Zeichen ohne Striche (ein Byte je Halbzug)', rl.ok && rl.roh.length > 150 && rl.roh.length < 180
    && rl.zeichen === 4 + rl.roh.length + Math.ceil(rl.roh.length / 4) - 1
    && C.zuegeAusIndizes(C.leseCode(rl.code).daten.indizes).uci.join() === lang.join(), rl.zeichen);
  pruefe('Nachspielen lehnt einen Index außerhalb der erlaubten Züge ab', C.zuegeAusIndizes([11, 200]).ok === false);
}

gruppe = 'SA1-Code: Ergebnis gegen die Schlussstellung';
{
  // Pruefer-Befund: "Nachgerechnet" glaubte dem Ergebnis im Code (ein Sieg bringt 4.000 Punkte und die Verwertung)
  const nach = (uci) => C.zuegeAusIndizes(C.zugIndizes(uci).indizes);
  const matt = nach(SCHAEFER);                                          // Weiss setzt matt
  const narr = nach(['f2f3', 'e7e5', 'g2g4', 'd8h4']);                  // Schwarz setzt matt
  const patt = nach(['e2e3', 'a7a5', 'd1h5', 'a8a6', 'h5a5', 'h7h5', 'h2h4', 'a6h6', 'a5c7', 'f7f6', 'c7d7', 'e8f7', 'd7b7', 'd8d3', 'b7b8',
    'd3h7', 'b8c8', 'f7g6', 'c8e6']);                                    // Patt in 10 Zuegen
  const wdh = nach(['g1f3', 'g8f6', 'f3g1', 'f6g8', 'g1f3', 'g8f6', 'f3g1', 'f6g8']);   // dreifache Wiederholung
  const offen = nach(['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'g8f6']);
  const p = (ergebnis, farbe, n) => C.pruefeErgebnis({ ergebnis, farbe }, n).ok;
  pruefe('Sieg nur, wenn die nachgespielte Partie mit deinem Matt endet', p('sieg', 'w', matt) && p('sieg', 'b', narr) && !p('sieg', 'b', matt)
    && !p('sieg', 'w', narr) && !p('sieg', 'w', offen) && !p('sieg', 'w', patt));
  pruefe('Remis nur bei Patt, Wiederholung, 50 Zügen oder zu wenig Material (so beendet die App eine Partie)', patt.remis && wdh.remis
    && p('remis', 'w', patt) && p('remis', 'b', wdh) && !p('remis', 'w', offen) && !p('remis', 'w', matt));
  pruefe('Niederlage: Matt gegen dich oder Aufgeben (offene Stellung), nie nach deinem eigenen Matt oder einem Remis',
    p('niederlage', 'w', narr) && p('niederlage', 'b', matt) && p('niederlage', 'w', offen) && !p('niederlage', 'w', matt) && !p('niederlage', 'w', patt));
  const falsch = C.leseCode(C.erzeugeCode({ botId: 'rudi', farbe: 'w', ergebnis: 'sieg', seed: 1, tag: '2026-10-20', tiefe: 14,
    zuege: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'g8f6'] }).code);
  const r = C.pruefeErgebnis(falsch.daten, C.zuegeAusIndizes(falsch.daten.indizes));
  pruefe('Code mit erfundenem Sieg (offene Partie): Prüfzeichen stimmt, aber ehrlich abgelehnt', falsch.ok && !r.ok && r.grund === 'sieg'
    && /endet nicht mit Matt/.test(r.text) && !C.pruefeErgebnis({ ergebnis: 'sieg', farbe: 'w' }, { ok: false }).ok, r);
}

// =====================================================================
// Speicher (stand.js)
// =====================================================================
// Spielanalyse fuer Tests: eigene Zuege (Flo), dazwischen ruhige Bot-Zuege
function baueReview(farbe, eigene, { genauigkeit = 86.4 } = {}) {
  const zuege = [];
  let ply = 0;
  const bot = () => ({ ply: ply++, farbe: farbe === 'w' ? 'b' : 'w', klasse: 'gut', gewinnVorher: 0.5, gewinnNachher: 0.49 });
  if (farbe === 'b') zuege.push(bot());
  for (const e of eigene) {
    zuege.push({ ply: ply++, farbe, ...e });
    zuege.push(bot());
  }
  return { zuege, genauigkeit: { [farbe]: genauigkeit, [farbe === 'w' ? 'b' : 'w']: 70 } };
}
function bauePartie(id, { botId = 'rudi', farbe = 'w', ergebnis = 'sieg', zuege = 30, modus = 'normal', hinweise = 0, zuruecknahmen = 0, datum = jetzt,
  startFen = null, boss = null } = {}) {
  return { id, botId, spielerFarbe: farbe, ergebnis, modus, hinweise, zuruecknahmen, datum: new Date(datum).toISOString(), startFen,
    zuege: Array.from({ length: zuege * 2 }, () => 'e2e4'), boss, seed: 7 };
}
const analysiert = (p, eigene) => ({ partieId: p.id, botId: p.botId, modus: p.modus, partie: p, review: baueReview(p.spielerFarbe, eigene) });

gruppe = 'Speicher';
{
  setzeSpeicher(fakeSpeicher());
  const st = S.lade();
  pruefe('Ohne Modul: Standard (alter Spielstand ohne Punkte startet leer)', JSON.stringify(st) === JSON.stringify(S.standard()) && st.stand === 1);
  const eigene = [...z('buch', 2), ...z('bester', 4), ...z('gut', 6), ...z('ungenau', 2)];
  const p1 = bauePartie('p1', { zuege: 14 });
  const e1 = S.bewerte(st, analysiert(p1, eigene), { jetzt });
  pruefe('bewerte: Tafelwert, Eintrag auf Thorstens Tafel, erster Eintrag, Rechenstand', e1 && e1.tafel === 'bot:rudi' && e1.erster && e1.w === 200 + 2000 + 1800 + 200 + 500 + 4000 + 3000 && e1.posten.combo === 500
    && e1.stand === 1 && st.tafeln['bot:rudi'].eintraege[0].w === e1.w && st.tafeln['bot:rudi'].eintraege[0].g === 86.4, e1);
  pruefe('bewerte ist idempotent (partie:analysiert kann zweimal kommen)', S.bewerte(st, analysiert(p1, z('brillant', 14)), { jetzt }) === e1
    && st.tafeln['bot:rudi'].eintraege.length === 1 && st.ids.filter((x) => x === 'p1').length === 1);
  const besser = S.bewerte(st, analysiert(bauePartie('p2', { zuege: 14 }), [...eigene.slice(0, 13), ...z('brillant')]), { jetzt });
  pruefe('Neuer Rekord: Rekordbuch mit altem Wert und Rechenstand, Punkt „neu“', besser.rekord && besser.vorher === e1.w && st.rekorde[0].id === 'p2'
    && st.rekorde[0].vorher === e1.w && st.rekorde[0].stand === 1 && st.neu.includes('p2'), besser);
  const hilfe = S.bewerte(st, analysiert(bauePartie('p3', { zuege: 14, hinweise: 1 }), eigene), { jetzt });
  pruefe('Mit Hinweis: Punkte ja, Tafel nein (grund hilfe)', hilfe.w > 0 && hilfe.tafel === null && hilfe.grund === 'hilfe' && st.tafeln['bot:rudi'].eintraege.length === 2);
  const zurueck = S.bewerte(st, analysiert(bauePartie('p3b', { zuege: 14, zuruecknahmen: 2 }), eigene), { jetzt });
  pruefe('Mit Zurücknehmen: kein Tafeleintrag', zurueck.tafel === null && zurueck.grund === 'hilfe');
  const uebung = S.bewerte(st, analysiert(bauePartie('p4', { modus: 'uebung' }), eigene), { jetzt });
  const frei = S.bewerte(st, analysiert(bauePartie('p5', { modus: 'frei' }), eigene), { jetzt });
  const stellung = S.bewerte(st, analysiert(bauePartie('p6', { startFen: '8/8/8/4k3/8/8/4P3/4K3 w - - 0 1' }), eigene), { jetzt });
  const gast = S.bewerte(st, analysiert(bauePartie('p7', { botId: 'test-gast' }), eigene), { jetzt });
  pruefe('Übung: gar nichts; freie Partie, eigene Stellung, Gast: Punkte ohne Tafel (Vorgabe und freie Partien nie)', uebung === null && frei.grund === 'frei'
    && stellung.grund === 'stellung' && gast.grund === 'gast' && [frei, stellung, gast].every((x) => x.tafel === null && x.w > 0));
  const boss = S.bewerte(st, analysiert(bauePartie('p8', { modus: 'boss', botId: 'baron-gambit', boss: { id: 'baron-gambit', stufe: 'meister', staerke: 1100 } }), eigene),
    { jetzt, bossElo: 1000 });
  pruefe('Boss-Partie: Wochen-Tafel je Boss und Stufe, Zeile mit der Stärke, mit der der Boss spielte', boss.tafel === 'boss:baron-gambit:meister'
    && st.tafeln['boss:baron-gambit:meister'].eintraege[0].st === 1000);
  // Zuege nach Hilfe aus der laufenden Partie
  S.merkeLauf(st, 'l9');
  S.merkeHilfe(st, 'l9');
  S.merkeZug(st, 'l9', 2);
  S.merkeZug(st, 'l9', 4);
  S.beende(st, 'l9', 'p9');
  pruefe('Lauf: nur der erste eigene Zug nach dem Hinweis zählt als „nach Hilfe“', JSON.stringify(st.offen.find((o) => o.id === 'p9').nachHilfe) === '[2]' && st.lauf === null);
  const p9 = S.bewerte(st, analysiert(bauePartie('p9', { zuege: 3, hinweise: 1 }), [...z('buch'), ...z('brillant'), ...z('gut')]), { jetzt });
  pruefe('Der Zug nach dem Hinweis bringt 0 Punkte und keinen Platz', p9.posten.zugpunkte === 300 && p9.posten.offen === 1, p9.posten);
  S.merkeLauf(st, 'l10');
  S.merkeHilfe(st, 'l10');
  S.merkeZug(st, 'l10', 6);
  S.vergissAb(st, 'l10', 5);
  pruefe('Zurücknehmen: Merker ab dem Ply weg, der nächste eigene Zug zählt als „nach Hilfe“', st.lauf.nachHilfe.length === 0 && st.lauf.hilfe === true);
  S.speichere(st);
  const neu = S.lade();
  pruefe('speichere und lade: gleicher Stand', JSON.stringify(neu.tafeln) === JSON.stringify(st.tafeln) && neu.rekorde.length === st.rekorde.length && neu.letzte[0].id === st.letzte[0].id);
  // alte oder kaputte Speicherstaende
  const spe = fakeSpeicher();
  setzeSpeicher(spe);
  spe.setItem('schach-arena:v1:modul:punkte', JSON.stringify({ stand: 1, tafeln: { 'bot:rudi': { eintraege: [{ id: 'a', w: 100, t: 5 }] }, kaputt: 3, 'bot:Ä': {} },
    rekorde: [{ tafel: 'bot:rudi', w: 1, t: 1, id: 'a' }, { tafel: 'nein' }], freunde: 'x', ids: ['a', 5], lauf: { id: 7 }, level: 'neun' }));
  const alt = S.lade();
  pruefe('lade: fremde und kaputte Teile fallen weg, Gültiges bleibt (Rechenstand-freundlich)', Object.keys(alt.tafeln).join() === 'bot:rudi'
    && alt.tafeln['bot:rudi'].eintraege[0].w === 100 && alt.rekorde.length === 1 && alt.freunde.length === 0 && alt.ids.join() === 'a' && alt.lauf === null && alt.level === null);
  spe.setItem('schach-arena:v1:modul:punkte', '{kaputt');
  pruefe('lade: kaputtes JSON ergibt den Standard', JSON.stringify(S.lade()) === JSON.stringify(S.standard()));
}

gruppe = 'Speicher-Budget';
{
  setzeSpeicher(fakeSpeicher());
  const st = S.lade();
  const N = 'ABCDEFGHJK'.repeat(17);
  let t0 = ort(2025, 1, 6).getTime();
  // 10 Leiter-Bots, 6 Boss-Tafeln, je viele Partien ueber ein Jahr, volle Rekorde, 12 Freunde, 300 IDs
  for (const id of ['benno', 'hilde', 'kalle', 'lisa', 'rudi', 'turm', 'delia', 'koenig', 'greta', 'stockfisch']) {
    let t = T.neueTafel('bot:' + id);
    for (let i = 0; i < 60; i++) {
      const r = T.eintragen(t, E(`${id}-${i}`, 1000 + ((i * 7919) % 30000), t0 + i * 6 * 86400000, { n: N, m: 12 }), { jetzt: t0 + i * 6 * 86400000 });
      t = T.duenneAus(r.tafel, t0 + i * 6 * 86400000);
    }
    st.tafeln['bot:' + id] = t;
  }
  for (let b = 0; b < 6; b++) {
    st.tafeln[`boss:boss-${b}:standard`] = { ...T.neueTafel(`boss:boss-${b}:standard`), eintraege: [0, 1, 2, 3, 4, 5].map((i) => E(`b${b}-${i}`, 5000 + i, t0, { n: N })) };
  }
  st.rekorde = Array.from({ length: 30 }, (_, i) => ({ tafel: 'bot:rudi', w: 1000 + i, vorher: 999, t: t0, id: 'r' + i, stand: 1, n: N }));
  for (let f = 0; f < 12; f++) S.fuegeFreundHinzu(st, { name: 'Freund ' + f, tafel: 'bot:rudi', w: 100 * f, n: N + f });
  st.ids = Array.from({ length: 300 }, (_, i) => 'p' + String(i).padStart(12, '0'));
  st.letzte = Array.from({ length: 12 }, (_, i) => ({ id: 'l' + i, w: 1, posten: { zugpunkte: 1 }, tafel: 'bot:rudi', grund: null }));
  const vorher = JSON.stringify(st).length;
  const r = S.speichere(st);
  const nach = JSON.stringify(ladeModul('punkte', {})).length;
  const beste = Object.values(S.lade().tafeln).every((t) => t.eintraege.length >= 1);
  pruefe(`Budget: ${vorher} Zeichen werden ausgedünnt auf höchstens ${MODUL_BUDGET.punkte} (${nach}), die Bestwerte jeder Tafel bleiben`,
    r.ok && nach <= MODUL_BUDGET.punkte && beste, { vorher, nach, r });
  pruefe('Freunde: höchstens 12, der 13. wird abgelehnt', S.fuegeFreundHinzu(st, { name: 'Dreizehn', tafel: 'bot:rudi', w: 5 }).grund === 'voll');
  setzeSpeicher(fakeSpeicher());
  const s2 = S.lade();
  const a = S.fuegeFreundHinzu(s2, { name: 'Jule', tafel: 'bot:rudi', w: 21800, n: 'X1' });
  const b = S.fuegeFreundHinzu(s2, { name: 'jule', tafel: 'bot:rudi', w: 20000, n: 'X2' });
  const c = S.fuegeFreundHinzu(s2, { name: 'Jule', tafel: 'bot:rudi', w: 24050, n: 'X3' });
  const d = S.fuegeFreundHinzu(s2, { name: 'Jule', tafel: 'bot:rudi', w: 24050, n: 'X3' });
  pruefe('Freunde: je Tafel zählt der beste Code, gleicher Code doppelt abgelehnt', a.ok && b.ok && b.besser === false && c.ok && c.besser && d.grund === 'doppelt'
    && s2.freunde.length === 1 && s2.freunde[0].eintraege.length === 1 && s2.freunde[0].eintraege[0].w === 24050);
  const g = S.gaeste(s2, 'bot:rudi');
  pruefe('Freunde stehen als Gast-Zeilen auf der Tafel (Initiale, Prüfstufe)', g.length === 1 && g[0].art === 'freund' && g[0].name === 'Jule' && g[0].pruef === 'nachgerechnet');
  pruefe('Ein Tipp löscht einen Freund', S.entferneFreund(s2, s2.freunde[0].id) && s2.freunde.length === 0);
}

gruppe = 'So nah: erst beim Zeigen verbraucht';
{
  // Nachstellung des Pruefer-Befunds: 9.000 Rekord, dann 8.600 (95 %) als zweitbeste eigene Partie
  setzeSpeicher(fakeSpeicher());
  const st = S.lade();
  const nl = (id, eigene) => S.bewerte(st, analysiert(bauePartie(id, { ergebnis: 'niederlage', zuege: 20 }), eigene), { jetzt });
  nl('na', z('exzellent', 20));                                   // 8.000 + Kampfgeist 1.000 = 9.000
  const c = nl('nc', [...z('exzellent', 19), ...z('fehler')]);      // 7.600 + 1.000 = 8.600
  pruefe('95 % des Rekords auf Platz 2: der Satz ist „So nah wie noch nie: 95 %“, nicht „Platz 2“', c.platz === 2 && c.fast && c.fast.prozent === 95
    && A.unterText(c, 'Thorstens Tafel') === 'So nah wie noch nie: 95 % deines Rekords auf Thorstens Tafel', c);
  pruefe('Ungezeigt verbraucht nichts (Umzug, Nachholen in der Arena): die Tafel merkt sich den Moment erst beim Zeigen',
    st.tafeln['bot:rudi'].fast === null && st.tafeln['bot:rudi'].nah === null);
  const gezeigt = S.merkeFast(st, c);
  const e = nl('ne', [...z('exzellent', 19), ...z('fehler')]);
  pruefe('Gezeigt (merkeFast), dann in derselben Woche keine zweite „So nah“-Zeile', gezeigt && st.tafeln['bot:rudi'].fast.id === 'nc'
    && e.fast === null && A.unterText(e, 'Thorstens Tafel') === 'Platz 3 auf Thorstens Tafel' && !S.merkeFast(st, { ...e, fast: c.fast }), e);
}

gruppe = 'Freunde: Grenzen';
{
  setzeSpeicher(fakeSpeicher());
  const st = S.lade();
  for (let f = 0; f < 6; f++) for (const b of ['benno', 'hilde', 'kalle', 'lisa']) S.fuegeFreundHinzu(st, { name: 'F' + f, tafel: 'bot:' + b, w: 100, n: `N${f}${b}` });
  const voll = st.freunde.reduce((n, x) => n + x.eintraege.length, 0);
  const ersetzt = S.fuegeFreundHinzu(st, { name: 'F0', tafel: 'bot:benno', w: 500, n: 'NEU1' });
  const neueTafel = S.fuegeFreundHinzu(st, { name: 'F0', tafel: 'bot:rudi', w: 500, n: 'NEU2' });
  const neuerFreund = S.fuegeFreundHinzu(st, { name: 'F9', tafel: 'bot:rudi', w: 500, n: 'NEU3' });
  pruefe('24 Freundes-Einträge voll: ein besserer Code ersetzt den alten (kein neuer Platz nötig), eine neue Tafel oder ein neuer Freund: „eintraege“',
    voll === 24 && ersetzt.ok && ersetzt.besser && st.freunde[0].eintraege.find((x) => x.tafel === 'bot:benno').w === 500
    && neueTafel.grund === 'eintraege' && neuerFreund.grund === 'eintraege' && st.freunde.length === 6, { voll, ersetzt, neueTafel, neuerFreund });
}

gruppe = 'Bot-Läufe (vorläufig, 3.13 „Schon in S1 nicht leer“)';
{
  const roh = readFileSync(path.join(WURZEL, 'daten/punkte/bot-laeufe.json'), 'utf8');
  const datei = JSON.parse(roh);
  const kopfOk = pruefeInhalt(datei, { art: 'bot-laeufe' });
  pruefe('daten/punkte/bot-laeufe.json: Kopf art „bot-laeufe“, Format 1, Rechenstand der Formel und der App, Inhalt gültig, klein (unter 8 KB)',
    kopfOk.ok && datei.kopf.format === 1 && datei.kopf.rechenstand === F.STAND && datei.kopf.rechenstand === RECHENSTAND && S.pruefeBotLaeufe(datei).length === 0
    && roh.length < 8000 && datei.quelle && datei.quelle.vorlaeufig === true && datei.quelle.tiefe === 14, { kopf: datei.kopf, fehler: S.pruefeBotLaeufe(datei), laenge: roh.length });
  // Nachbarn der Eichungs-Leiter (zehn Bots, 23.10.): Lukas gegen Hilde, Hilde gegen Maxi, ... Koenig gegen Greta, je in
  // beide Richtungen; der Stockfisch hat keine Tafel. Welten (24.10.): die zwanzig neuen Bots haben noch keine Laeufe,
  // ihre Tafeln zeigen den Leer-Zustand ("Erste Partie"), bis die Eichung der Welten ihre Nachbar-Partien rechnet.
  const alt = ['benno', 'hilde', 'kalle', 'lisa', 'rudi', 'turm', 'delia', 'koenig', 'greta'];
  const erwartet = Object.fromEntries(alt.map((id, i) => [`bot:${id}`, [alt[i - 1], alt[i + 1]].filter(Boolean).sort().join()]));
  const ist = Object.fromEntries(Object.entries(datei.tafeln).map(([t, l]) => [t, [...new Set(l.map((x) => x.bot))].sort().join()]));
  pruefe('Jede Tafel der Eichungs-Leiter hat ihre alten Nachbarn als Gäste, die Stockfisch-Tafel und die neuen Bots (noch) keine',
    JSON.stringify(Object.keys(ist).sort()) === JSON.stringify(Object.keys(erwartet).sort()) && Object.keys(ist).every((k) => ist[k] === erwartet[k])
    && !ist['bot:stockfisch'] && Object.keys(ist).every((k) => BOTS.some((b) => `bot:${b.id}` === k)),
    { ohneTafel: Object.keys(erwartet).filter((k) => !(k in ist)).join(' '), abweichend: Object.keys(ist).filter((k) => ist[k] !== erwartet[k]).map((k) => `${k}: Datei ${ist[k]}, erwartet ${erwartet[k]}`) });
  const paare = Object.values(datei.tafeln).flatMap((l) => [...new Set(l.map((x) => x.bot))].map((b) => [l.find((x) => x.bot === b && x.lauf === 'best'), l.find((x) => x.bot === b && x.lauf === 'mittel')]));
  pruefe('Je Nachbar ein bester und ein mittlerer Lauf (bester ≥ mittlerer), ganze Punkte, Farbe, Ergebnis und Züge dabei',
    paare.every(([b, m]) => b && Number.isInteger(b.w) && b.w >= 0 && (!m || (Number.isInteger(m.w) && m.w <= b.w))) && paare.filter(([, m]) => m).length >= 14
    && Object.values(datei.tafeln).flat().every((x) => ['w', 'b'].includes(x.f) && ['s', 'r', 'n'].includes(x.e) && Number.isInteger(x.z) && x.z > 0), paare.length);
  pruefe('pruefeBotLaeufe lehnt Unsinn ab (fremde Tafel-ID, Bot auf seiner eigenen Tafel, negativer Wert, unbekannte Laufart)',
    S.pruefeBotLaeufe({ tafeln: { 'bot:Thorsten': [] } }).length > 0 && S.pruefeBotLaeufe({ tafeln: { 'bot:rudi': [{ bot: 'rudi', lauf: 'best', w: 1 }] } }).length > 0
    && S.pruefeBotLaeufe({ tafeln: { 'bot:rudi': [{ bot: 'lisa', lauf: 'best', w: -1 }] } }).length > 0
    && S.pruefeBotLaeufe({ tafeln: { 'bot:rudi': [{ bot: 'lisa', lauf: 'schnell', w: 1 }] } }).length > 0 && S.pruefeBotLaeufe(null).length > 0);

  // Mischen: Laeufe als Gaeste auf der Tafel, Platz, Ueberholen, Platz 1 mit dem Satz des Bots, der vorn stand
  setzeSpeicher(fakeSpeicher());
  S.setzeBotNamen((id) => (botNachId(id) || {}).name || id);
  const n = S.setzeBotLaeufe({ tafeln: { 'bot:rudi': [{ bot: 'turm', lauf: 'best', w: 20000, f: 'w', e: 's', z: 40 }, { bot: 'turm', lauf: 'mittel', w: 15000 },
    { bot: 'lisa', lauf: 'best', w: 9000, f: 'b', e: 'n', z: 38 }, { bot: 'lisa', lauf: 'mittel', w: 6000 }] } });
  const st = S.lade();
  const g = S.gaeste(st, 'bot:rudi');
  pruefe('Bot-Läufe stehen als Gäste (art bot, vorläufig, Name des Bots) auf ihrer Tafel, nie im Modul-Speicher', n === 4 && g.length === 4
    && g.every((x) => x.art === 'bot' && x.vorlaeufig === true) && g[0].name === 'Professor Oliver Turm' && S.gaeste(st, 'bot:lisa').length === 0
    && !/turm/.test(JSON.stringify(st)), g);
  const e1 = S.bewerte(st, analysiert(bauePartie('b1', { zuege: 12 }), z('ungenau', 12)), { jetzt });   // 1.200 + 7.000 = 8.200
  pruefe('Erste Partie mitten zwischen den Bot-Läufen: Platz 4 (hinter Turm und Turm und Lisa), kein Platz-1-Moment', e1.erster && e1.platz === 4 && !e1.platz1, e1);
  const e2 = S.bewerte(st, analysiert(bauePartie('b2', { zuege: 12 }), z('brillant', 12)), { jetzt });   // 14.400 + COMBO 14.400 + 7.000
  pruefe('Rekord vor allen Läufen: Platz 1 ▲ 3 (vorher Platz 4), überholt Professor Oliver Turm und Lisa Läufer (jeder Name einmal), Satz von Turm',
    e2.rekord && e2.platz1 && e2.platz === 1 && e2.platzVorher === 4 && e2.aufstieg === 3 && e2.ueberholt.join() === 'Professor Oliver Turm,Lisa Läufer'
    && e2.satzBot === 'turm' && e2.post === null, e2);
  const zeilen = T.zeilen(st.tafeln['bot:rudi'], { fenster: 'allzeit', jetzt, gaeste: S.gaeste(st, 'bot:rudi') });
  pruefe('Tafel mit Bot-Läufen: Du, Turm (bester, mittlerer), Lisa (bester), Du, Lisa (mittlerer)', zeilen.map((r) => (r.eigen ? 'Du' : `${r.bot}/${r.lauf}`)).join()
    === 'Du,turm/best,turm/mittel,lisa/best,Du,lisa/mittel', zeilen.map((r) => r.id).join());
  const nb = S.bewerte(st, analysiert(bauePartie('b3', { botId: 'greta', zuege: 12 }), z('gut', 12)), { jetzt });
  pruefe('Ohne Läufe auf der Tafel (Greta im Test): wie vorher nur eigene Einträge', nb.erster && nb.platz === 1 && !nb.platz1);
  pruefe('setzeBotLaeufe(null) nimmt alle Läufe weg; eine ungültige Datei auch', S.setzeBotLaeufe(null) === 0 && S.gaeste(st, 'bot:rudi').length === 0
    && S.setzeBotLaeufe({ tafeln: { 'bot:rudi': [{ bot: 'rudi', lauf: 'best', w: 1 }] } }) === 0);
}

gruppe = 'Abrechnung: Sätze';
{
  const n = 'Thorstens Tafel';
  const basis = { id: 'x', w: 21300, tafel: 'bot:rudi' };
  pruefe('Tafel-Namen in der Besitzform, Boss-Tafel mit Stufe', A.tafelName('bot:rudi') === 'Thorstens Tafel' && A.tafelName('bot:greta') === 'Gretas Tafel'
    && A.tafelName('boss:baron-gambit:meister', () => ({ name: 'Baron von Gambit' })) === 'Boss-Tafel Baron von Gambit · Meister');
  pruefe('Sätze: erster Eintrag, Rekord mit Abstand, Platz, Woche, so nah, Bestwert', A.unterText({ ...basis, erster: true }, n) === 'Erster Eintrag auf Thorstens Tafel'
    && A.unterText({ ...basis, rekord: true, vorher: 19480 }, n) === 'Rekord auf Thorstens Tafel · +1.820' && A.unterText({ ...basis, platz: 3 }, n) === 'Platz 3 auf Thorstens Tafel'
    && A.unterText({ ...basis, wochenPlatz: 2 }, n) === 'Diese Woche: Platz 2 auf Thorstens Tafel'
    && A.unterText({ ...basis, fast: { prozent: 97 } }, n) === 'So nah wie noch nie: 97 % deines Rekords auf Thorstens Tafel'
    && A.unterText({ ...basis, bestwert: 23100 }, n) === 'Thorstens Tafel: dein Bestwert 23.100');
  pruefe('„So nah“ steht vor dem Platz (eine Partie mit 90 % des Rekords steht fast immer unter deinen drei Besten)',
    A.unterText({ ...basis, platz: 2, fast: { prozent: 95 } }, n) === 'So nah wie noch nie: 95 % deines Rekords auf Thorstens Tafel'
    && A.unterText({ ...basis, platz: 2, wochenPlatz: 1, fast: null }, n) === 'Platz 2 auf Thorstens Tafel');
  pruefe('Satz bei Rekord mit Überholen: „Platz 3 auf Thorstens Tafel“ (der Pfeil ▲ 2 und die alte Zahl stehen daneben)',
    A.unterText({ ...basis, rekord: true, vorher: 19480, aufstieg: 2, platz: 3 }, n) === 'Platz 3 auf Thorstens Tafel');
  pruefe('Ohne Tafel: ehrlicher Grund', /Hinweis oder Zurücknehmen/.test(A.unterText({ w: 1, tafel: null, grund: 'hilfe' }))
    && /Freie Partie/.test(A.unterText({ w: 1, tafel: null, grund: 'frei' })) && /Eigene Stellung/.test(A.unterText({ w: 1, tafel: null, grund: 'stellung' })));
}

gruppe = 'Optik (Look A)';
{
  const lies = (d) => readFileSync(path.join(WURZEL, d), 'utf8');
  const css = lies('css/pakete/punkte.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const tokens = lies('css/tokens.css') + '\n' + lies('css/themes/modern.css');
  const feste = css.match(/#[0-9a-f]{3,8}\b|\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color-mix)\(/gi) || [];
  pruefe('css/pakete/punkte.css: keine festen Farben (nur Tokens)', feste.length === 0, feste);
  const namen = [...new Set((css.match(/var\(--[a-z0-9-]+/gi) || []).map((v) => v.slice(4)))].filter((n) => !['--h', '--t'].includes(n));
  const fehlen = namen.filter((n) => !new RegExp(`${n}\\s*:`).test(tokens));
  pruefe(`css/pakete/punkte.css: alle ${namen.length} Variablen stehen in tokens.css oder themes/modern.css`, namen.length > 20 && fehlen.length === 0, fehlen);
  pruefe('css/pakete/punkte.css: kein Neon, kein Glow (keine --neon-Variablen, kein text-shadow, kein filter/blur)', !/var\(--neon-|text-shadow|filter\s*:|blur\(|drop-shadow/i.test(css));
  const uebergaenge = [...css.matchAll(/transition(?:-property)?\s*:\s*([^;}]+)/gi)].map((m) => m[1].trim()).filter((t) => t !== 'none');
  const keyframes = [...css.matchAll(/@keyframes[^{]+\{([\s\S]*?\})\s*\}/g)].map((m) => m[1]);
  const kfSchluessel = keyframes.flatMap((k) => [...k.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]));
  pruefe('css/pakete/punkte.css: Übergänge und Keyframes nur auf transform oder opacity', uebergaenge.every((t) => /^(transform|opacity)\b/.test(t))
    && kfSchluessel.length > 0 && kfSchluessel.every((k) => ['transform', 'opacity'].includes(k)), { uebergaenge, kfSchluessel });
  pruefe('css/pakete/punkte.css: der Schimmer ist endlich (keine Endlos-Animation) und schweigt bei reduzierter Bewegung und Bewegung „aus“',
    !/infinite/.test(css) && /prefers-reduced-motion:\s*reduce\)\s*\{[^}]*pk-schimmer[^}]*animation:\s*none/.test(css) && /\[data-bewegung="aus"\][^{]*pk-schimmer[^{]*\{\s*animation:\s*none/.test(css));
  const js = lies('js/pakete/punkte/ansicht.js') + lies('js/pakete/punkte/liste.js') + lies('js/ui/bestenliste.js');
  const bilder = [...js.matchAll(/anim\(\s*[a-zA-Z.]+\s*,\s*\[([^\]]*)\]/g)].map((m) => m[1]);
  const schluessel = new Set(bilder.flatMap((b) => [...b.matchAll(/([a-zA-Z]+)\s*:/g)].map((m) => m[1])));
  pruefe(`Bewegung nur über anim()/staffel() aus js/bewegung.js, Keyframes nur transform und opacity (${bilder.length} anim)`, bilder.length >= 3
    && [...schluessel].every((k) => ['transform', 'opacity', 'offset'].includes(k)) && !/\.animate\(/.test(js), [...schluessel]);
}

// =====================================================================
// Verdrahtung ueber den Ereignis-Bus (index.js in Node)
// =====================================================================
gruppe = 'Ereignisse';
{
  pruefe('punkte:geaendert steht in EREIGNISSE', EREIGNISSE.includes('punkte:geaendert'));
  setzeSpeicher(fakeSpeicher());
  await import('../js/pakete/punkte/index.js');
  const log = [];
  for (const n of ['punkte:geaendert', 'rekord:neu']) hoere(n, (d) => log.push({ n, d: JSON.parse(JSON.stringify(d)) }));
  // Partie mit Hinweis: der Zug danach zaehlt nicht, kein Tafeleintrag
  sende('partie:gestartet', { laufId: 'la', botId: 'rudi', farbe: 'w', modus: 'normal', wertet: true, fortgesetzt: false });
  sende('zug:gespielt', { laufId: 'la', ply: 0, wer: 'flo' });
  sende('hilfe:genutzt', { laufId: 'la', art: 'hinweis', stufe: 1 });
  sende('zug:gespielt', { laufId: 'la', ply: 2, wer: 'flo' });
  sende('zug:gespielt', { laufId: 'la', ply: 4, wer: 'flo' });
  sende('partie:beendet', { laufId: 'la', partieId: 'pa', botId: 'rudi', modus: 'normal', wertet: true, ergebnis: 'sieg', eigeneZuege: 3, hinweise: 1 });
  const pa = bauePartie('pa', { zuege: 3, hinweise: 1 });
  sende('partie:analysiert', { ...analysiert(pa, [...z('bester'), ...z('brillant'), ...z('gut')]), quelle: 'partie' });
  const ea = S.lade().letzte[0];
  // 3 eigene Zuege: kein Ergebnis-Bonus (vor dem 10. Zug), Verwertung voll (nie ueber 90 %), wie bei den Funken
  pruefe('Hinweis über den Bus: der Zug danach zählt 0, Punkte ohne Tafel', ea.id === 'pa' && ea.posten.zugpunkte === 800 && ea.grund === 'hilfe'
    && ea.posten.ergebnis === 0 && ea.posten.verwertung === 3000
    && log.length === 1 && JSON.stringify(log[0].d) === '{"punkte":3800,"platz":null,"tafel":null,"rekord":false}', { ea, log });
  log.length = 0;
  const pb = bauePartie('pb', { zuege: 12 });
  sende('partie:analysiert', analysiert(pb, z('gut', 12)));
  const pc = bauePartie('pc', { zuege: 12 });
  sende('partie:analysiert', analysiert(pc, z('exzellent', 12)));
  sende('partie:analysiert', analysiert(pc, z('brillant', 12)));
  const rek = log.filter((x) => x.n === 'rekord:neu');
  pruefe('punkte:geaendert { punkte, platz, tafel, rekord } je Partie, zweites partie:analysiert ohne Wirkung', log.filter((x) => x.n === 'punkte:geaendert').length === 2
    && log[0].d.tafel === 'bot:rudi' && log[0].d.platz === 1 && log[0].d.rekord === false, log);
  pruefe('rekord:neu { tafel, wert, vorher, platz, fenster: allzeit, partieId } beim neuen Rekord', rek.length === 1 && rek[0].d.tafel === 'bot:rudi'
    && rek[0].d.wert === 4800 + 4000 + 3000 && rek[0].d.vorher === 3600 + 4000 + 3000 && rek[0].d.fenster === 'allzeit' && rek[0].d.partieId === 'pc', rek);
  await warte(0);
  const f1 = fuerOverlay('pc');
  pruefe('Rekord als großer Moment (tafel-rekord, 70) mit altem Wert und Klang rekord', f1.length === 1 && f1[0].art === 'gross' && f1[0].quelle === 'tafel-rekord'
    && f1[0].prio === 70 && f1[0].titel === 'NEUER REKORD AUF THORSTENS TAFEL' && /vorher 10\.600 \(\+1\.200\)/.test(f1[0].text) && f1[0].klang === 'rekord', f1);
  pruefe('Erster Eintrag: keine Feier', fuerOverlay('pb').length === 0);
  // Budget: ein anderes Paket meldet im selben Ereignis (nach punkte angemeldet) einen groesseren Moment
  const weg = hoere('partie:analysiert', (d) => { if (d.partieId === 'pd') melde({ partieId: 'pd', quelle: 'level-titel', titel: 'LEVEL 5 · Glut' }); });
  sende('partie:analysiert', analysiert(bauePartie('pd', { zuege: 12 }), [...z('brillant', 11), ...z('stark')]));
  weg();
  await warte(0);
  const f2 = fuerOverlay('pd');
  pruefe('Großes Budget schon vergeben (Level-Titel 75): der Rekord kommt als Zeile (rekord, 58)', f2.length === 2 && f2[0].quelle === 'level-titel'
    && f2[1].quelle === 'rekord' && f2[1].art === 'zeile' && f2[1].titel === 'Rekord auf Thorstens Tafel: 34.600' && f2[1].text === 'vorher 11.800', f2);
  // Nachweis: eine gespeicherte Partie bekommt ihren SA1-Code (spaeter, ausserhalb des Hoerers)
  const gespeichert = speicherePartie({ botId: 'benno', botStufe: 1, spielerFarbe: 'w', zuege: SCHAEFER, san: [], ergebnis: 'sieg', grund: 'matt', hinweise: 0,
    zuruecknahmen: 0, liveKlassen: [], seed: 99, datum: jetzt.toISOString() }).partie;
  sende('partie:analysiert', { partieId: gespeichert.id, botId: 'benno', modus: 'normal', partie: gespeichert,
    review: baueReview('w', [...z('buch'), ...z('bester'), ...z('bester'), ...z('bester', 1, { gewinnNachher: 1, evalNachher: { mate: 0 } })]) });
  await warte(30);
  const n = S.lade().tafeln['bot:benno'].eintraege[0].n;
  const nl = n && C.leseCode(n);
  pruefe('Nachweis: der Eintrag trägt seinen SA1-Code (Rechenstand, Bot, Seed, Züge, Datum)', nl && nl.ok && nl.daten.botId === 'benno' && nl.daten.seed === 99
    && C.zuegeAusIndizes(nl.daten.indizes).uci.join() === SCHAEFER.join() && nl.daten.stand === 1, nl);

  // Ueberholen mit Freunden als Gaesten: Platz gewonnen (Pfeil hoch), grosser Moment mit Platz, als Zeile wenn das Budget vergeben ist
  const freunde = (st) => {
    st.freunde = [{ id: 'f1', name: 'Jule', eintraege: [{ tafel: 'bot:kalle', w: 30000, t: 0, tag: '2026-10-01', f: 'w', z: 20, e: 's', pruef: 'nachgerechnet', n: '' }] },
      { id: 'f2', name: 'Kim', eintraege: [{ tafel: 'bot:kalle', w: 12000, t: 0, tag: '2026-10-01', f: 'w', z: 20, e: 's', pruef: 'nachgerechnet', n: '' }] },
      { id: 'f3', name: 'Mo', eintraege: [{ tafel: 'bot:kalle', w: 11000, t: 0, tag: '2026-10-01', f: 'w', z: 20, e: 's', pruef: 'nachgerechnet', n: '' }] }];
  };
  const s0 = S.lade();
  freunde(s0);
  S.speichere(s0);
  sende('partie:analysiert', analysiert(bauePartie('ka', { botId: 'kalle', zuege: 12 }), z('ungenau', 12)));   // 1.200 + 7.000 = 8.200: Platz 4
  sende('partie:analysiert', analysiert(bauePartie('kb', { botId: 'kalle', zuege: 12 }), z('gut', 12)));       // 10.600: Platz 4, kein Ueberholen
  sende('partie:analysiert', analysiert(bauePartie('kc', { botId: 'kalle', zuege: 12 }), z('exzellent', 12))); // 11.800: Platz 3 ▲ 1 (vor Mo)
  await warte(0);
  const kc = S.lade().letzte[0];
  const fk = fuerOverlay('kc');
  pruefe('Rekord mit Überholen: Platz 3 ▲ 1 vor Mo, großer Moment „NEUER REKORD“ mit „Platz 3 ▲ 1“, Überhol-Post für Mo', kc.id === 'kc' && kc.rekord
    && kc.platz === 3 && kc.aufstieg === 1 && kc.ueberholt.join() === 'Mo' && fk.length === 1 && fk[0].quelle === 'tafel-rekord'
    && fk[0].text === 'Platz 3 ▲ 1 · 11.800 Punkte, vorher 10.600 (+1.200)' && JSON.stringify(kc.post) === '{"name":"Mo","w":11000}', { kc, fk });
  const weg2 = hoere('partie:analysiert', (d) => { if (d.partieId === 'kd') melde({ partieId: 'kd', quelle: 'boss-siegel', titel: 'BOSS BESIEGT' }); });
  sende('partie:analysiert', analysiert(bauePartie('kd', { botId: 'kalle', zuege: 12 }), z('stark', 12, { trivial: false }).map((x, i) => ({ ...x, klasse: i % 2 ? 'stark' : 'gut' }))));
  weg2();
  await warte(0);
  const kd = S.lade().letzte[0];
  const fd = fuerOverlay('kd');
  pruefe('Großes Budget vergeben: Platz gewonnen als Zeile „Platz 2 auf Maxis Tafel ▲ 1“ (vorher Platz 3), Überhol-Post für die beste Überholte',
    kd.platz === 2 && kd.aufstieg === 1 && fd.length === 2 && fd[1].quelle === 'rekord' && fd[1].art === 'zeile' && fd[1].titel === 'Platz 2 auf Maxis Tafel ▲ 1'
    && fd[1].text === 'vorher Platz 3' && kd.post.name === 'Kim', { kd, fd });
  sende('partie:analysiert', analysiert(bauePartie('ke', { botId: 'kalle', zuege: 12 }), z('brillant', 12)));
  await warte(0);
  const ke = S.lade().letzte[0];
  const fe = fuerOverlay('ke');
  pruefe('Platz 1 vor allen Freunden: „PLATZ 1 AUF MAXIS TAFEL“ (bot-rekord, groß 78) mit den Überholten', ke.platz1 && ke.platz === 1 && ke.ueberholt.join() === 'Jule'
    && fe.length === 1 && fe[0].quelle === 'bot-rekord' && fe[0].art === 'gross' && fe[0].titel === 'PLATZ 1 AUF MAXIS TAFEL' && /vor Jule/.test(fe[0].text)
    && ke.post.name === 'Jule' && ke.post.w === 30000, { ke, fe });

  // Pruefer-Befund (grossFrei): ein grosser Moment mit KLEINERER Prioritaet, den das Ergebnis schon zeigt (Umwandlung 66 beim
  // Partie-Ende, vor der Analyse), belegt den grossen Platz; der Rekord kommt dann als Zeile statt still in die Nachlese
  sende('partie:analysiert', analysiert(bauePartie('ua', { botId: 'lisa', zuege: 12 }), z('gut', 12)));
  melde({ partieId: 'ub', quelle: 'umwandlung', titel: 'Umwandlung! Deine 3. Figur zieht in die Ehrenreihe.' });
  const vorUb = fuerOverlay('ub');
  sende('partie:analysiert', analysiert(bauePartie('ub', { botId: 'lisa', zuege: 12 }), z('exzellent', 12)));
  await warte(0);
  const fu = fuerOverlay('ub');
  const liegenGeblieben = ladeModul('feier', { eintraege: [] }).eintraege.filter((x) => x.partieId === 'ub' && x.status === 'neu');
  pruefe('Großer Platz schon gezeigt (Umwandlung 66): der Rekord kommt als Zeile „Rekord auf Lisas Tafel: 11.800“, nichts bleibt für die Nachlese',
    vorUb.length === 1 && fu.length === 2 && fu[0].quelle === 'umwandlung' && fu[1].quelle === 'rekord' && fu[1].art === 'zeile'
    && fu[1].titel === 'Rekord auf Lisas Tafel: 11.800' && liegenGeblieben.length === 0, { fu, liegenGeblieben });
  // ein WARTENDER kleinerer grosser Moment (noch nicht gezeigt) weicht dem Rekord: das Ergebnis zeigt den Rekord gross
  melde({ partieId: 'uc', quelle: 'umwandlung', titel: 'Umwandlung! Die Dame ist zurück.' });
  sende('partie:analysiert', analysiert(bauePartie('uc', { botId: 'lisa', zuege: 12 }), z('stark', 12)));
  await warte(0);
  const fc = fuerOverlay('uc');
  pruefe('Wartender kleinerer Moment (Umwandlung, noch nicht gezeigt): der Rekord bekommt den großen Platz (tafel-rekord 70)',
    fc.length === 1 && fc[0].quelle === 'tafel-rekord' && fc[0].art === 'gross', fc);

  // Platz 1 vor vorlaeufigen Bot-Laeufen: der Bot, der vorn stand, sagt seinen Satz (3.13)
  S.setzeBotLaeufe({ tafeln: { 'bot:delia': [{ bot: 'koenig', lauf: 'best', w: 9000, f: 'w', e: 's', z: 30 }, { bot: 'turm', lauf: 'best', w: 6000, f: 'b', e: 'n', z: 41 }] } });
  sende('partie:analysiert', analysiert(bauePartie('da', { botId: 'delia', zuege: 12 }), z('exzellent', 12)));   // 11.800, erster Eintrag vor beiden
  await warte(0);
  const da = S.lade().letzte[0];
  const fda = fuerOverlay('da');
  pruefe('Erster Eintrag vor allen Bot-Läufen: „PLATZ 1 AUF DELIAS TAFEL“ (bot-rekord 78) mit dem Satz von Kommissar Tobias König',
    da.id === 'da' && da.platz1 && da.erster && da.satzBot === 'koenig' && fda.length === 1 && fda[0].quelle === 'bot-rekord'
    && fda[0].titel === 'PLATZ 1 AUF DELIAS TAFEL' && /^11\.800 Punkte, vor allen Gästen\. Kommissar Tobias König: „Fall gelöst/.test(fda[0].text) && fda[0].klang === 'rekord', { da, fda });
  S.setzeBotLaeufe(null);
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

// &kern: ohne die fest eingetragenen PAKETE und REITER (die pruefen die Integration und e2e)
const BASIS = `http://127.0.0.1:${PORT}/index.html?test&kern`;
const MIT = (extra = '') => `${BASIS}&erw=pakete/punkte/index&reiter=bestenliste${extra}`;
const SCHAEFER_ZUEGE = ['e2e4', 'f1c4', 'd1h5', 'h5f7'];
const SCHAEFER_PLAN = { e2e4: 'e7e5', f1c4: 'b8c6', d1h5: 'g8f6' };
const zahlText = (n) => Math.round(Number(n) || 0).toLocaleString('de-DE');

// Diese Suite prueft das Paket punkte fuer sich: js/erweiterungen.js kommt immer mit PAKETE = ['sicherung'] und REITER = [],
// das Paket selbst per ?erw und der Reiter per ?reiter. So bleibt die Suite gleich, wenn die Integration Pakete und Reiter
// eintraegt (sonst laege z. B. eine Level-Feier von funken auf dem grossen Platz, und "ohne Paket" waere nie mehr ohne).
async function nurDiesesPaket(kontext) {
  const echt = readFileSync(path.join(WURZEL, 'js/erweiterungen.js'), 'utf8');
  const body = echt.replace(/^export const PAKETE = Object\.freeze\(\[[^\]]*\]\);/m, "export const PAKETE = Object.freeze(['sicherung']);")
    .replace(/^export const REITER = Object\.freeze\(\[[^\]]*\]\);/m, 'export const REITER = Object.freeze([]);');
  if (!/^export const PAKETE = Object\.freeze\(\['sicherung'\]\);/m.test(body) || !/^export const REITER = Object\.freeze\(\[\]\);/m.test(body)) {
    throw new Error('PAKETE oder REITER in js/erweiterungen.js nicht gefunden');
  }
  await kontext.route('**/js/erweiterungen.js', (r) => r.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body }));
}

// Vorlaeufige Bot-Laeufe (daten/punkte/bot-laeufe.json): die Gruppen pruefen ihre Tafeln ohne Bot-Gaeste (eine leere Datei
// mit gueltigem Kopf, sonst haengen ihre Plaetze an den Werten der Eichung); die Gruppe "Bot-Laeufe" nimmt die echte Datei
// ('echt') und eigene Laeufe
const LEERE_LAEUFE = { kopf: { art: 'bot-laeufe', format: 1, rechenstand: 1, stand: '2026-10-23' }, tafeln: {} };
async function botLaeufeRoute(kontext, daten) {
  await kontext.unroute('**/daten/punkte/bot-laeufe.json').catch(() => {});
  if (daten === 'echt') return;
  await kontext.route('**/daten/punkte/bot-laeufe.json', (r) => r.fulfill({ status: 200, contentType: 'application/json; charset=utf-8',
    body: JSON.stringify(daten) }));
}

async function neueSeite(browser, { w = 1180, h = 820, handy = false, farbe = 'light', reduziert = false, botLaeufe = LEERE_LAEUFE } = {}) {
  const kontext = await browser.newContext({
    viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: true, isMobile: handy, colorScheme: farbe,
    reducedMotion: reduziert ? 'reduce' : 'no-preference',
  });
  await nurDiesesPaket(kontext);
  await botLaeufeRoute(kontext, botLaeufe);
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
    async tippe(sel) {
      const loc = seite.locator(sel).first();
      await loc.waitFor({ state: 'visible', timeout: 10000 });
      // der Rumpf der Bestenliste scrollt selbst: erst ins Bild holen, sonst tippt der Finger neben das Fenster
      await loc.scrollIntoViewIfNeeded();
      const b = await loc.boundingBox();
      await seite.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
      await warte(150);
    },
    async warteFlo(ms = 30000) {
      await seite.waitForFunction(() => window.__partie && window.__partie.phase() === 'flo', null, { timeout: ms });
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
    // Schaefermatt gegen Lukas (wertende Partie), endet mit 4. Dxf7#; mit hinweis tippt Flo vor dem zweiten Zug auf "Hinweis"
    async schaefermatt({ hinweis = false } = {}) {
      await h.planBot();
      await seite.evaluate(() => window.__app.gehe('partie', { botId: 'benno', farbe: 'w' }));
      await seite.waitForFunction(() => window.__partie && window.__partie.bereit === true, null, { timeout: 30000 });
      for (const [i, zug] of SCHAEFER_ZUEGE.entries()) {
        await h.warteFlo();
        if (hinweis && i === 1) {
          await h.tippe('.spielknoepfe [data-aktion="hinweis"]');
          await warte(400);
        }
        await h.tippeFeld(zug.slice(0, 2));
        await h.tippeFeld(zug.slice(2, 4));
      }
      await seite.waitForSelector('.ergebnis-overlay .erg-karte-ort .pk-abr', { timeout: 40000 });
      await seite.waitForSelector('.ergebnis-overlay.gefuellt:not(.vorlaeufig)', { timeout: 60000 });
      await seite.waitForSelector('.ergebnis-overlay .pk-abr[data-fertig="1"]:not(.pk-wartet)', { timeout: 15000 }).catch(() => {});
      await seite.evaluate(() => { window.__test = {}; });
    },
    stand: () => seite.evaluate(() => window.__punkte.stand()),
    async aendereStand(fn, arg) {
      await seite.evaluate(([f, a]) => { const st = window.__punkte.stand(); new Function('st', 'a', f)(st, a); window.__punkte.speichere(st); }, [fn, arg]);
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
    // wartet, bis der Klang einmal kam, und dann so lange, dass ein Echo (zweites Mal) auch noch kaeme
    async warteKlang(name, nachher = 1800) {
      await seite.waitForFunction((n) => (window.__klaenge || []).includes(n), name, { timeout: 6000 }).catch(() => {});
      await warte(nachher);
    },
    async schliesseErgebnis() {
      await seite.locator('.ergebnis-overlay .erg-zu').click();
      await warte(300);
    },
    async bestenliste(params = {}) {
      await seite.evaluate((p) => window.__app.gehe('bestenliste', p), params);
      await seite.waitForSelector('.screen.bl-screen .bl-reiter:not([hidden])');
      await warte(700);
    },
    async reiter(id) {
      await seite.locator(`.bl-steuer-reiter .seg[data-wert="${id}"]`).click();
      await seite.waitForSelector(`.bl-reiter[data-reiter="${id}"]:not([hidden])`);
      await warte(500);
    },
    async fenster(id) {
      await seite.locator(`.bl-steuer-fenster .seg[data-wert="${id}"]`).click();
      await warte(500);
    },
  };
  return h;
}

async function bild(seite, name) {
  await seite.screenshot({ path: path.join(BILDER, name + '.png') });
}

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

// Layout: kein waagrechtes Ueberlaufen, alle bedienbaren Elemente mindestens 44 px hoch (Tippflaeche)
const layoutMass = () => {
  const s = document.querySelector('.screen.bl-screen');
  const rumpf = s && s.querySelector('.bl-rumpf');
  const zuKlein = [...s.querySelectorAll('.bl-rumpf button, .bl-rumpf select, .bl-rumpf input')].filter((b) => {
    const r = b.getBoundingClientRect();
    return r.width > 0 && (r.height < 43.5 || r.width < 43.5);
  }).map((b) => b.className + ':' + Math.round(b.getBoundingClientRect().height) + 'x' + Math.round(b.getBoundingClientRect().width));
  return { ueber: rumpf ? rumpf.scrollWidth - rumpf.clientWidth : -1, seite: document.documentElement.scrollWidth - innerWidth, zuKlein };
};

async function testeBrowser(browser) {
  // ---------- 1. Router ohne Paket: Bestenliste geht still zur Arena (wie ohne Datei) ----------
  gruppe = 'Router';
  {
    const { kontext, seite, fehler } = await neueSeite(browser);
    await seite.goto(BASIS + '#bestenliste');
    await seite.waitForFunction(() => location.hash === '#arena' && !!document.querySelector('.screen.arena'), null, { timeout: 15000 });
    pruefe('Ohne Paket: #bestenliste geht still zur Arena, kein Platzhalter (die Datei ist da, zeige() aber nicht)',
      await seite.locator('.screen.platzhalter').count() === 0 && await seite.evaluate(() => location.hash) === '#arena');
    pruefe('Ohne Paket: keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }

  // ---------- 2. Leere Bestenliste, Reiter in der Leiste ----------
  gruppe = 'Bestenliste leer';
  const { kontext, seite, fehler } = await neueSeite(browser);
  const h = hilfen(seite);
  await seite.goto(MIT() + '#arena');
  await seite.waitForSelector('.screen.arena');
  await warte(400);
  const leiste = await seite.evaluate(() => [...document.querySelectorAll('.reiter-leiste [data-reiter]')].map((b) => b.dataset.reiter).join());
  pruefe('Reiter „Bestenliste“ in der Leiste (Testmodus ?reiter=bestenliste)', leiste === 'arena,bestenliste', leiste);
  await seite.locator('.reiter-leiste [data-reiter="bestenliste"]').click();
  await seite.waitForSelector('.screen.bl-screen .bl-reiter:not([hidden])');
  await warte(700);
  pruefe('Reiter öffnet die Bestenliste (Titel, aktiv, #bestenliste)', await seite.evaluate(() => document.title) === 'Bestenliste · Crownmate'
    && await seite.evaluate(() => document.querySelector('.reiter-leiste [aria-current="page"]').dataset.reiter) === 'bestenliste'
    && await seite.evaluate(() => location.hash) === '#bestenliste');
  const reiterIds = await seite.evaluate(() => [...document.querySelectorAll('.bl-steuer-reiter .seg')].map((s) => s.dataset.wert + ':' + s.textContent.trim()).join());
  const fensterIds = await seite.evaluate(() => [...document.querySelectorAll('.bl-steuer-fenster .seg')].map((s) => s.dataset.wert + (s.getAttribute('aria-checked') === 'true' ? '*' : '')).join());
  pruefe('Kopf über hauptKopf, Reiter Ich · Bots · Freunde (Ort bestenliste:reiter), Fenster Woche · Monat · Allzeit (Standard Woche)',
    await seite.locator('.bl-screen .haupt-kopf').count() === 1 && reiterIds === 'ich:Ich,bots:Bots,freunde:Freunde' && fensterIds === 'woche*,monat,allzeit', [reiterIds, fensterIds]);
  pruefe('Leer: ein ruhiger Satz und „Jetzt spielen“ statt leerer Tabellen, kein leeres Rekordbuch, keine Erklärsätze im Kopf',
    /Diese Woche noch keine Partie/.test(await seite.locator('.bl-reiter[data-reiter="ich"] .bl-gesamt').innerText())
    && await seite.locator('.bl-reiter[data-reiter="ich"] .bl-spielen').count() === 1 && await seite.locator('.bl-rekordbuch').count() === 0
    && !/ganz ohne Server|Jede Zeile eine echte Partie|wie treu/.test(await seite.locator('.bl-screen').innerText()));
  await h.reiter('bots');
  const leerBots = await seite.locator('.bl-tafel').innerText();
  pruefe('Bots leer: Tafel des nächsten Gegners (Willi) mit Satz und „Erste Partie: Willi, Weiß“', /Willis Tafel/.test(leerBots) && /Noch keine Partie auf Willis Tafel/.test(leerBots)
    && /Erste Partie: Willi, Weiß/.test(leerBots), leerBots);
  // Flo 31.10.2026 ("Die lange Liste ergibt irgendwie nicht so viel Sinn"): statt 30 Chips links "Deine Gegner" nach Welten,
  // nur freigeschaltete (am Anfang Willi), je Zeile Portraet, Name und Platz; rechts die Tafel
  const gegner = await seite.evaluate(() => [...document.querySelectorAll('.bl-gegner .bl-gegner-zeile')].map((z) => ({
    tafel: z.dataset.tafel, name: z.querySelector('b').textContent, info: z.querySelector('.bl-g-mitte span').textContent,
    bild: !!z.querySelector('.bl-g-av img'), an: z.getAttribute('aria-current') === 'true' })));
  pruefe('Bots: Übersicht „Deine Gegner“ nur mit freigeschalteten (Willi), Welt-Überschrift, Porträt, „Noch keine Partie“, keine Chip-Leiste',
    gegner.length === 1 && gegner[0].tafel === 'bot:fridolin' && gegner[0].name === 'Vogelscheuche Willi' && gegner[0].bild && gegner[0].an
    && gegner[0].info === 'Noch keine Partie' && /Welt 1/i.test(await seite.locator('.bl-g-welt').first().innerText())
    && await seite.locator('.bl-tafelwahl, .bl-wahl').count() === 0, gegner);
  await bild(seite, 'bestenliste-leer-1180');
  await h.reiter('freunde');
  pruefe('Freunde: ohne eigene Partie kein Teilen, Einlesen geht, Fenster-Segment ausgeblendet', /Sobald du eine Partie auf einer Tafel hast/.test(await seite.locator('.bl-teilen').innerText())
    && await seite.locator('.bl-code-ein').count() === 1 && await seite.locator('.bl-steuer-fenster').isHidden());
  pruefe('Leer: keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));

  // ---------- 3. "Punkte werden gezaehlt" (Analyse rechnet noch) ----------
  gruppe = 'Abrechnung';
  const wartend = await seite.evaluate(async () => {
    const o = await import('./js/orte.js');
    const d = document.createElement('div');
    const partie = { id: 'gibt-es-nicht', spielerFarbe: 'w', zuege: ['e2e4', 'e7e5', 'g1f3'] };
    const a = o.fuelle('ergebnis:abrechnung', d, { rechnet: true, erg: { partie }, modus: 'normal' });
    const b = o.fuelle('ergebnis:abrechnung', d, { rechnet: false, erg: { partie }, modus: 'normal' });
    const u = o.fuelle('ergebnis:abrechnung', document.createElement('div'), { rechnet: true, erg: { partie: { ...partie, id: 'x', modus: 'uebung' } }, modus: 'uebung' });
    // sofort aufgegeben (kein eigener Zug): keine Spielanalyse, also auch keine Punkte-Zeile
    const n = o.fuelle('ergebnis:abrechnung', document.createElement('div'), { rechnet: true, erg: { partie: { ...partie, id: 'y', zuege: [] } }, modus: 'normal' });
    const t = [...d.querySelectorAll('.pk-abr')].map((x) => x.className + '|' + x.textContent.replace(/\s+/g, ' ').trim());
    a.verlasse(); b.verlasse(); u.verlasse(); n.verlasse();
    return { t, u: u.anzahl, n: n.anzahl };
  });
  pruefe('Rechnet die Analyse noch: „Punkte werden gezählt …“ mit ruhigem Schimmer; ohne Analyse: „Punkte folgen mit der Analyse“; Übung und ohne eigenen Zug: keine Zeile',
    wartend.t.length === 2 && /pk-schimmer/.test(wartend.t[0]) && /Punkte werden gezählt …/.test(wartend.t[0]) && !/pk-schimmer/.test(wartend.t[1])
    && /Punkte folgen mit der Analyse/.test(wartend.t[1]) && wartend.u === 0 && wartend.n === 0, wartend);

  // ---------- 4. Erste Partie: Abrechnung "Erster Eintrag" ----------
  await h.klangSpion();
  await h.schaefermatt();
  const st1 = await h.stand();
  const e1 = st1.letzte[0];
  pruefe('ergebnis:abrechnung: Zeile data-zeile="punkte" als erste Zeile der Abrechnung', await seite.locator('.erg-karte-ort .abrechnung > .pk-abr[data-zeile="punkte"]').count() === 1
    && await seite.evaluate(() => document.querySelector('.erg-karte-ort .abrechnung').firstElementChild.dataset.zeile) === 'punkte');
  pruefe('Zeile „PUNKTE“ mit Wert wie gespeichert und „Erster Eintrag auf Lukas’ Tafel“', (await seite.locator('.pk-abr .pk-wert').innerText()).trim() === zahlText(e1.w)
    && (await seite.locator('.pk-abr .pk-satz').innerText()).trim() === 'Erster Eintrag auf Lukas’ Tafel' && e1.erster && e1.tafel === 'bot:benno' && e1.w > 0, e1);
  pruefe('Erster Eintrag: keine Feier-Zeile von punkte, kein Rekord-Klang', await seite.locator('.erg-feier [data-quelle="tafel-rekord"], .erg-feier [data-quelle="rekord"]').count() === 0
    && !(await h.klaenge()).includes('rekord'));
  await h.tippe('.pk-abr-knopf');
  const det = await seite.locator('.pk-details').innerText();
  pruefe('Antippen zeigt die Aufschlüsselung (Züge, Theorie, kurzer Sieg ohne Ergebnis-Bonus, Verwertung) und „Zur Bestenliste“',
    await seite.locator('.pk-details:not([hidden])').count() === 1 && /Züge \(\d+ offen\)/.test(det) && /Theorie/.test(det)
    && /Vor dem 10\. eigenen Zug beendet: kein Ergebnis-Bonus/.test(det) && /Verwertung/.test(det) && await seite.locator('.pk-zur-liste').count() === 1, det);
  await bild(seite, 'ergebnis-erster-eintrag');
  const fensterGemerkt = () => seite.evaluate(() => (JSON.parse(localStorage.getItem('schach-arena:v1:einstellungen:punkte') || '{}') || {}).fenster ?? null);
  const fensterVorher = await fensterGemerkt();
  await h.tippe('.pk-zur-liste');
  await seite.waitForSelector('.bl-reiter[data-reiter="bots"]:not([hidden])');
  await warte(600);
  pruefe('„Zur Bestenliste“ öffnet den Reiter Bots mit Lukas’ Tafel', /Lukas’ Tafel/.test(await seite.locator('.bl-tafel h2').innerText())
    && await seite.locator('.bl-tafel').getAttribute('data-tafel') === 'bot:benno');
  // Pruefer-Befund (klein): der Platz der Abrechnung gilt Allzeit, also oeffnet "Zur Bestenliste" die Tafel in Allzeit
  // (nicht im gemerkten Fenster, Standard Woche); gemerkt wird dabei kein Fenster
  pruefe('„Zur Bestenliste“ nach „Platz/Erster Eintrag“: Zeitraum Allzeit (wie der Platz der Abrechnung), das gemerkte Fenster bleibt unberührt',
    await seite.locator('.bl-screen').getAttribute('data-fenster') === 'allzeit'
    && await seite.locator('.bl-steuer-fenster .seg[aria-checked="true"]').getAttribute('data-wert') === 'allzeit'
    && fensterVorher !== 'allzeit' && await fensterGemerkt() === fensterVorher, { fensterVorher, jetzt: await fensterGemerkt() });

  // ---------- 5. Bestenliste mit Daten ----------
  gruppe = 'Bestenliste';
  const zeile = await seite.evaluate(() => {
    const z = document.querySelector('.bl-tafel .bl-zeile.ich');
    return z && { platz: z.querySelector('.bl-platz').textContent, name: z.querySelector('.bl-z-name').textContent, info: z.querySelector('.bl-z-info').textContent,
      punkte: z.querySelector('.bl-punkte').textContent, neu: z.dataset.neu, linie: getComputedStyle(z).boxShadow, hoehe: Math.round(z.getBoundingClientRect().height) };
  });
  pruefe('Eigene Zeile hervorgehoben (Akzentlinie): Platz, „Du“, Punkte, Datum, Farbe, Ergebnis, Züge, Genauigkeit, 56 px hoch', zeile && zeile.platz === '1'
    && /^Du/.test(zeile.name) && zeile.punkte === zahlText(e1.w) && /\d\d\.\d\d\. · Weiß · Sieg · 4 Züge · [\d,]+ %/.test(zeile.info) && /inset/.test(zeile.linie)
    && zeile.hoehe >= 56, zeile);
  pruefe('Punkt „neu“ an der neuen Zeile, nach dem Ansehen weg', zeile && zeile.neu === '1' && (await h.stand()).neu.length === 0);
  await h.fenster('allzeit');
  pruefe('Fenster Allzeit: dieselbe Zeile', await seite.locator('.bl-tafel .bl-zeile.ich').count() === 1
    && (await seite.locator('.bl-tafel .bl-k-kopf .ueberzeile').textContent()).trim() === 'Allzeit');
  await h.fenster('woche');
  await bild(seite, 'bestenliste-bots-1180');
  // die Zeile springt an den Moment mit dem groessten Ausschlag (Ply im Eintrag), die Analyse meldet ihn mit analyse:gesehen
  const mPly = (await h.stand()).tafeln['bot:benno'].eintraege.find((x) => x.id === e1.id).m;
  await seite.evaluate(async () => {
    const e = await import('./js/ereignisse.js');
    window.__gesehen = [];
    e.hoere('analyse:gesehen', (d) => window.__gesehen.push(d.ply));
  });
  await h.tippe('.bl-tafel .bl-zeile.ich .bl-z-innen');
  await seite.waitForSelector('.screen.an-screen', { timeout: 30000 }).catch(() => {});
  await warte(600);
  const an = await seite.evaluate(() => ({ hash: location.hash, da: !!document.querySelector('.screen.an-screen'), gesehen: window.__gesehen }));
  pruefe('Zeile antippen springt in die Analyse dieser Partie, an den Moment mit dem größten Ausschlag', an.da && an.hash === '#analyse/' + encodeURIComponent(e1.id)
    && Number.isInteger(mPly) && an.gesehen[0] === mPly, { an, mPly });
  await h.bestenliste({ reiter: 'ich' });
  const ich = await seite.locator('.bl-reiter[data-reiter="ich"]').innerText();
  pruefe('Reiter Ich: beste Partie groß („Punkte auf Lukas’ Tafel“), Rekorde, Platz 1, Tafeln und „Deine besten Partien“ über alle Tafeln', /0\s*Rekorde/.test(ich) && /1\s*Tafeln/.test(ich)
    && /Punkte auf Lukas’ Tafel/.test(ich)
    && new RegExp(zahlText(e1.w)).test(ich) && /Lukas’ Tafel ·/.test(await seite.locator('.bl-gesamt .bl-z-info').first().innerText()), ich.slice(0, 300));

  // Bot-Panel der Arena (3.17 "Thorstens Tafel: Platz 4"): Tafel des gewaehlten Bots mit Bestwert, Antippen oeffnet sie
  await seite.evaluate(() => window.__app.gehe('arena', { waehle: 'hilde' }));
  await seite.waitForSelector('.screen.arena .detail');
  await warte(500);
  const ohnePanel = await seite.locator('.ort-panel-bot .pk-panel').count();
  await seite.evaluate(() => window.__app.gehe('arena', { waehle: 'benno' }));
  await seite.waitForSelector('.screen.arena .ort-panel-bot .pk-panel', { timeout: 10000 }).catch(() => {});
  // Seit U5 gleitet das Detail-Panel beim Wechsel des Bots herein (transform): erst messen, wenn es steht
  // (nur endliche Animationen im Panel, die Weltkarte hat Dauer-Animationen)
  await seite.evaluate(() => Promise.all(document.getAnimations().filter((a) => {
    const t = a.effect && a.effect.target;
    return t && t.closest && t.closest('.detail') && a.effect.getComputedTiming().endTime !== Infinity;
  }).map((a) => a.finished.catch(() => null))));
  const panel = await seite.evaluate(() => {
    const k = document.querySelector('.ort-panel-bot .pk-panel');
    return k && { text: k.textContent.trim(), h: Math.round(k.getBoundingClientRect().height), tag: k.tagName };
  });
  pruefe('Bot-Panel (arena:panel-bot): „Lukas’ Tafel · Bestwert …“ als Knopf, mindestens 44 px hoch; ohne eigenen Eintrag (Hilde) keine Zeile', ohnePanel === 0
    && panel && panel.tag === 'BUTTON' && panel.text === `Lukas’ Tafel · Bestwert ${zahlText(e1.w)}` && panel.h >= 44, { ohnePanel, panel });
  await h.tippe('.ort-panel-bot .pk-panel');
  await seite.waitForSelector('.bl-reiter[data-reiter="bots"]:not([hidden])', { timeout: 10000 }).catch(() => {});
  await warte(500);
  pruefe('Bot-Panel antippen öffnet Lukas’ Tafel in der Bestenliste', await seite.locator('.bl-tafel').getAttribute('data-tafel') === 'bot:benno');

  // ---------- 6. Rekord: grosser Moment, alte Zahl durchgestrichen ----------
  gruppe = 'Rekord';
  await h.aendereStand("st.tafeln['bot:benno'].eintraege[0].w = 1000; st.ids = [];", null);
  await h.klangSpion();
  await h.schaefermatt();
  const e2 = (await h.stand()).letzte[0];
  const feier2 = await seite.locator('.erg-feier .erg-f-zeile[data-quelle="tafel-rekord"]').allInnerTexts();
  pruefe('Neuer Rekord: großer Moment „NEUER REKORD AUF LUKAS’ TAFEL“ mit altem Wert', e2.rekord && e2.vorher === 1000 && feier2.length === 1
    && /NEUER REKORD AUF LUKAS’ TAFEL/.test(feier2[0]) && /vorher 1\.000/.test(feier2[0])
    && await seite.locator('.erg-feier .erg-f-zeile.gross[data-quelle="tafel-rekord"]').count() === 1, { e2, feier2 });
  pruefe('Abrechnung: alte Zahl bleibt durchgestrichen stehen, die neue daneben, Satz „Rekord auf … · +…“', (await seite.locator('.pk-abr s.pk-alt').innerText()).trim() === '1.000'
    && (await seite.locator('.pk-abr .pk-wert').innerText()).trim() === zahlText(e2.w) && /^Rekord auf Lukas’ Tafel · \+/.test((await seite.locator('.pk-satz').innerText()).trim())
    && await seite.locator('.pk-abr[data-rekord="1"]').count() === 1);
  await warte(500);
  await h.warteKlang('rekord');
  pruefe('Klang „rekord“ beim Rekord', (await h.klaenge()).includes('rekord'), await h.klaenge());
  pruefe('Klang „rekord“ genau einmal: der große Moment klingt, die Abrechnungszeile schweigt (kein Echo)',
    (await h.klaenge()).filter((n) => n === 'rekord').length === 1, await h.klaenge());
  await bild(seite, 'ergebnis-rekord');
  await h.schliesseErgebnis();
  await h.bestenliste({ reiter: 'ich' });
  pruefe('Rekordbuch: neuer Wert, alter Wert durchgestrichen (Rechenstand steht nur bei alten Regeln dabei)', !/Rechenstand/.test(await seite.locator('.bl-rekordbuch').innerText())
    && (await seite.locator('.bl-rekordbuch s').first().innerText()).trim() === '1.000');

  // ---------- 7. Platz 1 mit Ueberholen: Freund als Gast, Mini-Tafel gleitet, Klacken ----------
  gruppe = 'Überholen';
  await h.aendereStand(`st.tafeln['bot:benno'].eintraege.forEach((e) => { e.w = 900; }); st.ids = [];
    st.freunde = [{ id: 'f1', name: 'Jule', eintraege: [{ tafel: 'bot:benno', w: 2000, t: 0, tag: '2026-10-01', f: 'w', z: 4, e: 's', pruef: 'nachgerechnet', n: '' }] }];`, null);
  await h.klangSpion();
  await h.schaefermatt();
  const e3 = (await h.stand()).letzte[0];
  const mini = await seite.evaluate(() => [...document.querySelectorAll('.pk-mini .pk-m-zeile')].map((z) => z.dataset.rolle + ':' + z.querySelector('.pk-m-name').textContent));
  pruefe('Platz 1 vor Jule: Satz mit ▲ 1, Mini-Tafel (du, unter dir: Jule)', e3.platz1 && e3.aufstieg === 1 && /▲ 1/.test(await seite.locator('.pk-text').innerText())
    && mini.join() === 'ich:Du,unter:Jule', { e3, mini });
  pruefe('Platz 1 als großer Moment „PLATZ 1 AUF LUKAS’ TAFEL“ (bot-rekord, 78)', await seite.locator('.erg-feier .erg-f-zeile.gross[data-quelle="bot-rekord"]').count() === 1
    && /PLATZ 1 AUF LUKAS’ TAFEL/.test(await seite.locator('.erg-feier [data-quelle="bot-rekord"]').innerText()));
  await warte(600);
  await h.warteKlang('rekord');
  const k3 = await h.klaenge();
  pruefe('je überholter Zeile ein Klacken (klick) und der Rekord-Klang', k3.filter((n) => n === 'klick').length >= 1 && k3.includes('rekord'), k3);
  pruefe('Platz 1: „rekord“ genau einmal (nur der große Moment), das Klacken bleibt', k3.filter((n) => n === 'rekord').length === 1, k3);
  pruefe('Abrechnung: „Platz 1 auf Lukas’ Tafel ▲ 1“', (await seite.locator('.pk-satz').innerText()).trim() === 'Platz 1 auf Lukas’ Tafel'
    && (await seite.locator('.pk-pfeil').innerText()).trim() === '▲ 1');
  await bild(seite, 'ergebnis-platz1');
  // Ueberhol-Post (3.13): einmal still in der Aufschluesselung angeboten, Vorschau mit Text und Code, nichts geht automatisch raus
  await h.tippe('.pk-abr-knopf');
  pruefe('Überhol-Post: in der Aufschlüsselung „Überhol-Post an Jule“', (await seite.locator('.pk-post').innerText()).trim() === 'Überhol-Post an Jule');
  await h.tippe('.pk-post');
  const post = await seite.locator('.pk-post-text').inputValue();
  const postCode = (post.match(/SA1-[0-9A-Z-]+/) || [''])[0];
  pruefe('Überhol-Post: Vorschau „Ich hab deine 2.000 auf Lukas’ Tafel geknackt, jetzt …“ mit gültigem Code der Partie, Kopieren-Knopf',
    new RegExp(`^Ich hab deine 2\\.000 auf Lukas’ Tafel geknackt, jetzt ${zahlText(e3.w).replace('.', '\\.')}\\. Code: SA1-`).test(post)
    && C.leseCode(postCode).ok && C.zuegeAusIndizes(C.leseCode(postCode).daten.indizes).uci.join() === SCHAEFER.join()
    && await seite.locator('.pk-post-kopieren').count() === 1, post);
  await bild(seite, 'ergebnis-ueberhol-post');
  await h.schliesseErgebnis();
  await h.bestenliste({ reiter: 'bots' });
  const gast = await seite.evaluate(() => [...document.querySelectorAll('.bl-tafel .bl-zeile')].map((z) => z.dataset.platz + ':' + z.querySelector('.bl-z-name').textContent.trim()));
  await seite.evaluate(() => window.__app.gehe('arena', { waehle: 'benno' }));
  await seite.waitForSelector('.screen.arena .ort-panel-bot .pk-panel', { timeout: 10000 }).catch(() => {});
  pruefe('Bot-Panel mit Gast auf der Tafel: dazu „· Platz 1“', /^Lukas’ Tafel · Bestwert [\d.]+ · Platz 1$/.test((await seite.locator('.ort-panel-bot .pk-panel').textContent()).trim()));
  await h.bestenliste({ reiter: 'bots' });
  pruefe('Freunde stehen als Gast-Zeilen auf der Tafel (Initiale, „Nachgerechnet ✓“)', gast.some((g) => /^2:J\s*Jule\s*Nachgerechnet ✓/.test(g)) && /^1:Du/.test(gast[0]), gast);

  // ---------- 8. So nah wie noch nie, und Hilfe ohne Tafel ----------
  gruppe = 'So nah, Hilfe';
  await h.aendereStand(`st.freunde = []; st.ids = []; const t = st.tafeln['bot:benno']; t.eintraege.forEach((e, i) => { e.w = a + i; }); t.nah = null; t.fast = null;`,
    Math.round(e3.w / 0.97));
  await h.schaefermatt();
  const e4 = (await h.stand()).letzte[0];
  pruefe('97 % des Rekords: „So nah wie noch nie: 97 % deines Rekords auf Lukas’ Tafel“, keine Feier', e4.fast && e4.fast.prozent >= 96
    && /^So nah wie noch nie: \d+ % deines Rekords auf Lukas’ Tafel$/.test((await seite.locator('.pk-satz').innerText()).trim())
    && await seite.locator('.erg-feier [data-quelle="tafel-rekord"], .erg-feier [data-quelle="rekord"], .erg-feier [data-quelle="bot-rekord"]').count() === 0, e4);
  pruefe('Gezeigt heißt festgeschrieben: die Tafel merkt sich Woche und Partie des Moments', (await h.stand()).tafeln['bot:benno'].fast.id === e4.id);
  await h.schliesseErgebnis();
  // Pruefer-Befund: dieselbe Naehe auf Platz 2 (unter deinen drei Besten) zeigte "Platz 2" und verbrauchte den Moment still
  await h.aendereStand(`st.ids = []; const t = st.tafeln['bot:benno']; t.eintraege = t.eintraege.slice(0, 2); t.eintraege[0].w = a; t.eintraege[1].w = 10;
    t.nah = null; t.fast = null;`, Math.round(e3.w / 0.97));
  await h.schaefermatt();
  const e4b = (await h.stand()).letzte[0];
  const satz4b = (await seite.locator('.pk-satz').innerText()).trim();
  pruefe('97 % auf Platz 2: „So nah wie noch nie …“ statt „Platz 2“, beim Zeigen festgeschrieben', e4b.platz === 2 && e4b.fast
    && /^So nah wie noch nie: \d+ % deines Rekords auf Lukas’ Tafel$/.test(satz4b) && (await h.stand()).tafeln['bot:benno'].fast.id === e4b.id, { e4b, satz4b });
  await h.schliesseErgebnis();
  await h.schaefermatt();
  const e4c = (await h.stand()).letzte[0];
  const satz4c = (await seite.locator('.pk-satz').innerText()).trim();
  pruefe('Dieselbe Woche noch einmal so nah: nur der Platz (höchstens einmal je Tafel und Woche)', e4c.id !== e4b.id && !e4c.fast
    && /^Platz \d auf Lukas’ Tafel$/.test(satz4c), { e4c, satz4c });
  // Neuaufbau der Zeile (Nachtrag): entschieden wird einmal je Partie, der Satz bleibt derselbe
  const neuaufbau = await seite.evaluate(() => {
    const P = window.__punkte;
    const alt = P.stand().tafeln['bot:benno'];
    const merk = { fast: alt.fast, nah: alt.nah };
    const kandidat = (id) => ({ id, tafel: 'bot:benno', w: 1, fast: { prozent: 99, anteil: 0.99, wo: merk.fast.wo } });
    const setze = (fast, nah) => { const st = P.stand(); st.tafeln['bot:benno'].fast = fast; st.tafeln['bot:benno'].nah = nah; P.speichere(st); };
    const a1 = P.fastZeigen(kandidat('fz-a'));   // Moment der Woche schon vergeben
    const a2 = P.fastZeigen(kandidat('fz-a'));   // Neuaufbau derselben Zeile
    setze(null, null);
    const b1 = P.fastZeigen(kandidat('fz-b'));   // jetzt frei: gezeigt und festgeschrieben
    const fest = P.stand().tafeln['bot:benno'].fast;
    setze({ wo: merk.fast.wo, id: 'jemand-anders' }, 0.995);
    const b2 = P.fastZeigen(kandidat('fz-b'));   // Neuaufbau: bleibt bei "So nah"
    setze(merk.fast, merk.nah);
    return { a1: a1.fast, a2: a2.fast, b1: !!b1.fast, b2: !!b2.fast, fest };
  });
  pruefe('Neuaufbau der Zeile: derselbe Satz wie beim ersten Zeigen (vergeben bleibt vergeben, gezeigt bleibt gezeigt)',
    neuaufbau.a1 === null && neuaufbau.a2 === null && neuaufbau.b1 && neuaufbau.b2 && neuaufbau.fest && neuaufbau.fest.id === 'fz-b', neuaufbau);
  await h.schliesseErgebnis();
  await h.schaefermatt({ hinweis: true });
  const e5 = (await h.stand()).letzte[0];
  pruefe('Mit Hinweis: Punkte ja, aber „Ohne Tafel-Eintrag: Hinweis oder Zurücknehmen genutzt“', e5.tafel === null && e5.grund === 'hilfe'
    && /Ohne Tafel-Eintrag: Hinweis oder Zurücknehmen genutzt/.test(await seite.locator('.pk-satz').innerText()), e5);
  await h.schliesseErgebnis();
  pruefe('Partien: keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));

  // ---------- 9. Freunde: Code teilen (Vorschau) und einlesen (nachrechnen) ----------
  gruppe = 'Freunde-Code';
  await h.bestenliste({ reiter: 'freunde' });
  await seite.locator('.bl-name').fill('Flo');
  await h.tippe('.bl-zeigen');
  const vorschau = await seite.locator('.bl-teilen-vorschau').innerText();
  const code = await seite.locator('.bl-code-aus').inputValue();
  pruefe('Vorschau mit allem, was im Code steht (Tafel, Gegner, Farbe, Ergebnis, Züge, Datum, Name, Seed, Rechenstand, Analysetiefe, Punkte)',
    ['Tafel', 'Gegner', 'Farbe', 'Ergebnis', 'Züge', 'Datum', 'Name', 'Seed', 'Rechenstand', 'Analysetiefe', 'Punkte'].every((w) => vorschau.includes(w))
    && /Bauer Lukas/.test(vorschau) && /Flo/.test(vorschau) && /^SA1-[0-9A-Z]{4}(-[0-9A-Z]{1,4})+$/.test(code), { vorschau, code });
  const lc = C.leseCode(code);
  pruefe('Der geteilte Code ist gültig und enthält die Züge der Partie', lc.ok && lc.daten.botId === 'benno' && lc.daten.name === 'Flo'
    && C.zuegeAusIndizes(lc.daten.indizes).uci.join() === SCHAEFER.join(), lc);
  await bild(seite, 'freunde-vorschau');
  // Einlesen: erst ein Tippfehler, dann ein echter Code einer Freundin (Schaefermatt mit Schwarz-Zuegen anders: Seed und Name)
  await seite.locator('.bl-code-ein').fill(code.slice(0, 12) + (code[12] === 'A' ? 'B' : 'A') + code.slice(13));
  await h.tippe('.bl-pruefen');
  pruefe('Tippfehler im Code: ehrlicher Hinweis auf das Prüfzeichen', /Prüfzeichen passt nicht/.test(await seite.locator('.bl-lesen-ergebnis').innerText()));
  // Pruefer-Befund: ein Code, der fuer eine offene Partie einen Sieg behauptet, wird ehrlich abgelehnt (kein "Nachgerechnet")
  const gefaelscht = C.erzeugeCode({ botId: 'benno', farbe: 'w', ergebnis: 'sieg', seed: 4711, tag: '2026-10-20', tiefe: 10, zuege: SCHAEFER.slice(0, 4), name: 'Max' }).code;
  await seite.locator('.bl-code-ein').fill(gefaelscht);
  await h.tippe('.bl-pruefen');
  pruefe('Code mit erfundenem Sieg (Partie ohne Matt): ehrlich abgelehnt, kein „Nachrechnen und eintragen“',
    /Im Code steht ein Sieg, aber die nachgespielte Partie endet nicht mit Matt/.test(await seite.locator('.bl-lesen-ergebnis').innerText())
    && await seite.locator('.bl-nachrechnen').count() === 0 && (await h.stand()).freunde.length === 0);
  const freundCode = C.erzeugeCode({ botId: 'benno', farbe: 'w', ergebnis: 'sieg', seed: 4711, tag: '2026-10-20', tiefe: 10, zuege: SCHAEFER, name: '' }).code;
  await seite.locator('.bl-code-ein').fill(freundCode);
  await h.tippe('.bl-pruefen');
  pruefe('Gültiger Code: „Prüfzeichen stimmt“, Vorschau, Frage nach dem Namen (Code ohne Namen)', /Prüfzeichen stimmt/.test(await seite.locator('.bl-lesen-ergebnis').innerText())
    && await seite.locator('.bl-f-name-ein').count() === 1);
  await seite.locator('.bl-f-name-ein').fill('Mia');
  await h.tippe('.bl-nachrechnen');
  await seite.waitForFunction(() => /Nachgerechnet ✓/.test((document.querySelector('.bl-fortschritt') || {}).textContent || ''), null, { timeout: 90000 }).catch(() => {});
  const nachText = await seite.locator('.bl-fortschritt').innerText();
  const stF = await h.stand();
  pruefe('Nachrechnen: die App spielt die Partie nach und rechnet die Punkte selbst („Nachgerechnet ✓: … Punkte auf Lukas’ Tafel“)', /^Nachgerechnet ✓: [\d.]+ Punkte auf Lukas’ Tafel/.test(nachText)
    && stF.freunde.length === 1 && stF.freunde[0].name === 'Mia' && stF.freunde[0].eintraege[0].pruef === 'nachgerechnet' && stF.freunde[0].eintraege[0].w > 0, { nachText, f: stF.freunde });
  pruefe('„Deine Freunde“ zeigt Mia mit ihrer Tafel', /Mia/.test(await seite.locator('.bl-freunde').innerText()) && /1 von 12/.test(await seite.locator('.bl-freunde').textContent()));
  await bild(seite, 'freunde-eingelesen');
  await h.reiter('bots');
  pruefe('Mia steht als Gast-Zeile auf Lukas’ Tafel', /Mia/.test(await seite.locator('.bl-tafel').innerText()));
  await h.reiter('freunde');
  await h.tippe('.bl-f-weg');
  pruefe('Ein Tipp entfernt Mia', (await h.stand()).freunde.length === 0 && /Noch keine Freunde/.test(await seite.locator('.bl-freunde').innerText()));
  pruefe('Freunde: keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));

  // ---------- 10. Umzug: vorhandene Analysen werden einmal die ersten Eintraege ----------
  gruppe = 'Umzug';
  // goto mit anderem Hash laedt die Seite nicht neu (nur ein Sprung im Dokument): deshalb reload
  await seite.evaluate(() => { localStorage.removeItem('schach-arena:v1:modul:punkte'); location.hash = '#arena'; });
  await seite.reload();
  await seite.waitForSelector('.screen.arena');
  await seite.waitForFunction(() => window.__punkte && window.__punkte.stand().umzug === true, null, { timeout: 8000 }).catch(() => {});
  const um = await h.stand();
  const analysen = await seite.evaluate(async () => { const st = await import('./js/storage.js'); return st.ladePartien().filter((p) => st.hatReview(p.id)).length; });
  pruefe('Erster Start mit Paket: gespeicherte Analysen eingetragen (still: ohne „neu“, ohne Feier)', um.umzug === true && um.tafeln['bot:benno']
    && um.tafeln['bot:benno'].eintraege.length >= 1 && um.ids.length === Math.min(12, analysen) && um.neu.length === 0 && um.letzte.length >= 1,
  { umzug: um.umzug, t: Object.keys(um.tafeln), ids: um.ids.length, analysen });
  await h.aendereStand('st.tafeln = {}; st.ids = []; st.letzte = [];', null);
  await seite.reload();
  await seite.waitForSelector('.screen.arena');
  await warte(2500);
  const um2 = await h.stand();
  pruefe('Umzug nur einmal: beim nächsten Start nicht wieder', um2.umzug === true && Object.keys(um2.tafeln).length === 0 && um2.ids.length === 0, um2.ids);
  pruefe('Umzug: keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
  await kontext.close();

  // ---------- 10b. Vorlaeufige Bot-Laeufe (3.13 "Schon in S1 nicht leer"): echte Datei, dann eigene Laeufe ----------
  gruppe = 'Bot-Läufe';
  {
    const echt = JSON.parse(readFileSync(path.join(WURZEL, 'daten/punkte/bot-laeufe.json'), 'utf8'));
    const hilde = echt.tafeln['bot:benno'] || [];
    const { kontext: k, seite: s, fehler: f } = await neueSeite(browser, { botLaeufe: 'echt' });
    const hs = hilfen(s);
    await s.goto(MIT() + '#arena');
    await s.waitForSelector('.screen.arena');
    // Welten: Lukas ist erst nach einem Sieg gegen Willi frei und dann der naechste Gegner (seine Tafel steht in der Datei,
    // und nur ein freier Bot hat den Knopf "Erste Partie")
    await s.evaluate(() => localStorage.setItem('schach-arena:v1:fortschritt', JSON.stringify({ bots: { fridolin: { sterne: [true, false, false], partien: 1,
      siege: 1, remis: 0, niederlagen: 0, besteGenauigkeit: 60 } }, brillanteZuege: [] })));
    await s.reload();
    await s.waitForSelector('.screen.arena');
    await s.waitForFunction(() => window.__punkte && window.__punkte.S.botLaeufe('bot:benno').length > 0, null, { timeout: 10000 }).catch(() => {});
    await hs.bestenliste({ reiter: 'bots' });
    const tafelZeilen = () => s.evaluate(() => [...document.querySelectorAll('.bl-tafel .bl-zeile')].map((z) => ({
      platz: z.dataset.platz, ich: z.classList.contains('ich'), name: z.querySelector('.bl-z-name').textContent.trim(),
      info: z.querySelector('.bl-z-info').textContent.trim(), punkte: z.querySelector('.bl-punkte').textContent.trim(),
      bild: !!z.querySelector('.bl-gast-bot img[src*="avatare"]') })));
    const z0 = await tafelZeilen();
    pruefe('Lukas’ Tafel ohne eigene Partie ist nicht leer: Hildes Läufe aus daten/punkte/bot-laeufe.json (Avatar, „Bester Bot-Lauf · vorläufig“, Punkte)',
      hilde.length >= 1 && z0.length === hilde.length && z0.every((x) => /^Oma Hilde/.test(x.name) && x.bild && !x.ich)
      && /^Bester Bot-Lauf · vorläufig · (Weiß|Schwarz) · (Sieg|Remis|Niederlage) · \d+ Züge$/.test(z0[0].info) && z0[0].punkte === zahlText(hilde[0].w)
      && /Erste Partie: Lukas, Weiß/.test(await s.locator('.bl-tafel').innerText()), { z0, hilde });
    await bild(s, 'bestenliste-bot-laeufe-leer');
    // erste eigene Partie: Platz zwischen den Laeufen (Gaeste sind aelter: bei Gleichstand stehen sie vorn)
    await hs.schaefermatt();
    const e = (await hs.stand()).letzte[0];
    const vor = hilde.filter((x) => x.w >= e.w).length;
    pruefe('Erste Partie mit echten Läufen: Platz gleich 1 + Zahl der Läufe mit mindestens gleich vielen Punkten', e.erster && e.platz === vor + 1
      && e.platz1 === (vor === 0), { e, vor });
    pruefe('Echte Datei: keine Konsolenfehler (die Datei ist da)', f.length === 0, f.join(' | '));

    // eigene Laeufe relativ zur Partie: Hilde 70 % und 50 %, dein alter Bestwert 30 %; die naechste Partie ueberholt beide
    const eigene = { kopf: LEERE_LAEUFE.kopf, tafeln: { 'bot:benno': [
      { bot: 'hilde', lauf: 'best', w: Math.round(e.w * 0.7), f: 'b', e: 's', z: 31, g: 81.2 },
      { bot: 'hilde', lauf: 'mittel', w: Math.round(e.w * 0.5), f: 'w', e: 'n', z: 22, g: 64.5 }] } };
    await botLaeufeRoute(k, eigene);
    await hs.aendereStand("st.tafeln['bot:benno'].eintraege.forEach((x) => { x.w = a; });", Math.round(e.w * 0.3));
    await s.evaluate(() => { location.hash = '#arena'; });
    await s.reload();
    await s.waitForSelector('.screen.arena');
    await s.waitForFunction((w) => window.__punkte && window.__punkte.S.botLaeufe('bot:benno').some((x) => x.w === w), Math.round(e.w * 0.7), { timeout: 10000 }).catch(() => {});
    await hs.klangSpion();
    await hs.schaefermatt();
    const e2 = (await hs.stand()).letzte[0];
    const gross = await s.locator('.erg-feier .erg-f-zeile.gross[data-quelle="bot-rekord"]').allInnerTexts();
    const mini = await s.evaluate(() => [...document.querySelectorAll('.pk-mini .pk-m-zeile')].map((x) => x.dataset.rolle + ':' + x.querySelector('.pk-m-name').textContent));
    pruefe('Rekord vor beiden Läufen: Platz 1 ▲ 2 (vorher Platz 3), überholt „Oma Hilde“ (ein Name), Mini-Tafel du / Oma Hilde', e2.rekord && e2.platz1
      && e2.platz === 1 && e2.platzVorher === 3 && e2.aufstieg === 2 && e2.ueberholt.join() === 'Oma Hilde' && mini.join() === 'ich:Du,unter:Oma Hilde'
      && (await s.locator('.pk-satz').innerText()).trim() === 'Platz 1 auf Lukas’ Tafel' && (await s.locator('.pk-pfeil').innerText()).trim() === '▲ 2', { e2, mini });
    pruefe('Großer Moment „PLATZ 1 AUF LUKAS’ TAFEL“ mit dem Satz des überholten Bots (Oma Hilde, 3.13)', gross.length === 1 && /PLATZ 1 AUF LUKAS’ TAFEL/.test(gross[0])
      && /vor Oma Hilde\. Oma Hilde: „Na sowas, an mir vorbei!/.test(gross[0]) && e2.satzBot === 'hilde', gross);
    await hs.warteKlang('rekord');
    const kl = await hs.klaenge();
    pruefe('Bot überholt: zwei Klacken (je überholte Zeile), „rekord“ genau einmal', kl.filter((n) => n === 'klick').length === 2
      && kl.filter((n) => n === 'rekord').length === 1, kl);
    await bild(s, 'ergebnis-platz1-bot');
    await hs.schliesseErgebnis();
    await hs.bestenliste({ reiter: 'bots' });
    const z2 = await tafelZeilen();
    pruefe('Tafel danach: Du vorn, dann Hildes bester und mittlerer Lauf, dann dein alter Wert', z2.map((x) => (x.ich ? 'Du' : x.name.replace(/\s+/g, ' '))).join()
      === 'Du,Oma Hilde,Oma Hilde,Du' && /^Mittlerer Bot-Lauf · vorläufig · Weiß · Niederlage · 22 Züge$/.test(z2[2].info), z2);
    await bild(s, 'bestenliste-bot-laeufe');
    pruefe('keine Konsolenfehler', f.length === 0, f.join(' | '));
    await k.close();
  }

  // ---------- 10c. Reduzierte Bewegung: sofort das fertige Bild, ein Klang ----------
  gruppe = 'Reduzierte Bewegung';
  {
    const { kontext: k, seite: s, fehler: f } = await neueSeite(browser, { reduziert: true });
    const hs = hilfen(s);
    await s.goto(MIT() + '#arena');
    await s.waitForSelector('.screen.arena');
    await hs.schaefermatt();
    await hs.schliesseErgebnis();
    await hs.aendereStand("st.tafeln['bot:benno'].eintraege.forEach((x) => { x.w = 1000; });", null);
    await hs.klangSpion();
    // Zeitpunkte: wann kommt die Zeile (nicht die Wartezeile), wann steht ihr Endbild (data-fertig)
    await s.evaluate(() => {
      window.__abr = [];
      new MutationObserver((ml) => {
        for (const m of ml) {
          for (const n of m.addedNodes || []) {
            if (n.nodeType !== 1) continue;
            for (const z of [n, ...n.querySelectorAll('.pk-abr')]) if (z.matches('.pk-abr:not(.pk-wartet)')) window.__abr.push({ was: 'neu', t: performance.now() });
          }
          if (m.type === 'attributes' && m.target.matches('.pk-abr:not(.pk-wartet)')) window.__abr.push({ was: 'fertig', t: performance.now() });
        }
      }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-fertig'] });
    });
    await hs.schaefermatt();
    const e = (await hs.stand()).letzte[0];
    const r = await s.evaluate(() => {
      const z = document.querySelector('.pk-abr:not(.pk-wartet)');
      const neu = window.__abr.find((x) => x.was === 'neu');
      const fertig = window.__abr.find((x) => x.was === 'fertig');
      return { abstand: neu && fertig ? fertig.t - neu.t : null, wert: z.querySelector('.pk-wert').textContent, anim: z.getAnimations({ subtree: true }).length,
        alt: (z.querySelector('.pk-alt') || {}).textContent || '' };
    });
    pruefe('Die Zeile steht sofort fertig da (data-fertig in unter 300 ms, kein Hochzählen, keine Animation), alte Zahl daneben',
      e.rekord && r.abstand != null && r.abstand < 300 && r.wert === zahlText(e.w) && r.anim === 0 && r.alt === '1.000', r);
    await hs.warteKlang('rekord');
    pruefe('„rekord“ genau einmal', (await hs.klaenge()).filter((n) => n === 'rekord').length === 1, await hs.klaenge());
    pruefe('keine Konsolenfehler', f.length === 0, f.join(' | '));
    await k.close();
  }

  // ---------- 11. Bilder und Layout: 1180 x 820 und 390 x 844, hell und dunkel ----------
  gruppe = 'Bilder';
  const FENSTER_BILDER = [['1180-hell', 1180, 820, false, 'light'], ['1180-dunkel', 1180, 820, false, 'dark'], ['390-hell', 390, 844, true, 'light'],
    ['390-dunkel', 390, 844, true, 'dark'], ['820-hoch', 820, 1180, false, 'light']];
  for (const [name, w, hh, handy, farbe] of FENSTER_BILDER.filter(([n]) => !SCHNELL || n === '1180-hell' || n === '390-dunkel')) {
    const { kontext: k, seite: s, fehler: f } = await neueSeite(browser, { w, h: hh, handy, farbe });
    const hs = hilfen(s);
    await s.goto(MIT() + '#arena');
    await s.waitForSelector('.screen.arena');
    await hs.schaefermatt();
    await warte(400);
    const abr = await s.evaluate(() => {
      const z = document.querySelector('.pk-abr');
      const k2 = z.closest('.ergebnis-karte').getBoundingClientRect();
      const r = z.getBoundingClientRect();
      const wert = z.querySelector('.pk-wert').getBoundingClientRect();
      return { innen: r.left >= k2.left - 1 && r.right <= k2.right + 1, wert: wert.right <= r.right + 1 && wert.width > 0 };
    });
    pruefe(`${name}: Abrechnungszeile passt in die Karte (Wert rechts sichtbar)`, abr.innen && abr.wert, abr);
    const kw = await kontrast(s, '.pk-wert', '.pk-abr');
    const kt = await kontrast(s, '.pk-satz', '.pk-abr');
    pruefe(`${name}: Abrechnung lesbar (Wert ${kw.toFixed(1)}:1, Satz ${kt.toFixed(1)}:1, mindestens 4,5:1)`, kw >= 4.5 && kt >= 4.5);
    await bild(s, 'ergebnis-' + name);
    await hs.schliesseErgebnis();
    for (const r of ['bots', 'ich', 'freunde']) {
      await hs.bestenliste({ reiter: r });
      const m = await s.evaluate(layoutMass);
      pruefe(`${name}, ${r}: kein waagrechtes Überlaufen, Tippflächen mindestens 44 px`, m.ueber <= 0 && m.seite <= 0 && m.zuKlein.length === 0, m);
      await bild(s, `bestenliste-${r}-${name}`);
    }
    const kz = await kontrast(s, '.bl-reiter:not([hidden]) .bl-klein', '.bl-reiter:not([hidden]) .bl-karte');
    pruefe(`${name}: kleine Texte lesbar (${kz.toFixed(1)}:1)`, kz >= 4.5);
    pruefe(`${name}: keine Konsolenfehler`, f.length === 0, f.join(' | '));
    await k.close();
  }

  // ---------- 12. Zusammen mit funken (P1): eine Abrechnung, Punkte vor Funken ----------
  gruppe = 'Mit funken';
  {
    const { kontext: k, seite: s, fehler: f } = await neueSeite(browser);
    const hs = hilfen(s);
    await s.goto(`${BASIS}&erw=pakete/funken/index,pakete/punkte/index&reiter=bestenliste#arena`);
    await s.waitForSelector('.screen.arena');
    await hs.schaefermatt();
    await s.waitForSelector('.ergebnis-overlay .abrechnung > [data-zeile="funken"]', { timeout: 15000 }).catch(() => {});
    const zeilen = await s.evaluate(() => [...document.querySelectorAll('.ergebnis-overlay .abrechnung > [data-zeile]')].map((x) => x.dataset.zeile).join());
    pruefe('Eine Abrechnung mit beiden Paketen: Zeile Punkte (10) vor Funken (20)', zeilen === 'punkte,funken', zeilen);
    pruefe('Mit funken: keine Konsolenfehler', f.length === 0, f.join(' | '));
    await k.close();
  }

  // ---------- 13. Test-Huelle des Orts (ohne App) ----------
  gruppe = 'Test-Hülle';
  {
    const { kontext: k, seite: s, fehler: f } = await neueSeite(browser);
    await s.goto(`http://127.0.0.1:${PORT}/tests/orte-huelle.html?ort=bestenliste:reiter&erw=pakete/punkte/index&reiter=bots&fenster=allzeit`);
    await s.waitForFunction(() => window.__huelle && window.__huelle.bereit === true, null, { timeout: 15000 });
    const r = await s.evaluate(() => ({ anzahl: window.__huelle.anzahl, fehler: window.__huelle.fehler,
      reiter: [...document.querySelectorAll('.huelle-ort > .bl-reiter')].map((x) => x.dataset.reiter + (x.hidden ? '' : '*')).join() }));
    pruefe('bestenliste:reiter in der Test-Hülle: drei Anbieter, nur Bots gefüllt (Kontext reiter, fenster)', r.anzahl === 3 && r.reiter === 'ich,bots*,freunde'
      && r.fehler.length === 0, r);
    pruefe('Test-Hülle: keine Konsolenfehler', f.length === 0, f.join(' | '));
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
