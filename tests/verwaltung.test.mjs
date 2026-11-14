// Client der Verwaltung (G-006 M3): js/verwaltung.js und die Ansichten aus js/pakete/verwaltung/index.js, ohne Browser,
// mit gefaelschtem fetch (die echte Supabase wird nie gerufen). Prueft: ohne Anmeldung keine Anfrage, istVerwalter ist
// still false bei fehlendem Recht, fehlender SQL (404), Serverfehler und offline; Aufrufe gehen als POST mit Bearer an
// die richtigen Funktionen; jede Serverkennung wird ein ganzer Satz (de und en); die Ansichten maskieren Fremdtext und
// zeigen bei einem laufenden Stripe-Abo keine Premium-Knoepfe.
//   node tests/verwaltung.test.mjs
import { readFileSync } from 'node:fs';
import { setzeSpeicher } from '../js/storage.js';
import { SITZUNG_SCHLUESSEL } from '../js/konto.js';
import { setzeSprache } from '../js/sprache.js';
import {
  istVerwalter, konten, kaeufe, setzePremium, setzeName, setzeBanner, protokoll, setzeVerwaltungFetch, fehlerAus, KENNUNGEN,
} from '../js/verwaltung.js';
import { DE, EN } from '../js/pakete/verwaltung/texte.js';

let ok = 0;
let gesamt = 0;
function pruefe(name, bedingung, info) {
  gesamt++;
  if (bedingung) { ok++; console.log('ok     ' + name); } else console.log('FEHLER ' + name + (info !== undefined ? '  -> ' + JSON.stringify(info) : ''));
}

const m = new Map();
globalThis.localStorage = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k),
  key: (i) => [...m.keys()][i] ?? null, get length() { return m.size; } };
Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'Test' }, configurable: true });
setzeSpeicher(globalThis.localStorage);

const UID = 'f1000000-0000-4000-8000-0000000000f1';
const token = (sub) => 'a.' + Buffer.from(JSON.stringify({ sub })).toString('base64url') + '.x';
const SITZUNG = { access_token: token(UID), refresh_token: 'r1', expires_at: 9999999999, user: { id: UID, email: 'f@x' }, email: 'f@x' };

const server = { antwort: true, status: 200, offline: false, fehler: null };
const aufrufe = [];
setzeVerwaltungFetch(async (url, opt) => {
  aufrufe.push({ url, ...opt, daten: opt.body ? JSON.parse(opt.body) : null });
  if (server.offline) throw new Error('offline');
  return { ok: server.status < 400, status: server.status, async json() { return server.status < 400 ? server.antwort : server.fehler; } };
});

// ---------- istVerwalter ----------
pruefe('ohne Anmeldung: false, keine Anfrage', (await istVerwalter()) === false && aufrufe.length === 0);
localStorage.setItem(SITZUNG_SCHLUESSEL, JSON.stringify(SITZUNG));
pruefe('Verwalter: true', (await istVerwalter()) === true);
const a0 = aufrufe[0];
pruefe('ist_verwalter als POST mit Bearer und apikey', a0?.url.endsWith('/rest/v1/rpc/ist_verwalter') && a0.method === 'POST'
  && a0.headers.Authorization === 'Bearer ' + SITZUNG.access_token && !!a0.headers.apikey, a0);
aufrufe.length = 0;
pruefe('gemerkt: zweiter Aufruf ohne Netz', (await istVerwalter()) === true && aufrufe.length === 0);
server.antwort = false;
pruefe('kein Recht: false', (await istVerwalter({ neu: true })) === false);
server.status = 404; server.fehler = { code: 'PGRST202', message: 'Could not find the function public.ist_verwalter' };
pruefe('SQL fehlt (404): still false', (await istVerwalter({ neu: true })) === false);
server.status = 500; server.fehler = { message: 'kaputt' };
pruefe('Serverfehler: still false', (await istVerwalter({ neu: true })) === false);
server.status = 200; server.offline = true;
pruefe('offline: still false', (await istVerwalter({ neu: true })) === false);
server.offline = false; server.antwort = true;
localStorage.setItem(SITZUNG_SCHLUESSEL, JSON.stringify({ ...SITZUNG, user: { id: 'b2000000-0000-4000-8000-0000000000b2' } }));
aufrufe.length = 0;
await istVerwalter();
pruefe('anderes Konto fragt neu', aufrufe.length === 1);
localStorage.setItem(SITZUNG_SCHLUESSEL, JSON.stringify(SITZUNG));

