// R17 Ende-Feinschliff (R16-Kritik E3, D3, I3; Varianten-Auswahl 14.11.2026, jeweils a):
//   E3  Nach Niederlage oder Remis liegt der Fokus auf "Zur Analyse" (der einzige orange Knopf), nach einem Sieg wie
//       bisher auf der Folgeaktion. Der Fokus bleibt sichtbar (Ring bei :focus-visible).
//   D3  Die Ende-Karte des Raetsel-Duells nennt "Du" und den Gegner wie die Leiste im Duell; die Karte waechst dadurch
//       um hoechstens eine Namenszeile (gemessen 21 px; ohne Zuwachs ginge es nur ueber css/pakete/raetsel-duell.css),
//       alles bleibt auf iPhone SE und 13 ohne Scrollen sichtbar.
//   I3  Unter dem Bannerbild der Profilkarte bleibt kein Streifen in der Grundfarbe #14161C (PC und iPhone, per Pixel).
//   node tests/r17-ende-feinschliff.test.mjs [--bilder=<ordner> [--teil=vorher|nachher]]
// Netzwerk nur simuliert: Anfragen an *.supabase.co beantwortet der Test, alles ausser 127.0.0.1 wird abgebrochen.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { browserTyp } from './browser.mjs';

const require = createRequire(import.meta.url);
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || await (await import('./freier-port.mjs')).freierPort();
const BASIS = `http://127.0.0.1:${PORT}/index.html?test`;
const arg = (n) => { const a = process.argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : null; };
const BILDER = arg('bilder');
const TEIL = arg('teil') || 'nachher';
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

let ok = 0; let fehler = 0;
// INTENTIONAL-SLOP[T4]: die Konsole ist der Ausgabeweg dieser Probe (tests/alle.mjs liest sie)
function pruefe(name, wert, info = '') {
  if (wert) { ok++; console.log('ok   ' + name); } else { fehler++; console.log('FEHLER ' + name + ' ' + JSON.stringify(info)); }
}
function ladePlaywright() {
  for (const k of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
    // INTENTIONAL-SLOP[F1]: Playwright-Suche, ein Fehlgriff heisst nur: naechsten Pfad probieren
    try { return require(k); } catch (e) { /* naechster */ }
  }
  throw new Error('Playwright fehlt');
}
async function warteAufServer(url) {
  const bis = Date.now() + 10000;
  while (Date.now() < bis) {
    // INTENTIONAL-SLOP[F1]: der Server startet gerade, ein Fehlschlag heisst nur: gleich noch einmal
    try { if ((await fetch(url)).ok) return; } catch (e) { /* noch nicht da */ }
    await warte(150);
  }
  throw new Error('Testserver antwortet nicht');
}

const UID = '0f8b6c1e-2d3a-4b5c-8d9e-0a1b2c3d4e5f';
const token = (sub) => 'a.' + Buffer.from(JSON.stringify({ sub })).toString('base64url') + '.x';
const SITZUNG = { access_token: token(UID), refresh_token: 'r1', expires_at: 9999999999, user: { id: UID, email: 'probe@example.invalid' } };
const DUELL = '7d0c9a52-1b3e-4f6a-9c8d-2e1f0a9b8c7d';
const SIEG = JSON.stringify({ bots: { benno: { sterne: [true, false, false] }, fridolin: { sterne: [true, false, false] } }, brillanteZuege: [] });
const IPHONE13 = { name: 'iphone13', viewport: { width: 390, height: 844 }, touch: true };
const IPHONESE = { name: 'iphonese', viewport: { width: 375, height: 667 }, touch: true };
const PC = { name: 'pc', viewport: { width: 1440, height: 900 }, touch: false };

