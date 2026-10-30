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
import { SUPABASE_URL, SUPABASE_KEY } from './konto-config.js';
import { SPEICHER_VERSION, rohSpeicher } from './storage.js';
import { hoere } from './ereignisse.js';
import { anbieten } from './orte.js';
import { t, locale } from './sprache.js';
import './sprachen/einstellungen.js';

export const SITZUNG_SCHLUESSEL = 'schach-arena:konto:sitzung';
export const SICHTBAR_SCHLUESSEL = 'schach-arena:konto:sichtbar';
export const RUECKFALL_SCHLUESSEL = 'schach-arena:konto:rueckfall';
export const ABGEGLICHEN_SCHLUESSEL = 'schach-arena:konto:abgeglichen';
// Eintraege, die ein frischer Start ohne jede Partie anlegt: Sie machen aus einem leeren Browser keinen Spielstand.
const OHNE_SPIELSTAND = new Set(['schach-arena:v1:hinweis-installieren', 'schach-arena:v1:modul:start',
  'schach-arena:v1:modul:funken', 'schach-arena:v1:modul:punkte']);
const NAME = /^[A-Za-z0-9_]{3,20}$/;
let fetchFn = (...a) => fetch(...a);
let timer = null;
function K(k, w) { return t('einstellungen.konto.' + k, w); }

