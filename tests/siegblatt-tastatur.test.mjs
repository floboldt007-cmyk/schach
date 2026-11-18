// Sieg-Blatt nur mit der Tastatur (Punkt 30, Barrierefreiheit 09.11.2026): nach einem Schaefermatt gegen Benno
// bleibt Tab im Blatt, der Bildschirm dahinter ist inert, Escape zeigt das Brett (Fokus auf "Ergebnis"),
// Enter darauf oeffnet das Blatt wieder mit Fokus-Halt.
// Aufruf: node tests/siegblatt-tastatur.test.mjs
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

// Schaefermatt: Benno antwortet nach Plan (wie R4-Messrunde/Siegblatt-Laenge)
const ZUEGE = ['e2e4', 'f1c4', 'd1h5', 'h5f7'];
const PLAN = { e2e4: 'e7e5', f1c4: 'b8c6', d1h5: 'g8f6' };
const imBlatt = (s) => s.evaluate(() => !!document.activeElement.closest('.ergebnis-overlay'));
const offen = (s) => s.evaluate(() => { const o = document.querySelector('.ergebnis-overlay'); return !!o && !o.hidden; });

// Neuer Kontext, Schaefermatt gegen Benno bis das Sieg-Blatt gefuellt ist
async function siegen(browser, viewport, fehler) {
  const k = await browser.newContext({ viewport, locale: 'de-DE' });
  await k.addInitScript(() => {
    try { if (!localStorage.getItem('schach-arena:v1:modul:start')) localStorage.setItem('schach-arena:v1:modul:start', JSON.stringify({ v: 1, gesehen: '2026-11-01' })); } catch (e) { /* egal */ }
  });
  const s = await k.newPage();
  s.on('pageerror', (e) => fehler.push(e.message));
  await s.goto(`http://127.0.0.1:${server.address().port}/index.html?test#heim`);
  await s.waitForFunction(() => window.__app && document.documentElement.dataset.screen, null, { timeout: 30000 });
  await warte(1200);   // Start erst fertig laden lassen (wie R4-Messrunde/Siegblatt-Laenge), ohne hing der Partiestart gelegentlich
  await s.evaluate((plan) => {
    localStorage.removeItem('schach-arena:v1:laufend');
    window.__test = { botZug: () => { const v = window.__partie.chess().history({ verbose: true }); return plan[v[v.length - 1].lan] || null; } };
  }, PLAN);
  await s.evaluate(() => window.__app.gehe('partie', { botId: 'benno', farbe: 'w' }));
  await s.waitForFunction(() => window.__partie && window.__partie.bereit === true, null, { timeout: 30000 });
  for (const z of ZUEGE) {
    await s.waitForFunction(() => window.__partie.phase() === 'flo', null, { timeout: 30000 });
    for (const f of [z.slice(0, 2), z.slice(2, 4)]) await s.locator(`.screen.partie .brett-felder .feld[data-feld="${f}"]`).click();
    if (await s.locator('.screen.partie .brett .lage.vorschau').count()) await s.locator(`.screen.partie .brett-felder .feld[data-feld="${z.slice(2, 4)}"]`).click();
  }
  await s.waitForSelector('.ergebnis-overlay.sieg.gefuellt', { timeout: 40000 });
  await warte(1500);
  return s;
}

async function main() {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const browser = await browserTyp(ladePlaywright()).launch();
  const fehler = [];
  try {
    const s = await siegen(browser, { width: 1280, height: 720 }, fehler);

    pruefe('Sieg-Blatt: Fokus liegt im Blatt', await imBlatt(s));
    pruefe('Sieg-Blatt: Bildschirm dahinter ist inert', await s.evaluate(() => {
      const o = document.querySelector('.ergebnis-overlay');
      return [...o.parentElement.children].filter((e) => e !== o).every((e) => e.inert);
    }));
    let raus = 0;
    for (let i = 0; i < 30; i++) { await s.keyboard.press('Tab'); if (!(await imBlatt(s))) raus++; }
    pruefe('Sieg-Blatt: 30x Tab bleibt im Blatt', raus === 0, `${raus}x draussen`);
    raus = 0;
    for (let i = 0; i < 12; i++) { await s.keyboard.press('Shift+Tab'); if (!(await imBlatt(s))) raus++; }
    pruefe('Sieg-Blatt: Umschalt+Tab bleibt im Blatt', raus === 0, `${raus}x draussen`);

    await s.keyboard.press('Escape'); await warte(400);
    pruefe('Escape: Blatt zu, Brett zu sehen', !(await offen(s)));
    pruefe('Escape: Fokus auf "Ergebnis", Hintergrund wieder bedienbar', await s.evaluate(() =>
      document.activeElement.matches('.ergebnis-zeigen') && !document.querySelector('.screen.partie .brett').closest('[inert]')));
    await s.keyboard.press('Enter'); await warte(400);
    pruefe('Enter auf "Ergebnis": Blatt wieder offen, Fokus im Blatt, Hintergrund inert', await offen(s) && await imBlatt(s)
      && await s.evaluate(() => !!document.querySelector('.screen.partie .brett').closest('[inert]')));
    // R13-1 (Kritik-Messung 10.11.): auf dem iPhone SE war der Rumpf 2 px breiter als sein Kasten, das Blatt liess sich seitlich wischen
    const se = await siegen(browser, { width: 375, height: 548 }, fehler);
    await warte(3500);   // Feier-Animationen auslaufen lassen
    const quer = await se.evaluate(() => {
      const r = document.querySelector('.ergebnis-overlay .erg-rumpf');
      const rand = r.getBoundingClientRect().right;
      const raus = [...r.querySelectorAll('*')].filter((e) => e.getBoundingClientRect().right > rand + 0.5).map((e) => e.className.baseVal ?? e.className).slice(0, 4);
      return { ueber: r.scrollWidth - r.clientWidth, raus };
    });
    pruefe('iPhone SE: Sieg-Blatt ohne seitlichen Ueberlauf (R13-1)', quer.ueber <= 0, JSON.stringify(quer));
    pruefe('Keine Seitenfehler', fehler.length === 0, fehler.join(' | '));
  } catch (e) {
    pruefe('Ablauf ohne Abbruch', false, e.message.split('\n')[0] + ' ' + (e.stack || '').split('\n').find((z) => /siegblatt-tastatur/.test(z)));
  } finally {
    await browser.close(); server.close();
  }
  const gut = ergebnisse.filter((e) => e.ok).length;
  console.log(`\n${gut}/${ergebnisse.length} bestanden`);
  process.exit(gut === ergebnisse.length ? 0 : 1);
}
main();
