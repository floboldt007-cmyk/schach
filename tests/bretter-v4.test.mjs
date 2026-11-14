// Motiv-Bretter, Fassung 4 (Flo 14.11.2026 zu Fassung 3: "man erkennt das Brett gar nicht mehr"). 20 Entwuerfe
// (js/brett-motive-v4.js): das Brett ist auf den ersten Blick ein klares Schachbrett, das Motiv lebt nur leise IN den
// Feldern (feine Textur, hoechstens 15 % Kontrast innerhalb eines Feldes) und im RAHMEN. Kein Bild ueber die Felder hinweg.
// Nur Vorschau, nicht in der App. Geprueft wird:
//   Katalog    20 Motive, Ids eindeutig und kein vorhandenes Brett, Name, Idee, Konkret-Satz, Seltenheit, Weg, Rahmen, Koordinaten
//   Textur     je Feldart ein Bild aus 64 Zellen (je Feld eine eigene <svg>-Zelle, die schneidet ab: nichts reicht ueber
//              ein Feld hinaus), eigene Zeichnung ohne <image> und ohne Adresse nach aussen
//   Farben     Herleitung A aus den Farben im Code: Textur innerhalb einer Feldart hoechstens 1,15, Feld hell gegen Feld
//              dunkel mind. 3,0 an der schlechtesten Stelle, weiss und schwarz auf dunkel 3,0, schwarz auf hell 7,0,
//              Koordinaten mind. 3,0 gegen das ganze Feld
//   Raster     Herleitung B am echten Brett (js/board.js, css/board.css), Bildschirmfoto, je Feld ohne den aeussersten Pixel,
//              STRENG: kleinster und groesster Pixel (kein Quantil). Feld hell gegen dunkel (streng und im Mittel), die drei
//              Figuren-Boeden, je Feld die Textur hoechstens 1,15, und die Textur ist zu sehen
//   Koordinaten am Brett: Brett mit und ohne Koordinaten fotografiert, die abweichenden Pixel sind die Schrift; je Feld
//              der Kern (oberste 30 % der Abweichung), Median-Kontrast Schrift gegen Feld mind. 3,0
//   Bewegung   jede motiv-Animation laeuft auf .motiv-brett (dem Rahmen), keine im Brett, keine bei "weniger Bewegung"
//   Gegenproben  eine Animation auf .brett .feld und eine starke Textur auf einem Feld werden erkannt (die Pruefung
//              selbst wird geprueft)
//   node tests/bretter-v4.test.mjs     (Browser-Teil braucht Playwright, PLAYWRIGHT_PFAD oder node_modules)
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let ok = 0, fehl = 0;
const pruefe = (name, bed, info) => { if (bed) { ok++; console.log('ok   ' + name); } else { fehl++; console.log('FEHLER', name, info === undefined ? '' : JSON.stringify(info)); } };
const laden = async (p) => { try { return await import(p); } catch (e) { pruefe('Modul ladbar: ' + p, false, e.message); return {}; } };

const { MOTIVE = [], GRENZE, texturBild, feldFarben, koordFarben, rahmenBild, motivCss } = await laden('../js/brett-motive-v4.js');
const { LABOR_BRETTER = [] } = await laden('../js/labor.js');
const { wegText } = await laden('../werkzeuge/bretter-katalog.mjs');

