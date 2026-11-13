// Datenauskunft (Art. 15) mit der Verwaltung (G-006 M3): spielt alle Schemata wie tests/server-daten.test.mjs und dazu
// supabase/verwaltung-schema.sql in PGlite ein (ohne Netz, ohne Supabase) und prueft:
//   - Vollstaendigkeit: auch verwalter und verwaltung_protokoll stehen in meine_daten().
//   - Inhalt: Jedes Konto bekommt die Aenderungen der Verwaltung an SICH (was, vorher, nachher, am), ohne die Kennung des
//     Verwalters und ohne fremde Zeilen; ein Verwalter sieht seit wann er verwalten darf.
//   - Reihenfolge egal: daten-schema.sql vor oder nach verwaltung-schema.sql; ohne Verwaltung ist der Teil leer.
//   - Rueckweg daten-verwaltung-zurueck.sql: meine_daten() wieder ohne den Teil, Inhalt sonst gleich; danach wieder einspielbar.
// Lokal nur mit PGlite in node_modules (npm install --no-save --ignore-scripts @electric-sql/pglite@0.5.11).
//   node tests/server-daten-verwaltung.test.mjs
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
const SCHEMATA = ['schema', 'online-schema', 'freunde-schema', 'abo-schema', 'werkstatt-schema', 'pionier-schema',
  'coach-schema', 'schule-schema', 'kronen-schema', 'zaehler-schema', 'karte-schema', 'raetsel-duell-schema',
  'liga-bild-schema', 'zwei-ligen-schema', 'daten-schema'];

async function lauf(db, name, sql) {
  try {
    await db.exec(sql);
    return null;
  } catch (e) {
    return `${name}: ${e.message}`;
  }
}

const F = 'f1000000-0000-4000-8000-0000000000f1'; // Verwalter
const A = 'a1000000-0000-4000-8000-0000000000a1';
const B = 'b2000000-0000-4000-8000-0000000000b2';
const ALS = (uid) => `select set_config('request.jwt.claims', '{"sub":"${uid}","role":"authenticated"}', false); set role authenticated;`;

async function auskunft(db, uid) {
  await db.exec(ALS(uid));
  try {
    return (await db.query('select public.meine_daten() as d')).rows[0].d;
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claims', '', false);`);
  }
}
async function rumpf(db) {
  return (await db.query(`select pg_get_functiondef('public.meine_daten()'::regprocedure) as d`)).rows[0].d;
}

// ---------- 1. Ohne Verwaltung: Teil leer ----------
{
  const db = new PGlite();
  let f = await lauf(db, 'Attrappe', ATTRAPPE);
  for (const d of SCHEMATA) f = f || await lauf(db, d, lies(`supabase/${d}.sql`));
  pruefe('alle Schemata ohne Verwaltung laufen', !f, f);
  await db.exec(`insert into auth.users (id, email) values ('${A}', 'a@x.de');`);
  const d = await auskunft(db, A);
  pruefe('ohne verwaltung-schema.sql: Teil verwaltung leer', d?.verwaltung?.verwalter === null
    && Array.isArray(d?.verwaltung?.protokoll) && d.verwaltung.protokoll.length === 0, JSON.stringify(d?.verwaltung));
}

// ---------- 2. Mit Verwaltung (nach daten-schema.sql eingespielt) ----------
const db = new PGlite();
let f = await lauf(db, 'Attrappe', ATTRAPPE);
for (const d of SCHEMATA) f = f || await lauf(db, d, lies(`supabase/${d}.sql`));
f = f || await lauf(db, 'verwaltung-schema.sql', lies('supabase/verwaltung-schema.sql'));
pruefe('Schemata plus verwaltung-schema.sql laufen', !f, f);
if (f) { console.log(`\n${ok}/${gesamt} bestanden`); process.exit(1); }

{
  const def = await rumpf(db);
  const fehlt = ['verwalter', 'verwaltung_protokoll'].filter((t) => !def.includes(`public.${t} `));
  pruefe('verwalter und verwaltung_protokoll stehen in meine_daten()', fehlt.length === 0, fehlt.join(', '));
}

await db.exec(`
insert into auth.users (id, email) values ('${F}', 'f@x.de'), ('${A}', 'a@x.de'), ('${B}', 'b@x.de');
insert into public.profile (user_id, benutzername) values ('${A}', 'Anna_1'), ('${B}', 'Bert_1');
insert into public.verwalter (user_id) values ('${F}');
`);
await db.exec(ALS(F));
await db.exec(`
select public.verwaltung_name('${A}', 'Anna_Neu');
select public.verwaltung_premium('${A}', now() + interval '30 days');
select public.verwaltung_banner('${B}', 'saison-gold', true);
reset role;
`);

