// Client von "Frag den Coach" (Welle B2): js/coach-ki.js und das Paket js/pakete/coach-ki/. Node-Teil mit gefaelschtem
// fetch (Eingabe aus der Analyse, Anfrage an die Edge Function, Merker, Fehlergruende, offline), danach Browser-Teil gegen
// die echte App (index.html?test) mit einem gefaelschten Supabase-Server ueber page.route: Knopf in der Coach-Karte der
// Analyse, Antwort-Karte mit KI-Hinweis, ohne Anmeldung, ohne Trainer (premiumHinweis aus B1), offline, Tageslimit,
// Fehler, Layout auf Handy und iPad, hell und dunkel. Die echte KI und die echte Supabase werden nie aufgerufen.
//
// Das Paket wird ueber ?test&erw=pakete/coach-ki/index geladen, bis die Integration es in PAKETE eintraegt.
//   node tests/coach-ki.test.mjs              alles
//   node tests/coach-ki.test.mjs --nur-node   ohne Browser
//   PORT=9800 BILDER=<ordner> node tests/coach-ki.test.mjs   eigener Port (Standard 8874), Bildschirmfotos in <ordner>
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { setzeSpeicher } from '../js/storage.js';
import { setzeKontoFetch, SITZUNG_SCHLUESSEL } from '../js/konto.js';
import { setzeAboFetch, setzeAboUhr, STAND_SCHLUESSEL, vorteilBereit } from '../js/abo.js';
import {
  COACH_PFAD, MERKER_MAX, WARTE_MS, KI_HINWEIS, TEXTE, eingabeAusZug, frageCoach, restText, vergissAntworten, setzeCoachFetch, setzeCoachWartezeit,
} from '../js/coach-ki.js';
import { COUNTDOWN_RE } from '../js/inhalte.js';
import { pruefeEingabe, baueNutzerText } from '../supabase/functions/_gemeinsam/coach.js';
import { browserTyp } from './browser.mjs';

const require = createRequire(import.meta.url);
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8874);
// Das Paket steht noch nicht in PAKETE (das macht die Integration, js/erweiterungen.js): im Test ueber ?erw laden.
// Das Abo-Paket dazu, damit "Mehr zum Trainer" das Blatt wie in der App oeffnet.
const BASIS = `http://127.0.0.1:${PORT}/index.html?test&kern&erw=pakete/coach-ki/index,pakete/abo/index`;
const NUR_NODE = process.argv.includes('--nur-node');
const BILDER = process.env.BILDER ? path.join(process.env.BILDER, 'coach-ki') : '';
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
const ERLAUBT = ['fen', 'zug', 'besterZug', 'bewertungVorher', 'bewertungNachher', 'klasse', 'spielerLevel', 'eigenerZug'];
const DRUCK = ['nur heute', 'nur noch', 'letzte Chance', 'limitiert', 'endet in', 'läuft ab', 'verfällt', 'verpasst', 'sparen', 'Rabatt',
  'jetzt zuschlagen', 'Wir vermissen dich', 'Beeil'];
// Schaefermatt verpasst: Weiss spielt Lxf7+ statt Dxf7#
const SAN = ['e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6', 'Bxf7+', 'Ke7', 'Bb3', 'Nxh5'];
const PLY_LXF7 = 6;
const ANTWORT = 'Dein Läufer schlägt auf f7 und gibt Schach, aber der König kann ausweichen. Mit der Dame auf f7 wäre es sofort Matt gewesen, weil der Läufer auf c4 sie deckt.';

