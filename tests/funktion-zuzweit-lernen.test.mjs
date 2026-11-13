// Funktionsprobe Zu zweit und Meisterschule (Feinschliff 12.11.2026, Auftrag 4B): jede Handlung wie ein Mensch, je Geraet
// (iPhone 13, PC 1280), mit "geht / geht nicht" und einem Bild je Handlung. Kein Konto im Netz: jede Anfrage an
// *.supabase.co beantwortet die Attrappe (Erfinder-Sitzung wie tests/lernen.test.mjs).
//
//   node tests/funktion-zuzweit-lernen.test.mjs                  Probe (echte Fehler melden sich als ROT-ERWARTET, Exit 0)
//   PROBE_STRENG=1 node tests/funktion-zuzweit-lernen.test.mjs   die harten Pruefungen zaehlen (fuer die Reparatur)
//   BILDER=<ordner>   Bilder dorthin (Standard: <tmp>/funktion-zuzweit-lernen)
//   PORT=8947         eigener Port
//
// Jede Handlung ist eine harte Pruefung (Muster tests/online-ranked-probe.test.mjs): ohne PROBE_STRENG=1 erscheint ein
// Fehlschlag als "ROT-ERWARTET" und blockiert die CI nicht (tests/alle.mjs zaehlt nur "FEHLER" und den Exitcode).
// Gleichheits-Liste: Brettgroesse, Spielerleisten, Knoepfe und Ergebnisblatt von Zu zweit und Lektion gegen die Bot-Partie
// am selben Geraet. Abweichungen sind BEFUND-Zeilen fuer Flo, nie ein Testfehler.
// Lektionen: je Lektionsart (ARTEN in js/pakete/lernen/mattbilder.js) die erste Gratis-Lektion, fuer die der Node-Teil
// gegen die Test-Verteidigung (erster legaler Zug, window.__test.lektionZug) einen Weg bis "geschafft" findet; Zugfolgen
// spielen ihre Folge. Kein Loesungszug steht von Hand im Test, eine neue Lektion oder Art kommt von selbst dazu.
import http from 'node:http';
import os from 'node:os';
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Chess } from '../vendor/chess/chess.js';
import { ARTEN, ALLE, artVon, bereichVon, bilanz, pruefeZiel, grenze } from '../js/pakete/lernen/mattbilder.js';
import { istGratis } from '../js/pakete/lernen/zugang.js';
import { browserTyp } from './browser.mjs';

const require = createRequire(import.meta.url);
let pw;
for (const p of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
  try { pw = require(p); break; } catch (e) { /* naechster */ }
}
if (!pw) throw new Error('Playwright fehlt (PLAYWRIGHT_PFAD setzen)');
const STRENG = process.env.PROBE_STRENG === '1';
const BILDER = process.env.BILDER || path.join(os.tmpdir(), 'funktion-zuzweit-lernen');
mkdirSync(BILDER, { recursive: true });
const root = fileURLToPath(new URL('../', import.meta.url));
const typen = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const p = path.resolve(root, '.' + new URL(req.url, 'http://test').pathname.replace(/\/$/, '/index.html'));
  if (!p.startsWith(root)) { res.writeHead(403); res.end(); return; }
  try { const inhalt = readFileSync(p); res.writeHead(200, { 'Content-Type': typen[path.extname(p)] || 'application/octet-stream' }); res.end(inhalt); }
  catch (e) { res.writeHead(404); res.end(); }
});
const PORT = Number(process.env.PORT || 8947);
await new Promise(r => server.listen(PORT, '127.0.0.1', r));
const warte = ms => new Promise(r => setTimeout(r, ms));

let ok = 0, gesamt = 0, rotErwartet = 0;
const rot = [], befunde = [];
function pruefe(name, gut, detail = '', { hart = false } = {}) {
  if (hart && !STRENG && !gut) { rotErwartet++; rot.push(name); console.log(`ROT-ERWARTET geht nicht: ${name} ${JSON.stringify(detail)}`); return gut; }
  gesamt++; if (gut) ok++;
  console.log(`${gut ? 'OK geht' : 'FEHLER geht nicht'}: ${name}${gut ? '' : ' ' + JSON.stringify(detail)}`);
  return gut;
}
// Gleichheits-Liste: nur Feststellung, zaehlt nie
function befund(name, gleich, detail) {
  befunde.push({ name, gleich, detail });
  console.log(`BEFUND ${gleich ? 'gleich' : 'ABWEICHUNG'}: ${name} ${JSON.stringify(detail)}`);
}

