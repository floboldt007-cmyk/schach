// Bilder fuer Flo (Feinschliff R19, Emotes, Finisher, Klaenge): Shop A mit den Regalen "Mehr Emotes", "Mehr Finisher",
// "Mehr Klaenge" auf iPhone 13, iPhone SE, iPad hoch und quer und PC, je hell und dunkel, dazu je Regal die Vorschau
// (Premium-Sticker gross, Finisher-Bild, Klangset mit Anhoeren). Variante A (gebaut, Empfehlung): Regale als waagrechte
// Streifen; Variante B (nur als Bild, per eingeblendetem CSS): Regale als Raster, alles untereinander. Dazu die Sammlung
// (Emotes: acht gratis, sechs Premium gesperrt) und je neuem Finisher eine kurze Bildfolge (150, 450, 900 ms) auf einem
// Probebrett.
// Kein Teil von tests/alle.mjs. Netzwerk ausschliesslich simuliert; das Konto ist kein Erfinder (sieht, was alle sehen).
//
//   node tests/bilder-emotes-finisher.mjs                      Bilder nach <tmp>/bilder-emotes-finisher
//   node tests/bilder-emotes-finisher.mjs --bilder=<ordner>    Unterordner a/, b/, sammlung/, finisher/
// Exit 0, wenn alle Bilder entstanden sind, jede Ansicht ihre Regale zeigte und kein Seitenfehler kam; sonst 1.
import http from 'node:http';
import os from 'node:os';
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { browserTyp } from './browser.mjs';

const require = createRequire(import.meta.url);
let pw;
for (const p of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
  try { pw = require(p); break; } catch (e) { /* naechster */ }
}
if (!pw) throw new Error('Playwright fehlt (PLAYWRIGHT_PFAD setzen)');
const arg = (n) => { const a = process.argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : null; };
const BILDER = arg('bilder') || path.join(os.tmpdir(), 'bilder-emotes-finisher');

const root = fileURLToPath(new URL('../', import.meta.url));
const typen = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' };
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
  // INTENTIONAL-SLOP[T4]: die Pruefzeile ist die Ausgabe des Werkzeugs (wie in tests/bilder-shop.mjs)
  console.log(`${gut ? 'ok  ' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(detail)}`);
}

const UID = 'u1';
const SITZUNG = { access_token: 'a.' + Buffer.from(JSON.stringify({ sub: UID })).toString('base64url') + '.x', refresh_token: 'test-r',
  expires_at: 9999999999, user: { id: UID, email: 'spieler@example.invalid' } };
const bediener = async (route) => {
  const url = new URL(route.request().url());
  const antwort = (d) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
  if (url.pathname.startsWith('/auth/v1/')) return antwort({ id: UID, email: 'spieler@example.invalid' });
  if (url.pathname === '/rest/v1/altersangaben') return antwort([{ ab18: true }]);
  if (url.pathname === '/rest/v1/profile') return antwort([{ user_id: UID, benutzername: 'Mira' }]);
  if (url.pathname.endsWith('/edition_staende')) return antwort([{ produkt_id: 'brett-mitternacht', name: 'Mitternacht & Gold' }]);
  if (/karte_(melde_stufen|waehle)$/.test(url.pathname)) return antwort({ taler: 0, stufen: {}, banner: ['start'], wahl: { banner: 'start' } });
  return antwort([]);
};
function initSkript({ sitzung }) {
  try {
    if (!sessionStorage.getItem('shop-start')) {
      sessionStorage.setItem('shop-start', '1');
      localStorage.clear();
      localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ klang: false, bewegung: 'normal', figuren: 'cburnett' }));
      localStorage.setItem('schach-arena:konto:sichtbar', '1');
      localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(sitzung));
    }
  } catch (e) { /* egal */ }
}
const bilderFertig = (s, w) => s.waitForFunction((x) => [...document.querySelectorAll(`${x} img`)].every((i) => i.complete), w, { timeout: 15000 })
  .catch(() => {}).then(() => warte(400));
// Variante B nur als Bild: Regale als Raster wie die fuenf Plaetze, alles untereinander
const VARIANTE_B = '.shf-regal-reihe { grid-auto-flow: row !important; grid-template-columns: repeat(auto-fill, minmax(132px, 1fr)) !important; overflow: visible !important; }';

