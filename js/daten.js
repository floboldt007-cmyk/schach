// Daten-Fundament (DSGVO, Entscheidung des Besitzers vom 22.10.2026): Partien-Archiv und Nutzungsereignisse ohne
// Name und E-Mail (pseudonym: am Konto, damit Auskunft, Widerruf und Loeschung gehen),
// nur fuer angemeldete Spieler und nur mit ausdruecklicher Freigabe (Einstellung datenfreigabe, Standard aus),
// dazu Konto loeschen (Art. 17) und Datenauskunft (Art. 15/20). Nur fetch (Muster konto.js), die Sitzung kommt
// aus konto.js. Nichts hier darf die App je blockieren oder einen Fehler nach aussen geben. Server-Seite:
// supabase/daten-schema.sql (Tabellen partien_archiv, nutzung; Funktionen konto_loeschen, meine_daten).
//
//   darfTeilen()                        angemeldet, datenfreigabe === 'an' und die Zustimmung stammt von DIESEM Konto
//                                       (ZUSTIMMUNG_SCHLUESSEL { konto, datum, fassung }; meldet sich auf dem Geraet
//                                       ein anderes Konto an, ist die Freigabe fuer es aus, bis es selbst zustimmt)
//   setzeFreigabe(an, app)              Schalter: an nur angemeldet (Zustimmung mit Datum merken, Ereignis "freigabe"),
//                                       aus verwirft die Warteschlange und widerruft auf dem Server (rpc/
//                                       freigabe_widerrufen loescht alles bisher Geteilte); offline bleibt der Widerruf
//                                       in WIDERRUF_SCHLUESSEL offen und geht beim naechsten Start bzw. vor jedem neuen
//                                       Senden raus (nie neue Daten vor einem offenen Widerruf)
//   widerrufeJetzt()                    offenen Widerruf senden; Promise<boolean> (true: nichts mehr offen)
//   geraetKurz(ua, nav)                 nur Familie/OS: "iOS Safari", "Android Chrome", "Desktop Firefox" (aus konto.js)
//   archivDatensatz(d, p)               Zeile fuer partien_archiv aus partie:beendet (d) und dem gespeicherten
//                                       Partie-Datensatz (p, storage.ladePartie); null ohne Zuege oder bei einer
//                                       Partie aus eigener Stellung (ohne FEN-Spalte waeren die Zuege wertlos)
//   merkeNutzung(ereignis, daten)       Nutzungsereignis in die Warteschlange (nur mit Freigabe); true, wenn gemerkt.
//                                       Jede Zeile bekommt im Browser ihre id (uuid): ein wiederholter Versand legt
//                                       nichts doppelt an (409, der Eintrag faellt weg)
//   warteschlange()                     Inhalt der Warteschlange (localStorage WARTESCHLANGE_SCHLUESSEL, hoechstens
//                                       WARTESCHLANGE_MAX Eintraege, die aeltesten fallen weg)
//   leereWarteschlange()
//   sendeJetzt({ keepalive })           Warteschlange gebuendelt senden (POST je Tabelle, Prefer: return=minimal),
//                                       Promise<boolean>; offline still (Eintraege bleiben), 4xx ausser 401/408/429:
//                                       ein Buendel wird einzeln nachgesendet, nur die abgelehnten Zeilen fallen weg
//                                       (409 = schon da, 400 = ungueltig oder Mengenbremse DATEN_MENGE). Sonst
//                                       hoechstens alle BUENDEL_MS und beim Verlassen (visibilitychange hidden, pagehide).
//   loescheKonto(app)                   rpc/konto_loeschen, dann abmelden(), Warteschlange und Zustimmung weg, datenfreigabe aus
//   loescheKontoDialog(app)             zweistufige Rueckfrage (sheet aus bauteile.js) + loescheKonto(); Promise<boolean>
//   meineDaten()                        rpc/meine_daten + lokaler Stand + noch nicht Gesendetes -> Objekt;
//                                       dateiFuerAuskunft(obj) -> File;
//                                       speichereAuskunft(file) teilt (navigator.share) oder laedt herunter
//   fehlerEreignis(ev)                  window error / unhandledrejection: nur Typ + Meldung (<= FEHLER_MAX Zeichen,
//                                       Adressen und Dateipfade ersetzt), nie ein Stack; hoechstens FEHLER_JE_SITZUNG
//   datenGruppe({ app })                Gruppe "Daten" am Ort einstellungen:gruppen (Reihenfolge 6, direkt nach Konto);
//                                       null, solange das Konto nicht freigeschaltet ist (kontoFreigeschaltet)
//   setzeDatenFetch(fn), konfiguriere({ buendelMs })   nur fuer Tests
//
// Klassen: .daten-gruppe, .daten-zeile, .daten-text, .daten-status[data-fehler], .daten-links, Schalter
// .schalter[data-schalter="datenfreigabe"], Knoepfe [data-daten="auskunft"|"loeschen"] (Stil css/daten.css).
// Geladen wird die Datei als Paket (js/erweiterungen.js PAKETE 'daten'), damit ein Fehler hier nie den Start stoppt.
import { SUPABASE_URL, SUPABASE_KEY } from './konto-config.js';
import { sitzung, aktiveSitzung, userId, abmelden, lokalerStand, kontoFreigeschaltet, geraetKurz } from './konto.js';
import { tagSchluessel } from './tag.js';
import { ladeEinstellungen, speichereEinstellungen, ladePartie } from './storage.js';
import { hoere } from './ereignisse.js';
import { anbieten } from './orte.js';
import { schalter, sheet } from './ui/bauteile.js';
import { t, sprache } from './sprache.js';
import './sprachen/allgemein.js';
import './sprachen/einstellungen.js';

