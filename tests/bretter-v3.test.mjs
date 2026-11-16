// Motiv-Bretter, Fassung 3 (Flo 14.11.2026 abends: "bei den Brettern kannst du kreativer werden"; v2 war ihm "zu brav").
// 20 Entwuerfe mit einem echten Bild ueber das ganze Brett (js/brett-motive.js), nur Vorschau, nicht in der App.
// Geprueft wird:
//   Katalog    20 Motive, Ids eindeutig und nicht schon ein Brett (js/labor.js), Name, Seltenheit, Weg aus vorhandener
//              Mechanik, Rahmen und Koordinaten-Stil je Brett
//   Bild       je Motiv ein helles und ein dunkles Bild (viewBox 800), fest je Id, reich genug (Formen, Toene), eigene
//              Zeichnung: kein <image>, keine Adresse nach aussen
//   Baender    Herleitung A: jede Farbe des hellen Bilds liegt im hellen, jede des dunklen im dunklen Helligkeitsband;
//              aus den Baendern folgen die Boeden aus Fassung 2 (Feld 2,2, weiss und schwarz auf dunkel 3,0, schwarz auf
//              hell 7,0) und die Koordinaten (mind. 3,0 auf beiden Feldern)
//   Raster     Herleitung B: das echte Brett (js/board.js, Felder ueber css/board.css) als Bildschirmfoto, je Brett nur die
//              Pixel der hellen bzw. dunklen Felder, die vier Boeden am 0,5-%-Quantil (wie tests/bretter-oberflaechen),
//              der extremste Pixel steht in der Ausgabe
//   Bewegung   nur Motive mit bewegung haben Animationen, und nur ohne "weniger Bewegung" (prefers-reduced-motion)
//   node tests/bretter-v3.test.mjs     (Browser-Teil braucht Playwright: PLAYWRIGHT_PFAD)
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let ok = 0, fehl = 0;
const pruefe = (name, bed, info) => { if (bed) { ok++; console.log('ok   ' + name); } else { fehl++; console.log('FEHLER', name, info === undefined ? '' : JSON.stringify(info)); } };
const laden = async (p) => { try { return await import(p); } catch (e) { pruefe('Modul ladbar: ' + p, false, e.message); return {}; } };

const { MOTIVE = [], BAND, motivBild, motivCss, koordFarben } = await laden('../js/brett-motive.js');
const { LABOR_BRETTER = [] } = await laden('../js/labor.js');
const { wegText } = await laden('../werkzeuge/bretter-katalog.mjs');

const BODEN = { feld: 2.2, weissAufDunkel: 3.0, schwarzAufDunkel: 3.0, schwarzAufHell: 7.0 };
const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const lum = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const hexLum = (h) => { const n = parseInt(h.slice(1), 16); return lum(n >> 16, (n >> 8) & 255, n & 255); };
const k = (x, y) => (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);

// ---------- Katalog
const SELTEN = ['selten', 'episch', 'legende'];
const vorhanden = new Set(['nacht', 'gruen', 'holz', ...LABOR_BRETTER.map((b) => b.id)]);
pruefe('Katalog: 20 Motive', MOTIVE.length === 20, MOTIVE.length);
pruefe('Katalog: Ids eindeutig, [a-z-], kein vorhandenes Brett', new Set(MOTIVE.map((m) => m.id)).size === MOTIVE.length
  && MOTIVE.every((m) => /^[a-z][a-z-]{2,30}$/.test(m.id) && !vorhanden.has(m.id)), MOTIVE.map((m) => m.id).filter((id) => vorhanden.has(id)));
