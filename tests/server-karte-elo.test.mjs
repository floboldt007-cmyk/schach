// Vorschlag Elo in der Visitenkarte (supabase/karte-elo-schema.sql, noch nicht eingespielt): fuehrt die bisherigen
// Schemas und den Vorschlag WIRKLICH aus, in PGlite (ohne Netz, ohne Supabase). Gewertete Partie: beide Karten tragen
// die Online-Elo aus kronen_stand (ohne Stand null); Freundespartie: kein Feld elo; Unbeteiligte weiter abgewiesen;
// karte-rls-test.sql laeuft weiter; der Rueckweg nimmt die Elo wieder heraus.
// Lokal nur mit PGlite in node_modules (npm install --no-save --ignore-scripts @electric-sql/pglite@0.5.11).
//   node tests/server-karte-elo.test.mjs
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

const BISHER = ['supabase/schema.sql', 'supabase/abo-schema.sql', 'supabase/online-schema.sql', 'supabase/kronen-schema.sql',
  'supabase/raetsel-duell-schema.sql', 'supabase/raetsel-duell-daten.sql', 'supabase/karte-schema.sql',
  'supabase/liga-bild-schema.sql', 'supabase/daten-schema.sql', 'supabase/zwei-ligen-schema.sql', 'supabase/daten-schema.sql'];

const A = 'e1000000-0000-4000-8000-0000000000a1';
const B = 'e2000000-0000-4000-8000-0000000000b2';
const C = 'e3000000-0000-4000-8000-0000000000c3';
const ALS = (uid) => `select set_config('request.jwt.claims', '{"sub":"${uid}","role":"authenticated"}', false);`;

const db = new PGlite();
let f = await lauf(db, 'Attrappe', ATTRAPPE);
for (const d of BISHER) f = f || await lauf(db, d, lies(d));
f = f || await lauf(db, 'karte-elo-schema.sql', lies('supabase/karte-elo-schema.sql'));
pruefe('bisherige Schemas und der Vorschlag laufen', !f, f);
if (f) { console.log(`\n${ok}/${gesamt} bestanden`); process.exit(1); }

await db.exec(`
insert into auth.users (id, email) values ('${A}', 'a@x'), ('${B}', 'b@x'), ('${C}', 'c@x');
insert into public.kronen_stand (user_id, elo, elo_n) values ('${A}', 1234, 5);
create table test_partien (art text primary key, id uuid);
with p as (insert into public.partien_online (erstellt_von, fen, bedenkzeit_s, inkrement_s)
           values ('${A}', 'x', 300, 3) returning id)
insert into test_partien select 'gewertet', id from p;
with p as (insert into public.partien_online (erstellt_von, fen, bedenkzeit_s, inkrement_s)
           values ('${A}', 'x', 300, 3) returning id)
insert into test_partien select 'freund', id from p;
update public.partien_online set weiss = '${A}', schwarz = '${B}', status = 'laeuft', letzter_zug_am = now(),
  gewertet = (id = (select id from test_partien where art = 'gewertet'));
grant select on test_partien to authenticated;
`);
const partie = async (art) => (await db.query(`select id from test_partien where art = '${art}'`)).rows[0].id;
async function karte(uid, art) {
  await db.exec(ALS(uid) + 'set role authenticated;');
  try {
    return (await db.query(`select public.karte_der_partie('${await partie(art)}') as k`)).rows[0].k;
  } catch (e) {
    return { fehler: e.message };
  } finally {
    await db.exec('reset role;');
  }
}

{
  const k = await karte(B, 'gewertet');
  pruefe('gewertet: Gegner sieht die Elo des anderen (1234)', k?.w?.elo === 1234, JSON.stringify(k));
  pruefe('gewertet: ohne kronen_stand ist elo null (Feld da)', k?.s && 'elo' in k.s && k.s.elo === null, JSON.stringify(k?.s));
  pruefe('gewertet: du-Merker unveraendert', k?.s?.du === true && k?.w?.du === false, JSON.stringify(k));
}
{
  const k = await karte(A, 'freund');
  pruefe('Freundespartie: kein Feld elo', k?.w && !('elo' in k.w) && !('elo' in k.s), JSON.stringify(k));
}
{
  const k = await karte(C, 'gewertet');
  pruefe('Unbeteiligter wird weiter abgewiesen', /KARTE_KEINE_PARTIE/.test(k?.fehler || ''), JSON.stringify(k));
}
{
  const r = await db.query(`select has_function_privilege('anon', 'public.karte_der_partie(uuid)', 'execute') as anon,
    has_function_privilege('authenticated', 'public.karte_der_partie(uuid)', 'execute') as auth`);
  pruefe('Rechte: anon nein, authenticated ja', r.rows[0].anon === false && r.rows[0].auth === true, JSON.stringify(r.rows[0]));
}
{
  const x = await lauf(db, 'karte-rls-test.sql', lies('supabase/karte-rls-test.sql'));
  pruefe('karte-rls-test.sql laeuft mit dem Vorschlag', !x, x);
}
{
  const x = await lauf(db, 'karte-elo-zurueck.sql', lies('supabase/karte-elo-zurueck.sql'));
  pruefe('Rueckweg laeuft', !x, x);
  const k = await karte(B, 'gewertet');
  pruefe('nach dem Rueckweg: keine Elo mehr', k?.w && !('elo' in k.w), JSON.stringify(k));
  const y = await lauf(db, 'karte-rls-test.sql', lies('supabase/karte-rls-test.sql'));
  pruefe('karte-rls-test.sql laeuft nach dem Rueckweg', !y, y);
  const z = await lauf(db, 'karte-elo-schema.sql', lies('supabase/karte-elo-schema.sql'));
  pruefe('Vorschlag laeuft erneut (wiederholbar)', !z && (await karte(B, 'gewertet'))?.w?.elo === 1234, z);
}
{
  // Rueckweg = Fassung aus karte-schema.sql (wortgleich, ohne Kommentare und Leerraum)
  const rumpf = (t) => (t.match(/create or replace function public\.karte_der_partie[\s\S]*?\$\$[\s\S]*?\$\$;/) || [''])[0]
    .replace(/--.*$/gm, '').replace(/\s+/g, ' ');
  pruefe('Rueckweg ist wortgleich mit karte-schema.sql',
    rumpf(lies('supabase/karte-elo-zurueck.sql')) === rumpf(lies('supabase/karte-schema.sql')));
}

console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
