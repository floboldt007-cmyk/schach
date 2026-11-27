// Werkzeug werkzeuge/falsche-uhr.mjs (T-072, Kaltreview I zu #305): eine gueltige FAKE_ZEIT wirkt in Node und in der
// Browser-Seite (ueber browser.newContext und browser.newPage, auch nach einer Navigation genau einmal), eine unlesbare
// FAKE_ZEIT bricht laut ab (Ausgang 2, Meldung auf stderr), ohne FAKE_ZEIT wirkt nichts und es kommt keine Meldung.
//   PLAYWRIGHT_PFAD=... node tests/falsche-uhr.test.mjs
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WERKZEUG = pathToFileURL(path.join(WURZEL, 'werkzeuge', 'falsche-uhr.mjs')).href;
let ok = 0, gesamt = 0;
function pruefe(name, gut, detail = '') {
  gesamt++; if (gut) ok++;
  // INTENTIONAL-SLOP[T4]: die Pruefzeile ist die Ausgabe des Tests
  console.log(`${gut ? 'ok  ' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(detail).slice(0, 400)}`);
}

// Kindprozess mit dem Werkzeug als --import; er meldet Node-Zeit und (mit browser) die Seitenzeit je Weg als JSON
const KIND = `
import { createRequire } from 'node:module';
const aus = { node: Date.now(), nodeNeu: new Date().getTime() };
if (process.env.MIT_BROWSER) {
  const require = createRequire(process.cwd() + '/');
  let pw = null;
  for (const p of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
    try { pw = require(p); break; } catch (e) { /* naechster */ }
  }
  const b = await pw.chromium.launch();
  try {
    for (const weg of ['newContext', 'newPage']) {
      const s = weg === 'newPage' ? await b.newPage() : await (await b.newContext()).newPage();
      await s.goto('data:text/html,<p>x</p>');
      aus[weg] = await s.evaluate(() => Date.now());
      await s.goto('data:text/html,<p>y</p>');
      aus[weg + 'Zweite'] = await s.evaluate(() => Date.now());
    }
  } finally { await b.close(); }
}
console.log(JSON.stringify(aus));
`;
// Saubere Umgebung fuer jedes Kind: laeuft dieser Test selbst unter dem Werkzeug (ganze Suite mit
// NODE_OPTIONS=--import ... und FAKE_ZEIT), darf das Kind weder den geerbten Preload noch die geerbte FAKE_ZEIT haben.
// Das Werkzeug bekommt es nur ueber das ausdrueckliche --import unten, FAKE_ZEIT nur, wo der Fall sie setzt.
function sauber(extra = {}) {
  const env = { ...process.env, ...extra };
  // Windows reicht Namen in jeder Schreibweise weiter (node_options, fake_zeit): darum ohne Ruecksicht auf Gross/klein
  for (const k of Object.keys(env)) if (/^(node_options|fake_zeit)$/i.test(k)) delete env[k];
  return env;
}
function lauf(fake, mitBrowser = false) {
  const env = sauber({ MIT_BROWSER: mitBrowser ? '1' : '' });
  if (fake !== undefined) env.FAKE_ZEIT = fake;
  const r = spawnSync(process.execPath, ['--import', WERKZEUG, '--input-type=module', '-e', KIND], { cwd: WURZEL, env, encoding: 'utf8', timeout: 120000 });
  let daten = null;
  try { daten = JSON.parse(r.stdout.trim().split('\n').at(-1)); } catch (e) { /* bleibt null */ }
  return { code: r.status, stderr: r.stderr || '', daten };
}
const nah = (a, b) => Number.isFinite(a) && Math.abs(a - b) < 120000;
// Bezug "echte Uhr" aus einem sauberen Kind ohne Werkzeug, nicht aus dem eigenen Date.now(): unter dem Preload
// zeigt die eigene Uhr die falsche Zeit (Befund K, 27.11.: 13/15, nah() um ~9 h daneben)
function echteZeit() {
  const r = spawnSync(process.execPath, ['-e', 'console.log(Date.now())'], { env: sauber(), encoding: 'utf8', timeout: 30000 });
  const ms = Number(r.stdout.trim());
  if (r.status !== 0 || !Number.isFinite(ms)) throw new Error(`Bezugsuhr nicht lesbar: ${r.status} ${r.stderr}`);
  return ms;
}

// gueltige Zeit: Node und Browser (beide Wege, auch nach der zweiten Navigation genau einmal verschoben)
const ZIEL = '2026-11-27T00:30:00Z';
const soll = Date.parse(ZIEL);
let r = lauf(ZIEL, true);
pruefe('gueltige FAKE_ZEIT: Node (Date.now und new Date) steht auf der falschen Zeit', r.code === 0 && nah(r.daten?.node, soll) && nah(r.daten?.nodeNeu, soll), r);
pruefe('gueltige FAKE_ZEIT: Seite aus browser.newContext() steht auf der falschen Zeit, auch nach der zweiten Navigation',
  nah(r.daten?.newContext, soll) && nah(r.daten?.newContextZweite, soll), r.daten);
pruefe('gueltige FAKE_ZEIT: Seite aus browser.newPage() genau einmal verschoben (nicht doppelt)',
  nah(r.daten?.newPage, soll) && nah(r.daten?.newPageZweite, soll), r.daten);
pruefe('gueltige FAKE_ZEIT: Meldung auf stderr nennt die Zeit', /falsche-uhr: 2026-11-27T00:30:00\.000Z/.test(r.stderr), r.stderr);

// unlesbare Zeit: laut abbrechen, nie still mit der echten Uhr
for (const falsch of ['2026-13-99', '2026-02-30T00:00:00Z', 'morgen', '27.11.2026 00:30', '2026-11-27T25:00:00Z']) {
  r = lauf(falsch);
  pruefe(`unlesbare FAKE_ZEIT "${falsch}": Ausgang 2, Meldung auf stderr, kein Lauf`, r.code === 2 && /keine gueltige Zeit/.test(r.stderr) && r.daten === null,
    { code: r.code, stderr: r.stderr.slice(0, 200), daten: r.daten });
}
// weitere gueltige Formen
for (const gut of ['2026-11-27', '2026-11-27T00:30', '2026-11-27T01:30:00+01:00', '2026-11-27T00:30:00.250Z']) {
  r = lauf(gut);
  pruefe(`gueltige Form "${gut}" wird angenommen`, r.code === 0 && nah(r.daten?.node, Date.parse(gut)), { code: r.code, stderr: r.stderr.slice(0, 200) });
}

// ohne FAKE_ZEIT (und leer): keine Wirkung, keine Meldung
for (const ohne of [undefined, '']) {
  const vorher = echteZeit();
  r = lauf(ohne, ohne === undefined);
  pruefe(`ohne FAKE_ZEIT (${ohne === undefined ? 'nicht gesetzt' : 'leer'}): echte Uhr, stumm`, r.code === 0 && nah(r.daten?.node, vorher)
    && (ohne !== undefined || (nah(r.daten?.newContext, vorher) && nah(r.daten?.newPage, vorher))) && r.stderr.trim() === '', r);
}

console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
