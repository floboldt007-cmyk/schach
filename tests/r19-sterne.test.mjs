// Bewertungs-Sterne app-weit (Feinschliff R19, Auftrag Hauptfenster 18.11.2026, Befund 16.11.): im hellen Schema war der
// verdiente Stern nur 2,24:1 und der nicht verdiente 1,33:1. Sterne tragen Information (wie viele Ziele geschafft), also
// gilt WCAG 1.4.11: mindestens 3:1 gegen den Grund.
//   Jeder Stern wird ueber echte Pixel gemessen: ein Bild mit Stern, ein Bild mit unsichtbarem Stern, dazwischen die Pixel,
//   die der Stern malt. Das gilt auch auf Verlaeufen und Bildern, wo eine Rechnung aus CSS-Farben nichts weiss.
//   Verdient: Kontrast >= 3:1 und golden (Farbton 30 bis 55 Grad). Nicht verdient: Kontrast >= 3:1 und als Umriss
//   (die Mitte des Sterns bleibt Grund). Orte: Arena-Karte, Bot-Steckbrief (Sterne und Ziele), Kopf-Chip, Lernen,
//   Verlauf, Analyse, Ergebnisblatt (Partie und Lektion teilen dasselbe Markup; es hat keinen Testzugang und wird in die
//   echte App eingesetzt, gemessen wird dieselbe CSS-Regel). iPhone SE, iPhone 13, iPad, PC; hell und dunkel.
//
//   node tests/r19-sterne.test.mjs
import http from 'node:http';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { BOTS } from '../js/bots.js';

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
  // INTENTIONAL-SLOP[T4]: die Pruefzeile ist die Ausgabe des Tests (wie in tests/r19-exklusiv-kontrast.test.mjs)
  console.log(`${gut ? 'ok  ' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(detail).slice(0, 400)}`);
}

const SIEG = { sterne: [true, false, false], partien: 1, siege: 1, remis: 0, niederlagen: 0, besteGenauigkeit: 80 };
// Welt 1 und zwei Bots von Welt 2 besiegt (wie tests/r19-arena-karte-klein.test.mjs): die Karte zeigt Welt 2 mit zwei besiegten Bots
const SAAT = { bots: Object.fromEntries(BOTS.filter((b) => b.welt === 1 || ['bodo', 'kalle'].includes(b.id)).map((b) => [b.id, SIEG])), brillanteZuege: [] };
const LERNEN = { lek: { turm: { s: 1, z: 15 } } };

// Wo Sterne stehen: Selektor des Stern-Elements, und ob dieser Stern verdient ist
const ORTE = [
  ['Arena-Karte', '.screen.arena .knoten .k-sterne svg', (e) => e.classList.contains('stern')],
  ['Steckbrief', '.screen.arena .detail .mini-sterne svg', (e) => e.classList.contains('stern')],
  ['Ziele', '.screen.arena .detail .ziel-sterne > div b', (e) => e.parentElement.classList.contains('an')],
  ['Kopf-Chip', '.chip-sterne svg', () => true],
  ['Lernen', '.ms-sterne > i', (e) => e.classList.contains('an')],
  ['Lernen-Zahl', ':is(.ms-sterne-zahl, .ms-gesamt, .ms-bk-sterne) .ico', () => true],
  ['Verlauf', '.vl-sterne > span', (e) => e.classList.contains('an')],
  ['Verlauf-Kachel', '.vl-stat .stern, .kachel .stern, .vl-kachel .stern', () => true],
  ['Analyse', '.an-vs-sterne > span', (e) => e.classList.contains('an')],
  ['Ergebnisblatt', '.erg-stern .e-stern', (e) => e.parentElement.classList.contains('an')],
];
const PFLICHT = ['Arena-Karte', 'Steckbrief', 'Ziele', 'Lernen', 'Verlauf', 'Analyse', 'Ergebnisblatt', 'Verlauf-Kachel'];

