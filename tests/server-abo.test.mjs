// Server-Teil des Abos "Crownmate Trainer" (Welle B1), nur Node, ohne Browser und ohne Netz:
//   node tests/server-abo.test.mjs
// Prueft supabase/functions/_gemeinsam/stripe.js (Signatur mit bekannten Vektoren, Auswertung der Stripe-Ereignisse in
// alter und neuer API-Form, verarbeite() mit gefaelschtem fetch), die Deno-Huelle stripe-webhook/index.ts (in Node mit
// Typ-Entfernung und einer Deno-Attrappe) und den Vertrag mit supabase/abo-schema.sql (Parameternamen, Rechte, RLS).
// Die SQL-Dateien selbst laufen im PGlite-Pruefer (Scratchpad) und im Supabase SQL Editor (supabase/abo-rls-test.sql).
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import {
  TOLERANZ_S, MAX_KOERPER, VORLAEUFIG_S, TYPEN, leseSignaturKopf, hmacSha256Hex, gleichZeitkonstant, pruefeSignatur,
  auswerten, planVon, dienstKopf, verarbeite,
} from '../supabase/functions/_gemeinsam/stripe.js';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lies = (d) => readFileSync(path.join(WURZEL, d), 'utf8');

let ok = 0;
let gesamt = 0;
function pruefe(name, bedingung, info) {
  gesamt++;
  if (bedingung) { ok++; console.log('ok     ' + name); } else console.log('FEHLER ' + name + (info !== undefined ? '  -> ' + JSON.stringify(info) : ''));
}

const GEHEIM = 'whsec_crownmate_probe';
const T0 = 1767225600; // 2026-01-01 00:00:00 UTC
const signiere = (koerper, t = T0, geheim = GEHEIM) => `t=${t},v1=${createHmac('sha256', geheim).update(`${t}.${koerper}`).digest('hex')}`;
const UID = '0f8b6c1e-2d3a-4b5c-8d9e-0a1b2c3d4e5f';

