// Verwaltung fuer Flo (G-006 M3, supabase/verwaltung-schema.sql, noch nicht eingespielt): fuehrt alle Schemata in der
// Reihenfolge von supabase/ANLEITUNG.md und dann den Vorschlag WIRKLICH aus, in PGlite (ohne Netz, ohne Supabase).
// Prueft: nur Konten in public.verwalter kommen an die Funktionen (anon und normale Konten bekommen VERWALTUNG_KEIN_RECHT),
// Kontoliste (AC-06), Premium an und zurueck ohne ein laufendes Stripe-Abo anzufassen (AC-07), Kaeufe nur lesend
// (AC-08), Name und Banner (AC-09), Protokoll, verwaltung-rls-test.sql und der Rueckweg.
// Lokal nur mit PGlite in node_modules (npm install --no-save --ignore-scripts @electric-sql/pglite@0.5.11).
//   node tests/server-verwaltung.test.mjs
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

// Wie tests/server-daten.test.mjs: auth.users mit den Spalten, die die Kontoliste liest
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

const SCHEMATA = ['schema', 'online-schema', 'freunde-schema', 'abo-schema', 'werkstatt-schema', 'pionier-schema',
  'coach-schema', 'schule-schema', 'kronen-schema', 'zaehler-schema', 'karte-schema', 'raetsel-duell-schema',
  'liga-bild-schema', 'zwei-ligen-schema', 'daten-schema'];

async function lauf(db, name, sql) {
  try {
    await db.exec(sql);
    return null;
  } catch (e) {
    return `${name}: ${e.message}`;
  }
}

const F = 'f1000000-0000-4000-8000-0000000000f1'; // Flo, Verwalter
const A = 'a1000000-0000-4000-8000-0000000000a1';
const B = 'b2000000-0000-4000-8000-0000000000b2';
const S = 'c3000000-0000-4000-8000-0000000000c3'; // laufendes Stripe-Abo
const ALS = (uid) => `select set_config('request.jwt.claims', '{"sub":"${uid}","role":"authenticated"}', false);`;

const db = new PGlite();
let f = await lauf(db, 'Attrappe', ATTRAPPE);
for (const d of SCHEMATA) f = f || await lauf(db, d, lies(`supabase/${d}.sql`));
pruefe('bisherige Schemata laufen', !f, f);
f = f || await lauf(db, 'verwaltung-schema.sql', lies('supabase/verwaltung-schema.sql'));
pruefe('verwaltung-schema.sql laeuft', !f, f);
if (f) { console.log(`\n${ok}/${gesamt} bestanden`); process.exit(1); }
f = await lauf(db, 'verwaltung-schema.sql (zweites Mal)', lies('supabase/verwaltung-schema.sql'));
pruefe('verwaltung-schema.sql ist wiederholbar', !f, f);

await db.exec(`
insert into auth.users (id, email, created_at, last_sign_in_at, raw_app_meta_data) values
  ('${F}', 'flo@x.de', now() - interval '30 days', now(), '{"provider":"google"}'),
  ('${A}', 'anna@x.de', now() - interval '2 days', now() - interval '1 day', '{"provider":"email"}'),
  ('${B}', 'ben@x.de', now() - interval '1 hour', null, '{"provider":"email"}'),
  ('${S}', 'stripe@x.de', now() - interval '10 days', now(), '{"provider":"google"}');
insert into public.profile (user_id, benutzername) values ('${A}', 'Anna_1'), ('${S}', 'Kunde_S');
insert into public.abos (user_id, status, gueltig_bis, quelle, kunde_id, abo_id)
  values ('${S}', 'aktiv', now() + interval '20 days', 'stripe', 'cus_Probe1', 'sub_Probe1');
insert into public.verwalter (user_id) values ('${F}');
`);

// Aufruf als Rolle (anon, Konto oder Verwalter); Fehler kommen als { fehler }
async function als(uid, sql) {
  await db.exec(uid ? ALS(uid) + 'set role authenticated;' : "select set_config('request.jwt.claims', '', false); set role anon;");
  try {
    return (await db.query(sql)).rows[0];
  } catch (e) {
    return { fehler: e.message };
  } finally {
    await db.exec('reset role;');
  }
}
const wert = async (uid, sql) => { const r = await als(uid, `select ${sql} as w`); return r.fehler ? r : r.w; };

