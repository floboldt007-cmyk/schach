// Funktionsprobe Welt-Vorschau (R19, Flo 15.11.2026: "die neue Welt, dass man die sehen kann, aber noch nicht gegen die
// spielen kann ... Da soll kein Schloss bei sein"), im Browser wie ein Mensch.
// Je Geraet (iPhone 13, iPhone SE, iPad hoch und quer, PC 1280) und Modus (hell mit Bewegung, dunkel mit prefers-reduced-motion):
//   frisch (nichts besiegt), Pfeil vor in Welt 2:
//     (a) die Welt ist sichtbar: Landschaft in Farbe, sechs Stationen mit Bild und Name, kein Schloss (weder Element noch
//         Schloss-Bild) in der Karte;
//     (d) jede Station sagt dem Bildschirmleser, warum sie noch nicht spielbar ist ("Besiege zuerst Janine");
//     (b) Tipp auf einen Bot der Welt oeffnet seine Karte, statt "Spielen" steht dort der Hinweis; keine Partie startet.
//   Welt 1 besiegt (Saat): (c) der erste Bot von Welt 2 ist spielbar, "Spielen" startet die Partie.
//   Keine Seiten- und Konsolenfehler. Bilder vorher (Basis) und nachher je Geraet und Modus.
//
//   node tests/r19-welt-vorschau.test.mjs
//   BILDER=<ordner> node tests/r19-welt-vorschau.test.mjs   Bilder dorthin (Standard: <tmp>/r19-welt-vorschau)
import http from 'node:http';
import { createRequire } from 'node:module';
import { readFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';
import { browserTyp } from './browser.mjs';
import { BOTS, botsDerWelt } from '../js/bots.js';

const require = createRequire(import.meta.url);
let pw;
for (const p of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
  try { pw = require(p); break; } catch (e) { /* naechster */ }
}
if (!pw) throw new Error('Playwright fehlt');
const BILDER = process.env.BILDER || path.join(os.tmpdir(), 'r19-welt-vorschau');
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

// Vorher-Bilder mit den Arena-Dateien der Basis; ohne git (flacher Klon in CI) entfallen nur die Vorher-Bilder
const BASIS_REF = 'origin/feinschliff-20261111';
const BASIS_DATEIEN = ['css/arena.css', 'js/ui/arena.js', 'js/sprachen/arena.js'];
let basis = null;
try {
  basis = Object.fromEntries(BASIS_DATEIEN.map((d) => [d, execFileSync('git', ['show', `${BASIS_REF}:${d}`], { cwd: WURZEL, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })]));
} catch (e) { basis = null; }

const { defaultBrowserType: _a, ...IPHONE13 } = pw.devices['iPhone 13'];
const GERAETE = [
  { name: 'iphone13', optionen: IPHONE13 },
  { name: 'iphonese', optionen: { ...IPHONE13, viewport: { width: 375, height: 667 }, screen: { width: 375, height: 667 } } },
  { name: 'ipad-hoch', optionen: { viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } },
  { name: 'ipad-quer', optionen: { viewport: { width: 1180, height: 820 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } },
  { name: 'pc1280', optionen: { viewport: { width: 1280, height: 800 } } },
];
const MODI = [{ name: 'hell', modus: 'hell', schema: 'light', ruhe: false }, { name: 'dunkel', modus: 'dunkel', schema: 'dark', ruhe: true }];
const WELT2 = botsDerWelt(2).map((b) => b.id);
const SIEG = { sterne: [true, false, false], partien: 1, siege: 1, remis: 0, niederlagen: 0, besteGenauigkeit: 80 };
const SAAT_WELT1 = { bots: Object.fromEntries(BOTS.filter((b) => b.welt === 1).map((b) => [b.id, SIEG])), brillanteZuege: [] };
// der Pfad des Schloss-Bilds aus js/ui/icons.js: taucht er in der Karte auf, ist dort ein Schloss
const SCHLOSS_PFAD = 'M8 11V8a4 4 0 0 1 8 0v3';
const PARTIE = '.screen.partie:not(.online-screen)';

let ok = 0, gesamt = 0;
function pruefe(name, gut, detail = '') {
  gesamt++; if (gut) ok++;
  console.log(`${gut ? 'OK' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(detail).slice(0, 700)}`);
  return gut;
}
const warte = ms => new Promise(r => setTimeout(r, ms));
const klappt = p => p.then(() => true).catch(() => false);

async function oeffne(browser, g, m, { alt = false, saat = null } = {}) {
  const k = await browser.newContext({ ...g.optionen, locale: 'de-DE', colorScheme: m.schema, reducedMotion: m.ruhe ? 'reduce' : 'no-preference', serviceWorkers: 'block' });
  await k.route('**/*.supabase.co/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  if (alt) for (const d of BASIS_DATEIEN) {
    await k.route(u => new URL(u).pathname.endsWith('/' + d), r => r.fulfill({ status: 200, contentType: TYPEN[path.extname(d)], body: basis[d] }));
  }
  await k.addInitScript(([modus, saat]) => {
    try {
      if (sessionStorage.getItem('probe-start')) return;
      sessionStorage.setItem('probe-start', '1');
      localStorage.clear();
      const d = new Date(); if (d.getHours() < 4) d.setDate(d.getDate() - 1);
      const z = n => String(n).padStart(2, '0');
      localStorage.setItem('schach-arena:v1:modul:start', JSON.stringify({ v: 1, gesehen: `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}` }));
      localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ sprache: 'de', spracheGewaehlt: true, klang: false, modus }));
      localStorage.setItem('schach-arena:v1:hinweis-installieren', '1');
      if (saat) localStorage.setItem('schach-arena:v1:fortschritt', JSON.stringify(saat));
    } catch (e) { /* egal */ }
  }, [m.modus, saat]);
  const s = await k.newPage(); s.setDefaultTimeout(15000);
  const fehler = [];
  s.on('pageerror', e => fehler.push(e.message));
  s.on('console', x => { if (x.type() === 'error') fehler.push(x.text()); });
  await s.goto(`http://127.0.0.1:${server.address().port}/index.html?test#arena`);
  await s.waitForSelector('.screen.arena .knoten[data-bot]', { state: 'visible', timeout: 20000 });
  await s.evaluate(() => document.fonts.ready);
  await warte(900);
  return { k, s, fehler };
}

