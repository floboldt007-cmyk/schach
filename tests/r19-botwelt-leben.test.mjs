// Funktionsprobe "Bot-Welt lebendig" (R19, Flo 14.11. und 15.11.2026), im Browser wie ein Mensch:
//   Handy hoch (Flo 14.11.: "sieht gequetscht aus", Wahl Variante B): die ganze Welt auf einen Blick, der Gegner als
//     schmale Leiste unten (.karte-leiste); alle sechs Stationen samt Schild und Flos Figur liegen in der Karte und nicht
//     unter der Leiste, die Karte scrollt nicht; der Griff oeffnet und schliesst die Karte (aria-expanded, Name DE/EN);
//     iPad und PC behalten ihr Layout (keine Leiste).
//   Weltname als Plakette (Flo 15.11.: "nicht mehr grau"): je Welt ein eigenes Wappen (SVG in der App, mind. 24 px, fuer
//     Vorleser verborgen, der Name traegt die Information),
//     Name gut lesbar (>= 4,5:1 gegen die Plakette), Plakette mit Gold-Kante.
//   Je Welt genau EIN lebendiges Element (Leitlinie Regel 2): eine CSS-Animation in .welt-leben, nur transform und
//     opacity, schon im ersten Bild sichtbar; mit prefers-reduced-motion keine Animation, das Element bleibt als Standbild.
//   Keine Seiten- und Konsolenfehler.
//
//   node tests/r19-botwelt-leben.test.mjs
import http from 'node:http';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { BOTS, botsDerWelt, WELTEN } from '../js/bots.js';

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

const { defaultBrowserType: _a, ...IPHONE13 } = pw.devices['iPhone 13'];
const HANDYS = [
  { name: 'iphone13', optionen: IPHONE13 },
  { name: 'iphonese', optionen: { ...IPHONE13, viewport: { width: 375, height: 667 }, screen: { width: 375, height: 667 } } },
];
const GROSS = [
  { name: 'ipad-hoch', optionen: { viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } },
  { name: 'pc1280', optionen: { viewport: { width: 1280, height: 800 } } },
];
const SIEG = { sterne: [true, false, false], partien: 1, siege: 1, remis: 0, niederlagen: 0, besteGenauigkeit: 80 };
// Welt 1 und zwei Bots von Welt 2 besiegt: Flos Figur steht mitten in Welt 2, der aktuelle Bot ist der dritte
const SAAT = { bots: Object.fromEntries(BOTS.filter((b) => b.welt === 1 || ['bodo', 'kalle'].includes(b.id)).map((b) => [b.id, SIEG])), brillanteZuege: [] };

let ok = 0, gesamt = 0;
function pruefe(name, gut, detail = '') {
  gesamt++; if (gut) ok++;
  console.log(`${gut ? 'OK' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(detail).slice(0, 700)}`);
  return gut;
}
const warte = ms => new Promise(r => setTimeout(r, ms));

async function oeffne(browser, g, { schema = 'light', modus = 'hell', ruhe = false, sprache = 'de', saat = SAAT } = {}) {
  const k = await browser.newContext({ ...g.optionen, locale: sprache === 'en' ? 'en-US' : 'de-DE', colorScheme: schema,
    reducedMotion: ruhe ? 'reduce' : 'no-preference', serviceWorkers: 'block' });
  await k.route('**/*.supabase.co/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await k.addInitScript(([modus, saat, sprache]) => {
    try {
      if (sessionStorage.getItem('probe-start')) return;
      sessionStorage.setItem('probe-start', '1');
      localStorage.clear();
      const d = new Date(); if (d.getHours() < 4) d.setDate(d.getDate() - 1);
      const z = n => String(n).padStart(2, '0');
      localStorage.setItem('schach-arena:v1:modul:start', JSON.stringify({ v: 1, gesehen: `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}` }));
      localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ sprache, spracheGewaehlt: true, klang: false, modus, arenaKarteHinweis: true }));
      localStorage.setItem('schach-arena:v1:hinweis-installieren', '1');
      if (saat) localStorage.setItem('schach-arena:v1:fortschritt', JSON.stringify(saat));
    } catch (e) { /* egal */ }
  }, [modus, saat, sprache]);
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

