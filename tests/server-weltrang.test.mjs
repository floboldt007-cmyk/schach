// Vorschlag Weltrangliste nach Online-Elo (supabase/weltrang-schema.sql, noch nicht eingespielt; G-006 AC-11): fuehrt die
// bisherigen Schemas und den Vorschlag WIRKLICH aus, in PGlite (ohne Netz, ohne Supabase). Flos Regeln (Grill-Runde):
// nur wer selbst zustimmt (Vorgabe aus), nur bestaetigte Elo ab 15 Online-Partien (elo_n), nur Konten mit Benutzername,
// ein Banner nur im Besitz (sonst 'start' wie karte_von). Dazu: anon und direkter Tabellenzugriff abgewiesen, Zustimmung
// zuruecknehmen wirkt sofort, Konto loeschen nimmt die Zeile mit, die Datenauskunft enthaelt die Zustimmung, die Ausgabe
// traegt genau Rang, Name, Banner, Elo und den eigenen Merker (keine Kennung, keine Mail), Probe und Rueckweg laufen.
// Lokal nur mit PGlite in node_modules (npm install --no-save --ignore-scripts @electric-sql/pglite@0.5.11).
//   node tests/server-weltrang.test.mjs
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

async function lauf(db, name, sql) {
  try {
    await db.exec(sql);
    return null;
  } catch (e) {
    return `${name}: ${e.message}`;
  }
}

const BISHER = ['supabase/schema.sql', 'supabase/abo-schema.sql', 'supabase/online-schema.sql', 'supabase/kronen-schema.sql',
  'supabase/raetsel-duell-schema.sql', 'supabase/raetsel-duell-daten.sql', 'supabase/karte-schema.sql',
  'supabase/liga-bild-schema.sql', 'supabase/zwei-ligen-schema.sql', 'supabase/daten-schema.sql'];

// Anna 1500/20 eigenes Banner, Bert 1600/15 fremdes Banner, Carl 1700/14 (zaehlt noch), Dora 1800/30 ohne Zustimmung,
// Emil 1900/40 ohne Benutzername, Fritz 1500/16 (gleiche Elo wie Anna, gleicher Rang)
const U = {
  anna: 'f1000000-0000-4000-8000-0000000000a1', bert: 'f2000000-0000-4000-8000-0000000000b2',
  carl: 'f3000000-0000-4000-8000-0000000000c3', dora: 'f4000000-0000-4000-8000-0000000000d4',
  emil: 'f5000000-0000-4000-8000-0000000000e5', fritz: 'f6000000-0000-4000-8000-0000000000f6',
};
const ALS = (uid) => `select set_config('request.jwt.claims', '${uid ? `{"sub":"${uid}","role":"authenticated"}` : '{"role":"authenticated"}'}', false);`;

const db = new PGlite();
let f = await lauf(db, 'Attrappe', ATTRAPPE);
for (const d of BISHER) f = f || await lauf(db, d, lies(d));
pruefe('bisherige Schemas laufen', !f, f);
const g = await lauf(db, 'weltrang-schema.sql', lies('supabase/weltrang-schema.sql'));
pruefe('weltrang-schema.sql laeuft', !g, g);
if (f || g) { console.log(`\n${ok}/${gesamt} bestanden`); process.exit(1); }
f = await lauf(db, 'daten-schema.sql (nach weltrang)', lies('supabase/daten-schema.sql'));
pruefe('daten-schema.sql laeuft danach noch einmal (Reihenfolge egal)', !f, f);

await db.exec(`
insert into auth.users (id, email) values ${Object.entries(U).map(([n, id]) => `('${id}', '${n}@x.invalid')`).join(', ')};
insert into public.profile (user_id, benutzername) values ('${U.anna}', 'anna'), ('${U.bert}', 'bert'), ('${U.carl}', 'carl'),
  ('${U.dora}', 'dora'), ('${U.fritz}', 'fritz');
insert into public.kronen_stand (user_id, elo, elo_n) values ('${U.anna}', 1500, 20), ('${U.bert}', 1600, 15), ('${U.carl}', 1700, 14),
  ('${U.dora}', 1800, 30), ('${U.emil}', 1900, 40), ('${U.fritz}', 1500, 16)
  on conflict (user_id) do update set elo = excluded.elo, elo_n = excluded.elo_n;
insert into public.banner_besitz (user_id, banner, quelle) values ('${U.anna}', 'saison-gold', 'liga');
insert into public.karte_wahl (user_id, banner) values ('${U.anna}', 'saison-gold'), ('${U.bert}', 'saison-gold')
  on conflict (user_id) do update set banner = excluded.banner;
`);

