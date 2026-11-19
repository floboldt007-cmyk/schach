// Entscheidung nach einem Wechsel des Service Workers (js/sw-wechsel.js), ohne Browser:
//   node tests/sw-wechsel.test.mjs
import { wechselNeuLaden, SPERRE_MS } from '../js/sw-wechsel.js';

let gut = 0, alle = 0;
function pruefe(name, ist, soll) {
  alle++;
  const ok = ist === soll;
  if (ok) gut++;
  console.log(`${ok ? 'ok  ' : 'FEHLER'} ${name}${ok ? '' : ` (ist ${ist}, soll ${soll})`}`);
}
const T = 1_000_000;
const fremd = { eigenerWechsel: false, hatteController: true, imSpiel: false, zuletztNeu: 0, jetzt: T };

pruefe('eigener Wechsel: neu laden', wechselNeuLaden({ ...fremd, eigenerWechsel: true }), 'neu laden');
pruefe('Erstbesuch (noch kein Worker): nichts', wechselNeuLaden({ ...fremd, hatteController: false }), 'nichts');
pruefe('fremder Wechsel nach Notbremse: einmal neu laden', wechselNeuLaden(fremd), 'neu laden');
pruefe('mitten im Spiel (Partie, Analyse, Lektion, Online): nur Hinweis', wechselNeuLaden({ ...fremd, imSpiel: true }), 'hinweis');
pruefe('mitten im Spiel, auch wenn lange nicht neu geladen: nur Hinweis', wechselNeuLaden({ ...fremd, imSpiel: true, zuletztNeu: T - 10 * SPERRE_MS }), 'hinweis');
pruefe('zweiter Wechsel kurz nach dem Neuladen im selben Tab: nur Hinweis, keine Schleife',
  wechselNeuLaden({ ...fremd, zuletztNeu: T - 1000 }), 'hinweis');
pruefe('genau an der Sperrgrenze: wieder neu laden', wechselNeuLaden({ ...fremd, zuletztNeu: T - SPERRE_MS }), 'neu laden');
// mehrere Tabs: jeder Tab hat seinen eigenen Merker (sessionStorage), ein frischer Tab laedt einmal, ein gerade
// neu geladener nicht noch einmal
const tabA = { ...fremd, zuletztNeu: 0 }, tabB = { ...fremd, zuletztNeu: T - 500 };
pruefe('zwei Tabs: Tab A laedt einmal neu', wechselNeuLaden(tabA), 'neu laden');
pruefe('zwei Tabs: Tab B (gerade neu geladen) nicht noch einmal', wechselNeuLaden(tabB), 'hinweis');

console.log(`\n${gut}/${alle} bestanden`);
process.exit(gut === alle ? 0 : 1);