// ---- Node-Teil: Lektion je Art, Loesungsweg und ein falscher Zug gegen die Test-Verteidigung ----
const WERT = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const verteidigung = c => c.moves({ verbose: true })[0] || null;   // wie window.__test.lektionZug unten
const rang = m => (m.promotion ? 8 : 0) + (/[+#]/.test(m.san) ? 4 : 0) + (m.captured ? WERT[m.captured] / 3 : 0);
const KNOTEN_MAX = 300000;
// Flos Zuege (uci) bis "geschafft", wie js/ui/lektion.js: pruefeZiel nach Flos Zug und nach dem Gegenzug; null = keiner
function loesungsweg(l) {
  const start = bilanz(new Chess(l.fen));
  let knoten = 0;
  function suche(c, n, rest) {
    for (const m of c.moves({ verbose: true }).sort((a, b) => rang(b) - rang(a))) {
      if (m.promotion && m.promotion !== 'q') continue;   // eine Dame reicht; feldZug waehlt sie im Brett
      if (++knoten > KNOTEN_MAX) return null;
      c.move(m);
      let weg = null;
      const r = pruefeZiel(l, start, c, { wann: 'flo', zuege: n + 1 });
      if (r === 'geschafft') weg = [m.lan];
      else if (!r) {
        const g = verteidigung(c);
        if (g) {
          c.move(g);
          const r2 = pruefeZiel(l, start, c, { wann: 'gegner', zuege: n + 1 });
          if (r2 === 'geschafft') weg = [m.lan];
          else if (!r2 && rest > 1) { const w = suche(c, n + 1, rest - 1); if (w) weg = [m.lan, ...w]; }
          c.undo();
        }
      }
      c.undo();
      if (weg) return weg;
    }
    return null;
  }
  for (let d = 1; d <= Math.min(grenze(l.ziel) - 1, l.ziel + 6) && knoten <= KNOTEN_MAX; d++) {
    const w = suche(new Chess(l.fen), 0, d); if (w) return w;
  }
  return null;
}
// Zugfolge: Flos Zuege (uci) aus der Folge, dazu die Stellung vor seinem ersten Zug
function folgeweg(l) {
  const c = new Chess(l.fen), flo = l.farbe === 'b' ? 'b' : 'w', weg = [];
  let vorErstem = null;
  for (const san of l.folge) {
    if (c.turn() === flo && !vorErstem) vorErstem = c.fen();
    const m = c.move(san);
    if (m.color === flo) weg.push(m.lan);
  }
  return { weg, vorErstem };
}
// falscher Zug: ein legaler Zug, der nicht der erste Loesungszug ist und nicht sofort geschafft ergibt
function falscherZug(l, fen, richtig) {
  const c = new Chess(fen), start = bilanz(new Chess(l.fen));
  const kandidaten = c.moves({ verbose: true }).filter(m => m.lan !== richtig && (!m.promotion || m.promotion === 'q'));
  if (artVon(l) === 'folge') return kandidaten[0]?.lan || null;
  const laeuftWeiter = kandidaten.find(m => { c.move(m); const r = pruefeZiel(l, start, c, { wann: 'flo', zuege: 1 }); c.undo(); return r === null; });
  return (laeuftWeiter || kandidaten[0])?.lan || null;
}
const PLAN = [];
for (const art of ARTEN) {
  let gewaehlt = null;
  for (const l of ALLE.filter(x => artVon(x) === art && istGratis(x))) {
    if (art === 'folge') { const { weg, vorErstem } = folgeweg(l); gewaehlt = { l, weg, falsch: falscherZug(l, vorErstem, weg[0]) }; break; }
    const weg = loesungsweg(l);
    if (weg) { gewaehlt = { l, weg, falsch: falscherZug(l, l.fen, weg[0]) }; break; }
  }
  pruefe(`Node: Lektionsart "${art}" hat eine Gratis-Lektion mit Weg bis "geschafft"`, !!gewaehlt && !!gewaehlt.falsch, art, { hart: true });
  if (gewaehlt && gewaehlt.falsch) PLAN.push({ art, ...gewaehlt });
}
console.log('Lektionen: ' + PLAN.map(p => `${p.art}=${p.l.id} (${p.weg.length} Zuege, falsch ${p.falsch})`).join(' | '));

// ---- Browser ----
const SUPA = 'https://usaamcqypmvgqmsbfecb.supabase.co';
const UID = '0f8b6c1e-2d3a-4b5c-8d9e-0a1b2c3d4e5f';
const token = sub => 'a.' + Buffer.from(JSON.stringify({ sub })).toString('base64url') + '.x';
const SITZUNG = { access_token: token(UID), refresh_token: 'r1', expires_at: 9999999999, user: { id: UID, email: 'probe@example.invalid' } };
const ERFINDER_ZEILEN = ['erfinder-banner-blatt-0', 'erfinder-titel', 'erfinder-figuren-blaupause', 'erfinder-finisher-signatur'].map(stueck_id => ({ stueck_id }));
const { defaultBrowserType: _typ, ...IPHONE } = pw.devices['iPhone 13'];
const GERAETE = [
  { name: 'iphone13', optionen: IPHONE, finger: true },
  { name: 'pc1280', optionen: { viewport: { width: 1280, height: 800 } }, finger: false },
];

let browser;
async function neueSeite(geraet) {
  const k = await browser.newContext({ ...geraet.optionen, serviceWorkers: 'block', locale: 'de-DE', timezoneId: 'Europe/Berlin' });
  await k.route(SUPA + '/**', r => r.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify(r.request().url().includes('/rest/v1/sonderstuecke') ? ERFINDER_ZEILEN : []) }));
  await k.addInitScript(({ sitzung, uid }) => {
    try {
      if (sessionStorage.getItem('probe-start')) return;
      sessionStorage.setItem('probe-start', '1');
      localStorage.clear();
      localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(sitzung));
      localStorage.setItem('schach-arena:konto:sonderstuecke', JSON.stringify({ konto: uid, ids: ['erfinder-titel'] }));
      // haltenAufgeben aus: Aufgeben in der Bot-Partie mit Rueckfrage statt 1 s Halten
      localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ klang: false, bewegung: 'aus', haltenAufgeben: false }));
    } catch (e) { /* egal */ }
  }, { sitzung: SITZUNG, uid: UID });
  const s = await k.newPage(); s.setDefaultTimeout(15000);
  s.fehler = [];
  s.on('pageerror', e => s.fehler.push(e.message));
  s.on('console', m => { if (m.type() === 'error') s.fehler.push(m.text()); });
  s.geraet = geraet; s.nr = 0;
  await s.goto(`http://127.0.0.1:${PORT}/?test#heim`);
  await s.waitForFunction(() => !!window.__app && !!document.querySelector('.screen'), null, { timeout: 30000 });
  return { k, s };
}
const slug = t => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
// Eine Handlung: laufen lassen, Bild machen, als harte Pruefung melden; ein Abbruch darin ist "geht nicht"
async function handlung(s, name, fn) {
  let gut = false, detail = '';
  try { const r = await fn(); gut = r === true || (!!r && r.gut === true); detail = r && r.detail !== undefined ? r.detail : r; }
  catch (e) { detail = String(e.message || e).split('\n')[0]; }
  const bild = path.join(BILDER, `${s.geraet.name}-${String(++s.nr).padStart(2, '0')}-${slug(name)}.png`);
  await s.screenshot({ path: bild }).catch(() => {});
  pruefe(`${s.geraet.name}: ${name}`, gut, detail, { hart: true });
  return gut;
}
// Tipp auf ein Element: Finger am iPhone, Maus am PC
async function tippe(s, sel) {
  const ort = s.locator(sel).first();
  await ort.scrollIntoViewIfNeeded();
  const r = await ort.boundingBox();
  if (!r) throw new Error('nicht sichtbar: ' + sel);
  if (s.geraet.finger) await s.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2);
  else await s.mouse.click(r.x + r.width / 2, r.y + r.height / 2);
  await warte(90);
}
async function feldZug(s, brettSel, uci) {
  await tippe(s, `${brettSel} .feld[data-feld="${uci.slice(0, 2)}"]`);
  await tippe(s, `${brettSel} .feld[data-feld="${uci.slice(2, 4)}"]`);
  // Umwandlung: autoDame ist ab Werk aus (js/storage.js), das Brett fragt D T L S (js/board.js .brett-umwandlung)
  if (uci[4]) {
    const wahl = `${brettSel} .brett-umwandlung:not([hidden]) .umwandlung-figur[data-figur="${uci[4]}"]`;
    await s.locator(wahl).waitFor({ timeout: 3000 });
    await tippe(s, wahl);
  }
}
// Masse fuer die Gleichheits-Liste, in der Seite: Brett, Spielerleisten, Knoepfe
const masse = (s, { brett, spieler, knoepfe }) => s.evaluate(({ brett, spieler, knoepfe }) => {
  const sichtbar = e => !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
  const b = document.querySelector(brett);
  return {
    brett: b ? Math.round(b.getBoundingClientRect().width) : 0,
    spieler: [...document.querySelectorAll(spieler)].filter(sichtbar).length,
    knoepfe: [...document.querySelectorAll(knoepfe)].filter(sichtbar).map(k => (k.getAttribute('aria-label') || k.textContent).trim().replace(/\s+/g, ' ')),
    knopfHoehe: Math.min(...[...document.querySelectorAll(knoepfe)].filter(sichtbar).map(k => Math.round(k.getBoundingClientRect().height)), 9999),
  };
}, { brett, spieler, knoepfe });
// Ergebnisblatt: Klasse, ob es ueber dem Brett liegt (Schleier) und wie breit
const blatt = (s, sel) => s.evaluate(sel => {
  const e = document.querySelector(sel); if (!e || !e.getClientRects().length) return null;
  let ueber = false; for (let x = e; x; x = x.parentElement) if (['fixed', 'absolute'].includes(getComputedStyle(x).position)) { ueber = true; break; }
  return { klasse: e.className, ueberBrett: ueber, breite: Math.round(e.getBoundingClientRect().width), text: e.innerText.trim().replace(/\s+/g, ' ').slice(0, 80) };
}, sel);

