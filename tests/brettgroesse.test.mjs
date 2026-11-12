// Brettgroesse (Flo 06.11.2026: "das Schachbrett ist viel zu klein, bei der Analyse auch"): misst die Breite des
// Bretts in Analyse und Partie in den Groessen aus ansicht.test.mjs und vergleicht sie mit festen Untergrenzen.
// Die Grenzen stehen im Plan docs/superpowers/plans/2026-11-06-etappe-a-brett-und-start.md (Task 1 und 2).
//
//   node tests/brettgroesse.test.mjs                 alles
//   BROWSER=webkit node tests/brettgroesse.test.mjs  mit Safari-Engine
//   PORT=8963 node tests/brettgroesse.test.mjs       eigener Port (Standard 8963)
import { spawn } from 'node:child_process';
import http from 'node:http';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { browserTyp } from './browser.mjs';

// Dieselben Groessen wie GROESSEN in ansicht.test.mjs (nicht importiert: der Import wuerde jene Suite mitstarten)
const GROESSEN = [['handy-klein', 375, 667], ['handy', 390, 844], ['handy-quer', 667, 375], ['ipad-hoch', 820, 1180], ['ipad-quer', 1180, 820],
  ['ipad-browser', 1000, 590], ['pc', 1440, 900]];

const require = createRequire(import.meta.url);
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8963);
const BASIS = `http://127.0.0.1:${PORT}/index.html?test`;
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

// Mindestbreite des Bretts in Pixeln je Groesse (Name aus GROESSEN)
const ANALYSE_MIN = { 'handy-klein': 360, handy: 386, 'ipad-hoch': 760, 'ipad-quer': 680, 'ipad-browser': 470, pc: 700 };
const PARTIE_MIN = { handy: 384, 'ipad-hoch': 780, 'ipad-quer': 720, 'ipad-browser': 500, pc: 760 };
// Zu zweit (Flo 07.11.2026: "Das ganze Bild kann das Schachbrett sein"), vorher 343 / 358 / 266 / 672 / 512 / 282 / 592 px.
// Gemessen nach dem Umbau 323 / 390 / 281 / 780 / 724 / 494 / 804 px. Dazu: kein Knopf ausserhalb des Fensters, nichts scrollt.
const ZUZWEIT_MIN = { 'handy-klein': 315, handy: 386, 'handy-quer': 275, 'ipad-hoch': 770, 'ipad-quer': 715, 'ipad-browser': 485, pc: 790 };
const ZUZWEIT = { modus: 'zuzweit', zuzweit: { weiss: 'Anna', schwarz: 'Ben', drehen: false } };
const UHR = { grund: 600, zuschlag: 0 };

// Knoepfe ganz im Fenster? Und scrollt der Rumpf (Zu zweit .zz-rumpf) oder die Seite?
const knoepfeImBild = (s, knopf, rumpf) => s.evaluate(({ knopf, rumpf }) => {
  const kn = [...document.querySelectorAll(knopf)].filter((e) => e.offsetParent).map((e) => e.getBoundingClientRect());
  const r = rumpf && document.querySelector(rumpf);
  return { knoepfe: kn.length, raus: kn.filter((b) => b.top < 0 || b.bottom > innerHeight + 0.5 || b.right > innerWidth + 0.5).length,
    scrollt: (r ? r.scrollHeight - r.clientHeight : 0) + (document.documentElement.scrollHeight - innerHeight) };
}, { knopf, rumpf });

