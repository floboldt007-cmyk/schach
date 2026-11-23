// werkzeuge/rpc-probe.mjs (22.11.2026): erkennt Datenbank-Funktionen, die im Repo stehen, aber auf dem Server fehlen oder
// veraltete Parameter haben. Anlass: online_zug_verbuchen fehlte vom 29.10. bis 22.11. live, Online-Zuege sprangen zurueck.
// Geprueft gegen einen nachgebauten Server (node:http, nur 127.0.0.1), der wie PostgREST antwortet (am 22.11. live gemessen):
// vorhanden und fuer anon gesperrt 401 {"code":"42501"}, fehlend oder andere Parameter 404 {"code":"PGRST202"}. Kein Netz.
//   node tests/rpc-probe.test.mjs
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { leseSchema, gesperrtFuerAnon, pruefe, ladePflicht, deute, bericht, probeWert } from '../werkzeuge/rpc-probe.mjs';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let ok = 0, gesamt = 0;
function pruefeT(name, wert, extra = '') { gesamt++; if (wert) { ok++; console.log('ok     ' + name); } else console.log('FEHLER ' + name + (extra !== '' ? '  -> ' + extra : '')); }

// 1. Schema lesen: Parameter, Trigger, Sammel-revoke mit mehreren Funktionen (Fehlalarm der ersten Inventur am 22.11.)
const SQL = `
create or replace function public.alpha(partie uuid, zug text default null) returns void language sql as $$ select 1 $$;
create or replace function public.beta() returns integer language sql as $$ select 1 $$;
create or replace function public.gamma(n int) returns int language sql as $$ select 1 $$;
create or replace function public.ausloeser() returns trigger language plpgsql as $$ begin return new; end $$;
create or replace function public.offen(x int) returns int language sql as $$ select 1 $$;
create or replace function public.zeile(p public.partien_online) returns int language sql as $$ select 1 $$;
revoke all on function public.zeile(public.partien_online) from anon;
-- create or replace function public.kommentiert(a int) returns int
revoke all on function public.alpha(uuid, text), public.beta(),
  public.gamma(integer) from public, anon, authenticated;
grant execute on function public.gamma(integer) to authenticated;
grant execute on function public.offen(integer) to anon;
`;
const fn = leseSchema(SQL);
const namen = fn.map((f) => f.name).sort().join(',');
pruefeT('Schema: Funktionen ohne Trigger und ohne Kommentar', namen === 'alpha,beta,gamma,offen,zeile', namen);
pruefeT('Schema: Parameternamen in Reihenfolge', fn.find((f) => f.name === 'alpha')?.parameter.join(',') === 'partie,zug');
pruefeT('Schema: Funktion ohne Parameter', fn.find((f) => f.name === 'beta')?.parameter.length === 0);
const gesperrt = gesperrtFuerAnon(SQL);
pruefeT('Sammel-revoke sperrt jede Funktion der Liste (auch die zweite und dritte)', gesperrt.has('alpha') && gesperrt.has('beta') && gesperrt.has('gamma'), [...gesperrt].join(','));
pruefeT('grant an anon hebt die Sperre auf (wird nicht befragt)', !gesperrt.has('offen'));

// 2. Deutung der Antworten
pruefeT('401 + 42501 = da', deute(401, '42501') === 'da');
pruefeT('404 + PGRST202 = fehlt', deute(404, 'PGRST202') === 'fehlt');
pruefeT('200 = anon darf ausfuehren (Rechte live nicht eingespielt)', deute(200, '') === 'offen');
pruefeT('400 (Umwandlung scheitert vor der Rechtepruefung) = unklar, kein Sicherheitsbefund', deute(400, '22P02') === 'unklar');
pruefeT('25006 (wollte in der Nur-Lese-Transaktion schreiben) = offen', deute(405, '25006') === 'offen');
pruefeT('Probe-Werte passend zum Typ', probeWert('uuid') === '00000000-0000-0000-0000-000000000000' && probeWert('integer') === '0'
  && probeWert('boolean') === 'false' && probeWert('timestamptz') === '2000-01-01T00:00:00Z' && probeWert('text[]') === '{}' && probeWert('text') === 'x');
pruefeT('Schema: Typen ohne default', fn.find((f) => f.name === 'alpha')?.typen.join(',') === 'uuid,text', fn.find((f) => f.name === 'alpha')?.typen.join(','));
pruefeT('anderes (503, kein Netz) = unklar', deute(503, '') === 'unklar' && deute(null, '') === 'unklar');

