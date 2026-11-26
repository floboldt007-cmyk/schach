// Server-Test fuer Kuendigen und Widerrufen (supabase/functions/_gemeinsam/abo-beenden.js und mail.js) mit gefaelschtem
// fetch fuer Supabase, Stripe und Resend. Kern: Kuendigen geht angemeldet und ohne Anmeldung (Einmal-Link), die Antwort
// auf eine Link-Anfrage verraet nie, ob eine Adresse ein Abo hat, der Widerruf gilt 14 Tage (plus ein Tag Kulanz) und
// erstattet den nicht genutzten Teil. Laeuft ohne Netz und ohne Deno.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  verarbeite, erstattungCent, sha256hex, WIDERRUF_MS, KULANZ_MS, TAG_MS, LINK_GUELTIG_MS,
} from '../supabase/functions/_gemeinsam/abo-beenden.js';
import { mailBereit, RESEND_API } from '../supabase/functions/_gemeinsam/mail.js';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lies = (d) => readFileSync(path.join(WURZEL, d), 'utf8');

let ok = 0;
let gesamt = 0;
function pruefe(name, bedingung, info) {
  gesamt++;
  if (bedingung) { ok++; console.log('ok     ' + name); } else console.log('FEHLER ' + name + (info !== undefined ? '  -> ' + JSON.stringify(info) : ''));
}

const RK = ['rk', 'test', 'ProbeAboNurTest0001'].join('_');
const RESEND = ['re', 'ProbeNurTest0001'].join('_');
const DIENST = 'sb_secret_probe';
const JWT = ['eyJhbGciOiJIUzI1NiJ9', 'eyJzdWIiOiJwcm9iZSJ9', 'probe-signatur-nicht-echt'].join('.');
const UID = '0f8b6c1e-2d3a-4b5c-8d9e-0a1b2c3d4e5f';
const MAIL = 'probe.kunde@example.invalid';
const BASIS = 'https://probe.supabase.example';
const UMGEBUNG = Object.freeze({ SUPABASE_URL: BASIS, SUPABASE_SERVICE_ROLE_KEY: DIENST, SUPABASE_ANON_KEY: 'anon-probe',
  ABO_STRIPE_RK: RK, RESEND_API_KEY: RESEND, ABO_MAIL_ABSENDER: 'Crownmate <kontakt@crownmate.example>' });
const T0 = Date.UTC(2026, 10, 5, 12);
const START_S = Math.floor((T0 - 3 * TAG_MS) / 1000);          // Abo vor 3 Tagen abgeschlossen
const ENDE_S = START_S + 30 * 86400;
const ZEILE = [{ status: 'aktiv', abo_id: 'sub_Probe1', kunde_id: 'cus_Probe1', quelle: 'stripe' }];
const SUB = { id: 'sub_Probe1', customer: 'cus_Probe1', status: 'active', start_date: START_S,
  items: { data: [{ current_period_start: START_S, current_period_end: ENDE_S }] } };
const CHARGE = { id: 'ch_Probe1', paid: true, status: 'succeeded', refunded: false, amount: 3000, amount_refunded: 0, created: START_S + 5 };

