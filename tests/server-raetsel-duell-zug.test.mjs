// Raetsel-Duell (Etappe 5): die Logik der Edge Function raetsel-duell (supabase/functions/_gemeinsam/raetsel-duell.js),
// in Node mit vendor/chess und einem nachgebauten fetch. Kein Netz, keine Datenbank.
//   node tests/server-raetsel-duell-zug.test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Chess } from '../vendor/chess/chess.js';
import {
  MAX_KOERPER, KENNUNGEN, FEHLER_TEXTE, SQL_KENNUNGEN, pruefeEingabe, pruefeZug, verarbeite,
} from '../supabase/functions/_gemeinsam/raetsel-duell.js';
import { ausSql } from '../werkzeuge/duell-raetsel.mjs';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lies = (d) => readFileSync(path.join(WURZEL, d), 'utf8');
let ok = 0;
let gesamt = 0;
function pruefe(name, bedingung, info) {
  gesamt++;
  if (bedingung) { ok++; console.log('ok     ' + name); } else console.log('FEHLER ' + name + (info !== undefined ? '  -> ' + JSON.stringify(info) : ''));
}

const DUELL = '11111111-2222-4333-8444-555555555555';
const UID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
// zwei Mattzuege: Ta8# und Te8#; Lichess-Loesung ist nur a1a8, e1e8 zaehlt trotzdem (jedes Matt im letzten Zug)
const MATT_IN_1 = { idx: 0, schritt: 0, fen: '6k1/5ppp/8/8/8/8/8/R3R1K1 w - - 0 1', loesung: ['a1a8'], status: 'laeuft' };
// ein echtes dreizuegiges Raetsel aus den Duell-Daten (Loesung mit 3 Halbzuegen)
const alle = ausSql(lies('supabase/raetsel-duell-daten.sql'));
const drei = alle.find((a) => a.loesung.length === 3);

// ---------- Eingabe ----------
pruefe('Eingabe: duell und zug', pruefeEingabe({ duell: DUELL, zug: 'a1a8' }).ok);
pruefe('Eingabe: ein Feld zu viel (z. B. richtig vom Geraet) abgelehnt', pruefeEingabe({ duell: DUELL, zug: 'a1a8', richtig: true }).kennung === 'DUELL_ANFRAGE');
pruefe('Eingabe: keine UUID abgelehnt', pruefeEingabe({ duell: 'x', zug: 'a1a8' }).kennung === 'DUELL_ANFRAGE');
pruefe('Eingabe: kein UCI abgelehnt', pruefeEingabe({ duell: DUELL, zug: 'Ta8' }).kennung === 'DUELL_ZUG_FORM');
pruefe('Eingabe: Array abgelehnt', pruefeEingabe([DUELL, 'a1a8']).kennung === 'DUELL_ANFRAGE');

// ---------- Zug pruefen ----------
let r = pruefeZug(Chess, MATT_IN_1, 'a1a8');
pruefe('Loesungszug richtig und fertig', r.ok && r.richtig && r.fertig, r);
r = pruefeZug(Chess, MATT_IN_1, 'e1e8');
pruefe('anderes Matt im letzten Zug zaehlt als richtig', r.ok && r.richtig && r.fertig, r);
r = pruefeZug(Chess, MATT_IN_1, 'a1a7');
pruefe('legaler falscher Zug: falsch (kein Fehler)', r.ok && !r.richtig, r);
r = pruefeZug(Chess, MATT_IN_1, 'a1h8');
pruefe('illegaler Zug: DUELL_ZUG_ILLEGAL, nicht als Fehler gezaehlt', !r.ok && r.kennung === 'DUELL_ZUG_ILLEGAL', r);
pruefe('Daten haben ein Raetsel mit 3 Halbzuegen', !!drei);
r = pruefeZug(Chess, { idx: 4, schritt: 0, fen: drei.fen, loesung: drei.loesung, status: 'laeuft' }, drei.loesung[0]);
pruefe('mehrzuegig: erster richtiger Zug ist richtig, aber nicht fertig', r.ok && r.richtig && !r.fertig, r);
r = pruefeZug(Chess, { idx: 4, schritt: 2, fen: drei.fen, loesung: drei.loesung, status: 'laeuft' }, drei.loesung[2]);
pruefe('mehrzuegig: letzter Zug nach der Antwort ist fertig', r.ok && r.richtig && r.fertig, r);
r = pruefeZug(Chess, { idx: 4, schritt: 5, fen: drei.fen, loesung: drei.loesung, status: 'laeuft' }, drei.loesung[2]);
pruefe('kaputte Lage (Schritt hinter der Loesung): DUELL_SERVER', !r.ok && r.kennung === 'DUELL_SERVER', r);
r = pruefeZug(Chess, { ...MATT_IN_1, fen: 'kein fen' }, 'a1a8');
pruefe('kaputte Stellung: DUELL_SERVER', !r.ok && r.kennung === 'DUELL_SERVER', r);
// Umwandlung: der Buchstabe muss stimmen (a7a8q ist nicht a7a8n), ein Buchstabe ohne Umwandlung faellt weg
r = pruefeZug(Chess, { idx: 0, schritt: 0, fen: '8/P5k1/8/8/8/8/8/6K1 w - - 0 1', loesung: ['a7a8q'], status: 'laeuft' }, 'a7a8n');
pruefe('Umwandlung in die falsche Figur ist falsch', r.ok && !r.richtig, r);

