// Kuendigung des Abos "Crownmate Trainer" aus der App (Kuendigungsbutton, Paragraf 312k BGB): nimmt die Erklaerung von
// der Bestaetigungsseite (js/pakete/abo/kuendigen.js) an und traegt die Kuendigung bei Stripe ein. Die Nutzer-ID kommt
// nur aus der Anmeldung, das Abo nur aus der eigenen Zeile in abos (nie aus der Anfrage). Geschrieben wird nur bei
// Stripe; den neuen Stand ('gekuendigt', gilt bis ...) bringt wie immer der Webhook (stripe.js) in die Tabelle abos.
//
// RECHTLICH UNGEPRUEFT: Ob Ablauf, Texte und Bestaetigung Paragraf 312k BGB genuegen, muss eine fachkundige Person
// pruefen, bevor das Abo verkauft wird (siehe supabase/ANLEITUNG.md, Abschnitt "Kuendigungsbutton").
//
// Reines ES-Modul wie stripe.js und werkstatt.js, in Node getestet (tests/server-abo-kuendigen.test.mjs). Die Edge
// Function supabase/functions/abo-kuendigen/index.ts ist nur die Huelle.
//
// API:
//   MAX_KOERPER = 4096, MAX_GRUND = 500, MAX_VORAUS_TAGE = 730
//   ARTEN = ['ordentlich', 'ausserordentlich']
//   META_KUENDIGUNG, META_KUENDIGUNG_ART   Metadaten am Stripe-Abo: Eingang (ISO, auf die Minute) und Art. Das ist der
//       Nachweis des Zugangs; eine eigene Tabelle gibt es dafuer nicht.
//   pruefeEingabe(d, jetzt) -> { art, grund, zeitpunkt: 'naechster' | ms, tag: 'JJJJ-MM-TT' | null } | null
//       d: { art, grund?, zeitpunkt? }   zeitpunkt 'naechster' (Standard) oder ein Kalendertag 'JJJJ-MM-TT' in der Zukunft
//   kuendigungsParameter({ art, grund, zeitpunkt, laeuftBis, eingang }) -> URLSearchParams
//       naechster (oder ein Tag, der nicht nach dem bezahlten Zeitraum liegt): cancel_at_period_end=true
//       spaeterer Tag: cancel_at=<Ende dieses Tages>, Stripe rechnet den letzten Zeitraum anteilig ab
//       Ein Wunschtermin VOR dem Ende des bezahlten Zeitraums (z. B. ausserordentlich, auch bei schon vorgemerkter
//       ordentlicher Kuendigung) steht als "Wunschtermin JJJJ-MM-TT" in der Notiz an Stripe: Flo entscheidet von Hand.
//   verarbeite({ methode, koerper, autorisierung }, umgebung, { fetch, jetzt, protokoll }) -> Promise<{ status, kopf, koerper }>
//       umgebung: { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY?, ABO_STRIPE_RK }
//       ABO_STRIPE_RK: eingeschraenkter Stripe-Schluessel (rk_test_ oder rk_live_) mit "Abonnements: Schreiben"
//       200 { ok, vertrag, art, eingegangen_am, wirksam_zum, pruefung }
//           pruefung: true bei einer ausserordentlichen Kuendigung. Dann endet der Vertrag spaetestens zum genannten
//           Zeitpunkt; ob er frueher endet, entscheidet Flo von Hand (die App sagt das so).
//       204 OPTIONS   401 'anmeldung'   400/413 'eingabe'   405 'methode'
//       404 'kein_vertrag' (kein Stripe-Abo an diesem Konto, oder Stripe kennt es nicht mehr)
//       502 'stripe' (Stripe hat abgelehnt)   503 'nicht_eingerichtet' | 'server' | 'stripe' (nicht sicher erreicht)
//       Die Antwort enthaelt nie Schluessel, Nutzer-ID, E-Mail, Kunden- oder Abo-Nummern.

import { dienstKopf } from './stripe.js';
import { KOPF, bearer, stripeAufruf, stripeArt } from './werkstatt.js';

