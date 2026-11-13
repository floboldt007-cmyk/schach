// Paket lernen (Meisterschule: Mattbilder und Endspiele): Daten, Ziel-Regeln und Sterne ohne Browser, dazu ein Browser-Teil
// (Playwright) in der vollen App. Als Erfinder (Sitzung und Sonderstuecke im Speicher, Supabase per page.route gefaelscht):
// Karte im Training, Uebersicht mit 20 Mattbildern und Bereichswahl, Endspiel Quadratregel gehalten, Lektion Grundreihe gespielt (Matt in 1, 3 Sterne, gespeichert, Karte zaehlt),
// Lektion Dame mit gefaelschter Verteidigung (window.__test.lektionZug): Hinweis, Neu starten, Gegenzug, Patt-Ende.
// Gratis-Spieler (anderes Konto, kein Abo): Karte da, leichte Lektionen und Proben offen, der Rest mit Schloss (zugang.js).
//   node tests/lernen.test.mjs            Node und Browser
//   node tests/lernen.test.mjs --nur-node nur der Node-Teil
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Chess } from '../vendor/chess/chess.js';
import { LEKTIONEN, STUFEN, BEREICHE, ALLE, lektion, sterne, sterneFolge, grenze, pruefeLektion, stand, merke, summe, bilanz, pruefeZiel }
  from '../js/pakete/lernen/mattbilder.js';
import { ENDSPIELE } from '../js/pakete/lernen/endspiele.js';
import { EROEFFNUNGEN } from '../js/pakete/lernen/eroeffnungen.js';
import { TAKTIK } from '../js/pakete/lernen/taktik.js';
import { DE, EN } from '../js/pakete/lernen/texte.js';
import { browserTyp } from './browser.mjs';

const require = createRequire(import.meta.url);
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || await (await import('./freier-port.mjs')).freierPort();
const BASIS = `http://127.0.0.1:${PORT}/index.html?test`;
const NUR_NODE = process.argv.includes('--nur-node');
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

let ok = 0; let fehler = 0;
function pruefe(name, wert, info = '') {
  if (wert) { ok++; console.log('ok   ' + name); } else { fehler++; console.log('FEHLER ' + name + ' ' + (typeof info === 'string' ? info : JSON.stringify(info))); }
}

// ---------------------------------------------------------------------------
// Node-Teil
// ---------------------------------------------------------------------------
pruefe('Mattbilder: 20 Lektionen, ids eindeutig, Stufen von leicht bis Meister', LEKTIONEN.length === 20
  && new Set(LEKTIONEN.map((l) => l.id)).size === 20 && LEKTIONEN[0].stufe === 'leicht' && LEKTIONEN[19].stufe === 'meister'
  && LEKTIONEN.every((l) => STUFEN.includes(l.stufe)));
const pf = ALLE.flatMap((l) => pruefeLektion(l, Chess));
pruefe('Mattbilder: jede Stellung legal, Weiss am Zug, Schwarz nicht im Schach, nicht schon vorbei, Ziel ganzzahlig', pf.length === 0, pf.join(' | '));
pruefe('Stufen laufen nie rueckwaerts (leicht zuerst), in jedem Bereich', BEREICHE.every((b) => b.lektionen.every((l, i) => i === 0
  || STUFEN.indexOf(l.stufe) >= STUFEN.indexOf(b.lektionen[i - 1].stufe) - 1)));
const mitStellung = ALLE.filter((l) => l.art !== 'folge');
pruefe('Bereiche: Mattbilder 20, Taktik 21, Endspiele 13, Eroeffnungen 11, alle ids eindeutig, Stellungen (ohne Zugfolgen) verschieden',
  BEREICHE.map((b) => b.id).join() === 'matt,taktik,end,eroeffnung' && TAKTIK.length === 21 && ENDSPIELE.length === 13 && EROEFFNUNGEN.length === 11
  && ALLE.length === 65 && new Set(ALLE.map((l) => l.id)).size === 65 && new Set(mitStellung.map((l) => l.fen)).size === mitStellung.length);
// Taktik (31.10.2026): eigene Stellungen, mit Stockfish nachgeprueft; Ziel = Material nach dem Gegenzug
pruefe('Taktik: Art taktik, gewinn 1 bis 9, ziel 2 oder 3, Opfer 0 bis 5, Stufen leicht bis schwer, Flo Weiss', TAKTIK.every((l) => l.art === 'taktik'
  && Number.isInteger(l.gewinn) && l.gewinn >= 1 && l.gewinn <= 9 && [2, 3].includes(l.ziel) && [0, 5].includes(l.opfer)
  && ['leicht', 'mittel', 'schwer'].includes(l.stufe) && / w /.test(l.fen)));
const taktikLauf = (id, zuege) => { const l = lektion(id); const c = new Chess(l.fen); const st = bilanz(c); const r = [];
  zuege.forEach((z, i) => { c.move(z); r.push(pruefeZiel(l, st, c, { wann: i % 2 ? 'gegner' : 'flo', zuege: Math.floor(i / 2) + 1 })); }); return r.join(); };
pruefe('Taktik: Springergabel, Bauerngabel, Spiess, Fesselung, gefesselte Dame und Abzug sind erst nach dem Gegenzug geschafft',
  taktikLauf('gabel-springer', ['Nc6+', 'Kd6', 'Nxa7', 'Ke6']) === ',,,geschafft' && taktikLauf('gabel-bauer', ['d5', 'Ne5', 'dxe6', 'Nd3']) === ',,,geschafft'
  && taktikLauf('spiess', ['Be4+', 'Kd6', 'Bxa8', 'Ke5']) === ',,,geschafft' && taktikLauf('fesselung', ['Bb3', 'Kf8', 'Bxc4', 'Ke7']) === ',,,geschafft'
  && taktikLauf('fesselung-dame', ['Re1', 'Qxe1+', 'Kxe1', 'Kd7']) === ',,,geschafft'
  && taktikLauf('koenigsgabel', ['Nc7+', 'Kd7', 'Nxa8', 'Kc8']) === ',,,geschafft' && taktikLauf('turm-gabel', ['Rb6', 'Bf8', 'Rxa6', 'Kg8']) === ',,,geschafft'
  && taktikLauf('abzug-turm', ['Nc6+', 'Qe7', 'Nxe7', 'Kf7']) === ',,,geschafft' && taktikLauf('abzug', ['Nf7+', 'Ke7', 'Bxh8', 'Kxf7']) === ',,,geschafft');
// Teil 2: Doppelschach, Doppeldrohung, Ueberlastung (auch der Rueckschlag endet im Matt), Ablenkung (Matt), Hinlenkung (Opfer)
pruefe('Taktik Teil 2: Doppelschach, Doppeldrohung, Ueberlastung, Ablenkung und Hinlenkung (Turmopfer zaehlt nicht als verloren)',
  taktikLauf('doppelschach', ['Nd6+', 'Kd7', 'Nxc8', 'Kxc8']) === ',,,geschafft' && taktikLauf('doppeldrohung', ['Qd3', 'g6', 'Qxb5', 'Kg7']) === ',,,geschafft'
  && taktikLauf('doppeldrohung', ['Qd3', 'Nd4', 'Qxh7#']) === ',,geschafft'
  && taktikLauf('ueberlastung', ['Qxd5', 'Qf8']) === ',geschafft' && taktikLauf('ueberlastung', ['Qxd5', 'Qxd5', 'Re8#']) === ',,geschafft'
  && taktikLauf('ablenkung', ['Re8', 'Qxe8', 'Qg7#']) === ',,geschafft'
  && taktikLauf('hinlenkung', ['Rf8+', 'Kxf8', 'Nd7+', 'Ke7', 'Nxb6', 'Kd6']) === ',,,,,geschafft');
pruefe('Taktik Teil 2: das Opfer erlaubt nur den Turm, eine weitere verschenkte Figur ist gescheitert',
  taktikLauf('hinlenkung', ['Rf8+', 'Kxf8', 'Nc6', 'Qxc6', 'h3']) === ',,,,verloren');
pruefe('Taktik: ein Zug ohne Gewinn ist noch nichts, eine verschenkte Dame ist gescheitert',
  taktikLauf('turm-spiess', ['h3', 'Kb4']) === ',' && taktikLauf('gabel-dame', ['Qd8+', 'Rxd8', 'h3']) === ',,verloren');
// Feinschliff R5 (11.11.2026): sieben neue Lektionen, je einmal gestartet und mit der Loesung bis "geschafft" gespielt
pruefe('Neu R5: Figur fangen, Zwischenzug, Verteidiger, Roentgen, Linie oeffnen sind mit der Loesung geschafft',
  taktikLauf('figur-fangen', ['b3', 'Kf7', 'Kb2', 'Bxb3', 'cxb3', 'Ke6']) === ',,,,,geschafft'
  && taktikLauf('zwischenzug', ['Rxd8', 'Bd5', 'h3']) === ',geschafft,'
  && taktikLauf('verteidiger', ['Nxf7', 'Kxf7', 'Rxd5', 'Ke6']) === ',,,geschafft'
  && taktikLauf('roentgen', ['Qxd5', 'Rxd5', 'Rxd5', 'Kf8']) === ',,,geschafft'
  && taktikLauf('linie-oeffnen', ['e6', 'f6', 'Bxf6', 'g5', 'Qg7#']) === ',,,,geschafft');
pruefe('Neu R5: Zwischenzug, sofort zurueckschlagen (gxf3 Txd1+) ist nie geschafft', !taktikLauf('zwischenzug', ['gxf3', 'Rxd1+', 'Kg2', 'Rd2']).includes('geschafft'));
pruefe('Neu R5: Opposition und Patt vermeiden sind mit der Loesung geschafft (neue Dame steht nach dem Gegenzug)',
  taktikLauf('opposition', ['Ke4', 'Kd6', 'Kf5', 'Ke7', 'Ke5', 'Kd7', 'Kf6', 'Kc6', 'e4', 'Kd7', 'e5', 'Ke8', 'Ke6', 'Kd8', 'Kf7', 'Kc7',
    'e6', 'Kb6', 'e7', 'Kc5', 'e8=Q', 'Kd4']).endsWith(',geschafft')
  && taktikLauf('patt-vermeiden', ['Kd6', 'Kf7', 'Kd7', 'Kf6', 'e8=Q', 'Kf5']) === ',,,,,geschafft');
