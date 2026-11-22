// Vorschlag Titel nur mit Beleg (supabase/karte-titel-schema.sql, R27 Schritt 1, NICHT eingespielt) in PGlite: der Stand wie
// live (karte-, karte-elo-, karte-sondertitel-schema.sql), dazu der Rahmen-Vorschlag karte-besitz-schema.sql (#274, darauf
// baut dieser Schritt), dann der Vorschlag. Geprueft: ein Gold-Titel ohne gebuchte Stufe 3 seiner Familie und ein Level-Titel
// ohne passende Level-Stufe werden abgelehnt (KARTE_TITEL) und ein schon gespeicherter beim Gegner nicht gezeigt; echte
// Besitzer, Koennen- und die uebrigen Erfolgs-Titel weiter ok; ein Sondertitel springt fuer den unbelegten Titel ein; Daten
// nicht umgeschrieben; Rechte unveraendert; Rueckweg zeichengleich zur Fassung von #274 und wiederholbar.
// Erwartungen kommen aus js/pakete/sammlung/stufen.js (Gold-Titel und Level-Ziele), damit Server und App nicht auseinanderlaufen.
// Rote Gegenprobe: TITEL_SCHEMA=<leere Datei> node tests/server-karte-titel.test.mjs
//   node tests/server-karte-titel.test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { FAMILIEN } from '../js/pakete/sammlung/stufen.js';

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
// wie tests/server-karte-besitz.test.mjs, dazu dessen Vorschlag (Voraussetzung dieses Schritts)
const BISHER = ['supabase/schema.sql', 'supabase/abo-schema.sql', 'supabase/online-schema.sql', 'supabase/kronen-schema.sql',
  'supabase/raetsel-duell-schema.sql', 'supabase/raetsel-duell-daten.sql', 'supabase/karte-schema.sql',
  'supabase/liga-bild-schema.sql', 'supabase/daten-schema.sql', 'supabase/zwei-ligen-schema.sql', 'supabase/daten-schema.sql',
  'supabase/werkstatt-schema.sql', 'supabase/pionier-schema.sql', 'supabase/karte-elo-schema.sql', 'supabase/karte-sondertitel-schema.sql',
  'supabase/karte-besitz-schema.sql'];
const SCHEMA = process.env.TITEL_SCHEMA ? readFileSync(process.env.TITEL_SCHEMA, 'utf8') : lies('supabase/karte-titel-schema.sql');
const ZURUECK = lies('supabase/karte-titel-zurueck.sql');
const block = (s, name) => { const a = s.indexOf(`create or replace function public.${name}(`); return a < 0 ? null : s.slice(a, s.indexOf('$$;\n', a) + 4); };
for (const fn of ['karte_waehle', 'karte_von']) {
  pruefe(`Rueckweg: ${fn} zeichengleich mit karte-besitz-schema.sql (#274)`, !!block(ZURUECK, fn) && block(ZURUECK, fn) === block(lies('supabase/karte-besitz-schema.sql'), fn));
}

// Erwartung aus der App: Gold-Titel je Familie, Level-Ziele der Familie level
const GOLD = FAMILIEN.filter((f) => f.gold.titel).map((f) => ({ familie: f.id, titel: f.gold.titel }));
const LEVEL_ZIELE = FAMILIEN.find((f) => f.id === 'level').ziele({});
const brauchtLevel = (n) => LEVEL_ZIELE.filter((z) => z <= n).length;
pruefe('Erwartung: sieben Gold-Titel und Level-Ziele 10/20/30 aus stufen.js', GOLD.length === 7 && LEVEL_ZIELE.join() === '10,20,30', JSON.stringify({ GOLD, LEVEL_ZIELE }));

const C = 'e3000000-0000-4000-8000-0000000000c3';   // fritz: keine Stufen
const D = 'e4000000-0000-4000-8000-0000000000d4';   // Gegner
const E = 'e5000000-0000-4000-8000-0000000000e5';   // echter Besitzer (alle Familien Stufe 3, Liga Koenig III)
const db = new PGlite();
let f = await lauf(db, 'Attrappe', ATTRAPPE);
for (const d of BISHER) f = f || await lauf(db, d, lies(d));
pruefe('Stand wie live plus #274 laeuft (Karte, Elo, Sondertitel, Rahmen-Beleg)', !f, f);
if (f) { console.log(`\n${ok}/${gesamt} bestanden`); process.exit(1); }
const LEVEL_TITEL = (await db.query(`select x as t from jsonb_array_elements_text(public.karte_konstanten() -> 'titel') x where x ~ '^level-'`)).rows.map((r) => r.t);
pruefe('Server-Liste kennt 14 Level-Titel', LEVEL_TITEL.length === 14, LEVEL_TITEL.join());
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
insert into public.karte_stufen (user_id, familie, stufe)
  select '${E}', f, s from unnest(array['siege', 'welten', 'sterne', 'endgegner', 'serie', 'level']) f, generate_series(1, 3) s;
