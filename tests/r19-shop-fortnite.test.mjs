// Shop "wie Fortnite" (Feinschliff R19, 14.11.2026): drei ENTWUERFE hinter der Kennung ?shopStil=a|b|c
// (js/pakete/sammlung/shop-entwurf.js, css/pakete/sammlung.css). Ohne Kennung (und mit unbekannter) bleibt der Shop wie
// heute: eine Edition, Kaufknopf "Bald verfuegbar" abgeschaltet.
//   a "Schaufenster": ein grosses Highlight "Neu diese Woche" oben, darunter Reihen je Kategorie mit Karten.
//   b "Raster": gleich grosse Karten, nach Seltenheit gefaerbt und sortiert, das Neue zuerst.
//   c "Regal": waagerecht wischbare Reihen je Kategorie, die erste Reihe "Neu diese Woche".
// Feste Grenzen (design/runde4/SPIELKONZEPT.md, Regeln der Werkstatt): kein Countdown, keine Rotation, kein "nur heute",
// keine Restzahl; ein Preis nur, wenn der Server ihn schickt (betrag_cent), sonst "Preis folgt"; der Kaufen-Knopf zeigt im
// Entwurf nur eine Vorschau-Meldung und ruft nichts beim Server auf (keine Kasse, kein Stripe).
// Antippen einer Karte zeigt die Vorschau auf dem ECHTEN Brett (js/board.js) mit den Farben bzw. Figuren des Stuecks.
// iPhone 13 und PC, hell. Netz nur simuliert.
//
//   node tests/r19-shop-fortnite.test.mjs
//   PORT=8977 node tests/r19-shop-fortnite.test.mjs   eigener Port (Standard: frei)
import http from 'node:http';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
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

const UID = 'u1';
const SITZUNG = { access_token: 'a.' + Buffer.from(JSON.stringify({ sub: UID })).toString('base64url') + '.x', refresh_token: 'test-r',
  expires_at: 9999999999, user: { id: UID, email: 'spieler@example.invalid' } };
// Edition wie tests/funktion-shop-skin.test.mjs; der Preis kommt NUR hier vom Server (Testwert, kein Katalogpreis)
const EDITION = { produkt_id: 'brett-mitternacht', name: 'Mitternacht & Gold', auflage: 10, status: 'erhaeltlich', restzahl: 9,
  verkauf_ab: '2026-11-28T10:00:00Z', betrag_cent: 499, waehrung: 'eur' };
const VORRAT = JSON.parse(readFileSync(new URL('../assets/shop/vorrat.json', import.meta.url), 'utf8'));

function bediener(z) {
  return async (route) => {
    const url = new URL(route.request().url());
    const antwort = (d) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
    if (url.pathname.startsWith('/auth/v1/')) return antwort({ id: UID, email: 'spieler@example.invalid' });
    if (url.pathname === '/rest/v1/altersangaben') return antwort([{ ab18: true }]);
    if (url.pathname === '/rest/v1/profile') return antwort([{ user_id: UID, benutzername: 'Mira' }]);
    if (url.pathname === '/rest/v1/sonderstuecke') return antwort([]);
    const rpc = url.pathname.split('/').at(-1);
    z.aufrufe.push(url.pathname.startsWith('/rest/v1/rpc/') ? rpc : url.pathname);
    if (rpc === 'edition_staende') return antwort([EDITION]);
    if (rpc === 'karte_melde_stufen' || rpc === 'karte_waehle') return antwort({ taler: 0, stufen: {}, banner: ['start'], wahl: { banner: 'start' } });
    return antwort([]);
  };
}
function initSkript({ sitzung }) {
  try {
    if (!sessionStorage.getItem('shop-start')) {
      sessionStorage.setItem('shop-start', '1');
      localStorage.clear();
      localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ klang: false, bewegung: 'aus', figuren: 'cburnett' }));
      localStorage.setItem('schach-arena:konto:sichtbar', '1');
      localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(sitzung));
    }
  } catch (e) { /* egal */ }
}

const GERAETE = [['iPhone 13', 390, 844], ['PC', 1280, 720]];
const seitenfehler = [];
// Woerter, die nach Druck aussehen (Regeln der Werkstatt): Countdown, Restzeit, Restzahl, nur heute
const DRUCK = /\b\d{1,2}:\d{2}\b|nur heute|nur noch|läuft ab|endet in|verschwindet|\d+ von \d+ verfügbar|noch \d+ (std|stunden|tage|min)/i;

async function oeffneShop(s, kennung) {
  await s.goto(`http://127.0.0.1:${PORT}/index.html?test${kennung}#heim`);
  await s.waitForFunction(() => window.__app && typeof window.__app.gehe === 'function' && document.querySelector('.screen.heim-screen'), null, { timeout: 45000 });
  await s.evaluate(() => window.__app.gehe('ich'));
  await s.waitForSelector('.sa-screen', { timeout: 30000 });
  await warte(400);
  for (let i = 0; i < 12 && await s.locator('.st-moment .st-weiter').count(); i++) { await s.locator('.st-moment .st-weiter').first().click(); await warte(250); }
  await s.locator('.sa-platz[data-bereich="shop"], .sa-gross[data-bereich="shop"]').first().click();
  await s.waitForSelector('.sa-blatt .sa-bereich[data-bereich="shop"]:not([hidden])', { timeout: 10000 });
}