// beendetes KI-Duell 3 : 2 (Sieg), wie duell_stand es liefert
function duellStand() {
  const jetzt = new Date().toISOString();
  return { duell: DUELL, art: 'ki', status: 'beendet', jetzt, start_am: jetzt, ergebnis: 'sieg', kronen_delta: 20, raetsel: null,
    ich: { geloest: 3, fehler: 1, ende_am: jetzt }, gegner: { geloest: 2, fehler: 0, ende_am: jetzt, ki: true, elo: 1200 } };
}

async function seite(browser, g, schema, { sitzung = false, vitrine = null, lauf = false, sprache = null } = {}) {
  const k = await browser.newContext({ viewport: g.viewport, deviceScaleFactor: 1, hasTouch: g.touch, locale: 'de-DE',
    timezoneId: 'Europe/Berlin', serviceWorkers: 'block', colorScheme: schema === 'dunkel' ? 'dark' : 'light' });
  await k.route('**/*', (route) => {
    const u = new URL(route.request().url());
    if (u.hostname === '127.0.0.1') return route.continue();
    if (!u.hostname.endsWith('.supabase.co')) return route.abort();
    const name = (u.pathname.match(/\/rest\/v1\/rpc\/([a-z_]+)/) || [])[1];
    const body = name === 'duell_stand' ? duellStand() : [];
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await k.addInitScript(({ sitzung, vitrine, sieg, modus, lauf, duell, sprache }) => {
    try {
      if (sessionStorage.getItem('probe-start')) return;
      sessionStorage.setItem('probe-start', '1');
      localStorage.clear();
      localStorage.setItem('schach-arena:v1:modul:start', JSON.stringify({ v: 1, gesehen: '2026-11-01' }));
      localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify(sprache ? { klang: false, modus, sprache, spracheGewaehlt: true } : { klang: false, modus }));
      localStorage.setItem('schach-arena:v1:hinweis-installieren', '1');
      if (sitzung) localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(sitzung));
      if (vitrine) {
        localStorage.setItem('schach-arena:v1:fortschritt', sieg);
        localStorage.setItem('schach-arena:v1:einstellungen:sammeln', JSON.stringify({ profil: { vitrine } }));
      }
      if (lauf) sessionStorage.setItem('schach-arena:raetsel-duell:laufend', JSON.stringify({ id: duell, reihe: ['g', 'g', 'r', 'g'], um: Date.now() }));
      // INTENTIONAL-SLOP[F1]: ohne Speicher (privates Fenster) startet die Probe trotzdem, die Pruefungen zeigen es dann
    } catch (e) { /* egal */ }
  }, { sitzung: sitzung ? SITZUNG : null, vitrine, sieg: SIEG, modus: schema, lauf, duell: DUELL, sprache });
  const s = await k.newPage(); s.setDefaultTimeout(15000);
  const seitenfehler = [];
  s.on('pageerror', (e) => seitenfehler.push(e.message));
  await s.goto(BASIS + '#heim');
  await s.waitForFunction(() => window.__app && typeof window.__app.gehe === 'function' && document.documentElement.dataset.screen, null, { timeout: 30000 });
  return { k, s, seitenfehler };
}
const ruhe = (s) => s.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'
  || a.effect?.getComputedTiming().iterations === Infinity), null, { timeout: 4000 }).catch(() => {});
async function bild(s, name) { if (BILDER) { await ruhe(s); await s.screenshot({ path: path.join(BILDER, `${name}-${TEIL}.png`) }); } }

