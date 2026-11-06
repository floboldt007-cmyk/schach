// Tests fuer die Startseite "heim" (Etappe A, Task 3): Rang-Ring, drei Modus-Karten (Online, Bots, Raetsel), ohne
// Scrollen auf dem kleinen Handy, erster Start ueber das Willkommen "start". Seit Etappe B, Task 7 zeigt der Ring Kronen
// und Liga-Stufe (kronenLage), ohne Konto den Hinweis zum Konto, offline den zuletzt gemerkten Stand.
// Node-Teil ohne Browser, danach Browser-Teil (Playwright, Chromium oder BROWSER=webkit) gegen index.html?test.
//
//   node tests/heim.test.mjs              alles
//   node tests/heim.test.mjs --nur-node   ohne Browser
//   PORT=8972 node tests/heim.test.mjs    eigener Port (Standard 8972)
//   HEIM_BILDER=<ordner>                  legt dort Bildschirmfotos ab (390x844 hell und dunkel, 1180x820, 1440x900 hell und dunkel, Kronen mit und ohne Konto)
//
// Playwright: Pfad per Umgebungsvariable PLAYWRIGHT_PFAD, sonst 'playwright' oder /opt/node-tools.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { browserTyp } from './browser.mjs';
import { neuerStand } from '../js/pakete/liga/wertung.js';

const require = createRequire(import.meta.url);
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8972);
const BASIS = `http://127.0.0.1:${PORT}/index.html?test`;
const NUR_NODE = process.argv.includes('--nur-node');
const BILDER = process.env.HEIM_BILDER || '';
const P = 'schach-arena:v1:';
const lies = (d) => readFileSync(path.join(WURZEL, d), 'utf8');
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

const ergebnisse = [];
let gruppe = '';
function pruefe(name, ok, detail = '') {
  ergebnisse.push({ name: (gruppe ? gruppe + ': ' : '') + name, ok: !!ok, detail });
  console.log(`${ok ? 'ok  ' : 'FEHLER'} ${gruppe ? gruppe + ': ' : ''}${name}${!ok && detail ? ' (' + detail + ')' : ''}`);
}

// Liga-Stand mit einem bestimmten Punktestand der laufenden Saison (wie ihn das Paket liga speichert)
function ligaMit(punkte) {
  const st = neuerStand(new Date());
  st.saison.punkte = punkte;
  return st;
}

// =====================================================================
// Node-Teil
// =====================================================================
function nodeTeil() {
  gruppe = 'Dateien';
  pruefe('js/ui/heim.js und css/heim.css vorhanden', existsSync(path.join(WURZEL, 'js/ui/heim.js')) && existsSync(path.join(WURZEL, 'css/heim.css')));
  if (!existsSync(path.join(WURZEL, 'css/heim.css'))) return;
  const css = lies('css/heim.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const hex = css.match(/#[0-9a-fA-F]{3,8}\b|rgba?\(/g) || [];
  pruefe('css/heim.css: nur Tokens (keine festen Farben)', hex.length === 0, hex.join(' '));
  pruefe('css/heim.css: Bewegung nur ueber --tempo (Dauer-Tokens)', !/transition[^;]*\d+m?s/.test(css) && !/animation[^;]*\d+m?s/.test(css));
  pruefe('index.html bindet css/heim.css ein', /<link rel="stylesheet" href="css\/heim\.css">/.test(lies('index.html')));
  const sw = lies('sw.js');
  pruefe('sw.js: heim.js und heim.css im Cache', sw.includes("'js/ui/heim.js'") && sw.includes("'css/heim.css'"));
  const app = lies('js/app.js');
  pruefe('app.js: Screen heim registriert', /const SCREENS = \[[^\]]*'heim'/.test(app));
  const heim = lies('js/ui/heim.js');
  pruefe('keine Preise oder Euro-Betraege in heim.js', !/€|\beuro\b|\d+,\d\d\s*(€|eur)/i.test(heim));
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

async function warteAufServer(url, ms = 15000) {
  const ende = Date.now() + ms;
  while (Date.now() < ende) {
    try { const r = await fetch(url); await r.arrayBuffer(); if (r.ok) return; } catch (e) { /* noch nicht da */ }
    await warte(150);
  }
  throw new Error('Server startet nicht: ' + url);
}

// Neue Seite mit vorbereitetem Speicher: liga (Punkte), gesehen (Willkommen schon da, sonst frisch)
async function neueSeite(browser, { w = 390, h = 844, schema = 'light', speicher = {}, hash = '#heim' } = {}) {
  const kontext = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: schema, deviceScaleFactor: 1,
    hasTouch: true, serviceWorkers: 'block' });
  const seite = await kontext.newPage();
  const fehler = [];
  // WebKit meldet einen beim Neuladen abgebrochenen Abruf der eigenen Seite (z. B. ein Klang) als "... due to access
  // control checks." (wie tests/e2e.test.mjs): kein Fehler; Abrufe anderer Adressen bleiben einer
  seite.on('pageerror', (e) => {
    if (/ due to access control checks\.?$/.test(e.message) && e.message.includes(`127.0.0.1:${PORT}/`)) return;
    fehler.push('pageerror: ' + e.message);
  });
  seite.on('console', (m) => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) fehler.push('console: ' + m.text()); });
  await seite.addInitScript(({ speicher }) => {
    try {
      if (sessionStorage.getItem('heim-probe')) return;
      sessionStorage.setItem('heim-probe', '1');
      localStorage.clear();
      for (const [k, v] of Object.entries(speicher)) localStorage.setItem(k, JSON.stringify(v));
    } catch (e) { /* egal */ }
  }, { speicher });
  await seite.goto(BASIS + hash);
  return { kontext, seite, fehler };
}

