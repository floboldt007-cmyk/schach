// Erste Code-Stelle aus dem Stapel eines Seitenfehlers (pageerror), ohne Rechner und Port. Probe: tests/seitenfehler-stelle.test.mjs
// Eine Stelle ist eine Stapelzeile: Chromium beginnt mit "at ", WebKit endet mit "@url:zeile:spalte". Die Meldungszeile
// (Chromium setzt sie an den Anfang) zaehlt nie, auch wenn sie "at ", "@" oder ".js" enthaelt.
export function stelleAusStapel(stapel) {
  const stelle = String(stapel || '').split('\n').map((z) => z.trim()).find((z) => /^at /.test(z) || /@.*:\d+:\d+$/.test(z)) || '';
  return stelle.replace(/https?:\/\/[^/]+/, '');
}
