// Emotes und Matt-Finisher in Online-Partien (Feinschliff R19, so/R19-emotes-finisher, Kaltreview 6b 17.11.2026): Emotes sind
// "nur fuers Online gedacht" (Flo 31.10.2026), der Finisher ist das Gekaufte, das man nach dem eigenen Matt sieht.
//   1) KI-Ersatz der Gegnersuche (js/ui/ki-ersatz.js: Partie mit ki: true): Emote- und Chat-Knopf ohne ?emotes
//   2) Bot-Partie und Zu zweit: weiter keine Knoepfe (gegen Bots nur mit ?test&emotes, das ist Absicht)
//   3) echte Online-Partie gegen einen Menschen (js/ui/online.js): eigener Mattzug -> der gewaehlte Finisher laeuft auf dem
//      Brett; verlorene oder schon beendet geoeffnete Partie -> kein Finisher
// Netzwerk ausschliesslich simuliert (Muster tests/online-ui.test.mjs), kein echtes Supabase.
//
//   node tests/r19-emotes-online.test.mjs
import http from 'node:http';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Chess } from '../vendor/chess/chess.js';
import { browserTyp } from './browser.mjs';

const require = createRequire(import.meta.url);
let pw;
for (const p of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
  try { pw = require(p); break; } catch (e) { /* naechster */ }
}
if (!pw) throw new Error('Playwright fehlt (PLAYWRIGHT_PFAD setzen)');
const WURZEL = fileURLToPath(new URL('../', import.meta.url));
const TYPEN = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm', '.json': 'application/json', '.png': 'image/png', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json' };
const server = http.createServer(async (q, r) => {
  const p = path.resolve(WURZEL, '.' + decodeURIComponent(new URL(q.url, 'http://test').pathname).replace(/\/$/, '/index.html'));
  if (!p.startsWith(WURZEL)) { r.writeHead(403); r.end(); return; }
  try { const d = await readFile(p); r.writeHead(200, { 'Content-Type': TYPEN[path.extname(p)] || 'application/octet-stream' }); r.end(d); }
  catch (e) { r.writeHead(404); r.end(); }
});
await new Promise((r) => server.listen(Number(process.env.PORT || 0), '127.0.0.1', r));
const BASIS = `http://127.0.0.1:${server.address().port}`;

const UID = 'u1';
const SITZUNG = { access_token: 'a.' + Buffer.from(JSON.stringify({ sub: UID })).toString('base64url') + '.x', refresh_token: 'r1',
  expires_at: 9999999999, user: { id: UID, email: 'spieler@example.invalid' } };
const ERFINDER_IDS = ['erfinder-titel', 'erfinder-finisher-signatur'];
let ok = 0, gesamt = 0, nummer = 0, stempel = Date.now();
function pruefe(name, gut, detail = '') {
  gesamt++; if (gut) ok++;
  console.log(`${gut ? 'OK' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(detail).slice(0, 500)}`);
  return gut;
}
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

// Online-Partien wie der Server (Auszug aus tests/online-ui.test.mjs): Zug pruefen, Stellung und Ende selbst rechnen
const partien = new Map();
const frisch = (p) => { p.aktualisiert_am = new Date(++stempel).toISOString(); return p; };
function partie({ farbe = 'w', zuege = '', status = 'laeuft', ergebnis = null, grund = null } = {}) {
  const c = new Chess(); for (const u of zuege.split(' ').filter(Boolean)) c.move({ from: u.slice(0, 2), to: u.slice(2, 4) });
  const p = frisch({ id: 'partie-' + ++nummer, code: 'ABC234', weiss: farbe === 'w' ? UID : 'u2', schwarz: farbe === 'b' ? UID : 'u2', erstellt_von: UID,
    status, fen: c.fen(), am_zug: c.turn(), zuege, ergebnis, grund, remis_angebot: null, bedenkzeit_s: null, inkrement_s: 0,
    uhr_weiss_ms: null, uhr_schwarz_ms: null, letzter_zug_am: new Date().toISOString(), erstellt_am: new Date().toISOString(), gewertet: false });
  partien.set(p.id, p); return p;
}
function setzeZug(q, uci) {
  const c = new Chess();
  for (const m of (q.zuege + ' ' + uci).trim().split(' ')) c.move({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] });
  q.zuege = (q.zuege + ' ' + uci).trim(); q.fen = c.fen(); q.am_zug = c.turn(); q.letzter_zug_am = new Date().toISOString();
  if (c.isCheckmate()) Object.assign(q, { status: 'beendet', ergebnis: c.turn() === 'b' ? '1-0' : '0-1', grund: 'matt' });
  frisch(q);
}

