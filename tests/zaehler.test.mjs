// Etappe B, Task 8: Tageszaehler ohne Personenbezug, gebaut und AUS bis zur Rechtspruefung.
// Client js/zaehler.js mit Fake-fetch (kein Netz) und Vertrag der SQL-Dateien (supabase/zaehler-*.sql), ohne Datenbank.
// Die SQL selbst fuehrt tests/server-zaehler.test.mjs im CI-Job "sql" aus (PGlite).
// node tests/zaehler.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import * as Z from '../js/zaehler.js';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lies = (d) => readFileSync(path.join(WURZEL, d), 'utf8');
const ohneKommentar = (sql) => sql.replace(/--[^\n]*/g, '');

const ergebnisse = [];
async function pruefe(name, fn) {
  try { await fn(); ergebnisse.push(true); console.log('ok   ' + name); }
  catch (e) { ergebnisse.push(false); console.error('FEHLER ' + name + ': ' + e.message); }
}

// Fake-fetch: merkt jede Anfrage, antwortet je RPC-Name
function fake(antworten) {
  const anfragen = [];
  const fn = async (url, opt = {}) => {
    const name = String(url).split('/rest/v1/rpc/')[1];
    anfragen.push({ url: String(url), name, headers: opt.headers || {}, body: opt.body === undefined ? undefined : JSON.parse(opt.body) });
    const a = antworten[name];
    if (a instanceof Error) throw a;
    return { ok: true, status: 200, json: async () => a };
  };
  return { fn, anfragen };
}

// ---------- Client ----------
await pruefe('zaehle sendet nichts, wenn der Server aus sagt (zaehler_an -> false)', async () => {
  const f = fake({ zaehler_an: false, zaehler_erhoehe: true });
  Z.setzeZaehlerFetch(f.fn);
  await Z.zaehle('suche.ki_gegner');
  await Z.zaehle('suche.mensch', 3);
  assert.deepEqual(f.anfragen.map((a) => a.name), ['zaehler_an']);
});

await pruefe('Schalter wird nur einmal pro Sitzung gefragt', async () => {
  const f = fake({ zaehler_an: true, zaehler_erhoehe: true });
  Z.setzeZaehlerFetch(f.fn);
  await Z.zaehle('suche.ki_gegner');
  await Z.zaehle('suche.ki_gegner');
  await Z.zaehle('kronen.bot', 2);
  assert.deepEqual(f.anfragen.map((a) => a.name), ['zaehler_an', 'zaehler_erhoehe', 'zaehler_erhoehe', 'zaehler_erhoehe']);
});

await pruefe('Koerper nur Schluessel und Zahl, ohne Anmeldung (kein Authorization), nur der oeffentliche Schluessel', async () => {
  const f = fake({ zaehler_an: true, zaehler_erhoehe: true });
  Z.setzeZaehlerFetch(f.fn);
  await Z.zaehle('suche.wartezeit_s', 7);
  const e = f.anfragen.find((a) => a.name === 'zaehler_erhoehe');
  assert.deepEqual(e.body, { schluessel: 'suche.wartezeit_s', um: 7 });
  const kopf = Object.keys(e.headers).map((k) => k.toLowerCase()).sort();
  assert.deepEqual(kopf, ['apikey', 'content-type']);
  for (const a of f.anfragen) assert.ok(!('Authorization' in a.headers) && !('authorization' in a.headers));
});

await pruefe('unbekannter Schluessel und Unsinn-Zahlen werden gar nicht gesendet bzw. begrenzt', async () => {
  const f = fake({ zaehler_an: true, zaehler_erhoehe: true });
  Z.setzeZaehlerFetch(f.fn);
  await Z.zaehle('nutzer.email');
  await Z.zaehle('suche.mensch', NaN);
  await Z.zaehle('suche.mensch', 0);
  await Z.zaehle('suche.mensch', 99999);
  await Z.zaehle('suche.mensch', 2.7);
  const um = f.anfragen.filter((a) => a.name === 'zaehler_erhoehe').map((a) => a.body.um);
  assert.deepEqual(um, [1000, 2]);
  assert.ok(!f.anfragen.some((a) => a.body && a.body.schluessel === 'nutzer.email'));
});

await pruefe('Fehler werden geschluckt (offline, Server-Fehler, kaputte Antwort)', async () => {
  Z.setzeZaehlerFetch(async () => { throw new Error('offline'); });
  await Z.zaehle('suche.mensch');
  Z.setzeZaehlerFetch(async () => ({ ok: false, status: 500, json: async () => ({ message: 'x' }) }));
  await Z.zaehle('suche.mensch');
  const f = fake({ zaehler_an: true, zaehler_erhoehe: new Error('weg') });
  Z.setzeZaehlerFetch(f.fn);
  await Z.zaehle('suche.mensch');
  assert.equal(f.anfragen.length, 2);
});

await pruefe('Server-Fehler beim Schalter zaehlt als aus (nichts senden, nicht erneut fragen)', async () => {
  let n = 0;
  Z.setzeZaehlerFetch(async () => { n++; return { ok: false, status: 503, json: async () => null }; });
  await Z.zaehle('suche.mensch');
  await Z.zaehle('suche.mensch');
  assert.equal(n, 1);
});

