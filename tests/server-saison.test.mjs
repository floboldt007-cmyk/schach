// Vorschlag Saison-System (supabase/saison-schema.sql, noch nicht eingespielt, R19 14.11.2026): fuehrt die bisherigen
// Schemas und den Vorschlag WIRKLICH aus, in PGlite (ohne Netz, ohne Supabase). Eine Saison dauert 8 Wochen, Saison 1
// beginnt Montag 04.01.2027 (davor Vorsaison). Am Saisonende wird die hoechste Online-Stufe der Saison ein Abzeichen,
// wer bei Crownmate I (17) steht, bekommt "crownmaster", Top 10 und Top 100 nach Elo mit mindestens 20 Online-Partien
// in der Saison bekommen "top10" bzw. "top100"; danach sinkt die Stufe um 3 (nie unter 0), nur bei Konten mit einer
// Online-Ligawoche in der Saison. Der Gegner sieht nur das beste Abzeichen und einen selbst gewaehlten Titel.
// Die Zeit wird ueber liga_woche_heute() gestellt (Ersatz nur in diesem Test, Wert in test.heute).
// Lokal nur mit PGlite in node_modules (npm install --no-save --ignore-scripts @electric-sql/pglite@0.5.11).
//   node tests/server-saison.test.mjs
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
const ende = () => { console.log(`\n${ok}/${gesamt} bestanden`); process.exitCode = ok === gesamt ? 0 : 1; };

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
// Testuhr: die Woche kommt aus test.heute (ohne Wert die echte Woche)
const UHR = `
create or replace function public.liga_woche_heute() returns date language sql stable set search_path = '' as $$
  select coalesce(nullif(current_setting('test.heute', true), '')::date, public.liga_woche_am(now()));
$$;`;
const HEUTE = (d) => `select set_config('test.heute', '${d}', false);`;

async function lauf(db, name, sql) {
  try {
    await db.exec(sql);
    return null;
  } catch (e) {
    return `${name}: ${e.message}`;
  }
}

// wie tests/server-karte-sondertitel.test.mjs (zwei-ligen-schema.sql ist die live Fassung von liga_abrechnen)
const BISHER = ['supabase/schema.sql', 'supabase/abo-schema.sql', 'supabase/online-schema.sql', 'supabase/kronen-schema.sql',
  'supabase/raetsel-duell-schema.sql', 'supabase/raetsel-duell-daten.sql', 'supabase/karte-schema.sql',
  'supabase/liga-bild-schema.sql', 'supabase/daten-schema.sql', 'supabase/zwei-ligen-schema.sql', 'supabase/daten-schema.sql'];

const U = (n) => `a0000000-0000-4000-8000-0000000000${String(n).padStart(2, '0')}`;
const T = (n) => `b0000000-0000-4000-8000-0000000000${String(n).padStart(2, '0')}`;
const U1 = U(1), U2 = U(2), U3 = U(3), U4 = U(4), U5 = U(5);
const ALS = (uid) => `select set_config('request.jwt.claims', '{"sub":"${uid}","role":"authenticated"}', false);`;

async function neueDb({ saison = true } = {}) {
  const db = new PGlite();
  let f = await lauf(db, 'Attrappe', ATTRAPPE);
  for (const d of BISHER) f = f || await lauf(db, d, lies(d));
  if (saison) f = f || await lauf(db, 'saison-schema.sql', lies('supabase/saison-schema.sql'));
  f = f || await lauf(db, 'Testuhr', UHR);
  return { db, fehler: f };
}

