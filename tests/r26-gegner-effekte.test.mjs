// Effekte vom Gegner (Feinschliff R26, Flo 21.11.2026): in der Online-Partie stehen die Figuren des Gegners in SEINEM Satz,
// seine Zuege laufen mit SEINER Zug-Animation, und gewinnt er per Matt, laeuft SEIN Finisher. Brett und Klangset bleiben die
// eigenen. Was der Server nicht als Besitz belegt (effekte_der_partie liefert dann null, supabase/gegner-effekte-schema.sql),
// zeigt den Standard; eine Kennung, die die App nicht kennt, ebenso. Schalter "Effekte vom Gegner zeigen" (gegnerEffekte,
// Standard an) aus: alles im eigenen Stil. Weniger Bewegung: Figuren ja, Zug-Animation und fremder Finisher nein. Fehlt die
// Funktion auf dem Server (heute live, 404), bleibt alles wie vorher, ohne Seitenfehler. Netz nur simuliert, iPhone 13.
//
//   node tests/r26-gegner-effekte.test.mjs
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

// ---- Server-Attrappe (wie tests/r19-online-ruhig.test.mjs); ich bin u1 mit Weiss, der Gegner u2 spielt Schwarz ----
const UID = 'u1';
const token = (uid) => 'a.' + Buffer.from(JSON.stringify({ sub: uid })).toString('base64url') + '.x';
const SITZUNG = { access_token: token(UID), refresh_token: 'test-r', expires_at: 9999999999, user: { id: UID, email: 'u1@example.invalid' } };
const NAMEN = { u1: 'Spieler_1', u2: 'Spieler_2' };
const PARTIE = 'fx-1';
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
    if (rpc === 'online_pruefe_zeit' && p) return antwort(p);
    if (rpc === 'karte_der_partie') {
      if (z.ohneKarte) return antwort({ code: 'PGRST202', message: 'Could not find the function public.karte_der_partie' }, 404);
      const karte = (u) => ({ name: NAMEN[u], banner: 'start', titel: null, vitrine: [], motiv: 'P', grund: 'standard', rahmen: 'ohne', kronen_stufe: 3 });
      return antwort(p ? { w: karte(p.weiss), s: karte(p.schwarz) } : {});
    }
    if (rpc === 'effekte_waehle') { z.gemeldet.push(body); return antwort(true); }
    if (rpc === 'effekte_der_partie') {
      z.fxAnfragen++;
      if (z.fx === 'fehlt') return antwort({ code: 'PGRST202', message: 'Could not find the function public.effekte_der_partie' }, 404);
      // spaet: die erste Antwort kennt die Wahl des Gegners noch nicht, erst die zweite (online.js fragt nach 6 s erneut)
      const s = z.spaet && z.fxAnfragen === 1 ? { figuren: null, zug: null, finisher: null } : z.fx;
      return antwort(p ? { w: { figuren: null, zug: null, finisher: null }, s } : {});
    }
    if (rpc === 'kronen_mein_stand') return antwort({ stufe: 3, kronen: 40, platz: 9, ziel: 120, n: 30, woche: '2026-11-16' });
    return antwort(rpc === 'karte_melde_stufen' ? {} : []);
  };
}
function initSkript({ sitzung, einstellungen }) {
  try {
    if (!sessionStorage.getItem('fx-start')) {
      sessionStorage.setItem('fx-start', '1');
      localStorage.clear();
      localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(sitzung));
      localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ haltenAufgeben: false, duellIntro: 'aus', ...einstellungen }));
    }
  } catch (e) { /* egal */ }
}
const sichtbar = (s, sel, ms = 15000) => s.waitForFunction((sel) => [...document.querySelectorAll(sel)].some((e) => !e.hidden && e.getClientRects().length > 0), sel, { timeout: ms })
  .then(() => true).catch(() => false);

