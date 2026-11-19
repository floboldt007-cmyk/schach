// Englisch-Durchgang (R20, 20.11.2026): Gast mit Sprache EN auf iPhone 13 und PC, durch die Hauptwege der App.
// Je Seite: sichtbarer Text + vorgelesene Attribute gegen deutsche Woerter (Wortliste aus den DE-Texten, ohne Woerter,
// die auch im Englischen stehen), Umlaute, "undefined"/"NaN"/"[object", nackte Text-Schluessel und abgeschnittene
// Zeilen (Text laeuft ueber den Rand eines Elements, das ihn verdeckt). Anlass: der Allround-Check brach vorher ab.
// Shop und Premium werden nur gemeldet (gesperrt), sie machen den Test nicht rot.
//   node tests/en-rest.test.mjs            BILDER=<ordner> fuer Bildschirmfotos
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { browserTyp } from './browser.mjs';

const require = createRequire(import.meta.url);
const WURZEL = fileURLToPath(new URL('../', import.meta.url));
const PORT = Number(process.env.PORT) || await (await import('./freier-port.mjs')).freierPort();
const BASIS = `http://127.0.0.1:${PORT}/index.html?test&sprache=en`;
const BILDER = process.env.BILDER || '';
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

function ladePlaywright() {
  for (const k of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
    try { return require(k); } catch (e) { /* naechster */ }
  }
  throw new Error('Playwright nicht gefunden (PLAYWRIGHT_PFAD setzen)');
}
const pw = ladePlaywright();
const ohneTyp = ({ defaultBrowserType: _x, ...d }) => d;
const GERAETE = {
  iphone13: { ...ohneTyp(pw.devices['iPhone 13']), locale: 'en-US' },
  pc: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, locale: 'en-US' },
};
// Mattzug Ta1-a8 fuer das Ergebnisblatt
const MATT_IN_1 = '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1';

let ok = 0;
const fehler = [];
const meldungen = [];
const pruefe = (name, bed, info = '') => {
  if (bed) ok++;
  else fehler.push(`FEHLER ${name} ${typeof info === 'string' ? info : JSON.stringify(info)}`);
};