// Lage zum Ende von Saison 1 (letzte Woche 22.02.2027):
//   U1 Stufe 13, Woche 1 in Gruppe 12 (abgerechnet), letzte Woche in Gruppe 13 NOCH OFFEN mit Platz 1 (-> 14)
//   U2 Stufe 17 (Crownmate I), Woche 3 in Gruppe 17      U3 Stufe 5, nur Vorsaison (28.12.2026)
//   U4 Stufe 4, Woche 5 in Gruppe 4 (Pause danach)       U5 Stufe 1, Woche 2 in Gruppe 1 (Boden 0)
//   T1..T11 je 20 Online-Partien in Saison 1, Elo 2500 absteigend, T9 und T10 gleich (2420); T12 Elo 3000 mit 19;
//   T13 Elo 2990 mit 10 in Saison 1 und 15 in der Vorsaison
async function lage(db) {
  const top = Array.from({ length: 13 }, (_, i) => i + 1);
  const elo = (n) => (n === 12 ? 3000 : n === 13 ? 2990 : n === 10 ? 2420 : 2500 - (n - 1) * 10);
  await db.exec(`
  insert into auth.users (id, email) values ${[1, 2, 3, 4, 5].map((n) => `('${U(n)}', 'u${n}@x')`).join(', ')},
    ${top.map((n) => `('${T(n)}', 't${n}@x')`).join(', ')};
  insert into public.kronen_stand (user_id, stufe) values ('${U1}', 13), ('${U2}', 17), ('${U3}', 5), ('${U4}', 4), ('${U5}', 1);
  insert into public.kronen_stand (user_id, stufe, elo, elo_n) values ${top.map((n) => `('${T(n)}', 3, ${elo(n)}, 30)`).join(', ')};
  create table test_g (art text primary key, id bigint);
  with g as (insert into public.liga_gruppen (woche, stufe, abgerechnet) values
      ('2027-01-04', 12, true), ('2027-02-22', 13, false), ('2027-01-18', 17, true), ('2026-12-28', 5, true),
      ('2027-02-01', 4, true), ('2027-01-11', 1, true) returning id, woche, stufe)
  insert into test_g select woche::text || '/' || stufe, id from g;
  insert into public.liga_mitglieder (gruppe, user_id, woche, kronen) values
    ((select id from test_g where art = '2027-01-04/12'), '${U1}', '2027-01-04', 50),
    ((select id from test_g where art = '2027-02-22/13'), '${U1}', '2027-02-22', 100000),
    ((select id from test_g where art = '2027-01-18/17'), '${U2}', '2027-01-18', 50),
    ((select id from test_g where art = '2026-12-28/5'), '${U3}', '2026-12-28', 50),
    ((select id from test_g where art = '2027-02-01/4'), '${U4}', '2027-02-01', 50),
    ((select id from test_g where art = '2027-01-11/1'), '${U5}', '2027-01-11', 50);
  `);
  const buchungen = [];
  for (const n of top) {
    const anzahl = n === 12 ? 19 : n === 13 ? 10 : 20;
    for (let i = 1; i <= anzahl; i++) buchungen.push(`('${T(n)}', 'online', 's1-${i}', 5, '2027-01-11')`);
    if (n === 13) for (let i = 1; i <= 15; i++) buchungen.push(`('${T(n)}', 'online', 'v-${i}', 5, '2026-12-21')`);
  }
  await db.exec(`insert into public.kronen_buchungen (user_id, quelle, ref, delta, woche) values ${buchungen.join(', ')};`);
}

async function als(db, uid, sql) {
  await db.exec((uid ? ALS(uid) + 'set role authenticated;' : 'set role anon;'));
  try {
    return (await db.query(sql)).rows[0];
  } catch (e) {
    return { fehler: e.message };
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claims', '', false);`);
  }
}
const wert = async (db, sql) => (await db.query(sql)).rows[0];
const stufe = async (db, uid) => (await wert(db, `select stufe from public.kronen_stand where user_id = '${uid}'`)).stufe;
const abzeichen = async (db, uid) => (await db.query(`select saison, stufe from public.saison_abzeichen where user_id = '${uid}' order by saison`)).rows;
const titelVon = async (db, uid) => (await db.query(`select saison, art from public.saison_titel where user_id = '${uid}' order by saison, art`)).rows
  .map((r) => `${r.art}-s${r.saison}`);

