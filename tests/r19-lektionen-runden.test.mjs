// R19 Lektionen besser, Browser-Teil (Flo 14.11.2026 "Lektionen zu schnell durch"): die Runden im Lektions-Screen
// (js/ui/lektion.js, Daten mattbilder.js rundenVon). Als Erfinder mit gefaelschter Verteidigung (window.__test.lektionZug:
// der erste legale Zug von chess.js), die eigenen Zuege sucht der Test vorher in Node gegen genau diese Verteidigung.
//   - neue Lektion: drei Rundenknoepfe, Runde 1 gewaehlt, 2 und 3 zu, Stellung = Lektionsstellung
//   - Runde 1 geschafft: 1 Stern gespeichert, "Weiter mit Runde 2" fuehrt in Runde 2 (Stellung, Rundentext)
//   - Runde 3 (Meisterprobe): kein Hinweis-Knopf; geschafft: 3 Sterne
//   - alter Spielstand mit 3 Sternen: alle Runden offen, Runde 3 vorgewaehlt
//   - Lektion ohne Runden: keine Rundenknoepfe (wie bisher)
//   - iPhone SE, iPhone 13, iPad hoch, PC, je hell und dunkel: Rundenknoepfe ganz sichtbar, nichts rollt waagrecht,
//     Ziffern der offenen Runden mit Kontrast >= 4,5 gegen ihre Pille
//   node tests/r19-lektionen-runden.test.mjs
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Chess } from '../vendor/chess/chess.js';
import { lektion, rundenVon, pruefeZiel, bilanz } from '../js/pakete/lernen/mattbilder.js';
import { DE } from '../js/pakete/lernen/texte.js';
import { browserTyp } from './browser.mjs';

const require = createRequire(import.meta.url);
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || await (await import('./freier-port.mjs')).freierPort();
const BASIS = `http://127.0.0.1:${PORT}/index.html?test`;
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

let ok = 0; let fehler = 0;
function pruefe(name, wert, info = '') {
  if (wert) { ok++; console.log('ok   ' + name); } else { fehler++; console.log('FEHLER ' + name + ' ' + (typeof info === 'string' ? info : JSON.stringify(info))); }
}

// Flos Zuege gegen die gefaelschte Verteidigung (erster legaler Zug), wie die App gewertet (pruefeZiel); kuerzeste Folge
const ersterZug = (c) => c.moves({ verbose: true })[0];
function loese(l) {
  const start = bilanz(new Chess(l.fen));
  for (let tiefe = 1; tiefe <= l.ziel; tiefe++) {
    const weg = (fen, n) => {
      const c0 = new Chess(fen);
      for (const m of c0.moves({ verbose: true })) {
        const c = new Chess(fen);
        c.move({ from: m.from, to: m.to, promotion: m.promotion ? 'q' : undefined });
        if (m.promotion && m.promotion !== 'q') continue;
        const zug = m.from + m.to;
        let r = pruefeZiel(l, start, c, { wann: 'flo', zuege: n });
        if (r === 'geschafft') return [zug];
        if (r) continue;
        const g = ersterZug(c);
        if (!g) continue;
        c.move({ from: g.from, to: g.to, promotion: g.promotion });
        r = pruefeZiel(l, start, c, { wann: 'gegner', zuege: n });
        if (r === 'geschafft') return [zug];
        if (r || n >= tiefe) continue;
        const rest = weg(c.fen(), n + 1);
        if (rest) return [zug, ...rest];
      }
      return null;
    };
    const w = weg(l.fen, 1);
    if (w) return w;
  }
  return null;
}

async function warteAufServer(url, ms = 15000) {
  const ende = Date.now() + ms;
  while (Date.now() < ende) {
    try { const r = await fetch(url); await r.arrayBuffer(); if (r.ok) return; } catch (e) { /* noch nicht da */ }
    await warte(150);
  }
  throw new Error('Server startet nicht: ' + url);
}
function ladePlaywright() {
  for (const k of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
    try { return require(k); } catch (e) { /* naechster */ }
  }
  throw new Error('Playwright nicht gefunden (PLAYWRIGHT_PFAD setzen)');
}

