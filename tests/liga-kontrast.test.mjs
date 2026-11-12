// Liga, Ich-Seite und Ergebnis-Blatt: Befunde der Kritik R6 (Feinschliff 12.11.2026), im Browser gemessen statt gelesen.
//   B19  Marke "neu" in "Deine beste Partie diese Woche" bleibt ein Chip (war 170 px iPhone 13, 560 px PC: .bl-ib-mitte
//        ist ein Grid, das Kind streckte sich ueber die ganze Spalte)
//   B24  Freunde, angemeldet: das zugeklappte "Ohne Konto: Partie als Code teilen" sieht aus wie ein Knopf (Flaeche,
//        44 px, lesbar) statt wie eine lose Zeile
//   B25  Kontrast hell und dunkel: Stufe "Bronze" (und "Gold", gleiche Regel) im Freischalt-Moment (4,5:1), Ueberschrift "Aufstieg" der Liga-Gruppe
//        (4,5:1), goldenes "!" im Sieg-Titel (grosse Schrift, 3:1)
//   B27  "Besser?" (44 px) mass 43 px nur hinter dem offenen Ergebnis-Blatt: der Screen tritt dort zurueck (scale .975)
//        und ist inert (partie.js sperreHintergrund). Geprueft am echten Sieg-Blatt (Schaefermatt wie
//        tests/funktion-partie.test.mjs): alles hinter dem Blatt ist gesperrt, nach "Brett ansehen" wieder volle Groesse.
// B19, B24 und die ersten beiden B25-Faelle bauen das Markup der Anbieter (js/pakete/punkte/liste.js besteKarte,
// js/pakete/punkte/freunde.js reiterFreunde, js/pakete/sammlung/moment.js, js/pakete/liga/gruppe.js) mit den echten
// Stylesheets nach; das "!" misst das echte Sieg-Blatt. Netzwerk: nur 127.0.0.1, Supabase leer beantwortet.
//
//   node tests/liga-kontrast.test.mjs
//   PORT=9641 node tests/liga-kontrast.test.mjs   eigener Port (Standard: frei)
import http from 'node:http';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { browserTyp } from './browser.mjs';

const require = createRequire(import.meta.url);
let pw;
for (const p of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
  try { pw = require(p); break; } catch (e) { /* naechster */ }
}
if (!pw) throw new Error('Playwright fehlt');
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
const BASIS = `http://127.0.0.1:${server.address().port}/index.html?test`;

let ok = 0, gesamt = 0;
function pruefe(name, gut, detail = '') {
  gesamt++; if (gut) ok++;
  console.log(`${gut ? 'OK' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(detail)}`);
  return gut;
}
const klappt = p => p.then(() => true).catch(() => false);
const SCREEN = '.screen.partie:not(.online-screen)';
const ZUEGE = ['e2e4', 'f1c4', 'd1h5', 'h5f7'];
const PLAN = { e2e4: 'e7e5', f1c4: 'b8c6', d1h5: 'g8f6' };

// Im Browser: Kontrast eines Elements gegen den ersten deckenden Hintergrund darueber (WCAG-Formel). Farben kommen
// als rgb(...) oder, bei color-mix, als color(srgb r g b) zurueck.
const MESS = () => {
  const farbe = (s) => {
    let m = s.match(/^rgba?\(([^)]+)\)$/);
    if (m) { const v = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [v[0], v[1], v[2], v.length > 3 ? v[3] : 1]; }
    m = s.match(/^color\(srgb ([^)]+)\)$/);
    if (m) { const v = m[1].split(/[ /]+/).filter(Boolean).map(Number); return [v[0] * 255, v[1] * 255, v[2] * 255, v.length > 3 ? v[3] : 1]; }
    return null;
  };
  const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const lum = (f) => 0.2126 * lin(f[0]) + 0.7152 * lin(f[1]) + 0.0722 * lin(f[2]);
  window.__kontrast = (el) => {
    const vorn = farbe(getComputedStyle(el).color);
    let e = el, hinten = null;
    while (e && !hinten) { const b = farbe(getComputedStyle(e).backgroundColor); if (b && b[3] >= 0.99) hinten = b; e = e.parentElement; }
    if (!vorn || !hinten) return { k: 0, vorn: getComputedStyle(el).color };
    const a = lum(vorn), b = lum(hinten);
    return { k: Math.round(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)) * 100) / 100, vorn: getComputedStyle(el).color };
  };
};

