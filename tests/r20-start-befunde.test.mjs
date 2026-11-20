// Feinschliff R20, zwei Befunde aus dem Allround-Check der Live-App 365 (Auftrag fc-23:00, Bericht im Vault
// R20-Kritik/fable-check-1119/bericht.md, Nr. 1 und 2):
//  F1 Die Punkte der Einfuehrung sagten "Seite 3 von 3", danach kamen mit demselben Weiter aber noch die Regelfrage und
//     die Einstufung. Jetzt zaehlen die Punkte alle fuenf Schritte (w1, w2, w3, frage, einstufung).
//  F2 Wer die Einfuehrung ueberspringt, sah bei einem gesperrten Bot nur "Besiege zuerst ...", nichts von der Einstufung.
//     Jetzt oeffnet auch ein gesperrter Bot der offenen Welt seine Karte (wie die Vorschau-Welt), und unter dem Hinweis
//     bietet das Paket start (Ort arena:gesperrt) die Einstufung mit einem Knopf an. Die Freischalt-Regel bleibt.
//   node tests/r20-start-befunde.test.mjs            Node- und Browser-Teil (BILDER=<ordner> legt Bilder ab)
//   node tests/r20-start-befunde.test.mjs --nur-node nur der Node-Teil
import { ORTE } from '../js/orte.js';
import { DE, EN } from '../js/pakete/start/texte.js';
import * as L from '../js/pakete/start/logik.js';
import { t, setzeSprache } from '../js/sprache.js';
import '../js/sprachen/arena.js';

let ok = 0;
let fehler = 0;
function pruefe(name, bed, info) {
  if (bed) { ok++; console.log('  ok   ' + name); }
  else { fehler++; console.log('FEHLER ' + name + (info === undefined ? '' : ' -- ' + (typeof info === 'string' ? info : JSON.stringify(info)))); }
}

// ---------------------------------------------------------------------------
// Node: Ort und Texte
// ---------------------------------------------------------------------------
pruefe('Ort arena:gesperrt ist ein DOM-Ort', ORTE['arena:gesperrt'] === 'dom', ORTE['arena:gesperrt']);
const schluessel = ['sperre.text', 'sperre.knopf', 'sperre.empfehlung'];
pruefe('Texte des Angebots in DE und EN', schluessel.every((k) => typeof DE[k] === 'string' && DE[k] && typeof EN[k] === 'string' && EN[k]),
  schluessel.filter((k) => !DE[k] || !EN[k]));
pruefe('Das Angebot verspricht keine Freischaltung (Regel bleibt: Einstufung = Empfehlung und Probepartie)',
  schluessel.every((k) => !/freischalt|schaltet|unlock/i.test(DE[k] || '') && !/unlock/i.test(EN[k] || '')), schluessel.map((k) => DE[k]));
let statusDe = '';
let statusEn = '';
try { setzeSprache('de'); statusDe = t('arena.status.gesperrt'); setzeSprache('en'); statusEn = t('arena.status.gesperrt'); setzeSprache('de'); } catch (e) { statusDe = e.message; }
pruefe('Status "Gesperrt" fuer die Karte eines gesperrten Bots (DE/EN)', statusDe === 'Gesperrt' && statusEn === 'Locked', { statusDe, statusEn });

// eine echte Einstufung (8 Aufgaben, 4 richtig im ersten Versuch) in der Form des Modul-Speichers (logik.js normalisiereModul)
const fest = ['stufe-1', 'stufe-2', 'stufe-3', 'stufe-4', 'stufe-5', 'stufe-6', 'stufe-7', 'stufe-8'].map((id, i) => ({ id, richtig: i < 4, versuch: i < 4 ? 1 : 2 }));
const e = L.empfehlung({ ergebnisse: fest, hoechsteFrei: 1 });
const ergebnis = { punkte: e.punkte, geloest: e.geloest, ersterVersuch: e.ersterVersuch, gesamt: e.gesamt, je: e.je, botId: e.botId };
pruefe('Probe-Einstufung ergibt eine Empfehlung mit Bot', !!e.botId && Array.isArray(e.je), e);