const istScreen = (seite, name) => seite.waitForFunction((n) => document.documentElement.dataset.screen === n
  && !!document.querySelector('#app > .screen:not(.lade-screen)'), name, { timeout: 20000 }).then(() => true, () => false);
const gesehen = (heute) => ({ [P + 'modul:start']: { gesehen: heute } });
const bild = async (seite, name) => {
  if (!BILDER) return;
  mkdirSync(BILDER, { recursive: true });
  await warte(800);
  await seite.screenshot({ path: path.join(BILDER, name + '.png') });
};

// Lage des Rings, der Karten und der Leiste
const lage = (seite) => seite.evaluate(() => {
  const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { t: b.top, b: b.bottom, l: b.left, r: b.right }; };
  const nav = document.querySelector('.reiter-leiste');
  const navSichtbar = !!nav && !nav.hidden && getComputedStyle(nav).display !== 'none';
  return { ring: r(document.querySelector('.heim-ring')), karten: [...document.querySelectorAll('.heim-modus')].map(r),
    leiste: navSichtbar && document.documentElement.dataset.reiter === 'unten' ? r(nav) : null, ih: innerHeight, iw: innerWidth,
    scroll: document.querySelector('.heim-rumpf') ? document.querySelector('.heim-rumpf').scrollTop : 0 };
});

// Angemeldete Seite (Etappe B, Task 7): Supabase-Abrufe abgefangen; kronen_mein_stand liefert stand, bei 'offline' bricht
// der Abruf ab. speicher wie bei neueSeite.
const SUPA = 'https://usaamcqypmvgqmsbfecb.supabase.co';
const UID = '0f8b6c1e-2d3a-4b5c-8d9e-0a1b2c3d4e5f';
const SITZUNG = { access_token: 'a.' + Buffer.from(JSON.stringify({ sub: UID })).toString('base64url') + '.x', refresh_token: 'r1',
  expires_at: 9999999999, user: { id: UID, email: 'probe@example.invalid' } };
