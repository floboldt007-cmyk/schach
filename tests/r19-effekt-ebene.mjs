// Feinschliff R19 (Effekt-Ebene): mit einem Motiv-Brett (js/brett-motive-v4.js, Rahmen-Band) deckt sich die Effekt-Ebene
// der Partie (.brett-effekte, css/app.css) mit dem Brett, hoechstens 0,5 px je Kante, und ist nie groesser als das Brett.
// Befund R19: das Band stand als padding in % (bezieht sich auf die Breite der Brettzone), die Ebene als inset in %
// (bezieht sich auf Breite und Hoehe des Sockels); Zone und Sockel sind verschieden breit, die Ebene lag ein paar px
// daneben und war bei 1180x820 breiter als das Brett.
// Je Geraet (iPhone 13, SE, iPad hoch/quer, PC) und Koordinaten-Lage (ecke, rand) alle 20 Motive in der Bot-Partie, dazu
// kein waagrechter Ueberlauf der Seite.
// Ausgenommen: iPad hoch mit Koordinaten am Rand. Dort ragt das Brett schon ohne Motiv 4 px ueber den Sockel (js/ui/partie.js
// layout() rechnet --brett mit dem Polster ohne den Rand-Streifen), das behebt so/R19-rand-handy (Fenster 4e). Ebenso iPhone SE
// mit Koordinaten am Rand: nach einem Brettwechsel waehrend der Partie stehen --brett und die Sockelbreite um 8 px
// auseinander (352 gegen 360), gemessen auch ohne Motiv (nacht/gruen/holz), also js/ui/partie.js layout(), ebenfalls 4e.
// Beide Faelle werden nur ausgegeben.
// Aufruf: node tests/r19-effekt-ebene.mjs   (Playwright ueber PLAYWRIGHT_PFAD oder node_modules)
import http from 'node:http';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { browserTyp } from './browser.mjs';

let ok = 0, gesamt = 0;
function pruefe(name, gut, detail = '') {
  gesamt++; if (gut) ok++;
  console.log(`${gut ? 'OK' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(detail)}`);
  return gut;
}
const { MOTIV_BRETTER = [] } = await import('../js/labor.js');
const MOTIVE = MOTIV_BRETTER.map((b) => b.id);
pruefe('Katalog: 20 Motiv-Bretter', MOTIVE.length === 20, MOTIVE);

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

// Erfinder-Konto (nur es sieht die Motiv-Bretter, js/labor.js laborFrei), wie tests/bretter-v4-app.test.mjs
const UID = 'u1';
const sitzung = { access_token: 'a.' + Buffer.from(JSON.stringify({ sub: UID })).toString('base64url') + '.x', refresh_token: 'test-r', expires_at: 9999999999, user: { id: UID, email: 'spieler@example.invalid' } };
const bediene = async (route) => {
  const url = new URL(route.request().url());
  const antwort = d => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
  if (url.pathname.startsWith('/auth/v1/')) return antwort({ id: UID, email: 'spieler@example.invalid' });
  if (url.pathname === '/rest/v1/sonderstuecke') return antwort([{ stueck_id: 'erfinder-titel' }]);
  if (url.pathname === '/rest/v1/altersangaben') return antwort([{ ab18: true }]);
  if (url.pathname === '/rest/v1/profile') return antwort([{ user_id: UID, benutzername: 'Spieler_1' }]);
  return antwort([]);
};
const GERAETE = [['iPhone 13', 390, 844, true], ['iPhone SE', 375, 667, true], ['iPad hoch', 820, 1180, true], ['iPad quer', 1180, 820, true], ['PC', 1280, 800, false]];
const BOT = '.screen.partie .brett-rahmen > .brett';
const TOL = 0.5;

// Rechtecke von Brett und Ebene; Abweichung je Kante (positiv = Ebene ragt ueber das Brett hinaus)
const miss = (s) => s.evaluate((sel) => {
  const b = document.querySelector(sel), r = b?.closest('.brett-rahmen'), e = r?.querySelector(':scope > .brett-effekte');
  if (!b || !e) return null;
  const bb = b.getBoundingClientRect(), eb = e.getBoundingClientRect();
  return { motiv: document.documentElement.dataset.brett, rahmenBild: getComputedStyle(r).backgroundImage.includes('data:image/svg'),
    rand: b.classList.contains('koord-rand'),
    ab: [bb.top - eb.top, eb.right - bb.right, eb.bottom - bb.bottom, bb.left - eb.left].map((x) => +x.toFixed(2)),
    brettB: +bb.width.toFixed(2), ebeneB: +eb.width.toFixed(2), seiteBreit: document.documentElement.scrollWidth > innerWidth };
}, BOT);

