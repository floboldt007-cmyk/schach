// Loeschkette Paket 2 (Weltrangliste und Season-Anzeige ab 16, R19 19.11.2026): konto_loeschen() (daten-schema.sql) nimmt
// Season-Abzeichen, Season-Titel, Season-Wahl (Schalter "sichtbar" und Zeitpunkt der Bestaetigung "mindestens 16") und die
// Teilnahme an der Weltrangliste (mit Zeitpunkt) mit, ueber on delete cascade an auth.users. Fuehrt die Schemas WIRKLICH aus,
// in PGlite (ohne Netz, ohne Supabase). Dazu: keine Tabelle in public mit Spalte user_id haelt danach noch eine Zeile des
// Kontos, ein zweites Konto bleibt unberuehrt, und eine Gegenprobe ohne Kaskade bei saison_wahl wird erkannt.
// Lokal nur mit PGlite in node_modules (npm install --no-save --ignore-scripts @electric-sql/pglite@0.5.11).
//   node tests/server-paket2-loeschen.test.mjs
import { readFileSync, readdirSync } from 'node:fs';
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
// Weitere Schemas mit user_id (Nachpruefung N1 19.11.2026: ohne sie blieb eine ungedeckte Tabelle dort unbemerkt, 26/26)
const ZUSATZ = ['supabase/freunde-schema.sql', 'supabase/werkstatt-schema.sql', 'supabase/verwaltung-schema.sql',
  'supabase/coach-schema.sql', 'supabase/schule-schema.sql', 'supabase/gegner-effekte-schema.sql',
  // R31: Kuendigen und Widerrufen (PR 142), braucht abo-schema.sql davor
  'supabase/abo-beenden-schema.sql'];
const GELADEN = [...BISHER, 'supabase/saison-schema.sql', 'supabase/weltrang-schema.sql', ...ZUSATZ];
// Name der Gegenproben-Tabelle: darf nie eine echte Tabelle sein (sonst "already exists" statt einer Meldung)
const PROBE = 'kr_probe_tabelle';

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
  for (const d of ZUSATZ) f = f || await lauf(db, d, lies(d));
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

