// Schulmodus (Welle B3), Server-Seite: Vertrag von supabase/schule-schema.sql mit js/schule.js (Node, ohne Datenbank).
// Die Rechte und Abfragen selbst prueft supabase/schule-rls-test.sql in einer echten Datenbank (Supabase SQL Editor,
// lokal im PGlite-Pruefer); hier steht, was beim Aendern einer Seite die andere nicht vergessen darf:
// Funktionen und Parameter, Fehler-Kennungen mit Saetzen, Grenzen, Bot-Liste, Zeichen fuer Code und Anzeigename,
// Rechte (nie anon, nie direkt schreiben, keine Konto-ID der Mitglieder), RLS, keine Geheimnisse und keine Preise.
//   node tests/server-schule.test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { BOTS } from '../js/bots.js';
import { TEXTE, GRENZEN, CODE_ZEICHEN, FEHLER_ARTEN, ARTEN, pruefeAnzeigename } from '../js/schule.js';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lies = (d) => readFileSync(path.join(WURZEL, d), 'utf8');
let ok = 0;
let gesamt = 0;
function pruefe(name, bedingung, info) {
  gesamt++;
  if (bedingung) { ok++; console.log('ok     ' + name); } else console.log('FEHLER ' + name + (info !== undefined ? '  -> ' + JSON.stringify(info) : ''));
}

const sql = lies('supabase/schule-schema.sql');
const ohne = sql.split('\n').map((z) => z.replace(/--.*$/, '')).join('\n');
const funktionen = [...ohne.matchAll(/create or replace function public\.(schule_[a-z_]+)\(([^)]*)\)\s*returns ([a-z]+)([\s\S]*?)\$\$([\s\S]*?)\$\$;/g)]
  .map((m) => ({ name: m[1], params: m[2].split(',').map((p) => p.trim()).filter(Boolean).map((p) => p.split(/\s+/)[0]),
    typen: m[2].split(',').map((p) => p.trim()).filter(Boolean).map((p) => p.split(/\s+/)[1]), rueckgabe: m[3], kopf: m[4], rumpf: m[5] }));
const fn = (name) => funktionen.find((f) => f.name === name);

// ---------- Funktionen und Parameter ----------
const API = {
  schule_erstelle_klasse: ['name'],
  schule_tritt_bei: ['code', 'anzeigename'],
  schule_verlasse: ['klasse'],
  schule_melde_fortschritt: ['bots_besiegt', 'sterne', 'partien', 'genauigkeit_schnitt', 'haeufigste_fehler', 'erledigt'],
  schule_meine_klassen: [],
  schule_klassen_uebersicht: ['klasse'],
  schule_aufgabe_anlegen: ['klasse', 'titel', 'art', 'ziel', 'faellig'],
  schule_aufgabe_loeschen: ['aufgabe'],
  schule_entferne_mitglied: ['mitglied'],
  schule_schliesse_klasse: ['klasse'],
  schule_loesche_klasse: ['klasse'],
};
const HILFEN = ['schule_leitet', 'schule_mitglied_in', 'schule_ist_mein_mitglied', 'schule_sauber', 'schule_heute'];
pruefe('alle Funktionen der API mit genau diesen Parametern (Vertrag mit js/schule.js)',
  Object.entries(API).every(([n, p]) => fn(n) && JSON.stringify(fn(n).params) === JSON.stringify(p)),
  Object.entries(API).filter(([n, p]) => !fn(n) || JSON.stringify(fn(n).params) !== JSON.stringify(p)).map(([n]) => [n, fn(n) && fn(n).params]));
pruefe('keine weiteren Funktionen ausser den Hilfen', funktionen.length === Object.keys(API).length + HILFEN.length
  && HILFEN.every((h) => fn(h)), funktionen.map((f) => f.name));
