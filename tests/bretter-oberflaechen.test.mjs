// Oberflaechen der Bretter (Flo 14.11.2026: viele Bretter "nur Farben" und zu aehnlich, Thron, Topas, Bernstein, Kuerbis und
// Sonnenkrone alle gold-orange). Geprueft wird:
//   Oberflaeche  jedes Labor-Brett der Seltenheit selten, episch oder legende traegt eine Oberflaeche ueber das ganze Brett
//                (js/brett-flaechen.js), mit Mindestzahl an Formen und Toenen je Seltenheit, keine zwei gleich; gewoehnliche
//                bleiben schlicht (hoechstens 6 Formen je Feld)
//   Abstand      je zwei der 65 Bretter liegen im Farbabstand (CIEDE2000, Mittel aus hellem und dunklem Feld) mindestens
//                MIN_ABSTAND auseinander; Flos Gruppe ist darin enthalten und eigens ausgewiesen
//   Boeden       alle 65 Bretter halten Feldkontrast und Figuren-Lesbarkeit, an der schlechtesten Stelle: alle aufhellenden
//                bzw. alle abdunkelnden Toene eines Feldes uebereinander, dazu der Glanz (auch frost und nussbaum)
//   Seltenheit   die unterste Stufe heisst gewoehnlich, nicht frei (Ed-Hinweis 14.11.: kollidiert mit dem Sammel-Label "Frei")
//   Laufzeit     brettFlaeche setzt die Variablen am html nur fuer das Erfinder-Konto und raeumt sie beim Wechsel wieder ab
//   Sammelbild   das Sammelbild zeigt je Feld seinen Ausschnitt der Oberflaeche
//   Browser      css/board.css: jedes Feld zeigt seinen Ausschnitt (800 %, Lage nach Spalte und Reihe), der Glanz behaelt ihn
//   node tests/bretter-oberflaechen.test.mjs     (Browser-Teil braucht Playwright: PLAYWRIGHT_PFAD)
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let ok = 0, fehl = 0;
const pruefe = (name, bed, info) => { if (bed) ok++; else { fehl++; console.log('FEHLER', name, info === undefined ? '' : JSON.stringify(info)); } };
const laden = async (p) => { try { return await import(p); } catch (e) { pruefe('Modul ladbar: ' + p, false, e.message); return {}; } };

const { LABOR_BRETTER = [], FREIE_BRETTER_PLAN = {}, brettFlaeche } = await laden('../js/labor.js');
const { brettMuster, ARTEN = [], GROESSE, svgUrl } = await laden('../js/brett-flaechen.js');
const { brettKunst } = await laden('../js/sammlung-kunst.js');
const css = readFileSync(path.join(WURZEL, 'css/tokens.css'), 'utf8').replace(/\r/g, '');
const block = (id) => (new RegExp(`html\\[data-brett="${id}"\\] \\{([^}]*)\\}`).exec(css) || [])[1] || '';
const wert = (b, n) => ((new RegExp(`--${n}: ([^;]+);`)).exec(b) || [])[1] || '';
const FREI = ['nacht', 'gruen', 'holz'];
const frei = FREI.map((id) => ({ id, hell: wert(block(id), 'feld-hell'), dunkel: wert(block(id), 'feld-dunkel'), ...(FREIE_BRETTER_PLAN[id] || {}) }));
const alle = [...frei, ...LABOR_BRETTER];
const muster = (b) => (typeof brettMuster === 'function' && brettMuster(b)) || b.muster || null;

// ---------- Seltenheit
const SELTEN = ['gewoehnlich', 'selten', 'episch', 'legende'];
pruefe('Seltenheit der Bretter: gewoehnlich, selten, episch, legende (kein frei mehr)', alle.every((b) => SELTEN.includes(b.seltenheit)),
  alle.filter((b) => !SELTEN.includes(b.seltenheit)).map((b) => [b.id, b.seltenheit]));
pruefe('Nacht, Gruen und Holz sind gewoehnlich', frei.every((b) => b.seltenheit === 'gewoehnlich'));

// ---------- Oberflaeche
const formen = (s) => (String(s || '').match(/<(circle|ellipse|rect|polygon)\b/g) || []).length
  + [...String(s || '').matchAll(/\sd="([^"]*)"/g)].reduce((n, m) => n + (m[1].match(/[Mm]/g) || []).length, 0);
