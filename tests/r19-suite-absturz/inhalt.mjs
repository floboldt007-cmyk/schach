// Probe-Suite fuer tests/r19-suite-absturz.test.mjs: ein gewoehnlicher (inhaltlicher) FEHLER ohne Absturz. Jeder Lauf
// haengt eine Zeile an LAEUFE_DATEI, damit die Pruefung sieht, dass alle.mjs ihn nicht wiederholt.
import { appendFileSync } from 'node:fs';
if (process.env.LAEUFE_DATEI) appendFileSync(process.env.LAEUFE_DATEI, 'lauf\n');
console.log('FEHLER Probe: Brett 352 statt 360 px');
console.log('\n0/1 bestanden');
process.exit(1);