// ---- Bot-Partie als Massstab ----
const LS_BLATT = '.ls-screen > .ergebnis-overlay.sieg:not([hidden]) .ergebnis-karte';
const BOT_BRETT = '.screen.partie:not(.zz-screen) .brett-rahmen > .brett';
async function botMassstab(s) {
  // Lauf 2 (12.11.): am iPhone stand das Bot-Brett einmal nach 30 s nicht; deshalb ein zweiter Versuch und ein Bild
  const brettDa = () => s.waitForFunction(sel => document.querySelector(sel)?.getBoundingClientRect().width > 100, BOT_BRETT, { timeout: 45000 }).then(() => true, () => false);
  await s.evaluate(() => window.__app.gehe('partie', { botId: 'benno' }));
  if (!(await brettDa())) {
    await s.screenshot({ path: path.join(BILDER, `${s.geraet.name}-00-bot-partie-erster-versuch.png`) }).catch(() => {});
    await s.evaluate(() => window.__app.gehe('heim')); await warte(500);
    await s.evaluate(() => window.__app.gehe('partie', { botId: 'benno' }));
    if (!(await brettDa())) throw new Error('Bot-Brett auch im zweiten Versuch nicht bereit');
  }
  await warte(800);
  const m = await masse(s, { brett: BOT_BRETT, spieler: '.screen.partie .spieler', knoepfe: '.spielknoepfe button' });
  await s.locator('.spielknoepfe > [data-aktion="aufgeben"]').click();
  const dialog = s.getByRole('alertdialog').getByRole('button', { name: 'Aufgeben', exact: true });
  if (await dialog.waitFor({ timeout: 4000 }).then(() => true, () => false)) await dialog.click();
  else await s.locator('.dialog-ort:not(.weg) .dialog-knoepfe button').last().click({ timeout: 4000 }).catch(() => {});
  await s.locator('.ergebnis-karte').waitFor({ timeout: 20000 }).catch(() => {});
  await warte(600);
  m.ergebnis = await blatt(s, '.ergebnis-karte');
  return m;
}
function vergleiche(geraet, was, bot, m, erg) {
  befund(`${geraet}: ${was} Brettgroesse wie Bot-Partie`, Math.abs(m.brett - bot.brett) <= 2, { [was]: m.brett, bot: bot.brett });
  befund(`${geraet}: ${was} Spielerleisten wie Bot-Partie`, m.spieler === bot.spieler, { [was]: m.spieler, bot: bot.spieler });
  befund(`${geraet}: ${was} Knoepfe wie Bot-Partie`, JSON.stringify(m.knoepfe) === JSON.stringify(bot.knoepfe) && m.knopfHoehe === bot.knopfHoehe,
    { [was]: m.knoepfe, hoehe: m.knopfHoehe, bot: bot.knoepfe, botHoehe: bot.knopfHoehe });
  befund(`${geraet}: ${was} Ergebnisblatt wie Bot-Partie`, !!erg && !!bot.ergebnis && erg.ueberBrett === bot.ergebnis.ueberBrett && Math.abs(erg.breite - bot.ergebnis.breite) <= 2,
    { [was]: erg, bot: bot.ergebnis });
}

