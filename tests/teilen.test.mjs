// Tests fuer das Paket "teilen" (Welle A, A1: Siegesbild). Node-Teil ohne Browser (Daten, Endstellung, Lage,
// Farben aus den Tokens, Zeichnen mit einem Fake-Kontext, keine persoenlichen Daten), danach Browser-Teil
// (Playwright, Chromium) gegen die echte App mit dem Paket ueber ?test&erw=pakete/teilen/index: Knopf im Ergebnis nach
// einem echten Sieg, Leinwand 1080 x 1350 mit Feldfarben aus den Tokens, Hell und Dunkel, Speichern ohne
// navigator.share, Teilen mit Datei, Abbrechen im Teilen-Blatt, Benutzername nur mit Schalter, Analyse und Verlauf,
// kein Knopf nach Niederlage oder Uebung, Handy-Bilder, Laden ueber die Liste PAKETE (Produktion).
//
//   node tests/teilen.test.mjs              alles
//   node tests/teilen.test.mjs --nur-node   ohne Browser
//   PORT=9700 BILDER=<ordner> node tests/teilen.test.mjs
//
// Playwright: PLAYWRIGHT_PFAD, sonst 'playwright', sonst /opt/node-tools/node_modules/playwright.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { browserTyp } from './browser.mjs';

const require = createRequire(import.meta.url);
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8861);
const ERW = 'pakete/teilen/index';
const BASIS = `http://127.0.0.1:${PORT}/index.html?test&erw=${ERW}`;
const NUR_NODE = process.argv.includes('--nur-node');
const BILDER = process.env.BILDER || path.join(WURZEL, 'design', 'app-shots', 'teilen');
const lies = (d) => readFileSync(path.join(WURZEL, d), 'utf8');
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

const ergebnisse = [];
let gruppe = '';
function pruefe(name, ok, detail = '') {
  ergebnisse.push({ name: (gruppe ? gruppe + ': ' : '') + name, ok: !!ok, detail });
  console.log(`${ok ? 'ok  ' : 'FEHLER'} ${gruppe ? gruppe + ': ' : ''}${name}${!ok && detail ? ' (' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) + ')' : ''}`);
}

// kleiner CSS-Leser (Regeln mit @media-Huelle), wie in tests/thema.test.mjs
function leseCss(text) {
  const t = String(text).replace(/\/\*[\s\S]*?\*\//g, '');
  const regeln = [];
  let i = 0;
  const block = (media) => {
    for (;;) {
      while (i < t.length && /\s/.test(t[i])) i++;
      if (i >= t.length || t[i] === '}') { i++; return; }
      const auf = t.indexOf('{', i);
      if (auf < 0) { i = t.length; return; }
      const kopf = t.slice(i, auf).trim();
      i = auf + 1;
      if (/^@(media|supports)/.test(kopf)) { block(kopf); continue; }
      const zu = t.indexOf('}', i);
      const decls = t.slice(i, zu).split(';').map((d) => d.trim()).filter(Boolean).map((d) => {
        const k = d.indexOf(':');
        return [d.slice(0, k).trim(), d.slice(k + 1).trim()];
      });
      i = zu + 1;
      regeln.push({ media, selektor: kopf, decls });
    }
  };
  block(null);
  return regeln;
}
const hexRgb = (h) => {
  const m = /^#([0-9a-f]{6})$/i.exec(String(h).trim());
  return m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)) : null;
};

// Schaefermatt gegen Benno (wertende Partie, Weiss): 4. Dxf7#
const SCHAEFER = ['e2e4', 'e7e5', 'f1c4', 'b8c6', 'd1h5', 'g8f6', 'h5f7'];
const SCHAEFER_FEN = 'r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR';

