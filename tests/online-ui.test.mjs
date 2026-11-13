// Netzwerk ausschliesslich simuliert: kein Test schreibt ins echte Supabase-Projekt.
//   PORT=9620 node tests/online-ui.test.mjs   eigener Port (Standard: frei)
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
const PORT = Number(process.env.PORT) || await (await import('./freier-port.mjs')).freierPort();
await new Promise(r => server.listen(PORT, '127.0.0.1', r));
const sitzung = { access_token: 'a.' + Buffer.from(JSON.stringify({ sub: 'u1' })).toString('base64url') + '.x', refresh_token: 'test-r', expires_at: 9999999999, user: { id: 'u1', email: 'spieler@example.invalid' } };
let browser, kontext, ok = 0, gesamt = 0, stamp = Date.now(), nummer = 0, ablehnen = false, veraltet = false;
// Antwort auf die naechste Strittig-Meldung: null wie der Server, 'netz' ohne Verbindung, 'beendet' wenn der Gegner
// gerade vorher die Zeit reklamiert hat (Wettlauf, siehe Konzept Anti-Cheat L5)
let strittigAntwort = null;
// Handy-Runde 08.11.: kennt der Server die Liga (kronen_mein_stand)? Ohne sie zeigt Online "kommt bald" statt der Suche
let ligaDa = false;
let neuesSql = null; // { seit }: die Attrappe antwortet wie das neue SQL (Konzept "Zwei Ligen")
let altBeleg = false; // altes SQL, das nach der Wartezeit einen KI-Beleg gibt (Gegenprobe zum Hinweis "Verlassen")
// G-005 AC-06: kronen_mein_stand antwortet so viele ms spaeter (wie im Handy-Netz), damit ein Springen beim Laden messbar wird
let ligaVerzug = 0;
// Befund 4 (11.11.2026): Erfinder-Konto mit Figurensatz Blaupause; die Antwort kommt spaet, wie im Handy-Netz
let erfinder = false, sonderVerzug = 0;
// R2: Tageskontingent der Live-Bewertung (online_live_bewertung_frei/nutzen), Antwort wie supabase/zwei-ligen-schema.sql
let liveFrei = { frei: true, rest: 1, unbegrenzt: false };
const partien = new Map(), calls = [], fehler = [], unerwartet = [], karteFragen = [];
const aktualisieren = p => { p.aktualisiert_am = new Date(++stamp).toISOString(); return p; };
function partie({ farbe = 'w', status = 'laeuft', zuege = '', zeit = null, code = 'ABC234', gewertet = false } = {}) {
  const c = new Chess(); for (const u of zuege.split(' ').filter(Boolean)) c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
  const p = aktualisieren({ id: 'partie-' + ++nummer, code, weiss: farbe === 'w' ? 'u1' : 'u2', schwarz: farbe === 'b' ? 'u1' : 'u2', erstellt_von: 'u1',
    status, fen: c.fen(), am_zug: c.turn(), zuege, ergebnis: null, grund: null, remis_angebot: null, bedenkzeit_s: zeit, inkrement_s: 0,
    uhr_weiss_ms: zeit == null ? null : zeit * 1000, uhr_schwarz_ms: zeit == null ? null : zeit * 1000,
    letzter_zug_am: new Date().toISOString(), erstellt_am: new Date().toISOString(), gewertet });
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
    if (url.pathname === '/rest/v1/sonderstuecke') {
      if (sonderVerzug) await new Promise(r => setTimeout(r, sonderVerzug));
      return antwort(erfinder ? [{ stueck_id: 'erfinder-titel' }, { stueck_id: 'erfinder-figuren-blaupause' }] : []);
    }
    if (url.pathname === '/rest/v1/profile') return antwort([{ user_id: 'u1', benutzername: 'Spieler_1' }]);
    if (url.pathname === '/rest/v1/partien_online') {
      if (url.searchParams.has('status')) return antwort([...partien.values()].filter(p => p.status === 'beendet'));
      const p = partien.get((url.searchParams.get('id') || '').slice(3));
      const seit = (url.searchParams.get('aktualisiert_am') || '').slice(3);
      return antwort(p && (!seit || p.aktualisiert_am > seit) ? [p] : []);
    }
    const rpc = url.pathname.split('/').at(-1), p = partien.get(body.partie);
    // Gegnersuche (js/kronen.js): niemand da, die Suche wartet. Altes SQL antwortet ohne Wartezeit (dann 10 s wie bisher),
    // neues SQL (Konzept "Zwei Ligen") mit seit, warte_s, ki_ab_s und zeit; ende(true) gibt dort ab ki_ab_s einen Beleg
    if (rpc === 'online_suche_start' || rpc === 'online_suche_stand') return antwort(neuesSql ? { wartet: true, seit: neuesSql.seit, warte_s: neuesSql.warte ?? 30, ki_ab_s: neuesSql.kiAb ?? 1, zeit: '5+3' } : {});
    if (rpc === 'kronen_mein_stand' && ligaVerzug) await new Promise(r => setTimeout(r, ligaVerzug));
    if (rpc === 'online_suche_ende') return antwort((neuesSql || altBeleg) && body.ki === true ? { ki_ref: '0b6c1e2d-3a4b-4c8d-9e0a-1b2c3d4e5f60' } : {});
    if (rpc === 'kronen_mein_stand') return ligaDa ? antwort({ stufe: 7, kronen: 140, platz: 3, ziel: 120, n: 30, woche: '2026-11-02' })
      : route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST202', message: 'Could not find the function' }) });
    if (rpc === 'online_live_bewertung_frei') return antwort(liveFrei);
    if (rpc === 'online_live_bewertung_nutzen') return antwort(liveFrei.frei ? { ok: true, frei: true, rest: 0, unbegrenzt: liveFrei.unbegrenzt, gebucht: !liveFrei.unbegrenzt }
      : { ok: false, frei: false, rest: 0, unbegrenzt: false, gebucht: false });
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
    // Etappe 4b: Visitenkarten (js/karte.js). Beim Start meldet das Konto Stufen und Wahl; die Partie fragt beide Karten.
    if (rpc === 'karte_melde_stufen' || rpc === 'karte_waehle') return antwort({ taler: 0, stufen: {}, banner: ['start'], wahl: { banner: 'start' } });
    if (rpc === 'karte_der_partie') {
      karteFragen.push(body.partie);
      const karte = (name, du) => ({ name, banner: 'saison-silber', titel: 'erfolg-feuertaufe', vitrine: [], motiv: 'Q', grund: 'standard', rahmen: 'ohne', kronen_stufe: 7, du });
      return antwort(p ? { w: karte(p.weiss === 'u1' ? 'Spieler_1' : 'Gegner_2', p.weiss === 'u1'), s: karte(p.schwarz === 'u1' ? 'Spieler_1' : 'Gegner_2', p.schwarz === 'u1') } : {});
    }
    unerwartet.push(url.pathname); return antwort([]);
  });
  await kontext.addInitScript(() => {
    // test:einstellungen (sessionStorage, ueberlebt ein Neuladen): Zusatz-Einstellungen einzelner Pruefungen, z. B. Figurensatz
    let zusatz = {}; try { zusatz = JSON.parse(sessionStorage.getItem('test:einstellungen') || '{}'); } catch (e) { /* ohne */ }
    localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ klang: false, bewegung: 'aus', ...zusatz }));
    // R2: Live-Bewertung ohne Stockfish (js/ui/online.js nimmt im Testmodus window.__onlineLiveEngine): jede Stellung bekommt
    // ihre legalen Zuege als Varianten, der erste ist der beste; protokolliert jede Analyse
    window.__liveAnalysen = [];
    window.__onlineLiveEngine = async () => ({ async analyse(fen, o = {}) {
      window.__liveAnalysen.push(fen);
      const { Chess } = await import('/vendor/chess/chess.js');
      const c = new Chess(fen), z = c.moves({ verbose: true }), n = Math.min(o.multipv || 1, z.length);
      return { fen, turn: c.turn(), depth: o.depth, bestmove: z[0]?.lan,
        lines: z.slice(0, Math.max(n, 1)).map((m, i) => ({ multipv: i + 1, depth: o.depth, eval: { cp: 20 - 10 * i, mate: null }, pv: [m.lan] })) };
    } });
    const zeit = Date.now.bind(Date); window.__versatz = 0; Date.now = () => zeit() + window.__versatz;
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async t => { window.__kopiert = t; } } });
  });
  const seite = await kontext.newPage(); seite.setDefaultTimeout(15000);
  seite.on('pageerror', e => fehler.push(e.message));
  const start = `http://127.0.0.1:${PORT}/?test&kern&erw=pakete/online/index`;
  const knopf = a => seite.locator(`[data-online="${a}"]`);
  // Seit 11.11. misst sich das Brett wie in der Bot-Partie an der Hoehe des Screens: solange der alte Screen beim Wechsel
  // noch daneben steht, ist das neue Brett einen Moment 0 px gross. Erst tippen, wenn genau ein Brett Flaeche hat.
  // R8 (13.11.2026): mit id erst, wenn genau diese Partie geladen ist. Beim Wechsel von Partie zu Partie stand sonst unter
  // Last kurz noch der alte Screen bereit, und die Pruefung las die alte Partie (__online.partie() war null oder alt).
  const bereit = (id = null) => seite.waitForFunction((id) => window.__online?.brett() && !window.__online.busy()
    && (id == null || window.__online.partie()?.id === id)
    && document.querySelectorAll('.screen').length === 1 && document.querySelector('.on-brett')?.getBoundingClientRect().width > 100, id);
  async function oeffne(p) { await seite.evaluate(id => window.__app.gehe('online', { partieId: id }), p.id); await bereit(p.id); }
  async function tippe(uci) {
    for (const f of [uci.slice(0, 2), uci.slice(2, 4)]) {
      const r = await seite.locator(`.on-brett .feld[data-feld="${f}"]`).boundingBox();
      await seite.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2);
    }
  }
  const eingeladen = partie({ status: 'offen' }); eingeladen.weiss = 'u2'; eingeladen.erstellt_von = 'u2';
  await seite.goto(start + '#online/abc234');
  await knopf('konto').waitFor();
  // Flo 08.11.2026 (Konzept 1 A): ohne Konto dieselben zwei Tueren, aber nur als Erklaerung: kein Knopf, kein Schatten
  // (Befund V 6: vorher sahen die Karten tippbar aus); der einzige Knopf ist "Zum Konto" (wie ueberall in der App, Design-Durchsicht U 09.11.2026)
  pruefe('Ohne Anmeldung: Titel Online, zwei erklaerende Tueren (Partie, Raetsel-Duell) ohne Knopf und Schatten, Zum Konto', await seite.evaluate(() => ({
    titel: document.querySelector('.online-screen .seiten-kopf h1')?.textContent,
    karten: [...document.querySelectorAll('.online-screen .on-art')].map((k) => k.dataset.art).join(),
    knoepfeInTueren: document.querySelectorAll('.online-screen .on-art button').length,
    schatten: [...document.querySelectorAll('.online-screen .on-art')].map((k) => getComputedStyle(k).boxShadow).filter((x) => x !== 'none').length,
    knopf: document.querySelector('[data-online="konto"]')?.textContent.trim(),
    zurueck: !!document.querySelector('.online-screen .kopf-zurueck'),
    alt: !!document.querySelector('[data-online="training"]') })).then((r) => r.titel === 'Online' && r.karten === 'partie,duell'
      && r.knoepfeInTueren === 0 && r.schatten === 0 && r.knopf === 'Zum Konto' && r.zurueck && !r.alt));
  // Design-Durchsicht U 09.11.2026: unter "Schach gegen einen Menschen" stand nur "ohne Kronen" (gilt nur unter Freunden)
  const kontoSatz = await seite.locator('.online-screen .on-konto p').first().innerText();
  pruefe('Ohne Anmeldung: Konto-Karte sagt, dass Partie und Duell um Kronen gehen und nur Freundes-Partien ohne', /um Kronen/.test(kontoSatz) && /Freund[^.]*ohne Kronen/.test(kontoSatz), kontoSatz);
  // R5-1 (Kundenblick 09.11.2026): auch das Freundesspiel braucht ein Konto; der Satz darf es nicht wie einen Weg ohne Konto lesen lassen
  pruefe('Ohne Anmeldung: Konto-Karte beginnt mit "Mit Konto" und nennt Freunde im selben Satz (R5-1)', /^Mit Konto [^.]*Freunden[^.]*ohne Kronen\./.test(kontoSatz), kontoSatz);
  pruefe('Ohne Anmeldung: Hinweis und gemerkter Link, keine Server-Anfrage', (await seite.locator('.online-screen').innerText()).includes('Anmelden geht mit einem Code per E-Mail')
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
  await seite.waitForFunction(() => document.querySelector('.on-art[data-art="partie"]')?.dataset.zustand === 'bald').catch(() => {});
  pruefe('Ohne Liga auf dem Server: Gegnersuche ruhig "kommt bald", ohne Suchknopf, ohne Fehlermeldung, ohne Liga-Streifen', await seite.evaluate(() => {
    const k = document.querySelector('.on-art[data-art="partie"]');
    return k?.dataset.zustand === 'bald' && /kommt bald/.test(k.textContent) && k.querySelector('[data-online="suchen"]').hidden
      && k.querySelector('.on-zeit-fest').hidden && document.querySelector('.on-meldung').hidden && document.querySelector('.on-liga').hidden;
  }));
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
  // Flo 11.11.2026 (Befund 3): Remis anbieten und Aufgeben als zwei sichtbare Knoepfe unter dem Brett wie in der Bot-Partie,
  // nicht mehr hinter der Fahne; der Aufgeben-Dialog fragt nur noch nach dem Aufgeben
  pruefe('Remis anbieten und Aufgeben stehen sichtbar in der Knopfreihe, ohne Fahnen-Dialog', await seite.evaluate(() => {
    const reihe = document.querySelector('.online-partie .spielknoepfe');
    return [...reihe.querySelectorAll('.knopf')].filter((b) => b.getClientRects().length).map((b) => b.dataset.online).join() === 'remis,aufgeben';
  }));
  await knopf('remis').click();
  await seite.getByRole('button', { name: 'Remis angeboten', exact: true }).waitFor();
  pruefe('Remis anbieten erreicht den Server', weiss.remis_angebot === 'w');
  weiss.remis_angebot = 'b'; aktualisieren(weiss);
  await knopf('annehmen').waitFor();
  pruefe('Remis-Angebot des Gegners deutlich sichtbar: Streifen mit Namen, Annehmen als Hauptknopf', await seite.evaluate(() => {
    const s = document.querySelector('.on-angebot'), r = s?.getBoundingClientRect();
    return !s.hidden && r.height > 0 && /bietet dir Remis an/.test(s.textContent)
      && document.querySelector('[data-online="annehmen"]').classList.contains('primaer');
  }));
  await knopf('annehmen').click();
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
  // R4 (12.11.2026, d8d128e): gewertet beendet der Server eine Partie ohne 2. Halbzug nach 30 s, die Oberflaeche fragt nach
  // 31 s (HAENGT_RANKED_MS); Freundespartien bleiben bei 10 Minuten. Gegenfall zuerst: Freundespartie nach 32 s noch offen
  const freundHaengt = partie({ zuege: 'e2e4', zeit: 300 }); await oeffne(freundHaengt);
  await seite.evaluate(() => { window.__versatz += 32 * 1000; });
  await seite.waitForTimeout(1500);
  pruefe('Freundespartie ohne 2. Halbzug: nach 32 s keine Abfrage, die Partie laeuft weiter', freundHaengt.status === 'laeuft'
    && !calls.some(c => c.pfad.endsWith('online_pruefe_zeit') && c.body.partie === freundHaengt.id) && await seite.locator('.on-ergebnis').isHidden());
  await seite.evaluate(() => { window.__versatz = 0; });
  const rankedHaengt = partie({ zuege: 'e2e4', zeit: 300, gewertet: true }); await oeffne(rankedHaengt);
  await seite.evaluate(() => { window.__versatz += 20 * 1000; });
  await seite.waitForTimeout(1500);
  const rankedZuFrueh = calls.some(c => c.pfad.endsWith('online_pruefe_zeit') && c.body.partie === rankedHaengt.id);
  await seite.evaluate(() => { window.__versatz += 12 * 1000; });
  const rankedEnde = await seite.locator('.on-ergebnis:not([hidden])').waitFor({ timeout: 5000 }).then(() => true).catch(() => false);
  pruefe('Gewertete Partie ohne 2. Halbzug: nach 20 s noch keine Abfrage, nach 32 s abgebrochen mit Blatt "Partie beendet"', !rankedZuFrueh && rankedEnde
    && calls.filter(c => c.pfad.endsWith('online_pruefe_zeit') && c.body.partie === rankedHaengt.id).length === 1
    && rankedHaengt.grund === 'abgebrochen' && (await seite.locator('.on-ergebnis h3').innerText()) === 'Partie beendet'
    && (await seite.locator('.on-ergebnis').innerText()).includes('zu lange kein Zug'), { rankedZuFrueh, rankedEnde, p: rankedHaengt });
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
  // Etappe 4b: Visitenkarten in den Spielerleisten (Banner, Name, Titel aus karte_der_partie)
  await seite.waitForFunction(() => document.querySelectorAll('.on-spieler.mit-banner').length === 2, null, { timeout: 8000 }).catch(() => {});
  const leisten = await seite.evaluate(() => [...document.querySelectorAll('.on-spieler')].map((x) => ({ name: x.querySelector('b')?.textContent,
    titel: x.querySelector('.on-titel')?.textContent || '', banner: /saison-silber\.svg/.test(x.querySelector('.on-banner')?.style.backgroundImage || '') })));
  // ?kern laedt das Paket sammlung nicht: der Titel faellt dann bewusst weg (Ort karte:fremde? ohne Anbieter);
  // mit Paket loest tests/karte.test.mjs den Titel auf
  pruefe('Etappe 4b: beide Spielerleisten mit Banner und Namen vom Server, ohne Paket sammlung kein Titel', leisten.length === 2
    && leisten.every((l) => l.banner && !l.titel)
    && leisten.some((l) => l.name === 'Gegner_2') && leisten.some((l) => l.name === 'Spieler_1') && karteFragen.includes(direkt.id), { leisten, karteFragen });
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
        knoepfe: [...document.querySelectorAll('.online-screen button')].filter(b => b.getClientRects().length > 0).every(b => b.getBoundingClientRect().height >= 44), karten: document.querySelectorAll('.on-spieler > .av > :is(svg, img)').length === 2 };
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
  // Die bisher geoeffneten Freundes-Partien laufen in der Attrappe noch. Mit laufender Partie zeigt die Partie-Tuer
  // "Partie fortsetzen" statt der Suche (eigene Pruefung am Ende); fuer die Such-Pruefungen hier alle beenden.
  for (const q of partien.values()) if (q.status === 'laeuft') { Object.assign(q, { status: 'beendet', grund: 'aufgabe', ergebnis: '1-0' }); aktualisieren(q); }
  ligaDa = true;
  // ohne gemerkte Einladung bleibt die Freunde-Zeile zu (so sieht ein Spieler die Seite normalerweise)
  await seite.evaluate(() => localStorage.removeItem('schach-arena:online:einladung'));
  await seite.evaluate(() => window.__app.gehe('online'));
  await seite.waitForFunction(() => document.querySelector('.on-art[data-art="partie"]')?.dataset.zustand === 'bereit').catch(() => {});
  // Ranked hat eine feste Bedenkzeit 5+3 (Punkt 40, Konzept "Zwei Ligen"): keine Zeitwahl, nur der Hinweis
  pruefe('Mit Liga auf dem Server: Gegnersuche mit fester Bedenkzeit 5 + 3 (keine Wahl) und Suchknopf', await seite.evaluate(() => {
    const k = document.querySelector('.on-art[data-art="partie"]');
    return k?.dataset.zustand === 'bereit' && !k.querySelector('[data-online="suchen"]').hidden && !k.querySelector('.on-zeit-fest').hidden
      && /5 \+ 3/.test(k.querySelector('.on-zeit-fest').textContent) && !k.querySelector('[role="radio"], .on-zeiten');
  }));
  // Handybreite (Lehre aus Auftrag V: die Online-Pruefung lief nur auf 1180 px). iPhone 13, hell und dunkel: Liga-Streifen,
  // zwei Tueren, jeder Suchen-Knopf traegt "gewertet", Freunde-Zeile; alles ohne Scrollen und ohne Beispiel-Liga.
  for (const modus of ['hell', 'dunkel']) {
    await seite.setViewportSize({ width: 390, height: 844 }); await seite.evaluate(m => window.__app.setzeEinstellungen({ modus: m }), modus);
    // der alte, schon gefuellte Online-Screen steht nach gehe() noch kurz da (zeigeScreen laedt async, seit #223 merkt es sich
    // vorher die Scrollposition): ihn markieren und erst den neuen Screen pruefen, sonst misst der Test den leeren Platzhalter
    await seite.evaluate(() => { const s = document.querySelector('.online-screen'); if (s) s.dataset.alt = '1'; window.__app.gehe('online'); });
    // seit #216 steht der Streifen schon als Platzhalter da: warten, bis die Liga-Antwort ihn gefuellt hat
    await seite.waitForFunction(() => document.querySelector('.online-screen') && !document.querySelector('.online-screen').dataset.alt
      && document.querySelector('.on-art[data-art="partie"]')?.dataset.zustand === 'bereit' && !document.querySelector('.on-liga').hidden
      && !document.querySelector('.on-liga').hasAttribute('data-laedt'));
    const handy = await seite.evaluate(() => {
      const rumpf = document.querySelector('.online-screen .on-rumpf');
      const leiste = document.querySelector('.reiter-leiste');
      const unten = leiste && leiste.getClientRects().length ? leiste.getBoundingClientRect().top : innerHeight;
      const zeile = document.querySelector('.on-freunde-zeile').getBoundingClientRect();
      const knoepfe = [...document.querySelectorAll('.on-tuer-knopf:not([hidden])')].map((b) => b.textContent.trim());
      return { scroll: rumpf.scrollHeight - rumpf.clientHeight, quer: document.documentElement.scrollWidth <= innerWidth,
        freundeSichtbar: zeile.bottom <= unten + 1, knoepfe, gewertet: knoepfe.length === 2 && knoepfe.every((t) => /gewertet/.test(t)),
        freundeZu: !document.querySelector('.on-freunde').open, liga: document.querySelector('.on-liga').textContent.replace(/\s+/g, ' ').trim(),
        beispiel: /Beispiel|Turmfalke|Rochade77/.test(document.querySelector('.online-screen').textContent),
        klein: [...document.querySelectorAll('.online-screen .on-inhalt button, .online-screen .on-freunde-zeile')].filter((b) => b.getClientRects().length && b.getBoundingClientRect().height < 44).map((b) => b.className) };
    });
    pruefe(`iPhone 13 ${modus}: Online passt ohne Scrollen (Liga-Streifen, zwei Tueren, Freunde-Zeile), Suchen-Knoepfe "gewertet", keine Beispiel-Liga`,
      handy.scroll <= 1 && handy.quer && handy.freundeSichtbar && handy.gewertet && handy.freundeZu && /Platz 3 von 30/.test(handy.liga) && /140/.test(handy.liga)
      && !handy.beispiel && handy.klein.length === 0, handy);
    if (process.env.BILDER) await seite.screenshot({ path: path.join(process.env.BILDER, `online-tueren-390-${modus}.png`) });
  }
  // W-lobby (R6 B21): am PC stand "Partie suchen" 29 px tiefer als "Duell suchen" (365 gegen 336). Nebeneinander sind beide
  // Karten gleich hoch und beide Knoepfe sitzen am Kartenfuss, also auf gleicher Hoehe; untereinander sitzt der Knopf ebenfalls
  // am Fuss. Auf allen Geraeten, hell und dunkel, ohne Querscrollen.
  for (const [geraet, width, height] of [['iPhone 13', 390, 844], ['iPhone SE', 375, 667], ['iPad hoch', 820, 1180], ['iPad quer', 1180, 820],
    ['PC', 1280, 720], ['PC gross', 1920, 1080]]) for (const modus of ['hell', 'dunkel']) {
    await seite.setViewportSize({ width, height }); await seite.evaluate(m => window.__app.setzeEinstellungen({ modus: m }), modus);
    await seite.waitForFunction(m => document.documentElement.dataset.modus === m, modus);
    await seite.waitForTimeout(80);
    const t = await seite.evaluate(() => [...document.querySelectorAll('.on-tueren > .on-tuer')].map((k) => {
      const r = k.getBoundingClientRect(), b = [...k.querySelectorAll('.on-tuer-knopf')].find((x) => x.getClientRects().length).getBoundingClientRect();
      const pad = parseFloat(getComputedStyle(k).paddingBottom);
      return { top: Math.round(r.top), unten: Math.round(r.bottom), knopfOben: Math.round(b.top), fuss: Math.round(r.bottom - pad - b.bottom),
        drin: b.left >= r.left - 1 && b.right <= r.right + 1 };
    }).concat([{ quer: document.documentElement.scrollWidth <= innerWidth }]));
    const [a, d, { quer }] = t, nebeneinander = Math.abs(a.top - d.top) <= 1;
    pruefe(`W-lobby ${geraet} ${modus}: Knoepfe von Partie und Duell am Kartenfuss${nebeneinander ? ', auf gleicher Hoehe' : ''}, kein Ueberlauf`,
      quer && a.drin && d.drin && Math.abs(a.fuss) <= 1 && Math.abs(d.fuss) <= 1
      && (!nebeneinander || (Math.abs(a.knopfOben - d.knopfOben) <= 1 && Math.abs(a.unten - d.unten) <= 1)), { a, d, quer, nebeneinander });
    if (process.env.BILDER) await seite.screenshot({ path: path.join(process.env.BILDER, `online-tueren-${width}-${modus}.png`) });
  }
  // G-005 AC-06: kein Springen beim Laden. iPhone SE, die Liga-Antwort kommt 700 ms spaet; gezaehlt wird jede Verschiebung
  // ohne Eingabe davor (Layout-Shift-API, wie der Web-Vital CLS). Vorher 0,167: Liga-Streifen und Suchkarte wuchsen erst mit der Antwort.
  {
    await seite.setViewportSize({ width: 375, height: 667 });
    ligaVerzug = 700;
    await seite.evaluate(() => window.__app.gehe('heim'));
    await seite.evaluate(() => {
      window.__cls = 0; window.__clsQuellen = [];
      window.__clsBeob = new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) {
        window.__cls += e.value; for (const s of e.sources || []) window.__clsQuellen.push(s.node?.className || s.node?.nodeName || '?'); } });
      window.__clsBeob.observe({ type: 'layout-shift' });
      window.__app.gehe('online');
    });
    await seite.waitForFunction(() => document.querySelector('.on-art[data-art="partie"]')?.dataset.zustand === 'bereit');
    await seite.waitForTimeout(400);
    const cls = await seite.evaluate(() => { window.__clsBeob.disconnect(); return { wert: +window.__cls.toFixed(4), quellen: [...new Set(window.__clsQuellen)].slice(0, 6) }; });
    ligaVerzug = 0;
    pruefe('iPhone SE: Online springt beim Laden nicht (CLS unter 0,1, Liga-Antwort 700 ms spaet)', cls.wert < 0.1, cls);
    pruefe('iPhone SE: nach der Pruefung Suchknopf frei, Liga-Platzhalter ersetzt',await seite.evaluate(() =>
      [...document.querySelectorAll('[data-online="suchen"]')].every((b) => !b.disabled)
      && !document.querySelector('.on-liga').hasAttribute('data-laedt')));
  }
  // Gegnersuche Partie (Konzept 3 A), altes SQL: Ring mit Restzeit, "Jetzt gegen KI" startet ohne Server eine Uebungspartie
  await seite.evaluate(() => { window.__onlineBotMs = 60000; });
  await knopf('suchen').click();
  await seite.locator('.on-suche:not([hidden])').waitFor();
  await seite.waitForTimeout(1300);
  const suchend = await seite.evaluate(() => ({ rest: document.querySelector('.on-rest').textContent, kopfWeg: document.querySelector('.on-art[data-art="partie"] .on-tuer-kopf').hidden,
    ring: Number(document.querySelector('.on-ring-rest').getAttribute('stroke-dashoffset')), hinweis: document.querySelector('.on-ki-hinweis').textContent,
    titel: document.querySelector('.on-suche h3').textContent.replace(/\s+/g, ' ').trim(), knopf: document.querySelector('[data-online="ki-jetzt"]').textContent.trim() }));
  pruefe('Suche: "Suche Gegner … 0:01", Restzeit zaehlt sichtbar herunter (Satz und Ring), Knopf "Sofort gegen den Bot" mit "zaehlt nicht fuer die Liga"',
    /^Noch 5[89] s/.test(suchend.rest) && /^Suche Gegner … 0:0[12]$/.test(suchend.titel) && suchend.knopf === 'Sofort gegen den Bot'
    && suchend.ring > 0 && suchend.kopfWeg && /nicht für die Liga/.test(suchend.hinweis), suchend);
  await knopf('ki-jetzt').click();
  await seite.waitForFunction(() => location.hash.startsWith('#partie'));
  const geschaut = await seite.evaluate(() => history.state?.params || null);
  pruefe('Altes SQL, "Jetzt gegen KI" vor der Grenze: Suche beim Server beendet (ki false), Uebungspartie 5+3 gegen einen Bot, ohne KI-Beleg',
    calls.some((c) => c.pfad.endsWith('online_suche_ende') && c.body.ki === false) && !calls.some((c) => c.pfad.endsWith('online_suche_ende') && c.body.ki === true)
    && calls.filter((c) => c.pfad.endsWith('online_suche_start')).every((c) => c.body.zeit === '5+3')
    && geschaut?.modus === 'uebung' && geschaut?.tempo?.grund === 300 && geschaut?.tempo?.zuschlag === 3 && !geschaut?.ki && !!geschaut?.botId, geschaut);
  await seite.evaluate(() => { delete window.__onlineBotMs; });
  // Neues SQL: 30 s Wartezeit vom Server, "Jetzt gegen KI" ab ki_ab_s (1 s) gewertet ueber online_suche_ende(true)
  neuesSql = { seit: new Date().toISOString() };
  await seite.evaluate(() => window.__app.gehe('online'));
  await seite.waitForFunction(() => document.querySelector('.on-art[data-art="partie"]')?.dataset.zustand === 'bereit');
  neuesSql.seit = new Date().toISOString();
  await knopf('suchen').click();
  await seite.locator('.on-suche:not([hidden])').waitFor();
  await seite.waitForFunction(() => /^Noch (29|30) s/.test(document.querySelector('.on-rest').textContent));
  const frueh = await seite.evaluate(() => document.querySelector('.on-ki-hinweis').textContent);
  await seite.waitForFunction(() => /jetzt für die Liga/.test(document.querySelector('.on-ki-hinweis').textContent), null, { timeout: 5000 });
  const vorKi = calls.length;
  await knopf('ki-jetzt').click();
  await seite.waitForFunction(() => location.hash.startsWith('#partie'));
  const gewertet = await seite.evaluate(() => history.state?.params || null);
  await seite.waitForFunction(() => /Verlassen zählt als Niederlage/.test(document.querySelector('.toast-ort .toast')?.textContent || ''), null, { timeout: 3000 }).catch(() => {});
  const verlassenNeu = await seite.evaluate(() => document.querySelector('.toast-ort .toast')?.textContent || '');
  const neu = calls.slice(vorKi);
  pruefe('Neues SQL: Restzeit 30 s vom Server, ab ki_ab_s "zaehlt jetzt", Knopf beendet mit ki true und spielt gewertet mit Beleg in 5+3',
    /noch nicht/.test(frueh) && neu.some((c) => c.pfad.endsWith('online_suche_ende') && c.body.ki === true) && !neu.some((c) => c.pfad.endsWith('online_suche_ende') && c.body.ki === false)
    && gewertet?.ki === true && gewertet?.kiRef === '0b6c1e2d-3a4b-4c8d-9e0a-1b2c3d4e5f60' && gewertet?.tempo?.grund === 300 && gewertet?.tempo?.zuschlag === 3 && !gewertet?.modus, { frueh, gewertet });
  pruefe('Neues SQL: beim Start der gewerteten KI-Partie der Hinweis "Verlassen zählt als Niederlage"', /Verlassen zählt als Niederlage/.test(verlassenNeu), verlassenNeu);
  neuesSql = null;
  // Gegenprobe altes SQL: auch mit Beleg nach der Wartezeit kein Hinweis (dort gibt es den Schutz aus #213 nicht)
  altBeleg = true;
  await seite.evaluate(() => window.__app.gehe('online'));
  await seite.waitForFunction(() => document.querySelector('.on-art[data-art="partie"]')?.dataset.zustand === 'bereit');
  await seite.evaluate(() => { window.__onlineBotMs = 400; });
  await knopf('suchen').click();
  await seite.waitForFunction(() => location.hash.startsWith('#partie') && history.state?.params?.kiRef, null, { timeout: 8000 });
  await seite.waitForTimeout(600);
  const verlassenAlt = await seite.evaluate(() => ({ toast: [...document.querySelectorAll('.toast-ort .toast')].map((t) => t.textContent).join(' | '), p: history.state?.params }));
  pruefe('Altes SQL mit Beleg: gewertete KI-Partie, aber kein Hinweis "Verlassen"', verlassenAlt.p?.ki === true && !!verlassenAlt.p?.kiRef
    && !/Verlassen/.test(verlassenAlt.toast), verlassenAlt);
  await seite.evaluate(() => { delete window.__onlineBotMs; });
  altBeleg = false;
  // Befund 5 (Flo 11.11.2026): "Sofort gegen den Bot" ab Sekunde 0, gesteuert allein vom Serverwert (hier ki_ab_s 0, warte_s 10)
  neuesSql = { seit: new Date().toISOString(), warte: 10, kiAb: 0 };
  await seite.evaluate(() => window.__app.gehe('online'));
  await seite.waitForFunction(() => document.querySelector('.on-art[data-art="partie"]')?.dataset.zustand === 'bereit');
  neuesSql.seit = new Date().toISOString();
  await knopf('suchen').click();
  await seite.locator('.on-suche:not([hidden])').waitFor();
  // die Werte kommen mit der ersten Server-Antwort (vorher gelten die alten 10 s); gemessen wird noch in Sekunde 0
  await seite.waitForFunction(() => /jetzt für die Liga/.test(document.querySelector('.on-ki-hinweis').textContent), null, { timeout: 1500 }).catch(() => {});
  const sofort = await seite.evaluate(() => { const b = document.querySelector('[data-online="ki-jetzt"]');
    return { uhr: document.querySelector('.on-art[data-art="partie"] .on-uhr')?.textContent, rest: document.querySelector('.on-rest').textContent, hinweis: document.querySelector('.on-ki-hinweis').textContent, knopf: b?.textContent.trim(), sichtbar: !!b?.getClientRects().length }; });
  pruefe('Serverwert ki_ab_s 0: "Sofort gegen den Bot" ab Sekunde 0 sichtbar und zaehlt fuer die Liga, Restzeit 10 s vom Server',
    /^0:0[01]$/.test(sofort.uhr) && /^Noch (9|10) s/.test(sofort.rest) && /jetzt für die Liga/.test(sofort.hinweis) && sofort.knopf === 'Sofort gegen den Bot' && sofort.sichtbar, sofort);
  await knopf('ki-jetzt').click();
  await seite.waitForFunction(() => location.hash.startsWith('#partie'));
  pruefe('Sofort gegen den Bot in Sekunde 0: gewertete Partie mit Beleg', await seite.evaluate(() => history.state?.params?.ki === true && !!history.state?.params?.kiRef));
  neuesSql = null;
  // Befund 2 ("kein Zug", 11.11.2026): zwei gewertete Partien liefen parallel, jedes Geraet zeigte eine andere. Die Online-Seite
  // bietet die NEUESTE laufende an (nicht die zuletzt geaenderte), in der aelteren weist ein Hinweis auf die neuere.
  const aeltere = partie({ farbe: 'b', zuege: 'e2e4', zeit: 300, gewertet: true, code: 'NPQ234' });
  aeltere.erstellt_am = new Date(Date.now() - 5 * 60000).toISOString(); // aelter als die Intro-Frist (1 Minute)
  const neueste = partie({ farbe: 'w', zeit: 300, gewertet: true, code: 'RST567' });
  zug(aeltere, 'e7e5'); // die aeltere wurde zuletzt geaendert: sie darf trotzdem nicht gewinnen
  await seite.evaluate(() => { window.__duellProtokoll = []; window.__app.gehe('online'); });
  await seite.waitForFunction(() => document.querySelector('.on-art[data-art="partie"]')?.dataset.zustand === 'laufend');
  const tuer = await seite.evaluate(() => { const b = document.querySelector('[data-online="fortsetzen"]');
    return { sichtbar: !!b?.getClientRects().length, id: b?.dataset.partie, text: b?.textContent.trim(), suchen: !document.querySelector('[data-online="suchen"]').getClientRects().length }; });
  pruefe('Laufende Partie: Partie-Tuer zeigt "Partie fortsetzen" fuer die neueste Partie statt einer zweiten Suche', tuer.sichtbar && tuer.id === neueste.id
    && tuer.text === 'Partie fortsetzen' && tuer.suchen, tuer);
  await knopf('fortsetzen').click();
  await seite.waitForFunction(id => window.__online?.partie()?.id === id && !window.__online.busy(), neueste.id);
  pruefe('Fortsetzen oeffnet die neueste laufende Partie', true);
  await seite.waitForFunction(() => (window.__duellProtokoll || []).some(e => e.bot === 'online'), null, { timeout: 5000 }).catch(() => {});
  const intro = await seite.evaluate(() => (window.__duellProtokoll || []).filter(e => e.bot === 'online'));
  pruefe('Ranked-Partie: Duell-Intro wie vor einer Bot-Partie, genau einmal, Anlass Liga', intro.length === 1 && intro[0].anlass === 'liga', intro);
  await oeffne(aeltere); await seite.waitForFunction(id => window.__online?.partie()?.id === id, aeltere.id);
  await seite.locator('.on-neuer:not([hidden])').waitFor();
  pruefe('Aeltere Partie offen: Hinweis auf die neuere laufende Partie mit Knopf dorthin', await seite.locator('.on-neuer [data-partie]').getAttribute('data-partie') === neueste.id);
  await seite.locator('.on-neuer [data-partie]').click();
  await seite.waitForFunction(id => window.__online?.partie()?.id === id && !window.__online.busy(), neueste.id);
  pruefe('Hinweis-Knopf wechselt in die neuere Partie, Intro laeuft dort nicht ein zweites Mal', await seite.evaluate(() =>
    (window.__duellProtokoll || []).filter(e => e.bot === 'online').length === 1));
  // Intro mit Bewegung: Name und Liga des Gegners stehen im Bild (Befund 4 im Laufzettel, Flo: "wie bei der Bot-Partie")
  {
    const frisch = partie({ farbe: 'w', zeit: 300, gewertet: true, code: 'UVW234' });
    await seite.evaluate(() => window.__app.setzeEinstellungen({ bewegung: 'normal' }));
    await oeffne(frisch);
    const bild = await seite.waitForFunction(() => { const d = document.querySelector('.duell'); return d && d.textContent.replace(/\s+/g, ' ').trim(); }, null, { timeout: 5000 })
      .then(h => h.jsonValue()).catch(() => '');
    pruefe('Intro mit Bewegung zeigt Gegnername und Liga', /Gegner_2/.test(bild) && /Läufer II/.test(bild), bild);
    await seite.waitForFunction(() => !document.querySelector('.duell'), null, { timeout: 8000 }).catch(() => {});
    await seite.evaluate(() => window.__app.setzeEinstellungen({ bewegung: 'aus' }));
    // beenden, damit "neueste" fuer die Groessenpruefung wieder die neueste ist (sonst steht dort der Hinweis-Streifen)
    Object.assign(frisch, { status: 'beendet', grund: 'aufgabe', ergebnis: '1-0' }); aktualisieren(frisch);
  }
  // Abnahme (Laufzettel Befund 1, Mass wie tests/online-ranked-probe.test.mjs): Online-Brett mindestens so gross wie in der
  // Bot-Partie. Ohne Coach-Zeile darf es auf dem Handy etwas groesser sein (390 x 664: 384 statt 376 px).
  for (const [width, height] of [[375, 667], [390, 664], [820, 1180], [1280, 720]]) {
    await seite.setViewportSize({ width, height });
    await oeffne(neueste); await seite.waitForFunction(id => window.__online?.partie()?.id === id, neueste.id);
    await seite.waitForTimeout(250);
    const on = await seite.evaluate(() => Math.round([...document.querySelectorAll('.online-screen .brett-rahmen > .brett')].at(-1).getBoundingClientRect().width));
    if (process.env.BILDER) await seite.screenshot({ path: path.join(process.env.BILDER, `groesse-online-${width}x${height}.png`) });
    await seite.evaluate(() => window.__app.gehe('partie', { botId: 'fridolin' }));
    await seite.waitForFunction(() => document.querySelector('.screen.partie:not(.online-screen) .brett-rahmen > .brett')?.getBoundingClientRect().width > 0);
    await seite.waitForTimeout(250);
    const bot = await seite.evaluate(() => Math.round(document.querySelector('.screen.partie:not(.online-screen) .brett-rahmen > .brett').getBoundingClientRect().width));
    if (process.env.BILDER) await seite.screenshot({ path: path.join(process.env.BILDER, `groesse-bot-${width}x${height}.png`) });
    pruefe(`${width}x${height}: Online-Brett mindestens so gross wie das Brett der Bot-Partie`, on >= bot - 1, { online: on, bot });
  }
  // R8-quer (13.11.2026): Handy quer (Hoehe bis 500 px): Brett und beide Leisten ganz im Bild, keine Seite scrollt, jeder
  // sichtbare Knopf erreichbar (im Bild, mindestens 44 px hoch), kein Text laeuft aus seinem Knopf
  for (const [width, height] of [[844, 390], [667, 375]]) {
    await seite.setViewportSize({ width, height });
    await oeffne(neueste); await seite.waitForFunction(id => window.__online?.partie()?.id === id, neueste.id);
    await seite.waitForTimeout(400);
    const q = await seite.evaluate(() => {
      const sicht = (e) => !e.hidden && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden' && !e.closest('[hidden], .weg');
      const imBild = (r) => r.top >= -0.5 && r.bottom <= innerHeight + 0.5 && r.left >= -0.5 && r.right <= innerWidth + 0.5;
      const brett = [...document.querySelectorAll('.online-screen .brett-felder')].at(-1)?.getBoundingClientRect();
      const leisten = [...document.querySelectorAll('.online-screen .on-spieler')].filter(sicht).map((e) => imBild(e.getBoundingClientRect()));
      const knoepfe = [...document.querySelectorAll('.online-screen button')].filter(sicht).map((b) => ({ t: (b.getAttribute('aria-label') || b.textContent).trim().slice(0, 16),
        bild: imBild(b.getBoundingClientRect()), h: Math.round(b.getBoundingClientRect().height), passt: b.scrollWidth <= b.clientWidth + 1 && b.scrollHeight <= b.clientHeight + 1 }));
      return { brett: !!brett && imBild(brett), leisten: leisten.length === 2 && leisten.every(Boolean), scroll: document.documentElement.scrollHeight <= innerHeight + 1 && document.documentElement.scrollWidth <= innerWidth + 1,
        schlecht: knoepfe.filter((k) => !k.bild || k.h < 44 || !k.passt) };
    });
    if (process.env.BILDER) await seite.screenshot({ path: path.join(process.env.BILDER, `quer-online-${width}x${height}.png`) });
    pruefe(`Handy quer ${width}x${height}: Online-Brett und Leisten im Bild, kein Scrollen, Knoepfe erreichbar`, q.brett && q.leisten && q.scroll && q.schlecht.length === 0, q);
  }
  // Befund 4 (Skin): Erfinder-Konto mit Figurensatz Blaupause; die Erfinder-Antwort kommt erst nach dem Aufbau der Partie
  erfinder = true; sonderVerzug = 900;
  // wie auf einem frischen Geraet: der gemerkte Erfinder-Status fehlt, die App fragt erst nach dem Laden nach
  await seite.evaluate(() => { sessionStorage.setItem('test:einstellungen', JSON.stringify({ figuren: 'blaupause' })); localStorage.removeItem('schach-arena:konto:sonderstuecke'); });
  await seite.reload(); await seite.evaluate(id => window.__app.gehe('online', { partieId: id }), neueste.id);
  await seite.waitForFunction(() => document.querySelector('.on-brett img[src*="blaupause"]'), null, { timeout: 8000 }).catch(() => {});
  const skin = await seite.evaluate(() => {
    const bilder = [...document.querySelectorAll('.on-brett img')].map(i => i.getAttribute('src'));
    return { bilder: bilder.length, fremd: bilder.filter(s => !/blaupause/.test(s)).slice(0, 2), figuren: JSON.parse(localStorage.getItem('schach-arena:v1:einstellungen') || '{}').figuren,
      sonder: localStorage.getItem('schach-arena:konto:sonderstuecke'), partie: window.__online?.partie()?.id };
  });
  if (process.env.BILDER) await seite.screenshot({ path: path.join(process.env.BILDER, 'skin-blaupause.png') });
  pruefe('Online-Brett nutzt den eingestellten Figurensatz, auch wenn der Erfinder-Status spaet kommt', skin.bilder > 0 && skin.fremd.length === 0, skin);
  erfinder = false; sonderVerzug = 0;
  // R2 (Feinschliff 11.11.2026, Flos Variante): Live-Bewertung eigener Zuege. Gewertet: Kontingent beim Start fragen,
  // erst beim ersten eigenen Zug buchen, Symbol am Zielfeld, nichts zum Gegner
  const symbol = f => seite.locator(`.on-brett .abzeichen-ort[data-feld="${f}"]`);
  const liveRufe = ab => calls.slice(ab).filter(c => /online_live_bewertung/.test(c.pfad)).map(c => c.pfad.split('/').at(-1).replace('online_live_bewertung_', '') + ':' + c.body.partie);
  const liveText = () => seite.evaluate(() => { const el = document.querySelector('.on-live'); return el && !el.hidden ? el.textContent : ''; });
  liveFrei = { frei: true, rest: 1, unbegrenzt: false };
  const gw = partie({ gewertet: true }), vorGw = calls.length; await oeffne(gw);
  await seite.waitForFunction(() => /heute noch/.test(document.querySelector('.on-live')?.textContent));
  pruefe('Gewertet: beim Start nur frei mit der Partie, Hinweis "heute noch 1 Partie frei", noch nichts gebucht',
    liveRufe(vorGw).join() === 'frei:' + gw.id && /heute noch 1 Partie frei/.test(await liveText()), { rufe: liveRufe(vorGw), text: await liveText() });
  await tippe('e2e4'); await symbol('e4').waitFor();
  await seite.waitForFunction(() => /deine freie/.test(document.querySelector('.on-live').textContent));
  pruefe('Erster eigener Zug: genau einmal nutzen, Symbol am Zielfeld, Hinweis "diese Partie ist deine freie"',
    liveRufe(vorGw).join() === `frei:${gw.id},nutzen:${gw.id}` && await seite.locator('.on-brett .abzeichen-ort').count() === 1, liveRufe(vorGw));
  const analysen = await seite.evaluate(() => window.__liveAnalysen.length);
  zug(gw, 'e7e5'); await seite.waitForFunction(() => window.__online.chess().history().length === 2);
  await seite.waitForTimeout(300);
  pruefe('Gegnerzug: keine Analyse, kein Symbol am Feld des Gegners', await seite.evaluate(() => window.__liveAnalysen.length) === analysen && await symbol('e5').count() === 0);
  await tippe('g1f3'); await symbol('f3').waitFor();
  pruefe('Zweiter eigener Zug: Symbol wandert mit, keine zweite Buchung', liveRufe(vorGw).filter(r => r.startsWith('nutzen')).length === 1 && await symbol('e4').count() === 0);
  liveFrei = { frei: false, rest: 0, unbegrenzt: false };
  const leer = partie({ gewertet: true }), vorLeer = calls.length; await oeffne(leer);
  await seite.waitForFunction(() => /morgen wieder/.test(document.querySelector('.on-live')?.textContent));
  await tippe('e2e4'); await seite.waitForFunction(() => window.__online.partie().zuege.endsWith('e2e4') && !window.__online.busy());
  await seite.waitForTimeout(300);
  pruefe('Kontingent aufgebraucht: Hinweis "morgen wieder" mit Premium, kein nutzen, kein Symbol',
    /morgen wieder/.test(await liveText()) && /Premium/.test(await liveText()) && liveRufe(vorLeer).join() === 'frei:' + leer.id && await symbol('e4').count() === 0, { rufe: liveRufe(vorLeer), text: await liveText() });
  liveFrei = { frei: true, rest: null, unbegrenzt: true };
  const prem = partie({ gewertet: true }); await oeffne(prem);
  await tippe('e2e4'); await symbol('e4').waitFor();
  pruefe('Premium: Symbol ohne Kontingent-Hinweis', await liveText() === '');
  liveFrei = { frei: true, rest: 1, unbegrenzt: false };
  const freund = partie(), vorFreund = calls.length; await oeffne(freund);
  await tippe('e2e4'); await symbol('e4').waitFor();
  pruefe('Freundespartie: live wie in der Bot-Partie, ohne Kontingent-Abfrage und ohne Hinweis', liveRufe(vorFreund).length === 0 && await liveText() === '');
  // R2: die Probe sah beim Fortsetzen ein Brett ohne Zuege. Gemessen war es ein Tipp auf das 0 px breite Brett beim
  // Screen-Wechsel (Zug kam nie an); diese Pruefung haelt fest, dass das erste sichtbare Bild schon alle Figuren zeigt
  await seite.evaluate(() => sessionStorage.setItem('test:einstellungen', JSON.stringify({ bewegung: 'normal' })));
  const fort = partie({ zuege: 'e2e4 e7e5 g1f3' }); await seite.goto(start + '#online');
  // das erste Bild, in dem das Brett Flaeche hat: wie viele Figuren stehen dort, und wie viele sind noch durchscheinend?
  await seite.evaluate(id => {
    window.__erstesBild = null;
    const sieh = () => {
      const b = document.querySelector('.on-brett');
      if (!b || b.getBoundingClientRect().width <= 100) { requestAnimationFrame(sieh); return; }
      const f = [...b.querySelectorAll('img.figur')];
      window.__erstesBild = { n: f.length, blass: f.filter(x => Number(getComputedStyle(x).opacity) < 0.99).length };
    };
    requestAnimationFrame(sieh);
    window.__app.gehe('online', { partieId: id });
  }, fort.id);
  await seite.waitForFunction(() => window.__erstesBild);
  const erstes = await seite.evaluate(() => window.__erstesBild);
  pruefe('Fortsetzen mit Bewegung: im ersten sichtbaren Bild stehen alle 32 Figuren voll da, kein leeres Brett', erstes.n === 32 && erstes.blass === 0, erstes);
  await seite.evaluate(() => sessionStorage.removeItem('test:einstellungen'));
  // R7 (Gesamtdurchgang R6, Gleichheits-Liste B2/B3/B5): Das Ende einer Online-Partie zeigt dasselbe Ergebnisblatt wie die
  // Bot-Partie (css/ergebnis.css): Kopfwort, Grund, Kronen-Aenderung (nur gewertet, aus kronen_mein_stand vor und nach dem
  // Ende), "Zur Analyse" mit den Zuegen der Partie, Revanche und Meine Partien; alle Knoepfe im Bild auf iPhone SE und iPad
  // hoch; die ruhende Uhr in der Leiste mit Banner ist im hellen Modus lesbar. Eigene Route mit Vorrang (Playwright fragt
  // die zuletzt angelegte zuerst), damit sich der Kronen-Stand zwischen Start und Ende aendern laesst.
  let r7Kronen = 140, r7Rufe = 0;
  const r7Stand = route => { r7Rufe++; return route.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ stufe: 7, kronen: r7Kronen, platz: 3, ziel: 120, n: 30, woche: '2026-11-02' }) }); };
  await kontext.route('**/rest/v1/rpc/kronen_mein_stand', r7Stand);
  const r7Bild = async name => { if (process.env.BILDER) await seite.screenshot({ path: path.join(process.env.BILDER, `r7-${name}.png`) }); };
  const r7Modus = async modus => {
    await seite.evaluate(m => window.__app.setzeEinstellungen({ modus: m }), modus);
    await seite.waitForFunction(m => document.documentElement.dataset.modus === m, modus, { timeout: 5000 }).catch(() => {});
  };
  const r7Blatt = () => seite.evaluate(() => {
    const o = document.querySelector('.online-screen .ergebnis-overlay');
    if (!o || o.hidden) return null;
    return { art: o.className, wort: o.querySelector('.erg-wort')?.textContent.trim(), unter: o.querySelector('.erg-unter')?.textContent.trim(),
      kronen: o.querySelector('.on-erg-kronen')?.textContent.replace(/\s+/g, ' ').trim() || '',
      knoepfe: [...o.querySelectorAll('button')].filter(b => b.getClientRects().length).map(b => b.dataset.online || b.className) };
  });
  const r7Warte = () => seite.waitForFunction(() => { const o = document.querySelector('.online-screen .ergebnis-overlay'); return o && !o.hidden; }, null, { timeout: 6000 }).then(() => true, () => false);
  await seite.setViewportSize({ width: 1180, height: 820 });
  const r7 = partie({ gewertet: true, zuege: 'e2e4 e7e5 g1f3 b8c6' });
  await oeffne(r7);
  await seite.waitForFunction(() => window.__online?.partie()?.status === 'laeuft');
  await seite.waitForTimeout(400);
  const r7RufeVor = r7Rufe;
  // Gegner gibt auf: der Server bucht die Kronen (Trigger in supabase/kronen-schema.sql), der Stand steigt auf 170
  r7Kronen = 170; Object.assign(r7, { status: 'beendet', grund: 'aufgabe', ergebnis: '1-0' }); aktualisieren(r7);
  await seite.waitForFunction(() => window.__online?.partie()?.status === 'beendet', null, { timeout: 8000 });
  const r7Da = await r7Warte();
  await seite.waitForTimeout(600);
  await r7Bild('ende-gewertet-1180x820-hell');
  const r7B = await r7Blatt();
  pruefe('R7 B2: gewertetes Ende zeigt das Ergebnisblatt der Bot-Partie (Sieg!, Grund, Zur Analyse, Revanche, Meine Partien)',
    r7Da && /\bsieg\b/.test(r7B?.art) && r7B?.wort === 'Sieg!' && r7B?.unter === 'Aufgabe'
      && ['analyse', 'revanche', 'liste-zurueck'].every(k => r7B.knoepfe.includes(k)), r7B);
  pruefe('R7 B2: Kronen-Aenderung aus kronen_mein_stand (vor dem Ende 140, danach 170): "+30" und der neue Wochenstand',
    r7RufeVor >= 1 && /\+30/.test(r7B?.kronen || '') && /170/.test(r7B?.kronen || ''), { kronen: r7B?.kronen, r7RufeVor });
  // Auge: Brett ansehen; das Blatt kommt ueber "Ergebnis" in der Spalte zurueck
  await seite.locator('.online-screen .ergebnis-overlay .erg-zu').click().catch(() => {});
  const r7Zu = await seite.evaluate(() => ({ blatt: document.querySelector('.online-screen .ergebnis-overlay')?.hidden,
    zeigen: !!document.querySelector('.online-screen [data-online="ergebnis-zeigen"]')?.getClientRects().length }));
  await seite.locator('.online-screen [data-online="ergebnis-zeigen"]').click().catch(() => {});
  const r7Auf = await r7Warte();
  pruefe('R7 B2: Auge zeigt das Brett, "Ergebnis" holt das Blatt zurueck', r7Zu.blatt === true && r7Zu.zeigen && r7Auf, { r7Zu, r7Auf });
  // "Zur Analyse" oeffnet die Spielanalyse (.an-screen) mit genau den Zuegen der Online-Partie und beiden Namen
  await seite.locator('.online-screen .ergebnis-overlay [data-online="analyse"]').click({ timeout: 3000 }).catch(() => {});
  const r7An = await seite.waitForFunction(() => document.querySelector('.an-screen'), null, { timeout: 8000 }).then(() => true, () => false);
  const r7AnDaten = await seite.evaluate(id => {
    const liste = JSON.parse(localStorage.getItem('schach-arena:v1:partien') || '[]');
    const p = liste.find(x => x && x.id === 'on-' + id);
    return { unter: document.querySelector('.an-screen .an-unter')?.textContent || '', zuege: p?.zuege?.join(' '), ergebnis: p?.ergebnis, farbe: p?.spielerFarbe, n: liste.length };
  }, r7.id);
  // W-online-analyse: Kopf wie die Bot-Partie "Du gegen <Gegner>" (vorher "Spieler_1 gegen Gegner_2" wie Zu zweit)
  pruefe('R7 B2: "Zur Analyse" oeffnet .an-screen mit den Zuegen der Online-Partie, Kopf "Du gegen Gegner_2"',
    r7An && r7AnDaten.zuege === 'e2e4 e7e5 g1f3 b8c6' && r7AnDaten.ergebnis === 'sieg' && r7AnDaten.farbe === 'w' && /^Du gegen Gegner_2/.test(r7AnDaten.unter), r7AnDaten);
  // Zweimal "Zur Analyse": dieselbe Partie wird ersetzt, nicht doppelt gespeichert
  await oeffne(r7); await r7Warte();
  await seite.locator('.online-screen .ergebnis-overlay [data-online="analyse"]').click({ timeout: 3000 }).catch(() => {});
  await seite.waitForFunction(() => document.querySelector('.an-screen'), null, { timeout: 8000 }).catch(() => {});
  const r7Zweimal = await seite.evaluate(() => JSON.parse(localStorage.getItem('schach-arena:v1:partien') || '[]').length);
  pruefe('R7 B2: zweimal Zur Analyse legt die Partie nur einmal ab', r7AnDaten.n >= 1 && r7Zweimal === r7AnDaten.n, { vorher: r7AnDaten.n, nachher: r7Zweimal });
  // Freundespartie: dasselbe Blatt ohne Kronen-Zeile
  const r7F = partie({ zuege: 'e2e4 e7e5' }); await oeffne(r7F);
  Object.assign(r7F, { status: 'beendet', grund: 'remis', ergebnis: '1/2-1/2' }); aktualisieren(r7F);
  await seite.waitForFunction(() => window.__online?.partie()?.status === 'beendet', null, { timeout: 8000 });
  const r7FDa = await r7Warte(); await seite.waitForTimeout(300);
  const r7FB = await r7Blatt();
  pruefe('R7 B2: Freundespartie bekommt dasselbe Blatt ohne Kronen-Zeile (Remis, Zur Analyse)',
    r7FDa && /\bremis\b/.test(r7FB?.art) && r7FB?.kronen === '' && r7FB.knoepfe.includes('analyse') && r7FB.knoepfe.includes('revanche'), r7FB);
  // Strittig: Blatt "Strittig" ohne Sieg oder Niederlage; seit W-online-analyse mit Zur Analyse (die Analyse rechnet den
  // nachgespielten, legalen Stand und nennt das Ende ehrlich "Strittig beendet")
  const r7S = partie({ zuege: 'e2e4' }); await oeffne(r7S);
  Object.assign(r7S, { status: 'beendet', grund: 'strittig', ergebnis: null }); aktualisieren(r7S);
  await seite.waitForFunction(() => window.__online?.partie()?.status === 'beendet', null, { timeout: 8000 });
  await r7Warte(); await seite.waitForTimeout(300);
  const r7SB = await r7Blatt();
  pruefe('R7 B2: strittiges Ende: Blatt "Strittig", mit Zur Analyse (W-online-analyse)', r7SB?.wort === 'Strittig' && r7SB.knoepfe.includes('analyse'), r7SB);
  // ---------- W-online-analyse (Flo 13.11.2026: "beim 1 gegen 1 fehlt die Analyse") ----------
  // Funktionsprobe 1: gewertete Partie, Spieler_1 mit Schwarz verliert durch Schaefermatt. Das Blatt wird nur geschlossen
  // (Auge, kein Klick auf "Zur Analyse"), danach Meine Partien: die Partie steht dort als "Online" mit dem Gegnernamen und
  // oeffnet die Analyse mit "Du gegen Gegner_2", eigener Farbe Schwarz unten und am Schluesselmoment (kurze Niederlage).
  const woaListe = () => seite.evaluate(() => JSON.parse(localStorage.getItem('schach-arena:v1:partien') || '[]'));
  const woa = partie({ farbe: 'b', gewertet: true, zuege: 'e2e4 e7e5 f1c4 b8c6 d1h5' });
  await oeffne(woa);
  await seite.waitForFunction(() => window.__online?.partie()?.status === 'laeuft');
  const woaLaufend = (await woaListe()).some(x => x.id === 'on-' + woa.id);
  pruefe('W-online-analyse: waehrend die gewertete Partie laeuft, liegt nichts fuer die Analyse auf dem Geraet und kein Analyse-Knopf',
    !woaLaufend && !(await seite.locator('.online-screen [data-online="analyse"]').count()), { woaLaufend });
  zug(woa, 'g8f6'); zug(woa, 'h5f7');
  Object.assign(woa, { status: 'beendet', grund: 'matt', ergebnis: '1-0' }); aktualisieren(woa);
  await seite.waitForFunction(() => window.__online?.partie()?.status === 'beendet', null, { timeout: 8000 });
  await r7Warte(); await seite.waitForTimeout(600);
  await seite.locator('.online-screen .ergebnis-overlay .erg-zu').click().catch(() => {});
  const woaGespeichert = (await woaListe()).find(x => x.id === 'on-' + woa.id);
  pruefe('W-online-analyse: beim Ende ohne Klick abgelegt (Online, Schwarz, Niederlage durch Matt, Gegnername, alle 7 Zuege)',
    woaGespeichert?.online?.gewertet === true && woaGespeichert.spielerFarbe === 'b' && woaGespeichert.ergebnis === 'niederlage'
      && woaGespeichert.grund === 'matt' && woaGespeichert.zuzweit?.weiss === 'Gegner_2' && woaGespeichert.zuege?.length === 7, woaGespeichert);
  await seite.evaluate(() => window.__app.gehe('verlauf'));
  await seite.waitForFunction(() => document.querySelector('.vl-screen .vl-zeile'), null, { timeout: 8000 }).catch(() => {});
  const woaZeile = await seite.evaluate(id => {
    const z = document.querySelector(`.vl-screen .vl-zeile[data-id="on-${id}"]`);
    return z ? { name: z.querySelector('.vl-name')?.textContent, chip: z.querySelector('.vl-uebung')?.textContent, erg: z.querySelector('.vl-ergebnis')?.textContent,
      farbe: z.querySelector('.vl-z3')?.textContent } : null;
  }, woa.id);
  pruefe('W-online-analyse: Meine Partien zeigt sie mit Kennzeichen "Online", Gegnername, Niederlage und eigener Farbe',
    woaZeile?.name === 'Gegner_2' && woaZeile.chip === 'Online' && /Niederlage/.test(woaZeile.erg) && /Schwarz/.test(woaZeile.farbe), woaZeile);
  await seite.locator(`.vl-screen .vl-zeile[data-id="on-${woa.id}"] .vl-oeffnen`).click({ timeout: 3000 }).catch(() => {});
  const woaAn = await seite.waitForFunction(() => document.querySelector('.an-screen .an-c-kopf'), null, { timeout: 90000 }).then(() => true, () => false);
  await seite.waitForTimeout(500);
  const woaAnalyse = await seite.evaluate(() => ({
    unter: document.querySelector('.an-screen .an-unter')?.textContent || '',
    unten: document.querySelector('.an-screen .an-evalbalken')?.dataset.unten,
    zug: document.querySelector('.an-screen .an-c-zug')?.textContent || '',
    start: !!document.querySelector('.an-screen .an-c-start'),
    vs: document.querySelector('.an-screen .an-vs-wort')?.textContent || '',
    zuZweit: /gewinnt/.test(document.querySelector('.an-screen .an-genau')?.textContent || ''),
    knoepfe: [...document.querySelectorAll('.an-screen .an-kopf-knoepfe [data-aktion]')].map(b => b.dataset.aktion),
  }));
  pruefe('W-online-analyse: Analyse "Du gegen Gegner_2", Schwarz unten, "Niederlage" (nicht "<Name> gewinnt"), Start am Schluesselmoment 3... Sf6',
    woaAn && /^Du gegen Gegner_2/.test(woaAnalyse.unter) && woaAnalyse.unten === 'b' && woaAnalyse.vs === 'Niederlage' && !woaAnalyse.zuZweit
      && !woaAnalyse.start && /Sf6/.test(woaAnalyse.zug) && woaAnalyse.knoepfe.includes('online') && !woaAnalyse.knoepfe.includes('weiter'), woaAnalyse);
  // Funktionsprobe 3: Neuladen nach dem Ende und erneutes Oeffnen legen keinen zweiten Eintrag an (die Analyse bleibt)
  const woaVor = (await woaListe()).length;
  await seite.reload(); await seite.waitForFunction(() => window.__app?.gehe, null, { timeout: 15000 });
  await oeffne(woa); await r7Warte(); await seite.waitForTimeout(300);
  const woaNach = await woaListe();
  pruefe('W-online-analyse: Neuladen und erneutes Oeffnen nach dem Ende: kein Doppel-Eintrag, Analyse bleibt',
    woaNach.length === woaVor && woaNach.filter(x => x.id === 'on-' + woa.id).length === 1 && woaNach.find(x => x.id === 'on-' + woa.id)?.analysiert === true,
    { woaVor, nach: woaNach.length, eintrag: woaNach.find(x => x.id === 'on-' + woa.id) });
  // Funktionsprobe 2: Abbruch nach einem Zug (Server: abgebrochen, ohne Ergebnis) hat den Analyse-Knopf; abgelegt ehrlich
  // ohne Ergebnis mit Grund "abgebrochen", die Analyse nennt es so und nie Remis
  const woaAb = partie({ gewertet: true, zuege: 'e2e4' }); await oeffne(woaAb);
  Object.assign(woaAb, { status: 'beendet', grund: 'abgebrochen', ergebnis: null }); aktualisieren(woaAb);
  await seite.waitForFunction(() => window.__online?.partie()?.status === 'beendet', null, { timeout: 8000 });
  await r7Warte(); await seite.waitForTimeout(300);
  const woaAbB = await r7Blatt();
  const woaAbE = (await woaListe()).find(x => x.id === 'on-' + woaAb.id);
  pruefe('W-online-analyse: Abbruch nach einem Zug: Blatt mit "Zur Analyse", abgelegt ohne Ergebnis mit Grund abgebrochen',
    woaAbB?.knoepfe.includes('analyse') && woaAbE && woaAbE.ergebnis == null && woaAbE.grund === 'abgebrochen' && woaAbE.online?.gewertet === true, { woaAbB, woaAbE });
  await seite.locator('.online-screen .ergebnis-overlay [data-online="analyse"]').click({ timeout: 3000 }).catch(() => {});
  await seite.waitForFunction(() => document.querySelector('.an-screen .an-vs-wort'), null, { timeout: 90000 }).catch(() => {});
  const woaAbA = await seite.evaluate(() => ({ vs: document.querySelector('.an-screen .an-vs-wort')?.textContent || '',
    grund: document.querySelector('.an-screen .an-vs-grund')?.textContent || '' }));
  pruefe('W-online-analyse: Analyse des Abbruchs sagt "Ohne Ergebnis" und "Partie abgebrochen", nicht Remis', woaAbA.vs === 'Ohne Ergebnis' && woaAbA.grund === 'Partie abgebrochen', woaAbA);
  // zurueck zum strittigen Blatt fuer die Bild-Pruefungen B3 unten
  await oeffne(r7S); await r7Warte(); await seite.waitForTimeout(300);
  // B3: alle Knoepfe des Blatts (und mit geschlossenem Blatt der Knopf "Ergebnis") im Bild, hell und dunkel
  for (const [width, height, name] of [[375, 667, 'iphone-se'], [768, 1024, 'ipad-hoch'], [1280, 800, 'pc']]) {
    for (const modus of ['hell', 'dunkel']) {
      await seite.setViewportSize({ width, height });
      await r7Modus(modus);
      await oeffne(r7); await r7Warte(); await seite.waitForTimeout(700);
      await r7Bild(`ende-${name}-${modus}`);
      const mass = await seite.evaluate(() => {
        const o = document.querySelector('.online-screen .ergebnis-overlay');
        const knoepfe = o && !o.hidden ? [...o.querySelectorAll('button')].filter(b => b.getClientRects().length) : [];
        const sp = knoepfe.map(b => { const r = b.getBoundingClientRect(); return { k: b.dataset.online || b.className, oben: Math.round(r.top), unten: Math.round(r.bottom) }; });
        return { innen: innerHeight, knoepfe: sp, raus: sp.filter(x => x.unten > innerHeight + 0.5 || x.oben < -0.5) };
      });
      pruefe(`R7 B3 ${width}x${height} ${modus}: alle Knoepfe des Ergebnisblatts im Bild (Revanche, Meine Partien, Zur Analyse)`,
        mass.knoepfe.length >= 4 && !mass.raus.length && ['revanche', 'liste-zurueck', 'analyse'].every(k => mass.knoepfe.some(x => x.k === k)), mass);
      if (modus === 'hell') {
        await seite.locator('.online-screen .ergebnis-overlay .erg-zu').click().catch(() => {});
        await seite.waitForTimeout(400);
        await r7Bild(`brett-${name}-${modus}`);
        const z = await seite.evaluate(() => { const b = document.querySelector('.online-screen [data-online="ergebnis-zeigen"]'); const r = b?.getBoundingClientRect();
          return b && b.getClientRects().length ? { oben: Math.round(r.top), unten: Math.round(r.bottom), innen: innerHeight } : null; });
        pruefe(`R7 B3 ${width}x${height}: Blatt zu, der Knopf "Ergebnis" steht im Bild`, !!z && z.unten <= z.innen + 0.5 && z.oben >= 0, z);
      }
    }
  }
  // B5: ruhende Uhr in der Leiste mit Banner (visitenkarte.css setzt dort weisse Schrift) im hellen und dunklen Modus
  const r7Kontrast = () => seite.evaluate(() => {
    const rgb = s => { const m = String(s).match(/[\d.]+/g)?.map(Number) || []; return /^color\(srgb/.test(s) ? { r: m[0] * 255, g: m[1] * 255, b: m[2] * 255, a: m[3] ?? 1 } : { r: m[0], g: m[1], b: m[2], a: m[3] ?? 1 }; };
    const ueber = (o, u) => ({ r: o.r * o.a + u.r * (1 - o.a), g: o.g * o.a + u.g * (1 - o.a), b: o.b * o.a + u.b * (1 - o.a), a: 1 });
    const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
    return [...document.querySelectorAll('.online-screen .spieler .uhr[data-farbe]')].filter(u => !u.hidden && !u.classList.contains('laeuft')).map(u => {
      const bg = rgb(getComputedStyle(u).backgroundColor);
      const vg = ueber(rgb(getComputedStyle(u.querySelector('.uhr-zeit')).color), bg);
      const [x, y] = [lum(vg), lum(bg)].sort((p, q) => q - p);
      return { farbe: u.dataset.farbe, deckend: bg.a >= 1, banner: u.parentElement.classList.contains('mit-banner'), kontrast: Math.round((x + 0.05) / (y + 0.05) * 100) / 100 };
    });
  });
  await seite.setViewportSize({ width: 1180, height: 820 });
  for (const modus of ['hell', 'dunkel']) {
    await r7Modus(modus);
    const r7U = partie({ zuege: 'e2e4 e7e5', zeit: 300 }); await oeffne(r7U);
    await seite.waitForFunction(() => document.querySelectorAll('.online-screen .spieler.mit-banner .uhr-zeit').length === 2, null, { timeout: 8000 }).catch(() => {});
    await seite.waitForTimeout(300);
    await r7Bild(`uhr-1180x820-${modus}`);
    const k = await r7Kontrast();
    pruefe(`R7 B5 ${modus}: ruhende Uhr in der Leiste mit Banner hat Kontrast mindestens 3:1 (gemessen)`, k.length >= 1 && k.every(x => x.deckend && x.banner && x.kontrast >= 3), k);
    Object.assign(r7U, { status: 'beendet', grund: 'aufgabe', ergebnis: '1-0' }); aktualisieren(r7U);
  }
  // R7 Kopf (Befund B12 aus R6, Vorbild Bot-Partie): Zugliste als Karte mit Pfeilen zum Blaettern (quer) bzw. Zugstreifen
  // mit Pfeilen (hoch), die rechte Spalte ohne leeren Block, im Kopf der Gegner als Titel statt "Crownmate", die Brettwahl
  // im Kopf (quer). Fairness (Muss): waehrend einer laufenden gewerteten Partie keine Bewertungsleiste.
  const kopfBild = async name => { if (process.env.BILDER) await seite.screenshot({ path: path.join(process.env.BILDER, `kopf-${name}.png`) }); };
  const kopfMass = () => seite.evaluate(() => {
    const sc = document.querySelector('.online-screen');
    const sicht = el => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
    const seiteEl = sc.querySelector('.seite');
    // groesste senkrechte Luecke ohne sichtbaren Inhalt in der Spalte: Text, Bilder und Flaechen mit Hintergrund oder Schatten
    const r0 = seiteEl.getBoundingClientRect();
    const stuecke = [];
    for (const el of seiteEl.querySelectorAll('*')) {
      if (!sicht(el)) continue;
      const cs = getComputedStyle(el), r = el.getBoundingClientRect();
      if (r.height < 1 || r.width < 1) continue;
      // Text zaehlt mit seiner Zeilenhoehe, nicht mit der Hoehe des Kastens (ein gestreckter Absatz mit einer Zeile ist leer)
      for (const n of el.childNodes) {
        if (n.nodeType !== 3 || !n.textContent.trim()) continue;
        const rg = document.createRange(); rg.selectNodeContents(n);
        for (const q of rg.getClientRects()) if (q.height >= 1) stuecke.push([q.top, q.bottom]);
      }
      const flaeche = !/rgba\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor) || cs.boxShadow !== 'none' || cs.backgroundImage !== 'none';
      if (flaeche || /^(IMG|svg)$/i.test(el.tagName)) stuecke.push([r.top, r.bottom]);
    }
    stuecke.sort((a, b) => a[0] - b[0]);
    let luecke = 0, bis = r0.top;
    for (const [o, u] of stuecke) { luecke = Math.max(luecke, o - bis); bis = Math.max(bis, u); }
    luecke = Math.round(Math.max(luecke, r0.bottom - bis));
    const pfeile = [...sc.querySelectorAll('[data-online="zug-zurueck"], [data-online="zug-vor"]')].filter(sicht).length;
    return { titel: sc.querySelector('.haupt-kopf .marke-titel')?.textContent.trim(), unter: sc.querySelector('.haupt-kopf .logo-unter')?.textContent.trim() || '',
      luecke, quer: matchMedia('(orientation: landscape)').matches, pfeile,
      zellen: [...sc.querySelectorAll('.zugliste .z[data-ply], .zugleiste .z[data-ply]')].filter(sicht).length,
      brettwahl: [...sc.querySelectorAll('.haupt-kopf .brettwahl button[data-brett]')].filter(sicht).length,
      balken: [...sc.querySelectorAll('.evalbalken')].filter(sicht).length, scroll: document.documentElement.scrollWidth <= innerWidth + 1 };
  });
  for (const [width, height, name] of [[390, 844, 'iphone13'], [1180, 820, 'ipad-quer'], [1920, 1080, 'pc']]) {
    for (const modus of ['hell', 'dunkel']) {
      await seite.setViewportSize({ width, height });
      await r7Modus(modus);
      const kp = partie({ gewertet: true, zuege: 'e2e4 e7e5 g1f3 b8c6', zeit: 300 }); await oeffne(kp);
      await seite.waitForFunction(() => document.querySelectorAll('.online-screen .spieler.mit-banner').length === 2, null, { timeout: 8000 }).catch(() => {});
      await seite.waitForTimeout(500);
      await kopfBild(`${name}-${modus}`);
      const m = await kopfMass();
      if (modus === 'hell') {
        pruefe(`R7 Kopf ${name}: Titel ist der Gegner (wie die Bot-Partie), nicht "Crownmate"`, m.titel === 'Gegner_2' && /Du spielst Weiß/.test(m.unter), m);
        pruefe(`R7 Kopf ${name}: Zuege mit Pfeilen zum Blaettern sichtbar`, m.pfeile >= 2 && m.zellen >= 4, m);
        pruefe(`R7 Kopf ${name}: laufende gewertete Partie ohne Bewertungsleiste (Fairness), kein waagrechtes Scrollen`, m.balken === 0 && m.scroll, m);
        if (m.quer) {
          pruefe(`R7 Kopf ${name}: rechte Spalte ohne leeren Block (Luecke <= 200 px)`, m.luecke <= 200, m);
          pruefe(`R7 Kopf ${name}: Brettwahl im Kopf (drei Brettfarben)`, m.brettwahl === 3, m);
        }
      }
      Object.assign(kp, { status: 'beendet', grund: 'aufgabe', ergebnis: '1-0' }); aktualisieren(kp);
    }
  }
  // Blaettern quer (iPad): zurueck zeigt die Stellung davor auf einem Ansichts-Brett, vor geht weiter, "Zur Partie" schliesst;
  // ein Zug des Gegners waehrend der Ansicht fuehrt zur Partie zurueck. Brettwahl wirkt sofort.
  await seite.setViewportSize({ width: 1180, height: 820 }); await r7Modus('hell');
  const kb = partie({ farbe: 'b', gewertet: true, zuege: 'e2e4 e7e5 g1f3 b8c6' }); await oeffne(kb);
  const ansicht = () => seite.evaluate(() => { const a = document.querySelector('.online-screen .zug-ansicht');
    return a ? { schild: a.querySelector('.za-schild')?.textContent.trim(),
      vorZu: document.querySelector('.online-screen .zugbox [data-online="zug-vor"]')?.disabled } : null; });
  const tippeKopf = async sel => { await seite.locator(sel).click(); await seite.waitForTimeout(250); };
  await tippeKopf('.online-screen .zugbox [data-online="zug-zurueck"]');
  const a1 = await ansicht();
  await tippeKopf('.online-screen .zugbox [data-online="zug-zurueck"]');
  const a2 = await ansicht();
  await tippeKopf('.online-screen .zugbox [data-online="zug-vor"]');
  const a3 = await ansicht();
  pruefe('R7 Kopf Blaettern: zurueck zeigt 2. Sf3, nochmal 1… e5, vor wieder 2. Sf3; vor ist in der Ansicht frei',
    a1?.schild === '2. Sf3' && a2?.schild === '1… e5' && a3?.schild === '2. Sf3' && a3.vorZu === false, { a1, a2, a3 });
  await tippeKopf('.online-screen .zug-ansicht [data-online="zug-live"]');
  pruefe('R7 Kopf Blaettern: "Zur Partie" schliesst die Ansicht', await ansicht() === null);
  await tippeKopf('.online-screen .zugliste .z[data-ply="1"]');
  const a4 = await ansicht();
  zug(kb, 'f1c4');
  await seite.waitForFunction(() => window.__online?.chess()?.history().length === 5, null, { timeout: 8000 }).catch(() => {});
  await seite.waitForTimeout(300);
  pruefe('R7 Kopf Blaettern: Zug in der Liste antippen zeigt ihn, ein neuer Zug des Gegners fuehrt zur Partie zurueck', a4?.schild === '1… e5' && await ansicht() === null, a4);
  await seite.keyboard.press('ArrowLeft'); await seite.waitForTimeout(250);
  const a5 = await ansicht();
  await seite.keyboard.press('Escape'); await seite.waitForTimeout(250);
  pruefe('R7 Kopf Blaettern: Pfeiltaste links blaettert, Escape schliesst', a5?.schild === '2… Sc6' && await ansicht() === null, a5);
  await tippeKopf('.online-screen .haupt-kopf .brettwahl button[data-brett="holz"]');
  const bw = await seite.evaluate(() => ({ brett: document.documentElement.dataset.brett,
    an: document.querySelector('.online-screen .brettwahl button[aria-checked="true"]')?.dataset.brett }));
  await tippeKopf('.online-screen .haupt-kopf .brettwahl button[data-brett="nacht"]');
  pruefe('R7 Kopf Brettwahl: Holz wirkt sofort und ist markiert', bw.brett === 'holz' && bw.an === 'holz', bw);
  Object.assign(kb, { status: 'beendet', grund: 'aufgabe', ergebnis: '0-1' }); aktualisieren(kb);
  await seite.waitForFunction(() => window.__online?.partie()?.status === 'beendet', null, { timeout: 8000 }).catch(() => {});
  await r7Modus('system');
  await kontext.unroute('**/rest/v1/rpc/kronen_mein_stand', r7Stand);
  pruefe('Keine Seitenfehler oder unerwarteten API-Aufrufe', !fehler.length && !unerwartet.length, { fehler, unerwartet });
} catch (e) {
  pruefe('Ablauf ohne Abbruch', false, e.stack);
  if (process.env.BILDER) await kontext?.pages()[0]?.screenshot({ path: path.join(process.env.BILDER, 'online-abbruch.png') }).catch(() => {});
}
finally { await kontext?.close(); await browser?.close(); await new Promise(r => server.close(r)); }
console.log(`\n${ok}/${gesamt} bestanden`); process.exitCode = ok === gesamt ? 0 : 1;
