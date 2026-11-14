// Online ruhiger (Feinschliff R19, 14.11.2026, Flo: "zu viele Zahlen, zu unuebersichtlich"): drei ENTWUERFE hinter der
// Kennung ?onlineStil=a|b|c (js/ui/online.js, css/online.css), nichts davon ist ohne Kennung zu sehen.
//   a "Nur das Wichtige": Lobby genau EINE Zahl (deine Elo), Stufe, Platz und Kronen hinter "Mehr"; Spielerleisten nur Name;
//     Ergebnis hoechstens eine Zahl.
//   b "Karten": Stand, Liga und Saison als drei Karten mit Symbol und je einem Wert; Partie mit Chips statt Textzeile;
//     Ergebnis als zwei Karten.
//   c "Spielerleiste": Lobby zeigt dich als Spielerleiste (Name, Banner, Liga-Abzeichen) ohne Zahl; Partie-Leisten mit
//     Abzeichen statt Zahlen; Ergebnis mit beiden Leisten.
// Ohne Kennung (und mit unbekannter Kennung) bleibt alles wie heute. iPhone 13 und PC, hell. Netz nur simuliert.
//
//   node tests/r19-online-ruhig.test.mjs
//   PORT=8976 node tests/r19-online-ruhig.test.mjs   eigener Port (Standard: frei)
import http from 'node:http';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
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
const typen = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg' };
const server = http.createServer((req, res) => {
  const p = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://test').pathname).replace(/\/$/, '/index.html'));
  if (!p.startsWith(root)) { res.writeHead(403); res.end(); return; }
  try { const d = readFileSync(p); res.writeHead(200, { 'Content-Type': typen[path.extname(p)] || 'application/octet-stream' }); res.end(d); }
  catch (e) { res.writeHead(404); res.end(); }
});
const PORT = Number(process.env.PORT) || await (await import('./freier-port.mjs')).freierPort();
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

let ok = 0, gesamt = 0;
function pruefe(name, gut, detail = '') {
  gesamt++; if (gut) ok++;
  // INTENTIONAL-SLOP[T4]: die Pruefzeile ist die Ausgabe des Tests (wie in tests/r19-online.test.mjs)
  console.log(`${gut ? 'ok  ' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(detail)}`);
}

// ---- Server-Attrappe wie tests/bilder-online.mjs; kronen_mein_stand nennt die Elo (Feld elo), wenn mitElo ----
const UID = 'u1';
const token = (uid) => 'a.' + Buffer.from(JSON.stringify({ sub: uid })).toString('base64url') + '.x';
const SITZUNG = { access_token: token(UID), refresh_token: 'test-r', expires_at: 9999999999, user: { id: UID, email: 'u1@example.invalid' } };
const NAMEN = { u1: 'Spieler_1', u2: 'Spieler_2' };
const PARTIE = 'ruhig-1';
const ELO = 1240;
const GEGNER_ELO = { u1: 1240, u2: 1310 }; // Visitenkarte mit Elo (heute zeigt die Leiste "Elo 1310 · Läufer II")
const iso = (ms) => new Date(ms).toISOString();