// =====================================================================
// Node-Teil
// =====================================================================
async function nodeTeil() {
  // Speicher fuer storage.js (wertet, Modul-Speicher) ohne Browser
  const s = new Map();
  globalThis.localStorage = {
    get length() { return s.size; }, key: (i) => [...s.keys()][i] ?? null, getItem: (k) => (s.has(k) ? s.get(k) : null),
    setItem: (k, v) => s.set(k, String(v)), removeItem: (k) => s.delete(k), clear: () => s.clear(),
  };
  const storage = await import('../js/storage.js');
  storage.setzeSpeicher(globalThis.localStorage);
  const L = await import('../js/pakete/teilen/logik.js');
  const B = await import('../js/pakete/teilen/bild.js');
  const { BOTS } = await import('../js/bots.js');
  const koenig = BOTS.find((b) => b.id === 'koenig');

  gruppe = 'Grundlagen';
  pruefe('Leinwand 1080 x 1350 (4:5, Instagram und WhatsApp)', L.BREITE === 1080 && L.HOEHE === 1350);
  pruefe('Rechenstand als Zahl (Bildstand fuer spaeteres Nachrechnen)', Number.isInteger(L.RECHENSTAND) && L.RECHENSTAND >= 1);
  pruefe('Modul teilen im MODUL_BUDGET mit 2.000 Zeichen', storage.MODUL_BUDGET.teilen === 2000);
  const sp = storage.speichereModul('teilen', { v: 1, geteilt: Array.from({ length: 20 }, (_, i) => ({ id: 'p' + 'x'.repeat(14) + i, tag: '2026-10-22', weg: 'teilen' })) });
  pruefe('20 gemerkte Partien passen ins Budget (hoechstens 20 werden gemerkt)', sp.ok === true, sp);
  const se = storage.speichereModulEinstellungen('teilen', { bild: 'dunkel', name: true });
  pruefe('Einstellungen des Pakets speicherbar (Modul-Einstellungen teilen)', se.ok === true && storage.ladeModulEinstellungen('teilen', {}).bild === 'dunkel', se);

  gruppe = 'teilbar';
  const sieg = { id: 'p1', ergebnis: 'sieg', grund: 'matt', zuege: SCHAEFER, spielerFarbe: 'w', modus: 'normal', botId: 'benno', sterne: [true, true, false], genauigkeit: 87.43, datum: new Date(2026, 9, 22, 12, 30).toISOString() };
  pruefe('Sieg einer normalen Partie: ja', L.teilbar(sieg));
  pruefe('Remis: ja', L.teilbar({ ...sieg, ergebnis: 'remis', grund: 'wiederholung' }));
  pruefe('Niederlage: nein (Niederlagen nie laut, Fairness 10)', !L.teilbar({ ...sieg, ergebnis: 'niederlage' }));
  pruefe('Übung: nein', !L.teilbar({ ...sieg, modus: 'uebung' }));
  pruefe('Partie aus eigener Stellung: nein; aus der Grundstellung als startFen: ja', !L.teilbar({ ...sieg, startFen: '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1', zuege: ['a1a8'] })
    && L.teilbar({ ...sieg, startFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' }));
  pruefe('Boss-Sieg: ja (Bild ohne Sterne)', L.teilbar({ ...sieg, modus: 'boss' }));
  pruefe('ohne Zuege oder ohne Datensatz: nein', !L.teilbar({ ...sieg, zuege: [] }) && !L.teilbar(null) && !L.teilbar('sieg'));

  gruppe = 'Endstellung';
  const e1 = L.endstellung(null, SCHAEFER);
  pruefe('Schaefermatt: Stellung nach Dxf7#, letzter Zug h5-f7', e1.fen === SCHAEFER_FEN && e1.zuletzt.join() === 'h5,f7' && e1.plies === 7, JSON.stringify(e1));
  const e2 = L.endstellung('6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1', ['a1a8']);
  pruefe('aus einer Stellung (Matt in 1)', e2.fen === 'R5k1/5ppp/8/8/8/8/5PPP/6K1' && e2.zuletzt.join() === 'a1,a8');
  const e3 = L.endstellung(null, ['e2e4', 'e2e4', 'e7e5']);
  pruefe('ungueltiger Zug beendet das Nachspielen (Stand davor)', e3.plies === 1 && e3.zuletzt.join() === 'e2,e4');
  const e4 = L.endstellung('8/P7/8/8/8/8/8/k6K w - - 0 60', ['a7a8q']);
  pruefe('Umwandlung (a7a8q)', e4.fen.startsWith('Q7/') && e4.zuletzt.join() === 'a7,a8');
  pruefe('ohne Zuege: Grundstellung, kein letzter Zug', L.endstellung(null, []).fen === 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR' && L.endstellung(null, []).zuletzt.length === 0);

  gruppe = 'Zuege';
  pruefe('Schaefermatt: 4 (wie "Schachmatt im 4. Zug")', L.zugZahl(null, 7) === 4);
  pruefe('Startstellung mit Schwarz am Zug, Zug 10: zwei Halbzuege -> 11', L.zugZahl('8/8/8/8/8/8/8/k6K b - - 0 10', 2) === 11);
  pruefe('ohne Halbzug: 0', L.zugZahl(null, 0) === 0);

  gruppe = 'Datum und Adresse';
  pruefe('Datum TT.MM.JJJJ', L.datumText(new Date(2026, 9, 22, 12).toISOString()) === '22.10.2026');
  pruefe('vor 4:00 Uhr: Vortag (Tagesgrenze aus tag.js)', L.datumText(new Date(2026, 9, 23, 3, 30).toISOString()) === '22.10.2026');
  pruefe('kaputtes Datum: null', L.datumText('gestern') === null && L.datumText(null) === null);
  pruefe('Adresse ohne Protokoll, index.html, Suche und Anker', L.adresseAus('https://floboldt007-cmyk.github.io/schach/index.html?test&erw=x#arena') === 'floboldt007-cmyk.github.io/schach'
    && L.adresseAus('http://127.0.0.1:9700/index.html?test') === '127.0.0.1:9700' && L.adresseAus('https://www.crownmate.de/') === 'crownmate.de' && L.adresseAus('kaputt') === '');
  pruefe('Benutzername nur wie im Konto (3 bis 20 Zeichen A-Z, 0-9, _), keine E-Mail, kein Klarname mit Leerzeichen',
    L.gueltigerName('FloTest') === 'FloTest' && L.gueltigerName('flo@example.org') === null && L.gueltigerName('Max Mustermann') === null && L.gueltigerName('ab') === null && L.gueltigerName(42) === null);

  gruppe = 'Bilddaten';
  const bot = { id: koenig.id, name: koenig.name, avatar: koenig.avatar };
  const d = L.bildDaten({ ...sieg, botId: 'koenig' }, { bot, adresse: 'floboldt007-cmyk.github.io/schach' });
  pruefe('Titel "Sieg gegen Kommissar König"', d.titel === 'Sieg gegen Kommissar König' && d.wort === 'Sieg' && d.ausruf === '!' && d.gegner === 'gegen Kommissar König', d.titel);
  pruefe('Ueberzeile mit dem Mattzug', d.ueber === 'Schachmatt im 4. Zug', d.ueber);
  pruefe('Genauigkeit mit Komma, Zuege, Datum, Sterne', d.genauigkeit === '87,4 %' && d.zuege === 4 && d.datum === '22.10.2026' && JSON.stringify(d.sterne) === '[true,true,false]');
  pruefe('Endstellung, letzter Zug, Farbe unten', d.fen === SCHAEFER_FEN && d.zuletzt.join() === 'h5,f7' && d.unten === 'w');
  pruefe('Marke, Fuss, Adresse, Dateiname ohne persoenliche Angaben', d.marke === 'Crownmate' && d.fuss === 'crownmate' && d.adresse === 'floboldt007-cmyk.github.io/schach'
    && d.dateiname === 'crownmate-sieg-2026-10-22.png');
  pruefe('genau die Felder aus FELDER, eingefroren', JSON.stringify(Object.keys(d)) === JSON.stringify(L.FELDER) && Object.isFrozen(d));
  const remis = L.bildDaten({ ...sieg, ergebnis: 'remis', grund: 'patt', genauigkeit: null }, { bot });
  pruefe('Remis: Wort ohne Ausrufezeichen, Grund Patt, keine Sterne, keine Genauigkeit ohne Analyse', remis.wort === 'Remis' && remis.ausruf === '' && remis.ueber === 'Patt'
    && remis.sterne === null && remis.genauigkeit === null && remis.titel === 'Remis gegen Kommissar König');
  const boss = L.bildDaten({ ...sieg, modus: 'boss', botId: 'boss-x' }, { bot: { id: 'boss-x', name: 'Der Eiserne', avatar: 'data:image/svg+xml,<svg/>' } });
  pruefe('Boss: Ueberzeile "Boss · …", keine Sterne (wertet nie)', boss.ueber === 'Boss · Schachmatt im 4. Zug' && boss.sterne === null, boss.ueber);
  pruefe('ohne Bot: "gegen deinen Gegner"', L.bildDaten(sieg, {}).titel === 'Sieg gegen deinen Gegner');
  pruefe('Schwarz unten bei Partien mit Schwarz', L.bildDaten({ ...sieg, spielerFarbe: 'b' }, { bot }).unten === 'b');
  pruefe('Genauigkeit ausserhalb 0..100 oder kaputt: nicht im Bild', L.bildDaten({ ...sieg, genauigkeit: 140 }, { bot }).genauigkeit === null
    && L.bildDaten({ ...sieg, genauigkeit: 'viel' }, { bot }).genauigkeit === null);
  // keine persoenlichen Daten: ein Datensatz mit fremden Feldern und ein Bot-Objekt mit mehr als Name und Bild
  const fremd = { ...sieg, botId: 'koenig', email: 'flo.privat@example.org', klarname: 'Max Beispiel', notiz: 'geheim', extra: { konto: { email: 'flo.privat@example.org' } } };
  const dFremd = L.bildDaten(fremd, { bot: { ...bot, bio: 'Bio-Text', email: 'bot@x.de' }, name: 'Max Beispiel', adresse: 'a.b' });
  const json = JSON.stringify(dFremd);
  pruefe('nur uebergebene Felder: keine E-Mail, kein Klarname, keine Notiz, keine Bio im Bild', !/@|Max|geheim|Bio-Text|Beispiel/.test(json), json);
  pruefe('Benutzername nur, wenn uebergeben und gueltig', L.bildDaten(sieg, { bot, name: 'FloTest' }).name === 'FloTest' && d.name === null);

  gruppe = 'Lage';
  const l = L.layout();
  const box = (n, b) => ({ n, x: b.x, y: b.y, r: b.x + (b.w ?? b.s), u: b.y + (b.h ?? b.s) });
  const k = l.karte;
  const teile = [
    box('marke', l.marke), box('portraet', l.portraet), box('sockel', l.sockelBox),
    { n: 'werte', x: l.werte.x, y: l.werte.y, r: l.werte.x + l.werte.w, u: l.werte.y + 2 * l.werte.abstand + l.werte.wert + 40 },
    { n: 'kopf', x: l.links, y: l.ueber.y - l.ueber.gr, r: l.portraet.x - 24, u: l.name.y + 10 },
    { n: 'fuss', x: l.links, y: l.linie.y, r: l.rechts, u: l.fuss.y + l.fuss.gr / 2 },
  ];
  const drin = teile.every((t) => t.x >= k.x + 40 && t.r <= k.x + k.w - 40 && t.y >= k.y + 40 && t.u <= k.y + k.h - 20);
  pruefe('alle Bereiche in der Karte (mit Polster)', drin && k.x >= 0 && k.y >= 0 && k.x + k.w <= L.BREITE && k.y + k.h <= L.HOEHE, JSON.stringify(teile));
  const schneidet = (a, b) => a.x < b.r && b.x < a.r && a.y < b.u && b.y < a.u;
  const paare = [];
  for (let i = 0; i < teile.length; i++) for (let j = i + 1; j < teile.length; j++) if (schneidet(teile[i], teile[j])) paare.push(teile[i].n + '/' + teile[j].n);
  pruefe('keine Ueberlappung (Marke, Kopf, Portraet, Brett, Werte, Fuss)', paare.length === 0, paare.join(' '));
  pruefe('Brett: 8 Felder ganzzahlig, mindestens 70 px je Feld, Sockel drumherum', Number.isInteger(l.brett.feld) && l.brett.feld >= 70 && l.brett.groesse === 8 * l.brett.feld
    && l.sockelBox.w === l.brett.groesse + 2 * l.brett.sockel);
  const a1 = L.feldRechteck('a1', 'w', l);
  const h8 = L.feldRechteck('h8', 'w', l);
  const a1b = L.feldRechteck('a1', 'b', l);
  pruefe('feldRechteck: a1 unten links (Weiss unten), oben rechts (Schwarz unten)', a1.x === l.brett.x && a1.y === l.brett.y + 7 * l.brett.feld
    && h8.x === l.brett.x + 7 * l.brett.feld && h8.y === l.brett.y && a1b.x === l.brett.x + 7 * l.brett.feld && a1b.y === l.brett.y && L.feldRechteck('z9') === null);

  gruppe = 'Farben aus Tokens';
  const regeln = leseCss(lies('css/themes/modern.css'));
  const hell = L.themaTokens(regeln, 'modern', 'hell');
  const dunkel = L.themaTokens(regeln, 'modern', 'dunkel');
  pruefe('hell: Papier #F4F1EC, Karte #FFFFFF; dunkel: Schiefer #15171B, Karte #1E2126', hell['--grund'] === '#F4F1EC' && hell['--flaeche'] === '#FFFFFF'
    && dunkel['--grund'] === '#15171B' && dunkel['--flaeche'] === '#1E2126');
  const fehlt = (w) => L.TOKENS_THEMA.filter((t) => !w[t]);
  pruefe('jeder Token des Bildes im Theme (hell und dunkel)', !fehlt(hell).length && !fehlt(dunkel).length, [...fehlt(hell), ...fehlt(dunkel)].join(' '));
  pruefe('Bot-Toenung je Modus (Portraet-Hintergrund)', hell['--bot-koenig-tint'] === '#ECE3D1' && dunkel['--bot-koenig-tint'] === '#423D31');
  pruefe('Selektor mit einfachen Anfuehrungszeichen gilt auch (Browser schreiben sie verschieden)',
    L.themaTokens([{ selektor: ":root[data-thema='modern']", decls: [['--grund', '#111111']], media: null }], 'modern', 'hell')['--grund'] === '#111111');
  pruefe('Regeln in @media zaehlen nicht (System-Block)', !L.themaTokens([{ selektor: ':root[data-thema="modern"]', decls: [['--grund', '#111111']], media: '(prefers-color-scheme: dark)' }], 'modern', 'hell')['--grund']);
  const tok = leseCss(lies('css/tokens.css'));
  const brett = (b) => Object.fromEntries((tok.find((r) => r.selektor.includes(`html[data-brett="${b}"]`)) || { decls: [] }).decls);
  pruefe('Brett-Tokens (Feldfarben, letzter Zug) je Brettfarbe in tokens.css', ['nacht', 'gruen', 'holz'].every((b) => L.TOKENS_BRETT.every((t) => brett(b)[t])));
  const bildJs = lies('js/pakete/teilen/bild.js').replace(/\/\/.*$/gm, '');
  pruefe('bild.js ohne feste Hex-Farben (nur Tokens; Rueckfaelle nur fuer fehlende Tokens)', (bildJs.match(/#[0-9a-fA-F]{3,8}\b/g) || []).every((h) => ['#808080', '#202020', '#f0f0f0', '#000', '#555', '#c90', '#eee', '#fff', '#e4e8f6', '#7c87b6', '#ddd'].includes(h)),
    (bildJs.match(/#[0-9a-fA-F]{3,8}\b/g) || []).join(' '));
  const css = lies('css/pakete/teilen.css').replace(/\/\*[\s\S]*?\*\//g, '');
  pruefe('css/pakete/teilen.css nur mit Tokens (keine Hex-, rgb- oder Farbnamen-Werte)', !/#[0-9a-fA-F]{3,8}\b|rgba?\(|\b(white|black)\b/.test(css));

  gruppe = 'Zeichnen (Fake-Kontext)';
  const aufrufe = [];
  const fake = () => {
    const t = { font: '10px sans-serif', fillStyle: '', strokeStyle: '', lineWidth: 1, textAlign: 'left', textBaseline: 'alphabetic', letterSpacing: '0px' };
    return new Proxy(t, {
      get(o, k) {
        if (k in o) return o[k];
        if (k === 'measureText') return (s) => ({ width: String(s).length * 0.55 * (parseFloat(/(\d+)px/.exec(o.font)[1]) || 10) });
        return (...a) => aufrufe.push({ k, a, fill: o.fillStyle, font: o.font });
      },
      set(o, k, v) { o[k] = v; return true; },
    });
  };
  const farben = { ...hell, '--feld-hell': '#e4e8f6', '--feld-dunkel': '#7c87b6', '--zuletzt': 'rgba(118, 206, 255, .5)' };
  const r = B.zeichne(fake(), d, farben, {});
  pruefe('64 Felder, Texte in Zeichenfolge zurueck', r.felder === 64 && Array.isArray(r.texte) && r.texte.length > 10);
  const rechtecke = aufrufe.filter((a) => a.k === 'fillRect' && a.a[2] === l.brett.feld && a.a[3] === l.brett.feld);
  const an = (feld) => rechtecke.filter((a) => { const q = L.feldRechteck(feld, 'w', l); return a.a[0] === q.x && a.a[1] === q.y; }).map((a) => a.fill);
  pruefe('a1 dunkel, h1 hell, e4 hell (Feldfarben aus den Brett-Tokens)', an('a1')[0] === '#7c87b6' && an('h1')[0] === '#e4e8f6' && an('e4')[0] === '#e4e8f6', JSON.stringify([an('a1'), an('h1'), an('e4')]));
  pruefe('letzter Zug h5 und f7 mit Toenung --zuletzt, andere Felder ohne', an('h5')[1] === farben['--zuletzt'] && an('f7')[1] === farben['--zuletzt'] && an('e4').length === 1);
  const erlaubt = new Set([d.marke, d.datum, d.ueber.toUpperCase(), d.wort, d.ausruf, d.gegner, d.genauigkeit, String(d.zuege), 'Züge', 'Zug', 'Sterne', 'Genauigkeit', d.fuss, d.adresse,
    ...'abcdefgh12345678', ...'KDTLSB', 'K']);
  const fremdeTexte = r.texte.filter((t) => !erlaubt.has(t));
  pruefe('im Bild stehen nur Texte aus den Bilddaten (dazu Koordinaten und Beschriftungen)', fremdeTexte.length === 0, fremdeTexte.join(' | '));
  pruefe('Titel-Teile im Bild: "Sieg", "!", "gegen Kommissar König", Genauigkeit, Datum, crownmate, Adresse',
    ['Sieg', '!', 'gegen Kommissar König', '87,4 %', '22.10.2026', 'crownmate', 'floboldt007-cmyk.github.io/schach', 'Crownmate'].every((t) => r.texte.includes(t)), r.texte.join(' | '));
  const rFremd = B.zeichne(fake(), dFremd, farben, {});
  pruefe('Datensatz mit E-Mail und Klarname: nichts davon im Bild', !rFremd.texte.some((t) => /@|Max|Beispiel|geheim/.test(t)), rFremd.texte.join(' | '));
  const rName = B.zeichne(fake(), L.bildDaten(sieg, { bot, name: 'FloTest' }), farben, {});
  pruefe('mit Benutzername: "Gespielt von FloTest"', rName.texte.includes('Gespielt von FloTest') && !r.texte.some((t) => /FloTest/.test(t)));
  const textAn = (t, x, y) => aufrufe.some((a) => a.k === 'fillText' && a.a[0] === t && a.a[1] === x && a.a[2] === y);
  const untenLinks = [l.brett.x + 6, l.brett.y + 7 * l.brett.feld + 6];
  const linieLinks = [l.brett.x + l.brett.feld - 6, l.brett.y + 8 * l.brett.feld - 5];
  pruefe('Weiss unten: Reihe 1 und Linie a unten links', textAn('1', ...untenLinks) && textAn('a', ...linieLinks));
  aufrufe.length = 0;
  const rSchwarz = B.zeichne(fake(), L.bildDaten({ ...sieg, spielerFarbe: 'b' }, { bot }), farben, {});
  pruefe('Schwarz unten: Brett gedreht (Reihe 8 und Linie h unten links, schwarzer Koenig e8 unten)', rSchwarz.felder === 64 && textAn('8', ...untenLinks) && textAn('h', ...linieLinks)
    && L.feldRechteck('e8', 'b', l).y === l.brett.y + 7 * l.brett.feld);
  pruefe('ohne Figurenbilder: Ersatz mit deutschen Buchstaben (K, D, T, L, S, B)', ['K', 'D', 'T', 'L', 'S', 'B'].every((t) => r.texte.includes(t)));
  aufrufe.length = 0;
  B.zeichne(fake(), L.bildDaten(sieg, { bot: { id: 'x', name: 'Ein sehr langer Gegnername mit vielen Worten und noch mehr' } }), farben, {});
  const gz = aufrufe.find((a) => a.k === 'fillText' && String(a.a[0]).startsWith('gegen'));
  const gzBreite = gz ? String(gz.a[0]).length * 0.55 * parseFloat(/(\d+)px/.exec(gz.font)[1]) : Infinity;
  pruefe('langer Gegnername wird kleiner und notfalls gekuerzt, nie breiter als die Spalte (links vom Portraet)', gzBreite <= Math.min(l.gegner.max, l.portraet.x - 32 - l.links),
    gz && `${gz.a[0]} ${gz.font} ${gzBreite}`);
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

async function neueSeite(browser, { w = 1180, h = 820, handy = false, reduziert = false, acceptDownloads = true } = {}) {
  const kontext = await browser.newContext({
    viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: handy, isMobile: handy, acceptDownloads,
    reducedMotion: reduziert ? 'reduce' : 'no-preference',
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

// Pixel der Leinwand im offenen Blatt (Lage aus logik.js, Erwartung aus den Tokens der Seite)
async function leinwand(seite) {
  return seite.evaluate(async () => {
    const L = await import('/js/pakete/teilen/logik.js');
    const c = document.querySelector('.tl-blatt canvas');
    if (!c) return null;
    const ctx = c.getContext('2d');
    const px = (x, y) => [...ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data];
    const mitte = (f) => { const q = L.feldRechteck(f, 'w'); return px(q.x + q.s / 2, q.y + q.s / 2); };
    const ecke = (f) => { const q = L.feldRechteck(f, 'w'); return px(q.x + q.s - 8, q.y + 8); };
    const farben = new Set();
    for (let y = 5; y < c.height; y += 37) for (let x = 5; x < c.width; x += 37) farben.add(px(x, y).slice(0, 3).join());
    const cs = getComputedStyle(document.documentElement);
    return {
      w: c.width, h: c.height, farben: farben.size, grund: px(8, 8), karte: px(62, 700),
      d3: mitte('d3'), e3: mitte('e3'), h5: mitte('h5'), f7: ecke('f7'),
      feldHell: cs.getPropertyValue('--feld-hell').trim(), feldDunkel: cs.getPropertyValue('--feld-dunkel').trim(), zuletzt: cs.getPropertyValue('--zuletzt').trim(),
    };
  });
}
const nah = (a, b, tol = 2) => Array.isArray(a) && Array.isArray(b) && b.every((v, i) => Math.abs(a[i] - v) <= tol);
const mische = (unten, rgba) => {
  const m = /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+))?\s*\)/.exec(rgba);
  if (!m) return null;
  const a = m[4] == null ? 1 : Number(m[4]);
  return [1, 2, 3].map((i, n) => Math.round(Number(m[i]) * a + unten[n] * (1 - a)));
};

async function schaefermatt(seite) {
  await seite.evaluate((zuege) => {
    localStorage.removeItem('schach-arena:v1:laufend');
    const plan = { e2e4: 'e7e5', f1c4: 'b8c6', d1h5: 'g8f6' };
    window.__test = { botZug: () => {
      const v = window.__partie.chess().history({ verbose: true });
      return plan[v[v.length - 1].lan] || null;
    } };
    window.__zuege = zuege;
  }, SCHAEFER);
  await seite.evaluate(() => window.__app.gehe('partie', { botId: 'benno', farbe: 'w' }));
  await seite.waitForFunction(() => window.__partie && window.__partie.bereit === true, null, { timeout: 30000 });
  for (const zug of ['e2e4', 'f1c4', 'd1h5', 'h5f7']) {
    await seite.waitForFunction(() => window.__partie && window.__partie.phase() === 'flo', null, { timeout: 30000 });
    for (const feld of [zug.slice(0, 2), zug.slice(2, 4)]) {
      const b = await seite.locator(`.screen.partie .brett-felder .feld[data-feld="${feld}"]`).boundingBox();
      await seite.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
      await warte(90);
    }
  }
  await seite.evaluate(() => { window.__test = {}; });
}

const blattBereit = (seite, modus) => seite.waitForFunction((m) => {
  const b = document.querySelector('.tl-blatt:not(.weg)');
  return b && b.dataset.bereit === 'ja' && (!m || b.dataset.modus === m);
}, modus || null, { timeout: 20000 });
const zustand = (seite) => seite.evaluate(async () => (await import('/js/pakete/teilen/index.js')).zustand());

async function browserTeil(browser) {
  mkdirSync(BILDER, { recursive: true });
  const { kontext, seite, fehler } = await neueSeite(browser);
  await seite.goto(BASIS + '#arena');
  await seite.waitForFunction(() => !!window.__app, null, { timeout: 20000 });
  await seite.waitForSelector('.screen.arena');

  gruppe = 'Laden';
  const geladen = await seite.evaluate(async () => {
    const o = await import('/js/orte.js');
    const i = await import('/js/ui/icons.js');
    return { analyse: o.angeboten('analyse:oben'), icon: i.iconNamen().includes('teilen'), css: !!document.querySelector('link[data-paket="teilen"]') };
  });
  pruefe('Paket ueber ?erw geladen: Icon, eigenes CSS, Anbieter an analyse:oben', geladen.icon && geladen.css && geladen.analyse === 1, JSON.stringify(geladen));

  // ---------- echter Sieg: Knopf im Ergebnis ----------
  gruppe = 'Ergebnis';
  await schaefermatt(seite);
  await seite.waitForSelector('.ergebnis-overlay .erg-karte-ort .tl-teilen', { timeout: 40000 });
  const knopf = await seite.evaluate(() => {
    const o = document.querySelector('.erg-karte-ort');
    const k = o.querySelector('.tl-teilen');
    return { sichtbar: !o.hidden && k.getBoundingClientRect().width > 0, text: k.textContent.trim(), zeile: !!o.querySelector(':scope > .tl-knopf-zeile[data-ort="ergebnis"]'), icon: !!k.querySelector('svg.ico path') };
  });
  pruefe('Knopf "Siegesbild teilen" im Ort ergebnis:karte (mit Icon)', knopf.sichtbar && knopf.text === 'Siegesbild teilen' && knopf.zeile && knopf.icon, JSON.stringify(knopf));
  await seite.waitForSelector('.ergebnis-overlay.gefuellt:not(.vorlaeufig)', { timeout: 60000 });
  const partie = await seite.evaluate(() => JSON.parse(localStorage.getItem('schach-arena:v1:partien'))[0]);
  pruefe('Partie gespeichert mit Genauigkeit (die das Bild zeigt)', partie && partie.ergebnis === 'sieg' && Number.isFinite(partie.genauigkeit), JSON.stringify(partie).slice(0, 160));
  const appModus = await seite.evaluate(() => document.documentElement.dataset.modus || '');

  // ---------- Blatt, Leinwand, Hell ----------
  gruppe = 'Bild hell';
  await seite.locator('.erg-karte-ort .tl-teilen').click();
  await blattBereit(seite, 'hell');
  const z1 = await zustand(seite);
  const p1 = await leinwand(seite);
  pruefe('Leinwand 1080 x 1350', p1 && p1.w === 1080 && p1.h === 1350, JSON.stringify(p1 && [p1.w, p1.h]));
  pruefe('nicht leer (viele Farben im Raster)', p1 && p1.farben > 25, p1 && p1.farben);
  pruefe('Grund Papier #F4F1EC, Karte #FFFFFF (Tokens hell)', nah(p1.grund, [244, 241, 236, 255]) && nah(p1.karte, [255, 255, 255, 255]), JSON.stringify([p1.grund, p1.karte]));
  const fh = hexRgb(p1.feldHell);
  const fd = hexRgb(p1.feldDunkel);
  pruefe('leeres helles Feld d3 = --feld-hell, leeres dunkles Feld e3 = --feld-dunkel', nah(p1.d3, [...fh, 255]) && nah(p1.e3, [...fd, 255]), JSON.stringify({ d3: p1.d3, e3: p1.e3, fh, fd }));
  const h5Soll = mische(fh, p1.zuletzt);
  const f7Soll = mische(fd, p1.zuletzt);
  pruefe('letzter Zug: h5 (leer) und f7 (Ecke neben der Dame) mit --zuletzt getoent', nah(p1.h5, [...h5Soll, 255], 3) && nah(p1.f7, [...f7Soll, 255], 3), JSON.stringify({ h5: p1.h5, h5Soll, f7: p1.f7, f7Soll }));
  pruefe('Texte im Bild: Sieg, "gegen Bauer Benno", Schachmatt im 4. Zug, Genauigkeit, Datum, crownmate, Adresse', z1.texte.includes('Sieg') && z1.texte.includes('gegen Bauer Benno')
    && z1.texte.includes('SCHACHMATT IM 4. ZUG') && z1.texte.some((t) => /^\d{1,3},\d %$/.test(t)) && z1.texte.some((t) => /^\d\d\.\d\d\.\d{4}$/.test(t))
    && z1.texte.includes('crownmate') && z1.texte.includes(`127.0.0.1:${PORT}`), z1.texte.join(' | '));
  pruefe('Figuren als Bilder gezeichnet (keine Ersatz-Buchstaben)', !z1.texte.includes('D') && !z1.texte.includes('T'), z1.texte.join(' | '));
  const blatt = await seite.evaluate(() => {
    const b = document.querySelector('.tl-blatt');
    const los = b.querySelector('[data-tl="los"]');
    const c = b.querySelector('canvas').getBoundingClientRect();
    const k = b.querySelector('.tl-karte').getBoundingClientRect();
    return { titel: b.querySelector('h3').textContent, los: los.textContent.trim(), aktiv: !los.disabled, label: b.querySelector('canvas').getAttribute('aria-label'),
      verhaeltnis: c.width / c.height, imFenster: k.top >= 0 && k.bottom <= innerHeight + 1, name: !b.querySelector('.tl-name').hidden, share: typeof navigator.share };
  });
  pruefe('Blatt: Titel, Vorschau 4:5, ganz im Fenster, Bildbeschreibung fuer VoiceOver', blatt.titel === 'Siegesbild teilen' && Math.abs(blatt.verhaeltnis - 0.8) < 0.01 && blatt.imFenster
    && /Sieg gegen Bauer Benno/.test(blatt.label || ''), JSON.stringify(blatt));
  pruefe('ohne navigator.share: Knopf "Bild speichern", ohne Konto kein Namensschalter', blatt.share === 'undefined' && /Bild speichern/.test(blatt.los) && blatt.aktiv && !blatt.name, JSON.stringify(blatt));
  await seite.screenshot({ path: path.join(BILDER, 'blatt-ipad-hell.png') });

  // ---------- Speichern (Rueckfall ohne share) ----------
  gruppe = 'Speichern';
  const [download] = await Promise.all([seite.waitForEvent('download', { timeout: 10000 }), seite.locator('.tl-blatt [data-tl="los"]').click()]);
  const ziel = path.join(BILDER, 'siegesbild-hell.png');
  await download.saveAs(ziel);
  const png = readFileSync(ziel);
  pruefe('Download als PNG, Name crownmate-sieg-<Tag>.png, 1080 x 1350', /^crownmate-sieg-\d{4}-\d{2}-\d{2}\.png$/.test(download.suggestedFilename())
    && png.slice(1, 4).toString() === 'PNG' && png.readUInt32BE(16) === 1080 && png.readUInt32BE(20) === 1350, download.suggestedFilename());
  await seite.waitForFunction(() => !document.querySelector('.tl-blatt'), null, { timeout: 5000 });
  const nachSpeichern = await seite.evaluate(() => ({
    toast: (document.querySelector('.toast') || {}).textContent || '', modul: JSON.parse(localStorage.getItem('schach-arena:v1:modul:teilen') || 'null'),
  }));
  pruefe('Blatt zu, Meldung "Bild gespeichert.", im Modul gemerkt (Rechenstand, Weg datei)', /Bild gespeichert\./.test(nachSpeichern.toast) && nachSpeichern.modul && nachSpeichern.modul.v === 1
    && nachSpeichern.modul.geteilt.length === 1 && nachSpeichern.modul.geteilt[0].id === partie.id && nachSpeichern.modul.geteilt[0].weg === 'datei', JSON.stringify(nachSpeichern));

  // ---------- Teilen mit Datei (navigator.share), Dunkel ----------
  gruppe = 'Teilen dunkel';
  await seite.evaluate(() => {
    window.__geteilt = [];
    window.__teilenAntwort = 'ok';
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: (d) => !!(d && Array.isArray(d.files) && d.files.length && d.files.every((f) => f instanceof File)) });
    Object.defineProperty(navigator, 'share', { configurable: true, value: async (d) => {
      if (window.__teilenAntwort === 'abbruch') throw new DOMException('abgebrochen', 'AbortError');
      const f = d.files[0];
      const daten = await new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(f); });
      window.__geteilt.push({ title: d.title, text: d.text, anzahl: d.files.length, name: f.name, type: f.type, size: f.size, daten });
    } });
  });
  await seite.locator('.erg-karte-ort .tl-teilen').click();
  await blattBereit(seite, 'hell');
  pruefe('mit navigator.share: Knopf "Teilen"', /^Teilen$/.test((await seite.locator('.tl-blatt [data-tl="los"]').innerText()).trim()));
  await seite.locator('.tl-blatt .segment .seg[data-wert="dunkel"]').click();
  await blattBereit(seite, 'dunkel');
  const p2 = await leinwand(seite);
  pruefe('Grund Schiefer #15171B, Karte #1E2126 (Tokens dunkel)', nah(p2.grund, [21, 23, 27, 255]) && nah(p2.karte, [30, 33, 38, 255]), JSON.stringify([p2.grund, p2.karte]));
  pruefe('Feldfarben bleiben (Flos Brettfarbe, nicht der Modus)', nah(p2.d3, [...fh, 255]) && nah(p2.e3, [...fd, 255]), JSON.stringify([p2.d3, p2.e3]));
  const app2 = await seite.evaluate(() => ({ modus: document.documentElement.dataset.modus || '', grund: getComputedStyle(document.body).backgroundColor }));
  pruefe('die App selbst bleibt im eigenen Modus (kein Umschalten fuer das Bild)', app2.modus === appModus && app2.grund === 'rgb(244, 241, 236)', JSON.stringify(app2));
  await seite.screenshot({ path: path.join(BILDER, 'blatt-ipad-dunkel.png') });
  // Abbrechen im Teilen-Blatt des Geraets: unser Blatt bleibt offen, keine Fehlermeldung
  await seite.evaluate(() => { window.__teilenAntwort = 'abbruch'; });
  await seite.locator('.tl-blatt [data-tl="los"]').click();
  await warte(400);
  const abbruch = await seite.evaluate(() => ({ offen: !!document.querySelector('.tl-blatt:not(.weg)'), fehler: !!document.querySelector('.toast[data-art="fehler"], .toast.fehler'), geteilt: window.__geteilt.length }));
  pruefe('Abbruch im Teilen-Blatt: Blatt bleibt offen, keine Fehlermeldung', abbruch.offen && !abbruch.fehler && abbruch.geteilt === 0, JSON.stringify(abbruch));
  await seite.evaluate(() => { window.__teilenAntwort = 'ok'; });
  await seite.locator('.tl-blatt [data-tl="los"]').click();
  await seite.waitForFunction(() => window.__geteilt.length === 1, null, { timeout: 5000 });
  const geteilt = await seite.evaluate(() => window.__geteilt[0]);
  writeFileSync(path.join(BILDER, 'siegesbild-dunkel.png'), Buffer.from(geteilt.daten.split(',')[1], 'base64'));
  pruefe('navigator.share mit genau einer PNG-Datei (crownmate-sieg-<Tag>.png), Titel und Text ohne persoenliche Daten', geteilt.anzahl === 1 && geteilt.type === 'image/png'
    && /^crownmate-sieg-\d{4}-\d{2}-\d{2}\.png$/.test(geteilt.name) && geteilt.size > 20000 && geteilt.title === 'Crownmate' && geteilt.text === 'Sieg gegen Bauer Benno',
  JSON.stringify({ ...geteilt, daten: undefined }));
  await seite.waitForFunction(() => !document.querySelector('.tl-blatt'), null, { timeout: 5000 });
  const nachTeilen = await seite.evaluate(() => ({
    modul: JSON.parse(localStorage.getItem('schach-arena:v1:modul:teilen') || 'null'), einst: JSON.parse(localStorage.getItem('schach-arena:v1:einstellungen:teilen') || 'null'),
  }));
  pruefe('gemerkt (eine Zeile je Partie, Weg teilen), Wahl Dunkel bleibt fuers naechste Bild', nachTeilen.modul.geteilt.length === 1 && nachTeilen.modul.geteilt[0].weg === 'teilen'
    && nachTeilen.einst && nachTeilen.einst.bild === 'dunkel' && nachTeilen.einst.name === false, JSON.stringify(nachTeilen));

  // ---------- Benutzername: nur mit Konto, nur mit Schalter, nie die E-Mail ----------
  gruppe = 'Benutzername';
  await seite.evaluate(async () => {
    const k = await import('/js/konto.js');
    window.__kontoAnfragen = [];
    k.setzeKontoFetch(async (url, opt) => {
      window.__kontoAnfragen.push(String(url).replace(/^https?:\/\/[^/]+/, '') + ' ' + ((opt && opt.method) || 'GET'));
      const daten = /\/rest\/v1\/profile/.test(url) ? [{ user_id: 'u1', benutzername: 'FloTest', email: 'flo.privat@example.org' }] : [];
      return { ok: true, status: 200, json: async () => daten };
    });
    localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify({ access_token: 'a.b.c', refresh_token: 'r', expires_at: 9999999999, user: { id: 'u1' }, email: 'flo.privat@example.org' }));
  });
  await seite.locator('.erg-karte-ort .tl-teilen').click();
  await seite.waitForSelector('.tl-blatt .tl-name:not([hidden])', { timeout: 6000 });
  await blattBereit(seite, 'dunkel');
  const n1 = await zustand(seite);
  const nameZeile = await seite.locator('.tl-blatt .tl-name').innerText();
  pruefe('mit Konto und Benutzernamen: Schalter "Benutzername zeigen" (aus), der Name steht daneben', /Benutzername zeigen/.test(nameZeile) && /FloTest/.test(nameZeile)
    && await seite.locator('.tl-blatt .tl-name .schalter').getAttribute('aria-checked') === 'false', nameZeile);
  pruefe('Schalter aus: kein Name im Bild, keine E-Mail', !n1.texte.some((t) => /FloTest|@|privat/.test(t)) && n1.name === null, n1.texte.join(' | '));
  await seite.locator('.tl-blatt .tl-name .schalter').click();
  await seite.waitForFunction(async () => (await import('/js/pakete/teilen/index.js')).zustand().name === 'FloTest', null, { timeout: 10000 });
  await blattBereit(seite, 'dunkel');
  const n2 = await zustand(seite);
  pruefe('Schalter an: "Gespielt von FloTest" im Bild, nie die E-Mail', n2.texte.includes('Gespielt von FloTest') && !n2.texte.some((t) => /@|privat/.test(t)), n2.texte.join(' | '));
  await seite.screenshot({ path: path.join(BILDER, 'blatt-ipad-name.png') });
  await seite.locator('.tl-blatt .tl-name .schalter').click();
  await seite.waitForFunction(async () => (await import('/js/pakete/teilen/index.js')).zustand().name === null, null, { timeout: 10000 });
  const anfragen = await seite.evaluate(() => window.__kontoAnfragen.filter((a) => /profile/.test(a)));
  pruefe('Profil nur gelesen (GET), einmal je Sitzung', anfragen.length === 1 && / GET$/.test(anfragen[0]), JSON.stringify(anfragen));
  await seite.keyboard.press('Escape');
  await seite.waitForFunction(() => !document.querySelector('.tl-blatt'), null, { timeout: 5000 });
  pruefe('Escape schliesst das Blatt', true);
  await seite.evaluate(async () => {
    localStorage.removeItem('schach-arena:konto:sitzung');
    (await import('/js/konto.js')).setzeKontoFetch(null);
  });

  // ---------- Analyse (der Verlauf oeffnet jede Partie dort) ----------
  gruppe = 'Analyse und Verlauf';
  await seite.evaluate(() => window.__app.gehe('verlauf'));
  await seite.waitForSelector('.screen .vl-zeile, .screen [data-id]', { timeout: 10000 }).catch(() => {});
  await seite.evaluate((id) => window.__app.gehe('analyse', { partieId: id }), partie.id);
  await seite.waitForSelector('.an-ort-oben .tl-teilen', { timeout: 30000 });
  pruefe('Spielanalyse der Partie (aus dem Verlauf): Knopf "Als Bild teilen" im Ort analyse:oben', /Als Bild teilen/.test(await seite.locator('.an-ort-oben .tl-teilen').innerText())
    && await seite.locator('.an-ort-oben').isVisible());
  await seite.locator('.an-ort-oben .tl-teilen').click();
  await blattBereit(seite, 'dunkel');
  const p3 = await leinwand(seite);
  pruefe('Analyse: dasselbe Bild (1080 x 1350, Feldfarben aus den Tokens)', p3.w === 1080 && p3.h === 1350 && nah(p3.d3, [...fh, 255]) && nah(p3.e3, [...fd, 255]));
  await seite.locator('.tl-blatt [data-tl="abbrechen"]').click();
  await seite.waitForFunction(() => !document.querySelector('.tl-blatt'), null, { timeout: 5000 });
  // Niederlage und Uebung: kein Knopf (Analyse und Ergebnis)
  const ohne = await seite.evaluate(async (p) => {
    const liste = JSON.parse(localStorage.getItem('schach-arena:v1:partien'));
    liste.push({ ...p, id: p.id + 'n', ergebnis: 'niederlage', grund: 'aufgabe', datum: new Date(Date.parse(p.datum) - 60000).toISOString() });
    liste.push({ ...p, id: p.id + 'u', modus: 'uebung', ziel: { partieId: p.id, ply: 2, besterZug: 'd1h5', alterZug: 'd1h5', alterSanDe: 'Dh5', gewinnVorher: 0.6 }, datum: new Date(Date.parse(p.datum) - 120000).toISOString() });
    localStorage.setItem('schach-arena:v1:partien', JSON.stringify(liste));
    const o = await import('/js/orte.js');
    const zaehle = (partie, ergebnis) => {
      const c = document.createElement('div');
      const f = o.fuelle('ergebnis:karte', c, { app: window.__app, bot: null, farbe: 'w', ergebnis, grund: partie.grund, erg: { partie }, review: null, rechnet: false, nachtrag: false, wertet: true, modus: partie.modus, ziel: null, boss: null });
      const n = c.querySelectorAll('.tl-teilen').length;
      f.verlasse();
      return n;
    };
    return {
      niederlage: zaehle({ ...p, ergebnis: 'niederlage' }, 'niederlage'),
      uebung: zaehle({ ...p, modus: 'uebung' }, 'sieg'),
      remis: zaehle({ ...p, ergebnis: 'remis', grund: 'patt' }, 'remis'),
    };
  }, partie);
  pruefe('Ergebnis: kein Knopf nach Niederlage oder Übung, Knopf nach Remis', ohne.niederlage === 0 && ohne.uebung === 0 && ohne.remis === 1, JSON.stringify(ohne));
  for (const [nr, was] of [['n', 'Niederlage'], ['u', 'Übung']]) {
    await seite.evaluate((id) => window.__app.gehe('analyse', { partieId: id }), partie.id + nr);
    await seite.waitForFunction((id) => location.hash.includes('analyse') && document.querySelector('.screen.analyse, .an-koerper'), partie.id + nr, { timeout: 15000 });
    await warte(800);
    pruefe(`Analyse einer ${was}: kein Teilen-Knopf`, await seite.locator('.an-ort-oben .tl-teilen').count() === 0);
  }
  await seite.evaluate(() => window.__app.gehe('arena'));
  pruefe('keine Konsolenfehler (iPad)', fehler.length === 0, fehler.join(' | '));
  await kontext.close();

  // ---------- Handy, hell und dunkel, ohne Bewegung ----------
  gruppe = 'Handy';
  for (const modus of ['hell', 'dunkel']) {
    const h = await neueSeite(browser, { w: 390, h: 844, handy: true, reduziert: modus === 'dunkel' });
    await h.seite.goto(BASIS + '#arena');
    await h.seite.waitForFunction(() => !!window.__app, null, { timeout: 20000 });
    await h.seite.waitForSelector('.screen.arena');
    await h.seite.evaluate(async ({ p, modus }) => {
      localStorage.setItem('schach-arena:v1:einstellungen:teilen', JSON.stringify({ bild: modus, name: false }));
      const m = await import('/js/pakete/teilen/index.js');
      m.oeffneBlatt({ partie: { ...p, botId: 'koenig' } });
    }, { p: partie, modus });
    await blattBereit(h.seite, modus);
    const lage = await h.seite.evaluate(() => {
      const k = document.querySelector('.tl-karte').getBoundingClientRect();
      const c = document.querySelector('.tl-blatt canvas').getBoundingClientRect();
      const los = document.querySelector('[data-tl="los"]').getBoundingClientRect();
      return { links: k.left, rechts: innerWidth - k.right, unten: innerHeight - k.bottom, oben: k.top, cw: c.width, ueber: document.documentElement.scrollWidth - innerWidth, los: los.bottom <= innerHeight, losH: los.height };
    });
    pruefe(`${modus}: Blatt passt (Rand, kein Quer-Scrollen, Knoepfe sichtbar und gross genug)`, lage.links >= 8 && lage.rechts >= 8 && lage.oben >= 0 && lage.ueber <= 0 && lage.los
      && lage.losH >= 44 && lage.cw >= 240, JSON.stringify(lage));
    const z = await zustand(h.seite);
    pruefe(`${modus}: Kommissar König im Bild`, z.texte.includes('gegen Kommissar König'), z.texte.join(' | '));
    await h.seite.screenshot({ path: path.join(BILDER, `blatt-handy-${modus}.png`) });
    pruefe(`${modus}: keine Konsolenfehler`, h.fehler.length === 0, h.fehler.join(' | '));
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
    return { analyse: o.angeboten('analyse:oben'), css: !!document.querySelector('link[data-paket="teilen"]') };
  });
  pruefe('ohne ?test aus PAKETE geladen (Anbieter und CSS da)', prod.analyse === 1 && prod.css, JSON.stringify(prod));
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
