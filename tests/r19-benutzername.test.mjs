// R19 Benutzername (Flo 15.11.2026: "Der Benutzername ist nicht fest ... irgendwie schwammig"): der Name, den sich das Geraet
// gemerkt hat (js/konto.js NAME_SCHLUESSEL), muss beim App-Start mit dem Server abgeglichen werden. Vorher fragte app.js
// pruefeName den Server nur, solange KEIN Merker da war: ein auf einem anderen Geraet geaenderter Name blieb auf Profilkarte,
// Partie und Duell-Intro fuer immer der alte, waehrend Liga, Freunde und Online den neuen vom Server zeigten.
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

// App mit gefaelschtem Server: GET /rest/v1/profile antwortet mit `profil` (oder dem Status `status`), POST mit `post`
// ({ status, body }, Vorgabe 201), alles andere leer. ziel: '#ich' (Profilkarte) oder '#einstellungen' (Konto-Gruppe).
async function seite(browser, { profil, status = 200, post = null, ziel = '#ich' }) {
  const k = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', timezoneId: 'Europe/Berlin' });
  const s = await k.newPage();
  const fehler = []; const profilAnfragen = []; const posts = [];
  s.on('pageerror', (e) => fehler.push(e.message));
  await s.route(SUPA + '/**', async (r) => {
    const u = r.request().url();
    if (u.includes('/rest/v1/profile') && r.request().method() === 'POST') {
      posts.push(r.request().postData());
      const x = post || { status: 201, body: null };
      return r.fulfill({ status: x.status, contentType: 'application/json', body: x.body === null ? '' : JSON.stringify(x.body) });
    }
    if (u.includes('/rest/v1/profile')) {
      profilAnfragen.push(u);
      return r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(status < 400 ? profil : { message: 'aus' }) });
    }
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await s.addInitScript(({ sitzung, merker, id }) => {
    try {
      if (sessionStorage.getItem('probe-start')) return;
      sessionStorage.setItem('probe-start', '1');
      localStorage.clear();
      localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(sitzung));
      localStorage.setItem(merker, JSON.stringify({ konto: id, name: 'alt_name' }));
      localStorage.setItem('schach-arena:konto:sichtbar', '1');
    } catch (e) { /* egal */ }
  }, { sitzung: SITZUNG, merker: MERKER, id: ID });
  await s.goto(BASIS + ziel);
  if (ziel !== '#ich') {
    await s.waitForSelector('.konto-name', { timeout: 30000 });
    await warte(1500);
    return { k, s, fehler, profilAnfragen, posts };
  }
  await s.waitForSelector('.pr-karte', { timeout: 30000 });
  await warte(400);
  // beim Start gebuchte Stufen zeigt "Ich" als Freischalt-Moment; wegtippen wie ein Spieler
  for (let i = 0; i < 12 && await s.locator('.st-moment .st-weiter').count(); i++) { await s.locator('.st-moment .st-weiter').first().click(); await warte(250); }
  await warte(1500);
  return { k, s, fehler, profilAnfragen, posts };
}
const konto = (s) => s.evaluate(() => {
  const f = document.querySelector('.konto-name'); const h = document.querySelector('.konto-name-sperre');
  return { wert: f?.value, nurLesen: !!f?.readOnly, sperre: h && !h.hidden ? h.textContent.trim() : '',
    status: document.querySelector('.konto-status')?.textContent.trim() || '' };
});
const karte = (s) => s.locator('.pr-name b').innerText();
const merker = (s) => s.evaluate((k) => { try { return JSON.parse(localStorage.getItem(k)).name; } catch (e) { return null; } }, MERKER);

