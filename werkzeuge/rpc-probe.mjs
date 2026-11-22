// RPC-Probe (22.11.2026): stehen die Datenbank-Funktionen aus supabase/*schema.sql auch auf dem Server, und zwar mit genau
// den Parametern des Repos? Anlass: online_zug_verbuchen (Anti-Cheat Etappe 1a, 29.10.) wurde nie eingespielt; die Edge
// Function online-zug war da (functions-probe gruen), bekam aber 24 Tage lang "nicht_eingerichtet sql", jeder Online-Zug
// sprang zurueck. Schwester von werkzeuge/functions-probe.mjs (die prueft die Edge Functions, diese die SQL-Funktionen).
//
// So fragt sie, ohne etwas auszuloesen:
//   - nur Funktionen, die das Schema fuer anon sperrt (revoke ... from ... anon, kein grant an anon/public); Trigger nie
//   - je Funktion EIN GET /rest/v1/rpc/<name>?<jeder Parametername>=x mit dem oeffentlichen Schluessel, ohne Anmeldung.
//     GET laeuft bei PostgREST in einer Nur-Lese-Transaktion: selbst wenn ein Recht live fehlte, wird nichts gebucht.
//   Antwort (live gemessen 22.11.2026):
//     401 {"code":"42501"}   = da (Funktion mit genau diesen Parameternamen vorhanden, anon gesperrt)
//     404 {"code":"PGRST202"} = fehlt ODER andere Parameter als im Repo (veraltete Fassung eingespielt)
//     200/204 oder 25006      = offen: anon darf live ausfuehren, obwohl das Schema sperrt (Rechte nicht eingespielt)
//     sonst (auch 400), kein Netz = unklar (zaehlt nie als da). Werte passend zum Typ (probeWert), sonst scheitert schon
//                              die Umwandlung vor der Rechtepruefung.
// Je Schema-Datei steht in werkzeuge/rpc-pflicht.json die Pflicht: "jetzt" (fehlt = Fehler), "warnung" (fehlt = Warnung)
// oder keine (darf bis "pflicht_ab" fehlen). "offen" ist immer ein Fehler. Eine Schema-Datei ohne Eintrag ist ein Fehler.
// Steht eine Funktion mit denselben Parametern in mehreren Dateien, wird sie einmal gefragt und zaehlt fuer jede.
//   node werkzeuge/rpc-probe.mjs                 Ausgang 0 = ok, sonst 1
//   node werkzeuge/rpc-probe.mjs --json          dasselbe als JSON
//   node werkzeuge/rpc-probe.mjs --basis <url>   anderer Server (Tests: nachgebauter Server)
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..');
export const BASIS = 'https://usaamcqypmvgqmsbfecb.supabase.co';
const FRIST_MS = 10000;
const GLEICHZEITIG = 4;

const ohneKommentare = (sql) => sql.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[^\n]*/g, '');

// Inhalt einer Klammer ab Position i (i zeigt auf '('), mit Verschachtelung (numeric(10,2), default now())
function klammer(t, i) {
  let tiefe = 0;
  for (let j = i; j < t.length; j++) {
    if (t[j] === '(') tiefe++;
    else if (t[j] === ')' && --tiefe === 0) return t.slice(i + 1, j);
  }
  return null;
}
function teileOben(s) {
  const teile = []; let tiefe = 0; let start = 0;
  for (let j = 0; j < s.length; j++) {
    if (s[j] === '(') tiefe++; else if (s[j] === ')') tiefe--;
    else if (s[j] === ',' && tiefe === 0) { teile.push(s.slice(start, j)); start = j + 1; }
  }
  teile.push(s.slice(start));
  return teile.map((x) => x.trim()).filter(Boolean);
}