let browser;
try {
  browser = await browserTyp(pw).launch({ headless: true });
  for (const [name, w, h, mobil] of GERAETE) {
    for (const lage of ['ecke', 'rand']) {
      const k = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: mobil, isMobile: mobil, serviceWorkers: 'block', locale: 'de-DE', timezoneId: 'Europe/Berlin' });
      await k.route('**/*.supabase.co/**', bediene);
      await k.addInitScript(({ s, uid, brett, lage }) => {
        if (!sessionStorage.getItem('probe-start')) {
          sessionStorage.setItem('probe-start', '1');
          localStorage.clear();
          localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ sprache: 'de', spracheGewaehlt: true, klang: false, bewegung: 'aus', liveBewertung: false, duellIntro: 'aus', koordLage: lage, brett }));
          localStorage.setItem('schach-arena:konto:sichtbar', '1');
          localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(s));
          localStorage.setItem('schach-arena:konto:sonderstuecke', JSON.stringify({ konto: uid, ids: ['erfinder-titel'] }));
        }
        window.__test = { ...window.__test, botAnhalten: true, maxWarten: 0 };
      }, { s: sitzung, uid: UID, brett: MOTIVE[0], lage });
      const s = await k.newPage(); s.setDefaultTimeout(15000);
      const fehler = []; s.on('pageerror', (e) => fehler.push(e.message));
      const fall = `${name} ${w}x${h} ${lage}`;
      try {
        await s.goto(`http://127.0.0.1:${PORT}/index.html?test#arena`);
        await s.waitForFunction(() => window.__app && typeof window.__app.gehe === 'function' && document.querySelector('.screen.arena'), null, { timeout: 45000 });
        await s.waitForTimeout(300);
        await s.evaluate(() => window.__app.gehe('partie', { botId: 'benno', farbe: 'w' }));
        await s.waitForFunction((sel) => document.querySelectorAll(sel + ' .feld').length === 64, BOT, { timeout: 45000 });
        const schlecht = [], ausgenommen = (name === 'iPad hoch' || name === 'iPhone SE') && lage === 'rand';
        let gemessen = 0, ueberlauf = false, ohneRahmen = 0;
        for (const id of MOTIVE) {
          await s.evaluate((id) => window.__app.setzeEinstellungen({ brett: id }), id);
          await s.waitForFunction(({ sel, id }) => document.documentElement.dataset.brett === id
            && (document.getElementById('brett-motiv')?.textContent || '').includes(`html[data-brett="${id}"]`), { sel: BOT, id }, { timeout: 8000 }).catch(() => {});
          // die Partie misst das Brett nach dem Wechsel neu (js/ui/partie.js layout): messen, bis zwei Messungen im Abstand
          // von 250 ms gleich sind (hoechstens 4 s)
          let m = await miss(s);
          for (let i = 0; i < 16; i++) {
            await s.waitForTimeout(250);
            const n = await miss(s);
            const gleich = JSON.stringify(n) === JSON.stringify(m);
            m = n;
            if (gleich) break;
          }
          if (!m || m.motiv !== id || m.rand !== (lage === 'rand')) { schlecht.push({ id, m }); continue; }
          gemessen++;
          if (!m.rahmenBild) ohneRahmen++;
          if (m.seiteBreit) ueberlauf = true;
          if (m.ab.some((x) => Math.abs(x) > TOL) || m.ebeneB > m.brettB + TOL) schlecht.push({ id, ab: m.ab, brett: m.brettB, ebene: m.ebeneB });
        }
        if (ausgenommen) {
          console.log(`   ausgenommen (js/ui/partie.js layout, so/R19-rand-handy): ${fall} ${JSON.stringify(schlecht.slice(0, 2))}`);
        } else {
          pruefe(`${fall}: Effekt-Ebene deckt sich bei allen 20 Motiven mit dem Brett (<= ${TOL} px, nie breiter)`, gemessen === MOTIVE.length && schlecht.length === 0,
            { gemessen, schlecht: schlecht.slice(0, 4), weitere: Math.max(0, schlecht.length - 4) });
        }
        pruefe(`${fall}: kein waagrechter Ueberlauf der Seite`, !ueberlauf);
        // Handy hochkant zeigt in der Partie keinen Rahmen (Flo 31.10.2026), sonst traegt jeder Sockel das Rahmenbild
        const handyHoch = mobil && w <= 600 && h > w;
        pruefe(`${fall}: Rahmen ${handyHoch ? 'aus (Handy hochkant)' : 'an'}`, gemessen > 0 && ohneRahmen === (handyHoch ? gemessen : 0), { gemessen, ohneRahmen });
        pruefe(`${fall}: keine Seitenfehler`, fehler.length === 0, fehler);
      } catch (e) {
        pruefe(`${fall}: Lauf`, false, e.message.split('\n')[0]);
      }
      await k.close();
    }
  }
} finally {
  if (browser) await browser.close();
  server.close();
}
console.log(`\n${ok}/${gesamt} ok`);
process.exit(ok === gesamt ? 0 : 1);
