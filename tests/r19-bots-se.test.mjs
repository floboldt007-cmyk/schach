// R19 (Kritik R18 E2 und G1, 14.11.2026), im Browser gemessen:
// Teil A Bots-Seite: Der klebende Knopf "Spielen gegen <Bot>" verdeckt kein Fokusziel (WCAG 2.4.11). Gemessen per Tab durch
//   alle Bedienpunkte der Bots-Seite, je Ziel die Ueberdeckung mit .cta-platz in px. Ganz nach unten gerollt liegt nichts aus
//   dem Panel unter dem Knopf. In Ruhe (nicht gerollt, kein Fokus) sieht die Seite aus wie mit dem CSS der Basis
//   (origin/sammel-1114-r18, per Route ausgeliefert): Bild fuer Bild gleich.
// Teil B Loeschseite: oben ein Sprunglink zu "Selbst loeschen", mindestens 44 px hoch, auf dem Handy im ersten Bild,
//   Tippen landet am Abschnitt.
//
//   node tests/r19-bots-se.test.mjs
//   PORT=9791 node tests/r19-bots-se.test.mjs    Port des Testservers (sonst: frei)
//   BASIS_CSS=<datei> node tests/r19-bots-se.test.mjs    Vergleichs-CSS fuer Teil A (sonst: git show origin/sammel-1114-r18)
//
// Playwright: PLAYWRIGHT_PFAD, sonst 'playwright', sonst /opt/node-tools/node_modules/playwright.
import { spawn, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { browserTyp } from './browser.mjs';

const require = createRequire(import.meta.url);
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || await (await import('./freier-port.mjs')).freierPort();
const BASIS = `http://127.0.0.1:${PORT}/`;
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

let gesamt = 0, ok = 0;
function pruefe(name, gut, detail = '') {
  gesamt++; if (gut) ok++;
  const d = typeof detail === 'string' ? detail : JSON.stringify(detail);
  console.log(`${gut ? 'ok    ' : 'FEHLER'} ${name}${!gut && d ? ' (' + d.slice(0, 600) + ')' : ''}`);
}

// CSS der Basis fuer den Bildvergleich in Ruhe; ohne git (CI mit flachem Klon) entfaellt nur dieser Vergleich
let basisCss = null;
try {
  basisCss = process.env.BASIS_CSS ? readFileSync(process.env.BASIS_CSS, 'utf8')
    : execFileSync('git', ['show', 'origin/sammel-1114-r18:css/arena.css'], { cwd: WURZEL, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
} catch (e) { basisCss = null; }

async function bots(browser, { w, h, schema, css = null }) {
  const k = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: w < 1000, colorScheme: schema, reducedMotion: 'reduce',
    deviceScaleFactor: 1, serviceWorkers: 'block' });
  if (css) await k.route((u) => new URL(u).pathname.endsWith('/css/arena.css'), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: css }));
  await k.addInitScript((modus) => {
    try {
      if (sessionStorage.getItem('probe-start')) return;
      sessionStorage.setItem('probe-start', '1');
      localStorage.clear();
      const d = new Date(); if (d.getHours() < 4) d.setDate(d.getDate() - 1);
      const z = (n) => String(n).padStart(2, '0');
      localStorage.setItem('schach-arena:v1:modul:start', JSON.stringify({ gesehen: `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}` }));
      localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ sprache: 'de', spracheGewaehlt: true, klang: false, modus }));
      localStorage.setItem('schach-arena:v1:hinweis-installieren', '1');
    } catch (e) { /* egal */ }
  }, schema === 'dark' ? 'dunkel' : 'hell');
  const s = await k.newPage();
  const fehler = []; s.on('pageerror', (e) => fehler.push(e.message));
  await s.goto(BASIS + 'index.html?test#arena');
  await s.waitForSelector('.screen.arena .cta-platz .spielen', { state: 'visible', timeout: 20000 });
  await warte(800);
  return { k, s, fehler };
}