// ---------- E3: Fokus nach dem Ergebnis ----------
async function partie(browser, g, schema, art) {
  const SCREEN = '.screen.partie:not(.online-screen)';
  const pt = art === 'niederlage'
    ? { zuege: ['f2f3', 'g2g4'], plan: { f2f3: 'e7e5', g2g4: 'd8h4' } }
    // Springer hin und her: nach dem vierten Bot-Zug steht die Grundstellung zum dritten Mal (Remis durch Wiederholung)
    : art === 'remis' ? { zuege: ['g1f3', 'f3g1', 'g1f3', 'f3g1'], plan: { g1f3: 'g8f6', f3g1: 'f6g8' } }
    : { zuege: ['e2e4', 'f1c4', 'd1h5', 'h5f7'], plan: { e2e4: 'e7e5', f1c4: 'b8c6', d1h5: 'g8f6' } };
  const p = await seite(browser, g, schema);
  const s = p.s;
  await warte(800);
  await s.evaluate((plan) => {
    localStorage.removeItem('schach-arena:v1:laufend');
    window.__test = { botZug: () => { const v = window.__partie.chess().history({ verbose: true }); return plan[v[v.length - 1].lan] || null; } };
    window.__app.gehe('partie', { botId: 'fridolin', farbe: 'w' });
  }, pt.plan);
  await s.waitForFunction((sel) => window.__partie && window.__partie.bereit === true && window.__partie.phase() === 'flo'
    && document.querySelectorAll(sel + ' .brett img.figur').length === 32, SCREEN, { timeout: 30000 });
  for (const z of pt.zuege) {
    await s.waitForFunction(() => window.__partie.phase() === 'flo', null, { timeout: 30000 });
    for (const f of [z.slice(0, 2), z.slice(2, 4)]) await s.locator(`${SCREEN} .brett-felder .feld[data-feld="${f}"]`).click();
    if (await s.locator(`${SCREEN} .brett .lage.vorschau`).count()) await s.locator(`${SCREEN} .brett-felder .feld[data-feld="${z.slice(2, 4)}"]`).click();
  }
  await s.waitForSelector(`.ergebnis-overlay.${art}.gefuellt:not(.vorlaeufig)`, { timeout: 60000 });
  await warte(1500);
  const f = await s.evaluate(() => {
    const e = document.activeElement;
    const orange = [...document.querySelectorAll('.ergebnis-overlay button')].filter((b) => {
      const c = getComputedStyle(b); return b.offsetParent && (b.classList.contains('primaer') || (b === e && c.outlineStyle !== 'none'));
    }).map((b) => b.dataset.ziel || b.className);
    return { ziel: e?.dataset?.ziel || e?.className || '', imBlatt: !!e?.closest('.ergebnis-overlay'), sichtbar: !!e?.matches(':focus-visible'),
      ring: e ? getComputedStyle(e).outlineStyle : '', revanche: !!document.querySelector('.ergebnis-overlay .gd-revanche'), orange };
  });
  return { p, s, f };
}

// ---------- I3: Streifen unter dem Bannerbild ----------
// Pixelspalte nahe der linken Kante (im Bild, nicht im dunklen Verlauf rechts): unterste 12 px des Profilkopfs
async function streifen(s) {
  const b = await s.locator('.pr-karte > .pr-kopf').boundingBox();
  const clip = { x: Math.round(b.x + 30), y: Math.round(b.y + b.height - 12), width: 1, height: 12 };
  const png = (await s.screenshot({ clip })).toString('base64');
  return s.evaluate(async (b64) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, img.width, img.height).data;
    let grund = 0; const farben = [];
    for (let i = 0; i < d.length; i += 4) {
      farben.push([d[i], d[i + 1], d[i + 2]].join(','));
      // #14161C, darueber der Verlauf mit .15 Deckkraft: gemessen 17,19,24
      if (Math.abs(d[i] - 18) <= 5 && Math.abs(d[i + 1] - 20) <= 5 && Math.abs(d[i + 2] - 26) <= 5) grund++;
    }
    return { grund, farben };
  }, png);
}

