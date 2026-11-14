// Figurensatz-ENTWUERFE fuer Flos Auswahlseite (R19, 14.11.2026: "rund 20 Figurensaetze als Entwurf, gebaut erst nach
// Flos Wahl"). Nichts davon ist in der App: kein Eintrag in js/figurensatz.js, kein Ordner unter assets/pieces/.
// Alle 20 Stile sind eigene Zeichnungen (GPL-3.0 wie das Projekt). Grundlage ist EIN Satz Umrisse (FORM unten),
// jeder Stil malt ihn anders. Bewusst fehlen Stile, die es schon gibt (Neon, Glas, Marmor, Gold, Holz, Pixel, Geo ...).
// Wird ein Satz gewaehlt: Ordner nach assets/pieces/<id>/ kopieren, PFADE in js/figurensatz.js, Zeile in
// assets/LIZENZ-KUNST.md, Labor oder Shop wie bei den anderen.
//   node werkzeuge/figuren-entwurf.mjs                 schreibt design/figuren-entwurf/<nn-name>/*.svg
//   node werkzeuge/figuren-entwurf.mjs --bilder <ordner>   dazu je Satz ein Vorschaubild <nn-name>.png (390 px breit)
//   node werkzeuge/figuren-entwurf.mjs --pruefen       prueft Ordner gegen den Code und laedt jede Figur im Browser
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import path from 'node:path';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ZIEL = path.join(WURZEL, 'design/figuren-entwurf');
const FIGUREN = ['K', 'Q', 'R', 'B', 'N', 'P'];

// ---------- Umrisse im 45er-Raster: Vielecke [[x,y],...] und Kreise {k:[x,y,r]} ----------
const SOCKEL = [[10, 40], [35, 40], [34, 36], [11, 36]];
const FORM = {
  P: [{ k: [22.5, 14.5, 5.5] }, [[19, 19.5], [26, 19.5], [27.5, 23], [17.5, 23]], [[14, 36], [31, 36], [27, 23], [18, 23]], SOCKEL],
  R: [[[13.5, 36], [31.5, 36], [29.5, 17.5], [15.5, 17.5]],
    [[12, 18], [33, 18], [33, 8.5], [28.5, 8.5], [28.5, 12], [24.8, 12], [24.8, 8.5], [20.2, 8.5], [20.2, 12], [16.5, 12], [16.5, 8.5], [12, 8.5]], SOCKEL],
  B: [{ k: [22.5, 6, 2.2] }, [[22.5, 7.5], [27, 12], [29, 17.5], [27.5, 22], [17.5, 22], [16, 17.5], [18, 12]],
    [[17, 21.5], [28, 21.5], [28.5, 25], [16.5, 25]], [[14, 36], [31, 36], [27, 25], [18, 25]], SOCKEL],
  N: [[[13, 36], [33, 36], [32, 27], [30.5, 19], [27.5, 13], [24, 9.5], [23.5, 5.5], [20.5, 8.5], [17.5, 9.5], [12.5, 14.5],
    [9, 21.5], [9.5, 24.5], [12.5, 25.5], [17, 21.5], [19.5, 22], [15.5, 29]], SOCKEL],
  Q: [{ k: [10.5, 10, 2] }, { k: [19.5, 7.5, 2] }, { k: [25.5, 7.5, 2] }, { k: [34.5, 10, 2] },
    [[13.5, 23], [31.5, 23], [34.5, 10.5], [28.5, 17], [25.5, 8], [22.5, 16], [19.5, 8], [16.5, 17], [10.5, 10.5]],
    [[13.5, 22.5], [31.5, 22.5], [31, 26], [14, 26]], [[13.5, 36], [31.5, 36], [28, 26], [17, 26]], SOCKEL],
  K: [[[21, 15], [24, 15], [24, 10.5], [27, 10.5], [27, 7.5], [24, 7.5], [24, 4], [21, 4], [21, 7.5], [18, 7.5], [18, 10.5], [21, 10.5]],
    [[14.5, 21], [30.5, 21], [32, 14.5], [13, 14.5]], [[14.5, 20.5], [30.5, 20.5], [30, 24], [15, 24]],
    [[13.5, 36], [31.5, 36], [28, 24], [17, 24]], SOCKEL],
};
const AUGE = { N: [18.5, 14, 1.3] };

