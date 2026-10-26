// Abo "Crownmate Trainer" (Welle B1): Premium-Stand, Produkt, Kauf und Verwaltung. Ohne Supabase-Bibliothek, nur fetch
// (Muster: js/konto.js). Die Wahrheit liegt auf dem Server (Tabelle abos, Funktion ist_premium in
// supabase/abo-schema.sql); hier steht nur ein Zwischenspeicher, damit die App weiss, was zuletzt galt, auch offline.
// Die Oberflaeche (Gruppe in den Einstellungen, Blatt "Crownmate Trainer") liegt im Paket js/pakete/abo/.
//
// Fairness (SPIELKONZEPT 2b.5 und 5): Das Abo verkauft Lehrer und Lernstoff, nie den Zugang zum Spiel. Kein Countdown,
// keine Druck-Texte, kein Kaufhinweis in der Partie oder im Ergebnis (premiumHinweis zeigt dort nichts), das Abo bringt
// nie mehr Funken oder Wertung. Preise stehen nicht im Code, sondern in Flos Tabelle produkte.
//
// API:
//   PRODUKT_ID = 'trainer'          Zeile in produkte fuer "Crownmate Trainer"
//   istPremium({ neu = false } = {}) -> Promise<boolean>
//       nicht angemeldet: false (ohne Netz). Sonst hoechstens alle PRUEF_MS ein Abgleich mit dem Server (rpc
//       ist_premium und die eigene Zeile aus abos), dazwischen der Zwischenspeicher. Offline oder bei einem
//       Serverfehler gilt der letzte bekannte Stand, aber nur bis zu seinem gueltig_bis. neu: true fragt sofort.
//   premiumStand() -> { angemeldet, premium, status, plan, gueltigBis, quelle, geprueftAm }   synchron, ohne Netz
//       status 'aktiv' | 'gekuendigt' | 'abgelaufen' | null (nie geprueft), gueltigBis/geprueftAm in ms
//   ladeProdukt({ neu = false, id = PRODUKT_ID } = {}) -> Promise<{ id, name, beschreibung, preisText, kaufLink,
//       portalLink } | null>   oeffentlich (ohne Anmeldung), Zwischenspeicher PRODUKT_MS, offline der letzte Stand.
//       Links nur https, sonst null. null: Flo hat (noch) kein aktives Produkt eingetragen.
//   produktOffline() -> boolean   true, wenn der letzte ladeProdukt() am Netz scheiterte und nichts zwischengespeichert war
//       (dann ist null kein "Flo hat nichts eingetragen", sondern "gerade keine Verbindung")
//   istTestLink(produkt) -> boolean   kauf_link aus dem Stripe-Testmodus (https://buy.stripe.com/test_...): kein echtes Geld
//   kaufAdresse(produkt, sitzung) -> string | null   kauf_link + ?client_reference_id=<Nutzer-ID>&prefilled_email=...,
//       nur mit Anmeldung (der Webhook ordnet den Kauf ueber client_reference_id dem Konto zu)
//
//   Vorteile, die schon gebaut sind (Verkauft wird nur, was es gibt; Pruefer-Befund B1, Paragraf 5 UWG):
//   registriereVorteil(id)   das Paket, das einen Vorteil des Trainers umsetzt, meldet ihn beim Laden an, z. B. B2 mit
//       registriereVorteil('frag-den-coach'). Die Ids stehen in VORTEILE (js/pakete/abo/trainer.js). Das Blatt zeigt
//       nur angemeldete Vorteile unter "Im Trainer", die uebrigen unter "In Arbeit" (nicht enthalten), und bietet den
//       Kauf erst an, wenn mindestens einer angemeldet ist (oder der Link aus dem Stripe-Testmodus stammt).
//   vorteilBereit(id) -> boolean
//
//   Alter (SPIELKONZEPT 2b.8 Regel 22: Abo fuer Minderjaehrige nur ueber die Familienfreigabe der Stores; im Web gibt es
//   die nicht, also im Web erst ab 18): Altersfrage einmal je Konto vor dem ersten Kauf.
//   alterAngabe() -> true (18 oder aelter) | false (juenger) | null (noch nicht gefragt)   fuer das angemeldete Konto
//   setzeAlterAngabe(ab18) -> boolean   merkt die Antwort (null loescht sie)
//   inStoreHuelle() -> boolean   true in der App-Store-/Play-Huelle (Capacitor, native/). Dort duerfen digitale Abos nur
//       ueber den In-App-Kauf des Stores laufen (Apple 3.1.1, Google Play Billing): kaufen() und verwalten() tun dort nichts
//       (grund 'store'), das Blatt zeigt keinen Kauf- und keinen Verwalten-Knopf. Der Premium-Stand gilt trotzdem.
//   kaufen({ produkt, oeffne } = {}) -> Promise<{ ok, url? , grund? }>
//       grund: 'store' | 'abgemeldet' | 'alter' (Altersfrage nicht mit "18 oder aelter" beantwortet) | 'kein_produkt' | 'kein_link'
//       Mit produkt (schon geladen) laeuft alles bis zum Oeffnen ohne await: so bleibt der Klick eine Nutzergeste
//       und Safari blockiert das neue Fenster nicht. Merkt sich den Kauf (kaufGestartet), damit das Paket nach der
//       Rueckkehr neu fragt.
//   verwalten({ produkt, oeffne } = {}) -> Promise<{ ok, url?, grund? }>   portal_link (+ prefilled_email); grund 'store' in der Huelle
//   kaufGestartet() -> ms | null, vergissKauf()
//   Nach dem Kauf (Pruefer-Befund B1): Stripe leitet sofort nach der Zahlung zurueck, der Webhook kommt oft erst Sekunden
//   spaeter. Deshalb fragt die App nach der Rueckkehr mehrmals mit Pause neu, statt einmal "kein Abo" zu sagen und den
//   Kauf-Knopf wieder anzubieten (Gefahr eines zweiten Abos).
//   NACH_KAUF_MS = 30 min   so lange gilt ein Kauf-Start als offen (kaufOffen)
//   NACHFRAGEN_MS = [3000, 10000, 30000]   Pausen zwischen den Nachfragen einer Serie
//   kaufOffen() -> boolean   Kauf-Merker juenger als NACH_KAUF_MS (aelter: Merker wird geloescht)
//   kaufStand() -> 'prueft' | 'offen' | null   'prueft': Serie laeuft gerade, 'offen': Kauf offen, Serie vorbei
//   bestaetigeKauf() -> Promise<boolean>   eine Serie: sofort fragen, dann nach jeder Pause wieder, bis Premium oder Ende.
//       Nur bei offenem Kauf; laeuft schon eine, kommt deren Promise. Bei Premium ist der Merker weg. Meldet Anfang und
//       Ende mit dem DOM-Ereignis "abo:stand" (detail { prueft, premium, bestaetigt }); bestaetigt: true heisst, das Abo
//       wurde mit dieser Serie aktiv (das Paket sagt dann einmal Danke).
//   setzeNachfragen(liste)   nur fuer Tests (kuerzere Pausen)
//   aufraeumen()   ohne Anmeldung: Stand und Altersangabe vom Geraet nehmen (nach dem Abmelden)
//   aboHinweisZumLoeschen() -> string   Satz fuer den Dialog "Konto löschen", solange ein Stripe-Abo laeuft (sonst ''):
//       Konto loeschen entfernt die Zeile in abos, kuendigt aber nicht bei Stripe. Fuer die Integration (js/daten.js).
//   oeffneTrainer({ app } = {}) -> Promise   oeffnet das Blatt "Crownmate Trainer" (laedt js/pakete/abo/trainer.js)
//   premiumHinweis(el, was, { app } = {}) -> HTMLElement | null
//       Ruhiger Hinweis fuer andere Pakete, dort wo eine Premium-Funktion gesperrt ist, z. B.
//         premiumHinweis(box, 'Coach-Erklärungen in ganzen Sätzen', { app });
//       Haengt div.premium-hinweis[data-premium] an el (ersetzt einen vorigen Hinweis in el) und liefert es. Knopf
//       "Mehr zum Trainer" oeffnet das Blatt. In der Partie (und damit im Ergebnis) und in einer Lektion zeigt er nichts
//       und liefert null (SPIELKONZEPT 2b Regel 9, Fairness 13: OHNE_HINWEIS_SCREENS). Das Paket bringt die Optik
//       (css/pakete/abo.css); premiumHinweis laedt sie bei Bedarf selbst.
//       Vertrag fuer Pakete: Der Hinweis erscheint nur als Antwort auf einen Tipp auf eine Premium-Funktion (z. B. B2:
//       Knopf "Frag den Coach" in der Analyse), nie von selbst beim Oeffnen eines Screens, nie nach einer Niederlage
//       ungefragt, nie als Werbefeld.
//   setzeAboFetch(fn), setzeAboUhr(fn)   nur fuer Tests
//   vergiss()   Zwischenspeicher leeren (z. B. nach dem Abmelden)
//
// Speicher (bewusst AUSSERHALB von schach-arena:v1:, damit der Stand weder in die Cloud-Sicherung noch in eine
// Export-Datei wandert und beim Laden eines Cloud-Spielstands nicht ueberschrieben wird; er gehoert zur Sitzung):
//   schach-arena:abo:stand    { uid, premium, status, plan, gueltigBis, quelle, geprueftAm }
//   schach-arena:abo:produkt  { id, produkt, geholtAm }
//   schach-arena:abo:kauf     Zeitpunkt (ms) des letzten Kauf-Starts
//   schach-arena:abo:alter    { uid, ab18 }   Antwort auf die Altersfrage (nur ja/nein, kein Geburtsdatum)
import { SUPABASE_URL, SUPABASE_KEY } from './konto-config.js';
import { t } from './sprache.js';
import './sprachen/abo.js';
const A = (k, w) => t('abo.' + k, w);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
import { sitzung, erneuereSitzung } from './konto.js';
import { icon } from './ui/icons.js';

