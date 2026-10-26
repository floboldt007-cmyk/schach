// "Frag den Coach" (Welle B2): Client der Edge Function coach (supabase/functions/coach). Nur fetch, keine Bibliothek
// (Muster: js/abo.js, js/konto.js). Die Oberflaeche (Knopf und Antwort-Karte in der Spielanalyse) liegt im Paket
// js/pakete/coach-ki/. Was die KI bekommt, baut der Server selbst aus gepruefter Form; die App schickt nur Fakten aus
// der gespeicherten Analyse (Stellung, Zuege, Bewertungen, Zugklasse, Spielstaerke), nie einen freien Text.
//
// API:
//   COACH_PFAD = '/functions/v1/coach'
//   eingabeAusZug(zug, { partie, du } = {}) -> Eingabe fuer den Server | null
//       zug: Eintrag aus review.zuege (fenVorher, uci, besterZug, evalVorher, evalNachher, klasse). partie.spielstaerke
//       (Elo-Schaetzung der Partie) wird als spielerLevel mitgeschickt, wenn sie zwischen 100 und 3500 liegt; du (der
//       Spieler hat gezogen) als eigenerZug. null ohne Stellung oder Zug.
//   frageCoach(eingabe) -> Promise<{ ok: true, text, modell, rest, gemerkt } | { ok: false, grund, status? }>
//       grund: 'eingabe' | 'abgemeldet' | 'offline' | 'premium' | 'limit' | 'abgelehnt' | 'nicht_eingerichtet' | 'ki'
//       Ohne Anmeldung keine Anfrage ('abgemeldet'), ohne Netz 'offline'. Eine Antwort merkt sich die App fuer diese
//       Sitzung (nur im Arbeitsspeicher, hoechstens MERKER_MAX): derselbe Zug kostet keine zweite Frage. Sagt der Server
//       "kein Premium", fragt die App den Abo-Stand neu (der Zwischenspeicher von js/abo.js war dann veraltet).
//       Gleichzeitige Fragen zum selben Zug laufen zusammen. Antwortet der Server nicht binnen WARTE_MS, bricht die App
//       ab ('ki': "nicht erreichbar"), statt die Karte unbegrenzt bei "schaut sich die Stellung an" zu lassen.
//   TEXTE                     grund -> ruhiger Satz fuer die Karte (premium zeigt stattdessen premiumHinweis aus js/abo.js)
//   KI_HINWEIS                "Erklärung von einer KI, kann sich irren." (KI-Verordnung Art. 50: Transparenz)
//   restText(rest) -> string  "Heute noch 3 Fragen." erst ab 5 oder weniger, sonst ''
//   WARTE_MS = 100000         laengste Wartezeit auf die Function (sie selbst wartet hoechstens 2 x 45 s auf die KI)
//   vergissAntworten()        Merker leeren (fuer Tests; nach dem Abmelden ist es nicht noetig, der Merker schluesselt
//                             je Nutzer-ID und lebt nur im Arbeitsspeicher)
//   setzeCoachFetch(fn), setzeCoachWartezeit(ms)   nur fuer Tests (null: Standard)
import { SUPABASE_URL, SUPABASE_KEY } from './konto-config.js';
import { t } from './sprache.js';
import './sprachen/coach-ki.js';
const C = (k, w) => t('coach-ki.' + k, w);
import { sitzung, erneuereSitzung } from './konto.js';
import { istPremium, nutzerId } from './abo.js';

export const COACH_PFAD = '/functions/v1/coach';
export const MERKER_MAX = 40;
export const WARTE_MS = 100000;
export const KI_HINWEIS = 'Erklärung von einer KI, kann sich irren.';
export const TEXTE = Object.freeze({
  get eingabe() { return C('eingabe'); },
  get abgemeldet() { return C('abgemeldet'); },
  get offline() { return C('offline'); },
  get limit() { return C('limit'); },
  get abgelehnt() { return C('abgelehnt'); },
  get nicht_eingerichtet() { return C('nicht_eingerichtet'); },
  get ki() { return C('ki'); },
  get premium() { return C('premium'); },
});
export function kiHinweis() { return C('hinweis'); }
const GRUENDE = new Set(Object.keys(TEXTE));
const UCI = /^[a-h][1-8][a-h][1-8][qrbn]?$/;

let fetchFn = (...a) => fetch(...a);
let wartezeit = WARTE_MS;
export function setzeCoachFetch(fn) { fetchFn = fn || ((...a) => fetch(...a)); }
export function setzeCoachWartezeit(ms) { wartezeit = Number.isFinite(ms) && ms > 0 ? ms : WARTE_MS; }

const merker = new Map();       // "uid fen zug" -> Antwort
const laufend = new Map();      // "uid fen zug" -> Promise
export function vergissAntworten() { merker.clear(); laufend.clear(); }

export function restText(rest) {
  if (!Number.isInteger(rest) || rest < 0 || rest > 5) return '';
  return rest === 0 ? C('letzte') : C('rest', { n: rest });
}

