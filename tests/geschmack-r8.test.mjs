// Feinschliff R8 (13.11.2026), Geschmacksfragen nach Empfehlung gebaut (Auswahlseite LG2 und LG4, Flo kann umwaehlen):
// LG2 A: auf kurzen Handys (bis 720 px Hoehe) steht der Serien-Chip der Startseite neben dem Gruss statt in einer eigenen
// Zeile unter dem Kopf; LG4 A: ein Erfolgs-Fenster (Freischalt-Moment) legt sich nie ueber ein offenes Blatt, es wartet,
// bis das Blatt zu ist.
//   node tests/geschmack-r8.test.mjs
//   PORT=8956 node tests/geschmack-r8.test.mjs
import http from 'node:http';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { browserTyp } from './browser.mjs';
import { tagSchluessel, addiereTage } from '../js/tag.js';

const require = createRequire(import.meta.url);
let pw;
for (const p of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
  try { pw = require(p); break; } catch (e) { /* naechster */ }
}
if (!pw) throw new Error('Playwright fehlt (PLAYWRIGHT_PFAD setzen)');
const root = fileURLToPath(new URL('../', import.meta.url));
const typen = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const p = path.resolve(root, '.' + new URL(req.url, 'http://test').pathname.replace(/\/$/, '/index.html'));
  if (!p.startsWith(root)) { res.writeHead(403); res.end(); return; }
  try { const inhalt = readFileSync(p); res.writeHead(200, { 'Content-Type': typen[path.extname(p)] || 'application/octet-stream' }); res.end(inhalt); }
  catch (e) { res.writeHead(404); res.end(); }
});
const PORT = Number(process.env.PORT || 8956);
await new Promise(r => server.listen(PORT, '127.0.0.1', r));

let ok = 0, gesamt = 0;
function pruefe(name, gut, detail = '') {
  gesamt++; if (gut) ok++;
  console.log(`${gut ? 'OK' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(detail)}`);
}

const P = 'schach-arena:v1:';
const heute = tagSchluessel(new Date());
const serie = (n) => ({ stand: 1, tage: Array.from({ length: n }, (_, i) => addiereTage(heute, i - n + 1)), letzter: heute, aktuell: n, gesamt: n, best: n });

async function seite(browser, { w, h, speicher = {}, hash = '#heim' }) {
  const k = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: w < 600, serviceWorkers: 'block', locale: 'de-DE' });
  await k.route('**/*.supabase.co/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await k.addInitScript(({ speicher }) => {
    if (sessionStorage.getItem('probe')) return;
    sessionStorage.setItem('probe', '1');
    localStorage.clear();
    localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ klang: false, bewegung: 'aus' }));
    for (const [s, v] of Object.entries(speicher)) localStorage.setItem(s, JSON.stringify(v));
  }, { speicher });
  const s = await k.newPage(); s.setDefaultTimeout(15000);
  const fehler = [];
  s.on('pageerror', e => fehler.push(e.message));
  await s.goto(`http://127.0.0.1:${PORT}/index.html?test${hash}`);
  const screen = hash.slice(1);
  await s.waitForFunction((n) => document.documentElement.dataset.screen === n && !!document.querySelector('#app > .screen:not(.lade-screen)'), screen);
  return { k, s, fehler };
}
const gesehen = { [P + 'modul:start']: { gesehen: heute } };