// ---------- Aufrufe ----------
aufrufe.length = 0;
server.antwort = [{ user_id: UID }];
pruefe('konten: Liste', (await konten({ suche: '  anna ', grenze: 20 })).length === 1);
pruefe('konten: Suche getrimmt, Grenze mit', aufrufe[0].url.endsWith('/rpc/verwaltung_konten') && aufrufe[0].daten.suche === 'anna'
  && aufrufe[0].daten.grenze === 20, aufrufe[0].daten);
await konten();
pruefe('konten: leere Suche geht als null', aufrufe[1].daten.suche === null, aufrufe[1].daten);
server.antwort = null;
pruefe('konten: keine Liste wird leere Liste', Array.isArray(await konten()) && (await konten()).length === 0);
aufrufe.length = 0;
server.antwort = { geaendert: true };
await kaeufe(UID);
await setzePremium(UID, new Date(Date.UTC(2027, 0, 2)));
await setzePremium(UID, null);
await setzeName(UID, ' Neu_1 ');
await setzeBanner(UID, 'saison-gold', 1);
server.antwort = [];
await protokoll();
const n = aufrufe.map((x) => x.url.split('/rpc/')[1]);
pruefe('richtige Funktionen', JSON.stringify(n) === JSON.stringify(['verwaltung_kaeufe', 'verwaltung_premium', 'verwaltung_premium',
  'verwaltung_name', 'verwaltung_banner', 'verwaltung_protokoll_lesen']), n);
pruefe('Premium bis als ISO-Datum', aufrufe[1].daten.bis === '2027-01-02T00:00:00.000Z' && aufrufe[1].daten.ziel === UID, aufrufe[1].daten);
pruefe('Premium zuruecknehmen schickt bis = null', aufrufe[2].daten.bis === null && 'bis' in aufrufe[2].daten, aufrufe[2].daten);
pruefe('Name getrimmt', aufrufe[3].daten.neu === 'Neu_1', aufrufe[3].daten);
pruefe('Banner mit an als boolean', aufrufe[4].daten.banner === 'saison-gold' && aufrufe[4].daten.an === true, aufrufe[4].daten);

// ---------- Fehler ----------
server.status = 400;
for (const k of KENNUNGEN) {
  server.fehler = { code: 'P0001', message: k };
  let e = null;
  try { await setzeName(UID, 'x'); } catch (f) { e = f; }
  pruefe(`Kennung ${k} wird ein ganzer Satz`, e && e.kennung === k && e.message === DE['f.' + k] && !e.message.includes('VERWALTUNG_'), e?.message);
}
server.status = 404; server.fehler = { code: 'PGRST202', message: 'Could not find the function' };
{
  let e = null;
  try { await konten(); } catch (f) { e = f; }
  pruefe('404: Satz "nicht eingerichtet", Rohtext in detail', e?.message === DE['f.einrichtung'] && e.detail.includes('Could not'), e?.message);
}
server.status = 200; server.offline = true;
{
  let e = null;
  try { await konten(); } catch (f) { e = f; }
  pruefe('offline: eigener Satz', e?.offline === true && e.message === DE['f.offline'], e?.message);
}
server.offline = false;
pruefe('500: allgemeiner Satz mit Status', fehlerAus({ message: 'x' }, 500).message === 'Das hat nicht geklappt (Fehler 500).');
setzeSprache('en');
pruefe('englisch: Kennung als englischer Satz', fehlerAus({ message: 'VERWALTUNG_STRIPE_ABO' }, 400).message === EN['f.VERWALTUNG_STRIPE_ABO']);
setzeSprache('de');
pruefe('jede Kennung hat de und en', KENNUNGEN.every((k) => DE['f.' + k] && EN['f.' + k]));
pruefe('de und en haben dieselben Schluessel', JSON.stringify(Object.keys(DE).sort()) === JSON.stringify(Object.keys(EN).sort()));
const sql = readFileSync(new URL('../supabase/verwaltung-schema.sql', import.meta.url), 'utf8');
const serverKennungen = [...new Set(sql.match(/VERWALTUNG_[A-Z_]+/g))].sort();
pruefe('Client kennt genau die Kennungen der SQL', JSON.stringify(serverKennungen) === JSON.stringify([...KENNUNGEN].sort()), serverKennungen);

