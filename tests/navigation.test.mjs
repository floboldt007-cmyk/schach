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
const BASIS = `http://127.0.0.1:${PORT}/index.html?test`;
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
  pruefe('Zwischenreiter Verlauf in REITER_ALLE, verschwindet mit ich', /\['verlauf', 'Verlauf', 'verlauf'\]/.test(app) && /if \(aus\.has\('ich'\)\) aus\.delete\('verlauf'\)/.test(app));
  pruefe('Lage nach D5: Querformat ab 1021 px oben', /min-width: 1021px\) and \(orientation: landscape\)/.test(app));
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
  return { kontext, seite, fehler };
}

// Lage und Masse der Leiste, des Kopfs und der Pille
const lageMessen = (seite) => seite.evaluate(() => {
  const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; };
  const nav = document.querySelector('.reiter-leiste');
  const aktiv = nav && nav.querySelector('[aria-current="page"]');
  const screen = document.querySelector('#app > .screen');
  const kopf = document.querySelector('#app > .screen .haupt-kopf');
  return {
    html: document.documentElement.dataset.reiter || null,
    wurzel: document.documentElement.dataset.reiterWurzel || null,
    form: document.documentElement.dataset.reiterForm || null,
    sichtbar: !!nav && !nav.hidden && getComputedStyle(nav).display !== 'none',
    imKopf: !!nav && !!nav.closest('.haupt-kopf .kopf-reiter-platz'),
    reiter: nav ? [...nav.querySelectorAll('[data-reiter]')].map((b) => b.dataset.reiter + (b.getAttribute('aria-current') === 'page' ? '*' : '')).join() : '',
    nav: r(nav), aktiv: r(aktiv), pille: r(nav && nav.querySelector('.reiter-pille')), screen: r(screen), kopf: r(kopf),
    kopfUeber: kopf ? kopf.scrollWidth - kopf.clientWidth : null, doc: document.scrollingElement.scrollWidth - innerWidth,
    iw: innerWidth, ih: innerHeight, klasse: nav ? nav.className : '',
    reiterKlein: nav ? [...nav.querySelectorAll('.reiter')].filter((b) => b.getBoundingClientRect().width < 44 || b.getBoundingClientRect().height < 44).length : 0,
  };
});
const nah = (a, b, tol = 1.5) => Math.abs(a - b) <= tol;
const pilleUnterAktivem = (m) => !!m.pille && !!m.aktiv && nah(m.pille.l, m.aktiv.l) && nah(m.pille.w, m.aktiv.w);