// ---- Zu zweit ----
const ZZ = '.zz-brett';
const zz = s => s.evaluate(() => { const p = window.__partie; if (!p?.z) return null;
  return { modus: p.z.modus, zuege: p.z.zuege.slice(), phase: p.phase(), unten: p.brett.ausrichtung, namen: p.z.zuzweit, matt: p.chess().isCheckmate(), am: p.chess().turn() }; });
const merke = s => s.evaluate(() => { window.__altesZ = window.__partie?.z || null; });
const neuePartie = s => s.waitForFunction(() => window.__partie?.z?.modus === 'zuzweit' && window.__partie.z !== window.__altesZ, null, { timeout: 15000 });
async function zzZug(s, uci) {
  const vorher = (await zz(s)).zuege.length;
  await feldZug(s, ZZ, uci);
  return s.waitForFunction(n => window.__partie.z.zuege.length === n + 1, vorher, { timeout: 5000 }).then(() => true, () => false);
}
async function zzStarten(s, tempo, drehen) {
  await merke(s);
  await s.locator('[name="weiss"]').waitFor({ state: 'attached' });
  await s.locator(`[name="bedenkzeit"][value="${tempo}"]`).check();
  await s.locator('[name="drehen"]').setChecked(drehen);
  await s.getByRole('button', { name: 'Los', exact: true }).click();
  const neu = s.getByRole('button', { name: 'Neue Partie', exact: true });
  if (await neu.isVisible().catch(() => false)) {
    await neu.click();
    // Nachstellung 12.11.: der zuklappende Dialog (.dialog-ort.weg) liegt bis zu 300 ms ueber dem Brett und faengt dort
    // einen Klick ab; ein Mensch tippt so schnell kaum, deshalb Befund statt Fehler, und erst danach ziehen
    const weg = await s.evaluate(() => { const d = document.querySelector('.dialog-ort.weg'); return d ? getComputedStyle(d).pointerEvents : null; });
    if (weg) befund(`${s.geraet.name}: Zu zweit, zuklappender Dialog "Neue Partie" nimmt keine Klicks mehr an`, weg === 'none', { pointerEvents: weg });
  }
  await neuePartie(s);
  await s.waitForFunction(() => document.querySelector('.zz-brett')?.getBoundingClientRect().width > 100 && !document.querySelector('.dialog-ort'));
}
const uhren = s => s.evaluate(() => [...document.querySelectorAll('.zz-screen .uhr')].map(u => ({ f: u.dataset.farbe, t: u.textContent.trim(), sichtbar: !u.hidden && u.getClientRects().length > 0, laeuft: u.classList.contains('laeuft') })));
const ergebnisDa = s => s.locator('.zz-ergebnis:not([hidden])').waitFor({ timeout: 8000 }).then(() => true, () => false);

