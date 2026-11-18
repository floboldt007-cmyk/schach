// R19 Lektionen besser (Flo 14.11.2026: "Lektionen zu schnell durch"; Wunsch 13): die 13 Lektionen ohne schnelles
// Geschafft (lange Matts und Endspiele, R19-Kritik/lektionen-13.md) haben drei Runden: Lernen, Ueben, Meisterprobe.
// Schachrichtigkeit mit Stockfish in Node (tests/lektion-engine.mjs), feste Knotenzahl, damit jeder Lauf gleich rechnet:
//   - jede Runde ist eine legale Lektionsstellung mit denselben Figurenarten wie Runde 1
//   - Stockfish gegen Stockfish, gewertet wie die App (pruefeZiel), endet "geschafft"; ziel = diese Zugzahl oder die
//     kuerzere Mattsuche
//   - Runde 2 und 3 sind nicht kuerzer als Runde 1
//   - jede Behauptung im Text ("Matt in N", "einziger Zug", "gewinnt") wird nachgerechnet: Text sagt X, Engine sagt Y
//   - Rundentexte DE und EN da und kurz (Leitlinie R19: wenig Text)
// Aufruf: node tests/r19-lektionen-besser.test.mjs [ids]
import * as M from '../js/pakete/lernen/mattbilder.js';
import { pruefeLektion } from '../js/pakete/lernen/mattbilder.js';
import { stockfish, spiele, mattIn, mattform, gut, artVon, Chess } from './lektion-engine.mjs';
import { setzeSprache, t } from '../js/sprache.js';
import '../js/pakete/lernen/texte.js';

const SCHWERE_13 = ['dame', 'zwei-tuerme', 'turm', 'zwei-laeufer', 'erstickt', 'laeufer-springer',
  'erst-koenig', 'opposition', 'schluesselfelder', 'patt-vermeiden', 'philidor', 'lucena', 'dame-bauer'];
const NUR = process.argv[2] ? process.argv[2].split(',') : null;
const GO = 'nodes 150000';
const GO_GEGNER = 'nodes 400000';   // die App verteidigt mit voller Staerke (js/ui/lektion.js ZEIT_GEGNER 450 ms)
const MATT_SUCHE = 'nodes 3000000';
const TEXT_MAX = 90;

let ok = 0, gesamt = 0;
function pruefe(name, wert, extra = '') { gesamt++; if (wert) { ok++; console.log('ok     ' + name); } else console.log('FEHLER ' + name + (extra ? '  ' + extra : '')); }

// Kind-Lauf (R19_KIND=1): nur die Engine-Pruefung der genannten Lektionen, ohne die Datenpruefung davor
const KIND = process.env.R19_KIND === '1';
const hatRunden = typeof M.rundenVon === 'function';
if (!KIND) {
  pruefe('mattbilder.js exportiert rundenVon(l)', hatRunden);
  if (!hatRunden) { console.log(`\n${ok}/${gesamt} bestanden`); process.exit(1); }
  for (const l of M.ALLE.filter((x) => !SCHWERE_13.includes(x.id))) {
    const r = M.rundenVon(l);
    if (r.length !== 1 || r[0].fen !== l.fen || r[0].ziel !== l.ziel) pruefe(`${l.id}: andere Lektionen bleiben eine Runde wie bisher`, false, JSON.stringify(r));
  }
  pruefe('alle anderen 52 Lektionen bleiben eine Runde mit ihrer Stellung', M.ALLE.filter((x) => !SCHWERE_13.includes(x.id)).every((l) => M.rundenVon(l).length === 1));
}

