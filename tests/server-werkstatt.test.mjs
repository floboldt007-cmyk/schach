// Server-Teil der limitierten Editionen (Werkstatt, Etappe 1, nur Stripe-Testmodus), nur Node, ohne Browser, ohne Netz:
//   node tests/server-werkstatt.test.mjs
// Prueft supabase/functions/_gemeinsam/werkstatt.js (Kasse und Webhook mit gefaelschtem fetch fuer Supabase und
// Stripe), die beiden Deno-Huellen werkstatt-kasse/index.ts und werkstatt-webhook/index.ts (in Node mit Typ-Entfernung
// und einer Deno-Attrappe) und den Vertrag mit supabase/werkstatt-schema.sql (Parameternamen, Kennungen, Rechte, Regeln).
// Die SQL-Dateien selbst laufen im PGlite-Pruefer (Scratchpad) und im Supabase SQL Editor (supabase/werkstatt-rls-test.sql).
// Alle Betraege hier sind Testbetraege, kein Preis.
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import {
  KASSE_S, MAX_KOERPER_KASSE, MAX_KOERPER_WEBHOOK, STRIPE_API, RUECKKEHR_STANDARD, META_RESERVIERUNG, META_PRODUKT, META_PROJEKT,
  TYPEN, GRUENDE, KENNUNGEN, TEXTE, stripeArt, rueckkehrAus, projektKennung, pruefeKaufEingabe, kassenParameter,
  erstattungsParameter, auswertenEdition as auswertenEditionRoh, verarbeiteKasse, verarbeiteWebhook,
} from '../supabase/functions/_gemeinsam/werkstatt.js';
import { auswerten as auswertenAbo } from '../supabase/functions/_gemeinsam/stripe.js';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lies = (d) => readFileSync(path.join(WURZEL, d), 'utf8');

let ok = 0;
let gesamt = 0;
// eigene Ausgabe: der Test der Huellen faengt console.log ab (dort schreiben die Functions ihr Protokoll)
const ausgabe = console.log.bind(console);
function pruefe(name, bedingung, info) {
  gesamt++;
  if (bedingung) { ok++; ausgabe('ok     ' + name); } else ausgabe('FEHLER ' + name + (info !== undefined ? '  -> ' + JSON.stringify(info) : ''));
}

// Probe-Werte, nie echte: Schluessel werden zusammengesetzt, damit kein Muster fuer echte Schluessel im Code steht
const RK = ['rk', 'test', 'ProbeWerkstattNurTest01'].join('_');
const RK_LIVE = ['rk', 'live', 'ProbeWerkstattNurTest01'].join('_');
const SK = ['sk', 'test', 'ProbeWerkstattNurTest01'].join('_');
const GEHEIM = 'whsec_werkstatt_probe_nicht_echt';
const DIENST = 'sb_secret_probe';
const JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJwcm9iZSJ9.probe-signatur-nicht-echt';
const UID = '0f8b6c1e-2d3a-4b5c-8d9e-0a1b2c3d4e5f';
const FREMD = '11111111-2222-4333-8444-555555555555';
const RES = '5e7a1c2b-3d4e-4f50-8a1b-2c3d4e5f6a7b';
const TESTBETRAG = 1234; // Testbetrag, kein Preis
const T = Date.UTC(2026, 10, 1, 12, 0, 0); // 01.11.2026 12:00 UTC, in Millisekunden
const TS = T / 1000;
const UMGEBUNG = { SUPABASE_URL: 'https://probe.supabase.example/', SUPABASE_SERVICE_ROLE_KEY: DIENST, SUPABASE_ANON_KEY: 'anon-probe', STRIPE_RK: RK };
// Projektkennung dieses (Probe-)Projekts und eines zweiten Projekts am selben Stripe-Konto
const PROJEKT = await projektKennung(UMGEBUNG.SUPABASE_URL);
const PROJEKT_B = await projektKennung('https://anderes.supabase.example');
// Der Webhook ruft auswertenEdition immer mit der eigenen Kennung auf; die Tests tun dasselbe (ohne Kennung: eigene Pruefung)
const auswertenEdition = (e, projekt = PROJEKT) => auswertenEditionRoh(e, projekt);
const KAUF = { produkt: 'probe-edition', textversion: 'agb-2026-11', zustimmung_sofort: true, kenntnis_widerruf: true };
const SITZUNG = 'cs_test_a1B2c3D4';
const KASSEN_URL = `https://checkout.stripe.com/c/pay/${SITZUNG}#fidProbe`;
const resAntwort = (o = {}) => ({
  reservierung: RES, neu: true, produkt_id: 'probe-edition', name: 'Probe-Edition', stripe_preis: 'price_Probe1',
  betrag_cent: TESTBETRAG, waehrung: 'eur', kassen_url: null, kasse_bis_s: null, stripe_ablauf_s: TS + KASSE_S,
  kassenschluss_s: TS + 86400, verkauf_bis_s: TS + 86400 + KASSE_S, ...o,
});
const STANDARD_RPC = {
  edition_reserviere: () => resAntwort(),
  edition_kasse_setzen: () => 'gesetzt',
  edition_kasse_abbrechen: () => 'freigegeben',
  edition_stripe_ereignis: () => ({ ereignis: 'evt_x', ergebnis: 'zugeteilt', doppelt: false, nummer: 7, reservierung: RES, zahlung: 'pi_Probe1', erstatten: false, erstattung_grund: null }),
  edition_erstattung_gesendet: () => 'gesendet',
};

// Gefaelschtes fetch: Supabase (Anmeldung und RPC) und Stripe (Kasse, Erstattung). Antworten { status, body } oder
// { wirft: true } (Netz weg); Listen werden der Reihe nach verbraucht.
function server({ auth, rpc = {}, kasse = [], erstattung = [] } = {}) {
  const aufrufe = [];
  const aus = (x) => {
    if (x && x.wirft) throw new Error('offline');
    const status = x && Number.isInteger(x.status) ? x.status : 200;
    const body = x && 'body' in x ? x.body : undefined;
    return { ok: status < 400, status, async json() { if (body === undefined) throw new Error('leer'); return body; } };
  };
  const f = async (url, opt = {}) => {
    const e = { url, method: opt.method, headers: opt.headers || {}, body: opt.body };
    aufrufe.push(e);
    if (url.endsWith('/auth/v1/user')) {
      return aus(auth !== undefined ? auth : { status: 200, body: { id: UID, email: 'privat@example.invalid', email_confirmed_at: '2026-10-01T10:00:00Z' } });
    }
    const m = /\/rest\/v1\/rpc\/([a-z_]+)$/.exec(url);
    if (m) {
      e.rpc = m[1];
      e.daten = JSON.parse(opt.body);
      const h = rpc[m[1]];
      if (Array.isArray(h) && h.length) return aus(h.shift());
      if (typeof h === 'function') return aus(h(e.daten));
      if (h && typeof h === 'object' && !Array.isArray(h)) return aus(h);
      return aus({ status: 200, body: STANDARD_RPC[m[1]](e.daten) });
    }
    if (url === `${STRIPE_API}/checkout/sessions`) {
      e.stripe = 'kasse';
      e.form = new URLSearchParams(opt.body);
      return aus(kasse.length ? kasse.shift() : { status: 200, body: { id: SITZUNG, object: 'checkout.session', url: KASSEN_URL, expires_at: TS + KASSE_S, status: 'open' } });
    }
    if (url === `${STRIPE_API}/refunds`) {
      e.stripe = 'erstattung';
      e.form = new URLSearchParams(opt.body);
      return aus(erstattung.length ? erstattung.shift() : { status: 200, body: { id: 're_Probe1', object: 'refund', status: 'succeeded' } });
    }
    throw new Error('unerwartete Adresse ' + url);
  };
  f.aufrufe = aufrufe;
  f.rpcs = (name) => aufrufe.filter((a) => a.rpc === name);
  f.stripe = (art) => aufrufe.filter((a) => a.stripe === art);
  return f;
}
const json = (r) => JSON.parse(r.koerper);
const kaufAnfrage = (daten = KAUF, kopf = 'Bearer ' + JWT) => ({ methode: 'POST', koerper: typeof daten === 'string' ? daten : JSON.stringify(daten), autorisierung: kopf });
const kasse = async (f, { anfrage = kaufAnfrage(), umgebung = UMGEBUNG, jetzt = T, zeilen = [] } = {}) =>
  verarbeiteKasse(anfrage, umgebung, { fetch: f, jetzt, protokoll: (z) => zeilen.push(z) });

// ---------------------------------------------------------------------------
// Einstellungen und Eingabe
// ---------------------------------------------------------------------------
pruefe('Kassenschluss und Lebensdauer: 31 Minuten (Stripe verlangt mindestens 30, eine Minute Puffer)', KASSE_S === 1860);
pruefe('stripeArt: nur eingeschraenkte Schluessel, Test und Live unterschieden, sk_ ist immer falsch',
  stripeArt(RK) === 'test' && stripeArt(RK_LIVE) === 'live' && stripeArt(SK) === 'falsch' && stripeArt('') === 'fehlt'
  && stripeArt(undefined) === 'fehlt' && stripeArt('rk_test_kurz') === 'falsch' && stripeArt(' ' + RK + ' ') === 'test');
pruefe('rueckkehrAus: Standard die Live-Seite, nur https ohne # und ?', rueckkehrAus('') === RUECKKEHR_STANDARD
  && rueckkehrAus('https://probe.example/schach/') === 'https://probe.example/schach/' && rueckkehrAus('http://probe.example/') === null
  && rueckkehrAus('javascript:alert(1)') === null && rueckkehrAus('https://probe.example/#x') === null
  && RUECKKEHR_STANDARD === 'https://floboldt007-cmyk.github.io/schach/');
pruefe('projektKennung: 16 Hex-Zeichen aus dem Host (gleich mit und ohne Schraegstrich oder Pfad), je Projekt verschieden, ohne Adresse null',
  /^[0-9a-f]{16}$/.test(PROJEKT) && PROJEKT === await projektKennung('https://probe.supabase.example')
  && PROJEKT === await projektKennung('HTTPS://PROBE.supabase.example/rest/v1') && /^[0-9a-f]{16}$/.test(PROJEKT_B) && PROJEKT_B !== PROJEKT
  && await projektKennung('') === null && await projektKennung('keine adresse') === null && META_PROJEKT === 'crownmate_projekt');