function bediener(z) {
  return async (route) => {
    const req = route.request(), url = new URL(req.url());
    let body = {}; try { body = req.postDataJSON() || {}; } catch (e) { body = {}; }
    const antwort = (d, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(d) });
    if (url.pathname.startsWith('/auth/v1/')) return antwort({ id: UID, email: UID + '@example.invalid' });
    if (url.pathname === '/rest/v1/profile') return antwort([{ user_id: UID, benutzername: NAMEN[UID] }]);
    if (url.pathname === '/rest/v1/partien_online') {
      if (url.searchParams.has('status')) return antwort([...z.partien.values()].filter((p) => p.status === 'beendet'));
      const p = z.partien.get((url.searchParams.get('id') || '').slice(3));
      return antwort(p ? [p] : []);
    }
    if (url.pathname === '/functions/v1/online-zug') {
      const q = z.partien.get(body.partie);
      if (!q || q.status !== 'laeuft') return antwort({ message: 'ONLINE_PARTIE_BEENDET' }, 409);
      const c = new Chess(q.fen);
      let m; try { m = c.move({ from: body.zug.slice(0, 2), to: body.zug.slice(2, 4), promotion: body.zug[4] }); } catch (e) { return antwort({ message: 'ONLINE_ZUG_ILLEGAL' }, 422); }
      Object.assign(q, { zuege: (q.zuege + ' ' + m.lan).trim(), fen: c.fen(), am_zug: c.turn(), letzter_zug_am: iso(Date.now()), aktualisiert_am: iso(Date.now()) });
      return antwort(q);
    }
    const rpc = (url.pathname.match(/\/rest\/v1\/rpc\/([a-z_]+)/) || [])[1];
    if (!rpc) return antwort([]);
    const p = z.partien.get(body.partie);
    const wartet = () => ({ wartet: true, warte_s: 120, ki_ab_s: 60, seit: iso(z.sucheSeit), zeit: '5+3' });
    if (rpc === 'online_suche_start') { z.sucheSeit = Date.now(); return antwort(wartet()); }
    if (rpc === 'online_suche_stand') {
      if (!z.treffer) return antwort(wartet());
      const c = new Chess(), jetzt = iso(Date.now());
      z.partien.set(PARTIE, { id: PARTIE, code: null, weiss: 'u1', schwarz: 'u2', erstellt_von: 'u2', gewertet: true, status: 'laeuft',
        fen: c.fen(), am_zug: 'w', zuege: '', ergebnis: null, grund: null, remis_angebot: null, bedenkzeit_s: 300, inkrement_s: 3,
        uhr_weiss_ms: 300000, uhr_schwarz_ms: 300000, letzter_zug_am: jetzt, erstellt_am: jetzt, aktualisiert_am: jetzt });
      return antwort({ partie: PARTIE });
    }
    if (rpc === 'online_suche_ende') return antwort({});
    if (rpc === 'online_meine') return antwort([...z.partien.values()].filter((q) => q.status !== 'beendet'));
    if (rpc === 'online_live_bewertung_frei') return antwort({ frei: true, rest: 1, unbegrenzt: false });
    if (rpc === 'online_live_bewertung_nutzen') return antwort({ ok: true, frei: true, rest: 0, unbegrenzt: false, gebucht: true });
    if (rpc === 'online_pruefe_zeit' && p) return antwort(p);
    if (rpc === 'online_gib_auf' && p) { Object.assign(p, { status: 'beendet', grund: 'aufgabe', ergebnis: '0-1', aktualisiert_am: iso(Date.now()) }); return antwort(p); }
    if (rpc === 'karte_der_partie') {
      const karte = (u) => ({ name: NAMEN[u], banner: 'saison-silber', titel: 'erfolg-feuertaufe', vitrine: [], motiv: 'Q', grund: 'standard', rahmen: 'ohne', kronen_stufe: 7, elo: GEGNER_ELO[u], du: u === UID });
      return antwort(p ? { w: karte(p.weiss), s: karte(p.schwarz) } : {});
    }
    if (rpc === 'kronen_mein_stand') return antwort({ stufe: 7, kronen: 140, platz: 3, ziel: 120, n: 30, woche: '2026-11-09', ...(z.mitElo ? { elo: ELO } : {}) });
    return antwort(rpc === 'karte_melde_stufen' ? {} : []);
  };
}
function initSkript({ sitzung }) {
  try {
    if (!sessionStorage.getItem('ruhig-start')) {
      sessionStorage.setItem('ruhig-start', '1');
      localStorage.clear();
      localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(sitzung));
      localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ haltenAufgeben: false, duellIntro: 'aus' }));
    }
  } catch (e) { /* egal */ }
}
const sichtbar = (s, sel, ms = 15000) => s.waitForFunction((sel) => [...document.querySelectorAll(sel)].some((e) => !e.hidden && e.getClientRects().length > 0), sel, { timeout: ms })
  .then(() => true).catch(() => false);

