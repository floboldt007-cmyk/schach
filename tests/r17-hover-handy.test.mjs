// Zeiger-Zustaende am Handy (R17 hover-handy, 14.11.2026): Regeln mit :hover ausserhalb von @media (hover: hover) bleiben
// nach dem Tippen haengen, weil der Browser den Zeiger an der Tippstelle stehen laesst. Fuer jeden Knopf, dessen Regel in
// den Media-Block gewandert ist, prueft der Test am Handy (390 x 844, Touch, hover: none), dass er nach dem Tippen aussieht
// wie in Ruhe, und am PC (1440 x 900, Maus), dass er unter dem Zeiger weiter anders aussieht. Hell und dunkel.
// Die Knoepfe stehen als Nachbau mit den echten Klassen auf der Startseite, darueber die echten Stylesheets (die Pakete
// laden ihres sonst erst auf ihrem Screen). Klicks auf den Nachbau werden abgefangen.
//
//   node tests/r17-hover-handy.test.mjs
//   node tests/r17-hover-handy.test.mjs --pc-gleich=<rev>   dazu: am PC unter dem Zeiger bildgleich mit <rev>
//                                                           (geaenderte css/-Dateien kommen dann aus git show <rev>:...)
//   node tests/r17-hover-handy.test.mjs --handy-css=<rev>   Gegenprobe: der Handy-Teil mit den css/-Dateien aus <rev>
//                                                           (auf dbe3c55 muss er rot werden)
//   PORT=8973 node tests/r17-hover-handy.test.mjs            eigener Port (Standard: frei)
//
// Dazu am Handy die echten Screens #lernen und #bestenliste (Zeiger bleibt an der Tippstelle stehen, wie nach einem
// Tippen) und ein CSSOM-Check: keine :hover-Regel, die einen der 8 Knoepfe trifft, steht ausserhalb von @media (hover: hover).
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
const PC_GLEICH = (process.argv.find((a) => a.startsWith('--pc-gleich=')) || '').slice('--pc-gleich='.length);
const HANDY_CSS = (process.argv.find((a) => a.startsWith('--handy-css=')) || '').slice('--handy-css='.length);
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

let ok = 0, gesamt = 0;
function pruefe(name, gut, detail = '') {
  gesamt++; if (gut) ok++;
  // INTENTIONAL-SLOP[T4]: die Pruefzeile ist die Ausgabe des Tests (wie in tests/heim.test.mjs)
  console.log(`${gut ? 'ok  ' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(detail)}`);
}

// Die Paket-Stylesheets, in denen eine Regel gewandert ist (css/ergebnis.css steht schon in index.html)
const PAKET_CSS = ['css/pakete/emotes.css', 'css/pakete/lernen.css', 'css/pakete/punkte.css', 'css/pakete/sammlung.css'];
// Nachbau je Knopf: Markup mit den echten Klassen; ziel = das getippte Element, mess = die Elemente, deren Aussehen zaehlt
const KNOEPFE = [
  { name: 'Ergebnis: Freund herausfordern (.erg-freund)', html: '<button class="erg-freund" type="button">Freund herausfordern</button>' },
  { name: 'Ergebnis: Zu den Bots (.erg-lobby)', html: '<button class="erg-lobby" type="button"><span>Zu den Bots</span></button>' },
  { name: 'Ergebnis: Zur Analyse (.erg-link)', html: '<button class="erg-link" type="button"><span>Zur Analyse</span></button>' },
  { name: 'Emote-Wahl (.em-wahl svg.emote-sticker)', html: '<button class="em-wahl" type="button"><svg class="emote-sticker" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="currentColor"/></svg>Hallo</button>' },
  { name: 'Lernen: Bereich (.ms-bkarte)', html: '<button class="ms-bkarte dr" type="button" aria-pressed="false"><b>Taktik</b></button>' },
  { name: 'Lernen: Lektion (.ms-lektion)', html: '<button class="ms-lektion" type="button">Gabel</button>' },
  { name: 'Bestenliste: Zeitraum (.bl-fenster-wahl select)', html: '<label class="bl-fenster-wahl"><select><option>Diese Woche</option><option>Gesamt</option></select></label>', ziel: 'select' },
  { name: 'Sammlung: waehlbares Teil (.sa-teil[data-waehlbar])', html: '<div class="sa-teil" role="listitem" data-waehlbar data-zustand="besitz"><button class="sa-wahl" type="button" aria-label="Ausruesten"></button><span>Holz</span></div>', ziel: '.sa-wahl', mess: '.sa-teil' },
];

