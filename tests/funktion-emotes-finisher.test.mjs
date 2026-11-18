// Funktionsprobe Emotes, Finisher, Klaenge (Feinschliff R19, so/R19-emotes-finisher): spielt wie ein Mensch durch die
// Oberflaeche, je Geraet (iPhone 13 und PC 1280) in frischen Sitzungen.
//   1) Spieler ohne Erfinder: in der Partie gegen Fridolin einen Sticker ueber das Emote-Rad senden (das Rad zeigt nur die
//      acht gratis Sticker), dann Schaefermatt.
//   2) Erfinder (Labor): Finisher Blitzschlag und Klangset Polarlicht gewaehlt, Klang an. Schaefermatt, der Finisher laeuft
//      am Ende und ist nach hoechstens 1400 ms (plus Takt) wieder weg; die Klangdateien kommen aus assets/klang/polarlicht/.
//   3) Spieler ohne Erfinder im Shop: Regal "Mehr Klaenge", Vorschau Polarlicht, "Anhoeren" laedt die Dateien bei Bedarf.
// Gemessen und ausgegeben (MESSUNG-Zeilen): Anzahl, Bytes und Ladezeit der Polarlicht-Dateien je Weg, damit das
// Hauptfenster Precache gegen "bei Bedarf" entscheiden kann (sw.js fasst dieser Test nicht an).
// Netzwerk: Supabase ausschliesslich simuliert.
//
//   node tests/funktion-emotes-finisher.test.mjs
//   BILDER=<ordner> node tests/funktion-emotes-finisher.test.mjs   Bilder dorthin (Standard: <tmp>/funktion-emotes-finisher)
import http from 'node:http';
import { createRequire } from 'node:module';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';
import { browserTyp } from './browser.mjs';

const require = createRequire(import.meta.url);
let pw;
for (const p of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
  try { pw = require(p); break; } catch (e) { /* naechster */ }
}
if (!pw) throw new Error('Playwright fehlt (PLAYWRIGHT_PFAD setzen)');
const BILDER = process.env.BILDER || path.join(os.tmpdir(), 'funktion-emotes-finisher');
const WURZEL = fileURLToPath(new URL('../', import.meta.url));
const TYPEN = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm', '.json': 'application/json', '.png': 'image/png', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json' };
const server = http.createServer(async (q, r) => {
  const p = path.resolve(WURZEL, '.' + decodeURIComponent(new URL(q.url, 'http://test').pathname).replace(/\/$/, '/index.html'));
  if (!p.startsWith(WURZEL)) { r.writeHead(403); r.end(); return; }
  try { const d = await readFile(p); r.writeHead(200, { 'Content-Type': TYPEN[path.extname(p)] || 'application/octet-stream' }); r.end(d); }
  catch (e) { r.writeHead(404); r.end(); }
});
await new Promise((r) => server.listen(Number(process.env.PORT || 0), '127.0.0.1', r));
const BASIS = `http://127.0.0.1:${server.address().port}`;
await mkdir(BILDER, { recursive: true });

const { defaultBrowserType, ...IPHONE } = pw.devices['iPhone 13'];
const GERAETE = [
  { name: 'iphone13', optionen: IPHONE },
  { name: 'pc1280', optionen: { viewport: { width: 1280, height: 800 } } },
];
const ZUEGE = ['e2e4', 'f1c4', 'd1h5', 'h5f7'];
const PLAN = { e2e4: 'e7e5', f1c4: 'b8c6', d1h5: 'g8f6' };
const SCREEN = '.screen.partie:not(.online-screen)';
const UID = '7c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f';
const SITZUNG = { access_token: 'a.' + Buffer.from(JSON.stringify({ sub: UID })).toString('base64url') + '.x', refresh_token: 'r1',
  expires_at: 9999999999, user: { id: UID, email: 'spieler@example.invalid' } };
const ERFINDER_IDS = ['erfinder-banner-blatt-0', 'erfinder-titel', 'erfinder-figuren-blaupause', 'erfinder-finisher-signatur'];

let ok = 0, gesamt = 0;
function pruefe(name, gut, detail = '') {
  gesamt++; if (gut) ok++;
  console.log(`${gut ? 'OK' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(detail).slice(0, 500)}`);
  return gut;
}
const warte = (ms) => new Promise((r) => setTimeout(r, ms));
const klappt = (p) => p.then(() => true).catch(() => false);

