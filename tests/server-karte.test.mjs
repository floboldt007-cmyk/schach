// Visitenkarte, Erfolge in Stufen und Taler (Etappe 4b), Server-Seite: fuehrt supabase/schema.sql (Profil),
// supabase/online-schema.sql, supabase/kronen-schema.sql, supabase/karte-schema.sql und supabase/karte-rls-test.sql
// WIRKLICH aus, in PGlite (Postgres als WebAssembly, ohne Netz, ohne Supabase). Laeuft im CI-Job "sql"
// (.github/workflows/tests.yml); lokal nur, wenn PGlite im Arbeitsbaum liegt (npm install --no-save --ignore-scripts).
//   node tests/server-karte.test.mjs
//
// WICHTIG: Die Auth-Attrappe bildet Supabase nur naeherungsweise nach (wie in tests/server-kronen.test.mjs). Ein gruener
// Lauf hier ersetzt NICHT den einmaligen Lauf von karte-rls-test.sql im Supabase SQL Editor vor dem Einspielen.
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
for (const d of ['supabase/schema.sql', 'supabase/online-schema.sql', 'supabase/kronen-schema.sql']) {
  const f = await lauf(db, d, lies(d));
  pruefe(d + ' laeuft (Grundlage)', f === null, f);
}
let f = await lauf(db, 'karte-schema.sql', lies('supabase/karte-schema.sql'));
pruefe('karte-schema.sql laeuft', f === null, f);
f = await lauf(db, 'karte-schema.sql (zweites Mal)', lies('supabase/karte-schema.sql'));
pruefe('karte-schema.sql ist wiederholbar', f === null, f);
f = await lauf(db, 'karte-rls-test.sql', lies('supabase/karte-rls-test.sql'));
pruefe('karte-rls-test.sql laeuft ohne FEHLER', f === null, f);
if (f) await lauf(db, 'Aufraeumen nach Fehler', 'rollback;');

const rest = await db.query('select count(*)::int as n from auth.users');
pruefe('RLS-Test hat alles zurueckgerollt', rest.rows[0].n === 0, JSON.stringify(rest.rows));

// Rechte: keine Policy, RLS an, und nur die vier Nutzer-Funktionen fuer authenticated
const rls = await db.query(`select relname, relrowsecurity from pg_class
  where relname in ('karte_stufen', 'taler_buchungen', 'banner_besitz', 'karte_wahl') order by relname`);
pruefe('RLS an allen vier Tabellen', rls.rows.length === 4 && rls.rows.every((r) => r.relrowsecurity), JSON.stringify(rls.rows));
const offen = await db.query(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname like 'karte\\_%' and has_function_privilege('authenticated', p.oid, 'execute')
  order by 1`);
pruefe('authenticated darf genau die vier Nutzer-Funktionen', offen.rows.map((r) => r.proname).join() ===
  'karte_der_partie,karte_mein_stand,karte_melde_stufen,karte_waehle', JSON.stringify(offen.rows));
const anon = await db.query(`select count(*)::int as n from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname like 'karte\\_%' and has_function_privilege('anon', p.oid, 'execute')`);
pruefe('anon darf keine Karte-Funktion', anon.rows[0].n === 0, JSON.stringify(anon.rows));

// Gegenprobe: ein fehlschlagender Abschnitt muss den Lauf wirklich rot machen
f = await lauf(db, 'Probe', "begin; do $$ begin raise exception 'FEHLER: Probe'; end; $$; rollback;");
pruefe('ein FEHLER im SQL wird erkannt', f !== null && f.includes('FEHLER: Probe'), f);
await lauf(db, 'Aufraeumen nach Probe', 'rollback;');

// Rueckweg: alles weg, danach laesst sich das Schema wieder einspielen und der Test laeuft erneut
f = await lauf(db, 'karte-zurueck.sql', lies('supabase/karte-zurueck.sql'));
pruefe('karte-zurueck.sql laeuft', f === null, f);
const uebrig = await db.query(`select
    (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname like 'karte\\_%') as funktionen,
    (select count(*)::int from pg_tables where schemaname = 'public'
      and tablename in ('karte_stufen', 'taler_buchungen', 'banner_besitz', 'karte_wahl')) as tabellen,
    (select count(*)::int from pg_tables where schemaname = 'public' and tablename = 'kronen_stand') as kronen`);
const u = uebrig.rows[0];
pruefe('nach dem Rueckweg keine Karte-Funktion oder -Tabelle mehr, Kronen bleiben', u.funktionen === 0 && u.tabellen === 0 && u.kronen === 1,
  JSON.stringify(u));
f = await lauf(db, 'karte-schema.sql (nach Rueckweg)', lies('supabase/karte-schema.sql'));
pruefe('karte-schema.sql laeuft nach dem Rueckweg wieder', f === null, f);
f = await lauf(db, 'karte-rls-test.sql (nach Rueckweg)', lies('supabase/karte-rls-test.sql'));
pruefe('karte-rls-test.sql laeuft nach dem Rueckweg wieder', f === null, f);

// Kleiner Rueckweg (karte-besitz-zurueck.sql): nur Besitz-Pruefung und Bremse weg, Tabellen und Daten bleiben, die
// vier Nutzer-Funktionen bleiben erreichbar. GEGENPROBE: der Test muss gegen diesen alten Stand ROT sein (sonst
// pruefte er die Besitz-Regeln gar nicht) und nach erneutem Einspielen wieder gruen.
await lauf(db, 'Zeile fuer den Rueckweg', `insert into auth.users (id, email) values ('99999999-9999-4999-8999-999999999999', 'bleibt@example.invalid');
  insert into public.karte_stufen (user_id, familie, stufe) values ('99999999-9999-4999-8999-999999999999', 'siege', 1);`);
f = await lauf(db, 'karte-besitz-zurueck.sql', lies('supabase/karte-besitz-zurueck.sql') + lies('supabase/karte-besitz-zurueck.sql'));
pruefe('karte-besitz-zurueck.sql laeuft (zweimal)', f === null, f);
const klein = await db.query(`select
    (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
      and p.proname in ('karte_frei', 'karte_stufe_moeglich', 'karte_besitz_regeln')) as neu,
    (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
      and p.proname like 'karte\\_%' and has_function_privilege('authenticated', p.oid, 'execute')) as offen,
    (select count(*)::int from public.karte_stufen) as zeilen`);
pruefe('kleiner Rueckweg: Hilfsfunktionen weg, vier Nutzer-Funktionen offen, Daten bleiben',
  klein.rows[0].neu === 0 && klein.rows[0].offen === 4 && klein.rows[0].zeilen === 1, JSON.stringify(klein.rows[0]));
f = await lauf(db, 'karte-rls-test.sql (alter Stand)', lies('supabase/karte-rls-test.sql'));
pruefe('Gegenprobe: ohne Besitz-Pruefung ist karte-rls-test.sql rot', f !== null && f.includes('FEHLER:'), f);
await lauf(db, 'Aufraeumen nach Gegenprobe', 'rollback;');
f = await lauf(db, 'karte-schema.sql (nach kleinem Rueckweg)', lies('supabase/karte-schema.sql'));
pruefe('karte-schema.sql laeuft nach dem kleinen Rueckweg wieder', f === null, f);
f = await lauf(db, 'karte-rls-test.sql (nach kleinem Rueckweg)', lies('supabase/karte-rls-test.sql'));
pruefe('karte-rls-test.sql ist danach wieder gruen', f === null, f);
await lauf(db, 'Zeile wieder weg', `delete from auth.users where id = '99999999-9999-4999-8999-999999999999';`);

await db.close();
console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
