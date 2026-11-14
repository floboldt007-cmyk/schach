// Knoepfe im Kopfbereich (css/navigation.css: .kopf-knopf, .kopf-premium) in Ruhe, unter dem Zeiger, mit Fokus und
// gedrueckt (R17 kopf, 14.11.2026; Muster wie tests/r17-heim-hover.test.mjs): Text mindestens 4,5:1 und Symbol mindestens
// 3:1 gegen die Flaeche des Knopfs, unter dem Zeiger sichtbar anders als in Ruhe, mit Tastatur-Fokus ein Rahmen, gedrueckt
// sichtbar anders, Ziel mindestens 44 px (die App-Regel, strenger als 24 px aus WCAG 2.5.8). Hell und dunkel, PC
// (1440 x 900) und iPad hoch (820 x 1180, dort nur die Krone ohne Wort). Dazu das Handy (390 x 844, hasTouch, isMobile):
// dort kennt das Geraet kein Zeigen, ein Tippen darf keinen Zeiger-Zustand haengen lassen. Darum stehen Zeiger-Regeln der
// Kopf-Knoepfe nur unter @media (hover: hover); das prueft der Test auch direkt in den Stylesheets.
//
//   node tests/r17-kopf.test.mjs
//   PORT=8974 node tests/r17-kopf.test.mjs   eigener Port (Standard: frei)
//
// Playwright: Pfad per Umgebungsvariable PLAYWRIGHT_PFAD, sonst 'playwright' oder /opt/node-tools.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { browserTyp } from './browser.mjs';

const require = createRequire(import.meta.url);
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || await (await import('./freier-port.mjs')).freierPort();
const BASIS = `http://127.0.0.1:${PORT}/index.html?test`;
const P = 'schach-arena:v1:';
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

let ok = 0, gesamt = 0;
function pruefe(name, gut, detail = '') {
  gesamt++; if (gut) ok++;
  // INTENTIONAL-SLOP[T4]: die Pruefzeile ist die Ausgabe des Tests (wie in tests/heim.test.mjs)
  console.log(`${gut ? 'ok  ' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(detail)}`);
}

// Text und Symbol eines Knopfs gegen seine Flaeche (naechste deckende Flaeche nach oben, durchscheinende Schichten darueber
// gemischt, wie tests/r17-heim-hover.test.mjs), dazu was einen Zustand sichtbar macht
const zustand = (s, sel) => s.evaluate((sel) => {
  const knopf = document.querySelector(sel);
  // rgb()/rgba() und color(srgb r g b / a), so meldet Chromium ein berechnetes color-mix()
  const farbe = (c) => {
    const srgb = c.match(/color\(srgb ([^)]+)\)/);
    if (srgb) { const p = srgb[1].split(/[ /]+/).filter(Boolean).map(Number); return [p[0] * 255, p[1] * 255, p[2] * 255, p.length > 3 ? p[3] : 1]; }
    const p = (c.match(/rgba?\(([^)]+)\)/) || [, '0,0,0,0'])[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
  };
  const ueber = (o, u) => [0, 1, 2].map((i) => o[i] * o[3] + u[i] * (1 - o[3])).concat(1);
  const lum = (f) => f.slice(0, 3).map((v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }).reduce((x, v, i) => x + v * [0.2126, 0.7152, 0.0722][i], 0);
  const kontrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const flaeche = (el) => {
    const schichten = [];
    for (let e = el; e; e = e.parentElement) {
      const f = farbe(getComputedStyle(e).backgroundColor);
      if (f[3] > 0) { schichten.push(f); if (f[3] >= 1) break; }
    }
    let u = [255, 255, 255, 1];
    for (const f of schichten.reverse()) u = ueber(f, u);
    return u;
  };
  const rund = (k) => Math.round(k * 100) / 100;
  const st = getComputedStyle(knopf);
  const sichtbar = (e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && getComputedStyle(e).display !== 'none';
  const texte = [knopf, ...knopf.querySelectorAll('*')].filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && sichtbar(e));
  let text = Infinity;
  for (const e of texte) { const g = flaeche(e); text = Math.min(text, kontrast(ueber(farbe(getComputedStyle(e).color), g), g)); }
  // Symbol: das sichtbare svg, gezeichnet in seiner Farbe (stroke/fill = currentColor)
  let symbol = Infinity;
  for (const e of knopf.querySelectorAll('svg')) {
    if (!sichtbar(e)) continue;
    const g = flaeche(knopf);
    symbol = Math.min(symbol, kontrast(ueber(farbe(getComputedStyle(e).color), g), g));
  }
  const r = knopf.getBoundingClientRect();
  return { text: texte.length ? rund(text) : null, symbol: Number.isFinite(symbol) ? rund(symbol) : null,
    sicht: [st.backgroundColor, st.boxShadow, st.filter, st.transform, st.color].join(' | '),
    rahmen: st.outlineStyle !== 'none' && parseFloat(st.outlineWidth) > 0, b: Math.round(r.width), h: Math.round(r.height) };
}, sel);

