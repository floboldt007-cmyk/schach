// Fairness-Regeln als Test (BAUPLAN Runde 4, Abschnitt 7). Node, ohne Browser:
//   node tests/fairness.test.mjs
// Jedes Paket haelt diesen Test gruen. Eine Aenderung an GRENZEN oder an den Brillant-Bedingungen
// bricht ihn bewusst (Regel 5: keine Bewertungs-Inflation).
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Chess } from '../vendor/chess/chess.js';
import { GRENZEN, klassifiziere, START_FEN } from '../js/review.js';
import { BUDGET, BRETT_FEIER } from '../js/feier.js';
import { wertet, sterneFuerPartie, MODI } from '../js/storage.js';
import { pruefeInhalt, pruefeSpielplan, texteVon, COUNTDOWN_RE } from '../js/inhalte.js';
import { registriereBot, botNachId } from '../js/bots.js';
import { ZUGKLASSEN } from '../js/zugklassen.js';
import { DE as EMOTE_DE, EN as EMOTE_EN } from '../js/pakete/emotes/texte.js';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let ok = 0;
let fehler = 0;
function pruefe(name, bedingung, info) {
  if (bedingung) { ok++; console.log('OK     ' + name); } else { fehler++; console.log('FEHLER ' + name + (info !== undefined ? '  -> ' + JSON.stringify(info) : '')); }
}

const CHESS_COM_NAMEN = new Set(['Brillant', 'Großartig', 'Bester Zug', 'Exzellent', 'Gut', 'Buch', 'Ungenauigkeit', 'Fehler', 'Verpasst', 'Patzer']);
const VERBOTENE_KLASSENNAMEN = new Set(['Treffer', 'Klasse', 'Serie', 'Funken']);
pruefe('Zugklassen: 11 verschiedene Klartext-Namen', ZUGKLASSEN.length === 11 && new Set(ZUGKLASSEN.map((k) => k.name)).size === 11);
pruefe('Zugklassen: keine Namen der Vergleichs-App oder Verbotsliste', ZUGKLASSEN.every((k) => !CHESS_COM_NAMEN.has(k.name) && !VERBOTENE_KLASSENNAMEN.has(k.name)));
const emoteTexte = [...Object.values(EMOTE_DE), ...Object.values(EMOTE_EN)].join(' ');
pruefe('Emotes: vorgefertigte Texte sind freundlich und ohne Druck, Kauf oder Schuldgefuehl',
  !/kauf|buy|nur heute|only today|musst|must|schuld|guilt|verlierer|loser/i.test(emoteTexte));

// ---------------------------------------------------------------------------
// Quelltext zerlegen: Zeichenketten (auch Template-Texte) und Code ohne Kommentare.
// Regex-Literale werden uebersprungen (Heuristik: "/" nach einem Operator oder am Anfang).
// ---------------------------------------------------------------------------
export function zerlege(quelle) {
  const texte = [];
  let code = '';
  let i = 0;
  const n = quelle.length;
  let letztes = '';   // letztes Zeichen ausserhalb von Leerraum/Kommentar (fuer die Regex-Heuristik)
  const regexDavor = (c) => c === '' || '(,=:[!&|?{};+-*%<>~^'.includes(c);
  while (i < n) {
    const c = quelle[i];
    const d = quelle[i + 1];
    if (c === '/' && d === '/') { while (i < n && quelle[i] !== '\n') i++; continue; }
    if (c === '/' && d === '*') { const e = quelle.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; continue; }
    if (c === '\'' || c === '"') {
      let t = '';
      i++;
      while (i < n && quelle[i] !== c) { if (quelle[i] === '\\') { t += quelle[i + 1]; i += 2; } else t += quelle[i++]; }
      i++;
      texte.push(t);
      code += '""';
      letztes = '"';
      continue;
    }
    if (c === '`') {
      // Template: Textteile sammeln, ${...} als Code weiter zerlegen (verschachtelt)
      let t = '';
      i++;
      while (i < n && quelle[i] !== '`') {
        if (quelle[i] === '\\') { t += quelle[i + 1]; i += 2; continue; }
        if (quelle[i] === '$' && quelle[i + 1] === '{') {
          let tiefe = 1;
          let j = i + 2;
          while (j < n && tiefe > 0) {
            if (quelle[j] === '{') tiefe++;
            else if (quelle[j] === '}') tiefe--;
            else if (quelle[j] === '`' || quelle[j] === '\'' || quelle[j] === '"') {
              // innere Zeichenkette ueberspringen (grob, reicht fuer diesen Code)
              const q = quelle[j];
              j++;
              while (j < n && quelle[j] !== q) { if (quelle[j] === '\\') j++; j++; }
            }
            j++;
          }
          const innen = zerlege(quelle.slice(i + 2, j - 1));
          texte.push(...innen.texte);
          code += innen.code;
          t += ' ';
          i = j;
          continue;
        }
        t += quelle[i++];
      }
      i++;
      texte.push(t);
      code += '""';
      letztes = '"';
      continue;
    }
    if (c === '/' && regexDavor(letztes)) {
      // Regex-Literal ueberspringen
      i++;
      let klasse = false;
      while (i < n && (quelle[i] !== '/' || klasse)) {
        if (quelle[i] === '\\') i++;
        else if (quelle[i] === '[') klasse = true;
        else if (quelle[i] === ']') klasse = false;
        else if (quelle[i] === '\n') break;
        i++;
      }
      i++;
      while (i < n && /[a-z]/i.test(quelle[i])) i++;
      code += '/re/';
      letztes = '/';
      continue;
    }
    code += c;
    if (!/\s/.test(c)) letztes = c;
    i++;
  }
  return { texte, code };
}

function jsDateien(ordner) {
  const voll = path.join(WURZEL, ordner);
  if (!existsSync(voll)) return [];
  const aus = [];
  for (const name of readdirSync(voll)) {
    const p = path.join(voll, name);
    if (statSync(p).isDirectory()) aus.push(...jsDateien(path.join(ordner, name)));
    else if (name.endsWith('.js')) aus.push(path.join(ordner, name));
  }
  return aus;
}

// ---------- Selbsttest des Zerlegers ----------
{
  const probe = [
    "// Wir vermissen dich (Kommentar zaehlt nicht)",
    "/* letzte Chance im Block-Kommentar */",
    "const a = 'Serie verloren';",
    'const b = "x" + `Hallo ${name ? \'nur noch\' : "z"} Welt`;',
    "const r = /[\"']nur noch/g; const c = 'ok'; // Math.random()",
    'const z = Math.random();',
  ].join('\n');
  const { texte, code } = zerlege(probe);
  pruefe('Zerleger: Zeichenketten gefunden, Kommentare ignoriert', texte.includes('Serie verloren') && texte.includes('nur noch')
    && !texte.some((t) => /vermissen|letzte Chance/.test(t)) && texte.includes('ok'), texte);
  pruefe('Zerleger: Template-Text und eingebettete Ausdruecke', texte.some((t) => /Hallo .* Welt/.test(t)));
  pruefe('Zerleger: Code ohne Kommentare, Regex uebersprungen', /Math\.random\(\)/.test(code) && (code.match(/Math\.random/g) || []).length === 1 && !/nur noch/.test(code), code);
}