// =====================================================================
// Node-Teil
// =====================================================================
async function nodeTeil() {
  gruppe = 'Node';
  const m = new Map();
  globalThis.localStorage = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k),
    key: (i) => [...m.keys()][i] ?? null, get length() { return m.size; } };
  Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'Test', onLine: true }, configurable: true });
  setzeSpeicher(globalThis.localStorage);
  setzeAboUhr(() => Date.now());

  // ---------- Eingabe aus einem Eintrag der Analyse ----------
  const ZUG = { fenVorher: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4', uci: 'c4f7', san: 'Bxf7+', besterZug: 'h5f7',
    evalVorher: { cp: null, mate: 1 }, evalNachher: { cp: 152.4 }, klasse: 'verpasst', coach: 'Verschenkt! …', farbe: 'w', besteLinieSan: ['Qxf7#'] };
  const e = eingabeAusZug(ZUG, { partie: { spielstaerke: 742.6, notiz: 'privat' }, du: true });
  pruefe('eingabeAusZug: nur Fakten (Stellung, Zuege, Bewertungen, Klasse, Staerke, wer zog), keine Texte', JSON.stringify(e) === JSON.stringify({
    fen: ZUG.fenVorher, zug: 'c4f7', besterZug: 'h5f7', bewertungVorher: { mate: 1 }, bewertungNachher: { cp: 152 }, klasse: 'verpasst', spielerLevel: 743, eigenerZug: true }), e);
  pruefe('eingabeAusZug: passt zur Pruefung des Servers (pruefeEingabe)', pruefeEingabe(e).ok);
  const ohne = eingabeAusZug({ ...ZUG, besterZug: null, evalVorher: null, evalNachher: undefined, klasse: 7 }, { partie: { spielstaerke: 50 } });
  pruefe('eingabeAusZug: Fehlendes faellt weg, unplausible Staerke nicht gesendet', ohne.besterZug === null && ohne.bewertungVorher === null
    && ohne.bewertungNachher === null && ohne.klasse === null && !('spielerLevel' in ohne) && !('eigenerZug' in ohne) && pruefeEingabe(ohne).ok);
  pruefe('eingabeAusZug: ohne Stellung oder Zug null', eingabeAusZug(null) === null && eingabeAusZug({ uci: 'e2e4' }) === null
    && eingabeAusZug({ fenVorher: 'x', uci: 'Lxf7' }) === null);
  // Pruefer-Befund B2: der Mattzug selbst. Der Review-Eintrag traegt danach die Mattstellung als { cp: null, mate: +-1 }
  // (js/engine.js endstellung); beim Modell muss "Schachmatt" ankommen, nicht "setzt in 1 Zug matt"
  const matt = eingabeAusZug({ ...ZUG, uci: 'h5f7', san: 'Qxf7#', klasse: 'bester', evalNachher: { cp: null, mate: 1 } }, { du: true });
  const mattText = pruefeEingabe(matt).ok ? baueNutzerText(pruefeEingabe(matt).eingabe) : '';
  pruefe('Mattzug aus der Analyse: der Server macht "Schachmatt, die Partie ist zu Ende" daraus', /Dame von h5 nach f7, schlägt den Bauern auf f7, setzt matt/.test(mattText)
    && mattText.includes('Nach dem Zug: Schachmatt, die Partie ist zu Ende. Weiß hat gewonnen.') && !mattText.includes('Bewertung nach dem gespielten Zug'), mattText);

  // ---------- Anfrage ----------
  const server = { status: 200, body: { text: ANTWORT, modell: 'claude-opus-5-5', rest: 12 }, offline: false, warte: 0 };
  const aufrufe = [];
  setzeCoachFetch(async (url, opt) => {
    aufrufe.push({ url, ...opt });
    if (server.offline) throw new Error('offline');
    if (server.warte) await warte(server.warte);
    return { ok: server.status < 400, status: server.status, async json() { if (server.body === undefined) throw new Error('leer'); return server.body; } };
  });
  const aboAufrufe = [];
  setzeAboFetch(async (url, opt) => { aboAufrufe.push({ url, ...opt }); return { ok: true, status: 200, async json() { return url.includes('/rpc/') ? false : []; } }; });

  pruefe('nicht angemeldet: abgemeldet, keine Anfrage', (await frageCoach(e)).grund === 'abgemeldet' && aufrufe.length === 0);
  localStorage.setItem(SITZUNG_SCHLUESSEL, JSON.stringify(SITZUNG));
  pruefe('kaputte Eingabe: eingabe, keine Anfrage', (await frageCoach(null)).grund === 'eingabe' && (await frageCoach({ fen: 'x', zug: 'quatsch' })).grund === 'eingabe'
    && aufrufe.length === 0);
  const a = await frageCoach(e);
  const q = aufrufe[0];
  pruefe('Antwort: ok mit Text, Modell, rest', a.ok && a.text === ANTWORT && a.modell === 'claude-opus-5-5' && a.rest === 12 && a.gemerkt === false, a);
  pruefe('Anfrage: POST an /functions/v1/coach mit Token, apikey und JSON', q.url === SUPA + COACH_PFAD && q.method === 'POST'
    && q.headers.Authorization === 'Bearer ' + SITZUNG.access_token && !!q.headers.apikey && q.headers['Content-Type'] === 'application/json');
  const body = JSON.parse(q.body);
  pruefe('Anfrage: nur erlaubte Felder, keine E-Mail, keine Nutzer-ID', Object.keys(body).every((k) => ERLAUBT.includes(k)) && !q.body.includes(MAIL)
    && !q.body.includes(UID) && body.zug === 'c4f7');
  const b = await frageCoach({ ...e });
  pruefe('derselbe Zug noch einmal: aus dem Merker, keine zweite Frage', b.ok && b.gemerkt === true && b.text === ANTWORT && aufrufe.length === 1);
  server.warte = 20;
  const e2 = { ...e, zug: 'h5f7', klasse: 'bester' };
  const [c1, c2] = await Promise.all([frageCoach(e2), frageCoach(e2)]);
  pruefe('zwei gleichzeitige Fragen zum selben Zug: eine Anfrage', c1.ok && c2.ok && aufrufe.length === 2);
  server.warte = 0;
  // andere Person auf demselben Geraet: der Merker gilt je Nutzer
  localStorage.setItem(SITZUNG_SCHLUESSEL, JSON.stringify({ ...SITZUNG, access_token: token('11111111-2222-4333-8444-555555555555'), user: { id: '11111111-2222-4333-8444-555555555555' } }));
  await frageCoach(e);
  pruefe('Merker je Nutzer: eine andere Person fragt neu', aufrufe.length === 3);
  localStorage.setItem(SITZUNG_SCHLUESSEL, JSON.stringify(SITZUNG));
  vergissAntworten();
  await frageCoach(e);
  pruefe('vergissAntworten: danach wieder eine Anfrage', aufrufe.length === 4);
  // Merker begrenzt
  vergissAntworten();
  for (let i = 0; i < MERKER_MAX + 5; i++) await frageCoach({ ...e, fen: e.fen.replace(/ \d+$/, ' ' + (10 + i)) });
  const vorher = aufrufe.length;
  await frageCoach({ ...e, fen: e.fen.replace(/ \d+$/, ' 10') });
  await frageCoach({ ...e, fen: e.fen.replace(/ \d+$/, ' ' + (10 + MERKER_MAX + 4)) });
  pruefe(`Merker hoechstens ${MERKER_MAX} Antworten (die aelteste faellt heraus)`, aufrufe.length === vorher + 1);

  // ---------- Fehlergruende ----------
  vergissAntworten();
  const faelle = [
    ['401 anmeldung', 401, { fehler: 'anmeldung' }, 'abgemeldet'],
    ['403 premium', 403, { fehler: 'premium' }, 'premium'],
    ['429 limit', 429, { fehler: 'limit', grenze: 30 }, 'limit'],
    ['400 eingabe', 400, { fehler: 'eingabe', grund: 'zug' }, 'eingabe'],
    ['422 abgelehnt', 422, { fehler: 'abgelehnt' }, 'abgelehnt'],
    ['503 nicht_eingerichtet', 503, { fehler: 'nicht_eingerichtet' }, 'nicht_eingerichtet'],
    ['503 server', 503, { fehler: 'server' }, 'ki'],
    ['502 ki', 502, { fehler: 'ki' }, 'ki'],
    ['500 ohne Koerper', 500, undefined, 'ki'],
    ['401 ohne Koerper', 401, undefined, 'abgemeldet'],
    ['429 ohne Koerper', 429, undefined, 'limit'],
    ['200 ohne Text', 200, { text: '  ' }, 'ki'],
    ['unbekannte Kennung', 503, { fehler: '<script>' }, 'ki'],
  ];
  const vorFehler = aufrufe.length;
  for (const [name, status, body2, grund] of faelle) {
    server.status = status;
    server.body = body2;
    const r = await frageCoach({ ...e, zug: 'h5f7' });
    pruefe(`Fehler ${name} -> ${grund}, nicht gemerkt`, !r.ok && r.grund === grund && r.status === status, r);
  }
  pruefe('Fehler werden nie gemerkt: jeder der Faelle oben hat neu gefragt (derselbe Zug)', aufrufe.length === vorFehler + faelle.length,
    { vorher: vorFehler, nachher: aufrufe.length, faelle: faelle.length });
  const aboVorher = aboAufrufe.length;
  server.status = 403;
  server.body = { fehler: 'premium' };
  await frageCoach({ ...e, zug: 'h5f7' });
  await warte(10);
  pruefe('Server sagt "kein Trainer": Abo-Stand wird neu geholt (Zwischenspeicher war veraltet)', aboAufrufe.length > aboVorher
    && aboAufrufe.slice(aboVorher).some((x) => x.url.includes('/rpc/ist_premium')));
  server.status = 200;
  server.body = { text: ANTWORT, rest: 2 };
  server.offline = true;
  pruefe('kein Netz: offline', (await frageCoach({ ...e, zug: 'h5f7' })).grund === 'offline');
  server.offline = false;
  // Klein-Befund B2: ohne Zeitgrenze bliebe die Karte bei "schaut sich die Stellung an", bis der Browser aufgibt
  setzeCoachWartezeit(60);
  server.warte = 400;
  const t0 = Date.now();
  const lang = await frageCoach({ ...e, zug: 'h5f7' });
  const dauer = Date.now() - t0;
  server.warte = 0;
  const danach = await frageCoach({ ...e, zug: 'h5f7' });
  setzeCoachWartezeit(null);
  pruefe(`Zeitgrenze (Standard ${WARTE_MS / 1000} s): Server antwortet nicht rechtzeitig -> ki (nicht erreichbar), nicht gemerkt, danach neu gefragt`,
    WARTE_MS === 100000 && !lang.ok && lang.grund === 'ki' && lang.status === null && dauer < 350 && danach.ok && danach.gemerkt === false, { lang, dauer, danach });
  vergissAntworten();

  // abgelaufene Sitzung: erst erneuern (js/konto.js), dann fragen; Erneuern ohne Netz: offline, abgelehnt: abgemeldet
  const kontoAufrufe = [];
  let kontoArt = 'ok';
  setzeKontoFetch(async (url, opt) => {
    kontoAufrufe.push({ url, ...opt });
    if (kontoArt === 'offline') throw new Error('offline');
    if (kontoArt === 'abgelehnt') return { ok: false, status: 400, async json() { return { msg: 'Invalid Refresh Token' }; } };
    return { ok: true, status: 200, async json() { return { ...SITZUNG, access_token: token(UID) + 'neu', refresh_token: 'r2', expires_at: 9999999999 }; } };
  });
  localStorage.setItem(SITZUNG_SCHLUESSEL, JSON.stringify({ ...SITZUNG, expires_at: 1 }));
  vergissAntworten();
  const n0 = aufrufe.length;
  const neu = await frageCoach({ ...e, zug: 'h5f7' });
  pruefe('abgelaufene Sitzung: erneuert, dann mit dem neuen Token gefragt', neu.ok && kontoAufrufe.length === 1 && /refresh_token/.test(kontoAufrufe[0].url)
    && aufrufe[n0].headers.Authorization === 'Bearer ' + token(UID) + 'neu');
  localStorage.setItem(SITZUNG_SCHLUESSEL, JSON.stringify({ ...SITZUNG, expires_at: 1 }));
  vergissAntworten();
  kontoArt = 'offline';
  pruefe('Erneuern ohne Netz: offline (nicht "abgemeldet")', (await frageCoach({ ...e, zug: 'h5f7' })).grund === 'offline');
  kontoArt = 'abgelehnt';
  pruefe('Erneuern abgelehnt: abgemeldet', (await frageCoach({ ...e, zug: 'h5f7' })).grund === 'abgemeldet');
  localStorage.setItem(SITZUNG_SCHLUESSEL, JSON.stringify(SITZUNG));

  // ---------- Texte ----------
  pruefe('restText: erst ab 5 oder weniger, sonst nichts', restText(12) === '' && restText(5) === 'Heute noch 5 Fragen.' && restText(1) === 'Heute noch 1 Frage.'
    && restText(0) === 'Das war deine letzte Frage für heute.' && restText(null) === '' && restText(-1) === '');
  pruefe('KI-Hinweis (KI-Verordnung Art. 50)', KI_HINWEIS === 'Erklärung von einer KI, kann sich irren.');
  const alle = [...Object.values(TEXTE), KI_HINWEIS, restText(3), restText(0)].join('\n').toLowerCase();
  pruefe('Texte ohne Druck, Countdown oder Prozent', !DRUCK.some((w) => alle.includes(w.toLowerCase())) && !COUNTDOWN_RE.test(alle) && !alle.includes('%'));
  pruefe('Limit-Text nennt die Tagesgrenze 4 Uhr (wie js/tag.js und coach_tag)', /4 Uhr/.test(TEXTE.limit));

  // ---------- Paket ----------
  const paket = await import('../js/pakete/coach-ki/index.js');
  const orte = await import('../js/orte.js');
  // Pruefer-Befund B2: eigener Vorteil "frag-den-coach" (KI, Tagesgrenze), nicht die Coach-Erklaerungen aus Textbausteinen
  pruefe('Paket meldet den Vorteil frag-den-coach beim Abo (B1), nicht coach-erklaerungen, und bietet am Ort analyse:coach an', vorteilBereit('frag-den-coach')
    && !vorteilBereit('coach-erklaerungen') && paket.VORTEIL === 'frag-den-coach' && orte.angeboten('analyse:coach') === 1);
  pruefe('ohne DOM: kein Knopf (defensiv)', paket.coachKnopf({ zug: ZUG }) === null);
  const sw = readFileSync(path.join(WURZEL, 'sw.js'), 'utf8');
  pruefe('Dateien des Pakets schon im Offline-Cache (sw.js), damit das Eintragen in PAKETE nur eine Zeile ist',
    ['js/coach-ki.js', 'js/pakete/coach-ki/index.js', 'css/pakete/coach-ki.css'].every((d) => sw.includes(`'${d}'`)));
  const erw = readFileSync(path.join(WURZEL, 'js/erweiterungen.js'), 'utf8');
  pruefe('Paket noch nicht in PAKETE (kommt mit Stufe 2, Schritt 2, wenn der Server eingerichtet ist)', !/PAKETE = Object\.freeze\(\[[^\]]*coach-ki/.test(erw));

  // ---------- Optik des Pakets: nur Tokens (tests/thema.test.mjs liest css/pakete/ nicht) ----------
  const css = readFileSync(path.join(WURZEL, 'css/pakete/coach-ki.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const definiert = new Set([...readFileSync(path.join(WURZEL, 'css/tokens.css'), 'utf8').matchAll(/(--[a-z0-9-]+)\s*:/g),
    ...readFileSync(path.join(WURZEL, 'css/themes/modern.css'), 'utf8').matchAll(/(--[a-z0-9-]+)\s*:/g)].map((x) => x[1]));
  const benutzt = [...new Set([...css.matchAll(/var\((--[a-z0-9-]+)/g)].map((x) => x[1]))];
  pruefe('coach-ki.css: keine festen Farben, kein Schatten, kein Leuchten, kein Verlauf, kein Neon', !/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|shadow|gradient|glow|--neon-/i.test(css));
  pruefe('coach-ki.css: jede benutzte Variable ist ein Token aus tokens.css oder themes/modern.css', benutzt.length > 5 && benutzt.every((v) => definiert.has(v)),
    benutzt.filter((v) => !definiert.has(v)));
  const keyframes = [...css.matchAll(/@keyframes[^{]+\{([\s\S]*?\})\s*\}/g)].map((x) => x[1]);
  pruefe('coach-ki.css: Animationen nur ueber opacity und transform', keyframes.length === 2
    && keyframes.every((k) => [...k.matchAll(/([a-z-]+)\s*:/g)].every((x) => ['opacity', 'transform'].includes(x[1]))), keyframes);
  setzeCoachFetch(null);
  setzeAboFetch(null);
  setzeKontoFetch(null);
  setzeAboUhr(null);
  localStorage.removeItem(STAND_SCHLUESSEL);
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
// Neue Seite mit gefaelschtem Supabase. server: { premium, coach: { status, body, warte, offline } } (im Test aenderbar)
async function neueSeite(browser, { w = 1180, h = 820, schema = 'light', handy = false, konto = true, sitzung = SITZUNG, server = {} } = {}) {
  const kontext = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: schema, deviceScaleFactor: 1, hasTouch: true, isMobile: handy });
  const seite = await kontext.newPage();
  const fehler = [];
  const coach = [];
  const anfragen = [];
  const srv = { premium: true, aboOffline: false, coach: { status: 200, body: { text: ANTWORT, modell: 'claude-opus-5-5', rest: 3 }, warte: 0, offline: false }, ...server };
  seite.on('pageerror', (e) => fehler.push('pageerror: ' + e.message));
  seite.on('console', (m) => { if (m.type() === 'error' && !/404|Failed to fetch dynamically imported module|ERR_FAILED|net::|status of 4\d\d|status of 5\d\d/.test(m.text())) fehler.push('console: ' + m.text()); });
  seite.on('request', (r) => {
    const u = r.url();
    if (u.startsWith(`http://127.0.0.1:${PORT}/`) || /^(data|blob):/.test(u) || u.startsWith(SUPA + '/')) return;
    fremd.push(u);
  });
  await seite.route(SUPA + '/**', async (r) => {
    const u = r.request().url();
    anfragen.push(u);
    if (u.includes(COACH_PFAD)) {
      coach.push({ methode: r.request().method(), kopf: r.request().headers(), body: r.request().postData() });
      const c = srv.coach;
      if (c.offline) return r.abort('internetdisconnected');
      if (c.warte) await warte(c.warte);
      // nach der Zeitgrenze hat die App die Anfrage schon abgebrochen
      return r.fulfill({ status: c.status, contentType: 'application/json', body: JSON.stringify(c.body) }).catch(() => {});
    }
    // Abo-Stand nicht pruefbar (neues Geraet ohne Netz): ist_premium und abos scheitern
    if (srv.aboOffline && (u.includes('/rpc/ist_premium') || u.includes('/rest/v1/abos?'))) return r.abort('internetdisconnected');
    const body = u.includes('/rpc/ist_premium') ? srv.premium
      : u.includes('/rest/v1/abos?') ? (srv.premium ? [{ status: 'aktiv', plan: 'monat', gueltig_bis: new Date(Date.now() + 30 * 86400000).toISOString(), quelle: 'manuell' }] : [])
        : u.includes('/rest/v1/produkte?') ? [] : {};
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await seite.addInitScript(({ konto, sitzung }) => {
    // Konsolenfehler fuer die Diagnose in tippe()
    window.__konsolenFehler = [];
    const ce = console.error.bind(console);
    console.error = (...a) => { try { window.__konsolenFehler.push(a.map((x) => (x && x.stack) || String(x)).join(' ').slice(0, 400)); } catch (e) { /* egal */ } ce(...a); };
    try {
      if (konto) localStorage.setItem('schach-arena:konto:sichtbar', '1');
      if (sitzung) localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(sitzung));
    } catch (e) { /* egal */ }
  }, { konto, sitzung });
  return { kontext, seite, fehler, coach, anfragen, srv };
}
async function bild(seite, name) {
  if (!BILDER) return;
  await seite.screenshot({ path: path.join(BILDER, name + '.png') });
}

// Einmal im Browser die Partie mit echter Analyse rechnen (Stockfish), danach in jedem Kontext nur speichern
let PARTIE = null;
async function rechnePartie(browser) {
  const { kontext, seite } = await neueSeite(browser, { konto: false, sitzung: null });
  await seite.goto(BASIS + '#arena');
  await seite.waitForFunction(() => window.__app && typeof window.__app.engine === 'function', null, { timeout: 30000 });
  const d = await seite.evaluate(async (san) => {
    const { Chess } = await import('./vendor/chess/chess.js');
    const { analysierePartie } = await import('./js/review.js');
    const { botNachId } = await import('./js/bots.js');
    const c = new Chess();
    const zuege = [];
    const sanListe = [];
    for (const s of san) { const m = c.move(s); zuege.push(m.lan); sanListe.push(m.san); }
    const bot = botNachId('benno');
    const engine = await window.__app.engine('bewertung');
    const review = await analysierePartie(engine, zuege, { tiefe: 12, multipv: 2, spielerFarbe: 'w', elo: { b: bot.elo } });
    const partie = { id: 'pcoachprobe1', datum: new Date(Date.now() - 3600e3).toISOString(), botId: 'benno', botStufe: bot.stufe, spielerFarbe: 'w',
      startFen: new Chess().fen(), zuege, san: sanListe, ergebnis: 'niederlage', grund: 'aufgabe', hinweise: 0, zuruecknahmen: 0,
      liveKlassen: review.zuege.map((z) => (z.farbe === 'w' ? z.klasse : null)), genauigkeit: review.genauigkeit.w, genauigkeitBot: review.genauigkeit.b,
      spielstaerke: review.spielstaerke.w, eroeffnung: review.eroeffnung };
    return { partie, review };
  }, SAN);
  await kontext.close();
  return d;
}
async function zurAnalyse(seite, ply = PLY_LXF7) {
  await seite.goto(BASIS + '#arena');
  // Erst wenn der erste Screen (Arena) steht, hat die App alle Pakete geladen (ersterStart). Wer vorher zur Analyse
  // springt, bekommt sie ohne den Knopf (der Ort ist dann noch leer) und die App zeichnet sie nicht neu (gleicher Hash).
  // Achtung: waitForFunction mit einem Promise endet, sobald es erfuellt ist, auch mit false (ausprobiert); deshalb dort
  // nur Synchrones und den Ort in einer eigenen Schleife abfragen.
  await seite.waitForFunction(() => window.__app && document.documentElement.dataset.screen === 'arena', null, { timeout: 30000 });
  let angeboten = 0;
  for (let i = 0; i < 100 && angeboten < 1; i++) {
    angeboten = await seite.evaluate(async () => (await import('./js/orte.js')).angeboten('analyse:coach'));
    if (angeboten < 1) await warte(100);
  }
  if (angeboten < 1) throw new Error('Paket coach-ki nicht am Ort analyse:coach angemeldet');
  await seite.evaluate(async ({ partie, review }) => {
    const sp = await import('./js/storage.js');
    sp.speicherePartie(partie, review);
  }, PARTIE);
  await seite.evaluate(({ id, ply }) => window.__app.gehe('analyse', { partieId: id, ply }), { id: PARTIE.partie.id, ply });
  // data-klasse setzt die Analyse nur fuer einen Zug (in der Startstellung gibt es .an-c-klasse auch, aber keinen Ort)
  await seite.waitForSelector('.an-coach[data-klasse]', { timeout: 30000 });
  await warte(350);
}
const karte = (seite) => seite.evaluate(() => {
  const k = document.querySelector('.an-coach .ck-karte');
  const b = document.querySelector('.an-coach .ck-knopf');
  return {
    knopf: b ? { text: b.textContent.trim(), aus: b.disabled, offen: b.getAttribute('aria-expanded'), inZeile: !!b.closest('.an-c-knoepfe .an-c-paket') } : null,
    karte: k && !k.hidden ? { zustand: k.dataset.zustand, text: k.innerText, busy: k.getAttribute('aria-busy'), rolle: k.getAttribute('role'),
      kiText: k.querySelector('.ck-ki-hinweis')?.textContent || '', marke: k.querySelector('.ck-marke')?.textContent || '', antwort: k.querySelector('.ck-text')?.textContent || '',
      rest: k.querySelector('.ck-rest')?.textContent || '', hinweis: !!k.querySelector('.premium-hinweis[data-premium="Frag den Coach"]'),
      konto: !!k.querySelector('.ck-konto') } : null,
    versteckt: !!k && k.hidden,
    // Diagnose: welcher Zug, Konto sichtbar, Paket-CSS
    lage: { klasse: document.querySelector('.an-coach')?.dataset.klasse || null, zug: document.querySelector('.an-coach .an-c-zug')?.textContent || null,
      konto: localStorage.getItem('schach-arena:konto:sichtbar'), css: document.querySelectorAll('link[data-paket-css="coach-ki"]').length },
  };
});
// Fehlt das Element, sagt der Fehler, wo die Seite gerade steht (Screen, Hash, Zug, Konto-Schalter, Anbieter am Ort)
const tippe = async (seite, sel) => {
  try {
    await seite.locator(sel).first().waitFor({ state: 'attached', timeout: 20000 });
  } catch (e) {
    const lage = await seite.evaluate(async () => {
      const sp = await import('./js/storage.js');
      const paket = await import('./js/pakete/coach-ki/index.js');
      const konto = await import('./js/konto.js');
      const r = sp.ladeReview('pcoachprobe1');
      let direkt = null;
      try { const x = paket.coachKnopf({ zug: r && r.zuege[6], partie: sp.ladePartie('pcoachprobe1'), du: true }); direkt = x ? 'knopf' : 'null'; if (x) x.verlasse(); } catch (e) { direkt = 'wirft: ' + e.message; }
      return { screen: document.documentElement.dataset.screen, hash: location.hash,
        klasse: document.querySelector('.an-coach')?.dataset.klasse || null, zug: document.querySelector('.an-c-zug')?.textContent || null,
        konto: localStorage.getItem('schach-arena:konto:sichtbar'), freigeschaltet: konto.kontoFreigeschaltet(), paketOrt: document.querySelectorAll('.an-c-paket').length,
        anbieter: await import('./js/orte.js').then((m) => m.angeboten('analyse:coach')), direkt, fehler: (window.__konsolenFehler || []).slice(0, 5) };
    }).catch((x) => String(x));
    throw new Error(`${sel} fehlt: ${JSON.stringify(lage)}`);
  }
  await seite.locator(sel).first().click();
};
// Lage: nichts ragt aus dem Bildschirm oder aus der Coach-Karte
const lage = (seite) => seite.evaluate(() => {
  const c = document.querySelector('.an-coach').getBoundingClientRect();
  const innen = (el) => { if (!el) return true; const r = el.getBoundingClientRect(); return r.left >= c.left - 1 && r.right <= c.right + 1; };
  return { ueber: document.scrollingElement.scrollWidth - innerWidth, knopf: innen(document.querySelector('.ck-knopf')), karte: innen(document.querySelector('.ck-karte')),
    zeile: (() => { const z = document.querySelector('.an-coach .an-c-knoepfe'); return z ? z.scrollWidth - z.clientWidth : 0; })(),
    knoepfe: [...document.querySelectorAll('.an-coach .an-c-knoepfe .knopf')].filter((b) => !b.hidden).map((b) => innen(b)) };
});
const fairText = (seite) => seite.evaluate(() => [...document.querySelectorAll('.ck-knopf, .ck-karte')].map((e) => e.innerText).join('\n'));
function fair(t) {
  const klein = t.toLowerCase();
  return !DRUCK.some((w) => klein.includes(w.toLowerCase())) && !COUNTDOWN_RE.test(t) && !/%/.test(t);
}

async function browserTeil(browser) {
  gruppe = 'Vorbereitung';
  PARTIE = await rechnePartie(browser);
  const z = PARTIE.review.zuege[PLY_LXF7];
  // Lxf7+ laesst Dxf7# aus und die Dame haengt danach: die Engine nennt das "Weit daneben" (oder "Verschenkt")
  pruefe('echte Analyse: Lxf7+ ein schwerer Fehler, staerkster Zug h5f7 (Dxf7#)', z && z.uci === 'c4f7' && z.besterZug === 'h5f7'
    && ['patzer', 'verpasst'].includes(z.klasse), z && { uci: z.uci, bester: z.besterZug, klasse: z.klasse });

  // ---------- Konto verborgen: kein Knopf ----------
  gruppe = 'Konto verborgen';
  {
    const { kontext, seite, fehler } = await neueSeite(browser, { konto: false, sitzung: null });
    await zurAnalyse(seite);
    pruefe('ohne sichtbares Konto kein Knopf (niemand koennte den Trainer haben)', (await seite.locator('.ck-knopf').count()) === 0);
    pruefe('keine Fehler', fehler.length === 0, fehler);
    await kontext.close();
  }

  // ---------- Nicht angemeldet ----------
  gruppe = 'Abgemeldet';
  {
    const { kontext, seite, fehler, coach } = await neueSeite(browser, { sitzung: null });
    await zurAnalyse(seite);
    const k0 = await karte(seite);
    pruefe('Knopf "Frag den Coach" in der Knopfzeile der Coach-Karte, Karte erst nach dem Tipp', k0.knopf && k0.knopf.text === 'Frag den Coach' && k0.knopf.inZeile
      && k0.knopf.offen === 'false' && k0.karte === null, k0);
    pruefe('Paket-CSS genau einmal geladen', (await seite.locator('link[data-paket-css="coach-ki"]').count()) === 1);
    await tippe(seite, '.ck-knopf');
    await warte(200);
    const k = await karte(seite);
    pruefe('Tipp ohne Anmeldung: ruhiger Hinweis und "Zum Konto", keine Frage an den Server', k.karte && k.karte.zustand === 'abgemeldet'
      && k.karte.text.includes(TEXTE.abgemeldet) && k.karte.konto && coach.length === 0 && k.knopf.offen === 'true', k);
    await warte(500);   // sanftes Rollen ins Bild abwarten (nur fuers Foto)
    await bild(seite, 'abgemeldet');
    await tippe(seite, '.ck-konto');
    await seite.waitForSelector('.konto-gruppe', { timeout: 10000 });
    pruefe('"Zum Konto" fuehrt in die Einstellungen zur Gruppe Konto', await seite.evaluate(() => document.documentElement.dataset.screen === 'einstellungen'));
    pruefe('keine Fehler', fehler.length === 0, fehler);
    await kontext.close();
  }

  // ---------- Angemeldet, ohne Trainer ----------
  gruppe = 'Ohne Trainer';
  {
    const { kontext, seite, fehler, coach } = await neueSeite(browser, { server: { premium: false } });
    await zurAnalyse(seite);
    pruefe('ohne Tipp kein Kaufhinweis (nie von selbst)', (await seite.locator('.premium-hinweis').count()) === 0);
    await tippe(seite, '.ck-knopf');
    await seite.waitForSelector('.ck-karte[data-zustand="premium"]', { timeout: 10000 });
    const k = await karte(seite);
    pruefe('Tipp ohne Trainer: premiumHinweis aus B1 ("Frag den Coach"), keine Frage an die KI', k.karte && k.karte.hinweis && coach.length === 0
      && /Crownmate Trainer/.test(k.karte.text) && /bleibt gratis/.test(k.karte.text), k);
    pruefe('Texte fair (kein Druck, kein Countdown, kein Prozent)', fair(await fairText(seite)), await fairText(seite));
    await warte(500);   // sanftes Rollen ins Bild abwarten (nur fuers Foto)
    await bild(seite, 'ohne-trainer');
    await tippe(seite, '.ck-karte .ph-mehr');
    await seite.waitForSelector('.trainer-karte', { timeout: 10000 });
    const imAbo = await seite.evaluate(() => [...document.querySelectorAll('.trainer-karte .trainer-im-abo li')].map((l) => l.textContent));
    const geplant = await seite.evaluate(() => [...document.querySelectorAll('.trainer-karte .trainer-geplant li')].map((l) => l.textContent));
    pruefe('"Mehr zum Trainer" oeffnet das Blatt; unter "Im Trainer" steht "Frag den Coach" ehrlich (KI, bis zu 30 Fragen am Tag)',
      imAbo.some((t) => /^Frag den Coach: Eine KI erklärt/.test(t) && /bis zu 30 Fragen am Tag/.test(t)), imAbo);
    pruefe('die Coach-Erklaerungen aus Textbausteinen (SPIELKONZEPT 2b.5) bleiben "In Arbeit" (nicht als gebaut verkauft)',
      !imAbo.some((t) => /Coach-Erklärungen/.test(t)) && geplant.some((t) => /Coach-Erklärungen/.test(t)), { imAbo, geplant });
    pruefe('keine Fehler', fehler.length === 0, fehler);
    await kontext.close();
  }

  // ---------- Mit Trainer: Frage und Antwort ----------
  gruppe = 'Antwort';
  {
    const { kontext, seite, fehler, coach, srv } = await neueSeite(browser, {});
    srv.coach.warte = 600;
    await zurAnalyse(seite);
    await tippe(seite, '.ck-knopf');
    await seite.waitForSelector('.ck-karte[data-zustand="laedt"]', { timeout: 5000 });
    const l = await karte(seite);
    pruefe('waehrend der Frage: "Der Coach schaut sich die Stellung an", aria-busy, Knopf gesperrt, Rolle status', l.karte && l.karte.busy === 'true'
      && /schaut sich die Stellung an/.test(l.karte.text) && l.knopf.aus === true && l.karte.rolle === 'status', l);
    await bild(seite, 'laedt');
    await seite.waitForSelector('.ck-karte[data-zustand="antwort"]', { timeout: 10000 });
    const k = await karte(seite);
    pruefe('Antwort-Karte: Text vom Server, Marke "KI", Hinweis "Erklärung von einer KI, kann sich irren."', k.karte && k.karte.antwort === ANTWORT
      && k.karte.marke === 'KI' && k.karte.kiText === KI_HINWEIS && k.karte.busy === 'false' && k.knopf.aus === false, k);
    pruefe('wenige Fragen frei: ruhig genannt ("Heute noch 3 Fragen.")', k.karte.rest === 'Heute noch 3 Fragen.');
    const sichtbar = await seite.evaluate(() => { const h = document.querySelector('.ck-ki-hinweis'); const r = h.getBoundingClientRect(); const s = getComputedStyle(h);
      return r.height > 8 && s.visibility === 'visible' && s.display !== 'none' && parseFloat(s.fontSize) >= 12; });
    pruefe('KI-Hinweis wirklich sichtbar (nicht versteckt, Schrift mindestens 12 px)', sichtbar);
    const q = coach[0];
    const body = JSON.parse(q.body);
    pruefe('Anfrage: POST mit Token und apikey, nur Fakten des gewaehlten Zugs', coach.length === 1 && q.methode === 'POST'
      && q.kopf.authorization === 'Bearer ' + SITZUNG.access_token && !!q.kopf.apikey && body.zug === 'c4f7' && body.besterZug === 'h5f7'
      && body.klasse === PARTIE.review.zuege[PLY_LXF7].klasse && body.eigenerZug === true && body.fen === PARTIE.review.zuege[PLY_LXF7].fenVorher
      && Object.keys(body).every((x) => ERLAUBT.includes(x)) && !q.body.includes(MAIL) && !q.body.includes(UID), body);
    pruefe('die App schickt, was der Server annimmt (pruefeEingabe)', pruefeEingabe(body).ok);
    pruefe('Texte fair', fair(await fairText(seite)), await fairText(seite));
    await bild(seite, 'antwort-ipad-quer');
    const la = await lage(seite);
    pruefe('iPad quer: nichts ragt heraus', la.ueber <= 0 && la.knopf && la.karte && la.zeile <= 0 && la.knoepfe.every(Boolean), la);
    // zuklappen, wieder aufklappen (ohne neue Frage)
    await tippe(seite, '.ck-knopf');
    const zu = await karte(seite);
    await tippe(seite, '.ck-knopf');
    await seite.waitForSelector('.ck-karte[data-zustand="antwort"]', { timeout: 5000 });
    const auf = await karte(seite);
    pruefe('zweiter Tipp klappt zu, dritter wieder auf, aus dem Merker (keine neue Frage, kein Rest-Satz)', zu.versteckt && zu.knopf.offen === 'false'
      && auf.karte && auf.karte.antwort === ANTWORT && auf.karte.rest === '' && coach.length === 1, { zu, auf, n: coach.length });
    // naechster Zug: Karte weg; zurueck: Knopf neu, Antwort erst nach dem Tipp, aus dem Merker
    await tippe(seite, '.an-navi [data-aktion="vor-zug"]');
    await warte(300);
    const weiter = await karte(seite);
    pruefe('naechster Zug: Antwort-Karte weg, neuer Knopf (Ort je Zug neu)', weiter.karte === null && !weiter.versteckt && weiter.knopf
      && (await seite.locator('.ck-karte').count()) === 0 && (await seite.locator('.ck-knopf').count()) === 1, weiter);
    await tippe(seite, '.an-navi [data-aktion="zurueck-zug"]');
    await warte(300);
    const zurueck = await karte(seite);
    await tippe(seite, '.ck-knopf');
    await seite.waitForSelector('.ck-karte[data-zustand="antwort"]', { timeout: 5000 });
    pruefe('zurueck zum Zug: Karte erst nach dem Tipp, Antwort aus dem Merker', zurueck.karte === null && coach.length === 1);
    pruefe('keine Fehler', fehler.length === 0, fehler);
    await kontext.close();
  }

  // ---------- Handy hoch, dunkel ----------
  gruppe = 'Handy';
  {
    const { kontext, seite, fehler } = await neueSeite(browser, { w: 390, h: 844, schema: 'dark', handy: true });
    await zurAnalyse(seite);
    await seite.locator('.ck-knopf').scrollIntoViewIfNeeded();
    const vorher = await lage(seite);
    pruefe('Handy: Knopfzeile mit "Variante zeigen" und "Frag den Coach" passt, nichts ragt heraus', vorher.ueber <= 0 && vorher.knopf && vorher.zeile <= 0
      && vorher.knoepfe.length >= 2 && vorher.knoepfe.every(Boolean), vorher);
    await tippe(seite, '.ck-knopf');
    await seite.waitForSelector('.ck-karte[data-zustand="antwort"]', { timeout: 10000 });
    await seite.locator('.ck-karte').scrollIntoViewIfNeeded();
    const la = await lage(seite);
    pruefe('Handy: Antwort-Karte in der Coach-Karte, keine waagrechte Scrollleiste', la.ueber <= 0 && la.karte && la.knopf, la);
    await bild(seite, 'antwort-handy-dunkel');
    pruefe('keine Fehler', fehler.length === 0, fehler);
    await kontext.close();
  }

  // ---------- iPad hoch, hell ----------
  gruppe = 'iPad hoch';
  {
    const { kontext, seite, fehler } = await neueSeite(browser, { w: 820, h: 1180 });
    await zurAnalyse(seite);
    await tippe(seite, '.ck-knopf');
    await seite.waitForSelector('.ck-karte[data-zustand="antwort"]', { timeout: 10000 });
    await seite.locator('.ck-karte').scrollIntoViewIfNeeded();
    const la = await lage(seite);
    pruefe('iPad hoch: nichts ragt heraus', la.ueber <= 0 && la.karte && la.knopf && la.zeile <= 0, la);
    await bild(seite, 'antwort-ipad-hoch');
    pruefe('keine Fehler', fehler.length === 0, fehler);
    await kontext.close();
  }

  // ---------- Fehler, Limit, offline ----------
  gruppe = 'Fehler';
  {
    const { kontext, seite, fehler, coach, srv, anfragen } = await neueSeite(browser, {});
    await zurAnalyse(seite);
    srv.coach = { status: 429, body: { fehler: 'limit', text: 'x', grenze: 30 } };
    await tippe(seite, '.ck-knopf');
    await seite.waitForSelector('.ck-karte[data-zustand="limit"]', { timeout: 10000 });
    let k = await karte(seite);
    pruefe('Tageslimit: ruhiger Satz mit der Tagesgrenze, keine Zahl, kein Kaufhinweis', k.karte.text.includes(TEXTE.limit) && !k.karte.hinweis
      && (await seite.locator('.premium-hinweis').count()) === 0, k);
    await warte(500);   // sanftes Rollen ins Bild abwarten (nur fuers Foto)
    await bild(seite, 'limit');
    srv.coach = { status: 503, body: { fehler: 'ki', text: 'x' } };
    await tippe(seite, '.ck-knopf');
    await seite.waitForSelector('.ck-karte[data-zustand="ki"]', { timeout: 10000 });
    k = await karte(seite);
    pruefe('nach einem Fehler fragt der naechste Tipp neu (nicht zuklappen): "nicht erreichbar"', k.karte.text.includes(TEXTE.ki) && coach.length === 2, coach.length);
    srv.coach = { offline: true };
    await tippe(seite, '.ck-knopf');
    await seite.waitForSelector('.ck-karte[data-zustand="offline"]', { timeout: 10000 });
    k = await karte(seite);
    pruefe('offline: ruhig "Gerade keine Verbindung"', k.karte.text.includes(TEXTE.offline));
    srv.coach = { status: 422, body: { fehler: 'abgelehnt', text: 'x' } };
    await tippe(seite, '.ck-knopf');
    await seite.waitForSelector('.ck-karte[data-zustand="abgelehnt"]', { timeout: 10000 });
    pruefe('Ablehnung der KI: "keine Erklärung", die Bewertung gilt weiter', (await karte(seite)).karte.text.includes(TEXTE.abgelehnt));
    // Klein-Befund B2: Zeitgrenze im Browser (kurz gestellt): Karte "nicht erreichbar", Knopf wieder frei
    await seite.evaluate(() => import('./js/coach-ki.js').then((m) => m.setzeCoachWartezeit(800)));
    srv.coach = { status: 200, body: { text: ANTWORT, rest: 9 }, warte: 4000 };
    await tippe(seite, '.ck-knopf');
    await seite.waitForSelector('.ck-karte[data-zustand="laedt"]', { timeout: 5000 });
    await seite.waitForSelector('.ck-karte[data-zustand="ki"]', { timeout: 5000 });
    const zk = await karte(seite);
    pruefe('Server antwortet nicht rechtzeitig: "nicht erreichbar", Knopf wieder frei, nicht mehr beschaeftigt', zk.karte.text.includes(TEXTE.ki)
      && zk.knopf.aus === false && zk.karte.busy === 'false', zk);
    await seite.evaluate(() => import('./js/coach-ki.js').then((m) => m.setzeCoachWartezeit(null)));
    // Der Server sagt "kein Trainer", obwohl der Zwischenspeicher "ja" sagte: Hinweis und neuer Abgleich
    const vorher = anfragen.filter((u) => u.includes('/rpc/ist_premium')).length;
    srv.premium = false;
    srv.coach = { status: 403, body: { fehler: 'premium', text: 'x' } };
    await tippe(seite, '.ck-knopf');
    await seite.waitForSelector('.ck-karte[data-zustand="premium"]', { timeout: 10000 });
    await warte(300);
    pruefe('Server sagt "kein Trainer": premiumHinweis und neuer Abgleich des Abo-Stands', (await karte(seite)).karte.hinweis
      && anfragen.filter((u) => u.includes('/rpc/ist_premium')).length > vorher);
    pruefe('Texte fair', fair(await fairText(seite)), await fairText(seite));
    pruefe('keine Fehler', fehler.length === 0, fehler);
    await kontext.close();
  }

  // ---------- Abo-Stand unbekannt (Klein-Befund B2) ----------
  gruppe = 'Abo-Stand unbekannt';
  {
    const { kontext, seite, fehler, coach, srv } = await neueSeite(browser, { server: { aboOffline: true } });
    await zurAnalyse(seite);
    srv.coach = { offline: true };
    await tippe(seite, '.ck-knopf');
    await seite.waitForSelector('.ck-karte[data-zustand="offline"], .ck-karte[data-zustand="premium"]', { timeout: 10000 });
    const k = await karte(seite);
    pruefe('nie geprueft und kein Netz: "Gerade keine Verbindung", kein Kaufhinweis (auch zahlende Nutzer auf einem neuen Geraet)',
      k.karte.zustand === 'offline' && k.karte.text.includes(TEXTE.offline) && !k.karte.hinweis && (await seite.locator('.premium-hinweis').count()) === 0, k);
    srv.coach = { status: 200, body: { text: ANTWORT, rest: 20 } };
    await tippe(seite, '.ck-knopf');
    await seite.waitForSelector('.ck-karte[data-zustand="antwort"]', { timeout: 10000 });
    pruefe('Stand unbekannt, Server erreichbar: der Server prueft den Trainer selbst, Antwort mit KI-Hinweis', (await karte(seite)).karte.kiText === KI_HINWEIS
      && coach.length === 2);
    srv.coach = { status: 403, body: { fehler: 'premium', text: 'x' } };
    await seite.evaluate(() => import('./js/coach-ki.js').then((m) => m.vergissAntworten()));
    await tippe(seite, '.ck-knopf');
    await tippe(seite, '.ck-knopf');
    await seite.waitForSelector('.ck-karte[data-zustand="premium"]', { timeout: 10000 });
    pruefe('Stand unbekannt, Server sagt "kein Trainer": dann der ruhige Hinweis', (await karte(seite)).karte.hinweis);
    pruefe('keine Fehler', fehler.length === 0, fehler);
    await kontext.close();
  }

  // ---------- Bewegung aus ----------
  gruppe = 'Bewegung';
  {
    const k2 = await browser.newContext({ viewport: { width: 1180, height: 820 }, reducedMotion: 'reduce' });
    const s2 = await k2.newPage();
    const f2 = [];
    s2.on('pageerror', (e) => f2.push(e.message));
    await s2.route(SUPA + '/**', (r) => {
      const u = r.request().url();
      const body = u.includes(COACH_PFAD) ? { text: ANTWORT, rest: 20 } : u.includes('/rpc/ist_premium') ? true
        : u.includes('/abos?') ? [{ status: 'aktiv', gueltig_bis: new Date(Date.now() + 86400000).toISOString(), quelle: 'manuell' }] : [];
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    });
    await s2.addInitScript((s) => { localStorage.setItem('schach-arena:konto:sichtbar', '1'); localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(s)); }, SITZUNG);
    await zurAnalyse(s2);
    await tippe(s2, '.ck-knopf');
    await s2.waitForSelector('.ck-karte[data-zustand="antwort"]', { timeout: 10000 });
    const anim = await s2.evaluate(() => document.querySelector('.ck-karte').getAnimations({ subtree: true }).filter((a) => a.playState === 'running').length);
    pruefe('weniger Bewegung: keine laufende Animation an der Karte; viele Fragen frei: kein Rest-Satz', anim === 0
      && (await karte(s2)).karte.rest === '', anim);
    pruefe('keine Fehler', f2.length === 0, f2);
    await k2.close();
  }

  gruppe = 'Netz';
  pruefe('keine Anfragen ausser an die App und den gefaelschten Supabase-Server (keine echte KI)', fremd.length === 0, fremd.slice(0, 5));
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