export const WARTESCHLANGE_SCHLUESSEL = 'schach-arena:daten:warteschlange';
export const ZUSTIMMUNG_SCHLUESSEL = 'schach-arena:daten:zustimmung';
export const WIDERRUF_SCHLUESSEL = 'schach-arena:daten:widerruf';
export { geraetKurz };
export const FREIGABE_FASSUNG = 1;   // Fassung des Erklaertexts, dem zugestimmt wurde (bei inhaltlicher Aenderung hochzaehlen)
export const FEHLER_JE_SITZUNG = 10;
export const WARTESCHLANGE_MAX = 100;
export const BUENDEL_MS = 20000;
export const JE_ANFRAGE_MAX = 25;
export const FEHLER_MAX = 200;
export const ZUEGE_MAX = 20000;
export const KLASSEN_MAX = 4000;
export const AUSKUNFT_FORMAT = 'crownmate-datenauskunft';
// wie storage.js: Stellung, Zugrecht, Rochaderechte, en passant
const GRUNDSTELLUNG = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -';
const WURZEL = new URL('../', import.meta.url);

let fetchFn = (...a) => fetch(...a);
let buendelMs = BUENDEL_MS;
let timer = null;
let laeuft = null;
let appVersion = null;
let fehlerZahl = 0;

export function setzeDatenFetch(fn) { fetchFn = fn || ((...a) => fetch(...a)); }
export function konfiguriere({ buendelMs: ms } = {}) { if (Number.isFinite(ms) && ms >= 0) buendelMs = ms; }

function lager() { return globalThis.localStorage; }
const text = (w, max) => (w == null || w === '' ? null : String(w).slice(0, max));
const ganz = (w) => (w != null && Number.isFinite(Number(w)) ? Math.max(0, Math.round(Number(w))) : null);
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pfad = (rel) => new URL(rel, WURZEL).href;
function D(k, w) { return t('einstellungen.' + k, w); }

function zustimmungKonto() {
  try { const z = JSON.parse(lager().getItem(ZUSTIMMUNG_SCHLUESSEL)); return z && typeof z.konto === 'string' ? z.konto : null; } catch (e) { return null; }
}
export function darfTeilen() {
  try {
    const uid = userId(sitzung());
    return !!uid && ladeEinstellungen().datenfreigabe === 'an' && zustimmungKonto() === uid;
  } catch (e) { return false; }
}

