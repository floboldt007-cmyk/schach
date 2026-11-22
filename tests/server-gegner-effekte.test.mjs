// Vorschlag Effekte vom Gegner (supabase/gegner-effekte-schema.sql, noch nicht eingespielt, R26 21.11.2026): fuehrt die
// bisherigen Schemas und den Vorschlag WIRKLICH aus, in PGlite (ohne Netz, ohne Supabase). Der Gegner bekommt Figuren,
// Zug-Animation und Finisher nur, wenn der Server den Besitz belegt (Standard fuer alle, sonst Sonderstueck); alles
// andere ist null. Unbeteiligte und anon sehen nichts, die Tabelle ist nicht direkt lesbar, eine fremde Kennung wird
// abgelehnt, ein verlorenes Stueck verschwindet beim naechsten Lesen, ohne Tabelle sonderstuecke gilt nur der Standard,
// der Rueckweg raeumt alles ab. Dazu: die festen Listen stimmen mit der App ueberein.
// Lokal nur mit PGlite in node_modules (npm install --no-save --ignore-scripts @electric-sql/pglite@0.5.11).
//   node tests/server-gegner-effekte.test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lies = (d) => readFileSync(path.join(WURZEL, d), 'utf8');
let ok = 0;
let gesamt = 0;
function pruefe(name, bedingung, info) {
  gesamt++;
  if (bedingung) { ok++; console.log('ok     ' + name); } else console.log('FEHLER ' + name + (info !== undefined ? '  -> ' + JSON.stringify(info) : ''));
}