async function kontext(browser, { erfinder = false, einstellungen = {}, vorher = {} } = {}) {
  const k = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'de-DE', serviceWorkers: 'block', timezoneId: 'Europe/Berlin' });
  await k.route('**/*.supabase.co/**', async (r) => {
    const q = r.request(), u = new URL(q.url()), body = q.postDataJSON() || {};
    const antwort = (d) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
    if (u.pathname.startsWith('/auth/v1/')) return antwort({ id: UID, email: 'spieler@example.invalid' });
    if (u.pathname === '/rest/v1/sonderstuecke') return antwort(erfinder ? ERFINDER_IDS.map((stueck_id) => ({ stueck_id })) : []);
    if (u.pathname === '/rest/v1/altersangaben') return antwort([{ ab18: true }]);
    if (u.pathname === '/rest/v1/profile') return antwort([{ user_id: UID, benutzername: 'Spieler_1' }]);
    if (u.pathname === '/rest/v1/partien_online') {
      const p = partien.get((u.searchParams.get('id') || '').slice(3));
      const seit = (u.searchParams.get('aktualisiert_am') || '').slice(3);
      return antwort(p && (!seit || p.aktualisiert_am > seit) ? [p] : []);
    }
    if (u.pathname === '/functions/v1/online-zug') {
      const p = partien.get(body.partie);
      setzeZug(p, body.zug);
      return antwort(p);
    }
    if (/karte_(melde_stufen|waehle)$/.test(u.pathname)) return antwort({ taler: 0, stufen: {}, banner: ['start'], wahl: { banner: 'start' } });
    if (/kronen_mein_stand$/.test(u.pathname)) return r.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST202' }) });
    return antwort([]);
  });
  await k.addInitScript(({ sitzung, erfinder, ids, einstellungen, vorher, uid }) => {
    try {
      if (sessionStorage.getItem('probe-start')) return;
      sessionStorage.setItem('probe-start', '1');
      localStorage.clear();
      localStorage.setItem('schach-arena:v1:modul:start', JSON.stringify({ v: 1, gesehen: '2026-11-01' }));
      localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ klang: false, ...einstellungen }));
      localStorage.setItem('schach-arena:konto:sichtbar', '1');
      localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(sitzung));
      if (erfinder) localStorage.setItem('schach-arena:konto:sonderstuecke', JSON.stringify({ konto: uid, ids }));
      for (const [schl, wert] of Object.entries(vorher)) localStorage.setItem(schl, wert);
    } catch (e) { /* egal */ }
  }, { sitzung: SITZUNG, erfinder, ids: ERFINDER_IDS, einstellungen, vorher, uid: UID });
  const s = await k.newPage();
  s.setDefaultTimeout(15000);
  const fehler = [];
  s.on('pageerror', (e) => fehler.push(e.message));
  s.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) fehler.push('Konsole: ' + m.text()); });
  // fehlende Dateien der App (eigener Server) zaehlen; die simulierte Liga-Abfrage antwortet absichtlich 404 (kein Ligen-SQL)
  s.on('response', (a) => { if (a.status() >= 400 && a.url().startsWith(BASIS)) fehler.push(`${a.status()} ${a.url().slice(BASIS.length)}`); });
  // ohne ?emotes: gegen Bots darf die App die Knoepfe nicht zeigen, im Online-Spiel schon
  await s.goto(`${BASIS}/index.html?test#heim`);
  await s.waitForFunction(() => window.__app && typeof window.__app.gehe === 'function' && document.documentElement.dataset.screen, null, { timeout: 45000 });
  return { k, s, fehler };
}
const knoepfe = (s, sel) => s.evaluate((sel) => [...document.querySelectorAll(`${sel} .em-aktion`)].map((b) => b.dataset.emoteAktion).join(), sel);
async function partieKnoepfe(s, params) {
  await s.evaluate((params) => window.__app.gehe('partie', params), params);
  await s.waitForSelector('.screen.partie:not(.online-screen) .brett .feld', { timeout: 20000 });
  await warte(400);
  return knoepfe(s, '.screen.partie:not(.online-screen)');
}
async function oeffneOnline(s, p) {
  await s.evaluate((id) => window.__app.gehe('online', { partieId: id }), p.id);
  await s.waitForFunction((id) => window.__online?.brett() && !window.__online.busy() && window.__online.partie()?.id === id
    && document.querySelectorAll('.screen').length === 1 && document.querySelector('.on-brett')?.getBoundingClientRect().width > 100, p.id);
}
async function tippe(s, uci) {
  for (const f of [uci.slice(0, 2), uci.slice(2, 4)]) await s.locator(`.on-brett .feld[data-feld="${f}"]`).click();
}
// Finisher-Elemente seit dem Oeffnen der Partie mitschreiben (der Finisher raeumt sich nach hoechstens 1,4 s selbst weg)
const merkeFinisher = (s) => s.evaluate(() => {
  window.__finisherGesehen = [];
  new MutationObserver((liste) => {
    for (const m of liste) for (const n of m.addedNodes) {
      if (n.nodeType === 1 && n.classList.contains('finisher')) window.__finisherGesehen.push({ id: n.dataset.finisher, im: n.parentElement?.className || '' });
    }
  }).observe(document.body, { childList: true, subtree: true });
});
const gesehen = (s) => s.evaluate(() => window.__finisherGesehen || []);
// Was sieht man in der Brettmitte? Alle 50 ms: liegt dort das Ergebnisblatt, und laeuft gerade ein Finisher (3 s lang)
const sichtProbe = (s) => s.evaluate(() => {
  const proben = window.__sicht = [];
  const t0 = performance.now();
  const takt = setInterval(() => {
    const b = document.querySelector('.online-screen .on-brett')?.getBoundingClientRect();
    if (!b) return;
    const el = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
    proben.push({ t: Math.round(performance.now() - t0), blatt: !!el?.closest('.ergebnis-overlay'), finisher: !!document.querySelector('.online-screen .finisher') });
    if (performance.now() - t0 > 3000) clearInterval(takt);
  }, 50);
});
const sichtAuswertung = (s) => s.evaluate(() => {
  const p = window.__sicht || [];
  const o = document.querySelector('.online-screen > .ergebnis-overlay');
  return { proben: p.length, mitFinisher: p.filter((x) => x.finisher).length, blattUeberFinisher: p.filter((x) => x.finisher && x.blatt).length,
    erstesBlatt: p.find((x) => x.blatt)?.t ?? null, blattJetzt: !!o && !o.hidden, fokusImBlatt: !!o && o.contains(document.activeElement) };
});

