// Daten-Fundament (DSGVO, Entscheidung des Besitzers vom 22.10.2026): Partien-Archiv und Nutzungsereignisse ohne
// persoenliche Angaben (pseudonym: am Konto, damit Auskunft und Loeschung gehen),
// nur fuer angemeldete Spieler und nur mit ausdruecklicher Freigabe (Einstellung datenfreigabe, Standard aus),
// dazu Konto loeschen (Art. 17) und Datenauskunft (Art. 15/20). Nur fetch (Muster konto.js), die Sitzung kommt
// aus konto.js. Nichts hier darf die App je blockieren oder einen Fehler nach aussen geben. Server-Seite:
// supabase/daten-schema.sql (Tabellen partien_archiv, nutzung; Funktionen konto_loeschen, meine_daten).
//
//   darfTeilen()                        angemeldet, datenfreigabe === 'an' und die Zustimmung stammt von DIESEM Konto
//                                       (ZUSTIMMUNG_SCHLUESSEL { konto, datum, fassung }; meldet sich auf dem Geraet
//                                       ein anderes Konto an, ist die Freigabe fuer es aus, bis es selbst zustimmt)
//   setzeFreigabe(an, app)              Schalter: an nur angemeldet (Zustimmung mit Datum merken, Ereignis "freigabe"),
//                                       aus verwirft die Warteschlange; Einstellung ueber app.setzeEinstellungen
//   geraetKurz(ua, nav)                 nur Familie/OS: "iOS Safari", "Android Chrome", "Desktop Firefox"
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
//                                       Promise<boolean>; offline still (Eintraege bleiben), 4xx ausser 401/408/429
//                                       verwirft die Eintraege (sie wuerden nie angenommen). Sonst hoechstens alle
//                                       BUENDEL_MS und beim Verlassen (visibilitychange hidden, pagehide).
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
import { sitzung, aktiveSitzung, userId, abmelden, lokalerStand, kontoFreigeschaltet } from './konto.js';
import { ladeEinstellungen, speichereEinstellungen, ladePartie } from './storage.js';
import { hoere } from './ereignisse.js';
import { anbieten } from './orte.js';
import { schalter, sheet } from './ui/bauteile.js';

export const WARTESCHLANGE_SCHLUESSEL = 'schach-arena:daten:warteschlange';
export const ZUSTIMMUNG_SCHLUESSEL = 'schach-arena:daten:zustimmung';
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
export function setzeFreigabe(an, app = null) {
  let uid = null;
  try { uid = userId(sitzung()); } catch (e) { uid = null; }
  if (an && uid) {
    try { lager().setItem(ZUSTIMMUNG_SCHLUESSEL, JSON.stringify({ konto: uid, datum: new Date().toISOString(), fassung: FREIGABE_FASSUNG })); } catch (e) { return false; }
    einstellen({ datenfreigabe: 'an' }, app);
    merkeNutzung('freigabe', { an: true, fassung: FREIGABE_FASSUNG });
  } else {
    try { lager().removeItem(ZUSTIMMUNG_SCHLUESSEL); } catch (e) { /* egal */ }
    einstellen({ datenfreigabe: 'aus' }, app);
    leereWarteschlange();
  }
  return darfTeilen();
}

