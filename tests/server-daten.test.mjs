// Datenauskunft (Art. 15/20, G-002 AC-06), Server-Seite: spielt ALLE Schemata in PGlite ein (Postgres als WebAssembly,
// ohne Netz, ohne Supabase) und prueft zweierlei:
//   1. Vollstaendigkeit: Jede Tabelle in public kommt in meine_daten() vor ODER steht unten in KEIN_KONTOBEZUG mit Grund.
//      Eine neue Tabelle macht diesen Test rot, bis jemand entschieden hat, ob sie in die Auskunft gehoert.
//   2. Inhalt: Fuer die Teile, die am 09.11.2026 dazukamen (Coach, Schule, Abo-Ereignisse, Editions-Ereignisse), liefert
//      meine_daten() die eigenen Zeilen und keine fremden.
// Laeuft im CI-Job "sql" (.github/workflows/tests.yml); lokal nur, wenn PGlite im Arbeitsbaum liegt
// (npm install --no-save --ignore-scripts @electric-sql/pglite@0.5.11).
//   node tests/server-daten.test.mjs
//
// WICHTIG: Die Auth-Attrappe bildet Supabase nur naeherungsweise nach (wie in tests/server-kronen.test.mjs). Ein gruener
// Lauf hier ersetzt NICHT den einmaligen Lauf von daten-rls-test.sql im Supabase SQL Editor vor dem Einspielen.
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

// Tabellen ohne Personenbezug zum Konto (oder bewusst nicht in der Auskunft), je mit Grund
const KEIN_KONTOBEZUG = {
  produkte: 'Katalog der Abo-Produkte, gleich fuer alle',
  editionen: 'Katalog der limitierten Editionen, gleich fuer alle',
  duell_raetsel: 'Raetsel-Sammlung (Lichess), gleich fuer alle',
  kronen_schalter: 'eine Schalter-Zeile fuer den Server',
  zaehler_tag: 'Tageszaehler je Schluessel, ohne Konto (zaehler-schema.sql)',
};

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

// Reihenfolge wie in supabase/ANLEITUNG.md: die Datenauskunft zuletzt, weil sie alle Teile mit ausgibt
const SCHEMATA = ['schema', 'online-schema', 'freunde-schema', 'abo-schema', 'werkstatt-schema', 'pionier-schema',
  'coach-schema', 'schule-schema', 'kronen-schema', 'zaehler-schema', 'karte-schema', 'raetsel-duell-schema', 'melden-schema', 'daten-schema'];

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
for (const d of SCHEMATA) {
  const f = await lauf(db, d, lies(`supabase/${d}.sql`));
  pruefe(d + '.sql laeuft', f === null, f);
}
let f = await lauf(db, 'daten-schema.sql (zweites Mal)', lies('supabase/daten-schema.sql'));
pruefe('daten-schema.sql ist wiederholbar', f === null, f);

// ---------- 1. Vollstaendigkeit ----------
async function rumpf() {
  const r = await db.query(`select pg_get_functiondef('public.meine_daten()'::regprocedure) as d`);
  return r.rows[0].d;
}
const tabellen = (await db.query(`select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and c.relname not like '\\_backup\\_%' order by 1`)).rows.map((r) => r.relname);
pruefe('alle Schemata zusammen ergeben mehr als 40 Tabellen', tabellen.length > 40, tabellen.length);
let def = await rumpf();
const fehlt = tabellen.filter((t) => !KEIN_KONTOBEZUG[t] && !def.includes(`public.${t} `));
pruefe('jede Tabelle steht in meine_daten() oder in KEIN_KONTOBEZUG', fehlt.length === 0, fehlt.join(', '));
const veraltet = Object.keys(KEIN_KONTOBEZUG).filter((t) => !tabellen.includes(t));
pruefe('KEIN_KONTOBEZUG nennt nur Tabellen, die es gibt', veraltet.length === 0, veraltet.join(', '));
// Gegenprobe: eine Tabelle mit Konto-Spalte in KEIN_KONTOBEZUG waere ein Widerspruch
const mitKonto = (await db.query(`select distinct cl.relname from pg_constraint co
  join pg_class cl on cl.oid = co.conrelid join pg_namespace n on n.oid = cl.relnamespace
  where co.contype = 'f' and co.confrelid = 'auth.users'::regclass and n.nspname = 'public'`)).rows.map((r) => r.relname);
