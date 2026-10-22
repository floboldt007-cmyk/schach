// Client des Abos "Crownmate Trainer" (Welle B1): js/abo.js und das Paket js/pakete/abo/. Node-Teil mit gefaelschtem
// fetch (Premium-Stand, Zwischenspeicher, offline, Produkt, Kauf-Adresse, Verwalten), danach Browser-Teil gegen die echte
// App (index.html?test) mit einem gefaelschten Supabase-Server ueber page.route: Gruppe in den Einstellungen, Blatt in
// allen Zustaenden, Kauf und Rueckkehr, premiumHinweis, Fairness der sichtbaren Texte. Stripe wird nie aufgerufen
// (window.open ist im Test ersetzt), die echte Supabase auch nicht.
//
//   node tests/abo.test.mjs              alles
//   node tests/abo.test.mjs --nur-node   ohne Browser
//   PORT=9800 BILDER=<ordner> node tests/abo.test.mjs   eigener Port (Standard 8873), Bildschirmfotos in <ordner>
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { setzeSpeicher } from '../js/storage.js';
import { setzeKontoFetch, SITZUNG_SCHLUESSEL, lokalerStand } from '../js/konto.js';
import {
  istPremium, premiumStand, ladeProdukt, kaufAdresse, kaufen, verwalten, vergiss, premiumHinweis, setzeAboFetch, setzeAboUhr,
  kaufGestartet, pruefeProdukt, inStoreHuelle, PRODUKT_ID, STAND_SCHLUESSEL, PRODUKT_SCHLUESSEL, KAUF_SCHLUESSEL, PRUEF_MS, PRODUKT_MS,
} from '../js/abo.js';
import { COUNTDOWN_RE } from '../js/inhalte.js';
import { PAKETE } from '../js/erweiterungen.js';
import { browserTyp } from './browser.mjs';

const require = createRequire(import.meta.url);
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8873);
const BASIS = `http://127.0.0.1:${PORT}/index.html?test`;
const NUR_NODE = process.argv.includes('--nur-node');
const BILDER = process.env.BILDER ? path.join(process.env.BILDER, 'abo') : '';
if (BILDER) mkdirSync(BILDER, { recursive: true });
const SUPA = 'https://usaamcqypmvgqmsbfecb.supabase.co';
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

let ok = 0;
let gesamt = 0;
let gruppe = '';
function pruefe(name, bedingung, info) {
  gesamt++;
  const n = (gruppe ? gruppe + ': ' : '') + name;
  if (bedingung) { ok++; console.log('ok     ' + n); } else console.log('FEHLER ' + n + (info !== undefined ? '  -> ' + JSON.stringify(info) : ''));
}

const UID = '0f8b6c1e-2d3a-4b5c-8d9e-0a1b2c3d4e5f';
const MAIL = 'flo.probe@example.invalid';
const token = (sub) => 'a.' + Buffer.from(JSON.stringify({ sub })).toString('base64url') + '.x';
const SITZUNG = { access_token: token(UID), refresh_token: 'r1', expires_at: 9999999999, user: { id: UID, email: MAIL }, email: MAIL };
const PRODUKT = { id: 'trainer', name: 'Crownmate Trainer', beschreibung: null, preis_text: 'Probe-Preistext je Monat',
  kauf_link: 'https://buy.stripe.example/probe-link?locale=de', portal_link: 'https://billing.stripe.example/p/login/probe' };
// Texte, die auf einer Abo-Seite nie stehen duerfen (Auszug aus tests/fairness.test.mjs plus Kauf-Druck)
const DRUCK = ['nur heute', 'nur noch', 'letzte Chance', 'limitiert', 'endet in', 'läuft ab', 'verfällt', 'verpasst', 'sparen', 'Rabatt',
  'Angebot endet', 'jetzt zuschlagen', 'Wir vermissen dich'];