async function zuWelt2(s) {
  await s.locator('.screen.arena .ww-pfeil[data-richtung="1"]').click();
  await s.waitForSelector(`.screen.arena .knoten[data-bot="${WELT2[0]}"]`);
  await warte(600);
}

const vorschau = (s, pfad) => s.evaluate(([pfad]) => {
  const sc = document.querySelector('.screen.arena');
  const welt = sc.querySelector('.welt');
  const svg = welt.querySelector('.welt-svg');
  const st = getComputedStyle(svg);
  const stationen = [...welt.querySelectorAll('.knoten[data-bot]')].map((k) => {
    const img = k.querySelector('.avatar img');
    const name = k.querySelector('.k-name');
    const r = img.getBoundingClientRect();
    return { id: k.dataset.bot, bild: img.complete && img.naturalWidth > 0 && r.width > 8 && Number(getComputedStyle(img).opacity) >= 0.5,
      name: (name?.textContent || '').trim(), label: k.getAttribute('aria-label') || '' };
  });
  return { welt: welt.dataset.welt, filter: st.filter, deckkraft: st.opacity, stationen,
    schlossElemente: sc.querySelectorAll('.welt .schloss, .welt-sperre .ico').length, schlossBild: welt.innerHTML.includes(pfad) };
}, [pfad]);

