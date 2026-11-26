// Vorschlag "Gegner sieht Besitz" (supabase/karte-besitz-sicht-schema.sql, R30, Plan v3, NICHT eingespielt) in PGlite: der
// Stand wie live (karte-, zwei-ligen-, werkstatt-, karte-elo-, karte-sondertitel-, karte-besitz-, karte-titel-schema.sql),
// dann der Vorschlag. Geprueft je Sonderwert (K, kronli, erfinder-blatt-0): mit dem Stueck zeigen karte_von, karte_der_partie
// und der Liga-Leser (liga_mitglieder_liste) den Wert; ist das Stueck weg, zeigen alle P / ohne, obwohl der Wert gespeichert
// bleibt; karte_waehle speichert ihn nur mit Stueck (sonst KARTE_PROFIL). Dazu: Vorstufe fehlt -> VORSTUFE_FEHLT und nichts
// geaendert; Rechte der neuen Helfer zu; die vier ersetzten Funktionen bis auf die R30-Zusaetze zeichengleich mit ihren
// Vorlagen; die Fassungs-Probe erkennt ein erneutes Einspielen von zwei-ligen-schema.sql; der Sperr-Rueckweg zeigt
// gespeicherte Sonderwerte als P / ohne und lehnt sie beim Waehlen ab.
// Nicht-Spieler sehen keine Karte: Wache tests/server-karte-elo.test.mjs (KARTE_KEINE_PARTIE), hier nicht doppelt.
// Rote Gegenprobe: SICHT_SCHEMA=<leere Datei> node tests/server-karte-besitz-sicht.test.mjs
// Lokal nur mit PGlite in node_modules (npm install --no-save --ignore-scripts @electric-sql/pglite@0.5.11).
//   node tests/server-karte-besitz-sicht.test.mjs
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lies = (d) => (existsSync(path.join(WURZEL, d)) ? readFileSync(path.join(WURZEL, d), 'utf8') : '');
let ok = 0;
let gesamt = 0;
function pruefe(name, bedingung, info) {
  gesamt++;
  if (bedingung) { ok++; console.log('ok     ' + name); } else console.log('FEHLER ' + name + (info !== undefined ? '  -> ' + info : ''));
}
const ende = () => { console.log(`\n${ok}/${gesamt} bestanden`); process.exit(ok === gesamt ? 0 : 1); };

const SCHEMA = process.env.SICHT_SCHEMA ? readFileSync(process.env.SICHT_SCHEMA, 'utf8') : lies('supabase/karte-besitz-sicht-schema.sql');
const ZURUECK = lies('supabase/karte-besitz-sicht-zurueck.sql');

