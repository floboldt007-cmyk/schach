// Benutzername mit gruenem Haken (supabase/benutzername-bestaetigt-schema.sql, noch nicht eingespielt, Flo 21.11.2026):
// fuehrt die echten Schemata in PGlite aus (ohne Netz, ohne Supabase). Wer seinen Namen selbst bestaetigt, ist
// "bestaetigt" und kann ihn danach 30 Tage nicht aendern, auch beim ersten Mal. Ein vom Server vergebener Name sperrt
// nicht und traegt keinen Haken. Den Haken kann niemand selbst mitschicken oder wegnehmen, die Verwaltung nimmt ihn bei
// einer Umbenennung weg (Flo 21.11., Annahme B) und kann die Sperre aufheben. Bestandsnamen bekommen beim Einspielen den
// Haken ohne neue Sperre (Annahme A). name_frei und bestaetigte_namen fuer die App, Rueckweg nimmt alles heraus.
// Lokal nur mit PGlite in node_modules (npm install --no-save --ignore-scripts @electric-sql/pglite@0.5.11).
//   node tests/server-benutzername-bestaetigt.test.mjs
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
// dieselbe Kette wie tests/server-verwaltung.test.mjs, damit verwaltung_pruefen und das Protokoll echt sind
const SCHEMATA = ['schema', 'online-schema', 'freunde-schema', 'abo-schema', 'werkstatt-schema', 'pionier-schema',
  'coach-schema', 'schule-schema', 'kronen-schema', 'zaehler-schema', 'karte-schema', 'raetsel-duell-schema',
  'liga-bild-schema', 'zwei-ligen-schema', 'daten-schema', 'verwaltung-schema', 'benutzername-sperre-schema'];

const F = 'f0000000-0000-4000-8000-0000000000f0';   // Flo, Verwalter
const A = 'a1000000-0000-4000-8000-0000000000a1';   // neuer Spieler, bestaetigt selbst
const B = 'b2000000-0000-4000-8000-0000000000b2';   // Bestandsname vor dem Einspielen
const C = 'c3000000-0000-4000-8000-0000000000c3';   // Name vom Server vergeben
const D = 'd4000000-0000-4000-8000-0000000000d4';   // Name vom Server vergeben, aendert ihn selbst
const ALS = (uid) => `select set_config('request.jwt.claims', '{"sub":"${uid}","role":"authenticated"}', false); set role authenticated;`;
const ANON = `select set_config('request.jwt.claims', '{"role":"anon"}', false); set role anon;`;
const BESITZER = `reset role; select set_config('request.jwt.claims', '', false);`;
// wie PostgREST bei POST /rest/v1/profile mit Prefer resolution=merge-duplicates (die App schickt name_bestaetigt mit)
// haken null = die Spalte fehlt im Aufruf (App-Fassung vor dem Haken, PR #252)
const UPSERT = (uid, name, haken = true) => haken === null
  ? `insert into public.profile (user_id, benutzername) values ('${uid}', '${name}')
     on conflict (user_id) do update set benutzername = excluded.benutzername;`
  : `insert into public.profile (user_id, benutzername, name_bestaetigt) values ('${uid}', '${name}', ${haken})
     on conflict (user_id) do update set benutzername = excluded.benutzername, name_bestaetigt = excluded.name_bestaetigt;`;

async function versuch(db, sql) {
  try { await db.exec(sql); return null; } catch (e) { return e; }
}
async function zeile(db, uid) {
  await db.exec(BESITZER);
  // to_jsonb: vor dem Einspielen (und nach dem Rueckweg) gibt es die Spalte nicht, dann null statt Fehler
  const r = await db.query(`select benutzername, name_geaendert_am, (to_jsonb(p) ->> 'name_bestaetigt')::boolean as name_bestaetigt
    from public.profile p where user_id = '${uid}'`);
  return r.rows[0] || null;
}
async function wert(db, wer, sql) {
  await db.exec(wer);
  try { return { w: (await db.query(sql)).rows }; } catch (e) { return { e }; } finally { await db.exec(BESITZER); }
}
const frisch = (d) => d instanceof Date && Math.abs(d.getTime() - Date.now()) < 120000;

