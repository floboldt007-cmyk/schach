// Namensfilter, Server-Seite (supabase/namen-filter-schema.sql, T-012, noch nicht eingespielt): fuehrt schema.sql, den
// Vorschlag und namen-filter-rls-test.sql WIRKLICH aus, in PGlite (ohne Netz, ohne Supabase), und vergleicht den Filter
// des Servers mit dem der App (js/namen.js): dieselbe Liste, dasselbe Ergebnis je Probename. Dazu die Trigger-Reihenfolge
// mit der Monats-Sperre (benutzername-sperre-schema.sql) und dem Haken (benutzername-bestaetigt-schema.sql): ein
// abgelehnter Name verbraucht die Frist nicht. Vorlage: tests/server-melden.test.mjs aus PR #204.
// Lokal nur mit PGlite in node_modules (npm install --no-save --ignore-scripts @electric-sql/pglite@0.5.11).
//   node tests/server-namen-filter.test.mjs
// WICHTIG: Die Auth-Attrappe bildet Supabase nur naeherungsweise nach. Ein gruener Lauf hier ersetzt NICHT den einmaligen
// Lauf von namen-filter-rls-test.sql im Supabase SQL Editor vor dem Einspielen.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { NAMEN_REGELN, nameGesperrt, nameLesarten } from '../js/namen.js';

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
const C = 'f3000000-0000-4000-8000-0000000000c3';
const ALS = (uid) => `select set_config('request.jwt.claims', '{"sub":"${uid}","role":"authenticated"}', false); set role authenticated;`;
const BESITZER = `reset role; select set_config('request.jwt.claims', '', false);`;
// wie PostgREST bei POST /rest/v1/profile mit Prefer resolution=merge-duplicates
const UPSERT = (uid, name) => `insert into public.profile (user_id, benutzername) values ('${uid}', '${name}')
  on conflict (user_id) do update set benutzername = excluded.benutzername;`;
async function versuch(db, sql) {
  try { await db.exec(sql); return null; } catch (e) { return e; }
}
async function zeile(db, uid, spalten = 'benutzername') {
  await db.exec(BESITZER);
  return (await db.query(`select ${spalten} from public.profile where user_id = '${uid}'`)).rows[0] || null;
}
async function neueDb(...dateien) {
  const db = new PGlite();
  let f = await versuch(db, ATTRAPPE);
  for (const d of ['supabase/schema.sql', ...dateien]) f = f || await versuch(db, lies(d));
  if (f) throw f;
  await db.exec(`insert into auth.users (id, email) values ('${A}', 'a@x'), ('${B}', 'b@x'), ('${C}', 'c@x');`);
  return db;
}

// ---------- Gegenprobe: ohne den Vorschlag ist der Befund da ----------
let db = await neueDb();
let f = await versuch(db, ALS(A) + UPSERT(A, 'Admin'));
pruefe('Gegenprobe: ohne namen-filter-schema.sql nimmt der Server "Admin" an (der Befund)', !f, f?.message);
f = await versuch(db, BESITZER + lies('supabase/namen-filter-rls-test.sql'));
pruefe('Gegenprobe: ohne namen-filter-schema.sql ist der RLS-Test rot', !!f, 'kein Fehler');
await versuch(db, 'rollback;');

// ---------- Einspielen ----------
db = await neueDb();
f = await versuch(db, lies('supabase/namen-filter-schema.sql')) || await versuch(db, lies('supabase/namen-filter-schema.sql'));
pruefe('namen-filter-schema.sql spielt ein, auch zweimal (wiederholbar)', !f, f?.message);
f = await versuch(db, lies('supabase/namen-filter-rls-test.sql'));
pruefe('namen-filter-rls-test.sql laeuft ohne FEHLER (nur schema.sql + Filter)', !f, f?.message);
if (f) await versuch(db, 'rollback;');
const rest = await db.query('select (select count(*)::int from auth.users) as nutzer, (select count(*)::int from public.profile) as profile');
pruefe('RLS-Test hat alles zurueckgerollt', rest.rows[0].nutzer === 3 && rest.rows[0].profile === 0, JSON.stringify(rest.rows));

