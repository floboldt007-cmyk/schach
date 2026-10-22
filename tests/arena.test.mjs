// Tests fuer Paket U5 des Premium-Umbaus (PLAN 2.2, 2.3, 6.3; Flo 18.10.: Arena als Weltkarte aus Entwurf C):
// Weltkarte mit zehn Stationen (js/ui/arena.js, css/arena.css), Detail-Panel, Orte auf Karte und Panel, Freischalten
// nach einem Sieg, Duell-Intro (js/ui/duell.js, css/duell.css) mit dem Vertrag zur Partie, Modern-Portraets
// (assets/avatare/modern, js/thema.js). Node-Teil ohne Browser, danach Browser-Teil (Playwright, Chromium) gegen die
// echte App (index.html?test). Die Arena-Schritte in tests/app.test.mjs und tests/e2e.test.mjs bleiben daneben gueltig.
//
//   node tests/arena.test.mjs                 alles
//   node tests/arena.test.mjs --nur-node      ohne Browser
//   node tests/arena.test.mjs --ohne-bilder   ohne Bilder
//   PORT=9100 node tests/arena.test.mjs       eigener Port (Standard 8838)
//   BILDER=<Ordner>                           Bilder dorthin (Standard design/app-shots, per .gitignore ausgeschlossen)
//
// Playwright: Pfad per Umgebungsvariable PLAYWRIGHT_PFAD, sonst 'playwright' oder /opt/node-tools.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { BOTS } from '../js/bots.js';
import { ORTE } from '../js/orte.js';
import { THEMEN, avatarVon } from '../js/thema.js';
import { duellArt, BESONDERE, DAUER_MAX } from '../js/ui/duell.js';

const require = createRequire(import.meta.url);
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8838);
const BASIS = `http://127.0.0.1:${PORT}/index.html?test`;
const NUR_NODE = process.argv.includes('--nur-node');
const bilderArg = process.argv.find((a) => a.startsWith('--bilder='));
const BILDER = process.argv.includes('--ohne-bilder') ? '' : (bilderArg ? bilderArg.slice(9) : process.env.BILDER || path.join(WURZEL, 'design', 'app-shots'));
if (BILDER) mkdirSync(BILDER, { recursive: true });
const lies = (d) => readFileSync(path.join(WURZEL, d), 'utf8');
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

const ergebnisse = [];
let gruppe = '';
function pruefe(name, ok, detail = '') {
  ergebnisse.push({ name: (gruppe ? gruppe + ': ' : '') + name, ok: !!ok, detail });
  console.log(`${ok ? 'ok  ' : 'FEHLER'} ${gruppe ? gruppe + ': ' : ''}${name}${!ok && detail ? ' (' + detail + ')' : ''}`);
}

// Fortschritt wie in app.test.mjs: vier Bots besiegt, Ritter Rudi ist der naechste Gegner
const SAAT = {
  bots: {
    benno: { sterne: [true, true, true], partien: 3, siege: 2, remis: 0, niederlagen: 1, besteGenauigkeit: 84 },
    hilde: { sterne: [true, true, false], partien: 2, siege: 1, remis: 0, niederlagen: 1, besteGenauigkeit: 81 },
    kalle: { sterne: [true, true, true], partien: 3, siege: 2, remis: 1, niederlagen: 0, besteGenauigkeit: 88 },
    lisa: { sterne: [true, false, false], partien: 3, siege: 1, remis: 0, niederlagen: 2, besteGenauigkeit: 71 },
  },
  brillanteZuege: [],
};
// nur Benno besiegt (fuer das Freischalten von Hilde)
const SAAT_BENNO = { bots: { benno: { sterne: [true, true, true], partien: 1, siege: 1, remis: 0, niederlagen: 0, besteGenauigkeit: 90 } }, brillanteZuege: [] };
// alle bis auf den Endgegner besiegt (Anlass boss)
const SAAT_BOSS = { bots: Object.fromEntries(BOTS.filter((b) => b.stufe < 10).map((b) => [b.id, { sterne: [true, true, false], partien: 1, siege: 1, remis: 0, niederlagen: 0, besteGenauigkeit: 85 }])), brillanteZuege: [] };
const IDS = BOTS.map((b) => b.id);