`);
async function als(uid, sql) {
  await db.exec(`select set_config('request.jwt.claims', '{"sub":"${uid}","role":"authenticated"}', false); set role authenticated;`);
  try { return (await db.query(sql)).rows[0]; } catch (e) { return { fehler: e.message }; } finally {
    await db.exec(`reset role; select set_config('request.jwt.claims', '', false);`);
  }
}
const waehle = (uid, titel) => als(uid, `select public.karte_waehle('start', ${titel === null ? 'null' : `'${titel}'`}, null, 'Q', 'standard', 'ohne') as r`);
const abgelehnt = (r) => /KARTE_TITEL/.test(r.fehler || '');
const partie = async (art) => (await db.query(`select id from test_partien where art = '${art}'`)).rows[0].id;
const titelBeiGegner = async (art) => {
  const r = await als(D, `select public.karte_der_partie('${await partie(art)}') as k`);
  return r.fehler ? 'FEHLER ' + r.fehler : r.k?.w?.titel ?? null;
};

// vorher (Stand live + #274): der Befund aus dem Plan (karte-schema.sql:8-10, :341)
{
  const r = await waehle(C, 'level-100');
  pruefe('vorher: fritz ohne Stufen setzt level-100, der Server nimmt es an (Befund)', !r.fehler, JSON.stringify(r));
  const r2 = await waehle(C, 'erfolg-ewige-flamme');
  pruefe('vorher: fritz ohne Stufen setzt erfolg-ewige-flamme (Befund)', !r2.fehler, JSON.stringify(r2));
  pruefe('vorher: der Gegner sieht erfolg-ewige-flamme', await titelBeiGegner('cd') === 'erfolg-ewige-flamme');
}
f = await lauf(db, 'karte-titel-schema.sql', SCHEMA);
pruefe('karte-titel-schema.sql laeuft', !f, f);
f = await lauf(db, 'karte-titel-schema.sql (2.)', SCHEMA);
pruefe('karte-titel-schema.sql ist wiederholbar', !f, f);
{
  const g = await titelBeiGegner('cd');
  pruefe('Lesepfad: der gespeicherte unbelegte Gold-Titel erscheint beim Gegner nicht (null)', g === null, g);
  const roh = (await db.query(`select titel from public.karte_wahl where user_id = '${C}'`)).rows[0]?.titel;
  pruefe('Daten nicht umgeschrieben (karte_wahl behaelt erfolg-ewige-flamme)', roh === 'erfolg-ewige-flamme', roh);
  // Sondertitel springt ein, wenn der gespeicherte normale Titel nicht belegt ist
  await db.exec(`insert into public.sonderstuecke (stueck_id, art, user_id) values ('erfinder-titel', 'titel', '${C}');
    update public.karte_wahl set sondertitel = 'erfinder' where user_id = '${C}';`);
  pruefe('Lesepfad: mit Sondertitel zeigt der Gegner ihn statt des unbelegten Titels', await titelBeiGegner('cd') === 'erfinder');
  await db.exec(`update public.karte_wahl set sondertitel = null where user_id = '${C}'; delete from public.sonderstuecke where stueck_id = 'erfinder-titel';`);

  for (const { familie, titel } of GOLD) {
    pruefe(`fritz ohne Stufe: Gold-Titel ${titel} (${familie}) abgelehnt`, abgelehnt(await waehle(C, titel)));
  }
  for (const t of LEVEL_TITEL) {
    const n = Number(t.slice(6));
    const r = await waehle(C, t);
    pruefe(`fritz ohne Level-Stufe: ${t} ${brauchtLevel(n) === 0 ? 'frei' : 'abgelehnt'}`, brauchtLevel(n) === 0 ? !r.fehler : abgelehnt(r), JSON.stringify(r));
  }
  for (const t of [null, 'erfolg-feuertaufe', 'erfolg-wochenflamme', 'erfolg-goldlorbeer', 'koennen-blitzschlag', 'koennen-erzfeind']) {
    const r = await waehle(C, t);
    pruefe(`ohne Beleg weiter frei (Koennen und uebrige Erfolge, Liste): ${t}`, !r.fehler, JSON.stringify(r));
  }
  pruefe('unbekannter Titel weiter KARTE_TITEL', abgelehnt(await waehle(C, 'level-99')));
  // Stufen kommen der Reihe nach: mit Level-Stufe 1 bzw. 2 genau die Titel bis unter das naechste Ziel
  for (const stufe of [1, 2]) {
    await db.exec(`insert into public.karte_stufen (user_id, familie, stufe) values ('${C}', 'level', ${stufe})`);
    for (const t of LEVEL_TITEL) {
      const n = Number(t.slice(6));
      const r = await waehle(C, t);
      const frei = brauchtLevel(n) <= stufe;
      pruefe(`fritz mit Level-Stufe ${stufe}: ${t} ${frei ? 'angenommen' : 'abgelehnt'}`, frei ? !r.fehler : abgelehnt(r), JSON.stringify(r));
    }
  }
  await db.exec(`insert into public.karte_stufen (user_id, familie, stufe) values ('${C}', 'serie', 1), ('${C}', 'serie', 2)`);
  pruefe('fritz mit Serie-Stufe 2: Gold-Titel erfolg-ewige-flamme weiter abgelehnt', abgelehnt(await waehle(C, 'erfolg-ewige-flamme')));
  const t20 = await waehle(C, 'level-20');
  pruefe('fritz mit Level-Stufe 2: level-20 angenommen und beim Gegner sichtbar', !t20.fehler && await titelBeiGegner('cd') === 'level-20');
  // echter Besitzer: alle Gold-Titel (liga ueber kronen_stand, karte_sichern bucht beim Waehlen) und der hoechste Level-Titel
  for (const t of [...GOLD.map((x) => x.titel), 'level-100']) {
    const r = await waehle(E, t);
    pruefe(`echter Besitzer: ${t} angenommen`, !r.fehler, JSON.stringify(r));
    pruefe(`echter Besitzer: der Gegner sieht ${t}`, await titelBeiGegner('ed') === t);
  }
}
{
  const rechte = (await db.query(`select p.proname, p.prosecdef as sd, p.proconfig as cfg,
      has_function_privilege('authenticated', p.oid, 'execute') as auth, has_function_privilege('anon', p.oid, 'execute') as anon
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('karte_titel_belegt', 'karte_waehle', 'karte_von')`)).rows;
  const r = Object.fromEntries(rechte.map((x) => [x.proname, x]));
  pruefe('Rechte: karte_waehle nur authenticated, karte_von und karte_titel_belegt fuer niemanden',
    r.karte_waehle?.auth === true && r.karte_waehle?.anon === false && r.karte_von?.auth === false && r.karte_von?.anon === false
    && r.karte_titel_belegt?.auth === false && r.karte_titel_belegt?.anon === false, JSON.stringify(rechte));
  pruefe('alle drei security definer mit leerem search_path', rechte.length === 3
    && rechte.every((x) => x.sd === true && (x.cfg || []).includes('search_path=""')), JSON.stringify(rechte));
}
f = await lauf(db, 'karte-titel-zurueck.sql', ZURUECK);
pruefe('Rueckweg laeuft', !f, f);
f = await lauf(db, 'karte-titel-zurueck.sql (2.)', ZURUECK);
pruefe('Rueckweg ist wiederholbar', !f, f);
{
  const weg = (await db.query(`select count(*)::int as n from pg_proc where proname = 'karte_titel_belegt'`)).rows[0].n;
  pruefe('nach dem Rueckweg: karte_titel_belegt weg', weg === 0, weg);
  pruefe('nach dem Rueckweg: alte Regel (erfolg-ewige-flamme ohne Stufe 3 wieder angenommen)', !(await waehle(C, 'erfolg-ewige-flamme')).fehler);
  pruefe('nach dem Rueckweg: Rahmen-Beleg von #274 bleibt (serie-100 ohne Stufe 3 abgelehnt)',
    /KARTE_PROFIL/.test((await als(C, `select public.karte_waehle('start', null, null, 'Q', 'standard', 'serie-100') as r`)).fehler || ''));
  const a = (await db.query(`select has_function_privilege('authenticated', 'public.karte_waehle(text, text, text[], text, text, text)', 'execute') as a`)).rows[0].a;
  pruefe('nach dem Rueckweg: karte_waehle weiter fuer authenticated', a === true);
}
console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
