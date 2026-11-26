// Abo, Server-Seite (R31, 26.11.2026): fuehrt supabase/schema.sql, supabase/abo-schema.sql (zweimal: ein erneuter Lauf
// ist erlaubt), supabase/abo-rls-test.sql, supabase/abo-beenden-schema.sql und supabase/abo-beenden-rls-test.sql
// WIRKLICH aus, in PGlite (Postgres als WebAssembly, ohne Netz, ohne Supabase). Laeuft im CI-Job "sql"
// (.github/workflows/tests.yml); lokal nur, wenn PGlite im Arbeitsbaum liegt (npm install --no-save --ignore-scripts)
// oder PGLITE_PFAD auf eine installierte Fassung zeigt.
//   node tests/server-abo-sql.test.mjs
//
// Anlass: Bis R31 fuehrte die CI die Abo-SQL nie aus (tests/server-abo.test.mjs prueft nur Text). Beim Sammeln von #203
// und #79 hat git abo-schema.sql und abo-rls-test.sql still zusammengefuehrt, und der RLS-Test brach danach ab.
//
// WICHTIG: Die Auth-Attrappe bildet Supabase nur naeherungsweise nach (wie in tests/server-karte.test.mjs). service_role
// bekommt bypassrls wie bei Supabase, sonst sieht ist_premium_von die Zeilen in abos nicht. Ein gruener Lauf hier
// ersetzt NICHT den einmaligen Lauf von abo-rls-test.sql und abo-beenden-rls-test.sql im Supabase SQL Editor.
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
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
  ({ PGlite } = await import(process.env.PGLITE_PFAD
    ? pathToFileURL(path.join(process.env.PGLITE_PFAD, 'dist', 'index.js')).href
    : '@electric-sql/pglite'));
} catch (e) {
  console.log('FEHLER PGlite fehlt (nur im CI-Job "sql" installiert): ' + e.message);
  process.exit(1);
}

const ATTRAPPE = `
create schema if not exists auth;
create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz, raw_user_meta_data jsonb);
create or replace function auth.uid() returns uuid language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid;
$$;
create or replace function auth.role() returns text language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role';
$$;
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
grant usage on schema public, auth to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`;

// Fuehrt SQL aus; liefert { fehler } oder { letzte } (erste Zeile des letzten Ergebnisses mit Zeilen, als JSON)
async function lauf(db, sql) {
  try {
    const r = await db.exec(sql);
    const mitZeilen = r.filter((x) => x.rows && x.rows.length).pop();
    return { letzte: mitZeilen ? JSON.stringify(mitZeilen.rows[0]) : '' };
  } catch (e) {
    // Ein abgebrochener RLS-Test laesst die Transaktion offen: zurueckrollen, damit die naechste Pruefung eigene Fehler meldet
    try { await db.exec('rollback;'); } catch (f) { /* keine offene Transaktion */ }
    return { fehler: e.message };
  }
}

