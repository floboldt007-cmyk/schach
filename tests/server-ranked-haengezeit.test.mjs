// Ranked-Haengezeit (#237, Flo 12.11.2026: gewertet 30 s), Rueckweg WIRKLICH geprueft: Der PR #237 nannte als offen
// "Rueckweg von online_haengt ist nur gelesen, nicht getestet". Dieser Test spielt in PGlite (Postgres als WebAssembly,
// ohne Netz, ohne Supabase) die Schemas wie in Supabase ein, dann supabase/zwei-ligen-schema.sql (vorwaerts),
// supabase/zwei-ligen-zurueck.sql (Rueckweg) und danach wieder vorwaerts, und fragt jedes Mal public.online_haengt mit
// festen Zeitpunkten ab:
//   vorwaerts: gewertet MIT Uhr und vor dem 2. Halbzug haengt nach ranked_haengt_s (30 s), Freundespartie nach 10 Minuten
//   Rueckweg:  jede Partie mit Uhr wieder erst nach 10 Minuten (alte Fassung aus online-schema.sql)
//   immer:     nach 2 Halbzuegen haengt nichts, ohne Uhr erst nach 7 Tagen
// Die SQL-Dateien liest der Test nur. Laeuft im CI-Job "sql" (nicht in tests/alle.mjs, dort fehlt PGlite); lokal nur
// mit PGlite in node_modules (npm install --no-save --ignore-scripts @electric-sql/pglite@0.5.11).
//   node tests/server-ranked-haengezeit.test.mjs
//   HAENGT_RUECKWEG=<datei> node tests/server-ranked-haengezeit.test.mjs   anderer Rueckweg (Gegenprobe mit einer kaputten
//                                                                         Kopie ausserhalb des Repos)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lies = (d) => readFileSync(path.isAbsolute(d) ? d : path.join(WURZEL, d), 'utf8');
const RUECKWEG = process.env.HAENGT_RUECKWEG || 'supabase/zwei-ligen-zurueck.sql';
let ok = 0;
let gesamt = 0;
function pruefe(name, bedingung, info) {
  gesamt++;
  if (bedingung) { ok++; console.log('ok     ' + name); } else console.log('FEHLER ' + name + (info !== undefined ? '  -> ' + info : ''));
}

let PGlite;
try {
  ({ PGlite } = await import('@electric-sql/pglite'));
} catch (e) {
  console.log('FEHLER PGlite fehlt (nur im CI-Job "sql" installiert): ' + e.message);
  process.exit(1);
}

// Auth-Attrappe wie tests/server-zwei-ligen.test.mjs (die Schemas vergeben Rechte an diese Rollen)
const ATTRAPPE = `
create schema if not exists auth;
create table auth.users (id uuid primary key, email text);
create or replace function auth.uid() returns uuid language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid;
$$;
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
grant usage on schema public, auth to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`;
async function lauf(db, name, sql) {
  try { await db.exec(sql); return null; } catch (e) { return `${name}: ${e.message}`; }
}
// Reihenfolge wie in Supabase und in tests/server-zwei-ligen.test.mjs
const BISHER = ['supabase/schema.sql', 'supabase/abo-schema.sql', 'supabase/online-schema.sql', 'supabase/kronen-schema.sql',
  'supabase/raetsel-duell-schema.sql', 'supabase/raetsel-duell-daten.sql', 'supabase/karte-schema.sql',
  'supabase/liga-bild-schema.sql', 'supabase/daten-schema.sql'];
// laut Kopf von zwei-ligen-zurueck.sql nach dem Rueckweg erneut einzuspielen
const NACH_RUECKWEG = ['supabase/kronen-schema.sql', 'supabase/raetsel-duell-schema.sql', 'supabase/liga-bild-schema.sql',
  'supabase/daten-schema.sql'];