const db = new PGlite();
let f = await versuch(db, ATTRAPPE);
for (const d of SCHEMATA) f = f || await versuch(db, lies(`supabase/${d}.sql`));
pruefe('Attrappe und bisherige Schemata (mit Sperre) laufen', !f, f?.message);
if (f) { console.log(`\n${ok}/${gesamt} bestanden`); process.exit(1); }
await db.exec(`insert into auth.users (id, email) values ('${F}', 'f@x'), ('${A}', 'a@x'), ('${B}', 'b@x'), ('${C}', 'c@x'), ('${D}', 'd@x');
  insert into public.verwalter (user_id) values ('${F}');`);
// B hat schon einen Namen, bevor der Haken kommt (heute: erstes Setzen frei, keine Frist)
f = await versuch(db, ALS(B) + `insert into public.profile (user_id, benutzername) values ('${B}', 'bestand_b');`);
pruefe('Vorher: B setzt seinen Namen (Stand Sperr-Datei, ohne Frist)', !f && (await zeile(db, B)).name_geaendert_am === null, f?.message);

await db.exec(BESITZER);
f = await versuch(db, lies('supabase/benutzername-bestaetigt-schema.sql')) || await versuch(db, lies('supabase/benutzername-bestaetigt-schema.sql'));
pruefe('Haken spielt ein, auch zweimal (wiederholbar)', !f, f?.message);
let z = await zeile(db, B);
pruefe('Bestandsname bekommt den Haken, aber keine neue Sperre (Annahme A)', z?.name_bestaetigt === true && z.name_geaendert_am === null, JSON.stringify(z));

// A: das erste eigene Bestaetigen setzt Haken und Frist
f = await versuch(db, ALS(A) + UPSERT(A, 'anna_eins'));
z = await zeile(db, A);
pruefe('Erstes eigenes Bestaetigen: Haken und Frist ab jetzt', !f && z?.name_bestaetigt === true && frisch(z.name_geaendert_am), f?.message || JSON.stringify(z));
f = await versuch(db, ALS(A) + UPSERT(A, 'anna_zwei'));
z = await zeile(db, A);
pruefe('Direkt danach ist eine Aenderung gesperrt (NAME_GESPERRT), Name bleibt', f?.message === 'NAME_GESPERRT' && z.benutzername === 'anna_eins',
  f ? f.message : 'kein Fehler');
f = await versuch(db, ALS(A) + `update public.profile set benutzername = 'anna_zwei' where user_id = '${A}';`);
pruefe('Auch ein direktes UPDATE an der App vorbei ist gesperrt', f?.message === 'NAME_GESPERRT', f ? f.message : 'kein Fehler');
f = await versuch(db, ALS(A) + UPSERT(A, 'anna_eins'));
pruefe('Gleicher Name erneut (Jetzt sichern) geht weiter', !f, f?.message);
f = await versuch(db, ALS(A) + `update public.profile set name_bestaetigt = false where user_id = '${A}';`);
z = await zeile(db, A);
pruefe('Den Haken kann man nicht selbst wegnehmen', z.name_bestaetigt === true, f?.message || JSON.stringify(z));
// ohne Haken mitzuschicken (alte App-Fassung) zaehlt die eigene Eingabe trotzdem als bestaetigt
await db.exec(BESITZER + `update public.profile set name_geaendert_am = null where user_id = '${A}';`);
f = await versuch(db, ALS(A) + UPSERT(A, 'anna_drei', null));
z = await zeile(db, A);
pruefe('Eigene Aenderung ohne mitgeschickten Haken (alte App): trotzdem Haken und Frist', !f && z.name_bestaetigt === true && frisch(z.name_geaendert_am),
  f?.message || JSON.stringify(z));

