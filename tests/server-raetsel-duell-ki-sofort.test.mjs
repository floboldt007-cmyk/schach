// Raetsel-Duell gegen die KI wertet sofort aus (R26 AC-05, Flo 20.11.2026): sobald der Spieler fertig ist (alle Raetsel
// durch) oder seine eigene Zeit samt Gnadenfrist um ist, endet das Duell, statt bis zum Ende der vollen 180 s der KI zu
// warten. Die KI zaehlt dann mit genau der Zeit, die der Spieler hatte. Der Test spielt in PGlite (Postgres als
// WebAssembly, ohne Netz, ohne Supabase) die Schemas wie in Supabase ein, dann supabase/raetsel-duell-ki-sofort-schema.sql
// (vorwaerts), supabase/raetsel-duell-ki-sofort-zurueck.sql (Rueckweg) und wieder vorwaerts. Die Zeit stellt er, indem er
// start_am in die Vergangenheit legt. Laeuft im CI-Job "sql" (nicht in tests/alle.mjs, dort fehlt PGlite); lokal nur
// mit PGlite in node_modules (npm install --no-save --ignore-scripts @electric-sql/pglite@0.5.11).
//   node tests/server-raetsel-duell-ki-sofort.test.mjs
//   KI_SOFORT_OHNE=1 node tests/server-raetsel-duell-ki-sofort.test.mjs   ohne die neue Datei (zeigt das Rot vor dem Fix)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lies = (d) => readFileSync(path.join(WURZEL, d), 'utf8');
const VORWAERTS = 'supabase/raetsel-duell-ki-sofort-schema.sql';
const RUECKWEG = 'supabase/raetsel-duell-ki-sofort-zurueck.sql';
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

// Auth-Attrappe wie tests/server-raetsel-duell.test.mjs (die Schemas vergeben Rechte an diese Rollen)
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
// Reihenfolge wie live in Supabase (wie tests/server-zwei-ligen.test.mjs): duell_auswerten gilt seit 11.11.2026 in der
// Fassung aus zwei-ligen-schema.sql, auf ihr baut die neue Datei auf
for (const datei of ['supabase/schema.sql', 'supabase/abo-schema.sql', 'supabase/online-schema.sql', 'supabase/kronen-schema.sql',
  'supabase/raetsel-duell-schema.sql', 'supabase/raetsel-duell-daten.sql', 'supabase/karte-schema.sql',
  'supabase/liga-bild-schema.sql', 'supabase/daten-schema.sql', 'supabase/zwei-ligen-schema.sql']) {
  const f = await lauf(db, datei, lies(datei));
  pruefe(`${datei} laeuft`, f === null, f);
}
const ohne = process.env.KI_SOFORT_OHNE === '1';
if (!ohne) {
  let f = await lauf(db, VORWAERTS, lies(VORWAERTS));
  pruefe(`${VORWAERTS} laeuft`, f === null, f);
  f = await lauf(db, `${VORWAERTS} (zweites Mal)`, lies(VORWAERTS));
  pruefe(`${VORWAERTS} ist wiederholbar`, f === null, f);
}

