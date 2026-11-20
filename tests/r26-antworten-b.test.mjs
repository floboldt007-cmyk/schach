// Flos Antworten 6 bis 9 vom 20.11.2026 (Feinschliff R26, Laufzettel: Fable-Rest 02:36, Offline 03:26, iPad 06:42, Tastatur 07:27).
//   6 Shop-Namen: kein Shop-Stueck (Brett, Figuren) teilt Kennung oder Namen (je Sprache) mit einem Stueck der Sammlung.
//     Ausnahme "goldelfenbein": derselbe Satz (assets/pieces/goldelfenbein) in Sammlung und Shop, kein anderer Inhalt.
//   7 Google offline: ohne Netz sind die Anbieter-Knoepfe gesperrt, ein Hinweis sagt warum; online wieder frei.
//   8 iPad quer (1180x820, 1366x1024): Zu zweit (Startblatt) zweispaltig, Start ohne Luft rechts unten, Finisher-Regal
//     fuellt die Reihe. Gegenprobe: Handy hoch und PC ohne Rueckschritt (Startblatt einspaltig, Regal wie bisher, kein Querscrollen).
//   9 Ergebnisblatt der Bot-Partie: das Auge "Brett ansehen" kommt im Tab-Gang direkt nach dem Startfokus, nicht zuletzt.
// Netzwerk: alles ausser 127.0.0.1 wird abgebrochen.
//   node tests/r26-antworten-b.test.mjs
import http from 'node:http';
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { browserTyp } from './browser.mjs';

const require = createRequire(import.meta.url);
let pw;
for (const p of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
  try { pw = require(p); break; } catch (e) { /* naechster */ }
}
if (!pw) throw new Error('Playwright fehlt');
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lies = (rel) => readFileSync(path.join(WURZEL, rel), 'utf8');
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

let ok = 0, gesamt = 0;
function pruefe(name, gut, detail = '') { gesamt++; if (gut) ok++; console.log(`${gut ? 'OK' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(detail)}`); }

// ---------- 6 Shop-Namen (ohne Browser) ----------
{
  const vorrat = JSON.parse(lies('assets/shop/vorrat.json')).stuecke.filter((s) => s.art === 'brett' || s.art === 'figuren');
  const texte = lies('js/pakete/sammlung/texte.js');
  // Sammlung: Kennungen und Namen je Sprache aus dem Woerterbuch der Sammlung (erst der deutsche, dann der englische Block),
  // Bretter zusaetzlich aus den Einstellungen. Verglichen wird je Sprache: nur dort stehen beide Namen nebeneinander.
  const enAb = texte.indexOf("'brett.ahorn'", texte.indexOf("'brett.ahorn'") + 1);
  const ids = new Set();
  const namen = { de: new Set(), en: new Set() };
  const figurenIds = new Set();
  for (const [teil, sp] of [[texte.slice(0, enAb), 'de'], [texte.slice(enAb), 'en']]) {
    for (const [, art, id, name] of teil.matchAll(/'(brett|figuren)\.([a-z0-9-]+)': '([^']+)'/g)) {
      ids.add(id); namen[sp].add(name.toLowerCase());
      if (art === 'figuren') figurenIds.add(id);
    }
  }
  const brettListe = lies('js/storage.js').match(/brett: Object\.freeze\(\[([\s\S]*?)\]\)/)[1];
  for (const [, id] of brettListe.matchAll(/'([a-z0-9-]+)'/g)) ids.add(id);
  const gleicherSatz = (s) => s.art === 'figuren' && s.ordner === `assets/pieces/${s.id}` && figurenIds.has(s.id);
  const doppelId = vorrat.filter((s) => !gleicherSatz(s) && ids.has(s.id)).map((s) => s.id);
  pruefe('6 Shop: keine Kennung eines Bretts oder Figurensatzes gibt es auch in der Sammlung', doppelId.length === 0, doppelId);
  const doppelName = vorrat.filter((s) => !gleicherSatz(s) && (namen.de.has(s.name.toLowerCase()) || namen.en.has(String(s.name_en).toLowerCase())))
    .map((s) => `${s.id}: ${s.name} / ${s.name_en}`);
  pruefe('6 Shop: kein Brett- oder Figuren-Name gibt es in derselben Sprache auch in der Sammlung', doppelName.length === 0, doppelName);
  const vorratIds = vorrat.map((s) => s.id);
  pruefe('6 Shop: Kennungen im Vorrat eindeutig', new Set(vorratIds).size === vorratIds.length);
  const fehlt = vorrat.flatMap((s) => (s.art === 'brett' ? [s.datei] : [`${s.ordner}/wK.svg`, `${s.ordner}/bP.svg`])).filter((d) => !existsSync(path.join(WURZEL, d)));
  pruefe('6 Shop: jede Grafik des Vorrats liegt auf der Platte', fehlt.length === 0, fehlt);
  // der Erzeuger (werkzeuge/shop-vorrat.mjs) schreibt vorrat.json neu: er muss dieselben Kennungen tragen
  const erzeuger = lies('werkzeuge/shop-vorrat.mjs');
  const nichtImErzeuger = vorrat.filter((s) => s.id !== 'goldelfenbein' && !erzeuger.includes(`id: '${s.id}'`)).map((s) => s.id);
  pruefe('6 Shop: der Erzeuger kennt jede Kennung des Vorrats', nichtImErzeuger.length === 0, nichtImErzeuger);
}