// =====================================================================
// Node-Teil
// =====================================================================
async function nodeTeil() {
  gruppe = 'Node';
  const m = new Map();
  globalThis.localStorage = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k),
    key: (i) => [...m.keys()][i] ?? null, get length() { return m.size; } };
  Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'Test' }, configurable: true });
  setzeSpeicher(globalThis.localStorage);
  let jetzt = Date.UTC(2026, 9, 22, 12);
  setzeAboUhr(() => jetzt);
  const server = { premium: true, abo: [{ status: 'aktiv', plan: 'monat', gueltig_bis: new Date(jetzt + 30 * 86400000).toISOString(), quelle: 'stripe' }],
    produkt: [PRODUKT], offline: false, status: 200 };
  const aufrufe = [];
  setzeAboFetch(async (url, opt) => {
    aufrufe.push({ url, ...opt });
    if (server.offline) throw new Error('offline');
    await warte(1);
    const body = url.includes('/rpc/ist_premium') ? server.premium : url.includes('/abos?') ? server.abo : url.includes('/produkte?') ? server.produkt : null;
    return { ok: server.status < 400, status: server.status, async json() { return server.status < 400 ? body : { message: 'kaputt' }; } };
  });

  pruefe('nicht angemeldet: kein Premium, keine Anfrage', (await istPremium()) === false && aufrufe.length === 0 && premiumStand().angemeldet === false
    && premiumStand().premium === false);

  localStorage.setItem(SITZUNG_SCHLUESSEL, JSON.stringify(SITZUNG));
  pruefe('angemeldet: Premium vom Server', (await istPremium()) === true && aufrufe.length === 2);
  const rpc = aufrufe.find((a) => a.url.endsWith('/rest/v1/rpc/ist_premium'));
  const zeile = aufrufe.find((a) => a.url.includes('/rest/v1/abos?select=status,plan,gueltig_bis,quelle'));
  pruefe('Abgleich: rpc ist_premium (POST) und eigene Zeile aus abos, beide mit Bearer und apikey', rpc && rpc.method === 'POST' && rpc.body === '{}'
    && rpc.headers.Authorization === 'Bearer ' + SITZUNG.access_token && zeile && zeile.method === 'GET' && zeile.headers.Authorization === rpc.headers.Authorization
    && !!rpc.headers.apikey && rpc.url.startsWith(SUPA));
  const st = premiumStand();
  pruefe('premiumStand: synchron mit Status, Plan, gueltigBis', st.premium && st.status === 'aktiv' && st.plan === 'monat' && st.quelle === 'stripe'
    && st.gueltigBis === jetzt + 30 * 86400000 && st.geprueftAm === jetzt, st);
  pruefe('Stand liegt ausserhalb von schach-arena:v1: (nicht in Cloud-Sicherung und Export)', !!localStorage.getItem(STAND_SCHLUESSEL)
    && !STAND_SCHLUESSEL.startsWith('schach-arena:v1:') && !Object.keys(lokalerStand()).some((k) => k.includes('abo')));

  aufrufe.length = 0;
  pruefe('Zwischenspeicher: zweiter Aufruf ohne Netz', (await istPremium()) === true && aufrufe.length === 0);
  jetzt += PRUEF_MS + 1000;
  pruefe('nach PRUEF_MS (10 min) neuer Abgleich', (await istPremium()) === true && aufrufe.length === 2 && PRUEF_MS === 600000);
  aufrufe.length = 0;
  const [a, b] = await Promise.all([istPremium({ neu: true }), istPremium({ neu: true })]);
  pruefe('gleichzeitige Abfragen laufen zusammen (ein Abgleich)', a && b && aufrufe.length === 2);

  server.offline = true;
  pruefe('offline: letzter Stand gilt bis gueltig_bis', (await istPremium({ neu: true })) === true);
  jetzt += 31 * 86400000;
  pruefe('offline nach gueltig_bis: kein Premium mehr', (await istPremium({ neu: true })) === false && premiumStand().premium === false);
  jetzt -= 31 * 86400000;
  server.offline = false;
  server.status = 500;
  pruefe('Serverfehler: letzter Stand bleibt', (await istPremium({ neu: true })) === true);
  server.status = 200;
  server.premium = false;
  server.abo = [{ status: 'abgelaufen', plan: 'monat', gueltig_bis: new Date(jetzt - 1000).toISOString(), quelle: 'stripe' }];
  pruefe('Server sagt nein: kein Premium, Stand gemerkt', (await istPremium({ neu: true })) === false && premiumStand().status === 'abgelaufen');
  server.premium = true;
  server.abo = [{ status: 'gekuendigt', plan: 'jahr', gueltig_bis: new Date(jetzt + 5 * 86400000).toISOString(), quelle: 'stripe' }];
  pruefe('gekuendigt mit Datum in der Zukunft: Premium', (await istPremium({ neu: true })) === true && premiumStand().status === 'gekuendigt');
  server.premium = true;
  server.abo = [];
  pruefe('Server sagt ja, aber keine Zeile: offline zaehlt das nicht (kein Datum, kein Vorschuss)', (await istPremium({ neu: true })) === false);

  // andere Person auf demselben Geraet
  localStorage.setItem(STAND_SCHLUESSEL, JSON.stringify({ uid: 'anders', premium: true, gueltigBis: jetzt + 1e9, geprueftAm: jetzt }));
  server.offline = true;
  pruefe('Stand einer anderen Person wird nie benutzt', premiumStand().premium === false && (await istPremium()) === false);
  server.offline = false;

  // abgelaufene Sitzung wird ueber js/konto.js erneuert
  const kontoAufrufe = [];
  setzeKontoFetch(async (url, opt) => {
    kontoAufrufe.push({ url, ...opt });
    return { ok: true, status: 200, async json() { return { ...SITZUNG, access_token: token(UID) + 'neu', refresh_token: 'r2', expires_at: 9999999999 }; } };
  });
  localStorage.setItem(SITZUNG_SCHLUESSEL, JSON.stringify({ ...SITZUNG, expires_at: 1 }));
  server.premium = true;
  server.abo = [{ status: 'aktiv', plan: 'monat', gueltig_bis: new Date(jetzt + 86400000).toISOString(), quelle: 'manuell' }];
  aufrufe.length = 0;
  const erneuert = await istPremium({ neu: true });
  pruefe('abgelaufene Sitzung: erst erneuern, dann mit neuem Token fragen', erneuert && kontoAufrufe.some((k) => k.url.includes('grant_type=refresh_token'))
    && aufrufe.every((x) => x.headers.Authorization === 'Bearer ' + token(UID) + 'neu'));
  setzeKontoFetch(null);
  localStorage.setItem(SITZUNG_SCHLUESSEL, JSON.stringify(SITZUNG));

  // ---------- Produkt ----------
  aufrufe.length = 0;
  const p = await ladeProdukt({ neu: true });
  const pa = aufrufe[0];
  pruefe('Produkt: oeffentlich (nur apikey, auch angemeldet), nur aktive Zeile "trainer"', pa && !pa.headers.Authorization && !!pa.headers.apikey
    && pa.url.includes('/rest/v1/produkte?select=id,name,beschreibung,preis_text,kauf_link,portal_link') && pa.url.includes('id=eq.trainer')
    && pa.url.includes('aktiv=eq.true') && PRODUKT_ID === 'trainer', pa && pa.url);
  pruefe('Produkt: Felder uebernommen', p && p.preisText === PRODUKT.preis_text && p.kaufLink === PRODUKT.kauf_link && p.portalLink === PRODUKT.portal_link
    && p.name === 'Crownmate Trainer' && p.beschreibung === null);
  aufrufe.length = 0;
  pruefe('Produkt: Zwischenspeicher (PRODUKT_MS 1 h)', (await ladeProdukt()).kaufLink === PRODUKT.kauf_link && aufrufe.length === 0 && PRODUKT_MS === 3600000
    && !!localStorage.getItem(PRODUKT_SCHLUESSEL));
  server.offline = true;
  pruefe('Produkt offline: letzter Stand', (await ladeProdukt({ neu: true })).preisText === PRODUKT.preis_text);
  server.offline = false;
  pruefe('Produkt: nur https-Links (javascript:, http:, Leerzeichen -> null)', pruefeProdukt({ ...PRODUKT, kauf_link: 'javascript:alert(1)' }).kaufLink === null
    && pruefeProdukt({ ...PRODUKT, kauf_link: 'http://buy.example/x' }).kaufLink === null && pruefeProdukt({ ...PRODUKT, portal_link: 'https://a b' }).portalLink === null
    && pruefeProdukt({ ...PRODUKT, kauf_link: 'https://x.example/"onmouseover' }).kaufLink === null && pruefeProdukt(null) === null);
  server.produkt = [];
  pruefe('kein aktives Produkt: null (Blatt zeigt "Preis folgt")', (await ladeProdukt({ neu: true })) === null);
  server.produkt = [PRODUKT];
  await ladeProdukt({ neu: true });

  // ---------- Kauf und Verwaltung ----------
  const url = new URL(kaufAdresse(p, SITZUNG));
  pruefe('Kauf-Adresse: kauf_link + client_reference_id (Nutzer-ID) + prefilled_email, vorhandene Parameter bleiben',
    url.origin + url.pathname === 'https://buy.stripe.example/probe-link' && url.searchParams.get('client_reference_id') === UID
    && url.searchParams.get('prefilled_email') === MAIL && url.searchParams.get('locale') === 'de', url.toString());
  pruefe('Kauf-Adresse: ohne Anmeldung oder ohne Link keine Adresse', kaufAdresse(p, null) === null && kaufAdresse({ ...p, kaufLink: null }, SITZUNG) === null);
  let geoeffnet = [];
  const oeffne = (u) => geoeffnet.push(u);
  localStorage.removeItem(SITZUNG_SCHLUESSEL);
  pruefe('kaufen ohne Anmeldung: nichts geoeffnet', (await kaufen({ produkt: p, oeffne })).grund === 'abgemeldet' && geoeffnet.length === 0 && kaufGestartet() === null);
  localStorage.setItem(SITZUNG_SCHLUESSEL, JSON.stringify(SITZUNG));
  const versprechen = kaufen({ produkt: p, oeffne });
  const sofort = geoeffnet.length;
  const k = await versprechen;
  pruefe('kaufen mit geladenem Produkt: Fenster sofort im Klick (ohne await), Kauf gemerkt', sofort === 1 && k.ok && geoeffnet[0] === k.url
    && k.url.includes('client_reference_id=' + UID) && kaufGestartet() === jetzt && localStorage.getItem(KAUF_SCHLUESSEL) === String(jetzt));
  geoeffnet = [];
  pruefe('kaufen ohne Produkt bzw. ohne Link: klare Gruende', (await kaufen({ produkt: null, oeffne })).grund === 'kein_produkt'
    && (await kaufen({ produkt: { ...p, kaufLink: null }, oeffne })).grund === 'kein_link' && geoeffnet.length === 0);
  const v = await verwalten({ produkt: p, oeffne });
  pruefe('verwalten: Kundenportal mit prefilled_email', v.ok && geoeffnet[0] === 'https://billing.stripe.example/p/login/probe?prefilled_email=' + encodeURIComponent(MAIL));
  pruefe('verwalten ohne Portal-Link: kein_link', (await verwalten({ produkt: { ...p, portalLink: null }, oeffne })).grund === 'kein_link');
  globalThis.Capacitor = { isNativePlatform: () => true };
  geoeffnet = [];
  pruefe('App-Store-Huelle (Capacitor): kein Kauf und kein Portal ueber Stripe', inStoreHuelle() && (await kaufen({ produkt: p, oeffne })).grund === 'store'
    && (await verwalten({ produkt: p, oeffne })).grund === 'store' && geoeffnet.length === 0);
  globalThis.Capacitor = { isNativePlatform: () => false };
  pruefe('Capacitor im Browser (nicht nativ): normal', !inStoreHuelle());
  delete globalThis.Capacitor;
  pruefe('premiumHinweis ohne DOM (Node): null', premiumHinweis(null, 'x') === null);
  pruefe('Paket steht in PAKETE (js/erweiterungen.js)', PAKETE.includes('pakete/abo/index'));
  vergiss();
  pruefe('vergiss: Stand, Produkt und Kauf-Merker weg', !localStorage.getItem(STAND_SCHLUESSEL) && !localStorage.getItem(PRODUKT_SCHLUESSEL) && kaufGestartet() === null);
  setzeAboFetch(null);
  setzeAboUhr(null);
}