// ---------- Rechte ----------
const AUFRUFE = [
  `public.verwaltung_konten()`,
  `public.verwaltung_konten('anna', 10)`,
  `public.verwaltung_kaeufe('${A}')`,
  `public.verwaltung_premium('${A}', now() + interval '7 days')`,
  `public.verwaltung_name('${A}', 'Gekapert')`,
  `public.verwaltung_banner('${A}', 'saison-gold', true)`,
  `public.verwaltung_protokoll_lesen()`,
];
for (const a of AUFRUFE) {
  const normal = await wert(A, a);
  pruefe(`normales Konto abgewiesen: ${a.split('(')[0]}`, /VERWALTUNG_KEIN_RECHT/.test(normal?.fehler || ''), JSON.stringify(normal));
  const anon = await wert(null, a);
  pruefe(`anon abgewiesen: ${a.split('(')[0]}`, /permission denied|VERWALTUNG_KEIN_RECHT/.test(anon?.fehler || ''), JSON.stringify(anon));
}
pruefe('ist_verwalter: Konto A nein', (await wert(A, 'public.ist_verwalter()')) === false);
pruefe('ist_verwalter: Flo ja', (await wert(F, 'public.ist_verwalter()')) === true);
{
  const r = await als(A, `select count(*)::int as n from public.verwalter`);
  pruefe('Tabelle verwalter fuer Konten nicht lesbar', r.fehler || r.n === 0, JSON.stringify(r));
  const w = await als(A, `insert into public.verwalter (user_id) values ('${A}') returning user_id`);
  pruefe('Konto kann sich nicht selbst eintragen', !!w.fehler, JSON.stringify(w));
  const p = await als(A, `select count(*)::int as n from public.verwaltung_protokoll`);
  pruefe('Protokoll fuer Konten nicht lesbar', p.fehler || p.n === 0, JSON.stringify(p));
}
{
  const r = await db.query(`select has_function_privilege('anon', 'public.verwaltung_konten(text, integer)', 'execute') as anon,
    has_function_privilege('authenticated', 'public.verwaltung_konten(text, integer)', 'execute') as auth`);
  pruefe('Rechte verwaltung_konten: anon nein, authenticated ja', r.rows[0].anon === false && r.rows[0].auth === true, JSON.stringify(r.rows[0]));
}

// ---------- AC-06 Kontoliste ----------
{
  const k = await wert(F, 'public.verwaltung_konten()');
  pruefe('Kontoliste: alle vier Konten', Array.isArray(k) && k.length === 4, JSON.stringify(k));
  pruefe('Kontoliste: neueste zuerst (Ben)', k?.[0]?.user_id === B, JSON.stringify(k?.[0]));
  const anna = k?.find?.((x) => x.user_id === A);
  pruefe('Kontoliste: E-Mail, Name, Anbieter, letzte Anmeldung',
    anna?.email === 'anna@x.de' && anna?.benutzername === 'Anna_1' && anna?.anbieter === 'email' && !!anna?.zuletzt && !!anna?.angelegt,
    JSON.stringify(anna));
  const s = k?.find?.((x) => x.user_id === S);
  pruefe('Kontoliste: Premium-Stand des Stripe-Kunden', s?.premium === true && s?.abo_quelle === 'stripe', JSON.stringify(s));
  pruefe('Kontoliste: keine Stripe-Kennungen', !JSON.stringify(k).includes('cus_') && !JSON.stringify(k).includes('sub_'));
  const such = await wert(F, `public.verwaltung_konten('ANNA')`);
  pruefe('Suche nach Teil der E-Mail, ohne Gross/Klein', such?.length === 1 && such[0].user_id === A, JSON.stringify(such));
  const name = await wert(F, `public.verwaltung_konten('kunde_')`);
  pruefe('Suche nach Benutzername', name?.length === 1 && name[0].user_id === S, JSON.stringify(name));
  const joker = await wert(F, `public.verwaltung_konten('%')`);
  pruefe('Suche: % ist kein Joker', Array.isArray(joker) && joker.length === 0, JSON.stringify(joker));
  const zwei = await wert(F, `public.verwaltung_konten(null, 2)`);
  pruefe('Grenze wirkt', zwei?.length === 2, JSON.stringify(zwei));
}

