// R27 A1 "Buehne" (Plan R27 Analyse und Online, Flo 21.11.2026: "uebersichtlich, clean und elegant", echtes Gold, Zaehlung
// je Zugklasse): links das Brett mit Balken und Navigation darunter, im Querformat klebend; rechts eine Spalte ohne eigenes
// Rollen mit Ergebnis, Schluesselmomenten, Coach, Verlauf und Zugklassen. Geprueft wird, was der Aufbau verspricht:
//   kein Rollen in der rechten Spalte, das Brett bleibt beim Rollen stehen, Momente im ersten Bild (vier Groessen),
//   Coach waechst mit dem Text, Balken-Zahl lesbar und waagerecht, Zugklassen immer offen mit Du und Gegner (Nullen leise),
//   Tippflaechen 44 px auf dem iPhone, Startkarte ohne Ergebniswort mit "Zum Moment", Momente gleich hoch und nie allein
//   in der letzten Reihe, Verlauf als glatte Linie ohne Abschneiden, Gold aus den Metall-Tokens statt --gold.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { browserTyp } from './browser.mjs';

const require = createRequire(import.meta.url);
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || await (await import('./freier-port.mjs')).freierPort();
const BASIS = `http://127.0.0.1:${PORT}/tests/screens.html`;
// --bilder=<ordner>: iPhone 13 je Bereich und PC, dunkel
const BILDER = (process.argv.find((x) => x.startsWith('--bilder=')) || '').slice(9);