function lager() { return globalThis.localStorage; }
function jsonLies(k) { try { return JSON.parse(lager().getItem(k)); } catch (e) { return null; } }
function jsonSchreib(k, v) { try { lager().setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
export function setzeKontoFetch(fn) { fetchFn = fn || ((...a) => fetch(...a)); }
export function sitzung() { return jsonLies(SITZUNG_SCHLUESSEL); }

// Kennungen von Supabase Auth (GoTrue) in eigenen Worten. Nie den Server-Text (msg) zeigen: Darin kann die E-Mail-Adresse
// stehen. Unbekannte Kennungen erscheinen im Sammeltext ("Serverfehler (400, kennung)"), damit Flo sie im Tester-Bericht
// sieht. Ein falscher und ein abgelaufener Code liefern beide otp_expired, darum ein Text fuer beides.
const SITZUNG_TOT = new Set(['refresh_token_not_found', 'refresh_token_already_used', 'session_not_found', 'session_expired', 'bad_jwt']);
function fehlerText(d, status) {
  const code = String(d?.error_code || (typeof d?.code === 'string' ? d.code : '') || d?.error || '');
  const bekannt = SITZUNG_TOT.has(code) ? 'sitzungAbgelaufen' : {
    email_address_invalid: 'emailUngueltig', otp_expired: 'codeUngueltig',
    over_email_send_rate_limit: 'codeZuOft', over_request_rate_limit: 'codeZuOft', user_banned: 'kontoGesperrt',
    email_address_not_authorized: 'emailNichtFreigegeben',
  }[code];
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
export async function fordereCodeAn(email, basis = basisAdresse()) {
  email = String(email || '').trim();
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error(K('emailUngueltig'));
  const ziel = /^https?:\/\//.test(basis) ? '?redirect_to=' + encodeURIComponent(basis) : '';
  await anfrage('/auth/v1/otp' + ziel, { methode: 'POST', daten: { email, create_user: true } });
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
export async function erneuereSitzung() {
  const s = sitzung(); if (!s?.refresh_token) throw new Error(K('nichtAngemeldet'));
  try {
    return merkeSitzung(await anfrage('/auth/v1/token?grant_type=refresh_token', { methode: 'POST', daten: { refresh_token: s.refresh_token } }), s.email);
  } catch (e) {
    // Tote Sitzung (auf dem Server abgemeldet oder abgelaufen): lokal entfernen, damit die Gruppe "abgemeldet" zeigt,
    // statt still nie mehr zu sichern
    if (SITZUNG_TOT.has(e.kennung)) { epoche++; sitzungTot = true; try { lager().removeItem(SITZUNG_SCHLUESSEL); lager().removeItem(ABGEGLICHEN_SCHLUESSEL); } catch (f) { /* egal */ } }
    throw e;
  }
}
export async function aktiveSitzung() {
  const s = sitzung(); if (!s) throw new Error(K('nichtAngemeldet'));
  return Number(s.expires_at) <= Math.floor(Date.now() / 1000) + 30 ? erneuereSitzung() : s;
}
// Bleiben beim Entfernen der Kontodaten: der Freischalt-Merker (kein Kontodatum), ein offener Widerruf der Datenfreigabe
// (eine offene Loeschpflicht: js/daten.js holt ihn nach, sobald dasselbe Konto auf diesem Geraet wieder angemeldet ist)
// und der Einwilligungsnachweis zum Teilen: Die Einwilligung gilt auf dem Server weiter, und nur mit diesem Nachweis
// zeigt der Schalter "Teilen" nach der naechsten Anmeldung "an" und laesst sich zum Widerrufen ausschalten.
export const BLEIBT_BEIM_ENTFERNEN = Object.freeze([SICHTBAR_SCHLUESSEL, 'schach-arena:daten:widerruf', 'schach-arena:daten:zustimmung']);
// epoche: zaehlt jedes Abmelden und Loeschen. Ein Abgleich, der waehrenddessen laeuft, schreibt danach nichts mehr.
let epoche = 0;
// Lokal sofort abmelden, danach den Server mit kurzer Frist benachrichtigen, nur fuer diese Sitzung (scope=local):
// Andere Geraete bleiben angemeldet. geraet: zusaetzlich alle Kontodaten auf diesem Geraet entfernen.
export async function abmelden({ geraet = false, frist = 5000 } = {}) {
  const s = sitzung();
  epoche++;
  try { lager().removeItem(SITZUNG_SCHLUESSEL); lager().removeItem(ABGEGLICHEN_SCHLUESSEL); } catch (e) { /* egal */ }
  if (geraet) {
    try {
      const weg = [];
      for (let i = 0; i < lager().length; i++) {
        const k = lager().key(i);
        if (k && /^(schach-arena:(?:konto|abo|daten|online:einladung|schule))(?::|$)/.test(k) && !BLEIBT_BEIM_ENTFERNEN.includes(k)) weg.push(k);
      }
      for (const k of weg) lager().removeItem(k);
    } catch (e) { /* die Sitzung ist bereits entfernt */ }
  }
  try { if (s?.access_token) await mitFrist(anfrage('/auth/v1/logout?scope=local', { methode: 'POST', token: s.access_token }), frist); } catch (e) { /* lokal ist schon abgemeldet */ }
}
// Vor "Alle Daten dieser App loeschen": den Stand noch einmal sichern, wenn dieses Geraet abgeglichen ist.
// 'ohne' (nicht angemeldet oder kein Spielstand), 'nicht-abgeglichen' (angemeldet, aber dieser Stand war nie in der
// Cloud: er ginge verloren), 'gesichert' oder 'fehlgeschlagen'.
export async function sichereVorDemLoeschen(ms = 8000) {
  if (!sitzung() || !hatSpielstand()) return 'ohne';
  if (!istAbgeglichen()) return 'nicht-abgeglichen';
  try { await mitFrist(speichereCloudStand(), ms); return 'gesichert'; } catch (e) { return 'fehlgeschlagen'; }
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
  return Array.isArray(d) ? (d[0] || null) : d;
}
export async function speichereCloudStand() {
  const s = await aktiveSitzung(); const id = userId(s); if (!id) throw new Error(K('keineId'));
  // nur Familie und System ("iPadOS Safari"), nie der volle User-Agent-String (Datensparsamkeit)
  const daten = { user_id: id, stand: cloudStand(), format_version: SPEICHER_VERSION, geraet: geraetKurz() };
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
  return benutzername;
}
function gueltigerStand(stand) {
  return stand && typeof stand === 'object' && !Array.isArray(stand)
    && Object.entries(stand).every(([k, v]) => k.startsWith('schach-arena:v1:') && typeof v === 'string');
}
export function ladeStandAufGeraet(cloud) {
  if (!cloud || cloud.format_version !== SPEICHER_VERSION || !gueltigerStand(cloud.stand)) throw new Error(K('cloudFormat'));
  const vorher = lokalerStand();
  if (!jsonSchreib(RUECKFALL_SCHLUESSEL, { datum: new Date().toISOString(), stand: vorher })) throw new Error(K('rueckfallFehler'));
  const roh = rohSpeicher();
  try {
    for (const k of roh.schluessel()) roh.entferne(k);
    for (const [k, v] of Object.entries(cloud.stand)) if (!roh.schreib(k, v)) throw new Error('Schreiben fehlgeschlagen.');
  } catch (e) {
    for (const k of roh.schluessel()) roh.entferne(k);
    for (const [k, v] of Object.entries(vorher)) roh.schreib(k, v);
    throw new Error(K('cloudLadenFehler'));
  }
  return true;
}
export function vorschau(stand) {
  const s = stand?.stand || stand || {}; let partien = 0; let level = 1;
  try { const p = JSON.parse(s['schach-arena:v1:partien']); partien = Array.isArray(p) ? p.length : 0; } catch (e) { /* leer */ }
  // Das Level fuehrt das Funken-Modul (frueher stand hier nur fortschritt.level, das es nicht gibt: immer Level 1)
  try { const f = JSON.parse(s['schach-arena:v1:modul:funken']); level = Number(f?.level) || 1; } catch (e) { /* leer */ }
  return { datum: stand?.aktualisiert_am || null, partien, level };
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
export async function gleicheNachAnmeldung(wahl) {
  const e0 = epoche;
  const id0 = userId(sitzung());
  const gilt = () => epoche === e0 && !!id0 && userId(sitzung()) === id0;
  const cloud = await ladeCloudStand();
  if (!gilt()) return null;
  if (!cloud) { await speichereCloudStand(); if (!gilt()) return null; merkeAbgleich(); return 'geraet'; }
  if (!hatSpielstand()) { ladeStandAufGeraet(cloud); merkeAbgleich(); return 'cloud'; }
  if (wahl === 'geraet') { await speichereCloudStand(); if (!gilt()) return null; merkeAbgleich(); return 'geraet'; }
  if (wahl === 'cloud') { ladeStandAufGeraet(cloud); merkeAbgleich(); return 'cloud'; }
  neueAnmeldung();   // Konflikt: Geraet und Cloud weichen ab, also Riegel zu, auch wenn ein alter Merker stand
  return { konflikt: true, geraet: vorschau(lokalerStand()), cloud: vorschau(cloud) };
}
export function planeSicherung(ms = 1200) { clearTimeout(timer); timer = setTimeout(() => { if (istAbgeglichen()) speichereCloudStand().catch(() => {}); }, ms); }

// Rueckfall, solange Supabase ohne eigenen SMTP-Versand einen Anmelde-Link statt des Codes schickt:
// Der Link fuehrt mit #access_token=...&refresh_token=... zurueck auf die Seite (redirect_to aus fordereCodeAn).
let abgleichOffen = false;
let linkFehler = false;     // abgelaufener oder schon benutzter Link (#error=...): Meldung beim ersten Zeichnen
let sitzungTot = false;     // die Sitzung ist auf dem Server abgelaufen: Meldung bleibt ueber das Neuzeichnen stehen
export function linkAnmeldungFrisch() { return abgleichOffen || linkFehler; }
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
      lager().setItem(SICHTBAR_SCHLUESSEL, '1');
      abgleichOffen = true;
    } catch (e) { /* unvollstaendiger Link: ignorieren */ }
  } else {
    linkFehler = true;
    try { lager().setItem(SICHTBAR_SCHLUESSEL, '1'); } catch (e) { /* egal */ }
  }
  try { verlauf.replaceState(null, '', ort.pathname + ort.search + '#einstellungen'); } catch (e) { /* egal */ }
  return true;
}

// Anmeldung mit Google ueber Supabase (OAuth). basis: Adresse der App ohne Hash (im Test frei waehlbar).
function basisAdresse(ort = globalThis.location) { return String(ort?.href || '').split('#')[0]; }
export function googleAnmeldeUrl(basis = basisAdresse()) {
  return SUPABASE_URL + '/auth/v1/authorize?provider=google&redirect_to=' + encodeURIComponent(basis + '#konto');
}
export function meldeMitGoogleAn(ort = globalThis.location) {
  const url = googleAnmeldeUrl(basisAdresse(ort));
  ort.assign(url);
  return url;
}

export function kontoFreigeschaltet(hash = globalThis.location?.hash || '', speicher = lager()) {
  try {
    if (/^#konto(?:$|[/?])/.test(hash)) speicher.setItem(SICHTBAR_SCHLUESSEL, '1');
    return speicher.getItem(SICHTBAR_SCHLUESSEL) === '1';
  } catch (e) { return false; }
}

function kontoSichtbar() { return kontoFreigeschaltet(); }

export function kontoGruppe({ app } = {}) {
  if (!kontoSichtbar() || typeof document === 'undefined') return null;
  const el = document.createElement('section'); el.className = 'es-gruppe flaeche konto-gruppe';
  let email = sitzung()?.email || ''; let zuletzt = '';
  const melden = (t, fehler = false) => { const x = el.querySelector('.konto-status'); if (x) { x.textContent = t; x.dataset.fehler = fehler ? 'ja' : 'nein'; } };
  let gezeichnetMit = null;   // angemeldet beim letzten Zeichnen (die Gruppe "Daten" kann das Konto loeschen)
  const render = () => {
    const s = sitzung();
    if (s) sitzungTot = false;
    gezeichnetMit = !!s;
    el.innerHTML = `<h3 class="es-titel">${K('titel')}</h3>${s ? `<p>${K('angemeldetAls', { email: `<b>${escapeHtml(s.email || email)}</b>` })}</p>
      <label>${K('benutzername')} <input class="konto-name" maxlength="20" pattern="[A-Za-z0-9_]{3,20}" autocomplete="username"></label>
      <div class="es-knoepfe"><button class="knopf primaer" data-konto="sichern">${K('sichern')}</button><button class="knopf" data-konto="abmelden">${K('abmelden')}</button><button class="knopf" data-konto="abmelden-geraet">${K('abmeldenGeraet')}</button></div>` : `<label>${K('email')} <input class="konto-email" type="email" autocomplete="email" value="${escapeHtml(email)}"></label>
      <button class="knopf primaer" data-konto="code">${K('codeSenden')}</button><div class="konto-code" hidden><fieldset><legend>${K('code')}</legend><div class="konto-ziffern">
      ${[0, 1, 2, 3, 4, 5].map((i) => `<input aria-label="${K('ziffer', { nr: i + 1 })}" inputmode="numeric" ${i === 0 ? 'autocomplete="one-time-code"' : ''} maxlength="1" pattern="[0-9]">`).join('')}</div></fieldset><button class="knopf primaer" data-konto="pruefen">${K('anmelden')}</button></div>
      <p class="es-hilfe konto-oder">${K('oder')}</p><button class="knopf konto-google" type="button" data-konto="google">${K('google')}</button>`}
      <p class="konto-status" aria-live="polite"${sitzungTot && !s ? ' data-fehler="ja"' : ''}>${!s ? (sitzungTot ? K('sitzungAbgelaufen') : '') : zuletzt ? K('zuletzt', { zeit: zuletzt }) : K('nochNicht')}</p>
      <p class="es-hilfe">${K('gespeichert')}${s ? ' ' + K('datenHinweis') : ''}</p>`;
  };
  el.addEventListener('click', async (e) => {
    const a = e.target.closest('[data-konto]')?.dataset.konto; if (!a) return;
    try {
      if (a === 'code') { email = el.querySelector('.konto-email').value; await fordereCodeAn(email); el.querySelector('.konto-code').hidden = false; melden(K('codeGesendet') + ' ' + K(alsApp() ? 'linkNichtInApp' : 'linkHier')); }
      if (a === 'pruefen') { const code = [...el.querySelectorAll('.konto-ziffern input')].map((x) => x.value).join(''); await pruefeCode(email, code); const abgleich = await gleicheNachAnmeldung(); render(); if (abgleich?.konflikt) konfliktDialog(abgleich); }
      if (a === 'sichern') {
        const name = el.querySelector('.konto-name').value; if (name) await speichereBenutzername(name);
        // Ohne Abgleich auf diesem Geraet (z. B. der Tab, in dem der Link angefordert wurde) erst fragen, nie still hochladen
        if (!istAbgeglichen()) { const abgleich = await gleicheNachAnmeldung(); render(); if (abgleich?.konflikt) konfliktDialog(abgleich); else if (abgleich) melden(abgleich === 'cloud' ? K('cloudGeladen') : K('hochgeladen')); return; }
        const d = await speichereCloudStand(); zuletzt = d.toLocaleString(locale()); render();
      }
      if (a === 'abmelden') { await abmelden(); render(); }
      if (a === 'abmelden-geraet') {
        // Einen offenen Widerruf vorher senden (mit Frist): danach fehlt die Sitzung dafuer
        try { const d = await import('./daten.js'); await mitFrist(d.widerrufeJetzt(), 5000); } catch (f) { /* bleibt gemerkt */ }
        await abmelden({ geraet: true }); render();
      }
      if (a === 'google') { melden(K('zuGoogle')); meldeMitGoogleAn(); }
    } catch (f) { if (f?.serverDetails) console.error('Konto-Serverfehler', f.serverDetails); melden(f.message || t('einstellungen.nichtGeklappt'), true); }
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
  async function konfliktDialog(k) {
    const c = k.cloud, g = k.geraet;
    const zahlen = { gp: g.partien, gl: g.level, cp: c.partien, cl: c.level };
    const text = c.datum ? K('konfliktTextDatum', { ...zahlen, datum: new Date(c.datum).toLocaleString(locale()) }) : K('konfliktText', zahlen);
    const w = await app?.frage?.({ titel: K('konfliktTitel'), text, knoepfe: [{ text: K('geraetBehalten'), wert: 'geraet', art: 'primaer' }, { text: K('cloudLaden'), wert: 'cloud' }], abbrechen: true });
    if (w !== 'geraet' && w !== 'cloud') { melden(K('abgleichOffen')); return; }
    // Ein anderer Tab hat inzwischen entschieden: nicht noch einmal (womoeglich entgegengesetzt) schreiben
    if (istAbgeglichen()) { melden(K('schonAbgeglichen')); return; }
    if (await gleicheNachAnmeldung(w)) melden(w === 'cloud' ? K('cloudGeladen') : K('hochgeladen'));
  }
  // Angemeldet, aber auf diesem Geraet noch nicht abgeglichen (Link-Tab, anderer Tab, abgebrochener Dialog, Sitzung von
  // vor dem Riegel): beim Zeichnen der Gruppe abgleichen, statt still nie mehr zu sichern.
  let abgleichLaeuft = false;
  const gleicheAb = () => {
    if (abgleichLaeuft || !sitzung() || istAbgeglichen()) return;
    abgleichLaeuft = true;
    gleicheNachAnmeldung().then((abgleich) => {
      render();
      if (abgleich?.konflikt) return konfliktDialog(abgleich);
      if (abgleich) melden(abgleich === 'cloud' ? K('cloudGeladen') : K('hochgeladen'));
    }).catch((f) => melden(f.message || t('einstellungen.nichtGeklappt'), true)).finally(() => { abgleichLaeuft = false; });
  };
  render();
  if (linkFehler) { linkFehler = false; melden(K('linkUngueltig'), true); }
  abgleichOffen = false;
  gleicheAb();
  // Abmelden von aussen (Konto loeschen in der Gruppe "Daten") oder Anmeldung in einem anderen Tab: neu zeichnen
  const uhr = setInterval(() => { if (!!sitzung() !== gezeichnetMit) { render(); gleicheAb(); } }, 1000);
  return { el, verlasse() { clearInterval(uhr); if (istAbgeglichen()) speichereCloudStand().catch(() => {}); } };
}
function alsApp() {
  try { return globalThis.navigator?.standalone === true || !!globalThis.matchMedia?.('(display-mode: standalone)')?.matches; } catch (e) { return false; }
}
function escapeHtml(t) { return String(t || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

// Registrierung ist defensiv: Das Konto darf die Offline-App nie am Start hindern.
try { uebernimmLinkSitzung(); kontoSichtbar(); anbieten('einstellungen:gruppen', kontoGruppe, { reihenfolge: 5, paket: 'konto' }); hoere('partie:beendet', () => planeSicherung());
  hoere('speicher:zurueckgesetzt', (d) => { if (d.alles) epoche++; }); } catch (e) { /* App laeuft ohne Konto weiter */ }
