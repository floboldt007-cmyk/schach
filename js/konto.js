// Freiwilliges Konto: E-Mail-OTP, Anmeldung mit Google und Cloud-Sicherung ohne Supabase-Bibliothek.
// Daten-Fundament (DSGVO): aktiveSitzung() und userId() sind fuer js/daten.js exportiert; Konto loeschen und
// Datenauskunft wohnen dort (Gruppe "Daten" direkt unter dieser Gruppe).
// Google (Supabase OAuth, impliziter Ablauf): googleAnmeldeUrl(basis) -> Adresse von /auth/v1/authorize,
// meldeMitGoogleAn(ort) leitet dorthin. Zurueck kommt der Browser mit #konto#access_token=...; das liest
// uebernimmLinkSitzung() wie den Anmelde-Link (auch ohne das vorangestellte #konto).
// Abgleich-Riegel (30.10.2026): Automatisch hochgeladen wird erst, wenn auf diesem Geraet fuer genau diese Nutzer-ID
// ein Abgleich abgeschlossen ist (ABGEGLICHEN_SCHLUESSEL, gilt fuer alle Tabs). Anlass: Der Anmelde-Link oeffnet einen
// zweiten Tab oder Safari statt der App auf dem Home-Bildschirm; ein abgebrochener Konflikt-Dialog oder ein Tab ohne
// Abgleich ueberschrieb sonst beim Verlassen der Einstellungen den Cloud-Stand (Ultracode-Pruefung PR #76).
import { SUPABASE_URL, SUPABASE_KEY, ANMELDEWEGE } from './konto-config.js';
import { botschutz } from './botschutz.js';
import { aufgeloesterModus } from './thema.js';
import { SPEICHER_VERSION, rohSpeicher } from './storage.js';
import { hoere } from './ereignisse.js';
import { anbieten } from './orte.js';
import { t, locale, sprache } from './sprache.js';
import './sprachen/einstellungen.js';
import './sprachen/allgemein.js';

export const SITZUNG_SCHLUESSEL = 'schach-arena:konto:sitzung';
export const SICHTBAR_SCHLUESSEL = 'schach-arena:konto:sichtbar';
export const RUECKFALL_SCHLUESSEL = 'schach-arena:konto:rueckfall';
export const ABGEGLICHEN_SCHLUESSEL = 'schach-arena:konto:abgeglichen';
// Eigener Benutzername als Merker ({ konto, name }), damit Partie, Duell-Intro und Profilkarte ihn ohne Netz zeigen
// (Flo 01.11.2026: "Ein Freund hat sich angemeldet ... der Account heisst Flo": dort stand fest "Flo").
export const NAME_SCHLUESSEL = 'schach-arena:konto:name';
// Abgleich ueberall (Flo 02.11.2026: "Egal wo ich mich anmelde, in der App oder im Browser, es muss immer der aktuelle
// Stand sein."). Jedes Geraet merkt sich je Konto den Fingerabdruck des Stands, den Geraet und Cloud beim letzten
// Abgleich gemeinsam hatten ({ konto, hash }). Daran sieht synchronisiere(), wer sich seitdem geaendert hat: nur die
// Cloud -> laden, nur das Geraet -> hochladen, beide -> der Stand mit mehr Fortschritt gilt, der andere bleibt gesichert.
export const SYNC_SCHLUESSEL = 'schach-arena:konto:abgleich-stand';
// Der Stand, der bei einem Abgleich mit Aenderungen auf beiden Seiten verloren hat ({ konto, datum, stand }), egal ob
// Geraet oder Cloud. Einstellungen > Konto bietet ihn zum Zurueckholen an, damit keine Entscheidung endgueltig ist.
export const VERDRAENGT_SCHLUESSEL = 'schach-arena:konto:verdraengt';
// sessionStorage: nach dem Neuladen einmal "Spielstand von deinem anderen Geraet geladen" zeigen
export const NACH_LADEN_SCHLUESSEL = 'schach-arena:konto:nach-laden';
// Zeitstempel, wenn ein Tab einen anderen Stand aufs Geraet geladen hat: andere Tabs desselben Browsers laden dann neu
export const GELADEN_SCHLUESSEL = 'schach-arena:konto:geladen';
// Eintraege, die ein frischer Start ohne jede Partie anlegt: Sie machen aus einem leeren Browser keinen Spielstand.
const OHNE_SPIELSTAND = new Set(['schach-arena:v1:hinweis-installieren', 'schach-arena:v1:modul:start',
  'schach-arena:v1:modul:funken', 'schach-arena:v1:modul:punkte']);
const NAME = /^[A-Za-z0-9_]{3,20}$/;
let fetchFn = (...a) => fetch(...a);
let timer = null;
function K(k, w) { return t('einstellungen.konto.' + k, w); }
// Verweis aus dem Bot-Schutz-Hinweis auf den Absatz #botschutz der Datenschutzerklaerung (Sprache wie js/daten.js).
function datenschutzBotschutz() { return new URL((sprache() === 'en' ? 'datenschutz-en.html' : 'datenschutz.html') + '#botschutz', new URL('../', import.meta.url)).href; }

