// Monats-Sperre des Benutzernamens (supabase/benutzername-sperre-schema.sql, noch nicht eingespielt, R19 15.11.2026):
// fuehrt schema.sql und den Vorschlag WIRKLICH aus, in PGlite (ohne Netz, ohne Supabase). Erstes Setzen frei, danach
// hoechstens eine eigene Aenderung je 30 Tage (NAME_GESPERRT mit Datum), gleicher Name ist keine Aenderung, die Frist ist
// nicht faelschbar, Besitzer (Verwaltung, SQL Editor) bleibt frei, RLS bleibt, der Rueckweg nimmt alles heraus.
// Lokal nur mit PGlite in node_modules (npm install --no-save --ignore-scripts @electric-sql/pglite@0.5.11).
//   node tests/server-benutzername-sperre.test.mjs
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

const A = 'f1000000-0000-4000-8000-0000000000a1';
const B = 'f2000000-0000-4000-8000-0000000000b2';
const ALS = (uid) => `select set_config('request.jwt.claims', '{"sub":"${uid}","role":"authenticated"}', false); set role authenticated;`;
const BESITZER = `reset role; select set_config('request.jwt.claims', '', false);`;
// wie PostgREST bei POST /rest/v1/profile mit Prefer resolution=merge-duplicates
const UPSERT = (uid, name, extra = '') => `insert into public.profile (user_id, benutzername${extra ? ', name_geaendert_am' : ''})
  values ('${uid}', '${name}'${extra ? `, ${extra}` : ''})
  on conflict (user_id) do update set benutzername = excluded.benutzername${extra ? ', name_geaendert_am = excluded.name_geaendert_am' : ''};`;

async function versuch(db, sql) {
  try { await db.exec(sql); return null; } catch (e) { return e; }
}
async function zeile(db, uid) {
  await db.exec(BESITZER);
  const r = await db.query(`select benutzername, name_geaendert_am from public.profile where user_id = '${uid}'`);
  return r.rows[0] || null;
}

const db = new PGlite();
let f = await versuch(db, ATTRAPPE) || await versuch(db, lies('supabase/schema.sql'));
pruefe('Attrappe und schema.sql laufen', !f, f?.message);
await db.exec(`insert into auth.users (id, email) values ('${A}', 'a@x'), ('${B}', 'b@x');`);

// ohne die Sperre: Name beliebig oft aenderbar (Stand vor diesem Vorschlag)
f = await versuch(db, ALS(A) + UPSERT(A, 'vorher_eins') + UPSERT(A, 'vorher_zwei'));
pruefe('Ohne Sperre: zwei Aenderungen hintereinander gehen (heutiger Stand)', !f, f?.message);

await db.exec(BESITZER);
f = await versuch(db, lies('supabase/benutzername-sperre-schema.sql')) || await versuch(db, lies('supabase/benutzername-sperre-schema.sql'));
pruefe('Sperre spielt ein, auch zweimal (wiederholbar)', !f, f?.message);

// B: erstes Setzen frei, eine mitgeschickte Frist wird verworfen
f = await versuch(db, ALS(B) + UPSERT(B, 'b_erst', `'2000-01-01'::timestamptz`));
let z = await zeile(db, B);
pruefe('Erstes Setzen ist frei, eine mitgeschickte Frist zaehlt nicht', !f && z?.benutzername === 'b_erst' && z.name_geaendert_am === null, f?.message || JSON.stringify(z));

f = await versuch(db, ALS(B) + UPSERT(B, 'b_erst'));
z = await zeile(db, B);
pruefe('Gleicher Name erneut (Jetzt sichern) ist keine Aenderung', !f && z.name_geaendert_am === null, f?.message || JSON.stringify(z));

f = await versuch(db, ALS(B) + UPSERT(B, 'b_zweit'));
z = await zeile(db, B);
const am = z?.name_geaendert_am ? new Date(z.name_geaendert_am).getTime() : NaN;
pruefe('Erste Aenderung geht und setzt die Frist auf jetzt', !f && z.benutzername === 'b_zweit' && Math.abs(am - Date.now()) < 120000, f?.message || JSON.stringify(z));

