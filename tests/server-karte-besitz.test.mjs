// Vorschlag Rahmen nur mit Beleg (supabase/karte-besitz-schema.sql, R27, NICHT eingespielt) in PGlite: der Stand wie live
// (karte-, karte-elo-, karte-sondertitel-schema.sql), dann der Vorschlag. Geprueft: ein unbelegter serie-/liga-6-Rahmen wird
// abgelehnt und ein schon gespeicherter beim Gegner als 'ohne' gelesen; echte Besitzer weiter ok; die uebrigen Rahmen
// unveraendert; Daten nicht umgeschrieben; Rechte unveraendert; Rueckweg zeichengleich und wiederholbar.
// Rote Gegenprobe: BESITZ_SCHEMA=<leere Datei> node tests/server-karte-besitz.test.mjs
//   node tests/server-karte-besitz.test.mjs
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
create table auth.users (id uuid primary key, email text, created_at timestamptz not null default now(),
  last_sign_in_at timestamptz, raw_app_meta_data jsonb not null default '{}', raw_user_meta_data jsonb not null default '{}');
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
// wie tests/server-karte-sondertitel.test.mjs, dazu die Elo-Fassung (beide sind live)
const BISHER = ['supabase/schema.sql', 'supabase/abo-schema.sql', 'supabase/online-schema.sql', 'supabase/kronen-schema.sql',
  'supabase/raetsel-duell-schema.sql', 'supabase/raetsel-duell-daten.sql', 'supabase/karte-schema.sql',
  'supabase/liga-bild-schema.sql', 'supabase/daten-schema.sql', 'supabase/zwei-ligen-schema.sql', 'supabase/daten-schema.sql',
  'supabase/werkstatt-schema.sql', 'supabase/pionier-schema.sql', 'supabase/karte-elo-schema.sql', 'supabase/karte-sondertitel-schema.sql'];
const SCHEMA = process.env.BESITZ_SCHEMA ? readFileSync(process.env.BESITZ_SCHEMA, 'utf8') : lies('supabase/karte-besitz-schema.sql');
const ZURUECK = lies('supabase/karte-besitz-zurueck.sql');
const block = (s, name) => { const a = s.indexOf(`create or replace function public.${name}(`); return a < 0 ? null : s.slice(a, s.indexOf('$$;\n', a) + 4); };
pruefe('Rueckweg: karte_waehle zeichengleich mit karte-schema.sql', !!block(ZURUECK, 'karte_waehle') && block(ZURUECK, 'karte_waehle') === block(lies('supabase/karte-schema.sql'), 'karte_waehle'));
pruefe('Rueckweg: karte_von zeichengleich mit karte-sondertitel-schema.sql (live)', !!block(ZURUECK, 'karte_von') && block(ZURUECK, 'karte_von') === block(lies('supabase/karte-sondertitel-schema.sql'), 'karte_von'));

const C = 'e3000000-0000-4000-8000-0000000000c3';   // fritz: ohne Serie, ohne Liga
const D = 'e4000000-0000-4000-8000-0000000000d4';   // Gegner
const E = 'e5000000-0000-4000-8000-0000000000e5';   // echter Besitzer (Serie Stufe 3, Liga Koenig III)
const db = new PGlite();
let f = await lauf(db, 'Attrappe', ATTRAPPE);
for (const d of BISHER) f = f || await lauf(db, d, lies(d));
pruefe('Stand wie live laeuft (Karte, Elo, Sondertitel)', !f, f);
if (f) { console.log(`\n${ok}/${gesamt} bestanden`); process.exit(1); }
await db.exec(`
insert into auth.users (id, email) values ('${C}', 'c@x'), ('${D}', 'd@x'), ('${E}', 'e@x');
create table test_partien (art text primary key, id uuid);
with p as (insert into public.partien_online (erstellt_von, fen, bedenkzeit_s, inkrement_s) values ('${C}', 'x', 300, 3) returning id)
insert into test_partien select 'cd', id from p;
with p as (insert into public.partien_online (erstellt_von, fen, bedenkzeit_s, inkrement_s) values ('${E}', 'x', 300, 3) returning id)
insert into test_partien select 'ed', id from p;
update public.partien_online set status = 'laeuft', letzter_zug_am = now(), gewertet = true, weiss = erstellt_von, schwarz = '${D}'::uuid;
grant select on test_partien to authenticated;
insert into public.kronen_stand (user_id, stufe) values ('${E}', 15) on conflict (user_id) do update set stufe = excluded.stufe;
insert into public.karte_stufen (user_id, familie, stufe) values ('${E}', 'serie', 1), ('${E}', 'serie', 2), ('${E}', 'serie', 3);
`);
async function als(uid, sql) {
  await db.exec(`select set_config('request.jwt.claims', '{"sub":"${uid}","role":"authenticated"}', false); set role authenticated;`);
  try { return (await db.query(sql)).rows[0]; } catch (e) { return { fehler: e.message }; } finally {
    await db.exec(`reset role; select set_config('request.jwt.claims', '', false);`);
  }
}
const waehle = (uid, rahmen) => als(uid, `select public.karte_waehle('start', null, null, 'Q', 'standard', '${rahmen}') as r`);
const partie = async (art) => (await db.query(`select id from test_partien where art = '${art}'`)).rows[0].id;
const rahmenBeiGegner = async (art) => {
  const r = await als(D, `select public.karte_der_partie('${await partie(art)}') as k`);
  return r.fehler ? r.fehler : r.k?.w?.rahmen;
};