pruefe('pruefeKaufEingabe: gueltig, nur produkt und textversion gehen weiter',
  JSON.stringify(pruefeKaufEingabe({ ...KAUF, nutzer: FREMD, betrag: 1 })) === JSON.stringify({ ok: true, eingabe: { produkt: 'probe-edition', textversion: 'agb-2026-11' } }));
pruefe('pruefeKaufEingabe: beide Erklaerungen muessen ausdruecklich true sein', ['zustimmung_sofort', 'kenntnis_widerruf']
  .every((k) => [false, 'true', 1, null, undefined].every((w) => pruefeKaufEingabe({ ...KAUF, [k]: w }).grund === 'zustimmung')));
pruefe('pruefeKaufEingabe: Form von produkt und textversion', pruefeKaufEingabe({ ...KAUF, produkt: 'Probe Edition' }).grund === 'produkt'
  && pruefeKaufEingabe({ ...KAUF, produkt: 'x' }).grund === 'produkt' && pruefeKaufEingabe({ ...KAUF, textversion: '' }).grund === 'textversion'
  && pruefeKaufEingabe(null).grund === 'form' && pruefeKaufEingabe([]).grund === 'form');

// ---------------------------------------------------------------------------
// Kasse: Ablehnungen vor jeder Datenbank- und Stripe-Anfrage
// ---------------------------------------------------------------------------
{
  const f = server();
  const o = await kasse(f, { anfrage: { methode: 'OPTIONS' } });
  const g = await kasse(f, { anfrage: { methode: 'GET' } });
  pruefe('OPTIONS 204 ohne Koerper mit CORS, GET 405', o.status === 204 && o.koerper === '' && o.kopf['Access-Control-Allow-Origin'] === '*'
    && g.status === 405 && json(g).fehler === 'methode' && f.aufrufe.length === 0);
  const zeilen = [];
  const ohneRk = await kasse(f, { umgebung: { ...UMGEBUNG, STRIPE_RK: '' }, zeilen });
  const live = await kasse(f, { umgebung: { ...UMGEBUNG, STRIPE_RK: RK_LIVE }, zeilen });
  const voll = await kasse(f, { umgebung: { ...UMGEBUNG, STRIPE_RK: SK }, zeilen });
  const ohneDb = await kasse(f, { umgebung: { ...UMGEBUNG, SUPABASE_SERVICE_ROLE_KEY: '' }, zeilen });
  const http = await kasse(f, { umgebung: { ...UMGEBUNG, WERKSTATT_RUECKKEHR: 'http://probe.example/' }, zeilen });
  const ohneProjekt = await kasse(f, { umgebung: { ...UMGEBUNG, SUPABASE_URL: 'kaputt' }, zeilen });
  pruefe('Nur Testmodus: ohne Schluessel, mit Live-Schluessel, mit vollem sk_-Schluessel, ohne Datenbank, mit http-Rueckkehr oder ohne Projektkennung 503 nicht_eingerichtet',
    [ohneRk, live, voll, ohneDb, http, ohneProjekt].every((r) => r.status === 503 && json(r).fehler === 'nicht_eingerichtet') && f.aufrufe.length === 0
    && zeilen.includes('werkstatt-kasse nicht_eingerichtet projekt')
    && zeilen.includes('werkstatt-kasse nicht_eingerichtet STRIPE_RK live') && zeilen.includes('werkstatt-kasse nicht_eingerichtet STRIPE_RK falsch'), zeilen);
  const ohne = await kasse(f, { anfrage: kaufAnfrage(KAUF, '') });
  const leer = await kasse(f, { anfrage: kaufAnfrage('') });
  const gross = await kasse(f, { anfrage: kaufAnfrage('x'.repeat(MAX_KOERPER_KASSE + 1)) });
  const kaputt = await kasse(f, { anfrage: kaufAnfrage('{kaputt') });
  const zust = await kasse(f, { anfrage: kaufAnfrage({ ...KAUF, kenntnis_widerruf: false }) });
  const prod = await kasse(f, { anfrage: kaufAnfrage({ ...KAUF, produkt: '../x' }) });
  pruefe('ohne Anmeldung 401, leer 400, zu gross 413, kein JSON 400, Erklaerung fehlt 400 zustimmung, Produkt kaputt 400',
    ohne.status === 401 && json(ohne).fehler === 'anmeldung' && leer.status === 400 && gross.status === 413 && kaputt.status === 400
    && zust.status === 400 && json(zust).fehler === 'zustimmung' && prod.status === 400 && json(prod).grund === 'produkt' && f.aufrufe.length === 0);
  pruefe('Fehlerantworten haben Deutsch und Englisch', typeof json(zust).text === 'string' && /Widerruf/.test(json(zust).text) && /withdrawal/.test(json(zust).text_en)
    && Object.values(TEXTE).every((t) => t.de && t.en));
}
{
  const a401 = server({ auth: { status: 401, body: { msg: 'invalid JWT' } } });
  const r1 = await kasse(a401);
  const aKey = server({ auth: { status: 401, body: { message: 'Invalid API key' } } });
  const r2 = await kasse(aKey);
  const a500 = server({ auth: { status: 500, body: {} } });
  const r3 = await kasse(a500);
  const aNetz = server({ auth: { wirft: true } });
  const r4 = await kasse(aNetz);
  pruefe('Anmeldung: abgelaufen 401, falscher Projekt-Schluessel 503 nicht_eingerichtet, Server- oder Netzfehler 503',
    r1.status === 401 && r2.status === 503 && json(r2).fehler === 'nicht_eingerichtet' && r3.status === 503 && r4.status === 503
    && [a401, aKey, a500, aNetz].every((f) => f.rpcs('edition_reserviere').length === 0));
  const unbest = server({ auth: { status: 200, body: { id: UID, email: 'x@example.invalid', email_confirmed_at: null } } });
  const r5 = await kasse(unbest);
  pruefe('E-Mail nicht bestaetigt: 403 email, keine Reservierung', r5.status === 403 && json(r5).fehler === 'email' && unbest.rpcs('edition_reserviere').length === 0);
  const ohneId = server({ auth: { status: 200, body: { id: 'flo' } } });
  pruefe('Antwort ohne gueltige Nutzer-ID: 401', (await kasse(ohneId)).status === 401);
}

