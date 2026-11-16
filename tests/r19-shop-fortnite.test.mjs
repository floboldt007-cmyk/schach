// Shop A "Schaufenster" (Feinschliff R19, Flos Wahl 15.11.2026): fuenf feste Plaetze hinter der Kennung ?shopStil=a
// (js/pakete/sammlung/shop-entwurf.js, Belegung aus assets/shop/auslage.json). Ohne Kennung (und mit jeder anderen) bleibt
// der Shop wie heute: eine Edition, Kaufknopf "Bald verfuegbar" abgeschaltet.
//   Je Art genau ein Platz, immer in dieser Reihenfolge: Brett, Figur, Klang, Emote, Finisher. Ein fehlender oder
//   unbekannter Eintrag laesst seinen Platz mit "Folgt" stehen, es bleiben fuenf.
// Feste Grenzen (design/runde4/SPIELKONZEPT.md, Regeln der Werkstatt): kein Countdown, keine Rotation, nichts verschwindet,
// keine Restzahl; ein Preis nur, wenn der Server ihn schickt (betrag_cent), sonst "Preis folgt"; "Kaufen" zeigt nur eine
// Vorschau-Meldung und ruft nichts beim Server auf (keine Kasse, kein Stripe).
// Vorschau je Art: Brett und Figur auf dem ECHTEN Brett (js/board.js), Klang mit Anhoeren-Knopf, Emote gross (bewegt nur
// ohne "weniger Bewegung"), Finisher als Standbild.
// iPhone 13, iPhone SE, iPad und PC, hell und dunkel. Netz nur simuliert.
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
const AUSLAGE = JSON.parse(readFileSync(new URL('../assets/shop/auslage.json', import.meta.url), 'utf8'));
const ARTEN = ['brett', 'figur', 'klang', 'emote', 'finisher'];
// Probe "die Datenliste ist die Quelle": andere Figur, ein unbekanntes Emote, kein Klang-Eintrag, Reihenfolge verdreht
const UMGEBAUT = { plaetze: [{ art: 'emote', id: 'gibt-es-nicht' }, { art: 'finisher', id: 'krone' }, { art: 'figur', id: 'lampion' },
  { art: 'brett', id: 'aurora' }] };

function bediener(z, { fehler = false } = {}) {
  return async (route) => {
    const url = new URL(route.request().url());
    const antwort = (d) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
    if (url.pathname.startsWith('/auth/v1/')) return antwort({ id: UID, email: 'spieler@example.invalid' });
    if (url.pathname === '/rest/v1/altersangaben') return antwort([{ ab18: true }]);
    if (url.pathname === '/rest/v1/profile') return antwort([{ user_id: UID, benutzername: 'Mira' }]);
    if (url.pathname === '/rest/v1/sonderstuecke') return antwort([]);
    const rpc = url.pathname.split('/').at(-1);
    z.aufrufe.push(url.pathname.startsWith('/rest/v1/rpc/') ? rpc : url.pathname);
    if (rpc === 'edition_staende') return fehler ? route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }) : antwort([EDITION]);
    if (rpc === 'karte_melde_stufen' || rpc === 'karte_waehle') return antwort({ taler: 0, stufen: {}, banner: ['start'], wahl: { banner: 'start' } });
    return antwort([]);
  };
}
function initSkript({ sitzung }) {
  try {
    if (!sessionStorage.getItem('shop-start')) {
      sessionStorage.setItem('shop-start', '1');
      localStorage.clear();
      localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ klang: false, bewegung: 'normal', figuren: 'cburnett' }));
      localStorage.setItem('schach-arena:konto:sichtbar', '1');
      if (sitzung) localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(sitzung));
    }
  } catch (e) { /* egal */ }
  // resize-Hoerer am Fenster mitzaehlen (ohne CDP, damit es auch in WebKit laeuft): ein Vorschau-Brett, das nie
  // zerstoert wird, laesst seinen Hoerer stehen (js/board.js)
  try {
    window.__resize = 0;
    const an = window.addEventListener.bind(window), ab = window.removeEventListener.bind(window);
    window.addEventListener = (typ, ...r) => { if (typ === 'resize') window.__resize++; return an(typ, ...r); };
    window.removeEventListener = (typ, ...r) => { if (typ === 'resize') window.__resize--; return ab(typ, ...r); };
  } catch (e) { /* egal */ }
}

