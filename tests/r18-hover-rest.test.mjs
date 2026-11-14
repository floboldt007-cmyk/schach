// Zeiger-Zustaende am Handy, Rest aus R17 hover-handy (R18, 14.11.2026): .es-nav-punkt (css/einstellungen.css) und die
// Kopf-Chips (.kopf-chips > .chip, css/navigation.css) hatten :hover ausserhalb von @media (hover: hover). Auf dem Handy
// laesst der Browser den Zeiger an der Tippstelle stehen, der Zustand bliebe also haengen. Der Test misst in den echten
// Screens #einstellungen und #arena:
//   - Handy 390 x 844 und iPad hoch 820 x 1180 (Touch, hover: none), hell und dunkel: Zeiger an der Tippstelle (hover())
//     sieht aus wie in Ruhe, und keine :hover-Regel ausserhalb von @media (hover: hover) trifft die Elemente (CSSOM)
//   - PC 1440 x 900 (Maus), hell und dunkel: unter dem Zeiger sichtbar anders als in Ruhe
//
//   node tests/r18-hover-rest.test.mjs
//   node tests/r18-hover-rest.test.mjs --pc-gleich=<rev>    dazu: am PC unter dem Zeiger bildgleich mit <rev>
//   node tests/r18-hover-rest.test.mjs --handy-css=<rev>    Gegenprobe: Handy und iPad mit den css/-Dateien aus <rev>
//                                                           (auf a7c972a muss das rot werden)
//   PORT=8974 node tests/r18-hover-rest.test.mjs             eigener Port (Standard: frei)
//
// Playwright: Pfad per Umgebungsvariable PLAYWRIGHT_PFAD, sonst 'playwright' oder /opt/node-tools.
import { spawn, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { browserTyp } from './browser.mjs';

const require = createRequire(import.meta.url);
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || await (await import('./freier-port.mjs')).freierPort();
const BASIS = `http://127.0.0.1:${PORT}/index.html?test`;
const P = 'schach-arena:v1:';
const schalter = (n) => (process.argv.find((a) => a.startsWith(`--${n}=`)) || '').slice(n.length + 3);
const PC_GLEICH = schalter('pc-gleich');
const HANDY_CSS = schalter('handy-css');
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

let ok = 0, gesamt = 0;
function pruefe(name, gut, detail = '') {
  gesamt++; if (gut) ok++;
  // INTENTIONAL-SLOP[T4]: die Pruefzeile ist die Ausgabe des Tests (wie in tests/r17-hover-handy.test.mjs)
  console.log(`${gut ? 'ok  ' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(detail)}`);
}

// die Ziele in den echten Screens; ziel = ein sichtbares Element, das nicht gerade gewaehlt ist
const ZIELE = [
  { name: 'Einstellungen: Navigation (.es-nav-punkt)', screen: 'einstellungen', ziel: '.es-nav-punkt:not([aria-current="true"])' },
  { name: 'Kopf-Chip (.kopf-chips > .chip)', screen: 'arena', ziel: '.haupt-kopf .kopf-chips > .chip' },
];

async function oeffne(browser, { w, h, schema, touch, css }) {
  const kontext = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: schema, deviceScaleFactor: 1,
    hasTouch: touch, isMobile: touch, serviceWorkers: 'block' });
  for (const [datei, inhalt] of css || []) {
    await kontext.route((u) => new URL(u).pathname.endsWith('/' + datei), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: inhalt }));
  }
  const s = await kontext.newPage();
  const fehler = [];
  s.on('pageerror', (e) => fehler.push(e.message));
  // Tag des Willkommens wie im Paket start (Grenze 4:00), Sprache gewaehlt, keine Hinweise
  await s.addInitScript(({ P, schema }) => {
    if (!location.protocol.startsWith('http')) return; // about:blank hat keinen Speicher
    if (sessionStorage.getItem('hr-probe')) return;
    sessionStorage.setItem('hr-probe', '1');
    localStorage.clear();
    const d = new Date(); if (d.getHours() < 4) d.setDate(d.getDate() - 1);
    const z = (n) => String(n).padStart(2, '0');
    localStorage.setItem(P + 'modul:start', JSON.stringify({ gesehen: `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}` }));
    localStorage.setItem(P + 'einstellungen', JSON.stringify({ sprache: 'de', spracheGewaehlt: true, modus: schema === 'dark' ? 'dunkel' : 'hell' }));
    localStorage.setItem(P + 'hinweis-installieren', '1');
  }, { P, schema });
  return { kontext, s, fehler };
}