async function zuZweit(s, bot) {
  const g = s.geraet.name;
  await handlung(s, 'Zu zweit: Startblatt oeffnet (Namen, Bedenkzeit, Los)', async () => {
    await s.evaluate(() => window.__app.gehe('heim'));
    await s.locator('[data-aktion="heim-zuzweit"]').click();
    await s.locator('[name="weiss"]').waitFor({ state: 'attached' });
    const r = await s.evaluate(() => ({ namen: document.querySelectorAll('[name="weiss"], [name="schwarz"]').length, tempi: document.querySelectorAll('[name="bedenkzeit"]').length,
      los: !!document.querySelector('.zz-los') }));
    return { gut: r.namen === 2 && r.tempi >= 2 && r.los, detail: r };
  });
  await handlung(s, 'Zu zweit: Namen eingeben (Anna, Ben)', async () => {
    if (!(await s.evaluate(() => document.querySelector('.zz-namen')?.open))) await s.locator('.zz-namen summary').click();
    await s.locator('[name="weiss"]').fill('Anna');
    await s.locator('[name="schwarz"]').fill('Ben');
    const r = await s.evaluate(() => [document.querySelector('[name="weiss"]').value, document.querySelector('[name="schwarz"]').value]);
    return { gut: r[0] === 'Anna' && r[1] === 'Ben', detail: r };
  });
  await handlung(s, 'Zu zweit: ohne Uhr starten', async () => {
    await zzStarten(s, 'ohne', false);
    const p = await zz(s), u = await uhren(s);
    const namen = await s.evaluate(() => [...document.querySelectorAll('.zz-name b')].map(b => b.textContent));
    return { gut: p.modus === 'zuzweit' && !p.zuege.length && u.every(x => !x.sichtbar) && namen.includes('Anna') && namen.includes('Ben'), detail: { p, u, namen } };
  });
  await handlung(s, 'Zu zweit: Weiss zieht e2-e4', async () => {
    const gut = await zzZug(s, 'e2e4'); const p = await zz(s);
    return { gut: gut && p.zuege.join() === 'e2e4' && p.am === 'b', detail: p };
  });
  await handlung(s, 'Zu zweit: Schwarz zieht e7-e5, ohne Drehen bleibt Weiss unten, Status nennt Anna', async () => {
    const gut = await zzZug(s, 'e7e5'); const p = await zz(s);
    const status = await s.locator('.zz-status').innerText();
    const gegenueber = await s.evaluate(() => document.querySelector('.zz-oben').classList.contains('zz-gegenueber'));
    return { gut: gut && p.zuege.join() === 'e2e4,e7e5' && p.unten === 'w' && /Anna/.test(status) && gegenueber, detail: { p, status, gegenueber } };
  });
  await handlung(s, 'Zu zweit: Aufgeben beendet die Partie, Ergebnis "Ben gewinnt" erscheint', async () => {
    await s.locator('[data-zz="aufgeben"]').click();
    await s.getByRole('alertdialog').getByRole('button', { name: 'Aufgeben', exact: true }).click();
    const da = await ergebnisDa(s);
    const h3 = da ? await s.locator('.zz-ergebnis h3').innerText() : null;
    return { gut: da && h3 === 'Ben gewinnt' && (await zz(s)).phase === 'ende', detail: { da, h3 } };
  });
  await handlung(s, 'Zu zweit: "Revanche" (Nochmal) startet eine neue Partie mit getauschten Namen', async () => {
    await merke(s); await s.locator('.zz-ergebnis [data-zz="revanche"]').click(); await neuePartie(s);
    const p = await zz(s);
    return { gut: !p.zuege.length && p.phase === 'spiel' && p.namen.weiss === 'Ben' && p.namen.schwarz === 'Anna', detail: p };
  });
  // zweite Runde: mit Uhr und Drehen, Ende durch Matt (Narrenmatt)
  await handlung(s, 'Zu zweit: mit Uhr (5 Min) und Drehen starten', async () => {
    await s.evaluate(() => window.__app.gehe('heim'));
    await s.locator('[data-aktion="heim-zuzweit"]').click();
    if (!(await s.evaluate(() => document.querySelector('.zz-namen')?.open))) await s.locator('.zz-namen summary').click();
    await s.locator('[name="weiss"]').fill('Anna'); await s.locator('[name="schwarz"]').fill('Ben');
    await zzStarten(s, '5', true);
    const u = await uhren(s);
    return { gut: u.length === 2 && u.every(x => x.sichtbar && /^5:00/.test(x.t)) && (await zz(s)).unten === 'w', detail: u };
  });
  const zzMasse = await masse(s, { brett: ZZ, spieler: '.zz-screen .zz-spieler', knoepfe: '.zz-spielbereich > .zz-aktionen button' }).catch(() => null);
  await handlung(s, 'Zu zweit: Weiss zieht f2-f3, Brett dreht zu Schwarz, Schwarz-Uhr laeuft', async () => {
    const gut = await zzZug(s, 'f2f3'); await warte(300);
    const p = await zz(s), u = await uhren(s);
    return { gut: gut && p.unten === 'b' && u.find(x => x.f === 'b')?.laeuft && !u.find(x => x.f === 'w')?.laeuft, detail: { p, u } };
  });
  await handlung(s, 'Zu zweit: Schwarz zieht e7-e5, Brett dreht zurueck zu Weiss', async () => {
    const gut = await zzZug(s, 'e7e5'); await warte(300);
    const p = await zz(s);
    return { gut: gut && p.unten === 'w', detail: p };
  });
  let zzErgebnis = null;
  await handlung(s, 'Zu zweit: Matt (g2-g4, Dd8-h4) beendet die Partie, Ergebnis "Ben gewinnt" mit Grund', async () => {
    const a = await zzZug(s, 'g2g4'); const b = await zzZug(s, 'd8h4');
    const da = await ergebnisDa(s); const p = await zz(s);
    const h3 = da ? await s.locator('.zz-ergebnis h3').innerText() : null, grund = da ? await s.locator('.zz-ergebnis p').innerText() : null;
    zzErgebnis = await blatt(s, '.zz-ergebnis');
    return { gut: a && b && da && p.matt && p.phase === 'ende' && h3 === 'Ben gewinnt' && !!grund, detail: { p, h3, grund } };
  });
  await handlung(s, 'Zu zweit: "Revanche" nach Matt startet neu, Uhr bleibt', async () => {
    await merke(s); await s.locator('.zz-ergebnis [data-zz="revanche"]').click(); await neuePartie(s);
    const p = await zz(s), u = await uhren(s);
    return { gut: !p.zuege.length && p.phase === 'spiel' && u.every(x => x.sichtbar), detail: { p, u } };
  });
  if (bot && zzMasse) vergleiche(g, 'Zu zweit', bot, zzMasse, zzErgebnis);
}

