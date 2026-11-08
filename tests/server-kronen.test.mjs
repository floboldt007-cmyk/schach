// Liga mit Kronen (Etappe B), Server-Seite: fuehrt supabase/online-schema.sql, supabase/kronen-schema.sql und
// supabase/kronen-rls-test.sql WIRKLICH aus, in PGlite (Postgres als WebAssembly, ohne Netz, ohne Supabase).
// Laeuft im eigenen CI-Job "sql" (.github/workflows/tests.yml), der PGlite in fester Version und ohne
// Installations-Skripte holt; lokal ist PGlite nicht installiert (kein npm install auf dem PC) und der Test bricht ab.
//   node tests/server-kronen.test.mjs
//
// WICHTIG: Die Auth-Attrappe unten bildet Supabase nur naeherungsweise nach (auth.users mit zwei Spalten, auth.uid()
// aus request.jwt.claims, die Rollen anon/authenticated/service_role mit den Standardrechten von Supabase auf neue
// Tabellen, Funktionen und Sequenzen). Ein gruener Lauf hier ersetzt NICHT den einmaligen Lauf von
// kronen-rls-test.sql im Supabase SQL Editor vor dem Einspielen.
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
-- wie Supabase: neue Objekte in public sind fuer die API-Rollen erst einmal offen (deshalb die revokes in den Schemas)
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
let f = await lauf(db, 'online-schema.sql', lies('supabase/online-schema.sql'));
pruefe('online-schema.sql laeuft', f === null, f);
f = await lauf(db, 'kronen-schema.sql', lies('supabase/kronen-schema.sql'));
pruefe('kronen-schema.sql laeuft', f === null, f);
f = await lauf(db, 'kronen-schema.sql (zweites Mal)', lies('supabase/kronen-schema.sql'));
pruefe('kronen-schema.sql ist wiederholbar', f === null, f);
f = await lauf(db, 'kronen-rls-test.sql', lies('supabase/kronen-rls-test.sql'));
pruefe('kronen-rls-test.sql laeuft ohne FEHLER', f === null, f);

const rest = await db.query("select count(*)::int as n from auth.users");
pruefe('RLS-Test hat alles zurueckgerollt', rest.rows[0].n === 0, JSON.stringify(rest.rows));

// Gegenprobe: ein fehlschlagender Abschnitt muss den Lauf wirklich rot machen (sonst prueft dieser Test nichts)
f = await lauf(db, 'Probe', "begin; do $$ begin raise exception 'FEHLER: Probe'; end; $$; rollback;");
pruefe('ein FEHLER im SQL wird erkannt', f !== null && f.includes('FEHLER: Probe'), f);
await lauf(db, 'Aufraeumen nach Probe', 'rollback;');

// Rueckweg: alles weg, danach laesst sich das Schema wieder einspielen und der Test laeuft erneut
f = await lauf(db, 'kronen-zurueck.sql', lies('supabase/kronen-zurueck.sql'));
pruefe('kronen-zurueck.sql laeuft', f === null, f);
const uebrig = await db.query(`select
    (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and (p.proname like 'kronen\\_%' or p.proname like 'online\\_suche\\_%' or p.proname like 'zaehler\\_%')) as funktionen,
    (select count(*)::int from pg_tables where schemaname = 'public' and (tablename like 'kronen\\_%' or tablename like 'suche\\_%')) as tabellen,
    (select count(*)::int from information_schema.columns where table_name = 'partien_online' and column_name = 'gewertet') as spalte,
    (select count(*)::int from pg_trigger where tgname = 'kronen_nach_partie') as trigger`);
const u = uebrig.rows[0];
pruefe('nach dem Rueckweg keine Kronen-Funktion, -Tabelle, Spalte oder Trigger mehr',
  u.funktionen === 0 && u.tabellen === 0 && u.spalte === 0 && u.trigger === 0, JSON.stringify(u));
f = await lauf(db, 'kronen-schema.sql (nach Rueckweg)', lies('supabase/kronen-schema.sql'));
pruefe('kronen-schema.sql laeuft nach dem Rueckweg wieder', f === null, f);
f = await lauf(db, 'kronen-rls-test.sql (nach Rueckweg)', lies('supabase/kronen-rls-test.sql'));
pruefe('kronen-rls-test.sql laeuft nach dem Rueckweg wieder', f === null, f);

await db.close();
console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