// C: vom Server vergeben (Besitzer), kein Haken, keine Frist; ein mitgeschickter Haken zaehlt dort nicht
await db.exec(BESITZER);
f = await versuch(db, `insert into public.profile (user_id, benutzername) values ('${C}', 'spieler_c');`);
z = await zeile(db, C);
pruefe('Vom Server vergebener Name: kein Haken, keine Frist (Annahme 7)', !f && z.name_bestaetigt === false && z.name_geaendert_am === null, f?.message || JSON.stringify(z));
f = await versuch(db, ALS(C) + `update public.profile set name_geaendert_am = now() - interval '1 year' where user_id = '${C}';`);
z = await zeile(db, C);
pruefe('Die Frist laesst sich nicht selbst setzen', z.name_geaendert_am === null, f?.message || JSON.stringify(z));
f = await versuch(db, ALS(C) + UPSERT(C, 'spieler_c', null));
z = await zeile(db, C);
pruefe('Jetzt sichern ohne Bestaetigen: weiter kein Haken, keine Frist', !f && z.name_bestaetigt === false && z.name_geaendert_am === null, f?.message || JSON.stringify(z));
f = await versuch(db, ALS(C) + UPSERT(C, 'spieler_c', true));
z = await zeile(db, C);
pruefe('Den vergebenen Namen selbst bestaetigen: Haken und Frist ab jetzt', !f && z.name_bestaetigt === true && frisch(z.name_geaendert_am), f?.message || JSON.stringify(z));
f = await versuch(db, ALS(C) + UPSERT(C, 'spieler_c2'));
pruefe('Danach ist die Aenderung gesperrt', f?.message === 'NAME_GESPERRT', f ? f.message : 'kein Fehler');
// D: vergeben, dann selbst einen anderen Namen bestaetigen
await db.exec(BESITZER + `insert into public.profile (user_id, benutzername) values ('${D}', 'spieler_d');`);
f = await versuch(db, ALS(D) + UPSERT(D, 'dora_neu'));
z = await zeile(db, D);
pruefe('Vergebenen Namen durch einen eigenen ersetzen: Haken und Frist', !f && z.benutzername === 'dora_neu' && z.name_bestaetigt === true && frisch(z.name_geaendert_am),
  f?.message || JSON.stringify(z));

// name_frei
const frei = async (wer, n) => { const r = await wert(db, wer, `select public.name_frei('${n}') as f`); return r.e ? r.e.message : r.w[0].f; };
pruefe('name_frei: fremder Name ist vergeben (auch in anderer Schreibweise)', (await frei(ALS(B), 'anna_drei')) === false && (await frei(ALS(B), 'ANNA_DREI')) === false);
pruefe('name_frei: der eigene Name zaehlt als frei', (await frei(ALS(A), 'Anna_Drei')) === true);
pruefe('name_frei: unbenutzter Name ist frei', (await frei(ALS(A), 'ganz_neu_99')) === true);
pruefe('name_frei: ungueltiges Format ist nicht frei', (await frei(ALS(A), 'ab')) === false && (await frei(ALS(A), 'mit leer')) === false
  && (await frei(ALS(A), 'x'.repeat(21))) === false);
pruefe('name_frei: nur angemeldet (anon darf nicht)', typeof (await frei(ANON, 'ganz_neu_99')) === 'string');

// bestaetigte_namen
const haken = async (wer, liste) => {
  const r = await wert(db, wer, `select n from public.bestaetigte_namen(array[${liste.map((x) => `'${x}'`).join(',')}]::text[]) n order by 1`);
  return r.e ? r.e.message : r.w.map((x) => x.n);
};
pruefe('bestaetigte_namen: nur die bestaetigten, in gespeicherter Schreibweise', JSON.stringify(await haken(ALS(C), ['ANNA_DREI', 'spieler_c', 'bestand_b', 'gibt_es_nicht']))
  === JSON.stringify(['anna_drei', 'bestand_b', 'spieler_c']), JSON.stringify(await haken(ALS(C), ['ANNA_DREI', 'spieler_c', 'bestand_b', 'gibt_es_nicht'])));
