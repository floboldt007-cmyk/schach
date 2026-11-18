// Analyse: Satz der Start-Karte und Zug, bei dem die Analyse oeffnet (R7, Befund B14 aus dem Gesamtdurchgang R6).
// Nach "Matt im 2. Zug" stand "Knapp! Schau dir den Schluesselmoment an" auf der Startstellung: warKnapp() sieht in
// einer Kurve aus vier Stellungen nur offene Stellungen, und die Startstellung zeigt bei zwei Zuegen nichts.
// Erwartet: eine zu kurze Partie (weniger als BESTWERT_MIN_ZUEGE eigene Zuege, dieselbe Grenze wie "zu kurz" in der
// Genauigkeit) bekommt einen Satz fuer das schnelle Ende; eine kurze Niederlage oeffnet am entscheidenden Zug, also am
// Zug mit dem groessten Ausschlag (wie eine Zeile der Liga, punkte/stand.js groessterAusschlag). Lange Partien und ein
// kurzer Sieg oeffnen wie bisher an der Startstellung (app.test.mjs geht das Schaefermatt von dort aus durch).
//
//   node tests/analyse-start.test.mjs
import { startSatz, startPly } from '../js/ui/analyse.js';
import { t } from '../js/sprache.js';

let fehler = 0;
let anzahl = 0;
function pruefe(name, ok, detail = '') {
  anzahl++;
  if (!ok) fehler++;
  console.log(`${ok ? 'ok  ' : 'FEHLER'} ${name}${!ok && detail ? ' (' + JSON.stringify(detail) + ')' : ''}`);
}

// Narrenmatt aus Sicht von Weiss: 1. f3 e5 2. g4 Dh4#; Gewinnchance Weiss je Stellung (Start + 4 Halbzuege)
const NARR = [0.52, 0.45, 0.42, 0.0, 0.0];

// ---------- Satz ----------
const kurzNieder = startSatz({ art: 'niederlage', kurz: true, knapp: true, momente: 1 });
pruefe('kurze Niederlage: kein "Knapp!"', !/Knapp/.test(t(kurzNieder.schluessel, kurzNieder.werte)), t(kurzNieder.schluessel, kurzNieder.werte));
pruefe('kurze Niederlage: eigener Satz fuer das schnelle Ende', kurzNieder.schluessel === 'analyse.an.start.schnellNiederlage', kurzNieder);
const kurzSieg = startSatz({ art: 'sieg', kurz: true, knapp: false, momente: 0 });
pruefe('kurzer Sieg: eigener Satz fuer den schnellen Sieg', kurzSieg.schluessel === 'analyse.an.start.schnellSieg', kurzSieg);
for (const s of ['schnellNiederlage', 'schnellSieg']) {
  const text = t('analyse.an.start.' + s);
  pruefe(`Text ${s} vorhanden`, text && text !== 'analyse.an.start.' + s, text);
}

// lange Partien unveraendert
const lang = (art, knapp, momente) => startSatz({ art, kurz: false, knapp, momente }).schluessel;
pruefe('lange Niederlage knapp mit Momenten: wie bisher', lang('niederlage', true, 2) === 'analyse.an.start.knappMomente');
pruefe('lange Niederlage ohne Momente, nicht knapp: wie bisher', lang('niederlage', false, 0) === 'analyse.an.start.kopfHoch');
pruefe('langer Sieg: wie bisher', lang('sieg', false, 3) === 'analyse.an.start.sieg');
pruefe('Remis: wie bisher', lang('remis', false, 0) === 'analyse.an.start.remis');
pruefe('Zu zweit: wie bisher, auch kurz', startSatz({ art: 'niederlage', zuzweit: true, kurz: true }).schluessel === 'analyse.an.start.zuzweit');
const mehr = startSatz({ art: 'niederlage', kurz: false, knapp: true, momente: 3 });
pruefe('Mehrzahl ueber n bleibt', mehr.werte && mehr.werte.n === 3, mehr);

// ---------- Zug beim Oeffnen ----------
const N = 'niederlage';
pruefe('kurze Niederlage: oeffnet am entscheidenden Zug (2. g4, Ply 2)', startPly({ kurve: NARR, zuege: 4, kurz: true, art: N }) === 2,
  startPly({ kurve: NARR, zuege: 4, kurz: true, art: N }));
pruefe('kurze Niederlage ohne Kurve: oeffnet an der Schlussstellung', startPly({ kurve: null, zuege: 4, kurz: true, art: N }) === 3);
pruefe('lange Niederlage: oeffnet wie bisher an der Startstellung', startPly({ kurve: NARR, zuege: 40, kurz: false, art: N }) === -1);
pruefe('kurzer Sieg (Schaefermatt), Remis, Zu zweit: wie bisher an der Startstellung',
  startPly({ kurve: NARR, zuege: 7, kurz: true, art: 'sieg' }) === -1 && startPly({ kurve: NARR, zuege: 4, kurz: true, art: 'remis' }) === -1
  && startPly({ kurve: NARR, zuege: 4, kurz: true, art: null }) === -1);
pruefe('ausdruecklicher Zug (Liga-Zeile, Verlauf) gewinnt immer', startPly({ kurve: NARR, zuege: 4, kurz: true, art: N, ply: 1 }) === 1
  && startPly({ kurve: NARR, zuege: 40, kurz: false, art: N, ply: 7 }) === 7);
pruefe('Partie ohne Zuege: Startstellung', startPly({ kurve: [0.5], zuege: 0, kurz: true, art: N }) === -1);

console.log(`\n${anzahl - fehler}/${anzahl} bestanden`);
process.exit(fehler ? 1 : 0);
