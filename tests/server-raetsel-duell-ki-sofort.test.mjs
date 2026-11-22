// Raetsel-Duell gegen die KI wertet sofort aus (R26 AC-05, Flo 20.11.2026): sobald der Spieler fertig ist (alle Raetsel
// durch) oder seine eigene Zeit samt Gnadenfrist um ist, endet das Duell, statt bis zum Ende der vollen 180 s der KI zu
// warten. Die KI behaelt ihre vollen 180 s (gerechnet, steht sofort fest): das Ergebnis ist dasselbe wie bisher, nur
// frueher. Fall H prueft, dass absichtliche Fehler die KI nicht anhalten. Der Test spielt in PGlite (Postgres als
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

// A) Zeit um mit 10 Fehlern: eigenes Ende nach 130 s, 150 s sind vorbei (KI-Nachfrist 15 s). Bisher wartete die
//    Auswertung bis 180 s + 3 s; jetzt endet das Duell sofort, die KI zaehlt wie bisher mit ihren vollen 180 s.
{
  const { d, u } = await kiDuell({ vor: 150, fehler: 10, geloest: 4 });
  const s = await stand(d, u);
  const soll = await kiBei(d, 180);
  pruefe('A: eigene Zeit um (10 Fehler, 150 s): das Duell ist sofort beendet', s.status === 'beendet', JSON.stringify(s));
  pruefe('A: die KI zaehlt mit ihren vollen 180 s, Anzeige wie Wertung',
    s.gegner && s.gegner.geloest === soll.geloest && s.gegner.fehler === soll.fehler, JSON.stringify({ gegner: s.gegner, soll }));
  pruefe('A: Ergebnis aus eigener Sicht steht fest', ['sieg', 'remis', 'niederlage'].includes(s.ergebnis), s.ergebnis);
}
// B) alle Raetsel durch nach 60 s, 62 s sind vorbei: sofort beendet (keine Gnade noetig, es kommt kein Zug mehr)
{
  const { d, u } = await kiDuell({ vor: 62, fertigNach: 60 });
  const s = await stand(d, u);
  const soll = await kiBei(d, 180);
  pruefe('B: alle Raetsel durch: das Duell ist sofort beendet', s.status === 'beendet', JSON.stringify({ status: s.status }));
  pruefe('B: die KI zaehlt mit ihren vollen 180 s',
    s.gegner && s.gegner.geloest === soll.geloest && s.gegner.fehler === soll.fehler, JSON.stringify({ gegner: s.gegner, soll }));
}
// H) Schlupfloch zu: 10 geloest nach 40 s, dann 28 absichtliche Fehler (eigene Uhr endet bei 40 s), 60 s vorbei. Das Duell
//    endet sofort, die KI zaehlt trotzdem mit 180 s; das Ergebnis ist dasselbe, als haette der Spieler die Zeit abgewartet
{
  const { d } = await kiDuell({ vor: 60, fehler: 28, geloest: 10 });
  const st = await auswerten(d);
  const soll = await kiBei(d, 180);
  const r = (await db.query('select ergebnis from public.duelle where id = $1', [d])).rows[0].ergebnis;
  const erwartet = 10 > soll.geloest ? 'a' : soll.geloest > 10 ? 'b' : 28 < soll.fehler ? 'a' : 28 > soll.fehler ? 'b' : 'remis';
  pruefe('H: absichtliche Fehler halten die KI nicht an (Wertung mit ihren vollen 180 s)', st === 'beendet' && r === erwartet,
    JSON.stringify({ st, r, erwartet, soll }));
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
// I) Kaltreview F-20:05: ein Zug kommt bei 129 s an (eigenes Ende 130 s), verbucht wird er erst bei 140 s, nach einer
//    Abfrage dazwischen. Mit nur 3 s Gnade war das Duell da schon beendet und der Zug fiel weg (4 statt 5 geloest). Die
//    alte Fassung hielt bis 180 s + 3 s offen; die KI-Nachfrist (15 s) nimmt ihn wie bisher an.
{
  const { d, u } = await kiDuell({ vor: 140, fehler: 10, geloest: 4 });
  await db.query('select public.duell_faellige_auswerten($1)', [u]);
  pruefe('I: Abfrage 10 s nach dem eigenen Ende: das Duell bleibt fuer spaete Zuege offen', (await status(d)) === 'laeuft');
  let geloest = null;
  try {
    geloest = (await db.query(`select (public.duell_zug_verbuchen($1, $2, 14, 0, true, true,
      (select x.start_am from public.duelle x where x.id = $2) + interval '129 seconds') ->> 'geloest')::int as g`, [u, d])).rows[0].g;
  } catch (e) {
    geloest = e.message;
  }
  pruefe('I: der Zug, der vor dem Ende ankam, wird verbucht', geloest === 5, String(geloest));
  await db.query(`update public.duelle set start_am = start_am - interval '10 seconds' where id = $1`, [d]);
  pruefe('I: nach Ende + 15 s beendet, mit dem spaeten Zug gewertet', (await auswerten(d)) === 'beendet'
    && (await db.query('select geloest from public.duell_spieler where duell = $1', [d])).rows[0].geloest === 5);
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
  const { d, u } = await kiDuell({ vor: 150, fehler: 10 });
  await db.query('select public.duell_faellige_auswerten($1)', [u]);
  pruefe('F: duell_faellige_auswerten beendet ein KI-Duell nach dem eigenen Ende', (await status(d)) === 'beendet');
  const { d: d2 } = await kiDuell({ vor: 150, fehler: 10 });
  await db.query('select public.duell_alle_faelligen_auswerten()');
  pruefe('F: duell_alle_faelligen_auswerten beendet ein KI-Duell nach dem eigenen Ende', (await status(d2)) === 'beendet');
}
// ---------- R27 Sofort-Ende gegen Menschen (duell_ich_fertig, fertig_am) ----------
// Ein Duell zwischen zwei Menschen, Start `vor` Sekunden zurueck. Ohne die neue Datei fehlen RPC und Spalte: die Faelle
// schlagen dann rot an (der Fehlertext steht in der Meldung).
async function menschDuell({ vor, art = 'gewertet' }) {
  const neu = async () => {
    nr++;
    const u = `00000000-0000-4000-9000-${String(nr).padStart(12, '0')}`;
    await db.query('insert into auth.users (id, email) values ($1, $2)', [u, `m${nr}@example.invalid`]);
    return u;
  };
  const a = await neu();
  const b = await neu();
  const d = (await db.query(`select public.duell_anlegen($1, $2::uuid, $3::uuid, null) as id`, [art, a, b])).rows[0].id;
  await db.query(`update public.duelle set start_am = now() - make_interval(secs => $2::double precision), status = 'laeuft'
    where id = $1`, [d, vor]);
  return { d, a, b };
}
async function alsNutzer(u, sql, werte) {
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [u]);
  try {
    return { r: (await db.query(sql, werte)).rows[0] };
  } catch (e) {
    return { f: e.message };
  } finally {
    await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
  }
}
const ichFertig = (u, d) => alsNutzer(u, 'select public.duell_ich_fertig($1) as s', [d]);
const zug = async (u, d, ankunftNach) => {
  try {
    const r = (await db.query(`select public.duell_zug_verbuchen($1, $2, (select idx from public.duell_spieler where duell = $2
      and user_id = $1), 0, true, true, (select x.start_am from public.duelle x where x.id = $2) + make_interval(secs => $3::double precision)) as z`,
    [u, d, ankunftNach])).rows[0].z;
    return { r };
  } catch (e) {
    return { f: e.message };
  }
};
// M1) A ist nach 30 s fertig: sein Ergebnis steht sofort, das Duell laeuft fuer B weiter (A haelt B nicht an)
{
  const { d, a, b } = await menschDuell({ vor: 30 });
  await zug(a, d, 10);
  const x = await ichFertig(a, d);
  pruefe('M1: duell_ich_fertig gibt es und antwortet mit dem Stand', !!(x.r && x.r.s && x.r.s.ich), x.f || JSON.stringify(x.r));
  pruefe('M1: A ist fertig, das Duell laeuft fuer B weiter', x.r?.s?.status === 'laeuft' && x.r?.s?.ich?.fertig === true,
    JSON.stringify(x.r?.s));
  pruefe('M1: A bekommt kein Raetsel mehr', x.r?.s?.raetsel == null);
  const sb = await stand(d, b);
  pruefe('M1: B sieht A als fertig, mit Punkten', sb.gegner?.fertig === true && sb.gegner?.geloest === 1, JSON.stringify(sb.gegner));
  pruefe('M1: B spielt weiter (eigenes Raetsel, nicht fertig)', sb.raetsel != null && sb.ich?.fertig === false, JSON.stringify(sb.ich));
  // M2) Zug nach dem Fertig-Melden wird abgelehnt; B spielt weiter
  // Ankunft nach der Meldung (35 s nach dem Start, auf "jetzt" begrenzt); ein Zug mit Ankunft davor zaehlte noch
  const spaet = await zug(a, d, 35);
  pruefe('M2: ein Zug von A nach dem Fertig-Melden wird abgelehnt', /DUELL_FERTIG/.test(spaet.f || ''), JSON.stringify(spaet));
  const zb = await zug(b, d, 25);
  pruefe('M2: B kann nach dem Fertig-Melden von A weiter ziehen', zb.r?.geloest === 1, JSON.stringify(zb));
  // M3) B meldet sich fertig: das Duell endet sofort (bisher erst nach 180 s + Gnade), gewertet wie bisher
  const y = await ichFertig(b, d);
  pruefe('M3: beide fertig: das Duell endet sofort', y.r?.s?.status === 'beendet', JSON.stringify(y.r?.s || y.f));
  pruefe('M3: Ergebnis wie bisher (gleich viele geloest und Fehler: remis)', y.r?.s?.ergebnis === 'remis', y.r?.s?.ergebnis);
}
// M4) Fertig-Melden zweimal aendert nichts; nach dem eigenen Ende zaehlt das eigene Ende; vor dem Start und fuer Fremde nie
{
  const { d, a, b } = await menschDuell({ vor: 40 });
  await ichFertig(a, d);
  const fa = async () => (await db.query('select fertig_am::text as t from public.duell_spieler where duell = $1 and user_id = $2', [d, a])
    .catch(() => ({ rows: [{}] }))).rows[0]?.t;
  const erst = await fa();
  const vorher = await zug(a, d, 20);
  pruefe('M4: ein Zug, der vor dem Fertig-Melden ankam (spaet verbucht), zaehlt noch', vorher.r?.geloest === 1, JSON.stringify(vorher));
  await db.query(`update public.duelle set start_am = start_am - interval '5 seconds' where id = $1`, [d]);
  await ichFertig(a, d);
  const dann = await fa();
  pruefe('M4: zweites Fertig-Melden aendert den Zeitpunkt nicht', erst != null && erst === dann, `${erst} / ${dann}`);
  await db.query(`update public.duelle set start_am = now() - interval '182 seconds' where id = $1`, [d]);
  const spaet = await ichFertig(b, d);
  const fb = (await db.query(`select s.fertig_am = public.duell_ende_am(x.start_am, x.dauer_s, s.fehler) as gleich
    from public.duell_spieler s join public.duelle x on x.id = s.duell where s.duell = $1 and s.user_id = $2`, [d, b])
    .catch((e) => ({ rows: [{ gleich: e.message }] }))).rows[0]?.gleich;
  pruefe('M4: nach dem eigenen Ende gemeldet: fertig_am ist das eigene Ende, nicht spaeter', fb === true, String(fb) + (spaet.f || ''));
  const fremd = await menschDuell({ vor: 10 });
  const x = await ichFertig(fremd.a, d);
  pruefe('M4: ein Fremder kann kein Duell fertig melden', /DUELL_UNBEKANNT/.test(x.f || ''), JSON.stringify(x));
  const zukunft = await menschDuell({ vor: -30 });
  const z = await ichFertig(zukunft.a, zukunft.d);
  pruefe('M4: vor dem Start gibt es kein Fertig-Melden', /DUELL_NICHT_GESTARTET/.test(z.f || ''), JSON.stringify(z));
  const ohne = await alsNutzer('', 'select public.duell_ich_fertig($1) as s', [d]);
  pruefe('M4: ohne Anmeldung kein Fertig-Melden', /DUELL_ANMELDUNG/.test(ohne.f || ''), JSON.stringify(ohne));
}
// M5) Nur A fertig, B kommt nie wieder: wie bisher nach dem Ende von B + Gnade beendet (kein Haengen, keine Abkuerzung)
{
  const { d, a } = await menschDuell({ vor: 100 });
  await ichFertig(a, d);
  pruefe('M5: nur A fertig, B noch in seiner Zeit: laeuft', (await auswerten(d)) === 'laeuft');
  await db.query(`update public.duelle set start_am = now() - interval '184 seconds' where id = $1`, [d]);
  await db.query('select public.duell_alle_faelligen_auswerten()');
  pruefe('M5: nach dem Ende von B + Gnade beendet die Sammel-Auswertung das Duell', (await status(d)) === 'beendet');
}
// M6) Freundschaft: beide fertig -> sofort beendet, auch ueber duell_faellige_auswerten
{
  const { d, a } = await menschDuell({ vor: 20, art: 'freundschaft' });
  await db.query(`update public.duell_spieler set fertig_am = now() where duell = $1`, [d]).catch(() => null);
  await db.query('select public.duell_faellige_auswerten($1)', [a]);
  pruefe('M6: Freundschaft, beide fertig: duell_faellige_auswerten beendet sofort', (await status(d)) === 'beendet');
}
// M7) Rechte: angemeldete Nutzer duerfen duell_ich_fertig, anon nicht
{
  const r = (await db.query(`select has_function_privilege('authenticated', 'public.duell_ich_fertig(uuid)', 'execute') as au,
    has_function_privilege('anon', 'public.duell_ich_fertig(uuid)', 'execute') as an`).catch((e) => ({ rows: [{ f: e.message }] }))).rows[0];
  pruefe('M7: authenticated darf duell_ich_fertig, anon nicht', r.au === true && r.an === false, JSON.stringify(r));
}
// M8) KI-Duell: Fertig-Melden beendet sofort, die KI zaehlt weiter mit ihren vollen 180 s
{
  const { d, u } = await kiDuell({ vor: 30, geloest: 2 });
  const x = await ichFertig(u, d);
  const soll = await kiBei(d, 180);
  pruefe('M8: KI-Duell, fertig gemeldet: sofort beendet, KI mit 180 s', x.r?.s?.status === 'beendet'
    && x.r?.s?.gegner?.geloest === soll.geloest, JSON.stringify(x.r?.s?.gegner || x.f));
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
    where n.nspname = 'public' and p.proname = 'duell_spieler_schluss'`)).rows[0].n;
  pruefe('Rueckweg: der neue Helfer duell_spieler_schluss ist weg', helfer === 0, helfer);
  const r27 = (await db.query(`select count(*)::int as n from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('duell_ich_fertig', 'duell_spieler_offen_bis')`)).rows[0].n;
  pruefe('Rueckweg R27: duell_ich_fertig und duell_spieler_offen_bis sind weg', r27 === 0, r27);
  {
    const { d: dm, a: am } = await menschDuell({ vor: 30 });
    await db.query('update public.duell_spieler set fertig_am = now() - interval \'5 seconds\' where duell = $1 and user_id = $2', [dm, am]);
    const z = await zug(am, dm, 29);
    pruefe('Rueckweg R27: alte Fassung nimmt Zuege trotz fertig_am wieder an', z.r?.geloest === 1, JSON.stringify(z));
    const sm = await stand(dm, am);
    pruefe('Rueckweg R27: duell_stand ohne fertig, wie in raetsel-duell-schema.sql', sm.ich && !('fertig' in sm.ich), JSON.stringify(sm.ich));
    await db.query('update public.duell_spieler set fertig_am = now() where duell = $1', [dm]);
    pruefe('Rueckweg R27: Menschen warten wieder bis zum Ende + Gnade', (await auswerten(dm)) === 'laeuft');
    globalThis.__dm = dm;
  }
  const { d } = await kiDuell({ vor: 150, fehler: 10 });
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
  pruefe('wieder vorwaerts R27: das Menschen-Duell mit beiden fertig endet jetzt sofort (Spalte blieb stehen)',
    (await auswerten(globalThis.__dm)) === 'beendet');
}

await db.close();
console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