// =====================================================================
// Browser-Teil
// =====================================================================
function ladePlaywright() {
  for (const k of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
    try { return require(k); } catch (e) { /* naechster */ }
  }
  throw new Error('Playwright nicht gefunden (PLAYWRIGHT_PFAD setzen)');
}
async function warteAufServer(url, ms = 10000) {
  const ende = Date.now() + ms;
  while (Date.now() < ende) {
    try { const r = await fetch(url); if (r.ok) return; } catch (e) { /* noch nicht da */ }
    await warte(150);
  }
  throw new Error('Server startet nicht: ' + url);
}

const fremd = [];
// Neue Seite mit gefaelschtem Supabase. server: { premium, abo, produkt, offline } (im Test aenderbar)
async function neueSeite(browser, { w = 1180, h = 820, schema = 'light', bewegung = 'no-preference', handy = false, konto = true, sitzung = null,
  server = {}, vorher = {} } = {}) {
  const kontext = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: schema, reducedMotion: bewegung, deviceScaleFactor: 1,
    hasTouch: true, isMobile: handy });
  const seite = await kontext.newPage();
  const fehler = [];
  const anfragen = [];
  const srv = { premium: false, abo: [], produkt: [], offline: false, ...server };
  seite.on('pageerror', (e) => fehler.push('pageerror: ' + e.message));
  seite.on('console', (m) => { if (m.type() === 'error' && !/404|Failed to fetch dynamically imported module|ERR_FAILED|net::/.test(m.text())) fehler.push('console: ' + m.text()); });
  seite.on('request', (r) => {
    const u = r.url();
    if (u.startsWith(`http://127.0.0.1:${PORT}/`) || /^(data|blob):/.test(u)) return;
    if (u.startsWith(SUPA + '/')) return;
    fremd.push(u);
  });
  await seite.route(SUPA + '/**', async (r) => {
    const u = r.request().url();
    anfragen.push({ url: u, methode: r.request().method(), kopf: r.request().headers() });
    if (srv.offline) return r.abort('internetdisconnected');
    const body = u.includes('/rpc/ist_premium') ? srv.premium : u.includes('/rest/v1/abos?') ? srv.abo : u.includes('/rest/v1/produkte?') ? srv.produkt : {};
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await seite.addInitScript(({ konto, sitzung, vorher }) => {
    try {
      if (konto) localStorage.setItem('schach-arena:konto:sichtbar', '1');
      if (sitzung) localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(sitzung));
      for (const [k, v] of Object.entries(vorher || {})) localStorage.setItem(k, v);
    } catch (e) { /* egal */ }
    window.__geoeffnet = [];
    window.open = (u) => { window.__geoeffnet.push(String(u)); return { opener: null }; };
  }, { konto, sitzung, vorher });
  return { kontext, seite, fehler, anfragen, srv };
}
async function bild(seite, name) {
  if (!BILDER) return;
  await seite.screenshot({ path: path.join(BILDER, name + '.png') });
}
async function zuEinstellungen(seite) {
  await seite.goto(BASIS + '#einstellungen');
  await seite.waitForSelector('.es-screen, .es-inhalt', { timeout: 15000 });
}
// sichtbarer Text der Abo-Oberflaeche ohne Druck, Countdown, Prozent und Streichpreis
const fairPruefung = (seite) => seite.evaluate(() => {
  const els = [...document.querySelectorAll('.abo-gruppe, .trainer-ort, .premium-hinweis')];
  return { text: els.map((e) => e.innerText).join('\n'), streich: els.some((e) => e.querySelector('s, del, strike')) };
});
function fair(t) {
  const klein = t.text.toLowerCase();
  return !DRUCK.some((w) => klein.includes(w.toLowerCase())) && !COUNTDOWN_RE.test(t.text) && !/%/.test(t.text) && !t.streich;
}
const blattZustand = (seite) => seite.evaluate(() => {
  const k = document.querySelector('.trainer-karte');
  if (!k) return null;
  const r = k.getBoundingClientRect();
  return {
    zustand: k.dataset.zustand, preis: k.querySelector('.trainer-preis-text').textContent, stand: k.querySelector('.trainer-stand').textContent,
    knoepfe: [...k.querySelectorAll('.trainer-knoepfe button')].map((b) => b.textContent + (b.disabled ? ' (aus)' : '')),
    vorteile: k.querySelectorAll('.trainer-im-abo li').length, gratis: k.querySelectorAll('.trainer-gratis li').length,
    fokusDrin: k.contains(document.activeElement), links: r.left, rechts: r.right, breite: innerWidth, ueber: document.scrollingElement.scrollWidth - innerWidth,
    dialog: k.getAttribute('role') === 'dialog' && k.getAttribute('aria-modal') === 'true',
  };
});