let nr = 0;
// Ein KI-Duell (Elo 1200), dessen Start `vor` Sekunden zurueckliegt; der Spieler hat `fehler` Fehler und `geloest`
// geloeste Raetsel, `fertigNach` = Sekunden nach dem Start, an denen er sein letztes Raetsel abschloss (alle durch).
async function kiDuell({ vor, fehler = 0, geloest = 0, fertigNach = null }) {
  nr++;
  const u = `00000000-0000-4000-8000-${String(nr).padStart(12, '0')}`;
  await db.query('insert into auth.users (id, email) values ($1, $2)', [u, `k${nr}@example.invalid`]);
  const d = (await db.query(`select public.duell_anlegen('ki', $1::uuid, null, 1200) as id`, [u])).rows[0].id;
  await db.query(`update public.duelle set start_am = now() - make_interval(secs => $2::double precision) where id = $1`, [d, vor]);
  const idx = fertigNach !== null ? (await db.query('select cardinality(raetsel) as n from public.duelle where id = $1', [d])).rows[0].n
    : geloest + fehler;
  await db.query(`update public.duell_spieler s set fehler = $2::integer, geloest = $3::integer, idx = $4::integer,
      zuege = greatest(1, $3::integer + $2::integer),
      letzter_zug_am = case when $5::double precision is null then null
                            else (select x.start_am from public.duelle x where x.id = s.duell) + make_interval(secs => $5::double precision) end
    where s.duell = $1`, [d, fehler, fertigNach !== null ? idx - fehler : geloest, idx, fertigNach]);
  return { d, u };
}
const status = async (d) => (await db.query('select status from public.duelle where id = $1', [d])).rows[0].status;
const auswerten = async (d) => (await db.query('select (public.duell_auswerten($1)).status as s', [d])).rows[0].s;
const kiBei = async (d, sek) => (await db.query(`select public.duell_ki_verlauf(x.seed, x.ki_elo, public.duell_ratings(x), $2) as k
  from public.duelle x where x.id = $1`, [d, sek])).rows[0].k;
async function stand(d, u) {
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [u]);
  const s = (await db.query('select public.duell_stand($1) as s', [d])).rows[0].s;
  await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
  return s;
}

// A) Zeit um mit 10 Fehlern: eigenes Ende nach 130 s, 140 s sind vorbei (Gnade 3 s). Bisher wartete die Auswertung bis
//    180 s + 3 s; jetzt endet das Duell, und die KI zaehlt mit 130 s.
{
  const { d, u } = await kiDuell({ vor: 140, fehler: 10, geloest: 4 });
  const s = await stand(d, u);
  const soll = await kiBei(d, 130);
  pruefe('A: eigene Zeit um (10 Fehler, 140 s): das Duell ist sofort beendet', s.status === 'beendet', JSON.stringify(s));
  pruefe('A: die KI zaehlt mit der Zeit des Spielers (130 s), Anzeige wie Wertung',
    s.gegner && s.gegner.geloest === soll.geloest && s.gegner.fehler === soll.fehler, JSON.stringify({ gegner: s.gegner, soll }));
  pruefe('A: Ergebnis aus eigener Sicht steht fest', ['sieg', 'remis', 'niederlage'].includes(s.ergebnis), s.ergebnis);
}
// B) alle Raetsel durch nach 60 s, 80 s sind vorbei: sofort beendet (keine Gnade noetig, es kommt kein Zug mehr), KI bei
//    60 s und nicht bei 80 s
{
  const { d, u } = await kiDuell({ vor: 80, fertigNach: 60 });
  const s = await stand(d, u);
  const soll = await kiBei(d, 60);
  pruefe('B: alle Raetsel durch: das Duell ist sofort beendet', s.status === 'beendet', JSON.stringify({ status: s.status }));
  pruefe('B: die KI zaehlt bis zum letzten Zug des Spielers (60 s)',
    s.gegner && s.gegner.geloest === soll.geloest && s.gegner.fehler === soll.fehler, JSON.stringify({ gegner: s.gegner, soll }));
}
// C) laeuft noch: 30 s gespielt, keine Fehler -> bleibt offen
{
  const { d } = await kiDuell({ vor: 30 });
  pruefe('C: mitten im Spiel bleibt das Duell offen', (await auswerten(d)) === 'laeuft');
}
// D) eigene Zeit um, aber noch in der Gnadenfrist (131,5 s bei Ende 130 s): bleibt offen, ein spaeter Zug kommt noch an
{
  const { d } = await kiDuell({ vor: 131.5, fehler: 10 });
  pruefe('D: in der Gnadenfrist nach dem eigenen Ende bleibt das Duell offen', (await auswerten(d)) === 'laeuft');
}
// E) volle Zeit ohne Fehler: wie bisher nach 180 s + Gnade beendet, KI mit 180 s
{
  const { d, u } = await kiDuell({ vor: 184, geloest: 3 });
  const s = await stand(d, u);
  const soll = await kiBei(d, 180);
  pruefe('E: volle Zeit: beendet, KI mit 180 s wie bisher', s.status === 'beendet' && s.gegner.geloest === soll.geloest
    && s.gegner.fehler === soll.fehler, JSON.stringify({ status: s.status, gegner: s.gegner, soll }));
}
// F) Sammel-Auswertungen nehmen ein KI-Duell, dessen Spieler fertig ist, auch vor 180 s mit
{
  const { d, u } = await kiDuell({ vor: 140, fehler: 10 });
  await db.query('select public.duell_faellige_auswerten($1)', [u]);
  pruefe('F: duell_faellige_auswerten beendet ein KI-Duell nach dem eigenen Ende', (await status(d)) === 'beendet');
  const { d: d2 } = await kiDuell({ vor: 140, fehler: 10 });
  await db.query('select public.duell_alle_faelligen_auswerten()');
  pruefe('F: duell_alle_faelligen_auswerten beendet ein KI-Duell nach dem eigenen Ende', (await status(d2)) === 'beendet');
}
// G) der RLS-Test der zwei Ligen (er prueft die Duelle im Live-Stand) laeuft weiter ohne FEHLER. raetsel-duell-rls-test.sql
//    gilt nach zwei-ligen-schema.sql nicht mehr (scheitert dort schon ohne diese Datei: "erste Suche wartet nicht")
for (const datei of ['supabase/zwei-ligen-rls-test.sql']) {
  const f = await lauf(db, datei, lies(datei));
  pruefe(`G: ${datei} laeuft weiter ohne FEHLER`, f === null, f);
  if (f !== null) await lauf(db, 'Aufraeumen nach Fehler', 'rollback;');
}

