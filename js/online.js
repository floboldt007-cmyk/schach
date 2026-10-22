// Online gegen Freunde (Stufe 2, Fundament): Einladung per Code oder Link, Zuege ueber die Funktionen aus
// supabase/online-schema.sql, Stand der Partie per Abfrage alle 2 s. Nur fetch (keine Bibliothek, kein
// Websocket; Realtime kann spaeter dazukommen), Sitzung aus konto.js (sitzung, erneuereSitzung).
// Keine Oberflaeche: js/app.js importiert diese Datei noch nicht, sie aendert nichts an partie.js oder arena.js.
//
// API (alles ausser den reinen Helfern braucht eine Anmeldung ueber konto.js):
//   erstelleEinladung({ farbe = 'zufall', bedenkzeit = null, inkrement = 0 }) -> Partie
//       farbe 'w' | 'b' | 'zufall' (eigene Farbe), bedenkzeit in Sekunden (null: ohne Uhr), inkrement in Sekunden
//   tritteBei(code) -> Partie            der Code darf klein, mit Leerzeichen oder Bindestrichen kommen
//   ladePartie(id) -> Partie             Fehler, wenn es sie nicht gibt oder sie einem Fremden gehoert
//   sendeZug(id, { uci, fenDanach, amZugDanach, ergebnis = null, grund = null }) -> Partie
//       ergebnis '1-0' | '0-1' | '1/2-1/2' beendet die Partie (grund z. B. 'matt', 'patt', 'wiederholung')
//   gibAuf(id), bieteRemis(id), nimmRemisAn(id) -> Partie   (gibAuf auf einer offenen Einladung: zurueckziehen)
//   meinePartien() -> [Partie]           offen und laufend, zuletzt geaenderte zuerst
//   beobachte(id, { alle = 2000, seit, beiAenderung, beiFehler }) -> { stop(), laeuft(), stand() }
//       fragt alle `alle` ms nach einer neueren Zeile (aktualisiert_am) und ruft beiAenderung(partie) nur bei
//       einer Aenderung; pausiert, solange document.hidden, und fragt beim Sichtbarwerden sofort wieder;
//       Fehler (auch offline) gehen an beiFehler(fehler), derselbe Fehlertext nur einmal hintereinander;
//       nichts wirft, die App laeuft weiter.
//   einladungsLink(code, basis?) -> 'https://floboldt007-cmyk.github.io/schach/#online/ABC234'
//   codeAusLink(hashOderAdresse) -> 'ABC234' | null
//   uebernimmEinladungsLink(ort?) -> Code | null   merkt den Code aus #online/CODE fuer die spaetere Oberflaeche
//   gemerkteEinladung() -> Code | null, vergissEinladung()
//   meineFarbe(partie) -> 'w' | 'b' | null, binAmZug(partie) -> boolean, zuegeListe(partie) -> [uci]
//   normalisiereCode(text) -> 'ABC234', setzeOnlineFetch(fn) (nur Tests)
//
// Partie = Zeile aus partien_online, Feldnamen wie in der Datenbank: id, code, weiss, schwarz (Nutzer-IDs),
//   erstellt_von, status 'offen' | 'laeuft' | 'beendet', fen, zuege ('e2e4 e7e5 ...', UCI mit Leerzeichen),
//   am_zug 'w' | 'b', ergebnis, grund, remis_angebot 'w' | 'b' | null, bedenkzeit_s, inkrement_s,
//   uhr_weiss_ms, uhr_schwarz_ms, letzter_zug_am, erstellt_am, aktualisiert_am.
//   Die Uhr fuehrt der Server (online-schema.sql): Der erste Zug jeder Seite kostet keine Zeit, danach zieht er
//   seine eigene Zeit seit dem letzten Zug ab. Fuer die Anzeige rechnet der Client die laufende Uhr aus
//   uhr_*_ms und letzter_zug_am selbst herunter.
// Fehlerkennungen des Servers (ONLINE_...) werden hier in ganze Saetze uebersetzt (FEHLER_TEXTE).
import { SUPABASE_URL, SUPABASE_KEY } from './konto-config.js';
import { sitzung, erneuereSitzung } from './konto.js';

