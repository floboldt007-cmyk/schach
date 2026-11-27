// Auftrag E-18:31 (G-010 AC-03 Teil A): Flos Antworten vom 20.11.2026, Punkte 1, 2, 3, 4 und 10 (jeweils die Empfehlung,
// Quelle: Vault "Flos Antworten 2026-11-20.md", Befunde in R20-Kritik/erste-minuten und R20-Kritik/lektionen-schach).
//   1  nach einer Niederlage heisst der Knopf "Revanche" statt "Nochmal" (Lisa sagt "Willst du Revanche?")
//   2  die freie Partie zeigt keine Punktezeile ("Freie Partie: zählt für keine Tafel" neben 100 bis 800 Punkten)
//   3  Lernen: "Öffnen" (Meisterschule) ist der eine Hauptknopf, "Lösen" (Tagesrätsel) zweitrangig
//   4  die langen Grundmatts (Ziel laut Tablebase) fragen "Schaffst du es in N Zügen?", die Zahl aus den Daten
//   10 startet die Engine ohne Internet nicht: "Ohne Internet spielt der Bot im Sparmodus. ..." (DE und EN); mit Netz
//      bleibt die alte Meldung
//
//   node tests/r26-antworten-a.test.mjs
//   BILDER=<ordner> PHASE=vorher|nachher node tests/r26-antworten-a.test.mjs    je Punkt ein Bild (iPhone 13, dunkel)
//   PORT=9794 node tests/r26-antworten-a.test.mjs                               Port des Testservers (sonst: frei)
//
// Playwright: PLAYWRIGHT_PFAD, sonst 'playwright', sonst /opt/node-tools/node_modules/playwright.
import http from 'node:http';
import { appHeute } from './app-heute.mjs';
import path from 'node:path';
import { readFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..') + path.sep;
let pw = null;
for (const k of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
  try { pw = require(k); break; } catch (e) { /* naechster */ }
}
if (!pw) throw new Error('Playwright fehlt (PLAYWRIGHT_PFAD setzen)');

const BILDER = process.env.BILDER || '';
const PHASE = process.env.PHASE || 'nachher';
if (BILDER) mkdirSync(BILDER, { recursive: true });

let gesamt = 0, ok = 0;
function pruefe(name, gut, detail = '') {
  gesamt++; if (gut) ok++;
  const d = typeof detail === 'string' ? detail : JSON.stringify(detail);
  console.log(`${gut ? 'ok    ' : 'FEHLER'} ${name}${!gut && d ? ' ' + d : ''}`);
}

const typen = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' };
const server = http.createServer((req, res) => {
  const p = path.resolve(WURZEL, '.' + decodeURIComponent(new URL(req.url, 'http://test').pathname).replace(/\/$/, '/index.html'));
  if (!p.startsWith(WURZEL)) { res.writeHead(403); res.end(); return; }
  try { res.writeHead(200, { 'Content-Type': typen[path.extname(p)] || 'application/octet-stream' }); res.end(readFileSync(p)); }
  catch (e) { res.writeHead(404); res.end(); }
});
const PORT = Number(process.env.PORT) || await (await import('./freier-port.mjs')).freierPort();
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
const HOST = `http://127.0.0.1:${PORT}/`;
const P = 'schach-arena:v1:';
const PS = '.screen.partie:not(.online-screen)';

const browser = await pw.chromium.launch();
// T-072: "heute" wie die App (js/tag.js, Tagesgrenze 4 Uhr), nicht das UTC-Datum
const HEUTE = await appHeute(browser, HOST, { timezoneId: 'Europe/Berlin' });
const fehler = [];
// iPhone 13, dunkel. offline: navigator.onLine meldet false und die Engine-Dateien laden nicht (erster Besuch ohne Netz,
// nichts im Cache); engineWeg: nur die Engine-Dateien fehlen, das Geraet ist online
async function seite({ sprache = 'de', offline = false, engineWeg = false } = {}) {
  const k = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, colorScheme: 'dark',
    serviceWorkers: 'block', timezoneId: 'Europe/Berlin' });
  await k.route('**/*', (r) => {
    const u = new URL(r.request().url());
    if (u.hostname !== '127.0.0.1') return r.abort();
    if ((offline || engineWeg) && u.pathname.includes('/vendor/stockfish/')) return r.abort('internetdisconnected');
    return r.continue();
  });
  await k.addInitScript(({ sp, offline }) => {
    if (offline) Object.defineProperty(Navigator.prototype, 'onLine', { get: () => false, configurable: true });
    if (sessionStorage.getItem('vorbelegt')) return; sessionStorage.setItem('vorbelegt', '1');
    for (const [s, w] of Object.entries(sp)) localStorage.setItem(s, typeof w === 'string' ? w : JSON.stringify(w));
  }, { offline, sp: { [P + 'modul:start']: { gesehen: HEUTE }, [P + 'hinweis-installieren']: '1',
    [P + 'einstellungen']: { sprache, spracheGewaehlt: true, modus: 'dunkel' } } });
  const s = await k.newPage();
  s.on('pageerror', (e) => fehler.push(e.message));
  await s.goto(HOST + '?test#heim');
  await s.waitForFunction(() => !!window.__app, null, { timeout: 15000 });
  // die Startseite fertig aufbauen lassen: ein Sprung gleich nach dem Laden fuehrt sonst die Partie zur Arena (Router-Start)
  await s.waitForTimeout(2500);
  return { k, s };
}
async function bild(s, name, el = null) {
  if (!BILDER) return;
  const datei = path.join(BILDER, `${name}-${PHASE}.png`);
  if (el) await s.locator(el).first().screenshot({ path: datei }).catch(() => s.screenshot({ path: datei }));
  else await s.screenshot({ path: datei });
}
const warteFlo = (s) => s.waitForFunction(() => window.__partie && window.__partie.bereit === true && window.__partie.phase() === 'flo',
  null, { timeout: 30000 }).catch(() => {});