const z = (n) => +n.toFixed(2);
const kreisPunkte = ([x, y, r], n = 10) => Array.from({ length: n }, (_, i) => [x + r * Math.cos((i / n) * 2 * Math.PI), y + r * Math.sin((i / n) * 2 * Math.PI)]);
const vielecke = (f) => FORM[f].map((s) => (s.k ? kreisPunkte(s.k) : s));
const pfadVon = (pts) => `M${pts.map(([x, y]) => `${z(x)} ${z(y)}`).join('L')}Z`;
const kreisPfad = ([x, y, r]) => `M${z(x - r)} ${y}a${r} ${r} 0 1 0 ${z(2 * r)} 0a${r} ${r} 0 1 0 ${z(-2 * r)} 0Z`;
const D = (f) => FORM[f].map((s) => (s.k ? kreisPfad(s.k) : pfadVon(s))).join('');
const mitte = (pts) => [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length];
function drinnenVieleck(pts, x, y) {
  let ja = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ja = !ja;
  }
  return ja;
}
const drinnen = (f, x, y) => FORM[f].some((s) => (s.k ? (x - s.k[0]) ** 2 + (y - s.k[1]) ** 2 <= s.k[2] ** 2 : drinnenVieleck(s, x, y)));
// fester Zufall, damit jeder Lauf dieselben Dateien schreibt (--pruefen vergleicht)
function zufall(saat) { let s = saat >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); }
const saatVon = (t) => [...t].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);

const svg = (defs, inhalt) => `<svg xmlns="http://www.w3.org/2000/svg" width="45" height="45" viewBox="0 0 45 45">${defs ? `<defs>${defs}</defs>` : ''}${inhalt}</svg>\n`;
const schnitt = (f, id = 's') => `<clipPath id="${id}"><path d="${D(f)}"/></clipPath>`;
// Umriss aussen: breiter Strich hinten, Flaeche vorn, damit Ueberlappungen der Teilformen keine Innenlinien zeigen
const umriss = (f, linie, breite, flaeche, extra = '') => `<path d="${D(f)}" fill="${linie}" stroke="${linie}" stroke-width="${breite * 2}" stroke-linejoin="round"/><path d="${D(f)}" fill="${flaeche}"${extra}/>`;
const auge = (f, farbe) => (AUGE[f] ? `<path d="${kreisPfad(AUGE[f])}" fill="${farbe}"/>` : '');
const linienSchraeg = (abstand, von = -45, bis = 90) => { let d = ''; for (let i = von; i < bis; i += abstand) d += `M${z(i)} 45L${z(i + 45)} 0`; return d; };

