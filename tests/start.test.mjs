// Tests fuer das Paket "start" (Welle A, A4: Willkommen, erste 5 Minuten, Einstufungstest; SPIELKONZEPT 3.16, 3.12).
// Node-Teil ohne Browser: Regel-Aufgaben (je Figur eine, genau ein Zug erreicht das Ziel, mit der genannten Figur),
// Einstufung (8 Aufgaben, steigende Stufen, jede Loesung mit chess.js geprueft und eindeutig: Suche mit Material und Matt,
// Antworten des Gegners erzwungen), Punkte und Empfehlung (Tabelle, hoechstens Professor Turm, Probepartie nur ueber der
// Leiter), Begruendung, Entdeckungs-Fahrplan (hoechstens einer je Tag, erst nach der ersten Partie, benutzt, erfahren,
// Ende, aus), erster Screen, erster Sieg, Modul robust, Dateien (kein Math.random, keine Uhr, CSS nur Tokens), Offline-Cache.
// Danach Browser-Teil (Playwright, Chromium) gegen die echte App mit ?test&erw=pakete/start/index: erster Start zeigt
// Willkommen, zweiter nicht, nicht mit gespeicherter Partie; Seiten, Ueberspringen, Pfeiltasten, "Ich kenne mich aus";
// Regel-Hilfe (Punkte am Brett, falscher Zug, alle Figuren, Ende, Rueckweg); Einstufung mit festen Antworten -> Lisa Laeufer
// als Probepartie (Modus frei), Leiter-Knopf, freigeschaltet ohne Probe; Heute-Karte "Neu fuer dich" (nach der ersten
// Partie, einer je Tag, Ausblenden, naechster Tag, abschaltbar); Gruppe "Erste Schritte"; erster Sieg als Feier-Zeile;
// Laden ueber PAKETE ohne ?test; Bilder 1180 x 820 und 390 x 844, hell und dunkel.
//
//   node tests/start.test.mjs                 alles
//   node tests/start.test.mjs --nur-node      ohne Browser
//   node tests/start.test.mjs --ohne-bilder   ohne Bildschirmfotos
//   PORT=9700 BILDER=<ordner> node tests/start.test.mjs
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
const PORT = Number(process.env.PORT || 8867);
const ERW = 'pakete/start/index';
const BASIS = `http://127.0.0.1:${PORT}/index.html?test&erw=${ERW}`;
const NUR_NODE = process.argv.includes('--nur-node');
const OHNE_BILDER = process.argv.includes('--ohne-bilder');
// Bilder nie ins Repo (REGELN): Standard ist ein Ordner unter dem Temp-Verzeichnis
const BILDER = process.env.BILDER || path.join(os.tmpdir(), 'crownmate-bilder', 'start');
const lies = (d) => readFileSync(path.join(WURZEL, d), 'utf8');
const warte = (ms) => new Promise((r) => setTimeout(r, ms));
const P = 'schach-arena:v1:';

const ergebnisse = [];
let gruppe = '';
function pruefe(name, ok, detail = '') {
  ergebnisse.push({ name: (gruppe ? gruppe + ': ' : '') + name, ok: !!ok, detail });
  console.log(`${ok ? 'ok  ' : 'FEHLER'} ${gruppe ? gruppe + ': ' : ''}${name}${!ok && detail ? ' (' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) + ')' : ''}`);
}

