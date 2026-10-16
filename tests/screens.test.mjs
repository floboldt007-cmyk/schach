// Browser-Test fuer die Screens von Bau B: Spielanalyse, Verlauf, Einstellungen (Playwright, Chromium).
// Startet einen lokalen Server (Port 8832), oeffnet tests/screens.html (Fake-App) und prueft
// echte Ablaeufe mit echter Stockfish-Engine.
//
//   node tests/screens.test.mjs
//   node tests/screens.test.mjs --bilder=/pfad      Screenshots (Standard: design/app-shots/)
//   node tests/screens.test.mjs --ohne-bilder        keine Screenshots
//
// Playwright: Pfad per Umgebungsvariable PLAYWRIGHT_PFAD, sonst 'playwright' oder /opt/node-tools.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8832);
const BASIS = `http://127.0.0.1:${PORT}/tests/screens.html`;
const bilderArg = process.argv.find((a) => a.startsWith('--bilder='));
const BILDER = process.argv.includes('--ohne-bilder') ? '' : (bilderArg ? bilderArg.slice(9) : path.join(WURZEL, 'design/app-shots'));
if (BILDER) mkdirSync(BILDER, { recursive: true });

const VIEWPORTS = [
  ['ipad-quer', 1180, 820], ['ipad-hoch', 820, 1180], ['ipad-klein', 1024, 768],
  ['ipad-pro', 1366, 1024], ['handy', 390, 844], ['handy-se', 375, 667],
];

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

async function bild(seite, name) {
  if (!BILDER) return;
  await seite.screenshot({ path: path.join(BILDER, name + '.png') });
}

// Neue Seite mit Fehler-Sammler
// speicher: storageState mit den Testdaten (jeder Kontext hat sein eigenes localStorage)
let SPEICHER;
async function neueSeite(browser, { breite = 1180, hoehe = 820, touch = false, bewegung = 'no-preference', speicher = SPEICHER } = {}) {
  const kontext = await browser.newContext({
    viewport: { width: breite, height: hoehe }, hasTouch: touch, isMobile: false, reducedMotion: bewegung, deviceScaleFactor: 1,
    ...(speicher ? { storageState: speicher } : {}),
  });
  const seite = await kontext.newPage();
  const fehler = [];
  seite.on('pageerror', (e) => fehler.push('pageerror: ' + e.message));
  seite.on('console', (m) => { if (m.type() === 'error') fehler.push('console: ' + m.text()); });
  seite.on('requestfailed', (r) => fehler.push('request: ' + r.url()));
  return { kontext, seite, fehler };
}

async function oeffne(seite, query = 'screen=keiner') {
  await seite.goto(`${BASIS}?${query}`);
  await seite.waitForFunction(() => window.testseiteBereit === true);
}

const stand = (seite) => seite.locator('.an-stand').textContent();
const aktuellerPly = (seite) => seite.evaluate(() => {
  const s = document.querySelector('.an-kurve');
  return s ? Number(s.getAttribute('aria-valuenow')) - 1 : null;
});
const figurAuf = (seite, feld) => seite.evaluate((f) => {
  const el = document.querySelector(`.an-brett > img.figur[data-feld="${f}"]:not(.geht)`);
  return el ? el.dataset.figur : null;
}, feld);
const protokoll = (seite) => seite.evaluate(() => JSON.parse(JSON.stringify(testseite.protokoll)));

// Kein waagrechter Ueberlauf (Dokument und Screen)
const ueberlauf = (seite) => seite.evaluate(() => {
  const s = document.querySelector('.screen');
  const doc = document.scrollingElement.scrollWidth - innerWidth;
  const scr = s ? s.scrollWidth - s.clientWidth : 0;
  // sichtbare Elemente, die rechts aus dem Fenster ragen
  const raus = [...document.querySelectorAll('.screen *')].filter((el) => {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    if (el.closest('.an-momente, .vl-dialog-hg')) return false;
    return r.right > innerWidth + 1 || r.left < -1;
  }).slice(0, 3).map((el) => el.className.baseVal ?? el.className);
  return { doc, scr, raus };
});

// Zu kleine Tippflaechen (sichtbare Knoepfe unter 44 px)
const kleineKnoepfe = (seite) => seite.evaluate(() => [...document.querySelectorAll('.screen button')].filter((b) => {
  const r = b.getBoundingClientRect();
  if (!r.width || !r.height || getComputedStyle(b).visibility === 'hidden') return false;
  if (b.closest('.brett')) return false;
  return r.height < 43.5 || r.width < 43.5;
}).map((b) => `${b.className || b.tagName} ${Math.round(b.getBoundingClientRect().width)}x${Math.round(b.getBoundingClientRect().height)}`));

// ---------------------------------------------------------------------------
// Testdaten einmal anlegen (Opernpartie mit Review, Bot-Partie ohne Review)
// ---------------------------------------------------------------------------
async function legeDatenAn(seite) {
  return seite.evaluate(async () => {
    testseite.leere();
    testseite.app.setzeEinstellungen({ tiefe: 12 });
    const oper = await testseite.opernpartie({ mitReview: true, tiefe: 12 });
    const bot = await testseite.botPartie({ gegner: 'kalle', flo: 'greta', mitReview: false, datum: Date.now() - 86400e3 * 2 });
    return { oper: oper.id, bot: bot.id, botAnzahl: bot.anzahl, brillant: oper.ergebnis.brillant };
  });
}