// ---------- AC-07 Premium ----------
const premium = async (uid) => (await db.query(`select public.ist_premium_von('${uid}') as p`)).rows[0].p;
{
  pruefe('vorher: A ohne Premium', (await premium(A)) === false);
  const r = await wert(F, `public.verwaltung_premium('${A}', now() + interval '30 days')`);
  pruefe('Premium an: A hat Premium', !r?.fehler && (await premium(A)) === true, JSON.stringify(r));
  const z = (await db.query(`select status, quelle from public.abos where user_id = '${A}'`)).rows[0];
  pruefe('Premium an: Quelle manuell, Status aktiv', z?.quelle === 'manuell' && z?.status === 'aktiv', JSON.stringify(z));
  const zurueck = await wert(F, `public.verwaltung_premium('${A}', null)`);
  pruefe('Premium zurueck: A ohne Premium', !zurueck?.fehler && (await premium(A)) === false, JSON.stringify(zurueck));
  const v = await wert(F, `public.verwaltung_premium('${A}', now() - interval '1 day')`);
  pruefe('Datum in der Vergangenheit abgewiesen', /VERWALTUNG_DATUM/.test(v?.fehler || ''), JSON.stringify(v));
  const s1 = await wert(F, `public.verwaltung_premium('${S}', null)`);
  const s2 = await wert(F, `public.verwaltung_premium('${S}', now() + interval '400 days')`);
  const sz = (await db.query(`select status, quelle, kunde_id, abo_id from public.abos where user_id = '${S}'`)).rows[0];
  pruefe('laufendes Stripe-Abo: zuruecknehmen abgewiesen', /VERWALTUNG_STRIPE_ABO/.test(s1?.fehler || ''), JSON.stringify(s1));
  pruefe('laufendes Stripe-Abo: ueberschreiben abgewiesen', /VERWALTUNG_STRIPE_ABO/.test(s2?.fehler || ''), JSON.stringify(s2));
  pruefe('laufendes Stripe-Abo unberuehrt', sz?.quelle === 'stripe' && sz?.status === 'aktiv' && sz?.kunde_id === 'cus_Probe1'
    && (await premium(S)) === true, JSON.stringify(sz));
  const u = await wert(F, `public.verwaltung_premium('99999999-0000-4000-8000-000000000099', now() + interval '1 day')`);
  pruefe('unbekanntes Konto abgewiesen', /VERWALTUNG_KEIN_KONTO/.test(u?.fehler || ''), JSON.stringify(u));
  // Kriterien-Review 13.11.: ohne Ziel ein eigener Code statt des rohen Datenbank-Fehlers, bei jeder Funktion mit Ziel
  for (const aufruf of [`verwaltung_kaeufe(null)`, `verwaltung_premium(null, now() + interval '1 day')`,
    `verwaltung_name(null, 'Niemand_1')`, `verwaltung_banner(null, 'saison-gold', true)`]) {
    const n = await wert(F, `public.${aufruf}`);
    pruefe(`${aufruf.split('(')[0]}(null): VERWALTUNG_KEIN_KONTO`, /VERWALTUNG_KEIN_KONTO/.test(n?.fehler || '') && !/violates|null value/.test(n?.fehler || ''),
      JSON.stringify(n));
  }
}

// ---------- AC-08 Kaeufe (nur lesend) ----------
{
  await db.exec(`
insert into public.editionen (produkt_id, name, auflage, verkauf_ab, verkauf_bis)
  values ('ed-probe', 'Probe-Edition', 10, now() - interval '1 day', now() + interval '9 days');
with r as (insert into public.reservierungen (produkt_id, user_id, status) values ('ed-probe', '${S}', 'bezahlt') returning id)
insert into public.besitz (produkt_id, nummer, user_id, reservierung_id) select 'ed-probe', 1, '${S}', id from r;
`);
  const vorher = (await db.query(`select count(*)::int as n from public.besitz`)).rows[0].n;
  const k = await wert(F, `public.verwaltung_kaeufe('${S}')`);
  pruefe('Kaeufe: Abo mit Quelle Stripe', k?.abo?.quelle === 'stripe' && k?.premium === true && k?.abo?.stripe_kunde === true, JSON.stringify(k));
  pruefe('Kaeufe: Edition mit Name und Nummer', k?.editionen?.length === 1 && k.editionen[0].name === 'Probe-Edition'
    && k.editionen[0].nummer === 1 && k.editionen[0].status === 'aktiv', JSON.stringify(k?.editionen));
  pruefe('Kaeufe: keine Stripe-Kennungen', !JSON.stringify(k).includes('cus_') && !JSON.stringify(k).includes('sub_'));
  pruefe('Kaeufe: nichts veraendert', (await db.query(`select count(*)::int as n from public.besitz`)).rows[0].n === vorher);
  const kz = await wert(F, 'public.verwaltung_konten()');
  pruefe('Kontoliste zaehlt den Kauf', kz?.find?.((x) => x.user_id === S)?.kaeufe === 1, JSON.stringify(kz));
  const leer = await wert(F, `public.verwaltung_kaeufe('${B}')`);
  pruefe('Kaeufe: Konto ohne Kauf', leer?.abo === null && leer?.editionen?.length === 0 && leer?.premium === false, JSON.stringify(leer));
}