// ---------- F4: zeichengleich bis auf die R30-Zusaetze (bekannte Zusaetze exakt entfernen, Rest muss gleich sein) ----------
const block = (s, name) => { const a = s.indexOf(`create or replace function public.${name}(`); return a < 0 ? null : s.slice(a, s.indexOf('$$;\n', a) + 4); };
const ZUSAETZE = {
  karte_konstanten: {
    vorlage: 'supabase/karte-schema.sql',
    weg: [
      ["    -- Profilbild ohne Labor-Rahmen; Koenig, Kronli und der Erfinder-Rahmen nur mit ihrem Stueck (sonder, R30)\n",
        "    -- Profilbild ohne die Stuecke nur fuer den Erfinder (Koenig, Kronli) und ohne Labor-Rahmen\n"],
      ["'klippa', 'glimm', 'K', 'kronli')", "'klippa', 'glimm')"],
      [`'serie-7', 'serie-30', 'serie-100', 'erfinder-blatt-0'),
    -- R30 (Flo 22.11.2026 "Was du besitzt und traegst, sieht auch dein Gegner"): Wert -> noetiges Stueck in sonderstuecke
    -- (karte_sonder_belegt). Wie js/profil.js NUR_ERFINDER und rahmenErlaubt; ein neuer Sonderwert ist eine neue Zeile hier
    'sonder', jsonb_build_object(
      'motiv', jsonb_build_object('K', 'erfinder-titel', 'kronli', 'erfinder-titel'),
      'rahmen', jsonb_build_object('erfinder-blatt-0', 'erfinder-banner-blatt-0')
    )
  );`, "'serie-7', 'serie-30', 'serie-100')\n  );"],
    ],
  },
  karte_waehle: {
    vorlage: 'supabase/karte-titel-schema.sql',
    weg: [["  -- R30: Koenig, Kronli und Erfinder-Rahmen nur mit dem Stueck (karte_sonder_belegt, karte_konstanten -> sonder)\n"
      + "  if not public.karte_sonder_belegt(uid, 'motiv', motiv) or not public.karte_sonder_belegt(uid, 'rahmen', rahmen) then\n"
      + "    raise exception 'KARTE_PROFIL';\n  end if;\n", '']],
  },
  karte_von: {
    vorlage: 'supabase/karte-titel-schema.sql',
    weg: [["    'kronen_stufe', stufe\n  ) || public.karte_bild(uid, w.motiv, w.grund, w.rahmen);  -- R30: motiv, grund, rahmen nur mit Beleg\n",
      "    'motiv', coalesce(w.motiv, 'P'), 'grund', coalesce(w.grund, 'standard'), 'rahmen', case when public.karte_rahmen_belegt(uid, w.rahmen) then coalesce(w.rahmen, 'ohne') else 'ohne' end,\n"
      + "    'kronen_stufe', stufe\n  );\n"]],
  },
  liga_mitglieder_liste: {
    vorlage: 'supabase/zwei-ligen-schema.sql',
    weg: [["else public.karte_bild(r.user_id, w.motiv, w.grund, w.rahmen) || jsonb_build_object(\n",
      "else jsonb_build_object(\n               'motiv', coalesce(w.motiv, 'P'), 'grund', coalesce(w.grund, 'standard'), 'rahmen', coalesce(w.rahmen, 'ohne'),\n"]],
  },
};
for (const [fn, { vorlage, weg }] of Object.entries(ZUSAETZE)) {
  const alt = block(lies(vorlage), fn);
  const neu = block(SCHEMA, fn);
  let rest = neu || '';
  let alleDa = true;
  for (const [zusatz, original] of weg) {
    if (rest.split(zusatz).length !== 2) alleDa = false;
    rest = rest.replace(zusatz, () => original);
  }
  pruefe(`F4 ${fn}: Vorlage ${vorlage} nicht leer, neue Fassung anders, bis auf die R30-Zusaetze zeichengleich`,
    !!alt && !!neu && neu !== alt && alleDa && rest === alt, `Laenge Vorlage ${alt?.length}, neu ${neu?.length}, Rest ${rest.length}, Zusaetze da ${alleDa}`);
}
for (const [fn, vorlage] of [['karte_konstanten', 'supabase/karte-schema.sql'], ['karte_waehle', 'supabase/karte-titel-schema.sql']]) {
  const alt = block(lies(vorlage), fn);
  const z = block(ZURUECK, fn);
  pruefe(`Rueckweg ${fn}: zeichengleich mit ${vorlage} (und ungleich der neuen Fassung)`, !!alt && z === alt && z !== block(SCHEMA, fn), `Laenge ${alt?.length} / ${z?.length}`);
}
for (const fn of ['karte_von', 'liga_mitglieder_liste', 'karte_bild', 'karte_sonder_belegt']) {
  pruefe(`Rueckweg laesst ${fn} stehen (Lesesperre, keine alte Fassung)`, !!ZURUECK && !block(ZURUECK, fn) && !new RegExp(`drop function[^;]*${fn}`).test(ZURUECK));
}
pruefe('Kopf: Ueberschreib-Regel woertlich', SCHEMA.startsWith('-- Diese Datei ist die NEUESTE Fassung von karte_konstanten, karte_waehle, karte_von und liga_mitglieder_liste.\n'
  + '-- Wer danach karte-schema, karte-sondertitel, karte-besitz, karte-titel oder zwei-ligen erneut einspielt, setzt sie still\n'
  + '-- zurueck (Motiv/Rahmen wieder ohne Beleg). Danach immer DIESE Datei erneut einspielen und die Fassungs-Probe fahren.\n'));
