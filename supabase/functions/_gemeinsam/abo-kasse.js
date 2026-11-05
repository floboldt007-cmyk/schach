// Kasse fuer das Abo "Crownmate Trainer": legt die Stripe-Bezahlseite auf dem Server an, damit die Nutzer-ID nur aus der
// Anmeldung kommt. Bis November 2026 lief der Kauf ueber einen oeffentlichen Zahlungslink, an den die App
// client_reference_id=<Nutzer-ID> haengte; der Webhook glaubte dieser ID, und wer selbst bezahlte, konnte damit das Abo
// eines anderen Kontos umhaengen (Code-Check 05.11.2026, Fund 1). Jetzt steht die ID in den Metadaten der Sitzung
// (META_ABO_NUTZER), und nur die liest der Webhook (stripe.js auswerten). Metadaten setzt nur dieser Server.
//
// Reines ES-Modul wie stripe.js und werkstatt.js, in Node getestet (tests/server-abo-kasse.test.mjs). Die Edge Function
// supabase/functions/abo-kasse/index.ts ist nur die Huelle.
//
// API:
//   MAX_KOERPER = 4096          groessere Anfragen: 413 (die App schickt "{}", gebraucht wird nichts daraus)
//   FENSTER_MS = 600000         Doppelklick und zweiter Tab innerhalb von 10 Minuten bekommen dieselbe Bezahlseite
//                               (gleicher Idempotency-Key, gleiche Parameter)
//   GUELTIG_MS = 2700000        Bezahlseite laeuft 45 Minuten nach Fensterbeginn ab (expires_at, also 35 bis 45 Minuten
//                               nach dem Anlegen; Stripe verlangt mindestens 30). Sonst lebten alte Seiten 24 Stunden,
//                               und wer zwei davon bezahlte, haette zwei Abos (Pruefer 05.11.2026).
//   ZUSTIMMUNG_TEXT             Text am AGB-Haekchen der Bezahlseite (Pflicht-Haekchen, nie vorausgewaehlt)
//   kassenParameter({ uid, preis, kunde, email, rueckkehr, ablauf }) -> URLSearchParams   feste Reihenfolge (Idempotenz)
//   verarbeite({ methode, koerper, autorisierung }, umgebung, { fetch, jetzt, protokoll }) -> Promise<{ status, kopf, koerper }>
//       umgebung: { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY?, ABO_STRIPE_RK, ABO_STRIPE_PREIS, ABO_RUECKKEHR? }
//       200 { kassen_url }   204 OPTIONS   401 'anmeldung'   400/413 'eingabe'   405 'methode'
//       409 'schon_premium' (kein zweites Abo) | 'kauf_laeuft' (Kauf verbucht, Abo-Ereignis von Stripe steht noch aus)
//       502 'stripe' (Stripe hat abgelehnt)
//       503 'nicht_eingerichtet' | 'server' | 'stripe' (Stripe nicht sicher erreicht)
//       'nicht_eingerichtet' auch, wenn Schluessel und produkte.kauf_link nicht zum selben Modus gehoeren: Die App zeigt
//       "Testmodus" nach kauf_link, also darf ein rk_live_ nie neben einem Test-Schalter stehen und umgekehrt.
//       Die Antwort enthaelt nie Schluessel, Nutzer-ID oder E-Mail.

import { dienstKopf, META_ABO_NUTZER } from './stripe.js';
import { KOPF, bearer, stripeAufruf, stripeArt, rueckkehrAus } from './werkstatt.js';

export const MAX_KOERPER = 4096;
export const FENSTER_MS = 10 * 60 * 1000;
export const GUELTIG_MS = 45 * 60 * 1000;
// Rechtspruefung 05.11.2026: Das Abo ist eine Dienstleistung. Nach § 356 Abs. 5 BGB erlischt das Widerrufsrecht erst,
// wenn sie VOLLSTAENDIG erbracht ist, bei einem Monatsabo also nicht in den 14 Tagen. Der fruehere Satz "ich verliere
// damit mein Widerrufsrecht" war deshalb falsch. Richtig: Wer den sofortigen Beginn verlangt, schuldet bei einem
// Widerruf anteiligen Wertersatz (§ 357a Abs. 2 BGB, Art. 246a § 1 Abs. 2 Satz 1 Nr. 3 EGBGB, EuGH C-641/19).
// Aenderungen nur hier; die Widerrufsbelehrung selbst steht in den AGB.
export const ZUSTIMMUNG_TEXT = 'Ich stimme den AGB zu und verlange ausdrücklich, dass Crownmate Trainer sofort beginnt. '
  + 'Mir ist bekannt, dass ich bei einem Widerruf innerhalb von 14 Tagen für die Zeit bis dahin einen anteiligen Betrag '
  + 'zahle (§ 357a Abs. 2 BGB).';

