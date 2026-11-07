// Raetsel-Duell (Etappe 5), Server-Seite: fuehrt online-schema.sql, kronen-schema.sql, raetsel-duell-schema.sql, die
// Raetsel-Daten und supabase/raetsel-duell-rls-test.sql WIRKLICH aus, in PGlite (Postgres als WebAssembly, ohne Netz).
// Laeuft im CI-Job "sql" (.github/workflows/tests.yml) wie tests/server-kronen.test.mjs; lokal nur mit PGlite in
// node_modules (npm install --no-save --ignore-scripts @electric-sql/pglite@0.5.11).
//   node tests/server-raetsel-duell.test.mjs
//
// WICHTIG: Die Auth-Attrappe bildet Supabase nur naeherungsweise nach (wie in server-kronen.test.mjs). Ein gruener Lauf
// ersetzt NICHT den einmaligen Lauf von raetsel-duell-rls-test.sql im Supabase SQL Editor vor dem Einspielen.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lies = (d) => readFileSync(path.join(WURZEL, d), 'utf8');
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
  try {
    await db.exec(sql);
    return null;
  } catch (e) {
    return `${name}: ${e.message}`;
  }
}

const db = new PGlite();
pruefe('Auth-Attrappe angelegt', (await lauf(db, 'Attrappe', ATTRAPPE)) === null);
for (const datei of ['supabase/online-schema.sql', 'supabase/kronen-schema.sql', 'supabase/raetsel-duell-schema.sql',
  'supabase/raetsel-duell-daten.sql']) {
  const f = await lauf(db, datei, lies(datei));
  pruefe(`${datei} laeuft`, f === null, f);
}
let f = await lauf(db, 'raetsel-duell-schema.sql (zweites Mal)', lies('supabase/raetsel-duell-schema.sql'));
pruefe('raetsel-duell-schema.sql ist wiederholbar', f === null, f);
f = await lauf(db, 'raetsel-duell-daten.sql (zweites Mal)', lies('supabase/raetsel-duell-daten.sql'));
pruefe('raetsel-duell-daten.sql ist wiederholbar', f === null, f);
const anzahl = await db.query('select count(*)::int as n from public.duell_raetsel');
pruefe('alle Raetsel der Datei sind in der Tabelle', anzahl.rows[0].n === 3040, JSON.stringify(anzahl.rows));
// kronen-schema.sql nach dem Duell-Schema noch einmal: die Duell-Quellen und Konstanten bleiben erhalten
f = await lauf(db, 'kronen-schema.sql (nach dem Duell-Schema)', lies('supabase/kronen-schema.sql'));
pruefe('kronen-schema.sql laeuft nach dem Duell-Schema', f === null, f);
f = await lauf(db, 'kronen-rls-test.sql', lies('supabase/kronen-rls-test.sql'));
pruefe('kronen-rls-test.sql laeuft weiter ohne FEHLER', f === null, f);
f = await lauf(db, 'raetsel-duell-rls-test.sql', lies('supabase/raetsel-duell-rls-test.sql'));
pruefe('raetsel-duell-rls-test.sql laeuft ohne FEHLER', f === null, f);
if (f !== null) await lauf(db, 'Aufraeumen nach Fehler', 'rollback;');
const rest = await db.query('select count(*)::int as n from auth.users');
pruefe('RLS-Test hat alles zurueckgerollt', rest.rows[0].n === 0, JSON.stringify(rest.rows));

// Gegenprobe: ein fehlschlagender Abschnitt muss den Lauf wirklich rot machen
f = await lauf(db, 'Probe', "begin; do $$ begin raise exception 'FEHLER: Probe'; end; $$; rollback;");
pruefe('ein FEHLER im SQL wird erkannt', f !== null && f.includes('FEHLER: Probe'), f);
await lauf(db, 'Aufraeumen nach Probe', 'rollback;');

// Rueckweg: alles Duell-Eigene weg, Kronen bleiben, danach laesst sich das Schema wieder einspielen
f = await lauf(db, 'raetsel-duell-zurueck.sql', lies('supabase/raetsel-duell-zurueck.sql'));
pruefe('raetsel-duell-zurueck.sql laeuft', f === null, f);
const uebrig = await db.query(`select
    (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname like 'duell\\_%') as funktionen,
    (select count(*)::int from pg_tables where schemaname = 'public' and tablename like 'duell%') as tabellen,
    (select count(*)::int from pg_tables where schemaname = 'public' and tablename = 'kronen_stand') as kronen`);
const u = uebrig.rows[0];
pruefe('nach dem Rueckweg keine Duell-Funktion oder -Tabelle mehr, Kronen bleiben',
  u.funktionen === 0 && u.tabellen === 0 && u.kronen === 1, JSON.stringify(u));
f = await lauf(db, 'kronen-rls-test.sql (nach Rueckweg)', lies('supabase/kronen-rls-test.sql'));
pruefe('kronen-rls-test.sql laeuft nach dem Duell-Rueckweg', f === null, f);
for (const datei of ['supabase/raetsel-duell-schema.sql', 'supabase/raetsel-duell-daten.sql', 'supabase/raetsel-duell-rls-test.sql']) {
  f = await lauf(db, `${datei} (nach Rueckweg)`, lies(datei));
  pruefe(`${datei} laeuft nach dem Rueckweg wieder`, f === null, f);
}

await db.close();
console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
