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
    await seite.evaluate(() => window.__app.gehe('training'));
    await seite.getByRole('button', { name: 'Zu zweit spielen', exact: true }).click();
    await seite.locator('[name="weiss"]').fill('Anna');
    await seite.locator('[name="schwarz"]').fill('Ben');
    await seite.locator('[name="bedenkzeit"]').selectOption(tempo);
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
  await seite.getByRole('button', { name: 'Zu zweit spielen' }).click();
  await seite.locator('[name="weiss"]').waitFor();
  pruefe('Startblatt: Namen, vier Bedenkzeiten, Drehen aus', await seite.evaluate(() => document.querySelector('[name="weiss"]').value === 'Weiß'
    && document.querySelector('[name="schwarz"]').value === 'Schwarz' && document.querySelector('[name="weiss"]').maxLength === 20
    && document.querySelectorAll('[name="bedenkzeit"] option').length === 4 && !document.querySelector('[name="drehen"]').checked));
  await start();
  const fortschritt = await seite.evaluate(() => localStorage.getItem('schach-arena:v1:fortschritt'));
  await zug('e2e4'); await zug('e7e5', true); await zug('g1f3'); await zug('b8c6', true);
  await seite.waitForTimeout(400);
  pruefe('Tippen und Ziehen beider Seiten, keine Engine oder Bot-Antwort', await seite.evaluate(() => window.__partie.z.zuege.join(',') === 'e2e4,e7e5,g1f3,b8c6' && window.__workerZahl === 0));
  pruefe('Keine Hilfen, Weiss unten, obere Spielerkarte umgedreht', await seite.evaluate(() => !document.querySelector('.zz-screen .balken, .zz-screen .coach, .zz-screen [data-aktion="hinweis"], .zz-screen [data-aktion="zuruecknahme"]')
    && window.__partie.brett.ausrichtung === 'w' && document.querySelector('.zz-oben').classList.contains('zz-gegenueber')));
  await knopf('remis').click();
  pruefe('Andere Person entscheidet ueber Remis', (await seite.getByRole('alertdialog').innerText()).includes('Ben entscheidet'));
  await seite.getByRole('button', { name: 'Weiterspielen', exact: true }).click();
  pruefe('Remis abgelehnt: Partie laeuft weiter', await seite.evaluate(() => window.__partie.phase() === 'spiel'));
  await knopf('remis').click(); await seite.getByRole('button', { name: 'Annehmen', exact: true }).click();
  pruefe('Remis angenommen, Ergebnis ohne Sterne', (await seite.locator('.zz-ergebnis').innerText()).startsWith('Remis') && !(await seite.locator('.zz-ergebnis').innerText()).includes('Stern'));
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
  await klasse.click(); const erster = await seite.locator('.an-c-zug').innerText();
  await klasse.click(); const zweiter = await seite.locator('.an-c-zug').innerText();
  pruefe('Klassen-Tabelle springt zu beiden Seiten', erster !== zweiter && /Anna|Ben/.test(erster + zweiter), { erster, zweiter });
  for (const [width, height] of [[1180, 820], [820, 1180], [390, 844]]) for (const modus of ['hell', 'dunkel']) {
    await seite.setViewportSize({ width, height });
    await seite.evaluate(modus => window.__app.setzeEinstellungen({ modus }), modus);
    await start('5');
    await seite.locator('.zz-brett').scrollIntoViewIfNeeded();
    const masse = await seite.evaluate(() => {
      const b = document.querySelector('.zz-brett').getBoundingClientRect();
      return { quer: document.documentElement.scrollWidth <= innerWidth, brett: b.x >= 0 && b.right <= innerWidth + 1 && b.y >= 0 && b.bottom <= innerHeight + 1,
        knoepfe: [...document.querySelectorAll('.zz-screen button')].every(b => b.getBoundingClientRect().height >= 44), namen: document.querySelectorAll('.zz-name b').length === 2 };
    });
    pruefe(`${width}x${height} ${modus}: Brett sichtbar, kein Ueberlauf, Namen und Tippflaechen`, Object.values(masse).every(Boolean), masse);
    if (process.env.BILDER) { mkdirSync(process.env.BILDER, { recursive: true }); await seite.screenshot({ path: path.join(process.env.BILDER, `zuzweit-${width}-${modus}.png`) }); }
    await aufgeben();
  }
  pruefe('Keine Konsolen- oder Seitenfehler', fehler.length === 0, fehler);
} catch (e) { pruefe('Ablauf ohne Abbruch', false, e.stack); }
finally { await kontext?.close(); await browser?.close(); await new Promise(r => server.close(r)); }
console.log(`\n${ok}/${gesamt} bestanden`);
process.exitCode = ok === gesamt ? 0 : 1;