const IPHONE = ['iPhone 13', 390, 844], SE = ['iPhone SE', 375, 667], IPAD = ['iPad', 820, 1180], PC = ['PC', 1280, 720];
const seitenfehler = [];
// Woerter, die nach Druck aussehen (Regeln der Werkstatt): Countdown, Restzeit, Restzahl, nur heute, Wochen-Wechsel
const DRUCK = /\b\d{1,2}:\d{2}\b|nur heute|nur noch|läuft ab|endet in|verschwindet|diese woche|\d+ von \d+ verfügbar|noch \d+ (std|stunden|tage|min)/i;

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

// Vorschau einer Karte oeffnen; gibt zurueck, was im Blatt steht
async function oeffneVorschau(s, art) {
  const k = s.locator(`.sa-blatt .shf-karte[data-art="${art}"]`).first();
  await k.scrollIntoViewIfNeeded();
  await k.click();
  await s.waitForSelector('.sheet-karte .shf-vorschau', { timeout: 10000 });
  await warte(500);
}
async function schliesse(s) {
  const zu = s.locator('.sheet-karte .sheet-knoepfe button', { hasText: 'Schließen' });
  if (await zu.count()) await zu.first().click();
  await s.waitForSelector('.sheet-karte', { state: 'detached', timeout: 5000 }).catch(() => {});
  await warte(300);
}

