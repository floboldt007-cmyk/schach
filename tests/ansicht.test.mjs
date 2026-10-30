// Ansichts-Pruefung (Flo 30.10.2026: "Die Ansicht ist sehr wichtig ... nichts zu klein, nichts zu gross, nichts
// verbuggt"): jeder Hauptbildschirm der echten App (index.html?test, mit allen PAKETE) in sieben Groessen, vom
// kleinen Handy bis zum PC. Geprueft wird, was man sieht:
//   - nichts laeuft seitlich aus der Seite (kein waagrechtes Scrollen, kein Element ueber den Rand)
//   - Schrift nie unter 12 px (Brett-Koordinaten und die Zahl im Bewertungsbalken: 10 px)
//   - jeder Knopf, Link und jedes Feld mindestens 44 x 44 px Trefferflaeche (Apple HIG; ::before/::after mit
//     negativem Abstand zaehlt mit)
//   - keine zwei Bedienelemente uebereinander (die verschiebbare Weltkarte ausgenommen)
//   - kein Text abgeschnitten (ohne Auslassungspunkte)
//   - ganz nach unten gescrollt liegt nichts Bedienbares unter der Reiter-Leiste oder der klebenden Spielen-Flaeche
//   - keine Skriptfehler
//
//   node tests/ansicht.test.mjs                    alles
//   node tests/ansicht.test.mjs --nur=arena,ich    nur diese Ziele
//   BILDER=/pfad node tests/ansicht.test.mjs       dazu je Ziel und Groesse ein Foto (fuer Flo)
//   PORT=8961 node tests/ansicht.test.mjs          eigener Port (Standard 8961)
//
// Playwright: Pfad per Umgebungsvariable PLAYWRIGHT_PFAD, sonst 'playwright' oder /opt/node-tools.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { browserTyp } from './browser.mjs';

const require = createRequire(import.meta.url);
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8961);
const BASIS = `http://127.0.0.1:${PORT}/index.html?test#arena`;
const BILDER = process.env.BILDER ? path.join(process.env.BILDER, 'ansicht') : '';
if (BILDER) mkdirSync(BILDER, { recursive: true });
const nurArg = process.argv.find((a) => a.startsWith('--nur='));
const NUR = nurArg ? nurArg.slice(6).split(',') : null;
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

export const GROESSEN = [['handy-klein', 375, 667], ['handy', 390, 844], ['handy-quer', 667, 375], ['ipad-hoch', 820, 1180], ['ipad-quer', 1180, 820],
  // iPad quer im Browser mit Leisten (Flos Foto 30.10.: 1000 x 590 nutzbar)
  ['ipad-browser', 1000, 590], ['pc', 1440, 900]];
export const ZIELE = [
  ['arena', 'arena', {}], ['partie', 'partie', { botId: 'benno' }], ['zuzweit', 'partie', { modus: 'zuzweit' }],
  ['verlauf', 'verlauf', {}], ['einstellungen', 'einstellungen', {}], ['training', 'training', {}],
  ['bestenliste-ich', 'bestenliste', { reiter: 'ich' }], ['bestenliste-bots', 'bestenliste', { reiter: 'bots' }],
  ['bestenliste-freunde', 'bestenliste', { reiter: 'freunde' }], ['ich', 'ich', {}], ['start', 'start', {}],
];

function ladePlaywright() {
  for (const k of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
    try { return require(k); } catch (e) { /* naechster */ }
  }
  throw new Error('Playwright nicht gefunden (PLAYWRIGHT_PFAD setzen)');
}
async function warteAufServer(url, ms = 10000) {
  const ende = Date.now() + ms;
  while (Date.now() < ende) {
    try { if ((await fetch(url)).ok) return; } catch (e) { /* noch nicht da */ }
    await warte(150);
  }
  throw new Error('Server startet nicht: ' + url);
}

