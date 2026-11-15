// Probe-Suite fuer tests/r19-suite-absturz.test.mjs: meldet einen Absturz des Browsers, endet aber mit Exit 0 (etwa eine
// Suite, die ihn still wiederholt). Ein erkannter Absturz macht die Suite trotzdem zum FEHLER.
console.log('Fehler: page.evaluate: Target crashed');
console.log('ok   Probe nach Wiederholung');
console.log('\n1/1 bestanden');