pruefe('Kopf von karte-titel- und zwei-ligen-schema.sql nennt die Ueberschreib-Regel',
  ['supabase/karte-titel-schema.sql', 'supabase/zwei-ligen-schema.sql'].every((d) => lies(d).includes('karte-besitz-sicht-schema.sql erneut einspielen')));
const ohneKommentare = (t) => t.split('\n').map((z) => z.replace(/--.*$/, '')).join('\n');
for (const [d, roh] of [['karte-besitz-sicht-schema.sql', SCHEMA], ['karte-besitz-sicht-zurueck.sql', ZURUECK]]) {
  const s = ohneKommentare(roh);
  pruefe(`${d}: kein grant an anon oder public, kein grant fuer karte_bild oder karte_sonder_belegt`,
    !!s && !/grant[^;]*to[^;]*\b(anon|public)\b/i.test(s) && !/grant[^;]*(karte_bild|karte_sonder_belegt)/.test(s));
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
  try { await db.exec(sql); return null; } catch (e) { return `${name}: ${e.message}`; }
}
// wie tests/server-karte-titel.test.mjs, dazu dessen Vorschlag (live seit 23.11., werkzeuge/rpc-pflicht.json "jetzt")
const BIS_BESITZ = ['supabase/schema.sql', 'supabase/abo-schema.sql', 'supabase/online-schema.sql', 'supabase/kronen-schema.sql',
  'supabase/raetsel-duell-schema.sql', 'supabase/raetsel-duell-daten.sql', 'supabase/karte-schema.sql',
  'supabase/liga-bild-schema.sql', 'supabase/daten-schema.sql', 'supabase/zwei-ligen-schema.sql', 'supabase/daten-schema.sql',
  'supabase/werkstatt-schema.sql', 'supabase/pionier-schema.sql', 'supabase/karte-elo-schema.sql', 'supabase/karte-sondertitel-schema.sql',
  'supabase/karte-besitz-schema.sql'];
const BISHER = [...BIS_BESITZ, 'supabase/karte-titel-schema.sql'];
const FASSUNG = `select
    position('karte_bild' in pg_get_functiondef('public.karte_von(uuid)'::regprocedure)) > 0 as von_bild,
    position('karte_titel_belegt' in pg_get_functiondef('public.karte_von(uuid)'::regprocedure)) > 0 as von_titel,
    position('karte_sonder_belegt' in pg_get_functiondef('public.karte_waehle(text,text,text[],text,text,text)'::regprocedure)) > 0 as waehle_sonder,
    position('karte_titel_belegt' in pg_get_functiondef('public.karte_waehle(text,text,text[],text,text,text)'::regprocedure)) > 0 as waehle_titel,
    position('karte_bild' in pg_get_functiondef('public.liga_mitglieder_liste(bigint,uuid)'::regprocedure)) > 0 as liga_bild,
    public.karte_konstanten() ? 'sonder' as konst_sonder,
    to_regprocedure('public.karte_bild(uuid,text,text,text)') is not null as bild_da`;
// die Probe im Dateikopf ist dieselbe, die hier laeuft (so bleibt die Probe fuer Flo selbst getestet)
const kopfProbe = FASSUNG.split('\n').slice(1).map((z) => '--     ' + z.trim());
pruefe('Fassungs-Probe im Kopf der Datei = Probe dieses Tests (sieben Ausdruecke)', kopfProbe.length === 7 && kopfProbe.every((z) => SCHEMA.includes(z)));