// ---------- 1. Funktionskoerper: eine Datei zum Einspielen, der Haken auch in den beiden bisherigen ----------
{
  const koerper = (datei) => {
    const s = lies(datei);
    const a = s.indexOf('create or replace function public.liga_abrechnen()');
    return a < 0 ? null : s.slice(a, s.indexOf('$$;', s.indexOf('$$', a) + 2) + 3);
  };
  const saison = koerper('supabase/saison-schema.sql');
  const zwei = koerper('supabase/zwei-ligen-schema.sql');
  const kronen = koerper('supabase/kronen-schema.sql');
  pruefe('saison-schema.sql bringt liga_abrechnen mit (Flo spielt nur eine Datei ein)', !!saison);
  pruefe('liga_abrechnen in saison-schema.sql == zwei-ligen-schema.sql (live Fassung), zeichengleich', !!saison && saison === zwei);
  const haken = /if pg_catalog\.to_regprocedure\('public\.saison_abrechnen\(\)'\) is not null then\s+perform public\.saison_abrechnen\(\);\s+end if;/g;
  for (const [n, k] of [['zwei-ligen', zwei], ['kronen', kronen]]) {
    pruefe(`${n}-schema.sql: Haken zweimal (Fruehausstieg und vor dem Loeschen)`, !!k && (k.match(haken) || []).length === 2);
    pruefe(`${n}-schema.sql: Haken vor liga_alte_wochen_loeschen und vor dem return des Fruehausstiegs`, !!k
      && /saison_abrechnen\(\);\s+end if;\s+return;/.test(k) && /saison_abrechnen\(\);\s+end if;\s+(?:--[^\n]*\n\s*)*perform public\.liga_alte_wochen_loeschen\(\);/.test(k));
  }
  {
    // der Rueckweg traegt die live Fassung OHNE Haken: zeichengleich mit zwei-ligen-schema.sql nach Entfernen der Hakenbloecke
    const z = koerper('supabase/saison-zurueck.sql');
    const ohne = zwei && zwei.replace(/\n {2,4}-- Saison[^\n]*\n {2,4}if pg_catalog\.to_regprocedure\('public\.saison_abrechnen\(\)'\) is not null then\n\s+perform public\.saison_abrechnen\(\);\n {2,4}end if;/g, '');
    pruefe('saison-zurueck.sql: liga_abrechnen = live Fassung ohne Haken, zeichengleich', !!z && z === ohne && !z.includes('saison_abrechnen'));
  }
  const kopf = lies('supabase/saison-schema.sql').split('\n').slice(0, 3).join('\n');
  pruefe('Kopf: VORSCHLAG, NOCH NICHT EINGESPIELT, Einspielen Flo, nie Claude', /VORSCHLAG, NOCH NICHT EINGESPIELT/.test(kopf) && /Flo, nie Claude/.test(kopf), kopf);
}

