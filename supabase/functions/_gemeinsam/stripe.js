// Stripe-Webhook fuer das Abo "Crownmate Trainer" (Welle B1): die ganze Logik als reines ES-Modul, damit sie in Node
// testbar ist (tests/server-abo.test.mjs). Die Edge Function supabase/functions/stripe-webhook/index.ts ist nur die
// Huelle: Anfrage lesen, verarbeite() aufrufen, Antwort schreiben. Gebraucht werden nur WebCrypto (crypto.subtle),
// TextEncoder und fetch; die gibt es in Deno und in Node ab Version 19. Keine Stripe-Bibliothek, kein Stripe-API-Schluessel:
// alles, was gebraucht wird, steht in den Ereignissen selbst.
//
// API:
//   TOLERANZ_S = 300        der Zeitstempel der Signatur darf hoechstens 5 Minuten von der Serverzeit abweichen
//   MAX_KOERPER = 524288    groessere Anfragen werden abgelehnt (ein Stripe-Ereignis hat wenige KB)
//   VORLAEUFIG_S = 86400    vorlaeufiger Stand nach einem bezahlten Kauf, bis das erste Abo-Ereignis den echten bringt
//   TYPEN                   die verarbeiteten Ereignistypen (alles andere: 200 mit "ignoriert")
//   leseSignaturKopf(kopf) -> { t: Zahl | null, v1: [hex] }
//   hmacSha256Hex(geheimnis, text) -> Promise<hex>
//   gleichZeitkonstant(a, b) -> boolean   Vergleich ohne fruehen Abbruch (keine Zeit-Seitenkanaele)
//   pruefeSignatur(koerper, kopf, geheimnis, { jetzt, toleranz }) -> Promise<{ ok: true, t } | { ok: false, grund }>
//       grund: 'kein_geheimnis' | 'kein_kopf' | 'kein_zeitstempel' | 'keine_signatur' | 'signatur' | 'zeit'
//       Stripe signiert `${t}.${koerper}` mit HMAC-SHA256 und dem Webhook-Geheimnis (whsec_...) als Schluessel; der
//       Kopf Stripe-Signature lautet "t=<Sekunden>,v1=<hex>[,v1=<hex>][,v0=<hex>]". Gezaehlt wird nur v1.
//   auswerten(ereignis) -> { daten } | { ignoriert: grund }
//       daten sind genau die Parameter von public.abo_stripe_ereignis (supabase/abo-schema.sql):
//       { ereignis_id, typ, erstellt, kunde_id, abo_id, nutzer, status, gueltig_bis, plan }
//   verarbeite({ methode, koerper, signatur }, umgebung, { fetch, jetzt }) -> Promise<{ status, kopf, koerper }>
//       umgebung: { STRIPE_WEBHOOK_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY }
//       405 kein POST, 413 zu gross, 400 Signatur oder JSON falsch (Stripe zeigt den Fehler im Dashboard),
//       200 verbucht oder bewusst ignoriert, 500 Konfiguration fehlt oder Datenbank nicht erreichbar (Stripe
//       wiederholt die Zustellung bis zu 3 Tage). Die Antwort enthaelt nie Geheimnisse oder personenbezogene Daten.

export const TOLERANZ_S = 300;
export const MAX_KOERPER = 512 * 1024;
export const VORLAEUFIG_S = 24 * 60 * 60;
export const TYPEN = Object.freeze([
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.paid',
]);

const MUSTER = Object.freeze({
  evt: /^evt_[A-Za-z0-9]{1,200}$/,
  cus: /^cus_[A-Za-z0-9]{1,200}$/,
  sub: /^sub_[A-Za-z0-9]{1,200}$/,
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  hex64: /^[0-9a-f]{64}$/,
});

// ---------------------------------------------------------------------------
// Signatur
// ---------------------------------------------------------------------------
export function leseSignaturKopf(kopf) {
  const aus = { t: null, v1: [] };
  if (typeof kopf !== 'string') return aus;
  for (const teil of kopf.split(',')) {
    const i = teil.indexOf('=');
    if (i < 1) continue;
    const k = teil.slice(0, i).trim();
    const v = teil.slice(i + 1).trim();
    if (k === 't' && /^\d{1,12}$/.test(v)) aus.t = Number(v);
    else if (k === 'v1' && MUSTER.hex64.test(v.toLowerCase())) aus.v1.push(v.toLowerCase());
  }
  return aus;
}

