// Bot-Schutz-Hinweis der Anmeldung (R18, Muster tests/info-lizenzen.test.mjs): der Link "Mehr dazu" ist eine eigene Tippflaeche.
// Je Groesse aus tests/ansicht.test.mjs (eine englisch), hell und dunkel: mindestens 44 px hoch, und an 9 Punkten (Mitte und
// Raender) liefert elementFromPoint genau diesen Link, nicht eine Nachbarzeile oder den Absatz darum.
// Der Hinweis steht nur ohne ?test (mit Turnstile), darum laeuft die App hier ohne ?test, Turnstile ist ein Nachbau wie in
// tests/r16-p1.test.mjs, Supabase antwortet leer, alle anderen Hosts sind gesperrt.
//
//   node tests/r18-botschutz-link.test.mjs
//   PORT=9791 node tests/r18-botschutz-link.test.mjs    Port des Testservers (sonst: frei)
//
// Playwright: PLAYWRIGHT_PFAD, sonst 'playwright', sonst /opt/node-tools/node_modules/playwright.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { browserTyp } from './browser.mjs';

const require = createRequire(import.meta.url);
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || await (await import('./freier-port.mjs')).freierPort();
const BASIS = `http://127.0.0.1:${PORT}/`;

let gesamt = 0, ok = 0;
function pruefe(name, gut, detail = '') {
  gesamt++; if (gut) ok++;
  const d = typeof detail === 'string' ? detail : JSON.stringify(detail);
  console.log(`${gut ? 'ok    ' : 'FEHLER'} ${name}${!gut && d ? ' (' + d.slice(0, 600) + ')' : ''}`);
}
const botschutzLink = (s) => s.evaluate(() => {
  const a = document.querySelector('.konto-gruppe .konto-botschutz-hinweis a');
  if (!a || !a.getClientRects().length) return { da: false };
  a.scrollIntoView({ block: 'center' });
  const klein = [], daneben = [];
  for (const r of a.getClientRects()) {
    if (r.height < 44) klein.push(Math.round(r.height));
    const xs = [r.left + 2, r.left + r.width / 2, r.right - 2], ys = [r.top + 2, r.top + r.height / 2, r.bottom - 2];
    for (const x of xs) for (const y of ys) {
      const e = document.elementFromPoint(x, y);
      if (!e || e.closest('a') !== a) daneben.push(`${Math.round(x)},${Math.round(y)}:${e ? e.tagName + '.' + e.className : 'nichts'}`);
    }
  }
  return { da: true, rects: a.getClientRects().length, klein, daneben: daneben.slice(0, 6), fehltreffer: daneben.length, href: a.getAttribute('href') };
});

let pw;
try { pw = require(process.env.PLAYWRIGHT_PFAD || 'playwright'); } catch (e) { pw = require('/opt/node-tools/node_modules/playwright'); }
const server = spawn(process.execPath, ['tests/testserver.mjs', String(PORT), '--bind', '127.0.0.1'], { cwd: WURZEL, stdio: 'ignore' });
const browser = await browserTyp(pw).launch({ headless: true });
try {
  for (let i = 0; i < 60; i++) { try { if ((await fetch(BASIS + 'index.html')).ok) break; } catch (e) { /* noch nicht */ } await new Promise((r) => setTimeout(r, 150)); }
  // die sieben Groessen aus tests/ansicht.test.mjs (GROESSEN), eine davon englisch, jede hell und dunkel
  for (const schema of ['light', 'dark']) for (const [sp, w, h] of [['de', 375, 667], ['en', 390, 844], ['de', 667, 375], ['de', 820, 1180], ['de', 1180, 820], ['de', 1000, 590], ['de', 1440, 900]]) {
    const k = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: w < 1000, colorScheme: schema, serviceWorkers: 'block' });
    await k.route('**/*', (route) => {
      const u = new URL(route.request().url());
      if (u.hostname === '127.0.0.1') return route.continue();
      if (u.hostname === 'challenges.cloudflare.com') return route.fulfill({ status: 200, contentType: 'text/javascript',
        body: 'window.turnstile = { render(el, o) { setTimeout(() => o && o.callback && o.callback("probe-token"), 0); return "w1"; }, reset() {}, remove() {}, getResponse() { return "probe-token"; } };' });
      if (u.hostname.endsWith('.supabase.co')) return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      return route.abort();
    });
    const name = `${sp} ${w}x${h} ${schema === 'dark' ? 'dunkel' : 'hell'}`;
    const s = await k.newPage();
    const fehler = []; s.on('pageerror', (e) => fehler.push(e.message));
    await s.addInitScript(({ sprache, modus }) => {
      try {
        if (sessionStorage.getItem('probe-start')) return;
        sessionStorage.setItem('probe-start', '1');
        localStorage.clear();
        localStorage.setItem('schach-arena:v1:modul:start', JSON.stringify({ v: 1, gesehen: '2026-11-01' }));
        localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ klang: false, modus, sprache, spracheGewaehlt: true }));
        localStorage.setItem('schach-arena:v1:hinweis-installieren', '1');
      } catch (e) { /* egal */ }
    }, { sprache: sp, modus: schema === 'dark' ? 'dunkel' : 'hell' });
    await s.goto(BASIS + 'index.html#einstellungen/konto');
    await s.waitForSelector('.konto-gruppe .konto-botschutz-hinweis a', { state: 'visible', timeout: 15000 }).catch(() => {});
    const li = await botschutzLink(s);
    pruefe(`${name}: Bot-Schutz-Link "Mehr dazu" sichtbar`, li.da, li);
    pruefe(`${name}: Bot-Schutz-Link mindestens 44 px hoch`, li.da && li.klein.length === 0, li);
    pruefe(`${name}: Bot-Schutz-Link trifft an 9 von 9 Punkten genau sich (Mitte und Raender)`, li.da && li.fehltreffer === 0, li.daneben);
    pruefe(`${name}: keine Seitenfehler`, fehler.length === 0, fehler);
    await k.close();
  }
} finally {
  await browser.close(); server.kill();
}
console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
