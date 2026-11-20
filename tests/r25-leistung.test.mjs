// fc-11:15 Leistung F2 und F3 (Bericht: Vault R20-Kritik/leistung/bericht.md): beim Oeffnen eines Blatts, beim Wechsel auf
// Lernen und beim Formatieren von Zahlen erzwingt die App kein Layout mitten im Aufbau. Gemessen wird ohne Uhr, mit
// Zaehlern: jeder Layout-Lesezugriff (offsetWidth und Verwandte, getBoundingClientRect, getClientRects) und jedes focus()
// wird seinem Aufrufer in js/ zugeordnet und zaehlt nur, wenn er NICHT in einem requestAnimationFrame-Rueckruf laeuft.
// Dort ist das Layout fuer das naechste Bild ohnehin faellig, mitten im Aufbau dagegen rechnet der Browser es doppelt.
//   A) Lernen: passeChips (js/ui/seite.js) und setzePille (js/app.js) messen erst im naechsten Bild; die Pille steht danach
//      trotzdem unter dem aktiven Reiter.
//   B) sheet() (js/ui/bauteile.js): fokussiert ein Bild spaeter genau einmal den richtigen Knopf, gibt den Fokus beim
//      Schliessen zurueck, und ein Blatt, das ein offenes Blatt ersetzt, gibt ihn an den urspruenglichen Ausloeser zurueck.
//   C) Ich: das Shop-Blatt oeffnet ohne Layout-Erzwingung aus bauteile.js, der Fokus steht danach auf "Fertig".
//   D) zahl() (js/sprache.js) baut Intl.NumberFormat je Sprache und Optionen nur einmal, die Ausgabe bleibt gleich.
//
//   node tests/r25-leistung.test.mjs
//   PORT=9797 node tests/r25-leistung.test.mjs    Port des Testservers (sonst: frei)
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
  // INTENTIONAL-SLOP[T4]: die Pruefzeile ist die Ausgabe des Tests (wie in tests/r22-tastatur.test.mjs)
  console.log(`${gut ? 'ok  ' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(detail)}`);
}

const UID = 'u1';
const SITZUNG = { access_token: 'a.' + Buffer.from(JSON.stringify({ sub: UID })).toString('base64url') + '.x', refresh_token: 'test-r',
  expires_at: 9999999999, user: { id: UID, email: 'spieler@example.invalid' } };

// Zaehler im Browser: Aufrufer = erster Rahmen des Stapels in /js/ (Datei und Funktion); "imBild" = innerhalb eines
// requestAnimationFrame-Rueckrufs
function zaehler({ sitzung }) {
  try {
    if (!sessionStorage.getItem('r25-start')) {
      sessionStorage.setItem('r25-start', '1');
      localStorage.clear();
      localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ klang: false, bewegung: 'normal', figuren: 'cburnett' }));
      localStorage.setItem('schach-arena:konto:sichtbar', '1');
      localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(sitzung));
    }
  } catch (e) { /* egal */ }
  let imBild = 0;
  const roh = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => roh((t) => { imBild++; try { cb(t); } finally { imBild--; } });
  const z = { an: false, liste: [] };
  window.__r25 = z;
  const aufrufer = () => {
    const zeilen = String(new Error().stack || '').split('\n');
    for (const l of zeilen) {
      // Chromium: "at name (url:zeile:spalte)", WebKit: "name@url:zeile:spalte"
      const m = l.match(/at (?:(\S+) )?\(?\S*?\/(js\/[^:)]+):(\d+)/) || l.match(/^(\S*?)@\S*?\/(js\/[^:)]+):(\d+)/);
      if (m) return `${m[2]}#${(m[1] || 'anonym').replace(/^Object\.|^HTMLElement\./, '')}`;
    }
    return null;
  };
  const merke = (art) => {
    if (!z.an) return;
    const wer = aufrufer();
    if (wer) z.liste.push({ art, wer, imBild: imBild > 0 });
  };
  for (const [proto, namen] of [[HTMLElement.prototype, ['offsetWidth', 'offsetHeight', 'offsetLeft', 'offsetTop']],
    [Element.prototype, ['clientWidth', 'clientHeight']]]) {
    for (const n of namen) {
      const d = Object.getOwnPropertyDescriptor(proto, n);
      Object.defineProperty(proto, n, { ...d, get() { merke('layout'); return d.get.call(this); } });
    }
  }
  for (const n of ['getBoundingClientRect', 'getClientRects']) {
    const f = Element.prototype[n];
    Element.prototype[n] = function (...a) { merke('layout'); return f.apply(this, a); };
  }
  const fokus = HTMLElement.prototype.focus;
  HTMLElement.prototype.focus = function (...a) { merke('focus'); return fokus.apply(this, a); };
  // Intl.NumberFormat zaehlen (D)
  const NF = Intl.NumberFormat;
  window.__nf = 0;
  Intl.NumberFormat = new Proxy(NF, { construct(t, a) { window.__nf++; return Reflect.construct(t, a); }, apply(t, s, a) { window.__nf++; return Reflect.apply(t, s, a); } });
}

