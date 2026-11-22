// Bilder der Design-Probe Leiste neu R27 (R19-Auswahl leiste-neu-r27): Leiste allein und ganze Startseite fuer vorher,
// l1, l2, l3 auf iPhone 13, iPad quer und PC, hell und dunkel; dazu der gemessene Kontrast jedes Symbols gegen den Grund
// der Leiste (berechnete Farben, WCAG 1.4.11 verlangt 3:1). Kein Teil von tests/alle.mjs.
//
//   node tests/bilder-leiste-neu.mjs --bilder=<ordner> [--nur=l1,l2] [--schalter=vorlauf]
// --schalter=vorlauf setzt html[data-design] selbst (solange der Probe-Schalter in js/app.js noch nicht im Zweig ist);
// sonst kommt der Wert ueber ?test&design=<v>. Exit 0, wenn alle Bilder entstanden sind und keine Seitenfehler auftraten.
import http from 'node:http';
import os from 'node:os';
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { browserTyp } from './browser.mjs';

const require = createRequire(import.meta.url);
let pw;
for (const p of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
  try { pw = require(p); break; } catch (e) { /* naechster */ }
}
if (!pw) throw new Error('Playwright fehlt (PLAYWRIGHT_PFAD setzen)');
const arg = (n) => { const a = process.argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : null; };
const BILDER = arg('bilder') || path.join(os.tmpdir(), 'bilder-leiste-neu');
const NUR = arg('nur') ? arg('nur').split(',') : ['vorher', 'l1', 'l2', 'l3'];
const VORLAUF = arg('schalter') === 'vorlauf';
mkdirSync(BILDER, { recursive: true });

const root = fileURLToPath(new URL('../', import.meta.url));
const typen = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg' };
const server = http.createServer((req, res) => {
  const p = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://test').pathname).replace(/\/$/, '/index.html'));
  if (!p.startsWith(root)) { res.writeHead(403); res.end(); return; }
  try { const d = readFileSync(p); res.writeHead(200, { 'Content-Type': typen[path.extname(p)] || 'application/octet-stream' }); res.end(d); }
  catch (e) { res.writeHead(404); res.end(); }
});
const PORT = Number(process.env.PORT || 8996);
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

const GERAETE = [['iphone13', 390, 844, 3], ['ipad-quer', 1180, 820, 2], ['pc', 1280, 800, 1]];
let fehler = 0;
const kontraste = [];
const browser = await browserTyp(pw).launch({ headless: true });
try {
  for (const v of NUR) for (const [geraet, w, h, dpr] of GERAETE) for (const modus of ['hell', 'dunkel']) {
    const k = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, locale: 'de-DE' });
    await k.addInitScript(([m, d, vor]) => {
      localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ klang: false, bewegung: 'aus', modus: m }));
      if (vor && d) document.addEventListener('DOMContentLoaded', () => { document.documentElement.dataset.design = d; });
    }, [modus, v === 'vorher' ? '' : v, VORLAUF]);
    const s = await k.newPage();
    const seitenfehler = [];
    s.on('pageerror', (e) => seitenfehler.push(e.message));
    const suche = v === 'vorher' || VORLAUF ? '?test' : `?test&design=${v}`;
    await s.goto(`http://127.0.0.1:${PORT}/index.html${suche}#heim`);
    await s.waitForSelector('.reiter-leiste:not([hidden]) .reiter', { timeout: 20000 });
    await s.evaluate(() => document.fonts && document.fonts.ready);
    await warte(700);
    const name = `${v}-${geraet}-${modus}`;
    await s.locator('.reiter-leiste').screenshot({ path: path.join(BILDER, `${name}.png`) });
    await s.screenshot({ path: path.join(BILDER, `${v}-start-${geraet}-${modus}.png`) });
    const mess = await s.evaluate(() => {
      const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
      // color-mix() liefert color(srgb 0..1), rgb() 0..255
      const farbe = (t) => { const s = /^color\(srgb /.test(t) ? 255 : 1; const m = (t.match(/[\d.]+/g) || [0, 0, 0]).map(Number); return { r: m[0] * s, g: m[1] * s, b: m[2] * s, a: m.length > 3 ? m[3] : 1 }; };
      const L = (f) => 0.2126 * lin(f.r) + 0.7152 * lin(f.g) + 0.0722 * lin(f.b);
      const ueber = (o, u) => ({ r: o.r * o.a + u.r * (1 - o.a), g: o.g * o.a + u.g * (1 - o.a), b: o.b * o.a + u.b * (1 - o.a), a: 1 });
      const nav = document.querySelector('.reiter-leiste');
      let grund = farbe(getComputedStyle(nav).backgroundColor);
      if (grund.a < 1) grund = ueber(grund, farbe(getComputedStyle(document.body).backgroundColor));
      const kr = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
      return [...nav.querySelectorAll('.reiter')].map((r) => {
        const vor = getComputedStyle(r, '::before');
        const sy = r.querySelector(':scope > .sy');
        const symbolFarbe = vor.content !== 'none' && vor.content !== 'normal' ? vor.backgroundColor : null;
        return { reiter: r.dataset.reiter, an: r.classList.contains('an'),
          symbol: symbolFarbe ? Math.round(kr(farbe(symbolFarbe), grund) * 10) / 10 : null,
          schrift: Math.round(kr(farbe(getComputedStyle(r).color), grund) * 10) / 10, spielSymbol: !!sy && getComputedStyle(sy).display !== 'none' };
      });
    });
    kontraste.push({ v, geraet, modus, mess });
    if (seitenfehler.length) { fehler++; console.log('FEHLER Seitenfehler', name, seitenfehler); }
    console.log(name, JSON.stringify(mess));
    await k.close();
  }
} finally {
  await browser.close();
  server.close();
}
writeFileSync(path.join(BILDER, 'kontraste.json'), JSON.stringify(kontraste, null, 1));
process.exit(fehler ? 1 : 0);