export const MAX_KOERPER = 4096;
export const MAX_GRUND = 500;
export const MAX_VORAUS_TAGE = 730;
export const ARTEN = Object.freeze(['ordentlich', 'ausserordentlich']);
export const META_KUENDIGUNG = 'crownmate_kuendigung';
export const META_KUENDIGUNG_ART = 'crownmate_kuendigung_art';
export const VERTRAG = 'Crownmate Trainer';

const MUSTER = Object.freeze({
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  cus: /^cus_[A-Za-z0-9]{1,200}$/,
  sub: /^sub_[A-Za-z0-9]{1,200}$/,
  tag: /^(\d{4})-(\d{2})-(\d{2})$/,
});

const TEXTE = Object.freeze({
  methode: { de: 'Nur POST.', en: 'POST only.' },
  anmeldung: { de: 'Bitte melde dich an.', en: 'Please sign in.' },
  eingabe: { de: 'Die Anfrage ist ungültig.', en: 'The request is invalid.' },
  kein_vertrag: { de: 'Für dieses Konto läuft kein Vertrag bei Stripe.', en: 'There is no Stripe contract for this account.' },
  nicht_eingerichtet: { de: 'Die Kündigung in der App ist noch nicht eingerichtet.', en: 'Cancelling in the app is not set up yet.' },
  stripe: { de: 'Stripe ist gerade nicht erreichbar.', en: 'Stripe is not available right now.' },
  server: { de: 'Der Server ist gerade nicht erreichbar.', en: 'The server is not available right now.' },
});

function antwort(status, daten) {
  return { status, kopf: { ...KOPF }, koerper: JSON.stringify(daten) };
}
function fehler(status, kennung) {
  const t = TEXTE[kennung] || TEXTE.server;
  return antwort(status, { fehler: kennung, text: t.de, text_en: t.en });
}

// Ende eines Kalendertags, wie ihn die Person eingetragen hat: 23:00 UTC, also Mitternacht (Winter) bzw. 1 Uhr
// (Sommer) in Deutschland. Der Vertrag endet damit nie VOR dem Ende des gewuenschten Tages.
function tagesEnde(text) {
  const m = MUSTER.tag.exec(String(text || ''));
  if (!m) return null;
  const [j, mo, t] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const ms = Date.UTC(j, mo - 1, t, 23, 0, 0);
  const d = new Date(ms);
  // 31.02. und aehnliches: Date rollt weiter, das ist dann kein gueltiger Tag
  if (d.getUTCFullYear() !== j || d.getUTCMonth() !== mo - 1 || d.getUTCDate() !== t) return null;
  return ms;
}

export function pruefeEingabe(d, jetzt = Date.now()) {
  if (!d || typeof d !== 'object' || Array.isArray(d)) return null;
  const art = d.art === undefined ? 'ordentlich' : d.art;
  if (!ARTEN.includes(art)) return null;
  if (d.grund !== undefined && d.grund !== null && typeof d.grund !== 'string') return null;
  // Steuerzeichen raus, Laenge begrenzt: Der Text geht als Notiz an Stripe und wird dort von Flo gelesen
  const grund = String(d.grund || '').replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, MAX_GRUND);
  let zeitpunkt = 'naechster';
  let tag = null;
  if (d.zeitpunkt !== undefined && d.zeitpunkt !== null && d.zeitpunkt !== 'naechster') {
    const ms = tagesEnde(d.zeitpunkt);
    if (ms === null || ms <= jetzt || ms > jetzt + MAX_VORAUS_TAGE * 86400000) return null;
    zeitpunkt = ms;
    tag = String(d.zeitpunkt);
  }
  return { art, grund, zeitpunkt, tag };
}

