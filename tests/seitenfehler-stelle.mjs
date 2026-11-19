// Erste Code-Stelle aus dem Stapel eines Seitenfehlers (pageerror), ohne Rechner und Port. Probe: tests/seitenfehler-stelle.test.mjs
// Eine Stelle ist eine Stapelzeile mit Zeile:Spalte: Chromium "at f (url:z:s)", WebKit "f@url:z:s". Eingebaute Rahmen
// ("at JSON.parse (<anonymous>)", "parse@[native code]") zaehlen nicht. Die Meldung steht bei Playwright vorn im Stapel
// (Chromium und WebKit); mit `meldung` wird sie samt Folgezeilen abgeschnitten, sonst zaehlt sie nur nicht als Stelle,
// solange sie nicht selbst wie eine endet (Kaltreview 19.11., B1-B3).
export function stelleAusStapel(stapel, meldung = '') {
  let rest = String(stapel || '');
  const i = meldung ? rest.indexOf(meldung) : -1;
  if (i >= 0) rest = rest.slice(i + meldung.length);
  const stelle = rest.split('\n').map((z) => z.trim()).find((z) => /^at .*:\d+:\d+\)?$/.test(z) || /@.*:\d+:\d+$/.test(z)) || '';
  return stelle.replace(/https?:\/\/[^/]+/, '');
}
