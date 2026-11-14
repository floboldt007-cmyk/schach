// Funktionsprobe Bot-Welt (R19, Flos Wahl 14.11.2026: Botwelt Handy B + Welthintergrund A), im Browser wie ein Mensch.
// Je Geraet (iPhone 13, iPhone SE 375 x 667 und mit Safari-Leiste 375 x 548, iPad hoch, PC 1280) und Modus (hell mit Bewegung, dunkel mit prefers-reduced-motion):
//   Welt: am Handy die ganze Welt ohne Scrollen (Karte rollt nicht, jede Station darueber und ueber der Gegner-Leiste), die
//     Leiste nur, wo sie passt (zu kurz, SE mit Safari-Leiste: kompakte Welt mit Panel wie vor R19), die
//     Stationen ueberdecken sich nicht (nicht gequetscht); kein waagerechter Ueberlauf der Seite.
//   Hintergrund: Welt 1 (Karofelder) hat Voegel; mit Bewegung laufen sie, mit reduced-motion steht alles.
//   Kein Rueckschritt gegen die Basis: dieselbe Seite mit css/arena.css, js/ui/arena.js und js/sprachen/arena.js aus
//     origin/feinschliff-20261111 (per Route ausgeliefert); jeder sichtbare Knopf unter 44 px muss es dort auch schon sein.
//   Partie: ersten Gegner in der Welt antippen (Karte geht auf), Weiss waehlen, "Spielen", Schaefermatt bis zum Sieg-Blatt
//     (der Bot antwortet nach Plan ueber window.__test.botZug, wie tests/funktion-partie.test.mjs).
//   Keine Seiten- und Konsolenfehler. Bilder vorher (Basis) und nachher je Geraet und Modus.
//
//   node tests/r19-botwelt-probe.test.mjs
//   BILDER=<ordner> node tests/r19-botwelt-probe.test.mjs   Bilder dorthin (Standard: <tmp>/r19-botwelt-probe)
//   PORT=9641 node tests/r19-botwelt-probe.test.mjs         eigener Port (Standard: frei)
import http from 'node:http';
import { createRequire } from 'node:module';
import { readFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
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
const BILDER = process.env.BILDER || path.join(os.tmpdir(), 'r19-botwelt-probe');
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

// Basis fuer den Rueckschritt-Vergleich; ohne git (flacher Klon in CI) entfallen nur Vergleich und Vorher-Bild
const BASIS_REF = 'origin/feinschliff-20261111';
const BASIS_DATEIEN = ['css/arena.css', 'js/ui/arena.js', 'js/sprachen/arena.js'];
let basis = null;
try {
  basis = Object.fromEntries(BASIS_DATEIEN.map((d) => [d, execFileSync('git', ['show', `${BASIS_REF}:${d}`], { cwd: WURZEL, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })]));
} catch (e) { basis = null; }

const { defaultBrowserType: _a, ...IPHONE13 } = pw.devices['iPhone 13'];
const GERAETE = [
  { name: 'iphone13', optionen: IPHONE13, handy: 'leiste' },
  // iPhone SE wie im Rest der Suite (tests/ansicht.test.mjs), dazu mit Safari-Leiste (tests/arena.test.mjs)
  { name: 'iphonese', optionen: { ...IPHONE13, viewport: { width: 375, height: 667 }, screen: { width: 375, height: 667 } }, handy: 'leiste' },
  { name: 'iphonese-safari', optionen: { ...IPHONE13, viewport: { width: 375, height: 548 }, screen: { width: 375, height: 667 } }, handy: 'kompakt' },
  { name: 'ipad', optionen: { viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }, handy: false },
  { name: 'pc1280', optionen: { viewport: { width: 1280, height: 800 } }, handy: false },
];
const MODI = [{ name: 'hell', modus: 'hell', schema: 'light', ruhe: false }, { name: 'dunkel', modus: 'dunkel', schema: 'dark', ruhe: true }];
const ZUEGE = ['e2e4', 'f1c4', 'd1h5', 'h5f7'];
const PLAN = { e2e4: 'e7e5', f1c4: 'b8c6', d1h5: 'g8f6' };
const PARTIE = '.screen.partie:not(.online-screen)';

let ok = 0, gesamt = 0;
function pruefe(name, gut, detail = '') {
  gesamt++; if (gut) ok++;
  console.log(`${gut ? 'OK' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(detail).slice(0, 700)}`);
  return gut;
}
const warte = ms => new Promise(r => setTimeout(r, ms));
const klappt = p => p.then(() => true).catch(() => false);

async function oeffne(browser, g, m, alt) {
  const k = await browser.newContext({ ...g.optionen, locale: 'de-DE', colorScheme: m.schema, reducedMotion: m.ruhe ? 'reduce' : 'no-preference', serviceWorkers: 'block' });
  await k.route('**/*.supabase.co/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  if (alt) for (const d of BASIS_DATEIEN) {
    await k.route(u => new URL(u).pathname.endsWith('/' + d), r => r.fulfill({ status: 200, contentType: TYPEN[path.extname(d)], body: basis[d] }));
  }
  await k.addInitScript(modus => {
    try {
      if (sessionStorage.getItem('probe-start')) return;
      sessionStorage.setItem('probe-start', '1');
      localStorage.clear();
      const d = new Date(); if (d.getHours() < 4) d.setDate(d.getDate() - 1);
      const z = n => String(n).padStart(2, '0');
      localStorage.setItem('schach-arena:v1:modul:start', JSON.stringify({ v: 1, gesehen: `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}` }));
      localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ sprache: 'de', spracheGewaehlt: true, klang: false, modus }));
      localStorage.setItem('schach-arena:v1:hinweis-installieren', '1');
    } catch (e) { /* egal */ }
  }, m.modus);
  const s = await k.newPage(); s.setDefaultTimeout(15000);
  const fehler = [];
  s.on('pageerror', e => fehler.push(e.message));
  s.on('console', x => { if (x.type() === 'error') fehler.push(x.text()); });
  await s.goto(`http://127.0.0.1:${server.address().port}/index.html?test#arena`);
  await s.waitForSelector('.screen.arena .cta-platz .spielen', { state: 'visible', timeout: 20000 });
  await s.evaluate(() => document.fonts.ready);
  await warte(900);
  return { k, s, fehler };
}