// =====================================================================
// Node-Teil
// =====================================================================
function nodeTeil() {
  gruppe = 'Duell-Regeln';
  pruefe('BESONDERE = boss, liga, erste (Flo D3)', JSON.stringify(BESONDERE) === JSON.stringify(['boss', 'liga', 'erste']) && Object.isFrozen(BESONDERE));
  pruefe('Hoechstdauer 1,4 s', DAUER_MAX === 1400);
  pruefe('immer -> voll (jeder Anlass)', ['boss', 'liga', 'erste', null].every((a) => duellArt({ einstellung: 'immer', anlass: a }) === 'voll'));
  pruefe('besondere -> voll nur bei boss, liga, erste, sonst kurz', ['boss', 'liga', 'erste'].every((a) => duellArt({ einstellung: 'besondere', anlass: a }) === 'voll')
    && duellArt({ einstellung: 'besondere', anlass: null }) === 'kurz' && duellArt({ einstellung: 'besondere', anlass: 'revanche' }) === 'kurz');
  pruefe('aus -> aus; reduzierte Bewegung -> aus, egal was eingestellt ist', duellArt({ einstellung: 'aus', anlass: 'boss' }) === 'aus'
    && duellArt({ einstellung: 'immer', anlass: 'boss', reduziert: true }) === 'aus' && duellArt({ einstellung: 'besondere', anlass: null, reduziert: true }) === 'aus');
  pruefe('unbekannte Einstellung wirkt wie besondere (Standard)', duellArt({ einstellung: 'xyz', anlass: 'erste' }) === 'voll' && duellArt({ einstellung: 'xyz', anlass: null }) === 'kurz' && duellArt() === 'kurz');

  gruppe = 'Portraets';
  const modern = THEMEN.modern;
  pruefe('Theme modern: zehn Portraets unter assets/avatare/modern/', modern.avatare === 'assets/avatare/modern/' && JSON.stringify([...modern.portraets]) === JSON.stringify(IDS), [...modern.portraets].join());
  const fehlend = BOTS.filter((b) => avatarVon(b) !== `assets/avatare/modern/${b.id}.svg` || !existsSync(path.join(WURZEL, `assets/avatare/modern/${b.id}.svg`)));
  pruefe('avatarVon(bot) liefert fuer jeden Leiter-Bot die Modern-Datei, und sie existiert', fehlend.length === 0, fehlend.map((b) => b.id).join());
  const kaputt = [];
  for (const b of BOTS) {
    const t = lies(`assets/avatare/modern/${b.id}.svg`);
    const gross = Buffer.byteLength(t);
    const kopf = (t.match(/^<\?xml[^>]*\?>\s*(<svg[^>]*>)/) || [])[1] || '';
    if (!/\sxmlns="http:\/\/www\.w3\.org\/2000\/svg"/.test(kopf) || !/\sviewBox="0 0 120 120"/.test(kopf) || gross < 800 || gross > 4200 || /<script|<image|href=|url\(/i.test(t)) kaputt.push(b.id + ':' + gross);
  }
  pruefe('jede Portraet-Datei: eigenstaendiges SVG (xmlns, viewBox 0 0 120 120), 0,8 bis 4 KB, ohne Skript, Bild oder Verweis', kaputt.length === 0, kaputt.join());
  pruefe('Pixel-Avatare bleiben als Rueckfall (bot.avatar zeigt weiter auf assets/avatare/<nr>-<name>.svg)', BOTS.every((b) => /^assets\/avatare\/\d\d-[a-z-]+\.svg$/.test(b.avatar) && existsSync(path.join(WURZEL, b.avatar))));

  gruppe = 'Orte';
  pruefe('arena:karte-boss und arena:karte-event sind DOM-Orte', ORTE['arena:karte-boss'] === 'dom' && ORTE['arena:karte-event'] === 'dom');
  pruefe('die vier bisherigen Arena-Orte bleiben', ORTE['arena:kopf'] === 'dom' && ORTE['arena:panel-oben'] === 'dom' && ORTE['arena:panel-bot'] === 'dom' && ORTE['arena:start'] === 'aufruf' && ORTE['arena:heute'] === 'dom');

  gruppe = 'CSS';
  const ohneKommentar = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '');
  const arena = ohneKommentar(lies('css/arena.css'));
  // Die Karte ist ein Bild und darf eigene Farben haben, aber nur als --welt-* Variablen; alles andere nimmt Tokens
  const zeilenMitHex = arena.split('\n').filter((z) => /#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(z) && !/^\s*--welt-[a-z0-9-]+:/.test(z.trim()) && !/^\s*--welt-/.test(z));
  const fremdeFarben = zeilenMitHex.filter((z) => !z.split(';').every((d) => /^\s*--welt-/.test(d) || !/#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(d)));
  pruefe('css/arena.css: feste Farben nur in --welt-* (die Karte ist ein Bild), Bedienung nur mit Tokens', fremdeFarben.length === 0, fremdeFarben.slice(0, 3).join(' | '));
  pruefe('css/arena.css: Palette hell und dunkel (Abendstimmung) fuer --welt-himmel', (arena.match(/--welt-himmel:/g) || []).length >= 3 && /data-modus="dunkel"\] \.arena/.test(arena) && /prefers-color-scheme: dark/.test(arena));
  pruefe('css/arena.css: kein Neon, kein Glow, keine Verlaeufe, keine Pixel', !/neon|glow|linear-gradient|radial-gradient|pixelated(?! *;?\s*\})/i.test(arena.replace(/image-rendering: auto/g, '')) && !/image-rendering:\s*pixelated/.test(arena));
  pruefe('css/arena.css: Atmen der aktuellen Station als CSS-Animation (pausiert ueber html[data-sichtbar="nein"] in app.css)', /\.knoten\.aktuell \.avatar \{[^}]*animation: atmen/.test(arena) && /@keyframes atmen/.test(arena)
    && /html\[data-sichtbar="nein"\] \*[^{]*\{[^}]*animation-play-state: paused/.test(ohneKommentar(lies('css/app.css'))));
  pruefe('css/arena.css: Spielen-Knopf klebt (position: sticky) im Panel', /\.cta-platz \{[^}]*position: sticky/.test(arena));
  const duell = ohneKommentar(lies('css/duell.css'));
  pruefe('css/duell.css: keine festen Farben (nur Tokens), kein Neon, kein Weichzeichner, kein Verlauf', !/#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(duell) && !/neon|glow|gradient|backdrop-filter|blur\(/i.test(duell), (duell.match(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g) || []).join());
  pruefe('css/duell.css: Naht schraeg (quer) und waagrecht (hoch), Buehne in Bot-Farbe', /polygon\(56% 0/.test(duell) && /orientation: portrait\)[\s\S]*polygon\(0 53%/.test(duell) && /\.duell-buehne \{[^}]*background: var\(--bf/.test(duell));
  const app = ohneKommentar(lies('css/app.css'));
  // Die beiden Abschnitte gehoeren U5: zwischen "SCREEN: ARENA" und "SCREEN: PARTIE" bzw. zwischen "Responsive: Arena" und
  // dem naechsten Abschnitt steht keine Regel mehr, nur der Hinweis-Kommentar. Dazu nirgends mehr eine Arena-Regel auf
  // oberster Ebene (Hooks in BASIS, "Weniger Bewegung" und den Orte-Behaeltern gehoeren anderen Abschnitten und bleiben).
  const appRoh = lies('css/app.css');
  const abschnitt = (von, bis) => { const a = appRoh.indexOf(von); const b = appRoh.indexOf(bis, a + 1); return a < 0 || b < 0 ? null : ohneKommentar(appRoh.slice(a, b)); };
  const screenArena = abschnitt('SCREEN: ARENA', 'SCREEN: PARTIE');
  const respArena = abschnitt('Responsive: Arena', 'Ergebnis-Overlay klein');
  const alteArena = appRoh.split('\n').filter((z) => /^(\.arena[ .{]|\.karte(-innen)? |\.pfad |\.knoten[ .:{]|\.fahne[ :{]|\.detail[ -.{]|\.merkmale? |\.m-(label|wert|figur)|\.ziel-sterne|\.farbwahl|\.mini-sterne|\.bilanz|\.fortsetzen|\.mehr-knopf|@keyframes (weg-zeichnen|einfaerben|rand-frei|schloss-fall|fahne-hops|name-frei|puls|ring) )/.test(z)
    && !/^\.arena \.detail > \.(ort-panel-oben|heute-karte) \{/.test(z));
  pruefe('css/app.css: Abschnitt SCREEN: ARENA und die Arena-Regeln aus Responsive: Arena sind weg (Hinweis-Kommentar auf css/arena.css bleibt)',
    screenArena != null && respArena != null && !/\{/.test(screenArena) && !/\{/.test(respArena) && alteArena.length === 0
    && /SCREEN: ARENA[^\n]*css\/arena\.css/.test(appRoh) && /Responsive: Arena[^\n]*css\/arena\.css/.test(appRoh), JSON.stringify({ screenArena, respArena, alteArena: alteArena.slice(0, 4) }));
  pruefe('index.html laedt css/arena.css und css/duell.css', /href="css\/arena\.css"/.test(lies('index.html')) && /href="css\/duell\.css"/.test(lies('index.html')));

  gruppe = 'Aufbau';
  const arenaJs = lies('js/ui/arena.js');
  pruefe('arena.js: Stationen als button.stufe.knoten[data-bot], Scroll-Behaelter .karte, Orte auf der Karte', /stufe knoten/.test(arenaJs) && /class="karte"/.test(arenaJs)
    && /fuelle\('arena:karte-boss'/.test(arenaJs) && /fuelle\('arena:karte-event'/.test(arenaJs) && /fuelle\('arena:start'/.test(arenaJs));
  pruefe('arena.js: Portraets ueber avatarVon, Flos Figur ueber floAvatar, Farbe als Segment, Duell ueber spieleDuell', /avatarVon\(/.test(arenaJs) && /floAvatar\(/.test(arenaJs) && /segment\(\{/.test(arenaJs) && /spieleDuell\(/.test(arenaJs));
  pruefe('arena.js: nach bereit app.gehe(\'partie\', ...)', /await duell\.bereit;[\s\S]{0,80}app\.gehe\('partie'/.test(arenaJs));
  const duellJs = lies('js/ui/duell.js');
  pruefe('duell.js: Vertrag (html[data-duell="laeuft"], duell:fertig, aktivesDuell, app:screen partie, Ziele .spieler.gegner .av / .spieler.ich .av, Start-Klang)',
    /dataset\.duell = 'laeuft'/.test(duellJs) && /new CustomEvent\('duell:fertig'/.test(duellJs) && /export function aktivesDuell/.test(duellJs) && /hoere\('app:screen'/.test(duellJs)
    && /\.spieler\.gegner \.av/.test(duellJs) && /\.spieler\.ich \.av/.test(duellJs) && /klang\.spiele\('start'\)/.test(duellJs));
  const sw = lies('sw.js');
  pruefe('sw.js: duell.js, arena.css, duell.css und die zehn Portraets im Cache', /'js\/ui\/duell\.js'/.test(sw) && /'css\/arena\.css'/.test(sw) && /'css\/duell\.css'/.test(sw) && IDS.every((id) => sw.includes(`'assets/avatare/modern/${id}.svg'`)));
  const alle = lies('tests/alle.mjs');
  pruefe('tests/alle.mjs: Suite arena direkt nach navigation', /name: 'navigation'[^\n]*\n\s*\{ name: 'arena', datei: 'arena\.test\.mjs'/.test(alle));
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

const IPAD_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
const fremd = [];
async function neueSeite(browser, { w = 1180, h = 820, schema = 'light', bewegung = 'no-preference', handy = false, saat = SAAT, einstellungen = null, partien = null } = {}) {
  const kontext = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: schema, reducedMotion: bewegung, deviceScaleFactor: 1,
    hasTouch: true, isMobile: handy, userAgent: handy ? IPHONE_UA : IPAD_UA });
  await kontext.addInitScript(({ f, e, p }) => {
    if (f && localStorage.getItem('schach-arena:v1:fortschritt') == null) localStorage.setItem('schach-arena:v1:fortschritt', JSON.stringify(f));
    if (e && localStorage.getItem('schach-arena:v1:einstellungen') == null) localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify(e));
    if (p && localStorage.getItem('schach-arena:v1:partien') == null) localStorage.setItem('schach-arena:v1:partien', JSON.stringify(p));
  }, { f: saat, e: einstellungen, p: partien });
  const seite = await kontext.newPage();
  const fehler = [];
  seite.on('pageerror', (e) => fehler.push('pageerror: ' + e.message));
  seite.on('console', (m) => {
    if (m.type() !== 'error') return;
    const url = (m.location() && m.location().url) || '';
    if (/favicon/.test(url)) return;
    // fehlende Paket-Screens (404) gehoeren zum Testmodus
    if (/404|Failed to fetch dynamically imported module/.test(m.text())) return;
    fehler.push('console: ' + m.text() + (url ? ' @ ' + url : ''));
  });
  seite.on('request', (r) => { if (!r.url().startsWith(`http://127.0.0.1:${PORT}/`) && !/^(data|blob):/.test(r.url())) fremd.push(r.url()); });
  return { kontext, seite, fehler };
}

async function tippe(seite, sel) {
  const el = seite.locator(sel).first();
  await el.waitFor({ state: 'visible', timeout: 10000 });
  const b = await el.boundingBox();
  if (!b) throw new Error('nicht sichtbar: ' + sel);
  await seite.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
  await warte(120);
}
async function bild(seite, name) {
  if (!BILDER) return;
  await seite.screenshot({ path: path.join(BILDER, name + '.png') });
}
const box = (seite, sel) => seite.evaluate((s) => {
  const el = document.querySelector(s);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height, iw: innerWidth, ih: innerHeight };
}, sel);
const innen = (a, b, tol = 1) => !!a && !!b && a.l >= b.l - tol && a.t >= b.t - tol && a.r <= b.r + tol && a.b <= b.b + tol;
const ueberlauf = (seite) => seite.evaluate(() => {
  const sc = document.querySelector('#app > .screen');
  const k = document.querySelector('.karte');
  return { seite: document.documentElement.scrollWidth - innerWidth, screen: sc ? sc.scrollWidth - sc.clientWidth : 0, karte: k ? k.scrollWidth - k.clientWidth : 0 };
});
// abgeschnittene Texte: Schilder auf der Karte, Namen im Panel und der Text des Spielen-Knopfs. Abgeschnitten ist ein
// Text, der ueber seine Box hinaus will und dort weggeschnitten wird (overflow nicht sichtbar oder Ellipse); ein Text
// mit sichtbarem Ueberlauf wird ueber die Lage-Pruefung unten erfasst (innerhalb der Karte, nichts ueberdeckt)
const abgeschnitten = (seite) => seite.evaluate(() => [...document.querySelectorAll('.k-schild, .k-name, .k-meta, .spielen .sp-text, .fahne, .boss-krone, .detail h2, .detail .elo, .detail-ueber')]
  .filter((el) => {
    const cs = getComputedStyle(el);
    const schneidetX = cs.overflowX !== 'visible' || cs.textOverflow === 'ellipsis';
    const schneidetY = cs.overflowY !== 'visible';
    return (schneidetX && el.scrollWidth > el.clientWidth + 1) || (schneidetY && el.scrollHeight > el.clientHeight + 2) || cs.display === 'none' && el.matches('.k-name');
  }).map((el) => el.className + ':' + el.textContent.trim()));
// Beschriftungen auf der Karte: jedes Schild, jede Fahne, Krone, Sterne-Pille und jedes Portraet liegt innerhalb der
// Karte (waagrecht im sichtbaren Ausschnitt, senkrecht in der Welt) und ueberdeckt keines einer anderen Station
const kartenLage = (seite) => seite.evaluate(() => {
  const teile = [];
  for (const kn of document.querySelectorAll('.knoten')) {
    for (const sel of ['.k-schild', '.fahne', '.boss-krone', '.k-sterne', '.avatar']) {
      const el = kn.querySelector(sel);
      if (el) teile.push({ n: kn.dataset.bot + sel, kn: kn.dataset.bot, r: el.getBoundingClientRect() });
    }
  }
  const ueber = [];
  for (let i = 0; i < teile.length; i++) {
    for (let j = i + 1; j < teile.length; j++) {
      const a = teile[i];
      const b = teile[j];
      if (a.kn === b.kn) continue;
      const x = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
      const y = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
      if (x > 1 && y > 1) ueber.push(`${a.n}/${b.n}`);
    }
  }
  const kb = document.querySelector('.karte').getBoundingClientRect();
  const wb = document.querySelector('.welt').getBoundingClientRect();
  const raus = teile.filter((x) => x.r.left < kb.left - 0.5 || x.r.right > kb.right + 0.5 || x.r.top < wb.top - 0.5 || x.r.bottom > wb.bottom + 0.5).map((x) => x.n);
  return { ueber, raus };
});
const kleineTippflaechen = (seite) => seite.evaluate(() => [...document.querySelectorAll('.arena button')]
  .filter((b) => { const r = b.getBoundingClientRect(); return r.width > 0 && (r.width < 44 || r.height < 44); }).map((b) => b.className.slice(0, 30)));

// Test-Paket fuer die Orte (wie w0-test in app.test.mjs): meldet sich an allen Arena-Orten an und protokolliert die Kontexte
const TEST_PAKET = `
import { anbieten } from '../../orte.js';
const log = window.__u5 = { kontexte: {}, start: null, startVerlassen: 0 };
for (const ort of ['arena:kopf', 'arena:panel-oben', 'arena:heute', 'arena:panel-bot', 'arena:karte-boss', 'arena:karte-event']) anbieten(ort, (k) => {
  log.kontexte[ort] = Object.keys(k).sort();
  const el = document.createElement(ort === 'arena:kopf' ? 'span' : 'div');
  el.className = 'u5-test' + (ort === 'arena:kopf' ? ' chip' : '');
  el.dataset.ort = ort;
  el.textContent = ort === 'arena:kopf' ? 'Rang' : ort === 'arena:karte-boss' ? 'Wochen-Boss' : ort === 'arena:karte-event' ? 'Event' : 'Test ' + ort;
  return el;
}, { paket: 'u5-test', reihenfolge: 50 });
anbieten('arena:start', (k) => { log.start = { schluessel: Object.keys(k).sort(), karteIstScrollBehaelter: !!(k.karte && k.karte.classList && k.karte.classList.contains('karte')), scrolleZu: typeof k.scrolleZu, neuId: k.neuId }; return { verlasse() { log.startVerlassen++; } }; }, { paket: 'u5-test' });
`;
const MIT_PAKET = `${BASIS}&erw=pakete/u5-test/index`;

// Horcher fuer das Duell: duell:fertig, jede .duell-Ueberlagerung, die je im DOM war, Flieger
const duellHorcher = (seite) => seite.evaluate(() => {
  window.__fertig = [];
  window.__duellGesehen = 0;
  window.__fliegerMax = 0;
  document.addEventListener('duell:fertig', (e) => window.__fertig.push({ ...(e.detail || {}), t: Math.round(performance.now()), attr: document.documentElement.dataset.duell || null }));
  const mo = new MutationObserver(() => {
    if (document.querySelector('.duell')) window.__duellGesehen++;
    window.__fliegerMax = Math.max(window.__fliegerMax, document.querySelectorAll('.duell-flieger').length);
  });
  mo.observe(document.body, { childList: true, subtree: true });
});
// Ziele fuer den Portraetflug in den (heutigen) Partie-Screen einsetzen, sobald er kommt (U7 baut sie spaeter selbst)
const zieleEinsetzen = (seite) => seite.evaluate(async () => {
  const { hoere } = await import('./js/ereignisse.js');
  window.__ziele = { sichtbarWaehrendFlug: null };
  hoere('app:screen', (d) => {
    if (d.name !== 'partie') return;
    const p = document.querySelector('.screen.partie');
    if (!p) return;
    for (const [rolle, top] of [['gegner', 90], ['ich', 520]]) {
      const sp = document.createElement('div');
      sp.className = 'spieler ' + rolle;
      sp.style.cssText = `position:fixed;left:${innerWidth - 120}px;top:${top}px;width:56px;height:56px;z-index:5`;
      sp.innerHTML = '<div class="av" style="width:56px;height:56px;border-radius:14px;background:var(--flaeche-2)"></div>';
      p.append(sp);
    }
  });
});

async function testeKarteQuer(browser) {
  gruppe = 'Karte quer';
  const { kontext, seite, fehler } = await neueSeite(browser, { w: 1180, h: 820 });
  await seite.goto(BASIS + '#arena');
  await seite.waitForSelector('.screen.arena .knoten');
  await warte(1500);
  pruefe('zehn Stationen button.stufe.knoten[data-bot] in Leiter-Reihenfolge', await seite.evaluate((ids) => {
    const k = [...document.querySelectorAll('.welt button.stufe.knoten[data-bot]')];
    return k.length === 10 && k.map((b) => b.dataset.bot).join() === ids.join();
  }, IDS));
  pruefe('Zustaende: 4 besiegt, Rudi aktuell, 5 gesperrt, Stockfisch .boss', await seite.evaluate(() => document.querySelectorAll('.knoten.besiegt').length === 4
    && document.querySelectorAll('.knoten.aktuell').length === 1 && !!document.querySelector('.knoten.aktuell[data-bot="rudi"]')
    && document.querySelectorAll('.knoten.gesperrt').length === 5 && !!document.querySelector('.knoten.boss[data-bot="stockfisch"]')));
  pruefe('Fahne NÄCHSTER GEGNER nur beim aktuellen, Krone ENDGEGNER beim Boss', await seite.evaluate(() => document.querySelectorAll('.knoten .fahne').length === 1
    && /NÄCHSTER GEGNER/.test(document.querySelector('.knoten.aktuell .fahne').textContent) && /ENDGEGNER/.test(document.querySelector('.knoten.boss .boss-krone').textContent)));
  pruefe('Schloss bei jeder gesperrten Station, sonst nicht', await seite.evaluate(() => [...document.querySelectorAll('.knoten')].every((k) => (k.querySelectorAll('.schloss').length === 1) === k.classList.contains('gesperrt'))));
  const f = await seite.evaluate(() => ({ g: getComputedStyle(document.querySelector('.knoten.gesperrt[data-bot="turm"] .avatar img')).filter, b: getComputedStyle(document.querySelector('.knoten.boss .avatar img')).filter,
    a: getComputedStyle(document.querySelector('.knoten.aktuell .avatar img')).filter }));
  pruefe('gesperrt: Graustufen; Endgegner gesperrt: Silhouette; aktuell: ohne Filter', /grayscale/.test(f.g) && !/brightness\(0\)/.test(f.g) && /brightness\(0\)/.test(f.b) && f.a === 'none', JSON.stringify(f));
  pruefe('Sterne nur bei besiegten (Benno 3, Hilde 2, Lisa 1), als SVG', await seite.evaluate(() => document.querySelectorAll('.knoten[data-bot="benno"] .k-sterne .stern').length === 3
    && document.querySelectorAll('.knoten[data-bot="hilde"] .k-sterne .stern').length === 2 && document.querySelectorAll('.knoten[data-bot="lisa"] .k-sterne .stern').length === 1
    && document.querySelectorAll('.knoten[data-bot="rudi"] .k-sterne').length === 0 && !!document.querySelector('.knoten[data-bot="benno"] .k-sterne svg') && !/★/.test(document.querySelector('.welt').textContent)));
  pruefe('Schild mit Name und Elo (.k-name, .k-meta)', await seite.evaluate(() => document.querySelector('.knoten[data-bot="benno"] .k-name').textContent === 'Benno' && document.querySelector('.knoten[data-bot="benno"] .k-meta').textContent === '250'
    && document.querySelector('.knoten[data-bot="turm"] .k-name').textContent === 'Prof. Turm'));
  const labels = await seite.evaluate(() => [document.querySelector('.knoten[data-bot="benno"]').getAttribute('aria-label'), document.querySelector('.knoten[data-bot="rudi"]').getAttribute('aria-label'), document.querySelector('.knoten[data-bot="turm"]').getAttribute('aria-label')]);
  pruefe('aria-label wie bisher („Stufe n: Name, Elo x, Zustand, k von 3 Sternen“)', labels[0] === 'Stufe 1: Bauer Benno, Elo 250, besiegt, 3 von 3 Sternen' && labels[1] === 'Stufe 5: Ritter Rudi, Elo 1200, nächster Gegner'
    && labels[2] === 'Stufe 6: Professor Turm, Elo 1400, gesperrt', labels.join(' | '));
  pruefe('Portraets der Stationen und des Panels aus assets/avatare/modern/', await seite.evaluate(() => [...document.querySelectorAll('.knoten .avatar img')].every((i, n) => i.src.endsWith(`/assets/avatare/modern/${document.querySelectorAll('.knoten')[n].dataset.bot}.svg`))
    && document.querySelector('.detail .detail-kopf .av img').src.endsWith('/assets/avatare/modern/rudi.svg')));
  const atmen = await seite.evaluate(() => {
    const av = document.querySelector('.knoten.aktuell .avatar');
    const vorher = { name: getComputedStyle(av).animationName, zustand: getComputedStyle(av).animationPlayState };
    document.documentElement.dataset.sichtbar = 'nein';
    const dann = getComputedStyle(av).animationPlayState;
    document.documentElement.dataset.sichtbar = 'ja';
    return { ...vorher, dann, danach: getComputedStyle(av).animationPlayState };
  });
  pruefe('aktuelle Station atmet (CSS-Animation), pausiert bei html[data-sichtbar="nein"]', atmen.name !== 'none' && atmen.zustand === 'running' && atmen.dann === 'paused' && atmen.danach === 'running', JSON.stringify(atmen));
  const lage = await seite.evaluate(() => {
    const k = document.querySelector('.karte');
    const kb = k.getBoundingClientRect();
    const boss = document.querySelector('.knoten.boss .avatar').getBoundingClientRect();
    const flo = document.querySelector('.flo-figur').getBoundingClientRect();
    const d = document.querySelector('.detail').getBoundingClientRect();
    return { klasse: document.querySelector('.arena').className, scrollH: k.scrollHeight, clientH: k.clientHeight, scrollTop: k.scrollTop, bossOben: boss.top - kb.top, bossUnten: kb.bottom - boss.bottom,
      floDrin: flo.left >= kb.left && flo.right <= kb.right && flo.top >= kb.top && flo.bottom <= kb.bottom && flo.width > 20,
      panelRechts: d.left >= kb.right, svg: !!document.querySelector('.karte svg.welt-svg'), fortschritt: !!document.querySelector('.welt-svg .w-fortschritt'),
      szene: document.querySelectorAll('.welt-svg .w-laub, .welt-svg .w-tanne, .welt-svg .w-dach, .welt-svg .w-dach-2, .welt-svg .w-dach-3, .welt-svg .w-wasser').length,
      orteLeer: document.querySelector('.ort-karte-boss').hidden && document.querySelector('.ort-karte-event').hidden };
  });
  pruefe('iPad quer: .karte-quer, Karte links passt ganz (kein Scrollen), Endgegner oben sichtbar, Panel rechts', /karte-quer/.test(lage.klasse) && lage.scrollH <= lage.clientH + 1 && lage.scrollTop === 0 && lage.bossOben >= 0 && lage.bossUnten >= 0 && lage.panelRechts, JSON.stringify(lage));
  pruefe('Welt-Zeichnung: SVG mit Baeumen, Haeusern, Wasser und Fortschritts-Pfad; Flos Figur auf der Karte', lage.svg && lage.fortschritt && lage.szene >= 12 && lage.floDrin, JSON.stringify(lage));
  pruefe('Orte auf der Karte ohne Anbieter unsichtbar', lage.orteLeer);
  const kl = await kartenLage(seite);
  pruefe('Beschriftungen innerhalb der Karte, keine ueberdeckt eine andere Station', kl.ueber.length === 0 && kl.raus.length === 0, JSON.stringify(kl));
  const ab0 = await abgeschnitten(seite);
  pruefe('kein Name und kein Schild abgeschnitten', ab0.length === 0, ab0.join(' | '));
  const himmel = await seite.evaluate(() => getComputedStyle(document.querySelector('.welt-svg .w-himmel')).fill);
  pruefe('hell: Sommerhimmel aus --welt-himmel', himmel === 'rgb(191, 224, 247)', himmel);

  gruppe = 'Panel';
  const panel = await seite.evaluate(() => {
    const d = document.querySelector('aside.detail');
    const kinder = [...d.children].map((k) => k.className.split(' ')[0]);
    const ziel = d.querySelector('.ziel-sterne');
    return { kinder, h2: d.querySelector('h2').textContent, ueber: d.querySelector('.detail-ueber').textContent, elo: d.querySelector('.elo').textContent,
      merkmale: d.querySelectorAll('.merkmal').length, ziele: d.querySelectorAll('.ziel-sterne > div').length, an: d.querySelectorAll('.ziel-sterne .an').length,
      blase: d.querySelector('.sprechblase').textContent.trim().length, segment: !!d.querySelector('.farbwahl.segment[role="radiogroup"]'),
      weiss: d.querySelectorAll('.farbwahl [data-farbe="w"][aria-checked="true"]').length, farben: [...d.querySelectorAll('.farbwahl [data-farbe]')].map((b) => b.dataset.farbe).join(),
      spielenDrin: !!d.querySelector('[data-aktion="spielen"]'), spielenText: d.querySelector('[data-aktion="spielen"]').textContent.trim(),
      botOrtNachZielen: !!ziel && ziel.nextElementSibling && ziel.nextElementSibling.classList.contains('ort-panel-bot'),
      tempo: !!d.querySelector('.ort-tempo'), bilanz: d.querySelectorAll('.bilanz b').length, miniSterne: d.querySelectorAll('.mini-sterne .stern').length,
      sternSvg: !!d.querySelector('.ziel-sterne b svg') && !/★/.test(d.textContent), ueberFarbe: getComputedStyle(d.querySelector('.detail-ueber')).color, akzentText: getComputedStyle(document.documentElement).getPropertyValue('--akzent-text').trim() };
  });
  pruefe('Kopf: Ueberzeile „Stufe 5 · Nächster Gegner“ in --akzent-text, Name, „Elo 1200 · Der Gabelritter“', panel.h2 === 'Ritter Rudi' && panel.ueber === 'Stufe 5 · Nächster Gegner' && panel.elo === 'Elo 1200 · Der Gabelritter'
    && panel.ueberFarbe === 'rgb(184, 62, 26)', JSON.stringify(panel));
  pruefe('Orte: .ort-panel-oben erstes Kind, section.heute-karte danach, .ort-panel-bot direkt nach .ziel-sterne, .ort-tempo da', panel.kinder[0] === 'ort-panel-oben' && panel.kinder[1] === 'heute-karte' && panel.botOrtNachZielen && panel.tempo, panel.kinder.join());
  pruefe('Steckbrief 3 Kacheln, Bedingungen 3 (keine erreicht), Spruch-Karte, Bilanz 4 Zahlen, Sterne als SVG', panel.merkmale === 3 && panel.ziele === 3 && panel.an === 0 && panel.blase > 5 && panel.bilanz === 4 && panel.miniSterne === 0 && panel.sternSvg, JSON.stringify(panel));
  pruefe('Farbe als Segment (bauteile.segment) mit w, zufall, b; Weiß vorgewaehlt', panel.segment && panel.farben === 'w,zufall,b' && panel.weiss === 1, panel.farben);
  pruefe('Spielen-Knopf im Panel: „Spielen gegen Ritter Rudi“', panel.spielenDrin && panel.spielenText === 'Spielen gegen Ritter Rudi', panel.spielenText);
  await tippe(seite, '.knoten[data-bot="benno"]');
  await warte(700);
  const wahl = await seite.evaluate(() => ({ h2: document.querySelector('.detail h2').textContent, ueber: document.querySelector('.detail-ueber').textContent, an: document.querySelectorAll('.ziel-sterne .an').length,
    mini: document.querySelectorAll('.mini-sterne .stern').length, spielen: document.querySelector('[data-aktion="spielen"]').textContent.trim(),
    gewaehlt: document.querySelector('.knoten.gewaehlt').dataset.bot, pressed: document.querySelector('.knoten[data-bot="benno"]').getAttribute('aria-pressed') + document.querySelector('.knoten[data-bot="rudi"]').getAttribute('aria-pressed') }));
  pruefe('Wahl einer besiegten Station aktualisiert das Panel (Benno, Besiegt, 3 Ziele erreicht, Revanche)', wahl.h2 === 'Bauer Benno' && wahl.ueber === 'Stufe 1 · Besiegt' && wahl.an === 3 && wahl.mini === 3
    && wahl.spielen === 'Revanche gegen Benno' && wahl.gewaehlt === 'benno' && wahl.pressed === 'truefalse', JSON.stringify(wahl));
  await tippe(seite, '.knoten[data-bot="turm"]');
  await seite.waitForSelector('.toast');
  const t1 = await seite.locator('.toast').innerText();
  pruefe('gesperrt direkt hinter dem aktuellen: „Besiege erst Ritter Rudi“, Panel bleibt', /Besiege erst Ritter Rudi/.test(t1) && (await seite.locator('.detail h2').innerText()) === 'Bauer Benno', t1);
  await seite.evaluate(() => { for (const t of document.querySelectorAll('.toast')) t.remove(); });
  await tippe(seite, '.knoten[data-bot="greta"]');
  await seite.waitForSelector('.toast');
  const t2 = await seite.locator('.toast').innerText();
  pruefe('gesperrt weiter oben: „Besiege zuerst Ritter Rudi“', /Besiege zuerst Ritter Rudi/.test(t2), t2);
  await tippe(seite, '.farbwahl [data-farbe="b"]');
  pruefe('Farbwahl Schwarz: aria-checked, Flos Figur zeigt den schwarzen Koenig', await seite.evaluate(() => document.querySelector('.farbwahl [data-farbe="b"]').getAttribute('aria-checked') === 'true'
    && /bK\.svg/.test(document.querySelector('.flo-figur image').getAttribute('href'))));
  await tippe(seite, '.knoten[data-bot="rudi"]');
  await warte(600);
  await bild(seite, 'arena-1180x820-hell');
  pruefe('keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
  await kontext.close();

  // dunkel: Abendstimmung
  gruppe = 'Karte dunkel';
  {
    const d = await neueSeite(browser, { w: 1180, h: 820, schema: 'dark' });
    await d.seite.goto(BASIS + '#arena');
    await d.seite.waitForSelector('.screen.arena .knoten');
    await warte(1400);
    const farben = await d.seite.evaluate(() => ({ himmel: getComputedStyle(document.querySelector('.welt-svg .w-himmel')).fill, grund: getComputedStyle(document.body).backgroundColor,
      fenster: getComputedStyle(document.querySelector('.welt-svg .w-fenster')).fill, panel: getComputedStyle(document.querySelector('.detail')).backgroundColor }));
    pruefe('dunkel: Abendhimmel, erleuchtete Fenster, Panel in --flaeche, Schiefer', farben.himmel === 'rgb(43, 53, 80)' && farben.fenster === 'rgb(242, 201, 106)' && farben.panel === 'rgb(30, 33, 38)' && farben.grund === 'rgb(21, 23, 27)', JSON.stringify(farben));
    await bild(d.seite, 'arena-1180x820-dunkel');
    pruefe('keine Konsolenfehler', d.fehler.length === 0, d.fehler.join(' | '));
    await d.kontext.close();
  }
}

async function testeOrte(browser) {
  gruppe = 'Orte';
  const { kontext, seite, fehler } = await neueSeite(browser, { w: 1180, h: 820 });
  await seite.route('**/js/pakete/u5-test/index.js', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: TEST_PAKET }));
  await seite.goto(MIT_PAKET + '#arena');
  await seite.waitForSelector('.screen.arena .knoten');
  await warte(900);
  const o = await seite.evaluate(() => {
    const d = document.querySelector('.detail');
    const el = (ort) => document.querySelector(`.u5-test[data-ort="${ort}"]`);
    const sichtbar = (e) => !!e && e.getClientRects().length > 0;
    const kb = document.querySelector('.karte').getBoundingClientRect();
    const drin = (e) => { const r = e.getBoundingClientRect(); return r.left >= kb.left && r.right <= kb.right && r.top >= kb.top && r.bottom <= kb.bottom; };
    return {
      kopf: el('arena:kopf') && el('arena:kopf').parentElement.classList.contains('kopf-chips') && el('arena:kopf').previousElementSibling.classList.contains('chip-pokal'),
      oben: el('arena:panel-oben') && el('arena:panel-oben').parentElement === d.firstElementChild && !d.firstElementChild.hidden,
      heute: el('arena:heute') && el('arena:heute').closest('section.heute-karte') === d.children[1] && !d.children[1].hidden,
      bot: el('arena:panel-bot') && el('arena:panel-bot').parentElement.classList.contains('ort-panel-bot') && el('arena:panel-bot').parentElement.previousElementSibling.classList.contains('ziel-sterne') && !el('arena:panel-bot').parentElement.hidden,
      boss: el('arena:karte-boss') && el('arena:karte-boss').parentElement.classList.contains('ort-karte-boss') && sichtbar(el('arena:karte-boss')) && drin(el('arena:karte-boss')),
      event: el('arena:karte-event') && el('arena:karte-event').parentElement.classList.contains('ort-karte-event') && sichtbar(el('arena:karte-event')) && drin(el('arena:karte-event')),
      kontexte: window.__u5.kontexte, start: window.__u5.start,
    };
  });
  pruefe('arena:kopf in .kopf-chips nach den zwei Chips', o.kopf);
  pruefe('arena:panel-oben erstes Kind, arena:heute direkt danach (sichtbar), arena:panel-bot nach .ziel-sterne', o.oben && o.heute && o.bot, JSON.stringify([o.oben, o.heute, o.bot]));
  pruefe('arena:karte-boss und arena:karte-event auf der Karte sichtbar (innerhalb der Karte)', o.boss && o.event, JSON.stringify([o.boss, o.event]));
  pruefe('Kontexte: Panel-Orte { app, bot, fortschritt }, Heute { app, bot, fortschritt, tag, woche }, Karte { app, fortschritt, karte, scrolleZu }',
    JSON.stringify(o.kontexte['arena:panel-oben']) === '["app","bot","fortschritt"]' && JSON.stringify(o.kontexte['arena:panel-bot']) === '["app","bot","fortschritt"]'
    && JSON.stringify(o.kontexte['arena:heute']) === '["app","bot","fortschritt","tag","woche"]' && JSON.stringify(o.kontexte['arena:kopf']) === '["app","fortschritt"]'
    && JSON.stringify(o.kontexte['arena:karte-boss']) === '["app","fortschritt","karte","scrolleZu"]' && JSON.stringify(o.kontexte['arena:karte-event']) === '["app","fortschritt","karte","scrolleZu"]', JSON.stringify(o.kontexte));
  pruefe('arena:start: { app, s, karte, scrolleZu, neuId }, karte ist der Scroll-Behaelter .karte', o.start && JSON.stringify(o.start.schluessel) === '["app","karte","neuId","s","scrolleZu"]' && o.start.karteIstScrollBehaelter && o.start.scrolleZu === 'function' && o.start.neuId === null, JSON.stringify(o.start));
  // Bot wechseln: Panel-Orte werden neu gefuellt, Karten-Orte bleiben; verlassen raeumt auf
  await tippe(seite, '.knoten[data-bot="kalle"]');
  await warte(700);
  const n = await seite.evaluate(() => ({ panel: document.querySelectorAll('.detail .u5-test').length, karte: document.querySelectorAll('.karte .u5-test').length, kopf: document.querySelectorAll('.kopf-chips .u5-test').length }));
  pruefe('nach dem Botwechsel: je ein Element je Ort (nichts doppelt)', n.panel === 3 && n.karte === 2 && n.kopf === 1, JSON.stringify(n));
  await seite.evaluate(() => window.__app.gehe('verlauf'));
  await seite.waitForFunction(() => document.documentElement.dataset.screen === 'verlauf');
  pruefe('arena:start wird beim Verlassen abgemeldet', await seite.evaluate(() => window.__u5.startVerlassen === 1 && document.querySelectorAll('.u5-test').length === 0));
  await bild(seite, 'arena-orte-1180x820');
  pruefe('keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
  await kontext.close();
}

async function testeHochformate(browser) {
  gruppe = 'iPad hoch';
  {
    const { kontext, seite, fehler } = await neueSeite(browser, { w: 820, h: 1180 });
    await seite.goto(BASIS + '#arena');
    await seite.waitForSelector('.screen.arena .knoten');
    await warte(1400);
    const m = await seite.evaluate(() => {
      const k = document.querySelector('.karte');
      const kb = k.getBoundingClientRect();
      const d = document.querySelector('.detail').getBoundingClientRect();
      const a = document.querySelector('.knoten.aktuell .avatar').getBoundingClientRect();
      return { klasse: document.querySelector('.arena').className, scrollbar: k.scrollHeight > k.clientHeight + 20, scrollTop: k.scrollTop, panelUnten: d.top >= kb.bottom - 1,
        aktuellDrin: a.top >= kb.top && a.bottom <= kb.bottom, zweispaltig: getComputedStyle(document.querySelector('.detail')).gridTemplateColumns.split(' ').length === 2 };
    });
    pruefe('820 × 1180: .karte-hoch, Karte oben senkrecht scrollbar und beim naechsten Gegner, Panel zweispaltig darunter', /karte-hoch/.test(m.klasse) && m.scrollbar && m.scrollTop > 0 && m.aktuellDrin && m.panelUnten && m.zweispaltig, JSON.stringify(m));
    const u = await ueberlauf(seite);
    pruefe('kein waagrechter Ueberlauf', u.seite <= 0 && u.screen <= 0 && u.karte <= 0, JSON.stringify(u));
    const kl = await kartenLage(seite);
    pruefe('Beschriftungen innerhalb der Karte, keine ueberdeckt eine andere Station', kl.ueber.length === 0 && kl.raus.length === 0, JSON.stringify(kl));
    const ab = await abgeschnitten(seite);
    pruefe('kein Name und kein Schild abgeschnitten', ab.length === 0, ab.join(' | '));
    await bild(seite, 'arena-820x1180-hell');
    // Drehen hoch -> quer (wie app.test.mjs): Karte nicht verschoben, Endgegner sichtbar
    await seite.setViewportSize({ width: 1180, height: 820 });
    await warte(900);
    const lage = await seite.evaluate(() => {
      const k = document.querySelector('.karte');
      const boss = document.querySelector('.knoten.boss .avatar').getBoundingClientRect();
      return { klasse: document.querySelector('.arena').className, scroll: k.scrollTop, bossOben: boss.top - k.getBoundingClientRect().top, passt: k.scrollHeight <= k.clientHeight + 1 };
    });
    pruefe('Drehen hoch → quer: .karte-quer, scrollTop 0, Endgegner oben sichtbar, Karte passt', /karte-quer/.test(lage.klasse) && lage.scroll === 0 && lage.bossOben >= 0 && lage.passt, JSON.stringify(lage));
    await seite.setViewportSize({ width: 820, height: 1180 });
    await warte(900);
    const zurueck = await seite.evaluate(() => { const k = document.querySelector('.karte'); const a = document.querySelector('.knoten.aktuell .avatar').getBoundingClientRect(); const kb = k.getBoundingClientRect();
      return { klasse: document.querySelector('.arena').className, aktuellDrin: a.top >= kb.top && a.bottom <= kb.bottom }; });
    pruefe('Drehen quer → hoch: wieder .karte-hoch, der naechste Gegner ist im Bild', /karte-hoch/.test(zurueck.klasse) && zurueck.aktuellDrin, JSON.stringify(zurueck));
    pruefe('keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }
  {
    const d = await neueSeite(browser, { w: 820, h: 1180, schema: 'dark' });
    await d.seite.goto(BASIS + '#arena');
    await d.seite.waitForSelector('.screen.arena .knoten');
    await warte(1400);
    await bild(d.seite, 'arena-820x1180-dunkel');
    await d.kontext.close();
  }

  // Handy: Karte senkrecht scrollbar, Spielen-Knopf sichtbar ueber der Reiter-Leiste (Testmodus ?reiter=verlauf)
  for (const vp of [{ w: 390, h: 844 }, { w: 375, h: 667 }]) {
    for (const schema of ['light', 'dark']) {
      gruppe = `Handy ${vp.w} × ${vp.h} ${schema === 'dark' ? 'dunkel' : 'hell'}`;
      const { kontext, seite, fehler } = await neueSeite(browser, { w: vp.w, h: vp.h, handy: true, schema });
      await seite.goto(BASIS + '&reiter=verlauf#arena');
      await seite.waitForSelector('.screen.arena .knoten');
      await warte(1500);
      const m = await seite.evaluate(() => {
        const k = document.querySelector('.karte');
        const kb = k.getBoundingClientRect();
        const a = document.querySelector('.knoten.aktuell .avatar').getBoundingClientRect();
        const sp = document.querySelector('.detail [data-aktion="spielen"]').getBoundingClientRect();
        const nav = document.querySelector('.reiter-leiste');
        const nb = nav ? nav.getBoundingClientRect() : null;
        return { klasse: document.querySelector('.arena').className, scrollbar: k.scrollHeight > k.clientHeight + 20, scrollTop: k.scrollTop,
          aktuellDrin: a.top >= kb.top && a.bottom <= kb.bottom, karteBreit: Math.abs(kb.width - (innerWidth - 32)) <= 1,
          spielen: { t: sp.top, b: sp.bottom, l: sp.left, r: sp.right, h: sp.height }, leiste: nb ? { t: nb.top, b: nb.bottom } : null, reiter: document.documentElement.dataset.reiter || null, ih: innerHeight, iw: innerWidth };
      });
      pruefe('Karte senkrecht scrollbar, startet beim naechsten Gegner, volle Breite', /karte-hoch/.test(m.klasse) && m.scrollbar && m.scrollTop > 0 && m.aktuellDrin && m.karteBreit, JSON.stringify(m));
      pruefe('Spielen-Knopf klebt sichtbar im Viewport, ueber der Reiter-Leiste, mindestens 56 px hoch', m.reiter === 'unten' && !!m.leiste && m.spielen.t >= 0 && m.spielen.b <= m.leiste.t && m.spielen.l >= 0 && m.spielen.r <= m.iw && m.spielen.h >= 56, JSON.stringify(m));
      // nach dem Scrollen des Panels bleibt der Knopf im Bild (sticky)
      await seite.evaluate(() => { document.querySelector('.arena .inhalt').scrollTop = 240; });
      await warte(300);
      const sp2 = await box(seite, '.detail [data-aktion="spielen"]');
      pruefe('nach dem Scrollen weiter sichtbar (sticky)', sp2 && sp2.t >= 0 && sp2.b <= m.leiste.t + 1, JSON.stringify(sp2));
      await seite.evaluate(() => { document.querySelector('.arena .inhalt').scrollTop = 0; });
      const u = await ueberlauf(seite);
      pruefe('kein waagrechter Ueberlauf', u.seite <= 0 && u.screen <= 0 && u.karte <= 0, JSON.stringify(u));
      const ab = await abgeschnitten(seite);
      pruefe('kein Name und kein Schild abgeschnitten', ab.length === 0, ab.join(' | '));
      const kl = await kartenLage(seite);
      pruefe('Beschriftungen innerhalb der Karte, keine ueberdeckt eine andere Station', kl.ueber.length === 0 && kl.raus.length === 0, JSON.stringify(kl));
      const klein = await kleineTippflaechen(seite);
      pruefe('alle Tippflaechen mindestens 44 px', klein.length === 0, klein.join(', '));
      await bild(seite, `arena-${vp.w}x${vp.h}-${schema === 'dark' ? 'dunkel' : 'hell'}`);
      pruefe('keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
      await kontext.close();
    }
  }
}

async function testeFreischalten(browser) {
  gruppe = 'Freischalten';
  {
    const { kontext, seite, fehler } = await neueSeite(browser, { w: 390, h: 844, handy: true, saat: SAAT_BENNO });
    await seite.goto(BASIS + '#arena');
    await seite.waitForSelector('.screen.arena .knoten');
    await warte(600);
    await seite.evaluate(() => {
      const t = { an: null, aus: null };
      window.__frei = t;
      const mo = new MutationObserver(() => {
        const k = document.querySelector('.knoten[data-bot="hilde"]');
        if (!k) return;
        if (t.an == null && k.classList.contains('wird-frei')) t.an = performance.now();
        if (t.an != null && t.aus == null && !k.classList.contains('wird-frei')) { t.aus = performance.now(); mo.disconnect(); }
      });
      mo.observe(document.getElementById('app'), { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
      window.__app.gehe('arena', { neuFreigeschaltet: 'hilde' });
    });
    await seite.waitForSelector('.knoten.wird-frei[data-bot="hilde"]');
    const anfang = await seite.evaluate(() => ({ schloss: document.querySelectorAll('.knoten[data-bot="hilde"] .schloss').length, aktuell: !!document.querySelector('.knoten.aktuell[data-bot="hilde"]:not(.gesperrt)'),
      panel: document.querySelector('.detail h2').textContent, fahneDa: !!document.querySelector('.knoten[data-bot="hilde"] .fahne'),
      grau: /grayscale/.test(getComputedStyle(document.querySelector('.knoten[data-bot="hilde"] .avatar img')).filter) }));
    pruefe('Beginn: .wird-frei auf Hilde, Schloss noch da, Gesicht noch grau, Hilde im Panel', anfang.schloss === 1 && anfang.aktuell && anfang.panel === 'Oma Hilde' && anfang.fahneDa && anfang.grau, JSON.stringify(anfang));
    await seite.waitForFunction(() => window.__frei.aus != null, null, { timeout: 15000 });
    const frei = await seite.evaluate(() => window.__frei);
    pruefe('Choreografie endet nach 2,7 s (nicht frueher, hoechstens 1 s spaeter)', frei.aus - frei.an >= 2650 && frei.aus - frei.an <= 3700, Math.round(frei.aus - frei.an) + ' ms');
    const ende = await seite.evaluate(async () => {
      const { klang } = await import('./js/sounds.js');
      const k = document.querySelector('.karte').getBoundingClientRect();
      const h = document.querySelector('.knoten[data-bot="hilde"] .avatar').getBoundingClientRect();
      return { schloss: document.querySelectorAll('.knoten[data-bot="hilde"] .schloss').length, sterne: document.querySelectorAll('.knoten[data-bot="benno"] .k-sterne .stern').length,
        fahne: (document.querySelector('.knoten.aktuell[data-bot="hilde"] .fahne') || {}).textContent, bunt: getComputedStyle(document.querySelector('.knoten[data-bot="hilde"] .avatar img')).filter,
        toast: [...document.querySelectorAll('.toast')].map((t) => t.textContent).join(' | '), imBild: h.top >= k.top && h.bottom <= k.bottom,
        sternKlang: klang.protokoll().some((e) => e.name === 'stern'), floX: document.querySelector('.flo-figur').style.left };
    });
    pruefe('Ende: Schloss weg, Hilde bunt mit Fahne, Benno drei Sterne, Meldung „Neu freigeschaltet“, Stern-Klang', ende.schloss === 0 && ende.sterne === 3 && /NÄCHSTER GEGNER/.test(ende.fahne || '') && ende.bunt === 'none'
      && /Neu freigeschaltet: Oma Hilde/.test(ende.toast) && ende.sternKlang, JSON.stringify(ende));
    pruefe('Handy: die Karte hat zur neuen Station gescrollt', ende.imBild, JSON.stringify(ende));
    await bild(seite, 'arena-freigeschaltet-390x844');
    pruefe('keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }
  gruppe = 'Freischalten ohne Bewegung';
  {
    const { kontext, seite, fehler } = await neueSeite(browser, { w: 1180, h: 820, saat: SAAT_BENNO, bewegung: 'reduce' });
    await seite.goto(BASIS + '#arena');
    await seite.waitForSelector('.screen.arena .knoten');
    await seite.evaluate(() => { document.querySelector('.screen.arena').dataset.alt = 'ja'; window.__app.gehe('arena', { neuFreigeschaltet: 'hilde' }); });
    await seite.waitForSelector('.screen.arena:not([data-alt]) .knoten.aktuell[data-bot="hilde"]');
    await seite.waitForFunction(() => document.querySelectorAll('.screen.arena').length === 1);
    const r = await seite.evaluate(() => ({ wirdFrei: document.querySelectorAll('.wird-frei').length, schloss: document.querySelectorAll('.knoten[data-bot="hilde"] .schloss').length,
      bunt: getComputedStyle(document.querySelector('.knoten[data-bot="hilde"] .avatar img')).filter, weg: !!document.querySelector('.welt-svg .w-fortschritt-neu') && getComputedStyle(document.querySelector('.welt-svg .w-fortschritt-neu')).opacity === '1',
      atmen: getComputedStyle(document.querySelector('.knoten.aktuell .avatar')).animationName }));
    pruefe('reduzierte Bewegung: sofort frei (kein .wird-frei, kein Schloss, Gesicht bunt, Weg sichtbar), kein Atmen', r.wirdFrei === 0 && r.schloss === 0 && r.bunt === 'none' && r.weg && r.atmen === 'none', JSON.stringify(r));
    pruefe('keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }
}

async function testeDuell(browser) {
  // immer: volle Buehne, Vertrag, Dauer, Partie danach
  gruppe = 'Duell immer';
  {
    const { kontext, seite, fehler } = await neueSeite(browser, { w: 1180, h: 820, einstellungen: { duellIntro: 'immer', klang: false } });
    await seite.goto(BASIS + '#arena');
    await seite.waitForSelector('.screen.arena .knoten');
    await warte(800);
    await duellHorcher(seite);
    await tippe(seite, '.detail [data-aktion="spielen"]');
    await seite.waitForSelector('.duell.voll', { timeout: 5000 });
    const mitte = await seite.evaluate(() => {
      const d = document.querySelector('.duell');
      const bf = getComputedStyle(document.documentElement).getPropertyValue('--bot-rudi').trim();
      const probe = document.createElement('i');
      probe.style.color = bf;
      document.body.append(probe);
      const bfRgb = getComputedStyle(probe).color;
      probe.remove();
      return { art: d.dataset.art, bot: d.dataset.bot, anlass: d.dataset.anlass, attr: document.documentElement.dataset.duell, buehne: getComputedStyle(d.querySelector('.duell-buehne')).backgroundColor, bfRgb,
        gegen: d.querySelector('.duell-gegen').textContent, botName: d.querySelector('.duell-seite.bot .duell-name').textContent, floName: d.querySelector('.duell-seite.flo .duell-name').textContent,
        unter: d.querySelector('.duell-seite.bot .duell-unter').textContent, chip: (d.querySelector('.duell-chip') || {}).textContent, naht: getComputedStyle(d.querySelector('.duell-flo i')).clipPath,
        portraet: d.querySelector('[data-rolle="bot"] img').src.endsWith('/assets/avatare/modern/rudi.svg'), koenig: /wK\.svg/.test(d.querySelector('[data-rolle="flo"] image').getAttribute('href')),
        rolle: d.getAttribute('role'), screen: document.documentElement.dataset.screen };
    });
    pruefe('Ueberlagerung .duell.voll an body: Bot-Haelfte in Bot-Farbe, „gegen“, Namen, Elo und Farben, Chip „Stufe 5 · Erste Partie“', mitte.art === 'voll' && mitte.bot === 'rudi' && mitte.anlass === 'erste' && mitte.buehne === mitte.bfRgb
      && mitte.gegen === 'gegen' && mitte.botName === 'Ritter Rudi' && mitte.floName === 'Flo' && mitte.unter === 'Elo 1200 · Schwarz' && mitte.chip === 'Stufe 5 · Erste Partie' && mitte.rolle === 'dialog', JSON.stringify(mitte));
    pruefe('Portraets: Modern-Portraet des Bots, Flos weisser Koenig; Naht schraeg (quer)', mitte.portraet && mitte.koenig && /56%/.test(mitte.naht), JSON.stringify(mitte));
    pruefe('Vertrag: html[data-duell="laeuft"] solange das Intro laeuft', mitte.attr === 'laeuft');
    await warte(300);
    await bild(seite, 'duell-1180x820-hell');
    await seite.waitForFunction(() => window.__fertig.length > 0, null, { timeout: 6000 });
    await warte(100);
    const danach = await seite.evaluate(async () => {
      const { aktivesDuell } = await import('./js/ui/duell.js');
      const { klang } = await import('./js/sounds.js');
      return { fertig: window.__fertig, duell: document.querySelectorAll('.duell').length, flieger: document.querySelectorAll('.duell-flieger').length, attr: document.documentElement.dataset.duell || null,
        screen: document.documentElement.dataset.screen, aktiv: aktivesDuell(), prot: window.__duellProtokoll, start: klang.protokoll().filter((e) => e.name === 'start').length };
    });
    pruefe('duell:fertig genau einmal (art voll, nicht uebersprungen), Attribut beim Ereignis schon weg', danach.fertig.length === 1 && danach.fertig[0].art === 'voll' && danach.fertig[0].uebersprungen === false && danach.fertig[0].attr === null, JSON.stringify(danach.fertig));
    pruefe('danach: Ueberlagerung und Flieger weg, aktivesDuell() null, Partie-Screen', danach.duell === 0 && danach.flieger === 0 && danach.attr === null && danach.screen === 'partie' && danach.aktiv === null, JSON.stringify(danach));
    pruefe('Dauer hoechstens 1,4 s (plus Last), Start-Klang genau einmal', danach.prot && danach.prot.length === 1 && danach.prot[0].dauer <= 1500 && danach.prot[0].dauer >= 1000 && danach.start === 1, JSON.stringify(danach.prot) + ' start=' + danach.start);
    await seite.waitForFunction(() => window.__partie && window.__partie.bereit === true, null, { timeout: 30000 });
    pruefe('Partie gegen Ritter Rudi laeuft', await seite.evaluate(() => JSON.parse(localStorage.getItem('schach-arena:v1:laufend') || 'null')?.botId === 'rudi'));
    pruefe('keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }
  // Hochformat: Naht waagrecht, Bild
  gruppe = 'Duell hoch';
  {
    const { kontext, seite, fehler } = await neueSeite(browser, { w: 390, h: 844, handy: true, einstellungen: { duellIntro: 'immer', klang: false } });
    await seite.goto(BASIS + '#arena');
    await seite.waitForSelector('.screen.arena .knoten');
    await warte(800);
    await duellHorcher(seite);
    await tippe(seite, '.detail [data-aktion="spielen"]');
    await seite.waitForSelector('.duell.voll', { timeout: 5000 });
    const naht = await seite.evaluate(() => ({ i: getComputedStyle(document.querySelector('.duell-flo i')).clipPath, richtung: getComputedStyle(document.querySelector('.duell-paar')).flexDirection }));
    pruefe('Hochformat: Naht waagrecht, Paar untereinander', /53%/.test(naht.i) && naht.richtung === 'column', JSON.stringify(naht));
    await warte(250);
    await bild(seite, 'duell-390x844-hell');
    await seite.waitForFunction(() => window.__fertig.length > 0, null, { timeout: 6000 });
    pruefe('endet und fuehrt zur Partie', await seite.evaluate(() => document.querySelectorAll('.duell').length === 0 && document.documentElement.dataset.screen === 'partie'));
    pruefe('keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }
  // besondere: Boss -> voll; Revanche nach einer gespeicherten Partie -> kurz
  gruppe = 'Duell besondere';
  {
    const { kontext, seite, fehler } = await neueSeite(browser, { w: 1180, h: 820, saat: SAAT_BOSS, einstellungen: { duellIntro: 'besondere', klang: false } });
    await seite.goto(BASIS + '#arena');
    await seite.waitForSelector('.screen.arena .knoten.aktuell[data-bot="stockfisch"]');
    await warte(800);
    await duellHorcher(seite);
    await tippe(seite, '.detail [data-aktion="spielen"]');
    await seite.waitForSelector('.duell.voll', { timeout: 5000 });
    const b = await seite.evaluate(() => ({ anlass: document.querySelector('.duell').dataset.anlass, chip: (document.querySelector('.duell-chip') || {}).textContent }));
    pruefe('Endgegner: Anlass boss, volle Buehne mit Chip „Stufe 10 · Endgegner“', b.anlass === 'boss' && b.chip === 'Stufe 10 · Endgegner', JSON.stringify(b));
    await seite.waitForFunction(() => window.__fertig.length > 0, null, { timeout: 6000 });
    pruefe('keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }
  {
    const partie = { id: 'u5-p1', datum: '2026-10-20T10:00:00.000Z', botId: 'rudi', botStufe: 5, spielerFarbe: 'w', startFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', zuege: ['e2e4', 'e7e5'], san: ['e4', 'e5'],
      ergebnis: 'niederlage', grund: 'aufgabe', hinweise: 0, zuruecknahmen: 0, liveKlassen: [null, null], genauigkeit: null, genauigkeitBot: null, spielstaerke: null, eroeffnung: null, sterne: [false, false, false], modus: 'normal' };
    const { kontext, seite, fehler } = await neueSeite(browser, { w: 1180, h: 820, partien: [partie], einstellungen: { duellIntro: 'besondere', klang: false } });
    await seite.goto(BASIS + '#arena');
    await seite.waitForSelector('.screen.arena .knoten.aktuell[data-bot="rudi"]');
    await warte(800);
    const erkannt = await seite.evaluate(async () => (await import('./js/storage.js')).ladePartien().some((p) => p.botId === 'rudi'));
    pruefe('Vorbedingung: eine fruehere Partie gegen Rudi ist gespeichert', erkannt);
    await duellHorcher(seite);
    await tippe(seite, '.detail [data-aktion="spielen"]');
    await seite.waitForFunction(() => window.__fertig.length > 0, null, { timeout: 6000 });
    const k = await seite.evaluate(() => ({ fertig: window.__fertig, prot: window.__duellProtokoll, voll: window.__duellGesehen, screen: document.documentElement.dataset.screen }));
    pruefe('nicht die erste Partie: Kurzfassung (art kurz, keine Buehne), Vertrag erfuellt, Partie da', k.fertig.length === 1 && k.fertig[0].art === 'kurz' && k.prot[0].art === 'kurz' && k.prot[0].dauer <= 1500 && k.screen === 'partie'
      && (await seite.evaluate(() => document.querySelectorAll('.duell.voll, .duell-buehne').length === 0)), JSON.stringify(k));
    pruefe('keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }
  // aus und reduzierte Bewegung: kein Intro, nur Start-Klang
  for (const fall of [{ name: 'Duell aus', einst: { duellIntro: 'aus', klang: false }, bewegung: 'no-preference' }, { name: 'Duell ohne Bewegung', einst: { duellIntro: 'immer', klang: false }, bewegung: 'reduce' }]) {
    gruppe = fall.name;
    const { kontext, seite, fehler } = await neueSeite(browser, { w: 1180, h: 820, einstellungen: fall.einst, bewegung: fall.bewegung });
    await seite.goto(BASIS + '#arena');
    await seite.waitForSelector('.screen.arena .knoten');
    await warte(600);
    await duellHorcher(seite);
    await tippe(seite, '.detail [data-aktion="spielen"]');
    await seite.waitForFunction(() => document.documentElement.dataset.screen === 'partie', null, { timeout: 10000 });
    await warte(300);
    const a = await seite.evaluate(async () => {
      const { klang } = await import('./js/sounds.js');
      const { aktivesDuell } = await import('./js/ui/duell.js');
      return { gesehen: window.__duellGesehen, fertig: window.__fertig.length, attr: document.documentElement.dataset.duell || null, prot: window.__duellProtokoll, start: klang.protokoll().filter((e) => e.name === 'start').length, aktiv: aktivesDuell() };
    });
    pruefe('kein Intro (keine Ueberlagerung, kein Attribut, kein Ereignis), nur der Start-Klang, Partie sofort', a.gesehen === 0 && a.fertig === 0 && a.attr === null && a.prot && a.prot[0].art === 'aus' && a.start === 1 && a.aktiv === null, JSON.stringify(a));
    pruefe('keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }
  // Tippen ueberspringt
  gruppe = 'Duell ueberspringen';
  {
    const { kontext, seite, fehler } = await neueSeite(browser, { w: 1180, h: 820, einstellungen: { duellIntro: 'immer', klang: false } });
    await seite.goto(BASIS + '#arena');
    await seite.waitForSelector('.screen.arena .knoten');
    await warte(600);
    await duellHorcher(seite);
    await tippe(seite, '.detail [data-aktion="spielen"]');
    await seite.waitForSelector('.duell.voll', { timeout: 5000 });
    await warte(150);
    await seite.touchscreen.tap(600, 400);
    await warte(80);
    const u = await seite.evaluate(() => ({ duell: document.querySelectorAll('.duell').length, attr: document.documentElement.dataset.duell || null, fertig: window.__fertig, prot: window.__duellProtokoll }));
    pruefe('Tippen: Ueberlagerung sofort weg, Attribut weg, duell:fertig mit uebersprungen', u.duell === 0 && u.attr === null && u.fertig.length === 1 && u.fertig[0].uebersprungen === true && u.prot[0].uebersprungen === true && u.prot[0].dauer < 1000, JSON.stringify(u));
    await seite.waitForFunction(() => document.documentElement.dataset.screen === 'partie' && window.__partie && window.__partie.bereit === true, null, { timeout: 30000 });
    pruefe('die Partie startet trotzdem', true);
    pruefe('keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }
  // Portraetflug auf Ziele in der Partie (hier in den Test-DOM eingesetzt; U7 baut sie)
  gruppe = 'Duell Portraetflug';
  {
    const { kontext, seite, fehler } = await neueSeite(browser, { w: 1180, h: 820, einstellungen: { duellIntro: 'immer', klang: false } });
    await seite.goto(BASIS + '#arena');
    await seite.waitForSelector('.screen.arena .knoten');
    await warte(600);
    await duellHorcher(seite);
    await zieleEinsetzen(seite);
    await tippe(seite, '.detail [data-aktion="spielen"]');
    await seite.waitForFunction(() => document.querySelectorAll('.duell-flieger').length === 2, null, { timeout: 4000 }).catch(() => {});
    const flug = await seite.evaluate(() => {
      const fl = [...document.querySelectorAll('.duell-flieger')];
      const ziele = [...document.querySelectorAll('.screen.partie .spieler .av')];
      return { flieger: fl.length, inhalt: fl.map((f) => (f.querySelector('img') ? 'img' : f.querySelector('svg') ? 'svg' : '?')).join(), versteckt: ziele.map((z) => z.style.visibility).join(), attr: document.documentElement.dataset.duell || null };
    });
    pruefe('waehrend des Flugs: zwei Flieger (Bot-Portraet, Flos Koenig), die Ziele sind verborgen, Attribut steht', flug.flieger === 2 && flug.inhalt === 'img,svg' && flug.versteckt === 'hidden,hidden' && flug.attr === 'laeuft', JSON.stringify(flug));
    await seite.waitForFunction(() => window.__fertig.length > 0, null, { timeout: 6000 });
    await warte(60);
    const nach = await seite.evaluate(() => ({ flieger: document.querySelectorAll('.duell-flieger').length, sichtbar: [...document.querySelectorAll('.screen.partie .spieler .av')].map((z) => z.style.visibility || 'sichtbar').join(), prot: window.__duellProtokoll }));
    pruefe('danach: Flieger weg, Ziele wieder sichtbar, Protokoll meldet 2 Ziele', nach.flieger === 0 && nach.sichtbar === 'sichtbar,sichtbar' && nach.prot[0].ziele === 2, JSON.stringify(nach));
    pruefe('keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }
  // Kurzfassung mit Zielen (direkt ueber das Modul) und die harte Grenze ohne Partie
  gruppe = 'Duell Modul';
  {
    const { kontext, seite, fehler } = await neueSeite(browser, { w: 1180, h: 820, einstellungen: { klang: false } });
    await seite.goto(BASIS + '#arena');
    await seite.waitForSelector('.screen.arena .knoten');
    await warte(600);
    await duellHorcher(seite);
    const r = await seite.evaluate(async () => {
      const { spieleDuell, aktivesDuell } = await import('./js/ui/duell.js');
      const { BOTS } = await import('./js/bots.js');
      const bot = BOTS.find((b) => b.id === 'rudi');
      const t0 = performance.now();
      // 1. Kurzfassung ohne Partie: bereit sofort, fertig an der harten Grenze (1,4 s)
      const d1 = spieleDuell({ bot, farbe: 'b', anlass: null, von: document.querySelector('.detail-kopf .av'), einstellung: 'besondere' });
      const bereitSofort = await Promise.race([d1.bereit.then(() => true), new Promise((res) => setTimeout(() => res(false), 100))]);
      const aktiv1 = !!aktivesDuell() && typeof aktivesDuell().fertig.then === 'function';
      const huelle = !!document.querySelector('.duell.kurz[data-art="kurz"]') && !document.querySelector('.duell-buehne');
      await d1.fertig;
      const t1 = performance.now() - t0;
      const aktiv2 = aktivesDuell();
      // 2. ueberspringe() beendet sofort
      const d2 = spieleDuell({ bot, farbe: 'w', anlass: 'boss', von: null, art: 'voll' });
      await new Promise((res) => setTimeout(res, 120));
      const lief = document.documentElement.dataset.duell === 'laeuft' && !!document.querySelector('.duell.voll');
      d2.ueberspringe();
      const sofortWeg = !document.querySelector('.duell') && document.documentElement.dataset.duell == null;
      const t2 = performance.now();
      await d2.fertig;
      // 3. zweites Intro beendet das erste
      const d3 = spieleDuell({ bot, farbe: 'w', anlass: 'erste', art: 'voll' });
      const d4 = spieleDuell({ bot: BOTS[0], farbe: 'w', anlass: 'erste', art: 'voll' });
      await new Promise((res) => setTimeout(res, 50));
      const nurEins = document.querySelectorAll('.duell').length === 1 && document.querySelector('.duell').dataset.bot === 'benno';
      const drittesFertig = await Promise.race([d3.fertig.then(() => true), new Promise((res) => setTimeout(() => res(false), 100))]);
      d4.ueberspringe();
      return { bereitSofort, aktiv1, huelle, t1: Math.round(t1), aktiv2, lief, sofortWeg, warteZeit: Math.round(performance.now() - t2), nurEins, drittesFertig, fertig: window.__fertig.map((f) => f.art + (f.uebersprungen ? '!' : '')).join(), prot: window.__duellProtokoll.map((p) => p.art + ':' + p.ziele).join() };
    });
    pruefe('Kurzfassung ohne Partie: bereit sofort, aktivesDuell() gesetzt, nur eine unsichtbare Huelle, Ende an der harten Grenze (1,4 s), danach null',
      r.bereitSofort && r.aktiv1 && r.huelle && r.t1 >= 1380 && r.t1 <= 1700 && r.aktiv2 === null, JSON.stringify(r));
    pruefe('ueberspringe(): sofort weg, fertig erfuellt sich', r.lief && r.sofortWeg && r.warteZeit < 200, JSON.stringify(r));
    pruefe('ein neues Intro beendet das laufende (hoechstens eine Ueberlagerung)', r.nurEins && r.drittesFertig && r.fertig === 'kurz,voll!,voll!,voll!', JSON.stringify(r));
    pruefe('keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }
}

async function browserTeil(browser) {
  await testeKarteQuer(browser);
  await testeOrte(browser);
  await testeHochformate(browser);
  await testeFreischalten(browser);
  await testeDuell(browser);
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
if (BILDER) console.log('Bilder: ' + BILDER);
if (ok !== ergebnisse.length) code = 1;
process.exit(code);
