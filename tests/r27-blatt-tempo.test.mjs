// R27 Tempo: Blatt oeffnen ohne Wartezeit (Flo 22.11.2026: "alles muss smooth auf- und zugehen, nicht zeitverzoegert").
// Trace am iPhone 13 (4x CPU, 22.11.): beim Oeffnen des Shop-Blatts kostete das Stilllegen des Hintergrunds (inert auf alle
// body-Kinder) 48 ms Stilberechnung fuer 955 Elemente, noch vor dem ersten Bild. sheet() (js/ui/bauteile.js) legt den
// Hintergrund deshalb erst im naechsten Bild still. Diese Probe haelt das erste Bild fest (requestAnimationFrame wartet) und
// prueft mit echtem Zeiger und echten Tasten, dass dabei nichts hinter dem Blatt ausgeloest wird:
//   1. Im ersten Bild ist der Hintergrund noch nicht inert (die Kosten liegen nicht vor dem ersten Bild), im naechsten schon.
//   2. Tipp oder Klick auf einen Knopf hinter dem Blatt trifft den Schleier, nicht den Knopf.
//   3. Tab bleibt im Blatt; Enter und Leertaste auf dem Knopf, der vor dem Oeffnen den Fokus hatte, loesen ihn nicht aus.
//   4. Nach dem Schliessen ist nichts mehr inert und der Fokus liegt wieder auf dem Ausloeser (wie bisher).
//   node tests/r27-blatt-tempo.test.mjs   (iPhone 13 mit Touch und PC, Netz nur simuliert)
import http from 'node:http';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
let pw;
for (const p of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
  try { pw = require(p); break; } catch (e) { /* naechster */ }
}
if (!pw) throw new Error('Playwright fehlt');
const root = fileURLToPath(new URL('../', import.meta.url));
const typen = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg' };
const server = http.createServer((req, res) => {
  const p = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://test').pathname).replace(/\/$/, '/index.html'));
  if (!p.startsWith(root)) { res.writeHead(403); res.end(); return; }
  try { const d = readFileSync(p); res.writeHead(200, { 'Content-Type': typen[path.extname(p)] || 'application/octet-stream' }); res.end(d); }
  catch (e) { res.writeHead(404); res.end(); }
});
const PORT = Number(process.env.PORT) || await (await import('./freier-port.mjs')).freierPort();
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

let ok = 0, gesamt = 0;
function pruefe(name, gut, detail = '') {
  gesamt++; if (gut) ok++;
  // INTENTIONAL-SLOP[T4]: die Pruefzeile ist die Ausgabe des Tests (wie in tests/r20-blatt-fokus.test.mjs)
  console.log(`${gut ? 'ok  ' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(detail).slice(0, 400)}`);
}

function initSkript() {
  try {
    if (sessionStorage.getItem('blatt-tempo')) return;
    sessionStorage.setItem('blatt-tempo', '1');
    localStorage.clear();
    const d = new Date(); if (d.getHours() < 4) d.setDate(d.getDate() - 1);
    const z = (n) => String(n).padStart(2, '0');
    localStorage.setItem('schach-arena:v1:modul:start', JSON.stringify({ v: 1, gesehen: `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}` }));
    localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ sprache: 'de', spracheGewaehlt: true, klang: false, modus: 'hell', arenaKarteHinweis: true }));
    localStorage.setItem('schach-arena:v1:hinweis-installieren', '1');
  } catch (e) { /* egal */ }
}

// Probe-Knopf im Hintergrund (in #app, oben links, gross) und ein festgehaltenes erstes Bild: requestAnimationFrame sammelt
// die Rueckrufe, bis lasseBilderLos() sie ausfuehrt. Danach laeuft die Seite normal weiter.
const bereite = (s) => s.evaluate(() => {
  window.__probe = { klicks: 0 };
  let b = document.getElementById('probe-hinten');
  if (!b) {
    b = document.createElement('button');
    b.id = 'probe-hinten'; b.type = 'button'; b.textContent = 'Hinten';
    b.style.cssText = 'position:fixed;left:20px;top:200px;width:200px;height:120px;z-index:5';
    b.addEventListener('click', () => { window.__probe.klicks++; });
    document.getElementById('app').append(b);
  }
  const echt = window.__echtesRaf || window.requestAnimationFrame.bind(window);
  window.__echtesRaf = echt;
  const halt = [];
  window.requestAnimationFrame = (f) => { halt.push(f); return halt.length; };
  window.lasseBilderLos = () => { window.requestAnimationFrame = echt; const t = performance.now(); for (const f of halt.splice(0)) f(t); };
});
const oeffne = (s) => s.evaluate(async () => {
  const { sheet } = await import('/js/ui/bauteile.js');
  window.__blattWert = 'offen';
  document.getElementById('probe-hinten').focus();
  sheet({ titel: 'Probe', knoepfe: [{ text: 'Fertig', wert: 'fertig' }], abbrechen: 'abbruch' }).then((w) => { window.__blattWert = w; });
  const still = [...document.body.children].filter((el) => !el.classList.contains('sheet-ort') && !el.matches('script, [role="status"], [aria-live]'));
  return { imErstenBild: still.filter((el) => el.inert).length, alle: still.length };
});
const stand = (s) => s.evaluate(() => {
  const still = [...document.body.children].filter((el) => !el.classList.contains('sheet-ort') && !el.matches('script, [role="status"], [aria-live]'));
  const a = document.activeElement;
  return { inert: still.filter((el) => el.inert).length, alle: still.length, klicks: window.__probe.klicks, wert: window.__blattWert,
    blatt: !!document.querySelector('.sheet-ort:not(.weg)'), fokusImBlatt: !!a && !!a.closest('.sheet-ort'), fokusId: a ? a.id : '' };
});
const zweiBilder = (s) => s.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const zu = async (s) => {
  await s.evaluate(() => window.lasseBilderLos && window.lasseBilderLos());
  if (await s.locator('.sheet-ort:not(.weg)').count()) await s.keyboard.press('Escape');
  await s.waitForSelector('.sheet-ort', { state: 'detached', timeout: 5000 }).catch(() => {});
  await warte(200);
};