// ---------- Ansichten ----------
let ansicht = null;
try { ansicht = await import('../js/pakete/verwaltung/index.js'); } catch (e) { console.log('Hinweis: Paket ohne DOM nicht ladbar: ' + e.message); }
pruefe('Paket laedt ohne Browser', !!ansicht);
if (ansicht) {
  const boese = { user_id: UID, email: '<img src=x onerror=alert(1)>@x', benutzername: '<b>x</b>', angelegt: '2026-11-01T10:00:00Z',
    zuletzt: null, anbieter: 'email', premium: false, kaeufe: 0 };
  const zeile = ansicht.kontoZeile(boese);
  pruefe('Kontozeile maskiert Fremdtext', !zeile.includes('<img') && zeile.includes('&lt;img') && !zeile.includes('<b>x'), zeile);
  pruefe('Kontozeile: nie angemeldet', zeile.includes(DE.nie));
  const mahn = ansicht.kontoAnsicht(boese, { premium: false, abo: { quelle: 'stripe', status: 'abgelaufen', stripe_gebunden: true },
    editionen: [], sonderstuecke: [], banner: [] });
  pruefe('Stripe in der Mahnphase (kein Premium): trotzdem keine Premium-Knoepfe', !mahn.includes('data-vw="premium"')
    && mahn.includes(DE['k.stripe']), mahn);
  const stripe = ansicht.kontoAnsicht(boese, { premium: true, abo: { quelle: 'stripe', gueltig_bis: '2027-01-01T00:00:00Z', stripe_gebunden: true },
    editionen: [{ name: '<i>Ed</i>', nummer: 3, status: 'aktiv', erworben_am: '2026-11-02T00:00:00Z' }], sonderstuecke: [], banner: [] });
  pruefe('Stripe-Abo: keine Premium-Knoepfe, Hinweis', !stripe.includes('data-vw="premium"') && !stripe.includes('premium-weg')
    && stripe.includes(DE['k.stripe']), stripe);
  pruefe('Edition maskiert', stripe.includes('&lt;i&gt;Ed') && !stripe.includes('<i>Ed'));
  const manuell = ansicht.kontoAnsicht(boese, { premium: true, abo: { quelle: 'manuell', gueltig_bis: '2027-01-01T00:00:00Z' },
    editionen: [], sonderstuecke: [], banner: [{ banner: 'saison-holz', quelle: 'liga' }, { banner: 'saison-gold', quelle: 'verwaltung' }] });
  pruefe('manuell: freischalten und zuruecknehmen', manuell.includes('data-tage="30"') && manuell.includes('premium-weg'));
  pruefe('verdientes Banner gesperrt, vergebenes an', /data-banner="saison-holz" aria-pressed="true" disabled/.test(manuell)
    && /data-banner="saison-gold" aria-pressed="true">/.test(manuell), manuell.match(/data-banner="saison-(holz|gold)"[^>]*>/g));
  pruefe('Start-Banner nicht vergebbar', !ansicht.VERGEBBAR.includes('start') && ansicht.VERGEBBAR.includes('erfolg-turmbezwinger'));
  const ohne = ansicht.kontoAnsicht(boese, { premium: false, abo: null, editionen: [], sonderstuecke: [], banner: [] });
  pruefe('ohne Premium: kein Zuruecknehmen', ohne.includes('data-tage="365"') && !ohne.includes('premium-weg') && ohne.includes(DE['k.keineKaeufe']));
  const prot = ansicht.protokollAnsicht([{ am: '2026-11-13T10:00:00Z', was: 'name', nachher: { benutzername: '<s>' } }]);
  pruefe('Protokoll maskiert', prot.includes(DE['p.name']) && !prot.includes('<s>'), prot);
  pruefe('Gruppe ohne Browser: null', ansicht.verwaltungGruppe() === null);
}

console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