async function kontoSeite(browser, { stand = null, speicher = {}, w = 390, h = 844, schema = 'light' } = {}) {
  const kontext = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: schema, deviceScaleFactor: 1, hasTouch: true, serviceWorkers: 'block' });
  const seite = await kontext.newPage();
  const fehler = [];
  seite.on('pageerror', (e) => fehler.push('pageerror: ' + e.message));
  // ein absichtlich abgebrochener Abruf meldet der Browser selbst als Ladefehler: kein Fehler der App
  seite.on('console', (m) => { if (m.type() === 'error' && !/favicon|404|Failed to load resource|ERR_FAILED|Load failed/.test(m.text())) fehler.push('console: ' + m.text()); });
  await seite.route(SUPA + '/**', (r) => {
    if (r.request().url().includes('/rpc/kronen_mein_stand')) {
      if (stand === 'offline') return r.abort('failed');
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(stand) });
    }
    return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  await seite.addInitScript(({ sitzung, speicher }) => {
    if (sessionStorage.getItem('heim-probe')) return;
    sessionStorage.setItem('heim-probe', '1');
    localStorage.clear();
    localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(sitzung));
    for (const [k, v] of Object.entries(speicher)) localStorage.setItem(k, JSON.stringify(v));
  }, { sitzung: SITZUNG, speicher });
  await seite.goto(BASIS + '#heim');
  return { kontext, seite, fehler };
}
const ringText = (seite) => seite.evaluate(() => ({ ring: document.querySelector('.heim-ring')?.textContent.replace(/\s+/g, ' ').trim(),
  zahl: document.querySelector('.heim-ring .heim-zahl')?.textContent.trim(), liga: document.querySelector('.heim-liga')?.textContent.replace(/\s+/g, ' ').trim(),
  voll: Number(document.querySelector('.heim-ring')?.dataset.anteil), bogen: document.querySelector('.heim-ring .heim-bogen')?.getAttribute('stroke-dashoffset'),
  aria: document.querySelector('.heim-ring')?.getAttribute('aria-label'), link: document.querySelector('.heim-liga a')?.getAttribute('href') || null,
  krone: !!document.querySelector('.heim-ring .heim-einheit svg') }));
const ohneUnsinn = (r) => !/NaN|undefined|null/.test(JSON.stringify({ ring: r.ring, liga: r.liga, aria: r.aria }));
// wartet, bis die Ring-Zahl einen Wert zeigt (der Server-Stand kommt nach dem ersten Zeichnen)
const warteZahl = (seite, wert) => seite.waitForFunction((w) => document.querySelector('.heim-ring .heim-zahl')?.textContent.trim() === w, wert, { timeout: 8000 })
  .then(() => true, () => false);

async function testeKronenLage(browser) {
  gruppe = 'kronenLage';
  const { kontext, seite } = await neueSeite(browser, { hash: '#einstellungen' });
  await seite.waitForFunction(() => !!window.__app, null, { timeout: 20000 });
  const r = await seite.evaluate(async () => {
    const { kronenLage } = await import('/js/ui/heim.js');
    return { leer: kronenLage(null), oben: kronenLage({ kronen: 1750, stufe: 17 }), silber: kronenLage({ saison: 1, kronen: 640, stufe: 6, boden: 600, naechste: 700 }),
      kaputt: kronenLage({ kronen: 'x' }), liste: kronenLage([]), minus: kronenLage({ kronen: -40 }) };
  });
  const l = r.leer;
  pruefe('kronenLage(null): 0, Holz III, ohne Konto, Anteil 0', l.kronen === 0 && l.stufe === 0 && l.liga === 'holz' && l.rang === 3 && l.ohneKonto === true && l.anteil === 0, JSON.stringify(l));
  pruefe('kronenLage(1750): hoechste Stufe, naechste null, Anteil 1', r.oben.naechste === null && r.oben.anteil === 1 && r.oben.stufe === 17 && r.oben.ohneKonto === false, JSON.stringify(r.oben));
  const s = r.silber;
  pruefe('kronenLage(640): Silber III, noch 60, Anteil 0,4', s.kronen === 640 && s.stufe === 6 && s.liga === 'silber' && s.rang === 3 && s.naechste === 700 && s.fehlt === 60
    && Math.abs(s.anteil - 0.4) < 1e-9 && s.ohneKonto === false, JSON.stringify(s));
  pruefe('kronenLage mit Unsinn (Text, Liste, negativ): 0 und Holz III, aber mit Konto', [r.kaputt, r.liste, r.minus].every((x) => x.kronen === 0 && x.stufe === 0 && x.ohneKonto === false),
    JSON.stringify([r.kaputt, r.liste, r.minus]));
  await kontext.close();
}

