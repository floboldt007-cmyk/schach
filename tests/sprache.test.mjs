// Tests fuer die Sprachen der App (js/sprache.js, Woerterbuecher js/sprachen/*.js; Englische Version, Teil 1).
// Node-Teil: API (t, Platzhalter, Mehrzahl, Rueckfall auf Deutsch, Schluessel bei fehlendem Text), jedes Woerterbuch hat
// in beiden Sprachen dieselben Schluessel und Platzhalter, Texte ohne HTML und ohne lange Gedankenstriche, Einstellung
// sprache (Standard de, alte Staende gueltig), Regel "t() erst beim Zeichnen" (kein t() auf Modulebene).
// Browser-Teil (Playwright, Chromium, ?test&kern): die Kern-Screens auf Englisch (Arena mit Detail-Panel, Training,
// Bestenliste, Einstellungen, Verlauf, Partie mit Aufgeben und Ergebnis, Analyse, Raetsel-Bildschirm) zeigen keine
// deutschen Woerter, keine Umlaute und keine rohen Schluessel; hell und dunkel, iPad quer (1180 x 820) und Handy hoch
// (390 x 844), ohne Ueberlauf. Ohne Wahl bleibt alles deutsch.
//
//   node tests/sprache.test.mjs              alles
//   node tests/sprache.test.mjs --nur-node   ohne Browser
//   node tests/sprache.test.mjs --nur=arena,partie   nur diese Screens im Browser (Namen siehe SCREENS)
//   PORT=9730 BILDER=<ordner> node tests/sprache.test.mjs
process.env.TZ = 'Europe/Berlin';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { browserTyp } from './browser.mjs';

const require = createRequire(import.meta.url);
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8881);
// --pakete: mit allen Paketen aus PAKETE (Englisch Teil 2), sonst nur der Kern (?kern)
const PAKETE_MODUS = process.argv.includes('--pakete');
const BASIS = `http://127.0.0.1:${PORT}/index.html?test${PAKETE_MODUS ? '' : '&kern'}`;
const NUR_NODE = process.argv.includes('--nur-node');
const OHNE_BILDER = process.argv.includes('--ohne-bilder');
const NUR = (process.argv.find((a) => a.startsWith('--nur=')) || '').slice(6).split(',').filter(Boolean);
const BILDER = process.env.BILDER || path.join(os.tmpdir(), 'crownmate-bilder', 'sprache');
const lies = (d) => readFileSync(path.join(WURZEL, d), 'utf8');
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

const ergebnisse = [];
let gruppe = '';
function pruefe(name, ok, detail = '') {
  ergebnisse.push({ name: (gruppe ? gruppe + ': ' : '') + name, ok: !!ok, detail });
  console.log(`${ok ? 'ok  ' : 'FEHLER'} ${gruppe ? gruppe + ': ' : ''}${name}${!ok && detail ? ' (' + (typeof detail === 'string' ? detail : JSON.stringify(detail)).slice(0, 1500) + ')' : ''}`);
}

// ---------- Deutsch erkennen ----------
// Woerter, die es so im Englischen nicht gibt (klein geschrieben, ganze Woerter). Eigennamen (Bots, App) fallen vorher weg.
const DEUTSCH = ['und', 'der', 'die', 'das', 'den', 'dem', 'des', 'nicht', 'mit', 'ein', 'eine', 'einen', 'einer', 'zug',
  'partie', 'partien', 'spielen', 'spiel', 'gegen', 'weiter', 'heute', 'sterne', 'besiegt', 'gewonnen', 'verloren', 'stufe',
  'welt', 'welten', 'noch', 'alle', 'keine', 'kein', 'dein', 'deine', 'deinen', 'du', 'ist', 'sind', 'wird', 'auf', 'zu',
  'von', 'bei', 'nach', 'aus', 'im', 'oder', 'wie', 'hier', 'jetzt', 'schon', 'mehr', 'remis', 'matt', 'schach', 'aufgeben',
  'einstellungen', 'analyse', 'verlauf', 'bestenliste', 'neue', 'neu', 'ansicht', 'hell', 'dunkel', 'klang', 'fertig',
  'zeigen', 'gesperrt', 'offen', 'sieg', 'niederlage', 'bewertung', 'genauigkeit', 'fehler', 'patzer', 'bester', 'gut',
  'brett', 'figuren', 'tippen', 'ziehen', 'beides', 'immer', 'knapp', 'ausführlich', 'leer', 'gelöst', 'rätsel', 'lösung'];