let browser;
try {
  browser = await browserTyp(pw).launch({ headless: true });

  // 1 + 2: Emote-Knoepfe je Partie-Art (Spieler ohne Erfinder)
  {
    const { k, s, fehler } = await kontext(browser);
    pruefe('KI-Ersatz der Gegnersuche (ki: true) zeigt Emote- und Chat-Knopf ohne ?emotes',
      (await partieKnoepfe(s, { botId: 'fridolin', farbe: 'w', ki: true })) === 'emotes,chat');
    pruefe('Bot-Partie ohne ?emotes: keine Emote-Knoepfe (Absicht, Flo 31.10.)', (await partieKnoepfe(s, { botId: 'fridolin', farbe: 'w' })) === '');
    pruefe('Zu zweit: keine Emote-Knoepfe', (await partieKnoepfe(s, { modus: 'zuzweit', zuzweit: { weiss: 'Anna', schwarz: 'Ben', drehen: false } })) === '');
    pruefe('Emote-Knoepfe: keine Seitenfehler', fehler.length === 0, fehler);
    await k.close();
  }

  // 3: echte Online-Partie, Erfinder mit Finisher Blitzschlag, Bewegung an
  {
    const { k, s, fehler } = await kontext(browser, { erfinder: true, einstellungen: { bewegung: 'normal' },
      vorher: { 'schach-arena:v1:einstellungen:finisher': JSON.stringify({ auswahl: 'blitzschlag' }) } });
    await s.waitForFunction(async () => (await import('/js/sonderstuecke.js')).istErfinder(), null, { timeout: 15000 });
    const sieg = partie({ farbe: 'b', zuege: 'f2f3 e7e5 g2g4' });
    await oeffneOnline(s, sieg);
    await merkeFinisher(s);
    await sichtProbe(s);
    await tippe(s, 'd8h4');
    await s.locator('.on-ergebnis:not([hidden])').waitFor();
    await warte(300);
    const g1 = await gesehen(s);
    pruefe('Online gegen einen Menschen: eigener Mattzug startet den gewaehlten Finisher auf dem Brett',
      g1.length === 1 && g1[0].id === 'blitzschlag' && /brett-effekte/.test(g1[0].im), g1);
    await warte(1800);
    pruefe('Online: der Finisher raeumt sich nach seiner Dauer wieder weg', await s.locator('.online-screen .finisher').count() === 0);
    // Kaltreview de 17.11.: das Ergebnisblatt (modal) lag sofort ueber der Brettmitte, der Finisher lief abgedunkelt dahinter.
    // Wie in der Bot-Partie (js/ui/partie.js 1890-1893) kommt das Blatt erst nach dem Finisher.
    const sicht = await sichtAuswertung(s);
    pruefe('Online: solange der Finisher laeuft, liegt das Ergebnisblatt nicht ueber der Brettmitte',
      sicht.mitFinisher > 3 && sicht.blattUeberFinisher === 0, sicht);
    pruefe('Online: nach dem Finisher oeffnet das Ergebnisblatt (sichtbar, Fokus darin)', sicht.blattJetzt && sicht.fokusImBlatt, sicht);

    // ein Tipp waehrend des Finishers beendet ihn, das Blatt kommt dann sofort
    const tipp = partie({ farbe: 'b', zuege: 'f2f3 e7e5 g2g4' });
    await oeffneOnline(s, tipp);
    await tippe(s, 'd8h4');
    await s.waitForSelector('.online-screen .finisher', { timeout: 5000 });
    await warte(150);
    const t0 = Date.now();
    await s.mouse.click(5, 5);
    await s.waitForSelector('.online-screen > .ergebnis-overlay:not([hidden])', { timeout: 5000 });
    const nachTipp = Date.now() - t0;
    pruefe('Online: ein Tipp waehrend des Finishers zeigt das Ergebnisblatt sofort (unter 400 ms), der Finisher ist weg',
      nachTipp < 400 && await s.locator('.online-screen .finisher').count() === 0, { nachTipp });

    const schonAus = partie({ farbe: 'b', zuege: 'f2f3 e7e5 g2g4 d8h4', status: 'beendet', ergebnis: '0-1', grund: 'matt' });
    await oeffneOnline(s, schonAus);
    await merkeFinisher(s);
    await warte(1500);
    pruefe('Online: eine schon beendet geoeffnete Partie zeigt keinen Finisher', (await gesehen(s)).length === 0, await gesehen(s));

    const verloren = partie({ farbe: 'w', zuege: 'f2f3 e7e5 g2g4' });
    await oeffneOnline(s, verloren);
    await merkeFinisher(s);
    setzeZug(verloren, 'd8h4');
    await s.locator('.on-ergebnis:not([hidden])').waitFor({ timeout: 20000 });
    await warte(500);
    pruefe('Online: Matt des Gegners zeigt keinen Finisher', (await gesehen(s)).length === 0, await gesehen(s));
    pruefe('Online-Finisher: keine Seitenfehler', fehler.length === 0, fehler);
    await k.close();
  }
} catch (e) {
  console.error(e);
  gesamt++;
} finally {
  if (browser) await browser.close();
  server.close();
}
console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