// Tab durch die Seite, bis der Fokus wiederkommt; je Ziel in .arena .inhalt die Ueberdeckung mit dem klebenden Knopf
const fokusRunde = async (s) => {
  const funde = [], ziele = new Set();
  let erstes = null;
  for (let i = 0; i < 80; i++) {
    await s.keyboard.press('Tab'); await warte(60);
    const r = await s.evaluate(() => {
      const e = document.activeElement;
      if (!e || e === document.body) return { schluessel: 'body' };
      const schluessel = e.outerHTML.slice(0, 160);
      const a = e.closest('.screen.arena .inhalt');
      const cta = a && a.querySelector('.cta-platz');
      if (!a || !cta || cta.contains(e)) return { schluessel, zaehlt: false };
      const c = cta.getBoundingClientRect(), b = e.getBoundingClientRect();
      const x = Math.min(b.right, c.right) - Math.max(b.left, c.left), y = Math.min(b.bottom, c.bottom) - Math.max(b.top, c.top);
      return { schluessel, zaehlt: true, name: `${String(e.className).split(' ')[0]} "${(e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 20)}"`,
        verdeckt: x > 0.5 && y > 0.5 ? Math.round(y) : 0 };
    });
    if (erstes === null) erstes = r.schluessel; else if (r.schluessel === erstes) break;
    if (!r.zaehlt) continue;
    ziele.add(r.schluessel);
    if (r.verdeckt) funde.push(`${r.name} ${r.verdeckt} px`);
  }
  return { ziele: ziele.size, funde };
};

// ganz nach unten gerollt: kein sichtbares Blatt des Panels (ausser dem Knopf selbst) liegt unter dem Knopf
const panelAmEnde = (s) => s.evaluate(() => {
  const a = document.querySelector('.screen.arena .inhalt');
  a.scrollTop = a.scrollHeight;
  const cta = a.querySelector('.cta-platz'); const c = cta.getBoundingClientRect();
  const unter = [];
  for (const e of a.querySelectorAll('.detail *')) {
    if (cta.contains(e) || e.children.length || !e.getClientRects().length) continue;
    const b = e.getBoundingClientRect();
    if (b.width < 1 || b.height < 1) continue;
    const x = Math.min(b.right, c.right) - Math.max(b.left, c.left), y = Math.min(b.bottom, c.bottom) - Math.max(b.top, c.top);
    if (x > 0.5 && y > 0.5) unter.push(`${e.tagName}.${String(e.className).split(' ')[0]} "${(e.textContent || '').trim().slice(0, 16)}" ${Math.round(y)} px`);
  }
  return { unter: unter.slice(0, 6), anzahl: unter.length };
});

