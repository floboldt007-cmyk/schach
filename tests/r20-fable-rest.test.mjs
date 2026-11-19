// fable-check 19.11.2026 (R20-Kritik/fable-check-1119/bericht.md), Befunde 10, 11, 14 und 15:
//   10  Analyse am Handy: der Bewertungsbalken liegt waagrecht, die Zahl darin stand noch senkrecht (writing-mode und
//       Drehung aus der PC-Fassung).
//   11  Partie hell: der Weiss-Anteil des Balkens ueber dem Brett (#fff) verschwand im hellen Grund, der Rand hatte 14 %
//       Deckkraft; sichtbar blieb nur der dunkle Teil als duenner Strich. Der Rand braucht mindestens 3:1 gegen den Grund
//       (WCAG 1.4.11). Dunkel ist der Weiss-Anteil hell genug und bleibt unveraendert.
//   14  Englisch: die gespeicherten Standardnamen einer Zu-zweit-Partie ("Weiß", "Schwarz") standen deutsch auf der
//       Startkarte, im Verlauf und in der Analyse. Eigene Namen bleiben, wie sie sind.
//   15  Rechtsseiten: einzeln stehende Links ("English version", Fusszeile, Mail im Impressum) waren 18 bis 22 px hoch;
//       sie brauchen 44 px. Links mitten im Satz bleiben Text (WCAG 2.5.8, Ausnahme fuer Links im Fliesstext).
//
//   node tests/r20-fable-rest.test.mjs
//   PORT=9792 node tests/r20-fable-rest.test.mjs    Port des Testservers (sonst: frei)
//
// Playwright: PLAYWRIGHT_PFAD, sonst 'playwright', sonst /opt/node-tools/node_modules/playwright.
import http from 'node:http';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..') + path.sep;
let pw = null;
for (const k of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
  try { pw = require(k); break; } catch (e) { /* naechster */ }
}
if (!pw) throw new Error('Playwright fehlt (PLAYWRIGHT_PFAD setzen)');

let gesamt = 0, ok = 0;
function pruefe(name, gut, detail = '') {
  gesamt++; if (gut) ok++;
  const d = typeof detail === 'string' ? detail : JSON.stringify(detail);
  console.log(`${gut ? 'ok    ' : 'FEHLER'} ${name}${!gut && d ? ' ' + d : ''}`);
}

const typen = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  const p = path.resolve(WURZEL, '.' + decodeURIComponent(new URL(req.url, 'http://test').pathname).replace(/\/$/, '/index.html'));
  if (!p.startsWith(WURZEL)) { res.writeHead(403); res.end(); return; }
  try { res.writeHead(200, { 'Content-Type': typen[path.extname(p)] || 'application/octet-stream' }); res.end(readFileSync(p)); }
  catch (e) { res.writeHead(404); res.end(); }
});
const PORT = Number(process.env.PORT) || await (await import('./freier-port.mjs')).freierPort();
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
const HOST = `http://127.0.0.1:${PORT}/`;
const P = 'schach-arena:v1:';
const HEUTE = new Date().toISOString().slice(0, 10);
const ZUZWEIT_PARTIE = { id: 'zz-fable', datum: new Date(Date.now() - 3600e3).toISOString(), botId: null, spielerFarbe: 'w', startFen: null,
  zuege: ['f2f3', 'e7e5', 'g2g4', 'd8h4'], san: ['f3', 'e5', 'g4', 'Qh4#'], ergebnis: 'niederlage', grund: 'matt', hinweise: 0,
  zuruecknahmen: 0, modus: 'zuzweit', zuzweit: { weiss: 'Weiß', schwarz: 'Schwarz', drehen: false } };
const laufend = (extra) => ({ spielerFarbe: 'w', startFen: null, zuege: ['e2e4', 'e7e5'], hinweise: 0, zuruecknahmen: 0, liveKlassen: [],
  gestartet: new Date().toISOString(), extra: {}, ...extra });

const browser = await pw.chromium.launch();
const fehler = [];
async function seite({ w = 390, h = 844, schema = 'light', speicher = {} } = {}) {
  const k = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: schema, hasTouch: w < 900 });
  await k.route('**/*', (r) => (new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort()));
  await k.addInitScript((sp) => {
    if (sessionStorage.getItem('vorbelegt')) return; sessionStorage.setItem('vorbelegt', '1');
    for (const [s, w] of Object.entries(sp)) localStorage.setItem(s, typeof w === 'string' ? w : JSON.stringify(w));
  }, { [P + 'modul:start']: { gesehen: HEUTE }, [P + 'hinweis-installieren']: '1', ...speicher });
  const s = await k.newPage();
  s.on('pageerror', (e) => fehler.push(e.message));
  return { k, s };
}
// Kontrast nach WCAG; Farben als "rgb(a)(...)", eine halbdurchsichtige ueber den Grund gelegt
const rgb = (c) => (c.match(/[\d.]+/g) || []).map(Number);
const ueber = (oben, grund) => { const [r, g, b, a = 1] = rgb(oben); const [R, G, B] = rgb(grund); return [r * a + R * (1 - a), g * a + G * (1 - a), b * a + B * (1 - a)]; };
const lum = ([r, g, b]) => [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; })
  .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
const kontrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

// ---------- 14: Standardnamen in der Sprache der App ----------
for (const [sprache, erwartet] of [['en', 'White vs Black'], ['de', 'Weiß gegen Schwarz']]) {
  const { k, s } = await seite({ speicher: { [P + 'einstellungen']: { sprache }, [P + 'laufend']: laufend({ modus: 'zuzweit', botId: null,
    zuzweit: { weiss: 'Weiß', schwarz: 'Schwarz', drehen: false } }) } });
  await s.goto(HOST + '?test#heim');
  await s.waitForSelector('.heim-ueber', { timeout: 15000 }).catch(() => {});
  const text = (await s.locator('.heim-ueber').textContent().catch(() => '')).trim();
  pruefe(`14 Startkarte (${sprache}): Standardnamen uebersetzt, "${erwartet}"`, text.startsWith(erwartet), text);
  await k.close();
}
{
  const { k, s } = await seite({ speicher: { [P + 'einstellungen']: { sprache: 'en' }, [P + 'laufend']: laufend({ modus: 'zuzweit', botId: null,
    zuzweit: { weiss: 'Anna', schwarz: 'Ben', drehen: false } }) } });
  await s.goto(HOST + '?test#heim');
  await s.waitForSelector('.heim-ueber', { timeout: 15000 }).catch(() => {});
  const text = (await s.locator('.heim-ueber').textContent().catch(() => '')).trim();
  pruefe('14 Startkarte (en): eigene Namen bleiben ("Anna vs Ben")', text.startsWith('Anna vs Ben'), text);
  await k.close();
}
for (const screen of ['verlauf', 'analyse']) {
  const { k, s } = await seite({ speicher: { [P + 'einstellungen']: { sprache: 'en' }, [P + 'partien']: [ZUZWEIT_PARTIE] } });
  // die Testseite liest die Sprache nicht aus den Einstellungen (das tut js/app.js): auf Englisch stellen, dann oeffnen
  await s.goto(`${HOST}tests/screens.html?screen=keiner`);
  await s.waitForFunction(() => window.testseiteBereit === true, null, { timeout: 15000 }).catch(() => {});
  await s.evaluate(async (sc) => {
    (await import('/js/sprache.js')).setzeSprache('en');
    testseite.app.gehe(sc, sc === 'analyse' ? { partieId: 'zz-fable' } : {});
  }, screen);
  await s.waitForTimeout(2500);
  const text = await s.evaluate(() => document.querySelector('.screen')?.innerText || '');
  pruefe(`14 ${screen === 'verlauf' ? 'Verlauf' : 'Analyse'} (en): kein deutscher Standardname, "Black" steht da`,
    text.length > 0 && !/Weiß|Schwarz/.test(text) && /Black/.test(text), text.replace(/\s+/g, ' ').slice(0, 300));
  await k.close();
}

// ---------- 9: Heute-Zeile der Startseite ganz lesbar (einzeilig, Kurzform; der ganze Satz steht im Label) ----------
for (const [name, w, h] of [['iPhone SE', 375, 667], ['iPhone 13', 390, 844]]) {
  for (const sprache of ['de', 'en']) {
    const { k, s } = await seite({ w, h, speicher: { [P + 'einstellungen']: { sprache, spracheGewaehlt: true } } });
    await s.goto(HOST + '?test#heim');
    await s.waitForSelector('.heim-zeile[data-paket="serie"] .heim-zeile-text > span', { timeout: 15000 }).catch(() => {});
    const m = await s.evaluate(() => {
      const z = document.querySelector('.heim-zeile[data-paket="serie"]'); const sp = z?.querySelector('.heim-zeile-text > span');
      return sp ? { text: sp.textContent, sw: sp.scrollWidth, cw: sp.clientWidth, label: z.getAttribute('aria-label') }
        : { fehlt: [...document.querySelectorAll('.heim-zeile')].map((e) => e.dataset.paket || e.textContent.trim().slice(0, 30)), ziel: location.hash, intro: !!document.querySelector('.intro, .einstieg') };
    });
    pruefe(`9 Startseite ${name} (${sprache}): Heute-Zeile nicht abgeschnitten, ganzer Satz im Label`,
      !!m && m.sw <= m.cw && /Heute: 1 Partie oder 3 Rätsel spielen|Today: play 1 game or 3 puzzles/.test(m.label), m);
    await k.close();
  }
}

