// Paket Emotes: Daten, Bot-Antworten und Speicher ohne Browser, dazu ein Browser-Teil (Playwright):
//   node tests/emotes.test.mjs            Node und Browser
//   node tests/emotes.test.mjs --nur-node nur der Node-Teil
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { setzeSpeicher, MODUL_BUDGET, speichereModulEinstellungen } from '../js/storage.js';
import { EMOTES, SPERRZEIT, ANTWORTEN_MAX, ARTEN, ANTWORT_ART, ANTWORT_JE_ART, SPEICHER, antwortText, einstellungen } from '../js/pakete/emotes/index.js';
import { DE, EN } from '../js/pakete/emotes/texte.js';
import { setzeSprache, t } from '../js/sprache.js';
import { ZUGKLASSEN } from '../js/zugklassen.js';
import { alleBots } from '../js/bots.js';
import { browserTyp } from './browser.mjs';

const require = createRequire(import.meta.url);
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8913);
const BASIS = `http://127.0.0.1:${PORT}/index.html?test&kern&erw=pakete/emotes/index`;
const NUR_NODE = process.argv.includes('--nur-node');
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

let ok = 0; let fehler = 0;
function pruefe(name, wert, info = '') { if (wert) { ok++; console.log('ok   ' + name); } else { fehler++; console.log('FEHLER ' + name + ' ' + (typeof info === 'string' ? info : JSON.stringify(info))); } }
const quelle = readFileSync(new URL('../js/pakete/emotes/index.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../css/pakete/emotes.css', import.meta.url), 'utf8');

// ---------------------------------------------------------------------------
// Node-Teil
// ---------------------------------------------------------------------------
pruefe('Rad hat acht eigene SVG-Emotes', EMOTES.length === 8 && new Set(EMOTES.map((e) => e[0])).size === 8 && EMOTES.every((e) => /<path|<circle/.test(e[1])));
pruefe('Kein Spott-Emote im Rad, Applaus ist dabei, Knopf-Symbol ist nicht mehr das Lachen',
  !EMOTES.some(([id]) => /lach|wein|gaehn/.test(id)) && EMOTES.some(([id]) => id === 'applaus') && !/icon\('lachen'\)/.test(quelle));
pruefe('Schnell-Chat ohne "Oh nein!", dafuer "Ich überlege kurz."', !Object.values({ ...DE, ...EN }).some((v) => /oh nein|oh no/i.test(v)) && DE['chat.2'] === 'Ich überlege kurz.');
pruefe('Sperrzeit ist drei Sekunden', SPERRZEIT === 3000 && /jetzt - zuletzt < SPERRZEIT/.test(quelle));
pruefe('Bot antwortet verzoegert ueber die Partie-Buehne', /buehne\.spaeter/.test(quelle) && /em-botantwort/.test(quelle));
pruefe('Aus blendet beide Aktionsknoepfe aus', /if \(!einstellungen\(\)\.an\) return null/.test(quelle));
pruefe('Tastatur, Dialog und Vorlesen sind angebunden', /aria-haspopup/.test(quelle) && /aria-live/.test(quelle) && /e\.key === 'Escape'/.test(quelle));
pruefe('Vorlese-Text nutzt die Klasse sr aus app.css und wird wieder geleert',
  /className = 'em-live sr'/.test(quelle) && !/sr-only/.test(quelle) && /\.sr \{[^}]*width: 1px/.test(readFileSync(path.join(WURZEL, 'css/app.css'), 'utf8'))
  && /live\.textContent = ''/.test(quelle));