// Kontrast aus zwei Bildern (mit und ohne Stern) im Browser: gemalte Pixel = Abweichung > 8; je Pixel Kontrast zwischen
// den beiden Bildern; gemeldet wird das 90. Perzentil (Kantenglaettung druckt die Raender, der Kern zaehlt). Farbton aus
// den kraeftigsten Pixeln; hohl = Mitte der gemalten Flaeche ist Grund.
async function bildVergleich(s, a, b) {
  return s.evaluate(async ([a, b]) => {
    const lade = async (x) => { const bm = await createImageBitmap(await (await fetch('data:image/png;base64,' + x)).blob());
      const c = new OffscreenCanvas(bm.width, bm.height); const cx = c.getContext('2d'); cx.drawImage(bm, 0, 0);
      return { w: bm.width, h: bm.height, d: cx.getImageData(0, 0, bm.width, bm.height).data }; };
    const [m, o] = [await lade(a), await lade(b)];
    if (m.w !== o.w || m.h !== o.h) return { fehler: 'Bildgroessen verschieden' };
    const lum = (r, g, b) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const px = []; let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
    const gemalt = (i) => Math.max(Math.abs(m.d[i] - o.d[i]), Math.abs(m.d[i + 1] - o.d[i + 1]), Math.abs(m.d[i + 2] - o.d[i + 2])) > 8;
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      const i = (y * m.w + x) * 4;
      if (!gemalt(i)) continue;
      const l1 = lum(m.d[i], m.d[i + 1], m.d[i + 2]), l2 = lum(o.d[i], o.d[i + 1], o.d[i + 2]);
      px.push({ k: (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05), r: m.d[i], g: m.d[i + 1], b: m.d[i + 2] });
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    if (px.length < 4) return { fehler: 'Stern malt keine Pixel', n: px.length };
    px.sort((p, q) => p.k - q.k);
    const kontrast = px[Math.floor(px.length * 0.9)].k;
    const stark = px.slice(Math.floor(px.length * 0.75));
    const mittel = ['r', 'g', 'b'].map((c) => stark.reduce((s, p) => s + p[c], 0) / stark.length);
    const [r, g, bl] = mittel, mx = Math.max(r, g, bl), mn = Math.min(r, g, bl), dd = mx - mn;
    const ton = dd < 12 ? null : Math.round(((mx === r ? ((g - bl) / dd) % 6 : mx === g ? (bl - r) / dd + 2 : (r - g) / dd + 4) * 60 + 360) % 360);
    // Mitte des Sterns: der Schwerpunkt liegt beim Stern etwas unter der Mitte des Rahmens (Spitze oben)
    const cx = Math.round((x0 + x1) / 2), cy = Math.round(y0 + (y1 - y0) * 0.55);
    let hohl = true;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (gemalt(((cy + dy) * m.w + cx + dx) * 4)) hohl = false;
    return { kontrast: Math.round(kontrast * 100) / 100, ton, farbe: mittel.map(Math.round), hohl, n: px.length, groesse: [x1 - x0 + 1, y1 - y0 + 1] };
  }, [a.toString('base64'), b.toString('base64')]);
}

