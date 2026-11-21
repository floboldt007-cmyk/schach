// Functions-Probe (21.11.2026): sind die Edge Functions auf dem Server bereitgestellt? Anlass: online-zug fehlte seit dem
// 29.10. auf dem Server, kein Test merkte es, Online-Zuege gingen fuer niemanden. Fragt je Ordner unter supabase/functions/
// (ausser _gemeinsam und anderen mit _) genau einmal per POST ohne Anmeldung und ohne Schluessel ab:
//   401/400/403/405/2xx = bereitgestellt (der Server kennt die Function; ohne Anmeldung antwortet er 401)
//   404                 = fehlt (gemessen 21.11.: {"code":"NOT_FOUND","message":"Requested function was not found"})
//   alles andere, kein Netz, Zeitlimit = unklar (zaehlt nie als bereitgestellt)
// Welche Pflicht sind, steht in werkzeuge/functions-pflicht.json. Eine Function, die dort nicht eingeordnet ist, oder ein
// Pflicht-Eintrag ohne Ordner ist ein Fehler: die Liste muss mit dem Repo mitwachsen.
// Schreibt nichts, liest keinen Schluessel. Der Leib ist {}: keine Function handelt ohne Anmeldung bzw. ohne Signatur.
//   node werkzeuge/functions-probe.mjs                 Ausgang 0 = alle Pflicht-Functions da, sonst 1
//   node werkzeuge/functions-probe.mjs --json          dasselbe als JSON
//   node werkzeuge/functions-probe.mjs --basis <url>   anderer Server (Tests: nachgebauter Server)
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..');
export const BASIS = 'https://usaamcqypmvgqmsbfecb.supabase.co';
const FRIST_MS = 10000;

export function functionsImRepo(ordner = join(WURZEL, 'supabase', 'functions')) {
  return readdirSync(ordner).filter((n) => !n.startsWith('_') && !n.startsWith('.') && statSync(join(ordner, n)).isDirectory()).sort();
}

export function ladePflicht(datei = join(WURZEL, 'werkzeuge', 'functions-pflicht.json')) {
  const d = JSON.parse(readFileSync(datei, 'utf8'));
  return { pflicht: Array.isArray(d.pflicht) ? d.pflicht : [], duerfenFehlen: d.duerfenFehlen && typeof d.duerfenFehlen === 'object' ? d.duerfenFehlen : {} };
}

export function deute(status) {
  if (status === 404) return 'fehlt';
  if (status === 401 || status === 400 || status === 403 || status === 405 || (status >= 200 && status < 300)) return 'da';
  return 'unklar';
}

async function frage(basis, name, fetchFn) {
  const ab = new AbortController();
  const uhr = setTimeout(() => ab.abort(), FRIST_MS);
  try {
    const r = await fetchFn(`${basis.replace(/\/+$/, '')}/functions/v1/${encodeURIComponent(name)}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', signal: ab.signal, redirect: 'manual' });
    let kennung = '';
    try { const t = await r.text(); kennung = String(JSON.parse(t)?.code || '').slice(0, 60); } catch (e) { /* kein JSON */ }
    return { name, status: r.status, stand: deute(r.status), kennung };
  } catch (e) {
    return { name, status: null, stand: 'unklar', kennung: e?.name === 'AbortError' ? 'Zeitlimit' : 'kein Netz' };
  } finally {
    clearTimeout(uhr);
  }
}

// Ergebnis: { ok, functions: [{ name, status, stand, kennung, rolle }], fehlendePflicht, unklarePflicht, nichtEingeordnet, pflichtOhneOrdner }
export async function pruefe({ basis = BASIS, fetchFn = (...a) => fetch(...a), functions = functionsImRepo(), pflicht = ladePflicht() } = {}) {
  const darf = new Set(Object.keys(pflicht.duerfenFehlen));
  const muss = new Set(pflicht.pflicht);
  // nacheinander: hoechstens eine Anfrage je Function, keine Last auf dem Server
  const liste = [];
  for (const n of functions) liste.push({ ...(await frage(basis, n, fetchFn)), rolle: muss.has(n) ? 'pflicht' : darf.has(n) ? 'darf-fehlen' : 'nicht-eingeordnet' });
  const fehlendePflicht = liste.filter((f) => f.rolle === 'pflicht' && f.stand === 'fehlt').map((f) => f.name);
  const unklarePflicht = liste.filter((f) => f.rolle === 'pflicht' && f.stand === 'unklar').map((f) => f.name);
  const nichtEingeordnet = liste.filter((f) => f.rolle === 'nicht-eingeordnet').map((f) => f.name);
  const pflichtOhneOrdner = [...muss].filter((n) => !functions.includes(n));
  const ok = !fehlendePflicht.length && !unklarePflicht.length && !nichtEingeordnet.length && !pflichtOhneOrdner.length;
  return { ok, functions: liste, fehlendePflicht, unklarePflicht, nichtEingeordnet, pflichtOhneOrdner };
}

export function bericht(e) {
  const zeilen = e.functions.map((f) => `${f.stand === 'da' ? 'da    ' : f.stand === 'fehlt' ? 'FEHLT ' : 'UNKLAR'} ${f.name.padEnd(20)} ${String(f.status ?? '-').padEnd(4)} ${f.rolle}${f.kennung ? '  (' + f.kennung + ')' : ''}`);
  if (e.fehlendePflicht.length) zeilen.push(`FEHLER Pflicht-Function fehlt auf dem Server: ${e.fehlendePflicht.join(', ')} (bereitstellen: supabase functions deploy <name>)`);
  if (e.unklarePflicht.length) zeilen.push(`FEHLER Pflicht-Function nicht pruefbar (kein Netz, Zeitlimit oder unerwartete Antwort): ${e.unklarePflicht.join(', ')}`);
  if (e.nichtEingeordnet.length) zeilen.push(`FEHLER nicht in werkzeuge/functions-pflicht.json eingeordnet: ${e.nichtEingeordnet.join(', ')}`);
  if (e.pflichtOhneOrdner.length) zeilen.push(`FEHLER Pflicht ohne Ordner unter supabase/functions/: ${e.pflichtOhneOrdner.join(', ')}`);
  zeilen.push(e.ok ? 'OK alle Pflicht-Functions sind bereitgestellt' : 'NICHT OK');
  return zeilen.join('\n');
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const args = process.argv.slice(2);
  const i = args.indexOf('--basis');
  const basis = i >= 0 ? args[i + 1] : BASIS;
  if (i >= 0 && !/^https?:\/\//.test(basis || '')) { console.error('--basis braucht eine Adresse mit http(s)://'); process.exit(2); }
  const e = await pruefe({ basis });
  console.log(args.includes('--json') ? JSON.stringify(e, null, 2) : bericht(e));
  // exitCode statt process.exit: unter Windows bricht Node sonst mit offenen fetch-Verbindungen ab (libuv-Assertion,
  // Ausgang 3221226505 statt 0/1, gemessen 21.11.2026)
  process.exitCode = e.ok ? 0 : 1;
}