export function kuendigungsParameter({ art, grund, zeitpunkt, tag = null, laeuftBis, eingang }) {
  const p = new URLSearchParams();
  const spaeter = Number.isFinite(zeitpunkt) && Number.isFinite(laeuftBis) && zeitpunkt > laeuftBis;
  if (spaeter) p.append('cancel_at', String(Math.floor(zeitpunkt / 1000)));
  else p.append('cancel_at_period_end', 'true');
  p.append(`metadata[${META_KUENDIGUNG}]`, eingang);
  p.append(`metadata[${META_KUENDIGUNG_ART}]`, art);
  // Der gewuenschte Tag geht nur verloren, wenn er nicht als cancel_at eingetragen wird: dann in die Notiz
  const wunsch = !spaeter && tag ? `Wunschtermin ${tag}` : '';
  if (grund || wunsch) p.append('cancellation_details[comment]', [grund ? `${art}: ${grund}` : art, wunsch].filter(Boolean).join('; '));
  return p;
}

async function kurzHash(text) {
  const roh = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(roh)].slice(0, 12).map((x) => x.toString(16).padStart(2, '0')).join('');
}

// Ende des Vertrags aus der Antwort von Stripe: cancel_at, sonst das Ende des bezahlten Zeitraums (am Abo oder, seit
// der API-Version 2025-03-31, an den Positionen)
function endeAus(abo) {
  if (!abo || typeof abo !== 'object') return null;
  if (Number.isFinite(abo.cancel_at) && abo.cancel_at > 0) return abo.cancel_at * 1000;
  if (Number.isFinite(abo.current_period_end) && abo.current_period_end > 0) return abo.current_period_end * 1000;
  const pos = abo.items && Array.isArray(abo.items.data) ? abo.items.data : [];
  const z = pos.map((i) => Number(i && i.current_period_end)).filter((n) => Number.isFinite(n) && n > 0);
  return z.length ? Math.max(...z) * 1000 : null;
}

