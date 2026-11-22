// R26 (Befund 9f, 21.11.2026) im echten Browser: frisches Geraet (kein Merker der Sonderstuecke), gespeicherte Wahl Koenig,
// Antwort des Servers kommt verzoegert. Gemessen am eigenen Bild in der Partie (Spiel-Screen, wird nach der Antwort nicht
// neu gezeigt):
// A) Erfinder: vor der Antwort und danach der Koenig, nie der Bauer.
// B) belegt kein Erfinder: vor der Antwort die eigene Wahl, nach der Antwort tauscht das offene Bild auf den Bauern.
// Ausserdem: die Karte fuer den Gegner (karte_waehle) traegt in keinem Fall den Koenig.
import http from 'node:http';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

let ok = 0, gesamt = 0;
function pruefe(name, gut, info = '') {
  gesamt++; if (gut) ok++;
  console.log(`${gut ? 'ok  ' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(info)}`);
}
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
  try { res.writeHead(200, { 'Content-Type': typen[path.extname(p)] || 'application/octet-stream' }); res.end(readFileSync(p)); }
  catch (e) { res.writeHead(404); res.end(); }
});
const PORT = Number(process.env.PORT) || await (await import('./freier-port.mjs')).freierPort();
await new Promise(r => server.listen(PORT, '127.0.0.1', r));

const UID = 'u1';
const sitzung = { access_token: 'a.' + Buffer.from(JSON.stringify({ sub: UID })).toString('base64url') + '.x', refresh_token: 'test-r', expires_at: 9999999999, user: { id: UID, email: 'spieler@example.invalid' } };
const VERZUG_MS = 2500;

async function lauf(browser, stuecke) {
  const k = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', locale: 'de-DE', timezoneId: 'Europe/Berlin' });
  const karten = [];
  let beantwortet = false;
  await k.route('**/*.supabase.co/**', async (route) => {
    const url = new URL(route.request().url());
    const antwort = d => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
    if (url.pathname === '/rest/v1/sonderstuecke') {
      await new Promise(r => setTimeout(r, VERZUG_MS));
      beantwortet = true;
      return antwort(stuecke.map(stueck_id => ({ stueck_id })));
    }
    if (url.pathname.startsWith('/auth/v1/')) return antwort({ id: UID, email: 'spieler@example.invalid' });
    if (url.pathname === '/rest/v1/profile') return antwort([{ user_id: UID, benutzername: 'Spieler_1' }]);
    const rpc = url.pathname.split('/').at(-1);
    if (rpc === 'karte_waehle') { try { karten.push(route.request().postDataJSON()); } catch (e) { /* egal */ } }
    return antwort([]);
  });
  await k.addInitScript(({ s }) => {
    if (!sessionStorage.getItem('probe-start')) {
      sessionStorage.setItem('probe-start', '1');
      localStorage.clear();
      localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ klang: false, bewegung: 'aus', liveBewertung: false, tiefe: 8 }));
      localStorage.setItem('schach-arena:konto:sichtbar', '1');
      localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(s));
      localStorage.setItem('schach-arena:v1:einstellungen:sammeln', JSON.stringify({ profil: { figur: 'K' } }));
    }
    window.__test = { ...window.__test, botAnhalten: true, maxWarten: 0 };
  }, { s: sitzung });
  const s = await k.newPage(); s.setDefaultTimeout(15000);
  const fehler = [];
  s.on('pageerror', e => fehler.push(e.message));
  // gleich in die Partie, bevor die Antwort da ist (der Fall aus dem Befund: Spiel-Screen wird danach nicht neu gezeigt)
  await s.goto(`http://127.0.0.1:${PORT}/index.html?test#heim`);
  await s.waitForFunction(() => window.__app && typeof window.__app.gehe === 'function' && document.querySelector('.screen.heim-screen'), null, { timeout: 20000 });
  await s.evaluate(() => window.__app.gehe('partie', { botId: 'benno', farbe: 'w' }));
  // nur das eigene Bild im Partie-Kopf (.av), nicht Bilder anderer Screens
  const figur = () => s.evaluate(() => [...document.querySelectorAll('.screen .av svg[data-eigen-avatar]')].map(e => e.dataset.figur));
  await s.waitForFunction(() => document.querySelector('.screen .av svg[data-eigen-avatar]'), null, { timeout: 10000 });
  const vorher = await figur();
  const frueh = !beantwortet;
  await s.waitForTimeout(VERZUG_MS + 1500);
  const nachher = await figur();
  const screen = await s.evaluate(() => location.hash);
  await k.close();
  return { vorher, nachher, frueh, beantwortet, karten, fehler, screen };
}

let browser;
try {
  browser = await pw.chromium.launch();
  const a = await lauf(browser, ['erfinder-titel']);
  pruefe('A Erfinder: Messung vor der Antwort genommen', a.frueh, a);
  pruefe('A Erfinder: vor der Antwort zeigt die Partie den Koenig, keinen Bauern', a.vorher.length > 0 && a.vorher.every(x => x === 'K'), a);
  pruefe('A Erfinder: nach der Antwort weiter der Koenig', a.beantwortet && a.nachher.length > 0 && a.nachher.every(x => x === 'K'), a);
  pruefe('A ohne Seitenfehler', a.fehler.length === 0, a.fehler);
  const b = await lauf(browser, []);
  pruefe('B kein Erfinder: vor der Antwort die eigene Wahl', b.frueh && b.vorher.length > 0 && b.vorher.every(x => x === 'K'), b);
  pruefe('B kein Erfinder: nach der Antwort tauscht das offene Bild im Spiel auf den Bauern', b.beantwortet && b.nachher.length > 0 && b.nachher.every(x => x === 'P'), b);
  pruefe('B ohne Seitenfehler', b.fehler.length === 0, b.fehler);
  const motive = [...a.karten, ...b.karten].map(x => JSON.stringify(x));
  pruefe('Karte fuer andere traegt nie den Koenig', motive.every(x => !/"motiv":"K"|"figur":"K"/.test(x)), motive);
} finally { await browser?.close(); await new Promise(r => server.close(r)); }
console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
