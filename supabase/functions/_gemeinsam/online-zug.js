// Anti-Cheat Etappe 1a, Teil 1: die ganze Logik der Edge Function online-zug als reines ES-Modul, damit sie in Node
// testbar ist (tests/server-online-zug.test.mjs). Die Huelle supabase/functions/online-zug/index.ts liest nur die Anfrage,
// misst die Ankunftszeit, ruft verarbeite() und schreibt die Antwort; nur sie kennt chess.js aus npm (feste Version 1.4.0,
// dieselbe wie vendor/chess). Hier kommt chess.js als Klasse Chess herein (in Node: vendor/chess/chess.js).
//
// Der Server ist Schiedsrichter (Konzept Anti-Cheat 5.1): Der Browser schickt nur { partie, zug } (UCI wie e2e4, mit
// Umwandlung e7e8q). Nie eine Stellung, nie ein Ergebnis; andere Felder lehnt die Function ab. Sie
//   1. prueft die Anmeldung selbst ueber /auth/v1/user (wie der Coach) und vertraut nur dieser Antwort,
//   2. laedt die Partie mit dem Service-Schluessel und prueft: Spieler dieser Partie, Partie laeuft, er ist am Zug,
//   3. spielt alle gespeicherten Zuege mit chess.js nach. Passt das nicht zur gespeicherten Stellung (verglichen werden
//      Brett und Seite am Zug, wie im Browser), ist die Partie defekt (ONLINE_PARTIE_DEFEKT) und es wird nichts verbucht,
//   4. prueft den neuen Zug nach den Regeln (ONLINE_ZUG_ILLEGAL; auch Rochade durch Schach, Umwandlung ohne Figur) und
//      speichert ihn so, wie chess.js ihn schreibt: Ein Umwandlungsbuchstabe an einem Zug ohne Umwandlung faellt weg
//      (e2e4q wird zu e2e4),
//   5. rechnet Stellung, Seite am Zug und das Ende selbst aus: Matt, Patt, zu wenig Material, dreifache Wiederholung,
//      50 Zuege (in dieser Reihenfolge, wie die App es bisher tat),
//   6. verbucht ueber die SQL-Funktion online_zug_verbuchen (nur Service-Rolle) mit der Nutzer-ID aus der Anmeldung, der
//      gemessenen Ankunftszeit und der Zahl der Halbzuege, auf der sie gerechnet hat. Die Datenbank begrenzt die
//      Ankunftszeit, fuehrt die Uhr und lehnt einen inzwischen veralteten Stand ab (ONLINE_STAND_VERALTET).
//
// Datenschutz und Protokoll: Gespeichert wird nur, was die Partie ohnehin enthaelt. Ins Protokoll kommen nur Kennungen
// (z. B. "online-zug illegal"), nie Nutzer-IDs, Zuege, Stellungen, Schluessel oder Fehlertexte. Antworten enthalten nie
// einen Stacktrace oder einen Schluessel.
//
// API:
//   MAX_KOERPER = 512                 groessere Anfragen: 413 (die Huelle liest hoechstens so viele Bytes)
//   KOPF                              JSON und CORS (die App laeuft auf einer anderen Adresse als Supabase)
//   KENNUNGEN                         alle Fehlerkennungen dieser Function (js/online.js hat fuer jede einen Satz)
//   FEHLER_TEXTE                      Kennung -> ruhiger Satz (Rueckfall; die App hat eigene Texte, Deutsch und Englisch)
//   SQL_KENNUNGEN                     Kennungen aus online_zug_verbuchen, die als solche an die App gehen (mit Status)
//   pruefeEingabe(daten) -> { ok: true, partie, zug } | { ok: false, kennung }
//       daten muss ein Objekt mit genau den Feldern partie (UUID) und zug (UCI) sein.
//   nachspielen(Chess, zuege) -> chess | null     zuege als Text 'e2e4 e7e5' (wie in partien_online); null, wenn ein
//       Zug nicht passt
//   stimmtUeberein(chess, zeile) -> boolean       Brett und Seite am Zug wie in zeile.fen und zeile.am_zug
//   ende(chess) -> { ergebnis, grund } | { ergebnis: null, grund: null }   nach dem Zug, aus Sicht des Ziehenden
//   rechneZug(Chess, zeile, uid, zug) -> { ok: true, zug, fen, amZug, ergebnis, grund, halbzuegeVorher }
//                                      | { ok: false, kennung }
//       zeile: die Partie (id, weiss, schwarz, status, fen, zuege, am_zug), uid: der Ziehende
//   leseKoerper(anfrage, max) -> Promise<{ text, zuGross }>   liest hoechstens max Bytes (Content-Length und Strom)
//   verarbeite({ methode, koerper, zuGross, autorisierung, ankunft }, umgebung, { fetch, Chess, protokoll, jetzt })
//       -> Promise<{ status, kopf, koerper }>
//       umgebung: { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY? }
//       ankunft: ISO-Zeit, die die Huelle beim Eintreffen der Anfrage gemessen hat (fehlt sie, gilt jetzt())
//       Antworten (immer JSON, immer mit CORS-Kopf):
//         200 die Partie (Zeile aus partien_online, wie bisher von online_zug), auch wenn sie dabei auf Zeit endet
//         204 (OPTIONS)   400 ONLINE_ANFRAGE | ONLINE_ZUG_FORM   401 ONLINE_NICHT_ANGEMELDET   404 ONLINE_PARTIE_UNBEKANNT
//         405 ONLINE_METHODE   409 ONLINE_PARTIE_NICHT_GESTARTET | ONLINE_PARTIE_BEENDET | ONLINE_NICHT_DEIN_ZUG |
//         ONLINE_STAND_VERALTET | ONLINE_PARTIE_DEFEKT   413 ONLINE_ANFRAGE   422 ONLINE_ZUG_ILLEGAL
//         503 ONLINE_NICHT_EINGERICHTET | ONLINE_SERVER
//       Jede Fehlerantwort: { fehler: Kennung, text }.
import { dienstKopf } from './stripe.js';

