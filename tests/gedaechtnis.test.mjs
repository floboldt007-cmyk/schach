// Tests fuer das Paket "gedaechtnis" (Welle A, A2: Bots erinnern sich, Revanche, Erzfeind). Node-Teil ohne Browser
// (Satz-Tabelle: alle Bots, alle Anlaesse, Ton, Laenge, Platzhalter; Register; Vorrang mit festen Testpartien;
// Tagesgrenze 4:00; Satzwahl deterministisch aus tag.js; Sparsamkeit; Einstellung "Bot-Sprueche"; keine Stichelei nach
// 3 Niederlagen in Folge; Revanche-Parameter; Erzfeind-Regel und Feier einmal je neuer Niederlage; Modul-Speicher;
// CSS nur mit Tokens), danach Browser-Teil (Playwright, Chromium) gegen die echte App mit dem Paket ueber
// ?test&erw=pakete/gedaechtnis/index: Gedaechtnis-Satz im Arena-Panel und als Begruessungsblase nach vorbereiteten
// Partien, Erzfeind-Zeile im Bot-Panel, Revanche-Knopf nach einer echten Niederlage (Narrenmatt) mit getauschten Farben,
// Revanche nach Remis am Ort, Feier "Erzfeind bezwungen" nach einem echten Sieg (genau einmal), Handy hell und dunkel,
// Laden ueber die Liste PAKETE (Produktion).
//
//   node tests/gedaechtnis.test.mjs              alles
//   node tests/gedaechtnis.test.mjs --nur-node   ohne Browser
//   PORT=9700 BILDER=<ordner> node tests/gedaechtnis.test.mjs
//
// Playwright: PLAYWRIGHT_PFAD, sonst 'playwright', sonst /opt/node-tools/node_modules/playwright.
// Tage und Tagesgrenze wie auf Flos iPad (Node und Browser rechnen in derselben Zeitzone)
process.env.TZ = 'Europe/Berlin';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { browserTyp } from './browser.mjs';
import { BOTS as LEITER } from '../js/bots.js';

const require = createRequire(import.meta.url);
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8862);
const ERW = 'pakete/gedaechtnis/index';
const BASIS = `http://127.0.0.1:${PORT}/index.html?test&kern&erw=${ERW}`;
const NUR_NODE = process.argv.includes('--nur-node');
const BILDER = process.env.BILDER || path.join(WURZEL, 'design', 'app-shots', 'gedaechtnis');
const lies = (d) => readFileSync(path.join(WURZEL, d), 'utf8');
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

const ergebnisse = [];
let gruppe = '';
function pruefe(name, ok, detail = '') {
  ergebnisse.push({ name: (gruppe ? gruppe + ': ' : '') + name, ok: !!ok, detail });
  console.log(`${ok ? 'ok  ' : 'FEHLER'} ${gruppe ? gruppe + ': ' : ''}${name}${!ok && detail ? ' (' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) + ')' : ''}`);
}

// Schaefermatt (Flo mit Weiss gewinnt, 4. Dxf7#) und Narrenmatt (Flo mit Weiss verliert, 2. ... Dh4#)
const SCHAEFER = { flo: ['e2e4', 'f1c4', 'd1h5', 'h5f7'], bot: { e2e4: 'e7e5', f1c4: 'b8c6', d1h5: 'g8f6' } };
const NARR = { flo: ['f2f3', 'g2g4'], bot: { f2f3: 'e7e5', g2g4: 'd8h4' } };

// Signaturwoerter je Bot (Ton des Charakters, aus Bio und Saetzen in js/bots.js)
const TON = {
  benno: /Kuh|Kühe|Hof|Traktor|Hühner|Opa|Kartoffel|Pfannkuchen|Stiefel|gemolken|ernten|Regen/,
  hilde: /Kind|Schätzchen|Tee|Keks|Kuchen|Oma|Heinz|strick|Masche|Brille/,
  kalle: /Kollege|Stammtisch|Runde|Hömma|Kegel|Apfelschorle|greif|Angriff|Vorwärts/,
  lisa: /AG|Läufer|Ziel|Training|trainier|Sprint|Turnier|Verein|Fotofinish|flott/,
  rudi: /Ross|Burg|Ritter|Recke|Turnier|Tafelrunde|Lanze|Rüstung|Pferd|Sattel|Artus|ürwahr/,
  turm: /Vorlesung|Student|Prüfung|Protokoll|Seminar|Fußnote|lehrbuch|Professor|Hausaufgaben|Geduld|Lern/,
  delia: /Schätzchen|Oper|Akt|Bühne|Drama|Applaus|Bravo|Chapeau|Finale|pfer|Vorhang|Diva|tanz/,
  koenig: /Akte|Fall|Revier|Ermittl|Indiz|Spur|Beweis|Täter|Endspiel|überführt/,
  greta: /Präzise|analysiert|gerechnet|rechne|Daten|Fehler|Partie|Zug/,
  stockfisch: /Blubb|Mensch|Fisch|Tiefsee|Speicher|Berechnung|berechnet|Kiemen|Code|Analyse/,
  // Welten (24.10.): die zwanzig neuen Bots
  fridolin: /Wind|Stroh|Acker|Krähe|Spatz|Hut|Böe|Wetter|Feld|Vogelscheuche/,
  paula: /Post|Brief|Fahrrad|radel|Klingel|Route|zustell|Zustell|Eil|Karte/,
  gustav: /Biene|Honig|Wabe|Stock|Stich|stech|Mühle|Schleier|summ|Imker/,
  janine: /Club|Scheune|Tafel|Kreide|Stroh|Training|Mitglied/,
  bodo: /Axt|Holz|Baum|Lichtung|Stumpf|Säge|fäll|Eiche|Fichte|Wald|hack/,
  leo: /Falle|Pfad|Schleich|Forst|Moos|Unterholz|Spur|Stolper|Waldläufer|Grube/,
  edda: /Glut|Meiler|Kohle|Feuer|Funke|Rauch|qualm|heiz|Köhler|Scheit/,
  luke: /Markt|Rathaus|Gambit|Brunnen|Runde|Händler|Stand/,
  moritz: /Trick|Zauber|zauber|Hut|Ärmel|Kaninchen|Publikum|Vorstellung|Simsalabim|Ta-daa|Brücke|Karte/,
  ottilie: /Buch|Bücher|Regal|Kapitel|Bibliothek|Seite|Lesezeichen|Katalog|gelesen|Klassiker/,
  lasse: /Netz|Fang|Kutter|Fisch|See|Masche|Hafen|Möwe/,
  wiebke: /Hafen|Liegeplatz|Leine|Schiff|Kurs|Seekarte|anleg|vertäut/,
  henning: /Watt|Ebbe|Flut|Gezeit|Priel|Schlick|Wasser|Deich|Moment/,
  ilka: /Boot|Rettung|Retterin|Welle|Sturm|Bord|Weste|See|Unsinkbare|Station|untergegangen|versenkt/,
  johann: /Leuchtturm|Licht|Lampe|Nacht|Logbuch|Horizont|Weitblick|Nebel|vierzig/,
  keetan: /Tauch|tauch|Tiefe|Sprung|spring|Mut|mutig|Flosse|Maske|Strömung/,
  ragna: /leise|Leise|Graben|Gräben|Boot|lots|Echolot|still|Still|Raum|Geduld/,
  silas: /Schatz|Truhe|Wrack|Fund|Münze|Lupe|Sammlung|glänz|glitzer|Endspiel/,
  merle: /Notiz|notier|Beobacht|Kugel|Forsch|Mess|Protokoll|protokoll|Hypothese|Versuch|Daten|Befund/,
  alva: /Tor|Durchgang|Wache|hüte|Hüterin|passier|Spalt|standgehalten|stand/,
};

