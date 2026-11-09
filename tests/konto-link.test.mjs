// Anmelde-Link im Browser (Rueckfall ohne SMTP, PR #76): Rueckkehr in die App, Abgleich ueberall (02.11.2026), zwei Tabs,
// abgelaufener Link. Nachgestellt nach der Ultracode-Pruefung vom 30.10.2026: Der Link oeffnet Safari statt der App auf dem
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
async function speicher({ lokal = {}, cloud = cloudZeile(), verzoegerung = 300, neuBereit = false, botschutz = null } = {}) {
  const k = await browser.newContext({ viewport: { width: 1024, height: 768 }, serviceWorkers: 'block' });
  const zustand = { cloud, uploads: [], otp: [], otpBody: [], fehler: [], neu: [], cf: [] };
  await k.addInitScript((vorbelegt) => {
    try { Object.defineProperty(Navigator.prototype, 'standalone', { configurable: true, get: () => false }); } catch (e) { /* egal */ }
    // Meldungen (Toasts) mitschreiben: sie verschwinden nach gut 3 Sekunden wieder
    window.__toasts = [];
    new MutationObserver(() => { const t = document.querySelector('.toast-ort')?.textContent; if (t && window.__toasts.at(-1) !== t) window.__toasts.push(t); })
      .observe(document, { subtree: true, childList: true, characterData: true });
    if (!localStorage.getItem('test:vorbelegt')) {
      for (const [s, w] of Object.entries(vorbelegt)) localStorage.setItem(s, w);
      localStorage.setItem('test:vorbelegt', '1');
    }
  }, lokal);
  // Bot-Schutz (js/botschutz.js): ein Test-Site-Key und ein nachgebautes Turnstile statt Cloudflare. 'ok' liefert Tokens
  // tok-1, tok-2 (neu nach reset), 'fehler' ruft den error-callback
  if (botschutz) await k.addInitScript(() => { window.__botschutzTestKey = '1x00000000000000000000AA'; });
  const turnstileNachbau = (art) => `window.turnstile = { n: 0, resets: 0, opt: null,
    render(el, o) { this.opt = o; el.dataset.gerendert = o.theme + '|' + o.language; const t = this;
      setTimeout(() => { ${art === 'fehler' ? "o['error-callback']('110200')" : "o.callback('tok-' + (++t.n))"}; }, 50); return 'w1'; },
    reset() { this.resets++; const t = this; setTimeout(() => t.opt.callback('tok-' + (++t.n)), 50); }, remove() {} };`;
  await k.route('**/*', async (route) => {
    const req = route.request(); const url = new URL(req.url());
    if (url.hostname === '127.0.0.1') return route.continue();
    if (url.hostname === 'challenges.cloudflare.com') {
      zustand.cf.push(url.pathname + url.search);
      if (!botschutz) return route.abort();
      return route.fulfill({ status: 200, contentType: 'text/javascript', body: turnstileNachbau(botschutz) });
    }
    // Umzug (js/umzug.js): crownmate.de liefert die App erst, wenn neuBereit gesetzt ist
    if (url.hostname === 'crownmate.de') {
      zustand.neu.push(url.pathname);
      if (!neuBereit) return route.abort();
      if (url.pathname === '/manifest.webmanifest') return route.fulfill({ status: 200, contentType: 'application/manifest+json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ name: 'Crownmate' }) });
      return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>crownmate.de</title><p>neu</p>' });
    }
    if (!url.hostname.endsWith('.supabase.co')) return route.abort();
    const antwort = (d, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(d) });
    if (url.pathname === '/auth/v1/otp') { zustand.otp.push(url.search); zustand.otpBody.push(req.postDataJSON()); return antwort({}); }
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
  { // 1. iPad: Link oeffnet Safari mit leerem Speicher -> Cloud laden ohne Rueckfrage, nie etwas Leeres hochladen
    for (const verzoegerung of [300, 1600]) {
      const { k, zustand } = await speicher({ verzoegerung });
      const s = await seite(k, zustand, LINK);
      await s.waitForTimeout(3200);
      pruefe(`Safari leer (Cloud antwortet nach ${verzoegerung} ms): Cloud geladen ohne Dialog, nie ein Stand ohne die 7 Partien hochgeladen`,
        (await lokalePartien(s)) === 7 && (await dialogTitel(s)) === ''
        && zustand.uploads.every((u) => JSON.parse(u.stand['schach-arena:v1:partien'] || '[]').length === 7)
        && (await s.evaluate(() => localStorage.getItem('schach-arena:konto:abgeglichen'))) === 'u1',
        { partien: await lokalePartien(s), uploads: zustand.uploads.length, dialog: await dialogTitel(s) });
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
  { // 2. Eigener kleiner Stand im Browser (2 Partien), Cloud mit 7: ohne Dialog gilt die Cloud (Flo 02.11.2026), die
    // 2 Partien lassen sich unter Einstellungen > Konto zurueckholen
    const { k, zustand } = await speicher({ lokal: { 'schach-arena:v1:partien': partienJson(2, 'pc-') } });
    let ladungen = 0;
    const s = await k.newPage(); s.on('pageerror', (e) => zustand.fehler.push(e.message)); s.on('load', () => { ladungen++; });
    await s.goto(LINK); await s.waitForTimeout(3200);
    pruefe('Mehr Fortschritt in der Cloud: geladen ohne Dialog, Meldung nach dem Neuladen', (await lokalePartien(s)) === 7 && (await dialogTitel(s)) === ''
      && ladungen === 2 && /anderen Gerät geladen/.test(await s.evaluate(() => window.__toasts.join(' | '))), { ladungen, dialog: await dialogTitel(s) });
    pruefe('Die 7 Cloud-Partien bleiben in der Cloud', zustand.uploads.every((u) => JSON.parse(u.stand['schach-arena:v1:partien'] || '[]').length === 7)
      && JSON.parse(zustand.cloud.stand['schach-arena:v1:partien']).length === 7, { uploads: zustand.uploads.length });
    await s.evaluate(() => window.__app.gehe('einstellungen', { gruppe: 'konto' })); await s.waitForTimeout(700);
    pruefe('Einstellungen > Konto bietet den ersetzten Stand (2 Partien) zum Zurückholen an',
      /2 Partien/.test(await s.evaluate(() => document.querySelector('.konto-verdraengt')?.textContent || '')));
    await s.locator('[data-konto="zurueckholen"]').click(); await s.waitForTimeout(400);
    await s.getByRole('button', { name: 'Zurückholen' }).last().click(); await s.waitForTimeout(3000);
    pruefe('Zurückholen: die 2 Partien sind wieder da und gehen in die Cloud, die 7 liegen zurück',
      (await lokalePartien(s)) === 2 && JSON.parse(zustand.cloud.stand['schach-arena:v1:partien']).length === 2
      && /7 Partien/.test(await s.evaluate(() => { const d = JSON.parse(localStorage.getItem('schach-arena:konto:verdraengt')); return JSON.parse(d.stand['schach-arena:v1:partien']).length + ' Partien'; })),
      { lokal: await lokalePartien(s), cloud: JSON.parse(zustand.cloud.stand['schach-arena:v1:partien']).length });
    pruefe('Ersetzter Stand: keine Seitenfehler', zustand.fehler.length === 0, zustand.fehler);
    await k.close();
  }
  { // 3. Zwei Tabs: A hat angefordert, der Link oeffnet B. B laedt die Cloud, A laedt danach von selbst neu (sonst
    // schriebe A seinen alten Stand aus dem Arbeitsspeicher zurueck)
    const { k, zustand } = await speicher({ lokal: { 'schach-arena:v1:partien': partienJson(2, 'pc-'), 'schach-arena:konto:sichtbar': '1' } });
    const a = await seite(k, zustand, BASIS + '#einstellungen');
    let ladungenA = 0; a.on('load', () => { ladungenA++; });
    await a.waitForTimeout(1200);
    const b = await seite(k, zustand, LINK);
    await b.waitForTimeout(3200);
    pruefe('Zwei Tabs: der Link-Tab lädt die 7 Cloud-Partien ohne Dialog', (await lokalePartien(b)) === 7 && (await dialogTitel(b)) === '');
    await a.bringToFront(); await a.waitForTimeout(2500);
    pruefe('Zwei Tabs: der alte Tab lädt von selbst neu und zeigt keinen Dialog', ladungenA >= 1 && (await dialogTitel(a)) === '' && (await lokalePartien(a)) === 7, { ladungenA, dialog: await dialogTitel(a) });
    pruefe('Zwei Tabs: die Cloud behält die 7 Partien', zustand.uploads.every((u) => JSON.parse(u.stand['schach-arena:v1:partien'] || '[]').length === 7)
      && JSON.parse(zustand.cloud.stand['schach-arena:v1:partien']).length === 7, { uploads: zustand.uploads.length });
    pruefe('Zwei Tabs: keine Seitenfehler', zustand.fehler.length === 0, zustand.fehler);
    await k.close();
  }
  { // 3b. Abgeglichenes Geraet, die Cloud aendert sich auf einem anderen Geraet: beim Start und beim Zurueckkehren laedt
    // die App den neuen Stand, ohne Neulade-Kreislauf; eigene Aenderungen gehen hoch
    const { k, zustand } = await speicher({ lokal: { 'schach-arena:konto:sitzung': JSON.stringify({ access_token: TOKEN, refresh_token: 'r1', expires_at: 9999999999, email: 'flo@example.invalid' }) } });
    let ladungen = 0;
    const s = await k.newPage(); s.on('pageerror', (e) => zustand.fehler.push(e.message)); s.on('load', () => { ladungen++; });
    await s.goto(BASIS); await s.waitForTimeout(3500);
    pruefe('Start mit Anmeldung, leeres Gerät: die Cloud wird geladen (einmal neu geladen)', (await lokalePartien(s)) === 7 && ladungen === 2, { ladungen, partien: await lokalePartien(s) });
    const nachStart = ladungen;
    zustand.cloud = { ...zustand.cloud, stand: { ...zustand.cloud.stand, 'schach-arena:v1:partien': partienJson(9, 'handy-') } };
    await s.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
    await s.waitForTimeout(300);
    await s.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); document.dispatchEvent(new Event('visibilitychange')); });
    await s.waitForTimeout(3500);
    pruefe('Zurück in die App: der neue Stand vom Handy (9 Partien) ist da', (await lokalePartien(s)) === 9 && ladungen === nachStart + 1, { ladungen, partien: await lokalePartien(s) });
    await s.waitForTimeout(3000);
    pruefe('Kein Neulade-Kreislauf', ladungen === nachStart + 1, { ladungen });
    pruefe('Abgleich beim Start und Zurückkehren: keine Seitenfehler', zustand.fehler.length === 0, zustand.fehler);
    await k.close();
  }
  { // 3c. Ein Browser mit nur Einstellungen (kein Spiel) gilt als leer und laedt die Cloud ohne Rueckfrage
    const { k, zustand } = await speicher({ lokal: { 'schach-arena:v1:einstellungen': JSON.stringify({ brett: 'holz' }) } });
    const s = await seite(k, zustand, LINK);
    await s.waitForTimeout(3200);
    pruefe('Nur Einstellungen: Cloud geladen ohne Dialog, Meldung „von deinem anderen Gerät geladen“', (await lokalePartien(s)) === 7 && (await dialogTitel(s)) === ''
      && /anderen Gerät geladen/.test(await s.evaluate(() => window.__toasts.join(' | '))), { dialog: await dialogTitel(s) });
    await k.close();
  }
  { // U. Umzug auf crownmate.de (js/umzug.js): schlaeft, bis die neue Adresse die App ausliefert
    const UMZUG = BASIS + '&umzug=alt';
    const ohneTipp = { 'schach-arena:v1:hinweis-installieren': '1' };   // der Installations-Tipp ist ein eigener Dialog
    {
      const { k, zustand } = await speicher({ lokal: ohneTipp });
      const s = await seite(k, zustand, BASIS); await s.waitForTimeout(2600);
      pruefe('Umzug: unter einer anderen Adresse als github.io fragt die App crownmate.de gar nicht erst', zustand.neu.length === 0 && (await dialogTitel(s)) === '', zustand.neu);
      await k.close();
    }
    {
      const { k, zustand } = await speicher({ lokal: ohneTipp });
      const s = await seite(k, zustand, UMZUG); await s.waitForTimeout(2600);
      pruefe('Umzug: crownmate.de noch nicht bereit (heute): kein Hinweis, keine Seitenfehler', zustand.neu.includes('/manifest.webmanifest')
        && (await dialogTitel(s)) === '' && zustand.fehler.length === 0, { neu: zustand.neu, dialog: await dialogTitel(s), fehler: zustand.fehler });
      await k.close();
    }
    {
      const { k, zustand } = await speicher({ neuBereit: true, lokal: { ...ohneTipp, 'schach-arena:v1:partien': partienJson(2, 'pc-') } });
      const s = await seite(k, zustand, UMZUG); await s.waitForTimeout(2600);
      const text = await s.evaluate(() => document.querySelector('.dialog-ort:not(.weg), .dialog:not(.weg)')?.textContent || '');
      pruefe('Umzug: crownmate.de bereit, ohne Konto: Hinweis „Crownmate ist umgezogen“ mit Rat zur Anmeldung', /Crownmate ist umgezogen/.test(await dialogTitel(s))
        && /nur auf diesem Gerät/.test(text), { dialog: await dialogTitel(s), text });
      await s.getByRole('button', { name: 'Zu crownmate.de' }).click(); await s.waitForTimeout(1200);
      pruefe('Umzug: „Zu crownmate.de“ öffnet die neue Adresse', s.url() === 'https://crownmate.de/', s.url());
      await k.close();
    }
    {
      const sitz = JSON.stringify({ access_token: TOKEN, refresh_token: 'r1', expires_at: 9999999999, email: 'flo@example.invalid' });
      const { k, zustand } = await speicher({ neuBereit: true, lokal: { ...ohneTipp, 'schach-arena:konto:sitzung': sitz } });
      const s = await seite(k, zustand, UMZUG); await s.waitForTimeout(4200);
      const text = await s.evaluate(() => document.querySelector('.dialog-ort:not(.weg), .dialog:not(.weg)')?.textContent || '');
      pruefe('Umzug: angemeldet: Hinweis, dass der Spielstand mit demselben Konto mitkommt', /demselben Konto an, dann ist dein Spielstand sofort da/.test(text), text);
      pruefe('Umzug: angemeldet: keine Seitenfehler', zustand.fehler.length === 0, zustand.fehler);
      await k.close();
    }
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
    // Ohne Site-Key (Stand bis Flo das Cloudflare-Konto anlegt): nichts von Cloudflare, kein Widget, Body wie vorher
    pruefe('Bot-Schutz aus (kein Site-Key): keine Anfrage an challenges.cloudflare.com, kein Widget, kein Hinweis, Body ohne Token',
      zustand.cf.length === 0 && await s.locator('.konto-botschutz').isHidden() && await s.locator('.konto-botschutz-hinweis').count() === 0
        && JSON.stringify(Object.keys(zustand.otpBody[0] || {})) === '["email","create_user"]', { cf: zustand.cf, body: zustand.otpBody });
    await k.close();
  }
  { // 6. Bot-Schutz an (Test-Site-Key): Skript erst mit der Anmeldung, Token im Body, danach ein neues Token
    // Hinweis „Zum Home-Bildschirm“ (js/app.js, kommt 1,2 s nach dem Start) als schon gesehen, sonst verdeckt er die Anmeldung
    const { k, zustand } = await speicher({ lokal: { 'schach-arena:konto:sichtbar': '1', 'schach-arena:v1:hinweis-installieren': '1' }, botschutz: 'ok' });
    const s = await seite(k, zustand, BASIS + '#arena');
    await s.waitForTimeout(1000);
    pruefe('Bot-Schutz: beim Start der App lädt nichts von Cloudflare', zustand.cf.length === 0, zustand.cf);
    await s.evaluate(() => { location.hash = '#einstellungen'; });
    await s.waitForSelector('.konto-email', { timeout: 5000 }).catch(() => {});
    await s.waitForTimeout(1500);   // laenger als der Sekundentakt der Konto-Gruppe
    // Nachbesserung Runde 5: das blosse Oeffnen der Einstellungen laedt nichts (der Datenschutztext stuetzt sich auf
    // "die Anmeldung, die du selbst aufrufst"); der Hinweis auf den Bot-Schutz steht aber schon vorher da
    pruefe('Bot-Schutz: Einstellungen öffnen lädt nichts von Cloudflare, kein Widget, Hinweis schon sichtbar',
      zustand.cf.length === 0 && await s.locator('.konto-botschutz').isHidden() && !(await s.evaluate(() => 'turnstile' in window))
        && await s.locator('.konto-botschutz-hinweis').isVisible(), zustand.cf);
    await s.locator('.konto-email').focus();
    await s.waitForSelector('.konto-botschutz[data-gerendert]', { timeout: 5000 }).catch(() => {});
    pruefe('Bot-Schutz: Fokus im E-Mail-Feld lädt genau ein Skript, nur von challenges.cloudflare.com (explizit gezeichnet)',
      zustand.cf.length === 1 && zustand.cf[0] === '/turnstile/v0/api.js?render=explicit', zustand.cf);
    await s.locator('.konto-email').blur(); await s.locator('.konto-email').focus(); await s.waitForTimeout(300);
    pruefe('Bot-Schutz: erneuter Fokus lädt kein zweites Skript', zustand.cf.length === 1, zustand.cf);
    pruefe('Bot-Schutz: Widget gezeichnet (hell, deutsch) und Hinweis auf den Bot-Schutz sichtbar',
      await s.locator('.konto-botschutz').getAttribute('data-gerendert') === 'light|de' && await s.locator('.konto-botschutz-hinweis').isVisible(),
      await s.locator('.konto-botschutz').getAttribute('data-gerendert'));
    const mehr = await s.locator('.konto-botschutz-hinweis a').evaluateAll((a) => a.map((x) => ({ href: x.href, ziel: x.target })));
    const absatz = readFileSync(path.join(root, 'datenschutz.html'), 'utf8');
    pruefe('Bot-Schutz: Hinweis verlinkt den Absatz #botschutz der Datenschutzerklärung (neuer Tab), der Absatz nennt Speicher und § 25',
      mehr.length === 1 && /\/datenschutz\.html#botschutz$/.test(mehr[0].href) && mehr[0].ziel === '_blank'
      && absatz.includes('id="botschutz"') && absatz.includes('cf.turnstile.u') && absatz.includes('§ 25 Abs. 2 Nr. 2 TDDDG'), mehr);
    await s.locator('.konto-email').fill('flo@example.invalid');
    await s.locator('[data-konto="code"]').click(); await s.waitForTimeout(600);
    pruefe('Bot-Schutz: Token geht als gotrue_meta_security.captcha_token mit', zustand.otpBody.length === 1
      && zustand.otpBody[0].gotrue_meta_security?.captcha_token === 'tok-1' && zustand.otpBody[0].email === 'flo@example.invalid', zustand.otpBody);
    await s.locator('[data-konto="code"]').click(); await s.waitForTimeout(600);
    pruefe('Bot-Schutz: jedes Token nur einmal (nach dem Senden reset, zweites Senden mit tok-2)',
      await s.evaluate(() => window.turnstile.resets) >= 1 && zustand.otpBody[1]?.gotrue_meta_security?.captcha_token === 'tok-2', zustand.otpBody);
    pruefe('Bot-Schutz: keine Seitenfehler', zustand.fehler.length === 0, zustand.fehler);
    await k.close();
  }
  { // 6b. "Code senden" ohne Fokus im E-Mail-Feld (Adresse vom Browser eingetragen): der Klick laedt das Skript und
    // wartet auf das Token
    const { k, zustand } = await speicher({ lokal: { 'schach-arena:konto:sichtbar': '1', 'schach-arena:v1:hinweis-installieren': '1' }, botschutz: 'ok' });
    const s = await seite(k, zustand, BASIS + '#einstellungen');
    await s.waitForTimeout(1200);
    await s.evaluate(() => { document.querySelector('.konto-email').value = 'flo@example.invalid'; });
    const vorher = zustand.cf.length;
    await s.locator('[data-konto="code"]').click(); await s.waitForTimeout(900);
    pruefe('Bot-Schutz: „Code senden“ ohne Fokus im Feld lädt das Skript erst jetzt (genau eines) und schickt das Token mit',
      vorher === 0 && zustand.cf.length === 1 && zustand.otpBody.length === 1 && zustand.otpBody[0].gotrue_meta_security?.captcha_token === 'tok-1'
        && zustand.fehler.length === 0, { vorher, cf: zustand.cf, body: zustand.otpBody, fehler: zustand.fehler });
    await k.close();
  }
  { // 7. Bot-Schutz schlaegt fehl: kein Code anfordern, eigener Text
    const { k, zustand } = await speicher({ lokal: { 'schach-arena:konto:sichtbar': '1', 'schach-arena:v1:hinweis-installieren': '1' }, botschutz: 'fehler' });
    const s = await seite(k, zustand, BASIS + '#einstellungen');
    await s.waitForTimeout(1200);
    pruefe('Bot-Schutz (Fehlerfall): vor der ersten Eingabe keine Anfrage an Cloudflare', zustand.cf.length === 0, zustand.cf);
    await s.locator('.konto-email').fill('flo@example.invalid');
    await s.locator('[data-konto="code"]').click(); await s.waitForTimeout(600);
    const st = await status(s);
    pruefe('Bot-Schutz fehlgeschlagen: keine Anfrage an /auth/v1/otp, Meldung „Bot-Schutz hat nicht geklappt“ als Fehler',
      zustand.otp.length === 0 && /Bot-Schutz hat nicht geklappt/.test(st.text) && st.fehler === 'ja', { st, otp: zustand.otp });
    await k.close();
  }
} finally {
  await browser.close(); server.close();
}
console.log(`${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
