// Tests fuer das Paket "tagesraetsel" (Welle C, S1-5, SPIELKONZEPT 3.6).
// Node-Teil ohne Browser: Datei-Pruefung, Tag aus dem Datum (Grenze 4:00, 3:59 gehoert zum Vortag), Wiederholung in
// ganzen Wochen nach dem Ende, Aufgaben fuer den Raetsel-Bildschirm (mit chess.js gespielt), Modul (erstes Ergebnis
// zaehlt, Archiv, Ein Wort, alte und kaputte Staende, Budget), Archiv der letzten 30 Tage, "Ein Wort", Text zum Teilen
// (ohne Link, ohne Loesung), CSS nur mit Tokens, Logik ohne Zufall und ohne Uhr, die echte Datei (falls da).
// Browser-Teil (Playwright, Chromium) gegen die echte App mit ?test&kern&erw=pakete/tagesraetsel/index und einer
// Beispiel-Datei per Route (Start zwei Montage vor heute): Karte im Training, Zeile in der Heute-Karte, Loesen mit
// einem Fehlversuch, Ergebnis im Modul und als Ereignis, "Ein Wort", Teilen-Text, Karte danach, Archiv, Modul einer
// neueren App, kaputtes Modul, ohne Datei; hell und dunkel, iPad quer (1180 x 820) und Handy hoch (390 x 844).
//
//   node tests/tagesraetsel.test.mjs                 alles
//   node tests/tagesraetsel.test.mjs --nur-node      ohne Browser
//   node tests/tagesraetsel.test.mjs --ohne-bilder   ohne Bildschirmfotos
//   PORT=9710 BILDER=<ordner> node tests/tagesraetsel.test.mjs
//
// Playwright: PLAYWRIGHT_PFAD, sonst 'playwright', sonst /opt/node-tools/node_modules/playwright.
process.env.TZ = 'Europe/Berlin';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { browserTyp } from './browser.mjs';

const require = createRequire(import.meta.url);
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8871);
const ERW = 'pakete/tagesraetsel/index';
const BASIS = `http://127.0.0.1:${PORT}/index.html?test&kern&erw=${ERW}`;
const NUR_NODE = process.argv.includes('--nur-node');
const OHNE_BILDER = process.argv.includes('--ohne-bilder');
const BILDER = process.env.BILDER || path.join(os.tmpdir(), 'crownmate-bilder', 'tagesraetsel');
const lies = (d) => readFileSync(path.join(WURZEL, d), 'utf8');
const warte = (ms) => new Promise((r) => setTimeout(r, ms));
const MODUL_KEY = 'schach-arena:v1:modul:tagesraetsel';

const ergebnisse = [];
let gruppe = '';
function pruefe(name, ok, detail = '') {
  ergebnisse.push({ name: (gruppe ? gruppe + ': ' : '') + name, ok: !!ok, detail });
  console.log(`${ok ? 'ok  ' : 'FEHLER'} ${gruppe ? gruppe + ': ' : ''}${name}${!ok && detail ? ' (' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) + ')' : ''}`);
}

// ---------- Beispiel-Raetsel (Format der Fabrik, im Node-Teil mit chess.js geprueft) ----------
const P_DAME1 = { fen: 'k7/8/1K6/8/8/8/8/7Q w - - 0 1', loesung: ['h1h8'], motiv: 'matt', matt: 1 };
const P_GRUND = { fen: '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1', loesung: ['a1a8'], motiv: 'grundreihe', matt: 1 };
const P_SCHWARZ = { fen: 'r5k1/5ppp/8/8/8/8/5PPP/6K1 b - - 0 1', loesung: ['a8a1'], motiv: 'grundreihe', matt: 1 };
const P_ZWEI = { fen: '4r1k1/3q1ppp/8/8/8/8/4QPPP/4R1K1 w - - 0 1', loesung: ['e2e8', 'd7e8', 'e1e8'], motiv: 'grundreihe', matt: 2 };
// Weiss gewinnt die Dame (Sxh4), ohne sicheres Motiv
const P_DAME = { fen: 'rnb1k1nr/pppp1ppp/8/2b1p3/4P2q/5N2/PPPP1PPP/RNBQKB1R w KQkq - 4 4', loesung: ['f3h4'], motiv: null, matt: null };
// je Wochentag (Mo..So) die Vorlagen und Stufen; Sonntag zwei Teile
const WOCHE = [
  [[P_DAME1, 1]], [[P_GRUND, 2]], [[P_SCHWARZ, 3]], [[P_ZWEI, 4]], [[P_GRUND, 5]], [[P_ZWEI, 7]], [[P_DAME1, 4], [P_ZWEI, 6]],
];

