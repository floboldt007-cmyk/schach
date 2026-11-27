// R27 Benutzername mit gruenem Haken (Flo 21.11.2026, supabase/benutzername-bestaetigt-schema.sql): in den Einstellungen
// prueft die App beim Tippen, ob der Name frei ist; "Bestaetigen" erst bei gueltigem, freiem Namen; vorher eine Rueckfrage
// in der App ("30 Tage nicht aendern"); danach Haken und "Bestaetigt"; gesperrt ein graues Feld mit Datum und Tagen.
// Ohne Haken-SQL (kein name_bestaetigt im Profil) bleibt alles wie vorher. Server gefaelscht per page.route.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || await (await import('./freier-port.mjs')).freierPort();
const BASIS = `http://127.0.0.1:${PORT}/index.html?test`;
const SUPA = 'https://usaamcqypmvgqmsbfecb.supabase.co';
const warte = (ms) => new Promise((r) => setTimeout(r, ms));
let ok = 0, gesamt = 0;
function pruefe(name, wert, extra = '') { gesamt++; if (wert) { ok++; console.log('ok   ' + name); } else console.error('FEHLER ' + name, extra); }

function ladePlaywright() {
  for (const k of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
    try { return require(k); } catch (e) { /* naechster */ }
  }
  throw new Error('Playwright nicht gefunden (PLAYWRIGHT_PFAD setzen)');
}
async function warteAufServer(url, ms = 10000) {
  const ende = Date.now() + ms;
  while (Date.now() < ende) {
    try { const r = await fetch(url); await r.arrayBuffer(); if (r.ok) return; } catch (e) { /* noch nicht da */ }
    await warte(150);
  }
  throw new Error('Server startet nicht: ' + url);
}

const ID = '0f8b6c1e-2d3a-4b5c-8d9e-0a1b2c3d4e5f';
const SITZUNG = { access_token: 'a.' + Buffer.from(JSON.stringify({ sub: ID })).toString('base64url') + '.x', refresh_token: 'r1',
  expires_at: 9999999999, user: { id: ID, email: 'probe@example.invalid' } };
const MERKER = 'schach-arena:konto:name';

// profil: Antwort auf GET /rest/v1/profile (Liste); nach einem POST antwortet GET mit profilDanach. frei: Name -> boolean
// fuer rpc/name_frei. modus: 'hell' oder 'dunkel'. rpcFehlt: name_frei und bestaetigte_namen gibt es am Server nicht
// (404 PGRST202, wie live vor dem Einspielen von supabase/benutzername-bestaetigt-schema.sql).
async function seite(browser, { profil, profilDanach = null, frei = {}, modus = 'hell', breite = 390, hakenNamen = [], rpcFehlt = false }) {
  const k = await browser.newContext({ viewport: { width: breite, height: 844 }, serviceWorkers: 'block', timezoneId: 'Europe/Berlin',
    colorScheme: modus === 'dunkel' ? 'dark' : 'light', locale: 'de-DE' });
  const s = await k.newPage();
  const fehler = []; const posts = []; const freiFragen = []; const hakenFragen = [];
  let gepostet = false;
  s.on('pageerror', (e) => fehler.push(e.message));
  await s.route(SUPA + '/**', async (r) => {
    const u = r.request().url();
    const json = (body, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    const fehlt = () => json({ code: 'PGRST202', message: 'Could not find the function' }, 404);
    if (u.includes('/rest/v1/rpc/name_frei')) {
      const n = JSON.parse(r.request().postData() || '{}').name; freiFragen.push(n);
      return rpcFehlt ? fehlt() : json(n in frei ? frei[n] : true);
    }
    if (u.includes('/rest/v1/rpc/bestaetigte_namen')) {
      hakenFragen.push(JSON.parse(r.request().postData() || '{}').namen); return rpcFehlt ? fehlt() : json(hakenNamen);
    }
    if (u.includes('/rest/v1/profile') && r.request().method() === 'POST') {
      posts.push(JSON.parse(r.request().postData() || '{}')); gepostet = true;
      return r.fulfill({ status: 201, contentType: 'application/json', body: '' });
    }
    if (u.includes('/rest/v1/profile')) return json(gepostet && profilDanach ? profilDanach : profil);
    if (u.includes('/rest/v1/spielstaende')) return json([]);
    return json({});
  });
  await s.addInitScript(({ sitzung, merker, id, name }) => {
    try {
      if (sessionStorage.getItem('probe-start')) return;
      sessionStorage.setItem('probe-start', '1');
      localStorage.clear();
      localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(sitzung));
      if (name) localStorage.setItem(merker, JSON.stringify({ konto: id, name }));
      localStorage.setItem('schach-arena:konto:sichtbar', '1');
    } catch (e) { /* egal */ }
  }, { sitzung: SITZUNG, merker: MERKER, id: ID, name: profil?.[0]?.benutzername || null });
  await s.goto(BASIS + '#einstellungen');
  await s.waitForFunction(() => window.__app && window.__app.gehe, null, { timeout: 30000 });
  await s.evaluate(() => window.__app.gehe('einstellungen', { seite: 'konto' }));
  await s.waitForSelector('.konto-name', { timeout: 30000 });
  await warte(1500);
  return { k, s, fehler, posts, freiFragen, hakenFragen };
}
const stand = (s) => s.evaluate(() => {
  const q = (x) => document.querySelector(x);
  const sichtbar = (x) => !!q(x) && !q(x).hidden && getComputedStyle(q(x)).display !== 'none';
  const knopf = q('[data-konto="name"]');
  return { wert: q('.konto-name')?.value, nurLesen: !!q('.konto-name')?.readOnly, grau: q('.konto-name')?.classList.contains('gesperrt'),
    haken: sichtbar('.konto-name-haken'), hakenText: q('.konto-name-haken')?.textContent.trim(),
    knopfDa: sichtbar('.konto-name-knopf'), knopfAn: !!knopf && !knopf.disabled,
    pruef: q('.konto-name-pruef')?.textContent.trim() || '', pruefArt: q('.konto-name-pruef')?.dataset.art || '',
    sperre: sichtbar('.konto-name-sperre') ? q('.konto-name-sperre').textContent.trim() : '' };
});
const tippe = async (s, wert) => { await s.locator('.konto-name').fill(wert); await warte(900); };

