// Mehr Emotes, Finisher und Klaenge (Feinschliff R19, Flo 15.11.2026: "wenig gratis, das Gesperrte sieht krasser aus";
// Leitlinie Punkt 6 "Erspielen gegen Kaufen"). Gratis bleibt genau die Grundausstattung (8 Sticker im Rad, Klangsets Holz
// und Arcade); wie Neues frei wird, prueft tests/r19-emotes-erspielbar.test.mjs (Flos Wahl Variante C vom 18.11.2026).
//   Neu: 6 Premium-Sticker (js/emote-kunst.js EMOTE_PREMIUM), 3 Finisher (hoechstens 1400 ms, ruhig bei weniger
//   Bewegung), 2 eigene Klangsets (werkzeuge/klang-sets-r19.mjs, eigene Synthese, nur bei Bedarf im Cache: sw.js laedt
//   Labor-Klaenge nicht vor). Shop A zeigt unter den fuenf Plaetzen die Regale "Mehr Finisher" und "Mehr Klaenge"
//   (assets/shop/auslage.json "regale"), jede Karte mit Schloss und "Bald", Vorschau zum Ansehen und Anhoeren, kein Kauf.
// iPhone 13, iPhone SE, iPad hoch und quer, PC, hell und dunkel, dazu weniger Bewegung. Netz nur simuliert.
//
//   node tests/r19-emotes-finisher.test.mjs
import http from 'node:http';
import { createRequire } from 'node:module';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { setzeSpeicher } from '../js/storage.js';
import { browserTyp } from './browser.mjs';

class Speicher { constructor() { this.m = new Map(); } getItem(k) { return this.m.get(k) ?? null; } setItem(k, v) { this.m.set(k, String(v)); } removeItem(k) { this.m.delete(k); } key(i) { return [...this.m.keys()][i] ?? null; } get length() { return this.m.size; } }
const lager = new Speicher();
setzeSpeicher(lager);

let ok = 0, gesamt = 0;
function pruefe(name, gut, detail = '') {
  gesamt++; if (gut) ok++;
  // INTENTIONAL-SLOP[T4]: die Pruefzeile ist die Ausgabe des Tests (wie in tests/r19-shop-fortnite.test.mjs)
  console.log(`${gut ? 'ok  ' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(detail)}`);
}
const root = fileURLToPath(new URL('../', import.meta.url));
const lies = (p) => readFileSync(path.join(root, p), 'utf8');
const leer = async (f) => { try { return await f(); } catch (e) { return { fehler: String(e && e.message || e) }; } };

const PREMIUM = ['krone', 'feuer', 'herz', 'springer', 'blitz', 'diamant'];
const NEU_FINISHER = ['blitzschlag', 'goldregen', 'schockwelle'];
const NEU_KLANG = ['polarlicht', 'donner'];
const GRATIS_STICKER = ['hallo', 'daumen', 'applaus', 'staunen', 'denken', 'respekt', 'gut', 'uff'];

// ---------- Emotes ----------
const kunst = await leer(() => import('../js/emote-kunst.js'));
const emotes = await leer(() => import('../js/pakete/emotes/index.js'));
const emoteTexte = await leer(() => import('../js/pakete/emotes/texte.js'));
const emoteCss = lies('css/pakete/emotes.css');
pruefe('Emotes: 6 Premium-Sticker, eigene Liste neben den 8 des Rads', JSON.stringify(kunst.EMOTE_PREMIUM) === JSON.stringify(PREMIUM)
  && JSON.stringify(kunst.EMOTE_STICKER) === JSON.stringify(GRATIS_STICKER), { premium: kunst.EMOTE_PREMIUM, sticker: kunst.EMOTE_STICKER });
