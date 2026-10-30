// Anmelde-Link im Browser (Rueckfall ohne SMTP, PR #76): Rueckkehr in die App, Abgleich-Riegel, zwei Tabs, abgelaufener
// Link. Nachgestellt nach der Ultracode-Pruefung vom 30.10.2026: Der Link oeffnet Safari statt der App auf dem
// Home-Bildschirm (leerer Speicher) oder einen zweiten Tab; ein abgebrochener Dialog oder ein Tab ohne Abgleich durfte
// den Cloud-Stand nicht ueberschreiben. Netzwerk nur simuliert: Anfragen an *.supabase.co beantwortet der Test,
// alles ausser 127.0.0.1 wird abgebrochen.
//   PORT=9620 node tests/konto-link.test.mjs   eigener Port (Standard 8907)
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
const PORT = Number(process.env.PORT || 8907);
await new Promise(r => server.listen(PORT, '127.0.0.1', r));
const BASIS = `http://127.0.0.1:${PORT}/?test&kern`;
const TOKEN = 'a.' + Buffer.from(JSON.stringify({ sub: 'u1', email: 'flo@example.invalid' })).toString('base64url') + '.x';
const LINK = `${BASIS}#access_token=${TOKEN}&expires_at=9999999999&expires_in=3600&refresh_token=r1&token_type=bearer&type=magiclink`;
const partienJson = (n, vor) => JSON.stringify(Array.from({ length: n }, (_, i) => ({ id: vor + i })));
// Cloud = Fortschritt der App auf dem Home-Bildschirm: 7 Partien, Level 5
const cloudZeile = () => ({ user_id: 'u1', format_version: 1, aktualisiert_am: '2026-10-20T10:00:00Z', geraet: 'iPadOS Safari',
  stand: { 'schach-arena:v1:partien': partienJson(7, 'app-'), 'schach-arena:v1:fortschritt': JSON.stringify({ level: 5 }) } });

let ok = 0, gesamt = 0;
function pruefe(name, gut, detail = '') { gesamt++; if (gut) ok++; console.log(`${gut ? 'OK' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(detail)}`); }
const browser = await browserTyp(pw).launch({ headless: true });

// Ein Browser-Speicher (Kontext) mit simuliertem Supabase. lokal: Eintraege, die vor dem ersten Laden im Speicher stehen.
async function speicher({ lokal = {}, cloud = cloudZeile(), verzoegerung = 300 } = {}) {
  const k = await browser.newContext({ viewport: { width: 1024, height: 768 }, serviceWorkers: 'block' });
  const zustand = { cloud, uploads: [], otp: [], fehler: [] };
  await k.addInitScript((vorbelegt) => {
    try { Object.defineProperty(Navigator.prototype, 'standalone', { configurable: true, get: () => false }); } catch (e) { /* egal */ }
    if (!localStorage.getItem('test:vorbelegt')) {
      for (const [s, w] of Object.entries(vorbelegt)) localStorage.setItem(s, w);
      localStorage.setItem('test:vorbelegt', '1');
    }
  }, lokal);
  await k.route('**/*', async (route) => {
    const req = route.request(); const url = new URL(req.url());
    if (url.hostname === '127.0.0.1') return route.continue();
    if (!url.hostname.endsWith('.supabase.co')) return route.abort();
    const antwort = (d, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(d) });
    if (url.pathname === '/auth/v1/otp') { zustand.otp.push(url.search); return antwort({}); }
    if (url.pathname === '/rest/v1/spielstaende' && req.method() === 'GET') {
      await new Promise(r => setTimeout(r, verzoegerung)); return antwort(zustand.cloud ? [zustand.cloud] : []);
    }
    if (url.pathname === '/rest/v1/spielstaende' && req.method() === 'POST') {
      const body = req.postDataJSON(); zustand.uploads.push(body); zustand.cloud = { ...body }; return antwort(null, 201);
    }
    return antwort([]);
  });
  return { k, zustand };
}
async function seite(k, zustand, adresse) {
  const s = await k.newPage();
  s.on('pageerror', (e) => zustand.fehler.push(e.message));
  await s.goto(adresse);
  return s;
}
const lokalePartien = (s) => s.evaluate(() => { try { return JSON.parse(localStorage.getItem('schach-arena:v1:partien')).length; } catch (e) { return 0; } });
const dialogTitel = (s) => s.evaluate(() => [...document.querySelectorAll('.dialog-ort:not(.weg) h2, .dialog:not(.weg) h2')].map((h) => h.textContent).join(' | '));
const status = (s) => s.evaluate(() => ({ text: document.querySelector('.konto-status')?.textContent || '', fehler: document.querySelector('.konto-status')?.dataset.fehler || '' }));