// ---------------------------------------------------------------------------
// Kasse: der Regelfall
// ---------------------------------------------------------------------------
{
  const f = server();
  const zeilen = [];
  const r = await kasse(f, { anfrage: kaufAnfrage({ ...KAUF, nutzer: FREMD, user_id: FREMD }), zeilen });
  const d = json(r);
  const res = f.rpcs('edition_reserviere');
  pruefe('Kauf: 200 mit Kassen-Adresse, Reservierung, Ablauf und neu', r.status === 200 && d.kassen_url === KASSEN_URL && d.reservierung === RES
    && d.kasse_bis === new Date((TS + KASSE_S) * 1000).toISOString() && d.neu === true, d);
  pruefe('Nutzer-ID nur aus dem geprueften Token (eine ID in der Anfrage wird nie gelesen)', res.length === 1 && res[0].daten.nutzer === UID
    && !JSON.stringify(f.aufrufe.map((a) => a.body)).includes(FREMD));
  pruefe('edition_reserviere mit genau den Parametern der SQL-Funktion und dem Service-Schluessel',
    JSON.stringify(Object.keys(res[0].daten)) === JSON.stringify(['nutzer', 'produkt', 'textversion', 'zustimmung_sofort', 'kenntnis_widerruf'])
    && res[0].daten.zustimmung_sofort === true && res[0].daten.kenntnis_widerruf === true && res[0].daten.textversion === 'agb-2026-11'
    && res[0].headers.apikey === DIENST && !('Authorization' in res[0].headers));
  const a = f.aufrufe.find((x) => x.url.endsWith('/auth/v1/user'));
  pruefe('Anmeldung bei Supabase mit dem Token des Nutzers und dem oeffentlichen Schluessel', a && a.method === 'GET'
    && a.headers.Authorization === 'Bearer ' + JWT && a.headers.apikey === 'anon-probe');
  const s = f.stripe('kasse');
  const form = s[0] && s[0].form;
  pruefe('Stripe: genau eine Checkout Session, mit dem eingeschraenkten Schluessel, form-kodiert, Idempotency-Key je Reservierung',
    s.length === 1 && s[0].method === 'POST' && s[0].headers.Authorization === 'Bearer ' + RK
    && s[0].headers['Content-Type'] === 'application/x-www-form-urlencoded' && s[0].headers['Idempotency-Key'] === `crownmate-kasse-${RES}`);
  pruefe('Stripe-Kasse: mode=payment, Menge 1, nur Karte, Preis-ID aus der Datenbank, Ablauf = Reservierung + 31 Minuten',
    form.get('mode') === 'payment' && form.get('line_items[0][quantity]') === '1' && form.get('line_items[0][price]') === 'price_Probe1'
    && form.get('payment_method_types[0]') === 'card' && form.get('expires_at') === String(TS + KASSE_S) && ![...form.keys()].some((k) => /amount|unit_amount|price_data/.test(k)));
  pruefe('Stripe-Kasse: Reservierung und Produkt in den Metadaten von Sitzung und Zahlung, Rueckkehr nach #werkstatt',
    form.get(`metadata[${META_RESERVIERUNG}]`) === RES && form.get(`payment_intent_data[metadata][${META_RESERVIERUNG}]`) === RES
    && form.get(`metadata[${META_PRODUKT}]`) === 'probe-edition' && form.get(`payment_intent_data[metadata][${META_PRODUKT}]`) === 'probe-edition'
    && form.get('success_url') === RUECKKEHR_STANDARD + '#werkstatt' && form.get('cancel_url') === RUECKKEHR_STANDARD + '#werkstatt'
    && META_RESERVIERUNG === 'crownmate_reservierung');
  pruefe('Stripe-Kasse: Projektkennung in den Metadaten von Sitzung und Zahlung (zwei Projekte am selben Stripe-Konto)',
    form.get(`metadata[${META_PROJEKT}]`) === PROJEKT && form.get(`payment_intent_data[metadata][${META_PROJEKT}]`) === PROJEKT);
  pruefe('Stripe-Kasse: keine E-Mail, keine Nutzer-ID an Stripe', !s[0].body.includes('example.invalid') && !s[0].body.includes(UID));
  const g = f.rpcs('edition_kasse_setzen');
  pruefe('Kasse an die Reservierung gehaengt (Sitzung, Adresse, Ablauf)', g.length === 1
    && JSON.stringify(g[0].daten) === JSON.stringify({ reservierung: RES, sitzung: SITZUNG, kassen_url: KASSEN_URL, kasse_bis: d.kasse_bis }));
  pruefe('Antwort und Protokoll ohne Schluessel, Nutzer-ID oder E-Mail', ![RK, DIENST, UID, 'example.invalid'].some((x) => r.koerper.includes(x))
    && zeilen.length > 0 && zeilen.every((z) => /^werkstatt-kasse /.test(z) && ![RK, DIENST, UID, '@'].some((x) => z.includes(x))), zeilen);
  pruefe('kassenParameter: feste Reihenfolge, gleiche Eingabe gleiche Anfrage', kassenParameter({ reservierung: RES, produkt: 'p-1', projekt: PROJEKT, stripe_preis: 'price_A', ablauf_s: 5, rueckkehr: 'https://x.example/' }).toString()
    === kassenParameter({ rueckkehr: 'https://x.example/', ablauf_s: 5, stripe_preis: 'price_A', projekt: PROJEKT, produkt: 'p-1', reservierung: RES }).toString());
}
{
  // Ein spaeterer Versuch (die App fragt nach einem 503 neu) schickt Stripe genau dieselbe Anfrage mit demselben Key:
  // So liefert Stripe die schon angelegte Kasse, statt eine zweite anzulegen.
  const f1 = server();
  await kasse(f1, { jetzt: T });
  const f2 = server({ rpc: { edition_reserviere: { status: 200, body: resAntwort({ neu: false }) } } });
  const r = await kasse(f2, { jetzt: T + 7 * 60 * 1000 });
  pruefe('Neuer Versuch spaeter: gleiche Anfrage, gleicher Key (Ablauf aus der Reservierung, nicht aus der Uhr)', r.status === 200
    && f1.stripe('kasse')[0].body === f2.stripe('kasse')[0].body && f2.stripe('kasse')[0].headers['Idempotency-Key'] === `crownmate-kasse-${RES}`
    && json(r).neu === false);
}
{
  const f = server({ rpc: { edition_reserviere: { status: 200, body: resAntwort({ neu: false, kassen_url: KASSEN_URL, kasse_bis_s: TS + 600 }) } } });
  const r = await kasse(f);
  pruefe('Doppelklick: die Reservierung hat schon eine Kasse, dieselbe Adresse kommt zurueck, Stripe wird nicht gefragt',
    r.status === 200 && json(r).kassen_url === KASSEN_URL && json(r).neu === false && f.stripe('kasse').length === 0 && f.rpcs('edition_kasse_setzen').length === 0);
  const alt = server({ rpc: { edition_reserviere: { status: 200, body: resAntwort({ neu: false, kassen_url: KASSEN_URL, kasse_bis_s: TS - 1 }) } } });
  const r2 = await kasse(alt);
  pruefe('Kasse schon abgelaufen (Ereignis noch unterwegs): 409 kasse_abgelaufen, nichts freigegeben, keine neue Kasse',
    r2.status === 409 && json(r2).fehler === 'kasse_abgelaufen' && alt.stripe('kasse').length === 0 && alt.rpcs('edition_kasse_abbrechen').length === 0);
  const boese = server({ rpc: { edition_reserviere: { status: 200, body: resAntwort({ neu: false, kassen_url: 'javascript:alert(1)', kasse_bis_s: TS + 600 }) } } });
  pruefe('fremde Kassen-Adresse aus der Datenbank wird nie weitergegeben', (await kasse(boese)).status === 503);
}
{
  const vorbei = server({ rpc: { edition_reserviere: { status: 200, body: resAntwort({ kassenschluss_s: TS - 1 }) } } });
  const r = await kasse(vorbei);
  const ueber = server({ rpc: { edition_reserviere: { status: 200, body: resAntwort({ verkauf_bis_s: TS + KASSE_S - 1 }) } } });
  const r2 = await kasse(ueber);
  const genau = server({ rpc: { edition_reserviere: { status: 200, body: resAntwort({ kassenschluss_s: TS + 1 }) } } });
  const r3 = await kasse(genau);
  pruefe('Kassenschluss: danach oder wenn die Kasse das Ende ueberlebte, keine Kasse, Reservierung frei, 409 beendet; eine Sekunde davor geht es',
    r.status === 409 && json(r).fehler === 'beendet' && vorbei.stripe('kasse').length === 0 && vorbei.rpcs('edition_kasse_abbrechen').length === 1
    && vorbei.rpcs('edition_kasse_abbrechen')[0].daten.reservierung === RES
    && r2.status === 409 && ueber.stripe('kasse').length === 0 && r3.status === 200 && genau.stripe('kasse').length === 1);
}
{
  // Kennungen der Datenbank -> Status und Fehler fuer die App
  const ergebnisse = {};
  for (const [kennung, [status, fehler]] of Object.entries(KENNUNGEN)) {
    const f = server({ rpc: { edition_reserviere: { status: 400, body: { code: 'P0001', message: kennung } } } });
    const r = await kasse(f);
    ergebnisse[kennung] = r.status === status && json(r).fehler === fehler && f.stripe('kasse').length === 0;
  }
  pruefe(`alle ${Object.keys(KENNUNGEN).length} Kennungen aus edition_reserviere werden richtig beantwortet, ohne Stripe`, Object.values(ergebnisse).every(Boolean), ergebnisse);
  pruefe('Kennungen: Alter 403, ausverkauft und nicht verfuegbar 409, unbekannt 404', KENNUNGEN.EDITION_ALTER[0] === 403
    && KENNUNGEN.EDITION_AUSVERKAUFT[1] === 'ausverkauft' && KENNUNGEN.EDITION_NICHT_VERFUEGBAR[1] === 'nicht_verfuegbar' && KENNUNGEN.EDITION_UNBEKANNT[0] === 404);
  const oft = server({ rpc: { edition_reserviere: { status: 400, body: { code: 'P0001', message: 'EDITION_ZU_OFT' } } } });
  const rOft = await kasse(oft);
  pruefe('Mehr als 3 Kassen je Konto und Edition in 24 Stunden: 429 zu_oft, ruhiger Text auf Deutsch und Englisch, keine Kasse',
    rOft.status === 429 && json(rOft).fehler === 'zu_oft' && /24 Stunden/.test(json(rOft).text) && /24 hours/.test(json(rOft).text_en)
    && oft.stripe('kasse').length === 0 && !/nur noch|beeil|schnell|letzte Gelegenheit/i.test(TEXTE.zu_oft.de));
  const fremd = server({ rpc: { edition_reserviere: { status: 400, body: { message: 'irgendwas' } } } });
  const netz = server({ rpc: { edition_reserviere: { wirft: true } } });
  const kaputt = server({ rpc: { edition_reserviere: { status: 200, body: { reservierung: 'x' } } } });
  pruefe('Datenbankfehler, Netz weg oder kaputte Antwort: 503 server, keine Kasse', [(await kasse(fremd)), (await kasse(netz)), (await kasse(kaputt))]
    .every((r) => r.status === 503 && json(r).fehler === 'server') && [fremd, netz, kaputt].every((f) => f.stripe('kasse').length === 0));
}
{
  // Stripe antwortet nicht sicher: einmal mit demselben Key wiederholen, dann stehen lassen (nie sofort freigeben)
  const einmal = server({ kasse: [{ wirft: true }] });
  const r1 = await kasse(einmal);
  const k = einmal.stripe('kasse');
  pruefe('Stripe-Netzfehler: zweiter Versuch mit derselben Anfrage und demselben Key, dann 200', r1.status === 200 && k.length === 2
    && k[0].body === k[1].body && k[0].headers['Idempotency-Key'] === k[1].headers['Idempotency-Key']);
  const zweimal = server({ kasse: [{ status: 500, body: {} }, { status: 503, body: {} }] });
  const r2 = await kasse(zweimal);
  pruefe('Stripe zweimal 5xx: 503 stripe, Reservierung bleibt (kein Abbruch, keine Kasse gesetzt)', r2.status === 503 && json(r2).fehler === 'stripe'
    && zweimal.stripe('kasse').length === 2 && zweimal.rpcs('edition_kasse_abbrechen').length === 0 && zweimal.rpcs('edition_kasse_setzen').length === 0);
  const laeuft = server({ kasse: [{ status: 409, body: { error: { type: 'idempotency_error', code: 'idempotency_key_in_use' } } }] });
  pruefe('Stripe 409 (derselbe Key laeuft noch): wiederholen', (await kasse(laeuft)).status === 200 && laeuft.stripe('kasse').length === 2);
  const idem = server({ kasse: [{ status: 400, body: { error: { type: 'idempotency_error' } } }, { status: 400, body: { error: { type: 'idempotency_error' } } }] });
  const r3 = await kasse(idem);
  pruefe('Idempotenz-Fehler (eine Kasse koennte es geben): nicht freigeben, 503', r3.status === 503 && idem.rpcs('edition_kasse_abbrechen').length === 0);
  const nein = server({ kasse: [{ status: 400, body: { error: { type: 'invalid_request_error', code: 'resource_missing' } } }] });
  const zeilen = [];
  const r4 = await kasse(nein, { zeilen });
  pruefe('Stripe lehnt sicher ab (400): keine Kasse, Reservierung frei, 502 stripe', r4.status === 502 && json(r4).fehler === 'stripe'
    && nein.stripe('kasse').length === 1 && nein.rpcs('edition_kasse_abbrechen').length === 1 && zeilen.some((z) => z.includes('stripe_abgelehnt 400 resource_missing')), zeilen);
  const schl = server({ kasse: [{ status: 401, body: { error: { type: 'invalid_request_error' } } }] });
  const r5 = await kasse(schl);
  pruefe('Stripe-Schluessel ungueltig (401): Reservierung frei, 503 nicht_eingerichtet', r5.status === 503 && json(r5).fehler === 'nicht_eingerichtet'
    && schl.rpcs('edition_kasse_abbrechen').length === 1);
  const komisch = server({ kasse: [{ status: 200, body: { id: SITZUNG, url: 'https://boese.example/pay' } }] });
  pruefe('Stripe-Antwort ohne Kassen-Adresse von checkout.stripe.com: 503, nichts gespeichert', (await kasse(komisch)).status === 503
    && komisch.rpcs('edition_kasse_setzen').length === 0);
  const db = server({ rpc: { edition_kasse_setzen: { status: 500, body: {} } } });
  const r6 = await kasse(db);
  pruefe('Kasse angelegt, aber nicht gespeichert: 503 server, Reservierung bleibt (der naechste Versuch holt dieselbe Kasse)',
    r6.status === 503 && json(r6).fehler === 'server' && db.rpcs('edition_kasse_abbrechen').length === 0);
}