pruefe('Neu R5: Patt vermeiden, Ke6 ist sofort Patt', taktikLauf('patt-vermeiden', ['Ke6']) === 'patt');
// Vollsuche (01.11.2026, Flo: "Doppeldrohung gibt keinen Sinn, in 2 Zuegen geht nicht"): jede Taktik ist gegen JEDE
// Verteidigung in ziel Zuegen zu schaffen (Matt oder nach dem Gegenzug mindestens gewinn Punkte, wie pruefeZiel), jedes
// Mattbild bis Matt in 3 ist genau so lang wie angegeben. Schach und Schlagzuege zuerst, damit die Suche schnell findet.
const WERT_T = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const matT = (c) => { let s = 0; for (const z of c.board()) for (const f of z) if (f) s += (f.color === 'w' ? 1 : -1) * WERT_T[f.type]; return s; };
const sortiert = (c) => c.moves({ verbose: true }).sort((a, b) => ((/[+#]/.test(b.san) ? 2 : 0) + (b.captured ? 1 : 0)) - ((/[+#]/.test(a.san) ? 2 : 0) + (a.captured ? 1 : 0)));
function taktikWeg(c, n, start, gewinn) {
  for (const m of sortiert(c)) {
    c.move(m);
    let gut = c.isCheckmate();
    if (!gut && !c.isDraw()) {
      gut = c.moves().every((a) => { c.move(a); const r = !c.isCheckmate() && !c.isDraw() && (matT(c) - start >= gewinn || (n > 1 && !!taktikWeg(c, n - 1, start, gewinn))); c.undo(); return r; });
    }
    c.undo();
    if (gut) return m.san;
  }
  return null;
}
function mattWeg(c, n) {
  for (const m of sortiert(c)) {
    c.move(m);
    let gut = c.isCheckmate();
    if (!gut && n > 1 && !c.isDraw()) gut = c.moves().every((a) => { c.move(a); const r = !!mattWeg(c, n - 1); c.undo(); return r; });
    c.undo();
    if (gut) return m.san;
  }
  return null;
}
const taktikFalsch = TAKTIK.filter((l) => { const c = new Chess(l.fen); return !taktikWeg(c, l.ziel, matT(c), l.gewinn); }).map((l) => l.id);
pruefe('Vollsuche: jede Taktik ist gegen jede Verteidigung in ihrer Zugzahl zu schaffen', taktikFalsch.length === 0, taktikFalsch.join());
const mattFalsch = LEKTIONEN.filter((l) => l.ziel <= 3).filter((l) => !mattWeg(new Chess(l.fen), l.ziel) || (l.ziel > 1 && mattWeg(new Chess(l.fen), l.ziel - 1)))
  .map((l) => l.id);
pruefe('Vollsuche: jedes Mattbild bis Matt in 3 hat genau die angegebene Zugzahl', mattFalsch.length === 0, mattFalsch.join());
// Eroeffnungen (Zugfolge-Trainer): Flo spielt Weiss und Schwarz, jede Folge legal (pruefeLektion), Erklaerung je eigenem Zug
pruefe('Eroeffnungen: Art folge, Weiss und Schwarz vertreten, Grundstellung, Stufen leicht und mittel',
  EROEFFNUNGEN.every((l) => l.art === 'folge' && ['w', 'b'].includes(l.farbe) && l.fen.startsWith('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w'))
  && EROEFFNUNGEN.some((l) => l.farbe === 'w') && EROEFFNUNGEN.some((l) => l.farbe === 'b') && EROEFFNUNGEN.every((l) => ['leicht', 'mittel'].includes(l.stufe)));
const fehltZug = EROEFFNUNGEN.flatMap((l) => Array.from({ length: l.ziel }, (_, k) => `zug.${l.id}.${k}`)).filter((k) => !DE[k] || !EN[k]);
pruefe('Eroeffnungen: zu jedem eigenen Zug ein Satz, warum (Deutsch und Englisch)', fehltZug.length === 0, fehltZug.join(', '));
pruefe('Eroeffnungen: Légal-Falle endet mit Matt', (() => { const c = new Chess(); for (const z of lektion('legal-falle').folge) c.move(z); return c.isCheckmate(); })());
pruefe('Sterne Zugfolge: 3 ohne Fehler, 2 bei ein bis zwei Fehlern oder Hinweisen, sonst 1',
  sterneFolge({}) === 3 && sterneFolge({ fehler: 1 }) === 2 && sterneFolge({ fehler: 1, hinweise: 1 }) === 2 && sterneFolge({ fehler: 3 }) === 1
  && sterneFolge({ hinweise: 3 }) === 1);
pruefe('Endspiele: Arten umwandeln, gewinnen, halten; Flo immer Weiss', ENDSPIELE.every((l) => ['umwandeln', 'gewinnen', 'halten'].includes(l.art))
  && ENDSPIELE.some((l) => l.art === 'halten') && ENDSPIELE.some((l) => l.art === 'gewinnen') && ENDSPIELE.every((l) => l.fen.split(' ')[1] === 'w'));
const fehltText = ALLE.flatMap((l) => ['titel.', 'idee.'].flatMap((k) => [DE, EN].filter((d) => !d[k + l.id]).map(() => k + l.id)));
pruefe('Texte: Titel und Idee je Lektion auf Deutsch und Englisch', fehltText.length === 0, fehltText.join(', '));
pruefe('Texte: alle Schluessel in beiden Sprachen, keine langen Gedankenstriche',
  JSON.stringify(Object.keys(DE).sort()) === JSON.stringify(Object.keys(EN).sort())
  && ![...Object.values(DE), ...Object.values(EN)].some((v) => /[–—]/.test(v)));

// Zugang (07.11.2026, FAHRPLAN Abschnitt 6): leicht gratis, je Bereich eine mittlere Probe, der Rest im Trainer
{
  const z = await import('../js/pakete/lernen/zugang.js');
  const { VORTEILE } = await import('../js/pakete/abo/trainer.js');
  const zahl = z.zahlen();
  pruefe('Zugang: 26 leichte plus 4 Proben gratis, 35 im Trainer', zahl.gratis === 30 && zahl.abo === 35
    && ALLE.filter((l) => l.stufe === 'leicht').length === 26, JSON.stringify(zahl));
  pruefe('Zugang: je Bereich genau eine Probe, jede eine mittlere Lektion aus ihrem Bereich',
    BEREICHE.every((b) => b.lektionen.filter(z.istProbe).length === 1 && b.lektionen.some((l) => l.id === z.PROBE[b.id] && l.stufe === 'mittel')));
  pruefe('Zugang: ohne Konto offen ist genau, was gratis ist', ALLE.every((l) => z.istOffen(l) === z.istGratis(l)));
  // Willkommenswoche: 7 Tage ab dem ersten Willkommen (modul:start.gesehen), danach wieder Schloss; ohne den Tag keine Woche
  pruefe('Willkommenswoche: am ersten Tag und am siebten offen, am achten nicht, ohne Tag nie',
    z.inWillkommenswoche({ gesehen: '2026-11-07', heute: '2026-11-07' }) && z.inWillkommenswoche({ gesehen: '2026-11-01', heute: '2026-11-07' })
    && !z.inWillkommenswoche({ gesehen: '2026-10-31', heute: '2026-11-07' }) && !z.inWillkommenswoche({ gesehen: null, heute: '2026-11-07' })
    && !z.inWillkommenswoche({ gesehen: '2026-11-08', heute: '2026-11-07' }) && z.willkommenBis('2026-11-07') === '2026-11-13' && z.willkommenBis('kaputt') === null);
  pruefe('Zugang: Marke „Trainer“ genau für die 35 Lektionen, die nicht gratis sind', ALLE.filter(z.istImTrainer).length === 35
    && ALLE.every((l) => z.istImTrainer(l) === !z.istGratis(l)));
  const v = VORTEILE.find((x) => x.id === z.VORTEIL);
  pruefe('Trainer-Blatt: Vorteil Meisterschule nennt die richtige Zahl (35)', !!v && v.text.includes(String(zahl.abo) + ' Lektionen'), v && v.text);
}

// Die Muster stimmen: die bekannten Mattfuehrungen enden in diesen Stellungen wirklich matt
function spiele(fen, zuege) {
  const c = new Chess(fen);
  for (const z of zuege) c.move(z);
  return c;
}
pruefe('Grundreihe: Ta8 ist matt', spiele(lektion('grundreihe').fen, ['Ra8']).isCheckmate());
pruefe('Anastasia: Dxh7+ Kxh7 Th3 ist matt', spiele(lektion('anastasia').fen, ['Qxh7+', 'Kxh7', 'Rh3#']).isCheckmate());
const MUSTER = [
  ['pillsbury', ['Rg3#']], ['epaulette', ['Qe6#']], ['todeskuss', ['Qe7#']], ['blackburne', ['Bh7#']],
  ['anderssen', ['Rh1+', 'Kg8', 'Rh8#']], ['lolli', ['Qh6', 'a6', 'Qg7#']], ['damiano', ['Qh6', 'a6', 'Qh7#']],
  ['greco', ['Rxh7+', 'Kxh7', 'Qh5#']], ['oper', ['Qb8+', 'Nxb8', 'Rd8#']], ['boden', ['Qxc6+', 'bxc6', 'Ba6#']],
  ['legal', ['Bxf7+', 'Ke7', 'Nd5#']], ['arabisch', ['Nf6', 'a5', 'Rh7#']],
];
const musterFehler = MUSTER.filter(([id, zuege]) => { try { return !spiele(lektion(id).fen, zuege).isCheckmate(); } catch { return true; } })
  .map(([id]) => id);
pruefe('Neue Mattbilder: jede bekannte Mattfuehrung endet wirklich matt', musterFehler.length === 0, musterFehler.join(', '));
pruefe('Mattbilder: kein Muster doppelt (jede Stellung einmal)', new Set(LEKTIONEN.map((l) => l.fen)).size === LEKTIONEN.length);
const kaputt = pruefeLektion({ id: 'probe', stufe: 'leicht', fen: '3rk3/3p1p2/8/8/7Q/8/5PPP/4R1K1 w - - 0 1', ziel: 1 }, Chess);
pruefe('Pruefung erkennt eine Stellung, in der Schwarz schon im Schach steht', kaputt.some((f) => /im Schach/.test(f)), kaputt);
pruefe('Ersticktes Matt: Sf7+ Kg8 Sh6+ Kh8 Dg8+ Txg8 Sf7 ist matt',
  spiele(lektion('erstickt').fen, ['Nf7+', 'Kg8', 'Nh6+', 'Kh8', 'Qg8+', 'Rxg8', 'Nf7#']).isCheckmate());

pruefe('Sterne: Ziel 7, mit 7 oder 8 Zuegen drei, bis 13 zwei, danach einer',
  sterne({ ziel: 7, zuege: 7 }) === 3 && sterne({ ziel: 7, zuege: 8 }) === 3 && sterne({ ziel: 7, zuege: 9 }) === 2
  && sterne({ ziel: 7, zuege: 13 }) === 2 && sterne({ ziel: 7, zuege: 14 }) === 1);
pruefe('Sterne: Matt in 1 nur mit einem Zug drei Sterne', sterne({ ziel: 1, zuege: 1 }) === 3 && sterne({ ziel: 1, zuege: 2 }) === 2
  && sterne({ ziel: 1, zuege: 5 }) === 1);
pruefe('Sterne: mit Hinweis hoechstens zwei', sterne({ ziel: 7, zuege: 7, hinweise: 1 }) === 2 && sterne({ ziel: 7, zuege: 20, hinweise: 2 }) === 1);
pruefe('Grenze: doppeltes Ziel plus 10 Zuege', grenze(7) === 24 && grenze(1) === 12 && grenze(25) === 60);
let st = merke({}, 'dame', { sterne: 2, zuege: 11 });
st = merke(st, 'dame', { sterne: 1, zuege: 9 });
st = merke(st, 'gibtsnicht', { sterne: 3, zuege: 1 });
pruefe('Speicher: bessere Sterne und weniger Zuege bleiben, unbekannte Lektion faellt weg',
  JSON.stringify(st) === '{"lek":{"dame":{"s":2,"z":9}}}');
pruefe('Speicher: kaputte Eintraege fallen still weg', JSON.stringify(stand({ lek: { dame: { s: 7, z: 3 }, turm: 'x', grundreihe: { s: 3, z: 1 } } }))
  === '{"lek":{"grundreihe":{"s":3,"z":1}}}' && JSON.stringify(stand(null)) === '{"lek":{}}');
pruefe('Summe: Sterne, Hoechstzahl 60, geschafft', JSON.stringify(summe(merke(st, 'grundreihe', { sterne: 3, zuege: 1 }), 'matt'))
  === '{"sterne":5,"max":60,"geschafft":2}');
const stE = merke(merke({}, 'quadrat', { sterne: 3, zuege: 5 }), 'grundreihe', { sterne: 2, zuege: 2 });
pruefe('Summe: Endspiele zaehlen getrennt, ohne Bereich alle 65 Lektionen', JSON.stringify(summe(stE, 'end')) === '{"sterne":3,"max":39,"geschafft":1}'
  && JSON.stringify(summe(stE)) === '{"sterne":5,"max":195,"geschafft":2}' && stand(stE).lek.quadrat.s === 3);

// Ziel-Regeln (pruefeZiel): nach Flos Zug ('flo') und nach dem Gegenzug ('gegner')
const zielVon = (id, fen, wann, zuege = 1) => pruefeZiel(lektion(id), bilanz(new Chess(lektion(id).fen)), new Chess(fen), { wann, zuege });
pruefe('Ziel Matt: Grundreihe nach Ta8 geschafft, Patt und Matt gegen Flo erkannt',
  zielVon('grundreihe', spiele(lektion('grundreihe').fen, ['Ra8']).fen(), 'flo') === 'geschafft'
  && zielVon('dame', '7k/5Q2/6K1/8/8/8/8/8 b - - 0 1', 'flo') === 'patt'
  && zielVon('grundreihe', '6k1/5ppp/8/8/8/8/5PPP/r5K1 w - - 0 1', 'gegner') === 'matt');
pruefe('Ziel Umwandeln: neue Dame nach dem Gegenzug geschafft, geschlagene Dame ist remis, ohne Bauern gescheitert',
  zielVon('koenig-sechste', '4Q3/8/8/2k5/8/8/8/4K3 w - - 0 1', 'gegner') === 'geschafft'
  && zielVon('koenig-sechste', '8/8/8/2k5/8/8/8/4K3 w - - 0 1', 'gegner') === 'remis'
  && zielVon('durchbruch', '6k1/1pp5/8/8/8/8/8/6K1 b - - 0 1', 'flo') === 'bauerWeg'
  && zielVon('koenig-sechste', lektion('koenig-sechste').fen, 'flo', grenze(5)) === 'zuViele'
  && zielVon('koenig-sechste', lektion('koenig-sechste').fen, 'gegner') === null);
pruefe('Ziel Gewinnen: Gegner ohne Bauern und du mit Turm mehr geschafft, mit Bauer noch nicht',
  zielVon('lucena', '8/8/8/8/8/5k2/8/3KR3 w - - 0 1', 'gegner') === 'geschafft'
  && zielVon('dame-bauer', lektion('dame-bauer').fen, 'gegner') === null);
pruefe('Ziel Halten: Remis und geschlagener Bauer geschafft, Ziel-Zuege geschafft, Materialverlust gescheitert',
  zielVon('quadrat', '7k/8/8/8/8/8/8/K7 w - - 0 1', 'gegner') === 'geschafft'
  && zielVon('philidor', '8/8/8/8/4k3/R7/7r/3K4 w - - 0 1', 'gegner') === 'geschafft'
  && zielVon('philidor', lektion('philidor').fen, 'gegner', 12) === 'geschafft'
  && zielVon('philidor', lektion('philidor').fen, 'gegner', 11) === null
  && zielVon('philidor', '8/8/8/8/4k3/8/7r/2K1q3 b - - 0 1', 'flo') === 'verloren'
  && zielVon('randbauer', '8/8/8/8/8/6k1/7p/7K w - - 0 1', 'flo', 3) === 'geschafft');

// ---------------------------------------------------------------------------
// Browser-Teil (volle App, alle Pakete)
// ---------------------------------------------------------------------------
async function warteAufServer(url, ms = 10000) {
  const ende = Date.now() + ms;
  while (Date.now() < ende) {
    try { const r = await fetch(url); await r.arrayBuffer(); if (r.ok) return; } catch (e) { /* noch nicht da */ }
    await warte(150);
  }
  throw new Error('Server startet nicht: ' + url);
}
function ladePlaywright() {
  for (const k of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
    try { return require(k); } catch (e) { /* naechster */ }
  }
  throw new Error('Playwright nicht gefunden (PLAYWRIGHT_PFAD setzen)');
}

const SUPA = 'https://usaamcqypmvgqmsbfecb.supabase.co';
const UID = '0f8b6c1e-2d3a-4b5c-8d9e-0a1b2c3d4e5f';
const token = (sub) => 'a.' + Buffer.from(JSON.stringify({ sub })).toString('base64url') + '.x';
const SITZUNG = { access_token: token(UID), refresh_token: 'r1', expires_at: 9999999999, user: { id: UID, email: 'probe@example.invalid' } };
const ERFINDER_ZEILEN = ['erfinder-banner-blatt-0', 'erfinder-titel', 'erfinder-figuren-blaupause', 'erfinder-finisher-signatur']
  .map((stueck_id) => ({ stueck_id }));

async function seite(browser, { erfinder = true, merker = true, groesse = { width: 1180, height: 820 }, hash = '#training', gesehen = null, uhr = null } = {}) {
  const k = await browser.newContext({ viewport: groesse, serviceWorkers: 'block', timezoneId: 'Europe/Berlin' });
  const s = await k.newPage();
  const fehlerListe = [];
  s.on('pageerror', (e) => fehlerListe.push(e.message));
  s.on('console', (m) => { if (m.type() === 'error') fehlerListe.push(m.text()); });
  await s.route(SUPA + '/**', (r) => r.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify(r.request().url().includes('/rest/v1/sonderstuecke') && erfinder ? ERFINDER_ZEILEN : []) }));
  await s.addInitScript(({ sitzung, erfinder, merker, uid, gesehen }) => {
    try {
      if (sessionStorage.getItem('probe-start')) return;
      sessionStorage.setItem('probe-start', '1');
      localStorage.clear();
      localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(sitzung));
      if (erfinder && merker) localStorage.setItem('schach-arena:konto:sonderstuecke', JSON.stringify({ konto: uid, ids: ['erfinder-titel'] }));
      // Willkommenswoche: der Tag des ersten Willkommens als fester Schluessel, passend zur festen Uhr (uhr)
      if (gesehen) localStorage.setItem('schach-arena:v1:modul:start', JSON.stringify({ gesehen }));
    } catch (e) { /* egal */ }
  }, { sitzung: SITZUNG, erfinder, merker, uid: UID, gesehen });
  // feste Uhr: der App-Tag beginnt erst um 4:00 (js/tag.js), ein Lauf kurz nach Mitternacht darf nichts kippen
  if (uhr) await s.clock.setFixedTime(uhr);
  await s.goto(BASIS + hash);
  await s.waitForFunction(() => !!window.__app && !!document.documentElement.dataset.screen, null, { timeout: 30000 });
  await warte(600);
  return { k, s, fehlerListe };
}

const lz = (s) => s.evaluate(() => (window.__lektion ? window.__lektion.zustand() : { offen: false }));
async function warteLz(s, bedingung, ms = 10000) {
  await s.waitForFunction((b) => {
    const z = window.__lektion ? window.__lektion.zustand() : { offen: false };
    return new Function('z', 'return ' + b)(z);
  }, bedingung, { timeout: ms }).catch(() => {});
}
// R8: das Ergebnisblatt der Lektion steht (es kommt kurz nach dem letzten Zug, damit man ihn noch sieht)
const blattDa = (s) => s.waitForSelector('.ls-screen > .ergebnis-overlay:not([hidden]) .ergebnis-karte', { timeout: 8000 }).catch(() => {});
async function ziehe(s, uci) {
  for (const f of [uci.slice(0, 2), uci.slice(2, 4)]) {
    const b = await s.locator(`.ls-screen .brett-felder .feld[data-feld="${f}"]`).boundingBox();
    await s.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    await warte(90);
  }
}
// gefaelschte Verteidigung: der erste legale Zug (chess.js im Browser), damit der Test ohne Stockfish laeuft
const setzeVerteidigung = (s) => s.evaluate(async () => {
  const { Chess: C } = await import('/vendor/chess/chess.js');
  window.__test = window.__test || {};
  window.__test.lektionPause = 30;
  window.__test.lektionZug = (fen) => { const m = new C(fen).moves({ verbose: true })[0]; return m ? m.from + m.to + (m.promotion || '') : null; };
});

async function erfinderTeil(browser) {
  const p = await seite(browser);
  await p.s.waitForSelector('.ms-karte', { timeout: 15000 }).catch(() => {});
  const karte = await p.s.evaluate(() => {
    const k = document.querySelector('.ms-karte');
    return k && { text: k.innerText, erste: document.querySelector('.training-gitter > *')?.classList.contains('ms-karte') };
  });
  pruefe('Erfinder: Karte „Meisterschule · Mattbilder, Taktik, Endspiele, Eröffnungen“ im Training mit Labor-Schild, 0 von 195 Sternen, 65 Lektionen', !!karte
    && /Mattbilder, Taktik, Endspiele, Eröffnungen/.test(karte.text) && /Labor/i.test(karte.text) && /0 von 195 Sternen/.test(karte.text) && /65 Lektionen/.test(karte.text), karte);
  await p.s.locator('.ms-karte .ms-oeffnen').click();
  await p.s.waitForSelector('.ms-screen .ms-lektion', { timeout: 15000 }).catch(() => {});
  const liste = await p.s.evaluate(() => [...document.querySelectorAll('.ms-lektion')].map((b) => b.dataset.id).join());
  pruefe('Übersicht: Bereichswahl steht auf Mattbilder, 20 Lektionen in der Reihenfolge der Daten', liste === LEKTIONEN_IDS
    && await p.s.locator('.ms-bkarte[aria-pressed="true"]').getAttribute('data-bereich') === 'matt', liste);
  pruefe('Übersicht: kein waagrechtes Scrollen', await p.s.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  // Flo 01.11.2026 (iPad): "bei den Lektionen kann ich nicht nach unten scrollen": neben der 860-px-Spalte rollte nichts.
  // Am linken Rand gewischt (Mausrad) rollt die Liste jetzt bis ganz unten, die Spalte bleibt hoechstens 860 px
  // seit der Seitenleiste (Etappe A) beginnt der Rand des Screens rechts neben ihr
  await p.s.mouse.move(await p.s.evaluate(() => (document.querySelector('.reiter-leiste[data-lage="seite"]')?.getBoundingClientRect().right ?? 0) + 20), 600);
  await p.s.mouse.wheel(0, 4000);
  await warte(500);
  const rollen = await p.s.evaluate(() => { const r = document.querySelector('.ms-rumpf');
    return { st: Math.round(r.scrollTop), max: r.scrollHeight - r.clientHeight, breite: Math.round(Math.max(...[...r.children].map((c) => c.getBoundingClientRect().width))) }; });
  pruefe('Übersicht iPad quer: am Rand gewischt rollt die Liste bis ganz unten, Spalte höchstens 860 px', rollen.max > 0 && rollen.st >= rollen.max - 1 && rollen.breite <= 860, rollen);
  await p.s.evaluate(() => { document.querySelector('.ms-rumpf').scrollTop = 0; });

  // Flo 31.10.2026 abends: "wenn ich in der Meisterschule auf eine Lektion tippe, springt er auf die Bots". Laedt die
  // Lektions-Datei nicht (etwa mitten im Wechsel auf eine neue Version), laedt die App einmal neu und oeffnet die Lektion,
  // statt still zur Arena zu gehen. Hier scheitert der erste Abruf von js/ui/lektion.js absichtlich.
  let ersterAbruf = true;
  await p.s.route('**/js/ui/lektion.js', (r) => {
    if (ersterAbruf) { ersterAbruf = false; return r.fulfill({ status: 500, contentType: 'text/plain', body: 'kaputt' }); }
    return r.continue();
  });
  const neuGeladen = p.s.waitForEvent('load', { timeout: 20000 }).then(() => true, () => false);
  await p.s.locator('.ms-lektion[data-id="grundreihe"]').click();
  const nl = await neuGeladen;
  await p.s.waitForSelector('.ls-screen .brett-felder .feld', { timeout: 15000 }).catch(() => {});
  pruefe('Lektion laedt nicht: einmal neu laden, dann ist die Lektion offen (nicht die Arena)', nl && !ersterAbruf
    && await p.s.evaluate(() => document.documentElement.dataset.screen === 'lektion' && location.hash === '#lektion'),
    await p.s.evaluate(() => [document.documentElement.dataset.screen, location.hash].join()));
  await p.s.unroute('**/js/ui/lektion.js');
  // der absichtlich gescheiterte Abruf steht als Konsolenfehler in der Liste, er gehoert zur Pruefung
  for (let i = p.fehlerListe.length - 1; i >= 0; i--) if (/status of 500/.test(p.fehlerListe[i])) p.fehlerListe.splice(i, 1);
  await setzeVerteidigung(p.s);

  let z = await lz(p.s);
  pruefe('Lektion: beginnt mit der Idee (Phase intro), Titel und Ziel sichtbar', z.phase === 'intro'
    && /Grundreihenmatt/.test(await p.s.locator('.ls-status').innerText()) && /Matt in einem Zug ist möglich/.test(await p.s.locator('.ls-status').innerText()), z);
  await ziehe(p.s, 'a1a8');
  z = await lz(p.s);
  pruefe('Lektion: vor „Los geht’s“ nimmt das Brett keinen Zug an', z.phase === 'intro' && z.zuege === 0, z);
  await p.s.locator('.ls-aktionen [data-a="los"]').click();
  await warteLz(p.s, "z.phase === 'flo'");
  await ziehe(p.s, 'a1a8');
  await warteLz(p.s, "z.phase === 'ende'");
  z = await lz(p.s);
  pruefe('Grundreihe: Ta8 matt, ein Zug, drei Sterne', z.phase === 'ende' && z.zuege === 1 && z.sterne === 3 && !z.grund, z);
  // R8 (Gleichheit): das Ende ist das Ergebnisblatt der Bot-Partie (css/ergebnis.css), nicht mehr nur eine Meldung
  await blattDa(p.s);
  const lsBlatt = await p.s.evaluate(() => {
    const o = document.querySelector('.ls-screen > .ergebnis-overlay:not([hidden])');
    if (!o) return { da: false };
    const k = o.querySelector('.ergebnis-karte');
    return { da: true, sieg: o.classList.contains('sieg'), dialog: o.getAttribute('role') === 'dialog' && o.getAttribute('aria-modal') === 'true',
      wort: (o.querySelector('.erg-wort')?.textContent || '').trim(), sterne: o.querySelectorAll('.erg-sterne .erg-stern.an').length,
      haupt: [...o.querySelectorAll('.erg-knoepfe .knopf.primaer')].map((b) => b.dataset.a).join(),
      neben: [...o.querySelectorAll('.erg-knoepfe .knopf:not(.primaer)')].map((b) => b.dataset.a).join(),
      lobby: o.querySelector('.erg-lobby')?.dataset.a || null, fokus: !!k && k.contains(document.activeElement),
      inert: [...document.querySelector('.ls-screen').children].filter((e) => e !== o).every((e) => e.inert),
      breite: k ? Math.round(k.getBoundingClientRect().width) : 0,
      // R8 Texte: Weg "Zur Meisterschule" mit dem Haus der Bot-Partie (icons.js haus), Zeile aus Zuegen und Hinweisen
      lobbyText: (o.querySelector('.erg-lobby')?.textContent || '').trim(),
      haus: /M4 11\.5 12 5l8 6\.5/.test(o.querySelector('.erg-lobby svg')?.innerHTML || ''),
      zeile: (() => { const z = o.querySelector('.ls-erg-zeile'); if (!z) return null;
        return { text: z.textContent.trim(), eineZeile: z.scrollWidth <= z.clientWidth + 1 && z.getClientRects().length === 1 }; })() };
  });
  pruefe('Ergebnisblatt wie in der Bot-Partie: „Matt!“, drei Sterne, Hauptknopf „Nächste Lektion“, „Nochmal“, Weg zur Übersicht',
    lsBlatt.da && lsBlatt.sieg && lsBlatt.dialog && lsBlatt.wort === 'Matt!' && lsBlatt.sterne === 3 && lsBlatt.haupt === 'weiter'
    && lsBlatt.neben === 'nochmal' && lsBlatt.lobby === 'uebersicht' && lsBlatt.fokus && lsBlatt.inert, lsBlatt);
  pruefe('Ergebnisblatt: Weg „Zur Meisterschule“ mit dem Haus der Bot-Partie, unter den Sternen „In 1 Zug · ohne Hinweis“ in einer Zeile',
    lsBlatt.lobbyText === 'Zur Meisterschule' && lsBlatt.haus && !!lsBlatt.zeile && lsBlatt.zeile.text === 'In 1 Zug · ohne Hinweis' && lsBlatt.zeile.eineZeile, lsBlatt);
  // Auge zeigt das Brett, "Ergebnis" holt das Blatt zurueck (wie in der Bot-Partie)
  await p.s.locator('.ls-screen > .ergebnis-overlay .erg-zu').click();
  const brettSicht = await p.s.evaluate(() => ({ zu: document.querySelector('.ls-screen > .ergebnis-overlay')?.hidden === true,
    knopf: !!document.querySelector('.ls-aktionen [data-a="ergebnis"]'), meldung: document.querySelector('.ls-meldung[data-art="geschafft"]')?.hidden === false }));
  await p.s.locator('.ls-aktionen [data-a="ergebnis"]').click();
  await blattDa(p.s);
  pruefe('Ergebnisblatt: Auge zeigt das Brett mit Meldung, „Ergebnis“ holt das Blatt zurück', brettSicht.zu && brettSicht.knopf && brettSicht.meldung
    && await p.s.locator('.ls-screen > .ergebnis-overlay:not([hidden])').count() === 1, brettSicht);
  const gespeichert = await p.s.evaluate(() => JSON.parse(localStorage.getItem('schach-arena:v1:modul:lernen') || 'null'));
  pruefe('Speicher: Modul lernen hält 3 Sterne und 1 Zug', gespeichert && gespeichert.lek && gespeichert.lek.grundreihe
    && gespeichert.lek.grundreihe.s === 3 && gespeichert.lek.grundreihe.z === 1, gespeichert);

  // weiter zur naechsten Lektion, dann ueber die Uebersicht zur Dame
  await p.s.locator('.ergebnis-overlay [data-a="weiter"]').click();
  await warteLz(p.s, `z.id === '${LEKTIONEN[1].id}' && z.phase === 'intro'`);
  pruefe('„Nächste Lektion“ öffnet die zweite Lektion', (await lz(p.s)).id === LEKTIONEN[1].id);
  await p.s.evaluate(() => window.__app.gehe('lernen'));
  await p.s.waitForSelector('.ms-lektion[data-id="grundreihe"][data-geschafft]', { timeout: 10000 }).catch(() => {});
  pruefe('Übersicht: Grundreihe geschafft mit drei Sternen und „Dein Bestes: 1 Zug“', await p.s.evaluate(() => {
    const b = document.querySelector('.ms-lektion[data-id="grundreihe"]');
    return !!b && b.hasAttribute('data-geschafft') && b.querySelectorAll('.ms-sterne > i.an').length === 3 && /Dein Bestes: 1 Zug/.test(b.innerText);
  }));
  pruefe('Übersicht: Gesamt 3 von 60 Sternen', /^3\s*\/\s*60$/.test((await p.s.locator('.ms-bkarte[aria-pressed="true"] .ms-bk-sterne').innerText()).trim()));

  // Endspiele: Bereich wechseln, Quadratregel halten (die gefaelschte Verteidigung zieht den ersten legalen Zug, also den König)
  await setzeVerteidigung(p.s);
  await p.s.locator('.ms-bkarte[data-bereich="end"]').click();
  await p.s.waitForSelector('.ms-lektion[data-id="quadrat"]', { timeout: 8000 }).catch(() => {});
  const endListe = await p.s.evaluate(() => [...document.querySelectorAll('.ms-lektion')].map((b) => b.dataset.id).join());
  pruefe('Endspiele: Liste in der Reihenfolge der Daten, Art „Halten“ an der Quadratregel, eigene Sternzahl',
    endListe === ENDSPIELE.map((l) => l.id).join() && /Halten/.test(await p.s.locator('.ms-lektion[data-id="quadrat"]').innerText())
    && /^0\s*\/\s*39$/.test((await p.s.locator('.ms-bkarte[aria-pressed="true"] .ms-bk-sterne').innerText()).trim()), endListe);
  await p.s.locator('.ms-lektion[data-id="quadrat"]').click();
  await warteLz(p.s, "z.id === 'quadrat' && z.phase === 'intro'");
  const status = await p.s.locator('.ls-status').innerText();
  pruefe('Endspiel-Lektion: Titel, Art und Ziel „Halte 8 Züge durch“, Nummer im Bereich', /Die Quadratregel/.test(status)
    && /Halten/.test(status) && /Halte 8 Züge durch/.test(status) && /Lektion 4 von 13/.test(status), status);
  await p.s.locator('.ls-aktionen [data-a="los"]').click();
  for (const [i, u] of ['f4e4', 'e4d4', 'd4c4', 'c4b5', 'b5a5'].entries()) {
    await warteLz(p.s, `z.phase === 'flo' && z.zuege === ${i}`);
    await ziehe(p.s, u);
  }
  await warteLz(p.s, "z.phase === 'ende'");
  z = await lz(p.s);
  pruefe('Quadratregel: Bauer geschlagen, „Gehalten!“ mit drei Sternen', z.phase === 'ende' && !z.grund && z.sterne === 3
    && /Gehalten!/.test(await p.s.locator('.ls-meldung').innerText()), z);
  await blattDa(p.s);
  await p.s.locator('.ergebnis-overlay [data-a="uebersicht"]').click();
  await p.s.waitForSelector('.ms-lektion[data-id="quadrat"][data-geschafft]', { timeout: 10000 }).catch(() => {});
  pruefe('Zur Übersicht: zurück im Bereich Endspiele, Quadratregel „Gehalten“',
    await p.s.locator('.ms-bkarte[aria-pressed="true"]').getAttribute('data-bereich') === 'end'
    && /Gehalten/.test(await p.s.locator('.ms-lektion[data-id="quadrat"]').innerText()));
  // Taktik (31.10.2026): Springergabel mit Sc6+ und Sxa7, geschafft erst nach dem Gegenzug
  await p.s.locator('.ms-bkarte[data-bereich="taktik"]').click();
  await p.s.waitForSelector('.ms-lektion[data-id="gabel-springer"]', { timeout: 8000 }).catch(() => {});
  const taktikListe = await p.s.evaluate(() => [...document.querySelectorAll('.ms-lektion')].map((b) => b.dataset.id).join());
  pruefe('Taktik: Liste in der Reihenfolge der Daten, Art „Taktik“, 0 von 63 Sternen', taktikListe === TAKTIK.map((l) => l.id).join()
    && /Taktik/.test(await p.s.locator('.ms-lektion[data-id="gabel-springer"]').innerText())
    && /^0\s*\/\s*63$/.test((await p.s.locator('.ms-bkarte[aria-pressed="true"] .ms-bk-sterne').innerText()).trim()), taktikListe);
  await p.s.locator('.ms-lektion[data-id="gabel-springer"]').click();
  await warteLz(p.s, "z.id === 'gabel-springer' && z.phase === 'intro'");
  const tStatus = await p.s.locator('.ls-status').innerText();
  pruefe('Taktik-Lektion: Titel „Springergabel“, Ziel „Gewinne mindestens 5 Punkte in 2 Zügen“', /Springergabel/.test(tStatus)
    && /Gewinne mindestens 5 Punkte in 2 Zügen/.test(tStatus), tStatus);
  await p.s.locator('.ls-aktionen [data-a="los"]').click();
  for (const [i, u] of ['d4c6', 'c6a7'].entries()) {
    await warteLz(p.s, `z.phase === 'flo' && z.zuege === ${i}`);
    await ziehe(p.s, u);
  }
  await warteLz(p.s, "z.phase === 'ende'");
  z = await lz(p.s);
  pruefe('Springergabel: Dame gewonnen, „Material gewonnen!“ mit drei Sternen', z.phase === 'ende' && !z.grund && z.sterne === 3
    && /Material gewonnen!/.test(await p.s.locator('.ls-meldung').innerText()), z);
  await p.s.evaluate(() => window.__app.gehe('lernen'));
  await p.s.waitForSelector('.ms-lektion[data-id="grundreihe"]', { timeout: 10000 }).catch(() => {});

  await setzeVerteidigung(p.s);
  await p.s.locator('.ms-lektion[data-id="dame"]').click();
  await warteLz(p.s, "z.id === 'dame' && z.phase === 'intro'");
  await p.s.locator('.ls-aktionen [data-a="los"]').click();
  await warteLz(p.s, "z.phase === 'flo'");
  await p.s.locator('.ls-aktionen [data-a="hinweis"]').click();
  await p.s.waitForSelector('.ls-meldung[data-art="hinweis"]', { timeout: 8000 }).catch(() => {});
  z = await lz(p.s);
  pruefe('Hinweis: Pfeil und Satz „höchstens 2 Sterne“, zählt mit', z.hinweise === 1
    && /höchstens 2 Sterne/.test(await p.s.locator('.ls-meldung').innerText()), z);
  await ziehe(p.s, 'd1d7');
  await warteLz(p.s, "z.phase === 'flo' && z.zuege === 1");
  z = await lz(p.s);
  pruefe('Dame: nach Flos Zug antwortet die Verteidigung, dann ist Flo wieder dran', z.phase === 'flo' && z.zuege === 1
    && new Chess(z.fen).turn() === 'w', z);
  pruefe('Zähler zeigt „Zug 1“', /Zug 1/.test(await p.s.locator('.ls-zug').innerText()));
  await p.s.locator('.ls-aktionen [data-a="neu"]').click();
  await warteLz(p.s, "z.phase === 'flo' && z.zuege === 0 && z.hinweise === 0");
  z = await lz(p.s);
  pruefe('Neu starten: Ausgangsstellung, Zähler und Hinweise auf null', z.zuege === 0 && z.hinweise === 0 && z.fen === lektion('dame').fen, z);
  // Eroeffnungen: Italienisch mit Weiss (ein falscher Zug zweimal, dann Pfeil), Skandinavisch mit Schwarz (Brett gedreht)
  await p.s.evaluate(() => window.__app.gehe('lernen'));
  await p.s.waitForSelector('.ms-bkarte[data-bereich="eroeffnung"]', { timeout: 10000 }).catch(() => {});
  await p.s.locator('.ms-bkarte[data-bereich="eroeffnung"]').click();
  await p.s.waitForSelector('.ms-lektion[data-id="italienisch"]', { timeout: 8000 }).catch(() => {});
  pruefe('Eröffnungen: Liste in der Reihenfolge der Daten, Art „Zugfolge“, 0 von 33 Sternen', await p.s.evaluate(() =>
    [...document.querySelectorAll('.ms-lektion')].map((b) => b.dataset.id).join()) === EROEFFNUNGEN.map((l) => l.id).join()
    && /Zugfolge/.test(await p.s.locator('.ms-lektion[data-id="italienisch"]').innerText()) && /^0\s*\/\s*33$/.test((await p.s.locator('.ms-bkarte[aria-pressed="true"] .ms-bk-sterne').innerText()).trim()));
  await p.s.locator('.ms-lektion[data-id="italienisch"]').click();
  await warteLz(p.s, "z.id === 'italienisch' && z.phase === 'intro'");
  pruefe('Eröffnung: Titel, Ziel „Spiel die 5 Züge der Eröffnung“', /Italienische Partie/.test(await p.s.locator('.ls-status').innerText())
    && /Spiel die 5 Züge der Eröffnung/.test(await p.s.locator('.ls-status').innerText()));
  await p.s.locator('.ls-aktionen [data-a="los"]').click();
  await warteLz(p.s, "z.phase === 'flo'");
  await ziehe(p.s, 'e2e4');
  await warteLz(p.s, "z.phase === 'flo' && z.schritt === 2");
  z = await lz(p.s);
  pruefe('Eröffnung: nach e4 antwortet der Computer mit e5, Satz zum Zug erscheint', z.schritt === 2 && /4p3\/4P3/.test(z.fen)
    && /Zentrum/.test(await p.s.locator('.ls-meldung').innerText()), z);
  await ziehe(p.s, 'd2d4');
  await p.s.waitForSelector('.ls-meldung[data-art="fehler"]', { timeout: 5000 }).catch(() => {});
  z = await lz(p.s);
  pruefe('Eröffnung: d4 statt Sf3 springt zurück, zählt als Fehler, „Nicht der Zug dieser Eröffnung“', z.fehler === 1 && z.schritt === 2
    && /Nicht der Zug dieser Eröffnung/.test(await p.s.locator('.ls-meldung').innerText()) && !/3P4/.test(z.fen.split(' ')[0].split('/')[4]), z);
  await ziehe(p.s, 'd2d4');
  await p.s.waitForSelector('.ls-meldung[data-art="hinweis"]', { timeout: 5000 }).catch(() => {});
  pruefe('Eröffnung: zweiter Fehler am selben Zug zeigt „Hier kommt Sf3“ mit Pfeil', /Hier kommt Sf3/.test(await p.s.locator('.ls-meldung').innerText())
    && await p.s.locator('.ls-screen .brett-pfeile .pfeil').count() >= 1);
  for (const [i, u] of ['g1f3', 'f1c4', 'c2c3', 'd2d4'].entries()) {
    await warteLz(p.s, `z.phase === 'flo' && z.zuege === ${i + 1}`);
    await ziehe(p.s, u);
  }
  await warteLz(p.s, "z.phase === 'ende'");
  z = await lz(p.s);
  pruefe('Eröffnung: ganze Folge gespielt, „Eröffnung sitzt!“, 2 Fehler ergeben 2 Sterne', z.phase === 'ende' && z.zuege === 5 && z.sterne === 2
    && /Eröffnung sitzt!/.test(await p.s.locator('.ls-meldung').innerText()), z);
  await p.s.evaluate(() => window.__app.gehe('lektion', { id: 'skandinavisch' }));
  await warteLz(p.s, "z.id === 'skandinavisch' && z.phase === 'intro'");
  pruefe('Eröffnung mit Schwarz: Brett gedreht', await p.s.locator('.ls-brett').getAttribute('data-ausrichtung') === 'b');
  await p.s.locator('.ls-aktionen [data-a="los"]').click();
  await warteLz(p.s, "z.phase === 'flo' && z.schritt === 1");
  z = await lz(p.s);
  pruefe('Eröffnung mit Schwarz: der Computer eröffnet mit e4, dann ist Flo dran', z.schritt === 1 && new Chess(z.fen).turn() === 'b', z);
  for (const [i, u] of ['d7d5', 'd8d5', 'd5a5', 'g8f6'].entries()) {
    await warteLz(p.s, `z.phase === 'flo' && z.zuege === ${i}`);
    await ziehe(p.s, u);
  }
  await warteLz(p.s, "z.phase === 'ende'");
  z = await lz(p.s);
  pruefe('Eröffnung mit Schwarz: ohne Fehler drei Sterne, „Ohne einen einzigen Fehler“', z.phase === 'ende' && z.sterne === 3 && z.fehler === 0
    && /Ohne einen einzigen Fehler/.test(await p.s.locator('.ls-meldung').innerText()), z);
  // "Zeig sie mir" (Flo 31.10.: "bei den Eroeffnungen muss man immer auf Hinweis klicken?"): Pfeil und Grund vor jedem Zug
  await p.s.evaluate(() => window.__app.gehe('lektion', { id: 'schottisch' }));
  await warteLz(p.s, "z.id === 'schottisch' && z.phase === 'intro'");
  pruefe('Zeig sie mir: neue Eröffnung bietet „Zeig sie mir“ (vorgewählt) und „Selbst spielen“',
    await p.s.locator('.ls-aktionen [data-a="zeigen"].primaer').count() === 1 && /Zeig sie mir/.test(await p.s.locator('.ls-aktionen').innerText())
    && /Selbst spielen/.test(await p.s.locator('.ls-aktionen').innerText()));
  await p.s.locator('.ls-aktionen [data-a="zeigen"]').click();
  await warteLz(p.s, "z.phase === 'flo' && z.modus === 'zeigen'");
  pruefe('Zeig sie mir: vor dem ersten Zug Pfeil, „Spiele e4“ und der Grund, kein Hinweis-Knopf',
    await p.s.locator('.ls-screen .brett-pfeile .pfeil').count() >= 1 && /Spiele e4/.test(await p.s.locator('.ls-meldung').innerText())
    && /Zentrum/.test(await p.s.locator('.ls-meldung').innerText()) && await p.s.locator('.ls-aktionen [data-a="hinweis"]').count() === 0);
  await ziehe(p.s, 'd2d4');
  await p.s.waitForSelector('.ls-meldung[data-art="fehler"]', { timeout: 5000 }).catch(() => {});
  z = await lz(p.s);
  pruefe('Zeig sie mir: anderer Zug springt zurück, Pfeil bleibt', z.schritt === 0 && /Hier kommt e4/.test(await p.s.locator('.ls-meldung').innerText())
    && await p.s.locator('.ls-screen .brett-pfeile .pfeil').count() >= 1, z);
  for (const [i, u] of ['e2e4', 'g1f3', 'd2d4', 'f3d4'].entries()) {
    await warteLz(p.s, `z.phase === 'flo' && z.zuege === ${i}`);
    if (i === 1) pruefe('Zeig sie mir: nach der Antwort des Computers kommt der nächste Pfeil, „Spiele Sf3“',
      /Spiele Sf3/.test(await p.s.locator('.ls-meldung').innerText()) && await p.s.locator('.ls-screen .brett-pfeile .pfeil').count() >= 1);
    await ziehe(p.s, u);
  }
  await warteLz(p.s, "z.phase === 'ende'");
  z = await lz(p.s);
  await blattDa(p.s);
  pruefe('Zeig sie mir: geschafft mit einem Stern, „Züge gelernt!“, weiter mit „Ohne Hilfe spielen“', z.sterne === 1
    && /Züge gelernt!/.test(await p.s.locator('.ls-meldung').innerText()) && /Ohne Hilfe spielen/.test(await p.s.locator('.ergebnis-overlay [data-a="los"].primaer').innerText())
    && await p.s.locator('.ergebnis-overlay .erg-stern.an').count() === 1, z);
  // R8 Texte: bei Eroeffnungen zaehlen auch die Fehler (sterneFolge), deshalb stehen sie mit in der Zeile
  const folgeZeile = (await p.s.locator('.ergebnis-overlay .ls-erg-zeile').textContent().catch(() => '')).trim();
  pruefe('Zeig sie mir: Zeile unter dem Stern „In 4 Zügen · 1 Fehler · ohne Hinweis“', folgeZeile === 'In 4 Zügen · 1 Fehler · ohne Hinweis', { folgeZeile, z });
  await p.s.locator('.ergebnis-overlay [data-a="los"]').click();
  await warteLz(p.s, "z.phase === 'flo' && z.modus === 'selbst'");
  pruefe('Ohne Hilfe: kein Pfeil, Hinweis-Knopf wieder da', await p.s.locator('.ls-screen .brett-pfeile .pfeil').count() === 0
    && await p.s.locator('.ls-aktionen [data-a="hinweis"]').count() === 1);
  pruefe('Erfinder: keine Seitenfehler', p.fehlerListe.length === 0, p.fehlerListe.join(' | '));
  await p.k.close();

  // Handy: Uebersicht und Lektion passen, unbekannte Lektion fuehrt zur Uebersicht
  const q = await seite(browser, { groesse: { width: 390, height: 844 }, hash: '#lernen' });
  await q.s.waitForSelector('.ms-lektion', { timeout: 15000 }).catch(() => {});
  pruefe('Handy: Übersicht ohne waagrechtes Scrollen', await q.s.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  // Auswahl W1 C (Flo 09.11.2026): Satz zum Bereich und Hauptknopf zur ersten offenen Lektion ohne Ergebnis, ueber der Liste
  const w1 = await q.s.evaluate(() => {
    const k = document.querySelector('.ms-weiter-knopf');
    const satz = document.querySelector('.ms-kurz');
    const erste = [...document.querySelectorAll('.ms-lektion')].find((b) => !b.hasAttribute('data-geschafft') && !b.hasAttribute('data-gesperrt'));
    const liste = document.querySelector('.ms-gruppe');
    if (!k || !satz || !erste || !liste) return { fehlt: true };
    const r = k.getBoundingClientRect();
    return { text: k.textContent, id: k.dataset.id, erste: erste.dataset.id, satz: satz.textContent, h: r.height, b: r.bottom, liste: liste.getBoundingClientRect().top, ih: innerHeight };
  });
  pruefe('Handy: Satz und „Weiter mit: …“ zur ersten offenen Lektion, über der Liste, mindestens 44 px hoch', !w1.fehlt && /^Weiter mit: \S/.test(w1.text)
    && w1.id === w1.erste && w1.satz.length > 0 && w1.h >= 44 && w1.b <= w1.liste && w1.b <= w1.ih, w1);
  await q.s.locator('.ms-weiter-knopf').click();
  await q.s.waitForSelector('.ls-screen', { timeout: 10000 }).catch(() => {});
  pruefe('Handy: „Weiter mit“ öffnet die Lektion', await q.s.evaluate((id) => !!document.querySelector('.ls-screen') && location.hash.includes('lektion'), w1.id));
  await q.s.evaluate(() => window.__app.gehe('lektion', { id: 'turm' }));
  await q.s.waitForSelector('.ls-screen .brett-felder .feld', { timeout: 15000 }).catch(() => {});
  pruefe('Handy: Lektion ohne waagrechtes Scrollen, Knöpfe mindestens 44 px hoch', await q.s.evaluate(() => {
    const k = [...document.querySelectorAll('.ls-aktionen .knopf')];
    return document.documentElement.scrollWidth <= window.innerWidth + 1 && k.length > 0 && k.every((x) => x.getBoundingClientRect().height >= 44);
  }));
  await q.s.evaluate(() => window.__app.gehe('lektion', { id: 'gibtsnicht' }));
  await q.s.waitForSelector('.ms-screen', { timeout: 10000 }).catch(() => {});
  pruefe('Unbekannte Lektion führt zur Übersicht', await q.s.locator('.ms-screen').count() === 1);
  await q.s.setViewportSize({ width: 1280, height: 800 });
  pruefe('PC: kein „Weiter mit“, dort steht der Seitenkopf', await q.s.evaluate(() => {
    const w = document.querySelector('.ms-weiter');
    return !!w && getComputedStyle(w).display === 'none' && document.querySelector('.ms-bereich .seiten-kopf').getBoundingClientRect().width > 1;
  }));
  pruefe('Handy: keine Seitenfehler', q.fehlerListe.length === 0, q.fehlerListe.join(' | '));
  await q.k.close();
}

// Gratis-Spieler (07.11.2026, FAHRPLAN Abschnitt 6): angemeldet, kein Erfinder, kein Abo. Leichte Lektionen und je eine
// Probe offen, der Rest mit Schloss; ein Tipp aufs Schloss zeigt den Trainer-Hinweis, ein direkter Aufruf fuehrt zurueck
async function gratisTeil(browser) {
  const p = await seite(browser, { erfinder: false });
  await p.s.waitForSelector('.ms-karte', { timeout: 15000 }).catch(() => {});
  const karte = await p.s.evaluate(() => document.querySelector('.ms-karte')?.innerText || '');
  pruefe('Gratis: Meisterschule-Karte im Training, ohne Labor-Schild, „30 davon sind gratis“', /30 davon sind gratis/.test(karte) && !/Labor/i.test(karte), karte);
  await p.s.locator('.ms-karte .ms-oeffnen').click();
  await p.s.waitForSelector('.ms-screen .ms-lektion', { timeout: 15000 }).catch(() => {});
  const r = await p.s.evaluate(() => ({
    gesperrt: [...document.querySelectorAll('.ms-lektion[data-gesperrt]')].map((b) => b.dataset.id),
    probe: document.querySelector('.ms-lektion[data-id="erstickt"]')?.innerText || '',
    probeOffen: !document.querySelector('.ms-lektion[data-id="erstickt"]')?.hasAttribute('data-gesperrt'),
    schloss: document.querySelectorAll('.ms-lektion[data-gesperrt] .ms-schloss').length,
    kopf: document.querySelector('.ms-kopf-sterne')?.innerText || '',
    karten: document.querySelectorAll('.ms-bkarte').length,
    gruppen: [...document.querySelectorAll('.ms-gruppe > h2')].map((h) => h.textContent).join('|'),
  }));
  pruefe('Gratis: Mattbilder mit 13 Schlössern (20 minus 6 leicht minus Probe), Probe „Ersticktes Matt“ offen mit Marke',
    r.gesperrt.length === 13 && r.schloss === 13 && !r.gesperrt.includes('grundreihe') && r.probeOffen && /Gratis-Probe/.test(r.probe), r);
  pruefe('Gratis: Kopf zeigt die Sterne der Meisterschule (0 / 195), vier Bereichskarten, Gruppen nach Stufe',
    /0\s*\/\s*195/.test(r.kopf) && r.karten === 4 && /Leicht · gratis\|Mittel\|Schwer und Meister/.test(r.gruppen), r);
  await p.s.locator('.ms-lektion[data-id="anderssen"]').click();
  await p.s.waitForSelector('.ms-liste .premium-hinweis', { timeout: 5000 }).catch(() => {});
  pruefe('Gratis: Tipp aufs Schloss zeigt den Trainer-Hinweis unter der Zeile, keine Lektion',
    await p.s.locator('.ms-lektion[data-id="anderssen"] + .premium-hinweis').count() === 1
    && await p.s.evaluate(() => document.documentElement.dataset.screen === 'lernen'));
  await p.s.evaluate(() => window.__app.gehe('lektion', { id: 'philidor' }));
  await p.s.waitForSelector('.ms-bkarte[data-bereich="end"][aria-pressed="true"]', { timeout: 10000 }).catch(() => {});
  pruefe('Gratis: gesperrte Lektion per Aufruf führt zur Übersicht im selben Bereich, kein Brett',
    await p.s.locator('.ls-screen .brett').count() === 0 && await p.s.locator('.ms-bkarte[data-bereich="end"][aria-pressed="true"]').count() === 1);
  // letzte leichte Eroeffnung: "Weiter" fuehrt zur Probe, daneben "Naechste Lektion im Trainer"
  await p.s.evaluate(() => window.__app.gehe('lektion', { id: 'skandinavisch' }));
  await warteLz(p.s, "z.id === 'skandinavisch' && z.phase === 'intro'");
  await setzeVerteidigung(p.s);
  await p.s.locator('.ls-aktionen [data-a="los"]').click();
  for (const [i, u] of ['d7d5', 'd8d5', 'd5a5', 'g8f6'].entries()) {
    await warteLz(p.s, `z.phase === 'flo' && z.zuege === ${i}`);
    await ziehe(p.s, u);
  }
  await warteLz(p.s, "z.phase === 'ende'");
  await blattDa(p.s);
  pruefe('Gratis: nach der letzten leichten Lektion „Weiter“ und „Nächste Lektion im Trainer“, kein Werbetext in der Meldung',
    await p.s.locator('.ergebnis-overlay [data-a="weiter"]').count() === 1 && /Nächste Lektion im Trainer/.test(await p.s.locator('.ergebnis-overlay [data-a="trainer"]').innerText())
    && await p.s.locator('.ls-screen .premium-hinweis').count() === 0);
  await p.s.locator('.ergebnis-overlay [data-a="weiter"]').click();
  await warteLz(p.s, "z.id === 'legal-falle'");
  pruefe('Gratis: „Weiter“ springt zur Gratis-Probe Legal-Falle', (await lz(p.s)).id === 'legal-falle');
  pruefe('Gratis: keine Seitenfehler', p.fehlerListe.length === 0, p.fehlerListe.join(' | '));
  await p.k.close();
}

// Willkommenswoche (07.11.2026): ein neuer Spieler (erstes Willkommen heute) spielt eine Woche lang alles, die
// Trainer-Lektionen tragen weiter ihre Marke; zehn Tage spaeter sind die Schloesser zurueck und die Zeile weg.
// Feste Uhr (09.11.2026): am 08.11. kurz nach Mitternacht lief der Test mit dem Kalenderdatum rot, obwohl die App
// vor 4:00 noch den Vortag zaehlt und den Willkommenstag selbst genauso schreibt.
const MITTAG = new Date('2026-11-09T12:00:00+01:00');
async function willkommenTeil(browser) {
  const p = await seite(browser, { erfinder: false, gesehen: '2026-11-09', hash: '#lernen', uhr: MITTAG });
  await p.s.waitForSelector('.ms-screen .ms-lektion', { timeout: 15000 }).catch(() => {});
  const r = await p.s.evaluate(() => ({
    zeile: document.querySelector('.ms-bereiche + .ms-willkommen')?.innerText || '',
    gesperrt: document.querySelectorAll('.ms-lektion[data-gesperrt]').length,
    trainer: document.querySelectorAll('.ms-lektion .ms-marke[data-marke="trainer"]').length,
    anderssen: document.querySelector('.ms-lektion[data-id="anderssen"] .ms-sterne') != null,
  }));
  pruefe('Willkommenswoche: Zeile mit Datum unter den Bereichskarten, keine Schlösser, Marke „Trainer“ bleibt (13 Mattbilder)',
    /Willkommenswoche: Bis .+ ist alles offen/.test(r.zeile) && r.gesperrt === 0 && r.trainer === 13 && r.anderssen, r);
  await p.s.locator('.ms-lektion[data-id="anderssen"]').click();
  await warteLz(p.s, "z.id === 'anderssen'");
  pruefe('Willkommenswoche: eine Trainer-Lektion startet', (await lz(p.s)).id === 'anderssen'
    && await p.s.locator('.ls-screen .brett').count() === 1);
  pruefe('Willkommenswoche: keine Seitenfehler', p.fehlerListe.length === 0, p.fehlerListe.join(' | '));
  await p.k.close();

  const q = await seite(browser, { erfinder: false, gesehen: '2026-10-30', hash: '#lernen', uhr: MITTAG });
  await q.s.waitForSelector('.ms-screen .ms-lektion', { timeout: 15000 }).catch(() => {});
  const r2 = await q.s.evaluate(() => ({ zeile: document.querySelectorAll('.ms-willkommen').length,
    gesperrt: document.querySelectorAll('.ms-lektion[data-gesperrt]').length }));
  pruefe('Nach der Woche: Schlösser zurück (13 Mattbilder), keine Willkommenszeile', r2.zeile === 0 && r2.gesperrt === 13, r2);
  await q.k.close();

  // Nachtfall: 09.11. um 00:53 ist fuer die App noch der 08.11.; ein an diesem App-Tag geschriebenes Willkommen oeffnet die Woche
  const n = await seite(browser, { erfinder: false, gesehen: '2026-11-08', hash: '#lernen', uhr: new Date('2026-11-09T00:53:00+01:00') });
  await n.s.waitForSelector('.ms-screen .ms-lektion', { timeout: 15000 }).catch(() => {});
  const r3 = await n.s.evaluate(() => ({ zeile: document.querySelector('.ms-bereiche + .ms-willkommen')?.innerText || '',
    gesperrt: document.querySelectorAll('.ms-lektion[data-gesperrt]').length }));
  pruefe('Willkommenswoche nach Mitternacht (vor 4 Uhr zählt der Vortag): Zeile da, keine Schlösser',
    /Willkommenswoche: Bis .+ ist alles offen/.test(r3.zeile) && r3.gesperrt === 0, r3);
  await n.k.close();
}

// Flo 31.10.2026 abends ("beim Handy habe ich die Lektionen immer noch nicht"): auf einem neuen Geraet angemeldet, noch
// keine Server-Antwort im Merker. Die App fragt beim Start nach; das Training zeigt die Meisterschule, ohne dass erst die
// Sammlung offen war.
async function neuesGeraetTeil(browser) {
  const p = await seite(browser, { erfinder: true, merker: false, groesse: { width: 393, height: 660 } });
  await p.s.waitForSelector('.ms-karte', { timeout: 10000 }).catch(() => {});
  const r = await p.s.evaluate(() => ({ karte: document.querySelectorAll('.ms-karte').length, screen: document.documentElement.dataset.screen,
    merker: localStorage.getItem('schach-arena:konto:sonderstuecke') }));
  pruefe('Neues Gerät, angemeldet: Training zeigt die Meisterschule ohne Umweg über die Sammlung', r.karte === 1 && r.screen === 'training'
    && /erfinder-titel/.test(r.merker || ''), r);
  pruefe('Neues Gerät: keine Seitenfehler', p.fehlerListe.length === 0, p.fehlerListe.join(' | '));
  await p.k.close();
}

// R6-Befund B9 (12.11.2026): auf dem iPhone SE lag "Los geht's" halb unter dem Rand (+45 px). Die Haupthandlung der
// Idee-Phase steht in JEDER Lektion ganz im Bild, auf SE (375x667) und iPhone 13 (390x844), hell und dunkel, ohne Scrollen.
async function kleinTeil(browser) {
  for (const [geraet, groesse] of [['SE', { width: 375, height: 667 }], ['i13', { width: 390, height: 844 }]]) {
    const p = await seite(browser, { groesse, hash: '#lernen' });
    const schlecht = [];
    let schlimmste = null;
    for (const [i, l] of ALLE.entries()) {
      if (i % 2 === 0) await p.s.evaluate((modus) => window.__app.setzeEinstellungen({ modus }), i % 4 === 0 ? 'hell' : 'dunkel');
      await p.s.evaluate((id) => window.__app.gehe('lektion', { id }), l.id);
      await warteLz(p.s, `z.id === '${l.id}' && z.phase === 'intro'`);
      await p.s.waitForSelector('.ls-screen .ls-aktionen .knopf', { timeout: 10000 }).catch(() => {});
      // gemessen wird der Ruhezustand: der Screen gleitet beim Oeffnen kurz herein
      await p.s.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'
        || a.effect?.getComputedTiming().iterations === Infinity), null, { timeout: 3000 }).catch(() => {});
      const m = await p.s.evaluate(() => {
        const k = [...document.querySelectorAll('.ls-screen .ls-aktionen .knopf')];
        const los = document.querySelector('.ls-screen .ls-aktionen [data-a="los"]');
        const r = los ? los.getBoundingClientRect() : null;
        return { n: k.length, los: r ? { top: Math.round(r.top), bottom: Math.round(r.bottom) } : null, ih: innerHeight,
          alle: k.every((x) => { const b = x.getBoundingClientRect(); return b.top >= 0 && b.bottom <= innerHeight && b.height >= 44; }),
          quer: document.documentElement.scrollWidth <= innerWidth + 1,
          // R8 (13.11.2026): die stehende Leiste legt kein Band in Seitenfarbe ueber die Karte (sonst Kante und Farbsprung
          // mitten in der weissen bzw. dunklen Karte, Bilder R8): weder eigener Grund noch Verlauf davor
          band: (() => { const a = document.querySelector('.ls-screen .ls-aktionen'); if (!a) return 'fehlt';
            const leer = (c) => c === 'transparent' || /rgba\([^)]*,\s*0\)$/.test(c);
            const vor = getComputedStyle(a, '::before');
            return leer(getComputedStyle(a).backgroundColor) && getComputedStyle(a).backgroundImage === 'none'
              && (vor.content === 'none' || vor.content === 'normal' || vor.backgroundImage === 'none') ? '' : 'band'; })(),
          // R8 L4 (13.11.2026): die Leiste verdeckt nichts. Karte und Meldung enden ueber ihr, und die Flaeche rollt nicht
          // (sonst laege Inhalt unter dem Rand oder hinter der Leiste)
          verdeckt: (() => { const a = document.querySelector('.ls-screen .ls-aktionen'); const rumpf = document.querySelector('.ls-screen .ls-rumpf');
            if (!a || !rumpf) return 'fehlt';
            const oben = a.getBoundingClientRect().top;
            const zu = [...document.querySelectorAll('.ls-screen .ls-seite > :not(.ls-aktionen)')].filter((e) => !e.hidden && e.getClientRects().length)
              .filter((e) => e.getBoundingClientRect().bottom > oben + 1).map((e) => e.className.split(' ')[0]);
            if (rumpf.scrollHeight > rumpf.clientHeight + 1) zu.push('rumpf-rollt:' + (rumpf.scrollHeight - rumpf.clientHeight));
            return zu.join(','); })() };
      });
      const ueber = m.los ? m.los.bottom - m.ih : 999;
      if (!schlimmste || ueber > schlimmste.ueber) schlimmste = { id: l.id, ueber };
      if (!m.los || m.los.bottom > m.ih || m.los.top < 0 || !m.alle || !m.quer || m.band || m.verdeckt) schlecht.push(`${l.id}:${ueber}${m.band ? ':' + m.band : ''}${m.verdeckt ? ':' + m.verdeckt : ''}`);
    }
    pruefe(`${geraet}: „Los geht's“ (und jeder Knopf der Idee-Phase) in allen ${ALLE.length} Lektionen ganz im Bild, ohne Band, ohne verdeckten Inhalt (B9, R8)`, schlecht.length === 0,
      { schlecht: schlecht.join(' '), schlimmste });
    if (process.env.BILDER && schlimmste) {
      for (const modus of ['hell', 'dunkel']) {
        await p.s.evaluate((m) => window.__app.setzeEinstellungen({ modus: m }), modus);
        await p.s.evaluate((id) => window.__app.gehe('lektion', { id }), schlimmste.id);
        await warteLz(p.s, `z.id === '${schlimmste.id}' && z.phase === 'intro'`);
        await warte(400);
        await p.s.screenshot({ path: path.join(process.env.BILDER, `lektion-${geraet}-${modus}.png`) });
      }
    }
    pruefe(`${geraet}: keine Seitenfehler (B9)`, p.fehlerListe.length === 0, p.fehlerListe.join(' | '));
    await p.k.close();
  }
}

