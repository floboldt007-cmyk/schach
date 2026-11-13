// Layout-Kritik R8 (Feinschliff 13.11.2026), im Browser gemessen statt gelesen.
//   L2  Liga, Gruppe: das Banner-Motiv lag sichtbar hinter der Platzzahl (Plakette nur zu 86 % deckend). Die Zahl steht
//       jetzt auf einer deckenden Plakette; geprueft an einer Zeile aus js/pakete/liga/gruppe.js mit echtem Banner.
//   L5  Sieg-Blatt auf iPhone SE (375 x 667) und PC (1280 x 720): der Inhalt scrollte innen (+23 bis +55 px), die
//       Bot-Sprechblase lag halb unter dem Knopf-Fuss. Geprueft am echten zweiten Sieg (Schaefermatt wie
//       tests/funktion-partie.test.mjs; der erste Sieg zeigt zusaetzlich die Feier und darf scrollen).
//   L9  Blatt eines Ich-Bereichs (Shop, Erfolge) auf PC und iPad quer: "Fertig" stand halb breit links, auf dem Handy
//       volle Breite. Geprueft am echten sheet() aus js/ui/bauteile.js mit klasse 'sa-blatt' wie js/ui/ich.js.
// Netzwerk: nur 127.0.0.1, Supabase leer beantwortet.
//
//   node tests/layout-r8.test.mjs
//   PORT=9642 node tests/layout-r8.test.mjs   eigener Port (Standard: frei)
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
  '.wasm': 'application/wasm', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.mp3': 'audio/mpeg',
  '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
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
const modus = (s, m) => s.evaluate((m) => { document.documentElement.dataset.modus = m; }, m);

// Deckkraft einer berechneten Hintergrundfarbe (rgb, rgba oder color(srgb ...) bei color-mix)
const DECKUNG = () => {
  window.__deckung = (el) => {
    const s = getComputedStyle(el).backgroundColor;
    let m = s.match(/^rgba?\(([^)]+)\)$/);
    if (m) { const v = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return v.length > 3 ? v[3] : 1; }
    m = s.match(/^color\(srgb ([^)]+)\)$/);
    if (m) { const v = m[1].split(/[ /]+/).filter(Boolean).map(Number); return v.length > 3 ? v[3] : 1; }
    return 0;
  };
};

async function seite(browser, viewport) {
  const k = await browser.newContext({ viewport, locale: 'de-DE', serviceWorkers: 'block' });
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
  await s.evaluate(DECKUNG);
  return { k, s, fehler };
}

// Schaefermatt gegen Fridolin bis zum gefuellten Sieg-Blatt
async function sieg(s) {
  await s.evaluate((plan) => {
    localStorage.removeItem('schach-arena:v1:laufend');
    window.__test = { botZug: () => { const v = window.__partie.chess().history({ verbose: true }); return plan[v[v.length - 1].lan] || null; } };
    window.__app.gehe('partie', { botId: 'fridolin', farbe: 'w' });
  }, PLAN);
  const bereit = await klappt(s.waitForFunction((sel) => window.__partie && window.__partie.bereit === true && window.__partie.phase() === 'flo'
    && document.querySelectorAll(sel + ' .brett img.figur').length === 32 && !document.querySelector('.ergebnis-overlay:not([hidden])'), SCREEN, { timeout: 30000 }));
  if (!bereit) return false;
  for (const z of ZUEGE) {
    await s.waitForFunction(() => window.__partie.phase() === 'flo', null, { timeout: 30000 });
    for (const f of [z.slice(0, 2), z.slice(2, 4)]) await s.locator(`${SCREEN} .brett-felder .feld[data-feld="${f}"]`).click();
    if (await s.locator(`${SCREEN} .brett .lage.vorschau`).count()) await s.locator(`${SCREEN} .brett-felder .feld[data-feld="${z.slice(2, 4)}"]`).click();
  }
  const da = await klappt(s.waitForSelector('.ergebnis-overlay.sieg.gefuellt', { timeout: 40000 }));
  await s.waitForTimeout(2500);   // Eingangs-Animationen fertig (Bot-Zeile kommt nach 900 ms)
  return da;
}

