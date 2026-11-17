// Feinschliff R19, Paket 1c "Verlauf neu" (Flo 15.11.2026 zu crownmate.de/#verlauf: "muss ueberarbeitet werden",
// Leitlinie R19-Design-Leitlinie.md, Zeile "Gegner und Verlauf"): Partien ohne Zug als EINE aufklappbare Zeile,
// Zu zweit und Online mit eigenem Bild, Ergebnis als farbiges Zeichen statt Plakette (Grund klein), Muelleimer leise,
// EINE Staerke-Zahl mit kurzer Erklaerung im Statistik-Kopf, Level-Karte im selben Rahmen, ohne Technik-Saetze.
// Browser-Test (Playwright, Chromium) gegen tests/screens.html mit eigenen Testpartien.
//
//   node tests/r19-verlauf-neu.test.mjs
//   node tests/r19-verlauf-neu.test.mjs --bilder=<ordner> --name=vorher   Bilder iPhone 13, SE, iPad, PC, hell und dunkel
//   node tests/r19-verlauf-neu.test.mjs --speicher=<datei.js>             dazu Vorlauf fuer design-beweis (Testpartien)
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
  console.log(`${ok ? 'ok  ' : 'FEHLER'} ${gruppe ? gruppe + ': ' : ''}${name}${!ok && detail ? ' (' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) + ')' : ''}`);
}
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

let SPEICHER;
async function neueSeite(browser, { breite = 1280, hoehe = 800, touch = false, bewegung = 'no-preference', schema = 'light', speicher = SPEICHER } = {}) {
  const kontext = await browser.newContext({
    viewport: { width: breite, height: hoehe }, hasTouch: touch, isMobile: false, reducedMotion: bewegung, colorScheme: schema,
    deviceScaleFactor: 1, ...(speicher ? { storageState: speicher } : {}),
  });
  await kontext.route('https://challenges.cloudflare.com/**', (route) => route.fulfill({ status: 200, contentType: 'text/javascript',
    body: 'window.turnstile = { render() { return "w1"; }, reset() {}, remove() {} };' }));
  const seite = await kontext.newPage();
  const fehler = [];
  seite.on('pageerror', (e) => fehler.push('pageerror: ' + e.message));
  seite.on('console', (m) => { if (m.type() === 'error') fehler.push('console: ' + m.text()); });
  return { kontext, seite, fehler };
}
async function oeffne(seite) {
  await seite.goto(`${BASIS}?screen=keiner`);
  await seite.waitForFunction(() => window.testseiteBereit === true);
  // die Testseite setzt kein data-modus; "system" laesst colorScheme des Kontexts entscheiden wie in der App
  await seite.evaluate(() => { document.documentElement.dataset.modus = 'system'; });
  await seite.waitForTimeout(600);
}
// Verlauf wie in der App: Paket funken (Level-Karte im Ort verlauf:seite) geladen; mitLiga legt eine Karte im Stil der
// alten Liga-Wertung davor (Reihenfolge 20 wie js/pakete/liga/index.js), die mit so/R19-liga-neu entfaellt
async function zeigeVerlauf(seite, { mitLiga = false } = {}) {
  await seite.evaluate(async (liga) => {
    await import('/js/pakete/funken/index.js');
    if (liga) {
      const o = await import('/js/orte.js');
      o.anbieten('verlauf:seite', () => {
        const s = document.createElement('section');
        s.className = 'liga-verlauf liga-karte';
        s.innerHTML = '<h3>Deine Liga-Wertung</h3><p class="liga-wertung zahl">≈ 1026 ± 50</p>';
        return s;
      }, { reihenfolge: 20, paket: 'liga-test' });
    }
    testseite.starte('verlauf');
  }, mitLiga);
  await seite.waitForSelector('.vl-screen .vl-liste');
  await warte(400);
}

