// fc 20.11. (Befund von 19, Version 371): Kurs Kapitel 3 "Schach geben" (es-schach) galt nach JEDEM ruhigen Zug mit
// 3 Sternen als geschafft, sobald der Bot antwortete. Ursache js/pakete/lernen/mattbilder.js pruefeZiel: im Zweig
// wann 'gegner' fiel jede Art ohne eigenen Fall bis zur Halten-Regel durch (Bauern des Gegners weg und Material
// hoechstens 2 dahinter -> 'geschafft'). Die Halten-Regeln gelten jetzt nur fuer art 'halten'.
// Geprueft wird JEDE Lektion (Kurs Erste Schritte und Meisterschule) jeder Art, die das Brett mit Gegner spielt:
// ein ruhiger falscher Zug von Flo (kein Schach, kein Schlag, keine Umwandlung) und ein ruhiger Gegenzug duerfen
// nicht 'geschafft' ergeben. 'halten' ist ausgenommen: dort ist Ueberstehen das Ziel (eigene Gegenprobe unten).
//
//   node tests/r20-lernen-gegner.test.mjs
import { Chess } from '../vendor/chess/chess.js';
import * as M from '../js/pakete/lernen/mattbilder.js';
import { ERSTE_SCHRITTE } from '../js/pakete/lernen/erste-schritte.js';

let gesamt = 0, ok = 0;
function pruefe(name, gut, detail = '') {
  gesamt++; if (gut) ok++;
  const d = typeof detail === 'string' ? detail : JSON.stringify(detail);
  console.log(`${gut ? 'ok    ' : 'FEHLER'} ${name}${!gut && d ? ' ' + d : ''}`);
}