// ---------- D3: Namen auf der Ende-Karte des Raetsel-Duells ----------
async function duellEnde(browser, g, schema, sprache = null) {
  const p = await seite(browser, g, schema, { sitzung: true, lauf: true, sprache });
  await p.s.evaluate(() => window.__app.gehe('raetsel-duell'));
  await p.s.waitForSelector('.screen.raetsel-duell[data-phase="beendet"] .rd-ende', { timeout: 15000 });
  await ruhe(p.s);
  const m = await p.s.evaluate(() => {
    const ende = document.querySelector('.rd-ende');
    const wer = [...ende.querySelectorAll('.rd-ende-wer')];
    const namen = wer.map((w) => w.querySelector('.rd-ende-name'));
    const r = (e) => e.getBoundingClientRect();
    const knoepfe = r(ende.querySelector('.rd-knoepfe'));
    const mit = Math.round(r(ende).height);
    // dieselbe Karte ohne die Namen: um wie viel waechst sie durch die Namen?
    const weg = namen.filter(Boolean).map((n) => { const plaetz = n.nextSibling; const eltern = n.parentNode; n.remove(); return () => eltern.insertBefore(n, plaetz); });
    const ohne = Math.round(r(ende).height);
    weg.forEach((f) => f());
    return {
      texte: namen.map((n) => n?.textContent || null),
      unterBild: namen.every((n, i) => n && r(n).top >= r(wer[i].querySelector('.rd-av')).bottom - 1),
      groesse: namen[0] ? parseFloat(getComputedStyle(namen[0]).fontSize) : 0,
      farbeWieTitel: namen.every((n) => n && getComputedStyle(n).color === getComputedStyle(ende.querySelector('h2')).color),
      mit, ohne, knoepfeImBild: knoepfe.bottom <= innerHeight && knoepfe.top >= 0, scroll: document.scrollingElement.scrollTop,
    };
  });
  return { ...p, m };
}

