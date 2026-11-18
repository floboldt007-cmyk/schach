// Figurensatz "Gold und Elfenbein" (R19, Flos Wahl 14.11.2026 23:00): bearbeitetes cburnett (Form unveraendert, GPLv2+)
// als echter Labor-Satz unter assets/pieces/goldelfenbein/
// (js/figurensatz.js, js/labor.js; nur der Erfinder waehlt ihn, sonst still der Standard). Ohne Preis, Shop oder Leiter.
// Teil 1 in Node: zwoelf Dateien, alle verschieden, Pruefsumme des gewaehlten Stands, Eintrag in
//   Pfaden, Labor-Liste, Namen DE/EN und Herkunft (README).
// Teil 2 im Browser (Playwright, Canvas): jede Figur auf jedem Brett aus css/tokens.css, helles und dunkles Feld, gemessen:
//   Hell-Abstand Weiss gegen Schwarz derselben
//   Figur ab 25 L* (Median der Figurenpunkte) und je Figur eine Kante gegen ihr Feld ab 3:1 (dunkelstes oder hellstes Zehntel
//   der Figurenpunkte). Wo schon der Standardsatz cburnett ein Mass verfehlt, liegt es am Brett: dort muss Gold nur
//   mindestens so gut sein wie cburnett.
// Die Gleichheit in jeder Partie-Ansicht prueft die Funktionsprobe:
//   PROBE_SKIN=goldelfenbein PROBE_STRENG=1 node tests/funktion-shop-skin.test.mjs
//
//   node tests/r19-figuren-gold.test.mjs
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
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
const lies = (d) => readFileSync(path.join(WURZEL, d), 'utf8');

let ok = 0, gesamt = 0;
function pruefe(name, gut, detail = '') {
  gesamt++; if (gut) ok++;
  // INTENTIONAL-SLOP[T4]: die Pruefzeile ist die Ausgabe des Tests (wie in tests/r19-online.test.mjs)
  console.log(`${gut ? 'ok  ' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(detail)}`);
}

const SATZ = 'goldelfenbein';
const ORDNER = `assets/pieces/${SATZ}/`;
const CODES = ['w', 'b'].flatMap((f) => ['K', 'Q', 'R', 'B', 'N', 'P'].map((x) => f + x));