// ---------- AC-09 Name ----------
{
  const r = await wert(F, `public.verwaltung_name('${A}', 'Anna_Neu')`);
  const n = (await db.query(`select benutzername from public.profile where user_id = '${A}'`)).rows[0]?.benutzername;
  pruefe('Name geaendert', !r?.fehler && n === 'Anna_Neu', JSON.stringify(r) + ' ' + n);
  const neu = await wert(F, `public.verwaltung_name('${B}', 'Ben_2')`);
  const nb = (await db.query(`select benutzername from public.profile where user_id = '${B}'`)).rows[0]?.benutzername;
  pruefe('Name fuer Konto ohne Profil angelegt', !neu?.fehler && nb === 'Ben_2', JSON.stringify(neu));
  const doppelt = await wert(F, `public.verwaltung_name('${B}', 'KUNDE_s')`);
  pruefe('Doppelname (ohne Gross/Klein) abgewiesen', /VERWALTUNG_NAME_VERGEBEN/.test(doppelt?.fehler || ''), JSON.stringify(doppelt));
  const form = await wert(F, `public.verwaltung_name('${B}', 'a b')`);
  pruefe('falsches Format abgewiesen', /VERWALTUNG_NAME_FORMAT/.test(form?.fehler || ''), JSON.stringify(form));
  const gleich = await wert(F, `public.verwaltung_name('${A}', 'anna_neu')`);
  pruefe('eigene Schreibweise aendern geht', !gleich?.fehler, JSON.stringify(gleich));
}

// ---------- AC-09 Banner ----------
{
  const r = await wert(F, `public.verwaltung_banner('${B}', 'saison-gold', true)`);
  pruefe('Banner vergeben', !r?.fehler, JSON.stringify(r));
  const stand = await als(B, `select public.karte_mein_stand() as k`);
  pruefe('Banner erscheint in der eigenen Karte', stand?.k?.banner?.includes('saison-gold'), JSON.stringify(stand?.k?.banner));
  const erfolg = await wert(F, `public.verwaltung_banner('${B}', 'erfolg-turmbezwinger', true)`);
  pruefe('Erfolgs-Banner aus der Liste geht', !erfolg?.fehler, JSON.stringify(erfolg));
  const falsch = await wert(F, `public.verwaltung_banner('${B}', 'gibt-es-nicht', true)`);
  pruefe('ungueltiges Banner abgewiesen', /VERWALTUNG_BANNER_UNBEKANNT/.test(falsch?.fehler || ''), JSON.stringify(falsch));
  const weg = await wert(F, `public.verwaltung_banner('${B}', 'saison-gold', false)`);
  const nach = await als(B, `select public.karte_mein_stand() as k`);
  pruefe('Banner wieder weggenommen', !weg?.fehler && !nach?.k?.banner?.includes('saison-gold'), JSON.stringify(nach?.k?.banner));
  const start = await wert(F, `public.verwaltung_banner('${B}', 'start', false)`);
  pruefe('verdientes Banner bleibt', /VERWALTUNG_BANNER_VERDIENT/.test(start?.fehler || ''), JSON.stringify(start));
}

// ---------- Protokoll ----------
{
  const p = await wert(F, 'public.verwaltung_protokoll_lesen()');
  const arten = (p || []).map((x) => x.was);
  pruefe('Protokoll: jede Aenderung steht drin', Array.isArray(p) && arten.filter((a) => a === 'premium').length === 2
    && arten.filter((a) => a === 'name').length === 3 && arten.filter((a) => a === 'banner').length === 3, JSON.stringify(arten));
  const name = p?.find?.((x) => x.was === 'name' && x.ziel_user === A);
  pruefe('Protokoll: vorher und nachher, wer', name?.wer === F && !!name?.vorher && !!name?.nachher, JSON.stringify(name));
  pruefe('Protokoll: abgewiesene Versuche schreiben nichts', !arten.includes(undefined) && p.length === 8, p?.length);
}