// ---------------------------------------------------------------------------
async function testeDaten(browser) {
  gruppe = 'Testdaten';
  const { kontext, seite, fehler } = await neueSeite(browser, { speicher: null });
  await oeffne(seite);
  const t0 = Date.now();
  const d = await legeDatenAn(seite);
  pruefe('Opernpartie (mit Review) und Bot-Partie (ohne) angelegt', d.oper && d.bot && d.botAnzahl > 4, JSON.stringify(d));
  pruefe('Opernpartie hat einen Brillant-Zug für die Schatzkiste', d.brillant >= 1, String(d.brillant));
  console.log(`     (Testdaten in ${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  SPEICHER = await kontext.storageState();
  pruefe('Keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
  await kontext.close();
  return d;
}

// ---------------------------------------------------------------------------
async function testeAnalyse(browser, d) {
  gruppe = 'Analyse';
  const { kontext, seite, fehler } = await neueSeite(browser);
  await oeffne(seite);

  // --- ohne gespeicherte Review: Fortschritt, Speichern, zweiter Aufruf sofort
  const hatVorher = await seite.evaluate((id) => testseite.speicher.hatReview(id), d.bot);
  pruefe('Bot-Partie hat noch keine Review', !hatVorher);
  await oeffne(seite, `screen=analyse&partieId=${d.bot}`);
  await seite.waitForSelector('.an-laden', { timeout: 5000 });
  pruefe('Fortschrittsbalken sichtbar', await seite.locator('.an-fortschritt[role="progressbar"]').isVisible());
  await seite.waitForFunction(() => {
    const b = document.querySelector('.an-fortschritt');
    return b && Number(b.getAttribute('aria-valuenow')) > 0;
  }, null, { timeout: 30000 });
  const text = await seite.locator('.an-laden-text').textContent();
  pruefe('Fortschritt zaehlt Stellungen', /Stellung \d+ von \d+/.test(text), text);
  await bild(seite, 'analyse-rechnet');
  await seite.waitForSelector('.an-coach', { timeout: 90000 });
  const nachher = await seite.evaluate((id) => {
    const r = testseite.speicher.ladeReview(id);
    const p = testseite.speicher.ladePartie(id);
    return { review: !!r, zuege: r ? r.zuege.length : 0, gen: p.genauigkeit, er: p.eroeffnung };
  }, d.bot);
  pruefe('Review gespeichert', nachher.review && nachher.zuege === d.botAnzahl, JSON.stringify(nachher));
  pruefe('Partie um Genauigkeit und Eröffnung ergänzt', Number.isFinite(nachher.gen) && !!nachher.er, JSON.stringify(nachher));
  const t1 = Date.now();
  await oeffne(seite, `screen=analyse&partieId=${d.bot}`);
  const sofort = await seite.evaluate(() => !!document.querySelector('.an-coach') && !document.querySelector('.an-laden'));
  pruefe('Zweiter Aufruf sofort ohne Rechnen', sofort, `${Date.now() - t1} ms`);

  // --- Opernpartie (Review vorhanden)
  await oeffne(seite, `screen=analyse&partieId=${d.oper}`);
  pruefe('Mit Review sofort da', await seite.locator('.an-coach').isVisible() && !(await seite.locator('.an-laden').count()));
  pruefe('Kein Freischalt-Banner ohne Parameter', (await seite.locator('.an-banner').count()) === 0);
  const unter = await seite.locator('.an-unter').textContent();
  pruefe('Kopf: Gegner, Ergebnis, Grund', unter.includes('Ritter Rudi') && unter.includes('1:0') && unter.includes('Matt im 17. Zug'), unter);
  pruefe('Kein langer Gedankenstrich in den Texten', await seite.evaluate(() => !/[—–]/.test(document.querySelector('.screen').innerText)));
  pruefe('Startstellung, Stand "Start / 17"', (await stand(seite)) === 'Start / 17', await stand(seite));
  const chips = await seite.locator('.an-g-chips').textContent();
  pruefe('Chip "spielte wie ≈ …"', /spielte wie ≈ \d+/.test(chips), chips);
  pruefe('Eröffnung angezeigt', chips.includes('Philidor'), chips);
  pruefe('Genauigkeit beider Seiten', (await seite.locator('.an-g-wert.zahl').count()) === 2);
  pruefe('Elf Klassen-Zeilen plus "Züge gesamt"', (await seite.locator('.an-kl[data-klasse]').count()) === 11
    && (await seite.locator('.an-kl-gesamt').textContent()).includes('Züge gesamt'));
  const gesamt = await seite.locator('.an-kl-gesamt .an-n').allTextContents();
  pruefe('Züge gesamt 17 | 16', gesamt.join('|') === '17|16', gesamt.join('|'));
  pruefe('Nullen gedimmt', (await seite.locator('.an-kl.null').count()) >= 1);
  pruefe('Kurve mit Punkten und Phasen', (await seite.locator('.an-k-punkte i').count()) >= 2 && (await seite.locator('.an-phasen span').count()) >= 2);
  const momente = await seite.locator('.an-moment').count();
  pruefe('Schlüsselmomente als Chips', momente >= 1, String(momente));

  // --- Navigation per Knopf
  await seite.click('[data-aktion="vor-zug"]');
  pruefe('Vor: 1. e4', (await stand(seite)) === 'Zug 1 / 17' && (await figurAuf(seite, 'e4')) === 'wP');
  pruefe('Abzeichen am Zielfeld', await seite.evaluate(() => !!document.querySelector('.an-brett .abzeichen-ort[data-feld="e4"]')));
  await seite.click('[data-aktion="ende"]');
  pruefe('Ende: Zug 17, Td8#', (await stand(seite)) === 'Zug 17 / 17' && (await figurAuf(seite, 'd8')) === 'wR');
  pruefe('Vor-Knopf am Ende gesperrt', await seite.locator('[data-aktion="vor-zug"]').isDisabled());
  await seite.click('[data-aktion="zurueck-zug"]');
  pruefe('Zurück: 16… Sxb8', (await aktuellerPly(seite)) === 31 && (await figurAuf(seite, 'b8')) === 'bN');
  await seite.click('[data-aktion="anfang"]');
  pruefe('Anfang: Startstellung', (await aktuellerPly(seite)) === -1 && (await figurAuf(seite, 'e2')) === 'wP');

  // --- Tastatur
  await seite.keyboard.press('ArrowRight');
  await seite.keyboard.press('ArrowRight');
  pruefe('Pfeil rechts zweimal: Ply 1', (await aktuellerPly(seite)) === 1);
  await seite.keyboard.press('ArrowLeft');
  pruefe('Pfeil links: Ply 0', (await aktuellerPly(seite)) === 0);
  await seite.keyboard.press('End');
  pruefe('Ende-Taste: letzter Zug', (await aktuellerPly(seite)) === 32);
  await seite.keyboard.press('Home');
  pruefe('Pos1-Taste: Start', (await aktuellerPly(seite)) === -1);

  // --- Wischen ueber das Brett (Pointer)
  const br = await seite.locator('.an-brett').boundingBox();
  const y = br.y + br.height / 2;
  await seite.mouse.move(br.x + br.width * 0.75, y);
  await seite.mouse.down();
  await seite.mouse.move(br.x + br.width * 0.45, y + 6, { steps: 6 });
  await seite.mouse.move(br.x + br.width * 0.2, y + 8, { steps: 6 });
  await seite.mouse.up();
  pruefe('Wischen nach links: ein Zug vor', (await aktuellerPly(seite)) === 0);
  await seite.mouse.move(br.x + br.width * 0.2, y);
  await seite.mouse.down();
  await seite.mouse.move(br.x + br.width * 0.8, y - 5, { steps: 8 });
  await seite.mouse.up();
  pruefe('Wischen nach rechts: ein Zug zurück', (await aktuellerPly(seite)) === -1);

  // --- Kurve antippen
  const kb = await seite.locator('.an-kurve-wrap').boundingBox();
  await seite.mouse.click(kb.x + kb.width * (20 / 33), kb.y + kb.height / 2);
  pruefe('Kurve antippen: springt zu Ply 19', (await aktuellerPly(seite)) === 19, String(await aktuellerPly(seite)));
  const cursorX = await seite.evaluate(() => Number(document.querySelector('.an-k-cursor').getAttribute('x1')));
  pruefe('Cursor sitzt am gewählten Zug', Math.abs(cursorX - (20 / 33) * 560) < 1, String(cursorX));
  await seite.mouse.move(kb.x + kb.width * 0.1, kb.y + kb.height / 2);
  await seite.mouse.down();
  await seite.mouse.move(kb.x + kb.width * 0.5, kb.y + kb.height / 2, { steps: 5 });
  await seite.mouse.up();
  const nachZiehen = await aktuellerPly(seite);
  pruefe('Kurve ziehen: folgt dem Finger', Math.abs(nachZiehen - (Math.round(0.5 * 33) - 1)) <= 1, String(nachZiehen));

  // --- Klassen-Zeile antippen: naechster eigener Zug dieser Klasse
  await seite.click('[data-aktion="anfang"]');
  const besterPlies = await seite.evaluate((id) => testseite.speicher.ladeReview(id).zuege
    .filter((z) => z.farbe === 'w' && z.klasse === 'bester').map((z) => z.ply), d.oper);
  await seite.click('.an-kl[data-klasse="bester"]');
  pruefe('Klasse "Bester Zug": erster eigener', (await aktuellerPly(seite)) === besterPlies[0], `${await aktuellerPly(seite)} vs ${besterPlies[0]}`);
  await seite.click('.an-kl[data-klasse="bester"]');
  pruefe('Nochmal antippen: der nächste', (await aktuellerPly(seite)) === besterPlies[1], `${await aktuellerPly(seite)} vs ${besterPlies[1]}`);
  const kl = await seite.locator('.an-coach').getAttribute('data-klasse');
  pruefe('Coach zeigt die Klasse', kl === 'bester', kl);
  const vorFehler = await aktuellerPly(seite);
  await seite.click('.an-kl[data-klasse="patzer"]', { force: true });
  pruefe('Klasse ohne eigene Züge: bleibt stehen', (await aktuellerPly(seite)) === vorFehler);

  // --- Schluesselmoment
  const ersterMoment = Number(await seite.locator('.an-moment').first().getAttribute('data-ply'));
  await seite.locator('.an-moment').first().click();
  pruefe('Schlüsselmoment antippen', (await aktuellerPly(seite)) === ersterMoment
    && (await seite.locator('.an-moment.an').count()) === 1);

  // --- Coach-Karte und Pfeil des besten Zugs
  const mitAnderemBesten = await seite.evaluate((id) => {
    const z = testseite.speicher.ladeReview(id).zuege.find((x) => x.besterZug && x.besterZug !== x.uci && !['buch', 'erzwungen'].includes(x.klasse));
    return z ? { ply: z.ply, von: z.besterZug.slice(0, 2), nach: z.besterZug.slice(2, 4) } : null;
  }, d.oper);
  await oeffne(seite, `screen=analyse&partieId=${d.oper}&ply=${mitAnderemBesten.ply}`);
  pruefe('Sprung per ply-Parameter', (await aktuellerPly(seite)) === mitAnderemBesten.ply);
  const pfeil = await seite.evaluate(() => [...document.querySelectorAll('.an-brett .pfeil')].map((g) => g.dataset.von + g.dataset.nach));
  pruefe('Pfeil des besten Zugs', pfeil.includes(mitAnderemBesten.von + mitAnderemBesten.nach), pfeil.join(','));
  const linie = await seite.locator('.an-c-linie').textContent();
  pruefe('Zeile "Bester Zug +x,y · Züge"', /Bester Zug\s+[+−]\d+,\d/.test(linie) && /[KDTLS]?[a-h]?x?[a-h][1-8]/.test(linie), linie.replace(/\s+/g, ' '));
  const evalChip = await seite.locator('.an-c-eval').textContent();
  pruefe('Bewertungs-Chip', /[+−]?\d+,\d|M\d/.test(evalChip), evalChip);
  await bild(seite, 'analyse-bester-zug');

  // --- Variante zeigen
  const fenVorher = await seite.evaluate(() => [...document.querySelectorAll('.an-brett > img.figur:not(.geht)')].map((i) => i.dataset.feld + i.dataset.figur).sort().join());
  await seite.click('[data-aktion="variante"]');
  await seite.waitForFunction(() => /Variante \d+ \/ \d+/.test(document.querySelector('.an-c-eval').textContent), null, { timeout: 4000 });
  await warte(1300);
  const fenVariante = await seite.evaluate(() => [...document.querySelectorAll('.an-brett > img.figur:not(.geht)')].map((i) => i.dataset.feld + i.dataset.figur).sort().join());
  pruefe('Variante spielt Züge auf dem Brett', fenVariante !== fenVorher);
  pruefe('Variante: Pfeile und markierter Zug in der Zeile', (await seite.locator('.an-brett .pfeil').count()) >= 1
    && (await seite.locator('.an-c-zuege span.an').count()) === 1);
  pruefe('Knopf "Zur Partie" sichtbar', await seite.locator('[data-aktion="zur-partie"]').isVisible());
  await bild(seite, 'analyse-variante');
  await seite.click('[data-aktion="zur-partie"]');
  const fenZurueck = await seite.evaluate(() => [...document.querySelectorAll('.an-brett > img.figur:not(.geht)')].map((i) => i.dataset.feld + i.dataset.figur).sort().join());
  pruefe('"Zur Partie" stellt die Partie wieder her', fenZurueck === fenVorher && (await aktuellerPly(seite)) === mitAnderemBesten.ply
    && !(await seite.locator('.an-brettzone.variante').count()));

  // --- Banner, Kopf-Knoepfe
  await oeffne(seite, `screen=analyse&partieId=${d.oper}&neuFreigeschaltet=turm&neueSterne=1,1,0`);
  const banner = await seite.locator('.an-banner').textContent();
  pruefe('Freischalt-Banner mit Stufe und Name', banner.includes('Stufe 6') && banner.includes('Professor Turm'), banner.replace(/\s+/g, ' '));
  pruefe('Neue Sterne leuchten auf', (await seite.locator('.an-ft-sterne .neu').count()) === 2);
  await bild(seite, 'analyse-ipad-quer');
  await seite.click('.kopf [data-aktion="nochmal"]');
  let p = await protokoll(seite);
  let g = p.filter((x) => x.art === 'gehe').pop();
  pruefe('"Nochmal": gleicher Bot, gleiche Farbe', g && g.name === 'partie' && g.params.botId === 'rudi' && g.params.farbe === 'w', JSON.stringify(g));
  await oeffne(seite, `screen=analyse&partieId=${d.oper}&neuFreigeschaltet=turm`);
  await seite.click('.kopf [data-aktion="weiter"]');
  p = await protokoll(seite);
  g = p.filter((x) => x.art === 'gehe').pop();
  pruefe('"Nächster Gegner": Arena mit Freischaltung', g && g.name === 'arena' && g.params.neuFreigeschaltet === 'turm', JSON.stringify(g));
  await oeffne(seite, `screen=analyse&partieId=${d.oper}`);
  await seite.click('.kopf [data-aktion="weiter"]');
  g = (await protokoll(seite)).filter((x) => x.art === 'gehe').pop();
  const ng = await seite.evaluate(() => testseite.speicher.naechsterGegner().id);
  pruefe('"Nächster Gegner" ohne Freischaltung: Arena mit naechsterGegner()', g && g.name === 'arena' && g.params.waehle === ng, JSON.stringify(g));
  await oeffne(seite, `screen=analyse&partieId=${d.oper}`);
  await seite.click('.kopf [data-aktion="zurueck"]');
  p = await protokoll(seite);
  pruefe('Zurück-Knopf ruft app.zurueck()', p.some((x) => x.art === 'zurueck'));

  // --- Einstellungen wirken in der Analyse
  await seite.evaluate(() => testseite.app.setzeEinstellungen({ balken: false, koordinaten: false }));
  await oeffne(seite, `screen=analyse&partieId=${d.oper}`);
  pruefe('Balken aus: kein Bewertungsbalken', !(await seite.locator('.an-evalbalken').isVisible()));
  pruefe('Koordinaten aus', await seite.evaluate(() => document.querySelector('.an-brett').classList.contains('ohne-koordinaten')));
  await seite.evaluate(() => testseite.app.setzeEinstellungen({ balken: true, koordinaten: true }));

  // --- Unbekannte Partie
  await oeffne(seite, 'screen=analyse&partieId=gibt-es-nicht');
  pruefe('Unbekannte Partie: freundliche Meldung', (await seite.locator('.an-meldung').textContent()).includes('gibt es nicht mehr'));
  await seite.click('.an-meldung [data-aktion="zurueck"]');
  p = await protokoll(seite);
  pruefe('Unbekannte Partie: Zurück funktioniert', p.some((x) => x.art === 'zurueck'));

  // --- Verlassen bricht die Analyse ab
  await seite.evaluate((id) => {
    const p0 = testseite.speicher.ladePartie(id);
    const kopie = { ...p0, id: undefined, datum: new Date(Date.now() - 864e5 * 5).toISOString(), genauigkeit: null, eroeffnung: null };
    window._abbruchId = testseite.speichere(kopie, null).partie.id;
  }, d.oper);
  const abbruchId = await seite.evaluate(() => window._abbruchId);
  await oeffne(seite, `screen=analyse&partieId=${abbruchId}`);
  await seite.waitForFunction(() => Number(document.querySelector('.an-fortschritt')?.getAttribute('aria-valuenow')) > 0, null, { timeout: 30000 });
  await seite.evaluate(() => testseite.starte('verlauf'));
  await warte(700);
  const zustand = await seite.evaluate((id) => ({ engine: testseite.engineZustand(), review: testseite.speicher.hatReview(id) }), abbruchId);
  pruefe('Verlassen: Engine gestoppt, keine Review gespeichert', zustand.engine && !zustand.engine.laufend && zustand.engine.schlange === 0 && !zustand.review, JSON.stringify(zustand));
  await warte(1500);
  pruefe('Verlassen: Screen bleibt Verlauf', (await seite.evaluate(() => testseite.aktuell())) === 'verlauf' && !(await seite.locator('.an-screen').count()));
  await seite.evaluate((id) => testseite.speicher.loeschePartie(id), abbruchId);

  pruefe('Keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
  await kontext.close();
}

// ---------------------------------------------------------------------------
async function testeTouch(browser, d) {
  gruppe = 'Touch (iPad)';
  const { kontext, seite, fehler } = await neueSeite(browser, { breite: 820, hoehe: 1180, touch: true });
  await oeffne(seite, `screen=analyse&partieId=${d.oper}`);
  const kb = await seite.locator('.an-kurve-wrap').boundingBox();
  await seite.touchscreen.tap(kb.x + kb.width * (11 / 33), kb.y + kb.height / 2);
  pruefe('Kurve antippen mit dem Finger', (await aktuellerPly(seite)) === 10, String(await aktuellerPly(seite)));
  await seite.locator('.an-kl[data-klasse="brillant"]').scrollIntoViewIfNeeded();
  const kl = await seite.locator('.an-kl[data-klasse="brillant"]').boundingBox();
  await seite.touchscreen.tap(kl.x + kl.width / 2, kl.y + kl.height / 2);
  await warte(500);
  const z = await seite.locator('.an-coach').getAttribute('data-klasse');
  pruefe('Klassen-Zeile mit dem Finger: Brillant', z === 'brillant', z);
  pruefe('Brillant-Coach mit Verlaufsrahmen, Wort vollfarbig', await seite.evaluate(() => {
    const c = document.querySelector('.an-coach.brillant .an-c-klasse');
    const st = c && getComputedStyle(c);
    return !!st && st.color !== 'rgba(0, 0, 0, 0)' && !/text/.test(st.backgroundClip || st.webkitBackgroundClip || '');
  }));
  // Wischen mit echten Touch-Ereignissen (CDP)
  const cdp = await kontext.newCDPSession(seite);
  await seite.locator('.an-brett').scrollIntoViewIfNeeded();
  const br = await seite.locator('.an-brett').boundingBox();
  const vor = await aktuellerPly(seite);
  const y = br.y + br.height / 2;
  const punkte = [0.8, 0.65, 0.5, 0.35, 0.2].map((f) => ({ x: br.x + br.width * f, y }));
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [punkte[0]] });
  for (const pt of punkte.slice(1)) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [pt] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await warte(200);
  pruefe('Wischen mit dem Finger: Zug vor', (await aktuellerPly(seite)) === vor + 1, `${vor} -> ${await aktuellerPly(seite)}`);
  pruefe('Keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
  await kontext.close();
}

// ---------------------------------------------------------------------------
async function testeVerlauf(browser, d) {
  gruppe = 'Verlauf';
  const { kontext, seite, fehler } = await neueSeite(browser);
  await oeffne(seite, 'screen=verlauf');
  const anzahl = await seite.evaluate(() => testseite.speicher.ladePartien().length);
  pruefe('Liste zeigt alle Partien', (await seite.locator('.vl-zeile').count()) === anzahl && anzahl >= 2, String(anzahl));
  const erste = await seite.locator('.vl-zeile').first().textContent();
  pruefe('Zeile: Name, Ergebnis, Genauigkeit, Datum, Eröffnung, Züge',
    /Sieg|Niederlage|Remis/.test(erste) && /%/.test(erste) && /Züge/.test(erste) && /(Heute|Gestern|\d{4}),/.test(erste), erste.replace(/\s+/g, ' '));
  pruefe('Sterne je Partie', (await seite.locator('.vl-zeile').first().locator('.vl-sterne span').count()) === 3);
  const stat = await seite.locator('.vl-statistik').textContent();
  pruefe('Statistik oben', stat.includes('Partien') && stat.includes('Siege') && stat.includes('Genauigkeit'), stat.replace(/\s+/g, ' '));
  const juwelen = await seite.locator('.vl-juwel').count();
  const brillant = await seite.evaluate(() => testseite.speicher.ladeFortschritt().brillanteZuege.length);
  pruefe('Schatzkiste mit allen Brillant-Zügen', juwelen === brillant, `${juwelen} vs ${brillant}`);
  await bild(seite, 'verlauf-ipad-quer');

  // Antippen -> Analyse
  const id = await seite.locator('.vl-zeile').first().getAttribute('data-id');
  await seite.locator('.vl-zeile').first().locator('.vl-oeffnen').click();
  let p = await protokoll(seite);
  let g = p.filter((x) => x.art === 'gehe').pop();
  pruefe('Partie antippen: Analyse', g && g.name === 'analyse' && g.params.partieId === id && (await seite.locator('.an-screen').count()) === 1, JSON.stringify(g));
  await seite.waitForSelector('.an-coach, .an-laden');
  await seite.click('.kopf [data-aktion="zurueck"]');
  await seite.waitForSelector('.vl-liste');
  pruefe('Zurück aus der Analyse in den Verlauf', (await seite.evaluate(() => testseite.aktuell())) === 'verlauf');

  // Schatzkiste -> Analyse am Zug
  if (juwelen) {
    const ply = Number(await seite.locator('.vl-juwel').first().getAttribute('data-ply'));
    await seite.locator('.vl-juwel').first().click();
    await seite.waitForSelector('.an-coach');
    g = (await protokoll(seite)).filter((x) => x.art === 'gehe').pop();
    pruefe('Brillant-Zug antippen: Analyse an diesem Zug', g.params.ply === ply && (await aktuellerPly(seite)) === ply
      && (await seite.locator('.an-coach').getAttribute('data-klasse')) === 'brillant', JSON.stringify(g));
    await seite.click('.kopf [data-aktion="zurueck"]');
    await seite.waitForSelector('.vl-liste');
  }

  // Loeschen per Knopf mit Rueckfrage
  const vorher = await seite.locator('.vl-zeile').count();
  const letzteId = await seite.locator('.vl-zeile').last().getAttribute('data-id');
  await seite.locator('.vl-zeile').last().locator('.vl-muell').click();
  pruefe('Löschen fragt nach', await seite.locator('.vl-dialog').isVisible());
  await bild(seite, 'verlauf-loeschen');
  await seite.click('[data-aktion="dialog-ab"]');
  pruefe('Abbrechen behält die Partie', (await seite.locator('.vl-zeile').count()) === vorher && !(await seite.locator('.vl-dialog').count()));
  await seite.locator('.vl-zeile').last().locator('.vl-muell').click();
  await seite.click('[data-aktion="dialog-ok"]');
  await warte(500);
  const weg = await seite.evaluate((x) => testseite.speicher.ladePartie(x) === null && !testseite.speicher.hatReview(x), letzteId);
  pruefe('Löschen entfernt Partie und Analyse', weg && (await seite.locator('.vl-zeile').count()) === vorher - 1);
  p = await protokoll(seite);
  pruefe('Hinweis "Partie gelöscht"', p.some((x) => x.art === 'meldung' && x.text.includes('gelöscht')));

  // Loeschen per Wischen
  const z1 = seite.locator('.vl-zeile').first();
  const wid = await z1.getAttribute('data-id');
  const b = await z1.locator('.vl-vorne').boundingBox();
  await seite.mouse.move(b.x + b.width * 0.7, b.y + b.height / 2);
  await seite.mouse.down();
  await seite.mouse.move(b.x + b.width * 0.5, b.y + b.height / 2 + 2, { steps: 5 });
  await seite.mouse.move(b.x + b.width * 0.7 - 150, b.y + b.height / 2 + 3, { steps: 5 });
  await seite.mouse.up();
  await warte(350);
  pruefe('Wischen zeigt "Löschen"', await z1.evaluate((el) => el.classList.contains('offen')));
  pruefe('Wischen öffnet nicht die Analyse', (await seite.evaluate(() => testseite.aktuell())) === 'verlauf');
  await bild(seite, 'verlauf-wischen');
  await z1.locator('.vl-hinten').click();
  await seite.click('[data-aktion="dialog-ok"]');
  await warte(500);
  pruefe('Gewischte Partie gelöscht', await seite.evaluate((x) => testseite.speicher.ladePartie(x) === null, wid));

  // Leerer Zustand
  await seite.evaluate(() => testseite.leere());
  await oeffne(seite, 'screen=verlauf');
  const leer = await seite.locator('.vl-leer').textContent();
  pruefe('Leer: "Noch keine Partien. Fordere Bauer Benno heraus!"', leer.includes('Noch keine Partien.') && leer.includes('Fordere Bauer Benno heraus!'), leer.replace(/\s+/g, ' '));
  await seite.click('[data-aktion="arena"]');
  g = (await protokoll(seite)).filter((x) => x.art === 'gehe').pop();
  pruefe('Leer: Knopf zur Arena', g && g.name === 'arena');
  await bild(seite, 'verlauf-leer');
  pruefe('Keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
  await kontext.close();
}

// ---------------------------------------------------------------------------
async function testeEinstellungen(browser) {
  gruppe = 'Einstellungen';
  const { kontext, seite, fehler } = await neueSeite(browser);
  await oeffne(seite);
  await seite.evaluate(async () => { testseite.leere(); await testseite.opernpartie({ mitReview: false }); });
  await oeffne(seite, 'screen=einstellungen');
  const lies = () => seite.evaluate(() => testseite.speicher.ladeEinstellungen());
  const an = (key) => seite.locator(`.es-schalter[data-key="${key}"]`).getAttribute('aria-checked');

  for (const key of ['klang', 'balken', 'liveBewertung', 'koordinaten']) {
    await seite.click(`.es-schalter[data-key="${key}"]`);
    const e = await lies();
    pruefe(`${key} aus`, e[key] === false && (await an(key)) === 'false');
  }
  pruefe('Klang aus: klang.aus gesetzt, Probeton gesperrt', await seite.evaluate(() => document.querySelector('.es-probe').disabled));
  await seite.click('.es-brett[data-wert="holz"]');
  pruefe('Brettfarbe Holz: <html data-brett> und Feldfarbe', await seite.evaluate(() => document.documentElement.dataset.brett === 'holz'
    && getComputedStyle(document.documentElement).getPropertyValue('--feld-hell').trim().toLowerCase() === '#f0d9b5'));
  await seite.click('.es-seg[data-wert="16"]');
  pruefe('Rechentiefe Gründlich 16', (await lies()).tiefe === 16);
  await bild(seite, 'einstellungen-geaendert');

  await seite.reload();
  await seite.waitForSelector('.es-inhalt');
  for (const key of ['klang', 'balken', 'liveBewertung', 'koordinaten']) {
    pruefe(`${key} bleibt nach Neuladen aus`, (await an(key)) === 'false');
  }
  pruefe('Holz bleibt nach Neuladen', (await seite.locator('.es-brett[data-wert="holz"]').getAttribute('aria-checked')) === 'true'
    && (await seite.evaluate(() => document.documentElement.dataset.brett)) === 'holz');
  pruefe('Tiefe 16 bleibt nach Neuladen', (await seite.locator('.es-seg[data-wert="16"]').getAttribute('aria-checked')) === 'true');

  // wieder einschalten (Klick auf den Text der Zeile geht auch)
  await seite.click('.es-text[data-key="klang"]');
  pruefe('Klang wieder an (Tippen auf den Text)', (await lies()).klang === true && (await an('klang')) === 'true');
  await seite.click('.es-probe');
  for (const key of ['balken', 'liveBewertung', 'koordinaten']) await seite.click(`.es-schalter[data-key="${key}"]`);
  await seite.click('.es-brett[data-wert="gruen"]');
  pruefe('Grün per Klick', (await lies()).brett === 'gruen' && await seite.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--feld-dunkel').trim().toLowerCase() === '#769656'));
  await seite.focus('.es-seg[data-wert="16"]');
  await seite.keyboard.press('ArrowLeft');
  pruefe('Pfeiltasten in der Rechentiefe', (await lies()).tiefe === 14);
  await seite.click('.es-seg[data-wert="12"]');
  pruefe('Schnell 12', (await lies()).tiefe === 12);

  // Zuruecksetzen in zwei Stufen
  pruefe('Vor dem Zurücksetzen: 1 Partie', (await seite.evaluate(() => testseite.speicher.ladePartien().length)) === 1);
  await seite.click('[data-aktion="reset-1"]');
  pruefe('Stufe 1: Rückfrage', (await seite.locator('.es-reset').textContent()).includes('Wirklich'));
  await seite.click('[data-aktion="reset-ab"]');
  pruefe('Abbrechen: nichts gelöscht', (await seite.evaluate(() => testseite.speicher.ladePartien().length)) === 1);
  await seite.click('[data-aktion="reset-1"]');
  await seite.click('[data-aktion="reset-2"]');
  pruefe('Stufe 2: letzte Rückfrage', (await seite.locator('.es-reset').textContent()).includes('nicht rückgängig'));
  await bild(seite, 'einstellungen-zuruecksetzen');
  await seite.click('[data-aktion="reset-ok"]');
  const nach = await seite.evaluate(() => ({ p: testseite.speicher.ladePartien().length, s: testseite.speicher.gesamtSterne(), e: testseite.speicher.ladeEinstellungen() }));
  pruefe('Zurückgesetzt: keine Partien, keine Sterne', nach.p === 0 && nach.s === 0, JSON.stringify(nach));
  pruefe('Einstellungen bleiben beim Zurücksetzen', nach.e.brett === 'gruen' && nach.e.tiefe === 12);
  pruefe('Hinweis nach dem Zurücksetzen', (await protokoll(seite)).some((x) => x.art === 'meldung' && x.text.includes('zurückgesetzt')));
  await seite.click('.kopf [data-aktion="zurueck"]');
  pruefe('Zurück ruft app.zurueck()', (await protokoll(seite)).some((x) => x.art === 'zurueck'));
  pruefe('Lizenzen genannt', await seite.evaluate(() => /GPL-3\.0/.test(document.body.innerText) && /Stockfish/.test(document.body.innerText)
    && /chess\.js/.test(document.body.innerText) && /cburnett/.test(document.body.innerText)));
  await seite.evaluate(() => testseite.app.setzeEinstellungen({ brett: 'nacht', tiefe: 12 }));
  pruefe('Keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
  await kontext.close();
}

// ---------------------------------------------------------------------------
async function testeViewports(browser, d) {
  gruppe = 'Viewports';
  const { kontext, seite, fehler } = await neueSeite(browser);
  await oeffne(seite);
  for (const [name, breite, hoehe] of VIEWPORTS) {
    await seite.setViewportSize({ width: breite, height: hoehe });
    for (const [screen, query] of [
      ['analyse', `screen=analyse&partieId=${d.oper}&neuFreigeschaltet=turm&neueSterne=1,1,0&ply=24`],
      ['verlauf', 'screen=verlauf'],
      ['einstellungen', 'screen=einstellungen'],
    ]) {
      await oeffne(seite, query);
      await warte(screen === 'analyse' ? 900 : 300);
      const u = await ueberlauf(seite);
      pruefe(`${name} ${screen}: kein waagrechter Überlauf`, u.doc <= 0 && u.scr <= 0 && !u.raus.length, JSON.stringify(u));
      const klein = await kleineKnoepfe(seite);
      pruefe(`${name} ${screen}: Tippflächen ≥ 44 px`, !klein.length, klein.slice(0, 4).join(', '));
      if (screen === 'analyse') {
        const brett = await seite.locator('.an-brett').boundingBox();
        const ok = brett.x >= 0 && brett.x + brett.width <= breite + 0.5 && brett.width >= Math.min(breite, hoehe) * 0.5;
        pruefe(`${name} analyse: Brett ganz sichtbar und groß`, ok, JSON.stringify(brett));
        if (breite > hoehe) {
          const unten = await seite.evaluate(() => {
            const c = document.querySelector('.an-coach').getBoundingClientRect();
            return c.bottom <= innerHeight + 1;
          });
          pruefe(`${name} analyse: Coach-Karte ohne Scrollen sichtbar`, unten);
        }
      }
      await bild(seite, `${screen}-${name}`);
      if (hoehe > breite && screen !== 'einstellungen') {
        await seite.evaluate(() => { const s = document.querySelector('.screen'); s.scrollTop = s.scrollHeight; });
        await warte(250);
        await bild(seite, `${screen}-${name}-unten`);
      }
    }
  }
  pruefe('Keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
  await kontext.close();
}

async function testeWenigerBewegung(browser, d) {
  gruppe = 'Weniger Bewegung';
  const { kontext, seite, fehler } = await neueSeite(browser, { bewegung: 'reduce' });
  await oeffne(seite, `screen=analyse&partieId=${d.oper}&neuFreigeschaltet=turm&neueSterne=1,1,1`);
  const dauer = await seite.evaluate(() => getComputedStyle(document.querySelector('.an-coach')).animationDuration);
  pruefe('Animationen praktisch aus', parseFloat(dauer) < 0.01 || dauer === '0s', dauer);
  pruefe('Keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
  await kontext.close();
}

// ---------- Ablauf ----------

const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: WURZEL, stdio: 'ignore' });
let browser;
let code = 1;
const t0 = Date.now();
try {
  await warteAufServer(BASIS);
  const { chromium } = ladePlaywright();
  browser = await chromium.launch();
  const d = await testeDaten(browser);
  await testeViewports(browser, d);
  await testeAnalyse(browser, d);
  await testeTouch(browser, d);
  await testeWenigerBewegung(browser, d);
  await testeVerlauf(browser, d);
  await testeEinstellungen(browser);
  const fehlend = ergebnisse.filter((r) => !r.ok);
  console.log(`\n${ergebnisse.length - fehlend.length}/${ergebnisse.length} bestanden in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  for (const f of fehlend) console.log('FEHLER: ' + f.name + (f.detail ? ' (' + f.detail + ')' : ''));
  if (BILDER) console.log('Bilder: ' + BILDER);
  code = fehlend.length ? 1 : 0;
} catch (e) {
  console.error(e);
  code = 1;
} finally {
  if (browser) await browser.close();
  server.kill();
}
process.exit(code);
