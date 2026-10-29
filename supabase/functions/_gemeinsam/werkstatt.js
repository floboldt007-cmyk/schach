// Limitierte Editionen der Werkstatt, Server-Teil Etappe 1 (nur Stripe-Testmodus, ohne Oberflaeche): die ganze Logik
// der Edge Functions werkstatt-kasse und werkstatt-webhook als reines ES-Modul, damit sie in Node testbar ist
// (tests/server-werkstatt.test.mjs). Die Huellen supabase/functions/werkstatt-kasse/index.ts und
// supabase/functions/werkstatt-webhook/index.ts lesen nur die Anfrage, rufen verarbeiteKasse() bzw. verarbeiteWebhook()
// und schreiben die Antwort. Gebraucht werden nur fetch, URLSearchParams, JSON und (fuer die Signatur) WebCrypto; das
// gibt es in Deno und in Node. Keine Stripe-Bibliothek: zwei REST-Aufrufe (Checkout Session anlegen, erstatten).
//
// Datenbank: supabase/werkstatt-schema.sql. Die Regeln (Auflage, Schalter, Alter, ein Kauf je Konto, Nummern,
// Einfrieren) stehen dort; dieses Modul vertraut der Datenbank und prueft nur Form, Anmeldung und Stripe.
//
// Ablauf Kasse (verarbeiteKasse): CORS-Vorabfrage -> nur POST -> Einstellungen (nur ein eingeschraenkter TEST-Schluessel
// rk_test_..., Live erst in Etappe 6) -> Anmeldung (Bearer) -> Groesse und JSON -> Eingabe { produkt, textversion,
// zustimmung_sofort: true, kenntnis_widerruf: true } -> Nutzer ueber /auth/v1/user (die Nutzer-ID kommt NUR aus dem
// geprueften Token, die E-Mail muss bestaetigt sein) -> rpc/edition_reserviere (Schalter, Alter, Stand, ein Kauf je
// Konto) -> hat die Reservierung schon eine Kasse: dieselbe Adresse zurueck -> Kassenschluss pruefen -> Stripe
// POST /v1/checkout/sessions (mode=payment, Menge 1, nur Karte, expires_at = Reservierung + 31 Minuten, Metadaten mit der
// Reservierung an Sitzung und Zahlung, Idempotency-Key je Reservierung) -> rpc/edition_kasse_setzen -> 200 { kassen_url }.
//   Stripe antwortet nicht oder mit 5xx/429/409: einmal mit DEMSELBEN Key und derselben Anfrage wiederholen. Bleibt es
//   unklar, bleibt die Reservierung stehen (503): Ein neuer Versuch der App bekommt ueber denselben Key dieselbe Kasse,
//   und eine Kasse, die es doch gibt, meldet sich nach Ablauf mit checkout.session.expired. Sofort freigeben koennte ein
//   Stueck zweimal verkaufen. Lehnt Stripe sicher ab (4xx), gibt es keine Kasse: rpc/edition_kasse_abbrechen.
//
// Ablauf Webhook (verarbeiteWebhook): nur POST -> Groesse -> Signatur (pruefeSignatur aus stripe.js, eigenes Geheimnis
// STRIPE_WERKSTATT_WEBHOOK_SECRET) -> JSON -> auswertenEdition -> rpc/edition_stripe_ereignis -> sagt die Datenbank
// "erstatten" (Ueberverkauf, Doppelzahlung, falscher Betrag, Konto geloescht ...): Stripe POST /v1/refunds mit
// Idempotency-Key je Zahlung und metadata[grund], danach rpc/edition_erstattung_gesendet -> 200. Scheitert etwas, 500:
// Stripe stellt bis zu 3 Tage erneut zu, die Datenbank liefert dann das gespeicherte Ergebnis, die Erstattung wird mit
// demselben Key wiederholt (Stripe zahlt nie doppelt aus). Abo-Kaeufe (mode=subscription) und fremde Kassen ohne die
// Metadaten dieser Werkstatt werden ignoriert (200), der Abo-Webhook (stripe.js) bleibt unberuehrt.
//
// API:
//   KASSE_S = 1860              Lebensdauer einer Kasse und Abstand des Kassenschlusses zum Ende (31 Minuten: Stripe
//                               verlangt mindestens 30, eine Minute Puffer; gleiche Zahl wie edition_kassenschluss)
//   MAX_KOERPER_KASSE = 4096, MAX_KOERPER_WEBHOOK = 524288
//   STRIPE_API, RUECKKEHR_STANDARD, META_RESERVIERUNG, META_PRODUKT, TYPEN, GRUENDE, KENNUNGEN, TEXTE, KOPF
//   stripeArt(schluessel) -> 'test' | 'live' | 'falsch' | 'fehlt'   nur rk_test_ ist in Etappe 1 bis 5 erlaubt
//   rueckkehrAus(wert) -> https-Adresse | null                       Secret WERKSTATT_RUECKKEHR, sonst die Live-Seite
//   pruefeKaufEingabe(daten) -> { ok, eingabe } | { ok: false, grund }
//   kassenParameter({ reservierung, produkt, stripe_preis, ablauf_s, rueckkehr }) -> URLSearchParams (feste Reihenfolge)
//   erstattungsParameter({ zahlung, grund, reservierung }) -> URLSearchParams
//   auswertenEdition(ereignis) -> { daten } | { ignoriert: grund }
//       daten sind genau die Parameter von public.edition_stripe_ereignis: { ereignis_id, typ, erstellt, reservierung,
//       sitzung, zahlung, zahlstatus, betrag, waehrung, erstattet, grund, streit }
//   verarbeiteKasse({ methode, koerper, autorisierung }, umgebung, { fetch, jetzt, protokoll })
//       umgebung: { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY?, STRIPE_RK, WERKSTATT_RUECKKEHR? }
//       Antworten immer JSON mit CORS: 200 { kassen_url, reservierung, kasse_bis, neu }, 204 OPTIONS,
//       400 eingabe | zustimmung, 401 anmeldung, 403 email | alter, 404 unbekannt, 405 methode, 409 gesperrt |
//       noch_nicht | beendet | ausverkauft | nicht_verfuegbar | besitz | kasse_abgelaufen, 413 eingabe,
//       502 stripe (abgelehnt, Reservierung frei), 503 nicht_eingerichtet | server | stripe (unklar, Reservierung bleibt).
//       Jede Fehlerantwort { fehler, text, text_en }.
//   verarbeiteWebhook({ methode, koerper, signatur }, umgebung, { fetch, jetzt, protokoll })
//       umgebung: { STRIPE_WERKSTATT_WEBHOOK_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, STRIPE_RK (nur fuer
//       Erstattungen) }. 405, 413, 400 Signatur/JSON, 200 verbucht oder ignoriert, 500 Einstellungen, Datenbank oder
//       Erstattung (Stripe wiederholt). Die Antwort enthaelt nie Geheimnisse oder personenbezogene Daten.
//   jetzt immer in Millisekunden (Date.now()).
// Protokoll (protokoll(zeile)): nur Kennungen und Statuszahlen, nie Nutzer-IDs, E-Mails, Schluessel oder Adressen.
import { pruefeSignatur, dienstKopf } from './stripe.js';