// ---------- 2. Ablauf Saison 1 ----------
{
  const { db, fehler } = await neueDb();
  pruefe('bisherige Schemas und der Vorschlag laufen', !fehler, fehler);
  if (fehler) { ende(); process.exit(1); }
  await lage(db);

  const nr = await wert(db, `select public.saison_nummer('2026-12-28') a, public.saison_nummer('2027-01-04') b,
    public.saison_nummer('2027-02-22') c, public.saison_nummer('2027-03-01') d`);
  pruefe('Saisonnummer: Vorsaison 0, 04.01.2027 = 1, 22.02.2027 = 1, 01.03.2027 = 2', nr.a === 0 && nr.b === 1 && nr.c === 1 && nr.d === 2, JSON.stringify(nr));

  // Vorsaison und laufende Saison: nichts wird abgerechnet
  await db.exec(HEUTE('2027-02-22'));
  await als(db, U3, 'select public.saison_mein_stand() s');
  pruefe('waehrend Saison 1: keine Saison-Abrechnung', (await wert(db, 'select count(*)::int n from public.saison_abrechnungen')).n === 0);
  pruefe('waehrend Saison 1: U3 (Stufe 5) unveraendert', await stufe(db, U3) === 5);

  // erste Woche von Saison 2: der echte Weg (saison_mein_stand -> kronen_stand_sichern -> liga_abrechnen)
  await db.exec(HEUTE('2027-03-01'));
  const st = await als(db, U3, 'select public.saison_mein_stand() s');
  pruefe('saison_mein_stand antwortet', !st.fehler && st.s, JSON.stringify(st));
  pruefe('Saison 1 einmal abgerechnet', JSON.stringify((await db.query('select saison from public.saison_abrechnungen')).rows) === '[{"saison":1}]');
  pruefe('U1: Abzeichen 14, weil die letzte Woche VOR der Saison abgerechnet wird (13 -> 14)', JSON.stringify(await abzeichen(db, U1)) === '[{"saison":1,"stufe":14}]', JSON.stringify(await abzeichen(db, U1)));
  pruefe('U1: Stufe 14 - 3 = 11 (der Aufstieg der letzten Woche hebt den Reset nicht auf)', await stufe(db, U1) === 11, await stufe(db, U1));
  pruefe('U2: Abzeichen 17 und crownmaster-s1', JSON.stringify(await abzeichen(db, U2)) === '[{"saison":1,"stufe":17}]'
    && JSON.stringify(await titelVon(db, U2)) === '["crownmaster-s1"]', JSON.stringify(await titelVon(db, U2)));
  pruefe('U2: Stufe 17 - 3 = 14', await stufe(db, U2) === 14);
  pruefe('U3 (nur Vorsaison): kein Abzeichen, kein Reset', (await abzeichen(db, U3)).length === 0 && await stufe(db, U3) === 5);
  pruefe('U5: Boden Squire III (1 - 3 -> 0), Abzeichen 1', await stufe(db, U5) === 0 && JSON.stringify(await abzeichen(db, U5)) === '[{"saison":1,"stufe":1}]');
  pruefe('U4: Reset 4 -> 1', await stufe(db, U4) === 1);
  pruefe('Crownmaster nur bei Stufe 17', (await wert(db, `select count(*)::int n from public.saison_titel where art = 'crownmaster'`)).n === 1);

  const top10 = [];
  for (let n = 1; n <= 10; n++) top10.push(JSON.stringify(await titelVon(db, T(n))));
  pruefe('T1 bis T10 top10-s1 (T9 und T10 gleiche Elo, beide Rang 9)', top10.every((x) => x === '["top10-s1"]'), top10.join(' '));
  pruefe('T11 (Rang 11) top100-s1', JSON.stringify(await titelVon(db, T(11))) === '["top100-s1"]', JSON.stringify(await titelVon(db, T(11))));
  pruefe('T12 (Elo 3000, 19 Partien) kein Titel', (await titelVon(db, T(12))).length === 0);
  pruefe('T13 (10 in der Saison, 15 in der Vorsaison) kein Titel', (await titelVon(db, T(13))).length === 0);
  pruefe('Elo nie zurueckgesetzt', (await wert(db, `select elo from public.kronen_stand where user_id = '${T(1)}'`)).elo === 2500);
  pruefe('Top-Konten ohne Ligawoche: Stufe unveraendert (3)', await stufe(db, T(1)) === 3);

  // idempotent
  await db.exec('select public.liga_abrechnen()');
  await als(db, U1, 'select public.saison_mein_stand() s');
  pruefe('zweimal abrechnen = einmal (U1 bleibt 11, eine Abrechnung)', await stufe(db, U1) === 11
    && (await wert(db, 'select count(*)::int n from public.saison_abrechnungen')).n === 1);

  // Saison 2: U2 spielt eine Woche (Gruppe 14), U4 macht Pause; erst in Saison 3 wieder ein Abruf
  await db.exec(`with g as (insert into public.liga_gruppen (woche, stufe, abgerechnet) values ('2027-03-01', 14, true) returning id)
    insert into public.liga_mitglieder (gruppe, user_id, woche, kronen) select id, '${U2}', '2027-03-01', 50 from g;`);
  await db.exec(HEUTE('2027-05-03'));
  await als(db, U4, 'select public.saison_mein_stand() s');
  pruefe('Saison 2 abgerechnet (der Fruehausstieg ohne offene Woche ruft den Haken)', JSON.stringify((await db.query('select saison from public.saison_abrechnungen order by 1')).rows) === '[{"saison":1},{"saison":2}]');
  pruefe('U4 Pause ueber Saison 2: genau ein Reset (bleibt 1), kein Abzeichen 2', await stufe(db, U4) === 1 && (await abzeichen(db, U4)).length === 1);
  pruefe('U2 Saison 2: Abzeichen 14, kein crownmaster-s2, Stufe 11', JSON.stringify(await abzeichen(db, U2)) === '[{"saison":1,"stufe":17},{"saison":2,"stufe":14}]'
    && JSON.stringify(await titelVon(db, U2)) === '["crownmaster-s1"]' && await stufe(db, U2) === 11);

  // eigener Stand
  {
    const r = (await als(db, U2, 'select public.saison_mein_stand() s')).s;
    pruefe('saison_mein_stand: Saison 3, Woche 2 von 8, Ende 2027-06-20', r?.saison === 3 && r?.woche === 2 && r?.ende === '2027-06-20', JSON.stringify(r));
    pruefe('saison_mein_stand: Stufe nach dem Reset (11), ohne Ligawoche in Saison 3 kein "bisher"', r?.stufe === 11 && r?.bisher === null, JSON.stringify(r));
    pruefe('saison_mein_stand: eigene Abzeichen und Titel, nichts gewaehlt', (r?.abzeichen || []).map((a) => `${a.saison}:${a.stufe}`).join() === '1:17,2:14'
      && JSON.stringify(r?.titel) === '["crownmaster-s1"]' && r?.gewaehlt === null, JSON.stringify(r));
    pruefe('saison_mein_stand: ohne Konto-Kennung', !JSON.stringify(r).includes(U2));
  }

  // Titel waehlen
  {
    const w = (uid, t) => als(db, uid, `select public.saison_titel_waehle(${t === null ? 'null' : `'${t}'`}) r`);
    const a = await w(U2, 'crownmaster-s1');
    pruefe('U2 waehlt crownmaster-s1: angenommen', a?.r?.titel === 'crownmaster-s1', JSON.stringify(a));
    const b = await w(U3, 'crownmaster-s1');
    pruefe('U3 waehlt fremden Titel: SAISON_TITEL', /SAISON_TITEL/.test(b?.fehler || ''), JSON.stringify(b));
    const c = await w(U2, 'top10-s1');
    pruefe('U2 waehlt nicht verdienten Titel: SAISON_TITEL', /SAISON_TITEL/.test(c?.fehler || ''), JSON.stringify(c));
    const d = await w(U2, 'crownmaster-s1; drop table public.saison_wahl');
    pruefe('Unsinn: SAISON_TITEL, Tabelle bleibt', /SAISON_TITEL/.test(d?.fehler || '') && !!(await wert(db, `select to_regclass('public.saison_wahl') t`)).t);
    const e = await w(U2, null);
    pruefe('null nimmt den Titel ab', e?.r?.titel === null && !e.fehler, JSON.stringify(e));
    await w(U2, 'crownmaster-s1');
  }

  // Visitenkarte: Partie U2 (Weiss) gegen T1 (Schwarz)
  await db.exec(`
  create table test_p (id uuid);
  with p as (insert into public.partien_online (erstellt_von, fen, bedenkzeit_s, inkrement_s) values ('${U2}', 'x', 300, 3) returning id)
  insert into test_p select id from p;
  update public.partien_online set status = 'laeuft', letzter_zug_am = now(), gewertet = true, weiss = '${U2}', schwarz = '${T(1)}';
  grant select on test_p to authenticated, anon;`);
  const pid = (await wert(db, 'select id from test_p')).id;
  {
    const r = await als(db, T(1), `select public.saison_karte_der_partie('${pid}') k`);
    const k = r?.k;
    pruefe('Gegner sieht bei U2 das BESTE Abzeichen (Saison 1, 17) und den gewaehlten Titel', k?.w?.abzeichen?.saison === 1 && k.w.abzeichen.stufe === 17 && Object.keys(k.w.abzeichen).length === 2 && k?.w?.titel === 'crownmaster-s1', JSON.stringify(r));
    pruefe('Felder je Seite genau abzeichen, du, titel (keine Liste, keine Kronen, keine Partienzahl)',
      JSON.stringify(Object.keys(k?.w || {}).sort()) === '["abzeichen","du","titel"]' && JSON.stringify(Object.keys(k?.s || {}).sort()) === '["abzeichen","du","titel"]', JSON.stringify(k));
    pruefe('T1 ohne Ligawoche: kein Abzeichen; Titel nur gewaehlt (T1 hat top10-s1, nicht gewaehlt)', k?.s?.abzeichen === null && k?.s?.titel === null, JSON.stringify(k?.s));
    pruefe('ohne Konto-Kennung', !JSON.stringify(k).includes(U2) && !JSON.stringify(k).includes(T(1)));
    const c = await als(db, U3, `select public.saison_karte_der_partie('${pid}') k`);
    pruefe('Unbeteiligte: SAISON_KEINE_PARTIE', /SAISON_KEINE_PARTIE/.test(c?.fehler || ''), JSON.stringify(c));
    const an = await als(db, null, `select public.saison_karte_der_partie('${pid}') k`);
    pruefe('anon: abgewiesen', !!an?.fehler, JSON.stringify(an));
  }
  // Titel, der nicht mehr im Besitz ist, zeigt nichts
  await db.exec(`delete from public.saison_titel where user_id = '${U2}'`);
  {
    const k = (await als(db, T(1), `select public.saison_karte_der_partie('${pid}') k`))?.k;
    pruefe('gewaehlter Titel ohne Besitz: Gegner sieht keinen Titel', k?.w?.titel === null, JSON.stringify(k?.w));
  }

  // Rechte
  for (const t of ['saison_abzeichen', 'saison_titel', 'saison_wahl', 'saison_abrechnungen']) {
    const r = await als(db, U2, `select count(*) n from public.${t}`);
    pruefe(`${t}: kein direktes Lesen`, !!r?.fehler, JSON.stringify(r));
  }
  const ins = await als(db, U2, `insert into public.saison_abzeichen (user_id, saison, stufe) values ('${U2}', 9, 17)`);
  pruefe('saison_abzeichen: kein direktes Schreiben', !!ins?.fehler);
  for (const f of ['saison_mein_stand()', `saison_titel_waehle(null)`]) {
    const r = await als(db, null, `select public.${f} r`);
    pruefe(`anon: ${f} abgewiesen`, !!r?.fehler, JSON.stringify(r));
  }
  const ab = await als(db, U2, 'select public.saison_abrechnen() r');
  pruefe('saison_abrechnen nur intern (authenticated abgewiesen)', !!ab?.fehler, JSON.stringify(ab));

  // Datenauskunft und Loeschung
  {
    const d = (await als(db, U2, 'select public.meine_daten() d'))?.d;
    pruefe('Datenauskunft nennt Abzeichen, Titel und Wahl der Saison', d?.saison && d.saison.abzeichen?.length === 2 && 'titel' in d.saison && d.saison.gewaehlt === 'crownmaster-s1', JSON.stringify(d?.saison));
  }
  await db.exec(`delete from auth.users where id = '${U2}'`);
  const rest = await wert(db, `select (select count(*) from public.saison_abzeichen where user_id = '${U2}')
    + (select count(*) from public.saison_wahl where user_id = '${U2}') n`);
  pruefe('Konto geloescht: Abzeichen und Wahl weg', Number(rest.n) === 0, rest.n);

  // Rueckweg
  const z = await lauf(db, 'saison-zurueck.sql', lies('supabase/saison-zurueck.sql'));
  pruefe('saison-zurueck.sql laeuft', !z, z);
  const weg = await wert(db, `select to_regclass('public.saison_abzeichen') a, to_regclass('public.saison_titel') b,
    to_regclass('public.saison_wahl') c, to_regclass('public.saison_abrechnungen') d, to_regprocedure('public.saison_abrechnen()') e,
    to_regprocedure('public.saison_karte_der_partie(uuid)') f`);
  pruefe('Rueckweg: Tabellen und Funktionen weg', Object.values(weg).every((v) => v === null), JSON.stringify(weg));
  const lz = (await db.query(`select prosrc from pg_proc where proname = 'liga_abrechnen'`)).rows[0]?.prosrc || '';
  pruefe('Rueckweg: liga_abrechnen wieder die live Fassung ohne Haken', !lz.includes('saison_abrechnen') && lz.includes("g.liga = 'raetsel'"));
  await db.exec(HEUTE('2027-07-05'));
  const nach = await lauf(db, 'liga_abrechnen nach Rueckweg', 'select public.liga_abrechnen();');
  pruefe('liga_abrechnen laeuft nach dem Rueckweg', !nach, nach);
  const wieder = await lauf(db, 'saison-schema.sql erneut', lies('supabase/saison-schema.sql'));
  pruefe('saison-schema.sql danach wieder einspielbar', !wieder, wieder);
}

