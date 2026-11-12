// Anmeldeblatt (Einstellungen > Konto): ein abgeschalteter Anmeldeweg ist wirklich unsichtbar (Feinschliff R7, 12.11.2026).
// Befund R6: "Mit Apple anmelden" war zu sehen, obwohl js/konto-config.js apple: false setzt. Das Attribut hidden verlor
// gegen .knopf { display: inline-flex } (css/app.css), ein Tipp fuehrte zu authorize?provider=apple. Geprueft wird
// deshalb die BERECHNETE Sichtbarkeit (getComputedStyle, Box), nie nur das Attribut. Gegenprobe im selben Lauf: mit
// eingeschaltetem Apple-Weg erscheint der Knopf (die Regel versteckt nur, was hidden traegt).
// Netzwerk: alles ausser 127.0.0.1 wird abgebrochen.
//   PORT=9620 node tests/apple-knopf.test.mjs   eigener Port (Standard 8929)
import http from 'node:http';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { browserTyp } from './browser.mjs';

const require = createRequire(import.meta.url);
let pw;
for (const p of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
  try { pw = require(p); break; } catch (e) { /* naechster */ }
}
if (!pw) throw new Error('Playwright fehlt');
const root = fileURLToPath(new URL('../', import.meta.url));
const typen = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const p = path.resolve(root, '.' + new URL(req.url, 'http://test').pathname.replace(/\/$/, '/index.html'));
  if (!p.startsWith(root)) { res.writeHead(403); res.end(); return; }
  try { res.writeHead(200, { 'Content-Type': typen[path.extname(p)] || 'application/octet-stream' }); res.end(readFileSync(p)); }
  catch (e) { res.writeHead(404); res.end(); }
});
const PORT = Number(process.env.PORT || 8929);
await new Promise(r => server.listen(PORT, '127.0.0.1', r));
const BASIS = `http://127.0.0.1:${PORT}/?test&kern`;

let ok = 0, gesamt = 0;
function pruefe(name, gut, detail = '') { gesamt++; if (gut) ok++; console.log(`${gut ? 'OK' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(detail)}`); }
const browser = await browserTyp(pw).launch({ headless: true });

// Berechnete Sichtbarkeit eines Elements im Anmeldeblatt: Attribut, display und ob es eine Flaeche auf dem Schirm hat
const sicht = (s, sel) => s.evaluate((q) => {
  const el = document.querySelector(q);
  if (!el) return { da: false };
  const r = el.getBoundingClientRect();
  return { da: true, hidden: el.hidden, display: getComputedStyle(el).display, flaeche: r.width > 0 && r.height > 0 };
}, sel);
const sichtbar = (v) => v.da && v.display !== 'none' && v.flaeche;
const unsichtbar = (v) => v.da && v.hidden && v.display === 'none' && !v.flaeche;

try {
  const k = await browser.newContext({ viewport: { width: 1024, height: 768 }, serviceWorkers: 'block' });
  await k.addInitScript(() => { try { localStorage.setItem('schach-arena:v1:hinweis-installieren', '1'); } catch (e) { /* egal */ } });
  const anbieter = [];
  await k.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1') return route.continue();
    if (url.pathname.includes('/auth/v1/authorize')) anbieter.push(url.searchParams.get('provider'));
    return route.abort();
  });
  const s = await k.newPage();
  const fehler = []; s.on('pageerror', (e) => fehler.push(e.message));
  await s.goto(BASIS);
  await s.waitForFunction(() => !!window.__app, null, { timeout: 15000 });
  await s.evaluate(() => window.__app.gehe('einstellungen', { gruppe: 'konto' }));
  await s.waitForSelector('.konto-gruppe .konto-anbieter', { state: 'attached', timeout: 10000 });
  await s.waitForTimeout(300);

  { // 1. Ausgelieferte Konfiguration (js/konto-config.js): E-Mail und Google an, Apple aus
    const apple = await sicht(s, '.konto-gruppe .konto-apple');
    pruefe('Apple aus: der Knopf "Mit Apple anmelden" ist berechnet unsichtbar (display none, keine Fläche)', unsichtbar(apple), apple);
    pruefe('Apple aus: Playwright sieht den Knopf nicht', !(await s.locator('.konto-gruppe .konto-apple').isVisible()));
    const google = await sicht(s, '.konto-gruppe .konto-google');
    pruefe('Google an: "Mit Google anmelden" bleibt sichtbar', sichtbar(google) && !google.hidden, google);
    const code = await sicht(s, '.konto-gruppe [data-konto="code"]');
    pruefe('Code-Anmeldung: "Code senden" bleibt sichtbar', sichtbar(code), code);
    const email = await sicht(s, '.konto-gruppe .konto-email');
    pruefe('Code-Anmeldung: das E-Mail-Feld bleibt sichtbar', sichtbar(email), email);
    const oder = await sicht(s, '.konto-gruppe .konto-oder');
    pruefe('"oder" vor den Anbietern bleibt sichtbar (Google ist an)', sichtbar(oder), oder);
    // Ein Tipp auf die Stelle, an der der Knopf stand, trifft keinen Apple-Knopf (elementFromPoint statt Attribut)
    const getroffen = await s.evaluate(() => {
      const g = document.querySelector('.konto-gruppe .konto-google'); if (!g) return null;
      g.scrollIntoView({ block: 'start' });
      const r = g.getBoundingClientRect(); const x = r.left + r.width / 2; const y = r.bottom + 30;
      return document.elementFromPoint(x, y)?.closest('[data-konto="apple"]') ? 'apple' : 'anderes';
    });
    pruefe('Apple aus: unter "Mit Google anmelden" liegt kein antippbarer Apple-Knopf', getroffen === 'anderes', getroffen);
    pruefe('Apple aus: keine Anfrage an authorize?provider=apple', !anbieter.includes('apple'), anbieter);
  }
  { // 2. Gegenprobe: Apple eingeschaltet (Test-Schalter setzeAnmeldewege) -> Knopf sichtbar, Google weiter sichtbar
    await s.evaluate(async () => {
      const m = await import('/js/konto.js');
      m.setzeAnmeldewege({ email: true, google: true, apple: true });
      window.__app.gehe('arena');
    });
    await s.waitForTimeout(300);
    await s.evaluate(() => window.__app.gehe('einstellungen', { gruppe: 'konto' }));
    await s.waitForSelector('.konto-gruppe .konto-anbieter', { state: 'attached', timeout: 10000 });
    await s.waitForTimeout(300);
    const apple = await sicht(s, '.konto-gruppe .konto-apple');
    pruefe('Apple an (Gegenprobe): der Knopf ist sichtbar', sichtbar(apple) && !apple.hidden, apple);
    const google = await sicht(s, '.konto-gruppe .konto-google');
    pruefe('Apple an (Gegenprobe): Google bleibt sichtbar', sichtbar(google), google);
    await s.evaluate(async () => { (await import('/js/konto.js')).setzeAnmeldewege(null); });
  }
  pruefe('Anmeldeblatt: keine Seitenfehler', fehler.length === 0, fehler);
  await k.close();
} finally {
  await browser.close(); server.close();
}
console.log(`${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