const SUPA = 'https://usaamcqypmvgqmsbfecb.supabase.co';
const UID = '0f8b6c1e-2d3a-4b5c-8d9e-0a1b2c3d4e5f';
const token = (sub) => 'a.' + Buffer.from(JSON.stringify({ sub })).toString('base64url') + '.x';
const SITZUNG = { access_token: token(UID), refresh_token: 'r1', expires_at: 9999999999, user: { id: UID, email: 'probe@example.invalid' } };
const ERFINDER_ZEILEN = ['erfinder-banner-blatt-0', 'erfinder-titel', 'erfinder-figuren-blaupause', 'erfinder-finisher-signatur']
  .map((stueck_id) => ({ stueck_id }));

async function seite(browser, { groesse = { width: 1180, height: 820 }, lernen = null, schema = 'light' } = {}) {
  const k = await browser.newContext({ viewport: groesse, colorScheme: schema, serviceWorkers: 'block', timezoneId: 'Europe/Berlin' });
  const s = await k.newPage();
  const fehlerListe = [];
  s.on('pageerror', (e) => fehlerListe.push(e.message));
  s.on('console', (m) => { if (m.type() === 'error') fehlerListe.push(m.text()); });
  await s.route(SUPA + '/**', (r) => r.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify(r.request().url().includes('/rest/v1/sonderstuecke') ? ERFINDER_ZEILEN : []) }));
  await s.addInitScript(({ sitzung, uid, lernen }) => {
    try {
      if (sessionStorage.getItem('probe-start')) return;
      sessionStorage.setItem('probe-start', '1');
      localStorage.clear();
      localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(sitzung));
      localStorage.setItem('schach-arena:konto:sonderstuecke', JSON.stringify({ konto: uid, ids: ['erfinder-titel'] }));
      if (lernen) localStorage.setItem('schach-arena:v1:modul:lernen', JSON.stringify(lernen));
    } catch (e) { /* egal */ }
  }, { sitzung: SITZUNG, uid: UID, lernen });
  await s.goto(BASIS + '#training');
  await s.waitForFunction(() => !!window.__app && !!document.documentElement.dataset.screen, null, { timeout: 30000 });
  await s.evaluate(async () => {
    const { Chess: C } = await import('/vendor/chess/chess.js');
    window.__test = window.__test || {};
    window.__test.lektionPause = 30;
    window.__test.lektionZug = (fen) => { const m = new C(fen).moves({ verbose: true })[0]; return m ? m.from + m.to + (m.promotion || '') : null; };
  });
  return { k, s, fehlerListe };
}

const lz = (s) => s.evaluate(() => (window.__lektion ? window.__lektion.zustand() : { offen: false }));
async function warteLz(s, bedingung, ms = 10000) {
  await s.waitForFunction((b) => {
    const z = window.__lektion ? window.__lektion.zustand() : { offen: false };
    return new Function('z', 'return ' + b)(z);
  }, bedingung, { timeout: ms }).catch(() => {});
}
async function ziehe(s, uci) {
  for (const f of [uci.slice(0, 2), uci.slice(2, 4)]) {
    const b = await s.locator(`.ls-screen .brett-felder .feld[data-feld="${f}"]`).boundingBox();
    await s.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    await warte(90);
  }
  const dame = s.locator('.ls-screen .brett-umwandlung .umwandlung-figur[data-figur="q"]');
  if (await dame.count() && await dame.first().isVisible()) await dame.first().click();
}
const knoepfe = (s) => s.evaluate(() => [...document.querySelectorAll('.ls-runde')].map((b) => ({
  r: b.dataset.r, an: b.getAttribute('aria-pressed') === 'true', zu: b.disabled, geschafft: b.classList.contains('geschafft') })));
const gespeichert = (s, id) => s.evaluate((id) => { try { return JSON.parse(localStorage.getItem('schach-arena:v1:modul:lernen')).lek[id]; } catch (e) { return null; } }, id);
const blattKnoepfe = (s) => s.evaluate(() => [...document.querySelectorAll('.ls-screen > .ergebnis-overlay:not([hidden]) [data-a]')].map((b) => b.dataset.a));
const blattDa = (s) => s.waitForSelector('.ls-screen > .ergebnis-overlay:not([hidden]) .ergebnis-karte', { timeout: 8000 }).catch(() => {});