// vorher (Stand live): der Befund aus dem Kaltreview von #271
{
  const r = await waehle(C, 'serie-100');
  pruefe('vorher: fritz ohne Serie setzt serie-100, der Server nimmt es an (Befund)', !r.fehler, JSON.stringify(r));
  pruefe('vorher: der Gegner sieht serie-100', await rahmenBeiGegner('cd') === 'serie-100');
}
f = await lauf(db, 'karte-besitz-schema.sql', SCHEMA);
pruefe('karte-besitz-schema.sql laeuft', !f, f);
f = await lauf(db, 'karte-besitz-schema.sql (2.)', SCHEMA);
pruefe('karte-besitz-schema.sql ist wiederholbar', !f, f);
{
  const g = await rahmenBeiGegner('cd');
  pruefe('Lesepfad: der gespeicherte unbelegte serie-100 erscheint beim Gegner als ohne', g === 'ohne', g);
  const roh = (await db.query(`select rahmen from public.karte_wahl where user_id = '${C}'`)).rows[0]?.rahmen;
  pruefe('Daten nicht umgeschrieben (karte_wahl behaelt serie-100)', roh === 'serie-100', roh);
  for (const x of ['serie-7', 'serie-30', 'serie-100', 'liga-6']) {
    const r = await waehle(C, x);
    pruefe(`fritz ohne Beleg: ${x} abgelehnt (KARTE_PROFIL)`, /KARTE_PROFIL/.test(r.fehler || ''), JSON.stringify(r));
  }
  for (const x of ['ohne', 'holz', 'liga-2', 'welt-3']) {
    const r = await waehle(C, x);
    pruefe(`ohne Beleg weiter frei (offen, siehe Kopf der Schema-Datei): ${x}`, !r.fehler, JSON.stringify(r));
  }
  await db.exec(`insert into public.karte_stufen (user_id, familie, stufe) values ('${C}', 'serie', 1), ('${C}', 'serie', 2)`);
  pruefe('fritz mit Serie-Stufe 2: serie-30 angenommen', !(await waehle(C, 'serie-30')).fehler);
  pruefe('fritz mit Serie-Stufe 2: serie-100 weiter abgelehnt', /KARTE_PROFIL/.test((await waehle(C, 'serie-100')).fehler || ''));
  pruefe('fritz mit Serie-Stufe 2: der Gegner sieht serie-30', await rahmenBeiGegner('cd') === 'serie-30');
  // echter Besitzer: liga aus kronen_stand (karte_sichern bucht liga 1..3 beim Waehlen), Serie Stufe 3
  for (const x of ['liga-6', 'serie-100']) {
    const r = await waehle(E, x);
    pruefe(`echter Besitzer: ${x} angenommen`, !r.fehler, JSON.stringify(r));
    pruefe(`echter Besitzer: der Gegner sieht ${x}`, await rahmenBeiGegner('ed') === x);
  }
}
{
  const rechte = (await db.query(`select p.proname, p.prosecdef as sd, p.proconfig as cfg,
      has_function_privilege('authenticated', p.oid, 'execute') as auth, has_function_privilege('anon', p.oid, 'execute') as anon
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('karte_rahmen_belegt', 'karte_waehle', 'karte_von')`)).rows;
  const r = Object.fromEntries(rechte.map((x) => [x.proname, x]));
  pruefe('Rechte: karte_waehle nur authenticated, karte_von und karte_rahmen_belegt fuer niemanden',
    r.karte_waehle?.auth === true && r.karte_waehle?.anon === false && r.karte_von?.auth === false && r.karte_von?.anon === false
    && r.karte_rahmen_belegt?.auth === false && r.karte_rahmen_belegt?.anon === false, JSON.stringify(rechte));
  pruefe('alle drei security definer mit leerem search_path', rechte.length === 3
    && rechte.every((x) => x.sd === true && (x.cfg || []).includes('search_path=""')), JSON.stringify(rechte));
}
f = await lauf(db, 'karte-besitz-zurueck.sql', ZURUECK);
pruefe('Rueckweg laeuft', !f, f);
f = await lauf(db, 'karte-besitz-zurueck.sql (2.)', ZURUECK);
pruefe('Rueckweg ist wiederholbar', !f, f);
{
  const weg = (await db.query(`select count(*)::int as n from pg_proc where proname = 'karte_rahmen_belegt'`)).rows[0].n;
  pruefe('nach dem Rueckweg: karte_rahmen_belegt weg', weg === 0, weg);
  pruefe('nach dem Rueckweg: alte Regel (serie-100 ohne Beleg wieder angenommen)', !(await waehle(C, 'serie-100')).fehler);
  const a = (await db.query(`select has_function_privilege('authenticated', 'public.karte_waehle(text, text, text[], text, text, text)', 'execute') as a`)).rows[0].a;
  pruefe('nach dem Rueckweg: karte_waehle weiter fuer authenticated', a === true);
}
console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