// ---------- B3: ohne Vorstufe (karte-titel fehlt) bricht die Datei ab und aendert nichts ----------
{
  const db = new PGlite();
  let f = await lauf(db, 'Attrappe', ATTRAPPE);
  for (const d of BIS_BESITZ) f = f || await lauf(db, d, lies(d));
  pruefe('ohne Vorstufe: Stand bis karte-besitz laeuft', !f, f);
  const vorher = (await db.query(`select md5(pg_get_functiondef('public.karte_von(uuid)'::regprocedure)) as v,
    md5(pg_get_functiondef('public.karte_konstanten()'::regprocedure)) as k`)).rows[0];
  const fehler = await lauf(db, 'karte-besitz-sicht-schema.sql', SCHEMA);
  pruefe('ohne karte-titel-schema.sql: Abbruch mit VORSTUFE_FEHLT (karte_titel_belegt)', /VORSTUFE_FEHLT: public\.karte_titel_belegt/.test(fehler || ''), fehler);
  await lauf(db, 'Aufraeumen', 'rollback;');
  const nachher = (await db.query(`select md5(pg_get_functiondef('public.karte_von(uuid)'::regprocedure)) as v,
    md5(pg_get_functiondef('public.karte_konstanten()'::regprocedure)) as k,
    to_regprocedure('public.karte_bild(uuid,text,text,text)') is null as kein_bild,
    to_regprocedure('public.karte_sonder_belegt(uuid,text,text)') is null as kein_sonder`)).rows[0];
  pruefe('ohne Vorstufe: keine Funktion geaendert, keine angelegt', nachher.v === vorher.v && nachher.k === vorher.k && nachher.kein_bild && nachher.kein_sonder, JSON.stringify(nachher));
  await db.close();
}

const B = 'f1000000-0000-4000-8000-0000000000b1';   // Besitzer der Sonderstuecke (wie Flo)
const D = 'f2000000-0000-4000-8000-0000000000d2';   // Gegner (wie Opa)
const db = new PGlite();
let f = await lauf(db, 'Attrappe', ATTRAPPE);
for (const d of BISHER) f = f || await lauf(db, d, lies(d));
pruefe('Stand wie live laeuft (Karte, Liga, Werkstatt, Elo, Sondertitel, Rahmen- und Titel-Beleg)', !f, f);
if (f) ende();
await db.exec(`
insert into auth.users (id, email) values ('${B}', 'b@x'), ('${D}', 'd@x');
create table test_werte (art text primary key, id bigint, partie uuid);
with p as (insert into public.partien_online (erstellt_von, fen, bedenkzeit_s, inkrement_s) values ('${B}', 'x', 300, 3) returning id)
insert into test_werte (art, partie) select 'bd', id from p;
update public.partien_online set status = 'laeuft', letzter_zug_am = now(), gewertet = true, weiss = erstellt_von, schwarz = '${D}'::uuid;
with g as (insert into public.liga_gruppen (woche, stufe) values (date_trunc('week', current_date)::date, 0) returning id)
insert into test_werte (art, id) select 'gruppe', id from g;
insert into public.liga_mitglieder (gruppe, user_id, woche) select id, '${B}', date_trunc('week', current_date)::date from test_werte where art = 'gruppe';
`);
async function als(uid, sql) {
  await db.exec(`select set_config('request.jwt.claims', '{"sub":"${uid}","role":"authenticated"}', false); set role authenticated;`);
  try { return (await db.query(sql)).rows[0]; } catch (e) { return { fehler: e.message }; } finally {
    await db.exec(`reset role; select set_config('request.jwt.claims', '', false);`);
  }
}
const waehle = (motiv, rahmen) => als(B, `select public.karte_waehle('start', null, null, '${motiv}', 'standard', '${rahmen}') as r`);
const profil = (r) => /KARTE_PROFIL/.test(r.fehler || '');
const speichere = (motiv, rahmen) => db.exec(`update public.karte_wahl set motiv = '${motiv}', rahmen = '${rahmen}' where user_id = '${B}'`);
const partie = async () => (await db.query(`select partie from test_werte where art = 'bd'`)).rows[0].partie;
const gruppe = async () => (await db.query(`select id from test_werte where art = 'gruppe'`)).rows[0].id;
// was die drei Leser von B zeigen: karte_von (Superuser, intern), karte_der_partie (als Gegner), Liga (intern, Sicht von D)
async function sicht() {
  const von = (await db.query(`select public.karte_von('${B}') as k`)).rows[0].k;
  const r = await als(D, `select public.karte_der_partie('${await partie()}') as k`);
  const liga = ((await db.query(`select public.liga_mitglieder_liste(${await gruppe()}, '${D}') as l`)).rows[0].l || []).find((x) => !x.ki) || {};
  const w = r.k?.w || {};
  return { von: `${von.motiv}/${von.rahmen}`, partie: r.fehler ? 'FEHLER ' + r.fehler : `${w.motiv}/${w.rahmen}`, liga: `${liga.motiv}/${liga.rahmen}` };
}
const alleGleich = (s, wert) => s.von === wert && s.partie === wert && s.liga === wert;
const stueck = (id, art) => db.exec(`insert into public.sonderstuecke (stueck_id, art, user_id) values ('${id}', '${art}', '${B}') on conflict (stueck_id) do update set user_id = excluded.user_id`);
const entziehe = (id) => db.exec(`update public.sonderstuecke set user_id = null where stueck_id = '${id}'`);