async function spieleRunde(s, l, n) {
  const r = rundenVon(l)[n - 1];
  const weg = loese({ ...l, fen: r.fen, ziel: r.ziel });
  pruefe(`${l.id} R${n}: Node findet einen Weg gegen die Test-Verteidigung (${weg ? weg.length : '-'} Zuege)`, !!weg);
  if (!weg) return;
  await s.locator('.ls-aktionen [data-a="los"]').click().catch(() => {});
  await warteLz(s, "z.phase === 'flo'");
  for (const u of weg) {
    await warteLz(s, "z.phase === 'flo' || z.phase === 'ende'");
    if ((await lz(s)).phase === 'ende') break;
    await ziehe(s, u);
    await warte(150);
  }
  await warteLz(s, "z.phase === 'ende'");
  await blattDa(s);
}

async function rundenTeil(browser) {
  const l = lektion('patt-vermeiden');
  const p = await seite(browser);
  await p.s.evaluate(() => window.__app.gehe('lektion', { id: 'patt-vermeiden' }));
  await warteLz(p.s, "z.offen && z.phase === 'intro'");
  let z = await lz(p.s);
  let k = await knoepfe(p.s);
  pruefe('neu: drei Rundenknoepfe, Runde 1 gewaehlt, 2 und 3 zu', k.length === 3 && k[0].an && !k[0].zu && k[1].zu && k[2].zu && !k.some((x) => x.geschafft), k);
  pruefe('neu: Runde 1 von 3, Stellung = Lektionsstellung', z.runde === 1 && z.runden === 3 && z.fen === l.fen, z);
  await spieleRunde(p.s, l, 1);
  z = await lz(p.s);
  pruefe('Runde 1 geschafft: 1 Stern, gespeichert', z.sterne === 1 && (await gespeichert(p.s, l.id))?.s === 1, { z, g: await gespeichert(p.s, l.id) });
  pruefe('Runde 1 geschafft: Ergebnisblatt bietet "Weiter mit Runde 2" zuerst', (await blattKnoepfe(p.s))[0] === 'runde-weiter', await blattKnoepfe(p.s));
  await p.s.locator('.ls-screen > .ergebnis-overlay [data-a="runde-weiter"]').click();
  await warteLz(p.s, 'z.runde === 2');
  z = await lz(p.s);
  const idee = await p.s.evaluate(() => document.querySelector('.ls-idee')?.textContent);
  pruefe('Runde 2: Stellung und Text der Runde, Knopf 2 gewaehlt', z.runde === 2 && z.fen === rundenVon(l)[1].fen && idee === DE['runde.patt-vermeiden.2']
    && (await knoepfe(p.s))[1].an, { z, idee });
  await spieleRunde(p.s, l, 2);
  pruefe('Runde 2 geschafft: 2 Sterne', (await lz(p.s)).sterne === 2 && (await gespeichert(p.s, l.id))?.s === 2, await gespeichert(p.s, l.id));
  await p.s.locator('.ls-screen > .ergebnis-overlay [data-a="runde-weiter"]').click();
  await warteLz(p.s, "z.runde === 3 && z.phase === 'flo'");
  const hinweis = await p.s.locator('.ls-aktionen [data-a="hinweis"]').count();
  pruefe('Meisterprobe: kein Hinweis-Knopf', (await lz(p.s)).runde === 3 && hinweis === 0, { hinweis });
  await spieleRunde(p.s, l, 3);
  z = await lz(p.s);
  const kopf = await p.s.evaluate(() => document.querySelector('.ls-meldung b')?.textContent);
  pruefe('Meisterprobe geschafft: 3 Sterne, "Meisterprobe bestanden!"', z.sterne === 3 && (await gespeichert(p.s, l.id))?.s === 3 && kopf === DE['runde.gemeistert'], { z, kopf });
  k = await knoepfe(p.s);
  pruefe('danach: alle drei Runden offen und geschafft', k.every((x) => !x.zu && x.geschafft), k);
  // eine fertige Runde nochmal waehlen geht (Knopf 1), die Sterne bleiben
  await p.s.locator('.ls-screen > .ergebnis-overlay [data-a="nochmal"]').click().catch(() => {});
  await warte(200);
  await p.s.locator('.ls-runde[data-r="1"]').click();
  await warteLz(p.s, 'z.runde === 1');
  pruefe('Runde 1 nochmal waehlbar, Stellung der Runde 1', (await lz(p.s)).fen === l.fen, await lz(p.s));
  pruefe('keine Fehler in der Konsole', !p.fehlerListe.length, p.fehlerListe);
  await p.k.close();
}