// ---------- Vertrag der SQL-Dateien ----------
const schema = lies('supabase/zaehler-schema.sql');
const test = lies('supabase/zaehler-rls-test.sql');
const zurueck = lies('supabase/zaehler-zurueck.sql');
const s = ohneKommentar(schema);

await pruefe('Schema: Kopf nennt die Voraussetzung kronen-schema.sql (Schalter kronen_schalter.zaehler_an)', () => {
  const kopf = schema.split('\n').slice(0, 15).join('\n');
  assert.match(kopf, /kronen-schema\.sql/);
  assert.match(s, /public\.kronen_schalter/);
  assert.match(s, /zaehler_an/);
});

await pruefe('Schema: zaehler_tag ohne Nutzer-, Geraete- oder Adress-Spalte', () => {
  const m = s.match(/create table if not exists public\.zaehler_tag \(([\s\S]*?)\n\);/);
  assert.ok(m, 'create table public.zaehler_tag fehlt');
  const spalten = m[1].split('\n').map((z) => z.trim()).filter((z) => z && !/^(primary key|constraint|check)/.test(z)).map((z) => z.split(/\s+/)[0]);
  assert.deepEqual(spalten, ['tag', 'schluessel', 'wert']);
  assert.doesNotMatch(m[1], /user|uid|geraet|device|ip|session|auth\./i);
});

await pruefe('Schema: Zeilenschutz an, keine Tabellenrechte fuer Nutzer, Funktionen security definer mit leerem search_path', () => {
  assert.match(s, /alter table public\.zaehler_tag enable row level security/);
  assert.match(s, /revoke all on table public\.zaehler_tag from anon, authenticated, public/);
  const fns = [...s.matchAll(/create or replace function public\.(zaehler_\w+)\(([^)]*)\)[\s\S]*?\$\$;/g)];
  assert.deepEqual(fns.map((x) => x[1]).sort(), ['zaehler_an', 'zaehler_erhoehe']);
  for (const x of fns) {
    assert.match(x[0], /security definer/, x[1]);
    assert.match(x[0], /set search_path = ''/, x[1]);
  }
});

await pruefe('Schema: schaltet den Zaehler nie selbst an', () => {
  assert.doesNotMatch(s, /zaehler_an\s*=\s*true/i);
  assert.doesNotMatch(s, /zaehler_an boolean not null default true/i);
  assert.doesNotMatch(s, /update public\.kronen_schalter/i);
});

await pruefe('Schema: erlaubte Schluessel wie im Client (ZAEHLER_SCHLUESSEL)', () => {
  const m = s.match(/array\[([^\]]*)\]::text\[\]/);
  assert.ok(m, 'Liste der erlaubten Schluessel fehlt');
  const sql = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
  assert.deepEqual(sql, [...Z.ZAEHLER_SCHLUESSEL]);
  assert.deepEqual([...Z.ZAEHLER_SCHLUESSEL], ['suche.wartezeit_s', 'suche.ki_gegner', 'suche.mensch', 'kronen.online', 'kronen.ki', 'kronen.bot']);
});

await pruefe('Schema: Rechte nur zum Aufrufen der zwei Funktionen', () => {
  assert.match(s, /grant execute on function public\.zaehler_erhoehe\(text, integer\) to anon, authenticated/);
  assert.match(s, /grant execute on function public\.zaehler_an\(\) to anon, authenticated/);
  assert.doesNotMatch(s, /grant (select|insert|update|delete|all)[^;]*zaehler_tag/i);
});

await pruefe('RLS-Test: begin ... rollback, jede Funktion kommt vor, Abschnitte aus/an/unbekannt/lesen', () => {
  const t = ohneKommentar(test).trim();
  assert.match(t, /^begin;/);
  assert.match(t, /rollback;$/);
  for (const fn of ['zaehler_erhoehe', 'zaehler_an']) assert.match(t, new RegExp('public\\.' + fn + '\\('), fn);
  for (const a of ['Zaehler aus', 'Zaehler an', 'unbekannter Schluessel', 'Nutzer liest nicht']) assert.ok(test.includes(a), a);
});

await pruefe('Rueckweg: entfernt beide Funktionen und die Tabelle, beruehrt kronen_schalter nicht', () => {
  const z = ohneKommentar(zurueck);
  assert.match(z, /drop function if exists public\.zaehler_erhoehe\(text, integer\)/);
  assert.match(z, /drop function if exists public\.zaehler_an\(\)/);
  assert.match(z, /drop table if exists public\.zaehler_tag/);
  assert.doesNotMatch(z, /kronen_schalter/);
});

await pruefe('Server-Test steht im CI-Job sql', () => {
  const wf = lies('.github/workflows/tests.yml');
  const sqlJob = wf.split(/\n  sql:\n/)[1].split(/\n  [a-z]+:\n/)[0];
  assert.match(sqlJob, /node tests\/server-zaehler\.test\.mjs/);
});

const ok = ergebnisse.filter(Boolean).length;
console.log(`\n${ok}/${ergebnisse.length} bestanden`);
process.exit(ok === ergebnisse.length ? 0 : 1);