pruefe('Deutsch und Englisch sind vollstaendig', Object.keys(DE).length === Object.keys(EN).length && Object.keys(DE).every((k) => typeof EN[k] === 'string'));
pruefe('Kein freier Texteingang', !/<input[^>]+type=["']text|textarea/i.test(quelle));
pruefe('Handy und reduzierte Bewegung sind gestaltet', /max-width: 420px/.test(css) && /prefers-reduced-motion/.test(css) && /calc\(100% - 20px\)/.test(css));

// Speicher: das reservierte Budget 'ausdruck', beide Schalter kommen nach dem Laden zurueck
{
  const daten = new Map();
  setzeSpeicher({ getItem: (k) => (daten.has(k) ? daten.get(k) : null), setItem: (k, v) => daten.set(k, String(v)), removeItem: (k) => daten.delete(k), key: (i) => [...daten.keys()][i] ?? null, get length() { return daten.size; } });
  pruefe('Einstellungen liegen im Modul ausdruck (MODUL_BUDGET)', SPEICHER === 'ausdruck' && Object.hasOwn(MODUL_BUDGET, SPEICHER));
  pruefe('Standard: an, nicht gedaempft', einstellungen().an === true && einstellungen().daempfen === false);
  const r = speichereModulEinstellungen(SPEICHER, { an: false, daempfen: true });
  pruefe('Speichern gelingt', r.ok === true, r);
  pruefe('Beide Schalter gelten nach dem Laden', einstellungen().an === false && einstellungen().daempfen === true);
  pruefe('Schluessel steht im Speicher', [...daten.keys()].some((k) => /einstellungen:ausdruck$/.test(k)), [...daten.keys()]);
}

// Bot-Antworten: nach der Art der Eingabe, nie Lob oder Zugklasse auf ein Missgeschick, hoechstens 3 je Partie
{
  const eingaben = [...EMOTES.map(([id]) => 'emote.' + id), ...Array.from({ length: 6 }, (_, i) => 'chat.' + i)];
  pruefe('Jede Eingabe hat eine Art', eingaben.every((e) => ARTEN[e] && ANTWORT_ART[ARTEN[e]]), eingaben.filter((e) => !ARTEN[e]));
  pruefe('Uff ist ein Missgeschick und bekommt Trost', ARTEN['emote.uff'] === 'missgeschick' && ANTWORT_ART.missgeschick === 'trost');
  pruefe('Gruss ergibt Gruss, Dank ergibt Dank', ARTEN['emote.hallo'] === 'gruss' && ANTWORT_ART.gruss === 'gruss' && ARTEN['chat.4'] === 'dank' && ANTWORT_ART.dank === 'dank');
  pruefe('Hoechstens drei Antworten je Partie', ANTWORTEN_MAX === 3 && /nr >= ANTWORTEN_MAX\) return/.test(quelle));
  for (const art of new Set(Object.values(ANTWORT_ART))) {
    pruefe(`Antworten "${art}" in DE und EN vorhanden`, Array.from({ length: ANTWORT_JE_ART }, (_, i) => `antwort.${art}.${i}`).every((k) => DE[k] && EN[k]));
  }
  // Namen der Zugklassen in beiden Sprachen (Lob sieht sonst wie eine Bewertung aus)
  const klassen = [];
  for (const s of ['de', 'en']) { setzeSprache(s); for (const k of ZUGKLASSEN) klassen.push(k.name.toLowerCase()); }
  setzeSprache('de');
  const LOB = /gut|guter|stark|sauber|präzise|toll|super|nice|good|great|clean|strong|precise|well played|respekt|respect/i;
  const fehlerListe = [];
  for (const s of ['de', 'en']) {
    setzeSprache(s);
    for (const bot of alleBots()) {
      for (const e of eingaben) {
        for (let nr = 0; nr < ANTWORTEN_MAX; nr++) {
          const text = antwortText(e, bot, nr);
          if (!text || text.startsWith('p-emotes.')) fehlerListe.push(`${s} ${bot.id} ${e}: fehlt`);
          const klein = text.toLowerCase();
          if (klassen.some((k) => klein.includes(k))) fehlerListe.push(`${s} ${bot.id} ${e}: Zugklasse "${text}"`);
          if (ARTEN[e] === 'missgeschick' && LOB.test(text)) fehlerListe.push(`${s} ${bot.id} ${e}: Lob "${text}"`);
          const erwartet = ANTWORT_ART[ARTEN[e]];
          const erlaubt = Array.from({ length: ANTWORT_JE_ART }, (_, i) => t(`p-emotes.antwort.${erwartet}.${i}`));
          if (!erlaubt.includes(text)) fehlerListe.push(`${s} ${bot.id} ${e}: falsche Art "${text}"`);
        }
      }
    }
  }
  setzeSprache('de');
  pruefe(`Antworten aller ${alleBots().length} Bots passen zur Eingabe, ohne Lob auf ein Missgeschick und ohne Zugklasse`, fehlerListe.length === 0, fehlerListe.slice(0, 5));
}

// ---------------------------------------------------------------------------
// Browser-Teil
// ---------------------------------------------------------------------------
function ladePlaywright() {
  for (const k of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
    try { return require(k); } catch (e) { /* naechster */ }
  }
  throw new Error('Playwright nicht gefunden (PLAYWRIGHT_PFAD setzen)');
}
async function warteAufServer(url, ms = 10000) {
  const ende = Date.now() + ms;
  while (Date.now() < ende) {
    try { const r = await fetch(url); if (r.ok) return; } catch (e) { /* noch nicht da */ }
    await warte(150);
  }
  throw new Error('Server startet nicht: ' + url);
}
async function oeffne(seite, hash) {
  await seite.goto(BASIS + hash);
  await seite.waitForFunction(() => !!window.__app && !!document.querySelector('link[data-paket="emotes"]') && !!document.querySelector('.screen'), null, { timeout: 20000 });
}
async function partie(seite) {
  await seite.evaluate(() => window.__app.gehe('partie', { botId: 'benno' }));
  await seite.waitForSelector('.partie .ort-aktionen, .partie', { timeout: 20000 });
  await warte(400);
}
async function waehle(seite, art, wert) {
  await seite.locator(`.em-aktion[data-emote-aktion="${art}"]`).click();
  await seite.locator(`.em-popup .em-wahl[data-wert="${wert}"]`).click();
}

async function browserTeil(browser) {
  const kontext = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', timezoneId: 'Europe/Berlin' });
  const seite = await kontext.newPage();
  const warnungen = [];
  const seitenfehler = [];
  seite.on('console', (m) => { if (/unbekanntes Modul/.test(m.text())) warnungen.push(m.text()); });
  seite.on('pageerror', (e) => seitenfehler.push(e.message));
  await oeffne(seite, '#arena');
  await seite.evaluate(() => localStorage.clear());

  // 1) Emote senden: der Vorlese-Text ist visuell versteckt, die Antwort ist Trost, der Text leert sich wieder
  await oeffne(seite, '#arena');
  await partie(seite);
  pruefe('Browser: Partie zeigt beide Knoepfe', await seite.locator('.em-aktion').count() === 2);
  await seite.evaluate(() => {
    window.__emAntworten = [];
    new MutationObserver((liste) => { for (const m of liste) for (const n of m.addedNodes) if (n.classList && n.classList.contains('em-botantwort')) window.__emAntworten.push(n.textContent); })
      .observe(document.body, { childList: true, subtree: true });
  });
  await waehle(seite, 'emotes', 'uff');
  const live = await seite.evaluate(() => {
    const e = document.querySelector('.em-live');
    if (!e) return null;
    const r = e.getBoundingClientRect();
    const st = getComputedStyle(e);
    return { text: e.textContent, klasse: e.className, w: r.width, h: r.height, pos: st.position, ueberlauf: st.overflow };
  });
  pruefe('Browser: .em-live ist visuell versteckt (1 px, abgeschnitten) und traegt den Text fuer Vorleser',
    !!live && live.w <= 1 && live.h <= 1 && live.pos === 'absolute' && live.ueberlauf === 'hidden' && /gesendet/.test(live.text), live);
  await warte(1300);
  const trost = Array.from({ length: ANTWORT_JE_ART }, (_, i) => DE[`antwort.trost.${i}`]);
  const erste = await seite.evaluate(() => window.__emAntworten.slice());
  pruefe('Browser: Antwort auf "Uff" ist Trost', erste.length === 1 && trost.includes(erste[0]), erste);
  // Schnell-Chat hat keine Sperrzeit: vier weitere Saetze, es bleibt bei drei Antworten insgesamt
  for (const wert of ['0', '4', '2', '5']) { await waehle(seite, 'chat', wert); await warte(150); }
  await warte(1500);
  const alle = await seite.evaluate(() => window.__emAntworten.slice());
  pruefe('Browser: hoechstens drei Bot-Antworten je Partie', alle.length === ANTWORTEN_MAX, alle);
  pruefe('Browser: Gruss ergibt Gruss, Dank ergibt Dank', alle[1] && /^antwort\.gruss\./.test(Object.keys(DE).find((k) => DE[k] === alle[1]) || '')
    && alle[2] && /^antwort\.dank\./.test(Object.keys(DE).find((k) => DE[k] === alle[2]) || ''), alle);
  await warte(4500);
  const leer = await seite.evaluate(() => (document.querySelector('.em-live') || {}).textContent);
  pruefe('Browser: Vorlese-Text ist nach kurzer Zeit wieder leer', leer === '', leer);

  // 2) Schalter aus, neu laden: bleibt aus, Partie ohne Emote-Knoepfe und ohne Vorlese-Zeile
  await oeffne(seite, '#einstellungen');
  await seite.waitForSelector('.em-einstellungen input[data-em-einst="an"]', { timeout: 20000 });
  await seite.locator('.em-einstellungen input[data-em-einst="an"]').uncheck();
  await seite.locator('.em-einstellungen input[data-em-einst="daempfen"]').check();
  const schluessel = await seite.evaluate(() => Object.keys(localStorage).filter((k) => /ausdruck|emotes/.test(k)).map((k) => k + '=' + localStorage.getItem(k)));
  pruefe('Browser: Schalter werden unter ausdruck gespeichert', schluessel.length === 1 && /einstellungen:ausdruck=/.test(schluessel[0]) && /"an":false/.test(schluessel[0]) && /"daempfen":true/.test(schluessel[0]), schluessel);
  await seite.reload();
  await seite.waitForSelector('.em-einstellungen input[data-em-einst="an"]', { timeout: 20000 });
  const nachher = await seite.evaluate(() => ({ an: document.querySelector('.em-einstellungen input[data-em-einst="an"]').checked, daempfen: document.querySelector('.em-einstellungen input[data-em-einst="daempfen"]').checked }));
  pruefe('Browser: nach dem Neuladen bleibt "Emotes und Schnell-Chat" aus und "dämpfen" an', nachher.an === false && nachher.daempfen === true, nachher);
  await partie(seite);
  const inPartie = await seite.evaluate(() => ({ knoepfe: document.querySelectorAll('.em-aktion, [data-emote-aktion]').length, live: document.querySelectorAll('.em-live').length, partie: !!document.querySelector('.partie') }));
  pruefe('Browser: Partie ohne Emote-Knoepfe und ohne Vorlese-Zeile', inPartie.partie && inPartie.knoepfe === 0 && inPartie.live === 0, inPartie);
  pruefe('Browser: keine Warnung "unbekanntes Modul"', warnungen.length === 0, warnungen.slice(0, 2));
  pruefe('Browser: keine Seitenfehler', seitenfehler.length === 0, seitenfehler.slice(0, 2));
  await kontext.close();
}

let code = 1;
let server = null;
let browser = null;
try {
  if (!NUR_NODE) {
    server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: WURZEL, stdio: 'ignore' });
    await warteAufServer(`http://127.0.0.1:${PORT}/index.html`);
    browser = await browserTyp(ladePlaywright()).launch();
    await browserTeil(browser);
  }
  code = fehler ? 1 : 0;
} catch (e) {
  console.error(e);
  code = 1;
} finally {
  if (browser) await browser.close();
  if (server) server.kill();
}
console.log(`\n${ok}/${ok + fehler} bestanden`);
process.exit(code);