// ---------------------------------------------------------------------------
// Testpartien: drei Bot-Partien mit Zuegen (Sieg, Remis, Niederlage durch Aufgabe), zwei ohne Zug, eine Zu-zweit-Partie,
// eine Online-Partie
async function testeDaten(browser) {
  gruppe = 'Testdaten';
  const { kontext, seite, fehler } = await neueSeite(browser, { speicher: null });
  await oeffne(seite);
  const d = await seite.evaluate(() => {
    testseite.leere();
    const sp = testseite.speicher;
    const stufe = (id) => testseite.BOTS.find((b) => b.id === id)?.stufe;
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const zuege = ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'g8f6', 'd2d3', 'f8c5'];
    const san = ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'd3', 'Bc5'];
    const jetzt = Date.now();
    const ids = {};
    const lege = (name, o, minuten) => {
      const t = new Date(jetzt - minuten * 60e3);
      const mitZug = o.zuege !== undefined ? o.zuege : zuege;
      const p = { id: sp.neueId(t), datum: t.toISOString(), startFen: fen, spielerFarbe: 'w', hinweise: 0, zuruecknahmen: 0,
        zuege: mitZug, san: o.san !== undefined ? o.san : san, liveKlassen: mitZug.map(() => null), ...o };
      ids[name] = sp.speicherePartie(p).partie.id;
    };
    lege('sieg', { botId: 'benno', botStufe: stufe('benno'), ergebnis: 'sieg', grund: 'matt', genauigkeit: 81.6, spielstaerke: 1500 }, 10);
    lege('niederlage', { botId: 'rudi', botStufe: stufe('rudi'), ergebnis: 'niederlage', grund: 'aufgabe', genauigkeit: 78.2, spielstaerke: 1400 }, 20);
    lege('remis', { botId: 'benno', botStufe: stufe('benno'), ergebnis: 'remis', grund: 'wiederholung', genauigkeit: 66.8, spielstaerke: 1300 }, 30);
    lege('ohne1', { botId: 'rudi', botStufe: stufe('rudi'), ergebnis: 'niederlage', grund: 'aufgabe', zuege: [], san: [] }, 40);
    lege('ohne2', { botId: 'benno', botStufe: stufe('benno'), ergebnis: 'niederlage', grund: 'aufgabe', zuege: [], san: [] }, 50);
    lege('zuzweit', { modus: 'zuzweit', zuzweit: { weiss: 'Anna', schwarz: 'Ben' }, ergebnis: 'sieg', grund: 'aufgabe', genauigkeit: 40.4 }, 60);
    lege('online', { modus: 'zuzweit', online: { gewertet: true }, zuzweit: { weiss: 'Gegner_2', schwarz: 'Flo' }, spielerFarbe: 'b',
      ergebnis: 'niederlage', grund: 'matt' }, 70);
    return { ids, n: sp.ladePartien().length };
  });
  pruefe('Sieben Testpartien gespeichert', d.n === 7 && Object.values(d.ids).every(Boolean), d);
  SPEICHER = await kontext.storageState();
  if (arg('speicher')) {
    const eintraege = SPEICHER.origins.flatMap((o) => o.localStorage);
    writeFileSync(arg('speicher'), `// erzeugt von tests/r19-verlauf-neu.test.mjs --speicher\n`
      + `for (const [k, v] of ${JSON.stringify(eintraege.map((e) => [e.name, e.value]))}) localStorage.setItem(k, v);\n`
      + `document.addEventListener('DOMContentLoaded', () => { document.documentElement.dataset.modus = 'system'; });\n`);
  }
  pruefe('Keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
  await kontext.close();
  return d;
}

// Kontrast im Browser: Farbe gegen den naechsten deckenden Grund
const MESSEN = `
  window.__rgb = (c) => (c.match(/[\\d.]+/g) || []).map(Number);
  window.__lum = (c) => { const v = __rgb(c).slice(0, 3).map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
  window.__k = (a, b) => { const [x, y] = [__lum(a), __lum(b)].sort((p, q) => q - p); return Math.round((x + 0.05) / (y + 0.05) * 100) / 100; };
  window.__grund = (el) => { for (let e = el; e; e = e.parentElement) { const c = getComputedStyle(e).backgroundColor; const r = __rgb(c); if (r.length === 3 || r[3] === 1) return c; } return 'rgb(255, 255, 255)'; };
`;

