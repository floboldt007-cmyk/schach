// Tests fuer die Startseite "heim" (Konzept 2026-11-06, Abschnitt 12): Buehne mit laufender Partie (Mini-Brett, Lage,
// Bewertung, Weiterspielen) oder naechstem Gegner, "Als Naechstes" (Liga-Zeile, ohne Daten weg), drei Wege (Online,
// Lernen, Zu zweit), ohne Scrollen auf dem iPad, hell und dunkel lesbar, erster Start ueber das Willkommen "start".
// Node-Teil ohne Browser, danach Browser-Teil (Playwright, Chromium oder BROWSER=webkit) gegen index.html?test.
//
//   node tests/heim.test.mjs              alles
//   node tests/heim.test.mjs --nur-node   ohne Browser
//   PORT=8972 node tests/heim.test.mjs    eigener Port (Standard 8972)
//   HEIM_BILDER=<ordner>                  legt dort Bildschirmfotos ab (iPhone, iPad hoch und quer, hell und dunkel, mit und ohne Partie)
//
// Playwright: Pfad per Umgebungsvariable PLAYWRIGHT_PFAD, sonst 'playwright' oder /opt/node-tools.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { browserTyp } from './browser.mjs';
import { neuerStand, STUFEN } from '../js/pakete/liga/wertung.js';

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

// Laufende Partie (wie storage.js speichereLaufendePartie): Italienisch nach 5 Zuegen, Weiss am Zug
const ZUEGE = ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'g8f6', 'd2d3', 'f8c5', 'c2c3', 'd7d6'];
const laufend = (extra = {}) => ({ botId: 'greta', spielerFarbe: 'w', startFen: null, zuege: ZUEGE, hinweise: 0, zuruecknahmen: 0,
  liveKlassen: [], gestartet: new Date().toISOString(), modus: 'normal', extra: {}, ...extra });

// Lage der Buehne, des Bretts, aller Knoepfe und der Leiste
const lage = (seite) => seite.evaluate(() => {
  const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { t: b.top, b: b.bottom, l: b.left, r: b.right, w: b.width }; };
  const nav = document.querySelector('.reiter-leiste');
  const navSichtbar = !!nav && !nav.hidden && getComputedStyle(nav).display !== 'none';
  const rumpf = document.querySelector('.heim-rumpf');
  return { buehne: r(document.querySelector('.heim-buehne')), brett: r(document.querySelector('.heim-mini')),
    knoepfe: [...document.querySelectorAll('.heim-rumpf button')].map(r),
    leiste: navSichtbar && document.documentElement.dataset.reiter === 'unten' ? r(nav) : null, ih: innerHeight, iw: innerWidth,
    ueber: rumpf ? rumpf.scrollHeight - rumpf.clientHeight : 0 };
});

