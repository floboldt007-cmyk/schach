// Paket Sammlung (Reiter "Ich"): Bereiche und Erfolge aus dem Spielstand ohne Browser, dazu ein Browser-Teil (Playwright)
// in der vollen App: Reiter, sieben Bereiche, Schloss und Weg dahin, Zaehler, Handy ohne waagrechtes Scrollen, Englisch.
// Shop (Editionen) mit gefaelschtem Supabase-Server ueber page.route: abgemeldet, ohne Altersangabe, mit Edition.
//   node tests/sammlung.test.mjs            Node und Browser
//   node tests/sammlung.test.mjs --nur-node nur der Node-Teil
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { setzeSpeicher } from '../js/storage.js';
import { teileBretter, teileKlaenge, teileErfolge } from '../js/pakete/sammlung/index.js';
import { standText } from '../js/pakete/sammlung/shop.js';
import { BOTS } from '../js/bots.js';
import { browserTyp } from './browser.mjs';

const require = createRequire(import.meta.url);
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8917);
const BASIS = `http://127.0.0.1:${PORT}/index.html?test`;
const NUR_NODE = process.argv.includes('--nur-node');
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

let ok = 0; let fehler = 0;
function pruefe(name, wert, info = '') {
  if (wert) { ok++; console.log('ok   ' + name); } else { fehler++; console.log('FEHLER ' + name + ' ' + (typeof info === 'string' ? info : JSON.stringify(info))); }
}

// ---------------------------------------------------------------------------
// Node-Teil
// ---------------------------------------------------------------------------
const lager = new Map();
setzeSpeicher({ getItem: (k) => (lager.has(k) ? lager.get(k) : null), setItem: (k, v) => lager.set(k, String(v)), removeItem: (k) => lager.delete(k),
  key: (i) => [...lager.keys()][i] ?? null, get length() { return lager.size; } });

const bretter = teileBretter({ brett: 'holz', klangpaket: '' });
pruefe('Bretter: drei, alle frei, das gewählte ausgerüstet', bretter.length === 3 && bretter.every((x) => x.frei)
  && bretter.filter((x) => x.an).map((x) => x.id).join() === 'brett-holz');
const klaenge = teileKlaenge({ brett: 'nacht', klangpaket: '' });
pruefe('Klänge: Holz und Arcade frei, ohne Wahl gilt Arcade (Standard)', klaenge.length === 2 && klaenge.every((x) => x.frei)
  && klaenge.filter((x) => x.an).map((x) => x.id).join() === 'klang-arcade');

const leer = { bots: {} };
const e0 = teileErfolge(leer);
pruefe('Erfolge ohne Partie: neun, alle gesperrt, mit Weg dahin', e0.length === 9 && e0.every((x) => !x.frei && x.zeile)
  && e0.find((x) => x.id === 'erfolg-alle-bots').zeile === '0 von 30 besiegt');
const welt1 = BOTS.filter((b) => b.welt === 1);
const f1 = { bots: Object.fromEntries(welt1.map((b, i) => [b.id, { sterne: [true, i === 0, i === 0] }])) };
const e1 = teileErfolge(f1);
const frei = (id) => e1.find((x) => x.id === id).frei;
pruefe('Erfolge nach Welt 1: erster Sieg, drei Sterne, Welt 1 frei; Welt 2 und alle Bots nicht',
  frei('erfolg-erster-sieg') && frei('erfolg-drei-sterne') && frei('erfolg-welt-1') && !frei('erfolg-welt-2') && !frei('erfolg-alle-bots'));
const alle = e1.find((x) => x.id === 'erfolg-alle-bots');
pruefe('Fortschritt ehrlich: 6 von 30 Bots (0,2), Sterne nach Zahl', alle.zeile === '6 von 30 besiegt' && Math.abs(alle.fortschritt - 0.2) < 1e-9
  && e1.find((x) => x.id === 'erfolg-alle-sterne').zeile === `8 von ${BOTS.length * 3} Sternen`);
pruefe('Nichts zum Kaufen: kein Preis, kein Shop, keine Restzahl in den Erfolgen',
  !e1.some((x) => /€|kauf|shop|verfügbar|nur noch/i.test(x.name + ' ' + x.zeile)));

// Shop: Stand einer Edition als ruhiger Satz, die Zahl nur, wenn der Server sie schickt (nur bei erhaeltlich)
pruefe('Shop: Restzahl sieht bei 9 und bei 1 gleich aus', standText({ status: 'erhaeltlich', restzahl: 9, auflage: 10 }) === '9 von 10 verfügbar'
  && standText({ status: 'erhaeltlich', restzahl: 1, auflage: 10 }) === '1 von 10 verfügbar');
