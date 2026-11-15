// Probe-Suite fuer tests/r19-suite-absturz.test.mjs (Kaltreview b4, KRITISCH): der ERSTE Lauf hat einen Seitenabsturz und
// ein geworfenes Objekt; der zweite waere gruen. alle.mjs erkennt das am fehlenden Ende "x/y bestanden" und wiederholt nicht.
import { appendFileSync, existsSync, writeFileSync } from 'node:fs';
const marke = process.env.ABSTURZ_MARKE;
if (process.env.LAEUFE_DATEI) appendFileSync(process.env.LAEUFE_DATEI, 'lauf\n');
if (marke && !existsSync(marke)) {
  writeFileSync(marke, 'erster Lauf');
  console.log('FEHLER Seite abgestuerzt (Target crashed) in objekt: Ansicht #partie, Viewport 375x667');
  throw { probe: 'Objekt statt Error' };
}
console.log('ok   Probe im zweiten Lauf');
console.log('\n1/1 bestanden');
