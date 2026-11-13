// Vorschlag Sondertitel auf der Visitenkarte (supabase/karte-sondertitel-schema.sql, noch nicht eingespielt, R15
// 13.11.2026): fuehrt die bisherigen Schemas und den Vorschlag WIRKLICH aus, in PGlite (ohne Netz, ohne Supabase).
// Erfinder und Pionier zeigt karte_von dem Gegner nur, wenn das Konto das Stueck in sonderstuecke besitzt, beim
// Speichern (karte_sondertitel_waehle, sonst KARTE_TITEL) UND beim Lesen; ein gewaehlter normaler Titel geht vor;
// Unbeteiligte sehen weiter nichts; laeuft mit und ohne karte-elo-schema.sql und ohne Tabelle sonderstuecke; der
// Rueckweg nimmt alles wieder heraus.
// Lokal nur mit PGlite in node_modules (npm install --no-save --ignore-scripts @electric-sql/pglite@0.5.11).
//   node tests/server-karte-sondertitel.test.mjs
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
create table auth.users (id uuid primary key, email text, created_at timestamptz not null default now());
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

// wie tests/server-karte-elo.test.mjs, dazu Werkstatt (Tabelle sonderstuecke) und Pionier
const BISHER = ['supabase/schema.sql', 'supabase/abo-schema.sql', 'supabase/online-schema.sql', 'supabase/kronen-schema.sql',
  'supabase/raetsel-duell-schema.sql', 'supabase/raetsel-duell-daten.sql', 'supabase/karte-schema.sql',
  'supabase/liga-bild-schema.sql', 'supabase/daten-schema.sql', 'supabase/zwei-ligen-schema.sql', 'supabase/daten-schema.sql'];
const WERKSTATT = ['supabase/werkstatt-schema.sql', 'supabase/pionier-schema.sql'];

const A = 'e1000000-0000-4000-8000-0000000000a1';   // Erfinder
const B = 'e2000000-0000-4000-8000-0000000000b2';   // Pionier Nr. 7
const C = 'e3000000-0000-4000-8000-0000000000c3';   // weder noch, nicht in der Partie
const D = 'e4000000-0000-4000-8000-0000000000d4';   // weder noch, Gegner von C
const ALS = (uid) => `select set_config('request.jwt.claims', '{"sub":"${uid}","role":"authenticated"}', false);`;

async function neueDb({ werkstatt = true, elo = false } = {}) {
  const db = new PGlite();
  let f = await lauf(db, 'Attrappe', ATTRAPPE);
  for (const d of [...BISHER, ...(werkstatt ? WERKSTATT : [])]) f = f || await lauf(db, d, lies(d));
  if (elo) f = f || await lauf(db, 'karte-elo-schema.sql', lies('supabase/karte-elo-schema.sql'));
  f = f || await lauf(db, 'karte-sondertitel-schema.sql', lies('supabase/karte-sondertitel-schema.sql'));
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
    -- der Trigger aus pionier-schema.sql gibt jedem neuen Konto eine Nummer; hier zaehlen nur die festen Stuecke
    delete from public.sonderstuecke;
    insert into public.sonderstuecke (stueck_id, art, user_id, nummer) values
      ('erfinder-titel', 'titel', '${A}', 0), ('pionier-007', 'titel', '${B}', 7);
    `);
  }
  return { db, fehler: null };
}

async function als(db, uid, sql) {
  await db.exec(ALS(uid) + 'set role authenticated;');
  try {
    return (await db.query(sql)).rows[0];
  } catch (e) {
    return { fehler: e.message };
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claims', '', false);`);
  }
}
const partie = async (db, art) => (await db.query(`select id from test_partien where art = '${art}'`)).rows[0].id;
const karte = async (db, uid, art) => {
  const r = await als(db, uid, `select public.karte_der_partie('${await partie(db, art)}') as k`);
  return r.fehler ? r : r.k;
};
const waehle = (db, uid, titel) => als(db, uid, `select public.karte_sondertitel_waehle(${titel === null ? 'null' : `'${titel}'`}) as r`);

