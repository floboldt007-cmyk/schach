// Namensfilter und Melden, Server-Seite: fuehrt supabase/schema.sql (Profil), supabase/online-schema.sql,
// supabase/melden-schema.sql und supabase/melden-rls-test.sql WIRKLICH aus, in PGlite (Postgres als WebAssembly, ohne
// Netz, ohne Supabase), und vergleicht den Filter des Servers mit dem der App (js/namen.js): dieselbe Liste, dasselbe
// Ergebnis je Probename. Laeuft im CI-Job "sql" (.github/workflows/tests.yml); lokal nur, wenn PGlite im Arbeitsbaum
// liegt (npm install --no-save --ignore-scripts @electric-sql/pglite@0.5.11).
//   node tests/server-melden.test.mjs
//
// WICHTIG: Die Auth-Attrappe bildet Supabase nur naeherungsweise nach (wie in tests/server-karte.test.mjs). Ein gruener
// Lauf hier ersetzt NICHT den einmaligen Lauf von melden-rls-test.sql im Supabase SQL Editor vor dem Einspielen.
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

const db = new PGlite();
pruefe('Auth-Attrappe angelegt', (await lauf(db, 'Attrappe', ATTRAPPE)) === null);
for (const d of ['supabase/schema.sql', 'supabase/online-schema.sql']) {
  const f = await lauf(db, d, lies(d));
  pruefe(d + ' laeuft (Grundlage)', f === null, f);
}

// Gegenprobe vorab: OHNE melden-schema.sql ist der Befund aus dem Audit da ("Admin" geht als Name durch) und der
// RLS-Test rot
let f = await lauf(db, 'Befund', `
  insert into auth.users (id, email) values ('99999999-9999-4999-8999-999999999999', 'befund@example.invalid');
  insert into public.profile (user_id, benutzername) values ('99999999-9999-4999-8999-999999999999', 'Admin');
  delete from auth.users where id = '99999999-9999-4999-8999-999999999999';`);
pruefe('Gegenprobe: ohne melden-schema.sql nimmt der Server den Namen "Admin" an (der Befund)', f === null, f);
f = await lauf(db, 'melden-rls-test.sql (ohne Schema)', lies('supabase/melden-rls-test.sql'));
pruefe('Gegenprobe: ohne melden-schema.sql ist melden-rls-test.sql rot', f !== null, f);
await lauf(db, 'Aufraeumen nach Gegenprobe', 'rollback;');

f = await lauf(db, 'melden-schema.sql', lies('supabase/melden-schema.sql'));
pruefe('melden-schema.sql laeuft', f === null, f);
f = await lauf(db, 'melden-schema.sql (zweites Mal)', lies('supabase/melden-schema.sql'));
pruefe('melden-schema.sql ist wiederholbar', f === null, f);
f = await lauf(db, 'melden-rls-test.sql', lies('supabase/melden-rls-test.sql'));
pruefe('melden-rls-test.sql laeuft ohne FEHLER', f === null, f);
if (f) await lauf(db, 'Aufraeumen nach Fehler', 'rollback;');

let rest = await db.query('select (select count(*)::int from auth.users) as nutzer, (select count(*)::int from public.meldungen) as meldungen');
pruefe('RLS-Test hat alles zurueckgerollt', rest.rows[0].nutzer === 0 && rest.rows[0].meldungen === 0, JSON.stringify(rest.rows));

// ---------- Rechte ----------
const rls = await db.query(`select relrowsecurity from pg_class where oid = 'public.meldungen'::regclass`);
pruefe('RLS an meldungen', rls.rows[0].relrowsecurity === true);
const policies = await db.query(`select count(*)::int as n from pg_policies where schemaname = 'public' and tablename = 'meldungen'`);
pruefe('meldungen hat keine Policy', policies.rows[0].n === 0);
const tabRecht = await db.query(`select r, p from unnest(array['anon', 'authenticated']) r, unnest(array['select', 'insert', 'update', 'delete']) p
  where has_table_privilege(r, 'public.meldungen', p)`);
