// Functions-Probe (21.11.2026): sind die Edge Functions auf dem Server bereitgestellt? Anlass: online-zug fehlte seit dem
// 29.10. auf dem Server, kein Test merkte es, Online-Zuege gingen fuer niemanden. Fragt je Ordner unter supabase/functions/
// (ausser _gemeinsam und anderen mit _) genau einmal per POST ohne Anmeldung und ohne Schluessel ab:
//   der erwartete Status "da" je Function = bereitgestellt (401 mit JWT-Pruefung; 400 bei den Webhooks, die mit
//                       --no-verify-jwt bereitgestellt sind und ohne Stripe-Signatur ablehnen, Codex-Bericht 21.11.)
//   404                 = fehlt (gemessen 21.11.: {"code":"NOT_FOUND","message":"Requested function was not found"})
//   alles andere, kein Netz, Zeitlimit = unklar (zaehlt nie als bereitgestellt; ein Webhook mit 401 waere falsch bereitgestellt)
// Je Function steht in werkzeuge/functions-pflicht.json der erwartete Status und die Pflicht: "jetzt" (fehlt = Fehler),
// "warnung" (fehlt = Warnung, kein Fehler) oder keine (darf bis "pflicht_ab" fehlen). Eine Function, die dort nicht
// eingeordnet ist, oder ein Eintrag ohne Ordner ist ein Fehler: die Liste muss mit dem Repo mitwachsen.
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

// { name: { da, rolle: 'pflicht' | 'warnung' | 'darf-fehlen', ab } }; ein Eintrag ohne gueltigen "da"-Status ist ein
// Fehler beim Laden (sonst wuerde jede Antwort still als unklar gelten)
export function ladePflicht(datei = join(WURZEL, 'werkzeuge', 'functions-pflicht.json')) {
  const d = JSON.parse(readFileSync(datei, 'utf8'));
  const aus = {};
  for (const [name, f] of Object.entries(d.functions || {})) {
    if (!Number.isInteger(f?.da) || f.da === 404) throw new Error(`functions-pflicht.json: ${name} braucht "da" (z. B. 401 oder 400)`);
    aus[name] = { da: f.da, rolle: f.pflicht === 'jetzt' ? 'pflicht' : f.pflicht === 'warnung' ? 'warnung' : 'darf-fehlen', ab: f.pflicht_ab || '' };
  }
  return aus;
}

export function deute(status, da) {
  if (status === 404) return 'fehlt';
  return status === da ? 'da' : 'unklar';
}

async function frage(basis, name, da, fetchFn) {
  const ab = new AbortController();
  const uhr = setTimeout(() => ab.abort(), FRIST_MS);
  try {
    const r = await fetchFn(`${basis.replace(/\/+$/, '')}/functions/v1/${encodeURIComponent(name)}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', signal: ab.signal, redirect: 'manual' });
    let kennung = '';
    try { const t = await r.text(); kennung = String(JSON.parse(t)?.code || '').slice(0, 60); } catch (e) { /* kein JSON */ }
    return { name, status: r.status, stand: deute(r.status, da), kennung };
  } catch (e) {
    return { name, status: null, stand: 'unklar', kennung: e?.name === 'AbortError' ? 'Zeitlimit' : 'kein Netz' };
  } finally {
    clearTimeout(uhr);
  }
}

// Ergebnis: { ok, functions: [{ name, status, erwartet, stand, kennung, rolle, ab }], fehlendePflicht, unklarePflicht,
// warnungen: [{ name, stand, ab }], nichtEingeordnet, pflichtOhneOrdner }. Warnungen machen ok nicht falsch.
export async function pruefe({ basis = BASIS, fetchFn = (...a) => fetch(...a), functions = functionsImRepo(), pflicht = ladePflicht() } = {}) {
  // nacheinander: hoechstens eine Anfrage je Function, keine Last auf dem Server
  const liste = [];
  for (const n of functions) {
    const p = pflicht[n];
    // nicht eingeordnet: trotzdem fragen (fuer den Bericht), erwartet wird dann 401
    liste.push({ ...(await frage(basis, n, p ? p.da : 401, fetchFn)), erwartet: p ? p.da : null, rolle: p ? p.rolle : 'nicht-eingeordnet', ab: p ? p.ab : '' });
  }
  const fehlendePflicht = liste.filter((f) => f.rolle === 'pflicht' && f.stand === 'fehlt').map((f) => f.name);
  const unklarePflicht = liste.filter((f) => f.rolle === 'pflicht' && f.stand === 'unklar').map((f) => f.name);
  const warnungen = liste.filter((f) => f.rolle === 'warnung' && f.stand !== 'da').map((f) => ({ name: f.name, stand: f.stand, ab: f.ab }));
  const nichtEingeordnet = liste.filter((f) => f.rolle === 'nicht-eingeordnet').map((f) => f.name);
  const pflichtOhneOrdner = Object.keys(pflicht).filter((n) => !functions.includes(n));
  const ok = !fehlendePflicht.length && !unklarePflicht.length && !nichtEingeordnet.length && !pflichtOhneOrdner.length;
  return { ok, functions: liste, fehlendePflicht, unklarePflicht, warnungen, nichtEingeordnet, pflichtOhneOrdner };
}

export function bericht(e) {
  const zeilen = e.functions.map((f) => `${f.stand === 'da' ? 'da    ' : f.stand === 'fehlt' ? 'FEHLT ' : 'UNKLAR'} ${f.name.padEnd(20)} ${String(f.status ?? '-').padEnd(4)}`
    + ` ${f.erwartet ? '(soll ' + f.erwartet + ') ' : ''}${f.rolle}${f.ab ? ', Pflicht ab: ' + f.ab : ''}${f.kennung ? '  (' + f.kennung + ')' : ''}`);
  for (const w of e.warnungen) zeilen.push(`WARNUNG ${w.name} ${w.stand === 'fehlt' ? 'fehlt' : 'antwortet unerwartet'} auf dem Server, Pflicht ${w.ab} (kein Fehler, solange das nicht ansteht)`);
  if (e.fehlendePflicht.length) zeilen.push(`FEHLER Pflicht-Function fehlt auf dem Server: ${e.fehlendePflicht.join(', ')} (bereitstellen: supabase functions deploy <name>)`);
  if (e.unklarePflicht.length) zeilen.push(`FEHLER Pflicht-Function nicht pruefbar (kein Netz, Zeitlimit oder unerwartete Antwort): ${e.unklarePflicht.join(', ')}`);
  if (e.nichtEingeordnet.length) zeilen.push(`FEHLER nicht in werkzeuge/functions-pflicht.json eingeordnet: ${e.nichtEingeordnet.join(', ')}`);
  if (e.pflichtOhneOrdner.length) zeilen.push(`FEHLER Eintrag in functions-pflicht.json ohne Ordner unter supabase/functions/: ${e.pflichtOhneOrdner.join(', ')}`);
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
