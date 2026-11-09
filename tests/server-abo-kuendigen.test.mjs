// Kuendigungsbutton (Paragraf 312k BGB), Server-Seite: supabase/functions/_gemeinsam/abo-kuendigen.js mit gefaelschtem
// fetch. Supabase und Stripe werden nie aufgerufen. Geprueft wird vor allem: Die Nutzer-ID kommt nur aus der Anmeldung,
// das Abo nur aus der eigenen Zeile in abos, und die Antwort verraet keine Nummern.
//   node tests/server-abo-kuendigen.test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  MAX_KOERPER, MAX_GRUND, MAX_VORAUS_TAGE, ARTEN, META_KUENDIGUNG, META_KUENDIGUNG_ART, VERTRAG, pruefeEingabe, kuendigungsParameter, verarbeite,
} from '../supabase/functions/_gemeinsam/abo-kuendigen.js';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lies = (d) => readFileSync(path.join(WURZEL, d), 'utf8');
let ok = 0;
let gesamt = 0;
function pruefe(name, bedingung, info) {
  gesamt++;
  if (bedingung) { ok++; console.log('ok     ' + name); } else console.log('FEHLER ' + name + (info !== undefined ? '  -> ' + JSON.stringify(info) : ''));
}

const UID = '0f8b6c1e-2d3a-4b5c-8d9e-0a1b2c3d4e5f';
const FREMD = '11111111-2222-4333-8444-555555555555';
const T = Date.UTC(2026, 10, 9, 20, 15, 30);          // 09.11.2026 20:15:30 UTC
const BIS = Date.UTC(2026, 11, 1, 12);                // bezahlter Zeitraum endet am 01.12.2026
const RK = 'rk_test_' + 'Probe'.repeat(4);            // Form eines eingeschraenkten Schluessels, kein echter
const JWT = 'aaaaaaaaaaaaaaaaaaaa.bbbbbbbbbbbbbbbbbbbb.cccccccccccccccccccc';
const UMG = { SUPABASE_URL: 'https://probe.supabase.example/', SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_probe', SUPABASE_ANON_KEY: 'sb_publishable_probe', ABO_STRIPE_RK: RK };
const ZEILE = { status: 'aktiv', gueltig_bis: new Date(BIS).toISOString(), quelle: 'stripe', kunde_id: 'cus_Eigen1', abo_id: 'sub_Eigen1' };

// Nachgebaute Gegenstellen: /auth/v1/user, /rest/v1/abos, api.stripe.com
function welt({ nutzer = { id: UID, email: 'privat@example.invalid' }, authStatus = 200, zeilen = [ZEILE], abosStatus = 200, stripe = [] } = {}) {
  const aufrufe = [];
  const f = async (url, opt = {}) => {
    aufrufe.push({ url, ...opt });
    if (url.includes('/auth/v1/user')) return { ok: authStatus < 400, status: authStatus, async json() { return nutzer; } };
    if (url.includes('/rest/v1/abos')) return { ok: abosStatus < 400, status: abosStatus, async json() { return zeilen; } };
    if (url.startsWith('https://api.stripe.com/')) {
      const x = stripe.shift() || { status: 200, body: { id: 'sub_Eigen1', customer: 'cus_Eigen1', cancel_at_period_end: true, cancel_at: Math.floor(BIS / 1000) } };
      if (x.wirft) throw new Error('netz');
      return { ok: x.status < 400, status: x.status, async json() { return x.body; } };
    }
    throw new Error('unerwartet ' + url);
  };
  f.aufrufe = aufrufe;
  f.stripe = () => aufrufe.filter((a) => a.url.startsWith('https://api.stripe.com/'));
  return f;
}
const anfrage = (daten = {}, extra = {}) => ({ methode: 'POST', koerper: typeof daten === 'string' ? daten : JSON.stringify(daten), autorisierung: 'Bearer ' + JWT, ...extra });
const json = (r) => JSON.parse(r.koerper);

// ---------------------------------------------------------------------------
// Eingabe
// ---------------------------------------------------------------------------
{
  pruefe('Konstanten: zwei Arten, Grenzen, Vertragsname', JSON.stringify(ARTEN) === JSON.stringify(['ordentlich', 'ausserordentlich']) && MAX_GRUND === 500
    && MAX_KOERPER === 4096 && MAX_VORAUS_TAGE === 730 && VERTRAG === 'Crownmate Trainer');
  const std = pruefeEingabe({}, T);
  pruefe('leere Eingabe: ordentlich zum naechstmoeglichen Zeitpunkt', std && std.art === 'ordentlich' && std.zeitpunkt === 'naechster' && std.grund === '');
  const tag = pruefeEingabe({ art: 'ausserordentlich', grund: '  Zeile 1\nZeile 2\u0000  ', zeitpunkt: '2026-12-24' }, T);
  pruefe('Kalendertag: Ende des Tages (23:00 UTC), Grund ohne Steuerzeichen', tag && tag.art === 'ausserordentlich' && tag.grund === 'Zeile 1 Zeile 2'
    && tag.zeitpunkt === Date.UTC(2026, 11, 24, 23), tag);
  pruefe('pruefeEingabe gibt den eingetragenen Tag mit zurueck (null bei "naechster")', tag.tag === '2026-12-24' && std.tag === null);
  pruefe('Grund wird auf 500 Zeichen gekuerzt', pruefeEingabe({ grund: 'x'.repeat(900) }, T).grund.length === 500);
  pruefe('abgelehnt: unbekannte Art, Datum in der Vergangenheit, kein Kalendertag, 31.02., zu weit voraus, Grund kein Text, Liste',
    pruefeEingabe({ art: 'sofort' }, T) === null && pruefeEingabe({ zeitpunkt: '2026-11-08' }, T) === null && pruefeEingabe({ zeitpunkt: 'morgen' }, T) === null
    && pruefeEingabe({ zeitpunkt: '2027-02-31' }, T) === null && pruefeEingabe({ zeitpunkt: '2031-01-01' }, T) === null
    && pruefeEingabe({ grund: { a: 1 } }, T) === null && pruefeEingabe([], T) === null && pruefeEingabe(null, T) === null);
  const p1 = kuendigungsParameter({ art: 'ordentlich', grund: '', zeitpunkt: 'naechster', laeuftBis: BIS, eingang: 'E' });
  pruefe('Parameter: naechstmoeglich = cancel_at_period_end, Eingang und Art als Metadaten, kein Kommentar ohne Grund',
    p1.get('cancel_at_period_end') === 'true' && !p1.has('cancel_at') && p1.get(`metadata[${META_KUENDIGUNG}]`) === 'E'
    && p1.get(`metadata[${META_KUENDIGUNG_ART}]`) === 'ordentlich' && !p1.has('cancellation_details[comment]'), p1.toString());
  const frueh = kuendigungsParameter({ art: 'ordentlich', grund: '', zeitpunkt: BIS - 86400000, laeuftBis: BIS, eingang: 'E' });
  const spaet = kuendigungsParameter({ art: 'ausserordentlich', grund: 'Umzug', zeitpunkt: BIS + 20 * 86400000, laeuftBis: BIS, eingang: 'E' });
  pruefe('Parameter: ein Tag vor dem Ende des bezahlten Zeitraums = Laufzeitende (nie ein frueheres Ende ohne Erstattung); spaeter = cancel_at',
    frueh.get('cancel_at_period_end') === 'true' && !frueh.has('cancel_at')
    && spaet.get('cancel_at') === String(Math.floor((BIS + 20 * 86400000) / 1000)) && !spaet.has('cancel_at_period_end')
    && spaet.get('cancellation_details[comment]') === 'ausserordentlich: Umzug');
  // Codex-Befund #203: ausserordentlich zu einem frueheren Tag (auch bei schon vorgemerkter ordentlicher Kuendigung)
  const wunsch = kuendigungsParameter({ art: 'ausserordentlich', grund: 'Leistung fehlt', zeitpunkt: BIS - 5 * 86400000, tag: '2026-11-26', laeuftBis: BIS, eingang: 'E' });
  const wunschOhne = kuendigungsParameter({ art: 'ordentlich', grund: '', zeitpunkt: BIS - 5 * 86400000, tag: '2026-11-26', laeuftBis: BIS, eingang: 'E' });
  const wunschSpaet = kuendigungsParameter({ art: 'ordentlich', grund: '', zeitpunkt: BIS + 86400000, tag: '2026-12-02', laeuftBis: BIS, eingang: 'E' });
  pruefe('Parameter: Wunschtermin vor dem Laufzeitende steht in der Notiz an Stripe (Flo entscheidet), ein eingetragener cancel_at braucht keine Notiz',
    wunsch.get('cancellation_details[comment]') === 'ausserordentlich: Leistung fehlt; Wunschtermin 2026-11-26' && wunsch.get('cancel_at_period_end') === 'true'
    && wunschOhne.get('cancellation_details[comment]') === 'ordentlich; Wunschtermin 2026-11-26' && !wunschSpaet.has('cancellation_details[comment]'));
  pruefe('Parameter: nie eine sofortige Loeschung, nie eine Erstattung, nie ein anderes Feld', [p1, frueh, spaet].every((p) => [...p.keys()].every((k) =>
    ['cancel_at', 'cancel_at_period_end', `metadata[${META_KUENDIGUNG}]`, `metadata[${META_KUENDIGUNG_ART}]`, 'cancellation_details[comment]'].includes(k))));
}

// ---------------------------------------------------------------------------
// verarbeite(): der gute Weg
// ---------------------------------------------------------------------------
{
  const f = welt();
  const protokoll = [];
  const r = await verarbeite(anfrage({ art: 'ordentlich' }), UMG, { fetch: f, jetzt: T, protokoll: (z) => protokoll.push(z) });
  const d = json(r);
  const s = f.stripe();
  pruefe('ordentliche Kuendigung: 200 mit Vertrag, Art, Eingang (genaue Zeit) und Vertragsende', r.status === 200 && d.ok === true && d.vertrag === 'Crownmate Trainer'
    && d.art === 'ordentlich' && d.eingegangen_am === new Date(T).toISOString() && d.wirksam_zum === new Date(BIS).toISOString() && d.pruefung === false, d);
  pruefe('Wer: /auth/v1/user mit dem Token der Anmeldung und dem oeffentlichen Schluessel', f.aufrufe[0].url === 'https://probe.supabase.example/auth/v1/user'
    && f.aufrufe[0].headers.Authorization === 'Bearer ' + JWT && f.aufrufe[0].headers.apikey === 'sb_publishable_probe');
  pruefe('Welcher Vertrag: nur die eigene Zeile (user_id aus der Anmeldung), mit dem Dienst-Schluessel',
    f.aufrufe[1].url === `https://probe.supabase.example/rest/v1/abos?select=status,gueltig_bis,quelle,kunde_id,abo_id&user_id=eq.${UID}`
    && f.aufrufe[1].headers.apikey === 'sb_secret_probe');
  const koerper = new URLSearchParams(s[0].body);
  pruefe('Stripe: genau ein POST auf das eigene Abo, Kuendigung zum Laufzeitende, eingeschraenkter Schluessel, Idempotency-Key',
    s.length === 1 && s[0].url === 'https://api.stripe.com/v1/subscriptions/sub_Eigen1' && s[0].method === 'POST'
    && s[0].headers.Authorization === 'Bearer ' + RK && /^crownmate-kuendigung-[0-9a-f]{24}$/.test(s[0].headers['Idempotency-Key'])
    && koerper.get('cancel_at_period_end') === 'true' && koerper.get(`metadata[${META_KUENDIGUNG_ART}]`) === 'ordentlich'
    && koerper.get(`metadata[${META_KUENDIGUNG}]`) === new Date(Math.floor(T / 60000) * 60000).toISOString(), s[0]);
  pruefe('Antwort und Protokoll ohne Nutzer-ID, E-Mail, Schluessel, Kunden- oder Abo-Nummer', ![r.koerper, protokoll.join('|')].some((x) =>
    x.includes(UID) || x.includes('example.invalid') || x.includes(RK) || x.includes('cus_') || x.includes('sub_') || x.includes('sb_secret')), { k: r.koerper, protokoll });
  pruefe('CORS-Kopf fuer die App und kein Zwischenspeichern', r.kopf['Access-Control-Allow-Origin'] === '*' && r.kopf['Cache-Control'] === 'no-store');
  // Doppelklick in derselben Minute: derselbe Schluessel und dieselbe Anfrage -> bei Stripe eine Kuendigung
  const f2 = welt();
  await verarbeite(anfrage({ art: 'ordentlich' }), UMG, { fetch: f2, jetzt: T + 9000 });
  pruefe('Doppelklick (gleiche Minute): gleicher Idempotency-Key und gleicher Koerper', f2.stripe()[0].headers['Idempotency-Key'] === s[0].headers['Idempotency-Key']
    && f2.stripe()[0].body === s[0].body);
  const f3 = welt();
  await verarbeite(anfrage({ art: 'ausserordentlich', grund: 'x' }), UMG, { fetch: f3, jetzt: T });
  pruefe('andere Erklaerung: anderer Idempotency-Key', f3.stripe()[0].headers['Idempotency-Key'] !== s[0].headers['Idempotency-Key']);
}
{
  const spaeter = Date.UTC(2026, 11, 24, 23);
  const f = welt({ stripe: [{ status: 200, body: { id: 'sub_Eigen1', customer: 'cus_Eigen1', cancel_at: Math.floor(spaeter / 1000) } }] });
  const r = await verarbeite(anfrage({ art: 'ausserordentlich', grund: 'Umzug ins Ausland', zeitpunkt: '2026-12-24' }), UMG, { fetch: f, jetzt: T });
  const k = new URLSearchParams(f.stripe()[0].body);
  pruefe('ausserordentlich zu einem spaeteren Tag: cancel_at, Grund als Notiz, Antwort mit pruefung', r.status === 200 && json(r).pruefung === true
    && json(r).art === 'ausserordentlich' && json(r).wirksam_zum === new Date(spaeter).toISOString() && k.get('cancel_at') === String(Math.floor(spaeter / 1000))
    && k.get('cancellation_details[comment]') === 'ausserordentlich: Umzug ins Ausland' && !r.koerper.includes('Umzug'));
  // API ab 2025-03-31: Periodenende an den Positionen
  const f2 = welt({ stripe: [{ status: 200, body: { id: 'sub_Eigen1', customer: 'cus_Eigen1', cancel_at: null, items: { data: [{ current_period_end: Math.floor(BIS / 1000) + 60 }] } } }] });
  const r2 = await verarbeite(anfrage({}), UMG, { fetch: f2, jetzt: T });
  pruefe('Vertragsende aus den Positionen (neue API-Form), sonst aus der eigenen Zeile', json(r2).wirksam_zum === new Date(BIS + 60000).toISOString()
    && json(await verarbeite(anfrage({}), UMG, { fetch: welt({ stripe: [{ status: 200, body: {} }] }), jetzt: T })).wirksam_zum === new Date(BIS).toISOString());
}

{
  // Schon ordentlich gekuendigt (Zeile 'gekuendigt'), jetzt ausserordentlich zu einem frueheren Tag: geht durch
  const f = welt({ zeilen: [{ ...ZEILE, status: 'gekuendigt' }] });
  const r = await verarbeite(anfrage({ art: 'ausserordentlich', grund: 'Leistung fehlt', zeitpunkt: '2026-11-20' }), UMG, { fetch: f, jetzt: T });
  const k = new URLSearchParams(f.stripe()[0].body);
  pruefe('schon gekuendigt + ausserordentlich zu einem frueheren Tag: 200 mit pruefung, Wunschtermin und Grund bei Stripe', r.status === 200 && json(r).pruefung === true
    && json(r).art === 'ausserordentlich' && k.get(`metadata[${META_KUENDIGUNG_ART}]`) === 'ausserordentlich'
    && k.get('cancellation_details[comment]') === 'ausserordentlich: Leistung fehlt; Wunschtermin 2026-11-20', f.stripe()[0].body);
}

// ---------------------------------------------------------------------------
// Fremde Angaben in der Anfrage zaehlen nie
// ---------------------------------------------------------------------------
{
  const f = welt();
  const r = await verarbeite(anfrage({ art: 'ordentlich', user_id: FREMD, nutzer: FREMD, abo_id: 'sub_Fremd9', kunde_id: 'cus_Fremd9', subscription: 'sub_Fremd9' }), UMG, { fetch: f, jetzt: T });
  pruefe('Angriff: fremde Nutzer-ID, Abo- oder Kundennummer im Koerper werden ignoriert (gekuendigt wird nur das eigene Abo)', r.status === 200
    && f.stripe().length === 1 && f.stripe()[0].url.endsWith('/subscriptions/sub_Eigen1') && !f.aufrufe.some((a) => a.url.includes(FREMD) || a.url.includes('Fremd9')
      || String(a.body || '').includes('Fremd9') || String(a.body || '').includes(FREMD)));
  const ohne = welt({ zeilen: [] });
  const r2 = await verarbeite(anfrage({ abo_id: 'sub_Fremd9' }), UMG, { fetch: ohne, jetzt: T });
  pruefe('Konto ohne Zeile: 404 kein_vertrag, Stripe wird nie gefragt', r2.status === 404 && json(r2).fehler === 'kein_vertrag' && ohne.stripe().length === 0);
  const manuell = welt({ zeilen: [{ status: 'aktiv', gueltig_bis: new Date(BIS).toISOString(), quelle: 'manuell', kunde_id: null, abo_id: null }] });
  const r3 = await verarbeite(anfrage({}), UMG, { fetch: manuell, jetzt: T });
  const kaputt = welt({ zeilen: [{ ...ZEILE, abo_id: 'sub_x/../../customers' }] });
  const r4 = await verarbeite(anfrage({}), UMG, { fetch: kaputt, jetzt: T });
  pruefe('Handzeile ohne Stripe-Abo und kaputte Abo-Nummer: 404, Stripe wird nie gefragt', r3.status === 404 && manuell.stripe().length === 0
    && r4.status === 404 && kaputt.stripe().length === 0);
  const offen = welt({ zeilen: [{ ...ZEILE, status: 'abgelaufen', gueltig_bis: new Date(T - 86400000).toISOString() }] });
  const r5 = await verarbeite(anfrage({}), UMG, { fetch: offen, jetzt: T });
  pruefe('Abo mit offener Zahlung (hier "abgelaufen", bei Stripe noch da) laesst sich kuendigen', r5.status === 200 && offen.stripe().length === 1);
}

// ---------------------------------------------------------------------------
// Anmeldung, Eingabe, Konfiguration, Stripe-Fehler
// ---------------------------------------------------------------------------
{
  const f = welt();
  const ohne = await verarbeite(anfrage({}, { autorisierung: null }), UMG, { fetch: f, jetzt: T });
  const kurz = await verarbeite(anfrage({}, { autorisierung: 'Bearer kurz' }), UMG, { fetch: f, jetzt: T });
  pruefe('ohne oder mit kaputtem Token: 401, keine Anfrage nach aussen', ohne.status === 401 && kurz.status === 401 && json(ohne).fehler === 'anmeldung' && f.aufrufe.length === 0);
  const abgelaufen = welt({ authStatus: 401 });
  const r = await verarbeite(anfrage({}), UMG, { fetch: abgelaufen, jetzt: T });
  const ohneId = welt({ nutzer: { id: 'keine-uuid' } });
  const r2 = await verarbeite(anfrage({}), UMG, { fetch: ohneId, jetzt: T });
  pruefe('Supabase lehnt das Token ab oder liefert keine Nutzer-ID: 401, weder abos noch Stripe', r.status === 401 && r2.status === 401
    && abgelaufen.aufrufe.length === 1 && ohneId.aufrufe.length === 1);
  const weg = welt({ authStatus: 500 });
  const dbWeg = welt({ abosStatus: 500 });
  pruefe('Supabase gerade nicht erreichbar: 503 server, Stripe wird nie gefragt', (await verarbeite(anfrage({}), UMG, { fetch: weg, jetzt: T })).status === 503
    && (await verarbeite(anfrage({}), UMG, { fetch: dbWeg, jetzt: T })).status === 503 && weg.stripe().length === 0 && dbWeg.stripe().length === 0);
  const g = welt();
  const e1 = await verarbeite(anfrage('{kaputt'), UMG, { fetch: g, jetzt: T });
  const e2 = await verarbeite(anfrage({ art: 'sofort' }), UMG, { fetch: g, jetzt: T });
  const e3 = await verarbeite(anfrage({ zeitpunkt: '2020-01-01' }), UMG, { fetch: g, jetzt: T });
  const e4 = await verarbeite(anfrage('x'.repeat(MAX_KOERPER + 1)), UMG, { fetch: g, jetzt: T });
  pruefe('kaputte Eingabe: 400 (zu gross: 413), keine Anfrage nach aussen', e1.status === 400 && e2.status === 400 && e3.status === 400 && e4.status === 413
    && json(e2).fehler === 'eingabe' && g.aufrufe.length === 0);
  const m1 = await verarbeite({ methode: 'GET' }, UMG, { fetch: g, jetzt: T });
  const m2 = await verarbeite({ methode: 'OPTIONS' }, UMG, { fetch: g, jetzt: T });
  pruefe('GET: 405, OPTIONS: 204 mit CORS-Kopf', m1.status === 405 && m2.status === 204 && m2.koerper === '' && /POST/.test(m2.kopf['Access-Control-Allow-Methods']));
  const k1 = await verarbeite(anfrage({}), { ...UMG, ABO_STRIPE_RK: '' }, { fetch: g, jetzt: T });
  const k2 = await verarbeite(anfrage({}), { ...UMG, ABO_STRIPE_RK: 'sk_test_' + 'Voll'.repeat(5) }, { fetch: g, jetzt: T });
  const k3 = await verarbeite(anfrage({}), { ...UMG, SUPABASE_SERVICE_ROLE_KEY: '' }, { fetch: g, jetzt: T });
  pruefe('nicht eingerichtet (kein Schluessel, voller Secret Key statt eingeschraenktem, kein Dienst-Schluessel): 503 nicht_eingerichtet, nichts geht raus',
    [k1, k2, k3].every((x) => x.status === 503 && json(x).fehler === 'nicht_eingerichtet') && g.aufrufe.length === 0);
}
{
  const unklar = welt({ stripe: [{ status: 500, body: {} }, { wirft: true }] });
  const r = await verarbeite(anfrage({}), UMG, { fetch: unklar, jetzt: T });
  pruefe('Stripe antwortet nicht sicher: einmal wiederholen (gleicher Schluessel), dann 503 stripe (nie "eingegangen" ohne Antwort)', r.status === 503
    && json(r).fehler === 'stripe' && unklar.stripe().length === 2 && unklar.stripe()[0].headers['Idempotency-Key'] === unklar.stripe()[1].headers['Idempotency-Key']
    && json(r).ok === undefined);
  const zweiter = welt({ stripe: [{ status: 429, body: {} }] });
  pruefe('Stripe erst 429, dann ok: 200', (await verarbeite(anfrage({}), UMG, { fetch: zweiter, jetzt: T })).status === 200 && zweiter.stripe().length === 2);
  const fehlt = welt({ stripe: [{ status: 404, body: { error: { code: 'resource_missing', type: 'invalid_request_error' } } }] });
  const r2 = await verarbeite(anfrage({}), UMG, { fetch: fehlt, jetzt: T });
  pruefe('Stripe kennt das Abo nicht mehr: 404 kein_vertrag', r2.status === 404 && json(r2).fehler === 'kein_vertrag' && fehlt.stripe().length === 1);
  const recht = welt({ stripe: [{ status: 403, body: { error: { type: 'invalid_request_error' } } }] });
  const r3 = await verarbeite(anfrage({}), UMG, { fetch: recht, jetzt: T });
  pruefe('Schluessel ohne das Recht "Abonnements: Schreiben": 503 nicht_eingerichtet (die App bietet dann das Kundenportal an)', r3.status === 503 && json(r3).fehler === 'nicht_eingerichtet');
  const abgelehnt = welt({ stripe: [{ status: 400, body: { error: { code: 'parameter_invalid', type: 'invalid_request_error' } } }] });
  pruefe('Stripe lehnt ab: 502 stripe', (await verarbeite(anfrage({}), UMG, { fetch: abgelehnt, jetzt: T })).status === 502);
  const protokoll = [];
  const fremderKunde = welt({ stripe: [{ status: 200, body: { id: 'sub_Eigen1', customer: 'cus_Anderer', cancel_at: Math.floor(BIS / 1000) } }] });
  await verarbeite(anfrage({}), UMG, { fetch: fremderKunde, jetzt: T, protokoll: (z) => protokoll.push(z) });
  pruefe('Abo gehoert bei Stripe einem anderen Kunden als in der Zeile: Kennung im Protokoll (ohne Nummern)', protokoll.includes('abo-kuendigen kunde_weicht_ab')
    && !protokoll.join('|').includes('cus_'));
}

// ---------------------------------------------------------------------------
// Huelle und Vertrag mit der App
// ---------------------------------------------------------------------------
{
  const ts = lies('supabase/functions/abo-kuendigen/index.ts');
  pruefe('index.ts: nur die Huelle (verarbeite aus _gemeinsam, Authorization-Kopf, Secrets aus Deno.env), mit JWT-Pruefung',
    /import \{ verarbeite \} from '\.\.\/_gemeinsam\/abo-kuendigen\.js';/.test(ts) && /headers\.get\('authorization'\)/.test(ts)
    && ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'ABO_STRIPE_RK'].every((k) => ts.includes(`Deno.env.get('${k}')`))
    && (ts.match(/^import /gm) || []).length === 1 && ts.split('\n').length < 40 && /kein --no-verify-jwt/.test(ts));
  const app = lies('js/abo.js');
  pruefe('App: kuendigen() ruft genau diese Function und schickt nur art, grund, zeitpunkt (keine Nutzer-ID)', app.includes("KUENDIGEN_PFAD = '/functions/v1/abo-kuendigen'")
    && /body: JSON\.stringify\(\{ art, grund: String\(grund \|\| ''\)\.slice\(0, 500\), zeitpunkt \}\)/.test(app));
  const blatt = lies('js/pakete/abo/kuendigen.js') + lies('supabase/functions/_gemeinsam/abo-kuendigen.js');
  pruefe('Dateien nennen die offene Rechtspruefung', (blatt.match(/RECHTLICH UNGEPRUEFT/g) || []).length === 2);
}

console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