pruefe('anon und authenticated haben kein Tabellenrecht an meldungen', tabRecht.rows.length === 0, JSON.stringify(tabRecht.rows));
const NAMEN = `('namen_regeln', 'name_lesarten', 'name_gesperrt', 'profile_name_pruefen', 'melden_konstanten', 'melden_tag', 'melde_stand', 'melde_spieler')`;
const offen = await db.query(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname in ${NAMEN} and has_function_privilege('authenticated', p.oid, 'execute') order by 1`);
pruefe('authenticated darf genau melde_spieler und melde_stand', offen.rows.map((r) => r.proname).join() === 'melde_spieler,melde_stand',
  JSON.stringify(offen.rows));
const anon = await db.query(`select count(*)::int as n from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname in ${NAMEN} and has_function_privilege('anon', p.oid, 'execute')`);
pruefe('anon darf keine der Funktionen', anon.rows[0].n === 0, JSON.stringify(anon.rows));
const sicher = await db.query(`select p.proname, p.prosecdef, p.proconfig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname in ${NAMEN}`);
pruefe('alle acht Funktionen mit festem search_path', sicher.rows.length === 8
  && sicher.rows.every((r) => (r.proconfig || []).some((c) => /^search_path=("")?$/.test(c))), JSON.stringify(sicher.rows));

// ---------- Vertrag mit js/namen.js und js/ui/melden.js ----------
const regeln = (await db.query('select public.namen_regeln() as r')).rows[0].r;
pruefe('Sperrliste: namen_regeln() und NAMEN_REGELN (js/namen.js) sind gleich', JSON.stringify(regeln, Object.keys(regeln).sort())
  === JSON.stringify(NAMEN_REGELN, Object.keys(NAMEN_REGELN).sort())
  && Object.keys(regeln).every((k) => JSON.stringify(regeln[k]) === JSON.stringify(NAMEN_REGELN[k])),
  Object.keys(regeln).filter((k) => JSON.stringify(regeln[k]) !== JSON.stringify(NAMEN_REGELN[k])).join());
const woerter = Object.entries(NAMEN_REGELN).filter(([k]) => k !== 'ausnahme_anfang').flatMap(([, v]) => v);
pruefe('Sperrliste: jedes Wort klein und nur a-z (sonst griffe die Normalisierung nicht)', woerter.every((w) => /^[a-z]{3,}$/.test(w)),
  woerter.filter((w) => !/^[a-z]{3,}$/.test(w)).join());
pruefe('Sperrliste bleibt kurz (hoechstens 100 Woerter)', woerter.length <= 100, woerter.length);

// Probenamen: die aus melden-rls-test.sql (alle Namen in den drei array[...]-Listen des Filter-Abschnitts) und weitere
const ausSql = [...lies('supabase/melden-rls-test.sql').split('-- Der Trigger, als angemeldeter Nutzer A')[0].matchAll(/'([A-Za-z0-9_]{3,20})'/g)].map((m) => m[1]);
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
  Penistone: null, Schure: null, Penis: 'anstoessig', HitIer_no: 'anstoessig', '0ff1c14l': 'reserviert', Bastian: null, Benfica: null, Negev: null, Twixer: 'anstoessig', Wixer: 'anstoessig', Admin: 'reserviert', Adm1n: 'reserviert',
  Badmin: 'reserviert', MySupport: 'reserviert', Crownmates: 'reserviert', TeamOfficial: 'reserviert', Team_Team: 'reserviert', teams: null,
  N1663r: null, fu1ck: 'anstoessig', Fvck: null, xX_H1tl3r_Xx: 'anstoessig', A55hole: 'anstoessig', Arschl0ch: 'anstoessig', Slutty: null };
const falsch = Object.entries(erwartet).filter(([n, g]) => nameGesperrt(n) !== g);
pruefe('Filter: feste Erwartungen (harmlos frei, Sperrnamen gesperrt, bekannte Grenzen benannt)', falsch.length === 0,
  falsch.map(([n, g]) => `${n}: erwartet ${g}, ist ${nameGesperrt(n)}`).join('; '));

const melden = lies('js/ui/melden.js');
const k = (await db.query('select public.melden_konstanten() as k')).rows[0].k;
const gruendeJs = (melden.match(/MELDE_GRUENDE = Object\.freeze\(\[([^\]]+)\]/) || [])[1]?.replace(/['\s]/g, '').split(',') || [];
const notizJs = Number((melden.match(/NOTIZ_MAX = (\d+)/) || [])[1]);
pruefe('Melden: Gruende und Textlaenge in js/ui/melden.js wie melden_konstanten()', JSON.stringify(gruendeJs) === JSON.stringify(k.gruende)
  && notizJs === k.notiz_max && k.max_je_tag === 5 && k.monate === 12, JSON.stringify({ gruendeJs, notizJs, k }));
pruefe('Melden: jeder Grund hat einen deutschen und einen englischen Text', k.gruende.every((g) => (melden.match(new RegExp(`'grund\\.${g}':`, 'g')) || []).length === 2));

// Gegenprobe: ein fehlschlagender Abschnitt muss den Lauf wirklich rot machen
f = await lauf(db, 'Probe', "begin; do $$ begin raise exception 'FEHLER: Probe'; end; $$; rollback;");
pruefe('ein FEHLER im SQL wird erkannt', f !== null && f.includes('FEHLER: Probe'), f);
await lauf(db, 'Aufraeumen nach Probe', 'rollback;');
// Gegenprobe: ohne den Trigger (nur er fehlt) ist der RLS-Test rot, und zwar am gesperrten Namen
await lauf(db, 'Trigger weg', 'alter table public.profile disable trigger profile_name_pruefen;');
f = await lauf(db, 'melden-rls-test.sql (ohne Trigger)', lies('supabase/melden-rls-test.sql'));
pruefe('Gegenprobe: ohne den Trigger meldet der RLS-Test "gesperrter Name ... angelegt"', f !== null && /FEHLER: gesperrter Name Admin angelegt/.test(f), f);
await lauf(db, 'Aufraeumen', 'rollback; alter table public.profile enable trigger profile_name_pruefen;');
// Gegenprobe: mit einer Lese-Policy (ein denkbarer Fehler) ist der RLS-Test rot
await lauf(db, 'Policy', `grant select on public.meldungen to authenticated;
  create policy "probe" on public.meldungen for select to authenticated using (gemeldet = auth.uid());`);
f = await lauf(db, 'melden-rls-test.sql (mit Lese-Policy)', lies('supabase/melden-rls-test.sql'));
pruefe('Gegenprobe: duerfte der Gemeldete lesen, waere der RLS-Test rot', f !== null && /FEHLER: der (Meldende|Gemeldete) liest/.test(f), f);
await lauf(db, 'Aufraeumen', 'rollback; drop policy "probe" on public.meldungen; revoke select on public.meldungen from authenticated;');
// Gegenprobe: ohne Tagesgrenze (hier: auf 99 gestellt) ist der RLS-Test rot
await lauf(db, 'Grenze weg', lies('supabase/melden-schema.sql').match(/create or replace function public\.melden_konstanten\(\)[\s\S]*?\$\$;/)[0]
  .replace("'max_je_tag', 5", "'max_je_tag', 99"));
f = await lauf(db, 'melden-rls-test.sql (ohne Tagesgrenze)', lies('supabase/melden-rls-test.sql'));
pruefe('Gegenprobe: ohne Tagesgrenze ist der RLS-Test rot', f !== null && /FEHLER/.test(f), f);
await lauf(db, 'Aufraeumen', 'rollback;');

// ---------- Rueckweg ----------
f = await lauf(db, 'melden-zurueck.sql', lies('supabase/melden-zurueck.sql'));
pruefe('melden-zurueck.sql laeuft', f === null, f);
f = await lauf(db, 'melden-zurueck.sql (zweites Mal)', lies('supabase/melden-zurueck.sql'));
pruefe('melden-zurueck.sql ist wiederholbar', f === null, f);
const uebrig = await db.query(`select
    (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ${NAMEN}) as funktionen,
    (select count(*)::int from pg_tables where schemaname = 'public' and tablename = 'meldungen') as tabellen,
    (select count(*)::int from pg_trigger where tgname = 'profile_name_pruefen') as trigger,
    (select count(*)::int from pg_tables where schemaname = 'public' and tablename = 'profile') as profile`);
const u = uebrig.rows[0];
pruefe('nach dem Rueckweg: keine Funktion, keine Tabelle, kein Trigger; das Profil bleibt', u.funktionen === 0 && u.tabellen === 0 && u.trigger === 0
  && u.profile === 1, JSON.stringify(u));
f = await lauf(db, 'melden-schema.sql (nach Rueckweg)', lies('supabase/melden-schema.sql'));
pruefe('melden-schema.sql laeuft nach dem Rueckweg wieder', f === null, f);
f = await lauf(db, 'melden-rls-test.sql (nach Rueckweg)', lies('supabase/melden-rls-test.sql'));
pruefe('melden-rls-test.sql laeuft nach dem Rueckweg wieder', f === null, f);

// ohne online-schema.sql: Schema und RLS-Test laufen auch allein auf schema.sql (Abschnitt 4 wird uebersprungen)
const db2 = new PGlite();
await lauf(db2, 'Attrappe', ATTRAPPE);
await lauf(db2, 'schema.sql', lies('supabase/schema.sql'));
f = await lauf(db2, 'melden-schema.sql', lies('supabase/melden-schema.sql'));
pruefe('ohne online-schema.sql: melden-schema.sql laeuft', f === null, f);
f = await lauf(db2, 'melden-rls-test.sql', lies('supabase/melden-rls-test.sql'));
pruefe('ohne online-schema.sql: melden-rls-test.sql laeuft', f === null, f);
await db2.close();

await db.close();
console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