async function messeOrte(s, gruppe, gesehen) {
  for (const [ort, sel, verdient] of ORTE) {
    const n = await s.locator(sel).count();
    for (let i = 0; i < n; i++) {
      const el = s.locator(sel).nth(i);
      if (!(await el.isVisible().catch(() => false))) continue;
      // in die Mitte: scrollende Listen blenden ihre Raender per Maske aus (css/app.css:466), dort waere jeder Stern blass
      await el.evaluate((e) => e.scrollIntoView({ block: 'center', inline: 'center' })).catch(() => {});
      await warte(120);
      const box = await el.boundingBox();
      if (!box || box.width < 2) continue;
      const vp = s.viewportSize();
      if (box.x < 0 || box.y < 0 || box.x + box.width > vp.width || box.y + box.height > vp.height) continue;
      // verdeckt (z. B. Karten-Sterne unter dem offenen Steckbrief): nicht dieser Ort, er wird dort gemessen, wo er oben liegt
      // elementFromPoint ueberspringt pointer-events: none (die Stern-Pille ueber dem Knoten, arena.css:292): fuer die Abfrage kurz an
      const oben = await el.evaluate((e) => { const r = e.getBoundingClientRect();
        const aus = []; for (let x = e; x && x !== document.body; x = x.parentElement) if (getComputedStyle(x).pointerEvents === 'none') { aus.push([x, x.style.pointerEvents]); x.style.pointerEvents = 'auto'; }
        const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        for (const [x, v] of aus) x.style.pointerEvents = v;
        const knoten = e.closest('.knoten');
        return !!t && (t === e || e.contains(t) || t.contains(e) || (!!knoten && t.closest('.knoten') === knoten)); });
      if (!oben) continue;
      const an = await el.evaluate(verdient);
      const clip = { x: Math.max(0, box.x - 2), y: Math.max(0, box.y - 2), width: Math.min(vp.width - Math.max(0, box.x - 2), box.width + 4),
        height: Math.min(vp.height - Math.max(0, box.y - 2), box.height + 4) };
      const mit = await s.screenshot({ clip, animations: 'disabled' });
      await el.evaluate((e) => e.style.setProperty('visibility', 'hidden', 'important'));
      const ohne = await s.screenshot({ clip, animations: 'disabled' });
      await el.evaluate((e) => e.style.removeProperty('visibility'));
      const x = await bildVergleich(s, mit, ohne);
      gesehen.add(ort);
      const name = `${gruppe} ${ort} #${i + 1} ${an ? 'verdient' : 'nicht verdient'}`;
      if (x.fehler) { pruefe(`${name}: messbar`, false, x); continue; }
      if (an && !gesehen.has(ort + ':an')) { gesehen.add(ort + ':an'); console.log(`     Messwert ${name}: ${x.kontrast}:1, Farbton ${x.ton}, rgb(${x.farbe})`); }
      if (!an && !gesehen.has(ort + ':aus')) { gesehen.add(ort + ':aus'); console.log(`     Messwert ${name}: ${x.kontrast}:1, hohl ${x.hohl}, rgb(${x.farbe})`); }
      pruefe(`${name}: mind. 3:1 gegen den Grund`, x.kontrast >= 3, x);
      if (an) pruefe(`${name}: golden (Farbton 30 bis 55 Grad)`, x.ton !== null && x.ton >= 30 && x.ton <= 55, x);
      else pruefe(`${name}: als Umriss (Mitte bleibt Grund)`, x.hohl, x);
    }
  }
}

const GERAETE = [
  ['iPhone SE', { viewport: { width: 375, height: 667 }, hasTouch: true, isMobile: true }],
  ['iPhone 13', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }],
  ['iPad', { viewport: { width: 820, height: 1180 }, hasTouch: true }],
  ['PC', { viewport: { width: 1280, height: 800 } }],
];
function initSkript({ modus, saat, lernen }) {
  try {
    if (sessionStorage.getItem('stern-start')) return;
    sessionStorage.setItem('stern-start', '1');
    localStorage.clear();
    const d = new Date(); if (d.getHours() < 4) d.setDate(d.getDate() - 1);
    const z = (n) => String(n).padStart(2, '0');
    localStorage.setItem('schach-arena:v1:modul:start', JSON.stringify({ v: 1, gesehen: `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}` }));
    localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ sprache: 'de', spracheGewaehlt: true, klang: false, modus, arenaKarteHinweis: true }));
    localStorage.setItem('schach-arena:v1:hinweis-installieren', '1');
    localStorage.setItem('schach-arena:v1:fortschritt', JSON.stringify(saat));
    localStorage.setItem('schach-arena:v1:modul:lernen', JSON.stringify(lernen));
  } catch (e) { /* egal */ }
}

