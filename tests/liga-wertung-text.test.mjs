// Liga-Texte: die Wertung heisst "Liga-Wertung" / "League rating", nirgends "Arena" (Kritik R6, B13 Teil 3, 13.11.2026).
// Unter dem Sieg-Blatt stand "Arena-Wertung +12", der Knopf daneben heisst aber "Zur Liga". Rein, ohne Browser.
//   node tests/liga-wertung-text.test.mjs
import { DE, EN } from '../js/pakete/liga/texte.js';

let ok = 0, gesamt = 0;
function pruefe(name, gut, detail = '') {
  gesamt++; if (gut) ok++;
  console.log(`${gut ? 'OK' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(detail)}`);
}

for (const [sprache, w, wort] of [['de', DE, /Liga-Wertung/], ['en', EN, /league rating/i]]) {
  const arena = Object.entries(w).filter(([, v]) => typeof v === 'string' && /arena/i.test(v));
  pruefe(`${sprache}: kein Text im Paket liga nennt "Arena"`, arena.length === 0, arena);
  for (const k of ['abr.arena', 'kurve.label', 'kurve.titel', 'verlauf.titel', 'verlauf.fuss']) {
    pruefe(`${sprache}: ${k} nennt die Liga-Wertung`, wort.test(String(w[k])), w[k]);
  }
}
pruefe('de: Abrechnung unter dem Sieg-Blatt lautet "Liga-Wertung {diff}"', DE['abr.arena'] === 'Liga-Wertung {diff}', DE['abr.arena']);
pruefe('en: Abrechnung lautet "League rating {diff}"', EN['abr.arena'] === 'League rating {diff}', EN['abr.arena']);

console.log(`\n${ok}/${gesamt} Pruefungen bestanden`);
process.exit(ok === gesamt ? 0 : 1);