const ruhig = (c) => c.moves({ verbose: true }).filter((m) => !m.captured && !m.promotion && !/[+#]/.test(m.san));
const lektionen = [
  ...ERSTE_SCHRITTE.flatMap((k) => k.lektionen || [k]),
  ...M.BEREICHE.flatMap((b) => b.lektionen || []),
];
const mitGegner = ['schach', 'matt', 'taktik', 'umwandeln', 'gewinnen', 'partie'];

// der gemeldete Fall, wie 19 ihn belegt hat
{
  const l = lektionen.find((x) => x.id === 'es-schach');
  const c = new Chess(l.fen);
  const start = M.bilanz(c);
  const ergebnisse = [];
  let zuege = 0;
  for (let i = 0; i < 3; i++) {
    const w = ruhig(c)[0];
    if (!w) break;
    c.move(w.san); zuege++;
    const flo = M.pruefeZiel(l, start, c, { wann: 'flo', zuege });
    const s = ruhig(c)[0] || c.moves({ verbose: true })[0];
    if (!s) break;
    c.move(s.san);
    ergebnisse.push(`${w.san}/${s.san}: flo ${flo} gegner ${M.pruefeZiel(l, start, c, { wann: 'gegner', zuege })}`);
  }
  pruefe('es-schach: drei ruhige Zuege mit Antwort, nie geschafft', ergebnisse.length === 3 && ergebnisse.every((x) => !/geschafft/.test(x)), ergebnisse);
  const c2 = new Chess(l.fen);
  const schach = c2.moves({ verbose: true }).find((m) => /\+/.test(m.san));
  c2.move(schach.san);
  pruefe('es-schach: ein Schachgebot ist weiter geschafft', M.pruefeZiel(l, M.bilanz(new Chess(l.fen)), c2, { wann: 'flo', zuege: 1 }) === 'geschafft', schach.san);
}

// jede Lektion jeder Art mit Gegner (ausser halten)
const je = {};
for (const l of lektionen) {
  const art = M.artVon(l);
  if (!mitGegner.includes(art)) continue;
  for (const r of M.rundenVon(l)) {
    let c;
    try { c = new Chess(r.fen); } catch (e) { continue; }
    const start = M.bilanz(c);
    const lr = { ...l, fen: r.fen, ziel: r.ziel };
    const w = ruhig(c).find((m) => { const t = new Chess(c.fen()); t.move(m.san); return M.pruefeZiel(lr, start, t, { wann: 'flo', zuege: 1 }) === null; });
    if (!w) { (je[art] ||= { geprueft: 0, falsch: [], ohne: [] }).ohne.push(l.id); continue; }
    c.move(w.san);
    const s = ruhig(c)[0];
    if (!s) { (je[art] ||= { geprueft: 0, falsch: [], ohne: [] }).ohne.push(l.id); continue; }
    c.move(s.san);
    const e = M.pruefeZiel(lr, start, c, { wann: 'gegner', zuege: 1 });
    const x = (je[art] ||= { geprueft: 0, falsch: [], ohne: [] });
    x.geprueft++;
    if (e === 'geschafft') x.falsch.push(`${l.id} ${w.san}/${s.san}`);
  }
}
for (const art of mitGegner) {
  const x = je[art] || { geprueft: 0, falsch: [], ohne: [] };
  if (!x.geprueft && art === 'partie') { console.log('       partie: keine Lektion spielt auf dem Lektionsbrett (es-partie startet eine Partie)'); continue; }
  pruefe(`Art ${art}: ruhiger falscher Zug + Gegenzug ist nie geschafft (${x.geprueft} Stellungen${x.ohne.length ? ', ohne ruhigen Zug: ' + x.ohne.join(' ') : ''})`,
    x.geprueft > 0 && x.falsch.length === 0, x.falsch);
}
// partie als Art direkt (Lektionsstellung = Grundstellung): darf ebenfalls nicht durchfallen
{
  const l = { id: 'probe-partie', art: 'partie', fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', ziel: 1 };
  const c = new Chess(l.fen); const start = M.bilanz(c);
  c.move('e4'); c.move('e5');
  pruefe('Art partie (Grundstellung): Gegenzug ergibt nicht geschafft', M.pruefeZiel(l, start, c, { wann: 'gegner', zuege: 1 }) !== 'geschafft');
}

// Zuggrenze (Kaltreview 43): fuer schach und partie greift zuViele genau bei grenze(ziel), in einer ruhigen Stellung
// (ruhiger Zug + Antwort, wie oben). Davor null, und der Gegner-Zweig ergibt bei keiner Zugzahl geschafft.
for (const l of [lektionen.find((x) => x.id === 'es-schach'), lektionen.find((x) => x.id === 'es-partie')]) {
  const c = new Chess(l.fen); const start = M.bilanz(c);
  c.move(ruhig(c)[0].san);
  const nachFlo = new Chess(c.fen());
  c.move(ruhig(c)[0].san);
  const g = M.grenze(l.ziel);
  const flo = [g - 1, g].map((z) => M.pruefeZiel(l, start, nachFlo, { wann: 'flo', zuege: z }));
  const gegner = [1, g - 1, g].map((z) => M.pruefeZiel(l, start, c, { wann: 'gegner', zuege: z }));
  pruefe(`${l.id}: ruhige Stellung, Zug ${g - 1} laeuft weiter, Zug ${g} ist zuViele, Gegner-Zweig nie geschafft`,
    flo[0] === null && flo[1] === 'zuViele' && gegner.every((x) => x !== 'geschafft'), { flo, gegner });
}

// Gegenprobe halten: Ueberstehen bleibt geschafft (die Regel, die vorher fuer alle galt, gilt dort weiter)
{
  const l = lektionen.find((x) => M.artVon(x) === 'halten' && x.id.startsWith('es-'));
  const c = new Chess(l.fen); const start = M.bilanz(c);
  let e = null, z = 0;
  for (; z < 40 && !e; ) {
    const w = ruhig(c)[0] || c.moves({ verbose: true })[0]; if (!w) break;
    c.move(w.san); z++;
    if (M.pruefeZiel(l, start, c, { wann: 'flo', zuege: z })) break;
    const s = ruhig(c)[0] || c.moves({ verbose: true })[0]; if (!s) break;
    c.move(s.san);
    e = M.pruefeZiel(l, start, c, { wann: 'gegner', zuege: z });
  }
  pruefe(`halten (${l.id}): nach genug ueberstandenen Zuegen geschafft`, e === 'geschafft', { e, z });
}

console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