// Aussehen eines Knopfs: Farbe, Flaeche, Rand, Schatten, Filter, Verschiebung des Elements und seiner Nachfahren
const aussehen = (s, sel) => s.evaluate((sel) => {
  const el = document.querySelector(sel);
  return [el, ...el.querySelectorAll('*')].map((e) => {
    const st = getComputedStyle(e);
    return [st.color, st.backgroundColor, st.borderTopColor, st.boxShadow, st.filter, st.transform].join(' | ');
  }).join(' || ');
}, sel);

async function kontextMit(browser, { w, h, schema, touch, basisCss }) {
  const kontext = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: schema, deviceScaleFactor: 1,
    hasTouch: touch, isMobile: touch, serviceWorkers: 'block' });
  if (basisCss) {
    for (const [datei, inhalt] of basisCss) {
      await kontext.route((u) => new URL(u).pathname.endsWith('/' + datei), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: inhalt }));
    }
  }
  const s = await kontext.newPage();
  const fehler = [];
  s.on('pageerror', (e) => fehler.push(e.message));
  return { kontext, s, fehler };
}

async function seite(browser, { w, h, schema, touch, basisCss }) {
  const { kontext, s, fehler } = await kontextMit(browser, { w, h, schema, touch, basisCss });
  // Tag des Willkommens wie im Paket start (Grenze 4:00), Sprache gewaehlt, keine Hinweise
  await s.addInitScript(({ P }) => {
    if (!location.protocol.startsWith('http')) return; // about:blank hat keinen Speicher
    if (sessionStorage.getItem('hh-probe')) return;
    sessionStorage.setItem('hh-probe', '1');
    localStorage.clear();
    const d = new Date(); if (d.getHours() < 4) d.setDate(d.getDate() - 1);
    const z = (n) => String(n).padStart(2, '0');
    localStorage.setItem(P + 'modul:start', JSON.stringify({ gesehen: `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}` }));
    localStorage.setItem(P + 'einstellungen', JSON.stringify({ sprache: 'de', spracheGewaehlt: true }));
    localStorage.setItem(P + 'hinweis-installieren', '1');
  }, { P });
  await s.goto(BASIS + '#heim');
  await s.waitForSelector('.heim-los', { state: 'visible', timeout: 20000 });
  await warte(800);
  // Paket-Stylesheets dazu, falls die Startseite sie nicht schon geladen hat; dann der Nachbau ueber der Seite
  const geladen = await s.evaluate(async ({ dateien, knoepfe }) => {
    const da = (d) => [...document.styleSheets].some((x) => x.href && new URL(x.href).pathname.endsWith('/' + d));
    await Promise.all(dateien.filter((d) => !da(d)).map((d) => new Promise((ja, nein) => {
      const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = d;
      l.onload = ja; l.onerror = () => nein(new Error(d)); document.head.append(l);
    })));
    const buehne = document.createElement('div');
    buehne.id = 'hh-buehne';
    buehne.style.cssText = 'position:fixed;inset:0;z-index:2147483647;overflow:auto;display:flex;flex-direction:column;align-items:flex-start;'
      + `gap:16px;padding:24px;background:${getComputedStyle(document.body).backgroundColor}`;
    knoepfe.forEach((k, i) => {
      const platz = document.createElement('div');
      platz.dataset.hh = String(i); platz.style.cssText = 'display:block;padding:6px';
      platz.innerHTML = k.html;
      buehne.append(platz);
    });
    document.body.append(buehne);
    document.addEventListener('click', (e) => { if (e.target.closest('#hh-buehne')) { e.preventDefault(); e.stopImmediatePropagation(); } }, true);
    return dateien.every(da);
  }, { dateien: PAKET_CSS, knoepfe: KNOEPFE.map((k) => ({ html: k.html })) });
  await warte(300);
  return { kontext, s, fehler, geladen };
}

