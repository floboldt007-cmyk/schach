// Zwei Ligen (G-005, Punkt 38), Server-Seite: fuehrt die bisherigen Schemas, dann supabase/zwei-ligen-schema.sql und
// supabase/zwei-ligen-rls-test.sql WIRKLICH aus, in PGlite (Postgres als WebAssembly, ohne Netz, ohne Supabase).
// Dazu der Wechsel mitten in einer Woche (eigene Datenbank): schon gebuchte Duell-Kronen bleiben in der Online-Liga,
// die Raetsel-Liga beginnt mit der naechsten Buchung, kein doppelter Wochenpreis. Danach der Rueckweg und erneutes
// Einspielen. Laeuft im CI-Job "sql" wie tests/server-kronen.test.mjs; lokal nur mit PGlite in node_modules
// (npm install --no-save --ignore-scripts @electric-sql/pglite@0.5.11).
//   node tests/server-zwei-ligen.test.mjs
//
// WICHTIG: Die Auth-Attrappe bildet Supabase nur naeherungsweise nach (wie in server-kronen.test.mjs). Ein gruener Lauf
// ersetzt NICHT den einmaligen Lauf von zwei-ligen-rls-test.sql im Supabase SQL Editor vor dem Einspielen.
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

// Reihenfolge wie in Supabase: Grundschema, Online, Kronen, Raetsel-Duell (+ Daten), Karte, Liga-Bild, Daten-Auskunft
const BISHER = ['supabase/schema.sql', 'supabase/online-schema.sql', 'supabase/kronen-schema.sql',
  'supabase/raetsel-duell-schema.sql', 'supabase/raetsel-duell-daten.sql', 'supabase/karte-schema.sql',
  'supabase/liga-bild-schema.sql', 'supabase/daten-schema.sql'];
// alte Pruefungen, die nach den zwei Ligen unveraendert gelten muessen (Abwaertsvertraeglichkeit)
const ALT_TESTS = ['supabase/karte-rls-test.sql', 'supabase/liga-bild-rls-test.sql'];   // daten-rls-test: tests/server-daten.test.mjs

async function neueDb() {
  const db = new PGlite();
  const f = await lauf(db, 'Attrappe', ATTRAPPE);
  if (f) throw new Error(f);
  for (const d of BISHER) {
    const x = await lauf(db, d, lies(d));
    if (x) throw new Error(x);
  }
  return db;
}
const zahl = async (db, sql) => Number(Object.values((await db.query(sql)).rows[0])[0]);