// Ebenen der Oberflaeche: <g opacity="a"> mit deckenden rgb()-Formen -> [r, g, b, a] je Ebene (Farbe der ersten Form)
const ebenen = (s) => [...String(s || '').matchAll(/<g opacity="([\d.]+)">[\s\S]*?rgb\(([\d.]+),([\d.]+),([\d.]+)\)/g)]
  .map((m) => [+m[2], +m[3], +m[4], +m[1]]);
const toene = (s) => new Set(ebenen(s).map((e) => e.join())).size;
const MINDEST = { selten: [20, 1], episch: [30, 2], legende: [40, 2] };
const besonders = LABOR_BRETTER.filter((b) => b.seltenheit !== 'gewoehnlich');
pruefe('Jedes seltene, epische und legendaere Brett hat eine bekannte Oberflaechen-Art', besonders.length >= 50 && besonders.every((b) => b.flaeche && ARTEN.includes(b.flaeche.art)),
  besonders.filter((b) => !b.flaeche || !ARTEN.includes(b.flaeche.art)).map((b) => b.id));
const zuWenig = besonders.filter((b) => b.flaeche).map((b) => [b.id, b.seltenheit, muster(b)]).filter(([, s, m]) => !m
  || ['h', 'd'].some((k) => formen(m[k]) < MINDEST[s][0] || toene(m[k]) < MINDEST[s][1]))
  .map(([id, s, m]) => [id, s, m && formen(m.h), m && formen(m.d), m && toene(m.h), m && toene(m.d)]);
pruefe('Oberflaeche dicht genug (selten 20 Formen, episch 30 und 2 Toene, legende 40 und 2 Toene, je Feldfarbe)', zuWenig.length === 0, zuWenig);
pruefe('Oberflaeche spannt das ganze Brett (800 %), nicht je Feld', GROESSE === '800% 800%');
const hs = besonders.map((b) => (muster(b) || {}).h || '');
pruefe('Keine zwei Oberflaechen gleich', new Set(hs).size === hs.length);
const jeArt = {}; for (const b of besonders) if (b.flaeche) jeArt[b.flaeche.art] = (jeArt[b.flaeche.art] || 0) + 1;
pruefe('Jede Art hoechstens zweimal', Object.values(jeArt).every((n) => n <= 2), Object.entries(jeArt).filter(([, n]) => n > 2));
// deckende Formen in je einer Gruppe mit Deckkraft: so stapeln sich ueberlappende Formen einer Ebene nicht
const ebenenTreu = (s) => !/(fill|stroke|stop-color)="(?!none"|rgb\()/.test(s) && !/(fill|stroke)-opacity|rgba\(/.test(s)
  && (s.match(/opacity=/g) || []).length === (s.match(/<g opacity="[\d.]+">/g) || []).length && ebenen(s).length > 0;
pruefe('Oberflaechen: je Ebene eine Gruppe mit opacity, Formen darin deckend in rgb (sonst stapeln Ueberlappungen)',
  besonders.every((b) => { const m = muster(b); return !m || (ebenenTreu(m.h) && ebenenTreu(m.d)); }),
  besonders.filter((b) => { const m = muster(b); return m && !(ebenenTreu(m.h) && ebenenTreu(m.d)); }).map((b) => b.id));
const schlicht = alle.filter((b) => b.seltenheit === 'gewoehnlich');
pruefe('Gewoehnliche bleiben schlicht: keine Oberflaeche, hoechstens 6 Formen je Feld', schlicht.every((b) => !b.flaeche && (!b.muster || (formen(b.muster.h) <= 6 && formen(b.muster.d) <= 6))),
  schlicht.filter((b) => b.flaeche || (b.muster && (formen(b.muster.h) > 6 || formen(b.muster.d) > 6))).map((b) => b.id));
pruefe('Bretter mit Oberflaeche tragen in tokens.css keine eigene Zeichnung (die kommt zur Laufzeit)',
  besonders.every((b) => !/--feld-muster-/.test(block(b.id))), besonders.filter((b) => /--feld-muster-/.test(block(b.id))).map((b) => b.id));

// ---------- Boeden
const farbe = (s) => {
  const h = /^#([0-9a-f]{6})$/i.exec(s);
  if (h) { const n = parseInt(h[1], 16); return [n >> 16, (n >> 8) & 255, n & 255, 1]; }
  const r = /^rgba\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)$/.exec(s);
  return r ? [+r[1], +r[2], +r[3], +r[4]] : null;
};
const ueber = (u, o) => u.map((v, i) => (i < 3 ? v * (1 - o[3]) + o[i] * o[3] : 1));
const lum = ([r, g, b]) => [r, g, b].map((v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; })
  .reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
const kontrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
// schlechteste Stellen: alle aufhellenden Ebenen uebereinander, alle abdunkelnden uebereinander (der Glanz hellt auf).
// Oberflaechen: je Ebene einmal (Gruppen-Deckkraft); Zeichnung je Feld der gewoehnlichen: je rgba-Ton einmal
const stellen = (grund, zeichnung, glanz) => {
  const g = farbe(grund);
  const z = String(zeichnung || '');
  const oben = /<g opacity=/.test(z) ? ebenen(z) : [...new Set(z.match(/rgba\([^)]*\)/g) || [])].map(farbe).filter(Boolean);
  if (glanz) oben.push(farbe(glanz));
  const hell = oben.filter((o) => lum(ueber(g, o)) > lum(g)), dunkel = oben.filter((o) => lum(ueber(g, o)) <= lum(g));
  return [g, hell.reduce(ueber, g), dunkel.reduce(ueber, g)];
};
const WEISS = [255, 255, 255, 1], SCHWARZ = [0, 0, 0, 1];
const mass = (b) => {
  const m = muster(b) || {};
  const H = stellen(b.hell, m.h, b.glanz), D = stellen(b.dunkel, m.d, b.glanz), min = (f) => Math.min(...f);
  return { feld: min(H.flatMap((h) => D.map((d) => kontrast(h, d)))), weissAufDunkel: min(D.map((d) => kontrast(WEISS, d))),
    schwarzAufDunkel: min(D.map((d) => kontrast(SCHWARZ, d))), schwarzAufHell: min(H.map((h) => kontrast(SCHWARZ, h))) };
};
const BODEN = { feld: 2.2, weissAufDunkel: 3.0, schwarzAufDunkel: 3.0, schwarzAufHell: 7.0 };
const unter = alle.map((b) => [b.id, mass(b)]).filter(([, m]) => Object.entries(BODEN).some(([k, v]) => m[k] < v));
pruefe('Alle 65 Bretter halten die vier Boeden an der schlechtesten Stelle (frost und nussbaum eingeschlossen)', unter.length === 0,
  unter.map(([id, m]) => [id, Object.fromEntries(Object.entries(m).map(([k, v]) => [k, +v.toFixed(2)]))]));

