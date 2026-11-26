// werkzeuge/functions-probe.mjs (21.11.2026): erkennt fehlende Edge Functions auf dem Server. Geprueft gegen einen
// nachgebauten Server (node:http, nur 127.0.0.1), der wie Supabase antwortet: bereitgestellt 401 UNAUTHORIZED_NO_AUTH_HEADER,
// fehlend 404 NOT_FOUND (beides am 21.11. live gemessen), Webhooks ohne Signatur 400 (Codex-Bericht 21.11.). Kein Netz nach draussen.
//   node tests/functions-probe.test.mjs
import { createServer } from 'node:http';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
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
const PFLICHT = {
  'online-zug': { da: 401, rolle: 'pflicht', ab: '' }, 'raetsel-duell': { da: 401, rolle: 'pflicht', ab: '' },
  coach: { da: 401, rolle: 'darf-fehlen', ab: 'Coach-Paket an' }, 'stripe-webhook': { da: 400, rolle: 'warnung', ab: 'vor dem Aboverkauf' },
  'werkstatt-kasse': { da: 401, rolle: 'darf-fehlen', ab: 'Kasse frei' }, 'werkstatt-webhook': { da: 400, rolle: 'darf-fehlen', ab: 'Kasse frei' },
};
const lauf = (a, extra = {}) => { antwort = a; anfragen.length = 0; return pruefe({ basis: BASIS, functions: ALLE, pflicht: PFLICHT, ...extra }); };