const seitenfehler = [];
const browser = await pw.chromium.launch({ headless: true });
try {
  for (const [geraet, opt] of [['iPhone 13', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }],
    ['PC', { viewport: { width: 1280, height: 800 } }]]) {
    const k = await browser.newContext({ ...opt, deviceScaleFactor: 2, serviceWorkers: 'block', colorScheme: 'light', locale: 'de-DE', timezoneId: 'Europe/Berlin' });
    await k.route('**/*.supabase.co/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await k.addInitScript(initSkript);
    const s = await k.newPage(); s.setDefaultTimeout(20000);
    s.on('pageerror', (e) => seitenfehler.push(`${geraet}: ${e.message}`));
    try {
      await s.goto(`http://127.0.0.1:${PORT}/index.html?test#arena`);
      await s.waitForFunction(() => window.__app && typeof window.__app.gehe === 'function', null, { timeout: 30000 });
      await s.waitForFunction(() => !!document.querySelector('#app > .screen:not(.lade-screen)'), null, { timeout: 30000 });
      await warte(800);

      // 1. inert erst im naechsten Bild, dann sicher
      await bereite(s);
      const erst = await oeffne(s);
      pruefe(`${geraet}: im ersten Bild ist der Hintergrund noch nicht stillgelegt (keine 48 ms vor dem ersten Bild)`, erst.imErstenBild === 0, erst);
      await s.evaluate(() => window.lasseBilderLos());
      await zweiBilder(s);
      const dann = await stand(s);
      pruefe(`${geraet}: im naechsten Bild ist der ganze Hintergrund stillgelegt`, dann.alle > 0 && dann.inert === dann.alle, dann);
      await zu(s);
      const nach = await stand(s);
      pruefe(`${geraet}: nach dem Schliessen ist nichts mehr stillgelegt`, nach.inert === 0, nach);
      pruefe(`${geraet}: nach dem Schliessen liegt der Fokus wieder auf dem Ausloeser`, nach.fokusId === 'probe-hinten', nach);

      // 2. Tipp/Klick auf den Knopf hinter dem Blatt, solange das erste Bild steht
      await bereite(s);
      await oeffne(s);
      if (opt.hasTouch) await s.touchscreen.tap(120, 260); else await s.mouse.click(120, 260);
      await warte(100);
      const tipp = await stand(s);
      pruefe(`${geraet}: ${opt.hasTouch ? 'Tipp' : 'Klick'} im ersten Bild trifft den Schleier, nicht den Knopf dahinter`, tipp.klicks === 0 && tipp.wert === 'abbruch', tipp);
      await zu(s);

      // 3. Tasten im ersten Bild: Tab bleibt im Blatt, Enter und Leertaste loesen den alten Fokus-Knopf nicht aus
      for (const taste of ['Tab', 'Enter', ' ']) {
        await bereite(s);
        await oeffne(s);
        await s.keyboard.press(taste);
        await warte(100);
        const t = await stand(s);
        const name = taste === ' ' ? 'Leertaste' : taste;
        pruefe(`${geraet}: ${name} im ersten Bild loest den Knopf hinter dem Blatt nicht aus`, t.klicks === 0, t);
        if (taste === 'Tab') pruefe(`${geraet}: Tab im ersten Bild bleibt im Blatt`, t.fokusImBlatt && t.blatt, t);
        else pruefe(`${geraet}: ${name} im ersten Bild trifft den sicheren Knopf des Blatts`, t.wert === 'fertig', t);
        await zu(s);
      }
    } finally { await k.close(); }
  }
  pruefe('keine Seitenfehler', !seitenfehler.length, seitenfehler);
} finally {
  await browser.close();
  server.close();
}
console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
