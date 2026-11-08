// Liga-Gruppe mit Profilbild und Banner (G-002), Server-Seite: fuehrt supabase/schema.sql, online-schema.sql,
// kronen-schema.sql, karte-schema.sql, dann supabase/liga-bild-schema.sql und supabase/liga-bild-rls-test.sql WIRKLICH aus,
// in PGlite (Postgres als WebAssembly, ohne Netz, ohne Supabase), danach den Rueckweg liga-bild-zurueck.sql. Laeuft im
// CI-Job "sql" (.github/workflows/tests.yml); lokal nur, wenn PGlite im Arbeitsbaum liegt (npm install --no-save --ignore-scripts).
//   node tests/server-liga-bild.test.mjs
//
// WICHTIG: Die Auth-Attrappe bildet Supabase nur naeherungsweise nach (wie in tests/server-karte.test.mjs). Ein gruener
// Lauf hier ersetzt NICHT den einmaligen Lauf von liga-bild-rls-test.sql im Supabase SQL Editor nach dem Einspielen.
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
const quelle = async (db) => (await db.query(`select pg_get_functiondef('public.liga_meine_gruppe()'::regprocedure) as d`)).rows[0].d;

const db = new PGlite();
pruefe('Auth-Attrappe angelegt', (await lauf(db, 'Attrappe', ATTRAPPE)) === null);
for (const d of ['supabase/schema.sql', 'supabase/online-schema.sql', 'supabase/kronen-schema.sql', 'supabase/karte-schema.sql']) {
  const f = await lauf(db, d, lies(d));
  pruefe(d + ' laeuft (Grundlage)', f === null, f);
}
pruefe('vorher: liga_meine_gruppe ohne Profilbild', !(await quelle(db)).includes('karte_wahl'));

let f = await lauf(db, 'liga-bild-schema.sql', lies('supabase/liga-bild-schema.sql'));
pruefe('liga-bild-schema.sql laeuft', f === null, f);
f = await lauf(db, 'liga-bild-schema.sql (zweites Mal)', lies('supabase/liga-bild-schema.sql'));
pruefe('liga-bild-schema.sql ist wiederholbar', f === null, f);
f = await lauf(db, 'liga-bild-rls-test.sql', lies('supabase/liga-bild-rls-test.sql'));
pruefe('liga-bild-rls-test.sql laeuft ohne FEHLER', f === null, f);
if (f) await lauf(db, 'Aufraeumen nach Fehler', 'rollback;');
const rest = await db.query('select count(*)::int as n from auth.users');
pruefe('RLS-Test hat alles zurueckgerollt', rest.rows[0].n === 0, JSON.stringify(rest.rows));

// Rechte unveraendert: nur authenticated darf die Funktion, anon nicht
const recht = await db.query(`select has_function_privilege('authenticated', 'public.liga_meine_gruppe()', 'execute') as a,
  has_function_privilege('anon', 'public.liga_meine_gruppe()', 'execute') as n`);
pruefe('liga_meine_gruppe: authenticated ja, anon nein', recht.rows[0].a === true && recht.rows[0].n === false, JSON.stringify(recht.rows));

// Gegenprobe: ein fehlschlagender Abschnitt muss den Lauf wirklich rot machen
f = await lauf(db, 'Probe', "begin; do $$ begin raise exception 'FEHLER: Probe'; end; $$; rollback;");
pruefe('ein FEHLER im SQL wird erkannt', f !== null && f.includes('FEHLER: Probe'), f);
await lauf(db, 'Aufraeumen nach Probe', 'rollback;');

// Rueckweg: die Fassung aus kronen-schema.sql, gleiche Rechte; danach laesst sich die neue Fassung wieder einspielen
f = await lauf(db, 'liga-bild-zurueck.sql', lies('supabase/liga-bild-zurueck.sql'));
pruefe('liga-bild-zurueck.sql laeuft', f === null, f);
pruefe('nach dem Rueckweg: liga_meine_gruppe ohne Profilbild', !(await quelle(db)).includes('karte_wahl'));
const recht2 = await db.query(`select has_function_privilege('authenticated', 'public.liga_meine_gruppe()', 'execute') as a,
  has_function_privilege('anon', 'public.liga_meine_gruppe()', 'execute') as n`);
pruefe('nach dem Rueckweg: Rechte wie vorher', recht2.rows[0].a === true && recht2.rows[0].n === false, JSON.stringify(recht2.rows));
// kronen-rls-test.sql passt nur ohne karte-schema.sql (die Karte aendert die Wochen-Abrechnung, tests/server-kronen.test.mjs);
// mit beiden zusammen prueft karte-rls-test.sql die Liga
f = await lauf(db, 'karte-rls-test.sql (nach Rueckweg)', lies('supabase/karte-rls-test.sql'));
pruefe('karte-rls-test.sql laeuft nach dem Rueckweg', f === null, f);
if (f) await lauf(db, 'Aufraeumen nach Fehler', 'rollback;');
f = await lauf(db, 'liga-bild-schema.sql (nach Rueckweg)', lies('supabase/liga-bild-schema.sql'));
pruefe('liga-bild-schema.sql laeuft nach dem Rueckweg wieder', f === null, f);
f = await lauf(db, 'karte-rls-test.sql (mit Bild)', lies('supabase/karte-rls-test.sql'));
pruefe('karte-rls-test.sql bleibt mit der neuen Fassung gruen', f === null, f);
if (f) await lauf(db, 'Aufraeumen nach Fehler', 'rollback;');
f = await lauf(db, 'liga-bild-rls-test.sql (zweiter Lauf)', lies('supabase/liga-bild-rls-test.sql'));
pruefe('liga-bild-rls-test.sql laeuft nach dem Rueckweg und Wiedereinspielen', f === null, f);

await db.close();
console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