function einstellen(teil, app) {
  try {
    if (app && typeof app.setzeEinstellungen === 'function') app.setzeEinstellungen(teil);
    else speichereEinstellungen(teil);
  } catch (e) { /* egal */ }
}
// ---------- Widerruf: alles bisher Geteilte auf dem Server loeschen (Art. 7 Abs. 3, Art. 17 Abs. 1 lit. b) ----------
function offenerWiderruf() {
  try { const w = JSON.parse(lager().getItem(WIDERRUF_SCHLUESSEL)); return w && typeof w.konto === 'string' ? w : null; } catch (e) { return null; }
}
let widerrufLaeuft = null;
export function widerrufeJetzt() {
  if (widerrufLaeuft) return widerrufLaeuft;
  widerrufLaeuft = (async () => {
    const w = offenerWiderruf();
    if (!w) return true;
    let s;
    try { s = await aktiveSitzung(); } catch (e) { return false; }
    if (userId(s) !== w.konto) return false;   // anderes Konto angemeldet: warten, bis das richtige zurueck ist
    try { await rpc('freigabe_widerrufen', s.access_token); } catch (e) { return false; }
    try { lager().removeItem(WIDERRUF_SCHLUESSEL); } catch (e) { /* egal */ }
    return true;
  })().catch(() => false).finally(() => { widerrufLaeuft = null; });
  return widerrufLaeuft;
}

export function setzeFreigabe(an, app = null) {
  let uid = null;
  try { uid = userId(sitzung()); } catch (e) { uid = null; }
  if (an && uid) {
    try { lager().setItem(ZUSTIMMUNG_SCHLUESSEL, JSON.stringify({ konto: uid, datum: new Date().toISOString(), fassung: FREIGABE_FASSUNG })); } catch (e) { return false; }
    einstellen({ datenfreigabe: 'an' }, app);
    merkeNutzung('freigabe', { an: true, fassung: FREIGABE_FASSUNG });
  } else {
    const konto = zustimmungKonto();
    try { lager().removeItem(ZUSTIMMUNG_SCHLUESSEL); } catch (e) { /* egal */ }
    einstellen({ datenfreigabe: 'aus' }, app);
    leereWarteschlange();
    // Wer je zugestimmt hat, widerruft auch auf dem Server; offline bleibt es offen und wird nachgeholt
    if (konto) {
      try { lager().setItem(WIDERRUF_SCHLUESSEL, JSON.stringify({ konto, datum: new Date().toISOString() })); } catch (e) { /* egal */ }
      widerrufeJetzt().catch(() => {});
    }
  }
  return darfTeilen();
}

// ---------- Warteschlange (localStorage) ----------
function liesWarteschlange() {
  try {
    const l = JSON.parse(lager().getItem(WARTESCHLANGE_SCHLUESSEL) || '[]');
    return Array.isArray(l) ? l.filter((e) => e && typeof e === 'object' && e.daten && typeof e.daten === 'object') : [];
  } catch (e) { return []; }
}
function schreibWarteschlange(liste) {
  try {
    if (!liste.length) lager().removeItem(WARTESCHLANGE_SCHLUESSEL);
    else lager().setItem(WARTESCHLANGE_SCHLUESSEL, JSON.stringify(liste.slice(-WARTESCHLANGE_MAX)));
    return true;
  } catch (e) { return false; }
}
export function warteschlange() { return liesWarteschlange(); }
export function leereWarteschlange() { clearTimeout(timer); timer = null; schreibWarteschlange([]); }