const MUSTER = Object.freeze({
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  preis: /^price_[A-Za-z0-9]{1,200}$/,
  cus: /^cus_[A-Za-z0-9]{1,200}$/,
  cs: /^cs_(test|live)_[A-Za-z0-9]{1,300}$/,
  kasse: /^https:\/\/checkout\.stripe\.com\/[^\s<>"'`]{1,5000}$/,
  testSchalter: /^https:\/\/buy\.stripe\.com\/test_/,
  email: /^[^\s@<>"']{1,200}@[^\s@<>"']{1,200}\.[A-Za-z]{2,63}$/,
});

const TEXTE = Object.freeze({
  methode: { de: 'Nur POST.', en: 'POST only.' },
  anmeldung: { de: 'Bitte melde dich an.', en: 'Please sign in.' },
  eingabe: { de: 'Die Anfrage ist ungültig.', en: 'The request is invalid.' },
  schon_premium: { de: 'Du hast den Trainer schon.', en: 'You already have the Trainer.' },
  kauf_laeuft: { de: 'Dein Kauf wird gerade verbucht.', en: 'Your purchase is being processed.' },
  nicht_eingerichtet: { de: 'Der Kauf ist noch nicht eingerichtet.', en: 'Purchasing is not set up yet.' },
  stripe: { de: 'Die Bezahlseite ist gerade nicht erreichbar.', en: 'The payment page is not available right now.' },
  server: { de: 'Der Server ist gerade nicht erreichbar.', en: 'The server is not available right now.' },
});

function antwort(status, daten) {
  return { status, kopf: { ...KOPF }, koerper: JSON.stringify(daten) };
}
function fehler(status, kennung) {
  const t = TEXTE[kennung] || TEXTE.server;
  return antwort(status, { fehler: kennung, text: t.de, text_en: t.en });
}

// Feste Reihenfolge und nur Werte vom Server: Jeder Versuch im selben Fenster schickt genau dieselbe Anfrage, sonst
// lehnte Stripe den Idempotency-Key ab. kunde (cus_) und email schliessen sich bei Stripe aus.
export function kassenParameter({ uid, preis, kunde, email, rueckkehr, ablauf }) {
  const p = new URLSearchParams();
  p.append('mode', 'subscription');
  p.append('line_items[0][price]', preis);
  p.append('line_items[0][quantity]', '1');
  p.append('client_reference_id', uid);
  p.append(`metadata[${META_ABO_NUTZER}]`, uid);
  p.append(`subscription_data[metadata][${META_ABO_NUTZER}]`, uid);
  if (kunde) p.append('customer', kunde);
  else if (email) p.append('customer_email', email);
  // AGB-Zustimmung als Pflicht (braucht die AGB-Adresse in Stripe unter Einstellungen > Oeffentliche Details)
  p.append('consent_collection[terms_of_service]', 'required');
  p.append('custom_text[terms_of_service_acceptance][message]', ZUSTIMMUNG_TEXT);
  p.append('locale', 'auto');
  if (Number.isInteger(ablauf) && ablauf > 0) p.append('expires_at', String(ablauf));
  p.append('success_url', `${rueckkehr}#einstellungen`);
  p.append('cancel_url', `${rueckkehr}#einstellungen`);
  return p;
}

async function rpc(holen, basis, schluessel, name, daten) {
  try {
    const r = await holen(`${basis}/rest/v1/rpc/${name}`, { method: 'POST', headers: dienstKopf(schluessel), body: JSON.stringify(daten) });
    if (!r || !r.ok) return { ok: false };
    return { ok: true, wert: await r.json() };
  } catch (e) {
    return { ok: false };
  }
}

// Stripe-Kunde aus einem frueheren Abo: dann bleibt es ein Kunde (Rechnungen, Kundenportal an einer Stelle).
// laeuft: Der Kauf ist verbucht (abo_id gesetzt), das erste Abo-Ereignis aber noch nicht da (stand_zeit null), etwa bei
// einer Lastschrift. ist_premium_von sagt dann noch nein, eine zweite Bezahlseite gaebe aber ein zweites Abo.
async function bisherigerKunde(holen, basis, schluessel, uid) {
  try {
    const r = await holen(`${basis}/rest/v1/abos?select=kunde_id,abo_id,stand_zeit&user_id=eq.${encodeURIComponent(uid)}`, { method: 'GET', headers: dienstKopf(schluessel) });
    if (!r || !r.ok) return { ok: false };
    const d = await r.json();
    const z = Array.isArray(d) ? d[0] : null;
    return {
      ok: true,
      kunde: z && typeof z.kunde_id === 'string' && MUSTER.cus.test(z.kunde_id) ? z.kunde_id : null,
      laeuft: !!(z && typeof z.abo_id === 'string' && z.abo_id && z.stand_zeit == null),
    };
  } catch (e) {
    return { ok: false };
  }
}

// Modus des Schalters produkte.kauf_link (Zeile trainer): 'test', 'live' oder null (keine Zeile, kein Link)
async function schalterModus(holen, basis, schluessel) {
  try {
    const r = await holen(`${basis}/rest/v1/produkte?select=kauf_link&id=eq.trainer`, { method: 'GET', headers: dienstKopf(schluessel) });
    if (!r || !r.ok) return { ok: false };
    const d = await r.json();
    const z = Array.isArray(d) ? d[0] : null;
    const link = z && typeof z.kauf_link === 'string' ? z.kauf_link.trim() : '';
    return { ok: true, modus: !link ? null : MUSTER.testSchalter.test(link) ? 'test' : 'live' };
  } catch (e) {
    return { ok: false };
  }
}

export async function verarbeite({ methode, koerper, autorisierung } = {}, umgebung = {}, { fetch: holen, jetzt, protokoll } = {}) {
  const log = (zeile) => { try { if (typeof protokoll === 'function') protokoll(zeile); } catch (e) { /* egal */ } };
  if (methode === 'OPTIONS') return { status: 204, kopf: { ...KOPF }, koerper: '' };
  if (methode !== 'POST') return fehler(405, 'methode');
  const basis = String(umgebung.SUPABASE_URL || '').replace(/\/+$/, '');
  const dienst = umgebung.SUPABASE_SERVICE_ROLE_KEY;
  const oeffentlich = umgebung.SUPABASE_ANON_KEY || dienst;
  if (!basis || !dienst) {
    log('abo-kasse nicht_eingerichtet supabase');
    return fehler(503, 'nicht_eingerichtet');
  }
  // Nur ein eingeschraenkter Schluessel (rk_test_ oder rk_live_), nie ein voller Secret Key
  const art = stripeArt(umgebung.ABO_STRIPE_RK);
  if (art !== 'test' && art !== 'live') {
    log('abo-kasse nicht_eingerichtet ABO_STRIPE_RK ' + art);
    return fehler(503, 'nicht_eingerichtet');
  }
  const preis = String(umgebung.ABO_STRIPE_PREIS || '').trim();
  if (!MUSTER.preis.test(preis)) {
    log('abo-kasse nicht_eingerichtet ABO_STRIPE_PREIS');
    return fehler(503, 'nicht_eingerichtet');
  }
  const rueckkehr = rueckkehrAus(umgebung.ABO_RUECKKEHR);
  if (!rueckkehr) {
    log('abo-kasse nicht_eingerichtet ABO_RUECKKEHR');
    return fehler(503, 'nicht_eingerichtet');
  }
  const jwt = bearer(autorisierung);
  if (!jwt) return fehler(401, 'anmeldung');
  // Aus dem Koerper wird nichts gelesen (auch keine Nutzer-ID); er muss nur klein und JSON sein
  if (typeof koerper === 'string' && koerper.length > MAX_KOERPER) return fehler(413, 'eingabe');
  if (typeof koerper === 'string' && koerper.trim()) {
    try { JSON.parse(koerper); } catch (e) { return fehler(400, 'eingabe'); }
  }
  const f = holen || globalThis.fetch;
  const t = Number.isFinite(jetzt) ? jetzt : Date.now();

  // Wer kauft? Supabase prueft das Token, die Function vertraut nur dieser Antwort.
  let uid = null;
  let email = null;
  try {
    const r = await f(`${basis}/auth/v1/user`, { method: 'GET', headers: { apikey: oeffentlich, Authorization: `Bearer ${jwt}` } });
    if (r && (r.status === 401 || r.status === 403)) {
      let d = null;
      try { d = await r.json(); } catch (e) { /* ohne Koerper */ }
      const meldung = d && typeof d === 'object' ? String(d.message || d.msg || '') : '';
      if (r.status === 401 && /api ?key/i.test(meldung)) {
        log('abo-kasse nicht_eingerichtet apikey');
        return fehler(503, 'nicht_eingerichtet');
      }
      return fehler(401, 'anmeldung');
    }
    if (!r || !r.ok) return fehler(503, 'server');
    const u = await r.json();
    uid = u && typeof u.id === 'string' && MUSTER.uuid.test(u.id) ? u.id.toLowerCase() : null;
    // Nur eine bestaetigte Adresse geht an Stripe (wie werkstatt.js): sonst bekaeme ein Fremder die Belege
    const bestaetigt = !!(u && typeof u.email_confirmed_at === 'string' && u.email_confirmed_at);
    email = bestaetigt && typeof u.email === 'string' && MUSTER.email.test(u.email) ? u.email : null;
  } catch (e) {
    return fehler(503, 'server');
  }
  if (!uid) return fehler(401, 'anmeldung');

  // Schluessel und Schalter muessen zum selben Modus gehoeren (sonst zeigte die App "Testmodus" bei echtem Geld)
  const schalter = await schalterModus(f, basis, dienst);
  if (!schalter.ok) return fehler(503, 'server');
  if (schalter.modus !== art) {
    log(`abo-kasse nicht_eingerichtet modus ${art} ${schalter.modus || 'kein_link'}`);
    return fehler(503, 'nicht_eingerichtet');
  }

  // Kein zweites Abo fuer ein Konto, das schon Premium hat
  const premium = await rpc(f, basis, dienst, 'ist_premium_von', { uid });
  if (!premium.ok) return fehler(503, 'server');
  if (premium.wert === true) return fehler(409, 'schon_premium');
  const bisher = await bisherigerKunde(f, basis, dienst, uid);
  if (!bisher.ok) return fehler(503, 'server');
  if (bisher.laeuft) return fehler(409, 'kauf_laeuft');

  const fensterBeginn = Math.floor(t / FENSTER_MS) * FENSTER_MS;
  const ablauf = Math.floor((fensterBeginn + GUELTIG_MS) / 1000);
  const parameter = kassenParameter({ uid, preis, kunde: bisher.kunde, email, rueckkehr, ablauf });
  const schluessel = `crownmate-abo-${uid}-${Math.floor(t / FENSTER_MS)}`;
  let s = await stripeAufruf(f, '/checkout/sessions', parameter, umgebung.ABO_STRIPE_RK, schluessel);
  if (!s.ok && s.wiederholen) {
    log('abo-kasse stripe_wiederholung ' + (s.status || 'netz'));
    s = await stripeAufruf(f, '/checkout/sessions', parameter, umgebung.ABO_STRIPE_RK, schluessel);
  }
  if (s.ok) {
    const k = s.daten || {};
    const id = typeof k.id === 'string' && MUSTER.cs.test(k.id) ? k.id : null;
    const url = typeof k.url === 'string' && MUSTER.kasse.test(k.url) ? k.url : null;
    if (!id || !url) {
      log('abo-kasse stripe_antwort');
      return fehler(503, 'stripe');
    }
    log('abo-kasse ok ' + art);
    return antwort(200, { kassen_url: url });
  }
  if (s.wiederholen) {
    log('abo-kasse stripe_unklar ' + (s.status || 'netz'));
    return fehler(503, 'stripe');
  }
  if (s.status === 401 || s.status === 403) {
    log('abo-kasse nicht_eingerichtet stripe ' + s.status);
    return fehler(503, 'nicht_eingerichtet');
  }
  log(`abo-kasse stripe_abgelehnt ${s.status} ${s.code || '-'}`);
  return fehler(502, 'stripe');
}
