// Tests fuer den Tester-Bericht (Luecken-Check 10): js/protokoll.js (rein lokales Fehlerprotokoll) und js/bericht.js
// ("Bericht fuer die Testphase" in den Einstellungen, Gruppe "Info und Lizenzen").
// Teil 1 in Node: Bereinigen (keine Adressen, Abfragen, E-Mail, Token, Kennungen, lokalen Pfade), Grenzen (50 Eintraege,
//   20.000 Zeichen, auch auf dem echten Schreibweg), Speicherort ausserhalb von rohSpeicher() (nicht in Sicherung und
//   Cloud-Spielstand, bleibt bei "Fortschritt zuruecksetzen" und beim Einlesen einer alten Sicherung), Spielzaehler, System
//   aus dem User-Agent, Berichtstext Deutsch und Englisch (Sende-Aussagen nur fuer den Bericht), kein Netz im Quelltext,
//   Fehler von Ereignis-Hoerern und Anzeige-Anbietern (Melder), zwei Tabs auf demselben Speicher.
// Teil 2 im Browser (Playwright, echte App, eigener Server): gefangene Fehler und abgelehnte Promises, Paket- und
//   Engine-Fehler, "Speicher voll", Grenzen, das Blatt mit dem ganzen Bericht, Kopieren (Zwischenablage und
//   Rueckfall), Teilen nur mit navigator.share, Fehlerliste leeren, Fokusfalle (Tab, Shift+Tab, abgeschalteter Knopf),
//   nichts geht ins Netz, weniger Bewegung, Englisch, App-Version vom Service Worker, Engine-Startzeit, Screen-Abstuerze und
//   Screens, die nicht laden, Hoerer- und Anbieter-Fehler, Pakete, die zu lange laden, zwei Tabs, Blatt auf dem iPhone mit
//   Sicherheitsabstaenden (nur Chromium: CDP).
//
//   node tests/bericht.test.mjs              beides
//   node tests/bericht.test.mjs --nur-node   nur Teil 1
//   PORT=9790 node tests/bericht.test.mjs    Port des Testservers (sonst 8897)
//   BROWSER=webkit node tests/bericht.test.mjs
//
// Playwright: PLAYWRIGHT_PFAD, sonst 'playwright', sonst /opt/node-tools/node_modules/playwright.
import http from 'node:http';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { begrenzt } from './zeitwaechter.mjs';
import { browserTyp } from './browser.mjs';
import { leseSw } from './sw.test.mjs';

const require = createRequire(import.meta.url);
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8897);
const BASIS = `http://127.0.0.1:${PORT}/`;
const NUR_NODE = process.argv.includes('--nur-node');

const ergebnisse = [];
let gruppe = '';
function pruefe(name, ok, detail = '') {
  ergebnisse.push({ name: (gruppe ? gruppe + ': ' : '') + name, ok: !!ok, detail });
  const d = typeof detail === 'string' ? detail : JSON.stringify(detail);
  console.log(`${ok ? 'ok    ' : 'FEHLER'} ${gruppe ? gruppe + ': ' : ''}${name}${!ok && d ? ' (' + d.slice(0, 600) + ')' : ''}`);
}
const warte = (ms) => new Promise((r) => setTimeout(r, ms));
const lies = (d) => readFileSync(path.join(WURZEL, d), 'utf8');