// ---- Meisterschule ----
const lz = s => s.evaluate(() => (window.__lektion ? window.__lektion.zustand() : { offen: false }));
const warteLz = (s, bedingung) => s.waitForFunction(b => new Function('z', 'return ' + b)(window.__lektion ? window.__lektion.zustand() : { offen: false }),
  bedingung, { timeout: 10000 }).then(() => true, () => false);
const setzeVerteidigung = s => s.evaluate(async () => {
  const { Chess: C } = await import('/vendor/chess/chess.js');
  window.__test = window.__test || {};
  window.__test.lektionPause = 30;
  window.__test.lektionZug = fen => { const m = new C(fen).moves({ verbose: true })[0]; return m ? m.from + m.to + (m.promotion || '') : null; };
});
const LS = '.ls-screen .ls-brett';
const sterneVon = (s, bereich) => s.evaluate(b => { const t = document.querySelector(`.ms-bkarte[data-bereich="${b}"] .ms-bk-sterne`)?.textContent || '';
  return Number((t.match(/\d+/) || [NaN])[0]); }, bereich);

async function meisterschule(s, bot) {
  const g = s.geraet.name;
  await setzeVerteidigung(s);
  await handlung(s, 'Meisterschule: Liste oeffnet mit Bereichen und Lektionen', async () => {
    await s.evaluate(() => window.__app.gehe('lernen'));
    await s.locator('.ms-screen .ms-lektion').first().waitFor();
    const r = await s.evaluate(() => ({ bereiche: document.querySelectorAll('.ms-bkarte').length, lektionen: document.querySelectorAll('.ms-lektion').length }));
    return { gut: r.bereiche >= 4 && r.lektionen > 0, detail: r };
  });
  let gemessen = false;
  for (const { art, l, weg, falsch } of PLAN) {
    const bereich = bereichVon(l).id, folge = art === 'folge';
    let vorher = NaN, lsMasse = null;
    const gestartet = await handlung(s, `Lektion ${art} (${l.id}): aus der Liste starten, "Los geht's"`, async () => {
      await setzeVerteidigung(s);
      if (!(await s.locator('.ms-screen').isVisible().catch(() => false))) { await s.evaluate(() => window.__app.gehe('lernen')); await s.locator('.ms-screen .ms-lektion').first().waitFor(); }
      await s.locator(`.ms-bkarte[data-bereich="${bereich}"]`).click();
      await s.locator(`.ms-lektion[data-id="${l.id}"]`).waitFor();
      vorher = await sterneVon(s, bereich);
      await s.locator(`.ms-lektion[data-id="${l.id}"]`).click();
      const intro = await warteLz(s, `z.id === '${l.id}' && z.phase === 'intro'`);
      await s.waitForFunction(() => document.querySelector('.ls-brett')?.getBoundingClientRect().width > 100, null, { timeout: 8000 });
      if (!gemessen) lsMasse = await masse(s, { brett: '.ls-brett', spieler: '.ls-screen .spieler, .ls-screen .zz-spieler', knoepfe: '.ls-aktionen button' });
      await s.locator('.ls-aktionen [data-a="los"]').click();
      const los = await warteLz(s, "z.phase === 'flo' && z.zuege === 0");
      return { gut: intro && los, detail: await lz(s) };
    });
    if (!gestartet) continue;
    await handlung(s, `Lektion ${art} (${l.id}): falscher Zug ${falsch} zaehlt nicht als geschafft`, async () => {
      await feldZug(s, LS, falsch);
      if (folge) {
        const da = await s.locator('.ls-meldung[data-art="fehler"]').waitFor({ timeout: 5000 }).then(() => true, () => false);
        const z = await lz(s);
        return { gut: da && z.fehler === 1 && z.phase === 'flo' && z.zuege === 0, detail: z };
      }
      await warteLz(s, "z.zuege === 1 && (z.phase === 'flo' || z.phase === 'ende')");
      const z = await lz(s);
      const geschafftMeldung = await s.locator('.ls-meldung[data-art="geschafft"]').count();
      // zurueck auf Anfang: "Neu starten" (laeuft) oder "Nochmal" im Ergebnisblatt (gescheitert, R8)
      if (z.phase === 'ende') {
        await s.locator(LS_BLATT).waitFor({ timeout: 8000 }).catch(() => {});
        await s.locator('.ls-screen > .ergebnis-overlay [data-a="nochmal"]').click();
      } else await s.locator('.ls-aktionen [data-a="neu"]').click();
      const neu = await warteLz(s, "z.phase === 'flo' && z.zuege === 0");
      return { gut: z.zuege === 1 && !geschafftMeldung && (z.phase === 'flo' || !!z.grund) && neu, detail: { nachFalsch: z, neu } };
    });
    let erg = null;
    await handlung(s, `Lektion ${art} (${l.id}): richtige Zuege ${weg.join(' ')} bis "geschafft"`, async () => {
      for (const [i, u] of weg.entries()) {
        if (!(await warteLz(s, `z.phase === 'flo' && z.zuege === ${i}`))) return { gut: false, detail: { vorZug: i, z: await lz(s) } };
        await feldZug(s, LS, u);
      }
      await warteLz(s, "z.phase === 'ende'");
      const z = await lz(s);
      // R8: das Ende ist das Ergebnisblatt der Bot-Partie (vorher nur die Meldung in der Spalte)
      const da = await s.locator(LS_BLATT).waitFor({ timeout: 8000 }).then(() => true, () => false);
      erg = await blatt(s, LS_BLATT);
      return { gut: z.phase === 'ende' && !z.grund && z.sterne >= 1 && da, detail: z };
    });
    await handlung(s, `Lektion ${art} (${l.id}): zurueck zur Liste, Fortschritt (geschafft, Sterne) sichtbar`, async () => {
      await s.locator('.ls-screen > .ergebnis-overlay [data-a="uebersicht"]').click();
      const da = await s.locator(`.ms-lektion[data-id="${l.id}"][data-geschafft]`).waitFor({ timeout: 10000 }).then(() => true, () => false);
      const aktiv = await s.locator('.ms-bkarte[aria-pressed="true"]').getAttribute('data-bereich');
      const nachher = await sterneVon(s, bereich);
      const lektionSterne = await s.locator(`.ms-lektion[data-id="${l.id}"] .ms-sterne > i.an`).count();
      return { gut: da && aktiv === bereich && nachher > vorher && lektionSterne >= 1, detail: { da, aktiv, vorher, nachher, lektionSterne } };
    });
    if (!gemessen && bot && lsMasse) { vergleiche(g, 'Lektion', bot, lsMasse, erg); gemessen = true; }
  }
}

