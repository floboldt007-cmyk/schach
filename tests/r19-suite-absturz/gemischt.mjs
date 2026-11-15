// Probe-Suite fuer tests/r19-suite-absturz.test.mjs (Kaltreview f1, KRITISCH): der ERSTE Lauf hat einen inhaltlichen FEHLER
// und einen Seitenabsturz, der zweite waere gruen. alle.mjs darf ihn nicht wiederholen, sonst verschwindet der inhaltliche
// FEHLER. Die Marke (ABSTURZ_MARKE) haelt den ersten Lauf fest, LAEUFE_DATEI zaehlt die Laeufe.
import { appendFileSync, existsSync, writeFileSync } from 'node:fs';
const marke = process.env.ABSTURZ_MARKE;
if (process.env.LAEUFE_DATEI) appendFileSync(process.env.LAEUFE_DATEI, 'lauf\n');
if (marke && !existsSync(marke)) {
  writeFileSync(marke, 'erster Lauf');
  console.log('FEHLER Probe inhalt: Brett 352 statt 360 px');
  console.log('FEHLER Probe danach: page.evaluate: Target crashed');
  console.log('\n0/2 bestanden');
  process.exit(1);
}
console.log('ok   Probe im zweiten Lauf');
console.log('\n2/2 bestanden');