const seitenfehler = [];
const browser = await pw.chromium.launch({ headless: true });
try {
  for (const [geraet, opt] of GERAETE) {
    for (const farbe of ['hell', 'dunkel']) {
      const gruppe = `${geraet} ${farbe}`;
      const gesehen = new Set();
      const k = await browser.newContext({ ...opt, deviceScaleFactor: 2, serviceWorkers: 'block', colorScheme: farbe === 'dunkel' ? 'dark' : 'light',
        locale: 'de-DE', timezoneId: 'Europe/Berlin' });
      await k.route('**/*.supabase.co/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
      await k.addInitScript(initSkript, { modus: farbe, saat: SAAT, lernen: LERNEN });
      const s = await k.newPage(); s.setDefaultTimeout(20000);
      s.on('pageerror', (e) => seitenfehler.push(`${gruppe}: ${e.message}`));
      try {
        // Arena: Karte mit besiegten Bots, dann der Steckbrief eines besiegten Bots
        await s.goto(`http://127.0.0.1:${PORT}/index.html?test#arena`);
        await s.waitForSelector('.screen.arena .knoten[data-bot]', { state: 'visible', timeout: 30000 });
        await s.evaluate(() => document.fonts.ready);
        await warte(900);
        pruefe(`${gruppe}: Schema ${farbe} aktiv`, (await s.evaluate(() => document.documentElement.dataset.modus)) === farbe,
          await s.evaluate(() => document.documentElement.dataset.modus));
        await messeOrte(s, gruppe + ' Arena', gesehen);
        await s.locator(`.screen.arena .knoten[data-bot="bodo"]`).click();
        await warte(700);
        await messeOrte(s, gruppe + ' Arena-Steckbrief', gesehen);
        // Ergebnisblatt: Markup wie js/ui/partie.js:2272 und js/ui/lektion.js:201, Symbol aus einem echten Stern der Seite
        await s.evaluate(() => {
          const svg = document.querySelector('.k-sterne svg, .mini-sterne svg').outerHTML.replace(/class="[^"]*"/, 'class="ico"');
          const o = document.createElement('div');
          o.className = 'ergebnis-overlay sieg'; o.style.position = 'fixed'; o.dataset.sternProbe = '1';
          o.innerHTML = `<div class="ergebnis-karte"><div class="erg-mitte"><div class="erg-sterne">${[true, false, false].map((an, i) =>
            `<div class="erg-stern ${an ? 'an' : 'aus'}" style="--i:${i}"><span class="e-stern" aria-hidden="true">${svg}</span><b>Ziel</b><small>x</small></div>`).join('')}</div></div></div>`;
          document.querySelector('.screen.arena').append(o);
        });
        await warte(2500);
        await messeOrte(s, gruppe + ' Ergebnisblatt', gesehen);
        await s.evaluate(() => document.querySelector('[data-stern-probe]')?.remove());
        // Lernen: Meisterschule mit einer Lektion (1 Stern)
        await s.evaluate(() => window.__app.gehe('lernen'));
        await s.waitForSelector('.ms-sterne', { timeout: 20000 });
        await warte(700);
        await messeOrte(s, gruppe + ' Lernen', gesehen);
        // Verlauf und Analyse: eine Bot-Partie ueber die Testseite (ohne Review)
        await s.goto(`http://127.0.0.1:${PORT}/tests/screens.html?screen=keiner`);
        await s.waitForFunction(() => window.testseiteBereit === true, null, { timeout: 30000 });
        const id = await s.evaluate(async () => (await testseite.botPartie({ gegner: 'kalle', flo: 'greta', mitReview: true, tiefe: 6, datum: Date.now() - 3600e3 })).id);
        await s.goto(`http://127.0.0.1:${PORT}/tests/screens.html?screen=verlauf`);
        await s.waitForFunction(() => window.testseiteBereit === true, null, { timeout: 30000 });
        // die Testseite laedt js/thema.js nicht; das setzt in der App html[data-modus] (thema.js:246), hier von Hand
        await s.evaluate((m) => { document.documentElement.dataset.modus = m; }, farbe);
        await s.waitForSelector('.vl-sterne', { timeout: 20000 });
        await warte(500);
        await messeOrte(s, gruppe + ' Verlauf', gesehen);
        await s.goto(`http://127.0.0.1:${PORT}/tests/screens.html?screen=analyse&partieId=${id}&neueSterne=1,0,0`);
        await s.waitForFunction(() => window.testseiteBereit === true, null, { timeout: 30000 });
        await s.evaluate((m) => { document.documentElement.dataset.modus = m; }, farbe);
        // die Stern-Zeile steht in der Genauigkeits-Karte, und die braucht die Auswertung: sie liegt der Partie schon bei (mitReview),
        // sonst rechnete Stockfish sie erst auf der Seite und kam unter Last nicht rechtzeitig (k2.log 18.11.: Analyse dunkel fehlte)
        await s.waitForSelector('.an-vs-sterne', { timeout: 30000 });
        await warte(1500);
        await messeOrte(s, gruppe + ' Analyse', gesehen);
      } finally { await k.close(); }
      for (const ort of PFLICHT) pruefe(`${gruppe}: Ort ${ort} gemessen`, gesehen.has(ort), [...gesehen]);
    }
  }
  pruefe('keine Seitenfehler', !seitenfehler.length, seitenfehler);
} finally {
  await browser.close();
  server.close();
}
console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
