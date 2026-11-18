// Feinschliff R15 (Flo hat jeden Punkt nach Empfehlung gewaehlt), drei Punkte am Ende einer Partie bzw. eines Duells:
//   1. R7-Duellknopf A: "Nochmal" am Ende des Raetselduells (.rd-los.rd-nochmal) traegt dieselbe Farbe wie der Suchknopf
//      (.rd-los.rd-suchen, css/pakete/raetsel-duell.css). Geprueft am berechneten Stil beider Knoepfe nebeneinander; den
//      echten Ende-Bildschirm prueft tests/raetsel-duell-ui.test.mjs.
//   2. R7-Ergebnis A: das Niederlage-Blatt einer wertenden Partie zeigt wie das Sieg-Blatt den Verweis in die Liga
//      (.erg-liga-verweis) statt der Punkte- und der Wertungszeile.
//   3. R14-G2: nach einem Sieg gibt es EINEN Knopf "Teilen …" statt "Siegesbild teilen" und "Freund herausfordern";
//      er klappt eine kleine Auswahl mit genau diesen zwei Eintraegen auf, beide tun, was die alten Knoepfe taten.
// Je Geraet (iPhone 13, PC 1280 x 800, hell) eine Niederlage per Narrenmatt und ein Sieg per Schaefermatt gegen Fridolin
// (der Bot zieht nach Plan ueber window.__test.botZug, wie tests/ergebnis-einmal.test.mjs).
//
//   node tests/r15-ergebnis-teilen.test.mjs
//   BILDER=<ordner> node tests/r15-ergebnis-teilen.test.mjs   Bilder dorthin (Standard: <tmp>/r15-ergebnis-teilen)
//   PORT=8991 node tests/r15-ergebnis-teilen.test.mjs          eigener Port (Standard: frei)
import http from 'node:http';
import { createRequire } from 'node:module';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';
import { browserTyp } from './browser.mjs';

const require = createRequire(import.meta.url);
let pw;
for (const p of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
  try { pw = require(p); break; } catch (e) { /* naechster */ }
}
if (!pw) throw new Error('Playwright fehlt');
const BILDER = process.env.BILDER || path.join(os.tmpdir(), 'r15-ergebnis-teilen');
const WURZEL = fileURLToPath(new URL('../', import.meta.url));
const TYPEN = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm', '.json': 'application/json', '.png': 'image/png', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json' };
const server = http.createServer(async (q, r) => {
  const p = path.resolve(WURZEL, '.' + decodeURIComponent(new URL(q.url, 'http://test').pathname).replace(/\/$/, '/index.html'));
  if (!p.startsWith(WURZEL)) { r.writeHead(403); r.end(); return; }
  try { const d = await readFile(p); r.writeHead(200, { 'Content-Type': TYPEN[path.extname(p)] || 'application/octet-stream' }); r.end(d); }
  catch (e) { r.writeHead(404); r.end(); }
});
await new Promise(r => server.listen(Number(process.env.PORT || 0), '127.0.0.1', r));
await mkdir(BILDER, { recursive: true });

const { defaultBrowserType, ...IPHONE } = pw.devices['iPhone 13'];
const GERAETE = [
  { name: 'iphone13', optionen: IPHONE },
  { name: 'iphonese', optionen: { viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } },
  { name: 'pc1280', optionen: { viewport: { width: 1280, height: 800 } } },
];
const PARTIEN = [
  { art: 'niederlage', zuege: ['f2f3', 'g2g4'], plan: { f2f3: 'e7e5', g2g4: 'd8h4' } },
  { art: 'sieg', zuege: ['e2e4', 'f1c4', 'd1h5', 'h5f7'], plan: { e2e4: 'e7e5', f1c4: 'b8c6', d1h5: 'g8f6' } },
];
const SCREEN = '.screen.partie:not(.online-screen)';

let ok = 0, gesamt = 0;
function pruefe(name, gut, detail = '') {
  gesamt++; if (gut) ok++;
  console.log(`${gut ? 'OK' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(detail)}`);
  return gut;
}
const warte = ms => new Promise(r => setTimeout(r, ms));

async function zug(s, uci) {
  await s.waitForFunction(() => window.__partie.phase() === 'flo', null, { timeout: 30000 });
  // Vorprobe Sammel R18 (14.11.2026): unter Last war das Brett nach dem Wechsel in die Partie laenger als die 15 s des
  // Klicks verdeckt ("element is not visible"). Erst sichtbar abwarten, mit derselben Frist wie die anderen Wartestellen
  await s.locator(`${SCREEN} .brett-felder`).waitFor({ state: 'visible', timeout: 30000 });
  for (const f of [uci.slice(0, 2), uci.slice(2, 4)]) await s.locator(`${SCREEN} .brett-felder .feld[data-feld="${f}"]`).click();
  if (await s.locator(`${SCREEN} .brett .lage.vorschau`).count()) await s.locator(`${SCREEN} .brett-felder .feld[data-feld="${uci.slice(2, 4)}"]`).click();
}

