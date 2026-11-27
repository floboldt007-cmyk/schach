// Tastatur-Fokus auf dem Brett sichtbar (fc-11:50, Fenster 7b; Befund f2 R20-Kritik/zustaende-kontrast F1: der Rahmen
// .brett > .brett-fokus hatte gegen das Feld nur 1,33:1 bis 1,99:1). WCAG 1.4.11 / 2.4.7: der Rahmen hebt sich auf JEDEM
// Feld jedes Bretts mit mindestens 3:1 ab, hell und dunkel. Ein Rahmen aus mehreren Baendern (outline, box-shadow) zaehlt,
// wenn mindestens eines davon auf dem Feld 3:1 erreicht; jedes Band muss deckend sein.
// Gemessen werden alle Bretter (js/storage.js EINSTELLUNG_WERTE.brett, js/labor.js LABOR_BRETTER und MOTIV_BRETTER), auf
// der Partie, iPhone 13. Der Rahmen kommt nur bei Tastatur (:focus-visible): Tab aufs Brett zeigt ihn, ein Klick nicht.
//   node tests/r25-brett-fokus.test.mjs [--bilder <ordner>] [--pc]     (PLAYWRIGHT_PFAD, BROWSER=webkit fuer WebKit)
// Mit --bilder: je Modus ein Bild der Brettecke mit Rahmen auf hellem und dunklem Feld (nacht, holz, gruen, marmor).
import http from 'node:http';
import { appHeute } from './app-heute.mjs';
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { browserTyp } from './browser.mjs';
import { freierPort } from './freier-port.mjs';

const GRENZE = 3;
let ok = 0; let fehler = 0;
function pruefe(name, wert, info = '') {
  if (wert) { ok++; console.log('ok   ' + name); } else { fehler++; console.log('FEHLER ' + name + ' ' + (typeof info === 'string' ? info : JSON.stringify(info))); } // INTENTIONAL-SLOP[T4]: die Konsole ist der Ausgabeweg der Probe
}
const require = createRequire(import.meta.url);
let pw = null;
for (const p of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
  try { pw = require(p); break; } catch (e) { /* naechster */ } // INTENTIONAL-SLOP[F1]: Fehlschlag heisst naechster Kandidat
}
if (!pw) { pruefe('Playwright gefunden', false); console.log(`${ok}/${ok + fehler} bestanden`); process.exit(1); } // INTENTIONAL-SLOP[T4]: Ausgabeweg der Probe
const bi = process.argv.indexOf('--bilder');
const BILDER = bi > 0 ? path.resolve(process.argv[bi + 1]) : null;
if (BILDER) mkdirSync(BILDER, { recursive: true });
const PC = process.argv.includes('--pc');   // nur fuer Bilder: PC-Fenster 1440 x 900 statt iPhone 13

const root = fileURLToPath(new URL('../', import.meta.url));
const typen = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' };
const server = http.createServer((req, res) => {
  const p = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://test').pathname).replace(/\/$/, '/index.html'));
  if (!p.startsWith(root)) { res.writeHead(403); res.end(); return; }
  try { const d = readFileSync(p); res.writeHead(200, { 'Content-Type': typen[path.extname(p)] || 'application/octet-stream' }); res.end(d); }
  catch (e) { res.writeHead(404); res.end(); }
});
const PORT = Number(process.env.PORT) || await freierPort();
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

// misst im Browser: jedes sichtbare Band des Rahmens (outline, box-shadow mit Breite) gegen die Farbe des hellen und des
// dunklen Feldes
const messen = () => {
  const zuRgb = (t) => { const c = document.createElement('canvas').getContext('2d'); c.fillStyle = '#000'; c.fillStyle = t; c.fillRect(0, 0, 1, 1); return [...c.getImageData(0, 0, 1, 1).data]; };
  const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const kon = (a, b) => { const x = lum(a), y = lum(b); return Math.round(((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)) * 100) / 100; };
  const ring = document.querySelector('.screen.partie .brett > .brett-fokus');
  const c = getComputedStyle(ring);
  const baender = [];
  if (c.outlineStyle !== 'none' && parseFloat(c.outlineWidth) > 0) baender.push({ art: 'outline', farbe: zuRgb(c.outlineColor), breite: parseFloat(c.outlineWidth) });
  // box-shadow: "rgb(...) 0px 0px 0px 2px inset, ..." (Farbe vorn, Spread als vierte Laenge)
  for (const teil of (c.boxShadow === 'none' ? [] : c.boxShadow.split(/,(?![^(]*\))/))) {
    const farbe = (teil.match(/(rgba?|color)\([^)]*\)/) || [])[0];
    const laengen = (teil.replace(/(rgba?|color)\([^)]*\)/, '').match(/-?[\d.]+px/g) || []).map(parseFloat);
    if (farbe && (laengen[3] || 0) > 0) baender.push({ art: 'schatten', farbe: zuRgb(farbe), breite: laengen[3] });
  }
  const o = { sichtbar: !ring.hidden && ring.getClientRects().length > 0, baender: baender.map((b) => ({ ...b, farbe: b.farbe.join(',') })) };
  for (const art of ['h', 'd']) {
    const feld = zuRgb(getComputedStyle(document.querySelector(`.screen.partie .brett .feld.${art}`)).backgroundColor);
    const je = baender.map((b) => (b.farbe[3] === 255 ? kon(b.farbe, feld) : 0));
    o[art] = { bestes: je.length ? Math.max(...je) : 0, je, feld: feld.slice(0, 3).join(',') };
  }
  return o;
};