class Speicher {
  constructor(start = {}) { this.m = new Map(Object.entries(start)); }
  get length() { return this.m.size; }
  key(i) { return [...this.m.keys()][i] ?? null; }
  getItem(k) { return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { this.m.set(k, String(v)); }
  removeItem(k) { this.m.delete(k); }
}

// Spuren, die nie im Protokoll oder Bericht stehen duerfen
const EMAIL = 'flo.tester@example.com';
const KONTO_ID = 'a1b2c3d4-0000-4000-8000-123456789abc';
const GEHEIM = 'GEHEIM123';
const NAME_ZUZWEIT = 'Tante Probe';
const FEN = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3';
const FEN_RE = /[rnbqkpRNBQKP1-8]{1,8}(\/[rnbqkpRNBQKP1-8]{1,8}){7}/;
const spurenIn = (text) => [EMAIL, '@', KONTO_ID, 'a1b2c3d4', GEHEIM, 'GEHEIM456', 'token=G', 'beispiel.example', NAME_ZUZWEIT, '127.0.0.1', 'http']
  .filter((s) => String(text).includes(s)).concat(FEN_RE.test(String(text)) ? ['FEN'] : []);

// ---------- Vorbereitete Spielgeschichte (Tage relativ zu heute, Grenze 4:00 aus js/tag.js) ----------
async function geschichte() {
  const T = await import('../js/tag.js');
  const { BOTS } = await import('../js/bots.js');
  const heute = T.tagSchluessel();
  const am = (k, stunde = 12) => new Date(T.beginnVon(T.addiereTage(heute, -k)).getTime() + (stunde - 4) * 3600e3).toISOString();
  const [a, b, c] = BOTS.map((x) => x.id);
  const partien = [
    { id: 'p1', datum: am(0, 14), botId: a, ergebnis: 'niederlage', modus: 'normal', hinweise: 2, analysiert: true, zuege: [] },
    { id: 'p2', datum: am(0, 12), botId: a, ergebnis: 'niederlage', modus: 'normal', analysiert: true, zuege: [] },
    // Uebung (aus einer Stellung): zaehlt als Partie, aber nicht als "zuletzt besiegt"
    { id: 'p3', datum: am(1), botId: c, ergebnis: 'sieg', modus: 'uebung', startFen: FEN, analysiert: true, zuege: [] },
    { id: 'p4', datum: am(2), botId: b, ergebnis: 'sieg', modus: 'normal', analysiert: true, zuege: [] },
    { id: 'p5', datum: am(10), botId: a, ergebnis: 'remis', modus: 'normal', analysiert: true, zuege: [] },
    // Zu zweit: Namen der Spieler duerfen nie in den Bericht
    { id: 'p6', datum: am(20), modus: 'zuzweit', ergebnis: 'sieg', zuzweit: { weiss: NAME_ZUZWEIT, schwarz: 'Gast' }, zuege: [] },
    { id: 'p7', datum: am(40), botId: a, ergebnis: 'sieg', modus: 'normal', analysiert: true, zuege: [] },
  ];
  const raetsel = { v: 1, tage: { [T.addiereTage(heute, -1)]: { e: [[0, 1]] }, [T.addiereTage(heute, -6)]: { e: [[1, 1], [3, 0]] },
    [T.addiereTage(heute, -40)]: { e: [[0, 1]] } } };
  const kartei = { v: 1, karten: [{ id: 'p4:12', geuebt: heute }, { id: 'p4:14', geuebt: T.addiereTage(heute, -3) },
    { id: 'p5:20', geuebt: T.addiereTage(heute, -50) }], verarbeitet: [], heute: { tag: '', ids: [] },
  zaehler: { erstellt: 3, gemeistert: 0, richtig: 2, falsch: 1 } };
  return { heute, partien, raetsel, kartei, bots: { a, b, c } };
}
// erwartete Zaehler zu geschichte()
const ERWARTET = { tage7: 3, tage28: 5, partien28: 6, uebungen28: 1, jeSpieltag: 1.2, hinweiseJePartie: 0.3, niederlagenFolge: 2,
  raetsel28: { geloest: 2, versucht: 3 }, karten: { geuebt28: 2, gesamt: 3 } };

// =====================================================================
// Teil 1: Node
// =====================================================================
async function nodeTeil() {
  globalThis.localStorage = new Speicher();
  const storage = await import('../js/storage.js');
  storage.setzeSpeicher(globalThis.localStorage);
  const P = await import('../js/protokoll.js');
  P.setzeLager(globalThis.localStorage);

  gruppe = 'Bereinigen';
  const roh = `Kaputt https://beispiel.example/schach/js/app.js?token=${GEHEIM}#anker von ${EMAIL}`;
  const b1 = P.bereinige(roh);
  pruefe('Adresse mit ?token=...: nur der Dateiname bleibt, Herkunft, Abfrage und Anker fallen weg', b1.includes('app.js')
    && !/beispiel|token|GEHEIM|anker|https?:|\/schach\//.test(b1), b1);
  pruefe('E-Mail-Adresse fällt weg', !b1.includes('@') && !b1.includes('flo.tester'), b1);
  const b2 = P.bereinige(`Abgelehnt ?access_token=GEHEIM456&x=1 Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.c2lnbmF0dXJl uid: ${KONTO_ID}`);
  pruefe('Token, Bearer, JWT und Konto-ID fallen weg', !/GEHEIM456|eyJ|a1b2c3d4|c2lnbmF0dXJl/.test(b2) && /Bearer \[weg\]/.test(b2), b2);
  const b3 = P.bereinige('at C:\\Users\\FloPrivat\\Desktop\\probe.js:7 und /home/flopriv/projekt/js/app.js:12:5');
  pruefe('Lokale Pfade (mit Benutzernamen): nur Dateiname und Zeile', b3.includes('probe.js:7') && b3.includes('app.js:12')
    && !/FloPrivat|flopriv|Users|home/.test(b3), b3);
  const b4 = P.bereinige('blob:http://127.0.0.1:8897/6f1c2a3b-1111-4222-8333-123456789abc und data:text/plain,abc und 127.0.0.1:8897/js/engine.js');
  pruefe('blob:, data: und Adresse ohne Schema', !/127\.0\.0\.1|6f1c2a3b|text\/plain/.test(b4) && b4.includes('engine.js'), b4);
  pruefe('Dateinamen bleiben lesbar (stockfish-19-lite-single.wasm)', P.bereinige('Engine-Datei nicht erreichbar (404) stockfish-19-lite-single.wasm')
    === 'Engine-Datei nicht erreichbar (404) stockfish-19-lite-single.wasm');
  const lang = P.bereinige('x'.repeat(500));
  pruefe(`Text hoechstens ${P.TEXT_MAX} Zeichen (TEXT_MAX 200)`, P.TEXT_MAX === 200 && lang.length === 200 && lang.endsWith('…'), lang.length);
  pruefe('ersterOrt: Chrome- und Safari-Stack, nur Dateiname und Zeile',
    JSON.stringify(P.ersterOrt('TypeError: x\n    at f (https://h.example/js/ui/einstellungen.js?v=2:120:5)')) === '{"datei":"einstellungen.js","zeile":120}'
    && JSON.stringify(P.ersterOrt('f@https://h.example/schach/js/app.js:12:3')) === '{"datei":"app.js","zeile":12}' && P.ersterOrt('ohne Ort') === null);
  pruefe('dateiName: nie Herkunft oder Ordner', P.dateiName('https://beispiel.example') === '' && P.dateiName('https://x/js/app.js?a=1#b') === 'app.js'
    && P.dateiName('/home/flo/x') === '');

  gruppe = 'Protokoll';
  pruefe('Schluessel unter schach-arena:, aber nicht unter schach-arena:v1: (nie in rohSpeicher)',
    P.PROTOKOLL_SCHLUESSEL === 'schach-arena:protokoll' && !P.PROTOKOLL_SCHLUESSEL.startsWith(storage.rohSpeicher().praefix));
  const fehler = new Error(roh);
  fehler.stack = `Error: ${roh}\n    at f (https://beispiel.example/schach/js/ui/partie.js?v=1:77:9)`;
  const e1 = P.protokolliere('fehler', fehler);
  pruefe('Eintrag: Zeit, Art, bereinigter Text, Datei und Zeile aus dem Stack, kein Stack', e1 && e1.art === 'fehler' && Number.isFinite(e1.z)
    && e1.datei === 'partie.js' && e1.zeile === 77 && e1.text.startsWith('Error: Kaputt app.js') && spurenIn(JSON.stringify(e1)).length === 0
    && !('stack' in e1), e1);
  P.protokolliere('fehler', fehler);
  P.protokolliere('fehler', fehler);
  pruefe('gleicher Eintrag direkt hintereinander: eine Zeile mit n = 3', P.eintraege().length === 1 && P.eintraege()[0].n === 3, P.eintraege());
  P.protokolliere('promise', { code: 7 });
  pruefe('Wert ohne Meldung: nur der Typ, nie als JSON', P.eintraege()[0].text === '(Object)', P.eintraege()[0]);
  P.protokolliere('unsinn', 'x');
  pruefe('unbekannte Art wird "fehler"', P.eintraege()[0].art === 'fehler');
  const sofort = localStorage.getItem(P.PROTOKOLL_SCHLUESSEL);
  pruefe('der erste Eintrag steht sofort im Speicher (localStorage), ohne Spuren', !!sofort && JSON.parse(sofort).eintraege.length >= 1
    && spurenIn(sofort).length === 0, sofort);
  await warte(1150);   // danach hoechstens einmal je Sekunde geschrieben
  const gespeichert = localStorage.getItem(P.PROTOKOLL_SCHLUESSEL);
  pruefe('weitere Eintraege spaetestens nach einer Sekunde im Speicher', !!gespeichert && JSON.parse(gespeichert).eintraege.length === 3
    && spurenIn(gespeichert).length === 0, gespeichert);

  gruppe = 'Grenzen';
  P.setzeLager(new Speicher());
  const lager = new Speicher();
  P.setzeLager(lager);
  for (let i = 0; i < 60; i++) P.protokolliere('fehler', new Error(`Grenze Nr. ${i} ` + 'y'.repeat(400)));
  const liste = P.eintraege();
  pruefe('hoechstens 50 Eintraege (MAX_EINTRAEGE), die neuesten zuerst', P.MAX_EINTRAEGE === 50 && liste.length === 50
    && liste[0].text.includes('Nr. 59') && liste[49].text.includes('Nr. 10'), liste.length + ' ' + (liste[0] && liste[0].text.slice(0, 30)));
  await warte(1150);   // geschrieben wird hoechstens einmal je Sekunde
  const json = lager.getItem(P.PROTOKOLL_SCHLUESSEL) || '';
  pruefe('gespeichert hoechstens 20.000 Zeichen (MAX_ZEICHEN) und die 50 neuesten', P.MAX_ZEICHEN === 20000 && json.length > 5000
    && json.length <= 20000 && JSON.parse(json).eintraege.length === 50 && JSON.parse(json).eintraege[0].text.includes('Nr. 59'), json.length);
  const klein = P.kuerze(liste, { maxZeichen: 2000 });
  pruefe('kuerze: Zeichengrenze greift (die neuesten bleiben)', klein.length > 0 && klein.length < 50 && JSON.stringify({ v: 1, eintraege: klein, engine: null }).length <= 2000
    && klein[0].text.includes('Nr. 59'), klein.length);
  pruefe('kuerze: Eintragsgrenze greift', P.kuerze(liste, { maxEintraege: 5 }).length === 5);
  // Zeichengrenze auf dem echten Schreibweg (protokolliere): Anfuehrungszeichen und Rueckstriche verdoppelt JSON, so kommen
  // 50 Eintraege ueber 20.000 Zeichen (die Flut oben mit 'y' bleibt bei etwa 13.000, dort griffe die Grenze nie)
  const zeichenLager = new Speicher();
  P.setzeLager(zeichenLager);
  for (let i = 0; i < 60; i++) {
    P.protokolliere('fehler', new Error(`Nr ${i} ` + '"\\'.repeat(150)), { datei: 'eine-recht-lange-datei-' + i + '.js', zeile: 123456 });
  }
  await warte(1150);
  const zj = zeichenLager.getItem(P.PROTOKOLL_SCHLUESSEL) || '';
  const zl = zj ? JSON.parse(zj).eintraege : [];
  const ohneGrenze = zl.length ? JSON.stringify({ v: 1, eintraege: Array(50).fill(zl[0]), engine: null }).length : 0;
  pruefe('Flut mit Anfuehrungszeichen waere ohne Zeichengrenze laenger als 20.000 Zeichen (sonst prueft der Test nichts)', ohneGrenze > 21000, ohneGrenze);
  pruefe('Zeichengrenze auf dem Schreibweg: gespeichert hoechstens 20.000 Zeichen, deshalb weniger als 50 Eintraege, die neuesten lueckenlos zuerst',
    zj.length <= 20000 && zj.length > 15000 && zl.length > 30 && zl.length < 50 && zl.every((e, i) => e.text.startsWith(`Error: Nr ${59 - i} `))
    && P.eintraege().length === zl.length, { zeichen: zj.length, eintraege: zl.length, erster: zl[0] && zl[0].text.slice(0, 20) });
  // von Hand veraenderter Speicher: beim Laden noch einmal bereinigt
  const hand = new Speicher({ [P.PROTOKOLL_SCHLUESSEL]: JSON.stringify({ v: 1, eintraege: [{ z: 1, art: 'fehler', text: `https://x.example/a.js?token=${GEHEIM} ${EMAIL}`, datei: 'https://x.example/js/a.js?x=1', zeile: 3 },
    { z: 2, art: 'gibtsnicht', text: 'weg' }], engine: { ms: 900, z: 5 } }) });
  P.setzeLager(hand);
  const h = P.eintraege();
  pruefe('beim Laden noch einmal bereinigt, falsche Eintraege fallen weg', h.length === 1 && h[0].datei === 'a.js' && spurenIn(JSON.stringify(h)).length === 0, h);
  pruefe('Engine-Startzeit wird gelesen', P.engineStart() && P.engineStart().ms === 900);
  P.leere();
  pruefe('leere(): Fehlerliste leer, die Engine-Startzeit bleibt', P.eintraege().length === 0 && JSON.parse(hand.getItem(P.PROTOKOLL_SCHLUESSEL)).engine.ms === 900);
  const ohne = new Speicher();
  P.setzeLager(ohne);
  P.protokolliere('fehler', 'eins');
  P.leere();
  pruefe('leere() ohne Engine-Startzeit: Schluessel ganz weg', ohne.getItem(P.PROTOKOLL_SCHLUESSEL) === null);
  // voller Speicher: kein Fehler nach aussen, Liste bleibt im Arbeitsspeicher, kein speicher:fehler (keine Schleife)
  const voll = new Speicher();
  voll.setItem = () => { const f = new Error('voll'); f.name = 'QuotaExceededError'; throw f; };
  P.setzeLager(voll);
  const { hoere } = await import('../js/ereignisse.js');
  let speicherFehler = 0;
  const ab = hoere('speicher:fehler', () => { speicherFehler++; });
  let warf = false;
  try { P.protokolliere('fehler', 'im vollen Speicher'); } catch (e) { warf = true; }
  ab();
  pruefe('voller Speicher: kein Fehler, Eintrag im Arbeitsspeicher, kein speicher:fehler', !warf && P.eintraege().length === 1 && speicherFehler === 0);

  gruppe = 'Sicherung, Cloud, Zuruecksetzen';
  const ls = new Speicher();
  globalThis.localStorage = ls;
  storage.setzeSpeicher(ls);
  P.setzeLager(ls);
  ls.setItem('schach-arena:v1:partien', JSON.stringify([{ id: 'p1' }]));
  ls.setItem('schach-arena:v1:fortschritt', JSON.stringify({ bots: {} }));
  ls.setItem('schach-arena:v1:einstellungen', JSON.stringify({ klang: false }));
  P.protokolliere('fehler', 'vor der Sicherung');
  const S = await import('../js/sicherung.js');
  const sich = S.erstelleSicherung(new Date(2026, 9, 29, 12));
  pruefe('Sicherung (Export) traegt das Protokoll nicht', !(P.PROTOKOLL_SCHLUESSEL in sich.daten) && Object.keys(sich.daten).length === 4
    && Object.keys(sich.daten).every((k) => k.startsWith('schach-arena:v1:')), Object.keys(sich.daten));
  // alte Sicherung (Version 1: Liste statt Abbildung) einlesen: klappt, das Protokoll des Geraets bleibt
  const alt = { format: S.SICHERUNG_FORMAT, version: 1, erstellt: new Date(2026, 9, 1, 12).getTime(),
    speicher: [['schach-arena:v1:partien', JSON.stringify([{ id: 'a' }, { id: 'b' }])], ['schach-arena:v1:fortschritt', '{"bots":{}}']] };
  let altOk = false;
  try { S.uebernehmeSicherung(S.pruefeSicherung(JSON.stringify(alt)), new Date(2026, 9, 29, 13)); altOk = true; } catch (e) { altOk = e.message; }
  pruefe('alte Sicherung (Version 1) wird weiter eingelesen, das Protokoll bleibt dabei stehen', altOk === true
    && JSON.parse(ls.getItem('schach-arena:v1:partien')).length === 2 && JSON.parse(ls.getItem(P.PROTOKOLL_SCHLUESSEL)).eintraege.length >= 1, altOk);
  let traegt = null;
  try { S.pruefeSicherung({ ...sich, daten: { ...sich.daten, [P.PROTOKOLL_SCHLUESSEL]: ls.getItem(P.PROTOKOLL_SCHLUESSEL) } }); traegt = 'angenommen'; } catch (e) { traegt = 'abgelehnt'; }
  pruefe('eine Datei mit Protokoll-Schluessel bringt nie ein Protokoll mit (abgelehnt, nichts geschrieben)', traegt === 'abgelehnt');
  const konto = await import('../js/konto.js');
  const cloud = konto.lokalerStand();
  pruefe('Cloud-Spielstand (konto.lokalerStand) ohne Protokoll', !(P.PROTOKOLL_SCHLUESSEL in cloud) && Object.keys(cloud).length >= 2, Object.keys(cloud));
  ls.setItem('schach-arena:v1:einstellungen', JSON.stringify({ klang: false }));
  storage.setzeZurueck();
  pruefe('"Fortschritt zuruecksetzen": Fortschritt weg, Protokoll (Diagnose) bleibt', ls.getItem('schach-arena:v1:partien') === null
    && ls.getItem(P.PROTOKOLL_SCHLUESSEL) !== null && ls.getItem('schach-arena:v1:einstellungen') !== null);

  gruppe = 'Bericht (rein)';
  const sprache = await import('../js/sprache.js');
  sprache.setzeSprache('de');
  const B = await import('../js/bericht.js');
  const g = await geschichte();
  const { BOTS } = await import('../js/bots.js');
  const name = (id) => BOTS.find((x) => x.id === id).name;
  const z = B.spielZaehler(g.partien, { heute: g.heute, raetsel: g.raetsel, kartei: g.kartei });
  const { letzterSieg, ...zahlen } = z;
  pruefe('Spielzaehler: Tage 7/28, Partien, je Spieltag, Uebungen, Hinweise, Folge, Raetsel, Karten', JSON.stringify(zahlen) === JSON.stringify(ERWARTET), z);
  pruefe('zuletzt besiegt: der Bot der neuesten Partie mit Sieg (ohne Uebungen und Zu zweit)', letzterSieg === name(g.bots.b), letzterSieg);
  pruefe('ohne Partien: Nullen, kein Bot', JSON.stringify(B.spielZaehler([], { heute: g.heute })) === JSON.stringify({ tage7: 0, tage28: 0, partien28: 0,
    uebungen28: 0, jeSpieltag: 0, hinweiseJePartie: null, letzterSieg: '', niederlagenFolge: 0, raetsel28: null, karten: null }));
  const UA = {
    ipad: 'Mozilla/5.0 (iPad; CPU OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
    ipadDesktop: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Safari/605.1.15',
    ipadApp: 'Mozilla/5.0 (iPad; CPU OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
    ios26: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1',
    android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.58 Mobile Safari/537.36',
    windows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.2849.56',
    headless: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.7390.37 Safari/537.36',
  };
  const s = (ua, touch = 0) => { const x = B.systemAus(ua, { touch }); return `${x.system}|${x.browser}`; };
  pruefe('System und Browser: nur Familie und Hauptversion', s(UA.ipad, 5) === 'iPadOS 18|Safari 18' && s(UA.ipadDesktop, 5) === 'iPadOS 18|Safari 18'
    && s(UA.ipadDesktop, 0) === 'macOS|Safari 18' && s(UA.ipadApp, 5) === 'iPadOS 17|WebKit' && s(UA.ios26, 5) === 'iOS 26|Safari 26'
    && s(UA.android) === 'Android 14|Chrome 130' && s(UA.windows) === 'Windows|Edge 130' && s(UA.headless) === 'Linux|Chrome 141' && s('') === '|',
    Object.values(UA).map((u) => s(u, 5)));
  pruefe('Bildschirm-Klasse und Lage', JSON.stringify([B.groesseVon(1180, 820), B.groesseVon(390, 844), B.groesseVon(1920, 1200)])
    === '[{"klasse":"mittel","lage":"quer"},{"klasse":"klein","lage":"hoch"},{"klasse":"gross","lage":"quer"}]');
  const fakten = {
    erstellt: new Date(2026, 9, 29, 14, 5).getTime(),
    app: { version: 94, stand: 'abcdef123456', sprache: 'de' },
    geraet: { system: 'iPadOS 18', browser: 'Safari 18', homescreen: true, groesse: B.groesseVon(1180, 820), simd: true, engineMs: 850,
      klang: { zustand: 'bereit', paket: 'arcade', geladen: 40, dateien: 40, fehlt: 0 } },
    speicher: { dauerhaft: true, belegtMb: 12.34, quoteMb: 1024, zeichen: 51234, grenze: 2500000 },
    spiel: z,
    // ein Eintrag, der (z. B. von Hand) ungereinigt hineinkam: der Bericht bereinigt noch einmal
    fehler: [{ z: new Date(2026, 9, 29, 13, 58).getTime(), art: 'promise', text: `Abgelehnt https://beispiel.example/x?token=${GEHEIM} ${EMAIL} ${KONTO_ID}`, datei: 'app.js', zeile: 12, n: 2 }],
  };
  const de = B.berichtText(fakten);
  const zeilen = de.split('\n');
  pruefe('Deutsch: Titel, Hinweis und alle Abschnitte', zeilen[0] === 'Crownmate · Bericht für die Testphase' && zeilen.includes('Nur Zähler und Gerätedaten. Diesen Bericht hat die App nicht gesendet.')
    && ['App', 'Gerät', 'Speicher', 'Spielen', 'Letzte Fehler (1)'].every((k) => zeilen.includes(k)), de);
  const muss = ['- Version: 94 (Stand abcdef123456)', '- Sprache: Deutsch', '- Vom Home-Bildschirm gestartet: ja', '- System: iPadOS 18', '- Browser: Safari 18',
    '- Bildschirm: mittel (Tablet), quer', '- WebAssembly mit SIMD: ja', '- Engine-Start: 850 ms (zuletzt gemessen)',
    '- Klang: bereit (arcade, 40 von 40 Klängen geladen, 0 fehlen)', '- Dauerhafter Speicher (persist): ja', '- Browser-Speicher: 12,3 MB von 1.024 MB belegt',
    '- Spielstand im Speicher: 50 KB (2 % der Grenze)', '- Tage mit Partien: 3 von 7, 5 von 28', '- Partien in 28 Tagen: 6 (1,2 je Spieltag; Übungen: 1)',
    '- Hinweise je Partie: 0,3', `- Zuletzt besiegt: ${name(g.bots.b)}`, '- Niederlagen in Folge: 2', '- Tagesrätsel (28 Tage): 2 von 3 gelöst',
    '- Fehler-Kartei: geübt in 28 Tagen: 2, Karten gesamt: 3'];
  const fehlt = muss.filter((x) => !zeilen.includes(x));
  pruefe('Deutsch: alle Zaehler und Geraete-Fakten', fehlt.length === 0, fehlt);
  const fz = zeilen[zeilen.length - 1];
  pruefe('Fehlerzeile: Zeit, Art, Datei:Zeile, Text, Anzahl', /^- 29\.10\., 13:58 · Promise · app\.js:12 · Abgelehnt \[adresse\] \[e-mail\] \[id\] · 2×$/.test(fz), fz);
  pruefe('Bericht ohne E-Mail, Konto-ID, Token, Adressen, Namen aus Zu zweit und FEN', spurenIn(de).length === 0, spurenIn(de));
  const ohneSw = B.berichtText({ ...fakten, app: { version: null, sprache: 'de' }, fehler: [], geraet: { ...fakten.geraet, engineMs: null } });
  pruefe('ohne Service Worker, ohne Fehler, Engine noch nie gestartet', ohneSw.includes('- Version: unbekannt (ohne Service Worker)')
    && ohneSw.includes('Letzte Fehler (0)\nKeine Fehler gespeichert.') && ohneSw.includes('- Engine-Start: noch nicht gemessen'), ohneSw);
  sprache.setzeSprache('en');
  const zEn = B.spielZaehler(g.partien, { heute: g.heute, raetsel: g.raetsel, kartei: g.kartei });
  const en = B.berichtText({ ...fakten, app: { ...fakten.app, sprache: 'en' }, spiel: zEn });
  const zeilenEn = en.split('\n');
  const mussEn = ['Crownmate · Report for the test phase', 'Counters and device facts only. The app has not sent this report.', 'Device', 'Storage', 'Playing',
    'Latest errors (1)', '- Version: 94 (build abcdef123456)', '- Language: English', '- Started from the home screen: yes', '- Screen: medium (tablet), landscape',
    '- WebAssembly with SIMD: yes', '- Browser storage: 12.3 MB of 1,024 MB used', '- Days with games: 3 of 7, 5 of 28',
    '- Games in 28 days: 6 (1.2 per playing day; practice: 1)', `- Last bot beaten: ${name(g.bots.b)}`, '- Losses in a row: 2',
    '- Daily puzzle (28 days): 2 of 3 solved', '- Slip-up cards: practiced in 28 days: 2, cards in total: 3'];
  const fehltEn = mussEn.filter((x) => !zeilenEn.includes(x));
  pruefe('Englisch: Abschnitte, Zaehler und Fakten', fehltEn.length === 0, fehltEn);
  pruefe('Englisch: ohne Umlaute und ohne Spuren', !/[äöüÄÖÜß]/.test(en) && spurenIn(en).length === 0, en);
  // Mit Konto und eingeschalteter Datenfreigabe sendet js/daten.js Fehler der App als Nutzungsereignis (datenschutz.html
  // Abschnitt 6): Aussagen zum Senden duerfen deshalb nur fuer den Bericht gelten, nie "die App sendet nichts"
  const absolut = /sendet nichts|hat nichts gesendet|nichts von selbst|sends nothing|has sent nothing|nothing on its own/i;
  const enTexte = [sprache.t('bericht.eintragText'), sprache.t('bericht.hinweis'), sprache.t('bericht.blattText')];
  sprache.setzeSprache('de');
  const deTexte = [sprache.t('bericht.eintragText'), sprache.t('bericht.hinweis'), sprache.t('bericht.blattText')];
  pruefe('Sende-Aussagen gelten nur fuer den Bericht (Deutsch und Englisch), keine sagt "die App sendet nichts"',
    deTexte[0].endsWith('Den Bericht sendet die App nie von selbst.') && deTexte[1] === 'Nur Zähler und Gerätedaten. Diesen Bericht hat die App nicht gesendet.'
    && enTexte[0].endsWith('The app never sends this report on its own.') && enTexte[1] === 'Counters and device facts only. The app has not sent this report.'
    && ![...deTexte, ...enTexte].some((x) => absolut.test(x)), { deTexte, enTexte });
  const absatz = (datei, muster) => (lies(datei).split('</p>').find((x) => muster.test(x)) || '');
  const dsDe = absatz('datenschutz.html', /Fehlerliste leeren/);
  const dsEn = absatz('datenschutz-en.html', /Clear error list/);
  pruefe('Datenschutz (de/en): der Absatz zur Fehlerliste nennt die Fehler, die mit Datenfreigabe gesendet werden (Abschnitt 6)',
    /nie automatisch gesendet/.test(dsDe) && /Nutzungsereignis/.test(dsDe) && /Abschnitt 6/.test(dsDe)
    && /never sent automatically/.test(dsEn) && /usage events/.test(dsEn) && /section 6/.test(dsEn), { dsDe, dsEn });

  gruppe = 'Quelltext';
  const netz = /\bfetch\s*\(|sendBeacon|XMLHttpRequest|WebSocket|EventSource|\.open\(\s*['"](GET|POST)|mailto:/;
  pruefe('protokoll.js und bericht.js senden nichts (kein fetch, Beacon, XHR, WebSocket, mailto)', !netz.test(lies('js/protokoll.js')) && !netz.test(lies('js/bericht.js')));
  pruefe('app.js laedt protokoll.js als ersten Import', /^import [^\n]*from '\.\/protokoll\.js';/m.test(lies('js/app.js'))
    && lies('js/app.js').indexOf("from './protokoll.js'") < lies('js/app.js').indexOf('import '.concat('* as erweiterungen')));
  pruefe('Einstellungen laden js/bericht.js erst beim Tipp (dynamisches import)', /import\('\.\.\/bericht\.js'\)/.test(lies('js/ui/einstellungen.js'))
    && !/from '\.\.\/bericht\.js'/.test(lies('js/ui/einstellungen.js')));
  const sw = leseSw();
  pruefe('neue Dateien im Offline-Cache (sw.js DATEIEN)', ['js/protokoll.js', 'js/bericht.js', 'js/sprachen/bericht.js'].every((d) => sw.DATEIEN.includes(d)));
  // auch fuer WebKit (dort fehlt der CDP-Test im Browser-Teil): die Hoehe des Blatts zieht beide Sicherheitsabstaende ab
  const regel = (lies('css/einstellungen.css').match(/\.sheet-karte\.bericht-blatt\s*\{[^}]*\}/) || [''])[0];
  const hoehen = regel.match(/max-height:[^;]+/g) || [];
  pruefe('CSS: max-height des Blatts zieht safe-area-inset-top und -bottom ab (vh und dvh)', hoehen.length === 2
    && hoehen.every((h) => h.includes('env(safe-area-inset-bottom') && h.includes('env(safe-area-inset-top')) && hoehen.some((h) => h.includes('100dvh')), hoehen);

  // ---------- Melder: Ereignis-Hoerer und Anzeige-Anbieter fangen ihre Fehler selbst ----------
  gruppe = 'Hoerer und Anbieter';
  const melderLager = new Speicher();
  P.setzeLager(melderLager);
  const E = await import('../js/ereignisse.js');
  const O = await import('../js/orte.js');
  const konsole = console.error;
  console.error = () => {};
  let warfNachAussen = false;
  try {
    const ab = [
      E.hoere('app:sichtbar', () => { throw new TypeError(`Hoerer kaputt ${EMAIL}`); }),
      O.anbieten('einstellungen:gruppen', () => { throw new Error(`Anbieter kaputt https://beispiel.example/x?token=${GEHEIM}`); }, { paket: 'probe' }),
      O.anbieten('partie:begruessung?', () => { throw new RangeError('Wahl kaputt'); }),
    ];
    E.sende('app:sichtbar', {});
    O.fuelle('einstellungen:gruppen', { appendChild() {} }, {});
    O.waehle('partie:begruessung?', {});
    ab.forEach((f) => f());
  } catch (e) { warfNachAussen = e; } finally { console.error = konsole; }
  const mt = P.eintraege().map((e) => e.text);
  pruefe('sende und fuelle geben den Fehler weiter nicht nach aussen', warfNachAussen === false, String(warfNachAussen));
  pruefe('Fehler eines Ereignis-Hoerers (sende faengt ihn) steht im Protokoll, bereinigt', mt.includes('Ereignis app:sichtbar: TypeError: Hoerer kaputt [e-mail]'), mt);
  pruefe('Fehler eines Anzeige-Anbieters (fuelle und waehle fangen ihn) steht im Protokoll, mit Paket und Ort, bereinigt',
    mt.includes('Anbieter probe an einstellungen:gruppen: Error: Anbieter kaputt [adresse]') && mt.includes('Anbieter an partie:begruessung?: RangeError: Wahl kaputt'), mt);
  pruefe('ohne Spuren', spurenIn(JSON.stringify(P.eintraege())).length === 0, P.eintraege());
  // eigene Instanzen (Abfrage in der Adresse): ein Melder, der selbst wirft, stoert nichts, und zuruecksetzen() laesst ihn stehen
  const E2 = await import('../js/ereignisse.js?melder');
  const O2 = await import('../js/orte.js?melder');
  const gemeldet = [];
  E2.setzeFehlerMelder((name, f) => { gemeldet.push(name + ' ' + f.message); throw new Error('Melder kaputt'); });
  O2.setzeFehlerMelder((ort, paket, f) => { gemeldet.push(ort + ' ' + paket + ' ' + f.message); throw new Error('Melder kaputt'); });
  E2.zuruecksetzen();
  O2.zuruecksetzen();
  let stoert = false;
  console.error = () => {};
  try {
    E2.hoere('app:bereit', () => { throw new Error('a'); });
    E2.sende('app:bereit', {});
    O2.anbieten('arena:kopf', () => { throw new Error('b'); }, { paket: 'p' });
    O2.fuelle('arena:kopf', { appendChild() {} }, {});
  } catch (e) { stoert = e; } finally { console.error = konsole; }
  pruefe('Melder, der wirft: kein Fehler nach aussen; Melder bleibt nach zuruecksetzen()', stoert === false && gemeldet.join('|') === 'app:bereit a|arena:kopf p b', { stoert: String(stoert), gemeldet });
  E2.setzeFehlerMelder(null);
  O2.setzeFehlerMelder(null);

  // ---------- Zwei Tabs (zwei Modul-Instanzen auf demselben Speicher, wie zwei offene Tabs) ----------
  // Am Ende von Teil 1: Die zweite Instanz meldet sich selbst als Melder an.
  gruppe = 'Zwei Tabs';
  const geteilt = new Speicher();
  const A = P;
  const Bt = await import('../js/protokoll.js?tab=b');
  A.setzeLager(geteilt);
  Bt.setzeLager(geteilt);
  const gespeicherteTexte = () => (JSON.parse(geteilt.getItem(P.PROTOKOLL_SCHLUESSEL) || '{"eintraege":[]}').eintraege || []).map((e) => e.text);
  A.protokolliere('fehler', new Error('Alt aus Tab A'));
  pruefe('Tab B sieht den Eintrag aus Tab A', Bt.eintraege().map((e) => e.text).join() === 'Error: Alt aus Tab A', Bt.eintraege());
  A.leere();
  pruefe('Tab A leert die Liste', geteilt.getItem(P.PROTOKOLL_SCHLUESSEL) === null && Bt.eintraege().length === 0);
  Bt.merkeEngineStart(123);
  const nachLeeren = JSON.parse(geteilt.getItem(P.PROTOKOLL_SCHLUESSEL) || 'null');
  pruefe('nach "Fehlerliste leeren" in Tab A bringt ein Schreiben in Tab B (Engine-Start) die geloeschten Eintraege nicht zurueck',
    !!nachLeeren && nachLeeren.eintraege.length === 0 && nachLeeren.engine && nachLeeren.engine.ms === 123 && A.engineStart() && A.engineStart().ms === 123, nachLeeren);
  await warte(1150);   // beide Schreib-Uhren abgelaufen: der naechste Eintrag wird sofort geschrieben
  Bt.protokolliere('fehler', new Error('Neu aus Tab B'));
  A.protokolliere('fehler', new Error('Zweiter aus Tab A'));
  pruefe('zwei Tabs ueberschreiben nie die Eintraege des anderen (beide neuen, kein alter, Engine-Startzeit bleibt)',
    gespeicherteTexte().join('|') === 'Error: Zweiter aus Tab A|Error: Neu aus Tab B' && JSON.parse(geteilt.getItem(P.PROTOKOLL_SCHLUESSEL)).engine.ms === 123,
    geteilt.getItem(P.PROTOKOLL_SCHLUESSEL));
  pruefe('beide Tabs zeigen denselben Stand', A.eintraege().map((e) => e.text).join('|') === Bt.eintraege().map((e) => e.text).join('|'));
  // ein eigener, noch nicht geschriebener Eintrag (Schreib-Uhr laeuft) bleibt erhalten, wenn der andere Tab inzwischen schreibt
  A.protokolliere('fehler', new Error('Wartend in Tab A'));
  Bt.leere();
  Bt.protokolliere('fehler', new Error('Spaet aus Tab B'));
  await warte(1150);
  pruefe('ein noch wartender Eintrag kommt nach dem Leeren im anderen Tab dazu, der andere Tab verliert nichts',
    [...gespeicherteTexte()].sort().join('|') === 'Error: Spaet aus Tab B|Error: Wartend in Tab A', gespeicherteTexte());
}

// =====================================================================
// Teil 2: Browser
// =====================================================================
const TYPEN = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.wasm': 'application/wasm',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg',
};
const server = http.createServer((req, res) => {
  let pfad;
  try { pfad = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch (e) { pfad = '/'; }
  if (pfad.endsWith('/')) pfad += 'index.html';
  const datei = path.resolve(WURZEL, '.' + pfad);
  let st = null;
  try { st = datei.startsWith(WURZEL + path.sep) ? statSync(datei) : null; } catch (e) { st = null; }
  if (!st || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('Nicht gefunden'); return; }
  res.writeHead(200, { 'Content-Type': TYPEN[path.extname(datei).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  res.end(readFileSync(datei));
});

function ladePlaywright() {
  for (const k of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
    try { return require(k); } catch (e) { /* naechster */ }
  }
  throw new Error('Playwright nicht gefunden (PLAYWRIGHT_PFAD setzen)');
}

const CHROMIUM = (process.env.BROWSER || 'chromium') === 'chromium';

async function neueSeite(browser, { daten = null, init = null, reduziert = false, zwischenablage = false, sw = false } = {}) {
  const kontext = await browser.newContext({ viewport: { width: 1024, height: 768 }, deviceScaleFactor: 1, locale: 'de-DE',
    reducedMotion: reduziert ? 'reduce' : 'no-preference', serviceWorkers: sw ? 'allow' : 'block' });
  kontext.setDefaultTimeout(20000);
  if (zwischenablage && CHROMIUM) await kontext.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASIS.slice(0, -1) });
  // Spielstand einmal je Seite vorbereiten (vor dem Laden der App; ein Neuladen setzt ihn nicht zurueck)
  if (daten) {
    await kontext.addInitScript((d) => {
      if (sessionStorage.getItem('__saat')) return;
      sessionStorage.setItem('__saat', '1');
      for (const [k, v] of Object.entries(d)) localStorage.setItem(k, v);
    }, daten);
  }
  if (init) await kontext.addInitScript(init);
  const seite = await kontext.newPage();
  const fremd = [];
  seite.on('request', (r) => { if (!r.url().startsWith(BASIS) && !/^(data|blob):/.test(r.url())) fremd.push(r.method() + ' ' + r.url()); });
  return { kontext, seite, fremd };
}

const protokoll = (seite) => seite.evaluate(() => JSON.parse(localStorage.getItem('schach-arena:protokoll') || 'null'));
// geschrieben wird sofort, danach hoechstens einmal je Sekunde: auf einen Eintrag warten (Text als RegExp-Quelle)
const warteAufEintrag = (seite, muster, ms = 3000) => seite.waitForFunction((m) => {
  const p = JSON.parse(localStorage.getItem('schach-arena:protokoll') || 'null');
  return !!p && p.eintraege.some((e) => new RegExp(m).test(e.text));
}, muster, { timeout: ms }).catch(() => {});
const zuEinstellungen = async (seite, suche = '?test&kern') => {
  // #einstellungen/info: auf dem Handy ist Info eine eigene Seite (Liste der Bereiche), breiter wird dorthin gerollt
  await seite.goto(BASIS + 'index.html' + suche + '#einstellungen/info');
  await seite.waitForSelector('.es-screen .es-info [data-aktion="bericht"]', { timeout: 20000 });
};
async function oeffneBericht(seite) {
  await seite.locator('.es-info [data-aktion="bericht"]').click();
  await seite.waitForSelector('.sheet-karte.bericht-blatt .bericht-text', { timeout: 15000 });
  return seite.evaluate(() => document.querySelector('.bericht-blatt .bericht-text').textContent);
}

async function speicherDaten() {
  const g = await geschichte();
  return {
    g,
    daten: {
      'schach-arena:v1:partien': JSON.stringify(g.partien),
      'schach-arena:v1:modul:tagesraetsel': JSON.stringify(g.raetsel),
      'schach-arena:v1:modul:kartei': JSON.stringify(g.kartei),
      // Spuren, die der Bericht nie zeigen darf (Konto-ID in der Zustimmung, Zu-zweit-Namen in den Einstellungen)
      'schach-arena:daten:zustimmung': JSON.stringify({ konto: KONTO_ID, datum: '2026-10-20', fassung: 1 }),
      'schach-arena:v1:einstellungen:zuzweit': JSON.stringify({ weiss: NAME_ZUZWEIT, schwarz: EMAIL }),
    },
  };
}

// ---------- Protokoll in der echten App ----------
async function testeProtokoll(browser) {
  gruppe = 'Browser Protokoll';
  const { kontext, seite, fremd } = await neueSeite(browser);
  try {
    await zuEinstellungen(seite);
    pruefe('ohne Fehler kein Protokoll im Speicher', (await protokoll(seite)) === null);
    await seite.evaluate(({ GEHEIM, EMAIL }) => {
      setTimeout(() => { throw new Error(`Kaputt https://beispiel.example/schach/js/app.js?token=${GEHEIM}#x von ${EMAIL}`); }, 0);
      Promise.reject(new Error(`Abgelehnt ?access_token=GEHEIM456 fuer ${EMAIL}`));
    }, { GEHEIM, EMAIL });
    await seite.waitForFunction(() => { const p = JSON.parse(localStorage.getItem('schach-arena:protokoll') || 'null'); return p && p.eintraege.length >= 2; }, null, { timeout: 5000 }).catch(() => {});
    const p1 = await protokoll(seite);
    const arten = p1 ? p1.eintraege.map((e) => e.art).sort().join() : '';
    pruefe('geworfener Fehler und unbehandelte Ablehnung gefangen (Fenster-Hoerer)', arten === 'fehler,promise', p1);
    const rohText = JSON.stringify(p1);
    pruefe('bereinigt gespeichert: keine Adresse, kein ?token=, keine E-Mail', spurenIn(rohText).length === 0 && /Kaputt app\.js/.test(rohText), rohText);
    // Speicher voll (Ereignis aus storage.js)
    await seite.evaluate(async () => {
      const { sende } = await import('/js/ereignisse.js');
      sende('speicher:fehler', { schluessel: 'schach-arena:v1:review:p123abc', grund: 'voll' });
    });
    await seite.waitForTimeout(1200);
    const p2 = await protokoll(seite);
    pruefe('"Speicher voll" (speicher:fehler) steht im Protokoll, ohne Partie-ID', p2 && p2.eintraege.some((e) => e.art === 'speicher' && e.text === 'voll (review)'), p2 && p2.eintraege[0]);
    // Sicherung im Browser: das Protokoll gehoert nicht hinein
    const schl = await seite.evaluate(async () => Object.keys((await import('/js/sicherung.js')).erstelleSicherung().daten));
    pruefe('Sicherung aus der App enthaelt das Protokoll nicht', schl.length > 0 && !schl.includes('schach-arena:protokoll'), schl);
    // Grenze: 60 Fehler in Folge
    await seite.evaluate(() => { for (let i = 0; i < 60; i++) setTimeout(() => { throw new Error('Flut Nr. ' + i + ' ' + 'z'.repeat(300)); }, 0); });
    await seite.waitForTimeout(1600);
    const p3 = await protokoll(seite);
    const laenge = await seite.evaluate(() => (localStorage.getItem('schach-arena:protokoll') || '').length);
    pruefe('Fehlerflut: hoechstens 50 Eintraege und 20.000 Zeichen, neueste zuerst', p3 && p3.eintraege.length === 50 && laenge <= 20000
      && /Flut Nr\. 59/.test(p3.eintraege[0].text), `${p3 && p3.eintraege.length} Eintraege, ${laenge} Zeichen`);
    // Zeichengrenze: Anfuehrungszeichen und Rueckstriche verdoppelt JSON, 50 solche Eintraege kaemen ueber 20.000 Zeichen
    await seite.evaluate(() => { for (let i = 0; i < 60; i++) setTimeout(() => { throw new Error('Zeichen Nr. ' + i + ' ' + '"\\'.repeat(150)); }, 0); });
    await seite.waitForTimeout(1600);
    const p4 = await protokoll(seite);
    const laenge4 = await seite.evaluate(() => (localStorage.getItem('schach-arena:protokoll') || '').length);
    const l4 = p4 ? p4.eintraege : [];
    const ohneGrenze = l4.length ? JSON.stringify({ v: 1, eintraege: Array(50).fill(l4[0]), engine: null }).length : 0;
    pruefe('Fehlerflut mit Anfuehrungszeichen: hoechstens 20.000 Zeichen, deshalb weniger als 50 Eintraege, die neuesten lueckenlos zuerst',
      ohneGrenze > 21000 && laenge4 <= 20000 && laenge4 > 15000 && l4.length > 30 && l4.length < 50
      && l4.every((e, i) => e.text.startsWith(`Error: Zeichen Nr. ${59 - i} `)), { eintraege: l4.length, zeichen: laenge4, ohneGrenze });
    // Pakete fangen Fehler in ihrem eigenen sicher() (nur Konsole); seit 29.10. melden sie sie auch ans Protokoll
    await seite.evaluate(() => localStorage.removeItem('schach-arena:protokoll'));
    const huelle = await seite.evaluate(async (EMAIL) => {
      const D = await import('/js/pakete/start/dienst.js');
      const P = await import('/js/protokoll.js');
      P.leere();
      const r = D.sicher(() => { throw new Error(`Probe Huelle fuer ${EMAIL}`); }, 'Test');
      return { r, e: P.eintraege()[0] || null };
    }, EMAIL);
    pruefe('Paket-Huelle sicher() (start): faengt (null) und schreibt einen bereinigten Eintrag der Art paket mit Paket und Stelle',
      huelle.r === null && !!huelle.e && huelle.e.art === 'paket' && /^Paket start \(Test\): Error: Probe Huelle fuer /.test(huelle.e.text)
      && spurenIn(JSON.stringify(huelle.e)).length === 0, huelle);
    pruefe('nichts ging ins Netz', fremd.length === 0, fremd);
  } finally { await kontext.close(); }
  // Quelltext: jede sicher()-Huelle der Pakete meldet ans Protokoll (Schule ist raus und bleibt unberuehrt)
  const huellen = ['funken', 'gedaechtnis', 'kartei', 'liga', 'punkte', 'serie', 'tagesraetsel'].map((x) => `js/pakete/${x}/index.js`)
    .concat(['js/pakete/start/dienst.js']);
  const ohne = huellen.filter((d) => {
    const q = readFileSync(path.join(WURZEL, d), 'utf8');
    const m = /(?:function sicher\s*\()[\s\S]*?\n\}/.exec(q);
    return !m || !m[0].includes("protokolliere('paket'") || !q.includes("from '../../protokoll.js'");
  });
  pruefe('jede sicher()-Huelle der Pakete meldet ans Protokoll (funken, gedaechtnis, kartei, liga, punkte, serie, tagesraetsel, start)',
    ohne.length === 0, ohne);
}

async function testePaketUndEngine(browser) {
  gruppe = 'Browser Paket und Engine';
  const { kontext, seite, fremd } = await neueSeite(browser);
  try {
    // die Engine-Datei fehlt (404): engine() bricht ab
    await seite.route('**/vendor/stockfish/stockfish-19-lite-single.wasm', (r) => r.fulfill({ status: 404, contentType: 'text/plain', body: 'weg' }));
    await zuEinstellungen(seite, '?test&kern&erw=pakete/gibtsnicht/index');
    await seite.waitForFunction(() => { const p = JSON.parse(localStorage.getItem('schach-arena:protokoll') || 'null'); return p && p.eintraege.some((e) => e.art === 'paket'); }, null, { timeout: 8000 }).catch(() => {});
    const p1 = await protokoll(seite);
    const paket = p1 && p1.eintraege.find((e) => e.art === 'paket');
    pruefe('Paket, das nicht laedt (?erw): Eintrag mit Pfad, ohne Adresse', !!paket && paket.text.startsWith('pakete/gibtsnicht/index: ')
      && spurenIn(paket.text).length === 0, paket);
    const r = await seite.evaluate(() => window.__app.engine('bot').then(() => 'gestartet', () => 'abgebrochen'));
    await seite.waitForTimeout(1200);
    const p2 = await protokoll(seite);
    const eng = p2 && p2.eintraege.find((e) => e.art === 'engine');
    pruefe('Engine-Abbruch (Datei 404) im Protokoll', r === 'abgebrochen' && !!eng && /404/.test(eng.text) && spurenIn(eng.text).length === 0, { r, eng });
    pruefe('nichts ging ins Netz', fremd.length === 0, fremd);
  } finally { await kontext.close(); }
}

// ---------- Fehler beim Start eines Kern-Moduls (protokoll.js ist der erste Import von app.js) ----------
async function testeStartfehler(browser) {
  gruppe = 'Browser Startfehler';
  const { kontext, seite, fremd } = await neueSeite(browser);
  try {
    // ein Kern-Modul, das app.js NACH protokoll.js importiert, wirft beim Auswerten (wie ein kaputtes Update): die App
    // startet nicht, aber der Fehler steht im Protokoll und nach dem naechsten Start im Bericht
    const stub = "export const KLASSEN = []; export const SYMBOLE = {}; export const KLASSEN_NAME = {};\n"
      + "export function form() {} export function zeichen() {} export function symbolSprite() {} export function symbolDatei() {}\n"
      + "throw new Error('Startfehler-Probe beim Laden');\n";
    await seite.route('**/js/symbole.js', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: stub }));
    await seite.goto(BASIS + 'index.html?test&kern#einstellungen');
    await seite.waitForFunction(() => { const p = JSON.parse(localStorage.getItem('schach-arena:protokoll') || 'null'); return p && p.eintraege.length > 0; }, null, { timeout: 8000 }).catch(() => {});
    const p = await protokoll(seite);
    const e = p && p.eintraege.find((x) => /Startfehler-Probe/.test(x.text));
    pruefe('Fehler beim Auswerten eines Kern-Moduls steht im Protokoll (mit Datei)', !!e && e.art === 'fehler' && e.datei === 'symbole.js', p);
    await seite.unroute('**/js/symbole.js');
    await seite.reload();
    await seite.waitForSelector('.es-screen .es-info [data-aktion="bericht"]', { timeout: 20000 });
    const text = await oeffneBericht(seite);
    pruefe('nach dem naechsten Start zeigt der Bericht den Startfehler', /· Fehler · symbole\.js(:\d+)? · [^\n]*Startfehler-Probe beim Laden/.test(text), text.split('Letzte Fehler')[1]);
    pruefe('nichts ging ins Netz', fremd.length === 0, fremd);
  } finally { await kontext.close(); }
}

// ---------- Das Blatt mit dem Bericht (Deutsch, Zwischenablage) ----------
async function testeBlatt(browser) {
  gruppe = 'Browser Bericht';
  const { g, daten } = await speicherDaten();
  const { BOTS } = await import('../js/bots.js');
  (await import('../js/sprache.js')).setzeSprache('de');
  const bName = BOTS.find((b) => b.id === g.bots.b).name;
  const { kontext, seite, fremd } = await neueSeite(browser, { daten, zwischenablage: true });
  try {
    await zuEinstellungen(seite);
    const eintrag = await seite.evaluate(() => {
      const k = document.querySelector('.es-info .es-bericht [data-aktion="bericht"]');
      const r = k.getBoundingClientRect();
      return { text: k.textContent.trim(), hilfe: document.querySelector('.es-bericht .es-hilfe').textContent, h: r.height, w: r.width,
        gruppe: k.closest('section').querySelector('h3').textContent };
    });
    pruefe('Eintrag in "Info und Lizenzen", Tippflaeche >= 44 px', eintrag.text === 'Bericht für die Testphase' && eintrag.gruppe === 'Info und Lizenzen'
      && eintrag.h >= 44 && /Den Bericht sendet die App nie von selbst\.$/.test(eintrag.hilfe), eintrag);
    await seite.evaluate(({ GEHEIM, EMAIL }) => { setTimeout(() => { throw new Error(`Probe https://beispiel.example/a.js?token=${GEHEIM} ${EMAIL}`); }, 0); }, { GEHEIM, EMAIL });
    await seite.waitForTimeout(300);
    const text = await oeffneBericht(seite);
    const zeilen = text.split('\n');
    const muss = ['Crownmate · Bericht für die Testphase', 'App', 'Gerät', 'Speicher', 'Spielen', 'Letzte Fehler (1)', '- Version: unbekannt (ohne Service Worker)',
      '- Sprache: Deutsch', '- Bildschirm: mittel (Tablet), quer', '- WebAssembly mit SIMD: ja', '- Tage mit Partien: 3 von 7, 5 von 28',
      '- Partien in 28 Tagen: 6 (1,2 je Spieltag; Übungen: 1)', '- Hinweise je Partie: 0,3', `- Zuletzt besiegt: ${bName}`, '- Niederlagen in Folge: 2',
      '- Tagesrätsel (28 Tage): 2 von 3 gelöst', '- Fehler-Kartei: geübt in 28 Tagen: 2, Karten gesamt: 3'];
    const fehlt = muss.filter((x) => !zeilen.includes(x));
    pruefe('ganzer Bericht im Blatt: Abschnitte, Zaehler aus dem vorbereiteten Spielstand', fehlt.length === 0, { fehlt, text });
    pruefe('Geraete-Fakten: System, Browser, persist, estimate, Spielstand, Engine, Klang', /\n- System: \S/.test(text) && /\n- Browser: \S/.test(text)
      && /\n- Dauerhafter Speicher \(persist\): (ja|nein|unbekannt)\n/.test(text) && /\n- Browser-Speicher: [\d.,]+ MB von [\d.,]+ MB belegt\n/.test(text)
      && /\n- Spielstand im Speicher: [\d.,]+ KB \([\d.,]+ % der Grenze\)\n/.test(text) && /\n- Engine-Start: /.test(text) && /\n- Klang: /.test(text), text);
    pruefe('Fehler im Bericht, bereinigt', /\n- [^\n]* · Fehler · [^\n]*Probe a\.js \[e-mail\]/.test(text), text.split('Letzte Fehler')[1]);
    pruefe('keine E-Mail, Konto-ID, Token, Adressen, Zu-zweit-Namen oder FEN', spurenIn(text).length === 0, spurenIn(text));
    const animiert = await seite.evaluate(() => document.querySelector('.bericht-blatt').getAnimations().length);
    await seite.waitForTimeout(800);   // das Blatt ist hereingeglitten
    const blatt = await seite.evaluate(() => {
      const karte = document.querySelector('.bericht-blatt');
      const knoepfe = [...karte.querySelectorAll('.sheet-knoepfe button')];
      return { titel: karte.querySelector('h3').textContent, knoepfe: knoepfe.map((b) => b.dataset.knopf), hoehen: knoepfe.map((b) => b.getBoundingClientRect().height),
        teilen: typeof navigator.share === 'function', fokus: document.activeElement && document.activeElement.dataset.knopf,
        sichtbar: (() => { const r = karte.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight + 1; })() };
    });
    blatt.animiert = animiert;
    pruefe('Blatt: Titel, Knoepfe Kopieren, (Teilen), Fehlerliste leeren, Schliessen, alle >= 44 px, ganz im Bild', blatt.titel === 'Bericht für die Testphase'
      && blatt.knoepfe.join() === (blatt.teilen ? 'kopieren,teilen,leeren,schliessen' : 'kopieren,leeren,schliessen') && blatt.hoehen.every((h) => h >= 44) && blatt.sichtbar, blatt);
    pruefe('Teilen nur, wenn navigator.share da ist', blatt.knoepfe.includes('teilen') === blatt.teilen, blatt);
    pruefe('Fokus startet auf Kopieren (im Blatt)', blatt.fokus === 'kopieren', blatt.fokus);
    pruefe('normale Bewegung: das Blatt gleitet herein (Animation laeuft)', blatt.animiert >= 1, blatt.animiert);
    // Kopieren: genau der sichtbare Text
    await seite.locator('.bericht-blatt [data-knopf="kopieren"]').click();
    await seite.waitForFunction(() => /Kopiert/.test(document.querySelector('.bericht-status').textContent), null, { timeout: 5000 }).catch(() => {});
    const status = await seite.locator('.bericht-status').textContent();
    if (CHROMIUM) {
      const ablage = await seite.evaluate(() => navigator.clipboard.readText());
      pruefe('Kopieren: Zwischenablage enthaelt genau den Bericht aus dem Blatt', ablage === text && /^Kopiert\./.test(status), { status, gleich: ablage === text });
    } else pruefe('Kopieren meldet "Kopiert."', /^Kopiert\./.test(status), status);
    // Fehlerliste leeren
    await seite.locator('.bericht-blatt [data-knopf="leeren"]').click();
    await seite.waitForTimeout(200);
    const nach = await seite.evaluate(() => ({ text: document.querySelector('.bericht-text').textContent, status: document.querySelector('.bericht-status').textContent,
      aus: document.querySelector('[data-knopf="leeren"]').disabled, roh: localStorage.getItem('schach-arena:protokoll') }));
    const rest = nach.roh ? JSON.parse(nach.roh).eintraege.length : 0;
    pruefe('Fehlerliste leeren: Speicher leer, Bericht neu, Knopf aus, Hinweis', rest === 0 && nach.text.includes('Letzte Fehler (0)\nKeine Fehler gespeichert.')
      && nach.aus && nach.status === 'Fehlerliste geleert.', nach);
    // Fokusfalle: "leeren" ist jetzt aus, der Fokus steht auf dem Text. Tab und Shift+Tab laufen ringfoermig ueber den Text
    // ([tabindex="0"]) und die Knoepfe, bleiben im Blatt und landen nie auf dem abgeschalteten Knopf
    const wo = () => seite.evaluate(() => {
      const a = document.activeElement;
      return { name: a ? (a.dataset.knopf || (a.classList.contains('bericht-text') ? 'text' : a.tagName)) : '', drin: !!(a && a.closest('.bericht-blatt')) };
    });
    const folge = [await wo()];
    const tasten = ['Tab', 'Tab', 'Tab', 'Tab', 'Shift+Tab', 'Shift+Tab'];
    for (const taste of tasten) { await seite.keyboard.press(taste); folge.push(await wo()); }
    const reihe = blatt.teilen ? ['text', 'kopieren', 'teilen', 'schliessen'] : ['text', 'kopieren', 'schliessen'];
    const erwartet = ['text'];
    let stelle = 0;
    for (const taste of tasten) { stelle = (stelle + (taste === 'Tab' ? 1 : -1) + reihe.length) % reihe.length; erwartet.push(reihe[stelle]); }
    pruefe('Fokusfalle nach dem Leeren: Tab und Shift+Tab ringfoermig ueber Text und Knoepfe, im Blatt, nie auf dem abgeschalteten Knopf',
      folge.every((f) => f.drin) && folge.map((f) => f.name).join() === erwartet.join() && !folge.some((f) => f.name === 'leeren'),
      { folge: folge.map((f) => f.name + (f.drin ? '' : '(draussen)')), erwartet });
    if (CHROMIUM) {
      await seite.locator('.bericht-blatt [data-knopf="kopieren"]').click();
      await seite.waitForTimeout(200);
      pruefe('nach dem Leeren kopiert Kopieren den neuen Text', (await seite.evaluate(() => navigator.clipboard.readText())) === nach.text);
    }
    await seite.locator('.bericht-blatt [data-knopf="schliessen"]').click();
    await seite.waitForFunction(() => !document.querySelector('.sheet-ort:not(.weg)'), null, { timeout: 5000 }).catch(() => {});
    pruefe('Schliessen schliesst das Blatt', await seite.evaluate(() => !document.querySelector('.sheet-ort:not(.weg)')));
    pruefe('nichts ging ins Netz (nur eigene Dateien geladen)', fremd.length === 0, fremd);
  } finally { await kontext.close(); }
}

// ---------- Rueckfall beim Kopieren, Teilen, weniger Bewegung ----------
async function testeRueckfall(browser) {
  gruppe = 'Browser Rueckfall und Teilen';
  const { daten } = await speicherDaten();
  const init = () => {
    // keine Zwischenablage (aelteres Safari): Kopieren laeuft ueber ein markiertes Textfeld und execCommand('copy')
    Object.defineProperty(Navigator.prototype, 'clipboard', { configurable: true, get: () => undefined });
    document.execCommand = (befehl) => {
      if (befehl !== 'copy') return false;
      const f = document.activeElement;
      window.__kopiert = f && typeof f.value === 'string' ? f.value.slice(f.selectionStart, f.selectionEnd) : null;
      return true;
    };
    navigator.share = (d) => { window.__geteilt = d; return Promise.resolve(); };
  };
  const { kontext, seite, fremd } = await neueSeite(browser, { daten, init, reduziert: true });
  try {
    await zuEinstellungen(seite);
    const text = await oeffneBericht(seite);
    const sofort = await seite.evaluate(() => ({ karte: document.querySelector('.bericht-blatt').getAnimations().length,
      schleier: document.querySelector('.sheet-schleier').getAnimations().length }));
    pruefe('weniger Bewegung (prefers-reduced-motion): Blatt ohne Animation', sofort.karte === 0 && sofort.schleier === 0, sofort);
    pruefe('mit navigator.share: Knopf Teilen da', await seite.locator('.bericht-blatt [data-knopf="teilen"]').count() === 1);
    await seite.locator('.bericht-blatt [data-knopf="kopieren"]').click();
    await seite.waitForTimeout(200);
    const k = await seite.evaluate(() => ({ kopiert: window.__kopiert, status: document.querySelector('.bericht-status').textContent, feld: document.querySelectorAll('textarea').length }));
    pruefe('Rueckfall ohne Zwischenablage: markiertes Textfeld mit genau dem Bericht, danach wieder weg', k.kopiert === text && /^Kopiert\./.test(k.status) && k.feld === 0,
      { status: k.status, gleich: k.kopiert === text, feld: k.feld });
    await seite.locator('.bericht-blatt [data-knopf="teilen"]').click();
    await seite.waitForTimeout(200);
    const t = await seite.evaluate(() => ({ geteilt: window.__geteilt, status: document.querySelector('.bericht-status').textContent }));
    pruefe('Teilen: navigator.share bekommt genau den sichtbaren Text, keine Datei, keine Adresse', t.geteilt && t.geteilt.text === text
      && t.geteilt.title === 'Crownmate · Bericht für die Testphase' && !('url' in t.geteilt) && !('files' in t.geteilt) && t.status === 'Geteilt.', t);
    await seite.keyboard.press('Escape');
    await seite.waitForTimeout(200);
    pruefe('Escape schliesst das Blatt', await seite.evaluate(() => !document.querySelector('.sheet-ort:not(.weg)')));
    pruefe('nichts ging ins Netz', fremd.length === 0, fremd);
  } finally { await kontext.close(); }
}

// ---------- Englisch, mit allen Paketen, Service Worker und Engine-Startzeit ----------
async function testeEnglischMitSw(browser) {
  gruppe = 'Browser Englisch, Service Worker, Engine';
  const { kontext, seite, fremd } = await neueSeite(browser, { sw: true });
  try {
    await seite.goto(BASIS + 'index.html?test&sw&sprache=en#einstellungen');
    await seite.waitForSelector('.es-info [data-aktion="bericht"]', { timeout: 20000 });
    const eintrag = (await seite.locator('.es-info [data-aktion="bericht"]').textContent()).trim();
    pruefe('Eintrag auf Englisch', eintrag === 'Report for the test phase', eintrag);
    // warten, bis der Service Worker die Seite steuert (er laedt dafuer alle Dateien vor)
    await seite.waitForFunction(() => !!(navigator.serviceWorker && navigator.serviceWorker.controller), null, { timeout: 60000 });
    const start = await seite.evaluate(() => window.__app.engine('bewertung').then(() => 'ok', (e) => String(e && e.message)));
    const text = await oeffneBericht(seite);
    const sw = leseSw();
    const zeilen = text.split('\n');
    const muss = ['Crownmate · Report for the test phase', 'Device', 'Storage', 'Playing', 'Latest errors (0)', 'No errors saved.',
      `- Version: ${sw.VERSION} (build ${sw.STAND})`, '- Language: English', '- Days with games: 0 of 7, 0 of 28', '- Last bot beaten: none yet'];
    const fehlt = muss.filter((x) => !zeilen.includes(x));
    pruefe('Englisch: Abschnitte und Zaehler; Version und Stand vom Service Worker (Nachricht version)', fehlt.length === 0, { fehlt, text });
    pruefe('Engine-Startzeit gemessen', start === 'ok' && /\n- Engine start: [\d,]+ ms \(last measured\)\n/.test(text), { start, zeile: zeilen.find((z) => z.includes('Engine')) });
    pruefe('Englisch ohne Umlaute', !/[äöüÄÖÜß]/.test(text), text.match(/[^\n]*[äöüÄÖÜß][^\n]*/g));
    const knoepfe = await seite.evaluate(() => [...document.querySelectorAll('.bericht-blatt .sheet-knoepfe button')].map((b) => b.textContent));
    pruefe('Knoepfe auf Englisch', knoepfe.includes('Copy') && knoepfe.includes('Clear error list') && knoepfe.includes('Close'), knoepfe);
    // leere Fehlerliste: "Clear error list" ist schon beim Oeffnen aus, Tab springt von Copy darueber hinweg
    const vorTab = await seite.evaluate(() => ({ fokus: document.activeElement && document.activeElement.dataset.knopf,
      aus: document.querySelector('.bericht-blatt [data-knopf="leeren"]').disabled, teilen: typeof navigator.share === 'function' }));
    await seite.keyboard.press('Tab');
    const nachTab = await seite.evaluate(() => document.activeElement && document.activeElement.dataset.knopf);
    pruefe('leere Fehlerliste: Knopf aus, Tab springt von Copy ueber ihn hinweg', vorTab.fokus === 'kopieren' && vorTab.aus
      && nachTab === (vorTab.teilen ? 'teilen' : 'schliessen'), { vorTab, nachTab });
    pruefe('nichts ging ins Netz', fremd.length === 0, fremd);
  } finally { await kontext.close(); }
}

// ---------- Screens, Ereignis-Hoerer und Anzeige-Anbieter (fangen ihre Fehler selbst, ohne window 'error') ----------
async function testeScreensUndMelder(browser) {
  gruppe = 'Browser Screens, Hoerer, Anbieter';
  const { kontext, seite, fremd } = await neueSeite(browser);
  try {
    // ein Kern-Screen, dessen zeige() wirft (etwa eine WebKit-Luecke), und einer, der nicht laedt (Netz, alter Cache)
    await seite.route('**/js/ui/training.js', (r) => r.fulfill({ status: 200, contentType: 'text/javascript',
      body: `export function zeige() { throw new TypeError('Probe zeige wirft https://beispiel.example/x?token=${GEHEIM}'); }\n` }));
    await seite.route('**/js/ui/verlauf.js', (r) => r.fulfill({ status: 404, contentType: 'text/plain', body: 'weg' }));
    await zuEinstellungen(seite);
    pruefe('ohne Fehler kein Protokoll im Speicher', (await protokoll(seite)) === null);
    // Ereignis-Hoerer und Anzeige-Anbieter (DOM-Ort, Aufruf-Ort mit fertig), wie sie die Pakete anmelden
    await seite.evaluate(async (EMAIL) => {
      const { hoere, sende } = await import('/js/ereignisse.js');
      const { anbieten, fuelle } = await import('/js/orte.js');
      const ab = [
        hoere('app:sichtbar', () => { throw new TypeError('Probe Hoerer ' + EMAIL); }),
        anbieten('einstellungen:gruppen', () => { throw new Error('Probe Anbieter'); }, { paket: 'probe' }),
        anbieten('arena:start', () => ({ fertig: Promise.reject(new RangeError('Probe fertig')) }), { paket: 'probe' }),
      ];
      sende('app:sichtbar', {});
      const f = fuelle('einstellungen:gruppen', document.createElement('div'), {});
      const g = fuelle('arena:start', document.createElement('div'), {});
      await g.fertig;
      f.verlasse();
      g.verlasse();
      ab.forEach((x) => x());
    }, EMAIL);
    await seite.waitForTimeout(1200);
    const p1 = await protokoll(seite);
    const t1 = p1 ? p1.eintraege.map((e) => e.text) : [];
    pruefe('Fehler eines Ereignis-Hoerers steht im Protokoll (bereinigt)', t1.includes('Ereignis app:sichtbar: TypeError: Probe Hoerer [e-mail]'), t1);
    pruefe('Fehler eines Anzeige-Anbieters (fuelle und abgelehntes fertig) steht im Protokoll, mit Paket und Ort',
      t1.includes('Anbieter probe an einstellungen:gruppen: Error: Probe Anbieter') && t1.includes('Anbieter probe an arena:start: RangeError: Probe fertig'), t1);
    // Screen, dessen zeige() wirft: Platzhalter "Hoppla" und ein Eintrag
    await seite.evaluate(() => { location.hash = '#training'; });
    await seite.waitForFunction(() => document.documentElement.dataset.screen === 'training' && !!document.querySelector('.screen.platzhalter'), null, { timeout: 10000 }).catch(() => {});
    await warteAufEintrag(seite, '^Screen training: ');
    const p2 = await protokoll(seite);
    const absturz = p2 && p2.eintraege.find((e) => /^Screen training: /.test(e.text));
    pruefe('Screen, dessen zeige() wirft: Platzhalter sichtbar und Eintrag im Protokoll (bereinigt)', !!absturz && absturz.art === 'fehler'
      && absturz.text.startsWith('Screen training: TypeError: Probe zeige wirft') && spurenIn(absturz.text).length === 0
      && await seite.locator('.screen.platzhalter').count() === 1, p2 && p2.eintraege.slice(0, 3));
    // Kern-Screen, der nicht laedt (404)
    await seite.evaluate(() => { location.hash = '#verlauf'; });
    await seite.waitForFunction(() => document.documentElement.dataset.screen === 'verlauf' && !!document.querySelector('.screen.platzhalter'), null, { timeout: 10000 }).catch(() => {});
    await warteAufEintrag(seite, '^Screen verlauf: ');
    const p3 = await protokoll(seite);
    const laden = p3 && p3.eintraege.find((e) => /^Screen verlauf: /.test(e.text));
    pruefe('Kern-Screen, der nicht laedt: Platzhalter sichtbar und Eintrag (Art skript) ohne Adresse', !!laden && laden.art === 'skript'
      && spurenIn(laden.text).length === 0 && await seite.locator('.screen.platzhalter').count() === 1, p3 && p3.eintraege.slice(0, 3));
    // Paket-Screen ohne Datei (?kern: Pakete nicht geladen): still zur Arena, das ist kein Fehler und kommt nicht ins Protokoll
    await seite.evaluate(() => { location.hash = '#ich'; });
    await seite.waitForFunction(() => document.documentElement.dataset.screen === 'arena', null, { timeout: 10000 }).catch(() => {});
    await seite.waitForTimeout(1300);   // ein Eintrag stuende spaetestens jetzt im Speicher
    const p4 = await protokoll(seite);
    pruefe('Paket-Screen ohne Datei: still zur Arena, kein Eintrag', await seite.evaluate(() => document.documentElement.dataset.screen) === 'arena'
      && !!p4 && !p4.eintraege.some((e) => /Screen ich/.test(e.text)), p4 && p4.eintraege.map((e) => e.text));
    // der Bericht zeigt die Screen-Fehler (nicht "Keine Fehler gespeichert")
    await zuEinstellungen(seite);
    const text = await oeffneBericht(seite);
    pruefe('Bericht zeigt Screen-, Hoerer- und Anbieter-Fehler', /· Fehler · [^\n]*Screen training: TypeError: Probe zeige wirft/.test(text)
      && /· Skript · [^\n]*Screen verlauf: /.test(text) && /Ereignis app:sichtbar/.test(text) && !text.includes('Keine Fehler gespeichert.'),
      text.split('Letzte Fehler')[1]);
    pruefe('nichts ging ins Netz', fremd.length === 0, fremd);
  } finally { await kontext.close(); }

  // Pakete, die nach PAKETE_WARTEN_MS (10 s) noch laden: die App startet ohne sie, der Bericht nennt das Paket
  const neu = await neueSeite(browser);
  try {
    await neu.seite.route('**/js/pakete/haengt/index.js', (r) => {
      setTimeout(() => { r.fulfill({ status: 200, contentType: 'text/javascript', body: 'export {};' }).catch(() => {}); }, 20000);
    });
    // Nur bis die Seite da ist: Unter WebKit haelt die noch offene Anfrage des haengenden Pakets das load-Ereignis auf
    // (Chromium nicht). Auf den Einstellungen-Screen wartet die naechste Zeile.
    await neu.seite.goto(BASIS + 'index.html?test&kern&erw=pakete/haengt/index#einstellungen', { waitUntil: 'commit' });
    await neu.seite.waitForSelector('.es-screen .es-info [data-aktion="bericht"]', { timeout: 30000 });
    await neu.seite.waitForFunction(() => { const p = JSON.parse(localStorage.getItem('schach-arena:protokoll') || 'null'); return p && p.eintraege.some((e) => e.art === 'paket'); }, null, { timeout: 5000 }).catch(() => {});
    const p = await protokoll(neu.seite);
    const e = p && p.eintraege.find((x) => x.art === 'paket');
    pruefe('Paket, das nach 10 s noch laedt: Eintrag mit Pfad', !!e && e.text === 'Pakete: laden nach 10 s noch: pakete/haengt/index', p);
  } finally { await neu.kontext.close(); }
}

// ---------- Zwei Tabs im selben Browser (gleicher Speicher) ----------
async function testeZweiTabs(browser) {
  gruppe = 'Browser Zwei Tabs';
  const { kontext, seite: a, fremd } = await neueSeite(browser);
  try {
    const b = await kontext.newPage();
    b.on('request', (r) => { if (!r.url().startsWith(BASIS) && !/^(data|blob):/.test(r.url())) fremd.push(r.method() + ' ' + r.url()); });
    await zuEinstellungen(a);
    await zuEinstellungen(b);
    const wirf = (s, text) => s.evaluate((x) => { setTimeout(() => { throw new Error(x); }, 0); }, text);
    const texte = async () => ((await protokoll(a)) || { eintraege: [] }).eintraege.map((e) => e.text).filter((x) => / Tab [AB]$/.test(x));
    await wirf(a, 'Alt aus Tab A');
    await a.waitForTimeout(300);
    await wirf(b, 'Frueh aus Tab B');   // Tab B hat den Stand damit gelesen
    await a.waitForTimeout(1300);       // beide haben geschrieben, keine Schreib-Uhr laeuft mehr
    const vorher = await texte();
    pruefe('beide Tabs schreiben in dieselbe Liste', vorher.join('|') === 'Error: Frueh aus Tab B|Error: Alt aus Tab A', vorher);
    const textA = await oeffneBericht(a);
    pruefe('der Bericht in Tab A zeigt auch den Fehler aus Tab B', /Frueh aus Tab B/.test(textA) && /Alt aus Tab A/.test(textA), textA.split('Letzte Fehler')[1]);
    await a.locator('.bericht-blatt [data-knopf="leeren"]').click();
    await a.waitForTimeout(200);
    pruefe('Tab A leert die Liste', (await texte()).length === 0, await texte());
    await wirf(b, 'Neu aus Tab B');
    await warteAufEintrag(a, 'Neu aus Tab B$');
    const nach = await texte();
    pruefe('nach "Fehlerliste leeren" in Tab A bringt ein neuer Fehler in Tab B die geloeschten Eintraege nicht zurueck', nach.join('|') === 'Error: Neu aus Tab B', nach);
    await wirf(a, 'Zweiter aus Tab A');
    await warteAufEintrag(a, 'Zweiter aus Tab A$');
    const beide = await texte();
    pruefe('ein Tab ueberschreibt die Eintraege des anderen nicht', beide.join('|') === 'Error: Zweiter aus Tab A|Error: Neu aus Tab B', beide);
    await a.keyboard.press('Escape');
    // das alte Blatt gleitet noch hinaus: warten, bis es ganz weg ist (sonst laese oeffneBericht dessen Text)
    await a.waitForFunction(() => !document.querySelector('.sheet-ort'), null, { timeout: 5000 }).catch(() => {});
    const neuA = await oeffneBericht(a);
    pruefe('der Bericht liest frisch: beide neuen Fehler, keiner der geloeschten', /Zweiter aus Tab A/.test(neuA) && /Neu aus Tab B/.test(neuA)
      && !/Alt aus Tab A|Frueh aus Tab B/.test(neuA), neuA.split('Letzte Fehler')[1]);
    pruefe('nichts ging ins Netz', fremd.length === 0, fremd);
  } finally { await kontext.close(); }
}

// ---------- iPhone vom Home-Bildschirm (viewport-fit=cover): Sicherheitsabstaende oben und unten ----------
async function testeIphone(browser) {
  gruppe = 'Browser iPhone (Sicherheitsabstand)';
  if (!CHROMIUM) { console.log('… bericht: iPhone-Abstaende nur in Chromium (CDP Emulation.setSafeAreaInsetsOverride), hier nur die CSS-Pruefung aus Teil 1'); return; }
  const faelle = [
    { name: 'Statusleiste normal (390x797, unten 34)', w: 390, h: 797, oben: 0, unten: 34 },
    { name: 'Statusleiste durchscheinend (390x844, oben 47, unten 34)', w: 390, h: 844, oben: 47, unten: 34 },
  ];
  for (const fall of faelle) {
    // mit navigator.share (wie Safari auf dem iPhone): ein Knopf mehr, das Blatt wird hoeher
    const { kontext, seite, fremd } = await neueSeite(browser, { init: () => { navigator.share = () => Promise.resolve(); } });
    try {
      await seite.setViewportSize({ width: fall.w, height: fall.h });
      const cdp = await kontext.newCDPSession(seite);
      await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: fall.oben, bottom: fall.unten } });
      await zuEinstellungen(seite);
      await seite.evaluate(() => { for (let i = 0; i < 6; i++) setTimeout(() => { throw new Error('Probe iPhone ' + i); }, 0); });
      await seite.waitForTimeout(300);
      await oeffneBericht(seite);
      await seite.waitForTimeout(900);   // das Blatt ist hereingeglitten
      const m = await seite.evaluate(() => {
        const k = document.querySelector('.bericht-blatt');
        const r = k.getBoundingClientRect();
        return { oben: r.top, unten: r.bottom, griff: k.querySelector('.sheet-griff').getBoundingClientRect().top,
          titel: k.querySelector('h3').getBoundingClientRect().top, inhalt: k.scrollHeight, sichtbar: k.clientHeight, hoehe: innerHeight,
          abstand: getComputedStyle(k).marginBottom, breite: document.documentElement.scrollWidth };
      });
      pruefe(`${fall.name}: Sicherheitsabstand wirkt (margin-bottom 12 + ${fall.unten})`, m.abstand === `${12 + fall.unten}px`, m);
      pruefe(`${fall.name}: Inhalt laenger als das Blatt (sonst prueft der Test nichts)`, m.inhalt > m.sichtbar + 20, m);
      pruefe(`${fall.name}: Blatt ganz im Bild, Oberkante mit Griff unter dem Abstand oben, unten ueber dem Abstand, kein waagrechter Ueberlauf`,
        m.oben >= fall.oben - 0.5 && m.griff >= fall.oben && m.titel > m.griff && m.unten <= m.hoehe - fall.unten + 0.5 && m.breite <= fall.w, m);
      pruefe(`${fall.name}: nichts ging ins Netz`, fremd.length === 0, fremd);
    } finally { await kontext.close(); }
  }
}

