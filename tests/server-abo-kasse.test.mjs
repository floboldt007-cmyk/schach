// Server-Test fuer die Abo-Kasse (supabase/functions/_gemeinsam/abo-kasse.js) mit gefaelschtem fetch fuer Supabase
// und Stripe. Kern: Die Nutzer-ID kommt nur aus der Anmeldung (Code-Check 05.11.2026, Fund 1), und der Webhook
// (stripe.js auswerten) ordnet eine so angelegte Sitzung genau diesem Konto zu. Laeuft ohne Netz und ohne Deno.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { MAX_KOERPER, FENSTER_MS, ZUSTIMMUNG_TEXT, kassenParameter, verarbeite } from '../supabase/functions/_gemeinsam/abo-kasse.js';
import { auswerten, META_ABO_NUTZER } from '../supabase/functions/_gemeinsam/stripe.js';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lies = (d) => readFileSync(path.join(WURZEL, d), 'utf8');

let ok = 0;
let gesamt = 0;
function pruefe(name, bedingung, info) {
  gesamt++;
  if (bedingung) { ok++; console.log('ok     ' + name); } else console.log('FEHLER ' + name + (info !== undefined ? '  -> ' + JSON.stringify(info) : ''));
}

const RK = ['rk', 'test', 'ProbeAboNurTest0001'].join('_');
const RK_LIVE = ['rk', 'live', 'ProbeAboNurTest0001'].join('_');
const SK = ['sk', 'test', 'ProbeAboNurTest0001'].join('_');
const DIENST = 'sb_secret_probe';
// Kein echtes Token (Inhalt {"sub":"probe"}); in Teilen, damit es keinem Geheimnis-Muster gleicht
const JWT = ['eyJhbGciOiJIUzI1NiJ9', 'eyJzdWIiOiJwcm9iZSJ9', 'probe-signatur-nicht-echt'].join('.');
const UID = '0f8b6c1e-2d3a-4b5c-8d9e-0a1b2c3d4e5f';
const FREMD = '11111111-2222-4333-8444-555555555555';
const MAIL = 'probe.kaeufer@example.invalid';
const BASIS = 'https://probe.supabase.example';
const UMGEBUNG = Object.freeze({ SUPABASE_URL: BASIS, SUPABASE_SERVICE_ROLE_KEY: DIENST, SUPABASE_ANON_KEY: 'anon-probe',
  ABO_STRIPE_RK: RK, ABO_STRIPE_PREIS: 'price_ProbeMonat1' });
const T0 = Date.UTC(2026, 10, 5, 12);
const KASSE_URL = 'https://checkout.stripe.com/c/pay/cs_test_Probe1#abc';

// Gefaelschtes Netz: Antworten je Ziel, alle Aufrufe werden mitgeschrieben
function netz(o = {}) {
  const s = { user: { id: UID, email: MAIL, email_confirmed_at: '2026-01-01T00:00:00Z' }, userStatus: 200, premium: false,
    abo: [], stripe: [{ status: 200, daten: { id: 'cs_test_Probe1', url: KASSE_URL } }], ...o };
  const aufrufe = [];
  const antwort = (status, daten) => ({ ok: status < 400, status, async json() { return daten; } });
  const f = async (url, opt = {}) => {
    aufrufe.push({ url, ...opt });
    if (url === `${BASIS}/auth/v1/user`) return antwort(s.userStatus, s.userStatus === 200 ? s.user : { message: s.userMeldung || 'bad_jwt' });
    if (url === `${BASIS}/rest/v1/rpc/ist_premium_von`) return s.premiumFehler ? antwort(500, {}) : antwort(200, s.premium);
    if (url.startsWith(`${BASIS}/rest/v1/abos?`)) return antwort(200, s.abo);
    if (url === 'https://api.stripe.com/v1/checkout/sessions') {
      const a = s.stripe.length > 1 ? s.stripe.shift() : s.stripe[0];
      if (a.netz) throw new Error('netz');
      return antwort(a.status, a.daten || {});
    }
    return antwort(404, {});
  };
  return { f, aufrufe, s };
}
const stripeAufrufe = (n) => n.aufrufe.filter((a) => a.url.startsWith('https://api.stripe.com/'));
const parameterVon = (a) => new URLSearchParams(a.body);
const lauf = (n, { koerper = '{}', autorisierung = `Bearer ${JWT}`, methode = 'POST', umgebung = UMGEBUNG, jetzt = T0 } = {}) =>
  verarbeite({ methode, koerper, autorisierung }, umgebung, { fetch: n.f, jetzt });