function ladePlaywright() {
  for (const k of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
    try { return require(k); } catch (e) { /* naechster */ }
  }
  throw new Error('Playwright nicht gefunden (PLAYWRIGHT_PFAD setzen)');
}
async function warteAufServer(url, ms = 10000) {
  const ende = Date.now() + ms;
  while (Date.now() < ende) {
    try { const r = await fetch(url); await r.arrayBuffer(); if (r.ok) return; } catch (e) { /* noch nicht da */ }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error('Server startet nicht: ' + url);
}

const ergebnisse = [];
let gruppe = '';
function pruefe(name, ok, detail = '') {
  ergebnisse.push({ name: (gruppe ? gruppe + ': ' : '') + name, ok: !!ok, detail });
  console.log(`${ok ? 'ok  ' : 'FEHLER'} ${gruppe ? gruppe + ': ' : ''}${name}${!ok && detail ? ' (' + detail + ')' : ''}`);
}
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

let SPEICHER;
async function neueSeite(browser, { breite = 1280, hoehe = 800, touch = false, schema = 'dark', speicher = SPEICHER } = {}) {
  const kontext = await browser.newContext({ viewport: { width: breite, height: hoehe }, hasTouch: touch, isMobile: false, colorScheme: schema,
    deviceScaleFactor: 1, ...(speicher ? { storageState: speicher } : {}) });
  await kontext.route('https://challenges.cloudflare.com/**', (route) => route.fulfill({ status: 200, contentType: 'text/javascript',
    body: 'window.turnstile = { render() { return "w1"; }, reset() {}, remove() {} };' }));
  const seite = await kontext.newPage();
  const fehler = [];
  seite.on('pageerror', (e) => fehler.push('pageerror: ' + e.message));
  seite.on('console', (m) => { if (m.type() === 'error') fehler.push('console: ' + m.text()); });
  return { kontext, seite, fehler };
}
async function oeffne(seite, query = 'screen=keiner') {
  await seite.goto(`${BASIS}?${query}`);
  await seite.waitForFunction(() => window.testseiteBereit === true);
  await seite.evaluate(() => { document.documentElement.dataset.modus = 'system'; });
  await seite.waitForTimeout(600);
}
async function oeffneAnalyse(seite, d) {
  await oeffne(seite, `screen=analyse&partieId=${d.oper}`);
  await seite.waitForSelector('.an-inhalt .an-coach', { state: 'attached', timeout: 30000 });
  await warte(400);
}
const aktuellerPly = (seite) => seite.evaluate(() => Number(document.querySelector('.an-kurve').getAttribute('aria-valuenow')) - 1);

async function testeDaten(browser) {
  gruppe = 'Testdaten';
  const { kontext, seite, fehler } = await neueSeite(browser, { speicher: null });
  await oeffne(seite);
  const d = await seite.evaluate(async () => {
    testseite.leere();
    testseite.app.setzeEinstellungen({ tiefe: 12 });
    const oper = await testseite.opernpartie({ mitReview: true, tiefe: 12 });
    const r = testseite.speicher.ladeReview(oper.id);
    return { oper: oper.id, momente: r.schluesselmomente || [], anzahl: r.anzahl };
  });
  pruefe('Opernpartie mit Review und Schluesselmomenten', d.oper && d.momente.length >= 2, JSON.stringify(d.momente));
  SPEICHER = await kontext.storageState();
  pruefe('Keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
  await kontext.close();
  return d;
}

// rechte Spalte ohne eigenes Rollen, das Brett klebt beim Rollen der Seite
async function testeBuehne(browser, d) {
  for (const [name, breite, hoehe] of [['PC 1280x800', 1280, 800], ['PC 1920x1080', 1920, 1080]]) {
    gruppe = name;
    const { kontext, seite, fehler } = await neueSeite(browser, { breite, hoehe });
    await oeffneAnalyse(seite, d);
    const r = await seite.evaluate(() => {
      const re = document.querySelector('.an-rechts');
      const cs = getComputedStyle(re);
      return { ueber: re.scrollHeight - re.clientHeight, oy: cs.overflowY };
    });
    pruefe('Rechte Spalte ohne eigenes Rollen', r.oy === 'visible' || r.ueber <= 1, JSON.stringify(r));
    const vor = await seite.evaluate(() => document.querySelector('.an-brett').getBoundingClientRect().top);
    const gerollt = await seite.evaluate(() => {
      const sc = document.querySelector('.an-screen');
      sc.scrollTop = 400; return sc.scrollTop;
    });
    await warte(300);
    const nach = await seite.evaluate(() => {
      const b = document.querySelector('.an-brett').getBoundingClientRect();
      return { top: b.top, bottom: b.bottom, h: innerHeight };
    });
    // die Kopfzeile rollt weg, das Brett klebt dann oben (top 12 px + Rahmen) und rollt auch bei mehr Weg nicht weiter
    await seite.evaluate(() => { const sc = document.querySelector('.an-screen'); sc.scrollTop = sc.scrollHeight; });
    await warte(300);
    const ganz = await seite.evaluate(() => document.querySelector('.an-brett').getBoundingClientRect().top);
    pruefe('Seite rollt (rechts steht mehr als ein Bild)', gerollt > 0, String(gerollt));
    pruefe('Brett klebt oben und bleibt ganz sichtbar', nach.top >= 0 && nach.top <= Math.min(vor, 40) && nach.bottom <= nach.h + 1
      && Math.abs(ganz - nach.top) <= 1, JSON.stringify({ vor, nach, ganz }));
    // Momente gleich hoch, in der letzten Reihe nie eine Karte allein
    const m = await seite.evaluate(() => [...document.querySelectorAll('.an-moment')].map((k) => { const b = k.getBoundingClientRect(); return { t: Math.round(b.top), h: Math.round(b.height) }; }));
    const reihen = new Map(); for (const k of m) reihen.set(k.t, (reihen.get(k.t) || 0) + 1);
    const letzte = [...reihen.entries()].sort((a, b) => a[0] - b[0]).at(-1)?.[1] || 0;
    pruefe('Momente gleich hoch', m.length >= 2 && Math.max(...m.map((k) => k.h)) - Math.min(...m.map((k) => k.h)) <= 1, JSON.stringify(m));
    pruefe('Keine Moment-Karte allein in der letzten Reihe', m.length < 2 || letzte >= 2, JSON.stringify([...reihen]));
    pruefe('Keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }
}

// Momente im ersten Bild, Tippflaechen auf dem iPhone, Balkenzahl, Coach, Startkarte
async function testeGroessen(browser, d) {
  for (const [name, breite, hoehe, touch] of [['iPhone', 390, 844, true], ['iPad hoch', 820, 1180, true], ['iPad quer', 1180, 820, true], ['PC', 1280, 800, false]]) {
    gruppe = name;
    const { kontext, seite } = await neueSeite(browser, { breite, hoehe, touch });
    await oeffneAnalyse(seite, d);
    // die Karte oder (iPad hoch, kurze Hochformate) die kompakte Momente-Zeile ueber dem Brett
    const top = await seite.evaluate(() => Math.min(...[...document.querySelectorAll('.an-moment, .an-mz')]
      .filter((e) => e.getClientRects().length).map((e) => e.getBoundingClientRect().top)));
    pruefe('Schluesselmomente im ersten Bild', top < hoehe - 40, String(Math.round(top)));
    if (name === 'iPhone') {
      // die Zugklassen-Kacheln sind auf dem Handy 32 px hoch (Raster, cf/Flo 21.11.), WCAG 2.5.8 verlangt 24 px; sie stehen im
      // Bereich "Zuege" und sind am Start ausgeblendet, darum misst diese Zeile nur die sichtbaren Ziele
      const klein = await seite.evaluate(() => [...document.querySelectorAll('.an-navi .knopf, .an-reiter .knopf, .an-moment, .an-coach .knopf, .an-aktionsleiste .knopf')]
        .filter((e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden')
        .map((e) => ({ c: e.className.split(' ').slice(0, 2).join('.'), h: Math.round(e.getBoundingClientRect().height), w: Math.round(e.getBoundingClientRect().width) }))
        .filter((x) => x.h < 44 || x.w < 44));
      pruefe('Tippflaechen mindestens 44 px', klein.length === 0, JSON.stringify(klein));
    }
    await kontext.close();
  }
  gruppe = 'Details';
  const { kontext, seite, fehler } = await neueSeite(browser, { breite: 1280, hoehe: 800 });
  await oeffneAnalyse(seite, d);
  // Startkarte: kein Ergebniswort (das steht im Ergebnis-Kopf), "Zum Moment" springt hin
  const start = await seite.evaluate(() => {
    const c = document.querySelector('.an-coach');
    const k = c.querySelector('[data-aktion="moment"]');
    return { text: c.innerText, ziel: k ? Number(k.dataset.ply) : null };
  });
  pruefe('Startkarte ohne Ergebniswort', !/\b(Sieg|Niederlage|Remis)\b/.test(start.text), start.text);
  pruefe('Startkarte nennt den entscheidenden Moment', start.ziel !== null && /Entscheidend war/.test(start.text), JSON.stringify(start));
  await seite.click('.an-coach [data-aktion="moment"]');
  await warte(500);
  pruefe('"Zum Moment" springt zum Moment', (await aktuellerPly(seite)) === start.ziel, `${await aktuellerPly(seite)} vs ${start.ziel}`);
  // Coach waechst mit dem Text und rollt nicht in sich
  const coach = await seite.evaluate(() => { const c = document.querySelector('.an-coach'); const cs = getComputedStyle(c); return { ueber: c.scrollHeight - c.clientHeight, oy: cs.overflowY }; });
  pruefe('Coach waechst mit dem Text (kein Rollen in der Karte)', coach.ueber <= 1 && !/auto|scroll/.test(coach.oy), JSON.stringify(coach));
  // Balken-Zahl lesbar und waagerecht
  const zahl = await seite.evaluate(() => {
    const e = document.querySelector('.an-eb-wert'); const cs = getComputedStyle(e);
    return { t: e.textContent, px: parseFloat(cs.fontSize), tr: cs.transform, wm: cs.writingMode };
  });
  pruefe('Balken-Zahl mindestens 11 px und waagerecht', zahl.t && zahl.px >= 11 && (zahl.tr === 'none' || /^matrix\(1, 0, 0, 1/.test(zahl.tr)) && zahl.wm === 'horizontal-tb', JSON.stringify(zahl));
  const balken = await seite.evaluate(() => Math.round(document.querySelector('.an-evalbalken').getBoundingClientRect().height));
  pruefe('Balken 8 bis 10 px hoch', balken >= 8 && balken <= 10, String(balken));
  // Zugklassen: immer offen, elf Zeilen, Du und Gegner wie im Review, Nullen leise
  const kl = await seite.evaluate(() => [...document.querySelectorAll('.an-kl[data-klasse]')].map((z) => ({
    k: z.dataset.klasse, n: [...z.querySelectorAll('.an-n')].map((x) => Number(x.textContent)), null: z.classList.contains('null'),
    deck: Number(getComputedStyle(z.querySelector('.an-kl-mitte')).opacity), sicht: z.getClientRects().length > 0 })));
  pruefe('Zugklassen immer offen, elf Zeilen', kl.length === 11 && kl.every((z) => z.sicht) && (await seite.locator('.an-klassen details').count()) === 0, String(kl.length));
  const falsch = kl.filter((z) => z.n[0] !== (d.anzahl.w?.[z.k] || 0) || z.n[1] !== (d.anzahl.b?.[z.k] || 0));
  pruefe('Zahlen fuer Du und Gegner wie im Review', !falsch.length, JSON.stringify(falsch));
  pruefe('Nullzeilen da, aber leise', kl.some((z) => z.null) && kl.filter((z) => z.null).every((z) => z.deck < 1), JSON.stringify(kl.filter((z) => z.null)));
  // Verlauf: glatte Linie, Punkte nicht abgeschnitten
  const kurve = await seite.evaluate(() => {
    const d = document.querySelector('.an-k-linie').getAttribute('d');
    const w = document.querySelector('.an-kurve-wrap').getBoundingClientRect();
    const box = document.querySelector('.an-kurve-box').getBoundingClientRect();
    const raus = [...document.querySelectorAll('.an-k-punkte i')].map((i) => i.getBoundingClientRect())
      .filter((r) => r.top < box.top || r.bottom > box.bottom || r.left < box.left - 1 || r.right > box.right + 1).length;
    return { glatt: /C/.test(d) && !/L/.test(d), raus, innen: w.bottom <= box.bottom };
  });
  pruefe('Verlauf als glatte Linie, nichts abgeschnitten', kurve.glatt && kurve.raus === 0 && kurve.innen, JSON.stringify(kurve));
  // Gold sparsam (Flo 21.11.: "Kack-Gold"): kein altes --gold, Avatarringe neutral, Goldrichtig als Champagner statt Gelb
  const gold = await seite.evaluate(() => {
    const ring = getComputedStyle(document.querySelector('.an-genau .an-avatar')).boxShadow;
    const alt = getComputedStyle(document.documentElement).getPropertyValue('--gold').trim();
    const altRgb = (() => { const x = document.createElement('i'); x.style.color = alt; document.body.append(x); const c = getComputedStyle(x).color; x.remove(); return c; })();
    const treffer = [...document.querySelectorAll('.an-screen *')].filter((e) => { const cs = getComputedStyle(e);
      return [cs.color, cs.backgroundColor, cs.borderTopColor, cs.boxShadow, cs.backgroundImage].some((v) => v.includes(altRgb)); }).length;
    const gr = document.querySelector('.an-moment[data-klasse="stark"] .an-m-klasse, .an-kl[data-klasse="stark"] .an-n.du');
    return { ring, altRgb, treffer, goldrichtig: gr ? getComputedStyle(gr).color : '' };
  });
  pruefe('Avatarringe neutral (kein Gold)', !gold.ring.includes('rgb(201, 161, 74)'), gold.ring);
  pruefe('Goldrichtig als Champagner (dunkel #E8D9B0), nicht Gelb', gold.goldrichtig === 'rgb(232, 217, 176)', gold.goldrichtig);
  pruefe('Kein altes --gold in der Analyse', gold.treffer === 0, JSON.stringify(gold));
  pruefe('Keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
  await kontext.close();
}

// Hochformat: Brett oben, Ergebniszeile, Umschalter mit genau einem sichtbaren Bereich, kein Seiten-Scrollen
async function testeHandy(browser, d) {
  gruppe = 'iPhone 13';
  const { kontext, seite, fehler } = await neueSeite(browser, { breite: 390, hoehe: 844, touch: true });
  await oeffneAnalyse(seite, d);
  const sicht = () => seite.evaluate(() => ['.an-momente-box', '.an-coach', '.an-klassen', '.an-kurve-box']
    .filter((s) => { const e = document.querySelector(s); return e && e.getClientRects().length > 0; }));
  const passt = () => seite.evaluate(() => { const sc = document.querySelector('.an-screen'); return sc.scrollHeight - sc.clientHeight; });
  pruefe('Umschalter mit vier Bereichen', (await seite.locator('.an-reiter [role="tab"]').count()) === 4);
  pruefe('Start: nur die Momente', JSON.stringify(await sicht()) === '[".an-momente-box"]', JSON.stringify(await sicht()));
  pruefe('Ohne Seiten-Scrollen (Momente)', (await passt()) <= 1, String(await passt()));
  const reihe = await seite.evaluate(() => ['.an-brett', '.an-genau', '.an-reiter', '.an-momente-box', '.an-navi'].map((s) => Math.round(document.querySelector(s).getBoundingClientRect().top)));
  pruefe('Reihenfolge Brett, Ergebnis, Umschalter, Bereich, Navigation', reihe.every((v, i) => !i || v > reihe[i - 1]), JSON.stringify(reihe));
  const zeile = await seite.evaluate(() => Math.round(document.querySelector('.an-genau').getBoundingClientRect().height));
  pruefe('Ergebniszeile einzeilig (hoechstens 60 px)', zeile <= 60, String(zeile));
  for (const [r, sel] of [['coach', '.an-coach'], ['zuege', '.an-klassen'], ['verlauf', '.an-kurve-box'], ['momente', '.an-momente-box']]) {
    await seite.click(`.an-reiter [data-reiter="${r}"]`);
    await warte(200);
    const v = await sicht();
    pruefe(`Bereich ${r}: nur er sichtbar, Umschalter markiert`, JSON.stringify(v) === JSON.stringify([sel])
      && (await seite.getAttribute(`.an-reiter [data-reiter="${r}"]`, 'aria-selected')) === 'true', JSON.stringify(v));
    pruefe(`Bereich ${r}: ohne Seiten-Scrollen`, (await passt()) <= 1, String(await passt()));
    const innen = await seite.evaluate((s) => { const e = document.querySelector(s); return e.scrollHeight - e.clientHeight; }, sel);
    pruefe(`Bereich ${r}: Inhalt ganz sichtbar (kein Rollen im Bereich)`, innen <= 1, String(innen));
    if (r === 'zuege') {
      const h = await seite.evaluate(() => [...document.querySelectorAll('.an-kl')].map((k) => Math.round(k.getBoundingClientRect().height)));
      pruefe('Zugklassen-Kacheln mindestens 24 px (WCAG 2.5.8)', h.length === 12 && h.every((x) => x >= 24), JSON.stringify(h));
    }
    if (BILDER) await seite.screenshot({ path: path.join(BILDER, `iphone-${r}-dunkel.png`) });
  }
  await seite.locator('.an-moment').first().tap();
  await warte(400);
  pruefe('Moment antippen fuehrt zum Coach', (await seite.getAttribute('.an-reiter [data-reiter="coach"]', 'aria-selected')) === 'true'
    && JSON.stringify(await sicht()) === '[".an-coach"]', JSON.stringify(await sicht()));
  pruefe('Keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
  await kontext.close();
  if (BILDER) {
    const pc = await neueSeite(browser, { breite: 1440, hoehe: 900 });
    await oeffneAnalyse(pc.seite, d);
    await pc.seite.screenshot({ path: path.join(BILDER, 'pc-dunkel.png') });
    await pc.kontext.close();
  }
}

const server = spawn(process.execPath, ['tests/testserver.mjs', String(PORT), '--bind', '127.0.0.1'], { cwd: WURZEL, stdio: 'ignore' });
let browser;
let code = 1;
const t0 = Date.now();
try {
  await warteAufServer(BASIS);
  browser = await browserTyp(ladePlaywright()).launch();
  const d = await testeDaten(browser);
  await testeBuehne(browser, d);
  await testeGroessen(browser, d);
  await testeHandy(browser, d);
  const fehlend = ergebnisse.filter((r) => !r.ok);
  console.log(`\n${ergebnisse.length - fehlend.length}/${ergebnisse.length} bestanden in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  for (const f of fehlend) console.log('FEHLER: ' + f.name + (f.detail ? ' (' + f.detail + ')' : ''));
  code = fehlend.length ? 1 : 0;
} catch (e) {
  console.error(e);
  code = 1;
} finally {
  if (browser) await browser.close();
  server.kill();
}
process.exit(code);
