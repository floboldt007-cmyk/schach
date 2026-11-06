// Liga mit Kronen (Etappe B), Vertrag von supabase/kronen-schema.sql mit js/pakete/liga/kronen.js (Node, ohne Datenbank).
// Die SQL selbst fuehrt tests/server-kronen.test.mjs in PGlite aus (eigener CI-Job). Hier steht, was beim Aendern
// einer Seite die andere nicht vergessen darf: alle Zahlen gleich, Rechte zu, RLS an, Rueckweg vollstaendig,
// Online-Wertung nur fuer gewertete Partien mit Ergebnis, kein festes Saisonstart-Datum, Zaehler aus.
//   node tests/kronen-vertrag.test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  STUFE_KRONEN, STUFEN_JE_LIGA, STUFEN_ANZAHL, KRONEN, BOT_TAGESGRENZE, KI_TAGESGRENZE, KI_MINDESTDAUER_S,
  SAISON_TAGE, RUECKSTUFUNG_STUFEN, ONLINE_MINDEST_HALBZUEGE, PAAR_TAGESGRENZE,
} from '../js/pakete/liga/kronen.js';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lies = (d) => readFileSync(path.join(WURZEL, d), 'utf8');
let ok = 0;
let gesamt = 0;
function pruefe(name, bedingung, info) {
  gesamt++;
  if (bedingung) { ok++; console.log('ok     ' + name); } else console.log('FEHLER ' + name + (info !== undefined ? '  -> ' + JSON.stringify(info) : ''));
}

const ohneKommentare = (t) => t.split('\n').map((z) => z.replace(/--.*$/, '')).join('\n');
const sql = ohneKommentare(lies('supabase/kronen-schema.sql'));
const test = ohneKommentare(lies('supabase/kronen-rls-test.sql'));
const zurueck = ohneKommentare(lies('supabase/kronen-zurueck.sql'));

const funktionen = [...sql.matchAll(/create or replace function public\.([a-z_]+)\(([^)]*)\)\s*returns ([a-z_.]+)([\s\S]*?)\$\$([\s\S]*?)\$\$;/g)]
  .map((m) => ({ name: m[1], typen: m[2].split(',').map((p) => p.trim()).filter(Boolean).map((p) => p.split(/\s+/)[1]),
    rueckgabe: m[3], kopf: m[4], rumpf: m[5] }));
const fn = (name) => funktionen.find((f) => f.name === name);

