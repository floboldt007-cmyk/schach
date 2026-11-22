// Vorschlag Profilbild in der Weltrangliste (supabase/weltrang-karte-schema.sql, R27 Online Arena, NICHT eingespielt): fuehrt
// die bisherigen Schemas, die Weltrangliste und den Vorschlag WIRKLICH aus, in PGlite (ohne Netz, ohne Supabase). Geprueft:
// je Zeile und im eigenen Stand kommen motiv, grund, rahmen dazu, nur Werte aus den festen Listen (karte_konstanten), sonst der
// Standard; sonst bleibt alles wie in weltrang-schema.sql (Felder, Rang, Banner nur im Besitz, keine Kennung, keine Mail);
// Rechte nur fuer authenticated; der Rueckweg stellt die alte Fassung zeichengleich her und ist wiederholbar.
// Lokal nur mit PGlite in node_modules (npm install --no-save --ignore-scripts @electric-sql/pglite@0.5.11).
//   node tests/server-weltrang-karte.test.mjs
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

// ---------- Wache: der Vorschlag ist weltrang_liste aus weltrang-schema.sql plus genau drei Zusaetze, der Rueckweg zeichengleich ----------
const block = (s) => { const a = s.indexOf('create or replace function public.weltrang_liste('); return a < 0 ? null : s.slice(a, s.indexOf('$$;\n', a) + 4); };
const ORIG = block(lies('supabase/weltrang-schema.sql'));
const NEU = block(lies('supabase/weltrang-karte-schema.sql'));
const ZURUECK = block(lies('supabase/weltrang-karte-zurueck.sql'));
pruefe('Rueckweg: weltrang_liste zeichengleich mit weltrang-schema.sql', !!ORIG && ZURUECK === ORIG);
const ohneZusatz = (NEU || '')
  .replace(/ {11}-- R27: das Profilbild[^\n]*\n(?: {11}case when public\.karte_in_liste[^\n]*\n){3}/, '')
  .replace("\n              'motiv', o.motiv, 'grund', o.grund, 'rahmen', o.rahmen, 'ich', o.user_id = uid)", "\n              'ich', o.user_id = uid)")
  .replace(",\n                               'motiv', x.motiv, 'grund', x.grund, 'rahmen', x.rahmen)", ')');