pruefe('jede Funktion setzt einen leeren search_path', funktionen.every((f) => /set search_path = ''/.test(f.kopf)), funktionen.filter((f) => !/set search_path = ''/.test(f.kopf)).map((f) => f.name));
pruefe('API-Funktionen und die drei Policy-Hilfen sind security definer, schule_sauber und schule_heute nicht',
  [...Object.keys(API), 'schule_leitet', 'schule_mitglied_in', 'schule_ist_mein_mitglied'].every((n) => /security definer/.test(fn(n).kopf))
  && !/security definer/.test(fn('schule_sauber').kopf) && !/security definer/.test(fn('schule_heute').kopf));
pruefe('jede API-Funktion prueft zuerst die Anmeldung (SCHULE_NICHT_ANGEMELDET)', Object.keys(API).every((n) => {
  const r = fn(n).rumpf;
  const i = r.indexOf("raise exception 'SCHULE_NICHT_ANGEMELDET'");
  return i > 0 && !/\b(insert|update|delete|from)\b/.test(r.slice(0, i));
}));
pruefe('Parameter, die wie Spalten heissen, werden vorher in Variablen kopiert (kein mehrdeutiger Bezug)',
  ['schule_verlasse', 'schule_klassen_uebersicht', 'schule_aufgabe_anlegen', 'schule_schliesse_klasse', 'schule_loesche_klasse'].every((n) => /v_klasse uuid := klasse;/.test(fn(n).rumpf))
  && /v_bots integer := bots_besiegt;/.test(fn('schule_melde_fortschritt').rumpf) && /v_erledigt jsonb := coalesce\(erledigt/.test(fn('schule_melde_fortschritt').rumpf));

// ---------- Rechte und RLS ----------
const TABELLEN = ['klassen', 'klassen_mitglieder', 'klassen_fortschritt', 'klassen_aufgaben', 'schule_versuche'];
pruefe('RLS an fuer alle fuenf Tabellen', TABELLEN.every((t) => ohne.includes(`alter table public.${t} enable row level security;`)));
pruefe('Tabellen: alles weg fuer anon, authenticated, public; danach nur lesen, nie schreiben',
  /revoke all on table public\.klassen, public\.klassen_mitglieder, public\.klassen_fortschritt, public\.klassen_aufgaben,\s+public\.schule_versuche from anon, authenticated, public;/.test(ohne)
  && /grant select on table public\.klassen, public\.klassen_fortschritt, public\.klassen_aufgaben to authenticated;/.test(ohne)
  && !/grant (insert|update|delete|all)[^;]*to[^;]*(anon|authenticated)/.test(ohne) && !/grant[^;]*to[^;]*\banon\b/.test(ohne));
pruefe('klassen_mitglieder: nur Spalten ohne user_id lesbar (die Leitung sieht nie die Konto-ID)',
  /grant select \(id, klasse, anzeigename, beigetreten_am\) on table public\.klassen_mitglieder to authenticated;/.test(ohne)
  && !/grant select on table[^;]*klassen_mitglieder[^;]*to authenticated/.test(ohne));
pruefe('schule_versuche: fuer Nutzer weder lesbar noch schreibbar', !/grant[^;]*schule_versuche[^;]*to authenticated/.test(ohne.replace(/to service_role;/g, '')));
const revoke = (n, t) => new RegExp(`revoke all on function public\\.${n}\\(${t.join(', ')}\\) from anon, authenticated, public;`).test(ohne);
const grant = (n, t) => new RegExp(`grant execute on function public\\.${n}\\(${t.join(', ')}\\) to authenticated;`).test(ohne);
pruefe('jede Funktion: erst allen genommen, dann nur angemeldeten Nutzern gegeben (nie anon)',
  funktionen.every((f) => revoke(f.name, f.typen) && grant(f.name, f.typen)) && !/grant execute on function[^;]*\banon\b/.test(ohne),
  funktionen.filter((f) => !revoke(f.name, f.typen) || !grant(f.name, f.typen)).map((f) => `${f.name}(${f.typen.join(', ')})`));
pruefe('Policies: Klassen nur die Leitung, Mitglieder Leitung und selbst, Fortschritt Leitung und selbst, Aufgaben Leitung und Mitglieder',
  /on public\.klassen for select\s+to authenticated\s+using \(\(select auth\.uid\(\)\) = leitung\);/.test(ohne)
  && /on public\.klassen_mitglieder for select\s+to authenticated\s+using \(\(select auth\.uid\(\)\) = user_id or public\.schule_leitet\(klasse\)\);/.test(ohne)
  && /on public\.klassen_fortschritt for select\s+to authenticated\s+using \(public\.schule_leitet\(klasse\) or public\.schule_ist_mein_mitglied\(mitglied\)\);/.test(ohne)
  && /on public\.klassen_aufgaben for select\s+to authenticated\s+using \(public\.schule_leitet\(klasse\) or public\.schule_mitglied_in\(klasse\)\);/.test(ohne)
  && (ohne.match(/create policy/g) || []).length === 4 && !/create policy[^;]*for (insert|update|delete|all)/.test(ohne));
pruefe('Loeschen: Konto weg -> Klassen, Mitgliedschaften und Versuche weg (on delete cascade)',
  (ohne.match(/references auth\.users \(id\) on delete cascade/g) || []).length === 3
  && (ohne.match(/references public\.klassen \(id\) on delete cascade/g) || []).length === 3
  && /references public\.klassen_mitglieder \(id\) on delete cascade/.test(ohne));
pruefe('geschlossene Klassen nach 90 Tagen weg (Aufraeumen beim Anlegen)',
  /delete from public\.klassen t where not t\.aktiv and t\.geschlossen_am < now\(\) - interval '90 days';/.test(fn('schule_erstelle_klasse').rumpf));

// ---------- Fehler-Kennungen ----------
const kennungen = [...new Set([...ohne.matchAll(/'(SCHULE_[A-Z_]+)'/g)].map((m) => m[1]))].sort();
const texte = Object.keys(TEXTE).filter((k) => /^SCHULE_/.test(k) && k !== 'SCHULE_NAME_UNGUELTIG_KLASSE').sort();
pruefe('Fehler-Kennungen: jede im Schema hat einen Satz in js/schule.js und umgekehrt', JSON.stringify(kennungen) === JSON.stringify(texte), { kennungen, texte });
pruefe('Saetze: ohne Druck, ohne Countdown, echte Umlaute', Object.values(TEXTE).every((t) => !/nur noch|letzte Chance|beeil|verpasst du|\d+\s*(h|Std|min)\b/i.test(t))
  && TEXTE.SCHULE_KLASSE_VOLL.includes(String(GRENZEN.mitglieder)) && /20 eigene Klassen und 10 Klassen/.test(TEXTE.SCHULE_ZU_VIELE_KLASSEN)
  && TEXTE.SCHULE_ZU_VIELE_AUFGABEN.includes(String(GRENZEN.aufgaben)) && TEXTE.SCHULE_AUFGABE_UNGUELTIG.includes(`1 bis ${GRENZEN.anzahl}`));

// ---------- Grenzen, Bots, Zeichen ----------
pruefe('Grenzen im Schema = GRENZEN in js/schule.js (60 Mitglieder, 20 Klassen, 10 Mitgliedschaften, 30 Aufgaben, Anzahl 100)',
  /t\.klasse = k\.id\) >= 60 then/.test(fn('schule_tritt_bei').rumpf) && GRENZEN.mitglieder === 60
  && /t\.leitung = uid\) >= 20 then/.test(fn('schule_erstelle_klasse').rumpf) && GRENZEN.klassen === 20
  && /t\.user_id = uid\) >= 10 then/.test(fn('schule_tritt_bei').rumpf) && GRENZEN.mitgliedschaften === 10
  && /t\.klasse = k\.id\) >= 30 then/.test(fn('schule_aufgabe_anlegen').rumpf) && GRENZEN.aufgaben === 30
  && /v_zahl > 100/.test(fn('schule_aufgabe_anlegen').rumpf) && GRENZEN.anzahl === 100);
