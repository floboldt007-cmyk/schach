// R25 Offline-Rueckfall (fc-14:00): ohne Netz direkt nach einem Update. Der neue Service Worker hat dann nur den KERN
// abgelegt (sw.js; der Rest kommt erst in Haeppchen), darum beschneidet die Probe den Cache auf genau den KERN, ohne ZUERST.
// Nachpruefung 2 von 19 (20.11.2026): js/ui/arena.js lag ausserhalb des Kerns, ist aber das Ziel, wenn ein Paket nicht
// laedt. Ohne Netz zeigte darum auch die Arena HOPPLA, "Zur Arena" fuehrte im Kreis, und ein fehlendes Paket lud die Seite
// neu und sprang still weiter. Geprueft je Engine (Chromium und WebKit) auf iPhone 13 und PC:
//   (1) die Arena erscheint mit Bots, kein Platzhalter
//   (2) ein Paket, das nicht im Kern liegt (spielhalle), zeigt "Dieser Teil ist noch nicht geladen. Bitte einmal mit Internet
//       oeffnen.", ohne Neuladen und ohne Sprung (die Adresse bleibt #spielhalle)
//   (3) "Zur Arena" von dort zeigt die Arena (kein Kreis)
//   (4) PC: derselbe Satz auf Englisch
//   (5) keine Seitenfehler
//   node tests/r25-offline-rueckfall.test.mjs           beide Engines (PLAYWRIGHT_PFAD); BROWSER=webkit nur eine
import { createRequire } from 'node:module';
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
import { freierPort } from './freier-port.mjs';

let ok = 0; let fehler = 0;
function pruefe(name, wert, info = '') { // INTENTIONAL-SLOP[T4]: die Konsole ist der Ausgabeweg der Probe (tests/alle.mjs liest sie)
  if (wert) { ok++; console.log('ok   ' + name); } else { fehler++; console.log('FEHLER ' + name + ' ' + (typeof info === 'string' ? info : JSON.stringify(info))); }
}
const require = createRequire(import.meta.url);
let pw = null;
for (const p of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
  try { pw = require(p); break; } catch (e) { /* naechster */ } // INTENTIONAL-SLOP[F1]: Fehlschlag heisst naechster Kandidat
}
if (!pw) { pruefe('Playwright gefunden', false); console.log(`${ok}/${ok + fehler} bestanden`); process.exit(1); } // INTENTIONAL-SLOP[T4]: Ausgabeweg

const root = fileURLToPath(new URL('../', import.meta.url));
// nur der KERN: genau das, was die Installation ablegt (ZUERST kommt erst danach)
const KERN = (() => {
  const k = { self: { location: new URL('https://example.org/schach/sw.js'), addEventListener() {} }, URL };
  vm.createContext(k);
  vm.runInContext(readFileSync(path.join(root, 'sw.js'), 'utf8') + '\n;globalThis.__kern = typeof KERN === "undefined" ? null : KERN;', k);
  return k.__kern;
})();
const PRAEFIX = '/schach/';
const typen = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon' };
const server = http.createServer((req, res) => {
  const pfad = decodeURIComponent(new URL(req.url, 'http://test').pathname);
  if (!pfad.startsWith(PRAEFIX)) { res.writeHead(404); res.end(); return; }
  const p = path.resolve(root, '.' + pfad.slice(PRAEFIX.length - 1).replace(/\/$/, '/index.html'));
  if (!p.startsWith(root)) { res.writeHead(403); res.end(); return; }
  try { const d = readFileSync(p); res.writeHead(200, { 'Content-Type': typen[path.extname(p)] || 'application/octet-stream' }); res.end(d); }
  catch (e) { res.writeHead(404); res.end(); }
});
const PORT = Number(process.env.PORT) || await freierPort();
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
// im Testbetrieb registriert die App den Service Worker nur mit &sw (js/app.js registriereSW)
const START = `http://127.0.0.1:${PORT}${PRAEFIX}index.html?test&sw`;
const HEIM = '.heim-screen .heim-buehne';
const ARENA = '#app > .screen.arena';
const PLATZHALTER = '#app > .screen.platzhalter';
const PAKET = 'spielhalle';
const SATZ = { de: 'Dieser Teil ist noch nicht geladen. Bitte einmal mit Internet öffnen.', en: "This part isn't downloaded yet. Please open it once with internet." };
const klappt = (p) => p.then(() => true, () => false);
const { defaultBrowserType: _typ, ...IPHONE } = pw.devices['iPhone 13'];