async function tippe(s, uci) {
  for (const f of [uci.slice(0, 2), uci.slice(2, 4)]) {
    const r = await s.locator(`.on-brett .feld[data-feld="${f}"]`).first().boundingBox();
    await s.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2);
    await warte(120);
  }
}
// der Gegner zieht auf dem Server; die Ansicht holt den Stand selbst ab (online.beobachte)
function gegnerZieht(z, uci) {
  const q = z.partien.get(PARTIE), c = new Chess(q.fen);
  const m = c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4) });
  Object.assign(q, { zuege: (q.zuege + ' ' + m.lan).trim(), fen: c.fen(), am_zug: c.turn(), letzter_zug_am: iso(Date.now()), aktualisiert_am: iso(Date.now() + 1) });
  if (c.isCheckmate()) Object.assign(q, { status: 'beendet', ergebnis: '0-1', grund: 'matt' });
}
const zuegeSind = (s, n) => s.waitForFunction((n) => window.__online?.chess()?.history().length === n, n, { timeout: 15000 }).then(() => true).catch(() => false);
const koenig = (s, code) => s.evaluate((code) => document.querySelector(`.on-brett img[data-figur="${code}"]`)?.getAttribute('src') || null, code);
// alles, was waehrend `ms` in der Effekt-Ebene auftaucht (Zug-Effekt und Finisher bleiben nur kurz stehen)
const sammleEffekte = (s, ms) => s.evaluate((ms) => new Promise((fertig) => {
  const ebene = document.querySelector('.on-effekte'), gesehen = new Set();
  const nimm = () => ebene && ebene.querySelectorAll('[data-zug-effekt], [data-finisher]').forEach((e) => gesehen.add((e.dataset.zugEffekt ? 'zug:' + e.dataset.zugEffekt : 'finisher:' + e.dataset.finisher)));
  const mo = ebene ? new MutationObserver(nimm) : null;
  mo?.observe(ebene, { childList: true, subtree: true });
  nimm();
  setTimeout(() => { mo?.disconnect(); fertig([...gesehen]); }, ms);
}), ms);

const GEGNER = { figuren: 'blaupause', zug: 'wellenring', finisher: 'blitzschlag' };
const seitenfehler = [];

async function fall(browser, { name, fx = GEGNER, einstellungen = {}, ruhig = false, ohneKarte = false, erwartet }) {
  const z = { partien: new Map(), treffer: false, sucheSeit: Date.now(), fx, fxAnfragen: 0, gemeldet: [], ohneKarte };
  const k = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, serviceWorkers: 'block',
    locale: 'de-DE', timezoneId: 'Europe/Berlin', reducedMotion: ruhig ? 'reduce' : 'no-preference' });
  await k.route('**/*.supabase.co/**', bediener(z));
  await k.addInitScript(initSkript, { sitzung: SITZUNG, einstellungen });
  const s = await k.newPage(); s.setDefaultTimeout(15000);
  s.on('pageerror', (e) => seitenfehler.push(`${name}: ${e.message}`));
  try {
    await s.goto(`http://127.0.0.1:${PORT}/index.html?test#online`);
    pruefe(`${name}: Lobby`, await sichtbar(s, '[data-online="suchen"]:not([disabled])', 30000));
    await warte(300);
    await s.locator('[data-online="suchen"]').filter({ visible: true }).first().click();
    await sichtbar(s, '.on-suche');
    z.treffer = true;
    const offen = await s.waitForFunction(() => window.__online?.brett() && !window.__online.busy()
      && document.querySelector('.on-brett')?.getBoundingClientRect().width > 100, null, { timeout: 20000 }).then(() => true).catch(() => false);
    pruefe(`${name}: Partie offen`, offen);
    await s.waitForFunction(() => !document.querySelector('.duell'), null, { timeout: 12000 }).catch(() => {});
    // die Antwort von effekte_der_partie baut das Brett neu; danach stehen die Bilder
    await warte(1200);
    const sK = await koenig(s, 'bK'), wK = await koenig(s, 'wK');
    pruefe(`${name}: schwarzer Koenig (Gegner) ${erwartet.gegnerSatz}`, typeof sK === 'string' && erwartet.gegnerSatzPruef(sK), sK);
    pruefe(`${name}: weisser Koenig (ich) im eigenen Satz`, typeof wK === 'string' && /assets\/pieces\/wK\.svg$/.test(wK), wK);
    // Altbefund 6e (21.11.): ohne Karte zeigte der Gegnerplatz das EIGENE Bild (floAvatar)
    const bilder = await s.evaluate(() => ({ gegner: document.querySelector('.spieler.gegner .av')?.innerHTML || '',
      ich: document.querySelector('.spieler.ich .av')?.innerHTML || '' }));
    // mit Karte zeigt der Platz das Motiv des Gegners (hier wie meins ein Bauer, also kein Vergleich)
    if (ohneKarte) pruefe(`${name}: ohne Karte neutrales Bild am Gegnerplatz, nicht meins`,
      bilder.gegner !== bilder.ich && bilder.gegner.includes('class="ico"'), bilder.gegner.slice(0, 120));
    pruefe(`${name}: Brett, Klang und eigene Wahl bleiben (Effekt-Anfrage ${erwartet.anfrage ? 'ja' : 'egal'})`, !erwartet.anfrage || z.fxAnfragen > 0, z.fxAnfragen);

    // Narrenmatt mit Schwarz: f3 e5 g4 Dh4#; die Zuege des Gegners kommen vom Server
    await tippe(s, 'f2f3');
    pruefe(`${name}: mein Zug f3`, await zuegeSind(s, 1));
    const fxZug = sammleEffekte(s, 4500);
    gegnerZieht(z, 'e7e5');
    pruefe(`${name}: Gegnerzug e5 kommt an`, await zuegeSind(s, 2));
    const zugGesehen = await fxZug;
    pruefe(`${name}: Zug-Animation des Gegners ${erwartet.zug ? 'laeuft (' + erwartet.zug + ')' : 'laeuft nicht'}`,
      erwartet.zug ? zugGesehen.includes('zug:' + erwartet.zug) : !zugGesehen.some((x) => x.startsWith('zug:')), zugGesehen);
    await tippe(s, 'g2g4');
    pruefe(`${name}: mein Zug g4`, await zuegeSind(s, 3));
    const fxEnde = sammleEffekte(s, 5000);
    gegnerZieht(z, 'd8h4');
    pruefe(`${name}: Gegner setzt matt`, await zuegeSind(s, 4));
    const endeGesehen = await fxEnde;
    pruefe(`${name}: Finisher des Siegers ${erwartet.finisher ? 'laeuft (' + erwartet.finisher + ')' : 'laeuft nicht'}`,
      erwartet.finisher ? endeGesehen.includes('finisher:' + erwartet.finisher) : !endeGesehen.some((x) => x.startsWith('finisher:')), endeGesehen);
    if (erwartet.meldet) pruefe(`${name}: eigene Wahl an den Server gemeldet (nur Kennungen)`, z.gemeldet.length > 0
      && z.gemeldet.every((g) => Object.keys(g).sort().join() === 'figuren,finisher,zug'), z.gemeldet);
  } catch (e) {
    pruefe(`${name}: Ablauf ohne Abbruch`, false, e.message.split('\n')[0]);
  }
  await k.close().catch(() => {});
}