async function browserTeil(browser) {
  // ---------- Konto verborgen: auch keine Abo-Gruppe ----------
  gruppe = 'Konto verborgen';
  {
    const { kontext, seite, fehler } = await neueSeite(browser, { konto: false });
    await zuEinstellungen(seite);
    await warte(300);
    pruefe('ohne sichtbares Konto keine Abo-Gruppe (wie das Konto zuerst nur fuer Flo)', (await seite.locator('.abo-gruppe').count()) === 0
      && (await seite.locator('.konto-gruppe').count()) === 0);
    pruefe('keine Fehler', fehler.length === 0, fehler);
    await kontext.close();
  }

  // ---------- Vorschau: kein Produkt, nicht angemeldet ----------
  gruppe = 'Vorschau';
  {
    const { kontext, seite, fehler, anfragen } = await neueSeite(browser, {});
    await zuEinstellungen(seite);
    await seite.waitForSelector('.abo-gruppe');
    const lage = await seite.evaluate(() => {
      const g = document.querySelector('.abo-gruppe');
      return { nachKonto: g.previousElementSibling && g.previousElementSibling.classList.contains('konto-gruppe'), text: g.innerText,
        css: [...document.querySelectorAll('link[data-paket-css="abo"]')].length, primaer: g.querySelectorAll('.primaer').length };
    });
    pruefe('Gruppe direkt unter dem Konto, Hinweis aufs Konto, Paket-CSS einmal geladen, kein zweiter Zinnober-Knopf', lage.nachKonto
      && /brauchst du ein Konto/.test(lage.text) && /bleiben gratis/.test(lage.text) && lage.css === 1 && lage.primaer === 0, lage);
    pruefe('ohne Anmeldung keine Abo-Abfrage', !anfragen.some((a) => /rpc\/ist_premium|\/abos\?/.test(a.url)));
    await seite.click('.abo-gruppe [data-abo="zeigen"]');
    await seite.waitForSelector('.trainer-karte');
    await seite.waitForFunction(() => document.querySelector('.trainer-karte').dataset.zustand !== 'laedt');
    const z = await blattZustand(seite);
    pruefe('Blatt: Dialog, Preis folgt, "Bald verfügbar" aus, Schließen', z.dialog && z.zustand === 'vorschau' && z.preis === 'Preis folgt'
      && JSON.stringify(z.knoepfe) === JSON.stringify(['Bald verfügbar (aus)', 'Schließen']) && /in Vorbereitung/.test(z.stand), z);
    pruefe('Blatt: 7 Vorteile im Trainer, 5 immer gratis, jederzeit kündbar', z.vorteile === 7 && z.gratis === 5
      && /Jederzeit kündbar/.test(await seite.locator('.trainer-karte').innerText()));
    pruefe('Blatt: Fokus im Blatt', z.fokusDrin);
    const t = await fairPruefung(seite);
    pruefe('Fairness: kein Druck, kein Countdown, kein Prozent, kein Streichpreis', fair(t), t.text.slice(0, 200));
    pruefe('Produkt ohne Anmeldung abgefragt', anfragen.some((a) => a.url.includes('/rest/v1/produkte?') && !a.kopf.authorization));
    await warte(600);
    await bild(seite, 'abo-vorschau-hell');
    await seite.keyboard.press('Escape');
    await seite.waitForSelector('.trainer-ort', { state: 'detached', timeout: 3000 });
    pruefe('Escape schliesst, Fokus zurueck auf den Knopf', await seite.evaluate(() => document.activeElement && document.activeElement.dataset.abo === 'zeigen'));
    pruefe('keine Fehler', fehler.length === 0, fehler);
    await kontext.close();
  }

  // ---------- Produkt da, nicht angemeldet ----------
  gruppe = 'Abgemeldet';
  {
    const { kontext, seite, fehler } = await neueSeite(browser, { server: { produkt: [PRODUKT] } });
    await zuEinstellungen(seite);
    await seite.waitForSelector('.abo-gruppe');
    await seite.click('.abo-gruppe [data-abo="zeigen"]');
    await seite.waitForFunction(() => ['abgemeldet', 'kaufbar'].includes(document.querySelector('.trainer-karte')?.dataset.zustand));
    const z = await blattZustand(seite);
    pruefe('Preis aus der Tabelle, Hinweis aufs Konto, Knopf "Zum Konto" statt Kauf', z.zustand === 'abgemeldet' && z.preis === PRODUKT.preis_text
      && /brauchst du ein Konto/.test(z.stand) && z.knoepfe[0] === 'Zum Konto' && !z.knoepfe.includes('Trainer abschließen'), z);
    await seite.click('.trainer-knoepfe [data-trainer="konto"]');
    await seite.waitForSelector('.trainer-ort', { state: 'detached', timeout: 3000 });
    pruefe('"Zum Konto" schliesst das Blatt und bleibt in den Einstellungen', (await seite.evaluate(() => document.documentElement.dataset.screen)) === 'einstellungen'
      && (await seite.evaluate(() => window.__geoeffnet.length)) === 0);
    pruefe('keine Fehler', fehler.length === 0, fehler);
    await kontext.close();
  }

  // ---------- angemeldet, kaufbar, Kauf und Rueckkehr ----------
  gruppe = 'Kauf';
  {
    const { kontext, seite, fehler, anfragen, srv } = await neueSeite(browser, { sitzung: SITZUNG, server: { produkt: [PRODUKT] } });
    await zuEinstellungen(seite);
    await seite.waitForSelector('.abo-gruppe');
    await seite.waitForFunction(() => /Kein Abo aktiv/.test(document.querySelector('.abo-gruppe .abo-stand').textContent));
    pruefe('Gruppe: kein Abo aktiv, Spiel bleibt gratis', true);
    const rpc = anfragen.find((a) => a.url.endsWith('/rest/v1/rpc/ist_premium'));
    pruefe('Abgleich mit Bearer der Sitzung', rpc && rpc.methode === 'POST' && rpc.kopf.authorization === 'Bearer ' + SITZUNG.access_token);
    await seite.click('.abo-gruppe [data-abo="zeigen"]');
    await seite.waitForFunction(() => document.querySelector('.trainer-karte')?.dataset.zustand === 'kaufbar');
    const z = await blattZustand(seite);
    pruefe('kaufbar: "Trainer abschließen" zuerst, Preis aus der Tabelle', z.knoepfe[0] === 'Trainer abschließen' && z.preis === PRODUKT.preis_text, z);
    await warte(600);
    await bild(seite, 'abo-kaufbar-hell');
    await seite.click('.trainer-knoepfe [data-trainer="kaufen"]');
    await seite.waitForFunction(() => window.__geoeffnet.length === 1);
    const u = new URL(await seite.evaluate(() => window.__geoeffnet[0]));
    pruefe('Kauf oeffnet Stripe mit client_reference_id und prefilled_email', u.origin + u.pathname === 'https://buy.stripe.example/probe-link'
      && u.searchParams.get('client_reference_id') === UID && u.searchParams.get('prefilled_email') === MAIL, u.toString());
    await seite.waitForFunction(() => /Bezahlseite/.test(document.querySelector('.trainer-stand').textContent));
    pruefe('Kauf gemerkt (fuer die Rueckkehr)', !!(await seite.evaluate(() => localStorage.getItem('schach-arena:abo:kauf'))));
    // Zahlung fertig: der Webhook hat das Abo eingetragen; Flo kommt in die App zurueck
    srv.premium = true;
    srv.abo = [{ status: 'aktiv', plan: 'monat', gueltig_bis: new Date(Date.now() + 30 * 86400000).toISOString(), quelle: 'stripe' }];
    await seite.keyboard.press('Escape');
    await seite.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await seite.waitForSelector('.toast', { timeout: 5000 });
    const toast = await seite.locator('.toast').innerText();
    pruefe('Rueckkehr: neu gefragt, einmal Danke', /Crownmate Trainer ist aktiv/.test(toast) && /Danke/.test(toast), toast);
    await seite.waitForFunction(() => /aktiv bis/.test(document.querySelector('.abo-gruppe .abo-stand').textContent));
    pruefe('Gruppe zeichnet neu: aktiv bis, verlängert sich automatisch, Knopf "Mein Trainer"',
      /verlängert sich automatisch/.test(await seite.locator('.abo-gruppe .abo-stand').innerText())
      && (await seite.locator('.abo-gruppe [data-abo="zeigen"]').innerText()) === 'Mein Trainer');
    pruefe('Kauf-Merker nach Erfolg weg', (await seite.evaluate(() => localStorage.getItem('schach-arena:abo:kauf'))) === null);
    // Tastatur: Fokus auf dem Knopf der Gruppe ueberlebt das Neuzeichnen und kommt aus dem Blatt zurueck
    await seite.focus('.abo-gruppe [data-abo="zeigen"]');
    await seite.evaluate(() => document.dispatchEvent(new CustomEvent('abo:stand')));
    await seite.keyboard.press('Enter');
    await seite.waitForSelector('.trainer-karte');
    await seite.evaluate(() => document.dispatchEvent(new CustomEvent('abo:stand')));
    await seite.keyboard.press('Escape');
    await seite.waitForSelector('.trainer-ort', { state: 'detached', timeout: 3000 });
    pruefe('Fokus bleibt beim Neuzeichnen auf dem Knopf und kommt aus dem Blatt zurueck',
      await seite.evaluate(() => document.activeElement && document.activeElement.dataset.abo === 'zeigen' && document.activeElement.isConnected));
    pruefe('keine Fehler', fehler.length === 0, fehler);
    await kontext.close();
  }

  // ---------- Premium (gekuendigt), dunkel, Handy ----------
  gruppe = 'Premium';
  {
    const bis = Date.now() + 12 * 86400000;
    const { kontext, seite, fehler } = await neueSeite(browser, { w: 390, h: 844, schema: 'dark', handy: true, sitzung: SITZUNG,
      server: { produkt: [PRODUKT], premium: true, abo: [{ status: 'gekuendigt', plan: 'jahr', gueltig_bis: new Date(bis).toISOString(), quelle: 'stripe' }] } });
    await zuEinstellungen(seite);
    await seite.waitForSelector('.abo-gruppe');
    await seite.waitForFunction(() => /Gekündigt/.test(document.querySelector('.abo-gruppe .abo-stand').textContent));
    const text = await seite.locator('.abo-gruppe .abo-stand').innerText();
    pruefe('Gruppe: gekündigt, gilt bis Datum (ohne Countdown)', text === `Gekündigt, dein Trainer gilt bis ${new Date(bis).toLocaleDateString('de-DE')}.`, text);
    await seite.click('.abo-gruppe [data-abo="zeigen"]');
    await seite.waitForFunction(() => document.querySelector('.trainer-karte')?.dataset.zustand === 'premium');
    const z = await blattZustand(seite);
    pruefe('Blatt: "Abo verwalten" statt Kauf', z.knoepfe[0] === 'Abo verwalten' && !z.knoepfe.includes('Trainer abschließen'), z);
    pruefe('Handy: Blatt passt in die Breite, keine waagrechte Rolle', z.links >= 0 && z.rechts <= z.breite + 0.5 && z.ueber <= 0, z);
    await warte(600);
    await bild(seite, 'abo-premium-dunkel-handy');
    await seite.evaluate(() => { const k = document.querySelector('.trainer-karte'); k.scrollTop = k.scrollHeight; });
    await bild(seite, 'abo-premium-dunkel-handy-unten');
    await seite.click('.trainer-knoepfe [data-trainer="verwalten"]');
    await seite.waitForFunction(() => window.__geoeffnet.length === 1);
    pruefe('Verwalten oeffnet das Kundenportal mit prefilled_email', (await seite.evaluate(() => window.__geoeffnet[0]))
      === PRODUKT.portal_link + '?prefilled_email=' + encodeURIComponent(MAIL));
    const t = await fairPruefung(seite);
    pruefe('Fairness (Premium): kein Druck, kein Countdown', fair(t), t.text.slice(0, 200));
    // Screen-Wechsel schliesst das Blatt
    await seite.evaluate(() => { location.hash = '#arena'; });
    await seite.waitForSelector('.trainer-ort', { state: 'detached', timeout: 3000 });
    pruefe('Screen-Wechsel schliesst das Blatt', true);
    pruefe('keine Fehler', fehler.length === 0, fehler);
    await kontext.close();
  }

  // ---------- offline: letzter Stand bis gueltig_bis ----------
  gruppe = 'Offline';
  {
    const jetzt = Date.now();
    const stand = (bis) => JSON.stringify({ uid: UID, premium: true, status: 'aktiv', plan: 'monat', gueltigBis: bis, quelle: 'manuell', geprueftAm: jetzt - 86400000 });
    const a = await neueSeite(browser, { sitzung: SITZUNG, server: { offline: true }, vorher: { 'schach-arena:abo:stand': stand(jetzt + 3 * 86400000) } });
    await zuEinstellungen(a.seite);
    await a.seite.waitForSelector('.abo-gruppe');
    await warte(800);
    const t1 = await a.seite.locator('.abo-gruppe .abo-stand').innerText();
    pruefe('offline mit gueltigem Stand: aktiv (ohne "verlängert sich", Quelle manuell)', /^Dein Trainer ist aktiv bis/.test(t1) && !/verlängert/.test(t1), t1);
    await a.seite.click('.abo-gruppe [data-abo="zeigen"]');
    await a.seite.waitForFunction(() => document.querySelector('.trainer-karte')?.dataset.zustand === 'premium');
    pruefe('offline: Blatt zeigt den Stand, kein Produkt -> nur Schließen', JSON.stringify((await blattZustand(a.seite)).knoepfe) === '["Schließen"]');
    pruefe('keine Fehler', a.fehler.length === 0, a.fehler);
    await a.kontext.close();
    const b = await neueSeite(browser, { sitzung: SITZUNG, server: { offline: true }, vorher: { 'schach-arena:abo:stand': stand(jetzt - 60000) } });
    await zuEinstellungen(b.seite);
    await b.seite.waitForSelector('.abo-gruppe');
    await warte(800);
    const t2 = await b.seite.locator('.abo-gruppe .abo-stand').innerText();
    pruefe('offline mit abgelaufenem Stand: kein Abo aktiv', /Kein Abo aktiv/.test(t2), t2);
    await b.kontext.close();
  }

  // ---------- App-Store-Huelle: kein Kauf ueber Stripe ----------
  gruppe = 'Store-Huelle';
  {
    const { kontext, seite, fehler } = await neueSeite(browser, { sitzung: SITZUNG, server: { produkt: [PRODUKT] } });
    await seite.addInitScript(() => { window.Capacitor = { isNativePlatform: () => true }; });
    await zuEinstellungen(seite);
    await seite.waitForSelector('.abo-gruppe');
    await seite.click('.abo-gruppe [data-abo="zeigen"]');
    await seite.waitForFunction(() => document.querySelector('.trainer-karte')?.dataset.zustand === 'store');
    const z = await blattZustand(seite);
    pruefe('in der Huelle: kein Kauf-Knopf, "Bald verfügbar" aus, ruhiger Text', JSON.stringify(z.knoepfe) === JSON.stringify(['Bald verfügbar (aus)', 'Schließen'])
      && /In dieser App ist der Trainer noch nicht verfügbar/.test(z.stand), z);
    pruefe('keine Fehler', fehler.length === 0, fehler);
    await kontext.close();
  }

  // ---------- premiumHinweis fuer andere Pakete ----------
  gruppe = 'premiumHinweis';
  {
    const { kontext, seite, fehler } = await neueSeite(browser, { konto: false, server: { produkt: [PRODUKT] } });
    await zuEinstellungen(seite);
    const r = await seite.evaluate(async () => {
      const m = await import('./js/abo.js');
      const box = document.createElement('div');
      box.id = 'ph-box';
      document.querySelector('.es-inhalt').append(box);
      m.premiumHinweis(box, 'Coach-Erklärungen in ganzen Sätzen');
      const h = m.premiumHinweis(box, 'Coach-Erklärungen in ganzen Sätzen');
      await new Promise((ok) => setTimeout(ok, 300));
      return { anzahl: box.querySelectorAll('.premium-hinweis').length, gleich: box.lastElementChild === h, text: h.innerText, rolle: h.getAttribute('role'),
        was: h.dataset.premium, anzeige: getComputedStyle(h).display, knopf: !!h.querySelector('button.ph-mehr') };
    });
    pruefe('Hinweis: einmal im Behaelter (ersetzt den vorigen), ruhiger Text, Optik geladen', r.anzahl === 1 && r.gleich && r.rolle === 'note'
      && r.was === 'Coach-Erklärungen in ganzen Sätzen' && /Coach-Erklärungen in ganzen Sätzen/.test(r.text) && /Alles andere bleibt gratis/.test(r.text)
      && r.anzeige === 'flex' && r.knopf, r);
    await seite.locator('#ph-box').scrollIntoViewIfNeeded();
    await bild(seite, 'abo-hinweis-hell');
    await seite.click('#ph-box .ph-mehr');
    await seite.waitForSelector('.trainer-karte');
    pruefe('Knopf "Mehr zum Trainer" oeffnet das Blatt', (await seite.locator('.trainer-karte h3').innerText()) === 'Crownmate Trainer');
    const t = await fairPruefung(seite);
    pruefe('Fairness (Hinweis): kein Druck, kein Countdown', fair(t), t.text.slice(0, 200));
    await seite.keyboard.press('Escape');
    const inPartie = await seite.evaluate(async () => {
      const m = await import('./js/abo.js');
      const alt = document.documentElement.dataset.screen;
      document.documentElement.dataset.screen = 'partie';
      const box = document.createElement('div');
      const r = m.premiumHinweis(box, 'Etwas');
      document.documentElement.dataset.screen = alt;
      return { r, kinder: box.children.length };
    });
    pruefe('in der Partie (und im Ergebnis) zeigt der Hinweis nichts (Fairness 13)', inPartie.r === null && inPartie.kinder === 0);
    pruefe('keine Fehler', fehler.length === 0, fehler);
    await kontext.close();
  }

  // ---------- weniger Bewegung ----------
  gruppe = 'Bewegung aus';
  {
    const { kontext, seite, fehler } = await neueSeite(browser, { bewegung: 'reduce' });
    await zuEinstellungen(seite);
    await seite.waitForSelector('.abo-gruppe');
    await seite.click('.abo-gruppe [data-abo="zeigen"]');
    await seite.waitForSelector('.trainer-karte');
    const offen = await seite.evaluate(() => document.querySelector('.trainer-karte').getAnimations().length);
    await seite.keyboard.press('Escape');
    const weg = await seite.evaluate(() => !document.querySelector('.trainer-ort'));
    pruefe('ohne Bewegung: keine laufende Animation, Schliessen sofort', offen === 0 && weg, { offen, weg });
    pruefe('keine Fehler', fehler.length === 0, fehler);
    await kontext.close();
  }

  gruppe = 'Netz';
  pruefe('keine Anfragen ausser an die App und den gefaelschten Supabase-Server (Stripe nie geladen)', fremd.length === 0, fremd.slice(0, 5));
}

// =====================================================================
await nodeTeil();
if (!NUR_NODE) {
  let server = null;
  let browser = null;
  try {
    const pw = ladePlaywright();
    server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: WURZEL, stdio: 'ignore' });
    await warteAufServer(`http://127.0.0.1:${PORT}/index.html`);
    browser = await browserTyp(pw).launch();
    await browserTeil(browser);
  } catch (e) {
    pruefe('Browser-Teil lief ohne Ausnahme', false, e && (e.stack || e.message));
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (server) server.kill();
  }
}
console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