async function bisHeim(s, adresse) {
  await s.goto(adresse);
  await s.waitForFunction((sel) => window.__app && document.querySelector(sel) && document.querySelector(sel).getBoundingClientRect().height > 0, HEIM, { timeout: 30000 });
}
// sichtbarer Text des aktuellen Screens (ohne die Reiterleiste)
const screenText = (s) => s.evaluate(() => (document.querySelector('#app > .screen') || document.body).innerText.replace(/\s+/g, ' '));

if (!Array.isArray(KERN)) { pruefe('KERN in sw.js gefunden', false); console.log(`${ok}/${ok + fehler} bestanden`); process.exit(1); } // INTENTIONAL-SLOP[T4]: Ausgabeweg
pruefe(`${PAKET} liegt nicht im Kern (sonst prueft (2) nichts)`, !KERN.includes(`js/ui/${PAKET}.js`));

const ENGINES = process.env.BROWSER ? [process.env.BROWSER] : ['chromium', 'webkit'];
try {
  for (const engine of ENGINES) {
    const browser = await pw[engine].launch({ headless: true });
    try {
      // WebKit kennt isMobile nicht als Geraet-Schalter, die Groesse und der Touch reichen fuer die Ansicht
      const GERAETE = [
        { name: 'iphone13', opt: engine === 'webkit' ? { ...IPHONE, isMobile: false } : IPHONE },
        { name: 'pc1280', opt: { viewport: { width: 1280, height: 800 } }, englisch: true },
      ];
      for (const g of GERAETE) {
        const tag = `${engine} ${g.name}`;
        const k = await browser.newContext({ ...g.opt, locale: 'de-DE' });
        let offline = false;
        await k.route('**/*.supabase.co/**', (r) => (offline ? r.abort('internetdisconnected') : r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })));
        await k.addInitScript(() => {
          try {
            if (!localStorage.getItem('schach-arena:v1:modul:start')) localStorage.setItem('schach-arena:v1:modul:start', JSON.stringify({ v: 1, gesehen: '2026-11-01' }));
            if (!localStorage.getItem('schach-arena:v1:einstellungen')) localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ klang: false }));
            localStorage.setItem('schach-arena:v1:hinweis-installieren', '1');
          } catch (e) { /* egal */ } // INTENTIONAL-SLOP[F1]: Speicher gesperrt heisst Probe ohne Vorbelegung
        });
        const seitenfehler = [];
        const s = await k.newPage(); s.setDefaultTimeout(15000);
        // WebKit meldet eine Anfrage, die der Service Worker ohne Netz und ohne Cache ablehnt (sw.js antworte: throw), als
        // Seitenfehler ohne Stapel: "TypeError: Load failed" und eine zweite Meldung mit der Adresse. Fuer Dateien ausserhalb
        // des Kerns ist das ohne Netz erwartet (das fehlende Paket, Stockfish aus ZUERST); jede andere Meldung zaehlt.
        const erwartet = (e) => offline && !e.stack && (e.message === 'TypeError: Load failed'
          || (/^\/[^ ]+\/schach\/(.+)\.$/.test(e.message) && !KERN.includes(e.message.replace(/^\/[^ ]+\/schach\/(.+)\.$/, '$1'))));
        s.on('pageerror', (e) => { if (!erwartet(e)) seitenfehler.push(`${offline ? 'offline' : 'online'} ${s.url().replace(/^.*#/, '#')}: ${e.message}`); });
        try {
          await bisHeim(s, START);
          // waitForFunction wertet ein Promise als wahr: darum im Fenster selbst warten, bis der Worker steuert und
          // index.html im Cache liegt
          const bereit = await s.evaluate(async () => {
            const ende = Date.now() + 30000;
            while (Date.now() < ende) {
              if (navigator.serviceWorker && navigator.serviceWorker.controller) {
                for (const c of await caches.keys()) if (await (await caches.open(c)).match(location.pathname.replace(/index\.html$/, '') + 'index.html')) return true;
              }
              await new Promise((r) => setTimeout(r, 250));
            }
            return false;
          });
          if (!bereit) throw new Error('kein Service Worker mit Cache, der Offline-Teil waere sinnlos');

          // Netz aus, dann alles ausser dem Kern aus dem Cache: der Stand direkt nach einem Update
          offline = true;
          await k.setOffline(true);
          await s.waitForTimeout(500);
          const entfernt = await s.evaluate(async (kern) => {
            const basis = location.pathname.replace(/index\.html$/, '');
            const behalten = new Set(kern.map((d) => basis + d));
            let n = 0;
            for (const name of await caches.keys()) {
              const c = await caches.open(name);
              for (const r of await c.keys()) if (!behalten.has(new URL(r.url).pathname)) { await c.delete(r); n++; }
            }
            return n;
          }, KERN);
          // direkt nach der Installation liegt meist schon nur der Kern im Cache (entfernt 0); das Nachladen kann aber schneller sein
          pruefe(`${tag}: Cache auf den Kern beschnitten (${KERN.length} Dateien, ${entfernt} entfernt)`, Number.isInteger(entfernt));
          const heim = await klappt(bisHeim(s, START));
          pruefe(`${tag}: ohne Netz startet die App und zeigt Heim`, heim);
          if (!heim) throw new Error('ohne Heim kein Weiter');
          // Marke im Fenster: ein volles Neuladen loescht sie
          await s.evaluate(() => { window.__ohneNeuladen = true; });

          // (1) Arena
          await s.evaluate(() => window.__app.gehe('arena'));
          const arena = await klappt(s.locator(ARENA).waitFor({ state: 'visible', timeout: 10000 }));
          const bots = arena ? await s.locator(`${ARENA} [data-bot], ${ARENA} .bot-karte, ${ARENA} button`).count() : 0;
          pruefe(`${tag}: (1) ohne Netz erscheint die Arena mit Bots, kein Platzhalter`, arena && bots > 3 && !(await s.locator(PLATZHALTER).count()),
            { arena, bots, text: (await screenText(s)).slice(0, 120) });

          // (2) Paket ausserhalb des Kerns
          await s.evaluate((p) => window.__app.gehe(p), PAKET);
          const satz = await klappt(s.waitForFunction((x) => document.querySelector('#app > .screen')?.innerText.includes(x), SATZ.de, { timeout: 10000 }));
          await s.waitForTimeout(1500);
          const lage = await s.evaluate(() => ({ hash: location.hash, marke: window.__ohneNeuladen === true, arena: !!document.querySelector('#app > .screen.arena') }));
          pruefe(`${tag}: (2) fehlendes Paket zeigt "${SATZ.de}"`, satz, (await screenText(s)).slice(0, 160));
          pruefe(`${tag}: (2) kein Neuladen und kein Sprung, die Adresse bleibt #${PAKET}`, lage.marke && lage.hash === '#' + PAKET && !lage.arena, lage);

          // (3) von dort zur Arena: kein Kreis
          const knopf = s.locator('#app > .screen [data-aktion="arena"]');
          if (await knopf.count()) await knopf.first().click();
          else await s.evaluate(() => window.__app.gehe('arena'));
          const zurueck = await klappt(s.locator(ARENA).waitFor({ state: 'visible', timeout: 10000 }));
          pruefe(`${tag}: (3) "Zur Arena" zeigt die Arena (kein Kreis)`, zurueck && !(await s.locator(PLATZHALTER).count()), (await screenText(s)).slice(0, 120));

          // (4) Englisch
          if (g.englisch) {
            await s.evaluate(() => localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ klang: false, sprache: 'en', spracheGewaehlt: true })));
            await bisHeim(s, START).catch(() => {});
            await s.evaluate((p) => window.__app.gehe(p), PAKET).catch(() => {});
            const en = await klappt(s.waitForFunction((x) => document.querySelector('#app > .screen')?.innerText.includes(x), SATZ.en, { timeout: 10000 }));
            pruefe(`${tag}: (4) auf Englisch "${SATZ.en}"`, en, (await screenText(s)).slice(0, 160));
          }
        } catch (e) {
          pruefe(`${tag}: Ablauf ohne Abbruch`, false, e.message.split('\n')[0]);
        }
        pruefe(`${tag}: (5) keine Seitenfehler`, seitenfehler.length === 0, seitenfehler.slice(0, 4));
        await k.close();
      }
    } finally {
      await browser.close();
    }
  }
} finally {
  server.close();
}
console.log(`${ok}/${ok + fehler} bestanden`); // INTENTIONAL-SLOP[T4]: die Konsole ist der Ausgabeweg der Probe (tests/alle.mjs liest sie)
process.exit(fehler ? 1 : 0);