// ---------- Zahlen: SQL gleich JS ----------
{
  const k = fn('kronen_konstanten')?.rumpf || '';
  const zahl = (schluessel) => Number((k.match(new RegExp(`'${schluessel}',\\s*(-?\\d+)`)) || [])[1]);
  pruefe('kronen_konstanten vorhanden', !!k);
  pruefe('Stufen gleich (Kronen je Stufe, Stufen je Liga, Anzahl)',
    zahl('stufe_kronen') === STUFE_KRONEN && zahl('stufen_je_liga') === STUFEN_JE_LIGA && zahl('stufen_anzahl') === STUFEN_ANZAHL,
    [zahl('stufe_kronen'), zahl('stufen_je_liga'), zahl('stufen_anzahl')]);
  for (const quelle of ['online', 'ki', 'bot']) {
    const zeile = (k.match(new RegExp(`'${quelle}',\\s*jsonb_build_object\\(([^)]*)\\)`)) || [])[1] || '';
    const wert = (e) => Number((zeile.match(new RegExp(`'${e}',\\s*(-?\\d+)`)) || [])[1]);
    pruefe(`Kronen fuer ${quelle} gleich`, ['sieg', 'remis', 'niederlage'].every((e) => wert(e) === KRONEN[quelle][e]),
      { sql: zeile.trim(), js: KRONEN[quelle] });
  }
  pruefe('Tagesgrenzen, Mindestdauer, Saisonlaenge und Rueckstufung gleich',
    zahl('bot_tagesgrenze') === BOT_TAGESGRENZE && zahl('ki_tagesgrenze') === KI_TAGESGRENZE
      && zahl('ki_mindestdauer_s') === KI_MINDESTDAUER_S && zahl('saison_tage') === SAISON_TAGE
      && zahl('rueckstufung_stufen') === RUECKSTUFUNG_STUFEN);
  pruefe('Schutz gegen Absprache gleich (Mindest-Halbzuege 4, Paar-Grenze 3)',
    zahl('online_mindest_halbzuege') === ONLINE_MINDEST_HALBZUEGE && zahl('paar_tagesgrenze') === PAAR_TAGESGRENZE
      && ONLINE_MINDEST_HALBZUEGE === 4 && PAAR_TAGESGRENZE === 3,
    [zahl('online_mindest_halbzuege'), zahl('paar_tagesgrenze')]);
  // die Rechenfunktionen benutzen dieselben Zahlen
  pruefe('kronen_stufe rechnet mit 100 je Stufe und hoechstens Stufe 17',
    /least\(17,\s*kronen \/ 100\)/.test(fn('kronen_stufe')?.rumpf || '') && STUFEN_ANZAHL - 1 === 17 && STUFE_KRONEN === 100);
  pruefe('kronen_liga_boden: 3 Stufen je Liga, 300 Kronen je Liga',
    /\/ 3\) \* 300/.test(fn('kronen_liga_boden')?.rumpf || '') && STUFEN_JE_LIGA * STUFE_KRONEN === 300);
  pruefe('kronen_rueckstufen: 3 Stufen tiefer', /- 3\) \* 100/.test(fn('kronen_rueckstufen')?.rumpf || '') && RUECKSTUFUNG_STUFEN === 3);
  pruefe('Saisonlaenge 28 in kronen_saison_am', /\/ 28 \+ 1/.test(fn('kronen_saison_am')?.rumpf || ''));
}

// ---------- Rechte und RLS ----------
{
  const TABELLEN = [...sql.matchAll(/create table if not exists public\.([a-z_]+)/g)].map((m) => m[1]);
  pruefe('alle Tabellen erfasst (Kronen und Gegnersuche)', ['kronen_schalter', 'kronen_stand', 'kronen_buchungen', 'kronen_archiv',
    'suche_warteschlange', 'suche_ki_belege'].every((t) => TABELLEN.includes(t)), TABELLEN);
  pruefe('RLS an allen Kronen-Tabellen', TABELLEN.every((t) => new RegExp(`alter table public\\.${t} enable row level security`).test(sql)));
  pruefe('keine Policies (Nutzer sehen keine Zeile direkt)', !/create policy/i.test(sql));
  pruefe('Tabellenrechte fuer anon und authenticated entzogen',
    TABELLEN.every((t) => new RegExp(`revoke all on table[^;]*public\\.${t}[^;]*from anon, authenticated, public`).test(sql)));
  pruefe('kein grant auf Tabellen', !/grant [a-z, ]+ on table/i.test(sql));
  const sigs = funktionen.map((f) => `${f.name}(${f.typen.join(', ')})`);
  const ohneRevoke = sigs.filter((s) => !sql.includes(`revoke all on function public.${s} from public, anon, authenticated`));
  pruefe(`jede der ${sigs.length} Funktionen ist zuerst fuer alle gesperrt`, ohneRevoke.length === 0, ohneRevoke);
  const grants = [...sql.matchAll(/grant execute on function public\.([a-z_]+)\(([^)]*)\) to ([a-z_]+)/g)].map((m) => `${m[1]}->${m[3]}`);
  const ERLAUBT = ['kronen_mein_stand->authenticated', 'kronen_konstanten->authenticated',
    'online_suche_start->authenticated', 'online_suche_stand->authenticated', 'online_suche_ende->authenticated'];
  pruefe('nur freigegebene Funktionen fuer Nutzer, nie fuer anon', grants.every((g) => ERLAUBT.includes(g)) && !grants.some((g) => g.endsWith('anon')), grants);
  pruefe('alle Funktionen mit security definer haben search_path leer',
    funktionen.filter((f) => /security definer/.test(f.kopf)).every((f) => /set search_path = ''/.test(f.kopf)));
  pruefe('kronen_stand_sichern verlangt eine Anmeldung', /raise exception 'KRONEN_ANMELDUNG'/.test(fn('kronen_stand_sichern')?.rumpf || ''));
}

