// Kuendigen und Widerrufen des Abos "Crownmate Trainer" (Kuendigungsknopf § 312k BGB, Widerrufsknopf § 356a BGB).
// Rechtsgrundlagen und Bauplan: Rechtspruefung vom 05.11.2026 (Vault, Schach-App). Keine Rechtsberatung.
//
// Vier Aktionen (Koerper { aktion, ... }):
//   kuendigen       angemeldet (Bearer). Stripe: cancel_at_period_end, Premium bleibt bis zum Periodenende.
//   widerrufen      angemeldet, nur bis 14 Tage nach Vertragsschluss (Stripe start_date; ein Tag Kulanz fuers
//                   Tagesende). Stripe: Abo sofort beenden, Erstattung des Betrags abzueglich anteiligem Wertersatz fuer
//                   die genutzten Tage (§ 357a Abs. 2 BGB, Zustimmungstext in abo-kasse.js).
//   link_anfordern  OHNE Anmeldung, { email }. Antwortet IMMER gleich ({ ok: true }), damit niemand herausfinden kann,
//                   ob eine Adresse ein Abo hat. Gibt es eins, geht eine Mail mit Einmal-Link (#kuendigen=<token>, 60 Min.)
//                   raus. In der Datenbank steht nur der SHA-256 des Tokens (abo-beenden-schema.sql), dort auch die
//                   Begrenzung auf 3 Links je Adresse und Stunde.
//   link_kuendigen  OHNE Anmeldung, { token }. Wie kuendigen, die Identitaet belegt der Link aus der Mail.
// Nach jedem Vorgang: Eintrag in abo_vorgaenge (Nachweis) und Bestaetigung per Mail mit Inhalt, Datum und Uhrzeit.
// Den Abo-Stand in abos setzt wie bisher der Stripe-Webhook (stripe.js wertet cancel_at_period_end und deleted aus).
//
// Reines ES-Modul wie abo-kasse.js, in Node getestet (tests/server-abo-beenden.test.mjs). Huelle:
// supabase/functions/abo-beenden/index.ts. Antworten:
//   200 kuendigen/link_kuendigen { art: 'kuendigung', eingang, wirksam_zum, mail }
//   200 widerrufen { art: 'widerruf', eingang, erstattet_cent, mail }
//   200 link_anfordern { ok: true }
//   204 OPTIONS  400/413 'eingabe'  401 'anmeldung'  405 'methode'  409 'kein_abo' | 'frist_vorbei'
//   410 'link_ungueltig'  502 'stripe'  503 'nicht_eingerichtet' | 'server' | 'stripe'
// Die Antwort enthaelt nie Schluessel, Nutzer-ID, Stripe-Kennungen oder E-Mail.

import { dienstKopf } from './stripe.js';
import { KOPF, STRIPE_API, bearer, stripeArt, rueckkehrAus } from './werkstatt.js';
import { mailBereit, sendeMail } from './mail.js';

export const MAX_KOERPER = 4096;
export const TAG_MS = 24 * 60 * 60 * 1000;
export const WIDERRUF_MS = 14 * TAG_MS;
export const KULANZ_MS = TAG_MS;
export const LINK_GUELTIG_MS = 60 * 60 * 1000;
export const AKTIONEN = Object.freeze(['kuendigen', 'widerrufen', 'link_anfordern', 'link_kuendigen']);