function planeSenden() {
  if (timer) return;
  timer = setTimeout(() => { timer = null; sendeJetzt().catch(() => {}); }, buendelMs);
  if (timer && typeof timer.unref === 'function') timer.unref();   // Node-Tests: haelt den Prozess nicht offen
}
// id je Zeile im Browser: ein wiederholter Versand (Antwort unterwegs verloren) legt nichts doppelt an
function neueId() {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  const b = new Uint8Array(16);
  if (c && typeof c.getRandomValues === 'function') c.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
function merke(art, daten) {
  if (!darfTeilen()) return false;
  const uid = userId(sitzung());
  if (!uid) return false;
  const liste = liesWarteschlange();
  liste.push({ art, daten: { id: neueId(), user_id: uid, ...daten } });
  if (!schreibWarteschlange(liste)) return false;
  planeSenden();
  return true;
}

export function merkeNutzung(ereignis, daten = {}) {
  const e = text(ereignis, 64);
  if (!e) return false;
  const d = daten && typeof daten === 'object' && !Array.isArray(daten) ? daten : {};
  return merke('nutzung', { ereignis: e, daten: d, geraet: geraetKurz(), app_version: appVersion });
}

// ---------- Partien-Archiv ----------
// an einer Leerstelle abschneiden, damit nie ein halber Zug entsteht (die Tabelle prueft das Format)
function kuerzeListe(s, max) {
  if (s.length <= max) return s;
  const k = s.slice(0, max);
  const i = k.lastIndexOf(' ');
  return i > 0 ? k.slice(0, i) : '';
}

export function archivDatensatz(d = {}, p = null) {
  const zuege = Array.isArray(p?.zuege) ? p.zuege.filter((z) => typeof z === 'string' && z) : [];
  if (!zuege.length) return null;
  const fen = String(p?.startFen || '').trim();
  if (fen && fen.split(/\s+/).slice(0, 4).join(' ') !== GRUNDSTELLUNG) return null;
  const farbe = (d?.farbe || p?.spielerFarbe) === 'b' ? 'b' : 'w';
  const live = Array.isArray(d?.liveKlassen) && d.liveKlassen.length ? d.liveKlassen
    : (Array.isArray(p?.liveKlassen) ? p.liveKlassen : []);
  const klassen = [];
  for (let i = 0; i < zuege.length; i++) {
    const amZug = i % 2 === 0 ? 'w' : 'b';   // Grundstellung: Weiss zieht zuerst
    if (amZug === farbe) klassen.push(typeof live[i] === 'string' && live[i] ? live[i] : '-');
  }
  return {
    bot_id: text(d?.botId ?? p?.botId, 64),
    farbe,
    ergebnis: text(d?.ergebnis ?? p?.ergebnis, 32),
    grund: text(d?.grund ?? p?.grund, 64),
    modus: text(d?.modus ?? p?.modus ?? 'normal', 32),
    zuege: kuerzeListe(zuege.join(' '), ZUEGE_MAX),
    klassen: kuerzeListe(klassen.join(' '), KLASSEN_MAX),
    genauigkeit: Number.isFinite(p?.genauigkeit) ? Math.max(0, Math.min(100, Math.round(p.genauigkeit * 10) / 10)) : null,
    hinweise: ganz(d?.hinweise ?? p?.hinweise),
    zuruecknahmen: ganz(d?.zuruecknahmen ?? p?.zuruecknahmen),
    dauer_s: Number.isFinite(d?.dauerMs) ? Math.max(0, Math.round(d.dauerMs / 1000)) : null,
    app_version: appVersion,
    gespielt_am: text(p?.datum || d?.datum, 40) || new Date().toISOString(),
  };
}

// Hoerer duerfen hoechstens 2 ms brauchen: die Partienliste lesen (bis 300 Partien) passiert danach
export function beiBeendet(d) {
  if (!darfTeilen()) return;
  setTimeout(() => {
    try {
      let p = null;
      try { p = d && d.partieId ? ladePartie(d.partieId) : null; } catch (e) { p = null; }
      const satz = archivDatensatz(d || {}, p);
      if (satz) merke('partie', satz);
      merkeNutzung('partie_ende', {
        bot: text(d?.botId, 64), modus: text(d?.modus, 32), ergebnis: text(d?.ergebnis, 32), grund: text(d?.grund, 64),
        dauer_s: satz ? satz.dauer_s : null, eigene_zuege: ganz(d?.eigeneZuege), archiviert: !!satz,
      });
    } catch (e) { /* nie nach aussen */ }
  }, 0);
}

// ---------- Versand ----------
// keepalive (beim Verlassen) erlaubt Browser-seitig hoechstens 64 KiB je Anfrage; groessere gehen normal raus
const KEEPALIVE_MAX = 60000;
async function post(pfadRest, daten, token, keepalive) {
  const body = JSON.stringify(daten);
  let r;
  try {
    r = await fetchFn(SUPABASE_URL + pfadRest, {
      method: 'POST', keepalive: !!keepalive && body.length <= KEEPALIVE_MAX,
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body,
    });
  } catch (e) { return 'offline'; }
  if (r.ok) return 'ok';
  if (r.status >= 400 && r.status < 500 && ![401, 408, 429].includes(r.status)) return 'verwerfen';
  return 'spaeter';
}
// Ein abgelehntes Buendel (409: eine Zeile ist schon da, 400: eine Zeile ist ungueltig oder ueber der Mengenbremse)
// wird einzeln nachgesendet: Nur die Zeilen, die der Server selbst ablehnt, fallen weg, neue gehen nicht verloren.
async function sendeTeil(pfadRest, teil, token, keepalive) {
  const r = await post(pfadRest, teil.map((e) => e.daten), token, keepalive);
  if (r !== 'verwerfen' || teil.length === 1) return { erledigt: r === 'ok' || r === 'verwerfen' ? teil : [], alles: r !== 'offline' && r !== 'spaeter' };
  const erledigt = [];
  let alles = true;
  for (const e of teil) {
    const einzeln = await post(pfadRest, [e.daten], token, keepalive);
    if (einzeln === 'ok' || einzeln === 'verwerfen') erledigt.push(e);
    else { alles = false; break; }
  }
  return { erledigt, alles };
}

export function sendeJetzt({ keepalive = false } = {}) {
  if (laeuft) return laeuft;
  laeuft = (async () => {
    clearTimeout(timer);
    timer = null;
    if (!darfTeilen()) return false;
    let liste = liesWarteschlange();
    if (!liste.length) return false;
    // nie neue Daten, solange ein frueherer Widerruf noch nicht beim Server ist (er wuerde sie sonst mitloeschen)
    if (offenerWiderruf() && !(await widerrufeJetzt())) return false;
    let s;
    try { s = await aktiveSitzung(); } catch (e) { return false; }
    const uid = userId(s);
    if (!uid) return false;
    // Eintraege eines anderen (frueheren) Kontos werden nie unter diesem Konto gesendet
    liste = liste.filter((e) => e.daten.user_id === uid);
    let alles = true;
    for (const art of ['partie', 'nutzung']) {
      const teil = liste.filter((e) => e.art === art).slice(0, JE_ANFRAGE_MAX);
      if (!teil.length) continue;
      const r = await sendeTeil(art === 'partie' ? '/rest/v1/partien_archiv' : '/rest/v1/nutzung', teil, s.access_token, keepalive);
      liste = liste.filter((e) => !r.erledigt.includes(e));
      if (!r.alles) alles = false;
    }
    schreibWarteschlange(liste);
    if (liste.length && alles) planeSenden();   // mehr als JE_ANFRAGE_MAX je Art: naechste Runde
    return alles;
  })().catch(() => false).finally(() => { laeuft = null; });
  return laeuft;
}

async function rpc(name, token) {
  let r;
  try {
    r = await fetchFn(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
      method: 'POST', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: '{}',
    });
  } catch (e) { throw new Error(D('daten.verbindung')); }
  let d = null;
  if (r.status !== 204) { try { d = await r.json(); } catch (e) { /* leere Antwort */ } }
  if (!r.ok) {
    // nie rohe (englische) Servertexte an den Nutzer; das Original steht in detail
    const f = new Error(rpcFehlerText(r.status, d?.code));
    f.status = r.status; f.code = d?.code; f.detail = d?.message || d?.msg || d?.hint || '';
    throw f;
  }
  return d;
}
function rpcFehlerText(status, code) {
  if (status === 401 || code === 'PGRST301' || code === 'PGRST303') return D('daten.fehler.abgelaufen');
  if (status === 403 || code === '42501') return D('daten.fehler.anmelden');
  if (status === 404) return D('daten.fehler.fehlt');
  if (status === 429) return D('daten.fehler.viele');
  if (status >= 500) return D('daten.fehler.server', { status });
  return D('daten.fehler.sonst', { status });
}