export const MAX_KOERPER = 512;
const UCI = /^[a-h][1-8][a-h][1-8][qrbn]?$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Obergrenze fuer die gespeicherte Zugliste (wie partien_online_zuege_groesse in online-schema.sql)
const MAX_ZUEGE_ZEICHEN = 20000;

export const KOPF = Object.freeze({
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  // Angemeldet wird per Bearer-Token, nicht per Cookie: "*" ist deshalb unbedenklich (wie beim Coach)
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Max-Age': '86400',
});

export const FEHLER_TEXTE = Object.freeze({
  ONLINE_METHODE: 'Der Server nimmt hier nur Züge an.',
  ONLINE_ANFRAGE: 'Die Anfrage hatte ein ungültiges Format.',
  ONLINE_ZUG_FORM: 'Der Zug hat ein ungültiges Format.',
  ONLINE_NICHT_ANGEMELDET: 'Bitte zuerst anmelden, um online zu spielen.',
  ONLINE_PARTIE_UNBEKANNT: 'Diese Partie wurde nicht gefunden.',
  ONLINE_PARTIE_NICHT_GESTARTET: 'Die Partie hat noch nicht begonnen.',
  ONLINE_PARTIE_BEENDET: 'Diese Partie ist schon beendet.',
  ONLINE_NICHT_DEIN_ZUG: 'Du bist nicht am Zug.',
  ONLINE_STAND_VERALTET: 'Die Partie hat sich gerade geändert. Der aktuelle Stand wird geladen.',
  ONLINE_PARTIE_DEFEKT: 'Die gespeicherten Züge dieser Partie lassen sich nicht nachspielen. Du kannst sie als strittig melden.',
  ONLINE_ZUG_ILLEGAL: 'Dieser Zug ist in der Stellung nicht erlaubt.',
  ONLINE_NICHT_EINGERICHTET: 'Die Zugprüfung ist auf dem Server noch nicht eingerichtet.',
  ONLINE_SERVER: 'Der Server kann den Zug gerade nicht prüfen. Bitte gleich noch einmal versuchen.',
});
export const KENNUNGEN = Object.freeze(Object.keys(FEHLER_TEXTE));

// Kennungen aus online_zug_verbuchen (raise), die unveraendert an die App gehen. Andere (Form, Folgestellung, Ergebnis)
// hiessen, dass Function und Datenbank sich widersprechen: das ist ein Fehler des Servers (ONLINE_SERVER, im Protokoll).
export const SQL_KENNUNGEN = Object.freeze({
  ONLINE_NICHT_ANGEMELDET: 401,
  ONLINE_PARTIE_UNBEKANNT: 404,
  ONLINE_PARTIE_NICHT_GESTARTET: 409,
  ONLINE_PARTIE_BEENDET: 409,
  ONLINE_NICHT_DEIN_ZUG: 409,
  ONLINE_STAND_VERALTET: 409,
});

function antwort(status, daten) {
  return { status, kopf: { ...KOPF }, koerper: JSON.stringify(daten) };
}
function fehler(status, kennung) {
  return antwort(status, { fehler: kennung, text: FEHLER_TEXTE[kennung] || FEHLER_TEXTE.ONLINE_SERVER });
}