// sichtbare Bedienelemente der Bots-Seite unter 44 px (Name aus Klasse und Text, damit Basis und neu vergleichbar sind)
const kleineKnoepfe = s => s.evaluate(() => [...document.querySelectorAll('.screen.arena :is(button, a[href], [role="button"])')].flatMap(e => {
  const r = e.getBoundingClientRect(), st = getComputedStyle(e);
  if (r.width < 1 || r.height < 1 || st.visibility === 'hidden' || e.closest('[hidden], [inert]')) return [];
  if (r.width >= 44 && r.height >= 44) return [];
  return [`${e.tagName}.${String(e.className).split(' ')[0]} "${(e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 24)}"`];
}));

const weltMessung = s => s.evaluate(() => {
  const sc = document.querySelector('.screen.arena');
  const karte = sc.querySelector('.karte');
  const k = karte.getBoundingClientRect();
  const detail = sc.querySelector('.detail');
  const leisteOben = sc.classList.contains('karte-leiste') && detail ? detail.getBoundingClientRect().top : k.bottom;
  const stationen = [...sc.querySelectorAll('.knoten[data-bot]')].map(e => {
    const r = e.getBoundingClientRect();
    return { id: e.dataset.bot, l: r.left, r: r.right, o: r.top, u: r.bottom };
  });
  const ausserhalb = stationen.filter(n => n.o < k.top - 1 || n.u > leisteOben + 1 || n.l < k.left - 1 || n.r > k.right + 1).map(n => n.id);
  const ueber = [];
  for (let i = 0; i < stationen.length; i++) for (let j = i + 1; j < stationen.length; j++) {
    const a = stationen[i], b = stationen[j];
    const x = Math.min(a.r, b.r) - Math.max(a.l, b.l), y = Math.min(a.u, b.u) - Math.max(a.o, b.o);
    if (x > 1 && y > 1) ueber.push(`${a.id}/${b.id}`);
  }
  const zug = sc.querySelector('.welt-svg .w-zug');
  const ww = sc.querySelector('.weltwahl')?.getBoundingClientRect();
  const krone = sc.querySelector('.knoten.boss .boss-krone')?.getBoundingClientRect();
  return {
    kroneFrei: !ww || !krone || krone.top >= ww.bottom - 1 || krone.right <= ww.left + 1 || krone.left >= ww.right - 1,
    klassen: sc.className, stationen: stationen.length, ausserhalb, ueber,
    karteRollt: karte.scrollHeight > karte.clientHeight + 1, karteH: karte.clientHeight, inhaltH: karte.scrollHeight,
    seiteBreit: document.documentElement.scrollWidth > innerWidth + 1,
    welt: sc.querySelector('.welt')?.dataset.welt, voegel: !!zug, bewegung: zug ? getComputedStyle(zug).animationName : null,
  };
});