function beispielDatei(start, wochen, { ohneMotiv = true, rechenstand = 1 } = {}) {
  let n = 0;
  const tage = [];
  for (let w = 0; w < wochen; w++) {
    for (let t = 0; t < 7; t++) {
      tage.push({
        aufgaben: WOCHE[t].map(([p, stufe]) => {
          n++;
          // Dienstag der ersten Woche ohne Motiv (Node-Teil); im Browser haben alle eins
          const motiv = ohneMotiv && w === 0 && t === 1 ? null : p.motiv;
          const vorlage = ohneMotiv && w === 0 && t === 1 ? P_DAME : p;
          return { id: `bsp-${String(n).padStart(4, '0')}`, fen: vorlage.fen, loesung: vorlage.loesung.slice(), motiv, stufe,
            matt: vorlage.matt, titel: vorlage.fen.split(' ')[1] === 'b' ? 'Schwarz am Zug' : 'Weiß am Zug' };
        }),
      });
    }
  }
  return {
    kopf: { art: 'tagesraetsel', format: 1, rechenstand, stand: start, titel: 'Beispiel (Test)' },
    quelle: { partien: 0, kandidaten: 0, behalten: n, engine: 'Test', nodes: 0 },
    start, tage,
  };
}

async function nodeTeil() {
  const L = await import('../js/pakete/tagesraetsel/logik.js');
  const T = await import('../js/tag.js');
  const { Chess } = await import('../vendor/chess/chess.js');
  const { MODUL_BUDGET } = await import('../js/storage.js');

  gruppe = 'Datei';
  const D = beispielDatei('2026-10-19', 2);
  pruefe('Beispiel-Datei ist gueltig', L.pruefeDatei(D).length === 0, L.pruefeDatei(D));
  const kaputt = (aendere) => { const d = JSON.parse(JSON.stringify(D)); aendere(d); return L.pruefeDatei(d); };
  pruefe('start muss ein Montag sein', kaputt((d) => { d.start = '2026-10-20'; }).some((f) => /Montag/.test(f)));
  pruefe('Loesung mit gerader Laenge (endet mit dem Gegner) faellt auf', kaputt((d) => { d.tage[0].aufgaben[0].loesung = ['h1h8', 'a8a7']; }).length > 0);
  pruefe('unbekanntes Motiv faellt auf', kaputt((d) => { d.tage[0].aufgaben[0].motiv = 'zwickmuehle'; }).length > 0);
  pruefe('Stufe 8 faellt auf', kaputt((d) => { d.tage[0].aufgaben[0].stufe = 8; }).length > 0);
  pruefe('doppelte id faellt auf', kaputt((d) => { d.tage[1].aufgaben[0].id = d.tage[0].aufgaben[0].id; }).some((f) => /doppelt/.test(f)));
  pruefe('drei Aufgaben an einem Tag fallen auf', kaputt((d) => { d.tage[0].aufgaben.push(...d.tage[6].aufgaben); }).length > 0);
  pruefe('kein JSON-Objekt: Fehler statt Absturz', L.pruefeDatei(null).length > 0 && L.pruefeDatei({ start: 'x' }).length > 0);

  gruppe = 'Tag';
  const mo = L.tagDaten(D, '2026-10-19');
  pruefe('Montag des Starts: Raetsel 1, Wochentag 0, eine Aufgabe', mo && mo.nummer === 1 && mo.wochentag === 0 && mo.aufgaben.length === 1);
  const so = L.tagDaten(D, '2026-10-25');
  pruefe('Sonntag: zwei Teile, Nummer 7', so && so.aufgaben.length === 2 && so.nummer === 7);
  pruefe('vor dem Start: kein Raetsel', L.tagDaten(D, '2026-10-18') === null);
  const nach = L.tagDaten(D, '2026-11-02');
  pruefe('nach dem Ende: in ganzen Wochen von vorn (wieder Montag-Raetsel), Nummer zaehlt weiter',
    nach && nach.nummer === 15 && nach.aufgaben[0].id === D.tage[0].aufgaben[0].id && nach.wochentag === 0);
  pruefe('fuer alle gleich: dasselbe Datum, dasselbe Raetsel', JSON.stringify(L.tagDaten(D, '2026-10-22')) === JSON.stringify(L.tagDaten(D, '2026-10-22')));
  const v359 = T.tagSchluessel(new Date(2026, 9, 21, 3, 59));
  const v400 = T.tagSchluessel(new Date(2026, 9, 21, 4, 0));
  pruefe('Tageswechsel um 4:00: 3:59 gehoert zum Vortag', v359 === '2026-10-20' && v400 === '2026-10-21'
    && L.tagDaten(D, v359).nummer === 2 && L.tagDaten(D, v400).nummer === 3, v359 + ' / ' + v400);
  const sommer = T.tagSchluessel(new Date(2026, 9, 25, 3, 30));
  pruefe('Ende der Sommerzeit (25.10. 3:30): noch der Samstag', sommer === '2026-10-24' && L.tagDaten(D, sommer).wochentag === 5, sommer);

  gruppe = 'Aufgaben';
  const auf = L.alsAufgaben(so);
  pruefe('ids tragen Tag und Teil', auf.map((a) => a.id).join() === '2026-10-25:0,2026-10-25:1' && L.teileId('2026-10-25:1').index === 1 && L.teileId('quatsch') === null);
  pruefe('Text am Sonntag: "Teil 1 von 2 · Rätsel 7 · Sonntag"', /^Teil 1 von 2 · Rätsel 7 · Sonntag · Matt in 1$/.test(auf[0].text), auf[0].text);
  const mi = L.alsAufgaben(L.tagDaten(D, '2026-10-21'))[0];
  pruefe('Titel aus der Seite am Zug', mi.titel === 'Schwarz am Zug' && auf[0].titel === 'Weiß am Zug');
  pruefe('nur offene Teile, wenn gewuenscht', L.alsAufgaben(so, { nur: [1] }).map((a) => a.id).join() === '2026-10-25:1');
  let spielbar = true;
  const fehler = [];
  for (const t of D.tage) {
    for (const a of t.aufgaben) {
      const c = new Chess(a.fen);
      for (const u of a.loesung) {
        let m = null;
        try { m = c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }); } catch (e) { m = null; }
        if (!m) { spielbar = false; fehler.push(a.id + ' ' + u); break; }
      }
      if (a.matt && !c.isCheckmate()) { spielbar = false; fehler.push(a.id + ' kein Matt'); }
    }
  }
  pruefe('jede Beispiel-Loesung ist mit chess.js spielbar, Matt-Raetsel enden im Matt', spielbar, fehler.join(', '));

  gruppe = 'Modul';
  pruefe('kaputte Staende werden ein leeres Modul', ['x', null, 5, [], { tage: [] }, { tage: 'a' }].every((m) => JSON.stringify(L.normalisiereModul(m)) === JSON.stringify(L.leeresModul())));
  const alt = L.normalisiereModul({ tage: { '2026-10-20': { e: [[2, 1]] }, quatsch: { e: [] }, '2026-10-21': { e: [[1, 7]] } } });
  pruefe('alter Stand ohne v bleibt gueltig, falsche Eintraege fallen weg', alt.tage['2026-10-20'].e[0][0] === 2 && !alt.tage.quatsch
    && alt.tage['2026-10-21'].e[0] === null, alt);
  let m = L.leeresModul();
  let r = L.merkeErgebnis(m, '2026-10-20', 0, { fehlversuche: 1, richtig: true });
  pruefe('erstes Ergebnis wird gemerkt', r.neu && r.modul.tage['2026-10-20'].e[0].join() === '1,1');
  const r2 = L.merkeErgebnis(r.modul, '2026-10-20', 0, { fehlversuche: 0, richtig: true });
  pruefe('zweites Ergebnis derselben Aufgabe zaehlt nicht', !r2.neu && r2.modul.tage['2026-10-20'].e[0].join() === '1,1');
  m = r.modul;
  pruefe('Tag fertig nach allen Teilen', L.tagStand(m, '2026-10-20', 1).fertig && L.tagStand(m, '2026-10-20', 1).geloest);
  r = L.merkeErgebnis(m, '2026-10-25', 1, { fehlversuche: 0, richtig: false });
  pruefe('Sonntag Teil 2 zuerst: Tag noch offen, Teil 1 offen', !L.tagStand(r.modul, '2026-10-25', 2).fertig
    && L.offeneIndizes(r.modul, so).join() === '0');
  r = L.merkeErgebnis(r.modul, '2026-10-25', 0, { fehlversuche: 0, richtig: true });
  pruefe('Sonntag beide Teile: fertig, aber nicht ganz geloest (Loesung angesehen), Wiederholen zeigt beide',
    L.tagStand(r.modul, '2026-10-25', 2).fertig && !L.tagStand(r.modul, '2026-10-25', 2).geloest && L.offeneIndizes(r.modul, so).join() === '0,1');
  const ar = L.merkeErgebnis(L.leeresModul(), '2026-10-22', 0, { richtig: true }, { archiv: true });
  pruefe('im Archiv geloest: a = 1', ar.modul.tage['2026-10-22'].a === 1 && L.tagStand(ar.modul, '2026-10-22', 1).archiv);
  const ar2 = L.merkeErgebnis(r.modul, '2026-10-25', 1, { richtig: true }, { archiv: true });
  pruefe('am eigenen Tag angefangen: spaeter kein Archiv-Zeichen', !ar2.modul.tage['2026-10-25'].a);
  let w = L.merkeWort(m, '2026-10-20', true);
  w = L.merkeWort(w, '2026-10-20', false);
  pruefe('Ein Wort: die erste Antwort zaehlt', L.tagStand(w, '2026-10-20', 1).wort === 1);
  let voll = L.leeresModul();
  for (let i = 0; i < 80; i++) {
    const tag = T.addiereTage('2026-08-01', i);
    voll = L.merkeErgebnis(voll, tag, 0, { fehlversuche: 12, richtig: true }, { archiv: true }).modul;
    voll = L.merkeErgebnis(voll, tag, 1, { fehlversuche: 3, richtig: false }).modul;
    voll = L.merkeWort(voll, tag, true);
  }
  const groesse = JSON.stringify({ ...voll, v: L.RECHENSTAND }).length;
  pruefe('hoechstens 60 Tage, die aeltesten fallen weg', Object.keys(voll.tage).length === L.MAX_TAGE && !voll.tage['2026-08-01'] && !!voll.tage[T.addiereTage('2026-08-01', 79)]);
  pruefe('volles Modul passt ins Budget (MODUL_BUDGET.tagesraetsel)', MODUL_BUDGET.tagesraetsel === L.BUDGET && groesse < L.BUDGET, groesse + ' Zeichen');

  gruppe = 'Archiv';
  const heute = '2026-10-31';
  let at = L.archivTage(D, heute, L.leeresModul());
  pruefe('Archiv: die Tage vor heute, juengster zuerst, bis zum Start', at.length === 12 && at[0].tag === '2026-10-30' && at[11].tag === '2026-10-19');
  at = L.archivTage(D, heute, L.merkeErgebnis(L.leeresModul(), '2026-10-30', 0, { richtig: true }).modul);
  pruefe('Archiv: fertige Tage fehlen', at.length === 11 && at[0].tag === '2026-10-29');
  const lang = beispielDatei('2026-01-05', 20);
  pruefe('Archiv: hoechstens 30 Tage', L.archivTage(lang, '2026-05-20', L.leeresModul()).length === L.ARCHIV_TAGE);
  pruefe('Archiv vor dem Start: leer', L.archivTage(D, '2026-10-19', L.leeresModul()).length === 0);

  gruppe = 'Ein Wort';
  const gabel = { id: 'x-1', motiv: 'gabel', matt: null };
  const wahl = L.wortWahl(gabel);
  pruefe('drei verschiedene Woerter, eines ist das Motiv', wahl && wahl.length === 3 && new Set(wahl).size === 3 && wahl.includes('gabel'));
  pruefe('fuer alle gleich (aus der id)', JSON.stringify(L.wortWahl(gabel)) === JSON.stringify(wahl));
  let mattFalsch = false;
  let verteilt = new Set();
  for (let i = 0; i < 60; i++) {
    const a = { id: 'm-' + i, motiv: 'grundreihe', matt: 1 };
    const ww = L.wortWahl(a);
    if (ww.includes('matt')) mattFalsch = true;
    verteilt.add(ww.indexOf('grundreihe'));
  }
  pruefe('Matt-Raetsel: "Matt" ist nie ein falsches Wort', !mattFalsch);
  pruefe('das richtige Wort steht mal vorn, mal in der Mitte, mal hinten', verteilt.size === 3);
  pruefe('ohne Motiv: keine Frage', L.wortWahl({ id: 'x', motiv: null }) === null && L.wortWahl(null) === null);

  gruppe = 'Teilen';
  const di = L.tagDaten(D, '2026-10-22');
  const st = L.tagStand(L.merkeWort(L.merkeErgebnis(L.leeresModul(), '2026-10-22', 0, { fehlversuche: 2, richtig: true }).modul, '2026-10-22', true), '2026-10-22', 1);
  const text = L.teilText(di, st);
  pruefe('Form wie im Konzept: "Crownmate · Rätsel 4 · Donnerstag ●●●●○○○"', text.split('\n')[0] === 'Crownmate · Rätsel 4 · Donnerstag ●●●●○○○', text);
  pruefe('Zeile 2: Figur, Laenge, Kaestchen, Motiv', text.split('\n')[1] === '♛ Matt in 2 · □□■ · Motiv: Grundreihe', text);
  pruefe('ohne Link und ohne Loesung (kein Feldname, kein Zug)', !/https?:|www\.|[a-h][1-8]/.test(text));
  const ohneWort = L.teilText(di, L.tagStand(L.merkeErgebnis(L.leeresModul(), '2026-10-22', 0, { fehlversuche: 0, richtig: false }).modul, '2026-10-22', 1));
  pruefe('ohne richtiges Ein Wort kein Motiv, Loesung angesehen als ✕', ohneWort.split('\n')[1] === '♛ Matt in 2 · ✕', ohneWort);
  const sonntag = L.teilText(so, L.tagStand(r.modul, '2026-10-25', 2));
  pruefe('Sonntag: hoechste Stufe, zwei Teile, Kaestchen je Teil', /^Crownmate · Rätsel 7 · Sonntag ●●●●●●○\n♛ Matt in 1 · zwei Teile · ■ ✕$/.test(sonntag), sonntag);
  pruefe('Schwarz am Zug: Figur des ersten Zugs (Turm)', L.figurDesErstenZugs(L.tagDaten(D, '2026-10-21').aufgaben[0]) === 'r');

  gruppe = 'Regeln';
  const logik = lies('js/pakete/tagesraetsel/logik.js');
  pruefe('Logik ohne Zufall und ohne Uhr (Code ohne Kommentare)', !/Math\.random|Date\.now|new Date\(/.test(logik.replace(/\/\/.*$/gm, '')));
  const css = lies('css/pakete/tagesraetsel.css');
  pruefe('CSS nur mit Tokens (keine festen Farben)', !/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/.test(css));
  const texte = [logik, lies('js/pakete/tagesraetsel/index.js')].join('\n');
  pruefe('keine langen Gedankenstriche, keine Countdowns in den Texten', !/[—–]/.test(texte) && !/noch \d+ ?(h|Min|Stunden)/.test(texte));
  pruefe('keine fremde Raetsel-Quelle im Paket', !/lichess|chess\.com/i.test(texte));

  gruppe = 'Echte Datei';
  const datei = path.join(WURZEL, 'daten/tagesraetsel/raetsel.json');
  if (existsSync(datei)) {
    const json = JSON.parse(readFileSync(datei, 'utf8'));
    const { pruefeKopf, RECHENSTAND } = await import('../js/inhalte.js');
    const k = pruefeKopf(json, { art: 'tagesraetsel' });
    pruefe('Kopf gueltig (art tagesraetsel, Rechenstand der App)', k.ok && json.kopf.rechenstand <= RECHENSTAND, k);
    pruefe('Inhalt gueltig (pruefeDatei)', L.pruefeDatei(json).length === 0, L.pruefeDatei(json));
    pruefe('Laenge in ganzen Wochen, mindestens 18', json.tage.length % 7 === 0 && json.tage.length >= 126, json.tage.length);
    pruefe('heute (24.10.2026) gibt es ein Raetsel', !!L.tagDaten(json, '2026-10-24'));
    pruefe('Datei unter 120 KB', statSync(datei).size < 120 * 1024, statSync(datei).size);
  } else {
    pruefe('daten/tagesraetsel/raetsel.json fehlt noch', false);
  }
  gruppe = '';
}