export function bearer(kopf) {
  const m = /^Bearer\s+([A-Za-z0-9._~+/=-]{20,4096})$/.exec(String(kopf || '').trim());
  return m ? m[1] : null;
}

// ---------------------------------------------------------------------------
// Eingabe und Schach
// ---------------------------------------------------------------------------
export function pruefeEingabe(d) {
  if (!d || typeof d !== 'object' || Array.isArray(d) || Object.getPrototypeOf(d) !== Object.prototype) return { ok: false, kennung: 'ONLINE_ANFRAGE' };
  const felder = Object.keys(d);
  // Nur partie und zug: Stellung, Ergebnis, Grund oder Uhr vom Browser liest der Server nie
  if (felder.length !== 2 || !felder.includes('partie') || !felder.includes('zug')) return { ok: false, kennung: 'ONLINE_ANFRAGE' };
  if (typeof d.partie !== 'string' || !UUID.test(d.partie)) return { ok: false, kennung: 'ONLINE_ANFRAGE' };
  if (typeof d.zug !== 'string' || !UCI.test(d.zug)) return { ok: false, kennung: 'ONLINE_ZUG_FORM' };
  return { ok: true, partie: d.partie.toLowerCase(), zug: d.zug };
}

// Ein UCI-Zug auf dem Brett von chess; wirft, wenn er nicht erlaubt ist (chess.js prueft alle Regeln)
function ziehe(chess, uci) {
  return chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.length === 5 ? uci[4] : undefined });
}

export function nachspielen(Chess, zuege) {
  if (typeof zuege !== 'string' || zuege.length > MAX_ZUEGE_ZEICHEN) return null;
  const c = new Chess();
  for (const uci of zuege.split(' ').filter(Boolean)) {
    if (!UCI.test(uci)) return null;
    try { ziehe(c, uci); } catch (e) { return null; }
  }
  return c;
}

// Brett und Seite am Zug, nicht der ganze FEN-Text: Rochaderechte, en-passant-Feld und Zaehler schreiben verschiedene
// Fassungen verschieden, eine ehrliche Partie soll daran nicht scheitern (wie nachspielen() in js/ui/online.js)
export function stimmtUeberein(chess, zeile) {
  const [brett, seite] = String(zeile?.fen || '').split(' ');
  return chess.fen().split(' ')[0] === brett && chess.turn() === seite && seite === zeile?.am_zug;
}

export function ende(chess) {
  if (chess.isCheckmate()) return { ergebnis: chess.turn() === 'b' ? '1-0' : '0-1', grund: 'matt' };
  if (chess.isStalemate()) return { ergebnis: '1/2-1/2', grund: 'patt' };
  if (chess.isInsufficientMaterial()) return { ergebnis: '1/2-1/2', grund: 'material' };
  if (chess.isThreefoldRepetition()) return { ergebnis: '1/2-1/2', grund: 'wiederholung' };
  if (chess.isDrawByFiftyMoves()) return { ergebnis: '1/2-1/2', grund: '50-zuege' };
  return { ergebnis: null, grund: null };
}

export function rechneZug(Chess, zeile, uid, zug) {
  if (!zeile || typeof zeile !== 'object' || (zeile.weiss !== uid && zeile.schwarz !== uid)) return { ok: false, kennung: 'ONLINE_PARTIE_UNBEKANNT' };
  if (zeile.status === 'offen') return { ok: false, kennung: 'ONLINE_PARTIE_NICHT_GESTARTET' };
  if (zeile.status !== 'laeuft') return { ok: false, kennung: 'ONLINE_PARTIE_BEENDET' };
  const c = nachspielen(Chess, zeile.zuege);
  if (!c || !stimmtUeberein(c, zeile)) return { ok: false, kennung: 'ONLINE_PARTIE_DEFEKT' };
  const farbe = zeile.weiss === uid ? 'w' : 'b';
  if (c.turn() !== farbe) return { ok: false, kennung: 'ONLINE_NICHT_DEIN_ZUG' };
  const halbzuegeVorher = c.history().length;
  let m;
  try { m = ziehe(c, zug); } catch (e) { return { ok: false, kennung: 'ONLINE_ZUG_ILLEGAL' }; }
  if (!m || !UCI.test(String(m.lan || ''))) return { ok: false, kennung: 'ONLINE_ZUG_ILLEGAL' };
  const e = ende(c);
  return { ok: true, zug: m.lan, fen: c.fen(), amZug: c.turn(), ergebnis: e.ergebnis, grund: e.grund, halbzuegeVorher };
}

