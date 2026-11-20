// Alter Browser (Flo 20.11.2026, Online-Partie gegen den Opa auf einem alten Samsung-Tablet): die Zuege sprangen
// zurueck. Ursache: js/ui/online.js zeichne() nutzt Array.prototype.at (Chrome 92+); im Microtask nach dem Zug warf
// es, bevor online.sendeZug lief, der Zug kam nie beim Server an. Diese Suite nimmt dem Browser vor jedem Skript die
// neueren Funktionen weg (wie Chrome 85 bis 91) und spielt Online- und Zu-zweit-Zuege. Netz nur simuliert.
//   node tests/alt-browser.test.mjs          PORT=9640 node tests/alt-browser.test.mjs
import http from 'node:http';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Chess } from '../vendor/chess/chess.js';
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
  try { res.writeHead(200, { 'Content-Type': typen[path.extname(p)] || 'application/octet-stream' }); res.end(readFileSync(p)); }
  catch (e) { res.writeHead(404); res.end(); }
});
const PORT = Number(process.env.PORT) || await (await import('./freier-port.mjs')).freierPort();
await new Promise(r => server.listen(PORT, '127.0.0.1', r));

let ok = 0, gesamt = 0, browser;
function pruefe(name, gut, detail = '') { gesamt++; if (gut) ok++; console.log(`${gut ? 'OK' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(detail)}`); }

// laeuft vor jedem Seitenskript: Funktionen, die Chrome erst ab 92/93 kennt (at, Object.hasOwn) und ab 85 (replaceAll)
const NIMM_WEG = () => {
  for (const T of [Array, String, Int8Array, Uint8Array, Uint8ClampedArray, Int16Array, Uint16Array, Int32Array, Uint32Array, Float32Array, Float64Array]) {
    delete T.prototype.at;
  }
  delete Object.getPrototypeOf(Int8Array.prototype).at;
  delete Object.hasOwn;
  delete String.prototype.replaceAll;
  delete Array.prototype.findLast; delete Array.prototype.findLastIndex;
  window.__weg = typeof [].at === 'undefined' && typeof Object.hasOwn === 'undefined';
};

const sitzung = { access_token: 'a.' + Buffer.from(JSON.stringify({ sub: 'u1' })).toString('base64url') + '.x', refresh_token: 'test-r', expires_at: 9999999999, user: { id: 'u1', email: 'spieler@example.invalid' } };
const c0 = new Chess();
const partie = { id: 'partie-alt', code: 'ALT234', weiss: 'u1', schwarz: 'u2', erstellt_von: 'u1', status: 'laeuft', fen: c0.fen(), am_zug: 'w', zuege: '',
  ergebnis: null, grund: null, remis_angebot: null, bedenkzeit_s: null, inkrement_s: 0, uhr_weiss_ms: null, uhr_schwarz_ms: null,
  letzter_zug_am: new Date().toISOString(), erstellt_am: new Date().toISOString(), aktualisiert_am: new Date().toISOString(), gewertet: false };
let stamp = Date.now();
const aktualisieren = () => { stamp = Math.max(Date.now(), stamp + 1); partie.aktualisiert_am = new Date(stamp).toISOString(); };
function serverZug(u) {
  const c = new Chess();
  for (const m of (partie.zuege + ' ' + u).trim().split(' ')) c.move({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] });
  partie.zuege = (partie.zuege + ' ' + u).trim(); partie.fen = c.fen(); partie.am_zug = c.turn(); partie.letzter_zug_am = new Date().toISOString(); aktualisieren();
}
const gesendet = [];

