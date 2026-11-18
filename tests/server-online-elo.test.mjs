// Vorschlag eigene Online-Elo in kronen_mein_stand (supabase/online-elo-schema.sql, R19, noch nicht eingespielt): fuehrt
// die bisherigen Schemas und den Vorschlag WIRKLICH aus, in PGlite (ohne Netz, ohne Supabase). Jeder sieht nur die
// eigene Elo (nach mindestens einer gewerteten Partie oder einem selbst gesetzten Start), sonst elo null; die
// bisherigen Felder bleiben; anon darf nichts; die Probe fuer den SQL Editor laeuft; der Rueckweg nimmt das Feld wieder
// heraus und ist wortgleich mit zwei-ligen-schema.sql; die Gegenprobe (fremde statt eigene Elo) wird rot.
// Lokal nur mit PGlite in node_modules (npm install --no-save --ignore-scripts @electric-sql/pglite@0.5.11).
//   node tests/server-online-elo.test.mjs
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

// wie tests/server-weltrang.test.mjs; dazu Saison und Weltrangliste, damit die Dateien nebeneinander laufen
const BISHER = ['supabase/schema.sql', 'supabase/abo-schema.sql', 'supabase/online-schema.sql', 'supabase/kronen-schema.sql',
  'supabase/raetsel-duell-schema.sql', 'supabase/raetsel-duell-daten.sql', 'supabase/karte-schema.sql',
  'supabase/liga-bild-schema.sql', 'supabase/zwei-ligen-schema.sql', 'supabase/daten-schema.sql',
  'supabase/saison-schema.sql', 'supabase/weltrang-schema.sql'];

const A = 'e1000000-0000-4000-8000-0000000000a1'; // 1234 nach 5 Partien
const B = 'e2000000-0000-4000-8000-0000000000b2'; // ohne Stand
const C = 'e3000000-0000-4000-8000-0000000000c3'; // Start selbst gesetzt, 1450, noch keine Partie
const D = 'e4000000-0000-4000-8000-0000000000d4'; // nur Vorgabewert 1000
const ALS = (uid) => `select set_config('request.jwt.claims', '{"sub":"${uid}","role":"authenticated"}', false);`;

async function neueDb(schema) {
  const db = new PGlite();
  let f = await lauf(db, 'Attrappe', ATTRAPPE);
  for (const d of BISHER) f = f || await lauf(db, d, lies(d));
  if (schema !== null) f = f || await lauf(db, 'online-elo-schema.sql', schema);
  if (!f) {
    await db.exec(`
insert into auth.users (id, email) values ('${A}', 'a@x'), ('${B}', 'b@x'), ('${C}', 'c@x'), ('${D}', 'd@x');
insert into public.kronen_stand (user_id, elo, elo_n, start_gesetzt)
values ('${A}', 1234, 5, false), ('${C}', 1450, 0, true), ('${D}', 1000, 0, false);
`);
  }
  return { db, f };
}
async function stand(db, uid) {
  await db.exec(uid ? ALS(uid) + 'set role authenticated;' : `select set_config('request.jwt.claims', '{"role":"anon"}', false); set role anon;`);
  try {
    return (await db.query('select public.kronen_mein_stand() as s')).rows[0].s;
  } catch (e) {
    return { fehler: e.message };
  } finally {
    await db.exec('reset role;');
  }
}

const SCHEMA = lies('supabase/online-elo-schema.sql');
const { db, f } = await neueDb(SCHEMA);
pruefe('bisherige Schemas (mit Saison und Weltrangliste) und der Vorschlag laufen', !f, f);
if (f) { console.log(`\n${ok}/${gesamt} bestanden`); process.exit(1); }

