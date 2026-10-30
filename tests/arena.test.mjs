// Tests fuer Paket U5 des Premium-Umbaus (PLAN 2.2, 2.3, 6.3; Flo 18.10.: Arena als Weltkarte aus Entwurf C), seit den
// Welten (Flo 23.10.) mit fuenf Welten und 30 Bots: Weltkarte mit den sechs Stationen der gewaehlten Welt und Weltwahl
// (Pfeile, gesperrte Welten, Schild NEU, Endgegner direkt herausforderbar; js/ui/arena.js, css/arena.css), Detail-Panel,
// Orte auf Karte und Panel, Freischalten nach einem Sieg, Duell-Intro (js/ui/duell.js, css/duell.css) mit dem Vertrag zur
// Partie, Modern-Portraets (assets/avatare/modern, js/thema.js). Node-Teil ohne Browser, danach Browser-Teil (Playwright,
// Chromium) gegen die echte App (index.html?test). Die Arena-Schritte in tests/app.test.mjs und tests/e2e.test.mjs bleiben
// daneben gueltig.
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
import { BOTS, WELTEN, botsDerWelt } from '../js/bots.js';
import { ORTE } from '../js/orte.js';
import { THEMEN, avatarVon } from '../js/thema.js';
import { duellArt, BESONDERE, DAUER_MAX, WECHSEL_BEI, HALTE_BIS, FLUG, FLUG_MIN, HALTE_VITRINE, DAUER_VITRINE } from '../js/ui/duell.js';

const require = createRequire(import.meta.url);
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8838);
// &kern: ohne die fest eingetragenen PAKETE und REITER (die pruefen die Integration und e2e)
const BASIS = `http://127.0.0.1:${PORT}/index.html?test&kern`;
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