// alle sichtbaren Kopf-Knoepfe, markiert mit data-kk fuer eindeutige Selektoren
const markiere = (s) => s.evaluate(() => {
  const z = [];
  for (const e of document.querySelectorAll('.screen:not([hidden]) .haupt-kopf :is(.kopf-knopf, .kopf-premium)')) {
    if (!e.getClientRects().length || getComputedStyle(e).visibility === 'hidden') continue;
    e.dataset.kk = String(z.length);
    z.push({ sel: `[data-kk="${e.dataset.kk}"]`, name: (e.classList.contains('kopf-premium') ? 'Premium' : e.dataset.aktion || 'knopf') });
  }
  return z;
});

// :hover-Regeln, die einen Kopf-Knopf treffen, aber nicht unter @media (hover: hover) stehen (sonst bleibt der Zustand nach
// einem Tippen auf dem Handy stehen)
const zeigerAusserhalb = (s) => s.evaluate(() => {
  const knoepfe = [...document.querySelectorAll('.haupt-kopf :is(.kopf-knopf, .kopf-premium)')];
  const funde = [];
  const geh = (regeln, unterHover) => {
    for (const r of regeln) {
      if (r.cssRules && r.media) { geh(r.cssRules, unterHover || /\(\s*hover\s*:\s*hover\s*\)/.test(r.media.mediaText)); continue; }
      if (r.cssRules && !r.selectorText) { geh(r.cssRules, unterHover); continue; }
      if (!r.selectorText || !r.selectorText.includes(':hover') || unterHover) continue;
      for (const teil of r.selectorText.split(',')) {
        if (!teil.includes(':hover')) continue;
        const ohne = teil.replace(/:hover/g, '').trim() || '*';
        try { if (knoepfe.some((k) => k.matches(ohne))) funde.push(teil.trim()); } catch (e) { /* unbekannter Selektor */ }
      }
    }
  };
  for (const blatt of document.styleSheets) { try { geh(blatt.cssRules, false); } catch (e) { /* fremdes Blatt */ } }
  return [...new Set(funde)];
});

async function oeffne(browser, { w, h, schema, handy = false }) {
  const kontext = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: schema, deviceScaleFactor: 1,
    hasTouch: handy, isMobile: handy, serviceWorkers: 'block' });
  const s = await kontext.newPage();
  const fehler = [];
  s.on('pageerror', (e) => fehler.push(e.message));
  await s.addInitScript(({ P, schema }) => {
    if (!location.protocol.startsWith('http')) return;
    if (sessionStorage.getItem('kk-probe')) return;
    sessionStorage.setItem('kk-probe', '1');
    localStorage.clear();
    const d = new Date(); if (d.getHours() < 4) d.setDate(d.getDate() - 1);
    const z = (n) => String(n).padStart(2, '0');
    localStorage.setItem(P + 'modul:start', JSON.stringify({ gesehen: `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}` }));
    localStorage.setItem(P + 'einstellungen', JSON.stringify({ sprache: 'de', spracheGewaehlt: true, modus: schema === 'dark' ? 'dunkel' : 'hell' }));
    localStorage.setItem(P + 'hinweis-installieren', '1');
  }, { P, schema });
  await s.goto(BASIS + '#heim');
  await s.waitForSelector('.haupt-kopf .kopf-premium', { state: 'visible', timeout: 20000 });
  await warte(1200);
  return { kontext, s, fehler };
}