// [{ name, parameter: [namen] }] ohne Trigger; out-Parameter zaehlen nicht (PostgREST nimmt sie nicht entgegen)
export function leseSchema(sql) {
  const t = ohneKommentare(sql);
  const aus = [];
  for (const m of t.matchAll(/create\s+(?:or\s+replace\s+)?function\s+public\.(\w+)\s*(?=\()/gi)) {
    const auf = m.index + m[0].length;
    const innen = klammer(t, auf);
    if (innen == null) continue;
    const rest = t.slice(auf + innen.length + 2, auf + innen.length + 200);
    if (/^\s*returns\s+trigger\b/i.test(rest)) continue;
    const teile = teileOben(innen).map((p) => p.split(/\s+/)).filter((w) => !/^(out)$/i.test(w[0]))
      .map((w) => (/^(in|inout|variadic)$/i.test(w[0]) ? w.slice(1) : w));
    const parameter = teile.map((w) => w[0].replace(/"/g, ''));
    const typen = teile.map((w) => w.slice(1).join(' ').replace(/\s+default\b.*$/i, '').replace(/\s*=.*$/, '').trim().toLowerCase());
    aus.push({ name: m[1], parameter, typen });
  }
  return aus;
}

// Namen, die das Schema fuer anon sperrt: in einem "revoke ... on function <liste> from <rollen mit anon>" (auch Sammel-
// revokes mit mehreren Funktionen) und ohne spaeteres "grant ... to anon/public"
export function gesperrtFuerAnon(sql) {
  const t = ohneKommentare(sql);
  const gesperrt = new Set();
  for (const m of t.matchAll(/revoke\s+[^;]*?\bon\s+function\s+([^;]*?)\bfrom\b([^;]*);/gi)) {
    if (!/\banon\b/i.test(m[2])) continue;
    for (const f of m[1].matchAll(/public\.(\w+)\s*\(/gi)) gesperrt.add(f[1]);
  }
  for (const m of t.matchAll(/grant\s+[^;]*?\bon\s+function\s+([^;]*?)\bto\b([^;]*);/gi)) {
    if (!/\b(anon|public)\b/i.test(m[2])) continue;
    for (const f of m[1].matchAll(/public\.(\w+)\s*\(/gi)) gesperrt.delete(f[1]);
  }
  return gesperrt;
}

export function schemaDateien(ordner = join(WURZEL, 'supabase')) {
  const aus = {};
  for (const d of readdirSync(ordner).filter((n) => /schema\.sql$/.test(n)).sort()) aus[d] = readFileSync(join(ordner, d), 'utf8');
  return aus;
}

// { datei: { rolle: 'pflicht' | 'warnung' | 'darf-fehlen', ab } }
export function ladePflicht(datei = join(WURZEL, 'werkzeuge', 'rpc-pflicht.json')) {
  const d = JSON.parse(readFileSync(datei, 'utf8'));
  const aus = {};
  for (const [name, f] of Object.entries(d.dateien || {})) {
    aus[name] = { rolle: f.pflicht === 'jetzt' ? 'pflicht' : f.pflicht === 'warnung' ? 'warnung' : 'darf-fehlen', ab: f.pflicht_ab || '' };
  }
  return aus;
}

// Der oeffentliche Schluessel der App (steht ohnehin in jeder ausgelieferten Seite); kein Geheimnis
export function oeffentlicherSchluessel(datei = join(WURZEL, 'js', 'konto-config.js')) {
  const m = readFileSync(datei, 'utf8').match(/SUPABASE_KEY\s*=\s*'([^']+)'/);
  if (!m || !/^sb_publishable_/.test(m[1])) throw new Error('js/konto-config.js: kein oeffentlicher Schluessel (sb_publishable_...)');
  return m[1];
}

// Ein Wert, den Postgres in den Typ umwandeln kann: sonst scheitert die Umwandlung (400, 22P02) VOR der Rechtepruefung und
// die Antwort sagt nichts (gemessen 22.11.: 'x' fuer uuid gab 400, die Null-UUID 401 42501)
export function probeWert(typ = '') {
  const t = String(typ).toLowerCase();
  if (/\[\]$/.test(t)) return '{}';
  if (/^uuid/.test(t)) return '00000000-0000-0000-0000-000000000000';
  if (/^(int|integer|bigint|smallint|int2|int4|int8|numeric|real|double|float|decimal)/.test(t)) return '0';
  if (/^bool/.test(t)) return 'false';
  if (/^date$/.test(t)) return '2000-01-01'; // INTENTIONAL-SPECIAL-CASE: beliebiges gueltiges Datum, nur fuer die Typumwandlung
  if (/^(timestamp|timestamptz)/.test(t)) return '2000-01-01T00:00:00Z';
  if (/^jsonb?$/.test(t)) return '{}';
  return 'x';
}

// Nur 401+42501 heisst da. offen = die Funktion lief fuer anon (200/204) oder wollte schreiben und traf die Nur-Lese-
// Transaktion (25006). Alles andere (auch 400 bei unbekanntem Typ) ist unklar, nie da und nie ein Sicherheitsbefund.
export function deute(status, code) {
  if (status === 401 && code === '42501') return 'da';
  if (status === 404 && code === 'PGRST202') return 'fehlt';
  if (status === 200 || status === 204 || code === '25006') return 'offen';
  return 'unklar';
}

async function frage(basis, schluessel, f, fetchFn) {
  const ab = new AbortController();
  const uhr = setTimeout(() => ab.abort(), FRIST_MS);
  const q = f.parameter.map((p, i) => `${encodeURIComponent(p)}=${encodeURIComponent(probeWert((f.typen || [])[i]))}`).join('&');
  try {
    const r = await fetchFn(`${basis.replace(/\/+$/, '')}/rest/v1/rpc/${encodeURIComponent(f.name)}${q ? '?' + q : ''}`,
      { method: 'GET', headers: { apikey: schluessel }, signal: ab.signal, redirect: 'manual' });
    let code = '';
    try { code = String(JSON.parse(await r.text())?.code || '').slice(0, 20); } catch (e) { /* kein JSON */ }
    return { status: r.status, code, stand: deute(r.status, code) };
  } catch (e) {
    return { status: null, code: e?.name === 'AbortError' ? 'Zeitlimit' : 'kein Netz', stand: 'unklar' };
  } finally {
    clearTimeout(uhr);
  }
}

// Ergebnis: { ok, funktionen: [{ datei, name, parameter, status, code, stand, rolle, ab }], fehlendePflicht, unklarePflicht,
// offen, warnungen: [{ datei, funktion, stand, ab }], nichtEingeordnet, pflichtOhneDatei, ungeprueft: [datei: name] }
export async function pruefe({ basis = BASIS, schluessel, fetchFn = (...a) => fetch(...a), dateien = schemaDateien(), pflicht = ladePflicht() } = {}) {
  const key = schluessel || oeffentlicherSchluessel();
  const eintraege = [];
  const ungeprueft = [];
  for (const [datei, sql] of Object.entries(dateien)) {
    const gesperrt = gesperrtFuerAnon(sql);
    for (const f of leseSchema(sql)) {
      // Parameter vom Typ einer ganzen Tabellenzeile (p public.partien_online) laesst sich per Adresse nicht fuellen, die
      // Umwandlung scheitert vor der Rechtepruefung (live 400): interne Helfer, nicht befragt, aber im Bericht gezaehlt
      if (gesperrt.has(f.name) && !(f.typen || []).some((t) => /^public\./.test(t))) eintraege.push({ datei, ...f, schl: f.name + '(' + f.parameter.join(',') + ')' });
      else ungeprueft.push(`${datei}: ${f.name}`);
    }
  }
  // jede Signatur genau einmal fragen, hoechstens GLEICHZEITIG Anfragen zugleich
  const signaturen = [...new Map(eintraege.map((e) => [e.schl, e])).values()];
  const antwort = new Map();
  let naechste = 0;
  await Promise.all(Array.from({ length: Math.min(GLEICHZEITIG, signaturen.length) }, async () => {
    while (naechste < signaturen.length) {
      const s = signaturen[naechste++];
      antwort.set(s.schl, await frage(basis, key, s, fetchFn));
    }
  }));
  const funktionen = eintraege.map((e) => {
    const p = pflicht[e.datei];
    return { datei: e.datei, name: e.name, parameter: e.parameter, ...antwort.get(e.schl), rolle: p ? p.rolle : 'nicht-eingeordnet', ab: p ? p.ab : '' };
  });
  const kurz = (f) => `${f.datei}: ${f.name}(${f.parameter.join(',')})`;
  const fehlendePflicht = funktionen.filter((f) => f.rolle === 'pflicht' && f.stand === 'fehlt').map(kurz);
  const unklarePflicht = funktionen.filter((f) => f.rolle === 'pflicht' && f.stand === 'unklar').map(kurz);
  const offen = funktionen.filter((f) => f.stand === 'offen').map(kurz);
  const warnungen = funktionen.filter((f) => f.rolle === 'warnung' && (f.stand === 'fehlt' || f.stand === 'unklar'))
    .map((f) => ({ datei: f.datei, funktion: `${f.name}(${f.parameter.join(',')})`, stand: f.stand, ab: f.ab }));
  const nichtEingeordnet = Object.keys(dateien).filter((d) => !pflicht[d]);
  const pflichtOhneDatei = Object.keys(pflicht).filter((d) => !(d in dateien));
  const ok = !fehlendePflicht.length && !unklarePflicht.length && !offen.length && !nichtEingeordnet.length && !pflichtOhneDatei.length;
  return { ok, funktionen, fehlendePflicht, unklarePflicht, offen, warnungen, nichtEingeordnet, pflichtOhneDatei, ungeprueft, anfragen: signaturen.length };
}

export function bericht(e) {
  const z = [];
  const jeDatei = new Map();
  for (const f of e.funktionen) {
    if (!jeDatei.has(f.datei)) jeDatei.set(f.datei, { da: 0, nicht: [], rolle: f.rolle });
    const d = jeDatei.get(f.datei);
    if (f.stand === 'da') d.da++; else d.nicht.push(`${f.stand === 'fehlt' ? 'FEHLT' : f.stand === 'offen' ? 'OFFEN' : 'UNKLAR'} ${f.name}(${f.parameter.join(',')})${f.status ? ' ' + f.status : ''}`);
  }
  for (const [datei, d] of jeDatei) {
    z.push(`${d.nicht.length ? '!!' : 'ok'} ${datei.padEnd(34)} ${d.da} da${d.nicht.length ? ', ' + d.nicht.length + ' nicht' : ''} (${d.rolle})`);
    for (const n of d.nicht) z.push('     ' + n);
  }
  for (const w of e.warnungen) z.push(`WARNUNG ${w.datei}: ${w.funktion} ${w.stand} auf dem Server${w.ab ? ', Pflicht ab: ' + w.ab : ''} (kein Fehler)`);
  if (e.fehlendePflicht.length) z.push(`FEHLER Pflicht-Funktion fehlt oder hat andere Parameter: ${e.fehlendePflicht.join('; ')} (Schema-Datei im SQL-Editor einspielen)`);
  if (e.offen.length) z.push(`FEHLER anon darf live ausfuehren, obwohl das Schema sperrt (Rechte einspielen): ${e.offen.join('; ')}`);
  if (e.unklarePflicht.length) z.push(`FEHLER Pflicht-Funktion nicht pruefbar (kein Netz, Zeitlimit, unerwartete Antwort): ${e.unklarePflicht.join('; ')}`);
  if (e.nichtEingeordnet.length) z.push(`FEHLER nicht in werkzeuge/rpc-pflicht.json eingeordnet: ${e.nichtEingeordnet.join(', ')}`);
  if (e.pflichtOhneDatei.length) z.push(`FEHLER Eintrag in rpc-pflicht.json ohne Datei unter supabase/: ${e.pflichtOhneDatei.join(', ')}`);
  z.push(`(${e.anfragen} Anfragen; nicht befragt (Schema sperrt sie nicht fuer anon, oder ein Parameter ist eine ganze Tabellenzeile): ${e.ungeprueft.length})`);
  z.push(e.ok ? 'OK alle Pflicht-Funktionen sind eingespielt' : 'NICHT OK');
  return z.join('\n');
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const args = process.argv.slice(2);
  const i = args.indexOf('--basis');
  const basis = i >= 0 ? args[i + 1] : BASIS;
  if (i >= 0 && !/^https?:\/\//.test(basis || '')) { console.error('--basis braucht eine Adresse mit http(s)://'); process.exit(2); }
  const e = await pruefe({ basis });
  console.log(args.includes('--json') ? JSON.stringify(e, null, 2) : bericht(e));
  // exitCode statt process.exit: unter Windows bricht Node sonst mit offenen fetch-Verbindungen ab (wie functions-probe)
  process.exitCode = e.ok ? 0 : 1;
}
