// R19 Season, "Alle Ligen" (Kaltreview df 15.11.2026): der Satz je Liga muss sagen, was zoneVon (js/pakete/liga/kronen.js)
// und der Server tun. Abstieg gibt es auf JEDER Stufe ausser Squire III, Aufstieg auf jeder ausser Crownmate I. Kein
// "Ab hier" (klang, als begaenne der Abstieg erst bei Baron). Reiner Node-Test, kein Browser.
//   node tests/r19-ligen-satz.test.mjs
import { DE, EN } from '../js/pakete/liga/texte.js';
import { LIGEN, STUFEN_JE_LIGA, zoneVon } from '../js/pakete/liga/kronen.js';

let ok = 0, gesamt = 0;
function pruefe(name, gut, detail = '') {
  gesamt++; if (gut) ok++;
  // INTENTIONAL-SLOP[T4]: die Pruefzeile ist die Ausgabe des Tests (wie in den anderen r19-Tests)
  console.log(`${gut ? 'OK    ' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(detail)}`);
}

const SPRACHEN = [['DE', DE, /tiefer|absteig|steigt .*ab|fällt|fallen/i, /ab hier/i], ['EN', EN, /down|drop/i, /from here/i]];
LIGEN.forEach((liga, l) => {
  const stufen = [0, 1, 2].map((r) => l * STUFEN_JE_LIGA + r);
  const ab = stufen.filter((s) => zoneVon(30, { stufe: s }) === 'ab');
  const auf = stufen.filter((s) => zoneVon(1, { stufe: s }) === 'auf');
  for (const [sp, texte, abWort, abHier] of SPRACHEN) {
    const satz = texte['season.ligen.satz.' + liga] || '';
    pruefe(`${sp} ${liga}: Satz vorhanden`, satz.length > 0, satz);
    pruefe(`${sp} ${liga}: kein "Ab hier"`, !abHier.test(satz), satz);
    if (ab.length) pruefe(`${sp} ${liga}: nennt den Abstieg der letzten {ab} (zoneVon: Stufen ${ab.join(',')} steigen ab)`,
      satz.includes('{ab}') && abWort.test(satz), satz);
    else pruefe(`${sp} ${liga}: nennt keinen Abstieg (zoneVon: niemand steigt ab)`, !satz.includes('{ab}'), satz);
    if (ab.length && ab.length < stufen.length) pruefe(`${sp} ${liga}: nennt die Stufe ohne Abstieg (III)`, /\bIII\b/.test(satz), satz);
    if (auf.length) pruefe(`${sp} ${liga}: nennt den Aufstieg der ersten {auf}`, satz.includes('{auf}'), satz);
  }
});

console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