async function zug(s, uci) {
  await s.waitForFunction(() => window.__partie.phase() === 'flo', null, { timeout: 30000 });
  for (const f of [uci.slice(0, 2), uci.slice(2, 4)]) await s.locator(`${PARTIE} .brett-felder .feld[data-feld="${f}"]`).click();
  if (await s.locator(`${PARTIE} .brett .lage.vorschau`).count()) await s.locator(`${PARTIE} .brett-felder .feld[data-feld="${uci.slice(2, 4)}"]`).click();
}

let browser;
try {
  browser = await browserTyp(pw).launch({ headless: true });
  for (const g of GERAETE) for (const m of MODI) {
    const name = `${g.name} ${m.name}${m.ruhe ? ' (weniger Bewegung)' : ''}`;
    // ---- vorher: Basis ----
    let kleinAlt = null;
    if (basis) {
      const a = await oeffne(browser, g, m, true);
      kleinAlt = await kleineKnoepfe(a.s);
      await a.s.screenshot({ path: path.join(BILDER, `${g.name}-${m.name}-vorher.png`) }).catch(() => {});
      await a.k.close();
    }
    // ---- nachher ----
    const { k, s, fehler } = await oeffne(browser, g, m, false);
    try {
      await s.screenshot({ path: path.join(BILDER, `${g.name}-${m.name}-nachher.png`) }).catch(() => {});
      const w = await weltMessung(s);
      if (g.handy) {
        if (g.handy === 'leiste') pruefe(`${name}: Handy-Welt als Leiste (karte-weg, karte-leiste)`, /karte-weg/.test(w.klassen) && /karte-leiste/.test(w.klassen), w.klassen);
        else pruefe(`${name}: zu kurz fuer die Leiste, kompakte Welt mit Panel (karte-kompakt)`, /karte-kompakt/.test(w.klassen) && !/karte-leiste|karte-weg/.test(w.klassen), w.klassen);
        pruefe(`${name}: ganze Welt ohne Scrollen (Karte rollt nicht)`, !w.karteRollt, { h: w.karteH, inhalt: w.inhaltH });
        pruefe(`${name}: jede Station in der Karte und ueber der Gegner-Leiste`, w.stationen >= 6 && !w.ausserhalb.length, w);
      } else {
        pruefe(`${name}: Stationen in der Welt (${w.stationen})`, w.stationen >= 6, w);
      }
      pruefe(`${name}: Stationen ueberdecken sich nicht (nicht gequetscht)`, !w.ueber.length, w.ueber);
      if (g.handy) pruefe(`${name}: Schild "Endgegner" nicht unter der Weltwahl`, w.kroneFrei, w);
      pruefe(`${name}: kein waagerechter Ueberlauf der Seite`, !w.seiteBreit);
      pruefe(`${name}: Welt 1 Karofelder mit Panorama (Voegel)`, w.welt === 'karofelder' && w.voegel, w);
      pruefe(`${name}: Hintergrund ${m.ruhe ? 'steht bei prefers-reduced-motion' : 'hat leichtes Leben'}`,
        m.ruhe ? w.bewegung === 'none' : !!w.bewegung && w.bewegung !== 'none', w.bewegung);
      const klein = await kleineKnoepfe(s);
      if (kleinAlt) {
        const neu = klein.filter(x => !kleinAlt.includes(x));
        pruefe(`${name}: kein neuer Knopf unter 44 px gegenueber ${BASIS_REF}`, !neu.length, { neu, basis: kleinAlt.length });
      }

      // Gegner waehlen: erste Station antippen
      const erster = await s.evaluate(() => document.querySelector('.screen.arena .knoten[data-bot]').dataset.bot);
      await s.locator(`.screen.arena .knoten[data-bot="${erster}"]`).click();
      await warte(700);
      const wahl = await s.evaluate(() => {
        const d = document.querySelector('.screen.arena .detail');
        const sc = document.querySelector('.screen.arena');
        const sp = d.querySelector('[data-aktion="spielen"]').getBoundingClientRect();
        return { offen: d.classList.contains('offen'), weg: sc.classList.contains('karte-weg'), name: d.querySelector('h2')?.textContent.trim(),
          // im Fenster und im sichtbaren Teil der (rollenden) Karte
          spielenSichtbar: sp.width > 0 && sp.bottom <= innerHeight + 1 && sp.top >= 0 && sp.bottom <= d.getBoundingClientRect().bottom + 1 && sp.top >= d.getBoundingClientRect().top - 1 };
      });
      pruefe(`${name}: Gegner ${erster} gewaehlt, ${g.handy === 'leiste' ? 'Karte geht auf, ' : ''}Spielen-Knopf im Bild`, (g.handy !== 'leiste' || wahl.offen) && wahl.spielenSichtbar && !!wahl.name, wahl);
      await s.screenshot({ path: path.join(BILDER, `${g.name}-${m.name}-gegner.png`) }).catch(() => {});
      const weiss = s.locator('.screen.arena .detail .seg[data-wert="w"]');
      if (await weiss.count()) await weiss.first().click();
      await s.evaluate(plan => {
        localStorage.removeItem('schach-arena:v1:laufend');
        window.__test = { botZug: () => { const v = window.__partie.chess().history({ verbose: true }); return plan[v[v.length - 1].lan] || null; } };
      }, PLAN);
      await s.locator('.screen.arena .detail [data-aktion="spielen"]').click();
      const gestartet = await klappt(s.waitForFunction(sel => window.__partie && window.__partie.bereit === true && window.__partie.phase() === 'flo'
        && window.__partie.chess().turn() === 'w' && window.__partie.chess().history().length === 0
        && document.querySelectorAll(sel + ' .brett img.figur').length === 32, PARTIE, { timeout: 30000 }));
      pruefe(`${name}: "Spielen" startet die Partie aus der Welt (Weiss, Flo am Zug)`, gestartet,
        await s.evaluate(() => ({ phase: window.__partie?.phase?.(), zug: window.__partie?.chess?.().turn(), screen: document.documentElement.dataset.screen })));
      if (gestartet) {
        for (const z of ZUEGE) await zug(s, z);
        const sieg = await klappt(s.waitForSelector('.ergebnis-overlay.sieg.gefuellt', { timeout: 40000 }));
        await warte(1200);
        await s.screenshot({ path: path.join(BILDER, `${g.name}-${m.name}-sieg.png`) }).catch(() => {});
        pruefe(`${name}: Schaefermatt, das Sieg-Blatt erscheint`, sieg, await s.evaluate(() => window.__partie.chess().history()));
      }
    } catch (e) {
      await s.screenshot({ path: path.join(BILDER, `${g.name}-${m.name}-abbruch.png`) }).catch(() => {});
      pruefe(`${name}: Ablauf ohne Abbruch`, false, e.message);
    }
    pruefe(`${name}: keine Seiten- und Konsolenfehler`, fehler.length === 0, fehler);
    await k.close().catch(() => {});
  }
  if (!basis) console.log(`Hinweis: ${BASIS_REF} nicht lesbar, Vergleich und Vorher-Bilder entfallen`);
} catch (e) { pruefe('Ablauf ohne Abbruch', false, e.stack); }
finally { await browser?.close(); await new Promise(r => server.close(r)); }
console.log(`\nBilder: ${BILDER}`);
console.log(`\n${ok}/${gesamt} bestanden`); process.exitCode = ok === gesamt ? 0 : 1;