// Ziel im sichtbaren Screen; null, wenn keins sichtbar ist
async function finde(s, z) {
  await s.goto(`${BASIS}#${z.screen}`);
  const el = s.locator(`.screen:not([hidden]) ${z.ziel}`).filter({ visible: true }).first();
  await el.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
  if (!(await el.count())) return null;
  await el.scrollIntoViewIfNeeded(); await s.mouse.move(1, 1); await warte(400);
  return el;
}

// Aussehen: Farbe, Flaeche, Rand, Schatten, Filter, Verschiebung des Elements und seiner Nachfahren
const aussehen = (el) => el.evaluate((x) => [x, ...x.querySelectorAll('*')].map((k) => {
  const st = getComputedStyle(k);
  return [st.color, st.backgroundColor, st.borderTopColor, st.boxShadow, st.filter, st.transform].join(' | ');
}).join(' || '));

// :hover-Regeln ausserhalb von @media (hover: hover), die das Element oder ein Kind treffen; Muster wie zeigerAusserhalb()
// in tests/r17-kopf.test.mjs
const zeigerAusserhalb = (el) => el.evaluate((x) => {
  const knoten = [x, ...x.querySelectorAll('*')];
  const funde = [];
  const geh = (regeln, unterHover) => {
    for (const r of regeln) {
      if (r.cssRules && r.media) { geh(r.cssRules, unterHover || /\(\s*hover\s*:\s*hover\s*\)/.test(r.media.mediaText)); continue; }
      if (r.cssRules && !r.selectorText) { geh(r.cssRules, unterHover); continue; }
      if (!r.selectorText || !r.selectorText.includes(':hover') || unterHover) continue;
      for (const teil of r.selectorText.split(',')) {
        if (!teil.includes(':hover')) continue;
        const ohne = teil.replace(/:hover/g, '').trim() || '*';
        // INTENTIONAL-SLOP[F1]: matches() wirft bei Pseudo-Elementen und bei :not() ohne Inhalt; die treffen keinen Knopf selbst
        try { if (knoten.some((k) => k.matches(ohne))) funde.push(teil.trim()); } catch (e) { /* kein Element-Selektor */ }
      }
    }
  };
  // ein unlesbares Blatt koennte eine Zeiger-Regel verstecken: es zaehlt als Fund statt still uebersprungen
  for (const blatt of document.styleSheets) { try { geh(blatt.cssRules, false); } catch (e) { funde.push(`Blatt nicht lesbar: ${blatt.href}`); } }
  return [...new Set(funde)];
});

async function beruehrung(browser, { geraet, w, h, schema, css }) {
  const name = `${geraet} ${w} x ${h} ${schema === 'dark' ? 'dunkel' : 'hell'}`;
  const { kontext, s, fehler } = await oeffne(browser, { w, h, schema, touch: true, css });
  pruefe(`${name}: Geraet ohne Zeiger (hover: none)`, await s.evaluate(() => matchMedia('(hover: none)').matches));
  for (const z of ZIELE) {
    const el = await finde(s, z);
    if (!el) { pruefe(`${name} ${z.name}: sichtbar in #${z.screen}`, false, 'nicht gefunden'); continue; }
    const ruhe = await aussehen(el);
    await el.hover(); await warte(500);
    const nach = await aussehen(el);
    pruefe(`${name} ${z.name}: Zeiger an der Tippstelle sieht aus wie Ruhe`, nach === ruhe, { ruhe, nach });
    const funde = await zeigerAusserhalb(el);
    pruefe(`${name} ${z.name}: keine :hover-Regel ausserhalb von @media (hover: hover)`, funde.length === 0, funde);
    await s.mouse.move(1, 1);
  }
  pruefe(`${name}: keine Seitenfehler`, fehler.length === 0, fehler);
  await kontext.close();
}

