// Brett per Tastatur und mit Feldnamen (Punkt 34, Barrierefreiheit 10.11.2026).
// Teil A (Brett-Demo): Felder sind Knoepfe mit Namen ("e2, weißer Bauer"), Tab erreicht das Brett, Pfeiltasten bewegen den
// Fokus, Enter waehlt und zieht, Escape nimmt zurueck, Umwandlung und Zug-Bestaetigung per Tastatur, die Maus zieht wie bisher.
// Teil B (Partie gegen Benno): der Bot-Zug kommt in die Zugansage, Pfeiltasten auf dem Brett blaettern nicht in den Zuegen.
// Aufruf: node tests/brett-tastatur.test.mjs
import http from 'node:http';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { browserTyp } from './browser.mjs';

const require = createRequire(import.meta.url);
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

const ergebnisse = [];
function pruefe(name, ok, detail = '') {
  ergebnisse.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'ok  ' : 'FEHLER'} ${name}${!ok && detail ? ' (' + detail + ')' : ''}`);
}

function ladePlaywright() {
  for (const k of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
    try { return require(k); } catch (e) { /* naechster */ }
  }
  throw new Error('Playwright nicht gefunden (PLAYWRIGHT_PFAD setzen)');
}

const TYPEN = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm', '.json': 'application/json', '.png': 'image/png', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json' };
const server = http.createServer(async (q, r) => {
  try {
    const p = decodeURIComponent(new URL(q.url, 'http://x').pathname);
    const d = await readFile(path.join(WURZEL, p === '/' ? 'index.html' : p));
    r.writeHead(200, { 'Content-Type': TYPEN[path.extname(p)] || 'application/octet-stream' });
    r.end(d);
  } catch (e) { r.writeHead(404); r.end(); }
});

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const name = (s, feld) => s.evaluate((f) => document.querySelector(`#brett .feld[data-feld="${f}"]`).getAttribute('aria-label'), feld);
const aktiv = (s) => s.evaluate(() => (document.activeElement && document.activeElement.dataset.feld) || null);
const drueck = async (s, taste, n = 1) => { for (let i = 0; i < n; i++) await s.keyboard.press(taste); };
const fokusAuf = (s, feld) => s.evaluate((f) => document.querySelector(`#brett .feld[data-feld="${f}"]`).focus(), feld);

