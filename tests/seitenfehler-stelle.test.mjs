// Stellen-Suche fuer Seitenfehler (tests/seitenfehler-stelle.mjs): aus dem Stapel eines pageerror die erste Code-Stelle,
// damit ein Seitenfehler im CI-Protokoll sagt, ob er aus der App oder aus einem Skript des Tests kommt (Diagnose M-14:30).
// Stapel in beiden Schreibweisen: Chromium ("    at f (url:z:s)") und WebKit ("f@url:z:s"). Reiner Node-Test, kein Browser.
import { stelleAusStapel, swWechselFilter } from './seitenfehler-stelle.mjs';

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

// Kaltreview 19.11. (B1-B3): eingebaute Rahmen ohne Zeile:Spalte sind keine Stelle, und die Meldung (auch mehrzeilig)
// wird vorn abgeschnitten, wenn sie mitgegeben ist. Playwright liefert auch in WebKit die Meldungszeile vorn (Probe 19.11.)
gleich('B1 Chromium: eingebauter Rahmen (JSON.parse) wird uebersprungen',
  stelleAusStapel('SyntaxError: Unexpected token\n    at JSON.parse (<anonymous>)\n    at lade (http://127.0.0.1:4321/js/z.js:5:6)'),
  'at lade (/js/z.js:5:6)');
gleich('B1 Chromium: eingebauter Rahmen (new Promise) wird uebersprungen',
  stelleAusStapel('Error: x\n    at new Promise (<anonymous>)\n    at warte (http://127.0.0.1:4321/js/z.js:8:1)'),
  'at warte (/js/z.js:8:1)');
const b2 = 'Modul fehlt: lade@http://127.0.0.1:4321/js/z.js:5:6';
gleich('B2 Meldung, die wie eine WebKit-Stelle endet, zaehlt nicht',
  stelleAusStapel(`Error: ${b2}\n    at start (http://127.0.0.1:4321/js/a.js:1:2)`, b2), 'at start (/js/a.js:1:2)');
const b3 = 'Zeile eins\nat zwei (http://127.0.0.1:4321/js/x.js:1:1)';
gleich('B3 mehrzeilige Meldung mit Folgezeile "at ..." zaehlt nicht',
  stelleAusStapel(`Error: ${b3}\n    at echt (http://127.0.0.1:4321/js/y.js:3:4)`, b3), 'at echt (/js/y.js:3:4)');
gleich('Meldung, die im Stapel fehlt, aendert nichts',
  stelleAusStapel('zeige@http://127.0.0.1:4321/js/ui/verlauf.js:12:5', 'andere Meldung'), 'zeige@/js/ui/verlauf.js:12:5');

// Worker-Wechsel (WebKit in der CI, Laeufe 44538473111, 44530007843, 44519489369): die eigene 7-s-Anfrage __langsam laeuft
// durch den alten Worker, der beim Uebernehmen der neuen Fassung endet. WebKit meldet das dreimal: requestfailed mit Adresse,
// pageerror und Konsole ohne Adresse. Still wird es nur fuer die eigene Adresse, und eine Meldung nur mit passender Anfrage.
const EIGEN = 'http://127.0.0.1:4321/';
const ZU = 'Service Worker context closed';
{
  const f = swWechselFilter(EIGEN), fehler = [];
  const ab = f.anfrage(ZU, EIGEN + 'schach/__langsam?ms=7000', fehler);
  f.melde('seite', ZU, '', 'Seitenfehler: ' + ZU, fehler);
  f.melde('konsole', 'Failed to load resource: ' + ZU, '', 'Failed to load resource: ' + ZU, fehler);
  pruefe('Wechsel: eigene Anfrage zuerst, danach Seite und Konsole: alles still', ab && fehler.length === 0, { ab, fehler });
}
{
  const f = swWechselFilter(EIGEN), fehler = [];
  f.melde('seite', ZU, '', 'Seitenfehler: ' + ZU, fehler);
  f.melde('konsole', 'Failed to load resource: ' + ZU, '', 'Failed to load resource: ' + ZU, fehler);
  const vorher = fehler.length;
  const ab = f.anfrage(ZU, EIGEN + 'schach/__langsam?ms=7000', fehler);
  pruefe('Wechsel: Meldungen vor der Anfrage werden mit ihr wieder still', vorher === 2 && ab && fehler.length === 0, { vorher, ab, fehler });
}
{
  const f = swWechselFilter(EIGEN), fehler = [];
  const ab = f.anfrage(ZU, 'https://fremd.example/x.js', fehler);
  f.melde('seite', ZU, '', 'Seitenfehler: ' + ZU, fehler);
  pruefe('Gegenprobe: dieselbe Meldung fuer eine fremde Adresse bleibt rot', !ab && fehler.length === 1, { ab, fehler });
}
{
  const f = swWechselFilter(EIGEN), fehler = [];
  f.melde('seite', ZU, '', 'Seitenfehler: ' + ZU, fehler);
  pruefe('Gegenprobe: Meldung ohne passende Anfrage bleibt rot', fehler.length === 1, fehler);
}
{
  const f = swWechselFilter(EIGEN), fehler = [];
  f.anfrage(ZU, EIGEN + 'schach/__langsam?ms=7000', fehler);
  f.melde('seite', ZU, '', 'Seitenfehler: ' + ZU, fehler);
  f.melde('seite', ZU, '', 'Seitenfehler: ' + ZU, fehler);
  pruefe('Gegenprobe: je Anfrage nur eine Meldung jeder Art still', fehler.length === 1, fehler);
}
{
  const f = swWechselFilter(EIGEN), fehler = [];
  const ab = f.anfrage('Load failed', EIGEN + 'schach/a.js', fehler);
  f.melde('seite', 'Service Worker context closed bei x', '', 'Seitenfehler: Service Worker context closed bei x', fehler);
  pruefe('Gegenprobe: anderer Grund und andere Meldung bleiben Fehler', !ab && fehler.length === 1, { ab, fehler });
}
{
  const f = swWechselFilter(EIGEN), fehler = [];
  f.anfrage(ZU, EIGEN + 'schach/__langsam?ms=7000', fehler);
  f.melde('konsole', 'Failed to load resource: ' + ZU, 'https://fremd.example/y', 'Failed to load resource: ' + ZU + ' @ https://fremd.example/y', fehler);
  pruefe('Gegenprobe: Konsolenmeldung mit fremder Adresse bleibt rot', fehler.length === 1, fehler);
}

const gut = ergebnisse.filter((e) => e.ok).length;
console.log(`\n${gut}/${ergebnisse.length} bestanden`);
process.exit(gut === ergebnisse.length ? 0 : 1);