try {
  { // 1. iPad: Link oeffnet Safari mit leerem Speicher -> Cloud laden ohne Rueckfrage, nichts Leeres hochladen
    for (const verzoegerung of [300, 1600]) {
      const { k, zustand } = await speicher({ verzoegerung });
      const s = await seite(k, zustand, LINK);
      await s.waitForTimeout(2600);
      const vorDemVerlassen = zustand.uploads.length;
      pruefe(`Safari leer (Cloud antwortet nach ${verzoegerung} ms): Cloud geladen ohne Dialog, kein Upload`,
        (await lokalePartien(s)) === 7 && vorDemVerlassen === 0 && (await dialogTitel(s)) === ''
        && (await s.evaluate(() => localStorage.getItem('schach-arena:konto:abgeglichen'))) === 'u1',
        { partien: await lokalePartien(s), uploads: vorDemVerlassen, dialog: await dialogTitel(s) });
      pruefe(`Safari leer (${verzoegerung} ms): kein Installations-Hinweis über dem Abgleich`,
        (await s.evaluate(() => localStorage.getItem('schach-arena:v1:hinweis-installieren'))) === null);
      await s.evaluate(() => window.__app.gehe('arena')); await s.waitForTimeout(600);
      pruefe(`Safari leer (${verzoegerung} ms): beim Verlassen nie ein leerer Stand in der Cloud`,
        zustand.uploads.every((u) => JSON.parse(u.stand['schach-arena:v1:partien'] || '[]').length === 7)
        && JSON.parse(zustand.cloud.stand['schach-arena:v1:partien']).length === 7, zustand.uploads.map((u) => Object.keys(u.stand)));
      pruefe(`Safari leer (${verzoegerung} ms): keine Seitenfehler`, zustand.fehler.length === 0, zustand.fehler);
      await k.close();
    }
  }
  { // 2. Eigener Stand im Browser, Konflikt-Dialog mit Escape abgebrochen -> offen lassen, nichts hochladen
    const { k, zustand } = await speicher({ lokal: { 'schach-arena:v1:partien': partienJson(2, 'pc-') } });
    const s = await seite(k, zustand, LINK);
    await s.waitForTimeout(1800);
    const titel = await dialogTitel(s);
    pruefe('Konflikt: Dialog „Welchen Spielstand behalten?“ erscheint', /Spielstand behalten/.test(titel), titel);
    await s.keyboard.press('Escape'); await s.waitForTimeout(400);
    const st = await status(s);
    pruefe('Konflikt abgebrochen: Meldung „Noch nicht abgeglichen“, keine Erfolgsmeldung', /Noch nicht abgeglichen/.test(st.text) && !/hochgeladen/.test(st.text), st);
    await s.evaluate(() => window.__app.gehe('arena')); await s.waitForTimeout(600);
    pruefe('Konflikt abgebrochen: Verlassen lädt nichts hoch, die 7 Cloud-Partien bleiben',
      zustand.uploads.length === 0 && JSON.parse(zustand.cloud.stand['schach-arena:v1:partien']).length === 7 && (await lokalePartien(s)) === 2,
      { uploads: zustand.uploads.length });
    await k.close();
  }
  { // 3. Zwei Tabs: A hat angefordert, der Link oeffnet B. A bekommt die Sitzung nur ueber den Speicher.
    const { k, zustand } = await speicher({ lokal: { 'schach-arena:v1:partien': partienJson(2, 'pc-'), 'schach-arena:konto:sichtbar': '1' } });
    const a = await seite(k, zustand, BASIS + '#einstellungen');
    await a.waitForTimeout(1200);
    const b = await seite(k, zustand, LINK);
    await b.waitForTimeout(1800);
    pruefe('Zwei Tabs: Der Konflikt-Dialog steht im Link-Tab', /Spielstand behalten/.test(await dialogTitel(b)));
    await a.bringToFront(); await a.waitForTimeout(1600);
    pruefe('Zwei Tabs: Der alte Tab fragt selbst nach, statt still zu sichern', /Spielstand behalten/.test(await dialogTitel(a)) && zustand.uploads.length === 0,
      { dialog: await dialogTitel(a), uploads: zustand.uploads.length });
    await b.bringToFront(); await b.getByRole('button', { name: 'Cloud laden' }).click(); await b.waitForTimeout(900);
    pruefe('Zwei Tabs: „Cloud laden“ im Link-Tab lädt die 7 Partien und öffnet den Riegel', (await lokalePartien(b)) === 7
      && (await b.evaluate(() => localStorage.getItem('schach-arena:konto:abgeglichen'))) === 'u1' && zustand.uploads.length === 0);
    await a.bringToFront(); await a.getByRole('button', { name: /Gerät behalten/ }).click(); await a.waitForTimeout(900);
    pruefe('Zwei Tabs: Die spätere, entgegengesetzte Antwort im alten Tab schreibt nichts',
      zustand.uploads.length === 0 && JSON.parse(zustand.cloud.stand['schach-arena:v1:partien']).length === 7 && /anderen Fenster/.test((await status(a)).text),
      { uploads: zustand.uploads.length, status: await status(a) });
    pruefe('Zwei Tabs: keine Seitenfehler', zustand.fehler.length === 0, zustand.fehler);
    await k.close();
  }
  { // 3b. Neue Anmeldung in einem schon abgeglichenen Browser: der alte Abgleich gilt nicht mehr
    const { k, zustand } = await speicher({ lokal: { 'schach-arena:v1:partien': partienJson(2, 'pc-'), 'schach-arena:konto:abgeglichen': 'u1' } });
    const s = await seite(k, zustand, LINK);
    await s.waitForTimeout(1800);
    pruefe('Neue Anmeldung: Konflikt-Dialog trotz altem Abgleich', /Spielstand behalten/.test(await dialogTitel(s)));
    await s.keyboard.press('Escape'); await s.waitForTimeout(300);
    await s.evaluate(() => window.__app.gehe('arena')); await s.waitForTimeout(600);
    pruefe('Neue Anmeldung, Dialog abgebrochen: nichts hochgeladen, die 7 Cloud-Partien bleiben',
      zustand.uploads.length === 0 && JSON.parse(zustand.cloud.stand['schach-arena:v1:partien']).length === 7, { uploads: zustand.uploads.length });
    await k.close();
  }
  { // 3c. Ein Browser mit nur Einstellungen (kein Spiel) gilt als leer und laedt die Cloud ohne Rueckfrage
    const { k, zustand } = await speicher({ lokal: { 'schach-arena:v1:einstellungen': JSON.stringify({ brett: 'holz' }) } });
    const s = await seite(k, zustand, LINK);
    await s.waitForTimeout(2200);
    pruefe('Nur Einstellungen: Cloud geladen ohne Dialog, „Cloud-Spielstand geladen“', (await lokalePartien(s)) === 7 && (await dialogTitel(s)) === ''
      && /Cloud-Spielstand geladen/.test((await status(s)).text), { dialog: await dialogTitel(s), status: await status(s) });
    await k.close();
  }
  { // 4. Abgelaufener oder schon benutzter Link: Konto-Gruppe sichtbar, klare Meldung
    const { k, zustand } = await speicher();
    const s = await seite(k, zustand, BASIS + '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired');
    await s.waitForTimeout(1200);
    const st = await status(s);
    pruefe('Abgelaufener Link: Meldung „abgelaufen oder schon benutzt“ als Fehler, Adresse ohne #error',
      /abgelaufen/.test(st.text) && st.fehler === 'ja' && !(await s.evaluate(() => location.hash)).includes('error'), st);
    await k.close();
  }
  { // 5. Code senden: App-Adresse ohne Hash als redirect_to, Hinweis auf den Link
    const { k, zustand } = await speicher({ lokal: { 'schach-arena:konto:sichtbar': '1' } });
    const s = await seite(k, zustand, BASIS + '#einstellungen');
    await s.waitForTimeout(1000);
    await s.locator('.konto-email').fill('flo@example.invalid');
    await s.locator('[data-konto="code"]').click(); await s.waitForTimeout(600);
    pruefe('Code senden: redirect_to ist die App-Adresse ohne Hash (Suche bleibt)', zustand.otp[0] === '?redirect_to=' + encodeURIComponent(BASIS), zustand.otp);
    pruefe('Code senden: Hinweis, den Link im selben Browser zu öffnen', /selben Browser/.test((await status(s)).text), await status(s));
    await k.close();
  }
} finally {
  await browser.close(); server.close();
}
console.log(`${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