// ---------- die Stile ----------
const STILE = [
  ['kristall', 'Kristall', 'Geschliffene Facetten: Weiss ist Eiskristall, Schwarz ist Amethyst, jede Flaeche glaenzt anders.', (f, w) => {
    const tone = w ? ['#F4FBFF', '#D3EAF8', '#B5DBF1', '#E6F4FC', '#C4E2F5'] : ['#5B3C88', '#3E2766', '#7A55B0', '#2C1A4A', '#6A469C'];
    let n = 0, fl = '';
    for (const p of vielecke(f)) {
      const [mx, my] = mitte(p);
      p.forEach((a, i) => { const b = p[(i + 1) % p.length]; fl += `<path d="M${z(mx)} ${z(my)}L${z(a[0])} ${z(a[1])}L${z(b[0])} ${z(b[1])}Z" fill="${tone[n++ % tone.length]}"/>`; });
    }
    return svg('', `${umriss(f, w ? '#4F7FA3' : '#1A0F2E', 0.9, 'none')}<g stroke="${w ? '#FFFFFF' : '#B79BE0'}" stroke-width=".35" stroke-linejoin="round">${fl}</g>${auge(f, w ? '#4F7FA3' : '#E8DBFF')}`);
  }],
  ['holzschnitt', 'Holzschnitt', 'Wie ein alter Druck: rauer schwarzer Rand, Schatten aus Schraffur, Papierfarbe statt Glanz.', (f, w) => {
    const papier = '#F3EBDC', tinte = '#1B1714';
    const defs = `${schnitt(f)}<clipPath id="h"><rect x="${w ? 24 : 0}" y="0" width="21" height="45"/></clipPath><filter id="r"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="3"/><feDisplacementMap in="SourceGraphic" scale=".9"/></filter>`;
    return svg(defs, `<g filter="url(#r)">${umriss(f, tinte, 1.2, w ? papier : tinte)}<g clip-path="url(#s)"><g clip-path="url(#h)"><path d="${linienSchraeg(1.7)}" stroke="${w ? tinte : papier}" stroke-width=".55"/></g></g>${auge(f, w ? tinte : papier)}</g>`);
  }],
  ['origami', 'Origami', 'Gefaltetes Papier: jede Figur hat eine helle und eine dunkle Seite mit Knick in der Mitte.', (f, w) => {
    const [hell, dunkel, rand] = w ? ['#FFFFFF', '#E3DDD1', '#9C9384'] : ['#425365', '#2A3644', '#141B24'];
    const defs = `${schnitt(f)}<filter id="sch"><feDropShadow dx=".5" dy=".9" stdDeviation=".5" flood-opacity=".35"/></filter>`;
    return svg(defs, `<g filter="url(#sch)">${umriss(f, rand, 0.4, hell)}<g clip-path="url(#s)"><rect x="22.5" y="0" width="23" height="45" fill="${dunkel}"/><path d="M22.5 0V45" stroke="${rand}" stroke-width=".4"/><path d="${linienSchraeg(9, -40, 60)}" stroke="${rand}" stroke-width=".25" opacity=".5"/></g>${auge(f, rand)}</g>`);
  }],
  ['tusche', 'Tusche', 'Kalligrafie mit dem Pinsel: Weiss ist Papier mit kraeftigem Tuschestrich, Schwarz ist volle Tusche, dazu ein rotes Siegel.', (f, w) => {
    const defs = `<filter id="p"><feTurbulence type="fractalNoise" baseFrequency=".55" numOctaves="3" seed="8"/><feDisplacementMap in="SourceGraphic" scale="1.6"/></filter>`;
    const siegel = `<rect x="29.5" y="36.6" width="3.2" height="2.8" rx=".3" fill="#C8302A"/>`;
    return svg(defs, `<g filter="url(#p)">${umriss(f, '#111111', w ? 1.5 : 0.8, w ? '#FBF8F1' : '#111111')}${auge(f, w ? '#111111' : '#FBF8F1')}</g>${siegel}`);
  }],
  ['muenze', 'Muenze', 'Jede Figur als gepraegte Muenze: Weiss in Silber, Schwarz in alter Bronze, die Figur als Relief.', (f, w) => {
    const [a, b, c] = w ? ['#FFFFFF', '#C9CDD3', '#8E959E'] : ['#B59A63', '#6E5A36', '#3A2F1E'];
    const defs = `<radialGradient id="g" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="${a}"/><stop offset=".55" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></radialGradient>`;
    const klein = (dx, dy) => `translate(${z(22.5 + dx)} ${z(22.5 + dy)}) scale(.68) translate(-22.5 -22.5)`;
    return svg(defs, `<circle cx="22.5" cy="22.5" r="20.5" fill="url(#g)" stroke="${c}" stroke-width="1"/><circle cx="22.5" cy="22.5" r="18" fill="none" stroke="${c}" stroke-width=".5" stroke-dasharray=".6 .9"/>`
      + `<path d="${D(f)}" transform="${klein(0.5, 0.6)}" fill="${c}" opacity=".8"/><path d="${D(f)}" transform="${klein(-0.4, -0.4)}" fill="${a}" opacity=".9"/><path d="${D(f)}" transform="${klein(0, 0)}" fill="${b}"/>`);
  }],
  ['wappen', 'Wappen', 'Mittelalter-Schilde: Weiss ist Silber mit roter Figur, Schwarz ist Nachtblau mit goldener Figur.', (f, w) => {
    const [feld, farbe] = w ? ['#F2F2F0', '#B8232B'] : ['#1E2A4A', '#D4AF37'];
    const schild = 'M7.5 5H37.5V20C37.5 31 30.5 37.5 22.5 41.5C14.5 37.5 7.5 31 7.5 20Z';
    return svg('', `<path d="${schild}" fill="${feld}" stroke="${farbe}" stroke-width="1.6" stroke-linejoin="round"/><path d="M7.5 10.5H37.5" stroke="${farbe}" stroke-width=".6"/>`
      + `<path d="${D(f)}" transform="translate(22.5 24.5) scale(.58) translate(-22.5 -22.5)" fill="${farbe}"/>`);
  }],
  ['comic', 'Comic', 'Dicker schwarzer Rand, Rasterpunkte als Schatten, ein weisser Glanzstrich: wie aus einem Heft.', (f, w) => {
    const [flaeche, punkt] = w ? ['#FFF6E0', '#E8A13A'] : ['#3B3F58', '#1C1E2C'];
    let punkte = '';
    for (let y = 1; y < 45; y += 2.2) for (let x = 24 + ((y * 10) % 2.2); x < 45; x += 2.2) if (drinnen(f, x, y)) punkte += kreisPfad([z(x), z(y), 0.55]);
    const haupt = vielecke(f)[vielecke(f).length - 2];
    const minX = Math.min(...haupt.map((p) => p[0])), minY = Math.min(...haupt.map((p) => p[1])), maxY = Math.max(...haupt.map((p) => p[1]));
    return svg(schnitt(f), `${umriss(f, '#000000', 1.3, flaeche)}<g clip-path="url(#s)"><path d="${punkte}" fill="${punkt}"/></g>`
      + `<path d="M${z(minX + 2.6)} ${z(minY + 2)}L${z(minX + 3.4)} ${z(maxY - 3)}" stroke="#FFFFFF" stroke-width="1.2" stroke-linecap="round"/>${auge(f, w ? '#000' : '#FFF6E0')}`);
  }],
  ['scherenschnitt', 'Scherenschnitt', 'Aus Papier geschnitten: volle Flaeche mit kleinen ausgeschnittenen Ornamenten und leichtem Schatten.', (f, w) => {
    let loecher = '';
    for (let y = 11; y < 35; y += 3.6) for (const dx of [-3.2, 0, 3.2]) {
      const x = 22.5 + dx;
      const rund = [[0, 0], [1.6, 0], [-1.6, 0], [0, 1.6], [0, -1.6]].every(([a, b]) => drinnen(f, x + a, y + b));
      if (rund) loecher += dx === 0 ? `<path d="M${x} ${z(y - 1)}L${z(x + 0.8)} ${y}L${x} ${z(y + 1)}L${z(x - 0.8)} ${y}Z" fill="#000"/>` : `<path d="${kreisPfad([z(x), z(y), 0.55])}" fill="#000"/>`;
    }
    const defs = `<mask id="m"><path d="${D(f)}" fill="#fff"/>${loecher}${auge(f, '#000')}</mask><filter id="sch"><feDropShadow dx=".6" dy=".8" stdDeviation=".5" flood-opacity=".35"/></filter>`;
    return svg(defs, `<g filter="url(#sch)"><rect width="45" height="45" fill="${w ? '#F5EFE2' : '#141414'}" mask="url(#m)"/></g>${w ? `<path d="${D(f)}" fill="none" stroke="#8F8268" stroke-width=".7" stroke-linejoin="round"/>` : ''}`);
  }],
  ['bauhaus', 'Bauhaus', 'Rot, Gelb, Blau in Kreis, Quadrat, Dreieck: Weiss mit hellem Grund, Schwarz mit schwarzem Grund.', (f, w) => {
    const grund = w ? '#F4F1EA' : '#1E1E1E';
    return svg(schnitt(f), `${umriss(f, '#000000', w ? 0.7 : 0.4, grund)}<g clip-path="url(#s)"><circle cx="22.5" cy="11" r="6.5" fill="#D7322E"/><rect x="5" y="27" width="17.5" height="9" fill="#F2C230"/><path d="M22.5 36L40 36L40 20Z" fill="#1F4E9C"/><path d="M0 36H45" stroke="#000" stroke-width=".6"/></g>${auge(f, w ? '#000' : '#F4F1EA')}`);
  }],
  ['mosaik', 'Mosaik', 'Aus kleinen Steinchen gelegt: Weiss in Sand und Elfenbein, Schwarz in tiefem Blau, mit Fugen dazwischen.', (f, w) => {
    const tone = w ? ['#F7F4EE', '#EDE6D8', '#E2D8C4', '#FFFFFF', '#D9CDB4'] : ['#2B3A55', '#1F2B42', '#34496B', '#16202F', '#3D5680'];
    const r = zufall(saatVon(f + w)); let steine = '';
    for (let y = 0; y < 45; y += 2.2) for (let x = 0; x < 45; x += 2.2) if ([[0, 0], [2.2, 0], [0, 2.2], [2.2, 2.2]].some(([a, b]) => drinnen(f, x + a, y + b))) steine +=`<rect x="${z(x + 0.15)}" y="${z(y + 0.15)}" width="1.9" height="1.9" rx=".25" fill="${tone[Math.floor(r() * tone.length)]}"/>`;
    return svg(schnitt(f), `${umriss(f, w ? '#6E6352' : '#0C111A', 0.8, w ? '#B9AE98' : '#0C111A')}<g clip-path="url(#s)">${steine}</g>${auge(f, w ? '#5A4F3E' : '#C9D6EE')}`);
  }],
  ['bleiglas', 'Bleiglas', 'Wie ein Kirchenfenster: bunte Glasstuecke mit dicken Bleilinien, Weiss hell und bunt, Schwarz tief und satt.', (f, w) => {
    const tone = w ? ['#F6E7A8', '#BFE3F0', '#F4C2C2', '#D7F0C2', '#FFFFFF'] : ['#7A1F3D', '#1F3F7A', '#1F6A4A', '#5A2A7A', '#8A6A1A'];
    const r = zufall(saatVon('glas' + f + w)); const s = 5.5; const pkt = [];
    for (let j = 0; j <= 9; j++) { pkt[j] = []; for (let i = 0; i <= 9; i++) pkt[j][i] = [i * s - 2 + (i % 9 ? (r() - 0.5) * 2.6 : 0), j * s - 2 + (j % 9 ? (r() - 0.5) * 2.6 : 0)]; }
    let stuecke = '';
    for (let j = 0; j < 9; j++) for (let i = 0; i < 9; i++) {
      const a = pkt[j][i], b = pkt[j][i + 1], c = pkt[j + 1][i + 1], d = pkt[j + 1][i];
      stuecke += `<path d="${pfadVon([a, b, c])}" fill="${tone[Math.floor(r() * 5)]}"/><path d="${pfadVon([a, c, d])}" fill="${tone[Math.floor(r() * 5)]}"/>`;
    }
    return svg(schnitt(f), `<g clip-path="url(#s)"><g stroke="#1A1A1A" stroke-width=".7" stroke-linejoin="round">${stuecke}</g></g><path d="${D(f)}" fill="none" stroke="#1A1A1A" stroke-width="1.5" stroke-linejoin="round"/>`);
  }],
  ['kreide', 'Kreide', 'Wie auf die Schultafel gemalt: Schwarz ist Schiefer mit Kreidestrich, Weiss ist helle Kreide mit grauem Rand.', (f, w) => {
    const defs = `${schnitt(f)}<filter id="k"><feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="2" seed="5"/><feDisplacementMap in="SourceGraphic" scale="1.1"/></filter>`;
    const [flaeche, strich] = w ? ['#F4F6F5', '#55616A'] : ['#2F3A40', '#EDEFEA'];
    return svg(defs, `<g filter="url(#k)">${umriss(f, strich, 0.9, flaeche)}<g clip-path="url(#s)"><path d="${linienSchraeg(1.3)}" stroke="${strich}" stroke-width=".3" opacity="${w ? 0.25 : 0.35}"/></g>${auge(f, strich)}</g>`);
  }],
  ['kreuzstich', 'Kreuzstich', 'Gestickt wie Omas Deckchen: lauter kleine Kreuze, am Rand dunkler Faden.', (f, w) => {
    const schritt = 1.8, [faden, rand] = w ? ['#E2DCCF', '#5E4C36'] : ['#2E2E40', '#05050A'];
    let innen = '', aussen = '';
    for (let y = 0.9; y < 45; y += schritt) for (let x = 0.9; x < 45; x += schritt) {
      const cx = x + schritt / 2, cy = y + schritt / 2;
      if (!drinnen(f, cx, cy)) continue;
      const amRand = [[schritt, 0], [-schritt, 0], [0, schritt], [0, -schritt]].some(([a, b]) => !drinnen(f, cx + a, cy + b));
      const kreuz = `M${z(x + 0.2)} ${z(y + 0.2)}L${z(x + schritt - 0.2)} ${z(y + schritt - 0.2)}M${z(x + schritt - 0.2)} ${z(y + 0.2)}L${z(x + 0.2)} ${z(y + schritt - 0.2)}`;
      if (amRand) aussen += kreuz; else innen += kreuz;
    }
    return svg('', `<g stroke-linecap="round" stroke-width=".65"><path d="${innen}" stroke="${faden}"/><path d="${aussen}" stroke="${rand}"/></g><path d="${innen}" stroke="${rand}" stroke-width=".15" opacity=".5"/>`);
  }],
  ['artdeco', 'Art Deco', 'Zwanziger-Jahre-Glanz: Elfenbein oder Schwarz mit goldenen Strahlen und Linien.', (f, w) => {
    const [flaeche, gold, rand] = w ? ['#F3ECDD', '#B8902F', '#1C1C1C'] : ['#141414', '#D2B159', '#000000'];
    let strahlen = '';
    for (let i = 0; i <= 12; i++) { const wk = Math.PI + (i / 12) * Math.PI; strahlen += `M22.5 40L${z(22.5 + 40 * Math.cos(wk))} ${z(40 + 40 * Math.sin(wk))}`; }
    return svg(schnitt(f), `${umriss(f, rand, 0.7, flaeche)}<g clip-path="url(#s)"><path d="${strahlen}" stroke="${gold}" stroke-width=".45"/><path d="M8 36.2H37M8 37.6H37" stroke="${gold}" stroke-width=".5"/></g><path d="${D(f)}" fill="none" stroke="${gold}" stroke-width=".4" transform="translate(22.5 23) scale(.9) translate(-22.5 -23)"/>${auge(f, gold)}`);
  }],
  ['ballon', 'Ballon', 'Aufgeblasen wie Luftballons: rund, glaenzend, Weiss in Perlmutt, Schwarz in Anthrazit.', (f, w) => {
    const [a, b, c, rand] = w ? ['#FFFFFF', '#E6E6EA', '#B9BCC6', '#8E94A3'] : ['#7B8194', '#3A3E4B', '#15171D', '#000000'];
    const defs = `<radialGradient id="g" cx=".35" cy=".25" r=".9"><stop offset="0" stop-color="${a}"/><stop offset=".5" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></radialGradient>`;
    let glanz = '';
    for (const p of vielecke(f).slice(0, -1)) { const [mx, my] = mitte(p); const minY = Math.min(...p.map((q) => q[1])); glanz += `<ellipse cx="${z(mx - 2)}" cy="${z((minY + my) / 2)}" rx="1.3" ry=".8" fill="#FFFFFF" opacity=".75"/>`; }
    return svg(defs, `<path d="${D(f)}" fill="${rand}" stroke="${rand}" stroke-width="3.4" stroke-linejoin="round"/><path d="${D(f)}" fill="url(#g)" stroke="${b}" stroke-width="2.4" stroke-linejoin="round"/>${glanz}${auge(f, w ? '#5B6172' : '#C9CEDB')}`);
  }],
  ['schaltkreis', 'Schaltkreis', 'Platine statt Holz: Leiterbahnen mit Loetpunkten, Weiss hell mit gruenen Bahnen, Schwarz gruen mit goldenen.', (f, w) => {
    const [flaeche, bahn, rand] = w ? ['#E8F3EA', '#2E8B57', '#1E5E3A'] : ['#0F3B2A', '#D9B24C', '#06180F'];
    let bahnen = '', punkte = '';
    for (const x of [16, 19.5, 22.5, 25.5, 29]) {
      const y0 = 6 + ((x * 7) % 9), y1 = 33 - ((x * 5) % 6);
      bahnen += `M${x} ${z(y0)}V${z(y1 - 3)}L${z(x + (x < 22.5 ? -2 : 2))} ${z(y1)}`;
      punkte += kreisPfad([x, z(y0), 0.8]) + kreisPfad([z(x + (x < 22.5 ? -2 : 2)), z(y1), 0.8]);
    }
    return svg(schnitt(f), `${umriss(f, rand, 0.8, flaeche)}<g clip-path="url(#s)"><path d="${bahnen}" fill="none" stroke="${bahn}" stroke-width=".6"/><path d="${punkte}" fill="${bahn}"/></g>${auge(f, bahn)}`);
  }],
  ['delfter', 'Delfter Blau', 'Porzellan: Weiss ist weisse Glasur mit blauen Blueten, Schwarz ist Kobaltblau mit weissen.', (f, w) => {
    const [glasur, blau] = w ? ['#FBFCFF', '#1E4C9A'] : ['#1E4C9A', '#FBFCFF'];
    const r = zufall(saatVon('delft' + f)); let blueten = '';
    for (let i = 0; i < 40; i++) {
      const x = 8 + r() * 29, y = 5 + r() * 28;
      if (!drinnen(f, x, y)) continue;
      blueten += `<g transform="translate(${z(x)} ${z(y)})"><circle r=".55" fill="${blau}"/>${[0, 72, 144, 216, 288].map((g) => `<ellipse rx=".5" ry="1.1" cy="-1.3" transform="rotate(${g})" fill="${blau}" opacity=".75"/>`).join('')}</g>`;
    }
    return svg(schnitt(f), `${umriss(f, w ? '#1E4C9A' : '#0E2550', 0.8, glasur)}<g clip-path="url(#s)">${blueten}<path d="M0 34.6H45M0 37.6H45" stroke="${blau}" stroke-width=".55"/></g>${auge(f, blau)}`);
  }],
  ['aquarell', 'Aquarell', 'Mit Wasserfarbe gemalt: weiche Raender, zwei Farbschichten uebereinander, Weiss in Sand, Schwarz in Tintenblau.', (f, w) => {
    const [a, b, rand] = w ? ['#EBDDC6', '#D9C3A0', '#B49468'] : ['#3A4E6E', '#24344F', '#13203A'];
    const defs = `<filter id="a"><feTurbulence type="fractalNoise" baseFrequency=".35" numOctaves="3" seed="11"/><feDisplacementMap in="SourceGraphic" scale="2.2"/><feGaussianBlur stdDeviation=".3"/></filter>`;
    return svg(defs, `<g filter="url(#a)"><path d="${D(f)}" fill="${a}" stroke="${rand}" stroke-width=".9" stroke-opacity=".7" stroke-linejoin="round"/><path d="${D(f)}" fill="${b}" opacity=".55" transform="translate(1.2 1)"/>${auge(f, rand)}</g>`);
  }],
  ['sternbild', 'Sternbild', 'Jede Figur ist ein Sternbild: Sterne an den Ecken, feine Linien dazwischen, Weiss als Taghimmel, Schwarz als Nacht.', (f, w) => {
    const [himmel, stern, rand] = w ? ['#EEF2FF', '#1F2A66', '#8B95C9'] : ['#141A3C', '#FFF3C4', '#05081A'];
    const klein = (p) => p.map(([x, y]) => [22.5 + (x - 22.5) * 0.84, 23 + (y - 23) * 0.84]);
    let linien = '', sterne = '';
    vielecke(f).forEach((p, j) => {
      const q = klein(p);
      linien += pfadVon(q);
      q.forEach(([x, y], i) => { if (FORM[f][j].k && i % 3) return; sterne += kreisPfad([z(x), z(y), i % 2 ? 0.55 : 0.85]); });
    });
    return svg('', `${umriss(f, rand, 0.6, himmel)}<path d="${linien}" fill="none" stroke="${stern}" stroke-width=".3" opacity=".7"/><path d="${sterne}" fill="${stern}"/>`);
  }],
  ['leuchtlinie', 'Leuchtlinie', 'Nur der leuchtende Umriss wie eine Neonroehre: Weiss in Tuerkis, Schwarz in Pink (anders als der volle Neon-Satz).', (f, w) => {
    const [licht, flaeche] = w ? ['#00A9CC', '#E8FBFF'] : ['#E0218A', '#2A0F22'];
    const defs = `<filter id="l" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.1" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
    return svg(defs, `<path d="${D(f)}" fill="${flaeche}"/><g filter="url(#l)"><path d="${D(f)}" fill="none" stroke="${licht}" stroke-width="1.3" stroke-linejoin="round"/>${AUGE[f] ? `<path d="${kreisPfad(AUGE[f])}" fill="${licht}"/>` : ''}</g>`);
  }],
];
export const SAETZE = STILE.map(([id, name, konkret, bau], i) => ({ nr: String(i + 1).padStart(2, '0'), id, name, konkret, bau }));
const ordnerName = (s) => `${s.nr}-${s.id}`;

function dateienVon(s) {
  const out = {};
  for (const f of FIGUREN) for (const c of ['w', 'b']) out[`${c}${f}.svg`] = s.bau(f, c === 'w');
  return out;
}

// Vorschau: 6 x 4 Felder, oben zweimal Schwarz, unten zweimal Weiss, jede Figur einmal auf hellem und dunklem Feld
function vorschauHtml(s, dateien) {
  const bild = (n) => `data:image/svg+xml;base64,${Buffer.from(dateien[n]).toString('base64')}`;
  const reihen = ['b', 'b', 'w', 'w'];
  let felder = '';
  reihen.forEach((c, r) => FIGUREN.forEach((f, i) => { felder += `<div class="f ${(r + i) % 2 ? 'd' : 'h'}"><img src="${bild(`${c}${f}.svg`)}" alt=""></div>`; }));
  return `<!doctype html><html lang="de"><meta charset="utf-8"><style>
body{margin:0;background:#FAF8F4;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#24222B}
.k{padding:20px 16px}h1{margin:0 0 4px;font-size:22px}p{margin:0 0 14px;font-size:14px;line-height:1.4;color:#5A5664}
.b{display:grid;grid-template-columns:repeat(6,1fr);border-radius:10px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,.12)}
.f{aspect-ratio:1;display:flex;align-items:center;justify-content:center}.h{background:#E9E5DC}.d{background:#B5AFA3}
.f img{width:92%;height:92%}small{display:block;margin-top:10px;font-size:12px;color:#8A8592}</style>
<div class="k"><h1>${s.nr} ${s.name}</h1><p>${s.konkret}</p><div class="b">${felder}</div><small>Entwurf, nicht in der App. Oben Schwarz, unten Weiss, je Figur auf hellem und dunklem Feld.</small></div></html>`;
}

async function browser() {
  const require = createRequire(import.meta.url);
  let pw;
  for (const p of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
    try { pw = require(p); break; } catch (e) { /* naechster */ }
  }
  if (!pw) throw new Error('Playwright fehlt (PLAYWRIGHT_PFAD setzen)');
  return pw.chromium.launch();
}

async function bilder(ziel) {
  mkdirSync(ziel, { recursive: true });
  const b = await browser();
  const seite = await b.newPage({ viewport: { width: 390, height: 600 }, deviceScaleFactor: 2 });
  for (const s of SAETZE) {
    await seite.setContent(vorschauHtml(s, dateienVon(s)));
    await seite.waitForFunction(() => [...document.images].every((i) => i.complete));
    await seite.locator('.k').screenshot({ path: path.join(ziel, `${ordnerName(s)}.png`) });
  }
  await b.close();
  console.log(`${SAETZE.length} Vorschaubilder: ${ziel}`);
}

async function pruefen() {
  const fehler = [];
  for (const s of SAETZE) {
    const ordner = path.join(ZIEL, ordnerName(s));
    const soll = dateienVon(s);
    if (!existsSync(ordner)) { fehler.push(`${ordnerName(s)}: Ordner fehlt`); continue; }
    const da = readdirSync(ordner).filter((n) => n.endsWith('.svg'));
    if (da.length !== 12) fehler.push(`${ordnerName(s)}: ${da.length} statt 12 SVG`);
    for (const [n, inhalt] of Object.entries(soll)) {
      const p = path.join(ordner, n);
      if (!existsSync(p)) { fehler.push(`${ordnerName(s)}/${n}: fehlt`); continue; }
      const t = readFileSync(p, 'utf8');
      if (t !== inhalt) fehler.push(`${ordnerName(s)}/${n}: weicht vom Werkzeug ab (neu schreiben)`);
      if (!t.includes('viewBox="0 0 45 45"')) fehler.push(`${ordnerName(s)}/${n}: viewBox fehlt`);
      if (/<image|href="(?!#)|url\((?!#)/.test(t) || (t.match(/http/g) || []).length !== 1) fehler.push(`${ordnerName(s)}/${n}: externer Verweis`);
    }
  }
  // jede Figur im Browser zeichnen und deckende Pixel zaehlen (ein kaputter Filter malt nichts)
  const b = await browser();
  const seite = await b.newPage();
  for (const s of SAETZE) {
    const dateien = dateienVon(s);
    const werte = await seite.evaluate(async (liste) => Promise.all(liste.map(([n, t]) => new Promise((ok) => {
      const i = new Image();
      i.onload = () => { const c = document.createElement('canvas'); c.width = c.height = 90; const g = c.getContext('2d'); g.drawImage(i, 0, 0, 90, 90);
        const d = g.getImageData(0, 0, 90, 90).data; let n2 = 0; for (let k = 3; k < d.length; k += 4) if (d[k] > 128) n2++; ok([n, n2]); };
      i.onerror = () => ok([n, -1]);
      i.src = 'data:image/svg+xml;base64,' + btoa(t);
    }))), Object.entries(dateien));
    for (const [n, deckend] of werte) if (deckend < 600) fehler.push(`${ordnerName(s)}/${n}: im Browser ${deckend < 0 ? 'nicht ladbar' : `nur ${deckend} deckende Pixel`}`);
  }
  await b.close();
  if (fehler.length) { console.log(fehler.join('\n')); console.log(`FEHLER ${fehler.length}`); process.exit(1); }
  console.log(`OK ${SAETZE.length} Saetze, ${SAETZE.length * 12} Figuren, alle im Browser gezeichnet`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = process.argv.slice(2);
  if (arg.includes('--pruefen')) await pruefen();
  else {
    for (const s of SAETZE) {
      const ordner = path.join(ZIEL, ordnerName(s));
      mkdirSync(ordner, { recursive: true });
      for (const [n, inhalt] of Object.entries(dateienVon(s))) writeFileSync(path.join(ordner, n), inhalt);
    }
    console.log(`${SAETZE.length * 12} Figuren geschrieben: design/figuren-entwurf/`);
    const i = arg.indexOf('--bilder');
    if (i >= 0) await bilder(path.resolve(arg[i + 1]));
  }
}