async function als(uid, sql) {
  await db.exec(ALS(uid) + 'set role authenticated;');
  try {
    return (await db.query(sql)).rows[0];
  } catch (e) {
    return { fehler: e.message };
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claims', '', false);`);
  }
}
const liste = async (uid, grenze) => (await als(uid, `select public.weltrang_liste(${grenze === undefined ? '' : grenze}) as l`))?.l;
const mitmachen = async (uid, an) => (await als(uid, `select public.weltrang_mitmachen(${an}) as m`))?.m;
const namen = (l) => (l?.liste || []).map((z) => z.name).join(',');

// ---------- Ohne Zustimmung erscheint niemand ----------
{
  const l = await liste(U.anna);
  pruefe('Vorgabe aus: ohne Zustimmung ist die Liste leer', Array.isArray(l?.liste) && l.liste.length === 0, JSON.stringify(l));
  pruefe('Vorgabe aus: eigener Stand "nicht_dabei", teilnahme false', l?.teilnahme === false && l?.ich?.status === 'nicht_dabei',
    JSON.stringify(l));
  pruefe('Grenze der Bestaetigung steht in der Antwort (ab 15)', l?.ab === 15, JSON.stringify(l));
}

// ---------- Zustimmung geben ----------
for (const n of ['anna', 'bert', 'carl', 'emil', 'fritz']) {
  const m = await mitmachen(U[n], true);
  pruefe(`${n} stimmt zu`, m && !m.fehler && m.teilnahme === true, JSON.stringify(m));
}
{
  const m = await mitmachen(U.anna, true);
  pruefe('zweite Zustimmung ist harmlos (wiederholbar)', m && !m.fehler && m.teilnahme === true, JSON.stringify(m));
}