// ---------- Konto loeschen (Art. 17) und Auskunft (Art. 15/20) ----------
export async function loescheKonto(app = null) {
  const s = await aktiveSitzung();
  await rpc('konto_loeschen', s.access_token);
  // abmelden() entfernt die Sitzung sofort und wartet danach bis zu 5 s auf den Server: erst lokal aufraeumen, dann warten
  const abgemeldet = abmelden();
  leereWarteschlange();
  try { lager().removeItem(ZUSTIMMUNG_SCHLUESSEL); lager().removeItem(WIDERRUF_SCHLUESSEL); } catch (e) { /* egal */ }
  einstellen({ datenfreigabe: 'aus' }, app);
  await abgemeldet;
  return true;
}

export async function meineDaten() {
  const s = await aktiveSitzung();
  const server = await rpc('meine_daten', s.access_token);
  let zustimmung = null;
  try { zustimmung = JSON.parse(lager().getItem(ZUSTIMMUNG_SCHLUESSEL)); } catch (e) { zustimmung = null; }
  return {
    format: AUSKUNFT_FORMAT, version: 1, erstellt: new Date().toISOString(), konto: s.email || null,
    hinweis: D('daten.auskunftHinweis'),
    server, geraet: lokalerStand(), noch_nicht_gesendet: liesWarteschlange().map((e) => ({ art: e.art, ...e.daten })), zustimmung,
    widerruf_offen: offenerWiderruf(),
  };
}