// ---------- Trigger als Nutzer ----------
f = await versuch(db, ALS(A) + UPSERT(A, 'Adm1n'));
pruefe('Anlegen mit "Adm1n": NAME_UNZULAESSIG (P0001), hint reserviert', f?.message === 'NAME_UNZULAESSIG' && f.code === 'P0001'
  && f.hint === 'reserviert', f ? `${f.code} ${f.message} ${f.hint}` : 'kein Fehler');
f = await versuch(db, ALS(A) + UPSERT(A, 'xX_H1tl3r_Xx'));
pruefe('Anlegen mit "xX_H1tl3r_Xx": hint anstoessig', f?.message === 'NAME_UNZULAESSIG' && f.hint === 'anstoessig', f ? `${f.message} ${f.hint}` : 'kein Fehler');
pruefe('Kennung ist NICHT NAME_GESPERRT (das ist die Monats-Sperre, js/konto.js liest dort detail als Datum)',
  !/'NAME_GESPERRT'/.test(lies('supabase/namen-filter-schema.sql').replace(/^--.*$/gm, '')));
f = await versuch(db, ALS(A) + UPSERT(A, 'Scunthorpe') + UPSERT(A, 'Scunthorpe') + `update public.profile set benutzername = 'Badminton' where user_id = '${A}';`);
pruefe('Harmlose Namen gehen (Anlegen, gleich erneut sichern, Aendern)', !f && (await zeile(db, A)).benutzername === 'Badminton', f?.message);
f = await versuch(db, ALS(A) + `update public.profile set benutzername = 'Supp0rt_Team' where user_id = '${A}';`);
pruefe('Direktes UPDATE an der App vorbei ist ebenso gesperrt, der Name bleibt', f?.message === 'NAME_UNZULAESSIG'
  && (await zeile(db, A)).benutzername === 'Badminton', f?.message || 'kein Fehler');
// Besitzer (SQL Editor) und security definer (wie verwaltung_name): frei
f = await versuch(db, BESITZER + `update public.profile set benutzername = 'Crownmate' where user_id = '${A}';`);
pruefe('Besitzer (SQL Editor) darf einen reservierten Namen setzen', !f && (await zeile(db, A)).benutzername === 'Crownmate', f?.message);
await db.exec(BESITZER + `create function public.test_verwaltung_name(ziel uuid, n text) returns void language plpgsql security definer
  set search_path = '' as $$ begin update public.profile set benutzername = n where user_id = ziel; end; $$;`);
f = await versuch(db, ALS(B) + UPSERT(B, 'b_start') + `select public.test_verwaltung_name('${B}', 'Support');`);
pruefe('security definer (wie verwaltung_name) ist frei', !f && (await zeile(db, B)).benutzername === 'Support', f?.message);
f = await versuch(db, ALS(A) + UPSERT(A, 'crownmate'));
pruefe('Bestehender Name bleibt beim erneuten Sichern (nur Gross/Klein anders)', !f && (await zeile(db, A)).benutzername === 'crownmate', f?.message);
f = await versuch(db, ALS(A) + `update public.profile set benutzername = 'CROWNMATE' where user_id = '${A}';`);
pruefe('... auch als UPDATE', !f, f?.message);

// ---------- Rechte ----------
const offen = await db.query(`select p.proname, has_function_privilege('authenticated', p.oid, 'execute') as auth,
  has_function_privilege('anon', p.oid, 'execute') as anon, p.prosecdef, p.proconfig from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
  and p.proname in ('namen_regeln', 'name_lesarten', 'name_gesperrt', 'profile_name_pruefen') order by 1`);