export const EINLADUNG_SCHLUESSEL = 'schach-arena:online:einladung';
export const LINK_BASIS = 'https://floboldt007-cmyk.github.io/schach/';
export const CODE_ZEICHEN = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_RE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;
const UCI_RE = /^[a-h][1-8][a-h][1-8][qrbn]?$/;
const FEN_RE = /^([pnbrqkPNBRQK1-8]{1,8}\/){7}[pnbrqkPNBRQK1-8]{1,8} [wb] (-|[KQkq]{1,4}) (-|[a-h][36]) \d+ \d+$/;
const ERGEBNISSE = Object.freeze(['1-0', '0-1', '1/2-1/2']);
let fetchFn = (...a) => fetch(...a);
export function setzeOnlineFetch(fn) { fetchFn = fn || ((...a) => fetch(...a)); }

export const FEHLER_TEXTE = Object.freeze({
  ONLINE_NICHT_ANGEMELDET: 'Bitte zuerst anmelden (Einstellungen > Konto), um online zu spielen.',
  ONLINE_FARBE: 'Bitte eine Farbe wählen: Weiß, Schwarz oder Zufall.',
  ONLINE_BEDENKZEIT: 'Die Bedenkzeit muss zwischen 1 Sekunde und 3 Stunden liegen, der Zuschlag zwischen 0 und 600 Sekunden.',
  ONLINE_KEIN_CODE: 'Es konnte kein freier Einladungscode erzeugt werden. Bitte noch einmal versuchen.',
  ONLINE_CODE_UNGUELTIG: 'Dieser Code ist ungültig oder die Partie ist schon voll.',
  ONLINE_EIGENE_PARTIE: 'Das ist deine eigene Einladung. Schick den Code an deinen Freund.',
  ONLINE_PARTIE_UNBEKANNT: 'Diese Partie wurde nicht gefunden.',
  ONLINE_PARTIE_NICHT_GESTARTET: 'Die Partie hat noch nicht begonnen. Warte, bis dein Freund beitritt.',
  ONLINE_PARTIE_BEENDET: 'Diese Partie ist schon beendet.',
  ONLINE_NICHT_DEIN_ZUG: 'Du bist nicht am Zug.',
  ONLINE_ZUG_FORM: 'Der Zug hat ein ungültiges Format.',
  ONLINE_FEN_FORM: 'Die Stellung hat ein ungültiges Format.',
  ONLINE_AM_ZUG_FORM: 'Nach dem Zug muss die andere Seite am Zug sein.',
  ONLINE_ERGEBNIS_FORM: 'Das Ergebnis hat ein ungültiges Format.',
  ONLINE_KEIN_REMISANGEBOT: 'Es liegt kein Remisangebot deines Gegners vor.',
});
const TEXT_OFFLINE = 'Keine Verbindung. Die Partie bleibt auf dem Server gespeichert, versuch es gleich noch einmal.';
const TEXT_ABGELAUFEN = 'Die Anmeldung ist abgelaufen. Bitte neu anmelden.';
const TEXT_NICHT_EINGERICHTET = 'Der Online-Teil ist auf dem Server noch nicht eingerichtet.';

function lager() { return globalThis.localStorage; }
function fehlerText(d, status) {
  const kennung = String(d?.message || d?.msg || '');
  let text = FEHLER_TEXTE[kennung];
  if (!text) {
    if (status === 401) text = TEXT_ABGELAUFEN;
    else if (status === 404) text = TEXT_NICHT_EINGERICHTET;
    else text = kennung || d?.error_description || `Serverfehler (${status})`;
  }
  const e = new Error(text);
  e.status = status; e.code = d?.code; e.kennung = FEHLER_TEXTE[kennung] ? kennung : undefined;
  return e;
}
async function anfrage(pfad, { methode = 'GET', daten, token } = {}) {
  const kopf = { apikey: SUPABASE_KEY };
  if (daten !== undefined) kopf['Content-Type'] = 'application/json';
  if (token) kopf.Authorization = `Bearer ${token}`;
  let r;
  try { r = await fetchFn(SUPABASE_URL + pfad, { method: methode, headers: kopf, body: daten === undefined ? undefined : JSON.stringify(daten) }); }
  catch (e) { throw new Error(TEXT_OFFLINE); }
  let d = null;
  if (r.status !== 204) { try { d = await r.json(); } catch (e) { /* leere Antwort */ } }
  if (!r.ok) throw fehlerText(d, r.status);
  return d;
}