async function testeBuehne(browser, heute) {
  gruppe = 'buehne-partie';
  {
    const { kontext, seite, fehler } = await neueSeite(browser, { w: 820, h: 1180, speicher: { ...gesehen(heute), [P + 'laufend']: laufend() } });
    const da = await istScreen(seite, 'heim');
    const b = await seite.evaluate(() => {
      const fig = (f) => document.querySelector(`.heim-brett .brett > img.figur[data-feld="${f}"]`)?.dataset.figur || '';
      const src = document.querySelector('.heim-brett .brett > img.figur')?.getAttribute('src') || '';
      return { art: document.querySelector('.heim-buehne')?.dataset.art, titel: document.querySelector('.heim-gruss h1')?.textContent.trim(),
        felder: document.querySelectorAll('.heim-brett .brett .feld').length, a8: fig('a8'), e1: fig('e1'), c4: fig('c4'),
        satz: src.slice(0, src.lastIndexOf('/') + 1), zuletzt: document.querySelectorAll('.heim-brett .lage.zuletzt').length,
        greifbar: getComputedStyle(document.querySelector('.heim-brett .brett')).pointerEvents,
        ueber: document.querySelector('.heim-ueber')?.textContent.trim(), lage: document.querySelector('.heim-lage')?.textContent.trim(),
        knopf: document.querySelector('.heim-los')?.textContent.trim() };
    });
    pruefe('laufende Partie: Buehne zeigt die Partie, "Deine Partie wartet."', da && b.art === 'partie' && b.titel === 'Deine Partie wartet.', JSON.stringify(b));
    pruefe('echtes Brett der App mit 64 Feldern und der Stellung (a8 Turm schwarz, e1 Koenig weiss, c4 Laeufer weiss)',
      b.felder === 64 && b.a8 === 'bR' && b.e1 === 'wK' && b.c4 === 'wB', JSON.stringify(b));
    pruefe('nur zum Ansehen (keine Zeiger-Ereignisse auf dem Brett)', b.greifbar === 'none', b.greifbar);
    pruefe('letzter Zug markiert (zwei Felder)', b.zuletzt === 2, String(b.zuletzt));
    pruefe('Gegner und Elo genannt, Taste Weiterspielen', /Greta/.test(b.ueber) && /Bot/.test(b.ueber) && b.knopf === 'Weiterspielen', JSON.stringify(b));
    pruefe('Satz zur Lage nennt, wer am Zug ist', /am Zug/.test(b.lage), b.lage);
    const bw = await seite.waitForFunction(() => { const x = document.querySelector('.heim-balken'); return x && !x.hidden; }, null, { timeout: 30000 }).then(() => true, () => false);
    const nach = await seite.evaluate(() => ({ lage: document.querySelector('.heim-lage')?.textContent.trim(),
      w: parseFloat(document.querySelector('.heim-balken-wert')?.style.width), zahl: document.querySelector('.heim-balken-zahl')?.textContent.trim() }));
    pruefe('nach der Engine: Bewertungsbalken sichtbar, Satz mit Lage', bw && Number.isFinite(nach.w) && nach.w > 0 && nach.w < 100
      && /^[+-]/.test(nach.zahl) && /, du bist am Zug$/.test(nach.lage), JSON.stringify(nach));
    await seite.locator('[data-aktion="heim-weiter"]').click();
    pruefe('Weiterspielen setzt die Partie fort (gegen Greta, dieselben 10 Zuege)', await istScreen(seite, 'partie')
      && await seite.waitForFunction(() => window.__partie && window.__partie.bereit === true && window.__partie.z.bot.id === 'greta'
        && window.__partie.chess().history().length === 10, null, { timeout: 20000 }).then(() => true, () => false));
    const satzPartie = await seite.evaluate(() => { const x = document.querySelector('.screen.partie .brett > img.figur')?.getAttribute('src') || ''; return x.slice(0, x.lastIndexOf('/') + 1); });
    pruefe('Startseite zeigt denselben Figurensatz wie das Partie-Brett', !!b.satz && b.satz === satzPartie, b.satz + ' / ' + satzPartie);
    pruefe('keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }
  {
    // Mit Schwarz: Brett aus Sicht von Schwarz (oben links h1, der weisse Turm)
    const { kontext, seite } = await neueSeite(browser, { speicher: { ...gesehen(heute), [P + 'laufend']: laufend({ spielerFarbe: 'b', zuege: ZUEGE.slice(0, 9) }) } });
    await istScreen(seite, 'heim');
    const b = await seite.evaluate(() => {
      const brett = document.querySelector('.heim-brett .brett');
      const h1 = brett?.querySelector('img.figur[data-feld="h1"]');
      const rb = brett?.getBoundingClientRect(), rf = h1?.getBoundingClientRect();
      return { sicht: brett?.dataset.ausrichtung, h1: h1?.dataset.figur, obenLinks: !!(rb && rf) && rf.left - rb.left < rb.width / 8 && rf.top - rb.top < rb.height / 8,
        lage: document.querySelector('.heim-lage')?.textContent.trim() };
    });
    pruefe('mit Schwarz: Brett gedreht (oben links der weisse Turm h1), "Du bist am Zug"', b.sicht === 'b' && b.h1 === 'wR' && b.obenLinks
      && b.lage.startsWith('Du bist am Zug'), JSON.stringify(b));
    await kontext.close();
  }
  {
    const { kontext, seite } = await neueSeite(browser, { speicher: { ...gesehen(heute),
      [P + 'laufend']: laufend({ modus: 'zuzweit', botId: null, zuzweit: { weiss: 'Anna', schwarz: 'Ben', drehen: false } }) } });
    await istScreen(seite, 'heim');
    const b = await seite.evaluate(() => ({ ueber: document.querySelector('.heim-ueber')?.textContent.trim(), lage: document.querySelector('.heim-lage')?.textContent.trim() }));
    pruefe('Zu zweit: "Anna gegen Ben", "Weiß am Zug"', /Anna gegen Ben/.test(b.ueber) && b.lage.startsWith('Weiß am Zug'), JSON.stringify(b));
    await seite.locator('[data-aktion="heim-weiter"]').click();
    pruefe('Zu zweit: Weiterspielen oeffnet die Partie Zu zweit', await istScreen(seite, 'partie')
      && await seite.waitForSelector('.zz-brett', { timeout: 15000 }).then(() => true, () => false));
    await kontext.close();
  }
  gruppe = 'buehne-leer';
  {
    // iPad hoch ohne Partie: "Deine Leiter" mit den drei Bots nach dem naechsten Gegner (aus BOTS, aufsteigend)
    const { kontext, seite, fehler } = await neueSeite(browser, { w: 820, h: 1180, speicher: gesehen(heute) });
    await istScreen(seite, 'heim');
    const b = await seite.evaluate(() => ({ sichtbar: !!document.querySelector('.heim-leiter')?.offsetParent,
      elo: parseInt(document.querySelector('.heim-gegner .zahl')?.textContent.replace(/\D/g, ''), 10),
      bots: [...document.querySelectorAll('.heim-leiter-bot')].map((x) => ({ name: x.querySelector('b')?.textContent.trim(),
        elo: parseInt(x.querySelector('small')?.textContent.replace(/\D/g, ''), 10), bild: !!x.querySelector('img')?.getAttribute('src') })),
      portraet: document.querySelector('.heim-portraet')?.getBoundingClientRect().width }));
    pruefe('iPad hoch, leer: Bot-Bild gross (mindestens 200 px)', b.portraet >= 200, String(b.portraet));
    pruefe('iPad hoch, leer: "Deine Leiter" mit drei Bots (Bild, Name, Staerke), staerker als der naechste Gegner und aufsteigend',
      b.sichtbar && b.bots.length === 3 && b.bots.every((x) => x.name && x.bild && x.elo > b.elo)
      && b.bots[0].elo <= b.bots[1].elo && b.bots[1].elo <= b.bots[2].elo, JSON.stringify(b));
    await seite.locator('[data-aktion="heim-leiter"]').click();
    pruefe('Deine Leiter oeffnet die Bot-Leiter (arena)', await istScreen(seite, 'arena'));
    pruefe('keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }
  {
    const { kontext, seite } = await neueSeite(browser, { speicher: gesehen(heute) });
    await istScreen(seite, 'heim');
    pruefe('Handy: "Deine Leiter" bleibt weg (kein Platz)', !(await seite.evaluate(() => !!document.querySelector('.heim-leiter')?.offsetParent)));
    await kontext.close();
  }
  {
    const { kontext, seite, fehler } = await neueSeite(browser, { speicher: gesehen(heute) });
    await istScreen(seite, 'heim');
    const b = await seite.evaluate(() => ({ art: document.querySelector('.heim-buehne')?.dataset.art, titel: document.querySelector('.heim-gruss h1')?.textContent.trim(),
      name: document.querySelector('.heim-gegner')?.textContent.trim(), bild: !!document.querySelector('.heim-portraet img'),
      satz: document.querySelector('.heim-spielweise')?.textContent.trim(), bot: document.querySelector('[data-aktion="heim-spielen"]')?.dataset.bot,
      brett: !!document.querySelector('.heim-mini'), naechstes: !!document.querySelector('.heim-naechstes') }));
    pruefe('keine Partie: naechster Gegner der Leiter mit Bild, Name, Staerke und Spielweise', b.art === 'gegner' && b.bild && /·\s*\d/.test(b.name || '')
      && !!b.satz && !!b.bot && !b.brett, JSON.stringify(b));
    pruefe('keine Partie: anderer Titel', b.titel && b.titel !== 'Deine Partie wartet.', b.titel);
    pruefe('ohne Liga-Stand: "Als Naechstes" fehlt ganz (keine leeren Platzhalter)', !b.naechstes);
    await seite.locator('[data-aktion="heim-spielen"]').click();
    pruefe('Spielen startet eine Partie gegen diesen Bot', await istScreen(seite, 'partie')
      && await seite.waitForFunction((id) => window.__partie && window.__partie.bereit === true && window.__partie.z.bot.id === id
        && window.__partie.chess().history().length === 0, b.bot, { timeout: 20000 }).then(() => true, () => false));
    pruefe('keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }
}

async function testeNaechstes(browser, heute) {
  gruppe = 'als-naechstes';
  {
    const { kontext, seite } = await neueSeite(browser, { speicher: { ...gesehen(heute), [P + 'modul:liga']: ligaMit(290) } });
    await istScreen(seite, 'heim');
    const r = await seite.evaluate(() => ({ zeilen: document.querySelectorAll('.heim-naechstes .heim-zeile').length,
      text: document.querySelector('.heim-zeile')?.textContent.replace(/\s+/g, ' ').trim(), balken: parseFloat(document.querySelector('.heim-zeile-balken span')?.style.width) }));
    pruefe('290 Punkte: eine Zeile "Silber, noch 160 Liga-Punkte bis Gold", Balken 20 %', r.zeilen === 1 && /^Silber\s*Noch 160 Liga-Punkte bis Gold/.test(r.text)
      && r.balken === 20, JSON.stringify(r));
    await seite.locator('[data-aktion="heim-liga"]').click();
    pruefe('Liga-Zeile oeffnet die Bestenliste', await istScreen(seite, 'bestenliste'));
    await kontext.close();
  }
  {
    const oben = STUFEN[STUFEN.length - 1];
    const { kontext, seite } = await neueSeite(browser, { speicher: { ...gesehen(heute), [P + 'modul:liga']: ligaMit(oben.schwelle + 50) } });
    await istScreen(seite, 'heim');
    const r = await seite.evaluate(() => document.querySelector('.heim-zeile')?.textContent.replace(/\s+/g, ' ').trim());
    pruefe('hoechste Stufe: ohne "noch", "Hoechste Stufe erreicht"', /Höchste Stufe erreicht/.test(r || '') && !/Noch/.test(r || ''), r);
    await kontext.close();
  }
  {
    const { kontext, seite } = await neueSeite(browser, { speicher: { ...gesehen(heute), [P + 'modul:liga']: { stand: 999, kaputt: true } } });
    const da = await istScreen(seite, 'heim');
    const r = await seite.evaluate(() => document.querySelector('.heim-rumpf')?.textContent || '');
    pruefe('fremder Speicherstand: kein Absturz, kein NaN', da && !/NaN|undefined/.test(r));
    await kontext.close();
  }
  gruppe = 'englisch';
  {
    const { kontext, seite } = await neueSeite(browser, { speicher: { ...gesehen(heute), [P + 'modul:liga']: ligaMit(290),
      [P + 'einstellungen']: { sprache: 'en', spracheGewaehlt: true } } });
    await istScreen(seite, 'heim');
    const r = await seite.evaluate(() => ({ zeile: document.querySelector('.heim-zeile')?.textContent.replace(/\s+/g, ' ').trim(),
      wege: [...document.querySelectorAll('.heim-modus b')].map((b) => b.textContent.trim()), titel: document.querySelector('.heim-gruss h1')?.textContent.trim() }));
    pruefe('Englisch: Liga-Zeile, Titel und Wege englisch', /160 league points to Gold/.test(r.zeile) && r.titel === 'Ready for the next game?'
      && r.wege.join() === 'Online,Learn,Two players', JSON.stringify(r));
    await kontext.close();
  }
}

async function testeWege(browser, heute) {
  gruppe = 'drei-wege';
  const { kontext, seite, fehler } = await neueSeite(browser, { speicher: gesehen(heute) });
  await istScreen(seite, 'heim');
  const k = await seite.evaluate(() => [...document.querySelectorAll('.heim-modus')].map((e) => ({ aktion: e.dataset.aktion,
    knopf: e.tagName, w: e.getBoundingClientRect().width, h: e.getBoundingClientRect().height })));
  pruefe('Reihenfolge Online, Lernen, Zu zweit', k.map((x) => x.aktion).join() === 'heim-online,heim-raetsel,heim-zuzweit', k.map((x) => x.aktion).join());
  pruefe('Wege sind Knoepfe mit mindestens 44 px', k.every((x) => x.knopf === 'BUTTON' && x.h >= 44 && x.w >= 44), JSON.stringify(k));
  pruefe('Premium-Krone im Kopf', await seite.locator('.heim-screen .haupt-kopf [data-aktion="premium"]').count() === 1);
  pruefe('Ruhe: keine roten Zahlen-Punkte, kein Countdown', await seite.evaluate(() => !document.querySelector('.heim-screen .punkt-neu, .heim-screen .badge, .heim-screen [data-countdown]')));
  await seite.locator('[data-aktion="heim-raetsel"]').click();
  pruefe('Lernen oeffnet das Training (Raetsel und Meisterschule)', await istScreen(seite, 'training'));
  await seite.goBack();
  pruefe('Zurueck: wieder heim', await istScreen(seite, 'heim'));
  await seite.locator('[data-aktion="heim-zuzweit"]').click();
  pruefe('Zu zweit oeffnet die Partie Zu zweit', await istScreen(seite, 'partie') && await seite.waitForSelector('.zz-screen', { timeout: 15000 }).then(() => true, () => false));
  await seite.goto(BASIS + '#heim');
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

async function testeGroessen(browser, heute) {
  gruppe = 'groessen';
  // iPad hoch und quer, PC: nichts scrollt, alle Knoepfe ueber der Leiste. Handy: darf scrollen, aber nichts seitlich drueber.
  for (const [w, h, ipad] of [[820, 1180, true], [1180, 820, true], [1024, 768, true], [1440, 900, true], [390, 844, false], [375, 667, false]]) {
    for (const schema of ['light', 'dark']) for (const partie of [true, false]) {
      const speicher = { ...gesehen(heute), [P + 'modul:liga']: ligaMit(290), [P + 'einstellungen']: { modus: schema === 'dark' ? 'dunkel' : 'hell' } };
      if (partie) speicher[P + 'laufend'] = laufend();
      const { kontext, seite } = await neueSeite(browser, { w, h, schema, speicher });
      await istScreen(seite, 'heim');
      await warte(700);
      const m = await lage(seite);
      const name = `${w}x${h} ${schema === 'dark' ? 'dunkel' : 'hell'} ${partie ? 'Partie' : 'leer'}`;
      if (ipad) {
        const unten = m.leiste ? m.leiste.t : m.ih;
        pruefe(`${name}: nichts scrollt, alle Knoepfe ganz sichtbar`, m.ueber <= 0 && m.knoepfe.every((x) => x.t >= 0 && x.b <= unten + 0.5 && x.r <= m.iw + 0.5),
          JSON.stringify({ ueber: m.ueber, unten, knoepfe: m.knoepfe }));
      }
      pruefe(`${name}: nichts seitlich drueber`, await seite.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth));
      if (partie) {
        const min = { 820: 520, 1180: 360, 1024: 300, 1440: 360, 390: 240, 375: 190 }[w];
        pruefe(`${name}: Brett mindestens ${min} px`, m.brett && m.brett.w >= min, String(m.brett && m.brett.w));
      }
      if (w === 820) {
        // iPad hoch: oben ausgerichtet (Gruss direkt unter dem Kopf, keine senkrechte Zentrierung)
        const oben = await seite.evaluate(() => document.querySelector('.heim-gruss').getBoundingClientRect().top);
        pruefe(`${name}: Inhalt beginnt oben (Gruss unter 140 px)`, oben < 140, String(oben));
      }
      // Lesbarkeit: Kontrast der Texte auf ihrer Flaeche (mindestens 4,5:1), auch auf der dunklen Buehne
      const schlecht = await seite.evaluate(() => {
        const rgb = (s) => (s.match(/[\d.]+/g) || []).map(Number);
        const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
        // Verlauf der Buehne: die hellere der beiden Farben zaehlt (schlechtester Fall fuer helle Schrift)
        const grund = (el) => { for (let e = el; e; e = e.parentElement) { const cs = getComputedStyle(e); const g = cs.backgroundImage.match(/rgba?\([^)]*\)/g);
          if (g && g.length) return g.map(rgb).sort((a, b) => lum(b) - lum(a))[0];
          const c = rgb(cs.backgroundColor); if (c.length >= 3 && (c[3] === undefined || c[3] > 0.5)) return c; } return [255, 255, 255]; };
        const aus = [];
        for (const el of document.querySelectorAll('.heim-screen .heim-gruss small, .heim-screen .heim-gruss h1, .heim-screen .heim-ueber, .heim-screen .heim-lage, .heim-screen .heim-gegner, .heim-screen .heim-spielweise, .heim-screen .heim-balken-zahl, .heim-screen .heim-los span, .heim-screen .heim-naechstes h3, .heim-screen .heim-zeile-text b, .heim-screen .heim-zeile-text span, .heim-screen .heim-modus b, .heim-screen .heim-text span')) {
          if (!el.textContent.trim() || el.closest('[hidden]')) continue;
          const a = lum(rgb(getComputedStyle(el).color)), b = lum(grund(el));
          const k = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
          if (k < 4.5) aus.push(el.className + ' ' + k.toFixed(2));
        }
        return aus;
      });
      pruefe(`${name}: Texte lesbar (Kontrast ab 4,5:1)`, schlecht.length === 0, schlecht.join('; '));
      if (w === 1180 || w === 1440) {
        const z = await seite.evaluate(() => { const r = (s) => { const e = document.querySelector(s); const b = e.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top }; };
          return { links: r('.heim-buehne'), rechts: r('.heim-wege') }; });
        pruefe(`${name}: zwei Spalten, Buehne links, Wege rechts`, z.links.r <= z.rechts.l, JSON.stringify(z));
      }
      const datei = { 390: 'iphone', 820: 'ipad-hoch', 1180: 'ipad-quer' }[w];
      if (datei) await bild(seite, `heim-${datei}-${schema === 'dark' ? 'dunkel' : 'hell'}-${partie ? 'partie' : 'leer'}`);
      await kontext.close();
    }
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
  await testeBuehne(browser, heute);
  await testeNaechstes(browser, heute);
  await testeWege(browser, heute);
  await testeGroessen(browser, heute);
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