function lager() { return globalThis.localStorage; }
function jsonLies(k) { try { return JSON.parse(lager().getItem(k)); } catch (e) { return null; } }
function jsonSchreib(k, v) { try { lager().setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
export function setzeKontoFetch(fn) { fetchFn = fn || ((...a) => fetch(...a)); }
export function sitzung() { return jsonLies(SITZUNG_SCHLUESSEL); }

// Kennungen von Supabase Auth (GoTrue) in eigenen Worten. Nie den Server-Text (msg) zeigen: Darin kann die E-Mail-Adresse
// stehen. Unbekannte Kennungen erscheinen im Sammeltext ("Serverfehler (400, kennung)"), damit Flo sie im Tester-Bericht
// sieht. Ein falscher und ein abgelaufener Code liefern beide otp_expired, darum ein Text fuer beides.
// Neue Konten gesperrt ("Allow new users to sign up" aus): /otp legt Konten ueber Signup an und meldet signup_disabled,
// mit create_user:false otp_disabled; die Google-Rueckkehr traegt signup_disabled als #error_code (supabase/auth
// internal/api signup.go, otp.go, external.go getErrorQueryString, gelesen 13.11.2026).
const SITZUNG_TOT = new Set(['refresh_token_not_found', 'refresh_token_already_used', 'session_not_found', 'session_expired', 'bad_jwt']);
const KENNUNG_TEXT = Object.freeze({
  email_address_invalid: 'emailUngueltig', otp_expired: 'codeUngueltig',
  over_email_send_rate_limit: 'mailZuOft', over_request_rate_limit: 'codeZuOft', user_banned: 'kontoGesperrt',
  email_address_not_authorized: 'emailNichtFreigegeben', captcha_failed: 'botschutzFehler',
  signup_disabled: 'anmeldungGeschlossen', otp_disabled: 'anmeldungGeschlossen',
});
// Nur eigene Schluessel: Kennungen kommen vom Server oder aus der Adresse, "toString" darf keinen Objekt-Text ergeben
const kennungText = (code) => (Object.prototype.hasOwnProperty.call(KENNUNG_TEXT, code) ? KENNUNG_TEXT[code] : undefined);
function fehlerText(d, status) {
  const code = String(d?.error_code || (typeof d?.code === 'string' ? d.code : '') || d?.error || '');
  const bekannt = SITZUNG_TOT.has(code) ? 'sitzungAbgelaufen' : kennungText(code) || (status === 429 ? 'codeZuOft' : undefined);
  const kennung = /^[a-z0-9_]{1,60}$/.test(code) ? code : '';
  const e = new Error(bekannt ? K(bekannt) : K('serverfehler', { status: kennung ? `${status}, ${kennung}` : status }));
  e.status = status; e.code = d?.code; e.kennung = kennung; e.serverDetails = d; return e;
}
function mitFrist(versprechen, ms) {
  let t; const frist = new Promise((_, nein) => { t = setTimeout(() => nein(new Error(K('offline'))), ms); });
  return Promise.race([versprechen, frist]).finally(() => clearTimeout(t));
}
async function anfrage(pfad, { methode = 'GET', daten, token, prefer } = {}) {
  const kopf = { apikey: SUPABASE_KEY };
  if (daten !== undefined) kopf['Content-Type'] = 'application/json';
  if (token) kopf.Authorization = `Bearer ${token}`;
  if (prefer) kopf.Prefer = prefer;
  let r;
  try { r = await fetchFn(SUPABASE_URL + pfad, { method: methode, headers: kopf, body: daten === undefined ? undefined : JSON.stringify(daten) }); }
  catch (e) { throw new Error(K('offline')); }
  let d = null;
  if (r.status !== 204) { try { d = await r.json(); } catch (e) { /* leere Antwort */ } }
  if (!r.ok) throw fehlerText(d, r.status);
  return d;
}

// basis: Adresse der App ohne Hash. Sie geht als redirect_to mit, damit der Anmelde-Link (Rueckfall ohne SMTP) hierher
// zurueckfuehrt. Ohne redirect_to nimmt Supabase den Referer, und der Browser schickt quer zu supabase.co nur die
// Herkunft (https://floboldt007-cmyk.github.io/ ohne /schach/): Der Link landete auf einer 404-Seite (29.10.2026).
// captchaToken: Token des Bot-Schutzes (js/botschutz.js), nur wenn einer gesetzt ist; ohne Token bleibt der Body wie vorher.
export async function fordereCodeAn(email, basis = basisAdresse(), captchaToken = '') {
  email = String(email || '').trim();
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error(K('emailUngueltig'));
  const ziel = /^https?:\/\//.test(basis) ? '?redirect_to=' + encodeURIComponent(basis) : '';
  const daten = { email, create_user: true };
  if (captchaToken) daten.gotrue_meta_security = { captcha_token: String(captchaToken) };
  await anfrage('/auth/v1/otp' + ziel, { methode: 'POST', daten });
  return true;
}
export function userId(s) {
  if (s?.user?.id) return s.user.id;
  try { return JSON.parse(atob(String(s.access_token).split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).sub; } catch (e) { return null; }
}
function merkeSitzung(d, email) {
  const s = { access_token: d.access_token, refresh_token: d.refresh_token,
    expires_at: Number(d.expires_at) || Math.floor(Date.now() / 1000) + Number(d.expires_in || 3600),
    user: d.user || undefined, email: d.user?.email || email };
  if (!s.access_token || !s.refresh_token || !userId(s)) throw new Error(K('sitzungUnvollstaendig'));
  jsonSchreib(SITZUNG_SCHLUESSEL, s); return s;
}
export async function pruefeCode(email, token) {
  token = String(token || '').replace(/\D/g, '');
  if (token.length !== 6) throw new Error(K('codeZiffern'));
  const s = merkeSitzung(await anfrage('/auth/v1/verify', { methode: 'POST', daten: { type: 'email', email: String(email).trim(), token } }), email);
  neueAnmeldung(); return s;
}
// Jede neue Anmeldung (Code, Link, Google) verlangt einen neuen Abgleich: Die Cloud kann sich inzwischen auf einem
// anderen Geraet geaendert haben. Das Erneuern einer Sitzung (erneuereSitzung) laesst den Merker stehen.
function neueAnmeldung() { try { lager().removeItem(ABGEGLICHEN_SCHLUESSEL); } catch (e) { /* egal */ } }
// Gleichzeitige Erneuerungen mit demselben Schluessel teilen sich eine Anfrage (sonst scheitert der zweite Aufrufer,
// Ultracode 30.10.). Die Antwort gilt nur, wenn inzwischen niemand abgemeldet hat (epoche) und noch eine Sitzung desselben
// Kontos gespeichert ist: Eine spaete Antwort darf eine Abmeldung nie rueckgaengig machen. Hat ein anderer Tab schon
// erneuert (anderer Schluessel, gleiches Konto), gilt dessen Sitzung.
let laufendeErneuerung = null;   // { token, versprechen }
export function erneuereSitzung() {
  const s = sitzung(); if (!s?.refresh_token) return Promise.reject(new Error(K('nichtAngemeldet')));
  if (laufendeErneuerung && laufendeErneuerung.token === s.refresh_token) return laufendeErneuerung.versprechen;
  const versprechen = erneuere(s).finally(() => { if (laufendeErneuerung?.versprechen === versprechen) laufendeErneuerung = null; });
  laufendeErneuerung = { token: s.refresh_token, versprechen };
  return versprechen;
}
async function erneuere(s) {
  const e0 = epoche;
  const id = userId(s);
  // die gerade gespeicherte Sitzung, wenn sie zum selben Konto gehoert und ein anderer Tab sie inzwischen erneuert hat
  const vonAnderemTab = () => { const j = sitzung(); return epoche === e0 && j && userId(j) === id && j.refresh_token !== s.refresh_token ? j : null; };
  let d;
  try {
    d = await anfrage('/auth/v1/token?grant_type=refresh_token', { methode: 'POST', daten: { refresh_token: s.refresh_token } });
  } catch (e) {
    const j = vonAnderemTab(); if (j) return j;
    // Tote Sitzung (auf dem Server abgemeldet oder abgelaufen): lokal entfernen, damit die Gruppe "abgemeldet" zeigt,
    // statt still nie mehr zu sichern. Nur wenn noch diese Sitzung gespeichert ist.
    if (SITZUNG_TOT.has(e.kennung) && epoche === e0 && sitzung()?.refresh_token === s.refresh_token) {
      epoche++; sitzungTot = true; try { lager().removeItem(SITZUNG_SCHLUESSEL); lager().removeItem(ABGEGLICHEN_SCHLUESSEL); } catch (f) { /* egal */ }
    }
    throw e;
  }
  const j = vonAnderemTab(); if (j) return j;
  if (epoche !== e0 || sitzung()?.refresh_token !== s.refresh_token) throw new Error(K('nichtAngemeldet'));
  return merkeSitzung(d, s.email);
}
export async function aktiveSitzung() {
  const s = sitzung(); if (!s) throw new Error(K('nichtAngemeldet'));
  return Number(s.expires_at) <= Math.floor(Date.now() / 1000) + 30 ? erneuereSitzung() : s;
}
// epoche: zaehlt jedes Abmelden und Loeschen. Ein Abgleich, der waehrenddessen laeuft, schreibt danach nichts mehr.
let epoche = 0;
// Lokal sofort abmelden, danach den Server mit kurzer Frist benachrichtigen, nur fuer diese Sitzung (scope=local):
// Andere Geraete und Browser bleiben angemeldet.
export async function abmelden({ frist = 5000 } = {}) {
  const s = sitzung();
  epoche++;
  try { lager().removeItem(SITZUNG_SCHLUESSEL); lager().removeItem(ABGEGLICHEN_SCHLUESSEL); lager().removeItem(NAME_SCHLUESSEL); } catch (e) { /* egal */ }
  try { if (s?.access_token) await mitFrist(anfrage('/auth/v1/logout?scope=local', { methode: 'POST', token: s.access_token }), frist); } catch (e) { /* lokal ist schon abgemeldet */ }
}
export function istAbgeglichen(s = sitzung()) {
  try { return !!s && !!userId(s) && lager().getItem(ABGEGLICHEN_SCHLUESSEL) === userId(s); } catch (e) { return false; }
}
function merkeAbgleich() { const id = userId(sitzung()); if (id) try { lager().setItem(ABGEGLICHEN_SCHLUESSEL, id); } catch (e) { /* egal */ } }

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

export function lokalerStand() {
  const roh = rohSpeicher(); const stand = {};
  for (const k of roh.schluessel()) stand[k] = roh.lies(k);
  return stand;
}
// Lokale Spielernamen gehoeren nicht in die automatische Cloud-Sicherung. Lokale Sicherungsdateien und
// die Rueckfall-Sicherung behalten den vollstaendigen Stand; nur die Kopie fuer den Upload wird bereinigt.
export function cloudStand() {
  const stand = lokalerStand();
  delete stand['schach-arena:v1:einstellungen:zuzweit'];
  for (const schluessel of ['schach-arena:v1:partien', 'schach-arena:v1:laufend']) {
    if (!(schluessel in stand)) continue;
    try {
      const daten = JSON.parse(stand[schluessel]);
      const anonym = (p) => p?.modus === 'zuzweit'
        ? { ...p, zuzweit: { weiss: 'Weiß', schwarz: 'Schwarz', drehen: p.zuzweit?.drehen === true } } : p;
      stand[schluessel] = JSON.stringify(Array.isArray(daten) ? daten.map(anonym) : anonym(daten));
    } catch (e) { delete stand[schluessel]; }
  }
  return stand;
}
export async function ladeCloudStand() {
  const s = await aktiveSitzung();
  const d = await anfrage('/rest/v1/spielstaende?select=*', { token: s.access_token });
  return Array.isArray(d) ? (d[0] || null) : d;
}
export async function ladeProfil() {
  const s = await aktiveSitzung(); const d = await anfrage('/rest/v1/profile?select=*', { token: s.access_token });
  const p = Array.isArray(d) ? (d[0] || null) : d;
  if (p && p.benutzername) merkeName(p.benutzername, s);
  return p;
}
// Eigener Benutzername der angemeldeten Nutzer-ID (aus dem Merker), sonst null; meinName() faellt auf "Du" / "You" zurueck.
// Nie ein fester Name: jeder Spieler sieht sich selbst.
export function eigenerName(s = sitzung()) {
  const id = userId(s);
  if (!id) return null;
  const d = jsonLies(NAME_SCHLUESSEL);
  return d && d.konto === id && NAME.test(String(d.name || '')) ? d.name : null;
}
export function meinName() { return eigenerName() || t('allgemein.du'); }
function merkeName(name, s = sitzung()) {
  try { const id = userId(s); if (id && NAME.test(String(name || ''))) lager().setItem(NAME_SCHLUESSEL, JSON.stringify({ konto: id, name })); } catch (e) { /* nur Komfort */ }
}
export async function speichereCloudStand(stand = cloudStand()) {
  const e0 = epoche;
  const s = await aktiveSitzung(); const id = userId(s); if (!id) throw new Error(K('keineId'));
  // Waehrend des Erneuerns abgemeldet: nichts mehr hochladen
  if (epoche !== e0 || userId(sitzung()) !== id) throw new Error(K('nichtAngemeldet'));
  // nur Familie und System ("iPadOS Safari"), nie der volle User-Agent-String (Datensparsamkeit)
  const daten = { user_id: id, stand, format_version: SPEICHER_VERSION, geraet: geraetKurz() };
  await anfrage('/rest/v1/spielstaende', { methode: 'POST', token: s.access_token, daten, prefer: 'resolution=merge-duplicates' });
  return new Date();
}
export async function speichereBenutzername(benutzername) {
  benutzername = String(benutzername || '').trim();
  if (!NAME.test(benutzername)) throw new Error(K('nameRegel'));
  const s = await aktiveSitzung();
  try {
    await anfrage('/rest/v1/profile', { methode: 'POST', token: s.access_token,
      daten: { user_id: userId(s), benutzername }, prefer: 'resolution=merge-duplicates' });
  } catch (e) {
    if (e.status === 409 || e.code === '23505') throw new Error(K('nameVergeben'));
    throw e;
  }
  merkeName(benutzername, s);
  return benutzername;
}
function gueltigerStand(stand) {
  return stand && typeof stand === 'object' && !Array.isArray(stand)
    && Object.entries(stand).every(([k, v]) => k.startsWith('schach-arena:v1:') && typeof v === 'string');
}
// Eintraege, die nie in die Cloud gehen (cloudStand): Laden laesst sie auf dem Geraet stehen (Namen beim Spiel zu zweit)
const NUR_LOKAL = new Set(['schach-arena:v1:einstellungen:zuzweit']);
export function ladeStandAufGeraet(cloud) {
  if (!cloud || cloud.format_version !== SPEICHER_VERSION || !gueltigerStand(cloud.stand)) throw new Error(K('cloudFormat'));
  const vorher = lokalerStand();
  if (!jsonSchreib(RUECKFALL_SCHLUESSEL, { datum: new Date().toISOString(), stand: vorher })) throw new Error(K('rueckfallFehler'));
  const roh = rohSpeicher();
  try {
    for (const k of roh.schluessel()) if (!NUR_LOKAL.has(k) || k in cloud.stand) roh.entferne(k);
    for (const [k, v] of Object.entries(cloud.stand)) if (!roh.schreib(k, v)) throw new Error('Schreiben fehlgeschlagen.');
  } catch (e) {
    for (const k of roh.schluessel()) roh.entferne(k);
    for (const [k, v] of Object.entries(vorher)) roh.schreib(k, v);
    throw new Error(K('cloudLadenFehler'));
  }
  return true;
}
export function vorschau(stand) {
  const s = stand?.stand || stand || {}; let partien = 0; let level = 1; let funken = 0;
  try { const p = JSON.parse(s['schach-arena:v1:partien']); partien = Array.isArray(p) ? p.length : 0; } catch (e) { /* leer */ }
  // Das Level fuehrt das Funken-Modul (frueher stand hier nur fortschritt.level, das es nicht gibt: immer Level 1)
  try { const f = JSON.parse(s['schach-arena:v1:modul:funken']); level = Number(f?.level) || 1; funken = Number(f?.gesamt) || 0; } catch (e) { /* leer */ }
  return { datum: stand?.aktualisiert_am || null, partien, level, funken };
}
export function hatSpielstand(stand = lokalerStand()) {
  const v = vorschau(stand);
  // Reine Einstellungen (Brett, Klang, Sprache) sind kein Spielstand: sonst bekaeme ein leerer Browser den Konflikt-Dialog
  return v.partien > 0 || v.level > 1
    || Object.keys(stand).some((k) => !OHNE_SPIELSTAND.has(k) && !/^schach-arena:v1:einstellungen(?::|$)/.test(k));
}
// wahl: nur 'geraet' oder 'cloud' entscheiden einen Konflikt. Alles andere (auch der Abbruch-Wert eines Dialogs)
// laesst ihn offen: dann wird nichts geschrieben und der Riegel bleibt zu.
// Liefert null, wenn waehrenddessen abgemeldet oder geloescht wurde: dann schreibt der Abgleich nichts mehr aufs Geraet.
// Ohne Wahl entscheidet synchronisiere() selbst ('gleich' = beide Seiten hatten schon denselben Stand).
export async function gleicheNachAnmeldung(wahl) {
  if (wahl !== 'geraet' && wahl !== 'cloud') {
    const r = await synchronisiere();
    return r === 'geladen' ? 'cloud' : r === 'hochgeladen' ? 'geraet' : r;
  }
  const e0 = epoche;
  const id0 = userId(sitzung());
  const gilt = () => epoche === e0 && !!id0 && userId(sitzung()) === id0;
  const cloud = await ladeCloudStand();
  if (!gilt()) return null;
  if (wahl === 'cloud' && cloud) { ladeStandAufGeraet(cloud); merkeSync(id0, standHash(cloud.stand)); andereTabsNeuLaden(); return 'cloud'; }
  if (cloud && gueltigerStand(cloud.stand)) jsonSchreib(VERDRAENGT_SCHLUESSEL, { konto: id0, datum: new Date().toISOString(), stand: cloud.stand });
  const stand = cloudStand();
  await speichereCloudStand(stand); if (!gilt()) return null;
  merkeSync(id0, standHash(stand)); return 'geraet';
}

// Fingerabdruck eines Stands: unabhaengig von der Reihenfolge der Schluessel (jsonb sortiert sie in der Cloud um)
export function standHash(stand) {
  const t = JSON.stringify(Object.keys(stand || {}).sort().map((k) => [k, stand[k]]));
  let h1 = 0xdeadbeef; let h2 = 0x41c6ce57;
  for (let i = 0; i < t.length; i++) { const c = t.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0') + ':' + t.length;
}
function merkeSync(id, hash) { if (id) jsonSchreib(SYNC_SCHLUESSEL, { konto: id, hash }); merkeAbgleich(); }
export function gemerkterStand(id = userId(sitzung())) { const d = jsonLies(SYNC_SCHLUESSEL); return id && d && d.konto === id ? d.hash || null : null; }
// Hat sich das Geraet seit dem letzten Abgleich geaendert? (fuer die Uhr: ohne Aenderung keine Anfrage)
export function geraetGeaendert() { const h = gemerkterStand(); return !h || h !== standHash(cloudStand()); }

// Der eine Abgleich fuer Start, Rueckkehr, Partie-Ende, "Jetzt sichern" und die Anmeldung. Liefert 'gleich',
// 'hochgeladen', 'geladen' (dann neu laden: die Module halten ihren Stand im Arbeitsspeicher) oder null (waehrenddessen
// abgemeldet). Fragt nie: Flo will ueberall ohne Dialog den aktuellen Stand. Laeuft nie doppelt.
// laden: false (in einer Partie): Muesste der Abgleich laden, wartet er ('spaeter') und schreibt nichts.
let syncLauf = null;
export function synchronisiere({ laden = true } = {}) {
  if (!syncLauf) syncLauf = sync(laden).finally(() => { syncLauf = null; });
  return syncLauf;
}
async function sync(laden = true) {
  const e0 = epoche;
  const id0 = userId(sitzung());
  if (!id0) return null;
  const gilt = () => epoche === e0 && userId(sitzung()) === id0;
  const cloud = await ladeCloudStand();
  if (!gilt()) return null;
  const lokal = cloudStand(); const hL = standHash(lokal);
  const hoch = async () => { await speichereCloudStand(lokal); if (!gilt()) return null; merkeSync(id0, hL); return 'hochgeladen'; };
  const lade = () => { if (!laden) return 'spaeter'; ladeStandAufGeraet(cloud); merkeSync(id0, hC); andereTabsNeuLaden(); return 'geladen'; };
  if (!cloud) return hoch();
  if (cloud.format_version !== SPEICHER_VERSION || !gueltigerStand(cloud.stand)) throw new Error(K('cloudFormat'));
  const hC = standHash(cloud.stand);
  const basis = gemerkterStand(id0);
  if (hL === hC) { merkeSync(id0, hC); return 'gleich'; }
  const geraet = lokalerStand();
  const verdraengt = (stand) => jsonSchreib(VERDRAENGT_SCHLUESSEL, { konto: id0, datum: new Date().toISOString(), stand });
  if (basis && hC === basis) {                              // nur das Geraet hat sich geaendert
    // Weniger Fortschritt als in der Cloud (z. B. "Alles zuruecksetzen", das laut Text auch die Cloud leert): hochladen,
    // aber den Cloud-Stand zurueckholbar behalten
    if (mehrFortschritt(vorschau(geraet), vorschau(cloud)) === 'cloud') verdraengt(cloud.stand);
    return hoch();
  }
  if ((basis && hL === basis) || !hatSpielstand(geraet)) return lade();   // nur die Cloud (oder ein leeres Geraet)
  // Beide geaendert, oder dieses Geraet hat noch nie mit dem Konto abgeglichen: mehr Fortschritt (Level, Funken,
  // Partien) gewinnt, bei Gleichstand die Cloud. Der Verlierer kommt nach VERDRAENGT_SCHLUESSEL (zurueckholbar).
  if (mehrFortschritt(vorschau(geraet), vorschau(cloud)) !== 'geraet') { if (laden) verdraengt(geraet); return lade(); }
  verdraengt(cloud.stand);
  return hoch();
}
// Verdraengter Stand dieses Kontos (Vorschau fuer Einstellungen > Konto) und Zurueckholen: tauscht ihn mit dem Stand auf
// dem Geraet. Der gemerkte Abgleich bleibt, also laedt der naechste Abgleich ihn als Geraete-Aenderung hoch.
export function verdraengterStand(id = userId(sitzung())) {
  const d = jsonLies(VERDRAENGT_SCHLUESSEL);
  return id && d && d.konto === id && gueltigerStand(d.stand) ? d : null;
}
export function holeVerdraengtZurueck() {
  const id = userId(sitzung()); const d = verdraengterStand(id);
  if (!d) throw new Error(K('nichtsZurueck'));
  const jetzt = lokalerStand();
  ladeStandAufGeraet({ format_version: SPEICHER_VERSION, stand: d.stand });
  jsonSchreib(VERDRAENGT_SCHLUESSEL, { konto: id, datum: new Date().toISOString(), stand: jetzt });
  andereTabsNeuLaden();
  return true;
}
export function planeSicherung(ms = 1200) {
  clearTimeout(timer);
  // Nach dem Partie-Ende steht noch das Ergebnis: dort nur hochladen, geladen wird danach im Hintergrund
  timer = setTimeout(() => { if (istAbgeglichen()) synchronisiere({ laden: !imSpiel() }).then((r) => { if (r === 'geladen') neuLaden(); }).catch(() => {}); }, ms);
}
function andereTabsNeuLaden() { try { lager().setItem(GELADEN_SCHLUESSEL, String(Date.now())); } catch (e) { /* egal */ } }
// Nach dem Laden eines anderen Stands neu starten, damit kein Modul seinen alten Stand zurueckschreibt
let neuLadenFn = () => globalThis.location?.reload?.();
export function setzeNeuLaden(fn) { neuLadenFn = fn || (() => globalThis.location?.reload?.()); }
export function neuLaden() {
  try { globalThis.sessionStorage?.setItem(NACH_LADEN_SCHLUESSEL, '1'); } catch (e) { /* nur Komfort */ }
  neuLadenFn();
}

// Rueckfall, solange Supabase ohne eigenen SMTP-Versand einen Anmelde-Link statt des Codes schickt:
// Der Link fuehrt mit #access_token=...&refresh_token=... zurueck auf die Seite (redirect_to aus fordereCodeAn).
let abgleichOffen = false;
let linkFehler = false;     // Textschluessel zu #error=... (abgelaufener Link, Google abgelehnt): Meldung beim ersten Zeichnen
let sitzungTot = false;     // die Sitzung ist auf dem Server abgelaufen: Meldung bleibt ueber das Neuzeichnen stehen
// Auch direkt nach dem Neuladen wegen eines geladenen Stands: dann kein Installations-Hinweis darueber
let frischGeladen = false;
try { frischGeladen = globalThis.sessionStorage?.getItem(NACH_LADEN_SCHLUESSEL) === '1'; } catch (e) { /* egal */ }
export function linkAnmeldungFrisch() { return abgleichOffen || linkFehler || frischGeladen; }
export function uebernimmLinkSitzung(ort = globalThis.location, verlauf = globalThis.history) {
  let h = String(ort?.hash || '');
  // Google-Anmeldung: Supabase haengt die Antwort mit einem weiteren "#" an redirect_to an (#konto#access_token=...)
  const letztes = h.lastIndexOf('#');
  if (letztes > 0) h = h.slice(letztes);
  if (!/^#(?:.*&)?(?:access_token|error)=/.test(h)) return false;
  const p = new URLSearchParams(h.slice(1));
  if (p.get('access_token')) {
    try {
      let email;
      try { email = JSON.parse(atob(p.get('access_token').split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).email; } catch (e) { /* ohne */ }
      merkeSitzung({ access_token: p.get('access_token'), refresh_token: p.get('refresh_token'),
        expires_at: p.get('expires_at'), expires_in: p.get('expires_in') }, email);
      neueAnmeldung();
      abgleichOffen = true;
    } catch (e) { /* unvollstaendiger Link: ignorieren */ }
  } else {
    // otp_expired heisst hier "Link abgelaufen", nicht "Code falsch"; unbekannte Kennungen ebenso
    const text = kennungText(p.get('error_code'));
    linkFehler = text && text !== 'codeUngueltig' ? text : 'linkUngueltig';
  }
  // zur Konto-Seite der Einstellungen (Handy: eigene Seite, iPad: dorthin gerollt), dort steht "Angemeldet als ..."
  try { verlauf.replaceState(null, '', ort.pathname + ort.search + '#einstellungen/konto'); } catch (e) { /* egal */ }
  return true;
}

// Anmeldung mit Google oder Apple ueber Supabase (OAuth). basis: Adresse der App ohne Hash (im Test frei waehlbar).
function basisAdresse(ort = globalThis.location) { return String(ort?.href || '').split('#')[0]; }
export function anmeldeUrl(anbieter, basis = basisAdresse()) {
  return SUPABASE_URL + '/auth/v1/authorize?provider=' + encodeURIComponent(anbieter) + '&redirect_to=' + encodeURIComponent(basis + '#konto');
}
export function googleAnmeldeUrl(basis = basisAdresse()) { return anmeldeUrl('google', basis); }
export function meldeMitAnbieterAn(anbieter, ort = globalThis.location) {
  const url = anmeldeUrl(anbieter, basisAdresse(ort));
  ort.assign(url);
  return url;
}
export function meldeMitGoogleAn(ort = globalThis.location) { return meldeMitAnbieterAn('google', ort); }

// Welche Anmeldewege die Konto-Gruppe zeigt (js/konto-config.js); setzeAnmeldewege nur fuer Tests
let wegeTest = null;
export function setzeAnmeldewege(w = null) { wegeTest = w; }
export function anmeldewege() { return wegeTest || ANMELDEWEGE; }

// Welcher Stand hat mehr Fortschritt? Erst das Level, dann die Funken, dann die Zahl der Partien. Gleich: null.
export function mehrFortschritt(geraet, cloud) {
  const g = geraet || {}; const c = cloud || {};
  if ((g.level || 1) !== (c.level || 1)) return (g.level || 1) > (c.level || 1) ? 'geraet' : 'cloud';
  if ((g.funken || 0) !== (c.funken || 0)) return (g.funken || 0) > (c.funken || 0) ? 'geraet' : 'cloud';
  if ((g.partien || 0) !== (c.partien || 0)) return (g.partien || 0) > (c.partien || 0) ? 'geraet' : 'cloud';
  return null;
}

export function kontoFreigeschaltet(hash = globalThis.location?.hash || '', speicher = lager()) {
  try {
    if (/^#konto(?:$|[/?])/.test(hash)) speicher.setItem(SICHTBAR_SCHLUESSEL, '1');
    return speicher.getItem(SICHTBAR_SCHLUESSEL) === '1';
  } catch (e) { return false; }
}

// Seit 31.10.2026 fuer alle sichtbar (Flo: "jeder soll ein Konto machen koennen"). kontoFreigeschaltet() bleibt der
// Schalter fuer die Testbereiche (Online, Schule, Abo, Coach), die weiter erst nach #konto erscheinen.
function kontoSichtbar() { return true; }

export function kontoGruppe({ app } = {}) {
  if (!kontoSichtbar() || typeof document === 'undefined') return null;
  const el = document.createElement('section'); el.className = 'es-gruppe flaeche konto-gruppe';
  let email = sitzung()?.email || ''; let zuletzt = '';
  const melden = (t, fehler = false) => { const x = el.querySelector('.konto-status'); if (x) { x.textContent = t; x.dataset.fehler = fehler ? 'ja' : 'nein'; } };
  let gezeichnetMit = null;   // angemeldet beim letzten Zeichnen (die Gruppe "Daten" kann das Konto loeschen)
  let schutz = null;          // Bot-Schutz (js/botschutz.js), nur ohne Sitzung und nur mit Site-Key
  const render = () => {
    const s = sitzung();
    schutz?.entferne(); schutz = null;
    if (s) sitzungTot = false;
    gezeichnetMit = !!s;
    el.innerHTML = `<h3 class="es-titel">${K('titel')}</h3>${s ? `<p>${K('angemeldetAls', { email: `<b>${escapeHtml(s.email || email)}</b>` })}</p>
      <label>${K('benutzername')} <input class="konto-name" maxlength="20" pattern="[A-Za-z0-9_]{3,20}" autocomplete="username"></label>
      <p class="es-hilfe konto-name-hinweis" hidden>${K('nameWaehlen')}</p>
      <div class="es-knoepfe"><button class="knopf primaer" data-konto="sichern">${K('sichern')}</button><button class="knopf" data-konto="abmelden">${K('abmelden')}</button></div>${verdraengtZeile()}` : `<label>${K('email')} <input class="konto-email" type="email" autocomplete="email" value="${escapeHtml(email)}"></label>
      <div class="konto-botschutz" hidden></div><button class="knopf primaer" data-konto="code">${K('codeSenden')}</button><div class="konto-code" hidden><fieldset><legend>${K('code')}</legend><div class="konto-ziffern">
      ${[0, 1, 2, 3, 4, 5].map((i) => `<input aria-label="${K('ziffer', { nr: i + 1 })}" inputmode="numeric" ${i === 0 ? 'autocomplete="one-time-code"' : ''} maxlength="1" pattern="[0-9]">`).join('')}</div></fieldset><button class="knopf primaer" data-konto="pruefen">${K('anmelden')}</button></div>
      <p class="es-hilfe konto-oder">${K('oder')}</p><div class="es-knoepfe konto-anbieter"><button class="knopf konto-google" type="button" data-konto="google">${K('google')}</button>`
      + `<button class="knopf konto-apple" type="button" data-konto="apple" hidden>${K('apple')}</button></div>`
      + (alsApp() ? `<p class="es-hilfe konto-app-hinweis">${K('appHinweis')}</p>` : '')}
      <p class="konto-status" aria-live="polite"${sitzungTot && !s ? ' data-fehler="ja"' : ''}>${!s ? (sitzungTot ? K('sitzungAbgelaufen') : '') : zuletzt ? K('zuletzt', { zeit: zuletzt }) : K('nochNicht')}</p>
      <p class="es-hilfe">${K('gespeichert')}${s ? ' ' + K('datenHinweis') : ''}</p>`;
    zeigeWege();
    if (s) zeigeName();
    if (!s) {
      schutz = botschutz(el.querySelector('.konto-botschutz'), { modus: aufgeloesterModus(), sprache: sprache() });
      if (schutz) el.querySelector('.konto-status').insertAdjacentHTML('beforebegin', `<p class="es-hilfe konto-botschutz-hinweis">${K('botschutzHinweis')} <a href="${datenschutzBotschutz()}" target="_blank" rel="noopener">${K('botschutzMehr')}</a></p>`);
    }
  };
  // Eigener Name im Feld; ein Konto ohne Namen (neues Konto) bekommt den Hinweis, einen zu waehlen. Erst nach der
  // Profil-Abfrage, sonst sieht ein bestehendes Konto den Hinweis kurz, bevor sein Name da ist. Nur das Feld und den
  // Hinweis anfassen, nie neu zeichnen: Die Statuszeile (z. B. "Geraetestand hochgeladen") bleibt stehen.
  let profilFuer = null; let profilLaeuft = null;   // Konto-ID, deren Profil schon abgefragt ist bzw. gerade abgefragt wird
  const zeigeName = () => {
    const id = userId(sitzung()); if (!id) return;
    const feld = el.querySelector('.konto-name'); const name = eigenerName();
    if (feld && !feld.value && name) feld.value = name;
    const hinweis = el.querySelector('.konto-name-hinweis'); if (hinweis) hinweis.hidden = !!name || profilFuer !== id;
    if (name || profilFuer === id || profilLaeuft === id) return;
    profilLaeuft = id;
    // offline oder Serverfehler: kein Hinweis (der Name koennte existieren), beim naechsten Zeichnen neu fragen
    ladeProfil().then(() => { if (userId(sitzung()) === id) { profilFuer = id; zeigeName(); } }, () => {})
      .finally(() => { if (profilLaeuft === id) profilLaeuft = null; });
  };
  const verdraengtZeile = () => {
    const d = verdraengterStand(); if (!d) return '';
    const v = vorschau(d.stand);
    return `<p class="es-hilfe konto-verdraengt">${K('verdraengt', { datum: new Date(d.datum).toLocaleString(locale()), level: v.level, partien: v.partien })}</p>`
      + `<div class="es-knoepfe"><button class="knopf" type="button" data-konto="zurueckholen">${K('zurueckholen')}</button></div>`;
  };
  const zeigeWege = () => {
    const wege = anmeldewege();
    const g = el.querySelector('.konto-google'); const ap = el.querySelector('.konto-apple');
    if (g) g.hidden = !wege.google;
    if (ap) ap.hidden = !wege.apple;
    const oder = el.querySelector('.konto-oder'); if (oder) oder.hidden = !wege.google && !wege.apple;
  };
  el.addEventListener('click', async (e) => {
    const a = e.target.closest('[data-konto]')?.dataset.konto; if (!a) return;
    try {
      if (a === 'code') {
        email = el.querySelector('.konto-email').value;
        let token = '';
        if (schutz) {
          token = await schutz.token();
          if (!token) { melden(K(schutz.fehler ? 'botschutzFehler' : 'botschutzWarten'), true); return; }
        }
        try { await fordereCodeAn(email, basisAdresse(), token); } finally { schutz?.verbraucht(); }
        el.querySelector('.konto-code').hidden = false; melden(K('codeGesendet') + ' ' + K(alsApp() ? 'linkNichtInApp' : 'linkHier')); }
      if (a === 'pruefen') { const code = [...el.querySelectorAll('.konto-ziffern input')].map((x) => x.value).join(''); await pruefeCode(email, code); const abgleich = await gleicheNachAnmeldung(); render(); meldeAbgleich(abgleich); }
      if (a === 'sichern') {
        const name = el.querySelector('.konto-name').value; if (name) await speichereBenutzername(name);
        // Nie blind hochladen (02.11.2026): Hat ein anderes Geraet inzwischen mehr geschafft, laedt "Jetzt sichern" dessen Stand
        const abgleich = await gleicheNachAnmeldung(); if (abgleich === 'geraet' || abgleich === 'gleich') zuletzt = new Date().toLocaleString(locale());
        render(); meldeAbgleich(abgleich);
      }
      if (a === 'abmelden') { await abmelden(); render(); }
      if (a === 'zurueckholen') {
        const d = verdraengterStand(); if (!d) { render(); return; }
        const v = vorschau(d.stand);
        const w = await app?.frage?.({ titel: K('zurueckTitel'), text: K('zurueckText', { level: v.level, partien: v.partien }),
          knoepfe: [{ text: K('zurueckholen'), wert: 'ja', art: 'primaer' }], abbrechen: true });
        if (w !== 'ja') return;
        holeVerdraengtZurueck(); neuLaden();
      }
      if (a === 'google') { melden(K('zuGoogle')); meldeMitGoogleAn(); }
      if (a === 'apple') { melden(K('zuApple')); meldeMitAnbieterAn('apple'); }
    } catch (f) {
      // Nur Status und Kennung: der Server-Text (msg) kann die E-Mail-Adresse enthalten
      if (f?.serverDetails) console.error('Konto-Serverfehler', f.status, f.kennung || '');
      melden(f.message || t('einstellungen.nichtGeklappt'), true); }
  });
  el.addEventListener('input', (e) => {
    const z = e.target.closest('.konto-ziffern input'); if (!z) return;
    z.value = z.value.replace(/\D/g, '').slice(-1);
    if (z.value) z.nextElementSibling?.focus();
  });
  el.addEventListener('paste', (e) => {
    const z = e.target.closest('.konto-ziffern input'); if (!z) return;
    const code = e.clipboardData?.getData('text')?.replace(/\D/g, '').slice(0, 6); if (!code) return;
    e.preventDefault(); const felder = [...el.querySelectorAll('.konto-ziffern input')];
    code.split('').forEach((wert, i) => { if (felder[i]) felder[i].value = wert; }); felder[Math.min(code.length, 6) - 1]?.focus();
  });
  // Ergebnis eines Abgleichs: 'cloud' heisst, ein anderer Stand liegt jetzt auf dem Geraet, also neu laden
  const meldeAbgleich = (abgleich) => {
    if (!abgleich) return;
    if (abgleich.konflikt) return konfliktDialog(abgleich);
    if (abgleich === 'cloud') return neuLaden();
    melden(K(abgleich === 'gleich' ? 'aktuell' : 'hochgeladen'));
  };
  async function konfliktDialog(k) {
    const c = k.cloud, g = k.geraet;
    const zahlen = { gp: g.partien, gl: g.level, cp: c.partien, cl: c.level };
    const mehr = mehrFortschritt(g, c);
    const text = (c.datum ? K('konfliktTextDatum', { ...zahlen, datum: new Date(c.datum).toLocaleString(locale()) }) : K('konfliktText', zahlen))
      + (mehr ? ' ' + K(mehr === 'cloud' ? 'mehrCloud' : 'mehrGeraet') : '');
    // Flo 31.10.2026: der Stand mit mehr Fortschritt steht vorn und ist hervorgehoben, damit niemand aus Versehen den
    // kleineren behaelt. Gleichstand: wie bisher das Geraet vorn.
    const geraetKnopf = { text: K('geraetBehalten') + (mehr === 'geraet' ? ' · ' + K('empfohlen') : ''), wert: 'geraet', art: mehr === 'cloud' ? undefined : 'primaer' };
    const cloudKnopf = { text: K('cloudLaden') + (mehr === 'cloud' ? ' · ' + K('empfohlen') : ''), wert: 'cloud', art: mehr === 'cloud' ? 'primaer' : undefined };
    const w = await app?.frage?.({ titel: K('konfliktTitel'), text, knoepfe: mehr === 'cloud' ? [cloudKnopf, geraetKnopf] : [geraetKnopf, cloudKnopf], abbrechen: true });
    if (w !== 'geraet' && w !== 'cloud') { melden(K('abgleichOffen')); return; }
    // Ein anderer Tab hat inzwischen entschieden: nicht noch einmal (womoeglich entgegengesetzt) schreiben
    if (istAbgeglichen()) { melden(K('schonAbgeglichen')); return; }
    meldeAbgleich(await gleicheNachAnmeldung(w));
  }
  // Angemeldet, aber auf diesem Geraet noch nicht abgeglichen (Link-Tab, anderer Tab, abgebrochener Dialog, Sitzung von
  // vor dem Riegel): beim Zeichnen der Gruppe abgleichen, statt still nie mehr zu sichern.
  let abgleichLaeuft = false;
  const gleicheAb = () => {
    if (abgleichLaeuft || !sitzung() || istAbgeglichen()) return;
    abgleichLaeuft = true;
    gleicheNachAnmeldung().then((abgleich) => {
      render();
      if (abgleich === 'gleich') return;   // beim blossen Oeffnen der Gruppe nichts melden
      meldeAbgleich(abgleich);
    }).catch((f) => melden(f.message || t('einstellungen.nichtGeklappt'), true)).finally(() => { abgleichLaeuft = false; });
  };
  render();
  if (linkFehler) { const text = linkFehler; linkFehler = false; melden(K(text), true); }
  abgleichOffen = false;
  gleicheAb();
  // Abmelden von aussen (Konto loeschen in der Gruppe "Daten") oder Anmeldung in einem anderen Tab: neu zeichnen
  const uhr = setInterval(() => { if (!!sitzung() !== gezeichnetMit) { render(); gleicheAb(); } }, 1000);
  return { el, verlasse() { clearInterval(uhr); planeSicherung(0); } };
}
function alsApp() {
  try { return globalThis.navigator?.standalone === true || !!globalThis.matchMedia?.('(display-mode: standalone)')?.matches; } catch (e) { return false; }
}
function escapeHtml(t) { return String(t || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

// Abgleich im Hintergrund (Flo 02.11.2026: "immer der aktuelle Stand"): beim Start, bei jeder Rueckkehr in die App und
// alle 30 Sekunden, wenn sich auf dem Geraet etwas geaendert hat. Nie mitten in einer Partie, Lektion oder Online-Partie:
// ein geladener Stand startet die App neu.
let appRef = null;
// Partie (auch zu zweit), Lektion, Online-Partie, Raetsel, Training und Spielanalyse: dort nie neu laden
function imSpiel() { return /^#(partie|lektion|online\/partie|raetsel|training|analyse)/.test(String(globalThis.location?.hash || '')); }
export function abgleichImHintergrund() {
  try { if (!sitzung() || imSpiel()) return Promise.resolve(null); } catch (e) { return Promise.resolve(null); }
  return synchronisiere().then((r) => { if (r === 'geladen') neuLaden(); return r; }).catch(() => null);
}
function nachLadenMelden() {
  try {
    if (globalThis.sessionStorage?.getItem(NACH_LADEN_SCHLUESSEL) !== '1') return;
    globalThis.sessionStorage.removeItem(NACH_LADEN_SCHLUESSEL);
    appRef?.meldung?.(K('geladenVonAnderem'));
  } catch (e) { /* nur Komfort */ }
}

// Registrierung ist defensiv: Das Konto darf die Offline-App nie am Start hindern.
try { uebernimmLinkSitzung(); kontoFreigeschaltet(); anbieten('einstellungen:gruppen', kontoGruppe, { reihenfolge: 5, paket: 'konto' }); hoere('partie:beendet', () => planeSicherung());
  hoere('app:bereit', (d) => {
    appRef = d?.app || null;
    nachLadenMelden();
    setTimeout(abgleichImHintergrund, 800);
    setInterval(() => { try { if (globalThis.document?.visibilityState !== 'hidden' && sitzung() && geraetGeaendert()) abgleichImHintergrund(); } catch (e) { /* egal */ } }, 30000);
  });
  // Ein anderer Tab hat einen anderen Stand geladen: dieser Tab haelt den alten im Arbeitsspeicher, also neu laden
  globalThis.addEventListener?.('storage', (e) => { if (e.key === GELADEN_SCHLUESSEL && e.newValue && !imSpiel()) neuLaden(); });
  hoere('app:sichtbar', (d) => { if (d?.sichtbar) abgleichImHintergrund(); else { try { if (sitzung() && geraetGeaendert()) abgleichImHintergrund(); } catch (e) { /* egal */ } } });
} catch (e) { /* App laeuft ohne Konto weiter */ }
