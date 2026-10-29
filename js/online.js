// Online gegen Freunde (Stufe 2, Fundament): Einladung per Code oder Link, Partien ueber die Funktionen aus
// supabase/online-schema.sql, Zuege seit Anti-Cheat Etappe 1a ueber die Edge Function online-zug, Stand der Partie per
// Abfrage alle 2 s. Nur fetch (keine Bibliothek, kein Websocket; Realtime kann spaeter dazukommen), Sitzung aus konto.js
// (sitzung, erneuereSitzung).
// Die Oberflaeche liegt in js/ui/online.js; Bot-Partie und Arena bleiben unabhaengig.
//
// API (alles ausser den reinen Helfern braucht eine Anmeldung ueber konto.js):
//   erstelleEinladung({ farbe = 'zufall', bedenkzeit = null, inkrement = 0 }) -> Partie
//       farbe 'w' | 'b' | 'zufall' (eigene Farbe), bedenkzeit in Sekunden (null: ohne Uhr), inkrement in Sekunden
//   tritteBei(code) -> Partie            der Code darf klein, mit Leerzeichen oder Bindestrichen kommen. Der Server
//       antwortet seit Anti-Cheat Etappe 0 mit jsonb: die Zeile oder { fehler: 'ONLINE_...' } (ein falscher Code ist
//       ein gezaehlter Fehlversuch, deshalb kein raise); beides wird hier zur Partie oder zu einem Fehler mit Satz.
//   ladePartie(id) -> Partie             Fehler, wenn es sie nicht gibt oder sie einem Fremden gehoert
//   sendeZug(id, { uci }) -> Partie     POST an die Edge Function online-zug (ZUG_PFAD) mit genau { partie, zug }.
//       Seit Anti-Cheat Etappe 1a schickt der Browser nur noch den Zug (UCI, z. B. e2e4 oder e7e8q): Stellung, Seite am
//       Zug und das Ende (Matt, Patt, Material, Wiederholung, 50 Zuege) rechnet der Server mit chess.js selbst aus.
//       Andere Felder (frueher fenDanach, amZugDanach, ergebnis, grund) werden nicht mehr gesendet. Fehler kommen als
//       { fehler: 'ONLINE_...' } mit HTTP-Status und werden wie die Kennungen der Datenbank zu Saetzen.
//   gibAuf(id), bieteRemis(id), nimmRemisAn(id) -> Partie   (gibAuf auf einer offenen Einladung: zurueckziehen)
//   meldeStrittig(id) -> Partie         die Stellung auf dem Server passt nicht zu den Zuegen: Die Partie endet ohne
//       Ergebnis (grund 'strittig'), auch wenn die eigene Uhr laeuft; danach entscheidet die Uhr nicht mehr.
//   pruefeZeit(id) -> Partie             Zeit reklamieren: ist die Uhr der Seite am Zug abgelaufen, endet die
//       Partie auf dem Server (grund 'zeit', mit zu wenig Mattmaterial des Gegners 'zeit-material' als Remis); eine
//       haengende Partie (mit Uhr vor dem 2. Halbzug 10 Minuten ohne Zug, ohne Uhr 7 Tage) endet als 'abgebrochen';
//       sonst kommt die unveraenderte Partie zurueck. Die Oberflaeche ruft das, wenn die heruntergerechnete Uhr des
//       Gegners bei 0 steht, und vor dem 2. Halbzug einer Partie mit Uhr nach 10 Minuten ohne Zug.
//   meinePartien({ beendete = false } = {}) -> [Partie], optional mit den letzten 100 beendeten Partien
//   beobachte(id, { alle = 2000, seit, beiAenderung, beiFehler, bisEnde = true }) -> { stop(), laeuft(), stand(), grund() }
//       fragt alle `alle` ms nach einer neueren Zeile (aktualisiert_am) und ruft beiAenderung(partie) nur bei
//       einer Aenderung; pausiert, solange document.hidden, und fragt beim Sichtbarwerden sofort wieder;
//       Fehler (auch offline) gehen an beiFehler(fehler), derselbe Fehlertext nur einmal hintereinander, und der
//       Abstand waechst bei Fehlern bis 30 s (danach wieder `alle`). Nach stop() kommt kein Hoerer-Aufruf mehr,
//       auch nicht aus einer Anfrage, die gerade unterwegs war. Die Abfrage haelt von selbst an (grund()):
//       'beendet' (Partie beendet, mit bisEnde), 'unbekannt' (Partie gibt es nicht oder sie gehoert Fremden; einmal
//       gemeldet), 'abgemeldet' (keine Sitzung, oder das Erneuern scheitert: einmal "Bitte neu anmelden", fehler.abgemeldet
//       = true; die Oberflaeche startet nach dem Anmelden eine neue Abfrage). Ein 401 bei lokal noch gueltiger Sitzung
//       fuehrt zu genau einem Erneuern und sofortigem neuem Versuch. Nichts wirft, die App laeuft weiter.
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
import { t } from './sprache.js';
import './sprachen/online.js';
const O = (k, w) => t('online.' + k, w);
import { sitzung, erneuereSitzung, aktiveSitzung as kontoSitzung, userId, kontoFreigeschaltet } from './konto.js';