// ---------------------------------------------------------------------------
// Anfrage lesen (fuer die Huelle): hoechstens max Bytes, groessere Koerper werden nicht weiter gelesen
// ---------------------------------------------------------------------------
export async function leseKoerper(anfrage, max = MAX_KOERPER) {
  const laenge = Number(anfrage?.headers?.get?.('content-length'));
  if (Number.isFinite(laenge) && laenge > max) return { text: '', zuGross: true };
  const strom = anfrage?.body;
  if (!strom || typeof strom.getReader !== 'function') return { text: '', zuGross: false };
  const leser = strom.getReader();
  const teile = [];
  let summe = 0;
  try {
    for (;;) {
      const { done, value } = await leser.read();
      if (done) break;
      summe += value.byteLength;
      if (summe > max) {
        try { await leser.cancel(); } catch (e) { /* egal */ }
        return { text: '', zuGross: true };
      }
      teile.push(value);
    }
  } catch (e) {
    return { text: '', zuGross: false };
  }
  const alles = new Uint8Array(summe);
  let pos = 0;
  for (const t of teile) { alles.set(t, pos); pos += t.byteLength; }
  let text = '';
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(alles); } catch (e) { text = ''; }
  return { text, zuGross: false };
}

// ---------------------------------------------------------------------------
// Anfrage verarbeiten
// ---------------------------------------------------------------------------
async function holeJson(holen, url, optionen) {
  try {
    const r = await holen(url, optionen);
    if (!r) return { ok: false, status: null, daten: null };
    let daten = null;
    try { daten = await r.json(); } catch (e) { /* ohne Koerper */ }
    return { ok: !!r.ok, status: r.status, daten };
  } catch (e) {
    return { ok: false, status: null, daten: null };
  }
}

function gueltigeZeit(wert, ersatz) {
  const ms = typeof wert === 'string' && wert.length <= 40 ? Date.parse(wert) : NaN;
  return Number.isFinite(ms) ? new Date(ms).toISOString() : new Date(ersatz).toISOString();
}