function netz(o = {}) {
  const s = { user: { id: UID, email: MAIL, email_confirmed_at: '2026-01-01T00:00:00Z' }, userStatus: 200, abo: ZEILE,
    kuendigen: { status: 200, daten: { ...SUB, cancel_at_period_end: true, cancel_at: ENDE_S } },
    sub: { status: 200, daten: SUB }, charges: { status: 200, daten: { data: [CHARGE] } },
    loeschen: { status: 200, daten: { ...SUB, status: 'canceled' } }, erstattung: { status: 200, daten: { id: 're_x' } },
    mail: 200, linkAnlegen: true, linkPruefen: [{ user_id: UID, email: MAIL }], ...o };
  const aufrufe = [];
  const antwort = (status, daten) => ({ ok: status < 400, status, async json() { return daten; } });
  const f = async (url, opt = {}) => {
    aufrufe.push({ url, ...opt });
    if (url === `${BASIS}/auth/v1/user`) return antwort(s.userStatus, s.user);
    if (url.startsWith(`${BASIS}/rest/v1/abos?`)) return antwort(200, s.abo);
    if (url === `${BASIS}/rest/v1/rpc/abo_vorgang_eintragen`) return antwort(204, null);
    if (url === `${BASIS}/rest/v1/rpc/abo_link_anlegen`) return antwort(200, s.linkAnlegen);
    if (url === `${BASIS}/rest/v1/rpc/abo_link_pruefen`) return antwort(200, s.linkPruefen);
    if (url === `${BASIS}/rest/v1/rpc/abo_link_verbrauchen`) return antwort(204, null);
    if (url === RESEND_API) return antwort(s.mail, { id: 'mail_x' });
    if (url === 'https://api.stripe.com/v1/subscriptions/sub_Probe1') {
      const a = opt.method === 'GET' ? s.sub : opt.method === 'DELETE' ? s.loeschen : s.kuendigen;
      if (a.netz) throw new Error('netz');
      return antwort(a.status, a.daten || {});
    }
    if (url.startsWith('https://api.stripe.com/v1/charges?')) return antwort(s.charges.status, s.charges.daten);
    if (url === 'https://api.stripe.com/v1/refunds') return antwort(s.erstattung.status, s.erstattung.daten);
    return antwort(404, {});
  };
  return { f, aufrufe, s };
}
const lauf = (n, daten, { autorisierung = `Bearer ${JWT}`, methode = 'POST', umgebung = UMGEBUNG, jetzt = T0, koerper } = {}) =>
  verarbeite({ methode, koerper: koerper ?? JSON.stringify(daten), autorisierung }, umgebung, { fetch: n.f, jetzt, zufall: (b) => b.fill(7) });
const json = (e) => { try { return JSON.parse(e.koerper); } catch (x) { return null; } };
const zu = (n, teil) => n.aufrufe.filter((a) => a.url.includes(teil));
const rpcDaten = (n, name) => zu(n, `/rpc/${name}`).map((a) => JSON.parse(a.body));
const mails = (n) => zu(n, RESEND_API).map((a) => JSON.parse(a.body));

// ---------------------------------------------------------------------------
// Methode, Einrichtung, Eingabe
// ---------------------------------------------------------------------------
{
  const n = netz();
  pruefe('OPTIONS: 204', (await lauf(n, {}, { methode: 'OPTIONS' })).status === 204);
  pruefe('GET: 405', (await lauf(n, {}, { methode: 'GET' })).status === 405);
  pruefe('unbekannte Aktion: 400 eingabe', json(await lauf(n, { aktion: 'loeschen' })).fehler === 'eingabe');
  pruefe('kein JSON: 400', (await lauf(n, null, { koerper: 'kaputt' })).status === 400);
  pruefe('zu gross: 413', (await lauf(n, null, { koerper: JSON.stringify({ aktion: 'kuendigen', x: 'a'.repeat(5000) }) })).status === 413);
  pruefe('ohne Resend-Schluessel: 503 nicht_eingerichtet, nichts bei Stripe',
    json(await lauf(n, { aktion: 'kuendigen' }, { umgebung: { ...UMGEBUNG, RESEND_API_KEY: '' } })).fehler === 'nicht_eingerichtet'
    && zu(n, 'api.stripe.com').length === 0);
  pruefe('voller Stripe-Secret-Key statt rk_: 503', json(await lauf(n, { aktion: 'kuendigen' },
    { umgebung: { ...UMGEBUNG, ABO_STRIPE_RK: ['sk', 'test', 'ProbeNurTest0001'].join('_') } })).fehler === 'nicht_eingerichtet');
  pruefe('mailBereit: Absender ohne Adresse zaehlt nicht', !mailBereit({ ...UMGEBUNG, ABO_MAIL_ABSENDER: 'Crownmate' }) && mailBereit(UMGEBUNG));
}

