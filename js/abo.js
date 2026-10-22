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
//   kaufAdresse(produkt, sitzung) -> string | null   kauf_link + ?client_reference_id=<Nutzer-ID>&prefilled_email=...,
//       nur mit Anmeldung (der Webhook ordnet den Kauf ueber client_reference_id dem Konto zu)
//   inStoreHuelle() -> boolean   true in der App-Store-/Play-Huelle (Capacitor, native/). Dort duerfen digitale Abos nur
//       ueber den In-App-Kauf des Stores laufen (Apple 3.1.1, Google Play Billing): kaufen() und verwalten() tun dort nichts
//       (grund 'store'), das Blatt zeigt keinen Kauf- und keinen Verwalten-Knopf. Der Premium-Stand gilt trotzdem.
//   kaufen({ produkt, oeffne } = {}) -> Promise<{ ok, url? , grund? }>   grund: 'store' | 'abgemeldet' | 'kein_produkt' | 'kein_link'
//       Mit produkt (schon geladen) laeuft alles bis zum Oeffnen ohne await: so bleibt der Klick eine Nutzergeste
//       und Safari blockiert das neue Fenster nicht. Merkt sich den Kauf (kaufGestartet), damit das Paket nach der
//       Rueckkehr neu fragt.
//   verwalten({ produkt, oeffne } = {}) -> Promise<{ ok, url?, grund? }>   portal_link (+ prefilled_email); grund 'store' in der Huelle
//   kaufGestartet() -> ms | null, vergissKauf()
//   oeffneTrainer({ app } = {}) -> Promise   oeffnet das Blatt "Crownmate Trainer" (laedt js/pakete/abo/trainer.js)
//   premiumHinweis(el, was, { app } = {}) -> HTMLElement | null
//       Ruhiger Hinweis fuer andere Pakete, dort wo eine Premium-Funktion gesperrt ist, z. B.
//         premiumHinweis(box, 'Coach-Erklärungen in ganzen Sätzen', { app });
//       Haengt div.premium-hinweis[data-premium] an el (ersetzt einen vorigen Hinweis in el) und liefert es. Knopf
//       "Mehr zum Trainer" oeffnet das Blatt. In der Partie (und damit im Ergebnis) zeigt er nichts und liefert null
//       (Fairness 13). Das Paket bringt die Optik (css/pakete/abo.css); premiumHinweis laedt sie bei Bedarf selbst.
//   setzeAboFetch(fn), setzeAboUhr(fn)   nur fuer Tests
//   vergiss()   Zwischenspeicher leeren (z. B. nach dem Abmelden)
//
// Speicher (bewusst AUSSERHALB von schach-arena:v1:, damit der Stand weder in die Cloud-Sicherung noch in eine
// Export-Datei wandert und beim Laden eines Cloud-Spielstands nicht ueberschrieben wird; er gehoert zur Sitzung):
//   schach-arena:abo:stand    { uid, premium, status, plan, gueltigBis, quelle, geprueftAm }
//   schach-arena:abo:produkt  { id, produkt, geholtAm }
//   schach-arena:abo:kauf     Zeitpunkt (ms) des letzten Kauf-Starts
import { SUPABASE_URL, SUPABASE_KEY } from './konto-config.js';
import { sitzung, erneuereSitzung } from './konto.js';
import { icon } from './ui/icons.js';

export const PRODUKT_ID = 'trainer';
export const STAND_SCHLUESSEL = 'schach-arena:abo:stand';
export const PRODUKT_SCHLUESSEL = 'schach-arena:abo:produkt';
export const KAUF_SCHLUESSEL = 'schach-arena:abo:kauf';
export const PRUEF_MS = 10 * 60 * 1000;
export const PRODUKT_MS = 60 * 60 * 1000;

let fetchFn = (...a) => fetch(...a);
let uhr = () => Date.now();
let laufend = null;
export function setzeAboFetch(fn) { fetchFn = fn || ((...a) => fetch(...a)); }
export function setzeAboUhr(fn) { uhr = typeof fn === 'function' ? fn : () => Date.now(); }

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
  if (!s) throw new Error('Nicht angemeldet.');
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
    const f = new Error('Keine Verbindung.'); f.offline = true; throw f;
  }
  let d = null;
  if (r.status !== 204) { try { d = await r.json(); } catch (e) { /* leer */ } }
  if (!r.ok) { const f = new Error((d && (d.message || d.msg)) || `Serverfehler (${r.status})`); f.status = r.status; throw f; }
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
    return p;
  } catch (e) {
    return passt ? c.produkt || null : null;
  }
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
  vergissKauf();
}

// ---------- Oberflaeche fuer andere Pakete ----------
export function oeffneTrainer({ app = null } = {}) {
  return import('./pakete/abo/trainer.js').then((m) => m.zeigeTrainer({ app })).catch((e) => { console.error('Trainer-Blatt nicht geladen', e); });
}

export function premiumHinweis(el, was = '', { app = null } = {}) {
  if (typeof document === 'undefined') return null;
  // Fairness 13: nie ein Kaufhinweis in der Partie oder im Ergebnis
  if (document.documentElement.dataset.screen === 'partie') return null;
  stelleAboCssSicher();
  const h = document.createElement('div');
  h.className = 'premium-hinweis';
  h.setAttribute('role', 'note');
  h.dataset.premium = String(was || '').slice(0, 80);
  h.innerHTML = `<span class="ph-zeichen" aria-hidden="true">${icon('stern')}</span>
    <p class="ph-text"><b></b><span>Teil von Crownmate Trainer. Alles andere bleibt gratis.</span></p>
    <button class="knopf ph-mehr dr" type="button">Mehr zum Trainer</button>`;
  h.querySelector('.ph-text b').textContent = String(was || 'Diese Funktion');
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
