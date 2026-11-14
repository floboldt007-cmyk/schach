// R19 Auswahl (14.11.2026): prueft die Variante dieses Zweigs (Lobby oder Shopleiste, erkannt an [data-variante]) und macht
// auf Wunsch die Bilder fuer Flos Auswahlseite. PC 1440 x 900 und iPhone 390 x 844, hell und dunkel, angemeldet als
// Erfinder (die Lobby gibt es nur im Labor). Netz nur simuliert, keine Preise, kein Kauf.
//
//   node tests/r19-auswahl.mjs                    nur pruefen
//   AUS=<ordner> node tests/r19-auswahl.mjs       pruefen und Bilder nach <ordner>/<thema>/<variante>/<breite>x<hoehe>-<modus>.png
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { browserTyp } from './browser.mjs';

const require = createRequire(import.meta.url);
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || await (await import('./freier-port.mjs')).freierPort();
const BASIS = `http://127.0.0.1:${PORT}/index.html?test`;
const AUS = process.env.AUS || '';
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

let ok = 0; let fehler = 0;
function pruefe(name, wert, info = '') {
  // INTENTIONAL-SLOP[T4]: die Pruefzeile ist die Ausgabe des Tests (wie in tests/lobby.test.mjs)
  if (wert) { ok++; console.log('ok   ' + name); } else { fehler++; console.log('FEHLER ' + name + ' ' + JSON.stringify(info)); }
}
let pw;
for (const k of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
  try { pw = require(k); break; } catch (e) { /* naechster */ }
}
if (!pw) throw new Error('Playwright fehlt');

const SUPA = 'https://usaamcqypmvgqmsbfecb.supabase.co';
const UID = '0f8b6c1e-2d3a-4b5c-8d9e-0a1b2c3d4e5f';
const SITZUNG = { access_token: 'a.' + Buffer.from(JSON.stringify({ sub: UID })).toString('base64url') + '.x', refresh_token: 'r1',
  expires_at: 9999999999, user: { id: UID, email: 'probe@example.invalid' } };

async function seite(browser, { breite, hoehe, modus, hash }) {
  const k = await browser.newContext({ viewport: { width: breite, height: hoehe }, deviceScaleFactor: 1, serviceWorkers: 'block', hasTouch: breite < 700 });
  const s = await k.newPage();
  const fehlerListe = [];
  s.on('pageerror', (e) => fehlerListe.push(e.message));
  await k.route('**/*', (r) => {
    const url = new URL(r.request().url());
    if (url.hostname === '127.0.0.1') return r.continue();
    if (url.origin !== SUPA) return r.abort();
    return r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify(url.pathname.includes('sonderstuecke') ? [{ stueck_id: 'erfinder-titel' }] : []) });
  });
  await s.addInitScript(({ sitzung, uid, modus }) => {
    if (sessionStorage.getItem('r19a')) return;
    sessionStorage.setItem('r19a', '1');
    localStorage.clear();
    localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(sitzung));
    localStorage.setItem('schach-arena:konto:sonderstuecke', JSON.stringify({ konto: uid, ids: ['erfinder-titel'] }));
    localStorage.setItem('schach-arena:v1:modul:start', JSON.stringify({ v: 1, gesehen: '2026-11-01' }));
    localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ klang: false, bewegung: 'aus', modus }));
  }, { sitzung: SITZUNG, uid: UID, modus });
  await s.goto(`${BASIS}#${hash}`);
  await s.waitForFunction((m) => document.documentElement.dataset.modus === m, modus, { timeout: 15000 });
  return { k, s, fehlerListe };
}