// ---------- Abstand (CIEDE2000)
const lab = (hex) => {
  const [r, g, b] = farbe(hex).slice(0, 3).map((v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  const X = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047, Y = r * 0.2126 + g * 0.7152 + b * 0.0722, Z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
};
const de00 = (x, y) => {
  const [L1, a1, b1] = lab(x), [L2, a2, b2] = lab(y), rad = Math.PI / 180;
  const Cm = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2, G = 0.5 * (1 - Math.sqrt(Cm ** 7 / (Cm ** 7 + 25 ** 7)));
  const a1p = a1 * (1 + G), a2p = a2 * (1 + G), C1 = Math.hypot(a1p, b1), C2 = Math.hypot(a2p, b2);
  const hw = (p, q) => { if (!p && !q) return 0; const v = Math.atan2(q, p) / rad; return v < 0 ? v + 360 : v; };
  const h1 = hw(a1p, b1), h2 = hw(a2p, b2);
  let dh = 0; if (C1 * C2) { dh = h2 - h1; if (dh > 180) dh -= 360; else if (dh < -180) dh += 360; }
  const dH = 2 * Math.sqrt(C1 * C2) * Math.sin(dh * rad / 2), Lm = (L1 + L2) / 2, Cp = (C1 + C2) / 2;
  let hm = h1 + h2; if (C1 * C2) { if (Math.abs(h1 - h2) > 180) hm += h1 + h2 < 360 ? 360 : -360; hm /= 2; }
  const T = 1 - 0.17 * Math.cos((hm - 30) * rad) + 0.24 * Math.cos(2 * hm * rad) + 0.32 * Math.cos((3 * hm + 6) * rad) - 0.2 * Math.cos((4 * hm - 63) * rad);
  const SL = 1 + 0.015 * (Lm - 50) ** 2 / Math.sqrt(20 + (Lm - 50) ** 2), SC = 1 + 0.045 * Cp, SH = 1 + 0.015 * Cp * T;
  const RT = -2 * Math.sqrt(Cp ** 7 / (Cp ** 7 + 25 ** 7)) * Math.sin(60 * Math.exp(-(((hm - 275) / 25) ** 2)) * rad);
  return Math.sqrt(((L2 - L1) / SL) ** 2 + ((C2 - C1) / SC) ** 2 + (dH / SH) ** 2 + RT * ((C2 - C1) / SC) * (dH / SH));
};
// Eichung am 14.11.2026: Flos Gruppe lag bei 3,5 bis 7,1 (Thron/Sonnenkrone 3,5, Thron/Bernstein 7,1); 10 liegt klar darueber
const MIN_ABSTAND = 10;
const abstand = (x, y) => (de00(x.hell, y.hell) + de00(x.dunkel, y.dunkel)) / 2;
const nah = [];
for (let i = 0; i < alle.length; i++) for (let j = i + 1; j < alle.length; j++) { const d = abstand(alle[i], alle[j]); if (d < MIN_ABSTAND) nah.push([alle[i].id, alle[j].id, +d.toFixed(1)]); }
nah.sort((p, q) => p[2] - q[2]);
pruefe(`Je zwei Bretter mindestens ${MIN_ABSTAND} Farbabstand auseinander`, alle.length === 65 && nah.length === 0, nah.slice(0, 25));
const FLO = ['thron', 'topas', 'bernstein', 'kuerbis', 'sonnenkrone'];
pruefe('Flos Gruppe (Thron, Topas, Bernstein, Kuerbis, Sonnenkrone) liegt auseinander', FLO.every((x) => alle.some((b) => b.id === x))
  && nah.every(([p, q]) => !(FLO.includes(p) && FLO.includes(q))), nah.filter(([p, q]) => FLO.includes(p) && FLO.includes(q)));

// ---------- Laufzeit
const attrappe = (brett) => {
  const werte = new Map();
  return { dataset: { brett }, werte, style: { setProperty: (k, v) => werte.set(k, v), removeProperty: (k) => werte.delete(k) } };
};
const mitFlaeche = besonders.find((b) => b.flaeche && b.bewegung) || besonders.find((b) => b.flaeche);
if (typeof brettFlaeche !== 'function' || !mitFlaeche) pruefe('brettFlaeche(html, id, frei) aus js/labor.js', false);
else {
  const html = attrappe(mitFlaeche.id);
  await brettFlaeche(html, mitFlaeche.id, true);
  const m = brettMuster(mitFlaeche);
  pruefe('Laufzeit: Oberflaeche am html gesetzt (hell, dunkel, Groesse)', html.werte.get('--feld-muster-hell') === svgUrl(m.h)
    && html.werte.get('--feld-muster-dunkel') === svgUrl(m.d) && html.werte.get('--feld-muster-groesse') === GROESSE, [...html.werte.keys()]);
  html.dataset.brett = 'nacht';
  await brettFlaeche(html, 'nacht', true);
  pruefe('Laufzeit: Wechsel auf ein Brett ohne Oberflaeche raeumt alle drei ab', html.werte.size === 0, [...html.werte.keys()]);
  const fremd = attrappe(mitFlaeche.id);
  await brettFlaeche(fremd, mitFlaeche.id, false);
  pruefe('Laufzeit: ohne Erfinder-Konto wird nichts gesetzt', fremd.werte.size === 0);
  const spaet = attrappe(mitFlaeche.id);
  const lauf = brettFlaeche(spaet, mitFlaeche.id, true);
  spaet.dataset.brett = 'nacht';
  await lauf;
  pruefe('Laufzeit: wechselt das Brett waehrend des Ladens, bleibt nichts haengen', spaet.werte.size === 0, [...spaet.werte.keys()]);
}

// ---------- Sammelbild
if (typeof brettKunst === 'function' && mitFlaeche) {
  const m = brettMuster(mitFlaeche);
  const bild = brettKunst(mitFlaeche.hell, mitFlaeche.dunkel, mitFlaeche.rand, '', m);
  pruefe('Sammelbild: Oberflaeche je Feldfarbe auf ihre Felder beschnitten (clipPath)', (bild.match(/<clipPath /g) || []).length === 2
    && (bild.match(/clip-path="url\(#/g) || []).length === 2 && bild.includes(m.h.slice(0, 80)) && bild.includes(m.d.slice(0, 80)));
  const welt = LABOR_BRETTER.find((b) => b.muster && !b.flaeche);
  pruefe('Sammelbild: Bretter mit Zeichnung je Feld bleiben wie bisher', !!welt && (brettKunst('#fff', '#000', '#111', '', welt.muster).match(/class="sk-muster"/g) || []).length === 9);
}

// ---------- Browser: Ausschnitt je Feld
const require = createRequire(import.meta.url);
let chromium = null;
for (const p of [process.env.PLAYWRIGHT_PFAD, 'playwright'].filter(Boolean)) { try { ({ chromium } = require(p)); break; } catch (e) { /* weiter */ } }
if (!chromium) pruefe('Playwright fuer den Browser-Teil (PLAYWRIGHT_PFAD)', false);
else if (!mitFlaeche || !besonders.some((b) => b.flaeche && !b.bewegung)) pruefe('Browser-Teil braucht Bretter mit Oberflaeche, mit und ohne Glanz', false);
else {
  const PORT = await (await import('./freier-port.mjs')).freierPort();
  const server = spawn(process.execPath, [path.join(WURZEL, 'tests/testserver.mjs'), String(PORT)], { cwd: WURZEL, stdio: 'ignore' });
  const basis = `http://127.0.0.1:${PORT}/werkzeuge/bretter-vorschau.html`;
  let browser;
  try {
    for (let v = 0; v < 50; v++) { try { await fetch(basis); break; } catch (e) { await new Promise((r) => setTimeout(r, 100)); } }
    browser = await chromium.launch();
    const s = await browser.newPage({ viewport: { width: 700, height: 700 } });
    const fehler = [];
    s.on('pageerror', (e) => fehler.push(e.message));
    const lage = async (id) => {
      await s.goto(`${basis}?brett=${id}`);
      await s.waitForFunction(() => window.vorschauFertig === true, null, { timeout: 30000 });
      await s.waitForFunction(() => getComputedStyle(document.querySelector('.feld')).backgroundImage !== 'none' || !document.documentElement.style.getPropertyValue('--feld-muster-hell'), null, { timeout: 15000 }).catch(() => {});
      return s.evaluate(() => [0, 9, 63].map((i) => { const c = getComputedStyle(document.querySelectorAll('.brett .feld')[i]); return [c.backgroundSize, c.backgroundPosition, c.backgroundImage.slice(0, 30)]; }));
    };
    const ohneGlanz = besonders.find((b) => b.flaeche && !b.bewegung);
    const a = await lage(ohneGlanz.id);
    pruefe('Browser: Feld a8, b7 und h1 zeigen ihren Ausschnitt (800 %, Lage nach Spalte und Reihe)', a[0][0] === '800% 800%'
      && a[0][1] === '0% 0%' && /^14\.28\d*% 14\.28\d*%$/.test(a[1][1]) && a[2][1] === '100% 100%' && /^url\(/.test(a[0][2]), a);
    const g = await lage(mitFlaeche.id);
    pruefe('Browser: beim Glanz behaelt die Oberflaeche ihren Ausschnitt', /^800% 800%, 400% 100%$/.test(g[2][0]) && /^100% 100%, /.test(g[2][1]), g);
    const schlichtes = await lage('schiefer');
    pruefe('Browser: Zeichnung je Feld bleibt 100 % (schiefer)', schlichtes[0][0] === '100% 100%' && /^url\(/.test(schlichtes[0][2]), schlichtes);
    // Boeden an gerasterten Pixeln (Kaltreview 14.11., Probe rv-boden): je Brett die Zeichnung in Spielgroesse (360 px) als
    // CSS-Hintergrund ueber der Feldfarbe, also auf demselben Weg wie im Spiel, als Bildschirmfoto; Glanz voll deckend dazu,
    // nur die Pixel der hellen bzw. dunklen Felder. Kein Canvas-drawImage: das stapelt bei einer Gruppe mit nur einem Pfad
    // die Kantenglaettung der Teilpfade (Nabe eines Netzes 79 statt 228), der CSS-Hintergrund nicht. Gemessen am
    // 0,5-%-Quantil (ein einzelnes Kantenpixel ist kein Lesbarkeitsproblem); der extremste Pixel steht in der Ausgabe
    const svg = (innen, vb) => 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${vb} ${vb}' preserveAspectRatio='none'>${innen}</svg>`);
    const r = await browser.newPage({ viewport: { width: 720, height: 360 }, deviceScaleFactor: 1 });
    const raster = [];
    for (const b of alle) {
      const f = typeof brettMuster === 'function' ? brettMuster(b) : null;
      const m = f || b.muster || null;
      const flaeche = (grund, innen) => `<div style="width:360px;height:360px;background-color:${grund};${m ? `background-image:url(&quot;${svg(innen, f ? 800 : 100)}&quot;);background-size:${f ? '100% 100%' : '12.5% 12.5%'}` : ''}"></div>`;
      await r.setContent(`<body style="margin:0;display:flex">${flaeche(b.hell, m && m.h)}${flaeche(b.dunkel, m && m.d)}</body>`);
      const foto = (await r.screenshot({ clip: { x: 0, y: 0, width: 720, height: 360 } })).toString('base64');
      raster.push(await r.evaluate(async ({ foto, glanz, id, BODEN }) => {
        const lum = (R, G, B) => [R, G, B].map((v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; })
          .reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
        const k = (x, y) => (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
        const N = 360, F = N / 8;
        const bild = new Image(); await new Promise((ok, f) => { bild.onload = ok; bild.onerror = f; bild.src = 'data:image/png;base64,' + foto; });
        const c = document.createElement('canvas'); c.width = 2 * N; c.height = N; const x = c.getContext('2d'); x.drawImage(bild, 0, 0);
        const d = x.getImageData(0, 0, 2 * N, N).data;
        const g = /rgba\(([\d.]+),\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)\)/.exec(glanz || '');
        const q = (arr, p) => arr[Math.min(arr.length - 1, Math.max(0, Math.round(p * (arr.length - 1))))];
        const werte = (links, paritaet) => {
          const L = [], Lg = [];
          for (let py = 0; py < N; py++) for (let px = 0; px < N; px++) {
            if ((Math.floor(px / F) + Math.floor(py / F)) % 2 !== paritaet) continue;
            const i = (py * 2 * N + px + links) * 4;
            L.push(lum(d[i], d[i + 1], d[i + 2]));
            if (g) { const a = +g[4]; Lg.push(lum(...[0, 1, 2].map((j) => d[i + j] * (1 - a) + +g[j + 1] * a))); }
          }
          const s = L.sort((a, b) => a - b), sg = g ? Lg.sort((a, b) => a - b) : s;
          return { min: s[0], max: Math.max(s[s.length - 1], sg[sg.length - 1]), q005: q(s, 0.005), q995: Math.max(q(s, 0.995), q(sg, 0.995)) };
        };
        const H = werte(0, 0), D = werte(N, 1);
        const mass = (hMin, dMax, dMin) => ({ feld: k(hMin, dMax), weissAufDunkel: k(1, dMax), schwarzAufDunkel: k(0, dMin), schwarzAufHell: k(0, hMin) });
        const qu = mass(H.q005, D.q995, D.q005), px = mass(H.min, D.max, D.min);
        return { id, unterQ: Object.entries(BODEN).filter(([n, v]) => qu[n] < v).map(([n]) => n + ' ' + qu[n].toFixed(2)),
          unterPx: Object.entries(BODEN).filter(([n, v]) => px[n] < v).map(([n]) => n + ' ' + px[n].toFixed(2)) };
      }, { foto, glanz: b.glanz || null, id: b.id, BODEN }));
    }
    const unterQ = raster.filter((e) => e.unterQ.length), unterPx = raster.filter((e) => e.unterPx.length);
    console.log(`Raster: ${raster.length} Bretter, am 0,5-%-Quantil unter einem Boden ${unterQ.length}, am extremsten Pixel ${unterPx.length}`
      + (unterPx.length ? ' (' + unterPx.map((e) => e.id + ' ' + e.unterPx.join('/')).join('; ') + ')' : ''));
    pruefe('Raster: alle 65 halten die vier Boeden an gerasterten Pixeln (0,5-%-Quantil, Glanz voll deckend)', raster.length === 65 && unterQ.length === 0,
      unterQ.map((e) => [e.id, e.unterQ]));
    pruefe('Browser: keine Seitenfehler', fehler.length === 0, fehler);
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
}

console.log(`${ok}/${ok + fehl} bestanden`);
process.exit(fehl ? 1 : 0);