let browser;
try {
  browser = await browserTyp(pw).launch({ headless: true });

  // L2 und L9: Nachbau auf dem PC und dem iPad quer (dort war "Fertig" halb breit), L9 zur Gegenprobe auch am Handy
  for (const g of [{ name: 'PC', viewport: { width: 1280, height: 720 } }, { name: 'iPad quer', viewport: { width: 1180, height: 820 } },
    { name: 'iPhone 13', viewport: { width: 390, height: 844 } }]) {
    const { k, s, fehler } = await seite(browser, g.viewport);
    const bannerUrl = await s.evaluate(async () => {
      const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'css/pakete/liga.css';
      await new Promise((ok) => { l.onload = ok; l.onerror = ok; document.head.append(l); });
      const v = await import('./js/ui/visitenkarte.js').catch(() => null);
      const url = v && v.bannerUrl ? v.bannerUrl('start') : '';
      const n = document.createElement('div');
      n.id = 'nachbau';
      n.style.cssText = 'position:fixed;inset:0;z-index:99999;overflow:auto;background:var(--grund);padding:0 16px';
      n.innerHTML = `<div class="lg-gr-liste"><section class="lg-gr-abschnitt"><ol>
        <li class="lg-gr-zeile" data-platz="27" data-banner="start"><span class="lg-gr-streifen" aria-hidden="true"
          style="background-image:url('${url}')"></span><span class="lg-gr-platz">27</span>
          <button class="lg-gr-wer" type="button"><span class="lg-gr-avatar">KI</span><span class="lg-gr-name"><b>Kira</b></span></button>
          <span class="lg-gr-kronen">76</span><span class="lg-gr-lohn-leer"></span></li>
        <li class="lg-gr-zeile ich" data-platz="3" data-banner="start"><span class="lg-gr-streifen" aria-hidden="true"
          style="background-image:url('${url}')"></span><span class="lg-gr-platz">3</span>
          <button class="lg-gr-wer" type="button"><span class="lg-gr-avatar">DU</span><span class="lg-gr-name"><b>Du</b></span></button>
          <span class="lg-gr-kronen">364</span><span class="lg-gr-lohn-leer"></span></li></ol></section></div>`;
      document.body.append(n);
      return url;
    });
    await s.waitForTimeout(150);
    pruefe(`${g.name}: L2 Nachbau mit echtem Banner (js/ui/visitenkarte.js bannerUrl)`, !!bannerUrl, bannerUrl);
    if (g.name !== 'iPhone 13') {
      for (const m of ['hell', 'dunkel']) {
        await modus(s, m);
        await s.waitForTimeout(80);
        const p = await s.evaluate(() => [...document.querySelectorAll('#nachbau .lg-gr-zeile[data-banner] .lg-gr-platz')].map((e) => {
          const r = e.getBoundingClientRect(), st = e.parentElement.querySelector('.lg-gr-streifen').getBoundingClientRect();
          return { zahl: e.textContent, deckung: window.__deckung(e), ueberStreifen: r.left < st.right && r.right > st.left, breite: Math.round(r.width) };
        }));
        pruefe(`${g.name} ${m}: L2 Platzzahl ueber dem Banner steht auf einer deckenden Plakette`,
          p.length === 2 && p.every((x) => x.ueberStreifen && x.deckung >= 0.99), p);
      }
      await modus(s, 'hell');
    }
    await s.evaluate(() => document.getElementById('nachbau')?.remove());

    // L9: echtes Blatt eines Ich-Bereichs mit genau einem Knopf
    await s.evaluate(async () => {
      const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'css/pakete/sammlung.css';
      await new Promise((ok) => { l.onload = ok; l.onerror = ok; document.head.append(l); });
      const { sheet } = await import('./js/ui/bauteile.js');
      const inhalt = document.createElement('div');
      inhalt.className = 'sa-blatt-inhalt';
      inhalt.innerHTML = '<p>Editionen kaufen kann, wer 18 oder älter ist.</p>';
      sheet({ titel: 'Shop', inhalt, klasse: 'sa-blatt', knoepfe: [{ text: 'Fertig', wert: true }], abbrechen: false });
    });
    await s.waitForSelector('.sheet-karte.sa-blatt .sheet-knoepfe .knopf');
    await s.waitForTimeout(600);
    const f = await s.evaluate(() => {
      const reihe = document.querySelector('.sheet-karte.sa-blatt .sheet-knoepfe'), k = reihe.querySelector('.knopf');
      return { reihe: Math.round(reihe.getBoundingClientRect().width), knopf: Math.round(k.getBoundingClientRect().width), hoehe: Math.round(k.getBoundingClientRect().height) };
    });
    pruefe(`${g.name}: L9 "Fertig" im Bereichs-Blatt ueber die volle Breite (wie am Handy), mindestens 44 px hoch`,
      f.reihe > 0 && f.knopf >= f.reihe - 1 && f.hoehe >= 44, f);
    pruefe(`${g.name}: keine Seitenfehler (Nachbau)`, fehler.length === 0, fehler);
    await k.close();
  }

  // U7 (app.test "Zeilen nicht ineinander"): erstes Sieg-Blatt, Fenster danach auf die Hoehe ohne Safari-Leiste verkleinert
  // (390 x 664, 375 x 548). Keine Zeile des Scrollbereichs darf in die vorige ragen; gemessen wie in tests/app.test.mjs
  // (Unterkante einer Zeile = tiefster sichtbarer, nicht absolut gesetzter Nachfahre).
  for (const g of [{ name: 'iPhone 13', viewport: { width: 390, height: 844 } }, { name: 'iPhone SE', viewport: { width: 375, height: 667 } }]) {
    const { k, s, fehler } = await seite(browser, g.viewport);
    if (!pruefe(`${g.name}: U7 erster Sieg gegen Fridolin`, await sieg(s))) { await k.close(); continue; }
    for (const [w, hh] of [[390, 664], [375, 548]]) {
      await s.setViewportSize({ width: w, height: hh });
      await s.waitForTimeout(300);
      const r = await s.evaluate(() => {
        const rumpf = document.querySelector('.ergebnis-overlay .erg-rumpf');
        const sicht = (e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden';
        const name = (e) => (e.className || e.tagName).toString().split(' ')[0];
        const reihen = [...rumpf.children].filter(sicht).map((e) => {
          let u = e.getBoundingClientRect().bottom, tief = name(e);
          for (const d of e.querySelectorAll('*')) {
            if (!sicht(d) || getComputedStyle(d).position === 'absolute') continue;
            const b = d.getBoundingClientRect().bottom;
            if (b > u) { u = b; tief = name(d); }
          }
          return { n: name(e), top: Math.round(e.getBoundingClientRect().top * 10) / 10, unten: Math.round(e.getBoundingClientRect().bottom * 10) / 10, u: Math.round(u * 10) / 10, tief };
        }).sort((x, y) => x.top - y.top);
        const ineinander = reihen.filter((x, i) => i > 0 && x.top < reihen[i - 1].u - 0.5).map((x) => x.n);
        return { ineinander, reihen };
      });
      if (process.env.U7_BILDER) await s.screenshot({ path: path.join(process.env.U7_BILDER, `u7-${g.viewport.width}x${g.viewport.height}-${w}x${hh}.png`) });
      pruefe(`${g.name}: U7 bei ${w} x ${hh} ruecken die Zeilen des Sieg-Blatts nicht ineinander`, r.ineinander.length === 0, r);
    }
    pruefe(`${g.name}: keine Seitenfehler (U7)`, fehler.length === 0, fehler);
    await k.close();
  }

  // R9-3: Niederlage-Blatt (Aufgeben ueber den Halte-Knopf wie tests/funktion-partie.test.mjs). Am iPhone SE lag der
  // Untertitel unter dem runden Auge-Knopf oben rechts. Kein Text darf ihn beruehren, auf keinem Geraet, auch nicht mit dem
  // laengsten Untertitel (alle Bot-Namen x "Aufgegeben gegen ..." und "... setzt dich im 120. Zug matt", wie js/ui/partie.js).
  for (const g of [{ name: 'iPhone SE', viewport: { width: 375, height: 667 } }, { name: 'iPhone 13', viewport: { width: 390, height: 844 } },
    { name: 'iPad quer', viewport: { width: 1180, height: 820 } }, { name: 'PC 1280 x 720', viewport: { width: 1280, height: 720 } }]) {
    const { k, s, fehler } = await seite(browser, g.viewport);
    await s.evaluate(() => { localStorage.removeItem('schach-arena:v1:laufend'); window.__app.gehe('partie', { botId: 'fridolin', farbe: 'w' }); });
    const bereit = await klappt(s.waitForFunction((sel) => window.__partie && window.__partie.bereit === true && window.__partie.phase() === 'flo'
      && document.querySelectorAll(sel + ' .brett img.figur').length === 32, SCREEN, { timeout: 30000 }));
    const knopf = s.locator(`${SCREEN} .spielknoepfe > [data-aktion="aufgeben"]`);
    const r = bereit ? await knopf.boundingBox() : null;
    if (r) { await s.mouse.move(r.x + r.width / 2, r.y + r.height / 2); await s.mouse.down(); await s.waitForTimeout(1400); await s.mouse.up(); }
    if (!pruefe(`${g.name}: R9-3 Aufgeben fuehrt zum Niederlage-Blatt`, !!r && await klappt(s.waitForSelector('.ergebnis-overlay.niederlage.gefuellt', { timeout: 20000 })))) { await k.close(); continue; }
    await s.waitForTimeout(1500);
    const unterAuge = () => s.evaluate(() => {
      const o = document.querySelector('.ergebnis-overlay'), auge = o.querySelector('.erg-zu').getBoundingClientRect();
      const treffer = [];
      const w = document.createTreeWalker(o.querySelector('.ergebnis-karte'), NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) {
        if (!n.textContent.trim() || n.parentElement.closest('.erg-zu, [hidden]')) continue;
        const b = document.createRange(); b.selectNodeContents(n);
        for (const z of b.getClientRects()) {
          if (z.right > auge.left + 0.5 && z.left < auge.right - 0.5 && z.bottom > auge.top + 0.5 && z.top < auge.bottom - 0.5) treffer.push(n.textContent.trim().slice(0, 40));
        }
      }
      return { treffer, auge: [Math.round(auge.left), Math.round(auge.top), Math.round(auge.right), Math.round(auge.bottom)] };
    });
    const echt = await unterAuge();
    pruefe(`${g.name}: R9-3 kein Text unter dem Auge-Knopf (echter Untertitel)`, echt.treffer.length === 0, echt);
    const laengster = await s.evaluate(async () => {
      const { BOTS } = await import('./js/bots.js'), { t } = await import('./js/sprache.js');
      const kandidaten = BOTS.flatMap((b) => [t('partie.erg.aufgabe', { name: b.name }), t('partie.erg.mattNiederlage', { nr: 120, name: b.name })]);
      const l = kandidaten.sort((a, b) => b.length - a.length)[0];
      document.querySelector('.ergebnis-overlay .erg-unter').textContent = l;
      return l;
    });
    await s.waitForTimeout(100);
    const lang = await unterAuge();
    pruefe(`${g.name}: R9-3 kein Text unter dem Auge-Knopf (laengster Untertitel "${laengster}")`, lang.treffer.length === 0, lang);
    if (process.env.U7_BILDER) await s.screenshot({ path: path.join(process.env.U7_BILDER, `r93-${g.viewport.width}x${g.viewport.height}.png`) });
    pruefe(`${g.name}: keine Seitenfehler (R9-3)`, fehler.length === 0, fehler);
    await k.close();
  }

  // L5: echtes Sieg-Blatt; der erste Sieg zeigt die Feier, gemessen wird der zweite (das gewoehnliche Sieg-Blatt)
  for (const g of [{ name: 'iPhone SE', viewport: { width: 375, height: 667 } }, { name: 'PC 1280 x 720', viewport: { width: 1280, height: 720 } },
    { name: 'iPhone 13', viewport: { width: 390, height: 844 } }]) {
    const { k, s, fehler } = await seite(browser, g.viewport);
    if (!pruefe(`${g.name}: erster Sieg gegen Fridolin`, await sieg(s))) { await k.close(); continue; }
    await s.evaluate(() => window.__app.gehe('heim'));
    await s.waitForTimeout(1500);
    for (let i = 0; i < 4; i++) {   // Feier-Blaetter nach dem ersten Sieg schliessen
      const w = s.getByRole('button', { name: /^Weiter$/ }).filter({ visible: true });
      if (!(await w.count())) break;
      await w.first().click(); await s.waitForTimeout(800);
    }
    if (!pruefe(`${g.name}: zweiter Sieg, Sieg-Blatt mit Bot-Spruch`, await sieg(s)
      && await s.locator('.ergebnis-overlay .erg-bot:not([hidden]) .sprechblase').count() === 1)) { await k.close(); continue; }
    const miss = () => s.evaluate(() => {
      const q = (x) => document.querySelector('.ergebnis-overlay ' + x);
      const ru = q('.erg-rumpf'), bot = q('.erg-bot').getBoundingClientRect(), ak = q('.erg-aktionen').getBoundingClientRect();
      const ziele = [...document.querySelectorAll('.ergebnis-overlay :is(button, a)')].filter((b) => b.getBoundingClientRect().height > 0)
        .filter((b) => b.getBoundingClientRect().height < 44).map((b) => b.className + ' ' + Math.round(b.getBoundingClientRect().height));
      return { innen: ru.scrollHeight - ru.clientHeight, botUnten: Math.round(bot.bottom), rumpfUnten: Math.round(ru.getBoundingClientRect().bottom),
        fussOben: Math.round(ak.top), blase: Math.round(q('.erg-bot .sprechblase').getBoundingClientRect().height), klein: ziele };
    });
    const r = await miss();
    pruefe(`${g.name}: L5 Sieg-Blatt scrollt nicht innen, Bot-Sprechblase ganz ueber dem Knopf-Fuss`,
      r.innen <= 1 && r.botUnten <= r.rumpfUnten && r.botUnten <= r.fussOben, r);
    pruefe(`${g.name}: L5 alle Knoepfe im Sieg-Blatt mindestens 44 px hoch`, r.klein.length === 0, r);
    // Der Spruch ist zufaellig (js/sprachen/bots.js, "verliert"); der laengste deutsche bricht am SE dreizeilig um
    await s.evaluate(() => { document.querySelector('.ergebnis-overlay .erg-bot .sprechblase').textContent =
      'Du bist mir zu flink! Grüß mir die Janine in ihrer Scheune, die freut sich auf dich.'; });
    await s.waitForTimeout(100);
    const lang = await miss();
    pruefe(`${g.name}: L5 auch mit dem laengsten Bot-Spruch kein Innen-Scrollen`,
      lang.innen <= 1 && lang.botUnten <= lang.rumpfUnten && lang.botUnten <= lang.fussOben, lang);
    pruefe(`${g.name}: keine Seitenfehler (Sieg-Blatt)`, fehler.length === 0, fehler);
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
