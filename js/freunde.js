// Freunde fuer die Bestenliste (Flo, 30.10.2026, Entwurf "Bestenliste": Freunde per Benutzername oder Einladungslink,
// der andere bestaetigt; Freunde sehen nur Benutzername, Punkte und Profil, nie die E-Mail). Server:
// supabase/freunde-schema.sql (Funktionen freund_*, freunde). Nur fetch, Sitzung aus konto.js. Ohne DOM, in Node testbar.
//
//   NAME                     /^[A-Za-z0-9_]{3,20}$/ wie profile_benutzername_format
//   ladeFreunde() -> Promise<[{ id, name, status: 'freunde' | 'eingehend' | 'ausgehend', seit }]>
//   frageAn(name) -> Promise<ergebnis>     'gesendet' | 'freunde' | 'schon' | 'unbekannt' | 'selbst' | 'kein_name' | 'grenze'
//                                          ('ungueltig' ohne Serveranfrage, wenn der Name nicht passen kann)
//   antworte(id, annehmen) -> Promise<ergebnis>   'freunde' | 'abgelehnt' | 'unbekannt'
//   entferne(id) -> Promise<ergebnis>      'entfernt' | 'unbekannt' (auch eigene Anfrage zurueckziehen)
//   einladung() -> Promise<{ code, link } | { ergebnis: 'kein_name' }>
//   nutzeEinladung(code) -> Promise<{ ergebnis, name? }>   'freunde' | 'schon' | 'ungueltig' | 'selbst' | 'kein_name' | 'grenze'
//   meldeWochenpunkte({ woche, punkte, partien }) -> Promise<ergebnis>   'ok' | 'woche' | 'werte' ('ungueltig' ohne Anfrage)
//       woche = Montag als 'JJJJ-MM-TT' (tag.wochenSchluessel); der Server nimmt nur diese und letzte Woche, der Wert sinkt nie
//   ladeRangliste(fenster) -> Promise<[{ id, name, punkte, partien, ich }]>   'woche' | 'monat' | 'allzeit', du und Freunde
//   einladungsLink(code, basis?) -> '<Adresse der App>#freund/<code>'
//   codeAusLink(text) -> code | null       aus '#freund/<code>', einer ganzen Adresse oder dem Code allein
//   uebernimmLink(ort?) -> code | null     merkt den Code aus #freund/<code> fuer die Bestenliste (wie online.js)
//   gemerkterCode(), vergissCode()
// Fehler: ohne Anmeldung Error mit grund 'abgemeldet', ohne Netz grund 'offline', sonst grund 'server'.
//   setzeFreundeFetch(fn)    nur fuer Tests
import { SUPABASE_URL, SUPABASE_KEY } from './konto-config.js';
import { sitzung, aktiveSitzung, kontoFreigeschaltet } from './konto.js';

export const NAME = /^[A-Za-z0-9_]{3,20}$/;
const CODE = /^[0-9a-f]{16}$/;
export const LINK_BASIS = 'https://floboldt007-cmyk.github.io/schach/';
export const CODE_SCHLUESSEL = 'schach-arena:konto:freund-einladung';

let fetchFn = (...a) => fetch(...a);
export function setzeFreundeFetch(fn) { fetchFn = fn || ((...a) => fetch(...a)); }

function fehler(grund) { const e = new Error(grund); e.grund = grund; return e; }

