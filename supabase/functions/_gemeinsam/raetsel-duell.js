// Raetsel-Duell (Etappe 5): die ganze Logik der Edge Function raetsel-duell als reines ES-Modul, in Node getestet
// (tests/server-raetsel-duell-zug.test.mjs). Die Huelle supabase/functions/raetsel-duell/index.ts liest nur die Anfrage,
// misst die Ankunft, ruft verarbeite() und schreibt die Antwort; nur sie kennt chess.js aus npm (1.4.0, wie vendor/chess).
//
// Der Server entscheidet (Konzept 10b): Das Geraet schickt nur { duell, zug } (UCI). Die Function
//   1. prueft die Anmeldung ueber /auth/v1/user und vertraut nur dieser Antwort,
//   2. holt mit dem Service-Schluessel die Lage des Spielers MIT Loesung (duell_zug_lage; die Loesung verlaesst den
//      Server nie),
//   3. spielt die schon gespielten Halbzuege nach und prueft den Zug mit chess.js: richtig ist der Loesungszug, und
//      jedes Matt loest das Raetsel sofort, in welchem Zug auch immer (wie bei Lichess). Ein illegaler Zug zaehlt nicht (422, kein Abzug),
//   4. verbucht ueber duell_zug_verbuchen mit dem Stand, auf dem sie geprueft hat, und der gemessenen Ankunft. Zeit,
//      Abzug, naechstes Raetsel und veralteten Stand entscheidet die Datenbank.
// Ins Protokoll kommen nur Kennungen, nie Nutzer, Zuege, Stellungen oder Schluessel.
//
// API:
//   MAX_KOERPER, KOPF, KENNUNGEN, FEHLER_TEXTE, SQL_KENNUNGEN (Kennung -> Status)
//   pruefeEingabe(daten) -> { ok: true, duell, zug } | { ok: false, kennung }
//   pruefeZug(Chess, lage, zug) -> { ok: true, richtig, fertig } | { ok: false, kennung: 'DUELL_ZUG_ILLEGAL' | 'DUELL_SERVER' }
//       lage: { idx, schritt, fen, loesung, status } aus duell_zug_lage
//   verarbeite({ methode, koerper, zuGross, autorisierung, ankunft }, umgebung, { fetch, Chess, protokoll, jetzt })
//       -> Promise<{ status, kopf, koerper }>
//       200 { richtig, fertig, idx, schritt, geloest, fehler, ende_am, naechstes }   204 (OPTIONS)
//       400 DUELL_ANFRAGE | DUELL_ZUG_FORM   401 DUELL_NICHT_ANGEMELDET   404 DUELL_UNBEKANNT   405 DUELL_METHODE
//       409 DUELL_BEENDET | DUELL_NICHT_GESTARTET | DUELL_ZEIT_UM | DUELL_FERTIG | DUELL_STAND_VERALTET
//       413 DUELL_ANFRAGE   422 DUELL_ZUG_ILLEGAL   503 DUELL_NICHT_EINGERICHTET | DUELL_SERVER
import { dienstKopf } from './stripe.js';
import { KOPF, MAX_KOERPER, bearer, leseKoerper } from './online-zug.js';

export { KOPF, MAX_KOERPER, leseKoerper };
const UCI = /^[a-h][1-8][a-h][1-8][qrbn]?$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const FEHLER_TEXTE = Object.freeze({
  DUELL_METHODE: 'Der Server nimmt hier nur Züge an.',
  DUELL_ANFRAGE: 'Die Anfrage hatte ein ungültiges Format.',
  DUELL_ZUG_FORM: 'Der Zug hat ein ungültiges Format.',
  DUELL_NICHT_ANGEMELDET: 'Bitte zuerst anmelden, um im Duell zu spielen.',
  DUELL_UNBEKANNT: 'Dieses Duell wurde nicht gefunden.',
  DUELL_BEENDET: 'Dieses Duell ist schon vorbei.',
  DUELL_NICHT_GESTARTET: 'Das Duell beginnt gleich.',
  DUELL_ZEIT_UM: 'Deine Zeit ist um.',
  DUELL_FERTIG: 'Du hast alle Rätsel gespielt.',
  DUELL_STAND_VERALTET: 'Der Stand hat sich gerade geändert. Er wird neu geladen.',
  DUELL_ZUG_ILLEGAL: 'Dieser Zug ist in der Stellung nicht erlaubt.',
  DUELL_NICHT_EINGERICHTET: 'Das Rätsel-Duell ist auf dem Server noch nicht eingerichtet.',
  DUELL_SERVER: 'Der Server kann den Zug gerade nicht prüfen. Bitte gleich noch einmal versuchen.',
});
export const KENNUNGEN = Object.freeze(Object.keys(FEHLER_TEXTE));