// Kaltreview ad (21.11.): die Wahl des Gegners kommt erst mit der zweiten Abfrage (nach 6 s), waehrend ich eine Figur
// angetippt habe. Die Saetze wechseln ohne Neubau: die Auswahl bleibt, der naechste Tipp zieht.
async function spaeteWahl(browser) {
  const name = 'G Wahl kommt mitten im Tipp';
  const z = { partien: new Map(), treffer: false, sucheSeit: Date.now(), fx: GEGNER, fxAnfragen: 0, gemeldet: [], spaet: true };
  const k = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, serviceWorkers: 'block',
    locale: 'de-DE', timezoneId: 'Europe/Berlin' });
  await k.route('**/*.supabase.co/**', bediener(z));
  await k.addInitScript(initSkript, { sitzung: SITZUNG, einstellungen: {} });
  const s = await k.newPage(); s.setDefaultTimeout(15000);
  s.on('pageerror', (e) => seitenfehler.push(`${name}: ${e.message}`));
  try {
    await s.goto(`http://127.0.0.1:${PORT}/index.html?test#online`);
    await sichtbar(s, '[data-online="suchen"]:not([disabled])', 30000);
    await warte(300);
    await s.locator('[data-online="suchen"]').filter({ visible: true }).first().click();
    z.treffer = true;
    await s.waitForFunction(() => window.__online?.brett() && !window.__online.busy(), null, { timeout: 20000 });
    await s.waitForFunction(() => !document.querySelector('.duell'), null, { timeout: 12000 }).catch(() => {});
    await s.waitForFunction(() => document.querySelector('.on-brett img[data-figur="bK"]'), null, { timeout: 5000 });
    pruefe(`${name}: erst eigener Satz am Gegner`, eigener(await koenig(s, 'bK')), await koenig(s, 'bK'));
    const vorher = await s.evaluate(() => { window.__brettVorher = window.__online.brett(); return true; });
    // f2 antippen und liegen lassen, bis die zweite Abfrage die Blaupause bringt
    const r = await s.locator('.on-brett .feld[data-feld="f2"]').first().boundingBox();
    await s.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2);
    const kam = await s.waitForFunction(() => /\/blaupause\/bK\.svg$/.test(document.querySelector('.on-brett img[data-figur="bK"]')?.getAttribute('src') || ''),
      null, { timeout: 12000 }).then(() => true).catch(() => false);
    pruefe(`${name}: Blaupause kommt mit der zweiten Abfrage`, vorher && kam, z.fxAnfragen);
    pruefe(`${name}: dasselbe Brett (kein Neubau)`, await s.evaluate(() => window.__online.brett() === window.__brettVorher));
    const r2 = await s.locator('.on-brett .feld[data-feld="f3"]').first().boundingBox();
    await s.touchscreen.tap(r2.x + r2.width / 2, r2.y + r2.height / 2);
    pruefe(`${name}: der naechste Tipp zieht f3`, await zuegeSind(s, 1));
  } catch (e) {
    pruefe(`${name}: Ablauf ohne Abbruch`, false, e.message.split('\n')[0]);
  }
  await k.close().catch(() => {});
}

