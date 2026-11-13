// Echte Bedienung beider Brettseiten; keine Bot-Antworten und kein Netzwerk-Konto.
import http from 'node:http';
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { browserTyp } from './browser.mjs';

const require = createRequire(import.meta.url);
let pw;
for (const p of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
  try { pw = require(p); break; } catch (e) { /* naechster */ }
}
if (!pw) throw new Error('Playwright fehlt');
const root = fileURLToPath(new URL('../', import.meta.url));
const typen = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const p = path.resolve(root, '.' + new URL(req.url, 'http://test').pathname.replace(/\/$/, '/index.html'));
  if (!p.startsWith(root)) { res.writeHead(403); res.end(); return; }
  try { const inhalt = readFileSync(p); res.writeHead(200, { 'Content-Type': typen[path.extname(p)] || 'application/octet-stream' }); res.end(inhalt); }
  catch (e) { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(8886, '127.0.0.1', r));
let browser, kontext, ok = 0, gesamt = 0;
const fehler = [];
function pruefe(name, gut, detail = '') {
  gesamt++; if (gut) ok++;
  console.log(`${gut ? 'OK' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(detail)}`);
}
try {
  browser = await browserTyp(pw).launch({ headless: true });
  kontext = await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true });
  await kontext.route('**/*.supabase.co/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await kontext.addInitScript(() => {
    const zeit = Date.now.bind(Date); window.__versatz = 0; Date.now = () => zeit() + window.__versatz;
    if (!localStorage.getItem('schach-arena:v1:einstellungen')) localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ klang: false, bewegung: 'reduziert', tiefe: 8 }));
    const WorkerAlt = window.Worker; window.__workerZahl = 0;
    window.Worker = class extends WorkerAlt { constructor(...a) { super(...a); window.__workerZahl++; } };
  });
  const seite = await kontext.newPage();
  seite.setDefaultTimeout(15000);
  seite.on('pageerror', e => fehler.push(e.message));
  seite.on('console', m => { if (m.type() === 'error') fehler.push(m.text()); });
  // Eine neue Partie hat ein neues z. Vor dem Ausloesen merken (merke), sonst gilt die alte Partie noch als "da",
  // solange der naechste Screen laedt (Revanche lief in der CI so in die alte Partie)
  const merke = () => seite.evaluate(() => { window.__altesZ = window.__partie?.z || null; });
  const wartePartie = () => seite.waitForFunction(() => window.__partie?.z?.modus === 'zuzweit' && window.__partie.z !== window.__altesZ);
  const knopf = name => seite.locator(`[data-zz="${name}"]`);
  async function start(tempo = 'ohne', drehen = false) {
    await merke();
    // Flo 08.11.2026: keine Karte mehr unter Lernen, Einstieg ist die Startseite (heim-zuzweit)
    await seite.evaluate(() => window.__app.gehe('heim')); await seite.locator('[data-aktion="heim-zuzweit"]').click();
    // Namen sind eingeklappt (Handy-Runde 08.11.2026), Bedenkzeit sind Pillen (Radio-Knoepfe)
    await seite.locator('.zz-namen summary').click();
    await seite.locator('[name="weiss"]').fill('Anna');
    await seite.locator('[name="schwarz"]').fill('Ben');
    await seite.locator(`[name="bedenkzeit"][value="${tempo}"]`).check();
    await seite.locator('[name="drehen"]').setChecked(drehen);
    await seite.getByRole('button', { name: 'Los', exact: true }).click();
    if (await seite.getByRole('button', { name: 'Neue Partie', exact: true }).isVisible()) await seite.getByRole('button', { name: 'Neue Partie', exact: true }).click();
    await wartePartie();
  }
  async function feld(f) {
    const r = await seite.locator(`.zz-brett .feld[data-feld="${f}"]`).boundingBox();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }
  async function zug(uci, ziehen = false) {
    const vorher = await seite.evaluate(() => window.__partie.z.zuege.length);
    const a = await feld(uci.slice(0, 2)), b = await feld(uci.slice(2, 4));
    if (ziehen) {
      await seite.mouse.move(a.x, a.y); await seite.mouse.down(); await seite.mouse.move(b.x, b.y, { steps: 8 }); await seite.mouse.up();
    } else { await seite.touchscreen.tap(a.x, a.y); await seite.touchscreen.tap(b.x, b.y); }
    await seite.waitForFunction(n => window.__partie.z.zuege.length === n + 1, vorher);
  }
  async function aufgeben() {
    await knopf('aufgeben').click(); await seite.getByRole('alertdialog').getByRole('button', { name: 'Aufgeben', exact: true }).click();
    await seite.locator('.zz-ergebnis:not([hidden])').waitFor();
  }
  await seite.goto('http://127.0.0.1:8886/?test#training');
  await seite.waitForFunction(() => !!window.__app && !!document.documentElement.dataset.screen);
  pruefe('Lernen: keine Karte "Zu zweit" mehr (Flo 08.11.2026, Zu zweit ist kein Lernen)', await seite.evaluate(() => !document.querySelector('.zz-karte')));
  await seite.evaluate(() => window.__app.gehe('heim')); await seite.locator('[data-aktion="heim-zuzweit"]').click();
  await seite.locator('[name="weiss"]').waitFor({ state: 'attached' });
  pruefe('Startblatt: Namen, vier Bedenkzeiten (Ohne Uhr gewaehlt), Drehen aus', await seite.evaluate(() => document.querySelector('[name="weiss"]').value === 'Weiß'
    && document.querySelector('[name="schwarz"]').value === 'Schwarz' && document.querySelector('[name="weiss"]').maxLength === 20
    && document.querySelectorAll('[name="bedenkzeit"]').length === 4 && document.querySelector('[name="bedenkzeit"]:checked')?.value === 'ohne'
    && !document.querySelector('[name="drehen"]').checked));
  // Handy-Runde 08.11.2026 (Befund 3): Stil der Startseite, grosser Start oben, Namen eingeklappt, Ziele ab 44 px
  const blatt = await seite.evaluate(() => {
    const r = (el) => el.getBoundingClientRect();
    const los = document.querySelector('.zz-start > .zz-los');
    const namen = document.querySelector('.zz-namen');
    const ziele = [...document.querySelectorAll('.zz-startblatt .zz-los, .zz-startblatt .zz-pille span, .zz-startblatt .zz-schalter input, .zz-startblatt .zz-namen summary, .zz-startblatt .kopf-zurueck')]
      .filter((e) => e.offsetParent).map((e) => ({ k: e.className || e.tagName, w: Math.round(r(e).width), h: Math.round(r(e).height) }));
    return { los: los ? { t: r(los).top, h: r(los).height, text: los.textContent.trim(), unterNamen: r(los).top >= r(namen).bottom } : null, namenZu: !document.querySelector('.zz-namen').open,
      zurueck: !!document.querySelector('.zz-startblatt .kopf-zurueck'), koenige: document.querySelectorAll('.zz-paar img').length, ziele,
      quer: document.scrollingElement.scrollWidth <= innerWidth, ih: innerHeight };
  });
  pruefe('Startblatt: "Los" unter den Einstellungen (Flo 08.11.2026) und sichtbar ohne Scrollen, zwei Koenige, Namen eingeklappt, Zurueck-Symbol', blatt.los && blatt.los.text === 'Los'
    && blatt.los.unterNamen && blatt.los.t + blatt.los.h <= blatt.ih && blatt.koenige === 2 && blatt.namenZu && blatt.zurueck, JSON.stringify(blatt));
  pruefe('Startblatt: alle Ziele mindestens 44 px hoch und breit (auch der Schalter: Feld 52x44, Spur 52x32)', blatt.ziele.length >= 7
    && blatt.ziele.every((z) => z.h >= 44 && z.w >= 44), JSON.stringify(blatt.ziele));
  pruefe('Startblatt: nichts seitlich drueber', blatt.quer);
  // Punkt 33 (Barrierefreiheit, axe page-has-heading-one): genau eine h1 auf der Seite, der Titel des Startblatts
  const h1Start = await seite.evaluate(() => [...document.querySelectorAll('h1')].filter((e) => e.offsetParent).map((e) => e.className + ':' + e.textContent));
  pruefe('Startblatt: genau eine h1 (Titel des Startblatts)', h1Start.length === 1 && h1Start[0].startsWith('zz-titel:'), JSON.stringify(h1Start));
  // U6 (Flo 09.11.2026): "Los" orange wie jeder Hauptknopf; U11: der Uhr-Satz nur, wenn eine Uhr gewaehlt ist
  const farbe = await seite.evaluate(() => {
    const p = document.createElement('button'); p.className = 'knopf primaer'; document.body.append(p);
    const soll = getComputedStyle(p).backgroundColor; p.remove();
    return { los: getComputedStyle(document.querySelector('.zz-los')).backgroundColor, soll };
  });
  pruefe('Startblatt: "Los" hat die Farbe jedes Hauptknopfs (U6)', farbe.los === farbe.soll, farbe);
  const uhrSatz = () => seite.evaluate(() => { const s = document.querySelector('.zz-hinweis-uhr'); return !!s && !s.hidden && s.offsetParent !== null; });
  const ohneUhr = await uhrSatz();
  await seite.locator('[name="bedenkzeit"][value="10"]').check();
  const mitUhr = await uhrSatz();
  await seite.locator('[name="bedenkzeit"][value="ohne"]').check();
  pruefe('Startblatt: Uhr-Satz nur mit gewaehlter Uhr (U11)', !ohneUhr && mitUhr && !(await uhrSatz()), { ohneUhr, mitUhr });
  // R8 (L6): Kopf wie Bot-Partie, Raetsel-Duell und Lektion: Klang UND Einstellungen
  const kopfStart = await seite.evaluate(() => ['klang', 'einstellungen'].map((a) => !!document.querySelector(`.zz-startblatt > .kopf [data-aktion="${a}"]`)));
  pruefe('Startblatt-Kopf (L6): Klang und Einstellungen', kopfStart.every(Boolean), kopfStart);
  await start();
  const fortschritt = await seite.evaluate(() => localStorage.getItem('schach-arena:v1:fortschritt'));
  await zug('e2e4'); await zug('e7e5', true); await zug('g1f3'); await zug('b8c6', true);
  await seite.waitForTimeout(400);
  pruefe('Tippen und Ziehen beider Seiten, keine Engine oder Bot-Antwort', await seite.evaluate(() => window.__partie.z.zuege.join(',') === 'e2e4,e7e5,g1f3,b8c6' && window.__workerZahl === 0));
  pruefe('Keine Hilfen, Weiss unten, obere Spielerkarte umgedreht', await seite.evaluate(() => !document.querySelector('.zz-screen .balken, .zz-screen .coach, .zz-screen [data-aktion="hinweis"], .zz-screen [data-aktion="zuruecknahme"]')
    && window.__partie.brett.ausrichtung === 'w' && document.querySelector('.zz-oben').classList.contains('zz-gegenueber')));
  // R8 (L6): Kopf der Partie mit Klang und Einstellungen; Einstellungen und zurueck setzen die Partie fort (wie die
  // Bot-Partie: vorher sichern, zurueck ueber den Verlauf)
  const kopfPartie = await seite.evaluate(() => ['klang', 'einstellungen'].map((a) => !!document.querySelector(`.zz-screen > .kopf [data-aktion="${a}"]`)));
  await merke();
  await seite.locator('.zz-screen > .kopf [data-aktion="einstellungen"]').click();
  await seite.waitForFunction(() => document.documentElement.dataset.screen === 'einstellungen');
  await seite.evaluate(() => window.__app.zurueck());
  await wartePartie();
  const nachEinst = await seite.evaluate(() => window.__partie.z.zuege.join(','));
  pruefe('Partie-Kopf (L6): Klang und Einstellungen; Einstellungen und zurueck setzt die Partie fort', kopfPartie.every(Boolean) && nachEinst === 'e2e4,e7e5,g1f3,b8c6', { kopfPartie, nachEinst });
  // R8 (B4/L6): Zuege als Zugliste bzw. Zugstreifen wie in der Bot-Partie, Leisten mit Unterzeile und geschlagenen Figuren
  const zuegeBau = await seite.evaluate(() => ({ nr: document.querySelectorAll('.zz-zuege .zugleiste .nr').length, z: document.querySelectorAll('.zz-zuege .zugleiste .z').length,
    aktuell: document.querySelector('.zz-zuege .zugleiste .z.aktuell')?.textContent, orte: document.querySelectorAll('.zz-spieler .unter .geschlagen-ort').length }));
  pruefe('Zuege und Leisten wie Bot-Partie (B4/L6): 2 Nummern, 4 Zuege, letzter hervorgehoben, Orte fuer geschlagene Figuren', zuegeBau.nr === 2 && zuegeBau.z === 4 && zuegeBau.orte === 2 && /c6/.test(zuegeBau.aktuell || ''), zuegeBau);
  const h1Partie = await seite.evaluate(() => [...document.querySelectorAll('h1')].filter((e) => e.offsetParent).map((e) => e.textContent));
  pruefe('Partie zu zweit: genau eine h1 im Kopf', h1Partie.length === 1 && await seite.locator('.zz-screen > .kopf h1').count() === 1, JSON.stringify(h1Partie));
  // R6-Befund B11 (12.11.2026): Leisten mit eingegebenem Namen und Farbe je einmal; Klang-Knopf wie in der Bot-Partie
  const leisten = () => seite.evaluate(() => [...document.querySelectorAll('.zz-screen .zz-spieler')].map((e) => [e.querySelector('.zz-name'), e.querySelector('.p-meta')]
    .map((x) => x?.innerText || '').join(' ').replace(/\s+/g, ' ').trim()));
  const mitNamen = await leisten();
  pruefe('Leisten (B11): eingegebene Namen mit Farbe, je einmal', mitNamen.join('|') === 'Ben Schwarz|Anna Weiß', mitNamen);
  const klangKnopf = seite.locator('.zz-screen > .kopf [data-aktion="klang"]');
  const klangVorher = await klangKnopf.count() === 1 && await klangKnopf.getAttribute('aria-pressed') === 'false' && /Klang/.test(await klangKnopf.getAttribute('aria-label') || '');
  let klangNachher = false, klangZurueck = false;
  if (klangVorher) {
    await seite.evaluate(() => { const alt = window.__app.meldung; window.__meldungen = []; window.__app.meldung = (text, o) => { window.__meldungen.push(text); return alt(text, o); }; });
    await klangKnopf.click();
    klangNachher = await seite.evaluate(() => window.__app.einstellungen().klang === true) && await klangKnopf.getAttribute('aria-pressed') === 'true'
      && await seite.evaluate(() => window.__meldungen.join('|') === 'Klang an');
    await klangKnopf.click();
    klangZurueck = await seite.evaluate(() => window.__app.einstellungen().klang === false) && await klangKnopf.getAttribute('aria-pressed') === 'false';
  }
  pruefe('Klang-Knopf im Kopf (B11): da, zeigt den Stand, schaltet an und wieder aus (wie die Bot-Partie)', klangVorher && klangNachher && klangZurueck,
    { klangVorher, klangNachher, klangZurueck });
  const kopfKnoepfe = await seite.evaluate(() => [...document.querySelectorAll('.zz-screen > .kopf button')].map((b) => { const r = b.getBoundingClientRect(); return Math.round(Math.min(r.width, r.height)); }));
  pruefe('Kopf zu zweit (B11): alle Knoepfe mindestens 44 px', kopfKnoepfe.length >= 2 && kopfKnoepfe.every((x) => x >= 44), kopfKnoepfe);
  // Flo 30.10. abends: zu zweit darf man einen Zug zuruecknehmen (gegen Bots nicht)
  await zug('f1c4');
  await knopf('zugzurueck').click();
  pruefe('Zu zweit: "Zug zurück" nimmt genau einen Halbzug zurück, die Seite ist wieder am Zug', await seite.evaluate(() => window.__partie.z.zuege.join(',') === 'e2e4,e7e5,g1f3,b8c6'
    && window.__partie.chess().turn() === 'w' && window.__partie.chess().history().length === 4));
  await knopf('remis').click();
  pruefe('Andere Person entscheidet ueber Remis', (await seite.getByRole('alertdialog').innerText()).includes('Ben entscheidet'));
  await seite.getByRole('button', { name: 'Weiterspielen', exact: true }).click();
  pruefe('Remis abgelehnt: Partie laeuft weiter', await seite.evaluate(() => window.__partie.phase() === 'spiel'));
  await knopf('remis').click(); await seite.getByRole('button', { name: 'Annehmen', exact: true }).click();
  pruefe('Remis angenommen, Ergebnis ohne Sterne', (await seite.locator('.zz-ergebnis').innerText()).startsWith('Remis') && !(await seite.locator('.zz-ergebnis').innerText()).includes('Stern'));
  // R6-Befund B11: auch die Knoepfe nach der Partie tragen Symbole wie die Bot-Partie
  const endeKnoepfe = await seite.evaluate(() => [...document.querySelectorAll('.zz-ergebnis .zz-aktionen button')].map((b) => b.dataset.zz + ':' + !!b.querySelector('svg')));
  pruefe('Knoepfe nach der Partie (B11): Analyse, Revanche, Fertig mit Symbol', endeKnoepfe.join() === 'analyse:true,revanche:true,fertig:true', endeKnoepfe);
  pruefe('Keine Wertung oder Freischaltung', await seite.evaluate(v => localStorage.getItem('schach-arena:v1:fortschritt') === v, fortschritt));
  await merke(); await knopf('revanche').click(); await wartePartie();
  pruefe('Revanche tauscht Namen und startet leeres Brett', await seite.evaluate(() => window.__partie.z.zuzweit.weiss === 'Ben' && window.__partie.z.zuzweit.schwarz === 'Anna' && !window.__partie.z.zuege.length));
  await aufgeben();
  pruefe('Aufgabe der Seite am Zug: benannter Sieger', (await seite.locator('.zz-ergebnis h3').innerText()) === 'Anna gewinnt');
  await start('15', true);
  await seite.evaluate(() => { window.__versatz += 2500; });
  await zug('d2d4');
  const uhr = await seite.evaluate(() => ({ w: window.__partie.uhr.rest('w'), b: window.__partie.uhr.rest('b'), unten: window.__partie.brett.ausrichtung }));
  pruefe('Weisse Uhr stoppt mit 10 Sekunden Zuschlag, Schwarz ist unten', uhr.w > 905000 && uhr.w < 908000 && uhr.b <= 900000 && uhr.unten === 'b', uhr);
  await seite.evaluate(() => { window.__versatz += 4000; });
  const weiter = await seite.evaluate(() => ({ w: window.__partie.uhr.rest('w'), b: window.__partie.uhr.rest('b') }));
  pruefe('Nur die Uhr der Seite am Zug laeuft', weiter.w === uhr.w && weiter.b < uhr.b - 3900, weiter);
  await zug('d7d5', true);
  pruefe('Brett dreht nach schwarzem Zug zurueck', await seite.evaluate(() => window.__partie.brett.ausrichtung === 'w'));
  await seite.reload(); await wartePartie();
  pruefe('Neuladen setzt Namen, Zuege, Uhr und Drehen fort', await seite.evaluate(() => window.__partie.z.zuege.join(',') === 'd2d4,d7d5'
    && window.__partie.z.zuzweit.drehen && window.__partie.z.zuzweit.weiss === 'Anna' && window.__partie.uhr.rest('b') > 904000));
  await seite.evaluate(() => { window.__versatz += 1000000; });
  await seite.locator('.zz-ergebnis:not([hidden])').waitFor();
  pruefe('Zeitablauf beendet die Partie und sperrt das Brett', (await seite.locator('.zz-ergebnis').innerText()).includes('Ben gewinnt')
    && (await seite.locator('.zz-ergebnis').innerText()).includes('Zeit abgelaufen') && await seite.evaluate(() => window.__partie.phase() === 'ende'));
  await seite.evaluate(() => { window.__versatz = 0; });
  await seite.evaluate(() => window.__app.gehe('verlauf'));
  await seite.getByText('Zu zweit: Anna gegen Ben', { exact: true }).first().waitFor();
  pruefe('Verlauf nennt beide Namen', await seite.getByText('Zu zweit: Anna gegen Ben', { exact: true }).count() >= 1);
  // Die erste Partie hat Zuege beider Seiten; die echte Engine liefert die anschliessende Analyse.
  await seite.evaluate(() => {
    const p = JSON.parse(localStorage.getItem('schach-arena:v1:partien')).find(p => p.grund === 'vereinbart');
    window.__app.gehe('analyse', { partieId: p.id });
  });
  await seite.locator('.an-genau').waitFor({ timeout: 90000 });
  const genau = await seite.locator('.an-genau').innerText();
  const werte = await seite.locator('.an-genau .an-g-wert').allTextContents();
  pruefe('Analyse zeigt Namen und Genauigkeit beider Seiten', genau.includes('Anna') && genau.includes('Ben') && werte.length === 2
    && werte.every(w => Number.isFinite(Number(w.replace(',', '.'))) && Number(w.replace(',', '.')) >= 0 && Number(w.replace(',', '.')) <= 100), { genau, werte });
  pruefe('Analyse spricht neutral', !/\b(du|dein|deine|deinen)\b/i.test(await seite.locator('.an-screen').innerText()));
  // Zugklassen sind seit 30.10. abends gleich aufgeklappt
  const klasse = seite.locator('.an-kl:not([aria-disabled="true"])').first();
  // Seit 30.10. abends steht der Name als eigenes Schild neben dem Zug (.an-c-wer), deshalb der ganze Kopf
  await klasse.click(); const erster = await seite.locator('.an-c-kopf').innerText();
  await klasse.click(); const zweiter = await seite.locator('.an-c-kopf').innerText();
  pruefe('Klassen-Tabelle springt zu beiden Seiten', erster !== zweiter && /Anna|Ben/.test(erster + zweiter), { erster, zweiter });
  for (const [width, height] of [[1180, 820], [820, 1180], [390, 844], [375, 667]]) for (const modus of ['hell', 'dunkel']) {
    await seite.setViewportSize({ width, height });
    await seite.evaluate(modus => window.__app.setzeEinstellungen({ modus }), modus);
    await start('5');
    await seite.locator('.zz-brett').scrollIntoViewIfNeeded();
    const masse = await seite.evaluate(() => {
      const b = document.querySelector('.zz-brett').getBoundingClientRect();
      return { quer: document.documentElement.scrollWidth <= innerWidth, brett: b.x >= 0 && b.right <= innerWidth + 1 && b.y >= 0 && b.bottom <= innerHeight + 1,
        knoepfe: [...document.querySelectorAll('.zz-screen button')].every(b => b.getBoundingClientRect().height >= 44), namen: document.querySelectorAll('.zz-name b').length === 2,
        // R6-Befund B11: die Spielknoepfe tragen Symbole wie in der Bot-Partie, und kein Text laeuft aus seinem Knopf
        symbole: [...document.querySelectorAll('.zz-spielbereich > .zz-aktionen button')].map((b) => b.dataset.zz + ':' + !!b.querySelector('svg')).join() === 'zugzurueck:true,remis:true,aufgeben:true',
        passt: [...document.querySelectorAll('.zz-screen button')].every((b) => b.scrollWidth <= b.clientWidth + 1 && b.scrollHeight <= b.clientHeight + 1) };
    });
    pruefe(`${width}x${height} ${modus}: Brett sichtbar, kein Ueberlauf, Namen, Tippflaechen und Symbole`, Object.values(masse).every(Boolean), masse);
    if (process.env.BILDER) { mkdirSync(process.env.BILDER, { recursive: true }); await seite.screenshot({ path: path.join(process.env.BILDER, `zuzweit-${width}-${modus}.png`) }); }
    await aufgeben();
  }
  // R6-Befund B11: der Einstieg liegt auf Start (Flo 08.11.: Zu zweit ist kein Lernen); "Fertig" und Zurueck fuehren
  // dorthin, und der Zurueck-Knopf heisst wie sein Ziel
  await knopf('fertig').click();
  await seite.waitForFunction(() => document.documentElement.dataset.screen !== 'partie');
  pruefe('Fertig nach der Partie fuehrt zum Start (B11)', await seite.evaluate(() => document.documentElement.dataset.screen === 'heim'),
    await seite.evaluate(() => document.documentElement.dataset.screen));
  await merke();
  await seite.evaluate(() => window.__app.gehe('partie', { modus: 'zuzweit', zuzweit: { weiss: 'Weiß', schwarz: 'Schwarz', drehen: false }, tempo: null }));
  await wartePartie();
  const ohneNamen = await leisten();
  pruefe('Leisten ohne eigene Namen (B11): "Schwarz" und "Weiß" je einmal, nicht doppelt', ohneNamen.join('|') === 'Schwarz|Weiß', ohneNamen);
  const zk = await seite.evaluate(() => { const b = document.querySelector('.zz-screen > .kopf [data-zz="zurueck"]'); return b && { text: b.innerText.trim(), label: b.getAttribute('aria-label') || '', symbol: !!b.querySelector('svg') }; });
  await knopf('zurueck').click();
  await seite.waitForFunction(() => document.documentElement.dataset.screen !== 'partie');
  const ziel = await seite.evaluate(() => document.documentElement.dataset.screen);
  // R8 (L6): Symbol-Knopf wie in der Bot-Partie (js/ui/partie.js), die Ansage nennt weiter das Ziel (B11)
  pruefe('Zurueck-Knopf (B11/L6): Symbol wie in der Bot-Partie, Ansage nennt das Ziel (Start), fuehrt dorthin', !!zk && zk.text === ''
    && zk.label === 'Zurück zum Start' && zk.symbol && ziel === 'heim', { zk, ziel });
  pruefe('Keine Konsolen- oder Seitenfehler', fehler.length === 0, fehler);
} catch (e) { pruefe('Ablauf ohne Abbruch', false, e.stack); }
finally { await kontext?.close(); await browser?.close(); await new Promise(r => server.close(r)); }
console.log(`\n${ok}/${gesamt} bestanden`);
process.exitCode = ok === gesamt ? 0 : 1;