// ---------- 3. Ohne den Vorschlag: liga_abrechnen wie bisher ----------
{
  const { db, fehler } = await neueDb({ saison: false });
  pruefe('bisherige Schemas mit Haken laufen ohne saison-schema.sql', !fehler, fehler);
  if (!fehler) {
    await lage(db);
    await db.exec(HEUTE('2027-03-01'));
    const f = await lauf(db, 'liga_abrechnen', 'select public.liga_abrechnen();');
    pruefe('ohne Saison: liga_abrechnen fehlerfrei, U1 steigt 13 -> 14, U2 bleibt 17', !f && await stufe(db, U1) === 14 && await stufe(db, U2) === 17, f);
  }
}

// ---------- 3b. Last (Plan-Review 26, Befund 1): ohne faellige Saison keine globale Sperre ----------
{
  const { db, fehler } = await neueDb();
  if (!fehler) {
    await lage(db);
    const sperren = async (heute) => {
      await db.exec('begin;' + HEUTE(heute));
      await db.exec('select public.saison_abrechnen();');
      const n = (await wert(db, `select count(*)::int n from pg_locks where locktype = 'advisory'`)).n;
      await db.exec('commit;');
      return n;
    };
    pruefe('Vorsaison: saison_abrechnen nimmt keine Sperre', await sperren('2026-12-28') === 0);
    pruefe('laufende Saison 1: keine Sperre', await sperren('2027-02-22') === 0);
    pruefe('Gegenprobe: Saison 1 faellig -> Sperre genommen', await sperren('2027-03-01') === 1);
    pruefe('Saison 1 abgerechnet: danach wieder ohne Sperre', await sperren('2027-03-08') === 0);
  } else pruefe('Last-Probe: Schemas laufen', false, fehler);
}

