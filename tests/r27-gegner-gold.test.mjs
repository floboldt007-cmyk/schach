// R27 Startseite (Flo 22.11.2026): die Karte "Naechster Gegner" traegt Metallgold statt des gelben --gold, passend zur
// Online-Arena (#272), und es gibt in der Ansicht genau EINEN goldenen Knopf. Dazu der allgemeine Probe-Schalter
// ?test&design=a,b (js/app.js designProbe -> html[data-design="a b"]) und die Probe "brett-warm": das Standardbrett Nacht
// in warmem Holz. Ohne Schalter muessen die Feldfarben exakt wie heute sein; eine andere Brettwahl bleibt unberuehrt.
//
//   node tests/r27-gegner-gold.test.mjs
//   PORT=8973 node tests/r27-gegner-gold.test.mjs   eigener Port (Standard: frei)
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
const BASIS = `http://127.0.0.1:${PORT}/index.html`;
const P = 'schach-arena:v1:';
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

let ok = 0, gesamt = 0;
function pruefe(name, gut, detail = '') {
  gesamt++; if (gut) ok++;
  // INTENTIONAL-SLOP[T4]: die Pruefzeile ist die Ausgabe des Tests (wie in tests/heim.test.mjs)
  console.log(`${gut ? 'ok  ' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(detail)}`);
}

const METALL = 'rgb(201, 161, 74)', METALL_HELL = 'rgb(243, 222, 162)', AUF_GOLD = 'rgb(28, 27, 25)';