const widerspruch = mitKonto.filter((t) => KEIN_KONTOBEZUG[t]);
pruefe('keine Tabelle mit Verweis auf auth.users gilt als ohne Kontobezug', widerspruch.length === 0, widerspruch.join(', '));

// ---------- 2. Inhalt der neuen Teile: eigene Zeilen ja, fremde nein ----------
const A = '00000000-0000-4000-8000-00000000000a';
const B = '00000000-0000-4000-8000-00000000000b';
f = await lauf(db, 'Testdaten', `
insert into auth.users (id, email) values ('${A}', 'a@a.de'), ('${B}', 'b@b.de');
insert into public.meldungen (melder, gemeldet, grund, notiz, gemeldeter_name, tag) values
  ('${A}', '${B}', 'name', 'NotizVonAnna', 'Bert_spielt', '2026-11-08'), ('${B}', '${A}', 'verhalten', 'NotizVonBert', 'Anna_spielt', '2026-11-08');
insert into public.coach_nutzung (user_id, tag, anzahl) values ('${A}', '2026-11-08', 3), ('${B}', '2026-11-08', 7);
insert into public.schule_versuche (user_id, tag, anzahl) values ('${A}', '2026-11-08', 2), ('${B}', '2026-11-08', 4);
insert into public.klassen (id, name, code, leitung) values
  ('00000000-0000-4000-8000-0000000000a1', 'Klasse Anna', 'ABCDEF', '${A}'),
  ('00000000-0000-4000-8000-0000000000b1', 'Klasse Bert', 'BCDEFG', '${B}');
insert into public.klassen_aufgaben (klasse, titel, art, ziel) values
  ('00000000-0000-4000-8000-0000000000a1', 'Aufgabe von Anna', 'bot', '{}'),
  ('00000000-0000-4000-8000-0000000000b1', 'Aufgabe von Bert', 'bot', '{}');
insert into public.klassen_mitglieder (id, klasse, user_id, anzeigename) values
  ('00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-0000000000b1', '${A}', 'Anni'),
  ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-0000000000a1', '${B}', 'Berti');
insert into public.klassen_fortschritt (mitglied, klasse, sterne) values
  ('00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-0000000000b1', 5),
  ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-0000000000a1', 9);
insert into public.abos (user_id, status, gueltig_bis, quelle, kunde_id) values ('${A}', 'aktiv', now() + interval '30 days', 'stripe', 'cus_Anna1');
insert into public.stripe_ereignisse (id, typ, erstellt, kunde_id, user_id) values
  ('evt_AnnaMitKonto', 'invoice.paid', now(), 'cus_Anna1', '${A}'),
  ('evt_AnnaOhneKonto', 'invoice.paid', now(), 'cus_Anna1', null),
  ('evt_BertMitKonto', 'invoice.paid', now(), 'cus_Bert1', '${B}');
insert into public.editionen (produkt_id, name, auflage, verkauf_ab, verkauf_bis) values ('test-edition', 'Test', 10, now(), now() + interval '1 day');
insert into public.reservierungen (id, produkt_id, user_id) values
  ('00000000-0000-4000-8000-0000000000a3', 'test-edition', '${A}'),
  ('00000000-0000-4000-8000-0000000000b3', 'test-edition', '${B}');
insert into public.edition_ereignisse (id, typ, erstellt, reservierung_id) values
  ('evt_EditionAnna', 'checkout.session.expired', now(), '00000000-0000-4000-8000-0000000000a3'),
  ('evt_EditionBert', 'checkout.session.expired', now(), '00000000-0000-4000-8000-0000000000b3');
`);
pruefe('Testdaten fuer A und B angelegt', f === null, f);

async function auskunft(uid) {
  await db.exec(`select set_config('request.jwt.claim.sub', '${uid}', false); set role authenticated;`);
  try {
    return (await db.query('select public.meine_daten() as d')).rows[0].d;
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
  }
}
let d = await auskunft(A);
const text = JSON.stringify(d);
pruefe('Auskunft fuer A kommt', d && d.konto && d.konto.email === 'a@a.de', text.slice(0, 200));
pruefe('bisherige Schluessel bleiben', ['profil', 'partien_archiv', 'nutzung', 'freunde', 'kronen', 'karte', 'raetsel_duell',
  'abo', 'besitz', 'reservierungen'].every((k) => k in d), Object.keys(d).join());