const DEUTSCH_RE = new RegExp(`(^|[^\\p{L}])(${DEUTSCH.join('|')})(?=$|[^\\p{L}])`, 'iu');
const UMLAUT_RE = /[äöüÄÖÜß]/;
const SCHLUESSEL_RE = /\b[a-z][a-z0-9-]*(\.[a-zA-Z0-9-]+){2,}\b/;

async function nodeTeil() {
  const S = await import('../js/sprache.js');
  gruppe = 'API';
  S.registriereTexte('probe', {
    de: { hallo: 'Hallo {name}', 'zuege.eins': '{n} Zug', 'zuege.mehr': '{n} Züge', nurde: 'Nur Deutsch', zahl: '{wert:zahl} Punkte' },
    en: { hallo: 'Hello {name}', 'zuege.eins': '{n} move', 'zuege.mehr': '{n} moves', zahl: '{wert:zahl} points' },
  });
  pruefe('Standard Deutsch', S.sprache() === 'de' && S.t('probe.hallo', { name: 'Flo' }) === 'Hallo Flo');
  pruefe('Mehrzahl Deutsch', S.t('probe.zuege', { n: 1 }) === '1 Zug' && S.t('probe.zuege', { n: 3 }) === '3 Züge');
  pruefe('Zahl mit Tausenderpunkt', S.t('probe.zahl', { wert: 12500 }) === '12.500 Punkte', S.t('probe.zahl', { wert: 12500 }));
  S.setzeSprache('en');
  pruefe('Englisch: Platzhalter, Mehrzahl, Zahl', S.t('probe.hallo', { name: 'Flo' }) === 'Hello Flo' && S.t('probe.zuege', { n: 1 }) === '1 move'
    && S.t('probe.zuege', { n: 2 }) === '2 moves' && S.t('probe.zahl', { wert: 12500 }) === '12,500 points');
  pruefe('fehlt im Englischen: deutscher Text', S.t('probe.nurde') === 'Nur Deutsch');
  pruefe('fehlt ganz: der Schluessel', S.t('probe.gibtsnicht') === 'probe.gibtsnicht');
  pruefe('unbekannte Sprache: Deutsch', S.setzeSprache('fr') === 'de' && S.sprache() === 'de');
  pruefe('locale', S.locale() === 'de-DE' && (S.setzeSprache('en'), S.locale() === 'en-US'));
  S.setzeSprache('de');
  let warf = false;
  try { S.registriereTexte('Gross', {}); } catch (e) { warf = true; }
  pruefe('Bereichsname wird geprueft', warf);
  pruefe('Sprachwahl noch nicht sichtbar (Teil 1)', S.SPRACHWAHL === false);

  gruppe = 'Woerterbuecher';
  const ordner = path.join(WURZEL, 'js/sprachen');
  const dateien = existsSync(ordner) ? readdirSync(ordner).filter((d) => d.endsWith('.js')).sort() : [];
  pruefe('Woerterbuecher vorhanden', dateien.length >= 1, dateien);
  for (const d of dateien) await import(pathToFileURL(path.join(ordner, d)).href);
  const de = S.texte('de');
  const en = S.texte('en');
  const eigene = (o) => Object.keys(o).filter((k) => !k.startsWith('probe.'));
  const fehltEn = eigene(de).filter((k) => !(k in en));
  const fehltDe = eigene(en).filter((k) => !(k in de));
  pruefe('jeder deutsche Schluessel hat einen englischen Text', fehltEn.length === 0, fehltEn.slice(0, 30));
  pruefe('kein englischer Schluessel ohne deutschen', fehltDe.length === 0, fehltDe.slice(0, 30));
  const platz = (s) => [...s.matchAll(/\{([a-zA-Z0-9_]+)(:zahl)?\}/g)].map((m) => m[1]).sort().join(',');
  const platzFalsch = eigene(de).filter((k) => k in en && platz(de[k]) !== platz(en[k]));
  pruefe('Platzhalter gleich in beiden Sprachen', platzFalsch.length === 0, platzFalsch.slice(0, 20).map((k) => `${k}: ${de[k]} | ${en[k]}`));
  const html = eigene(en).filter((k) => /<[a-z/]/i.test(en[k]) || /<[a-z/]/i.test(de[k] || ''));
  pruefe('Texte ohne HTML', html.length === 0, html.slice(0, 20));
  const striche = eigene(en).filter((k) => /[—–]/.test(en[k]));
  pruefe('keine langen Gedankenstriche im Englischen', striche.length === 0, striche.slice(0, 20));
  const enDeutsch = eigene(en).filter((k) => UMLAUT_RE.test(en[k]));
  pruefe('englische Texte ohne Umlaute', enDeutsch.length === 0, enDeutsch.slice(0, 20).map((k) => `${k}: ${en[k]}`));
  const fremd = eigene(en).filter((k) => /\b(brilliant|great move|blunder|inaccuracy|mistake|best move|excellent|book move)\b/i.test(en[k]));
  pruefe('keine Zugklassen-Namen fremder Schachseiten', fremd.length === 0, fremd.slice(0, 20).map((k) => `${k}: ${en[k]}`));

  gruppe = 'Regeln';
  // t() auf Modulebene haelt die Sprache von vor dem Start fest: nur innerhalb von Funktionen erlaubt (grobe Pruefung:
  // keine Zeile ohne Einrueckung, die t( aufruft, ausser in Funktionskoepfen)
  const kandidaten = [...readdirSync(path.join(WURZEL, 'js')).filter((d) => d.endsWith('.js')).map((d) => 'js/' + d),
    ...readdirSync(path.join(WURZEL, 'js/ui')).filter((d) => d.endsWith('.js')).map((d) => 'js/ui/' + d)];
  const modulEbene = [];
  for (const d of kandidaten) {
    const text = lies(d);
    if (!/from '\.{1,2}\/(\.\.\/)?sprache\.js'/.test(text)) continue;
    text.split('\n').forEach((z, i) => {
      if (/^(export )?(const|let|var) [^=]+= .*\bt\(['`]/.test(z)) modulEbene.push(`${d}:${i + 1}`);
    });
  }
  pruefe('kein t() auf Modulebene (Texte erst beim Zeichnen)', modulEbene.length === 0, modulEbene);

  gruppe = 'Einstellung';
  const st = await import('../js/storage.js');
  pruefe('Standard sprache de, erlaubt de und en', st.STANDARD_EINSTELLUNGEN.sprache === 'de'
    && JSON.stringify(st.EINSTELLUNG_WERTE.sprache) === '["de","en"]');
  gruppe = '';
}

// ---------------------------------------------------------------------
// Browser
// ---------------------------------------------------------------------
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
    try { const r = await fetch(url); if (r.ok) return; } catch (e) { /* noch nicht da */ }
    await warte(150);
  }
  throw new Error('Server startet nicht: ' + url);
}

async function neueSeite(browser, { w = 1180, h = 820, handy = false, dunkel = false } = {}) {
  const kontext = await browser.newContext({
    viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: handy, isMobile: handy, colorScheme: dunkel ? 'dark' : 'light',
    timezoneId: 'Europe/Berlin',
  });
  const seite = await kontext.newPage();
  const fehler = [];
  seite.on('console', (m) => {
    const url = (m.location() && m.location().url) || '';
    if (/favicon/.test(url)) return;
    if (m.type() === 'error' || (m.type() === 'warning' && /sprache: Text fehlt/.test(m.text()))) fehler.push(m.text() + (url ? ' @ ' + url : ''));
  });
  seite.on('pageerror', (e) => fehler.push('Seitenfehler: ' + e.message));
  return { kontext, seite, fehler };
}

const bild = async (seite, name) => { if (OHNE_BILDER) return; await warte(500); await seite.screenshot({ path: path.join(BILDER, name + '.png') }); };

// Sichtbarer Text eines Bereichs ohne Eigennamen (Bots, App, Engine)
async function sichtbarerText(seite, sel = '#app') {
  return seite.evaluate(async (s) => {
    const { BOTS } = await import('/js/bots.js');
    const namen = [...new Set(BOTS.flatMap((b) => [b.rufname, b.id]).filter(Boolean))].sort((a, b) => b.length - a.length);
    const wurzel = document.querySelector(s) || document.body;
    const teile = [];
    const lauf = document.createTreeWalker(wurzel, NodeFilter.SHOW_TEXT);
    while (lauf.nextNode()) {
      const n = lauf.currentNode;
      const el = n.parentElement;
      if (!el || !n.textContent.trim()) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || el.closest('[hidden],[aria-hidden="true"]')) continue;
      if (el.closest('script,style,svg')) continue;
      teile.push(n.textContent.trim());
    }
    // Attribute, die Bedienhilfen vorlesen
    for (const el of wurzel.querySelectorAll('[aria-label],[title],[placeholder],img[alt]')) {
      for (const a of ['aria-label', 'title', 'placeholder', 'alt']) if (el.getAttribute(a)) teile.push(el.getAttribute(a));
    }
    let text = teile.join(' | ');
    // nur ganze Woerter entfernen (sonst wird aus "Königsbauernspiel" mit dem Rufnamen "König" ein harmloses "sbauernspiel")
    for (const n of ['Crownmate', 'Stockfish', ...namen]) {
      text = text.replace(new RegExp(`(?<![\\p{L}])${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}])`, 'gu'), ' ');
    }
    return text;
  }, sel);
}

