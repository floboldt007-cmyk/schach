// "Zu zweit" (js/ui/zuzweit.js, Startblatt und Brett) und die Meisterschule-Lektion (js/ui/lektion.js) zeigen den eigenen
// Figurensatz auch dann, wenn er sich waehrend der Ansicht aendert: der Erfinder-Status kommt spaet vom Server (js/app.js
// pruefeSonderstuecke wendet die Einstellungen dann neu an) oder der Spieler waehlt einen anderen Satz. Vorher blieb bis zum
// Neuladen der alte Satz stehen (R4, 12.11.2026; dieselbe Luecke wie in der Bot-Partie, tests/partie-figurensatz.test.mjs).
// Netzwerk ausschliesslich simuliert: kein Test schreibt ins echte Supabase-Projekt.
//   PORT=9632 node tests/zuzweit-lektion-figurensatz.test.mjs   eigener Port (Standard 8936)
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
const PORT = Number(process.env.PORT || 8936);
await new Promise(r => server.listen(PORT, '127.0.0.1', r));
const sitzung = { access_token: 'a.' + Buffer.from(JSON.stringify({ sub: 'u1' })).toString('base64url') + '.x', refresh_token: 'test-r', expires_at: 9999999999, user: { id: 'u1', email: 'spieler@example.invalid' } };
let browser, ok = 0, gesamt = 0, sonderVerzug = 0, sonderAntworten = 0;
const fehler = [];
function pruefe(name, gut, detail = '') { gesamt++; if (gut) ok++; console.log(`${gut ? 'OK' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(detail)}`); }
const KOENIGE = '.zz-startblatt .zz-paar';
const ZZ = '.zz-screen .zz-brett';
const LS = '.ls-screen .ls-brett';
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
    if (sessionStorage.getItem('figurensatz-start')) return;
    sessionStorage.setItem('figurensatz-start', '1');
    localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ klang: false, bewegung: 'aus', liveBewertung: false, tiefe: 8, figuren: 'blaupause' }));
    localStorage.setItem('schach-arena:konto:sichtbar', '1');
    localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(s));
  }, sitzung);
  const seite = await kontext.newPage(); seite.setDefaultTimeout(15000);
  seite.on('pageerror', e => fehler.push(e.message));
  const bilder = (sel) => seite.evaluate((sel) => {
    const b = [...document.querySelectorAll(sel + ' img')].map(i => i.getAttribute('src'));
    return { n: b.length, blau: b.filter(s => /\/blaupause\//.test(s)).length };
  }, sel);
  const brettBilder = (sel) => seite.evaluate((sel) => {
    const b = [...document.querySelectorAll(sel + ' img.figur')].map(i => i.getAttribute('src'));
    return { n: b.length, blau: b.filter(s => /\/blaupause\//.test(s)).length };
  }, sel);
  const alleBlau = (sel) => seite.waitForFunction((sel) => {
    const b = [...document.querySelectorAll(sel + ' img')];
    return b.length > 0 && b.every(i => /\/blaupause\//.test(i.getAttribute('src')));
  }, sel, { timeout: 4000 }).catch(() => {});
  const warteMerker = () => seite.waitForFunction(() => /erfinder-titel/.test(localStorage.getItem('schach-arena:konto:sonderstuecke') || ''), null, { timeout: 8000 }).catch(() => {});
  const wechsel = async (figuren) => { await seite.evaluate((f) => window.__app.setzeEinstellungen({ figuren: f }), figuren); await seite.waitForTimeout(100); };

  // 1) Zu zweit, Startblatt: die beiden Koenige stehen, bevor der Erfinder-Status kommt (frisches Geraet)
  // Einstieg wie tests/zuzweit.test.mjs: die Pakete (Zu zweit, Meisterschule) laden nur ohne ?kern
  sonderVerzug = 3000;
  await seite.goto(`http://127.0.0.1:${PORT}/?test#training`);
  await seite.waitForFunction(() => !!window.__app && !!document.documentElement.dataset.screen);
  await seite.evaluate(() => { localStorage.removeItem('schach-arena:konto:sonderstuecke'); window.__app.gehe('heim'); });
  await seite.locator('[data-aktion="heim-zuzweit"]').click();
  await seite.waitForSelector(KOENIGE + ' img');
  const kVorher = await bilder(KOENIGE);
  pruefe('Vorbedingung Zu zweit: das Startblatt steht vor dem Erfinder-Status (Standardkoenige)', sonderAntworten === 0 && kVorher.n === 2 && kVorher.blau === 0, { sonderAntworten, ...kVorher });
  await warteMerker(); await alleBlau(KOENIGE);
  const kSpaet = await bilder(KOENIGE);
  pruefe('Zu zweit Startblatt: der spaete Erfinder-Status zeigt die Koenige im eigenen Satz', sonderAntworten > 0 && kSpaet.n === 2 && kSpaet.blau === 2, { sonderAntworten, ...kSpaet });
  await wechsel('cburnett');
  const kStandard = await bilder(KOENIGE);
  pruefe('Zu zweit Startblatt: Wechsel auf Standard wirkt sofort', kStandard.n === 2 && kStandard.blau === 0, kStandard);
  await wechsel('blaupause');

  // 2) Zu zweit, Brett: Wechsel in den Einstellungen waehrend der Partie, dasselbe Brett und dieselbe Stellung
  await seite.locator('.zz-los').click();
  await seite.waitForFunction((sel) => window.__partie?.z?.modus === 'zuzweit' && document.querySelectorAll(sel + ' img.figur').length === 32, ZZ);
  const zzBrett = await seite.evaluateHandle(() => window.__partie.brett);
  const zzFen = await seite.evaluate(() => window.__partie.chess().fen());
  await wechsel('cburnett');
  const zzStandard = await brettBilder(ZZ);
  pruefe('Zu zweit Brett: Wechsel auf Standard waehrend der Partie, alle Figuren im Standardsatz', zzStandard.n === 32 && zzStandard.blau === 0, zzStandard);
  await wechsel('blaupause');
  const zzZurueck = await brettBilder(ZZ);
  const zzRest = await seite.evaluate((b) => ({ gleich: window.__partie.brett === b, fen: window.__partie.chess().fen(), pfad: window.__partie.brett.figurenPfad }), zzBrett);
  pruefe('Zu zweit Brett: zurueck auf Blaupause, dasselbe Brett, Stellung unveraendert, neuer Pfad gemerkt',
    zzZurueck.n === 32 && zzZurueck.blau === 32 && zzRest.gleich && zzRest.fen === zzFen && /\/blaupause\/$/.test(zzRest.pfad), { ...zzZurueck, ...zzRest });

  // 3) Meisterschule-Lektion: der Erfinder-Status kommt erst, wenn die Lektion schon steht
  const antwortenVorher = sonderAntworten;
  await seite.evaluate(() => { localStorage.removeItem('schach-arena:konto:sonderstuecke'); window.__app.gehe('lektion', { id: 'grundreihe' }); });
  await seite.waitForFunction((sel) => document.querySelectorAll(sel + ' img.figur').length > 0 && window.__lektion?.zustand().offen, LS);
  const lVorher = await brettBilder(LS);
  const lFen = await seite.evaluate(() => window.__lektion.zustand().fen);
  const lBrettEl = await seite.evaluateHandle((sel) => document.querySelector(sel), LS);
  pruefe('Vorbedingung Lektion: das Brett steht vor dem Erfinder-Status (Standardfiguren)', sonderAntworten === antwortenVorher && lVorher.n > 0 && lVorher.blau === 0, { sonderAntworten, antwortenVorher, ...lVorher });
  await warteMerker(); await alleBlau(LS);
  const lSpaet = await brettBilder(LS);
  pruefe('Lektion: der spaete Erfinder-Status zeigt die Figuren im eigenen Satz', sonderAntworten > antwortenVorher && lSpaet.n === lVorher.n && lSpaet.blau === lSpaet.n, { sonderAntworten, ...lSpaet });
  await wechsel('cburnett');
  const lStandard = await brettBilder(LS);
  pruefe('Lektion: Wechsel auf Standard wirkt sofort', lStandard.n === lVorher.n && lStandard.blau === 0, lStandard);
  await wechsel('blaupause');
  const lZurueck = await brettBilder(LS);
  const lRest = await seite.evaluate((el) => ({ gleich: document.querySelector('.ls-screen .ls-brett') === el, fen: window.__lektion.zustand().fen }), lBrettEl);
  pruefe('Lektion: zurueck auf Blaupause, dasselbe Brett, Stellung unveraendert', lZurueck.n === lVorher.n && lZurueck.blau === lZurueck.n
    && lRest.gleich && lRest.fen === lFen, { ...lZurueck, ...lRest });
  pruefe('Keine Seitenfehler', fehler.length === 0, fehler);
} catch (e) {
  console.error(e); gesamt++;
} finally {
  await browser?.close();
  server.close();
}
console.log(`\n${ok}/${gesamt} Pruefungen bestanden`);
process.exit(ok === gesamt ? 0 : 1);
