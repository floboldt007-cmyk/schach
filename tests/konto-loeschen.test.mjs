// Loeschseite konto-loeschen.html (de) und konto-loeschen-en.html (en): Google Play verlangt einen Weg, das Konto ohne
// die App zu loeschen (G-007 M3). Die Seite meldet per E-Mail-Code oder Google an, fragt zweimal und ruft dann
// konto_loeschen. Netzwerk nur simuliert: Anfragen an *.supabase.co beantwortet der Test, alles ausser 127.0.0.1 wird
// abgebrochen. Nie gegen die echte Supabase.
//   PORT=9621 node tests/konto-loeschen.test.mjs   eigener Port (Standard: frei)
import http from 'node:http';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { browserTyp } from './browser.mjs';

const require = createRequire(import.meta.url);
let pw;
// INTENTIONAL-SLOP[F1]: Playwright-Suche, ein Fehlgriff heisst nur: naechsten Pfad probieren
for (const p of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
  try { pw = require(p); break; } catch (e) { /* naechster */ }
}
if (!pw) throw new Error('Playwright fehlt');
const root = fileURLToPath(new URL('../', import.meta.url));
const typen = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const p = path.resolve(root, '.' + new URL(req.url, 'http://test').pathname.replace(/\/$/, '/index.html'));
  if (!p.startsWith(root)) { res.writeHead(403); res.end(); return; }
  try { res.writeHead(200, { 'Content-Type': typen[path.extname(p)] || 'application/octet-stream' }); res.end(readFileSync(p)); }
  catch (e) { res.writeHead(404); res.end(); }
});
const PORT = Number(process.env.PORT) || await (await import('./freier-port.mjs')).freierPort();
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
const DE = `http://127.0.0.1:${PORT}/konto-loeschen.html?test`;
const EN = `http://127.0.0.1:${PORT}/konto-loeschen-en.html?test`;
const TOKEN = 'a.' + Buffer.from(JSON.stringify({ sub: 'u1', email: 'flo@example.invalid' })).toString('base64url') + '.x';
const SITZUNG = { access_token: TOKEN, refresh_token: 'r1', expires_in: 3600, expires_at: 9999999999, user: { id: 'u1', email: 'flo@example.invalid' } };

let ok = 0, gesamt = 0;
// INTENTIONAL-SLOP[T4]: die Konsole ist der Ausgabeweg dieser Probe (tests/alle.mjs liest sie)
function pruefe(name, gut, detail = '') { gesamt++; if (gut) ok++; console.log(`${gut ? 'OK' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(detail)}`); }
const browser = await browserTyp(pw).launch({ headless: true });

// otp/verify/rpc: { status, body } statt der Erfolgsantwort; lokal: Eintraege im localStorage vor dem Laden
async function umgebung({ otp = null, verify = null, rpc = null, lokal = {}, breite = 390 } = {}) {
  const k = await browser.newContext({ viewport: { width: breite, height: 800 }, serviceWorkers: 'block' });
  const z = { otp, verify, rpc, aufrufe: { otp: 0, verify: 0, loeschen: 0, logout: 0 }, google: [], fehler: [] };
  await k.addInitScript((l) => { for (const [a, b] of Object.entries(l)) localStorage.setItem(a, b); }, lokal);
  await k.route('**/*', (r) => {
    const u = new URL(r.request().url());
    if (u.hostname === '127.0.0.1') return r.continue();
    if (!u.hostname.endsWith('supabase.co')) return r.abort();
    const antwort = (body, status = 200) => r.fulfill({ status, contentType: 'application/json', body: body == null ? '' : JSON.stringify(body) });
    if (u.pathname === '/auth/v1/otp') { z.aufrufe.otp++; return z.otp ? antwort(z.otp.body, z.otp.status) : antwort({}); }
    if (u.pathname === '/auth/v1/verify') { z.aufrufe.verify++; return z.verify ? antwort(z.verify.body, z.verify.status) : antwort(SITZUNG); }
    if (u.pathname === '/rest/v1/rpc/konto_loeschen') { z.aufrufe.loeschen++; return z.rpc ? antwort(z.rpc.body, z.rpc.status) : r.fulfill({ status: 204, body: '' }); }
    if (u.pathname === '/auth/v1/logout') { z.aufrufe.logout++; return r.fulfill({ status: 204, body: '' }); }
    if (u.pathname === '/auth/v1/authorize') { z.google.push(u.href); return r.fulfill({ status: 200, contentType: 'text/html', body: '<p>google</p>' }); }
    return antwort({});
  });
  return { k, z };
}
async function seite(k, z, adresse) {
  const s = await k.newPage();
  s.on('pageerror', (e) => z.fehler.push(e.message));
  await s.goto(adresse); await s.waitForTimeout(400);
  return s;
}
const status = (s) => s.evaluate(() => { const e = document.querySelector('.kl-status'); return { text: e?.textContent || '', fehler: e?.dataset.fehler || '' }; });
const sichtbar = (s, sel) => s.locator(sel).isVisible();
const sitzungDa = (s) => s.evaluate(() => localStorage.getItem('schach-arena:konto:sitzung') !== null);
async function codeAnmelden(s) {
  await s.locator('.kl-email').fill('flo@example.invalid');
  await s.locator('[data-kl="code"]').click(); await s.waitForTimeout(300);
  await s.locator('.kl-code').fill('123456');
  await s.locator('[data-kl="pruefen"]').click(); await s.waitForTimeout(400);
}