const psvg = PREMIUM.map((id) => (kunst.emoteSvg ? kunst.emoteSvg(id) : ''));
pruefe('Emotes: jeder Premium-Sticker hat ein eigenes Bild mit Klasse emote-premium (Gold-Kante, Glanz)',
  psvg.every((s) => /class="emote-sticker emote-premium/.test(s) && /data-emote=/.test(s)) && new Set(psvg.map((s) => s.replace(/es[a-z]\d+/g, ''))).size === 6, psvg.map((s) => s.slice(0, 60)));
const gsvg = GRATIS_STICKER.map((id) => (kunst.emoteSvg ? kunst.emoteSvg(id) : ''));
pruefe('Emotes: die 8 Gratis-Sticker bleiben schlicht (kein emote-premium)', gsvg.every((s) => s && !/emote-premium/.test(s)));
const klassen = (s) => [...new Set((s.match(/class="([^"]+)"/g) || []).flatMap((x) => x.slice(7, -1).split(/\s+/)))].filter((k) => /^ep-/.test(k));
const ohneBewegung = PREMIUM.filter((id, i) => !klassen(psvg[i]).some((k) => new RegExp(`\\.${k}\\b[^{]*\\{[^}]*animation:`).test(emoteCss)));
pruefe('Emotes: jeder Premium-Sticker bewegt sich (eigene ep-Klasse mit Animation)', ohneBewegung.length === 0, ohneBewegung);
pruefe('Emotes: weniger Bewegung haelt auch die Premium-Sticker an (Regel auf .emote-sticker)',
  /prefers-reduced-motion: reduce\) \{ \.emote-sticker, \.emote-sticker \* \{ animation: none !important/.test(emoteCss));
const nurTransform = [...emoteCss.matchAll(/@keyframes (ep-[a-z-]+)\s*\{([\s\S]*?)\n\}/g)].filter(([, , k]) => /(?:^|[;{\s])(?:width|height|top|left|margin|filter|box-shadow)\s*:/.test(k)).map(([, n]) => n);
pruefe('Emotes: Premium-Bewegung nur ueber transform und opacity (keine Ruckler am Handy)', nurTransform.length === 0, nurTransform);
const ohne = emotes.teileEmotes ? emotes.teileEmotes(false) : [];
const DE_E = emoteTexte.DE || {}, EN_E = emoteTexte.EN || {};
pruefe('Sammlung Emotes ohne Erfinder: 8 Sticker frei wie heute, dahinter 6 Premium gesperrt mit ihrem Funken-Level',
  // die acht in der Reihenfolge des Rads (EMOTES in emotes/index.js), darum als Menge verglichen
  ohne.filter((x) => /^emote-/.test(x.id)).length === 14 && ohne.slice(0, 8).every((x) => x.frei) && ohne.slice(0, 8).map((x) => x.id).sort().join() === GRATIS_STICKER.map((id) => 'emote-' + id).sort().join()
  && ohne.slice(8, 14).every((x, i) => !x.frei && x.id === 'emote-' + PREMIUM[i] && x.zeile === `Ab Level ${12 + i * 6}` && x.gruppe === DE_E['gruppe.premium'] && /emote-premium/.test(x.bild)),
  ohne.map((x) => `${x.id}:${x.frei}:${x.zeile}`));
const mit = emotes.teileEmotes ? emotes.teileEmotes(true) : [];
pruefe('Sammlung Emotes mit Erfinder: Premium im Labor frei', mit.filter((x) => /^emote-/.test(x.id)).length === 14
  && mit.filter((x) => PREMIUM.some((p) => x.id === 'emote-' + p)).every((x) => x.frei && x.labor), mit.map((x) => `${x.id}:${x.frei}`));
pruefe('Emotes: Texte DE und EN fuer jeden Premium-Sticker und die Gruppe',
  PREMIUM.every((id) => DE_E['emote.' + id] && EN_E['emote.' + id]) && DE_E['gruppe.premium'] && EN_E['gruppe.premium']);

// ---------- Finisher ----------
const finisher = await leer(() => import('../js/pakete/finisher/index.js'));
const finTexte = await leer(() => import('../js/pakete/finisher/texte.js'));
const sounds = await leer(() => import('../js/sounds.js'));
const finCss = lies('css/pakete/finisher.css');
const FIN = finisher.FINISHER || [];
pruefe('Finisher: drei neue, alte unveraendert in der Reihenfolge davor',
  JSON.stringify(FIN.map((x) => x.id)) === JSON.stringify(['aus', 'krone', 'welle', 'koenig', 'kronensturz', ...NEU_FINISHER, 'signatur']), FIN.map((x) => x.id));
pruefe('Finisher: die neuen hoechstens 1400 ms, die alten ohne eigene Grenze (bleiben wie sie sind)',
  NEU_FINISHER.every((id) => FIN.find((x) => x.id === id)?.dauer <= 1400) && FIN.filter((x) => !NEU_FINISHER.includes(x.id)).every((x) => x.dauer === undefined));
pruefe('Finisher: neue ohne Erfinder gesperrt (wie heute jeder Finisher)', finisher.istFrei && NEU_FINISHER.every((id) => !finisher.istFrei(id)));
pruefe('Finisher: neue nutzen vorhandene Finisher-Klaenge (Gruppe finisher, einzeln abschaltbar)',
  NEU_FINISHER.every((id) => { const f = FIN.find((x) => x.id === id); return f && sounds.KATALOG?.[f.klang]?.gruppe === 'finisher'; }));
pruefe('Finisher: Texte DE und EN', NEU_FINISHER.every((id) => finTexte.DE?.[id] && finTexte.EN?.[id]));
// echte Laufzeit im Schein-DOM: ohne dauerMs der Partie endet der neue Finisher vor 1,5 s und raeumt auf
class El {
  constructor() { this.kinder = []; this.dataset = {}; this.attr = {}; this.style = { setProperty() {} }; this.eltern = null; this.innerHTML = ''; this.className = ''; }
  setAttribute(k, v) { this.attr[k] = String(v); }
  appendChild(k) { k.eltern = this; this.kinder.push(k); return k; }
  remove() { if (this.eltern) this.eltern.kinder = this.eltern.kinder.filter((x) => x !== this); this.eltern = null; }
}
globalThis.document = globalThis.document || { createElement: () => new El() };
if (sounds.klang) sounds.klang.spiele = () => {};
for (const id of NEU_FINISHER) {
  const r = await leer(async () => {
    const c = { gewinner: 'flo', buehne: { effekte: new El(), feld: () => ({ x: 4, y: 4 }) }, letzterZug: { nach: 'f7' }, koenigFeld: 'e8' };
    const t0 = Date.now();
    const h = finisher.starteFinisher(c, id);
    const html = c.buehne.effekte.kinder[0]?.innerHTML || '';
    await h.fertig;
    return { ms: Date.now() - t0, html: html.length, weg: c.buehne.effekte.kinder.length === 0 };
  });
  pruefe(`Finisher ${id}: laeuft, endet vor 1500 ms und raeumt auf`, r.ms < 1500 && r.html > 20 && r.weg, r);
  const ruhig = await leer(async () => {
    const c = { gewinner: 'flo', buehne: { effekte: new El(), feld: () => ({ x: 4, y: 4 }) }, letzterZug: { nach: 'f7' }, koenigFeld: 'e8', reduziert: true };
    const h = finisher.starteFinisher(c, id);
    const kl = c.buehne.effekte.kinder[0]?.className || '';
    await h.fertig; return kl;
  });
  pruefe(`Finisher ${id}: weniger Bewegung = ruhiges Standbild (ist-ruhig)`, /ist-ruhig/.test(ruhig), ruhig);
}
// CSS: jede Animation der neuen Finisher <= 1,4 s, und ist-ruhig haelt sie an
const finDauern = [...finCss.matchAll(/\.finisher-(blitzschlag|goldregen|schockwelle)[^{]*\{[^}]*animation:[^;]*?(\d*\.?\d+)(ms|s)/g)].map(([, id, z, e]) => [id, e === 's' ? Number(z) * 1000 : Number(z)]);
pruefe('Finisher: CSS-Animationen der neuen <= 1400 ms (jeder der drei hat eine)',
  NEU_FINISHER.every((id) => finDauern.some(([i]) => i === id)) && finDauern.every(([, ms]) => ms <= 1400), finDauern);
pruefe('Finisher: ist-ruhig gilt fuer die neuen (Animation aus)', /\.finisher\.ist-ruhig[^{]*\{[^}]*animation:\s*none/.test(finCss) || NEU_FINISHER.every((id) => new RegExp(`\\.finisher-${id}\\.ist-ruhig`).test(finCss)));
const sk = await leer(() => import('../js/sammlung-kunst.js'));
pruefe('Finisher: jedes neue hat ein Bild fuer Sammlung und Shop', NEU_FINISHER.every((id) => /<svg/.test(sk.finisherKunst?.(id, 'assets/pieces/cburnett') || '')));

// ---------- Klaenge ----------
const labor = await leer(() => import('../js/labor.js'));
pruefe('Klaenge: zwei neue Sets im Labor (sounds.js und labor.js), Holz und Arcade bleiben die gratis Sets',
  NEU_KLANG.every((id) => sounds.PAKETE_LABOR?.[id] && labor.LABOR_KLAENGE?.includes(id)) && JSON.stringify(Object.keys(sounds.PAKETE_KLANG || {})) === '["holz","arcade"]');
pruefe('Klaenge: neue Sets ohne Erfinder nicht waehlbar (klangWahl leer)', labor.klangWahl && NEU_KLANG.every((id) => labor.klangWahl(id) === ''));
// Die Wahl muss den Speicher ueberleben (js/storage.js ERLAUBT), sonst faellt der Erfinder still auf den Standard zurueck
const speicher = await leer(() => import('../js/storage.js'));
const bleibt = NEU_KLANG.map((id) => { speicher.speichereEinstellungen({ klangpaket: id }); return speicher.ladeEinstellungen().klangpaket; });
speicher.speichereEinstellungen({ klangpaket: '' });
pruefe('Klaenge: gewaehltes neues Set bleibt gespeichert (Erfinder)', JSON.stringify(bleibt) === JSON.stringify(NEU_KLANG), bleibt);
const juwel = readdirSync(path.join(root, 'assets/klang/juwel')).filter((d) => d.endsWith('.mp3')).sort();
for (const id of NEU_KLANG) {
  const ordner = path.join(root, 'assets/klang', id);
  const dateien = existsSync(ordner) ? readdirSync(ordner).filter((d) => d.endsWith('.mp3')).sort() : [];
  const groessen = dateien.map((d) => statSync(path.join(ordner, d)).size);
  pruefe(`Klangset ${id}: dieselben ${juwel.length} Klaenge wie Juwel, jede Datei zwischen 1 und 60 KB`,
    JSON.stringify(dateien) === JSON.stringify(juwel) && groessen.every((g) => g > 1000 && g < 60000), { anzahl: dateien.length, max: Math.max(0, ...groessen) });
}
const werkzeug = existsSync(path.join(root, 'werkzeuge/klang-sets-r19.mjs')) ? lies('werkzeuge/klang-sets-r19.mjs') : '';
pruefe('Klaenge: eigene Synthese (Werkzeug ohne Netz und ohne fremde Audiodatei)', werkzeug.length > 0 && !/https?:\/\//.test(werkzeug) && !/readFileSync\([^)]*\.(mp3|wav|ogg)/.test(werkzeug));
const lizenz = lies('assets/klang/LIZENZEN.md');
pruefe('Klaenge: Herkunft in LIZENZEN.md', NEU_KLANG.every((id) => lizenz.includes(`${id}/`)) && lizenz.includes('klang-sets-r19.mjs'));
const sw = lies('sw.js');
pruefe('Klaenge: sw.js laedt die neuen Sets nicht vor (nur bei Bedarf in den Cache, wie Grusel, Kristall, Juwel)',
  NEU_KLANG.every((id) => !sw.includes(`assets/klang/${id}/`)) && !sw.includes('assets/klang/juwel/'));
pruefe('Klaenge: jedes neue Set hat ein Bild', NEU_KLANG.every((id) => /<svg/.test(sk.klangKunst?.(id) || '')));
const samTexte = lies('js/pakete/sammlung/texte.js');
const zweimal = (k) => (samTexte.match(new RegExp(`'${k.replace('.', '\\.')}':`, 'g')) || []).length === 2;
pruefe('Texte DE und EN: Klangset-Namen und Regal-Titel', NEU_KLANG.every((id) => zweimal('klang.' + id)) && ['regal.emote', 'regal.finisher', 'regal.klang'].every(zweimal));

// ---------- Auslage ----------
const AUSLAGE = JSON.parse(lies('assets/shop/auslage.json'));
const R = AUSLAGE.regale || {};
const platz = (art) => AUSLAGE.plaetze.find((p) => p.art === art)?.id;
const REGALE = ['finisher', 'klang'];
pruefe('Auslage: zwei Regale (finisher, klang), das Emote-Regal ist leer, nichts doppelt zu den fuenf Plaetzen, kein Preis, Signatur nie',
  REGALE.every((a) => Array.isArray(R[a]) && R[a].length >= 2 && !R[a].some((x) => x.id === platz(a)))
  && !JSON.stringify(R).match(/preis|cent|€|signatur/i)
  && Array.isArray(R.emote) && R.emote.length === 0
  && NEU_FINISHER.every((id) => R.finisher.some((x) => x.id === id)) && NEU_KLANG.every((id) => R.klang.some((x) => x.id === id)), R);

// ---------- Browser: Shop-Regale ----------
const require = createRequire(import.meta.url);
let pw;
for (const p of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
  try { pw = require(p); break; } catch (e) { /* naechster */ }
}
if (!pw) throw new Error('Playwright fehlt');
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
const UID = 'u1';
const SITZUNG = { access_token: 'a.' + Buffer.from(JSON.stringify({ sub: UID })).toString('base64url') + '.x', refresh_token: 'test-r',
  expires_at: 9999999999, user: { id: UID, email: 'spieler@example.invalid' } };
function bediener(z) {
  return async (route) => {
    const url = new URL(route.request().url());
    const antwort = (d) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
    if (url.pathname.startsWith('/auth/v1/')) return antwort({ id: UID, email: 'spieler@example.invalid' });
    if (url.pathname === '/rest/v1/altersangaben') return antwort([{ ab18: true }]);
    if (url.pathname === '/rest/v1/profile') return antwort([{ user_id: UID, benutzername: 'Mira' }]);
    if (url.pathname === '/rest/v1/sonderstuecke') return antwort([]);
    z.aufrufe.push(url.pathname.split('/').at(-1));
    if (url.pathname.endsWith('/edition_staende')) return antwort([{ produkt_id: 'brett-mitternacht', name: 'Mitternacht & Gold', betrag_cent: 499, waehrung: 'eur' }]);
    if (/karte_(melde_stufen|waehle)$/.test(url.pathname)) return antwort({ taler: 0, stufen: {}, banner: ['start'], wahl: { banner: 'start' } });
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
}
async function oeffneShop(s) {
  await s.goto(`http://127.0.0.1:${PORT}/index.html?test#heim`);
  await s.waitForFunction(() => window.__app && typeof window.__app.gehe === 'function' && document.querySelector('.screen.heim-screen'), null, { timeout: 45000 });
  await s.evaluate(() => window.__app.gehe('ich'));
  await s.waitForSelector('.sa-screen', { timeout: 30000 });
  await warte(400);
  for (let i = 0; i < 12 && await s.locator('.st-moment .st-weiter').count(); i++) { await s.locator('.st-moment .st-weiter').first().click(); await warte(250); }
  await s.locator('.sa-platz[data-bereich="shop"], .sa-gross[data-bereich="shop"]').first().click();
  await s.waitForSelector('.sa-blatt .sa-bereich[data-bereich="shop"]:not([hidden])', { timeout: 10000 });
  await s.waitForSelector('.sa-blatt .shf .shf-karte', { timeout: 15000 }).catch(() => {});
  await warte(400);
}
async function vorschau(s, art) {
  const k = s.locator(`.sa-blatt .shf-regal[data-art="${art}"] .shf-rk`).first();
  await k.scrollIntoViewIfNeeded();
  await k.click();
  await s.waitForSelector('.sheet-karte .shf-vorschau', { timeout: 10000 });
  await warte(500);
  const v = await s.evaluate(() => {
    const ort = document.querySelector('.sheet-karte .shf-vorschau');
    return { knoepfe: [...document.querySelectorAll('.sheet-karte .sheet-knoepfe button')].map((b) => b.textContent.trim()),
      anhoeren: !!ort?.querySelector('.shf-anhoeren'), still: !!ort?.querySelector('.shf-gross.shf-still'), bild: !!ort?.querySelector('svg') };
  });
  if (v.anhoeren) await s.locator('.sheet-karte .shf-anhoeren').click();
  await s.locator('.sheet-karte .sheet-knoepfe button').first().click();
  await s.waitForSelector('.sheet-karte', { state: 'detached', timeout: 5000 }).catch(() => {});
  await warte(300);
  return v;
}

const IPHONE = ['iPhone 13', 390, 844], SE = ['iPhone SE', 375, 667], IPAD = ['iPad', 820, 1180], IPAD_QUER = ['iPad quer', 1180, 820], PC = ['PC', 1280, 720];
const seitenfehler = [];
const TITEL = { finisher: 'Mehr Finisher', klang: 'Mehr Klänge', effekt: 'Effekte' };
async function lauf(browser, [geraet, w, h], { farbe = 'hell', ruhig = false, gast = false } = {}) {
  const gruppe = `${geraet}${farbe === 'dunkel' ? ' dunkel' : ''}${ruhig ? ' ruhig' : ''}${gast ? ' gast' : ''}`;
  const k = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: true, serviceWorkers: 'block',
    colorScheme: farbe === 'dunkel' ? 'dark' : 'light', reducedMotion: ruhig ? 'reduce' : 'no-preference', locale: 'de-DE', timezoneId: 'Europe/Berlin' });
  const z = { aufrufe: [] };
  await k.route('**/*.supabase.co/**', bediener(z));
  await k.addInitScript(initSkript, { sitzung: gast ? null : SITZUNG });
  const s = await k.newPage(); s.setDefaultTimeout(15000);
  s.on('pageerror', (e) => seitenfehler.push(`${gruppe}: ${e.message}`));
  try {
    await oeffneShop(s);
    const bild = await s.evaluate(() => {
      const breite = document.documentElement.clientWidth;
      const regale = [...document.querySelectorAll('.sa-blatt .shf-regal')];
      const rk = [...document.querySelectorAll('.sa-blatt .shf-rk')];
      return {
        plaetze: document.querySelectorAll('.sa-blatt .shf-karte').length,
        arten: regale.map((r) => r.dataset.art),
        titel: regale.map((r) => r.querySelector('.shf-regal-titel')?.textContent.trim()),
        ids: Object.fromEntries(regale.map((r) => [r.dataset.art, [...r.querySelectorAll('.shf-rk')].map((x) => x.dataset.id)])),
        preise: rk.map((x) => x.querySelector('.shf-preis')?.textContent.trim()),
        schloss: rk.every((x) => !!x.querySelector('.shf-preis svg.shf-schloss')),
        mitBild: rk.every((x) => !!x.querySelector('.shf-bild svg, .shf-bild img')),
        euro: ((document.querySelector('.sa-blatt .shf')?.innerText || '').match(/€/g) || []).length,
        seiteUeber: document.scrollingElement.scrollWidth > breite + 1,
        regalUeber: regale.some((r) => { const b = r.getBoundingClientRect(); return b.left < -1 || b.right > breite + 1; }),
        klein: rk.filter((x) => { const b = x.getBoundingClientRect(); return b.width < 44 || b.height < 44; }).length,
        label: rk.every((x) => /Bald/.test(x.getAttribute('aria-label') || '')),
      };
    });
    pruefe(`${gruppe}: die vier Plaetze bleiben`, bild.plaetze === 4, bild.plaetze);
    pruefe(`${gruppe}: drei Regale in fester Reihenfolge mit Titel, kein leeres Emote-Regal`, JSON.stringify(bild.arten) === '["finisher","klang","effekt"]'
      && bild.titel.join() === [TITEL.finisher, TITEL.klang, TITEL.effekt].join(), bild.titel);
    pruefe(`${gruppe}: Regale zeigen die Liste aus auslage.json`, REGALE.every((a) => JSON.stringify(bild.ids[a]) === JSON.stringify(R[a].map((x) => x.id))), bild.ids);
    pruefe(`${gruppe}: jede Regal-Karte mit Bild, Schloss und "Bald", kein Preis (auch nicht bei Server-Preis)`,
      bild.preise.length > 0 && bild.preise.every((x) => x === 'Bald') && bild.schloss && bild.mitBild && bild.euro === 0 && bild.label, bild.preise);
    pruefe(`${gruppe}: kein Ueberlauf der Seite, Regale passen in die Breite`, !bild.seiteUeber && !bild.regalUeber, bild);
    pruefe(`${gruppe}: Regal-Karten mindestens 44 px`, bild.klein === 0, bild.klein);
    if (gast) { await k.close(); return; }
    const vor = z.aufrufe.length;
    const f = await vorschau(s, 'finisher');
    pruefe(`${gruppe}: Finisher-Vorschau als Bild, nur "Schließen"`, f.still && f.bild && JSON.stringify(f.knoepfe) === '["Schließen"]', f);
    const kl = await vorschau(s, 'klang');
    pruefe(`${gruppe}: Klang-Vorschau mit Anhoeren, nur "Schließen"`, kl.anhoeren && JSON.stringify(kl.knoepfe) === '["Schließen"]', kl);
    pruefe(`${gruppe}: Vorschau ruft nichts beim Server auf`, z.aufrufe.length === vor, z.aufrufe.slice(vor));
  } catch (e) {
    pruefe(`${gruppe}: Ablauf ohne Abbruch`, false, String(e.message).slice(0, 160));
  } finally { await k.close(); }
}

const browser = await browserTyp(pw).launch({ headless: true });
try {
  for (const g of [IPHONE, SE, IPAD, IPAD_QUER, PC]) await lauf(browser, g);
  await lauf(browser, IPHONE, { farbe: 'dunkel' });
  await lauf(browser, PC, { farbe: 'dunkel' });
  await lauf(browser, IPHONE, { ruhig: true });
  await lauf(browser, IPHONE, { gast: true });
} finally { await browser.close(); server.close(); }
pruefe('Browser: keine Seitenfehler', seitenfehler.length === 0, seitenfehler.slice(0, 3));
console.log(`\n${ok}/${gesamt} Pruefungen bestanden`);
process.exitCode = ok === gesamt ? 0 : 1;