async function abschnitt(name, arbeit, ms = 120000) {
  console.log(`… bericht: ${name}`);
  try { return await begrenzt(`bericht ${name}`, arbeit, ms); } catch (e) { pruefe(`${name}: Abschnitt ohne Abbruch (${e.message})`, false); return null; }
}

// ---------- Ablauf ----------
let browser;
let code = 1;
const t0 = Date.now();
try {
  await abschnitt('Node', () => nodeTeil(), 60000);
  if (!NUR_NODE) {
    await begrenzt('Serverstart', () => new Promise((resolve, reject) => { server.once('error', reject); server.listen(PORT, '127.0.0.1', resolve); }), 10000);
    browser = await begrenzt('Browserstart', () => browserTyp(ladePlaywright()).launch(), 45000);
    await abschnitt('Protokoll', () => testeProtokoll(browser));
    await abschnitt('Paket und Engine', () => testePaketUndEngine(browser));
    await abschnitt('Startfehler', () => testeStartfehler(browser));
    await abschnitt('Bericht', () => testeBlatt(browser));
    await abschnitt('Rueckfall', () => testeRueckfall(browser));
    await abschnitt('Englisch', () => testeEnglischMitSw(browser), 180000);
    await abschnitt('Screens und Melder', () => testeScreensUndMelder(browser));
    await abschnitt('Zwei Tabs', () => testeZweiTabs(browser));
    await abschnitt('iPhone', () => testeIphone(browser));
  }
  const schlecht = ergebnisse.filter((r) => !r.ok);
  console.log(`\n${ergebnisse.length - schlecht.length}/${ergebnisse.length} bestanden in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  for (const f of schlecht) console.log('FEHLER: ' + f.name);
  code = schlecht.length ? 1 : 0;
} catch (e) {
  console.error(e);
  code = 1;
} finally {
  if (browser) await begrenzt('Browser schliessen', () => browser.close(), 10000).catch((e) => { console.error(e); code = 1; });
  if (server.listening) {
    server.closeAllConnections();
    await begrenzt('Server schliessen', () => new Promise((resolve) => server.close(resolve)), 5000).catch((e) => { console.error(e); code = 1; });
  }
}
process.exit(code);