pruefe('vier Funktionen da, alle mit festem search_path, keine security definer', offen.rows.length === 4
  && offen.rows.every((r) => !r.prosecdef && (r.proconfig || []).some((c) => /^search_path=("")?$/.test(c))), JSON.stringify(offen.rows));
pruefe('authenticated darf genau die drei Rechenfunktionen, anon keine', offen.rows.filter((r) => r.auth).map((r) => r.proname).join()
  === 'name_gesperrt,name_lesarten,namen_regeln' && offen.rows.every((r) => !r.anon), JSON.stringify(offen.rows));

// ---------- Vertrag mit js/namen.js ----------
const regeln = (await db.query('select public.namen_regeln() as r')).rows[0].r;
const schluessel = (o) => Object.keys(o).sort().join();
pruefe('Sperrliste: namen_regeln() und NAMEN_REGELN (js/namen.js) sind gleich', schluessel(regeln) === schluessel(NAMEN_REGELN)
  && Object.keys(regeln).every((k) => JSON.stringify(regeln[k]) === JSON.stringify(NAMEN_REGELN[k])),
  Object.keys(NAMEN_REGELN).filter((k) => JSON.stringify(regeln[k]) !== JSON.stringify(NAMEN_REGELN[k])).join());
const woerter = Object.entries(NAMEN_REGELN).filter(([k]) => k !== 'ausnahme_anfang').flatMap(([, v]) => v);
pruefe('Sperrliste: jedes Wort klein und nur a-z (sonst griffe die Normalisierung nicht)', woerter.every((w) => /^[a-z]{3,}$/.test(w)),
  woerter.filter((w) => !/^[a-z]{3,}$/.test(w)).join());
pruefe('Sperrliste bleibt kurz (hoechstens 100 Woerter)', woerter.length <= 100, woerter.length);
const ausSql = [...lies('supabase/namen-filter-rls-test.sql').matchAll(/'([A-Za-z0-9_]{3,20})'/g)].map((m) => m[1]);
const PROBEN = [...new Set([...ausSql, 'admin', 'Adm1n', 'adm_in99', 'Badmin', 'Admins', 'Supporter', 'Support3r', 'supportive', 'MySupport',
  'Crownmat', 'Crownmates', 'mod3rator', 'Moderat', 'teams', 'Team_Team', 'TeamOfficial', 'official_', 'Bot_Bot', 'Bott', 'You', 'Youyou',
  'N1663r', 'Neger', 'Negev', 'Kanaken', 'Nutte', 'Nutter', 'Nutten', 'Slut', 'Sluts', 'Slutty', 'Nazis', 'Nazish', 'neonazi_x', 'Penis',
  'Penistone', 'xPenis', 'Hurek', 'Schure', 'Wixer', 'Twixer', 'Porno', 'Fickdich', 'Benfica', 'Retardo', 'whore_x', 'Vagina', 'Paedo',
  'B4st4rd', 'Bastian', 'T1tten', 'Tittmann', 'f_u_c_k', 'fu1ck', 'Fvck', 'Behindert', 'xX_H1tl3r_Xx', 'A55hole', 'Arschl0ch'])];
const sqlErgebnis = await db.query('select n, public.name_gesperrt(n) as g, public.name_lesarten(n) as l from unnest($1::text[]) n', [PROBEN]);
const anders = sqlErgebnis.rows.filter((r) => r.g !== nameGesperrt(r.n) || JSON.stringify(r.l) !== JSON.stringify(nameLesarten(r.n)));
pruefe(`Filter: Server und App urteilen ueber ${PROBEN.length} Probenamen gleich (auch die Lesarten)`, PROBEN.length > 120 && anders.length === 0,
  anders.map((r) => `${r.n}: sql=${r.g} js=${nameGesperrt(r.n)}`).join('; '));