export async function hmacSha256Hex(geheimnis, text) {
  const kodierer = new TextEncoder();
  const schluessel = await crypto.subtle.importKey('raw', kodierer.encode(String(geheimnis)),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', schluessel, kodierer.encode(String(text)));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function gleichZeitkonstant(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let unterschied = 0;
  for (let i = 0; i < a.length; i++) unterschied |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return unterschied === 0;
}

export async function pruefeSignatur(koerper, kopf, geheimnis, { jetzt, toleranz = TOLERANZ_S } = {}) {
  if (!geheimnis) return { ok: false, grund: 'kein_geheimnis' };
  if (!kopf || typeof kopf !== 'string') return { ok: false, grund: 'kein_kopf' };
  const { t, v1 } = leseSignaturKopf(kopf);
  if (t == null) return { ok: false, grund: 'kein_zeitstempel' };
  if (!v1.length) return { ok: false, grund: 'keine_signatur' };
  const soll = await hmacSha256Hex(geheimnis, `${t}.${koerper}`);
  if (!v1.some((s) => gleichZeitkonstant(s, soll))) return { ok: false, grund: 'signatur' };
  const nun = Number.isFinite(jetzt) ? jetzt : Math.floor(Date.now() / 1000);
  if (Math.abs(nun - t) > toleranz) return { ok: false, grund: 'zeit' };
  return { ok: true, t };
}

// ---------------------------------------------------------------------------
// Ereignis auswerten
// ---------------------------------------------------------------------------
// Stripe liefert Verweise als ID-Text oder (erweitert) als Objekt mit id
const idVon = (x) => (typeof x === 'string' ? x : (x && typeof x === 'object' && typeof x.id === 'string' ? x.id : null));
// Stripe-Zeit (Unix-Sekunden) als Zeitstempel fuer Postgres. Ein Zeitpunkt, kein Kalendertag: toISOString ist hier richtig.
const zeitstempel = (s) => (Number.isFinite(s) && s > 0 ? new Date(s * 1000).toISOString() : null);
const groesste = (liste) => {
  const z = (Array.isArray(liste) ? liste : []).map(Number).filter((n) => Number.isFinite(n) && n > 0);
  return z.length ? Math.max(...z) : null;
};

// Ende der bezahlten Periode eines Abos. Seit der Stripe-API-Version 2025-03-31 steht current_period_end an den
// Positionen (items.data[]) statt am Abo; beide Formen werden gelesen.
function periodenEnde(abo) {
  if (Number.isFinite(abo.current_period_end)) return abo.current_period_end;
  return groesste((abo.items && Array.isArray(abo.items.data) ? abo.items.data : []).map((i) => i && i.current_period_end));
}

// Kurzer Plan-Name fuer Flos Uebersicht: lookup_key des Preises, sonst das Intervall ("monat", "jahr", "3-monat")
const INTERVALLE = Object.freeze({ day: 'tag', week: 'woche', month: 'monat', year: 'jahr' });
export function planVon(abo) {
  const preis = (abo && abo.items && Array.isArray(abo.items.data) && abo.items.data[0] && abo.items.data[0].price)
    || (abo && abo.plan) || null;
  if (!preis || typeof preis !== 'object') return null;
  if (typeof preis.lookup_key === 'string' && preis.lookup_key.trim()) return preis.lookup_key.trim().slice(0, 60);
  const intervall = (preis.recurring && preis.recurring.interval) || preis.interval;
  const anzahl = Number((preis.recurring && preis.recurring.interval_count) || preis.interval_count || 1);
  const name = INTERVALLE[intervall];
  if (!name) return null;
  return anzahl > 1 ? `${anzahl}-${name}` : name;
}

// Abo einer Rechnung: aeltere API-Versionen invoice.subscription, neuere invoice.parent.subscription_details.subscription,
// notfalls die erste Rechnungszeile mit Abo
function aboDerRechnung(r) {
  const zeilen = r.lines && Array.isArray(r.lines.data) ? r.lines.data : [];
  const ausZeile = zeilen.map((z) => z && (idVon(z.subscription)
    || idVon(z.parent && z.parent.subscription_item_details && z.parent.subscription_item_details.subscription))).find(Boolean);
  return idVon(r.subscription)
    || idVon(r.parent && r.parent.subscription_details && r.parent.subscription_details.subscription)
    || ausZeile || null;
}

export function auswerten(e) {
  if (!e || typeof e !== 'object' || Array.isArray(e)) return { ignoriert: 'form' };
  if (!TYPEN.includes(e.type)) return { ignoriert: 'typ' };
  if (typeof e.id !== 'string' || !MUSTER.evt.test(e.id)) return { ignoriert: 'form' };
  const erstellt = zeitstempel(e.created);
  const o = e.data && e.data.object;
  if (!erstellt || !o || typeof o !== 'object') return { ignoriert: 'form' };
  const kunde = idVon(o.customer);
  if (!kunde || !MUSTER.cus.test(kunde)) return { ignoriert: 'kein_kunde' };

  let abo = null;
  let nutzer = null;
  let status = null;
  let bis = null;
  let plan = null;
  if (e.type === 'checkout.session.completed') {
    if (o.mode !== 'subscription') return { ignoriert: 'kein_abo' };
    abo = idVon(o.subscription);
    // client_reference_id haengt die App an den Kauf-Link (js/abo.js kaufAdresse): die Supabase-Nutzer-ID
    nutzer = typeof o.client_reference_id === 'string' && MUSTER.uuid.test(o.client_reference_id)
      ? o.client_reference_id.toLowerCase() : null;
    // Bezahlt (Karte): sofort Premium, vorlaeufig fuer einen Tag. Noch nicht bezahlt (z. B. Lastschrift): erst die
    // bezahlte Rechnung (invoice.paid) schaltet frei.
    const bezahlt = o.payment_status === 'paid' || o.payment_status === 'no_payment_required';
    status = bezahlt ? 'aktiv' : 'abgelaufen';
    bis = zeitstempel(e.created + (bezahlt ? VORLAEUFIG_S : 0));
  } else if (e.type === 'invoice.paid') {
    abo = aboDerRechnung(o);
    if (!abo) return { ignoriert: 'kein_abo' };
    // Die Zeilen tragen die bezahlte Leistungszeit (invoice.period_end waere die vorige Periode)
    const zeilen = o.lines && Array.isArray(o.lines.data) ? o.lines.data : [];
    const ende = groesste(zeilen.map((z) => z && z.period && z.period.end));
    if (!ende) return { ignoriert: 'keine_periode' };
    status = 'aktiv';
    bis = zeitstempel(ende);
  } else {
    abo = idVon(o.id);
    plan = planVon(o);
    if (e.type === 'customer.subscription.deleted') {
      status = 'abgelaufen';
      bis = zeitstempel(groesste([o.ended_at]) || groesste([o.canceled_at]) || e.created);
    } else if (o.status === 'active' || o.status === 'trialing') {
      const kuendigung = o.cancel_at_period_end === true || (Number.isFinite(o.cancel_at) && o.cancel_at > 0);
      if (kuendigung) {
        status = 'gekuendigt';
        bis = zeitstempel(Number.isFinite(o.cancel_at) && o.cancel_at > 0 ? o.cancel_at : periodenEnde(o));
      } else {
        status = 'aktiv';
        bis = zeitstempel(periodenEnde(o));
      }
    } else {
      // past_due, unpaid, incomplete, incomplete_expired, canceled, paused: ohne Zahlung kein Premium. Kommt die
      // Zahlung doch noch, bringen invoice.paid und das naechste Abo-Ereignis es sofort zurueck.
      status = 'abgelaufen';
      bis = erstellt;
    }
  }
  if (abo != null && !MUSTER.sub.test(abo)) return { ignoriert: 'form' };
  if (!bis) return { ignoriert: 'keine_periode' };
  return {
    daten: { ereignis_id: e.id, typ: e.type, erstellt, kunde_id: kunde, abo_id: abo, nutzer, status, gueltig_bis: bis, plan },
  };
}

// ---------------------------------------------------------------------------
// Anfrage verarbeiten
// ---------------------------------------------------------------------------
function antwort(status, daten) {
  return { status, kopf: { 'Content-Type': 'application/json; charset=utf-8' }, koerper: JSON.stringify(daten) };
}

// Kopf fuer PostgREST mit dem Service-Schluessel. Ein alter service_role-Schluessel ist ein JWT und darf zusaetzlich als
// Bearer stehen; ein neuer Secret Key (sb_secret_...) gehoert nur in apikey.
export function dienstKopf(schluessel) {
  const kopf = { apikey: schluessel, 'Content-Type': 'application/json' };
  if (/^eyJ[\w-]+\.[\w-]+\.[\w-]+$/.test(String(schluessel))) kopf.Authorization = `Bearer ${schluessel}`;
  return kopf;
}

export async function verarbeite({ methode, koerper, signatur } = {}, umgebung = {}, { fetch: holen, jetzt } = {}) {
  if (methode !== 'POST') return antwort(405, { fehler: 'Nur POST' });
  const geheimnis = umgebung.STRIPE_WEBHOOK_SECRET;
  const basis = String(umgebung.SUPABASE_URL || '').replace(/\/+$/, '');
  const schluessel = umgebung.SUPABASE_SERVICE_ROLE_KEY;
  if (!geheimnis || !basis || !schluessel) return antwort(500, { fehler: 'Konfiguration unvollstaendig' });
  if (typeof koerper !== 'string' || !koerper) return antwort(400, { fehler: 'Kein Inhalt' });
  if (koerper.length > MAX_KOERPER) return antwort(413, { fehler: 'Anfrage zu gross' });
  const sig = await pruefeSignatur(koerper, signatur, geheimnis, { jetzt });
  if (!sig.ok) return antwort(400, { fehler: 'Signatur ungueltig', grund: sig.grund });
  let ereignis = null;
  try { ereignis = JSON.parse(koerper); } catch (f) { return antwort(400, { fehler: 'Kein JSON' }); }
  const a = auswerten(ereignis);
  if (!a.daten) return antwort(200, { ok: true, ignoriert: a.ignoriert });
  const f = holen || globalThis.fetch;
  let r = null;
  try {
    r = await f(`${basis}/rest/v1/rpc/abo_stripe_ereignis`, {
      method: 'POST', headers: dienstKopf(schluessel), body: JSON.stringify(a.daten),
    });
  } catch (fehler) {
    return antwort(500, { fehler: 'Datenbank nicht erreichbar' });
  }
  if (!r || !r.ok) return antwort(500, { fehler: 'Datenbank-Fehler', status: r ? r.status : null });
  let ergebnis = null;
  try { ergebnis = await r.json(); } catch (fehler) { /* leere Antwort */ }
  return antwort(200, { ok: true, ergebnis });
}