// je Variante: was auf dem Bildschirm stehen muss (laeuft im Browser, gibt { gut, info } zurueck)
const PRUEFUNGEN = {
  'lobby-a': async (s) => {
    const ruhe = await s.evaluate(() => {
      const arten = [...document.querySelectorAll('.lb-art')];
      const img = document.querySelector('.lb-rang img');
      return { arten: arten.map((a) => a.dataset.art + (a.getAttribute('aria-checked') === 'true' ? '*' : '') + (a.disabled ? '-' : '')).join(),
        kasten: !!document.querySelector('.lb-wertungen, .lb-zeile'), wappen: !!(img && img.complete && img.naturalWidth > 0),
        zahlen: document.querySelectorAll('.lb-spielen .zahl').length, aendern: document.querySelector('.lb-aendern').hidden };
    });
    await s.locator('.lb-spielen [data-wert="freundschaft"]').click();
    await s.locator('.lb-art[data-art="schnell"]').click();
    await s.locator('.lb-aendern > summary').click();
    const offen = await s.evaluate(() => ({ arten: [...document.querySelectorAll('.lb-art')].map((a) => a.dataset.art + (a.getAttribute('aria-checked') === 'true' ? '*' : '') + (a.disabled ? '-' : '')).join(),
      chips: [...document.querySelectorAll('.lb-zeit')].filter((b) => b.getClientRects().length).map((b) => b.dataset.zeit).join() }));
    await s.locator('.lb-zeit[data-zeit="15+10"]').click();
    const klein = await s.locator('.lb-art[data-art="schnell"] small').innerText();
    return { gut: ruhe.arten === 'blitz*,schnell-,klassisch-' && !ruhe.kasten && ruhe.wappen && ruhe.aendern
      && offen.arten === 'blitz,schnell*,klassisch' && offen.chips === '10+0,15+10' && /15\s*\+\s*10/.test(klein), info: { ruhe, offen, klein } };
  },
  'lobby-b': async (s) => {
    const ruhe = await s.evaluate(() => {
      const img = document.querySelector('.lb-rang img');
      return { gewertet: document.querySelector('.lb-gewertet.lb-suchen b')?.textContent.replace(/\s/g, ''),
        frei: [...document.querySelectorAll('.lb-frei')].map((b) => b.dataset.zeit).join(),
        weg: !!document.querySelector('.lb-wertungen, .lb-zeile, .segment, .lb-zeiten'), wappen: !!(img && img.complete && img.naturalWidth > 0),
        klein: [...document.querySelectorAll('.lb-kachel')].filter((e) => e.getBoundingClientRect().height < 44).length };
    });
    await s.locator('.lb-frei[data-zeit="10+0"]').click();
    await s.waitForSelector('.lb-suche[data-phase="suche"]', { timeout: 3000 });
    const zeile = await s.locator('.lb-suche-zeile').innerText();
    return { gut: ruhe.gewertet === '5+3' && ruhe.frei === '3+0,3+2,5+0,10+0,15+10,30+0' && !ruhe.weg && ruhe.wappen && ruhe.klein === 0
      && /Schnellschach/.test(zeile) && /Freundschaft/.test(zeile), info: { ruhe, zeile } };
  },
  'shopleiste-a': async (s) => {
    const ruhe = await s.evaluate(() => {
      const leiste = document.querySelector('.heim-shop');
      const karten = [...leiste.querySelectorAll('.heim-shop-karte')];
      return { titel: leiste.querySelector('h3').textContent, karten: karten.map((k) => k.dataset.produkt).join(),
        bild: karten.every((k) => k.querySelector('svg.heim-shop-bild')?.getBoundingClientRect().width >= 40),
        // keine Preise, kein Kaufknopf, kein Abo: kein Waehrungszeichen und kein Kauf-Element in der Leiste
        geld: /[€$]|EUR|\d+[,.]\d\d/.test(leiste.textContent) || !!leiste.querySelector('.sh-kaufen, [data-preis]'),
        klein: [...leiste.querySelectorAll('button')].filter((b) => b.getClientRects().length && b.getBoundingClientRect().height < 44).length };
    });
    await s.locator('.heim-shop [data-aktion="heim-shop"] >> visible=true').first().click();
    const shop = await s.waitForSelector('[data-bereich="shop"]', { timeout: 5000 }).then(() => true, () => false);
    return { gut: ruhe.titel === 'Neu im Shop' && ruhe.karten === 'brett-mitternacht' && ruhe.bild && !ruhe.geld && ruhe.klein === 0 && shop,
      info: { ruhe, shop } };
  },
};

const server = spawn(process.execPath, ['tests/testserver.mjs', String(PORT), '--bind', '127.0.0.1'], { cwd: WURZEL, stdio: 'ignore' });
let browser;
try {
  const ende = Date.now() + 10000;
  for (;;) {
    try { const r = await fetch(`http://127.0.0.1:${PORT}/index.html`); await r.arrayBuffer(); if (r.ok) break; } catch (e) { /* noch nicht da */ }
    if (Date.now() > ende) throw new Error('Server startet nicht');
    await warte(150);
  }
  browser = await browserTyp(pw).launch({ headless: true });
  for (const [thema, hash, sel] of [['lobby', 'lobby', '.screen.lobby [data-variante]'], ['shopleiste', 'heim', '.heim-screen [data-variante]']]) {
    for (const [breite, hoehe] of [[1440, 900], [390, 844]]) for (const modus of ['hell', 'dunkel']) {
      const p = await seite(browser, { breite, hoehe, modus, hash });
      const da = await p.s.waitForSelector(sel, { timeout: 15000 }).then(() => true, () => false);
      if (!da) { if (breite === 1440 && modus === 'hell') console.log(`--   ${thema}: keine Variante auf diesem Zweig`); await p.k.close(); break; }
      await warte(400);
      const variante = await p.s.locator(sel).first().getAttribute('data-variante');
      const wer = `${variante} ${breite}x${hoehe} ${modus}`;
      const quer = await p.s.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
      if (AUS) {
        const ziel = path.join(AUS, thema, variante.replace(/^[a-z]+-/, ''));
        mkdirSync(ziel, { recursive: true });
        await p.s.screenshot({ path: path.join(ziel, `${breite}x${hoehe}-${modus}.png`) });
      }
      pruefe(`${wer}: kein Querscrollen, keine Seitenfehler`, quer && p.fehlerListe.length === 0, p.fehlerListe);
      const probe = PRUEFUNGEN[variante];
      pruefe(`${wer}: Pruefung der Variante vorhanden`, !!probe, variante);
      if (probe) {
        const r = await probe(p.s);
        pruefe(`${wer}: Variante verhaelt sich wie beschrieben`, r.gut, r.info);
        // zweites Bild: der Zustand nach der Bedienung (z. B. Freundschaft mit offener Zeitwahl)
        if (AUS) { await warte(300); await p.s.screenshot({ path: path.join(AUS, thema, variante.replace(/^[a-z]+-/, ''), `${breite}x${hoehe}-${modus}-bedient.png`) }); }
      }
      await p.k.close();
    }
  }
} finally {
  if (browser) await browser.close();
  server.kill();
}
console.log(`\n${ok}/${ok + fehler} Pruefungen bestanden`);
process.exit(fehler === 0 && ok > 0 ? 0 : 1);
