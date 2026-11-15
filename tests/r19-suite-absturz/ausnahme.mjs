// Probe-Suite fuer tests/r19-suite-absturz.test.mjs (Fix-Review 64, KRITISCH): der ERSTE Lauf hat einen Seitenabsturz (Zeile
// wie tests/browser.mjs) und einen inhaltlichen Fehler als unbehandelte Ausnahme, also ohne eigene FEHLER-Zeile; der zweite
// waere gruen. alle.mjs darf ihn nicht wiederholen, sonst verschwindet die Ausnahme. Marke und Zaehler wie gemischt.mjs.
import { appendFileSync, existsSync, writeFileSync } from 'node:fs';
const marke = process.env.ABSTURZ_MARKE;
if (process.env.LAEUFE_DATEI) appendFileSync(process.env.LAEUFE_DATEI, 'lauf\n');
if (marke && !existsSync(marke)) {
  writeFileSync(marke, 'erster Lauf');
  console.log('ok   Probe vorher');
  console.log('FEHLER Seite abgestuerzt (Target crashed) in ausnahme: Ansicht #partie, Viewport 375x667');
  throw new Error('Probe-Ausnahme: Brett 352 statt 360 px');
}
console.log('ok   Probe im zweiten Lauf');
console.log('\n2/2 bestanden');