// ---------------------------------------------------------------------------
// Signatur
// ---------------------------------------------------------------------------
pruefe('HMAC-SHA256: RFC 4231 Testfall 2 ("Jefe")', await hmacSha256Hex('Jefe', 'what do ya want for nothing?')
  === '5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843');
{
  const koerper = '{"id":"evt_1Probe","object":"event"}';
  const fest = '293638a1fa4fb5d2484abecc1a1f63ba3945c3a1663dd9964d1062b5b2041015';
  const eigen = await hmacSha256Hex(GEHEIM, `${T0}.${koerper}`);
  pruefe('Stripe-Vektor: eigene Rechnung = fester Wert = node:crypto', eigen === fest
    && createHmac('sha256', GEHEIM).update(`${T0}.${koerper}`).digest('hex') === fest, eigen);
  pruefe('Signatur passt (genau so, wie Stripe signiert)', (await pruefeSignatur(koerper, `t=${T0},v1=${fest}`, GEHEIM, { jetzt: T0 })).ok === true);
  pruefe('falsches Geheimnis -> signatur', (await pruefeSignatur(koerper, `t=${T0},v1=${fest}`, 'whsec_anders', { jetzt: T0 })).grund === 'signatur');
  pruefe('veraenderter Inhalt -> signatur', (await pruefeSignatur(koerper.replace('1Probe', '2Probe'), `t=${T0},v1=${fest}`, GEHEIM, { jetzt: T0 })).grund === 'signatur');
  pruefe('anderer Zeitstempel im Kopf -> signatur', (await pruefeSignatur(koerper, `t=${T0 + 1},v1=${fest}`, GEHEIM, { jetzt: T0 })).grund === 'signatur');
  const grenze = await pruefeSignatur(koerper, `t=${T0},v1=${fest}`, GEHEIM, { jetzt: T0 + TOLERANZ_S });
  const alt = await pruefeSignatur(koerper, `t=${T0},v1=${fest}`, GEHEIM, { jetzt: T0 + TOLERANZ_S + 1 });
  const zukunft = await pruefeSignatur(koerper, `t=${T0},v1=${fest}`, GEHEIM, { jetzt: T0 - TOLERANZ_S - 1 });
  pruefe('Toleranz 5 Minuten: 300 s ok, 301 s alt oder in der Zukunft -> zeit', TOLERANZ_S === 300 && grenze.ok && alt.grund === 'zeit' && zukunft.grund === 'zeit');
  pruefe('mehrere v1 (Geheimnis wird gewechselt): eine passende reicht, v0 zaehlt nie',
    (await pruefeSignatur(koerper, `t=${T0},v1=${'0'.repeat(64)},v1=${fest}`, GEHEIM, { jetzt: T0 })).ok
    && (await pruefeSignatur(koerper, `t=${T0},v0=${fest}`, GEHEIM, { jetzt: T0 })).grund === 'keine_signatur');
  pruefe('Kopf mit Leerzeichen und Grossbuchstaben wird gelesen', (await pruefeSignatur(koerper, ` t=${T0} , v1=${fest.toUpperCase()} `, GEHEIM, { jetzt: T0 })).ok);
  pruefe('ohne Kopf, ohne t, ohne Geheimnis: klare Gruende', (await pruefeSignatur(koerper, null, GEHEIM)).grund === 'kein_kopf'
    && (await pruefeSignatur(koerper, `v1=${fest}`, GEHEIM)).grund === 'kein_zeitstempel'
    && (await pruefeSignatur(koerper, `t=${T0},v1=${fest}`, '')).grund === 'kein_geheimnis'
    && (await pruefeSignatur(koerper, `t=abc,v1=${fest}`, GEHEIM)).grund === 'kein_zeitstempel');
  const kopf = leseSignaturKopf(`t=${T0},v1=zz,v1=${fest},foo=bar,=x,v1`);
  pruefe('leseSignaturKopf: nur gueltige v1 (64 hex), t als Zahl', kopf.t === T0 && kopf.v1.length === 1 && kopf.v1[0] === fest, kopf);
  pruefe('gleichZeitkonstant', gleichZeitkonstant('ab', 'ab') && !gleichZeitkonstant('ab', 'ac') && !gleichZeitkonstant('ab', 'abc')
    && !gleichZeitkonstant(null, 'a') && gleichZeitkonstant('', ''));
  // Zeitkonstanz im Code: kein frueher Abbruch in der Schleife
  const quelle = lies('supabase/functions/_gemeinsam/stripe.js');
  pruefe('Vergleich ohne frueheres return in der Schleife (XOR ueber alle Zeichen)', /unterschied \|= a\.charCodeAt\(i\) \^ b\.charCodeAt\(i\)/.test(quelle)
    && !/for \(let i = 0; i < a\.length; i\+\+\) \{?\s*if/.test(quelle));
}

// ---------------------------------------------------------------------------
// Auswertung der Ereignisse (Formen aus der Stripe-Doku, alte und neue API-Version)
// ---------------------------------------------------------------------------
const iso = (s) => new Date(s * 1000).toISOString();
const ereignis = (type, object, extra = {}) => ({ id: 'evt_1Test' + type.replace(/[^a-z]/g, '').slice(0, 20), object: 'event', type, created: T0, data: { object }, ...extra });
const kauf = (o = {}) => ereignis('checkout.session.completed', { id: 'cs_test_1', object: 'checkout.session', mode: 'subscription', payment_status: 'paid',
  status: 'complete', customer: 'cus_Probe1', subscription: 'sub_Probe1', client_reference_id: UID, customer_details: { email: 'privat@example.invalid' }, ...o });
{
  const a = auswerten(kauf());
  pruefe('Kauf bezahlt: Nutzer aus client_reference_id, vorlaeufig 1 Tag aktiv', a.daten && a.daten.nutzer === UID && a.daten.status === 'aktiv'
    && a.daten.gueltig_bis === iso(T0 + VORLAEUFIG_S) && VORLAEUFIG_S === 86400 && a.daten.kunde_id === 'cus_Probe1' && a.daten.abo_id === 'sub_Probe1'
    && a.daten.erstellt === iso(T0) && a.daten.typ === 'checkout.session.completed' && a.daten.plan === null, a);
  pruefe('Kauf: keine E-Mail und keine Kundendaten in den Daten fuer die Datenbank', !JSON.stringify(a).includes('example.invalid'));
  const ohne = auswerten(kauf({ payment_status: 'unpaid' }));
  pruefe('Kauf noch nicht bezahlt (Lastschrift): Zuordnung ja, Premium erst mit der Rechnung', ohne.daten && ohne.daten.status === 'abgelaufen'
    && ohne.daten.gueltig_bis === iso(T0) && ohne.daten.nutzer === UID);
  pruefe('Kauf ohne Abo (Einmalzahlung) wird ignoriert', auswerten(kauf({ mode: 'payment' })).ignoriert === 'kein_abo');
  pruefe('Kauf mit fremder oder fehlender client_reference_id: nutzer null (Server meldet ohne_nutzer)',
    auswerten(kauf({ client_reference_id: 'flo' })).daten.nutzer === null && auswerten(kauf({ client_reference_id: null })).daten.nutzer === null
    && auswerten(kauf({ client_reference_id: UID.toUpperCase() })).daten.nutzer === UID);
  pruefe('erweiterte Verweise (Objekte mit id) werden gelesen', auswerten(kauf({ customer: { id: 'cus_Obj1' }, subscription: { id: 'sub_Obj1' } })).daten.abo_id === 'sub_Obj1');
  pruefe('Kunde fehlt oder ist kaputt -> ignoriert', auswerten(kauf({ customer: null })).ignoriert === 'kein_kunde'
    && auswerten(kauf({ customer: 'cus_; drop table' })).ignoriert === 'kein_kunde');
  pruefe('kaputte Abo-ID -> ignoriert', auswerten(kauf({ subscription: 'sub_x y' })).ignoriert === 'form');
}
const abo = (o = {}) => ({ id: 'sub_Probe1', object: 'subscription', customer: 'cus_Probe1', status: 'active', cancel_at_period_end: false, cancel_at: null,
  items: { data: [{ id: 'si_1', current_period_end: T0 + 30 * 86400, price: { id: 'price_1', lookup_key: null, recurring: { interval: 'month', interval_count: 1 } } }] }, ...o });
{
  const neu = auswerten(ereignis('customer.subscription.updated', abo()));
  pruefe('Abo aktiv (API ab 2025-03-31: Periode an den Positionen)', neu.daten && neu.daten.status === 'aktiv' && neu.daten.gueltig_bis === iso(T0 + 30 * 86400)
    && neu.daten.plan === 'monat' && neu.daten.abo_id === 'sub_Probe1' && neu.daten.nutzer === null, neu);
  const altApi = auswerten(ereignis('customer.subscription.created', abo({ current_period_end: T0 + 365 * 86400, items: { data: [] }, plan: { interval: 'year', interval_count: 1 } })));
  pruefe('Abo aktiv (aeltere API: current_period_end am Abo, plan statt price)', altApi.daten && altApi.daten.gueltig_bis === iso(T0 + 365 * 86400) && altApi.daten.plan === 'jahr', altApi);
  const gek = auswerten(ereignis('customer.subscription.updated', abo({ cancel_at_period_end: true })));
  pruefe('Kuendigung zum Laufzeitende: gekuendigt, gilt bis Periodenende', gek.daten.status === 'gekuendigt' && gek.daten.gueltig_bis === iso(T0 + 30 * 86400));
  const am = auswerten(ereignis('customer.subscription.updated', abo({ cancel_at: T0 + 10 * 86400 })));
  pruefe('Kuendigung zu einem Datum (cancel_at): gilt bis dahin', am.daten.status === 'gekuendigt' && am.daten.gueltig_bis === iso(T0 + 10 * 86400));
  const probe = auswerten(ereignis('customer.subscription.updated', abo({ status: 'trialing' })));
  pruefe('Testzeitraum (trialing) zaehlt wie aktiv', probe.daten.status === 'aktiv');
  const offen = ['past_due', 'unpaid', 'incomplete', 'incomplete_expired', 'canceled', 'paused'].map((s) => auswerten(ereignis('customer.subscription.updated', abo({ status: s }))).daten);
  pruefe('ohne Zahlung (past_due, unpaid, incomplete, canceled, paused): abgelaufen ab jetzt', offen.every((d) => d.status === 'abgelaufen' && d.gueltig_bis === iso(T0)));
  const ende = auswerten(ereignis('customer.subscription.deleted', abo({ status: 'canceled', ended_at: T0 + 5 })));
  pruefe('Abo beendet: abgelaufen mit ended_at', ende.daten.status === 'abgelaufen' && ende.daten.gueltig_bis === iso(T0 + 5));
  const ohneEnde = auswerten(ereignis('customer.subscription.deleted', abo({ status: 'canceled' })));
  pruefe('Abo beendet ohne ended_at: Zeit des Ereignisses', ohneEnde.daten.gueltig_bis === iso(T0));
  pruefe('aktives Abo ohne Periodenende -> ignoriert (kein erfundenes Datum)', auswerten(ereignis('customer.subscription.updated', abo({ items: { data: [] } }))).ignoriert === 'keine_periode');
  pruefe('planVon: lookup_key, Intervall-Anzahl, unbekannt', planVon(abo({ items: { data: [{ price: { lookup_key: 'trainer-jahr' } }] } })) === 'trainer-jahr'
    && planVon(abo({ items: { data: [{ price: { recurring: { interval: 'month', interval_count: 3 } } }] } })) === '3-monat'
    && planVon({}) === null && planVon(null) === null);
}
{
  const zeilen = [{ period: { start: T0, end: T0 + 30 * 86400 } }, { period: { start: T0, end: T0 + 31 * 86400 } }];
  const alt = auswerten(ereignis('invoice.paid', { id: 'in_1', object: 'invoice', customer: 'cus_Probe1', subscription: 'sub_Probe1', period_end: T0, lines: { data: zeilen } }));
  pruefe('Rechnung bezahlt (aeltere API): aktiv bis zum spaetesten Zeilen-Ende (nicht invoice.period_end)', alt.daten && alt.daten.status === 'aktiv'
    && alt.daten.gueltig_bis === iso(T0 + 31 * 86400) && alt.daten.abo_id === 'sub_Probe1', alt);
  const neu = auswerten(ereignis('invoice.paid', { id: 'in_2', object: 'invoice', customer: 'cus_Probe1',
    parent: { type: 'subscription_details', subscription_details: { subscription: 'sub_Probe2' } }, lines: { data: zeilen } }));
  pruefe('Rechnung bezahlt (neue API: parent.subscription_details)', neu.daten && neu.daten.abo_id === 'sub_Probe2');
  const zeile = auswerten(ereignis('invoice.paid', { id: 'in_3', object: 'invoice', customer: 'cus_Probe1',
    lines: { data: [{ period: { end: T0 + 9 }, parent: { subscription_item_details: { subscription: 'sub_Probe3' } } }] } }));
  pruefe('Rechnung bezahlt: Abo notfalls aus der Rechnungszeile', zeile.daten && zeile.daten.abo_id === 'sub_Probe3' && zeile.daten.gueltig_bis === iso(T0 + 9));
  pruefe('Rechnung ohne Abo (Einzelrechnung) -> ignoriert', auswerten(ereignis('invoice.paid', { customer: 'cus_Probe1', lines: { data: zeilen } })).ignoriert === 'kein_abo');
  pruefe('Rechnung ohne Periode -> ignoriert', auswerten(ereignis('invoice.paid', { customer: 'cus_Probe1', subscription: 'sub_Probe1', lines: { data: [] } })).ignoriert === 'keine_periode');
}
{
  const charge = (o = {}) => ({ id: 'ch_Probe1', object: 'charge', customer: 'cus_Probe1', amount: 1000,
    amount_refunded: 1000, refunded: true, metadata: { subscription_id: 'sub_Probe1' }, ...o });
  const erstattung = auswerten(ereignis('charge.refunded', charge()));
  pruefe('volle Erstattung beendet Premium sofort und ordnet Kunde sowie Abo zu', erstattung.daten
    && erstattung.daten.status === 'abgelaufen' && erstattung.daten.gueltig_bis === iso(T0)
    && erstattung.daten.kunde_id === 'cus_Probe1' && erstattung.daten.abo_id === 'sub_Probe1', erstattung);
  pruefe('Teil-Erstattung entzieht Premium nicht', auswerten(ereignis('charge.refunded', charge({ refunded: false, amount_refunded: 400 }))).ignoriert === 'teil_erstattung');
  const offen = auswerten(ereignis('charge.dispute.created', { id: 'dp_1', object: 'dispute', charge: charge() }));
  const gewonnen = auswerten(ereignis('charge.dispute.closed', { id: 'dp_1', object: 'dispute', status: 'won', charge: charge() }));
  const verloren = auswerten(ereignis('charge.dispute.closed', { id: 'dp_1', object: 'dispute', status: 'lost', charge: charge() }));
  pruefe('Rueckbuchung offen, gewonnen und verloren werden getrennt abgebildet', offen.daten.status === 'strittig'
    && gewonnen.daten.status === 'wiederherstellen' && verloren.daten.status === 'abgelaufen'
    && [offen, gewonnen, verloren].every((x) => x.daten.abo_id === 'sub_Probe1'));
  pruefe('Rueckbuchung ohne sicheren Abo-Bezug wird abgelehnt', auswerten(ereignis('charge.dispute.created', {
    id: 'dp_2', object: 'dispute', charge: charge({ metadata: {} }),
  })).ignoriert === 'kein_abo');
  pruefe('fremder oder ungueltiger Kunde wird abgelehnt', auswerten(ereignis('charge.refunded', charge({ customer: 'cus fremd' }))).ignoriert === 'kein_kunde');
}
pruefe('kaputte Ereignisse -> ignoriert',
  auswerten(null).ignoriert === 'form' && auswerten([]).ignoriert === 'form' && auswerten({ ...kauf(), id: 'falsch' }).ignoriert === 'form'
  && auswerten({ ...kauf(), created: 'gestern' }).ignoriert === 'form' && auswerten({ ...kauf(), data: null }).ignoriert === 'form');
pruefe('TYPEN: Abo-, Erstattungs- und Rueckbuchungsereignisse', JSON.stringify(TYPEN) === JSON.stringify(['checkout.session.completed',
  'customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted', 'invoice.paid',
  'charge.refunded', 'charge.dispute.created', 'charge.dispute.closed']) && Object.isFrozen(TYPEN));

// ---------------------------------------------------------------------------
// verarbeite() mit gefaelschtem fetch
// ---------------------------------------------------------------------------
const JWT_SCHLUESSEL = 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.probe-nicht-echt';
const UMGEBUNG = { STRIPE_WEBHOOK_SECRET: GEHEIM, SUPABASE_URL: 'https://probe.supabase.example/', SUPABASE_SERVICE_ROLE_KEY: JWT_SCHLUESSEL };
function falschesFetch(antworten = []) {
  const aufrufe = [];
  const f = async (url, opt) => {
    aufrufe.push({ url, ...opt });
    const x = antworten.shift() || { status: 200, body: 'neu' };
    if (x.wirft) throw new Error('offline');
    return { ok: x.status < 400, status: x.status, async json() { return x.body; } };
  };
  f.aufrufe = aufrufe;
  return f;
}
const anfrage = (e, { t = T0, geheim = GEHEIM, methode = 'POST', koerper } = {}) => {
  const k = koerper !== undefined ? koerper : JSON.stringify(e);
  return { methode, koerper: k, signatur: signiere(k, t, geheim) };
};
const json = (r) => JSON.parse(r.koerper);
{
  const f = falschesFetch([{ status: 200, body: 'zugeordnet' }]);
  const r = await verarbeite(anfrage(kauf()), UMGEBUNG, { fetch: f, jetzt: T0 + 2 });
  const a = f.aufrufe[0];
  pruefe('gueltiger Kauf: 200, genau ein RPC-Aufruf an abo_stripe_ereignis', r.status === 200 && json(r).ok === true && json(r).ergebnis === 'zugeordnet'
    && f.aufrufe.length === 1 && a.url === 'https://probe.supabase.example/rest/v1/rpc/abo_stripe_ereignis' && a.method === 'POST', { r, a });
  pruefe('RPC mit Service-Schluessel (apikey und Bearer beim JWT) und den ausgewerteten Daten', a.headers.apikey === JWT_SCHLUESSEL
    && a.headers.Authorization === 'Bearer ' + JWT_SCHLUESSEL && a.headers['Content-Type'] === 'application/json'
    && JSON.stringify(JSON.parse(a.body)) === JSON.stringify(auswerten(kauf()).daten));
  pruefe('Antwort an Stripe ohne Geheimnis, Schluessel oder E-Mail', !r.koerper.includes(GEHEIM) && !r.koerper.includes('eyJ') && !r.koerper.includes('@'));
  pruefe('neuer Secret Key (sb_secret_...) nur als apikey, kein Bearer', !('Authorization' in dienstKopf('sb_secret_probe')) && dienstKopf('sb_secret_probe').apikey === 'sb_secret_probe');
}
{
  const f = falschesFetch();
  const r = await verarbeite(anfrage(kauf()), UMGEBUNG, { fetch: f, jetzt: T0 + TOLERANZ_S + 60 });
  pruefe('abgelaufene Signatur (Wiedereinspielen eines alten Ereignisses): 400, keine Datenbank', r.status === 400 && json(r).grund === 'zeit' && f.aufrufe.length === 0);
  const r2 = await verarbeite(anfrage(kauf(), { geheim: 'whsec_falsch' }), UMGEBUNG, { fetch: f, jetzt: T0 });
  pruefe('gefaelschte Signatur: 400, keine Datenbank', r2.status === 400 && json(r2).grund === 'signatur' && f.aufrufe.length === 0);
  const r3 = await verarbeite({ methode: 'POST', koerper: JSON.stringify(kauf()), signatur: null }, UMGEBUNG, { fetch: f, jetzt: T0 });
  pruefe('ohne Stripe-Signature: 400', r3.status === 400 && json(r3).grund === 'kein_kopf');
  const r4 = await verarbeite(anfrage(null, { koerper: '{kaputt' }), UMGEBUNG, { fetch: f, jetzt: T0 });
  pruefe('signiert, aber kein JSON: 400', r4.status === 400 && f.aufrufe.length === 0);
  const r5 = await verarbeite(anfrage(ereignis('charge.refunded', { customer: 'cus_Probe1' })), UMGEBUNG, { fetch: f, jetzt: T0 });
  pruefe('unvollstaendige Erstattung: 200 ignoriert (Stripe soll nicht wiederholen), keine Datenbank', r5.status === 200 && json(r5).ignoriert === 'teil_erstattung' && f.aufrufe.length === 0);
  const r6 = await verarbeite({ ...anfrage(kauf()), methode: 'GET' }, UMGEBUNG, { fetch: f, jetzt: T0 });
  pruefe('GET: 405', r6.status === 405);
  const r7 = await verarbeite(anfrage(kauf()), { ...UMGEBUNG, STRIPE_WEBHOOK_SECRET: '' }, { fetch: f, jetzt: T0 });
  const r8 = await verarbeite(anfrage(kauf()), { ...UMGEBUNG, SUPABASE_SERVICE_ROLE_KEY: undefined }, { fetch: f, jetzt: T0 });
  pruefe('fehlende Secrets: 500 (Stripe wiederholt, bis Flo sie gesetzt hat)', r7.status === 500 && r8.status === 500 && f.aufrufe.length === 0);
  const gross = 'x'.repeat(MAX_KOERPER + 1);
  const r9 = await verarbeite({ methode: 'POST', koerper: gross, signatur: signiere(gross) }, UMGEBUNG, { fetch: f, jetzt: T0 });
  pruefe('zu grosse Anfrage: 413 vor jeder Rechnung', r9.status === 413 && f.aufrufe.length === 0);
  const r10 = await verarbeite({ methode: 'POST', koerper: '', signatur: signiere('') }, UMGEBUNG, { fetch: f, jetzt: T0 });
  pruefe('leere Anfrage: 400', r10.status === 400);
}
{
  const weg = falschesFetch([{ wirft: true }]);
  const r = await verarbeite(anfrage(kauf()), UMGEBUNG, { fetch: weg, jetzt: T0 });
  const kaputt = falschesFetch([{ status: 400, body: { code: 'P0001', message: 'ABO_EREIGNIS_UNGUELTIG' } }]);
  const r2 = await verarbeite(anfrage(kauf()), UMGEBUNG, { fetch: kaputt, jetzt: T0 });
  pruefe('Datenbank nicht erreichbar oder Fehler: 500, damit Stripe wiederholt', r.status === 500 && r2.status === 500 && json(r2).status === 400);
  const doppelt = falschesFetch([{ status: 200, body: 'doppelt' }]);
  const r3 = await verarbeite(anfrage(kauf()), UMGEBUNG, { fetch: doppelt, jetzt: T0 });
  pruefe('doppelte Zustellung: 200 mit Ergebnis "doppelt" (Idempotenz liegt in der Datenbank)', r3.status === 200 && json(r3).ergebnis === 'doppelt');
}

// ---------------------------------------------------------------------------
// Deno-Huelle stripe-webhook/index.ts (Node entfernt die Typen; Deno ist hier nicht installiert)
// ---------------------------------------------------------------------------
{
  const ts = lies('supabase/functions/stripe-webhook/index.ts');
  pruefe('index.ts: nur die Huelle (importiert verarbeite aus _gemeinsam, liest stripe-signature und die drei Secrets aus Deno.env)',
    /import \{ verarbeite \} from '\.\.\/_gemeinsam\/stripe\.js';/.test(ts) && /headers\.get\('stripe-signature'\)/.test(ts)
    && ['STRIPE_WEBHOOK_SECRET', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'].every((k) => ts.includes(`Deno.env.get('${k}')`))
    && (ts.match(/^import /gm) || []).length === 1 && ts.split('\n').length < 40);
  if (process.features && process.features.typescript) {
    const env = { STRIPE_WEBHOOK_SECRET: GEHEIM, SUPABASE_URL: 'https://probe.supabase.example', SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_probe' };
    let handler = null;
    globalThis.Deno = { env: { get: (k) => env[k] }, serve: (fn) => { handler = fn; } };
    const aufrufe = [];
    const echtesFetch = globalThis.fetch;
    globalThis.fetch = async (url, opt) => { aufrufe.push({ url, ...opt }); return { ok: true, status: 200, async json() { return 'neu'; } }; };
    const fehler = console.error;
    console.error = () => {};
    try {
      await import(pathToFileURL(path.join(WURZEL, 'supabase/functions/stripe-webhook/index.ts')).href);
      const t = Math.floor(Date.now() / 1000);
      const k = JSON.stringify({ ...kauf(), created: t });
      const r = await handler(new Request('https://probe.supabase.example/functions/v1/stripe-webhook', { method: 'POST', body: k, headers: { 'Stripe-Signature': signiere(k, t) } }));
      const d = await r.json();
      const r2 = await handler(new Request('https://probe.supabase.example/functions/v1/stripe-webhook', { method: 'POST', body: k, headers: { 'Stripe-Signature': signiere(k, t, 'whsec_falsch') } }));
      const r3 = await handler(new Request('https://probe.supabase.example/functions/v1/stripe-webhook'));
      pruefe('index.ts laeuft: gueltig 200 mit RPC, gefaelscht 400, GET 405 (Deno-Attrappe)', typeof handler === 'function' && r.status === 200 && d.ergebnis === 'neu'
        && aufrufe.length === 1 && aufrufe[0].headers.apikey === 'sb_secret_probe' && r2.status === 400 && r3.status === 405
        && /application\/json/.test(r.headers.get('content-type')), { status: r.status, d, aufrufe: aufrufe.length });
    } catch (e) {
      pruefe('index.ts laeuft (Deno-Attrappe)', false, e.message);
    } finally {
      globalThis.fetch = echtesFetch;
      console.error = fehler;
      delete globalThis.Deno;
    }
  } else {
    // Node ohne Typ-Entfernung (vor 22.6): dann wenigstens die Antwort-Zeile pruefen
    pruefe('index.ts gibt Status, Kopf und Koerper von verarbeite() weiter (Node ohne TS: nur statisch)',
      /new Response\(ergebnis\.koerper, \{ status: ergebnis\.status, headers: ergebnis\.kopf \}\)/.test(ts));
  }
}

// ---------------------------------------------------------------------------
// Vertrag mit supabase/abo-schema.sql und Sicherheit (statisch; die SQL laeuft im PGlite-Pruefer)
// ---------------------------------------------------------------------------
{
  const sql = lies('supabase/abo-schema.sql');
  const ohneKommentar = sql.split('\n').map((z) => z.replace(/--.*$/, '')).join('\n');
  const sig = (ohneKommentar.match(/function public\.abo_stripe_ereignis\(([\s\S]*?)\)\s*returns text/) || [])[1] || '';
  const params = [...sig.matchAll(/^\s*([a-z_]+)\s+(text|timestamptz|uuid)/gm)].map((m) => m[1]);
  pruefe('Vertrag: auswerten() liefert genau die Parameter von abo_stripe_ereignis', JSON.stringify(params) === JSON.stringify(Object.keys(auswerten(kauf()).daten)), params);
  pruefe('RLS an fuer produkte, abos, stripe_ereignisse', ['produkte', 'abos', 'stripe_ereignisse'].every((t) => ohneKommentar.includes(`alter table public.${t} enable row level security;`)));
  pruefe('Rechte: alles weg fuer anon, authenticated, public; danach nur lesen', /revoke all on table public\.produkte, public\.abos, public\.stripe_ereignisse from anon, authenticated, public;/.test(ohneKommentar)
    && /grant select on table public\.produkte to anon, authenticated;/.test(ohneKommentar) && /grant select on table public\.abos to authenticated;/.test(ohneKommentar)
    && !/grant (insert|update|delete|all)[^;]*to[^;]*(anon|authenticated)/.test(ohneKommentar));
  pruefe('Funktionen: nie fuer anon/public; ist_premium_von und abo_stripe_ereignis nur Service-Rolle; abo_wende_an fuer niemanden',
    /revoke all on function public\.ist_premium\(\) from anon, public;/.test(ohneKommentar)
    && /grant execute on function public\.ist_premium_von\(uuid\) to service_role;/.test(ohneKommentar)
    && /revoke all on function public\.abo_wende_an\([^)]*\) from anon, authenticated, public, service_role;/.test(ohneKommentar)
    && !/grant execute on function public\.abo_wende_an/.test(ohneKommentar)
    && !/grant execute on function public\.(ist_premium_von|abo_stripe_ereignis)[^;]*(anon|authenticated)/.test(ohneKommentar));
  const definer = [...ohneKommentar.matchAll(/create or replace function ([\s\S]*?)\$\$/g)].map((m) => m[1]).filter((k) => /security definer/.test(k));
  pruefe('jede security-definer-Funktion setzt search_path', definer.length >= 1 && definer.every((k) => /set search_path = /.test(k)), definer.length);
  pruefe('Kauf- und Portal-Link: nur https (Pruefung in der Tabelle)', /produkte_kauf_link_form[\s\S]{0,140}\^https:\/\//.test(sql) && /produkte_portal_link_form[\s\S]{0,140}\^https:\/\//.test(sql));
  pruefe('Policies: Produkte nur aktive, Abo nur das eigene', /on public\.produkte for select\s+to anon, authenticated\s+using \(aktiv\);/.test(ohneKommentar)
    && /on public\.abos for select\s+to authenticated\s+using \(\(select auth\.uid\(\)\) = user_id\);/.test(ohneKommentar));
  pruefe('ist_premium: Status aktiv/gekuendigt UND gueltig_bis in der Zukunft', (ohneKommentar.match(/t\.status in \('aktiv', 'gekuendigt'\)\s+and t\.gueltig_bis > now\(\)/g) || []).length === 2);
  // Gleichzeitige Zustellung (Pruefer-Befund B1): ohne Sperre je Kunde sieht ein Abo-Ereignis den parallel laufenden,
  // noch nicht festgeschriebenen Kauf nicht (und umgekehrt) und bleibt fuer immer 'wartet'. Nachgestellt mit zwei
  // psql-Sitzungen gegen echtes Postgres 16 (PGlite hat nur eine Verbindung); hier der Vertrag, dass die Sperre vor
  // dem ersten Lesen oder Schreiben steht.
  const rumpf = (name) => (ohneKommentar.match(new RegExp(`create or replace function public\\.${name}\\([\\s\\S]*?\\$\\$([\\s\\S]*?)\\$\\$;`)) || [])[1] || '';
  const ereignis = rumpf('abo_stripe_ereignis');
  const sperre = ereignis.indexOf("perform pg_advisory_xact_lock(hashtextextended('abo:' || v_kunde, 0));");
  pruefe('Gleichzeitigkeit: abo_stripe_ereignis sperrt je Kunde, bevor es stripe_ereignisse oder abos liest oder schreibt',
    sperre > 0 && sperre < ereignis.indexOf('insert into public.stripe_ereignisse') && sperre < ereignis.indexOf('public.abos')
    && sperre > ereignis.indexOf("raise exception 'ABO_EREIGNIS_UNGUELTIG'"), sperre);
  const nach = rumpf('abo_hole_nach');
  const sperre2 = nach.indexOf("perform pg_advisory_xact_lock(hashtextextended('abo:' || kunde, 0));");
  pruefe('abo_hole_nach: dieselbe Sperre zuerst, der Kauf holt ueber abo_hole_nach nach', sperre2 > 0 && sperre2 < nach.indexOf('public.abos')
    && sperre2 < nach.indexOf('public.stripe_ereignisse') && /perform public\.abo_hole_nach\(v_kunde, v_abo\);/.test(ereignis), sperre2);
  pruefe('abo_hole_nach: nur fuer den Besitzer (Flo im SQL Editor), nicht security definer',
    /revoke all on function public\.abo_hole_nach\(text, text\) from anon, authenticated, public, service_role;/.test(ohneKommentar)
    && !/grant execute on function public\.abo_hole_nach/.test(ohneKommentar)
    && !/function public\.abo_hole_nach[^$]*security definer/.test(ohneKommentar));
  const test = lies('supabase/abo-rls-test.sql');
  pruefe('abo-rls-test.sql: Kauf ohne Nutzer, Handzeile und abo_hole_nach als Fall', /abo_hole_nach\('cus_X1'\)/.test(test) && test.includes('ABO_KUNDE_UNBEKANNT'));
  pruefe('Erstattung/Rueckbuchung: Schema erlaubt alle Typen, Streit ist nicht Premium und die RLS-Probe prueft den Ablauf',
    ['charge.refunded', 'charge.dispute.created', 'charge.dispute.closed'].every((typ) => sql.includes(`'${typ}'`) && test.includes(`'${typ}'`))
    && /status in \('aktiv', 'gekuendigt', 'abgelaufen', 'strittig'\)/.test(sql)
    && !/t\.status in \([^)]*strittig/.test(ohneKommentar));
  pruefe('Konto-Loeschung: Before-Delete-Trigger entfernt Ereignisse samt Stripe-Kennungen, RLS-Probe loescht den Nutzer',
    /before delete on public\.abos\s+for each row execute function public\.loesche_stripe_kennungen_vor_abo\(\);/.test(ohneKommentar)
    && /delete from public\.stripe_ereignisse/.test(ohneKommentar)
    && /delete from auth\.users where id = 'c3333333/.test(test)
    && test.includes('Stripe-Kennungen des geloeschten Kontos sind geblieben'));
  pruefe('abo-rls-test.sql: in einer Transaktion, rollt zurueck, meldet Erfolg', /^begin;/m.test(test) && /rollback;\s*$/.test(test) && test.includes("'Abo-RLS-Test erfolgreich'"));
}
{
  // Keine Geheimnisse und keine Preise in den Dateien des Abos (oeffentliches Repo)
  const dateien = ['supabase/abo-schema.sql', 'supabase/abo-rls-test.sql', 'supabase/functions/_gemeinsam/stripe.js', 'supabase/functions/stripe-webhook/index.ts',
    'js/abo.js', 'js/pakete/abo/index.js', 'js/pakete/abo/trainer.js', 'css/pakete/abo.css', 'supabase/ANLEITUNG.md'];
  const GEHEIM_RE = /(sk|rk)_(live|test)_[A-Za-z0-9]{8,}|whsec_[A-Za-z0-9]{12,}|sb_secret_[A-Za-z0-9_-]{12,}|eyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]{10,}/;
  const PREIS_RE = /\d+(?:[.,]\d{1,2})?\s*(?:€|EUR\b|Euro\b)|€\s*\d/;
  const geheim = [];
  const preis = [];
  for (const d of dateien) {
    let t = '';
    try { t = lies(d); } catch (e) { geheim.push(d + ' fehlt'); continue; }
    if (GEHEIM_RE.test(t)) geheim.push(d + ': ' + t.match(GEHEIM_RE)[0].slice(0, 12) + '...');
    if (PREIS_RE.test(t)) preis.push(d + ': ' + t.match(PREIS_RE)[0]);
  }
  pruefe(`keine Schluessel oder Webhook-Geheimnisse in ${dateien.length} Abo-Dateien`, geheim.length === 0, geheim);
  pruefe(`keine Preise in den Abo-Dateien (Preise stehen nur in Flos Tabelle produkte)`, preis.length === 0, preis);
  pruefe('Muster fangen Beispiele', GEHEIM_RE.test('sk_live_' + 'abcdefgh12') && GEHEIM_RE.test('whsec_' + 'abcdefghijkl12') && PREIS_RE.test('4,99 €') && PREIS_RE.test('€ 5') && PREIS_RE.test('12 EUR')
    && !PREIS_RE.test('Level 12') && !PREIS_RE.test('KW 2 · 2027'));
}

console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