// Nachbau der Anbieter-Ausgabe in einem Behaelter mit Seitenbreite; Paket-Stylesheets werden nachgeladen, falls die
// Startseite sie noch nicht hat
async function baue(s) {
  await s.evaluate(async () => {
    const noetig = ['css/pakete/punkte.css', 'css/pakete/liga.css', 'css/visitenkarte.css'];
    const da = [...document.querySelectorAll('link[rel="stylesheet"]')].map((l) => l.getAttribute('href'));
    await Promise.all(noetig.filter((h) => !da.some((d) => d && d.endsWith(h))).map((h) => new Promise((ok) => {
      const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = h; l.onload = ok; l.onerror = ok; document.head.append(l);
    })));
    document.getElementById('nachbau')?.remove();
    const n = document.createElement('div');
    n.id = 'nachbau';
    n.style.cssText = 'position:fixed;inset:0;z-index:99999;overflow:auto;background:var(--grund);padding:0 16px';
    n.innerHTML = `
      <article class="bl-karte bl-ich-beste"><span class="ueberzeile">Deine beste Partie diese Woche</span>
        <div class="bl-ib-zeile"><span class="bl-ib-bild"></span>
          <span class="bl-ib-mitte"><b>Lukas' Tafel</b><span class="bl-neu">neu</span>
            <span class="bl-z-info">11.11. · Weiß · 4 Züge · 88,6 %</span></span>
          <span class="bl-ib-punkte"><b class="zahl">3.500</b><small>Tafel-Punkte</small></span></div></article>
      <section class="bl-reiter" data-reiter="freunde"><article class="bl-karte bl-fr"><p class="bl-fr-satz">Noch keine Freunde.</p></article>
        <details class="bl-fr-codes"><summary>Ohne Konto: Partie als Code teilen</summary><p>Codes</p></details></section>
      <div class="st-karte" data-stufe="1"><p class="st-ueber">Neu</p><span class="st-name">Erster Zug</span><span class="st-stufe">Bronze</span></div>
      <div class="st-karte" data-stufe="3"><p class="st-ueber">Neu</p><span class="st-name">Erster Zug</span><span class="st-stufe">Gold</span></div>
      <div class="lg-gr-liste"><section class="lg-gr-abschnitt" data-zone="auf"><h3>Aufstieg</h3><ol></ol></section></div>`;
    document.body.append(n);
  });
  await s.waitForTimeout(150);
}

const modus = (s, m) => s.evaluate((m) => { document.documentElement.dataset.modus = m; }, m);