// ---------------------------------------------------------------------------
// Browser: iPhone 13 (390), iPhone SE (375) und PC (1440), hell und dunkel
// ---------------------------------------------------------------------------
async function browserTeil() {
  const { createRequire } = await import('node:module');
  const http = await import('node:http');
  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const path = (await import('node:path')).default;
  const { browserTyp } = await import('./browser.mjs');
  const require = createRequire(import.meta.url);
  let pw = null;
  for (const p of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
    try { pw = require(p); break; } catch (e) { /* naechster */ }
  }
  if (!pw) { pruefe('Playwright gefunden', false); return; }
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
  const browser = await browserTyp(pw).launch();
  const bild = async (s, name) => { if (process.env.BILDER) { await warte(700); await s.screenshot({ path: path.join(process.env.BILDER, name + '.png') }); } };
  const seiteIst = (s, name) => s.waitForFunction((n) => document.querySelector('.st-screen')?.dataset.seite === n, name, { timeout: 10000 }).then(() => true, () => false);
  const punkte = (s) => s.evaluate(() => {
    const nav = document.querySelector('.st-punkte');
    const k = [...document.querySelectorAll('.st-punkte button')];
    const an = document.querySelector('.st-punkte [aria-current]');
    return { sichtbar: !!nav && !nav.hidden && nav.getClientRects().length > 0, anzahl: k.length, ziele: k.map((b) => b.dataset.ziel).join(),
      aktuell: an ? an.dataset.ziel : null, label: an ? an.getAttribute('aria-label') : null, quer: document.documentElement.scrollWidth > window.innerWidth + 1 };
  });
  const karte = (s) => s.evaluate(() => {
    const d = document.querySelector('.screen.arena .detail');
    const k = d && d.querySelector('.st-sperre-knopf');
    const r = k ? k.getBoundingClientRect() : null;
    return { h2: d?.querySelector('h2')?.textContent || '', ueber: d?.querySelector('.detail-ueber')?.textContent || '',
      hinweis: d?.querySelector('.sp-gesperrt')?.textContent || '', angebot: d?.querySelector('.st-sperre-text')?.textContent || '',
      knopf: k ? k.textContent.trim() : '', knopfGross: !!r && r.width >= 44 && r.height >= 44,
      spielen: d ? d.querySelectorAll('[data-aktion="spielen"]').length : -1, toast: document.querySelectorAll('.toast').length,
      farbe: d ? !!d.querySelector('.wahl-farbe:not([hidden])') : null, quer: document.documentElement.scrollWidth > window.innerWidth + 1 };
  });
  try {
    for (const [w, h, geraet] of [[390, 844, 'iphone13'], [375, 667, 'iphonese'], [1440, 900, 'pc']]) {
      for (const farbe of ['hell', 'dunkel']) {
        const lage = `${geraet} ${farbe}`;
        const touch = w < 700;
        const k = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch, serviceWorkers: 'block',
          colorScheme: farbe === 'dunkel' ? 'dark' : 'light', locale: 'de-DE', timezoneId: 'Europe/Berlin' });
        await k.route('**/*.supabase.co/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
        await k.addInitScript(() => { try { if (sessionStorage.getItem('sb-start')) return; sessionStorage.setItem('sb-start', '1'); localStorage.clear();
          localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ klang: false, bewegung: 'normal', figuren: 'cburnett' })); } catch (e) { /* egal */ } });
        const s = await k.newPage();
        const fehlerListe = [];
        s.on('pageerror', (e) => fehlerListe.push(e.message));
        const tippe = async (sel, timeout) => { const l = s.locator(sel).first(); if (touch) await l.tap({ timeout }); else await l.click({ timeout }); };

        // ---------- F1: Einfuehrung zaehlt alle Schritte ----------
        await s.goto(`http://127.0.0.1:${PORT}/index.html?test`);
        await s.waitForSelector('.st-screen .st-titel', { timeout: 45000 });
        const p1 = await punkte(s);
        pruefe(`${lage}: F1 Einfuehrung hat fuenf Punkte (w1, w2, w3, Frage, Einstufung), Seite 1 von 5`,
          p1.sichtbar && p1.anzahl === 5 && p1.ziele === 'w1,w2,w3,frage,einstufung' && p1.aktuell === 'w1' && p1.label === 'Seite 1 von 5' && !p1.quer, p1);
        await tippe('[data-st="weiter"]');
        await seiteIst(s, 'w2');
        await tippe('[data-st="weiter"]');
        await seiteIst(s, 'w3');
        const p3 = await punkte(s);
        pruefe(`${lage}: F1 Seite 3 sagt "Seite 3 von 5", nicht mehr "3 von 3"`, p3.aktuell === 'w3' && p3.label === 'Seite 3 von 5', p3);
        await bild(s, `f1-w3-${geraet}-${farbe}`);
        await tippe('[data-st="weiter"]');
        const istFrage = await seiteIst(s, 'frage');
        const p4 = await punkte(s);
        pruefe(`${lage}: F1 Regelfrage zeigt die Punkte, Seite 4 von 5`, istFrage && p4.sichtbar && p4.aktuell === 'frage' && p4.label === 'Seite 4 von 5' && !p4.quer, p4);
        await bild(s, `f1-frage-${geraet}-${farbe}`);
        await tippe('[data-st="ja"]');
        const istEin = await seiteIst(s, 'einstufung');
        const p5 = await punkte(s);
        pruefe(`${lage}: F1 Einstufung ist Seite 5 von 5 (der letzte Punkt)`, istEin && p5.sichtbar && p5.aktuell === 'einstufung' && p5.label === 'Seite 5 von 5' && !p5.quer, p5);
        await bild(s, `f1-einstufung-${geraet}-${farbe}`);
        await tippe('.st-punkte [data-ziel="w3"]', 5000).catch(() => {});
        pruefe(`${lage}: F1 Punkt antippen fuehrt von der Einstufung zurueck zu Seite 3`, await seiteIst(s, 'w3'));

        // ---------- F2: gesperrter Bot nennt den Weg zur Einstufung ----------
        if (!(await s.evaluate(() => !!document.querySelector('.st-raus')))) await s.evaluate(() => window.__app.gehe('start', { seite: 'w3' }));
        await tippe('.st-raus');
        await s.waitForFunction(() => document.documentElement.dataset.screen === 'heim', null, { timeout: 15000 }).catch(() => {});
        const vorher = await s.evaluate(() => localStorage.getItem('schach-arena:v1:fortschritt'));
        await s.evaluate(() => window.__app.gehe('arena'));
        await s.waitForSelector('.screen.arena .knoten[data-bot="hilde"]', { timeout: 20000 });
        await warte(500);
        await tippe('.screen.arena .knoten[data-bot="hilde"]');
        await s.waitForFunction(() => /Hilde/.test(document.querySelector('.screen.arena .detail h2')?.textContent || ''), null, { timeout: 5000 }).catch(() => {});
        if (touch) await s.evaluate(() => { const g = document.querySelector('.screen.arena .detail .karte-griff'); if (g && g.getAttribute('aria-expanded') !== 'true') g.click(); });
        await warte(500);
        const g1 = await karte(s);
        pruefe(`${lage}: F2 gesperrter Bot der offenen Welt oeffnet seine Karte (Status Gesperrt), statt Spielen der Hinweis "Gesperrt. Besiege zuerst Vogelscheuche Willi", keine Meldung`,
          /Hilde/.test(g1.h2) && /Gesperrt/.test(g1.ueber) && g1.hinweis.startsWith('Gesperrt. Besiege zuerst Vogelscheuche Willi') && g1.spielen === 0 && g1.toast === 0 && !g1.farbe, g1);
        pruefe(`${lage}: F2 darunter das Angebot der Einstufung mit Knopf "${DE['sperre.knopf']}" (mindestens 44 px), kein Querscrollen`,
          g1.angebot === DE['sperre.text'] && g1.knopf === DE['sperre.knopf'] && g1.knopfGross && !g1.quer, g1);
        await bild(s, `f2-offen-${geraet}-${farbe}`);
        // Vorschau-Welt: der bisherige Hinweis bleibt woertlich, das Angebot kommt dazu
        await tippe('.screen.arena .ww-pfeil[data-richtung="1"]');
        await s.waitForSelector('.screen.arena .knoten[data-bot="lisa"]', { timeout: 10000 }).catch(() => {});
        await warte(500);
        await tippe('.screen.arena .knoten[data-bot="lisa"]');
        await s.waitForFunction(() => /Lisa/.test(document.querySelector('.screen.arena .detail h2')?.textContent || ''), null, { timeout: 5000 }).catch(() => {});
        if (touch) await s.evaluate(() => { const g = document.querySelector('.screen.arena .detail .karte-griff'); if (g && g.getAttribute('aria-expanded') !== 'true') g.click(); });
        await warte(500);
        const g2 = await karte(s);
        pruefe(`${lage}: F2 Vorschau-Welt: Hinweis unveraendert "Besiege zuerst Janine vom Scheunenclub. Dann öffnet sich diese Welt.", dazu dasselbe Angebot`,
          g2.hinweis === 'Besiege zuerst Janine vom Scheunenclub. Dann öffnet sich diese Welt.' && g2.angebot === DE['sperre.text'] && g2.knopf === DE['sperre.knopf']
          && g2.spielen === 0 && g2.toast === 0 && /Vorschau/.test(g2.ueber), g2);
        await bild(s, `f2-vorschau-${geraet}-${farbe}`);
        await tippe('.screen.arena .detail .st-sperre-knopf');
        const zurEin = await seiteIst(s, 'einstufung');
        pruefe(`${lage}: F2 der Knopf fuehrt direkt zur Einstufung`, zurEin, await s.evaluate(() => [document.documentElement.dataset.screen, document.querySelector('.st-screen')?.dataset.seite]));
        await bild(s, `f2-ziel-${geraet}-${farbe}`);
        const nachher = await s.evaluate(() => localStorage.getItem('schach-arena:v1:fortschritt'));
        pruefe(`${lage}: F2 Freischalt-Regel unveraendert (Fortschritt vorher = nachher, Hilde weiter gesperrt)`, vorher === nachher, { vorher, nachher });
        // mit einer Empfehlung fuehrt der Knopf zur Empfehlung (wie in den Einstellungen)
        await s.evaluate((je) => {
          const P = 'schach-arena:v1:modul:start';
          const m = JSON.parse(localStorage.getItem(P) || '{}');
          m.einstufung = { tag: '2026-11-19', rechenstand: 1, ...je };
          localStorage.setItem(P, JSON.stringify(m));
          window.__app.gehe('arena');
        }, ergebnis);
        await s.waitForSelector('.screen.arena .knoten[data-bot="hilde"]', { timeout: 20000 });
        await warte(400);
        await tippe('.screen.arena .knoten[data-bot="hilde"]');
        await warte(600);
        const g3 = await karte(s);
        pruefe(`${lage}: F2 nach einer Einstufung heisst der Knopf "${DE['sperre.empfehlung']}"`, g3.knopf === DE['sperre.empfehlung'], g3);
        await tippe('.screen.arena .detail .st-sperre-knopf');
        pruefe(`${lage}: F2 ... und fuehrt zur Empfehlung`, await seiteIst(s, 'empfehlung'));
        pruefe(`${lage}: keine Seitenfehler`, fehlerListe.length === 0, fehlerListe);
        await k.close();
      }
    }
  } catch (e) {
    pruefe('Browser-Teil laeuft durch', false, e.message);
  } finally {
    await browser.close();
    server.close();
  }
}
if (!process.argv.includes('--nur-node')) await browserTeil();

console.log(`${ok}/${ok + fehler} bestanden`);
process.exit(fehler ? 1 : 0);