async function seite(browser, { w = 1440, h = 900, schema = 'light', suche = '?test', brett = null }) {
  const kontext = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: schema, deviceScaleFactor: 1, serviceWorkers: 'block' });
  const s = await kontext.newPage();
  const fehler = [];
  s.on('pageerror', (e) => fehler.push(e.message));
  await s.addInitScript(({ P, brett }) => {
    if (!location.protocol.startsWith('http')) return;
    if (sessionStorage.getItem('gg-probe')) return;
    sessionStorage.setItem('gg-probe', '1');
    localStorage.clear();
    const d = new Date(); if (d.getHours() < 4) d.setDate(d.getDate() - 1);
    const z = (n) => String(n).padStart(2, '0');
    localStorage.setItem(P + 'modul:start', JSON.stringify({ gesehen: `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}` }));
    localStorage.setItem(P + 'einstellungen', JSON.stringify({ sprache: 'de', spracheGewaehlt: true, ...(brett ? { brett } : {}) }));
    localStorage.setItem(P + 'hinweis-installieren', '1');
  }, { P, brett });
  await s.goto(BASIS + suche + '#heim');
  await s.waitForSelector('.heim-buehne[data-art="gegner"] .heim-los', { state: 'visible', timeout: 20000 });
  await warte(800);
  return { s, kontext, fehler };
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

  // ---------- Gegner-Karte: Metallgold, ein goldener Knopf ----------
  for (const schema of ['light', 'dark']) {
    for (const [w, h] of [[1440, 900], [390, 844]]) {
      const { s, kontext, fehler } = await seite(browser, { w, h, schema });
      const name = `${w} x ${h} ${schema === 'dark' ? 'dunkel' : 'hell'}`;
      const k = await s.evaluate(() => {
        const knopf = document.querySelector('.heim-buehne[data-art="gegner"] .heim-los');
        const st = getComputedStyle(knopf);
        const ueber = getComputedStyle(document.querySelector('.heim-buehne[data-art="gegner"] .heim-ueber'));
        const ring = getComputedStyle(document.querySelector('.heim-buehne[data-art="gegner"] .heim-portraet')).boxShadow;
        // goldene Flaechen: jeder sichtbare Knopf oder Link, dessen Flaeche Gold oder Metallgold ist
        const gold = ['rgb(224, 162, 43)', 'rgb(242, 190, 74)', 'rgb(201, 161, 74)'];
        const golden = [...document.querySelectorAll('button, a, [role="button"]')].filter((e) => e.getClientRects().length
          && getComputedStyle(e).visibility !== 'hidden' && gold.includes(getComputedStyle(e).backgroundColor)).length;
        const r = getComputedStyle(document.documentElement);
        const tok = ['--metall-hell', '--metall', '--metall-tief', '--auf-gold', '--gold-text'].map((n) => r.getPropertyValue(n).trim().toUpperCase()).join(' ');
        return { bg: st.backgroundColor, bild: st.backgroundImage, farbe: st.color, ueber: ueber.color, ring, golden, tok };
      });
      pruefe(`${name}: Knopf-Flaeche Metallgold`, k.bg === METALL, k.bg);
      pruefe(`${name}: Knopf-Verlauf von Metall-Hell`, k.bild.includes(METALL_HELL), k.bild);
      pruefe(`${name}: Knopf-Schrift dunkel`, k.farbe === AUF_GOLD, k.farbe);
      pruefe(`${name}: Ueberschrift in Metall-Hell`, k.ueber === METALL_HELL, k.ueber);
      pruefe(`${name}: Ring ums Portraet Metallgold`, k.ring.includes(METALL), k.ring);
      pruefe(`${name}: genau ein goldener Knopf`, k.golden === 1, k.golden);
      // Tokens zentral in css/tokens.css, Werte wie #272 (Goldschrift hell #75561A, dunkel #DCC07A)
      pruefe(`${name}: Metallgold-Tokens wie #272`, k.tok === `#F3DEA2 #C9A14A #8A6A26 #1C1B19 ${schema === 'dark' ? '#DCC07A' : '#75561A'}`, k.tok);
      pruefe(`${name}: keine Seitenfehler`, fehler.length === 0, fehler);
      await kontext.close();
    }
  }

  // ---------- Standardbrett: ohne Schalter wie heute, mit Schalter warm ----------
  const feld = (s) => s.evaluate(() => {
    const st = getComputedStyle(document.documentElement);
    return { hell: st.getPropertyValue('--feld-hell').trim().toLowerCase(), dunkel: st.getPropertyValue('--feld-dunkel').trim().toLowerCase(),
      brett: document.documentElement.dataset.brett, design: document.documentElement.dataset.design ?? null };
  });
  {
    const { s, kontext } = await seite(browser, {});
    const f = await feld(s);
    pruefe('ohne Schalter: Brett Nacht wie heute', f.hell === '#e4e8f6' && f.dunkel === '#7c87b6' && f.brett === 'nacht', f);
    pruefe('ohne Schalter: kein data-design', f.design === null, f);
    await kontext.close();
  }
  {
    const { s, kontext } = await seite(browser, { suche: '?design=brett-warm' });
    const f = await feld(s);
    pruefe('ohne ?test wirkt der Schalter nicht', f.hell === '#e4e8f6' && f.design === null, f);
    await kontext.close();
  }
  {
    const { s, kontext } = await seite(browser, { suche: '?test&design=brett-warm' });
    const f = await feld(s);
    pruefe('mit Schalter: Standardbrett warm', f.hell === '#eed8b6' && f.dunkel === '#a8774f', f);
    pruefe('mit Schalter: Einstellung bleibt nacht', f.brett === 'nacht' && f.design === 'brett-warm', f);
    await kontext.close();
  }
  {
    const { s, kontext } = await seite(browser, { suche: '?test&design=l1,brett-warm', brett: 'gruen' });
    const f = await feld(s);
    pruefe('mit Schalter und eigener Wahl Gruen: Gruen bleibt', f.hell === '#eeeed2' && f.dunkel === '#769656', f);
    pruefe('mehrere Proben stehen nebeneinander', f.design === 'l1 brett-warm', f);
    await kontext.close();
  }
  {
    const { s, kontext } = await seite(browser, { suche: '?test&design=L2,%3Cb%3E,%22x%22,ok' });
    const f = await feld(s);
    pruefe('Schalter nimmt nur saubere Namen (klein, a-z 0-9 -)', f.design === 'l2 ok', f);
    await kontext.close();
  }
} catch (e) {
  pruefe('Lauf ohne Ausnahme', false, String(e && e.stack || e));
} finally {
  if (browser) await browser.close().catch(() => {});
  server.kill();
}
console.log(`\n${ok}/${gesamt} Pruefungen bestanden`);
process.exit(ok === gesamt ? 0 : 1);