export function dateiFuerAuskunft(daten) {
  const zeit = new Date(daten?.erstellt || Date.now());
  const tag = tagSchluessel(Number.isNaN(zeit.getTime()) ? new Date() : zeit);   // Tage immer aus tag.js (AGENTS.md)
  return new File([JSON.stringify(daten, null, 2)], `crownmate-meine-daten-${tag}.json`, { type: 'application/json' });
}

export async function speichereAuskunft(datei) {
  const nav = globalThis.navigator;
  if (nav?.share && nav.canShare && nav.canShare({ files: [datei] })) {
    await nav.share({ files: [datei], title: D('daten.teilenTitel') });
    return 'geteilt';
  }
  const url = URL.createObjectURL(datei);
  const a = document.createElement('a');
  a.href = url;
  a.download = datei.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'download';
}

// ---------- Fehler: nur Typ und Meldung, keine Adressen, kein Stack ----------
function ohneAdressen(t) {
  return String(t || '').replace(/\s+/g, ' ')
    .replace(/[a-z][a-z0-9+.-]*:\/\/\S+/gi, '[adresse]')
    .replace(/(?:^|[\s(])\/?[\w.-]+(?:\/[\w.-]+)+\.(?:m?js|html|css|wasm)(?::\d+)*\)?/g, ' [datei]')
    .trim();
}
export function fehlerKurz(typ, meldung) {
  return { typ: String(typ || 'Error').slice(0, 40), meldung: ohneAdressen(meldung).slice(0, FEHLER_MAX) };
}
export function fehlerEreignis(ev) {
  try {
    if (!darfTeilen() || fehlerZahl >= FEHLER_JE_SITZUNG) return;
    let typ = 'Error';
    let meldung = '';
    if (ev && 'reason' in ev) {
      const r = ev.reason;
      typ = (r && r.name) || 'Promise';
      meldung = r && r.message != null ? r.message : String(r);
    } else if (ev) {
      typ = (ev.error && ev.error.name) || 'Error';
      meldung = ev.message || (ev.error && ev.error.message) || '';
    }
    if (merkeNutzung('fehler', fehlerKurz(typ, meldung))) fehlerZahl++;
  } catch (e) { /* nie nach aussen */ }
}

