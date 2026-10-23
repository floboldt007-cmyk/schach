// Browser-Test fuer js/engine.js und js/bots.js (Stockfish laeuft nur im Browser als Worker).
// Startet einen lokalen Server (Port 8821), oeffnet tests/engine-bots.html in Chromium
// (Playwright) und wertet die Pruefungen aus.
//
//   node tests/engine-bots.test.mjs              alles inkl. Staerke-Kurve und Kalibrierung
//   node tests/engine-bots.test.mjs --schnell    nur Engine- und Bot-Pruefungen
//   Optionen: --partien=6 --zuglimit=120 --paare=1-3,3-5,5-7,7-9 --proben=3 --parallel=4
//             --anker (zusaetzlich Vergleich mit Stockfish UCI_Elo, nur Bericht) --ankerpartien=4
//
// Playwright: Pfad per Umgebungsvariable PLAYWRIGHT_PFAD, sonst normales 'playwright'.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8821);

function ladePlaywright() {
  const kandidaten = [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean);
  for (const k of kandidaten) {
    try { return require(k); } catch (e) { /* naechster */ }
  }
  throw new Error('Playwright nicht gefunden (PLAYWRIGHT_PFAD setzen)');
}

function argument(name, standard) {
  const a = process.argv.find((x) => x.startsWith('--' + name + '='));
  return a ? a.slice(name.length + 3) : standard;
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

const schnell = process.argv.includes('--schnell');
const optionen = {
  schnell,
  kalibrierung: {
    partien: Number(argument('partien', 6)),
    zuglimit: Number(argument('zuglimit', 120)),
    parallel: Number(argument('parallel', 4)),
    paare: argument('paare', '1-3,3-5,5-7,7-9').split(',').map((p) => p.split('-').map(Number)),
  },
  staerke: { proben: Number(argument('proben', 3)), parallel: Number(argument('parallel', 4)) },
  anker: process.argv.includes('--anker') ? { partien: Number(argument('ankerpartien', 4)) } : null,
};

const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {
  cwd: WURZEL, stdio: 'ignore',
});
let browser;
let code = 1;
try {
  await warteAufServer(`http://127.0.0.1:${PORT}/tests/engine-bots.html`);
  const { chromium } = ladePlaywright();
  browser = await chromium.launch();
  const seite = await browser.newPage();
  seite.on('console', (m) => console.log(m.text()));
  seite.on('pageerror', (e) => console.log('Seitenfehler: ' + e.message));
  await seite.goto(`http://127.0.0.1:${PORT}/tests/engine-bots.html`);
  await seite.waitForFunction(() => window.bereit === true, null, { timeout: 15000 });
  const ergebnis = await seite.evaluate((o) => window.tests.alle(o), optionen);
  const fehler = ergebnis.ergebnisse.filter((r) => !r.ok);
  console.log('\n' + JSON.stringify(ergebnis.bericht, null, 1));
  console.log(`\n${ergebnis.ergebnisse.length - fehler.length}/${ergebnis.ergebnisse.length} bestanden in ${ergebnis.sekunden} s`);
  for (const f of fehler) console.log('FEHLER: ' + f.name + (f.detail ? ' (' + f.detail + ')' : ''));
  code = fehler.length ? 1 : 0;
} catch (e) {
  console.error(e);
  code = 1;
} finally {
  if (browser) await browser.close();
  server.kill();
}
process.exit(code);
