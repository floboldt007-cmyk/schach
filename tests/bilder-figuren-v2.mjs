// Figuren-Proben v2 (R19 14.11.2026): drei Material-Proben auf der cburnett-Form (werkzeuge/figuren-material.mjs) am
// ECHTEN Brett (js/board.js) pruefen und fotografieren. Kein Teil von tests/alle.mjs, nichts davon ist in der App.
//   1. Dateien: je Probe 12 SVG, Form aus der gleichnamigen Datei in assets/pieces/, ohne script/foreignObject/fremde Verweise
//   2. Messung am echten Brett: jede Figur beider Farben einmal auf hellem und einmal auf dunklem Feld; je Feldfarbe
//      Hell-Abstand Weiss gegen Schwarz derselben Figur >= 25 L* (Median der Figurenpunkte, also der Koerper), und jede Figur hat eine Kante gegen ihr Feld >= 3:1
//      (dunkelstes oder hellstes Zehntel der Figurenpunkte gegen die Feldfarbe)
//   3. Bilder (iPhone 13 hell): figuren-<probe>-brett.png (Stellung nach 5 Zuegen) und figuren-<probe>-nah.png (Koenig + Dame)
//
//   node tests/bilder-figuren-v2.mjs [--bilder=<ordner>]     PORT=8994 Standard
// Exit 0, wenn alle Pruefungen gruen sind; sonst 1.
import http from 'node:http';
import os from 'node:os';
import { createRequire } from 'node:module';
import { readFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { browserTyp } from './browser.mjs';

const require = createRequire(import.meta.url);
let pw;
for (const p of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
  try { pw = require(p); break; } catch (e) { /* naechster */ }
}
if (!pw) throw new Error('Playwright fehlt (PLAYWRIGHT_PFAD setzen)');
const arg = (n) => { const a = process.argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : null; };
const BILDER = arg('bilder') || path.join(os.tmpdir(), 'bilder-figuren-v2');
mkdirSync(BILDER, { recursive: true });

const root = fileURLToPath(new URL('../', import.meta.url));
const PROBEN = [['gold-elfenbein', 'Probe 1 · Gold und Elfenbein'], ['glas', 'Probe 2 · Glas'], ['marmor', 'Probe 3 · Marmor']];
const FIGUREN = ['K', 'Q', 'R', 'B', 'N', 'P'];
const FELD = { hell: '#e9e6e0', dunkel: '#8f8a81' };   // neutrales Brett: warmes Hellgrau und Steingrau
const MIN_ABSTAND = 25, MIN_KANTE = 3;

let ok = 0, gesamt = 0;
function pruefe(name, gut, detail = '') {
  gesamt++; if (gut) ok++;
  // INTENTIONAL-SLOP[T4]: die Pruefzeile ist die Ausgabe des Werkzeugs (wie in tests/bilder-online.mjs)
  console.log(`${gut ? 'ok  ' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(detail)}`);
}

// ---------- 1. Dateien ----------
const pfadeDerForm = (svg) => [...svg.matchAll(/\sd="([^"]+)"/g)].map((m) => m[1]);
for (const [probe] of PROBEN) {
  const ordner = path.join(root, 'design/figuren-material', probe);
  const dateien = existsSync(ordner) ? readdirSync(ordner).filter((f) => f.endsWith('.svg')).sort() : [];
  const soll = ['w', 'b'].flatMap((c) => FIGUREN.map((f) => `${c}${f}.svg`)).sort();
  pruefe(`${probe}: 12 Figuren`, JSON.stringify(dateien) === JSON.stringify(soll), dateien);
  for (const d of dateien) {
    const svg = readFileSync(path.join(ordner, d), 'utf8');
    const form = pfadeDerForm(readFileSync(path.join(root, 'assets/pieces', d), 'utf8'));
    const fehlt = form.filter((p) => !svg.includes(`d="${p}"`));
    const boese = /<script|<foreignObject|\son\w+\s*=|(?:href|src)\s*=\s*"(?!#)|url\((?!#)/i.test(svg);
    pruefe(`${probe}/${d}: cburnett-Form, nichts Fremdes`, fehlt.length === 0 && !boese && /cburnett/.test(svg), { fehlt, boese });
  }
}

// ---------- Seite mit dem echten Brett ----------
const MESS_FEN = 'kqrbnp2/kqrbnp2/8/8/8/8/KQRBNP2/KQRBNP2 w - - 0 1';   // a1 dunkel, a2 hell: jede Figur auf beiden Feldfarben
const BRETT_FEN = 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 6 5';   // Italienisch, Vierspringer
function seite(q) {
  const probe = q.get('probe'), modus = q.get('modus'), titel = q.get('titel') || '';
  const pfad = `/design/figuren-material/${probe}/`;
  const nah = FIGUREN.slice(0, 2).map((f) => `<div class="z" style="background:${FELD.hell}"><img src="${pfad}w${f}.svg" alt=""></div>`).join('')
    + FIGUREN.slice(0, 2).map((f) => `<div class="z" style="background:${FELD.dunkel}"><img src="${pfad}b${f}.svg" alt=""></div>`).join('');
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="/css/board.css"><style>
  body{margin:0;background:#f6f4f0;font:600 15px/1.3 system-ui,sans-serif;color:#2a2722}
  #rahmen{padding:16px} h1{font-size:15px;margin:0 0 12px}
  #brett{--feld-hell:${FELD.hell};--feld-dunkel:${FELD.dunkel}}
  .nah{display:grid;grid-template-columns:1fr 1fr;gap:10px}.z{aspect-ratio:1;border-radius:14px;display:grid;place-items:center}
  .z img{width:92%;height:92%}
</style></head><body><div id="rahmen"><h1>${titel}</h1>${modus === 'nah' ? `<div class="nah">${nah}</div>` : '<div id="brett"></div>'}</div>
<script type="module">
  import { Brett } from '/js/board.js';
  const el = document.getElementById('brett');
  if (el) new Brett(el, { figurenPfad: '${pfad}', koordinaten: false, animation: 0, fen: '${modus === 'mess' ? MESS_FEN : BRETT_FEN}' });
  window.fertig = true;
</script></body></html>`;
}

const typen = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://test');
  if (url.pathname === '/__figuren-v2.html') { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(seite(url.searchParams)); return; }
  const p = path.resolve(root, '.' + decodeURIComponent(url.pathname));
  if (!p.startsWith(root)) { res.writeHead(403); res.end(); return; }
  try { const d = readFileSync(p); res.writeHead(200, { 'Content-Type': typen[path.extname(p)] || 'application/octet-stream' }); res.end(d); }
  catch (e) { res.writeHead(404); res.end(); }
});
const PORT = Number(process.env.PORT || 8994);
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

// Auswertung eines Feld-Ausschnitts im Browser: Feldfarbe aus der Ecke, Figurenpunkte = deutlich andere Farbe
async function feldWerte(s, png) {
  return s.evaluate(async (b64) => {
    const bild = await createImageBitmap(await (await fetch('data:image/png;base64,' + b64)).blob());
    const c = new OffscreenCanvas(bild.width, bild.height); const x = c.getContext('2d'); x.drawImage(bild, 0, 0);
    const d = x.getImageData(0, 0, bild.width, bild.height).data;
    const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    const lum = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    const lstern = (y) => (y > 216 / 24389 ? 116 * Math.cbrt(y) - 16 : (24389 / 27) * y);
    const o = 4 * (Math.floor(bild.height / 2) * bild.width + 2);   // Mitte links: weder Brett-Ecke (Rundung) noch Figur
    const fr = d[o], fg = d[o + 1], fb = d[o + 2];
    const feldY = lum(fr, fg, fb); const ys = [];
    for (let i = 0; i < d.length; i += 4) {
      if (Math.abs(d[i] - fr) + Math.abs(d[i + 1] - fg) + Math.abs(d[i + 2] - fb) > 24) ys.push(lum(d[i], d[i + 1], d[i + 2]));
    }
    ys.sort((a, b2) => a - b2);
    const zehntel = Math.max(1, Math.floor(ys.length / 10));
    const mittel = (a) => a.reduce((s2, v) => s2 + v, 0) / a.length;
    const ratio = (a, b2) => (Math.max(a, b2) + 0.05) / (Math.min(a, b2) + 0.05);
    const dunkel = mittel(ys.slice(0, zehntel)), hell = mittel(ys.slice(-zehntel));
    return { anteil: ys.length / (bild.width * bild.height), L: lstern(ys[Math.floor(ys.length / 2)]), kante: Math.max(ratio(feldY, dunkel), ratio(feldY, hell)) };
  }, png.toString('base64'));
}

const seitenfehler = [];
const messung = {};
let browser;
try {
  browser = await browserTyp(pw).launch({ headless: true });
  for (const [probe, titel] of PROBEN) {
    if (!existsSync(path.join(root, 'design/figuren-material', probe))) { pruefe(`${probe}: Satz vorhanden`, false, 'Ordner fehlt'); continue; }
    // ---------- 2. Messung ----------
    const km = await browser.newContext({ viewport: { width: 800, height: 800 }, deviceScaleFactor: 1, colorScheme: 'light', reducedMotion: 'reduce' });
    const m = await km.newPage(); m.on('pageerror', (e) => seitenfehler.push(`${probe} mess: ${e.message}`));
    await m.goto(`http://127.0.0.1:${PORT}/__figuren-v2.html?probe=${probe}&modus=mess`);
    await m.waitForFunction(() => window.fertig && document.querySelectorAll('#brett img').length === 24
      && [...document.querySelectorAll('#brett img')].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 15000 });
    const r = await m.locator('#brett').boundingBox();
    const q = r.width / 8;
    const werte = {};
    for (const [farbe, reihen] of [['w', [1, 2]], ['b', [8, 7]]]) {
      for (const reihe of reihen) {
        for (let datei = 0; datei < 6; datei++) {
          const feld = (datei + reihe - 1) % 2 === 0 ? 'dunkel' : 'hell';
          const png = await m.screenshot({ clip: { x: r.x + datei * q, y: r.y + (8 - reihe) * q, width: q, height: q } });
          werte[`${farbe}${FIGUREN[datei]}-${feld}`] = await feldWerte(m, png);
        }
      }
    }
    await km.close();
    messung[probe] = werte;
    for (const f of FIGUREN) {
      for (const feld of ['hell', 'dunkel']) {
        const w = werte[`w${f}-${feld}`], b = werte[`b${f}-${feld}`];
        const abstand = w.L - b.L;
        pruefe(`${probe} ${f} auf ${feld}em Feld: Weiss/Schwarz ${abstand.toFixed(0)} L*, Kante W ${w.kante.toFixed(1)} B ${b.kante.toFixed(1)}`,
          abstand >= MIN_ABSTAND && w.kante >= MIN_KANTE && b.kante >= MIN_KANTE && w.anteil > 0.12 && b.anteil > 0.12,
          { w, b });
      }
    }
    // ---------- 3. Bilder ----------
    const k = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true,
      colorScheme: 'light', reducedMotion: 'reduce', locale: 'de-DE' });
    const s = await k.newPage(); s.on('pageerror', (e) => seitenfehler.push(`${probe} bild: ${e.message}`));
    for (const modus of ['brett', 'nah']) {
      await s.goto(`http://127.0.0.1:${PORT}/__figuren-v2.html?probe=${probe}&modus=${modus}&titel=${encodeURIComponent(titel + (modus === 'nah' ? ' · König und Dame' : ''))}`);
      await s.waitForFunction(() => window.fertig && [...document.querySelectorAll('img')].every((i) => i.complete && i.naturalWidth > 0)
        && document.querySelectorAll('img').length >= 4, null, { timeout: 15000 });
      const datei = path.join(BILDER, `figuren-${probe}-${modus}.png`);
      pruefe(`${probe}: Bild ${modus}`, await s.locator('#rahmen').screenshot({ path: datei }).then(() => true).catch(() => false));
    }
    await k.close();
  }
} finally {
  if (browser) await browser.close().catch(() => {});
  server.close();
}
pruefe('keine Seitenfehler', seitenfehler.length === 0, seitenfehler);
console.log('\nMESSUNG ' + JSON.stringify(Object.fromEntries(Object.entries(messung).map(([p, w]) =>
  [p, Object.fromEntries(Object.entries(w).map(([k2, v]) => [k2, { L: +v.L.toFixed(1), kante: +v.kante.toFixed(2) }]))]))));
console.log(`\n${ok}/${gesamt} Pruefungen, Bilder in ${BILDER}`);
process.exit(ok === gesamt ? 0 : 1);
