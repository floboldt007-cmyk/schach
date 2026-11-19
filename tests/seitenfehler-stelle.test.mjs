// Stellen-Suche fuer Seitenfehler (tests/seitenfehler-stelle.mjs): aus dem Stapel eines pageerror die erste Code-Stelle,
// damit ein Seitenfehler im CI-Protokoll sagt, ob er aus der App oder aus einem Skript des Tests kommt (Diagnose M-14:30).
// Stapel in beiden Schreibweisen: Chromium ("    at f (url:z:s)") und WebKit ("f@url:z:s"). Reiner Node-Test, kein Browser.
import { stelleAusStapel } from './seitenfehler-stelle.mjs';

const ergebnisse = [];
function pruefe(name, ok, detail = '') {
  ergebnisse.push({ name, ok });
  console.log(`${ok ? 'ok  ' : 'FEHLER'} ${name}${ok ? '' : ' ' + JSON.stringify(detail)}`);
}
const gleich = (name, ist, soll) => pruefe(name, ist === soll, { ist, soll });

gleich('Chromium: erste Stelle, ohne Rechner und Port',
  stelleAusStapel("TypeError: Cannot read properties of null (reading 'x')\n    at zeige (http://127.0.0.1:4321/js/ui/verlauf.js:12:5)\n    at http://127.0.0.1:4321/js/app.js:3:1"),
  'at zeige (/js/ui/verlauf.js:12:5)');
gleich('Chromium: Stelle ohne Funktionsnamen',
  stelleAusStapel('Error: kaputt\n    at http://127.0.0.1:4321/js/app.js:3:1'),
  'at /js/app.js:3:1');
gleich('WebKit: erste Stelle, ohne Rechner und Port',
  stelleAusStapel('zeige@http://127.0.0.1:4321/js/ui/verlauf.js:12:5\nglobal code@http://127.0.0.1:4321/js/app.js:3:1'),
  'zeige@/js/ui/verlauf.js:12:5');
gleich('WebKit: anonyme Stelle',
  stelleAusStapel('@http://127.0.0.1:4321/js/brett.js:7:9'),
  '@/js/brett.js:7:9');
// die Meldungszeile ist nie die Stelle, auch wenn sie "at ", "@" oder ".js" enthaelt
gleich('Meldung mit "that " ist keine Stelle',
  stelleAusStapel('Error: The object that was passed is invalid\n    at pruefe (http://127.0.0.1:4321/js/konto.js:40:3)'),
  'at pruefe (/js/konto.js:40:3)');
gleich('Meldung mit ".js" ist keine Stelle',
  stelleAusStapel('Error: Laden von modul.js fehlgeschlagen\n    at lade (http://127.0.0.1:4321/js/lader.js:2:1)'),
  'at lade (/js/lader.js:2:1)');
gleich('Meldung mit "@" ist keine Stelle',
  stelleAusStapel('Error: Adresse a@b.de ungueltig\n    at sende (http://127.0.0.1:4321/js/konto.js:9:1)'),
  'at sende (/js/konto.js:9:1)');
gleich('nur die Meldung, keine Stelle: leer', stelleAusStapel('Error: boom at start'), '');
gleich('leerer Stapel: leer', stelleAusStapel(''), '');
gleich('kein Stapel: leer', stelleAusStapel(undefined), '');
gleich('Skript des Tests (page.evaluate) wird genannt',
  stelleAusStapel('Error: x\n    at eval (eval at evaluate (:291:30), <anonymous>:1:7)'),
  'at eval (eval at evaluate (:291:30), <anonymous>:1:7)');

const gut = ergebnisse.filter((e) => e.ok).length;
console.log(`\n${gut}/${ergebnisse.length} bestanden`);
process.exit(gut === ergebnisse.length ? 0 : 1);
