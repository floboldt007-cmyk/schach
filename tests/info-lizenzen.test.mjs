// Pflichtangaben in "Info und Lizenzen" (Rechte-Liste Crownmate 14.11.2026, G-007 AC-06): jede fremde Lizenz, die die App
// mitliefert oder nutzt, steht auf der Info-Seite, in Deutsch und Englisch, dazu der Link zum eigenen Quellcode (GPL-3.0).
// Teil 1 in Node: README und werkzeuge/labor-figuren.mjs fuehren Frost, Kuerbis und Gold so, wie sie heute entstehen
//   (werkzeuge/figuren-3d.mjs, GPL-3.0), nicht mehr als Ableitung aus "cburnett".
// Teil 2 im Browser (Playwright, echte App, eigener Server): Einstellungen > Info und Lizenzen je Sprache.
//
//   node tests/info-lizenzen.test.mjs
//   PORT=9791 node tests/info-lizenzen.test.mjs    Port des Testservers (sonst: frei)
//
// Playwright: PLAYWRIGHT_PFAD, sonst 'playwright', sonst /opt/node-tools/node_modules/playwright.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { browserTyp } from './browser.mjs';

const require = createRequire(import.meta.url);
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || await (await import('./freier-port.mjs')).freierPort();
const BASIS = `http://127.0.0.1:${PORT}/`;
const lies = (d) => readFileSync(path.join(WURZEL, d), 'utf8');
const flach = (s) => String(s || '').replace(/\s+/g, ' ').trim();

let gesamt = 0, ok = 0;
function pruefe(name, gut, detail = '') {
  gesamt++; if (gut) ok++;
  const d = typeof detail === 'string' ? detail : JSON.stringify(detail);
  console.log(`${gut ? 'ok    ' : 'FEHLER'} ${name}${!gut && d ? ' (' + d.slice(0, 600) + ')' : ''}`);
}

// ---------- Teil 1: Herkunft Frost, Kuerbis, Gold ----------
{
  const readme = lies('README.md');
  const zeile = flach((readme.match(/- \*\*Figuren\*\* „Kürbis“, „Frost“ und „Gold“[\s\S]*?(?=\n- \*\*)/) || [''])[0]);
  pruefe('README: Kürbis, Frost und Gold aus werkzeuge/figuren-3d.mjs, GPL-3.0, nicht aus cburnett',
    /figuren-3d\.mjs/.test(zeile) && /GPL-3\.0/.test(zeile) && !/cburnett|GPLv2/.test(zeile), zeile || 'Zeile fehlt');
  const kopf = lies('werkzeuge/labor-figuren.mjs').split('\n').filter((z) => z.startsWith('//')).join(' ');
  pruefe('labor-figuren.mjs: Kopf behauptet nicht, dass es Kürbis, Frost und Gold aus cburnett schreibt, und nennt figuren-3d.mjs',
    !/Kuerbis \(Halloween\), Frost und Gold\. Abgeleitet/.test(kopf) && /figuren-3d\.mjs/.test(kopf), kopf.slice(0, 300));
}