// ---------------------------------------------------------------------------
// Kuendigen (angemeldet)
// ---------------------------------------------------------------------------
{
  const n = netz();
  const e = await lauf(n, { aktion: 'kuendigen' });
  const d = json(e);
  const st = zu(n, 'api.stripe.com/v1/subscriptions/sub_Probe1')[0];
  pruefe('kuendigen: 200, wirksam zum Periodenende, Mail raus', e.status === 200 && d.art === 'kuendigung'
    && d.wirksam_zum === new Date(ENDE_S * 1000).toISOString() && d.mail === true, d);
  pruefe('kuendigen: Stripe cancel_at_period_end per POST mit Idempotency-Key', st && st.method === 'POST'
    && new URLSearchParams(st.body).get('cancel_at_period_end') === 'true' && /crownmate-kuendigen-sub_Probe1/.test(st.headers['Idempotency-Key']));
  const m = mails(n)[0];
  pruefe('kuendigen: Mail an die bestaetigte Adresse mit Datum und Uhrzeit, nur Text', m && m.to[0] === MAIL
    && /Eingegangen am: 05\.11\.2026, 13:00 Uhr/.test(m.text) && /Wirksam zum: 02\.12\.2026/.test(m.text) && !('html' in m), m && m.text);
  const v = rpcDaten(n, 'abo_vorgang_eintragen')[0];
  pruefe('kuendigen: Nachweis mit Art, Weg und Mail-Status', v && v.p_user === UID && v.p_art === 'kuendigung' && v.p_weg === 'angemeldet' && v.p_mail === true);
  pruefe('kuendigen: Antwort ohne Nutzer-ID, E-Mail, Stripe-Kennung', !/sub_|cus_|@|0f8b6c1e/.test(e.koerper));
  pruefe('kuendigen ohne Anmeldung: 401', (await lauf(netz(), { aktion: 'kuendigen' }, { autorisierung: '' })).status === 401);
  pruefe('kuendigen mit abgelaufenem Token: 401', (await lauf(netz({ userStatus: 401 }), { aktion: 'kuendigen' })).status === 401);
  const n1 = netz({ abo: [] });
  pruefe('kein Abo: 409 kein_abo, nichts bei Stripe', json(await lauf(n1, { aktion: 'kuendigen' })).fehler === 'kein_abo' && zu(n1, 'api.stripe.com').length === 0);
  pruefe('manuelles Abo (Testerin): 409 kein_abo', json(await lauf(netz({ abo: [{ ...ZEILE[0], quelle: 'manuell' }] }), { aktion: 'kuendigen' })).fehler === 'kein_abo');
  const n3 = netz({ kuendigen: { status: 200, daten: { ...SUB, customer: 'cus_Fremd' } } });
  const r3 = json(await lauf(n3, { aktion: 'kuendigen' }));
  pruefe('Stripe meldet anderen Kunden: 409 kein_abo, keine Mail, kein Nachweis', r3.fehler === 'kein_abo' && mails(n3).length === 0 && rpcDaten(n3, 'abo_vorgang_eintragen').length === 0);
  const n4 = netz({ mail: 500 });
  const r4 = json(await lauf(n4, { aktion: 'kuendigen' }));
  pruefe('Mail scheitert: Kuendigung gilt trotzdem, mail false, Nachweis mit p_mail false', r4.art === 'kuendigung' && r4.mail === false && rpcDaten(n4, 'abo_vorgang_eintragen')[0].p_mail === false);
  pruefe('Stripe nicht erreichbar: 503 stripe', json(await lauf(netz({ kuendigen: { netz: true } }), { aktion: 'kuendigen' })).fehler === 'stripe');
  pruefe('Stripe-Schluessel ohne Recht: 503 nicht_eingerichtet', json(await lauf(netz({ kuendigen: { status: 403 } }), { aktion: 'kuendigen' })).fehler === 'nicht_eingerichtet');
  const n5 = netz({ user: { id: UID, email: MAIL, email_confirmed_at: null } });
  const r5 = json(await lauf(n5, { aktion: 'kuendigen' }));
  pruefe('unbestaetigte Adresse: Kuendigung ja, aber keine Mail an sie', r5.art === 'kuendigung' && mails(n5).length === 0 && r5.mail === false);
}