// ---------- verarbeite ----------
const UMGEBUNG = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'dienst-schluessel-xyz', SUPABASE_ANON_KEY: 'anon-xyz' };
function antwort(status, daten) {
  return { ok: status >= 200 && status < 300, status, json: async () => daten };
}
function holer({ nutzer = { id: UID }, nutzerStatus = 200, lage = MATT_IN_1, lageFehler = null, buchen = null, buchenFehler = null } = {}) {
  const aufrufe = [];
  const f = async (url, o = {}) => {
    aufrufe.push({ url, o });
    if (url.endsWith('/auth/v1/user')) return antwort(nutzerStatus, nutzer);
    if (url.endsWith('/rpc/duell_zug_lage')) return lageFehler ? antwort(400, { message: lageFehler }) : antwort(200, lage);
    if (url.endsWith('/rpc/duell_zug_verbuchen')) {
      if (buchenFehler) return antwort(400, { message: buchenFehler });
      return antwort(200, buchen || { idx: 1, schritt: 0, geloest: 1, fehler: 0, ende_am: '2026-11-07T12:03:00Z', naechstes: { nr: 2, fen: 'x', bisher: [] } });
    }
    return antwort(500, null);
  };
  f.aufrufe = aufrufe;
  return f;
}
const anfrage = (koerper, extra = {}) => ({ methode: 'POST', koerper: JSON.stringify(koerper), autorisierung: 'Bearer ' + 'a'.repeat(40), ankunft: '2026-11-07T12:00:10.000Z', ...extra });

let f = holer();
let a = await verarbeite(anfrage({ duell: DUELL, zug: 'e1e8' }), UMGEBUNG, { fetch: f, Chess });
let k = JSON.parse(a.koerper);
pruefe('200 bei richtigem Zug, Antwort mit richtig/fertig und dem Stand aus der Datenbank', a.status === 200 && k.richtig === true && k.fertig === true && k.geloest === 1 && k.naechstes.nr === 2, { status: a.status, k });
const buchung = JSON.parse(f.aufrufe.find((x) => x.url.endsWith('/rpc/duell_zug_verbuchen')).o.body);
pruefe('verbucht mit Nutzer aus der Anmeldung, Stand vorher, richtig/fertig und gemessener Ankunft',
  buchung.nutzer === UID && buchung.duell === DUELL && buchung.idx_vorher === 0 && buchung.schritt_vorher === 0
    && buchung.richtig === true && buchung.fertig === true && buchung.ankunft === '2026-11-07T12:00:10.000Z', buchung);
const lageAufruf = f.aufrufe.find((x) => x.url.endsWith('/rpc/duell_zug_lage'));
pruefe('Lage und Buchung mit dem Service-Schluessel', lageAufruf && /dienst-schluessel-xyz/.test(JSON.stringify(lageAufruf.o.headers)));
pruefe('Antwort verraet die Loesung nicht', !/loesung|a1a8/.test(a.koerper), a.koerper);

f = holer();
a = await verarbeite(anfrage({ duell: DUELL, zug: 'a1a7' }), UMGEBUNG, { fetch: f, Chess });
k = JSON.parse(a.koerper);
const falsch = JSON.parse(f.aufrufe.find((x) => x.url.endsWith('/rpc/duell_zug_verbuchen')).o.body);
pruefe('falscher Zug wird als falsch verbucht (200, richtig false)', a.status === 200 && k.richtig === false && falsch.richtig === false && falsch.fertig === false, { a, falsch });

f = holer({ lage: { ...MATT_IN_1, idx: 7 } });
await verarbeite(anfrage({ duell: DUELL, zug: 'a1a8' }), UMGEBUNG, { fetch: f, Chess });
const spaeter = JSON.parse(f.aufrufe.find((x) => x.url.endsWith('/rpc/duell_zug_verbuchen')).o.body);
pruefe('verbucht den Raetsel-Index aus der Lage (Schutz gegen doppelte Zuege)', spaeter.idx_vorher === 7, spaeter);