// ---------------------------------------------------------------------------
// Webhook: Auswertung der Ereignisse
// ---------------------------------------------------------------------------
const iso = (s) => new Date(s * 1000).toISOString();
const ereignis = (type, object, extra = {}) => ({ id: 'evt_1W' + type.replace(/[^a-z]/g, '').slice(0, 20), object: 'event', type, created: TS, livemode: false, data: { object }, ...extra });
const sitzung = (o = {}) => ({ id: SITZUNG, object: 'checkout.session', mode: 'payment', payment_status: 'paid', status: 'complete',
  payment_intent: 'pi_Probe1', amount_total: TESTBETRAG, currency: 'eur', customer_details: { email: 'privat@example.invalid' },
  metadata: { [META_RESERVIERUNG]: RES, [META_PRODUKT]: 'probe-edition', [META_PROJEKT]: PROJEKT }, ...o });
const charge = (o = {}) => ({ id: 'ch_Probe1', object: 'charge', payment_intent: 'pi_Probe1', amount: TESTBETRAG, amount_refunded: TESTBETRAG,
  currency: 'eur', refunded: true, billing_details: { email: 'privat@example.invalid' }, ...o });
const streit = (o = {}) => ({ id: 'dp_Probe1', object: 'dispute', payment_intent: 'pi_Probe1', charge: 'ch_Probe1', status: 'needs_response', ...o });
{
  const a = auswertenEdition(ereignis('checkout.session.completed', sitzung()));
  pruefe('Kauf bezahlt: genau die Parameter von edition_stripe_ereignis, ohne E-Mail', JSON.stringify(a.daten) === JSON.stringify({
    ereignis_id: 'evt_1Wcheckoutsessioncompl', typ: 'checkout.session.completed', erstellt: iso(TS), reservierung: RES, sitzung: SITZUNG,
    zahlung: 'pi_Probe1', zahlstatus: 'paid', betrag: TESTBETRAG, waehrung: 'eur', erstattet: null, grund: null, streit: null,
  }) && !JSON.stringify(a).includes('example.invalid'), a);
  pruefe('Abo-Kauf (mode=subscription) gehoert dem Abo-Webhook: ignoriert', auswertenEdition(ereignis('checkout.session.completed', sitzung({ mode: 'subscription' }))).ignoriert === 'kein_kauf');
  pruefe('Kasse ohne Werkstatt-Metadaten (fremder Einmalkauf): ignoriert', auswertenEdition(ereignis('checkout.session.completed', sitzung({ metadata: {} }))).ignoriert === 'fremd'
    && auswertenEdition(ereignis('checkout.session.completed', sitzung({ metadata: { [META_RESERVIERUNG]: 'drop table', [META_PROJEKT]: PROJEKT } }))).ignoriert === 'fremd');
  const fremdesProjekt = { [META_RESERVIERUNG]: RES, [META_PRODUKT]: 'probe-edition', [META_PROJEKT]: PROJEKT_B };
  pruefe('Kasse eines anderen Projekts am selben Stripe-Konto, ohne Kennung oder ohne eigene Kennung: ignoriert (nie verbuchen, nie erstatten)',
    auswertenEdition(ereignis('checkout.session.completed', sitzung({ metadata: fremdesProjekt }))).ignoriert === 'fremdes_projekt'
    && auswertenEdition(ereignis('checkout.session.expired', sitzung({ metadata: fremdesProjekt, status: 'expired' }))).ignoriert === 'fremdes_projekt'
    && auswertenEdition(ereignis('checkout.session.completed', sitzung({ metadata: { [META_RESERVIERUNG]: RES } }))).ignoriert === 'fremdes_projekt'
    && auswertenEditionRoh(ereignis('checkout.session.completed', sitzung())).ignoriert === 'fremdes_projekt'
    && auswertenEditionRoh(ereignis('checkout.session.completed', sitzung({ metadata: { [META_RESERVIERUNG]: RES } }))).ignoriert === 'fremdes_projekt'
    && auswertenEdition(ereignis('checkout.session.completed', sitzung()), PROJEKT_B).ignoriert === 'fremdes_projekt'
    && auswertenEdition(ereignis('checkout.session.completed', sitzung({ mode: 'subscription', metadata: fremdesProjekt }))).ignoriert === 'kein_kauf');
  pruefe('Waehrung klein, Zahlung als Objekt, Reservierung klein', auswertenEdition(ereignis('checkout.session.completed', sitzung({ currency: 'EUR', payment_intent: { id: 'pi_Obj1' },
    metadata: { [META_RESERVIERUNG]: RES.toUpperCase(), [META_PROJEKT]: PROJEKT } }))).daten.waehrung === 'eur'
    && auswertenEdition(ereignis('checkout.session.completed', sitzung({ payment_intent: { id: 'pi_Obj1' } }))).daten.zahlung === 'pi_Obj1'
    && auswertenEdition(ereignis('checkout.session.completed', sitzung({ metadata: { [META_RESERVIERUNG]: RES.toUpperCase(), [META_PROJEKT]: PROJEKT } }))).daten.reservierung === RES);
  const offen = auswertenEdition(ereignis('checkout.session.completed', sitzung({ payment_status: 'unpaid', payment_intent: null })));
  pruefe('Kasse ohne Zahlung (unpaid): weiter an die Datenbank (die sagt nicht_bezahlt)', offen.daten && offen.daten.zahlstatus === 'unpaid' && offen.daten.zahlung === null);
  pruefe('bezahlt ohne Zahlung, ohne Betrag oder Waehrung: ignoriert (Form)', auswertenEdition(ereignis('checkout.session.completed', sitzung({ payment_intent: null }))).ignoriert === 'keine_zahlung'
    && auswertenEdition(ereignis('checkout.session.completed', sitzung({ amount_total: null }))).ignoriert === 'form'
    && auswertenEdition(ereignis('checkout.session.completed', sitzung({ currency: 'euro' }))).ignoriert === 'form');
  const ab = auswertenEdition(ereignis('checkout.session.expired', sitzung({ status: 'expired', payment_status: 'unpaid', payment_intent: null })));
  pruefe('Kasse abgelaufen: Reservierung und Sitzung', ab.daten && ab.daten.typ === 'checkout.session.expired' && ab.daten.reservierung === RES
    && ab.daten.sitzung === SITZUNG && ab.daten.zahlung === null && ab.daten.betrag === null);
  const voll = auswertenEdition(ereignis('charge.refunded', charge({ refunds: { data: [{ id: 're_1', created: TS - 9, metadata: { grund: 'kulanz' } },
    { id: 're_2', created: TS, metadata: { grund: 'widerruf' } }] } })));
  pruefe('Erstattung: Zahlung, Betrag, erstattet und Grund aus der neuesten Erstattung', voll.daten && voll.daten.zahlung === 'pi_Probe1'
    && voll.daten.betrag === TESTBETRAG && voll.daten.erstattet === TESTBETRAG && voll.daten.grund === 'widerruf' && voll.daten.reservierung === null);
  pruefe('Erstattung ohne Grund (neuere Stripe-API) oder mit fremdem Grund: grund null', auswertenEdition(ereignis('charge.refunded', charge())).daten.grund === null
    && auswertenEdition(ereignis('charge.refunded', charge({ refunds: { data: [{ metadata: { grund: 'egal' } }] } }))).daten.grund === null);
  pruefe('Zahlungs-Ereignis mit der Kennung eines anderen Projekts: ignoriert; mit eigener oder ohne Kennung: an die Datenbank',
    auswertenEdition(ereignis('charge.refunded', charge({ metadata: { [META_PROJEKT]: PROJEKT_B } }))).ignoriert === 'fremdes_projekt'
    && auswertenEdition(ereignis('charge.dispute.created', streit({ metadata: { [META_PROJEKT]: PROJEKT_B } }))).ignoriert === 'fremdes_projekt'
    && auswertenEdition(ereignis('charge.refunded', charge({ metadata: { [META_PROJEKT]: PROJEKT } }))).daten.zahlung === 'pi_Probe1'
    && auswertenEdition(ereignis('charge.dispute.created', streit({ metadata: {} }))).daten.zahlung === 'pi_Probe1');
  const teil = auswertenEdition(ereignis('charge.refunded', charge({ amount_refunded: 500, refunded: false })));
  pruefe('Teilerstattung: erstattet < Betrag (die Datenbank laesst das Stueck aktiv)', teil.daten.erstattet === 500 && teil.daten.betrag === TESTBETRAG);
  const s1 = auswertenEdition(ereignis('charge.dispute.created', streit()));
  const s2 = auswertenEdition(ereignis('charge.dispute.closed', streit({ status: 'lost' })));
  pruefe('Rueckbuchung eroeffnet und geschlossen: Zahlung und Status', s1.daten.zahlung === 'pi_Probe1' && s1.daten.streit === 'needs_response'
    && s2.daten.streit === 'lost' && s2.daten.typ === 'charge.dispute.closed');
  pruefe('Zahlungsereignisse ohne Zahlung (z. B. Abo-Rechnung ohne payment_intent): ignoriert', auswertenEdition(ereignis('charge.refunded', charge({ payment_intent: null }))).ignoriert === 'keine_zahlung'
    && auswertenEdition(ereignis('charge.dispute.closed', streit({ status: null }))).ignoriert === 'form');
  pruefe('andere Typen (Abo-Ereignisse, invoice.paid) und kaputte Ereignisse: ignoriert', auswertenEdition(ereignis('invoice.paid', {})).ignoriert === 'typ'
    && auswertenEdition(ereignis('customer.subscription.updated', {})).ignoriert === 'typ' && auswertenEdition(null).ignoriert === 'form'
    && auswertenEdition({ ...ereignis('checkout.session.completed', sitzung()), id: 'x' }).ignoriert === 'form'
    && auswertenEdition({ ...ereignis('checkout.session.completed', sitzung()), created: 'gestern' }).ignoriert === 'form'
    && auswertenEdition(ereignis('checkout.session.completed', sitzung({ id: 'cs test' }))).ignoriert === 'form');
  pruefe('TYPEN: genau die fuenf aus dem Auftrag', JSON.stringify(TYPEN) === JSON.stringify(['checkout.session.completed', 'checkout.session.expired',
    'charge.refunded', 'charge.dispute.created', 'charge.dispute.closed']) && Object.isFrozen(TYPEN));
  // Der Abo-Webhook bleibt, wie er ist: Er verschluckt jeden Einmalkauf (deshalb der Warnsatz in der Anleitung)
  pruefe('Abo-Webhook unveraendert: ein Editions-Kauf (mode=payment) ist dort "kein_abo"', auswertenAbo(ereignis('checkout.session.completed', sitzung({ customer: 'cus_Probe1' }))).ignoriert === 'kein_abo');
}