export const PRODUKT_ID = 'trainer';
export const STAND_SCHLUESSEL = 'schach-arena:abo:stand';
export const PRODUKT_SCHLUESSEL = 'schach-arena:abo:produkt';
export const KAUF_SCHLUESSEL = 'schach-arena:abo:kauf';
export const ALTER_SCHLUESSEL = 'schach-arena:abo:alter';
export const PRUEF_MS = 10 * 60 * 1000;
export const PRODUKT_MS = 60 * 60 * 1000;
export const NACH_KAUF_MS = 30 * 60 * 1000;
export const NACHFRAGEN_MS = Object.freeze([3000, 10000, 30000]);
// Screens ohne Kaufhinweis (SPIELKONZEPT 2b Regel 9: nie in einer Partie, im Ergebnis oder in einer Lektion)
export const OHNE_HINWEIS_SCREENS = Object.freeze(['partie', 'lektion']);

let fetchFn = (...a) => fetch(...a);
let uhr = () => Date.now();
let laufend = null;
let nachfragen = NACHFRAGEN_MS;
let bestaetigung = null;
let produktFehlt = false;
const bereit = new Set();
export function setzeAboFetch(fn) { fetchFn = fn || ((...a) => fetch(...a)); }
export function setzeAboUhr(fn) { uhr = typeof fn === 'function' ? fn : () => Date.now(); }
export function setzeNachfragen(liste) { nachfragen = Array.isArray(liste) ? liste.filter((ms) => Number.isFinite(ms) && ms >= 0) : NACHFRAGEN_MS; }