// ---------- Stripe-Zustaende (Kaltreview 13.11.: Mahnphase) ----------
// Der Webhook legt past_due, unpaid, incomplete und paused als 'abgelaufen' ab; beendet ist ein Abo erst mit
// customer.subscription.deleted fuer seine abo_id. Nur dann darf die Verwaltung Premium setzen.
{
  const FAELLE = [
    { name: 'aktiv, Datum vorbei (Mahnphase vor dem Webhook)', status: 'aktiv', bis: "now() - interval '2 days'", abo: 'sub_Mahn1', erlaubt: false },
    { name: 'gekuendigt, noch gueltig', status: 'gekuendigt', bis: "now() + interval '5 days'", abo: 'sub_Kuend1', erlaubt: false },
    { name: 'abgelaufen ohne deleted (past_due, unpaid, incomplete)', status: 'abgelaufen', bis: "now() - interval '1 day'", abo: 'sub_Offen1', erlaubt: false },
    { name: 'abgelaufen, deleted nur fuer ein anderes Abo', status: 'abgelaufen', bis: "now() - interval '1 day'", abo: 'sub_Neu1', deleted: 'sub_Alt1', erlaubt: false },
    { name: 'Quelle stripe ohne Abo-Kennung', status: 'abgelaufen', bis: "now() - interval '1 day'", abo: null, erlaubt: false },
    { name: 'abgelaufen mit deleted (endgueltig beendet)', status: 'abgelaufen', bis: "now() - interval '1 day'", abo: 'sub_Ende1', deleted: 'sub_Ende1', erlaubt: true },
  ];
  let i = 0;
  for (const fall of FAELLE) {
    i++;
    const uid = `d${i}000000-0000-4000-8000-00000000000${i}`;
    const kunde = `cus_Fall${i}`;
    await db.exec(`
insert into auth.users (id, email) values ('${uid}', 'fall${i}@x.de');
insert into public.abos (user_id, status, gueltig_bis, quelle, kunde_id, abo_id)
  values ('${uid}', '${fall.status}', ${fall.bis}, 'stripe', '${kunde}', ${fall.abo ? `'${fall.abo}'` : 'null'});
${fall.deleted ? `insert into public.stripe_ereignisse (id, typ, erstellt, kunde_id, abo_id, status, gueltig_bis)
  values ('evt_Fall${i}', 'customer.subscription.deleted', now() - interval '1 day', '${kunde}', '${fall.deleted}', 'abgelaufen', now() - interval '1 day');` : ''}`);
    const vorher = (await db.query(`select status, gueltig_bis, quelle, abo_id from public.abos where user_id = '${uid}'`)).rows[0];
    const k = await wert(F, `public.verwaltung_kaeufe('${uid}')`);
    pruefe(`${fall.name}: Kaeufe melden stripe_gebunden = ${!fall.erlaubt}`, k?.abo?.stripe_gebunden === !fall.erlaubt, JSON.stringify(k?.abo));
    const an = await wert(F, `public.verwaltung_premium('${uid}', now() + interval '30 days')`);
    const weg = fall.erlaubt ? null : await wert(F, `public.verwaltung_premium('${uid}', null)`);
    const nachher = (await db.query(`select status, gueltig_bis, quelle, abo_id from public.abos where user_id = '${uid}'`)).rows[0];
    if (fall.erlaubt) {
      pruefe(`${fall.name}: Freischaltung erlaubt`, !an?.fehler && (await premium(uid)) === true && nachher.quelle === 'manuell', JSON.stringify(an));
      // Kriterien-Review 13.11.: abo_id bleibt als Verlauf stehen; Verlaengern und Ruecknahme muessen trotzdem gehen
      const k2 = await wert(F, `public.verwaltung_kaeufe('${uid}')`);
      pruefe(`${fall.name}: nach der Freischaltung nicht mehr an Stripe gebunden`, k2?.abo?.stripe_gebunden === false && nachher.abo_id === fall.abo,
        JSON.stringify([k2?.abo, nachher]));
      const mehr = await wert(F, `public.verwaltung_premium('${uid}', now() + interval '60 days')`);
      pruefe(`${fall.name}: danach verlaengern erlaubt`, !mehr?.fehler && (await premium(uid)) === true, JSON.stringify(mehr));
      const zurueck = await wert(F, `public.verwaltung_premium('${uid}', null)`);
      pruefe(`${fall.name}: danach zuruecknehmen erlaubt, Premium aus`, !zurueck?.fehler && zurueck?.geaendert === true
        && (await premium(uid)) === false, JSON.stringify(zurueck));
      const wieder = await wert(F, `public.verwaltung_premium('${uid}', now() + interval '10 days')`);
      pruefe(`${fall.name}: und wieder freischalten`, !wieder?.fehler && (await premium(uid)) === true, JSON.stringify(wieder));
    } else {
      pruefe(`${fall.name}: freischalten und zuruecknehmen abgewiesen, Zeile unberuehrt`,
        /VERWALTUNG_STRIPE_ABO/.test(an?.fehler || '') && /VERWALTUNG_STRIPE_ABO/.test(weg?.fehler || '')
        && JSON.stringify(vorher) === JSON.stringify(nachher), JSON.stringify([an, weg, nachher]));
    }
  }
}