// ---------------------------------------------------------------------------
// Webhook: verarbeiten (Signatur, Datenbank, automatische Erstattung)
// ---------------------------------------------------------------------------
const signiere = (koerper, t = TS, geheim = GEHEIM) => `t=${t},v1=${createHmac('sha256', geheim).update(`${t}.${koerper}`).digest('hex')}`;
const W_UMGEBUNG = { STRIPE_WERKSTATT_WEBHOOK_SECRET: GEHEIM, SUPABASE_URL: 'https://probe.supabase.example', SUPABASE_SERVICE_ROLE_KEY: DIENST, STRIPE_RK: RK };
const hook = async (f, e, { umgebung = W_UMGEBUNG, jetzt = T + 2000, geheim = GEHEIM, koerper, zeilen = [] } = {}) => {
  const k = koerper !== undefined ? koerper : JSON.stringify(e);
  return verarbeiteWebhook({ methode: 'POST', koerper: k, signatur: signiere(k, TS, geheim) }, umgebung, { fetch: f, jetzt, protokoll: (z) => zeilen.push(z) });
};
const KAUF_EREIGNIS = ereignis('checkout.session.completed', sitzung());
const erstatten = (o = {}) => ({ status: 200, body: { ereignis: KAUF_EREIGNIS.id, ergebnis: 'erstatten', doppelt: false, nummer: null, reservierung: RES,
  zahlung: 'pi_Probe1', erstatten: true, erstattung_grund: 'ausverkauft', ...o } });
{
  const f = server();
  const zeilen = [];
  const r = await hook(f, KAUF_EREIGNIS, { zeilen });
  const v = f.rpcs('edition_stripe_ereignis');
  pruefe('gueltiger Kauf: 200, genau ein RPC an edition_stripe_ereignis mit den ausgewerteten Daten, keine Erstattung',
    r.status === 200 && json(r).ergebnis === 'zugeteilt' && v.length === 1 && JSON.stringify(v[0].daten) === JSON.stringify(auswertenEdition(KAUF_EREIGNIS).daten)
    && v[0].headers.apikey === DIENST && f.stripe('erstattung').length === 0, { r: r.koerper });
  pruefe('Antwort und Protokoll ohne Geheimnis, Schluessel oder E-Mail', ![GEHEIM, RK, DIENST, '@'].some((x) => r.koerper.includes(x))
    && zeilen.every((z) => /^werkstatt-webhook /.test(z) && ![GEHEIM, RK, DIENST, '@'].some((x) => z.includes(x))), zeilen);
  const ohneRk = server();
  const r2 = await hook(ohneRk, KAUF_EREIGNIS, { umgebung: { ...W_UMGEBUNG, STRIPE_RK: '' } });
  pruefe('ohne Stripe-Schluessel geht alles ausser Erstattungen (Zuteilung braucht keinen)', r2.status === 200 && json(r2).ergebnis === 'zugeteilt');
}
{
  const f = server();
  const alt = await hook(f, KAUF_EREIGNIS, { jetzt: T + 400 * 1000 });
  const falsch = await hook(f, KAUF_EREIGNIS, { geheim: 'whsec_falsch_probe' });
  const abo = await hook(f, KAUF_EREIGNIS, { geheim: 'whsec_abo_geheimnis_probe' });
  const kein = await hook(f, null, { koerper: '{kaputt' });
  const leer = await verarbeiteWebhook({ methode: 'POST', koerper: '', signatur: signiere('') }, W_UMGEBUNG, { fetch: f, jetzt: T });
  const gross = 'x'.repeat(MAX_KOERPER_WEBHOOK + 1);
  const zuGross = await verarbeiteWebhook({ methode: 'POST', koerper: gross, signatur: signiere(gross) }, W_UMGEBUNG, { fetch: f, jetzt: T });
  const get = await verarbeiteWebhook({ methode: 'GET' }, W_UMGEBUNG, { fetch: f, jetzt: T });
  const ohne = await hook(f, KAUF_EREIGNIS, { umgebung: { ...W_UMGEBUNG, STRIPE_WERKSTATT_WEBHOOK_SECRET: '' } });
  pruefe('Signatur: zu alt, falsches oder das Abo-Geheimnis 400; kein JSON 400, leer 400, zu gross 413, GET 405, ohne Geheimnis 500; nie Datenbank',
    alt.status === 400 && json(alt).grund === 'zeit' && falsch.status === 400 && abo.status === 400 && kein.status === 400 && leer.status === 400
    && zuGross.status === 413 && get.status === 405 && ohne.status === 500 && f.aufrufe.length === 0);
  const ign = await hook(f, ereignis('checkout.session.completed', sitzung({ mode: 'subscription' })));
  pruefe('Abo-Kauf am Werkstatt-Endpunkt: 200 ignoriert, keine Datenbank', ign.status === 200 && json(ign).ignoriert === 'kein_kauf' && f.aufrufe.length === 0);
}
{
  const f = server({ rpc: { edition_stripe_ereignis: erstatten() } });
  const zeilen = [];
  const r = await hook(f, KAUF_EREIGNIS, { zeilen });
  const e = f.stripe('erstattung');
  pruefe('erstatten: Stripe-Erstattung mit Zahlung, Grund, Reservierung und Idempotency-Key je Zahlung, dann als gesendet gemeldet',
    r.status === 200 && json(r).erstattet === true && json(r).grund === 'ausverkauft' && e.length === 1 && e[0].headers.Authorization === 'Bearer ' + RK
    && e[0].headers['Idempotency-Key'] === 'crownmate-erstattung-pi_Probe1' && e[0].form.get('payment_intent') === 'pi_Probe1'
    && e[0].form.get('metadata[grund]') === 'ausverkauft' && e[0].form.get(`metadata[${META_RESERVIERUNG}]`) === RES
    && JSON.stringify(f.rpcs('edition_erstattung_gesendet').map((x) => x.daten)) === JSON.stringify([{ ereignis_id: KAUF_EREIGNIS.id }])
    && zeilen.includes('werkstatt-webhook checkout.session.completed erstattet ausverkauft'), { r: r.koerper, zeilen });
  pruefe('erstattungsParameter: ohne Reservierung nur Zahlung und Grund', erstattungsParameter({ zahlung: 'pi_X1', grund: 'unbekannt' }).toString()
    === 'payment_intent=pi_X1&metadata%5Bgrund%5D=unbekannt');
  const kaputt = server({ rpc: { edition_stripe_ereignis: erstatten() }, erstattung: [{ status: 500, body: {} }] });
  const r2 = await hook(kaputt, KAUF_EREIGNIS);
  pruefe('Erstattung scheitert: 500 (Stripe stellt erneut zu), nicht als gesendet gemeldet', r2.status === 500 && kaputt.rpcs('edition_erstattung_gesendet').length === 0);
  const netz = server({ rpc: { edition_stripe_ereignis: erstatten() }, erstattung: [{ wirft: true }] });
  pruefe('Erstattung ohne Netz: 500', (await hook(netz, KAUF_EREIGNIS)).status === 500 && netz.rpcs('edition_erstattung_gesendet').length === 0);
  const schon = server({ rpc: { edition_stripe_ereignis: erstatten() }, erstattung: [{ status: 400, body: { error: { type: 'invalid_request_error', code: 'charge_already_refunded' } } }] });
  pruefe('schon erstattet (charge_already_refunded): gilt als erledigt', (await hook(schon, KAUF_EREIGNIS)).status === 200 && schon.rpcs('edition_erstattung_gesendet').length === 1);
  const anders = server({ rpc: { edition_stripe_ereignis: erstatten() }, erstattung: [{ status: 400, body: { error: { type: 'invalid_request_error', code: 'parameter_invalid' } } }] });
  pruefe('andere Ablehnung der Erstattung: 500', (await hook(anders, KAUF_EREIGNIS)).status === 500);
  // doppelt zugestellt, Erstattung noch offen: noch einmal mit demselben Key (Stripe zahlt nur einmal aus)
  const doppelt = server({ rpc: { edition_stripe_ereignis: erstatten({ doppelt: true }) } });
  const r3 = await hook(doppelt, KAUF_EREIGNIS);
  pruefe('doppeltes Ereignis mit offener Erstattung: Erstattung mit demselben Key wiederholt', r3.status === 200
    && doppelt.stripe('erstattung')[0].headers['Idempotency-Key'] === 'crownmate-erstattung-pi_Probe1');
  const fertig = server({ rpc: { edition_stripe_ereignis: erstatten({ doppelt: true, erstatten: false }) } });
  const r4 = await hook(fertig, KAUF_EREIGNIS);
  pruefe('doppeltes Ereignis, Erstattung schon gesendet: 200 doppelt, keine zweite Erstattung', r4.status === 200 && json(r4).doppelt === true && fertig.stripe('erstattung').length === 0);
  const ohneRk = server({ rpc: { edition_stripe_ereignis: erstatten() } });
  const live = server({ rpc: { edition_stripe_ereignis: erstatten() } });
  pruefe('Erstattung ohne oder mit Live-Schluessel (Etappe 1 nur Testmodus): 500, keine Stripe-Anfrage',
    (await hook(ohneRk, KAUF_EREIGNIS, { umgebung: { ...W_UMGEBUNG, STRIPE_RK: '' } })).status === 500 && ohneRk.stripe('erstattung').length === 0
    && (await hook(live, KAUF_EREIGNIS, { umgebung: { ...W_UMGEBUNG, STRIPE_RK: RK_LIVE } })).status === 500 && live.stripe('erstattung').length === 0);
  const ohneZahlung = server({ rpc: { edition_stripe_ereignis: erstatten({ zahlung: null }) } });
  pruefe('erstatten ohne Zahlung aus der Datenbank: 500, keine Stripe-Anfrage', (await hook(ohneZahlung, KAUF_EREIGNIS)).status === 500 && ohneZahlung.stripe('erstattung').length === 0);
  const gesendetFehlt = server({ rpc: { edition_stripe_ereignis: erstatten(), edition_erstattung_gesendet: { status: 500, body: {} } } });
  pruefe('Erstattung ok, Meldung an die Datenbank scheitert: 500 (beim naechsten Mal wiederholt mit demselben Key)', (await hook(gesendetFehlt, KAUF_EREIGNIS)).status === 500);
}
{
  // Zwei Supabase-Projekte (Test und echt) am selben Stripe-Konto: Jeder Webhook bekommt die Kaeufe beider Projekte.
  const kaufB = ereignis('checkout.session.completed', sitzung({ metadata: { [META_RESERVIERUNG]: RES, [META_PRODUKT]: 'probe-edition', [META_PROJEKT]: PROJEKT_B } }));
  const a = server({ rpc: { edition_stripe_ereignis: erstatten({ erstattung_grund: 'unbekannt' }) } });
  const zeilen = [];
  const r = await hook(a, kaufB, { zeilen });
  const b = server();
  const rB = await hook(b, kaufB, { umgebung: { ...W_UMGEBUNG, SUPABASE_URL: 'https://anderes.supabase.example' } });
  pruefe('Kauf aus Projekt B am Webhook von Projekt A: 200 ignoriert, keine Datenbank, keine Erstattung; Projekt B verbucht ihn selbst',
    r.status === 200 && json(r).ignoriert === 'fremdes_projekt' && a.aufrufe.length === 0
    && rB.status === 200 && json(rB).ergebnis === 'zugeteilt' && b.rpcs('edition_stripe_ereignis').length === 1 && b.stripe('erstattung').length === 0, { r: r.koerper, rB: rB.koerper });
  const vonHand = server({ rpc: { edition_stripe_ereignis: { status: 200, body: { ereignis: KAUF_EREIGNIS.id, ergebnis: 'unbekannt', doppelt: false, nummer: null,
    reservierung: RES, zahlung: 'pi_Probe1', erstatten: false, von_hand: true, erstattung_grund: 'unbekannt' } } } });
  const z2 = [];
  const rH = await hook(vonHand, KAUF_EREIGNIS, { zeilen: z2 });
  pruefe('Datenbank kennt die Reservierung nicht (von_hand): 200, nie automatisch erstattet, im Protokoll markiert',
    rH.status === 200 && json(rH).von_hand === true && json(rH).ergebnis === 'unbekannt' && vonHand.stripe('erstattung').length === 0
    && vonHand.rpcs('edition_erstattung_gesendet').length === 0 && z2.includes('werkstatt-webhook checkout.session.completed unbekannt von_hand'), { k: rH.koerper, z2 });
  const ohneProjekt = server();
  pruefe('Webhook ohne gueltige Projektadresse: 500, keine Datenbank', (await hook(ohneProjekt, KAUF_EREIGNIS, { umgebung: { ...W_UMGEBUNG, SUPABASE_URL: 'kaputt' } })).status === 500
    && ohneProjekt.aufrufe.length === 0);
}
{
  const kaputt = server({ rpc: { edition_stripe_ereignis: { status: 400, body: { code: 'P0001', message: 'EDITION_EREIGNIS_UNGUELTIG' } } } });
  const weg = server({ rpc: { edition_stripe_ereignis: { wirft: true } } });
  pruefe('Datenbank-Fehler oder nicht erreichbar: 500, damit Stripe wiederholt', (await hook(kaputt, KAUF_EREIGNIS)).status === 500 && (await hook(weg, KAUF_EREIGNIS)).status === 500);
  const f = server({ rpc: { edition_stripe_ereignis: (d) => ({ status: 200, body: { ergebnis: d.typ === 'charge.dispute.created' ? 'strittig' : 'freigegeben', erstatten: false } }) } });
  const r1 = await hook(f, ereignis('checkout.session.expired', sitzung({ payment_status: 'unpaid', payment_intent: null })));
  const r2 = await hook(f, ereignis('charge.dispute.created', streit()));
  pruefe('Ablauf und Rueckbuchung gehen an die Datenbank, ohne Erstattung', json(r1).ergebnis === 'freigegeben' && json(r2).ergebnis === 'strittig'
    && f.rpcs('edition_stripe_ereignis').length === 2 && f.stripe('erstattung').length === 0);
}