// ---------- Geraet: nur Familie und System, nie der User-Agent-String ----------
export function geraetKurz(ua = globalThis.navigator?.userAgent, nav = globalThis.navigator) {
  const s = String(ua || '');
  if (!s) return 'Unbekannt';
  let os = 'Desktop';
  if (/iPhone|iPod/.test(s)) os = 'iOS';
  else if (/iPad/.test(s) || (/Macintosh/.test(s) && Number(nav?.maxTouchPoints) > 1)) os = 'iPadOS';
  else if (/Android/.test(s)) os = 'Android';
  let browser = 'Browser';
  if (/Edg(?:e|A|iOS)?\//.test(s)) browser = 'Edge';
  else if (/OPR\/|Opera/.test(s)) browser = 'Opera';
  else if (/SamsungBrowser/.test(s)) browser = 'Samsung';
  else if (/Firefox\/|FxiOS/.test(s)) browser = 'Firefox';
  else if (/CriOS|Chrome\/|Chromium\//.test(s)) browser = 'Chrome';
  else if (/Safari\//.test(s)) browser = 'Safari';
  return `${os} ${browser}`.slice(0, 120);
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

export function sendeJetzt({ keepalive = false } = {}) {
  if (laeuft) return laeuft;
  laeuft = (async () => {
    clearTimeout(timer);
    timer = null;
    if (!darfTeilen()) return false;
    let liste = liesWarteschlange();
    if (!liste.length) return false;
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
      const r = await post(art === 'partie' ? '/rest/v1/partien_archiv' : '/rest/v1/nutzung', teil.map((e) => e.daten), s.access_token, keepalive);
      if (r === 'ok' || r === 'verwerfen') liste = liste.filter((e) => !teil.includes(e));
      else alles = false;
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
  } catch (e) { throw new Error('Keine Verbindung. Bitte später noch einmal versuchen.'); }
  let d = null;
  if (r.status !== 204) { try { d = await r.json(); } catch (e) { /* leere Antwort */ } }
  if (!r.ok) {
    const f = new Error(d?.message || d?.msg || d?.hint || `Serverfehler (${r.status})`);
    f.status = r.status;
    throw f;
  }
  return d;
}

// ---------- Konto loeschen (Art. 17) und Auskunft (Art. 15/20) ----------
export async function loescheKonto(app = null) {
  const s = await aktiveSitzung();
  await rpc('konto_loeschen', s.access_token);
  await abmelden();
  leereWarteschlange();
  try { lager().removeItem(ZUSTIMMUNG_SCHLUESSEL); } catch (e) { /* egal */ }
  einstellen({ datenfreigabe: 'aus' }, app);
  return true;
}

export async function meineDaten() {
  const s = await aktiveSitzung();
  const server = await rpc('meine_daten', s.access_token);
  let zustimmung = null;
  try { zustimmung = JSON.parse(lager().getItem(ZUSTIMMUNG_SCHLUESSEL)); } catch (e) { zustimmung = null; }
  return {
    format: AUSKUNFT_FORMAT, version: 1, erstellt: new Date().toISOString(), konto: s.email || null,
    hinweis: 'server: alles, was der Server von Crownmate über dein Konto gespeichert hat. geraet: der Spielstand in diesem Browser. '
      + 'noch_nicht_gesendet: geteilte Daten, die noch auf diesem Gerät warten. zustimmung: wann du das Teilen eingeschaltet hast.',
    server, geraet: lokalerStand(), noch_nicht_gesendet: liesWarteschlange().map((e) => ({ art: e.art, ...e.daten })), zustimmung,
  };
}

export function dateiFuerAuskunft(daten) {
  const tag = String(daten?.erstellt || new Date().toISOString()).slice(0, 10);
  return new File([JSON.stringify(daten, null, 2)], `crownmate-meine-daten-${tag}.json`, { type: 'application/json' });
}

export async function speichereAuskunft(datei) {
  const nav = globalThis.navigator;
  if (nav?.share && nav.canShare && nav.canShare({ files: [datei] })) {
    await nav.share({ files: [datei], title: 'Crownmate: meine Daten' });
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
  const weiter = await sheet({
    titel: 'Konto löschen?',
    text: 'Gelöscht werden auf dem Server: dein Konto mit der E-Mail-Adresse (und der Verknüpfung mit Google), der Benutzername, der Cloud-Spielstand und alle geteilten Partien und Nutzungsdaten. Der Spielstand auf diesem Gerät bleibt.',
    knoepfe: [{ text: 'Abbrechen', wert: false }, { text: 'Weiter', wert: true, art: 'gefahr' }], abbrechen: false,
  });
  if (!weiter) return false;
  const ja = await sheet({
    titel: 'Wirklich endgültig löschen?',
    text: 'Das lässt sich nicht rückgängig machen. Du kannst dich später mit derselben E-Mail-Adresse neu anmelden, dann aber mit leerem Cloud-Spielstand.',
    knoepfe: [{ text: 'Abbrechen', wert: false }, { text: 'Endgültig löschen', wert: true, art: 'gefahr' }], abbrechen: false,
  });
  if (!ja) return false;
  await loescheKonto(app);
  try { app?.meldung?.('Konto gelöscht. Dein Spielstand auf diesem Gerät bleibt erhalten.'); } catch (e) { /* egal */ }
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
    el.innerHTML = `<h3 class="es-titel" id="daten-titel">Daten</h3>
      <div class="es-zeile daten-zeile">
        <div class="es-text"><b id="daten-l">Partien und Nutzung teilen</b><span id="daten-t">${angemeldet ? 'Freiwillig, Standard aus, jederzeit abschaltbar.' : 'Zum Teilen erst anmelden.'}</span></div>
        <span class="daten-schalter-platz"></span>
      </div>
      <div class="daten-text">
        <p><b>Was:</b> deine fertigen Partien (Züge, Bewertung deiner Züge, Ergebnis, Bot) und Nutzungsdaten ohne persönliche Angaben (welche Bereiche du öffnest, Start und Ende von Partien, Fehler der App).</p>
        <p><b>Wozu:</b> die Bots an echten Partien eichen, den Coach verbessern, persönliche Trainingspläne.</p>
        <p><b>Wo und wer:</b> auf dem Server des Betreibers in Frankfurt, nur für den Betreiber. Nie an Dritte, keine Werbung, kein Verkauf.</p>
        <p><b>Jederzeit:</b> Ausschalten stoppt das Teilen sofort, noch nicht Gesendetes wird verworfen.</p>
        <p><b>Unter 16?</b> Dann entscheiden deine Eltern, ob du das Teilen einschaltest.</p>
      </div>
      ${angemeldet ? `<div class="es-knoepfe"><button class="knopf" type="button" data-daten="auskunft">Meine Daten herunterladen</button><button class="knopf es-rot-rand" type="button" data-daten="loeschen">Konto löschen</button></div>` : ''}
      <p class="daten-status" aria-live="polite"></p>
      <p class="es-hilfe daten-links"><a href="${esc(pfad('datenschutz.html'))}" target="_blank" rel="noopener">Datenschutzerklärung</a> · <a href="${esc(pfad('impressum.html'))}" target="_blank" rel="noopener">Impressum</a></p>`;
    sch = schalter({
      name: 'datenfreigabe', an,
      beiWechsel: (neu) => {
        const jetzt = setzeFreigabe(neu, app);
        sch.setze(jetzt);
        if (jetzt) melden('Danke! Fertige Partien und Nutzungsdaten werden ab jetzt geteilt.');
        else melden(neu ? 'Zum Teilen erst anmelden.' : 'Teilen ist aus. Es wird nichts mehr gesendet.', neu);
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
        melden('Deine Daten werden vom Server geholt …');
        const d = await meineDaten();
        await speichereAuskunft(dateiFuerAuskunft(d));
        melden('Datei mit deinen Daten erstellt.');
      }
      if (a === 'loeschen' && await loescheKontoDialog(app)) { render(); melden('Konto gelöscht.'); }
    } catch (f) {
      if (f && f.name !== 'AbortError') melden(f.message || 'Das hat nicht geklappt.', true);
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
  if (darfTeilen() && liesWarteschlange().length) planeSenden();
} catch (e) { /* App laeuft ohne Datenfreigabe weiter */ }