function deutschIn(text) {
  const treffer = [];
  for (const teil of text.split(/ \| |\n/)) {
    if (UMLAUT_RE.test(teil) || DEUTSCH_RE.test(teil) || SCHLUESSEL_RE.test(teil)) treffer.push(teil.slice(0, 80));
  }
  return [...new Set(treffer)];
}

async function keinUeberlauf(seite) {
  return seite.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth + 1);
}

async function bereite(seite, hash = '#arena') {
  await seite.goto(BASIS + '#arena');
  await seite.evaluate(() => localStorage.clear());
  await seite.goto(BASIS + '&sprache=en' + hash);
  await seite.waitForFunction(() => !!window.__app && document.documentElement.lang === 'en' && !!document.querySelector('#app > .screen:not(.lade-screen)'), null, { timeout: 20000 });
  await warte(500);
}

async function feld(seite, f) {
  const b = await seite.locator(`.screen.partie .brett-felder .feld[data-feld="${f}"]`).boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

// Screens: Name, wie man hinkommt, welcher Bereich gelesen wird
const SCREENS_KERN = [
  { name: 'arena', hin: async (s) => { await bereite(s, '#arena'); await s.waitForSelector('.screen.arena .knoten', { timeout: 15000 }); }, sel: '#app' },
  { name: 'training', hin: async (s) => { await bereite(s, '#training'); }, sel: '#app' },
  { name: 'bestenliste', hin: async (s) => { await bereite(s, '#bestenliste'); }, sel: '#app' },
  { name: 'einstellungen', hin: async (s) => { await bereite(s, '#einstellungen'); }, sel: '#app' },
  { name: 'verlauf', hin: async (s) => { await bereite(s, '#arena'); await s.evaluate(() => window.__app.gehe('verlauf')); await warte(600); }, sel: '#app' },
  { name: 'raetsel', hin: async (s) => {
    await bereite(s, '#arena');
    await s.evaluate(() => window.__app.gehe('raetsel', { liste: [{ id: 'p1', fen: 'k7/8/1K6/8/8/8/8/7Q w - - 0 1', loesung: ['h1h8'] }] }));
    await s.waitForSelector('.screen.rs-screen .brett', { timeout: 10000 });
    await warte(600);
  }, sel: '#app' },
  { name: 'partie', hin: async (s) => {
    await bereite(s, '#arena');
    await s.evaluate(() => window.__app.gehe('partie', { botId: 'benno', farbe: 'w' }));
    await s.waitForFunction(() => window.__partie && window.__partie.bereit === true && window.__partie.phase() === 'flo', null, { timeout: 30000 });
    for (const f of ['e2', 'e4']) { const p = await feld(s, f); await s.mouse.click(p.x, p.y); await warte(150); }
    await s.waitForFunction(() => window.__partie.phase() === 'flo' && window.__partie.z.zuege.length >= 2, null, { timeout: 30000 });
    await warte(800);
  }, sel: '#app' },
  { name: 'ergebnis', hin: async (s) => {
    await SCREENS_KERN.find((x) => x.name === 'partie').hin(s);
    const k = s.locator('.spielknoepfe > [data-aktion="aufgeben"]');
    await k.focus();
    await s.keyboard.press('Enter');
    await s.waitForSelector('.dialog-ort .dialog', { timeout: 5000 });
    await s.locator('.dialog-knoepfe .knopf.gefahr').click();
    await s.waitForSelector('.ergebnis-overlay.gefuellt', { timeout: 30000 });
    await warte(1500);
  }, sel: 'body' },
  { name: 'analyse', hin: async (s) => {
    await SCREENS.find((x) => x.name === 'ergebnis').hin(s);
    await s.locator('.erg-knoepfe [data-ziel="analyse"]').click();
    await s.waitForFunction(() => location.hash.startsWith('#analyse/'), null, { timeout: 10000 });
    await warte(2500);
  }, sel: '#app' },
];
// Nur mit --pakete: Screens und Blaetter der Pakete
const SCREENS_PAKETE = [
  { name: 'willkommen', hin: async (s) => {
    await s.goto(BASIS + '#arena');
    await s.evaluate(() => localStorage.clear());
    await s.goto(BASIS + '&sprache=en');
    await s.waitForFunction(() => !!window.__app && document.documentElement.lang === 'en' && !!document.querySelector('#app > .screen:not(.lade-screen)'), null, { timeout: 20000 });
    await warte(800);
  }, sel: '#app' },
  { name: 'einstufung', hin: async (s) => { await bereite(s, '#arena'); await s.evaluate(() => window.__app.gehe('start', { seite: 'einstufung' })); await warte(800); }, sel: '#app' },
  { name: 'tagesraetsel', hin: async (s) => {
    await bereite(s, '#training');
    await s.waitForSelector('.tr-karte .tr-los', { timeout: 15000 });
    await s.locator('.tr-karte .tr-los').click();
    await s.waitForSelector('.screen.rs-screen .brett', { timeout: 10000 });
    await warte(800);
  }, sel: '#app' },
  // Blaetter hinter den Chips im Kopf der Arena (Level, Serie ...): jedes oeffnen, Text sammeln, schliessen
  { name: 'kopf-blaetter', hin: async (s) => {
    await bereite(s, '#arena');
    await s.waitForSelector('.screen.arena .knoten', { timeout: 15000 });
    // Chips der Pakete (Level, Serie ...); Sterne und Besiegt haben kein Blatt
    const CHIP = '#app .kopf-chips > .chip:not(.chip-sterne):not(.chip-pokal)';
    const n = await s.locator(CHIP).count();
    if (!n) throw new Error('kein Paket-Chip im Kopf');
    const texte = [];
    for (let i = 0; i < n; i++) {
      const b = s.locator(CHIP).nth(i);
      if (!(await b.isVisible())) continue;
      await b.click();
      await warte(900);
      texte.push(await s.evaluate(() => document.body.innerText));
      await s.keyboard.press('Escape');
      await warte(500);
    }
    await s.evaluate((x) => { const d = document.createElement('div'); d.id = 'gesammelt'; d.textContent = x.join(' | '); d.style.cssText = 'position:absolute;left:0;top:0;width:1px;height:1px;overflow:hidden'; document.body.append(d); }, texte);
  }, sel: '#gesammelt' },
];
const SCREENS = PAKETE_MODUS ? [...SCREENS_KERN, ...SCREENS_PAKETE] : SCREENS_KERN;

async function browserTeil(browser) {
  if (!OHNE_BILDER) mkdirSync(BILDER, { recursive: true });
  // Ohne Wahl bleibt alles deutsch
  gruppe = 'Deutsch bleibt';
  {
    const { kontext, seite } = await neueSeite(browser);
    await seite.goto(BASIS + '#einstellungen');
    await seite.waitForFunction(() => !!window.__app && !!document.querySelector('.screen'), null, { timeout: 20000 });
    await warte(400);
    pruefe('ohne Wahl: <html lang="de">, Einstellungen deutsch', await seite.evaluate(() => document.documentElement.lang) === 'de'
      && /Einstellungen/.test(await seite.locator('#app').innerText()));
    pruefe('Sprachwahl mit ?test sichtbar (Deutsch, English)', await seite.locator('[data-einstellung="sprache"] .es-seg').count() === 2);
    await seite.locator('[data-einstellung="sprache"] .es-seg[data-wert="en"]').click();
    await seite.waitForFunction(() => document.documentElement.lang === 'en', null, { timeout: 10000 });
    pruefe('Wahl English: Seite laedt neu und ist englisch', await seite.evaluate(() => JSON.parse(localStorage.getItem('schach-arena:v1:einstellungen')).sprache) === 'en');
    await kontext.close();
  }
  const ansichten = [['ipad-hell', {}], ['ipad-dunkel', { dunkel: true }], ['handy-hell', { w: 390, h: 844, handy: true }], ['handy-dunkel', { w: 390, h: 844, handy: true, dunkel: true }]];
  for (const sc of SCREENS) {
    if (NUR.length && !NUR.includes(sc.name)) continue;
    for (const [ansicht, opt] of ansichten) {
      // Inhalt nur einmal je Screen pruefen (iPad hell), Ueberlauf in allen Ansichten
      gruppe = `${sc.name} ${ansicht}`;
      const { kontext, seite, fehler } = await neueSeite(browser, opt);
      try {
        await sc.hin(seite);
        if (ansicht === 'ipad-hell') {
          const text = await sichtbarerText(seite, sc.sel);
          const treffer = deutschIn(text);
          pruefe('keine deutschen Woerter, Umlaute oder rohen Schluessel', treffer.length === 0, treffer.slice(0, 25));
          pruefe('keine fehlenden Texte und keine Konsolenfehler', fehler.length === 0, fehler.slice(0, 5));
        }
        pruefe('ohne Ueberlauf', await keinUeberlauf(seite));
        await bild(seite, `${sc.name}-${ansicht}`);
      } catch (e) {
        pruefe('Screen erreichbar', false, String(e && e.message).slice(0, 300));
      }
      await kontext.close();
    }
  }
  gruppe = '';
}

// =====================================================================
const t0 = Date.now();
let code = 1;
let server = null;
let browser = null;
try {
  await nodeTeil();
  if (!NUR_NODE) {
    server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: WURZEL, stdio: 'ignore' });
    await warteAufServer(`http://127.0.0.1:${PORT}/index.html`);
    browser = await browserTyp(ladePlaywright()).launch();
    await browserTeil(browser);
  }
  const fehlend = ergebnisse.filter((r) => !r.ok);
  console.log(`\n${ergebnisse.length - fehlend.length}/${ergebnisse.length} bestanden in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  for (const f of fehlend) console.log('FEHLER: ' + f.name);
  if (!NUR_NODE && !OHNE_BILDER) console.log('Bilder: ' + BILDER);
  code = fehlend.length ? 1 : 0;
} catch (e) {
  console.error(e);
  code = 1;
} finally {
  if (browser) await browser.close();
  if (server) server.kill();
}
process.exit(code);