async function altstandTeil(browser) {
  // alter Spielstand (vor R19): dame mit 3 Sternen und 7 Zuegen
  const p = await seite(browser, { lernen: { lek: { dame: { s: 3, z: 7 } } } });
  await p.s.evaluate(() => window.__app.gehe('lektion', { id: 'dame' }));
  await warteLz(p.s, "z.offen && z.phase === 'intro'");
  const z = await lz(p.s);
  const k = await knoepfe(p.s);
  pruefe('alter Stand 3 Sterne: Runde 3 vorgewaehlt, alle offen', z.runde === 3 && k.length === 3 && k.every((x) => !x.zu) && k[2].an, { z, k });
  await p.s.evaluate(() => window.__app.gehe('lektion', { id: 'grundreihe' }));
  await warteLz(p.s, "z.offen && z.id === 'grundreihe'");
  pruefe('Lektion ohne Runden: keine Rundenknoepfe', await p.s.locator('.ls-runden').count() === 0 && (await lz(p.s)).runden === 1);
  pruefe('keine Fehler in der Konsole (alter Stand)', !p.fehlerListe.length, p.fehlerListe);
  await p.k.close();
}

// Kontrast der Ziffer gegen ihre Pille (::before), WCAG 1.4.3: 4,5:1; gesperrte Knoepfe sind ausgenommen (disabled)
const kontrast = () => {
  const rgb = (s) => { const m = s.match(/[\d.]+/g).map(Number); return m.length > 3 && m[3] === 0 ? null : m.slice(0, 3); };
  const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const karte = getComputedStyle(document.querySelector('.ls-status')).backgroundColor;
  return [...document.querySelectorAll('.ls-runde:not(:disabled)')].map((b) => {
    const v = rgb(getComputedStyle(b).color);
    const h = rgb(getComputedStyle(b, '::before').backgroundColor) || rgb(karte);
    const [a, c] = [lum(v), lum(h)].sort((x, y) => y - x);
    return { r: b.dataset.r, k: Math.round(((a + 0.05) / (c + 0.05)) * 10) / 10 };
  });
};
async function kleinTeil(browser) {
  const GERAETE = [['iPhone SE', { width: 375, height: 667 }], ['iPhone 13', { width: 390, height: 844 }],
    ['iPad hoch', { width: 820, height: 1180 }], ['PC', { width: 1280, height: 800 }]];
  for (const [name, groesse] of GERAETE) {
    for (const schema of ['light', 'dark']) {
      const p = await seite(browser, { groesse, schema, lernen: { lek: { turm: { s: 1, z: 15 } } } });
      await p.s.evaluate(() => window.__app.gehe('lektion', { id: 'turm' }));
      await warteLz(p.s, "z.offen && z.phase === 'intro'");
      await warte(400);
      const m = await p.s.evaluate(() => {
        const bs = [...document.querySelectorAll('.ls-runde')].map((b) => b.getBoundingClientRect());
        return { n: bs.length, drin: bs.every((r) => r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight && r.width >= 44 && r.height >= 44),
          rollt: document.documentElement.scrollWidth - innerWidth };
      });
      const k = await p.s.evaluate(kontrast);
      const modus = schema === 'dark' ? 'dunkel' : 'hell';
      pruefe(`${name} ${modus}: drei Rundenknoepfe ganz sichtbar, Tippflaeche 44 px, nichts rollt waagrecht`, m.n === 3 && m.drin && m.rollt <= 1, m);
      pruefe(`${name} ${modus}: Ziffern der offenen Runden mit Kontrast >= 4,5`, k.length === 2 && k.every((x) => x.k >= 4.5), k);
      pruefe(`${name} ${modus}: keine Fehler in der Konsole`, !p.fehlerListe.length, p.fehlerListe);
      await p.k.close();
    }
  }
}

const server = spawn(process.execPath, ['tests/testserver.mjs', String(PORT), '--bind', '127.0.0.1'], { cwd: WURZEL, stdio: 'ignore' });
let browser = null;
try {
  await warteAufServer(`http://127.0.0.1:${PORT}/index.html`);
  browser = await browserTyp(ladePlaywright()).launch();
  await rundenTeil(browser);
  await altstandTeil(browser);
  await kleinTeil(browser);
} catch (e) {
  pruefe('Browser-Teil laeuft durch', false, e.message);
} finally {
  if (browser) await browser.close();
  server.kill();
}
console.log(`${ok}/${ok + fehler} bestanden`);
process.exit(fehler ? 1 : 0);