const json = (e) => { try { return JSON.parse(e.koerper); } catch (x) { return null; } };

// ---------------------------------------------------------------------------
// Methode, Einrichtung, Anmeldung, Eingabe
// ---------------------------------------------------------------------------
{
  const n = netz();
  pruefe('OPTIONS: 204 mit CORS-Kopf', (await lauf(n, { methode: 'OPTIONS' })).status === 204
    && (await lauf(n, { methode: 'OPTIONS' })).kopf['Access-Control-Allow-Origin'] === '*');
  pruefe('GET: 405', (await lauf(n, { methode: 'GET' })).status === 405);
  const ohne = async (u) => json(await lauf(netz(), { umgebung: { ...UMGEBUNG, ...u } }));
  pruefe('ohne ABO_STRIPE_RK, mit vollem Secret Key oder kaputtem Schluessel: 503 nicht_eingerichtet',
    (await ohne({ ABO_STRIPE_RK: '' })).fehler === 'nicht_eingerichtet' && (await ohne({ ABO_STRIPE_RK: SK })).fehler === 'nicht_eingerichtet'
    && (await ohne({ ABO_STRIPE_RK: 'rk_test_' })).fehler === 'nicht_eingerichtet');
  pruefe('ohne oder mit kaputter Preis-ID: 503 nicht_eingerichtet', (await ohne({ ABO_STRIPE_PREIS: '' })).fehler === 'nicht_eingerichtet'
    && (await ohne({ ABO_STRIPE_PREIS: 'prod_Abc' })).fehler === 'nicht_eingerichtet');
  pruefe('Rueckkehr-Adresse nur https: 503 bei http', (await ohne({ ABO_RUECKKEHR: 'http://example.org/' })).fehler === 'nicht_eingerichtet');
  pruefe('ohne Supabase-Umgebung: 503', (await ohne({ SUPABASE_URL: '' })).fehler === 'nicht_eingerichtet');
  const n2 = netz();
  pruefe('ohne Token: 401, kein Aufruf ins Netz', (await lauf(n2, { autorisierung: null })).status === 401 && n2.aufrufe.length === 0);
  pruefe('Token ungueltig: 401', (await lauf(netz({ userStatus: 401 }))).status === 401);
  pruefe('apikey der Function falsch: 503 nicht_eingerichtet', json(await lauf(netz({ userStatus: 401, userMeldung: 'Invalid API key' }))).fehler === 'nicht_eingerichtet');
  pruefe('Anmeldung ohne gueltige ID: 401', (await lauf(netz({ user: { id: 'flo' } }))).status === 401);
  pruefe('Koerper zu gross: 413; kein JSON: 400; leer ist erlaubt', (await lauf(netz(), { koerper: 'x'.repeat(MAX_KOERPER + 1) })).status === 413
    && (await lauf(netz(), { koerper: '{kaputt' })).status === 400 && (await lauf(netz(), { koerper: '' })).status === 200);
}