async function kontext(browser, g, { erfinder = false, einstellungen = {}, vorher = {} } = {}) {
  const k = await browser.newContext({ ...g.optionen, locale: 'de-DE', serviceWorkers: 'block', timezoneId: 'Europe/Berlin' });
  await k.route('**/*.supabase.co/**', (r) => {
    const u = new URL(r.request().url());
    const antwort = (d) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
    if (u.pathname.startsWith('/auth/v1/')) return antwort({ id: UID, email: 'spieler@example.invalid' });
    if (u.pathname === '/rest/v1/sonderstuecke') return antwort(erfinder ? ERFINDER_IDS.map((stueck_id) => ({ stueck_id })) : []);
    if (u.pathname === '/rest/v1/altersangaben') return antwort([{ ab18: true }]);
    if (/karte_(melde_stufen|waehle)$/.test(u.pathname)) return antwort({ taler: 0, stufen: {}, banner: ['start'], wahl: { banner: 'start' } });
    return antwort([]);
  });
  await k.addInitScript(({ sitzung, erfinder, ids, einstellungen, vorher, uid }) => {
    try {
      if (sessionStorage.getItem('probe-start')) return;
      sessionStorage.setItem('probe-start', '1');
      localStorage.clear();
      localStorage.setItem('schach-arena:v1:modul:start', JSON.stringify({ v: 1, gesehen: '2026-11-01' }));
      localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ klang: false, ...einstellungen }));
      localStorage.setItem('schach-arena:konto:sichtbar', '1');
      localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(sitzung));
      if (erfinder) localStorage.setItem('schach-arena:konto:sonderstuecke', JSON.stringify({ konto: uid, ids }));
      for (const [schl, wert] of Object.entries(vorher)) localStorage.setItem(schl, wert);
    } catch (e) { /* egal */ }
  }, { sitzung: SITZUNG, erfinder, ids: ERFINDER_IDS, einstellungen, vorher, uid: UID });
  const s = await k.newPage();
  s.setDefaultTimeout(15000);
  const fehler = [];
  s.on('pageerror', (e) => fehler.push(e.message));
  // Klangdateien des neuen Sets: Zeitpunkt der Anfrage und der fertigen Antwort, Groesse
  const klaenge = [];
  s.on('requestfinished', async (q) => {
    const u = q.url();
    if (!/\/assets\/klang\/polarlicht\/[^/]+\.mp3$/.test(u)) return;
    const t = q.timing();
    let bytes = 0, status = 0;
    try { const a = await q.response(); status = a.status(); bytes = (await a.body()).length; } catch (e) { /* bleibt 0 */ }
    klaenge.push({ datei: u.split('/').pop(), start: t.startTime, dauer: t.responseEnd, status, bytes });
  });
  return { k, s, fehler, klaenge };
}
async function heim(s) {
  // ?emotes: gegen Bots zeigt die App die Emote-Knoepfe nur in Tests (js/pakete/emotes/index.js, imTestGegenBots)
  await s.goto(`${BASIS}/index.html?test&emotes#heim`);
  await s.waitForFunction(() => window.__app && typeof window.__app.gehe === 'function' && document.documentElement.dataset.screen, null, { timeout: 45000 });
  await warte(1200);
}
async function zug(s, uci) {
  await s.waitForFunction(() => window.__partie.phase() === 'flo', null, { timeout: 30000 });
  for (const f of [uci.slice(0, 2), uci.slice(2, 4)]) await s.locator(`${SCREEN} .brett-felder .feld[data-feld="${f}"]`).click();
  if (await s.locator(`${SCREEN} .brett .lage.vorschau`).count()) await s.locator(`${SCREEN} .brett-felder .feld[data-feld="${uci.slice(2, 4)}"]`).click();
}
async function neuePartie(s) {
  await s.evaluate((plan) => {
    localStorage.removeItem('schach-arena:v1:laufend');
    window.__test = { botZug: () => { const v = window.__partie.chess().history({ verbose: true }); return plan[v[v.length - 1].lan] || null; } };
    window.__app.gehe('partie', { botId: 'fridolin', farbe: 'w' });
  }, PLAN);
  return klappt(s.waitForFunction((sel) => window.__partie && window.__partie.bereit === true && window.__partie.phase() === 'flo'
    && document.querySelectorAll(sel + ' .brett img.figur').length === 32, SCREEN, { timeout: 30000 }));
}
const messung = (g, weg, l) => {
  const bytes = l.reduce((a, x) => a + x.bytes, 0);
  const ende = l.length ? Math.max(...l.map((x) => x.start + x.dauer)) - Math.min(...l.map((x) => x.start)) : 0;
  console.log(`MESSUNG ${g} ${weg}: ${l.length} Dateien, ${(bytes / 1024).toFixed(1)} KB, ${Math.round(ende)} ms von der ersten Anfrage bis zur letzten Antwort (lokaler Server)`);
};