// ---------- Browser-Teil ----------
const TYPEN = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.mp3': 'audio/mpeg',
  '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
const server = http.createServer(async (q, r) => {
  try {
    const p = decodeURIComponent(new URL(q.url, 'http://x').pathname);
    const datei = path.resolve(WURZEL, '.' + (p === '/' ? '/index.html' : p));
    if (!datei.startsWith(WURZEL)) { r.writeHead(403); r.end(); return; }
    const d = await readFile(datei);
    r.writeHead(200, { 'Content-Type': TYPEN[path.extname(datei)] || 'application/octet-stream' });
    r.end(d);
  } catch (e) { r.writeHead(404); r.end(); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASIS = `http://127.0.0.1:${server.address().port}/index.html?test`;
const browser = await browserTyp(pw).launch({ headless: true });

async function seite(viewport, { hasTouch = false } = {}) {
  const k = await browser.newContext({ viewport, hasTouch, serviceWorkers: 'block', locale: 'de-DE' });
  await k.addInitScript(() => {
    try {
      localStorage.setItem('schach-arena:v1:modul:start', JSON.stringify({ v: 1, gesehen: '2026-11-01' }));
      localStorage.setItem('schach-arena:v1:hinweis-installieren', '1');
    } catch (e) { /* egal */ }
  });
  await k.route('**/*', (route) => (new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort()));
  const s = await k.newPage();
  const fehler = []; s.on('pageerror', (e) => fehler.push(e.message));
  await s.goto(`${BASIS}#heim`);
  await s.waitForFunction(() => window.__app && document.documentElement.dataset.screen, null, { timeout: 30000 });
  await warte(1200);
  return { k, s, fehler };
}
const querScroll = (s) => s.evaluate(() => document.scrollingElement.scrollWidth - window.innerWidth);

try {
  // ---------- 7 Google offline ----------
  {
    const { k, s, fehler } = await seite({ width: 1024, height: 768 });
    await s.evaluate(() => window.__app.gehe('einstellungen', { gruppe: 'konto' }));
    await s.waitForSelector('.konto-gruppe .konto-google', { state: 'attached', timeout: 10000 });
    await warte(300);
    const stand = () => s.evaluate(() => {
      const g = document.querySelector('.konto-gruppe .konto-google');
      const h = document.querySelector('.konto-gruppe .konto-netz-hinweis');
      return { gesperrt: !!g?.disabled, hinweis: !!h && !h.hidden && h.getClientRects().length > 0, text: h?.textContent || '' };
    });
    const online = await stand();
    pruefe('7 online: "Mit Google anmelden" ist frei und ohne Netz-Hinweis', !online.gesperrt && !online.hinweis, online);
    await k.setOffline(true); await warte(300);
    const aus = await stand();
    pruefe('7 offline: "Mit Google anmelden" ist gesperrt', aus.gesperrt, aus);
    pruefe('7 offline: ein sichtbarer Hinweis sagt, dass es Internet braucht', aus.hinweis && /Internet/.test(aus.text), aus);
    const anfragen = [];
    s.on('request', (q) => { if (q.url().includes('/auth/v1/authorize')) anfragen.push(q.url()); });
    await s.locator('.konto-gruppe .konto-google').click({ force: true, timeout: 2000 }).catch(() => {});
    await warte(300);
    pruefe('7 offline: ein Tipp darauf startet keine Anmeldung', anfragen.length === 0, anfragen);
    // neu gezeichnet (z. B. nach dem Abmelden) bleibt der Stand richtig: Seite verlassen und wiederkommen, noch offline
    await s.evaluate(() => window.__app.gehe('heim')); await warte(200);
    await s.evaluate(() => window.__app.gehe('einstellungen', { gruppe: 'konto' }));
    await s.waitForSelector('.konto-gruppe .konto-google', { state: 'attached', timeout: 10000 }); await warte(300);
    const neu = await stand();
    pruefe('7 offline geoeffnet: Knopf gleich gesperrt, Hinweis da', neu.gesperrt && neu.hinweis, neu);
    await k.setOffline(false); await warte(300);
    const wieder = await stand();
    pruefe('7 wieder online: Knopf frei, Hinweis weg', !wieder.gesperrt && !wieder.hinweis, wieder);
    pruefe('7 keine Seitenfehler', fehler.length === 0, fehler);
    await k.close();
  }

  // ---------- 8 iPad quer ----------
  for (const viewport of [{ width: 1180, height: 820 }, { width: 1366, height: 1024 }]) {
    const g = `${viewport.width}x${viewport.height}`;
    const { k, s, fehler } = await seite(viewport, { hasTouch: true });
    // Start: rechts unten keine Luft, d. h. die rechte Spalte endet buendig mit der linken (Buehne, Leiter, Shop), aber
    // auch nicht weit darunter (eine Liste bis zum Seitenende waere keine Fuellung, sondern eine leere Flaeche)
    const heim = await s.evaluate(() => {
      const rumpf = document.querySelector('.heim-screen .heim-rumpf');
      const rechtsEl = rumpf.querySelector(':scope > .heim-rechts');
      const rechts = rechtsEl.getBoundingClientRect();
      const links = Math.max(...[...rumpf.children].filter((e) => e !== rechtsEl).map((e) => e.getBoundingClientRect().bottom));
      const zeilen = [...rechtsEl.querySelectorAll('.heim-modus, .heim-liste > *')].filter((e) => e.getClientRects().length);
      const inhalt = Math.max(...zeilen.map((e) => e.getBoundingClientRect().bottom));
      return { luft: Math.round(links - rechts.bottom), ueberstand: Math.round(rechts.bottom - Math.max(links, inhalt)) };
    });
    pruefe(`8 Start ${g}: rechte Spalte endet buendig mit der linken (keine Luft, kein leerer Ueberstand)`, heim.luft <= 24 && heim.ueberstand <= 4, heim);
    pruefe(`8 Start ${g}: kein seitliches Scrollen`, (await querScroll(s)) <= 0);
    // Zu zweit, Startblatt: zwei Spalten, die Breite ist genutzt
    await s.locator('[data-aktion="heim-zuzweit"]').click();
    await s.waitForSelector('.zz-start .zz-los', { timeout: 10000 }); await warte(500);
    const zz = await s.evaluate(() => {
      const r = (q) => document.querySelector(q).getBoundingClientRect();
      const rumpf = r('.zz-startblatt .zz-rumpf'); const start = r('.zz-start'); const b = r('.zz-start .zz-buehne'); const los = r('.zz-start .zz-los');
      return { anteil: Math.round(start.width / rumpf.width * 100), nebeneinander: b.right <= los.left, losUnten: Math.round(los.bottom), hoehe: innerHeight };
    });
    pruefe(`8 Zu zweit ${g}: Startblatt nutzt mindestens 80 % der Breite`, zz.anteil >= 80, zz);
    pruefe(`8 Zu zweit ${g}: Buehne links, Einstellungen und Los rechts`, zz.nebeneinander, zz);
    pruefe(`8 Zu zweit ${g}: Los ohne Scrollen sichtbar`, zz.losUnten <= zz.hoehe, zz);
    // Shop: das Finisher-Regal fuellt die Reihe
    await s.evaluate(() => window.__app.gehe('ich', { bereich: 'shop' }));
    await s.waitForSelector('.shf-regal', { timeout: 15000 }); await warte(800);
    const regal = await s.evaluate(() => {
      const reg = [...document.querySelectorAll('.shf-regal')].find((x) => /Finisher/.test(x.querySelector('.shf-regal-titel')?.textContent || ''));
      if (!reg) return null;
      const reihe = reg.querySelector('.shf-regal-reihe').getBoundingClientRect();
      const karten = [...reg.querySelectorAll('.shf-rk')].map((x) => x.getBoundingClientRect());
      return { karten: karten.length, rest: Math.round(reihe.right - Math.max(...karten.map((x) => x.right))), ueber: reg.querySelector('.shf-regal-reihe').scrollWidth - reg.querySelector('.shf-regal-reihe').clientWidth };
    });
    pruefe(`8 Shop ${g}: Finisher-Regal fuellt die Reihe (hoechstens 16 px frei)`, regal && regal.rest <= 16 && regal.ueber <= 0, regal);
    pruefe(`8 iPad ${g}: keine Seitenfehler`, fehler.length === 0, fehler);
    await k.close();
  }
  // Gegenprobe: Handy hoch und PC
  for (const [name, viewport, hasTouch] of [['Handy 390x844', { width: 390, height: 844 }, true], ['PC 1280x720', { width: 1280, height: 720 }, false]]) {
    const { k, s, fehler } = await seite(viewport, { hasTouch });
    pruefe(`8 ${name}: Start ohne seitliches Scrollen`, (await querScroll(s)) <= 0);
    await s.locator('[data-aktion="heim-zuzweit"]').click();
    await s.waitForSelector('.zz-start .zz-los', { timeout: 10000 }); await warte(500);
    const zz = await s.evaluate(() => {
      const b = document.querySelector('.zz-start .zz-buehne').getBoundingClientRect(); const los = document.querySelector('.zz-start .zz-los').getBoundingClientRect();
      return { untereinander: b.bottom <= los.top, nebeneinander: b.right <= los.left };
    });
    if (name.startsWith('Handy')) pruefe(`8 ${name}: Zu zweit bleibt einspaltig (Buehne ueber Los)`, zz.untereinander, zz);
    else pruefe(`8 ${name}: Zu zweit quer zweispaltig wie am iPad`, zz.nebeneinander, zz);
    pruefe(`8 ${name}: Zu zweit ohne seitliches Scrollen`, (await querScroll(s)) <= 0);
    await s.evaluate(() => window.__app.gehe('ich', { bereich: 'shop' }));
    await s.waitForSelector('.shf-regal', { timeout: 15000 }); await warte(800);
    const breite = await s.evaluate(() => Math.max(...[...document.querySelectorAll('.shf-regal .shf-rk')].map((x) => x.getBoundingClientRect().width)));
    if (name.startsWith('Handy')) pruefe(`8 ${name}: Regal-Karten wie bisher hoechstens 150 px breit (seitlich wischen)`, breite <= 150.5, breite);
    pruefe(`8 ${name}: keine Seitenfehler`, fehler.length === 0, fehler);
    await k.close();
  }

  // ---------- 9 Tab-Reihe im Ergebnisblatt der Bot-Partie ----------
  {
    const { k, s, fehler } = await seite({ width: 1280, height: 720 });
    const PLAN = { e2e4: 'e7e5', f1c4: 'b8c6', d1h5: 'g8f6' };
    await s.evaluate((plan) => {
      localStorage.removeItem('schach-arena:v1:laufend');
      window.__test = { botZug: () => { const v = window.__partie.chess().history({ verbose: true }); return plan[v[v.length - 1].lan] || null; } };
    }, PLAN);
    await s.evaluate(() => window.__app.gehe('partie', { botId: 'benno', farbe: 'w' }));
    await s.waitForFunction(() => window.__partie && window.__partie.bereit === true, null, { timeout: 30000 });
    for (const z of ['e2e4', 'f1c4', 'd1h5', 'h5f7']) {
      await s.waitForFunction(() => window.__partie.phase() === 'flo', null, { timeout: 30000 });
      for (const f of [z.slice(0, 2), z.slice(2, 4)]) await s.locator(`.screen.partie .brett-felder .feld[data-feld="${f}"]`).click();
      if (await s.locator('.screen.partie .brett .lage.vorschau').count()) await s.locator(`.screen.partie .brett-felder .feld[data-feld="${z.slice(2, 4)}"]`).click();
    }
    await s.waitForSelector('.ergebnis-overlay.sieg.gefuellt', { timeout: 40000 });
    await warte(2500);
    const wer = () => s.evaluate(() => {
      const a = document.activeElement;
      if (!a.closest('.ergebnis-overlay')) return 'draussen';
      if (!a.dataset.r26) a.dataset.r26 = String(document.querySelectorAll('[data-r26]').length + 1);
      return a.classList.contains('erg-zu') ? 'auge' : a.dataset.r26;
    });
    const start = await wer();
    pruefe('9 Startfokus liegt auf einem Knopf im Blatt, nicht auf dem Auge', start !== 'draussen' && start !== 'auge', start);
    await s.keyboard.press('Tab');
    pruefe('9 Tab nach dem Startfokus: das Auge "Brett ansehen"', (await wer()) === 'auge', await wer());
    await s.keyboard.press('Shift+Tab');
    pruefe('9 Umschalt+Tab vom Auge: zurueck zum Startfokus', (await wer()) === start, await wer());
    // ein ganzer Umlauf: jedes Ziel genau einmal, dann wieder der Start
    const ziele = await s.evaluate(() => [...document.querySelectorAll('.ergebnis-overlay button, .ergebnis-overlay a[href], .ergebnis-overlay [tabindex]:not([tabindex="-1"])')]
      .filter((x) => !x.disabled && x.getClientRects().length).length);
    const gesehen = [];
    for (let i = 0; i < ziele; i++) { await s.keyboard.press('Tab'); gesehen.push(await wer()); }
    pruefe('9 ein Umlauf: jedes Ziel genau einmal, zuletzt wieder der Start', new Set(gesehen).size === ziele && gesehen.at(-1) === start
      && !gesehen.includes('draussen'), { ziele, gesehen });
    pruefe('9 keine Seitenfehler', fehler.length === 0, fehler);
    await k.close();
  }
} finally {
  await browser.close(); server.close();
}
console.log(`${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