pruefe('Katalog: Name und Idee je Motiv, Namen eindeutig', MOTIVE.every((m) => m.name && m.idee) && new Set(MOTIVE.map((m) => m.name)).size === MOTIVE.length);
pruefe('Katalog: Seltenheit selten, episch oder legende', MOTIVE.every((m) => SELTEN.includes(m.seltenheit)), MOTIVE.filter((m) => !SELTEN.includes(m.seltenheit)).map((m) => m.id));
pruefe('Katalog: Weg aus vorhandener Mechanik (Level, Welt, Endgegner, Erfolgs-Stufe), in Worten lesbar',
  typeof wegText === 'function' && MOTIVE.every((m) => m.weg && ['level', 'welt', 'endgegner', 'stufe'].includes(m.weg.art) && wegText(m.weg).length > 4),
  MOTIVE.filter((m) => !m.weg || typeof wegText !== 'function' || !wegText(m.weg)).map((m) => m.id));
pruefe('Katalog: Rahmen und Koordinaten-Stil je Motiv', MOTIVE.every((m) => m.rahmen && m.koord && m.koord.schrift));

// ---------- Bild
const bilder = typeof motivBild === 'function' ? MOTIVE.map((m) => [m, motivBild(m)]) : [];
pruefe('Bild: helles und dunkles Bild je Motiv, verschieden', bilder.length === 20 && bilder.every(([, b]) => b && b.h && b.d && b.h !== b.d));
pruefe('Bild: fest je Id (zweimal gerechnet gleich)', bilder.every(([m, b]) => motivBild(m).h === b.h && motivBild(m).d === b.d));
const formen = (s) => (s.match(/<(path|circle|ellipse|rect|polygon|line)\b/g) || []).length;
const farben = (s) => [...new Set(s.match(/#[0-9a-f]{6}\b/gi) || [])];
pruefe('Bild: mindestens 40 Formen und 4 Toene je Bild', bilder.every(([, b]) => formen(b.h) >= 40 && farben(b.h).length >= 4),
  bilder.filter(([, b]) => formen(b.h) < 40 || farben(b.h).length < 4).map(([m, b]) => [m.id, formen(b.h), farben(b.h).length]));
pruefe('Bild: eigene Zeichnung, kein <image>, keine Adresse nach aussen',
  bilder.every(([, b]) => !/<image|href|url\(|https?:/i.test(b.h + b.d)));
pruefe('Bild: keine zwei Motive gleich', new Set(bilder.map(([, b]) => b.h)).size === 20);

// ---------- Baender (Herleitung A)
const ausBand = [];
for (const [m, b] of bilder) {
  for (const [seite, band] of [['h', BAND && BAND.hell], ['d', BAND && BAND.dunkel]]) {
    for (const f of farben(b[seite])) { const L = hexLum(f); if (!band || L < band[0] - 0.004 || L > band[1] + 0.004) ausBand.push([m.id, seite, f, +L.toFixed(3)]); }
  }
}
pruefe('Baender: jede Farbe des hellen Bilds im hellen Band, jede des dunklen im dunklen', bilder.length === 20 && ausBand.length === 0, ausBand.slice(0, 8));
if (BAND) {
  const [hLo] = BAND.hell, [dLo, dHi] = BAND.dunkel;
  const aus = { feld: k(hLo, dHi), weissAufDunkel: k(1, dHi), schwarzAufDunkel: k(0, dLo), schwarzAufHell: k(0, hLo) };
  pruefe('Baender: die Grenzen halten die vier Boeden aus Fassung 2', Object.entries(BODEN).every(([n, v]) => aus[n] >= v), aus);
}
const koordAus = [];
if (typeof koordFarben === 'function' && BAND) {
  for (const m of MOTIVE) {
    const f = koordFarben(m);
    const aufHell = Math.min(...BAND.hell.map((L) => k(hexLum(f.h), L))), aufDunkel = Math.min(...BAND.dunkel.map((L) => k(hexLum(f.d), L)));
    if (aufHell < 3 || aufDunkel < 3) koordAus.push([m.id, aufHell.toFixed(2), aufDunkel.toFixed(2)]);
  }
}
pruefe('Koordinaten: mind. 3,0 auf hellen und dunklen Feldern (ganzes Band)', typeof koordFarben === 'function' && koordAus.length === 0, koordAus);

// ---------- Bewegung (Text)
const cssAlle = typeof motivCss === 'function' ? MOTIVE.map((m) => [m, motivCss(m)]) : [];
pruefe('Bewegung: Animationen nur bei Motiven mit bewegung und nur in @media (prefers-reduced-motion: no-preference)',
  cssAlle.length === 20 && cssAlle.every(([m, c]) => {
    const ohne = c.replace(/@media \(prefers-reduced-motion: no-preference\) \{[\s\S]*$/, '');
    return !/animation\s*:/.test(ohne) && (m.bewegung ? /prefers-reduced-motion: no-preference[\s\S]*animation\s*:/.test(c) : !/animation\s*:/.test(c));
  }), cssAlle.filter(([m, c]) => !!m.bewegung !== /animation\s*:/.test(c)).map(([m]) => m.id));

// ---------- Browser: Raster (Herleitung B) und Bewegung
const require = createRequire(import.meta.url);
let chromium = null;
for (const p of [process.env.PLAYWRIGHT_PFAD, 'playwright'].filter(Boolean)) { try { ({ chromium } = require(p)); break; } catch (e) { /* weiter */ } }
if (!chromium) pruefe('Playwright fuer den Browser-Teil (PLAYWRIGHT_PFAD)', false);
else if (MOTIVE.length !== 20) pruefe('Browser-Teil braucht die 20 Motive', false);
else {
  const PORT = await (await import('./freier-port.mjs')).freierPort();
  const server = spawn(process.execPath, [path.join(WURZEL, 'tests/testserver.mjs'), String(PORT)], { cwd: WURZEL, stdio: 'ignore' });
  const basis = `http://127.0.0.1:${PORT}/werkzeuge/bretter-vorschau-v3.html`;
  let browser;
  try {
    for (let v = 0; v < 50; v++) { try { await fetch(basis); break; } catch (e) { await new Promise((r) => setTimeout(r, 100)); } }
    browser = await chromium.launch();
    const fehler = [];
    const seite = async (opt = {}) => {
      const s = await browser.newPage({ viewport: { width: 420, height: 520 }, deviceScaleFactor: 1, ...opt });
      s.on('pageerror', (e) => fehler.push(e.message));
      return s;
    };
    // nur Felder: ohne Figuren, Koordinaten und Markierungen, Brett 400 px (je Feld 50 px)
    const s = await seite();
    const raster = [];
    for (const m of MOTIVE) {
      await s.goto(`${basis}?brett=${m.id}&nur=felder`);
      await s.waitForFunction(() => window.vorschauFertig === true, null, { timeout: 30000 });
      const r = await s.locator('.brett').boundingBox();
      const foto = (await s.screenshot({ clip: { x: Math.round(r.x), y: Math.round(r.y), width: 400, height: 400 } })).toString('base64');
      raster.push(await s.evaluate(async ({ foto, id, BODEN }) => {
        const lum = (R, G, B) => [R, G, B].map((v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; })
          .reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
        const k = (x, y) => (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
        const N = 400, F = 50;
        const bild = new Image(); await new Promise((ok, f) => { bild.onload = ok; bild.onerror = f; bild.src = 'data:image/png;base64,' + foto; });
        const c = document.createElement('canvas'); c.width = N; c.height = N; const x = c.getContext('2d'); x.drawImage(bild, 0, 0);
        const d = x.getImageData(0, 0, N, N).data;
        const q = (arr, p) => arr[Math.min(arr.length - 1, Math.max(0, Math.round(p * (arr.length - 1))))];
        // je Feld ohne den aeussersten Pixel (Feldkante, dort grenzen helles und dunkles Bild aneinander)
        const werte = (paritaet) => {
          const L = [];
          for (let py = 0; py < N; py++) for (let px = 0; px < N; px++) {
            if ((Math.floor(px / F) + Math.floor(py / F)) % 2 !== paritaet || px % F === 0 || py % F === 0 || px % F === F - 1 || py % F === F - 1) continue;
            const i = (py * N + px) * 4; L.push(lum(d[i], d[i + 1], d[i + 2]));
          }
          const s = L.sort((a, b) => a - b);
          return { min: s[0], max: s[s.length - 1], q005: q(s, 0.005), q995: q(s, 0.995), spanne: q(s, 0.95) - q(s, 0.05) };
        };
        const H = werte(0), D = werte(1);
        const mass = (hMin, dMax, dMin) => ({ feld: k(hMin, dMax), weissAufDunkel: k(1, dMax), schwarzAufDunkel: k(0, dMin), schwarzAufHell: k(0, hMin) });
        const qu = mass(H.q005, D.q995, D.q005), px = mass(H.min, D.max, D.min);
        return { id, qu, px, spanneH: H.spanne, spanneD: D.spanne,
          unterQ: Object.entries(BODEN).filter(([n, v]) => qu[n] < v).map(([n]) => n + ' ' + qu[n].toFixed(2)),
          unterPx: Object.entries(BODEN).filter(([n, v]) => px[n] < v).map(([n]) => n + ' ' + px[n].toFixed(2)) };
      }, { foto, id: m.id, BODEN }));
    }
    for (const e of raster) console.log(`     ${e.id.padEnd(16)} Feld ${e.qu.feld.toFixed(2)} · weiss ${e.qu.weissAufDunkel.toFixed(2)} · schwarz ${e.qu.schwarzAufDunkel.toFixed(2)} · schwarz/hell ${e.qu.schwarzAufHell.toFixed(2)}`
      + (e.unterPx.length ? `   extremster Pixel unter: ${e.unterPx.join(', ')}` : ''));
    const unterQ = raster.filter((e) => e.unterQ.length);
    pruefe('Raster: alle 20 halten die vier Boeden am echten Brett (0,5-%-Quantil)', raster.length === 20 && unterQ.length === 0, unterQ.map((e) => [e.id, e.unterQ]));
    // das Bild ist zu sehen: auf den Feldern schwankt die Helligkeit sichtbar (sonst waere es nur eine Farbe)
    const flach = raster.filter((e) => e.spanneH < 0.06 || e.spanneD < 0.012);
    pruefe('Raster: auf hellen und dunklen Feldern ist ein Bild zu sehen (Helligkeit schwankt)', flach.length === 0,
      flach.map((e) => [e.id, e.spanneH.toFixed(3), e.spanneD.toFixed(3)]));

    const zaehle = async (pg, id) => {
      await pg.goto(`${basis}?brett=${id}`);
      await pg.waitForFunction(() => window.vorschauFertig === true, null, { timeout: 30000 });
      // nur die eigenen (motiv-*); das Brett blendet den letzten Zug mit brett-ein ein, das ist App-Verhalten und endlich
      return pg.evaluate(() => document.getAnimations().filter((a) => String(a.animationName || '').startsWith('motiv-')).length);
    };
    const bewegt = MOTIVE.filter((m) => m.bewegung), still = MOTIVE.find((m) => !m.bewegung);
    const ruhig = await seite({ reducedMotion: 'reduce' });
    const mit = [], ohne = [];
    for (const m of bewegt) { mit.push([m.id, await zaehle(s, m.id)]); ohne.push([m.id, await zaehle(ruhig, m.id)]); }
    pruefe('Bewegung: Motive mit bewegung laufen, bei "weniger Bewegung" steht alles', bewegt.length > 0 && mit.every(([, n]) => n > 0) && ohne.every(([, n]) => n === 0), { mit, ohne });
    pruefe('Bewegung: Motive ohne bewegung haben keine Animation', !still || (await zaehle(s, still.id)) === 0);
    pruefe('Browser: keine Seitenfehler', fehler.length === 0, fehler);
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
}

console.log(`${ok}/${ok + fehl} bestanden`);
process.exit(fehl ? 1 : 0);