// Kennungen aus duell_zug_lage / duell_zug_verbuchen (raise), die unveraendert an die App gehen
export const SQL_KENNUNGEN = Object.freeze({
  DUELL_UNBEKANNT: 404,
  DUELL_BEENDET: 409,
  DUELL_NICHT_GESTARTET: 409,
  DUELL_ZEIT_UM: 409,
  DUELL_FERTIG: 409,
  DUELL_STAND_VERALTET: 409,
});

function antwort(status, daten) {
  return { status, kopf: { ...KOPF }, koerper: JSON.stringify(daten) };
}
function fehler(status, kennung) {
  return antwort(status, { fehler: kennung, text: FEHLER_TEXTE[kennung] || FEHLER_TEXTE.DUELL_SERVER });
}

export function pruefeEingabe(d) {
  if (!d || typeof d !== 'object' || Array.isArray(d) || Object.getPrototypeOf(d) !== Object.prototype) return { ok: false, kennung: 'DUELL_ANFRAGE' };
  const felder = Object.keys(d);
  // nur duell und zug: ob der Zug richtig ist, sagt nie das Geraet
  if (felder.length !== 2 || !felder.includes('duell') || !felder.includes('zug')) return { ok: false, kennung: 'DUELL_ANFRAGE' };
  if (typeof d.duell !== 'string' || !UUID.test(d.duell)) return { ok: false, kennung: 'DUELL_ANFRAGE' };
  if (typeof d.zug !== 'string' || !UCI.test(d.zug)) return { ok: false, kennung: 'DUELL_ZUG_FORM' };
  return { ok: true, duell: d.duell.toLowerCase(), zug: d.zug };
}

function ziehe(chess, uci) {
  return chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.length === 5 ? uci[4] : undefined });
}

export function pruefeZug(Chess, lage, zug) {
  const loesung = Array.isArray(lage?.loesung) ? lage.loesung : null;
  const schritt = lage?.schritt;
  if (!loesung || !loesung.every((u) => typeof u === 'string' && UCI.test(u)) || !Number.isInteger(schritt)
      || schritt < 0 || schritt % 2 !== 0 || schritt >= loesung.length) return { ok: false, kennung: 'DUELL_SERVER' };
  let c;
  try {
    c = new Chess(lage.fen);
    for (const u of loesung.slice(0, schritt)) ziehe(c, u);
  } catch (e) { return { ok: false, kennung: 'DUELL_SERVER' }; }
  let m;
  try { m = ziehe(c, zug); } catch (e) { return { ok: false, kennung: 'DUELL_ZUG_ILLEGAL' }; }
  if (!m) return { ok: false, kennung: 'DUELL_ZUG_ILLEGAL' };
  const letzter = schritt === loesung.length - 1;
  // ein Matt beendet jedes Raetsel; sonst zaehlt nur der Loesungszug (chess.js schreibt den Zug in lan wie UCI)
  if (c.isCheckmate()) return { ok: true, richtig: true, fertig: true };
  const richtig = m.lan === loesung[schritt];
  return { ok: true, richtig, fertig: richtig && letzter };
}

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

// Fehler einer RPC: bekannte Kennung -> an die App, fehlende Funktion -> nicht eingerichtet, sonst Serverfehler
function rpcFehler(r, log, wo) {
  const kennung = r.daten && typeof r.daten === 'object' ? String(r.daten.message || '') : '';
  if (Object.prototype.hasOwnProperty.call(SQL_KENNUNGEN, kennung)) return fehler(SQL_KENNUNGEN[kennung], kennung);
  if (r.status === 404 || (r.daten && r.daten.code === 'PGRST202')) { log('nicht_eingerichtet sql'); return fehler(503, 'DUELL_NICHT_EINGERICHTET'); }
  log(`server ${wo} ` + (r.status || 'netz'));
  return fehler(503, 'DUELL_SERVER');
}

