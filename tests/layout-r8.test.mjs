// Layout-Kritik R8 (Feinschliff 13.11.2026), im Browser gemessen statt gelesen.
//   L2  Liga, Gruppe: das Banner-Motiv lag sichtbar hinter der Platzzahl (Plakette nur zu 86 % deckend). Die Zahl steht
//       jetzt auf einer deckenden Plakette; geprueft an einer Zeile aus js/pakete/liga/gruppe.js mit echtem Banner.
//   L5  Sieg-Blatt auf iPhone SE (375 x 667) und PC (1280 x 720): der Inhalt scrollte innen (+23 bis +55 px), die
//       Bot-Sprechblase lag halb unter dem Knopf-Fuss. Geprueft am echten zweiten Sieg (Schaefermatt wie
//       tests/funktion-partie.test.mjs; der erste Sieg zeigt zusaetzlich die Feier und darf scrollen).
//   L9  Blatt eines Ich-Bereichs (Shop, Erfolge) auf PC und iPad quer: "Fertig" stand halb breit links, auf dem Handy
//       volle Breite. Geprueft am echten sheet() aus js/ui/bauteile.js mit klasse 'sa-blatt' wie js/ui/ich.js.
//   LM  R9 Lobby mittig (Vorbau, Auswahlseite R9-LobbyLeere, Empfehlung B): Duell-Start, Online-Lobby und Zu-zweit-Start
//       liessen auf hohen Hochkant-Fenstern 160 bis 670 px Leere unter dem Inhalt. Dort steht der Inhalt jetzt mittig,
//       keine Leere ueber 60 px am Stueck auf dem iPhone 13; iPhone SE und quer bleiben oben ausgerichtet.
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

  // LM: Startansichten mit angemeldeter Test-Sitzung (ohne Sitzung zeigt das Duell nur die Konto-Karte)
  const LOBBYS = {
    'Duell-Start': { warte: '.screen.raetsel-duell[data-phase="start"] .rd-suchen', rumpf: '.rd-rumpf', knopf: '.rd-suchen',
      geh: () => window.__app.gehe('raetsel-duell') },
    'Online-Lobby': { warte: '.screen.online-screen .on-tuer-knopf', rumpf: '.on-rumpf', knopf: '.on-tuer[data-art="partie"] .on-tuer-knopf',
      geh: () => window.__app.gehe('online') },
    'Zu-zweit-Start': { warte: '.screen.zz-startblatt .zz-los', rumpf: '.zz-rumpf', knopf: '.zz-los',
      geh: () => window.__app.gehe('partie', { modus: 'zuzweit' }) },
    // ohne Liga-Streifen (Liga laedt nicht): 270 px frei auf dem iPhone 13, vier Luecken, unter 68 px geht es rechnerisch nicht
    'Online-Lobby ohne Liga': { warte: '.screen.online-screen .on-tuer-knopf', rumpf: '.on-rumpf', knopf: '.on-tuer[data-art="partie"] .on-tuer-knopf',
      geh: () => window.__app.gehe('online'), ohneLiga: true, leere: 80 },
  };
  // Leere = laengstes senkrechtes Stueck zwischen Rumpf-Oberkante und Reiterleiste (bzw. Rumpf-Unterkante), in dem kein
  // sichtbares Element mit Flaeche, Rahmen, Schatten, Bild oder Text liegt; oben = Abstand Rumpf-Oberkante bis Inhalt
  const MISS_LOBBY = ({ rumpf, knopf }) => {
    const ru = document.querySelector('.screen ' + rumpf), rr = ru.getBoundingClientRect();
    const l = document.querySelector('nav.reiter-leiste'), lr = l && l.checkVisibility() ? l.getBoundingClientRect() : null;
    const unten = Math.min(rr.bottom, lr && lr.top > innerHeight / 2 ? lr.top : Infinity);
    // nur fuer Vorleseprogramme (1 x 1 px wie der Seitenkopf auf dem Handy, css/navigation.css) zaehlt nicht
    const nurVorlesen = (el) => { for (let a = el; a && a !== ru; a = a.parentElement) { const r = a.getBoundingClientRect(); if (r.width <= 1 && r.height <= 1) return true; } return false; };
    const zaehlt = (el) => {
      if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true }) || nurVorlesen(el)) return false;
      const st = getComputedStyle(el);
      return st.backgroundColor !== 'rgba(0, 0, 0, 0)' || st.backgroundImage !== 'none' || st.boxShadow !== 'none'
        || parseFloat(st.borderTopWidth) > 0 || el.tagName === 'IMG' || el.tagName === 'svg'
        || [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim() !== '');
    };
    // ein sichtbarer Seitenkopf (iPad, Online) ist Kopf und bleibt oben: gemessen wird darunter
    const sk = [...ru.querySelectorAll('.seiten-kopf')].find((e) => zaehlt(e) || [...e.querySelectorAll('*')].some(zaehlt));
    const start = sk ? sk.getBoundingClientRect().bottom : rr.top;
    const iv = [...ru.querySelectorAll('*')].filter((e) => zaehlt(e) && !(sk && sk.contains(e))).map((e) => e.getBoundingClientRect())
      .filter((r) => r.height > 0 && r.bottom > start && r.top < unten)
      .map((r) => [Math.max(r.top, start), Math.min(r.bottom, unten)]).sort((a, b) => a[0] - b[0]);
    let pos = start, leere = 0;
    const luecken = [];   // [ab y, Hoehe] jeder Luecke ueber 20 px, fuer die Fehlermeldung
    for (const [a, b] of iv) { if (a - pos > 20) luecken.push([Math.round(pos), Math.round(a - pos)]); leere = Math.max(leere, a - pos); pos = Math.max(pos, b); }
    const k = document.querySelector('.screen ' + knopf).getBoundingClientRect();
    return { leere: Math.round(Math.max(leere, unten - pos)), oben: Math.round(iv[0][0] - start), untenFrei: Math.round(unten - pos),
      knopf: +((k.top + k.height / 2 - rr.top) / (unten - rr.top)).toFixed(2), innen: ru.scrollHeight - ru.clientHeight,
      seite: document.documentElement.scrollHeight - innerHeight, luecken };
  };
  for (const g of [{ name: 'iPhone 13', viewport: { width: 390, height: 844 }, hoch: true, leere: 64 },
    { name: 'iPad hoch', viewport: { width: 820, height: 1180 }, hoch: true }, { name: 'iPhone SE', viewport: { width: 375, height: 667 } },
    { name: 'iPad quer', viewport: { width: 1180, height: 820 } }]) {
    const { k, s, fehler } = await seite(browser, g.viewport);
    await s.evaluate(() => localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify({ access_token: 'a.eyJzdWIiOiJ1MSJ9.x',
      refresh_token: 'r', expires_at: 9999999999, user: { id: 'u1', email: 'u1@example.invalid' } })));
    let liga = true;   // Liga-Streifen wie bei einem echten Konto (js/ui/online.js zeigeLiga)
    await k.route('**/kronen_mein_stand**', (r) => r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify(liga ? [{ stufe: 3, platz: 3, n: 30, kronen: 140 }] : []) }));
    for (const [name, a] of Object.entries(LOBBYS)) {
      liga = !a.ohneLiga;
      await s.evaluate(a.geh);
      await s.waitForSelector(a.warte);
      await s.waitForTimeout(900);   // Eingangs-Animation und Nachladen (Liga-Zeile) fertig
      if (name === 'Online-Lobby') pruefe(`${g.name}: LM Liga-Streifen sichtbar (Nachbau eines Kontos)`, await s.locator('.on-liga:not([hidden])').count() === 1);
      const m = await s.evaluate(MISS_LOBBY, { rumpf: a.rumpf, knopf: a.knopf });
      if (g.hoch) {
        const grenze = a.leere || g.leere;
        pruefe(`${g.name}: LM ${name} mittig (Rand oben und unten unterscheiden sich um hoechstens 60 px)`, Math.abs(m.oben - m.untenFrei) <= 60, m);
        if (g.leere) pruefe(`${g.name}: LM ${name} keine Leere ueber ${grenze} px am Stueck`, m.leere <= grenze, m);
        pruefe(`${g.name}: LM ${name} kein Scrollen, kein Ueberlauf`, m.innen <= 1 && m.seite <= 0, m);
      } else {
        // wie heute: Inhalt oben (das Duell scrollt auf dem SE schon heute, das bleibt unangetastet)
        pruefe(`${g.name}: LM ${name} bleibt oben ausgerichtet (Inhalt beginnt hoechstens 20 px unter dem Rumpf)`, m.oben <= 20, m);
      }
      await s.evaluate(() => window.__app.gehe('heim'));
      await s.waitForTimeout(300);
    }
    pruefe(`${g.name}: keine Seitenfehler (LM)`, fehler.length === 0, fehler);
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