// ---------- Teil 1: Wechsel mitten in der Woche ----------
{
  const db = await neueDb();
  pruefe('bisherige Schemas laufen (Wechsel-Datenbank)', true);
  const A = 'f6000000-0000-4000-8000-000000000006';
  await db.exec(`insert into auth.users (id, email) values ('${A}', 'wechsel@example.invalid');`);
  // vor dem Einspielen: ein Duell-Sieg und ein Bot-Sieg landen im einen Topf (30 + 15)
  await db.exec(`select public.kronen_einfach_buchen('${A}', 'duell', 'vorher-duell', 'sieg');
                 select public.kronen_einfach_buchen('${A}', 'bot', 'vorher-bot', 'sieg');`);
  pruefe('vorher: ein Topf mit 45 Kronen', await zahl(db, `select kronen from public.liga_mitglieder where user_id = '${A}'`) === 45);

  let f = await lauf(db, 'zwei-ligen-schema.sql', lies('supabase/zwei-ligen-schema.sql'));
  pruefe('zwei-ligen-schema.sql laeuft auf bestehenden Daten', f === null, f);
  f = await lauf(db, 'zwei-ligen-schema.sql (zweites Mal)', lies('supabase/zwei-ligen-schema.sql'));
  pruefe('zwei-ligen-schema.sql ist wiederholbar', f === null, f);

  pruefe('Wechsel: die laufende Woche bleibt Online mit 45 Kronen, keine Raetsel-Gruppe',
    await zahl(db, `select count(*) from public.liga_mitglieder where user_id = '${A}' and liga = 'online' and kronen = 45`) === 1
    && await zahl(db, `select count(*) from public.liga_mitglieder where user_id = '${A}' and liga = 'raetsel'`) === 0
    && await zahl(db, `select count(*) from public.raetsel_stand where user_id = '${A}'`) === 0);
  await db.exec(`select public.kronen_einfach_buchen('${A}', 'duell', 'nachher-duell', 'sieg');`);
  pruefe('Wechsel: die naechste Duell-Buchung beginnt die Raetsel-Liga mit 30, Online bleibt 45',
    await zahl(db, `select kronen from public.liga_mitglieder where user_id = '${A}' and liga = 'raetsel'`) === 30
    && await zahl(db, `select kronen from public.liga_mitglieder where user_id = '${A}' and liga = 'online'`) === 45
    && await zahl(db, `select kronen from public.kronen_stand where user_id = '${A}'`) === 45
    && await zahl(db, `select kronen from public.raetsel_stand where user_id = '${A}'`) === 30);
  pruefe('Wechsel: nichts doppelt gezaehlt (Online 45 + Raetsel 30 = 75)',
    await zahl(db, `select coalesce(sum(m.kronen), 0) from public.liga_mitglieder m where m.user_id = '${A}'`) === 75);
  // Wochenende: beide Gruppen in die Vorwoche, A klar vorne (die Bots einer Gruppe haben bis zu 150 Kronen), abrechnen (zweimal)
  await db.exec(`update public.liga_gruppen set woche = woche - 7;
                 update public.liga_mitglieder set woche = woche - 7, kronen = kronen + 1000;
                 select public.liga_abrechnen(); select public.liga_abrechnen();`);
  const preise = (await db.query(`select liga, count(*)::int as n from public.liga_belohnungen
    where user_id = '${A}' and art in ('banner', 'taler') group by liga order by liga`)).rows;
  pruefe('Wechsel: genau ein Wochenpreis je Liga, kein doppelter', JSON.stringify(preise) === '[{"liga":"online","n":1},{"liga":"raetsel","n":1}]',
    JSON.stringify(preise));
  pruefe('Wechsel: beide Gruppen abgerechnet, A steigt in beiden Ligen je eine Stufe auf',
    await zahl(db, `select count(*) from public.liga_gruppen where not abgerechnet`) === 0
    && await zahl(db, `select stufe from public.kronen_stand where user_id = '${A}'`) === 1
    && await zahl(db, `select stufe from public.raetsel_stand where user_id = '${A}'`) === 1);
  await db.close();
}