// Zahlen, die man sieht: Textknoten mit Ziffern (oder ½) unter `wurzel`, sichtbar (checkVisibility: auch zugeklappte
// details und hidden zaehlen nicht), ohne die Teile in `ohne`. Je Knoten die Zahlgruppen ("5 + 3" sind zwei).
const zahlenIn = (s, wurzel, ohne = '') => s.evaluate(([wurzel, ohne]) => {
  const raus = [];
  for (const w of document.querySelectorAll(wurzel)) {
    const gang = document.createTreeWalker(w, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = gang.nextNode())) {
      const el = n.parentElement;
      if (!el || (ohne && el.closest(ohne)) || !el.checkVisibility({ visibilityProperty: true, opacityProperty: true })) continue;
      for (const z of n.textContent.match(/\d+(?:[:.,]\d+)*|½/g) || []) raus.push(z);
    }
  }
  return raus;
}, [wurzel, ohne]);

async function tippe(s, uci) {
  for (const f of [uci.slice(0, 2), uci.slice(2, 4)]) {
    const r = await s.locator(`.on-brett .feld[data-feld="${f}"]`).first().boundingBox();
    await s.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2);
    await warte(120);
  }
}

const GERAETE = [['iPhone 13', 390, 844], ['PC', 1280, 720]];
const seitenfehler = [];
const heuteLobby = {}; // Zahlen der Lobby ohne Kennung je Geraet (Vergleich fuer die Varianten)