// ---------------------------------------------------------------------
// Browser
// ---------------------------------------------------------------------
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
    try { const r = await fetch(url); if (r.ok) return; } catch (e) { /* noch nicht da */ }
    await warte(150);
  }
  throw new Error('Server startet nicht: ' + url);
}

let DATEI_BROWSER = null;
async function neueSeite(browser, { w = 1180, h = 820, handy = false, dunkel = false, datei = 'beispiel' } = {}) {
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
    if (datei === 'fehlt' && /tagesraetsel\/raetsel\.json/.test(url + m.text())) return;
    fehler.push(m.text() + (url ? ' @ ' + url : ''));
  });
  seite.on('pageerror', (e) => fehler.push('Seitenfehler: ' + e.message));
  await seite.route('**/daten/tagesraetsel/raetsel.json*', (route) => (datei === 'fehlt'
    ? route.fulfill({ status: 404, body: 'fehlt' })
    : route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(DATEI_BROWSER) })));
  return { kontext, seite, fehler };
}

const bild = async (seite, name) => { if (OHNE_BILDER) return; await warte(650); await seite.screenshot({ path: path.join(BILDER, name + '.png') }); };

async function bereite(seite, { modul = null } = {}, hash = '#training') {
  await seite.goto(BASIS + '#arena');
  await seite.evaluate(({ modul, key }) => {
    localStorage.clear();
    if (modul != null) localStorage.setItem(key, typeof modul === 'string' ? modul : JSON.stringify(modul));
  }, { modul, key: MODUL_KEY });
  await seite.goto(BASIS + hash);
  await seite.reload();
  const ziel = { '#arena': '.screen.arena', '#training': '.screen.training-screen' }[hash] || '#app > .screen:not(.lade-screen)';
  await seite.waitForFunction((sel) => !!window.__app && !!document.querySelector('link[data-paket="tagesraetsel"]') && !!document.querySelector(sel), ziel, { timeout: 20000 });
}