async function browserTeil() {
  const pw = ladePlaywright();
  const server = spawn(process.execPath, ['tests/testserver.mjs', String(PORT), '--bind', '127.0.0.1'], { cwd: WURZEL, stdio: 'ignore' });
  let browser;
  try {
    await warteAufServer(`http://127.0.0.1:${PORT}/index.html`);
    browser = await pw.chromium.launch();

    // 1) eigener, bestaetigter Name, keine Sperre: Haken und "Bestaetigt", kein Knopf
    let p = await seite(browser, { profil: [{ user_id: ID, benutzername: 'anna_eins', name_bestaetigt: true, name_geaendert_am: null }] });
    let z = await stand(p.s);
    pruefe('Bestaetigter Name: Haken mit "Bestätigt" sichtbar', z.haken && z.hakenText === 'Bestätigt', z);
    pruefe('Bestaetigter Name: kein Bestaetigen-Knopf', !z.knopfDa, z);

    // 2) Tippen: ungueltig, vergeben, frei
    await tippe(p.s, 'ab');
    z = await stand(p.s);
    pruefe('Zu kurz: Regel-Hinweis, kein Knopf im Feld, kein Haken', /3 bis 20 Zeichen/.test(z.pruef) && z.pruefArt === 'fehler' && !z.knopfDa && !z.knopfAn && !z.haken, z);
    pruefe('Zu kurz: der Server wird nicht gefragt', p.freiFragen.length === 0, p.freiFragen);
    await p.k.close();
    p = await seite(browser, { profil: [{ user_id: ID, benutzername: 'anna_eins', name_bestaetigt: true, name_geaendert_am: null }],
      frei: { schon_weg: false, ganz_neu: true },
      profilDanach: [{ user_id: ID, benutzername: 'ganz_neu', name_bestaetigt: true, name_geaendert_am: new Date().toISOString() }] });
    await tippe(p.s, 'schon_weg');
    z = await stand(p.s);
    pruefe('Vergeben: "schon vergeben", Knopf aus', z.pruef === 'Dieser Benutzername ist schon vergeben.' && !z.knopfAn, z);
    await tippe(p.s, 'ganz_neu');
    z = await stand(p.s);
    pruefe('Frei: "Der Name ist frei" mit Haken, Knopf im Feld an', z.pruef === 'Der Name ist frei' && z.knopfDa && z.knopfAn, z);

    // 3) Rueckfrage: Abbrechen schickt nichts
    await p.s.locator('[data-konto="name"]').click();
    const dialog = p.s.locator('.dialog[role="alertdialog"]');
    await dialog.waitFor({ timeout: 5000 });
    const text = await dialog.innerText();
    pruefe('Rueckfrage in der App nennt Namen und 30 Tage', /ganz_neu/.test(text) && /30 Tage nicht ändern/.test(text), text);
    pruefe('Kein Browser-Dialog (alert/confirm)', !(await p.s.evaluate(() => window.__browserDialog)), '');
    await p.s.locator('.dialog-knoepfe button', { hasText: 'Zurück' }).click({ timeout: 5000 });
    await warte(600);
    pruefe('Abgebrochen (Knopf Zurück): kein POST', p.posts.length === 0, p.posts);

    // 4) Bestaetigen: genau ein POST mit Haken, danach Haken und Sperre mit Tagen, Feld grau
    await p.s.locator('[data-konto="name"]').click();
    await p.s.locator('.dialog-knoepfe button', { hasText: 'Bestätigen' }).click({ timeout: 5000 });
    await warte(1500);
    z = await stand(p.s);
    pruefe('Bestaetigt: genau ein POST mit name_bestaetigt true', p.posts.length === 1 && p.posts[0].benutzername === 'ganz_neu' && p.posts[0].name_bestaetigt === true, p.posts);
    const ab = new Date(Date.now() + 30 * 86400000).toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin' });
    pruefe(`Danach: Haken, Feld grau und nur lesbar, "Nächste Änderung ab ${ab} (noch 30 Tage)"`,
      z.haken && z.nurLesen && z.grau && z.sperre === `Nächste Änderung ab ${ab} (noch 30 Tage)` && !z.knopfDa, z);
    pruefe('Ablauf: keine Seitenfehler', p.fehler.length === 0, p.fehler.join(' | '));
    await p.k.close();

    // 5) vom Server vergebener Name (kein Haken): "Bestaetigen" fuer den gleichen Namen
    p = await seite(browser, { profil: [{ user_id: ID, benutzername: 'spieler_c', name_bestaetigt: false, name_geaendert_am: null }] });
    z = await stand(p.s);
    pruefe('Vergebener Name: kein Haken, Bestaetigen an', !z.haken && z.knopfDa && z.knopfAn, z);
    await p.k.close();

    // 6) ohne Haken-SQL (kein name_bestaetigt im Profil): kein Haken, kein Knopf, POST ohne name_bestaetigt
    p = await seite(browser, { profil: [{ user_id: ID, benutzername: 'alt_name' }], frei: {} });
    z = await stand(p.s);
    pruefe('Ohne SQL: kein Haken, kein Knopf beim eigenen Namen', !z.haken && !z.knopfDa, z);
    await tippe(p.s, 'neu_ohne');
    await p.s.locator('[data-konto="name"]').click();
    await p.s.locator('.dialog-knoepfe button', { hasText: 'Bestätigen' }).click({ timeout: 5000 });
    await warte(1200);
    pruefe('Ohne SQL: POST ohne name_bestaetigt (PostgREST kennte die Spalte nicht)', p.posts.length === 1 && !('name_bestaetigt' in p.posts[0]), p.posts);
    pruefe('Ohne SQL: keine Seitenfehler', p.fehler.length === 0, p.fehler.join(' | '));
    await p.k.close();

    // 6b) Kaltreview #268: "kein Haken" eines Gegners gilt nur 10 Minuten, ein Haken bleibt
    const namen = [];
    p = await seite(browser, { profil: [{ user_id: ID, benutzername: 'anna_eins', name_bestaetigt: true, name_geaendert_am: null }], hakenNamen: namen });
    const frage = () => p.s.evaluate(async () => [...(await (await import('/js/konto.js')).bestaetigteNamen(['gegner_x']))]);
    const vorher = p.hakenFragen.length;
    const r1 = await frage();
    const r2 = await frage();
    pruefe('Haken fremder Namen: ohne Haken einmal gefragt, dann gemerkt', !r1.includes('gegner_x') && !r2.includes('gegner_x') && p.hakenFragen.length === vorher + 1, { r1, r2, n: p.hakenFragen.length });
    namen.push('gegner_x');
    await p.s.evaluate(() => { const echt = Date.now; Date.now = () => echt() + 11 * 60 * 1000; });
    const r3 = await frage();
    pruefe('Nach 10 Minuten neu gefragt: der inzwischen bestaetigte Gegner hat den Haken', r3.includes('gegner_x') && p.hakenFragen.length === vorher + 2, { r3, n: p.hakenFragen.length });
    await p.s.evaluate(() => { const echt = Date.now; Date.now = () => echt() + 60 * 60 * 1000; });
    await frage();
    pruefe('Ein Haken bleibt ohne neue Frage', p.hakenFragen.length === vorher + 2, p.hakenFragen.length);
    await p.k.close();

    // 6c) live vor dem Einspielen: keine Spalte name_bestaetigt UND name_frei/bestaetigte_namen fehlen (404 PGRST202).
    // Die App faellt still auf den alten Stand zurueck: kein Haken, kein "vergeben", der Knopf erscheint (der Server
    // entscheidet beim Speichern), Speichern ohne name_bestaetigt, fremde Namen ohne Haken und ohne Fehler, kein Haenger.
    p = await seite(browser, { profil: [{ user_id: ID, benutzername: 'alt_name' }], rpcFehlt: true });
    z = await stand(p.s);
    pruefe('Funktionen fehlen: kein Haken, kein Knopf beim eigenen Namen', !z.haken && !z.knopfDa, z);
    await tippe(p.s, 'neu_ohne_rpc');
    z = await stand(p.s);
    pruefe('Funktionen fehlen: nach dem Tippen erscheint "Bestaetigen", nichts als vergeben gemeldet, kein "pruefe" stehen geblieben',
      z.knopfDa && z.knopfAn && z.pruefArt !== 'fehler' && p.freiFragen.includes('neu_ohne_rpc'), { ...z, fragen: p.freiFragen });
    await p.s.locator('[data-konto="name"]').click();
    await p.s.locator('.dialog-knoepfe button', { hasText: 'Bestätigen' }).click({ timeout: 5000 });
    await warte(1200);
    pruefe('Funktionen fehlen: gespeichert, POST ohne name_bestaetigt', p.posts.length === 1 && p.posts[0].benutzername === 'neu_ohne_rpc'
      && !('name_bestaetigt' in p.posts[0]), p.posts);
    const fremde = await p.s.evaluate(async () => {
      try { return { ok: true, namen: [...(await (await import('/js/konto.js')).bestaetigteNamen(['gegner_y']))] }; } catch (e) { return { ok: false, e: String(e) }; }
    });
    pruefe('Funktionen fehlen: fremde Namen ohne Haken, kein Fehler', fremde.ok && fremde.namen.length === 0 && p.hakenFragen.length >= 1, fremde);
    pruefe('Funktionen fehlen: keine Seitenfehler', p.fehler.length === 0, p.fehler.join(' | '));
    await p.k.close();

    // 7) Bilder fuer den Bericht, hell und dunkel: gesperrt mit Haken
    if (process.env.BILDER) {
      for (const modus of ['hell', 'dunkel']) {
        p = await seite(browser, { modus, profil: [{ user_id: ID, benutzername: 'anna_eins', name_bestaetigt: true,
          name_geaendert_am: new Date(Date.now() - 4 * 86400000).toISOString() }] });
        await p.s.locator('.konto-gruppe').screenshot({ path: path.join(process.env.BILDER, `konto-gesperrt-${modus}.png`) });
        await p.k.close();
        p = await seite(browser, { modus, profil: [{ user_id: ID, benutzername: 'anna_eins', name_bestaetigt: true, name_geaendert_am: null }] });
        await tippe(p.s, 'ganz_neu');
        await p.s.locator('.konto-gruppe').screenshot({ path: path.join(process.env.BILDER, `konto-frei-${modus}.png`) });
        await p.s.locator('[data-konto="name"]').click();
        await warte(500);
        await p.s.screenshot({ path: path.join(process.env.BILDER, `konto-rueckfrage-${modus}.png`) });
        await p.k.close();
      }
    }
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
}

await browserTeil();
console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