function bewertung(ev) {
  if (!ev || typeof ev !== 'object') return null;
  if (Number.isInteger(ev.mate)) return { mate: ev.mate };
  if (Number.isFinite(ev.cp)) return { cp: Math.round(ev.cp) };
  return null;
}

export function eingabeAusZug(zug, { partie = null, du = null } = {}) {
  if (!zug || typeof zug.fenVorher !== 'string' || !zug.fenVorher || !UCI.test(String(zug.uci || ''))) return null;
  const e = {
    fen: zug.fenVorher,
    zug: zug.uci,
    besterZug: UCI.test(String(zug.besterZug || '')) ? zug.besterZug : null,
    bewertungVorher: bewertung(zug.evalVorher),
    bewertungNachher: bewertung(zug.evalNachher),
    klasse: typeof zug.klasse === 'string' ? zug.klasse : null,
  };
  const elo = partie && Number.isFinite(partie.spielstaerke) ? Math.round(partie.spielstaerke) : null;
  if (elo !== null && elo >= 100 && elo <= 3500) e.spielerLevel = elo;
  if (typeof du === 'boolean') e.eigenerZug = du;
  return e;
}

// Gueltige Sitzung, bei Bedarf erneuert; ohne Netz (Fehler ohne HTTP-Status) 'offline', sonst abgemeldet
async function token() {
  const s = sitzung();
  if (!s || !nutzerId(s)) return { grund: 'abgemeldet' };
  if (Number(s.expires_at) > Math.floor(Date.now() / 1000) + 30) return { token: s.access_token };
  try {
    const neu = await erneuereSitzung();
    return neu && neu.access_token ? { token: neu.access_token } : { grund: 'abgemeldet' };
  } catch (e) {
    return { grund: e && e.status ? 'abgemeldet' : 'offline' };
  }
}

async function frage(eingabe, schluessel) {
  const t = await token();
  if (!t.token) return { ok: false, grund: t.grund };
  // Zeitgrenze: AbortController bricht fetch und das Lesen des Koerpers ab; das Rennen gegen den Zeitgeber faengt auch
  // ein fetch ohne signal (Tests, alte Browser)
  const abbruch = typeof AbortController === 'function' ? new AbortController() : null;
  let zeitgeber = null;
  const zuSpaet = new Promise((_, nein) => {
    zeitgeber = setTimeout(() => {
      nein(Object.assign(new Error('Zeit'), { zeit: true }));
      try { if (abbruch) abbruch.abort(); } catch (e) { /* egal */ }
    }, wartezeit);
  });
  zuSpaet.catch(() => {});
  const abgelaufen = (e) => !!(e && e.zeit) || !!(abbruch && abbruch.signal.aborted);
  let r;
  let d = null;
  try {
    try {
      r = await Promise.race([fetchFn(SUPABASE_URL + COACH_PFAD, {
        method: 'POST',
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${t.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(eingabe),
        ...(abbruch ? { signal: abbruch.signal } : {}),
      }), zuSpaet]);
    } catch (e) {
      return abgelaufen(e) ? { ok: false, grund: 'ki', status: null } : { ok: false, grund: 'offline' };
    }
    try { d = await Promise.race([r.json(), zuSpaet]); } catch (e) {
      if (abgelaufen(e)) return { ok: false, grund: 'ki', status: null };
    }
  } finally {
    clearTimeout(zeitgeber);
  }
  if (r.ok && d && typeof d.text === 'string' && d.text.trim()) {
    const a = { ok: true, text: d.text.trim().slice(0, 1200), modell: typeof d.modell === 'string' ? d.modell : null,
      rest: Number.isInteger(d.rest) ? d.rest : null, gemerkt: false };
    merker.set(schluessel, a);
    while (merker.size > MERKER_MAX) merker.delete(merker.keys().next().value);
    return a;
  }
  const k = d && typeof d.fehler === 'string' ? d.fehler : '';
  const grund = k === 'anmeldung' ? 'abgemeldet' : k === 'server' ? 'ki' : GRUENDE.has(k) ? k
    : r.status === 401 ? 'abgemeldet' : r.status === 403 ? 'premium' : r.status === 429 ? 'limit' : r.status === 400 ? 'eingabe' : 'ki';
  // Der Server weiss es besser als der Zwischenspeicher: Abo-Stand neu holen
  if (grund === 'premium') istPremium({ neu: true }).catch(() => {});
  return { ok: false, grund, status: r.status };
}

export function frageCoach(eingabe) {
  if (!eingabe || typeof eingabe.fen !== 'string' || !UCI.test(String(eingabe.zug || ''))) return Promise.resolve({ ok: false, grund: 'eingabe' });
  const uid = nutzerId();
  if (!uid) return Promise.resolve({ ok: false, grund: 'abgemeldet' });
  const schluessel = `${uid} ${eingabe.fen} ${eingabe.zug}`;
  if (merker.has(schluessel)) return Promise.resolve({ ...merker.get(schluessel), gemerkt: true });
  if (laufend.has(schluessel)) return laufend.get(schluessel);
  const p = frage(eingabe, schluessel).finally(() => laufend.delete(schluessel));
  laufend.set(schluessel, p);
  return p;
}