// ---------- 10: Zahl im waagrechten Balken der Analyse liegt waagrecht ----------
for (const [name, w, h] of [['iPhone 13', 390, 844], ['iPhone SE', 375, 667]]) {
  const { k, s } = await seite({ w, h });
  await s.goto(`${HOST}tests/screens.html?screen=keiner`);
  await s.waitForFunction(() => window.testseiteBereit === true, null, { timeout: 15000 });
  const id = await s.evaluate(async () => { testseite.leere(); return (await testseite.opernpartie({ mitReview: true, tiefe: 10 })).id; });
  await s.goto(`${HOST}tests/screens.html?screen=analyse&partieId=${id}&ply=12`);
  await s.waitForFunction(() => window.testseiteBereit === true, null, { timeout: 15000 });
  await s.waitForSelector('.an-eb-wert', { timeout: 15000 }).catch(() => {});
  await s.waitForTimeout(800);
  const m = await s.evaluate(() => {
    const b = document.querySelector('.an-evalbalken')?.getBoundingClientRect();
    const z = document.querySelector('.an-eb-wert'); if (!b || !z) return null;
    const cs = getComputedStyle(z); const r = z.getBoundingClientRect();
    return { balkenWaagrecht: b.width > b.height, wm: cs.writingMode, transform: cs.transform, zahlB: Math.round(r.width), zahlH: Math.round(r.height), text: z.textContent };
  });
  pruefe(`10 Analyse ${name}: Balken waagrecht, Zahl darin waagrecht (nicht gedreht)`,
    !!m && m.balkenWaagrecht && m.wm === 'horizontal-tb' && (m.transform === 'none' || m.transform === '') && (!m.text || m.zahlB >= m.zahlH), m);
  await k.close();
}

// ---------- 11: Balken ueber dem Brett, hell: Rand mindestens 3:1 gegen den Grund ----------
for (const schema of ['light', 'dark']) {
  const { k, s } = await seite({ schema, speicher: { [P + 'laufend']: laufend({ botId: 'fridolin', modus: 'normal' }) } });
  await s.goto(HOST + '?test#heim');
  await s.locator('[data-aktion="heim-weiter"]').click({ timeout: 15000 }).catch(() => {});
  await s.waitForSelector('.partie .evalbalken', { timeout: 15000 }).catch(() => {});
  await s.waitForTimeout(1500);
  const m = await s.evaluate(() => {
    const b = document.querySelector('.partie .evalbalken'); if (!b) return null;
    let grund = null; for (let e = b.parentElement; e; e = e.parentElement) { const c = getComputedStyle(e).backgroundColor; if (c && c !== 'rgba(0, 0, 0, 0)') { grund = c; break; } }
    const schatten = getComputedStyle(b).boxShadow; const rand = (schatten.match(/rgba?\([^)]*\)/) || [''])[0];
    return { grund, rand, weiss: getComputedStyle(b.querySelector('.weiss')).backgroundColor, hoehe: b.getBoundingClientRect().height };
  });
  const k1 = m && m.rand ? kontrast(ueber(m.rand, m.grund), rgb(m.grund)) : 0;
  const k2 = m ? kontrast(rgb(m.weiss), rgb(m.grund)) : 0;
  pruefe(`11 Partie iPhone 13 ${schema === 'light' ? 'hell' : 'dunkel'}: Weiss-Anteil sichtbar (Fuellung oder Rand >= 3:1 gegen den Grund)`,
    !!m && Math.max(k1, k2) >= 3, { ...m, randKontrast: Math.round(k1 * 100) / 100, weissKontrast: Math.round(k2 * 100) / 100 });
  await k.close();
}

// ---------- 15: einzeln stehende Links der Rechtsseiten mindestens 44 px hoch ----------
for (const datei of ['impressum', 'impressum-en', 'datenschutz', 'datenschutz-en', 'konto-loeschen', 'konto-loeschen-en']) {
  for (const w of [375, 1440]) {
    const { k, s } = await seite({ w, h: 800 });
    await s.goto(`${HOST}${datei}.html`);
    const zuKlein = await s.evaluate(() => [...document.querySelectorAll('.stand a, .fuss a, dd > a, a.kl-mail')].map((a) => {
      const r = a.getBoundingClientRect(); return { t: a.textContent.trim().slice(0, 30), h: Math.round(r.height) };
    }).filter((x) => x.h < 44));
    const anzahl = await s.evaluate(() => document.querySelectorAll('.stand a, .fuss a').length);
    pruefe(`15 ${datei}.html ${w} px: einzelne Links mindestens 44 px hoch`, anzahl >= 2 && zuKlein.length === 0, { anzahl, zuKlein });
    await k.close();
  }
}

pruefe('keine Seitenfehler', fehler.length === 0, fehler);
await browser.close(); server.close();
console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
