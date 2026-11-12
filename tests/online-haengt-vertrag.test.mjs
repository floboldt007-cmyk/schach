// Haengende Online-Partie: Vertrag von supabase/zwei-ligen-schema.sql (online_haengt, ranked_haengt_s) mit
// js/ui/online.js (Node, ohne Datenbank, ohne Browser). Der Server beendet eine gewertete Partie mit Uhr ohne den
// 2. Halbzug nach ranked_haengt_s Sekunden ohne Zug, jede andere nach 10 Minuten. Die Oberflaeche fragt erst danach
// (online_pruefe_zeit): bei gewerteten Partien eine Sekunde nach dem Server, bei Freundespartien nach 10 Minuten.
// Aendert eine Seite ihre Zahl, wird dieser Test rot, bis die andere nachzieht.
//   node tests/online-haengt-vertrag.test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lies = (d) => readFileSync(path.join(WURZEL, d), 'utf8').replace(/\r/g, '');
let ok = 0;
let gesamt = 0;
function pruefe(name, bedingung, info) {
  gesamt++;
  if (bedingung) { ok++; console.log('ok     ' + name); } else console.log('FEHLER ' + name + (info !== undefined ? '  -> ' + JSON.stringify(info) : ''));
}

// ---------- Server: zuletzt eingespielte Fassung in zwei-ligen-schema.sql ----------
const sql = lies('supabase/zwei-ligen-schema.sql').split('\n').map((z) => z.replace(/--.*$/, '')).join('\n');
const fassungen = (name) => [...sql.matchAll(/create or replace function public\.([a-z_]+)\(([^)]*)\)\s*returns [a-z_.]+[\s\S]*?\$\$([\s\S]*?)\$\$;/g)]
  .filter((m) => m[1] === name).map((m) => ({ argumente: m[2], rumpf: m[3] }));
const konstanten = fassungen('kronen_konstanten').pop()?.rumpf || '';
const rankedS = Number((konstanten.match(/'ranked_haengt_s',\s*(\d+)/) || [])[1]);
pruefe('Server: ranked_haengt_s in kronen_konstanten', Number.isInteger(rankedS) && rankedS > 0, rankedS);

const haengt = fassungen('online_haengt').filter((f) => /bezug/.test(f.argumente)).pop()?.rumpf || '';
pruefe('Server: online_haengt(p, bezug) liest ranked_haengt_s fuer gewertete Partien',
  /when p\.gewertet then make_interval\(secs => coalesce\(\(public\.kronen_konstanten\(\) ->> 'ranked_haengt_s'\)/.test(haengt), haengt.trim());
const freundMin = Number((haengt.match(/else interval '(\d+) minutes'/) || [])[1]);
pruefe('Server: Freundespartien haengen nach festen Minuten', Number.isInteger(freundMin) && freundMin > 0, freundMin);

// ---------- Client: js/ui/online.js ----------
const js = lies('js/ui/online.js');
// Nur Zahlen, *, + und Klammern: so laesst sich der Ausdruck der Konstante ohne Import der Oberflaeche ausrechnen.
const konstante = (name) => {
  const ausdruck = (js.match(new RegExp(`const ${name} = ([^;\\n]+);`)) || [])[1];
  return ausdruck && /^[\d\s*+()]+$/.test(ausdruck) ? Function(`return (${ausdruck});`)() : NaN;
};
const rankedMs = konstante('HAENGT_RANKED_MS');
const freundMs = konstante('HAENGT_MS');
pruefe('Client: gewertete Partie fragt eine Sekunde nach dem Server (ranked_haengt_s + 1 s)',
  rankedMs === (rankedS + 1) * 1000, { client_ms: rankedMs, server_s: rankedS });
pruefe('Client: Freundespartie bleibt beim Server-Wert (10 Minuten)', freundMs === freundMin * 60 * 1000, { client_ms: freundMs, server_min: freundMin });
pruefe('Client: Wartezeit haengt an p.gewertet',
  /const haengtNachMs = \(?p\)? => p\.gewertet \? HAENGT_RANKED_MS : HAENGT_MS;/.test(js));
pruefe('Client: tick vergleicht mit haengtNachMs(p), nicht mit der festen Zahl',
  /halbzuege < 2 && p\.letzter_zug_am && Date\.now\(\) - Date\.parse\(p\.letzter_zug_am\) >= haengtNachMs\(p\)/.test(js)
    && !/>= HAENGT_MS\b/.test(js));
// Steht der Server beim ersten Nachfragen noch nicht auf "haengt" (Uhren weichen ab), darf die gewertete Partie nicht
// eine volle Minute festsitzen: die Wiederholung kommt nach hoechstens 5 s.
const rankedAbfrage = konstante('HAENGT_RANKED_ABFRAGE_MS');
pruefe('Client: gewertete Partie fragt bei Bedarf nach hoechstens 5 s erneut', rankedAbfrage > 0 && rankedAbfrage <= 5000, rankedAbfrage);
pruefe('Client: Wiederholung haengt an p.gewertet',
  /zeitPruefung = Date\.now\(\) \+ \(p\.gewertet \? HAENGT_RANKED_ABFRAGE_MS : HAENGT_ABFRAGE_MS\);/.test(js));

console.log(`\n${ok}/${gesamt} bestanden`);
if (ok !== gesamt) process.exit(1);