pruefe('coach: eigene Nutzung je Tag', d.coach && d.coach.nutzung.length === 1 && d.coach.nutzung[0].anzahl === 3, JSON.stringify(d.coach));
const s = d.schule || {};
pruefe('schule: geleitete Klasse mit eigener Aufgabe', s.geleitete_klassen?.length === 1 && s.geleitete_klassen[0].name === 'Klasse Anna'
  && s.geleitete_klassen[0].aufgaben?.length === 1 && s.geleitete_klassen[0].aufgaben[0].titel === 'Aufgabe von Anna', JSON.stringify(s));
pruefe('schule: eigene Mitgliedschaft mit Fortschritt', s.mitgliedschaften?.length === 1 && s.mitgliedschaften[0].anzeigename === 'Anni'
  && s.mitgliedschaften[0].klasse === 'Klasse Bert' && s.mitgliedschaften[0].fortschritt?.sterne === 5, JSON.stringify(s));
pruefe('schule: eigene Beitrittsversuche', s.beitrittsversuche?.length === 1 && s.beitrittsversuche[0].anzahl === 2, JSON.stringify(s));
const ev = (d.abo_ereignisse || []).map((e) => e.id).sort().join();
pruefe('abo_ereignisse: eigene, auch ohne Konto-Verweis ueber die Kundennummer', ev === 'evt_AnnaMitKonto,evt_AnnaOhneKonto', ev);
const ed = (d.edition_ereignisse || []).map((e) => e.id).join();
pruefe('edition_ereignisse: nur die zur eigenen Reservierung', ed === 'evt_EditionAnna', ed);
// Melden: nur die selbst abgegebenen Meldungen; Meldungen UEBER das Konto stehen nicht darin (sie verrieten den Melder)
pruefe('meldungen: die eigene Meldung mit Grund, Text und gemeldetem Namen', d.meldungen?.length === 1 && d.meldungen[0].grund === 'name'
  && d.meldungen[0].notiz === 'NotizVonAnna' && d.meldungen[0].gemeldeter_name === 'Bert_spielt' && !('melder' in d.meldungen[0])
  && !('gemeldet' in d.meldungen[0]), JSON.stringify(d.meldungen));
pruefe('meldungen: keine Meldung ueber das eigene Konto in der Auskunft', !text.includes('NotizVonBert') && !text.includes('Anna_spielt'));
const fremd = ['Berti', 'Aufgabe von Bert', 'evt_BertMitKonto', 'evt_EditionBert', B, '"sterne": 9', '"anzahl": 7', '"anzahl": 4']
  .filter((x) => text.includes(x) || JSON.stringify(d, null, 1).includes(x));
pruefe('keine fremden Daten in der Auskunft von A', fremd.length === 0, fremd.join(', '));

d = await auskunft(B);
pruefe('B sieht die eigene Klasse und nichts von A', d.schule?.geleitete_klassen?.[0]?.name === 'Klasse Bert'
  && !JSON.stringify(d).includes('Anni') && !JSON.stringify(d).includes('evt_Anna'), JSON.stringify(d.schule));

// anon darf nicht
let anonFehler = null;
try {
  await db.exec('set role anon;');
  await db.query('select public.meine_daten()');
} catch (e) { anonFehler = e.message; } finally { await db.exec('reset role;'); }
pruefe('anon darf meine_daten() nicht aufrufen', anonFehler !== null, anonFehler);

// ---------- Rueckweg: alte Funktion, danach wieder die neue ----------
f = await lauf(db, 'daten-auskunft-zurueck.sql', lies('supabase/daten-auskunft-zurueck.sql'));
pruefe('daten-auskunft-zurueck.sql laeuft', f === null, f);
d = await auskunft(A);
pruefe('nach dem Rueckweg: alte Auskunft ohne die neuen Teile', d && !('coach' in d) && 'kronen' in d, Object.keys(d || {}).join());
f = await lauf(db, 'daten-schema.sql (nach Rueckweg)', lies('supabase/daten-schema.sql'));
pruefe('daten-schema.sql laesst sich danach wieder einspielen', f === null, f);
d = await auskunft(A);
pruefe('danach ist die volle Auskunft wieder da', d && 'coach' in d && 'schule' in d, Object.keys(d || {}).join());

console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
