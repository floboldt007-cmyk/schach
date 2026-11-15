// Probe-Suite fuer tests/r19-suite-absturz.test.mjs (Kaltreview b4): der ERSTE Lauf meldet einen Seitenabsturz und haengt
// danach, bis die Frist ihn beendet. alle.mjs wiederholt ihn nicht und schreibt den Grund ins Protokoll.
import { existsSync, writeFileSync } from 'node:fs';
const marke = process.env.ABSTURZ_MARKE;
if (marke && !existsSync(marke)) {
  writeFileSync(marke, 'erster Lauf');
  console.log('FEHLER Seite abgestuerzt (Target crashed) in haengt-absturz: Ansicht #partie, Viewport 375x667');
  setInterval(() => {}, 1000);
} else {
  console.log('ok   Probe im zweiten Lauf');
  console.log('\n1/1 bestanden');
}