export const KASSE_S = 31 * 60;
export const MAX_KOERPER_KASSE = 4096;
export const MAX_KOERPER_WEBHOOK = 512 * 1024;
export const STRIPE_API = 'https://api.stripe.com/v1';
export const RUECKKEHR_STANDARD = 'https://floboldt007-cmyk.github.io/schach/';
export const META_RESERVIERUNG = 'crownmate_reservierung';
export const META_PRODUKT = 'crownmate_produkt';
export const TYPEN = Object.freeze([
  'checkout.session.completed',
  'checkout.session.expired',
  'charge.refunded',
  'charge.dispute.created',
  'charge.dispute.closed',
]);
// Gruende an einer Erstattung (metadata[grund]): die automatischen aus edition_stripe_ereignis und die von Hand
// (widerruf, kulanz). Nur "widerruf" macht aus einer vollen Erstattung den Status "widerrufen".
export const GRUENDE = Object.freeze(['widerruf', 'kulanz', 'ausverkauft', 'endzahl', 'doppelt', 'betrag', 'sitzung',
  'konto_geloescht', 'unbekannt']);

// Kennungen aus edition_reserviere (supabase/werkstatt-schema.sql) -> [HTTP-Status, Fehler fuer die App]
export const KENNUNGEN = Object.freeze({
  EDITION_EINGABE: [400, 'eingabe'],
  EDITION_ZUSTIMMUNG: [400, 'zustimmung'],
  EDITION_EMAIL: [403, 'email'],
  EDITION_ALTER: [403, 'alter'],
  EDITION_UNBEKANNT: [404, 'unbekannt'],
  EDITION_GESPERRT: [409, 'gesperrt'],
  EDITION_NOCH_NICHT: [409, 'noch_nicht'],
  EDITION_BEENDET: [409, 'beendet'],
  EDITION_AUSVERKAUFT: [409, 'ausverkauft'],
  EDITION_NICHT_VERFUEGBAR: [409, 'nicht_verfuegbar'],
  EDITION_SCHON_IM_BESITZ: [409, 'besitz'],
});