const browser = await browserTyp(pw).launch();
const k = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true, serviceWorkers: 'block',
  colorScheme: 'light', locale: 'de-DE', timezoneId: 'Europe/Berlin' });
await k.route('**/*.supabase.co/**', (route) => {
  const url = new URL(route.request().url());
  const a = (d) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
  if (url.pathname.startsWith('/auth/v1/')) return a({ id: UID, email: 'spieler@example.invalid' });
  if (url.pathname === '/rest/v1/altersangaben') return a([{ ab18: true }]);
  if (url.pathname === '/rest/v1/profile') return a([{ user_id: UID, benutzername: 'Mira' }]);
  const rpc = url.pathname.split('/').at(-1);
  if (rpc === 'karte_melde_stufen' || rpc === 'karte_waehle') return a({ taler: 0, stufen: {}, banner: ['start'], wahl: { banner: 'start' } });
  return a([]);
});
await k.addInitScript(zaehler, { sitzung: SITZUNG });
const s = await k.newPage();
s.setDefaultTimeout(30000);
const seitenfehler = [];
s.on('pageerror', (e) => seitenfehler.push(e.message));
await s.goto(`http://127.0.0.1:${PORT}/index.html?test#heim`);
await s.waitForFunction(() => window.__app && typeof window.__app.gehe === 'function' && document.querySelector('.screen.heim-screen'), null, { timeout: 45000 });
await warte(800);

const start = () => s.evaluate(() => { window.__r25.liste = []; window.__r25.an = true; });
// ein paar Bilder abwarten, dann stoppen und auswerten
const ende = async () => {
  await s.evaluate(() => new Promise((r) => { let n = 0; const f = () => (++n < 4 ? requestAnimationFrame(f) : r()); requestAnimationFrame(f); }));
  await warte(200);
  return s.evaluate(() => { window.__r25.an = false; return window.__r25.liste; });
};
const imAufbau = (liste, re, art = null) => liste.filter((e) => !e.imBild && re.test(e.wer) && (!art || e.art === art));
const zeige = (liste) => [...new Set(liste.map((e) => `${e.art} ${e.wer}`))].slice(0, 6);