// ---------- Regel 5: keine Bewertungs-Inflation ----------
pruefe('GRENZEN unveraendert (0,02 / 0,05 / 0,10 / 0,20)', JSON.stringify(GRENZEN) === '{"exzellent":0.02,"gut":0.05,"ungenau":0.1,"fehler":0.2}', GRENZEN);
{
  const review = readFileSync(path.join(WURZEL, 'js/review.js'), 'utf8');
  const zeilen = [
    // bester oder fast bester Zug (Verlust hoechstens GRENZEN.exzellent)
    'const fastBester = d.istBester || roh <= GRENZEN.exzellent + EPS;',
    // nachher mindestens 0,5
    'if (fastBester && d.fenVorher && d.uci && d.wn >= 0.5 - EPS) {',
    // vorher unter 0,95 (bei Engine-Zug: die beste Alternative)
    'const ref = d.istBester && d.w2 != null ? Math.min(d.wv, d.w2) : d.wv;',
    'if (ref < 0.95) {',
    // Opfer nur Figur, nicht Bauer, und mindestens 2 Bauerneinheiten
    "if (antwort && antwort.captured && antwort.captured !== 'p') {",
    'if (minimum >= 2 && minimum > schonVerloren && !totNachSchlag(c, pvNachher[0])) {',
    "if (!m.captured || m.captured === 'p' || m.captured === 'k') continue;",
    'if (h && wert >= 2 && wert > schonVerloren && !totNachSchlag(c, h.san)) return { art: \'haengt\', figur: h.figur, feld: h.feld, wert };',
    // stark: zweitbester mindestens 0,10 schlechter
    'if (d.istBester && d.w2 != null && d.wv > 0.03 && d.wv < 0.97 && d.wv - d.w2 >= 0.10 - EPS) {',
  ];
  const fehlt = zeilen.filter((z) => !review.includes(z));
  pruefe('Brillant-Bedingungen in klassifiziere() unveraendert (Schnappschuss)', fehlt.length === 0, fehlt);

  // "bester" fuer einen anderen Zug als den Engine-Zug (gleichGut). Bewusst nachgezogen in w0c, nur STRENGER:
  // bei eigenem Matt muss der Zug "Matt in n" verkuerzen oder selbst mattsetzen (vorher reichte "bleibt Matt in n",
  // also ein Zug langsamer; Tiefe-20-Nachpruefung an 62 echten Stellungen: 50 davon wirklich langsamer).
  // Bewertung in Bauerneinheiten: nachher mindestens so gut wie vorher (unveraendert).
  const bester = [
    'if (d.istBester) return ergebnis(\'bester\', 0, \'Engine-Zug\');',
    'if (roh <= EPS) {',
    "if (!gleichGut(d)) return ergebnis('exzellent', 0, 'fast so gut wie der Engine-Zug');",
    'if (mv != null) return mv > 0 ? (d.matt || mn < mv) : -mn >= -mv;',
    'return v == null || n == null || n >= v;',
  ];
  const fehltB = bester.filter((z) => !review.includes(z));
  pruefe('Regel fuer "bester" ohne Engine-Zug (gleichGut) unveraendert (Schnappschuss, w0c strenger)', fehltB.length === 0, fehltB);
  const MITTE = 'r1bq1rk1/pp2bppp/2n1pn2/2pp4/3P4/2PBPN2/PP1N1PPP/R1BQ1RK1 w - - 0 8';
  const anders = (vorher, nachher) => klassifiziere({ fenVorher: MITTE, uci: 'h2h3', besterZug: 'd4c5', pvVorher: ['d4c5'], pvNachher: [],
    evalVorher: vorher, evalNachher: nachher }).klasse;
  pruefe('"bester" ohne Engine-Zug: nicht bei schlechterer Bewertung und nicht, wenn das eigene Matt einen Zug laenger dauert',
    anders({ cp: 40, mate: null }, { cp: 39, mate: null }) !== 'bester' && anders({ cp: null, mate: 3 }, { cp: null, mate: 3 }) !== 'bester'
    && anders({ cp: 40, mate: null }, { cp: 40, mate: null }) === 'bester' && anders({ cp: null, mate: 3 }, { cp: null, mate: 2 }) === 'bester');

  // dasselbe am Verhalten: das ersticke Matt Dg8+!! und seine Grenzfaelle
  const ERSTICKT = '5r1k/pp4pp/7N/3Q4/8/8/5PPP/6K1 w - - 0 1';
  const basis = {
    fenVorher: ERSTICKT, uci: 'd5g8', besterZug: 'd5g8', evalVorher: { cp: null, mate: 2 }, evalNachher: { cp: null, mate: 1 },
    evalZweiter: { cp: 300, mate: null }, pvVorher: ['d5g8', 'f8g8', 'h6f7'], pvNachher: ['f8g8', 'h6f7'],
  };
  pruefe('Brillant: Damenopfer mit Matt ist brillant', klassifiziere(basis).klasse === 'brillant', klassifiziere(basis).klasse);
  const fast = { ...basis, evalZweiter: { cp: 900, mate: null } };
  pruefe('Brillant: nicht, wenn die Stellung vorher schon klar gewonnen war (ab 0,95)', klassifiziere(fast).klasse !== 'brillant', klassifiziere(fast).klasse);
  const schlecht = { ...basis, evalNachher: { cp: -120, mate: null } };
  pruefe('Brillant: nicht, wenn die Stellung danach unter 0,5 liegt', klassifiziere(schlecht).klasse !== 'brillant', klassifiziere(schlecht).klasse);
  // Bauernopfer (Nordisches Gambit 3.c3): bester Zug, aber nie brillant
  const c = new Chess(START_FEN);
  for (const z of ['e4', 'e5', 'd4', 'exd4']) c.move(z);
  const bauer = { fenVorher: c.fen(), uci: 'c2c3', besterZug: 'c2c3', evalVorher: { cp: 30, mate: null }, evalNachher: { cp: 30, mate: null },
    evalZweiter: { cp: 20, mate: null }, pvVorher: ['c2c3', 'd4c3', 'b1c3'], pvNachher: ['d4c3', 'b1c3', 'f8b4'] };
  pruefe('Brillant: ein Bauernopfer reicht nie', klassifiziere(bauer).klasse !== 'brillant', klassifiziere(bauer).klasse);
}

// ---------- Regel 7: Uebungen zaehlen nie ----------
{
  const sieg = { ergebnis: 'sieg', genauigkeit: 95, hinweise: 0, zuruecknahmen: 0, zuege: Array(30).fill('e2e4'), spielerFarbe: 'w' };
  const STELLUNG = '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1';
  pruefe('Uebung und Partie aus einer eigenen Stellung werten nicht', !wertet({ ...sieg, modus: 'uebung', startFen: STELLUNG })
    && !wertet({ ...sieg, modus: 'uebung', startFen: START_FEN }) && !wertet({ ...sieg, modus: 'uebung' }) && !wertet({ ...sieg, startFen: STELLUNG })
    && wertet(sieg) && wertet({ ...sieg, startFen: START_FEN }));
  pruefe('Uebung bringt keinen Stern', JSON.stringify(sterneFuerPartie({ ...sieg, modus: 'uebung', startFen: STELLUNG })) === '[false,false,false]'
    && JSON.stringify(sterneFuerPartie({ ...sieg, startFen: STELLUNG })) === '[false,false,false]'
    && JSON.stringify(sterneFuerPartie(sieg)) === '[true,true,true]');
}