// ---------- Teil 1b: Deckel 60 fuer Bot- und KI-Kronen (Flos Wahl R13-K1, 10.11.2026) ----------
// Gewinne gegen Bot und KI bringen je Woche und Liga hoechstens 60 Kronen (etwa drei KI-Siege); Menschen-Partien frei.
{
  const db = await neueDb();
  const f0 = await lauf(db, 'zwei-ligen-schema.sql', lies('supabase/zwei-ligen-schema.sql'));
  pruefe('Deckel: zwei-ligen-schema.sql laeuft', f0 === null, f0);
  const B = 'f7000000-0000-4000-8000-000000000007';
  await db.exec(`insert into auth.users (id, email) values ('${B}', 'deckel@example.invalid');`);
  pruefe('Deckel: Konstante bot_ki_wochen_max ist 60',
    await zahl(db, `select (public.kronen_konstanten() ->> 'bot_ki_wochen_max')::int`) === 60);
  const buche = async (art, ref) => (await db.query(
    `select public.kronen_einfach_buchen('${B}', '${art}', '${ref}', 'sieg') as r`)).rows[0].r;
  const k1 = await buche('ki', 'deckel-ki-1');
  const k2 = await buche('ki', 'deckel-ki-2');
  const b1 = await buche('bot', 'deckel-bot-1');
  pruefe('Deckel: unter 60 zaehlt jeder Sieg voll (20 + 20 + 15)',
    k1.delta === 20 && k2.delta === 20 && b1.delta === 15 && !b1.bot_ki_voll, JSON.stringify([k1, k2, b1]));
  const k3 = await buche('ki', 'deckel-ki-3');
  pruefe('Deckel: der KI-Sieg bringt nur den Rest bis 60 (5 statt 20)', k3.delta === 5 && k3.bot_ki_voll === true,
    JSON.stringify(k3));
  const b2 = await buche('bot', 'deckel-bot-2');
  pruefe('Deckel: die 61. Bot-/KI-Krone zaehlt nicht', b2.delta === 0 && b2.bot_ki_voll === true, JSON.stringify(b2));
  await db.exec(`select public.kronen_online_buchen('${B}', 'f7000000-0000-4000-8000-0000000000a1', 1, 1000);
                 select public.kronen_online_buchen('${B}', 'f7000000-0000-4000-8000-0000000000a2', 1, 1000);`);
  pruefe('Deckel: Siege gegen Menschen zaehlen weiter voll (60 + 30 + 30 = 120 Wochen-Kronen Online)',
    await zahl(db, `select kronen from public.liga_mitglieder where user_id = '${B}' and liga = 'online'`) === 120);
  const d1 = await buche('duell_ki', 'deckel-duell-ki-1');
  pruefe('Deckel: die Raetsel-Liga hat ihren eigenen Deckel (KI-Duell 20)', d1.delta === 20 && !d1.bot_ki_voll,
    JSON.stringify(d1));
  await db.query(`select set_config('request.jwt.claims', '{"sub":"${B}","role":"authenticated"}', false)`);
  const bk = (await db.query(`select public.liga_gruppe('online') as g`)).rows[0].g?.bot_ki;
  pruefe('Deckel: die Liga-Ansicht meldet genutzt 60 von max 60', bk?.max === 60 && bk?.genutzt === 60, JSON.stringify(bk));
  await db.close();
}

// ---------- Teil 2: Pruefungen, Abwaertsvertraeglichkeit, Rueckweg ----------
const db = await neueDb();
pruefe('bisherige Schemas laufen', true);
let f = await lauf(db, 'zwei-ligen-schema.sql', lies('supabase/zwei-ligen-schema.sql'));
pruefe('zwei-ligen-schema.sql laeuft', f === null, f);
f = await lauf(db, 'zwei-ligen-rls-test.sql', lies('supabase/zwei-ligen-rls-test.sql'));
pruefe('zwei-ligen-rls-test.sql laeuft ohne FEHLER', f === null, f);
if (f !== null) await lauf(db, 'Aufraeumen nach Fehler', 'rollback;');
pruefe('RLS-Test hat alles zurueckgerollt', await zahl(db, 'select count(*) from auth.users') === 0);
for (const t of ALT_TESTS) {
  f = await lauf(db, t, lies(t));
  pruefe(`${t} laeuft nach den zwei Ligen weiter`, f === null, f);
  if (f !== null) await lauf(db, 'Aufraeumen nach Fehler', 'rollback;');
}

// liga-bild-schema.sql danach erneut eingespielt: die alte Gruppe zeigt weiter nur die Online-Liga
f = await lauf(db, 'liga-bild-schema.sql (nach den zwei Ligen)', lies('supabase/liga-bild-schema.sql'));
pruefe('liga-bild-schema.sql laeuft nach den zwei Ligen', f === null, f);
f = await lauf(db, 'Probe liga-bild Filter', `
begin;
insert into auth.users (id, email) values ('a7000000-0000-4000-8000-000000000007', 'bild@example.invalid');
select public.kronen_einfach_buchen('a7000000-0000-4000-8000-000000000007', 'duell', 'bild-duell', 'sieg');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a7000000-0000-4000-8000-000000000007","role":"authenticated"}', true);
do $$ begin
  if public.liga_meine_gruppe()->>'gruppe' is not null then
    raise exception 'FEHLER: liga_meine_gruppe (liga-bild) zeigt die Raetsel-Gruppe';
  end if;
end $$;
rollback;`);
pruefe('liga-bild nach den zwei Ligen: liga_meine_gruppe bleibt Online', f === null, f);
if (f !== null) await lauf(db, 'Aufraeumen nach Fehler', 'rollback;');
f = await lauf(db, 'zwei-ligen-schema.sql (nach liga-bild)', lies('supabase/zwei-ligen-schema.sql'));
pruefe('zwei-ligen-schema.sql laeuft nach liga-bild wieder', f === null, f);

