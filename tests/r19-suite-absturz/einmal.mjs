// Probe-Suite fuer tests/r19-suite-absturz.test.mjs: stuerzt beim ERSTEN Lauf ab ("Target crashed", Exit 1) und besteht
// beim zweiten. Die Marke (ABSTURZ_MARKE, eine Datei) haelt fest, dass der erste Lauf war.
import { existsSync, writeFileSync } from 'node:fs';
const marke = process.env.ABSTURZ_MARKE;
if (marke && !existsSync(marke)) {
  writeFileSync(marke, 'erster Lauf');
  console.log('FEHLER Probe: page.evaluate: Target crashed');
  console.log('\n0/1 bestanden');
  process.exit(1);
}
console.log('ok   Probe im zweiten Lauf');
console.log('\n1/1 bestanden');