const browser = await browserTyp(pw).launch({ headless: true });
// T-072: "heute" wie die App (js/tag.js, Tagesgrenze 4 Uhr), nicht das UTC-Datum
const HEUTE = await appHeute(browser, `http://127.0.0.1:${PORT}/`);
try {
  for (const modus of ['hell', 'dunkel']) {
    const k = await browser.newContext({ viewport: PC ? { width: 1440, height: 900 } : { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block', locale: 'de-DE' });
    await k.route('**/*', (r) => (new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort()));
    await k.addInitScript((e) => {
      try {
        const P = 'schach-arena:v1:';
        localStorage.setItem(P + 'modul:start', JSON.stringify({ v: 1, gesehen: e.heute }));
        localStorage.setItem(P + 'hinweis-installieren', '1');
        localStorage.setItem(P + 'einstellungen', JSON.stringify({ sprache: 'de', spracheGewaehlt: true, modus: e.modus, brett: 'nacht', koordinaten: true, koordLage: 'ecke' }));
      } catch (f) { /* egal */ } // INTENTIONAL-SLOP[F1]: Speicher gesperrt heisst Probe ohne Vorbelegung
    }, { heute: HEUTE, modus });
    const s = await k.newPage();
    await s.goto(`http://127.0.0.1:${PORT}/?test#heim`);
    await s.waitForFunction(() => !!window.__app, null, { timeout: 20000 });
    await s.waitForTimeout(2500);   // der Start leitet erst noch um (Heim/Arena); danach erst zur Partie
    await s.evaluate(() => window.__app.gehe('partie', { botId: 'fridolin', farbe: 'w', modus: 'frei' }));
    await s.waitForFunction(() => window.__partie?.bereit === true, null, { timeout: 30000 });
    await s.waitForTimeout(800);

    // Klick auf ein Feld: kein Rahmen (nur Tastatur zeigt ihn)
    await s.locator('.screen.partie .brett .feld[data-feld="a3"]').click();
    const nachKlick = await s.evaluate(() => { const r = document.querySelector('.screen.partie .brett > .brett-fokus'); return !!r && !r.hidden; });
    pruefe(`${modus}: nach einem Klick aufs Feld kein Fokusrahmen (nur bei Tastatur)`, !nachKlick);
    await s.keyboard.press('Escape');
    await s.evaluate(() => document.activeElement && document.activeElement.blur());

    // Tab bis aufs Brett
    let aufBrett = false;
    for (let i = 0; i < 80 && !aufBrett; i++) {
      await s.keyboard.press('Tab');
      aufBrett = await s.evaluate(() => !!document.activeElement?.closest?.('.screen.partie .brett .feld'));
    }
    pruefe(`${modus}: mit Tab erreicht der Fokus ein Feld des Bretts`, aufBrett);
    if (!aufBrett) { await k.close(); continue; }
    const m0 = await s.evaluate(messen);
    pruefe(`${modus}: mit Tab ist der Fokusrahmen sichtbar`, m0.sichtbar, m0);

    const ids = await s.evaluate(async () => {
      const L = await import('/js/labor.js'); const S = await import('/js/storage.js');
      return [...new Set([...S.EINSTELLUNG_WERTE.brett, ...L.LABOR_BRETTER.map((b) => b.id), ...L.MOTIV_BRETTER.map((b) => b.id)])];
    });
    if (modus === 'hell') pruefe(`Bretter gefunden (${ids.length})`, ids.length >= 60, ids.length);
    let schwach = Infinity; let schwachBei = '';
    for (const id of ids) {
      await s.evaluate(async (b) => {
        const L = await import('/js/labor.js'); const html = document.documentElement;
        html.dataset.brett = b; await L.brettFlaeche(html, b, true);
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      }, id);
      const m = await s.evaluate(messen);
      for (const a of ['h', 'd']) if (m[a].bestes < schwach) { schwach = m[a].bestes; schwachBei = `${id} ${a}`; }
      pruefe(`${id} ${modus}: Fokusrahmen auf hellem Feld ${m.h.bestes}:1, auf dunklem ${m.d.bestes}:1 (mind. ${GRENZE})`,
        m.h.bestes >= GRENZE && m.d.bestes >= GRENZE, m);
      if (BILDER && ['nacht', 'holz', 'gruen', 'marmor'].includes(id)) {
        // Rahmen auf einem hellen und einem dunklen Feld (Pfeil nach oben wechselt die Feldfarbe)
        for (const schritt of ['', 'ArrowUp']) {
          if (schritt) await s.keyboard.press(schritt);
          await s.waitForTimeout(150);
          const r = await s.evaluate(() => { const x = document.querySelector('.screen.partie .brett > .brett-fokus').getBoundingClientRect(); return { x: x.left - x.width, y: x.top - x.height, width: x.width * 3, height: x.height * 3 }; });
          // Feldart unter der Mitte des Rahmens (der Rahmen selbst laesst Klicks durch)
          const feldArt = await s.evaluate(() => {
            const x = document.querySelector('.screen.partie .brett > .brett-fokus').getBoundingClientRect();
            const f = document.elementsFromPoint(x.left + x.width / 2, x.top + x.height / 2).find((e) => e.classList.contains('feld'));
            return f && f.classList.contains('h') ? 'hell' : 'dunkel';
          });
          await s.screenshot({ path: path.join(BILDER, `${id}-${modus}-feld-${feldArt}.png`), clip: r });
        }
        await s.keyboard.press('ArrowDown');
      }
    }
    console.log(`${modus}: schwaechster Rahmen ${schwach}:1 (${schwachBei})`);
    await k.close();
  }
} finally {
  await browser.close(); server.close();
}
console.log(`${ok}/${ok + fehler} bestanden`);
process.exit(fehler ? 1 : 0);