export const EINLADUNG_SCHLUESSEL = 'schach-arena:online:einladung';
export const LINK_BASIS = 'https://floboldt007-cmyk.github.io/schach/';
export const CODE_ZEICHEN = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
// Edge Function, die jeden Zug prueft und verbucht (supabase/functions/online-zug, Anti-Cheat Etappe 1a)
export const ZUG_PFAD = '/functions/v1/online-zug';
const CODE_RE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;
const UCI_RE = /^[a-h][1-8][a-h][1-8][qrbn]?$/;
let fetchFn = (...a) => fetch(...a);
export function setzeOnlineFetch(fn) { fetchFn = fn || ((...a) => fetch(...a)); }

export const FEHLER_TEXTE = Object.freeze({
  get ONLINE_NICHT_ANGEMELDET() { return O('fehler.ONLINE_NICHT_ANGEMELDET'); },
  get ONLINE_FARBE() { return O('fehler.ONLINE_FARBE'); },
  get ONLINE_BEDENKZEIT() { return O('fehler.ONLINE_BEDENKZEIT'); },
  get ONLINE_KEIN_CODE() { return O('fehler.ONLINE_KEIN_CODE'); },
  get ONLINE_CODE_UNGUELTIG() { return O('fehler.ONLINE_CODE_UNGUELTIG'); },
  get ONLINE_EIGENE_PARTIE() { return O('fehler.ONLINE_EIGENE_PARTIE'); },
  get ONLINE_PARTIE_UNBEKANNT() { return O('fehler.ONLINE_PARTIE_UNBEKANNT'); },
  get ONLINE_PARTIE_NICHT_GESTARTET() { return O('fehler.ONLINE_PARTIE_NICHT_GESTARTET'); },
  get ONLINE_PARTIE_BEENDET() { return O('fehler.ONLINE_PARTIE_BEENDET'); },
  get ONLINE_NICHT_DEIN_ZUG() { return O('fehler.ONLINE_NICHT_DEIN_ZUG'); },
  get ONLINE_ZUG_FORM() { return O('fehler.ONLINE_ZUG_FORM'); },
  get ONLINE_FEN_FORM() { return O('fehler.ONLINE_FEN_FORM'); },
  get ONLINE_AM_ZUG_FORM() { return O('fehler.ONLINE_AM_ZUG_FORM'); },
  get ONLINE_ERGEBNIS_FORM() { return O('fehler.ONLINE_ERGEBNIS_FORM'); },
  get ONLINE_KEIN_REMISANGEBOT() { return O('fehler.ONLINE_KEIN_REMISANGEBOT'); },
  get ONLINE_CODE_ABGELAUFEN() { return O('fehler.ONLINE_CODE_ABGELAUFEN'); },
  get ONLINE_ZU_VIELE_EINLADUNGEN() { return O('fehler.ONLINE_ZU_VIELE_EINLADUNGEN'); },
  get ONLINE_ZU_VIELE_VERSUCHE() { return O('fehler.ONLINE_ZU_VIELE_VERSUCHE'); },
  get ONLINE_STELLUNG_FALSCH() { return O('fehler.ONLINE_STELLUNG_FALSCH'); },
  // Edge Function online-zug (Anti-Cheat Etappe 1a)
  get ONLINE_ZUG_ILLEGAL() { return O('fehler.ONLINE_ZUG_ILLEGAL'); },
  get ONLINE_STAND_VERALTET() { return O('fehler.ONLINE_STAND_VERALTET'); },
  get ONLINE_PARTIE_DEFEKT() { return O('fehler.ONLINE_PARTIE_DEFEKT'); },
  get ONLINE_NICHT_EINGERICHTET() { return O('fehler.ONLINE_NICHT_EINGERICHTET'); },
  get ONLINE_SERVER() { return O('fehler.ONLINE_SERVER'); },
  get ONLINE_ANFRAGE() { return O('fehler.ONLINE_ANFRAGE'); },
  get ONLINE_METHODE() { return O('fehler.ONLINE_METHODE'); },
});

