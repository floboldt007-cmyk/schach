// Loeschseite konto-loeschen.html (de) und konto-loeschen-en.html (en): Google Play verlangt einen Weg, das Konto ohne
// die App zu loeschen (G-007 M3). Die Seite meldet per E-Mail-Code oder Google an, fragt zweimal und ruft dann
// konto_loeschen. Netzwerk nur simuliert: Anfragen an *.supabase.co beantwortet der Test, alles ausser 127.0.0.1 wird
// abgebrochen. Nie gegen die echte Supabase.
//   PORT=9621 node tests/konto-loeschen.test.mjs   eigener Port (Standard: frei)
//   BILDER=<ordner> node tests/konto-loeschen.test.mjs   dazu an jeder Haupthandlung ein Bild (wie die Funktionsprobe)
import http from 'node:http';
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
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
const BILDER = process.env.BILDER || null;
if (BILDER) mkdirSync(BILDER, { recursive: true });
const bilderListe = [];
async function bild(s, name) {
  if (!BILDER) return;
  const datei = path.join(BILDER, `konto-loeschen-${name}.png`);
  await s.screenshot({ path: datei, fullPage: true }); bilderListe.push(datei);
}
// INTENTIONAL-SLOP[T4]: die Konsole ist der Ausgabeweg dieser Probe (tests/alle.mjs liest sie)
function pruefe(name, gut, detail = '') { gesamt++; if (gut) ok++; console.log(`${gut ? 'OK' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(detail)}`); }
const browser = await browserTyp(pw).launch({ headless: true });