f = holer();
a = await verarbeite(anfrage({ duell: DUELL, zug: 'a1h8' }), UMGEBUNG, { fetch: f, Chess });
pruefe('illegaler Zug: 422, nichts verbucht', a.status === 422 && JSON.parse(a.koerper).fehler === 'DUELL_ZUG_ILLEGAL'
  && !f.aufrufe.some((x) => x.url.endsWith('/rpc/duell_zug_verbuchen')));

a = await verarbeite(anfrage({ duell: DUELL, zug: 'a1a8' }), UMGEBUNG, { fetch: holer({ lageFehler: 'DUELL_UNBEKANNT' }), Chess });
pruefe('fremdes oder unbekanntes Duell: 404 DUELL_UNBEKANNT', a.status === 404 && JSON.parse(a.koerper).fehler === 'DUELL_UNBEKANNT');
a = await verarbeite(anfrage({ duell: DUELL, zug: 'a1a8' }), UMGEBUNG, { fetch: holer({ lage: { ...MATT_IN_1, status: 'beendet' } }), Chess });
pruefe('beendetes Duell: 409 DUELL_BEENDET ohne Buchung', a.status === 409 && JSON.parse(a.koerper).fehler === 'DUELL_BEENDET');
for (const kennung of ['DUELL_ZEIT_UM', 'DUELL_STAND_VERALTET', 'DUELL_NICHT_GESTARTET', 'DUELL_FERTIG']) {
  a = await verarbeite(anfrage({ duell: DUELL, zug: 'a1a8' }), UMGEBUNG, { fetch: holer({ buchenFehler: kennung }), Chess });
  pruefe(`Kennung ${kennung} aus der Datenbank geht mit 409 an die App`, a.status === 409 && JSON.parse(a.koerper).fehler === kennung, a);
}
a = await verarbeite(anfrage({ duell: DUELL, zug: 'a1a8' }), UMGEBUNG, { fetch: holer({ buchenFehler: 'irgendwas kaputt' }), Chess });
pruefe('unbekannter Datenbankfehler: 503 DUELL_SERVER', a.status === 503 && JSON.parse(a.koerper).fehler === 'DUELL_SERVER');
a = await verarbeite(anfrage({ duell: DUELL, zug: 'a1a8' }), UMGEBUNG, { fetch: holer({ nutzerStatus: 401, nutzer: { message: 'invalid JWT' } }), Chess });
pruefe('abgelaufene Anmeldung: 401', a.status === 401 && JSON.parse(a.koerper).fehler === 'DUELL_NICHT_ANGEMELDET');
a = await verarbeite(anfrage({ duell: DUELL, zug: 'a1a8' }, { autorisierung: '' }), UMGEBUNG, { fetch: holer(), Chess });
pruefe('ohne Token: 401', a.status === 401);
a = await verarbeite({ methode: 'POST', koerper: 'x'.repeat(MAX_KOERPER + 1), autorisierung: 'Bearer ' + 'a'.repeat(40) }, UMGEBUNG, { fetch: holer(), Chess });
pruefe('zu grosse Anfrage: 413', a.status === 413);
a = await verarbeite({ methode: 'GET' }, UMGEBUNG, { fetch: holer(), Chess });
pruefe('GET: 405', a.status === 405);
a = await verarbeite({ methode: 'OPTIONS' }, UMGEBUNG, { fetch: holer(), Chess });
pruefe('OPTIONS: 204 mit CORS', a.status === 204 && a.kopf['Access-Control-Allow-Origin'] === '*');
a = await verarbeite(anfrage({ duell: DUELL, zug: 'a1a8' }), {}, { fetch: holer(), Chess });
pruefe('ohne Umgebung: 503 DUELL_NICHT_EINGERICHTET', a.status === 503 && JSON.parse(a.koerper).fehler === 'DUELL_NICHT_EINGERICHTET');

// ---------- Vertrag ----------
pruefe('jede Kennung hat einen Text', KENNUNGEN.every((x) => typeof FEHLER_TEXTE[x] === 'string' && FEHLER_TEXTE[x].length > 5));
const schema = lies('supabase/raetsel-duell-schema.sql');
pruefe('jede SQL-Kennung kommt im Schema als raise vor', Object.keys(SQL_KENNUNGEN).every((x) => schema.includes(`raise exception '${x}'`)),
  Object.keys(SQL_KENNUNGEN).filter((x) => !schema.includes(`raise exception '${x}'`)));
const huelle = lies('supabase/functions/raetsel-duell/index.ts');
pruefe('Huelle: chess.js 1.4.0 aus npm, Ankunft nach dem Lesen des Koerpers', huelle.includes("npm:chess.js@1.4.0")
  && huelle.indexOf('leseKoerper(') < huelle.indexOf('new Date().toISOString()'));

console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