async function lauf(browser, [geraet, w, h], stil, { mitElo = true } = {}) {
  const gruppe = `${geraet} ${stil || 'heute'}${mitElo ? '' : ' ohne Server-Elo'}`;
  const k = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: true, serviceWorkers: 'block',
    colorScheme: 'light', locale: 'de-DE', timezoneId: 'Europe/Berlin' });
  const z = { partien: new Map(), treffer: false, sucheSeit: null, mitElo };
  await k.route('**/*.supabase.co/**', bediener(z));
  await k.addInitScript(initSkript, { sitzung: SITZUNG });
  const s = await k.newPage(); s.setDefaultTimeout(15000);
  s.on('pageerror', (e) => seitenfehler.push(`${gruppe}: ${e.message}`));
  const kennung = stil ? `&onlineStil=${stil}` : '';
  try {
    await s.goto(`http://127.0.0.1:${PORT}/index.html?test${kennung}#online`);
    pruefe(`${gruppe}: Lobby mit Suchknopf`, await sichtbar(s, '[data-online="suchen"]:not([disabled])', 30000));
    await s.waitForFunction(() => !document.querySelector('.on-liga[data-laedt]'), null, { timeout: 10000 }).catch(() => {});
    await warte(300);
    const attr = await s.evaluate(() => document.querySelector('.online-screen')?.dataset.onlineStil ?? null);
    const lobby = await zahlenIn(s, '.online-screen .on-inhalt', '.on-bild img');
    const gesetzt = ['a', 'b', 'c'].includes(stil) ? stil : null;
    pruefe(`${gruppe}: Kennung am Bildschirm ${gesetzt}`, attr === gesetzt, attr);

    if (!gesetzt && stil !== 'x') heuteLobby[geraet] = lobby.length;
    if (!gesetzt) {
      // heute: Liga-Streifen mit Stufe, Platz und Kronen in einer Zeile
      const liga = await s.evaluate(() => document.querySelector('.on-liga')?.textContent.replace(/\s+/g, ' ').trim());
      pruefe(`${gruppe}: Liga-Streifen wie heute`, /Platz 3 von 30/.test(liga || '') && /140/.test(liga || ''), liga);
    } else if (stil === 'a') {
      pruefe(`${gruppe}: Lobby zeigt genau eine Zahl, die Elo`, lobby.length === 1 && lobby[0] === String(ELO), lobby);
      const mehr = await s.evaluate(() => { const d = document.querySelector('.online-screen details.on-mehr');
        return d ? { offen: d.open, text: d.textContent.replace(/\s+/g, ' ') } : null; });
      pruefe(`${gruppe}: Stufe, Platz und Kronen hinter "Mehr" (zu)`, !!mehr && !mehr.offen && /Platz 3 von 30/.test(mehr.text) && /140/.test(mehr.text), mehr);
    } else if (stil === 'b') {
      const karten = await s.evaluate(() => [...document.querySelectorAll('.online-screen .on-rk-reihe > .on-rk')].map((k) => ({
        symbol: !!k.querySelector('svg'), werte: k.querySelectorAll('.on-rk-wert').length, sichtbar: k.checkVisibility() })));
      pruefe(`${gruppe}: drei Karten Stand, Liga, Saison mit Symbol und je einem Wert`,
        karten.length === 3 && karten.every((k) => k.symbol && k.werte === 1 && k.sichtbar), karten);
      const zeile = await s.evaluate(() => !!document.querySelector('.online-screen .on-liga:not([hidden])'));
      pruefe(`${gruppe}: kein Zahlenstreifen mehr`, !zeile);
    } else if (stil === 'c') {
      await s.waitForFunction((n) => document.querySelector('.on-il-name')?.textContent.trim() === n, NAMEN.u1, { timeout: 5000 }).catch(() => {});
      const leiste = await s.evaluate(() => { const l = document.querySelector('.online-screen .on-ich-leiste');
        return l && l.checkVisibility() ? { name: l.querySelector('.on-il-name')?.textContent.trim(), banner: !!l.querySelector('.on-banner'),
          abzeichen: !!l.querySelector('.on-abzeichen svg') } : null; });
      pruefe(`${gruppe}: Lobby zeigt dich als Spielerleiste (Name, Banner, Abzeichen)`, !!leiste && leiste.name === NAMEN.u1 && leiste.banner && leiste.abzeichen, leiste);
      const inLeiste = await zahlenIn(s, '.online-screen .on-ich-leiste', '.on-il-name'); // der Name zaehlt nicht (Spieler_1)
      pruefe(`${gruppe}: keine Zahl in der Spielerleiste`, inLeiste.length === 0, inLeiste);
    }
    if (gesetzt) pruefe(`${gruppe}: Lobby hat weniger Zahlen als heute (${heuteLobby[geraet]})`, lobby.length < heuteLobby[geraet], lobby);

    // Partie
    await s.locator('[data-online="suchen"]').filter({ visible: true }).first().click();
    await sichtbar(s, '.on-suche');
    z.treffer = true;
    const offen = await s.waitForFunction(() => window.__online?.brett() && !window.__online.busy()
      && document.querySelector('.on-brett')?.getBoundingClientRect().width > 100, null, { timeout: 20000 }).then(() => true).catch(() => false);
    pruefe(`${gruppe}: Partie offen`, offen);
    await s.waitForFunction(() => document.querySelectorAll('.on-spieler .on-banner').length === 2, null, { timeout: 10000 }).catch(() => {});
    await s.waitForFunction(() => !document.querySelector('.duell'), null, { timeout: 12000 }).catch(() => {});
    await tippe(s, 'e2e4');
    await warte(600);
    // Zahlen in den Spielerleisten ohne die Uhren (die braucht man zum Spielen) und ohne die Namen (Spieler_2 ist ein Name)
    const leisten = await zahlenIn(s, '.online-screen .on-spieler', '.uhr, .name');
    const meta = await s.evaluate(() => [...document.querySelectorAll('.online-screen .on-spieler')].map((e) => ({
      zeile: e.querySelector('.p-meta')?.checkVisibility() ? e.querySelector('.p-meta').textContent.trim() : null,
      chips: [...e.querySelectorAll('.on-chip')].filter((c) => c.checkVisibility()).length,
      abzeichen: [...e.querySelectorAll('.on-abzeichen')].filter((c) => c.checkVisibility() && c.querySelector('svg')).length })));
    if (!gesetzt) pruefe(`${gruppe}: Spielerleisten wie heute (Zeile mit Elo und Liga)`, meta.length === 2 && meta.every((m) => /^Elo \d+ · Läufer II$/.test(m.zeile || '')), meta);
    else if (stil === 'a') pruefe(`${gruppe}: Spielerleisten nur mit Namen (keine Zeile, keine Chips)`, meta.every((m) => m.zeile === null && !m.chips), meta);
    else if (stil === 'b') pruefe(`${gruppe}: Spielerleisten mit Chips statt Zeile`, meta.every((m) => m.zeile === null && m.chips >= 1), meta);
    else pruefe(`${gruppe}: Spielerleisten mit Liga-Abzeichen statt Zeile`, meta.every((m) => m.zeile === null && m.abzeichen === 1), meta);
    if (gesetzt) pruefe(`${gruppe}: keine Zahl in den Spielerleisten ausser der Uhr`, leisten.length === 0, leisten);

    // Ergebnis
    await s.locator('[data-online="aufgeben"]').filter({ visible: true }).first().click();
    const knoepfe = s.locator('.dialog-ort:not(.weg) .dialog-knoepfe button');
    if (await knoepfe.first().waitFor({ timeout: 3000 }).then(() => true).catch(() => false)) await knoepfe.last().click();
    pruefe(`${gruppe}: Ergebnisblatt`, await sichtbar(s, '.on-erg .ergebnis-karte'));
    await s.waitForFunction(() => { const k = document.querySelector('.on-erg-kronen'); return k && !k.hidden; }, null, { timeout: 8000 }).catch(() => {});
    await warte(300);
    const blatt = await zahlenIn(s, '.on-erg .ergebnis-karte');
    const aufbau = await s.evaluate(() => ({
      kronen: document.querySelector('.on-erg-kronen')?.checkVisibility() ? document.querySelector('.on-erg-kronen').textContent.replace(/\s+/g, ' ').trim() : null,
      karten: [...document.querySelectorAll('.on-erg .on-rk')].filter((k) => k.checkVisibility() && k.querySelector('svg')).length,
      spieler: [...document.querySelectorAll('.on-erg .on-erg-spieler')].filter((k) => k.checkVisibility()).length }));
    if (!gesetzt) pruefe(`${gruppe}: Ergebnis wie heute (Kronen-Zeile mit Wochenstand)`, /140 Kronen/.test(aufbau.kronen || ''), aufbau);
    else if (stil === 'a') pruefe(`${gruppe}: Ergebnis hoechstens eine Zahl`, blatt.length <= 1, blatt);
    else if (stil === 'b') pruefe(`${gruppe}: Ergebnis als zwei Karten mit Symbol`, aufbau.karten === 2, aufbau);
    else pruefe(`${gruppe}: Ergebnis mit beiden Spielerleisten`, aufbau.spieler === 2, aufbau);
  } catch (e) {
    pruefe(`${gruppe}: Ablauf ohne Abbruch`, false, e.message.split('\n')[0]);
  }
  await k.close().catch(() => {});
}