async function teilDemo(browser, port) {
  const k = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'de-DE' });
  const s = await k.newPage();
  const fehler = [];
  s.on('pageerror', (e) => fehler.push(e.message));
  s.on('console', (m) => { if (m.type() === 'error' && !/favicon/.test(m.location()?.url || '')) fehler.push(m.text()); });
  await s.goto(`http://127.0.0.1:${port}/tests/board-demo.html`);
  await s.waitForFunction(() => window.bereit === true, null, { timeout: 15000 });
  await s.evaluate(() => { demo.abzeichenAus(); demo.klang.aus = true; demo.brett.autoDame = false; });

  const felder = await s.evaluate(() => {
    const f = [...document.querySelectorAll('#brett .feld')];
    return { knoepfe: f.filter((x) => x.getAttribute('role') === 'button').length, nullen: f.filter((x) => x.tabIndex === 0).map((x) => x.dataset.feld) };
  });
  pruefe('Felder: 64 Knoepfe, genau eines in der Tab-Folge (e2)', felder.knoepfe === 64 && felder.nullen.join() === 'e2', JSON.stringify(felder));
  pruefe('Feldnamen: "e2, weißer Bauer", "e4, leer", "e8, schwarzer König"',
    await name(s, 'e2') === 'e2, weißer Bauer' && await name(s, 'e4') === 'e4, leer' && await name(s, 'e8') === 'e8, schwarzer König',
    [await name(s, 'e2'), await name(s, 'e4'), await name(s, 'e8')].join(' | '));

  // Tab vom Seitenanfang erreicht das Brett
  await s.evaluate(() => { document.activeElement && document.activeElement.blur(); window.scrollTo(0, 0); });
  let tabs = 0;
  while (tabs < 80 && (await aktiv(s)) !== 'e2') { await s.keyboard.press('Tab'); tabs++; }
  pruefe('Tab erreicht das Brett (Feld e2)', (await aktiv(s)) === 'e2', `${tabs}x Tab`);

  await drueck(s, 'ArrowUp', 2);
  const ring = await s.evaluate(() => { const r = document.querySelector('#brett .brett-fokus'); return { an: !!r && !r.hidden, feld: r ? r.dataset.feld : null }; });
  pruefe('Pfeil hoch 2x: Fokus auf e4, Ring sichtbar dort', (await aktiv(s)) === 'e4' && ring.an && ring.feld === 'e4', JSON.stringify(ring));
  pruefe('Wandernder Fokus: jetzt hat e4 tabindex 0 und e2 -1', await s.evaluate(() =>
    document.querySelector('#brett .feld[data-feld="e4"]').tabIndex === 0 && document.querySelector('#brett .feld[data-feld="e2"]').tabIndex === -1));

  await drueck(s, 'ArrowDown', 2);
  await s.keyboard.press('Enter');
  pruefe('Enter auf e2: gewaehlt, e4 mögliches Ziel', (await name(s, 'e2')).includes('ausgewählt') && (await name(s, 'e4')).includes('mögliches Ziel')
    && await s.locator('#brett .lage.auswahl').count() === 1, `${await name(s, 'e2')} | ${await name(s, 'e4')}`);
  await s.keyboard.press('Escape');
  pruefe('Escape nimmt die Auswahl zurueck', await s.locator('#brett .lage.auswahl').count() === 0 && !(await name(s, 'e2')).includes('ausgewählt'));

  await s.keyboard.press('Space');
  await drueck(s, 'ArrowUp', 2);
  await s.keyboard.press('Enter');
  await warte(400);
  const nachZug = await s.evaluate(() => ({ log: demo.zugLog.map((z) => z.von + z.nach + ':' + z.ok + ':' + z.art), fen: demo.chess.fen() }));
  pruefe('Leertaste waehlt, Enter zieht e2-e4 (art tippen)', nachZug.log.join() === 'e2e4:true:tippen', JSON.stringify(nachZug.log));
  pruefe('Nach dem Zug: Fokus bleibt auf e4, Name "e4, weißer Bauer, letzter Zug"', (await aktiv(s)) === 'e4'
    && await name(s, 'e4') === 'e4, weißer Bauer, letzter Zug', await name(s, 'e4'));

  // Brettrand: Pfeil links bleibt auf a4, die Seite scrollt nicht
  const y0 = await s.evaluate(() => window.scrollY);
  await drueck(s, 'ArrowLeft', 6);
  pruefe('Brettrand: 6x Pfeil links endet auf a4, Seite scrollt nicht', (await aktiv(s)) === 'a4' && (await s.evaluate(() => window.scrollY)) === y0);

  // Umwandlung per Tastatur: Fokus auf die Dame, Escape bricht ab (Fokus zurueck aufs Feld), Enter auf der Dame zieht
  await s.evaluate(() => demo.setzeFen('8/P6k/8/8/8/8/8/K7 w - - 0 1'));
  await fokusAuf(s, 'a7');
  await s.keyboard.press('Enter');
  await s.keyboard.press('ArrowUp');
  await s.keyboard.press('Enter');
  const wahl = await s.evaluate(() => ({ offen: !document.querySelector('#brett .brett-umwandlung').hidden,
    fokus: document.activeElement.classList.contains('umwandlung-figur') ? document.activeElement.dataset.figur : null }));
  pruefe('Umwandlung: Wahl offen, Fokus auf der Dame', wahl.offen && wahl.fokus === 'q', JSON.stringify(wahl));
  await s.keyboard.press('Escape');
  await warte(300);
  pruefe('Umwandlung: Escape bricht ab, Fokus zurueck auf a8, kein Zug', await s.evaluate(() =>
    document.querySelector('#brett .brett-umwandlung').hidden && demo.zugLog.length === 1) && (await aktiv(s)) === 'a8');
  await drueck(s, 'ArrowDown');
  await s.keyboard.press('Enter');
  await s.keyboard.press('ArrowUp');
  await s.keyboard.press('Enter');
  await warte(600);   // die Wahl nimmt Tastatur-Klicks erst nach 500 ms an (Schutz gegen den Klick des oeffnenden Tipps)
  await s.keyboard.press('Tab');
  await s.keyboard.press('Enter');
  await warte(400);
  const umw = await s.evaluate(() => demo.zugLog[demo.zugLog.length - 1]);
  pruefe('Umwandlung: Tab zum Turm, Enter wandelt a7-a8 in einen Turm', umw && umw.von === 'a7' && umw.nach === 'a8' && umw.umwandlung === 'r' && umw.ok,
    JSON.stringify(umw));
  pruefe('Umwandlung: danach liegt der Fokus wieder auf dem Brett (a8)', (await aktiv(s)) === 'a8');

  // Zug bestaetigen: erstes Enter zeigt die Vorschau, zweites zieht
  await s.evaluate((fen) => { demo.brett.setzeBestaetigen(true); demo.setzeFen(fen); }, START);
  await fokusAuf(s, 'd2');
  await s.keyboard.press('Enter');
  await drueck(s, 'ArrowUp', 2);
  await s.keyboard.press('Enter');
  const vorschau = await s.evaluate(() => ({ lage: !!document.querySelector('#brett .lage.vorschau'), n: demo.zugLog.length }));
  pruefe('Bestaetigen: erstes Enter zeigt die Vorschau, Name sagt es an', vorschau.lage && vorschau.n === 2 && (await name(s, 'd4')).includes('Vorschau'),
    await name(s, 'd4'));
  await s.keyboard.press('Enter');
  await warte(400);
  pruefe('Bestaetigen: zweites Enter zieht d2-d4', await s.evaluate(() => { const z = demo.zugLog[demo.zugLog.length - 1]; return z.von === 'd2' && z.nach === 'd4' && z.ok; }));

  // Maus wie bisher: Klick g1, Klick f3 zieht, der Tastatur-Ring zeigt sich dabei nicht
  await s.evaluate((fen) => { demo.brett.setzeBestaetigen(false); demo.setzeFen(fen); }, START);
  await s.locator('#brett .feld[data-feld="g1"]').click();
  await s.locator('#brett .feld[data-feld="f3"]').click();
  await warte(400);
  const maus = await s.evaluate(() => ({ z: demo.zugLog[demo.zugLog.length - 1], ring: !!document.querySelector('#brett .brett-fokus:not([hidden])') }));
  pruefe('Maus: Klick g1, Klick f3 zieht wie bisher, kein Tastatur-Ring', maus.z.von === 'g1' && maus.z.nach === 'f3' && maus.z.ok && !maus.ring,
    JSON.stringify(maus));

  // gedrehtes Brett: oben links steht h1
  await s.evaluate(() => demo.brett.setzeAusrichtung('b'));
  pruefe('Gedreht: das erste Feld oben links heisst "h1, weißer Turm"', await s.evaluate(() =>
    document.querySelector('#brett .feld').getAttribute('aria-label') === 'h1, weißer Turm'));

  // ein Brett, das nie Zuege annimmt, bleibt still (keine Knoepfe, keine Tab-Stopps)
  pruefe('Brett ohne Zuege (nur Ansicht): keine Knoepfe, kein Tab-Stopp', await s.evaluate(async () => {
    const { Brett } = await import('../js/board.js');
    const d = document.createElement('div');
    document.body.append(d);
    const b = new Brett(d, { figurenPfad: '../assets/pieces/', fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' });
    const still = !d.querySelector('.feld[role], .feld[tabindex]') && !d.hasAttribute('role');
    b.zerstoere(); d.remove();
    return still;
  }));
  pruefe('Demo: keine Seiten- oder Konsolenfehler', fehler.length === 0, fehler.join(' | '));
  await k.close();
}

async function teilPartie(browser, port) {
  const k = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'de-DE' });
  await k.addInitScript(() => {
    try { if (!localStorage.getItem('schach-arena:v1:modul:start')) localStorage.setItem('schach-arena:v1:modul:start', JSON.stringify({ v: 1, gesehen: '2026-11-01' })); } catch (e) { /* egal */ }
  });
  const s = await k.newPage();
  const fehler = [];
  s.on('pageerror', (e) => fehler.push(e.message));
  await s.goto(`http://127.0.0.1:${port}/index.html?test#heim`);
  await s.waitForFunction(() => window.__app && document.documentElement.dataset.screen, null, { timeout: 30000 });
  await warte(1200);   // wie siegblatt-tastatur: Start erst fertig laden lassen
  await s.evaluate(() => {
    localStorage.removeItem('schach-arena:v1:laufend');
    window.__test = { botZug: () => { const v = window.__partie.chess().history({ verbose: true }); return { e2e4: 'e7e5' }[v[v.length - 1].lan] || null; } };
  });
  await s.evaluate(() => window.__app.gehe('partie', { botId: 'benno', farbe: 'w' }));
  await s.waitForFunction(() => window.__partie && window.__partie.bereit === true, null, { timeout: 30000 });
  await s.waitForFunction(() => window.__partie.phase() === 'flo', null, { timeout: 30000 });

  const sel = (f) => `.screen.partie .brett-felder .feld[data-feld="${f}"]`;
  pruefe('Partie: Brett hat Feldnamen ("e2, weißer Bauer")', await s.locator(sel('e2')).getAttribute('aria-label') === 'e2, weißer Bauer');
  await s.locator(sel('e2')).focus();
  await s.keyboard.press('Enter');
  await drueck(s, 'ArrowUp', 2);
  await s.keyboard.press('Enter');
  await s.waitForFunction(() => window.__partie.chess().history().length >= 2, null, { timeout: 30000 }).catch(() => {});
  pruefe('Partie: e2-e4 per Tastatur gezogen', await s.evaluate(() => window.__partie.chess().history()[0] === 'e4'));
  await s.waitForFunction(() => /zieht/.test(document.querySelector('.zugansage')?.textContent || ''), null, { timeout: 15000 }).catch(() => {});
  const ansage = await s.evaluate(() => document.querySelector('.zugansage')?.textContent || '');
  const rufname = await s.evaluate(() => document.querySelector('.screen.partie')?.getAttribute('aria-label') || '');
  pruefe('Partie: Bot-Zug in der Zugansage ("<Rufname> zieht 1… e5.")', /^\S+ zieht 1… e5\.$/.test(ansage), ansage + ' | ' + rufname);

  await s.waitForFunction(() => window.__partie.phase() === 'flo', null, { timeout: 30000 });
  const ansicht = () => s.evaluate(() => !!document.querySelector('.screen.partie .zug-ansicht'));
  await s.locator(sel('e4')).focus();
  await s.keyboard.press('ArrowLeft');
  pruefe('Partie: Pfeil links auf dem Brett bewegt den Fokus (d4) und blaettert nicht', (await s.evaluate(() => document.activeElement.dataset.feld)) === 'd4'
    && !(await ansicht()));
  // Gegenprobe im selben Lauf: ausserhalb des Bretts blaettert Pfeil links wie bisher
  await s.evaluate(() => document.activeElement.blur());
  await s.keyboard.press('ArrowLeft');
  await warte(300);
  pruefe('Partie: ausserhalb des Bretts blaettert Pfeil links weiter (Zug-Ansicht)', await ansicht());
  pruefe('Partie: keine Seitenfehler', fehler.length === 0, fehler.join(' | '));
  await k.close();
}

async function main() {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const browser = await browserTyp(ladePlaywright()).launch();
  try {
    await teilDemo(browser, port);
    await teilPartie(browser, port);
  } catch (e) {
    pruefe('Ablauf ohne Abbruch', false, e.message.split('\n')[0] + ' ' + (e.stack || '').split('\n').find((z) => /brett-tastatur/.test(z)));
  } finally {
    await browser.close(); server.close();
  }
  const gut = ergebnisse.filter((e) => e.ok).length;
  console.log(`\n${gut}/${ergebnisse.length} bestanden`);
  process.exit(gut === ergebnisse.length ? 0 : 1);
}
main();