// ---------------------------------------------------------------------------
// Deno-Huellen (Node entfernt die Typen; Deno ist hier nicht installiert)
// ---------------------------------------------------------------------------
{
  const kasseTs = lies('supabase/functions/werkstatt-kasse/index.ts');
  const hookTs = lies('supabase/functions/werkstatt-webhook/index.ts');
  pruefe('werkstatt-kasse/index.ts: nur die Huelle (verarbeiteKasse aus _gemeinsam, Secrets aus Deno.env, MIT JWT-Pruefung)',
    /^import \{ verarbeiteKasse \} from '\.\.\/_gemeinsam\/werkstatt\.js';$/m.test(kasseTs) && (kasseTs.match(/^import /gm) || []).length === 1
    && ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'STRIPE_RK', 'WERKSTATT_RUECKKEHR'].every((k) => kasseTs.includes(`Deno.env.get('${k}')`))
    && /deploy werkstatt-kasse$/m.test(kasseTs) && !/deploy werkstatt-kasse --no-verify-jwt/.test(kasseTs) && kasseTs.split('\n').length < 40
    && /headers\.get\('authorization'\)/.test(kasseTs));
  pruefe('werkstatt-webhook/index.ts: nur die Huelle (verarbeiteWebhook, eigenes Geheimnis, stripe-signature, --no-verify-jwt)',
    /^import \{ verarbeiteWebhook \} from '\.\.\/_gemeinsam\/werkstatt\.js';$/m.test(hookTs) && (hookTs.match(/^import /gm) || []).length === 1
    && ['STRIPE_WERKSTATT_WEBHOOK_SECRET', 'STRIPE_RK', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'].every((k) => hookTs.includes(`Deno.env.get('${k}')`))
    && !hookTs.includes("Deno.env.get('STRIPE_WEBHOOK_SECRET')") && /headers\.get\('stripe-signature'\)/.test(hookTs)
    && /deploy werkstatt-webhook --no-verify-jwt/.test(hookTs) && hookTs.split('\n').length < 40);
  if (process.features && process.features.typescript) {
    const echtesFetch = globalThis.fetch;
    const log = console.log;
    const zeilen = [];
    console.log = (...a) => zeilen.push(a.join(' '));
    try {
      // Kasse
      const jetztS = Math.floor(Date.now() / 1000);
      const f = server({ rpc: { edition_reserviere: { status: 200, body: resAntwort({ stripe_ablauf_s: jetztS + KASSE_S, kassenschluss_s: jetztS + 86400, verkauf_bis_s: jetztS + 90000 }) } },
        kasse: [{ status: 200, body: { id: SITZUNG, url: KASSEN_URL, expires_at: jetztS + KASSE_S } }] });
      globalThis.fetch = f;
      let handler = null;
      const env = { SUPABASE_URL: 'https://probe.supabase.example', SUPABASE_ANON_KEY: 'anon-probe', SUPABASE_SERVICE_ROLE_KEY: DIENST, STRIPE_RK: RK };
      globalThis.Deno = { env: { get: (k) => env[k] }, serve: (fn) => { handler = fn; } };
      await import(pathToFileURL(path.join(WURZEL, 'supabase/functions/werkstatt-kasse/index.ts')).href);
      const url = 'https://probe.supabase.example/functions/v1/werkstatt-kasse';
      const r = await handler(new Request(url, { method: 'POST', body: JSON.stringify(KAUF), headers: { Authorization: 'Bearer ' + JWT } }));
      const d = await r.json();
      const o = await handler(new Request(url, { method: 'OPTIONS' }));
      const g = await handler(new Request(url));
      pruefe('werkstatt-kasse/index.ts laeuft: 200 mit Kassen-Adresse, Stripe mit dem Secret, OPTIONS 204 ohne Koerper, GET 405 (Deno-Attrappe)',
        typeof handler === 'function' && r.status === 200 && d.kassen_url === KASSEN_URL && f.stripe('kasse')[0].headers.Authorization === 'Bearer ' + RK
        && o.status === 204 && (await o.text()) === '' && g.status === 405 && r.headers.get('access-control-allow-origin') === '*', { status: r.status, d });
      // Webhook
      const f2 = server();
      globalThis.fetch = f2;
      handler = null;
      const env2 = { STRIPE_WERKSTATT_WEBHOOK_SECRET: GEHEIM, STRIPE_RK: RK, SUPABASE_URL: 'https://probe.supabase.example', SUPABASE_SERVICE_ROLE_KEY: DIENST };
      globalThis.Deno = { env: { get: (k) => env2[k] }, serve: (fn) => { handler = fn; } };
      await import(pathToFileURL(path.join(WURZEL, 'supabase/functions/werkstatt-webhook/index.ts')).href);
      const t = Math.floor(Date.now() / 1000);
      const k = JSON.stringify({ ...KAUF_EREIGNIS, created: t });
      const hurl = 'https://probe.supabase.example/functions/v1/werkstatt-webhook';
      const w1 = await handler(new Request(hurl, { method: 'POST', body: k, headers: { 'Stripe-Signature': signiere(k, t) } }));
      const w2 = await handler(new Request(hurl, { method: 'POST', body: k, headers: { 'Stripe-Signature': signiere(k, t, 'whsec_falsch_probe') } }));
      const w3 = await handler(new Request(hurl));
      pruefe('werkstatt-webhook/index.ts laeuft: gueltig 200 mit RPC, gefaelscht 400, GET 405 (Deno-Attrappe)', w1.status === 200
        && (await w1.json()).ergebnis === 'zugeteilt' && f2.rpcs('edition_stripe_ereignis').length === 1 && w2.status === 400 && w3.status === 405);
      pruefe('Huellen: Protokoll nur mit Kennungen', zeilen.length > 0 && zeilen.every((z) => /^werkstatt-(kasse|webhook) /.test(z) && ![RK, DIENST, UID, '@'].some((x) => z.includes(x))), zeilen);
    } catch (e) {
      pruefe('Huellen laufen (Deno-Attrappe)', false, e.stack || e.message);
    } finally {
      globalThis.fetch = echtesFetch;
      console.log = log;
      delete globalThis.Deno;
    }
  } else {
    pruefe('Huellen geben Status, Kopf und Koerper weiter (Node ohne TS: nur statisch)',
      /new Response\(ergebnis\.status === 204 \? null : ergebnis\.koerper, \{ status: ergebnis\.status, headers: ergebnis\.kopf \}\)/.test(kasseTs)
      && /new Response\(ergebnis\.koerper, \{ status: ergebnis\.status, headers: ergebnis\.kopf \}\)/.test(hookTs));
  }
}