async function browserTeil() {
  const pw = ladePlaywright();
  const server = spawn(process.execPath, ['tests/testserver.mjs', String(PORT), '--bind', '127.0.0.1'], { cwd: WURZEL, stdio: 'ignore' });
  let browser;
  try {
    await warteAufServer(`http://127.0.0.1:${PORT}/index.html`);
    browser = await pw.chromium.launch();

    // 1) Name auf einem anderen Geraet geaendert: der Server gilt, auch wenn das Geraet einen Namen gemerkt hat
    let p = await seite(browser, { profil: [{ user_id: ID, benutzername: 'neu_name' }] });
    pruefe('Server-Name gilt beim Start: Profilkarte zeigt "neu_name" statt des gemerkten "alt_name"', await karte(p.s) === 'neu_name', await karte(p.s));
    pruefe('Der Merker auf dem Geraet steht danach auf "neu_name"', await merker(p.s) === 'neu_name', await merker(p.s));
    await p.s.evaluate(() => window.__app.gehe('partie', { botId: 'benno', farbe: 'w' }));
    await p.s.waitForSelector('.screen.partie .spieler.ich .name', { timeout: 15000 });
    const partie = await p.s.locator('.screen.partie .spieler.ich .name').innerText();
    pruefe('Auch die Partie zeigt "neu_name"', partie === 'neu_name', partie);
    await p.s.evaluate(() => window.__app.gehe('ich'));
    await warte(800);
    pruefe('Ein Abgleich je Start, nicht bei jedem Seitenwechsel (hoechstens 1 Profil-Anfrage)', p.profilAnfragen.length === 1, p.profilAnfragen.length);
    pruefe('Abgleich: keine Seitenfehler', p.fehler.length === 0, p.fehler.join(' | '));
    await p.k.close();

    // 2) Server nicht erreichbar: der gemerkte Name bleibt, nichts stuerzt ab
    p = await seite(browser, { profil: null, status: 503 });
    pruefe('Ohne Server bleibt der gemerkte Name "alt_name"', await karte(p.s) === 'alt_name' && await merker(p.s) === 'alt_name', await karte(p.s));
    pruefe('Ohne Server: keine Seitenfehler', p.fehler.length === 0, p.fehler.join(' | '));
    await p.k.close();

    // 3) Server und Geraet einig: es bleibt beim Namen, keine Aenderung
    p = await seite(browser, { profil: [{ user_id: ID, benutzername: 'alt_name' }] });
    pruefe('Gleicher Name: Profilkarte bleibt "alt_name"', await karte(p.s) === 'alt_name', await karte(p.s));
    await p.k.close();

    // 4) Monats-Sperre laeuft (supabase/benutzername-sperre-schema.sql eingespielt): Konto zeigt das Datum, Feld nur lesbar
    const gestern = new Date(Date.now() - 86400000);
    const ab = new Date(gestern.getTime() + 30 * 86400000).toLocaleDateString('de-DE');
    p = await seite(browser, { profil: [{ user_id: ID, benutzername: 'alt_name', name_geaendert_am: gestern.toISOString() }], ziel: '#einstellungen' });
    let kn = await konto(p.s);
    pruefe(`Sperre: Konto zeigt "Nächste Änderung ab ${ab}", Feld nur lesbar`, kn.sperre === `Nächste Änderung ab ${ab}` && kn.nurLesen && kn.wert === 'alt_name', kn);
    await p.s.locator('[data-konto="sichern"]').click();
    await warte(1200);
    pruefe('Sperre: "Jetzt sichern" schickt den unveraenderten Namen nicht', p.posts.length === 0, p.posts);
    pruefe('Sperre: keine Seitenfehler', p.fehler.length === 0, p.fehler.join(' | '));
    await p.k.close();

    // 5) ohne eingespieltes SQL (Feld fehlt) und mit abgelaufener Frist: kein Hinweis, Feld frei
    for (const [was, profil] of [['ohne SQL', { user_id: ID, benutzername: 'alt_name' }],
      ['Frist abgelaufen', { user_id: ID, benutzername: 'alt_name', name_geaendert_am: new Date(Date.now() - 31 * 86400000).toISOString() }]]) {
      p = await seite(browser, { profil: [profil], ziel: '#einstellungen' });
      kn = await konto(p.s);
      pruefe(`${was}: kein Sperr-Hinweis, Feld frei`, kn.sperre === '' && !kn.nurLesen, kn);
      pruefe(`${was}: keine Seitenfehler`, p.fehler.length === 0, p.fehler.join(' | '));
      await p.k.close();
    }

    // 6) Der Server lehnt ab (Sperre von einem anderen Geraet aus, App wusste es nicht): klare Meldung mit Datum
    p = await seite(browser, { profil: [{ user_id: ID, benutzername: 'alt_name' }], ziel: '#einstellungen',
      post: { status: 400, body: { code: 'P0001', message: 'NAME_GESPERRT', details: '2026-12-15T10:00:00Z', hint: null } } });
    await p.s.locator('.konto-name').fill('ganz_neu');
    await p.s.locator('[data-konto="sichern"]').click();
    await warte(1200);
    kn = await konto(p.s);
    const datum = new Date('2026-12-15T10:00:00Z').toLocaleDateString('de-DE');
    pruefe('Abgelehnt: Meldung nennt die 30 Tage und das Datum', kn.status === `Den Benutzernamen kannst du einmal in 30 Tagen ändern. Nächste Änderung ab ${datum}.`, kn);
    pruefe('Abgelehnt: der Merker bleibt beim alten Namen', await merker(p.s) === 'alt_name', await merker(p.s));
    pruefe('Abgelehnt: genau ein POST mit dem neuen Namen', p.posts.length === 1 && /ganz_neu/.test(p.posts[0] || ''), p.posts);
    await p.k.close();
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
}

await browserTeil();
console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