const tz = (seite) => seite.evaluate(() => window.__tagesraetsel.zustand());
async function feld(seite, f) {
  const b = await seite.locator(`.screen.rs-screen .brett-felder .feld[data-feld="${f}"]`).boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}
async function ziehe(seite, uci, { handy = false } = {}) {
  for (const f of [uci.slice(0, 2), uci.slice(2, 4)]) {
    const p = await feld(seite, f);
    if (handy) await seite.touchscreen.tap(p.x, p.y);
    else await seite.mouse.click(p.x, p.y);
    await warte(90);
  }
}
async function warteZustand(seite, fn, ms = 8000) {
  await seite.waitForFunction((f) => {
    const z = window.__raetsel ? window.__raetsel.zustand() : { offen: false };
    return new Function('z', 'return ' + f)(z);
  }, fn, { timeout: ms });
}
// ein legaler Zug, der nicht die Loesung ist (fuer den Fehlversuch)
const falscherZug = (seite, fen, loesung) => seite.evaluate(async ([f, l]) => {
  const { Chess } = await import('/vendor/chess/chess.js');
  const m = new Chess(f).moves({ verbose: true }).find((x) => x.from + x.to !== l.slice(0, 4) && !x.promotion);
  return m ? m.from + m.to : null;
}, [fen, loesung]);