// ---------- 1 und 2: freie Partie gegen Lisa, ein Zug, aufgeben ----------
{
  const { k, s } = await seite();
  await s.evaluate(() => { localStorage.removeItem('schach-arena:v1:laufend'); window.__app.gehe('partie', { botId: 'lisa', farbe: 'w', modus: 'frei' }); });
  await warteFlo(s);
  for (const f of ['e2', 'e4']) await s.locator(`${PS} .brett-felder .feld[data-feld="${f}"]`).click({ timeout: 5000 }).catch(() => {});
  await s.waitForFunction(() => window.__partie && window.__partie.chess().history().length >= 2, null, { timeout: 30000 }).catch(() => {});
  await warteFlo(s);
  const knopf = s.locator('.spielknoepfe > [data-aktion="aufgeben"]');
  if (await knopf.evaluate((el) => el.classList.contains('halte-knopf')).catch(() => false)) { await knopf.focus(); await s.keyboard.press('Enter'); }
  else await knopf.click({ timeout: 5000 }).catch(() => {});
  await s.locator('.dialog-knoepfe .knopf.gefahr').click({ timeout: 10000 }).catch(() => {});
  const da = await s.waitForSelector('.ergebnis-overlay.gefuellt .erg-knoepfe [data-ziel]', { timeout: 20000 }).then(() => true).catch(() => false);
  await s.waitForFunction(() => !document.querySelector('.ergebnis-overlay .erg-rechnet'), null, { timeout: 20000 }).catch(() => {});
  await s.waitForTimeout(1500);
  const r = await s.evaluate(() => {
    const o = document.querySelector('.ergebnis-overlay');
    const b = o && o.querySelector('.erg-knoepfe [data-ziel="ab-hier"], .erg-knoepfe [data-ziel="nochmal"]');
    return { niederlage: !!o && o.classList.contains('niederlage'), knopf: b ? b.textContent.replace(/\s+/g, ' ').trim() : null,
      punkte: o ? o.querySelectorAll('[data-zeile="punkte"]').length : -1,
      tafelSatz: o ? /zählt für keine Tafel/.test(o.textContent) : null };
  });
  pruefe('1 freie Partie verloren: der Knopf heisst "Revanche"', da && r.niederlage && r.knopf === 'Revanche', r);
  pruefe('2 freie Partie: keine Punktezeile und kein Satz "zählt für keine Tafel"', da && r.punkte === 0 && r.tafelSatz === false, r);
  await bild(s, '1-revanche');
  await bild(s, '2-punktezeile', '.ergebnis-overlay .ergebnis-karte');
  await k.close();
}

// ---------- 3: Lernen, ein Hauptknopf ----------
{
  const { k, s } = await seite();
  await s.evaluate(() => window.__app.gehe('training'));
  await s.waitForSelector('.ms-oeffnen', { timeout: 15000 }).catch(() => {});
  await s.waitForSelector('.tr-karte .tr-los', { timeout: 15000 }).catch(() => {});
  await s.waitForTimeout(800);
  const r = await s.evaluate(() => {
    const o = document.querySelector('.ms-oeffnen');
    const l = document.querySelector('.tr-karte .tr-los');
    return { oeffnen: !!o && o.classList.contains('primaer'), loesen: l ? l.classList.contains('primaer') : null,
      loesenText: l ? l.textContent.trim() : null };
  });
  pruefe('3 Lernen: "Öffnen" ist Hauptknopf, "Lösen" zweitrangig (ohne primaer)', r.oeffnen && r.loesen === false && r.loesenText === 'Lösen', r);
  await bild(s, '3-lernen');
  await k.close();
}