const MUSTER = Object.freeze({
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  sub: /^sub_[A-Za-z0-9]{1,200}$/,
  cus: /^cus_[A-Za-z0-9]{1,200}$/,
  ch: /^(ch|py)_[A-Za-z0-9]{1,200}$/,
  email: /^[^\s@<>"']{1,200}@[^\s@<>"']{1,200}\.[A-Za-z]{2,63}$/,
  token: /^[0-9a-f]{64}$/,
});

const TEXTE = Object.freeze({
  methode: { de: 'Nur POST.', en: 'POST only.' },
  anmeldung: { de: 'Bitte melde dich an.', en: 'Please sign in.' },
  eingabe: { de: 'Die Anfrage ist ungültig.', en: 'The request is invalid.' },
  kein_abo: { de: 'Zu diesem Konto läuft kein Abo.', en: 'There is no subscription for this account.' },
  frist_vorbei: { de: 'Die Widerrufsfrist von 14 Tagen ist vorbei. Du kannst das Abo kündigen.', en: 'The 14-day withdrawal period has ended. You can cancel the subscription.' },
  link_ungueltig: { de: 'Der Link ist abgelaufen oder schon benutzt. Fordere bitte einen neuen an.', en: 'This link has expired or was already used. Please request a new one.' },
  nicht_eingerichtet: { de: 'Kündigen ist gerade nicht eingerichtet. Schreib uns bitte an die Adresse im Impressum.', en: 'Cancelling is not set up right now. Please write to the address in the legal notice.' },
  stripe: { de: 'Stripe ist gerade nicht erreichbar. Versuch es bitte gleich noch einmal.', en: 'Stripe is not available right now. Please try again shortly.' },
  server: { de: 'Der Server ist gerade nicht erreichbar.', en: 'The server is not available right now.' },
});

function antwort(status, daten) {
  return { status, kopf: { ...KOPF }, koerper: JSON.stringify(daten) };
}
function fehler(status, kennung) {
  const t = TEXTE[kennung] || TEXTE.server;
  return antwort(status, { fehler: kennung, text: t.de, text_en: t.en });
}

// Datum und Uhrzeit in deutscher Zeit fuer die Bestaetigungs-Mail
export function zeitText(ms) {
  return new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(ms)) + ' Uhr';
}
export function datumText(ms) {
  return new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(ms));
}
const euro = (cent) => (cent / 100).toFixed(2).replace('.', ',') + ' €';