// vorher (Stand live): der Befund aus Plan und Codex-Zweitmeinung
{
  // legt die Zeile in karte_wahl an (karte_sichern), danach kann speichere() sie setzen wie eine alte gespeicherte Wahl
  pruefe('vorher: normale Wahl Q/ohne angenommen', !(await waehle('Q', 'ohne')).fehler);
  pruefe('vorher: karte_waehle lehnt K ab (KARTE_PROFIL, Plan "Offen": gelesen, jetzt gefahren)', profil(await waehle('K', 'ohne')));
  pruefe('vorher: karte_waehle lehnt erfinder-blatt-0 ab (KARTE_PROFIL)', profil(await waehle('P', 'erfinder-blatt-0')));
  await speichere('K', 'ohne');
  const s = await sicht();
  pruefe('vorher: ein gespeichertes K erscheint OHNE Stueck bei Gegner und Liga (Befund, motiv ungeprueft)', s.partie === 'K/ohne' && s.liga === 'K/ohne', JSON.stringify(s));
  await speichere('P', 'ohne');
}

f = await lauf(db, 'karte-besitz-sicht-schema.sql', SCHEMA);
pruefe('karte-besitz-sicht-schema.sql laeuft', !f, f);
if (f) { await lauf(db, 'Aufraeumen', 'rollback;'); ende(); }
f = await lauf(db, 'karte-besitz-sicht-schema.sql (2.)', SCHEMA);
pruefe('karte-besitz-sicht-schema.sql ist wiederholbar', !f, f);