let browser;
try {
  browser = await browserTyp(pw).launch({ headless: true });
  for (const g of [{ name: 'iPhone 13', viewport: { width: 390, height: 844 } }, { name: 'PC', viewport: { width: 1280, height: 800 } }]) {
    const k = await browser.newContext({ viewport: g.viewport, locale: 'de-DE', serviceWorkers: 'block' });
    await k.route('**/*', (route) => {
      const u = new URL(route.request().url());
      if (u.hostname === '127.0.0.1') return route.continue();
      if (u.hostname.endsWith('.supabase.co')) return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      return route.abort();
    });
    await k.addInitScript(() => {
      try {
        localStorage.setItem('schach-arena:v1:modul:start', JSON.stringify({ v: 1, gesehen: '2026-11-01' }));
        localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ klang: false }));
        localStorage.setItem('schach-arena:v1:hinweis-installieren', '1');
      } catch (e) { /* egal */ }
    });
    const s = await k.newPage(); s.setDefaultTimeout(15000);
    const fehler = []; s.on('pageerror', (e) => fehler.push(e.message));
    await s.goto(BASIS + '#heim');
    await s.waitForFunction(() => window.__app && typeof window.__app.gehe === 'function' && document.documentElement.dataset.screen, null, { timeout: 30000 });
    await s.evaluate(MESS);
    await baue(s);

    // B19: Chip-Breite
    const chip = await s.evaluate(() => Math.round(document.querySelector('#nachbau .bl-ib-mitte .bl-neu').getBoundingClientRect().width));
    pruefe(`${g.name}: B19 Marke "neu" bleibt ein Chip (hoechstens 60 px breit)`, chip > 0 && chip <= 60, { breite: chip });

    for (const m of ['hell', 'dunkel']) {
      await modus(s, m);
      await s.waitForTimeout(80);
      const w = await s.evaluate(() => {
        const q = (x) => document.querySelector('#nachbau ' + x);
        const sum = q('.bl-fr-codes > summary');
        const cs = getComputedStyle(sum), grund = getComputedStyle(document.getElementById('nachbau')).backgroundColor;
        const r = sum.getBoundingClientRect();
        return {
          bronze: window.__kontrast(q('.st-karte[data-stufe="1"] .st-stufe')),
          gold: window.__kontrast(q('.st-karte[data-stufe="3"] .st-stufe')),
          auf: window.__kontrast(q('.lg-gr-abschnitt[data-zone="auf"] h3')),
          knopf: { hoehe: Math.round(r.height), flaeche: cs.backgroundColor !== grund && cs.backgroundColor !== 'rgba(0, 0, 0, 0)',
            schatten: cs.boxShadow !== 'none', zeiger: cs.cursor, kontrast: window.__kontrast(sum) },
        };
      });
      pruefe(`${g.name} ${m}: B25 Stufe "Bronze" mindestens 4,5:1`, w.bronze.k >= 4.5, w.bronze);
      pruefe(`${g.name} ${m}: Stufe "Gold" mindestens 4,5:1 (gleiche Regel wie Bronze)`, w.gold.k >= 4.5, w.gold);
      pruefe(`${g.name} ${m}: B25 Liga-Ueberschrift "Aufstieg" mindestens 4,5:1`, w.auf.k >= 4.5, w.auf);
      pruefe(`${g.name} ${m}: B24 "Partie als Code teilen" ist ein Knopf (eigene Flaeche mit Kante, 44 px, Zeiger, 4,5:1)`,
        w.knopf.flaeche && w.knopf.schatten && w.knopf.hoehe >= 44 && w.knopf.zeiger === 'pointer' && w.knopf.kontrast.k >= 4.5, w.knopf);
    }
    await modus(s, 'hell');
    await s.evaluate(() => document.getElementById('nachbau')?.remove());

    // Echtes Sieg-Blatt: "!" (B25) und der Bildschirm dahinter (B27)
    await s.evaluate((plan) => {
      localStorage.removeItem('schach-arena:v1:laufend');
      window.__test = { botZug: () => { const v = window.__partie.chess().history({ verbose: true }); return plan[v[v.length - 1].lan] || null; } };
      window.__app.gehe('partie', { botId: 'fridolin', farbe: 'w' });
    }, PLAN);
    const bereit = await klappt(s.waitForFunction((sel) => window.__partie && window.__partie.bereit === true && window.__partie.phase() === 'flo'
      && document.querySelectorAll(sel + ' .brett img.figur').length === 32, SCREEN, { timeout: 30000 }));
    if (!pruefe(`${g.name}: Partie gegen Fridolin startet`, bereit)) { await k.close(); continue; }
    for (const z of ZUEGE) {
      await s.waitForFunction(() => window.__partie.phase() === 'flo', null, { timeout: 30000 });
      for (const f of [z.slice(0, 2), z.slice(2, 4)]) await s.locator(`${SCREEN} .brett-felder .feld[data-feld="${f}"]`).click();
      // Zug bestaetigen (Vorschau): zweiter Tipp aufs Ziel
      if (await s.locator(`${SCREEN} .brett .lage.vorschau`).count()) await s.locator(`${SCREEN} .brett-felder .feld[data-feld="${z.slice(2, 4)}"]`).click();
    }
    const sieg = await klappt(s.waitForSelector('.ergebnis-overlay.sieg.gefuellt .erg-wort .ausruf', { timeout: 40000 }));
    if (!pruefe(`${g.name}: Schaefermatt, Sieg-Blatt mit "!" erscheint`, sieg)) { await k.close(); continue; }
    await s.waitForTimeout(1500);   // Eingangs-Animationen fertig
    for (const m of ['hell', 'dunkel']) {
      await modus(s, m);
      await s.waitForTimeout(80);
      const a = await s.evaluate(() => window.__kontrast(document.querySelector('.ergebnis-overlay.sieg .erg-wort .ausruf')));
      pruefe(`${g.name} ${m}: B25 "!" im Sieg-Titel mindestens 3:1 (grosse Schrift)`, a.k >= 3, a);
    }
    await modus(s, 'hell');
    // B27: hinter dem offenen Blatt ist alles gesperrt; ein Knopf dort ist kein Ziel, egal wie gross
    const hinten = await s.evaluate((sel) => {
      const sc = document.querySelector(sel);
      const kinder = [...sc.children].filter((e) => !e.classList.contains('ergebnis-overlay'));
      const knoepfe = [...sc.querySelectorAll('button')].filter((b) => !b.closest('.ergebnis-overlay'));
      return { kinder: kinder.length, inert: kinder.filter((e) => e.inert).length, knoepfe: knoepfe.length,
        offen: knoepfe.filter((b) => !b.closest('[inert]')).map((b) => b.className) };
    }, SCREEN);
    pruefe(`${g.name}: B27 hinter dem Ergebnis-Blatt ist jeder Knopf gesperrt (inert)`, hinten.kinder > 0 && hinten.inert === hinten.kinder
      && hinten.knoepfe > 0 && hinten.offen.length === 0, hinten);
    await s.locator('.ergebnis-overlay.sieg .erg-zu').click();
    await s.waitForFunction(() => { const o = document.querySelector('.ergebnis-overlay'); return !o || o.hidden; }, null, { timeout: 5000 }).catch(() => {});
    await s.waitForTimeout(700);   // Zuruecktreten (--d-l) zurueckgelaufen
    const vorn = await s.evaluate((sel) => {
      const inh = document.querySelector(sel + ' > .inhalt');
      const klein = [...document.querySelectorAll(sel + ' :is(.knopf, .icon-knopf)')].filter((b) => {
        const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !b.closest('[inert]') && getComputedStyle(b).minHeight === '44px' && r.height < 44;
      }).map((b) => b.className);
      return { transform: inh ? getComputedStyle(inh).transform : null, klein };
    }, SCREEN);
    pruefe(`${g.name}: B27 nach "Brett ansehen" volle Groesse (kein Zuruecktreten, kein 44-px-Knopf unter 44 px)`,
      (vorn.transform === 'none' || vorn.transform === 'matrix(1, 0, 0, 1, 0, 0)') && vorn.klein.length === 0, vorn);
    pruefe(`${g.name}: keine Seitenfehler`, fehler.length === 0, fehler);
    await k.close();
  }
} catch (e) {
  pruefe('Lauf ohne Abbruch', false, String(e && e.stack || e));
} finally {
  if (browser) await browser.close();
  server.close();
}
console.log(`\n${ok}/${gesamt} Pruefungen bestanden`);
process.exit(ok === gesamt && gesamt > 0 ? 0 : 1);