// Ohne Server-Elo: A zeigt die Wertung des Geraets nur, wenn es eine gibt; sonst keine Zahl (kein erfundener Startwert)
async function ohneElo(browser) {
  const k = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, serviceWorkers: 'block', colorScheme: 'light', locale: 'de-DE' });
  const z = { partien: new Map(), treffer: false, sucheSeit: null, mitElo: false };
  await k.route('**/*.supabase.co/**', bediener(z));
  await k.addInitScript(initSkript, { sitzung: SITZUNG });
  const s = await k.newPage();
  s.on('pageerror', (e) => seitenfehler.push(`ohne Elo: ${e.message}`));
  await s.goto(`http://127.0.0.1:${PORT}/index.html?test&onlineStil=a#online`);
  await sichtbar(s, '[data-online="suchen"]:not([disabled])', 30000);
  await s.waitForFunction(() => !document.querySelector('.on-liga[data-laedt]'), null, { timeout: 10000 }).catch(() => {});
  await warte(300);
  const lobby = await zahlenIn(s, '.online-screen .on-inhalt', '.on-bild img');
  const gross = await s.evaluate(() => document.querySelector('.online-screen .on-gross-wert')?.textContent.trim() ?? null);
  pruefe('ohne Server-Elo und ohne Wertung: keine erfundene Zahl, gross steht die Liga', lobby.length === 0 && gross === 'Läufer II', { lobby, gross });
  await k.close().catch(() => {});
}

let browser;
try {
  browser = await browserTyp(pw).launch({ headless: true });
  for (const g of GERAETE) for (const stil of [null, 'a', 'b', 'c']) await lauf(browser, g, stil);
  await lauf(browser, GERAETE[0], 'x'); // unbekannte Kennung: wie heute
  await ohneElo(browser);
} finally {
  if (browser) await browser.close().catch(() => {});
  server.close();
}
pruefe('keine Seitenfehler', seitenfehler.length === 0, seitenfehler);
console.log(`\n${ok}/${gesamt} Pruefungen bestanden`);
process.exit(ok === gesamt ? 0 : 1);