export async function verarbeite({ methode, koerper, zuGross, autorisierung, ankunft } = {}, umgebung = {}, { fetch: holen, Chess, protokoll, jetzt } = {}) {
  const log = (zeile) => { try { if (typeof protokoll === 'function') protokoll('online-zug ' + zeile); } catch (e) { /* egal */ } };
  const uhr = typeof jetzt === 'function' ? jetzt : () => Date.now();
  // Die Ankunft misst die Huelle beim Eintreffen; fehlt sie oder ist sie unlesbar, gilt jetzt
  const ankunftIso = gueltigeZeit(ankunft, uhr());
  if (methode === 'OPTIONS') return { status: 204, kopf: { ...KOPF }, koerper: '' };
  if (methode !== 'POST') return fehler(405, 'ONLINE_METHODE');
  const basis = String(umgebung.SUPABASE_URL || '').replace(/\/+$/, '');
  const dienst = umgebung.SUPABASE_SERVICE_ROLE_KEY;
  const oeffentlich = umgebung.SUPABASE_ANON_KEY || dienst;
  const f = holen || globalThis.fetch;
  if (!basis || !dienst || typeof Chess !== 'function' || typeof f !== 'function') {
    log('nicht_eingerichtet');
    return fehler(503, 'ONLINE_NICHT_EINGERICHTET');
  }
  const jwt = bearer(autorisierung);
  if (!jwt) return fehler(401, 'ONLINE_NICHT_ANGEMELDET');
  if (zuGross || (typeof koerper === 'string' && koerper.length > MAX_KOERPER)) return fehler(413, 'ONLINE_ANFRAGE');
  if (typeof koerper !== 'string' || !koerper) return fehler(400, 'ONLINE_ANFRAGE');
  let daten = null;
  try { daten = JSON.parse(koerper); } catch (e) { return fehler(400, 'ONLINE_ANFRAGE'); }
  const eingabe = pruefeEingabe(daten);
  if (!eingabe.ok) return fehler(400, eingabe.kennung);

  // Wer zieht? Supabase prueft das Token (auch abgelaufen oder abgemeldet), die Function vertraut nur dieser Antwort.
  const nutzer = await holeJson(f, `${basis}/auth/v1/user`, { method: 'GET', headers: { apikey: oeffentlich, Authorization: `Bearer ${jwt}` } });
  if (nutzer.status === 401 || nutzer.status === 403) {
    // Ein falscher oder abgeschalteter Projekt-Schluessel sieht sonst aus wie eine abgelaufene Anmeldung (wie beim Coach)
    const meldung = nutzer.daten && typeof nutzer.daten === 'object' ? String(nutzer.daten.message || nutzer.daten.msg || '') : '';
    if (nutzer.status === 401 && /api ?key/i.test(meldung)) {
      log('nicht_eingerichtet apikey');
      return fehler(503, 'ONLINE_NICHT_EINGERICHTET');
    }
    log('anmeldung ' + nutzer.status);
    return fehler(401, 'ONLINE_NICHT_ANGEMELDET');
  }
  if (!nutzer.ok) { log('server auth'); return fehler(503, 'ONLINE_SERVER'); }
  const uid = nutzer.daten && typeof nutzer.daten.id === 'string' && UUID.test(nutzer.daten.id) ? nutzer.daten.id.toLowerCase() : null;
  if (!uid) return fehler(401, 'ONLINE_NICHT_ANGEMELDET');

  // Partie laden (Service-Schluessel, nur die noetigen Spalten)
  const pfad = `${basis}/rest/v1/partien_online?id=eq.${encodeURIComponent(eingabe.partie)}&select=id,weiss,schwarz,status,fen,zuege,am_zug`;
  const geladen = await holeJson(f, pfad, { method: 'GET', headers: dienstKopf(dienst) });
  if (geladen.status === 404) { log('nicht_eingerichtet tabelle'); return fehler(503, 'ONLINE_NICHT_EINGERICHTET'); }
  if (!geladen.ok || !Array.isArray(geladen.daten)) { log('server laden'); return fehler(503, 'ONLINE_SERVER'); }
  const zeile = geladen.daten[0] || null;
  const zeileFuer = zeile && typeof zeile === 'object' ? {
    ...zeile,
    weiss: typeof zeile.weiss === 'string' ? zeile.weiss.toLowerCase() : zeile.weiss,
    schwarz: typeof zeile.schwarz === 'string' ? zeile.schwarz.toLowerCase() : zeile.schwarz,
  } : null;

  let r;
  try { r = rechneZug(Chess, zeileFuer, uid, eingabe.zug); } catch (e) { log('server rechnen'); return fehler(503, 'ONLINE_SERVER'); }
  if (!r.ok) {
    if (r.kennung === 'ONLINE_ZUG_ILLEGAL') { log('illegal'); return fehler(422, r.kennung); }
    if (r.kennung === 'ONLINE_PARTIE_DEFEKT') { log('defekt'); return fehler(409, r.kennung); }
    if (r.kennung === 'ONLINE_PARTIE_UNBEKANNT') return fehler(404, r.kennung);
    return fehler(409, r.kennung);
  }

  // Verbuchen: nur Werte, die der Server selbst ausgerechnet hat, und die Nutzer-ID aus der Anmeldung
  const gebucht = await holeJson(f, `${basis}/rest/v1/rpc/online_zug_verbuchen`, {
    method: 'POST',
    headers: dienstKopf(dienst),
    body: JSON.stringify({
      partie: eingabe.partie, nutzer: uid, zug: r.zug, fen_danach: r.fen, am_zug_danach: r.amZug,
      ergebnis: r.ergebnis, grund: r.grund, ankunft: ankunftIso, halbzuege_vorher: r.halbzuegeVorher,
    }),
  });
  if (!gebucht.ok) {
    const kennung = gebucht.daten && typeof gebucht.daten === 'object' ? String(gebucht.daten.message || '') : '';
    if (Object.prototype.hasOwnProperty.call(SQL_KENNUNGEN, kennung)) {
      if (kennung === 'ONLINE_STAND_VERALTET') log('veraltet');
      return fehler(SQL_KENNUNGEN[kennung], kennung);
    }
    // PostgREST: Funktion fehlt (online-schema.sql noch nicht neu eingespielt) -> 404 bzw. PGRST202
    if (gebucht.status === 404 || (gebucht.daten && gebucht.daten.code === 'PGRST202')) {
      log('nicht_eingerichtet sql');
      return fehler(503, 'ONLINE_NICHT_EINGERICHTET');
    }
    log(/^ONLINE_[A-Z_]{1,40}$/.test(kennung) ? 'widerspruch ' + kennung : 'server buchen ' + (gebucht.status || 'netz'));
    return fehler(503, 'ONLINE_SERVER');
  }
  const p = Array.isArray(gebucht.daten) ? gebucht.daten[0] : gebucht.daten;
  if (!p || typeof p !== 'object' || typeof p.id !== 'string') { log('server antwort'); return fehler(503, 'ONLINE_SERVER'); }
  if (p.status === 'beendet') log('ende ' + (typeof p.grund === 'string' && /^[a-z0-9-]{1,40}$/.test(p.grund) ? p.grund : 'ohne'));
  return antwort(200, p);
}