function ladePlaywright() {
  for (const k of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
    try { return require(k); } catch (e) { /* naechster */ }
  }
  throw new Error('Playwright nicht gefunden (PLAYWRIGHT_PFAD setzen)');
}
// node:http statt fetch: undici (Node 24) bricht an der Antwort von python -m http.server mit assert(!this.paused) ab
const antwortetOk = (url) => new Promise((ok) => {
  http.get(url, (r) => { r.resume(); ok(r.statusCode === 200); }).on('error', () => ok(false));
});
async function warteAufServer(url, ms = 10000) {
  const ende = Date.now() + ms;
  while (Date.now() < ende) {
    if (await antwortetOk(url)) return;
    await warte(150);
  }
  throw new Error('Server startet nicht: ' + url);
}
const ergebnisse = [];
function pruefe(name, ok, detail = '') {
  ergebnisse.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'ok  ' : 'FEHLER'} ${name}${detail ? ' (' + detail + ')' : ''}`);
}

// Eine kurze Partie einmal mit echter Analyse rechnen, danach in jeder Groesse nur speichern
async function rechnePartie(browser) {
  const k = await browser.newContext({ serviceWorkers: 'block' });
  const s = await k.newPage();
  await s.goto(BASIS + '#arena');
  await s.waitForFunction(() => window.__app && typeof window.__app.engine === 'function', null, { timeout: 30000 });
  const d = await s.evaluate(async () => {
    const { Chess } = await import('./vendor/chess/chess.js');
    const { analysierePartie } = await import('./js/review.js');
    const { botNachId } = await import('./js/bots.js');
    const c = new Chess();
    const zuege = []; const san = [];
    for (const z of ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5']) { const m = c.move(z); zuege.push(m.lan); san.push(m.san); }
    const bot = botNachId('benno');
    const engine = await window.__app.engine('bewertung');
    const review = await analysierePartie(engine, zuege, { tiefe: 8, multipv: 1, spielerFarbe: 'w', elo: { b: bot.elo } });
    const partie = { id: 'pbrettgroesse1', datum: new Date(Date.now() - 3600e3).toISOString(), botId: 'benno', botStufe: bot.stufe,
      spielerFarbe: 'w', startFen: new Chess().fen(), zuege, san, ergebnis: 'remis', grund: 'einigung', hinweise: 0, zuruecknahmen: 0,
      liveKlassen: review.zuege.map((z) => (z.farbe === 'w' ? z.klasse : null)), genauigkeit: review.genauigkeit.w,
      genauigkeitBot: review.genauigkeit.b, spielstaerke: review.spielstaerke.w, eroeffnung: review.eroeffnung };
    return { partie, review };
  });
  await k.close();
  return d;
}

const server = spawn(process.execPath, ['tests/testserver.mjs', String(PORT), '--bind', '127.0.0.1'], { cwd: WURZEL, stdio: 'ignore' });
let browser;
try {
  await warteAufServer(BASIS);
  browser = await browserTyp(ladePlaywright()).launch();
  const PARTIE = await rechnePartie(browser);
  for (const [gname, w, h] of GROESSEN) {
    if (!(gname in ANALYSE_MIN) && !(gname in PARTIE_MIN) && !(gname in ZUZWEIT_MIN)) continue;
    const k = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, serviceWorkers: 'block',
      timezoneId: 'Europe/Berlin', locale: 'de-DE', hasTouch: w < 1300 });
    const s = await k.newPage();
    await s.goto(BASIS + '#arena');
    await s.waitForFunction(() => window.__app && document.documentElement.dataset.screen === 'arena', null, { timeout: 30000 });
    if (gname in ANALYSE_MIN) {
      await s.evaluate(async ({ partie, review }) => (await import('./js/storage.js')).speicherePartie(partie, review), PARTIE);
      await s.evaluate((id) => window.__app.gehe('analyse', { partieId: id }), PARTIE.partie.id);
      await s.waitForSelector('.an-brett-rahmen .brett', { timeout: 20000 });
      await warte(800);
      const b = await s.evaluate(() => Math.round(document.querySelector('.an-brett-rahmen .brett').getBoundingClientRect().width));
      pruefe(`Analyse @ ${gname} (${w}x${h}): Brett mindestens ${ANALYSE_MIN[gname]} px`, b >= ANALYSE_MIN[gname], `${b} px`);
    }
    if (gname in PARTIE_MIN) {
      await s.evaluate(() => window.__app.gehe('partie', { botId: 'benno' }));
      await s.waitForSelector('.brett-rahmen > .brett', { timeout: 20000 });
      await warte(1500);
      const b = await s.evaluate(() => Math.round(document.querySelector('.brett-rahmen > .brett').getBoundingClientRect().width));
      pruefe(`Partie @ ${gname} (${w}x${h}): Brett mindestens ${PARTIE_MIN[gname]} px`, b >= PARTIE_MIN[gname], `${b} px`);
      const kn = await knoepfeImBild(s, '.spielknoepfe .knopf', null);
      pruefe(`Partie @ ${gname} (${w}x${h}): alle Knoepfe ganz im Fenster`, kn.knoepfe >= 3 && kn.raus === 0, JSON.stringify(kn));
    }
    await k.close();
    // Zu zweit und (quer) die Bot-Partie mit Uhr, wie die Online-Partie: je in eigenem Kontext (keine laufende Partie dazwischen)
    const faelle = [];
    if (gname in ZUZWEIT_MIN) faelle.push(['Zu zweit', { ...ZUZWEIT, tempo: null }], ['Zu zweit mit Uhr', { ...ZUZWEIT, tempo: UHR }]);
    if (gname === 'ipad-quer' || gname === 'handy-quer') faelle.push(['Partie mit Uhr', { botId: 'benno', tempo: UHR }]);
    for (const [fall, params] of faelle) {
      const kz = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, serviceWorkers: 'block',
        timezoneId: 'Europe/Berlin', locale: 'de-DE', hasTouch: w < 1300 });
      const sz = await kz.newPage();
      await sz.goto(BASIS + '#arena');
      await sz.waitForFunction(() => window.__app && document.documentElement.dataset.screen === 'arena', null, { timeout: 30000 });
      await sz.evaluate((p) => window.__app.gehe('partie', p), params);
      const zz = !!params.modus;
      const brettSel = zz ? '.zz-brett' : '.brett-rahmen > .brett';
      await sz.waitForSelector(brettSel, { timeout: 20000 });
      await warte(1500);
      if (zz) {
        const b = await sz.evaluate((sel) => Math.round(document.querySelector(sel).getBoundingClientRect().width), brettSel);
        pruefe(`${fall} @ ${gname} (${w}x${h}): Brett mindestens ${ZUZWEIT_MIN[gname]} px`, b >= ZUZWEIT_MIN[gname], `${b} px`);
      }
      const kn = await knoepfeImBild(sz, zz ? '.zz-spielbereich > .zz-aktionen .knopf' : '.spielknoepfe .knopf', zz ? '.zz-rumpf' : null);
      pruefe(`${fall} @ ${gname} (${w}x${h}): alle Knoepfe ganz im Fenster${zz ? ', nichts scrollt' : ''}`,
        kn.knoepfe >= 3 && kn.raus === 0 && (!zz || kn.scrollt <= 0), JSON.stringify(kn));
      await kz.close();
    }
  }
} catch (e) {
  pruefe('Brettgroesse laeuft durch', false, e.message);
} finally {
  if (browser) await browser.close();
  server.kill();
}
const fehlend = ergebnisse.filter((e) => !e.ok);
console.log(`\n${ergebnisse.length - fehlend.length}/${ergebnisse.length} bestanden`);
if (fehlend.length) process.exit(1);
