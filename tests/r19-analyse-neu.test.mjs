// Feinschliff R19, Paket 1c "Analyse neu" (Flo 15.11.2026: "richtig haesslich", Leitlinie R19-Design-Leitlinie.md):
// Schluesselmomente als grosse Karten oben (Zug, Fehlerart, besserer Zug), Zugklassen-Symbole gross und deckend farbig,
// Verlauf ohne Kleintext mit grossen Fehlerpunkten, Ergebnis-Karte mit Gold-Kante, "Variante zeigen" langsamer mit
// waehlbarem Tempo, Auto-Abspielen der Partie (Play/Pause neben den Pfeilen, Halt an jedem Schluesselmoment).
// Browser-Test (Playwright, Chromium) gegen tests/screens.html mit der Opernpartie aus tests/screens.html.
//
//   node tests/r19-analyse-neu.test.mjs
//   node tests/r19-analyse-neu.test.mjs --bilder=<ordner> --name=vorher   Bilder iPhone 13, SE, iPad, PC, hell und dunkel
//   node tests/r19-analyse-neu.test.mjs --speicher=<datei.js>             dazu Vorlauf fuer design-beweis (<datei.js>.id = partieId)
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { browserTyp } from './browser.mjs';

const require = createRequire(import.meta.url);
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || await (await import('./freier-port.mjs')).freierPort();
const BASIS = `http://127.0.0.1:${PORT}/tests/screens.html`;
const arg = (n) => { const a = process.argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : ''; };
const BILDER = arg('bilder');
const NAME = arg('name') || 'nachher';
if (BILDER) mkdirSync(BILDER, { recursive: true });
// Fix-Review 16.11.: Bilder der kurzen Hochformate (Momente-Zeile) aus testeMomente
const BILDER_FIX = arg('fixbilder');
if (BILDER_FIX) mkdirSync(BILDER_FIX, { recursive: true });
const TEMPO_MERKER = 'schach-arena:v1:analyse-tempo';

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
async function neueSeite(browser, { breite = 1280, hoehe = 720, touch = false, bewegung = 'no-preference', schema = 'light', speicher = SPEICHER } = {}) {
  const kontext = await browser.newContext({
    viewport: { width: breite, height: hoehe }, hasTouch: touch, isMobile: false, reducedMotion: bewegung, colorScheme: schema,
    deviceScaleFactor: 1, ...(speicher ? { storageState: speicher } : {}),
  });
  // Bot-Schutz wie in tests/screens.test.mjs: kein echtes Turnstile
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
  // die Testseite setzt kein data-modus (js/thema.js laeuft dort nicht); "system" laesst colorScheme des Kontexts
  // entscheiden wie in der App, sonst bliebe "dunkel" hell (css/themes/modern.css:213)
  await seite.evaluate(() => { document.documentElement.dataset.modus = 'system'; });
  // der Wechsel faerbt Knoepfe mit Uebergang um (.knopf: transition ... var(--d-s) = 200 ms, --d-m 320 ms); in der App steht
  // der Modus vor dem ersten Bild, hier erst danach: warten, sonst misst ein Kontrast mitten im Uebergang (1.48:1 gemessen)
  await seite.waitForTimeout(600);
}
async function oeffneAnalyse(seite, d, extra = '') {
  await oeffne(seite, `screen=analyse&partieId=${d.oper}${extra}`);
  await seite.waitForSelector('.an-inhalt .an-coach', { timeout: 30000 });
  await warte(400);
}
const aktuellerPly = (seite) => seite.evaluate(() => Number(document.querySelector('.an-kurve').getAttribute('aria-valuenow')) - 1);
// an den Anfang (der Knopf ist in der Startstellung gesperrt, dann steht die Analyse schon dort)
async function zumAnfang(seite) {
  const k = seite.locator('.an-navi [data-aktion="anfang"]');
  if (await k.isEnabled()) await k.click();
}

