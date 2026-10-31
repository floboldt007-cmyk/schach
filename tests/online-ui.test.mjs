// Netzwerk ausschliesslich simuliert: kein Test schreibt ins echte Supabase-Projekt.
//   PORT=9620 node tests/online-ui.test.mjs   eigener Port (Standard 8887)
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
const PORT = Number(process.env.PORT || 8887);
await new Promise(r => server.listen(PORT, '127.0.0.1', r));
const sitzung = { access_token: 'a.' + Buffer.from(JSON.stringify({ sub: 'u1' })).toString('base64url') + '.x', refresh_token: 'test-r', expires_at: 9999999999, user: { id: 'u1', email: 'spieler@example.invalid' } };
let browser, kontext, ok = 0, gesamt = 0, stamp = Date.now(), nummer = 0, ablehnen = false, veraltet = false;
// Antwort auf die naechste Strittig-Meldung: null wie der Server, 'netz' ohne Verbindung, 'beendet' wenn der Gegner
// gerade vorher die Zeit reklamiert hat (Wettlauf, siehe Konzept Anti-Cheat L5)
let strittigAntwort = null;
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
    // Erfinder-Status: die App fragt seit dem 31.10.2026 fuer jedes angemeldete Konto nach (js/app.js); hier keine Stuecke
    if (url.pathname === '/rest/v1/sonderstuecke') return antwort([]);
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
    // Anti-Cheat Etappe 1a: Zuege gehen an die Edge Function online-zug, nur mit Partie und Zug. Wie der Server prueft die
    // Attrappe den Zug mit chess.js und rechnet Stellung und Ende selbst aus. Der alte Weg rpc/online_zug ist unerwartet.
    if (url.pathname === '/functions/v1/online-zug') {
      const fehlt = (status, fehler) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ fehler, text: 'Rueckfall' }) });
      if (Object.keys(body).sort().join(',') !== 'partie,zug') unerwartet.push('Zug mit anderen Feldern als partie und zug: ' + Object.keys(body).join(','));
      if (ablehnen) { ablehnen = false; return fehlt(409, 'ONLINE_NICHT_DEIN_ZUG'); }
      if (veraltet) { veraltet = false; return fehlt(409, 'ONLINE_STAND_VERALTET'); }
      const q = partien.get(body.partie), c = new Chess();
      for (const m of q.zuege.split(' ').filter(Boolean)) c.move({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] });
      let m;
      try { m = c.move({ from: body.zug.slice(0, 2), to: body.zug.slice(2, 4), promotion: body.zug[4] }); } catch (e) { return fehlt(422, 'ONLINE_ZUG_ILLEGAL'); }
      zug(q, m.lan);
      const ende = c.isCheckmate() ? [c.turn() === 'b' ? '1-0' : '0-1', 'matt'] : c.isStalemate() ? ['1/2-1/2', 'patt']
        : c.isInsufficientMaterial() ? ['1/2-1/2', 'material'] : c.isThreefoldRepetition() ? ['1/2-1/2', 'wiederholung']
          : c.isDrawByFiftyMoves() ? ['1/2-1/2', '50-zuege'] : null;
      if (ende) { q.status = 'beendet'; q.ergebnis = ende[0]; q.grund = ende[1]; aktualisieren(q); }
      return antwort(q);
    }
    if (rpc === 'online_biete_remis') { p.remis_angebot = p.weiss === 'u1' ? 'w' : 'b'; return antwort(aktualisieren(p)); }
    if (rpc === 'online_nimm_remis_an') { p.status = 'beendet'; p.ergebnis = '1/2-1/2'; p.grund = 'remis'; p.remis_angebot = null; return antwort(aktualisieren(p)); }
    if (rpc === 'online_strittig' && strittigAntwort === 'netz') { strittigAntwort = null; return route.abort('failed'); }
    if (rpc === 'online_strittig' && strittigAntwort === 'beendet') {
      strittigAntwort = null; Object.assign(p, { status: 'beendet', grund: 'zeit', ergebnis: p.weiss === 'u1' ? '0-1' : '1-0' }); aktualisieren(p);
      return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: 'ONLINE_PARTIE_BEENDET' }) });
    }
    if (rpc === 'online_strittig') { p.status = 'beendet'; p.grund = 'strittig'; p.ergebnis = null; p.remis_angebot = null; return antwort(aktualisieren(p)); }
    // wie der Server: mit Uhr vor dem 2. Halbzug beendet die Zeit-Reklamation eine haengende Partie ohne Ergebnis
    if (rpc === 'online_pruefe_zeit' && p.zuege.split(' ').filter(Boolean).length < 2) { p.status = 'beendet'; p.grund = 'abgebrochen'; p.ergebnis = null; return antwort(aktualisieren(p)); }
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
  const start = `http://127.0.0.1:${PORT}/?test&kern&erw=pakete/online/index`;
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
  pruefe('Eigener Zug geht nur als Partie und UCI an die Edge Function online-zug, nicht mehr an rpc/online_zug', calls.some(c => c.pfad === '/functions/v1/online-zug'
    && c.methode === 'POST' && c.body.zug === 'c7c5' && c.body.partie === eingeladen.id && Object.keys(c.body).length === 2)
    && !calls.some(c => c.pfad.endsWith('/rpc/online_zug')) && eingeladen.am_zug === 'w');
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
  // Flo 30.10. abends: Remis ueber die Fahne (Remis anbieten oder Aufgeben)
  await knopf('aufgeben').click(); await seite.getByRole('alertdialog').getByRole('button', { name: 'Remis anbieten', exact: true }).click();
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
  // Anti-Cheat Etappe 0: eine kaputte Serverstellung friert die Partie nicht mehr ein. Der Browser meldet die Partie
  // einmal von selbst als strittig, ohne dass jemand tippt: Sonst wartete der Schummler, bis die Uhr des Opfers ablaeuft.
  const defekt = partie(); await oeffne(defekt);
  const vorDefekt = calls.length;
  defekt.fen = new Chess().fen().replace(' w ', ' b '); aktualisieren(defekt);
  await seite.locator('.on-ergebnis:not([hidden])').waitFor();
  const strittigRufe = calls.slice(vorDefekt).filter(c => c.pfad.endsWith('online_strittig'));
  pruefe('Unpassende Serverstellung: ohne Tippen von selbst als strittig gemeldet, Meldung, Karte "Strittig" ohne Sieg oder Niederlage',
    strittigRufe.length === 1 && strittigRufe[0].body.partie === defekt.id && defekt.grund === 'strittig' && defekt.ergebnis === null
    && (await seite.locator('.on-ergebnis h3').innerText()) === 'Strittig'
    && (await seite.locator('.on-ergebnis').innerText()).includes('ohne Ergebnis') && await knopf('strittig').count() === 0
    && (await seite.locator('.on-meldung').innerText()).includes('als strittig beendet')
    && await seite.evaluate(() => window.__online.widerspruch() && !window.__online.blockiert()), strittigRufe);
  // Rueckfall: Erreicht die Meldung den Server nicht, friert trotzdem nichts ein. Es gibt eine Meldung, keine Zuege mehr,
  // aber "Strittig melden" und "Aufgeben" bleiben bedienbar, und die Abfrage laeuft weiter.
  const rueckfall = partie(); await oeffne(rueckfall);
  strittigAntwort = 'netz';
  rueckfall.fen = new Chess().fen().replace(' w ', ' b '); aktualisieren(rueckfall);
  await seite.getByText(/selbst als strittig/).waitFor();
  await knopf('strittig').waitFor(); await bereit();
  pruefe('Meldung scheitert am Netz: Hinweis, "Strittig melden" und "Aufgeben" bleiben bedienbar statt Einfrieren', await seite.evaluate(() => window.__online.widerspruch()
    && !window.__online.blockiert() && window.__online.chess().turn() === 'w' && window.__online.brett()._karte === null)
    && await knopf('strittig').isEnabled() && await knopf('aufgeben').isEnabled() && await knopf('remis').count() === 0
    && (await seite.locator('.on-zug').innerText()) === 'Stellung stimmt nicht'
    && (await seite.locator('.on-meldung').innerText()).includes('Keine Verbindung')
    && calls.filter(c => c.pfad.endsWith('online_strittig') && c.body.partie === rueckfall.id).length === 1 && rueckfall.status === 'laeuft');
  await knopf('strittig').click();
  await seite.locator('.on-ergebnis:not([hidden])').waitFor();
  pruefe('Strittig melden von Hand: Server beendet ohne Ergebnis, Karte "Strittig" ohne Sieg oder Niederlage', calls.filter(c => c.pfad.endsWith('online_strittig') && c.body.partie === rueckfall.id).length === 2
    && rueckfall.grund === 'strittig' && (await seite.locator('.on-ergebnis h3').innerText()) === 'Strittig'
    && (await seite.locator('.on-ergebnis').innerText()).includes('ohne Ergebnis') && await knopf('strittig').count() === 0);
  // Wettlauf: Der Gegner reklamiert die Zeit, kurz bevor die Meldung ankommt. Dann gibt es keinen Knopf mehr und keine
  // Aufforderung dazu; das Ende auf der kaputten Stellung zaehlt nicht als Niederlage.
  const wettlauf = partie(); await oeffne(wettlauf);
  strittigAntwort = 'beendet';
  wettlauf.fen = new Chess().fen().replace(' w ', ' b '); aktualisieren(wettlauf);
  await seite.locator('.on-ergebnis:not([hidden])').waitFor(); await bereit();
  pruefe('Wettlauf: Zeit zuerst reklamiert, Meldung des Servers ohne Knopf-Hinweis, "Ergebnis nicht nachvollziehbar"', wettlauf.grund === 'zeit'
    && (await seite.locator('.on-ergebnis h3').innerText()) === 'Ergebnis nicht nachvollziehbar' && await knopf('strittig').count() === 0
    && (await seite.locator('.on-meldung').innerText()) === 'Diese Partie ist schon beendet.');
  const ungueltig = partie(); await oeffne(ungueltig);
  strittigAntwort = 'netz';
  ungueltig.zuege = 'e2e5'; aktualisieren(ungueltig);
  await seite.getByText(/selbst als strittig/).waitFor();
  await knopf('strittig').waitFor(); await bereit();
  const vorTipp = calls.length;
  await tippe('e2e4'); await seite.waitForTimeout(300);
  pruefe('Illegaler Serverzug: letzter stimmiger Stand, keine Zuege, Knoepfe bedienbar', await seite.evaluate(() => window.__online.widerspruch()
    && !window.__online.blockiert() && window.__online.chess().history().length === 0 && window.__online.brett()._karte === null)
    && !calls.slice(vorTipp).some(c => c.pfad.endsWith('online_zug') || c.pfad.endsWith('online-zug')) && await knopf('strittig').isEnabled());
  // Der Schummler reklamiert danach die Zeit (L5 im Konzept): Die Abfrage laeuft weiter, das Ende kommt an, zaehlt aber
  // auf der kaputten Stellung nicht als Niederlage.
  ungueltig.status = 'beendet'; ungueltig.grund = 'zeit'; ungueltig.ergebnis = '0-1'; aktualisieren(ungueltig);
  await seite.locator('.on-ergebnis:not([hidden])').waitFor();
  pruefe('Abfrage laeuft weiter: Zeitsieg auf kaputter Stellung ist "Ergebnis nicht nachvollziehbar"', (await seite.locator('.on-ergebnis h3').innerText()) === 'Ergebnis nicht nachvollziehbar'
    && (await seite.locator('.on-ergebnis').innerText()).includes('nicht als Sieg oder Niederlage') && ungueltig.grund === 'zeit');
  // Nur Brett und Seite am Zug zaehlen: andere Zaehler, Rochaderechte oder en-passant-Feld im FEN-Text sind kein Fehler
  const zaehler = partie({ zuege: 'e2e4' });
  { const t = zaehler.fen.split(' '); zaehler.fen = [t[0], t[1], 'Kq', 'e3', '7', '23'].join(' '); aktualisieren(zaehler); }
  await oeffne(zaehler);
  pruefe('FEN nur in Zaehlern, Rochade und en passant anders: kein Widerspruch, Partie laeuft normal', await seite.evaluate(() => !window.__online.widerspruch()
    && !window.__online.blockiert() && window.__online.chess().history().length === 1)
    && (await seite.locator('.on-zug').innerText()) === 'Dein Freund ist am Zug' && await knopf('aufgeben').count() === 1 && await knopf('strittig').count() === 0);
  // Ein behauptetes Ende wird mit chess.js nachgeprueft
  const scheinmatt = partie({ zuege: 'e2e4 e7e5' }); Object.assign(scheinmatt, { status: 'beendet', ergebnis: '0-1', grund: 'matt' }); aktualisieren(scheinmatt);
  await oeffne(scheinmatt); await seite.locator('.on-ergebnis:not([hidden])').waitFor();
  pruefe('Behauptetes Matt, das keins ist: "Ergebnis nicht nachvollziehbar" statt Niederlage', (await seite.locator('.on-ergebnis h3').innerText()) === 'Ergebnis nicht nachvollziehbar'
    && (await seite.locator('.on-ergebnis').innerText()).includes('passt nicht zum Brett'));
  const scheinremis = partie({ zuege: 'e2e4 e7e5' }); Object.assign(scheinremis, { status: 'beendet', ergebnis: '1/2-1/2', grund: 'wiederholung' }); aktualisieren(scheinremis);
  await oeffne(scheinremis); await seite.locator('.on-ergebnis:not([hidden])').waitFor();
  pruefe('Behauptete Wiederholung, die keine ist: ebenfalls nicht nachvollziehbar', (await seite.locator('.on-ergebnis h3').innerText()) === 'Ergebnis nicht nachvollziehbar');
  const echt = partie({ farbe: 'b', zuege: 'f2f3 e7e5 g2g4 d8h4' }); Object.assign(echt, { status: 'beendet', ergebnis: '0-1', grund: 'matt' }); aktualisieren(echt);
  await oeffne(echt); await seite.locator('.on-ergebnis:not([hidden])').waitFor();
  pruefe('Echtes Matt wird bestaetigt: Sieg mit Schachmatt', (await seite.locator('.on-ergebnis h3').innerText()) === 'Sieg'
    && (await seite.locator('.on-ergebnis').innerText()).includes('Schachmatt'));
  // Etappe 1a: Ein eigener Zug, der matt setzt, schickt nur den Zug; das Ende rechnet der Server aus und die Karte zeigt es
  const mattZug = partie({ farbe: 'b', zuege: 'f2f3 e7e5 g2g4' }); await oeffne(mattZug);
  await tippe('d8h4'); await seite.locator('.on-ergebnis:not([hidden])').waitFor();
  const mattRuf = calls.filter(c => c.pfad === '/functions/v1/online-zug' && c.body.partie === mattZug.id);
  pruefe('Eigener Mattzug: nur { partie, zug } gesendet, Server meldet 0-1 matt, Karte zeigt Sieg mit Schachmatt', mattRuf.length === 1
    && JSON.stringify(mattRuf[0].body) === JSON.stringify({ partie: mattZug.id, zug: 'd8h4' }) && mattZug.grund === 'matt' && mattZug.ergebnis === '0-1'
    && (await seite.locator('.on-ergebnis h3').innerText()) === 'Sieg' && (await seite.locator('.on-ergebnis').innerText()).includes('Schachmatt'));
  // Etappe 1a: Kam inzwischen ein anderer Zug an (veralteter Stand), sagt die App das ruhig und laedt den Stand neu
  const doppelt = partie({ zuege: 'e2e4 e7e5' }); await oeffne(doppelt);
  veraltet = true; await tippe('g1f3');
  await seite.getByText('Die Partie hat sich gerade geändert. Der aktuelle Stand wird geladen.', { exact: true }).waitFor();
  await seite.waitForFunction(() => !window.__online.busy());
  pruefe('Veralteter Stand: ruhige Meldung, Zug nicht verbucht, Stand neu geladen, Brett wieder bedienbar', doppelt.zuege === 'e2e4 e7e5'
    && await seite.evaluate(() => window.__online.chess().history().length === 2 && window.__online.chess().get('g1')?.type === 'n' && window.__online.brett()._karte !== null));
  const material = partie({ zuege: 'e2e4 e7e5 g1f3' }); Object.assign(material, { status: 'beendet', ergebnis: '1/2-1/2', grund: 'zeit-material' }); aktualisieren(material);
  await oeffne(material); await seite.locator('.on-ergebnis:not([hidden])').waitFor();
  pruefe('Zeitende mit zu wenig Material: Remis mit eigenem Grund', (await seite.locator('.on-ergebnis h3').innerText()) === 'Remis'
    && (await seite.locator('.on-ergebnis').innerText()).includes('zu wenig Material zum Mattsetzen'));
  // Mit Uhr vor dem 2. Halbzug laeuft keine Uhr: nach 10 Minuten ohne Zug fragt die Oberflaeche nach, der Server bricht ab
  const haengt = partie({ zuege: 'e2e4', zeit: 300 }); await oeffne(haengt);
  await seite.waitForTimeout(300);
  const zuFrueh = calls.some(c => c.pfad.endsWith('online_pruefe_zeit') && c.body.partie === haengt.id);
  await seite.evaluate(() => { window.__versatz += 11 * 60 * 1000; });
  await seite.locator('.on-ergebnis:not([hidden])').waitFor();
  pruefe('Haengende Partie mit Uhr: vor 10 Minuten keine Abfrage, danach abgebrochen ohne Ergebnis', !zuFrueh
    && calls.filter(c => c.pfad.endsWith('online_pruefe_zeit') && c.body.partie === haengt.id).length === 1
    && haengt.grund === 'abgebrochen' && (await seite.locator('.on-ergebnis h3').innerText()) === 'Partie beendet'
    && (await seite.locator('.on-ergebnis').innerText()).includes('zu lange kein Zug'));
  await seite.evaluate(() => { window.__versatz = 0; });
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
