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

// die Ziele in den echten Screens; gemessen wird JEDES sichtbare Element, das nicht gerade gewaehlt ist;
// muss = mindestens eines der gemessenen Elemente trifft diesen Selektor (der antippbare Chip, nicht nur der Sterne-Zaehler)
const ZIELE = [
  { name: 'Einstellungen: Navigation (.es-nav-punkt)', screen: 'einstellungen', ziel: '.es-nav-punkt:not([aria-current="true"])' },
  { name: 'Kopf-Chip (.kopf-chips > .chip)', screen: 'arena', ziel: '.haupt-kopf .kopf-chips > .chip', muss: '[role="button"]' },
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

// alle sichtbaren Ziele im Screen; leer, wenn keins sichtbar ist
async function finde(s, z) {
  await s.goto(`${BASIS}#${z.screen}`);
  const alle = s.locator(`.screen:not([hidden]) ${z.ziel}`).filter({ visible: true });
  await alle.first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
  return alle.all();
}

// die gemessenen Elemente decken z.muss ab (ohne muss: mindestens eins)
const deckt = (z, els) => (els.length ? (z.muss ? Promise.all(els.map((e) => e.evaluate((x, m) => x.matches(m), z.muss))).then((t) => t.some(Boolean)) : true) : false);
const kennung = (el) => el.evaluate((x) => `${x.tagName.toLowerCase()}.${[...x.classList].join('.')}${x.getAttribute('role') ? `[role=${x.getAttribute('role')}]` : ''}`);

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
  // nur an Kommas der obersten Ebene trennen: .x:is(.a, .b):hover ist EIN Selektor (Muster tests/r18-rd-hover.test.mjs, R19)
  const teile = (sel) => {
    const aus = []; let tiefe = 0, an = 0;
    for (let i = 0; i < sel.length; i++) {
      if (sel[i] === '(' || sel[i] === '[') tiefe++;
      else if (sel[i] === ')' || sel[i] === ']') tiefe--;
      else if (sel[i] === ',' && tiefe === 0) { aus.push(sel.slice(an, i)); an = i + 1; }
    }
    return aus.concat(sel.slice(an));
  };
  // :hover gilt als erfuellt (:is(*); so bleibt :not(:hover) gueltig und trifft nie). Ein Pseudo-Element hinter :hover
  // (::before, ::after) zeichnet am Element selbst und zaehlt fuer es. Wirft matches() trotzdem, ist das ein Fund.
  const element = (teil) => teil.replace(/:hover/g, ':is(*)').replace(/::[a-z-]+(\([^)]*\))?|:(before|after|first-line|first-letter)\b/g, '').trim() || '*';
  const geh = (regeln, unterHover) => {
    for (const r of regeln) {
      if (r.cssRules && r.media) { geh(r.cssRules, unterHover || /\(\s*hover\s*:\s*hover\s*\)/.test(r.media.mediaText)); continue; }
      if (r.cssRules && !r.selectorText) { geh(r.cssRules, unterHover); continue; }
      if (!r.selectorText || !r.selectorText.includes(':hover') || unterHover) continue;
      for (const teil of teile(r.selectorText)) {
        if (!teil.includes(':hover')) continue;
        try { if (knoten.some((k) => k.matches(element(teil)))) funde.push(teil.trim()); }
        catch (e) { funde.push(`Selektor nicht pruefbar: ${teil.trim()} (${e.message})`); }
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
    const els = await finde(s, z);
    if (!(await deckt(z, els))) { pruefe(`${name} ${z.name}: sichtbar in #${z.screen}${z.muss ? ` inkl. ${z.muss}` : ''}`, false, `${els.length} gefunden`); continue; }
    const anders = [], funde = new Set();
    for (const el of els) {
      await el.scrollIntoViewIfNeeded(); await s.mouse.move(1, 1); await warte(300);
      const ruhe = await aussehen(el);
      await el.hover(); await warte(500);
      const nach = await aussehen(el);
      if (nach !== ruhe) anders.push({ el: await kennung(el), ruhe, nach });
      for (const f of await zeigerAusserhalb(el)) funde.add(f);
      await s.mouse.move(1, 1);
    }
    pruefe(`${name} ${z.name} (${els.length} Elemente): Zeiger an der Tippstelle sieht aus wie Ruhe`, anders.length === 0, anders);
    pruefe(`${name} ${z.name} (${els.length} Elemente): keine :hover-Regel ausserhalb von @media (hover: hover)`, funde.size === 0, [...funde]);
  }
  // Selbsttest des Scanners (R19) an einem sichtbaren Ziel: eine :is()-Liste mit Komma und ein Pseudo-Element hinter :hover
  // sind Funde; beide fielen mit split(',') still durch, weil matches() warf. Die Regeln kommen erst nach der echten Pruefung.
  const probeEl = (await finde(s, ZIELE[0]))[0];
  if (probeEl) {
    await probeEl.evaluate((x) => x.setAttribute('data-scanner-probe', ''));
    await s.addStyleTag({ content: '[data-scanner-probe]:is(.gibt-es-nicht, [data-scanner-probe]):hover { outline: 2px solid red } [data-scanner-probe]:hover::after { content: "" }' });
  }
  const probe = probeEl ? await zeigerAusserhalb(probeEl) : [];
  pruefe(`${name}: Scanner findet :is()-Liste und ::after hinter :hover (Selbsttest)`,
    probe.some((f) => f.startsWith('[data-scanner-probe]:is(.gibt-es-nicht')) && probe.some((f) => f.startsWith('[data-scanner-probe]:hover::after')), probe);
  pruefe(`${name}: keine Seitenfehler`, fehler.length === 0, fehler);
  await kontext.close();
}

// PC: unter dem Zeiger sichtbar anders; die Bilder unter dem Zeiger fuer den Vergleich mit --pc-gleich
async function pc(browser, schema, css = null) {
  const { kontext, s, fehler } = await oeffne(browser, { w: 1440, h: 900, schema, touch: false, css });
  const erg = [];
  for (const z of ZIELE) {
    const els = await finde(s, z);
    if (!(await deckt(z, els))) { erg.push(null); continue; }
    const je = [];
    for (const el of els) {
      await el.scrollIntoViewIfNeeded(); await s.mouse.move(1, 1); await warte(300);
      const ruhe = await aussehen(el);
      await el.hover(); await warte(500);
      je.push({ el: await kennung(el), anders: ruhe !== await aussehen(el), bild: await el.screenshot() });
      await s.mouse.move(1, 1);
    }
    erg.push({ anders: je.every((x) => x.anders), gleich: je.filter((x) => !x.anders).map((x) => x.el), bilder: je.map((x) => x.bild) });
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
    ZIELE.forEach((z, i) => pruefe(`${name} ${z.name}: unter dem Zeiger sichtbar anders als in Ruhe`, !!jetzt.erg[i]?.anders, jetzt.erg[i] ? { ohneAenderung: jetzt.erg[i].gleich } : 'nicht gefunden'));
    if (pcCss) {
      const vorher = await pc(browser, schema, pcCss);
      ZIELE.forEach((z, i) => pruefe(`${name} ${z.name}: unter dem Zeiger bildgleich mit ${PC_GLEICH}`,
        !!(vorher.erg[i] && jetzt.erg[i] && vorher.erg[i].bilder.length === jetzt.erg[i].bilder.length
          && vorher.erg[i].bilder.every((b, j) => b.equals(jetzt.erg[i].bilder[j]))),
        { anzahl: [vorher.erg[i]?.bilder.length, jetzt.erg[i]?.bilder.length] }));
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
