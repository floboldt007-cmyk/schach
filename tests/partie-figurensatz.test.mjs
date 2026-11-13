// Bot-Partie (js/ui/partie.js) zeigt den eigenen Figurensatz auch dann, wenn er sich waehrend der Partie aendert:
// der Erfinder-Status kommt spaet vom Server (js/app.js pruefeSonderstuecke wendet die Einstellungen dann neu an)
// oder der Spieler waehlt einen anderen Satz. Vorher blieb bis zum Neuladen der alte Satz stehen (R3, 12.11.2026;
// dieselbe Luecke war in js/ui/online.js am 11.11. behoben, tests/online-ui.test.mjs "Figurensatz ... spaet").
// Netzwerk ausschliesslich simuliert: kein Test schreibt ins echte Supabase-Projekt.
//   PORT=9631 node tests/partie-figurensatz.test.mjs   eigener Port (Standard: frei)
import http from 'node:http';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
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
  try { res.writeHead(200, { 'Content-Type': typen[path.extname(p)] || 'application/octet-stream' }); res.end(readFileSync(p)); }
  catch (e) { res.writeHead(404); res.end(); }
});
const PORT = Number(process.env.PORT) || await (await import('./freier-port.mjs')).freierPort();
await new Promise(r => server.listen(PORT, '127.0.0.1', r));
const sitzung = { access_token: 'a.' + Buffer.from(JSON.stringify({ sub: 'u1' })).toString('base64url') + '.x', refresh_token: 'test-r', expires_at: 9999999999, user: { id: 'u1', email: 'spieler@example.invalid' } };
let browser, ok = 0, gesamt = 0, sonderVerzug = 0, sonderAntworten = 0;
const fehler = [];
function pruefe(name, gut, detail = '') { gesamt++; if (gut) ok++; console.log(`${gut ? 'OK' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(detail)}`); }
const BRETT = '.screen.partie:not(.online-screen) .brett-rahmen > .brett';
try {
  browser = await browserTyp(pw).launch({ headless: true });
  const kontext = await browser.newContext({ viewport: { width: 1180, height: 820 } });
  await kontext.route('**/*.supabase.co/**', async route => {
    const url = new URL(route.request().url());
    const antwort = d => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
    // Erfinder-Konto: Titel und Figurensatz Blaupause; die Antwort kommt spaet, wie im Handy-Netz
    if (url.pathname === '/rest/v1/sonderstuecke') {
      if (sonderVerzug) await new Promise(r => setTimeout(r, sonderVerzug));
      sonderAntworten++;
      return antwort([{ stueck_id: 'erfinder-titel' }, { stueck_id: 'erfinder-figuren-blaupause' }]);
    }
    return antwort([]);
  });
  await kontext.addInitScript((s) => {
    localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ klang: false, bewegung: 'aus', liveBewertung: false, tiefe: 8, figuren: 'blaupause' }));
    // der Bot haelt an (Flo spielt Weiss und ist am Zug): die Stellung bleibt fuer den Vergleich stehen
    window.__test = { ...window.__test, botAnhalten: true, maxWarten: 0 };
    localStorage.setItem('schach-arena:konto:sichtbar', '1');
    localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(s));
  }, sitzung);
  const seite = await kontext.newPage(); seite.setDefaultTimeout(15000);
  seite.on('pageerror', e => fehler.push(e.message));
  const bilder = () => seite.evaluate((sel) => {
    const b = [...document.querySelectorAll(sel + ' img.figur')].map(i => i.getAttribute('src'));
    return { n: b.length, blau: b.filter(s => /\/blaupause\//.test(s)).length, fen: window.__partie?.chess().fen(), pfad: window.__partie?.brett.figurenPfad };
  }, BRETT);

  // 1) Wie auf einem frischen Geraet: der gemerkte Erfinder-Status fehlt, die Partie steht, bevor der Server antwortet
  sonderVerzug = 1500;
  await seite.goto(`http://127.0.0.1:${PORT}/?test&kern`);
  await seite.waitForFunction(() => window.__app && typeof window.__app.gehe === 'function' && document.querySelector('.screen.heim-screen'));
  await seite.evaluate(() => { localStorage.removeItem('schach-arena:konto:sonderstuecke'); window.__app.gehe('partie', { botId: 'benno', farbe: 'w' }); });
  await seite.waitForFunction((sel) => document.querySelectorAll(sel + ' img.figur').length === 32 && window.__partie, BRETT);
  const vorher = await bilder();
  const brettVorher = await seite.evaluateHandle(() => window.__partie.brett);
  pruefe('Vorbedingung: die Partie steht, bevor der Erfinder-Status kommt (Standardfiguren)', sonderAntworten === 0 && vorher.n === 32 && vorher.blau === 0, { sonderAntworten, ...vorher });
  await seite.waitForFunction(() => /erfinder-titel/.test(localStorage.getItem('schach-arena:konto:sonderstuecke') || ''), null, { timeout: 8000 }).catch(() => {});
  await seite.waitForFunction((sel) => [...document.querySelectorAll(sel + ' img.figur')].every(i => /\/blaupause\//.test(i.getAttribute('src'))), BRETT, { timeout: 4000 }).catch(() => {});
  const spaet = await bilder();
  pruefe('Erfinder-Status kommt spaet: das laufende Bot-Brett zeigt danach den eigenen Satz Blaupause', sonderAntworten > 0 && spaet.n === 32 && spaet.blau === 32, { sonderAntworten, ...spaet });
  pruefe('Dabei bleibt die Stellung und dasselbe Brett (Pakete halten buehne.brett)', spaet.fen === vorher.fen
    && await seite.evaluate((b) => window.__partie.brett === b, brettVorher), { vorher: vorher.fen, nachher: spaet.fen });

  // 2) Wechsel in den Einstellungen waehrend der Partie (wirkt sofort, ohne Neuladen) und wieder zurueck
  await seite.evaluate(() => window.__app.setzeEinstellungen({ figuren: 'cburnett' }));
  await seite.waitForTimeout(100);
  const standard = await bilder();
  pruefe('Wechsel auf Standard waehrend der Partie: alle Figuren im Standardsatz', standard.n === 32 && standard.blau === 0 && !/blaupause/.test(standard.pfad), standard);
  await seite.evaluate(() => window.__app.setzeEinstellungen({ figuren: 'blaupause' }));
  await seite.waitForTimeout(100);
  const zurueck = await bilder();
  pruefe('Und zurueck auf Blaupause: alle Figuren wieder im eigenen Satz, Stellung unveraendert', zurueck.n === 32 && zurueck.blau === 32 && zurueck.fen === vorher.fen, zurueck);
  // neue Figurenbilder (z. B. eine Umwandlung) nehmen den neuen Pfad: das Brett merkt ihn selbst
  pruefe('Das Brett merkt sich den neuen Pfad (neue Figuren kommen im neuen Satz)', /\/blaupause\/$/.test(zurueck.pfad), zurueck.pfad);
  // Ansehen-Brett (Zug in der Zugliste) bekommt beim Oeffnen ohnehin den aktuellen Satz; hier nur: kein Fehler
  pruefe('Keine Seitenfehler', fehler.length === 0, fehler);
} catch (e) {
  console.error(e); gesamt++;
} finally {
  await browser?.close();
  server.close();
}
console.log(`\n${ok}/${gesamt} Pruefungen bestanden`);
process.exit(ok === gesamt ? 0 : 1);