{
  const l = await liste(U.anna);
  pruefe('nur bestaetigte Teilnehmer mit Namen, nach Elo: bert, anna, fritz', namen(l) === 'bert,anna,fritz', JSON.stringify(l));
  pruefe('elo_n 14 (carl) bleibt draussen, elo_n 15 (bert) kommt hinein', !namen(l).includes('carl') && namen(l).startsWith('bert'));
  pruefe('ohne Benutzername (emil) bleibt draussen, trotz hoechster Elo', l.liste.length === 3);
  pruefe('ohne Zustimmung (dora) bleibt draussen', !namen(l).includes('dora'));
  const [b, a, fr] = l.liste;
  pruefe('Rang 1, 2, 2: gleiche Elo teilt den Rang', b.rang === 1 && a.rang === 2 && fr.rang === 2, JSON.stringify(l.liste));
  pruefe('Elo kommt aus kronen_stand', b.elo === 1600 && a.elo === 1500 && fr.elo === 1500, JSON.stringify(l.liste));
  pruefe('eigenes Banner im Besitz wird gezeigt', a.banner === 'saison-gold', JSON.stringify(a));
  pruefe('Banner ohne Besitz zeigt das Start-Banner (wie karte_von)', b.banner === 'start', JSON.stringify(b));
  pruefe('ohne karte_wahl ebenfalls Start-Banner', fr.banner === 'start', JSON.stringify(fr));
  pruefe('eigene Zeile ist markiert, fremde nicht', a.ich === true && b.ich === false && fr.ich === false, JSON.stringify(l.liste));
  const felder = [...new Set(l.liste.flatMap((z) => Object.keys(z)))].sort().join(',');
  pruefe('je Zeile genau rang, name, banner, elo, ich', felder === 'banner,elo,ich,name,rang', felder);
  const text = JSON.stringify(l);
  pruefe('keine Kennung und keine Mail in der Antwort', !Object.values(U).some((id) => text.includes(id)) && !text.includes('@'), text);
  pruefe('eigener Stand: dabei, Rang 2, Elo 1500', l.ich?.status === 'dabei' && l.ich.rang === 2 && l.ich.elo === 1500, JSON.stringify(l.ich));
  const ichFelder = Object.keys(l.ich || {}).sort().join(',');
  pruefe('eigener Stand nur mit status, rang, elo, banner, name', ichFelder === 'banner,elo,name,rang,status', ichFelder);
}
{
  const l = await liste(U.carl);
  pruefe('carl (14 Partien): zaehlt noch, es fehlt 1 Partie', l?.teilnahme === true && l?.ich?.status === 'zaehlt_noch'
    && l.ich.fehlen === 1 && !('elo' in l.ich), JSON.stringify(l?.ich));
  pruefe('carl sieht dieselbe Liste', namen(l) === 'bert,anna,fritz' && l.liste.every((z) => z.ich === false), JSON.stringify(l));
}
{
  const l = await liste(U.emil);
  pruefe('emil ohne Benutzername: Stand "ohne_name"', l?.ich?.status === 'ohne_name' && !('elo' in l.ich), JSON.stringify(l?.ich));
}
{
  const l = await liste(U.dora);
  pruefe('dora ohne Zustimmung sieht die Liste, ist aber nicht dabei', namen(l) === 'bert,anna,fritz'
    && l.teilnahme === false && l.ich?.status === 'nicht_dabei' && !('elo' in l.ich), JSON.stringify(l));
}
{
  const l = await liste(U.fritz, 1);
  pruefe('Grenze 1: nur der Erste, eigene Zeile trotzdem mit Rang', l?.liste?.length === 1 && l.liste[0].name === 'bert'
    && l.ich?.rang === 2, JSON.stringify(l));
  const l0 = await liste(U.fritz, 0);
  pruefe('Grenze 0 wird auf 1 angehoben', l0?.liste?.length === 1, JSON.stringify(l0));
  const lr = await liste(U.fritz, 1000000);
  pruefe('riesige Grenze laeuft (Deckel serverseitig)', lr?.liste?.length === 3, JSON.stringify(lr));
  const ln = await liste(U.fritz, 'null');
  pruefe('Grenze null gilt als Vorgabe', ln?.liste?.length === 3, JSON.stringify(ln));
}

// ---------- Rechte ----------
{
  const r = await db.query(`select
    has_function_privilege('anon', 'public.weltrang_liste(integer)', 'execute') as anon_l,
    has_function_privilege('anon', 'public.weltrang_mitmachen(boolean)', 'execute') as anon_m,
    has_function_privilege('authenticated', 'public.weltrang_liste(integer)', 'execute') as auth_l,
    has_function_privilege('authenticated', 'public.weltrang_mitmachen(boolean)', 'execute') as auth_m`);
  const x = r.rows[0];
  pruefe('Rechte: anon nein, authenticated ja', !x.anon_l && !x.anon_m && x.auth_l && x.auth_m, JSON.stringify(x));
}
{
  let fehler = null;
  try { await db.exec('set role anon;'); await db.query('select public.weltrang_liste()'); } catch (e) { fehler = e.message; }
  finally { await db.exec('reset role;'); }
  pruefe('anon wird beim Aufruf abgewiesen', fehler !== null, fehler);
}
{
  const r = await als(U.anna, 'select count(*)::int as n from public.weltrang_teilnahme');
  pruefe('niemand liest die Tabelle direkt', !!r?.fehler, JSON.stringify(r));
  const w = await als(U.dora, `insert into public.weltrang_teilnahme (user_id) values ('${U.dora}') returning user_id`);
  pruefe('niemand schreibt die Tabelle direkt', !!w?.fehler, JSON.stringify(w));
  const d = await als(U.anna, `delete from public.weltrang_teilnahme where user_id = '${U.anna}' returning user_id`);
  pruefe('niemand loescht in der Tabelle direkt', !!d?.fehler, JSON.stringify(d));
}
{
  const r = await als(null, 'select public.weltrang_mitmachen(true) as m');
  pruefe('ohne Nutzerkennung (auth.uid() null) kein Eintrag', !!r?.fehler && /WELTRANG_OHNE_KONTO/.test(r.fehler), JSON.stringify(r));
  const l = await als(null, 'select public.weltrang_liste() as l');
  pruefe('ohne Nutzerkennung keine Liste', !!l?.fehler && /WELTRANG_OHNE_KONTO/.test(l.fehler), JSON.stringify(l));
}

