// Coach in klar verlorener Lage (fc-08:15, Fenster 43; Flos JA 20.11.2026, Anlass R20-Kritik/coach-qualitaet/bericht.md:
// in verlorenen Stellungen sagte 12 % der Zuege nur eine Seite "schwer", das ist Suchrauschen der Untergrenze).
// Die Untergrenze aus der Bewertung (js/review.js BODEN_CP, BODEN_STREUUNG) hebt einen Zug hoechstens bis "Ungenau", wenn
// der Ziehende VOR dem Zug schon klar verloren stand (ab -5), spiegelbildlich zu BODEN_GEWONNEN_CP (danach noch ab +5).
// Unveraendert: die Gewinnchance selbst, die Matt-Regeln der Untergrenze, Erzwungen, Buch, klar gewonnen.
//   node tests/r24-coach-verloren.test.mjs
import { klassifiziere, GRENZEN } from '../js/review.js';

let ok = 0; let fehler = 0;
function pruefe(name, wert, info = '') {
  if (wert) { ok++; console.log('ok   ' + name); } else { fehler++; console.log('FEHLER ' + name + ' ' + info); } // INTENTIONAL-SLOP[T4]: die Konsole ist der Ausgabeweg der Probe
}
const ev = (cp) => ({ cp, mate: null });
const matt = (n) => ({ cp: null, mate: n });
const MITTE = 'r1bq1rk1/pp2bppp/2n1pn2/2pp4/3P4/2PBPN2/PP1N1PPP/R1BQ1RK1 w - - 0 8';
const MITTE_S = 'r1bq1rk1/pp2bppp/2n1pn2/2pp4/3P4/2PBPN2/PP1N1PPP/R1BQ1RK1 b - - 0 8';
const zug = (v, n, extra = {}) => klassifiziere({ fenVorher: MITTE, uci: 'h2h3', besterZug: 'd4c5', pvVorher: ['d4c5'], pvNachher: [], evalVorher: v, evalNachher: n, ...extra });
const schwer = (k) => ['fehler', 'verpasst', 'patzer'].includes(k);
const zeig = (r) => `${r.klasse} (${r.notiz})`;

// klar verloren vorher: die Untergrenze hebt hoechstens bis ungenau
for (const [v, n, was] of [[-800, -1700, 'Dame weg'], [-800, -1150, 'Figur weg'], [-1500, -2000, 'Turm weg'], [-500, -830, 'genau an der Grenze -5'],
  [-2000, -3000, 'tief verloren']]) {
  const r = zug(ev(v), ev(n));
  pruefe(`verloren ${v / 100} -> ${n / 100} (${was}): hoechstens ungenau`, !schwer(r.klasse), zeig(r));
  pruefe(`verloren ${v / 100} -> ${n / 100}: sichtbar ungenau statt gut (der Coach lobt den Verlust nicht)`, r.klasse === 'ungenau', zeig(r));
}
const rs = klassifiziere({ fenVorher: MITTE_S, uci: 'h7h6', besterZug: 'c5d4', evalVorher: ev(800), evalNachher: ev(1700) });
pruefe('Schwarz am Zug, verloren (Weiss +8 -> +17): ungenau', rs.klasse === 'ungenau', zeig(rs));
const rv = zug(ev(-800), ev(-1700));
pruefe('angehobener Zug zaehlt als ungenau-Verlust (Genauigkeit, Kartei)', rv.verlust > GRENZEN.gut && rv.verlust <= GRENZEN.ungenau, String(rv.verlust));

// nicht klar verloren vorher: die Untergrenze wirkt wie bisher
pruefe('-4 -> -13 (noch nicht klar verloren): patzer wie bisher', zug(ev(-400), ev(-1300)).klasse === 'patzer', zeig(zug(ev(-400), ev(-1300))));
pruefe('-4,99 -> -9 (knapp vor der Grenze): weiter schwer', schwer(zug(ev(-499), ev(-900)).klasse), zeig(zug(ev(-499), ev(-900))));
pruefe('0 -> -6 (Figur weg aus offener Lage): schwer', schwer(zug(ev(0), ev(-600)).klasse), zeig(zug(ev(0), ev(-600))));

// die Gewinnchance selbst bleibt: wer aus -5 in -15 faellt, verliert genug Gewinnchance fuer "Fehler"
const rg = zug(ev(-500), ev(-1500));
pruefe('-5 -> -15: die Gewinnchance allein bleibt mindestens Fehler (nur die Untergrenze ist gedeckelt)', schwer(rg.klasse) && !/^Bewertung/.test(rg.notiz), zeig(rg));

// Matt-Regeln der Untergrenze unveraendert
pruefe('verloren, laeuft ins Matt in 1: patzer', zug(ev(-900), matt(-1)).klasse === 'patzer', zeig(zug(ev(-900), matt(-1))));
pruefe('laesst langes Matt zu (ausgeglichen): patzer', zug(ev(0), matt(-6)).klasse === 'patzer', zeig(zug(ev(0), matt(-6))));
pruefe('laesst langes Matt zu (schon -12): ungenau', zug(ev(-1200), matt(-6)).klasse === 'ungenau', zeig(zug(ev(-1200), matt(-6))));
pruefe('wird matt, Matt in 8 -> Matt in 2: fehler', zug(matt(-8), matt(-2)).klasse === 'fehler', zeig(zug(matt(-8), matt(-2))));

// Sonderklassen unveraendert
const rz = klassifiziere({ fenVorher: '7k/8/8/8/8/8/6q1/7K w - - 0 1', uci: 'h1g2', besterZug: 'h1g2', evalVorher: ev(-800), evalNachher: ev(-1700) });
pruefe('Erzwungen (einziger legaler Zug) bleibt erzwungen', rz.klasse === 'erzwungen', zeig(rz));
const rb = zug(ev(-800), ev(-850), { buch: true, eroeffnung: 'Testeröffnung' });
pruefe('Buch bleibt Buch', rb.klasse === 'buch', zeig(rb));
pruefe('klar gewonnen (+15 -> +8): ungenau wie bisher', zug(ev(1500), ev(800)).klasse === 'ungenau', zeig(zug(ev(1500), ev(800))));

console.log(`${ok}/${ok + fehler} bestanden`);
process.exit(fehler ? 1 : 0);
