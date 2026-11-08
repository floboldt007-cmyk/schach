// Tests fuer Paket U2 des Premium-Umbaus (PLAN 2.1, 2.10, 6.3): Reiter-Leiste (Glas-Pille, Lage nach Flo D5,
// Zwischenreiter Verlauf nach D2, Wegfahren), Hauptseiten-Kopf (js/ui/seite.js), Bauteile (js/ui/bauteile.js) und
// die Training-Huelle (js/ui/training.js, Ort training:karten). Node-Teil ohne Browser, danach Browser-Teil
// (Playwright, Chromium) gegen die echte App (index.html?test) und die Testseite tests/bauteile.html.
//
//   node tests/navigation.test.mjs              alles
//   node tests/navigation.test.mjs --nur-node   ohne Browser
//   PORT=8951 node tests/navigation.test.mjs    eigener Port (Standard 8837)
//
// Playwright: Pfad per Umgebungsvariable PLAYWRIGHT_PFAD, sonst 'playwright' oder /opt/node-tools.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { icon, iconNamen } from '../js/ui/icons.js';

const require = createRequire(import.meta.url);
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8837);
// &kern: ohne die fest eingetragenen PAKETE und REITER (die pruefen die Integration und e2e)
const BASIS = `http://127.0.0.1:${PORT}/index.html?test&kern`;
const NUR_NODE = process.argv.includes('--nur-node');
const lies = (d) => readFileSync(path.join(WURZEL, d), 'utf8');
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

const ergebnisse = [];
let gruppe = '';
function pruefe(name, ok, detail = '') {
  ergebnisse.push({ name: (gruppe ? gruppe + ': ' : '') + name, ok: !!ok, detail });
  console.log(`${ok ? 'ok  ' : 'FEHLER'} ${gruppe ? gruppe + ': ' : ''}${name}${!ok && detail ? ' (' + detail + ')' : ''}`);
}