// ---------- 3c. Rueckweg der Datenauskunft (Plan-Review 26, Befund 2): erzwungene Reihenfolge ----------
{
  const { db, fehler } = await neueDb();
  const a = fehler || await lauf(db, 'daten-auskunft-zurueck.sql', lies('supabase/daten-auskunft-zurueck.sql'));
  pruefe('daten-auskunft-zurueck.sql bricht ab, solange die Saison eingespielt ist', /ZUERST supabase\/saison-zurueck\.sql/.test(a || ''), a);
  const z = fehler || await lauf(db, 'saison-zurueck.sql', lies('supabase/saison-zurueck.sql'));
  const b = z || await lauf(db, 'daten-auskunft-zurueck.sql', lies('supabase/daten-auskunft-zurueck.sql'));
  pruefe('nach saison-zurueck.sql laeuft daten-auskunft-zurueck.sql', !b, b);
  const v = fehler || await lauf(db, 'daten-verwaltung-zurueck.sql', lies('supabase/daten-verwaltung-zurueck.sql'));
  pruefe('daten-verwaltung-zurueck.sql traegt den Saison-Block (Auskunft verliert die Saison nicht)', !v && /'saison', saison/.test(lies('supabase/daten-verwaltung-zurueck.sql')), v);
}

// ---------- 4. Die Probe fuer den SQL Editor (saison-rls-test.sql) laeuft durch und rollt zurueck ----------
{
  const { db, fehler } = await neueDb();
  const meldungen = [];
  const f = fehler || await (async () => {
    try { await db.exec(lies('supabase/saison-rls-test.sql')); return null; } catch (e) { return e.message; }
  })();
  pruefe('saison-rls-test.sql: ohne FEHLER', !f, f);
  const rest = !f && await wert(db, `select count(*)::int n from auth.users`);
  pruefe('saison-rls-test.sql: rollt zurueck (keine Testkonten bleiben)', !f && rest.n === 0, JSON.stringify(rest) + meldungen.join());
}

// ---------- 5. Ohne zwei-ligen-schema.sql bricht der Vorschlag mit klarer Meldung ab ----------
{
  const db = new PGlite();
  let f = await lauf(db, 'Attrappe', ATTRAPPE);
  for (const d of BISHER.filter((x) => !x.includes('zwei-ligen'))) f = f || await lauf(db, d, lies(d));
  const s = await lauf(db, 'saison-schema.sql', lies('supabase/saison-schema.sql'));
  pruefe('ohne zwei-ligen-schema.sql: Abbruch mit Hinweis', !f && /zwei-ligen-schema\.sql/.test(s || ''), f || s);
}

ende();