f = await versuch(db, ALS(B) + UPSERT(B, 'b_dritt'));
z = await zeile(db, B);
const bis = f ? Date.parse(f.detail) : NaN;
pruefe('Zweite Aenderung innerhalb von 30 Tagen: NAME_GESPERRT (P0001), Name bleibt', f?.message === 'NAME_GESPERRT' && f.code === 'P0001'
  && z.benutzername === 'b_zweit', f ? `${f.code} ${f.message}` : 'kein Fehler');
pruefe('detail nennt den Zeitpunkt 30 Tage nach der Aenderung (ISO, UTC)', /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(f?.detail || '')
  && Math.abs(bis - (am + 30 * 86400000)) < 2000, f?.detail);

f = await versuch(db, ALS(B) + `update public.profile set benutzername = 'b_dritt' where user_id = '${B}';`);
pruefe('Auch ein direktes UPDATE (an der App vorbei) ist gesperrt', f?.message === 'NAME_GESPERRT', f?.message || 'kein Fehler');

f = await versuch(db, ALS(B) + UPSERT(B, 'b_zweit'));
pruefe('Gleicher Name waehrend der Sperre (Jetzt sichern) geht weiter', !f, f?.message);

f = await versuch(db, ALS(B) + `update public.profile set name_geaendert_am = '2000-01-01' where user_id = '${B}';`);
z = await zeile(db, B);
pruefe('Die Frist laesst sich nicht selbst zurueckdatieren', new Date(z.name_geaendert_am).getTime() === am, f?.message || JSON.stringify(z));

f = await versuch(db, ALS(B) + `update public.profile set benutzername = 'b_dritt', name_geaendert_am = '2000-01-01' where user_id = '${B}';`);
pruefe('Auch zusammen mit dem Namen nicht', f?.message === 'NAME_GESPERRT', f?.message || 'kein Fehler');

// Besitzer (SQL Editor) und security definer (wie verwaltung_name): frei, die Frist des Spielers bleibt
await db.exec(BESITZER);
f = await versuch(db, `update public.profile set benutzername = 'b_vom_admin' where user_id = '${B}';`);
z = await zeile(db, B);
pruefe('Besitzer aendert trotz Sperre, die Frist bleibt unveraendert', !f && z.benutzername === 'b_vom_admin' && new Date(z.name_geaendert_am).getTime() === am,
  f?.message || JSON.stringify(z));
await db.exec(`create function public.test_verwaltung_name(ziel uuid, n text) returns void language plpgsql security definer set search_path = ''
  as $$ begin update public.profile set benutzername = n where user_id = ziel; end; $$;`);
f = await versuch(db, ALS(A) + `select public.test_verwaltung_name('${B}', 'b_per_definer');`);
z = await zeile(db, B);
pruefe('security definer (wie verwaltung_name) ist frei', !f && z.benutzername === 'b_per_definer', f?.message || JSON.stringify(z));

// nach 30 Tagen wieder frei
await db.exec(BESITZER + `update public.profile set name_geaendert_am = now() - interval '30 days 1 minute' where user_id = '${B}';`);
f = await versuch(db, ALS(B) + UPSERT(B, 'b_nach_monat'));
z = await zeile(db, B);
pruefe('Nach 30 Tagen geht die naechste Aenderung, die Frist beginnt neu', !f && z.benutzername === 'b_nach_monat'
  && Math.abs(new Date(z.name_geaendert_am).getTime() - Date.now()) < 120000, f?.message || JSON.stringify(z));

// der Besitzer kann eine Sperre aufheben
f = await versuch(db, ALS(B) + UPSERT(B, 'b_zu_frueh'));
pruefe('Direkt nach der neuen Aenderung wieder gesperrt', f?.message === 'NAME_GESPERRT', f?.message || 'kein Fehler');
await db.exec(BESITZER + `update public.profile set name_geaendert_am = null where user_id = '${B}';`);
f = await versuch(db, ALS(B) + UPSERT(B, 'b_aufgehoben'));
pruefe('Nach dem Aufheben (Besitzer setzt null) ist die Aenderung frei', !f, f?.message);