const LEKTIONEN_IDS = LEKTIONEN.map((l) => l.id).join();

// R9 (13.11.2026, Befund 1 der Gleichheits-Messung): das Lektions-Brett ist auf jeder Groesse mindestens so gross wie in
// der Bot-Partie (gemessen wie tests/gleichheit-ansichten.test.mjs ueber tests/gleichheit-messung.mjs: Feldraster, Bot nach
// dem Intro, Lektion nach "Los geht's"), und nichts laeuft ueber oder scrollt. Am PC 1280 x 800 waren es 686 gegen 718 px.
const BRETT_GROESSEN = [['PC 1280x800', 1280, 800], ['PC 1440x900', 1440, 900], ['PC 1920x1080', 1920, 1080], ['iPad quer', 1180, 820],
  ['PC 1280x720', 1280, 720], ['iPhone 13', 390, 664], ['iPhone SE', 375, 667]];
async function brettGroesseTeil(browser) {
  const { messeAnsicht, introWeg } = await import('./gleichheit-messung.mjs');
  for (const [name, width, height] of BRETT_GROESSEN) {
    const p = await seite(browser, { groesse: { width, height } });
    await p.s.evaluate(() => window.__app.gehe('partie', { botId: 'benno' }));
    await p.s.waitForFunction(() => window.__partie?.bereit && document.querySelector('.brett-rahmen > .brett .feld'), null, { timeout: 30000 }).catch(() => {});
    await introWeg(p.s); await warte(1200);
    const bot = await messeAnsicht(p.s, '.screen.partie');
    await p.s.evaluate(() => window.__app.gehe('lektion', { id: 'grundreihe' }));
    await warteLz(p.s, "z.id === 'grundreihe' && z.phase === 'intro'");
    await p.s.locator('.ls-aktionen [data-a="los"]').click();
    await warteLz(p.s, "z.phase === 'flo'");
    await warte(600);
    const ls = await messeAnsicht(p.s, '.ls-screen');
    const platz = await p.s.evaluate(() => {
      const r = document.querySelector('.ls-screen .ls-rumpf'), d = document.documentElement;
      const unten = Math.max(...[...document.querySelectorAll('.ls-screen .ls-rahmen, .ls-screen .ls-seite')].map((e) => e.getBoundingClientRect().bottom));
      return { rumpfRollt: r ? r.scrollHeight - r.clientHeight : null, seiteRollt: d.scrollHeight - innerHeight, quer: d.scrollWidth - innerWidth,
        unten: Math.round(unten), hoehe: innerHeight };
    });
    pruefe(`Brettgröße ${name}: Lektion mindestens so groß wie die Bot-Partie (Feldraster), ohne Überlauf und ohne Scrollen`,
      !bot.fehlt && !ls.fehlt && ls.brett >= bot.brett - 2 && platz.rumpfRollt <= 1 && platz.seiteRollt <= 1 && platz.quer <= 1 && platz.unten <= platz.hoehe + 1,
      { lektion: ls.brett ?? ls.fehlt, bot: bot.brett ?? bot.fehlt, ...platz });
    await p.k.close();
  }
}