const erwartet = { Hassan: null, Dickens: null, Analyst: null, Scunthorpe: null, Badminton: null, Supporter: null, Nazish: null, Nutter: null,
  Penistone: null, Schure: null, Penis: 'anstoessig', HitIer_no: 'anstoessig', '0ff1c14l': 'reserviert', Bastian: null, Benfica: null,
  Negev: null, Twixer: 'anstoessig', Wixer: 'anstoessig', Admin: 'reserviert', Adm1n: 'reserviert', Badmin: 'reserviert',
  MySupport: 'reserviert', Crownmates: 'reserviert', TeamOfficial: 'reserviert', Team_Team: 'reserviert', teams: null, N1663r: null,
  fu1ck: 'anstoessig', Fvck: null, xX_H1tl3r_Xx: 'anstoessig', A55hole: 'anstoessig', Arschl0ch: 'anstoessig', Slutty: null };
const falsch = Object.entries(erwartet).filter(([n, g]) => nameGesperrt(n) !== g);
pruefe('Filter: feste Erwartungen (harmlos frei, Sperrnamen gesperrt, bekannte Grenzen benannt)', falsch.length === 0,
  falsch.map(([n, g]) => `${n}: erwartet ${g}, ist ${nameGesperrt(n)}`).join('; '));

// ---------- Trigger-Reihenfolge mit Monats-Sperre und Haken ----------
db = await neueDb('supabase/benutzername-sperre-schema.sql', 'supabase/benutzername-bestaetigt-schema.sql', 'supabase/namen-filter-schema.sql');
const trig = (await db.query(`select tgname from pg_trigger where tgrelid = 'public.profile'::regclass and not tgisinternal order by tgname`)).rows.map((r) => r.tgname);
pruefe('Trigger auf profile: profile_name_pruefen steht alphabetisch vor profile_name_sperre (feuert zuerst)',
  trig.indexOf('profile_name_pruefen') >= 0 && trig.indexOf('profile_name_pruefen') < trig.indexOf('profile_name_sperre'), trig.join());
const frist = async (uid) => { const r = await zeile(db, uid, 'name_geaendert_am'); return r && r.name_geaendert_am ? new Date(r.name_geaendert_am).getTime() : null; };
f = await versuch(db, ALS(C) + UPSERT(C, 'c_start'));
const fristAnlegen = await frist(C);
pruefe('C legt einen harmlosen Namen an (mit Haken-SQL setzt das erste Setzen die Frist)', !f && fristAnlegen !== null, f?.message);
f = await versuch(db, ALS(C) + UPSERT(C, 'Hurensohn_1'));
let z = await zeile(db, C, 'benutzername');
pruefe('Gesperrter Name waehrend der Frist: NAME_UNZULAESSIG (Filter zuerst), Name und Frist unveraendert', f?.message === 'NAME_UNZULAESSIG'
  && z.benutzername === 'c_start' && await frist(C) === fristAnlegen, (f?.message || 'kein Fehler') + ' ' + JSON.stringify(z));
// wie nach 30 Tagen: der Besitzer hebt die Frist auf; ein abgelehnter Name darf die naechste Aenderung nicht verbrauchen
await db.exec(BESITZER + `update public.profile set name_geaendert_am = null where user_id = '${C}';`);
f = await versuch(db, ALS(C) + UPSERT(C, 'Admin_C1'));
pruefe('Frist frei, gesperrter Name abgelehnt: die Frist bleibt frei (kein Verbrauch)', f?.message === 'NAME_UNZULAESSIG' && await frist(C) === null,
  f?.message || 'kein Fehler');