// Kaltreview 3f 17.11.2026: Loeschen und neu Anlegen darf die Frist nicht zuruecksetzen (INSERT setzt null)
const vorLoeschen = (await zeile(db, B)).name_geaendert_am;
f = await versuch(db, ALS(B) + `delete from public.profile where user_id = '${B}';`);
pruefe('Das eigene Profil laesst sich nicht selbst loeschen (42501)', f?.code === '42501' && f.message === 'PROFIL_LOESCHEN_GESPERRT',
  f ? `${f.code} ${f.message}` : 'kein Fehler');
f = await versuch(db, ALS(B) + `delete from public.profile where user_id = '${B}';` + UPSERT(B, 'b_nach_loeschen'));
z = await zeile(db, B);
pruefe('Loeschen + neu Anlegen umgeht die Sperre nicht: Name und Frist bleiben', z?.benutzername === 'b_aufgehoben'
  && new Date(z.name_geaendert_am).getTime() === new Date(vorLoeschen).getTime(), f?.message || JSON.stringify(z));
f = await versuch(db, ALS(B) + UPSERT(B, 'b_nach_loeschen'));
pruefe('Danach bleibt die Aenderung gesperrt', f?.message === 'NAME_GESPERRT', f?.message || 'kein Fehler');
// auch nach erneutem Einspielen von schema.sql (vergibt delete an authenticated neu) bleibt das Loeschen gesperrt
await db.exec(BESITZER);
f = await versuch(db, lies('supabase/schema.sql'));
pruefe('schema.sql laeuft erneut durch (wiederholbar)', !f, f?.message);
f = await versuch(db, ALS(B) + `delete from public.profile where user_id = '${B}';`);
pruefe('Auch danach bleibt das eigene Loeschen gesperrt', f?.message === 'PROFIL_LOESCHEN_GESPERRT', f ? f.message : 'kein Fehler');

// RLS und Eindeutigkeit bleiben
f = await versuch(db, ALS(A) + `update public.profile set benutzername = 'fremd_name' where user_id = '${B}';`);
z = await zeile(db, B);
pruefe('A kann den Namen von B nicht aendern (RLS)', z.benutzername === 'b_aufgehoben', f?.message || JSON.stringify(z));
f = await versuch(db, ALS(A) + UPSERT(A, 'B_AUFGEHOBEN'));
pruefe('Eindeutig ohne Gross/Klein bleibt (23505)', f?.code === '23505', f ? f.code : 'kein Fehler');
// Konto loeschen (konto_loeschen, daten-schema.sql) laeuft als security definer und loescht profile weiter
await db.exec(BESITZER + `create function public.test_konto_loeschen() returns void language plpgsql security definer set search_path = ''
  as $$ begin delete from public.profile where user_id = auth.uid(); end; $$;`);
f = await versuch(db, ALS(A) + `select public.test_konto_loeschen();`);
pruefe('security definer (wie konto_loeschen) loescht das Profil weiter', !f && (await zeile(db, A)) === null, f?.message);

// Rueckweg
await db.exec(BESITZER);
f = await versuch(db, lies('supabase/benutzername-sperre-zurueck.sql')) || await versuch(db, lies('supabase/benutzername-sperre-zurueck.sql'));
const spalte = await db.query(`select 1 from information_schema.columns where table_name = 'profile' and column_name = 'name_geaendert_am'`);
const trig = await db.query(`select 1 from pg_trigger where tgname = 'profile_name_sperre'`);
pruefe('Rueckweg laeuft (zweimal), Spalte und Trigger sind weg', !f && spalte.rows.length === 0 && trig.rows.length === 0, f?.message);
f = await versuch(db, ALS(B) + UPSERT(B, 'b_frei_eins') + UPSERT(B, 'b_frei_zwei'));
pruefe('Nach dem Rueckweg ist der Name wieder frei aenderbar', !f, f?.message);
f = await versuch(db, ALS(B) + `delete from public.profile where user_id = '${B}';`);
await db.exec(BESITZER);
const nachLoeschen = (await db.query(`select count(*)::int as n from public.profile where user_id = '${B}'`)).rows[0].n;
pruefe('Nach dem Rueckweg darf das eigene Profil wieder geloescht werden (Stand schema.sql)', !f && nachLoeschen === 0, f?.message || nachLoeschen);
await db.exec(BESITZER);
f = await versuch(db, lies('supabase/benutzername-sperre-schema.sql'));
pruefe('Danach laesst sich die Sperre wieder einspielen', !f, f?.message);