// Gegenprobe: ein fehlschlagender Abschnitt muss den Lauf wirklich rot machen
f = await lauf(db, 'Probe', "begin; do $$ begin raise exception 'FEHLER: Probe'; end; $$; rollback;");
pruefe('ein FEHLER im SQL wird erkannt', f !== null && f.includes('FEHLER: Probe'), f);
await lauf(db, 'Aufraeumen nach Probe', 'rollback;');

// Rueckweg: weg, die alten Dateien neu einspielen, deren Pruefungen laufen wieder; danach erneut hin
f = await lauf(db, 'zwei-ligen-zurueck.sql', lies('supabase/zwei-ligen-zurueck.sql'));
pruefe('zwei-ligen-zurueck.sql laeuft', f === null, f);
f = await lauf(db, 'zwei-ligen-zurueck.sql (zweites Mal)', lies('supabase/zwei-ligen-zurueck.sql'));
pruefe('zwei-ligen-zurueck.sql ist wiederholbar', f === null, f);
for (const d of ['supabase/kronen-schema.sql', 'supabase/raetsel-duell-schema.sql', 'supabase/liga-bild-schema.sql',
  'supabase/daten-schema.sql']) {
  f = await lauf(db, d + ' (nach Rueckweg)', lies(d));
  pruefe(`${d} laeuft nach dem Rueckweg`, f === null, f);
}
const u = (await db.query(`select
    (select count(*)::int from pg_tables where schemaname = 'public' and tablename = 'raetsel_stand') as tabelle,
    (select count(*)::int from information_schema.columns where table_schema = 'public' and column_name = 'liga'
       and table_name in ('liga_gruppen', 'liga_mitglieder', 'liga_belohnungen')) as spalten,
    (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname in ('liga_stand', 'liga_staende', 'liga_gruppe', 'liga_buchen_in',
         'raetsel_stand_sichern')) as funktionen`)).rows[0];
pruefe('nach dem Rueckweg keine Raetsel-Tabelle, Spalte oder neue Funktion', u.tabelle === 0 && u.spalten === 0 && u.funktionen === 0,
  JSON.stringify(u));
// kronen-rls-test.sql nicht: er erwartet nicht ausgezahlte Banner, mit karte-schema.sql zahlt die Abrechnung sie sofort aus
// (er laeuft ohne Karte in tests/server-kronen.test.mjs)
for (const t of ['supabase/raetsel-duell-rls-test.sql', ...ALT_TESTS]) {
  f = await lauf(db, t + ' (nach Rueckweg)', lies(t));
  pruefe(`${t} laeuft nach dem Rueckweg`, f === null, f);
  if (f !== null) await lauf(db, 'Aufraeumen nach Fehler', 'rollback;');
}
f = await lauf(db, 'zwei-ligen-schema.sql (nach Rueckweg)', lies('supabase/zwei-ligen-schema.sql'));
pruefe('zwei-ligen-schema.sql laeuft nach dem Rueckweg wieder', f === null, f);
f = await lauf(db, 'zwei-ligen-rls-test.sql (nach Rueckweg)', lies('supabase/zwei-ligen-rls-test.sql'));
pruefe('zwei-ligen-rls-test.sql laeuft nach dem Rueckweg wieder', f === null, f);

await db.close();
console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