pruefe('Vorschlag: bis auf die drei Zusaetze zeichengleich mit weltrang-schema.sql', !!ORIG && NEU !== ORIG && ohneZusatz === ORIG);
for (const d of ['supabase/weltrang-karte-schema.sql', 'supabase/weltrang-karte-zurueck.sql']) {
  const s = lies(d);
  pruefe(`${d}: Rechte nur fuer authenticated, kein grant an anon oder public`, /revoke all on function public\.weltrang_liste\(integer\) from public, anon, authenticated;/.test(s)
    && /grant execute on function public\.weltrang_liste\(integer\) to authenticated;/.test(s) && !/grant[^;]*to[^;]*\b(anon|public)\b/i.test(s));
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
const BISHER = ['supabase/schema.sql', 'supabase/abo-schema.sql', 'supabase/online-schema.sql', 'supabase/kronen-schema.sql',
  'supabase/raetsel-duell-schema.sql', 'supabase/raetsel-duell-daten.sql', 'supabase/karte-schema.sql',
  'supabase/liga-bild-schema.sql', 'supabase/zwei-ligen-schema.sql', 'supabase/daten-schema.sql', 'supabase/weltrang-schema.sql'];

// anna: gueltiges Profilbild (karo, holz) und eigenes Banner; bert: kaputte Werte direkt in der Tabelle (an karte_waehle vorbei);
// fritz: ohne karte_wahl
const U = { anna: 'f1000000-0000-4000-8000-0000000000a1', bert: 'f2000000-0000-4000-8000-0000000000b2', fritz: 'f6000000-0000-4000-8000-0000000000f6' };
const db = new PGlite();
let f = await lauf(db, 'Attrappe', ATTRAPPE);
for (const d of BISHER) f = f || await lauf(db, d, lies(d));
pruefe('bisherige Schemas samt Weltrangliste laufen', !f, f);
if (f) { console.log(`\n${ok}/${gesamt} bestanden`); process.exit(1); }
const gruende = (await db.query(`select public.karte_konstanten() -> 'gruende' ->> 1 as g`)).rows[0].g;
await db.exec(`
insert into auth.users (id, email) values ${Object.entries(U).map(([n, id]) => `('${id}', '${n}@x.invalid')`).join(', ')};
insert into public.profile (user_id, benutzername) values ('${U.anna}', 'anna'), ('${U.bert}', 'bert'), ('${U.fritz}', 'fritz');
insert into public.kronen_stand (user_id, elo, elo_n) values ('${U.anna}', 1500, 20), ('${U.bert}', 1600, 15), ('${U.fritz}', 1400, 16)
  on conflict (user_id) do update set elo = excluded.elo, elo_n = excluded.elo_n;
insert into public.banner_besitz (user_id, banner, quelle) values ('${U.anna}', 'saison-gold', 'liga');
insert into public.karte_wahl (user_id, banner, motiv, grund, rahmen) values ('${U.anna}', 'saison-gold', 'karo', '${gruende}', 'holz'),
  ('${U.bert}', 'saison-gold', '<img src=x>', 'gibts-nicht', '../x')
  on conflict (user_id) do update set banner = excluded.banner, motiv = excluded.motiv, grund = excluded.grund, rahmen = excluded.rahmen;
insert into public.weltrang_teilnahme (user_id, alter_bestaetigt_am) values ('${U.anna}', now()), ('${U.bert}', now()), ('${U.fritz}', now());
`);
async function als(uid, sql, rolle = 'authenticated') {
  await db.exec(`select set_config('request.jwt.claims', '${uid ? `{"sub":"${uid}","role":"${rolle}"}` : `{"role":"${rolle}"}`}', false); set role ${rolle};`);
  try { return (await db.query(sql)).rows[0]; } catch (e) { return { fehler: e.message }; } finally {
    await db.exec(`reset role; select set_config('request.jwt.claims', '', false);`);
  }
}
const liste = async (uid) => (await als(uid, 'select public.weltrang_liste() as l'))?.l;

const vorher = await liste(U.anna);
pruefe('vor dem Vorschlag: Zeilen ohne Profilbild', vorher?.liste?.length === 3 && vorher.liste.every((z) => !('motiv' in z)), JSON.stringify(vorher?.liste?.[0]));
f = await lauf(db, 'weltrang-karte-schema.sql', lies('supabase/weltrang-karte-schema.sql'));
pruefe('weltrang-karte-schema.sql laeuft', !f, f);
f = await lauf(db, 'weltrang-karte-schema.sql (2.)', lies('supabase/weltrang-karte-schema.sql'));
pruefe('weltrang-karte-schema.sql ist wiederholbar', !f, f);
{
  const l = await liste(U.anna);
  const z = Object.fromEntries((l?.liste || []).map((x) => [x.name, x]));
  pruefe('Reihenfolge und Rang wie vorher (bert, anna, fritz)', (l?.liste || []).map((x) => `${x.rang}${x.name}`).join() === '1bert,2anna,3fritz', JSON.stringify(l?.liste));
  pruefe('anna: ihr Profilbild (karo, Grund, holz) und ihr Banner', z.anna?.motiv === 'karo' && z.anna?.grund === gruende && z.anna?.rahmen === 'holz'
    && z.anna?.banner === 'saison-gold', JSON.stringify(z.anna));
  pruefe('bert: kaputte Werte werden zum Standard (P, standard, ohne), fremdes Banner bleibt start', z.bert?.motiv === 'P' && z.bert?.grund === 'standard'
    && z.bert?.rahmen === 'ohne' && z.bert?.banner === 'start', JSON.stringify(z.bert));
  pruefe('fritz ohne karte_wahl: Standard', z.fritz?.motiv === 'P' && z.fritz?.grund === 'standard' && z.fritz?.rahmen === 'ohne', JSON.stringify(z.fritz));
  const felder = [...new Set((l?.liste || []).flatMap((x) => Object.keys(x)))].sort().join(',');
  pruefe('je Zeile genau banner, elo, grund, ich, motiv, name, rahmen, rang', felder === 'banner,elo,grund,ich,motiv,name,rahmen,rang', felder);
  const ich = Object.keys(l?.ich || {}).sort().join(',');
  pruefe('eigener Stand mit Profilbild, sonst wie vorher', ich === 'banner,elo,grund,motiv,name,rahmen,rang,status' && l.ich.motiv === 'karo', ich);
  const text = JSON.stringify(l);
  pruefe('keine Kennung, keine Mail, kein roher Fremdwert in der Antwort', !Object.values(U).some((id) => text.includes(id)) && !text.includes('@')
    && !text.includes('<img') && !text.includes('../'), text);
  pruefe('eigene Zeile markiert', z.anna?.ich === true && z.bert?.ich === false, JSON.stringify(l?.liste));
}
{
  const anon = await als(null, 'select public.weltrang_liste() as l', 'anon');
  pruefe('anon darf weltrang_liste nicht ausfuehren', /permission denied/i.test(anon?.fehler || ''), JSON.stringify(anon));
  const ohne = await als(null, 'select public.weltrang_liste() as l');
  pruefe('angemeldet ohne Kennung: WELTRANG_OHNE_KONTO', /WELTRANG_OHNE_KONTO/.test(ohne?.fehler || ''), JSON.stringify(ohne));
  const sd = (await db.query(`select p.prosecdef as sd, p.proconfig as cfg from pg_proc p where p.proname = 'weltrang_liste'`)).rows[0];
  pruefe('weiter security definer mit leerem search_path', sd?.sd === true && (sd?.cfg || []).includes('search_path=""'), JSON.stringify(sd));
}
f = await lauf(db, 'weltrang-karte-zurueck.sql', lies('supabase/weltrang-karte-zurueck.sql'));
pruefe('Rueckweg laeuft', !f, f);
f = await lauf(db, 'weltrang-karte-zurueck.sql (2.)', lies('supabase/weltrang-karte-zurueck.sql'));
pruefe('Rueckweg ist wiederholbar', !f, f);
{
  const l = await liste(U.anna);
  const felder = [...new Set((l?.liste || []).flatMap((x) => Object.keys(x)))].sort().join(',');
  pruefe('nach dem Rueckweg: Zeilen wieder ohne Profilbild (wie weltrang-schema.sql)', felder === 'banner,elo,ich,name,rang', felder);
  const anon = await als(null, 'select public.weltrang_liste() as l', 'anon');
  pruefe('nach dem Rueckweg: anon weiter gesperrt', /permission denied/i.test(anon?.fehler || ''), JSON.stringify(anon));
}
f = await lauf(db, 'weltrang-karte-schema.sql (nach Rueckweg)', lies('supabase/weltrang-karte-schema.sql'));
pruefe('nach dem Rueckweg laesst sich der Vorschlag neu einspielen', !f && (await liste(U.anna))?.liste?.[1]?.motiv === 'karo', f);

console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