// ---------------------------------------------------------------------------
async function testeDaten(browser) {
  gruppe = 'Testdaten';
  const { kontext, seite, fehler } = await neueSeite(browser, { speicher: null });
  await oeffne(seite);
  const d = await seite.evaluate(async () => {
    testseite.leere();
    testseite.app.setzeEinstellungen({ tiefe: 12 });
    const oper = await testseite.opernpartie({ mitReview: true, tiefe: 12 });
    const r = testseite.speicher.ladeReview(oper.id);
    return { oper: oper.id, momente: r.schluesselmomente || [], zuege: r.zuege.length };
  });
  pruefe('Opernpartie mit Review und Schluesselmomenten', d.oper && d.momente.length >= 2, JSON.stringify(d));
  SPEICHER = await kontext.storageState();
  // --speicher=<datei>: Vorlauf fuer die design-beweis-Probe (Analyse ohne Engine im Probe-Browser), dazu die partieId
  if (arg('speicher')) {
    const eintraege = SPEICHER.origins.flatMap((o) => o.localStorage);
    writeFileSync(arg('speicher'), `// erzeugt von tests/r19-analyse-neu.test.mjs --speicher (partieId ${d.oper})\n`
      + `for (const [k, v] of ${JSON.stringify(eintraege.map((e) => [e.name, e.value]))}) localStorage.setItem(k, v);\n`
      + `document.addEventListener('DOMContentLoaded', () => { document.documentElement.dataset.modus = 'system'; });\n`);
    writeFileSync(arg('speicher') + '.id', d.oper);
  }
  pruefe('Keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
  await kontext.close();
  return d;
}

// (1) Schluesselmomente als grosse Karten, oben ohne Scrollen
async function testeMomente(browser, d) {
  for (const [name, breite, hoehe] of [['PC 1280', 1280, 720], ['PC 1920', 1920, 1080], ['iPad quer', 1180, 820]]) {
    gruppe = `Momente ${name}`;
    const { kontext, seite, fehler } = await neueSeite(browser, { breite, hoehe, touch: breite < 1200 });
    await oeffneAnalyse(seite, d);
    const m = await seite.evaluate(() => {
      const karten = [...document.querySelectorAll('.an-moment')];
      const k0 = karten[0];
      const r = k0 ? k0.getBoundingClientRect() : null;
      const kurve = document.querySelector('.an-kurve-box').getBoundingClientRect();
      const rechts = document.querySelector('.an-rechts');
      return {
        n: karten.length,
        klasse: karten.every((k) => !!k.querySelector('.an-m-klasse')?.textContent.trim()),
        zug: karten.every((k) => /\d+(\.|…)\s*\S+/.test(k.querySelector('.an-m-zug')?.textContent || '')),
        besser: karten.filter((k) => /Besser/.test(k.querySelector('.an-m-besser')?.textContent || '')).length,
        hoehe: r ? Math.round(r.height) : 0, breite: r ? Math.round(r.width) : 0,
        imBild: !!r && r.top >= 0 && r.bottom <= innerHeight + 0.5 && r.right <= innerWidth + 0.5,
        vorKurve: !!r && r.top < kurve.top,
        scroll: (rechts ? rechts.scrollTop : 0) + document.querySelector('.an-screen').scrollTop,
      };
    });
    pruefe('Jede Karte nennt Fehlerart und Zug', m.n >= 2 && m.klasse && m.zug, JSON.stringify(m));
    pruefe('Mindestens eine Karte nennt den besseren Zug', m.besser >= 1, JSON.stringify(m));
    pruefe('Grosse Karte (mindestens 64 px hoch, 150 px breit)', m.hoehe >= 64 && m.breite >= 150, JSON.stringify(m));
    pruefe('Erste Karte ohne Scrollen im Fenster', m.scroll === 0 && m.imBild, JSON.stringify(m));
    pruefe('Momente stehen vor dem Verlauf', m.vorKurve, JSON.stringify(m));
    pruefe('Keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }
  // Fix-Review 16.11.: kurze Hochformate in Safari mit Leisten (SE 548, Android 640, iPhone 13 664, Entscheid Hauptfenster:
  // dort gewollt mit Zeile) auch dann, wenn passeBrett() brett-zuerst setzt (Brett und Navigation springen auf order 0)
  for (const [name, breite, hoehe] of [['iPhone 13', 390, 844], ['iPhone SE', 375, 667], ['SE Safari', 375, 548], ['Android', 360, 640],
    ['iPhone 13 Safari', 390, 664]]) {
    const kurz = hoehe <= 700;
    gruppe = `Momente ${name}`;
    const { kontext, seite, fehler } = await neueSeite(browser, { breite, hoehe, touch: true });
    await oeffneAnalyse(seite, d);
    const m = await seite.evaluate(() => {
      const top = (s) => document.querySelector(s).getBoundingClientRect().top;
      return { navi: top('.an-navi'), momente: top('.an-momente-box'), coach: top('.an-coach'), kurve: top('.an-kurve-box'),
        ueber: document.documentElement.scrollWidth - innerWidth };
    });
    pruefe('Momente direkt unter der Navigation, vor Coach und Verlauf', m.momente > m.navi && m.momente < m.coach && m.momente < m.kurve, JSON.stringify(m));
    pruefe('Kein waagrechter Ueberlauf der Seite', m.ueber <= 0, JSON.stringify(m));
    // Kaltreview b4 16.11. (Befund 1, Entscheidung A): ohne Scrollen sind die Momente (SE: kompakte Zeile ueber dem Brett,
    // iPhone 13: die erste Karte) UND das ganze Brett im Bild
    const o = await seite.evaluate(() => {
      const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), left: Math.round(b.left), right: Math.round(b.right), h: Math.round(b.height) }; };
      const zeile = document.querySelector('.an-momente-zeile');
      const sichtbar = !!zeile && getComputedStyle(zeile).display !== 'none';
      const ganz = (b) => !!b && b.h > 0 && b.top >= 0 && b.bottom <= innerHeight + 0.5 && b.left >= -0.5 && b.right <= innerWidth + 0.5;
      const eintraege = sichtbar ? [...zeile.querySelectorAll('.an-mz')].map((e) => Math.round(e.getBoundingClientRect().height)) : [];
      const momente = sichtbar ? r(zeile) : r(document.querySelector('.an-moment'));
      const brett = r(document.querySelector('.an-brett-rahmen'));
      // Bedienwege: die Zeile ist fuer Vorleser verborgen und nicht in der Tab-Reihenfolge, die Karten bleiben der Weg
      const tabbar = (e) => e.tabIndex >= 0 && !e.closest('[aria-hidden="true"]');
      const wege = { zeileVerborgen: !!zeile && zeile.getAttribute('aria-hidden') === 'true',
        zeileTabs: zeile ? [...zeile.querySelectorAll('[data-aktion="moment"]')].filter(tabbar).length : 0,
        karten: document.querySelectorAll('.an-moment').length,
        kartenTabs: [...document.querySelectorAll('.an-momente [data-aktion="moment"]')].filter(tabbar).length };
      return { zeile: sichtbar, momente, brett, eintraege, momenteGanz: ganz(momente), brettGanz: ganz(brett), wege,
        brettZuerst: document.querySelector('.an-screen').classList.contains('brett-zuerst'),
        scroll: document.querySelector('.an-screen').scrollTop + scrollY, hoehe: innerHeight };
    });
    pruefe('Ohne Scrollen: Momente ganz im Bild', o.scroll === 0 && o.momenteGanz, JSON.stringify(o));
    pruefe('Ohne Scrollen: Brett ganz im Bild', o.scroll === 0 && o.brettGanz, JSON.stringify(o));
    pruefe(kurz ? `${name}: kompakte Zeile ueber dem Brett, Eintraege mindestens 44 px` : `${name}: grosse Karten, keine Zeile`,
      kurz ? o.zeile && o.eintraege.length >= 2 && o.eintraege.every((x) => x >= 44) && o.momente.bottom <= o.brett.top : !o.zeile,
      JSON.stringify(o));
    pruefe('Momente nur einmal fuer Vorleser und Tastatur (Zeile verborgen, Karten tabbar)',
      o.wege.zeileVerborgen && o.wege.zeileTabs === 0 && o.wege.karten >= 2 && o.wege.kartenTabs === o.wege.karten, JSON.stringify(o.wege));
    if (BILDER_FIX && kurz) await seite.screenshot({ path: path.join(BILDER_FIX, `fix-${name.replace(/\s+/g, '-').toLowerCase()}-${breite}x${hoehe}.png`) });
    if (o.zeile) {
      const ziel = await seite.locator('.an-momente-zeile .an-mz').nth(1);
      const ply = Number(await ziel.getAttribute('data-ply'));
      await ziel.click();
      await warte(500);
      const an = await seite.evaluate(() => [...document.querySelectorAll('.an-momente-zeile .an-mz.an')].map((e) => Number(e.dataset.ply)));
      pruefe('SE: Antippen in der Zeile springt zum Moment', an.length === 1 && an[0] === ply, `${ply} ${JSON.stringify(an)}`);
    }
    pruefe('Keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }
}

// (2) Symbole gross und deckend in der Klassenfarbe, (3) Verlauf ohne Kleintext, (4) Ergebnis-Karte mit Gold-Kante
async function testeAussehen(browser, d) {
  for (const schema of ['light', 'dark']) {
    gruppe = `Aussehen ${schema === 'dark' ? 'dunkel' : 'hell'}`;
    const { kontext, seite, fehler } = await neueSeite(browser, { breite: 1440, hoehe: 900, schema });
    await oeffneAnalyse(seite, d);
    const grund = await seite.evaluate(() => getComputedStyle(document.body).backgroundColor);
    const grundHell = (grund.match(/\d+/g) || []).slice(0, 3).reduce((a, b) => a + Number(b), 0) > 3 * 128;
    pruefe(`Modus ${schema === 'dark' ? 'dunkel' : 'hell'} greift (Seitengrund)`, grundHell === (schema !== 'dark'), grund);
    const s = await seite.evaluate(() => {
      const farbe = (wert) => { const i = document.createElement('i'); i.style.color = wert; document.body.append(i); const c = getComputedStyle(i).color; i.remove(); return c; };
      const zeilen = [...document.querySelectorAll('.an-kl:not(.null)[data-klasse]')].map((z) => {
        const svg = z.querySelector('.an-kl-mitte svg');
        const rect = svg.querySelector('rect');
        const k = z.dataset.klasse;
        return { k, gross: Math.round(svg.getBoundingClientRect().width), grund: getComputedStyle(rect).fill, soll: farbe(`var(--k-${k})`),
          deckkraft: getComputedStyle(svg).opacity };
      });
      const karten = [...document.querySelectorAll('.an-moment svg')].map((x) => Math.round(x.getBoundingClientRect().width));
      const kurve = document.querySelector('.an-kurve-box');
      const punkte = [...document.querySelectorAll('.an-k-punkte i.du')].map((i) => Math.round(i.getBoundingClientRect().width));
      const genau = document.querySelector('.an-genau');
      const gs = getComputedStyle(genau);
      return { zeilen, karten, kurveText: kurve.innerText, tipp: document.querySelectorAll('.an-k-tipp, .an-k-legende').length, punkte,
        kante: gs.borderTopColor, kanteBreite: parseFloat(gs.borderTopWidth), linie: farbe('var(--linie)'),
        avatar: Math.round(document.querySelector('.an-genau .an-avatar').getBoundingClientRect().width) };
    });
    pruefe('Klassen-Symbole mindestens 32 px', s.zeilen.length >= 3 && s.zeilen.every((z) => z.gross >= 32), JSON.stringify(s.zeilen));
    pruefe('Klassen-Symbole deckend in der Klassenfarbe', s.zeilen.every((z) => z.grund === z.soll && z.deckkraft === '1'), JSON.stringify(s.zeilen));
    pruefe('Symbole der Momente mindestens 36 px', s.karten.length >= 2 && s.karten.every((w) => w >= 36), JSON.stringify(s.karten));
    pruefe('Verlauf ohne Kleintext ("antippen", Legende)', s.tipp === 0 && !/antippen|tippen|▲|▼/.test(s.kurveText), s.kurveText);
    pruefe('Eigene Fehler im Verlauf gross markiert (mindestens 14 px)', s.punkte.length >= 1 && s.punkte.every((w) => w >= 14), JSON.stringify(s.punkte));
    pruefe('Ergebnis-Karte mit Gold-Kante', s.kanteBreite >= 1 && s.kante !== s.linie && /rgb/.test(s.kante), JSON.stringify(s));
    pruefe('Ergebnis-Karte mit grossen Bildern (mindestens 56 px)', s.avatar >= 56, String(s.avatar));
    // Kontrast, den design-beweis nicht messen kann: das Zeichen liegt auf der SVG-Kachel, nicht auf dem Kartengrund
    // (die Probe nahm den Kartengrund, "1.00:1" bei weissem Zeichen auf weisser Karte). Kante der Karten und Flaeche
    // von Abspielen gegen den naechsten deckenden Grund darueber (WCAG 1.4.11, 3:1)
    const k = await seite.evaluate(() => {
      const rgb = (c) => (c.match(/[\d.]+/g) || []).map(Number);
      const lum = (c) => { const v = rgb(c).slice(0, 3).map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
      const kontrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return Math.round((x + 0.05) / (y + 0.05) * 100) / 100; };
      const grundVon = (el) => { for (let e = el; e; e = e.parentElement) { const c = getComputedStyle(e).backgroundColor; if ((rgb(c)[3] ?? 1) === 1 && !/rgba\(0, 0, 0, 0\)/.test(c)) return c; } return getComputedStyle(document.body).backgroundColor; };
      const zeichen = [...document.querySelectorAll('.an-momente .an-sym svg, .an-kl-mitte .an-sym svg')].map((svg) => {
        const kachel = getComputedStyle(svg.querySelector('rect, circle, path')).fill;
        return { kachel, zeichen: getComputedStyle(svg).color, k: kontrast(kachel, getComputedStyle(svg).color) };
      });
      const kanten = [...document.querySelectorAll('.an-moment')].map((b) => kontrast(getComputedStyle(b).borderTopColor, grundVon(b.parentElement)));
      const play = document.querySelector('.an-navi .an-abspielen');
      return { zeichen, kanten, play: kontrast(getComputedStyle(play).backgroundColor, grundVon(play.parentElement)),
        playZeichen: kontrast(getComputedStyle(play).backgroundColor, getComputedStyle(play).color) };
    });
    pruefe('Zeichen auf der Kachel mindestens 4,5:1', k.zeichen.length >= 5 && k.zeichen.every((z) => z.k >= 4.5), JSON.stringify(k.zeichen.filter((z) => z.k < 4.5).slice(0, 4)));
    pruefe('Kante der Momente mindestens 3:1', k.kanten.length >= 2 && k.kanten.every((x) => x >= 3), JSON.stringify(k.kanten));
    pruefe('Abspielen: Flaeche mindestens 3:1, Zeichen mindestens 4,5:1', k.play >= 3 && k.playZeichen >= 4.5, JSON.stringify(k));
    if (BILDER) await seite.screenshot({ path: path.join(BILDER, `${NAME}-pc-detail-${schema === 'dark' ? 'dunkel' : 'hell'}.png`) });
    pruefe('Keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }
}

// (5) Variante langsamer mit Tempo, Auto-Abspielen mit Halt an Schluesselmomenten
async function zeitenVon(seite, selektor, n, timeout) {
  return seite.evaluate(({ selektor, n, timeout }) => new Promise((fertig) => {
    const el = document.querySelector(selektor);
    const zeiten = [];
    let alt = el.textContent;
    const beob = new MutationObserver(() => {
      if (el.textContent === alt) return;
      alt = el.textContent;
      zeiten.push(performance.now());
      if (zeiten.length >= n) { beob.disconnect(); fertig(zeiten); }
    });
    beob.observe(el, { childList: true, characterData: true, subtree: true });
    setTimeout(() => { beob.disconnect(); fertig(zeiten); }, timeout);
  }), { selektor, n, timeout });
}

async function testeAbspielen(browser, d) {
  gruppe = 'Tempo und Variante';
  {
    const { kontext, seite, fehler } = await neueSeite(browser);
    await oeffneAnalyse(seite, d);
    const tempo = seite.locator('.an-navi [data-aktion="tempo"]');
    pruefe('Tempo-Knopf in der Navigation', await tempo.count() === 1);
    const t0 = (await tempo.textContent()).trim();
    pruefe('Standard-Tempo "Normal"', /Normal/.test(t0), t0);
    // Variante im Standard-Tempo: Abstand der Schritte mindestens 1400 ms (vorher 1000 ms)
    const ply = await seite.evaluate((id) => testseite.speicher.ladeReview(id).zuege.find((x) => (x.besteLinie || []).length >= 3).ply, d.oper);
    await oeffneAnalyse(seite, d, `&ply=${ply}`);
    // erste Aenderung = Etikett "Variante" beim Start (Vorlauf 0,7 Takt), gemessen werden die Abstaende der Zuege danach
    const messung = zeitenVon(seite, '.an-coach .an-c-eval', 4, 11000);
    await seite.click('.an-coach [data-aktion="variante"]');
    const z = await messung;
    const abstaende = z.slice(2).map((x, i) => Math.round(x - z[i + 1]));
    pruefe('Variante langsamer: Schritte mindestens 1400 ms auseinander', abstaende.length >= 1 && abstaende.every((a) => a >= 1400), JSON.stringify(abstaende));
    // Tempo wechseln: Zuegig, gemerkt
    await seite.click('.an-navi [data-aktion="tempo"]');
    const t1 = (await tempo.textContent()).trim();
    await seite.click('.an-navi [data-aktion="tempo"]');
    const t2 = (await tempo.textContent()).trim();
    const gemerkt = await seite.evaluate((k) => localStorage.getItem(k), TEMPO_MERKER);
    pruefe('Tempo waehlbar (drei Stufen) und gemerkt', new Set([t0, t1, t2]).size === 3 && !!gemerkt, `${t0} | ${t1} | ${t2} | ${gemerkt}`);
    // Kaltreview b4 16.11. (Warnung): Tempo waehrend der Variante umstellen gilt ab dem naechsten Schritt
    // (Kommentar an wechsleTempo). Start auf Zuegig (1000 ms), nach zwei Zuegen auf Ruhig (2400 ms).
    const lang = await seite.evaluate((id) => (testseite.speicher.ladeReview(id).zuege.find((x) => (x.besteLinie || []).length >= 6) || {}).ply, d.oper);
    pruefe('Partie hat eine Variante mit mindestens 6 Zuegen', Number.isInteger(lang), String(lang));
    if (Number.isInteger(lang)) {
      await oeffneAnalyse(seite, d, `&ply=${lang}`);
      const vorher = zeitenVon(seite, '.an-coach .an-c-eval', 3, 6000);
      await seite.click('.an-coach [data-aktion="variante"]');
      await vorher;
      await seite.click('.an-navi [data-aktion="tempo"]');
      await seite.click('.an-navi [data-aktion="tempo"]');
      const stufe = (await tempo.textContent()).trim();
      const danach = await zeitenVon(seite, '.an-coach .an-c-eval', 3, 9000);
      // der schon geplante Schritt laeuft noch im alten Takt, danach gilt Ruhig
      const abst = danach.slice(1).map((x, i) => Math.round(x - danach[i]));
      pruefe('Tempo waehrend der Variante umgestellt: naechste Schritte im neuen Takt', /Ruhig/.test(stufe) && abst.length >= 1 && abst.every((a) => a >= 2000),
        `${stufe} ${JSON.stringify(abst)}`);
    }
    pruefe('Keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }

  gruppe = 'Auto-Abspielen';
  {
    const { kontext, seite, fehler } = await neueSeite(browser);
    await seite.addInitScript((k) => { try { localStorage.setItem(k, 'zuegig'); } catch (e) { /* egal */ } }, TEMPO_MERKER);
    await oeffneAnalyse(seite, d);
    const reihe = await seite.evaluate(() => [...document.querySelectorAll('.an-navi .knopf')].map((k) => k.dataset.aktion));
    const i = reihe.indexOf('abspielen');
    pruefe('Play zwischen den Pfeilen', i > 0 && reihe[i - 1] === 'zurueck-zug' && reihe[i + 1] === 'vor-zug', reihe.join(','));
    const knopf = seite.locator('.an-navi [data-aktion="abspielen"]');
    pruefe('Play-Knopf beschriftet, nicht gedrueckt', (await knopf.getAttribute('aria-pressed')) === 'false' && !!(await knopf.getAttribute('aria-label')));
    await zumAnfang(seite);
    const ersterMoment = d.momente.filter((p) => p >= 0).sort((a, b) => a - b)[0];
    await knopf.click();
    pruefe('Play: Knopf gedrueckt', (await knopf.getAttribute('aria-pressed')) === 'true');
    await seite.waitForFunction(() => document.querySelector('.an-navi [data-aktion="abspielen"]').getAttribute('aria-pressed') === 'false', null,
      { timeout: (ersterMoment + 3) * 1600 }).catch(() => {});
    pruefe('Haelt am ersten Schluesselmoment', (await aktuellerPly(seite)) === ersterMoment, `${await aktuellerPly(seite)} vs ${ersterMoment}`);
    pruefe('Coach zeigt den Moment', (await seite.locator('.an-coach').getAttribute('data-klasse')) !== null);
    await knopf.click();
    await warte(1500);
    const weiter = await aktuellerPly(seite);
    pruefe('Play nach dem Halt: laeuft weiter', weiter > ersterMoment, `${weiter} vs ${ersterMoment}`);
    await seite.click('.an-navi [data-aktion="zurueck-zug"]');
    const nachHand = await aktuellerPly(seite);
    await warte(1500);
    pruefe('Handbedienung stoppt das Abspielen', (await knopf.getAttribute('aria-pressed')) === 'false' && (await aktuellerPly(seite)) === nachHand,
      `${nachHand} -> ${await aktuellerPly(seite)}`);
    // Ruhiges Standard-Tempo: zwei Schritte mindestens 1400 ms auseinander
    await seite.evaluate((k) => localStorage.removeItem(k), TEMPO_MERKER);
    await oeffneAnalyse(seite, d);
    const messung = zeitenVon(seite, '.an-stand', 3, 8000);
    await seite.click('.an-navi [data-aktion="abspielen"]');
    const z = await messung;
    const abst = z.slice(1).map((x, j) => Math.round(x - z[j]));
    pruefe('Standard-Tempo ruhig: mindestens 1400 ms je Zug', abst.length >= 1 && abst.every((a) => a >= 1400), JSON.stringify(abst));
    await seite.keyboard.press('Space');
    await warte(300);
    pruefe('Leertaste haelt an', (await seite.locator('.an-navi [data-aktion="abspielen"]').getAttribute('aria-pressed')) === 'false');
    pruefe('Keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }

  gruppe = 'Weniger Bewegung';
  {
    const { kontext, seite, fehler } = await neueSeite(browser, { bewegung: 'reduce' });
    await seite.addInitScript((k) => { try { localStorage.setItem(k, 'zuegig'); } catch (e) { /* egal */ } }, TEMPO_MERKER);
    await oeffneAnalyse(seite, d);
    await zumAnfang(seite);
    await seite.click('.an-navi [data-aktion="abspielen"]');
    const geht = await seite.evaluate(() => new Promise((fertig) => {
      const el = document.querySelector('.an-stand');
      const beob = new MutationObserver(() => { beob.disconnect(); setTimeout(() => fertig(document.querySelectorAll('.an-brett .geht').length), 40); });
      beob.observe(el, { childList: true, characterData: true, subtree: true });
      setTimeout(() => { beob.disconnect(); fertig(-1); }, 4000);
    }));
    pruefe('Abspielen laeuft, Zuege ohne Animation', geht === 0, String(geht));
    const anim = await seite.evaluate(() => getComputedStyle(document.querySelector('.an-navi [data-aktion="abspielen"]')).animationName);
    pruefe('Play-Knopf ohne Bewegung', anim === 'none', anim);
    pruefe('Keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }
}

// Bilder fuer "Rueckholbar": iPhone 13, SE, iPad, PC, hell und dunkel
async function machBilder(browser, d) {
  gruppe = 'Bilder';
  let n = 0;
  for (const [geraet, breite, hoehe, touch] of [['iphone13', 390, 844, true], ['se', 375, 667, true], ['ipad', 820, 1180, true], ['pc', 1440, 900, false]]) {
    for (const schema of ['light', 'dark']) {
      const { kontext, seite } = await neueSeite(browser, { breite, hoehe, touch, schema });
      await oeffneAnalyse(seite, d);
      await warte(500);
      const s = schema === 'dark' ? 'dunkel' : 'hell';
      await seite.screenshot({ path: path.join(BILDER, `${NAME}-${geraet}-${s}.png`) });
      n++;
      if (hoehe > breite) {
        await seite.evaluate(() => { const sc = document.querySelector('.an-screen'); sc.scrollTop = Math.round(sc.clientHeight * 0.8); });
        await warte(300);
        await seite.screenshot({ path: path.join(BILDER, `${NAME}-${geraet}-${s}-unten.png`) });
        n++;
      }
      await kontext.close();
    }
  }
  pruefe(`Bilder geschrieben (${n})`, n === 14, BILDER);
}

// ---------- Ablauf ----------
const server = spawn(process.execPath, ['tests/testserver.mjs', String(PORT), '--bind', '127.0.0.1'], { cwd: WURZEL, stdio: 'ignore' });
let browser;
let code = 1;
const t0 = Date.now();
try {
  await warteAufServer(BASIS);
  browser = await browserTyp(ladePlaywright()).launch();
  const d = await testeDaten(browser);
  if (BILDER) await machBilder(browser, d);
  await testeMomente(browser, d);
  await testeAussehen(browser, d);
  await testeAbspielen(browser, d);
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