async function zuWelt(s, nr) {
  const ziel = botsDerWelt(nr)[0].id;
  for (let i = 0; i < WELTEN.length + 1; i++) {
    if (await s.locator(`.screen.arena .knoten[data-bot="${ziel}"]`).count()) break;
    const aktuell = await s.evaluate(() => document.querySelector('.screen.arena .welt')?.dataset.welt);
    const nrAktuell = WELTEN.find((w) => w.id === aktuell)?.nr ?? 1;
    await s.locator(`.screen.arena .ww-pfeil[data-richtung="${nr > nrAktuell ? 1 : -1}"]`).click();
    await warte(450);
  }
  await s.waitForSelector(`.screen.arena .knoten[data-bot="${ziel}"]`);
  await warte(500);
}

// Lage von Karte, Leiste, Stationen und Figur in Bildschirm-Pixeln
const lage = (s) => s.evaluate(() => {
  const sc = document.querySelector('.screen.arena');
  const karte = sc.querySelector('.karte');
  const k = karte.getBoundingClientRect();
  const det = sc.querySelector('.detail');
  const d = det.getBoundingClientRect();
  const leiste = sc.classList.contains('karte-leiste');
  const teile = [];
  for (const el of sc.querySelectorAll('.welt .knoten[data-bot]')) {
    for (const t of [el, el.querySelector('.k-schild')].filter(Boolean)) {
      const r = t.getBoundingClientRect();
      if (r.width || r.height) teile.push({ bot: el.dataset.bot, teil: t === el ? 'station' : 'schild', top: r.top, bottom: r.bottom, left: r.left, right: r.right });
    }
  }
  const f = sc.querySelector('.flo-figur').getBoundingClientRect();
  return { leiste, offen: det.classList.contains('offen'), scroll: karte.scrollHeight - karte.clientHeight,
    karte: { top: k.top, bottom: k.bottom, left: k.left, right: k.right }, detailTop: d.top, teile,
    figur: { top: f.top, bottom: f.bottom, left: f.left, right: f.right, w: f.width } };
});

// Weltwahl-Plakette und lebendiges Element der aktuellen Welt
const welt = (s) => s.evaluate(() => {
  const sc = document.querySelector('.screen.arena');
  const lum = (c) => {
    const m = c.match(/[\d.]+/g); if (!m) return null;
    const [r, g, b] = m.slice(0, 3).map(Number).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const kontrast = (a, b) => { const x = lum(a), y = lum(b); if (x == null || y == null) return 0; return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const mitte = sc.querySelector('.ww-mitte');
  const name = sc.querySelector('.ww-name');
  const wappen = sc.querySelector('.ww-wappen svg');
  const mcs = getComputedStyle(mitte);
  const leben = sc.querySelector('.welt .welt-leben');
  const anims = document.getAnimations().filter((a) => a.effect && a.effect.target && leben && leben.contains(a.effect.target)
    && a.playState === 'running');
  const props = [...new Set(anims.flatMap((a) => a.effect.getKeyframes().flatMap((f) => Object.keys(f))))]
    .filter((p) => !['offset', 'computedOffset', 'easing', 'composite'].includes(p));
  const vor = leben ? getComputedStyle(leben, '::before') : null;
  return {
    id: sc.querySelector('.welt').dataset.welt,
    wappen: wappen ? { src: wappen.getAttribute('data-wappen') || '', geladen: wappen.getBoundingClientRect().width >= 24 && wappen.querySelectorAll('path, rect, circle').length >= 2,
      alt: wappen.closest('[aria-hidden="true"]') ? '' : 'sichtbar fuer Vorleser' } : null,
    name: name.textContent.trim(),
    kontrast: kontrast(getComputedStyle(name).color, mcs.backgroundColor),
    hgDeckend: /rgba?\([^)]*\)/.test(mcs.backgroundColor) && !/,\s*0\)$/.test(mcs.backgroundColor),
    goldKante: mcs.boxShadow + ' ' + mcs.borderColor,
    leben: leben ? { da: true, sichtbar: vor && vor.content !== 'none' && Number(vor.opacity) > 0, opacity: vor && vor.opacity,
      anims: anims.length, props, ziele: anims.map((a) => a.effect.pseudoElement || 'element') } : null,
  };
});