const db = new PGlite();
pruefe('Auth-Attrappe angelegt', !(await lauf(db, ATTRAPPE)).fehler);
for (const d of ['supabase/schema.sql', 'supabase/abo-schema.sql']) {
  const r = await lauf(db, lies(d));
  pruefe(d + ' laeuft', !r.fehler, r.fehler);
}
{
  const r = await lauf(db, lies('supabase/abo-schema.sql'));
  pruefe('abo-schema.sql laeuft ein zweites Mal (erneutes Einspielen ist erlaubt)', !r.fehler, r.fehler);
}
{
  const r = await lauf(db, lies('supabase/abo-rls-test.sql'));
  pruefe('abo-rls-test.sql meldet "Abo-RLS-Test erfolgreich" (Kaper-Fall, Erstattung, Rueckbuchung, RLS)',
    !r.fehler && r.letzte.includes('Abo-RLS-Test erfolgreich'), r.fehler || r.letzte);
}
{
  const r = await lauf(db, lies('supabase/abo-beenden-schema.sql'));
  pruefe('abo-beenden-schema.sql laeuft (nach abo-schema.sql)', !r.fehler, r.fehler);
}
{
  const r = await lauf(db, lies('supabase/abo-beenden-rls-test.sql'));
  pruefe('abo-beenden-rls-test.sql meldet "Abo-Beenden-RLS-Test erfolgreich"',
    !r.fehler && r.letzte.includes('Abo-Beenden-RLS-Test erfolgreich'), r.fehler || r.letzte);
}
{
  // Kaper-Schutz auch im offenen Zahlungsstreit (R31, Hauptfenster 26.11.2026): PR #79 fuehrt den Status 'strittig' ein.
  // Ein fremder Kauf mit der Nutzer-ID eines Kontos im Streit darf dessen Zeile nicht uebernehmen, sonst faende ein
  // spaeter gewonnener Streit (charge.dispute.closed) einen fremden kunde_id vor.
  const r = await lauf(db, `
begin;
insert into auth.users (id, email) values ('e5555555-5555-4555-8555-555555555555', 'abo-e@example.invalid');
insert into public.abos (user_id, status, plan, gueltig_bis, quelle, kunde_id, abo_id, stand_zeit, status_vor_streit, gueltig_bis_vor_streit)
values ('e5555555-5555-4555-8555-555555555555', 'strittig', 'monat', now() + interval '20 days', 'stripe', 'cus_E1', 'sub_E1',
  now() - interval '1 hour', 'aktiv', now() + interval '20 days');
do $$
declare
  r text;
  a public.abos;
begin
  r := public.abo_stripe_ereignis('evt_s1', 'checkout.session.completed', now(), 'cus_FREMD1', 'sub_FREMD1',
    'e5555555-5555-4555-8555-555555555555', 'aktiv', now() + interval '1 day', null);
  select * into a from public.abos where user_id = 'e5555555-5555-4555-8555-555555555555';
  if r <> 'konflikt' or a.kunde_id <> 'cus_E1' or a.abo_id <> 'sub_E1' or a.status <> 'strittig'
    or a.status_vor_streit <> 'aktiv' or exists (select 1 from public.abos where kunde_id = 'cus_FREMD1') then
    raise exception 'FEHLER: fremder Kauf hat das Konto im Streit uebernommen (%, %)', r, row_to_json(a);
  end if;
end;
$$;
select 'Streit-Fall ok' as ergebnis;
rollback;`);
  pruefe('fremder Kauf mit der Nutzer-ID eines Kontos im offenen Streit (strittig) wird abgewiesen (konflikt, Zeile unberuehrt)',
    !r.fehler && r.letzte.includes('Streit-Fall ok'), r.fehler || r.letzte);
}
{
  // Streit schuetzt IMMER, auch wenn der Zeitraum im Streit abgelaufen ist (Kaltreview D, 26.11.2026): abo_wende_an friert
  // gueltig_bis waehrend des Streits ein. Hinge der Schutz an gueltig_bis > now(), uebernaehme ein fremder Kauf die Zeile,
  // und der spaeter gewonnene Streit kaeme nie an (wartet).
  const r = await lauf(db, `
begin;
insert into auth.users (id, email) values ('f6666666-6666-4666-8666-666666666666', 'abo-f@example.invalid');
insert into public.abos (user_id, status, plan, gueltig_bis, quelle, kunde_id, abo_id, stand_zeit, status_vor_streit, gueltig_bis_vor_streit)
values ('f6666666-6666-4666-8666-666666666666', 'strittig', 'monat', now() - interval '5 days', 'stripe', 'cus_F1', 'sub_F1',
  now() - interval '40 days', 'aktiv', now() + interval '25 days');
do $$
declare
  r text;
  a public.abos;
begin
  r := public.abo_stripe_ereignis('evt_s2', 'checkout.session.completed', now() - interval '2 seconds', 'cus_FREMD2', 'sub_FREMD2',
    'f6666666-6666-4666-8666-666666666666', 'aktiv', now() + interval '1 day', null);
  select * into a from public.abos where user_id = 'f6666666-6666-4666-8666-666666666666';
  if r <> 'konflikt' or a.kunde_id <> 'cus_F1' or a.abo_id <> 'sub_F1' or a.status <> 'strittig'
    or exists (select 1 from public.abos where kunde_id = 'cus_FREMD2') then
    raise exception 'FEHLER: fremder Kauf hat das Konto im abgelaufenen Streit uebernommen (%, %)', r, row_to_json(a);
  end if;
  r := public.abo_stripe_ereignis('evt_s3', 'charge.dispute.closed', now() - interval '1 second', 'cus_F1', 'sub_F1',
    null, 'wiederherstellen', now() - interval '1 second', null);
  select * into a from public.abos where user_id = 'f6666666-6666-4666-8666-666666666666';
  if r <> 'neu' or a.status <> 'aktiv' or a.kunde_id <> 'cus_F1' or a.gueltig_bis < now() + interval '24 days'
    or not public.ist_premium_von('f6666666-6666-4666-8666-666666666666') then
    raise exception 'FEHLER: gewonnener Streit hat das eigene Konto nicht wiederhergestellt (%, %)', r, row_to_json(a);
  end if;
end;
$$;
select 'Streit-abgelaufen-Fall ok' as ergebnis;
rollback;`);
  pruefe('Streit mit abgelaufenem Zeitraum: fremder Kauf -> konflikt, gewonnener Streit stellt das eigene Konto wieder her',
    !r.fehler && r.letzte.includes('Streit-abgelaufen-Fall ok'), r.fehler || r.letzte);
}
{
  // Die RLS-Tests rollen zurueck: Danach liegen keine Testzeilen in der Datenbank
  const r = await lauf(db, 'select (select count(*) from public.abos) as abos, (select count(*) from auth.users) as nutzer;');
  pruefe('nach den Tests keine Testzeilen uebrig (alles zurueckgerollt)', !r.fehler && r.letzte === '{"abos":0,"nutzer":0}', r.fehler || r.letzte);
}

console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