// der RLS-Test fuer den SQL Editor laeuft auf einer frischen Datenbank durch (und rollt alles zurueck)
{
  const db2 = new PGlite();
  let g = await versuch(db2, ATTRAPPE) || await versuch(db2, lies('supabase/schema.sql'))
    || await versuch(db2, lies('supabase/benutzername-sperre-schema.sql'));
  g = g || await versuch(db2, lies('supabase/benutzername-sperre-rls-test.sql'));
  const rest = g ? null : await db2.query(`select count(*)::int as n from public.profile`);
  pruefe('supabase/benutzername-sperre-rls-test.sql laeuft gruen und hinterlaesst nichts', !g && rest.rows[0].n === 0, g?.message);
  // Gegenprobe: ohne die Sperre muss derselbe Test scheitern
  const db3 = new PGlite();
  await db3.exec(ATTRAPPE); await db3.exec(lies('supabase/schema.sql'));
  await db3.exec(`alter table public.profile add column name_geaendert_am timestamptz;`);
  g = await versuch(db3, lies('supabase/benutzername-sperre-rls-test.sql'));
  pruefe('Gegenprobe: ohne Trigger scheitert der RLS-Test mit FEHLER', /FEHLER/.test(g?.message || ''), g?.message || 'kein Fehler');
  // Gegenprobe zum Kaltreview 17.11.: Trigger ohne DELETE (Stand 2101314) -> der RLS-Test findet die Umgehung
  const db4 = new PGlite();
  await db4.exec(ATTRAPPE); await db4.exec(lies('supabase/schema.sql')); await db4.exec(lies('supabase/benutzername-sperre-schema.sql'));
  await db4.exec(`drop trigger profile_name_sperre on public.profile; create trigger profile_name_sperre before insert or update
    on public.profile for each row execute function public.profile_name_sperre();`);
  g = await versuch(db4, lies('supabase/benutzername-sperre-rls-test.sql'));
  pruefe('Gegenprobe: Trigger ohne DELETE -> RLS-Test meldet die Umgehung', /eigenes Profil liess sich loeschen/.test(g?.message || ''), g?.message || 'kein Fehler');
}

// das echte Konto-Loeschen (daten-schema.sql konto_loeschen, security definer) loescht profile trotz Loesch-Sperre
{
  const db5 = new PGlite();
  let g = await versuch(db5, ATTRAPPE) || await versuch(db5, lies('supabase/schema.sql'))
    || await versuch(db5, lies('supabase/benutzername-sperre-schema.sql')) || await versuch(db5, lies('supabase/daten-schema.sql'));
  pruefe('daten-schema.sql laeuft nach der Sperre', !g, g?.message);
  if (!g) {
    await db5.exec(`insert into auth.users (id, email) values ('${A}', 'a@x');`);
    g = await versuch(db5, ALS(A) + `insert into public.profile (user_id, benutzername) values ('${A}', 'anna_x');`)
      || await versuch(db5, ALS(A) + `select public.konto_loeschen();`);
    await db5.exec(BESITZER);
    const n = (await db5.query(`select (select count(*) from public.profile)::int as p, (select count(*) from auth.users)::int as u`)).rows[0];
    pruefe('konto_loeschen loescht Profil und Konto weiter', !g && n.p === 0 && n.u === 0, g?.message || JSON.stringify(n));
  }
}

console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