const FAELLE = [
  { name: 'K', motiv: 'K', rahmen: 'ohne', stueck: 'erfinder-titel', art: 'titel', zeigt: 'K/ohne', ohne: 'P/ohne' },
  { name: 'kronli', motiv: 'kronli', rahmen: 'ohne', stueck: 'erfinder-titel', art: 'titel', zeigt: 'kronli/ohne', ohne: 'P/ohne' },
  { name: 'erfinder-blatt-0', motiv: 'Q', rahmen: 'erfinder-blatt-0', stueck: 'erfinder-banner-blatt-0', art: 'banner', zeigt: 'Q/erfinder-blatt-0', ohne: 'Q/ohne' },
];
for (const c of FAELLE) {
  await entziehe(c.stueck);
  pruefe(`${c.name}: ohne Stueck lehnt karte_waehle ab (KARTE_PROFIL)`, profil(await waehle(c.motiv, c.rahmen)));
  await stueck(c.stueck, c.art);
  const r = await waehle(c.motiv, c.rahmen);
  pruefe(`${c.name}: mit Stueck speichert karte_waehle`, !r.fehler, JSON.stringify(r));
  let s = await sicht();
  pruefe(`${c.name}: mit Stueck zeigen karte_von, karte_der_partie und Liga ${c.zeigt}`, alleGleich(s, c.zeigt), JSON.stringify(s));
  await entziehe(c.stueck);
  s = await sicht();
  pruefe(`${c.name}: Stueck entzogen, alle drei Leser zeigen ${c.ohne} (B1)`, alleGleich(s, c.ohne), JSON.stringify(s));
  const roh = (await db.query(`select motiv, rahmen from public.karte_wahl where user_id = '${B}'`)).rows[0];
  pruefe(`${c.name}: gespeicherter Wert bleibt (karte_wahl nicht umgeschrieben)`, roh.motiv === c.motiv && roh.rahmen === c.rahmen, JSON.stringify(roh));
}
{
  // ohne Tabelle sonderstuecke besitzt niemand etwas; normale Werte bleiben frei
  pruefe('normale Werte weiter frei (Q, holz, welt-1)', !(await als(B, `select public.karte_waehle('start', null, null, 'Q', 'welt-1', 'holz') as r`)).fehler);
  const s = await sicht();
  pruefe('normale Werte bei allen Lesern sichtbar', alleGleich(s, 'Q/holz'), JSON.stringify(s));
  // Erfinder-Rahmen bleibt zusaetzlich an karte_rahmen_belegt gebunden: liga-6 ohne Liga-Stufe 3 zeigt ohne
  await speichere('Q', 'liga-6');
  pruefe('verdienter Rahmen liga-6 ohne Stufe bleibt bei allen Lesern ohne (karte_rahmen_belegt unveraendert)', alleGleich(await sicht(), 'Q/ohne'));
  await speichere('Q', 'unbekannt');
  pruefe('unbekannter gespeicherter Rahmen zeigt ohne', alleGleich(await sicht(), 'Q/ohne'));
}
{
  const rechte = (await db.query(`select p.proname, p.prosecdef as sd, p.proconfig as cfg,
      has_function_privilege('authenticated', p.oid, 'execute') as auth, has_function_privilege('anon', p.oid, 'execute') as anon
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('karte_bild', 'karte_sonder_belegt', 'karte_waehle', 'karte_von', 'liga_mitglieder_liste', 'karte_konstanten')`)).rows;
  const r = Object.fromEntries(rechte.map((x) => [x.proname, x]));
  pruefe('Rechte (B6): karte_bild und karte_sonder_belegt fuer anon und authenticated zu',
    ['karte_bild', 'karte_sonder_belegt'].every((n) => r[n] && r[n].auth === false && r[n].anon === false), JSON.stringify(rechte));
  pruefe('Rechte unveraendert: karte_waehle nur authenticated; karte_von, liga_mitglieder_liste, karte_konstanten fuer niemanden',
    r.karte_waehle?.auth === true && r.karte_waehle?.anon === false
    && ['karte_von', 'liga_mitglieder_liste', 'karte_konstanten'].every((n) => r[n] && r[n].auth === false && r[n].anon === false), JSON.stringify(rechte));
  pruefe('neue Helfer security definer mit leerem search_path', ['karte_bild', 'karte_sonder_belegt']
    .every((n) => r[n]?.sd === true && (r[n]?.cfg || []).includes('search_path=""')), JSON.stringify(rechte));
  pruefe('als authenticated: karte_bild direkt verweigert', /permission denied/.test((await als(D, `select public.karte_bild('${B}', 'K', 'standard', 'ohne') as r`)).fehler || ''));
}
{
  const p = (await db.query(FASSUNG)).rows[0];
  pruefe('F3 Fassungs-Probe: siebenmal true nach dem Einspielen', Object.values(p).length === 7 && Object.values(p).every((x) => x === true), JSON.stringify(p));
  f = await lauf(db, 'zwei-ligen-schema.sql (erneut)', lies('supabase/zwei-ligen-schema.sql'));
  const p2 = (await db.query(FASSUNG)).rows[0];
  pruefe('F3: zwei-ligen-schema.sql erneut eingespielt -> Probe meldet liga_bild false (stiller Rueckschritt erkannt)', !f && p2.liga_bild === false, f || JSON.stringify(p2));
  f = await lauf(db, 'karte-besitz-sicht-schema.sql (nach zwei-ligen)', SCHEMA);
  const p3 = (await db.query(FASSUNG)).rows[0];
  pruefe('F3: diese Datei danach erneut eingespielt -> wieder siebenmal true', !f && Object.values(p3).every((x) => x === true), f || JSON.stringify(p3));
}