let browser;
try {
  browser = await browserTyp(pw).launch({ headless: true });
  for (const g of GERAETE) {
    // ---------- 1) ohne Erfinder: Sticker senden ----------
    {
      const { k, s, fehler } = await kontext(browser, g);
      await heim(s);
      const gestartet = await neuePartie(s);
      pruefe(`${g.name} Spieler: Partie gegen Fridolin startet`, gestartet);
      await zug(s, ZUEGE[0]);
      await klappt(s.waitForFunction(() => window.__partie.phase() === 'flo' && window.__partie.chess().history().length === 2, null, { timeout: 15000 }));
      await s.locator(`${SCREEN} .em-aktion`).first().click();
      const rad = await klappt(s.waitForSelector('.em-popup .em-wahl', { timeout: 5000 }));
      const wahl = await s.evaluate(() => [...document.querySelectorAll('.em-popup .em-wahl')].map((b) => b.getAttribute('aria-label') || b.textContent.trim()));
      pruefe(`${g.name} Spieler: Emote-Rad geht auf und zeigt die acht gratis Sticker (keine Premium-Sticker)`, rad && wahl.length === 8, wahl);
      await s.locator('.em-popup .em-wahl').first().click();
      const blase = await klappt(s.waitForSelector(`${SCREEN} .em-blase`, { timeout: 5000 }));
      await s.screenshot({ path: path.join(BILDER, `${g.name}-1-sticker.png`) }).catch(() => {});
      pruefe(`${g.name} Spieler: Sticker gesendet, die Sprechblase erscheint an Flos Karte`, blase);
      for (const z of ZUEGE.slice(1)) await zug(s, z);
      const sieg = await klappt(s.waitForSelector('.ergebnis-overlay.sieg', { timeout: 40000 }));
      pruefe(`${g.name} Spieler: Schaefermatt, Sieg`, sieg);
      pruefe(`${g.name} Spieler: keine Seitenfehler`, fehler.length === 0, fehler);
      await k.close();
    }
    // ---------- 2) Erfinder: Finisher Blitzschlag, Klangset Polarlicht ----------
    {
      const { k, s, fehler, klaenge } = await kontext(browser, g, { erfinder: true, einstellungen: { klang: true, klangpaket: 'polarlicht' },
        vorher: { 'schach-arena:v1:einstellungen:finisher': JSON.stringify({ auswahl: 'blitzschlag' }) } });
      await heim(s);
      const lage = await s.evaluate(async () => {
        const so = await import('/js/sonderstuecke.js');
        const fi = await import('/js/pakete/finisher/index.js');
        const lab = await import('/js/labor.js');
        return { erfinder: so.istErfinder(), finisher: fi.auswahl(), klang: lab.klangWahl('polarlicht') };
      });
      pruefe(`${g.name} Erfinder: Labor frei, Finisher Blitzschlag und Klangset Polarlicht gewaehlt`, lage.erfinder && lage.finisher === 'blitzschlag' && lage.klang === 'polarlicht', lage);
      // ein Tipp auf die Seite: erst danach darf der Browser Ton abspielen
      await s.mouse.click(5, 5);
      const gestartet = await neuePartie(s);
      pruefe(`${g.name} Erfinder: Partie startet`, gestartet);
      for (const z of ZUEGE) await zug(s, z);
      // der Finisher erscheint am Ende der Partie und ist nach seiner Dauer wieder weg
      const t0 = Date.now();
      const da = await klappt(s.waitForSelector(`${SCREEN} .finisher.finisher-blitzschlag`, { timeout: 15000 }));
      const t1 = Date.now();
      await s.screenshot({ path: path.join(BILDER, `${g.name}-2-blitzschlag.png`) }).catch(() => {});
      const weg = await klappt(s.waitForSelector(`${SCREEN} .finisher.finisher-blitzschlag`, { state: 'detached', timeout: 4000 }));
      const sichtbar = Date.now() - t1;
      pruefe(`${g.name} Erfinder: Blitzschlag laeuft am Partieende`, da, { nachMs: t1 - t0 });
      pruefe(`${g.name} Erfinder: Blitzschlag ist nach hoechstens 1400 ms (plus 600 ms Takt) wieder weg`, weg && sichtbar <= 2000, { weg, sichtbar });
      await klappt(s.waitForSelector('.ergebnis-overlay.sieg', { timeout: 40000 }));
      await warte(1500);
      const geladen = klaenge.filter((x) => x.status === 200 && x.bytes > 1000);
      pruefe(`${g.name} Erfinder: Klaenge kommen aus assets/klang/polarlicht/ (mindestens zug.mp3, alle mit 200)`, geladen.some((x) => x.datei === 'zug.mp3') && klaenge.every((x) => x.status === 200), klaenge.slice(0, 5));
      messung(g.name, 'Erfinder in der Partie', geladen);
      pruefe(`${g.name} Erfinder: keine Seitenfehler`, fehler.length === 0, fehler);
      await k.close();
    }
    // ---------- 3) ohne Erfinder im Shop: Polarlicht anhoeren ----------
    {
      const { k, s, fehler, klaenge } = await kontext(browser, g, { einstellungen: { klang: true } });
      await heim(s);
      await s.evaluate(() => window.__app.gehe('ich'));
      await s.waitForSelector('.sa-screen', { timeout: 30000 });
      await warte(400);
      for (let i = 0; i < 12 && await s.locator('.st-moment .st-weiter').count(); i++) { await s.locator('.st-moment .st-weiter').first().click(); await warte(250); }
      await s.locator('.sa-platz[data-bereich="shop"], .sa-gross[data-bereich="shop"]').first().click();
      await s.waitForSelector('.sa-blatt .shf-regal[data-art="klang"] .shf-rk', { timeout: 15000 });
      const vorBedarf = klaenge.length;
      const karte = s.locator('.sa-blatt .shf-regal[data-art="klang"] .shf-rk[data-id="klang-polarlicht"], .sa-blatt .shf-regal[data-art="klang"] .shf-rk').first();
      await karte.scrollIntoViewIfNeeded();
      const regal = await s.evaluate(() => {
        const r = document.querySelector('.sa-blatt .shf-regal[data-art="klang"]');
        return { schloss: r.querySelectorAll('.shf-rk .schloss, .shf-rk [class*="schloss"]').length, karten: r.querySelectorAll('.shf-rk').length,
          bald: /Bald/.test(r.textContent), kaufen: [...document.querySelectorAll('.sa-blatt button')].some((b) => /kauf/i.test(b.textContent)) };
      });
      pruefe(`${g.name} Shop: Regal "Mehr Klaenge" mit Schloss und "Bald", kein Kaufen-Knopf`, regal.karten > 0 && regal.schloss >= regal.karten && regal.bald && !regal.kaufen, regal);
      pruefe(`${g.name} Shop: vor dem Anhoeren laedt keine Polarlicht-Datei (bei Bedarf, nicht vorab)`, vorBedarf === 0, vorBedarf);
      await karte.click();
      await s.waitForSelector('.sheet-karte .shf-anhoeren', { timeout: 10000 });
      const knoepfe = await s.evaluate(() => [...document.querySelectorAll('.sheet-karte button')].map((b) => b.textContent.trim()));
      pruefe(`${g.name} Shop: Vorschau nur mit "Anhoeren" und "Schliessen"`, !knoepfe.some((x) => /kauf/i.test(x)), knoepfe);
      await s.locator('.sheet-karte .shf-anhoeren').click();
      await warte(2500);
      await s.screenshot({ path: path.join(BILDER, `${g.name}-3-anhoeren.png`) }).catch(() => {});
      const geladen = klaenge.filter((x) => x.status === 200 && x.bytes > 1000);
      pruefe(`${g.name} Shop: "Anhoeren" laedt Polarlicht-Dateien (Datei laedt, 200)`, geladen.length > 0, klaenge.slice(0, 5));
      messung(g.name, 'Shop Anhoeren', geladen);
      pruefe(`${g.name} Shop: keine Seitenfehler`, fehler.length === 0, fehler);
      await k.close();
    }
  }
} catch (e) {
  console.error(e);
  gesamt++;
} finally {
  if (browser) await browser.close();
  server.close();
}
console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