// ---------------------------------------------------------------------------
// Widerrufen
// ---------------------------------------------------------------------------
{
  const n = netz();
  const d = json(await lauf(n, { aktion: 'widerrufen' }));
  const er = zu(n, 'api.stripe.com/v1/refunds')[0];
  const erwartet = Math.floor(3000 * (1 - (T0 / 1000 - START_S) / (ENDE_S - START_S)));
  pruefe('widerrufen am Tag 3: Abo sofort beendet (DELETE)', zu(n, 'subscriptions/sub_Probe1').some((a) => a.method === 'DELETE'));
  pruefe('widerrufen: Erstattung des nicht genutzten Teils (27 von 30 Tagen)', er && new URLSearchParams(er.body).get('amount') === String(erwartet)
    && d.erstattet_cent === erwartet && erwartet === 2700, { d, erwartet });
  pruefe('widerrufen: Mail nennt Betrag und § 357a', /Erstattung: 27,00 €/.test(mails(n)[0].text) && /§ 357a Abs\. 2 BGB/.test(mails(n)[0].text));
  pruefe('widerrufen: Nachweis art widerruf mit Betrag', rpcDaten(n, 'abo_vorgang_eintragen')[0].p_art === 'widerruf' && rpcDaten(n, 'abo_vorgang_eintragen')[0].p_erstattet === 2700);
  const tag14 = (START_S * 1000) + WIDERRUF_MS + KULANZ_MS - 1000;
  pruefe('widerrufen am letzten Tag der Frist (plus Kulanz): geht', json(await lauf(netz(), { aktion: 'widerrufen' }, { jetzt: tag14 })).art === 'widerruf');
  const n2 = netz();
  const zuSpaet = json(await lauf(n2, { aktion: 'widerrufen' }, { jetzt: (START_S * 1000) + WIDERRUF_MS + KULANZ_MS + 1000 }));
  pruefe('widerrufen nach der Frist: 409 frist_vorbei, nichts geloescht, nichts erstattet', zuSpaet.fehler === 'frist_vorbei'
    && !zu(n2, 'subscriptions/sub_Probe1').some((a) => a.method === 'DELETE') && zu(n2, '/refunds').length === 0);
  const n3 = netz({ charges: { status: 200, daten: { data: [] } } });
  pruefe('widerrufen ohne Zahlung (Probezeit): beendet, erstattet 0', json(await lauf(n3, { aktion: 'widerrufen' })).erstattet_cent === 0 && zu(n3, '/refunds').length === 0);
  const n4 = netz({ erstattung: { status: 500, daten: {} } });
  const r4 = json(await lauf(n4, { aktion: 'widerrufen' }));
  pruefe('Erstattung scheitert: Widerruf gilt, erstattet null, Mail verspricht Erstattung in 14 Tagen', r4.art === 'widerruf' && r4.erstattet_cent === null
    && /spätestens 14 Tage nach heute/.test(mails(n4)[0].text));
  pruefe('widerrufen ohne Anmeldung: 401', (await lauf(netz(), { aktion: 'widerrufen' }, { autorisierung: '' })).status === 401);
  const n5 = netz({ sub: { status: 200, daten: { ...SUB, customer: 'cus_Fremd' } } });
  pruefe('fremdes Abo bei Stripe: 409, nichts geloescht', json(await lauf(n5, { aktion: 'widerrufen' })).fehler === 'kein_abo'
    && !zu(n5, 'subscriptions/sub_Probe1').some((a) => a.method === 'DELETE'));
  pruefe('erstattungCent: nach voller Periode 0, vor Beginn alles, schon erstattet zaehlt ab',
    erstattungCent({ bezahlt: 3000, periodeStart: 0, periodeEnde: 100, jetztS: 100 }) === 0
    && erstattungCent({ bezahlt: 3000, periodeStart: 0, periodeEnde: 100, jetztS: -5 }) === 3000
    && erstattungCent({ bezahlt: 3000, schonErstattet: 1000, periodeStart: 0, periodeEnde: 100, jetztS: 50 }) === 1000);
}

