// Probe-Suite fuer tests/r19-suite-absturz.test.mjs (Kaltreview b4, KRITISCH): der ERSTE Lauf hat einen Seitenabsturz und
// nur eine Meldung auf stderr mit Exit 1; der zweite waere gruen. alle.mjs erkennt das am fehlenden Ende "x/y bestanden" und wiederholt nicht.
import { appendFileSync, existsSync, writeFileSync } from 'node:fs';
const marke = process.env.ABSTURZ_MARKE;
if (process.env.LAEUFE_DATEI) appendFileSync(process.env.LAEUFE_DATEI, 'lauf\n');
if (marke && !existsSync(marke)) {
  writeFileSync(marke, 'erster Lauf');
  console.log('FEHLER Seite abgestuerzt (Target crashed) in stumm: Ansicht #partie, Viewport 375x667');
  console.error('Probe-stderr: Brett fehlt'); process.exit(1);
}
console.log('ok   Probe im zweiten Lauf');
console.log('\n1/1 bestanden');