// ---------------------------------------------------------------------------
// Kern: Nutzer-ID nur aus der Anmeldung
// ---------------------------------------------------------------------------
{
  const n = netz();
  const e = await lauf(n, { koerper: JSON.stringify({ nutzer: FREMD, uid: FREMD, client_reference_id: FREMD, metadata: { [META_ABO_NUTZER]: FREMD } }) });
  const st = stripeAufrufe(n);
  const p = st.length ? parameterVon(st[0]) : new URLSearchParams();
  pruefe('Angriff: fremde ID im Koerper wird ignoriert, Stripe bekommt nur die ID aus der Anmeldung', e.status === 200 && st.length === 1
    && p.get('client_reference_id') === UID && p.get(`metadata[${META_ABO_NUTZER}]`) === UID
    && p.get(`subscription_data[metadata][${META_ABO_NUTZER}]`) === UID && !st[0].body.includes(FREMD), st[0] && st[0].body);
  pruefe('Antwort: nur die Bezahlseite, keine ID, keine E-Mail, kein Schluessel', JSON.stringify(json(e)) === JSON.stringify({ kassen_url: KASSE_URL })
    && !e.koerper.includes(UID) && !e.koerper.includes(MAIL) && !e.koerper.includes(RK));
  pruefe('Stripe-Aufruf: eingeschraenkter Schluessel als Bearer, Idempotency-Key je Nutzer und Fenster',
    st[0].headers.Authorization === `Bearer ${RK}` && st[0].headers['Idempotency-Key'] === `crownmate-abo-${UID}-${Math.floor(T0 / FENSTER_MS)}`);
  pruefe('Abo-Parameter: mode subscription, Preis aus dem Secret, Menge 1, E-Mail aus der Anmeldung',
    p.get('mode') === 'subscription' && p.get('line_items[0][price]') === 'price_ProbeMonat1' && p.get('line_items[0][quantity]') === '1'
    && p.get('customer_email') === MAIL && !p.has('customer'));
  pruefe('AGB-Zustimmung ist Pflicht, mit dem Widerrufs-Hinweis am Haekchen', p.get('consent_collection[terms_of_service]') === 'required'
    && p.get('custom_text[terms_of_service_acceptance][message]') === ZUSTIMMUNG_TEXT && /356 Abs\. 5 BGB/.test(ZUSTIMMUNG_TEXT) && ZUSTIMMUNG_TEXT.length <= 1200);
  pruefe('Rueckkehr in die Einstellungen der Live-Seite (Standard)', p.get('success_url') === 'https://floboldt007-cmyk.github.io/schach/#einstellungen'
    && p.get('cancel_url') === p.get('success_url'));
  // Ende-zu-Ende: Was Stripe aus dieser Sitzung meldet, ordnet der Webhook genau diesem Konto zu
  const metadaten = {};
  for (const [k, v] of p) { const m = /^metadata\[(.+)\]$/.exec(k); if (m) metadaten[m[1]] = v; }
  const ereignis = { id: 'evt_1KasseProbe', type: 'checkout.session.completed', created: Math.floor(T0 / 1000), data: { object: {
    id: 'cs_test_Probe1', mode: 'subscription', payment_status: 'paid', customer: 'cus_Probe1', subscription: 'sub_Probe1',
    client_reference_id: p.get('client_reference_id'), metadata: metadaten } } };
  pruefe('Webhook ordnet die Sitzung der Kasse dem angemeldeten Konto zu', auswerten(ereignis).daten.nutzer === UID);
  const k2 = netz();
  await lauf(k2, { jetzt: T0 + 1000 });
  const k3 = netz();
  await lauf(k3, { jetzt: T0 + FENSTER_MS * 2 });
  pruefe('Doppelklick im selben Fenster: gleicher Key und gleiche Parameter; spaeter neuer Key',
    stripeAufrufe(k2)[0].headers['Idempotency-Key'] === st[0].headers['Idempotency-Key'] && stripeAufrufe(k2)[0].body === st[0].body
    && stripeAufrufe(k3)[0].headers['Idempotency-Key'] !== st[0].headers['Idempotency-Key']);
  const live = netz();
  pruefe('Live-Schluessel (rk_live_) ist erlaubt', (await lauf(live, { umgebung: { ...UMGEBUNG, ABO_STRIPE_RK: RK_LIVE } })).status === 200);
  const eigene = netz();
  await lauf(eigene, { umgebung: { ...UMGEBUNG, ABO_RUECKKEHR: 'https://crownmate.de/' } });
  pruefe('eigene Rueckkehr-Adresse (ABO_RUECKKEHR)', parameterVon(stripeAufrufe(eigene)[0]).get('success_url') === 'https://crownmate.de/#einstellungen');
}

