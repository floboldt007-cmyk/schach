// Probe-Suite fuer tests/r19-suite-absturz.test.mjs (Fix-Review 64): der ERSTE Lauf endet mit einem Absturz als unbehandelte
// Ausnahme und keiner einzigen FEHLER-Zeile; der zweite waere gruen. Ohne FEHLER-Zeile weiss alle.mjs nicht, ob neben dem
// Absturz noch etwas schiefging: keine Wiederholung, die Suite bleibt FEHLER. Marke und Zaehler wie gemischt.mjs.
import { appendFileSync, existsSync, writeFileSync } from 'node:fs';
const marke = process.env.ABSTURZ_MARKE;
if (process.env.LAEUFE_DATEI) appendFileSync(process.env.LAEUFE_DATEI, 'lauf\n');
if (marke && !existsSync(marke)) {
  writeFileSync(marke, 'erster Lauf');
  console.log('ok   Probe vorher');
  throw new Error('page.evaluate: Target crashed');
}
console.log('ok   Probe im zweiten Lauf');
console.log('\n2/2 bestanden');