// Loest die laufende Aufgabe (eigene Zuege, Antworten des Gegners abwarten)
async function loese(seite, a, { handy = false } = {}) {
  for (let i = 0; i < a.loesung.length; i += 2) {
    await warteZustand(seite, `z.phase === "flo" && z.schritt === ${i}`);
    await ziehe(seite, a.loesung[i], { handy });
  }
  await warteZustand(seite, 'z.phase === "geloest"');
}

async function keinUeberlauf(seite) {
  return seite.evaluate(() => {
    const se = document.scrollingElement;
    const zuBreit = [...document.querySelectorAll('.tr-karte, .tr-karte *, .tr-heute, .tr-heute *, .rs-ende-karte, .rs-ende-karte *')]
      .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && (r.right > innerWidth + 1 || r.left < -1); })
      .map((el) => el.className || el.tagName);
    return { ok: se.scrollWidth <= innerWidth + 1 && zuBreit.length === 0, zuBreit: zuBreit.slice(0, 4), breite: se.scrollWidth };
  });
}

async function browserTeil(browser) {
  if (!OHNE_BILDER) mkdirSync(BILDER, { recursive: true });
  const T = await import('../js/tag.js');
  const heute = T.tagSchluessel();
  // Start zwei Montage vor heute: heute ist Tag 7 bis 13, das Archiv hat 7 bis 13 Tage
  const start = T.addiereTage(T.wochenSchluessel(), -7);
  DATEI_BROWSER = beispielDatei(start, 3, { ohneMotiv: false });

  // ---------- iPad quer, hell: der ganze Ablauf ----------
  gruppe = 'iPad hell';
  const { kontext, seite, fehler } = await neueSeite(browser);
  await bereite(seite);
  await seite.waitForSelector('.training-gitter .tr-karte h2', { timeout: 10000 });
  let z = await tz(seite);
  const td = z.td;
  pruefe('Daten geladen, heute ist Tag ' + (td && td.nummer), z.geladen && td && td.tag === heute && td.nummer === T.tageZwischen(start, heute) + 1);
  const karte = await seite.evaluate(() => {
    const k = document.querySelector('.tr-karte');
    return { h2: k.querySelector('h2').textContent, mini: !!k.querySelector('.mini'), los: !!k.querySelector('.tr-los'),
      archiv: (k.querySelector('.tr-archiv') || {}).textContent || '', punkte: (k.querySelector('.tr-punkte') || {}).textContent || '',
      held: k.classList.contains('t-held'), gross: k.classList.contains('ist-gross') };
  });
  pruefe('Karte im Training: "Rätsel N", Mini-Brett, Lösen, Schwierigkeit als Punkte', karte.h2 === `Rätsel ${td.nummer}` && karte.mini && karte.los
    && /^[●○]{7}$/.test(karte.punkte) && karte.held, karte);
  pruefe('Archiv-Knopf mit der Zahl offener Tage', karte.archiv === `Archiv · ${td.nummer - 1}`, karte.archiv);
  await bild(seite, 'ipad-hell-training');

  await seite.evaluate(() => { location.hash = '#arena'; });
  await seite.waitForSelector('.screen.arena', { timeout: 10000 });
  const zeile = await seite.waitForSelector('.heute-karte:not([hidden]) .tr-heute', { timeout: 8000 }).then(() => true, () => false);
  pruefe('Zeile in der Heute-Karte der Arena', zeile && /Rätsel \d+/.test(await seite.locator('.tr-heute-text').textContent()));

  // Ereignisse mitschreiben
  await seite.evaluate(async () => {
    const E = await import('/js/ereignisse.js');
    window.__tr_ev = [];
    E.hoere('raetsel:geloest', (d) => window.__tr_ev.push(d));
  });
  await seite.locator('.tr-heute-los').click();
  await warteZustand(seite, 'z.offen && z.quelle === "tagesraetsel" && z.phase === "flo"');
  let rz = await seite.evaluate(() => window.__raetsel.zustand());
  pruefe('Lösen öffnet den Rätsel-Bildschirm mit den Aufgaben von heute', rz.gesamt === td.aufgaben.length && rz.aufgabe === `${heute}:0`, rz);
  const kopf = await seite.evaluate(() => document.querySelector('.rs-screen').textContent);
  pruefe('Kopf "Tagesrätsel", Text mit Rätsel-Nummer', /Tagesrätsel/.test(kopf) && kopf.includes(`Rätsel ${td.nummer}`));
  // erster Teil: ein Fehlversuch, dann richtig
  const a0 = td.aufgaben[0];
  const falsch = await falscherZug(seite, a0.fen, a0.loesung[0]);
  await ziehe(seite, falsch);
  await warteZustand(seite, 'z.fehlversuche === 1');
  await loese(seite, a0);
  z = await tz(seite);
  pruefe('Ergebnis im Modul: [1 Fehlversuch, richtig]', JSON.stringify(z.modul.tage[heute].e[0]) === '[1,1]', z.modul);
  let ev = await seite.evaluate(() => window.__tr_ev);
  pruefe('raetsel:geloest mit id der Datei, quelle tagesraetsel, versuch 2', ev.length === 1 && ev[0].id === a0.id && ev[0].quelle === 'tagesraetsel'
    && ev[0].richtig === true && ev[0].versuch === 2, ev);
  for (let i = 1; i < td.aufgaben.length; i++) {
    await seite.locator('.rs-weiter').click();
    await loese(seite, td.aufgaben[i]);
  }
  await seite.locator('.rs-weiter').click();
  await warteZustand(seite, 'z.phase === "ende"');
  const ende = await seite.evaluate(() => ({ titel: document.querySelector('.rs-ende h2').textContent,
    knoepfe: [...document.querySelectorAll('.rs-ende-knoepfe button')].map((b) => b.textContent.trim()) }));
  pruefe('Ende: "Rätsel N geschafft", Knöpfe Ein Wort, Teilen, Fertig', ende.titel === `Rätsel ${td.nummer} geschafft`
    && ende.knoepfe.join('|') === 'Ein Wort|Teilen|Fertig', ende);
  await bild(seite, 'ipad-hell-ende');
  pruefe('kein Überlauf (Ende)', (await keinUeberlauf(seite)).ok);

  // Ein Wort
  await seite.locator('.rs-ende-knoepfe button', { hasText: 'Ein Wort' }).click();
  await seite.waitForSelector('.dialog-ort .dialog-knoepfe button', { timeout: 5000 });
  const worte = await seite.evaluate(() => [...document.querySelectorAll('.dialog-ort .dialog-knoepfe button')].map((b) => b.textContent));
  const L = await import('../js/pakete/tagesraetsel/logik.js');
  const motivAufgabe = td.aufgaben.find((a) => a.motiv);
  const richtigesWort = L.MOTIVE[motivAufgabe.motiv];
  pruefe('Ein Wort: drei Wörter, eines davon richtig', worte.length === 3 && worte.includes(richtigesWort), worte);
  await bild(seite, 'ipad-hell-einwort');
  await seite.locator('.dialog-ort .dialog-knoepfe button', { hasText: richtigesWort }).click();
  await seite.waitForFunction(() => /Richtig/.test((document.querySelector('.toast-ort') || {}).textContent || ''), null, { timeout: 5000 });
  z = await tz(seite);
  pruefe('Ein Wort richtig: Meldung und w = 1 im Modul', z.modul.tage[heute].w === 1 && z.letztesWort && z.letztesWort.richtig);

  // Teilen
  await seite.locator('.rs-ende-knoepfe button', { hasText: 'Teilen' }).click();
  await seite.waitForFunction(() => window.__tagesraetsel.zustand().letzterTeilText, null, { timeout: 5000 });
  z = await tz(seite);
  const zeilen = String(z.letzterTeilText).split('\n');
  pruefe('Teilen-Text: zwei Zeilen, Name, Nummer, Wochentag, Punkte', zeilen.length === 2
    && new RegExp(`^Crownmate · Rätsel ${td.nummer} · ${L.WOCHENTAG[td.wochentag]} [●○]{7}$`).test(zeilen[0]), z.letzterTeilText);
  pruefe('Teilen-Text: Kästchen und Motiv, ohne Link und ohne Lösung', zeilen[1].includes('□■') && zeilen[1].includes(`Motiv: ${richtigesWort}`)
    && !/https?:|[a-h][1-8]/.test(z.letzterTeilText), zeilen[1]);
  // Zwischenablage oder Dialog mit dem Text
  const dialog = await seite.waitForSelector('.dialog-ort', { timeout: 1500 }).then(() => true, () => false);
  if (dialog) { await seite.locator('.dialog-ort .dialog-knoepfe button').click(); await warte(300); }

  // Karte danach
  await seite.locator('.rs-ende-knoepfe .rs-fertig').click();
  await seite.evaluate(() => { location.hash = '#training'; });
  await seite.waitForSelector('.tr-karte[data-fertig="1"]', { timeout: 10000 });
  const nachher = await seite.evaluate(() => ({ p: document.querySelector('.tr-karte p').textContent, teilen: !!document.querySelector('.tr-karte .tr-teilen'),
    los: !!document.querySelector('.tr-karte .tr-los') }));
  pruefe('Karte danach: "Gelöst. Morgen kommt das nächste.", Teilen statt Lösen', nachher.p === 'Gelöst. Morgen kommt das nächste.' && nachher.teilen && !nachher.los, nachher);
  await seite.evaluate(() => { location.hash = '#arena'; });
  await seite.waitForSelector('.screen.arena', { timeout: 10000 });
  await warte(400);
  pruefe('Heute-Zeile ist nach dem Lösen weg', await seite.locator('.tr-heute').count() === 0);

  // Archiv
  await seite.evaluate(() => { location.hash = '#training'; });
  await seite.waitForSelector('.tr-karte .tr-archiv', { timeout: 10000 });
  await seite.locator('.tr-karte .tr-archiv').click();
  await warteZustand(seite, 'z.offen && z.quelle === "tagesraetsel" && z.phase === "flo"');
  rz = await seite.evaluate(() => window.__raetsel.zustand());
  const gestern = T.addiereTage(heute, -1);
  const archivTage = L.archivTage(DATEI_BROWSER, heute, { v: 1, tage: {} });
  const archivAufgaben = archivTage.reduce((s, t) => s + t.aufgaben.length, 0);
  pruefe('Archiv: alle offenen Aufgaben der letzten Tage, gestern zuerst', rz.gesamt === archivAufgaben && rz.aufgabe === `${gestern}:0`, rz);
  const ag = L.tagDaten(DATEI_BROWSER, gestern).aufgaben[0];
  await loese(seite, ag);
  z = await tz(seite);
  ev = await seite.evaluate(() => window.__tr_ev);
  pruefe('Archiv: Ergebnis mit a = 1, Ereignis quelle tagesraetsel-archiv', z.modul.tage[gestern].a === 1 && z.modul.tage[gestern].e[0][1] === 1
    && ev[ev.length - 1].quelle === 'tagesraetsel-archiv' && ev[ev.length - 1].id === ag.id, { tag: z.modul.tage[gestern], ev: ev[ev.length - 1] });
  pruefe('heute bleibt unverändert', JSON.stringify(z.modul.tage[heute].e[0]) === '[1,1]');
  pruefe('keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
  await kontext.close();

  // ---------- Darstellung: hell und dunkel, iPad quer und Handy hoch ----------
  for (const [name, opt] of [['iPad dunkel', { dunkel: true }], ['Handy hell', { w: 390, h: 844, handy: true }], ['Handy dunkel', { w: 390, h: 844, handy: true, dunkel: true }]]) {
    gruppe = name;
    const s = await neueSeite(browser, opt);
    await bereite(s.seite);
    await s.seite.waitForSelector('.tr-karte .tr-los', { timeout: 10000 });
    const ue = await keinUeberlauf(s.seite);
    pruefe('Karte ohne Überlauf', ue.ok, ue);
    const lesbar = await s.seite.evaluate(() => {
      const k = document.querySelector('.tr-karte');
      const h = getComputedStyle(k.querySelector('h2')).color;
      const bg = getComputedStyle(k).backgroundColor;
      return { h, bg, verschieden: h !== bg };
    });
    pruefe('Titel hebt sich vom Hintergrund ab', lesbar.verschieden, lesbar);
    const slug = name.toLowerCase().replace(/\s+/g, '-');
    await bild(s.seite, slug + '-training');
    await s.seite.locator('.tr-karte .tr-los').click();
    await warteZustand(s.seite, 'z.offen && z.phase === "flo"');
    const tdh = (await tz(s.seite)).td;
    for (let i = 0; i < tdh.aufgaben.length; i++) {
      if (i) await s.seite.locator('.rs-weiter').click();
      await loese(s.seite, tdh.aufgaben[i], { handy: !!opt.handy });
    }
    await s.seite.locator('.rs-weiter').click();
    await warteZustand(s.seite, 'z.phase === "ende"');
    const ue2 = await keinUeberlauf(s.seite);
    pruefe('Ende ohne Überlauf, Knöpfe sichtbar', ue2.ok && await s.seite.locator('.rs-ende-knoepfe button', { hasText: 'Teilen' }).isVisible(), ue2);
    await bild(s.seite, slug + '-ende');
    pruefe('keine Konsolenfehler', s.fehler.length === 0, s.fehler.join(' | '));
    await s.kontext.close();
  }

  // ---------- Speicher: neuere App, kaputt ----------
  gruppe = 'Speicher';
  const neu = await neueSeite(browser);
  const fremd = { v: 99, tage: { [heute]: { e: [] } }, zukunft: { x: 1 } };
  await bereite(neu.seite, { modul: fremd });
  await neu.seite.locator('.tr-karte .tr-los').click();
  await warteZustand(neu.seite, 'z.offen && z.phase === "flo"');
  await loese(neu.seite, DATEI_BROWSER.tage[T.tageZwischen(start, heute)].aufgaben[0]);
  const roh = await neu.seite.evaluate((k) => JSON.parse(localStorage.getItem(k)), MODUL_KEY);
  pruefe('Modul einer neueren App wird gelesen, aber nie überschrieben', roh.v === 99 && roh.zukunft && roh.zukunft.x === 1 && roh.tage[heute].e.length === 0, roh);
  await neu.kontext.close();
  const kap = await neueSeite(browser);
  await bereite(kap.seite, { modul: '{"v":1,"tage":[1,2' });
  const kapKarte = await kap.seite.waitForSelector('.tr-karte .tr-los', { timeout: 10000 }).then(() => true, () => false);
  pruefe('kaputtes Modul: Karte steht trotzdem, Lösen geht', kapKarte);
  pruefe('keine Seitenfehler', !kap.fehler.some((f) => /Seitenfehler/.test(f)), kap.fehler.join(' | '));
  await kap.kontext.close();

  // ---------- ohne Datei ----------
  gruppe = 'Ohne Datei';
  const ohne = await neueSeite(browser, { datei: 'fehlt' });
  await bereite(ohne.seite);
  await ohne.seite.waitForFunction(() => /jeden Tag ein Rätsel/.test((document.querySelector('.tr-karte h2') || {}).textContent || ''), null, { timeout: 10000 });
  pruefe('ruhige Karte statt Fehler', await ohne.seite.locator('.tr-karte .tr-los').count() === 0);
  await ohne.seite.evaluate(() => { location.hash = '#arena'; });
  await ohne.seite.waitForSelector('.screen.arena', { timeout: 10000 });
  pruefe('keine Heute-Zeile', await ohne.seite.locator('.tr-heute').count() === 0);
  pruefe('keine Konsolenfehler (bis auf die fehlende Datei)', ohne.fehler.length === 0, ohne.fehler.join(' | '));
  await ohne.kontext.close();
  gruppe = '';
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