// Rueckfall-Texte (die App hat spaeter eigene). Ruhig, ohne Druck: keine Restzahl, kein "nur noch", keine Uhr.
export const TEXTE = Object.freeze({
  methode: { de: 'Diese Anfrage geht nur per POST.', en: 'This request only accepts POST.' },
  nicht_eingerichtet: { de: 'Der Kauf ist noch nicht eingerichtet.', en: 'Purchasing is not set up yet.' },
  anmeldung: { de: 'Bitte melde dich an.', en: 'Please sign in.' },
  eingabe: { de: 'Die Anfrage ist ungültig.', en: 'The request is invalid.' },
  zustimmung: { de: 'Bitte bestätige beide Erklärungen zum Widerruf.', en: 'Please confirm both statements about the right of withdrawal.' },
  email: { de: 'Bitte bestätige zuerst deine E-Mail-Adresse.', en: 'Please confirm your email address first.' },
  alter: { de: 'Editionen gibt es nur für Konten ab 18.', en: 'Editions are only available to accounts aged 18 or over.' },
  unbekannt: { de: 'Diese Edition gibt es nicht.', en: 'This edition does not exist.' },
  gesperrt: { de: 'Der Verkauf ist im Moment geschlossen.', en: 'Sales are closed at the moment.' },
  noch_nicht: { de: 'Der Verkauf hat noch nicht begonnen.', en: 'Sales have not started yet.' },
  beendet: { de: 'Der Verkauf ist beendet.', en: 'Sales have ended.' },
  ausverkauft: { de: 'Ausverkauft.', en: 'Sold out.' },
  nicht_verfuegbar: { de: 'Im Moment nicht verfügbar.', en: 'Not available at the moment.' },
  besitz: { de: 'Diese Edition gehört dir schon.', en: 'You already own this edition.' },
  kasse_abgelaufen: { de: 'Deine Kasse ist abgelaufen. Bitte versuch es gleich noch einmal.', en: 'Your checkout has expired. Please try again in a moment.' },
  server: { de: 'Der Server ist gerade nicht erreichbar. Bitte versuch es später noch einmal.', en: 'The server is not reachable right now. Please try again later.' },
  stripe: { de: 'Die Zahlungsseite ist gerade nicht erreichbar. Bitte versuch es später noch einmal.', en: 'The payment page is not reachable right now. Please try again later.' },
});