function lager() { return globalThis.localStorage; }
// Unbekannte Antworten des Servers (Englisch, technisch) gehen nie roh an den Nutzer: Die Meldung ist ein ganzer
// Satz in der Sprache der App, der Originaltext bleibt in fehler.detail (fuer Konsole und Tests).
function allgemeinerText(status, code) {
  if (status === 403 || code === '42501') return O('berechtigung');
  if (status === 429) return O('anfragen');
  if (status >= 500) return O('server', { status });
  if (code === '23514' || code === '22001' || code === '23502') return O('daten');
  if (code === '23505') return O('doppelt');
  return O('abgelehnt', { status });
}
// Kennung: message (Datenbank ueber PostgREST), msg (Anmeldung) oder fehler (Edge Function online-zug). Nur eigene
// Schluessel von FEHLER_TEXTE zaehlen (nicht constructor, toString usw.).
function fehlerText(d, status) {
  const roh = String(d?.message || d?.msg || d?.fehler || '');
  const bekannt = Object.prototype.hasOwnProperty.call(FEHLER_TEXTE, roh);
  const kennung = bekannt ? roh : '';
  // 401 mit lokaler Sitzung (nur mit ihr fragt die App): Der Server lehnt das Token ab, also abgelaufen
  let text = status === 401 ? '' : bekannt ? FEHLER_TEXTE[kennung] : '';
  if (!text) {
    if (status === 401) text = O('abgelaufen');
    else if (status === 404) text = O('einrichtung');
    else text = allgemeinerText(status, d?.code);
  }
  const e = new Error(text);
  e.status = status; e.code = d?.code; e.kennung = bekannt ? kennung : undefined;
  e.detail = roh || d?.error_description || '';
  return e;
}
async function anfrage(pfad, { methode = 'GET', daten, token } = {}) {
  const kopf = { apikey: SUPABASE_KEY };
  if (daten !== undefined) kopf['Content-Type'] = 'application/json';
  if (token) kopf.Authorization = `Bearer ${token}`;
  let r;
  try { r = await fetchFn(SUPABASE_URL + pfad, { method: methode, headers: kopf, body: daten === undefined ? undefined : JSON.stringify(daten) }); }
  catch (e) { throw new Error(O('offline')); }
  let d = null;
  if (r.status !== 204) { try { d = await r.json(); } catch (e) { /* leere Antwort */ } }
  if (!r.ok) throw fehlerText(d, r.status);
  return d;
}