// PC: unter dem Zeiger sichtbar anders; die Bilder unter dem Zeiger fuer den Vergleich mit --pc-gleich
async function pc(browser, schema, css = null) {
  const { kontext, s, fehler } = await oeffne(browser, { w: 1440, h: 900, schema, touch: false, css });
  const erg = [];
  for (const z of ZIELE) {
    const el = await finde(s, z);
    if (!el) { erg.push(null); continue; }
    const ruhe = await aussehen(el);
    await el.hover(); await warte(500);
    erg.push({ anders: ruhe !== await aussehen(el), bild: await el.screenshot() });
    await s.mouse.move(1, 1);
  }
  await kontext.close();
  return { erg, fehler };
}

let pw;
try { pw = require(process.env.PLAYWRIGHT_PFAD || 'playwright'); } catch (e) { pw = require('/opt/node-tools/node_modules/playwright'); }
const server = spawn(process.execPath, ['tests/testserver.mjs', String(PORT), '--bind', '127.0.0.1'], { cwd: WURZEL, stdio: 'ignore' });
let browser = null;
try {
  let bereit = false, letzter = null;
  for (let i = 0; i < 60 && !bereit; i++) {
    try { const r = await fetch(BASIS); await r.arrayBuffer(); bereit = r.ok; } catch (e) { letzter = e; }
    if (!bereit) await warte(150);
  }
  if (!bereit) throw new Error(`Testserver nicht erreichbar: ${letzter?.message || 'keine 200-Antwort'}`);
  browser = await browserTyp(pw).launch({ headless: true });
  // geaenderte Stylesheets im Stand <rev> (nur mit --pc-gleich bzw. --handy-css)
  const cssAus = (rev, name) => {
    const git = (...a) => execFileSync('git', a, { cwd: WURZEL, encoding: 'utf8' });
    const dateien = git('diff', '--name-only', rev, '--', 'css').split(/\r?\n/).filter(Boolean);
    pruefe(`--${name}=${rev}: geaenderte Stylesheets gefunden (${dateien.join(', ')})`, dateien.length > 0, dateien);
    return dateien.map((d) => [d, git('show', `${rev}:${d}`)]);
  };
  const pcCss = PC_GLEICH ? cssAus(PC_GLEICH, 'pc-gleich') : null;
  const handyCss = HANDY_CSS ? cssAus(HANDY_CSS, 'handy-css') : null;
  for (const schema of ['light', 'dark']) {
    await beruehrung(browser, { geraet: 'Handy', w: 390, h: 844, schema, css: handyCss });
    await beruehrung(browser, { geraet: 'iPad hoch', w: 820, h: 1180, schema, css: handyCss });
    const name = `PC 1440 x 900 ${schema === 'dark' ? 'dunkel' : 'hell'}`;
    const jetzt = await pc(browser, schema);
    pruefe(`${name}: keine Seitenfehler`, jetzt.fehler.length === 0, jetzt.fehler);
    ZIELE.forEach((z, i) => pruefe(`${name} ${z.name}: unter dem Zeiger sichtbar anders als in Ruhe`, !!jetzt.erg[i]?.anders, jetzt.erg[i] ? '' : 'nicht gefunden'));
    if (pcCss) {
      const vorher = await pc(browser, schema, pcCss);
      ZIELE.forEach((z, i) => pruefe(`${name} ${z.name}: unter dem Zeiger bildgleich mit ${PC_GLEICH}`,
        !!(vorher.erg[i] && jetzt.erg[i] && vorher.erg[i].bild.equals(jetzt.erg[i].bild)),
        { bytes: [vorher.erg[i]?.bild.length, jetzt.erg[i]?.bild.length] }));
    }
  }
} catch (e) {
  pruefe('Lauf ohne Ausnahme', false, String(e && e.stack || e));
} finally {
  if (browser) await browser.close().catch(() => {});
  server.kill();
}
// INTENTIONAL-SLOP[T4]: Summenzeile, die tests/alle.mjs auswertet
console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