const server = spawn(process.execPath, ['tests/testserver.mjs', String(PORT), '--bind', '127.0.0.1'], { cwd: WURZEL, stdio: 'ignore' });
let browser;
try {
  if (BILDER) fs.mkdirSync(BILDER, { recursive: true });
  await warteAufServer(`http://127.0.0.1:${PORT}/index.html`);
  browser = await browserTyp(ladePlaywright()).launch({ headless: true });

  // E3
  for (const [g, schema] of [[IPHONE13, 'hell'], [PC, 'dunkel']]) {
    const n = await partie(browser, g, schema, 'niederlage');
    pruefe(`E3 ${g.name}: nach Niederlage liegt der Fokus auf "Zur Analyse"`, n.f.ziel === 'analyse' && n.f.imBlatt, n.f);
    pruefe(`E3 ${g.name}: der Fokus ist sichtbar (:focus-visible mit Ring)`, n.f.sichtbar && n.f.ring !== 'none', n.f);
    pruefe(`E3 ${g.name}: nur ein Knopf hervorgehoben (orange oder mit Ring)`, n.f.revanche && n.f.orange.length === 1, n.f.orange);
    pruefe(`E3 ${g.name}: keine Seitenfehler (Niederlage)`, n.p.seitenfehler.length === 0, n.p.seitenfehler);
    await bild(n.s, `e3-niederlage-${g.name}-${schema}`);
    await n.p.k.close();
  }
  const rm = await partie(browser, IPHONE13, 'hell', 'remis');
  pruefe('E3 iphone13: nach Remis liegt der Fokus auf "Zur Analyse"', rm.f.ziel === 'analyse' && rm.f.imBlatt && rm.f.sichtbar, rm.f);
  pruefe('E3 iphone13: nach Remis nur ein Knopf hervorgehoben', rm.f.orange.length === 1, rm.f.orange);
  await rm.p.k.close();
  const sg = await partie(browser, IPHONE13, 'hell', 'sieg');
  pruefe('E3 iphone13: nach einem Sieg bleibt der Fokus auf der Folgeaktion (nicht "Zur Analyse")', sg.f.ziel !== 'analyse' && sg.f.imBlatt, sg.f);
  await sg.p.k.close();

  // I3
  for (const [g, schema] of [[PC, 'dunkel'], [IPHONE13, 'hell']]) {
    const p = await seite(browser, g, schema, { vitrine: ['stufe-siege', null, null] });
    await p.s.evaluate(() => window.__app.gehe('ich'));
    await p.s.waitForSelector('.pr-karte .pr-vitrine', { timeout: 15000 });
    await ruhe(p.s);
    // ein Moment-Overlay (neuer Erfolg) darf fehlen; ist es da, wird es geschlossen
    for (let i = 0; i < 6 && await p.s.locator('.st-moment .st-weiter').count(); i++) { await p.s.locator('.st-moment .st-weiter').first().click().catch(() => {}); await warte(400); }
    const st = await streifen(p.s);
    pruefe(`I3 ${g.name}: kein Streifen in der Grundfarbe unter dem Bannerbild (0 px)`, st.grund === 0, st);
    pruefe(`I3 ${g.name}: keine Seitenfehler`, p.seitenfehler.length === 0, p.seitenfehler);
    if (BILDER) { const b = await p.s.locator('.pr-karte').boundingBox(); await p.s.screenshot({ path: path.join(BILDER, `i3-ich-${g.name}-${schema}-${TEIL}.png`), clip: { x: Math.max(0, b.x - 8), y: Math.max(0, b.y - 8), width: Math.min(b.width + 16, g.viewport.width), height: Math.min(b.height + 16, 600) } }); }
    await p.k.close();
  }

  // D3
  for (const [g, schema] of [[IPHONESE, 'hell'], [IPHONE13, 'hell'], [PC, 'dunkel']]) {
    const d = await duellEnde(browser, g, schema);
    pruefe(`D3 ${g.name}: unter den Bildern stehen "Du" und der Gegner wie in der Leiste`, d.m.texte[0] === 'Du' && d.m.texte[1] === 'KI-Gegner · 1200' && d.m.unterBild, d.m);
    pruefe(`D3 ${g.name}: Namen mindestens 12 px, Farbe wie der Titel der Karte`, d.m.groesse >= 12 && d.m.farbeWieTitel, d.m);
    pruefe(`D3 ${g.name}: die Namen kosten hoechstens eine Zeile (<= 24 px)`, d.m.mit - d.m.ohne <= 24, { mit: d.m.mit, ohne: d.m.ohne });
    pruefe(`D3 ${g.name}: Knoepfe ohne Scrollen im Bild`, d.m.knoepfeImBild && d.m.scroll === 0, d.m);
    pruefe(`D3 ${g.name}: keine Seitenfehler`, d.seitenfehler.length === 0, d.seitenfehler);
    await bild(d.s, `d3-duell-ende-${g.name}-${schema}`);
    await d.k.close();
  }
  const en = await duellEnde(browser, IPHONESE, 'hell', 'en');
  pruefe('D3 iphonese englisch: "You" und "AI opponent · 1200" unter den Bildern', en.m.texte[0] === 'You' && en.m.texte[1] === 'AI opponent · 1200' && en.m.unterBild, en.m);
  pruefe('D3 iphonese englisch: Knoepfe ohne Scrollen im Bild', en.m.knoepfeImBild && en.m.scroll === 0 && en.m.mit - en.m.ohne <= 24, en.m);
  await en.k.close();
} catch (e) {
  fehler++;
  // INTENTIONAL-SLOP[T4]: Ablauffehler gehen wie alle Zeilen auf die Konsole (tests/alle.mjs liest sie)
  console.log('FEHLER Ablauf ' + (e && e.stack || e));
} finally {
  if (browser) await browser.close();
  server.kill();
}
// INTENTIONAL-SLOP[T4]: Zusammenfassung der Probe, Ausgabeweg wie alle Zeilen hier
console.log(`\n${ok} ok, ${fehler} Fehler${BILDER ? '; Bilder in ' + BILDER : ''}`);
process.exit(fehler ? 1 : 0);