async function lauf(browser, [geraet, w, h], stil, { farbe = 'hell', auslage = null, ruhig = false, gast = false, fehler = false } = {}) {
  const gruppe = `${geraet} ${stil || 'heute'}${farbe === 'dunkel' ? ' dunkel' : ''}${auslage ? ' umgebaut' : ''}${ruhig ? ' ruhig' : ''}`
    + `${gast ? ' gast' : ''}${fehler ? ' serverfehler' : ''}`;
  const k = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: true, serviceWorkers: 'block',
    colorScheme: farbe === 'dunkel' ? 'dark' : 'light', reducedMotion: ruhig ? 'reduce' : 'no-preference', locale: 'de-DE', timezoneId: 'Europe/Berlin' });
  const z = { aufrufe: [] };
  await k.route('**/*.supabase.co/**', bediener(z, { fehler }));
  if (auslage) await k.route('**/assets/shop/auslage.json', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(auslage) }));
  await k.addInitScript(initSkript, { sitzung: gast ? null : SITZUNG });
  const s = await k.newPage(); s.setDefaultTimeout(15000);
  s.on('pageerror', (e) => seitenfehler.push(`${gruppe}: ${e.message}`));
  try {
    await oeffneShop(s, stil ? `&shopStil=${stil}` : '');
    if (stil !== 'a' && (gast || fehler)) {
      // der Standard-Shop bleibt, wie er ist: Gast-Satz mit Gast-Karte bzw. "in Vorbereitung"
      await s.waitForFunction(() => /Konto|Vorbereitung/.test(document.querySelector('.sa-blatt .sh-satz')?.textContent || ''), null, { timeout: 15000 }).catch(() => {});
      const heute = await s.evaluate(() => ({ satz: document.querySelector('.sa-blatt .sh-satz')?.textContent || '',
        gast: !!document.querySelector('.sa-blatt .sh-gast'), entwurf: !!document.querySelector('.shf') }));
      pruefe(`${gruppe}: Shop wie heute (${gast ? 'Gast-Satz mit Gast-Karte' : '"in Vorbereitung"'}, kein Schaufenster)`,
        !heute.entwurf && (gast ? /mit Konto/.test(heute.satz) && heute.gast : /in Vorbereitung/.test(heute.satz)), heute);
      await k.close(); return;
    }
    if (stil !== 'a') {
      await s.waitForSelector('.sa-blatt .sh-karte', { timeout: 15000 }).catch(() => {});
      const heute = await s.evaluate(() => ({ karten: document.querySelectorAll('.sa-blatt .sh-karte').length,
        kaufAus: !!document.querySelector('.sa-blatt .sh-kaufen')?.disabled, entwurf: !!document.querySelector('.shf') }));
      pruefe(`${gruppe}: Shop wie heute (eine Edition, Kaufknopf aus, kein Schaufenster)`, heute.karten === 1 && heute.kaufAus && !heute.entwurf, heute);
      await k.close(); return;
    }
    await s.waitForSelector('.sa-blatt .shf .shf-karte', { timeout: 15000 }).catch(() => {});
    await warte(400);
    const bild = await s.evaluate(() => {
      const shf = document.querySelector('.sa-blatt .shf');
      const karten = [...document.querySelectorAll('.sa-blatt .shf-karte')];
      const breite = document.documentElement.clientWidth;
      return {
        stil: shf?.dataset.shopStil ?? null,
        arten: karten.map((x) => x.dataset.art),
        ids: karten.map((x) => x.dataset.id || null),
        folgt: karten.map((x) => x.hasAttribute('data-folgt')),
        mitBild: karten.map((x) => !!x.querySelector('.shf-bild svg, .shf-bild img')),
        // Intl setzt ein geschuetztes Leerzeichen vor das Euro-Zeichen
        preise: karten.map((x) => x.querySelector('.shf-preis')?.textContent.replace(/\s+/g, ' ').trim() ?? null),
        euro: ((shf ? shf.innerText : '').match(/€/g) || []).length,
        text: shf ? shf.innerText : '',
        reihen: document.querySelectorAll('.sa-blatt .shf-reihe, .sa-blatt .shf-held, .sa-blatt .shf-band').length,
        ueberlauf: document.scrollingElement.scrollWidth > breite + 1
          || karten.some((x) => { const r = x.getBoundingClientRect(); return r.left < -1 || r.right > breite + 1; }),
        klein: karten.filter((x) => { const r = x.getBoundingClientRect(); return r.width < 44 || r.height < 44; }).length,
        hoehen: [...new Set(karten.map((x) => Math.round(x.getBoundingClientRect().height)))],
        gleichBreit: new Set(karten.map((x) => Math.round(x.getBoundingClientRect().width))).size === 1,
      };
    });
    pruefe(`${gruppe}: Kennung a gesetzt`, bild.stil === 'a', bild.stil);
    pruefe(`${gruppe}: genau fuenf Plaetze, je Art einer, in fester Reihenfolge`, JSON.stringify(bild.arten) === JSON.stringify(ARTEN), bild.arten);
    pruefe(`${gruppe}: keine Reihen, kein Highlight (nur die fuenf Plaetze)`, bild.reihen === 0, bild.reihen);
    pruefe(`${gruppe}: jeder Platz hat ein Bild`, bild.mitBild.every(Boolean), bild.mitBild);
    pruefe(`${gruppe}: gleich grosse Karten`, bild.gleichBreit && bild.hoehen.length <= 2, { hoehen: bild.hoehen, gleichBreit: bild.gleichBreit });
    pruefe(`${gruppe}: kein Countdown, keine Restzahl, kein "nur heute", kein "diese Woche"`, !DRUCK.test(bild.text), (bild.text.match(DRUCK) || [])[0]);
    pruefe(`${gruppe}: kein Ueberlauf zur Seite`, !bild.ueberlauf);
    pruefe(`${gruppe}: Karten mindestens 44 px`, bild.klein === 0, bild.klein);
    const mitPreis = bild.preise.filter((x) => x && x !== 'Preis folgt' && x !== 'Folgt');
    pruefe(`${gruppe}: Preis nur vom Server, sonst "Preis folgt"`, mitPreis.every((x) => x === '4,99 €') && bild.euro === mitPreis.length, { preise: bild.preise, euro: bild.euro });

    if (gast || fehler) {
      pruefe(`${gruppe}: fuenf Plaetze, alle mit Stueck und "Preis folgt" (ohne Server kein Preis)`,
        bild.folgt.every((x) => !x) && bild.preise.every((x) => x === 'Preis folgt'), bild.preise);
      await k.close(); return;
    }
    if (auslage) {
      pruefe(`${gruppe}: Belegung kommt aus auslage.json (Brett Aurora, Figur Lampion, Finisher Krone)`,
        bild.ids[0] === 'aurora' && bild.ids[1] === 'lampion' && bild.ids[4] === 'krone', bild.ids);
      pruefe(`${gruppe}: fehlender Klang und unbekanntes Emote stehen als "Folgt"`, bild.folgt[2] && bild.folgt[3] && !bild.folgt[0] && !bild.folgt[1] && !bild.folgt[4], bild.folgt);
      pruefe(`${gruppe}: ein "Folgt"-Platz hat keinen Preis und keinen Kaufen-Weg`, bild.preise[2] === 'Folgt' && bild.preise[3] === 'Folgt', bild.preise);
      await k.close(); return;
    }
    const soll = ARTEN.map((art) => AUSLAGE.plaetze.find((p) => p.art === art)?.id ?? null);
    pruefe(`${gruppe}: Belegung wie assets/shop/auslage.json`, JSON.stringify(bild.ids) === JSON.stringify(soll) && bild.folgt.every((x) => !x), { ids: bild.ids, soll });
    pruefe(`${gruppe}: Brett-Platz traegt den Server-Preis der Edition (4,99 €)`, bild.preise[0] === '4,99 €', bild.preise[0]);

    // Brett: Farben des Bretts im echten Brett (Mitternacht & Gold dunkel #3b4a7a)
    await oeffneVorschau(s, 'brett');
    const farbe = await s.evaluate(() => { const f = document.querySelector('.sheet-karte .shf-vorschau .brett .feld.d'); return f ? getComputedStyle(f).backgroundColor : null; });
    pruefe(`${gruppe}: Brett-Vorschau auf dem echten Brett in den Farben des Bretts`, farbe === 'rgb(59, 74, 122)', farbe);
    pruefe(`${gruppe}: Kaufen zeigt den Server-Preis`, await s.locator('.sheet-karte .sheet-knoepfe button', { hasText: 'Kaufen · 4,99' }).count() === 1);
    const hoererOffen = await s.evaluate(() => window.__resize);
    await schliesse(s);
    // dreimal oeffnen und schliessen: das Vorschau-Brett raeumt seine Hoerer wieder ab
    const hoererZu = await s.evaluate(() => window.__resize);
    for (let i = 0; i < 2; i++) { await oeffneVorschau(s, 'brett'); await schliesse(s); }
    const hoererDanach = await s.evaluate(() => window.__resize);
    pruefe(`${gruppe}: Vorschau-Brett raeumt auf (resize-Hoerer offen ${hoererOffen}, zu ${hoererZu}, nach drei Mal ${hoererDanach})`,
      hoererZu === hoererOffen - 1 && hoererDanach === hoererZu, { hoererOffen, hoererZu, hoererDanach });

    // Figur: der Satz auf dem echten Brett, Kaufen nur als Vorschau-Meldung ohne Serveraufruf
    await oeffneVorschau(s, 'figur');
    const figurId = soll[1];
    const satz = await s.evaluate((id) => [...document.querySelectorAll('.sheet-karte .shf-vorschau .brett img.figur')]
      .filter((i) => i.getAttribute('src').includes(`assets/shop/figuren/${id}/`)).length, figurId);
    pruefe(`${gruppe}: Figur-Vorschau zeigt den Satz auf dem echten Brett`, satz === 32, satz);
    const vorher = z.aufrufe.length;
    const kaufen = s.locator('.sheet-karte .sheet-knoepfe button', { hasText: 'Kaufen' });
    pruefe(`${gruppe}: Vorschau hat "Kaufen"`, await kaufen.count() === 1);
    await kaufen.first().click();
    const meldung = await s.waitForFunction(() => /Vorschau/.test(document.querySelector('.toast, .meldung, [role="status"]')?.textContent || ''), null, { timeout: 5000 })
      .then(() => true).catch(() => false);
    pruefe(`${gruppe}: Kaufen zeigt nur eine Vorschau-Meldung`, meldung);
    await warte(400);
    const neu = z.aufrufe.slice(vorher).filter((x) => x !== 'edition_staende');
    pruefe(`${gruppe}: Kaufen ruft nichts beim Server auf (keine Kasse)`, neu.length === 0, neu);
    await s.waitForSelector('.sheet-karte', { state: 'detached', timeout: 5000 }).catch(() => {});
    await warte(300);

    // Klang: Anhoeren-Knopf (mindestens 44 px), Antippen ohne Fehler
    await oeffneVorschau(s, 'klang');
    const knopf = await s.evaluate(() => { const b = document.querySelector('.sheet-karte .shf-vorschau .shf-anhoeren'); const r = b?.getBoundingClientRect();
      return b ? { h: Math.round(r.height), text: b.textContent.trim(), bild: !!document.querySelector('.sheet-karte .shf-vorschau svg') } : null; });
    pruefe(`${gruppe}: Klang-Vorschau hat Bild und einen Anhoeren-Knopf ab 44 px`, !!knopf && knopf.h >= 44 && /Anhören/.test(knopf.text) && knopf.bild, knopf);
    // Karte und Vorschau zeigen dieselbe Kunst: doppelte Verlaufs-Ids liessen die Schneeflocke "Kristall" verschwinden
    const doppelt = await s.evaluate(() => [...document.querySelectorAll('.sa-blatt .shf svg [id], .sheet-karte svg [id]')]
      .filter((e) => document.querySelectorAll(`[id="${CSS.escape(e.id)}"]`).length > 1)
      .map((e) => e.id + ' auch in ' + [...document.querySelectorAll(`[id="${CSS.escape(e.id)}"]`)].filter((x) => x !== e).map((x) => x.closest('[class]')?.closest('section, .sheet-karte, .sa-bereich, .shf-karte')?.className).join('|')));
    pruefe(`${gruppe}: keine doppelten Ids in den Bildern`, doppelt.length === 0, doppelt.slice(0, 5));
    const fehlerVorher = seitenfehler.length;
    if (knopf) await s.locator('.sheet-karte .shf-anhoeren').click();
    await warte(400);
    pruefe(`${gruppe}: Anhoeren laeuft ohne Fehler`, seitenfehler.length === fehlerVorher, seitenfehler.slice(fehlerVorher));
    await schliesse(s);

    // Emote: gross, bewegt nur ohne "weniger Bewegung"
    await oeffneVorschau(s, 'emote');
    const emote = await s.evaluate(() => { const e = document.querySelector('.sheet-karte .shf-vorschau svg.emote-sticker');
      return e ? { breite: Math.round(e.getBoundingClientRect().width), laeuft: e.getAnimations({ subtree: true }).filter((a) => a.playState === 'running').length } : null; });
    pruefe(`${gruppe}: Emote-Vorschau gross (ab 120 px)`, !!emote && emote.breite >= 120, emote);
    pruefe(`${gruppe}: Emote ${ruhig ? 'steht still (weniger Bewegung)' : 'bewegt sich'}`, !!emote && (ruhig ? emote.laeuft === 0 : emote.laeuft > 0), emote);
    await schliesse(s);

    // Finisher: als Standbild
    await oeffneVorschau(s, 'finisher');
    const fin = await s.evaluate(() => { const e = document.querySelector('.sheet-karte .shf-vorschau svg.sk-finisher');
      return e ? { breite: Math.round(e.getBoundingClientRect().width), laeuft: e.getAnimations({ subtree: true }).filter((a) => a.playState === 'running').length } : null; });
    pruefe(`${gruppe}: Finisher-Vorschau als grosses Standbild`, !!fin && fin.breite >= 120 && fin.laeuft === 0, fin);
    await schliesse(s);
  } catch (e) {
    pruefe(`${gruppe}: Ablauf ohne Abbruch`, false, e.message.split('\n')[0]);
  }
  await k.close().catch(() => {});
}

let browser;
try {
  browser = await browserTyp(pw).launch({ headless: true });
  for (const g of [IPHONE, PC]) await lauf(browser, g, null);
  for (const g of [IPHONE, SE, IPAD, PC]) await lauf(browser, g, 'a');
  for (const g of [IPHONE, PC]) await lauf(browser, g, 'a', { farbe: 'dunkel' });
  await lauf(browser, IPHONE, 'a', { ruhig: true });
  await lauf(browser, IPHONE, 'a', { auslage: UMGEBAUT });
  await lauf(browser, IPHONE, 'b'); // die Entwuerfe b und c gibt es nicht mehr: wie heute
  // abgemeldet und bei einem Serverfehler: Shop A zeigt trotzdem die fuenf Plaetze, der Standard-Shop bleibt wie heute
  for (const art of [{ gast: true }, { fehler: true }]) { await lauf(browser, IPHONE, 'a', art); await lauf(browser, IPHONE, null, art); }
} finally {
  if (browser) await browser.close().catch(() => {});
  server.close();
}
pruefe('keine Seitenfehler', seitenfehler.length === 0, seitenfehler);
console.log(`\n${ok}/${gesamt} Pruefungen bestanden`);
process.exit(ok === gesamt ? 0 : 1);