async function zeigerGeraet(browser, { w, h, schema }) {
  const { kontext, s, fehler } = await oeffne(browser, { w, h, schema });
  const name = `${w} x ${h} ${schema === 'dark' ? 'dunkel' : 'hell'}`;
  const ziele = await markiere(s);
  pruefe(`${name}: Premium und mindestens zwei runde Kopf-Knoepfe da`, ziele.some((z) => z.name === 'Premium') && ziele.length >= 3, ziele);
  for (const { sel, name: k } of ziele) {
    const erg = {};
    await s.mouse.move(1, 1); await warte(300);
    erg.ruhe = await zustand(s, sel);
    await s.locator(sel).hover(); await warte(400);
    erg.zeiger = await zustand(s, sel);
    await s.mouse.move(1, 1); await warte(300);
    await s.keyboard.press('Shift'); await s.locator(sel).focus(); await warte(300);
    erg.fokus = await zustand(s, sel);
    await s.evaluate(() => document.activeElement?.blur());
    await s.locator(sel).hover(); await s.mouse.down(); await warte(250);
    erg.gedrueckt = await zustand(s, sel);
    // loslassen neben dem Knopf: kein Klick (Shop, Hell/Dunkel und Einstellungen bleiben unbedient)
    await s.mouse.move(1, 1); await s.mouse.up(); await warte(300);
    for (const [z, v] of Object.entries(erg)) {
      if (v.text !== null) pruefe(`${name} ${k} ${z}: Text mindestens 4,5:1 (${v.text})`, v.text >= 4.5, v);
      pruefe(`${name} ${k} ${z}: Symbol mindestens 3:1 (${v.symbol})`, v.symbol !== null && v.symbol >= 3, v);
    }
    pruefe(`${name} ${k}: unter dem Zeiger sichtbar anders als in Ruhe`, erg.zeiger.sicht !== erg.ruhe.sicht, { ruhe: erg.ruhe.sicht, zeiger: erg.zeiger.sicht });
    pruefe(`${name} ${k}: mit Tastatur-Fokus ein Rahmen`, erg.fokus.rahmen, erg.fokus);
    pruefe(`${name} ${k}: gedrueckt sichtbar anders als in Ruhe`, erg.gedrueckt.sicht !== erg.ruhe.sicht, { ruhe: erg.ruhe.sicht, gedrueckt: erg.gedrueckt.sicht });
    pruefe(`${name} ${k}: Ziel mindestens 44 x 44 px (${erg.ruhe.b} x ${erg.ruhe.h})`, erg.ruhe.b >= 44 && erg.ruhe.h >= 44, erg.ruhe);
  }
  pruefe(`${name}: keine Seitenfehler`, !fehler.length, fehler);
  await kontext.close();
}

async function handy(browser, schema) {
  const { kontext, s, fehler } = await oeffne(browser, { w: 390, h: 844, schema, handy: true });
  const name = `Handy 390 x 844 ${schema === 'dark' ? 'dunkel' : 'hell'}`;
  pruefe(`${name}: das Geraet meldet kein Zeigen (hover: none)`, await s.evaluate(() => matchMedia('(hover: none)').matches));
  const ziele = await markiere(s);
  pruefe(`${name}: Premium und mindestens zwei runde Kopf-Knoepfe da`, ziele.some((z) => z.name === 'Premium') && ziele.length >= 3, ziele);
  for (const { sel, name: k } of ziele) {
    const ruhe = await zustand(s, sel);
    // nach einem Tippen steht der Zeiger auf dem Knopf (Chromium wie Safari): genau das stellt hover() her, ohne die Aktion
    // des Knopfs auszuloesen
    await s.locator(sel).hover(); await warte(400);
    const danach = await zustand(s, sel);
    await s.mouse.move(1, 1); await warte(300);
    pruefe(`${name} ${k}: nach dem Tippen bleibt kein Zeiger-Zustand haengen`, danach.sicht === ruhe.sicht, { ruhe: ruhe.sicht, danach: danach.sicht });
    if (ruhe.text !== null) pruefe(`${name} ${k}: Text mindestens 4,5:1 (${ruhe.text})`, ruhe.text >= 4.5, ruhe);
    pruefe(`${name} ${k}: Symbol mindestens 3:1 (${ruhe.symbol})`, ruhe.symbol !== null && ruhe.symbol >= 3, ruhe);
    pruefe(`${name} ${k}: Ziel mindestens 44 x 44 px (${ruhe.b} x ${ruhe.h})`, ruhe.b >= 44 && ruhe.h >= 44, ruhe);
  }
  const funde = await zeigerAusserhalb(s);
  pruefe(`${name}: keine :hover-Regel der Kopf-Knoepfe ausserhalb von @media (hover: hover)`, !funde.length, funde);
  pruefe(`${name}: keine Seitenfehler`, !fehler.length, fehler);
  await kontext.close();
}

const server = spawn(process.execPath, ['tests/testserver.mjs', String(PORT), '--bind', '127.0.0.1'], { cwd: WURZEL, stdio: 'ignore' });
let browser;
try {
  for (let i = 0; i < 50; i++) { try { if ((await fetch(BASIS)).ok) break; } catch (e) { /* Server startet noch */ } await warte(200); }
  browser = await browserTyp(require(process.env.PLAYWRIGHT_PFAD || 'playwright')).launch({ headless: true });
  for (const schema of ['light', 'dark']) {
    await zeigerGeraet(browser, { w: 1440, h: 900, schema });
    await zeigerGeraet(browser, { w: 820, h: 1180, schema });
    await handy(browser, schema);
  }
} catch (e) {
  pruefe('Probe laeuft ohne Abbruch', false, e.stack);
} finally {
  await browser?.close();
  server.kill();
}
console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
