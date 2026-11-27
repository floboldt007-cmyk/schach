// Obergrenze der Wochenwertung (supabase/freunde-grenze-schema.sql, T-012, noch nicht eingespielt): fuehrt schema.sql,
// freunde-schema.sql und den Vorschlag WIRKLICH aus, in PGlite (ohne Netz, ohne Supabase). Gegenprobe ohne den
// Vorschlag (50.001 je Partie geht durch), Grenze genau bei 50.000, Rechte, Reihenfolge mit freunde-schema.sql, Rueckweg.
// Die Zahl ist an die Punkte-Formel gebunden: das rechnerische Maximum je Partie wird hier aus js/pakete/punkte/formel.js
// selbst gerechnet (nicht abgeschrieben), damit eine Formel-Aenderung diesen Test rot macht.
// Lokal nur mit PGlite in node_modules (npm install --no-save --ignore-scripts @electric-sql/pglite@0.5.11).
//   node tests/server-freunde-grenze.test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { STAND, tafelwert } from '../js/pakete/punkte/formel.js';

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
async function versuch(db, sql) {
  try { await db.exec(sql); return null; } catch (e) { return e; }
}
// freund_diese_woche ist nur intern (kein Recht fuer authenticated): die Woche holt der Besitzer vorher
async function melde(db, uid, punkte, partien) {
  await db.exec(BESITZER);
  const woche = (await db.query('select public.freund_diese_woche()::text as w')).rows[0].w;
  await db.exec(ALS(uid));
  let r;
  try { r = await db.query('select public.wochenpunkte_melden($1::date, $2, $3) as e', [woche, punkte, partien]); }
  catch (x) { await db.exec(BESITZER); return 'fehler:' + x.code; }
  await db.exec(BESITZER);
  return r.rows[0].e?.ergebnis;
}
async function stand(db, uid) {
  await db.exec(BESITZER);
  return (await db.query(`select punkte, partien from public.wochenpunkte where user_id = '${uid}'`)).rows[0] || null;
}

// ---------- die Zahl gegen die Formel ----------
const buch = Array.from({ length: 8 }, () => ({ klasse: 'buch', gewinnVorher: 0.5, gewinnNachher: 0.5 }));
const vorlauf = Array.from({ length: 12 }, () => ({ klasse: 'brillant', gewinnVorher: 0.05, gewinnNachher: 0.05 }));
const offen = (k) => Array.from({ length: 40 }, () => ({ klasse: k, gewinnVorher: 0.5, gewinnNachher: 0.5 }));
const maxGenial = tafelwert({ zuege: [...buch, ...vorlauf, ...offen('brillant')], ergebnis: 'sieg', uhrAnteil: 1 }).wert;
const maxPraezise = tafelwert({ zuege: [...buch, ...vorlauf, ...offen('bester')], ergebnis: 'sieg', uhrAnteil: 1 }).wert;
pruefe(`Formel Rechenstand ${STAND}: rechnerisches Maximum je Partie 154.800 (40 x Genial, volle COMBO), 40 x Praezise 70.800`,
  STAND === 1 && maxGenial === 154800 && maxPraezise === 70800, JSON.stringify({ STAND, maxGenial, maxPraezise }));
const bots = JSON.parse(lies('daten/punkte/bot-laeufe.json'));
const werte = [];
JSON.stringify(bots, (k, v) => { if ((k === 'wert' || k === 'w') && typeof v === 'number') werte.push(v); return v; });
pruefe(`Bot-Laeufe im Repo (${werte.length} Partien) bleiben unter der Grenze (hoechstens ${Math.max(...werte)})`,
  werte.length >= 10 && Math.max(...werte) < 50000, JSON.stringify(werte));

// ---------- Gegenprobe: heute (nur freunde-schema.sql) ----------
const db = new PGlite();
let f = await versuch(db, ATTRAPPE) || await versuch(db, lies('supabase/schema.sql')) || await versuch(db, lies('supabase/freunde-schema.sql'));
pruefe('Attrappe, schema.sql und freunde-schema.sql laufen', !f, f?.message);
await db.exec(`insert into auth.users (id, email) values ('${A}', 'a@x'), ('${B}', 'b@x');`);
let e = await melde(db, A, 50001, 1);
pruefe('Gegenprobe: ohne freunde-grenze-schema.sql nimmt der Server 50.001 Punkte aus EINER Partie an (der Befund)', e === 'ok', e);
e = await melde(db, A, 100001, 1);
pruefe('... und erst 100.001 nicht (heutige Grenze)', e === 'werte', e);