const browser = await pw.chromium.launch();
try {
  // ---------- Handy hoch: Leiste, ganze Welt, Griff ----------
  for (const g of HANDYS) {
    for (const m of [{ schema: 'light', modus: 'hell' }, { schema: 'dark', modus: 'dunkel' }]) {
      const { k, s, fehler } = await oeffne(browser, g, m);
      try {
        const tag = `${g.name} ${m.modus}`;
        await zuWelt(s, 2);
        const l = await lage(s);
        pruefe(`${tag}: Gegner als Leiste unten (karte-leiste, zu)`, l.leiste && !l.offen, l);
        pruefe(`${tag}: ganze Welt ohne Scrollen`, l.scroll <= 1, l.scroll);
        const draussen = l.teile.filter((t) => t.top < l.karte.top - 1 || t.bottom > l.karte.bottom + 1 || t.left < l.karte.left - 1 || t.right > l.karte.right + 1);
        pruefe(`${tag}: alle Stationen und Schilder in der Karte`, l.teile.length >= 12 && !draussen.length, draussen);
        const unter = l.teile.filter((t) => t.bottom > l.detailTop + 1);
        pruefe(`${tag}: keine Station und kein Schild unter der Leiste`, l.leiste && !unter.length, { detailTop: l.detailTop, unter });
        pruefe(`${tag}: Flos Figur in der Karte ueber der Leiste`, l.figur.w > 0 && l.figur.top >= l.karte.top - 1 && l.figur.bottom <= l.detailTop + 1,
          { figur: l.figur, detailTop: l.detailTop });
        const griff = s.locator('.screen.arena .detail .karte-griff');
        const vorher = await griff.count() ? await griff.evaluate((e) => ({ exp: e.getAttribute('aria-expanded'), label: e.getAttribute('aria-label'),
          w: e.getBoundingClientRect().width, h: e.getBoundingClientRect().height })) : null;
        pruefe(`${tag}: Griff zu, mit Namen, mindestens 44 px hoch`, vorher && vorher.exp === 'false' && /Mehr zum Gegner/.test(vorher.label || '') && vorher.h >= 44, vorher);
        if (vorher) {
          await griff.click(); await warte(400);
          const auf = await s.evaluate(() => ({ offen: document.querySelector('.screen.arena .detail').classList.contains('offen'),
            exp: document.querySelector('.screen.arena .karte-griff').getAttribute('aria-expanded') }));
          pruefe(`${tag}: Griff oeffnet die Karte`, auf.offen && auf.exp === 'true', auf);
          await griff.click(); await warte(400);
          const zu = await s.evaluate(() => document.querySelector('.screen.arena .detail').classList.contains('offen'));
          pruefe(`${tag}: Griff schliesst sie wieder`, !zu, String(zu));
          // Tastatur (design-beweis 17.11., WCAG 2.4.11): bei offener Karte fuehrt Umschalt+Tab vom Griff zurueck in die
          // Welt; die fokussierte Station darf nicht unter der Karte verschwinden
          await griff.click(); await warte(400);
          let fokus = null;
          for (let i = 0; i < 4 && !(fokus && fokus.station); i++) {
            await s.keyboard.press('Shift+Tab'); await warte(250);
            fokus = await s.evaluate(() => {
              const el = document.activeElement;
              const kn = el && el.closest('.screen.arena .knoten[data-bot]');
              if (!kn) return { station: false, el: el && el.className };
              const q = kn.getBoundingClientRect();
              const frei = [[q.left + q.width / 2, q.top + q.height / 2], [q.left + 4, q.top + 4], [q.right - 4, q.bottom - 4]]
                .some(([x, y]) => kn.contains(document.elementFromPoint(x, y)));
              return { station: true, bot: kn.dataset.bot, frei, offen: document.querySelector('.screen.arena .detail').classList.contains('offen') };
            });
          }
          pruefe(`${tag}: Station mit Tastaturfokus nicht unter der offenen Karte verdeckt`, fokus && fokus.station && fokus.frei, fokus);
        }
        const sp = await s.evaluate(() => {
          const b = document.querySelector('.screen.arena .detail [data-aktion="spielen"]');
          if (!b) return null; const r = b.getBoundingClientRect();
          return { w: r.width, h: r.height, name: (b.getAttribute('aria-label') || b.textContent || '').trim() };
        });
        pruefe(`${tag}: Spielen-Knopf in der Leiste tippbar und benannt`, sp && sp.w >= 44 && sp.h >= 44 && sp.name.length > 2, sp);
        pruefe(`${tag}: keine Seiten- und Konsolenfehler`, !fehler.length, fehler);
      } finally { await k.close(); }
    }
  }
  // Griff auf Englisch
  {
    const { k, s, fehler } = await oeffne(browser, HANDYS[0], { sprache: 'en' });
    try {
      const label = await s.locator('.screen.arena .karte-griff').getAttribute('aria-label').catch(() => null);
      pruefe('iphone13 EN: Griff heisst "Show more about the opponent"', label === 'Show more about the opponent', label);
      pruefe('iphone13 EN: keine Seiten- und Konsolenfehler', !fehler.length, fehler);
    } finally { await k.close(); }
  }
  // Kaltreview 6b 17.11.2026: offene Karte, dann Wechsel in eine Vorschau-Welt (dort wird das Detail nicht neu gebaut). Die Karte
  // klappt zu, und der Griff muss das auch sagen, sonst hoert ein Vorleser "erweitert" auf einer zugeklappten Leiste
  {
    const { k, s, fehler } = await oeffne(browser, HANDYS[0]);
    try {
      await s.locator('.screen.arena .detail .karte-griff').click(); await warte(400);
      await s.locator('.screen.arena .ww-pfeil[data-richtung="1"]').click(); await warte(800);
      const g = await s.evaluate(() => { const d = document.querySelector('.screen.arena .detail'), gr = d.querySelector('.karte-griff');
        return { offen: d.classList.contains('offen'), exp: gr.getAttribute('aria-expanded'), label: gr.getAttribute('aria-label'),
          unter: document.querySelector('.screen.arena .ww-unter')?.textContent || '' }; });
      pruefe('iphone13: Wechsel in eine Vorschau-Welt klappt die Karte zu, der Griff sagt zu (aria-expanded false, "Mehr zum Gegner zeigen")',
        /Vorschau/.test(g.unter) && !g.offen && g.exp === 'false' && g.label === 'Mehr zum Gegner zeigen', g);
      pruefe('iphone13 Weltwechsel: keine Seiten- und Konsolenfehler', !fehler.length, fehler);
    } finally { await k.close(); }
  }

  // ---------- iPad und PC: kein Leisten-Layout ----------
  for (const g of GROSS) {
    const { k, s, fehler } = await oeffne(browser, g);
    try {
      const l = await lage(s);
      pruefe(`${g.name}: kein Leisten-Layout`, !l.leiste, l.leiste);
      pruefe(`${g.name}: keine Seiten- und Konsolenfehler`, !fehler.length, fehler);
    } finally { await k.close(); }
  }

  // ---------- Plakette und lebendiges Element je Welt ----------
  for (const [g, m] of [[HANDYS[0], { schema: 'light', modus: 'hell' }], [GROSS[1], { schema: 'dark', modus: 'dunkel' }]]) {
    const { k, s, fehler } = await oeffne(browser, g, { ...m, saat: { bots: Object.fromEntries(BOTS.map((b) => [b.id, SIEG])), brillanteZuege: [] } });
    try {
      const gesehen = new Set();
      for (const w of WELTEN) {
        await zuWelt(s, w.nr);
        const x = await welt(s);
        const tag = `${g.name} ${m.modus} ${w.id}`;
        gesehen.add(x.wappen && x.wappen.src);
        pruefe(`${tag}: Plakette mit eigenem Wappen (gezeichnet, Wappen der Welt)`, x.wappen && x.wappen.geladen && x.wappen.src.includes(w.id) && x.wappen.alt === '', x.wappen);
        pruefe(`${tag}: Name auf der Plakette lesbar (>= 4,5:1, deckender Grund)`, x.hgDeckend && x.kontrast >= 4.5 && x.name.length > 2, { k: x.kontrast, name: x.name });
        pruefe(`${tag}: Plakette mit Gold-Kante`, /rgb/.test(x.goldKante) && !/^none\s+rgba\(0, 0, 0, 0\)$/.test(x.goldKante.trim()), x.goldKante);
        pruefe(`${tag}: genau EIN lebendiges Element, sichtbar, nur transform/opacity`,
          x.leben && x.leben.sichtbar && x.leben.anims === 1 && x.leben.props.length > 0 && x.leben.props.every((p) => p === 'transform' || p === 'opacity'), x.leben);
      }
      pruefe(`${g.name} ${m.modus}: fuenf verschiedene Wappen`, gesehen.size === WELTEN.length, [...gesehen]);
      pruefe(`${g.name} ${m.modus}: keine Seiten- und Konsolenfehler`, !fehler.length, fehler);
    } finally { await k.close(); }
  }

  // ---------- weniger Bewegung: Standbild ----------
  {
    const { k, s, fehler } = await oeffne(browser, HANDYS[0], { ruhe: true });
    try {
      for (const nr of [1, 2]) {
        await zuWelt(s, nr);
        const x = await welt(s);
        pruefe(`iphone13 reduced-motion ${x.id}: keine Animation, Element bleibt als Standbild`, x.leben && x.leben.anims === 0 && x.leben.sichtbar, x.leben);
      }
      pruefe('iphone13 reduced-motion: keine Seiten- und Konsolenfehler', !fehler.length, fehler);
    } finally { await k.close(); }
  }
} finally {
  await browser.close();
  server.close();
}
console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