// ---------------------------------------------------------------------------
// Premium, bisheriger Kunde, Stripe-Fehler
// ---------------------------------------------------------------------------
{
  const n = netz({ premium: true });
  const e = await lauf(n);
  pruefe('schon Premium: 409 schon_premium, keine zweite Bezahlseite', e.status === 409 && json(e).fehler === 'schon_premium' && stripeAufrufe(n).length === 0);
  const pr = n.aufrufe.find((a) => a.url.endsWith('/rpc/ist_premium_von'));
  pruefe('Premium-Pruefung mit der ID aus der Anmeldung und dem Dienst-Schluessel', pr && JSON.parse(pr.body).uid === UID && pr.headers.apikey === DIENST);
  pruefe('Premium-Pruefung scheitert: 503, keine Bezahlseite', (await lauf(netz({ premiumFehler: true }))).status === 503);
  const k = netz({ abo: [{ kunde_id: 'cus_Bisher1' }] });
  await lauf(k);
  const p = parameterVon(stripeAufrufe(k)[0]);
  pruefe('frueherer Stripe-Kunde bleibt derselbe (customer statt customer_email)', p.get('customer') === 'cus_Bisher1' && !p.has('customer_email'));
  const abfrage = k.aufrufe.find((a) => a.url.startsWith(`${BASIS}/rest/v1/abos?`));
  pruefe('Kunde wird ueber die ID aus der Anmeldung gesucht', abfrage && abfrage.url.includes(`user_id=eq.${UID}`) && abfrage.headers.apikey === DIENST);
  pruefe('kaputte kunde_id in der Tabelle wird nicht weitergegeben', !parameterVon(stripeAufrufe(await (async () => { const x = netz({ abo: [{ kunde_id: 'cus_; x' }] }); await lauf(x); return x; })())[0]).has('customer'));

  const wieder = netz({ stripe: [{ status: 500 }, { status: 200, daten: { id: 'cs_test_Probe1', url: KASSE_URL } }] });
  pruefe('Stripe 500: ein zweiter Versuch mit demselben Key, dann ok', (await lauf(wieder)).status === 200 && stripeAufrufe(wieder).length === 2
    && stripeAufrufe(wieder)[0].headers['Idempotency-Key'] === stripeAufrufe(wieder)[1].headers['Idempotency-Key']);
  pruefe('Stripe zweimal nicht erreichbar: 503 stripe', json(await lauf(netz({ stripe: [{ netz: true }] }))).fehler === 'stripe');
  pruefe('Stripe lehnt ab (400): 502 stripe', (await lauf(netz({ stripe: [{ status: 400, daten: { error: { code: 'resource_missing' } } }] }))).status === 502);
  pruefe('Stripe-Schluessel ohne Recht (401/403): 503 nicht_eingerichtet', json(await lauf(netz({ stripe: [{ status: 403 }] }))).fehler === 'nicht_eingerichtet');
  pruefe('fremde oder kaputte Adresse in der Stripe-Antwort wird nicht weitergegeben', json(await lauf(netz({ stripe: [{ status: 200,
    daten: { id: 'cs_test_Probe1', url: 'https://boese.example/pay' } }] }))).fehler === 'stripe'
    && json(await lauf(netz({ stripe: [{ status: 200, daten: { id: 'x', url: KASSE_URL } }] }))).fehler === 'stripe');
  pruefe('kassenParameter: ohne Kunde und ohne E-Mail keins von beiden', (() => {
    const q = kassenParameter({ uid: UID, preis: 'price_X', kunde: null, email: null, rueckkehr: 'https://a.example/' });
    return !q.has('customer') && !q.has('customer_email');
  })());
}

// ---------------------------------------------------------------------------
// Deno-Huelle (nur Text: Deno ist hier nicht installiert)
// ---------------------------------------------------------------------------
{
  const ts = lies('supabase/functions/abo-kasse/index.ts');
  pruefe('Huelle: liest genau die eigenen Secrets, ruft verarbeite auf', /ABO_STRIPE_RK: Deno\.env\.get\('ABO_STRIPE_RK'\)/.test(ts)
    && /ABO_STRIPE_PREIS: Deno\.env\.get\('ABO_STRIPE_PREIS'\)/.test(ts) && /from '\.\.\/_gemeinsam\/abo-kasse\.js'/.test(ts)
    && !/STRIPE_RK: Deno\.env\.get\('STRIPE_RK'\)/.test(ts));
  pruefe('Huelle: Deploy MIT JWT-Pruefung (kein --no-verify-jwt im Deploy-Befehl)', /functions deploy abo-kasse\s*$/m.test(ts) && !/deploy abo-kasse --no-verify-jwt/.test(ts));
  const app = lies('js/abo.js');
  pruefe('App: haengt keine Nutzer-ID mehr an einen Zahlungslink', !/client_reference_id/.test(app.replace(/^\s*\/\/.*$/gm, '')) && /KASSE_PFAD = '\/functions\/v1\/abo-kasse'/.test(app));
}

console.log(`\n${ok}/${gesamt} bestanden`);
if (ok !== gesamt) process.exit(1);