// Sitzung aus konto.js; kurz vor dem Ablauf wird sie dort erneuert.
async function aktiveSitzung() {
  const s = sitzung();
  if (!s?.access_token) throw new Error(FEHLER_TEXTE.ONLINE_NICHT_ANGEMELDET);
  return Number(s.expires_at) <= Math.floor(Date.now() / 1000) + 30 ? erneuereSitzung() : s;
}
function userId(s) {
  if (s?.user?.id) return s.user.id;
  try { return JSON.parse(atob(String(s.access_token).split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).sub; } catch (e) { return null; }
}
async function rpc(name, daten) {
  const s = await aktiveSitzung();
  return anfrage(`/rest/v1/rpc/${name}`, { methode: 'POST', token: s.access_token, daten });
}
// PostgREST liefert eine einzelne Zeile als Objekt, setof als Liste: beides annehmen
function partieAus(d) {
  const p = Array.isArray(d) ? d[0] : d;
  if (!p || typeof p !== 'object' || !p.id) throw new Error('Der Server hat keine Partie zurückgegeben.');
  return p;
}

export function normalisiereCode(code) { return String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }

export async function erstelleEinladung({ farbe = 'zufall', bedenkzeit = null, inkrement = 0 } = {}) {
  if (!['w', 'b', 'zufall'].includes(farbe)) throw new Error(FEHLER_TEXTE.ONLINE_FARBE);
  const b = bedenkzeit == null ? null : Number(bedenkzeit);
  const i = b == null ? null : Number(inkrement ?? 0);
  if (b != null && (!Number.isInteger(b) || b < 1 || b > 10800)) throw new Error(FEHLER_TEXTE.ONLINE_BEDENKZEIT);
  if (i != null && (!Number.isInteger(i) || i < 0 || i > 600)) throw new Error(FEHLER_TEXTE.ONLINE_BEDENKZEIT);
  return partieAus(await rpc('online_erstelle', { farbe, bedenkzeit_s: b, inkrement_s: i }));
}

export async function tritteBei(code) {
  const c = normalisiereCode(code);
  if (!CODE_RE.test(c)) throw new Error(FEHLER_TEXTE.ONLINE_CODE_UNGUELTIG);
  return partieAus(await rpc('online_tritt_bei', { code: c }));
}

function zeilenPfad(id, filter = '') {
  return `/rest/v1/partien_online?id=eq.${encodeURIComponent(String(id || ''))}&select=*${filter}`;
}
export async function ladePartie(id) {
  const s = await aktiveSitzung();
  const d = await anfrage(zeilenPfad(id), { token: s.access_token });
  const p = Array.isArray(d) ? d[0] : null;
  if (!p) throw new Error(FEHLER_TEXTE.ONLINE_PARTIE_UNBEKANNT);
  return p;
}

export async function sendeZug(id, { uci, fenDanach, amZugDanach, ergebnis = null, grund = null } = {}) {
  if (!UCI_RE.test(String(uci || ''))) throw new Error(FEHLER_TEXTE.ONLINE_ZUG_FORM);
  const fen = String(fenDanach || '');
  if (!FEN_RE.test(fen) || fen.length > 120) throw new Error(FEHLER_TEXTE.ONLINE_FEN_FORM);
  if (!['w', 'b'].includes(amZugDanach)) throw new Error(FEHLER_TEXTE.ONLINE_AM_ZUG_FORM);
  if (ergebnis != null && !ERGEBNISSE.includes(ergebnis)) throw new Error(FEHLER_TEXTE.ONLINE_ERGEBNIS_FORM);
  const g = ergebnis == null || grund == null ? null : String(grund).slice(0, 40);
  return partieAus(await rpc('online_zug', { partie: id, zug: uci, fen_danach: fen, am_zug_danach: amZugDanach, ergebnis: ergebnis ?? null, grund: g }));
}

export async function gibAuf(id) { return partieAus(await rpc('online_gib_auf', { partie: id })); }
export async function bieteRemis(id) { return partieAus(await rpc('online_biete_remis', { partie: id })); }
export async function nimmRemisAn(id) { return partieAus(await rpc('online_nimm_remis_an', { partie: id })); }
export async function meinePartien() {
  const d = await rpc('online_meine', {});
  return Array.isArray(d) ? d : [];
}

// Abfrage statt Websocket: alle 2 s eine kleine Anfrage, die nur dann eine Zeile liefert, wenn sich seit dem
// letzten bekannten Stand (aktualisiert_am) etwas geaendert hat. Eine Anfrage laeuft nie doppelt.
export function beobachte(id, { alle = 2000, seit = null, beiAenderung, beiFehler, dokument = globalThis.document } = {}) {
  let aktiv = true;
  let timer = null;
  let stand = seit || null;
  let unterwegs = false;
  let letzterFehler = null;
  const versteckt = () => !!dokument?.hidden;
  const melde = (fn, wert) => { try { fn?.(wert); } catch (e) { try { console.error('Online-Beobachter:', e); } catch (x) { /* egal */ } } };
  async function tick() {
    if (!aktiv || unterwegs) return;
    clearTimeout(timer); timer = null;
    if (versteckt()) return; // pausiert; der Sichtbarkeits-Hoerer stoesst wieder an
    unterwegs = true;
    try {
      const s = await aktiveSitzung();
      const filter = stand ? `&aktualisiert_am=gt.${encodeURIComponent(stand)}` : '';
      const d = await anfrage(zeilenPfad(id, filter), { token: s.access_token });
      const p = Array.isArray(d) ? d[0] : null;
      letzterFehler = null;
      if (p && p.aktualisiert_am !== stand) { stand = p.aktualisiert_am; melde(beiAenderung, p); }
      else if (!p && !stand) { const e = new Error(FEHLER_TEXTE.ONLINE_PARTIE_UNBEKANNT); letzterFehler = e.message; melde(beiFehler, e); }
    } catch (e) {
      if (e?.message !== letzterFehler) { letzterFehler = e?.message; melde(beiFehler, e); }
    } finally {
      unterwegs = false;
      if (aktiv && !versteckt()) timer = setTimeout(tick, alle);
    }
  }
  const beiSichtbarkeit = () => { if (aktiv && !versteckt()) tick(); };
  try { dokument?.addEventListener?.('visibilitychange', beiSichtbarkeit); } catch (e) { /* ohne Pause weiter */ }
  tick();
  return {
    stop() {
      if (!aktiv) return;
      aktiv = false; clearTimeout(timer); timer = null;
      try { dokument?.removeEventListener?.('visibilitychange', beiSichtbarkeit); } catch (e) { /* egal */ }
    },
    laeuft: () => aktiv,
    stand: () => stand,
  };
}

export function einladungsLink(code, basis) {
  const c = normalisiereCode(code);
  if (!CODE_RE.test(c)) throw new Error(FEHLER_TEXTE.ONLINE_CODE_UNGUELTIG);
  let b = basis;
  if (b == null) {
    const l = globalThis.location;
    b = /^https?:/.test(String(l?.origin || '')) ? l.origin + (l.pathname || '/') : LINK_BASIS;
  }
  return `${String(b).replace(/[#?].*$/, '')}#online/${c}`;
}
export function codeAusLink(text) {
  const m = String(text || '').match(/#online\/([A-Za-z0-9]{6})(?:$|[/?&#])/);
  if (!m) return null;
  const c = normalisiereCode(m[1]);
  return CODE_RE.test(c) ? c : null;
}
export function uebernimmEinladungsLink(ort = globalThis.location) {
  const c = codeAusLink(ort?.hash || '');
  if (!c) return null;
  try { lager()?.setItem(EINLADUNG_SCHLUESSEL, c); } catch (e) { /* ohne Merker weiter */ }
  return c;
}
export function gemerkteEinladung() {
  try { const c = lager()?.getItem(EINLADUNG_SCHLUESSEL); return c && CODE_RE.test(c) ? c : null; } catch (e) { return null; }
}
export function vergissEinladung() { try { lager()?.removeItem(EINLADUNG_SCHLUESSEL); } catch (e) { /* egal */ } }

export function meineFarbe(partie, s = sitzung()) {
  const id = userId(s);
  if (!id || !partie) return null;
  if (partie.weiss === id) return 'w';
  if (partie.schwarz === id) return 'b';
  return null;
}
export function binAmZug(partie, s = sitzung()) {
  const f = meineFarbe(partie, s);
  return !!f && partie.status === 'laeuft' && partie.am_zug === f;
}
export function zuegeListe(partie) { return String(partie?.zuege || '').split(' ').filter(Boolean); }

// Registrierung ist defensiv und tut ohne Oberflaeche nur eines: Ein Einladungslink (#online/CODE) wird gemerkt,
// damit die kommende Oberflaeche ihn nach der Anmeldung aufnehmen kann. Die Offline-App darf hier nie scheitern.
try { uebernimmEinladungsLink(); } catch (e) { /* App laeuft ohne Online-Teil weiter */ }