// =====================================================================
// Node-Teil
// =====================================================================
function nodeTeil() {
  gruppe = 'Icons';
  const neu = ['mond', 'sonne', 'laut', 'leise', 'klang', 'regler', 'haken', 'stern', 'bauer'];
  pruefe('neue Icons aus Entwurf A da (mond, sonne, laut, leise, klang, regler, haken, stern, bauer)', neu.every((n) => iconNamen().includes(n)
    && /<path|<circle|<rect/.test(icon(n))), neu.filter((n) => !iconNamen().includes(n)).join());
  const alt = ['zurueck', 'vor', 'einst', 'verlauf', 'hinweis', 'undo', 'drehen', 'flagge', 'schloss', 'offen', 'pokal', 'pfeil', 'nochmal', 'ziel',
    'play', 'blitz', 'analyse', 'auge', 'kreuz', 'pause', 'stern', 'baustelle'];
  pruefe('alle bisherigen Icon-Namen bleiben gueltig', alt.every((n) => iconNamen().includes(n) && /<(path|circle|rect)/.test(icon(n))),
    alt.filter((n) => !iconNamen().includes(n) || !/<(path|circle|rect)/.test(icon(n))).join());
  pruefe('Klang-Icon mit eigenen Klassen fuer Wellen und Kreuz (nicht .welle, die gehoert den Brett-Effekten)',
    /class="klang-welle"/.test(icon('klang')) && /class="klang-strich"/.test(icon('klang')) && !/class="welle"/.test(icon('klang')));
  pruefe('Stern und Bauer gefuellt (die Schriften kennen ★ und ♙ nicht)', /fill="currentColor"/.test(icon('stern')) && /fill="currentColor"/.test(icon('bauer')));

  gruppe = 'Router';
  const app = lies('js/app.js');
  const paketScreens = (app.match(/const PAKET_SCREENS = new Set\(\[([^\]]*)\]\)/) || [])[1] || '';
  pruefe('training ist Kern-Screen (nicht mehr in PAKET_SCREENS), start bleibt Paket-Screen', !/'training'/.test(paketScreens) && /'start'/.test(paketScreens), paketScreens);
  pruefe('Reiter nach Konzept 2026-11-06: Start, Bots, Liga, Ich (Training und Verlauf sind keine Reiter mehr)',
    /const REITER_ALLE = \[\['heim', 'Start', 'haus'\], \['arena', 'Bots', 'pokal'\], \['bestenliste', 'Liga', 'liga'\], \['ich', 'Ich', 'person'\]\]/.test(app));
  pruefe('Seitenleiste im Querformat ab 1021 px', /min-width: 1021px\) and \(orientation: landscape\)/.test(app) && /'seite'/.test(app));
  pruefe('Icon liga (Kronen-Umriss) fuer den Liga-Reiter', iconNamen().includes('liga') && !/fill="currentColor"/.test(icon('liga')));
  pruefe('erweiterungen.js: REITER bestenliste und ich', /export const REITER = Object\.freeze\(\['bestenliste', 'ich'\]\)/.test(lies('js/erweiterungen.js')));
  pruefe('Pille misst ueber einen ResizeObserver', /new ResizeObserver/.test(app));

  gruppe = 'CSS';
  for (const d of ['css/navigation.css', 'css/bauteile.css', 'css/training.css']) {
    const ohneKommentar = lies(d).replace(/\/\*[\s\S]*?\*\//g, '');
    const hex = ohneKommentar.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
    pruefe(`${d}: keine festen Hex-Farben (nur Tokens)`, hex.length === 0, hex.join(' '));
    pruefe(`${d}: kein Neon (keine Leuchtraender, keine Verlaeufe)`, !/neon|glow|linear-gradient|radial-gradient/i.test(ohneKommentar));
  }
  const appCss = lies('css/app.css');
  pruefe('alte Leisten-CSS aus W0+a in css/app.css ersetzt', !/\.reiter-leiste\s*\{/.test(appCss) && !/data-reiter="an"/.test(appCss));
  const nav = lies('css/navigation.css');
  pruefe('Glas nur fuer die Reiter-Pille, mit -webkit- und Ersatz ohne backdrop-filter', /-webkit-backdrop-filter: var\(--glas-filter\)/.test(nav)
    && /@supports not/.test(nav) && (lies('css/bauteile.css') + lies('css/training.css')).indexOf('backdrop-filter') < 0);
  const ersatz = (nav.match(/@supports not \(\(backdrop-filter[^{]*\{([\s\S]*?\}\s*)\}/) || [])[1] || '';
  pruefe('ohne backdrop-filter: Leiste deckend (--flaeche)', /\.reiter-leiste[^{]*\{[^}]*background(-color)?: var\(--flaeche\)/.test(ersatz), ersatz.slice(0, 160));
  pruefe('Titel im Kopf ohne Auslassungszeichen', /\.marke-titel \{[^}]*text-overflow: clip/.test(nav) && /\.marke-titel \{[^}]*white-space: nowrap/.test(nav));
}

// =====================================================================
// Browser-Teil
// =====================================================================
function ladePlaywright() {
  const kandidaten = [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean);
  for (const k of kandidaten) {
    try { return require(k); } catch (e) { /* naechster */ }
  }
  throw new Error('Playwright nicht gefunden (PLAYWRIGHT_PFAD setzen)');
}

async function warteAufServer(url, ms = 10000) {
  const ende = Date.now() + ms;
  while (Date.now() < ende) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch (e) { /* noch nicht da */ }
    await warte(150);
  }
  throw new Error('Server startet nicht: ' + url);
}

const fremd = [];
async function neueSeite(browser, { w = 1180, h = 820, schema = 'light', bewegung = 'no-preference', handy = false } = {}) {
  const kontext = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: schema, reducedMotion: bewegung, deviceScaleFactor: 1,
    hasTouch: true, isMobile: handy });
  const seite = await kontext.newPage();
  const fehler = [];
  seite.on('pageerror', (e) => fehler.push('pageerror: ' + e.message));
  seite.on('console', (m) => {
    if (m.type() !== 'error') return;
    // fehlende Paket-Screens (404) gehoeren zum Test
    if (/404|Failed to fetch dynamically imported module/.test(m.text())) return;
    fehler.push('console: ' + m.text());
  });
  seite.on('request', (r) => { if (!r.url().startsWith(`http://127.0.0.1:${PORT}/`) && !/^(data|blob):/.test(r.url())) fremd.push(r.url()); });
  // Die 404-Ausnahme oben gilt nur fuer fehlende Paket-Screens: eine fehlende Datei unter assets/ (z. B. das Modern-Portraet eines
  // Bots) ist ein Fehler
  seite.on('response', (r) => { if (r.status() === 404 && /\/assets\//.test(r.url())) fehler.push('404: ' + r.url()); });
  return { kontext, seite, fehler };
}

// Lage und Masse der Leiste, des Kopfs und der Pille; Farben fuer Kontrast und Akzent (Etappe A: Glas-Leiste)
const lageMessen = (seite) => seite.evaluate(() => {
  const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; };
  const nav = document.querySelector('.reiter-leiste');
  const aktiv = nav && nav.querySelector('[aria-current="page"]');
  const screen = document.querySelector('#app > .screen');
  const kopf = document.querySelector('#app > .screen .haupt-kopf');
  const st = nav ? getComputedStyle(nav) : null;
  // Akzent: die lesbare Goldfassung des Themes (--kt-stark), aufgeloest ueber ein Probe-Element
  const probe = document.createElement('span');
  probe.style.color = 'var(--kt-stark)';
  document.body.append(probe);
  const akzent = getComputedStyle(probe).color;
  probe.remove();
  return {
    html: document.documentElement.dataset.reiter || null,
    wurzel: document.documentElement.dataset.reiterWurzel || null,
    sichtbar: !!nav && !nav.hidden && getComputedStyle(nav).display !== 'none',
    imKopf: !!nav && !!nav.closest('.haupt-kopf'),
    reiter: nav ? [...nav.querySelectorAll('[data-reiter]')].map((b) => b.dataset.reiter + (b.getAttribute('aria-current') === 'page' ? '*' : '')).join() : '',
    worte: nav ? [...nav.querySelectorAll('.reiter[data-reiter] > span')].map((s) => s.textContent.trim()).join() : '',
    nav: r(nav), aktiv: r(aktiv), pille: r(nav && nav.querySelector('.reiter-pille')), screen: r(screen), kopf: r(kopf),
    aktivAn: !!aktiv && aktiv.classList.contains('an'), aktivFarbe: aktiv ? getComputedStyle(aktiv).color : null, akzent,
    nurEinAn: nav ? nav.querySelectorAll('.reiter.an').length === 1 : false,
    radius: st ? parseFloat(st.borderTopLeftRadius) : 0, filter: st ? (st.backdropFilter || st.webkitBackdropFilter || '') : '',
    kopfUeber: kopf ? kopf.scrollWidth - kopf.clientWidth : null, doc: document.scrollingElement.scrollWidth - innerWidth,
    iw: innerWidth, ih: innerHeight, klasse: nav ? nav.className : '',
    reiterKlein: nav ? [...nav.querySelectorAll('.reiter')].filter((b) => b.getBoundingClientRect().width < 44 || b.getBoundingClientRect().height < 44).length : 0,
  };
});
const nah = (a, b, tol = 1.5) => Math.abs(a - b) <= tol;
// waagrecht (unten) oder senkrecht (Seitenleiste): die Pille liegt genau hinter dem aktiven Reiter
const pilleUnterAktivem = (m) => !!m.pille && !!m.aktiv && (m.html === 'seite'
  ? nah(m.pille.t, m.aktiv.t) && nah(m.pille.h, m.aktiv.h)
  : nah(m.pille.l, m.aktiv.l) && nah(m.pille.w, m.aktiv.w));

// Kontrast jeder Reiter-Beschriftung gegen die Glasflaeche, wie sie auf dem Seitengrund liegt (Alpha gemischt)
const kontrasteDerLeiste = (seite) => seite.evaluate(() => {
  const rgb = (s) => (s.match(/[\d.]+/g) || []).map(Number);
  const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const ueber = (oben, unten) => { const a = oben[3] === undefined ? 1 : oben[3]; return [0, 1, 2].map((i) => oben[i] * a + unten[i] * (1 - a)); };
  const grund = rgb(getComputedStyle(document.body).backgroundColor);
  const nav = document.querySelector('.reiter-leiste');
  let flaeche = ueber(rgb(getComputedStyle(nav).backgroundColor), grund.length >= 3 ? grund : [255, 255, 255]);
  const pille = nav.querySelector('.reiter-pille');
  const aus = [];
  for (const b of nav.querySelectorAll('.reiter')) {
    let hinten = flaeche;
    if (b.classList.contains('an') && pille) hinten = ueber(rgb(getComputedStyle(pille).backgroundColor), flaeche);
    const vorn = rgb(getComputedStyle(b).color);
    const x = lum(vorn), y = lum(hinten);
    aus.push({ reiter: b.dataset.reiter, k: Math.round(((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)) * 100) / 100 });
  }
  return aus;
});

async function testeLeiste(browser) {
  // ---------- ohne REITER: keine Leiste, kein Abstand ----------
  gruppe = 'Leiste ohne REITER';
  {
    const { kontext, seite, fehler } = await neueSeite(browser, { w: 1180, h: 820 });
    await seite.goto(BASIS + '#arena');
    await seite.waitForSelector('.screen.arena .knoten');
    const m = await lageMessen(seite);
    pruefe('keine Leiste, html ohne data-reiter', !m.sichtbar && !m.html, JSON.stringify({ s: m.sichtbar, h: m.html }));
    pruefe('kein zusaetzlicher Abstand: Screen so hoch und breit wie das Fenster, Platz im Kopf leer', m.screen.h === m.ih && m.screen.l === 0
      && await seite.evaluate(() => { const p = document.querySelector('.kopf-reiter-platz'); return !!p && p.children.length === 0 && getComputedStyle(p).display === 'none'; }),
    JSON.stringify(m.screen));
    pruefe('Verlauf-Knopf im Kopf sichtbar (Verlauf ist kein Reiter)', await seite.locator('.haupt-kopf [data-aktion="verlauf"]').isVisible());
    pruefe('keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }

  // ---------- Handy: schwebende Glas-Kapsel unten (Konzept 2026-11-06, Entwurf .dock) ----------
  for (const schema of ['light', 'dark']) {
    gruppe = `glas-leiste Handy 390 ${schema === 'dark' ? 'dunkel' : 'hell'}`;
    const { kontext, seite, fehler } = await neueSeite(browser, { w: 390, h: 844, handy: true, schema });
    await seite.goto(`${BASIS}&reiter=bestenliste,ich#heim`);
    await seite.waitForSelector('.heim-screen .heim-buehne');
    await warte(400);
    const m = await lageMessen(seite);
    pruefe('Lage unten, schwebend, nicht im Kopf', m.html === 'unten' && m.sichtbar && !m.imKopf, JSON.stringify({ h: m.html, k: m.imKopf }));
    pruefe('vier Reiter in der Reihenfolge Start, Bots, Liga, Ich; Start aktiv auf heim', m.reiter === 'heim*,arena,bestenliste,ich' && m.worte === 'Start,Bots,Liga,Ich',
      `${m.reiter} | ${m.worte}`);
    pruefe('schwebt: mindestens 12 px ueber dem unteren Rand, seitlich im Bild', m.ih - m.nav.b >= 12 && m.nav.l >= 8 && m.nav.r <= m.iw - 8, JSON.stringify(m.nav));
    pruefe('Kapsel: Radius mindestens 28 px, backdrop-filter mit Weichzeichner', m.radius >= 28 && /blur/.test(m.filter), JSON.stringify({ r: m.radius, f: m.filter }));
    pruefe('aktiver Reiter: Klasse an (nur einer), Farbe = Akzent (--kt-stark)', m.aktivAn && m.nurEinAn && m.aktivFarbe === m.akzent, JSON.stringify({ an: m.aktivAn, f: m.aktivFarbe, a: m.akzent }));
    pruefe('Pille hinter dem aktiven Reiter', pilleUnterAktivem(m), JSON.stringify({ p: m.pille, a: m.aktiv }));
    pruefe('Reiter mindestens 44 x 44', m.reiterKlein === 0);
    pruefe('der Screen endet ueber der Leiste (nichts verdeckt)', m.screen.b <= m.nav.t + 0.5, JSON.stringify({ s: m.screen.b, n: m.nav.t }));
    pruefe('kein waagrechter Ueberlauf, Kopf passt', m.doc <= 0 && m.kopfUeber <= 0, JSON.stringify({ d: m.doc, k: m.kopfUeber }));
    const k = await kontrasteDerLeiste(seite);
    pruefe('Beschriftungen lesbar (Kontrast ab 4,5:1 auf dem Glas)', k.every((x) => x.k >= 4.5), JSON.stringify(k));
    if (schema === 'light') {
      // Wechsel per Tippen: Bots oeffnet die Arena, dort ist Bots aktiv; die Pille gleitet mit
      await seite.locator('.reiter-leiste [data-reiter="arena"]').click();
      await seite.waitForSelector('.screen.arena .knoten');
      await warte(700);
      const a = await lageMessen(seite);
      pruefe('Bots: #arena, Bots aktiv, Pille darunter', a.reiter === 'heim,arena*,bestenliste,ich' && pilleUnterAktivem(a)
        && await seite.evaluate(() => location.hash) === '#arena', a.reiter);
      // Schub 2: die Leiste kuerzt die Karte; der gewaehlte Gegner muss trotzdem ganz im Bild sein
      const g = await seite.evaluate(() => {
        const kk = document.querySelector('.screen.arena .karte').getBoundingClientRect();
        const n = document.querySelector('.screen.arena .knoten.gewaehlt').getBoundingClientRect();
        return { kt: Math.round(kk.top), kb: Math.round(kk.bottom), nt: Math.round(n.top), nb: Math.round(n.bottom) };
      });
      pruefe('Arena: gewaehlter Gegner ganz im sichtbaren Teil der Karte', g.nt >= g.kt - 1 && g.nb <= g.kb + 1, JSON.stringify(g));
      await seite.evaluate(() => window.__app.meldung('Test-Meldung'));
      const t = await seite.evaluate(() => ({ t: document.querySelector('.toast').getBoundingClientRect().bottom, n: document.querySelector('.reiter-leiste').getBoundingClientRect().top }));
      pruefe('Meldung ueber der Leiste', t.t <= t.n, JSON.stringify(t));
    }
    pruefe('keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }

  // ---------- kleines Handy: alles im Bild ----------
  gruppe = 'glas-leiste Handy 375 x 667';
  {
    const { kontext, seite, fehler } = await neueSeite(browser, { w: 375, h: 667, handy: true });
    await seite.goto(`${BASIS}&reiter=bestenliste,ich#arena`);
    await seite.waitForSelector('.screen.arena .knoten');
    await warte(400);
    const m = await lageMessen(seite);
    pruefe('unten, ganz im Bild, Reiter mindestens 44 x 44', m.html === 'unten' && m.nav.l >= 0 && m.nav.r <= m.iw && m.ih - m.nav.b >= 12 && m.reiterKlein === 0, JSON.stringify(m.nav));
    pruefe('Screen endet ueber der Leiste, kein Ueberlauf', m.screen.b <= m.nav.t + 0.5 && m.doc <= 0 && m.kopfUeber <= 0, JSON.stringify({ s: m.screen, d: m.doc }));
    pruefe('keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }

  // ---------- ab 1021 px quer: Seitenleiste links (Entwurf ipad-pc-v2 .nav) ----------
  for (const vp of [{ w: 1180, h: 820 }, { w: 1440, h: 900 }]) {
    gruppe = `Seitenleiste (${vp.w} x ${vp.h})`;
    const { kontext, seite, fehler } = await neueSeite(browser, vp);
    await seite.goto(`${BASIS}&reiter=bestenliste,ich#arena`);
    await seite.waitForSelector('.screen.arena .knoten');
    await warte(400);
    let m = await lageMessen(seite);
    pruefe('Lage seite: html[data-reiter="seite"], nicht im Kopf, Platz im Kopf leer', m.html === 'seite' && m.sichtbar && !m.imKopf
      && await seite.evaluate(() => { const p = document.querySelector('.kopf-reiter-platz'); return !p || p.children.length === 0; }), JSON.stringify({ h: m.html, k: m.imKopf }));
    pruefe('links, 200 bis 240 px breit, ueber die ganze Hoehe', m.nav.l >= 0 && m.nav.l <= 16 && m.nav.w >= 200 && m.nav.w <= 240 && m.nav.h >= m.ih - 40,
      JSON.stringify(m.nav));
    pruefe('Reiter untereinander: Start, Bots, Liga, Ich; Bots aktiv', m.reiter === 'heim,arena*,bestenliste,ich' && m.worte === 'Start,Bots,Liga,Ich', `${m.reiter} | ${m.worte}`);
    pruefe('Screen beginnt rechts der Seitenleiste, volle Hoehe', m.screen.l >= m.nav.r - 0.5 && m.screen.h === m.ih, JSON.stringify({ s: m.screen, n: m.nav }));
    pruefe('aktiver Reiter: Klasse an, Akzentfarbe, Pille dahinter', m.aktivAn && m.aktivFarbe === m.akzent && pilleUnterAktivem(m), JSON.stringify({ p: m.pille, a: m.aktiv }));
    pruefe('Reiter mindestens 44 x 44, Kopf passt, kein waagrechter Ueberlauf', m.reiterKlein === 0 && m.kopfUeber <= 0 && m.doc <= 0, JSON.stringify({ k: m.kopfUeber, d: m.doc }));
    if (vp.w === 1180) {
      // Pille gleitet senkrecht zum neuen Reiter (im Bild abgetastet, nicht nur einmal von aussen gemessen)
      const vorher = m.pille.t;
      await seite.evaluate(() => {
        const s = window.__pilleAbtast = { oben: [], an: true };
        const f = () => { const p = document.querySelector('.reiter-leiste .reiter-pille'); if (p) s.oben.push(p.getBoundingClientRect().top); if (s.an) requestAnimationFrame(f); };
        f();
      });
      await seite.locator('.reiter-leiste [data-reiter="heim"]').click();
      await seite.waitForFunction(() => location.hash === '#heim' && !!document.querySelector('.heim-screen .heim-buehne'), null, { timeout: 10000 }).catch(() => {});
      await warte(800);
      m = await lageMessen(seite);
      const abtast = await seite.evaluate(() => { window.__pilleAbtast.an = false; return window.__pilleAbtast.oben; });
      const zwischen = (t) => t < vorher - 1 && t > m.pille.t + 1;
      pruefe('Start: #heim aktiv, Pille gleitet nach oben (unterwegs dazwischen)', m.reiter.includes('heim*') && pilleUnterAktivem(m) && abtast.some(zwischen),
        JSON.stringify({ vorher, ende: m.pille && m.pille.t, bilder: abtast.length }));
      // Drehen auf hochkant: unten; zurueck: wieder Seitenleiste
      await seite.setViewportSize({ width: 820, height: 1180 });
      await seite.waitForFunction(() => document.documentElement.dataset.reiter === 'unten', null, { timeout: 3000 }).catch(() => {});
      await warte(300);
      m = await lageMessen(seite);
      pruefe('Drehen auf hochkant: unten, Screen wieder volle Breite', m.html === 'unten' && m.screen.l === 0 && pilleUnterAktivem(m), JSON.stringify({ h: m.html, s: m.screen }));
      await seite.setViewportSize({ width: 1180, height: 820 });
      await seite.waitForFunction(() => document.documentElement.dataset.reiter === 'seite', null, { timeout: 3000 }).catch(() => {});
      await warte(300);
      pruefe('zurueck ins Querformat: wieder Seitenleiste', (await lageMessen(seite)).html === 'seite');
      // Tastatur: der Fokus folgt auf den neuen Reiter
      await seite.locator('.reiter-leiste [data-reiter="arena"]').focus();
      await seite.keyboard.press('Enter');
      await seite.waitForSelector('.screen.arena .knoten');
      await warte(100);
      pruefe('Tastatur: Enter auf Bots, der Fokus liegt danach auf dem neuen aktiven Reiter', await seite.evaluate(() => {
        const a = document.activeElement;
        return !!a && a.matches('.reiter-leiste [data-reiter="arena"][aria-current="page"]');
      }));
    }
    for (const schema of ['dark']) {
      await seite.emulateMedia({ colorScheme: schema });
      await warte(1200);
      const k = await kontrasteDerLeiste(seite);
      pruefe('dunkel: Beschriftungen lesbar (Kontrast ab 4,5:1)', k.every((x) => x.k >= 4.5), JSON.stringify(k));
    }
    pruefe('keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }

  // ---------- Zuordnung: Unterseiten der Startseite und von Ich ----------
  gruppe = 'Reiter-Zuordnung';
  {
    const { kontext, seite, fehler } = await neueSeite(browser, { w: 820, h: 1180 });
    await seite.goto(`${BASIS}&reiter=bestenliste,ich#training`);
    await seite.waitForSelector('.screen.training-screen');
    let m = await lageMessen(seite);
    pruefe('Training (ueber die Startseite erreichbar): Start aktiv, Zurueck-Knopf da', m.reiter.includes('heim*') && m.wurzel === 'nein'
      && await seite.locator('.training-screen .kopf-zurueck').isVisible(), JSON.stringify({ r: m.reiter, w: m.wurzel }));
    await seite.evaluate(() => window.__app.gehe('verlauf'));
    await seite.waitForSelector('.screen.vl-screen');
    m = await lageMessen(seite);
    pruefe('Verlauf gehoert zu Ich: Ich aktiv, Zurueck-Knopf da', m.reiter.includes('ich*') && m.wurzel === 'nein'
      && await seite.locator('.vl-screen .kopf-zurueck').isVisible(), JSON.stringify({ r: m.reiter, w: m.wurzel }));
    await seite.evaluate(() => window.__app.gehe('heim'));
    await seite.waitForSelector('.heim-screen .heim-buehne');
    m = await lageMessen(seite);
    pruefe('auf heim: Start aktiv, Wurzel (kein Zurueck)', m.reiter.includes('heim*') && m.wurzel === 'ja' && !(await seite.locator('.heim-screen .kopf-zurueck').isVisible()),
      JSON.stringify({ r: m.reiter, w: m.wurzel }));
    pruefe('keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }

  // ---------- ohne backdrop-filter: deckende Flaeche ----------
  gruppe = 'Leiste ohne Glas';
  {
    const { kontext, seite, fehler } = await neueSeite(browser, { w: 390, h: 844, handy: true });
    // Browser ohne backdrop-filter nachstellen: CSS.supports meldet ihn nicht, die @supports-Regel prueft der Node-Teil
    await seite.goto(`${BASIS}&reiter=bestenliste,ich#heim`);
    await seite.waitForSelector('.heim-screen .heim-buehne');
    const ersatz = await seite.evaluate(() => {
      const regeln = [];
      for (const s of document.styleSheets) { try { for (const r of s.cssRules) if (r.conditionText && /not/.test(r.conditionText) && /backdrop-filter/.test(r.conditionText)) regeln.push(r.cssText); } catch (e) { /* fremd */ } }
      return regeln.join(' ');
    });
    pruefe('@supports not (backdrop-filter): Leiste mit deckender Flaeche (--flaeche)', /\.reiter-leiste\s*\{[^}]*background(-color)?:\s*var\(--flaeche\)/.test(ersatz), ersatz.slice(0, 200));
    pruefe('keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }

  // ---------- weg in Partie, Analyse, Einstellungen; zurueck faehrt sie ein ----------
  gruppe = 'Leiste faehrt weg';
  {
    const { kontext, seite, fehler } = await neueSeite(browser, { w: 820, h: 1180 });
    await seite.goto(`${BASIS}&reiter=bestenliste,ich#arena`);
    await seite.waitForSelector('.screen.arena .knoten');
    for (const [ziel, sel] of [['einstellungen', '.screen.es-screen'], ['analyse', '.screen.an-screen'], ['partie', '.screen.partie']]) {
      await seite.evaluate(() => window.__app.gehe('arena', {}, { ersetzen: true }));
      await seite.waitForSelector('.screen.arena .knoten');
      await seite.waitForFunction(() => { const n = document.querySelector('.reiter-leiste'); return n && !n.hidden && !n.classList.contains('weg'); });
      const params = { partie: { botId: 'fridolin', farbe: 'w' }, analyse: { partieId: 'gibt-es-nicht' } }[ziel] || {};
      // der Zustand wird in dem Augenblick festgehalten, in dem die Leiste wegzufahren beginnt (.weg): bis die Partie gebaut
      // ist, kann das Wegfahren (420 ms) auf einem ausgelasteten Rechner schon vorbei sein
      await seite.evaluate(([z, p]) => {
        const nav = document.querySelector('.reiter-leiste');
        window.__weg = null;
        const lies = () => ({ html: document.documentElement.dataset.reiter || null, h: document.querySelector('#app > .screen').getBoundingClientRect().height, ih: innerHeight, weg: nav.classList.contains('weg') });
        new MutationObserver((l, mo) => { if (nav.classList.contains('weg')) { window.__weg = lies(); mo.disconnect(); } }).observe(nav, { attributes: true, attributeFilter: ['class'] });
        window.__app.gehe(z, p);
      }, [ziel, params]);
      await seite.waitForSelector(sel);
      const sofort = await seite.evaluate(() => window.__weg || ({ html: document.documentElement.dataset.reiter || null, h: document.querySelector('#app > .screen').getBoundingClientRect().height,
        ih: innerHeight, weg: document.querySelector('.reiter-leiste').classList.contains('weg') }));
      pruefe(`${ziel}: Platz sofort frei (kein data-reiter, Screen volle Hoehe), Leiste faehrt weg`, !sofort.html && sofort.h === sofort.ih && sofort.weg, JSON.stringify(sofort));
      const versteckt = await seite.waitForFunction(() => document.querySelector('.reiter-leiste').hidden, null, { timeout: 1500 }).then(() => true, () => false);
      pruefe(`${ziel}: nach dem Wegfahren versteckt (hidden)`, versteckt);
    }
    await seite.evaluate(() => window.__app.gehe('arena', {}, { ersetzen: true }));
    await seite.waitForSelector('.screen.arena .knoten');
    const zurueck = await seite.evaluate(() => { const n = document.querySelector('.reiter-leiste'); return { sichtbar: !n.hidden, anim: n.getAnimations().length > 0 }; });
    pruefe('zurueck in der Arena: Leiste faehrt wieder ein', zurueck.sichtbar && zurueck.anim, JSON.stringify(zurueck));
    pruefe('keine Konsolenfehler', fehler.filter((f) => !/stockfish|wasm|Engine/i.test(f)).length === 0, fehler.join(' | '));
    await kontext.close();
  }
  gruppe = 'Leiste ohne Bewegung';
  {
    const { kontext, seite, fehler } = await neueSeite(browser, { w: 820, h: 1180, bewegung: 'reduce' });
    await seite.goto(`${BASIS}&reiter=bestenliste,ich#arena`);
    await seite.waitForSelector('.screen.arena .knoten');
    await seite.evaluate(() => window.__app.gehe('einstellungen'));
    await seite.waitForSelector('.screen.es-screen');
    pruefe('reduzierte Bewegung: sofort versteckt, keine Animation', await seite.evaluate(() => {
      const n = document.querySelector('.reiter-leiste');
      return n.hidden && n.getAnimations().length === 0;
    }));
    await seite.evaluate(() => window.__app.zurueck());
    await seite.waitForSelector('.screen.arena .knoten');
    pruefe('zurueck: sofort da, ohne Animation', await seite.evaluate(() => { const n = document.querySelector('.reiter-leiste'); return !n.hidden && n.getAnimations().length === 0; }));
    pruefe('keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }
  gruppe = 'Leiste nur im Testmodus';
  {
    const { kontext, seite } = await neueSeite(browser, { w: 820, h: 1180 });
    await seite.goto(`http://127.0.0.1:${PORT}/index.html?reiter=training#arena`);
    await seite.waitForSelector('.screen.arena .knoten');
    // mit fest eingetragenen REITER gibt es die Leiste mit Start, Bots, Liga, Ich; ?reiter fuegt ohne ?test nichts hinzu
    pruefe('?reiter ohne ?test bleibt wirkungslos, Leiste aus REITER', await seite.evaluate(() =>
      [...document.querySelectorAll('.reiter-leiste [data-reiter]')].map((b) => b.dataset.reiter).join()) === 'heim,arena,bestenliste,ich');
    await kontext.close();
  }
}

async function testeSprunglink(browser) {
  gruppe = 'Sprunglink';
  const { kontext, seite, fehler } = await neueSeite(browser);
  await seite.goto(BASIS + '#arena');
  await seite.waitForSelector('.screen.arena .knoten');
  await seite.keyboard.press('Tab');
  const de = await seite.evaluate(() => ({ text: document.activeElement.textContent, klasse: document.activeElement.className,
    sichtbar: document.activeElement.getBoundingClientRect().top >= 0 }));
  pruefe('erstes fokussierbares Element ist der sichtbare Sprunglink', de.klasse === 'zum-inhalt'
    && de.text === 'Zum Inhalt springen' && de.sichtbar, JSON.stringify(de));
  await seite.keyboard.press('Enter');
  pruefe('Sprunglink fokussiert den Hauptinhalt', await seite.evaluate(() => document.activeElement.id === 'hauptinhalt'));
  await seite.evaluate(() => { window.__app.setzeEinstellungen({ sprache: 'en', spracheGewaehlt: true }); window.__app.gehe('training'); });
  await seite.waitForSelector('.screen.training-screen');
  pruefe('Ziel folgt dem Screenwechsel und Text ist englisch', await seite.evaluate(() =>
    document.querySelector('.zum-inhalt').textContent === 'Skip to content'
    && document.querySelector('#app > .screen').id === 'hauptinhalt'));
  // Auf anderen Screens bleibt der Screen stehen (vorher fuehrte #hauptinhalt ueber den Router zur Arena)
  await seite.evaluate(() => window.__app.gehe('einstellungen'));
  await seite.waitForSelector('.screen.es-screen');
  await seite.focus('.zum-inhalt');
  await seite.keyboard.press('Enter');
  await seite.waitForTimeout(300);
  pruefe('Sprunglink in den Einstellungen: Screen und Adresse bleiben, Fokus im Hauptinhalt', await seite.evaluate(() =>
    location.hash === '#einstellungen' && !!document.querySelector('.screen.es-screen') && document.activeElement.id === 'hauptinhalt'));
  pruefe('keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
  await kontext.close();
}

// Kopf: Klang-Schalter, Hell/Dunkel, Titel nie gekuerzt
async function testeKopf(browser) {
  gruppe = 'Kopf';
  const { kontext, seite, fehler } = await neueSeite(browser, { w: 1180, h: 820 });
  await seite.goto(BASIS + '#arena');
  await seite.waitForSelector('.screen.arena .knoten');
  const k0 = await seite.evaluate(() => ({ pressed: document.querySelector('.knopf-klang').getAttribute('aria-pressed'),
    welle: getComputedStyle(document.querySelector('.knopf-klang .klang-welle')).opacity, strich: getComputedStyle(document.querySelector('.knopf-klang .klang-strich')).opacity }));
  pruefe('Klang-Schalter an: Wellen sichtbar, Kreuz nicht', k0.pressed === 'true' && k0.welle === '1' && k0.strich === '0', JSON.stringify(k0));
  await seite.locator('.knopf-klang').click();
  await warte(400);
  const k1 = await seite.evaluate(() => ({ pressed: document.querySelector('.knopf-klang').getAttribute('aria-pressed'),
    klang: JSON.parse(localStorage.getItem('schach-arena:v1:einstellungen') || '{}').klang, toast: (document.querySelector('.toast') || {}).textContent }));
  pruefe('Klang-Schalter: aus, gespeichert, Meldung "Klang aus"', k1.pressed === 'false' && k1.klang === false && k1.toast === 'Klang aus', JSON.stringify(k1));
  await seite.locator('.knopf-klang').click();
  await warte(200);
  pruefe('wieder an', await seite.evaluate(() => document.querySelector('.knopf-klang').getAttribute('aria-pressed') === 'true'
    && JSON.parse(localStorage.getItem('schach-arena:v1:einstellungen')).klang === true));
  await seite.locator('.haupt-kopf [data-aktion="modus"]').click();
  await seite.waitForFunction(() => document.documentElement.dataset.modus === 'dunkel', null, { timeout: 3000 }).catch(() => {});
  await warte(900);
  const d = await seite.evaluate(() => ({ modus: document.documentElement.dataset.modus, icon: document.querySelector('.haupt-kopf [data-aktion="modus"]').dataset.icon,
    gespeichert: JSON.parse(localStorage.getItem('schach-arena:v1:einstellungen')).modus, grund: getComputedStyle(document.body).backgroundColor }));
  pruefe('Mond: dunkel, gespeichert, Knopf zeigt jetzt die Sonne, Schiefer', d.modus === 'dunkel' && d.gespeichert === 'dunkel' && d.icon === 'sonne'
    && d.grund === 'rgb(21, 23, 27)', JSON.stringify(d));
  await seite.locator('.haupt-kopf [data-aktion="modus"]').click();
  await seite.waitForFunction(() => document.documentElement.dataset.modus === 'hell', null, { timeout: 3000 }).catch(() => {});
  pruefe('Sonne: wieder hell', await seite.evaluate(() => document.documentElement.dataset.modus === 'hell'));
  const knoepfe = await seite.evaluate(() => [...document.querySelectorAll('.haupt-kopf button')].filter((b) => b.getBoundingClientRect().width)
    .map((b) => b.getBoundingClientRect()).every((r) => r.width >= 44 && r.height >= 44));
  pruefe('Kopf-Knoepfe mindestens 44 x 44', knoepfe);
  pruefe('keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
  await kontext.close();

  // Handy (Startseite neu, Flo 01.11.2026): vorn die Premium-Krone, rechts Shop, Hell/Dunkel und Zahnrad; Verlauf und Klang
  // treten zurueck; viele Chips scrollen statt umzubrechen, ein Stummel wird ausgeblendet
  gruppe = 'Kopf Handy';
  const h = await neueSeite(browser, { w: 375, h: 667, handy: true });
  await h.seite.goto(BASIS + '#arena');
  await h.seite.waitForSelector('.screen.arena .knoten');
  await warte(300);
  const hk = await h.seite.evaluate(() => {
    const kopf = document.querySelector('.haupt-kopf');
    const t = kopf.querySelector('.marke-titel').getBoundingClientRect();
    const chips = kopf.querySelector('.kopf-chips');
    const krone = kopf.querySelector('.kopf-premium').getBoundingClientRect();
    const d = (sel) => { const e = kopf.querySelector(sel); return e ? getComputedStyle(e).display : 'fehlt'; };
    return { mond: d('[data-aktion="modus"]'), shop: d('[data-aktion="shop"]'), verlauf: d('[data-aktion="verlauf"]'), klang: d('[data-aktion="klang"]'),
      kroneB: krone.bottom, kroneH: krone.height, titelH: t.height, chipsT: chips.getBoundingClientRect().top, chipsW: chips.getBoundingClientRect().width,
      kopfW: kopf.clientWidth, ueber: kopf.scrollWidth - kopf.clientWidth, sterne: chips.firstElementChild.getBoundingClientRect().width <= chips.clientWidth + 1 };
  });
  // zwei Zeilen: oben Krone, Shop, Hell/Dunkel, Zahnrad; darunter die Zahlen als volle Leiste
  pruefe('Handy: Krone oben, Zahlen-Leiste darunter ueber die volle Breite, Shop und Mond da, Verlauf und Klang zurueck, kein Ueberlauf',
    hk.mond === 'grid' && hk.shop === 'grid' && hk.verlauf === 'none' && hk.klang === 'none' && hk.kroneH >= 44 && hk.chipsT >= hk.kroneB
    && hk.chipsW >= hk.kopfW - 40 && hk.ueber <= 0 && hk.sterne, JSON.stringify(hk));
  // viele Chips (wie Pakete am Ort arena:kopf): Zeile bleibt eine Zeile, Chips scrollen
  const viele = await h.seite.evaluate(() => {
    const chips = document.querySelector('.haupt-kopf .kopf-chips');
    for (let i = 0; i < 4; i++) { const c = document.createElement('span'); c.className = 'chip'; c.textContent = 'Paket ' + i; chips.append(c); }
    const kopf = document.querySelector('.haupt-kopf');
    return { h: kopf.getBoundingClientRect().height, ueber: kopf.scrollWidth - kopf.clientWidth, scrollt: chips.scrollWidth > chips.clientWidth,
      oben: [...chips.children].filter((c) => c.getBoundingClientRect().width > 0).map((c) => Math.round(c.getBoundingClientRect().top)) };
  });
  pruefe('viele Chips: scrollen waagrecht, kein Umbruch, Kopf ohne Ueberlauf', viele.scrollt && viele.ueber <= 0 && new Set(viele.oben).size === 1, JSON.stringify(viele));
  pruefe('keine Konsolenfehler', h.fehler.length === 0, h.fehler.join(' | '));
  await h.kontext.close();
}

// Training-Huelle: leer und mit Test-Anbieter
const TEST_PAKET_TRAINING = `
import { anbieten } from '../../orte.js';
const log = window.__tr = { kontexte: [], weg: 0 };
for (const [i, titel] of ['Matt in 2', 'Rätsel-Serie', 'Patzer-Kartei'].entries()) {
  anbieten('training:karten', (k) => {
    log.kontexte.push({ schluessel: Object.keys(k).sort().join(), eingefroren: Object.isFrozen(k), hatApp: !!(k.app && k.app.gehe) });
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 't-karte' + (i === 1 ? ' t-held' : '');
    el.dataset.karte = String(i);
    el.innerHTML = '<span class="ueberzeile">Test</span><h2>' + titel + '</h2><p>Karte ' + (i + 1) + ' aus dem Test-Paket.</p>';
    return { el, verlasse() { log.weg++; } };
  }, { reihenfolge: 10 + i, paket: 'nav-test' });
}
`;

async function testeTraining(browser) {
  gruppe = 'Training leer';
  {
    const { kontext, seite, fehler } = await neueSeite(browser, { w: 1180, h: 820 });
    // Dieser Vertrag prueft die Huelle ohne Anbieter, unabhaengig von installierten Paketen.
    await seite.route('**/js/erweiterungen.js', r => r.fulfill({ contentType: 'text/javascript', body: 'export const PAKETE = []; export const REITER = [];' }));
    await seite.goto(BASIS + '#training');
    await seite.waitForSelector('.screen.training-screen');
    const r = await seite.evaluate(() => ({ hash: location.hash, titel: document.title, platzhalter: !!document.querySelector('.screen.platzhalter'),
      leer: !document.querySelector('.training-leer').hidden, gitter: document.querySelector('.training-gitter').hidden,
      h1: document.querySelector('.seiten-kopf h1').textContent, ueber: document.querySelector('.seiten-kopf .ueberzeile').textContent,
      zurueck: !!document.querySelector('.kopf-zurueck') && getComputedStyle(document.querySelector('.kopf-zurueck')).display !== 'none' }));
    pruefe('#training ist Kern-Screen: Huelle statt Arena, kein Platzhalter', r.hash === '#training' && r.titel === 'Training · Crownmate' && !r.platzhalter, JSON.stringify(r));
    pruefe('Seitenkopf „Üben ohne Druck“ / „Training“, die einzige Ueberschrift h1', r.ueber === 'Üben ohne Druck' && r.h1 === 'Training'
      && await seite.locator('.screen.training-screen h1').count() === 1, JSON.stringify(r));
    pruefe('ohne Anbieter: ruhige Karte, Gitter versteckt; ohne Reiter ein Zurueck-Knopf', r.leer && r.gitter && r.zurueck, JSON.stringify(r));
    await seite.locator('.training-leer [data-aktion="arena"]').click();
    await seite.waitForSelector('.screen.arena .knoten');
    pruefe('„Zur Arena“ fuehrt in die Arena', await seite.evaluate(() => location.hash) === '#arena');
    pruefe('keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }
  for (const vp of [{ name: 'quer', w: 1180, h: 820 }, { name: 'Handy', w: 390, h: 844, handy: true }]) {
    gruppe = `Training mit Anbieter (${vp.name})`;
    const { kontext, seite, fehler } = await neueSeite(browser, vp);
    // Genau die drei Test-Anbieter liefern die Karten dieses Layout-Vertrags.
    await seite.route('**/js/erweiterungen.js', r => r.fulfill({ contentType: 'text/javascript', body: 'export const PAKETE = []; export const REITER = [];' }));
    await seite.route('**/js/pakete/nav-test/index.js', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: TEST_PAKET_TRAINING }));
    await seite.goto(`${BASIS}&erw=pakete/nav-test/index&reiter=bestenliste#training`);
    await seite.waitForSelector('.training-gitter [data-karte="2"]');
    await warte(1200);
    const r = await seite.evaluate(() => {
      const g = document.querySelector('.training-gitter');
      const k = [...g.children].map((c) => { const b = c.getBoundingClientRect(); return { l: Math.round(b.left), t: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height) }; });
      return { anzahl: g.dataset.anzahl, sichtbar: !g.hidden, leer: document.querySelector('.training-leer').hidden, k, kontexte: window.__tr.kontexte,
        doc: document.scrollingElement.scrollWidth - innerWidth, reiter: document.documentElement.dataset.reiterWurzel,
        aktiv: (document.querySelector('.reiter-leiste [aria-current="page"]') || {}).dataset };
    });
    pruefe('drei Karten in .training-gitter (data-anzahl 3), leere Karte weg', r.anzahl === '3' && r.sichtbar && r.leer, JSON.stringify(r));
    pruefe('Kontext { app }, eingefroren, wie in ARCHITEKTUR.md', r.kontexte.length === 3 && r.kontexte.every((x) => x.schluessel === 'app' && x.eingefroren && x.hatApp),
      JSON.stringify(r.kontexte));
    if (vp.w > 700) {
      // die Karte mit .t-held (hier die zweite) steht gross links ueber zwei Zeilen, die anderen rechts untereinander
      const [g, a, b] = [r.k[1], r.k[0], r.k[2]];
      pruefe('quer: die Karte mit .t-held gross links ueber zwei Zeilen, die zwei anderen rechts', g.l < a.l && a.l === b.l && b.t > a.t
        && Math.abs(g.t - a.t) <= 1 && Math.abs(g.h - (b.t + b.h - a.t)) <= 2, JSON.stringify(r.k));
    } else {
      pruefe('Handy: eine Spalte, alle Karten gleich breit', r.k.every((x) => x.l === r.k[0].l && x.w === r.k[0].w) && r.k[1].t > r.k[0].t, JSON.stringify(r.k));
    }
    pruefe('Training haengt an der Startseite: Reiter Start aktiv, mit Zurueck', r.reiter === 'nein' && r.aktiv && r.aktiv.reiter === 'heim', JSON.stringify(r.aktiv));
    pruefe('kein waagrechter Ueberlauf', r.doc <= 0, String(r.doc));
    await seite.locator('.reiter-leiste [data-reiter="arena"]').click();
    await seite.waitForSelector('.screen.arena .knoten');
    pruefe('Verlassen raeumt die Karten ab (verlasse der Anbieter)', await seite.evaluate(() => window.__tr.weg) === 3);
    pruefe('keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }
}

// Bauteile auf der Testseite tests/bauteile.html
async function testeBauteile(browser) {
  gruppe = 'Bauteile';
  const { kontext, seite, fehler } = await neueSeite(browser, { w: 820, h: 1180 });
  await seite.goto(`http://127.0.0.1:${PORT}/tests/bauteile.html`);
  await seite.waitForFunction(() => window.testseiteBereit === true);
  const log = () => seite.evaluate(() => window.__bt.log.map((x) => x.join(':')));
  // Segment
  const segZustand = () => seite.evaluate(() => {
    const el = window.__bt.seg.el;
    const k = [...el.querySelectorAll('.seg')];
    const p = el.querySelector('.seg-pille').getBoundingClientRect();
    const a = el.querySelector('[aria-checked="true"]').getBoundingClientRect();
    return { wert: window.__bt.seg.wert(), checked: k.map((x) => x.getAttribute('aria-checked')).join(), tab: k.map((x) => x.tabIndex).join(),
      pilleL: p.left, aktivL: a.left, pilleW: p.width, aktivW: a.width, hoehe: Math.min(...k.map((x) => x.getBoundingClientRect().height)),
      fokus: document.activeElement && document.activeElement.dataset.wert };
  });
  let s = await segZustand();
  pruefe('Segment: Start Weiß, nur die Wahl ist per Tab erreichbar, Knoepfe >= 44 hoch', s.wert === 'w' && s.checked === 'true,false,false' && s.tab === '0,-1,-1' && s.hoehe >= 44,
    JSON.stringify(s));
  await seite.locator('.segment .seg[data-wert="b"]').click();
  await warte(700);
  s = await segZustand();
  pruefe('Segment: Klick waehlt Schwarz, Pille gleitet darunter, beiWahl gerufen', s.wert === 'b' && s.checked === 'false,false,true' && nah(s.pilleL, s.aktivL)
    && nah(s.pilleW, s.aktivW) && (await log()).includes('segment:b:klick'), JSON.stringify(s));
  await seite.locator('.segment .seg[data-wert="b"]').focus();
  await seite.keyboard.press('ArrowLeft');
  s = await segZustand();
  pruefe('Segment: Pfeil links waehlt Zufall und fokussiert', s.wert === 'z' && s.fokus === 'z' && (await log()).includes('segment:z:taste'), JSON.stringify(s));
  await seite.keyboard.press('Home');
  const home = (await segZustand()).wert;
  await seite.keyboard.press('End');
  const ende = (await segZustand()).wert;
  await seite.keyboard.press('ArrowRight');
  s = await segZustand();
  pruefe('Segment: Pos1, Ende, Pfeil rechts am Ende springt zum Anfang', home === 'w' && ende === 'b' && s.wert === 'w' && s.tab === '0,-1,-1', `${home} ${ende} ${s.wert}`);
  await seite.evaluate(() => window.__bt.seg.setze('z'));
  pruefe('Segment: setze() ohne beiWahl', (await segZustand()).wert === 'z' && !(await log()).some((x) => x === 'segment:z:setze'));

  // Schalter
  const sch = seite.locator('.schalter');
  await sch.click();
  const schAus = await seite.evaluate(() => ({ a: document.querySelector('.schalter').getAttribute('aria-checked'), an: window.__bt.sch.an(), role: document.querySelector('.schalter').getAttribute('role') }));
  await sch.focus();
  await seite.keyboard.press('Space');
  const schAn = await seite.evaluate(() => document.querySelector('.schalter').getAttribute('aria-checked'));
  const schMass = await seite.evaluate(() => { const b = document.querySelector('.schalter').getBoundingClientRect(); return [b.width, b.height]; });
  pruefe('Schalter: role=switch, Klick aus, Leertaste an, beiWechsel gerufen, 58 x 44', schAus.role === 'switch' && schAus.a === 'false' && !schAus.an && schAn === 'true'
    && (await log()).includes('schalter:false') && (await log()).includes('schalter:true') && schMass[1] >= 44, JSON.stringify([schAus, schAn, schMass]));

  // Regler
  const reg = () => seite.evaluate(() => { const r = document.querySelector('.regler'); return { wert: window.__bt.reg.wert(), now: r.getAttribute('aria-valuenow'),
    text: document.querySelector('.regler-wert').textContent, h: r.getBoundingClientRect().height }; });
  pruefe('Regler: Start 0,8 = „80 %“, role=slider, 44 hoch', (await reg()).wert === 0.8 && (await reg()).text === '80 %' && (await reg()).h >= 44
    && await seite.evaluate(() => document.querySelector('.regler').getAttribute('role') === 'slider'), JSON.stringify(await reg()));
  await seite.locator('.regler').focus();
  await seite.keyboard.press('ArrowRight');
  const r1 = await reg();
  await seite.keyboard.press('End');
  const r2 = await reg();
  await seite.keyboard.press('PageDown');
  const r3 = await reg();
  pruefe('Regler: Pfeil +0,05, Ende = 1, Bild ab -0,5 (genau gerundet)', r1.wert === 0.85 && r2.wert === 1 && r3.wert === 0.5 && r3.now === '0.5', JSON.stringify([r1, r2, r3]));
  const box = await seite.locator('.regler-innen').boundingBox();
  await seite.mouse.move(box.x + box.width * 0.25, box.y + box.height / 2);
  await seite.mouse.down();
  await seite.mouse.move(box.x + box.width * 0.6, box.y + box.height / 2, { steps: 4 });
  await seite.mouse.up();
  const r4 = await reg();
  pruefe('Regler: Ziehen setzt den Wert (0,6), beim Loslassen fertig', r4.wert === 0.6 && (await log()).includes('regler:0.6:true'), JSON.stringify(r4));

  // Halte-Knopf
  const halte = seite.locator('.halte-knopf');
  const hb = await halte.boundingBox();
  pruefe('Halte-Knopf mindestens 44 hoch', hb.height >= 44, JSON.stringify(hb));
  await seite.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await seite.mouse.down();
  await warte(350);
  const haelt = await seite.evaluate(() => document.querySelector('.halte-knopf').classList.contains('haelt'));
  await seite.mouse.up();
  await warte(900);
  pruefe('Halte-Knopf: frueh loslassen loest nicht aus (Ring lief, Hinweis als Meldung)', haelt && await seite.evaluate(() => window.__bt.ausgeloest()) === 0
    && await seite.evaluate(() => (document.querySelector('.toast') || {}).textContent) === 'Zum Aufgeben gedrückt halten'
    && await seite.locator('.sheet-ort').count() === 0);
  await seite.mouse.down();
  await warte(1250);
  await seite.mouse.up();
  await warte(200);
  pruefe('Halte-Knopf: 1 s halten loest genau einmal aus, kein Blatt', await seite.evaluate(() => window.__bt.ausgeloest()) === 1 && await seite.locator('.sheet-ort').count() === 0);
  // Tastatur: Blatt mit Rueckfrage
  await halte.focus();
  await seite.keyboard.press('Enter');
  await seite.waitForSelector('.sheet-ort .sheet-karte');
  const blatt = await seite.evaluate(() => ({ titel: document.querySelector('.sheet-karte h3').textContent, knoepfe: [...document.querySelectorAll('.sheet-knoepfe button')].map((b) => b.textContent),
    fokus: document.activeElement.textContent, rolle: document.querySelector('.sheet-karte').getAttribute('role') }));
  pruefe('Tastatur: Blatt „Aufgeben?“ mit Weiterspielen/Aufgeben, Fokus auf dem sicheren Knopf', blatt.titel === 'Aufgeben?' && blatt.knoepfe.join() === 'Weiterspielen,Aufgeben'
    && blatt.fokus === 'Weiterspielen' && blatt.rolle === 'alertdialog', JSON.stringify(blatt));
  await seite.keyboard.press('Escape');
  await seite.waitForFunction(() => !document.querySelector('.sheet-ort'), null, { timeout: 2000 }).catch(() => {});
  pruefe('Escape schliesst ohne Ausloesen', await seite.evaluate(() => window.__bt.ausgeloest()) === 1 && await seite.locator('.sheet-ort').count() === 0);
  await halte.focus();
  await seite.keyboard.press('Enter');
  await seite.waitForSelector('.sheet-ort .sheet-karte');
  await seite.locator('.sheet-knoepfe button', { hasText: 'Aufgeben' }).click();
  await warte(400);
  pruefe('Blatt „Aufgeben“ loest aus', await seite.evaluate(() => window.__bt.ausgeloest()) === 2);

  // Blatt: Fokus bleibt drin, Schleier bricht ab
  await seite.locator('[data-test="sheet"]').click();
  await seite.waitForSelector('.sheet-ort .sheet-karte');
  await warte(500);
  const f0 = await seite.evaluate(() => document.activeElement.textContent);
  await seite.keyboard.press('Tab');
  const f1 = await seite.evaluate(() => document.activeElement.textContent);
  await seite.keyboard.press('Tab');
  const f2 = await seite.evaluate(() => document.activeElement.textContent);
  pruefe('Blatt: Fokus auf der Hauptaktion, Tab bleibt im Blatt', f0 === 'Ja' && f1 === 'Nein' && f2 === 'Ja', `${f0} ${f1} ${f2}`);
  const kb = await seite.locator('.sheet-karte').boundingBox();
  await seite.mouse.click(kb.x + kb.width / 2, Math.max(5, kb.y - 60));
  await warte(500);
  pruefe('Blatt: Tipp auf den Schleier liefert „abbrechen“', await seite.evaluate(() => window.__bt.sheetWert()) === 'ab' && await seite.locator('.sheet-ort').count() === 0);

  // Meldung und Mini-Brett
  await seite.locator('[data-test="toast"]').click();
  pruefe('Meldung (toast) erscheint in .toast-ort', await seite.evaluate(() => document.querySelector('.toast-ort .toast').textContent) === 'Hallo vom Test');
  const mini = await seite.evaluate(() => { const m = document.querySelector('.mini'); return { felder: m.children.length, figuren: m.querySelectorAll('img').length,
    z: m.querySelectorAll('i.z').length, farbe: getComputedStyle(m.querySelector('i.h')).backgroundColor, quelle: m.querySelector('img').getAttribute('src') }; });
  pruefe('Mini-Brett: 64 Felder, 32 Figuren, zwei markiert, Feldfarbe Nacht, Figuren aus assets/pieces/', mini.felder === 64 && mini.figuren === 32 && mini.z === 2
    && mini.farbe === 'rgb(228, 232, 246)' && /\/assets\/pieces\/bR\.svg$/.test(mini.quelle), JSON.stringify(mini));
  pruefe('keine Konsolenfehler', fehler.length === 0 && (await seite.evaluate(() => window.__bt.fehler)).length === 0, fehler.join(' | '));
  await kontext.close();

  // dunkel und Handy: Farben aus den Tokens, nichts laeuft ueber
  gruppe = 'Bauteile dunkel (Handy)';
  {
    const d = await neueSeite(browser, { w: 375, h: 667, schema: 'dark', handy: true });
    await d.seite.goto(`http://127.0.0.1:${PORT}/tests/bauteile.html`);
    await d.seite.waitForFunction(() => window.testseiteBereit === true);
    const r = await d.seite.evaluate(() => ({ an: getComputedStyle(document.querySelector('.schalter'), '::before').backgroundColor,
      pille: getComputedStyle(document.querySelector('.seg-pille')).backgroundColor, grund: getComputedStyle(document.body).backgroundColor,
      doc: document.scrollingElement.scrollWidth - innerWidth,
      klein: [...document.querySelectorAll('#app button, .regler')].filter((b) => { const x = b.getBoundingClientRect(); return x.width && (x.height < 44 || x.width < 44); })
        .map((b) => b.className) }));
    pruefe('Schalter an in Tinte (#F3F1EC), Segment-Pille --flaeche-3, Schiefer', r.an === 'rgb(243, 241, 236)' && r.pille === 'rgb(44, 48, 56)' && r.grund === 'rgb(21, 23, 27)',
      JSON.stringify(r));
    pruefe('kein waagrechter Ueberlauf, alle Tippflaechen >= 44 px', r.doc <= 0 && r.klein.length === 0, JSON.stringify(r));
    pruefe('Kopf mit vier Knoepfen: Chips-Stummel ausgeblendet, Titel ganz', await d.seite.evaluate(() => {
      const k = document.querySelector('.haupt-kopf');
      const t = k.querySelector('.marke-titel');
      const c = k.querySelector('.kopf-chips');
      const sichtbar = getComputedStyle(c).display !== 'none';
      return t.scrollWidth <= t.clientWidth + 1 && k.scrollWidth <= k.clientWidth && (!sichtbar || c.firstElementChild.getBoundingClientRect().width <= c.clientWidth + 1);
    }));
    pruefe('keine Konsolenfehler', d.fehler.length === 0, d.fehler.join(' | '));
    await d.kontext.close();
  }
}

// ---------- Premium und Shop (Startseite neu, Flo 01.11.2026) ----------
async function testePremium(browser) {
  gruppe = 'Premium';
  const h = await neueSeite(browser, { w: 390, h: 844, handy: true });
  await h.seite.goto(BASIS + '#arena');
  await h.seite.waitForSelector('.screen.arena .knoten');
  await h.seite.click('.haupt-kopf .kopf-premium');
  await h.seite.waitForSelector('.screen.pm-screen .pm-plan');
  await warte(700);
  const p = await h.seite.evaluate(() => {
    const plaene = [...document.querySelectorAll('.pm-plan')];
    const kaufen = document.querySelector('.pm-kaufen');
    return { hash: location.hash, plaene: plaene.map((b) => b.dataset.plan + ':' + b.getAttribute('aria-checked')).join(),
      preise: plaene.map((b) => b.querySelector('.pm-preis').textContent), kaufen: { aus: kaufen.disabled, text: kaufen.textContent.trim() },
      zeilen: document.querySelectorAll('.pm-vergleich [role="row"]').length, stand: document.querySelector('.pm-stand').dataset.art,
      ueber: document.scrollingElement.scrollWidth - innerWidth, text: document.querySelector('.pm-screen').textContent.replace(/\s+/g, ' '),
      klein: [...document.querySelectorAll('.pm-screen button')].filter((b) => { const r = b.getBoundingClientRect(); return r.width && (r.width < 44 || r.height < 44); }).length,
      plaeneImBild: plaene.every((b) => b.getBoundingClientRect().bottom <= innerHeight), leiste: !!document.querySelector('.reiter-leiste:not([hidden]):not(.weg)') };
  });
  pruefe('Krone oeffnet Premium (#premium): drei Plaene, Jahr vorgewaehlt', p.hash === '#premium' && p.plaene === 'monat:false,jahr:true,immer:false', JSON.stringify(p.plaene));
  pruefe('Preise nie im Code: "Preis folgt", Knopf "Bald verfügbar" gesperrt, Vorschau-Hinweis', p.preise.every((x) => x === 'Preis folgt') && p.kaufen.aus
    && p.kaufen.text === 'Bald verfügbar' && p.stand === 'vorschau', JSON.stringify({ preise: p.preise, kaufen: p.kaufen, stand: p.stand }));
  pruefe('Vergleich: Kopfzeile und 7 Zeilen', p.zeilen === 8, String(p.zeilen));
  pruefe('kein Druck, kein Betrag (nur noch, letzte Chance, Euro, Komma-Preise)', !/nur noch|letzte chance|€|\bEUR\b|\d+,\d\d/i.test(p.text), p.text.slice(0, 120));
  pruefe('Handy 390 x 844: Plaene ohne Scrollen im Bild, kein Ueberlauf, Knoepfe >= 44 px', p.plaeneImBild && p.ueber <= 0 && p.klein === 0, JSON.stringify(p));
  // Plan waehlen per Tipp und Pfeiltaste
  await h.seite.click('.pm-plan[data-plan="monat"]');
  await h.seite.keyboard.press('ArrowRight');
  const gewaehlt = await h.seite.evaluate(() => [...document.querySelectorAll('.pm-plan')].filter((b) => b.getAttribute('aria-checked') === 'true').map((b) => b.dataset.plan).join());
  pruefe('Plan per Tipp (Monat) und Pfeiltaste (weiter zu Jahr) waehlbar, immer genau einer', gewaehlt === 'jahr', gewaehlt);
  await h.seite.click('.pm-screen .haupt-kopf [data-aktion="zurueck"]');
  await h.seite.waitForSelector('.screen.arena .knoten');
  pruefe('Zurueck fuehrt in die Arena', await h.seite.evaluate(() => location.hash === '#arena' || location.hash === ''));
  pruefe('keine Konsolenfehler', h.fehler.length === 0, h.fehler.join(' | '));
  await h.kontext.close();
  // Flo 01.11.2026: "beim Abo (Premium) kann man nicht runterscrollen": auf dem iPad rollte nur die mittlere 760-px-Spalte,
  // daneben nichts. Jetzt rollt die ganze Breite (am Rand gewischt) bis zum letzten Block, die Spalte bleibt hoechstens 760 px
  for (const [w, hh, x] of [[1180, 820, 40], [820, 1180, 12]]) {
    const ip = await neueSeite(browser, { w, h: hh });
    await ip.seite.goto(BASIS + '#premium');
    await ip.seite.waitForSelector('.screen.pm-screen .pm-plan');
    await warte(500);
    await ip.seite.mouse.move(x, hh * 0.6);
    await ip.seite.mouse.wheel(0, 3000);
    await warte(500);
    const r = await ip.seite.evaluate(() => {
      const rumpf = document.querySelector('.pm-rumpf');
      const unten = rumpf.lastElementChild.getBoundingClientRect().bottom;
      const breite = Math.max(...[...rumpf.children].map((c) => c.getBoundingClientRect().width));
      return { st: Math.round(rumpf.scrollTop), max: rumpf.scrollHeight - rumpf.clientHeight, unten: Math.round(unten), H: innerHeight, breite: Math.round(breite) };
    });
    pruefe(`iPad ${w} x ${hh}: am Rand gewischt rollt die Seite bis ganz unten, Spalte hoechstens 760 px`,
      r.max > 0 && r.st >= r.max - 1 && r.unten <= r.H && r.breite <= 760, JSON.stringify(r));
    pruefe(`iPad ${w} x ${hh}: keine Konsolenfehler`, ip.fehler.length === 0, ip.fehler.join(' | '));
    await ip.kontext.close();
  }
  // Shop-Knopf mit den Paketen (ohne &kern): oeffnet "Ich" beim Bereich Shop; dort steht der Verlauf im Kopf
  const v = await neueSeite(browser, { w: 390, h: 844, handy: true });
  await v.seite.goto(`http://127.0.0.1:${PORT}/index.html?test#arena`);
  await v.seite.waitForSelector('.screen.arena .knoten');
  await v.seite.click('.haupt-kopf [data-aktion="shop"]');
  await v.seite.waitForSelector('.screen.sa-screen .sa-bereich[data-bereich="shop"]');
  const sh = await v.seite.evaluate(() => ({ bereich: document.querySelector('.screen.sa-screen').dataset.bereich,
    sichtbar: !document.querySelector('.sa-bereich[data-bereich="shop"]').hidden,
    verlauf: getComputedStyle(document.querySelector('.sa-screen .haupt-kopf [data-aktion="verlauf"]')).display }));
  pruefe('Shop oeffnet die Sammlung beim Bereich Shop, Verlauf-Knopf im Kopf von Ich', sh.bereich === 'shop' && sh.sichtbar && sh.verlauf !== 'none', JSON.stringify(sh));
  await v.seite.click('.sa-screen .haupt-kopf [data-aktion="verlauf"]');
  await v.seite.waitForSelector('.screen.vl-screen, .screen.verlauf', { timeout: 8000 }).catch(() => {});
  pruefe('Verlauf aus Ich erreichbar', await v.seite.evaluate(() => location.hash.startsWith('#verlauf')));
  pruefe('keine Konsolenfehler (mit Paketen)', v.fehler.length === 0, v.fehler.join(' | '));
  await v.kontext.close();
}

async function browserTeil(browser) {
  await testeSprunglink(browser);
  await testeLeiste(browser);
  await testeKopf(browser);
  await testePremium(browser);
  await testeTraining(browser);
  await testeBauteile(browser);
  gruppe = 'Netz';
  pruefe('keine externen Anfragen', fremd.length === 0, fremd.slice(0, 5).join(' '));
}

// =====================================================================
nodeTeil();
let code = 0;
if (!NUR_NODE) {
  let server = null;
  let browser = null;
  try {
    const { chromium } = ladePlaywright();
    server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: WURZEL, stdio: 'ignore' });
    await warteAufServer(`http://127.0.0.1:${PORT}/index.html`);
    browser = await chromium.launch();
    await browserTeil(browser);
  } catch (e) {
    pruefe('Browser-Teil lief ohne Ausnahme', false, e && (e.stack || e.message));
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (server) server.kill();
  }
}
const ok = ergebnisse.filter((e) => e.ok).length;
console.log(`\n${ok}/${ergebnisse.length} bestanden`);
if (ok !== ergebnisse.length) code = 1;
process.exit(code);