// Faelle: [Name, gewertet, Bedenkzeit (null = ohne Uhr), Zuege, Sekunden seit dem letzten Zug, haengt vorwaerts, haengt nach Rueckweg]
const TAG = 86400;
const FAELLE = [
  ['gewertet, Uhr, kein Zug, 29 s', true, 300, '', 29, false, false],
  ['gewertet, Uhr, kein Zug, 31 s', true, 300, '', 31, true, false],
  ['gewertet, Uhr, 1 Halbzug, 31 s', true, 300, 'e2e4', 31, true, false],
  ['gewertet, Uhr, kein Zug, 9:59 min', true, 300, '', 599, true, false],
  ['gewertet, Uhr, kein Zug, 10:01 min', true, 300, '', 601, true, true],
  ['gewertet, Uhr, 2 Halbzuege, 10:01 min', true, 300, 'e2e4 e7e5', 601, false, false],
  ['Freundespartie, Uhr, kein Zug, 31 s', false, 300, '', 31, false, false],
  ['Freundespartie, Uhr, kein Zug, 10:01 min', false, 300, '', 601, true, true],
  ['ohne Uhr, 6 Tage', false, null, 'e2e4', 6 * TAG, false, false],
  ['ohne Uhr, 8 Tage', false, null, 'e2e4', 8 * TAG, true, true],
];
const LETZTER = '2026-11-14T12:00:00Z';
async function haengt(db, [, gewertet, bedenkzeit, zuege, sek]) {
  const zeile = { status: 'laeuft', gewertet, bedenkzeit_s: bedenkzeit, zuege, letzter_zug_am: LETZTER };
  const r = await db.query(`select public.online_haengt(jsonb_populate_record(null::public.partien_online, $1::jsonb),
    $2::timestamptz + make_interval(secs => $3)) as h`, [JSON.stringify(zeile), LETZTER, sek]);
  return r.rows[0].h;
}
// die Fassung mit einem Argument (Aufraeumen, Reklamation) rechnet mit der echten Uhr
async function haengtJetzt(db, sek) {
  const r = await db.query(`select public.online_haengt(jsonb_populate_record(null::public.partien_online,
    jsonb_build_object('status', 'laeuft', 'gewertet', true, 'bedenkzeit_s', 300, 'zuege', '',
      'letzter_zug_am', pg_catalog.clock_timestamp() - make_interval(secs => $1)))) as h`, [sek]);
  return r.rows[0].h;
}
async function pruefeFaelle(db, stufe, spalte) {
  for (const f of FAELLE) {
    const ist = await haengt(db, f);
    const soll = f[spalte];
    pruefe(`${stufe}: ${f[0]} ${soll ? 'haengt' : 'haengt nicht'}`, ist === soll, `online_haengt = ${ist}`);
  }
  const jetzt = await haengtJetzt(db, 45);
  const soll = spalte === 5;
  pruefe(`${stufe}: Fassung mit einem Argument, gewertet seit 45 s ohne Zug ${soll ? 'haengt' : 'haengt nicht'}`, jetzt === soll,
    `online_haengt(p) = ${jetzt}`);
}

const db = new PGlite();
let f = await lauf(db, 'Attrappe', ATTRAPPE);
for (const d of BISHER) if (!f) f = await lauf(db, d, lies(d));
pruefe('bisherige Schemas laufen', f === null, f);
f = await lauf(db, 'zwei-ligen-schema.sql', lies('supabase/zwei-ligen-schema.sql'));
pruefe('zwei-ligen-schema.sql laeuft', f === null, f);
const konstante = Number((await db.query(`select (public.kronen_konstanten() ->> 'ranked_haengt_s')::integer as s`)).rows[0].s);
pruefe(`ranked_haengt_s ist 30 (Flo 12.11.2026), ist ${konstante}`, konstante === 30);
await pruefeFaelle(db, 'vorwaerts', 5);

f = await lauf(db, RUECKWEG, lies(RUECKWEG));
pruefe(`Rueckweg laeuft (${RUECKWEG})`, f === null, f);
await pruefeFaelle(db, 'nach Rueckweg', 6);
for (const d of NACH_RUECKWEG) {
  f = await lauf(db, d + ' (nach Rueckweg)', lies(d));
  pruefe(`${d} laeuft nach dem Rueckweg`, f === null, f);
}
// kronen-schema.sql bringt kronen_konstanten() ohne ranked_haengt_s zurueck: dann greift der Ersatzwert 600 s in der neuen
// Fassung. Ab hier gaelte die 10-Minuten-Regel also auch ohne den online_haengt-Teil des Rueckwegs (gemessen mit einer
// Kopie ohne diesen Teil: rot nur in der Stufe "nach Rueckweg"); geprueft wird beides
const nachher = (await db.query(`select public.kronen_konstanten() ->> 'ranked_haengt_s' as s`)).rows[0].s;
pruefe(`nach den alten Schemas fehlt ranked_haengt_s (Ersatzwert 600 s), ist ${nachher}`, nachher === null);
await pruefeFaelle(db, 'nach Rueckweg und den alten Schemas', 6);

f = await lauf(db, 'zwei-ligen-schema.sql (wieder vorwaerts)', lies('supabase/zwei-ligen-schema.sql'));
pruefe('zwei-ligen-schema.sql laeuft nach dem Rueckweg wieder', f === null, f);
await pruefeFaelle(db, 'wieder vorwaerts', 5);

await db.close();
console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