try {
  browser = await browserTyp(pw).launch({ headless: true });
  const kontext = await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true });
  // MODERN=1: Gegenprobe im heutigen Browser (dieselben Schritte muessen dort ohnehin gruen sein)
  if (process.env.MODERN !== '1') await kontext.addInitScript(NIMM_WEG);
  await kontext.addInitScript((s) => {
    localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(s));
    // Klang an: der Zug-Klang laeuft ueber js/sounds.js (Object.hasOwn in paketVon), wie auf dem Tablet
    localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ klang: true, bewegung: 'aus', liveBewertung: false }));
  }, sitzung);
  await kontext.route('**/*.supabase.co/**', async route => {
    const req = route.request(), url = new URL(req.url()), body = req.postDataJSON() || {};
    const antwort = d => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
    if (url.pathname === '/rest/v1/profile') return antwort([{ user_id: 'u1', benutzername: 'Spieler_1' }]);
    if (url.pathname === '/rest/v1/partien_online') {
      const seit = (url.searchParams.get('aktualisiert_am') || '').slice(3);
      return antwort(url.searchParams.has('status') ? [] : !seit || partie.aktualisiert_am > seit ? [partie] : []);
    }
    if (url.pathname === '/functions/v1/online-zug') {
      gesendet.push(body.zug);
      serverZug(body.zug);
      return antwort(partie);
    }
    const rpc = url.pathname.split('/').pop();
    if (rpc === 'online_meine') return antwort([partie]);
    if (rpc === 'kronen_mein_stand') return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST202' }) });
    if (rpc === 'online_live_bewertung_frei') return antwort({ frei: false, rest: 0, unbegrenzt: false });
    if (rpc === 'karte_melde_stufen' || rpc === 'karte_waehle') return antwort({ taler: 0, stufen: {}, banner: ['start'], wahl: { banner: 'start' } });
    if (rpc === 'karte_der_partie' || rpc === 'saison_karte_der_partie') return antwort({});
    return antwort([]);
  });
  const seite = await kontext.newPage(); seite.setDefaultTimeout(15000);
  const fehler = [];
  seite.on('pageerror', e => fehler.push(e.message));
  // fehlende Klang- und Bilddateien der Attrappe (404) sind kein Laufzeitfehler
  seite.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) fehler.push(m.text()); });
  globalThis.__fehler = fehler;
  await seite.goto(`http://127.0.0.1:${PORT}/?test&kern&erw=pakete/online/index`);
  await seite.waitForFunction(() => !!window.__app);
  if (process.env.MODERN !== '1') pruefe('Nachbildung: at und Object.hasOwn fehlen vor dem ersten App-Skript', await seite.evaluate(() => window.__weg === true));
  pruefe('Ersatz: nach dem Laden gibt es at und Object.hasOwn wieder (frueh geladen, vor js/app.js)',
    await seite.evaluate(() => {
      try {
        return [1, 2].at(-1) === 2 && [1, 2].at(5) === undefined && 'ab'.at(-1) === 'b' && new Uint8Array([7]).at(0) === 7
          && Object.hasOwn({ x: 1 }, 'x') && !Object.hasOwn({}, 'toString') && 'a-a'.replaceAll('a', 'b') === 'b-b'
          && [1, 2, 3].findLast((x) => x < 3) === 2 && Object.keys([]).length === 0 && !Object.keys(Array.prototype).includes('at');
      } catch (e) { return String(e); }
    }) === true);

  const tippe = async (uci, wo = '.on-brett') => {
    for (const f of [uci.slice(0, 2), uci.slice(2, 4)]) {
      const r = await seite.locator(`${wo} .feld[data-feld="${f}"]`).boundingBox();
      await seite.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2);
    }
  };
  // ---- Online: eigener Zug geht an den Server, Gegnerzug kommt an, zweiter eigener Zug geht auch ----
  await seite.evaluate(id => window.__app.gehe('online', { partieId: id }), partie.id);
  await seite.waitForFunction(() => window.__online?.brett() && window.__online.partie()?.id === 'partie-alt'
    && document.querySelector('.on-brett')?.getBoundingClientRect().width > 100).catch(() => {});
  const stand = await seite.evaluate(() => ({ brett: !!window.__online?.brett?.(), partie: window.__online?.partie?.()?.id || null,
    screen: [...document.querySelectorAll('.screen')].map((s) => s.className).join(' | '), meldung: document.querySelector('.on-meldung:not([hidden])')?.textContent || '' }));
  pruefe('Online im alten Browser: die Partie oeffnet mit Brett', stand.brett && stand.partie === 'partie-alt', { stand, fehler });
  await tippe('e2e4');
  await seite.waitForFunction(() => window.__online.partie()?.zuege === 'e2e4' && !window.__online.busy(), null, { timeout: 6000 }).catch(() => {});
  pruefe('Online im alten Browser: der eigene Zug geht an den Server (online-zug) und bleibt stehen',
    gesendet[0] === 'e2e4' && await seite.evaluate(() => window.__online.chess().get('e4')?.color === 'w'), { gesendet, fehler });
  serverZug('e7e5');
  await seite.waitForFunction(() => window.__online.chess().history().length === 2, null, { timeout: 8000 }).catch(() => {});
  pruefe('Online im alten Browser: der Zug des Gegners kommt an', await seite.evaluate(() => window.__online.chess().get('e5')?.color === 'b'), fehler);
  await tippe('g1f3');
  await seite.waitForFunction(() => window.__online.partie()?.zuege.endsWith('g1f3') && !window.__online.busy(), null, { timeout: 6000 }).catch(() => {});
  pruefe('Online im alten Browser: auch der zweite eigene Zug geht an den Server', gesendet[1] === 'g1f3'
    && await seite.evaluate(() => window.__online.chess().get('f3')?.type === 'n'), { gesendet, fehler });

  // ---- Zu zweit: beide Seiten ziehen (zeichne() mit .at(-1) gab sonst das Brett nach dem ersten Zug nie wieder frei) ----
  await seite.evaluate(() => window.__app.gehe('heim'));
  await seite.locator('[data-aktion="heim-zuzweit"]').click();
  await seite.locator('.zz-start .zz-los').click();
  const zzBrett = '.zz-brett';
  await seite.waitForFunction((w) => document.querySelectorAll('.screen').length === 1
    && document.querySelector(w)?.querySelector('.feld[data-feld="e2"]')?.getBoundingClientRect().width > 10, zzBrett);
  const figurAuf = (f) => seite.evaluate(([w, f]) => document.querySelector(w).querySelector(`img.figur[data-feld="${f}"]`)?.dataset.figur || null, [zzBrett, f]);
  await tippe('e2e4', zzBrett); await seite.waitForTimeout(400);
  await tippe('e7e5', zzBrett); await seite.waitForTimeout(400);
  pruefe('Zu zweit im alten Browser: Weiss und Schwarz ziehen nacheinander', (await figurAuf('e5')) === 'bP' && (await figurAuf('e4')) === 'wP',
    { e4: await figurAuf('e4'), e5: await figurAuf('e5'), fehler });
  pruefe('Keine Laufzeitfehler im alten Browser', fehler.length === 0, fehler);
} catch (e) {
  pruefe('Suite lief durch', false, { fehler: e.stack || String(e), seite: globalThis.__fehler });
} finally {
  await browser?.close(); server.close();
}
console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