{
  const { db, fehler } = await neueDb();
  pruefe('bisherige Schemas, Werkstatt, Pionier und der Vorschlag laufen', !fehler, fehler);
  if (fehler) { console.log(`\n${ok}/${gesamt} bestanden`); process.exit(1); }

  {
    const k = await karte(db, B, 'ab');
    pruefe('ohne Meldung: kein Sondertitel beim Gegner', k?.w && k.w.titel === null, JSON.stringify(k));
  }
  {
    const r = await waehle(db, A, 'erfinder');
    pruefe('Erfinder meldet "erfinder": angenommen', r?.r?.titel === 'erfinder', JSON.stringify(r));
    const k = await karte(db, B, 'ab');
    pruefe('Gegner sieht beim Erfinder den Titel "erfinder"', k?.w?.titel === 'erfinder', JSON.stringify(k?.w));
  }
  {
    const r = await waehle(db, B, 'pionier');
    pruefe('Pionier meldet "pionier": angenommen', r?.r?.titel === 'pionier', JSON.stringify(r));
    const k = await karte(db, A, 'ab');
    pruefe('Gegner sieht beim Pionier "pionier-007" (mit Nummer)', k?.s?.titel === 'pionier-007', JSON.stringify(k?.s));
  }
  {
    const r1 = await waehle(db, B, 'erfinder');
    pruefe('Pionier meldet "erfinder": KARTE_TITEL (kein Besitz)', /KARTE_TITEL/.test(r1?.fehler || ''), JSON.stringify(r1));
    const r2 = await waehle(db, C, 'pionier');
    pruefe('Konto ohne Stueck meldet "pionier": KARTE_TITEL', /KARTE_TITEL/.test(r2?.fehler || ''), JSON.stringify(r2));
    const r3 = await waehle(db, C, 'level-100');
    pruefe('Freitext/anderer Titel: KARTE_TITEL', /KARTE_TITEL/.test(r3?.fehler || ''), JSON.stringify(r3));
    const r4 = await db.query(`select count(*)::int as n from public.karte_sondertitel where user_id = '${C}'`);
    pruefe('abgelehnte Meldungen schreiben nichts', r4.rows[0].n === 0, JSON.stringify(r4.rows[0]));
  }
  {
    const r = await als(db, A, `select public.karte_waehle('start', 'level-5', '{}', 'P', 'standard', 'ohne') as r`);
    const k = await karte(db, B, 'ab');
    pruefe('gewaehlter normaler Titel geht vor ("level-5")', !r.fehler && k?.w?.titel === 'level-5', JSON.stringify(r.fehler || k?.w));
    await als(db, A, `select public.karte_waehle('start', null, '{}', 'P', 'standard', 'ohne') as r`);
    const k2 = await karte(db, B, 'ab');
    pruefe('ohne normalen Titel wieder der Sondertitel', k2?.w?.titel === 'erfinder', JSON.stringify(k2?.w));
  }
  {
    await db.exec(`update public.sonderstuecke set user_id = null where stueck_id = 'pionier-007'`);
    const k = await karte(db, A, 'ab');
    pruefe('Besitz weg: beim Lesen kein Sondertitel mehr', k?.s && k.s.titel === null, JSON.stringify(k?.s));
    await db.exec(`update public.sonderstuecke set user_id = '${B}' where stueck_id = 'pionier-007'`);
  }
  {
    const r = await waehle(db, A, null);
    const k = await karte(db, B, 'ab');
    pruefe('null loescht den Sondertitel', r?.r && r.r.titel === null && k?.w?.titel === null, JSON.stringify(r) + ' ' + JSON.stringify(k?.w));
    await waehle(db, A, 'erfinder');
  }
  {
    const k = await karte(db, C, 'ab');
    pruefe('Unbeteiligter wird weiter abgewiesen', /KARTE_KEINE_PARTIE/.test(k?.fehler || ''), JSON.stringify(k));
    const r = await als(db, C, `select count(*)::int as n from public.karte_sondertitel`);
    pruefe('Tabelle karte_sondertitel ist fuer Nutzer zu', /permission denied/.test(r?.fehler || ''), JSON.stringify(r));
    const a = await db.query('select public.karte_sondertitel_waehle(null) as r').catch((e) => ({ fehler: e.message }));
    pruefe('ohne Anmeldung: KARTE_ANMELDUNG', /KARTE_ANMELDUNG/.test(a?.fehler || ''), JSON.stringify(a));
  }
  {
    const r = await db.query(`select
      has_function_privilege('anon', 'public.karte_sondertitel_waehle(text)', 'execute') as anon,
      has_function_privilege('authenticated', 'public.karte_sondertitel_waehle(text)', 'execute') as auth,
      has_function_privilege('authenticated', 'public.karte_sonderstueck(uuid, text)', 'execute') as intern,
      has_function_privilege('authenticated', 'public.karte_von(uuid)', 'execute') as von`);
    const x = r.rows[0];
    pruefe('Rechte: waehle nur angemeldet, karte_sonderstueck und karte_von intern', x.anon === false && x.auth === true && x.intern === false && x.von === false, JSON.stringify(x));
  }
  {
    const x = await lauf(db, 'karte-rls-test.sql', lies('supabase/karte-rls-test.sql'));
    pruefe('karte-rls-test.sql laeuft mit dem Vorschlag', !x, x);
  }
  {
    const x = await lauf(db, 'karte-elo-schema.sql', lies('supabase/karte-elo-schema.sql'));
    const k = await karte(db, B, 'ab');
    pruefe('danach karte-elo-schema.sql: Sondertitel bleibt, Feld elo da', !x && k?.w?.titel === 'erfinder' && 'elo' in k.w, x || JSON.stringify(k?.w));
  }
  {
    const x = await lauf(db, 'karte-sondertitel-zurueck.sql', lies('supabase/karte-sondertitel-zurueck.sql'));
    pruefe('Rueckweg laeuft', !x, x);
    const k = await karte(db, B, 'ab');
    pruefe('nach dem Rueckweg: kein Sondertitel, Karte geht weiter', k?.w && k.w.titel === null && k.w.name !== undefined, JSON.stringify(k));
    const t = await db.query(`select to_regclass('public.karte_sondertitel') as t, to_regprocedure('public.karte_sondertitel_waehle(text)') as f`);
    pruefe('nach dem Rueckweg: Tabelle und Funktion weg', t.rows[0].t === null && t.rows[0].f === null, JSON.stringify(t.rows[0]));
    const y = await lauf(db, 'karte-rls-test.sql', lies('supabase/karte-rls-test.sql'));
    pruefe('karte-rls-test.sql laeuft nach dem Rueckweg', !y, y);
    const z = await lauf(db, 'karte-sondertitel-schema.sql', lies('supabase/karte-sondertitel-schema.sql'));
    pruefe('Vorschlag laeuft erneut (wiederholbar)', !z, z);
  }
}
{
  // erst karte-elo-schema.sql, dann der Vorschlag: beide zusammen
  const { db, fehler } = await neueDb({ elo: true });
  pruefe('mit karte-elo-schema.sql davor: laeuft', !fehler, fehler);
  if (!fehler) {
    await db.exec(`insert into public.kronen_stand (user_id, elo, elo_n) values ('${A}', 1530, 5)`);
    await waehle(db, A, 'erfinder');
    const k = await karte(db, B, 'ab');
    pruefe('mit Elo: Gegner sieht Elo 1530 und "erfinder"', k?.w?.elo === 1530 && k.w.titel === 'erfinder', JSON.stringify(k?.w));
  }
}
{
  // ohne Werkstatt (Tabelle sonderstuecke fehlt): laeuft, niemand hat einen Sondertitel
  const { db, fehler } = await neueDb({ werkstatt: false });
  pruefe('ohne Tabelle sonderstuecke: Vorschlag laeuft', !fehler, fehler);
  if (!fehler) {
    const r = await waehle(db, A, 'erfinder');
    pruefe('ohne Tabelle sonderstuecke: "erfinder" wird abgelehnt (KARTE_TITEL)', /KARTE_TITEL/.test(r?.fehler || ''), JSON.stringify(r));
    const k = await karte(db, B, 'ab');
    pruefe('ohne Tabelle sonderstuecke: Karte geht, kein Titel', k?.w && k.w.titel === null, JSON.stringify(k));
  }
}
{
  // Rueckweg = Fassung aus karte-schema.sql (wortgleich, ohne Kommentare und Leerraum)
  const rumpf = (t) => (t.match(/create or replace function public\.karte_von[\s\S]*?\$\$[\s\S]*?\$\$;/) || [''])[0]
    .replace(/--.*$/gm, '').replace(/\s+/g, ' ');
  pruefe('Rueckweg: karte_von wortgleich mit karte-schema.sql',
    rumpf(lies('supabase/karte-sondertitel-zurueck.sql')) === rumpf(lies('supabase/karte-schema.sql')) && rumpf(lies('supabase/karte-schema.sql')).length > 100);
}

console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