// sichtbar im offenen Blatt: Verweis, Punkte-/Wertungszeile, alle Teilen-Knoepfe mit Text
const lage = s => s.evaluate(() => {
  const o = document.querySelector('.ergebnis-overlay');
  const sichtbar = e => {
    if (!e || e.hidden || e.closest('[hidden]')) return false;
    const st = getComputedStyle(e);
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none';
  };
  const text = e => e.textContent.replace(/\s+/g, ' ').trim();
  return {
    verweis: sichtbar(o.querySelector('.erg-liga-verweis')),
    punkte: [...o.querySelectorAll('.pk-abr')].some(sichtbar),
    wertung: [...o.querySelectorAll('.liga-abrechnung')].some(sichtbar),
    teilen: [...o.querySelectorAll('.tl-teilen, .erg-freund')].filter(sichtbar).map(text),
    wahl: [...o.querySelectorAll('.tl-wahl button')].filter(sichtbar).map(text),
  };
});

let browser;
try {
  browser = await browserTyp(pw).launch({ headless: true });
  for (const g of GERAETE) {
    const k = await browser.newContext({ ...g.optionen, locale: 'de-DE', colorScheme: 'light', serviceWorkers: 'block' });
    await k.route('**/*.supabase.co/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await k.addInitScript(() => {
      try {
        if (!localStorage.getItem('schach-arena:v1:modul:start')) localStorage.setItem('schach-arena:v1:modul:start', JSON.stringify({ v: 1, gesehen: '2026-11-01' }));
        if (!localStorage.getItem('schach-arena:v1:einstellungen')) localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ klang: false }));
      } catch (e) { /* egal */ }
      // Teilen-Blatt des Geraets: gemerkt statt geoeffnet
      window.__geteilt = [];
      navigator.share = (d) => { window.__geteilt.push({ text: d && d.text, url: d && d.url, datei: !!(d && d.files) }); return Promise.resolve(); };
    });
    const s = await k.newPage(); s.setDefaultTimeout(15000);
    const fehler = [];
    s.on('pageerror', e => fehler.push(e.message));
    try {
      await s.goto(`http://127.0.0.1:${server.address().port}/index.html?test#heim`);
      await s.waitForFunction(() => window.__app && typeof window.__app.gehe === 'function', null, { timeout: 30000 });
      await warte(1200);

      // Punkt 1: Nochmal (Duell-Ende) in der Farbe des Suchknopfs
      const farben = await s.evaluate(async () => {
        const l = document.createElement('link');
        l.rel = 'stylesheet'; l.href = 'css/pakete/raetsel-duell.css';
        const geladen = new Promise((r) => { l.onload = r; l.onerror = r; });
        document.head.append(l);
        await geladen;
        const box = document.createElement('div');
        box.innerHTML = '<section class="rd-ende"><button class="rd-los dr rd-suchen">a</button><button class="rd-los dr rd-nochmal">b</button></section>';
        document.body.append(box);
        const [a, b] = box.querySelectorAll('button');
        const f = (e) => { const st = getComputedStyle(e); return { bg: st.backgroundColor, farbe: st.color }; };
        const erg = { suchen: f(a), nochmal: f(b) };
        box.remove(); l.remove();
        return erg;
      });
      pruefe(`${g.name}: Duell-Ende "Nochmal" hat Hintergrund und Schrift des Suchknopfs (orange)`,
        farben.suchen.bg === farben.nochmal.bg && farben.suchen.farbe === farben.nochmal.farbe, farben);

      for (const p of PARTIEN) {
        await s.evaluate(plan => {
          localStorage.removeItem('schach-arena:v1:laufend');
          window.__test = { botZug: () => { const v = window.__partie.chess().history({ verbose: true }); return plan[v[v.length - 1].lan] || null; } };
          window.__app.gehe('partie', { botId: 'fridolin', farbe: 'w' });
        }, p.plan);
        await s.waitForFunction(sel => window.__partie && window.__partie.bereit === true && window.__partie.phase() === 'flo'
          && document.querySelectorAll(sel + ' .brett img.figur').length === 32, SCREEN, { timeout: 30000 });
        for (const z of p.zuege) await zug(s, z);
        await s.waitForSelector(`.ergebnis-overlay.${p.art}.gefuellt:not(.vorlaeufig)`, { timeout: 60000 });
        await warte(1500);
        await s.screenshot({ path: path.join(BILDER, `${g.name}-${p.art}.png`) }).catch(() => {});
        const l = await lage(s);
        if (p.art === 'niederlage') {
          // Punkt 2
          pruefe(`${g.name} Niederlage: Verweis in die Liga sichtbar, Punkte- und Wertungszeile ausgeblendet`, l.verweis && !l.punkte && !l.wertung, l);
          continue;
        }
        pruefe(`${g.name} Sieg: Verweis in die Liga wie bisher`, l.verweis && !l.punkte, l);
        // Punkt 3
        pruefe(`${g.name} Sieg: genau EIN Teilen-Knopf "Teilen …", keine Auswahl offen`, l.teilen.length === 1 && l.teilen[0] === 'Teilen …' && !l.wahl.length, l);
        const knopf = s.locator('.ergebnis-overlay .tl-teilen');
        await knopf.click();
        await warte(300);
        const l2 = await lage(s);
        const offen = await knopf.getAttribute('aria-expanded');
        await s.screenshot({ path: path.join(BILDER, `${g.name}-sieg-auswahl.png`) }).catch(() => {});
        // R16 E1: kurz "Herausfordern" (Name fuer Screenreader weiter "Freund herausfordern") und ein sichtbares Schliessen
        const namen = await s.evaluate(() => [...document.querySelectorAll('.ergebnis-overlay .tl-wahl button')].map(b => b.getAttribute('aria-label') || b.textContent.trim()));
        pruefe(`${g.name} Sieg: "Teilen …" klappt die Auswahl Siegesbild / Herausfordern / Schliessen auf`,
          offen === 'true' && l2.wahl.length === 3 && l2.wahl[0] === 'Siegesbild' && l2.wahl[1] === 'Herausfordern' && l2.wahl[2] === ''
          && namen[1] === 'Freund herausfordern' && namen[2] === 'Schließen', { offen, ...l2, namen });
        const masse = await s.evaluate(() => [...document.querySelectorAll('.ergebnis-overlay .tl-wahl button')].map(b => {
          const r = document.createRange(); r.selectNodeContents(b);
          const zeilen = new Set([...r.getClientRects()].filter(q => q.width > 1).map(q => Math.round(q.top))).size;
          return { h: b.offsetHeight, w: b.offsetWidth, zeilen };
        }));
        pruefe(`${g.name} Sieg: Eintraege der Auswahl mindestens 44 x 44 px, Beschriftung einzeilig`,
          masse.length === 3 && masse.every(m => m.h >= 44 && m.w >= 44 && m.zeilen <= 1), masse);
        await s.locator('.ergebnis-overlay .tl-wahl button', { hasText: 'Herausfordern' }).click();
        await warte(300);
        const geteilt = await s.evaluate(() => window.__geteilt);
        const l3 = await lage(s);
        pruefe(`${g.name} Sieg: "Freund herausfordern" teilt den Link zu Fridolin, die Auswahl klappt wieder zu`,
          geteilt.length === 1 && /[?&]bot=fridolin/.test(geteilt[0].url || '') && geteilt[0].text === 'Freund herausfordern' && !l3.wahl.length && l3.teilen.length === 1,
          { geteilt, ...l3 });
        await knopf.click();
        await warte(200);
        await s.keyboard.press('Escape');
        await warte(200);
        const esc = await s.evaluate(() => ({ blatt: !document.querySelector('.ergebnis-overlay').hidden, wahl: !!document.querySelector('.ergebnis-overlay .tl-wahl:not([hidden])'),
          fokus: !!document.activeElement?.classList.contains('tl-teilen') }));
        pruefe(`${g.name} Sieg: Escape klappt nur die Auswahl zu (Blatt bleibt, Fokus zurueck auf "Teilen …")`, esc.blatt && !esc.wahl && esc.fokus, esc);
        await knopf.click();
        await warte(200);
        await s.locator('.ergebnis-overlay .tl-wahl [data-tl-wahl="zu"]').click();
        await warte(200);
        const zu = await s.evaluate(() => ({ blatt: !document.querySelector('.ergebnis-overlay').hidden, wahl: !!document.querySelector('.ergebnis-overlay .tl-wahl:not([hidden])'),
          fokus: !!document.activeElement?.classList.contains('tl-teilen'), geteilt: window.__geteilt.length, blattTeilen: !!document.querySelector('.tl-blatt') }));
        pruefe(`${g.name} Sieg: "×" klappt die Auswahl zu, nichts geteilt, Fokus zurueck auf "Teilen …"`,
          zu.blatt && !zu.wahl && zu.fokus && zu.geteilt === 1 && !zu.blattTeilen, zu);
        await knopf.click();
        await warte(200);
        await s.locator('.ergebnis-overlay .tl-wahl button', { hasText: 'Siegesbild' }).click();
        await s.waitForSelector('.tl-blatt', { timeout: 10000 });
        pruefe(`${g.name} Sieg: "Siegesbild" oeffnet das Blatt mit der Vorschau`, await s.locator('.tl-blatt .tl-leinwand').count() === 1);
        await s.screenshot({ path: path.join(BILDER, `${g.name}-sieg-siegesbild.png`) }).catch(() => {});
      }
      pruefe(`${g.name}: keine Seitenfehler`, !fehler.length, fehler);
    } catch (e) {
      await s.screenshot({ path: path.join(BILDER, `${g.name}-abbruch.png`) }).catch(() => {});
      pruefe(`${g.name}: Ablauf ohne Abbruch`, false, e.stack);
    }
    await k.close();
  }
} finally {
  if (browser) await browser.close();
  server.close();
}
console.log(`\n${ok}/${gesamt} Pruefungen bestanden`);
process.exit(ok === gesamt ? 0 : 1);