try {
  { // 1. Ohne App erreichbar, ohne Anmeldung kein Loeschknopf, Code-Anmeldung, zweistufig loeschen
    const { k, z } = await umgebung();
    const s = await seite(k, z, DE);
    pruefe('de: Seite laedt, Titel „Konto löschen“, lang de', /Konto löschen/.test(await s.locator('h1').textContent()) && (await s.evaluate(() => document.documentElement.lang)) === 'de');
    pruefe('de: Mail-Weg an kontakt@anfrageprofi.de mit Betreff', /^mailto:kontakt@anfrageprofi\.de\?subject=/.test(await s.locator('a.kl-mail').getAttribute('href') || ''));
    pruefe('ohne Anmeldung: kein Loeschknopf sichtbar', !(await sichtbar(s, '[data-kl="weiter"]')) && !(await sichtbar(s, '[data-kl="loeschen"]')));
    await codeAnmelden(s);
    pruefe('Code-Anmeldung: „angemeldet als“ mit der E-Mail', (await sichtbar(s, '.kl-angemeldet')) && /flo@example\.invalid/.test(await s.locator('.kl-wer').textContent()));
    await s.locator('[data-kl="weiter"]').click(); await s.waitForTimeout(200);
    pruefe('Schritt 2: Loeschknopf gesperrt, bis das Wort getippt ist', await s.locator('[data-kl="loeschen"]').isDisabled());
    await s.locator('.kl-bestaetigen').fill('loeschen');
    pruefe('Falsches Wort (ohne ö): Knopf bleibt gesperrt', await s.locator('[data-kl="loeschen"]').isDisabled());
    await s.locator('.kl-bestaetigen').fill('LÖSCHEN');
    await s.locator('[data-kl="loeschen"]').click(); await s.waitForTimeout(600);
    pruefe('Loeschen: konto_loeschen genau einmal', z.aufrufe.loeschen === 1, z.aufrufe);
    pruefe('Loeschen: danach abgemeldet und Bestaetigung sichtbar', !(await sitzungDa(s)) && (await sichtbar(s, '.kl-fertig')) && !(await sichtbar(s, '.kl-angemeldet')));
    pruefe('de: keine Seitenfehler', z.fehler.length === 0, z.fehler);
    await k.close();
  }
  { // 2. Abbrechen loescht nichts
    const { k, z } = await umgebung({ lokal: { 'schach-arena:konto:sitzung': JSON.stringify(SITZUNG) } });
    const s = await seite(k, z, DE);
    pruefe('Gespeicherte Sitzung: gleich angemeldet', await sichtbar(s, '.kl-angemeldet'));
    await s.locator('[data-kl="weiter"]').click(); await s.waitForTimeout(200);
    await s.locator('[data-kl="abbrechen"]').click(); await s.waitForTimeout(200);
    pruefe('Abbrechen: nichts geloescht, Sitzung bleibt, Schritt 2 zu', z.aufrufe.loeschen === 0 && (await sitzungDa(s)) && !(await sichtbar(s, '[data-kl="loeschen"]')));
    await k.close();
  }
  { // 3. Fehler: Server lehnt das Loeschen ab -> klarer Text, Sitzung bleibt
    const { k, z } = await umgebung({ rpc: { status: 500, body: { message: 'boom' } }, lokal: { 'schach-arena:konto:sitzung': JSON.stringify(SITZUNG) } });
    const s = await seite(k, z, DE);
    await s.locator('[data-kl="weiter"]').click();
    await s.locator('.kl-bestaetigen').fill('LÖSCHEN'); await s.locator('[data-kl="loeschen"]').click(); await s.waitForTimeout(600);
    const st = await status(s);
    pruefe('rpc 500: Fehler als Text, keine Bestaetigung, Sitzung bleibt, kein Server-Text',
      st.fehler === 'ja' && st.text.length > 5 && !/boom/.test(st.text) && !(await sichtbar(s, '.kl-fertig')) && (await sitzungDa(s)), st);
    await k.close();
  }
  { // 4. Fehler bei der Code-Anforderung: nichts angemeldet, nichts geloescht
    for (const [name, otp] of [['422 signup_disabled', { status: 422, body: { code: 422, error_code: 'signup_disabled', msg: 'Signups not allowed for this instance' } }],
      ['429', { status: 429, body: { code: 429, error_code: 'over_email_send_rate_limit', msg: 'email rate limit exceeded' } }]]) {
      const { k, z } = await umgebung({ otp });
      const s = await seite(k, z, DE);
      await s.locator('.kl-email').fill('neu@example.invalid'); await s.locator('[data-kl="code"]').click(); await s.waitForTimeout(400);
      const st = await status(s);
      pruefe(`Code-Anforderung ${name}: Fehler als Text ohne Server-Text, kein Codefeld, nichts geloescht`,
        st.fehler === 'ja' && !/Signups|rate limit/.test(st.text) && !(await sichtbar(s, '.kl-code')) && z.aufrufe.loeschen === 0, st);
      await k.close();
    }
    const { k, z } = await umgebung({ verify: { status: 403, body: { code: 403, error_code: 'otp_expired', msg: 'Token has expired or is invalid' } } });
    const s = await seite(k, z, DE);
    await codeAnmelden(s);
    const st = await status(s);
    pruefe('Falscher Code: Fehler als Text, nicht angemeldet', st.fehler === 'ja' && !(await sitzungDa(s)) && !(await sichtbar(s, '.kl-angemeldet')), st);
    await k.close();
  }
  { // 5. Google: Knopf schickt mit Rueckkehr auf diese Seite; Rueckkehr meldet an und raeumt die Adresse auf
    const { k, z } = await umgebung();
    const s = await seite(k, z, DE);
    await s.locator('[data-kl="google"]').click(); await s.waitForTimeout(600);
    const ziel = new URL(z.google[0] || 'http://x/').searchParams.get('redirect_to') || '';
    pruefe('Google: Rueckkehr auf die Loeschseite (#konto)', /\/konto-loeschen\.html\?test#konto$/.test(ziel), z.google);
    const s2 = await seite(k, z, `${DE}#konto#access_token=${TOKEN}&expires_at=9999999999&expires_in=3600&refresh_token=r1&token_type=bearer`);
    pruefe('Google-Rueckkehr: angemeldet, Adresse ohne Token', (await sichtbar(s2, '.kl-angemeldet'))
      && !(await s2.evaluate(() => location.href)).includes('access_token') && z.aufrufe.loeschen === 0);
    await k.close();
    const neu = await umgebung();   // ohne die Sitzung von eben
    const s3 = await seite(neu.k, neu.z, `${DE}#error=access_denied&error_code=signup_disabled&error_description=x`);
    const st = await status(s3);
    pruefe('Google-Rueckkehr mit Fehler: Fehler als Text, Adresse ohne #error, Anmeldung sichtbar', st.fehler === 'ja'
      && !(await s3.evaluate(() => location.href)).includes('error') && (await sichtbar(s3, '.kl-anmelden')), st);
    await neu.k.close();
  }
  { // 6. Englisch, Breiten, Abo-Hinweis
    const { k, z } = await umgebung();
    const s = await seite(k, z, EN);
    pruefe('en: Titel „Delete account“, lang en', /Delete (your )?account/i.test(await s.locator('h1').textContent()) && (await s.evaluate(() => document.documentElement.lang)) === 'en');
    await s.locator('.kl-email').fill('kein-mail'); await s.locator('[data-kl="code"]').click(); await s.waitForTimeout(200);
    const st = await status(s);
    pruefe('en: Fehlertext englisch', st.fehler === 'ja' && /email/i.test(st.text) && !/E-Mail-Adresse/.test(st.text), st);
    await s.locator('[data-kl="google"]').waitFor();
    pruefe('en: keine Seitenfehler', z.fehler.length === 0, z.fehler);
    await k.close();
    for (const breite of [320, 390]) {
      for (const adresse of [DE, EN]) {
        const u = await umgebung({ breite, lokal: { 'schach-arena:konto:sitzung': JSON.stringify(SITZUNG) } });
        const p = await seite(u.k, u.z, adresse);
        await p.locator('[data-kl="weiter"]').click();
        const breit = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        pruefe(`${breite}px ${adresse.includes('-en') ? 'en' : 'de'}: kein seitlicher Ueberlauf`, breit <= 0, breit);
        await u.k.close();
      }
    }
  }
} finally {
  await browser.close(); server.close();
}
// INTENTIONAL-SLOP[T4]: Zusammenfassung der Probe, Ausgabeweg wie alle Zeilen hier
console.log(`${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