// Rueckweg: alte Fassung (wartet auf die vollen 180 s), danach wieder vorwaerts
if (!ohne) {
  let f = await lauf(db, RUECKWEG, lies(RUECKWEG));
  pruefe(`${RUECKWEG} laeuft`, f === null, f);
  f = await lauf(db, `${RUECKWEG} (zweites Mal)`, lies(RUECKWEG));
  pruefe(`${RUECKWEG} ist wiederholbar`, f === null, f);
  const helfer = (await db.query(`select count(*)::int as n from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('duell_ki_sekunden', 'duell_spieler_schluss')`)).rows[0].n;
  pruefe('Rueckweg: die neuen Helfer duell_ki_sekunden und duell_spieler_schluss sind weg', helfer === 0, helfer);
  const { d } = await kiDuell({ vor: 140, fehler: 10 });
  pruefe('Rueckweg: alte Fassung wartet wieder bis 180 s + Gnade', (await auswerten(d)) === 'laeuft');
  const { d: dv, u: uv } = await kiDuell({ vor: 184, geloest: 3 });
  const s = await stand(dv, uv);
  const soll = await kiBei(dv, 180);
  pruefe('Rueckweg: nach 180 s + Gnade beendet, KI mit 180 s', s.status === 'beendet' && s.gegner.geloest === soll.geloest, JSON.stringify(s.gegner));
  f = await lauf(db, 'zwei-ligen-rls-test.sql (nach Rueckweg)', lies('supabase/zwei-ligen-rls-test.sql'));
  pruefe('Rueckweg: zwei-ligen-rls-test.sql laeuft ohne FEHLER', f === null, f);
  if (f !== null) await lauf(db, 'Aufraeumen nach Fehler', 'rollback;');
  f = await lauf(db, `${VORWAERTS} (nach Rueckweg)`, lies(VORWAERTS));
  pruefe(`${VORWAERTS} laeuft nach dem Rueckweg wieder`, f === null, f);
  pruefe('wieder vorwaerts: das Duell von eben endet jetzt sofort', (await auswerten(d)) === 'beendet');
}

await db.close();
console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