// --- Listen: SQL gegen App (ohne Datenbank) ---
const schema = lies('supabase/gegner-effekte-schema.sql');
const sqlListe = (art) => {
  const m = schema.match(new RegExp(`when '${art}' then array\\[([^\\]]*)\\]`));
  return m ? [...m[1].matchAll(/'([a-z0-9-]+)'/g)].map((x) => x[1]) : [];
};
const labor = lies('js/labor.js').match(/LABOR_FIGUREN = Object\.freeze\(\[([^\]]*)\]/);
const appFiguren = ['cburnett', 'blaupause', ...(labor ? [...labor[1].matchAll(/'([a-z0-9-]+)'/g)].map((x) => x[1]) : [])];
const appFinisher = [...lies('js/pakete/finisher/index.js').matchAll(/Object\.freeze\(\{ id: '([a-z0-9-]+)', text:/g)].map((x) => x[1]);
const vorrat = JSON.parse(lies('assets/shop/vorrat.json'));
const appZug = ['aus', ...vorrat.stuecke.filter((s) => s.art === 'effekt' && s.anlass === 'zug').map((s) => s.id)];
const gleich = (a, b) => a.length === b.length && [...a].sort().join() === [...b].sort().join();
pruefe('Liste figuren = cburnett, blaupause und LABOR_FIGUREN (js/labor.js, js/figurensatz.js)', gleich(sqlListe('figuren'), appFiguren),
  { sql: sqlListe('figuren'), app: appFiguren });
pruefe('Liste finisher = FINISHER (js/pakete/finisher/index.js)', appFinisher.length > 3 && gleich(sqlListe('finisher'), appFinisher),
  { sql: sqlListe('finisher'), app: appFinisher });
pruefe('Liste zug = aus und die Zug-Effekte aus assets/shop/vorrat.json', appZug.length > 1 && gleich(sqlListe('zug'), appZug),
  { sql: sqlListe('zug'), app: appZug });
pruefe('Standard steht je Liste vorn (cburnett, aus, aus)', sqlListe('figuren')[0] === 'cburnett' && sqlListe('zug')[0] === 'aus'
  && sqlListe('finisher')[0] === 'aus');

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
  try {
    await db.exec(sql);
    return null;
  } catch (e) {
    return `${name}: ${e.message}`;
  }
}

// wie tests/server-karte-sondertitel.test.mjs
const BISHER = ['supabase/schema.sql', 'supabase/abo-schema.sql', 'supabase/online-schema.sql', 'supabase/kronen-schema.sql',
  'supabase/raetsel-duell-schema.sql', 'supabase/raetsel-duell-daten.sql', 'supabase/karte-schema.sql',
  'supabase/liga-bild-schema.sql', 'supabase/daten-schema.sql', 'supabase/zwei-ligen-schema.sql', 'supabase/daten-schema.sql'];
const WERKSTATT = ['supabase/werkstatt-schema.sql', 'supabase/pionier-schema.sql'];

const A = 'e1000000-0000-4000-8000-0000000000a1';   // Erfinder (alle vier Sonderstuecke)
const B = 'e2000000-0000-4000-8000-0000000000b2';   // ohne Sonderstuecke, Gegner von A
const C = 'e3000000-0000-4000-8000-0000000000c3';   // nicht in der Partie ab
const D = 'e4000000-0000-4000-8000-0000000000d4';   // Gegner von C
const ALS = (uid) => `select set_config('request.jwt.claims', '{"sub":"${uid}","role":"authenticated"}', false);`;

async function neueDb({ werkstatt = true } = {}) {
  const db = new PGlite();
  let f = await lauf(db, 'Attrappe', ATTRAPPE);
  for (const d of [...BISHER, ...(werkstatt ? WERKSTATT : [])]) f = f || await lauf(db, d, lies(d));
  f = f || await lauf(db, 'gegner-effekte-schema.sql', schema);
  if (f) return { db, fehler: f };
  await db.exec(`
  insert into auth.users (id, email) values ('${A}', 'a@x'), ('${B}', 'b@x'), ('${C}', 'c@x'), ('${D}', 'd@x');
  create table test_partien (art text primary key, id uuid);
  with p as (insert into public.partien_online (erstellt_von, fen, bedenkzeit_s, inkrement_s)
             values ('${A}', 'x', 300, 3) returning id)
  insert into test_partien select 'ab', id from p;
  with p as (insert into public.partien_online (erstellt_von, fen, bedenkzeit_s, inkrement_s)
             values ('${C}', 'x', 300, 3) returning id)
  insert into test_partien select 'cd', id from p;
  update public.partien_online set status = 'laeuft', letzter_zug_am = now(), gewertet = true,
    weiss = case when erstellt_von = '${A}' then '${A}'::uuid else '${C}'::uuid end,
    schwarz = case when erstellt_von = '${A}' then '${B}'::uuid else '${D}'::uuid end;
  grant select on test_partien to authenticated;
  `);
  if (werkstatt) {
    await db.exec(`
    delete from public.sonderstuecke;
    insert into public.sonderstuecke (stueck_id, art, user_id, nummer) values
      ('erfinder-titel', 'titel', '${A}', 0), ('erfinder-figuren-blaupause', 'figurensatz', '${A}', 0),
      ('erfinder-finisher-signatur', 'finisher', '${A}', 0);
    `);
  }
  return { db, fehler: null };
}

async function als(db, uid, sql, rolle = 'authenticated') {
  await db.exec((uid ? ALS(uid) : '') + `set role ${rolle};`);
  try {
    return (await db.query(sql)).rows[0];
  } catch (e) {
    return { fehler: e.message };
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claims', '', false);`);
  }
}
const partie = async (db, art) => (await db.query(`select id from test_partien where art = '${art}'`)).rows[0].id;
const effekte = async (db, uid, art) => {
  const r = await als(db, uid, `select public.effekte_der_partie('${await partie(db, art)}') as e`);
  return r.fehler ? r : r.e;
};
const q = (x) => (x === null ? 'null' : `'${x}'`);
const waehle = (db, uid, f, z, fi) => als(db, uid, `select public.effekte_waehle(${q(f)}, ${q(z)}, ${q(fi)}) as r`);

{
  const { db, fehler } = await neueDb();
  pruefe('bisherige Schemas, Werkstatt, Pionier und der Vorschlag laufen', !fehler, fehler);
  if (fehler) { console.log(`\n${ok}/${gesamt} bestanden`); process.exit(1); }
  pruefe('Vorschlag ist wiederholbar (zweites Einspielen ohne Fehler)', !(await lauf(db, 'zweimal', schema)));

  let e = await effekte(db, A, 'ab');
  pruefe('ohne gemeldete Wahl: beide Seiten null (Gegner zeigt den Standard)', e && e.w && e.s && e.w.figuren === null && e.s.zug === null
    && e.s.finisher === null, e);

  // B (ohne Sonderstuecke) meldet Labor-Satz, Zug-Effekt und Stufen-Finisher: nichts davon ist belegt
  pruefe('B darf melden (Liste stimmt)', (await waehle(db, B, 'drachen', 'wellenring', 'krone')).r === true);
  e = await effekte(db, A, 'ab');
  pruefe('A sieht von B nichts, was B nicht besitzt (drachen/wellenring/krone -> null)', e.s.figuren === null && e.s.zug === null
    && e.s.finisher === null, e.s);
  await waehle(db, B, 'cburnett', 'aus', 'aus');
  e = await effekte(db, A, 'ab');
  pruefe('Standard ist fuer jeden belegt (cburnett/aus/aus)', e.s.figuren === 'cburnett' && e.s.zug === 'aus' && e.s.finisher === 'aus', e.s);

  // A (Erfinder) meldet Labor-Satz, Zug-Effekt, Signatur-Finisher
  await waehle(db, A, 'drachen', 'funkenspur', 'signatur');
  e = await effekte(db, B, 'ab');
  pruefe('B sieht von A Labor-Satz, Zug-Effekt und Signatur (Erfinder besitzt)', e.w.figuren === 'drachen' && e.w.zug === 'funkenspur'
    && e.w.finisher === 'signatur', e.w);
  await waehle(db, A, 'blaupause', 'funkenspur', 'signatur');
  e = await effekte(db, B, 'ab');
  pruefe('Blaupause mit eigenem Sonderstueck sichtbar', e.w.figuren === 'blaupause', e.w);

  // verlorene Stuecke verschwinden beim naechsten Lesen
  await db.exec(`delete from public.sonderstuecke where stueck_id = 'erfinder-figuren-blaupause'`);
  e = await effekte(db, B, 'ab');
  pruefe('Blaupause weg -> null, der Rest bleibt (erfinder-titel deckt keine Blaupause)', e.w.figuren === null && e.w.zug === 'funkenspur', e.w);
  await db.exec(`delete from public.sonderstuecke where stueck_id = 'erfinder-titel'`);
  e = await effekte(db, B, 'ab');
  pruefe('Erfinder-Titel weg -> Zug-Effekt null, Signatur haengt am eigenen Stueck', e.w.zug === null && e.w.finisher === 'signatur', e.w);

  // Ablehnungen
  let r = await waehle(db, B, 'unbekannt', null, null);
  pruefe('fremde Kennung -> EFFEKTE_WAHL', /EFFEKTE_WAHL/.test(r.fehler || ''), r);
  r = await waehle(db, B, null, 'konfetti', null);
  pruefe('Sieg-Effekt ist kein Zug-Effekt -> EFFEKTE_WAHL', /EFFEKTE_WAHL/.test(r.fehler || ''), r);
  r = await waehle(db, B, null, null, null);
  pruefe('null fuer alles ist erlaubt (Standard)', r.r === true, r);
  r = await als(db, C, `select public.effekte_der_partie('${await partie(db, 'ab')}') as e`);
  pruefe('Unbeteiligter (C) -> EFFEKTE_KEINE_PARTIE', /EFFEKTE_KEINE_PARTIE/.test(r.fehler || ''), r);
  r = await als(db, null, `select public.effekte_der_partie('${await partie(db, 'ab')}') as e`, 'anon');
  pruefe('anon darf effekte_der_partie nicht ausfuehren', /permission denied/.test(r.fehler || ''), r);
  r = await als(db, null, `select public.effekte_waehle('cburnett', null, null) as r`, 'anon');
  pruefe('anon darf effekte_waehle nicht ausfuehren', /permission denied/.test(r.fehler || ''), r);
  r = await als(db, B, `select count(*)::int as n from public.karte_effekte`);
  pruefe('Tabelle karte_effekte ist fuer Angemeldete nicht direkt lesbar', /permission denied/.test(r.fehler || ''), r);
  r = await als(db, B, `select public.effekte_von('${A}') as e`);
  pruefe('effekte_von (intern) ist fuer Angemeldete gesperrt', /permission denied/.test(r.fehler || ''), r);
  r = await als(db, B, `select public.effekte_besitzt('${A}', 'zug', 'funkenspur') as e`);
  pruefe('effekte_besitzt (intern) ist fuer Angemeldete gesperrt', /permission denied/.test(r.fehler || ''), r);
  r = await als(db, B, `insert into public.karte_effekte (user_id, figuren) values ('${B}', 'drachen') returning user_id`);
  pruefe('direktes Schreiben in karte_effekte ist gesperrt', /permission denied/.test(r.fehler || ''), r);

  // Rueckweg
  const zf = await lauf(db, 'zurueck', lies('supabase/gegner-effekte-zurueck.sql'));
  const rest = (await db.query(`select count(*)::int as n from pg_proc p join pg_namespace s on s.oid = p.pronamespace
    where s.nspname = 'public' and p.proname like 'effekte\\_%'`)).rows[0].n;
  const tab = (await db.query(`select to_regclass('public.karte_effekte') is null as weg`)).rows[0].weg;
  pruefe('Rueckweg laeuft und raeumt Funktionen und Tabelle ab', !zf && rest === 0 && tab === true, { zf, rest, tab });
  pruefe('Rueckweg ist wiederholbar', !(await lauf(db, 'zurueck 2', lies('supabase/gegner-effekte-zurueck.sql'))));
  pruefe('nach dem Rueckweg laesst sich der Vorschlag neu einspielen', !(await lauf(db, 'neu', schema)));
  const karte = (await als(db, A, `select public.karte_der_partie('${await partie(db, 'ab')}') as k`)).k;
  pruefe('karte_der_partie bleibt unberuehrt nutzbar', karte && karte.w && karte.s, karte);
}

{
  const { db, fehler } = await neueDb({ werkstatt: false });
  pruefe('ohne Werkstatt (keine Tabelle sonderstuecke) laeuft der Vorschlag', !fehler, fehler);
  if (!fehler) {
    await waehle(db, A, 'drachen', 'aus', 'aus');
    const e = await effekte(db, B, 'ab');
    pruefe('ohne sonderstuecke gilt nur der Standard (drachen -> null, aus bleibt)', e.w.figuren === null && e.w.zug === 'aus', e.w);
  }
}

console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