// Sitzung aus konto.js (dort wird sie kurz vor dem Ablauf erneuert); ohne Anmeldung der Online-Text.
async function aktiveSitzung() {
  if (!sitzung()?.access_token) throw new Error(FEHLER_TEXTE.ONLINE_NICHT_ANGEMELDET);
  return kontoSitzung();
}
async function rpc(name, daten) {
  const s = await aktiveSitzung();
  return anfrage(`/rest/v1/rpc/${name}`, { methode: 'POST', token: s.access_token, daten });
}
// PostgREST liefert eine einzelne Zeile als Objekt, setof als Liste: beides annehmen. Antworten mit jsonb (zuerst
// online_tritt_bei) melden einen Fehler ohne raise als { fehler: 'ONLINE_...' }: daraus wird derselbe Fehler wie aus
// einer Serverkennung (Satz, kennung, Originaltext in detail). Eine unbekannte Kennung zeigt nie den rohen Text.
function partieAus(d) {
  const p = Array.isArray(d) ? d[0] : d;
  if (p && typeof p === 'object' && typeof p.fehler === 'string') {
    const kennung = p.fehler;
    const bekannt = Object.prototype.hasOwnProperty.call(FEHLER_TEXTE, kennung);
    const e = new Error(bekannt ? FEHLER_TEXTE[kennung] : O('fehler'));
    e.status = 200; e.kennung = bekannt ? kennung : undefined; e.detail = kennung;
    throw e;
  }
  if (!p || typeof p !== 'object' || !p.id) throw new Error(O('keinePartie'));
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

// Zug an die Edge Function online-zug: nur Partie und Zug (UCI). Die Form des Zugs wird vorher geprueft (spart eine
// Anfrage); ob er erlaubt ist und wie die Partie danach steht, entscheidet der Server (er prueft auch die Partie-ID).
export async function sendeZug(id, { uci } = {}) {
  const zug = String(uci || '');
  if (!UCI_RE.test(zug)) throw new Error(FEHLER_TEXTE.ONLINE_ZUG_FORM);
  const s = await aktiveSitzung();
  return partieAus(await anfrage(ZUG_PFAD, { methode: 'POST', token: s.access_token, daten: { partie: String(id || ''), zug } }));
}

export async function gibAuf(id) { return partieAus(await rpc('online_gib_auf', { partie: id })); }
export async function bieteRemis(id) { return partieAus(await rpc('online_biete_remis', { partie: id })); }
export async function nimmRemisAn(id) { return partieAus(await rpc('online_nimm_remis_an', { partie: id })); }
export async function meldeStrittig(id) { return partieAus(await rpc('online_strittig', { partie: id })); }
export async function pruefeZeit(id) { return partieAus(await rpc('online_pruefe_zeit', { partie: id })); }
export async function meinePartien({ beendete = false } = {}) {
  const d = await rpc('online_meine', {});
  const laufend = Array.isArray(d) ? d : [];
  if (!beendete) return laufend;
  // online_meine liefert nur offene/laufende Zeilen. Fertige Partien sind unter derselben RLS lesbar.
  const s = await aktiveSitzung();
  const fertig = await anfrage('/rest/v1/partien_online?status=eq.beendet&select=*&order=aktualisiert_am.desc&limit=100', { token: s.access_token });
  return [...new Map([...laufend, ...(Array.isArray(fertig) ? fertig : [])].map(p => [p.id, p])).values()]
    .sort((a, b) => String(b.aktualisiert_am).localeCompare(String(a.aktualisiert_am)));
}

// Abfrage statt Websocket: alle 2 s eine kleine Anfrage, die nur dann eine Zeile liefert, wenn sich seit dem
// letzten bekannten Stand (aktualisiert_am) etwas geaendert hat. Eine Anfrage laeuft nie doppelt.
const ABSTAND_MAX_MS = 30000;
// Fehler beim Holen der Sitzung: keine Sitzung oder Erneuern vom Server abgelehnt (4xx) heisst abgemeldet; ein
// Netzfehler beim Erneuern (ohne Status) ist nur offline.
function istAnmeldeFehler(e) {
  return e?.message === FEHLER_TEXTE.ONLINE_NICHT_ANGEMELDET || (Number.isInteger(e?.status) && e.status >= 400 && e.status < 500);
}
export function beobachte(id, { alle = 2000, seit = null, beiAenderung, beiFehler, bisEnde = true, dokument = globalThis.document } = {}) {
  let aktiv = true;
  let timer = null;
  let stand = seit || null;
  let unterwegs = false;
  let letzterFehler = null;
  let fehlerFolge = 0;     // Fehler hintereinander: der Abstand waechst (2 s, 4 s, 8 s ... hoechstens 30 s)
  let erneuert = false;    // nach einem 401 genau einmal erneuern
  let sofort = false;      // nach erfolgreichem Erneuern gleich noch einmal fragen
  let endGrund = null;
  const versteckt = () => !!dokument?.hidden;
  const melde = (fn, wert) => { if (!aktiv) return; try { fn?.(wert); } catch (e) { try { console.error('Online-Beobachter:', e); } catch (x) { /* egal */ } } };
  const beiSichtbarkeit = () => { if (aktiv && !versteckt()) tick(); };
  function anhalten(grund) {
    if (!aktiv) return;
    aktiv = false; endGrund = grund; clearTimeout(timer); timer = null;
    try { dokument?.removeEventListener?.('visibilitychange', beiSichtbarkeit); } catch (e) { /* egal */ }
  }
  function abmelden(e) {
    const f = new Error(e?.message === FEHLER_TEXTE.ONLINE_NICHT_ANGEMELDET ? FEHLER_TEXTE.ONLINE_NICHT_ANGEMELDET : O('abgelaufen'));
    f.abgemeldet = true; f.status = e?.status; f.detail = e?.detail || e?.message || '';
    melde(beiFehler, f);
    anhalten('abgemeldet');
  }
  const abstand = () => (fehlerFolge ? Math.min(alle * 2 ** fehlerFolge, Math.max(alle, ABSTAND_MAX_MS)) : alle);
  async function tick() {
    if (!aktiv || unterwegs) return;
    clearTimeout(timer); timer = null;
    if (versteckt()) return; // pausiert; der Sichtbarkeits-Hoerer stoesst wieder an
    unterwegs = true;
    sofort = false;
    try {
      let s;
      try { s = await aktiveSitzung(); } catch (e) { if (istAnmeldeFehler(e)) { abmelden(e); return; } throw e; }
      if (!aktiv) return;
      const filter = stand ? `&aktualisiert_am=gt.${encodeURIComponent(stand)}` : '';
      const d = await anfrage(zeilenPfad(id, filter), { token: s.access_token });
      if (!aktiv) return; // stop() waehrend der Anfrage: kein Hoerer mehr
      const p = Array.isArray(d) ? d[0] : null;
      fehlerFolge = 0; erneuert = false;
      if (p && p.aktualisiert_am !== stand) {
        letzterFehler = null;
        stand = p.aktualisiert_am;
        melde(beiAenderung, p);
        if (bisEnde && p.status === 'beendet') anhalten('beendet');
      } else if (!p && !stand) {
        // gibt es nicht oder gehoert Fremden: taucht nicht von selbst auf, also einmal melden und aufhoeren
        melde(beiFehler, new Error(FEHLER_TEXTE.ONLINE_PARTIE_UNBEKANNT));
        anhalten('unbekannt');
      } else {
        letzterFehler = null;
      }
    } catch (e) {
      if (!aktiv) return;
      if (e?.status === 401) {
        // Server lehnt das Token ab, obwohl es lokal noch gilt: genau einmal erneuern, dann sofort neu fragen
        if (erneuert) { abmelden(e); return; }
        erneuert = true;
        try { await erneuereSitzung(); sofort = true; return; } catch (x) {
          if (!aktiv) return;
          if (istAnmeldeFehler(x)) { abmelden(x); return; }
          erneuert = false; // nur das Netz fehlte: beim naechsten 401 wieder erneuern
          e = x; // Netzfehler beim Erneuern: wie offline weiter
        }
      }
      fehlerFolge++;
      if (e?.message !== letzterFehler) { letzterFehler = e?.message; melde(beiFehler, e); }
    } finally {
      unterwegs = false;
      if (aktiv && !versteckt()) timer = setTimeout(tick, sofort ? 0 : abstand());
    }
  }
  try { dokument?.addEventListener?.('visibilitychange', beiSichtbarkeit); } catch (e) { /* ohne Pause weiter */ }
  tick();
  return {
    stop() { anhalten(endGrund || 'stop'); },
    laeuft: () => aktiv,
    stand: () => stand,
    grund: () => endGrund,
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
  kontoFreigeschaltet('#konto');
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