function lager() { return globalThis.localStorage; }
function jsonLies(k) { try { return JSON.parse(lager().getItem(k)); } catch (e) { return null; } }
function jsonSchreib(k, v) { try { lager().setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
function entferne(k) { try { lager().removeItem(k); } catch (e) { /* egal */ } }

// Nutzer-ID aus der Sitzung (wie js/konto.js: user.id, sonst sub im Token)
export function nutzerId(s = sitzung()) {
  if (!s) return null;
  if (s.user && typeof s.user.id === 'string') return s.user.id;
  try { return JSON.parse(atob(String(s.access_token).split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).sub || null; } catch (e) { return null; }
}
// Gueltige Sitzung, bei Bedarf erneuert (wie aktiveSitzung in js/konto.js)
async function gueltigeSitzung() {
  const s = sitzung();
  if (!s) throw new Error(A('nichtAn'));
  return Number(s.expires_at) <= Math.floor(uhr() / 1000) + 30 ? erneuereSitzung() : s;
}

async function anfrage(pfad, { methode = 'GET', daten, token } = {}) {
  const kopf = { apikey: SUPABASE_KEY };
  if (daten !== undefined) kopf['Content-Type'] = 'application/json';
  if (token) kopf.Authorization = `Bearer ${token}`;
  let r;
  try {
    r = await fetchFn(SUPABASE_URL + pfad, { method: methode, headers: kopf, body: daten === undefined ? undefined : JSON.stringify(daten) });
  } catch (e) {
    const f = new Error(A('offline')); f.offline = true; throw f;
  }
  let d = null;
  if (r.status !== 204) { try { d = await r.json(); } catch (e) { /* leer */ } }
  if (!r.ok) { const f = new Error((d && (d.message || d.msg)) || A('server', { status: r.status })); f.status = r.status; throw f; }
  return d;
}

// ---------- Premium-Stand ----------
const gilt = (c, jetzt) => !!c && c.premium === true && Number.isFinite(c.gueltigBis) && c.gueltigBis > jetzt;
function gecacht(uid) {
  const c = jsonLies(STAND_SCHLUESSEL);
  return c && typeof c === 'object' && c.uid === uid ? c : null;
}

export function premiumStand() {
  const uid = nutzerId();
  const leer = { angemeldet: !!uid, premium: false, status: null, plan: null, gueltigBis: null, quelle: null, geprueftAm: null };
  if (!uid) return leer;
  const c = gecacht(uid);
  if (!c) return leer;
  return { angemeldet: true, premium: gilt(c, uhr()), status: c.status || null, plan: c.plan || null,
    gueltigBis: Number.isFinite(c.gueltigBis) ? c.gueltigBis : null, quelle: c.quelle || null, geprueftAm: c.geprueftAm || null };
}

export async function istPremium({ neu = false } = {}) {
  const uid = nutzerId();
  if (!uid) return false;
  const c = gecacht(uid);
  if (!neu && c && Number.isFinite(c.geprueftAm) && uhr() - c.geprueftAm < PRUEF_MS && uhr() >= c.geprueftAm) return gilt(c, uhr());
  if (laufend && laufend.uid === uid) return laufend.p;
  const p = (async () => {
    try {
      const s = await gueltigeSitzung();
      const [premium, zeilen] = await Promise.all([
        anfrage('/rest/v1/rpc/ist_premium', { methode: 'POST', daten: {}, token: s.access_token }),
        anfrage('/rest/v1/abos?select=status,plan,gueltig_bis,quelle', { token: s.access_token }),
      ]);
      const z = Array.isArray(zeilen) ? zeilen[0] : (zeilen && typeof zeilen === 'object' ? zeilen : null);
      const bis = z && z.gueltig_bis ? Date.parse(z.gueltig_bis) : NaN;
      const stand = { uid, premium: premium === true, status: (z && z.status) || null, plan: (z && z.plan) || null,
        gueltigBis: Number.isFinite(bis) ? bis : null, quelle: (z && z.quelle) || null, geprueftAm: uhr() };
      jsonSchreib(STAND_SCHLUESSEL, stand);
      return gilt(stand, uhr());
    } catch (e) {
      // offline, Serverfehler oder Sitzung nicht erneuerbar: letzter bekannter Stand bis zu seinem Ablaufdatum
      return gilt(c, uhr());
    } finally {
      laufend = null;
    }
  })();
  laufend = { uid, p };
  return p;
}

// ---------- Produkt ----------
const LINK = /^https:\/\/[^\s<>"'`]+$/;
const text = (x, max) => (typeof x === 'string' && x.trim() ? x.trim().slice(0, max) : null);
export function pruefeProdukt(z) {
  if (!z || typeof z !== 'object' || typeof z.id !== 'string') return null;
  const link = (x) => (typeof x === 'string' && x.length <= 300 && LINK.test(x) ? x : null);
  return { id: z.id, name: text(z.name, 60) || 'Crownmate Trainer', beschreibung: text(z.beschreibung, 400), preisText: text(z.preis_text, 80),
    kaufLink: link(z.kauf_link), portalLink: link(z.portal_link) };
}

export async function ladeProdukt({ neu = false, id = PRODUKT_ID } = {}) {
  const c = jsonLies(PRODUKT_SCHLUESSEL);
  const passt = c && typeof c === 'object' && c.id === id;
  if (!neu && passt && Number.isFinite(c.geholtAm) && uhr() - c.geholtAm < PRODUKT_MS && uhr() >= c.geholtAm) return c.produkt || null;
  try {
    const d = await anfrage(`/rest/v1/produkte?select=id,name,beschreibung,preis_text,kauf_link,portal_link&id=eq.${encodeURIComponent(id)}&aktiv=eq.true`);
    const p = pruefeProdukt(Array.isArray(d) ? d[0] : null);
    jsonSchreib(PRODUKT_SCHLUESSEL, { id, produkt: p, geholtAm: uhr() });
    produktFehlt = false;
    return p;
  } catch (e) {
    produktFehlt = !passt;
    return passt ? c.produkt || null : null;
  }
}
export function produktOffline() { return produktFehlt; }
export function istTestLink(produkt) { return !!(produkt && typeof produkt.kaufLink === 'string' && /^https:\/\/buy\.stripe\.com\/test_/.test(produkt.kaufLink)); }

// ---------- Vorteile, die schon gebaut sind ----------
export function registriereVorteil(id) { if (typeof id === 'string' && /^[a-z0-9-]{2,40}$/.test(id)) bereit.add(id); }
export function vorteilBereit(id) { return bereit.has(id); }

// ---------- Altersfrage (im Web erst ab 18) ----------
export function alterAngabe() {
  const uid = nutzerId();
  const a = uid ? jsonLies(ALTER_SCHLUESSEL) : null;
  return a && typeof a === 'object' && a.uid === uid && typeof a.ab18 === 'boolean' ? a.ab18 : null;
}
export function setzeAlterAngabe(ab18) {
  const uid = nutzerId();
  if (!uid) return false;
  if (ab18 === null) { entferne(ALTER_SCHLUESSEL); return true; }
  return jsonSchreib(ALTER_SCHLUESSEL, { uid, ab18: ab18 === true });
}

// ---------- Kauf und Verwaltung ----------
const mailVon = (s) => (s && (s.email || (s.user && s.user.email))) || '';
export function kaufAdresse(produkt, s = sitzung()) {
  const uid = nutzerId(s);
  if (!uid || !produkt || !produkt.kaufLink || !LINK.test(produkt.kaufLink)) return null;
  let u;
  try { u = new URL(produkt.kaufLink); } catch (e) { return null; }
  u.searchParams.set('client_reference_id', uid);
  const mail = mailVon(s);
  if (mail) u.searchParams.set('prefilled_email', mail);
  return u.toString();
}
function portalAdresse(produkt, s = sitzung()) {
  if (!produkt || !produkt.portalLink || !LINK.test(produkt.portalLink)) return null;
  let u;
  try { u = new URL(produkt.portalLink); } catch (e) { return null; }
  const mail = nutzerId(s) ? mailVon(s) : '';
  if (mail) u.searchParams.set('prefilled_email', mail);
  return u.toString();
}

// Neues Fenster (Stripe-Seite); blockiert der Browser es, geht dieselbe Seite dorthin (die Zahlung leitet zurueck)
export function oeffneAdresse(url) {
  let w = null;
  try { w = globalThis.open ? globalThis.open(url, '_blank') : null; } catch (e) { w = null; }
  if (w) { try { w.opener = null; } catch (e) { /* egal */ } return; }
  try { globalThis.location.assign(url); } catch (e) { /* egal */ }
}

export function kaufGestartet() {
  try { const t = Number(lager().getItem(KAUF_SCHLUESSEL)); return Number.isFinite(t) && t > 0 ? t : null; } catch (e) { return null; }
}
export function vergissKauf() { entferne(KAUF_SCHLUESSEL); }

export function kaufOffen() {
  const t = kaufGestartet();
  if (!t) return false;
  const jetzt = uhr();
  if (jetzt - t > NACH_KAUF_MS || jetzt < t) { vergissKauf(); return false; }
  return true;
}
export function kaufStand() { return bestaetigung ? 'prueft' : kaufOffen() ? 'offen' : null; }

function meldeStand(detail) {
  try { if (typeof document !== 'undefined') document.dispatchEvent(new CustomEvent('abo:stand', { detail })); } catch (e) { /* egal */ }
}
const pause = (ms) => new Promise((ok) => setTimeout(ok, ms));

export function bestaetigeKauf() {
  if (bestaetigung) return bestaetigung;
  if (!kaufOffen() || !nutzerId()) return Promise.resolve(false);
  const pausen = [...nachfragen];
  let fertig;
  const serie = new Promise((ok) => { fertig = ok; });
  bestaetigung = serie;            // vor dem ersten Ereignis gesetzt: kaufStand() sagt dort schon 'prueft'
  (async () => {
    const vorher = premiumStand().premium;
    let premium = false;
    try {
      meldeStand({ prueft: true, premium: vorher, bestaetigt: false });
      premium = await istPremium({ neu: true });
      for (const ms of pausen) {
        if (premium || !kaufOffen()) break;
        await pause(ms);
        if (!kaufOffen()) break;
        premium = await istPremium({ neu: true });
      }
      if (premium) vergissKauf();
    } catch (e) {
      premium = false;
    }
    bestaetigung = null;
    meldeStand({ prueft: false, premium, bestaetigt: premium && !vorher });
    fertig(premium);
  })();
  return serie;
}

export function inStoreHuelle() {
  try {
    const c = globalThis.Capacitor;
    return !!(c && typeof c.isNativePlatform === 'function' && c.isNativePlatform());
  } catch (e) { return false; }
}

export async function kaufen({ produkt, oeffne = oeffneAdresse } = {}) {
  if (inStoreHuelle()) return { ok: false, grund: 'store' };
  const s = sitzung();
  if (!nutzerId(s)) return { ok: false, grund: 'abgemeldet' };
  if (alterAngabe() !== true) return { ok: false, grund: 'alter' };
  const p = produkt === undefined ? await ladeProdukt() : produkt;
  if (!p) return { ok: false, grund: 'kein_produkt' };
  const url = kaufAdresse(p, s);
  if (!url) return { ok: false, grund: 'kein_link' };
  try { lager().setItem(KAUF_SCHLUESSEL, String(uhr())); } catch (e) { /* egal */ }
  oeffne(url);
  return { ok: true, url };
}

export async function verwalten({ produkt, oeffne = oeffneAdresse } = {}) {
  if (inStoreHuelle()) return { ok: false, grund: 'store' };
  const p = produkt === undefined ? await ladeProdukt() : produkt;
  if (!p) return { ok: false, grund: 'kein_produkt' };
  const url = portalAdresse(p);
  if (!url) return { ok: false, grund: 'kein_link' };
  oeffne(url);
  return { ok: true, url };
}

export function vergiss() {
  entferne(STAND_SCHLUESSEL);
  entferne(PRODUKT_SCHLUESSEL);
  entferne(ALTER_SCHLUESSEL);
  vergissKauf();
}

// Nach dem Abmelden: was zu einem Konto gehoert (Stand, Altersangabe, offener Kauf), vom Geraet nehmen. Das oeffentliche
// Produkt darf bleiben. Liefert true, wenn etwas entfernt wurde.
export function aufraeumen() {
  if (nutzerId()) return false;
  let weg = false;
  for (const k of [STAND_SCHLUESSEL, ALTER_SCHLUESSEL, KAUF_SCHLUESSEL]) {
    try { if (lager().getItem(k) !== null) { lager().removeItem(k); weg = true; } } catch (e) { /* egal */ }
  }
  return weg;
}

// Satz fuer den Dialog "Konto löschen" (Integration, js/daten.js loescheKontoDialog): Das Loeschen kuendigt nicht.
export function aboHinweisZumLoeschen(st = premiumStand()) {
  if (!st.premium || st.quelle !== 'stripe' || st.status !== 'aktiv') return '';
  return A('loeschen');
}

// ---------- Oberflaeche fuer andere Pakete ----------
export function oeffneTrainer({ app = null } = {}) {
  return import('./pakete/abo/trainer.js').then((m) => m.zeigeTrainer({ app })).catch((e) => { console.error('Trainer-Blatt nicht geladen', e); });
}

export function premiumHinweis(el, was = '', { app = null } = {}) {
  if (typeof document === 'undefined') return null;
  // Fairness 13 und Regel 9: nie ein Kaufhinweis in der Partie, im Ergebnis oder in einer Lektion
  if (OHNE_HINWEIS_SCREENS.includes(document.documentElement.dataset.screen)) return null;
  stelleAboCssSicher();
  const h = document.createElement('div');
  h.className = 'premium-hinweis';
  h.setAttribute('role', 'note');
  h.dataset.premium = String(was || '').slice(0, 80);
  h.innerHTML = `<span class="ph-zeichen" aria-hidden="true">${icon('stern')}</span>
    <p class="ph-text"><b></b><span>${esc(A('teil'))}</span></p>
    <button class="knopf ph-mehr dr" type="button">${esc(A('mehr'))}</button>`;
  h.querySelector('.ph-text b').textContent = String(was || A('funktion'));
  h.querySelector('.ph-mehr').addEventListener('click', () => { oeffneTrainer({ app }); });
  if (el && typeof el.appendChild === 'function') {
    for (const alt of [...(el.children || [])]) if (alt.classList && alt.classList.contains('premium-hinweis')) alt.remove();
    el.appendChild(h);
  }
  return h;
}

// Optik des Pakets (css/pakete/abo.css) einmal nachladen; index.html kennt Paket-Stylesheets nicht
export function stelleAboCssSicher() {
  if (typeof document === 'undefined' || document.querySelector('link[data-paket-css="abo"]')) return;
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = new URL('../css/pakete/abo.css', import.meta.url).href;
  l.dataset.paketCss = 'abo';
  document.head.appendChild(l);
}
