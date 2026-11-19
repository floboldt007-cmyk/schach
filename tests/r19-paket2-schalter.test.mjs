// R19 Schalter "Paket 2" (Weltrangliste und Seasons): beides geht erst nach der Rechtspruefung live, die SQL dazu ist nicht
// eingespielt. Vorgabe aus: kein Welt-Reiter, kein Season-Bereich, kein Season-Abzeichen, kein Aufruf der Server-Funktionen.
// An nur im Testbetrieb auf dem eigenen Rechner (127.0.0.1 oder localhost, ?test und &paket2). Ohne Browser.
//   node tests/r19-paket2-schalter.test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lies = (d) => readFileSync(path.join(WURZEL, d), 'utf8');
let ok = 0;
let gesamt = 0;
function pruefe(name, bedingung, info) {
  gesamt++;
  if (bedingung) { ok++; console.log('ok   ' + name); } else console.error('FEHLER ' + name, info ?? '');
}

// 1) Der Schalter selbst
let paket2Frei = null;
try { ({ paket2Frei } = await import(pathToFileURL(path.join(WURZEL, 'js/freigaben.js')).href)); } catch (e) { /* unten rot */ }
pruefe('js/freigaben.js bietet paket2Frei an', typeof paket2Frei === 'function');
if (paket2Frei) {
  for (const [ort, soll, was] of [
    [{ hostname: '127.0.0.1', search: '?test&paket2' }, true, 'Testbetrieb auf 127.0.0.1'],
    [{ hostname: 'localhost', search: '?paket2&test' }, true, 'Testbetrieb auf localhost'],
    [{ hostname: '127.0.0.1', search: '?test' }, false, 'nur ?test'],
    [{ hostname: '127.0.0.1', search: '?paket2' }, false, 'nur &paket2'],
    [{ hostname: '127.0.0.1', search: '?testen&paket2' }, false, 'aehnlicher Name statt ?test'],
    [{ hostname: '127.0.0.1', search: '?test&paket22' }, false, 'aehnlicher Name statt paket2'],
    [{ hostname: 'crownmate.de', search: '?test&paket2' }, false, 'echte Domain'],
    [{ hostname: 'floboldt007-cmyk.github.io', search: '?test&paket2' }, false, 'GitHub Pages'],
    [{ hostname: '127.0.0.1.crownmate.de', search: '?test&paket2' }, false, 'Domain, die mit 127.0.0.1 beginnt'],
    [{ hostname: '', search: '' }, false, 'leere Adresse'],
  ]) pruefe(`Schalter ${soll ? 'an' : 'aus'}: ${was}`, paket2Frei(ort) === soll);
  pruefe('Schalter aus: ohne Adresse (Node, kein location)', paket2Frei() === false);
}

// 2) Vorgabe aus: der Client ruft die Server-Funktionen nicht auf
const aufrufe = [];
globalThis.fetch = async (url) => { aufrufe.push(String(url)); return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }); };
const speicher = new Map([['schach-arena:konto:sitzung', JSON.stringify({ access_token: 'a.e30.x', refresh_token: 'r', expires_at: 9999999999, user: { id: 'u1' } })]]);
globalThis.localStorage = { getItem: (k) => speicher.get(k) ?? null, setItem: (k, v) => speicher.set(k, String(v)), removeItem: (k) => speicher.delete(k) };
const kronen = await import(pathToFileURL(path.join(WURZEL, 'js/kronen.js')).href);
const karte = await import(pathToFileURL(path.join(WURZEL, 'js/karte.js')).href);
pruefe('Aus: holeSaison liefert null', await kronen.holeSaison() === null);
const titel = await kronen.waehleSaisonTitel('crownmaster-s1').then(() => 'angenommen', () => 'abgelehnt');
pruefe('Aus: waehleSaisonTitel lehnt ab', titel === 'abgelehnt', titel);
await karte.karteDerPartie('partie-1', { frist: 200 });
pruefe('Aus: kein Aufruf von saison_mein_stand, saison_titel_waehle, saison_karte_der_partie', !aufrufe.some((u) => /\/rpc\/saison_/.test(u)), aufrufe);

// 3) Die Stellen in der App haengen am Schalter
const index = lies('js/pakete/liga/index.js');
const block = index.match(/if \(paket2Frei\(\)\) \{([\s\S]*?)\n  \}/);
pruefe('Liga: Season-Bereich und Welt-Reiter stehen hinter dem Schalter', !!block && /'ich:kopf'/.test(block[1]) && /reiterWelt\(\)/.test(block[1]));
pruefe('Liga: ausserhalb des Schalters kein Welt-Reiter und kein Season-Bereich',
  !index.replace(block?.[0] ?? '', '').match(/reiterWelt\(\)|m\.fuelleSaison/));
const welt = lies('js/pakete/liga/welt.js');
pruefe('Welt: ruft den Server nur mit Schalter', /paket2Frei\(\)/.test(welt));
const saison = lies('js/pakete/liga/saison.js');
pruefe('Alle Ligen: Season-Regel nur mit Schalter', /paket2Frei\(\)[^\n]*\n?[^\n]*ss-ligen-regel/.test(saison));

// 4) Datenschutz: die ungeprueften Abschnitte stehen nicht im Live-Stand
for (const [datei, verboten] of [
  ['datenschutz.html', ['<h3>Seasons</h3>', '<h3>Weltrangliste</h3>', 'Season-Abzeichen', 'Season-Titel']],
  ['datenschutz-en.html', ['<h3>Seasons</h3>', '<h3>World ranking</h3>', 'season badge', 'season title']],
]) {
  const html = lies(datei);
  const da = verboten.filter((x) => html.includes(x));
  pruefe(`${datei}: keine Abschnitte zu Seasons und Weltrangliste`, da.length === 0, da);
}

console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
