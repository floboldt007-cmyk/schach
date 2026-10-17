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

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let ok = 0;
let fehler = 0;
function pruefe(name, bedingung, info) {
  if (bedingung) { ok++; console.log('OK     ' + name); } else { fehler++; console.log('FEHLER ' + name + (info !== undefined ? '  -> ' + JSON.stringify(info) : '')); }
}

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
  'nur heute', 'limitiert', 'Leben verloren', 'Game Over', 'Funken verfallen', 'Boost kaufen', 'am Stück'];
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
}

// ---------- Regel 1: kein Zufall in Feier und Paket-Logik ----------
{
  // W0+a: dazu die reinen Logik-Dateien der neuen Pakete (SPIELKONZEPT 5.3) und tag.js, inhalte.js
  const REIN = ['serie.js', 'logik.js', 'kartei.js', 'alltag.js', 'profil.js', 'taktik.js',
    'funken.js', 'punkte.js', 'marsch.js', 'boss.js', 'raetsel.js', 'liga.js', 'code.js'];
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
  pruefe('Finisher: vor dem Start hoechstens 300 ms Warten auf partie:beendet (vorher bis 3 s)', !!m && Number(m[1]) <= 300
    && /Promise\.race\(\[beendetDa, warte\(MATT_HOOK_WARTEN_MS\)\]\)/.test(partie), m && m[1]);
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
  // Level ohne Spielwirkung (Regel 18): bots.js und engine.js importieren nichts aus Paketen (Funken, Level ...)
  const imp = ['js/bots.js', 'js/engine.js'].filter((d) => /from\s+['"][^'"]*pakete\//.test(readFileSync(path.join(WURZEL, d), 'utf8')));
  pruefe('bots.js und engine.js importieren nichts aus den Paketen (Level und Funken ohne Spielwirkung)', imp.length === 0, imp);
}

console.log(`\n${ok}/${ok + fehler} bestanden`);
process.exit(fehler ? 1 : 0);