// R9-2 (Layout-Messung 13.11.2026): vor dem Start blieb unter "Los geht's" eine Leere bis zum Rand, iPhone 13 146 px,
// iPad hoch 76 px. Wie in der Bot-Partie sitzen die Knoepfe unten fuer den Daumen; hoechstens 60 px bleiben frei.
const LEERE_GROESSEN = [['iPhone 13', 390, 844], ['iPad hoch', 820, 1180], ['iPhone SE', 375, 667]];
async function leereTeil(browser) {
  for (const [name, width, height] of LEERE_GROESSEN) {
    const p = await seite(browser, { groesse: { width, height } });
    await p.s.evaluate(() => window.__app.gehe('lektion', { id: 'grundreihe' }));
    await warteLz(p.s, "z.id === 'grundreihe' && z.phase === 'intro'");
    await warte(600);
    const m = await p.s.evaluate(() => {
      const los = document.querySelector('.ls-aktionen [data-a="los"]')?.getBoundingClientRect();
      const brett = document.querySelector('.ls-screen .ls-rahmen')?.getBoundingClientRect();
      const d = document.documentElement;
      return { leere: los ? Math.round(innerHeight - los.bottom) : null, losOben: los ? Math.round(los.top) : null,
        brett: brett ? Math.round(brett.width) : null, seiteRollt: d.scrollHeight - innerHeight, hoehe: innerHeight };
    });
    pruefe(`Leere ${name}: unter "Los geht's" höchstens 60 px bis zum Rand, Knopf ganz sichtbar, nichts scrollt`,
      m.leere !== null && m.leere >= 0 && m.leere <= 60 && m.seiteRollt <= 1, m);
    await p.k.close();
  }
}

async function browserTeil() {
  const server = spawn(process.execPath, ['tests/testserver.mjs', String(PORT), '--bind', '127.0.0.1'], { cwd: WURZEL, stdio: 'ignore' });
  let browser = null;
  try {
    await warteAufServer(`http://127.0.0.1:${PORT}/index.html`);
    browser = await browserTyp(ladePlaywright()).launch();
    await erfinderTeil(browser);
    await gratisTeil(browser);
    await willkommenTeil(browser);
    await neuesGeraetTeil(browser);
    await kleinTeil(browser);
    await brettGroesseTeil(browser);
    await leereTeil(browser);
  } catch (e) {
    pruefe('Browser-Teil läuft durch', false, e.message);
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
}

if (!NUR_NODE) await browserTeil();
console.log(`${ok}/${ok + fehler} bestanden`);
process.exit(fehler ? 1 : 0);