async function testeLeiste(browser) {
  // ---------- ohne REITER: keine Leiste, kein Abstand ----------
  gruppe = 'Leiste ohne REITER';
  {
    const { kontext, seite, fehler } = await neueSeite(browser, { w: 1180, h: 820 });
    await seite.goto(BASIS + '#arena');
    await seite.waitForSelector('.screen.arena .knoten');
    const m = await lageMessen(seite);
    pruefe('keine Leiste, html ohne data-reiter', !m.sichtbar && !m.html, JSON.stringify({ s: m.sichtbar, h: m.html }));
    pruefe('kein zusaetzlicher Abstand: Screen so hoch wie das Fenster, Platz im Kopf leer', m.screen.h === m.ih
      && await seite.evaluate(() => { const p = document.querySelector('.kopf-reiter-platz'); return !!p && p.children.length === 0 && getComputedStyle(p).display === 'none'; }),
    JSON.stringify(m.screen));
    pruefe('Verlauf-Knopf im Kopf sichtbar (Verlauf ist kein Reiter)', await seite.locator('.haupt-kopf [data-aktion="verlauf"]').isVisible());
    pruefe('keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }

  // ---------- iPad quer (D5): oben in der Kopfzeile, Arena · Verlauf (D2) ----------
  gruppe = 'Leiste oben (1180 x 820)';
  {
    const { kontext, seite, fehler } = await neueSeite(browser, { w: 1180, h: 820 });
    await seite.goto(`${BASIS}&reiter=verlauf#arena`);
    await seite.waitForSelector('.screen.arena .knoten');
    await warte(300);
    let m = await lageMessen(seite);
    pruefe('Lage oben: html[data-reiter="oben"], Leiste in .kopf-reiter-platz des Kopfs', m.html === 'oben' && m.imKopf && m.sichtbar, JSON.stringify({ h: m.html, k: m.imKopf }));
    pruefe('Reiter Arena (aktiv) und Verlauf (Zwischenreiter, D2)', m.reiter === 'arena*,verlauf', m.reiter);
    pruefe('Leiste mittig im Kopf wie im Entwurf (Abweichung < 2 px)', Math.abs((m.nav.l + m.nav.r) / 2 - m.iw / 2) < 2, JSON.stringify(m.nav));
    pruefe('Leiste liegt ganz im Kopf', m.nav.t >= m.kopf.t && m.nav.b <= m.kopf.b + 1, JSON.stringify({ nav: m.nav, kopf: m.kopf }));
    pruefe('oben: Screen bleibt so hoch wie das Fenster', m.screen.h === m.ih, String(m.screen.h));
    pruefe('Pille unter dem aktiven Reiter', pilleUnterAktivem(m), JSON.stringify({ p: m.pille, a: m.aktiv }));
    pruefe('Kopf passt (kein Ueberlauf), Seite ohne waagrechten Ueberlauf', m.kopfUeber <= 0 && m.doc <= 0, JSON.stringify({ k: m.kopfUeber, d: m.doc }));
    pruefe('Reiter mindestens 44 x 44', m.reiterKlein === 0);
    pruefe('Verlauf ist Reiter: kein Verlauf-Knopf im Kopf', !(await seite.locator('.haupt-kopf [data-aktion="verlauf"]').isVisible()));
    // Wechsel: die Pille gleitet zum neuen Reiter
    const vorher = m.pille.l;
    await seite.locator('.reiter-leiste [data-reiter="verlauf"]').click();
    await seite.waitForSelector('.screen.vl-screen');
    const mitten = await lageMessen(seite);
    await warte(800);
    m = await lageMessen(seite);
    pruefe('Reiter Verlauf: #verlauf, aktiv, Leiste wieder oben im Kopf des Verlaufs', m.reiter === 'arena,verlauf*' && m.html === 'oben' && m.imKopf
      && await seite.evaluate(() => location.hash) === '#verlauf', JSON.stringify({ r: m.reiter, h: m.html }));
    pruefe('Pille gleitet (unterwegs zwischen alt und neu, am Ende unter Verlauf)', pilleUnterAktivem(m) && m.pille.l > vorher
      && mitten.pille.l < m.pille.l - 1, JSON.stringify({ vorher, mitten: mitten.pille && mitten.pille.l, ende: m.pille.l }));
    pruefe('auf dem Screen des Reiters: kein Zurueck-Knopf (html[data-reiter-wurzel="ja"])', m.wurzel === 'ja'
      && !(await seite.locator('.vl-screen .kopf-zurueck').isVisible()));
    // Drehen: hochkant faehrt die Leiste nach unten
    await seite.setViewportSize({ width: 820, height: 1180 });
    await seite.waitForFunction(() => document.documentElement.dataset.reiter === 'unten', null, { timeout: 3000 }).catch(() => {});
    await warte(200);
    m = await lageMessen(seite);
    pruefe('Drehen auf hochkant: Lage unten, Leiste nicht mehr im Kopf, Pille unter Verlauf', m.html === 'unten' && !m.imKopf && pilleUnterAktivem(m),
      JSON.stringify({ h: m.html, k: m.imKopf }));
    // unten: eine Meldung steht ueber der Leiste, nicht darauf
    await seite.evaluate(() => window.__app.meldung('Test-Meldung'));
    const t = await seite.evaluate(() => ({ t: document.querySelector('.toast').getBoundingClientRect().bottom, n: document.querySelector('.reiter-leiste').getBoundingClientRect().top }));
    pruefe('unten: Meldung ueber der Leiste', t.t <= t.n, JSON.stringify(t));
    await seite.setViewportSize({ width: 1180, height: 820 });
    await seite.waitForFunction(() => document.documentElement.dataset.reiter === 'oben', null, { timeout: 3000 }).catch(() => {});
    pruefe('zurueck ins Querformat: wieder oben', (await lageMessen(seite)).html === 'oben');
    // Tastatur: der Fokus folgt auf den neuen Reiter, obwohl die Leiste dabei in den Kopf des neuen Screens umzieht
    await seite.locator('.reiter-leiste [data-reiter="arena"]').focus();
    await seite.keyboard.press('Enter');
    await seite.waitForSelector('.screen.arena .knoten');
    await warte(100);
    pruefe('Tastatur: Enter auf einem Reiter, der Fokus liegt danach auf dem neuen aktiven Reiter', await seite.evaluate(() => {
      const a = document.activeElement;
      return !!a && a.matches('.reiter-leiste [data-reiter="arena"][aria-current="page"]');
    }));
    pruefe('keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }

  // ---------- passt sie oben nicht: enger, ohne Symbole ----------
  gruppe = 'Leiste oben, vier Reiter';
  {
    const { kontext, seite, fehler } = await neueSeite(browser, { w: 1180, h: 820 });
    await seite.goto(`${BASIS}&reiter=training,bestenliste,ich#arena`);
    await seite.waitForSelector('.screen.arena .knoten');
    await warte(300);
    const m = await lageMessen(seite);
    pruefe('Arena, Training, Bestenliste, Ich (ohne Verlauf, der gehoert zu Ich)', m.reiter === 'arena*,training,bestenliste,ich', m.reiter);
    pruefe('passt oben (notfalls enger oder nicht ganz mittig), Kopf ohne Ueberlauf, die zwei Chips ganz sichtbar', m.html === 'oben' && m.kopfUeber <= 0
      && await seite.evaluate(() => { const c = document.querySelector('.haupt-kopf .kopf-chips'); return c.scrollWidth <= c.clientWidth + 1; }),
    JSON.stringify({ h: m.html, k: m.klasse }));
    pruefe('Reiter mindestens 44 x 44', m.reiterKlein === 0);
    // Verlauf gehoert zu Ich: Leiste sichtbar, Ich aktiv, Zurueck bleibt
    await seite.evaluate(() => window.__app.gehe('verlauf'));
    await seite.waitForSelector('.screen.vl-screen');
    const v = await lageMessen(seite);
    pruefe('Verlauf mit Reiter Ich: Ich aktiv, Zurueck-Knopf da (Unterseite)', v.reiter.includes('ich*') && v.wurzel === 'nein'
      && await seite.locator('.vl-screen .kopf-zurueck').isVisible(), JSON.stringify({ r: v.reiter, w: v.wurzel }));
    pruefe('keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }

  // ---------- unten: iPad hoch, Handy, kleines Handy ----------
  for (const vp of [{ name: 'iPad hoch', w: 820, h: 1180, reiter: 'verlauf' }, { name: 'iPad klein quer', w: 1024, h: 768, reiter: 'verlauf' },
    { name: 'Handy 390', w: 390, h: 844, reiter: 'verlauf', handy: true }, { name: 'Handy 375 vier Reiter', w: 375, h: 667, reiter: 'training,bestenliste,ich', handy: true }]) {
    gruppe = `Leiste unten (${vp.name})`;
    const { kontext, seite, fehler } = await neueSeite(browser, vp);
    await seite.goto(`${BASIS}&reiter=${vp.reiter}#arena`);
    await seite.waitForSelector('.screen.arena .knoten');
    await warte(300);
    const m = await lageMessen(seite);
    const oben = vp.w >= 1021 && vp.w > vp.h;
    pruefe(oben ? 'quer ab 1021 px: oben' : 'Lage unten, schwebend (nicht im Kopf)', oben ? m.html === 'oben' : (m.html === 'unten' && !m.imKopf),
      JSON.stringify({ h: m.html }));
    if (!oben) {
      pruefe('schwebt ueber dem Rand (14 px Abstand) und mittig', nah(m.ih - m.nav.b, 14, 1) && Math.abs((m.nav.l + m.nav.r) / 2 - m.iw / 2) < 2,
        JSON.stringify(m.nav));
      pruefe('der Screen endet ueber der Leiste', m.screen.b <= m.nav.t + 0.5, JSON.stringify({ s: m.screen.b, n: m.nav.t }));
      // Schub 2: die Leiste kuerzt die Karte erst nach dem ersten Layout; der gewaehlte Gegner muss trotzdem ganz im Bild sein
      await warte(300);
      const g = await seite.evaluate(() => {
        const k = document.querySelector('.screen.arena .karte').getBoundingClientRect();
        const n = document.querySelector('.screen.arena .knoten.gewaehlt').getBoundingClientRect();
        return { kt: Math.round(k.top), kb: Math.round(k.bottom), nt: Math.round(n.top), nb: Math.round(n.bottom) };
      });
      pruefe('gewaehlter Gegner ganz im sichtbaren Teil der Karte (nicht unter der gekuerzten Kante)', g.nt >= g.kt - 1 && g.nb <= g.kb + 1, JSON.stringify(g));
    }
    pruefe('Pille unter dem aktiven Reiter', pilleUnterAktivem(m), JSON.stringify({ p: m.pille, a: m.aktiv }));
    pruefe('Reiter mindestens 44 x 44, Leiste im Bild', m.reiterKlein === 0 && m.nav.l >= 0 && m.nav.r <= m.iw, JSON.stringify(m.nav));
    pruefe('kein waagrechter Ueberlauf, Kopf passt', m.doc <= 0 && m.kopfUeber <= 0, JSON.stringify({ d: m.doc, k: m.kopfUeber }));
    if (vp.reiter.split(',').length > 2 && vp.w < 700) pruefe('vier Reiter auf dem Handy: gestapelt (Symbol ueber dem Wort), volle Breite', m.form === 'gestapelt' && /gestapelt/.test(m.klasse));
    const titel = await seite.evaluate(() => { const t = document.querySelector('.haupt-kopf .marke-titel'); const b = t.getBoundingClientRect();
      return { ganz: t.scrollWidth <= t.clientWidth + 1, eineZeile: b.height < 34, ellipse: getComputedStyle(t).textOverflow, text: t.textContent, r: b.right, iw: innerWidth }; });
    pruefe('Titel „Crownmate“ ganz, einzeilig, ohne Auslassungszeichen, im Bild', titel.ganz && titel.eineZeile && titel.ellipse !== 'ellipsis' && titel.r <= titel.iw,
      JSON.stringify(titel));
    pruefe('keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }

  // ---------- weg in Partie, Analyse, Einstellungen; zurueck faehrt sie ein ----------
  gruppe = 'Leiste faehrt weg';
  {
    const { kontext, seite, fehler } = await neueSeite(browser, { w: 820, h: 1180 });
    await seite.goto(`${BASIS}&reiter=verlauf#arena`);
    await seite.waitForSelector('.screen.arena .knoten');
    for (const [ziel, sel] of [['einstellungen', '.screen.es-screen'], ['analyse', '.screen.an-screen'], ['partie', '.screen.partie']]) {
      await seite.evaluate(() => window.__app.gehe('arena', {}, { ersetzen: true }));
      await seite.waitForSelector('.screen.arena .knoten');
      await seite.waitForFunction(() => { const n = document.querySelector('.reiter-leiste'); return n && !n.hidden && !n.classList.contains('weg'); });
      const params = { partie: { botId: 'benno', farbe: 'w' }, analyse: { partieId: 'gibt-es-nicht' } }[ziel] || {};
      await seite.evaluate(([z, p]) => window.__app.gehe(z, p), [ziel, params]);
      await seite.waitForSelector(sel);
      const sofort = await seite.evaluate(() => ({ html: document.documentElement.dataset.reiter || null, h: document.querySelector('#app > .screen').getBoundingClientRect().height,
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
    await seite.goto(`${BASIS}&reiter=verlauf#arena`);
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
    await seite.goto(`http://127.0.0.1:${PORT}/index.html?reiter=verlauf#arena`);
    await seite.waitForSelector('.screen.arena .knoten');
    pruefe('?reiter ohne ?test bleibt wirkungslos', await seite.evaluate(() => { const n = document.querySelector('.reiter-leiste'); return (!n || n.hidden) && !document.documentElement.dataset.reiter; }));
    await kontext.close();
  }
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

  // Handy: Mond aus (wie A), Titel ganz; viele Chips scrollen statt umzubrechen, ein Stummel wird ausgeblendet
  gruppe = 'Kopf Handy';
  const h = await neueSeite(browser, { w: 375, h: 667, handy: true });
  await h.seite.goto(BASIS + '#arena');
  await h.seite.waitForSelector('.screen.arena .knoten');
  await warte(300);
  const hk = await h.seite.evaluate(() => {
    const kopf = document.querySelector('.haupt-kopf');
    const t = kopf.querySelector('.marke-titel').getBoundingClientRect();
    const chips = kopf.querySelector('.kopf-chips');
    return { mond: getComputedStyle(kopf.querySelector('[data-aktion="modus"]')).display, titelR: t.right, titelH: t.height,
      chipsL: chips.getBoundingClientRect().left, ueber: kopf.scrollWidth - kopf.clientWidth, sterne: chips.firstElementChild.getBoundingClientRect().width <= chips.clientWidth + 1 };
  });
  pruefe('Mond auf dem Handy aus, Titel einzeilig und vor den Chips, kein Ueberlauf, Sterne-Chip ganz', hk.mond === 'none' && hk.titelH < 34
    && hk.titelR <= hk.chipsL && hk.ueber <= 0 && hk.sterne, JSON.stringify(hk));
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
    await seite.goto(`${BASIS}&erw=pakete/nav-test/index&reiter=training#training`);
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
    pruefe('Reiter Training aktiv, ohne Zurueck (Screen des Reiters)', r.reiter === 'ja' && r.aktiv && r.aktiv.reiter === 'training', JSON.stringify(r.aktiv));
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

async function browserTeil(browser) {
  await testeLeiste(browser);
  await testeKopf(browser);
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