try {
  browser = await browserTyp(pw).launch({ headless: true });
  for (const geraet of GERAETE) {
    const { k, s } = await neueSeite(geraet);
    let bot = null;
    try { bot = await botMassstab(s); console.log(`Bot-Partie ${geraet.name}: ${JSON.stringify(bot)}`); }
    catch (e) { befund(`${geraet.name}: Bot-Partie als Massstab nicht messbar`, false, String(e.message).split('\n')[0]); }
    await zuZweit(s, bot);
    await meisterschule(s, bot);
    pruefe(`${geraet.name}: keine Konsolen- oder Seitenfehler`, s.fehler.length === 0, s.fehler.slice(0, 5), { hart: true });
    await k.close();
  }
} catch (e) { pruefe('Ablauf ohne Abbruch', false, e.stack); }
finally { await browser?.close(); await new Promise(r => server.close(r)); }
console.log(`\nBilder: ${BILDER}`);
const abweichungen = befunde.filter(b => !b.gleich);
console.log(`Gleichheits-Liste: ${befunde.length - abweichungen.length} gleich, ${abweichungen.length} Abweichung(en)${abweichungen.length ? ': ' + abweichungen.map(b => b.name).join(' | ') : ''}`);
if (rotErwartet) console.log(`${rotErwartet} harte Pruefung(en) ROT-ERWARTET (zaehlen erst mit PROBE_STRENG=1): ${rot.join(' | ')}`);
console.log(`\n${ok}/${gesamt} bestanden`); process.exitCode = ok === gesamt ? 0 : 1;
