// Sonderstuecke: Flos Erfinder-Profil (Nr. 0, 1 von 1; Flo, 30.10.2026: "mache die Version fuer mich fuer den
// Erschaffer"). Was ein Konto besitzt, steht nur auf dem Server (supabase/werkstatt-schema.sql, Tabelle sonderstuecke):
// eintragen kann nur Flo im SQL Editor, die App liest ueber RLS nur die eigenen Zeilen. Den Merker im Browser nutzt
// nur die eigene Ansicht (Sammlung, Figurensatz, Finisher), und nur fuer das Konto, das gerade angemeldet ist. Andere
// sehen nie etwas daraus; fremde Profile kommen spaeter nur vom Server. Kein Schluessel unter schach-arena:v1:, also
// nicht im Spielstand und nicht in der Cloud-Sicherung.
//
//   ERFINDER                        die vier Stuecke (Ids wie im SQL-Beispiel der Anleitung)
//   hatSonderstueck(id) -> boolean  aus dem Merker, nur fuer das angemeldete Konto
//   pionierNummer() -> 1..100 | null   Pionier-Titel der ersten 100 Konten (Server vergibt pionier-001 ... pionier-100)
//   istErfinder() -> boolean        Flo, 30.10.2026: als Erfinder ist alles Ausruestbare immer frei (Finisher, Emotes,
//                                   Bretter, Klaenge, Figuren); Erfolge, Level und Wertung bleiben erspielt. Jede neue
//                                   Sperre fuer Ausruestbares fragt hier nach.
//   ladeSonderstuecke() -> Promise<string[]|null>   fragt den Server, merkt das Ergebnis; null ohne Anmeldung/bei Fehler
//   sonderstueckeBekannt() -> boolean   fuer das angemeldete Konto liegt schon eine Server-Antwort im Merker
//                                   (js/app.js fragt sonst beim Start und beim Seitenwechsel nach, nicht erst die Sammlung)
//   setzeSonderFetch(fn)            nur fuer Tests
import { SUPABASE_URL, SUPABASE_KEY } from './konto-config.js';
import { sitzung, aktiveSitzung, userId } from './konto.js';

export const SONDER_SCHLUESSEL = 'schach-arena:konto:sonderstuecke';
export const ERFINDER = Object.freeze({
  banner: 'erfinder-banner-blatt-0',
  titel: 'erfinder-titel',
  figuren: 'erfinder-figuren-blaupause',
  finisher: 'erfinder-finisher-signatur',
});
const ID = /^[a-z0-9-]{2,60}$/;

let fetchFn = (...a) => fetch(...a);
export function setzeSonderFetch(fn) { fetchFn = fn || ((...a) => fetch(...a)); }

function merker() {
  try {
    const m = JSON.parse(globalThis.localStorage.getItem(SONDER_SCHLUESSEL));
    return m && typeof m.konto === 'string' && Array.isArray(m.ids) ? m : null;
  } catch (e) { return null; }
}

export function sonderstuecke() {
  const s = sitzung();
  const uid = s ? userId(s) : null;
  const m = merker();
  return uid && m && m.konto === uid ? m.ids.filter((x) => typeof x === 'string' && ID.test(x)) : [];
}
export function hatSonderstueck(id) { return sonderstuecke().includes(id); }
// true, wenn fuer das angemeldete Konto schon eine Antwort vom Server gemerkt ist (dann muss niemand nachfragen)
export function sonderstueckeBekannt() {
  const s = sitzung();
  const uid = s ? userId(s) : null;
  const m = merker();
  return !!(uid && m && m.konto === uid);
}
export function istErfinder() { return hatSonderstueck(ERFINDER.titel); }
// Pionier (Flo 01.11.2026: "die ersten 100 Spieler bekommen einen Titel"): Sonderstueck pionier-001 bis pionier-100,
// vergeben nur vom Server (supabase/pionier-schema.sql); die Nummer steht im Namen
export function pionierNummer() {
  const id = sonderstuecke().find((x) => /^pionier-\d{3}$/.test(x));
  const n = id ? Number(id.slice(8)) : NaN;
  return Number.isInteger(n) && n >= 1 && n <= 100 ? n : null;
}

export async function ladeSonderstuecke() {
  if (!sitzung()) return null;
  try {
    const s = await aktiveSitzung();
    const uid = userId(s);
    const r = await fetchFn(`${SUPABASE_URL}/rest/v1/sonderstuecke?select=stueck_id`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${s.access_token}` } });
    if (!r.ok || !uid) return null;
    const zeilen = await r.json();
    const ids = Array.isArray(zeilen) ? zeilen.map((z) => z && z.stueck_id).filter((x) => typeof x === 'string' && ID.test(x)) : [];
    // nur merken, wenn waehrenddessen niemand das Konto gewechselt hat
    const jetzt = sitzung();
    if (!jetzt || userId(jetzt) !== uid) return null;
    try { globalThis.localStorage.setItem(SONDER_SCHLUESSEL, JSON.stringify({ konto: uid, ids })); } catch (e) { /* nur Komfort */ }
    return ids;
  } catch (e) { return null; }
}