async function rpc(name, daten = {}) {
  if (!sitzung()?.access_token) throw fehler('abgemeldet');
  let s;
  try { s = await aktiveSitzung(); } catch (e) { throw fehler('abgemeldet'); }
  let r;
  try {
    r = await fetchFn(`${SUPABASE_URL}/rest/v1/rpc/${name}`, { method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${s.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(daten) });
  } catch (e) { throw fehler('offline'); }
  if (r.status === 401) throw fehler('abgemeldet');
  if (!r.ok) throw fehler('server');
  try { return await r.json(); } catch (e) { throw fehler('server'); }
}
const ergebnis = (d) => (d && typeof d.ergebnis === 'string' ? d.ergebnis : 'unbekannt');

export async function ladeFreunde() {
  const d = await rpc('freunde');
  return (Array.isArray(d) ? d : []).filter((f) => f && typeof f.id === 'string' && typeof f.name === 'string'
    && ['freunde', 'eingehend', 'ausgehend'].includes(f.status))
    .map((f) => ({ id: f.id, name: f.name, status: f.status, seit: f.seit || null }));
}
export async function frageAn(name) {
  const n = String(name ?? '').trim();
  if (!NAME.test(n)) return 'ungueltig';
  return ergebnis(await rpc('freund_anfragen', { name: n }));
}
export async function antworte(id, annehmen) {
  return ergebnis(await rpc('freund_antworten', { anderer: id, annehmen: !!annehmen }));
}
export async function entferne(id) {
  return ergebnis(await rpc('freund_entfernen', { anderer: id }));
}
export async function einladung(basis) {
  const d = await rpc('freund_einladung');
  if (d && CODE.test(d.code)) return { code: d.code, link: einladungsLink(d.code, basis), gueltigBis: d.gueltig_bis || null };
  return { ergebnis: ergebnis(d) === 'unbekannt' ? 'server' : ergebnis(d) };
}
export async function nutzeEinladung(code) {
  const c = codeAusLink(code);
  if (!c) return { ergebnis: 'ungueltig' };
  const d = await rpc('freund_einladung_nutzen', { code: c });
  return { ergebnis: ergebnis(d), name: d && typeof d.name === 'string' ? d.name : null };
}

const ganz = (x) => Number.isInteger(x) && x >= 0;
export async function meldeWochenpunkte({ woche, punkte, partien } = {}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(woche)) || !ganz(punkte) || !ganz(partien)) return 'ungueltig';
  return ergebnis(await rpc('wochenpunkte_melden', { woche, punkte, partien }));
}
export async function ladeRangliste(fenster = 'woche') {
  const f = ['woche', 'monat', 'allzeit'].includes(fenster) ? fenster : 'woche';
  const d = await rpc('freunde_rangliste', { fenster: f });
  return (Array.isArray(d) ? d : []).filter((z) => z && typeof z.id === 'string')
    .map((z) => ({ id: z.id, name: typeof z.name === 'string' ? z.name : null, punkte: Math.max(0, Number(z.punkte) || 0),
      partien: Math.max(0, Number(z.partien) || 0), ich: z.ich === true }));
}

export function einladungsLink(code, basis) {
  if (!CODE.test(String(code))) throw fehler('ungueltig');
  let b = basis;
  if (b == null) {
    const l = globalThis.location;
    b = /^https?:/.test(String(l?.origin || '')) ? l.origin + (l.pathname || '/') : LINK_BASIS;
  }
  return `${String(b).replace(/[#?].*$/, '')}#freund/${code}`;
}
export function codeAusLink(text) {
  const s = String(text ?? '').trim().toLowerCase();
  const m = s.match(/#freund\/([0-9a-f]{16})(?:$|[/?&#])/) || s.match(/^([0-9a-f]{16})$/);
  return m ? m[1] : null;
}

const lager = () => { try { return globalThis.localStorage || null; } catch (e) { return null; } };
export function uebernimmLink(ort = globalThis.location) {
  const c = codeAusLink(ort?.hash || '');
  if (!c) return null;
  kontoFreigeschaltet('#konto');
  try { lager()?.setItem(CODE_SCHLUESSEL, c); } catch (e) { /* ohne Merker weiter */ }
  return c;
}
export function gemerkterCode() {
  try { const c = lager()?.getItem(CODE_SCHLUESSEL); return c && CODE.test(c) ? c : null; } catch (e) { return null; }
}
export function vergissCode() { try { lager()?.removeItem(CODE_SCHLUESSEL); } catch (e) { /* egal */ } }
