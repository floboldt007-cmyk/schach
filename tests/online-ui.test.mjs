// Netzwerk ausschliesslich simuliert: kein Test schreibt ins echte Supabase-Projekt.
import http from 'node:http';
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Chess } from '../vendor/chess/chess.js';
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
await new Promise(r => server.listen(8887, '127.0.0.1', r));
const sitzung = { access_token: 'a.' + Buffer.from(JSON.stringify({ sub: 'u1' })).toString('base64url') + '.x', refresh_token: 'test-r', expires_at: 9999999999, user: { id: 'u1', email: 'spieler@example.invalid' } };
let browser, kontext, ok = 0, gesamt = 0, stamp = Date.now(), nummer = 0, ablehnen = false;
const partien = new Map(), calls = [], fehler = [], unerwartet = [];
const aktualisieren = p => { p.aktualisiert_am = new Date(++stamp).toISOString(); return p; };
function partie({ farbe = 'w', status = 'laeuft', zuege = '', zeit = null, code = 'ABC234' } = {}) {
  const c = new Chess(); for (const u of zuege.split(' ').filter(Boolean)) c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
  const p = aktualisieren({ id: 'partie-' + ++nummer, code, weiss: farbe === 'w' ? 'u1' : 'u2', schwarz: farbe === 'b' ? 'u1' : 'u2', erstellt_von: 'u1',
    status, fen: c.fen(), am_zug: c.turn(), zuege, ergebnis: null, grund: null, remis_angebot: null, bedenkzeit_s: zeit, inkrement_s: 0,
    uhr_weiss_ms: zeit == null ? null : zeit * 1000, uhr_schwarz_ms: zeit == null ? null : zeit * 1000,
    letzter_zug_am: new Date().toISOString(), erstellt_am: new Date().toISOString() });
  if (status === 'offen') p[farbe === 'w' ? 'schwarz' : 'weiss'] = null;
  partien.set(p.id, p); return p;
}
function zug(p, u) {
  const c = new Chess();
  for (const m of (p.zuege + ' ' + u).trim().split(' ')) c.move({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] });
  p.zuege = (p.zuege + ' ' + u).trim(); p.fen = c.fen(); p.am_zug = c.turn(); p.letzter_zug_am = new Date().toISOString(); aktualisieren(p);
}
function pruefe(name, gut, detail = '') { gesamt++; if (gut) ok++; console.log(`${gut ? 'OK' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(detail)}`); }
try {
  browser = await browserTyp(pw).launch({ headless: true });
  kontext = await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true });
  await kontext.route('**/*.supabase.co/**', async route => {
    const req = route.request(), url = new URL(req.url()), body = req.postDataJSON() || {};
    calls.push({ pfad: url.pathname, query: url.search, methode: req.method(), body });
    const antwort = d => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
    if (url.pathname === '/auth/v1/otp') return antwort({});
    if (url.pathname === '/auth/v1/verify') return antwort(sitzung);
    if (url.pathname === '/rest/v1/spielstaende') return antwort([]);
    if (url.pathname === '/rest/v1/profile') return antwort([{ user_id: 'u1', benutzername: 'Spieler_1' }]);
    if (url.pathname === '/rest/v1/partien_online') {
      if (url.searchParams.has('status')) return antwort([...partien.values()].filter(p => p.status === 'beendet'));
      const p = partien.get((url.searchParams.get('id') || '').slice(3));
      const seit = (url.searchParams.get('aktualisiert_am') || '').slice(3);
      return antwort(p && (!seit || p.aktualisiert_am > seit) ? [p] : []);
    }
    const rpc = url.pathname.split('/').at(-1), p = partien.get(body.partie);
    if (rpc === 'online_meine') return antwort([...partien.values()].filter(p => p.status !== 'beendet'));
    if (rpc === 'online_erstelle') {
      const neu = partie({ farbe: body.farbe === 'b' ? 'b' : 'w', status: 'offen', zeit: body.bedenkzeit_s, code: 'DEF567' });
      neu.inkrement_s = body.inkrement_s; return antwort(neu);
    }
    if (rpc === 'online_tritt_bei') {
      const neu = [...partien.values()].find(p => p.code === body.code && p.status === 'offen');
      if (!neu) throw new Error('Test-Einladung fehlt');
      neu[neu.weiss ? 'schwarz' : 'weiss'] = 'u1'; neu.status = 'laeuft'; return antwort(aktualisieren(neu));
    }
    if (rpc === 'online_zug') {
      if (ablehnen) { ablehnen = false; return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: 'ONLINE_NICHT_DEIN_ZUG' }) }); }
      zug(p, body.zug);
      if (p.fen !== body.fen_danach || p.am_zug !== body.am_zug_danach) unerwartet.push('Falsche Stellung gesendet');
      if (body.ergebnis) { p.status = 'beendet'; p.ergebnis = body.ergebnis; p.grund = body.grund; }
      return antwort(p);
    }
    if (rpc === 'online_biete_remis') { p.remis_angebot = p.weiss === 'u1' ? 'w' : 'b'; return antwort(aktualisieren(p)); }
    if (rpc === 'online_nimm_remis_an') { p.status = 'beendet'; p.ergebnis = '1/2-1/2'; p.grund = 'remis'; p.remis_angebot = null; return antwort(aktualisieren(p)); }
    if (rpc === 'online_gib_auf' || rpc === 'online_pruefe_zeit') {
      p.status = 'beendet'; p.grund = rpc === 'online_gib_auf' ? 'aufgabe' : 'zeit';
      p.ergebnis = rpc === 'online_gib_auf' ? (p.weiss === 'u1' ? '0-1' : '1-0') : (p.am_zug === 'w' ? '0-1' : '1-0');
      return antwort(aktualisieren(p));
    }
    // Datenfreigabe ist aus; die Kontodarstellung fragt den aktuellen Freigabestand ab.
    if (/freigabe/.test(url.pathname)) return antwort([]);
    unerwartet.push(url.pathname); return antwort([]);
  });
  await kontext.addInitScript(() => {
    localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ klang: false, bewegung: 'aus' }));
    const zeit = Date.now.bind(Date); window.__versatz = 0; Date.now = () => zeit() + window.__versatz;
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async t => { window.__kopiert = t; } } });
  });
  const seite = await kontext.newPage(); seite.setDefaultTimeout(15000);
  seite.on('pageerror', e => fehler.push(e.message));
  const start = 'http://127.0.0.1:8887/?test&kern&erw=pakete/online/index';
  const knopf = a => seite.locator(`[data-online="${a}"]`);
  const bereit = () => seite.waitForFunction(() => window.__online?.brett() && !window.__online.busy());
  async function oeffne(p) { await seite.evaluate(id => window.__app.gehe('online', { partieId: id }), p.id); await bereit(); }
  async function tippe(uci) {
    for (const f of [uci.slice(0, 2), uci.slice(2, 4)]) {
      const r = await seite.locator(`.on-brett .feld[data-feld="${f}"]`).boundingBox();
      await seite.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2);
    }
  }
  const eingeladen = partie({ status: 'offen' }); eingeladen.weiss = 'u2'; eingeladen.erstellt_von = 'u2';
  await seite.goto(start + '#online/abc234');
  await knopf('konto').waitFor();
  pruefe('Ohne Anmeldung: Hinweis und gemerkter Link, keine Server-Anfrage', (await seite.locator('.online-screen').innerText()).includes('Für Partien gegen Freunde brauchst du ein Konto')
    && await seite.evaluate(() => localStorage.getItem('schach-arena:online:einladung') === 'ABC234') && calls.length === 0);
  await knopf('konto').click(); await seite.locator('.konto-email').fill('spieler@example.invalid');
  await seite.locator('[data-konto="code"]').click();
  const ziffern = seite.locator('.konto-ziffern input');
  for (let i = 0; i < 6; i++) await ziffern.nth(i).fill(String(i + 1));
  await seite.locator('[data-konto="pruefen"]').click();
  await seite.locator('[data-konto="abmelden"]').waitFor();
  await seite.getByRole('button', { name: 'Zur Einladung', exact: true }).click();
  await seite.locator('[name="code"]').waitFor();
  pruefe('Einladung nach echter Code-Anmeldung wieder angeboten', await seite.locator('[name="code"]').inputValue() === 'ABC234');
  await seite.getByRole('button', { name: 'Beitreten', exact: true }).click(); await bereit();
  pruefe('Beitritt: eigene schwarze Seite unten, Merker geloescht', await seite.evaluate(() => window.__online.brett().ausrichtung === 'b' && !localStorage.getItem('schach-arena:online:einladung')));
  zug(eingeladen, 'e2e4');
  await seite.waitForFunction(() => window.__online.chess().history().length === 1);
  pruefe('Gegnerzug aus der Abfrage erscheint legal auf dem Brett', await seite.evaluate(() => window.__online.chess().get('e4')?.color === 'w'));
  await tippe('c7c5'); await seite.waitForFunction(() => window.__online.partie().zuege.endsWith('c7c5') && !window.__online.busy());
  pruefe('Eigener Zug sendet UCI, FEN und Seitenwechsel', calls.some(c => c.pfad.endsWith('online_zug') && c.body.zug === 'c7c5' && c.body.am_zug_danach === 'w' && c.body.fen_danach === eingeladen.fen));
  await seite.reload(); await bereit();
  pruefe('Neuladen setzt Serverpartie fort, kein lokaler Verlauf', await seite.evaluate(() => window.__online.chess().history().length === 2
    && JSON.parse(localStorage.getItem('schach-arena:v1:partien') || '[]').length === 0));
  const weiss = partie({ zuege: 'e2e4 e7e5', zeit: 300, code: 'GHJ789' }); await oeffne(weiss);
  ablehnen = true; await tippe('g1f3');
  await seite.getByText('Du bist nicht am Zug.', { exact: true }).waitFor();
  await seite.waitForFunction(() => !window.__online.busy());
  pruefe('Abgelehnter Zug kommt zurueck, freundliche Meldung', await seite.evaluate(() => window.__online.chess().get('g1')?.type === 'n' && !window.__online.chess().get('f3') && window.__online.chess().history().length === 2));
  await tippe('g1f3'); await seite.waitForFunction(() => window.__online.partie().zuege.endsWith('g1f3') && !window.__online.busy());
  const vorher = await seite.evaluate(() => ({ w: window.__online.rest('w'), b: window.__online.rest('b') }));
  await seite.evaluate(() => { window.__versatz += 2500; });
  const danach = await seite.evaluate(() => ({ w: window.__online.rest('w'), b: window.__online.rest('b') }));
  pruefe('Nur die aktive Server-Uhr laeuft herunter', danach.w === vorher.w && danach.b <= vorher.b - 2400, { vorher, danach });
  await knopf('remis').click();
  await seite.getByRole('button', { name: 'Remis angeboten', exact: true }).waitFor();
  pruefe('Remis anbieten erreicht den Server', weiss.remis_angebot === 'w');
  weiss.remis_angebot = 'b'; aktualisieren(weiss);
  await knopf('annehmen').waitFor(); await knopf('annehmen').click();
  await seite.locator('.on-ergebnis:not([hidden])').waitFor();
  pruefe('Remis annehmen zeigt Ergebnis ohne Sterne', (await seite.locator('.on-ergebnis').innerText()).includes('Remis vereinbart') && !(await seite.locator('.on-ergebnis').innerText()).includes('Stern'));
  await knopf('revanche').click(); await seite.locator('.on-code').waitFor();
  pruefe('Revanche: neue Einladung mit getauschter Farbe', calls.filter(c => c.pfad.endsWith('online_erstelle')).at(-1)?.body.farbe === 'b');
  await knopf('teilen').click();
  pruefe('Einladung zeigt Code, Link, 24 Stunden und Kopieren als Rueckfall', await seite.evaluate(() => window.__kopiert?.endsWith('#online/DEF567'))
    && (await seite.locator('.on-einladung').innerText()).includes('Die Einladung gilt 24 Stunden.'));
  await seite.evaluate(() => Object.defineProperty(navigator, 'share', { configurable: true, value: async d => { window.__geteilt = d; } }));
  await knopf('teilen').click();
  pruefe('Teilen nutzt navigator.share, wenn vorhanden', await seite.evaluate(() => window.__geteilt?.url?.endsWith('#online/DEF567')));
  const mitUhr = partie({ zuege: 'd2d4 d7d5 c2c4', zeit: 1 }); await oeffne(mitUhr);
  await seite.evaluate(() => { window.__versatz += 10000; });
  await seite.locator('.on-ergebnis:not([hidden])').waitFor();
  pruefe('Gegnerzeit auf null: Server entscheidet das Ergebnis', calls.some(c => c.pfad.endsWith('online_pruefe_zeit') && c.body.partie === mitUhr.id)
    && (await seite.locator('.on-ergebnis').innerText()).includes('Sieg') && mitUhr.grund === 'zeit');
  await seite.evaluate(() => { window.__versatz = 0; });
  const defekt = partie(); await oeffne(defekt);
  defekt.fen = new Chess().fen().replace(' w ', ' b '); aktualisieren(defekt);
  await seite.getByText(/Die empfangene Stellung passt nicht/).waitFor();
  pruefe('Unpassende Serverstellung haelt die Partie an', await seite.evaluate(() => window.__online.blockiert() && window.__online.chess().turn() === 'w'));
  const ungueltig = partie(); await oeffne(ungueltig); ungueltig.zuege = 'e2e5'; aktualisieren(ungueltig);
  await seite.getByText(/Die empfangene Stellung passt nicht/).waitFor();
  pruefe('Illegaler Serverzug haelt die Partie ebenfalls an', await seite.evaluate(() => window.__online.blockiert()));
  const aufgabe = partie(); await oeffne(aufgabe);
  await knopf('aufgeben').click(); await seite.getByRole('alertdialog').getByRole('button', { name: 'Aufgeben', exact: true }).click();
  await seite.locator('.on-ergebnis:not([hidden])').waitFor();
  pruefe('Aufgabe mit Rueckfrage und Niederlage', aufgabe.grund === 'aufgabe' && (await seite.locator('.on-ergebnis h3').innerText()) === 'Niederlage');
  await knopf('liste-zurueck').click(); await seite.getByRole('button', { name: /Beendet/ }).first().waitFor();
  pruefe('Meine Partien zeigt auch beendete Serverpartien', await seite.getByRole('button', { name: /Beendet/ }).count() >= 3);
  // Angemeldeter Einladungslink ohne Umweg ueber Einstellungen.
  const direkt = partie({ status: 'offen', code: 'KLM234' }); direkt.weiss = 'u2'; direkt.erstellt_von = 'u2';
  await seite.goto(start + '#online/KLM234'); await seite.locator('[name="code"]').waitFor();
  pruefe('Angemeldeter Link fuellt den Code direkt aus', await seite.locator('[name="code"]').inputValue() === 'KLM234');
  await seite.getByRole('button', { name: 'Beitreten', exact: true }).click(); await bereit();
  for (const [width, height] of [[1180, 820], [820, 1180], [390, 844]]) for (const modus of ['hell', 'dunkel']) {
    await seite.setViewportSize({ width, height }); await seite.evaluate(modus => window.__app.setzeEinstellungen({ modus }), modus);
    await seite.waitForFunction(modus => document.documentElement.dataset.modus === modus, modus);
    await seite.waitForFunction(() => {
      const probe = document.createElement('span'); probe.style.color = 'var(--text)'; document.body.append(probe);
      const gleich = getComputedStyle(probe).color === getComputedStyle(document.body).color; probe.remove(); return gleich;
    });
    await seite.locator('.on-brett').scrollIntoViewIfNeeded();
    const masse = await seite.evaluate(() => {
      const b = document.querySelector('.on-brett').getBoundingClientRect();
      return { quer: document.documentElement.scrollWidth <= innerWidth, brett: b.x >= 0 && b.right <= innerWidth + 1 && b.y >= 0 && b.bottom <= innerHeight + 1,
        knoepfe: [...document.querySelectorAll('.online-screen button')].every(b => b.getBoundingClientRect().height >= 44), karten: document.querySelectorAll('.on-spieler img').length === 2 };
    });
    pruefe(`${width}x${height} ${modus}: Brett, Spielerkarten und Tippflaechen passen`, Object.values(masse).every(Boolean), masse);
    if (process.env.BILDER) { mkdirSync(process.env.BILDER, { recursive: true }); await seite.screenshot({ path: path.join(process.env.BILDER, `online-${width}-${modus}.png`) }); }
  }
  await seite.evaluate(() => window.__app.gehe('training'));
  await seite.getByRole('button', { name: 'Gegen Freunde spielen', exact: true }).click();
  await seite.getByRole('button', { name: 'Einladung erstellen', exact: true }).waitFor();
  await seite.locator('[name="farbe"]').selectOption('w'); await seite.locator('[name="tempo"]').selectOption('15');
  await seite.getByRole('button', { name: 'Einladung erstellen', exact: true }).click(); await seite.locator('.on-code').waitFor();
  pruefe('Training und Einladungsformular: Farbe und 15+10 an den Server', calls.filter(c => c.pfad.endsWith('online_erstelle')).at(-1)?.body.bedenkzeit_s === 900
    && calls.filter(c => c.pfad.endsWith('online_erstelle')).at(-1)?.body.inkrement_s === 10);
  pruefe('Keine Seitenfehler oder unerwarteten API-Aufrufe', !fehler.length && !unerwartet.length, { fehler, unerwartet });
} catch (e) { pruefe('Ablauf ohne Abbruch', false, e.stack); }
finally { await kontext?.close(); await browser?.close(); await new Promise(r => server.close(r)); }
console.log(`\n${ok}/${gesamt} bestanden`); process.exitCode = ok === gesamt ? 0 : 1;