export async function verarbeite({ methode, koerper, autorisierung } = {}, umgebung = {}, { fetch: holen, jetzt, protokoll } = {}) {
  const log = (zeile) => { try { if (typeof protokoll === 'function') protokoll(zeile); } catch (e) { /* egal */ } };
  if (methode === 'OPTIONS') return { status: 204, kopf: { ...KOPF }, koerper: '' };
  if (methode !== 'POST') return fehler(405, 'methode');
  const basis = String(umgebung.SUPABASE_URL || '').replace(/\/+$/, '');
  const dienst = umgebung.SUPABASE_SERVICE_ROLE_KEY;
  const oeffentlich = umgebung.SUPABASE_ANON_KEY || dienst;
  if (!basis || !dienst) {
    log('abo-kuendigen nicht_eingerichtet supabase');
    return fehler(503, 'nicht_eingerichtet');
  }
  // Nur ein eingeschraenkter Schluessel (rk_test_ oder rk_live_), nie ein voller Secret Key
  const art = stripeArt(umgebung.ABO_STRIPE_RK);
  if (art !== 'test' && art !== 'live') {
    log('abo-kuendigen nicht_eingerichtet ABO_STRIPE_RK ' + art);
    return fehler(503, 'nicht_eingerichtet');
  }
  const jwt = bearer(autorisierung);
  if (!jwt) return fehler(401, 'anmeldung');
  if (typeof koerper !== 'string' || koerper.length > MAX_KOERPER) return fehler(typeof koerper === 'string' ? 413 : 400, 'eingabe');
  const t = Number.isFinite(jetzt) ? jetzt : Date.now();
  let roh = null;
  try { roh = JSON.parse(koerper || '{}'); } catch (e) { return fehler(400, 'eingabe'); }
  const eingabe = pruefeEingabe(roh, t);
  if (!eingabe) return fehler(400, 'eingabe');
  const f = holen || globalThis.fetch;

  // Wer kuendigt? Supabase prueft das Token, die Function vertraut nur dieser Antwort.
  let uid = null;
  try {
    const r = await f(`${basis}/auth/v1/user`, { method: 'GET', headers: { apikey: oeffentlich, Authorization: `Bearer ${jwt}` } });
    if (r && (r.status === 401 || r.status === 403)) return fehler(401, 'anmeldung');
    if (!r || !r.ok) return fehler(503, 'server');
    const u = await r.json();
    uid = u && typeof u.id === 'string' && MUSTER.uuid.test(u.id) ? u.id.toLowerCase() : null;
  } catch (e) {
    return fehler(503, 'server');
  }
  if (!uid) return fehler(401, 'anmeldung');

  // Welcher Vertrag? Nur die eigene Zeile, gelesen mit dem Dienst-Schluessel (die Stripe-Nummern sieht die App nie).
  let zeile = null;
  try {
    const r = await f(`${basis}/rest/v1/abos?select=status,gueltig_bis,quelle,kunde_id,abo_id&user_id=eq.${encodeURIComponent(uid)}`,
      { method: 'GET', headers: dienstKopf(dienst) });
    if (!r || !r.ok) return fehler(503, 'server');
    const d = await r.json();
    zeile = Array.isArray(d) ? d[0] || null : null;
  } catch (e) {
    return fehler(503, 'server');
  }
  const abo = zeile && typeof zeile.abo_id === 'string' && MUSTER.sub.test(zeile.abo_id) ? zeile.abo_id : null;
  const kunde = zeile && typeof zeile.kunde_id === 'string' && MUSTER.cus.test(zeile.kunde_id) ? zeile.kunde_id : null;
  // Auch ein Abo mit offener Zahlung (hier 'abgelaufen') laesst sich kuendigen: Ob es bei Stripe noch besteht, sagt Stripe.
  if (!abo || !kunde) return fehler(404, 'kein_vertrag');
  const bis = Date.parse(zeile.gueltig_bis);
  const laeuftBis = Number.isFinite(bis) ? bis : t;

  // Eingang auf die Minute (ein Zeitpunkt, kein Kalendertag): Ein Doppelklick schickt so genau dieselbe Anfrage mit
  // demselben Idempotency-Key und ist bei Stripe EINE Kuendigung. Die Antwort an die App nennt die genaue Zeit.
  const eingang = new Date(Math.floor(t / 60000) * 60000).toISOString();
  const parameter = kuendigungsParameter({ ...eingabe, laeuftBis, eingang });
  const schluessel = `crownmate-kuendigung-${await kurzHash(`${uid}|${abo}|${parameter.toString()}`)}`;
  let s = await stripeAufruf(f, `/subscriptions/${abo}`, parameter, umgebung.ABO_STRIPE_RK, schluessel);
  if (!s.ok && s.wiederholen) {
    log('abo-kuendigen stripe_wiederholung ' + (s.status || 'netz'));
    s = await stripeAufruf(f, `/subscriptions/${abo}`, parameter, umgebung.ABO_STRIPE_RK, schluessel);
  }
  if (!s.ok) {
    if (s.wiederholen) {
      log('abo-kuendigen stripe_unklar ' + (s.status || 'netz'));
      return fehler(503, 'stripe');
    }
    if (s.status === 401 || s.status === 403) {
      log('abo-kuendigen nicht_eingerichtet stripe ' + s.status);
      return fehler(503, 'nicht_eingerichtet');
    }
    // Stripe kennt das Abo nicht (mehr) oder es ist schon beendet: Es gibt nichts zu kuendigen
    if (s.status === 404 || s.code === 'resource_missing') {
      log('abo-kuendigen kein_vertrag stripe');
      return fehler(404, 'kein_vertrag');
    }
    log(`abo-kuendigen stripe_abgelehnt ${s.status} ${s.code || '-'}`);
    return fehler(502, 'stripe');
  }
  const d = s.daten || {};
  // Gehoert das Abo bei Stripe einem anderen Kunden als in der eigenen Zeile, stimmt die Zuordnung nicht: melden
  const kundeStripe = typeof d.customer === 'string' ? d.customer : (d.customer && typeof d.customer.id === 'string' ? d.customer.id : null);
  if (kundeStripe && kundeStripe !== kunde) log('abo-kuendigen kunde_weicht_ab');
  const ende = endeAus(d) || laeuftBis;
  log(`abo-kuendigen ok ${art} ${eingabe.art}`);
  return antwort(200, {
    ok: true,
    vertrag: VERTRAG,
    art: eingabe.art,
    eingegangen_am: new Date(t).toISOString(),
    wirksam_zum: new Date(ende).toISOString(),
    pruefung: eingabe.art === 'ausserordentlich',
  });
}
