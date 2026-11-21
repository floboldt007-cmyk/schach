// werkzeuge/functions-probe.mjs (21.11.2026): erkennt fehlende Edge Functions auf dem Server. Geprueft gegen einen
// nachgebauten Server (node:http, nur 127.0.0.1), der wie Supabase antwortet: bereitgestellt 401 UNAUTHORIZED_NO_AUTH_HEADER,
// fehlend 404 NOT_FOUND (beides am 21.11. live gemessen). Kein Netz nach draussen.
//   node tests/functions-probe.test.mjs
import { createServer } from 'node:http';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { pruefe, functionsImRepo, ladePflicht, deute } from '../werkzeuge/functions-probe.mjs';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let ok = 0, gesamt = 0;
function pruefeT(name, wert, extra = '') { gesamt++; if (wert) { ok++; console.log('ok     ' + name); } else console.log('FEHLER ' + name + (extra !== '' ? '  -> ' + extra : '')); }

// Server: antwort[name] = Status (Vorgabe 404 wie Supabase fuer Unbekanntes); merkt jede Anfrage
const anfragen = [];
let antwort = {};
const server = createServer((req, res) => {
  let leib = '';
  req.on('data', (c) => { leib += c; });
  req.on('end', () => {
    const name = decodeURIComponent((req.url.match(/^\/functions\/v1\/([^/?]+)/) || [])[1] || '');
    anfragen.push({ name, methode: req.method, kopf: req.headers, leib });
    const st = antwort[name] ?? 404;
    const body = st === 404 ? { code: 'NOT_FOUND', message: 'Requested function was not found' }
      : st === 401 ? { code: 'UNAUTHORIZED_NO_AUTH_HEADER', message: 'Missing authorization header' } : { fehler: 'x' };
    res.writeHead(st, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body));
  });
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASIS = `http://127.0.0.1:${server.address().port}`;
const ALLE = ['coach', 'online-zug', 'raetsel-duell', 'stripe-webhook', 'werkstatt-kasse', 'werkstatt-webhook'];
const PFLICHT = { pflicht: ['online-zug', 'raetsel-duell'], duerfenFehlen: { coach: '', 'stripe-webhook': '', 'werkstatt-kasse': '', 'werkstatt-webhook': '' } };
const lauf = (a, extra = {}) => { antwort = a; anfragen.length = 0; return pruefe({ basis: BASIS, functions: ALLE, pflicht: PFLICHT, ...extra }); };

try {
  // Stand heute (live gemessen): Pflicht da, die vier anderen fehlen
  let e = await lauf({ 'online-zug': 401, 'raetsel-duell': 401 });
  pruefeT('Heutiger Stand: ok (Pflicht da, die anderen duerfen fehlen)', e.ok, JSON.stringify(e));
  pruefeT('Genau eine Anfrage je Function', anfragen.length === ALLE.length && new Set(anfragen.map((x) => x.name)).size === ALLE.length, anfragen.length);
  pruefeT('Nur POST, Leib {}, ohne Authorization und ohne apikey',
    anfragen.every((x) => x.methode === 'POST' && x.leib === '{}' && !x.kopf.authorization && !x.kopf.apikey), JSON.stringify(anfragen.map((x) => x.kopf)));

  // der Vorfall vom 21.11.: online-zug fehlt
  e = await lauf({ 'raetsel-duell': 401 });
  pruefeT('online-zug fehlt: nicht ok, genau online-zug gemeldet', !e.ok && JSON.stringify(e.fehlendePflicht) === '["online-zug"]', JSON.stringify(e.fehlendePflicht));
  e = await lauf({});
  pruefeT('Beide Pflicht fehlen: beide gemeldet', JSON.stringify(e.fehlendePflicht) === '["online-zug","raetsel-duell"]', JSON.stringify(e.fehlendePflicht));

  // 400 und 405 zaehlen als bereitgestellt (z. B. eine Function ohne JWT-Pruefung, die den leeren Leib ablehnt)
  e = await lauf({ 'online-zug': 400, 'raetsel-duell': 405 });
  pruefeT('400 und 405 = bereitgestellt', e.ok, JSON.stringify(e.functions));
  // 500 ist nie "da"
  e = await lauf({ 'online-zug': 500, 'raetsel-duell': 401 });
  pruefeT('500 bei Pflicht: unklar, nicht ok', !e.ok && JSON.stringify(e.unklarePflicht) === '["online-zug"]', JSON.stringify(e));
  pruefeT('deute: 404 fehlt, 401 da, 502 unklar', deute(404) === 'fehlt' && deute(401) === 'da' && deute(502) === 'unklar');

  // neue Function im Repo, nicht eingeordnet: Fehler, damit die Liste mitwaechst
  e = await lauf({ 'online-zug': 401, 'raetsel-duell': 401, neu: 401 }, { functions: [...ALLE, 'neu'] });
  pruefeT('Nicht eingeordnete Function: nicht ok, gemeldet', !e.ok && JSON.stringify(e.nichtEingeordnet) === '["neu"]', JSON.stringify(e.nichtEingeordnet));
  // Pflicht ohne Ordner
  e = await lauf({ 'online-zug': 401, 'raetsel-duell': 401 }, { pflicht: { ...PFLICHT, pflicht: [...PFLICHT.pflicht, 'weg'] } });
  pruefeT('Pflicht ohne Ordner: nicht ok, gemeldet', !e.ok && JSON.stringify(e.pflichtOhneOrdner) === '["weg"]', JSON.stringify(e.pflichtOhneOrdner));

  // kein Netz: unklar, nie ok
  e = await pruefe({ basis: 'http://127.0.0.1:1', functions: ['online-zug'], pflicht: { pflicht: ['online-zug'], duerfenFehlen: {} } });
  pruefeT('Kein Netz: unklar, nicht ok', !e.ok && e.functions[0].stand === 'unklar', JSON.stringify(e.functions));

  // echte Liste passt zum Repo: jede Function eingeordnet, jede Pflicht hat einen Ordner
  const repo = functionsImRepo(); const p = ladePflicht();
  const eingeordnet = new Set([...p.pflicht, ...Object.keys(p.duerfenFehlen)]);
  pruefeT('functions-pflicht.json ordnet jede Function im Repo ein', repo.every((n) => eingeordnet.has(n)), repo.filter((n) => !eingeordnet.has(n)).join(','));
  pruefeT('_gemeinsam wird nicht abgefragt', !repo.includes('_gemeinsam'));
  pruefeT('Pflicht heute: online-zug und raetsel-duell', JSON.stringify(p.pflicht) === '["online-zug","raetsel-duell"]', JSON.stringify(p.pflicht));

  // Kommandozeile gegen den nachgebauten Server: Ausgang und Liste (in eigenem Prozess, der Server laeuft hier weiter)
  const cli = (a) => new Promise((res) => {
    antwort = a;
    import('node:child_process').then(({ spawn }) => {
      const k = spawn(process.execPath, ['werkzeuge/functions-probe.mjs', '--basis', BASIS], { cwd: WURZEL });
      let aus = ''; k.stdout.on('data', (d) => { aus += d; }); k.stderr.on('data', (d) => { aus += d; });
      k.on('close', (code) => res({ code, aus }));
    });
  });
  let c = await cli({ 'online-zug': 401, 'raetsel-duell': 401 });
  pruefeT('Kommandozeile: Ausgang 0, wenn Pflicht da', c.code === 0 && /OK alle Pflicht-Functions/.test(c.aus), c.code + ' ' + c.aus);
  c = await cli({ 'raetsel-duell': 401 });
  pruefeT('Kommandozeile: Ausgang 1 und klare Zeile, wenn online-zug fehlt', c.code === 1 && /Pflicht-Function fehlt auf dem Server: online-zug/.test(c.aus), c.code + ' ' + c.aus);
  const falsch = spawnSync(process.execPath, ['werkzeuge/functions-probe.mjs', '--basis', 'ftp://x'], { cwd: WURZEL, encoding: 'utf8' });
  pruefeT('Kommandozeile: falsche --basis ist Ausgang 2', falsch.status === 2, falsch.status);
} finally {
  server.close();
}
console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