const MUSTER = Object.freeze({
  evt: /^evt_[A-Za-z0-9]{1,200}$/,
  cs: /^cs_[A-Za-z0-9_]{1,250}$/,
  pi: /^pi_[A-Za-z0-9]{1,200}$/,
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  produkt: /^[a-z0-9-]{2,40}$/,
  textversion: /^[a-z0-9][a-z0-9._-]{0,39}$/,
  preis: /^price_[A-Za-z0-9]{1,200}$/,
  waehrung: /^[a-z]{3}$/,
  wort: /^[a-z_]{1,40}$/,
  kasse: /^https:\/\/checkout\.stripe\.com\/[^\s<>"'`]{1,1900}$/,
});

// ---------------------------------------------------------------------------
// Einstellungen
// ---------------------------------------------------------------------------
// Nur ein eingeschraenkter Schluessel (rk_) und in Etappe 1 bis 5 nur aus dem Testmodus. Ein voller Secret Key (sk_)
// ist immer falsch. Live-Schluessel schaltet erst Etappe 6 frei (bewusste Code-Aenderung, kein Secret).
export function stripeArt(schluessel) {
  const s = String(schluessel || '').trim();
  if (!s) return 'fehlt';
  if (/^rk_test_[A-Za-z0-9]{10,250}$/.test(s)) return 'test';
  if (/^rk_live_[A-Za-z0-9]{10,250}$/.test(s)) return 'live';
  return 'falsch';
}

export function rueckkehrAus(wert) {
  const w = String(wert || '').trim();
  if (!w) return RUECKKEHR_STANDARD;
  return /^https:\/\/[^\s<>"'`#?]{3,300}$/.test(w) ? w : null;
}

// ---------------------------------------------------------------------------
// Antworten
// ---------------------------------------------------------------------------
export const KOPF = Object.freeze({
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  // Die App laeuft auf GitHub Pages, Supabase auf einer anderen Adresse. Angemeldet wird per Bearer-Token, nicht per
  // Cookie: "*" ist deshalb unbedenklich (wie in coach.js).
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Max-Age': '86400',
});
const WEBHOOK_KOPF = Object.freeze({ 'Content-Type': 'application/json; charset=utf-8' });

function antwort(status, daten, kopf = KOPF) {
  return { status, kopf: { ...kopf }, koerper: JSON.stringify(daten) };
}
function fehler(status, kennung, extra = {}) {
  const t = TEXTE[kennung] || TEXTE.server;
  return antwort(status, { fehler: kennung, text: t.de, text_en: t.en, ...extra });
}

function bearer(kopf) {
  const m = /^Bearer\s+([A-Za-z0-9._~+/=-]{20,4096})$/.exec(String(kopf || '').trim());
  return m ? m[1] : null;
}

// PostgREST meldet raise exception als 400 mit { code: 'P0001', message: 'EDITION_...' }
async function rpc(holen, basis, schluessel, name, daten) {
  try {
    const r = await holen(`${basis}/rest/v1/rpc/${name}`, { method: 'POST', headers: dienstKopf(schluessel), body: JSON.stringify(daten) });
    if (!r) return { ok: false, status: null };
    if (!r.ok) {
      let d = null;
      try { d = await r.json(); } catch (e) { /* ohne Koerper */ }
      const m = d && typeof d === 'object' && typeof d.message === 'string' ? d.message : '';
      return { ok: false, status: r.status, kennung: /^EDITION_[A-Z_]{1,40}$/.test(m) ? m : null };
    }
    return { ok: true, wert: await r.json() };
  } catch (e) {
    return { ok: false, status: null };
  }
}

// Ein Aufruf der Stripe-API (form-kodiert). wiederholen: Stripe hat nicht sicher geantwortet (Netz, 5xx, 429, 409 =
// derselbe Key laeuft gerade, oder ein Idempotenz-Fehler), dann darf nichts freigegeben werden.
async function stripeAufruf(holen, pfad, parameter, schluessel, idempotenz) {
  try {
    const r = await holen(`${STRIPE_API}${pfad}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${schluessel}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Idempotency-Key': idempotenz,
      },
      body: parameter.toString(),
    });
    if (!r) return { ok: false, wiederholen: true, status: null };
    let d = null;
    try { d = await r.json(); } catch (e) { /* ohne Koerper */ }
    if (r.ok) return { ok: true, status: r.status, daten: d };
    const fehlerArt = d && d.error && typeof d.error === 'object' ? d.error : {};
    const code = typeof fehlerArt.code === 'string' ? fehlerArt.code.slice(0, 60) : '';
    const typ = typeof fehlerArt.type === 'string' ? fehlerArt.type.slice(0, 60) : '';
    const wiederholen = r.status >= 500 || r.status === 429 || r.status === 409 || typ === 'idempotency_error';
    return { ok: false, wiederholen, status: r.status, code, typ };
  } catch (e) {
    return { ok: false, wiederholen: true, status: null };
  }
}

// ---------------------------------------------------------------------------
// Kasse
// ---------------------------------------------------------------------------
export function pruefeKaufEingabe(d) {
  if (!d || typeof d !== 'object' || Array.isArray(d)) return { ok: false, grund: 'form' };
  if (typeof d.produkt !== 'string' || !MUSTER.produkt.test(d.produkt)) return { ok: false, grund: 'produkt' };
  if (typeof d.textversion !== 'string' || !MUSTER.textversion.test(d.textversion)) return { ok: false, grund: 'textversion' };
  // Beide Erklaerungen muessen ausdruecklich true sein (nie vorausgewaehlt, nie "ja" oder 1)
  if (d.zustimmung_sofort !== true || d.kenntnis_widerruf !== true) return { ok: false, grund: 'zustimmung' };
  return { ok: true, eingabe: { produkt: d.produkt, textversion: d.textversion } };
}

// Feste Reihenfolge und nur Werte aus der Reservierung: Jeder Versuch schickt genau dieselbe Anfrage, sonst lehnte
// Stripe den Idempotency-Key ab. Die Rueckkehr-Adresse traegt nur #werkstatt (keine Kennung im Verlauf des Browsers).
export function kassenParameter({ reservierung, produkt, stripe_preis: preis, ablauf_s: ablauf, rueckkehr }) {
  const p = new URLSearchParams();
  p.append('mode', 'payment');
  p.append('line_items[0][price]', preis);
  p.append('line_items[0][quantity]', '1');
  // Nur Karte: eine Lastschrift kann Tage spaeter platzen, dann waere die Nummer schon vergeben
  p.append('payment_method_types[0]', 'card');
  p.append('expires_at', String(ablauf));
  p.append('success_url', `${rueckkehr}#werkstatt`);
  p.append('cancel_url', `${rueckkehr}#werkstatt`);
  p.append(`metadata[${META_RESERVIERUNG}]`, reservierung);
  p.append(`metadata[${META_PRODUKT}]`, produkt);
  p.append(`payment_intent_data[metadata][${META_RESERVIERUNG}]`, reservierung);
  p.append(`payment_intent_data[metadata][${META_PRODUKT}]`, produkt);
  return p;
}

export async function verarbeiteKasse({ methode, koerper, autorisierung } = {}, umgebung = {}, { fetch: holen, jetzt, protokoll } = {}) {
  const log = (zeile) => { try { if (typeof protokoll === 'function') protokoll(zeile); } catch (e) { /* egal */ } };
  if (methode === 'OPTIONS') return { status: 204, kopf: { ...KOPF }, koerper: '' };
  if (methode !== 'POST') return fehler(405, 'methode');
  const basis = String(umgebung.SUPABASE_URL || '').replace(/\/+$/, '');
  const dienst = umgebung.SUPABASE_SERVICE_ROLE_KEY;
  const oeffentlich = umgebung.SUPABASE_ANON_KEY || dienst;
  if (!basis || !dienst) {
    log('werkstatt-kasse nicht_eingerichtet supabase');
    return fehler(503, 'nicht_eingerichtet');
  }
  const art = stripeArt(umgebung.STRIPE_RK);
  if (art !== 'test') {
    log('werkstatt-kasse nicht_eingerichtet STRIPE_RK ' + art);
    return fehler(503, 'nicht_eingerichtet');
  }
  const rueckkehr = rueckkehrAus(umgebung.WERKSTATT_RUECKKEHR);
  if (!rueckkehr) {
    log('werkstatt-kasse nicht_eingerichtet WERKSTATT_RUECKKEHR');
    return fehler(503, 'nicht_eingerichtet');
  }
  const jwt = bearer(autorisierung);
  if (!jwt) return fehler(401, 'anmeldung');
  if (typeof koerper !== 'string' || !koerper) return fehler(400, 'eingabe', { grund: 'form' });
  if (koerper.length > MAX_KOERPER_KASSE) return fehler(413, 'eingabe', { grund: 'gross' });
  let daten = null;
  try { daten = JSON.parse(koerper); } catch (e) { return fehler(400, 'eingabe', { grund: 'json' }); }
  const p = pruefeKaufEingabe(daten);
  if (!p.ok) return p.grund === 'zustimmung' ? fehler(400, 'zustimmung') : fehler(400, 'eingabe', { grund: p.grund });
  const f = holen || globalThis.fetch;
  const t = Number.isFinite(jetzt) ? jetzt : Date.now();

  // Wer kauft? Supabase prueft das Token, die Function vertraut nur dieser Antwort (nie einer ID aus der Anfrage).
  let uid = null;
  let bestaetigt = false;
  try {
    const r = await f(`${basis}/auth/v1/user`, { method: 'GET', headers: { apikey: oeffentlich, Authorization: `Bearer ${jwt}` } });
    if (r && (r.status === 401 || r.status === 403)) {
      let d = null;
      try { d = await r.json(); } catch (e) { /* ohne Koerper */ }
      const meldung = d && typeof d === 'object' ? String(d.message || d.msg || '') : '';
      if (r.status === 401 && /api ?key/i.test(meldung)) {
        log('werkstatt-kasse nicht_eingerichtet apikey');
        return fehler(503, 'nicht_eingerichtet');
      }
      return fehler(401, 'anmeldung');
    }
    if (!r || !r.ok) return fehler(503, 'server');
    const u = await r.json();
    uid = u && typeof u.id === 'string' && MUSTER.uuid.test(u.id) ? u.id.toLowerCase() : null;
    bestaetigt = !!(u && typeof u.email_confirmed_at === 'string' && u.email_confirmed_at);
  } catch (e) {
    return fehler(503, 'server');
  }
  if (!uid) return fehler(401, 'anmeldung');
  if (!bestaetigt) return fehler(403, 'email');

  const res = await rpc(f, basis, dienst, 'edition_reserviere', {
    nutzer: uid, produkt: p.eingabe.produkt, textversion: p.eingabe.textversion, zustimmung_sofort: true, kenntnis_widerruf: true,
  });
  if (!res.ok) {
    const k = res.kennung && KENNUNGEN[res.kennung];
    if (k) {
      log('werkstatt-kasse abgelehnt ' + res.kennung);
      return fehler(k[0], k[1]);
    }
    log('werkstatt-kasse db_fehler ' + (res.status || 'netz'));
    return fehler(503, 'server');
  }
  const r = res.wert;
  if (!r || typeof r !== 'object' || typeof r.reservierung !== 'string' || !MUSTER.uuid.test(r.reservierung)
    || typeof r.stripe_preis !== 'string' || !MUSTER.preis.test(r.stripe_preis)
    || !Number.isInteger(r.stripe_ablauf_s) || !Number.isInteger(r.kassenschluss_s) || !Number.isInteger(r.verkauf_bis_s)) {
    log('werkstatt-kasse db_antwort');
    return fehler(503, 'server');
  }

  // Diese Reservierung hat schon eine Kasse: dieselbe zurueck (Doppelklick, zweiter Tab). Ist sie abgelaufen, kommt
  // checkout.session.expired gleich und gibt das Stueck frei.
  if (typeof r.kassen_url === 'string' && r.kassen_url) {
    if (!MUSTER.kasse.test(r.kassen_url)) return fehler(503, 'server');
    if (Number.isInteger(r.kasse_bis_s) && r.kasse_bis_s * 1000 > t) {
      return antwort(200, { kassen_url: r.kassen_url, reservierung: r.reservierung, kasse_bis: new Date(r.kasse_bis_s * 1000).toISOString(), neu: false });
    }
    return fehler(409, 'kasse_abgelaufen');
  }
  // Kassenschluss: Eine Kasse, die erst jetzt angelegt wuerde, lebte ueber das angekuendigte Ende hinaus.
  if (t >= r.kassenschluss_s * 1000 || r.stripe_ablauf_s > r.verkauf_bis_s) {
    const a = await rpc(f, basis, dienst, 'edition_kasse_abbrechen', { reservierung: r.reservierung });
    log('werkstatt-kasse kassenschluss ' + (a.ok ? a.wert : 'db_fehler'));
    return fehler(409, 'beendet');
  }

  const parameter = kassenParameter({ reservierung: r.reservierung, produkt: p.eingabe.produkt, stripe_preis: r.stripe_preis,
    ablauf_s: r.stripe_ablauf_s, rueckkehr });
  const schluessel = `crownmate-kasse-${r.reservierung}`;
  let s = await stripeAufruf(f, '/checkout/sessions', parameter, umgebung.STRIPE_RK, schluessel);
  if (!s.ok && s.wiederholen) {
    log('werkstatt-kasse stripe_wiederholung ' + (s.status || 'netz'));
    s = await stripeAufruf(f, '/checkout/sessions', parameter, umgebung.STRIPE_RK, schluessel);
  }
  if (s.ok) {
    const k = s.daten || {};
    const id = typeof k.id === 'string' && MUSTER.cs.test(k.id) ? k.id : null;
    const url = typeof k.url === 'string' && MUSTER.kasse.test(k.url) ? k.url : null;
    const bis = Number.isInteger(k.expires_at) && k.expires_at > 0 ? k.expires_at : r.stripe_ablauf_s;
    if (!id || !url) {
      log('werkstatt-kasse stripe_antwort');
      return fehler(503, 'stripe');
    }
    const kasseBis = new Date(bis * 1000).toISOString();
    const g = await rpc(f, basis, dienst, 'edition_kasse_setzen', { reservierung: r.reservierung, sitzung: id, kassen_url: url, kasse_bis: kasseBis });
    if (!g.ok) {
      // Die Kasse gibt es, nur nicht in der Datenbank: Der naechste Versuch bekommt sie ueber denselben Key wieder.
      log('werkstatt-kasse db_fehler kasse_setzen');
      return fehler(503, 'server');
    }
    log('werkstatt-kasse ok ' + (r.neu === true ? 'neu' : 'wieder'));
    return antwort(200, { kassen_url: url, reservierung: r.reservierung, kasse_bis: kasseBis, neu: r.neu === true });
  }
  if (s.wiederholen) {
    log('werkstatt-kasse stripe_unklar ' + (s.status || 'netz'));
    return fehler(503, 'stripe');
  }
  // Stripe hat sicher abgelehnt: Es gibt keine Kasse, das Stueck wird frei.
  const a = await rpc(f, basis, dienst, 'edition_kasse_abbrechen', { reservierung: r.reservierung });
  if (s.status === 401 || s.status === 403) {
    log('werkstatt-kasse nicht_eingerichtet stripe ' + s.status);
    return fehler(503, 'nicht_eingerichtet');
  }
  log(`werkstatt-kasse stripe_abgelehnt ${s.status} ${s.code || '-'} ${a.ok ? a.wert : 'db_fehler'}`);
  return fehler(502, 'stripe');
}

// ---------------------------------------------------------------------------
// Webhook
// ---------------------------------------------------------------------------
const idVon = (x) => (typeof x === 'string' ? x : (x && typeof x === 'object' && typeof x.id === 'string' ? x.id : null));
// Stripe-Zeit (Unix-Sekunden) als Zeitstempel fuer Postgres. Ein Zeitpunkt, kein Kalendertag: toISOString ist richtig.
const zeitstempel = (s) => (Number.isFinite(s) && s > 0 ? new Date(s * 1000).toISOString() : null);
const ganzzahl = (x) => (Number.isInteger(x) && x >= 0 && x <= 100000000 ? x : null);

// Grund einer Erstattung aus den Metadaten der Erstattungen an der Zahlung (nur wenn Stripe sie mitschickt; neuere
// API-Versionen tun das nicht, dann gilt eine volle Erstattung als "erstattet", nie als "widerrufen").
function erstattungsGrund(charge) {
  const liste = charge && charge.refunds && Array.isArray(charge.refunds.data) ? charge.refunds.data : [];
  const neueste = [...liste].filter((x) => x && typeof x === 'object')
    .sort((a, b) => (Number(b.created) || 0) - (Number(a.created) || 0));
  for (const x of neueste) {
    const g = x.metadata && typeof x.metadata.grund === 'string' ? x.metadata.grund : null;
    if (g && GRUENDE.includes(g)) return g;
  }
  return null;
}

export function auswertenEdition(e) {
  if (!e || typeof e !== 'object' || Array.isArray(e)) return { ignoriert: 'form' };
  if (!TYPEN.includes(e.type)) return { ignoriert: 'typ' };
  if (typeof e.id !== 'string' || !MUSTER.evt.test(e.id)) return { ignoriert: 'form' };
  const erstellt = zeitstempel(e.created);
  const o = e.data && e.data.object;
  if (!erstellt || !o || typeof o !== 'object' || Array.isArray(o)) return { ignoriert: 'form' };
  const d = { ereignis_id: e.id, typ: e.type, erstellt, reservierung: null, sitzung: null, zahlung: null, zahlstatus: null,
    betrag: null, waehrung: null, erstattet: null, grund: null, streit: null };
  if (e.type === 'checkout.session.completed' || e.type === 'checkout.session.expired') {
    // Nur Einmalkaeufe dieser Werkstatt. Abo-Kaeufe gehoeren dem Abo-Webhook, fremde Kassen sind nicht unsere.
    if (o.mode !== 'payment') return { ignoriert: 'kein_kauf' };
    const res = o.metadata && typeof o.metadata === 'object' ? o.metadata[META_RESERVIERUNG] : null;
    if (typeof res !== 'string' || !MUSTER.uuid.test(res)) return { ignoriert: 'fremd' };
    if (typeof o.id !== 'string' || !MUSTER.cs.test(o.id)) return { ignoriert: 'form' };
    d.reservierung = res.toLowerCase();
    d.sitzung = o.id;
    if (e.type === 'checkout.session.completed') {
      const zahlung = idVon(o.payment_intent);
      d.zahlung = zahlung && MUSTER.pi.test(zahlung) ? zahlung : null;
      d.zahlstatus = typeof o.payment_status === 'string' && MUSTER.wort.test(o.payment_status) ? o.payment_status : null;
      d.betrag = ganzzahl(o.amount_total);
      d.waehrung = typeof o.currency === 'string' && MUSTER.waehrung.test(o.currency.toLowerCase()) ? o.currency.toLowerCase() : null;
      if (!d.zahlstatus || d.betrag === null || !d.waehrung) return { ignoriert: 'form' };
      // Bezahlt ohne Zahlung kann man weder zuteilen noch erstatten: so kommt es bei Karte nicht vor
      if (d.zahlstatus === 'paid' && !d.zahlung) return { ignoriert: 'keine_zahlung' };
    }
  } else {
    const zahlung = idVon(o.payment_intent);
    if (!zahlung || !MUSTER.pi.test(zahlung)) return { ignoriert: 'keine_zahlung' };
    d.zahlung = zahlung;
    if (e.type === 'charge.refunded') {
      d.betrag = ganzzahl(o.amount);
      d.erstattet = ganzzahl(o.amount_refunded);
      d.waehrung = typeof o.currency === 'string' && MUSTER.waehrung.test(o.currency.toLowerCase()) ? o.currency.toLowerCase() : null;
      if (d.betrag === null || d.erstattet === null) return { ignoriert: 'form' };
      d.grund = erstattungsGrund(o);
    } else {
      d.streit = typeof o.status === 'string' && MUSTER.wort.test(o.status) ? o.status : null;
      if (e.type === 'charge.dispute.closed' && !d.streit) return { ignoriert: 'form' };
    }
  }
  return { daten: d };
}

export function erstattungsParameter({ zahlung, grund, reservierung }) {
  const p = new URLSearchParams();
  p.append('payment_intent', zahlung);
  p.append('metadata[grund]', grund);
  if (reservierung) p.append(`metadata[${META_RESERVIERUNG}]`, reservierung);
  return p;
}

export async function verarbeiteWebhook({ methode, koerper, signatur } = {}, umgebung = {}, { fetch: holen, jetzt, protokoll } = {}) {
  const log = (zeile) => { try { if (typeof protokoll === 'function') protokoll(zeile); } catch (e) { /* egal */ } };
  const aus = (status, daten) => antwort(status, daten, WEBHOOK_KOPF);
  if (methode !== 'POST') return aus(405, { fehler: 'Nur POST' });
  const geheimnis = umgebung.STRIPE_WERKSTATT_WEBHOOK_SECRET;
  const basis = String(umgebung.SUPABASE_URL || '').replace(/\/+$/, '');
  const dienst = umgebung.SUPABASE_SERVICE_ROLE_KEY;
  if (!geheimnis || !basis || !dienst) {
    log('werkstatt-webhook nicht_eingerichtet');
    return aus(500, { fehler: 'Konfiguration unvollstaendig' });
  }
  if (typeof koerper !== 'string' || !koerper) return aus(400, { fehler: 'Kein Inhalt' });
  if (koerper.length > MAX_KOERPER_WEBHOOK) return aus(413, { fehler: 'Anfrage zu gross' });
  const t = Number.isFinite(jetzt) ? jetzt : Date.now();
  const sig = await pruefeSignatur(koerper, signatur, geheimnis, { jetzt: Math.floor(t / 1000) });
  if (!sig.ok) return aus(400, { fehler: 'Signatur ungueltig', grund: sig.grund });
  let ereignis = null;
  try { ereignis = JSON.parse(koerper); } catch (e) { return aus(400, { fehler: 'Kein JSON' }); }
  const a = auswertenEdition(ereignis);
  if (!a.daten) return aus(200, { ok: true, ignoriert: a.ignoriert });
  const f = holen || globalThis.fetch;
  const v = await rpc(f, basis, dienst, 'edition_stripe_ereignis', a.daten);
  if (!v.ok) {
    log('werkstatt-webhook db_fehler ' + (v.kennung || v.status || 'netz'));
    return aus(500, { fehler: 'Datenbank-Fehler', status: v.status || null });
  }
  const w = v.wert && typeof v.wert === 'object' ? v.wert : {};
  const ergebnis = typeof w.ergebnis === 'string' ? w.ergebnis.slice(0, 40) : null;
  if (w.erstatten !== true) {
    log(`werkstatt-webhook ${a.daten.typ} ${ergebnis}${w.doppelt === true ? ' doppelt' : ''}`);
    return aus(200, { ok: true, ergebnis, doppelt: w.doppelt === true });
  }

  // Automatische Erstattung (Ueberverkauf, Doppelzahlung, Betrag, Konto geloescht ...). Derselbe Key je Zahlung: Stripe
  // zahlt nie doppelt aus, auch wenn das Ereignis mehrmals kommt.
  const zahlung = typeof w.zahlung === 'string' && MUSTER.pi.test(w.zahlung) ? w.zahlung : null;
  const grund = typeof w.erstattung_grund === 'string' && GRUENDE.includes(w.erstattung_grund) ? w.erstattung_grund : null;
  if (!zahlung || !grund) {
    log('werkstatt-webhook erstattung_ohne_zahlung');
    return aus(500, { fehler: 'Erstattung unvollstaendig' });
  }
  if (stripeArt(umgebung.STRIPE_RK) !== 'test') {
    log('werkstatt-webhook nicht_eingerichtet STRIPE_RK ' + stripeArt(umgebung.STRIPE_RK));
    return aus(500, { fehler: 'Erstattung nicht eingerichtet' });
  }
  const reservierung = typeof w.reservierung === 'string' && MUSTER.uuid.test(w.reservierung) ? w.reservierung : null;
  const s = await stripeAufruf(f, '/refunds', erstattungsParameter({ zahlung, grund, reservierung }), umgebung.STRIPE_RK,
    `crownmate-erstattung-${zahlung}`);
  const schonErstattet = !s.ok && s.code === 'charge_already_refunded';
  if (!s.ok && !schonErstattet) {
    log(`werkstatt-webhook erstattung_fehler ${s.status || 'netz'} ${s.code || '-'}`);
    return aus(500, { fehler: 'Erstattung fehlgeschlagen' });
  }
  const g = await rpc(f, basis, dienst, 'edition_erstattung_gesendet', { ereignis_id: a.daten.ereignis_id });
  if (!g.ok) {
    log('werkstatt-webhook db_fehler erstattung_gesendet');
    return aus(500, { fehler: 'Datenbank-Fehler' });
  }
  log(`werkstatt-webhook ${a.daten.typ} erstattet ${grund}`);
  return aus(200, { ok: true, ergebnis, erstattet: true, grund });
}