async function lauf(browser, [geraet, w, h], stil) {
  const gruppe = `${geraet} ${stil || 'heute'}`;
  const k = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: true, serviceWorkers: 'block',
    colorScheme: 'light', locale: 'de-DE', timezoneId: 'Europe/Berlin' });
  const z = { aufrufe: [] };
  await k.route('**/*.supabase.co/**', bediener(z));
  await k.addInitScript(initSkript, { sitzung: SITZUNG });
  const s = await k.newPage(); s.setDefaultTimeout(15000);
  s.on('pageerror', (e) => seitenfehler.push(`${gruppe}: ${e.message}`));
  const gesetzt = ['a', 'b', 'c'].includes(stil) ? stil : null;
  try {
    await oeffneShop(s, stil ? `&shopStil=${stil}` : '');
    if (!gesetzt) {
      await s.waitForSelector('.sa-blatt .sh-karte', { timeout: 15000 }).catch(() => {});
      const heute = await s.evaluate(() => ({ karten: document.querySelectorAll('.sa-blatt .sh-karte').length,
        kaufAus: !!document.querySelector('.sa-blatt .sh-kaufen')?.disabled, entwurf: !!document.querySelector('.shf') }));
      pruefe(`${gruppe}: Shop wie heute (eine Edition, Kaufknopf aus, kein Entwurf)`, heute.karten === 1 && heute.kaufAus && !heute.entwurf, heute);
      await k.close(); return;
    }
    await s.waitForSelector('.sa-blatt .shf .shf-karte', { timeout: 15000 }).catch(() => {});
    await warte(300);
    const bild = await s.evaluate(() => {
      const shf = document.querySelector('.sa-blatt .shf');
      const karten = [...document.querySelectorAll('.sa-blatt .shf-karte')];
      const sichtbarerText = shf ? shf.innerText : '';
      return {
        stil: shf?.dataset.shopStil ?? null,
        karten: karten.length,
        ids: [...new Set(karten.map((x) => x.dataset.id))],
        pakete: karten.filter((x) => x.dataset.art === 'paket').length,
        neu: [...document.querySelectorAll('.sa-blatt .shf-neu')].map((x) => x.closest('.shf-karte, .shf-reihe')?.querySelector('.shf-name')?.textContent || x.textContent),
        // Intl setzt ein geschuetztes Leerzeichen vor das Euro-Zeichen
        preise: karten.map((x) => x.querySelector('.shf-preis')?.textContent.replace(/\s+/g, ' ').trim() ?? null),
        euroAusserPreis: (sichtbarerText.match(/€/g) || []).length,
        text: sichtbarerText,
        gross: !!document.querySelector('.sa-blatt .shf-held .shf-karte'),
        reihen: [...document.querySelectorAll('.sa-blatt .shf-reihe')].map((r) => ({ titel: r.querySelector('.shf-reihe-titel')?.textContent.trim(),
          wisch: getComputedStyle(r.querySelector('.shf-band') || r).overflowX })),
        hoehen: [...new Set(karten.map((x) => Math.round(x.getBoundingClientRect().height)))],
        seltenheiten: karten.map((x) => x.dataset.seltenheit),
        farben: [...new Set(karten.map((x) => getComputedStyle(x).getPropertyValue('--shf-farbe').trim()))],
      };
    });
    pruefe(`${gruppe}: Kennung ${stil} gesetzt`, bild.stil === stil, bild.stil);
    // eine Edition + 24 Stuecke aus assets/shop/vorrat.json + 3 Pakete
    const soll = 1 + VORRAT.stuecke.length + 3;
    pruefe(`${gruppe}: alle Stuecke als Karten (${soll}, je Stueck einmal)`, bild.ids.length === soll, bild.ids.length);
    pruefe(`${gruppe}: drei Pakete (Brett + Figuren)`, bild.pakete === 3, bild.pakete);
    pruefe(`${gruppe}: "Neu diese Woche" hebt Mitternacht & Gold hervor`, bild.neu.some((x) => /Mitternacht/.test(x)), bild.neu);
    const mitPreis = bild.preise.filter((x) => x && x !== 'Preis folgt');
    pruefe(`${gruppe}: Preis nur vom Server (Edition 4,99 €), sonst "Preis folgt"`,
      mitPreis.length >= 1 && mitPreis.every((x) => x === '4,99 €') && bild.preise.every((x) => x === '4,99 €' || x === 'Preis folgt'), bild.preise);
    pruefe(`${gruppe}: kein Euro ausser dem Server-Preis`, bild.euroAusserPreis === mitPreis.length, { euro: bild.euroAusserPreis, mitPreis: mitPreis.length });
    pruefe(`${gruppe}: kein Countdown, keine Restzahl, kein "nur heute"`, !DRUCK.test(bild.text), (bild.text.match(DRUCK) || [])[0]);
    if (stil === 'a') {
      pruefe(`${gruppe}: Schaufenster mit grossem Highlight oben und Reihen`, bild.gross && bild.reihen.length >= 4, bild.reihen);
    } else if (stil === 'b') {
      pruefe(`${gruppe}: Raster mit gleich hohen Karten`, bild.hoehen.length === 1 && !bild.gross, bild.hoehen);
      pruefe(`${gruppe}: Karten nach Seltenheit gefaerbt (4 Farben)`, bild.farben.filter(Boolean).length >= 4, bild.farben);
      const rang = { exklusiv: 4, episch: 3, selten: 2, haeufig: 1 };
      const folge = bild.seltenheiten.slice(1).map((x) => rang[x] || 0);
      pruefe(`${gruppe}: nach dem Neuen sortiert nach Seltenheit (Exklusiv zuerst)`, folge.every((x, i) => i === 0 || folge[i - 1] >= x), bild.seltenheiten);
    } else {
      pruefe(`${gruppe}: Regal mit wischbaren Reihen, die erste "Neu diese Woche"`,
        bild.reihen.length >= 4 && bild.reihen.every((r) => r.wisch === 'auto' || r.wisch === 'scroll') && /Neu diese Woche/.test(bild.reihen[0].titel || ''), bild.reihen);
    }

    // Vorschau auf dem echten Brett: Figurensatz "Sternwarte"
    const vorher = z.aufrufe.length;
    await s.locator('.sa-blatt .shf-karte[data-id="sternwarte"]').first().scrollIntoViewIfNeeded();
    await s.locator('.sa-blatt .shf-karte[data-id="sternwarte"]').first().click();
    const vorschau = await s.waitForFunction(() => document.querySelectorAll('.sheet-karte .shf-vorschau .brett img.figur').length === 32, null, { timeout: 10000 })
      .then(() => true).catch(() => false);
    const satz = await s.evaluate(() => [...document.querySelectorAll('.sheet-karte .shf-vorschau .brett img.figur')].filter((i) => i.getAttribute('src').includes('assets/shop/figuren/sternwarte/')).length);
    pruefe(`${gruppe}: Antippen zeigt das echte Brett mit dem Figurensatz`, vorschau && satz === 32, { vorschau, satz });
    const kaufen = s.locator('.sheet-karte .sheet-knoepfe button', { hasText: 'Kaufen' });
    pruefe(`${gruppe}: Vorschau hat "Kaufen"`, await kaufen.count() === 1);
    await kaufen.first().click();
    const meldung = await s.waitForFunction(() => /Vorschau/.test(document.querySelector('.toast, .meldung, [role="status"]')?.textContent || ''), null, { timeout: 5000 })
      .then(() => true).catch(() => false);
    pruefe(`${gruppe}: Kaufen zeigt nur eine Vorschau-Meldung`, meldung);
    await warte(400);
    const neu = z.aufrufe.slice(vorher).filter((x) => x !== 'edition_staende');
    pruefe(`${gruppe}: Kaufen ruft nichts beim Server auf (keine Kasse)`, neu.length === 0, neu);

    // Brett-Vorschau: Farben des Stuecks im echten Brett
    await s.waitForSelector('.sa-blatt .shf-karte[data-id="aurora"]', { timeout: 8000 }).catch(() => {});
    if (await s.locator('.sa-blatt .shf-karte[data-id="aurora"]').count()) {
      await s.locator('.sa-blatt .shf-karte[data-id="aurora"]').first().scrollIntoViewIfNeeded();
      await s.locator('.sa-blatt .shf-karte[data-id="aurora"]').first().click();
      const farbe = await s.waitForFunction(() => { const f = document.querySelector('.sheet-karte .shf-vorschau .brett .feld.d');
        return f ? getComputedStyle(f).backgroundColor : null; }, null, { timeout: 10000 }).then((h) => h.jsonValue()).catch(() => null);
      pruefe(`${gruppe}: Brett-Vorschau in den Farben des Bretts (Aurora dunkel #1E3050)`, farbe === 'rgb(30, 48, 80)', farbe);
    } else pruefe(`${gruppe}: Shop nach der Vorschau wieder offen`, false);
  } catch (e) {
    pruefe(`${gruppe}: Ablauf ohne Abbruch`, false, e.message.split('\n')[0]);
  }
  await k.close().catch(() => {});
}

let browser;
try {
  browser = await browserTyp(pw).launch({ headless: true });
  for (const g of GERAETE) for (const stil of [null, 'a', 'b', 'c']) await lauf(browser, g, stil);
  await lauf(browser, GERAETE[0], 'x'); // unbekannte Kennung: wie heute
} finally {
  if (browser) await browser.close().catch(() => {});
  server.close();
}
pruefe('keine Seitenfehler', seitenfehler.length === 0, seitenfehler);
console.log(`\n${ok}/${gesamt} Pruefungen bestanden`);
process.exit(ok === gesamt ? 0 : 1);