// Fortschritt (Welten, Flo 23.10.): Welt 1, Willi (3 Sterne) und Lukas (2 Sterne) besiegt, Postbotin Paula ist der naechste
// Gegner (Stufe 3), Maik und Hilde sind noch gesperrt, Janine vom Scheunenclub (Endgegner der Welt) ist direkt
// herausforderbar; Welt 2 bis 5 sind gesperrt
const SAAT = {
  bots: {
    fridolin: { sterne: [true, true, true], partien: 3, siege: 2, remis: 1, niederlagen: 0, besteGenauigkeit: 88 },
    benno: { sterne: [true, true, false], partien: 2, siege: 1, remis: 0, niederlagen: 1, besteGenauigkeit: 81 },
  },
  brillanteZuege: [],
};
// nur Lukas besiegt (fuer das Freischalten von Paula): frei sind Stufe 1 bis 3 (Willi ist neu eingezogen) und Janine
const SAAT_BENNO = { bots: { benno: { sterne: [true, true, true], partien: 1, siege: 1, remis: 0, niederlagen: 0, besteGenauigkeit: 90 } }, brillanteZuege: [] };
// die ganze Welt 1 besiegt, alle Sterne (Weltsiegel): Jan (Welt 2) ist der naechste Gegner
const SAAT_WELT1 = { bots: Object.fromEntries(BOTS.filter((b) => b.welt === 1).map((b) => [b.id, { sterne: [true, true, true], partien: 1, siege: 1, remis: 0, niederlagen: 0, besteGenauigkeit: 90 }])), brillanteZuege: [] };
// alle besiegt, Sterne gemischt (Revanche gegen jeden Bot)
const SAAT_ALLE = { bots: Object.fromEntries(BOTS.map((b, i) => [b.id, { sterne: [true, i % 2 === 0, i % 3 === 0], partien: 1, siege: 1, remis: 0, niederlagen: 0, besteGenauigkeit: 85 }])), brillanteZuege: [] };
// alle bis auf den letzten Endgegner (Der Stockfisch) besiegt (Anlass boss)
const SAAT_BOSS = { bots: Object.fromEntries(BOTS.filter((b) => b.id !== 'stockfisch').map((b) => [b.id, { sterne: [true, true, false], partien: 1, siege: 1, remis: 0, niederlagen: 0, besteGenauigkeit: 85 }])), brillanteZuege: [] };
const IDS = BOTS.map((b) => b.id);
// die Bots je Welt in Leiter-Reihenfolge (fuenf Welten mit je sechs Bots)
const WELT_IDS = WELTEN.map((w) => botsDerWelt(w.nr).map((b) => b.id));
// die zehn Bots der alten Leiter haben ihr Pixel-Portraet als Rueckfall behalten
const ALTE_ZEHN = ['benno', 'hilde', 'kalle', 'lisa', 'rudi', 'turm', 'delia', 'koenig', 'greta', 'stockfisch'];

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
  // Pruefer-Befund U5: der Wechsel zur Partie kam erst am Ende der Haltephase, dem Flug blieben 160 bis 215 ms
  pruefe('Zeitplan: Wechsel zur Partie, sobald die Buehne deckt (nach ihren 460 ms), lange vor dem Flug; der volle Flug passt vor die harte Grenze',
    WECHSEL_BEI >= 460 && WECHSEL_BEI <= 520 && HALTE_BIS - WECHSEL_BEI >= 300 && FLUG >= 400 && HALTE_BIS + FLUG + 30 + 40 <= DAUER_MAX - 60 && FLUG_MIN >= 150 && FLUG_MIN < FLUG,
    JSON.stringify({ WECHSEL_BEI, HALTE_BIS, FLUG, FLUG_MIN }));
  pruefe('Vitrine (Titel oder Errungenschaften): besondere -> voll auch ohne Anlass; aus und reduziert bleiben aus',
    duellArt({ einstellung: 'besondere', anlass: null, vitrine: true }) === 'voll' && duellArt({ einstellung: 'aus', vitrine: true }) === 'aus'
    && duellArt({ einstellung: 'besondere', vitrine: true, reduziert: true }) === 'aus');
  pruefe('lange Fassung: Haltephase mindestens 3 s, Flug passt vor die harte Grenze, hoechstens 4,5 s',
    HALTE_VITRINE >= 3000 && HALTE_VITRINE + FLUG + 30 + 40 <= DAUER_VITRINE - 60 && DAUER_VITRINE <= 4500, JSON.stringify({ HALTE_VITRINE, DAUER_VITRINE }));
  pruefe('unbekannte Einstellung wirkt wie besondere (Standard)', duellArt({ einstellung: 'xyz', anlass: 'erste' }) === 'voll' && duellArt({ einstellung: 'xyz', anlass: null }) === 'kurz' && duellArt() === 'kurz');

  gruppe = 'Portraets';
  const modern = THEMEN.modern;
  pruefe('Theme modern: dreissig Portraets unter assets/avatare/modern/ (alle Bots der Leiter, jeder genau einmal)', modern.avatare === 'assets/avatare/modern/' && modern.portraets.length === 30
    && JSON.stringify([...modern.portraets].sort()) === JSON.stringify([...IDS].sort()), [...modern.portraets].join());
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
  // die zehn Bots der alten Leiter behalten ihr Pixel-Portraet als Rueckfall, die zwanzig neuen haben nur das Modern-Portraet
  pruefe('Pixel-Avatare bleiben als Rueckfall (die zehn alten Bots: bot.avatar zeigt weiter auf assets/avatare/<nr>-<name>.svg; die neuen auf ihr Modern-Portraet), alle Dateien da',
    BOTS.every((b) => (ALTE_ZEHN.includes(b.id) ? /^assets\/avatare\/\d\d-[a-z-]+\.svg$/.test(b.avatar) : b.avatar === `assets/avatare/modern/${b.id}.svg`) && existsSync(path.join(WURZEL, b.avatar))),
    BOTS.filter((b) => !existsSync(path.join(WURZEL, b.avatar))).map((b) => b.id).join());

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
  // die Keyframes heissen puls wie vor dem Umbau (tests/thema.test.mjs prueft "Bewegung aus" mit animation: puls)
  pruefe('css/arena.css: Atmen (Puls) der aktuellen Station als CSS-Animation (pausiert ueber html[data-sichtbar="nein"] in app.css)', /\.knoten\.aktuell \.avatar \{[^}]*animation: puls/.test(arena) && /@keyframes puls/.test(arena)
    && /html\[data-sichtbar="nein"\] \*[^{]*\{[^}]*animation-play-state: paused/.test(ohneKommentar(lies('css/app.css'))));
  pruefe('css/arena.css: Spielen-Knopf klebt (position: sticky) im Panel', /\.cta-platz \{[^}]*position: sticky/.test(arena));
  const spText = (arena.match(/\.spielen \.sp-text \{[^}]*\}/) || [''])[0];
  pruefe('css/arena.css: Text des Spielen-Knopfs wird nie abgeschnitten (kein overflow: hidden, keine Ellipse, darf umbrechen), der Name bleibt zusammen',
    /white-space: normal/.test(spText) && !/ellipsis|overflow: hidden|nowrap/.test(spText) && /\.spielen \.sp-name \{[^}]*white-space: nowrap/.test(arena), spText);
  pruefe('css/arena.css: kurzes Querformat (Handy quer) stellt Karte und Panel nebeneinander, das Panel scrollt selbst',
    /@media \(orientation: landscape\) and \(max-height: 559px\)[\s\S]*\.karte-hoch \.inhalt \{[^}]*grid-template-columns[\s\S]*\.karte-hoch \.detail \{[^}]*overflow-y: auto/.test(arena));
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
  pruefe('arena.js: Welten: Weltwahl mit Pfeilen (.weltwahl .ww-pfeil[data-richtung]), gesperrte Welt (.welt-sperre), Schild .k-neu, Endgegner (b.endgegner) statt fester Stufe',
    /class="ww-pfeil dr" type="button" data-richtung="-1"/.test(arenaJs) && /data-richtung="1"/.test(arenaJs) && /class="welt-sperre"/.test(arenaJs) && /class="k-neu"/.test(arenaJs)
    && /b\.endgegner \? ' boss'/.test(arenaJs) && !/stufe === 10/.test(arenaJs));
  pruefe('arena.js: Portraets ueber avatarVon, Flos Figur ueber floAvatar, Farbe als Segment, Duell ueber spieleDuell', /avatarVon\(/.test(arenaJs) && /floAvatar\(/.test(arenaJs) && /segment\(\{/.test(arenaJs) && /spieleDuell\(/.test(arenaJs));
  pruefe('arena.js: nach bereit app.gehe(\'partie\', ...)', /await duell\.bereit;[\s\S]{0,80}app\.gehe\('partie'/.test(arenaJs));
  pruefe('arena.js: laedt den Partie-Screen vorab (beim Vorwaermen und beim Tipp auf Spielen), damit er sich unter der Buehne schnell aufbaut',
    /import\('\.\/partie\.js'\)/.test(arenaJs) && /async function spielen\(b\) \{\s*ladePartieScreen\(\);/.test(arenaJs) && /ladePartieScreen\(\); \}, 900\)/.test(arenaJs));
  const duellJs = lies('js/ui/duell.js');
  pruefe('duell.js: Vertrag (html[data-duell="laeuft"], duell:fertig, aktivesDuell, app:screen partie, Ziele .spieler.gegner .av / .spieler.ich .av, Start-Klang)',
    /dataset\.duell = 'laeuft'/.test(duellJs) && /new CustomEvent\('duell:fertig'/.test(duellJs) && /export function aktivesDuell/.test(duellJs) && /hoere\('app:screen'/.test(duellJs)
    && /\.spieler\.gegner \.av/.test(duellJs) && /\.spieler\.ich \.av/.test(duellJs) && /klang\.spiele\('start'\)/.test(duellJs));
  const sw = lies('sw.js');
  pruefe('sw.js: duell.js, arena.css, duell.css und die dreissig Portraets im Cache', /'js\/ui\/duell\.js'/.test(sw) && /'css\/arena\.css'/.test(sw) && /'css\/duell\.css'/.test(sw) && IDS.every((id) => sw.includes(`'assets/avatare/modern/${id}.svg'`)));
  // die Leiter: dreissig Bots in fuenf Welten zu je sechs, Stufe = Elo / 100, der letzte jeder Welt ist der Endgegner
  pruefe('Leiter: 30 Bots in 5 Welten zu je 6, Stufe = Elo / 100, genau ein Endgegner je Welt (der letzte)', BOTS.length === 30 && WELTEN.length === 5
    && WELT_IDS.every((ids) => ids.length === 6) && BOTS.every((b, i) => b.stufe === i + 1 && b.elo === b.stufe * 100)
    && WELTEN.every((w) => { const bs = botsDerWelt(w.nr); return bs.filter((b) => b.endgegner).length === 1 && bs[5].endgegner === true; }));
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
  // Die 404-Ausnahme oben gilt nur fuer fehlende Paket-Screens: eine fehlende Datei unter assets/ (z. B. das Modern-Portraet eines
  // Bots) ist ein Fehler
  seite.on('response', (r) => { if (r.status() === 404 && /\/assets\//.test(r.url())) fehler.push('404: ' + r.url()); });
  return { kontext, seite, fehler };
}

async function tippe(seite, sel) {
  const el = seite.locator(sel).first();
  await el.waitFor({ state: 'visible', timeout: 10000 });
  // Wie ein Finger: liegt etwas ueber dem Ziel (z. B. der feste Spielen-Knopf ueber einem laengeren Panel),
  // scrollt Flo es erst in die Mitte. Bleibt es verdeckt, geht der Tipp daneben und die Pruefung scheitert.
  const verdeckt = await el.evaluate((e) => {
    const r = e.getBoundingClientRect(), oben = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return !oben || !(oben === e || e.contains(oben));
  });
  if (verdeckt) { await el.evaluate((e) => e.scrollIntoView({ block: 'center' })); await warte(150); }
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
// abgeschnittene Texte: Schilder auf der Karte, Namen im Panel, der Text des Spielen-Knopfs, Steckbrief, Bedingungen und
// die Karte "Offene Partie". Abgeschnitten ist ein Text, der ueber seine Box hinaus will: weggeschnitten (overflow nicht
// sichtbar oder Ellipse) oder aus ihr herausragend (waagrecht, auch bei sichtbarem Ueberlauf: er laege dann auf dem
// Nachbarn). Die Lage auf der Karte prueft kartenLage() unten (innerhalb der Karte, nichts ueberdeckt).
const abgeschnitten = (seite) => seite.evaluate(() => [...document.querySelectorAll('.k-schild, .k-name, .k-meta, .spielen .sp-text, .fahne, .boss-krone, .detail h2, .detail .elo, .detail-ueber, '
  + '.merkmal, .m-label, .m-wert, .ziel-sterne > div, .fortsetzen .ft-text, .fortsetzen .ft-text > *, .farbwahl .seg')]
  .filter((el) => {
    const cs = getComputedStyle(el);
    const schneidetY = cs.overflowY !== 'visible';
    return el.scrollWidth > el.clientWidth + 1 || (schneidetY && el.scrollHeight > el.clientHeight + 2) || cs.textOverflow === 'ellipsis' || cs.display === 'none' && el.matches('.k-name');
  }).map((el) => el.className + ':' + el.textContent.trim()));
// Spielen-Knopf: der Text steht ganz im Knopf (links vom Pfeil), hoechstens zwei Zeilen, der Rufname (.sp-name) ist nie
// getrennt, und der Knopf bleibt mindestens 56 px hoch
const spielenPasst = (seite) => seite.evaluate(() => {
  const sp = document.querySelector('.detail [data-aktion="spielen"]');
  const t = sp.querySelector('.sp-text');
  const b = sp.getBoundingClientRect();
  const r = t.getBoundingClientRect();
  const pf = sp.querySelector('.pf').getBoundingClientRect();
  const zeilen = Math.round(r.height / parseFloat(getComputedStyle(t).lineHeight));
  const name = t.querySelector('.sp-name');
  const fehler = [];
  if (t.scrollWidth > t.clientWidth + 1) fehler.push('zu breit');
  if (r.right > pf.left + 0.5 || r.left < b.left || r.top < b.top - 0.5 || r.bottom > b.bottom + 0.5) fehler.push('ragt heraus');
  if (zeilen > 2) fehler.push(zeilen + ' Zeilen');
  if (!name || name.getClientRects().length !== 1) fehler.push('Name getrennt');
  if (b.height < 56) fehler.push('Knopf ' + Math.round(b.height) + ' px');
  if (getComputedStyle(t).textOverflow === 'ellipsis') fehler.push('Ellipse');
  return fehler.length ? t.textContent.trim() + ': ' + fehler.join(', ') : null;
});
// Beschriftungen auf der Karte: jedes Schild, jede Fahne, Krone, Sterne-Pille, Schild NEU und jedes Portraet liegt innerhalb der
// Karte (waagrecht im sichtbaren Ausschnitt, senkrecht in der Welt) und ueberdeckt keines einer anderen Station
const kartenLage = (seite) => seite.evaluate(() => {
  const teile = [];
  for (const kn of document.querySelectorAll('.knoten')) {
    for (const sel of ['.k-schild', '.fahne', '.boss-krone', '.k-sterne', '.k-neu', '.avatar']) {
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
// Die Karte zeigt immer eine Welt: ueber die Pfeile .weltwahl .ww-pfeil zur Welt nr blaettern (liest die Nummer aus „Welt n von 5“)
async function geheZuWelt(seite, nr) {
  for (let i = 0; i < 6; i++) {
    const jetzt = await seite.evaluate(() => Number((/Welt (\d)/.exec(document.querySelector('.ww-unter').textContent) || [])[1]));
    if (jetzt === nr) return;
    await seite.evaluate((r) => document.querySelector(`.ww-pfeil[data-richtung="${r}"]`).click(), nr > jetzt ? 1 : -1);
    await warte(150);
  }
  throw new Error('Welt nicht erreicht: ' + nr);
}
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

// Passt der volle Portraetflug noch vor die harte Grenze, wenn er bei flugAb (ms ab Start) beginnt? (js/ui/duell.js: Ende
// spaetestens DAUER_MAX - 60, Flos Portraet startet 30 ms spaeter, 40 ms Nachlauf; zf = Zeitfaktor, hoechstens 1)
const vollerFlugMoeglich = (flugAb, zf) => DAUER_MAX - 60 - (flugAb + 1) - 30 * zf - 40 >= FLUG * zf;
// Horcher fuer das Duell: duell:fertig, jede .duell-Ueberlagerung, die je im DOM war, Flieger
const duellHorcher = (seite) => seite.evaluate(() => {
  window.__fertig = [];
  window.__duellGesehen = 0;
  // Last-Sonde: wie lange der Hauptfaden am Stueck blockiert war (die harte Grenze ist ein Timer und kann nicht
  // feuern, solange z. B. die Partie aufbaut; auf dem geteilten Testrechner kostet das unter Last mehrere 100 ms)
  window.__block = 0;
  let letzt = performance.now();
  setInterval(() => { const n = performance.now(); window.__block = Math.max(window.__block, n - letzt - 25); letzt = n; }, 25);
  window.__fliegerMax = 0;
  document.addEventListener('duell:fertig', (e) => window.__fertig.push({ ...(e.detail || {}), t: Math.round(performance.now()), attr: document.documentElement.dataset.duell || null }));
  const mo = new MutationObserver(() => {
    if (document.querySelector('.duell')) window.__duellGesehen++;
    const fl = [...document.querySelectorAll('.duell-flieger')];
    window.__fliegerMax = Math.max(window.__fliegerMax, fl.length);
    // erster Blick auf den Flug mit zwei Fliegern (der Flug ist kurz und unter Last noch kuerzer: festhalten statt pollen)
    if (fl.length === 2 && !window.__flugBlick) {
      window.__flugBlick = { flieger: fl.length, inhalt: fl.map((f) => (f.querySelector('img') ? 'img' : f.querySelector('svg') ? 'svg' : '?')).join(),
        // Lage der Flieger beim Abflug (Mitte und Breite; die Animation steht dabei noch auf ihrem ersten Bild)
        lage: fl.map((f) => { const r = f.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), w: Math.round(r.width) }; }),
        versteckt: [...document.querySelectorAll('.screen.partie .spieler .av')].map((z) => z.style.visibility).join(), attr: document.documentElement.dataset.duell || null };
    }
  });
  mo.observe(document.body, { childList: true, subtree: true });
});
// Ziele fuer den Portraetflug: Seit U7 baut der Partie-Screen sie selbst (.spieler.gegner .av, .spieler.ich .av); dann
// pruefen die Tests den Flug auf die echten Ziele. Nur ein Partie-Screen ohne diese Ziele bekommt Ersatz-Ziele.
const zieleEinsetzen = (seite) => seite.evaluate(async () => {
  const { hoere } = await import('./js/ereignisse.js');
  window.__ziele = { sichtbarWaehrendFlug: null, deckt: null };
  hoere('app:screen', (d) => {
    if (d.name !== 'partie') return;
    const p = document.querySelector('.screen.partie');
    if (!p) return;
    // deckt die Buehne den ganzen Schirm, wenn die Partie darunter erscheint?
    const b = document.querySelector('.duell-buehne');
    if (b) { const r = b.getBoundingClientRect(); window.__ziele.deckt = r.left <= 0.5 && r.top <= 0.5 && r.right >= innerWidth - 0.5 && r.bottom >= innerHeight - 0.5; }
    window.__ziele.echt = !!(p.querySelector('.spieler.gegner .av') && p.querySelector('.spieler.ich .av'));
    if (window.__ziele.echt) return;
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
  pruefe('sechs Stationen der Welt 1 (button.stufe.knoten[data-bot]) in Leiter-Reihenfolge, Kopfzeile „Fünf Welten, 30 Bots“', await seite.evaluate((ids) => {
    const k = [...document.querySelectorAll('.welt button.stufe.knoten[data-bot]')];
    return k.length === 6 && k.map((b) => b.dataset.bot).join() === ids.join() && document.querySelector('.logo-unter').textContent.trim() === 'Fünf Welten, 30 Bots';
  }, WELT_IDS[0]));
  pruefe('Kopf-Chips: Sterne „5 / 90“ und Besiegt „2 / 30“', await seite.evaluate(() => {
    const z = (s) => document.querySelector(s).textContent.replace(/\s+/g, ' ').trim();
    return z('.kopf-chips .chip-sterne') === 'Sterne: 5 / 90' && z('.kopf-chips .chip-pokal') === 'Besiegt: 2 / 30';
  }));
  pruefe('Zustaende: 2 besiegt, Paula aktuell, Maik und Hilde gesperrt, Janine (Endgegner) offen und .boss', await seite.evaluate(() => {
    const ids = (s) => [...document.querySelectorAll(s)].map((k) => k.dataset.bot).join();
    return ids('.knoten.besiegt') === 'fridolin,benno' && ids('.knoten.aktuell') === 'paula' && ids('.knoten.gesperrt') === 'gustav,hilde' && ids('.knoten.offen') === 'janine'
      && ids('.knoten.boss') === 'janine';
  }));
  pruefe('Fahne NÄCHSTER GEGNER nur beim aktuellen, Krone ENDGEGNER beim Boss', await seite.evaluate(() => document.querySelectorAll('.knoten .fahne').length === 1
    && /NÄCHSTER GEGNER/.test(document.querySelector('.knoten.aktuell .fahne').textContent) && document.querySelectorAll('.knoten .boss-krone').length === 1
    && /ENDGEGNER/.test(document.querySelector('.knoten.boss .boss-krone').textContent)));
  pruefe('Schloss bei jeder gesperrten Station, sonst nicht (auch nicht beim offenen Endgegner)', await seite.evaluate(() => [...document.querySelectorAll('.knoten')].every((k) => (k.querySelectorAll('.schloss').length === 1) === k.classList.contains('gesperrt'))
    && document.querySelectorAll('.knoten.gesperrt .schloss').length === 2));
  const f = await seite.evaluate(() => ({ g: getComputedStyle(document.querySelector('.knoten.gesperrt[data-bot="hilde"] .avatar img')).filter, b: getComputedStyle(document.querySelector('.knoten.boss .avatar img')).filter,
    a: getComputedStyle(document.querySelector('.knoten.aktuell .avatar img')).filter }));
  pruefe('gesperrt: Graustufen; Endgegner offen (direkt herausforderbar): sein Gesicht in Farbe, keine Silhouette; aktuell: ohne Filter', /grayscale/.test(f.g) && !/brightness\(0\)/.test(f.g) && f.b === 'none' && f.a === 'none', JSON.stringify(f));
  pruefe('Sterne nur bei besiegten (Willi 3, Lukas 2), als SVG', await seite.evaluate(() => document.querySelectorAll('.knoten[data-bot="fridolin"] .k-sterne .stern').length === 3
    && document.querySelectorAll('.knoten[data-bot="benno"] .k-sterne .stern').length === 2 && document.querySelectorAll('.knoten[data-bot="benno"] .k-sterne .aus').length === 1
    && ['paula', 'gustav', 'hilde', 'janine'].every((id) => document.querySelectorAll(`.knoten[data-bot="${id}"] .k-sterne`).length === 0)
    && !!document.querySelector('.knoten[data-bot="fridolin"] .k-sterne svg') && !/★/.test(document.querySelector('.welt').textContent)));
  pruefe('Schild mit Name und Elo (.k-name, .k-meta), Nummer der Stufe (.k-nr)', await seite.evaluate(() => document.querySelector('.knoten[data-bot="benno"] .k-name').textContent === 'Lukas' && document.querySelector('.knoten[data-bot="benno"] .k-meta').textContent === '200'
    && document.querySelector('.knoten[data-bot="hilde"] .k-name').textContent === 'Oma Hilde' && document.querySelector('.knoten[data-bot="hilde"] .k-meta').textContent === '500'
    && document.querySelector('.knoten[data-bot="fridolin"] .k-nr').textContent === '1' && document.querySelector('.knoten[data-bot="janine"] .k-nr').textContent === '6'));
  const labels = await seite.evaluate(() => ['benno', 'paula', 'hilde', 'janine'].map((id) => document.querySelector(`.knoten[data-bot="${id}"]`).getAttribute('aria-label')));
  pruefe('aria-label wie bisher („Stufe n: Name, Elo x, Zustand, k von 3 Sternen“), der offene Endgegner „direkt herausfordern“', labels[0] === 'Stufe 2: Bauer Lukas, Elo 200, besiegt, 2 von 3 Sternen' && labels[1] === 'Stufe 3: Postbotin Paula, Elo 300, nächster Gegner'
    && labels[2] === 'Stufe 5: Oma Hilde, Elo 500, gesperrt' && labels[3] === 'Stufe 6: Janine vom Scheunenclub, Elo 600, Endgegner, direkt herausfordern', labels.join(' | '));
  pruefe('Portraets der Stationen und des Panels aus assets/avatare/modern/', await seite.evaluate(() => [...document.querySelectorAll('.knoten .avatar img')].every((i, n) => i.src.endsWith(`/assets/avatare/modern/${document.querySelectorAll('.knoten')[n].dataset.bot}.svg`))
    && document.querySelector('.detail .detail-kopf .av img').src.endsWith('/assets/avatare/modern/paula.svg')));
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
      szene: document.querySelectorAll('.welt-svg g[transform]').length, aecker: document.querySelectorAll('.welt-svg .w-acker').length, baeume: document.querySelectorAll('.welt-svg .w-laub').length,
      haeuser: document.querySelectorAll('.welt-svg .w-dach, .welt-svg .w-dach-2, .welt-svg .w-dach-3').length,
      orteLeer: document.querySelector('.ort-karte-boss').hidden && document.querySelector('.ort-karte-event').hidden };
  });
  pruefe('iPad quer: .karte-quer, Karte links passt ganz (kein Scrollen), Endgegner oben sichtbar, Panel rechts', /karte-quer/.test(lage.klasse) && lage.scrollH <= lage.clientH + 1 && lage.scrollTop === 0 && lage.bossOben >= 0 && lage.bossUnten >= 0 && lage.panelRechts, JSON.stringify(lage));
  pruefe('Welt-Zeichnung der Karofelder: SVG mit Aeckern, Baeumen, Haeusern, gefuellter Szenerie und Fortschritts-Pfad; Flos Figur auf der Karte',
    lage.svg && lage.fortschritt && lage.szene >= 20 && lage.aecker >= 2 && lage.baeume >= 2 && lage.haeuser >= 2 && lage.floDrin, JSON.stringify(lage));
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
    return { kinder, h2: d.querySelector('h2').textContent, ueber: d.querySelector('.detail-ueber').textContent, elo: d.querySelector('.elo').textContent, welt: d.querySelector('.detail-welt').textContent,
      merkmale: d.querySelectorAll('.merkmal').length, ziele: d.querySelectorAll('.ziel-sterne > div').length, an: d.querySelectorAll('.ziel-sterne .an').length,
      blase: d.querySelector('.sprechblase').textContent.trim().length, segment: !!d.querySelector('.farbwahl.segment[role="radiogroup"]'),
      weiss: d.querySelectorAll('.farbwahl [data-farbe="w"][aria-checked="true"]').length, farben: [...d.querySelectorAll('.farbwahl [data-farbe]')].map((b) => b.dataset.farbe).join(),
      spielenDrin: !!d.querySelector('[data-aktion="spielen"]'), spielenText: d.querySelector('[data-aktion="spielen"]').textContent.trim(),
      botOrtNachZielen: !!ziel && ziel.nextElementSibling && ziel.nextElementSibling.classList.contains('ort-panel-bot'),
      tempo: !!d.querySelector('.ort-tempo'), bilanz: d.querySelectorAll('.bilanz b').length, miniSterne: d.querySelectorAll('.mini-sterne .stern').length,
      sternSvg: !!d.querySelector('.ziel-sterne b svg') && !/★/.test(d.textContent), ueberFarbe: getComputedStyle(d.querySelector('.detail-ueber')).color, akzentText: getComputedStyle(document.documentElement).getPropertyValue('--akzent-text').trim() };
  });
  pruefe('Kopf: Ueberzeile „Stufe 3 · Nächster Gegner“ in --akzent-text, Welt, Name, „Elo 300 · Die Eilige“', panel.h2 === 'Postbotin Paula' && panel.ueber === 'Stufe 3 · Nächster Gegner' && panel.elo === 'Elo 300 · Die Eilige'
    && panel.welt === 'Welt 1 · Die Karofelder' && panel.ueberFarbe === 'rgb(184, 62, 26)', JSON.stringify(panel));
  pruefe('Orte: .ort-panel-oben erstes Kind, section.heute-karte danach, .ort-panel-bot direkt nach .ziel-sterne, .ort-tempo da', panel.kinder[0] === 'ort-panel-oben' && panel.kinder[1] === 'heute-karte' && panel.botOrtNachZielen && panel.tempo, panel.kinder.join());
  pruefe('Steckbrief 3 Kacheln, Bedingungen 3 (keine erreicht), Spruch-Karte, Bilanz 4 Zahlen, Sterne als SVG', panel.merkmale === 3 && panel.ziele === 3 && panel.an === 0 && panel.blase > 5 && panel.bilanz === 4 && panel.miniSterne === 0 && panel.sternSvg, JSON.stringify(panel));
  pruefe('Farbe als Segment (bauteile.segment) mit w, zufall, b; Weiß vorgewaehlt', panel.segment && panel.farben === 'w,zufall,b' && panel.weiss === 1, panel.farben);
  pruefe('Spielen-Knopf im Panel: „Spielen gegen Paula“', panel.spielenDrin && panel.spielenText === 'Spielen gegen Paula', panel.spielenText);
  const waehleStation = async (id) => {
    await tippe(seite, `.knoten[data-bot="${id}"]`);
    await warte(700);
    return seite.evaluate((i) => ({ h2: document.querySelector('.detail h2').textContent, ueber: document.querySelector('.detail-ueber').textContent, an: document.querySelectorAll('.ziel-sterne .an').length,
      mini: document.querySelectorAll('.mini-sterne .stern').length, spielen: document.querySelector('[data-aktion="spielen"]').textContent.trim(),
      gewaehlt: document.querySelector('.knoten.gewaehlt').dataset.bot, pressed: document.querySelector(`.knoten[data-bot="${i}"]`).getAttribute('aria-pressed') + document.querySelector('.knoten[data-bot="paula"]').getAttribute('aria-pressed') }), id);
  };
  const wahl = await waehleStation('benno');
  pruefe('Wahl einer besiegten Station aktualisiert das Panel (Lukas, Besiegt, 2 Ziele erreicht, Revanche)', wahl.h2 === 'Bauer Lukas' && wahl.ueber === 'Stufe 2 · Besiegt' && wahl.an === 2 && wahl.mini === 2
    && wahl.spielen === 'Revanche gegen Lukas' && wahl.gewaehlt === 'benno' && wahl.pressed === 'truefalse', JSON.stringify(wahl));
  const wahl3 = await waehleStation('fridolin');
  pruefe('alle drei Ziele erreicht (Willi, 3 Sterne, Revanche)', wahl3.h2 === 'Vogelscheuche Willi' && wahl3.ueber === 'Stufe 1 · Besiegt' && wahl3.an === 3 && wahl3.mini === 3
    && wahl3.spielen === 'Revanche gegen Willi' && wahl3.gewaehlt === 'fridolin' && wahl3.pressed === 'truefalse', JSON.stringify(wahl3));
  await tippe(seite, '.knoten[data-bot="gustav"]');
  await seite.waitForSelector('.toast');
  const t1 = await seite.locator('.toast').innerText();
  pruefe('gesperrt direkt hinter dem aktuellen: „Besiege erst Postbotin Paula“, Panel bleibt', /Besiege erst Postbotin Paula/.test(t1) && (await seite.locator('.detail h2').innerText()) === 'Vogelscheuche Willi', t1);
  await seite.evaluate(() => { for (const t of document.querySelectorAll('.toast')) t.remove(); });
  await tippe(seite, '.knoten[data-bot="hilde"]');
  await seite.waitForSelector('.toast');
  const t2 = await seite.locator('.toast').innerText();
  pruefe('gesperrt weiter oben: „Besiege zuerst Postbotin Paula“', /Besiege zuerst Postbotin Paula/.test(t2), t2);
  await tippe(seite, '.farbwahl [data-farbe="b"]');
  pruefe('Farbwahl Schwarz: aria-checked, Flos Figur zeigt den schwarzen Koenig', await seite.evaluate(() => document.querySelector('.farbwahl [data-farbe="b"]').getAttribute('aria-checked') === 'true'
    && /bK\.svg/.test(document.querySelector('.flo-figur image').getAttribute('href'))));
  await tippe(seite, '.knoten[data-bot="paula"]');
  await warte(600);
  // Meldungen der Sperr-Tipps vor dem Bild entfernen (sonst verdecken sie Schilder am unteren Kartenrand)
  await seite.evaluate(() => { for (const t of document.querySelectorAll('.toast')) t.remove(); });
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
    // Pruefer-Befund U5: der schwarze Koenig der Farbwahl war auf dem dunklen Segment kaum zu sehen. Jetzt stehen die
    // Figuren auf einem hellen Feld; Kontrast schwarzer Koenig (#000) zu diesem Feld mindestens 7:1
    const felder = await d.seite.evaluate(() => [...document.querySelectorAll('.farbwahl .seg')].map((k) => {
      const f = k.querySelector('.fig-bg');
      const rgb = f ? getComputedStyle(f).backgroundColor.match(/[\d.]+/g).map(Number) : [0, 0, 0];
      const l = (x) => { const c = x / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
      const L = 0.2126 * l(rgb[0]) + 0.7152 * l(rgb[1]) + 0.0722 * l(rgb[2]);
      return { farbe: k.dataset.farbe, figuren: f ? f.querySelectorAll('img').length : 0, kontrast: Math.round((L + 0.05) / 0.05 * 10) / 10 };
    }));
    pruefe('dunkel: Figuren der Farbwahl auf hellem Feld, der schwarze Koenig ist lesbar (Kontrast mindestens 7:1)', felder.length === 3 && felder.every((x) => x.figuren >= 1 && x.kontrast >= 7)
      && felder.map((x) => x.figuren).join() === '1,2,1', JSON.stringify(felder));
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
  await tippe(seite, '.knoten[data-bot="benno"]');
  await warte(700);
  const n = await seite.evaluate(() => ({ panel: document.querySelectorAll('.detail .u5-test').length, karte: document.querySelectorAll('.karte .u5-test').length, kopf: document.querySelectorAll('.kopf-chips .u5-test').length }));
  pruefe('nach dem Botwechsel: je ein Element je Ort (nichts doppelt)', n.panel === 3 && n.karte === 2 && n.kopf === 1, JSON.stringify(n));
  await bild(seite, 'arena-orte-1180x820');
  await seite.evaluate(() => window.__app.gehe('verlauf'));
  await seite.waitForFunction(() => document.documentElement.dataset.screen === 'verlauf');
  pruefe('arena:start wird beim Verlassen abgemeldet', await seite.evaluate(() => window.__u5.startVerlassen === 1 && document.querySelectorAll('.u5-test').length === 0));
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

  // Der ruhige Zieh-Hinweis erscheint auf dem Handy genau einmal und merkt die erste Geste dauerhaft.
  gruppe = 'Handy Zieh-Hinweis';
  {
    const { kontext, seite, fehler } = await neueSeite(browser, { w: 390, h: 844, handy: true });
    await seite.goto(BASIS + '#arena');
    await seite.waitForSelector('.karte-zieh-hinweis:not([hidden])');
    pruefe('erster Besuch zeigt „Karte ziehen“', (await seite.locator('.karte-zieh-hinweis').innerText()).trim() === 'Karte ziehen');
    const kb = await seite.locator('.karte').boundingBox();
    await seite.touchscreen.tap(kb.x + kb.width / 2, kb.y + kb.height / 2);
    await seite.dispatchEvent('.karte', 'pointerdown', { pointerId: 1, isPrimary: true, clientX: kb.x + kb.width / 2, clientY: kb.y + 180 });
    await seite.dispatchEvent('.karte', 'pointermove', { pointerId: 1, isPrimary: true, clientX: kb.x + kb.width / 2, clientY: kb.y + 140 });
    await seite.dispatchEvent('.karte', 'pointerup', { pointerId: 1, isPrimary: true, clientX: kb.x + kb.width / 2, clientY: kb.y + 140 });
    await seite.waitForFunction(() => document.querySelector('.karte-zieh-hinweis')?.hasAttribute('hidden'));
    const gemerkt = await seite.evaluate(() => JSON.parse(localStorage.getItem('schach-arena:v1:einstellungen')).arenaKarteHinweis);
    pruefe('nach dem ersten Ziehen verschwindet der Hinweis und der erweiterte Einstellungsstand merkt ihn', gemerkt === true);
    await seite.reload();
    await seite.waitForSelector('.screen.arena .knoten');
    pruefe('nach einem Neuladen kommt der Hinweis nicht wieder', await seite.locator('.karte-zieh-hinweis:not([hidden])').count() === 0);
    pruefe('keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
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
      // eine Meldung (z. B. "Besiege erst …") steht ueber dem klebenden Spielen-Knopf, nicht darauf
      await seite.evaluate(() => window.__app.meldung('Test-Meldung'));
      await seite.waitForSelector('.toast');
      await warte(400);
      const tm = await seite.evaluate(() => ({ t: document.querySelector('.toast').getBoundingClientRect().bottom, sp: document.querySelector('.detail [data-aktion="spielen"]').getBoundingClientRect().top }));
      pruefe('eine Meldung steht ueber dem Spielen-Knopf', tm.t <= tm.sp, JSON.stringify(tm));
      await seite.evaluate(() => { for (const x of document.querySelectorAll('.toast')) x.remove(); });
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

// Handy quer (Pruefer-Befund U5: bei 844 × 390 lag der Spielen-Knopf unter dem Bildrand, sticky griff nicht): Karte
// links, Panel rechts mit eigenem Scrollen, der Knopf klebt unten im Panel und ist ohne Scrollen zu sehen
async function testeHandyQuer(browser) {
  for (const vp of [{ w: 844, h: 390, schema: 'light' }, { w: 667, h: 375, schema: 'dark' }]) {
    gruppe = `Handy quer ${vp.w} × ${vp.h} ${vp.schema === 'dark' ? 'dunkel' : 'hell'}`;
    const { kontext, seite, fehler } = await neueSeite(browser, { w: vp.w, h: vp.h, handy: true, schema: vp.schema });
    await seite.goto(BASIS + '&reiter=verlauf#arena');
    await seite.waitForSelector('.screen.arena .knoten');
    await warte(1500);
    const m = await seite.evaluate(() => {
      const k = document.querySelector('.karte');
      const kb = k.getBoundingClientRect();
      const d = document.querySelector('.detail').getBoundingClientRect();
      const kn = document.querySelector('.knoten.aktuell');
      const teile = [kn, kn.querySelector('.k-schild'), kn.querySelector('.fahne')].map((t) => t.getBoundingClientRect());
      const sp = document.querySelector('.detail [data-aktion="spielen"]').getBoundingClientRect();
      const nb = document.querySelector('.reiter-leiste').getBoundingClientRect();
      return { klasse: document.querySelector('.arena').className, scrollbar: k.scrollHeight > k.clientHeight + 20, nebeneinander: d.left >= kb.right - 1 && Math.abs(d.top - kb.top) <= 2,
        aktuellDrin: teile.every((r) => r.top >= kb.top - 1 && r.bottom <= kb.bottom + 1), panelScrollt: getComputedStyle(document.querySelector('.detail')).overflowY === 'auto',
        spielen: { t: sp.top, b: sp.bottom, l: sp.left, r: sp.right, h: sp.height }, leiste: { t: nb.top }, reiter: document.documentElement.dataset.reiter || null, iw: innerWidth };
    });
    pruefe('Karte links (senkrecht scrollbar, beim naechsten Gegner samt Schild und Fahne), Panel rechts daneben und scrollt selbst', /karte-hoch/.test(m.klasse) && m.scrollbar && m.nebeneinander && m.aktuellDrin && m.panelScrollt, JSON.stringify(m));
    pruefe('Spielen-Knopf ohne Scrollen sichtbar, ueber der Reiter-Leiste, mindestens 56 px hoch', m.reiter === 'unten' && m.spielen.t >= 0 && m.spielen.b <= m.leiste.t && m.spielen.l >= 0 && m.spielen.r <= m.iw && m.spielen.h >= 56, JSON.stringify(m));
    await seite.evaluate(() => { document.querySelector('.detail').scrollTop = 160; });
    await warte(300);
    const sp2 = await box(seite, '.detail [data-aktion="spielen"]');
    pruefe('nach dem Scrollen des Panels weiter sichtbar (sticky)', sp2 && sp2.t >= 0 && sp2.b <= m.leiste.t + 1, JSON.stringify(sp2));
    await seite.evaluate(() => { document.querySelector('.detail').scrollTop = 0; window.__app.meldung('Test-Meldung'); });
    await seite.waitForSelector('.toast');
    await warte(400);
    const tm = await seite.evaluate(() => ({ t: document.querySelector('.toast').getBoundingClientRect().bottom, sp: document.querySelector('.detail [data-aktion="spielen"]').getBoundingClientRect().top }));
    pruefe('eine Meldung steht ueber dem Spielen-Knopf', tm.t <= tm.sp, JSON.stringify(tm));
    await seite.evaluate(() => { for (const x of document.querySelectorAll('.toast')) x.remove(); });
    const u = await ueberlauf(seite);
    pruefe('kein waagrechter Ueberlauf', u.seite <= 0 && u.screen <= 0 && u.karte <= 0, JSON.stringify(u));
    const ab = await abgeschnitten(seite);
    pruefe('kein Name und kein Schild abgeschnitten', ab.length === 0, ab.join(' | '));
    const kl = await kartenLage(seite);
    pruefe('Beschriftungen innerhalb der Karte, keine ueberdeckt eine andere Station', kl.ueber.length === 0 && kl.raus.length === 0, JSON.stringify(kl));
    const klein = await kleineTippflaechen(seite);
    pruefe('alle Tippflaechen mindestens 44 px', klein.length === 0, klein.join(', '));
    await bild(seite, `arena-${vp.w}x${vp.h}-${vp.schema === 'dark' ? 'dunkel' : 'hell'}`);
    pruefe('keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }
}

// Pruefer-Befund U5 (blockierend): der Text des Spielen-Knopfs wurde gekuerzt ("Spielen gegen den Stockfis…" auf dem
// Handy, "Revanche gegen Tobias" auf dem iPad), geprueft war nur ein Bot. Jetzt alle 30 Bots in beiden Fassungen
// in allen Ziel-Lagen: echte Panels (alle besiegt, Welt fuer Welt jede Station antippen: "Revanche gegen …") und der
// Spielen-Text jedes Bots im echten Knopf (spielenText aus js/ui/arena.js, dieselbe Funktion wie im Panel)
async function testeKnopftext(browser) {
  for (const vp of [{ w: 375, h: 667, handy: true }, { w: 390, h: 844, handy: true }, { w: 820, h: 1180 }, { w: 1024, h: 768 }, { w: 1180, h: 820 }, { w: 844, h: 390, handy: true }]) {
    gruppe = `Knopftext ${vp.w} × ${vp.h}`;
    const { kontext, seite, fehler } = await neueSeite(browser, { w: vp.w, h: vp.h, handy: !!vp.handy, saat: SAAT_ALLE });
    await seite.goto(BASIS + (vp.handy ? '&reiter=verlauf' : '') + '#arena');
    await seite.waitForSelector('.screen.arena .knoten');
    await warte(900);
    const echt = [];
    const texte = [];
    const ab = new Set();
    // die Karte zeigt eine Welt: Welt fuer Welt durchgehen (die Reihenfolge ist die der Leiter)
    for (const [wi, ids] of WELT_IDS.entries()) {
      await geheZuWelt(seite, wi + 1);
      for (const id of ids) {
        await seite.evaluate((i) => document.querySelector(`.knoten[data-bot="${i}"]`).click(), id);
        texte.push(await seite.evaluate(() => document.querySelector('.detail [data-aktion="spielen"]').textContent.trim()));
        const r = await spielenPasst(seite);
        if (r) echt.push(r);
        for (const x of await abgeschnitten(seite)) ab.add(id + ' ' + x);
      }
    }
    const erwartet = await seite.evaluate(async () => {
      const { spielenText } = await import('./js/ui/arena.js');
      const { BOTS } = await import('./js/bots.js');
      const tmp = document.createElement('span');
      return BOTS.map((b) => { tmp.innerHTML = spielenText(b, true); return tmp.textContent; });
    });
    pruefe('echte Panels: „Revanche gegen …“ fuer jeden der 30 Bots ganz im Knopf (hoechstens zwei Zeilen, Rufname nie getrennt)',
      echt.length === 0 && texte.join('|') === erwartet.join('|') && texte.includes('Revanche gegen den Stockfisch'), echt.join(' | ') + ' ' + texte.join('|'));
    const synth = [];
    for (const b of BOTS) {
      for (const besiegt of [false, true]) {
        await seite.evaluate(async ({ id, v }) => {
          const { spielenText } = await import('./js/ui/arena.js');
          const { BOTS: alle } = await import('./js/bots.js');
          document.querySelector('.detail [data-aktion="spielen"] .sp-text').innerHTML = spielenText(alle.find((x) => x.id === id), v);
        }, { id: b.id, v: besiegt });
        const r = await spielenPasst(seite);
        if (r) synth.push(r);
      }
    }
    pruefe('„Spielen gegen …“ und „Revanche gegen …“ fuer jeden der 30 Bots ganz im echten Knopf', synth.length === 0, synth.join(' | '));
    pruefe('alle 30 Panels und alle fuenf Karten: kein Name, kein Schild, kein Steckbrief, keine Bedingung und keine Farbwahl abgeschnitten oder herausragend', ab.size === 0, [...ab].slice(0, 6).join(' | '));
    await seite.evaluate(() => document.querySelector('.knoten[data-bot="stockfisch"]').click());
    await warte(800);
    await bild(seite, `knopftext-${vp.w}x${vp.h}`);
    pruefe('keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }
}

// Welten (Flo 23.10.): die Karte zeigt die sechs Stationen einer Welt; Weltwahl mit Pfeilen, gesperrte Welten
// (.welt-sperre), Schild NEU (.k-neu), Endgegner direkt herausforderbar, alle 30 Bots Welt fuer Welt
const weltwahl = (seite) => seite.evaluate(() => {
  const ww = document.querySelector('.weltwahl');
  const sperre = document.querySelector('.welt-sperre');
  const w = document.querySelector('.welt');
  return { name: ww.querySelector('.ww-name').textContent, unter: ww.querySelector('.ww-unter').textContent,
    zurueckAus: ww.querySelector('[data-richtung="-1"]').disabled, vorAus: ww.querySelector('[data-richtung="1"]').disabled,
    siegel: ww.classList.contains('mit-siegel'), wwGesperrt: ww.classList.contains('gesperrt'), welt: w.dataset.welt, weltGesperrt: w.classList.contains('gesperrt'),
    sperre: !sperre.hidden, sperreText: sperre.textContent.replace(/\s+/g, ' ').trim(), flo: getComputedStyle(document.querySelector('.flo-figur')).display,
    ids: [...document.querySelectorAll('.welt button.stufe.knoten[data-bot]')].map((k) => k.dataset.bot),
    zustaende: [...document.querySelectorAll('.welt button.stufe.knoten[data-bot]')].map((k) => ['besiegt', 'aktuell', 'offen', 'gesperrt'].find((z) => k.classList.contains(z))).join(),
    nr: [...document.querySelectorAll('.welt .knoten .k-nr')].map((e) => e.textContent).join(), elo: [...document.querySelectorAll('.welt .knoten .k-meta')].map((e) => e.textContent).join() };
});
// ein neuer Aufruf der Arena (wie nach einer Partie oder ueber einen Link): die alte Arena merken, die neue abwarten
async function arenaNeu(seite, params) {
  await seite.evaluate((p) => { document.querySelector('.screen.arena').dataset.alt = 'ja'; window.__app.gehe('arena', p); }, params);
  await seite.waitForSelector('.screen.arena:not([data-alt]) .knoten');
  await seite.waitForFunction(() => document.querySelectorAll('.screen.arena').length === 1);
  await warte(500);
}
async function testeWelten(browser) {
  gruppe = 'Welten';
  {
    const { kontext, seite, fehler } = await neueSeite(browser, { w: 1180, h: 820 });
    await seite.goto(BASIS + '#arena');
    await seite.waitForSelector('.screen.arena .knoten');
    await warte(1200);
    let w = await weltwahl(seite);
    pruefe('Weltwahl: die Karte beginnt in der Welt des naechsten Gegners (Die Karofelder, 5/18 Sterne), „Zurueck“ aus, „Vor“ an, Landschaft der Welt, keine Sperre',
      w.name === 'Die Karofelder' && w.unter === 'Welt 1 von 5 · 5/18 Sterne' && w.zurueckAus && !w.vorAus && !w.siegel && !w.wwGesperrt && w.welt === 'karofelder' && !w.weltGesperrt && !w.sperre && w.flo !== 'none',
      JSON.stringify(w));
    // Endgegner direkt herausforderbar: offen (nicht gesperrt), ein Tipp waehlt ihn, Spielen ist moeglich
    await tippe(seite, '.knoten[data-bot="janine"]');
    await warte(700);
    const jan = await seite.evaluate(() => ({ h2: document.querySelector('.detail h2').textContent, ueber: document.querySelector('.detail-ueber').textContent.replace(/\s+/g, ' ').trim(),
      welt: document.querySelector('.detail-welt').textContent, spielen: document.querySelector('[data-aktion="spielen"]').textContent.trim(),
      gewaehlt: document.querySelector('.knoten.gewaehlt').dataset.bot, offen: document.querySelector('.knoten[data-bot="janine"]').classList.contains('offen'),
      toast: document.querySelectorAll('.toast').length }));
    pruefe('Endgegner offen: Janine ist ohne Sieg ueber Maik und Hilde waehlbar (Panel „Stufe 6 · Endgegner · direkt herausfordern“, Spielen gegen Janine), keine Sperr-Meldung',
      jan.h2 === 'Janine vom Scheunenclub' && jan.ueber === 'Stufe 6 · Endgegner · direkt herausfordern' && jan.welt === 'Welt 1 · Die Karofelder' && jan.spielen === 'Spielen gegen Janine'
      && jan.gewaehlt === 'janine' && jan.offen && jan.toast === 0, JSON.stringify(jan));
    // Pfeil „Vor“ (mit dem Finger): Welt 2 ist gesperrt, die Karte zeigt sie als ruhige Silhouette mit Sperre
    await tippe(seite, '.ww-pfeil[data-richtung="1"]');
    await warte(500);
    w = await weltwahl(seite);
    pruefe('Pfeil vor: Welt 2 „Der Springerforst“, gesperrt (Weltwahl und Karte grau, .welt-sperre nennt den Schluessel: Sieg gegen Janine), Flos Figur weg',
      w.name === 'Der Springerforst' && w.unter === 'Welt 2 von 5 · gesperrt' && w.wwGesperrt && w.weltGesperrt && w.welt === 'springerforst' && w.sperre && !w.zurueckAus && !w.vorAus && w.flo === 'none'
      && /Dichter Mischwald mit Lichtungen und Bach\. Ein Sieg gegen Janine vom Scheunenclub öffnet sie\.$/.test(w.sperreText) && w.sperreText.startsWith('Der Springerforst'), JSON.stringify(w));
    pruefe('gesperrte Welt: alle sechs Stationen gesperrt mit Schloss, der Endgegner (Ritter Thorsten) als Silhouette mit „?“, die anderen in Graustufen',
      w.ids.join() === WELT_IDS[1].join() && w.zustaende === 'gesperrt,gesperrt,gesperrt,gesperrt,gesperrt,gesperrt' && await seite.evaluate(() => document.querySelectorAll('.welt .knoten.gesperrt .schloss').length === 6
        && /brightness\(0\)/.test(getComputedStyle(document.querySelector('.knoten.boss[data-bot="rudi"] .avatar img')).filter) && /grayscale/.test(getComputedStyle(document.querySelector('.knoten[data-bot="kalle"] .avatar img')).filter)
        && document.querySelectorAll('.knoten .fahne').length === 0 && /ENDGEGNER/.test(document.querySelector('.knoten.boss .boss-krone').textContent)), JSON.stringify(w));
    await tippe(seite, '.knoten[data-bot="kalle"]');
    await seite.waitForSelector('.toast');
    const sp = await seite.evaluate(() => ({ toast: document.querySelector('.toast').textContent, h2: document.querySelector('.detail h2').textContent }));
    pruefe('Tipp auf eine Station der gesperrten Welt: „Diese Welt öffnet sich mit einem Sieg gegen Janine vom Scheunenclub.“, das Panel bleibt bei Janine',
      sp.toast === 'Diese Welt öffnet sich mit einem Sieg gegen Janine vom Scheunenclub.' && sp.h2 === 'Janine vom Scheunenclub', JSON.stringify(sp));
    await seite.evaluate(() => { for (const x of document.querySelectorAll('.toast')) x.remove(); });
    // alle fuenf Welten der Reihe nach: sechs Stationen, Stufe 1 bis 30 mit Elo 100 bis 3000, nichts ueberdeckt oder abgeschnitten
    await geheZuWelt(seite, 1);
    const alle = [];
    const probleme = [];
    for (const [wi, ids] of WELT_IDS.entries()) {
      await geheZuWelt(seite, wi + 1);
      await warte(250);
      const x = await weltwahl(seite);
      const stufen = ids.map((id) => BOTS.find((b) => b.id === id).stufe);
      alle.push(...x.ids);
      if (x.name !== WELTEN[wi].name || !x.unter.startsWith(`Welt ${wi + 1} von 5`) || x.ids.join() !== ids.join() || x.nr !== stufen.join() || x.elo !== stufen.map((s) => s * 100).join()
        || x.zurueckAus !== (wi === 0) || x.vorAus !== (wi === 4) || x.welt !== WELTEN[wi].id || x.weltGesperrt !== (wi > 0)) probleme.push('Welt ' + (wi + 1) + ': ' + JSON.stringify(x));
      const kl = await kartenLage(seite);
      if (kl.ueber.length || kl.raus.length) probleme.push('Lage Welt ' + (wi + 1) + ': ' + JSON.stringify(kl));
      const ab = await abgeschnitten(seite);
      if (ab.length) probleme.push('abgeschnitten Welt ' + (wi + 1) + ': ' + ab.join(' | '));
      if (await seite.evaluate(() => document.querySelectorAll('.welt button.stufe.knoten.boss').length !== 1)) probleme.push('Welt ' + (wi + 1) + ': nicht genau ein Endgegner');
      // jede Welt hat ihre eigene Landschaft (Aecker, Tannen, Tuerme, Wellen, Algen) und ihr Wahrzeichen am Endgegner
      const eigen = ['.w-acker', '.w-tanne', '.w-stein', '.w-welle', '.w-alge'][wi];
      if (await seite.evaluate((e) => document.querySelectorAll(`.welt-svg ${e}`).length === 0, eigen)) probleme.push('Welt ' + (wi + 1) + ': keine Landschaft ' + eigen);
      await bild(seite, `arena-welt${wi + 1}-1180x820`);
    }
    pruefe('Pfeile durch alle fuenf Welten: Name, „Welt n von 5“, sechs Stationen in Leiter-Reihenfolge (Stufe = Nummer, Elo = 100 x Stufe), ein Endgegner, Beschriftungen innerhalb der Karte und nicht abgeschnitten, an den Enden ist der Pfeil aus',
      probleme.length === 0 && alle.join() === IDS.join(), probleme.join(' ## ').slice(0, 600));
    pruefe('Weltwahl-Pfeile mindestens 44 px', (await kleineTippflaechen(seite)).length === 0);
    // Aufruf mit Welt: app.gehe('arena', { welt }) zeigt diese Welt, { waehle } waehlt einen offenen Bot vor
    await arenaNeu(seite, { welt: 3 });
    w = await weltwahl(seite);
    const h3 = await seite.evaluate(() => document.querySelector('.detail h2').textContent);
    pruefe('gehe(arena, { welt: 3 }): zeigt Die Turmstadt (gesperrt), das Panel bleibt beim naechsten Gegner', w.name === 'Die Turmstadt' && w.unter === 'Welt 3 von 5 · gesperrt' && w.weltGesperrt && h3 === 'Postbotin Paula', JSON.stringify([w.name, w.unter, h3]));
    await arenaNeu(seite, { waehle: 'janine' });
    w = await weltwahl(seite);
    const hj = await seite.evaluate(() => ({ h2: document.querySelector('.detail h2').textContent, gewaehlt: document.querySelector('.knoten.gewaehlt').dataset.bot }));
    pruefe('gehe(arena, { waehle: "janine" }): der frei herausforderbare Endgegner ist vorgewaehlt, die Karte zeigt seine Welt', w.name === 'Die Karofelder' && hj.h2 === 'Janine vom Scheunenclub' && hj.gewaehlt === 'janine', JSON.stringify([w.name, hj]));
    pruefe('keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }

  // Schild NEU: Willi ist frei, aber nicht der naechste Gegner und liegt unter Flos bestem Sieg (Lukas)
  gruppe = 'Welten neu eingezogen';
  {
    const { kontext, seite, fehler } = await neueSeite(browser, { w: 1180, h: 820, saat: SAAT_BENNO });
    await seite.goto(BASIS + '#arena');
    await seite.waitForSelector('.screen.arena .knoten');
    await warte(1200);
    const n = await seite.evaluate(() => {
      const f = document.querySelector('.knoten[data-bot="fridolin"]');
      return { neu: [...document.querySelectorAll('.k-neu')].map((e) => e.closest('.knoten').dataset.bot + ':' + e.textContent).join(), fridolin: f.classList.contains('offen'), schloss: f.querySelectorAll('.schloss').length,
        grau: getComputedStyle(f.querySelector('.avatar img')).filter, label: f.getAttribute('aria-label'),
        zustaende: [...document.querySelectorAll('.welt .knoten')].map((k) => k.dataset.bot + '=' + ['besiegt', 'aktuell', 'offen', 'gesperrt'].find((z) => k.classList.contains(z))).join() };
    });
    pruefe('Schild NEU nur an Willi (frei, unbesiegt, unter dem besten Sieg): offen, ohne Schloss und in Farbe, Beschriftung „neu eingezogen“',
      n.neu === 'fridolin:NEU' && n.fridolin && n.schloss === 0 && n.grau === 'none' && n.label === 'Stufe 1: Vogelscheuche Willi, Elo 100, neu eingezogen', JSON.stringify(n));
    pruefe('Zustaende nach Lukas-Sieg: Willi offen, Lukas besiegt, Paula aktuell, Maik und Hilde gesperrt, Janine offen', n.zustaende === 'fridolin=offen,benno=besiegt,paula=aktuell,gustav=gesperrt,hilde=gesperrt,janine=offen', n.zustaende);
    const kl = await kartenLage(seite);
    pruefe('Schild NEU liegt innerhalb der Karte und ueberdeckt keine andere Station', kl.ueber.length === 0 && kl.raus.length === 0, JSON.stringify(kl));
    await tippe(seite, '.knoten[data-bot="fridolin"]');
    await warte(700);
    const pf = await seite.evaluate(() => ({ ueber: document.querySelector('.detail-ueber').textContent, spielen: document.querySelector('[data-aktion="spielen"]').textContent.trim(), toast: document.querySelectorAll('.toast').length }));
    pruefe('Tipp auf den neu eingezogenen Bot waehlt ihn: „Stufe 1 · Neu eingezogen“, Spielen gegen Willi', pf.ueber === 'Stufe 1 · Neu eingezogen' && pf.spielen === 'Spielen gegen Willi' && pf.toast === 0, JSON.stringify(pf));
    pruefe('keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }

  // Weltsiegel und alles besiegt
  gruppe = 'Welten Siegel';
  {
    const { kontext, seite, fehler } = await neueSeite(browser, { w: 1180, h: 820, saat: SAAT_WELT1 });
    await seite.goto(BASIS + '#arena');
    await seite.waitForSelector('.screen.arena .knoten');
    await warte(1200);
    let w = await weltwahl(seite);
    pruefe('Welt 1 ganz besiegt: die Karte beginnt in Welt 2 (Jan ist der naechste Gegner), offen und ohne Sperre',
      w.name === 'Der Springerforst' && w.unter === 'Welt 2 von 5 · 0/18 Sterne' && !w.weltGesperrt && !w.sperre && w.zustaende === 'aktuell,gesperrt,gesperrt,gesperrt,gesperrt,offen' && w.flo !== 'none', JSON.stringify(w));
    await tippe(seite, '.ww-pfeil[data-richtung="-1"]');
    await warte(500);
    w = await weltwahl(seite);
    pruefe('Pfeil zurueck: Welt 1 mit Weltsiegel (alle 18 Sterne, goldener Rand, „· Weltsiegel“), alle sechs besiegt', w.name === 'Die Karofelder' && w.unter === 'Welt 1 von 5 · 18/18 Sterne · Weltsiegel' && w.siegel
      && w.zustaende === 'besiegt,besiegt,besiegt,besiegt,besiegt,besiegt', JSON.stringify(w));
    pruefe('keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }
  gruppe = 'Welten alles besiegt';
  {
    const { kontext, seite, fehler } = await neueSeite(browser, { w: 1180, h: 820, saat: SAAT_ALLE });
    await seite.goto(BASIS + '#arena');
    await seite.waitForSelector('.screen.arena .knoten');
    await warte(1200);
    const sterne = Object.values(SAAT_ALLE.bots).reduce((n, b) => n + b.sterne.filter(Boolean).length, 0);
    // (vor „Sterne“ steht ein geschuetztes Leerzeichen: erst die Leerraeume gleichsetzen)
    const a = await seite.evaluate(() => ({ unter: document.querySelector('.logo-unter').textContent.replace(/\s+/g, ' ').trim(), aktuell: document.querySelectorAll('.knoten.aktuell').length, fahne: document.querySelectorAll('.knoten .fahne').length,
      sterne: document.querySelector('.kopf-chips .chip-sterne').textContent.replace(/\s+/g, ' ').trim(), besiegt: document.querySelector('.kopf-chips .chip-pokal').textContent.replace(/\s+/g, ' ').trim() }));
    pruefe('Alle 30 besiegt: Kopfzeile „Arena bezwungen! x/90 Sterne“, Chips „x / 90“ und „30 / 30“, kein naechster Gegner und keine Fahne',
      a.unter === `Arena bezwungen! ${sterne}/90 Sterne` && a.sterne === `Sterne: ${sterne} / 90` && a.besiegt === 'Besiegt: 30 / 30' && a.aktuell === 0 && a.fahne === 0, JSON.stringify(a));
    pruefe('keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
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
      const t = { an: null, aus: null, setzen: null, entfernen: null };
      window.__frei = t;
      // genaue Zeitpunkte beim Setzen und Entfernen der Klasse (der MutationObserver unten meldet erst nach der laufenden
      // Aufgabe: baut die Arena nach dem Setzen noch lange auf, z. B. auf einem kalten Rechner, wirkte die Choreografie
      // um diese Zeit zu kurz). .wird-frei gibt es nur an der neuen Station (js/ui/arena.js freischalten)
      const add = DOMTokenList.prototype.add;
      const remove = DOMTokenList.prototype.remove;
      DOMTokenList.prototype.add = function (...k) { if (k.includes('wird-frei') && t.setzen == null) t.setzen = performance.now(); return add.apply(this, k); };
      DOMTokenList.prototype.remove = function (...k) { if (k.includes('wird-frei') && t.setzen != null && t.entfernen == null && this.contains('wird-frei')) t.entfernen = performance.now(); return remove.apply(this, k); };
      const mo = new MutationObserver(() => {
        const k = document.querySelector('.knoten[data-bot="paula"]');
        if (!k) return;
        if (t.an == null && k.classList.contains('wird-frei')) t.an = performance.now();
        if (t.an != null && t.aus == null && !k.classList.contains('wird-frei')) { t.aus = performance.now(); mo.disconnect(); }
      });
      mo.observe(document.getElementById('app'), { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
      window.__app.gehe('arena', { neuFreigeschaltet: 'paula' });
    });
    await seite.waitForSelector('.knoten.wird-frei[data-bot="paula"]');
    const anfang = await seite.evaluate(() => ({ schloss: document.querySelectorAll('.knoten[data-bot="paula"] .schloss').length, aktuell: !!document.querySelector('.knoten.aktuell[data-bot="paula"]:not(.gesperrt)'),
      panel: document.querySelector('.detail h2').textContent, fahneDa: !!document.querySelector('.knoten[data-bot="paula"] .fahne'),
      grau: /grayscale/.test(getComputedStyle(document.querySelector('.knoten[data-bot="paula"] .avatar img')).filter) }));
    pruefe('Beginn: .wird-frei auf Paula, Schloss noch da, Gesicht noch grau, Paula im Panel', anfang.schloss === 1 && anfang.aktuell && anfang.panel === 'Postbotin Paula' && anfang.fahneDa && anfang.grau, JSON.stringify(anfang));
    await seite.waitForFunction(() => window.__frei.aus != null, null, { timeout: 15000 });
    const frei = await seite.evaluate(() => window.__frei);
    pruefe('Choreografie endet nach 2,7 s (nicht frueher, hoechstens 1 s spaeter)', frei.setzen != null && frei.entfernen != null && frei.an != null && frei.aus != null
      && frei.entfernen - frei.setzen >= 2650 && frei.entfernen - frei.setzen <= 3700, Math.round(frei.entfernen - frei.setzen) + ' ms (Beobachter: ' + Math.round(frei.aus - frei.an) + ' ms)');
    const ende = await seite.evaluate(async () => {
      const { klang } = await import('./js/sounds.js');
      const k = document.querySelector('.karte').getBoundingClientRect();
      const h = document.querySelector('.knoten[data-bot="paula"] .avatar').getBoundingClientRect();
      return { schloss: document.querySelectorAll('.knoten[data-bot="paula"] .schloss').length, sterne: document.querySelectorAll('.knoten[data-bot="benno"] .k-sterne .stern').length,
        fahne: (document.querySelector('.knoten.aktuell[data-bot="paula"] .fahne') || {}).textContent, bunt: getComputedStyle(document.querySelector('.knoten[data-bot="paula"] .avatar img')).filter,
        toast: [...document.querySelectorAll('.toast')].map((t) => t.textContent).join(' | '), imBild: h.top >= k.top && h.bottom <= k.bottom,
        sternKlang: klang.protokoll().some((e) => e.name === 'stern'), floX: document.querySelector('.flo-figur').style.left,
        floBeiBenno: (() => { const f = document.querySelector('.flo-figur').getBoundingClientRect(); const b = document.querySelector('.knoten[data-bot="benno"] .avatar').getBoundingClientRect();
          return Math.hypot(f.left + f.width / 2 - (b.left + b.width / 2), f.top + f.height / 2 - (b.top + b.height / 2)) < b.width; })() };
    });
    pruefe('Ende: Schloss weg, Paula bunt mit Fahne, Lukas drei Sterne, Meldung „Neu freigeschaltet“, Stern-Klang', ende.schloss === 0 && ende.sterne === 3 && /NÄCHSTER GEGNER/.test(ende.fahne || '') && ende.bunt === 'none'
      && /Neu freigeschaltet: Postbotin Paula/.test(ende.toast) && ende.sternKlang, JSON.stringify(ende));
    pruefe('Handy: die Karte hat zur neuen Station gescrollt', ende.imBild, JSON.stringify(ende));
    pruefe('Flo ist zur gerade bezwungenen Station (Lukas) weitergezogen', ende.floBeiBenno, JSON.stringify(ende));
    await bild(seite, 'arena-freigeschaltet-390x844');
    pruefe('keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }
  // der erste Bot einer neuen Welt: die Meldung nennt die Welt
  gruppe = 'Freischalten neue Welt';
  {
    const { kontext, seite, fehler } = await neueSeite(browser, { w: 1180, h: 820, saat: SAAT_WELT1 });
    await seite.goto(BASIS + '#arena');
    await seite.waitForSelector('.screen.arena .knoten');
    await warte(600);
    await seite.evaluate(() => { document.querySelector('.screen.arena').dataset.alt = 'ja'; window.__app.gehe('arena', { neuFreigeschaltet: 'bodo' }); });
    await seite.waitForSelector('.screen.arena:not([data-alt]) .knoten.wird-frei[data-bot="bodo"]');
    const anfang = await seite.evaluate(() => ({ welt: document.querySelector('.ww-name').textContent, schloss: document.querySelectorAll('.knoten[data-bot="bodo"] .schloss').length, panel: document.querySelector('.detail h2').textContent,
      stationen: document.querySelectorAll('.welt .knoten').length }));
    pruefe('Beginn: die Karte zeigt die neue Welt (Der Springerforst), Jan mit Schloss, Jan im Panel', anfang.welt === 'Der Springerforst' && anfang.schloss === 1 && anfang.panel === 'Holzfäller Jan' && anfang.stationen === 6, JSON.stringify(anfang));
    await seite.waitForFunction(() => !document.querySelector('.knoten.wird-frei'), null, { timeout: 15000 });
    const ende = await seite.evaluate(() => ({ toast: [...document.querySelectorAll('.toast')].map((x) => x.textContent).join(' | '), schloss: document.querySelectorAll('.knoten[data-bot="bodo"] .schloss').length,
      aktuell: !!document.querySelector('.knoten.aktuell[data-bot="bodo"]') }));
    pruefe('Ende: Meldung „Neue Welt offen: Der Springerforst!“ (statt „Neu freigeschaltet“), Schloss weg, Jan ist der naechste Gegner', ende.toast === 'Neue Welt offen: Der Springerforst!' && ende.schloss === 0 && ende.aktuell, JSON.stringify(ende));
    pruefe('keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }
  gruppe = 'Freischalten ohne Bewegung';
  {
    const { kontext, seite, fehler } = await neueSeite(browser, { w: 1180, h: 820, saat: SAAT_BENNO, bewegung: 'reduce' });
    await seite.goto(BASIS + '#arena');
    await seite.waitForSelector('.screen.arena .knoten');
    await seite.evaluate(() => { document.querySelector('.screen.arena').dataset.alt = 'ja'; window.__app.gehe('arena', { neuFreigeschaltet: 'paula' }); });
    await seite.waitForSelector('.screen.arena:not([data-alt]) .knoten.aktuell[data-bot="paula"]');
    await seite.waitForFunction(() => document.querySelectorAll('.screen.arena').length === 1);
    const r = await seite.evaluate(() => ({ wirdFrei: document.querySelectorAll('.wird-frei').length, schloss: document.querySelectorAll('.knoten[data-bot="paula"] .schloss').length,
      bunt: getComputedStyle(document.querySelector('.knoten[data-bot="paula"] .avatar img')).filter, weg: !!document.querySelector('.welt-svg .w-fortschritt-neu') && getComputedStyle(document.querySelector('.welt-svg .w-fortschritt-neu')).opacity === '1',
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
    // FLIP-Start (Pruefer-Befund U5, klein): das Bot-Portraet der Buehne startet genau auf dem Portraet der Detail-Karte,
    // Flos Koenig auf dem Pfeil des Spielen-Knopfs (erstes Bild der Animation angehalten und gemessen)
    await seite.evaluate(() => {
      const m = (el) => { const r = el.getBoundingClientRect(); return { l: Math.round(r.left), t: Math.round(r.top), w: Math.round(r.width) }; };
      window.__flipQuelle = { bot: m(document.querySelector('.detail-kopf .av')), flo: m(document.querySelector('.detail .spielen .pf')) };
      new MutationObserver((l, mo) => {
        if (!document.querySelector('.duell.voll [data-rolle="bot"]')) return;
        mo.disconnect();
        window.__flipStart = {};
        for (const rolle of ['bot', 'flo']) {
          const el = document.querySelector(`.duell.voll [data-rolle="${rolle}"]`);
          const a = el.getAnimations()[0];
          if (a) { a.pause(); a.currentTime = 0; }
          window.__flipStart[rolle] = m(el);
          if (a) a.play();
        }
      }).observe(document.body, { childList: true });
    });
    await tippe(seite, '.detail [data-aktion="spielen"]');
    await seite.waitForSelector('.duell.voll', { timeout: 5000 });
    const flipLage = await seite.evaluate(() => ({ quelle: window.__flipQuelle, start: window.__flipStart }));
    const gleich = (a, b) => !!a && !!b && Math.abs(a.l - b.l) <= 2 && Math.abs(a.t - b.t) <= 2 && Math.abs(a.w - b.w) <= 2;
    pruefe('Buehnen-Portraets starten genau auf ihrer Quelle (Bot: Portraet der Detail-Karte, Flo: Pfeil des Spielen-Knopfs)',
      gleich(flipLage.start && flipLage.start.bot, flipLage.quelle.bot) && gleich(flipLage.start && flipLage.start.flo, flipLage.quelle.flo), JSON.stringify(flipLage));
    const mitte = await seite.evaluate(() => {
      const d = document.querySelector('.duell');
      const bf = getComputedStyle(document.documentElement).getPropertyValue('--bot-paula').trim();
      const probe = document.createElement('i');
      probe.style.color = bf;
      document.body.append(probe);
      const bfRgb = getComputedStyle(probe).color;
      probe.remove();
      return { art: d.dataset.art, bot: d.dataset.bot, anlass: d.dataset.anlass, attr: document.documentElement.dataset.duell, buehne: getComputedStyle(d.querySelector('.duell-buehne')).backgroundColor, bfRgb,
        gegen: d.querySelector('.duell-gegen').textContent, botName: d.querySelector('.duell-seite.bot .duell-name').textContent, floName: d.querySelector('.duell-seite.flo .duell-name').textContent,
        unter: d.querySelector('.duell-seite.bot .duell-unter').textContent, chip: (d.querySelector('.duell-chip') || {}).textContent, naht: getComputedStyle(d.querySelector('.duell-flo i')).clipPath,
        portraet: d.querySelector('[data-rolle="bot"] img').src.endsWith('/assets/avatare/modern/paula.svg'), koenig: /wK\.svg/.test(d.querySelector('[data-rolle="flo"] image').getAttribute('href')),
        rolle: d.getAttribute('role'), screen: document.documentElement.dataset.screen };
    });
    pruefe('Ueberlagerung .duell.voll an body: Bot-Haelfte in Bot-Farbe, „gegen“, Namen, Elo und Farben, Chip „Stufe 3 · Erste Partie“', mitte.art === 'voll' && mitte.bot === 'paula' && mitte.anlass === 'erste' && mitte.buehne === mitte.bfRgb
      && mitte.gegen === 'gegen' && mitte.botName === 'Postbotin Paula' && mitte.floName === 'Flo' && mitte.unter === 'Elo 300 · Schwarz' && mitte.chip === 'Stufe 3 · Erste Partie' && mitte.rolle === 'dialog', JSON.stringify(mitte));
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
        screen: document.documentElement.dataset.screen, aktiv: aktivesDuell(), prot: window.__duellProtokoll, start: klang.protokoll().filter((e) => e.name === 'start').length, block: Math.round(window.__block) };
    });
    pruefe('duell:fertig genau einmal (art voll, nicht uebersprungen), Attribut beim Ereignis schon weg', danach.fertig.length === 1 && danach.fertig[0].art === 'voll' && danach.fertig[0].uebersprungen === false && danach.fertig[0].attr === null, JSON.stringify(danach.fertig));
    pruefe('danach: Ueberlagerung und Flieger weg, aktivesDuell() null, Partie-Screen', danach.duell === 0 && danach.flieger === 0 && danach.attr === null && danach.screen === 'partie' && danach.aktiv === null, JSON.stringify(danach));
    pruefe('Dauer hoechstens 1,4 s (plus 100 ms und die gemessene Blockade des Hauptfadens), Start-Klang genau einmal', danach.prot && danach.prot.length === 1
      && danach.prot[0].dauer <= 1500 + danach.block && danach.prot[0].dauer >= 1000 && danach.start === 1, JSON.stringify(danach.prot) + ' start=' + danach.start + ' block=' + danach.block);
    await seite.waitForFunction(() => window.__partie && window.__partie.bereit === true, null, { timeout: 30000 });
    pruefe('Partie gegen Postbotin Paula laeuft', await seite.evaluate(() => JSON.parse(localStorage.getItem('schach-arena:v1:laufend') || 'null')?.botId === 'paula'));
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
    const { kontext, seite, fehler } = await neueSeite(browser, { w: 1180, h: 820, schema: 'dark', saat: SAAT_BOSS, einstellungen: { duellIntro: 'besondere', klang: false } });
    await seite.goto(BASIS + '#arena');
    await seite.waitForSelector('.screen.arena .knoten.aktuell[data-bot="stockfisch"]');
    await warte(800);
    await duellHorcher(seite);
    await tippe(seite, '.detail [data-aktion="spielen"]');
    await seite.waitForSelector('.duell.voll', { timeout: 5000 });
    const b = await seite.evaluate(() => ({ anlass: document.querySelector('.duell').dataset.anlass, chip: (document.querySelector('.duell-chip') || {}).textContent }));
    pruefe('Endgegner: Anlass boss, volle Buehne mit Chip „Stufe 30 · Endgegner“', b.anlass === 'boss' && b.chip === 'Stufe 30 · Endgegner', JSON.stringify(b));
    await warte(300);
    await bild(seite, 'duell-boss-1180x820-dunkel');
    await seite.waitForFunction(() => window.__fertig.length > 0, null, { timeout: 6000 });
    pruefe('keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }
  // der Endgegner einer Welt ist direkt herausforderbar (offen), auch ohne Sieg ueber die Bots davor: volle Buehne mit Anlass boss
  {
    const { kontext, seite, fehler } = await neueSeite(browser, { w: 1180, h: 820, einstellungen: { duellIntro: 'besondere', klang: false } });
    await seite.goto(BASIS + '#arena');
    await seite.waitForSelector('.screen.arena .knoten');
    await warte(800);
    await duellHorcher(seite);
    await tippe(seite, '.knoten[data-bot="janine"]');
    await warte(500);
    await tippe(seite, '.detail [data-aktion="spielen"]');
    await seite.waitForSelector('.duell.voll', { timeout: 5000 });
    const b = await seite.evaluate(() => ({ anlass: document.querySelector('.duell').dataset.anlass, bot: document.querySelector('.duell').dataset.bot, chip: (document.querySelector('.duell-chip') || {}).textContent }));
    pruefe('offener Endgegner (Janine, Welt 1): Anlass boss, volle Buehne mit Chip „Stufe 6 · Endgegner“', b.anlass === 'boss' && b.bot === 'janine' && b.chip === 'Stufe 6 · Endgegner', JSON.stringify(b));
    await seite.waitForFunction(() => window.__fertig.length > 0, null, { timeout: 6000 });
    pruefe('keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }
  {
    const partie = { id: 'u5-p1', datum: '2026-10-20T10:00:00.000Z', botId: 'paula', botStufe: 3, spielerFarbe: 'w', startFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', zuege: ['e2e4', 'e7e5'], san: ['e4', 'e5'],
      ergebnis: 'niederlage', grund: 'aufgabe', hinweise: 0, zuruecknahmen: 0, liveKlassen: [null, null], genauigkeit: null, genauigkeitBot: null, spielstaerke: null, eroeffnung: null, sterne: [false, false, false], modus: 'normal' };
    const { kontext, seite, fehler } = await neueSeite(browser, { w: 1180, h: 820, partien: [partie], einstellungen: { duellIntro: 'besondere', klang: false } });
    await seite.goto(BASIS + '#arena');
    await seite.waitForSelector('.screen.arena .knoten.aktuell[data-bot="paula"]');
    await warte(800);
    const erkannt = await seite.evaluate(async () => (await import('./js/storage.js')).ladePartien().some((p) => p.botId === 'paula'));
    pruefe('Vorbedingung: eine fruehere Partie gegen Paula ist gespeichert', erkannt);
    await duellHorcher(seite);
    await tippe(seite, '.detail [data-aktion="spielen"]');
    await seite.waitForFunction(() => window.__fertig.length > 0, null, { timeout: 6000 });
    const k = await seite.evaluate(() => ({ fertig: window.__fertig, prot: window.__duellProtokoll, voll: window.__duellGesehen, screen: document.documentElement.dataset.screen, block: Math.round(window.__block) }));
    pruefe('nicht die erste Partie: Kurzfassung (art kurz, keine Buehne), Vertrag erfuellt, Partie da', k.fertig.length === 1 && k.fertig[0].art === 'kurz' && k.prot[0].art === 'kurz' && k.prot[0].dauer <= 1500 + k.block && k.screen === 'partie'
      && (await seite.evaluate(() => document.querySelectorAll('.duell.voll, .duell-buehne').length === 0)), JSON.stringify(k));
    pruefe('keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }
  // lange Fassung (Flo 30.10.2026): mit Vitrine haelt die Buehne zum Lesen, Errungenschaften nacheinander, Tippen startet
  {
    const { kontext, seite, fehler } = await neueSeite(browser, { w: 1180, h: 820, einstellungen: { duellIntro: 'besondere', klang: false } });
    await seite.goto(BASIS + '#arena');
    await seite.waitForSelector('.screen.arena .knoten');
    await warte(800);
    await seite.evaluate(async () => (await import('./js/orte.js')).anbieten('duell:profil?', () => ({ titel: 'Der Erfinder', orden: [{ name: 'Welt 1 gemeistert' }, { name: 'Serie 30' }, { name: 'Liga Gold' }] }), { reihenfolge: 1, paket: 'test-vitrine' }));
    await duellHorcher(seite);
    await tippe(seite, '.detail [data-aktion="spielen"]');
    await seite.waitForSelector('.duell.voll.lang', { timeout: 5000 });
    await warte(1900);
    const mitte = await seite.evaluate(() => ({ orden: [...document.querySelectorAll('.duell-orden')].map((o) => [o.textContent, +getComputedStyle(o).opacity]),
      titel: (document.querySelector('.duell-titel') || {}).textContent, tipp: (document.querySelector('.duell-tipp') || {}).textContent, zeit: !!document.querySelector('.duell-zeit'),
      fertig: window.__fertig.length, block: Math.round(window.__block) }));
    pruefe('Vitrine ohne Anlass: volle Buehne in der langen Fassung, nach 1,9 s steht sie noch, alle drei Errungenschaften lesbar',
      mitte.fertig === 0 && mitte.orden.length === 3 && mitte.orden.every(([, o]) => o > 0.95) && mitte.titel === 'Der Erfinder' && mitte.tipp === 'Tippen zum Starten' && mitte.zeit, JSON.stringify(mitte));
    await seite.waitForFunction(() => window.__fertig.length > 0, null, { timeout: 8000 });
    const k = await seite.evaluate(() => ({ prot: window.__duellProtokoll, block: Math.round(window.__block) }));
    const pz = k.prot[k.prot.length - 1];
    pruefe('lange Fassung: Portraets fliegen erst nach der Haltephase, Ende vor der harten Grenze',
      pz.art === 'voll' && pz.flugAb >= HALTE_VITRINE - 5 && pz.dauer <= DAUER_VITRINE + 100 + k.block, JSON.stringify(k));
    pruefe('keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }
  {
    const { kontext, seite, fehler } = await neueSeite(browser, { w: 390, h: 844, handy: true, einstellungen: { duellIntro: 'besondere', klang: false } });
    await seite.goto(BASIS + '#arena');
    await seite.waitForSelector('.screen.arena .knoten');
    await warte(800);
    await seite.evaluate(async () => (await import('./js/orte.js')).anbieten('duell:profil?', () => ({ titel: 'Der Erfinder', orden: [{ name: 'Welt 1 gemeistert' }] }), { reihenfolge: 1, paket: 'test-vitrine' }));
    await duellHorcher(seite);
    await tippe(seite, '.detail [data-aktion="spielen"]');
    await seite.waitForSelector('.duell.voll.lang', { timeout: 5000 });
    await warte(1200);
    const t0 = Date.now();
    await tippe(seite, '.duell');
    await seite.waitForFunction(() => window.__fertig.length > 0, null, { timeout: 3000 });
    const k = await seite.evaluate(() => ({ fertig: window.__fertig, screen: document.documentElement.dataset.screen }));
    pruefe('lange Fassung, Handy: ein Tipp startet sofort (uebersprungen, Partie da)', k.fertig[0].uebersprungen === true && Date.now() - t0 < 1500, JSON.stringify(k));
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
    // Gepruefte Lage: der Tipp kommt, solange nur die Arena unter der Buehne liegt. Unter Last (geteilter Testrechner)
    // kann der Tipp so spaet ankommen, dass die Partie schon darunter steht: dann ist es nicht die gepruefte Lage, der
    // Ablauf wird in einer frischen Seite neu aufgesetzt (hoechstens dreimal; Konsolenfehler zaehlen aus allen Anlaeufen).
    // Die Lage wird im Moment des Tipps festgehalten (Horcher am window, capture: laeuft vor dem Horcher des Duells).
    let u = null;
    let lauf = null;
    const fehler = [];
    for (let versuch = 1; versuch <= 3; versuch++) {
      if (lauf) { fehler.push(...lauf.fehler); await lauf.kontext.close(); }
      if (versuch > 1) console.log(`  (Duell ueberspringen: Tipp kam erst nach dem Wechsel zur Partie an, Versuch ${versuch})`);
      lauf = await neueSeite(browser, { w: 1180, h: 820, einstellungen: { duellIntro: 'immer', klang: false } });
      const seite = lauf.seite;
      await seite.goto(BASIS + '#arena');
      await seite.waitForSelector('.screen.arena .knoten');
      await warte(600);
      await duellHorcher(seite);
      await seite.evaluate(() => {
        window.__arenaTipp = 0;
        // nur Tipps waehrend des Intros zaehlen (der Tipp auf "Spielen" davor gehoert der Arena)
        document.querySelector('.screen.arena').addEventListener('pointerdown', () => { if (document.querySelector('.duell')) window.__arenaTipp++; });
        window.__tippLage = null;
        window.addEventListener('pointerdown', () => {
          if (window.__tippLage || !document.querySelector('.duell')) return;
          window.__tippLage = { t: Math.round(performance.now()), laeuft: document.documentElement.dataset.duell === 'laeuft',
            arenaDrunter: !!document.querySelector('.screen.arena') && !document.querySelector('.duell.durch') };
        }, { capture: true });
      });
      const sp = await box(seite, '.detail [data-aktion="spielen"]');
      await seite.touchscreen.tap(sp.l + sp.w / 2, sp.t + sp.h / 2);
      await seite.waitForSelector('.duell.voll', { timeout: 5000 });
      await seite.touchscreen.tap(600, 400);
      await warte(80);
      u = await seite.evaluate(() => ({ duell: document.querySelectorAll('.duell').length, attr: document.documentElement.dataset.duell || null, fertig: window.__fertig, prot: window.__duellProtokoll,
        arenaTipp: window.__arenaTipp, lage: window.__tippLage, block: Math.round(window.__block) }));
      if (u.lage && u.lage.laeuft && u.lage.arenaDrunter) break;
    }
    const { kontext, seite } = lauf;
    fehler.push(...lauf.fehler);
    const lageOk = !!u.lage && u.lage.laeuft && u.lage.arenaDrunter;
    pruefe('Tippen: Ueberlagerung sofort weg (hoechstens 50 ms nach dem Tipp), Attribut weg, duell:fertig mit uebersprungen', lageOk && u.duell === 0 && u.attr === null && u.fertig.length === 1
      && u.fertig[0].uebersprungen === true && u.prot[0].uebersprungen === true && u.prot[0].dauer < 1000 && u.fertig[0].t - u.lage.t <= 50, JSON.stringify(u));
    pruefe('solange die Arena unter der Buehne liegt, faengt die Buehne den Tipp ab (die Arena bekommt ihn nicht)', lageOk && u.arenaTipp === 0, JSON.stringify(u));
    await seite.waitForFunction(() => document.documentElement.dataset.screen === 'partie' && window.__partie && window.__partie.bereit === true, null, { timeout: 30000 });
    pruefe('die Partie startet trotzdem', true);
    pruefe('keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }
  // Portraetflug auf Ziele in der Partie (hier in den Test-DOM eingesetzt; U7 baut sie)
  gruppe = 'Duell Portraetflug';
  {
    // Gepruefte Lage: die echte Partie ist rechtzeitig fuer einen Flug da (spaetestens 1,0 s nach dem Start; danach passt
    // kein Flug von FLUG_MIN mehr vor die harte Grenze, und es fliegt mit Absicht nichts, siehe Zeitplan unten). Baut sie
    // unter Last (geteilter Testrechner) laenger, ist es nicht diese Lage: neuer Anlauf in einer frischen Seite
    // (hoechstens dreimal; Konsolenfehler zaehlen aus allen Anlaeufen)
    let flug = null;
    let nach = null;
    let lauf = null;
    const fehler = [];
    for (let versuch = 1; versuch <= 3; versuch++) {
      if (lauf) { fehler.push(...lauf.fehler); await lauf.kontext.close(); }
      if (versuch > 1) console.log(`  (Duell Portraetflug: Partie kam erst nach ${nach.prot[0] ? nach.prot[0].partieAb : '?'} ms, Versuch ${versuch})`);
      lauf = await neueSeite(browser, { w: 1180, h: 820, einstellungen: { duellIntro: 'immer', klang: false } });
      const seite = lauf.seite;
      await seite.goto(BASIS + '#arena');
      await seite.waitForSelector('.screen.arena .knoten');
      // wie Flo: erst einen Moment auf die Karte schauen, dann spielen (die Arena waermt nach 0,9 s Engines und
      // Partie-Screen vor; mitten im Intro kostet das auf dem geteilten Testrechner mehrere 100 ms Hauptfaden)
      await warte(1500);
      await duellHorcher(seite);
      await zieleEinsetzen(seite);
      await tippe(seite, '.detail [data-aktion="spielen"]');
      await seite.waitForFunction(() => !!window.__flugBlick || window.__fertig.length > 0, null, { timeout: 6000 }).catch(() => {});
      flug = await seite.evaluate(() => window.__flugBlick || { flieger: window.__fliegerMax });
      await seite.waitForFunction(() => window.__fertig.length > 0, null, { timeout: 6000 });
      await warte(60);
      nach = await seite.evaluate(() => ({ flieger: document.querySelectorAll('.duell-flieger').length, sichtbar: [...document.querySelectorAll('.screen.partie .spieler .av')].map((z) => z.style.visibility || 'sichtbar').join(), prot: window.__duellProtokoll,
        deckt: window.__ziele.deckt, block: Math.round(window.__block) }));
      const pa = nach.prot && nach.prot[0] ? nach.prot[0].partieAb : null;
      if (pa != null && pa <= 1000) break;
    }
    const { kontext } = lauf;
    fehler.push(...lauf.fehler);
    pruefe('waehrend des Flugs: zwei Flieger (Bot-Portraet, Flos Koenig), die Ziele sind verborgen, Attribut steht', flug.flieger === 2 && flug.inhalt === 'img,svg' && flug.versteckt === 'hidden,hidden' && flug.attr === 'laeuft', JSON.stringify(flug) + ' ' + JSON.stringify(nach.prot));
    pruefe('danach: Flieger weg, Ziele wieder sichtbar, Protokoll meldet 2 Ziele', nach.flieger === 0 && nach.sichtbar === 'sichtbar,sichtbar' && nach.prot[0].ziele === 2, JSON.stringify(nach));
    // Pruefer-Befund U5 (wichtig): die Arena wechselte erst am Ende der Haltephase, der Flug schrumpfte auf 160 bis 215 ms.
    // Jetzt wechselt sie, sobald die Buehne deckt; war die Partie vor dem Ende der Haltephase da, fliegt das Portraet
    // seine volle Dauer, sonst so lang, wie es bis zur harten Grenze geht (oder gar nicht, nie ein Mini-Flug)
    const pz = nach.prot[0];
    pruefe('Zeitplan echt: Wechsel zur Partie, als die Buehne deckte; Flug in voller Laenge ab dem Ende der Haltephase (kam die Partie spaet: gekuerzt, nie unter FLUG_MIN)',
      nach.deckt === true && pz.wechsel >= WECHSEL_BEI - 5 && pz.wechsel <= WECHSEL_BEI + 150 + nach.block && pz.flugAb >= HALTE_BIS - 5
      && (vollerFlugMoeglich(pz.flugAb, 1) ? Math.abs(pz.flug - FLUG) <= 1 : pz.flug >= FLUG_MIN) && pz.dauer <= DAUER_MAX + 100 + nach.block, JSON.stringify(nach));
    pruefe('keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }
  // Kurzfassung (besondere, nicht die erste Partie) mit Zielen: die Portraets fliegen von der Station und von Flos
  // Figur auf der Karte in die Spielerleisten (PLAN 2.3 "von der Stufe"), obwohl die Arena beim Flug schon weg ist
  gruppe = 'Duell Kurzfassung Portraetflug';
  {
    const partie = { id: 'u5-p2', datum: '2026-10-20T10:00:00.000Z', botId: 'paula', botStufe: 3, spielerFarbe: 'w', startFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', zuege: ['e2e4', 'e7e5'], san: ['e4', 'e5'],
      ergebnis: 'niederlage', grund: 'aufgabe', hinweise: 0, zuruecknahmen: 0, liveKlassen: [null, null], genauigkeit: null, genauigkeitBot: null, spielstaerke: null, eroeffnung: null, sterne: [false, false, false], modus: 'normal' };
    const { kontext, seite, fehler } = await neueSeite(browser, { w: 1180, h: 820, partien: [partie], einstellungen: { duellIntro: 'besondere', klang: false } });
    await seite.goto(BASIS + '#arena');
    await seite.waitForSelector('.screen.arena .knoten.aktuell[data-bot="paula"]');
    await warte(1500);
    await duellHorcher(seite);
    await zieleEinsetzen(seite);
    const quellen = await seite.evaluate(() => {
      const m = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), w: Math.round(r.width) }; };
      return { bot: m(document.querySelector('.knoten[data-bot="paula"] .avatar')), flo: m(document.querySelector('.flo-figur')) };
    });
    await tippe(seite, '.detail [data-aktion="spielen"]');
    await seite.waitForFunction(() => !!window.__flugBlick || window.__fertig.length > 0, null, { timeout: 6000 }).catch(() => {});
    const flug = await seite.evaluate(() => window.__flugBlick || { flieger: window.__fliegerMax });
    const nah = (a, b) => !!a && !!b && Math.abs(a.x - b.x) <= 8 && Math.abs(a.y - b.y) <= 8 && Math.abs(a.w - b.w) <= 8;
    pruefe('Kurzfassung: zwei Flieger, Bot-Portraet startet an seiner Station, Flos Koenig an seiner Figur auf der Karte',
      flug.flieger === 2 && flug.inhalt === 'img,svg' && flug.versteckt === 'hidden,hidden' && flug.attr === 'laeuft' && !!flug.lage && nah(flug.lage[0], quellen.bot) && nah(flug.lage[1], quellen.flo),
      JSON.stringify({ flug, quellen }));
    await seite.waitForFunction(() => window.__fertig.length > 0, null, { timeout: 6000 });
    await warte(60);
    const nach = await seite.evaluate(() => ({ flieger: document.querySelectorAll('.duell-flieger').length, sichtbar: [...document.querySelectorAll('.screen.partie .spieler .av')].map((z) => z.style.visibility || 'sichtbar').join(),
      prot: window.__duellProtokoll, fertig: window.__fertig, block: Math.round(window.__block) }));
    pruefe('danach: Flieger weg, Ziele sichtbar, art kurz mit 2 Zielen, innerhalb der harten Grenze', nach.flieger === 0 && nach.sichtbar === 'sichtbar,sichtbar' && nach.prot[0].art === 'kurz' && nach.prot[0].ziele === 2
      && nach.fertig.length === 1 && nach.fertig[0].art === 'kurz' && nach.prot[0].dauer <= 1500 + nach.block, JSON.stringify(nach));
    pruefe('keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }
  // Zeitplan der Vollfassung mit einer Schein-Partie (unabhaengig davon, wie lange die echte Partie zum Aufbau braucht):
  // normal, Bewegung "langsam" (dehnt das Intro nicht ueber die Grenze), "schnell", und eine sehr spaete Partie
  gruppe = 'Duell Zeitplan';
  {
    const { kontext, seite, fehler } = await neueSeite(browser, { w: 1180, h: 820, einstellungen: { klang: false } });
    await seite.goto(BASIS + '#arena');
    await seite.waitForSelector('.screen.arena .knoten');
    await warte(600);
    await duellHorcher(seite);
    const lauf = (stufe, partieBei) => seite.evaluate(async ({ stufe: st, partieBei: bei }) => {
      const { spieleDuell } = await import('./js/ui/duell.js');
      const { setzeBewegung, tempo } = await import('./js/bewegung.js');
      const { sende } = await import('./js/ereignisse.js');
      const { BOTS } = await import('./js/bots.js');
      setzeBewegung(st);
      const t = tempo();
      window.__duellProtokoll = [];
      window.__fliegerMax = 0;
      window.__block = 0;
      const t0 = performance.now();
      const d = spieleDuell({ bot: BOTS.find((b) => b.id === 'paula'), farbe: 'w', anlass: 'erste', von: document.querySelector('.detail-kopf .av'), art: 'voll' });
      await d.bereit;
      const tBereit = Math.round(performance.now() - t0);
      const r = document.querySelector('.duell-buehne').getBoundingClientRect();
      const deckt = r.left <= 0.5 && r.top <= 0.5 && r.right >= innerWidth - 0.5 && r.bottom >= innerHeight - 0.5;
      const rest = bei - (performance.now() - t0);
      if (rest > 0) await new Promise((res) => setTimeout(res, rest));
      const p = document.createElement('section');
      p.className = 'screen partie schein-partie';
      p.style.cssText = 'position:fixed;inset:0;z-index:1';
      p.innerHTML = '<div class="spieler gegner" style="position:fixed;left:1060px;top:90px"><div class="av" style="width:56px;height:56px"></div></div>'
        + '<div class="spieler ich" style="position:fixed;left:1060px;top:520px"><div class="av" style="width:56px;height:56px"></div></div>';
      document.body.append(p);
      sende('app:screen', { name: 'partie', params: {} });
      await d.fertig;
      p.remove();
      setzeBewegung('normal');
      return { tempo: t, tBereit, deckt, prot: window.__duellProtokoll[0], flieger: window.__fliegerMax, block: Math.round(window.__block) };
    }, { stufe, partieBei });
    const normal = await lauf('normal', 600);
    const langsam = await lauf('langsam', 600);
    const schnell = await lauf('schnell', 400);
    const spaet = await lauf('normal', 1250);
    const ok = (x, zf) => x.deckt && x.tBereit >= WECHSEL_BEI * zf - 5 && x.tBereit <= WECHSEL_BEI * zf + 120 + x.block && x.prot.flugAb >= HALTE_BIS * zf - 5
      && x.prot.flugAb <= HALTE_BIS * zf + 80 + x.block && x.flieger === 2
      && (vollerFlugMoeglich(x.prot.flugAb, zf) ? Math.abs(x.prot.flug - FLUG * zf) <= 1 : x.prot.flug >= FLUG_MIN * zf) && x.prot.dauer <= DAUER_MAX + 60 + x.block;
    pruefe('normal: bereit (Wechsel zur Partie), sobald die Buehne den Schirm deckt; Flug ab dem Ende der Haltephase in voller Laenge (440 ms), Ende vor 1,4 s', ok(normal, 1), JSON.stringify(normal));
    pruefe('Bewegung langsam: das Intro laeuft im normalen Tempo (Wechsel nicht spaeter, Flug nicht gekuerzt), Ende vor 1,4 s', langsam.tempo === 1.5 && ok(langsam, 1), JSON.stringify(langsam));
    pruefe('Bewegung schnell: alles im Tempo 0,6 (Wechsel, Haltephase, Flug)', schnell.tempo === 0.6 && ok(schnell, 0.6), JSON.stringify(schnell));
    pruefe('sehr spaete Partie: kein Mini-Flug (gar keiner oder mindestens FLUG_MIN), Ende spaetestens an der harten Grenze', (spaet.prot.flug === 0 ? spaet.flieger === 0 : spaet.prot.flug >= FLUG_MIN)
      && spaet.prot.dauer <= DAUER_MAX + 60 + spaet.block && (spaet.prot.partieAb == null || spaet.prot.partieAb >= 1200), JSON.stringify(spaet));
    pruefe('keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }
  // Ist die Partie unter der Buehne da, geht ein Tipp zur Partie durch und beendet das Intro (z. B. der erste Tipp aufs
  // Brett direkt nach dem Wechsel; tests/app.test.mjs tippt so)
  gruppe = 'Duell Tipp zur Partie';
  {
    const { kontext, seite, fehler } = await neueSeite(browser, { w: 1180, h: 820, einstellungen: { klang: false } });
    await seite.goto(BASIS + '#arena');
    await seite.waitForSelector('.screen.arena .knoten');
    await warte(600);
    await duellHorcher(seite);
    // Lage im Moment des Tipps festhalten (Horcher am window, capture). Kommt der Tipp unter Last erst nach dem Ende des
    // Intros an, ist es nicht die gepruefte Lage: neuer Anlauf (hoechstens dreimal)
    await seite.evaluate(() => {
      window.addEventListener('pointerdown', () => {
        if (window.__vorher) return;
        window.__vorher = { laeuft: document.documentElement.dataset.duell || null, buehne: !!document.querySelector('.duell-buehne'), durch: !!document.querySelector('.duell.voll.durch'),
          ziel: (document.elementFromPoint(300, 400) || {}).className || null };
      }, { capture: true });
    });
    let vorher = null;
    let r = null;
    for (let versuch = 1; versuch <= 3; versuch++) {
      if (versuch > 1) console.log(`  (Duell Tipp zur Partie: Tipp kam erst nach dem Ende des Intros an, Versuch ${versuch})`);
      await seite.evaluate(async () => {
        const { spieleDuell } = await import('./js/ui/duell.js');
        const { sende } = await import('./js/ereignisse.js');
        const { BOTS } = await import('./js/bots.js');
        for (const p of document.querySelectorAll('.schein-partie')) p.remove();
        window.__tipps = 0;
        window.__vorher = null;
        window.__fertig = [];
        const d = spieleDuell({ bot: BOTS.find((b) => b.id === 'paula'), farbe: 'w', anlass: 'erste', von: document.querySelector('.detail-kopf .av'), art: 'voll' });
        d.bereit.then(() => {
          const p = document.createElement('section');
          p.className = 'screen partie schein-partie';
          p.style.cssText = 'position:fixed;inset:0;z-index:1';
          p.addEventListener('pointerdown', () => { window.__tipps++; });
          document.body.append(p);
          sende('app:screen', { name: 'partie', params: {} });
        });
      });
      await seite.waitForSelector('.duell.voll.durch', { timeout: 5000 });
      await seite.touchscreen.tap(300, 400);
      await warte(100);
      ({ vorher, r } = await seite.evaluate(() => ({ vorher: window.__vorher, r: { tipps: window.__tipps, duell: document.querySelectorAll('.duell').length, attr: document.documentElement.dataset.duell || null, fertig: window.__fertig } })));
      if (vorher && vorher.laeuft === 'laeuft') break;
      await seite.waitForFunction(() => !document.querySelector('.duell'), null, { timeout: 5000 });
    }
    pruefe('Partie unter der Buehne: der Tipp kommt bei der Partie an und beendet das Intro (uebersprungen)', !!vorher && vorher.laeuft === 'laeuft' && vorher.buehne && vorher.durch && /schein-partie/.test(vorher.ziel || '')
      && r.tipps === 1 && r.duell === 0 && r.attr === null && r.fertig.length === 1 && r.fertig[0].uebersprungen === true, JSON.stringify({ vorher, r }));
    await seite.evaluate(() => { for (const p of document.querySelectorAll('.schein-partie')) p.remove(); });
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
      const bot = BOTS.find((b) => b.id === 'paula');
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
      const warteZeit = Math.round(performance.now() - t2);
      // 3. zweites Intro beendet das erste
      const d3 = spieleDuell({ bot, farbe: 'w', anlass: 'erste', art: 'voll' });
      const d4 = spieleDuell({ bot: BOTS[0], farbe: 'w', anlass: 'erste', art: 'voll' });
      await new Promise((res) => setTimeout(res, 50));
      const nurEins = document.querySelectorAll('.duell').length === 1 && document.querySelector('.duell').dataset.bot === BOTS[0].id;
      const drittesFertig = await Promise.race([d3.fertig.then(() => true), new Promise((res) => setTimeout(() => res(false), 100))]);
      d4.ueberspringe();
      return { bereitSofort, aktiv1, huelle, t1: Math.round(t1), block: Math.round(window.__block), aktiv2, lief, sofortWeg, warteZeit, nurEins, drittesFertig, fertig: window.__fertig.map((f) => f.art + (f.uebersprungen ? '!' : '')).join(), prot: window.__duellProtokoll.map((p) => p.art + ':' + p.ziele).join() };
    });
    pruefe('Kurzfassung ohne Partie: bereit sofort, aktivesDuell() gesetzt, nur eine unsichtbare Huelle, Ende an der harten Grenze (1,4 s), danach null',
      r.bereitSofort && r.aktiv1 && r.huelle && r.t1 >= 1380 && r.t1 <= 1700 + r.block && r.aktiv2 === null, JSON.stringify(r));
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
  await testeHandyQuer(browser);
  await testeKnopftext(browser);
  await testeWelten(browser);
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