const BODEN = { feld: 3.0, weissAufDunkel: 3.0, schwarzAufDunkel: 3.0, schwarzAufHell: 7.0 };
const TEXTUR_MAX = 1.15, KOORD_MIN = 3.0;
const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const lum = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const hexLum = (h) => { const n = parseInt(h.slice(1), 16); return lum(n >> 16, (n >> 8) & 255, n & 255); };
const k = (x, y) => (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
const farben = (s) => [...new Set(String(s).match(/#[0-9a-f]{6}\b/gi) || [])];

// ---------- Katalog
const SELTEN = ['selten', 'episch', 'legende'];
const vorhanden = new Set(['nacht', 'gruen', 'holz', ...LABOR_BRETTER.map((b) => b.id)]);
pruefe('Katalog: 20 Motive', MOTIVE.length === 20, MOTIVE.length);
pruefe('Katalog: Ids eindeutig, [a-z-], kein vorhandenes Brett', MOTIVE.length > 0 && new Set(MOTIVE.map((m) => m.id)).size === MOTIVE.length
  && MOTIVE.every((m) => /^[a-z][a-z-]{2,30}$/.test(m.id) && !vorhanden.has(m.id)), MOTIVE.map((m) => m.id).filter((id) => vorhanden.has(id)));
pruefe('Katalog: Name, Idee und Konkret-Satz je Motiv, Namen eindeutig', MOTIVE.length > 0 && MOTIVE.every((m) => m.name && m.idee && m.konkret && m.konkret.length > 30)
  && new Set(MOTIVE.map((m) => m.name)).size === MOTIVE.length);
pruefe('Katalog: Seltenheit selten, episch oder legende', MOTIVE.length > 0 && MOTIVE.every((m) => SELTEN.includes(m.seltenheit)));
pruefe('Katalog: Weg aus vorhandener Mechanik, in Worten lesbar', MOTIVE.length > 0 && typeof wegText === 'function'
  && MOTIVE.every((m) => m.weg && ['level', 'welt', 'endgegner', 'stufe'].includes(m.weg.art) && wegText(m.weg).length > 4));
pruefe('Katalog: Rahmen-Ornament und Koordinaten-Stil je Motiv', MOTIVE.length > 0 && MOTIVE.every((m) => m.rahmen && typeof m.rahmen.zeichne === 'function' && m.koord && m.koord.schrift));

// ---------- Textur und Rahmen (Text)
const tex = typeof texturBild === 'function' ? MOTIVE.map((m) => [m, texturBild(m)]) : [];
pruefe('Textur: helles und dunkles Bild je Motiv, fest je Id', tex.length === 20 && tex.every(([m, b]) => b.h && b.d && b.h !== b.d && texturBild(m).h === b.h));
// jede Zelle ist eine eigene <svg> mit 100 x 100 an einem Feldplatz; ausserhalb der Zellen steht nichts
const zellen = (s) => {
  const auf = [...s.matchAll(/<svg x="(\d+)" y="(\d+)" width="100" height="100" viewBox="0 0 100 100">/g)].map((m) => `${m[1]},${m[2]}`);
  const tiefe = (s.match(/<svg\b/g) || []).length, zu = (s.match(/<\/svg>/g) || []).length;
  const draussen = s.replace(/<svg x="\d+" y="\d+" width="100" height="100" viewBox="0 0 100 100">[\s\S]*?<\/svg>/g, '');
  return { n: new Set(auf).size, plaetze: auf.every((p) => p.split(',').every((v) => +v % 100 === 0 && +v < 800)), tiefe, zu, draussen: draussen.trim() };
};
const zellFehler = tex.flatMap(([m, b]) => ['h', 'd'].map((a) => [m.id, a, zellen(b[a])]))
  .filter(([, , z]) => z.n !== 64 || !z.plaetze || z.tiefe !== 64 || z.zu !== 64 || z.draussen !== '');
pruefe('Textur: 64 Zellen je Bild, je Feld eine, nichts ausserhalb (kein Bild ueber die Felder hinweg)', tex.length === 20 && zellFehler.length === 0, zellFehler.slice(0, 4));
pruefe('Textur: eigene Zeichnung, kein <image>, keine Adresse nach aussen', tex.length === 20 && tex.every(([, b]) => !/<image|href|url\(|https?:/i.test(b.h + b.d)));
pruefe('Textur: keine zwei Motive gleich', new Set(tex.map(([, b]) => b.h)).size === 20 && new Set(tex.map(([, b]) => b.d)).size === 20);
const rahmen = typeof rahmenBild === 'function' ? MOTIVE.map((m) => [m, rahmenBild(m)]) : [];
const formen = (s) => (s.match(/<(path|circle|ellipse|rect|polygon|line)\b/g) || []).length;
pruefe('Rahmen: je Motiv ein eigenes Ornament (mind. 20 Formen), eigene Zeichnung', rahmen.length === 20
  && rahmen.every(([, r]) => formen(r) >= 20 && !/<image|href|https?:/i.test(r)) && new Set(rahmen.map(([, r]) => r)).size === 20,
  rahmen.filter(([, r]) => formen(r) < 20).map(([m, r]) => [m.id, formen(r)]));

// ---------- Farben (Herleitung A)
const farbFehler = [];
if (tex.length === 20 && typeof koordFarben === 'function') {
  for (const [m, b] of tex) {
    const H = farben(b.h).map(hexLum), D = farben(b.d).map(hexLum);
    const hMin = Math.min(...H), hMax = Math.max(...H), dMin = Math.min(...D), dMax = Math.max(...D);
    const a = { texturHell: k(hMin, hMax), texturDunkel: k(dMin, dMax), feld: k(hMin, dMax), weissAufDunkel: k(1, dMax), schwarzAufDunkel: k(0, dMin), schwarzAufHell: k(0, hMin) };
    const kf = koordFarben(m), kh = hexLum(kf.h), kd = hexLum(kf.d);
    a.koordHell = Math.min(k(kh, hMin), k(kh, hMax)); a.koordDunkel = Math.min(k(kd, dMin), k(kd, dMax));
    const unter = [...Object.entries(BODEN).filter(([n, v]) => a[n] < v), ...['koordHell', 'koordDunkel'].filter((n) => a[n] < KOORD_MIN).map((n) => [n]),
      ...['texturHell', 'texturDunkel'].filter((n) => a[n] > TEXTUR_MAX).map((n) => [n])].map(([n]) => n + ' ' + a[n].toFixed(3));
    if (unter.length) farbFehler.push([m.id, unter]);
  }
}
pruefe('Farben (Herleitung A): Textur hoechstens 1,15, Feld 3,0, Figuren 3,0/3,0/7,0, Koordinaten 3,0', tex.length === 20 && typeof koordFarben === 'function' && farbFehler.length === 0, farbFehler);
pruefe('Farben: GRENZE im Modul nennt dieselben Werte wie der Test', !!GRENZE && GRENZE.textur === TEXTUR_MAX && GRENZE.feld === BODEN.feld && GRENZE.koord === KOORD_MIN, GRENZE);

// ---------- Bewegung (Text)
const cssAlle = typeof motivCss === 'function' ? MOTIVE.map((m) => [m, motivCss(m)]) : [];
pruefe('Bewegung: Animationen nur bei Motiven mit bewegung und nur in @media (prefers-reduced-motion: no-preference)',
  cssAlle.length === 20 && cssAlle.every(([m, c]) => {
    const ohne = c.replace(/@media \(prefers-reduced-motion: no-preference\) \{[\s\S]*$/, '');
    return !/animation\s*:/.test(ohne) && (m.bewegung ? /prefers-reduced-motion: no-preference[\s\S]*animation\s*:/.test(c) : !/animation\s*:/.test(c));
  }), cssAlle.filter(([m, c]) => !!m.bewegung !== /animation\s*:/.test(c)).map(([m]) => m.id));

// ---------- Browser
const require = createRequire(import.meta.url);
let chromium = null;
for (const p of [process.env.PLAYWRIGHT_PFAD, 'playwright'].filter(Boolean)) { try { ({ chromium } = require(p)); break; } catch (e) { /* weiter */ } }
if (!chromium) pruefe('Playwright fuer den Browser-Teil (PLAYWRIGHT_PFAD)', false);
else if (MOTIVE.length !== 20) pruefe('Browser-Teil braucht die 20 Motive', false);
else {
  const PORT = await (await import('./freier-port.mjs')).freierPort();
  const server = spawn(process.execPath, [path.join(WURZEL, 'tests/testserver.mjs'), String(PORT)], { cwd: WURZEL, stdio: 'ignore' });
  const basis = `http://127.0.0.1:${PORT}/werkzeuge/bretter-vorschau-v4.html`;
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
    const laden = async (s, q) => { await s.goto(`${basis}?${q}`); await s.waitForFunction(() => window.vorschauFertig === true, null, { timeout: 30000 }); };
    // Foto der 400 px Felder als Leuchtdichte je Pixel (N = 400 * dsf)
    const foto = async (s, dsf = 1) => {
      const r = await s.locator('.brett').boundingBox();
      const b64 = (await s.screenshot({ clip: { x: Math.round(r.x), y: Math.round(r.y), width: 400, height: 400 } })).toString('base64');
      return s.evaluate(async ({ b64, N }) => {
        const bild = new Image(); await new Promise((ok, f) => { bild.onload = ok; bild.onerror = f; bild.src = 'data:image/png;base64,' + b64; });
        const c = document.createElement('canvas'); c.width = N; c.height = N; const x = c.getContext('2d'); x.drawImage(bild, 0, 0);
        const d = x.getImageData(0, 0, N, N).data, L = new Array(N * N);
        const li = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
        for (let i = 0; i < N * N; i++) L[i] = 0.2126 * li(d[i * 4]) + 0.7152 * li(d[i * 4 + 1]) + 0.0722 * li(d[i * 4 + 2]);
        return L;
      }, { b64, N: 400 * dsf });
    };
    // je Feld (ohne den aeussersten Pixel): kleinster, groesster, mittlerer Wert
    const felder = (L, N = 400) => {
      const F = N / 8, aus = [];
      for (let fy = 0; fy < 8; fy++) for (let fx = 0; fx < 8; fx++) {
        let lo = 1, hi = 0, s = 0, n = 0;
        for (let py = fy * F + 1; py < (fy + 1) * F - 1; py++) for (let px = fx * F + 1; px < (fx + 1) * F - 1; px++) {
          const v = L[py * N + px]; if (v < lo) lo = v; if (v > hi) hi = v; s += v; n++;
        }
        aus.push({ hell: (fx + fy) % 2 === 0, lo, hi, mittel: s / n, textur: k(lo, hi) });
      }
      return aus;
    };
    const auswerten = (f) => {
      const H = f.filter((x) => x.hell), D = f.filter((x) => !x.hell);
      const hMin = Math.min(...H.map((x) => x.lo)), dMax = Math.max(...D.map((x) => x.hi)), dMin = Math.min(...D.map((x) => x.lo));
      const mH = H.reduce((s, x) => s + x.mittel, 0) / H.length, mD = D.reduce((s, x) => s + x.mittel, 0) / D.length;
      return { feld: k(hMin, dMax), feldMittel: k(mH, mD), weissAufDunkel: k(1, dMax), schwarzAufDunkel: k(0, dMin), schwarzAufHell: k(0, hMin),
        texturMax: Math.max(...f.map((x) => x.textur)), texturMedian: f.map((x) => x.textur).sort((a, b) => a - b)[32] };
    };

    const s = await seite();
    // jedes Rahmen- und Texturbild laedt im Browser (ein ungueltiges SVG, etwa ein doppeltes Attribut, zeigt sonst still nichts)
    await laden(s, `brett=${MOTIVE[0].id}&nur=felder`);
    const svgLaedt = (liste) => s.evaluate((liste) => Promise.all(liste.map(([id, box, innen]) => new Promise((ok) => {
      const b = new Image();
      b.onload = () => ok([id, b.naturalWidth > 0]); b.onerror = () => ok([id, false]);
      b.src = 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${box} ${box}">${innen}</svg>`);
    }))), liste);
    const geladen = await svgLaedt(MOTIVE.flatMap((m) => [[m.id + ':rahmen', 1000, rahmenBild(m)], [m.id + ':hell', 800, texturBild(m).h], [m.id + ':dunkel', 800, texturBild(m).d]]));
    pruefe('SVG: alle 20 Rahmen und 40 Texturen laden im Browser', geladen.length === 60 && geladen.every(([, a]) => a), geladen.filter(([, a]) => !a).map(([id]) => id));
    const kaputt = await svgLaedt([['probe', 100, '<path d="M0 0H9" stroke-linecap="round" stroke-linecap="square"/>']]);
    pruefe('Gegenprobe: ein SVG mit doppeltem Attribut faellt der Lade-Pruefung auf', kaputt[0][1] === false);
    const raster = [];
    for (const m of MOTIVE) {
      await laden(s, `brett=${m.id}&nur=felder`);
      const e = { id: m.id, ...auswerten(felder(await foto(s))) };
      e.unter = [...Object.entries(BODEN).filter(([n, v]) => e[n] < v).map(([n]) => n + ' ' + e[n].toFixed(2)), ...(e.feldMittel < BODEN.feld ? ['feldMittel ' + e.feldMittel.toFixed(2)] : []),
        ...(e.texturMax > TEXTUR_MAX ? ['textur ' + e.texturMax.toFixed(3)] : [])];
      raster.push(e);
    }
    for (const e of raster) console.log(`     ${e.id.padEnd(15)} Feld ${e.feld.toFixed(2)} (Mittel ${e.feldMittel.toFixed(2)}) · weiss ${e.weissAufDunkel.toFixed(2)} · schwarz ${e.schwarzAufDunkel.toFixed(2)} · schwarz/hell ${e.schwarzAufHell.toFixed(2)} · Textur max ${e.texturMax.toFixed(3)} Median ${e.texturMedian.toFixed(3)}`);
    pruefe('Raster (Herleitung B, streng je Pixel): Feld hell gegen dunkel 3,0 (streng und im Mittel), Figuren 3,0/3,0/7,0, Textur je Feld hoechstens 1,15',
      raster.length === 20 && raster.every((e) => !e.unter.length), raster.filter((e) => e.unter.length).map((e) => [e.id, e.unter]));
    pruefe('Raster: die Textur ist zu sehen (Median der Felder ueber 1,02)', raster.every((e) => e.texturMedian > 1.02), raster.filter((e) => e.texturMedian <= 1.02).map((e) => [e.id, e.texturMedian.toFixed(3)]));

    // Koordinaten am Brett: dieselbe leere Stellung mit und ohne Koordinaten, doppelte Pixeldichte
    const s2 = await seite({ deviceScaleFactor: 2 });
    const koord = [];
    for (const m of MOTIVE) {
      await laden(s2, `brett=${m.id}&nur=felder`); const ohne = await foto(s2, 2);
      await laden(s2, `brett=${m.id}&nur=felder&koord=an`); const mit = await foto(s2, 2);
      const N = 800, F = 100, werte = [];
      for (let fy = 0; fy < 8; fy++) for (let fx = 0; fx < 8; fx++) {
        const px = [];
        for (let py = fy * F + 1; py < (fy + 1) * F - 1; py++) for (let qx = fx * F + 1; qx < (fx + 1) * F - 1; qx++) {
          const i = py * N + qx, a = Math.abs(Math.log((mit[i] + 0.05) / (ohne[i] + 0.05)));
          if (a > 0.05) px.push([a, k(mit[i], ohne[i])]);
        }
        if (px.length < 6) continue;
        const max = Math.max(...px.map((p) => p[0])), kern = px.filter((p) => p[0] >= 0.7 * max).map((p) => p[1]).sort((a, b) => a - b);
        werte.push(kern[Math.floor(kern.length / 2)]);
      }
      koord.push({ id: m.id, felder: werte.length, min: werte.length ? Math.min(...werte) : 0 });
    }
    console.log('     Koordinaten (Felder mit Schrift, schwaechstes Feld): ' + koord.map((e) => `${e.id} ${e.felder}/${e.min.toFixed(1)}`).join(' · '));
    pruefe('Koordinaten am Brett: 15 Felder mit Schrift, Kern-Kontrast je Feld mind. 3,0', koord.every((e) => e.felder === 15 && e.min >= KOORD_MIN),
      koord.filter((e) => e.felder !== 15 || e.min < KOORD_MIN));

    // Bewegung: jede motiv-Animation auf .motiv-brett, keine im Brett, keine bei "weniger Bewegung"
    const bewegung = (pg) => pg.evaluate(() => document.getAnimations().map((a) => {
      const t = a.effect && a.effect.target;
      return { name: String(a.animationName || ''), rahmen: !!(t && t.classList && t.classList.contains('motiv-brett')), imBrett: !!(t && t.closest && t.closest('.brett')) };
    }).filter((a) => a.name.startsWith('motiv-')));
    const falsch = (liste) => liste.filter((a) => !a.rahmen || a.imBrett);
    const bewegt = MOTIVE.filter((m) => m.bewegung), still = MOTIVE.filter((m) => !m.bewegung);
    const ruhig = await seite({ reducedMotion: 'reduce' });
    const mit = [], ohne = [], ziel = [];
    for (const m of MOTIVE) {
      await laden(s, `brett=${m.id}`); const a = await bewegung(s);
      mit.push([m.id, a.length]); if (falsch(a).length) ziel.push([m.id, falsch(a)]);
      await laden(ruhig, `brett=${m.id}`); ohne.push([m.id, (await bewegung(ruhig)).length]);
    }
    pruefe('Bewegung: Motive mit bewegung laufen, die ohne nicht, bei "weniger Bewegung" steht alles', bewegt.length > 0
      && bewegt.every((m) => mit.find(([id]) => id === m.id)[1] > 0) && still.every((m) => mit.find(([id]) => id === m.id)[1] === 0) && ohne.every(([, n]) => n === 0), { mit, ohne });
    pruefe('Bewegung: jede motiv-Animation laeuft auf dem Rahmen (.motiv-brett), keine auf Feldern oder Figuren', ziel.length === 0, ziel);

    // Gegenproben: die Pruefungen erkennen einen Fehler, wenn es einen gibt
    await laden(s, `brett=${bewegt[0].id}`);
    await s.addStyleTag({ content: '@keyframes motiv-probe { from { opacity: 1 } to { opacity: .9 } } .brett .feld { animation: motiv-probe 2s infinite alternate; }' });
    pruefe('Gegenprobe: eine motiv-Animation auf .brett .feld faellt der Ziel-Pruefung auf', falsch(await bewegung(s)).length > 0);
    await laden(s, `brett=${MOTIVE[0].id}&nur=felder`);
    await s.addStyleTag({ content: '.brett .feld.d:nth-child(2) { background-image: repeating-linear-gradient(90deg, #000 0 4px, #888 4px 8px) !important; }' });
    const probe = auswerten(felder(await foto(s)));
    pruefe('Gegenprobe: eine starke Textur auf einem Feld faellt der Textur-Pruefung auf', probe.texturMax > TEXTUR_MAX, probe.texturMax);

    // die Vorschau laeuft hell und dunkel
    for (const modus of ['hell', 'dunkel']) { await laden(s, `brett=${MOTIVE[0].id}&modus=${modus}`); }
    pruefe('Browser: keine Seitenfehler', fehler.length === 0, fehler);
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
}

console.log(`${ok}/${ok + fehl} bestanden`);
process.exit(fehl ? 1 : 0);