const sqlBots = ((fn('schule_aufgabe_anlegen').rumpf.match(/not in \(('benno'[\s\S]*?)\)/) || [])[1] || '').match(/'([a-z]+)'/g) || [];
pruefe('Bot-Aufgaben: genau die zehn Bots der Leiter aus js/bots.js', JSON.stringify(sqlBots.map((b) => b.slice(1, -1))) === JSON.stringify(BOTS.map((b) => b.id)), sqlBots);
pruefe('Arten: bot, raetsel, partien (Tabelle, Funktion, js/schule.js)', JSON.stringify(ARTEN) === '["bot","raetsel","partien"]'
  && /art in \('bot', 'raetsel', 'partien'\)/.test(ohne) && /v_art not in \('bot', 'raetsel', 'partien'\)/.test(fn('schule_aufgabe_anlegen').rumpf));
pruefe('Fehlerarten: dieselben vier Zugklassen-IDs im Schema und in js/schule.js',
  ohne.includes(`not in (${FEHLER_ARTEN.map((a) => `'${a}'`).join(', ')})`) && FEHLER_ARTEN.length === 4);
pruefe('Code: 6 Zeichen ohne 0, O, 1, I (wie im Online-Fundament), gleiches Alphabet im Schema und in js/schule.js',
  CODE_ZEICHEN === 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' && ohne.includes(`'^[${CODE_ZEICHEN}]{6}$'`)
  && ohne.includes(`zeichen constant text := '${CODE_ZEICHEN}';`) && !/[0O1I]/.test(CODE_ZEICHEN.replace(/[A-HJ-NP-Z2-9]/g, '')));