// (K1) Partien ohne Zug: eine aufklappbare Zeile mit Anzahl, aufgeklappt oeffen- und loeschbar
async function testeOhneZug(browser, d) {
  gruppe = 'Ohne Zug';
  const { kontext, seite, fehler } = await neueSeite(browser);
  await oeffne(seite);
  await zeigeVerlauf(seite);
  const vorher = await seite.evaluate((ids) => {
    const sichtbar = (el) => !!el && el.getClientRects().length > 0;
    const zeile = (id) => document.querySelector(`.vl-zeile[data-id="${id}"]`);
    const knopf = document.querySelector('.vl-ohne');
    return {
      ohneSichtbar: [ids.ohne1, ids.ohne2].map((id) => sichtbar(zeile(id))),
      mitSichtbar: [ids.sieg, ids.niederlage, ids.remis, ids.zuzweit, ids.online].map((id) => sichtbar(zeile(id))),
      knoepfe: document.querySelectorAll('.vl-ohne').length,
      text: knopf ? knopf.textContent.replace(/\s+/g, ' ').trim() : null,
      offen: knopf ? knopf.getAttribute('aria-expanded') : null,
      steuert: knopf ? !!document.getElementById(knopf.getAttribute('aria-controls') || '-') : false,
      hoehe: knopf ? Math.round(knopf.getBoundingClientRect().height) : 0,
    };
  }, d.ids);
  pruefe('Partien ohne Zug nicht einzeln sichtbar', vorher.ohneSichtbar.every((x) => !x), vorher);
  pruefe('Partien mit Zuegen alle sichtbar', vorher.mitSichtbar.every(Boolean), vorher);
  pruefe('EINE Sammelzeile mit Anzahl 2', vorher.knoepfe === 1 && /\b2\b/.test(vorher.text || '') && vorher.offen === 'false' && vorher.steuert, vorher);
  pruefe('Sammelzeile gross genug zum Tippen (>= 44 px)', vorher.hoehe >= 44, String(vorher.hoehe));
  await seite.click('.vl-ohne');
  await warte(300);
  const auf = await seite.evaluate((ids) => ({
    offen: document.querySelector('.vl-ohne').getAttribute('aria-expanded'),
    sichtbar: [ids.ohne1, ids.ohne2].map((id) => document.querySelector(`.vl-zeile[data-id="${id}"]`)?.getClientRects().length > 0),
  }), d.ids);
  pruefe('Aufklappen zeigt beide', auf.offen === 'true' && auf.sichtbar.every(Boolean), auf);
  // Loeschen einer aufgeklappten Partie mit Bestaetigung
  await seite.locator(`.vl-zeile[data-id="${d.ids.ohne2}"] .vl-muell`).click();
  pruefe('Löschen fragt nach', await seite.locator('.vl-dialog').isVisible());
  await seite.click('[data-aktion="dialog-ok"]');
  await warte(600);
  const nach = await seite.evaluate((ids) => ({
    weg: testseite.speicher.ladePartie(ids.ohne2) === null,
    text: document.querySelector('.vl-ohne')?.textContent.replace(/\s+/g, ' ').trim() || null,
  }), d.ids);
  pruefe('Gelöscht, Sammelzeile zählt 1', nach.weg && /\b1\b/.test(nach.text || ''), nach);
  // Oeffnen der aufgeklappten Partie fuehrt in die Analyse
  const offenNoch = await seite.evaluate(() => document.querySelector('.vl-ohne')?.getAttribute('aria-expanded'));
  if (offenNoch !== 'true') await seite.click('.vl-ohne');
  await seite.locator(`.vl-zeile[data-id="${d.ids.ohne1}"] .vl-oeffnen`).click();
  const g = await seite.evaluate(() => testseite.protokoll.filter((x) => x.art === 'zeige').pop());
  pruefe('Partie ohne Zug öffnet die Analyse', g && g.name === 'analyse' && g.params.partieId === d.ids.ohne1, g);
  pruefe('Keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
  await kontext.close();
}

// (K2) Zeilen: eigenes Bild, Ergebniszeichen, Grund klein, Muelleimer leise, Tipp oeffnet die Analyse
async function testeZeilen(browser, d) {
  for (const schema of ['light', 'dark']) {
    gruppe = `Zeilen ${schema === 'dark' ? 'dunkel' : 'hell'}`;
    const { kontext, seite, fehler } = await neueSeite(browser, { schema });
    await oeffne(seite);
    await zeigeVerlauf(seite);
    await seite.addScriptTag({ content: MESSEN });
    const z = await seite.evaluate((ids) => {
      const zeile = (id) => document.querySelector(`.vl-zeile[data-id="${id}"]`);
      const bild = (id) => { const a = zeile(id).querySelector('.an-avatar'); return a ? { kinder: a.querySelectorAll('svg, img').length, breite: Math.round(a.getBoundingClientRect().width) } : null; };
      const zeichen = (id) => {
        const e = zeile(id).querySelector('.vl-ergebnis');
        if (!e) return null;
        const cs = getComputedStyle(e);
        const svg = e.querySelector('svg');
        const r = e.getBoundingClientRect();
        // Vorleser hoeren das aria-label des Knopfs (das Zeichen selbst ist aria-hidden, sonst doppelt)
        const knopf = zeile(id).querySelector('.vl-oeffnen');
        return { art: e.dataset.ergebnis, text: knopf ? knopf.getAttribute('aria-label') || '' : '', versteckt: e.getAttribute('aria-hidden') === 'true',
          hg: cs.backgroundColor, form: svg ? svg.innerHTML : '',
          kante: __k(cs.backgroundColor, __grund(e.parentElement)), glyph: svg ? __k(getComputedStyle(svg).color, cs.backgroundColor) : 0,
          gross: Math.round(r.width), rund: cs.borderRadius };
      };
      const muell = zeile(ids.niederlage).querySelector('.vl-muell');
      const mcs = getComputedStyle(muell);
      const grund = zeile(ids.niederlage).querySelector('.vl-grund');
      return {
        bilder: { zuzweit: bild(ids.zuzweit), online: bild(ids.online), bot: bild(ids.sieg) },
        zeichen: { sieg: zeichen(ids.sieg), remis: zeichen(ids.remis), niederlage: zeichen(ids.niederlage), zuzweit: zeichen(ids.zuzweit), online: zeichen(ids.online) },
        grund: grund ? { text: grund.textContent.trim(), px: parseFloat(getComputedStyle(grund).fontSize), imZeichen: /Aufgabe/.test(zeile(ids.niederlage).querySelector('.vl-ergebnis')?.textContent || '') } : null,
        muell: { hg: mcs.backgroundColor, schatten: mcs.boxShadow, k: __k(mcs.color, __grund(muell.parentElement)),
          gross: Math.round(muell.getBoundingClientRect().width), label: muell.getAttribute('aria-label') },
        plakette: document.querySelectorAll('.vl-z1 .vl-ergebnis').length,
      };
    }, d.ids);
    pruefe('Zu zweit mit eigenem Bild', z.bilder.zuzweit && z.bilder.zuzweit.kinder >= 1, z.bilder);
    pruefe('Online mit eigenem Bild', z.bilder.online && z.bilder.online.kinder >= 1, z.bilder);
    const drei = [z.zeichen.sieg, z.zeichen.remis, z.zeichen.niederlage];
    pruefe('Ergebnis je Zeile für Vorleser im Knopf-Label, Zeichen selbst nur Bild', drei.every((x) => x && /Sieg|Remis|Niederlage/.test(x.text) && x.versteckt), drei.map((x) => x && [x.text, x.versteckt]));
    pruefe('Drei Formen und drei Farben', new Set(drei.map((x) => x && x.form)).size === 3 && new Set(drei.map((x) => x && x.hg)).size === 3, drei);
    pruefe('Zeichen hebt sich ab (>= 3:1) und Glyphe lesbar (>= 4,5:1)', drei.every((x) => x.kante >= 3 && x.glyph >= 4.5), drei.map((x) => [x.kante, x.glyph]));
    pruefe('Zeichen mindestens 24 px', drei.every((x) => x.gross >= 24), drei.map((x) => x.gross));
    pruefe('Zu zweit: Zeichen in Weiß, das Label nennt den Sieger', z.zeichen.zuzweit && z.zeichen.zuzweit.art === 'weiss' && /Anna/.test(z.zeichen.zuzweit.text), z.zeichen.zuzweit);
    pruefe('Online: Zeichen Niederlage', z.zeichen.online && z.zeichen.online.art === 'niederlage', z.zeichen.online);
    pruefe('Keine Plakette mehr neben dem Namen', z.plakette === 0, String(z.plakette));
    pruefe('Grund klein in der Nebenzeile (<= 13 px), nicht im Zeichen', z.grund && /Aufgabe/.test(z.grund.text) && z.grund.px <= 13 && !z.grund.imZeichen, z.grund);
    pruefe('Mülleimer leise: ohne Fläche und Schatten', /rgba\(0, 0, 0, 0\)|transparent/.test(z.muell.hg) && (z.muell.schatten === 'none' || !z.muell.schatten), z.muell);
    pruefe('Mülleimer erkennbar (>= 3:1) und tippbar (>= 24 px), mit Namen', z.muell.k >= 3 && z.muell.gross >= 24 && /löschen/i.test(z.muell.label || ''), z.muell);
    // Kaltreview 9c (Entscheid a5 16.11.): der Vertrag nennt Zeiger und Fokus, also auch in diesen Zuständen messen
    const muellSel = `.vl-zeile[data-id="${d.ids.niederlage}"] .vl-muell`;
    const muellZustand = () => seite.evaluate((sel) => {
      const m = document.querySelector(sel);
      const cs = getComputedStyle(m);
      return { hg: cs.backgroundColor, schatten: cs.boxShadow, k: __k(cs.color, __grund(m.parentElement)), sichtbar: m.getClientRects().length > 0 && cs.opacity !== '0' && cs.visibility !== 'hidden',
        hover: m.matches(':hover'), fokus: m.matches(':focus-visible') };
    }, muellSel);
    await seite.hover(muellSel);
    await warte(250);
    const mh = await muellZustand();
    pruefe('Mülleimer unter dem Zeiger: ohne Fläche, sichtbar, >= 3:1', mh.hover && /rgba\(0, 0, 0, 0\)|transparent/.test(mh.hg) && (mh.schatten === 'none' || !mh.schatten) && mh.sichtbar && mh.k >= 3, mh);
    await seite.mouse.move(0, 0);
    await seite.keyboard.press('Shift');
    await seite.focus(muellSel);
    await warte(250);
    const mf = await muellZustand();
    pruefe('Mülleimer mit Tastatur-Fokus: ohne Fläche, sichtbar, >= 3:1', mf.fokus && /rgba\(0, 0, 0, 0\)|transparent/.test(mf.hg) && mf.sichtbar && mf.k >= 3, mf);
    await seite.evaluate(() => document.activeElement && document.activeElement.blur());
    if (schema === 'light') {
      // Knopf mit Bestaetigung, Abbrechen behaelt
      const vorher = await seite.locator('.vl-zeile').count();
      await seite.locator(`.vl-zeile[data-id="${d.ids.remis}"] .vl-muell`).click();
      pruefe('Mülleimer fragt nach', await seite.locator('.vl-dialog').isVisible());
      await seite.click('[data-aktion="dialog-ab"]');
      pruefe('Abbrechen behält die Partie', (await seite.locator('.vl-zeile').count()) === vorher);
      // Wischen bleibt
      const b = await seite.locator(`.vl-zeile[data-id="${d.ids.sieg}"] .vl-vorne`).boundingBox();
      await seite.mouse.move(b.x + b.width * 0.7, b.y + b.height / 2);
      await seite.mouse.down();
      await seite.mouse.move(b.x + b.width * 0.5, b.y + b.height / 2 + 2, { steps: 5 });
      await seite.mouse.move(b.x + b.width * 0.7 - 150, b.y + b.height / 2 + 3, { steps: 5 });
      await seite.mouse.up();
      await warte(350);
      pruefe('Wischen zeigt "Löschen"', await seite.locator(`.vl-zeile[data-id="${d.ids.sieg}"]`).evaluate((el) => el.classList.contains('offen')));
      await seite.locator(`.vl-zeile[data-id="${d.ids.sieg}"] .vl-oeffnen`).click();
      await warte(300);
      // jede Zeile fuehrt in die Analyse: Zu zweit
      await seite.locator(`.vl-zeile[data-id="${d.ids.zuzweit}"] .vl-oeffnen`).click();
      const g = await seite.evaluate(() => testseite.protokoll.filter((x) => x.art === 'zeige').pop());
      pruefe('Tipp auf die Zeile öffnet die Analyse', g && g.name === 'analyse' && g.params.partieId === d.ids.zuzweit, g);
    }
    pruefe('Keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }
}

// (K3) Statistik-Kopf mit EINER Staerke-Zahl samt Erklaerung, Level-Karte im selben Rahmen, ohne Technik-Saetze;
// mit und ohne Liga-Karte
async function testeKopf(browser) {
  for (const mitLiga of [false, true]) {
    gruppe = `Kopf ${mitLiga ? 'mit' : 'ohne'} Liga-Karte`;
    const { kontext, seite, fehler } = await neueSeite(browser);
    await oeffne(seite);
    await zeigeVerlauf(seite, { mitLiga });
    const k = await seite.evaluate(() => {
      const stat = document.querySelector('.vl-statistik');
      const ort = document.querySelector('.vl-seite .vl-ort');
      const fk = ort && ort.querySelector('.fk-karte');
      const st = stat && stat.querySelector('.vl-staerke');
      const rahmen = (el) => { const c = getComputedStyle(el); return [c.borderTopLeftRadius, c.boxShadow, c.borderTopWidth].join(' | '); };
      const text = document.querySelector('.vl-screen').textContent;
      return {
        staerken: stat ? stat.querySelectorAll('.vl-staerke').length : 0,
        staerkeText: st ? st.textContent.replace(/\s+/g, ' ').trim() : '',
        erklaerung: st ? (st.querySelector('.vl-staerke-text')?.textContent || '').trim() : '',
        bilanz: stat ? !!stat.querySelector('.vl-bilanz') : false,
        bilanzLabel: stat?.querySelector('.vl-bilanz')?.getAttribute('aria-label') || '',
        kachelStaerke: stat ? [...stat.querySelectorAll('.vl-kachel')].filter((x) => /Spielstärke|Elo|Wertung/.test(x.textContent)).length : 0,
        reihe: ort ? [ort.previousElementSibling?.className, ort.nextElementSibling?.className, ort.hidden] : null,
        level: fk ? { rahmen: rahmen(fk), stat: rahmen(stat), hg: getComputedStyle(fk).backgroundColor, stathg: getComputedStyle(stat).backgroundColor } : null,
        liga: !!document.querySelector('.vl-ort .liga-verlauf'),
        technik: /Rechenstand|Bot-Skala|vorläufig/.test(text),
      };
    });
    pruefe('EINE Stärke-Zahl im Kopf', k.staerken === 1 && k.kachelStaerke === 0 && /\d/.test(k.staerkeText), k);
    pruefe('Stärke mit kurzer Erklärung (10 bis 90 Zeichen)', k.erklaerung.length >= 10 && k.erklaerung.length <= 90, k.erklaerung);
    pruefe('Bilanz Siege, Remis, Niederlagen als Balken mit Vorlesetext', k.bilanz && /Sieg/.test(k.bilanzLabel) && /Niederlage/.test(k.bilanzLabel), k.bilanzLabel);
    pruefe('Reihenfolge Statistik, Pakete, Schatzkiste', k.reihe && /vl-statistik/.test(k.reihe[0]) && /vl-schatz/.test(k.reihe[1]) && k.reihe[2] === false, k.reihe);
    pruefe('Level-Karte im selben Rahmen wie der Kopf', k.level && k.level.rahmen === k.level.stat && k.level.hg === k.level.stathg, k.level);
    pruefe(mitLiga ? 'Liga-Karte steht, der Verlauf läuft' : 'Ohne Liga-Karte', k.liga === mitLiga, String(k.liga));
    pruefe('Keine Technik-Sätze', !k.technik);
    pruefe('Keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }
}

// Kaltreview 9c: eigene Bestaende. (a) 11 gewertete Bot-Partien, nur die aelteste analysiert: statistik() nimmt die 10
// neuesten, die Staerke bleibt leer, und der Satz muss genau das sagen. (c) Entscheid a5 16.11. (rueckholbar): nur Partien
// ohne Zug stehen trotzdem als EINE Zeile.
async function legeBestand(browser, art) {
  const { kontext, seite, fehler } = await neueSeite(browser, { speicher: null });
  await oeffne(seite);
  await seite.evaluate((art) => {
    testseite.leere();
    const sp = testseite.speicher;
    const stufe = testseite.BOTS.find((b) => b.id === 'benno')?.stufe;
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const jetzt = Date.now();
    const lege = (minuten, o) => {
      const t = new Date(jetzt - minuten * 60e3);
      sp.speicherePartie({ id: sp.neueId(t), datum: t.toISOString(), startFen: fen, spielerFarbe: 'w', hinweise: 0, zuruecknahmen: 0,
        botId: 'benno', botStufe: stufe, ergebnis: 'sieg', grund: 'matt', zuege: ['e2e4', 'e7e5'], san: ['e4', 'e5'], liveKlassen: [null, null], ...o });
    };
    if (art === 'alt-analysiert') {
      for (let i = 0; i < 10; i++) lege(10 + i, {});
      lege(100, { genauigkeit: 80, spielstaerke: 1500 });
    } else {
      lege(10, { ergebnis: 'niederlage', grund: 'aufgabe', zuege: [], san: [], liveKlassen: [] });
      lege(20, { ergebnis: 'niederlage', grund: 'aufgabe', zuege: [], san: [], liveKlassen: [] });
    }
  }, art);
  await zeigeVerlauf(seite);
  return { kontext, seite, fehler };
}
async function testeBestaende(browser) {
  gruppe = 'Stärke nur aus alter Analyse';
  {
    const { kontext, seite, fehler } = await legeBestand(browser, 'alt-analysiert');
    const e = await seite.evaluate(() => (document.querySelector('.vl-staerke .vl-staerke-text')?.textContent || '').trim());
    pruefe('Satz sagt, was die Rechnung braucht (letzte 10 Partien)', e === 'Erscheint, sobald eine deiner letzten 10 Partien gegen die Bots analysiert ist.', e);
    pruefe('Keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }
  gruppe = 'Nur Partien ohne Zug';
  {
    const { kontext, seite, fehler } = await legeBestand(browser, 'nur-ohne');
    const r = await seite.evaluate(() => ({
      knoepfe: document.querySelectorAll('.vl-ohne').length,
      text: document.querySelector('.vl-ohne')?.textContent.replace(/\s+/g, ' ').trim() || null,
      einzeln: [...document.querySelectorAll('.vl-zeile')].filter((z) => z.getClientRects().length > 0).length,
    }));
    pruefe('Nur Partien ohne Zug: EINE Sammelzeile mit Anzahl 2, keine einzeln sichtbar', r.knoepfe === 1 && /\b2\b/.test(r.text || '') && r.einzeln === 0, r);
    pruefe('Keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }
}

// Bilder fuer "Rueckholbar": iPhone 13, SE, iPad, PC, hell und dunkel
async function machBilder(browser) {
  gruppe = 'Bilder';
  let n = 0;
  for (const [geraet, breite, hoehe, touch] of [['iphone13', 390, 844, true], ['se', 375, 667, true], ['ipad', 820, 1180, true], ['pc', 1440, 900, false]]) {
    for (const schema of ['light', 'dark']) {
      const { kontext, seite } = await neueSeite(browser, { breite, hoehe, touch, schema });
      await oeffne(seite);
      await zeigeVerlauf(seite);
      const s = schema === 'dark' ? 'dunkel' : 'hell';
      await seite.screenshot({ path: path.join(BILDER, `${NAME}-${geraet}-${s}.png`) });
      n++;
      if (hoehe > breite) {
        await seite.evaluate(() => { const l = document.querySelector('.vl-haupt'); l.scrollIntoView({ block: 'start' }); });
        await warte(300);
        await seite.screenshot({ path: path.join(BILDER, `${NAME}-${geraet}-${s}-liste.png`) });
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
  if (BILDER) await machBilder(browser);
  await testeOhneZug(browser, d);
  await testeZeilen(browser, d);
  await testeKopf(browser);
  await testeBestaende(browser);
  const fehlend = ergebnisse.filter((r) => !r.ok);
  console.log(`\n${ergebnisse.length - fehlend.length}/${ergebnisse.length} bestanden in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  for (const f of fehlend) console.log('FEHLER: ' + f.name + (f.detail ? ' (' + (typeof f.detail === 'string' ? f.detail : JSON.stringify(f.detail)) + ')' : ''));
  code = fehlend.length ? 1 : 0;
} catch (e) {
  console.error(e);
  code = 1;
} finally {
  if (browser) await browser.close();
  server.kill();
}
process.exit(code);