const ergebnisse = [];
function pruefe(name, ok, detail = '') {
  ergebnisse.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'ok  ' : 'FEHLER'} ${name}${!ok && detail ? ' (' + detail + ')' : ''}`);
}

// Laeuft in der Seite: Befunde des sichtbaren Zustands
function befundeDerSeite() {
  const W = innerWidth;
  const sichtbar = (el) => {
    const st = getComputedStyle(el);
    if (st.visibility === 'hidden' || st.display === 'none' || +st.opacity === 0) return false;
    const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0;
  };
  const pfad = (el) => {
    const t = []; let e = el;
    for (let i = 0; e && e !== document.body && i < 3; i++, e = e.parentElement) {
      t.unshift(e.tagName.toLowerCase() + (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : ''));
    }
    return t.join('>');
  };
  // .sr: nur fuer Vorleser (1 x 1 px, absichtlich abgeschnitten)
  const versteckt = (el) => !!el.closest('[aria-hidden="true"], [hidden], .sr');
  const aus = { ueberlauf: document.documentElement.scrollWidth - W, klein: [], knopf: [], rand: [], ueberlapp: [], abgeschnitten: [], gekappt: [] };
  // Inhalt, der unten abgeschnitten ist und sich nicht scrollen laesst (Flo 30.10.: "kann den unteren Teil nicht sehen")
  for (const el of document.querySelectorAll('.screen, .screen *')) {
    if (!sichtbar(el) || versteckt(el) || el.closest('.welt, .karte, .brett, .duell, .evalbalken')) continue;
    const st = getComputedStyle(el);
    if (/(hidden|clip)/.test(st.overflowY) && el.clientHeight > 120 && el.scrollHeight > el.clientHeight + 24) aus.gekappt.push(`${pfad(el)} ${el.scrollHeight}/${el.clientHeight}`);
  }
  const alle = [...document.querySelectorAll('body *')].filter(sichtbar);
  for (const el of alle) {
    if (versteckt(el)) continue;
    const hatText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 0);
    const st = getComputedStyle(el);
    const min = el.closest('.koord, .evalbalken, .an-eb-wert, .an-evalbalken') ? 10 : 12;
    if (hatText && parseFloat(st.fontSize) < min) aus.klein.push(`${pfad(el)} ${st.fontSize} "${el.textContent.trim().slice(0, 24)}"`);
    const r = el.getBoundingClientRect();
    if (r.right > W + 1 || r.left < -1) {
      let a = el.parentElement, gekappt = false;
      while (a && a !== document.documentElement) { if (/(hidden|auto|scroll|clip)/.test(getComputedStyle(a).overflowX)) { gekappt = true; break; } a = a.parentElement; }
      if (!gekappt) aus.rand.push(`${pfad(el)} ${Math.round(r.left)}..${Math.round(r.right)}`);
    }
    if (hatText && /(hidden|clip)/.test(st.overflowX) && el.scrollWidth > el.clientWidth + 2 && st.textOverflow !== 'ellipsis' && !/-webkit-box/.test(st.display)) {
      aus.abgeschnitten.push(`${pfad(el)} "${el.textContent.trim().slice(0, 24)}"`);
    }
  }
  const knoepfe = alle.filter((el) => el.matches('button, a[href], [role="button"], input:not([type="hidden"]), select, summary, textarea') && !versteckt(el));
  const flaeche = (el) => {
    const r = el.getBoundingClientRect(); let w = r.width, h = r.height;
    for (const ps of ['::before', '::after']) {
      const q = getComputedStyle(el, ps);
      if (q.content === 'none' || q.position !== 'absolute') continue;
      const n = (v) => Math.max(0, -parseFloat(v) || 0);
      w = Math.max(w, r.width + n(q.left) + n(q.right)); h = Math.max(h, r.height + n(q.top) + n(q.bottom));
    }
    return { w, h };
  };
  for (const el of knoepfe) {
    if (el.matches('input[type="checkbox"], input[type="radio"]')) continue;
    const f = flaeche(el);
    if (f.w < 44 || f.h < 44) aus.knopf.push(`${pfad(el)} ${Math.round(f.w)}x${Math.round(f.h)} "${(el.getAttribute('aria-label') || el.textContent).trim().slice(0, 20)}"`);
  }
  for (let i = 0; i < knoepfe.length; i++) for (let j = i + 1; j < knoepfe.length; j++) {
    const a = knoepfe[i], c = knoepfe[j];
    if (a.contains(c) || c.contains(a)) continue;
    if (a.closest('.welt') || c.closest('.welt')) continue;
    if (a.closest('.reiter-leiste, .cta-platz') || c.closest('.reiter-leiste, .cta-platz')) continue;
    const ra = [...a.getClientRects()], rc = [...c.getClientRects()];
    if (ra.some((x) => rc.some((y) => Math.min(x.right, y.right) - Math.max(x.left, y.left) > 4 && Math.min(x.bottom, y.bottom) - Math.max(x.top, y.top) > 4))) {
      aus.ueberlapp.push(`${pfad(a)} / ${pfad(c)}`);
    }
  }
  return aus;
}

// Laeuft in der Seite: ganz nach unten scrollen, dann darf nichts unter Leiste oder Spielen-Flaeche liegen
async function untenFrei() {
  const deckel = [...document.querySelectorAll('.reiter-leiste, .cta-platz')].filter((d) => getComputedStyle(d).display !== 'none'
    && d.getBoundingClientRect().height > 0 && d.getBoundingClientRect().top > innerHeight / 2);
  if (!deckel.length) return [];
  const roller = [document.scrollingElement, ...[...document.querySelectorAll('body *')].filter((e) => /(auto|scroll)/.test(getComputedStyle(e).overflowY))]
    .filter((e) => e && e.scrollHeight > e.clientHeight + 4);
  for (const e of roller) e.scrollTop = e.scrollHeight;
  await new Promise((r) => setTimeout(r, 400));
  const aus = [];
  for (const el of document.querySelectorAll('button, a[href], input, select, textarea, [role="button"]')) {
    if (el.closest('.reiter-leiste, .cta-platz, .welt, [aria-hidden="true"]')) continue;
    const st = getComputedStyle(el);
    if (st.visibility === 'hidden' || st.display === 'none' || st.position === 'fixed') continue;
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
    const deckt = deckel.some((d) => { const l = d.getBoundingClientRect(); return Math.min(r.right, l.right) - Math.max(r.left, l.left) > 4 && Math.min(r.bottom, l.bottom) - Math.max(r.top, l.top) > 4; });
    if (deckt) aus.push(`${String(el.className || el.tagName).slice(0, 40)} "${(el.textContent || '').trim().slice(0, 20)}"`);
  }
  for (const e of roller) e.scrollTop = 0;
  return aus;
}

const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: WURZEL, stdio: 'ignore' });
let browser;
try {
  await warteAufServer(BASIS.replace(/#.*$/, ''));
  browser = await browserTyp(ladePlaywright()).launch();
  for (const [gname, w, h] of GROESSEN) {
    const k = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, serviceWorkers: 'block',
      timezoneId: 'Europe/Berlin', locale: 'de-DE', hasTouch: w < 1300 });
    const s = await k.newPage();
    const fehler = [];
    s.on('pageerror', (e) => fehler.push(e.message));
    await s.goto(BASIS);
    await s.waitForFunction(() => !!window.__app && !!document.querySelector('.screen'), null, { timeout: 30000 });
    await warte(1200);
    for (const [ziel, screen, params] of ZIELE) {
      if (NUR && !NUR.includes(ziel)) continue;
      await s.evaluate(([n, p]) => window.__app.gehe(n, p), [screen, params]);
      await warte(screen === 'partie' ? 3000 : 1200);
      const b = await s.evaluate(befundeDerSeite);
      b.unten = await s.evaluate(untenFrei);
      const name = `${ziel} @ ${gname} (${w}x${h})`;
      pruefe(`${name}: nichts laeuft seitlich raus`, b.ueberlauf <= 1 && !b.rand.length, b.rand.slice(0, 3).join('; ') || `+${b.ueberlauf}px`);
      pruefe(`${name}: Schrift ab 12 px`, !b.klein.length, b.klein.slice(0, 3).join('; '));
      pruefe(`${name}: Knoepfe ab 44 px`, !b.knopf.length, b.knopf.slice(0, 3).join('; '));
      pruefe(`${name}: keine Ueberlappung`, !b.ueberlapp.length, b.ueberlapp.slice(0, 3).join('; '));
      pruefe(`${name}: nichts abgeschnitten`, !b.abgeschnitten.length, b.abgeschnitten.slice(0, 3).join('; '));
      pruefe(`${name}: alles erreichbar (nichts unten abgeschnitten ohne Scrollen)`, !b.gekappt.length, b.gekappt.slice(0, 3).join('; '));
      pruefe(`${name}: unten frei`, !b.unten.length, b.unten.slice(0, 3).join('; '));
      pruefe(`${name}: keine Skriptfehler`, !fehler.length, fehler.splice(0).slice(0, 2).join('; '));
      if (BILDER) await s.screenshot({ path: path.join(BILDER, `${ziel}-${gname}.png`) });
    }
    await k.close();
  }
} catch (e) {
  pruefe('Ansichts-Pruefung laeuft durch', false, e.message);
} finally {
  if (browser) await browser.close();
  server.kill();
}
const fehlend = ergebnisse.filter((e) => !e.ok);
console.log(`\n${ergebnisse.length - fehlend.length}/${ergebnisse.length} bestanden`);
if (fehlend.length) { console.log('FEHLER: ' + fehlend.map((e) => e.name).join(' | ')); process.exit(1); }