export async function sha256hex(text) {
  const d = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
export function neuesToken(zufall) {
  const b = new Uint8Array(32);
  (zufall || ((x) => globalThis.crypto.getRandomValues(x)))(b);
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

// Wertersatz: Anteil der bezahlten Periode, der bis jetzt genutzt wurde, bleibt beim Anbieter; der Rest geht zurueck.
// Ganze Cent, abgerundet zugunsten des Anbieters nur beim Bruchteil eines Cents.
export function erstattungCent({ bezahlt, schonErstattet = 0, periodeStart, periodeEnde, jetztS }) {
  const offen = Math.max(0, Math.floor(bezahlt) - Math.floor(schonErstattet || 0));
  if (!offen || !(periodeEnde > periodeStart)) return offen;
  const genutzt = Math.min(1, Math.max(0, (jetztS - periodeStart) / (periodeEnde - periodeStart)));
  return Math.max(0, Math.floor(offen * (1 - genutzt)));
}

async function stripe(holen, methode, pfad, parameter, schluessel, idempotenz) {
  try {
    const kopf = { Authorization: `Bearer ${schluessel}` };
    if (methode !== 'GET') kopf['Content-Type'] = 'application/x-www-form-urlencoded';
    if (idempotenz && methode === 'POST') kopf['Idempotency-Key'] = idempotenz;
    const r = await holen(`${STRIPE_API}${pfad}`, { method: methode, headers: kopf, body: methode === 'GET' ? undefined : (parameter || new URLSearchParams()).toString() });
    if (!r) return { ok: false, wiederholen: true, status: null };
    let d = null;
    try { d = await r.json(); } catch (e) { /* ohne Koerper */ }
    if (r.ok) return { ok: true, status: r.status, daten: d };
    const fa = d && d.error && typeof d.error === 'object' ? d.error : {};
    const code = typeof fa.code === 'string' ? fa.code.slice(0, 60) : '';
    return { ok: false, wiederholen: r.status >= 500 || r.status === 429 || r.status === 409, status: r.status, code };
  } catch (e) {
    return { ok: false, wiederholen: true, status: null };
  }
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

async function aboZeile(holen, basis, schluessel, uid) {
  try {
    const r = await holen(`${basis}/rest/v1/abos?select=status,abo_id,kunde_id,quelle&user_id=eq.${encodeURIComponent(uid)}`, { method: 'GET', headers: dienstKopf(schluessel) });
    if (!r || !r.ok) return { ok: false };
    const d = await r.json();
    const z = Array.isArray(d) ? d[0] : null;
    if (!z || z.quelle !== 'stripe' || z.status === 'abgelaufen' || !MUSTER.sub.test(String(z.abo_id || '')) || !MUSTER.cus.test(String(z.kunde_id || ''))) return { ok: true, zeile: null };
    return { ok: true, zeile: { abo: z.abo_id, kunde: z.kunde_id } };
  } catch (e) {
    return { ok: false };
  }
}

// Angemeldeter Nutzer aus dem Token (Supabase prueft es). email nur, wenn bestaetigt.
async function angemeldet(holen, basis, oeffentlich, jwt) {
  try {
    const r = await holen(`${basis}/auth/v1/user`, { method: 'GET', headers: { apikey: oeffentlich, Authorization: `Bearer ${jwt}` } });
    if (r && (r.status === 401 || r.status === 403)) return { ok: false, status: 401 };
    if (!r || !r.ok) return { ok: false, status: 503 };
    const u = await r.json();
    const uid = u && typeof u.id === 'string' && MUSTER.uuid.test(u.id) ? u.id.toLowerCase() : null;
    if (!uid) return { ok: false, status: 401 };
    const bestaetigt = !!(u && typeof u.email_confirmed_at === 'string' && u.email_confirmed_at);
    return { ok: true, uid, email: bestaetigt && typeof u.email === 'string' && MUSTER.email.test(u.email) ? u.email : null };
  } catch (e) {
    return { ok: false, status: 503 };
  }
}

const periode = (s) => {
  const it = s && s.items && Array.isArray(s.items.data) ? s.items.data[0] : null;
  return {
    start: Number((it && it.current_period_start) || s.current_period_start) || null,
    ende: Number((it && it.current_period_end) || s.current_period_end) || null,
  };
};

function mailKuendigung({ eingang, wirksam, weg }) {
  return {
    betreff: 'Bestätigung deiner Kündigung: Crownmate Trainer',
    text: [
      'Hallo,',
      '',
      'deine Kündigung ist bei uns eingegangen.',
      '',
      `Inhalt: ordentliche Kündigung des Abos „Crownmate Trainer“${weg === 'link' ? ' (über den Kündigungslink aus unserer E-Mail)' : ''}`,
      `Eingegangen am: ${zeitText(eingang)}`,
      wirksam ? `Wirksam zum: ${datumText(wirksam)}. Bis dahin kannst du den Trainer weiter nutzen, danach wird nichts mehr abgebucht.` : 'Wirksam zum Ende des laufenden Abrechnungszeitraums. Danach wird nichts mehr abgebucht.',
      '',
      'Das Spiel selbst bleibt für dich gratis.',
      '',
      'Crownmate',
    ].join('\n'),
  };
}
function mailWiderruf({ eingang, erstattet }) {
  return {
    betreff: 'Eingangsbestätigung deines Widerrufs: Crownmate Trainer',
    text: [
      'Hallo,',
      '',
      'dein Widerruf ist bei uns eingegangen.',
      '',
      'Inhalt: Widerruf des Vertrags über das Abo „Crownmate Trainer“',
      `Eingegangen am: ${zeitText(eingang)}`,
      'Das Abo ist beendet, es wird nichts mehr abgebucht.',
      erstattet != null
        ? `Erstattung: ${euro(erstattet)} über deine Zahlungsart. Für die Tage bis heute bleibt ein anteiliger Betrag (§ 357a Abs. 2 BGB).`
        : 'Den Betrag abzüglich eines anteiligen Betrags für die Tage bis heute (§ 357a Abs. 2 BGB) erstatten wir über deine Zahlungsart, spätestens 14 Tage nach heute.',
      '',
      'Das Spiel selbst bleibt für dich gratis.',
      '',
      'Crownmate',
    ].join('\n'),
  };
}

async function kuendige(k, { uid, email, weg }) {
  const { f, basis, dienst, rk, t, log, umgebung } = k;
  const z = await aboZeile(f, basis, dienst, uid);
  if (!z.ok) return fehler(503, 'server');
  if (!z.zeile) return fehler(409, 'kein_abo');
  const p = new URLSearchParams();
  p.append('cancel_at_period_end', 'true');
  let s = await stripe(f, 'POST', `/subscriptions/${z.zeile.abo}`, p, rk, `crownmate-kuendigen-${z.zeile.abo}`);
  if (!s.ok && s.wiederholen) s = await stripe(f, 'POST', `/subscriptions/${z.zeile.abo}`, p, rk, `crownmate-kuendigen-${z.zeile.abo}`);
  if (!s.ok) {
    if (s.status === 401 || s.status === 403) { log('abo-beenden nicht_eingerichtet stripe ' + s.status); return fehler(503, 'nicht_eingerichtet'); }
    if (s.status === 404 || (s.status === 400 && /resource_missing|subscription/.test(s.code || ''))) return fehler(409, 'kein_abo');
    log(`abo-beenden stripe ${s.status || 'netz'} ${s.code || '-'}`);
    return fehler(s.wiederholen ? 503 : 502, 'stripe');
  }
  const d = s.daten || {};
  if (d.customer !== z.zeile.kunde) { log('abo-beenden fremdes_abo'); return fehler(409, 'kein_abo'); }
  const bis = Number(d.cancel_at) || periode(d).ende;
  const wirksam = bis ? bis * 1000 : null;
  let mail = false;
  if (email) {
    const m = mailKuendigung({ eingang: t, wirksam, weg });
    mail = (await sendeMail(f, umgebung, { an: email, betreff: m.betreff, text: m.text, idempotenz: `kuendigung-${z.zeile.abo}-${Math.floor(t / 60000)}` })).ok;
  }
  const e = await rpc(f, basis, dienst, 'abo_vorgang_eintragen', {
    p_user: uid, p_art: 'kuendigung', p_weg: weg, p_abo: z.zeile.abo,
    p_wirksam: wirksam ? new Date(wirksam).toISOString() : null, p_erstattet: null, p_mail: mail,
  });
  if (!e.ok) log('abo-beenden nachweis_fehlt kuendigung');
  log(`abo-beenden kuendigung ${weg} mail=${mail}`);
  return antwort(200, { art: 'kuendigung', eingang: new Date(t).toISOString(), wirksam_zum: wirksam ? new Date(wirksam).toISOString() : null, mail });
}

async function widerrufe(k, { uid, email }) {
  const { f, basis, dienst, rk, t, log, umgebung } = k;
  const z = await aboZeile(f, basis, dienst, uid);
  if (!z.ok) return fehler(503, 'server');
  if (!z.zeile) return fehler(409, 'kein_abo');
  const g = await stripe(f, 'GET', `/subscriptions/${z.zeile.abo}`, null, rk);
  if (!g.ok) {
    if (g.status === 401 || g.status === 403) return fehler(503, 'nicht_eingerichtet');
    if (g.status === 404) return fehler(409, 'kein_abo');
    return fehler(g.wiederholen ? 503 : 502, 'stripe');
  }
  const sub = g.daten || {};
  if (sub.customer !== z.zeile.kunde || sub.status === 'canceled') return fehler(409, 'kein_abo');
  const start = Number(sub.start_date) * 1000;
  if (!start || t > start + WIDERRUF_MS + KULANZ_MS) return fehler(409, 'frist_vorbei');

  // Letzte Zahlung des Kunden seit Vertragsbeginn (Charges sind ueber alle API-Versionen stabil)
  let zahlung = null;
  const c = await stripe(f, 'GET', `/charges?customer=${encodeURIComponent(z.zeile.kunde)}&limit=5`, null, rk);
  if (c.ok && c.daten && Array.isArray(c.daten.data)) {
    zahlung = c.daten.data.find((x) => x && x.paid === true && x.status === 'succeeded' && !x.refunded
      && MUSTER.ch.test(String(x.id || '')) && Number(x.created) * 1000 >= start - 60 * 60 * 1000) || null;
  }

  const del = await stripe(f, 'DELETE', `/subscriptions/${z.zeile.abo}`, null, rk);
  if (!del.ok && !(del.status === 404)) {
    log(`abo-beenden stripe widerruf ${del.status || 'netz'} ${del.code || '-'}`);
    return fehler(del.wiederholen ? 503 : 502, 'stripe');
  }

  let erstattet = null;
  if (zahlung) {
    const pr = periode(sub);
    const betrag = erstattungCent({
      bezahlt: Number(zahlung.amount) || 0, schonErstattet: Number(zahlung.amount_refunded) || 0,
      periodeStart: pr.start || start / 1000, periodeEnde: pr.ende || start / 1000 + 30 * 86400, jetztS: t / 1000,
    });
    if (betrag > 0) {
      const p = new URLSearchParams();
      p.append('charge', zahlung.id);
      p.append('amount', String(betrag));
      p.append('reason', 'requested_by_customer');
      p.append('metadata[grund]', 'widerruf');
      const r = await stripe(f, 'POST', '/refunds', p, rk, `crownmate-widerruf-erstattung-${z.zeile.abo}`);
      if (r.ok) erstattet = betrag;
      else log(`abo-beenden erstattung_offen ${r.status || 'netz'}`);
    } else {
      erstattet = 0;
    }
  } else {
    erstattet = 0;
    if (!c.ok) { erstattet = null; log('abo-beenden erstattung_offen charges'); }
  }

  let mail = false;
  if (email) {
    const m = mailWiderruf({ eingang: t, erstattet });
    mail = (await sendeMail(f, umgebung, { an: email, betreff: m.betreff, text: m.text, idempotenz: `widerruf-${z.zeile.abo}` })).ok;
  }
  const e = await rpc(f, basis, dienst, 'abo_vorgang_eintragen', {
    p_user: uid, p_art: 'widerruf', p_weg: 'angemeldet', p_abo: z.zeile.abo,
    p_wirksam: new Date(t).toISOString(), p_erstattet: erstattet, p_mail: mail,
  });
  if (!e.ok) log('abo-beenden nachweis_fehlt widerruf');
  log(`abo-beenden widerruf mail=${mail} erstattung=${erstattet == null ? 'offen' : 'ok'}`);
  return antwort(200, { art: 'widerruf', eingang: new Date(t).toISOString(), erstattet_cent: erstattet, mail });
}

export async function verarbeite({ methode, koerper, autorisierung } = {}, umgebung = {}, { fetch: holen, jetzt, protokoll, zufall } = {}) {
  const log = (zeile) => { try { if (typeof protokoll === 'function') protokoll(zeile); } catch (e) { /* egal */ } };
  if (methode === 'OPTIONS') return { status: 204, kopf: { ...KOPF }, koerper: '' };
  if (methode !== 'POST') return fehler(405, 'methode');
  if (typeof koerper !== 'string' || koerper.length > MAX_KOERPER) return fehler(typeof koerper === 'string' ? 413 : 400, 'eingabe');
  let d;
  try { d = JSON.parse(koerper); } catch (e) { return fehler(400, 'eingabe'); }
  if (!d || typeof d !== 'object' || Array.isArray(d) || !AKTIONEN.includes(d.aktion)) return fehler(400, 'eingabe');

  const basis = String(umgebung.SUPABASE_URL || '').replace(/\/+$/, '');
  const dienst = umgebung.SUPABASE_SERVICE_ROLE_KEY;
  const oeffentlich = umgebung.SUPABASE_ANON_KEY || dienst;
  const rk = String(umgebung.ABO_STRIPE_RK || '').trim();
  const art = stripeArt(rk);
  if (!basis || !dienst || (art !== 'test' && art !== 'live') || !mailBereit(umgebung)) {
    log('abo-beenden nicht_eingerichtet ' + (!basis || !dienst ? 'supabase' : art !== 'test' && art !== 'live' ? 'ABO_STRIPE_RK' : 'mail'));
    return fehler(503, 'nicht_eingerichtet');
  }
  const f = holen || globalThis.fetch;
  const t = Number.isFinite(jetzt) ? jetzt : Date.now();
  const k = { f, basis, dienst, rk, t, log, umgebung };

  if (d.aktion === 'link_anfordern') {
    const email = typeof d.email === 'string' ? d.email.trim() : '';
    if (!MUSTER.email.test(email)) return fehler(400, 'eingabe');
    const rueckkehr = rueckkehrAus(umgebung.ABO_RUECKKEHR);
    if (!rueckkehr) { log('abo-beenden nicht_eingerichtet ABO_RUECKKEHR'); return fehler(503, 'nicht_eingerichtet'); }
    const token = neuesToken(zufall);
    const hash = await sha256hex(token);
    const r = await rpc(f, basis, dienst, 'abo_link_anlegen', { p_email: email.toLowerCase(), p_hash: hash, p_ablauf: new Date(t + LINK_GUELTIG_MS).toISOString() });
    if (!r.ok) return fehler(503, 'server');
    if (r.wert === true) {
      const link = `${rueckkehr}#kuendigen=${token}`;
      const m = await sendeMail(f, umgebung, {
        an: email,
        betreff: 'Dein Link zum Kündigen: Crownmate Trainer',
        text: ['Hallo,', '', 'du hast einen Link zum Kündigen deines Abos „Crownmate Trainer“ angefordert.', '',
          `Hier kündigen: ${link}`, '', 'Der Link gilt 60 Minuten und nur einmal. Hast du ihn nicht angefordert, kannst du diese Mail ignorieren.', '', 'Crownmate'].join('\n'),
      });
      log('abo-beenden link mail=' + m.ok);
    }
    // Immer dieselbe Antwort: ob die Adresse ein Abo hat, bleibt geheim
    return antwort(200, { ok: true });
  }

  if (d.aktion === 'link_kuendigen') {
    const token = typeof d.token === 'string' ? d.token.trim().toLowerCase() : '';
    if (!MUSTER.token.test(token)) return fehler(400, 'eingabe');
    const hash = await sha256hex(token);
    const r = await rpc(f, basis, dienst, 'abo_link_pruefen', { p_hash: hash });
    if (!r.ok) return fehler(503, 'server');
    const z = Array.isArray(r.wert) ? r.wert[0] : null;
    const uid = z && typeof z.user_id === 'string' && MUSTER.uuid.test(z.user_id) ? z.user_id.toLowerCase() : null;
    const email = z && typeof z.email === 'string' && MUSTER.email.test(z.email) ? z.email : null;
    if (!uid) return fehler(410, 'link_ungueltig');
    const a = await kuendige(k, { uid, email, weg: 'link' });
    if (a.status === 200) {
      const v = await rpc(f, basis, dienst, 'abo_link_verbrauchen', { p_hash: hash });
      if (!v.ok) log('abo-beenden link_nicht_verbraucht');
    }
    return a;
  }

  const jwt = bearer(autorisierung);
  if (!jwt) return fehler(401, 'anmeldung');
  const u = await angemeldet(f, basis, oeffentlich, jwt);
  if (!u.ok) return u.status === 401 ? fehler(401, 'anmeldung') : fehler(503, 'server');
  if (d.aktion === 'kuendigen') return kuendige(k, { uid: u.uid, email: u.email, weg: 'angemeldet' });
  return widerrufe(k, { uid: u.uid, email: u.email });
}