// :hover-Regeln ausserhalb von @media (hover: hover), die einen der Knoepfe (oder ein gemessenes Kind) treffen; Muster wie
// zeigerAusserhalb() in tests/r17-kopf.test.mjs (so/R17-kopf)
const zeigerAusserhalb = (s, selektoren) => s.evaluate((selektoren) => {
  const knoepfe = selektoren.flatMap((x) => [...document.querySelectorAll(x)]);
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
        try { if (knoepfe.some((k) => k.matches(ohne))) funde.push(teil.trim()); } catch (e) { /* kein Element-Selektor */ }
      }
    }
  };
  // ein unlesbares Blatt koennte eine Zeiger-Regel verstecken: es zaehlt als Fund statt still uebersprungen
  for (const blatt of document.styleSheets) { try { geh(blatt.cssRules, false); } catch (e) { funde.push(`Blatt nicht lesbar: ${blatt.href}`); } }
  return { anzahl: knoepfe.length, funde: [...new Set(funde)] };
}, selektoren);

// getippt wird k.ziel (sonst der Knopf selbst), gemessen k.mess (sonst das getippte Element)
const sel = (i, k, art) => `#hh-buehne [data-hh="${i}"] ${(art === 'mess' && k.mess) || k.ziel || '> *'}`;

async function handy(browser, schema, basisCss = null) {
  const name = `Handy 390 x 844 ${schema === 'dark' ? 'dunkel' : 'hell'}`;
  const { kontext, s, fehler, geladen } = await seite(browser, { w: 390, h: 844, schema, touch: true, basisCss });
  pruefe(`${name}: Geraet ohne Zeiger (hover: none), Paket-Stylesheets geladen`, geladen && await s.evaluate(() => matchMedia('(hover: none)').matches), { geladen });
  const ort = await s.evaluate(() => location.hash);
  for (const [i, k] of KNOEPFE.entries()) {
    const ziel = sel(i, k, 'ziel'), mess = sel(i, k, 'mess');
    await s.evaluate((z) => { document.activeElement?.blur(); document.querySelector(z).scrollIntoView({ block: 'center' }); }, ziel);
    await warte(250);
    const ruhe = await aussehen(s, mess);
    await s.tap(ziel); await warte(500);
    await s.evaluate(() => document.activeElement?.blur()); await warte(300);
    const nach = await aussehen(s, mess);
    pruefe(`${name} ${k.name}: nach dem Tippen wie in Ruhe`, nach === ruhe, { ruhe, nach });
  }
  pruefe(`${name}: Tippen hat die Seite nicht verlassen`, (await s.evaluate(() => location.hash)) === ort);
  const zeiger = await zeigerAusserhalb(s, KNOEPFE.flatMap((k, i) => [sel(i, k, 'ziel'), `${sel(i, k, 'ziel')} *`]));
  pruefe(`${name}: keine :hover-Regel der Knoepfe ausserhalb von @media (hover: hover) (${zeiger.anzahl} Elemente)`,
    zeiger.anzahl >= KNOEPFE.length && zeiger.funde.length === 0, zeiger.funde);
  pruefe(`${name}: keine Seitenfehler`, fehler.length === 0, fehler);
  await kontext.close();
}

