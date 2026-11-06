// Tageszaehler (Etappe B, Task 8; Konzept 5d): zaehlt Tagessummen je Schluessel auf dem Server (supabase/zaehler-schema.sql),
// ohne Personenbezug. Gebaut, aber AUS, bis Rechtspruefung (§ 25 TDDDG, DSGVO) und Absatz in der Datenschutzerklaerung:
// Der Server sagt ueber zaehler_an(), ob gezaehlt wird (kronen_schalter.zaehler_an, Vorgabe false).
//
//   zaehle(schluessel, um = 1) -> Promise<void>
//       fragt den Schalter einmal pro Sitzung (Seitenaufruf); ist er aus oder die Frage scheitert, sendet es nie etwas.
//       Gesendet werden nur Schluessel und Zahl, mit dem oeffentlichen Schluessel und OHNE Anmeldung (kein
//       Authorization-Kopf), also nichts, das eine Zeile einem Menschen oder Geraet zuordnet. Unbekannte Schluessel
//       gehen nicht hinaus, um wird auf 1..1000 begrenzt (ganze Zahl). Fehler werden geschluckt, nichts wirft.
//   ZAEHLER_SCHLUESSEL               erlaubte Schluessel, dieselbe Liste wie in zaehler_erhoehe (Vertrag in tests/zaehler.test.mjs)
//   setzeZaehlerFetch(fn)            nur Tests: eigenes fetch, vergisst den Schalter
import { SUPABASE_URL, SUPABASE_KEY } from './konto-config.js';

export const ZAEHLER_SCHLUESSEL = Object.freeze(['suche.wartezeit_s', 'suche.ki_gegner', 'suche.mensch', 'kronen.online', 'kronen.ki', 'kronen.bot']);
const ERLAUBT = new Set(ZAEHLER_SCHLUESSEL);

let fetchFn = (...a) => fetch(...a);
let schalter = null;   // Promise<boolean>, einmal pro Sitzung

export function setzeZaehlerFetch(fn) {
  fetchFn = fn || ((...a) => fetch(...a));
  schalter = null;
}

async function rpc(name, daten) {
  const r = await fetchFn(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(daten || {}),
  });
  if (!r || !r.ok) throw new Error('zaehler ' + (r ? r.status : 'ohne Antwort'));
  return r.json();
}

function istAn() {
  if (!schalter) schalter = rpc('zaehler_an').then((d) => d === true, () => false);
  return schalter;
}

export async function zaehle(schluessel, um = 1) {
  try {
    if (!ERLAUBT.has(schluessel)) return;
    const n = Math.floor(Number(um));
    if (!Number.isFinite(n) || n < 1) return;
    if (!(await istAn())) return;
    await rpc('zaehler_erhoehe', { schluessel, um: Math.min(1000, n) });
  } catch (e) { /* Zaehlen darf die App nie stoeren */ }
}