// ---------------------------------------------------------------------------
// Vertrag mit supabase/werkstatt-schema.sql (statisch; die SQL laeuft im PGlite-Pruefer und im SQL Editor)
// ---------------------------------------------------------------------------
{
  const sql = lies('supabase/werkstatt-schema.sql');
  const ohneKommentar = sql.split('\n').map((z) => z.replace(/--.*$/, '')).join('\n');
  const params = (name) => {
    const sig = (ohneKommentar.match(new RegExp(`function public\\.${name}\\(([\\s\\S]*?)\\)\\s*returns`)) || [])[1] || '';
    return [...sig.matchAll(/(?:^|,)\s*([a-z_0-9]+)\s+(?:text|timestamptz|uuid|integer|boolean)/g)].map((m) => m[1]);
  };
  const rumpf = (name) => (ohneKommentar.match(new RegExp(`create or replace function public\\.${name}\\([\\s\\S]*?\\$\\$([\\s\\S]*?)\\$\\$;`)) || [])[1] || '';
  pruefe('Vertrag: auswertenEdition liefert genau die Parameter von edition_stripe_ereignis (Reihenfolge)',
    JSON.stringify(params('edition_stripe_ereignis')) === JSON.stringify(Object.keys(auswertenEdition(KAUF_EREIGNIS).daten)), params('edition_stripe_ereignis'));
  pruefe('Vertrag: Parameter von edition_reserviere, edition_kasse_setzen, edition_kasse_abbrechen, edition_erstattung_gesendet',
    JSON.stringify(params('edition_reserviere')) === JSON.stringify(['nutzer', 'produkt', 'textversion', 'zustimmung_sofort', 'kenntnis_widerruf'])
    && JSON.stringify(params('edition_kasse_setzen')) === JSON.stringify(['reservierung', 'sitzung', 'kassen_url', 'kasse_bis'])
    && JSON.stringify(params('edition_kasse_abbrechen')) === JSON.stringify(['reservierung'])
    && JSON.stringify(params('edition_erstattung_gesendet')) === JSON.stringify(['ereignis_id']));
  const kennungen = [...new Set([...rumpf('edition_reserviere').matchAll(/raise exception '(EDITION_[A-Z_]+)'/g)].map((m) => m[1]))];
  pruefe(`Vertrag: jede Kennung aus edition_reserviere (${kennungen.length}) hat eine Antwort in KENNUNGEN, und umgekehrt`,
    kennungen.length >= 10 && kennungen.every((k) => k in KENNUNGEN) && Object.keys(KENNUNGEN).every((k) => kennungen.includes(k)), kennungen);
  const json = rumpf('edition_reserviere');
  pruefe('Vertrag: edition_reserviere liefert alles, was die Kasse liest', ['reservierung', 'neu', 'stripe_preis', 'kassen_url', 'kasse_bis_s', 'stripe_ablauf_s',
    'kassenschluss_s', 'verkauf_bis_s'].every((k) => json.includes(`'${k}'`)));
  const ereignisRumpf = rumpf('edition_stripe_ereignis');
  pruefe('Vertrag: Erstattungs-Gruende der Datenbank stehen alle in GRUENDE', [...ereignisRumpf.matchAll(/v_erstatten := '([a-z_]+)'/g)].map((m) => m[1])
    .concat(['ausverkauft', 'endzahl']).every((g) => GRUENDE.includes(g)) && /'erstatten', coalesce\(ev\.erstattung = 'offen', false\)/.test(ohneKommentar));
  pruefe('Vertrag: Zahlungs-Ereignisse vor dem Kauf bleiben gespeichert und werden nach der Zuteilung nachgeholt, je Zahlung gesperrt',
    /pg_advisory_xact_lock\(hashtextextended\('edition-zahlung:' \|\| v_zahlung, 0\)\)/.test(ereignisRumpf)
    && /t\.typ like 'charge\.%' and t\.ergebnis = 'ohne_besitz'/.test(ereignisRumpf)
    && /public\.edition_zahlung_anwenden\(b, ev2\.typ, ev2\.erstellt, ev2\.betrag, ev2\.erstattet, ev2\.grund,\s+ev2\.streit\)/.test(ereignisRumpf)
    && /nachgeholt_am = now\(\)/.test(ereignisRumpf)
    && /insert into public\.edition_ereignisse as t \(id, typ, erstellt, reservierung_id, zahlung_id, betrag, erstattet, grund,\s+streit\)/.test(ereignisRumpf)
    && /revoke all on function public\.edition_zahlung_anwenden\(/.test(ohneKommentar) && !/grant execute on function public\.edition_zahlung_anwenden/.test(ohneKommentar));
  pruefe('Vertrag: unbekannte Reservierung nie automatisch erstattet (von_hand), Aufraeumen behaelt offene Faelle fuer Flo',
    /v_ergebnis := 'unbekannt';\s+v_von_hand := 'unbekannt';/.test(ereignisRumpf) && !/v_erstatten := 'unbekannt'/.test(ohneKommentar)
    && /when v_von_hand is not null then 'von_hand'/.test(ereignisRumpf) && /'von_hand', coalesce\(ev\.erstattung = 'von_hand', false\)/.test(ohneKommentar)
    && /\(t\.erstattung is null or t\.erstattung in \('gesendet', 'erledigt'\)\)/.test(ohneKommentar));
  pruefe('Vertrag: Notaus nach dem Start heisst pausiert, Name einmalig, hoechstens 3 Kassen je Konto und Edition in 24 Stunden',
    /when now\(\) < e\.verkauf_ab then 'angekuendigt'\s+when not e\.verkauf_freigegeben then 'pausiert'/.test(ohneKommentar)
    && /create unique index if not exists editionen_name_einmalig on public\.editionen \(lower\(name\)\);/.test(ohneKommentar)
    && /x\.erstellt_am > now\(\) - interval '24 hours'\) >= 3 then\s+raise exception 'EDITION_ZU_OFT'/.test(rumpf('edition_reserviere'))
    && rumpf('edition_reserviere').indexOf("raise exception 'EDITION_NICHT_VERFUEGBAR'") < rumpf('edition_reserviere').indexOf("raise exception 'EDITION_ZU_OFT'"));
  pruefe('Kassenschluss: 31 Minuten in SQL und JS gleich', /select bis - interval '31 minutes';/.test(ohneKommentar)
    && /'stripe_ablauf_s', floor\(extract\(epoch from r\.erstellt_am\)\)::bigint \+ 31 \* 60/.test(ohneKommentar) && KASSE_S === 31 * 60);
  const TABELLEN = ['altersangaben', 'editionen', 'reservierungen', 'edition_zustimmungen', 'besitz', 'edition_ereignisse', 'sonderstuecke'];
  pruefe('RLS an fuer alle sieben Tabellen', TABELLEN.every((t) => ohneKommentar.includes(`alter table public.${t} enable row level security;`)));
  pruefe('Rechte: erst alles weg (auch service_role), danach nie insert, update, delete oder all fuer Nutzer und Dienst',
    /revoke all on table public\.altersangaben, public\.editionen, public\.reservierungen, public\.edition_zustimmungen,\s+public\.besitz, public\.edition_ereignisse, public\.sonderstuecke from anon, authenticated, service_role, public;/.test(ohneKommentar)
    && !/grant (insert|update|delete|all|truncate)[^;]*on table/.test(ohneKommentar) && !/grant [^;]* to [^;]*anon/.test(ohneKommentar));
  pruefe('Spaltenrechte: Nutzer lesen von editionen nur die festen Angaben, von besitz und reservierungen keine Zahlungs- oder Sitzungskennung',
    /grant select \(produkt_id, name, auflage, angekuendigt_am, verkauf_ab, verkauf_bis, betrag_cent, waehrung\)\s+on table public\.editionen to authenticated;/.test(ohneKommentar)
    && /grant select \(produkt_id, nummer, status, erworben_am, status_zeit\) on table public\.besitz to authenticated;/.test(ohneKommentar)
    && /grant select \(id, produkt_id, status, kassen_url, kasse_bis, erstellt_am\) on table public\.reservierungen to authenticated;/.test(ohneKommentar)
    && !/grant select on table public\.(editionen|besitz|reservierungen|edition_ereignisse) to authenticated/.test(ohneKommentar));
  const definer = [...ohneKommentar.matchAll(/create or replace function ([\s\S]*?)\$\$/g)].map((m) => m[1]);
  pruefe('jede Funktion setzt search_path = \'\' (die security-definer-Funktionen zuerst)', definer.length >= 15
    && definer.every((k) => /set search_path = ''/.test(k)) && definer.filter((k) => /security definer/.test(k)).length === 9, definer.length);
  pruefe('Funktionen: Nutzer nur alter_angeben, edition_stand, edition_staende; alles Schreibende nur Service-Rolle',
    ['alter_angeben\\(boolean\\)', 'edition_stand\\(text\\)', 'edition_staende\\(\\)'].every((f) => new RegExp(`grant execute on function public\\.${f} to authenticated;`).test(ohneKommentar))
    && ['edition_reserviere', 'edition_kasse_setzen', 'edition_kasse_abbrechen', 'edition_aufraeumen', 'edition_stripe_ereignis', 'edition_erstattung_gesendet']
      .every((f) => new RegExp(`grant execute on function public\\.${f}\\([^)]*\\)\\s+to service_role;`).test(ohneKommentar)
        && !new RegExp(`grant execute on function public\\.${f}[^;]*authenticated`).test(ohneKommentar))
    && !/grant execute[^;]*(anon|public;)/.test(ohneKommentar));
  pruefe('Regeln in der Tabelle: Auflage ab 10 (auch in einer schon eingespielten Datenbank), vergeben + reserviert <= Auflage, Schalter Standard aus, Endzahl = vergeben',
    /check \(auflage >= 10 and auflage <= 1000000\)/.test(ohneKommentar) && !/auflage >= 100\b/.test(ohneKommentar)
    && /alter table public\.editionen drop constraint if exists editionen_auflage;\s*alter table public\.editionen add constraint editionen_auflage check \(auflage >= 10 and auflage <= 1000000\);/.test(ohneKommentar) && /vergeben \+ reserviert <= auflage/.test(ohneKommentar)
    && /verkauf_freigegeben boolean not null default false/.test(ohneKommentar) && /zeige_restzahl boolean not null default false/.test(ohneKommentar)
    && /check \(endzahl is null or endzahl = vergeben\)/.test(ohneKommentar));
  pruefe('Restzahl: nur was gerade kaufbar ist (offene Kassen zaehlen nicht mit), Schalter ab der Ankuendigung nur noch aus',
    /'restzahl', case when e\.zeige_restzahl and v_status = 'erhaeltlich'\s+then greatest\(e\.auflage - e\.vergeben - e\.reserviert, 0\) end/.test(ohneKommentar)
    && /if new\.zeige_restzahl and not old\.zeige_restzahl then\s+raise exception 'EDITION_EINGEFROREN';/.test(ohneKommentar));
  pruefe('Trigger: vergeben sinkt nie, eingefroren ab der Ankuendigung, Ende nur vorziehbar wenn ausverkauft, Besitz bleibt',
    /raise exception 'EDITION_VERGEBEN_SINKT'/.test(ohneKommentar) && /old\.angekuendigt_am is not null and old\.angekuendigt_am <= now\(\)/.test(ohneKommentar)
    && /new\.verkauf_bis > old\.verkauf_bis or new\.vergeben < new\.auflage/.test(ohneKommentar) && /raise exception 'EDITION_BESITZ_BLEIBT'/.test(ohneKommentar)
    && /before insert or update or delete on public\.editionen/.test(ohneKommentar) && /before update or delete on public\.besitz/.test(ohneKommentar));
  pruefe('Ein offener Kauf je Konto und Edition (Teilindex), ein Stueck je Konto und Edition, Nummer je Edition eindeutig ab 1',
    /create unique index if not exists reservierungen_offen_je_konto\s+on public\.reservierungen \(user_id, produkt_id\) where status = 'offen';/.test(ohneKommentar)
    && /constraint besitz_ein_stueck_je_konto unique \(produkt_id, user_id\)/.test(ohneKommentar) && /primary key \(produkt_id, nummer\)/.test(ohneKommentar)
    && /check \(nummer >= 1\)/.test(ohneKommentar));
  pruefe('Kontoloeschung: Besitz, Reservierungen, Zustimmungen, Sonderstuecke pseudonym (set null), Altersangabe weg (cascade)',
    (ohneKommentar.match(/user_id uuid references auth\.users \(id\) on delete set null/g) || []).length === 4
    && /user_id uuid primary key references auth\.users \(id\) on delete cascade,\s+ab18/.test(ohneKommentar));
  pruefe('Atomar reservieren: der Schalter steht zuerst und noch einmal in derselben Bedingung wie die Auflage',
    rumpf('edition_reserviere').indexOf("raise exception 'EDITION_GESPERRT'") < rumpf('edition_reserviere').indexOf("raise exception 'EDITION_ALTER'")
    && /and x\.verkauf_freigegeben\s+and now\(\) >= x\.verkauf_ab\s+and now\(\) < public\.edition_kassenschluss\(x\.verkauf_bis\)\s+and x\.endzahl is null\s+and x\.vergeben \+ x\.reserviert < x\.auflage/.test(ohneKommentar)
    && /pg_advisory_xact_lock\(hashtextextended\('edition:'/.test(ohneKommentar));
  pruefe('Sonderstuecke: nur Nr. 0, je Stueck eine Zeile, Nutzer und Dienst lesen nur', /check \(nummer = 0\)/.test(ohneKommentar)
    && /stueck_id text primary key/.test(ohneKommentar) && /grant select on table public\.sonderstuecke to authenticated;/.test(ohneKommentar)
    && !/sonderstuecke[^;]*to (authenticated|service_role)[^;]*insert/.test(ohneKommentar));
  const test = lies('supabase/werkstatt-rls-test.sql');
  pruefe('werkstatt-rls-test.sql: eine Transaktion, rollt zurueck, meldet Erfolg', /^begin;/m.test(test) && /rollback;\s*$/.test(test)
    && test.includes("'Werkstatt-RLS-Test erfolgreich'"));
  pruefe('werkstatt-rls-test.sql: alle Faelle aus dem Auftrag', ['set local role anon', 'd7000000', 'e7000000', '42501', 'EDITION_NICHT_VERFUEGBAR', 'EDITION_AUSVERKAUFT',
    'EDITION_EINGEFROREN', 'EDITION_VERGEBEN_SINKT', 'zugeteilt_spaet', "'ausverkauft'", "'doppelt'", "'endzahl'", 'konto_loeschen', 'rls-knapp-nach',
    'rls-knapp-vor', "'erstattet,aktiv,widerrufen,zurueckgebucht,aktiv'", 'sonderstuecke', 'meine_daten', 'EDITION_BESITZ_BLEIBT', 'edition_aufraeumen',
    'Testbetrag, kein Preis', 'EDITION_ZU_OFT', "'pausiert'", "'von_hand'", 'nachgeholt_am', 'evt_RlsVorKauf2', "'strittig,zurueckgebucht'",
    'PROBE-EDITION', "'23505'"].every((x) => test.includes(x)));
  const daten = lies('supabase/daten-schema.sql');
  pruefe('meine_daten: auch die Abo-Zeile und die Werkstatt (jeweils nur, wenn das Schema eingespielt ist)', /to_regclass\('public\.abos'\)/.test(daten)
    && /'abo', abo,/.test(daten) && /to_regclass\('public\.besitz'\)/.test(daten) && /\|\| werkstatt;/.test(daten)
    && ['altersangabe', 'besitz', 'reservierungen', 'edition_zustimmungen', 'sonderstuecke'].every((k) => daten.includes(`''${k}''`)));
}
{
  // Anleitung: Warnsatz und Abschnitt fuer spaeter
  const a = lies('supabase/ANLEITUNG.md');
  pruefe('ANLEITUNG: Warnsatz gegen Einmal-Zahlungslinks und Abschnitt "Editionen (spaeter, noch nicht ausfuehren)"',
    /keinen Einmal-Zahlungslink/.test(a) && /verschluckt/.test(a) && /## Editionen \(später, noch nicht ausführen\)/.test(a)
    && ['STRIPE_RK', 'STRIPE_WERKSTATT_WEBHOOK_SECRET', 'werkstatt-kasse', 'werkstatt-webhook --no-verify-jwt', 'werkstatt-schema.sql',
      'werkstatt-rls-test.sql', 'checkout.session.completed', 'checkout.session.expired', 'charge.refunded', 'charge.dispute.created',
      'charge.dispute.closed', 'Testmodus'].every((x) => a.includes(x)));
  const ed = a.slice(a.indexOf('## Editionen (später, noch nicht ausführen)'));
  pruefe('ANLEITUNG Editionen: Fälle von Hand, Projektkennung, ehrlicher Notaus, Probekauf nur im Testprojekt zurückdatieren, Widerruf von Hand',
    ed.includes("erstattung = 'von_hand'") && ed.includes("set erstattung = 'erledigt'") && /Kennung des Supabase-Projekts/.test(ed)
    && /bis zu 31 Minuten/.test(ed) && /„pausiert“/.test(ed) && /Im echten Projekt nie zurückdatieren/.test(ed)
    && /Höchstens 3 Kassen je Konto und Edition in 24 Stunden/.test(ed) && /immer von Hand/.test(ed) && !/[\u2013\u2014]/.test(ed));
}
{
  // ENTSCHEIDUNGEN, Eintrag 29.10.: entschieden und empfohlen getrennt, Offenes nur unter "Offen"
  const e = lies('design/runde4/ENTSCHEIDUNGEN.md');
  const z = e.split('\n').find((x) => x.startsWith('| 29.10. |')) || '';
  const offen = z.indexOf('**Offen (Flo entscheidet):**');
  const empf = z.indexOf('**Claudes Empfehlung, von Flo zu bestätigen**');
  pruefe('ENTSCHEIDUNGEN 29.10.: Nummer nur für den Besitzer entschieden, Shop vorerst nur im Web, Store-Weg später, Empfehlungen markiert',
    z.includes('Nur zur Info, so lassen') && z.includes('Verkauft wird vorerst nur im Web') && z.includes('Den Weg über die App-Stores entscheidet Flo später')
    && z.includes('sichtbares Prestige bleibt erspielbar') && empf > 0 && offen > empf
    && z.indexOf('1 bis 2 im Jahr') > offen && z.indexOf('nur für Konten mit bestätigtem „18 oder älter“') > empf && z.indexOf('Lesart von „höchstens 100“') > offen && !/[\u2013\u2014]/.test(z));
}
{
  // Keine Geheimnisse und keine Preise in den Dateien der Editionen (oeffentliches Repo)
  const dateien = ['supabase/werkstatt-schema.sql', 'supabase/werkstatt-rls-test.sql', 'supabase/functions/_gemeinsam/werkstatt.js',
    'supabase/functions/werkstatt-kasse/index.ts', 'supabase/functions/werkstatt-webhook/index.ts', 'supabase/ANLEITUNG.md', 'design/runde4/ENTSCHEIDUNGEN.md'];
  const GEHEIM_RE = /(sk|rk)_(live|test)_[A-Za-z0-9]{8,}|whsec_[A-Za-z0-9]{12,}|sb_secret_[A-Za-z0-9_-]{12,}/;
  const PREIS_RE = /\d+(?:[.,]\d{1,2})?\s*(?:€|EUR\b|Euro\b)|€\s*\d/;
  const geheim = [];
  const preis = [];
  for (const d of dateien) {
    let t = '';
    try { t = lies(d); } catch (e) { geheim.push(d + ' fehlt'); continue; }
    if (GEHEIM_RE.test(t)) geheim.push(d + ': ' + t.match(GEHEIM_RE)[0].slice(0, 12) + '...');
    if (PREIS_RE.test(t)) preis.push(d + ': ' + t.match(PREIS_RE)[0]);
  }
  pruefe(`keine Schluessel oder Webhook-Geheimnisse in ${dateien.length} Dateien der Editionen`, geheim.length === 0, geheim);
  pruefe('keine Preise in den Dateien der Editionen (Betraege stehen nur in Flos Zeilen in der Datenbank)', preis.length === 0, preis);
  pruefe('Muster fangen Beispiele', GEHEIM_RE.test('rk_test_' + 'abcdefgh12') && GEHEIM_RE.test('whsec_' + 'abcdefghijkl12') && PREIS_RE.test('9,99 €') && !PREIS_RE.test('Auflage 100'));
}

ausgabe(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