// =====================================================================
// Node-Teil
// =====================================================================
async function nodeTeil() {
  const s = new Map();
  globalThis.localStorage = {
    get length() { return s.size; }, key: (i) => [...s.keys()][i] ?? null, getItem: (k) => (s.has(k) ? s.get(k) : null),
    setItem: (k, v) => s.set(k, String(v)), removeItem: (k) => s.delete(k), clear: () => s.clear(),
  };
  const storage = await import('../js/storage.js');
  storage.setzeSpeicher(globalThis.localStorage);
  const L = await import('../js/pakete/gedaechtnis/logik.js');
  const { SAETZE } = await import('../js/pakete/gedaechtnis/saetze.js');
  const { BOTS, botSatz, registriereSaetze, PLATZHALTER } = await import('../js/bots.js');
  const tag = await import('../js/tag.js');
  const { QUELLEN } = await import('../js/feier.js');

  // ---------- Satz-Tabelle ----------
  gruppe = 'Saetze';
  pruefe('genau die 10 Anlaesse der Logik (erstes Treffen, letzte Partie gewonnen/verloren/Remis, Serie, erster Sieg, genial, Patzer, Pause, Mut)',
    JSON.stringify(Object.keys(SAETZE).sort()) === JSON.stringify([...L.ANLAESSE].sort()) && L.ANLAESSE.length === 10, Object.keys(SAETZE));
  const fehlt = [];
  const zuLang = [];
  const strich = [];
  const doppelt = [];
  const alle = new Map();
  for (const a of L.ANLAESSE) {
    for (const b of BOTS) {
      const l = SAETZE[a] && SAETZE[a][b.id];
      if (!Array.isArray(l) || l.length < 3 || l.some((t) => typeof t !== 'string' || !t.trim())) { fehlt.push(`${a}/${b.id}`); continue; }
      if (new Set(l).size !== l.length) doppelt.push(`${a}/${b.id}`);
      for (const t of l) {
        if (t.length > 110) zuLang.push(`${t.length}: ${t}`);
        if (/[—–]/.test(t)) strich.push(t);
        if (alle.has(t)) doppelt.push(`${alle.get(t)} und ${a}/${b.id}: ${t}`);
        alle.set(t, `${a}/${b.id}`);
      }
    }
  }
  pruefe('jeder der 30 Bots hat jeden Anlass mit mindestens 3 Varianten', fehlt.length === 0, fehlt);
  pruefe(`hoechstens 110 Zeichen (${alle.size} Saetze)`, zuLang.length === 0 && alle.size >= 300, zuLang);
  pruefe('keine langen Gedankenstriche', strich.length === 0, strich);
  pruefe('kein Satz doppelt (eigene Texte je Bot und Anlass)', doppelt.length === 0, doppelt);
  const platz = [];
  for (const a of L.ANLAESSE) {
    for (const b of BOTS) {
      for (const t of SAETZE[a][b.id]) {
        const p = L.platzhalter(t);
        const erlaubt = a === 'wiedersehen' ? ['tage'] : a === 'rueckkampf' ? ['zuege'] : [];
        if (p.some((x) => !erlaubt.includes(x) || !PLATZHALTER.includes(x))) platz.push(`${a}/${b.id}: ${t}`);
      }
      if (!SAETZE[a][b.id].some((t) => L.platzhalter(t).length === 0)) platz.push(`${a}/${b.id}: keine Variante ohne Platzhalter`);
    }
  }
  pruefe('Platzhalter nur {tage} (wiedersehen) und {zuege} (rueckkampf), je Bot immer auch eine Variante ohne', platz.length === 0, platz);
  const tonFehlt = [];
  for (const b of BOTS) {
    const saetze = L.ANLAESSE.flatMap((a) => SAETZE[a][b.id]);
    const treffer = saetze.filter((t) => TON[b.id].test(t)).length;
    if (treffer < 6) tonFehlt.push(`${b.id}: ${treffer}`);
  }
  pruefe('Ton je Bot: mindestens 6 der 30 Saetze tragen typische Woerter seiner Figur', tonFehlt.length === 0, tonFehlt);
  const schnitt = (id) => { const l = L.ANLAESSE.flatMap((a) => SAETZE[a][id]); return l.reduce((x, t) => x + t.length, 0) / l.length; };
  pruefe('Greta spricht knapp (kuerzeste Saetze im Schnitt), Stockfisch blubbert (mindestens 5x "Blubb")',
    BOTS.every((b) => b.id === 'greta' || schnitt('greta') < schnitt(b.id))
    && L.ANLAESSE.flatMap((a) => SAETZE[a].stockfisch).filter((t) => /Blubb/.test(t)).length >= 5, BOTS.map((b) => `${b.id} ${schnitt(b.id).toFixed(0)}`).join(' '));
  const HOHN = /lächerlich|Versager|Loser|keine Chance|wirst du brauchen|ausgelacht|zu schlecht|Anfänger|schwach|Pech gehabt|schon wieder verloren/i;
  const hohn = [...alle.keys()].filter((t) => HOHN.test(t));
  pruefe('kein Hohn, kein Spott (auch nicht in der Stichelei)', hohn.length === 0, hohn);
  // Druck und Schuld (ergaenzt die Verbotsliste in tests/fairness.test.mjs um Ton-Woerter des Wiedersehens)
  const DRUCK = /vermiss|wo warst du|endlich wieder|so lange weg|warte(t)? auf dich|nicht vergessen|komm(st)? bald/i;
  const druck = [...alle.keys()].filter((t) => DRUCK.test(t));
  pruefe('Wiedersehen warm, nie vorwurfsvoll (kein "vermisst", "wo warst du", "wartet auf dich")', druck.length === 0, druck);

  // ---------- Register ----------
  gruppe = 'Register';
  const ab = L.registriereAlle(registriereSaetze);
  const falsch = [];
  for (const a of L.ANLAESSE) {
    for (const b of BOTS) {
      SAETZE[a][b.id].forEach((t, i) => {
        const werte = { tage: 9, zuege: 23 };
        const soll = t.replace('{tage}', '9').replace('{zuege}', '23');
        const ist = botSatz(b, L.variante(a, i), () => 0.99, werte);
        if (ist !== soll) falsch.push(`${L.variante(a, i)}/${b.id}: ${ist}`);
      });
      const frei = botSatz(b, a, () => 0.5, { tage: 9, zuege: 23 });
      if (!SAETZE[a][b.id].map((t) => t.replace('{tage}', '9').replace('{zuege}', '23')).includes(frei)) falsch.push(`${a}/${b.id} schlicht: ${frei}`);
    }
  }
  pruefe('je Variante genau ein Satz im Register (botSatz trifft ihn mit jedem Zufall), schlichte Namen mit allen Varianten', falsch.length === 0, falsch.slice(0, 5));
  pruefe('Variante ohne Wert fuer den Platzhalter: kein Satz (botSatz ueberspringt)', botSatz(BOTS[0], L.variante('wiedersehen', 0), Math.random, null) === null);
  ab();
  pruefe('abmelden nimmt alle Saetze wieder heraus', botSatz(BOTS[0], L.variante('kennenlernen', 0)) === null && botSatz(BOTS[0], 'wiedersehen') === null);

  // ---------- Vorrang mit festen Testpartien ----------
  gruppe = 'Vorrang';
  const HEUTE = '2026-10-23';
  // Datum lokal: Tage vor HEUTE um 18:00
  const vor = (tage, std = 18) => new Date(2026, 9, 23 - tage, std, 0).toISOString();
  let nr = 0;
  const P = (ergebnis, tage, extra = {}) => ({ id: 'p' + (++nr), botId: 'kalle', ergebnis, datum: vor(tage, extra.std ?? 18), modus: 'normal',
    spielerFarbe: 'w', zuege: Array(46).fill('e2e4'), liveKlassen: [], ...extra });
  const wahl = (partien, opt = {}) => L.anlassFuer(L.lage({ partien, botId: 'kalle', heute: HEUTE, memo: opt.memo || null }), { folgeGesamt: () => opt.gesamt || 0 });
  const an = (partien, opt) => (wahl(partien, opt) || {}).anlass || null;
  pruefe('keine Partie: kennenlernen', an([]) === 'kennenlernen');
  pruefe('nur Uebung, eigene Stellung, Boss und andere Bots zaehlen nicht: kennenlernen', an([P('sieg', 1, { modus: 'uebung' }),
    P('sieg', 1, { startFen: '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1' }), P('sieg', 1, { modus: 'boss' }), P('sieg', 1, { botId: 'rudi' })]) === 'kennenlernen');
  const alt = L.anlassFuer(L.lage({ partien: [], botId: 'kalle', heute: HEUTE, bekannt: 7 }), {});
  pruefe('keine Partie mehr in der Liste, aber 7 laut Fortschritt (aeltere fielen heraus): wiedersehen ohne {tage}, kein Kennenlernen',
    alt.anlass === 'wiedersehen' && alt.werte === null && L.begruessung({ botId: 'kalle', partien: [], heute: HEUTE, bekannt: 7 }).satz.indexOf('{') < 0, alt);
  pruefe('Sieg nach 3 Niederlagen in Folge: ersterSieg', an([P('sieg', 1), P('niederlage', 2), P('niederlage', 3), P('niederlage', 4), P('sieg', 5)]) === 'ersterSieg');
  pruefe('Sieg nach 2 Niederlagen: nur rueckkampf', an([P('sieg', 1), P('niederlage', 2), P('niederlage', 3), P('sieg', 4)]) === 'rueckkampf');
  const pause = wahl([P('niederlage', 9), P('niederlage', 10), P('niederlage', 11)]);
  pruefe('letzte Partie 9 Tage her: wiedersehen mit {tage} = 9 (geht vor mutmachen)', pause.anlass === 'wiedersehen' && pause.werte.tage === 9, pause);
  pruefe('6 Tage Pause: noch kein wiedersehen', an([P('remis', 6)]) === 'remisZuletzt');
  pruefe('3 Niederlagen in Folge gegen ihn: mutmachen', an([P('niederlage', 1), P('niederlage', 2), P('niederlage', 3)]) === 'mutmachen');
  pruefe('3 Niederlagen in Folge insgesamt (auch gegen andere): mutmachen statt revanche', an([P('niederlage', 1), P('sieg', 2)], { gesamt: 3 }) === 'mutmachen'
    && an([P('niederlage', 1), P('sieg', 2)], { gesamt: 2 }) === 'revanche');
  pruefe('genialer Zug aus der Live-Bewertung: genial', an([P('niederlage', 1, { liveKlassen: [null, null, 'brillant'] })]) === 'genial');
  const memo = [['g1', 0, 0], ['g2', 1, 0], ['g3', 0, 2]];
  pruefe('Spielanalyse geht vor Live-Bewertung (memo: kein genialer Zug)', an([P('sieg', 1, { id: 'g1', liveKlassen: ['brillant'] }), P('niederlage', 2)], { memo }) === 'rueckkampf');
  pruefe('genial aus der Spielanalyse, Patzer des Bots aus der Spielanalyse', an([P('remis', 1, { id: 'g2' })], { memo }) === 'genial'
    && an([P('remis', 1, { id: 'g3' })], { memo }) === 'botPatzer');
  pruefe('3 Siege in Folge: serieGegen (vor rueckkampf), genial geht vor', an([P('sieg', 1), P('sieg', 2), P('sieg', 3)]) === 'serieGegen'
    && an([P('sieg', 1, { liveKlassen: ['brillant'] }), P('sieg', 2), P('sieg', 3)]) === 'genial');
  const rk = wahl([P('sieg', 1, { zuege: Array(45).fill('e2e4') })]);
  pruefe('letzte Partie gewonnen: rueckkampf mit {zuege} (45 Halbzuege = 23 Zuege)', rk.anlass === 'rueckkampf' && rk.werte.zuege === 23, rk);
  pruefe('letzte verloren: revanche, letzte Remis: remisZuletzt', an([P('niederlage', 1), P('sieg', 2)]) === 'revanche' && an([P('remis', 1)]) === 'remisZuletzt');
  pruefe('die neueste Partie zaehlt, egal in welcher Reihenfolge die Liste kommt', an([P('sieg', 3), P('remis', 1), P('niederlage', 2)]) === 'remisZuletzt');

  gruppe = 'Tagesgrenze';
  const um = (j, m, t, h, min = 0) => tag.tagSchluessel(new Date(j, m, t, h, min));
  const spaet = { id: 'tg', botId: 'kalle', ergebnis: 'sieg', modus: 'normal', datum: new Date(2026, 9, 15, 23, 0).toISOString(), zuege: ['e2e4'] };
  const nachts = { ...spaet, datum: new Date(2026, 9, 16, 2, 0).toISOString() };
  pruefe('23.10. 03:30 gehoert noch zum 22.10.: Partie am 15.10. 23:00 ist 7 Tage her (wiedersehen)', L.lage({ partien: [spaet], botId: 'kalle', heute: um(2026, 9, 23, 3, 30) }).tage === 7
    && an2(L, [spaet], um(2026, 9, 23, 3, 30)) === 'wiedersehen');
  pruefe('22.10. 03:30 (Tag 21.10.): erst 6 Tage', L.lage({ partien: [spaet], botId: 'kalle', heute: um(2026, 9, 22, 3, 30) }).tage === 6);
  pruefe('Partie am 16.10. um 02:00 zaehlt zum 15.10.', L.lage({ partien: [nachts], botId: 'kalle', heute: '2026-10-22' }).tage === 7);
  pruefe('Ende der Sommerzeit (25.10.) zaehlt als ein Tag', L.lage({ partien: [{ ...spaet, datum: new Date(2026, 9, 24, 20, 0).toISOString() }], botId: 'kalle', heute: '2026-10-26' }).tage === 2);

  // ---------- Satzwahl: deterministisch und sparsam ----------
  gruppe = 'Satzwahl';
  const rev = [P('niederlage', 1), P('sieg', 2)];
  const g1 = L.begruessung({ botId: 'kalle', partien: rev, heute: HEUTE });
  const g2 = L.begruessung({ botId: 'kalle', partien: rev.slice().reverse(), heute: HEUTE });
  pruefe('gleicher Tag, gleiche Geschichte: gleiche Wahl (auch in anderer Reihenfolge)', JSON.stringify(g1) === JSON.stringify(g2));
  const z = tag.zufallAus(tag.seedAus(`gedaechtnis|${L.RECHENSTAND}|${HEUTE}|kalle|2`));
  const wurf = z();
  const idx = Math.floor(z() * 3);
  pruefe('Zufall nur aus tag.js (zufallAus(seedAus("gedaechtnis|Rechenstand|Tag|Bot|Partien")))', wurf >= L.ANTEIL ? g1 === null
    : (g1 && g1.anlass === L.variante('revanche', idx) && g1.satz === SAETZE.revanche.kalle[idx]), { wurf, idx, g1 });
  let gezeigt = 0;
  const varianten = new Set();
  let stimmig = true;
  const TAGE = 240;
  // dieselbe Geschichte (letzte Partie gestern verloren) an 240 verschiedenen Tagen
  const verschoben = (liste, i) => liste.map((p) => ({ ...p, datum: new Date(Date.parse(p.datum) + i * 864e5).toISOString() }));
  for (let i = 0; i < TAGE; i++) {
    const h = tag.addiereTage(HEUTE, i);
    const w = L.begruessung({ botId: 'kalle', partien: verschoben(rev, i), heute: h });
    if (!w) continue;
    gezeigt++;
    varianten.add(w.anlass);
    const i2 = Number(w.anlass.split('.').pop());
    if (w.grund !== 'revanche' || w.stark || w.satz !== SAETZE.revanche.kalle[i2]) stimmig = false;
  }
  pruefe(`sparsam: revanche nur in etwa jeder zweiten Partie (${gezeigt} von ${TAGE} Tagen)`, gezeigt > TAGE * 0.35 && gezeigt < TAGE * 0.65);
  pruefe('alle drei Varianten kommen vor, Anlass und Satz passen zusammen', varianten.size === 3 && stimmig, [...varianten]);
  let immer = 0;
  for (let i = 0; i < 100; i++) {
    const h = tag.addiereTage('2026-11-01', i);
    if (L.begruessung({ botId: 'rudi', partien: [], heute: h })) immer++;
  }
  pruefe('besondere Anlaesse (hier: kennenlernen) kommen immer', immer === 100);
  const naechste = new Set();
  for (let n = 2; n < 22; n++) {
    const liste = [P('niederlage', 1), ...Array.from({ length: n - 1 }, (_, k) => P('sieg', 2 + k))];
    const w = L.begruessung({ botId: 'kalle', partien: liste, heute: HEUTE });
    naechste.add(w ? w.anlass : 'nichts');
  }
  pruefe('neue Partie, neuer Wurf (Zahl der Partien im Seed)', naechste.size >= 2, [...naechste]);
  const ws = L.begruessung({ botId: 'stockfisch', partien: [{ ...P('remis', 12), botId: 'stockfisch' }], heute: HEUTE });
  pruefe('wiedersehen bringt {tage} mit, der Satz passt dazu', ws && ws.grund === 'wiedersehen' && ws.werte.tage === 12
    && (L.platzhalter(ws.satz).length === 0 || ws.satz.includes('{tage}')), ws);
  let ohneZuege = true;
  let rueck = 0;
  for (let i = 0; i < 60; i++) {
    const w = L.begruessung({ botId: 'hilde', partien: verschoben([{ ...P('sieg', 1, { zuege: [] }), botId: 'hilde' }], i), heute: tag.addiereTage(HEUTE, i) });
    if (w && w.grund === 'rueckkampf') { rueck++; if (w.satz.includes('{zuege}') || w.werte) ohneZuege = false; }
  }
  pruefe('ohne Zuege nie eine Variante mit {zuege}', ohneZuege && rueck > 10, rueck);
  pruefe('registrierte Bots ohne Saetze (Bosse, Gaeste): keine Wahl', L.begruessung({ botId: 'boss-x', partien: [], heute: HEUTE }) === null);

  gruppe = 'Einstellung';
  pruefe('Bot-Sprüche "aus": keine Wahl', L.begruessung({ botId: 'kalle', partien: [], heute: HEUTE, sprueche: 'aus' }) === null);
  let wenigOk = true;
  for (let i = 0; i < 40; i++) {
    const h = tag.addiereTage(HEUTE, i);
    const r = L.begruessung({ botId: 'kalle', partien: rev, heute: h, sprueche: 'wenig' });
    if (r) wenigOk = false;
  }
  pruefe('"wenig": nur kennenlernen, ersterSieg, mutmachen (revanche und wiedersehen schweigen)', wenigOk
    && L.begruessung({ botId: 'kalle', partien: [], heute: HEUTE, sprueche: 'wenig' }).grund === 'kennenlernen'
    && L.begruessung({ botId: 'kalle', partien: [P('niederlage', 1), P('niederlage', 2), P('niederlage', 3)], heute: HEUTE, sprueche: 'wenig' }).grund === 'mutmachen'
    && L.begruessung({ botId: 'kalle', partien: [P('remis', 10)], heute: HEUTE, sprueche: 'wenig' }) === null);
  // Pruefer-Befund: Unter der Fairness-Sperre schwieg das Paket bei "wenig", wenn vorher wiedersehen gewann (lange Pause oder
  // Partien aus der Liste gefallen); dann begruesste der Host mit seinen eingebauten Saetzen, die auch sticheln
  const wenigPause = L.begruessung({ botId: 'kalle', partien: [P('niederlage', 9), P('niederlage', 10), P('niederlage', 11)], heute: HEUTE, sprueche: 'wenig' });
  const wenigAlt = L.begruessung({ botId: 'kalle', partien: [], heute: HEUTE, bekannt: 5, folgeGesamt: () => 3, sprueche: 'wenig' });
  const wenigGesamt = L.begruessung({ botId: 'kalle', partien: [P('remis', 12)], heute: HEUTE, folgeGesamt: () => 3, sprueche: 'wenig' });
  pruefe('"wenig" unter der Sperre (3 Niederlagen in Folge): Mut statt Schweigen, auch nach 9 Tagen Pause und bei aus der Liste gefallenen Partien',
    [wenigPause, wenigAlt, wenigGesamt].every((w) => w && w.grund === 'mutmachen' && w.stark && w.gesperrt && w.vorn
      && w.satz === SAETZE.mutmachen.kalle[Number(w.anlass.split('.').pop())]), [wenigPause, wenigAlt, wenigGesamt]);
  pruefe('"wenig" ohne Sperre nach langer Pause: weiter Schweigen (wiedersehen gehoert nicht zu "wenig")',
    L.begruessung({ botId: 'kalle', partien: [], heute: HEUTE, bekannt: 5, folgeGesamt: () => 2, sprueche: 'wenig' }) === null);

  gruppe = 'Fairness';
  let stichelei = 0;
  let mut = 0;
  for (const b of BOTS) {
    for (let i = 0; i < 60; i++) {
      const h = tag.addiereTage(HEUTE, i);
      const dat = (k) => new Date(Date.parse(vor(k)) + i * 864e5).toISOString();
      const drei = [1, 2, 3].map((k) => ({ ...P('niederlage', k), botId: b.id, datum: dat(k) }));
      const gemischt = [{ ...P('niederlage', 1), botId: b.id, datum: dat(1) }, { ...P('sieg', 2), botId: b.id, datum: dat(2) }];
      for (const [liste, gesamt] of [[drei, 0], [gemischt, 3], [gemischt, 4]]) {
        const w = L.begruessung({ botId: b.id, partien: liste, heute: h, folgeGesamt: () => gesamt });
        if (!w || L.STICHELEI.includes(w.grund)) stichelei++;
        else if (w.grund === 'mutmachen') mut++;
      }
    }
  }
  pruefe('nach 3 Niederlagen in Folge (gegen ihn oder insgesamt) nie eine Stichelei, sondern immer Mut (auch kein Schweigen)', stichelei === 0 && mut === BOTS.length * 60 * 3, { stichelei, mut });
  // dieselbe Sperre mit langer Pause (wiedersehen gewinnt den Vorrang), mit aus der Liste gefallenen Partien und mit "wenig":
  // nie Schweigen, nie eine Stichelei, bei "wenig" nur WENIG, und die Wahl steht vorn am Wahl-Ort (vor anderen Paketen)
  const sperrFehler = [];
  let sperrFaelle = 0;
  for (const b of BOTS) {
    for (let i = 0; i < 30; i++) {
      const h = tag.addiereTage(HEUTE, i);
      const dat = (k) => new Date(Date.parse(vor(k)) + i * 864e5).toISOString();
      const pause = [9, 10, 11].map((k) => ({ ...P('niederlage', k), botId: b.id, datum: dat(k) }));
      const gemischt = [{ ...P('remis', 8), botId: b.id, datum: dat(8) }];
      for (const sprueche of ['an', 'wenig']) {
        for (const [liste, gesamt, bekannt] of [[pause, 0, 3], [gemischt, 3, 1], [[], 3, 6]]) {
          sperrFaelle++;
          const w = L.begruessung({ botId: b.id, partien: liste, heute: h, folgeGesamt: () => gesamt, bekannt, sprueche });
          if (!w || L.STICHELEI.includes(w.grund) || !w.vorn || !w.gesperrt || !w.stark || (sprueche === 'wenig' && !L.WENIG.includes(w.grund))) {
            sperrFehler.push(`${b.id} ${sprueche} ${gesamt} ${bekannt}: ${w ? w.grund + (w.vorn ? '' : ' hinten') : 'null'}`);
          }
        }
      }
    }
  }
  pruefe(`Sperre auch nach langer Pause, bei alten Partien und bei "wenig": immer ein Satz, nie Stichelei, immer vorn (${sperrFaelle} Faelle)`,
    sperrFehler.length === 0 && sperrFaelle === BOTS.length * 30 * 6, sperrFehler.slice(0, 5));
  pruefe('die einzige Stichelei ist die Begruessung revanche (hoechstens eine je Partie: ein Wahl-Ort, eine Wahl)', JSON.stringify(L.STICHELEI) === '["revanche"]'
    && !/\.blase\(|zeigeBlase|coachZusatz/.test(lies('js/pakete/gedaechtnis/index.js').replace(/\/\/.*$/gm, '')));
  pruefe('kein Math.random in logik.js und saetze.js', !/Math\s*\.\s*random/.test(lies('js/pakete/gedaechtnis/logik.js').replace(/\/\/.*$/gm, ''))
    && !/Math\s*\.\s*random/.test(lies('js/pakete/gedaechtnis/saetze.js')));

  // ---------- Platz am Wahl-Ort: vorn nur, was vorn stehen muss ----------
  // Pruefer-Befund: Mit Reihenfolge 10 fuer alles verdraengte das Paket den einmaligen Level-Gruss von Funken (Reihenfolge
  // 40, Zweig claude/spielsysteme), der bei partie:gestartet verbraucht wird. Jetzt: vorn (10) nur die Fairness-Sperre und
  // die einmaligen Momente, alles andere hinten (60). Unter der Sperre steht die Wahl vorn, weil der Level-Gruss selbst
  // eine Stichelei ist.
  gruppe = 'Wahl-Ort';
  pruefe('Plaetze: vorn vor 40 (Level-Gruss von Funken), hinten danach', L.REIHENFOLGE.vorn < 40 && L.REIHENFOLGE.hinten > 40
    && JSON.stringify(L.VORN) === '["kennenlernen","ersterSieg","mutmachen"]');
  const platz2 = (partien, opt = {}) => {
    for (let i = 0; i < 40; i++) {
      const h = tag.addiereTage(HEUTE, i);
      const w = L.begruessung({ botId: 'kalle', partien: verschoben(partien, i), heute: h, folgeGesamt: () => opt.gesamt || 0, bekannt: opt.bekannt || 0 });
      if (w) return `${w.grund}:${w.vorn ? 'vorn' : 'hinten'}`;
    }
    return 'nichts';
  };
  const plaetze = {
    kennenlernen: platz2([]),
    ersterSieg: platz2([P('sieg', 1), P('niederlage', 2), P('niederlage', 3), P('niederlage', 4)]),
    mutmachen: platz2([P('niederlage', 1), P('niederlage', 2), P('niederlage', 3)]),
    wiedersehen: platz2([P('remis', 9)]),
    wiedersehenGesperrt: platz2([P('niederlage', 9), P('niederlage', 10), P('niederlage', 11)]),
    genial: platz2([P('remis', 1, { liveKlassen: ['brillant'] })]),
    serieGegen: platz2([P('sieg', 1), P('sieg', 2), P('sieg', 3)]),
    rueckkampf: platz2([P('sieg', 1)]),
    revanche: platz2([P('niederlage', 1), P('sieg', 2)]),
    remisZuletzt: platz2([P('remis', 1)]),
  };
  pruefe('vorn: kennenlernen, ersterSieg, mutmachen und alles unter der Sperre; hinten: wiedersehen, genial, Serie, Rueckkampf, revanche, Remis',
    JSON.stringify(plaetze) === JSON.stringify({ kennenlernen: 'kennenlernen:vorn', ersterSieg: 'ersterSieg:vorn', mutmachen: 'mutmachen:vorn',
      wiedersehen: 'wiedersehen:hinten', wiedersehenGesperrt: 'wiedersehen:vorn', genial: 'genial:hinten', serieGegen: 'serieGegen:hinten',
      rueckkampf: 'rueckkampf:hinten', revanche: 'revanche:hinten', remisZuletzt: 'remisZuletzt:hinten' }), plaetze);

  // ---------- Revanche ----------
  gruppe = 'Revanche';
  const rudi = BOTS.find((b) => b.id === 'rudi');
  const k = (x = {}) => ({ app: {}, bot: rudi, farbe: 'w', ergebnis: 'niederlage', modus: 'normal', erg: { partie: { startFen: null } }, ...x });
  pruefe('Niederlage mit Weiss: gleicher Bot, Schwarz', JSON.stringify(L.revanche(k())) === '{"botId":"rudi","farbe":"b"}', L.revanche(k()));
  pruefe('Remis mit Schwarz: Weiss', JSON.stringify(L.revanche(k({ ergebnis: 'remis', farbe: 'b' }))) === '{"botId":"rudi","farbe":"w"}');
  pruefe('Sieg: kein Knopf', L.revanche(k({ ergebnis: 'sieg' })) === null);
  pruefe('Uebung, Boss, freie Partie, Spielhalle: kein Knopf', ['uebung', 'boss', 'frei', 'spiel'].every((m) => L.revanche(k({ modus: m })) === null));
  pruefe('eigene Stellung: kein Knopf; Grundstellung als startFen: Knopf', L.revanche(k({ erg: { partie: { startFen: '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1' } } })) === null
    && !!L.revanche(k({ erg: { partie: { startFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' } } })));
  pruefe('Bedenkzeit bleibt (wie "Nochmal"), Liga nicht', JSON.stringify(L.revanche(k({ erg: { partie: { tempo: { grund: 300, zuschlag: 2 }, liga: { saison: 's', runde: 1 } } } })))
    === '{"botId":"rudi","farbe":"b","tempo":{"grund":300,"zuschlag":2}}');
  pruefe('ohne Bot oder ohne Partie: nichts', L.revanche(k({ bot: null })) === null && L.revanche(k({ erg: null })) === null && L.revanche(null) === null);
  pruefe('angemeldete Gaeste (stufe null, eigene Ablaeufe): kein Knopf', L.revanche(k({ bot: { id: 'gast-x', stufe: null, name: 'Gast' } })) === null
    && L.revanche(k({ bot: { id: 'gast-y', name: 'Gast' } })) === null);
  const arena = lies('js/ui/arena.js');
  pruefe("die Arena startet mit app.gehe('partie', { botId, farbe }) (gleiche Parameter)", /app\.gehe\('partie', \{ botId: b\.id, farbe \}\)/.test(arena));

  // ---------- Erzfeind ----------
  gruppe = 'Erzfeind';
  const fs = (werte) => {
    const f = { bots: {} };
    for (const b of BOTS) f.bots[b.id] = { sterne: [false, false, false], partien: 0, siege: 0, remis: 0, niederlagen: 0, besteGenauigkeit: null, ...(werte[b.id] || {}) };
    return f;
  };
  pruefe('niemand mit weniger als 3 Niederlagen', L.erzfeind(fs({ kalle: { niederlagen: 2 }, rudi: { niederlagen: 2 } })) === null);
  pruefe('nicht, wenn die Siege mithalten (3:3)', L.erzfeind(fs({ kalle: { niederlagen: 3, siege: 3 } })) === null);
  pruefe('der mit den meisten Niederlagen', JSON.stringify(L.erzfeind(fs({ kalle: { niederlagen: 4, siege: 1 }, rudi: { niederlagen: 5, siege: 4 } })))
    === '{"botId":"rudi","siege":4,"niederlagen":5}');
  pruefe('Gleichstand: die deutlichere Bilanz, dann die hoehere Stufe', L.erzfeind(fs({ kalle: { niederlagen: 4, siege: 0 }, rudi: { niederlagen: 4, siege: 1 } })).botId === 'kalle'
    && L.erzfeind(fs({ kalle: { niederlagen: 4, siege: 1 }, rudi: { niederlagen: 4, siege: 1 } })).botId === 'rudi');
  pruefe('Gleichstand nach Stufe, nicht nach der Reihenfolge der Schluessel im Fortschritt (Cloud, Test, spaetere Normalisierung)',
    L.erzfeind({ bots: { rudi: { niederlagen: 4, siege: 1 }, kalle: { niederlagen: 4, siege: 1 } } }).botId === 'rudi'
    && L.erzfeind({ bots: { kalle: { niederlagen: 4, siege: 1 }, rudi: { niederlagen: 4, siege: 1 } } }).botId === 'rudi'
    && L.erzfeind({ bots: { stockfisch: { niederlagen: 6, siege: 2 }, benno: { niederlagen: 6, siege: 2 } } }).botId === 'stockfisch');
  pruefe('Schluessel, die kein Leiter-Bot sind, zaehlen nicht', L.erzfeind({ bots: { 'boss-x': { niederlagen: 9 }, kalle: { niederlagen: 3 } } }).botId === 'kalle'
    && L.erzfeind({ bots: { 'gast-y': { niederlagen: 9 } } }) === null);
  pruefe('Zeile "Dein Erzfeind · 1 Sieg · 4 Niederlagen" (Einzahl und Mehrzahl)', L.erzfeindZeile({ siege: 1, niederlagen: 4 }) === 'Dein Erzfeind · 1 Sieg · 4 Niederlagen'
    && L.erzfeindZeile({ siege: 0, niederlagen: 3 }) === 'Dein Erzfeind · 0 Siege · 3 Niederlagen' && L.erzfeindZeile({ siege: 2, niederlagen: 1 }) === 'Dein Erzfeind · 2 Siege · 1 Niederlage');
  pruefe('kaputter Fortschritt: nichts', L.erzfeind(null) === null && L.erzfeind({ bots: { kalle: 'x' } }) === null);
  // Ablauf: L L L W (Feier) W (keine) L W (Feier) W W (Bilanz 4:4 -> kein Erzfeind mehr)
  const lauf = [];
  let st = fs({});
  let gefeiert = {};
  for (const e of ['n', 'n', 'n', 's', 's', 'n', 's', 's', 's']) {
    const b = st.bots.kalle;
    if (e === 's') b.siege++; else b.niederlagen++;
    b.partien++;
    const r = L.erzfeindBezwungen({ fortschritt: st, botId: 'kalle', ergebnis: e === 's' ? 'sieg' : 'niederlage', wertet: true, gefeiert });
    if (r) gefeiert = { ...gefeiert, kalle: r.niederlagen };
    lauf.push(r ? 'F' + r.niederlagen : '-');
  }
  pruefe('Feier beim naechsten Sieg, einmal je neuer Niederlage (L L L W W L W W W)', lauf.join(' ') === '- - - F3 - - F4 - -', lauf.join(' '));
  const st2 = fs({ kalle: { niederlagen: 3, siege: 1, partien: 4 } });
  pruefe('nur wertende Siege gegen genau diesen Bot', L.erzfeindBezwungen({ fortschritt: st2, botId: 'kalle', ergebnis: 'sieg', wertet: false }) === null
    && L.erzfeindBezwungen({ fortschritt: fs({ kalle: { niederlagen: 3 }, rudi: { siege: 1 } }), botId: 'rudi', ergebnis: 'sieg', wertet: true }) === null
    && L.erzfeindBezwungen({ fortschritt: st2, botId: 'kalle', ergebnis: 'sieg', wertet: true }).niederlagen === 3);
  pruefe('Feier-Quelle erzfeind: gross mit Prio 85 (feier.QUELLEN)', QUELLEN.erzfeind && QUELLEN.erzfeind.art === 'gross' && QUELLEN.erzfeind.prio === 85);

  // ---------- Modul-Speicher ----------
  gruppe = 'Speicher';
  const review = { zuege: [{ farbe: 'w', klasse: 'brillant' }, { farbe: 'b', klasse: 'patzer' }, { farbe: 'w', klasse: 'patzer' }, { farbe: 'b', klasse: 'brillant' }, { farbe: 'b', klasse: 'patzer' }] };
  pruefe('aus der Spielanalyse: Flos geniale Zuege und Patzer des Bots (je Seite)', JSON.stringify(L.memoAus(review, 'w')) === '{"g":1,"p":2}'
    && JSON.stringify(L.memoAus(review, 'b')) === '{"g":1,"p":1}' && JSON.stringify(L.memoAus(null, 'w')) === '{"g":0,"p":0}');
  let m = L.normalisiereModul(null);
  for (let i = 0; i < 80; i++) m = L.merkeMemo(m, 'pabcdefghijk' + i, { g: i % 2, p: 1 });
  m = L.merkeMemo(m, 'pabcdefghijk79', { g: 5, p: 0 });
  pruefe(`hoechstens ${L.MEMO_MAX} Partien gemerkt, gleiche Partie ersetzt (idempotent)`, m.memo.length === L.MEMO_MAX && m.memo.filter((e) => e[0] === 'pabcdefghijk79').length === 1
    && m.memo[m.memo.length - 1][1] === 5);
  for (const b of BOTS) m.erzfeind[b.id] = 12;
  const voll = JSON.stringify(m).length;
  pruefe(`Modul "bots" (Budget ${storage.MODUL_BUDGET.bots}) passt voll belegt (${voll} Zeichen) und laesst sich speichern`, storage.MODUL_BUDGET.bots === 20000 && voll < 4000
    && storage.speichereModul('bots', m).ok === true);
  const kaputt = L.normalisiereModul({ v: 9, memo: [['x y', 1, 1], 'quatsch', ['ok1', -3, 'a']], erzfeind: { 'Böse': 3, kalle: 'drei', rudi: 4 } });
  pruefe('kaputte Daten werden still bereinigt (v ist der aktuelle Rechenstand)', JSON.stringify(kaputt) === `{"v":${L.RECHENSTAND},"memo":[["ok1",0,0]],"erzfeind":{"rudi":4}}`
    && L.RECHENSTAND === 2, kaputt);
  // ein Modul aus Rechenstand 1 (vor der Nachbesserung gespeichert) bleibt gueltig: Memo und Erzfeind-Merker bleiben
  const alt1 = L.normalisiereModul({ v: 1, memo: [['p1', 1, 0], ['p2', 0, 2]], erzfeind: { kalle: 3 } });
  pruefe('Modul aus Rechenstand 1 bleibt gueltig (Memo und Erzfeind-Merker uebernommen)', JSON.stringify(alt1)
    === `{"v":${L.RECHENSTAND},"memo":[["p1",1,0],["p2",0,2]],"erzfeind":{"kalle":3}}`
    && L.erzfeindBezwungen({ fortschritt: { bots: { kalle: { niederlagen: 3, siege: 1 } } }, botId: 'kalle', ergebnis: 'sieg', wertet: true, gefeiert: alt1.erzfeind }) === null, alt1);

  // ---------- CSS nur mit Tokens ----------
  gruppe = 'CSS';
  const css = lies('css/pakete/gedaechtnis.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const tokens = new Set([...lies('css/tokens.css').matchAll(/(--[a-z0-9-]+)\s*:/g), ...lies('css/themes/modern.css').matchAll(/(--[a-z0-9-]+)\s*:/g)].map((x) => x[1]));
  const genutzt = [...css.matchAll(/var\((--[a-z0-9-]+)/g)].map((x) => x[1]);
  pruefe('keine festen Farben (#, rgb, hsl), kein Leuchten (text-shadow, filter, glow)', !/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|text-shadow|filter\s*:|glow|neon/i.test(css));
  pruefe('nur vorhandene Tokens', genutzt.length > 5 && genutzt.every((t) => tokens.has(t)), genutzt.filter((t) => !tokens.has(t)));
  pruefe('keine Animation ausser transform/opacity (hier gar keine)', !/@keyframes|animation\s*:/.test(css));
}

function an2(L, partien, heute) {
  const a = L.anlassFuer(L.lage({ partien, botId: 'kalle', heute }), {});
  return a ? a.anlass : null;
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

// Speicher vorbereiten und neu laden (Partien, Fortschritt, Einstellungen, Modul)
async function bereite(seite, { partien = [], fortschritt = null, einstellungen = null, modul = null } = {}, hash = '#arena') {
  await seite.evaluate(({ partien, fortschritt, einstellungen, modul }) => {
    localStorage.clear();
    localStorage.setItem('schach-arena:v1:partien', JSON.stringify(partien));
    if (fortschritt) localStorage.setItem('schach-arena:v1:fortschritt', JSON.stringify(fortschritt));
    if (einstellungen) localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify(einstellungen));
    if (modul) localStorage.setItem('schach-arena:v1:modul:bots', JSON.stringify(modul));
  }, { partien, fortschritt, einstellungen, modul });
  await seite.goto(BASIS + hash);
  await seite.reload();
  // window.__app gibt es schon vor dem Laden der Pakete; der erste Screen kommt erst danach
  await seite.waitForFunction(() => !!window.__app && !!document.querySelector('link[data-paket="gedaechtnis"]') && !!document.querySelector('.screen'), null, { timeout: 20000 });
}

// Fortschritt mit freien Bots bis Stufe "bis" und Zaehlern
// bis zaehlt in der alten Zehnerleiter (1 Benno ... 10 Stockfisch): dieser Bot ist der naechste Gegner. Welten: besiegt
// ist jeder Bot der neuen Leiter unterhalb seiner Stufe (auch die neu eingezogenen), damit er frei und der naechste ist.
function fortschritt(bis = 1, zaehler = {}) {
  const alt = ['benno', 'hilde', 'kalle', 'lisa', 'rudi', 'turm', 'delia', 'koenig', 'greta', 'stockfisch'];
  const ziel = LEITER.find((b) => b.id === alt[Math.max(1, Math.min(alt.length, bis)) - 1]);
  const bots = {};
  for (const b of LEITER) {
    bots[b.id] = { sterne: [b.stufe < ziel.stufe, false, false], partien: 0, siege: 0, remis: 0, niederlagen: 0, besteGenauigkeit: null, ...(zaehler[b.id] || {}) };
  }
  return { bots, brillanteZuege: [] };
}
// t Tage vor dem heutigen Tagesschluessel (Grenze 4:00, tag.js) um 18:00
let tagMod = null;
const tageVor = (t, std = 18) => {
  const d = tagMod.beginnVon(tagMod.addiereTage(tagMod.tagSchluessel(), -t));
  d.setHours(std, 0, 0, 0);
  return d.toISOString();
};
let pnr = 0;
const partie = (botId, ergebnis, tage, extra = {}) => ({
  id: 'pt' + (++pnr).toString(36) + 'x', botId, botStufe: null, ergebnis, grund: ergebnis === 'remis' ? 'patt' : 'matt', datum: tageVor(tage), modus: 'normal',
  spielerFarbe: 'w', startFen: null, zuege: ['e2e4', 'e7e5', 'g1f3', 'b8c6'], san: ['e4', 'e5', 'Nf3', 'Nc6'], hinweise: 0, zuruecknahmen: 0,
  liveKlassen: [null, null, null, null], sterne: [ergebnis === 'sieg', false, false], ...extra,
});

// erwartete Begruessung (dieselbe Rechnung wie das Paket, mit den Daten der Seite)
async function erwartet(seite, botId) {
  return seite.evaluate(async (id) => {
    const L = await import('/js/pakete/gedaechtnis/logik.js');
    const S = await import('/js/storage.js');
    const T = await import('/js/tag.js');
    const alle = S.ladePartien();
    let folge = 0;
    for (const p of alle) { if (p.ergebnis !== 'niederlage') break; if (++folge >= 3) break; }
    const m = L.normalisiereModul(S.ladeModul('bots', L.STANDARD_MODUL));
    const w = L.begruessung({ botId: id, partien: alle.filter((p) => p.botId === id), heute: T.tagSchluessel(), memo: m.memo, folgeGesamt: () => folge,
      bekannt: S.ladeFortschritt().bots[id].partien, sprueche: S.ladeEinstellungen().sprueche });
    if (!w) return null;
    let text = w.satz;
    for (const [k, v] of Object.entries(w.werte || {})) text = text.replace('{' + k + '}', String(v));
    return { ...w, text };
  }, botId);
}
const zustand = (seite) => seite.evaluate(async () => (await import('/js/pakete/gedaechtnis/index.js')).zustand());

async function spiele(seite, plan, { botId = 'benno', farbe = 'w', handy = false } = {}) {
  await seite.evaluate((bot) => {
    localStorage.removeItem('schach-arena:v1:laufend');
    window.__test = { botZug: () => {
      const v = window.__partie.chess().history({ verbose: true });
      return bot[v[v.length - 1].lan] || null;
    } };
  }, plan.bot);
  await seite.evaluate(([b, f]) => window.__app.gehe('partie', { botId: b, farbe: f }), [botId, farbe]);
  await seite.waitForFunction(() => window.__partie && window.__partie.bereit === true, null, { timeout: 30000 });
  for (const zug of plan.flo) {
    await seite.waitForFunction(() => window.__partie && window.__partie.phase() === 'flo', null, { timeout: 30000 });
    for (const feld of [zug.slice(0, 2), zug.slice(2, 4)]) {
      const b = await seite.locator(`.screen.partie .brett-felder .feld[data-feld="${feld}"]`).boundingBox();
      if (handy) await seite.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
      else await seite.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
      await warte(90);
    }
  }
}

async function browserTeil(browser) {
  mkdirSync(BILDER, { recursive: true });
  tagMod = await import('../js/tag.js');
  const { RECHENSTAND } = await import('../js/pakete/gedaechtnis/logik.js');
  const { kontext, seite, fehler } = await neueSeite(browser);
  await seite.goto(BASIS + '#arena');
  await seite.waitForSelector('.screen.arena', { timeout: 20000 });

  gruppe = 'Laden';
  const geladen = await seite.evaluate(async () => {
    const o = await import('/js/orte.js');
    const i = await import('/js/ui/icons.js');
    const b = await import('/js/bots.js');
    return { gruss: o.angeboten('partie:begruessung?'), panel: o.angeboten('arena:panel-bot'), erg: o.angeboten('ergebnis:karte'),
      icons: i.iconNamen().includes('revanche') && i.iconNamen().includes('erzfeind'), css: !!document.querySelector('link[data-paket="gedaechtnis"]'),
      satz: b.botSatz(b.botNachId('rudi'), 'wiedersehen', () => 0, { tage: 8 }) };
  });
  pruefe('ueber ?erw geladen: zwei Anbieter an der Begruessung (vorn und hinten), Bot-Panel und Ergebnis, Icons, eigenes CSS, Saetze im Register',
    geladen.gruss === 2 && geladen.panel === 1 && geladen.erg === 1 && geladen.icons && geladen.css && /8 Tagen|Burg|Recke/.test(geladen.satz || ''), JSON.stringify(geladen));

  // ---------- Gedaechtnis: erster Sieg nach drei Niederlagen (besonderer Anlass, kommt immer) ----------
  gruppe = 'Gedächtnis';
  await bereite(seite, {
    partien: [partie('kalle', 'sieg', 1), partie('kalle', 'niederlage', 2), partie('kalle', 'niederlage', 3), partie('kalle', 'niederlage', 4)],
    fortschritt: fortschritt(3, { kalle: { partien: 4, siege: 1, niederlagen: 3 } }),
  });
  await seite.evaluate(() => window.__app.gehe('arena', { waehle: 'kalle' }));
  await seite.waitForFunction(() => /Kalle/.test((document.querySelector('.detail h2') || {}).textContent || ''), null, { timeout: 10000 });
  const soll = await erwartet(seite, 'kalle');
  const panel = await seite.evaluate(() => (document.querySelector('.detail .sprechblase') || {}).textContent || '');
  const z1 = await zustand(seite);
  pruefe('Arena-Panel: Satz "ersterSieg" aus der Geschichte (L L L W), genau die bestimmte Variante', soll && soll.grund === 'ersterSieg' && panel === `„${soll.text}“`
    && z1.letzteWahl && z1.letzteWahl.grund === 'ersterSieg', JSON.stringify({ panel, soll, wahl: z1.letzteWahl }));
  await warte(500);
  await seite.screenshot({ path: path.join(BILDER, 'panel-gedaechtnis-ipad.png') });
  await seite.evaluate(() => {
    localStorage.removeItem('schach-arena:v1:laufend');
    window.__test = { botAnhalten: true };
    window.__app.gehe('partie', { botId: 'kalle', farbe: 'w' });
  });
  // je Lage ein Ort fuer die Blase (quer und hoch): die sichtbare zaehlt
  await seite.waitForFunction(() => [...document.querySelectorAll('.screen.partie .blase-ort .sprechblase')].some((b) => b.getClientRects().length), null, { timeout: 20000 });
  const blase = await seite.evaluate(() => [...document.querySelectorAll('.screen.partie .blase-ort .sprechblase')].find((b) => b.getClientRects().length).textContent);
  pruefe('Partie: dieselbe Begruessung als Sprechblase (Panel und Partie sagen dasselbe)', blase.trim() === soll.text, JSON.stringify({ blase, soll: soll.text }));
  await seite.screenshot({ path: path.join(BILDER, 'partie-begruessung-ipad.png') });
  await seite.evaluate(() => { window.__test = {}; window.__app.gehe('arena'); });
  await seite.waitForSelector('.screen.arena');

  // ---------- Wiedersehen mit {tage} ----------
  await bereite(seite, { partien: [partie('rudi', 'remis', 10)], fortschritt: fortschritt(5, { rudi: { partien: 1, remis: 1 } }) });
  await seite.evaluate(() => window.__app.gehe('arena', { waehle: 'rudi' }));
  await seite.waitForFunction(() => /Rudi/.test((document.querySelector('.detail h2') || {}).textContent || ''), null, { timeout: 10000 });
  const soll2 = await erwartet(seite, 'rudi');
  const panel2 = await seite.evaluate(() => (document.querySelector('.detail .sprechblase') || {}).textContent || '');
  const dbg2 = await seite.evaluate(async () => ({ z: (await import('/js/pakete/gedaechtnis/index.js')).zustand(), anz: document.querySelectorAll('.detail').length,
    partien: localStorage.getItem('schach-arena:v1:partien'), fs: localStorage.getItem('schach-arena:v1:fortschritt') }));
  pruefe('10 Tage Pause: wiedersehen, Platzhalter gefuellt (kein "{tage}" im Text)', soll2 && soll2.grund === 'wiedersehen' && soll2.werte.tage === 10
    && panel2 === `„${soll2.text}“` && !/\{/.test(panel2), JSON.stringify({ panel2, soll2, dbg2 }));

  // ---------- Spielanalyse: genialer Zug (partie:analysiert -> Modul-Memo -> Begruessung genial) ----------
  await bereite(seite, { partien: [partie('lisa', 'remis', 1, { id: 'ptgenial1' })], fortschritt: fortschritt(4, { lisa: { partien: 1, remis: 1 } }) });
  const memo = await seite.evaluate(async () => {
    const E = await import('/js/ereignisse.js');
    const review = { zuege: [{ farbe: 'w', klasse: 'brillant' }, { farbe: 'b', klasse: 'gut' }] };
    E.sende('partie:analysiert', { partieId: 'ptgenial1', botId: 'lisa', modus: 'normal', wertet: true, partie: { id: 'ptgenial1', spielerFarbe: 'w' }, review, quelle: 'analyse' });
    // zweimal (darf je Partie zweimal kommen): ersetzt den Eintrag
    E.sende('partie:analysiert', { partieId: 'ptgenial1', botId: 'lisa', modus: 'normal', wertet: true, partie: { id: 'ptgenial1', spielerFarbe: 'w' }, review, quelle: 'nachholen' });
    E.sende('partie:analysiert', { partieId: 'ptuebung', botId: 'lisa', modus: 'uebung', wertet: false, partie: { id: 'ptuebung', spielerFarbe: 'w' }, review });
    await new Promise((r) => setTimeout(r, 50));
    return JSON.parse(localStorage.getItem('schach-arena:v1:modul:bots') || 'null');
  });
  pruefe('partie:analysiert: genialer Zug im Modul "bots" gemerkt (einmal je Partie, Uebungen nicht)', memo && memo.v === RECHENSTAND
    && JSON.stringify(memo.memo) === '[["ptgenial1",1,0]]', JSON.stringify(memo));
  await seite.evaluate(() => window.__app.gehe('arena', { waehle: 'lisa' }));
  await seite.waitForFunction(() => /Lisa/.test((document.querySelector('.detail h2') || {}).textContent || ''), null, { timeout: 10000 });
  const sollG = await erwartet(seite, 'lisa');
  const panelG = await seite.evaluate(() => (document.querySelector('.detail .sprechblase') || {}).textContent || '');
  pruefe('danach spricht Lisa vom genialen Zug der letzten Partie (Remis, sonst nur jede zweite Partie)', sollG && sollG.grund === 'genial'
    && panelG === `„${sollG.text}“`, JSON.stringify({ panelG, sollG }));

  // ---------- Bot-Sprueche aus ----------
  await bereite(seite, { partien: [], fortschritt: fortschritt(5), einstellungen: { sprueche: 'aus' } });
  await seite.evaluate(() => window.__app.gehe('arena', { waehle: 'rudi' }));
  await seite.waitForFunction(() => /Rudi/.test((document.querySelector('.detail h2') || {}).textContent || ''), null, { timeout: 10000 });
  const aus = await zustand(seite);
  const panelAus = await seite.evaluate(async () => {
    const b = await import('/js/bots.js');
    const t = (document.querySelector('.detail .sprechblase') || {}).textContent || '';
    return { t, eingebaut: b.botNachId('rudi').saetze.begruessung.some((s) => t === `„${s}“`) };
  });
  pruefe('Einstellung "Bot-Sprüche: Aus": das Paket schweigt (eingebaute Begruessung des Hosts)', aus.letzteWahl === null && panelAus.eingebaut, JSON.stringify({ aus, panelAus }));

  // ---------- Wahl-Ort mit einem anderen Paket (wie der einmalige Level-Gruss von Funken auf Reihenfolge 40) ----------
  // Pruefer-Befund: Mit Reihenfolge 10 fuer alles ging der Level-Gruss meist still verloren. Vorn (10) steht nur noch die
  // Fairness-Sperre und die einmaligen Momente, alles andere hinten (60). waehle() ist genau der Aufruf von partie.js und
  // arena.js (erster Wert ungleich null gewinnt).
  gruppe = 'Wahl-Ort';
  await bereite(seite, {
    partien: [partie('lisa', 'remis', 1, { liveKlassen: ['brillant', null, null, null] }),
      partie('kalle', 'niederlage', 2), partie('kalle', 'niederlage', 3), partie('kalle', 'niederlage', 4),
      partie('rudi', 'niederlage', 9), partie('rudi', 'niederlage', 10), partie('rudi', 'niederlage', 11), partie('turm', 'remis', 10)],
    fortschritt: fortschritt(10, { lisa: { partien: 1, remis: 1 }, kalle: { partien: 3, niederlagen: 3 }, rudi: { partien: 3, niederlagen: 3 },
      turm: { partien: 1, remis: 1 } }),
  });
  const nachbar = await seite.evaluate(async () => {
    const o = await import('/js/orte.js');
    const b = await import('/js/bots.js');
    const S = await import('/js/storage.js');
    const aus = {};
    for (const id of ['lisa', 'kalle', 'rudi', 'turm', 'benno']) {
      const kontext = () => ({ bot: b.botNachId(id), farbe: 'w', modus: 'normal', partienGegenBot: S.ladePartien().filter((p) => p.botId === id) });
      let gefragt = 0;
      const ab = o.anbieten('partie:begruessung?', () => { gefragt++; return { anlass: 'nachbar-level' }; }, { reihenfolge: 40, paket: 'nachbar' });
      const mit = o.waehle('partie:begruessung?', kontext());
      ab();
      const ohne = o.waehle('partie:begruessung?', kontext());
      aus[id] = { mit: mit && mit.anlass, gefragt, ohne: ohne && ohne.anlass, angeboten: o.angeboten('partie:begruessung?') };
    }
    return aus;
  });
  const sollN = {};
  for (const id of Object.keys(nachbar)) sollN[id] = await erwartet(seite, id);
  const SOLL_PLATZ = { lisa: ['genial', false], kalle: ['mutmachen', true], rudi: ['wiedersehen', true], turm: ['wiedersehen', false], benno: ['kennenlernen', true] };
  const platzFehler = [];
  for (const [id, [grund, vorn]] of Object.entries(SOLL_PLATZ)) {
    const n = nachbar[id];
    const w = sollN[id];
    const ok = w && w.grund === grund && w.vorn === vorn && n.ohne === w.anlass && n.angeboten === 2
      && (vorn ? n.mit === w.anlass && n.gefragt === 0 : n.mit === 'nachbar-level' && n.gefragt === 1);
    if (!ok) platzFehler.push(`${id}: ${JSON.stringify({ n, grund: w && w.grund, vorn: w && w.vorn })}`);
  }
  pruefe('Nachbar-Paket auf 40: genial und wiedersehen (ohne Sperre) lassen ihm den Vortritt, ohne ihn kommen sie von hinten (60)',
    !platzFehler.some((f) => /^(lisa|turm):/.test(f)), platzFehler);
  pruefe('vor dem Nachbar-Paket (10): mutmachen, wiedersehen unter der Sperre (3 Niederlagen gegen Rudi) und kennenlernen; der Nachbar wird gar nicht gefragt',
    !platzFehler.some((f) => /^(kalle|rudi|benno):/.test(f)), platzFehler);

  // ---------- Erzfeind im Bot-Panel ----------
  gruppe = 'Erzfeind';
  await bereite(seite, { partien: [partie('kalle', 'niederlage', 1), partie('kalle', 'niederlage', 2), partie('kalle', 'sieg', 3), partie('kalle', 'niederlage', 4),
    partie('kalle', 'niederlage', 5), partie('benno', 'sieg', 6), partie('benno', 'niederlage', 7), partie('benno', 'niederlage', 8)],
  fortschritt: fortschritt(4, { kalle: { partien: 5, siege: 1, niederlagen: 4 }, benno: { partien: 3, siege: 1, niederlagen: 2 } }) });
  await seite.evaluate(() => window.__app.gehe('arena', { waehle: 'kalle' }));
  await seite.waitForFunction(() => /Kalle/.test((document.querySelector('.detail h2') || {}).textContent || ''), null, { timeout: 10000 });
  const ez = await seite.evaluate(() => {
    const o = document.querySelector('.detail .ort-panel-bot');
    const e = o && o.querySelector(':scope > .gd-erzfeind');
    const r = e && e.getBoundingClientRect();
    return { da: !!e, text: e ? e.textContent.trim() : '', sichtbar: !!(o && !o.hidden && r && r.width > 0 && r.height > 0), icon: !!(e && e.querySelector('svg.ico path')),
      nachZiel: !!(o && o.previousElementSibling && o.previousElementSibling.classList.contains('ziel-sterne')), hoehe: r ? r.height : 0 };
  });
  pruefe('Kalle (1 Sieg, 4 Niederlagen): ruhige Zeile "Dein Erzfeind · 1 Sieg · 4 Niederlagen" nach den Stern-Zielen', ez.da && ez.sichtbar && ez.icon && ez.nachZiel
    && ez.text === 'Dein Erzfeind · 1 Sieg · 4 Niederlagen' && ez.hoehe <= 60, JSON.stringify(ez));
  await warte(400);
  await seite.screenshot({ path: path.join(BILDER, 'panel-erzfeind-ipad.png') });
  await seite.evaluate(() => window.__app.gehe('arena', { waehle: 'benno' }));
  await seite.waitForFunction(() => /Benno/.test((document.querySelector('.detail h2') || {}).textContent || ''), null, { timeout: 10000 });
  pruefe('anderer Bot (Benno, 2 Niederlagen): keine Zeile, Ort versteckt', await seite.evaluate(() => {
    const o = document.querySelector('.detail .ort-panel-bot');
    return !o.querySelector('.gd-erzfeind') && o.hidden;
  }));

  // ---------- Revanche nach einer echten Niederlage ----------
  gruppe = 'Revanche';
  await bereite(seite, { partien: [], fortschritt: fortschritt(1) });
  await spiele(seite, NARR);
  await seite.waitForSelector('.ergebnis-overlay .erg-karte-ort .gd-revanche', { timeout: 40000 });
  await seite.waitForSelector('.ergebnis-overlay.gefuellt:not(.vorlaeufig)', { timeout: 60000 });
  const knopf = await seite.evaluate(() => {
    const o = document.querySelector('.erg-karte-ort');
    const k = o.querySelector(':scope > .gd-revanche-zeile[data-ort="ergebnis"] > button.gd-revanche');
    const r = k.getBoundingClientRect();
    // Hoehe ohne die Feder der Karte (getBoundingClientRect folgt dem transform)
    return { sichtbar: !o.hidden && r.width > 0, text: k.textContent.replace(/\s+/g, ' ').trim(), farbe: k.dataset.farbe, label: k.getAttribute('aria-label'),
      hoehe: k.offsetHeight, icon: !!k.querySelector('svg.ico path'), erg: document.querySelector('.ergebnis-overlay').classList.contains('niederlage'),
      tipp: document.querySelectorAll('.erg-tipp').length, art: k.parentElement.dataset.art || '' };
  });
  pruefe('Niederlage (Narrenmatt mit Weiß): Knopf "Revanche · Du spielst Schwarz" im Ort ergebnis:karte', knopf.sichtbar && knopf.erg && knopf.text === 'Revanche Du spielst Schwarz'
    && knopf.farbe === 'b' && knopf.label === 'Revanche, du spielst Schwarz' && knopf.icon, JSON.stringify(knopf));
  pruefe('Tippflaeche mindestens 44 px', knopf.hoehe >= 44, knopf.hoehe);
  // Pruefer-Befund: Die Revanche verdraengte nach jeder Niederlage den Tipp "Kopf hoch!" (und spaeter die Lichtblick-Karte von
  // U7), weil der Host beides nur bei leerem Ort zeigt. Die Zeile ist deshalb als reine Knopf-Zeile markiert; der Host
  // zaehlt sie mit der Knopf-Regel (Integrations-Patch fuer partie.js, ARCHITEKTUR.md) nicht als Inhalt. Bis dahin gilt
  // PLAN 2.6 (Tipp nur bei leerem Ort), danach muss der Tipp neben der Revanche stehen.
  const knopfRegel = /\[data-art="knopf"\]/.test(lies('js/ui/partie.js'));
  pruefe('reine Knopf-Zeile: .gd-revanche-zeile[data-art="knopf"] (kein Inhalt wie Lernpunkt oder Lichtblick)', knopf.art === 'knopf', knopf.art);
  pruefe(knopfRegel ? 'Host mit Knopf-Regel: der Tipp "Kopf hoch!" bleibt neben der Revanche stehen'
    : 'Host ohne Knopf-Regel (vor der Integration): mit gefuelltem Ort ergebnis:karte entfaellt der Tipp "Kopf hoch!" (PLAN 2.6)',
  knopf.tipp === (knopfRegel ? 1 : 0), JSON.stringify({ knopfRegel, tipp: knopf.tipp }));
  const echt = await seite.waitForFunction(() => {
    const id = (JSON.parse(localStorage.getItem('schach-arena:v1:partien') || '[]')[0] || {}).id;
    const m = JSON.parse(localStorage.getItem('schach-arena:v1:modul:bots') || 'null');
    const e = m && m.memo.find((x) => x[0] === id);
    return e ? { id, e } : null;
  }, null, { timeout: 15000 }).then((h) => h.jsonValue()).catch(() => null);
  pruefe('echte Spielanalyse (partie:analysiert) landet im Memo: kein genialer Zug von Flo, kein Patzer des Bots', echt && echt.e[1] === 0 && echt.e[2] === 0, JSON.stringify(echt));
  await warte(1200);
  await seite.screenshot({ path: path.join(BILDER, 'ergebnis-revanche-ipad.png') });
  const vorher = await seite.evaluate(() => window.__partie.laufId);
  await seite.evaluate(() => { window.__test = { botAnhalten: true }; });
  await seite.locator('.erg-karte-ort .gd-revanche').click();
  await seite.waitForFunction((alt) => window.__partie && window.__partie.laufId !== alt && window.__partie.bereit === true, vorher, { timeout: 30000 });
  const neu = await seite.evaluate(() => ({ bot: window.__partie.buehne.bot.id, farbe: window.__partie.buehne.farbe, modus: window.__partie.buehne.modus,
    hash: location.hash, overlay: !!document.querySelector('.ergebnis-overlay') }));
  pruefe('Klick: neue Partie gegen denselben Bot mit getauschten Farben (Schwarz), Modus normal', neu.bot === 'benno' && neu.farbe === 'b' && neu.modus === 'normal'
    && !neu.overlay, JSON.stringify(neu));
  const soll3 = await erwartet(seite, 'benno');
  const z3 = await zustand(seite);
  pruefe('Begruessung der Revanche-Partie folgt derselben Rechnung (Benno nach einer Niederlage)', JSON.stringify(soll3 ? soll3.anlass : null) === JSON.stringify(z3.letzteWahl ? z3.letzteWahl.anlass : null)
    && (!soll3 || soll3.grund === 'revanche'), JSON.stringify({ soll3, wahl: z3.letzteWahl }));
  await seite.evaluate(() => { window.__test = {}; window.__app.gehe('arena'); });
  await seite.waitForSelector('.screen.arena');

  // ---------- Revanche nach Remis (direkt am Ort) und keine nach Sieg oder Uebung ----------
  const ort = await seite.evaluate(async () => {
    const o = await import('/js/orte.js');
    const b = await import('/js/bots.js');
    const aufrufe = [];
    const app = { gehe: (s, p) => aufrufe.push([s, p]) };
    const k = (x) => ({ app, bot: b.botNachId('rudi'), farbe: 'b', ergebnis: 'remis', grund: 'patt', modus: 'normal', erg: { partie: { startFen: null, tempo: { grund: 180, zuschlag: 2 } } }, ...x });
    const zaehle = (x) => { const el = document.createElement('div'); const f = o.fuelle('ergebnis:karte', el, k(x)); const n = el.querySelectorAll('.gd-revanche').length; f.verlasse(); return n; };
    const el = document.createElement('div');
    document.body.append(el);
    const f = o.fuelle('ergebnis:karte', el, k({}));
    const knopf = el.querySelector('.gd-revanche');
    const text = knopf.textContent.replace(/\s+/g, ' ').trim();
    knopf.click();
    knopf.click();
    f.verlasse();
    el.remove();
    return { text, aufrufe, sieg: zaehle({ ergebnis: 'sieg' }), uebung: zaehle({ modus: 'uebung' }), boss: zaehle({ modus: 'boss' }) };
  });
  pruefe('Remis mit Schwarz: "Du spielst Weiß", app.gehe(\'partie\', { botId, farbe: \'w\', tempo }), Doppelklick startet nur einmal', ort.text === 'Revanche Du spielst Weiß'
    && JSON.stringify(ort.aufrufe) === '[["partie",{"botId":"rudi","farbe":"w","tempo":{"grund":180,"zuschlag":2}}]]', JSON.stringify(ort));
  pruefe('kein Knopf nach Sieg, in der Uebung und gegen Bosse', ort.sieg === 0 && ort.uebung === 0 && ort.boss === 0, JSON.stringify(ort));

  // ---------- Erzfeind bezwungen: echter Sieg gegen Benno (3 Niederlagen, 0 Siege) ----------
  gruppe = 'Erzfeind bezwungen';
  await bereite(seite, { partien: [partie('benno', 'niederlage', 1), partie('benno', 'niederlage', 2), partie('benno', 'niederlage', 3)],
    fortschritt: fortschritt(1, { benno: { partien: 3, niederlagen: 3 } }) });
  await spiele(seite, SCHAEFER);
  await seite.waitForSelector('.ergebnis-overlay .erg-feier .erg-f-zeile[data-quelle="erzfeind"]', { timeout: 40000 });
  await seite.waitForSelector('.ergebnis-overlay.gefuellt:not(.vorlaeufig)', { timeout: 60000 });
  await warte(2600);
  const feier = await seite.evaluate(() => {
    const z = document.querySelector('.erg-feier .erg-f-zeile[data-quelle="erzfeind"]');
    return { gross: z.classList.contains('gross'), titel: z.querySelector('b').textContent, text: (z.querySelector('small') || {}).textContent || '',
      symbol: !!z.querySelector('.erg-f-symbol svg'), revanche: document.querySelectorAll('.gd-revanche').length,
      modul: JSON.parse(localStorage.getItem('schach-arena:v1:modul:bots') || 'null') };
  });
  pruefe('Sieg gegen den Erzfeind: grosse Feier "Erzfeind bezwungen" mit Beleg und Symbol', feier.gross && feier.titel === 'Erzfeind bezwungen'
    && feier.text === 'Gegen Bauer Benno, nach 3 Niederlagen' && feier.symbol, JSON.stringify(feier));
  pruefe('nach einem Sieg kein Revanche-Knopf; Feier im Modul gemerkt (3 Niederlagen)', feier.revanche === 0 && feier.modul && feier.modul.erzfeind.benno === 3, JSON.stringify(feier.modul));
  await seite.screenshot({ path: path.join(BILDER, 'ergebnis-erzfeind-ipad.png') });
  await seite.evaluate(() => window.__app.gehe('arena'));
  await seite.waitForSelector('.screen.arena');
  await spiele(seite, SCHAEFER);
  await seite.waitForSelector('.ergebnis-overlay.gefuellt:not(.vorlaeufig)', { timeout: 60000 });
  await warte(2600);
  const zweiter = await seite.evaluate(() => ({ erzfeind: document.querySelectorAll('.erg-feier .erg-f-zeile[data-quelle="erzfeind"]').length,
    fs: JSON.parse(localStorage.getItem('schach-arena:v1:fortschritt')).bots.benno }));
  pruefe('zweiter Sieg ohne neue Niederlage: keine zweite Erzfeind-Feier', zweiter.erzfeind === 0 && zweiter.fs.siege === 2 && zweiter.fs.niederlagen === 3, JSON.stringify(zweiter));
  await seite.evaluate(() => window.__app.gehe('arena'));
  await seite.waitForSelector('.screen.arena');
  pruefe('Konsole ohne Fehler (iPad)', fehler.length === 0, fehler.join(' | '));
  await kontext.close();

  // ---------- Handy hell und dunkel ----------
  gruppe = 'Handy';
  for (const dunkel of [false, true]) {
    const h = await neueSeite(browser, { w: 390, h: 844, handy: true, dunkel });
    await h.seite.goto(BASIS + '#arena');
    await h.seite.waitForFunction(() => !!window.__app, null, { timeout: 20000 });
    await bereite(h.seite, { partien: [], fortschritt: fortschritt(1), einstellungen: { modus: dunkel ? 'dunkel' : 'hell' } });
    await h.seite.waitForSelector('.screen.arena');
    await spiele(h.seite, NARR, { handy: true });
    await h.seite.waitForSelector('.ergebnis-overlay .erg-karte-ort .gd-revanche', { timeout: 40000 });
    await h.seite.waitForSelector('.ergebnis-overlay.gefuellt:not(.vorlaeufig)', { timeout: 60000 });
    await warte(1400);
    const m = await h.seite.evaluate(() => {
      const k = document.querySelector('.gd-revanche');
      const r = k.getBoundingClientRect();
      const cs = getComputedStyle(k);
      return { links: r.left, rechts: r.right, breite: innerWidth, hoehe: k.offsetHeight, scroll: document.documentElement.scrollWidth <= innerWidth + 1,
        hg: cs.backgroundColor, farbe: cs.color, modus: document.documentElement.dataset.modus || '' };
    });
    pruefe(`${dunkel ? 'dunkel' : 'hell'}: Knopf ganz im Bild, mindestens 44 px hoch, keine waagrechte Rolle`, m.links >= 0 && m.rechts <= m.breite && m.hoehe >= 44 && m.scroll, JSON.stringify(m));
    await h.seite.screenshot({ path: path.join(BILDER, `ergebnis-revanche-handy-${dunkel ? 'dunkel' : 'hell'}.png`) });
    // Erzfeind-Zeile und Gedaechtnis-Satz im Bot-Panel (Kalle: 1 Sieg, 4 Niederlagen, die letzten 3 in Folge: Mut)
    await h.seite.evaluate(() => window.__app.gehe('arena'));
    await h.seite.waitForSelector('.screen.arena');
    await bereite(h.seite, { partien: [partie('kalle', 'niederlage', 1), partie('kalle', 'niederlage', 2), partie('kalle', 'niederlage', 3),
      partie('kalle', 'sieg', 4), partie('kalle', 'niederlage', 5)], fortschritt: fortschritt(4, { kalle: { partien: 5, siege: 1, niederlagen: 4 } }),
    einstellungen: { modus: dunkel ? 'dunkel' : 'hell' } });
    await h.seite.evaluate(() => window.__app.gehe('arena', { waehle: 'kalle' }));
    await h.seite.waitForFunction(() => /Kalle/.test((document.querySelector('.detail h2') || {}).textContent || '') && !!document.querySelector('.detail .gd-erzfeind'),
      null, { timeout: 10000 });
    // auf dem Handy stehen Sprechblase und Ort arena:panel-bot hinter "Mehr" (.detail.offen, css/app.css): aufklappen wie Flo,
    // sonst waeren beide display:none und jede Pruefung der Masse leer
    // Seit der Weltkarte (U5) gibt es am Handy kein "Mehr" mehr: das Panel zeigt alles und rollt. Den alten Weg gibt es nur
    // noch, wenn der Knopf da ist.
    const mehrDa = await h.seite.locator('.detail .mehr-knopf').count() > 0;
    const zu = mehrDa ? await h.seite.evaluate(() => document.querySelector('.detail .gd-erzfeind').getBoundingClientRect().height === 0) : true;
    if (mehrDa) await h.seite.locator('.detail .mehr-knopf').click();
    await h.seite.waitForFunction((m) => (!m || document.querySelector('.detail').classList.contains('offen'))
      && document.querySelector('.detail .gd-erzfeind').getBoundingClientRect().height > 0, mehrDa, { timeout: 5000 });
    await h.seite.evaluate(() => document.querySelector('.detail .gd-erzfeind').scrollIntoView({ block: 'center' }));
    await warte(600);
    const ezH = await h.seite.evaluate(() => {
      const e = document.querySelector('.detail .gd-erzfeind');
      const r = e.getBoundingClientRect();
      const cs = getComputedStyle(e);
      const bl = document.querySelector('.detail .sprechblase');
      const rb = bl ? bl.getBoundingClientRect() : { height: 0 };
      return { links: r.left, rechts: r.right, oben: r.top, unten: r.bottom, breite: innerWidth, hoch: innerHeight, hoehe: r.height, text: e.textContent.trim(),
        farbe: cs.color, hg: cs.backgroundColor, scroll: document.documentElement.scrollWidth <= innerWidth + 1,
        blase: bl ? bl.textContent : '', blaseHoehe: rb.height };
    });
    const sollH = await erwartet(h.seite, 'kalle');
    pruefe(`${dunkel ? 'dunkel' : 'hell'}: Erzfeind-Zeile sichtbar (mit "Mehr": erst zu, dann auf), ganz im Bild (390 px), eine ruhige Zeile, keine waagrechte Rolle`,
      zu && ezH.hoehe >= 20 && ezH.hoehe <= 60 && ezH.links >= 0 && ezH.rechts <= ezH.breite && ezH.oben >= 0 && ezH.unten <= ezH.hoch && ezH.scroll
      && ezH.text === 'Dein Erzfeind · 1 Sieg · 4 Niederlagen' && ezH.farbe !== ezH.hg, JSON.stringify({ zu, ...ezH }));
    pruefe(`${dunkel ? 'dunkel' : 'hell'}: Panel-Begruessung nach 3 Niederlagen in Folge: Mut-Satz, genau die bestimmte Variante, sichtbar`,
      sollH && sollH.grund === 'mutmachen' && ezH.blase === `„${sollH.text}“` && ezH.blaseHoehe > 0, JSON.stringify({ blase: ezH.blase, hoehe: ezH.blaseHoehe, soll: sollH }));
    await h.seite.screenshot({ path: path.join(BILDER, `panel-erzfeind-handy-${dunkel ? 'dunkel' : 'hell'}.png`) });
    pruefe(`${dunkel ? 'dunkel' : 'hell'}: Konsole ohne Fehler`, h.fehler.length === 0, h.fehler.join(' | '));
    await h.kontext.close();
  }

  // ---------- Produktion: das Paket aus der Liste PAKETE (wie nach der Integration) ----------
  gruppe = 'PAKETE';
  const pr = await neueSeite(browser);
  await pr.seite.route('**/js/erweiterungen.js', (r) => r.fulfill({ status: 200, contentType: 'text/javascript',
    body: `export const PAKETE = Object.freeze(['sicherung', '${ERW}']);\nexport const REITER = Object.freeze([]);\n` }));
  await pr.seite.goto(`http://127.0.0.1:${PORT}/index.html#arena`);
  await pr.seite.waitForSelector('.screen.arena');
  const prod = await pr.seite.evaluate(async () => {
    await new Promise((r) => setTimeout(r, 300));
    const o = await import('./js/orte.js');
    return { gruss: o.angeboten('partie:begruessung?'), erg: o.angeboten('ergebnis:karte'), css: !!document.querySelector('link[data-paket="gedaechtnis"]'),
      blase: (document.querySelector('.detail .sprechblase') || {}).textContent || '' };
  });
  // Welten: der erste Gegner eines frischen Spielstands ist Willi (Stufe 1)
  const sollP = await erwartet(pr.seite, 'fridolin');
  pruefe('ohne ?test aus PAKETE geladen (Anbieter und CSS da), Willi begruesst zum Kennenlernen', prod.gruss === 2 && prod.erg === 1 && prod.css
    && sollP && sollP.grund === 'kennenlernen' && prod.blase === `„${sollP.text}“`, JSON.stringify({ prod, sollP }));
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
  if (!NUR_NODE) console.log('Bilder: ' + BILDER);
  code = fehlend.length ? 1 : 0;
} catch (e) {
  console.error(e);
  code = 1;
} finally {
  if (browser) await browser.close();
  if (server) server.kill();
}
process.exit(code);