// Tabellen in public mit Spalte user_id, die beim Kontoloeschen NICHT sicher mitgehen. Gedeckt ist eine Tabelle, wenn
// konto_loeschen() sie ausdruecklich leert (delete from ... im Funktionstext) oder ein Fremdschluessel ueber user_id mit
// on delete cascade auf auth.users zeigt oder auf eine Tabelle, die selbst gedeckt ist (z. B. public.profile). Auf
// auth.users zaehlt auch on delete set null: die Zeile bleibt pseudonym ohne Konto (gewollt, daten-schema.sql
// "Zustimmungen und Sonderstuecke bleiben pseudonym"; so bei stripe_ereignisse in abo-schema.sql), aber nur, wenn user_id
// null sein darf (sonst scheitert das Loeschen an not null, Nachpruefung N3).
// Der delete-Weg zaehlt nur ohne Kommentare und Zeichenketten und nur mit "where user_id = uid" (N2). Grenze: ein toter
// Zweig (if false then ... end if) bleibt fuer diese Textpruefung unsichtbar; den deckt nur ein echter Lauf wie M5.
// B1: weitere Personenspalten. Eine uuid-Spalte (nicht user_id) zaehlt als Person, wenn sie per Fremdschluessel auf auth.users
// zeigt oder, ohne jeden Fremdschluessel, einen Personennamen traegt (heute duelle.a/b, partien_online.weiss/schwarz/
// erstellt_von, freundschaften.von/an, freund_einladungen.von, klassen.leitung, verwaltung_protokoll.wer/ziel_user, 11
// Spalten, alle per Fremdschluessel mit Kaskade bzw. wer mit set null auf freier Spalte). Zeigt sie auf eine andere
// Tabelle (klassen_fortschritt.mitglied), haengt sie an deren Zeile und wird dort geprueft. Grenze: ein Personenbezug ohne
// Fremdschluessel unter einem fremden Namen (etwa "ref") oder in text-/jsonb-Spalten bleibt unsichtbar.
const PERSON = /^(a|b|an|von|wer|spieler|gegner|nutzer|user|mitglied|freund|besitzer|person|konto|leitung|erstellt_von|weiss|schwarz)(_id)?$|_(user|nutzer|spieler|gegner|konto)(_id)?$/i;
const ohneKommentare = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ').replace(/'(?:[^']|'')*'/g, "''");
const geleert = (text, t, s) => new RegExp(`delete\\s+from\\s+(public\\.)?"?${t}"?\\s+where\\s+"?${s}"?\\s*=\\s*uid\\b`, 'i').test(text);
async function ungedeckt(db) {
  const tabellen = (await db.query(`select cl.relname as t from pg_class cl join pg_namespace n on n.oid = cl.relnamespace
    join pg_attribute a on a.attrelid = cl.oid and a.attname = 'user_id' and not a.attisdropped
    where n.nspname = 'public' and cl.relkind in ('r', 'p') order by 1`)).rows.map((r) => r.t);
  const fks = (await db.query(`select cl.relname as t, zn.nspname as zs, ziel.relname as z, c.confdeltype as art,
      a.attnotnull as pflicht
    from pg_constraint c join pg_class cl on cl.oid = c.conrelid join pg_namespace n on n.oid = cl.relnamespace
    join pg_class ziel on ziel.oid = c.confrelid join pg_namespace zn on zn.oid = ziel.relnamespace
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey) and a.attname = 'user_id'
    where c.contype = 'f' and n.nspname = 'public'`)).rows;
  const text = ohneKommentare((await db.query(`select prosrc from pg_proc where proname = 'konto_loeschen'
    and pronamespace = 'public'::regnamespace`)).rows.map((r) => r.prosrc).join('\n'));
  const gedeckt = new Set(tabellen.filter((t) => geleert(text, t, 'user_id')));
  for (let neu = true; neu;) {
    neu = false;
    for (const t of tabellen) {
      if (gedeckt.has(t)) continue;
      if (fks.some((f) => f.t === t && (((f.art === 'c' || (f.art === 'n' && !f.pflicht)) && f.zs === 'auth' && f.z === 'users')
        || (f.art === 'c' && f.zs === 'public' && gedeckt.has(f.z))))) {
        gedeckt.add(t);
        neu = true;
      }
    }
  }
  const uuids = (await db.query(`select cl.relname as t, a.attname as s, a.attnotnull as pflicht,
      coalesce(json_agg(json_build_object('zs', zn.nspname, 'z', ziel.relname, 'art', c.confdeltype))
        filter (where c.oid is not null), '[]') as fk
    from pg_class cl join pg_namespace n on n.oid = cl.relnamespace
    join pg_attribute a on a.attrelid = cl.oid and a.attnum > 0 and not a.attisdropped and a.atttypid = 'uuid'::regtype
    left join pg_constraint c on c.contype = 'f' and c.conrelid = cl.oid and a.attnum = any(c.conkey)
    left join pg_class ziel on ziel.oid = c.confrelid left join pg_namespace zn on zn.oid = ziel.relnamespace
    where n.nspname = 'public' and cl.relkind in ('r', 'p') and a.attname <> 'user_id'
    group by cl.relname, a.attname, a.attnotnull order by 1, 2`)).rows;
  const spalten = []; const offeneSpalten = [];
  for (const { t, s, pflicht, fk } of uuids) {
    const auth = fk.filter((f) => f.zs === 'auth' && f.z === 'users');
    if (!auth.length && (fk.length || !PERSON.test(s))) continue;
    spalten.push(`${t}.${s}`);
    const geht = (auth.length && auth.every((f) => f.art === 'c' || (f.art === 'n' && !pflicht))) || geleert(text, t, s);
    if (!geht) offeneSpalten.push(`${t}.${s}`);
  }
  return { tabellen, offen: tabellen.filter((t) => !gedeckt.has(t)), spalten, offeneSpalten };
}

// ---------- echter Stand ----------
{
  const { db, fehler } = await neueDb();
  pruefe('Schemas laufen (bisher, saison, weltrang, zusatz, daten)', !fehler, fehler);
  if (fehler) { console.log(`\n${ok}/${gesamt} bestanden`); process.exit(1); }

  // N1 statisch: jede Schema-Datei mit einer user_id-Spalte wird hier geladen (eine neue Datei faellt sonst nie auf)
  const mitUserDateien = readdirSync(path.join(WURZEL, 'supabase')).filter((d) => d.endsWith('.sql')
    && !/-(rls-test|zurueck)\.sql$/.test(d) && /\buser_id\s+uuid\b/i.test(lies('supabase/' + d))).map((d) => 'supabase/' + d);
  const fehlt = mitUserDateien.filter((d) => !GELADEN.includes(d));
  pruefe(`alle ${mitUserDateien.length} Schema-Dateien mit user_id werden geladen`, mitUserDateien.length >= 10 && !fehlt.length, fehlt.join(', '));

  // Name aus pg_class + pg_namespace: regclass::text laesst "public." weg, solange public im search_path steht
  const k = (await db.query(`select cl.relname as t, c.confdeltype as art from pg_constraint c
    join pg_class cl on cl.oid = c.conrelid join pg_namespace n on n.oid = cl.relnamespace
    where c.contype = 'f' and c.confrelid = 'auth.users'::regclass
      and n.nspname = 'public' and cl.relname = any($1)`, [TABELLEN])).rows;
  for (const t of TABELLEN) {
    const z = k.find((x) => x.t === t);
    pruefe(`${t}: Fremdschluessel auf auth.users mit on delete cascade`, z && z.art === 'c', JSON.stringify(z));
  }

  // allgemein, auch fuer kuenftige Tabellen: jede Tabelle mit user_id geht beim Kontoloeschen mit
  const g = await ungedeckt(db);
  pruefe(`alle ${g.tabellen.length} Tabellen mit user_id: Kaskade oder delete in konto_loeschen()`,
    g.tabellen.length >= 4 && !g.offen.length, g.offen.join(', '));
  // Gegenproben: neue Tabelle ohne Fremdschluessel (M1), mit Fremdschluessel ohne Kaskade (M2), set null auf einer
  // Pflichtspalte (M6) muss auffallen, mit Kaskade (M3) oder set null auf einer freien Spalte (M4) nicht
  const proben = [
    ['M4 Fremdschluessel mit set null', 'user_id uuid references auth.users (id) on delete set null, rang int', false],
    ['M1 ohne Fremdschluessel', 'user_id uuid not null, rang int', true],
    ['M2 Fremdschluessel ohne Kaskade', 'user_id uuid not null references auth.users (id), rang int', true],
    ['M3 Fremdschluessel mit Kaskade', 'user_id uuid not null references auth.users (id) on delete cascade, rang int', false],
    ['M6 set null auf not null', 'user_id uuid not null references auth.users (id) on delete set null, rang int', true],
  ];
  for (const [name, spalten, rot] of proben) {
    await db.exec(`create table public.${PROBE} (${spalten});`);
    const p = await ungedeckt(db);
    await db.exec(`drop table public.${PROBE};`);
    pruefe(`Gegenprobe ${name}: ${PROBE} ${rot ? 'faellt auf' : 'gilt als gedeckt'}`,
      p.offen.includes(PROBE) === rot && p.offen.length === (rot ? 1 : 0), p.offen.join(', '));
  }

  // B1 (Nachpruefung 2, 19.11.2026): Personen stehen nicht nur in Spalten namens user_id (duelle.a, partien_online.weiss,
  // freundschaften.von ...). Jede weitere uuid-Spalte mit Fremdschluessel auf auth.users oder mit Personennamen muss mitgehen
  pruefe(`alle ${g.spalten.length} weiteren Personenspalten: Kaskade, set null auf freier Spalte oder delete in konto_loeschen()`,
    g.spalten.length >= 10 && !g.offeneSpalten.length, g.offeneSpalten.join(', '));
  const personen = [
    ['P1 spieler ohne Fremdschluessel', 'spieler', 'spieler uuid not null, rang int', true],
    ['P2 gegner_id mit Fremdschluessel ohne Kaskade', 'gegner_id', 'gegner_id uuid references auth.users (id), rang int', true],
    ['P3 gegner_id mit Kaskade', 'gegner_id', 'gegner_id uuid references auth.users (id) on delete cascade, rang int', false],
    ['P4 von mit set null auf freier Spalte', 'von', 'von uuid references auth.users (id) on delete set null, rang int', false],
    ['P5 erstellt_von mit set null auf not null', 'erstellt_von', 'erstellt_von uuid not null references auth.users (id) on delete set null, rang int', true],
    ['P6 beliebiger Name mit Fremdschluessel ohne Kaskade', 'x', 'x uuid references auth.users (id), rang int', true],
    ['P7 uuid ohne Personennamen und ohne Fremdschluessel', 'partie', 'partie uuid not null, rang int', false],
  ];
  for (const [name, spalte, spalten, rot] of personen) {
    await db.exec(`create table public.${PROBE} (${spalten});`);
    const p = await ungedeckt(db);
    await db.exec(`drop table public.${PROBE};`);
    pruefe(`Gegenprobe ${name}: ${PROBE}.${spalte} ${rot ? 'faellt auf' : 'gilt als gedeckt'}`,
      p.offeneSpalten.includes(`${PROBE}.${spalte}`) === rot && p.offeneSpalten.length === (rot ? 1 : 0) && !p.offen.length,
      p.offeneSpalten.join(', '));
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

// ---------- Gegenprobe M5: Tabelle ohne Fremdschluessel, die konto_loeschen() ausdruecklich leert ----------
// (heute haengen alle Tabellen per Fremdschluessel, darum hier den zweiten Weg von ungedeckt() einmal wirklich fahren)
{
  const { db, fehler } = await neueDb();
  await db.exec(`create table public.${PROBE} (user_id uuid not null, rang int);`);
  const vorher = await ungedeckt(db);
  const def = (await db.query(`select pg_get_functiondef('public.konto_loeschen()'::regprocedure) as d`)).rows[0].d;
  const anker = 'delete from public.nutzung where user_id = uid;';
  // N2: Zeilen, die nichts loeschen, duerfen nicht als gedeckt zaehlen
  const taeuschung = [
    ['auskommentiert', `-- delete from public.${PROBE} where user_id = uid;`],
    ['Blockkommentar', `/* delete from public.${PROBE} where user_id = uid; */`],
    ['where false', `delete from public.${PROBE} where false;`],
    ['Zeichenkette', `perform 'delete from public.${PROBE} where user_id = uid ';`],
  ];
  for (const [name, zeile] of taeuschung) {
    const ft = !fehler && def.includes(anker) && await lauf(db, 'konto_loeschen ' + name, def.replace(anker, anker + '\n  ' + zeile));
    const t = await ungedeckt(db);
    pruefe(`Gegenprobe N2 ${name}: ${PROBE} faellt trotzdem auf`, !fehler && def.includes(anker) && !ft && t.offen.includes(PROBE),
      fehler || ft || t.offen.join(', '));
  }
  const f = !fehler && def.includes(anker)
    && await lauf(db, 'konto_loeschen mit ' + PROBE, def.replace(anker, anker + `\n  delete from public.${PROBE} where user_id = uid;`));
  const nachher = await ungedeckt(db);
  const x = f || await lauf(db, 'Lage M5', LAGE + `\n  insert into public.${PROBE} values ('${A}', 3), ('${B}', 5);`);
  const e = !x && await loesche(db, A);
  const zeilen = !x && (await db.query(`select user_id::text as u from public.${PROBE}`)).rows.map((r) => r.u);
  pruefe(`Gegenprobe M5: ohne delete faellt ${PROBE} auf, mit delete in konto_loeschen() gilt sie als gedeckt`,
    !fehler && def.includes(anker) && !f && vorher.offen.includes(PROBE) && !nachher.offen.length,
    fehler || f || `vorher=${vorher.offen} nachher=${nachher.offen}`);
  pruefe('Gegenprobe M5: konto_loeschen() leert die Zeile von A, die von B bleibt',
    !x && !e && zeilen.length === 1 && zeilen[0] === B, x || e || JSON.stringify(zeilen));
}

// ---------- Gegenprobe P8: Personenspalte ohne Fremdschluessel, die konto_loeschen() ausdruecklich leert (B1) ----------
{
  const { db, fehler } = await neueDb();
  await db.exec(`create table public.${PROBE} (spieler uuid not null, rang int);`);
  const vorher = await ungedeckt(db);
  const def = (await db.query(`select pg_get_functiondef('public.konto_loeschen()'::regprocedure) as d`)).rows[0].d;
  const anker = 'delete from public.nutzung where user_id = uid;';
  // INTENTIONAL-SLOP[G5]: SQL nur aus festen Testwerten (PROBE, A, B) fuer PGlite im Speicher, kein Eingang von aussen
  const f = !fehler && def.includes(anker)
    && await lauf(db, 'konto_loeschen mit spieler', def.replace(anker, anker + `\n  delete from public.${PROBE} where spieler = uid;`));
  const nachher = await ungedeckt(db);
  // INTENTIONAL-SLOP[G5]: wie oben, feste Testwerte
  const x = f || await lauf(db, 'Lage P8', LAGE + `\n  insert into public.${PROBE} values ('${A}', 3), ('${B}', 5);`);
  const e = !x && await loesche(db, A);
  const zeilen = !x && (await db.query(`select spieler::text as u from public.${PROBE}`)).rows.map((r) => r.u);
  // INTENTIONAL-SLOP[G5]: nur der Pruefname, kein SQL
  pruefe(`Gegenprobe P8: ohne delete faellt ${PROBE}.spieler auf, mit "delete ... where spieler = uid" gilt sie als gedeckt`,
    !fehler && def.includes(anker) && !f && vorher.offeneSpalten.includes(`${PROBE}.spieler`) && !nachher.offeneSpalten.length,
    fehler || f || `vorher=${vorher.offeneSpalten} nachher=${nachher.offeneSpalten}`);
  pruefe('Gegenprobe P8: konto_loeschen() leert die Zeile von A, die von B bleibt',
    !x && !e && zeilen.length === 1 && zeilen[0] === B, x || e || JSON.stringify(zeilen));
}

console.log(`\n${ok}/${gesamt} bestanden`);
process.exitCode = ok === gesamt ? 0 : 1;