// ---------- Sperr-Rueckweg (B2): Werte gespeichert, Stuecke da, trotzdem P / ohne und Ablehnung ----------
await stueck('erfinder-titel', 'titel');
await stueck('erfinder-banner-blatt-0', 'banner');
pruefe('vor dem Rueckweg: mit Stuecken K und erfinder-blatt-0 gespeichert', !(await waehle('K', 'erfinder-blatt-0')).fehler);
pruefe('vor dem Rueckweg: alle drei Leser zeigen K/erfinder-blatt-0', alleGleich(await sicht(), 'K/erfinder-blatt-0'));
f = await lauf(db, 'karte-besitz-sicht-zurueck.sql', ZURUECK);
pruefe('Rueckweg laeuft', !f, f);
f = await lauf(db, 'karte-besitz-sicht-zurueck.sql (2.)', ZURUECK);
pruefe('Rueckweg ist wiederholbar', !f, f);
{
  const s = await sicht();
  pruefe('nach dem Rueckweg: gespeicherte Sonderwerte trotz Stueck bei allen Lesern P/ohne', alleGleich(s, 'P/ohne'), JSON.stringify(s));
  pruefe('nach dem Rueckweg: karte_waehle lehnt K ab (KARTE_PROFIL)', profil(await waehle('K', 'ohne')));
  pruefe('nach dem Rueckweg: karte_waehle lehnt erfinder-blatt-0 ab (KARTE_PROFIL)', profil(await waehle('P', 'erfinder-blatt-0')));
  const rest = (await db.query(`select to_regprocedure('public.karte_bild(uuid,text,text,text)') is not null as bild,
    to_regprocedure('public.karte_sonder_belegt(uuid,text,text)') is not null as sonder, public.karte_konstanten() ? 'sonder' as konst,
    has_function_privilege('authenticated', 'public.karte_waehle(text, text, text[], text, text, text)', 'execute') as waehle_auth,
    has_function_privilege('authenticated', 'public.karte_konstanten()', 'execute') as konst_auth`)).rows[0];
  pruefe('nach dem Rueckweg: karte_bild und karte_sonder_belegt bleiben, sonder weg, Rechte wie vorher',
    rest.bild && rest.sonder && !rest.konst && rest.waehle_auth && !rest.konst_auth, JSON.stringify(rest));
  pruefe('nach dem Rueckweg: normale Werte weiter frei', !(await waehle('Q', 'holz')).fehler && alleGleich(await sicht(), 'Q/holz'));
}
f = await lauf(db, 'karte-besitz-sicht-schema.sql (nach Rueckweg)', SCHEMA);
pruefe('nach dem Rueckweg laesst sich die neue Fassung wieder einspielen', !f, f);
await db.close();
ende();
