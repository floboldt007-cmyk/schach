// Freunde-Rangliste, Server-Seite (Audit 09.11.2026: Obergrenze je gemeldeter Partie): fuehrt supabase/schema.sql
// (Profil), supabase/freunde-schema.sql und supabase/freunde-rls-test.sql WIRKLICH aus, in PGlite (Postgres als
// WebAssembly, ohne Netz, ohne Supabase). Laeuft im CI-Job "sql" (.github/workflows/tests.yml); lokal nur, wenn PGlite
// im Arbeitsbaum liegt (npm install --no-save --ignore-scripts).
//   node tests/server-freunde.test.mjs
//
// WICHTIG: Die Auth-Attrappe bildet Supabase nur naeherungsweise nach (wie in tests/server-karte.test.mjs). Ein gruener
// Lauf hier ersetzt NICHT den einmaligen Lauf von freunde-rls-test.sql im Supabase SQL Editor vor dem Einspielen.
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
create table auth.users (id uuid primary key, email text, created_at timestamptz default now());
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
let f = await lauf(db, 'schema.sql', lies('supabase/schema.sql'));
pruefe('supabase/schema.sql laeuft (Grundlage)', f === null, f);
f = await lauf(db, 'freunde-schema.sql', lies('supabase/freunde-schema.sql'));
pruefe('freunde-schema.sql laeuft', f === null, f);
f = await lauf(db, 'freunde-schema.sql (zweites Mal)', lies('supabase/freunde-schema.sql'));
pruefe('freunde-schema.sql ist wiederholbar', f === null, f);
f = await lauf(db, 'freunde-rls-test.sql', lies('supabase/freunde-rls-test.sql'));
pruefe('freunde-rls-test.sql laeuft ohne FEHLER', f === null, f);
if (f) await lauf(db, 'Aufraeumen nach Fehler', 'rollback;');
const rest = await db.query('select count(*)::int as n from auth.users');
pruefe('RLS-Test hat alles zurueckgerollt', rest.rows[0].n === 0, JSON.stringify(rest.rows));

const offen = await db.query(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname like 'wochenpunkte%' and has_function_privilege('authenticated', p.oid, 'execute')`);
pruefe('authenticated darf nur wochenpunkte_melden, nicht die Grenze selbst', offen.rows.map((r) => r.proname).join() === 'wochenpunkte_melden',
  JSON.stringify(offen.rows));

// Rueckweg: alte Grenze zurueck, Daten bleiben. GEGENPROBE: gegen den alten Stand muss der Test ROT sein.
await lauf(db, 'Zeile fuer den Rueckweg', `insert into auth.users (id, email) values ('99999999-9999-4999-8999-999999999999', 'bleibt@example.invalid');
  insert into public.wochenpunkte (user_id, woche, punkte, partien) values ('99999999-9999-4999-8999-999999999999', date '2026-11-02', 500, 1);`);
f = await lauf(db, 'freunde-grenze-zurueck.sql', lies('supabase/freunde-grenze-zurueck.sql') + lies('supabase/freunde-grenze-zurueck.sql'));
pruefe('freunde-grenze-zurueck.sql laeuft (zweimal)', f === null, f);
const klein = await db.query(`select
    (select count(*)::int from pg_proc where proname = 'wochenpunkte_je_partie_max') as neu,
    (select count(*)::int from public.wochenpunkte) as zeilen,
    (select has_function_privilege('authenticated', 'public.wochenpunkte_melden(date, integer, integer)', 'execute')) as melden,
    (select has_function_privilege('anon', 'public.wochenpunkte_melden(date, integer, integer)', 'execute')) as anon`);
const k = klein.rows[0];
pruefe('Rueckweg: Hilfsfunktion weg, Daten bleiben, Rechte wie zuvor', k.neu === 0 && k.zeilen === 1 && k.melden === true && k.anon === false, JSON.stringify(k));
f = await lauf(db, 'freunde-rls-test.sql (alter Stand)', lies('supabase/freunde-rls-test.sql'));
pruefe('Gegenprobe: mit der alten Grenze ist freunde-rls-test.sql rot (100.000 Punkte je Partie)', f !== null && f.includes('FEHLER: 100.000 Punkte'), f);
await lauf(db, 'Aufraeumen nach Gegenprobe', 'rollback;');
f = await lauf(db, 'freunde-schema.sql (nach Rueckweg)', lies('supabase/freunde-schema.sql'));
pruefe('freunde-schema.sql laeuft nach dem Rueckweg wieder', f === null, f);
f = await lauf(db, 'freunde-rls-test.sql (nach Rueckweg)', lies('supabase/freunde-rls-test.sql'));
pruefe('freunde-rls-test.sql ist danach wieder gruen', f === null, f);

// Gegenprobe: ein fehlschlagender Abschnitt muss den Lauf wirklich rot machen
f = await lauf(db, 'Probe', "begin; do $$ begin raise exception 'FEHLER: Probe'; end; $$; rollback;");
pruefe('ein FEHLER im SQL wird erkannt', f !== null && f.includes('FEHLER: Probe'), f);

await db.close();
console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