async function testeRing(browser, heute) {
  gruppe = 'ohne-konto';
  {
    const { kontext, seite, fehler } = await neueSeite(browser, { speicher: { ...gesehen(heute), [P + 'modul:liga']: ligaMit(290) } });
    const da = await istScreen(seite, 'heim');
    const r = await ringText(seite);
    pruefe('Ring zeigt 0 Kronen und Holz III (Liga-Punkte der Arena zaehlen nicht)', da && r.zahl === '0' && /Holz III/.test(r.ring), JSON.stringify(r));
    pruefe('Kronen-Symbol im Ring', r.krone);
    pruefe('Hinweis "Konto anlegen und Kronen sammeln" fuehrt zu #einstellungen/konto', r.liga === 'Konto anlegen und Kronen sammeln' && r.link === '#einstellungen/konto', JSON.stringify(r));
    pruefe('kein NaN, undefined oder null, Bogen ist eine Zahl', ohneUnsinn(r) && Number.isFinite(Number(r.bogen)), JSON.stringify(r));
    await seite.locator('.heim-liga a').click();
    pruefe('Klick auf den Hinweis oeffnet die Einstellungen (Konto)', await istScreen(seite, 'einstellungen') && await seite.evaluate(() => location.hash) === '#einstellungen/konto');
    pruefe('keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }
  gruppe = 'mit-konto';
  {
    const { kontext, seite, fehler } = await kontoSeite(browser, { stand: { saison: 1, kronen: 640, stufe: 6, boden: 600, naechste: 700 }, speicher: gesehen(heute) });
    await istScreen(seite, 'heim');
    const da = await warteZahl(seite, '640');
    const r = await ringText(seite);
    pruefe('Server-Stand 640: Ring zeigt 640 und Silber III', da && /640/.test(r.ring) && /Silber III/.test(r.ring), JSON.stringify(r));
    pruefe('Zeile "noch 60 bis Silber II", kein Konto-Hinweis', r.liga === 'noch 60 bis Silber II' && r.link === null, JSON.stringify(r));
    pruefe('Ring zu 40 % gefuellt', Math.abs(r.voll - 0.4) < 1e-9, String(r.voll));
    pruefe('kein NaN, undefined oder null', ohneUnsinn(r), JSON.stringify(r));
    const gemerkt = await seite.evaluate(() => JSON.parse(localStorage.getItem('schach-arena:v1:modul:kronen') || 'null'));
    pruefe('Stand gemerkt (Modul kronen, mit Konto, startGemeldet unberuehrt)', gemerkt && gemerkt.konto === UID && gemerkt.stand && gemerkt.stand.kronen === 640 && gemerkt.startGemeldet === false,
      JSON.stringify(gemerkt));
    pruefe('keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }
  {
    const { kontext, seite } = await kontoSeite(browser, { stand: { saison: 1, kronen: 1760, stufe: 17, boden: 1500, naechste: null }, speicher: gesehen(heute) });
    await istScreen(seite, 'heim');
    const da = await warteZahl(seite, '1.760');
    const r = await ringText(seite);
    pruefe('hoechste Stufe: 1.760, Krone I, "Höchste Stufe", Ring voll', da && /Krone I\b/.test(r.ring) && r.liga === 'Höchste Stufe' && r.voll === 1, JSON.stringify(r));
    await kontext.close();
  }
  gruppe = 'offline';
  {
    const gemerkt = { [P + 'modul:kronen']: { konto: UID, stand: { saison: 1, kronen: 1250, stufe: 12, boden: 1200, naechste: 1300 }, startGemeldet: false } };
    const { kontext, seite, fehler } = await kontoSeite(browser, { stand: 'offline', speicher: { ...gesehen(heute), ...gemerkt } });
    await istScreen(seite, 'heim');
    await warte(1200);
    const r = await ringText(seite);
    pruefe('offline: letzter gemerkter Stand 1250 (als "1.250"), Diamant III', r.zahl === '1.250' && /Diamant III/.test(r.ring) && r.liga === 'noch 50 bis Diamant II', JSON.stringify(r));
    pruefe('offline: keine Fehler der App', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }
  {
    const fremd = { [P + 'modul:kronen']: { konto: 'anderes-konto', stand: { kronen: 900 }, startGemeldet: false } };
    const { kontext, seite } = await kontoSeite(browser, { stand: 'offline', speicher: { ...gesehen(heute), ...fremd } });
    await istScreen(seite, 'heim');
    await warte(1200);
    const r = await ringText(seite);
    pruefe('offline mit Stand eines anderen Kontos: 0 und Holz III, kein Konto-Hinweis', r.zahl === '0' && /Holz III/.test(r.ring) && r.link === null, JSON.stringify(r));
    await kontext.close();
  }
  {
    // erst den gemerkten Stand, dann der Server-Stand
    const gemerkt = { [P + 'modul:kronen']: { konto: UID, stand: { kronen: 300 }, startGemeldet: true } };
    const { kontext, seite } = await kontoSeite(browser, { stand: { saison: 1, kronen: 330, stufe: 3, boden: 300, naechste: 400 }, speicher: { ...gesehen(heute), ...gemerkt } });
    await istScreen(seite, 'heim');
    const da = await warteZahl(seite, '330');
    const neu = await seite.evaluate(() => JSON.parse(localStorage.getItem('schach-arena:v1:modul:kronen') || 'null'));
    pruefe('gemerkter Stand wird durch den Server-Stand ersetzt, startGemeldet bleibt erhalten', da && neu && neu.stand.kronen === 330 && neu.startGemeldet === true, JSON.stringify(neu));
    await kontext.close();
  }
  gruppe = 'englisch';
  {
    const { kontext, seite } = await neueSeite(browser, { speicher: { ...gesehen(heute), [P + 'einstellungen']: { sprache: 'en', spracheGewaehlt: true } } });
    await istScreen(seite, 'heim');
    const r = await ringText(seite);
    const karten = await seite.evaluate(() => [...document.querySelectorAll('.heim-modus b')].map((b) => b.textContent.trim()));
    pruefe('Englisch ohne Konto: "Wood III" und "Create an account and collect crowns"', /Wood III/.test(r.ring) && r.liga === 'Create an account and collect crowns', JSON.stringify(r));
    pruefe('Englisch: englische Karten', karten.length === 3 && !karten.some((k) => /[äöüß]|spielen|besiegen/i.test(k)), JSON.stringify(karten));
    await kontext.close();
  }
  {
    const { kontext, seite } = await kontoSeite(browser, { stand: { saison: 1, kronen: 640, stufe: 6, boden: 600, naechste: 700 },
      speicher: { ...gesehen(heute), [P + 'einstellungen']: { sprache: 'en', spracheGewaehlt: true } } });
    await istScreen(seite, 'heim');
    await warteZahl(seite, '640');
    const r = await ringText(seite);
    pruefe('Englisch mit Konto: "Silver III", "60 to Silver II"', /Silver III/.test(r.ring) && r.liga === '60 to Silver II', JSON.stringify(r));
    await kontext.close();
  }
}

async function bilderKronen(browser, heute) {
  if (!BILDER) return;
  const a = await neueSeite(browser, { speicher: gesehen(heute) });
  await istScreen(a.seite, 'heim');
  await bild(a.seite, 'heim-kronen-390x844-hell-ohne-konto');
  await a.kontext.close();
  const b = await kontoSeite(browser, { stand: { saison: 1, kronen: 640, stufe: 6, boden: 600, naechste: 700 }, speicher: gesehen(heute) });
  await istScreen(b.seite, 'heim');
  await warteZahl(b.seite, '640');
  await bild(b.seite, 'heim-kronen-390x844-hell-mit-konto');
  await b.kontext.close();
}

async function testeKarten(browser, heute) {
  gruppe = 'drei-karten';
  const { kontext, seite, fehler } = await neueSeite(browser, { speicher: gesehen(heute) });
  await istScreen(seite, 'heim');
  const k = await seite.evaluate(() => [...document.querySelectorAll('.heim-modus')].map((e) => ({ aktion: e.dataset.aktion, haupt: e.classList.contains('haupt'),
    knopf: e.tagName, w: e.getBoundingClientRect().width, h: e.getBoundingClientRect().height })));
  pruefe('genau drei .heim-modus, die erste mit Klasse haupt', k.length === 3 && k[0].haupt && !k[1].haupt && !k[2].haupt, JSON.stringify(k));
  pruefe('Reihenfolge Online, Bots, Raetsel', k.map((x) => x.aktion).join() === 'heim-online,heim-bots,heim-raetsel', k.map((x) => x.aktion).join());
  pruefe('Karten sind Knoepfe mit mindestens 44 px', k.every((x) => x.knopf === 'BUTTON' && x.h >= 44 && x.w >= 44), JSON.stringify(k));
  pruefe('Shop-Zeile in dieser Etappe ausgeblendet', await seite.evaluate(() => { const s = document.querySelector('.heim-shop'); return !s || s.hidden; }));
  pruefe('Premium-Krone im Kopf', await seite.locator('.heim-screen .haupt-kopf [data-aktion="premium"]').count() === 1);
  const wer = await seite.evaluate(() => { const n = document.querySelector('.heim-name'), l = document.querySelector('.heim-level');
    const sicht = (e) => !!e && e.getBoundingClientRect().width > 0 && getComputedStyle(e).visibility !== 'hidden';
    return { name: n?.textContent.trim(), level: l?.textContent.trim(), sicht: sicht(n) && sicht(l) }; });
  pruefe('Name und Level sichtbar (ohne Konto "Du", "Level 1")', wer.sicht && wer.name === 'Du' && wer.level === 'Level 1', JSON.stringify(wer));

  gruppe = 'karten-ziele';
  await seite.locator('[data-aktion="heim-bots"]').click();
  pruefe('Bots besiegen oeffnet die Arena', await istScreen(seite, 'arena'));
  await seite.goBack();
  pruefe('Zurueck aus der Arena: wieder heim', await istScreen(seite, 'heim'));
  await seite.locator('[data-aktion="heim-raetsel"]').click();
  pruefe('Raetsel oeffnet das Raetsel-Training', await istScreen(seite, 'training'));
  await seite.goBack();
  await istScreen(seite, 'heim');
  await seite.locator('[data-aktion="heim-online"]').click();
  pruefe('Online ohne Freischaltung (kein Labor) oeffnet das Link-Duell', await istScreen(seite, 'online'));
  pruefe('keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
  await kontext.close();

  // Mit Freischaltung (Erfinder, wie tests/lobby.test.mjs): Online-Lobby
  const SUPA = 'https://usaamcqypmvgqmsbfecb.supabase.co';
  const UID = '0f8b6c1e-2d3a-4b5c-8d9e-0a1b2c3d4e5f';
  const token = 'a.' + Buffer.from(JSON.stringify({ sub: UID })).toString('base64url') + '.x';
  const sitzung = { access_token: token, refresh_token: 'r1', expires_at: 9999999999, user: { id: UID, email: 'probe@example.invalid' } };
  const k2 = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', hasTouch: true });
  const s2 = await k2.newPage();
  await s2.route(SUPA + '/**', (r) => r.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify(r.request().url().includes('sonderstuecke') ? [{ stueck_id: 'erfinder-titel' }] : []) }));
  await s2.addInitScript(({ sitzung, uid, start }) => {
    if (sessionStorage.getItem('heim-probe')) return;
    sessionStorage.setItem('heim-probe', '1');
    localStorage.clear();
    localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(sitzung));
    localStorage.setItem('schach-arena:konto:sonderstuecke', JSON.stringify({ konto: uid, ids: ['erfinder-titel'] }));
    for (const [k, v] of Object.entries(start)) localStorage.setItem(k, JSON.stringify(v));
  }, { sitzung, uid: UID, start: gesehen(heute) });
  await s2.goto(BASIS + '#heim');
  await istScreen(s2, 'heim');
  await s2.locator('[data-aktion="heim-online"]').click();
  pruefe('Online mit Freischaltung oeffnet die Online-Lobby', await istScreen(s2, 'lobby'));
  await k2.close();
}

async function testeOhneScrollen(browser, heute) {
  gruppe = 'ohne-scrollen';
  for (const [w, h, schema] of [[375, 667, 'light'], [375, 667, 'dark'], [390, 844, 'light'], [390, 844, 'dark'], [1180, 820, 'light'], [1440, 900, 'light'],
    [1440, 900, 'dark'], [1000, 590, 'light']]) {
    const { kontext, seite } = await neueSeite(browser, { w, h, schema, speicher: { ...gesehen(heute), [P + 'modul:liga']: ligaMit(290) } });
    await istScreen(seite, 'heim');
    await warte(700);
    const m = await lage(seite);
    const unten = m.leiste ? m.leiste.t : m.ih;
    const alle = [m.ring, ...m.karten];
    const ok = alle.length === 4 && alle.every((x) => x && x.t >= 0 && x.b <= unten + 0.5 && x.l >= 0 && x.r <= m.iw + 0.5);
    pruefe(`${w}x${h} ${schema}: Ring und drei Karten ganz sichtbar ueber der Leiste`, ok, JSON.stringify({ unten, alle }));
    pruefe(`${w}x${h} ${schema}: nichts seitlich drueber`, await seite.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth));
    // Lesbarkeit: Kontrast der Texte auf ihrer Flaeche (mindestens 4,5:1)
    const schlecht = await seite.evaluate(() => {
      const rgb = (s) => (s.match(/[\d.]+/g) || []).map(Number);
      const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
      const grund = (el) => { for (let e = el; e; e = e.parentElement) { const c = rgb(getComputedStyle(e).backgroundColor); if (c.length >= 3 && (c[3] === undefined || c[3] > 0.5)) return c; } return [255, 255, 255]; };
      const aus = [];
      for (const el of document.querySelectorAll('.heim-screen .heim-zahl, .heim-screen .heim-liga, .heim-screen .heim-modus b, .heim-screen .heim-modus span, .heim-screen .heim-name, .heim-screen .heim-level, .heim-screen .heim-einheit, .heim-screen .heim-liga a')) {
        if (!el.textContent.trim() || el.closest('[hidden]')) continue;
        const a = lum(rgb(getComputedStyle(el).color)), b = lum(grund(el));
        const k = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        if (k < 4.5) aus.push(el.className + ' ' + k.toFixed(2));
      }
      return aus;
    });
    pruefe(`${w}x${h} ${schema}: Texte lesbar (Kontrast ab 4,5:1)`, schlecht.length === 0, schlecht.join('; '));
    if (w >= 1021 && w > h) {
      // ab 1021 px quer zwei Spalten wie im Entwurf ipad-pc-v2: Ring links, Karten rechts, alles rechts der Seitenleiste
      const z = await seite.evaluate(() => {
        const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom }; };
        return { seite: document.documentElement.dataset.reiter, nav: r('.reiter-leiste'), ring: r('.heim-ring'), karte: r('.heim-modus'), letzte: r('.heim-modus:last-of-type') };
      });
      pruefe(`${w}x${h} ${schema}: zwei Spalten, Ring links neben den Karten, rechts der Seitenleiste`, z.seite === 'seite' && !!z.ring && !!z.karte
        && z.ring.r <= z.karte.l && z.ring.l >= z.nav.r && z.ring.t < z.letzte.b && z.ring.b > z.karte.t, JSON.stringify(z));
    }
    if (w === 390 && h === 844) await bild(seite, `heim-390x844-${schema === 'dark' ? 'dunkel' : 'hell'}`);
    if (w === 1180) await bild(seite, 'heim-1180x820-hell');
    if (w === 1440) await bild(seite, `heim-1440x900-${schema === 'dark' ? 'dunkel' : 'hell'}`);
    if (w === 1000) await bild(seite, 'heim-1000x590-hell');
    await kontext.close();
  }
}