try {
  // Stand heute (live gemessen): Pflicht da, die vier anderen fehlen
  let e = await lauf({ 'online-zug': 401, 'raetsel-duell': 401 });
  pruefeT('Heutiger Stand: ok (Pflicht da, die anderen duerfen fehlen)', e.ok, JSON.stringify(e));
  pruefeT('Heutiger Stand: stripe-webhook fehlt als Warnung, nicht als Fehler',
    JSON.stringify(e.warnungen.map((w) => [w.name, w.stand])) === '[["stripe-webhook","fehlt"]]', JSON.stringify(e.warnungen));
  pruefeT('Genau eine Anfrage je Function', anfragen.length === ALLE.length && new Set(anfragen.map((x) => x.name)).size === ALLE.length, anfragen.length);
  pruefeT('Nur POST, Leib {}, ohne Authorization und ohne apikey',
    anfragen.every((x) => x.methode === 'POST' && x.leib === '{}' && !x.kopf.authorization && !x.kopf.apikey), JSON.stringify(anfragen.map((x) => x.kopf)));

  // der Vorfall vom 21.11.: online-zug fehlt
  e = await lauf({ 'raetsel-duell': 401 });
  pruefeT('online-zug fehlt: nicht ok, genau online-zug gemeldet', !e.ok && JSON.stringify(e.fehlendePflicht) === '["online-zug"]', JSON.stringify(e.fehlendePflicht));
  e = await lauf({});
  pruefeT('Beide Pflicht fehlen: beide gemeldet', JSON.stringify(e.fehlendePflicht) === '["online-zug","raetsel-duell"]', JSON.stringify(e.fehlendePflicht));

  // Webhooks (--no-verify-jwt) antworten ohne Signatur 400: das ist "da"; alles bereitgestellt = keine Warnung
  e = await lauf({ 'online-zug': 401, 'raetsel-duell': 401, coach: 401, 'stripe-webhook': 400, 'werkstatt-kasse': 401, 'werkstatt-webhook': 400 });
  pruefeT('Alles bereitgestellt: ok, Webhooks mit 400 = da, keine Warnung',
    e.ok && e.functions.every((f) => f.stand === 'da') && !e.warnungen.length, JSON.stringify(e.functions));
  // ein Webhook mit 401 ist falsch bereitgestellt (mit JWT-Pruefung, Stripe kaeme nicht durch): unklar, als Warnung
  e = await lauf({ 'online-zug': 401, 'raetsel-duell': 401, 'stripe-webhook': 401 });
  pruefeT('stripe-webhook mit 401 statt 400: Warnung "antwortet unerwartet", trotzdem ok',
    e.ok && JSON.stringify(e.warnungen.map((w) => [w.name, w.stand])) === '[["stripe-webhook","unklar"]]', JSON.stringify(e.warnungen));
  // eine Pflicht-Function mit 400 statt 401 (z. B. ohne JWT-Pruefung bereitgestellt): unklar, nicht ok
  e = await lauf({ 'online-zug': 400, 'raetsel-duell': 401 });
  pruefeT('Pflicht antwortet 400 statt 401: unklar, nicht ok', !e.ok && JSON.stringify(e.unklarePflicht) === '["online-zug"]', JSON.stringify(e));
  // ein fehlender Webhook der Kasse ist heute weder Fehler noch Warnung
  e = await lauf({ 'online-zug': 401, 'raetsel-duell': 401, 'stripe-webhook': 400 });
  pruefeT('coach, werkstatt-kasse, werkstatt-webhook fehlen: ok, ohne Warnung', e.ok && !e.warnungen.length, JSON.stringify(e));
  // 500 ist nie "da"
  e = await lauf({ 'online-zug': 500, 'raetsel-duell': 401 });
  pruefeT('500 bei Pflicht: unklar, nicht ok', !e.ok && JSON.stringify(e.unklarePflicht) === '["online-zug"]', JSON.stringify(e));
  pruefeT('deute: 404 fehlt, erwarteter Status da, jeder andere unklar', deute(404, 401) === 'fehlt' && deute(401, 401) === 'da'
    && deute(400, 400) === 'da' && deute(401, 400) === 'unklar' && deute(400, 401) === 'unklar' && deute(502, 401) === 'unklar');

  // neue Function im Repo, nicht eingeordnet: Fehler, damit die Liste mitwaechst
  e = await lauf({ 'online-zug': 401, 'raetsel-duell': 401, neu: 401 }, { functions: [...ALLE, 'neu'] });
  pruefeT('Nicht eingeordnete Function: nicht ok, gemeldet', !e.ok && JSON.stringify(e.nichtEingeordnet) === '["neu"]', JSON.stringify(e.nichtEingeordnet));
  // Pflicht ohne Ordner
  e = await lauf({ 'online-zug': 401, 'raetsel-duell': 401 }, { pflicht: { ...PFLICHT, weg: { da: 401, rolle: 'pflicht', ab: '' } } });
  pruefeT('Eintrag ohne Ordner: nicht ok, gemeldet', !e.ok && JSON.stringify(e.pflichtOhneOrdner) === '["weg"]', JSON.stringify(e.pflichtOhneOrdner));

  // kein Netz: unklar, nie ok
  e = await pruefe({ basis: 'http://127.0.0.1:1', functions: ['online-zug'], pflicht: { 'online-zug': PFLICHT['online-zug'] } });
  pruefeT('Kein Netz: unklar, nicht ok', !e.ok && e.functions[0].stand === 'unklar', JSON.stringify(e.functions));

  // echte Liste passt zum Repo: jede Function eingeordnet, jede Pflicht hat einen Ordner
  const repo = functionsImRepo(); const p = ladePflicht();
  pruefeT('functions-pflicht.json ordnet jede Function im Repo ein', repo.every((n) => n in p), repo.filter((n) => !(n in p)).join(','));
  pruefeT('functions-pflicht.json hat keinen Eintrag ohne Ordner', Object.keys(p).every((n) => repo.includes(n)), Object.keys(p).join(','));
  pruefeT('_gemeinsam wird nicht abgefragt', !repo.includes('_gemeinsam'));
  const rolle = (r) => Object.keys(p).filter((n) => p[n].rolle === r).sort();
  pruefeT('Pflicht heute: online-zug und raetsel-duell', JSON.stringify(rolle('pflicht')) === '["online-zug","raetsel-duell"]', JSON.stringify(rolle('pflicht')));
  pruefeT('Warnung: stripe-webhook (Pflicht vor dem Aboverkauf)', JSON.stringify(rolle('warnung')) === '["stripe-webhook"]' && !!p['stripe-webhook'].ab, JSON.stringify(rolle('warnung')));
  // 400 heisst: ohne JWT-Pruefung bereitgestellt (Webhooks, und was die ANLEITUNG mit --no-verify-jwt bereitstellt,
  // z. B. abo-beenden: Kuendigen ohne Anmeldung, die Function prueft die Anmeldung selbst). Alle anderen 401.
  const ohneJwt = new Set(['abo-beenden']);
  const anleitung = readFileSync(path.join(WURZEL, 'supabase/ANLEITUNG.md'), 'utf8');
  pruefeT('Webhooks und --no-verify-jwt erwarten 400, die anderen 401', [...ohneJwt].every((n) => anleitung.includes(`functions deploy ${n} --no-verify-jwt`))
    && Object.keys(p).every((n) => p[n].da === (/-webhook$/.test(n) || ohneJwt.has(n) ? 400 : 401)), JSON.stringify({ p, ohneJwt: [...ohneJwt] }));
  pruefeT('Wer fehlen darf, nennt pflicht_ab', Object.keys(p).filter((n) => p[n].rolle !== 'pflicht').every((n) => p[n].ab), JSON.stringify(p));
  // eine Liste ohne "da" wird abgelehnt, statt still jede Antwort als unklar zu deuten
  const tmp = path.join(mkdtempSync(path.join(tmpdir(), 'fp-')), 'p.json');
  writeFileSync(tmp, JSON.stringify({ functions: { 'online-zug': { pflicht: 'jetzt' } } }));
  let abgelehnt = false; try { ladePflicht(tmp); } catch (err) { abgelehnt = /braucht "da"/.test(err.message); }
  pruefeT('Eintrag ohne "da": Fehler beim Laden', abgelehnt);

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
  pruefeT('Kommandozeile: Warnzeile fuer stripe-webhook, kein FEHLER', /WARNUNG stripe-webhook fehlt/.test(c.aus) && !/FEHLER/.test(c.aus), c.aus);
  c = await cli({ 'raetsel-duell': 401 });
  pruefeT('Kommandozeile: Ausgang 1 und klare Zeile, wenn online-zug fehlt', c.code === 1 && /Pflicht-Function fehlt auf dem Server: online-zug/.test(c.aus), c.code + ' ' + c.aus);
  const falsch = spawnSync(process.execPath, ['werkzeuge/functions-probe.mjs', '--basis', 'ftp://x'], { cwd: WURZEL, encoding: 'utf8' });
  pruefeT('Kommandozeile: falsche --basis ist Ausgang 2', falsch.status === 2, falsch.status);
} finally {
  server.close();
}
console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