let pw;
try { pw = require(process.env.PLAYWRIGHT_PFAD || 'playwright'); } catch (e) { pw = require('/opt/node-tools/node_modules/playwright'); }
const server = spawn(process.execPath, ['tests/testserver.mjs', String(PORT), '--bind', '127.0.0.1'], { cwd: WURZEL, stdio: 'ignore' });
const browser = await browserTyp(pw).launch({ headless: true });
try {
  for (let i = 0; i < 60; i++) { try { if ((await fetch(BASIS + 'index.html')).ok) break; } catch (e) { /* noch nicht */ } await warte(150); }

  // ---------- Teil A: Bots ----------
  const GROESSEN = [[375, 667], [390, 844], [667, 375], [820, 1180], [1180, 820], [1000, 590], [1440, 900]];
  for (const schema of ['light', 'dark']) for (const [w, h] of GROESSEN) {
    const name = `Bots ${w}x${h} ${schema === 'dark' ? 'dunkel' : 'hell'}`;
    // Bild in Ruhe gegen die Basis
    if (basisCss) {
      const neu = await bots(browser, { w, h, schema });
      const alt = await bots(browser, { w, h, schema, css: basisCss });
      // erst Schriften und Bilder fertig; unter Last (volle Suite) wich ein Bild sonst um wenige Bytes ab. Ein echter
      // CSS-Unterschied bleibt bei jedem Versuch, darum bis zu drei Aufnahmen beider Seiten
      const bereit = (s) => s.evaluate(async () => { await document.fonts.ready;
        await Promise.all([...document.images].map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; })))); });
      await bereit(neu.s); await bereit(alt.s);
      let bn, ba, versuche = 0;
      do {
        if (versuche) await warte(700);
        [bn, ba] = [await neu.s.screenshot({ animations: 'disabled' }), await alt.s.screenshot({ animations: 'disabled' })];
      } while (!bn.equals(ba) && ++versuche < 3);
      pruefe(`${name}: in Ruhe bildgleich mit dem CSS der Basis`, bn.equals(ba), `${bn.length} gegen ${ba.length} Bytes nach ${versuche + 1} Aufnahmen`);
      await neu.k.close(); await alt.k.close();
    }
    const { k, s, fehler } = await bots(browser, { w, h, schema });
    const f = await fokusRunde(s);
    pruefe(`${name}: Tab erreicht Bedienpunkte der Seite`, f.ziele >= 3, f);
    pruefe(`${name}: kein Fokusziel liegt unter dem klebenden Spielen-Knopf (WCAG 2.4.11)`, f.funde.length === 0, f.funde);
    const p = await panelAmEnde(s);
    pruefe(`${name}: ganz unten gerollt liegt nichts aus dem Panel unter dem Knopf`, p.anzahl === 0, p.unter);
    pruefe(`${name}: keine Seitenfehler`, fehler.length === 0, fehler);
    await k.close();
  }

  // ---------- Teil B: Loeschseite ----------
  for (const [w, h, touch] of [[375, 667, true], [390, 844, true], [1440, 900, false]]) for (const schema of ['light', 'dark']) {
    const name = `Loeschseite ${w}x${h} ${schema === 'dark' ? 'dunkel' : 'hell'}`;
    const k = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch, colorScheme: schema, serviceWorkers: 'block' });
    await k.route((u) => !new URL(u).hostname.startsWith('127.0.0.1'), (r) => r.abort());
    const s = await k.newPage();
    await s.goto(BASIS + 'konto-loeschen.html');
    await s.waitForSelector('h1', { timeout: 15000 });
    const vorher = await s.evaluate(() => {
      const ziel = [...document.querySelectorAll('h2')].find((x) => /Selbst l/.test(x.textContent));
      const a = ziel && ziel.id ? document.querySelector(`main a[href="#${CSS.escape(ziel.id)}"]`) : null;
      if (!a) return { da: false, zielId: ziel ? ziel.id : null };
      const r = a.getBoundingClientRect();
      return { da: true, h: Math.round(r.height), oben: Math.round(r.top), unten: Math.round(r.bottom), fenster: innerHeight, text: a.textContent.trim() };
    });
    pruefe(`${name}: Sprunglink zu "Selbst loeschen" vorhanden`, vorher.da, vorher);
    pruefe(`${name}: Sprunglink mindestens 44 px hoch`, vorher.da && vorher.h >= 44, vorher);
    pruefe(`${name}: Sprunglink im ersten Bildschirm`, vorher.da && vorher.oben >= 0 && vorher.unten <= vorher.fenster, vorher);
    if (vorher.da) {
      const link = s.locator('main a[href^="#"]').filter({ hasText: vorher.text }).first();
      if (touch) await link.tap(); else await link.click();
      await warte(700);
      const nach = await s.evaluate(() => {
        const ziel = [...document.querySelectorAll('h2')].find((x) => /Selbst l/.test(x.textContent));
        const r = ziel.getBoundingClientRect();
        const ende = Math.ceil(scrollY + innerHeight) >= document.documentElement.scrollHeight - 1;
        return { oben: Math.round(r.top), unten: Math.round(r.bottom), fenster: innerHeight, hash: location.hash, rollt: Math.round(scrollY), ende };
      });
      // oben im Bild, oder (kurze Seite am PC) ganz nach unten gerollt und die Ueberschrift im Bild
      pruefe(`${name}: Tippen landet am Abschnitt (Ueberschrift oben im Bild oder Seite am Ende)`, nach.oben >= 0 && nach.unten <= nach.fenster
        && nach.rollt > 0 && (nach.oben <= 80 || nach.ende), nach);
    }
    await k.close();
  }
} finally {
  await browser.close(); server.kill();
}
console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