// Schalter in den Einstellungen (Anzeige): sichtbar, Standard an, Tippen schaltet aus und speichert; mit der Tastatur
// erreichbar, Fokus sichtbar (Rahmen oder Schatten), Ziel mindestens 24 x 24 px (WCAG 2.5.8), hell und dunkel
async function schalterProbe(browser, farbe) {
  const name = `F Schalter (${farbe})`;
  const k = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, serviceWorkers: 'block',
    locale: 'de-DE', colorScheme: farbe });
  await k.addInitScript(initSkript, { sitzung: SITZUNG, einstellungen: {} });
  await k.route('**/*.supabase.co/**', bediener({ partien: new Map(), gemeldet: [], fxAnfragen: 0 }));
  const s = await k.newPage(); s.setDefaultTimeout(15000);
  s.on('pageerror', (e) => seitenfehler.push(`${name}: ${e.message}`));
  try {
    await s.goto(`http://127.0.0.1:${PORT}/index.html?test#einstellungen/anzeige`);
    const knopf = s.locator('.es-schalter[data-key="gegnerEffekte"]');
    await knopf.scrollIntoViewIfNeeded();
    pruefe(`${name}: Zeile sichtbar mit Titel`, await knopf.isVisible() && /Effekte vom Gegner/.test(await s.locator('#es-l-gegnerEffekte').innerText()));
    pruefe(`${name}: Standard an`, await knopf.getAttribute('aria-checked') === 'true');
    const box = await knopf.boundingBox();
    pruefe(`${name}: Ziel mindestens 24 x 24 px`, box && box.width >= 24 && box.height >= 24, box);
    await knopf.focus();
    await s.keyboard.press('Shift+Tab'); await s.keyboard.press('Tab');
    const fokus = await knopf.evaluate((el) => {
      const st = getComputedStyle(el);
      return { aktiv: document.activeElement === el, rahmen: st.outlineStyle !== 'none' && parseFloat(st.outlineWidth) > 0, schatten: st.boxShadow !== 'none' };
    });
    pruefe(`${name}: Tastaturfokus sichtbar`, fokus.aktiv && (fokus.rahmen || fokus.schatten), fokus);
    await knopf.tap();
    await s.waitForFunction(() => document.querySelector('.es-schalter[data-key="gegnerEffekte"]')?.getAttribute('aria-checked') === 'false', null, { timeout: 5000 }).catch(() => {});
    const gespeichert = await s.evaluate(() => JSON.parse(localStorage.getItem('schach-arena:v1:einstellungen') || '{}').gegnerEffekte);
    pruefe(`${name}: Tippen schaltet aus und speichert`, gespeichert === false, gespeichert);
    pruefe(`${name}: ohne Erfinder keine Wahl der eigenen Zug-Animation`, await s.locator('[data-einstellung="zugEffekt"]').count() === 0);
  } catch (e) {
    pruefe(`${name}: Ablauf ohne Abbruch`, false, e.message.split('\n')[0]);
  }
  await k.close().catch(() => {});
}

const blaupause = (src) => /\/blaupause\/bK\.svg$/.test(src);
const eigener = (src) => /assets\/pieces\/bK\.svg$/.test(src);
let browser;
try {
  browser = await browserTyp(pw).launch({ headless: true });
  await fall(browser, { name: 'A an', erwartet: { gegnerSatz: 'in Blaupause', gegnerSatzPruef: blaupause, zug: 'wellenring', finisher: 'blitzschlag', anfrage: true, meldet: true } });
  await fall(browser, { name: 'B Schalter aus', einstellungen: { gegnerEffekte: false },
    erwartet: { gegnerSatz: 'im eigenen Satz', gegnerSatzPruef: eigener, zug: null, finisher: null } });
  await fall(browser, { name: 'C unbekannte Kennungen', fx: { figuren: 'hack/../x', zug: 'konfetti', finisher: 'feuerwerk' },
    erwartet: { gegnerSatz: 'im Standard', gegnerSatzPruef: eigener, zug: null, finisher: null, anfrage: true } });
  await fall(browser, { name: 'D weniger Bewegung', ruhig: true,
    erwartet: { gegnerSatz: 'in Blaupause', gegnerSatzPruef: blaupause, zug: null, finisher: null, anfrage: true } });
  await fall(browser, { name: 'E Funktion fehlt (404)', fx: 'fehlt', ohneKarte: true,
    erwartet: { gegnerSatz: 'im eigenen Satz', gegnerSatzPruef: eigener, zug: null, finisher: null, anfrage: true } });
  await spaeteWahl(browser);
  await schalterProbe(browser, 'light');
  await schalterProbe(browser, 'dark');
} finally {
  if (browser) await browser.close().catch(() => {});
  server.close();
}
pruefe('keine Seitenfehler', seitenfehler.length === 0, seitenfehler);
console.log(`\n${ok}/${gesamt} Pruefungen bestanden`);
process.exit(ok === gesamt ? 0 : 1);