async function testeErsterStart(browser) {
  gruppe = 'erster-start';
  const { kontext, seite, fehler } = await neueSeite(browser, { hash: '' });
  pruefe('frischer Speicher ohne Hash: zuerst das Willkommen start', await istScreen(seite, 'start'));
  await seite.locator('.st-raus').click();
  pruefe('nach "Einführung überspringen": heim (nicht die Arena)', await istScreen(seite, 'heim') && await seite.evaluate(() => location.hash) === '#heim');
  await seite.goto(BASIS);
  pruefe('zweiter Start ohne Hash: heim, kein Willkommen', await istScreen(seite, 'heim') && await seite.evaluate(() => !document.querySelector('.st-screen')));
  pruefe('keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
  await kontext.close();
}

async function browserTeil(browser) {
  // Tag des Willkommens wie im Paket start (Grenze 4:00) aus der App selbst
  const { kontext, seite } = await neueSeite(browser, { hash: '#einstellungen' });
  await seite.waitForFunction(() => !!window.__app, null, { timeout: 20000 });
  const heute = await seite.evaluate(async () => (await import('/js/tag.js')).tagSchluessel());
  await kontext.close();
  await testeKronenLage(browser);
  await testeRing(browser, heute);
  await bilderKronen(browser, heute);
  await testeKarten(browser, heute);
  await testeOhneScrollen(browser, heute);
  await testeErsterStart(browser);
}

async function main() {
  nodeTeil();
  if (!NUR_NODE) {
    gruppe = 'Browser';
    let server = null;
    let browser = null;
    try {
      const pw = ladePlaywright();
      server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: WURZEL, stdio: 'ignore' });
      await warteAufServer(`http://127.0.0.1:${PORT}/index.html`);
      browser = await browserTyp(pw).launch();
      await browserTeil(browser);
    } catch (e) {
      pruefe('Browser-Teil lief ohne Ausnahme', false, String(e && e.stack || e));
    } finally {
      if (browser) await browser.close().catch(() => {});
      if (server) server.kill();
    }
  }
  const gut = ergebnisse.filter((e) => e.ok).length;
  console.log(`\n${gut}/${ergebnisse.length} bestanden`);
  process.exit(gut === ergebnisse.length ? 0 : 1);
}

main();