// ---------- Oberflaeche: Gruppe "Daten" in den Einstellungen ----------
export async function loescheKontoDialog(app) {
  // Ein laufendes Stripe-Abo endet mit dem Konto nicht: dann sagt der Dialog, wo man es vorher kuendigt
  let aboHinweis = '';
  try { aboHinweis = (await import('./abo.js')).aboHinweisZumLoeschen() || ''; } catch (e) { /* ohne Abo-Modul */ }
  const weiter = await sheet({
    titel: D('daten.loeschen1Titel'),
    text: D('daten.loeschen1Text') + (aboHinweis ? ' ' + aboHinweis : ''),
    knoepfe: [{ text: t('allgemein.abbrechen'), wert: false }, { text: D('daten.loeschenWeiter'), wert: true, art: 'gefahr' }], abbrechen: false,
  });
  if (!weiter) return false;
  const ja = await sheet({
    titel: D('daten.loeschen2Titel'),
    text: D('daten.loeschen2Text'),
    knoepfe: [{ text: t('allgemein.abbrechen'), wert: false }, { text: D('daten.endgueltig'), wert: true, art: 'gefahr' }], abbrechen: false,
  });
  if (!ja) return false;
  await loescheKonto(app);
  try { app?.meldung?.(D('daten.geloeschtMeldung')); } catch (e) { /* egal */ }
  return true;
}

export function datenGruppe({ app } = {}) {
  if (typeof document === 'undefined' || !kontoFreigeschaltet()) return null;
  const el = document.createElement('section');
  el.className = 'es-gruppe flaeche daten-gruppe';
  el.setAttribute('aria-labelledby', 'daten-titel');
  let angemeldet = null;
  let uhr = null;
  let sch = null;
  const melden = (t, fehler = false) => {
    const x = el.querySelector('.daten-status');
    if (x) { x.textContent = t; x.dataset.fehler = fehler ? 'ja' : 'nein'; }
  };
  function render() {
    angemeldet = !!sitzung();
    const an = darfTeilen();
    el.innerHTML = `<h3 class="es-titel" id="daten-titel">${D('daten.titel')}</h3>
      <div class="es-zeile daten-zeile">
        <div class="es-text"><b id="daten-l">${D('daten.teilen')}</b><span id="daten-t">${angemeldet ? D('daten.teilenText') : D('daten.erstAnmelden')}</span></div>
        <span class="daten-schalter-platz"></span>
      </div>
      <div class="daten-text">
        <p><b>${D('daten.wasKopf')}</b> ${D('daten.was')}</p>
        <p><b>${D('daten.wozuKopf')}</b> ${D('daten.wozu')}</p>
        <p><b>${D('daten.woKopf')}</b> ${D('daten.wo')}</p>
        <p><b>${D('daten.jederzeitKopf')}</b> ${D('daten.jederzeit')}</p>
        <p><b>${D('daten.unter16Kopf')}</b> ${D('daten.unter16')}</p>
      </div>
      ${angemeldet ? `<div class="es-knoepfe"><button class="knopf" type="button" data-daten="auskunft">${D('daten.herunterladen')}</button><button class="knopf es-rot-rand" type="button" data-daten="loeschen">${D('daten.kontoLoeschen')}</button></div>` : ''}
      <p class="daten-status" aria-live="polite"></p>
      <p class="es-hilfe daten-links"><a href="${esc(pfad(sprache() === 'en' ? 'datenschutz-en.html' : 'datenschutz.html'))}" target="_blank" rel="noopener">${D('info.datenschutz')}</a> · <a href="${esc(pfad(sprache() === 'en' ? 'impressum-en.html' : 'impressum.html'))}" target="_blank" rel="noopener">${D('info.impressum')}</a></p>`;
    sch = schalter({
      name: 'datenfreigabe', an,
      beiWechsel: (neu) => {
        const jetzt = setzeFreigabe(neu, app);
        sch.setze(jetzt);
        if (jetzt) melden(D('daten.danke'));
        else melden(neu ? D('daten.erstAnmelden') : D('daten.aus'), neu);
      },
    });
    sch.el.setAttribute('aria-labelledby', 'daten-l');
    sch.el.setAttribute('aria-describedby', 'daten-t');
    if (!angemeldet) sch.el.disabled = true;
    el.querySelector('.daten-schalter-platz').replaceWith(sch.el);
  }
  el.addEventListener('click', async (e) => {
    const zeileText = e.target.closest('.daten-zeile .es-text');
    if (zeileText && sch && !sch.el.disabled) { sch.el.click(); return; }
    const knopf = e.target.closest('[data-daten]');
    const a = knopf?.dataset.daten;
    if (!a) return;
    try {
      knopf.disabled = true;
      if (a === 'auskunft') {
        melden(D('daten.holen'));
        const d = await meineDaten();
        await speichereAuskunft(dateiFuerAuskunft(d));
        melden(D('daten.dateiErstellt'));
      }
      if (a === 'loeschen' && await loescheKontoDialog(app)) { render(); melden(D('daten.geloescht')); }
    } catch (f) {
      if (f && f.name !== 'AbortError') melden(f.message || D('nichtGeklappt'), true);
    } finally {
      if (knopf.isConnected) knopf.disabled = false;
    }
  });
  render();
  // An- und Abmelden passiert in der Konto-Gruppe daneben: dann neu zeichnen
  uhr = setInterval(() => { if (!!sitzung() !== angemeldet) render(); }, 1000);
  return { el, verlasse() { clearInterval(uhr); } };
}

