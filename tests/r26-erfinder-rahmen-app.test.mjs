// R26 (Flo 21.11.2026: "Mein Rahmen wird nicht angezeigt, wenn die Runde gestartet wird"): das eigene Bild in jedem
// Startbild traegt die eigene Wahl (Erfinder: Koenig mit Rahmen erfinder-blatt-0), auf frischem Geraet (Antwort der
// Sonderstuecke kommt erst nach 2,5 s) und mit Merker. Gemessen am data-rahmen/data-figur des eigenen svg:
//   Bot-Partie (Spielerleiste .av), Duell-Intro (.duell-av flo), Online-Partie (eigene Leiste unten), Raetsel-Duell (Start).
// Ursache Online: die eigene Leiste nahm das Bild der Server-Karte, und die kennt Erfinder-Rahmen und Koenig mit Absicht
// nicht (js/karte.js KARTE_RAHMEN/KARTE_MOTIVE). Die Karte, die der Gegner sieht, bleibt so: sie wird hier nicht geprueft
// und nicht geaendert (karte_waehle traegt nie den Erfinder-Rahmen, letzte Pruefung).
import http from 'node:http';
import path from 'node:path';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

let ok = 0, gesamt = 0;
function pruefe(name, gut, info = '') {
  gesamt++; if (gut) ok++;
  console.log(`${gut ? 'ok  ' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(info)}`);
}
const require = createRequire(import.meta.url);
let pw;
for (const p of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
  try { pw = require(p); break; } catch (e) { /* naechster */ }
}
if (!pw) throw new Error('Playwright fehlt');
const BILDER = process.env.BILDER_ORDNER || '';
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

const UID = 'u1';
const sitzung = { access_token: 'a.' + Buffer.from(JSON.stringify({ sub: UID })).toString('base64url') + '.x', refresh_token: 'test-r', expires_at: 9999999999, user: { id: UID, email: 'spieler@example.invalid' } };
const ERFINDER = ['erfinder-titel', 'erfinder-banner-blatt-0', 'erfinder-figuren-blaupause', 'erfinder-finisher-signatur'];
const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const jetztIso = () => new Date().toISOString();
const ONLINE = { id: 'partie-1', code: 'ABC234', weiss: UID, schwarz: 'u2', erstellt_von: UID, status: 'laeuft', fen: START_FEN, am_zug: 'w', zuege: '',
  ergebnis: null, grund: null, remis_angebot: null, bedenkzeit_s: null, inkrement_s: 0, uhr_weiss_ms: null, uhr_schwarz_ms: null,
  letzter_zug_am: jetztIso(), erstellt_am: jetztIso(), aktualisiert_am: jetztIso(), gewertet: true };
const VERZUG_MS = 2500;

async function kontext(browser, merker) {
  const k = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', locale: 'de-DE', timezoneId: 'Europe/Berlin' });
  const gesendet = [];
  await k.route('**/*.supabase.co/**', async (route) => {
    const req = route.request(), url = new URL(req.url());
    const antwort = d => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
    if (url.pathname === '/rest/v1/sonderstuecke') { await new Promise(r => setTimeout(r, VERZUG_MS)); return antwort(ERFINDER.map(stueck_id => ({ stueck_id }))); }
    if (url.pathname.startsWith('/auth/v1/')) return antwort({ id: UID, email: 'spieler@example.invalid' });
    if (url.pathname === '/rest/v1/profile') return antwort([{ user_id: UID, benutzername: 'Spieler_1' }]);
    if (url.pathname === '/rest/v1/partien_online') {
      if (url.searchParams.has('status')) return antwort([]);
      return antwort((url.searchParams.get('id') || '').slice(3) === ONLINE.id ? [ONLINE] : []);
    }
    const rpc = url.pathname.split('/').at(-1);
    if (rpc === 'karte_waehle') { try { gesendet.push(req.postDataJSON()); } catch (e) { /* egal */ } }
    if (rpc === 'online_meine') return antwort([ONLINE]);
    // die eigene Karte vom Server: ohne Erfinder-Rahmen und ohne Koenig (so liefert sie der echte Server)
    if (rpc === 'karte_der_partie') {
      const karte = (name, du) => ({ name, banner: 'start', titel: null, vitrine: [], motiv: 'Q', grund: 'standard', rahmen: 'ohne', kronen_stufe: 3, du });
      return antwort({ w: karte('Spieler_1', true), s: karte('Gegner_2', false) });
    }
    return antwort([]);
  });
  await k.addInitScript(({ s, uid, merker, ids }) => {
    if (!sessionStorage.getItem('probe-start')) {
      sessionStorage.setItem('probe-start', '1');
      localStorage.clear();
      localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ klang: false, bewegung: 'aus', liveBewertung: false, tiefe: 8, duellIntro: 'immer' }));
      localStorage.setItem('schach-arena:konto:sichtbar', '1');
      localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(s));
      localStorage.setItem('schach-arena:v1:einstellungen:sammeln', JSON.stringify({ profil: { figur: 'K', rahmen: 'erfinder-blatt-0' } }));
      if (merker) localStorage.setItem('schach-arena:konto:sonderstuecke', JSON.stringify({ konto: uid, ids }));
    }
    window.__test = { ...window.__test, botAnhalten: true, maxWarten: 0 };
  }, { s: sitzung, uid: UID, merker, ids: ERFINDER });
  const s = await k.newPage(); s.setDefaultTimeout(15000);
  const fehler = [];
  s.on('pageerror', e => fehler.push(e.message));
  await s.goto(`http://127.0.0.1:${PORT}/index.html?test#heim`);
  await s.waitForFunction(() => window.__app && typeof window.__app.gehe === 'function' && document.querySelector('.screen.heim-screen'), null, { timeout: 20000 });
  return { k, s, fehler, gesendet };
}
const bild = (s, sel) => s.waitForSelector(sel, { timeout: 10000 }).then(() => s.evaluate((sel) => {
  const e = document.querySelector(sel); return e ? { figur: e.dataset.figur, rahmen: e.dataset.rahmen } : null;
}, sel)).catch(() => null);
const istEigen = (b) => !!b && b.figur === 'K' && b.rahmen === 'erfinder-blatt-0';