// ---------- 4: Ziel-Text der langen Grundmatts ----------
{
  const { k, s } = await seite();
  const ziele = await s.evaluate(async () => {
    const { LEKTIONEN } = await import('/js/pakete/lernen/mattbilder.js');
    return Object.fromEntries(LEKTIONEN.map((l) => [l.id, l.ziel]));
  });
  const text = async (id) => {
    await s.evaluate((i) => window.__app.gehe('lektion', { id: i }), id);
    await s.waitForFunction((i) => window.__lektion && window.__lektion.zustand().offen && window.__lektion.zustand().id === i, id, { timeout: 15000 }).catch(() => {});
    await s.waitForTimeout(400);
    return s.evaluate(() => (document.querySelector('.ls-ziel') || {}).textContent || null);
  };
  for (const id of ['turm', 'zwei-laeufer', 'laeufer-springer']) {
    const t = await text(id);
    pruefe(`4 ${id}: "Schaffst du es in ${ziele[id]} Zügen?" (Zahl aus den Daten)`, t === `Schaffst du es in ${ziele[id]} Zügen?`, { t, ziel: ziele[id] });
    if (id === 'turm' && BILDER) {
      // im Intro deckt der Text der Idee den Zaehler zu: erst nach "Los geht's" steht das Ziel im Bild
      await s.locator('[data-a="los"]').first().click({ timeout: 5000 }).catch(() => {});
      await s.waitForTimeout(1200);
      await bild(s, '4-raetsel-text');
    }
  }
  const d = await text('dame');
  pruefe('4 Gegenprobe dame (kein langes Grundmatt): "Matt in N Zügen ist möglich" bleibt', d === `Matt in ${ziele.dame} Zügen ist möglich`, { d });
  await k.close();
}

// ---------- 10: Engine startet nicht ----------
const MELDUNG = {
  de: 'Ohne Internet spielt der Bot im Sparmodus. Die Zugbewertung kommt zurück, sobald du wieder online bist.',
  en: 'Without internet, the bot plays in saver mode. Move ratings come back as soon as you are online again.',
  alt: 'Die Schach-Engine startet nicht. Der Bot spielt ohne sie, die Bewertung fehlt.',
};
async function engineMeldung(opt) {
  const { k, s } = await seite(opt);
  const gesehen = [];
  await s.exposeFunction('__toastGesehen', (t) => gesehen.push(t));
  await s.evaluate(() => new MutationObserver(() => {
    const t = document.querySelector('.toast-ort .toast');
    if (t) window.__toastGesehen((t.classList.contains('fehler') ? 'fehler: ' : 'info: ') + t.textContent);
  }).observe(document.body, { childList: true, subtree: true, characterData: true }));
  await s.evaluate(() => { localStorage.removeItem('schach-arena:v1:laufend'); window.__app.gehe('partie', { botId: 'lisa', farbe: 'w', modus: 'frei' }); });
  await s.waitForFunction(() => window.__partie && window.__partie.bereit === true, null, { timeout: 30000 }).catch(() => {});
  await s.waitForTimeout(600);
  return { k, s, gesehen };
}
{
  const { k, s, gesehen } = await engineMeldung({ offline: true });
  pruefe('10 ohne Internet (DE): Sparmodus-Text als ruhige Info statt Fehler "Schach-Engine startet nicht"',
    gesehen.includes('info: ' + MELDUNG.de) && !gesehen.some((g) => g.endsWith(MELDUNG.alt)), gesehen);
  await bild(s, '10-offline-text');
  await k.close();
}
{
  const { k, gesehen } = await engineMeldung({ offline: true, sprache: 'en' });
  pruefe('10 ohne Internet (EN): saver-mode text', gesehen.includes('info: ' + MELDUNG.en), gesehen);
  await k.close();
}
{
  const { k, gesehen } = await engineMeldung({ engineWeg: true });
  pruefe('10 Gegenprobe online, Engine fehlt trotzdem: die alte, ehrliche Fehlermeldung bleibt',
    gesehen.includes('fehler: ' + MELDUNG.alt) && !gesehen.some((g) => g.endsWith(MELDUNG.de)), gesehen);
  await k.close();
}

pruefe('keine Seitenfehler', fehler.length === 0, fehler);
await browser.close(); server.close();
console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