let browser;
try {
  browser = await browserTyp(pw).launch({ headless: true });
  for (const g of GERAETE) for (const m of MODI) {
    const name = `${g.name} ${m.name}${m.ruhe ? ' (weniger Bewegung)' : ''}`;
    // ---- vorher: Basis, Welt 2 ----
    if (basis) {
      const a = await oeffne(browser, g, m, { alt: true });
      try { await zuWelt2(a.s); await a.s.screenshot({ path: path.join(BILDER, `${g.name}-${m.name}-vorher.png`) }); } catch (e) { /* nur ein Bild */ }
      await a.k.close();
    }
    // ---- nachher, frisch: Welt 2 ist Vorschau ----
    {
      const { k, s, fehler } = await oeffne(browser, g, m);
      try {
        await zuWelt2(s);
        await s.screenshot({ path: path.join(BILDER, `${g.name}-${m.name}-nachher.png`) }).catch(() => {});
        const v = await vorschau(s, SCHLOSS_PFAD);
        pruefe(`${name}: (a) Welt 2 sichtbar, Landschaft in Farbe (kein Grau-Filter)`, v.welt === 'springerforst' && v.filter === 'none' && Number(v.deckkraft) === 1, v);
        pruefe(`${name}: (a) sechs Stationen mit Bild und Name`, v.stationen.length === 6 && v.stationen.every((x) => x.bild && x.name), v.stationen);
        pruefe(`${name}: (a) kein Schloss in der Karte (Element oder Bild)`, v.schlossElemente === 0 && !v.schlossBild, v);
        pruefe(`${name}: (d) Bildschirmleser nennt den Grund ("Besiege zuerst Janine")`, v.stationen.every((x) => /Besiege zuerst Janine/.test(x.label)), v.stationen.map((x) => x.label));
        const bot = WELT2[1];
        await s.locator(`.screen.arena .knoten[data-bot="${bot}"]`).click();
        await warte(900);
        const karte = await s.evaluate(() => {
          const d = document.querySelector('.screen.arena .detail');
          const h = d.querySelector('.sp-gesperrt');
          const r = h?.getBoundingClientRect();
          return { h2: d.querySelector('h2')?.textContent.trim(), spielen: d.querySelectorAll('[data-aktion="spielen"]').length,
            hinweis: h ? h.textContent.trim() : null, hinweisSichtbar: !!r && r.width > 0 && r.height > 0,
            schloss: d.querySelectorAll('.schloss').length };
        });
        pruefe(`${name}: (b) Tipp oeffnet die Bot-Karte (${BOTS.find((b) => b.id === bot).name}), statt "Spielen" der Hinweis, kein Schloss`,
          karte.h2 === BOTS.find((b) => b.id === bot).name && karte.spielen === 0 && /^Besiege zuerst Janine/.test(karte.hinweis || '') && karte.hinweisSichtbar && karte.schloss === 0, karte);
        await s.screenshot({ path: path.join(BILDER, `${g.name}-${m.name}-karte.png`) }).catch(() => {});
        // noch einmal tippen (sonst der Wink zum Spielen-Knopf) und den Hinweis antippen: keine Partie. Am Handy hoch
        // (Layout B) liegt die aufgegangene Gegner-Karte ueber der Welt, dort erreicht ein zweiter Tipp die Station nicht
        await s.locator(`.screen.arena .knoten[data-bot="${bot}"]`).click({ timeout: 2500 }).catch(() => {});
        await s.locator('.screen.arena .detail .sp-gesperrt').click().catch(() => {});
        await warte(1200);
        const lage = await s.evaluate(() => ({ laufend: localStorage.getItem('schach-arena:v1:laufend'),
          partie: !!document.querySelector('.screen.partie:not(.online-screen)') && getComputedStyle(document.querySelector('.screen.partie:not(.online-screen)')).display !== 'none'
            && !document.querySelector('.screen.arena') }));
        pruefe(`${name}: (b) vor dem Sieg startet keine Partie`, !lage.laufend && !lage.partie, lage);
      } catch (e) {
        await s.screenshot({ path: path.join(BILDER, `${g.name}-${m.name}-abbruch.png`) }).catch(() => {});
        pruefe(`${name}: Vorschau ohne Abbruch`, false, e.message);
      }
      pruefe(`${name}: Vorschau ohne Seiten- und Konsolenfehler`, fehler.length === 0, fehler);
      await k.close().catch(() => {});
    }
    // ---- nachher, Welt 1 besiegt: Welt 2 spielbar ----
    {
      const { k, s, fehler } = await oeffne(browser, g, m, { saat: SAAT_WELT1 });
      try {
        const w = await s.evaluate(() => document.querySelector('.screen.arena .welt').dataset.welt);
        if (w !== 'springerforst') await zuWelt2(s);
        const erster = WELT2[0];
        await s.locator(`.screen.arena .knoten[data-bot="${erster}"]`).click();
        await warte(900);
        const z = await s.evaluate((id) => ({ gesperrt: document.querySelector(`.screen.arena .knoten[data-bot="${id}"]`).classList.contains('gesperrt'),
          spielen: document.querySelectorAll('.screen.arena .detail [data-aktion="spielen"]').length, hinweis: document.querySelectorAll('.screen.arena .detail .sp-gesperrt').length }), erster);
        pruefe(`${name}: (c) nach dem Sieg ueber Janine: ${erster} frei, Spielen-Knopf statt Hinweis`, !z.gesperrt && z.spielen === 1 && z.hinweis === 0, z);
        const weiss = s.locator('.screen.arena .detail .seg[data-wert="w"]');
        if (await weiss.count()) await weiss.first().click();
        await s.locator('.screen.arena .detail [data-aktion="spielen"]').click();
        const gestartet = await klappt(s.waitForFunction(sel => window.__partie && window.__partie.bereit === true
          && document.querySelectorAll(sel + ' .brett img.figur').length === 32, PARTIE, { timeout: 30000 }));
        pruefe(`${name}: (c) "Spielen" startet die Partie gegen ${erster}`, gestartet
          && await s.evaluate((id) => JSON.parse(localStorage.getItem('schach-arena:v1:laufend') || 'null')?.botId === id, erster).catch(() => false),
          await s.evaluate(() => ({ screen: document.documentElement.dataset.screen, laufend: localStorage.getItem('schach-arena:v1:laufend') })).catch((e) => e.message));
      } catch (e) {
        await s.screenshot({ path: path.join(BILDER, `${g.name}-${m.name}-frei-abbruch.png`) }).catch(() => {});
        pruefe(`${name}: freie Welt ohne Abbruch`, false, e.message);
      }
      pruefe(`${name}: freie Welt ohne Seiten- und Konsolenfehler`, fehler.length === 0, fehler);
      await k.close().catch(() => {});
    }
  }
  if (!basis) console.log(`Hinweis: ${BASIS_REF} nicht lesbar, Vorher-Bilder entfallen`);
} catch (e) { pruefe('Ablauf ohne Abbruch', false, e.stack); }
finally { await browser?.close(); await new Promise(r => server.close(r)); }
console.log(`\nBilder: ${BILDER}`);
console.log(`\n${ok}/${gesamt} bestanden`); process.exitCode = ok === gesamt ? 0 : 1;