let browser;
try {
  browser = await browserTyp(pw).launch({ headless: true });

  // ---------- LG2: Serien-Chip neben dem Gruss auf kurzen Handys ----------
  for (const [w, h, kurz] of [[375, 667, true], [390, 664, true], [320, 568, true], [390, 844, false], [1280, 720, false]]) {
    const { k, s, fehler } = await seite(browser, { w, h, speicher: { ...gesehen, [P + 'modul:serie']: serie(1) } });
    await new Promise(r => setTimeout(r, 400));
    const m = await s.evaluate(() => {
      const sicht = (e) => !!e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().height > 0;
      const r = (e) => { const b = e.getBoundingClientRect(); return { t: Math.round(b.top), b: Math.round(b.bottom), l: Math.round(b.left), r: Math.round(b.right) }; };
      const chips = [...document.querySelectorAll('.heim-screen .heim-serie')].filter(sicht);
      const kopf = document.querySelector('.heim-screen .haupt-kopf');
      const gruss = document.querySelector('.heim-gruss');
      const leiste = document.querySelector('.reiter-leiste');
      const zeile = document.querySelector('.heim-liste > .heim-zeile');
      return { anzahl: chips.length, text: chips.map((c) => c.textContent.trim()), imGruss: chips.length === 1 && gruss.contains(chips[0]),
        imKopf: chips.length === 1 && kopf.contains(chips[0]), kopf: r(kopf), gruss: r(gruss), chip: chips[0] ? r(chips[0]) : null,
        zeileUnten: zeile && sicht(zeile) ? Math.round(zeile.getBoundingClientRect().bottom) : null,
        leisteOben: leiste && sicht(leiste) ? Math.round(leiste.getBoundingClientRect().top) : innerHeight, iw: innerWidth };
    });
    const name = `LG2 ${w}x${h}`;
    pruefe(`${name}: genau ein Serien-Chip sichtbar, "1 Tag"`, m.anzahl === 1 && m.text[0] === '1 Tag', m);
    if (kurz) {
      pruefe(`${name}: Chip steht im Gruss, nicht in einer eigenen Kopfzeile`, m.imGruss && m.kopf.b - m.kopf.t <= 60, m);
      pruefe(`${name}: Chip ganz im Bild, rechts im Gruss`, m.chip && m.chip.r <= m.iw - 8 && m.chip.l >= m.gruss.l && m.chip.t >= m.gruss.t - 1 && m.chip.b <= m.gruss.b + 1, m);
      pruefe(`${name}: erste Zeile unter "Als Naechstes" ganz ueber der Leiste`, m.zeileUnten != null && m.zeileUnten <= m.leisteOben + 0.5, m);
    } else {
      pruefe(`${name}: Chip bleibt im Kopf (unveraendert)`, m.imKopf, m);
    }
    pruefe(`${name}: keine Seitenfehler`, fehler.length === 0, fehler);
    await k.close();
  }

  // ---------- LG4: Erfolgs-Fenster nicht ueber einem offenen Blatt ----------
  for (const [w, h] of [[390, 844], [1280, 720]]) {
    const { k, s, fehler } = await seite(browser, { w, h, speicher: gesehen, hash: '#ich' });
    const name = `LG4 ${w}x${h}`;
    // ein Blatt aus dem gemeinsamen Baustein oeffnen (wie das Shop-Blatt), dann trifft ein Erfolg ein
    await s.evaluate(async () => {
      const { sheet } = await import('/js/ui/bauteile.js');
      window.__blatt = sheet({ titel: 'Probe-Blatt', text: 'offen', knoepfe: [{ text: 'Zu', wert: true, art: 'primaer' }] });
      await new Promise(r => setTimeout(r, 300));
      const m = await import('/js/pakete/sammlung/moment.js');
      m.zeigeStufen([{ familie: 'liga', stufe: 1, taler: 20 }]);
    });
    await new Promise(r => setTimeout(r, 900));
    const waehrend = await s.evaluate(() => ({ moment: !!document.querySelector('.st-moment'), blatt: !!document.querySelector('.sheet-ort:not(.weg) .sheet-karte') }));
    pruefe(`${name}: Blatt offen, kein Erfolgs-Fenster darueber`, waehrend.blatt && !waehrend.moment, waehrend);
    // ein Bildschirmwechsel-Ereignis bei offenem Blatt holt das Fenster auch nicht hervor
    await s.evaluate(async () => { const { sende } = await import('/js/ereignisse.js'); sende('app:screen', { name: 'ich' }); });
    await new Promise(r => setTimeout(r, 900));
    pruefe(`${name}: auch nach einem Bildschirmwechsel nicht ueber dem Blatt`, !(await s.evaluate(() => !!document.querySelector('.st-moment'))));
    // Blatt schliessen: jetzt kommt das Fenster, genau eines, und das Blatt ist weg
    await s.locator('.sheet-knoepfe button').first().click();
    const kam = await s.waitForFunction(() => !!document.querySelector('.st-moment'), null, { timeout: 4000 }).then(() => true, () => false);
    const danach = await s.evaluate(() => ({ momente: document.querySelectorAll('.st-moment').length, blatt: !!document.querySelector('.sheet-ort') }));
    pruefe(`${name}: nach dem Schliessen erscheint das Erfolgs-Fenster (genau eines, kein Blatt mehr)`, kam && danach.momente === 1 && !danach.blatt, danach);
    // ohne Blatt erscheint ein Erfolg wie bisher sofort
    await s.locator('.st-moment .st-weiter').click();
    await s.evaluate(async () => { const m = await import('/js/pakete/sammlung/moment.js'); m.zeigeStufen([{ familie: 'liga', stufe: 2, taler: 40 }]); });
    pruefe(`${name}: ohne Blatt erscheint ein Erfolg sofort`, await s.waitForFunction(() => !!document.querySelector('.st-moment'), null, { timeout: 2000 }).then(() => true, () => false));
    pruefe(`${name}: keine Seitenfehler`, fehler.length === 0, fehler);
    await k.close();
  }
} catch (e) { pruefe('Ablauf ohne Abbruch', false, e.stack); }
finally { await browser?.close(); await new Promise(r => server.close(r)); }
console.log(`\n${ok}/${gesamt} bestanden`);
process.exitCode = ok === gesamt ? 0 : 1;