// ---------------------------------------------------------------------------
// Kuendigen ohne Anmeldung (Link)
// ---------------------------------------------------------------------------
{
  const mit = netz();
  const ohne = netz({ linkAnlegen: false });
  const a = await lauf(mit, { aktion: 'link_anfordern', email: 'Probe.Kunde@example.invalid' }, { autorisierung: '' });
  const b = await lauf(ohne, { aktion: 'link_anfordern', email: 'niemand@example.invalid' }, { autorisierung: '' });
  pruefe('Link anfordern: mit und ohne Abo exakt dieselbe Antwort', a.status === 200 && a.status === b.status && a.koerper === b.koerper, [a.koerper, b.koerper]);
  pruefe('Link anfordern ohne Abo: keine Mail', mails(ohne).length === 0);
  const token = '07'.repeat(32);
  const m = mails(mit)[0];
  pruefe('Link-Mail: Link mit Token im Hash-Teil, 60 Minuten', m && m.text.includes(`#kuendigen=${token}`) && /60 Minuten/.test(m.text) && m.to[0] === 'Probe.Kunde@example.invalid');
  const anl = rpcDaten(mit, 'abo_link_anlegen')[0];
  pruefe('Datenbank bekommt nur den Hash, nie das Token, Adresse klein', anl.p_hash === await sha256hex(token) && !JSON.stringify(anl).includes(token)
    && anl.p_email === 'probe.kunde@example.invalid' && Date.parse(anl.p_ablauf) === T0 + LINK_GUELTIG_MS);
  pruefe('Link anfordern mit kaputter Adresse: 400', (await lauf(netz(), { aktion: 'link_anfordern', email: 'kaputt' }, { autorisierung: '' })).status === 400);

  const k = netz();
  const r = json(await lauf(k, { aktion: 'link_kuendigen', token }, { autorisierung: '' }));
  pruefe('Kuendigen per Link: 200, Nachweis Weg link, Link danach verbraucht', r.art === 'kuendigung'
    && rpcDaten(k, 'abo_vorgang_eintragen')[0].p_weg === 'link' && rpcDaten(k, 'abo_link_verbrauchen').length === 1
    && rpcDaten(k, 'abo_link_pruefen')[0].p_hash === await sha256hex(token));
  pruefe('Kuendigen per Link: keine Anmeldung noetig, auth/v1/user nie gefragt', zu(k, '/auth/v1/user').length === 0);
  const alt = netz({ linkPruefen: [] });
  pruefe('abgelaufener oder benutzter Link: 410, nichts bei Stripe', json(await lauf(alt, { aktion: 'link_kuendigen', token }, { autorisierung: '' })).fehler === 'link_ungueltig'
    && zu(alt, 'api.stripe.com').length === 0);
  const sf = netz({ kuendigen: { netz: true } });
  await lauf(sf, { aktion: 'link_kuendigen', token }, { autorisierung: '' });
  pruefe('Stripe scheitert beim Link: Link bleibt gueltig (nicht verbraucht)', rpcDaten(sf, 'abo_link_verbrauchen').length === 0);
  pruefe('Token in falscher Form: 400', (await lauf(netz(), { aktion: 'link_kuendigen', token: 'abc' }, { autorisierung: '' })).status === 400);
}

// ---------------------------------------------------------------------------
// Huelle, Schema, App (nur Text)
// ---------------------------------------------------------------------------
{
  const ts = lies('supabase/functions/abo-beenden/index.ts');
  pruefe('Huelle: liest die eigenen Secrets, ruft verarbeite auf', /RESEND_API_KEY: Deno\.env\.get\('RESEND_API_KEY'\)/.test(ts)
    && /ABO_MAIL_ABSENDER: Deno\.env\.get\('ABO_MAIL_ABSENDER'\)/.test(ts) && /from '\.\.\/_gemeinsam\/abo-beenden\.js'/.test(ts));
  pruefe('Huelle: Deploy ohne JWT-Pruefung (Kuendigen ohne Anmeldung)', /functions deploy abo-beenden --no-verify-jwt/.test(ts));
  const sql = lies('supabase/abo-beenden-schema.sql');
  pruefe('Schema: RLS an, Links ohne Zugriff fuer Nutzer, Funktionen nur fuer service_role',
    /alter table public\.abo_kuendigungs_links enable row level security/.test(sql)
    && /revoke all on table public\.abo_vorgaenge, public\.abo_kuendigungs_links from anon, authenticated, public/.test(sql)
    && (sql.match(/grant execute on function public\.abo_[a-z_]+\([^)]*\) to service_role;/g) || []).length === 4
    && !/grant execute[^;]*(anon|authenticated)/.test(sql));
  pruefe('Schema: alle Funktionen mit festem search_path', (sql.match(/security definer\s+set search_path = ''/g) || []).length === 4);
}

console.log(`\n${ok}/${gesamt} bestanden`);
if (ok !== gesamt) process.exit(1);