// Echte Screens am Handy (Kaltreview hover-handy): der Zeiger bleibt per hover() an der Stelle stehen, wie nach einem Tippen
const ECHT = [
  { screen: 'lernen', ziel: '.ms-bkarte[aria-pressed="false"]' },
  { screen: 'lernen', ziel: '.ms-lektion' },
  { screen: 'bestenliste', ziel: '.bl-fenster-wahl select' },
];
async function echteScreens(browser, schema, basisCss = null) {
  const name = `Handy 390 x 844 ${schema === 'dark' ? 'dunkel' : 'hell'} echter Screen`;
  const { kontext, s, fehler } = await kontextMit(browser, { w: 390, h: 844, schema, touch: true, basisCss });
  await s.addInitScript(({ P, schema }) => {
    if (sessionStorage.getItem('hh-echt')) return;
    sessionStorage.setItem('hh-echt', '1');
    localStorage.clear();
    const d = new Date(); if (d.getHours() < 4) d.setDate(d.getDate() - 1);
    const z = (n) => String(n).padStart(2, '0');
    localStorage.setItem(P + 'modul:start', JSON.stringify({ gesehen: `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}` }));
    localStorage.setItem(P + 'einstellungen', JSON.stringify({ sprache: 'de', spracheGewaehlt: true, modus: schema === 'dark' ? 'dunkel' : 'hell' }));
    localStorage.setItem(P + 'hinweis-installieren', '1');
  }, { P, schema });
  for (const e of ECHT) {
    await s.goto(`${BASIS}#${e.screen}`);
    const el = s.locator(`.screen:not([hidden]) ${e.ziel}`).filter({ visible: true }).first();
    await el.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
    // der Zeitraum der Bestenliste steht nur bei Reitern mit Zeitraum: dann die Reiter der Reihe nach waehlen
    for (const r of (await el.count()) ? [] : await s.locator('.screen:not([hidden]) .bl-steuer-reiter :is(button, [role="tab"])').all()) {
      await r.click().catch(() => {}); await warte(800);
      if (await el.count()) break;
    }
    if (!(await el.count())) { pruefe(`${name} #${e.screen} ${e.ziel}: sichtbar`, false, 'nicht gefunden'); continue; }
    await el.scrollIntoViewIfNeeded(); await s.mouse.move(1, 1); await warte(400);
    const merke = () => el.evaluate((x) => [x, ...x.querySelectorAll('*')].map((k) => {
      const st = getComputedStyle(k);
      return [st.color, st.backgroundColor, st.borderTopColor, st.boxShadow, st.filter, st.transform].join(' | ');
    }).join(' || '));
    const ruhe = await merke();
    await el.hover(); await warte(500);
    const nach = await merke();
    await s.mouse.move(1, 1);
    pruefe(`${name} #${e.screen} ${e.ziel}: Zeiger an der Tippstelle sieht aus wie Ruhe`, nach === ruhe, { ruhe, nach });
    const zeiger = await zeigerAusserhalb(s, [`.screen:not([hidden]) ${e.ziel}`, `.screen:not([hidden]) ${e.ziel} *`]);
    pruefe(`${name} #${e.screen} ${e.ziel}: keine :hover-Regel ausserhalb von @media (hover: hover)`, zeiger.anzahl > 0 && zeiger.funde.length === 0, zeiger.funde);
  }
  pruefe(`${name}: keine Seitenfehler`, fehler.length === 0, fehler);
  await kontext.close();
}

// PC: unter dem Zeiger sichtbar anders; mit basisCss die Bilder unter dem Zeiger fuer den Vergleich
async function pc(browser, schema, basisCss = null) {
  const { kontext, s, fehler, geladen } = await seite(browser, { w: 1440, h: 900, schema, touch: false, basisCss });
  const bilder = [], unterschied = [];
  for (const [i, k] of KNOEPFE.entries()) {
    const ziel = sel(i, k, 'ziel'), mess = sel(i, k, 'mess');
    await s.mouse.move(1, 1); await warte(300);
    const ruhe = await aussehen(s, mess);
    await s.locator(ziel).hover(); await warte(500);
    unterschied.push(ruhe !== await aussehen(s, mess));
    bilder.push(await s.locator(`#hh-buehne [data-hh="${i}"]`).screenshot());
  }
  await kontext.close();
  return { bilder, unterschied, fehler, geladen };
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
  const cssAus = (rev, schalter) => {
    const git = (...a) => execFileSync('git', a, { cwd: WURZEL, encoding: 'utf8' });
    const dateien = git('diff', '--name-only', rev, '--', 'css').split(/\r?\n/).filter(Boolean);
    pruefe(`${schalter}=${rev}: geaenderte Stylesheets gefunden (${dateien.join(', ')})`, dateien.length > 0, dateien);
    return dateien.map((d) => [d, git('show', `${rev}:${d}`)]);
  };
  const basisCss = PC_GLEICH ? cssAus(PC_GLEICH, '--pc-gleich') : null;
  const handyCss = HANDY_CSS ? cssAus(HANDY_CSS, '--handy-css') : null;
  for (const schema of ['light', 'dark']) {
    await handy(browser, schema, handyCss);
    await echteScreens(browser, schema, handyCss);
    const name = `PC 1440 x 900 ${schema === 'dark' ? 'dunkel' : 'hell'}`;
    const jetzt = await pc(browser, schema);
    pruefe(`${name}: Paket-Stylesheets geladen, keine Seitenfehler`, jetzt.geladen && jetzt.fehler.length === 0, jetzt.fehler);
    KNOEPFE.forEach((k, i) => pruefe(`${name} ${k.name}: unter dem Zeiger sichtbar anders als in Ruhe`, jetzt.unterschied[i]));
    if (basisCss) {
      const vorher = await pc(browser, schema, basisCss);
      KNOEPFE.forEach((k, i) => pruefe(`${name} ${k.name}: unter dem Zeiger bildgleich mit ${PC_GLEICH}`,
        vorher.bilder[i].equals(jetzt.bilder[i]), { bytes: [vorher.bilder[i].length, jetzt.bilder[i].length] }));
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