export async function verarbeite({ methode, koerper, zuGross, autorisierung, ankunft } = {}, umgebung = {}, { fetch: holen, Chess, protokoll, jetzt } = {}) {
  const log = (zeile) => { try { if (typeof protokoll === 'function') protokoll('raetsel-duell ' + zeile); } catch (e) { /* egal */ } };
  const uhr = typeof jetzt === 'function' ? jetzt : () => Date.now();
  const ankunftIso = gueltigeZeit(ankunft, uhr());
  if (methode === 'OPTIONS') return { status: 204, kopf: { ...KOPF }, koerper: '' };
  if (methode !== 'POST') return fehler(405, 'DUELL_METHODE');
  const basis = String(umgebung.SUPABASE_URL || '').replace(/\/+$/, '');
  const dienst = umgebung.SUPABASE_SERVICE_ROLE_KEY;
  const oeffentlich = umgebung.SUPABASE_ANON_KEY || dienst;
  const f = holen || globalThis.fetch;
  if (!basis || !dienst || typeof Chess !== 'function' || typeof f !== 'function') {
    log('nicht_eingerichtet');
    return fehler(503, 'DUELL_NICHT_EINGERICHTET');
  }
  const jwt = bearer(autorisierung);
  if (!jwt) return fehler(401, 'DUELL_NICHT_ANGEMELDET');
  if (zuGross || (typeof koerper === 'string' && koerper.length > MAX_KOERPER)) return fehler(413, 'DUELL_ANFRAGE');
  if (typeof koerper !== 'string' || !koerper) return fehler(400, 'DUELL_ANFRAGE');
  let daten = null;
  try { daten = JSON.parse(koerper); } catch (e) { return fehler(400, 'DUELL_ANFRAGE'); }
  const eingabe = pruefeEingabe(daten);
  if (!eingabe.ok) return fehler(400, eingabe.kennung);

  const nutzer = await holeJson(f, `${basis}/auth/v1/user`, { method: 'GET', headers: { apikey: oeffentlich, Authorization: `Bearer ${jwt}` } });
  if (nutzer.status === 401 || nutzer.status === 403) {
    const meldung = nutzer.daten && typeof nutzer.daten === 'object' ? String(nutzer.daten.message || nutzer.daten.msg || '') : '';
    if (nutzer.status === 401 && /api ?key/i.test(meldung)) { log('nicht_eingerichtet apikey'); return fehler(503, 'DUELL_NICHT_EINGERICHTET'); }
    return fehler(401, 'DUELL_NICHT_ANGEMELDET');
  }
  if (!nutzer.ok) { log('server auth'); return fehler(503, 'DUELL_SERVER'); }
  const uid = nutzer.daten && typeof nutzer.daten.id === 'string' && UUID.test(nutzer.daten.id) ? nutzer.daten.id.toLowerCase() : null;
  if (!uid) return fehler(401, 'DUELL_NICHT_ANGEMELDET');

  const lage = await holeJson(f, `${basis}/rest/v1/rpc/duell_zug_lage`, {
    method: 'POST', headers: dienstKopf(dienst), body: JSON.stringify({ nutzer: uid, duell: eingabe.duell }),
  });
  if (!lage.ok) return rpcFehler(lage, log, 'lage');
  const l = lage.daten;
  if (!l || typeof l !== 'object') { log('server lage antwort'); return fehler(503, 'DUELL_SERVER'); }
  if (l.status !== 'laeuft') return fehler(409, l.status === 'offen' ? 'DUELL_NICHT_GESTARTET' : 'DUELL_BEENDET');

  let r;
  try { r = pruefeZug(Chess, l, eingabe.zug); } catch (e) { r = { ok: false, kennung: 'DUELL_SERVER' }; }
  if (!r.ok) {
    if (r.kennung === 'DUELL_ZUG_ILLEGAL') return fehler(422, r.kennung);
    // alle Raetsel gespielt: duell_zug_lage liefert dann keine Stellung
    if (l.fen == null) return fehler(409, 'DUELL_FERTIG');
    log('server pruefen');
    return fehler(503, 'DUELL_SERVER');
  }

  const gebucht = await holeJson(f, `${basis}/rest/v1/rpc/duell_zug_verbuchen`, {
    method: 'POST',
    headers: dienstKopf(dienst),
    body: JSON.stringify({
      nutzer: uid, duell: eingabe.duell, idx_vorher: l.idx, schritt_vorher: l.schritt, richtig: r.richtig, fertig: r.fertig,
      ankunft: ankunftIso,
    }),
  });
  if (!gebucht.ok) {
    if (gebucht.daten && gebucht.daten.message === 'DUELL_STAND_VERALTET') log('veraltet');
    return rpcFehler(gebucht, log, 'buchen');
  }
  const s = gebucht.daten;
  if (!s || typeof s !== 'object' || !Number.isInteger(s.idx)) { log('server antwort'); return fehler(503, 'DUELL_SERVER'); }
  return antwort(200, { richtig: r.richtig, fertig: r.fertig, ...s });
}