// ---------- Datenauskunft ----------
{
  const r = await als(U.anna, 'select public.meine_daten() as d');
  const w = r?.d?.kronen?.weltrang;
  pruefe('Datenauskunft enthaelt die Zustimmung (seit)', w && w.teilnahme === true && typeof w.seit === 'string', JSON.stringify(r?.d?.kronen));
  const rd = await als(U.dora, 'select public.meine_daten() as d');
  pruefe('Datenauskunft ohne Zustimmung: teilnahme false', rd?.d?.kronen?.weltrang?.teilnahme === false, JSON.stringify(rd?.d?.kronen?.weltrang));
}

// ---------- Zuruecknehmen und Konto loeschen ----------
{
  const m = await mitmachen(U.anna, false);
  pruefe('anna nimmt die Zustimmung zurueck', m && !m.fehler && m.teilnahme === false, JSON.stringify(m));
  const l = await liste(U.bert);
  pruefe('anna ist sofort aus der Liste, fritz rueckt auf Rang 2', namen(l) === 'bert,fritz' && l.liste[1].rang === 2, JSON.stringify(l));
  const n = (await db.query(`select count(*)::int as n from public.weltrang_teilnahme where user_id = '${U.anna}'`)).rows[0].n;
  pruefe('zurueckgenommen heisst geloescht, nicht nur ausgeblendet', n === 0, n);
}
{
  await db.exec(`delete from auth.users where id = '${U.fritz}';`);
  const n = (await db.query(`select count(*)::int as n from public.weltrang_teilnahme where user_id = '${U.fritz}'`)).rows[0].n;
  pruefe('Konto loeschen entfernt die Zeile (on delete cascade)', n === 0, n);
  const l = await liste(U.bert);
  pruefe('danach nur noch bert', namen(l) === 'bert', JSON.stringify(l));
}

// ---------- Probe fuer den SQL-Editor, Rueckweg, wiederholbar ----------
{
  const x = await lauf(db, 'weltrang-rls-test.sql', lies('supabase/weltrang-rls-test.sql'));
  pruefe('weltrang-rls-test.sql laeuft fehlerfrei', !x, x);
  const n = (await db.query(`select count(*)::int as n from public.weltrang_teilnahme`)).rows[0].n;
  pruefe('die Probe rollt alles zurueck (nur bert und carl und emil bleiben)', n === 3, n);
}
{
  const x = await lauf(db, 'weltrang-schema.sql (zweites Mal)', lies('supabase/weltrang-schema.sql'));
  pruefe('weltrang-schema.sql ist wiederholbar und behaelt die Zustimmungen', !x
    && (await db.query('select count(*)::int as n from public.weltrang_teilnahme')).rows[0].n === 3, x);
}
{
  const x = await lauf(db, 'weltrang-zurueck.sql', lies('supabase/weltrang-zurueck.sql'));
  pruefe('Rueckweg laeuft', !x, x);
  const r = (await db.query(`select to_regclass('public.weltrang_teilnahme') is null as t,
    to_regprocedure('public.weltrang_liste(integer)') is null as l, to_regprocedure('public.weltrang_mitmachen(boolean)') is null as m`)).rows[0];
  pruefe('nach dem Rueckweg: Tabelle und Funktionen weg', r.t && r.l && r.m, JSON.stringify(r));
  const d = await als(U.bert, 'select public.meine_daten() as d');
  pruefe('Datenauskunft laeuft nach dem Rueckweg, ohne weltrang', d?.d?.kronen && !('weltrang' in d.d.kronen), JSON.stringify(d?.d?.kronen || d));
  const y = await lauf(db, 'weltrang-zurueck.sql (zweites Mal)', lies('supabase/weltrang-zurueck.sql'));
  pruefe('Rueckweg ist wiederholbar', !y, y);
  const z = await lauf(db, 'weltrang-schema.sql (nach Rueckweg)', lies('supabase/weltrang-schema.sql'));
  const l = await liste(U.bert);
  pruefe('Vorschlag laeuft danach erneut, Liste leer (Zustimmungen waren mit weg)', !z && l?.liste?.length === 0, z || JSON.stringify(l));
}

console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