{
  const d = await auskunft(db, A);
  const p = d?.verwaltung?.protokoll || [];
  pruefe('A: beide eigenen Aenderungen', p.length === 2 && p.map((x) => x.was).sort().join() === 'name,premium', JSON.stringify(p));
  const name = p.find((x) => x.was === 'name');
  pruefe('A: vorher und nachher, Zeitpunkt', name?.vorher?.benutzername === 'Anna_1' && name?.nachher?.benutzername === 'Anna_Neu' && !!name?.am,
    JSON.stringify(name));
  const text = String(JSON.stringify(d?.verwaltung));
  pruefe('A: ohne Kennung des Verwalters, ohne fremde Zeilen', !text.includes(F) && !text.includes('saison-gold') && !text.includes(B)
    && !p.some((x) => 'wer' in x || 'ziel_user' in x), text);
  pruefe('A: kein Verwalter', d?.verwaltung?.verwalter === null, JSON.stringify(d?.verwaltung));
  pruefe('bisherige Schluessel bleiben', ['konto', 'profil', 'karte', 'abo', 'anmeldeprotokoll', 'besitz'].every((k) => k in d), Object.keys(d).join());
}
{
  const d = await auskunft(db, B);
  const p = d?.verwaltung?.protokoll || [];
  pruefe('B: nur die eigene Banner-Aenderung', p.length === 1 && p[0].was === 'banner' && p[0].nachher?.banner === 'saison-gold', JSON.stringify(p));
}
{
  const d = await auskunft(db, F);
  pruefe('Verwalter: seit wann, keine Zeilen ueber andere', !!d?.verwaltung?.verwalter?.seit && d?.verwaltung?.protokoll?.length === 0,
    JSON.stringify(d?.verwaltung));
}

// ---------- 3. Rueckweg und erneutes Einspielen ----------
{
  const vorher = await auskunft(db, A);
  const x = await lauf(db, 'daten-verwaltung-zurueck.sql', lies('supabase/daten-verwaltung-zurueck.sql'));
  pruefe('Rueckweg laeuft', !x, x);
  const d = await auskunft(db, A);
  pruefe('nach dem Rueckweg: kein Teil verwaltung', d && !('verwaltung' in d), d && Object.keys(d).join());
  const ohne = (o) => { const c = { ...o }; delete c.verwaltung; delete c.erstellt_am; return JSON.stringify(c); };
  pruefe('nach dem Rueckweg: sonst dieselbe Auskunft', ohne(vorher) === ohne(d));
  const r = await db.query(`select has_function_privilege('anon', 'public.meine_daten()', 'execute') as anon,
    has_function_privilege('authenticated', 'public.meine_daten()', 'execute') as auth`);
  pruefe('nach dem Rueckweg: Rechte wie vorher', r.rows[0].anon === false && r.rows[0].auth === true, JSON.stringify(r.rows[0]));
  // Die Loeschung haengt an der Kaskade in verwaltung-schema.sql, nicht an meine_daten(): auch nach diesem Rueckweg
  const vorB = (await db.query(`select count(*)::int as n from public.verwaltung_protokoll where ziel_user = '${B}'`)).rows[0].n;
  await db.exec(ALS(B));
  let fehler = null;
  try { await db.query('select public.konto_loeschen()'); } catch (e) { fehler = e.message; } finally { await db.exec('reset role;'); }
  const nachB = (await db.query(`select count(*)::int as n from public.verwaltung_protokoll where ziel_user = '${B}'
    or nachher ->> 'banner' = 'saison-gold'`)).rows[0].n;
  pruefe('nach dem Rueckweg: konto_loeschen nimmt das Protokoll ueber B mit', !fehler && vorB === 1 && nachB === 0, `${fehler} ${vorB} -> ${nachB}`);
  const y = await lauf(db, 'daten-schema.sql (erneut)', lies('supabase/daten-schema.sql'));
  pruefe('daten-schema.sql danach wieder einspielbar, Teil wieder da', !y && (await auskunft(db, A))?.verwaltung?.protokoll?.length === 2, y);
  const z = await lauf(db, 'daten-rls-test.sql', lies('supabase/daten-rls-test.sql'));
  pruefe('daten-rls-test.sql laeuft mit der Verwaltung', !z, z);
}
{
  // Rueckweg = meine_daten() aus daten-schema.sql ohne die markierten Verwaltungs-Zeilen
  const teil = (t) => (t.match(/create or replace function public\.meine_daten\(\)[\s\S]*?\n\$\$;/) || [''])[0];
  const ohneMarke = teil(lies('supabase/daten-schema.sql')).split('\n').filter((z) => !z.includes('[verwaltung]')).join('\n');
  const norm = (t) => t.replace(/--.*$/gm, '').replace(/\s+/g, ' ').trim();
  pruefe('Rueckweg ist wortgleich mit daten-schema.sql ohne die Verwaltungs-Zeilen', norm(ohneMarke) === norm(teil(lies('supabase/daten-verwaltung-zurueck.sql')))
    && norm(ohneMarke).length > 1000);
}

console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