// ---------- Einspielen ----------
f = await versuch(db, lies('supabase/freunde-grenze-schema.sql')) || await versuch(db, lies('supabase/freunde-grenze-schema.sql'));
pruefe('freunde-grenze-schema.sql spielt ein, auch zweimal (wiederholbar)', !f, f?.message);
e = await melde(db, B, 50001, 1);
pruefe('Mit Grenze: 50.001 aus einer Partie wird abgelehnt (werte), nichts gespeichert', e === 'werte' && (await stand(db, B)) === null, e);
e = await melde(db, B, 50000, 1);
pruefe('Genau 50.000 aus einer Partie geht', e === 'ok' && (await stand(db, B))?.punkte === 50000, e);
e = await melde(db, B, 150000, 3);
pruefe('3 Partien: bis 150.000 geht (Grenze je Partie)', e === 'ok' && (await stand(db, B))?.punkte === 150000, e);
e = await melde(db, B, 150001, 3);
pruefe('3 Partien: 150.001 abgelehnt, der Stand bleibt (sinkt nie)', e === 'werte' && (await stand(db, B))?.punkte === 150000, e);
e = await melde(db, B, 1000 * 50000, 1000);
pruefe('1000 Partien voll ausgeschoepft: kein Ueberlauf (50 Mio. passt in integer)', e === 'ok', e);
e = await melde(db, B, 0, 1001);
pruefe('weiter hoechstens 1000 Partien', e === 'werte', e);
e = await melde(db, A, 50000, 1);
pruefe('Ein Stand von vorher (A: 50.001) bleibt stehen, eine kleinere Meldung senkt ihn nicht', e === 'ok' && (await stand(db, A))?.punkte === 50001, e);

// ---------- Rechte ----------
const r = (await db.query(`select p.proname, has_function_privilege('authenticated', p.oid, 'execute') as auth,
  has_function_privilege('anon', p.oid, 'execute') as anon, p.prosecdef, p.proconfig from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
  and p.proname in ('wochenpunkte_je_partie_max', 'wochenpunkte_melden') order by 1`)).rows;
pruefe('wochenpunkte_je_partie_max nur intern (weder anon noch authenticated), fester search_path',
  r.find((x) => x.proname === 'wochenpunkte_je_partie_max' && !x.auth && !x.anon && (x.proconfig || []).some((c) => /^search_path=("")?$/.test(c))) !== undefined,
  JSON.stringify(r));
pruefe('wochenpunkte_melden bleibt security definer, nur authenticated', r.find((x) => x.proname === 'wochenpunkte_melden' && x.prosecdef && x.auth && !x.anon) !== undefined,
  JSON.stringify(r));
f = await versuch(db, ALS(A) + 'select public.wochenpunkte_je_partie_max();');
pruefe('authenticated kann die Hilfsfunktion nicht direkt aufrufen', f?.code === '42501', f ? f.code : 'kein Fehler');
await db.exec(BESITZER);
f = await versuch(db, 'set role anon; select public.wochenpunkte_melden(current_date, 1, 1);');
pruefe('anon kann nicht melden', f?.code === '42501', f ? f.code : 'kein Fehler');
await db.exec(BESITZER);

// ---------- Reihenfolge: freunde-schema.sql erneut ueberschreibt die Grenze (in der Datei benannt) ----------
f = await versuch(db, lies('supabase/freunde-schema.sql'));
e = f ? null : await melde(db, B, 999999, 10);
pruefe('freunde-schema.sql erneut eingespielt: es gelten wieder 100.000 je Partie (darum danach die Grenze erneut einspielen)', e === 'ok', f?.message || e);
pruefe('der Hinweis darauf steht in freunde-grenze-schema.sql', /erneut einspielt, spielt\s*\n?--\s*danach diese Datei noch einmal ein/.test(lies('supabase/freunde-grenze-schema.sql')));
f = await versuch(db, lies('supabase/freunde-grenze-schema.sql'));
e = f ? null : await melde(db, A, 60001 * 1, 1);
pruefe('danach wieder eingespielt: die Grenze gilt wieder', e === 'werte', f?.message || e);

// ---------- Rueckweg ----------
const vorher = (await db.query('select count(*)::int as n from public.wochenpunkte')).rows[0].n;
f = await versuch(db, lies('supabase/freunde-grenze-zurueck.sql')) || await versuch(db, lies('supabase/freunde-grenze-zurueck.sql'));
const weg = (await db.query(`select count(*)::int as n from pg_proc where proname = 'wochenpunkte_je_partie_max'`)).rows[0].n;
pruefe('Rueckweg laeuft (zweimal), die Hilfsfunktion ist weg, keine Wochenpunkte verloren', !f && weg === 0
  && (await db.query('select count(*)::int as n from public.wochenpunkte')).rows[0].n === vorher, f?.message);
e = await melde(db, A, 99999, 1);
pruefe('Nach dem Rueckweg gelten wieder 100.000 je Partie (Stand freunde-schema.sql)', e === 'ok', e);
const rueck = (await db.query(`select pg_get_functiondef('public.wochenpunkte_melden(date, integer, integer)'::regprocedure) as d`)).rows[0].d;
const quelle = lies('supabase/freunde-schema.sql');
const original = quelle.slice(quelle.indexOf('create or replace function public.wochenpunkte_melden('));
const kern = (t) => (t.match(/begin\s+if uid is null[\s\S]*?return jsonb_build_object\('ergebnis', 'ok'\);\s*end;/) || [''])[0].replace(/\s+/g, ' ');
pruefe('Rueckweg-Funktion ist wortgleich mit freunde-schema.sql (kein Abdriften)', kern(rueck) !== '' && kern(rueck) === kern(original));
f = await versuch(db, lies('supabase/freunde-grenze-schema.sql'));
pruefe('Danach laesst sich die Grenze wieder einspielen', !f, f?.message);

console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