// Laeuft in der Seite: findet Reste auf dem sichtbaren Bildschirm (ganzer body, auch Blaetter und Dialoge)
async function reste(s) {
  return s.evaluate(async () => {
    if (!window.__enWorte) {
      const { texte } = await import('/js/sprache.js');
      const { BOTS } = await import('/js/bots.js');
      const worte = (o) => new Set(Object.values(o).join(' ').toLowerCase().match(/\p{L}{4,}/gu) || []);
      const de = texte('de');
      const en = worte(texte('en'));
      const namen = new Set(BOTS.flatMap((b) => [b.rufname, b.id, b.name]).filter(Boolean).map((x) => String(x).toLowerCase()));
      window.__enWorte = { deutsch: new Set([...worte(de)].filter((w) => !en.has(w) && !namen.has(w))), schluessel: new Set(Object.keys(de)), namen };
    }
    const { deutsch, schluessel, namen } = window.__enWorte;
    const sichtbar = (el) => {
      if (!el || el.closest('script,style,noscript,[hidden],[aria-hidden="true"]')) return false;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < innerHeight * 3 && r.left < innerWidth;
    };
    const teile = [];
    const lauf = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (lauf.nextNode()) {
      const n = lauf.currentNode;
      const text = n.textContent.replace(/\s+/g, ' ').trim();
      if (text && sichtbar(n.parentElement) && !n.parentElement.closest('svg')) teile.push({ text, el: n.parentElement });
    }
    for (const el of document.body.querySelectorAll('[aria-label],[title],[placeholder],img[alt]')) {
      if (!sichtbar(el)) continue;
      for (const a of ['aria-label', 'title', 'placeholder', 'alt']) if (el.getAttribute(a)) teile.push({ text: el.getAttribute(a).trim(), el, attr: a });
    }
    // Text aus CSS (content: "..."), den kein Woerterbuch erreicht (Befund 20.11.: Coach-Zeile "Ich bewerte deine Zuege")
    for (const el of document.body.querySelectorAll('*')) {
      if (!sichtbar(el)) continue;
      for (const p of ['::before', '::after']) {
        const c = getComputedStyle(el, p).content;
        if (/^["'].*\p{L}{3,}/u.test(c || '')) teile.push({ text: c.slice(1, -1), el, attr: p });
      }
    }
    const funde = [];
    const ort = (el) => (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/)[0] : el.tagName.toLowerCase());
    for (const { text, el, attr } of teile) {
      const worte = (text.toLowerCase().match(/\p{L}{4,}/gu) || []).filter((w) => deutsch.has(w));
      const grund = [];
      if (/[äöüÄÖÜß]/.test(text.replace(new RegExp([...namen].join('|') || '$^', 'giu'), ''))) grund.push('umlaut');
      if (worte.length) grund.push('deutsch:' + [...new Set(worte)].slice(0, 4).join(','));
      if (/\bundefined\b|\bNaN\b|\[object |\bnull\b/.test(text)) grund.push('leerwert');
      if (schluessel.has(text) || /^[a-z][a-z0-9-]*(\.[a-zA-Z0-9-]+){1,}$/.test(text)) grund.push('schluessel');
      if (grund.length) funde.push(`${grund.join(' ')} | ${attr ? '@' + attr + ' ' : ''}${ort(el)} | ${text.slice(0, 90)}`);
    }
    // abgeschnitten: Element mit eigenem Text, dessen Inhalt breiter/hoeher ist als die Box und das den Rest verdeckt
    for (const el of document.body.querySelectorAll('*')) {
      if (!sichtbar(el) || el.closest('svg') || !el.innerText) continue;
      // Vorlesetext (.sr: 1 px, absichtlich verdeckt) ist kein abgeschnittener Text
      const box = el.getBoundingClientRect();
      if (box.width <= 2 || box.height <= 2) continue;
      if (![...el.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim())) continue;
      const cs = getComputedStyle(el);
      const breit = el.scrollWidth > el.clientWidth + 1 && (cs.overflowX !== 'visible' || cs.textOverflow === 'ellipsis');
      const hoch = el.scrollHeight > el.clientHeight + 2 && cs.overflowY !== 'visible' && cs.overflowY !== 'auto' && cs.overflowY !== 'scroll';
      // gewollt gekuerzt: "…" am Ende, und der volle Text steht im Vorlesetext eines Vorfahren (Heim-Zeilen; auf Deutsch
      // genauso gekuerzt, gemessen 20.11.: DE 221 px, EN 190 px auf 162 px Platz)
      const ganz = el.innerText.replace(/\s+/g, ' ').trim();
      const vorlese = el.closest('[aria-label]')?.getAttribute('aria-label') || '';
      if (breit && !hoch && cs.textOverflow === 'ellipsis' && vorlese.includes(ganz)) continue;
      if (breit || hoch) funde.push(`abgeschnitten${breit ? '-breite' : '-hoehe'} | ${ort(el)} | ${el.innerText.replace(/\s+/g, ' ').trim().slice(0, 90)}`);
    }
    return [...new Set(funde)];
  });
}

// Schritte: hin() bringt die Seite in den Zustand, melden = nur melden (Shop/Premium gesperrt)
const SCHRITTE = [
  { name: 'erster-start', hin: async (s) => {
    await s.goto(BASIS + '#heim');
    await s.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await s.goto(BASIS);
    await s.waitForFunction(() => !!window.__app);
    await warte(1200);
  } },
  { name: 'heim', hin: async (s) => { await s.evaluate(() => window.__app.gehe('heim')); await warte(900); } },
  { name: 'bot-partie', hin: async (s) => {
    await s.evaluate((fen) => window.__app.gehe('partie', { botId: 'benno', farbe: 'w', startFen: fen }), MATT_IN_1);
    await s.waitForFunction(() => window.__partie && window.__partie.bereit === true, null, { timeout: 30000 });
    await warte(600);
  } },
  { name: 'ergebnisblatt', hin: async (s) => {
    await s.locator('#app .feld[data-feld="a1"]').first().click();
    await s.locator('#app .feld[data-feld="a8"]').first().click();
    await s.locator('.ergebnis-overlay').first().waitFor({ timeout: 20000 });
    await warte(2500);
  } },
  { name: 'analyse', hin: async (s) => {
    const knopf = s.locator('.ergebnis-overlay button', { hasText: /analy/i }).first();
    if (await knopf.count()) await knopf.click(); else await s.evaluate(() => window.__app.gehe('analyse'));
    await warte(2500);
  } },
  { name: 'zu-zweit', hin: async (s) => { await s.evaluate(() => window.__app.gehe('partie', { modus: 'zuzweit' })); await warte(1200); } },
  { name: 'zu-zweit-brett', hin: async (s) => {
    const los = s.getByRole('button', { name: /^(Los|Start|Go|Play)/i }).first();
    if (await los.count()) await los.click();
    await warte(1200);
  } },
  { name: 'duell', hin: async (s) => { await s.evaluate(() => window.__app.gehe('raetsel-duell')); await warte(1500); } },
  { name: 'lektionen', hin: async (s) => { await s.evaluate(() => window.__app.gehe('lernen')); await warte(1200); } },
  { name: 'lektion', hin: async (s) => { await s.evaluate(() => window.__app.gehe('lektion', { id: 'grundreihe' })); await warte(1500); } },
  { name: 'erste-schritte-1', hin: async (s) => { await s.evaluate(() => window.__app.gehe('lektion', { id: 'es-turm' })); await warte(1500); } },
  { name: 'erste-schritte-6', hin: async (s) => { await s.evaluate(() => window.__app.gehe('lektion', { id: 'es-partie' })); await warte(2000); } },
  { name: 'liga', hin: async (s) => { await s.evaluate(() => window.__app.gehe('bestenliste')); await warte(1500); } },
  { name: 'einstellungen', hin: async (s) => { await s.evaluate(() => window.__app.gehe('einstellungen')); await warte(1000); } },
  { name: 'premium', melden: true, hin: async (s) => { await s.evaluate(() => window.__app.gehe('premium')); await warte(1500); } },
  { name: 'shop', melden: true, hin: async (s) => { await s.evaluate(() => window.__app.gehe('ich', { bereich: 'shop' })); await warte(1500); } },
];

const server = spawn(process.execPath, ['tests/testserver.mjs', String(PORT), '--bind', '127.0.0.1'], { cwd: WURZEL, stdio: 'ignore' });
let browser;
try {
  const bis = Date.now() + 10000;
  for (;;) {
    try { const r = await fetch(`http://127.0.0.1:${PORT}/index.html`); await r.arrayBuffer(); if (r.ok) break; } catch (e) { /* noch nicht */ }
    if (Date.now() > bis) throw new Error('Server startet nicht');
    await warte(150);
  }
  if (BILDER) mkdirSync(BILDER, { recursive: true });
  browser = await browserTyp(pw).launch({ headless: true });
  for (const [geraet, opt] of Object.entries(GERAETE)) {
    const k = await browser.newContext({ ...opt, serviceWorkers: 'block', timezoneId: 'Europe/Berlin' });
    // Gast: keine Anmeldung, Server-Antworten leer
    await k.route('**/*.supabase.co/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    const s = await k.newPage();
    const seitenfehler = [];
    s.on('pageerror', (e) => seitenfehler.push(e.message));
    s.on('console', (m) => { if (m.type() === 'warning' && /sprache: Text fehlt/.test(m.text())) seitenfehler.push(m.text()); });
    for (const schritt of SCHRITTE) {
      try {
        await schritt.hin(s);
      } catch (e) {
        pruefe(`${geraet}/${schritt.name}: erreichbar`, false, String(e.message).split('\n')[0]);
        continue;
      }
      if (BILDER) await s.screenshot({ path: path.join(BILDER, `${geraet}-${schritt.name}.png`) });
      const funde = await reste(s);
      if (schritt.melden) { for (const f of funde) meldungen.push(`MELDUNG ${geraet}/${schritt.name}: ${f}`); ok++; continue; }
      pruefe(`${geraet}/${schritt.name}: kein deutscher Rest, nichts abgeschnitten`, funde.length === 0, '\n    ' + funde.join('\n    '));
    }
    pruefe(`${geraet}: keine Seitenfehler und keine fehlenden Texte`, seitenfehler.length === 0, [...new Set(seitenfehler)].slice(0, 6));
    await k.close();
  }
} finally {
  if (browser) await browser.close();
  server.kill();
}
for (const m of meldungen) console.log(m);
for (const f of fehler) console.log(f);
console.log(`${ok}/${ok + fehler.length} bestanden`);
process.exit(fehler.length ? 1 : 0);