// ---------- Regel 8: Feier-Budget ----------
pruefe('feier.BUDGET = { gross: 1, zeilen: 3, nachlese: 3 }', JSON.stringify(BUDGET) === '{"gross":1,"zeilen":3,"nachlese":3}', BUDGET);

// ---------- Regel 9 und 10: keine Druck- und Schuldgefuehl-Texte ----------
const VERBOTEN = ['Serie verloren', 'stirbt', 'letzte Chance', 'nur noch', 'verpasst du', 'verlierst deine', 'Wir vermissen dich', 'Nein, ich will',
  // W0+a: Zusaetze aus SPIELKONZEPT 5.3 (dazu aus dem Lektorat: die Serie zeigt nie "am Stück")
  'Serie in Gefahr', 'rette deine', 'wartet auf dich', 'hat dich überholt', 'Abstieg', 'endet in', 'läuft ab', 'verfällt', 'knapp verpasst',
  'nur heute', 'limitiert', 'Leben verloren', 'Game Over', 'Funken verfallen', 'Boost kaufen', 'am Stück',
  // Englische Version (js/sprachen/*.js): dieselben Regeln auf Englisch
  'last chance', 'streak in danger', 'streak at risk', 'save your streak', 'we miss you', 'only today', 'limited time',
  'you lose your', 'you will lose', 'overtook you', 'is waiting for you', 'lives lost', 'buy a boost', 'gone forever',
  // Limitierte Editionen (Entscheidung 29.10.): keine Knappheits- und Wert-Versprechen, "Keine Neuauflage" steht nur als
  // ruhiger Fakt da. Vergleich ohne Gross/Klein, echte Umlaute wie in den Texten.
  'kommt nie wieder', 'nie wieder erhältlich', 'letzte Gelegenheit', 'Wertsteigerung', 'Investition', 'Sammlerwert',
  'wird mehr wert',
  'never comes back', 'never coming back', 'never available again', 'last opportunity', 'increase in value',
  'value increase', 'investment', "collector's value", 'collector’s value', 'collector value', 'will be worth more'];
{
  const dateien = jsDateien('js');
  const treffer = [];
  for (const d of dateien) {
    const { texte } = zerlege(readFileSync(path.join(WURZEL, d), 'utf8'));
    for (const t of texte) {
      for (const w of VERBOTEN) if (t.toLowerCase().includes(w.toLowerCase())) treffer.push(`${d}: "${w}" in "${t.slice(0, 80)}"`);
    }
  }
  const pakete = dateien.filter((d) => d.startsWith(path.join('js', 'pakete')));
  pruefe(`Verbotsliste: kein Treffer in den Texten von ${dateien.length} Dateien unter js/ (davon ${pakete.length} in js/pakete/)`, treffer.length === 0, treffer);
  // Dieselbe Liste fuer die Texte der Server-Funktionen (Fehlertexte von Kasse, Coach usw. landen spaeter in der App)
  const server = jsDateien(path.join('supabase', 'functions'));
  const serverTreffer = [];
  for (const d of server) {
    for (const t of zerlege(readFileSync(path.join(WURZEL, d), 'utf8')).texte) {
      for (const w of VERBOTEN) if (t.toLowerCase().includes(w.toLowerCase())) serverTreffer.push(`${d}: "${w}" in "${t.slice(0, 80)}"`);
    }
  }
  pruefe(`Verbotsliste: kein Treffer in den Texten der Server-Funktionen (${server.length} Dateien unter supabase/functions/)`,
    server.length >= 3 && serverTreffer.length === 0, serverTreffer);
  // Inline-Skripte in index.html (Notfall-Waechter: Texte der Reparatur-Tafel, laufen ohne js/)
  const html = readFileSync(path.join(WURZEL, 'index.html'), 'utf8');
  const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const inlineTexte = inline.flatMap((s) => zerlege(s).texte);
  const inlineTreffer = [];
  for (const t of inlineTexte) for (const w of VERBOTEN) if (t.toLowerCase().includes(w.toLowerCase())) inlineTreffer.push(`index.html: "${w}" in "${t.slice(0, 80)}"`);
  pruefe(`Verbotsliste: kein Treffer in den Texten der ${inline.length} Inline-Skripte von index.html`,
    inline.length >= 2 && inlineTexte.some((t) => t.includes('Reparieren')) && inlineTreffer.length === 0, inlineTreffer);
  // Selbstprobe der neuen Muster (Editionen): Drucktexte werden erkannt, ruhige Fakten und harmlose Saetze nicht
  const trifft = (t) => VERBOTEN.some((w) => t.toLowerCase().includes(w.toLowerCase()));
  const druck = ['Diese Edition kommt nie wieder!', 'Danach nie wieder erhältlich', 'Letzte Gelegenheit', 'Mit Wertsteigerung',
    'Eine Investition in deine Sammlung', 'Hoher Sammlerwert', 'Das Stück wird mehr wert', 'This edition never comes back',
    'Never available again', 'Last opportunity to buy', 'Watch the increase in value', 'A smart investment',
    'Real collector’s value', "Real collector's value", 'It will be worth more'];
  const ruhig = ['Keine Neuauflage', 'Auflage höchstens 100', 'Verkauf bis 31.12.2026, 23:59 Uhr (deutsche Zeit)', 'No reprint',
    'It was worth more than any gambit.', 'That goes with my collector’s teacups.', 'I investigate every position.',
    'Der war mehr wert als jedes Gambit.', 'kommt nie mit leerem Netz zurück'];
  pruefe('Verbotsliste Editionen: faengt Druck- und Wert-Texte (deutsch und englisch), laesst ruhige Fakten durch',
    druck.every(trifft) && !ruhig.some(trifft), { durch: druck.filter((t) => !trifft(t)), falsch: ruhig.filter(trifft) });
}

// ---------- Regel 1: kein Zufall in Feier und Paket-Logik ----------
{
  // W0+a: dazu die reinen Logik-Dateien der neuen Pakete (SPIELKONZEPT 5.3) und tag.js, inhalte.js
  const REIN = ['serie.js', 'logik.js', 'kartei.js', 'alltag.js', 'profil.js', 'taktik.js',
    'funken.js', 'punkte.js', 'marsch.js', 'boss.js', 'raetsel.js', 'liga.js', 'code.js',
    // Paket funken: Rechnung, Level-Kurve und Speicher
    'rechnung.js', 'level.js', 'stand.js',
    // Paket punkte: Formel und Tafeln (code.js und stand.js stehen oben)
    'formel.js', 'tafel.js',
    // Paket serie: Tageslogik und Siegeslauf (stand.js steht oben)
    'tag.js', 'lauf.js'];
  const dateien = ['js/feier.js', 'js/tag.js', 'js/inhalte.js', ...jsDateien(path.join('js', 'pakete')).filter((d) => REIN.includes(path.basename(d)))];
  const treffer = dateien.filter((d) => /Math\s*\.\s*random|crypto\s*\.\s*getRandomValues/.test(zerlege(readFileSync(path.join(WURZEL, d), 'utf8')).code));
  pruefe(`Kein Math.random in feier.js und den reinen Paket-Logik-Dateien (${dateien.length} Dateien)`, treffer.length === 0, treffer);
}