// ---------- Online-Wertung (Task 3) ----------
{
  pruefe('Spalte gewertet mit Vorgabe false', /alter table public\.partien_online add column if not exists gewertet boolean not null default false/.test(sql));
  const trig = (sql.match(/create trigger kronen_nach_partie([\s\S]*?);/) || [])[1] || '';
  pruefe('Trigger kronen_nach_partie nach Statuswechsel', /after update of status on public\.partien_online/.test(trig) && /for each row/.test(trig), trig);
  pruefe('Trigger prueft new.gewertet, Ergebnis und echten Wechsel nach beendet',
    /new\.gewertet/.test(trig) && /new\.ergebnis is not null/.test(trig) && /new\.status = 'beendet'/.test(trig)
      && /old\.status <> 'beendet'/.test(trig), trig);
  pruefe('Trigger ruft kronen_bei_partie_ende', /execute function public\.kronen_bei_partie_ende\(\)/.test(trig));
  const ende = fn('kronen_bei_partie_ende')?.rumpf || '';
  pruefe('kurze Partien ohne Wertung (Halbzuege gegen online_mindest_halbzuege)',
    /halbzuege < \(konst->>'online_mindest_halbzuege'\)::integer then\s*return null;/.test(ende));
  pruefe('Paar-Grenze je Tag, gesperrt je Paar gegen Gleichzeitigkeit',
    /heute_paar >= \(konst->>'paar_tagesgrenze'\)::integer then\s*return null;/.test(ende)
      && /pg_advisory_xact_lock/.test(ende) && /kronen_heute\(\)/.test(ende));
  const abschnitt7 = lies('supabase/kronen-rls-test.sql');
  pruefe('RLS-Test prueft kurze Partien und die Grenze genau bei 3/4',
    /kurze Partie \(3 Halbzuege\)/.test(abschnitt7) && /die 4\. Partie am Tag/.test(abschnitt7) && /for i in 1\.\.3 loop/.test(abschnitt7));
  const buchen = fn('kronen_online_buchen')?.rumpf || '';
  pruefe('Online-Buchung hoechstens einmal je Partie und Konto',
    /on conflict \(user_id, quelle, ref\) do nothing/.test(buchen) && /'online', partie::text/.test(buchen)
      && /unique \(user_id, quelle, ref\)/.test(sql));
  pruefe('Stand aendert sich nur bei neuer Buchung', /get diagnostics gebucht = row_count/.test(buchen) && /if gebucht = 0 then\s*return;/.test(buchen));
  pruefe('Online-Kronen kommen aus kronen_konstanten', /kronen_konstanten\(\) #>> array\['kronen', 'online'/.test(buchen));
  pruefe('Liga-Boden bei Online-Niederlage beachtet', /greatest\(st\.boden, 0, st\.kronen \+ nominal\)/.test(buchen));
  pruefe('Elo: K=40 unter 15 Partien, sonst 32, Grenzen 100 bis 4000',
    /st\.elo_n < 15 then 40 else 32/.test(buchen) && /least\(4000, greatest\(100,/.test(buchen));
}

// ---------- Gegnersuche (Task 4) ----------
{
  const paaren = fn('online_suche_paaren')?.rumpf || '';
  pruefe('Paarung unter skip locked, Fenster 200 plus 50 je Sekunde des laenger Wartenden',
    /for update skip locked/.test(paaren) && /200 \+ 50 \* extract\(epoch from now\(\) - least\(q\.seit, ich\.seit\)\)/.test(paaren));
  pruefe('Paarung legt eine gewertete laufende Partie an und leert beide Zeilen',
    /gewertet = true, status = 'laeuft'/.test(paaren) && /delete from public\.suche_warteschlange q where q\.user_id in \(uid, g\.user_id\)/.test(paaren));
  const ende = fn('online_suche_ende')?.rumpf || '';
  pruefe('KI-Beleg nur nach 10 s Suche ohne Paarung', /seit_war <= now\(\) - interval '10 seconds'/.test(ende)
    && /online_suche_partie\(uid\) is null/.test(ende));
  const start = fn('online_suche_start')?.rumpf || '';
  pruefe('Aufraeumen: Suchen nach 2 Minuten, Belege nach 6 Stunden',
    /interval '2 minutes'/.test(start) && /interval '6 hours'/.test(start));
  pruefe('Zeit-Pruefregel gleich in Tabelle und Funktion', sql.includes("check (zeit ~ '^[0-9]{1,3}\\+[0-9]{1,2}$')")
    && start.includes("zeit !~ '^[0-9]{1,3}\\+[0-9]{1,2}$'"));
  const genutzt = ['online_suche_start', 'online_suche_stand', 'online_suche_ende'];
  pruefe('RLS-Test ruft die Such-Funktionen auf', genutzt.every((f) => test.includes(`public.${f}(`)));
}

// ---------- RLS-Test deckt ab ----------
{
  const ABSCHNITTE = ['Online-Sieg', 'Nur einmal', 'Liga-Boden', 'Abgebrochen', 'Ungewertet', 'Remis'];
  pruefe('RLS-Test hat die Online-Abschnitte', ABSCHNITTE.every((a) => test.includes(a) || lies('supabase/kronen-rls-test.sql').includes(a)));
  const genutzt = ['kronen_mein_stand', 'kronen_konstanten', 'kronen_stand_sichern', 'kronen_online_buchen'];
  pruefe('RLS-Test ruft die Funktionen auf', genutzt.every((f) => test.includes(`public.${f}(`)), genutzt.filter((f) => !test.includes(`public.${f}(`)));
  pruefe('RLS-Test rollt zurueck', /\brollback;\s*$/.test(test.trimEnd() + '\n'));
  pruefe('RLS-Test prueft gesperrte Wege mit insufficient_privilege', /exception when insufficient_privilege/.test(test));
}

// ---------- Rueckweg ----------
{
  const fehlt = funktionen.map((f) => `${f.name}(${f.typen.join(', ')})`).filter((s) => !zurueck.includes(`drop function if exists public.${s};`));
  pruefe('kronen-zurueck.sql entfernt jede Funktion', fehlt.length === 0, fehlt);
  const tabellen = [...sql.matchAll(/create table if not exists public\.([a-z_]+)/g)].map((m) => m[1]);
  pruefe('kronen-zurueck.sql entfernt jede Tabelle', tabellen.every((t) => zurueck.includes(`drop table if exists public.${t};`)), tabellen);
  pruefe('kronen-zurueck.sql entfernt Trigger und Spalte', /drop trigger if exists kronen_nach_partie on public\.partien_online/.test(zurueck)
    && /drop column if exists gewertet/.test(zurueck));
}

// ---------- Einstellungen beim Einspielen ----------
{
  pruefe('kein festes Saisonstart-Datum im Schema', !/saison_start\s*(=|date)\s*'\d{4}-/.test(sql) && !/values \(true, '\d{4}/.test(sql));
  pruefe('Zaehler beim Einspielen aus', /zaehler_an boolean not null default false/.test(sql) && !/zaehler_an\s*=\s*true/.test(sql));
  const roh = lies('supabase/kronen-schema.sql') + lies('supabase/kronen-rls-test.sql') + lies('supabase/kronen-zurueck.sql');
  pruefe('keine Schluessel und keine Preise', !/sb_secret_|service_role_key|eyJ[a-zA-Z0-9_-]{20,}|\d+,\d\d\s?€/.test(roh));
}

console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