await db.exec(BESITZER + `update public.profile set name_bestaetigt = false where user_id = '${C}';`);
pruefe('bestaetigte_namen: ohne Haken kein Treffer', JSON.stringify(await haken(ALS(A), ['spieler_c'])) === '[]');
const viele = Array.from({ length: 150 }, (_, i) => `x${i}_name`).concat(['anna_drei']);
const r150 = await haken(ALS(A), viele);
pruefe('bestaetigte_namen: hoechstens 100 Namen je Aufruf (der 151. zaehlt nicht)', Array.isArray(r150) && r150.length === 0, JSON.stringify(r150));
pruefe('bestaetigte_namen: nur angemeldet (anon darf nicht)', typeof (await haken(ANON, ['anna_drei'])) === 'string');

// Verwaltung: Umbenennen nimmt den Haken (Annahme B), die Frist bleibt; Sperre aufheben nur fuer Verwalter
const vorA = (await zeile(db, A)).name_geaendert_am;
let r = await wert(db, ALS(F), `select public.verwaltung_name('${A}', 'anna_verw') as j`);
z = await zeile(db, A);
pruefe('Verwaltung benennt um: Haken weg, Frist bleibt', !r.e && z.benutzername === 'anna_verw' && z.name_bestaetigt === false
  && z.name_geaendert_am.getTime() === vorA.getTime(), r.e?.message || JSON.stringify(z));
r = await wert(db, ALS(B), `select public.verwaltung_name_sperre_aufheben('${A}') as j`);
pruefe('Sperre aufheben: ohne Verwalter-Recht VERWALTUNG_KEIN_RECHT', r.e?.message === 'VERWALTUNG_KEIN_RECHT', r.e?.message || 'kein Fehler');
z = await zeile(db, A);
pruefe('... und die Frist bleibt', z.name_geaendert_am.getTime() === vorA.getTime(), JSON.stringify(z));
r = await wert(db, ALS(F), `select public.verwaltung_name_sperre_aufheben('${A}') as j`);
z = await zeile(db, A);
pruefe('Verwalter hebt die Sperre auf: Frist weg, Antwort aufgehoben', !r.e && z.name_geaendert_am === null && r.w[0].j?.aufgehoben === true,
  r.e?.message || JSON.stringify(r.w));
r = await wert(db, BESITZER, `select was, ziel_user, nachher from public.verwaltung_protokoll where ziel_user = '${A}' order by id desc limit 1`);
pruefe('Aufheben steht im Verwaltungs-Protokoll', r.w?.[0]?.was === 'name' && r.w[0].nachher?.sperre_aufgehoben === true, JSON.stringify(r.w));
r = await wert(db, ALS(F), `select public.verwaltung_name_sperre_aufheben('99999999-0000-4000-8000-000000000099') as j`);
pruefe('Sperre aufheben fuer ein unbekanntes Konto: VERWALTUNG_KEIN_KONTO', r.e?.message === 'VERWALTUNG_KEIN_KONTO', r.e?.message || 'kein Fehler');
f = await versuch(db, ALS(A) + UPSERT(A, 'anna_wieder'));
z = await zeile(db, A);
pruefe('Nach dem Aufheben kann A neu bestaetigen: Haken und Frist ab jetzt', !f && z.name_bestaetigt === true && frisch(z.name_geaendert_am), f?.message || JSON.stringify(z));