pruefe('Shop: ohne Restzahl vom Server keine Zahl', standText({ status: 'erhaeltlich', restzahl: null, auflage: 10 }) === 'Erhältlich');
pruefe('Shop: angekündigt mit Datum, ausverkauft, pausiert, beendet', standText({ status: 'angekuendigt', verkauf_ab: '2026-12-01T10:00:00Z', auflage: 10 }) === 'Verkauf ab 01.12.2026'
  && standText({ status: 'ausverkauft', auflage: 10 }) === 'Alle 10 vergeben' && standText({ status: 'pausiert' }) === 'Verkauf pausiert'
  && standText({ status: 'beendet' }) === 'Verkauf beendet');

// ---------------------------------------------------------------------------
// Browser-Teil (volle App, alle Pakete)
// ---------------------------------------------------------------------------
async function warteAufServer(url, ms = 10000) {
  const ende = Date.now() + ms;
  while (Date.now() < ende) {
    try { const r = await fetch(url); if (r.ok) return; } catch (e) { /* noch nicht da */ }
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
const token = (sub) => 'a.' + Buffer.from(JSON.stringify({ sub })).toString('base64url') + '.x';
const SITZUNG = { access_token: token('0f8b6c1e-2d3a-4b5c-8d9e-0a1b2c3d4e5f'), refresh_token: 'r1', expires_at: 9999999999,
  user: { id: '0f8b6c1e-2d3a-4b5c-8d9e-0a1b2c3d4e5f', email: 'probe@example.invalid' } };
const EDITION = { produkt_id: 'brett-mitternacht', name: 'Mitternacht & Gold', auflage: 10, status: 'erhaeltlich', restzahl: 9,
  verkauf_ab: '2026-11-28T10:00:00Z' };

// Shop mit gefaelschtem Server: edition_staende liefert [] ohne Altersangabe (wie supabase/werkstatt-schema.sql)
async function shopSeite(browser, { sitzung = null, server = {} } = {}) {
  const k = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', timezoneId: 'Europe/Berlin' });
  const s = await k.newPage();
  const srv = { ab18: false, editionen: [EDITION], ...server };
  const anfragen = [];
  const fehlerListe = [];
  s.on('pageerror', (e) => fehlerListe.push(e.message));
  await s.route(SUPA + '/**', async (r) => {
    const u = r.request().url();
    anfragen.push({ url: u, body: r.request().postData() });
    if (u.includes('/rpc/alter_angeben')) { srv.ab18 = true; return r.fulfill({ status: 204, body: '' }); }
    const body = u.includes('/rpc/edition_staende') ? (srv.ab18 ? srv.editionen : [])
      : u.includes('/rest/v1/altersangaben') ? (srv.ab18 ? [{ ab18: true }] : []) : {};
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await s.addInitScript(({ sitzung }) => {
    try {
      if (sessionStorage.getItem('probe-start')) return;
      sessionStorage.setItem('probe-start', '1');
      localStorage.clear();
      if (sitzung) localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(sitzung));
    } catch (e) { /* egal */ }
  }, { sitzung });
  await s.goto(BASIS + '#ich');
  await s.waitForSelector('.sa-screen', { timeout: 30000 });
  await s.locator('.sa-steuer .seg[data-wert="shop"]').click();
  await warte(500);
  return { k, s, srv, anfragen, fehlerListe };
}

async function shopTeil(browser) {
  // abgemeldet: ein Satz und der Weg zum Konto, keine Anfrage an den Server
  let p = await shopSeite(browser);
  let text = await p.s.locator('.sh-bereich').innerText();
  pruefe('Shop abgemeldet: Hinweis ab 18 und Weg zum Konto, keine Editionen-Anfrage', /ab 18 Jahren/.test(text) && /Zum Konto/.test(text)
    && !p.anfragen.some((a) => a.url.includes('edition_staende')), text);
  const zaehl = await p.s.evaluate(() => ({ stand: document.querySelector('.sa-stand').textContent, alle: document.querySelectorAll('.sa-teil').length,
    frei: document.querySelectorAll('.sa-teil:not([data-zustand="zu"])').length }));
  pruefe('Shop zählt nicht in „freigeschaltet“ mit', zaehl.stand === `${zaehl.frei} von ${zaehl.alle} freigeschaltet`, zaehl);
  await p.s.locator('.sh-bereich .knopf').click();
  await p.s.waitForSelector('.konto-gruppe', { timeout: 15000 }).catch(() => {});
  pruefe('Shop abgemeldet: „Zum Konto“ öffnet die Einstellungen mit der Konto-Gruppe', await p.s.locator('.konto-gruppe').count() === 1);
  pruefe('Shop abgemeldet: keine Seitenfehler', p.fehlerListe.length === 0, p.fehlerListe.join(' | '));
  await p.k.close();

  // angemeldet ohne Altersangabe: einmal fragen, danach die Edition
  p = await shopSeite(browser, { sitzung: SITZUNG });
  await p.s.waitForSelector('.sh-bereich .knopf', { timeout: 15000 });
  text = await p.s.locator('.sh-bereich').innerText();
  pruefe('Shop ohne Altersangabe: Frage und Knopf „Ich bin 18 oder älter“, noch keine Karte', /18 oder älter/.test(text)
    && await p.s.locator('.sh-karte').count() === 0, text);
  await p.s.locator('.sh-bereich .knopf').click();
  await p.s.waitForSelector('.sh-karte', { timeout: 15000 }).catch(() => {});
  const alter = p.anfragen.find((a) => a.url.includes('/rpc/alter_angeben'));
  pruefe('Shop: Altersangabe geht als { ab18: true } an den Server', !!alter && JSON.parse(alter.body || '{}').ab18 === true, alter);
  const karte = await p.s.evaluate(() => {
    const k = document.querySelector('.sh-karte');
    if (!k) return null;
    const kauf = k.querySelector('.sh-kaufen');
    return { produkt: k.dataset.produkt, name: k.querySelector('.sh-name').textContent, stand: k.querySelector('.sh-stand').textContent,
      text: k.innerText, kaufAus: kauf.disabled, kaufText: kauf.textContent.trim(), breit: k.scrollWidth <= k.clientWidth + 1 };
  });
  pruefe('Shop: Karte mit Name vom Server, „9 von 10 verfügbar“, Regel je Konto', !!karte && karte.produkt === 'brett-mitternacht'
    && karte.name === 'Mitternacht & Gold' && karte.stand === '9 von 10 verfügbar' && /Höchstens 1 Stück je Konto/.test(karte.text), karte);
  pruefe('Shop: Kaufknopf „Bald verfügbar“ und abgeschaltet, kein Preis', !!karte && karte.kaufAus && karte.kaufText === 'Bald verfügbar'
    && !/€|EUR|\d+,\d\d/.test(karte.text), karte);
  pruefe('Shop: Karte passt aufs Handy', !!karte && karte.breit && await p.s.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  await p.s.locator('.sh-anprobieren').click();
  await p.s.waitForSelector('.sheet-karte .sh-brett.gross', { timeout: 5000 }).catch(() => {});
  pruefe('Shop: Anprobieren zeigt das Brett groß im Blatt', await p.s.locator('.sheet-karte .sh-brett.gross').count() === 1);
  pruefe('Shop angemeldet: keine Seitenfehler', p.fehlerListe.length === 0, p.fehlerListe.join(' | '));
  await p.k.close();

  // angemeldet mit Altersangabe, aber nur unbekannte Produkte: ruhiger Satz statt leerer Karte
  p = await shopSeite(browser, { sitzung: SITZUNG, server: { ab18: true, editionen: [{ ...EDITION, produkt_id: 'figuren-unbekannt' }] } });
  await p.s.waitForFunction(() => /Vorbereitung/.test(document.querySelector('.sh-bereich')?.innerText || ''), null, { timeout: 15000 }).catch(() => {});
  text = await p.s.locator('.sh-bereich').innerText();
  pruefe('Shop: unbekanntes Produkt zeigt „in Vorbereitung“, keine Altersfrage', /in Vorbereitung/.test(text) && !/18 oder älter/.test(text), text);
  await p.k.close();
}

async function browserTeil() {
  const pw = ladePlaywright();
  const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: WURZEL, stdio: 'ignore' });
  let browser;
  try {
    await warteAufServer(`http://127.0.0.1:${PORT}/index.html`);
    browser = await browserTyp(pw).launch();
    for (const [name, width, height] of [['ipad-quer', 1180, 820], ['handy', 390, 844]]) {
      const k = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', timezoneId: 'Europe/Berlin' });
      const s = await k.newPage();
      const fehlerListe = [];
      s.on('pageerror', (e) => fehlerListe.push(e.message));
      s.on('console', (m) => { if (m.type() === 'error' || /unbekanntes Modul/.test(m.text())) fehlerListe.push(m.text()); });
      await s.goto(BASIS + '#arena');
      await s.waitForFunction(() => !!window.__app && !!document.querySelector('.screen'), null, { timeout: 30000 });
      await s.evaluate(() => localStorage.clear());
      await s.goto(BASIS + '#arena');
      await s.waitForFunction(() => !!window.__app && !!document.querySelector('.reiter-leiste'), null, { timeout: 30000 });
      await warte(800);
      const reiter = await s.evaluate(() => [...document.querySelectorAll('.reiter-leiste [data-reiter]')].map((x) => x.dataset.reiter).join());
      pruefe(`${name}: Reiter-Leiste mit „Ich“`, reiter.split(',').includes('ich'), reiter);
      await s.locator('.reiter-leiste [data-reiter="ich"]').first().click();
      await s.waitForSelector('.sa-screen', { timeout: 15000 });
      await warte(700);
      const bereiche = await s.evaluate(() => [...document.querySelectorAll('.sa-bereich')].map((x) => x.dataset.bereich).join());
      pruefe(`${name}: sieben Bereiche (Finisher, Emotes, Titel, Bretter, Klänge, Erfolge, Shop)`, bereiche === 'finisher,emotes,titel,bretter,klaenge,erfolge,shop', bereiche);
      const stand = await s.locator('.sa-stand').innerText();
      const zaehl = await s.evaluate(() => ({ alle: document.querySelectorAll('.sa-teil').length, frei: document.querySelectorAll('.sa-teil:not([data-zustand="zu"])').length }));
      pruefe(`${name}: Zähler „N von M freigeschaltet“ passt zu den Karten`, stand === `${zaehl.frei} von ${zaehl.alle} freigeschaltet` && zaehl.frei < zaehl.alle, { stand, zaehl });
      const fin = await s.evaluate(() => [...document.querySelectorAll('.sa-bereich[data-bereich="finisher"] .sa-teil')].map((x) => ({
        id: x.dataset.teil, z: x.dataset.zustand, schloss: !!x.querySelector('.sa-bild svg') && !x.querySelector('.sa-bild img'), zeile: x.querySelector('.sa-zeile').textContent })));
      pruefe(`${name}: Finisher Krone ausgewählt, Welle und König mit Schloss und Level`, fin.length === 3 && fin[0].z === 'an'
        && fin[1].z === 'zu' && fin[1].schloss && fin[1].zeile === 'Ab Level 5' && fin[2].zeile === 'Ab Level 10', fin);
      pruefe(`${name}: nur ein Bereich sichtbar`, await s.locator('.sa-bereich:not([hidden])').count() === 1);
      await s.locator('.sa-steuer .seg[data-wert="erfolge"]').click();
      await warte(400);
      pruefe(`${name}: Erfolge gewählt, Weg dahin sichtbar`, await s.locator('.sa-bereich[data-bereich="erfolge"]:not([hidden])').count() === 1
        && /Besiege einen Bot/.test(await s.locator('.sa-bereich[data-bereich="erfolge"]').innerText()));
      const quer = await s.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
      pruefe(`${name}: kein waagrechtes Scrollen der Seite`, quer);
      await s.reload();
      await s.waitForSelector('.sa-screen', { timeout: 15000 });
      pruefe(`${name}: gewählter Bereich bleibt nach dem Neuladen`, await s.locator('.sa-bereich[data-bereich="erfolge"]:not([hidden])').count() === 1);
      pruefe(`${name}: keine Konsolenfehler`, fehlerListe.length === 0, fehlerListe.join(' | '));
      await k.close();
    }
    await shopTeil(browser);
    // Englisch
    const k = await browser.newContext({ viewport: { width: 1180, height: 820 }, serviceWorkers: 'block' });
    const s = await k.newPage();
    await s.goto(`http://127.0.0.1:${PORT}/index.html?test&sprache=en#ich`);
    await s.waitForSelector('.sa-screen', { timeout: 30000 });
    const text = await s.locator('.sa-screen').innerText();
    pruefe('Englisch: Collection, unlocked, From level', /Collection/.test(text) && /of \d+ unlocked/.test(text) && /From level 5/.test(text), text.slice(0, 200));
    await k.close();
  } catch (e) {
    pruefe('Browser-Teil läuft durch', false, e.message);
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
}

if (!NUR_NODE) await browserTeil();
console.log(`${ok}/${ok + fehler} bestanden`);
process.exit(fehler ? 1 : 0);