pruefe('Code aus gen_random_uuid (kryptografischer Zufall), nie aus random()', /uuid_send\(gen_random_uuid\(\)\)/.test(fn('schule_erstelle_klasse').rumpf)
  && !/random\(\)/.test(ohne.replace(/gen_random_uuid\(\)/g, '')));
pruefe('Anzeigename: dieselben Zeichen in Tabelle, Funktion und js/schule.js', (ohne.match(/'\^\[A-Za-zÀ-ÖØ-öø-ÿĀ-ž0-9 \.''-\]\+\$'/g) || []).length === 2
  && pruefeAnzeigename("Anna-Lena O'Neil").ok && pruefeAnzeigename('Änne Øyvind').ok && !pruefeAnzeigename('anna@schule.de').ok);
pruefe('Fehlversuche beim Beitreten: ohne raise gezaehlt (sonst rollte der Zaehler zurueck), 10 je Tag',
  /return jsonb_build_object\('fehler', 'SCHULE_CODE_UNGUELTIG'\);/.test(fn('schule_tritt_bei').rumpf)
  && /v\.tag = v_tag\), 0\) >= 10 then\s+raise exception 'SCHULE_ZU_VIELE_VERSUCHE';/.test(fn('schule_tritt_bei').rumpf));
pruefe('Beitritt sperrt die Klasse (Mitglieder zaehlen nacheinander)', /where t\.code = v_code for update;/.test(fn('schule_tritt_bei').rumpf));
pruefe('Fehlversuche: Beitritte eines Kontos laufen nacheinander (Sperre je Nutzer vor dem Lesen des Zaehlers)',
  /perform pg_advisory_xact_lock\(hashtextextended\('schule_versuche:' \|\| uid::text, 0\)\);\s+if coalesce\(\(select v\.anzahl from public\.schule_versuche/
    .test(fn('schule_tritt_bei').rumpf));
pruefe('Fortschritt: vom Stand nur der Tag (aktualisiert_am date, Europe/Berlin), keine Uhrzeit, auch nicht beim direkten Lesen',
  /aktualisiert_am date not null default \(\(now\(\) at time zone 'Europe\/Berlin'\)::date\),/.test(ohne) && !/aktualisiert_am timestamptz/.test(ohne)
  && /public\.schule_heute\(\)\)\s+on conflict \(mitglied\) do update/.test(fn('schule_melde_fortschritt').rumpf)
  && !/now\(\)/.test(fn('schule_melde_fortschritt').rumpf)
  && /alter column aktualisiert_am type date\s+using \(\(aktualisiert_am at time zone 'Europe\/Berlin'\)::date\);/.test(ohne));
pruefe('Uebersicht und Meine Klassen geben weder user_id noch leitung heraus',
  !/'user_id'|'leitung', k\.leitung|'email'/.test(fn('schule_klassen_uebersicht').rumpf + fn('schule_meine_klassen').rumpf)
  && /'leitung', coalesce/.test(fn('schule_meine_klassen').rumpf));

// ---------- Test-Datei ----------
const test = lies('supabase/schule-rls-test.sql');
pruefe('schule-rls-test.sql: in einer Transaktion, rollt zurueck, meldet Erfolg', /^begin;/m.test(test) && /rollback;\s*$/.test(test)
  && test.includes("'Schule-RLS-Test erfolgreich'"));
pruefe('schule-rls-test.sql: anon, Leitung, Mitglieder, Fremde, zweite Leitung, Grenzen, Konto loeschen',
  test.includes("set local role anon;") && ['11111111-1111-4111-8111-111111111111', 'a1111111-1111-4111-8111-111111111111', 'b2222222-2222-4222-8222-222222222222',
    'f3333333-3333-4333-8333-333333333333', 'd4444444-4444-4444-8444-444444444444'].every((u) => test.includes(`"sub":"${u}"`))
  && ['SCHULE_KLASSE_VOLL', 'SCHULE_ZU_VIELE_KLASSEN', 'SCHULE_ZU_VIELE_VERSUCHE', 'SCHULE_NAME_VERGEBEN', 'SCHULE_KLASSE_GESCHLOSSEN']
    .every((k) => test.includes(`'${k}'`)) && /delete from auth\.users where id = 'a1111111/.test(test));
pruefe('schule-rls-test.sql: jede Kennung des Schemas kommt im Test vor (ausser SCHULE_KEIN_CODE)',
  kennungen.filter((k) => k !== 'SCHULE_KEIN_CODE').every((k) => test.includes(k)), kennungen.filter((k) => !test.includes(k)));

// ---------- Keine Geheimnisse, keine Preise, keine E-Mail-Adressen ----------
{
  const dateien = ['supabase/schule-schema.sql', 'supabase/schule-rls-test.sql', 'js/schule.js', 'js/pakete/schule/index.js', 'js/ui/schule.js',
    'css/pakete/schule.css', 'design/runde4/SCHULE.md'];
  const GEHEIM_RE = /(sk|rk)_(live|test)_[A-Za-z0-9]{8,}|whsec_[A-Za-z0-9]{12,}|sb_secret_[A-Za-z0-9_-]{12,}|eyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]{10,}|service_role_key/i;
  const PREIS_RE = /\d+(?:[.,]\d{1,2})?\s*(?:€|EUR\b|Euro\b)|€\s*\d/;
  const MAIL_RE = /[A-Za-z0-9._%+-]+@(?!example\.invalid\b)[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
  const funde = [];
  for (const d of dateien) {
    let t = '';
    try { t = lies(d); } catch (e) { funde.push(d + ' fehlt'); continue; }
    if (GEHEIM_RE.test(t)) funde.push(d + ': Geheimnis ' + t.match(GEHEIM_RE)[0].slice(0, 12));
    if (PREIS_RE.test(t)) funde.push(d + ': Preis ' + t.match(PREIS_RE)[0]);
    const ohneBeispiele = t.replace(/(lehrer|anna)@schule\.de|a@b\.de/g, '');
    if (MAIL_RE.test(ohneBeispiele)) funde.push(d + ': E-Mail ' + ohneBeispiele.match(MAIL_RE)[0]);
  }
  pruefe(`keine Schluessel, Preise oder echten E-Mail-Adressen in ${dateien.length} Dateien des Schulmodus`, funde.length === 0, funde);
  pruefe('Muster fangen Beispiele', GEHEIM_RE.test('sb_secret_' + 'abcdefghijkl') && PREIS_RE.test('4,99 €') && MAIL_RE.test('jemand' + '@beispiel-post.de')
    && !MAIL_RE.test('schule-a@example.invalid'));
}

console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
