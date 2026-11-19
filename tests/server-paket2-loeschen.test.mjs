// Loeschkette Paket 2 (Weltrangliste und Season-Anzeige ab 16, R19 19.11.2026): konto_loeschen() (daten-schema.sql) nimmt
// Season-Abzeichen, Season-Titel, Season-Wahl (Schalter "sichtbar" und Zeitpunkt der Bestaetigung "mindestens 16") und die
// Teilnahme an der Weltrangliste (mit Zeitpunkt) mit, ueber on delete cascade an auth.users. Fuehrt die Schemas WIRKLICH aus,
// in PGlite (ohne Netz, ohne Supabase). Dazu: keine Tabelle in public mit Spalte user_id haelt danach noch eine Zeile des
// Kontos, ein zweites Konto bleibt unberuehrt, und eine Gegenprobe ohne Kaskade bei saison_wahl wird erkannt.
// Lokal nur mit PGlite in node_modules (npm install --no-save --ignore-scripts @electric-sql/pglite@0.5.11).
//   node tests/server-paket2-loeschen.test.mjs
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

// wie tests/server-saison.test.mjs
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
const BISHER = ['supabase/schema.sql', 'supabase/abo-schema.sql', 'supabase/online-schema.sql', 'supabase/kronen-schema.sql',
  'supabase/raetsel-duell-schema.sql', 'supabase/raetsel-duell-daten.sql', 'supabase/karte-schema.sql',
  'supabase/liga-bild-schema.sql', 'supabase/daten-schema.sql', 'supabase/zwei-ligen-schema.sql', 'supabase/daten-schema.sql'];

const A = 'c0000000-0000-4000-8000-000000000001';
const B = 'c0000000-0000-4000-8000-000000000002';
const ALS = (uid) => `select set_config('request.jwt.claims', '{"sub":"${uid}","role":"authenticated"}', false);`;
const TABELLEN = ['saison_abzeichen', 'saison_titel', 'saison_wahl', 'weltrang_teilnahme'];

async function lauf(db, name, sql) {
  try {
    await db.exec(sql);
    return null;
  } catch (e) {
    return `${name}: ${e.message}`;
  }
}

// saison: Inhalt von saison-schema.sql (die Gegenprobe gibt eine veraenderte Fassung)
async function neueDb(saison = lies('supabase/saison-schema.sql')) {
  const db = new PGlite();
  let f = await lauf(db, 'Attrappe', ATTRAPPE);
  for (const d of BISHER) f = f || await lauf(db, d, lies(d));
  f = f || await lauf(db, 'saison-schema.sql', saison);
  f = f || await lauf(db, 'weltrang-schema.sql', lies('supabase/weltrang-schema.sql'));
  // meine_daten zuletzt aus daten-schema.sql (wie server-weltrang.test.mjs)
  f = f || await lauf(db, 'daten-schema.sql (zuletzt)', lies('supabase/daten-schema.sql'));
  return { db, fehler: f };
}

// beide Konten mit Zeilen in allen vier Tabellen: Abzeichen, Titel, Wahl mit Schalter an und Zeitpunkt, Teilnahme mit Zeitpunkt
const LAGE = [A, B].map((u) => `
  insert into auth.users (id, email) values ('${u}', '${u.slice(-1)}@x.invalid');
  insert into public.saison_abzeichen (user_id, saison, stufe) values ('${u}', 1, 17), ('${u}', 2, 9);
  insert into public.saison_titel (user_id, saison, art) values ('${u}', 1, 'crownmaster');
  insert into public.saison_wahl (user_id, titel, sichtbar, alter_bestaetigt_am) values ('${u}', 'crownmaster-s1', true, now());
  insert into public.weltrang_teilnahme (user_id, alter_bestaetigt_am) values ('${u}', now());`).join('\n');

const zaehle = async (db, uid) => {
  const r = {};
  for (const t of TABELLEN) r[t] = (await db.query(`select count(*)::int as n from public.${t} where user_id = $1`, [uid])).rows[0].n;
  return r;
};

async function loesche(db, uid) {
  await db.exec(ALS(uid) + 'set role authenticated;');
  try {
    await db.query('select public.konto_loeschen()');
    return null;
  } catch (e) {
    return e.message;
  } finally {
    await db.exec('reset role;');
  }
}