// otp/verify/rpc/token: { status, body } statt der Erfolgsantwort (rpc auch als Liste je Aufruf, null = Erfolg);
// token.abbruch: die Verbindung zum Token-Endpunkt bricht ab; rpc.abbruch: dasselbe fuer konto_loeschen;
// rpcMs: Antwort von konto_loeschen verzoegert;
// lokal: Eintraege im localStorage vor dem Laden
async function umgebung({ otp = null, verify = null, rpc = null, token = null, rpcMs = 0, lokal = {}, breite = 390 } = {}) {
  const k = await browser.newContext({ viewport: { width: breite, height: 800 }, serviceWorkers: 'block' });
  const z = { otp, verify, rpc, token, aufrufe: { otp: 0, verify: 0, loeschen: 0, logout: 0, token: 0 }, google: [], fehler: [] };
  await k.addInitScript((l) => { for (const [a, b] of Object.entries(l)) localStorage.setItem(a, b); }, lokal);
  await k.route('**/*', async (r) => {
    const u = new URL(r.request().url());
    if (u.hostname === '127.0.0.1') return r.continue();
    if (!u.hostname.endsWith('supabase.co')) return r.abort();
    const antwort = (body, status = 200) => r.fulfill({ status, contentType: 'application/json', body: body == null ? '' : JSON.stringify(body) });
    if (u.pathname === '/auth/v1/otp') { z.aufrufe.otp++; return z.otp ? antwort(z.otp.body, z.otp.status) : antwort({}); }
    if (u.pathname === '/auth/v1/verify') { z.aufrufe.verify++; return z.verify ? antwort(z.verify.body, z.verify.status) : antwort(SITZUNG); }
    if (u.pathname === '/auth/v1/token') {
      z.aufrufe.token++;
      if (z.token?.abbruch) return r.abort('internetdisconnected');
      return z.token ? antwort(z.token.body, z.token.status) : antwort(SITZUNG);
    }
    if (u.pathname === '/rest/v1/rpc/konto_loeschen') {
      z.aufrufe.loeschen++;
      if (rpcMs) await new Promise((w) => setTimeout(w, rpcMs));
      const a = Array.isArray(z.rpc) ? z.rpc[z.aufrufe.loeschen - 1] : z.rpc;
      if (a?.abbruch) return r.abort('internetdisconnected');
      return a ? antwort(a.body, a.status) : r.fulfill({ status: 204, body: '' });
    }
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
    pruefe('de: Mail-Weg an kontakt@crownmate.de mit Betreff', /^mailto:kontakt@crownmate\.de\?subject=/.test(await s.locator('a.kl-mail').getAttribute('href') || ''));
    pruefe('ohne Anmeldung: kein Loeschknopf sichtbar', !(await sichtbar(s, '[data-kl="weiter"]')) && !(await sichtbar(s, '[data-kl="loeschen"]')));
    await bild(s, '1-start');
    await codeAnmelden(s);
    pruefe('Code-Anmeldung: „angemeldet als“ mit der E-Mail', (await sichtbar(s, '.kl-angemeldet')) && /flo@example\.invalid/.test(await s.locator('.kl-wer').textContent()));
    await bild(s, '1-angemeldet');
    await s.locator('[data-kl="weiter"]').click(); await s.waitForTimeout(200);
    pruefe('Schritt 2: Loeschknopf gesperrt, bis das Wort getippt ist', await s.locator('[data-kl="loeschen"]').isDisabled());
    await s.locator('.kl-bestaetigen').fill('loeschen');
    pruefe('Falsches Wort (ohne ö): Knopf bleibt gesperrt', await s.locator('[data-kl="loeschen"]').isDisabled());
    await bild(s, '1-schritt2');
    await s.locator('.kl-bestaetigen').fill('LÖSCHEN');
    await s.locator('[data-kl="loeschen"]').click(); await s.waitForTimeout(600);
    pruefe('Loeschen: konto_loeschen genau einmal', z.aufrufe.loeschen === 1, z.aufrufe);
    pruefe('Loeschen: danach abgemeldet und Bestaetigung sichtbar', !(await sitzungDa(s)) && (await sichtbar(s, '.kl-fertig')) && !(await sichtbar(s, '.kl-angemeldet')));
    await bild(s, '1-geloescht');
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
    await bild(s, '2-abgebrochen');
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
    await bild(s, '3-serverfehler');
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
    await bild(s, '4-falscher-code');
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
    await bild(s2, '5-google-rueckkehr');
    await k.close();
    const neu = await umgebung();   // ohne die Sitzung von eben
    const s3 = await seite(neu.k, neu.z, `${DE}#error=access_denied&error_code=signup_disabled&error_description=x`);
    const st = await status(s3);
    pruefe('Google-Rueckkehr mit Fehler: Fehler als Text, Adresse ohne #error, Anmeldung sichtbar', st.fehler === 'ja'
      && !(await s3.evaluate(() => location.href)).includes('error') && (await sichtbar(s3, '.kl-anmelden')), st);
    await bild(s3, '5-google-fehler');
    await neu.k.close();
  }
  { // 6. Englisch, Breiten, Abo-Hinweis
    const { k, z } = await umgebung();
    const s = await seite(k, z, EN);
    pruefe('en: Titel „Delete account“, lang en', /Delete (your )?account/i.test(await s.locator('h1').textContent()) && (await s.evaluate(() => document.documentElement.lang)) === 'en');
    await s.locator('.kl-email').fill('kein-mail'); await s.locator('[data-kl="code"]').click(); await s.waitForTimeout(200);
    const st = await status(s);
    pruefe('en: Fehlertext englisch', st.fehler === 'ja' && /email/i.test(st.text) && !/E-Mail-Adresse/.test(st.text), st);
    await bild(s, '6-en-fehler');
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
        await bild(p, `6-schritt2-${breite}-${adresse.includes('-en') ? 'en' : 'de'}`);
        await u.k.close();
      }
    }
  }
  { // 7. Tippen waehrend der laufenden Loeschung gibt den Knopf nicht wieder frei: genau ein konto_loeschen
    const { k, z } = await umgebung({ rpcMs: 1200, lokal: { 'schach-arena:konto:sitzung': JSON.stringify(SITZUNG) } });
    const s = await seite(k, z, DE);
    await s.locator('[data-kl="weiter"]').click();
    await s.locator('.kl-bestaetigen').fill('LÖSCHEN');
    await s.locator('[data-kl="loeschen"]').click(); await s.waitForTimeout(100);
    await s.locator('.kl-bestaetigen').press('End').catch(() => {});
    await s.locator('.kl-bestaetigen').pressSequentially(' ', { timeout: 500 }).catch(() => {});
    await s.locator('[data-kl="loeschen"]').click({ timeout: 500 }).catch(() => {});
    await s.waitForTimeout(1800);
    pruefe('Tippen waehrend der Loeschung + zweiter Klick: konto_loeschen genau einmal', z.aufrufe.loeschen === 1, z.aufrufe);
    pruefe('Tippen waehrend der Loeschung: danach Bestaetigung sichtbar', await sichtbar(s, '.kl-fertig'));
    await bild(s, '7-tippen-waehrend-loeschung');
    await k.close();
  }
  { // 8. Abgelaufene Sitzung, Refresh tot: schon beim Laden Meldung und Anmeldung, nichts geloescht
    const alt = { ...SITZUNG, expires_at: 1 };
    const { k, z } = await umgebung({ token: { status: 400, body: { code: 400, error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token' } },
      lokal: { 'schach-arena:konto:sitzung': JSON.stringify(alt) } });
    const s = await seite(k, z, DE);
    const st = await status(s);
    pruefe('Sitzung abgelaufen, Refresh tot: beim Laden Fehlertext, Anmeldung sichtbar, „angemeldet als“ und Loeschknopf weg',
      st.fehler === 'ja' && st.text.length > 5 && (await sichtbar(s, '.kl-anmelden')) && !(await sichtbar(s, '.kl-angemeldet'))
      && !(await sichtbar(s, '[data-kl="weiter"]')) && !(await sitzungDa(s)) && z.aufrufe.token === 1 && z.aufrufe.loeschen === 0, { st, aufrufe: z.aufrufe });
    await bild(s, '8-sitzung-abgelaufen');
    await k.close();
  }
  { // 8c. R17: wie 8, Refresh tot im alten Format (error invalid_grant): beim Laden Text "abgelaufen" (de) / "expired" (en)
    for (const [name, adresse, wort] of [['de', DE, /abgelaufen/i], ['en', EN, /expired/i]]) {
      const { k, z } = await umgebung({ token: { status: 400, body: { error: 'invalid_grant', error_description: 'Invalid Refresh Token: Refresh Token Not Found' } },
        lokal: { 'schach-arena:konto:sitzung': JSON.stringify({ ...SITZUNG, expires_at: 1 }) } });
      const s = await seite(k, z, adresse);
      const st = await status(s);
      pruefe(`${name}: Sitzung abgelaufen, Refresh tot (invalid_grant): beim Laden Text abgelaufen, Anmeldung sichtbar, nichts geloescht`,
        st.fehler === 'ja' && wort.test(st.text) && (await sichtbar(s, '.kl-anmelden')) && !(await sichtbar(s, '.kl-angemeldet'))
        && !(await sitzungDa(s)) && z.aufrufe.token === 1 && z.aufrufe.loeschen === 0, { st, aufrufe: z.aufrufe });
      await k.close();
    }
  }
  { // 8b. Gegenprobe: abgelaufene Sitzung, Refresh klappt -> beim Laden erneuert, angemeldet, keine Meldung
    const { k, z } = await umgebung({ lokal: { 'schach-arena:konto:sitzung': JSON.stringify({ ...SITZUNG, expires_at: 1 }) } });
    const s = await seite(k, z, DE);
    const st = await status(s);
    pruefe('Sitzung abgelaufen, Refresh klappt: beim Laden erneuert, angemeldet, keine Meldung',
      (await sichtbar(s, '.kl-angemeldet')) && !(await sichtbar(s, '.kl-anmelden')) && st.text === '' && z.aufrufe.token === 1, { st, aufrufe: z.aufrufe });
    await bild(s, '8b-refresh-klappt');
    await k.close();
  }
  { // 9. Abo-Hinweis: bekanntes laufendes Stripe-Abo steht vor Schritt 2, ohne Abo kein Hinweis
    const abo = JSON.stringify({ uid: 'u1', premium: true, status: 'aktiv', plan: 'monat', gueltigBis: 9999999999999, quelle: 'stripe', geprueftAm: Date.now() });
    for (const [name, adresse, muster] of [['de', DE, /Stripe/], ['en', EN, /Stripe/]]) {
      const { k, z } = await umgebung({ lokal: { 'schach-arena:konto:sitzung': JSON.stringify(SITZUNG), 'schach-arena:abo:stand': abo } });
      const s = await seite(k, z, adresse);
      await s.locator('[data-kl="weiter"]').click(); await s.waitForTimeout(300);
      const t = (await s.locator('.kl-abo').textContent()) || '';
      pruefe(`${name}: laufendes Stripe-Abo, Hinweis vor Schritt 2 sichtbar`, (await sichtbar(s, '.kl-abo')) && muster.test(t)
        && (name === 'de' ? /kündig/i.test(t) : /cancel/i.test(t)), t);
      await bild(s, `9-abo-hinweis-${name}`);
      await k.close();
    }
    const { k, z } = await umgebung({ lokal: { 'schach-arena:konto:sitzung': JSON.stringify(SITZUNG) } });
    const s = await seite(k, z, DE);
    await s.locator('[data-kl="weiter"]').click(); await s.waitForTimeout(300);
    pruefe('ohne bekanntes Abo: kein Abo-Hinweis in Schritt 2', !(await sichtbar(s, '.kl-abo')));
    await k.close();
  }
  { // 10. Texte wie Datenschutz §5: was bleibt (Stripe-Kundennummer, 90 Tage) und die Mitloeschungen, de und en
    const { k, z } = await umgebung();
    const de = await seite(k, z, DE);
    const tde = await de.locator('main').textContent();
    pruefe('de: „Was bleibt“ nennt Stripe-Kundennummer und 90 Tage', /Stripe-Kundennummer/.test(tde) && /90 Tag/.test(tde));
    pruefe('de: Mitloeschungen aus §5 genannt', ['Visitenkarte', 'Kronen', 'Rätsel-Duell', 'Online-Partien', 'Schulmodus', 'Altersangabe'].every((w) => tde.includes(w)));
    const en = await seite(k, z, EN);
    const ten = await en.locator('main').textContent();
    pruefe('en: „What stays“ nennt Stripe customer number und 90 days', /Stripe customer number/.test(ten) && /90 days/.test(ten));
    pruefe('en: Mitloeschungen aus §5 genannt', ['player card', 'crowns', 'puzzle duel', 'online games', 'school mode', 'age statement'].every((w) => ten.toLowerCase().includes(w)));
    await bild(de, '10-texte-de');
    await bild(en, '10-texte-en');
    await k.close();
  }
  { // 11. Waehrend der Loeschung sind Abbrechen, Weiter und Abmelden gesperrt; nach Serverfehler folgt der Knopf dem Feld
    const { k, z } = await umgebung({ rpcMs: 1200, rpc: { status: 500, body: { message: 'boom' } }, lokal: { 'schach-arena:konto:sitzung': JSON.stringify(SITZUNG) } });
    const s = await seite(k, z, DE);
    await s.locator('[data-kl="weiter"]').click();
    await s.locator('.kl-bestaetigen').fill('LÖSCHEN');
    await s.locator('[data-kl="loeschen"]').click(); await s.waitForTimeout(100);
    const gesperrt = await s.evaluate(() => ['abbrechen', 'weiter', 'abmelden'].map((k) => document.querySelector(`[data-kl="${k}"]`).disabled));
    await s.locator('[data-kl="abbrechen"]').click({ timeout: 500 }).catch(() => {});
    await s.locator('[data-kl="weiter"]').click({ timeout: 500, force: true }).catch(() => {});
    // das Feld ist gesperrt, also leert der Test es von aussen: nach dem Fehler muss der Knopf dem leeren Feld folgen
    await s.evaluate(() => { document.querySelector('.kl-bestaetigen').value = ''; });
    await s.waitForTimeout(1800);
    pruefe('Waehrend der Loeschung: Abbrechen, Weiter und Abmelden gesperrt', gesperrt.every(Boolean), gesperrt);
    await bild(s, '11-nach-serverfehler');
    pruefe('Nach Serverfehler mit leerem Feld: Loeschknopf gesperrt, Schritt 2 offen, Abbrechen wieder frei',
      (await s.locator('[data-kl="loeschen"]').isDisabled()) && (await sichtbar(s, '.kl-schritt2')) && !(await s.locator('[data-kl="abbrechen"]').isDisabled()));
    await s.locator('[data-kl="loeschen"]').click({ timeout: 500 }).catch(() => {});
    await s.waitForTimeout(300);
    pruefe('Nach Serverfehler ohne Wort: kein zweites konto_loeschen', z.aufrufe.loeschen === 1, z.aufrufe);
    await s.locator('.kl-bestaetigen').fill('LÖSCHEN');
    pruefe('Nach Serverfehler: Wort wieder getippt gibt den Knopf frei', !(await s.locator('[data-kl="loeschen"]').isDisabled()));
    await k.close();
  }
  { // 12. Server lehnt ein lokal gueltiges Token ab (401 PGRST301): einmal erneuern, einmal wiederholen
    const abgelehnt = { status: 401, body: { code: 'PGRST301', message: 'JWT expired' } };
    // nochmal: zweiter Klick nach dem Fehler (Dauerfeuer-Probe); bleibt die Seite angemeldet, ist er ein neuer Versuch
    // sitz: die Sitzung im Geraet vor dem Laden (Standard: lokal noch gueltig)
    const lauf = async (opt, adresse = DE, nochmal = true, sitz = SITZUNG, name = null) => {
      const { k, z } = await umgebung({ ...opt, lokal: { 'schach-arena:konto:sitzung': JSON.stringify(sitz) } });
      const s = await seite(k, z, adresse);
      const T = await s.evaluate(() => JSON.parse(document.getElementById('kl-texte').textContent));
      await s.locator('[data-kl="weiter"]').click();
      await s.locator('.kl-bestaetigen').fill(T.wort);
      await s.locator('[data-kl="loeschen"]').click(); await s.waitForTimeout(800);
      if (nochmal) await s.locator('[data-kl="loeschen"]').click({ timeout: 500 }).catch(() => {});
      await s.waitForTimeout(300);
      const r = { z, st: await status(s), fertig: await sichtbar(s, '.kl-fertig'), anmelden: await sichtbar(s, '.kl-anmelden'),
        angemeldet: await sichtbar(s, '.kl-angemeldet'), sitzung: await sitzungDa(s), T,
        frei: await sichtbar(s, '[data-kl="loeschen"]') && !(await s.locator('[data-kl="loeschen"]').isDisabled()) };
      if (name) await bild(s, `12-${name}`);
      await k.close();
      return r;
    };
    const a = await lauf({ rpc: [abgelehnt, null] }, DE, true, SITZUNG, 'refresh-klappt');
    pruefe('401, Refresh klappt: erneuert, zweiter Versuch loescht, Bestaetigung sichtbar',
      a.fertig && !a.sitzung && a.z.aufrufe.token === 1 && a.z.aufrufe.loeschen === 2, { aufrufe: a.z.aufrufe, st: a.st });
    const b = await lauf({ rpc: abgelehnt, token: { status: 400, body: { code: 400, error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token' } } }, DE, true, SITZUNG, 'refresh-tot');
    pruefe('401, Refresh tot: lokal abgemeldet, Anmeldung sichtbar, Fehlertext, kein weiterer rpc',
      b.anmelden && !b.angemeldet && !b.sitzung && b.st.fehler === 'ja' && b.z.aufrufe.token === 1 && b.z.aufrufe.loeschen === 1, { aufrufe: b.z.aufrufe, st: b.st });
    // Kaltreview loeschseite-2, Hinweis 2: der Text sagt, dass die Anmeldung abgelaufen ist (de und en)
    pruefe('401, Refresh tot: Text "abgelaufen"', /abgelaufen/i.test(b.st.text), b.st);
    const bEn = await lauf({ rpc: abgelehnt, token: { status: 400, body: { code: 400, error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token' } } }, EN);
    pruefe('en: 401, Refresh tot: lokal abgemeldet, Text "expired"', !bEn.sitzung && bEn.anmelden && /expired/i.test(bEn.st.text), bEn.st);
    // R17: totes Refresh-Token im alten Format (error invalid_grant, kein error_code) wie oben, de und en
    const TOT_ALT = { status: 400, body: { error: 'invalid_grant', error_description: 'Invalid Refresh Token: Refresh Token Not Found' } };
    for (const [name, adresse, wort] of [['de', DE, /abgelaufen/i], ['en', EN, /expired/i]]) {
      const b2 = await lauf({ rpc: abgelehnt, token: TOT_ALT }, adresse);
      pruefe(`${name}: 401, Refresh tot (invalid_grant): lokal abgemeldet, Anmeldung sichtbar, Text abgelaufen, kein Server-Text, kein weiterer rpc`,
        b2.anmelden && !b2.angemeldet && !b2.sitzung && b2.st.fehler === 'ja' && wort.test(b2.st.text) && !/invalid|Refresh Token|Serverfehler|Server error/i.test(b2.st.text)
        && b2.z.aufrufe.token === 1 && b2.z.aufrufe.loeschen === 1, { aufrufe: b2.z.aufrufe, st: b2.st });
    }
    const c = await lauf({ rpc: [abgelehnt, abgelehnt] }, DE, true, SITZUNG, 'zweimal-abgelehnt');
    pruefe('401, Refresh klappt, wieder 401: lokal abgemeldet, Anmeldung sichtbar, genau zwei rpc',
      c.anmelden && !c.angemeldet && !c.sitzung && c.st.fehler === 'ja' && c.z.aufrufe.token === 1 && c.z.aufrufe.loeschen === 2, { aufrufe: c.z.aufrufe, st: c.st });
    pruefe('401, Refresh klappt, wieder 401: eigener Text (neu anmelden, Mail-Weg), nicht "abgelaufen"',
      !!c.T.abgelehnt && c.st.text === c.T.abgelehnt, { st: c.st, soll: c.T.abgelehnt });
    // Kaltreview Runde 3, Befund 1: scheitert die Erneuerung nur am Netz, ist das Refresh-Token noch gut
    const d = await lauf({ rpc: abgelehnt, token: { abbruch: true } }, DE, false);
    pruefe('401, Refresh offline: bleibt angemeldet, Verbindungstext, kein Abmelden, kein zweiter rpc',
      d.angemeldet && !d.anmelden && d.sitzung && !!d.T.offline && d.st.text === d.T.offline && d.st.fehler === 'ja'
        && d.z.aufrufe.token === 1 && d.z.aufrufe.loeschen === 1 && d.z.aufrufe.logout === 0, { aufrufe: d.z.aufrufe, st: d.st });
    pruefe('401, Refresh offline: Loeschknopf mit Wort wieder frei', d.frei);
    const e = await lauf({ rpc: abgelehnt, token: { abbruch: true } }, EN, false);
    pruefe('en: 401, Refresh offline: englischer Verbindungstext, angemeldet',
      e.angemeldet && e.sitzung && /connection/i.test(e.T.offline || '') && e.st.text === e.T.offline, { st: e.st });
    // Kurz-Review loeschseite-3 (13:15): Erneuerung klappt, erst der zweite Loeschaufruf scheitert am Netz. Das frische
    // Token ist gut, also kein Abmelden und nicht der Text fuer "abgelehnt", sondern der eigene Verbindungstext
    for (const [name, adresse] of [['de', DE], ['en', EN]]) {
      const n = await lauf({ rpc: [abgelehnt, { abbruch: true }] }, adresse, false);
      pruefe(`${name}: 401, Refresh klappt, zweiter Aufruf offline: angemeldet, eigener Verbindungstext, kein Abmelden`,
        n.angemeldet && !n.anmelden && n.sitzung && n.st.text === n.T.offline && n.st.fehler === 'ja' && n.frei
          && n.z.aufrufe.token === 1 && n.z.aufrufe.loeschen === 2 && n.z.aufrufe.logout === 0,
        { aufrufe: n.z.aufrufe, st: n.st, soll: n.T.offline });
    }
    const f = await lauf({ rpc: [abgelehnt, abgelehnt] }, EN);
    pruefe('en: 401, Refresh klappt, wieder 401: englischer eigener Text',
      /sign in again/i.test(f.T.abgelehnt || '') && f.st.text === f.T.abgelehnt && !f.sitzung, { st: f.st });
    // Kaltreview loeschseite-2, Hinweis 3: ohne Netz zeigt die Seite ihren eigenen Verbindungstext, nicht den der
    // Einstellungen ("Die App funktioniert weiter offline") oder der Datenseite. Lokal schon abgelaufene Sitzung: die
    // Erneuerung scheitert vor dem Loeschaufruf; frische Sitzung: der Loeschaufruf selbst scheitert am Netz
    for (const [name, adresse] of [['de', DE], ['en', EN]]) {
      const g = await lauf({ token: { abbruch: true } }, adresse, false, { ...SITZUNG, expires_at: 1 });
      pruefe(`${name}: lokal abgelaufen und offline: eigener Verbindungstext der Seite, angemeldet, kein Loeschaufruf`,
        g.st.text === g.T.offline && g.st.fehler === 'ja' && g.angemeldet && g.sitzung && g.z.aufrufe.loeschen === 0 && g.frei,
        { st: g.st, soll: g.T.offline, aufrufe: g.z.aufrufe });
      const h = await lauf({ rpc: { abbruch: true } }, adresse, false);
      pruefe(`${name}: Loeschaufruf offline: eigener Verbindungstext der Seite, angemeldet, genau ein Aufruf`,
        h.st.text === h.T.offline && h.st.fehler === 'ja' && h.angemeldet && h.sitzung && h.z.aufrufe.loeschen === 1 && h.frei,
        { st: h.st, soll: h.T.offline, aufrufe: h.z.aufrufe });
    }
  }
} finally {
  await browser.close(); server.close();
}
// INTENTIONAL-SLOP[T4]: Zusammenfassung der Probe, Ausgabeweg wie alle Zeilen hier
if (BILDER) pruefe(`Bilder abgelegt: ${bilderListe.length}`, bilderListe.length > 0 && bilderListe.every((d) => existsSync(d)), bilderListe.filter((d) => !existsSync(d)));
console.log(`${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