// ---------- Teil 2: Info-Seite je Sprache ----------
const warte = (ms) => new Promise((w) => setTimeout(w, ms));
// Am Handy ist die Info-Gruppe hinter der Einstellungs-Navigation: den Punkt antippen, wo er sichtbar ist (am breiten
// Schirm springt er nur dorthin). Dann den Lizenztext-Knopf in die Mitte holen.
async function oeffneInfo(s) {
  await s.evaluate(() => { const b = document.querySelector('.es-nav-punkt[data-ziel="es-g-info"]'); if (b && b.getClientRects().length) b.click(); });
  await warte(600);
  await s.evaluate(() => document.querySelector('.es-lizenztext summary').scrollIntoView({ block: 'center' }));
  await warte(300);
}
// Kurz-Review rechte (37), Befund 1: die Nennungen stehen nicht nur im DOM, sie sind sichtbar (je Sprache und je Breite,
// Fix-Review 37: ein li, das nur am Handy per @media ausgeblendet ist, fiel bei 1180 nicht auf)
const sichtbarkeit = (s) => s.evaluate(() => {
  const el = document.querySelector('.es-info');
  const zu = (e) => !!e && e.checkVisibility({ opacityProperty: true, visibilityProperty: true }) && e.getBoundingClientRect().height > 0;
  const quelle = el.querySelector('a[href="https://github.com/floboldt007-cmyk/schach"]');
  const unsichtbar = [...el.querySelectorAll('.es-lizenzen li')].filter((li) => !zu(li)).map((li) => li.textContent.trim().slice(0, 30));
  const su = el.querySelector('.es-lizenztext summary');
  return { quelle: zu(quelle), unsichtbar, posten: el.querySelectorAll('.es-lizenzen li').length, summary: zu(su) };
});
// Kurz-Review rechte (37), Befund 2: die Tippflaeche "Lizenztext" ist mindestens 44 px hoch und an neun Punkten (Ecken
// 2 px eingerueckt, Kantenmitten, Mitte) trifft ein Tippen wirklich sie, nicht etwas darueber (Muster screens, Treffer)
const tippflaeche = (s) => s.evaluate(() => {
  const su = document.querySelector('.es-lizenztext summary');
  const r = su.getBoundingClientRect();
  const xs = [r.left + 2, r.left + r.width / 2, r.right - 2], ys = [r.top + 2, r.top + r.height / 2, r.bottom - 2];
  const daneben = [];
  for (const x of xs) for (const y of ys) { const e = document.elementFromPoint(x, y); if (!e || e.closest('summary') !== su) daneben.push(`${Math.round(x)},${Math.round(y)}:${e ? e.tagName + '.' + e.className : 'nichts'}`); }
  return { h: Math.round(r.height * 10) / 10, b: Math.round(r.width), treffer: 9 - daneben.length, daneben };
});
const BSD = flach(lies('vendor/chess/LICENSE'));
let pw;
try { pw = require(process.env.PLAYWRIGHT_PFAD || 'playwright'); } catch (e) { pw = require('/opt/node-tools/node_modules/playwright'); }
const server = spawn(process.execPath, ['tests/testserver.mjs', String(PORT), '--bind', '127.0.0.1'], { cwd: WURZEL, stdio: 'ignore' });
const browser = await browserTyp(pw).launch({ headless: true });
try {
  for (let i = 0; i < 60; i++) { try { const r = await fetch(BASIS + 'index.html'); await r.arrayBuffer(); if (r.ok) break; } catch (e) { /* noch nicht */ } await new Promise((w) => setTimeout(w, 150)); }
  for (const [sp, locale] of [['de', 'de-DE'], ['en', 'en-US']]) {
    const k = await browser.newContext({ locale, viewport: { width: 1180, height: 820 } });
    const s = await k.newPage();
    const fehler = [];
    s.on('pageerror', (e) => fehler.push(e.message));
    s.on('console', (m) => { if (m.type() === 'error' || /Text fehlt/.test(m.text())) fehler.push(m.text()); });
    // wie tests/lobby.test.mjs: gewaehlte Sprache in den Einstellungen (sonst gilt die Geraetesprache)
    await s.addInitScript((sprache) => {
      try { localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ sprache, spracheGewaehlt: true })); } catch (e) { /* egal */ }
    }, sp);
    await s.goto(BASIS + 'index.html?test#einstellungen');
    await s.waitForSelector('.es-info', { state: 'attached', timeout: 15000 });
    const info = await s.evaluate(() => {
      const el = document.querySelector('.es-info');
      const links = [...el.querySelectorAll('a')].map((a) => a.href);
      const posten = [...el.querySelectorAll('.es-lizenzen li')].map((li) => li.textContent.replace(/\s+/g, ' ').trim());
      const bsd = el.querySelector('[data-lizenztext="chess.js"]');
      return { text: el.textContent.replace(/\s+/g, ' '), links, posten, bsd: bsd ? [...bsd.children].map((p) => p.textContent).join(' ') : null, lang: document.documentElement.lang };
    });
    const posten = (re) => info.posten.find((p) => re.test(p)) || '';
    pruefe(`${sp}: Seite in der Sprache`, info.lang === sp, info.lang);
    pruefe(`${sp}: eigener Quellcode verlinkt (github.com/floboldt007-cmyk/schach), GPL-3.0 genannt`,
      info.links.includes('https://github.com/floboldt007-cmyk/schach') && /GPL-3\.0/.test(info.text), info.links);
    const sf = posten(/Stockfish/);
    pruefe(`${sp}: Stockfish mit GPL-3.0 und Quelle`, /GPL-3\.0/.test(sf) && info.links.includes('https://github.com/nmrugg/stockfish.js'), sf);
    const cj = posten(/chess\.js/);
    pruefe(`${sp}: chess.js mit Urheber Jeff Hlywa und BSD-2-Clause`, /Jeff Hlywa/.test(cj) && /BSD-2-Clause/.test(cj), cj);
    pruefe(`${sp}: chess.js mit vollem Lizenztext wie vendor/chess/LICENSE`, flach(info.bsd) === BSD, (info.bsd || 'fehlt').slice(0, 200));
    const cb = posten(/cburnett/);
    pruefe(`${sp}: Figuren cburnett mit Urheber und GPLv2+`, /Colin M\. ?L\. Burnett/.test(cb) && /GPLv2\+/.test(cb), cb);
    const sch = posten(/Manrope/);
    pruefe(`${sp}: Schriften unter SIL OFL 1.1, beide Lizenztexte verlinkt`,
      /Bricolage Grotesque/.test(sch) && /Open Font License 1\.1/.test(sch)
      && info.links.includes(BASIS + 'assets/schriften/OFL-Manrope.txt') && info.links.includes(BASIS + 'assets/schriften/OFL-Bricolage-Grotesque.txt'), sch);
    const li = posten(/Lichess/);
    pruefe(`${sp}: Rätsel-Duell aus der Lichess-Rätsel-Datenbank, CC0, Quelle verlinkt`,
      /CC0/.test(li) && info.links.includes('https://database.lichess.org/'), li);
    // Kurz-Review rechte (37), Befund 1: die Nennungen stehen nicht nur im DOM, sie sind sichtbar, und der Lizenztext ist
    // nach dem Antippen aufgeklappt lesbar
    await oeffneInfo(s);
    const sicht = await sichtbarkeit(s);
    pruefe(`${sp}: Quellcode-Link, alle Lizenz-Eintraege und der Knopf Lizenztext sichtbar`,
      sicht.quelle && sicht.posten >= 6 && sicht.unsichtbar.length === 0 && sicht.summary, sicht);
    // per DOM statt s.click: ein verdeckter Knopf soll als Befund im Bericht stehen (Treffer prueft tippflaeche), nicht den Lauf abbrechen
    await s.evaluate(() => document.querySelector('.es-lizenztext summary').click());
    await warte(300);
    const offen = await s.evaluate(() => {
      const d = document.querySelector('.es-lizenztext'); const t = d.querySelector('[data-lizenztext="chess.js"]');
      const r = t.getBoundingClientRect();
      return { offen: d.open, sichtbar: t.checkVisibility({ opacityProperty: true, visibilityProperty: true }), h: Math.round(r.height), b: Math.round(r.width) };
    });
    pruefe(`${sp}: Lizenztext nach dem Antippen aufgeklappt und lesbar`, offen.offen && offen.sichtbar && offen.h > 40 && offen.b > 150, offen);
    pruefe(`${sp}: keine Fehler und keine fehlenden Texte`, fehler.length === 0, fehler);
    await k.close();
  }
  for (const [sp, w, h] of [['de', 375, 667], ['en', 390, 844], ['de', 820, 1180], ['de', 1180, 820], ['de', 1440, 900]]) {
    const k = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: w < 1000 });
    const s = await k.newPage();
    await s.addInitScript((sprache) => {
      try { localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ sprache, spracheGewaehlt: true })); } catch (e) { /* egal */ }
    }, sp);
    await s.goto(BASIS + 'index.html?test#einstellungen');
    await s.waitForSelector('.es-info', { state: 'attached', timeout: 15000 });
    await oeffneInfo(s);
    const t = await tippflaeche(s);
    pruefe(`${sp} ${w}x${h}: Tippflaeche Lizenztext mindestens 44 px, 9 von 9 Punkten treffen sie`, t.h >= 44 && t.treffer === 9, t);
    const sb = await sichtbarkeit(s);
    pruefe(`${sp} ${w}x${h}: Quellcode-Link, alle Lizenz-Eintraege und der Knopf Lizenztext sichtbar`,
      sb.quelle && sb.posten >= 6 && sb.unsichtbar.length === 0 && sb.summary, sb);
    await k.close();
  }
} finally {
  await browser.close(); server.kill();
}
console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