// 3. Gegen nachgebauten Server
const anfragen = [];
let vorhanden = new Map();   // name -> 'parameter,namen' (sortiert) | 'offen'
const server = createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  const name = decodeURIComponent((u.pathname.match(/^\/rest\/v1\/rpc\/([^/]+)$/) || [])[1] || '');
  const param = [...u.searchParams.keys()].sort().join(',');
  anfragen.push({ name, methode: req.method, apikey: req.headers.apikey, auth: req.headers.authorization, param });
  const soll = vorhanden.get(name);
  if (u.searchParams.get('partie') === 'x') { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ code: '22P02' })); return; }
  let st = 404, body = { code: 'PGRST202', message: 'Could not find the function' };
  if (soll === 'offen') { st = 200; body = null; } else if (soll !== undefined && soll === param) { st = 401; body = { code: '42501', message: 'permission denied for function ' + name }; }
  res.writeHead(st, { 'Content-Type': 'application/json' }); res.end(body ? JSON.stringify(body) : '');
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASIS = `http://127.0.0.1:${server.address().port}`;
const DATEIEN = { 'a-schema.sql': SQL, 'b-schema.sql': 'create or replace function public.neu(p uuid) returns void language sql as $$ select 1 $$;\nrevoke all on function public.neu(uuid) from public, anon;' };
const PFLICHT = { 'a-schema.sql': { rolle: 'pflicht', ab: '' }, 'b-schema.sql': { rolle: 'warnung', ab: 'Zwei Ligen live' } };
const lauf = (v, extra = {}) => { vorhanden = new Map(Object.entries(v)); anfragen.length = 0; return pruefe({ basis: BASIS, schluessel: 'sb_publishable_test', dateien: DATEIEN, pflicht: PFLICHT, ...extra }); };

let e = await lauf({ alpha: 'partie,zug', beta: '', gamma: 'n', neu: 'p' });
pruefeT('alles da: ok', e.ok, bericht(e));
pruefeT('Parameter als ganze Tabellenzeile: nicht befragt, aber gezaehlt', e.ungeprueft.includes('a-schema.sql: zeile'), e.ungeprueft.join(','));
pruefeT('nur gesperrte Funktionen befragt (offen nicht)', anfragen.map((a) => a.name).sort().join(',') === 'alpha,beta,gamma,neu', anfragen.map((a) => a.name).join(','));
pruefeT('nur GET (Nur-Lese-Transaktion, nichts wird gebucht)', anfragen.every((a) => a.methode === 'GET'));
pruefeT('mit apikey, ohne Anmeldung', anfragen.every((a) => a.apikey === 'sb_publishable_test' && !a.auth));

e = await lauf({ alpha: 'partie,zug', beta: '', neu: 'p' });
pruefeT('Pflicht-Funktion fehlt: nicht ok, im Bericht genannt', !e.ok && e.fehlendePflicht.includes('a-schema.sql: gamma(n)') && /FEHLT/.test(bericht(e)), bericht(e));

e = await lauf({ alpha: 'partie', beta: '', gamma: 'n', neu: 'p' });
pruefeT('veraltete Parameter (der Fall vom 22.11.) zaehlen als fehlt', !e.ok && e.fehlendePflicht.includes('a-schema.sql: alpha(partie,zug)'), e.fehlendePflicht.join(';'));

e = await lauf({ alpha: 'partie,zug', beta: '', gamma: 'n' });
pruefeT('Warnungs-Datei fehlt: ok bleibt, Warnung im Bericht', e.ok && e.warnungen.length === 1 && /WARNUNG/.test(bericht(e)), bericht(e));

e = await lauf({ alpha: 'partie,zug', beta: 'offen', gamma: 'n', neu: 'p' });
pruefeT('live offene Rechte sind ein Fehler (Sicherheit), auch bei Warnungs-Datei', !e.ok && e.offen.includes('a-schema.sql: beta()'), bericht(e));

e = await lauf({ alpha: 'partie,zug', beta: '', gamma: 'n', neu: 'p' }, { pflicht: { 'a-schema.sql': { rolle: 'pflicht', ab: '' } } });
pruefeT('Schema-Datei ohne Eintrag in der Pflicht-Liste ist ein Fehler', !e.ok && e.nichtEingeordnet.includes('b-schema.sql'));

e = await lauf({}, { basis: 'http://127.0.0.1:1' });
pruefeT('kein Server: unklar, nie ok', !e.ok && e.unklarePflicht.length > 0);

// 4. Repo: echte Schema-Dateien und echte Pflicht-Liste passen zusammen
const echt = ladePflicht();
const { readdirSync } = await import('node:fs');
const imRepo = readdirSync(path.join(WURZEL, 'supabase')).filter((d) => /schema\.sql$/.test(d)).sort();
pruefeT('jede supabase/*schema.sql steht in werkzeuge/rpc-pflicht.json', imRepo.every((d) => echt[d]), imRepo.filter((d) => !echt[d]).join(','));
pruefeT('kein Eintrag ohne Datei', Object.keys(echt).every((d) => imRepo.includes(d)));
pruefeT('online-schema.sql ist Pflicht (Anlass)', echt['online-schema.sql']?.rolle === 'pflicht');
const { readFileSync } = await import('node:fs');
const online = readFileSync(path.join(WURZEL, 'supabase/online-schema.sql'), 'utf8');
pruefeT('echtes Schema: online_zug_verbuchen wird mit 9 Parametern befragt', leseSchema(online).some((f) => f.name === 'online_zug_verbuchen' && f.parameter.length === 9) && gesperrtFuerAnon(online).has('online_zug_verbuchen'));

server.close();
console.log(`\n${ok}/${gesamt} bestanden`);
process.exitCode = ok === gesamt ? 0 : 1;