f = await versuch(db, ALS(C) + UPSERT(C, 'c_zweit'));
z = await zeile(db, C, 'benutzername, name_geaendert_am');
pruefe('Danach geht die erste echte Aenderung und setzt erst jetzt die Frist', !f && z.benutzername === 'c_zweit' && z.name_geaendert_am !== null, f?.message || JSON.stringify(z));
f = await versuch(db, ALS(C) + UPSERT(C, 'Admin_C'));
pruefe('Waehrend der Frist meldet ein gesperrter Name den Filter (feuert zuerst), nicht die Monats-Sperre', f?.message === 'NAME_UNZULAESSIG', f?.message || 'kein Fehler');
f = await versuch(db, ALS(C) + UPSERT(C, 'c_dritt'));
pruefe('... und ein harmloser die Monats-Sperre (unveraendert)', f?.message === 'NAME_GESPERRT', f?.message || 'kein Fehler');
// Gegenprobe zur Reihenfolge: auch wenn der Filter NACH der Sperre liefe, bricht die Anweisung ab und die Frist bleibt
await db.exec(BESITZER + `alter trigger profile_name_pruefen on public.profile rename to profile_name_zzz_pruefen;`);
f = await versuch(db, ALS(B) + UPSERT(B, 'b_start'));
await db.exec(BESITZER + `update public.profile set name_geaendert_am = null where user_id = '${B}';`);
f = f || await versuch(db, ALS(B) + UPSERT(B, 'Fotze_B'));
z = await zeile(db, B, 'benutzername');
pruefe('Gegenprobe: Filter hinter die Sperre umbenannt, die Frist bleibt trotzdem frei (Abbruch der ganzen Anweisung)',
  f?.message === 'NAME_UNZULAESSIG' && z.benutzername === 'b_start' && await frist(B) === null, (f?.message || 'kein Fehler') + ' ' + JSON.stringify(z));
await db.exec(BESITZER + `alter trigger profile_name_zzz_pruefen on public.profile rename to profile_name_pruefen;`);
f = await versuch(db, lies('supabase/namen-filter-rls-test.sql'));
pruefe('namen-filter-rls-test.sql laeuft auch mit Monats-Sperre und Haken ohne FEHLER', !f, f?.message);
if (f) await versuch(db, 'rollback;');

// ---------- Gegenproben fuer den RLS-Test ----------
await db.exec(BESITZER + 'alter table public.profile disable trigger profile_name_pruefen;');
f = await versuch(db, lies('supabase/namen-filter-rls-test.sql'));
pruefe('Gegenprobe: ohne den Trigger meldet der RLS-Test "gesperrter Name ... angelegt"', /FEHLER: gesperrter Name Admin angelegt/.test(f?.message || ''), f?.message || 'kein Fehler');
await versuch(db, 'rollback;');
await db.exec(BESITZER + 'alter table public.profile enable trigger profile_name_pruefen;');
f = await versuch(db, "begin; do $$ begin raise exception 'FEHLER: Probe'; end; $$; rollback;");
pruefe('ein FEHLER im SQL wird erkannt', f && /FEHLER: Probe/.test(f.message), f?.message);
await versuch(db, 'rollback;');

// ---------- Rueckweg ----------
f = await versuch(db, BESITZER + lies('supabase/namen-filter-zurueck.sql')) || await versuch(db, lies('supabase/namen-filter-zurueck.sql'));
const weg = await db.query(`select (select count(*)::int from pg_trigger where tgname = 'profile_name_pruefen') as t,
  (select count(*)::int from pg_proc where proname in ('namen_regeln', 'name_lesarten', 'name_gesperrt', 'profile_name_pruefen')) as p`);
pruefe('Rueckweg laeuft (zweimal), Trigger und Funktionen sind weg', !f && weg.rows[0].t === 0 && weg.rows[0].p === 0, f?.message || JSON.stringify(weg.rows));
const vorher = (await db.query('select count(*)::int as n from public.profile')).rows[0].n;
await db.exec(BESITZER + `update public.profile set name_geaendert_am = null where user_id = '${C}';`);
f = await versuch(db, ALS(C) + UPSERT(C, 'Admin_C'));
pruefe('Nach dem Rueckweg nimmt der Server den Namen wieder an, Profile bleiben', !f && vorher >= 2, f?.message);
f = await versuch(db, BESITZER + lies('supabase/namen-filter-schema.sql'));
pruefe('Danach laesst sich der Filter wieder einspielen', !f, f?.message);

console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