// ---------- echter Stand ----------
{
  const { db, fehler } = await neueDb();
  pruefe('Schemas laufen (bisher, saison, weltrang, daten)', !fehler, fehler);
  if (fehler) { console.log(`\n${ok}/${gesamt} bestanden`); process.exit(1); }

  // Name aus pg_class + pg_namespace: regclass::text laesst "public." weg, solange public im search_path steht
  const k = (await db.query(`select cl.relname as t, c.confdeltype as art from pg_constraint c
    join pg_class cl on cl.oid = c.conrelid join pg_namespace n on n.oid = cl.relnamespace
    where c.contype = 'f' and c.confrelid = 'auth.users'::regclass
      and n.nspname = 'public' and cl.relname = any($1)`, [TABELLEN])).rows;
  for (const t of TABELLEN) {
    const z = k.find((x) => x.t === t);
    pruefe(`${t}: Fremdschluessel auf auth.users mit on delete cascade`, z && z.art === 'c', JSON.stringify(z));
  }

  const x = await lauf(db, 'Lage', LAGE);
  pruefe('Lage angelegt', !x, x);
  const vorher = await zaehle(db, A);
  pruefe('vorher: A hat Zeilen in allen vier Tabellen', TABELLEN.every((t) => vorher[t] > 0), JSON.stringify(vorher));
  const wahl = (await db.query('select sichtbar, alter_bestaetigt_am is not null as am from public.saison_wahl where user_id = $1', [A])).rows[0];
  pruefe('vorher: Season-Schalter an mit Zeitpunkt der Bestaetigung', wahl?.sichtbar === true && wahl?.am === true, JSON.stringify(wahl));

  const e = await loesche(db, A);
  pruefe('konto_loeschen() laeuft fuer A', !e, e);
  const nachher = await zaehle(db, A);
  for (const t of TABELLEN) pruefe(`nachher: ${t} ohne Zeile von A`, nachher[t] === 0, nachher[t]);
  pruefe('nachher: A nicht mehr in auth.users', (await db.query('select count(*)::int as n from auth.users where id = $1', [A])).rows[0].n === 0);

  // allgemein: jede Tabelle in public mit Spalte user_id (nicht nur die vier)
  const mitUser = (await db.query(`select table_name as t from information_schema.columns
    where table_schema = 'public' and column_name = 'user_id' order by table_name`)).rows.map((r) => r.t);
  const rest = [];
  for (const t of mitUser) {
    const n = (await db.query(`select count(*)::int as n from public."${t}" where user_id = $1`, [A])).rows[0].n;
    if (n) rest.push(`${t}: ${n}`);
  }
  pruefe(`keine der ${mitUser.length} Tabellen mit user_id haelt noch eine Zeile von A`, mitUser.length >= 4 && !rest.length, rest.join(', '));

  const b = await zaehle(db, B);
  pruefe('B bleibt unberuehrt (alle vier Tabellen)', b.saison_abzeichen === 2 && b.saison_titel === 1 && b.saison_wahl === 1
    && b.weltrang_teilnahme === 1, JSON.stringify(b));
  const bw = (await db.query('select sichtbar, alter_bestaetigt_am is not null as am from public.saison_wahl where user_id = $1', [B])).rows[0];
  pruefe('B: Season-Schalter und Zeitpunkt bleiben', bw?.sichtbar === true && bw?.am === true, JSON.stringify(bw));
}

// ---------- Gegenprobe: ohne Kaskade bei saison_wahl muss der Test es merken ----------
{
  const echt = lies('supabase/saison-schema.sql');
  const alt = '  user_id uuid primary key references auth.users (id) on delete cascade,\n  titel text,';
  const falsch = echt.replace(alt, '  user_id uuid primary key references auth.users (id),\n  titel text,');
  const { db, fehler } = await neueDb(falsch);
  const fk = !fehler && (await db.query(`select c.confdeltype as art from pg_constraint c
    join pg_class cl on cl.oid = c.conrelid join pg_namespace n on n.oid = cl.relnamespace
    where c.contype = 'f' and c.confrelid = 'auth.users'::regclass and n.nspname = 'public' and cl.relname = 'saison_wahl'`)).rows;
  pruefe('Gegenprobe: Fremdschluessel-Pruefung sieht bei saison_wahl keine Kaskade', fk && fk.length === 1 && fk[0].art !== 'c',
    JSON.stringify(fk));
  const x = fehler || await lauf(db, 'Lage', LAGE);
  const e = !x && await loesche(db, A);
  const zeile = !x && (await db.query('select count(*)::int as n from public.saison_wahl where user_id = $1', [A])).rows[0].n;
  pruefe('Gegenprobe: ohne Kaskade bei saison_wahl scheitert die Loeschung oder laesst die Zeile stehen',
    falsch !== echt && !x && (!!e || zeile > 0), x || `fehler=${e} zeile=${zeile}`);
}

console.log(`\n${ok}/${gesamt} bestanden`);
process.exitCode = ok === gesamt ? 0 : 1;