const vorher = {};
{
  const a = await stand(db, A);
  pruefe('A sieht die eigene Elo (1234)', a?.elo === 1234, JSON.stringify(a));
  pruefe('bisherige Felder bleiben, kein Feld liga', ['stufe', 'kronen', 'platz', 'ziel', 'n', 'woche'].every((k) => k in (a || {})) && !('liga' in (a || {})),
    JSON.stringify(a));
  const c = await stand(db, C);
  pruefe('C sieht den selbst gesetzten Start (1450)', c?.elo === 1450, JSON.stringify(c));
  const b = await stand(db, B);
  pruefe('B ohne Stand: Feld elo da und null', b && 'elo' in b && b.elo === null, JSON.stringify(b));
  pruefe('B sieht keine fremde Elo', !/1234|1450/.test(JSON.stringify(b)), JSON.stringify(b));
  const d = await stand(db, D);
  pruefe('D nur mit Vorgabewert 1000: elo null (keine erfundene Zahl)', d && d.elo === null, JSON.stringify(d));
  const x = await stand(db, null);
  pruefe('anon darf kronen_mein_stand nicht aufrufen', /permission denied/i.test(x?.fehler || ''), JSON.stringify(x));
  vorher.a = a;
}
{
  const r = await db.query(`select has_function_privilege('anon', 'public.kronen_mein_stand()', 'execute') as anon,
    has_function_privilege('authenticated', 'public.kronen_mein_stand()', 'execute') as auth`);
  pruefe('Rechte: anon nein, authenticated ja', r.rows[0].anon === false && r.rows[0].auth === true, JSON.stringify(r.rows[0]));
}
{
  const x = await lauf(db, 'online-elo-rls-test.sql', lies('supabase/online-elo-rls-test.sql'));
  pruefe('online-elo-rls-test.sql laeuft (Probe fuer den SQL Editor)', !x, x);
  const y = await lauf(db, 'zwei-ligen-rls-test.sql', lies('supabase/zwei-ligen-rls-test.sql'));
  pruefe('zwei-ligen-rls-test.sql laeuft mit dem Vorschlag', !y, y);
}
{
  const x = await lauf(db, 'online-elo-zurueck.sql', lies('supabase/online-elo-zurueck.sql'));
  pruefe('Rueckweg laeuft', !x, x);
  const a = await stand(db, A);
  pruefe('nach dem Rueckweg: kein Feld elo, Rest wie vorher', a && !('elo' in a) && a.stufe === vorher.a.stufe && a.kronen === vorher.a.kronen, JSON.stringify(a));
  const r = await db.query(`select has_function_privilege('anon', 'public.kronen_mein_stand()', 'execute') as anon,
    has_function_privilege('authenticated', 'public.kronen_mein_stand()', 'execute') as auth`);
  pruefe('nach dem Rueckweg: Rechte wie vorher', r.rows[0].anon === false && r.rows[0].auth === true, JSON.stringify(r.rows[0]));
  const z = await lauf(db, 'online-elo-schema.sql', SCHEMA);
  pruefe('Vorschlag laeuft erneut (wiederholbar)', !z && (await stand(db, A))?.elo === 1234, z);
}
{
  // Rueckweg = Fassung aus zwei-ligen-schema.sql (wortgleich, ohne Kommentare und Leerraum)
  const rumpf = (t) => (t.match(/create or replace function public\.kronen_mein_stand\(\)[\s\S]*?\$\$[\s\S]*?\$\$;/) || [''])[0]
    .replace(/--.*$/gm, '').replace(/\s+/g, ' ');
  const zurueck = rumpf(lies('supabase/online-elo-zurueck.sql'));
  pruefe('Rueckweg ist wortgleich mit zwei-ligen-schema.sql', zurueck !== '' && zurueck === rumpf(lies('supabase/zwei-ligen-schema.sql')));
}

// ---------- Gegenprobe: liest der Vorschlag die Elo ohne Bindung an das eigene Konto, wird die Probe rot ----------
{
  // statt des eigenen Kontos das mit der hoechsten Elo
  const falsch = SCHEMA.replace('st.user_id = auth.uid()', 'st.user_id = (select k.user_id from public.kronen_stand k order by k.elo desc limit 1)');
  const g = await neueDb(falsch);
  const probe = !g.f && await lauf(g.db, 'online-elo-rls-test.sql (fremde Elo)', lies('supabase/online-elo-rls-test.sql'));
  pruefe('Gegenprobe: ohne Bindung an auth.uid() meldet online-elo-rls-test.sql einen FEHLER', falsch !== SCHEMA && !g.f && /FEHLER/.test(probe || ''),
    g.f || probe);
}

console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