// =====================================================================
// W0+a: Zusaetze aus SPIELKONZEPT 5.3, soweit das Fundament sie traegt
// =====================================================================
// alle JSON-Dateien unter daten/ (auch die Beispiele)
function jsonDateien(ordner) {
  const voll = path.join(WURZEL, ordner);
  if (!existsSync(voll)) return [];
  const aus = [];
  for (const name of readdirSync(voll)) {
    const p = path.join(voll, name);
    if (statSync(p).isDirectory()) aus.push(...jsonDateien(path.join(ordner, name)));
    else if (name.endsWith('.json')) aus.push(path.join(ordner, name));
  }
  return aus;
}
{
  const daten = jsonDateien('daten');
  const treffer = [];
  const kaputt = [];
  let felder = [];
  for (const d of daten) {
    let json = null;
    try { json = JSON.parse(readFileSync(path.join(WURZEL, d), 'utf8')); } catch (e) { kaputt.push(d); continue; }
    for (const t of texteVon(json)) for (const w of VERBOTEN) if (t.toLowerCase().includes(w.toLowerCase())) treffer.push(`${d}: "${w}"`);
    // kein Feld fuer ein Ablaufdatum (Fairness 20: kein verfuegbarBis; Events ohne Druck)
    const schluessel = [];
    const sammle = (x) => {
      if (Array.isArray(x)) x.forEach(sammle);
      else if (x && typeof x === 'object') for (const [k, v] of Object.entries(x)) { schluessel.push(k); sammle(v); }
    };
    sammle(json);
    felder = felder.concat(schluessel.filter((k) => /^(verfuegbarBis|endetAm|ablauf|laeuftAb)$/i.test(k)).map((k) => `${d}: ${k}`));
  }
  pruefe(`Inhalte (${daten.length} Dateien unter daten/): gueltiges JSON, Verbotsliste ohne Treffer`, daten.length >= 1 && kaputt.length === 0 && treffer.length === 0, { kaputt, treffer });
  pruefe('Inhalte: kein Feld fuer ein Ablaufdatum (verfuegbarBis, endetAm ...)', felder.length === 0, felder);
  // jeder Spielplan unter daten/ ist gueltig (Vorlauf 28 Tage, keine Countdowns, lueckenlose Wochen)
  const plaene = daten.filter((d) => /spielplan/.test(path.basename(d)));
  const ungueltig = plaene.map((d) => [d, pruefeInhalt(JSON.parse(readFileSync(path.join(WURZEL, d), 'utf8')), { art: 'spielplan' })]).filter(([, r]) => !r.ok);
  pruefe(`Spielplaene (${plaene.length}) gueltig: Events mindestens 28 Tage vorher, keine Countdowns`, plaene.length >= 1 && ungueltig.length === 0, ungueltig.map(([d, r]) => [d, r.fehler]));
}
{
  // Events ohne Druck (Regel 19): die Pruefung lehnt kurzfristige Events, Countdowns und Ablauf-Felder ab
  const kopf = { art: 'spielplan', format: 1, rechenstand: 1, stand: '2026-11-01' };
  const woche = { montag: '2026-11-16', boss: 'bergwirt', thema: null, funkenWochenende: false };
  pruefe('Regel 19: Funken-Wochenende weniger als 4 Wochen vorher wird abgelehnt', pruefeSpielplan({ kopf, wochen: [{ ...woche, funkenWochenende: true }] }).length > 0
    && pruefeSpielplan({ kopf, wochen: [woche] }).length === 0);
  pruefe('Regel 19: Uhrzeit-Countdown und Ablauf-Feld werden abgelehnt', pruefeSpielplan({ kopf, wochen: [{ ...woche, text: 'Nur noch 3 h' }] }).length > 0
    && pruefeSpielplan({ kopf, wochen: [{ ...woche, verfuegbarBis: '2026-11-20' }] }).length > 0);
  // kein Uhrzeit-Countdown in den Texten von Spielplan, Boss und Werkstatt (Code); dasselbe Muster wie inhalte.js
  // (w0plus-a-fix: vorher nur Kurzformen, "noch 10 Minuten" und "noch 2 T 04:13" gingen durch)
  const COUNTDOWN = COUNTDOWN_RE;
  const orte = jsDateien('js').filter((d) => /spielplan|boss|werkstatt/i.test(d));
  const cd = [];
  for (const d of orte) for (const t of zerlege(readFileSync(path.join(WURZEL, d), 'utf8')).texte) if (COUNTDOWN.test(t)) cd.push(`${d}: "${t.slice(0, 60)}"`);
  // dazu die Inhalte (daten/boss/..., Spielplaene, Werkstatt-Katalog)
  const inhalte = jsonDateien('daten').filter((d) => /spielplan|boss|werkstatt/i.test(d));
  for (const d of inhalte) {
    let json = null;
    try { json = JSON.parse(readFileSync(path.join(WURZEL, d), 'utf8')); } catch (e) { continue; }
    for (const t of texteVon(json)) if (COUNTDOWN.test(t)) cd.push(`${d}: "${t.slice(0, 60)}"`);
  }
  pruefe(`Kein Uhrzeit-Countdown in Spielplan, Boss, Werkstatt (${orte.length} Code-Dateien, ${inhalte.length} Inhalte)`, cd.length === 0 && COUNTDOWN.test('noch 2 h') && COUNTDOWN.test('3 Std') && !COUNTDOWN.test('Level 12'), cd);
  // Selbstprobe des Musters (w0plus-a-fix): auch ausgeschriebene Restzeiten, Anfaenge bleiben erlaubt
  const fang = ['noch 10 Minuten', 'noch 2 Stunden', 'noch 2 T 04:13', 'endet um 23:59', 'noch 3 Tage', 'bis 23:59', 'Nur noch 45min', '2h'];
  const frei = ['ab 16 Uhr', 'Montag 4:00', '5 Minuten Bedenkzeit', 'KW 2 · 2027', 'Woche 2 hat einen Boss'];
  pruefe('Countdown-Muster: faengt ausgeschriebene Restzeiten und Enduhrzeiten, laesst Anfaenge durch',
    fang.every((t) => COUNTDOWN.test(t)) && !frei.some((t) => COUNTDOWN.test(t)), { durch: fang.filter((t) => !COUNTDOWN.test(t)), falsch: frei.filter((t) => COUNTDOWN.test(t)) });
}
{
  // Boss: Boss-Partien werten nie, jeder Boss bleibt im Archiv spielbar
  const sieg = { ergebnis: 'sieg', genauigkeit: 95, hinweise: 0, zuruecknahmen: 0, zuege: Array(30).fill('e2e4'), spielerFarbe: 'w' };
  pruefe('Boss, freie Partie und Spielhalle werten nie und bringen nie Sterne', MODI.includes('boss') && ['boss', 'frei', 'spiel'].every((m) => !wertet({ ...sieg, modus: m })
    && JSON.stringify(sterneFuerPartie({ ...sieg, modus: m })) === '[false,false,false]'));
  const profil = { id: 'fairness-boss', art: 'boss', name: 'Testboss', avatar: 'x.svg', staerke: { ...botNachId('rudi').staerke } };
  let ohneArchiv = false;
  try { registriereBot(profil); } catch (e) { ohneArchiv = /archiv/.test(e.message); }
  const ab = registriereBot({ ...profil, archiv: true });
  pruefe('Jedes Boss-Objekt hat archiv: true (ohne wird es abgelehnt)', ohneArchiv && botNachId('fairness-boss').archiv === true);
  // w0plus-a-fix: angemeldete Bots gehoeren nie zur Leiter, auch nicht im Modus normal aus der Grundstellung
  const gast = registriereBot({ id: 'fairness-gast', art: 'gast', name: 'Gast', avatar: 'x.svg', staerke: { ...botNachId('benno').staerke } });
  pruefe('Partien gegen angemeldete Bots (Boss, Sparring, Gast) werten nie und bringen nie Sterne, auch im Modus normal',
    !wertet({ ...sieg, botId: 'fairness-gast' }) && !wertet({ ...sieg, botId: 'fairness-boss', modus: 'normal' })
    && JSON.stringify(sterneFuerPartie({ ...sieg, botId: 'fairness-gast' })) === '[false,false,false]' && wertet({ ...sieg, botId: 'rudi' }));
  gast();
  ab();
}
{
  // Finisher: hoechstens 1,8 s, Kurzfassung hoechstens 0,8 s; die Partie wartet nie laenger
  pruefe('Finisher: dauerMs <= 1800, Kurzfassung <= 800', BRETT_FEIER.dauerMs <= 1800 && BRETT_FEIER.kurzMs <= 800 && BRETT_FEIER.kurzMs <= BRETT_FEIER.dauerMs);
  const partie = zerlege(readFileSync(path.join(WURZEL, 'js/ui/partie.js'), 'utf8')).code;
  pruefe('Finisher: partie.js wartet am Ort partie:matt hoechstens BRETT_FEIER.dauerMs', /warte\(BRETT_FEIER\.dauerMs,/.test(partie)
    && !/partie:matt[\s\S]{0,400}warte\((?!BRETT_FEIER)\d/.test(partie));
  // w0plus-a-fix: vor dem Finisher wartet die Partie hoechstens MATT_HOOK_WARTEN_MS (300 ms) auf partie:beendet
  const m = partie.match(/MATT_HOOK_WARTEN_MS\s*=\s*(\d+)/);
  pruefe('Finisher: vor dem Start hoechstens 300 ms Warten auf partie:beendet (vorher bis 3 s; anders nur im Testmodus)', !!m && Number(m[1]) <= 300
    && /Promise\.race\(\[beendetDa, warte\(mattHookWarten\(\)\)\]\)/.test(partie)
    && /const t = app\.test && window\.__test \? window\.__test\.mattHookWarten : undefined;\s*return Number\.isFinite\(t\) \? t : MATT_HOOK_WARTEN_MS;/.test(partie), m && m[1]);
}
{
  // Schnell-Chat (Phase 2, SPIELKONZEPT 5.3 und Regel 21): keine Saetze "Wow", "Hoppla", "Knapp", "Glück gehabt",
  // "Endlich" (wirken nach einem Fehler des Gegners wie Spott). Gilt fuer jede Datei mit "chat" oder "emote" im Namen
  // unter js/ und daten/; bisher gibt es keine, die Pruefung greift mit dem Paket.
  const CHAT_VERBOTEN = /(^|[^a-zäöüß])(wow|hoppla|knapp|endlich)(?![a-zäöüß])|glück gehabt/i;
  const chatJs = jsDateien('js').filter((d) => /chat|emote/i.test(path.basename(d)));
  const chatJson = jsonDateien('daten').filter((d) => /chat|emote/i.test(path.basename(d)));
  const treffer = [];
  for (const d of chatJs) for (const t of zerlege(readFileSync(path.join(WURZEL, d), 'utf8')).texte) if (CHAT_VERBOTEN.test(t)) treffer.push(`${d}: "${t.slice(0, 60)}"`);
  for (const d of chatJson) {
    let json = null;
    try { json = JSON.parse(readFileSync(path.join(WURZEL, d), 'utf8')); } catch (e) { treffer.push(`${d}: kein JSON`); continue; }
    for (const t of texteVon(json)) if (CHAT_VERBOTEN.test(t)) treffer.push(`${d}: "${t.slice(0, 60)}"`);
  }
  // Selbstprobe des Musters (sonst prueft die leere Liste nichts)
  const probe = ['Wow!', 'Hoppla', 'Knapp!', 'Glück gehabt', 'Endlich.'].every((t) => CHAT_VERBOTEN.test(t))
    && !['Gut gespielt!', 'Knapper Sieg für dich', 'Danke für die Partie'].some((t) => CHAT_VERBOTEN.test(t));
  pruefe(`Schnell-Chat ohne "Wow", "Hoppla", "Knapp", "Glück gehabt", "Endlich" (${chatJs.length + chatJson.length} Dateien)`, probe && treffer.length === 0, treffer);
}
{
  // Bot-Ton (SPIELKONZEPT 3.12 und 5.3, Paket gedaechtnis, Welle A2): hoechstens eine Bot-Stichelei je Partie (nur die
  // Begruessung, ein Wahl-Ort, keine Blase in der Partie) und keine nach 3 Niederlagen in Folge, weder gegen diesen Bot
  // noch insgesamt; dann kommt immer ein Mut-Satz (auch kein Schweigen, sonst spraeche die eingebaute Begruessung).
  const datei = path.join(WURZEL, 'js/pakete/gedaechtnis/logik.js');
  if (existsSync(datei)) {
    const G = await import('../js/pakete/gedaechtnis/logik.js');
    const T = await import('../js/tag.js');
    const indexTeile = zerlege(readFileSync(path.join(WURZEL, 'js/pakete/gedaechtnis/index.js'), 'utf8'));
    const index = indexTeile.code;
    const leiter = ['benno', 'hilde', 'kalle', 'lisa', 'rudi', 'turm', 'delia', 'koenig', 'greta', 'stockfisch'];
    let falsch = 0;
    let gesehen = 0;
    for (const botId of leiter) {
      for (let i = 0; i < 30; i++) {
        const heute = T.addiereTage('2026-11-02', i);
        const am = (k) => new Date(Date.parse(T.beginnVon(T.addiereTage(heute, -k))) + 14 * 3600e3).toISOString();
        const p = (ergebnis, k) => ({ id: `f${botId}${i}${k}`, botId, ergebnis, datum: am(k), modus: 'normal', zuege: ['e2e4'] });
        for (const [partien, gesamt] of [[[p('niederlage', 1), p('niederlage', 2), p('niederlage', 3)], 0], [[p('niederlage', 1), p('sieg', 2)], 3]]) {
          const w = G.begruessung({ botId, partien, heute, folgeGesamt: () => gesamt });
          gesehen++;
          if (!w || G.STICHELEI.includes(w.grund) || w.grund !== 'mutmachen') falsch++;
        }
      }
    }
    pruefe(`Bot-Ton: nach 3 Niederlagen in Folge keine Stichelei, sondern Mut (${gesehen} Faelle, alle Leiter-Bots)`, falsch === 0 && gesehen === 600, falsch);
    // dieselbe Sperre nach 9 Tagen Pause (wiedersehen gewinnt den Vorrang) und mit Partien, die aus der Liste gefallen sind,
    // bei "Bot-Sprueche: Normal" und "Wenig": nie Schweigen (sonst spraeche die eingebaute Begruessung, die sticheln kann),
    // bei "Wenig" nur dessen Anlaesse, und die Wahl steht vorn am Wahl-Ort (vor dem Level-Gruss anderer Pakete)
    let sperrFalsch = 0;
    let sperrFaelle = 0;
    for (const botId of leiter) {
      for (let i = 0; i < 30; i++) {
        const heute = T.addiereTage('2026-11-02', i);
        const am = (k) => new Date(Date.parse(T.beginnVon(T.addiereTage(heute, -k))) + 14 * 3600e3).toISOString();
        const p = (ergebnis, k) => ({ id: `s${botId}${i}${k}`, botId, ergebnis, datum: am(k), modus: 'normal', zuege: ['e2e4'] });
        for (const sprueche of ['an', 'wenig']) {
          for (const [partien, gesamt, bekannt] of [[[p('niederlage', 9), p('niederlage', 10), p('niederlage', 11)], 0, 3], [[], 3, 5]]) {
            const w = G.begruessung({ botId, partien, heute, folgeGesamt: () => gesamt, bekannt, sprueche });
            sperrFaelle++;
            if (!w || G.STICHELEI.includes(w.grund) || w.vorn !== true || (sprueche === 'wenig' && !G.WENIG.includes(w.grund))) sperrFalsch++;
          }
        }
      }
    }
    pruefe(`Bot-Ton: Sperre auch nach langer Pause und bei "Wenig", nie Schweigen, immer vorn (${sperrFaelle} Faelle)`, sperrFalsch === 0 && sperrFaelle === 1200, sperrFalsch);
    pruefe('Bot-Ton: hoechstens eine Stichelei je Partie (nur die Begruessung "revanche", keine Blase, kein Coach-Zusatz)',
      JSON.stringify(G.STICHELEI) === '["revanche"]' && !/\.blase\(|coachZusatz\(/.test(index)
      && indexTeile.texte.filter((t) => t === 'partie:begruessung?').length === 1);
  }
}
{
  // Level ohne Spielwirkung (Regel 18): bots.js und engine.js importieren nichts aus Paketen (Funken, Level ...)
  const imp = ['js/bots.js', 'js/engine.js'].filter((d) => /from\s+['"][^'"]*pakete\//.test(readFileSync(path.join(WURZEL, d), 'utf8')));
  pruefe('bots.js und engine.js importieren nichts aus den Paketen (Level und Funken ohne Spielwirkung)', imp.length === 0, imp);
}

// =====================================================================
// Paket funken (SPIELKONZEPT 5.2 Regel 18 und 5.3): ehrliche Erfahrung
// =====================================================================
{
  const R = await import('../js/pakete/funken/rechnung.js');
  const L = await import('../js/pakete/funken/level.js');
  const S = await import('../js/pakete/funken/stand.js');
  const st0 = await import('../js/storage.js');
  const KLASSEN = ['brillant', 'stark', 'bester', 'exzellent', 'gut', 'buch', 'ungenau', 'fehler', 'verpasst', 'patzer', 'erzwungen', null];
  const GEWINN = [0, 0.05, 0.0999, 0.1, 0.5, 0.9, 0.9001, 0.95, 1, null];
  // Funken nie negativ: alle Ergebnisse, Zuglaengen, Hilfe, Faktoren, Zugklassen, Gewinnchancen, Bogen und Rueckenwind
  let negativ = 0;
  let faelle = 0;
  const zuege = KLASSEN.flatMap((k) => GEWINN.map((g) => ({ klasse: k, gewinnVorher: g, gewinnNachher: g, gewinnVorigerZug: g, matt: g === 1 ? 2 : null })));
  for (const ergebnis of ['sieg', 'remis', 'niederlage', 'abbruch']) {
    for (const eigeneZuege of [0, 9, 10, 14, 15, 40, 120]) {
      for (const hilfe of [false, true]) {
        for (const faktor of [0.25, 0.5, 0.75, 1, 1.25, 1.5]) {
          const p = R.partieFunken({ zuege, ergebnis, eigeneZuege, hilfe, faktor, genauigkeit: 90, gegner: { partien: 1, maxZuege: 3, letzteGenauigkeit: 10 } });
          for (const schonHeute of [0, 799, 5000]) {
            for (const [wochenende, kartenAktiv] of [[false, 0], [false, 3], [true, 0], [true, 3]]) {
              faelle++;
              const m = R.endMenge({ vor: p.vorRueckenwind, schonHeute, wochenende, kartenAktiv, einheit: true });
              if (p.basis < 0 || m.menge < 0 || !Number.isInteger(m.menge)) negativ++;
            }
          }
        }
      }
    }
  }
  pruefe(`Funken: nie negativ (${faelle} Fälle)`, negativ === 0 && R.runde(-5) === 0, negativ);
  const aussen = KLASSEN.flatMap((k) => [0, 0.05, 0.0999, 0.9001, 0.95, 1].map((g) => R.zugwerte([{ klasse: k, gewinnVorher: g }])))
    .filter((z) => z.zugwerte !== 0 || z.offen !== 0);
  pruefe('Funken: Züge außerhalb 10 bis 90 % bringen 0 und belegen keinen Platz', aussen.length === 0, aussen);
  pruefe('Funken: höchstens 40 offene Züge (100 „Genial“ = 480)', R.zugwerte(Array.from({ length: 100 }, () => ({ klasse: 'brillant', gewinnVorher: 0.5 }))).zugwerte === 480);
  const zwei = R.endMenge({ vor: 100, wochenende: true, kartenAktiv: 3, einheit: true });
  pruefe('Funken: Rückenwind und Funken-Wochenende zusammen höchstens × 2', zwei.menge === 200 && zwei.faktor === 2 && !zwei.verbraucht);
  const bogen = R.endMenge({ vor: 400, schonHeute: 600, kartenAktiv: 1, einheit: true });
  pruefe('Funken: Tagesbogen rechnet mit den Funken vor der Verdopplung (200 voll + 100 halb, dann × 2 = 600)', bogen.menge === 600, bogen);
  const titel = L.TITEL.map(([, n]) => n).filter((n) => /meister|großmeister|grossmeister|profi|experte|elo/i.test(n));
  pruefe('Level-Titel ohne „Meister“, „Großmeister“, „Profi“, „Experte“, „Elo“', titel.length === 0, titel);
  // Uebung und Lernen: Funken ja, Wertung nie (Regel 7)
  const m = new Map();
  st0.setzeSpeicher({ getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k),
    key: (i) => [...m.keys()][i] ?? null, get length() { return m.size; } });
  const st = S.lade(new Date(2026, 9, 22, 20));
  const fVor = JSON.stringify(st0.ladeFortschritt());
  const sVor = JSON.stringify(st0.statistik());
  const u = S.lernUebung(st, { partieId: 'p1', ply: 10, getroffen: true });
  const uebungPartie = S.buchePartie(st, { partieId: 'pu', modus: 'uebung', wertet: false, ergebnis: 'sieg', eigeneZuege: 30, liveKlassen: [] });
  S.speichere(st);
  pruefe('Funken: eine Übung erhöht Funken, ändert aber nie Wertung, Sterne oder Statistik; Übungs-Partien bringen keine Partie-Funken',
    u.length === 1 && u[0].menge === 15 && st.gesamt === 15 && uebungPartie === null && JSON.stringify(st0.ladeFortschritt()) === fVor
    && JSON.stringify(st0.statistik()) === sVor);
  // Level sinkt nie: Gutschriften sind nie negativ, ein Abschluss senkt nichts, geladene Staende folgen den Funken
  const vorher = st.level;
  S.gutschrift(st, -500, 'partie');
  const kein = S.schliesseLevel(st, 99, new Date());
  let monoton = true;
  for (let f = 0, alt = 1; f < 60000; f += 53) { const l = L.levelVon(f); if (l < alt) monoton = false; alt = l; }
  pruefe('Funken: Level sinkt nie', st.gesamt === 15 && st.level === vorher && kein === null && monoton);
  pruefe('Funken: Tafel-Rekord-Funken nur für Allzeit-Rekorde', S.rekord(st, { tafel: 'bot:rudi', platz: 1, fenster: 'woche' }, 'pa').length === 0
    && S.rekord(st, { tafel: 'bot:rudi', platz: 1, fenster: 'monat' }, 'pb').length === 0 && S.rekord(st, { tafel: 'bot:rudi', platz: 1, fenster: 'allzeit' }, 'pc').length === 1);
  pruefe('Funken: Rätsel aus dem Treppenlauf buchen keine Einzel-Funken', S.lernRaetsel(st, { id: 'r9', richtig: true, versuch: 1, wertung: 2000, blick: 1000, quelle: 'treppe' }).length === 0);
  pruefe('Funken: Level schaltet nur Schmuck und Titel frei (keine Bots, Analyse, Lektionen, Klangpakete)', L.alleStuecke().every((x) => !/bot|analyse|lektion|klang/i.test(x.art + x.id)));
}

// =====================================================================
// Paket punkte (SPIELKONZEPT 3.13 und 5.3): Punkte nie negativ, Schleppen lohnt nie, Hilfe ohne Tafel
// =====================================================================
{
  const P = await import('../js/pakete/punkte/formel.js');
  const PS = await import('../js/pakete/punkte/stand.js');
  const st0 = await import('../js/storage.js');
  const KLASSEN = ['brillant', 'stark', 'bester', 'exzellent', 'gut', 'buch', 'ungenau', 'fehler', 'verpasst', 'patzer', 'erzwungen', null, 'quatsch'];
  const GEWINN = [-1, 0, 0.05, 0.0999, 0.1, 0.5, 0.9, 0.9001, 0.95, 1, 2, null];
  // Punkte nie negativ: alle Ergebnisse, Zuglaengen, Hilfe, Uhr-Anteile, Zugklassen, Gewinnchancen, Matt-Angaben, Reihenfolgen
  const zuege = KLASSEN.flatMap((k) => GEWINN.map((g, i) => ({ klasse: k, gewinnVorher: g, gewinnNachher: GEWINN[(i + 3) % GEWINN.length],
    trivial: i % 4 === 0, nachHilfe: i % 5 === 0, matt: i % 3 === 0 ? -2 : i })));
  let negativ = 0;
  let faelle = 0;
  for (const ergebnis of ['sieg', 'remis', 'niederlage', 'abbruch', undefined]) {
    for (const eigeneZuege of [0, 9, 10, 14, 15, 40, 120, -3, null]) {
      for (const hilfe of [false, true]) {
        for (const uhrAnteil of [null, -1, 0, 0.5, 1, 7]) {
          for (const teil of [zuege, zuege.slice().reverse(), zuege.slice(0, 7), []]) {
            faelle++;
            const r = P.tafelwert({ zuege: teil, ergebnis, eigeneZuege, hilfe, uhrAnteil });
            const posten = [r.wert, r.zugpunkte, r.theorie, r.ergebnis, r.verwertung, r.combo, r.weste, r.uhr, r.kuer];
            if (posten.some((x) => !Number.isInteger(x) || x < 0)) negativ++;
          }
        }
      }
    }
  }
  pruefe(`Punkte: nie negativ und immer ganze Zahlen (${faelle} Fälle)`, negativ === 0 && P.runde(-5) === 0 && P.leistungspunkte(-100, 1200) === 0, negativ);
  // 120 Zuege Schieben gegen Lukas bleibt unter der zuegig verwerteten Fassung; je laenger geschoben, desto weniger (nie mehr)
  const z = (klasse, n, g = 0.5) => Array.from({ length: n }, () => ({ klasse, gewinnVorher: g, gewinnNachher: g }));
  const anfang = [...z('buch', 3), ...z('exzellent', 3), ...z('gut', 2), { klasse: 'gut', gewinnVorher: 0.6, gewinnNachher: 0.95 }];
  const lauf = (n) => P.tafelwert({ zuege: [...anfang, ...z('bester', n, 0.97)], ergebnis: 'sieg', eigeneZuege: anfang.length + n }).wert;
  // ab dem 10. eigenen Zug (vorher gibt es noch keinen Ergebnis-Bonus)
  let monoton = true;
  for (let n = 2; n <= 160; n++) if (lauf(n) > lauf(n - 1)) monoton = false;
  pruefe('Punkte: „120 Züge Schieben gegen Lukas“ bleibt unter der zügig verwerteten Fassung (und Schieben bringt nie mehr)',
    lauf(120 - anfang.length) < lauf(25) && lauf(120 - anfang.length) === 6400 && lauf(25) === 9400 && monoton, [lauf(111), lauf(25)]);
  // Tafeleintrag nur ohne Hilfe-Flag (Hinweis oder Zuruecknehmen), Uebung, freie Partien, Spielhalle und eigene Stellung nie
  const m = new Map();
  st0.setzeSpeicher({ getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k),
    key: (i) => [...m.keys()][i] ?? null, get length() { return m.size; } });
  const st = PS.lade();
  const review = { zuege: Array.from({ length: 24 }, (_, i) => ({ ply: i, farbe: i % 2 ? 'b' : 'w', klasse: 'bester', gewinnVorher: 0.5, gewinnNachher: 0.5 })) };
  const partie = (id, extra = {}) => ({ id, botId: 'benno', spielerFarbe: 'w', ergebnis: 'sieg', modus: 'normal', hinweise: 0, zuruecknahmen: 0,
    datum: '2026-10-22T18:00:00.000Z', zuege: Array.from({ length: 24 }, () => 'e2e4'), ...extra });
  const bewerte = (p) => PS.bewerte(st, { partieId: p.id, botId: p.botId, modus: p.modus, partie: p, review }, { jetzt: new Date(2026, 9, 22, 20) });
  const mitHinweis = bewerte(partie('h1', { hinweise: 1 }));
  const mitZurueck = bewerte(partie('h2', { zuruecknahmen: 1 }));
  const nie = ['uebung', 'frei', 'spiel'].map((modus) => bewerte(partie('m-' + modus, { modus })));
  const stellung = bewerte(partie('s1', { startFen: '4k3/8/8/8/8/8/4P3/4K3 w - - 0 1' }));
  const ohne = bewerte(partie('o1'));
  const eintraege = Object.values(st.tafeln).flatMap((t) => t.eintraege.map((e) => e.id));
  pruefe('Punkte: mit Hilfe-Flag (Hinweis oder Zurücknehmen) kein Tafeleintrag, Übung, freie Partie, Spielhalle und eigene Stellung nie; ohne Hilfe ja',
    P.tafelwert({ zuege: [], ergebnis: 'sieg', hilfe: true }).tafel === false && mitHinweis.tafel === null && mitZurueck.tafel === null
    && nie[0] === null && nie[1].tafel === null && nie[2].tafel === null && stellung.tafel === null && ohne.tafel === 'bot:benno' && eintraege.join() === 'o1',
    { eintraege, h: mitHinweis && mitHinweis.grund });
}

// =====================================================================
// Paket serie (SPIELKONZEPT 3.14, 3.15 und 5.3): Serie ohne Verlustangst, Siegeslauf ohne Bonus
// =====================================================================
{
  const T = await import('../js/pakete/serie/tag.js');
  const LA = await import('../js/pakete/serie/lauf.js');
  const add = (k, n) => {
    const d = new Date(Number(k.slice(0, 4)), Number(k.slice(5, 7)) - 1, Number(k.slice(8, 10)) + n, 12);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  // Serie zeigt nach einer Pause oder Luecke nie "0": 300 Tage mit Pausen und Luecken, jede Lage danach
  const st = T.leer();
  let null0 = 0;
  for (let i = 0; i < 300; i++) {
    const tag = add('2026-01-01', i);
    if (i % 40 === 10) T.pauseAnsagen(st, tag, { ab: tag, tage: 5 });
    if (i % 17 !== 3 && i % 23 > 2 && !st.pausen.includes(tag)) T.zaehleTag(st, tag, { quelle: 'partie' });
    const lg = T.lage(st, add(tag, 1), {});
    if (st.letzter && (lg.aktuell < 1 || lg.best < 1)) null0++;
  }
  pruefe('Serie: zeigt nach Pause oder Lücke nie „0“ (ruht mit Rekord, 300 Tage)', null0 === 0 && st.kapitel.nr > 1, null0);
  const p = T.leer();
  pruefe('Serie: Pause nur für heute oder künftige Tage, höchstens 30 im Jahr', !T.pauseAnsagen(p, '2026-05-10', { ab: '2026-05-09', tage: 2 }).ok
    && T.pauseAnsagen(p, '2026-05-10', { ab: '2026-05-10', tage: 40 }).tage.length === 30 && T.PAUSE_JAHR_MAX === 30);
  const r = T.leer();
  T.zaehleTag(r, '2026-03-01', { quelle: 'partie', tz: -60 });
  pruefe('Serie: Reise-Regel (ein übersprungener Tag bei Zeitzonenwechsel zählt)', T.zaehleTag(r, '2026-03-03', { quelle: 'partie', tz: 300 }).reise === '2026-03-02'
    && r.aktuell === 3);
  const w = T.leer();
  const doppel = [];
  for (const tag of ['2026-04-01', '2026-04-05', '2026-04-09', '2026-04-20', '2026-05-02', '2026-05-09']) doppel.push(T.zaehleTag(w, tag, { quelle: 'partie' }).doppelschritt);
  pruefe('Serie: „Willkommen zurück“ (Doppelschritt) höchstens einmal je Kalendermonat', doppel.join() === 'false,true,false,false,true,false', doppel);
  // keine Funken fuer die Serie: das Paket importiert nichts aus funken und sendet keine Funken-Ereignisse
  const quellen = ['tag.js', 'lauf.js', 'stand.js', 'ansicht.js', 'index.js'].map((d) => readFileSync(path.join(WURZEL, 'js/pakete/serie', d), 'utf8'));
  pruefe('Serie und Siegeslauf: keine Funken (kein Import aus funken, kein funken:-Ereignis), nichts kaufbar',
    quellen.every((q) => !/from\s+['"][^'"]*funken|sende\(\s*['"]funken:|kaufen|Kauf/.test(zerlege(q).code + zerlege(q).texte.join(' '))));
  // Siegeslauf: nur gegen gleich starke oder staerkere, Pausen brechen nicht, Remis/Niederlage enden still, Flamme ab 3
  const sieg = (x = {}) => ({ modus: 'normal', wertet: true, ergebnis: 'sieg', hinweise: 0, zuruecknahmen: 0, botStufe: 4, ...x });
  const lauf = { n: 0, best: 0, ms: [] };
  for (let i = 0; i < 4; i++) LA.buche(lauf, sieg(), { hoechsteStufe: 5 });
  const pausen = [sieg({ hinweise: 1 }), sieg({ botStufe: 2 }), sieg({ modus: 'uebung', wertet: false }), sieg({ modus: 'frei', wertet: false }),
    sieg({ modus: 'boss', wertet: false }), sieg({ ergebnis: 'niederlage', botStufe: 1 })].map((d) => LA.buche(lauf, d, { hoechsteStufe: 5 }).wirkung);
  const ende = LA.buche(lauf, sieg({ ergebnis: 'remis' }), { hoechsteStufe: 5 });
  pruefe('Siegeslauf: nur gegen ungefähr gleich starke (Wertung minus 150, vorher höchster Bot minus eine Stufe); Hilfe, Schwächere, Übung, frei, Boss pausieren; Remis beendet still',
    pausen.every((x) => x === 'pause') && ende.wirkung === 'ende' && ende.endeBei === 4 && lauf.best === 4 && LA.ABSTAND === 150
    && LA.gleichStark({ botElo: 1050, wertung: 1200, wertungPartien: 10 }) && !LA.gleichStark({ botStufe: 3, hoechsteStufe: 5 }), pausen);
  pruefe('Siegeslauf: Flamme erst ab 3 Siegen, Ergebnis ohne Funken- oder Wertungs-Bonus', LA.FLAMME_AB === 3
    && Object.keys(LA.buche({ n: 0, best: 0, ms: [] }, sieg(), { hoechsteStufe: 1 })).every((k) => !/funken|wertung|bonus|liga/i.test(k)));
}

console.log(`\n${ok}/${ok + fehler} bestanden`);
process.exit(fehler ? 1 : 0);