// A) Lernen
await start();
await s.evaluate(() => window.__app.gehe('lernen'));
await s.waitForSelector('.screen.ms-screen');
const a = await ende();
const chipsA = imAufbau(a, /js\/ui\/seite\.js#passeChips/);
const pilleA = imAufbau(a, /js\/app\.js#setzePille/);
pruefe('Lernen: passeChips misst nicht mitten im Aufbau (erst im naechsten Bild)', chipsA.length === 0, { n: chipsA.length });
pruefe('Lernen: setzePille misst nicht mitten im Aufbau (erst im naechsten Bild)', pilleA.length === 0, { n: pilleA.length });
pruefe('Lernen: passeChips und setzePille laufen aber (im Bild)', a.some((e) => /passeChips/.test(e.wer)) && a.some((e) => /setzePille/.test(e.wer)), zeige(a));
const pille = await s.evaluate(() => {
  const nav = document.querySelector('.reiter-pille')?.parentElement;
  const p = nav && nav.querySelector('.reiter-pille');
  const k = nav && nav.querySelector('[aria-current="page"]');
  if (!p || !k) return null;
  const rp = p.getBoundingClientRect(), rk = k.getBoundingClientRect();
  return { pl: Math.round(rp.left), kl: Math.round(rk.left), pb: Math.round(rp.width), kb: Math.round(rk.width), sichtbar: getComputedStyle(p).opacity !== '0' };
});
// die Pille gleitet 520 ms: nach dem Gleiten muss sie unter dem aktiven Reiter stehen
await warte(700);
const pille2 = await s.evaluate(() => {
  const p = document.querySelector('.reiter-pille'); const k = p && p.parentElement.querySelector('[aria-current="page"]');
  if (!p || !k) return null;
  const rp = p.getBoundingClientRect(), rk = k.getBoundingClientRect();
  return { pl: Math.round(rp.left), kl: Math.round(rk.left), pb: Math.round(rp.width), kb: Math.round(rk.width) };
});
pruefe('Lernen: die Pille steht unter dem aktiven Reiter', !!pille && !!pille2 && Math.abs(pille2.pl - pille2.kl) <= 1 && Math.abs(pille2.pb - pille2.kb) <= 1, { pille, pille2 });

// B) sheet() direkt
await s.evaluate(() => window.__app.gehe('heim'));
await s.waitForSelector('.screen.heim-screen');
await warte(500);
const b = await s.evaluate(async () => {
  const { sheet } = await import('./js/ui/bauteile.js');
  const x = document.createElement('button');
  x.textContent = 'Ausloeser'; x.id = 'r25-ausloeser';
  document.body.append(x);
  x.focus();
  const bild = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  window.__r25.liste = []; window.__r25.an = true;
  const p1 = sheet({ titel: 'Eins', knoepfe: [{ text: 'Nein', wert: false }, { text: 'Ja', wert: true, art: 'primaer' }] });
  const sofort = document.activeElement && document.activeElement.id;
  await bild();
  const nachBild = document.activeElement && document.activeElement.textContent;
  const fokusse = window.__r25.liste.filter((e) => e.art === 'focus' && /bauteile\.js/.test(e.wer));
  const layout = window.__r25.liste.filter((e) => !e.imBild && /bauteile\.js/.test(e.wer));
  // Escape: Fokus zurueck auf den Ausloeser
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await p1;
  await bild();
  const zurueck = document.activeElement && document.activeElement.id;
  // Kette: Blatt A offen, Blatt B ersetzt es; nach B steht der Fokus wieder auf dem Ausloeser
  x.focus();
  const pa = sheet({ titel: 'A', knoepfe: [{ text: 'A-ok', wert: true }] });
  await bild();
  const pb = sheet({ titel: 'B', knoepfe: [{ text: 'B-ok', wert: true }] });
  await pa;
  await bild();
  const inB = document.activeElement && document.activeElement.textContent;
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await pb;
  await bild();
  const nachKette = document.activeElement && document.activeElement.id;
  window.__r25.an = false;
  x.remove();
  return { sofort, nachBild, fokusse: fokusse.length, imAufbau: fokusse.filter((e) => !e.imBild).length, layout: layout.length, zurueck, inB, nachKette };
});
pruefe('sheet(): fokussiert nicht mitten im Aufbau (direkt nach dem Aufruf steht der Fokus noch auf dem Ausloeser)', b.sofort === 'r25-ausloeser' && b.imAufbau === 0, b);
pruefe('sheet(): ein Bild spaeter steht der Fokus auf dem Hauptknopf, genau ein focus()', b.nachBild === 'Ja' && b.fokusse === 1, b);
pruefe('sheet(): keine Layout-Erzwingung aus bauteile.js im Aufbau', b.layout === 0, b);
pruefe('sheet(): Escape gibt den Fokus an den Ausloeser zurueck', b.zurueck === 'r25-ausloeser', b);
pruefe('sheet(): ein ersetzendes Blatt hat den Fokus, danach steht er wieder auf dem urspruenglichen Ausloeser', b.inB === 'B-ok' && b.nachKette === 'r25-ausloeser', b);

// C) Ich: Shop-Blatt
await s.evaluate(() => window.__app.gehe('ich'));
await s.waitForSelector('.sa-screen', { timeout: 30000 });
await warte(500);
for (let i = 0; i < 12 && await s.locator('.st-moment .st-weiter').count(); i++) { await s.locator('.st-moment .st-weiter').first().click(); await warte(250); }
await start();
await s.locator('.sa-platz[data-bereich="shop"], .sa-gross[data-bereich="shop"]').first().click();
await s.waitForSelector('.sa-blatt .shf .shf-karte', { timeout: 15000 });
const c = await ende();
const cAufbau = imAufbau(c, /js\/ui\/bauteile\.js/);
pruefe('Ich: Shop-Blatt oeffnet ohne Layout-Erzwingung oder focus() aus bauteile.js im Aufbau', cAufbau.length === 0, zeige(cAufbau));
pruefe('Ich: Shop-Blatt fokussiert genau einmal', c.filter((e) => e.art === 'focus' && /bauteile\.js/.test(e.wer)).length === 1, zeige(c.filter((e) => e.art === 'focus')));
pruefe('Ich: der Fokus steht im Shop-Blatt auf "Fertig"', await s.evaluate(() => !!document.activeElement?.closest('.sheet-karte.sa-blatt .sheet-knoepfe')), await s.evaluate(() => document.activeElement?.outerHTML.slice(0, 120)));

// D) zahl()
const d = await s.evaluate(async () => {
  const { zahl, setzeSprache } = await import('./js/sprache.js');
  const roh = (l, n, o) => new Intl.NumberFormat(l, o).format(n);
  const vor = window.__nf;
  const aus = [];
  for (let i = 0; i < 30; i++) aus.push(zahl(1234.5 + i));
  for (let i = 0; i < 30; i++) aus.push(zahl(0.4567, { style: 'percent', maximumFractionDigits: 1 }));
  const bau = window.__nf - vor;
  const gleich = zahl(1234.5) === roh('de-DE', 1234.5) && zahl(0.4567, { style: 'percent', maximumFractionDigits: 1 }) === roh('de-DE', 0.4567, { style: 'percent', maximumFractionDigits: 1 });
  setzeSprache('en');
  const en = zahl(1234.5);
  setzeSprache('de');
  const de = zahl(1234.5);
  const ref = window.__nf;
  const pruef = [roh('de-DE', 1234.5), roh('en-US', 1234.5)];
  return { bau, gleich, en, de, pruef, ref };
});
pruefe('zahl(): Intl.NumberFormat je Sprache und Optionen nur einmal gebaut (60 Aufrufe, 2 Formate)', d.bau <= 2, d);
pruefe('zahl(): Ausgabe unveraendert, Sprachwechsel wirkt', d.gleich && d.en === d.pruef[1] && d.de === d.pruef[0], d);

// E) Pille beim Drehen (Kaltreview f2): der ResizeObserver-Weg laeuft schon im Bild und setzt die Pille sofort. Gelesen wird
// je Bild NACH dem Rendern (MessageChannel aus dem rAF), also das, was gemalt wurde; kein Bild nach dem Drehen darf die
// Pille neben dem aktiven Reiter zeigen (die Lage wechselt seite -> unten, die Pille springt dabei ohne Gleiten)
const kE = await browser.newContext({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 1, serviceWorkers: 'block', locale: 'de-DE' });
await kE.route('**/*.supabase.co/**', (route) => route.abort());
const sE = await kE.newPage();
// WebKit meldet beim Drehen "ResizeObserver loop completed with undelivered notifications." als Seitenfehler, auch auf
// der Basis 827b3ce4 (vor dieser Arbeit, an fc gemeldet); nur diese eine Meldung und nur in diesem Fall zaehlt nicht
sE.on('pageerror', (e) => { if (!/^ResizeObserver loop completed with undelivered notifications\.$/.test(e.message)) seitenfehler.push(e.message); });
await sE.goto(`http://127.0.0.1:${PORT}/index.html?test#bots`);
await sE.waitForSelector('.reiter-pille');
await warte(1200);
await sE.evaluate(() => {
  const log = (window.__pilleBilder = []);
  const p = document.querySelector('.reiter-pille');
  const lies = () => {
    const k = document.querySelector('nav [aria-current="page"]');
    const a = p.getBoundingClientRect(), c = k.getBoundingClientRect(), lage = document.documentElement.dataset.reiter;
    const unter = lage === 'seite' ? Math.abs(a.top - c.top) <= 2 : Math.abs(a.left - c.left) <= 2;
    log.push({ breite: innerWidth, lage, unter });
    if (log.length < 30) requestAnimationFrame(nach);
  };
  const mc = new MessageChannel();
  mc.port1.onmessage = lies;
  const nach = () => mc.port2.postMessage(0);
  requestAnimationFrame(nach);
});
await sE.setViewportSize({ width: 820, height: 1180 });
await warte(1000);
const bilderE = await sE.evaluate(() => window.__pilleBilder);
const gedreht = bilderE.filter((b) => b.breite === 820);
pruefe('Drehen: in jedem Bild nach dem Drehen steht die Pille unter dem aktiven Reiter (Lage unten)',
  gedreht.length >= 3 && gedreht.every((b) => b.unter && b.lage === 'unten'), gedreht.slice(0, 4));
await kE.close();

// F) Fokus ein Bild spaeter (fc): in diesem einen Bild liegt der Fokus noch ausserhalb des Blatts. Ein sehr schnelles Enter
// oder Leerzeichen direkt nach dem Oeffnen darf nicht aufgeben. 'langsam' dehnt das Bild auf 400 ms (requestAnimationFrame
// verzoegert, wie ein sehr schwaches Geraet), damit die Tasten sicher in die Luecke fallen; 'normal' ohne Dehnung.
const kF = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, serviceWorkers: 'block', locale: 'de-DE' });
await kF.addInitScript(() => {
  const roh = window.requestAnimationFrame.bind(window);
  window.__langsam = false;
  window.requestAnimationFrame = (f) => (window.__langsam ? setTimeout(() => roh(f), 400) : roh(f));
  // Zaehler der geoeffneten Blaetter (Fix-Review c9): trennt "blieb offen" von "zu und ueber den Halte-Knopf neu geoeffnet"
  window.__oeffnungen = 0;
  new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.classList?.contains('sheet-ort')) window.__oeffnungen++; })
    .observe(document, { childList: true, subtree: true });
});
const sF = await kF.newPage();
const fehlerF = [];
sF.on('pageerror', (e) => fehlerF.push(e.message));
await sF.goto(`http://127.0.0.1:${PORT}/tests/bauteile.html`);
await sF.waitForFunction(() => window.__bt && document.querySelector('.halte-knopf'), null, { timeout: 30000 });
for (const tempo of ['langsam', 'normal']) {
  for (const taste of ['Enter', ' ']) {
    const vorher = await sF.evaluate((l) => { window.__langsam = l; window.__oeffnungen = 0; return window.__bt.ausgeloest(); }, tempo === 'langsam');
    await sF.locator('.halte-knopf').focus();
    await sF.keyboard.press('Enter');
    // in der Luecke: das Blatt steht, der Fokus noch nicht darin (nur 'langsam' garantiert das)
    const luecke = await sF.evaluate(() => {
      const k = document.querySelector('.sheet-ort .sheet-karte');
      return { blatt: !!k, imBlatt: !!k && k.contains(document.activeElement), fokus: document.activeElement?.className || document.activeElement?.tagName };
    });
    await sF.keyboard.press(taste);
    await sF.keyboard.press(taste);
    await warte(tempo === 'langsam' ? 1500 : 600);
    const nachher = await sF.evaluate(() => ({ ausgeloest: window.__bt.ausgeloest(), blaetter: document.querySelectorAll('.sheet-ort').length,
      titel: document.querySelector('.sheet-karte h3')?.textContent, fokus: document.activeElement?.textContent, oeffnungen: window.__oeffnungen }));
    const name = taste === ' ' ? 'Leerzeichen' : 'Enter';
    if (tempo === 'langsam') pruefe(`Fokus ein Bild spaeter (${tempo}, ${name}): die Tasten fallen wirklich in die Luecke (Blatt steht, Fokus noch nicht darin)`,
      luecke.blatt && !luecke.imBlatt, luecke);
    pruefe(`Fokus ein Bild spaeter (${tempo}): zweimal ${name} direkt nach dem Oeffnen gibt nicht auf, das Blatt bleibt offen`,
      nachher.ausgeloest === vorher && nachher.blaetter <= 1 && nachher.titel === 'Aufgeben?', { vorher, luecke, nachher });
    await sF.evaluate(() => { window.__langsam = false; });
    await sF.keyboard.press('Escape');
    await sF.waitForFunction(() => !document.querySelector('.sheet-ort'), null, { timeout: 3000 }).catch(() => {});
  }
}
// G) Fix-Review c9: nach dem ersten Fokus loest eine Taste ausserhalb der Karte keinen Knopf aus. Klick auf den Text des
// Blatts (Fokus geht auf BODY), dann Leerzeichen oder Enter: das Blatt bleibt offen, ohne neu geoeffnet zu werden.
for (const taste of [' ', 'Enter']) {
  const vorher = await sF.evaluate(() => { window.__oeffnungen = 0; return window.__bt.ausgeloest(); });
  await sF.locator('.halte-knopf').focus();
  await sF.keyboard.press('Enter');
  await sF.waitForFunction(() => document.querySelector('.sheet-karte')?.contains(document.activeElement), null, { timeout: 3000 }).catch(() => {});
  await warte(300);
  await sF.locator('.sheet-karte h3').click();
  const davor = await sF.evaluate(() => document.activeElement?.tagName);
  await sF.keyboard.press(taste);
  await warte(600);
  const nachher = await sF.evaluate(() => ({ ausgeloest: window.__bt.ausgeloest(), blaetter: document.querySelectorAll('.sheet-ort:not(.weg)').length,
    titel: document.querySelector('.sheet-ort:not(.weg) .sheet-karte h3')?.textContent, oeffnungen: window.__oeffnungen, sheetWert: window.__bt.sheetWert() }));
  const name = taste === ' ' ? 'Leerzeichen' : 'Enter';
  pruefe(`Klick auf den Blatt-Text, dann ${name}: das Blatt bleibt offen, kein Knopf loest aus, nicht neu geoeffnet`,
    davor !== 'BUTTON' && nachher.ausgeloest === vorher && nachher.blaetter === 1 && nachher.titel === 'Aufgeben?' && nachher.oeffnungen === 1,
    { davor, vorher, nachher });
  await sF.keyboard.press('Escape');
  await sF.waitForFunction(() => !document.querySelector('.sheet-ort'), null, { timeout: 3000 }).catch(() => {});
}
pruefe('Fokus ein Bild spaeter: keine Seitenfehler', fehlerF.length === 0, fehlerF.slice(0, 3));
await kF.close();

pruefe('keine Seitenfehler', seitenfehler.length === 0, seitenfehler.slice(0, 3));
await browser.close();
server.close();
console.log(`${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