// Ohne Auswahl: je Lektion ein Kind-Prozess, hoechstens PARALLEL gleichzeitig (eine Lektion rechnet bis zu einer Minute,
// nacheinander lief der Test am 17.11. ueber das Zeitlimit von 900 s). Jedes Kind hat seinen eigenen Stockfish.
const PARALLEL = Number(process.env.R19_PARALLEL) || 4;
if (!NUR) {
  const { spawn } = await import('node:child_process');
  const { fileURLToPath } = await import('node:url');
  const datei = fileURLToPath(import.meta.url);
  const kind = (id) => new Promise((fertig) => {
    let aus = '';
    const p = spawn(process.execPath, [datei, id], { env: { ...process.env, R19_KIND: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
    p.stdout.on('data', (d) => { aus += d; });
    p.stderr.on('data', (d) => { aus += d; });
    p.on('close', (code) => fertig({ id, aus, code }));
  });
  const offen = [...SCHWERE_13];
  const ergebnisse = [];
  await Promise.all(Array.from({ length: PARALLEL }, async () => {
    while (offen.length) ergebnisse.push(await kind(offen.shift()));
  }));
  for (const id of SCHWERE_13) {
    const e = ergebnisse.find((x) => x.id === id);
    const zeilen = e.aus.split('\n').filter((z) => /^(ok|FEHLER) /.test(z));
    for (const z of zeilen) console.log(z);
    const m = /(\d+)\/(\d+) bestanden/.exec(e.aus);
    pruefe(`${id}: Kind-Lauf endet sauber`, !!m && e.code === (m[1] === m[2] ? 0 : 1), `code ${e.code}, ${m ? m[0] : e.aus.slice(-300)}`);
    if (m) { ok += Number(m[1]); gesamt += Number(m[2]); }
  }
  console.log(`\n${ok}/${gesamt} bestanden`);
  process.exit(ok === gesamt ? 0 : 1);
}

const figuren = (fen) => [...new Set(fen.split(' ')[0].replace(/[^NBRQP]/g, ''))].sort().join('');
const texte = (id, n, sprache) => {
  setzeSprache(sprache);
  const k = n === 1 ? [`idee.${id}`] : [`runde.${id}.${n}`];
  return k.map((x) => ({ key: x, text: t('p-lernen.' + x) }));
};

const sf = stockfish();
await sf.init();
try {
  for (const id of SCHWERE_13.filter((x) => !NUR || NUR.includes(x))) {
    const l = M.lektion(id);
    const rs = M.rundenVon(l);
    pruefe(`${id}: drei Runden`, rs.length === 3, String(rs.length));
    if (rs.length !== 3) continue;
    pruefe(`${id}: Runde 1 ist die bisherige Stellung`, rs[0].fen === l.fen && rs[0].ziel === l.ziel);
    for (let i = 0; i < 3; i++) {
      const r = { ...l, fen: rs[i].fen, ziel: rs[i].ziel };
      const tag = `${id} R${i + 1}`;
      const f = pruefeLektion(r, Chess);
      pruefe(`${tag}: legale Lektionsstellung`, !f.length, f.join('; '));
      if (f.length) continue;
      if (i > 0) {
        pruefe(`${tag}: dieselben Figurenarten wie Runde 1`, figuren(r.fen) === figuren(l.fen), `${figuren(r.fen)} gegen ${figuren(l.fen)}`);
        pruefe(`${tag}: andere Stellung als die Runden davor`, rs.slice(0, i).every((x) => x.fen.split(' ')[0] !== r.fen.split(' ')[0]));
        pruefe(`${tag}: nicht kuerzer als Runde 1 (Ziel ${r.ziel} >= ${l.ziel})`, r.ziel >= l.ziel);
      }
      const s = await spiele(sf, r, r.fen, { go: GO, goGegner: GO_GEGNER });
      const matt = artVon(l) === 'matt' ? await mattIn(sf, r.fen, MATT_SUCHE) : null;
      pruefe(`${tag}: Stockfish gegen Stockfish endet geschafft`, s.ende === 'geschafft', `Engine sagt ${s.ende} nach ${s.zuege}`);
      // Lektionen mit einem Mattbild im Namen: die beste Linie endet auch in DIESEM Bild (Kaltreview 3f 17.11.2026: die
      // Meisterprobe von "erstickt" endete mit Qxh7#, einem Damenmatt)
      if (l.id === 'erstickt') {
        const f = mattform(s.endFen, s.letzter);
        pruefe(`${tag}: beste Linie endet im erstickten Matt (Springer, Koenig nur von eigenen Steinen umstellt)`, f.erstickt,
          `${f.mattzug} · ${f.nachbarn}`);
      }
      // Matt: Ziel = Mattdistanz der Suche (genau). Halten: Ziel = gehaltene Zuege. Umwandeln/Gewinnen: ohne Mattwert ist
      // das Selbstspiel nur eine Obergrenze (Stockfish eilt nicht zum Ziel), also muss die Engine selbst drei Sterne holen
      // (mattbilder.js sterne: zuege <= ziel + ziel/4) und das Ziel darf nicht ueber ihrer Zugzahl liegen
      const a = artVon(l);
      // (findet die Mattsuche nichts, gilt bei Matt dieselbe Obergrenzen-Regel wie beim Umwandeln)
      // (und ist das gefundene Matt laenger als das Selbstspiel, war die Suche zu kurz: dann ebenfalls die Obergrenze)
      const passt = a === 'matt' && matt != null && matt <= s.zuege ? r.ziel === matt
        : a === 'halten' ? r.ziel === s.zuege
          : r.ziel <= s.zuege && s.zuege <= r.ziel + Math.floor(r.ziel / 4);
      pruefe(`${tag}: Ziel ${r.ziel} passt zur Engine`, s.ende === 'geschafft' && passt,
        `Text/Daten sagen ${r.ziel}, Engine sagt ${a === 'matt' ? `Matt in ${matt ?? '-'}` : `${s.zuege} Zuege`} (Selbstspiel ${s.zuege})`);
      for (const sprache of ['de', 'en']) {
        for (const { key, text } of texte(id, i + 1, sprache)) {
          const fehlt = !text || text === 'p-lernen.' + key;
          pruefe(`${tag} ${sprache}: Text ${key} vorhanden`, !fehlt, text);
          if (fehlt) continue;
          if (i > 0) pruefe(`${tag} ${sprache}: Rundentext kurz (<= ${TEXT_MAX} Zeichen)`, text.length <= TEXT_MAX, `${text.length}: ${text}`);
          const mn = /(?:Matt in|mate in) (\d+)/i.exec(text);
          if (mn) pruefe(`${tag} ${sprache}: "${mn[0]}" stimmt`, Number(mn[1]) === matt, `Text sagt ${mn[1]}, Engine sagt ${matt ?? 'kein Matt gefunden'}`);
          if (/einzige[rn]? Zug|only move/i.test(text)) {
            const n = new Chess(r.fen).moves().length;
            const e = await sf.alle(r.fen, 'nodes 400000', n);
            const g = e.filter((x) => gut(x, artVon(l))).length;
            pruefe(`${tag} ${sprache}: "einziger Zug" stimmt`, g === 1, `Text sagt einer, Engine sagt ${g} von ${n}`);
          }
          if (/\b(gewinnt|wins)\b/i.test(text) && artVon(l) !== 'halten') {
            pruefe(`${tag} ${sprache}: "gewinnt" stimmt`, s.ende === 'geschafft', `Engine sagt ${s.ende}`);
          }
        }
      }
    }
  }
} finally { sf.ende(); }
console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