// ---------- Protokoll geht mit dem Konto (Kaltreview 13.11.) ----------
{
  const fk = (await db.query(`select confdeltype from pg_constraint where conname = 'verwaltung_protokoll_ziel_user_fkey'`)).rows[0];
  pruefe('Protokoll: Verweis auf das Konto mit Kaskade', fk?.confdeltype === 'c', JSON.stringify(fk));
  const zahl = async (uid) => (await db.query(`select count(*)::int as n from public.verwaltung_protokoll where ziel_user = '${uid}'`)).rows[0].n;
  const namen = async (n) => (await db.query(`select count(*)::int as n from public.verwaltung_protokoll
    where vorher ->> 'benutzername' = '${n}' or nachher ->> 'benutzername' = '${n}'`)).rows[0].n;
  const vorher = await zahl(A);
  const r = await als(A, 'select public.konto_loeschen() as x');
  pruefe('konto_loeschen laeuft fuer A', !r.fehler, JSON.stringify(r));
  pruefe('konto_loeschen: alle Protokollzeilen ueber A weg, auch die Namen', vorher > 0 && (await zahl(A)) === 0
    && (await namen('Anna_Neu')) === 0 && (await namen('Anna_1')) === 0, `${vorher} -> ${await zahl(A)}`);
  pruefe('konto_loeschen: Zeilen ueber andere bleiben', (await zahl(B)) > 0);
}

// ---------- SQL-Editor-Test und Rueckweg ----------
{
  const x = await lauf(db, 'verwaltung-rls-test.sql', lies('supabase/verwaltung-rls-test.sql'));
  pruefe('verwaltung-rls-test.sql laeuft', !x, x);
  const y = await lauf(db, 'karte-rls-test.sql', lies('supabase/karte-rls-test.sql'));
  pruefe('karte-rls-test.sql laeuft mit dem Vorschlag', !y, y);
  await wert(F, `public.verwaltung_banner('${B}', 'saison-gold', true)`);
  const z = await lauf(db, 'verwaltung-zurueck.sql', lies('supabase/verwaltung-zurueck.sql'));
  pruefe('Rueckweg laeuft (auch mit vergebenem Banner)', !z, z);
  const rest = (await db.query(`select count(*)::int as n from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and (p.proname like 'verwaltung%' or p.proname = 'ist_verwalter')`)).rows[0].n;
  const tab = (await db.query(`select to_regclass('public.verwalter') as a, to_regclass('public.verwaltung_protokoll') as b`)).rows[0];
  pruefe('nach dem Rueckweg: keine Funktionen, keine Tabellen', rest === 0 && tab.a === null && tab.b === null, rest + ' ' + JSON.stringify(tab));
  const chk = (await db.query(`select pg_get_constraintdef(oid) as d from pg_constraint where conname = 'banner_besitz_quelle'`)).rows[0]?.d || '';
  pruefe('nach dem Rueckweg: Banner-Check wie in karte-schema.sql', !chk.includes('verwaltung') && chk.includes('liga'), chk);
  const w = await lauf(db, 'karte-rls-test.sql', lies('supabase/karte-rls-test.sql'));
  pruefe('karte-rls-test.sql laeuft nach dem Rueckweg', !w, w);
  const neu = await lauf(db, 'verwaltung-schema.sql', lies('supabase/verwaltung-schema.sql'));
  pruefe('Vorschlag laeuft nach dem Rueckweg erneut', !neu, neu);
}

console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
