// Verwaltung fuer Flo (G-006 M3, AC-06 bis AC-09): duenne Huelle um die Server-Funktionen aus
// supabase/verwaltung-schema.sql. Die Sicherheit liegt allein auf dem Server (jede Funktion prueft public.verwalter);
// istVerwalter() blendet nur den Eintrag in den Einstellungen ein oder aus. Die Oberflaeche liegt im Paket
// js/pakete/verwaltung/.
//
//   istVerwalter({ neu }) -> Promise<boolean>   false ohne Anmeldung, ohne Recht, offline und solange die SQL fehlt
//                                               (still, nie ein Fehler). Gemerkt je Konto, bis neu: true oder Abmelden.
//   konten({ suche, grenze })                   Liste neueste zuerst (verwaltung_konten)
//   kaeufe(id)                                  Abo, Editionen, Sonderstuecke, Banner (verwaltung_kaeufe, nur lesend)
//   setzePremium(id, bis)                       bis = Date oder ISO-Text freischalten, null zuruecknehmen
//   setzeName(id, name), setzeBanner(id, banner, an), protokoll({ grenze })
// Fehler sind ganze Saetze (p-verwaltung.f.*); die Serverkennung steht in fehler.kennung, der Rohtext in fehler.detail.
import { SUPABASE_URL, SUPABASE_KEY } from './konto-config.js';
import { sitzung, aktiveSitzung } from './konto.js';
import { t } from './sprache.js';
import './pakete/verwaltung/texte.js';

const V = (k, w) => t('p-verwaltung.' + k, w);
export const KENNUNGEN = Object.freeze(['VERWALTUNG_KEIN_RECHT', 'VERWALTUNG_KEIN_KONTO', 'VERWALTUNG_DATUM', 'VERWALTUNG_STRIPE_ABO',
  'VERWALTUNG_NAME_FORMAT', 'VERWALTUNG_NAME_VERGEBEN', 'VERWALTUNG_BANNER_UNBEKANNT', 'VERWALTUNG_BANNER_VERDIENT']);

let fetchFn = (...a) => fetch(...a);
export function setzeVerwaltungFetch(fn) { fetchFn = fn || ((...a) => fetch(...a)); merker = null; }
let merker = null;   // { uid, p } fuer istVerwalter

// Nutzer-ID wie nutzerId in js/abo.js: user.id, sonst sub im Token
function uidVon(s) {
  if (!s) return null;
  if (s.user && typeof s.user.id === 'string') return s.user.id;
  try { return JSON.parse(atob(String(s.access_token).split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).sub || null; } catch (e) { return null; }
}

export function fehlerAus(d, status) {
  const roh = String(d?.message || d?.msg || '');
  const kennung = KENNUNGEN.find((k) => roh.includes(k));
  let text;
  if (kennung) text = V('f.' + kennung);
  else if (status === 401) text = V('f.abgelaufen');
  else if (status === 404) text = V('f.einrichtung');
  else text = V('f.allgemein', { status });
  const e = new Error(text);
  e.status = status; e.kennung = kennung; e.detail = roh;
  return e;
}

async function rpc(name, daten = {}) {
  const s = await aktiveSitzung();
  let r;
  try {
    r = await fetchFn(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${s.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(daten),
    });
  } catch (e) {
    const f = new Error(V('f.offline')); f.offline = true; throw f;
  }
  let d = null;
  // INTENTIONAL-SLOP[F1]: leere oder kaputte Antwort heisst d = null; den Fehler meldet danach r.ok mit Status
  if (r.status !== 204) { try { d = await r.json(); } catch (e) { /* leer */ } }
  if (!r.ok) throw fehlerAus(d, r.status);
  return d;
}

export function istVerwalter({ neu = false } = {}) {
  const s = sitzung();
  const uid = uidVon(s);
  // abgemeldet: die gemerkte Antwort verwerfen, die naechste Anmeldung fragt neu
  if (!s?.access_token || !uid) { merker = null; return Promise.resolve(false); }
  if (!neu && merker && merker.uid === uid) return merker.p;
  const p = rpc('ist_verwalter').then((d) => d === true).catch(() => false);
  merker = { uid, p };
  return p;
}

const liste = (d) => (Array.isArray(d) ? d : []);
export async function konten({ suche = '', grenze = 100 } = {}) {
  return liste(await rpc('verwaltung_konten', { suche: String(suche || '').trim() || null, grenze }));
}
export async function kaeufe(id) { return rpc('verwaltung_kaeufe', { ziel: id }); }
export async function setzePremium(id, bis) {
  const wann = bis == null ? null : new Date(bis).toISOString();
  return rpc('verwaltung_premium', { ziel: id, bis: wann });
}
export async function setzeName(id, name) { return rpc('verwaltung_name', { ziel: id, neu: String(name ?? '').trim() }); }
export async function setzeBanner(id, banner, an) { return rpc('verwaltung_banner', { ziel: id, banner, an: !!an }); }
export async function protokoll({ grenze = 50 } = {}) { return liste(await rpc('verwaltung_protokoll_lesen', { grenze })); }