// ---------- Pruefer fuer Aufgaben: Alpha-Beta mit Material und Matt (chess.js, interne Zuggenerierung) ----------
const WERT = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const MATT = 1000;
function material(c) {
  let s = 0;
  for (let i = 0; i < 128; i++) {
    if (i & 0x88) { i += 7; continue; }
    const f = c._board[i];
    if (f) s += (f.color === 'w' ? 1 : -1) * WERT[f.type];
  }
  return s;
}
// Wert aus Sicht der Seite am Zug; tiefe <= 0: Ruhesuche (nur Schlagzuege und Umwandlungen)
function suche(c, tiefe, a, b, ply) {
  const zuege = c._moves({ legal: true });
  if (!zuege.length) return c.inCheck() ? -MATT + ply : 0;
  if (tiefe <= 0) {
    const steh = (c.turn() === 'w' ? 1 : -1) * material(c);
    if (tiefe < -6) return steh;
    let best = steh;
    if (best > a) a = best;
    if (a >= b) return best;
    const sz = zuege.filter((m) => m.captured || m.promotion).sort((x, y) => (y.captured ? WERT[y.captured] : 0) - (x.captured ? WERT[x.captured] : 0));
    for (const m of sz) {
      c._makeMove(m);
      const v = -suche(c, tiefe - 1, -b, -a, ply + 1);
      c._undoMove();
      if (v > best) best = v;
      if (v > a) a = v;
      if (a >= b) break;
    }
    return best;
  }
  zuege.sort((x, y) => (y.captured ? WERT[y.captured] : 0) + (y.promotion ? 8 : 0) - ((x.captured ? WERT[x.captured] : 0) + (x.promotion ? 8 : 0)));
  let best = -Infinity;
  for (const m of zuege) {
    c._makeMove(m);
    const v = -suche(c, tiefe - 1, -b, -a, ply + 1);
    c._undoMove();
    if (v > best) best = v;
    if (v > a) a = v;
    if (a >= b) break;
  }
  return best;
}
const feldName = (i) => 'abcdefgh'[i & 15] + (8 - (i >> 4));
// alle Zuege der Stellung mit ihrem Wert (volles Fenster je Zug, damit auch der zweitbeste genau ist)
function bewerteAlle(Chess, fen, tiefe) {
  const c = new Chess(fen);
  const aus = [];
  for (const m of c._moves({ legal: true })) {
    c._makeMove(m);
    const v = -suche(c, tiefe - 1, -Infinity, Infinity, 1);
    c._undoMove();
    aus.push({ uci: feldName(m.from) + feldName(m.to) + (m.promotion || ''), v });
  }
  return aus.sort((x, y) => y.v - x.v);
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
  const L = await import('../js/pakete/start/logik.js');
  const A = await import('../js/pakete/start/aufgaben.js');
  const T = await import('../js/tag.js');
  const { Chess } = await import('../vendor/chess/chess.js');
  const { QUELLEN } = await import('../js/feier.js');
  const { EREIGNISSE } = await import('../js/ereignisse.js');
  const { ORTE } = await import('../js/orte.js');
  const { BOTS } = await import('../js/bots.js');

  gruppe = 'Grundwerte';
  pruefe('Modul "start" im Budget (6.000 Zeichen), Paket rechnet mit demselben Wert', storage.MODUL_BUDGET.start === 6000 && L.BUDGET === 6000 && L.MODUL === 'start'
    && L.RECHENSTAND === 1);
  pruefe('Orte app:erster-screen? (Wahl), arena:heute und einstellungen:gruppen (DOM), Ereignisse app:bereit, app:screen, partie:beendet',
    ORTE['app:erster-screen?'] === 'wahl' && ORTE['arena:heute'] === 'dom' && ORTE['einstellungen:gruppen'] === 'dom'
    && ['app:bereit', 'app:screen', 'partie:beendet'].every((e) => EREIGNISSE.includes(e)));
  pruefe('Feier-Quelle "erster-sieg" ist gross mit Prio 95 (SPIELKONZEPT 3.10)', QUELLEN['erster-sieg'] && QUELLEN['erster-sieg'].art === 'gross' && QUELLEN['erster-sieg'].prio === 95);
  pruefe('Wahl-Ort hinter Paketen mit eigener Wahl (Reihenfolge 80 > Standard 50)', L.WAHL_REIHENFOLGE === 80);
  const app = lies('js/app.js');
  pruefe('app.js unveraendert: start ist ein Paket-Screen (fehlt die Datei, geht es zur Arena), modus frei gibt es', /PAKET_SCREENS = new Set\(\[[^\]]*'start'/.test(app)
    && storage.MODI.includes('frei') && !storage.wertet({ modus: 'frei', botId: 'lisa' }));

  // ---------- Regel-Hilfe ----------
  gruppe = 'Regel-Hilfe';
  const R = A.REGEL_AUFGABEN;
  pruefe('je Figur eine Aufgabe (König, Dame, Turm, Läufer, Springer, Bauer) und das Matt als Ziel', R.length === 7
    && ['k', 'q', 'r', 'b', 'n', 'p'].every((f) => R.some((a) => a.figur === f && a.ziel !== 'matt')) && R.some((a) => a.ziel === 'matt'), R.map((a) => a.figur + ':' + a.ziel));
  for (const a of R) {
    let c = null;
    try { c = new Chess(a.fen); } catch (e) { c = null; }
    const zuege = c ? c.moves({ verbose: true }) : [];
    const treffer = zuege.filter((m) => {
      if (a.ziel === 'matt') { c.move(m); const mt = c.isCheckmate(); c.undo(); return mt; }
      return m.to === a.ziel && !!m.captured;
    });
    pruefe(`${a.id}: gueltige Stellung, Weiss am Zug, nicht im Schach, genau ein Zug erreicht das Ziel (${a.ziel}), mit der genannten Figur, und er ist die Loesung`,
      c && c.turn() === 'w' && !c.inCheck() && treffer.length === 1 && treffer[0].piece === a.figur && treffer[0].lan === a.loesung[0] && a.loesung.length === 1,
      treffer.map((m) => m.lan));
  }
  const textOk = (a) => a.titel && a.titel.length <= 80 && a.text && a.text.length <= 240 && a.hinweis && a.hinweis.length <= 200 && a.erklaerung && a.erklaerung.length <= 240;
  pruefe('Texte passen in den Raetsel-Bildschirm (Titel 80, Text 240, Hinweis 200, Erklaerung 240 Zeichen), IDs eindeutig',
    [...R, ...A.EINSTUFUNG].every(textOk) && new Set([...R, ...A.EINSTUFUNG].map((a) => a.id)).size === R.length + A.EINSTUFUNG.length,
    [...R, ...A.EINSTUFUNG].filter((a) => !textOk(a)).map((a) => a.id));
  pruefe('Quelle dokumentiert: selbst erstellt', /Quelle aller Stellungen: selbst erstellt/.test(lies('js/pakete/start/aufgaben.js')));

  // ---------- Einstufung: 8 Aufgaben, eindeutige Loesungen ----------
  gruppe = 'Einstufung';
  const E = A.EINSTUFUNG;
  pruefe('8 Aufgaben mit steigender Schwierigkeit (Stufe 1 bis 8), Themen wie im Auftrag: Matt in 1, Material, Gabel, Fesselung, Endspiel',
    E.length === 8 && E.every((a, i) => a.stufe === i + 1) && ['die Gabel', 'die Fesselung', 'das Endspiel', 'den Spieß', 'das Matt in 2'].every((t) => E.some((a) => a.thema === t))
    && E.filter((a) => a.titel === 'Matt in 1').length === 2, E.map((a) => a.thema));
  const t0 = Date.now();
  for (const a of E) {
    let c = null;
    try { c = new Chess(a.fen); } catch (e) { c = null; }
    if (!c) { pruefe(`${a.id}: gueltige Stellung`, false, a.fen); continue; }
    // vorZug (falls da) passt zur Stellung: die Figur steht auf dem Zielfeld, das Startfeld ist leer
    const vz = !a.vorZug || (c.get(a.vorZug.slice(2, 4)) && !c.get(a.vorZug.slice(0, 2)));
    const tiefe = a.id === 'stufe-8' ? 7 : 4;
    let eindeutig = true;
    let erzwungen = true;
    const belege = [];
    const spiel = new Chess(a.fen);
    for (let i = 0; i < a.loesung.length; i++) {
      const u = a.loesung[i];
      if (i % 2 === 1) {
        // Antwort des Gegners: einziger legaler Zug
        const m = spiel.moves({ verbose: true });
        if (m.length !== 1 || m[0].lan !== u) erzwungen = false;
      } else {
        const werte = bewerteAlle(Chess, spiel.fen(), Math.max(2, tiefe - i));
        const best = werte[0];
        const zweiter = werte[1] || { v: -Infinity, uci: '-' };
        const matt = best.v > MATT / 2;
        const ok = best.uci === u && (matt ? zweiter.v <= MATT / 2 || zweiter.v < best.v : best.v - zweiter.v >= 2);
        belege.push(`${u}: ${best.uci}=${best.v} / ${zweiter.uci}=${zweiter.v}`);
        if (!ok) eindeutig = false;
      }
      spiel.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
    }
    const mattThema = /^Matt/.test(a.titel);
    pruefe(`${a.id} (${a.thema}): Stellung gueltig, ${a.loesung.length > 1 ? 'Antwort erzwungen, ' : ''}jeder eigene Zug der einzige beste (Tiefe ${tiefe})${mattThema ? ', endet im Matt' : ''}`,
      vz && eindeutig && erzwungen && (!mattThema || spiel.isCheckmate()), belege.join(' | '));
  }
  pruefe('Pruefung der Einstufung in vertretbarer Zeit (unter 60 s)', Date.now() - t0 < 60000, `${Date.now() - t0} ms`);
  pruefe('Schwarz am Zug in Aufgabe 3 (das Brett wird gedreht), sonst Weiss', E.filter((a) => new Chess(a.fen).turn() === 'b').map((a) => a.id).join() === 'stufe-3');

  // ---------- Punkte und Empfehlung ----------
  gruppe = 'Empfehlung';
  pruefe('Punkte je Aufgabe: erster Versuch 1, spaeter geloest 0,5, Loesung gezeigt 0', L.punkteVon({ richtig: true, versuch: 1 }) === 1
    && L.punkteVon({ richtig: true, versuch: 2 }) === 0.5 && L.punkteVon({ richtig: true, versuch: 3 }) === 0.5 && L.punkteVon({ richtig: false, versuch: 0, loesungGezeigt: true }) === 0
    && L.punkteVon(null) === 0);
  const tabelle = [[0, 'benno'], [1, 'benno'], [1.5, 'benno'], [2, 'hilde'], [3, 'hilde'], [3.5, 'kalle'], [4.5, 'kalle'], [5, 'lisa'], [5.5, 'lisa'], [6, 'lisa'],
    [6.5, 'rudi'], [7, 'rudi'], [7.5, 'turm'], [8, 'turm'], [99, 'turm'], [-3, 'benno'], [NaN, 'benno']];
  pruefe('Tabelle Punkte -> Bot (0 bis 1,5 Benno, bis 3 Hilde, bis 4,5 Kalle, bis 6 Lisa, bis 7 Rudi, darueber Professor Turm)',
    tabelle.every(([p, b]) => L.botFuerPunkte(p) === b), tabelle.filter(([p, b]) => L.botFuerPunkte(p) !== b));
  const stufe = (id) => BOTS.find((b) => b.id === id).stufe;
  let monoton = true;
  for (let p = 0; p <= 8; p += 0.5) if (stufe(L.botFuerPunkte(p + 0.5)) < stufe(L.botFuerPunkte(p))) monoton = false;
  pruefe('mehr Punkte nie ein schwaecherer Bot; hoechstens Professor Turm (Stufe 6): 8 Aufgaben sagen ueber die oberen Stufen zu wenig',
    monoton && Math.max(...[0, 1, 2, 3, 4, 5, 6, 7, 8].map((p) => stufe(L.botFuerPunkte(p)))) === 6);
  pruefe('jeder Bot der Tabelle steht auf der Leiter (sonst nimmt botFuerPunkte den naechstschwaecheren)', L.EMPFEHLUNG.every((x) => BOTS.some((b) => b.id === x.botId)),
    L.EMPFEHLUNG.filter((x) => !BOTS.some((b) => b.id === x.botId)).map((x) => x.botId));
  const fest = [...['stufe-1', 'stufe-2', 'stufe-3', 'stufe-4'].map((id) => ({ id, richtig: true, versuch: 1 })), { id: 'stufe-5', richtig: true, versuch: 2 },
    { id: 'stufe-6', richtig: false, versuch: 0, loesungGezeigt: true }, { id: 'stufe-7', richtig: true, versuch: 1 }, { id: 'stufe-8', richtig: false, versuch: 1, loesungGezeigt: true }];
  const e1 = L.empfehlung({ ergebnisse: fest, hoechsteFrei: 1 });
  pruefe('feste Antworten (4 + 1 im zweiten Versuch + Matt in 2, zweimal Loesung gezeigt) = 5,5 Punkte -> Lisa Laeufer', e1.punkte === 5.5 && e1.botId === 'lisa'
    && e1.geloest === 6 && e1.ersterVersuch === 5 && e1.gesamt === 8 && e1.stufe === 4, e1);
  pruefe('nur Benno frei: Lisa nur als Probepartie; mit Lisa frei (Stufe 4): normale Partie', e1.probe === true && L.empfehlung({ ergebnisse: fest, hoechsteFrei: 4 }).probe === false
    && L.empfehlung({ ergebnisse: fest, hoechsteFrei: 7 }).probe === false);
  const e0 = L.empfehlung({ ergebnisse: [], hoechsteFrei: 1 });
  pruefe('ohne geloeste Aufgabe: Bauer Benno, nie eine Probepartie (Stufe 1 ist immer frei)', e0.botId === 'benno' && e0.probe === false && e0.punkte === 0 && e0.geloest === 0);
  const alle = L.empfehlung({ ergebnisse: E.map((a) => ({ id: a.id, richtig: true, versuch: 1 })), hoechsteFrei: 1 });
  pruefe('alles im ersten Versuch: Professor Turm als Probepartie', alle.botId === 'turm' && alle.probe && alle.punkte === 8);
  pruefe('doppelte oder fremde Ergebnisse zaehlen nicht mit (je Aufgabe hoechstens einmal, nur die 8 IDs)',
    L.auswerten([{ id: 'stufe-1', richtig: true, versuch: 1 }, { id: 'stufe-1', richtig: true, versuch: 1 }, { id: 'regel-turm', richtig: true, versuch: 1 }]).punkte === 1);
  pruefe('Staerken: die zwei schwersten im ersten Versuch; Luecke: die leichteste nicht geloeste', JSON.stringify(e1.staerken) === '["das Matt in 2","die Gabel"]'
    && e1.luecke === 'Fesselungen auszunutzen', { s: e1.staerken, l: e1.luecke });
  const b1 = L.begruendung(e1, { botName: 'Lisa Läufer' });
  pruefe('Begruendung: Ergebnis, Staerken, naechster Schritt, warum dieser Gegner', b1.saetze.length === 4
    && b1.saetze[0] === 'Du hast 6 von 8 Aufgaben gelöst, 5 davon im ersten Versuch.' && b1.saetze[1] === 'Gut gesehen: das Matt in 2 und die Gabel.'
    && b1.saetze[2] === 'Als Nächstes lohnt es sich, Fesselungen auszunutzen.' && b1.saetze[3] === L.BOT_GRUND.lisa && b1.kurz.startsWith(b1.saetze[0]), b1);
  pruefe('Begruendung ohne Treffer: freundlich, ohne Zahl', L.begruendung(e0).saetze[0].startsWith('Diesmal ging keine Aufgabe auf. Kein Problem'));
  pruefe('Begruendung alles im ersten Versuch: "alle im ersten Versuch"', L.begruendung(alle).saetze[0] === 'Du hast 8 von 8 Aufgaben gelöst, alle im ersten Versuch.');
  pruefe('jeder empfohlene Bot hat einen eigenen Grund', ['benno', 'hilde', 'kalle', 'lisa', 'rudi', 'turm'].every((id) => typeof L.BOT_GRUND[id] === 'string' && L.BOT_GRUND[id].length > 20));
  const texte = [...Object.values(L.BOT_GRUND), L.SCHAETZUNG, ...b1.saetze, ...L.ENTDECKUNGEN.map((e) => e.titel + ' ' + e.text)].join(' ');
  pruefe('Saetze der Entdeckungen kurz (hoechstens 34 Zeichen: eine Zeile in der Heute-Karte, Spielen-Knopf bleibt im Bild)',
    L.ENTDECKUNGEN.every((e) => e.text.length <= 34 && e.titel.length <= 18), L.ENTDECKUNGEN.filter((e) => e.text.length > 34 || e.titel.length > 18).map((e) => e.id));
  pruefe('Texte ohne Druck und ohne Elo-Versprechen (keine Zahl als Spielstaerke)', !/noch offen|verfällt|läuft ab|nur noch|letzte Chance|beeil|nur heute|Elo|\d{3,4}/i.test(texte));

  // ---------- Entdeckungs-Fahrplan ----------
  gruppe = 'Fahrplan';
  const tag0 = '2026-10-23';
  const tag = (n) => T.addiereTage(tag0, n);
  let m = L.fahrplanStart(L.leeresModul(), { tag: tag0, partien: 0 });
  pruefe('Start setzt den ersten Tag (einmal), neue Spieler sind nicht "erfahren"', m.fahrplan.start === tag0 && !m.fahrplan.erfahren
    && L.fahrplanStart(m, { tag: tag(3), partien: 0 }).fahrplan.start === tag0);
  const k = (n, extra = {}) => ({ tag: tag(n), an: true, partien: 0, training: false, einstufungFertig: false, ...extra });
  pruefe('erster Tag ohne Partie: kein Hinweis (die Einstufung bot schon das Willkommen an)', L.hinweisHeute(m, k(0)).id === null);
  let r = L.hinweisHeute(m, k(0, { partien: 1 }));
  pruefe('nach der ersten Partie: "Neu für dich: Die Spielanalyse", gemerkt fuer heute', r.id === 'analyse' && r.modul.fahrplan.heute.tag === tag0 && r.modul.fahrplan.heute.id === 'analyse');
  m = r.modul;
  pruefe('am selben Tag derselbe Hinweis (stabil)', L.hinweisHeute(m, k(0, { partien: 2 })).id === 'analyse');
  m = L.erledige(m, 'analyse');
  pruefe('angetippt oder ausgeblendet: heute kein zweiter, auch wenn andere passen', L.hinweisHeute(m, k(0, { partien: 5, training: true })).id === null
    && m.fahrplan.erledigt.includes('analyse'));
  r = L.hinweisHeute(m, k(1, { partien: 1 }));
  pruefe('naechster Tag: der naechste passende (Einstufung, solange nicht gemacht)', r.id === 'einstufung', r.id);
  pruefe('Einstufung schon gemacht: nicht vorgeschlagen; Training nur, wenn ein Paket Training-Karten anbietet (ab Tag 2)',
    L.hinweisHeute(m, k(1, { partien: 1, einstufungFertig: true })).id === null && L.hinweisHeute(m, k(2, { partien: 1, einstufungFertig: true, training: true })).id === 'training'
    && L.hinweisHeute(m, k(2, { partien: 1, einstufungFertig: true })).id === null);
  pruefe('Einstellungen ab 2 Partien, Verlauf ab 3 Partien', L.hinweisHeute(m, k(2, { partien: 2, einstufungFertig: true })).id === 'einstellungen'
    && L.hinweisHeute(L.erledige(m, 'einstellungen'), k(3, { partien: 3, einstufungFertig: true })).id === 'verlauf');
  const benutzt = L.merkeBenutzt(m, 'einstellungen');
  pruefe('schon besuchter Screen: kein Hinweis mehr dafuer (merkeBenutzt meldet neu nur einmal)', benutzt.neu && !L.merkeBenutzt(benutzt.modul, 'einstellungen').neu
    && L.hinweisHeute(benutzt.modul, k(2, { partien: 2, einstufungFertig: true })).id === null && !L.merkeBenutzt(m, 'partie').neu);
  pruefe('nach 28 Tagen ist Schluss; Hinweise aus: nie', L.hinweisHeute(m, k(L.FAHRPLAN_TAGE, { partien: 9 })).id === null
    && L.hinweisHeute(m, k(L.FAHRPLAN_TAGE - 1, { partien: 9 })).id !== null && L.hinweisHeute(m, { ...k(1, { partien: 9 }), an: false }).id === null);
  pruefe('ohne Starttag oder mit kaputtem Tag: kein Hinweis', L.hinweisHeute(L.leeresModul(), k(1, { partien: 3 })).id === null
    && L.hinweisHeute(m, { ...k(1), tag: 'gestern' }).id === null);
  const erfahren = L.fahrplanStart(L.leeresModul(), { tag: tag0, partien: L.ERFAHREN_AB });
  pruefe('erfahren (ab 5 Partien beim ersten Start): nur neue Funktionen, keine Grundlagen wie Analyse oder Verlauf', erfahren.fahrplan.erfahren
    && L.hinweisHeute(erfahren, k(0, { partien: 40 })).id === null && L.hinweisHeute(erfahren, k(1, { partien: 40 })).id === 'einstufung'
    && L.hinweisHeute(L.erledige(erfahren, 'einstufung'), k(4, { partien: 40 })).id === null);
  pruefe('Tag mit Grenze 4:00: 3:59 gehoert zum Vortag (tag.js)', T.tagSchluessel(new Date(2026, 9, 24, 3, 59)) === tag0 && T.tagSchluessel(new Date(2026, 9, 24, 4, 0)) === tag(1));

  // ---------- Willkommen und erster Sieg ----------
  gruppe = 'Willkommen';
  pruefe('erster Screen nur beim allerersten Start: keine Partie, keine offen, nie gesehen', L.ersterScreenWahl(L.leeresModul(), { partienZahl: 0 }) === 'start'
    && L.ersterScreenWahl(L.leeresModul(), { partienZahl: 1 }) === null && L.ersterScreenWahl(L.leeresModul(), { partienZahl: 0, laufend: true }) === null
    && L.ersterScreenWahl({ ...L.leeresModul(), gesehen: tag0 }, { partienZahl: 0 }) === null && L.ersterScreenWahl(null, {}) === 'start');
  const f = (siege) => ({ bots: { benno: { siege, partien: siege + 1 } } });
  pruefe('erster Sieg: wertender Sieg und genau ein Sieg im Fortschritt', L.istErsterSieg({ ergebnis: 'sieg', wertet: true, fortschritt: f(1) })
    && !L.istErsterSieg({ ergebnis: 'sieg', wertet: true, fortschritt: f(2) }) && !L.istErsterSieg({ ergebnis: 'sieg', wertet: false, fortschritt: f(1) })
    && !L.istErsterSieg({ ergebnis: 'remis', wertet: true, fortschritt: f(1) }) && !L.istErsterSieg({ ergebnis: 'sieg', wertet: true, fortschritt: { bots: { gast: { siege: 1 } } } }));

  // ---------- Modul ----------
  gruppe = 'Modul';
  const kaputt = L.normalisiereModul({ v: 'x', gesehen: '23.10.', regeln: { tag: tag0, geloest: 9, gesamt: 7 }, einstufung: { tag: tag0, botId: 'magnus', punkte: 3 },
    ersterSieg: '<b>', letzte: 'p1', fahrplan: { start: 'heute', erfahren: 'ja', heute: { tag: tag0, id: 'werkstatt' }, erledigt: ['analyse', 'x', 'analyse'], benutzt: ['verlauf', 'partie'] } });
  pruefe('kaputte Felder fallen still weg (Tag, Zahlen, unbekannter Bot, fremde IDs), Gueltiges bleibt', kaputt.v === 1 && kaputt.gesehen === '' && kaputt.regeln === null
    && kaputt.einstufung === null && kaputt.ersterSieg === '' && kaputt.letzte === 'p1' && kaputt.fahrplan.start === '' && kaputt.fahrplan.erfahren === false
    && kaputt.fahrplan.heute === null && JSON.stringify(kaputt.fahrplan.erledigt) === '["analyse"]' && JSON.stringify(kaputt.fahrplan.benutzt) === '["verlauf"]', kaputt);
  pruefe('Muell statt Modul: leeres Modul', JSON.stringify(L.normalisiereModul([1])) === JSON.stringify(L.leeresModul()) && JSON.stringify(L.normalisiereModul('x')) === JSON.stringify(L.leeresModul()));
  const voll = { ...L.leeresModul(), gesehen: tag0, regeln: { tag: tag0, geloest: 7, gesamt: 7 },
    einstufung: { tag: tag0, rechenstand: 1, punkte: 5.5, geloest: 6, ersterVersuch: 5, gesamt: 8, je: e1.je, botId: 'lisa' }, ersterSieg: 'pabc', letzte: 'pabc',
    fahrplan: { start: tag0, erfahren: false, heute: { tag: tag0, id: 'analyse' }, erledigt: ['analyse'], benutzt: ['verlauf'] } };
  pruefe('gueltiges Modul bleibt gleich (normalisieren ist idempotent)', JSON.stringify(L.normalisiereModul(voll)) === JSON.stringify(voll));
  pruefe('ein volles Modul bleibt weit unter dem Budget', JSON.stringify(voll).length < 1500, JSON.stringify(voll).length);
  storage.speichereModul('start', voll);
  pruefe('speichereModul ok, ladeModul liest es gleich', JSON.stringify(L.normalisiereModul(storage.ladeModul('start', L.leeresModul()))) === JSON.stringify(voll));
  pruefe('Paket-Einstellungen "start" erlaubt (hinweise)', storage.speichereModulEinstellungen('start', { hinweise: false }).ok
    && storage.ladeModulEinstellungen('start', { hinweise: true }).hinweise === false);

  // ---------- Dateien ----------
  gruppe = 'Dateien';
  for (const d of ['js/pakete/start/logik.js', 'js/pakete/start/aufgaben.js']) {
    const code = lies(d).replace(/\/\/.*$/gm, '');
    pruefe(`${d}: kein Math.random, kein toISOString, keine Uhr (Date.now/new Date)`, !/Math\.random|toISOString|Date\.now|new Date/.test(code));
  }
  const alleJs = ['js/pakete/start/index.js', 'js/pakete/start/dienst.js', 'js/pakete/start/logik.js', 'js/pakete/start/aufgaben.js', 'js/ui/start.js'];
  pruefe('kein toISOString in den Paket-Dateien (Tage aus tag.js)', alleJs.every((d) => !/toISOString/.test(lies(d).replace(/\/\/.*$/gm, ''))));
  pruefe('Kommentare in ASCII (Umlaute nur in Oberflaechentexten)', alleJs.every((d) => lies(d).split('\n').every((z) => !/^\s*\/\/.*[^\x00-\x7F]/.test(z))),
    alleJs.flatMap((d) => lies(d).split('\n').filter((z) => /^\s*\/\/.*[^\x00-\x7F]/.test(z)).map((z) => d + ': ' + z.trim().slice(0, 50))));
  pruefe('nur ueber Orte, Ereignisse, Register und Modul-Speicher: keine Datei eines anderen Pakets oder Host-Screens importiert',
    alleJs.every((d) => !/from '[^']*(pakete\/(?!start)|ui\/(partie|arena|analyse|verlauf|einstellungen)\.js)/.test(lies(d))));
  const tokens = new Set([...lies('css/tokens.css').matchAll(/(--[a-z0-9-]+)\s*:/g), ...lies('css/themes/modern.css').matchAll(/(--[a-z0-9-]+)\s*:/g)].map((x) => x[1]));
  const css = lies('css/pakete/start.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const genutzt = [...new Set([...css.matchAll(/var\((--[a-z0-9-]+)/g)].map((x) => x[1]))].filter((t) => !['--bf', '--bt'].includes(t));
  pruefe('css/pakete/start.css: nur Tokens (keine Hex-, rgb- oder Farbnamen-Werte)', !/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|(?<![-\w])(white|black|red|green|blue)(?![-\w])/.test(css));
  pruefe('css/pakete/start.css: nur vorhandene Tokens (dazu --bf/--bt aus dem Screen)', genutzt.length > 10 && genutzt.every((t) => tokens.has(t)), genutzt.filter((t) => !tokens.has(t)));
  pruefe('css/pakete/start.css: animiert nur transform und opacity (Transitions), kein Neon', [...css.matchAll(/transition:\s*([^;]+);/g)].every((x) => x[1].split(',')
    .every((t) => /^\s*(transform|opacity|background-color)\b/.test(t))) && !/neon|glow|text-shadow/i.test(css));
  // vor der Integration nur ein Hinweis; steht das Paket in PAKETE, muessen Screen, Raetsel-Bildschirm und Paket-Dateien offline da
  // sein (sw.test.mjs ordnet js/ui/start.js laut SCREEN_PAKET dem Paket "einstieg" zu und erzwingt es deshalb nicht)
  const eingetragen = /['"]pakete\/start\/index['"]/.test(lies('js/erweiterungen.js').replace(/\/\/.*$/gm, ''));
  const swText = lies('sw.js');
  const noetig = ['js/ui/start.js', 'js/ui/raetsel.js', 'css/pakete/raetsel.css', 'css/pakete/start.css', ...alleJs.filter((d) => d.startsWith('js/pakete/'))];
  pruefe(eingetragen ? 'in PAKETE: Screen, Raetsel-Bildschirm, beide CSS und alle Paket-Dateien im Offline-Cache (sw.js DATEIEN)'
    : 'noch nicht in PAKETE (traegt die Integration ein, dann mit Screen, Raetsel-Bildschirm und CSS in sw.js DATEIEN)',
  !eingetragen || noetig.every((d) => swText.includes(`'${d}'`)), noetig.filter((d) => !swText.includes(`'${d}'`)));
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

// Bild erst, wenn Eintritte fertig sind (sonst halb durchsichtig)
const bild = async (seite, name) => { if (OHNE_BILDER) return; await warte(750); await seite.screenshot({ path: path.join(BILDER, name + '.png') }); };

// Speicher vorbereiten und neu laden
async function bereite(seite, { modul = null, partien = null, fortschritt = null, einstellungen = null } = {}, hash = '#arena') {
  // erst weg vom alten Screen: eine offene Partie sichert sich beim Verlassen (verlasse() in partie.js) und stuende
  // sonst nach dem Leeren wieder im Speicher
  await seite.evaluate(() => { if (window.__app && document.documentElement.dataset.screen !== 'arena') window.__app.gehe('arena', {}, { ersetzen: true }); });
  await seite.waitForFunction(() => !window.__app || document.documentElement.dataset.screen === 'arena', null, { timeout: 15000 });
  await seite.evaluate(({ modul, partien, fortschritt, einstellungen, P }) => {
    localStorage.clear();
    if (modul) localStorage.setItem(P + 'modul:start', JSON.stringify(modul));
    if (partien) localStorage.setItem(P + 'partien', JSON.stringify(partien));
    if (fortschritt) localStorage.setItem(P + 'fortschritt', JSON.stringify(fortschritt));
    if (einstellungen) localStorage.setItem(P + 'einstellungen:start', JSON.stringify(einstellungen));
  }, { modul, partien, fortschritt, einstellungen, P });
  await seite.goto(BASIS + hash);
  await seite.reload();
  const ziel = { '#arena': '.screen.arena .knoten', '#einstellungen': '.es-screen .st-gruppe', '#start': '.st-screen .st-titel' }[hash] || '#app > .screen:not(.lade-screen)';
  await seite.waitForFunction((sel) => !!window.__app && !!document.querySelector('link[data-paket="start"]') && !!document.querySelector(sel), ziel, { timeout: 20000 });
}

const sz = (seite) => seite.evaluate(() => (window.__start ? window.__start.zustand() : { offen: false }));
const modulImBrowser = (seite) => seite.evaluate((P) => JSON.parse(localStorage.getItem(P + 'modul:start') || 'null'), P);
const heuteImBrowser = (seite) => seite.evaluate(async () => (await import('/js/tag.js')).tagSchluessel());
async function warteSeite(seite, name, ms = 8000) {
  await seite.waitForFunction((n) => !!window.__start && window.__start.zustand().seite === n && !!document.querySelector(`.st-buehne[data-seite="${n}"] .st-titel`), name, { timeout: ms });
  await warte(80);
}
async function feld(seite, f, sel = '.screen.rs-screen') {
  const b = await seite.locator(`${sel} .brett-felder .feld[data-feld="${f}"]`).boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}
async function tippe(seite, f, handy) {
  const p = await feld(seite, f);
  if (handy) await seite.touchscreen.tap(p.x, p.y);
  else await seite.mouse.click(p.x, p.y);
  await warte(90);
}
async function ziehe(seite, uci, { handy = false } = {}) {
  await tippe(seite, uci.slice(0, 2), handy);
  await tippe(seite, uci.slice(2, 4), handy);
}
// synchron ueber window.__raetsel (waitForFunction wartet nicht auf ein Promise)
async function warteRaetsel(seite, fn, arg, ms = 10000) {
  await seite.waitForFunction(([f, a]) => {
    const z = window.__raetsel ? window.__raetsel.zustand() : { offen: false };
    return new Function('z', 'a', 'return ' + f)(z, a);
  }, [fn, arg], { timeout: ms });
}
const raetselZustand = (seite) => seite.evaluate(() => (window.__raetsel ? window.__raetsel.zustand() : { offen: false }));
async function weiterImRaetsel(seite, index) {
  await seite.locator('.rs-weiter').click();
  if (index != null) await warteRaetsel(seite, 'z.index === a && z.phase === "flo"', index);
}
// Layout einer Seite: nichts ragt seitlich heraus, Knoepfe mindestens 44 px, "Ich kenne mich aus" sichtbar, Titel ganz
const layout = (seite) => seite.evaluate(() => {
  const s = document.querySelector('.st-screen');
  const r = document.querySelector('.st-rumpf');
  const raus = document.querySelector('.st-raus').getBoundingClientRect();
  const h1 = document.querySelector('.st-titel');
  const klein = [...s.querySelectorAll('button')].filter((b) => !b.closest('.st-punkte') && b.getClientRects().length)
    .map((b) => ({ t: b.textContent.trim().slice(0, 20), h: Math.round(b.getBoundingClientRect().height) })).filter((x) => x.h < 44);
  return {
    quer: document.documentElement.scrollWidth <= innerWidth + 1 && r.scrollWidth <= r.clientWidth + 1,
    raus: raus.width > 0 && raus.top >= 0 && raus.bottom <= innerHeight && raus.right <= innerWidth + 1,
    titel: h1.scrollWidth <= h1.clientWidth + 1, klein,
    // Seiten-Punkte: nur auf w1 bis w3 sichtbar (sonst nav[hidden]); sichtbar muessen alle drei mindestens 44 px hoch sein
    punkte: document.querySelector('.st-punkte').hidden ? document.querySelector('.st-punkte').getClientRects().length === 0
      : [...document.querySelectorAll('.st-punkte button')].every((b) => b.getBoundingClientRect().height >= 44 && b.getBoundingClientRect().width >= 44),
  };
});

async function browserTeil(browser) {
  if (!OHNE_BILDER) mkdirSync(BILDER, { recursive: true });

  // ---------- erster Start ----------
  gruppe = 'Erster Start';
  const { kontext, seite, fehler } = await neueSeite(browser);
  await seite.goto(BASIS);
  await seite.waitForSelector('.st-screen .st-titel', { timeout: 20000 });
  const heute = await heuteImBrowser(seite);
  const erst = await seite.evaluate(() => ({ hash: location.hash, titel: document.title, h1: document.querySelector('.st-titel').textContent,
    raus: !!document.querySelector('.haupt-kopf .st-raus'), punkte: document.querySelectorAll('.st-punkte button').length,
    aktuell: document.querySelector('.st-punkte [aria-current]') && document.querySelector('.st-punkte [aria-current]').dataset.ziel,
    css: !!document.querySelector('link[data-paket="start"]') }));
  pruefe('frischer Start ohne Partien: Willkommen (#start, Seite 1 von 3, "Ich kenne mich aus" im Kopf, eigenes CSS)', erst.hash === '#start' && erst.titel === 'Willkommen · Crownmate'
    && erst.h1 === 'Schach, das mit dir wächst.' && erst.raus && erst.punkte === 3 && erst.aktuell === 'w1' && erst.css, JSON.stringify(erst));
  pruefe('Willkommen gilt als gesehen (Modul start, Tag mit Grenze 4:00)', (await modulImBrowser(seite)).gesehen === heute);
  pruefe('Fahrplan beginnt beim ersten Start (neuer Spieler)', await seite.waitForFunction((P) => {
    const m = JSON.parse(localStorage.getItem(P + 'modul:start') || 'null');
    return !!(m && m.fahrplan && m.fahrplan.start);
  }, P, { timeout: 5000 }).then(() => true, () => false) && (await modulImBrowser(seite)).fahrplan.erfahren === false);
  let lay = await layout(seite);
  pruefe('iPad quer: nichts ragt heraus, Titel ganz, alle Knoepfe mindestens 44 px', lay.quer && lay.raus && lay.titel && !lay.klein.length && lay.punkte, JSON.stringify(lay));
  await bild(seite, 'w1-ipad');
  // Seiten blaettern
  await seite.locator('[data-st="weiter"]').click();
  await warteSeite(seite, 'w2');
  const w2 = await seite.evaluate(() => ({ bots: document.querySelectorAll('.st-leiter .st-bot').length, erster: document.querySelectorAll('.st-bot.st-erster').length,
    bilder: [...document.querySelectorAll('.st-leiter img')].every((i) => i.complete && i.naturalWidth > 0), aktuell: document.querySelector('.st-punkte [aria-current]').dataset.ziel,
    fokus: document.activeElement && document.activeElement.classList.contains('st-titel'), h1: document.querySelector('.st-titel').textContent,
    p: document.querySelector('.st-text p').textContent }));
  pruefe('Seite 2 "deine Gegner": alle 10 Bots als Leiter, Benno als Start, Bilder geladen, Fokus auf dem Titel', w2.bots === 10 && w2.erster === 1 && w2.bilder && w2.aktuell === 'w2' && w2.fokus,
    JSON.stringify(w2));
  pruefe('Seite 2: Zahl und Namen aus der Leiter ("Zehn Gegner, eine Leiter.", "Von Bauer Benno bis zum Stockfisch: ...")', w2.h1 === 'Zehn Gegner, eine Leiter.'
    && w2.p.startsWith('Von Bauer Benno bis zum Stockfisch: Jeder Sieg schaltet den nächsten frei'), JSON.stringify({ h1: w2.h1, p: w2.p }));
  await bild(seite, 'w2-ipad');
  await seite.keyboard.press('ArrowRight');
  await warteSeite(seite, 'w3');
  pruefe('Pfeiltaste rechts: Seite 3 "wie du lernst" mit drei Kacheln', await seite.evaluate(() => document.querySelectorAll('.st-kachel').length) === 3);
  await bild(seite, 'w3-ipad');
  await seite.keyboard.press('ArrowLeft');
  await warteSeite(seite, 'w2');
  await seite.locator('.st-punkte [data-ziel="w3"]').click();
  await warteSeite(seite, 'w3');
  pruefe('Pfeiltaste links und Punkt antippen blaettern', (await sz(seite)).seite === 'w3');
  await seite.locator('[data-st="weiter"]').click();
  await warteSeite(seite, 'frage');
  const fr = await seite.evaluate(() => ({ h1: document.querySelector('.st-titel').textContent, wahl: [...document.querySelectorAll('.st-wahl-knopf b')].map((b) => b.textContent),
    punkte: document.querySelector('.st-punkte').hidden, raus: !!document.querySelector('.st-raus') }));
  pruefe('danach die Frage "Kennst du die Schachregeln?" mit Ja und Nein; keine Seiten-Punkte mehr, "Ich kenne mich aus" bleibt', fr.h1 === 'Kennst du die Schachregeln?'
    && fr.wahl.join('|') === 'Ja, ich kenne sie|Nein, zeig sie mir' && fr.punkte && fr.raus, JSON.stringify(fr));
  await bild(seite, 'frage-ipad');
  // Neuladen bleibt auf der Seite (params.seite im eigenen Verlaufseintrag), nicht Seite 1
  await seite.reload();
  await warteSeite(seite, 'frage', 20000);
  pruefe('Neuladen auf der Frage: wieder die Frage (Seite im Verlaufseintrag), Hash #start', (await sz(seite)).seite === 'frage'
    && await seite.evaluate(() => location.hash === '#start' && history.state && history.state.params && history.state.params.seite === 'frage'));
  // "Ich kenne mich aus" -> Arena; der zweite Start zeigt kein Willkommen
  await seite.locator('.st-raus').click();
  await seite.waitForSelector('.screen.arena .knoten', { timeout: 15000 });
  pruefe('"Ich kenne mich aus" fuehrt zur Arena', await seite.evaluate(() => location.hash) === '#arena');
  await seite.goto(BASIS);
  await seite.waitForSelector('#app > .screen:not(.lade-screen)', { timeout: 20000 });
  await warte(300);
  pruefe('zweiter Start (ohne Hash): kein Willkommen, sondern die Arena', await seite.evaluate(() => location.hash === '#arena' && !!document.querySelector('.screen.arena')
    && !document.querySelector('.st-screen')));
  // gespeicherte Partie: kein Willkommen, auch wenn es nie gezeigt wurde
  await seite.evaluate((P) => {
    localStorage.clear();
    localStorage.setItem(P + 'partien', JSON.stringify([{ id: 'palt1', botId: 'benno', spielerFarbe: 'w', datum: new Date().toISOString(), zuege: ['e2e4'], ergebnis: 'niederlage', modus: 'normal' }]));
  }, P);
  await seite.goto(BASIS);
  await seite.waitForSelector('#app > .screen:not(.lade-screen)', { timeout: 20000 });
  await warte(300);
  pruefe('mit gespeicherter Partie (und nie gesehen): kein Willkommen', await seite.evaluate(() => !document.querySelector('.st-screen') && location.hash === '#arena'));
  // Ueberspringen auf Seite 1
  await seite.evaluate(() => localStorage.clear());
  await seite.goto(BASIS);
  await seite.waitForSelector('.st-screen .st-titel', { timeout: 20000 });
  await seite.locator('[data-st="ueberspringen"]').click();
  await warteSeite(seite, 'frage');
  pruefe('Ueberspringen auf Seite 1 fuehrt direkt zur Frage', (await sz(seite)).seite === 'frage');

  // ---------- Regel-Hilfe ----------
  gruppe = 'Regel-Hilfe';
  await seite.locator('[data-st="nein"]').click();
  await warteRaetsel(seite, 'z.offen && z.quelle === "start-regeln" && z.phase === "flo"');
  let z = await raetselZustand(seite);
  const kopfR = await seite.evaluate(() => ({ titel: document.querySelector('.rs-screen .marke-titel').textContent, h2: document.querySelector('.rs-status h2').textContent,
    p: document.querySelector('.rs-status p').textContent, hash: location.hash }));
  pruefe('Nein: Regel-Hilfe im Raetsel-Bildschirm, 7 Aufgaben, die erste ist der Turm', z.gesamt === 7 && z.aufgabe === 'regel-turm' && kopfR.titel === 'Die Figuren'
    && kopfR.h2 === 'Der Turm' && /Tippe ihn an/.test(kopfR.p) && kopfR.hash === '#raetsel', JSON.stringify({ z, kopfR }));
  // Zurueck mitten in der Regel-Hilfe: zurueck zur Frage
  await seite.locator('.rs-screen .kopf-zurueck').click();
  await warteSeite(seite, 'frage');
  pruefe('Zurueck aus der Regel-Hilfe: wieder die Frage (nicht Seite 1)', (await sz(seite)).seite === 'frage');
  // auch nach einem Neuladen im Raetsel-Bildschirm (der gemerkte Rueckweg ist dann weg, die Seite steht im Verlauf)
  await seite.locator('[data-st="nein"]').click();
  await warteRaetsel(seite, 'z.offen && z.quelle === "start-regeln" && z.phase === "flo"');
  await seite.reload();
  await warteRaetsel(seite, 'z.offen && z.quelle === "start-regeln" && z.phase === "flo" && z.index === 0', null, 20000);
  await seite.locator('.rs-screen .kopf-zurueck').click();
  await warteSeite(seite, 'frage');
  pruefe('Neuladen in der Regel-Hilfe, dann Zurueck: wieder die Frage', (await sz(seite)).seite === 'frage');
  await seite.locator('[data-st="nein"]').click();
  await warteRaetsel(seite, 'z.offen && z.quelle === "start-regeln" && z.phase === "flo" && z.index === 0');
  await bild(seite, 'regel-turm-ipad');
  // interaktiv: Antippen zeigt, wohin die Figur ziehen kann
  await tippe(seite, 'd2');
  const punkteAmBrett = await seite.evaluate(() => [...document.querySelectorAll('.rs-screen .lage.ziel')].map((l) => l.dataset.feld).sort());
  pruefe('Turm antippen: die Punkte zeigen seine Zuege (gerade, bis zum Springer)', punkteAmBrett.includes('d7') && punkteAmBrett.includes('a2') && punkteAmBrett.includes('h2')
    && !punkteAmBrett.includes('d8') && !punkteAmBrett.includes('e3'), punkteAmBrett.join(','));
  await bild(seite, 'regel-turm-punkte-ipad');
  await tippe(seite, 'd5');   // erlaubter, aber falscher Zug
  await warteRaetsel(seite, 'z.fehlversuche === 1 && z.phase === "flo"');
  await warte(250);
  const hinweis = await seite.evaluate(() => document.querySelector('.rs-meldung > div > span').textContent);
  pruefe('falscher Zug: schnappt zurueck, Hinweis zur Figur', hinweis === 'Der Turm auf d2 kann gerade nach oben ziehen.', hinweis);
  const loesungen = { 'regel-turm': 'd2d7', 'regel-laeufer': 'c1g5', 'regel-dame': 'd1h5', 'regel-springer': 'g1e2', 'regel-koenig': 'd4e5', 'regel-bauer': 'e4d5', 'regel-matt': 'a1a8' };
  for (let i = 0; i < 7; i++) {
    z = await raetselZustand(seite);
    await ziehe(seite, loesungen[z.aufgabe]);
    await warteRaetsel(seite, 'z.phase === "geloest"');
    if (z.aufgabe === 'regel-springer') await bild(seite, 'regel-springer-ipad');
    if (i < 6) await weiterImRaetsel(seite, i + 1);
  }
  z = await raetselZustand(seite);
  pruefe('alle sieben Figuren-Aufgaben geloest (die erste im zweiten Versuch)', z.ergebnisse.length === 7 && z.ergebnisse.every((e) => e.richtig)
    && z.ergebnisse[0].versuch === 2 && z.ergebnisse.slice(1).every((e) => e.versuch === 1), JSON.stringify(z.ergebnisse));
  await seite.locator('.rs-weiter').click();
  await seite.waitForSelector('.rs-ende:not([hidden]) .rs-ende-karte', { timeout: 8000 });
  const endeR = await seite.evaluate(() => ({ h2: document.querySelector('.rs-ende h2').textContent, knoepfe: [...document.querySelectorAll('.rs-ende-knoepfe .knopf')].map((k) => k.textContent.trim()) }));
  pruefe('Ende: "Du kennst alle Figuren", Knopf "Gegen Bauer Benno spielen" und "Fertig"', endeR.h2 === 'Du kennst alle Figuren'
    && endeR.knoepfe.join('|') === 'Gegen Bauer Benno spielen|Fertig', JSON.stringify(endeR));
  pruefe('Ergebnis im Modul start: regeln { 7 von 7 }', JSON.stringify((await modulImBrowser(seite)).regeln) === JSON.stringify({ tag: heute, geloest: 7, gesamt: 7 }));
  await bild(seite, 'regeln-ende-ipad');
  await seite.locator('.rs-ende .rs-fertig').click();
  await warteSeite(seite, 'nach-regeln');
  const nr = await seite.evaluate(() => ({ ueber: document.querySelector('.st-text .ueberzeile').textContent, h1: document.querySelector('.st-titel').textContent,
    knoepfe: [...document.querySelectorAll('.st-knoepfe .knopf')].map((k) => k.textContent.trim()) }));
  pruefe('"Fertig": zurueck zum Willkommen, Seite "Bereit für deine erste Partie?" mit Benno', nr.ueber === 'Regel-Hilfe geschafft' && nr.h1 === 'Bereit für deine erste Partie?'
    && nr.knoepfe.join('|') === 'Gegen Bauer Benno spielen|Einstufung machen|Zur Arena', JSON.stringify(nr));
  await bild(seite, 'nach-regeln-ipad');
  await seite.locator('[data-st="benno"]').click();
  await seite.waitForFunction(() => !!window.__partie && document.querySelector('.screen.partie'), null, { timeout: 15000 });
  const pb = await seite.evaluate(() => ({ bot: window.__partie.z.bot.id, modus: window.__partie.z.modus, farbe: window.__partie.z.farbe }));
  pruefe('"Gegen Bauer Benno spielen" startet eine normale Partie (wertet) mit Weiss', pb.bot === 'benno' && pb.modus === 'normal' && pb.farbe === 'w', JSON.stringify(pb));
  await seite.evaluate(() => window.__app.gehe('arena', {}, { ersetzen: true }));
  await seite.waitForSelector('.screen.arena .knoten', { timeout: 15000 });

  // ---------- Einstufung mit festen Antworten ----------
  gruppe = 'Einstufung';
  await seite.evaluate((P) => { localStorage.removeItem(P + 'laufend'); }, P);
  await seite.evaluate(() => window.__app.gehe('start', { seite: 'frage' }));
  await warteSeite(seite, 'frage');
  await seite.locator('[data-st="ja"]').click();
  await warteSeite(seite, 'einstufung');
  const ang = await seite.evaluate(() => ({ chips: [...document.querySelectorAll('.st-chips span')].map((c) => c.textContent),
    knoepfe: [...document.querySelectorAll('.st-knoepfe .knopf')].map((k) => k.textContent.trim()), stapel: document.querySelectorAll('.st-stapel .mini').length }));
  pruefe('Ja: Angebot der Einstufung ("8 Aufgaben", "etwa 5 Minuten", "wertet nichts"), starten oder gleich spielen', ang.chips.join('|') === '8 Aufgaben|etwa 5 Minuten|wertet nichts'
    && ang.knoepfe.join('|') === 'Einstufung starten|Lieber gleich spielen' && ang.stapel === 3, JSON.stringify(ang));
  await bild(seite, 'einstufung-ipad');
  await seite.locator('[data-st="einstufung-start"]').click();
  await warteRaetsel(seite, 'z.offen && z.quelle === "start-einstufung" && z.phase === "flo"');
  z = await raetselZustand(seite);
  pruefe('8 Aufgaben im Raetsel-Bildschirm (Fortschritt "1 von 8")', z.gesamt === 8 && await seite.evaluate(() => document.querySelector('.rs-zaehler').textContent) === '1 von 8');
  // 1 bis 4 im ersten Versuch
  for (const [i, u] of [[0, 'h5f7'], [1, 'f3d4'], [2, 'h4f2'], [3, 'd5c7']].map(([i, u]) => [i, u])) {
    if (i === 2) {
      pruefe('Aufgabe 3: Schwarz am Zug, das Brett ist gedreht', await seite.evaluate(() => document.querySelector('.rs-screen .brett').dataset.ausrichtung) === 'b'
        && await seite.evaluate(() => document.querySelector('.rs-amzug').textContent.trim()) === 'Schwarz am Zug');
      await bild(seite, 'einstufung-schwarz-ipad');
    }
    await ziehe(seite, u);
    await warteRaetsel(seite, 'z.phase === "geloest"');
    await weiterImRaetsel(seite, i + 1);
  }
  // 5: erst falsch, dann richtig
  await ziehe(seite, 'a1a2');
  await warteRaetsel(seite, 'z.fehlversuche === 1 && z.phase === "flo"');
  await ziehe(seite, 'a1a7');
  await warteRaetsel(seite, 'z.phase === "geloest"');
  await weiterImRaetsel(seite, 5);
  // 6: Loesung zeigen
  await seite.locator('.rs-zeigen').click();
  await warteRaetsel(seite, 'z.phase === "gezeigt"', null, 12000);
  await weiterImRaetsel(seite, 6);
  // 7: Matt in 2 mit Antwort des Gegners
  await ziehe(seite, 'e2e8');
  await warteRaetsel(seite, 'z.phase === "flo" && z.schritt === 2', null, 8000);
  await ziehe(seite, 'e1e8');
  await warteRaetsel(seite, 'z.phase === "geloest"');
  await weiterImRaetsel(seite, 7);
  // 8: Loesung zeigen
  await seite.locator('.rs-zeigen').click();
  await warteRaetsel(seite, 'z.phase === "gezeigt"', null, 12000);
  z = await raetselZustand(seite);
  pruefe('Antworten wie geplant: 1 bis 4 und 7 im ersten Versuch, 5 im zweiten, 6 und 8 Loesung gezeigt',
    z.ergebnisse.map((e) => (e.richtig ? e.versuch : 'L')).join() === '1,1,1,1,2,L,1,L', JSON.stringify(z.ergebnisse));
  await seite.locator('.rs-weiter').click();
  await seite.waitForSelector('.rs-ende:not([hidden]) .rs-ende-karte', { timeout: 8000 });
  const endeE = await seite.evaluate(() => ({ h2: document.querySelector('.rs-ende h2').textContent, zahl: document.querySelector('.rs-ende-zahl').textContent.replace(/\s+/g, ' ').trim(),
    p: document.querySelector('.rs-ende-karte p') ? document.querySelector('.rs-ende-karte p').textContent : '',
    knoepfe: [...document.querySelectorAll('.rs-ende-knoepfe .knopf')].map((k) => k.textContent.trim()) }));
  pruefe('Ende: Empfehlung "Starte gegen Lisa Läufer" mit Begruendung, Probepartie, Leiter und Fertig', endeE.h2 === 'Starte gegen Lisa Läufer' && endeE.zahl === '6 von 8 gelöst'
    && /^Du hast 6 von 8 Aufgaben gelöst/.test(endeE.p) && /Probepartie wertet nicht/.test(endeE.p)
    && endeE.knoepfe.join('|') === 'Probepartie gegen Lisa Läufer|Leiter: Bauer Benno|Fertig', JSON.stringify(endeE));
  const mE = await modulImBrowser(seite);
  pruefe('Ergebnis im Modul start: einstufung { 5,5 Punkte, 6 geloest, 5 im ersten Versuch, Lisa, Rechenstand 1 }', mE.einstufung && mE.einstufung.punkte === 5.5
    && mE.einstufung.geloest === 6 && mE.einstufung.ersterVersuch === 5 && mE.einstufung.botId === 'lisa' && mE.einstufung.rechenstand === 1 && mE.einstufung.tag === heute
    && mE.einstufung.je.length === 8, JSON.stringify(mE.einstufung));
  await bild(seite, 'einstufung-ende-ipad');
  await seite.locator('.rs-ende .rs-fertig').click();
  await warteSeite(seite, 'empfehlung');
  const em = await seite.evaluate(() => ({ h1: document.querySelector('.st-titel').textContent, chips: [...document.querySelectorAll('.st-chips span')].map((c) => c.textContent),
    grund: [...document.querySelectorAll('.st-grund p')].map((p) => p.textContent), notiz: document.querySelector('.st-notiz') ? document.querySelector('.st-notiz').textContent : '',
    knoepfe: [...document.querySelectorAll('.st-knoepfe .knopf')].map((k) => k.textContent.replace(/\s+/g, ' ').trim()),
    portraet: !!document.querySelector('.st-portraet img') && document.querySelector('.st-portraet-name b').textContent }));
  pruefe('"Fertig": Seite "Deine Empfehlung" mit Portraet, Ergebnis, Begruendung und Hinweis, dass die Probepartie nicht wertet', em.h1 === 'Starte gegen Lisa Läufer'
    && em.portraet === 'Lisa Läufer' && em.chips.join('|') === '6 von 8 gelöst|5 im ersten Versuch' && em.grund.length === 4 && /Probepartie wertet nicht/.test(em.notiz)
    && /Bauer Benno dein nächster Gegner/.test(em.notiz), JSON.stringify(em));
  pruefe('Knoepfe: Probepartie (wertet nicht), Leiter, Einstufung wiederholen, Zur Arena', em.knoepfe.join('|')
    === 'Probepartie gegen Lisa Läufer wertet nicht|Leiter: Bauer Benno|Einstufung wiederholen|Zur Arena', em.knoepfe.join('|'));
  await seite.reload();
  await warteSeite(seite, 'empfehlung', 20000);
  pruefe('Neuladen auf der Empfehlung: wieder die Empfehlung (nicht Seite 1)', (await sz(seite)).seite === 'empfehlung'
    && await seite.evaluate(() => document.querySelector('.st-titel').textContent) === 'Starte gegen Lisa Läufer');
  lay = await layout(seite);
  pruefe('Empfehlung iPad: nichts ragt heraus, Knoepfe mindestens 44 px', lay.quer && lay.raus && !lay.klein.length, JSON.stringify(lay));
  await bild(seite, 'empfehlung-ipad');
  await seite.locator('[data-st="probe"]').click();
  await seite.waitForFunction(() => !!window.__partie && document.querySelector('.screen.partie'), null, { timeout: 15000 });
  const pp = await seite.evaluate(() => ({ bot: window.__partie.z.bot.id, modus: window.__partie.z.modus, farbe: window.__partie.z.farbe, params: history.state && history.state.params }));
  pruefe('Probepartie: Partie gegen Lisa im Modus "frei" (wertet nie, keine Sterne, keine Freischaltung)', pp.bot === 'lisa' && pp.modus === 'frei' && pp.farbe === 'w'
    && pp.params && pp.params.modus === 'frei', JSON.stringify(pp));
  pruefe('wertet() fuer diese Partie: false', await seite.evaluate(async () => (await import('/js/storage.js')).wertet({ modus: window.__partie.z.modus, botId: 'lisa' })) === false);
  // Leiter-Knopf: die Probepartie ist beim Verlassen als offene Partie gesichert worden, also fragt es wie die Arena
  await seite.evaluate(() => window.__app.gehe('start', { seite: 'empfehlung' }));
  await warteSeite(seite, 'empfehlung');
  const offen = await seite.evaluate((P) => (JSON.parse(localStorage.getItem(P + 'laufend') || 'null') || {}).botId || null, P);
  await seite.locator('[data-st="leiter"]').click();
  await seite.waitForSelector('.dialog-ort .dialog .dialog-knoepfe .knopf', { timeout: 8000 });
  const dlg = await seite.evaluate(() => ({ h2: document.querySelector('.dialog h2').textContent, p: document.querySelector('.dialog p').textContent,
    knoepfe: [...document.querySelectorAll('.dialog-knoepfe .knopf')].map((k) => k.textContent) }));
  pruefe('offene Probepartie: Rueckfrage "Neue Partie starten?" nennt Lisa, Abbrechen oder Neue Partie', offen === 'lisa' && dlg.h2 === 'Neue Partie starten?'
    && /gegen Lisa Läufer/.test(dlg.p) && dlg.knoepfe.join('|') === 'Abbrechen|Neue Partie', JSON.stringify({ offen, dlg }));
  await seite.locator('.dialog-knoepfe .knopf', { hasText: 'Abbrechen' }).click();
  await seite.waitForFunction(() => !document.querySelector('.dialog-ort'), null, { timeout: 5000 });
  pruefe('Abbrechen: bleibt auf der Empfehlung, die offene Partie bleibt', (await sz(seite)).seite === 'empfehlung'
    && await seite.evaluate((P) => (JSON.parse(localStorage.getItem(P + 'laufend') || 'null') || {}).botId, P) === 'lisa');
  await seite.locator('[data-st="leiter"]').click();
  await seite.locator('.dialog-knoepfe .knopf', { hasText: 'Neue Partie' }).click();
  await seite.waitForFunction(() => !!window.__partie && window.__partie.z.bot.id === 'benno', null, { timeout: 15000 });
  pruefe('"Leiter: Bauer Benno" startet die normale Partie auf der Leiter', await seite.evaluate(() => window.__partie.z.modus) === 'normal');
  // mit Lisa freigeschaltet: keine Probepartie, sondern die normale Partie
  await bereite(seite, { modul: mE, fortschritt: { bots: { benno: { sterne: [true, false, false], partien: 1, siege: 1 }, hilde: { sterne: [true, false, false], partien: 1, siege: 1 },
    kalle: { sterne: [true, false, false], partien: 1, siege: 1 } } } }, '#arena');
  await seite.evaluate(() => window.__app.gehe('start', { seite: 'empfehlung' }));
  await warteSeite(seite, 'empfehlung');
  const frei = await seite.evaluate(() => ({ notiz: !!document.querySelector('.st-notiz'), knoepfe: [...document.querySelectorAll('.st-knoepfe .knopf')].map((k) => k.textContent.trim()) }));
  pruefe('Lisa freigeschaltet (Kalle besiegt): "Gegen Lisa Läufer spielen", keine Probepartie', !frei.notiz && frei.knoepfe[0] === 'Gegen Lisa Läufer spielen'
    && !frei.knoepfe.some((t) => /Probepartie/.test(t)), JSON.stringify(frei));
  await seite.locator('[data-st="spielen"]').click();
  await seite.waitForFunction(() => !!window.__partie && window.__partie.z.bot.id === 'lisa', null, { timeout: 15000 });
  pruefe('...und die startet normal (wertet)', await seite.evaluate(() => window.__partie.z.modus) === 'normal');
  pruefe('keine Konsolenfehler (Willkommen, Regel-Hilfe, Einstufung)', fehler.length === 0, fehler.join(' | '));
  await kontext.close();

  // ---------- Heute-Karte: Neu fuer dich ----------
  gruppe = 'Neu für dich';
  const n = await neueSeite(browser);
  await n.seite.goto(BASIS + '#arena');
  await n.seite.waitForSelector('.screen.arena', { timeout: 20000 });
  const t = await heuteImBrowser(n.seite);
  const vor = async (tage) => n.seite.evaluate(async (x) => (await import('/js/tag.js')).addiereTage(x.t, x.tage), { t, tage });
  const modulMit = (fp, extra = {}) => ({ v: 1, gesehen: t, regeln: null, einstufung: null, ersterSieg: '', letzte: '',
    fahrplan: { start: t, erfahren: false, heute: null, erledigt: [], benutzt: [], ...fp }, ...extra });
  const zeile = (s) => s.evaluate(() => {
    const z = document.querySelector('.heute-karte .st-neu');
    if (!z) return null;
    const kopf = z.querySelector('.st-neu-kopf');
    return { id: z.dataset.entdeckung, text: z.querySelector('.st-neu-text').textContent.replace(/\s+/g, ' ').trim(), karte: !z.closest('.heute-karte').hidden,
      zeilen: Math.round(kopf.getBoundingClientRect().height / parseFloat(getComputedStyle(kopf).lineHeight)) };
  });
  // erster Tag ohne Partie: nichts
  await bereite(n.seite, { modul: modulMit({}) }, '#arena');
  pruefe('erster Tag ohne Partie: kein Hinweis, Heute-Karte ohne Zeile', await zeile(n.seite) === null);
  // nach der ersten Partie (hier eine Probepartie: letzte gesetzt)
  await bereite(n.seite, { modul: modulMit({}, { letzte: 'pprobe1' }) }, '#arena');
  let zl = await zeile(n.seite);
  pruefe('nach der ersten Partie: "Neu für dich: Die Spielanalyse" in der Heute-Karte (Kopf in einer Zeile)', zl && zl.id === 'analyse' && zl.karte
    && zl.text === 'Neu für dich: Die Spielanalyse Wo deine letzte Partie kippte.' && zl.zeilen === 1, JSON.stringify(zl));
  await bild(n.seite, 'heute-neu-ipad');
  await n.seite.locator('.st-neu .st-neu-los').click();
  await n.seite.waitForSelector('.screen.vl-screen', { timeout: 15000 });
  pruefe('"Ansehen" fuehrt hin (ohne gespeicherte Analyse in den Verlauf) und erledigt den Hinweis', await n.seite.evaluate(() => location.hash) === '#verlauf'
    && (await modulImBrowser(n.seite)).fahrplan.erledigt.includes('analyse'));
  await n.seite.evaluate(() => window.__app.gehe('arena', {}, { ersetzen: true }));
  await n.seite.waitForSelector('.screen.arena .knoten');
  pruefe('am selben Tag kein zweiter Hinweis', await zeile(n.seite) === null);
  // naechster Tag: die Einstufung; Ausblenden
  const gestern = await vor(-1);
  let mm = await modulImBrowser(n.seite);
  mm.fahrplan.heute.tag = gestern;
  mm.fahrplan.start = gestern;
  await bereite(n.seite, { modul: mm, fortschritt: { bots: { benno: { sterne: [false, false, false], partien: 1, niederlagen: 1 } } } }, '#arena');
  zl = await zeile(n.seite);
  pruefe('naechster Tag: "Neu für dich: Die Einstufung"', zl && zl.id === 'einstufung', JSON.stringify(zl));
  await n.seite.locator('.st-neu .st-neu-weg').click();
  await n.seite.waitForFunction(() => !document.querySelector('.heute-karte .st-neu'), null, { timeout: 5000 });
  pruefe('Ausblenden: Zeile weg, die leere Heute-Karte verschwindet, im Modul erledigt', await n.seite.evaluate(() => document.querySelector('.heute-karte').hidden)
    && (await modulImBrowser(n.seite)).fahrplan.erledigt.includes('einstufung'));
  await n.seite.reload();
  await n.seite.waitForSelector('.screen.arena .knoten');
  pruefe('nach dem Neuladen am selben Tag: nichts', await zeile(n.seite) === null);
  // abschaltbar
  mm = await modulImBrowser(n.seite);
  mm.fahrplan.heute.tag = gestern;
  mm.fahrplan.erledigt = ['analyse'];
  await bereite(n.seite, { modul: mm, einstellungen: { hinweise: false } }, '#arena');
  pruefe('Hinweise aus (Paket-Einstellung): keine Zeile, obwohl die Einstufung dran waere', await zeile(n.seite) === null);
  // Gruppe "Erste Schritte"
  gruppe = 'Einstellungen';
  await bereite(n.seite, { modul: modulMit({}, { einstufung: { tag: t, rechenstand: 1, punkte: 5.5, geloest: 6, ersterVersuch: 5, gesamt: 8,
    je: [['stufe-1', 1], ['stufe-2', 1], ['stufe-3', 1], ['stufe-4', 1], ['stufe-5', 0.5], ['stufe-6', 0], ['stufe-7', 1], ['stufe-8', 0]], botId: 'lisa' } }) }, '#einstellungen');
  const g = await n.seite.evaluate(() => {
    const el = document.querySelector('.st-gruppe');
    const vorFortschritt = !!el && el.compareDocumentPosition(document.querySelector('[aria-labelledby="es-g-fortschritt"]')) & Node.DOCUMENT_POSITION_FOLLOWING;
    return { titel: el.querySelector('h3').textContent, schalter: el.querySelector('[role="switch"]').getAttribute('aria-checked'), stand: el.querySelector('.st-g-stand').textContent,
      knopf: el.querySelector('.st-g-einstufen').textContent, knoepfe: [...el.querySelectorAll('.st-g-knoepfe .knopf')].map((k) => k.textContent), vor: !!vorFortschritt };
  });
  const tt = t.slice(8, 10) + '.' + t.slice(5, 7) + '.';
  pruefe('Gruppe "Erste Schritte" vor "Fortschritt": Schalter "Neu für dich" (an), Stand der Einstufung, Willkommen, Regel-Hilfe', g.titel === 'Erste Schritte' && g.schalter === 'true'
    && g.stand === `${tt} · 6 von 8 gelöst · Empfehlung Lisa Läufer` && g.knopf === 'Zur Empfehlung' && g.knoepfe.join('|') === 'Willkommen ansehen|Regel-Hilfe' && g.vor, JSON.stringify(g));
  await n.seite.locator('.st-gruppe').scrollIntoViewIfNeeded();
  await bild(n.seite, 'einstellungen-ipad');
  await n.seite.locator('.st-gruppe [role="switch"]').click();
  pruefe('Schalter aus: Paket-Einstellung hinweise false', await n.seite.evaluate((P) => (JSON.parse(localStorage.getItem(P + 'einstellungen:start') || 'null') || {}).hinweise, P) === false
    && await n.seite.evaluate(() => document.querySelector('.st-gruppe [role="switch"]').getAttribute('aria-checked')) === 'false');
  await n.seite.locator('.st-gruppe .st-g-willkommen').click();
  await warteSeite(n.seite, 'w1');
  pruefe('"Willkommen ansehen": Seite 1 des Willkommens', (await sz(n.seite)).seite === 'w1');
  // erster Sieg (Ereignis wie aus partie.js, Fortschritt mit genau einem Sieg)
  gruppe = 'Erster Sieg';
  await bereite(n.seite, { modul: modulMit({}), fortschritt: { bots: { benno: { sterne: [true, false, false], partien: 2, siege: 1, niederlagen: 1 } } } }, '#arena');
  const sieg = await n.seite.evaluate(async () => {
    const { sende } = await import('/js/ereignisse.js');
    const { fuerOverlay } = await import('/js/feier.js');
    sende('partie:beendet', { laufId: 'l1', partieId: 'psieg1', botId: 'benno', ergebnis: 'sieg', wertet: true, eigeneZuege: 23, modus: 'normal' });
    const a = fuerOverlay('psieg1').map((f) => ({ quelle: f.quelle, art: f.art, titel: f.titel, text: f.text }));
    sende('partie:beendet', { laufId: 'l2', partieId: 'psieg2', botId: 'benno', ergebnis: 'sieg', wertet: true, eigeneZuege: 20, modus: 'normal' });
    const b = fuerOverlay('psieg2').map((f) => f.quelle);
    return { a, b };
  });
  pruefe('erster wertender Sieg: grosse Feier-Zeile "Dein erster Sieg · Gegen Bauer Benno, in 23 Zügen"', sieg.a.length === 1 && sieg.a[0].quelle === 'erster-sieg'
    && sieg.a[0].art === 'gross' && sieg.a[0].titel === 'Dein erster Sieg' && sieg.a[0].text === 'Gegen Bauer Benno, in 23 Zügen', JSON.stringify(sieg));
  const ms = await modulImBrowser(n.seite);
  pruefe('nur einmal (gemerkt im Modul), letzte Partie gemerkt', sieg.b.length === 0 && ms.ersterSieg === 'psieg1' && ms.letzte === 'psieg2', JSON.stringify({ b: sieg.b, ms }));
  pruefe('keine Konsolenfehler (Heute-Karte, Einstellungen, Feier)', n.fehler.length === 0, n.fehler.join(' | '));
  await n.kontext.close();

  // kleines iPad quer (1024 x 768): neuer Spieler nach der ersten Partie, die Heute-Karte zeigt "Neu für dich", der
  // Spielen-Knopf bleibt ganz im Bild (eine zweizeilige Zeile schob ihn frueher 6 px unter den Rand)
  gruppe = 'iPad 1024 x 768';
  const k = await neueSeite(browser, { w: 1024, h: 768 });
  await k.seite.goto(BASIS + '#arena');
  await k.seite.waitForSelector('.screen.arena .knoten', { timeout: 20000 });
  const tk = await heuteImBrowser(k.seite);
  await bereite(k.seite, {
    modul: { v: 1, gesehen: tk, regeln: null, einstufung: null, ersterSieg: '', letzte: 'p1', fahrplan: { start: tk, erfahren: false, heute: null, erledigt: [], benutzt: [] } },
    partien: [{ id: 'p1', botId: 'benno', spielerFarbe: 'w', datum: new Date().toISOString(), zuege: ['e2e4'], ergebnis: 'niederlage', modus: 'normal' }],
    fortschritt: { bots: { benno: { sterne: [false, false, false], partien: 1, siege: 0, remis: 0, niederlagen: 1 } }, brillanteZuege: [] },
  }, '#arena');
  await warte(900);
  const kl = await k.seite.evaluate(() => {
    const b = document.querySelector('.detail [data-aktion="spielen"]').getBoundingClientRect();
    const z = document.querySelector('.heute-karte .st-neu');
    const sm = z && z.querySelector('small');
    return { zeile: z ? z.dataset.entdeckung : null, unten: Math.round(b.bottom), hoehe: Math.round(b.height), innerHeight, satzGanz: !!sm && sm.scrollWidth <= sm.clientWidth + 1 };
  });
  pruefe('Hinweis "Die Spielanalyse" in der Heute-Karte, Satz ganz, Spielen-Knopf ganz im Bild und mindestens 44 px hoch', kl.zeile === 'analyse' && kl.satzGanz
    && kl.unten <= kl.innerHeight && kl.hoehe >= 44, JSON.stringify(kl));
  await bild(k.seite, 'heute-neu-ipad-1024');
  pruefe('keine Konsolenfehler (iPad 1024 x 768)', k.fehler.length === 0, k.fehler.join(' | '));
  await k.kontext.close();

  // ---------- Handy und dunkel ----------
  for (const [name, w, h, handy, dunkel] of [['handy-hell', 390, 844, true, false], ['handy-dunkel', 390, 844, true, true], ['ipad-dunkel', 1180, 820, false, true],
    ['handy-klein', 375, 667, true, false]]) {
    gruppe = name;
    const hs = await neueSeite(browser, { w, h, handy, dunkel });
    await hs.seite.goto(BASIS);
    await hs.seite.waitForSelector('.st-screen .st-titel', { timeout: 20000 });
    for (const s of ['w1', 'w2', 'w3', 'frage']) {
      if (s !== 'w1') {
        await hs.seite.locator('[data-st="weiter"]').click();
        await warteSeite(hs.seite, s);
      }
      await warte(500);
      const l = await layout(hs.seite);
      pruefe(`${s}: nichts ragt seitlich heraus, "Ich kenne mich aus" im Bild, Titel ganz, Knoepfe mindestens 44 px`, l.quer && l.raus && l.titel && !l.klein.length && l.punkte, JSON.stringify(l));
      if (name !== 'handy-klein' || s === 'w1') await bild(hs.seite, `${s}-${name}`);
    }
    if (handy && w === 390) {
      // Einstufung bis zur Empfehlung: alles mit "Loesung zeigen" (0 Punkte -> Bauer Benno, normale Partie)
      await hs.seite.locator('[data-st="ja"]').click();
      await warteSeite(hs.seite, 'einstufung');
      await bild(hs.seite, `einstufung-${name}`);
      await hs.seite.locator('[data-st="einstufung-start"]').click();
      await warteRaetsel(hs.seite, 'z.offen && z.quelle === "start-einstufung" && z.phase === "flo"');
      await ziehe(hs.seite, 'h5f7', { handy: true });
      await warteRaetsel(hs.seite, 'z.phase === "geloest"');
      await bild(hs.seite, `einstufung-aufgabe-${name}`);
      await weiterImRaetsel(hs.seite, 1);
      for (let i = 1; i < 8; i++) {
        await hs.seite.locator('.rs-zeigen').click();
        await warteRaetsel(hs.seite, 'z.phase === "gezeigt"', null, 12000);
        if (i < 7) await weiterImRaetsel(hs.seite, i + 1);
      }
      await hs.seite.locator('.rs-weiter').click();
      await hs.seite.waitForSelector('.rs-ende:not([hidden]) .rs-ende-karte', { timeout: 8000 });
      pruefe('Einstufung mit 1 Punkt: "Starte gegen Bauer Benno", normale Partie', await hs.seite.evaluate(() => document.querySelector('.rs-ende h2').textContent) === 'Starte gegen Bauer Benno'
        && await hs.seite.evaluate(() => [...document.querySelectorAll('.rs-ende-knoepfe .knopf')].map((k) => k.textContent.trim()).join('|')) === 'Gegen Bauer Benno spielen|Fertig');
      await hs.seite.locator('.rs-ende .rs-fertig').click();
      await warteSeite(hs.seite, 'empfehlung');
      const l = await layout(hs.seite);
      pruefe('Empfehlung: nichts ragt heraus, Knoepfe mindestens 44 px', l.quer && l.raus && l.titel && !l.klein.length, JSON.stringify(l));
      await bild(hs.seite, `empfehlung-${name}`);
      // Heute-Karte mit "Neu für dich" auf dem Handy: eine Kopfzeile, nichts ragt heraus, Knoepfe mindestens 44 px
      const th = await heuteImBrowser(hs.seite);
      await bereite(hs.seite, { modul: { v: 1, gesehen: th, regeln: null, einstufung: null, ersterSieg: '', letzte: 'pprobe1',
        fahrplan: { start: th, erfahren: false, heute: null, erledigt: [], benutzt: [] } } }, '#arena');
      await hs.seite.locator('.heute-karte .st-neu').scrollIntoViewIfNeeded();
      const hz = await hs.seite.evaluate(() => {
        const z = document.querySelector('.heute-karte .st-neu');
        const r = z.getBoundingClientRect();
        const kopf = z.querySelector('.st-neu-kopf');
        const zeilen = Math.round(kopf.getBoundingClientRect().height / parseFloat(getComputedStyle(kopf).lineHeight));
        return { quer: document.documentElement.scrollWidth <= innerWidth + 1 && r.right <= innerWidth + 1 && r.left >= 0,
          knoepfe: [...z.querySelectorAll('button')].map((b) => Math.round(Math.min(b.getBoundingClientRect().height, b.getBoundingClientRect().width))),
          zeilen, text: kopf.textContent.replace(/\s+/g, ' ').trim(), satzGanz: z.querySelector('small').scrollWidth <= z.querySelector('small').clientWidth + 1 };
      });
      pruefe('Heute-Karte: "Neu für dich: Die Spielanalyse" in einer Zeile, Satz nicht abgeschnitten, nichts ragt heraus, Knoepfe mindestens 44 px',
        hz.quer && hz.zeilen === 1 && hz.satzGanz && hz.text === 'Neu für dich: Die Spielanalyse' && hz.knoepfe.length === 2 && hz.knoepfe.every((h) => h >= 44), JSON.stringify(hz));
      await bild(hs.seite, `heute-neu-${name}`);
    }
    pruefe('keine Konsolenfehler', hs.fehler.length === 0, hs.fehler.join(' | '));
    await hs.kontext.close();
  }

  // ---------- Produktion: das Paket aus der Liste PAKETE (wie nach der Integration) ----------
  gruppe = 'PAKETE';
  const pr = await neueSeite(browser);
  await pr.seite.route('**/js/erweiterungen.js', (r) => r.fulfill({ status: 200, contentType: 'text/javascript',
    body: `export const PAKETE = Object.freeze(['sicherung', '${ERW}']);\nexport const REITER = Object.freeze([]);\n` }));
  await pr.seite.goto(`http://127.0.0.1:${PORT}/index.html`);
  await pr.seite.waitForSelector('.st-screen .st-titel', { timeout: 20000 });
  const prod = await pr.seite.evaluate(() => ({ hash: location.hash, css: !!document.querySelector('link[data-paket="start"]'), test: !!window.__start }));
  pruefe('ohne ?test aus PAKETE geladen: erster Start zeigt das Willkommen, eigenes CSS, keine Test-Schnittstelle', prod.hash === '#start' && prod.css && !prod.test, JSON.stringify(prod));
  pruefe('keine Konsolenfehler (Produktion)', pr.fehler.length === 0, pr.fehler.join(' | '));
  await pr.kontext.close();

  // ---------- ohne Paket: nur die Screen-Datei liegt da (vor der Integration, Router-Test in app.test.mjs) ----------
  gruppe = 'Ohne Paket';
  const op = await neueSeite(browser);
  // PAKETE ohne start (so wie vor der Integration; nach ihr steht das Paket dort und wird hier herausgenommen)
  await op.seite.route('**/js/erweiterungen.js', (r) => r.fulfill({ status: 200, contentType: 'text/javascript',
    body: "export const PAKETE = Object.freeze(['sicherung']);\nexport const REITER = Object.freeze([]);\n" }));
  await op.seite.goto(`http://127.0.0.1:${PORT}/index.html?test#start`);
  await op.seite.waitForFunction(() => location.hash === '#arena' && document.title === 'Crownmate' && !!document.querySelector('.screen.arena'), null, { timeout: 20000 });
  const ohne = await op.seite.evaluate(() => ({ st: !!document.querySelector('.st-screen'), platzhalter: !!document.querySelector('.screen.platzhalter'),
    css: !!document.querySelector('link[data-paket="start"]'), zustand: history.state && history.state.name }));
  await op.seite.evaluate(() => window.__app.gehe('raetsel', { quelle: 'start-einstufung' }));
  await op.seite.waitForFunction(() => location.hash === '#arena' && !!document.querySelector('.screen.arena') && !document.querySelector('.rs-screen'), null, { timeout: 15000 });
  pruefe('#start ohne Paket-Einstieg: still zur Arena (kein Willkommen, kein Platzhalter, Verlauf in der App), Raetsel-Quellen nicht angemeldet',
    !ohne.st && !ohne.platzhalter && !ohne.css && ohne.zustand === 'arena' && await op.seite.evaluate(() => !document.querySelector('.rs-screen')), JSON.stringify(ohne));
  pruefe('keine Konsolenfehler (ohne Paket)', op.fehler.length === 0, op.fehler.join(' | '));
  await op.kontext.close();
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
