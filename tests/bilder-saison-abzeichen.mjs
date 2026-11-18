// Bilder fuer R19 Season-Abzeichen (Vorher/Nachher): Saison-Karte im Profil "Ich", Fenster "Season 1 ist vorbei",
// "Alle Ligen" (wenn vorhanden) und eine fremde Gegnerkarte. iPhone 13, iPhone SE, iPad quer und PC, je hell und dunkel.
// Server nachgebildet wie tests/r19-saison-abzeichen.test.mjs, keine Pruefung (die steht dort).
//   node tests/bilder-saison-abzeichen.mjs --bilder=<ordner> [--vor]
import http from 'node:http';
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { browserTyp } from './browser.mjs';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ZIEL = (process.argv.find((a) => a.startsWith('--bilder=')) || '').slice(9);
if (!ZIEL) throw new Error('--bilder=<ordner> fehlt');
const VOR = process.argv.includes('--vor') ? 'vorher-' : '';
mkdirSync(ZIEL, { recursive: true });
const require = createRequire(import.meta.url);
let pw;
for (const p of [process.env.PLAYWRIGHT_PFAD, 'playwright'].filter(Boolean)) { try { pw = require(p); break; } catch (e) { /* naechster */ } }
if (!pw) throw new Error('Playwright fehlt');
const root = WURZEL + path.sep;
const typen = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const p = path.resolve(root, '.' + new URL(req.url, 'http://test').pathname.replace(/\/$/, '/index.html'));
  if (!p.startsWith(root)) { res.writeHead(403); res.end(); return; }
  try { res.writeHead(200, { 'Content-Type': typen[path.extname(p)] || 'application/octet-stream' }); res.end(readFileSync(p)); }
  catch (e) { res.writeHead(404); res.end(); }
});
const PORT = await (await import('./freier-port.mjs')).freierPort();
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
const SUPA = 'https://usaamcqypmvgqmsbfecb.supabase.co';
const UID = '0f8b6c1e-2d3a-4b5c-8d9e-0a1b2c3d4e5f';
const SITZUNG = { access_token: 'a.' + Buffer.from(JSON.stringify({ sub: UID })).toString('base64url') + '.x', refresh_token: 'r1',
  expires_at: 9999999999, user: { id: UID, email: 'probe@example.invalid' } };
const LAUF = { saison: 2, start: '2027-03-01', woche: 3, wochen: 8, ende: '2027-04-25', bisher: 11, stufe: 14,
  abzeichen: [{ saison: 1, stufe: 17 }], titel: ['crownmaster-s1', 'top100-s1'], gewaehlt: 'crownmaster-s1' };
const GERAETE = [['iphone13', 390, 844], ['iphone-se', 375, 667], ['ipad-quer', 1180, 820], ['pc', 1280, 800]];

async function seiteFuer(browser, w, h, schema, gesehen) {
  const kontext = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block', colorScheme: schema, locale: 'de-DE', timezoneId: 'Europe/Berlin' });
  const s = await kontext.newPage();
  await s.route('**/*', (r) => {
    const url = r.request().url();
    if (url.startsWith(`http://127.0.0.1:${PORT}/`)) return r.continue();
    if (!url.startsWith(SUPA)) return r.abort();
    if (url.includes('/rpc/saison_mein_stand')) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(LAUF) });
    return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  await s.addInitScript(({ sitzung, uid, gesehen }) => {
    localStorage.setItem('schach-arena:v1:hinweis-installieren', '1');
    localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(sitzung));
    if (gesehen) localStorage.setItem('schach-arena:v1:season-gesehen', JSON.stringify({ [uid]: 1 }));
    else localStorage.removeItem('schach-arena:v1:season-gesehen');
  }, { sitzung: SITZUNG, uid: UID, gesehen });
  await s.goto(`http://127.0.0.1:${PORT}/index.html?test#ich`);
  await s.waitForFunction(() => !!window.__app, null, { timeout: 20000 });
  await s.waitForFunction(() => { const el = document.querySelector('.ss-leiste'); return el && !el.hidden; }, null, { timeout: 8000 }).catch(() => {});
  return { kontext, s };
}

const browser = await browserTyp(pw).launch({ headless: true });
let n = 0;
try {
  for (const [geraet, w, h] of GERAETE) {
    for (const [wort, schema] of [['hell', 'light'], ['dunkel', 'dark']]) {
      const name = (teil) => path.join(ZIEL, `${VOR}${geraet}-${wort}-${teil}.png`);
      { // Season-Ende-Fenster
        const { kontext, s } = await seiteFuer(browser, w, h, schema, false);
        await s.waitForSelector('.ss-blatt', { timeout: 5000 }).catch(() => {});
        await s.waitForTimeout(1500);
        if (await s.screenshot({ path: name('ende') }).then(() => true, () => false)) n++;
        await kontext.close();
      }
      const { kontext, s } = await seiteFuer(browser, w, h, schema, true);
      await s.evaluate(() => document.querySelector('.ss-leiste')?.scrollIntoView({ block: 'start' }));
      await s.waitForTimeout(400);
      if (await s.screenshot({ path: name('karte') }).then(() => true, () => false)) n++;
      const knopf = await s.$('.ss-bisher .ss-ligen-knopf');
      if (knopf) {
        await knopf.click();
        await s.waitForSelector('.ss-ligen-blatt', { timeout: 4000 }).catch(() => {});
        await s.waitForTimeout(500);
        if (await s.screenshot({ path: name('alle-ligen') }).then(() => true, () => false)) n++;
        await s.keyboard.press('Escape');
        await s.waitForTimeout(300);
      }
      // fremde Gegnerkarte mit Abzeichen, ohne Erfolge
      await s.evaluate(async () => {
        const V = await import('/js/ui/visitenkarte.js');
        const box = document.createElement('div');
        box.id = 'probe-karte';
        box.style.cssText = 'position:fixed;inset:0;z-index:9999;display:grid;place-items:center;padding:16px;background:var(--grund)';
        const vk = V.visitenkarte(V.karteVomServer({ name: 'Mia', kronen_stufe: 13, elo: 1412, banner: 'start',
          saison: { abzeichen: { saison: 1, stufe: 17 }, titel: 'crownmaster-s1' }, vitrine: [] }));
        vk.style.width = 'min(360px, 100%)';
        box.append(vk);
        document.body.append(box);
      });
      await s.waitForTimeout(400);
      if (await s.screenshot({ path: name('gegnerkarte') }).then(() => true, () => false)) n++;
      await kontext.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}
console.log(`${n} Bilder nach ${ZIEL}`);
