// Tageszaehler (Etappe B, Task 8), Server-Seite: fuehrt supabase/online-schema.sql, supabase/kronen-schema.sql (liefert
// den Schalter kronen_schalter.zaehler_an), supabase/zaehler-schema.sql und supabase/zaehler-rls-test.sql WIRKLICH aus,
// in PGlite (Postgres als WebAssembly, ohne Netz, ohne Supabase). Laeuft im CI-Job "sql" (.github/workflows/tests.yml);
// lokal ist PGlite nicht installiert (kein npm install auf dem PC) und der Test bricht ab.
//   node tests/server-zaehler.test.mjs
//
// Die Auth-Attrappe ist die aus tests/server-kronen.test.mjs (dort beschrieben, hier nur abgeschrieben, damit beide
// Dateien unabhaengig bleiben). Ein gruener Lauf hier ersetzt NICHT den einmaligen Lauf von zaehler-rls-test.sql im
// Supabase SQL Editor vor dem Einspielen.
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
pruefe('kronen-schema.sql laeuft (Voraussetzung: kronen_schalter)', f === null, f);
f = await lauf(db, 'zaehler-schema.sql', lies('supabase/zaehler-schema.sql'));
pruefe('zaehler-schema.sql laeuft', f === null, f);
f = await lauf(db, 'zaehler-schema.sql (zweites Mal)', lies('supabase/zaehler-schema.sql'));
pruefe('zaehler-schema.sql ist wiederholbar', f === null, f);

const aus = await db.query('select zaehler_an from public.kronen_schalter');
pruefe('nach dem Einspielen ist der Zaehler aus', aus.rows.length === 1 && aus.rows[0].zaehler_an === false, JSON.stringify(aus.rows));

f = await lauf(db, 'zaehler-rls-test.sql', lies('supabase/zaehler-rls-test.sql'));
pruefe('zaehler-rls-test.sql laeuft ohne FEHLER', f === null, f);

const rest = await db.query(`select (select count(*)::int from auth.users) as nutzer, (select count(*)::int from public.zaehler_tag) as zeilen,
  (select zaehler_an from public.kronen_schalter) as an`);
const r = rest.rows[0];
pruefe('RLS-Test hat alles zurueckgerollt (keine Nutzer, keine Zaehlerzeilen, Schalter wieder aus)', r.nutzer === 0 && r.zeilen === 0 && r.an === false, JSON.stringify(r));

// Gegenprobe: ein fehlschlagender Abschnitt muss den Lauf wirklich rot machen (sonst prueft dieser Test nichts)
f = await lauf(db, 'Probe', "begin; do $$ begin raise exception 'FEHLER: Probe'; end; $$; rollback;");
pruefe('ein FEHLER im SQL wird erkannt', f !== null && f.includes('FEHLER: Probe'), f);
await lauf(db, 'Aufraeumen nach Probe', 'rollback;');

// Rueckweg: Zaehler weg, Kronen bleiben; danach laesst sich das Schema wieder einspielen und der Test laeuft erneut
f = await lauf(db, 'zaehler-zurueck.sql', lies('supabase/zaehler-zurueck.sql'));
pruefe('zaehler-zurueck.sql laeuft', f === null, f);
const uebrig = await db.query(`select
    (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname like 'zaehler\\_%') as funktionen,
    (select count(*)::int from pg_tables where schemaname = 'public' and tablename = 'zaehler_tag') as tabelle,
    (select count(*)::int from pg_tables where schemaname = 'public' and tablename = 'kronen_schalter') as schalter`);
const u = uebrig.rows[0];
pruefe('nach dem Rueckweg keine Zaehler-Funktion oder -Tabelle mehr, kronen_schalter bleibt',
  u.funktionen === 0 && u.tabelle === 0 && u.schalter === 1, JSON.stringify(u));
f = await lauf(db, 'zaehler-zurueck.sql (zweites Mal)', lies('supabase/zaehler-zurueck.sql'));
pruefe('zaehler-zurueck.sql ist wiederholbar', f === null, f);
f = await lauf(db, 'zaehler-schema.sql (nach Rueckweg)', lies('supabase/zaehler-schema.sql'));
pruefe('zaehler-schema.sql laeuft nach dem Rueckweg wieder', f === null, f);
f = await lauf(db, 'zaehler-rls-test.sql (nach Rueckweg)', lies('supabase/zaehler-rls-test.sql'));
pruefe('zaehler-rls-test.sql laeuft nach dem Rueckweg wieder', f === null, f);

await db.close();
console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