// ---------- App-Version aus dem Service Worker (fuer app_version; fehlt sie, bleibt das Feld leer) ----------
function holeAppVersion() {
  const sw = globalThis.navigator?.serviceWorker;
  if (!sw || typeof sw.addEventListener !== 'function') return;
  sw.addEventListener('message', (e) => {
    const d = e && e.data;
    if (d && d.typ === 'version' && d.version != null) appVersion = 'sw' + String(d.version).slice(0, 12);
  });
  try { sw.controller?.postMessage({ typ: 'version' }); } catch (e) { /* egal */ }
}

// Registrierung ist defensiv (wie konto.js): die Datenfreigabe darf die Offline-App nie am Start hindern.
try {
  hoere('app:screen', (d) => { merkeNutzung('screen', { name: text(d?.name, 40) }); });
  hoere('partie:gestartet', (d) => {
    merkeNutzung('partie_start', { bot: text(d?.botId, 64), modus: text(d?.modus, 32), farbe: d?.farbe === 'b' ? 'b' : 'w', fortgesetzt: !!d?.fortgesetzt });
  });
  hoere('partie:beendet', beiBeendet);
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('error', fehlerEreignis);
    window.addEventListener('unhandledrejection', fehlerEreignis);
    window.addEventListener('pagehide', () => { sendeJetzt({ keepalive: true }).catch(() => {}); });
  }
  if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') sendeJetzt({ keepalive: true }).catch(() => {});
    });
  }
  anbieten('einstellungen:gruppen', datenGruppe, { reihenfolge: 6, paket: 'daten' });
  holeAppVersion();
  if (offenerWiderruf()) widerrufeJetzt().catch(() => {});
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('online', () => { if (offenerWiderruf()) widerrufeJetzt().catch(() => {}); });
  }
  if (darfTeilen() && liesWarteschlange().length) planeSenden();
} catch (e) { /* App laeuft ohne Datenfreigabe weiter */ }
