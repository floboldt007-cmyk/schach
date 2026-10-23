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
//       Gleichzeitige Fragen zum selben Zug laufen zusammen.
//   TEXTE                     grund -> ruhiger Satz fuer die Karte (premium zeigt stattdessen premiumHinweis aus js/abo.js)
//   KI_HINWEIS                "Erklärung von einer KI, kann sich irren." (KI-Verordnung Art. 50: Transparenz)
//   restText(rest) -> string  "Heute noch 3 Fragen." erst ab 5 oder weniger, sonst ''
//   vergissAntworten()        Merker leeren (nach dem Abmelden, in Tests)
//   setzeCoachFetch(fn)       nur fuer Tests
import { SUPABASE_URL, SUPABASE_KEY } from './konto-config.js';
import { sitzung, erneuereSitzung } from './konto.js';
import { istPremium, nutzerId } from './abo.js';

export const COACH_PFAD = '/functions/v1/coach';
export const MERKER_MAX = 40;
export const KI_HINWEIS = 'Erklärung von einer KI, kann sich irren.';
export const TEXTE = Object.freeze({
  eingabe: 'Zu diesem Zug kann der Coach nichts sagen.',
  abgemeldet: 'Melde dich an, dann kannst du den Coach fragen.',
  offline: 'Gerade keine Verbindung. Der Coach antwortet, sobald du wieder online bist.',
  limit: 'Für heute hast du alle Fragen an den Coach gestellt. Ab 4 Uhr morgens kannst du wieder fragen.',
  abgelehnt: 'Zu diesem Zug hat der Coach gerade keine Erklärung. Die Bewertung oben gilt weiter.',
  nicht_eingerichtet: 'Der Coach ist noch nicht eingerichtet.',
  ki: 'Der Coach ist gerade nicht erreichbar. Versuch es gleich noch einmal.',
  premium: 'Frag den Coach gehört zu Crownmate Trainer.',
});
const GRUENDE = new Set(Object.keys(TEXTE));
const UCI = /^[a-h][1-8][a-h][1-8][qrbn]?$/;

let fetchFn = (...a) => fetch(...a);
export function setzeCoachFetch(fn) { fetchFn = fn || ((...a) => fetch(...a)); }

const merker = new Map();       // "uid fen zug" -> Antwort
const laufend = new Map();      // "uid fen zug" -> Promise
export function vergissAntworten() { merker.clear(); laufend.clear(); }

export function restText(rest) {
  if (!Number.isInteger(rest) || rest < 0 || rest > 5) return '';
  return rest === 0 ? 'Das war deine letzte Frage für heute.' : `Heute noch ${rest} ${rest === 1 ? 'Frage' : 'Fragen'}.`;
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
  let r;
  try {
    r = await fetchFn(SUPABASE_URL + COACH_PFAD, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${t.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(eingabe),
    });
  } catch (e) {
    return { ok: false, grund: 'offline' };
  }
  let d = null;
  try { d = await r.json(); } catch (e) { /* leer */ }
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