// ---------- Teil 1: Dateien und Eintraege ----------
const da = CODES.filter((c) => existsSync(path.join(WURZEL, ORDNER, c + '.svg')));
pruefe(`zwoelf Figuren unter ${ORDNER}`, da.length === 12, da);
const inhalt = Object.fromEntries(da.map((c) => [c, lies(ORDNER + c + '.svg')]));
const hashes = da.map((c) => createHash('sha256').update(inhalt[c]).digest('hex'));
pruefe('keine doppelte Figur (alle zwoelf Dateien verschieden)', da.length === 12 && new Set(hashes).size === 12, hashes.length);
// Pruefsumme ueber die zwoelf Einzel-Summen in der Reihenfolge von CODES: der Stand, den Flo gewaehlt hat (so/R19-figuren-v2 1914098)
const SUMME = '8f1300d0b3fa64aa7a315e3f65abb4dd2e2d23e6af0339f19e54db389e952671';
const summe = createHash('sha256').update(hashes.join('')).digest('hex');
pruefe('gleich dem gewaehlten Stand (Pruefsumme der zwoelf Dateien)', da.length === 12 && summe === SUMME, summe);
pruefe('kein Skript, kein Fremd-Inhalt in den SVG', da.every((c) => !/<script|<foreignObject|\son\w+\s*=|href="http/i.test(inhalt[c])));
pruefe('js/figurensatz.js kennt den Pfad', lies('js/figurensatz.js').includes(`${SATZ}: '${ORDNER}'`));
pruefe('js/labor.js: im Labor (nur Erfinder), vorn in der Liste',
  /LABOR_FIGUREN = Object\.freeze\(\['goldelfenbein',/.test(lies('js/labor.js')));
// Funktionsprobe 15.11. (sonst still cburnett): die Einstellung figuren nimmt nur Werte aus js/storage.js
pruefe('js/storage.js: Einstellung figuren erlaubt den Satz', /figuren: Object\.freeze\(\[[^\]]*'goldelfenbein'/.test(lies('js/storage.js')));
const texte = lies('js/pakete/sammlung/texte.js');
pruefe('Name deutsch und englisch', texte.includes(`'figuren.${SATZ}': 'Gold und Elfenbein'`) && texte.includes(`'figuren.${SATZ}': 'Gold and ivory'`));
const herkunft = (lies('README.md').match(/- \*\*Figuren\*\* „Gold und Elfenbein“[\s\S]*?(?=\n- \*\*)/) || [''])[0].replace(/\s+/g, ' ');
pruefe('README: Herkunft cburnett, GPLv2 oder neuer, bearbeitet',
  /cburnett/.test(herkunft) && /GPLv2 oder neuer/.test(herkunft) && /bearbeitet/.test(herkunft), herkunft || 'Zeile fehlt');

// ---------- Teil 2: gemessen auf jedem Brett ----------
const BRETTER = [...lies('css/tokens.css').matchAll(/html\[data-brett="([^"]+)"\][^{]*\{[^}]*?--feld-hell:\s*(#[0-9a-f]{6});\s*--feld-dunkel:\s*(#[0-9a-f]{6})/gi)]
  .map((m) => ({ id: m[1], hell: m[2], dunkel: m[3] }));
pruefe('Bretter aus css/tokens.css gelesen', BRETTER.length >= 10, BRETTER.length);
const svgUrl = (d) => 'data:image/svg+xml;base64,' + Buffer.from(lies(d)).toString('base64');
const quellen = Object.fromEntries(CODES.map((c) => [c, { gold: da.includes(c) ? svgUrl(ORDNER + c + '.svg') : null, std: svgUrl(`assets/pieces/${c}.svg`) }]));

let browser;
try {
  browser = await browserTyp(pw).launch({ headless: true });
  const s = await browser.newPage();
  const mess = await s.evaluate(async ({ quellen, bretter }) => {
    const lade = (src) => new Promise((ja) => { if (!src) return ja(null); const i = new Image(); i.onload = () => ja(i); i.onerror = () => ja(null); i.src = src; });
    const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    const lum = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    const lstern = (y) => (y > 216 / 24389 ? 116 * Math.cbrt(y) - 16 : (24389 / 27) * y);
    const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const N = 96;
    const c = document.createElement('canvas'); c.width = c.height = N;
    const g = c.getContext('2d', { willReadFrequently: true });
    // Figurenpunkte (Deckkraft ab 0.5) auf der Feldfarbe: Median-L* und Kante (dunkelstes/hellstes Zehntel gegen das Feld)
    function miss(img, feld) {
      g.clearRect(0, 0, N, N); g.drawImage(img, 0, 0, N, N);
      const maske = g.getImageData(0, 0, N, N).data;
      g.fillStyle = feld; g.fillRect(0, 0, N, N); g.drawImage(img, 0, 0, N, N);
      const px = g.getImageData(0, 0, N, N).data;
      const lf = lum(...hex(feld));
      const ys = [];
      for (let i = 0; i < px.length; i += 4) if (maske[i + 3] >= 128) ys.push(lum(px[i], px[i + 1], px[i + 2]));
      ys.sort((a, b) => a - b);
      const z = Math.max(1, Math.floor(ys.length / 10));
      const mittel = (a) => a.reduce((s, v) => s + v, 0) / a.length;
      return { L: lstern(ys[Math.floor(ys.length / 2)] || 0), kante: ys.length ? Math.max(ratio(lf, mittel(ys.slice(0, z))), ratio(lf, mittel(ys.slice(-z)))) : 0 };
    }
    const bilder = {};
    for (const [code, q] of Object.entries(quellen)) bilder[code] = { gold: await lade(q.gold), std: await lade(q.std) };
    const zeilen = [];
    for (const b of bretter) for (const feld of [b.hell, b.dunkel]) for (const code of Object.keys(bilder)) {
      const { gold, std } = bilder[code];
      if (!gold || !std) continue;
      const mg = miss(gold, feld), ms = miss(std, feld);
      zeilen.push({ brett: b.id, feld, code, gold: mg, std: ms });
    }
    return zeilen;
  }, { quellen, bretter: BRETTER });

  pruefe('jede Figur auf jedem Feld gemessen', mess.length === BRETTER.length * 2 * 12, mess.length);
  const MIN_ABSTAND = 25, MIN_KANTE = 3;
  const kurz = (m) => `${m.code} ${m.brett} ${m.feld}: Kante gold ${m.gold.kante.toFixed(2)} std ${m.std.kante.toFixed(2)}`;
  // Kante: ab 3:1, oder wo schon cburnett darunter liegt, mindestens wie cburnett
  const kanteSchwach = mess.filter((m) => m.gold.kante < Math.min(MIN_KANTE, m.std.kante));
  console.log('  knappste Kanten:', [...mess].sort((a, b) => a.gold.kante - b.gold.kante).slice(0, 4).map(kurz).join(' | '));
  pruefe('jede Figur hat auf jedem Feld eine Kante ab 3:1 (oder mindestens wie cburnett)', kanteSchwach.length === 0, kanteSchwach.slice(0, 6).map(kurz));
  // Weiss gegen Schwarz: Hell-Abstand derselben Figur auf demselben Feld
  const wb = [];
  for (const b of BRETTER) for (const feld of [b.hell, b.dunkel]) for (const f of ['K', 'Q', 'R', 'B', 'N', 'P']) {
    const w = mess.find((m) => m.feld === feld && m.brett === b.id && m.code === 'w' + f);
    const sch = mess.find((m) => m.feld === feld && m.brett === b.id && m.code === 'b' + f);
    if (w && sch) wb.push({ f, brett: b.id, feld, gold: w.gold.L - sch.gold.L, std: w.std.L - sch.std.L });
  }
  const minWb = wb.reduce((a, x) => Math.min(a, x.gold), Infinity);
  console.log(`  Weiss gegen Schwarz: kleinster Hell-Abstand ${minWb.toFixed(1)} L* (cburnett ${wb.reduce((a, x) => Math.min(a, x.std), Infinity).toFixed(1)} L*)`);
  pruefe('Weiss heller als Schwarz, Abstand ab 25 L* (jede Figur, jedes Feld)', wb.length === BRETTER.length * 2 * 6 && wb.every((x) => x.gold >= Math.min(MIN_ABSTAND, x.std)),
    wb.filter((x) => x.gold < Math.min(MIN_ABSTAND, x.std)).slice(0, 6));
} finally {
  if (browser) await browser.close().catch(() => {});
}
console.log(`\n${ok}/${gesamt} Pruefungen bestanden`);
process.exit(ok === gesamt ? 0 : 1);