async function oeffneSammlung(s) {
  await s.goto(`http://127.0.0.1:${PORT}/index.html?test#heim`);
  await s.waitForFunction(() => window.__app && typeof window.__app.gehe === 'function' && document.querySelector('.screen.heim-screen'), null, { timeout: 45000 });
  await s.evaluate(() => window.__app.gehe('ich'));
  await s.waitForSelector('.sa-screen', { timeout: 30000 });
  await warte(400);
  for (let i = 0; i < 12 && await s.locator('.st-moment .st-weiter').count(); i++) { await s.locator('.st-moment .st-weiter').first().click(); await warte(250); }
}
async function oeffneShop(s) {
  await oeffneSammlung(s);
  await s.locator('.sa-platz[data-bereich="shop"], .sa-gross[data-bereich="shop"]').first().click();
  await s.waitForSelector('.sa-blatt .shf .shf-regal', { timeout: 15000 });
  await bilderFertig(s, '.sa-blatt');
}

const GERAETE = [['iphone13', 390, 844], ['iphonese', 375, 667], ['ipad', 820, 1180], ['ipadquer', 1180, 820], ['pc', 1280, 720]]
  .flatMap((g) => [[...g, 'hell'], [...g, 'dunkel']]);
const seitenfehler = [];
let browser;
try {
  browser = await browserTyp(pw).launch({ headless: true });
  const kontext = async (w, h, farbe) => {
    const k = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true, serviceWorkers: 'block',
      colorScheme: farbe === 'dunkel' ? 'dark' : 'light', locale: 'de-DE', timezoneId: 'Europe/Berlin' });
    await k.route('**/*.supabase.co/**', bediener);
    await k.addInitScript(initSkript, { sitzung: SITZUNG });
    return k;
  };
  for (const variante of ['a', 'b']) {
    const ordner = path.join(BILDER, variante);
    mkdirSync(ordner, { recursive: true });
    for (const [geraet, w, h, farbe] of GERAETE) {
      // Variante B nur auf iPhone 13 und PC, je hell und dunkel (genug zum Vergleichen)
      if (variante === 'b' && !['iphone13', 'pc'].includes(geraet)) continue;
      const name = geraet + (farbe === 'dunkel' ? '-dunkel' : '');
      const gruppe = `${variante} ${name}`;
      const k = await kontext(w, h, farbe);
      const s = await k.newPage(); s.setDefaultTimeout(15000);
      s.on('pageerror', (e) => seitenfehler.push(`${gruppe}: ${e.message}`));
      const bild = async (teil) => {
        const da = await s.screenshot({ path: path.join(ordner, `regale-${name}-${teil}.png`) }).then(() => true).catch(() => false);
        pruefe(`${gruppe}: Bild ${teil}`, da);
      };
      try {
        await oeffneShop(s);
        if (variante === 'b') await s.addStyleTag({ content: VARIANTE_B });
        const regale = await s.evaluate(() => [...document.querySelectorAll('.sa-blatt .shf-regal')].map((r) => r.dataset.art).join());
        pruefe(`${gruppe}: drei Regale`, regale === 'emote,finisher,klang', regale);
        await s.locator('.sa-blatt .shf-regal[data-art="emote"]').scrollIntoViewIfNeeded();
        await s.evaluate(() => document.querySelector('.sa-blatt .shf-regal[data-art="emote"]')?.scrollIntoView({ block: 'start' }));
        await warte(500);
        await bild('regale');
        if (variante === 'a') {
          for (const art of ['emote', 'finisher', 'klang']) {
            const karte = s.locator(`.sa-blatt .shf-regal[data-art="${art}"] .shf-rk`).first();
            await karte.scrollIntoViewIfNeeded();
            await karte.click();
            await s.waitForSelector('.sheet-karte .shf-vorschau', { timeout: 10000 });
            await bilderFertig(s, '.sheet-karte');
            await warte(700);
            await bild('vorschau-' + art);
            await s.locator('.sheet-karte .sheet-knoepfe button', { hasText: 'Schließen' }).first().click();
            await s.waitForSelector('.sheet-karte', { state: 'detached', timeout: 5000 }).catch(() => {});
            await warte(300);
          }
        }
      } catch (e) {
        pruefe(`${gruppe}: Ablauf ohne Abbruch`, false, e.message.split('\n')[0]);
      }
      await k.close();
    }
  }

  // Sammlung: Emotes (acht gratis, sechs Premium gesperrt), iPhone 13 und PC hell
  mkdirSync(path.join(BILDER, 'sammlung'), { recursive: true });
  for (const [geraet, w, h] of [['iphone13', 390, 844], ['pc', 1280, 720]]) {
    const k = await kontext(w, h, 'hell');
    const s = await k.newPage(); s.setDefaultTimeout(15000);
    s.on('pageerror', (e) => seitenfehler.push(`sammlung ${geraet}: ${e.message}`));
    try {
      await oeffneSammlung(s);
      await s.locator('.sa-platz[data-bereich="emotes"], .sa-gross[data-bereich="emotes"]').first().click();
      await s.waitForSelector('.sa-blatt .sa-bereich[data-bereich="emotes"]:not([hidden])', { timeout: 10000 });
      await warte(600);
      const zu = await s.evaluate(() => document.querySelectorAll('.sa-blatt .sa-bereich[data-bereich="emotes"] [data-zustand="zu"], .sa-blatt .sa-bereich[data-bereich="emotes"] .zu').length);
      pruefe(`sammlung ${geraet}: Premium gesperrt sichtbar`, zu >= 6, zu);
      const da = await s.screenshot({ path: path.join(BILDER, 'sammlung', `emotes-${geraet}.png`), fullPage: false }).then(() => true).catch(() => false);
      pruefe(`sammlung ${geraet}: Bild`, da);
    } catch (e) {
      pruefe(`sammlung ${geraet}: Ablauf ohne Abbruch`, false, e.message.split('\n')[0]);
    }
    await k.close();
  }

  // Finisher-Bildfolge: Probebrett 480 px, Effekt per window.__finisher (?test), Aufnahmen bei 150, 450 und 900 ms
  mkdirSync(path.join(BILDER, 'finisher'), { recursive: true });
  for (const farbe of ['hell', 'dunkel']) {
    const k = await kontext(900, 700, farbe);
    const s = await k.newPage(); s.setDefaultTimeout(15000);
    s.on('pageerror', (e) => seitenfehler.push(`finisher ${farbe}: ${e.message}`));
    try {
      await oeffneSammlung(s);
      await s.waitForFunction(() => window.__finisher && document.querySelector('link[data-paket="finisher"]'), null, { timeout: 15000 });
      for (const id of ['blitzschlag', 'goldregen', 'schockwelle']) {
        await s.evaluate((fid) => {
          document.querySelector('#probe-brett')?.remove();
          const b = document.createElement('div');
          b.id = 'probe-brett';
          b.style.cssText = 'position:fixed;left:50%;top:50%;width:480px;height:480px;transform:translate(-50%,-50%);z-index:99999;container-type:inline-size;'
            + 'background:repeating-conic-gradient(#b58863 0 25%, #f0d9b5 0 50%) 0 0/120px 120px;border-radius:8px;box-shadow:0 10px 40px rgba(0,0,0,.5)';
          const eff = document.createElement('div'); eff.style.cssText = 'position:absolute;inset:0';
          b.append(eff); document.body.append(b);
          window.__probe = window.__finisher.starteFinisher({ gewinner: 'flo', buehne: { effekte: eff, feld: () => ({ x: 4, y: 0 }) },
            letzterZug: { nach: 'e8' }, koenigFeld: 'e8' }, fid);
        }, id);
        for (const ms of [150, 450, 900]) {
          await warte(ms === 150 ? 150 : ms === 450 ? 300 : 450);
          const da = await s.locator('#probe-brett').screenshot({ path: path.join(BILDER, 'finisher', `${id}-${farbe}-${ms}ms.png`) }).then(() => true).catch(() => false);
          pruefe(`finisher ${id} ${farbe}: Bild ${ms} ms`, da);
        }
        await s.evaluate(() => window.__probe?.fertig);
      }
    } catch (e) {
      pruefe(`finisher ${farbe}: Ablauf ohne Abbruch`, false, e.message.split('\n')[0]);
    }
    await k.close();
  }
} finally {
  if (browser) await browser.close();
  server.close();
}
pruefe('keine Seitenfehler', seitenfehler.length === 0, seitenfehler.slice(0, 3));
console.log(`\n${ok}/${gesamt} Pruefungen, Bilder in ${BILDER}`);
process.exitCode = ok === gesamt ? 0 : 1;