// RLS bleibt: fremdes Profil nicht aenderbar, Haken eines anderen nicht setzbar
f = await versuch(db, ALS(B) + `update public.profile set name_bestaetigt = true where user_id = '${C}';`);
pruefe('B kann den Haken von C nicht setzen (RLS)', (await zeile(db, C)).name_bestaetigt === false, f?.message);
// Datenauskunft enthaelt den Haken (meine_daten liest to_jsonb(profile))
r = await wert(db, ALS(A), `select public.meine_daten() -> 'profil' ->> 'name_bestaetigt' as h`);
pruefe('Datenauskunft zeigt name_bestaetigt', r.w?.[0]?.h === 'true', r.e?.message || JSON.stringify(r.w));

// RLS-Test fuer den SQL Editor: auf dieser Datenbank gruen, rollt zurueck
{
  const vor = (await db.query(`select count(*)::int as n from public.profile`)).rows[0].n;
  await db.exec(BESITZER);
  const g = await versuch(db, lies('supabase/benutzername-bestaetigt-rls-test.sql'));
  if (g) await versuch(db, 'rollback;');   // ein FEHLER bricht vor dem eigenen rollback ab
  await db.exec(BESITZER);
  const nach = (await db.query(`select count(*)::int as n from public.profile`)).rows[0].n;
  pruefe('supabase/benutzername-bestaetigt-rls-test.sql laeuft gruen und hinterlaesst nichts', !g && nach === vor, g?.message);
}

// Rueckweg: Haken, Funktionen und Trigger weg, die Sperr-Datei wirkt wie vorher (erstes Setzen frei)
await db.exec(BESITZER);
f = await versuch(db, lies('supabase/benutzername-bestaetigt-zurueck.sql')) || await versuch(db, lies('supabase/benutzername-bestaetigt-zurueck.sql'));
const spalte = await db.query(`select 1 from information_schema.columns where table_name = 'profile' and column_name = 'name_bestaetigt'`);
const trig = await db.query(`select 1 from pg_trigger where tgname = 'profile_name_zz_bestaetigt'`);
const fn = await db.query(`select 1 from pg_proc where proname in ('name_frei', 'bestaetigte_namen', 'verwaltung_name_sperre_aufheben', 'profile_name_bestaetigt')`);
const sperre = await db.query(`select 1 from pg_trigger where tgname = 'profile_name_sperre'`);
pruefe('Rueckweg laeuft (zweimal), Spalte, Trigger und Funktionen weg, die Sperre bleibt', !f && spalte.rows.length === 0 && trig.rows.length === 0
  && fn.rows.length === 0 && sperre.rows.length === 1, f?.message);
await db.exec(`insert into auth.users (id, email) values ('e5000000-0000-4000-8000-0000000000e5', 'e@x');`);
f = await versuch(db, ALS('e5000000-0000-4000-8000-0000000000e5') + `insert into public.profile (user_id, benutzername) values ('e5000000-0000-4000-8000-0000000000e5', 'erich_e');`);
z = await zeile(db, 'e5000000-0000-4000-8000-0000000000e5');
pruefe('Nach dem Rueckweg: erstes Setzen wieder frei (Stand Sperr-Datei)', !f && z.name_geaendert_am === null, f?.message || JSON.stringify(z));
f = await versuch(db, lies('supabase/benutzername-bestaetigt-schema.sql'));
pruefe('Danach laesst sich der Haken wieder einspielen', !f, f?.message);

// Gegenprobe: ohne den Haken-Trigger findet der RLS-Test den Fehler
{
  const db2 = new PGlite();
  let g = await versuch(db2, ATTRAPPE);
  for (const d of SCHEMATA) g = g || await versuch(db2, lies(`supabase/${d}.sql`));
  g = g || await versuch(db2, lies('supabase/benutzername-bestaetigt-schema.sql'));
  await db2.exec(`drop trigger profile_name_zz_bestaetigt on public.profile;`);
  g = g || await versuch(db2, lies('supabase/benutzername-bestaetigt-rls-test.sql'));
  pruefe('Gegenprobe: ohne Haken-Trigger scheitert der RLS-Test mit FEHLER', /FEHLER/.test(g?.message || ''), g?.message || 'kein Fehler');
}

console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