let browser;
try {
  browser = await pw.chromium.launch();
  for (const merker of [false, true]) {
    const fall = merker ? 'mit Merker' : 'frisches Geraet';
    const { k, s, fehler, gesendet } = await kontext(browser, merker);
    // Bot-Partie: eigene Spielerleiste
    await s.evaluate(() => window.__app.gehe('partie', { botId: 'benno', farbe: 'w' }));
    const partie = await bild(s, '.screen .av svg[data-rahmen]');
    pruefe(`${fall}: Bot-Partie, eigene Leiste mit Koenig und Erfinder-Rahmen`, istEigen(partie), partie);
    // Duell-Intro (dasselbe Intro vor Bot-, Online- und Raetsel-Duell)
    await s.evaluate(async () => {
      const { spieleDuell } = await import(new URL('js/ui/duell.js', location.href).href);
      window.__duell = spieleDuell({ bot: { id: 'benno', name: 'Benno', elo: 800 }, farbe: 'w', art: 'voll', einstellung: 'immer' });
    });
    const intro = await bild(s, '.duell-av[data-rolle="flo"] svg');
    pruefe(`${fall}: Duell-Intro, eigenes Bild mit Koenig und Erfinder-Rahmen`, istEigen(intro), intro);
    await s.evaluate(() => { try { window.__duell?.ueberspringe(); } catch (e) { /* egal */ } });
    await s.waitForTimeout(600);
    // Online-Partie: eigene Leiste unten (nach der Karte vom Server)
    await s.evaluate((id) => window.__app.gehe('online', { partieId: id }), ONLINE.id);
    await s.waitForFunction(() => document.querySelector('.on-unten .av svg') && document.querySelector('.on-oben .av svg')?.dataset.figur === 'Q', null, { timeout: 10000 }).catch(() => {});
    await s.waitForTimeout(400);
    const online = await bild(s, '.on-unten .av svg');
    pruefe(`${fall}: Online-Partie, eigene Leiste mit Koenig und Erfinder-Rahmen`, istEigen(online), online);
    const gegner = await bild(s, '.on-oben .av svg');
    pruefe(`${fall}: Online-Partie, der Gegner bleibt bei seiner Server-Karte (Dame, ohne Rahmen)`, !!gegner && gegner.figur === 'Q' && gegner.rahmen === 'ohne', gegner);
    if (BILDER) {
      mkdirSync(BILDER, { recursive: true });
      await s.evaluate(() => { for (const o of document.querySelectorAll('.duell')) o.remove(); });
      await s.locator('.on-unten').screenshot({ path: path.join(BILDER, `online-leiste-${merker ? 'merker' : 'frisch'}.png`) }).catch(() => {});
    }
    // Raetsel-Duell: Startbild
    await s.evaluate(() => window.__app.gehe('raetsel-duell', {}));
    const rd = await bild(s, '.rd-av svg');
    pruefe(`${fall}: Raetsel-Duell, Startbild mit Koenig und Erfinder-Rahmen`, istEigen(rd), rd);
    pruefe(`${fall}: ohne Seitenfehler`, fehler.length === 0, fehler);
    pruefe(`${fall}: die Karte fuer den Server traegt nie Erfinder-Rahmen oder Koenig`,
      gesendet.every(x => !/erfinder-blatt|"motiv":"K"/.test(JSON.stringify(x))), gesendet);
    await k.close();
  }
} finally { await browser?.close(); await new Promise(r => server.close(r)); }
console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
