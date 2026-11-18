// Motiv-Bretter, Fassung 3 (Flo 14.11.2026 abends: "bei den Brettern kannst du kreativer werden"; Fassung 2 war ihm mit
// ihren leisen Oberflaechen noch "zu brav"). 20 Entwuerfe, je ein echtes Bild ueber das ganze Brett statt Farbe plus Muster:
// Kirchenfenster, Seekarte, Sternbilder, Unterwasser und mehr, dazu je Brett ein Rahmen und ein Koordinaten-Stil.
// NUR fuer die Vorschau (werkzeuge/bretter-vorschau-v3.html), nicht in der App, nicht im Service Worker, nicht freischaltbar.
//
// Spielbarkeit durch Bauart: jedes Motiv zeichnet sein Bild EINMAL mit benannten Farbrollen (§rolle§). Die Rolle traegt
// einen Farbton und eine Stufe 0..1; daraus wird je Feldart eine Farbe mit genau dieser Helligkeit im Band gerechnet:
// helle Felder in BAND.hell, dunkle in BAND.dunkel. Die Baender halten die Boeden aus Fassung 2 (Feld 2,2, weisse und
// schwarze Figur auf dunkel 3,0, schwarze auf hell 7,0) mit Abstand, so bleibt hell/dunkel klar, und das Bild lebt von
// Form und Farbton. tests/bretter-v3.test.mjs prueft die Baender (Herleitung A) und misst das echte Brett (Herleitung B).
//
//   MOTIVE                      [{ id, name, idee, seltenheit, weg, bewegung?, palette, rahmen, koord, zeichne(R) }]
//   BAND                        { hell: [lo, hi], dunkel: [lo, hi] }   relative Leuchtdichte (WCAG)
//   inBand(hex, band, stufe)    -> '#rrggbb'   gleicher Farbton, Leuchtdichte lo + (hi - lo) * stufe
//   motivBild(m) -> { h, d }    SVG-Inhalt (viewBox 0 0 800 800) fuer helle und dunkle Felder, fest je Id
//   feldFarben(m) -> { h, d }   Grundfarbe der Felder (unter dem Bild)
//   koordFarben(m) -> { h, d }  Koordinaten auf hellen bzw. dunklen Feldern (mind. 3,0 gegen das ganze Band)
//   motivCss(m) -> string       Rahmen, Felder, Koordinaten und (nur ohne "weniger Bewegung") der leise Rahmenglanz,
//                               fuer .motiv-brett[data-motiv="<id>"] um ein Brett (js/board.js)
import { svgUrl, GROESSE } from './brett-flaechen.js';

export const BAND = Object.freeze({ hell: Object.freeze([0.58, 0.95]), dunkel: Object.freeze([0.12, 0.21]) });

// ---------- Farbe: Farbton behalten, Leuchtdichte setzen ----------
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const gam = (v) => Math.round(255 * Math.min(1, Math.max(0, v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055)));
const LUM = [0.2126, 0.7152, 0.0722];
const leucht = (l) => l.reduce((s, v, i) => s + v * LUM[i], 0);
const hex = (l) => '#' + l.map((v) => gam(v).toString(16).padStart(2, '0')).join('');
export function inBand(farbe, [lo, hi], stufe) {
  const n = parseInt(farbe.slice(1), 16);
  let l = [n >> 16, (n >> 8) & 255, n & 255].map(lin);
  if (leucht(l) < 1e-6) l = [1e-3, 1e-3, 1e-3];
  const ziel = lo + (hi - lo) * Math.min(0.96, Math.max(0.04, stufe));
  const L = leucht(l), s = 1 / Math.max(...l), Ls = L * s;
  // dunkler als die hellste Fassung des Tons: nur skalieren; heller: die hellste Fassung mit Weiss mischen
  if (ziel <= Ls) return hex(l.map((v) => v * ziel / L));
  const t = (ziel - Ls) / (1 - Ls);
  return hex(l.map((v) => v * s * (1 - t) + t));
}

// ---------- Werkzeuge der Zeichnung ----------
const zufall = (text) => {
  let s = 2166136261;
  for (const c of text) s = Math.imul(s ^ c.charCodeAt(0), 16777619);
  return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
};
const z = (v) => Math.round(v * 10) / 10;
const zw = (R, a, b) => a + R() * (b - a);
const wahl = (R, liste) => liste[Math.floor(R() * liste.length)];
const F = (rolle) => `§${rolle}§`;
const zug = (pkt) => 'M' + pkt.map(([x, y]) => `${z(x)} ${z(y)}`).join('L') + 'Z';
const grund = '<rect width="800" height="800" fill="§grund§"/>';
// verzogenes Gitter: (n+1)^2 Punkte, Rand bleibt gerade
const gitter = (R, n, verzug) => {
  const s = 800 / n, p = [];
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
    const rand = i === 0 || j === 0 || i === n || j === n;
    p.push([i * s + (rand ? 0 : (R() - 0.5) * s * verzug), j * s + (rand ? 0 : (R() - 0.5) * s * verzug)]);
  }
  return { p, n, ecke: (i, j) => p[j * (n + 1) + i] };
};
// Vieleck zum Schwerpunkt hin schrumpfen (Fugen, Risse)
const schrumpf = (pkt, f) => { const cx = pkt.reduce((s, q) => s + q[0], 0) / pkt.length, cy = pkt.reduce((s, q) => s + q[1], 0) / pkt.length; return pkt.map(([x, y]) => [cx + (x - cx) * f, cy + (y - cy) * f]); };
// unregelmaessiger Klecks (Inseln, Meere)
const klecks = (R, cx, cy, r, n = 14, wackel = 0.35) => Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2, q = r * (1 - wackel / 2 + R() * wackel); return [cx + Math.cos(a) * q, cy + Math.sin(a) * q * zw(R, 0.75, 1)]; });
const stern = (cx, cy, aussen, innen, zacken, dreh = -Math.PI / 2) => Array.from({ length: zacken * 2 }, (_, i) => { const a = dreh + (i * Math.PI) / zacken, r = i % 2 ? innen : aussen; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; });
const zahnrad = (cx, cy, r, zaehne, tiefe) => {
  const pkt = [];
  for (let i = 0; i < zaehne; i++) {
    const a = (i / zaehne) * Math.PI * 2, b = Math.PI * 2 / zaehne;
    for (const [w, q] of [[0, r - tiefe], [0.15, r], [0.5, r], [0.65, r - tiefe]]) pkt.push([cx + Math.cos(a + w * b) * q, cy + Math.sin(a + w * b) * q]);
  }
  return pkt;
};
const sechseck = (cx, cy, r) => Array.from({ length: 6 }, (_, i) => [cx + Math.cos(Math.PI / 6 + i * Math.PI / 3) * r, cy + Math.sin(Math.PI / 6 + i * Math.PI / 3) * r]);
const welle = (x, y, b, h) => `M${z(x)} ${z(y)}q${z(b / 4)} ${z(-h)} ${z(b / 2)} 0q${z(b / 4)} ${z(h)} ${z(b / 2)} 0`;

// ---------- die 20 Motive ----------
// palette: rolle -> [Farbton, Stufe im Band] oder [Farbton, Stufe hell, Stufe dunkel]; rahmen: { breite, grund (CSS-Hintergrund), linie, radius }; koord: { schrift, gewicht, farbe }
const M = [];

M.push({ id: 'kirchenfenster', name: 'Kirchenfenster', idee: 'Buntglas-Mosaik mit Bleifugen und einer Rosette in der Mitte',
  seltenheit: 'episch', weg: { art: 'level', n: 60 },
  palette: { grund: ['#2a2440', 0], blei: ['#2a2440', 0], rubin: ['#c0203a', 0.42], saphir: ['#2050c0', 0.55], smaragd: ['#1f9a5a', 0.62], bernstein: ['#e0a020', 0.9], amethyst: ['#8a3cc0', 0.35] },
  rahmen: { breite: 16, radius: 14, linie: '#d9b45a', grund: 'linear-gradient(160deg, #5b616e, #2c3038 45%, #6a7080 70%, #262a31)' },
  koord: { schrift: '"Palatino Linotype", Palatino, Georgia, serif', gewicht: 700, farbe: '#2a2440' },
  zeichne(R) {
    const g = gitter(R, 10, 0.55), glas = ['rubin', 'saphir', 'smaragd', 'bernstein', 'amethyst'];
    let s = grund;
    for (let j = 0; j < g.n; j++) for (let i = 0; i < g.n; i++) {
      s += `<path d="${zug([g.ecke(i, j), g.ecke(i + 1, j), g.ecke(i + 1, j + 1), g.ecke(i, j + 1)])}" fill="${F(wahl(R, glas))}" stroke="${F('blei')}" stroke-width="6" stroke-linejoin="round"/>`;
    }
    s += `<circle cx="400" cy="400" r="190" fill="${F('saphir')}" stroke="${F('blei')}" stroke-width="10"/>`;
    for (let i = 0; i < 12; i++) s += `<ellipse cx="400" cy="290" rx="34" ry="92" fill="${F(i % 2 ? 'rubin' : 'bernstein')}" stroke="${F('blei')}" stroke-width="6" transform="rotate(${i * 30} 400 400)"/>`;
    for (let i = 0; i < 12; i++) s += `<circle cx="${z(400 + Math.cos(i * Math.PI / 6 + 0.26) * 165)}" cy="${z(400 + Math.sin(i * Math.PI / 6 + 0.26) * 165)}" r="14" fill="${F('smaragd')}" stroke="${F('blei')}" stroke-width="5"/>`;
    s += `<circle cx="400" cy="400" r="58" fill="${F('amethyst')}" stroke="${F('blei')}" stroke-width="8"/><path d="${zug(stern(400, 400, 46, 18, 8))}" fill="${F('bernstein')}" stroke="${F('blei')}" stroke-width="4"/>`;
    return s;
  } });

M.push({ id: 'seekarte', name: 'Alte Seekarte', idee: 'Pergament mit Inseln, Kompassrose, Kurslinien und gestrichelter Route',
  seltenheit: 'episch', weg: { art: 'welt', welt: 4 },
  palette: { grund: ['#e0c070', 0.9, 0.75], land: ['#5aa040', 0.3, 0.45], kueste: ['#5a3c1c', 0.04], wasser: ['#2a6ad0', 0.45, 0.3], kompass: ['#a0302a', 0.25], tinte: ['#3a2a18', 0.02], gold: ['#e0b040', 0.92] },
  rahmen: { breite: 16, radius: 6, linie: '#c9a15a', grund: 'repeating-linear-gradient(45deg, #4a2c14 0 6px, #5e3a1c 6px 12px)' },
  koord: { schrift: 'Georgia, "Times New Roman", serif', gewicht: 700, farbe: '#3a2a18' },
  zeichne(R) {
    let s = grund;
    const rose = [[600, 200], [170, 640]];
    for (const [cx, cy] of rose) for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8; s += `<path d="M${cx} ${cy}L${z(cx + Math.cos(a) * 1200)} ${z(cy + Math.sin(a) * 1200)}" stroke="${F('wasser')}" stroke-width="1.6"/>`; }
    for (let i = 0; i < 34; i++) s += `<path d="${welle(zw(R, 0, 760), zw(R, 0, 790), zw(R, 20, 34), zw(R, 4, 7))}" fill="none" stroke="${F('wasser')}" stroke-width="2.4" stroke-linecap="round"/>`;
    for (const [cx, cy, r] of [[200, 210, 120], [560, 520, 150], [690, 760, 90], [110, 470, 70], [430, 120, 60]]) {
      const k = klecks(R, cx, cy, r, 18, 0.45);
      s += `<path d="${zug(k)}" fill="${F('land')}" stroke="${F('kueste')}" stroke-width="4" stroke-linejoin="round"/>`;
      s += `<path d="${zug(schrumpf(k, 0.78))}" fill="none" stroke="${F('kueste')}" stroke-width="1.4" stroke-dasharray="3 5"/>`;
      for (let i = 0; i < 4; i++) s += `<path d="M${z(cx + zw(R, -r, r) * 0.4)} ${z(cy + zw(R, -r, r) * 0.4)}l12 -20l12 20Z" fill="${F('kueste')}"/>`;
    }
    const [cx, cy] = rose[0];
    s += `<circle cx="${cx}" cy="${cy}" r="96" fill="${F('grund')}" stroke="${F('tinte')}" stroke-width="3"/><circle cx="${cx}" cy="${cy}" r="80" fill="none" stroke="${F('tinte')}" stroke-width="1.5"/>`;
    s += `<path d="${zug(stern(cx, cy, 92, 16, 4))}" fill="${F('kompass')}" stroke="${F('tinte')}" stroke-width="2"/><path d="${zug(stern(cx, cy, 62, 12, 4, -Math.PI / 4))}" fill="${F('gold')}" stroke="${F('tinte')}" stroke-width="2"/>`;
    s += `<path d="M90 120C240 260 300 420 470 380S700 600 740 700" fill="none" stroke="${F('kompass')}" stroke-width="4" stroke-dasharray="14 10" stroke-linecap="round"/>`;
    s += `<path d="M725 685l30 30M755 685l-30 30" stroke="${F('kompass')}" stroke-width="7" stroke-linecap="round"/>`;
    return s;
  } });

M.push({ id: 'sternbilder', name: 'Sternbilder', idee: 'Nachthimmel mit verbundenen Sternbildern, Milchstrasse und Sternenstaub',
  seltenheit: 'legende', weg: { art: 'stufe', familie: 'sterne', stufe: 'gold' }, bewegung: true,
  palette: { grund: ['#2a4ad0', 0.9, 0.04], band: ['#9a5aff', 0.45, 0.5], band2: ['#4a6aff', 0.65, 0.3], stern: ['#ffc020', 0.04, 0.97], linie: ['#ff5aa0', 0.1, 0.8], halo: ['#ffc020', 0.25, 0.6] },
  rahmen: { breite: 14, radius: 16, linie: '#a8c4ff', grund: 'radial-gradient(circle at 30% 20%, #3a4a9a, #0e1436 70%)' },
  koord: { schrift: '"Trebuchet MS", "Segoe UI", sans-serif', gewicht: 700, farbe: '#1a2a6c' },
  zeichne(R) {
    let s = grund;
    for (let i = 0; i < 5; i++) s += `<path d="M-100 ${z(820 - i * 40)}C200 ${z(560 - i * 50)} 520 ${z(300 - i * 30)} 900 ${z(-40 - i * 40)}" fill="none" stroke="${F(i % 2 ? 'band2' : 'band')}" stroke-width="${z(zw(R, 60, 110))}" stroke-linecap="round"/>`;
    for (let i = 0; i < 160; i++) s += `<circle cx="${z(zw(R, 0, 800))}" cy="${z(zw(R, 0, 800))}" r="${z(zw(R, 1.2, 3.2))}" fill="${F('stern')}"/>`;
    for (let k = 0; k < 7; k++) {
      const cx = zw(R, 90, 710), cy = zw(R, 90, 710), pkt = [];
      for (let i = 0; i < 5 + Math.floor(R() * 3); i++) pkt.push([cx + zw(R, -120, 120), cy + zw(R, -120, 120)]);
      s += `<path d="M${pkt.map(([x, y]) => `${z(x)} ${z(y)}`).join('L')}" fill="none" stroke="${F('linie')}" stroke-width="2.4" stroke-linejoin="round"/>`;
      for (const [x, y] of pkt) s += `<circle cx="${z(x)}" cy="${z(y)}" r="16" fill="none" stroke="${F('halo')}" stroke-width="2"/><path d="${zug(stern(x, y, 11, 3.4, 4))}" fill="${F('stern')}"/>`;
    }
    return s;
  } });

M.push({ id: 'unterwasser', name: 'Unterwasser', idee: 'Lichtstrahlen von oben, Tang, Fischschwarm und Luftblasen',
  seltenheit: 'episch', weg: { art: 'endgegner', welt: 5 }, bewegung: true,
  palette: { grund: ['#0a6a8a', 0.4], tief: ['#0a4a7a', 0.12], mitte: ['#0a7a9a', 0.55], strahl: ['#c0f4ff', 0.93], tang: ['#2a8a4a', 0.22], fisch: ['#ff9a30', 0.78], auge: ['#102030', 0], blase: ['#e8fcff', 0.9] },
  rahmen: { breite: 14, radius: 18, linie: '#7fe0f0', grund: 'linear-gradient(180deg, #2aa0c0, #0a3a5a 60%, #062236)' },
  koord: { schrift: '"Segoe UI", system-ui, sans-serif', gewicht: 700, farbe: '#0a3a5a' },
  zeichne(R) {
    let s = grund;
    for (let i = 0; i < 6; i++) { const y = 320 + i * 90; s += `<path d="M0 ${y}${Array.from({ length: 8 }, () => `q50 ${z(zw(R, -24, 24))} 100 0`).join('')}V800H0Z" fill="${F(i < 3 ? 'mitte' : 'tief')}"/>`; }
    for (let i = 0; i < 7; i++) { const x = 60 + i * 115 + zw(R, -20, 20); s += `<path d="M${z(x)} -10L${z(x + 40)} -10L${z(x + 160 + zw(R, 0, 60))} 810L${z(x + 70)} 810Z" fill="${F('strahl')}"/>`; }
    for (let i = 0; i < 16; i++) { const x = zw(R, 0, 800), h = zw(R, 180, 380); s += `<path d="M${z(x)} 810${Array.from({ length: 6 }, (_, k) => `q${z(k % 2 ? 22 : -22)} ${z(-h / 12)} 0 ${z(-h / 6)}`).join('')}" fill="none" stroke="${F('tang')}" stroke-width="${z(zw(R, 8, 14))}" stroke-linecap="round"/>`; }
    for (let i = 0; i < 12; i++) {
      const x = zw(R, 80, 720), y = zw(R, 100, 600), g = zw(R, 0.7, 1.3), r = R() < 0.5 ? 1 : -1;
      s += `<g transform="translate(${z(x)} ${z(y)}) scale(${z(r * g * 10) / 10} ${z(g * 10) / 10})"><ellipse rx="34" ry="16" fill="${F('fisch')}"/><path d="M28 0l26 -18v36Z" fill="${F('fisch')}"/><circle cx="-18" cy="-4" r="4" fill="${F('auge')}"/></g>`;
    }
    for (let i = 0; i < 50; i++) s += `<circle cx="${z(zw(R, 0, 800))}" cy="${z(zw(R, 0, 800))}" r="${z(zw(R, 3, 12))}" fill="none" stroke="${F('blase')}" stroke-width="2"/>`;
    return s;
  } });

M.push({ id: 'intarsie', name: 'Holzintarsie', idee: 'Eingelegter Stern aus zwei Hoelzern, Fadeneinlage und Maserung',
  seltenheit: 'episch', weg: { art: 'welt', welt: 2 },
  palette: { grund: ['#b07a40', 0.55], maser: ['#7a4a20', 0.3], ahorn: ['#f0d090', 0.95], wenge: ['#5a3418', 0.03], kirsch: ['#b0502a', 0.4] },
  rahmen: { breite: 18, radius: 8, linie: '#e8c890', grund: 'repeating-linear-gradient(90deg, #5a3418 0 5px, #7a4a22 5px 9px, #4a2a12 9px 12px)' },
  koord: { schrift: 'Georgia, serif', gewicht: 700, farbe: '#4a2a12' },
  zeichne(R) {
    let s = grund;
    for (let i = 0; i < 34; i++) { const y = i * 24 + zw(R, -6, 6); s += `<path d="M-10 ${z(y)}${Array.from({ length: 4 }, () => `q100 ${z(zw(R, -14, 14))} 205 0`).join('')}" fill="none" stroke="${F('maser')}" stroke-width="${z(zw(R, 1.2, 3))}"/>`; }
    for (const [a, b] of [[24, 'wenge'], [44, 'ahorn'], [60, 'wenge']]) s += `<rect x="${a}" y="${a}" width="${800 - 2 * a}" height="${800 - 2 * a}" fill="none" stroke="${F(b)}" stroke-width="7"/>`;
    for (let i = 0; i < 16; i++) { const w = i * Math.PI / 8; s += `<path d="${zug([[400, 400], [400 + Math.cos(w - 0.2) * 120, 400 + Math.sin(w - 0.2) * 120], [400 + Math.cos(w) * 300, 400 + Math.sin(w) * 300], [400 + Math.cos(w + 0.2) * 120, 400 + Math.sin(w + 0.2) * 120]])}" fill="${F(i % 2 ? 'wenge' : 'ahorn')}" stroke="${F('kirsch')}" stroke-width="2"/>`; }
    for (let i = 0; i < 28; i++) { const w = i * Math.PI / 14, x = 400 + Math.cos(w) * 330, y = 400 + Math.sin(w) * 330; s += `<path d="${zug(stern(x, y, 16, 6, 2, w))}" fill="${F(i % 2 ? 'kirsch' : 'ahorn')}"/>`; }
    for (const [cx, cy, d] of [[60, 60, 0], [740, 60, 1], [740, 740, 2], [60, 740, 3]]) for (let i = 0; i < 6; i++) { const a = d * Math.PI / 2 + i * Math.PI / 12; s += `<path d="M${cx} ${cy}L${z(cx + Math.cos(a) * 130)} ${z(cy + Math.sin(a) * 130)}A130 130 0 0 1 ${z(cx + Math.cos(a + Math.PI / 12) * 130)} ${z(cy + Math.sin(a + Math.PI / 12) * 130)}Z" fill="${F(i % 2 ? 'ahorn' : 'kirsch')}"/>`; }
    return s;
  } });

M.push({ id: 'pixelwelt', name: 'Pixelwelt', idee: 'Retro-Landschaft aus grossen Pixeln: Sonne, Wolken, Berge, Baeume',
  seltenheit: 'selten', weg: { art: 'level', n: 55 },
  palette: { grund: ['#5ab0ff', 0.92], h2: ['#5ab0ff', 0.75], h3: ['#7a8cff', 0.58], sonne: ['#ffd23a', 0.97], wolke: ['#ffffff', 0.98], berg: ['#6a5aa0', 0.3], schnee: ['#ffffff', 0.86], gras: ['#3ab04a', 0.45], erde: ['#a0602a', 0.15], baum: ['#1a7a3a', 0.05] },
  rahmen: { breite: 12, radius: 0, linie: '#ffd23a', grund: 'repeating-conic-gradient(#2a2a3a 0 25%, #3a3a52 0 50%) 0 0 / 12px 12px' },
  koord: { schrift: '"Courier New", Consolas, monospace', gewicht: 700, farbe: '#1a1a3a' },
  zeichne(R) {
    const N = 20, P = 40, feld = [];
    const berg = Array.from({ length: N }, (_, x) => Math.round(9 + 3 * Math.sin(x / 2.2) + 2 * Math.sin(x / 1.1 + 1) + R()));
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      let r = y < 4 ? 'grund' : y < 7 ? 'h2' : 'h3';
      if ((x - 15) ** 2 + (y - 3) ** 2 <= 5) r = 'sonne';
      if ((y === 2 && x >= 2 && x <= 6) || (y === 3 && x >= 1 && x <= 7) || (y === 5 && x >= 9 && x <= 12) || (y === 4 && x >= 10 && x <= 11)) r = 'wolke';
      if (y >= berg[x]) r = y < berg[x] + 1 && berg[x] < 9 ? 'schnee' : 'berg';
      if (y >= 15) r = y === 15 ? 'gras' : 'erde';
      feld.push(r);
    }
    for (const x of [3, 8, 13, 17]) { feld[14 * N + x] = 'baum'; feld[13 * N + x] = 'baum'; feld[12 * N + x] = 'gras'; feld[13 * N + x - 1] = 'gras'; feld[13 * N + x + 1] = 'gras'; }
    let s = '';
    for (let y = 0; y < N; y++) for (let x = 0; x < N;) { let e = x; while (e + 1 < N && feld[y * N + e + 1] === feld[y * N + x]) e++; s += `<rect x="${x * P}" y="${y * P}" width="${(e - x + 1) * P}" height="${P}" fill="${F(feld[y * N + x])}"/>`; x = e + 1; }
    return s;
  } });

M.push({ id: 'origami', name: 'Origami', idee: 'Gefaltetes Papier in grossen Flaechen, ein Kranich aus Dreiecken',
  seltenheit: 'selten', weg: { art: 'level', n: 58 },
  palette: { grund: ['#f0e0c0', 0.8], rot: ['#e85a5a', 0.45], orange: ['#f2a03a', 0.75], tuerkis: ['#3ab0a0', 0.55], blau: ['#5a7ae0', 0.35], creme: ['#f0e0c0', 0.95], falte: ['#ffffff', 0.98], kranich: ['#ffffff', 0.9], schatten: ['#5a5a7a', 0.1] },
  rahmen: { breite: 12, radius: 4, linie: '#e85a5a', grund: 'linear-gradient(135deg, #f4ede0 0 50%, #e6dcc8 50% 100%)' },
  koord: { schrift: '"Segoe UI", system-ui, sans-serif', gewicht: 800, farbe: '#3a2a4a' },
  zeichne(R) {
    let s = grund;
    const g = gitter(R, 6, 0.5), toene = ['rot', 'orange', 'tuerkis', 'blau', 'creme'];
    for (let j = 0; j < g.n; j++) for (let i = 0; i < g.n; i++) {
      const [A, B, C, D] = [g.ecke(i, j), g.ecke(i + 1, j), g.ecke(i, j + 1), g.ecke(i + 1, j + 1)];
      for (const t of (i + j) % 2 ? [[A, B, D], [A, D, C]] : [[A, B, C], [B, D, C]]) s += `<path d="${zug(t)}" fill="${F(wahl(R, toene))}" stroke="${F('falte')}" stroke-width="2.5" stroke-linejoin="round"/>`;
    }
    const k = [[[400, 300], [560, 420], [400, 460]], [[400, 300], [240, 380], [400, 460]], [[400, 460], [520, 540], [400, 520]], [[400, 460], [260, 560], [400, 520]], [[560, 420], [660, 280], [600, 430]], [[660, 280], [690, 300], [640, 300]], [[240, 380], [150, 330], [270, 420]]];
    s += `<path d="${zug([[400, 470], [540, 560], [400, 540], [260, 570]])}" fill="${F('schatten')}"/>`;
    for (const t of k) s += `<path d="${zug(t)}" fill="${F('kranich')}" stroke="${F('schatten')}" stroke-width="3" stroke-linejoin="round"/>`;
    return s;
  } });

M.push({ id: 'lavafeld', name: 'Lavafeld', idee: 'Erkaltete Schollen auf gluehender Lava, Funken und heisse Kerne',
  seltenheit: 'legende', weg: { art: 'level', n: 75 }, bewegung: true,
  palette: { grund: ['#ff6a10', 0.82], glut: ['#ffb030', 0.97], k1: ['#3a2420', 0.03], k2: ['#4a2a22', 0.14], k3: ['#5a3028', 0.27], funke: ['#ffd060', 0.94] },
  rahmen: { breite: 14, radius: 12, linie: '#ff8a30', grund: 'radial-gradient(circle at 50% 120%, #ff7a20, #5a1a0a 55%, #1a0a08)' },
  koord: { schrift: '"Arial Black", "Segoe UI", sans-serif', gewicht: 900, farbe: '#3a1408' },
  zeichne(R) {
    let s = grund;
    const g = gitter(R, 9, 0.7);
    for (let j = 0; j < g.n; j++) for (let i = 0; i < g.n; i++) {
      const q = schrumpf([g.ecke(i, j), g.ecke(i + 1, j), g.ecke(i + 1, j + 1), g.ecke(i, j + 1)], zw(R, 0.82, 0.9));
      s += `<path d="${zug(q)}" fill="${F(wahl(R, ['k1', 'k2', 'k3']))}" stroke-linejoin="round"/>`;
      if (R() < 0.3) { const [x, y] = schrumpf(q, 0)[0]; s += `<circle cx="${z(x)}" cy="${z(y)}" r="${z(zw(R, 5, 12))}" fill="${F('glut')}"/>`; }
    }
    for (let i = 0; i < 60; i++) s += `<circle cx="${z(zw(R, 0, 800))}" cy="${z(zw(R, 0, 800))}" r="${z(zw(R, 1.5, 3.5))}" fill="${F('funke')}"/>`;
    return s;
  } });

M.push({ id: 'eisschollen', name: 'Eisschollen', idee: 'Treibende Schollen mit Rissen auf tiefem Polarwasser',
  seltenheit: 'selten', weg: { art: 'stufe', familie: 'serie', stufe: 'silber' },
  palette: { grund: ['#1a4a7a', 0.06], eis1: ['#e8f4ff', 0.97], eis2: ['#cfe6ff', 0.8], eis3: ['#a8d0f0', 0.62], riss: ['#5a90c0', 0.35], schnee: ['#ffffff', 0.99] },
  rahmen: { breite: 14, radius: 10, linie: '#d8ecff', grund: 'linear-gradient(135deg, #e8f4ff, #9cc4e4 40%, #4a7aa8)' },
  koord: { schrift: '"Segoe UI", system-ui, sans-serif', gewicht: 700, farbe: '#0a2a4a' },
  zeichne(R) {
    let s = grund;
    const g = gitter(R, 8, 0.75);
    for (let j = 0; j < g.n; j++) for (let i = 0; i < g.n; i++) {
      const q = schrumpf([g.ecke(i, j), g.ecke(i + 1, j), g.ecke(i + 1, j + 1), g.ecke(i, j + 1)], zw(R, 0.78, 0.92));
      s += `<path d="${zug(q)}" fill="${F(wahl(R, ['eis1', 'eis2', 'eis3']))}" stroke-linejoin="round"/>`;
      if (R() < 0.5) { const [x, y] = schrumpf(q, 0)[0]; s += `<path d="M${z(x - 30)} ${z(y - 10)}l${z(zw(R, 15, 30))} ${z(zw(R, 5, 20))}l${z(zw(R, 15, 30))} ${z(zw(R, -10, 10))}" fill="none" stroke="${F('riss')}" stroke-width="2"/>`; }
    }
    for (let i = 0; i < 70; i++) s += `<circle cx="${z(zw(R, 0, 800))}" cy="${z(zw(R, 0, 800))}" r="${z(zw(R, 1, 2.6))}" fill="${F('schnee')}"/>`;
    return s;
  } });

M.push({ id: 'buecherwand', name: 'Bücherwand', idee: 'Volle Regale mit bunten Buchruecken, Goldpraegung und schiefen Baenden',
  seltenheit: 'selten', weg: { art: 'level', n: 62 },
  palette: { grund: ['#3a2010', 0.04], brett: ['#7a4a22', 0.2], b1: ['#8a1a2a', 0.3], b2: ['#1a4a7a', 0.38], b3: ['#2a6a3a', 0.5], b4: ['#c08a2a', 0.78], b5: ['#5a2a6a', 0.24], b6: ['#d0c0a0', 0.92], gold: ['#e8c050', 0.97] },
  rahmen: { breite: 16, radius: 6, linie: '#c9964a', grund: 'linear-gradient(90deg, #3a2010, #6a3c1a 50%, #3a2010)' },
  koord: { schrift: 'Georgia, serif', gewicht: 700, farbe: '#2a1408' },
  zeichne(R) {
    let s = grund;
    for (let r = 0; r < 6; r++) {
      const unten = r * 133 + 120;
      for (let x = 4; x < 796;) {
        const w = Math.round(zw(R, 16, 32)), h = Math.round(zw(R, 78, 112)), f = wahl(R, ['b1', 'b2', 'b3', 'b4', 'b5', 'b6']);
        if (R() < 0.06 && x < 740) { s += `<rect x="${x}" y="${unten - h}" width="${w}" height="${h}" fill="${F(f)}" transform="rotate(14 ${x} ${unten})"/>`; x += w + 26; continue; }
        s += `<rect x="${x}" y="${unten - h}" width="${w - 2}" height="${h}" fill="${F(f)}"/>`;
        if (R() < 0.7) s += `<rect x="${x + 3}" y="${unten - h + 12}" width="${w - 8}" height="5" fill="${F('gold')}"/><rect x="${x + 3}" y="${unten - 22}" width="${w - 8}" height="4" fill="${F('gold')}"/>`;
        x += w;
      }
      s += `<rect x="0" y="${unten}" width="800" height="13" fill="${F('brett')}"/>`;
    }
    return s;
  } });

M.push({ id: 'schaltplan', name: 'Schaltplan', idee: 'Leuchtende Leiterbahnen, Chips mit Beinchen, Loetpunkte',
  seltenheit: 'episch', weg: { art: 'stufe', familie: 'liga', stufe: 'silber' }, bewegung: true,
  palette: { grund: ['#0a2a1a', 0.08], schein: ['#20ff9a', 0.42], bahn: ['#a0ffd0', 0.95], chip: ['#101418', 0], bein: ['#c0c8d0', 0.82], punkt: ['#ffe060', 0.9] },
  rahmen: { breite: 12, radius: 10, linie: '#20ff9a', grund: 'linear-gradient(135deg, #0a1a12, #123a26 50%, #0a1a12)' },
  koord: { schrift: 'Consolas, "Courier New", monospace', gewicht: 700, farbe: '#0a2a1a' },
  zeichne(R) {
    let s = grund;
    const wege = [];
    for (let i = 0; i < 42; i++) {
      let x = Math.round(zw(R, 0, 32)) * 25, y = Math.round(zw(R, 0, 32)) * 25, d = `M${x} ${y}`;
      for (let k = 0, n = 2 + Math.floor(R() * 4); k < n; k++) { const l = 25 * (1 + Math.floor(R() * 6)); if (k % 2) { y += R() < 0.5 ? l : -l; d += `V${y}`; } else { x += R() < 0.5 ? l : -l; d += `H${x}`; } }
      wege.push([d, x, y]);
    }
    for (const [d] of wege) s += `<path d="${d}" fill="none" stroke="${F('schein')}" stroke-width="9" stroke-linejoin="round" stroke-linecap="round"/>`;
    for (const [d, x, y] of wege) s += `<path d="${d}" fill="none" stroke="${F('bahn')}" stroke-width="2.6" stroke-linejoin="round"/><circle cx="${x}" cy="${y}" r="6" fill="${F('punkt')}"/>`;
    for (let i = 0; i < 6; i++) {
      const x = Math.round(zw(R, 2, 26)) * 25, y = Math.round(zw(R, 2, 26)) * 25, w = 75 + Math.floor(R() * 3) * 25, h = 50 + Math.floor(R() * 2) * 25;
      for (let k = 12; k < w; k += 16) s += `<rect x="${x + k - 3}" y="${y - 10}" width="6" height="${h + 20}" fill="${F('bein')}"/>`;
      s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="${F('chip')}"/><circle cx="${x + 10}" cy="${y + 10}" r="4" fill="${F('bein')}"/>`;
    }
    return s;
  } });

M.push({ id: 'wuestendunen', name: 'Wüstendünen', idee: 'Hintereinander liegende Duenen mit Licht- und Schattenseite, Riffel und Abendsonne',
  seltenheit: 'selten', weg: { art: 'level', n: 65 },
  palette: { grund: ['#5aa8ff', 0.85, 0.7], sonne: ['#ffe060', 0.98], d1: ['#ffb040', 0.92], d2: ['#f08a30', 0.62], d3: ['#d06a28', 0.35], d4: ['#b04a20', 0.12], schatten: ['#8a2a6a', 0.03], riffel: ['#fff0d0', 0.98, 0.9] },
  rahmen: { breite: 14, radius: 12, linie: '#f8d8a0', grund: 'linear-gradient(180deg, #f8c890, #c07a3a 60%, #7a3a1a)' },
  koord: { schrift: '"Segoe UI", system-ui, sans-serif', gewicht: 800, farbe: '#4a2010' },
  zeichne(R) {
    let s = grund + `<circle cx="600" cy="150" r="90" fill="${F('sonne')}"/>`;
    const toene = ['d1', 'd2', 'd3', 'd4', 'd2', 'd3', 'd4'];
    for (let i = 0; i < 7; i++) {
      const y = 200 + i * 90, kamm = zw(R, 150, 650), hoch = zw(R, 60, 110);
      s += `<path d="M-10 ${z(y + 40)}Q${z(kamm - 140)} ${z(y - hoch)} ${z(kamm)} ${z(y - hoch * 0.6)}Q${z(kamm + 200)} ${z(y)} 810 ${z(y + 30)}V810H-10Z" fill="${F(toene[i])}"/>`;
      s += `<path d="M${z(kamm)} ${z(y - hoch * 0.6)}Q${z(kamm + 200)} ${z(y)} 810 ${z(y + 30)}V${z(y + 70)}Q${z(kamm + 160)} ${z(y + 30)} ${z(kamm)} ${z(y - hoch * 0.6)}Z" fill="${F('schatten')}"/>`;
      for (let k = 0; k < 8; k++) { const x = zw(R, 0, kamm), yy = y + zw(R, 0, 60); s += `<path d="M${z(x)} ${z(yy)}q30 -8 60 0" fill="none" stroke="${F('riffel')}" stroke-width="2.2" stroke-linecap="round"/>`; }
    }
    return s;
  } });

M.push({ id: 'kirschgarten', name: 'Kirschgarten', idee: 'Bluehende Zweige quer ueber das Brett, fallende Bluetenblaetter',
  seltenheit: 'episch', weg: { art: 'level', n: 70 },
  palette: { grund: ['#70c0f0', 0.55, 0.35], ast: ['#4a2a2a', 0.02], bl1: ['#ffb0c8', 0.97], bl2: ['#ff5a9a', 0.7], mitte: ['#ffd040', 0.85], blatt: ['#ffe0ea', 0.99] },
  rahmen: { breite: 14, radius: 16, linie: '#ffb0c8', grund: 'linear-gradient(135deg, #3a1e26, #6a3446 50%, #3a1e26)' },
  koord: { schrift: '"Palatino Linotype", Georgia, serif', gewicht: 700, farbe: '#4a1a2a' },
  zeichne(R) {
    let s = grund, enden = [];
    const zweig = (x, y, a, l, b, tiefe) => {
      const ex = x + Math.cos(a) * l, ey = y + Math.sin(a) * l;
      s += `<path d="M${z(x)} ${z(y)}Q${z((x + ex) / 2 + zw(R, -30, 30))} ${z((y + ey) / 2 + zw(R, -30, 30))} ${z(ex)} ${z(ey)}" fill="none" stroke="${F('ast')}" stroke-width="${z(b)}" stroke-linecap="round"/>`;
      if (tiefe > 0) { zweig(ex, ey, a + zw(R, 0.2, 0.6), l * 0.72, b * 0.62, tiefe - 1); zweig(ex, ey, a - zw(R, 0.2, 0.6), l * 0.72, b * 0.62, tiefe - 1); } else enden.push([ex, ey]);
    };
    zweig(-20, 700, -0.55, 300, 26, 3); zweig(820, 160, 2.6, 280, 22, 3);
    for (const [x, y] of enden) for (let i = 0; i < 4; i++) {
      const bx = x + zw(R, -40, 40), by = y + zw(R, -40, 40), r = zw(R, 12, 20), f = R() < 0.5 ? 'bl1' : 'bl2';
      s += `<g transform="translate(${z(bx)} ${z(by)}) rotate(${Math.round(R() * 72)})">${[0, 72, 144, 216, 288].map((w) => `<ellipse cy="${z(-r * 0.55)}" rx="${z(r * 0.36)}" ry="${z(r * 0.55)}" fill="${F(f)}" transform="rotate(${w})"/>`).join('')}<circle r="${z(r * 0.22)}" fill="${F('mitte')}"/></g>`;
    }
    for (let i = 0; i < 40; i++) s += `<ellipse cx="${z(zw(R, 0, 800))}" cy="${z(zw(R, 0, 800))}" rx="7" ry="4" fill="${F(R() < 0.5 ? 'bl2' : 'blatt')}" transform="rotate(${Math.round(R() * 180)})"/>`;
    return s;
  } });

M.push({ id: 'mondkrater', name: 'Mondkrater', idee: 'Graue Mondoberflaeche, Krater mit Lichtkante und Schattenseite',
  seltenheit: 'selten', weg: { art: 'stufe', familie: 'endgegner', stufe: 'silber' },
  palette: { grund: ['#8a8a92', 0.8], mare: ['#5a6a8a', 0.15], krater: ['#7a7a84', 0.34], kante: ['#f0f0f6', 0.97], schatten: ['#2a2a34', 0.02], staub: ['#c0c0c8', 0.75] },
  rahmen: { breite: 14, radius: 400, linie: '#c8c8d4', grund: 'radial-gradient(circle at 35% 30%, #4a4a58, #14141c 70%)' },
  koord: { schrift: '"Segoe UI", system-ui, sans-serif', gewicht: 700, farbe: '#1a1a24' },
  zeichne(R) {
    let s = grund;
    for (let i = 0; i < 5; i++) s += `<path d="${zug(klecks(R, zw(R, 100, 700), zw(R, 100, 700), zw(R, 90, 170), 16, 0.5))}" fill="${F('mare')}"/>`;
    for (let i = 0; i < 90; i++) s += `<circle cx="${z(zw(R, 0, 800))}" cy="${z(zw(R, 0, 800))}" r="${z(zw(R, 1.5, 4))}" fill="${F(R() < 0.5 ? 'staub' : 'schatten')}"/>`;
    for (let i = 0; i < 40; i++) {
      const x = zw(R, 0, 800), y = zw(R, 0, 800), r = i < 6 ? zw(R, 50, 90) : zw(R, 10, 36);
      s += `<circle cx="${z(x)}" cy="${z(y)}" r="${z(r)}" fill="${F('krater')}"/>`;
      s += `<path d="M${z(x - r)} ${z(y)}A${z(r)} ${z(r)} 0 0 1 ${z(x + r)} ${z(y)}" fill="none" stroke="${F('schatten')}" stroke-width="${z(Math.max(2, r / 7))}" transform="rotate(-35 ${z(x)} ${z(y)})"/>`;
      s += `<path d="M${z(x + r)} ${z(y)}A${z(r)} ${z(r)} 0 0 1 ${z(x - r)} ${z(y)}" fill="none" stroke="${F('kante')}" stroke-width="${z(Math.max(2, r / 8))}" transform="rotate(-35 ${z(x)} ${z(y)})"/>`;
    }
    return s;
  } });

M.push({ id: 'nachtstadt', name: 'Stadt bei Nacht', idee: 'Die Stadt von oben: Daecher, erleuchtete Fenster, Strassenlicht, Fluss und Park',
  seltenheit: 'episch', weg: { art: 'welt', welt: 3 }, bewegung: true,
  palette: { grund: ['#14141e', 0.05], dach1: ['#3a4a6a', 0.2], dach2: ['#4a3a5a', 0.32], dach3: ['#2a3a4a', 0.12], licht: ['#ffd27a', 0.96], strasse: ['#ff9a3a', 0.68], fluss: ['#1a3a7a', 0.24], park: ['#1a6a3a', 0.4], baum: ['#2a8a4a', 0.55] },
  rahmen: { breite: 14, radius: 10, linie: '#ffb04a', grund: 'linear-gradient(180deg, #2a2440, #0e0c18)' },
  koord: { schrift: '"Segoe UI", system-ui, sans-serif', gewicht: 800, farbe: '#14141e' },
  zeichne(R) {
    let s = grund;
    const xs = [0, 140, 300, 430, 560, 700, 800], ys = [0, 120, 260, 400, 520, 660, 800];
    for (let j = 0; j < 6; j++) for (let i = 0; i < 6; i++) {
      const x0 = xs[i] + 12, y0 = ys[j] + 12, x1 = xs[i + 1] - 12, y1 = ys[j + 1] - 12;
      if (i === 2 && j === 3) { s += `<rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" fill="${F('park')}"/>`; for (let k = 0; k < 9; k++) s += `<circle cx="${z(zw(R, x0 + 10, x1 - 10))}" cy="${z(zw(R, y0 + 10, y1 - 10))}" r="${z(zw(R, 6, 12))}" fill="${F('baum')}"/>`; continue; }
      for (let y = y0; y < y1 - 10;) {
        const h = Math.min(y1 - y, Math.round(zw(R, 28, 60)));
        for (let x = x0; x < x1 - 10;) {
          const w = Math.min(x1 - x, Math.round(zw(R, 30, 70)));
          s += `<rect x="${x}" y="${y}" width="${w - 4}" height="${h - 4}" fill="${F(wahl(R, ['dach1', 'dach2', 'dach3']))}"/>`;
          if (R() < 0.55) s += `<rect x="${x + 6}" y="${y + 6}" width="${Math.max(4, Math.round((w - 16) * zw(R, 0.2, 0.6)))}" height="5" fill="${F('licht')}"/>`;
          x += w;
        }
        y += h;
      }
    }
    for (const x of xs.slice(1, -1)) s += `<path d="M${x} 0V800" stroke="${F('strasse')}" stroke-width="3" stroke-dasharray="2 14"/>`;
    for (const y of ys.slice(1, -1)) s += `<path d="M0 ${y}H800" stroke="${F('strasse')}" stroke-width="3" stroke-dasharray="2 14"/>`;
    s += `<path d="M-20 90C200 160 260 300 380 420S640 640 820 700" fill="none" stroke="${F('fluss')}" stroke-width="46"/>`;
    return s;
  } });

M.push({ id: 'goldthron', name: 'Goldthron', idee: 'Roter Samt mit Damast-Muster, Goldgitter und Nieten',
  seltenheit: 'legende', weg: { art: 'stufe', familie: 'liga', stufe: 'gold' }, bewegung: true,
  palette: { grund: ['#7a0a2a', 0.28], damast: ['#a01a3a', 0.5], gold: ['#e0b030', 0.9], glanz: ['#fff0b0', 0.99], tief: ['#4a0418', 0.04] },
  rahmen: { breite: 18, radius: 12, linie: '#fff0b0', grund: 'linear-gradient(135deg, #8a6418, #f0c850 30%, #a07820 55%, #f8dc78 80%, #7a5410)' },
  koord: { schrift: '"Palatino Linotype", Palatino, Georgia, serif', gewicht: 700, farbe: '#4a0418' },
  zeichne(R) {
    let s = grund;
    const A = 100;
    for (let j = 0; j <= 8; j++) for (let i = 0; i <= 8; i++) {
      const x = i * A + (j % 2 ? A / 2 : 0), y = j * A;
      s += `<g transform="translate(${x} ${y})"><ellipse cy="-18" rx="11" ry="24" fill="${F('damast')}"/><ellipse cx="-20" cy="6" rx="9" ry="18" fill="${F('damast')}" transform="rotate(-40 -20 6)"/><ellipse cx="20" cy="6" rx="9" ry="18" fill="${F('damast')}" transform="rotate(40 20 6)"/><rect x="-14" y="16" width="28" height="6" fill="${F('damast')}"/></g>`;
    }
    let d = '';
    for (let i = -8; i <= 16; i++) d += `M${i * A} 0L${i * A + 800} 800M${i * A} 800L${i * A + 800} 0`;
    s += `<path d="${d}" stroke="${F('tief')}" stroke-width="7"/><path d="${d}" stroke="${F('gold')}" stroke-width="3"/>`;
    for (let j = 0; j <= 16; j++) for (let i = 0; i <= 16; i++) if ((i + j) % 2 === 0) s += `<circle cx="${i * 50}" cy="${j * 50}" r="7" fill="${F('gold')}"/><circle cx="${i * 50 - 2}" cy="${j * 50 - 2}" r="2.4" fill="${F('glanz')}"/>`;
    return s;
  } });

M.push({ id: 'orientteppich', name: 'Orientteppich', idee: 'Geknuepfter Teppich: Borten, Medaillon in der Mitte, Rosetten im Feld',
  seltenheit: 'episch', weg: { art: 'level', n: 80 },
  palette: { grund: ['#9a1a1a', 0.35], indigo: ['#1a2a6a', 0.3], elfenbein: ['#f0e0c0', 0.96], safran: ['#e0a030', 0.78], gruen: ['#2a6a4a', 0.32], rost: ['#c0502a', 0.5] },
  rahmen: { breite: 14, radius: 4, linie: '#f0e0c0', grund: 'repeating-linear-gradient(90deg, #f0e0c0 0 3px, #c8b48a 3px 6px)' },
  koord: { schrift: 'Georgia, serif', gewicht: 700, farbe: '#2a0a0a' },
  zeichne(R) {
    let s = grund;
    for (const [a, f, w] of [[16, 'indigo', 30], [52, 'elfenbein', 8], [70, 'safran', 6]]) s += `<rect x="${a}" y="${a}" width="${800 - 2 * a}" height="${800 - 2 * a}" fill="none" stroke="${F(f)}" stroke-width="${w}"/>`;
    for (let i = 0; i < 20; i++) for (const [x, y] of [[20 + i * 40, 16], [20 + i * 40, 784], [16, 20 + i * 40], [784, 20 + i * 40]]) s += `<path d="${zug(stern(x, y, 11, 11, 2, 0))}" fill="${F(i % 2 ? 'safran' : 'rost')}"/>`;
    for (let j = 0; j < 6; j++) for (let i = 0; i < 6; i++) {
      const x = 150 + i * 100, y = 150 + j * 100;
      if (Math.hypot(x - 400, y - 400) < 190) continue;
      s += `<g transform="translate(${x} ${y})">${[0, 90, 180, 270].map((w) => `<ellipse cy="-14" rx="8" ry="14" fill="${F((i + j) % 2 ? 'safran' : 'elfenbein')}" transform="rotate(${w})"/>`).join('')}<circle r="7" fill="${F('gruen')}"/></g>`;
    }
    s += `<path d="${zug(stern(400, 400, 220, 150, 16))}" fill="${F('indigo')}"/><path d="${zug(stern(400, 400, 160, 100, 8))}" fill="${F('elfenbein')}"/>`;
    s += `<path d="${zug(stern(400, 400, 96, 60, 8, 0))}" fill="${F('rost')}"/><circle cx="400" cy="400" r="40" fill="${F('safran')}"/><circle cx="400" cy="400" r="16" fill="${F('indigo')}"/>`;
    return s;
  } });

M.push({ id: 'honigwabe', name: 'Honigwabe', idee: 'Waben voller Honig, verdeckelte Zellen und ein paar Bienen',
  seltenheit: 'selten', weg: { art: 'welt', welt: 1 },
  palette: { grund: ['#c08010', 0.25], h1: ['#e09a10', 0.5], h2: ['#f0b020', 0.7], h3: ['#f8c838', 0.85], deckel: ['#f8e8b0', 0.97], wachs: ['#8a5a10', 0.03], streifen: ['#201810', 0], fluegel: ['#e8f4ff', 0.99] },
  rahmen: { breite: 14, radius: 10, linie: '#f8d060', grund: 'linear-gradient(135deg, #6a4008, #c08a20 50%, #6a4008)' },
  koord: { schrift: '"Segoe UI", system-ui, sans-serif', gewicht: 800, farbe: '#3a2008' },
  zeichne(R) {
    let s = grund;
    const r = 42, w = r * Math.sqrt(3);
    for (let j = -1; j < 14; j++) for (let i = -1; i < 11; i++) {
      const cx = i * w + (j % 2 ? w / 2 : 0), cy = j * r * 1.5;
      s += `<path d="${zug(sechseck(cx, cy, r))}" fill="${F(R() < 0.22 ? 'deckel' : wahl(R, ['h1', 'h2', 'h3']))}" stroke="${F('wachs')}" stroke-width="5" stroke-linejoin="round"/>`;
    }
    for (let i = 0; i < 6; i++) {
      const x = zw(R, 80, 720), y = zw(R, 80, 720), a = Math.round(zw(R, 0, 360));
      s += `<g transform="translate(${z(x)} ${z(y)}) rotate(${a})"><ellipse cx="-8" cy="-16" rx="12" ry="8" fill="${F('fluegel')}"/><ellipse cx="-8" cy="16" rx="12" ry="8" fill="${F('fluegel')}"/><ellipse rx="22" ry="12" fill="${F('h3')}"/><rect x="-8" y="-11" width="5" height="22" fill="${F('streifen')}"/><rect x="4" y="-11" width="5" height="22" fill="${F('streifen')}"/><circle cx="22" r="7" fill="${F('streifen')}"/></g>`;
    }
    return s;
  } });

M.push({ id: 'galaxie', name: 'Galaxie', idee: 'Spiralgalaxie mit leuchtendem Kern, Nebelwolken in Pink und Blau',
  seltenheit: 'legende', weg: { art: 'stufe', familie: 'siege', stufe: 'gold' }, bewegung: true,
  palette: { grund: ['#3a2aa0', 0.92, 0.02], n1: ['#ff30d0', 0.35, 0.45], n2: ['#4060ff', 0.5, 0.3], n3: ['#20e0ff', 0.7, 0.65], stern: ['#ffd040', 0.1, 0.98], k1: ['#ffb040', 0.3, 0.85], k2: ['#ff7020', 0.05, 0.99] },
  rahmen: { breite: 14, radius: 18, linie: '#d8a0ff', grund: 'conic-gradient(from 200deg, #1a0a3a, #4a1a6a, #0a1a4a, #2a0a4a, #1a0a3a)' },
  koord: { schrift: '"Trebuchet MS", "Segoe UI", sans-serif', gewicht: 700, farbe: '#0a0a2a' },
  zeichne(R) {
    let s = grund;
    for (let i = 0; i < 46; i++) { const a = zw(R, 0, Math.PI * 2), q = zw(R, 60, 420); s += `<ellipse cx="${z(400 + Math.cos(a) * q)}" cy="${z(400 + Math.sin(a) * q * 0.8)}" rx="${z(zw(R, 40, 110))}" ry="${z(zw(R, 18, 50))}" fill="${F(wahl(R, ['n1', 'n2', 'n3']))}" transform="rotate(${Math.round(a * 57.3 + 90)} ${z(400 + Math.cos(a) * q)} ${z(400 + Math.sin(a) * q * 0.8)})"/>`; }
    for (const arm of [0, Math.PI]) for (let i = 0; i < 130; i++) {
      const t = i / 130 * 3.4, q = 30 * Math.exp(0.75 * t), a = arm + t + zw(R, -0.18, 0.18);
      s += `<circle cx="${z(400 + Math.cos(a) * q + zw(R, -12, 12))}" cy="${z(400 + Math.sin(a) * q * 0.8 + zw(R, -12, 12))}" r="${z(zw(R, 1.2, 3.8))}" fill="${F('stern')}"/>`;
    }
    for (let i = 0; i < 70; i++) s += `<circle cx="${z(zw(R, 0, 800))}" cy="${z(zw(R, 0, 800))}" r="${z(zw(R, 0.8, 2))}" fill="${F('stern')}"/>`;
    s += `<ellipse cx="400" cy="400" rx="90" ry="70" fill="${F('k1')}"/><ellipse cx="400" cy="400" rx="44" ry="34" fill="${F('k2')}"/>`;
    return s;
  } });

M.push({ id: 'zahnwerk', name: 'Zahnwerk', idee: 'Ineinander greifende Zahnraeder aus Messing, Kupfer und Stahl, Schrauben',
  seltenheit: 'episch', weg: { art: 'level', n: 85 },
  palette: { grund: ['#2a4a6a', 0.08], messing: ['#e0b030', 0.9], kupfer: ['#c06a30', 0.45], stahl: ['#a0a8b0', 0.6], loch: ['#2a1a0a', 0], achse: ['#f0e0b0', 0.97], platte: ['#5a4020', 0.2] },
  rahmen: { breite: 16, radius: 8, linie: '#e8c870', grund: 'linear-gradient(135deg, #5a4020, #a07c3a 35%, #4a3418 60%, #8a6a30)' },
  koord: { schrift: '"Courier New", Consolas, monospace', gewicht: 700, farbe: '#2a1a08' },
  zeichne(R) {
    let s = grund;
    for (let i = 0; i < 10; i++) s += `<rect x="${z(zw(R, -50, 700))}" y="${z(zw(R, -50, 700))}" width="${z(zw(R, 120, 260))}" height="${z(zw(R, 80, 200))}" rx="12" fill="${F('platte')}"/>`;
    const raeder = [[160, 180, 140], [390, 300, 95], [600, 190, 120], [250, 520, 110], [520, 560, 150], [720, 420, 70], [110, 720, 80], [760, 740, 90], [400, 760, 50], [60, 380, 60]];
    for (const [cx, cy, r] of raeder) {
      const f = wahl(R, ['messing', 'kupfer', 'stahl']), n = Math.max(10, Math.round(r / 7));
      s += `<path d="${zug(zahnrad(cx, cy, r, n, Math.max(10, r * 0.14)))}" fill="${F(f)}" stroke="${F('loch')}" stroke-width="3" stroke-linejoin="round"/>`;
      s += `<circle cx="${cx}" cy="${cy}" r="${z(r * 0.62)}" fill="none" stroke="${F('loch')}" stroke-width="3"/>`;
      for (let k = 0; k < 5; k++) { const a = k * Math.PI * 2 / 5 + R(); s += `<circle cx="${z(cx + Math.cos(a) * r * 0.42)}" cy="${z(cy + Math.sin(a) * r * 0.42)}" r="${z(r * 0.13)}" fill="${F('loch')}"/>`; }
      s += `<circle cx="${cx}" cy="${cy}" r="${z(r * 0.16)}" fill="${F('achse')}"/>`;
    }
    for (let i = 0; i < 16; i++) { const x = zw(R, 20, 780), y = zw(R, 20, 780); s += `<circle cx="${z(x)}" cy="${z(y)}" r="9" fill="${F('stahl')}"/><path d="M${z(x - 6)} ${z(y)}h12" stroke="${F('loch')}" stroke-width="2.4"/>`; }
    return s;
  } });

export const MOTIVE = Object.freeze(M.map((m) => Object.freeze(m)));

// ---------- Bild und Farben je Motiv ----------
const bilder = new Map();
const faerben = (m, band) => {
  const f = {};
  // [Ton, Stufe] oder [Ton, Stufe hell, Stufe dunkel]: so kann ein Motiv Grund und Figur je Feldart ans andere Bandende legen
  for (const [rolle, [ton, stufe, stufeD = stufe]] of Object.entries(m.palette)) f[rolle] = inBand(ton, band, band === BAND.dunkel ? stufeD : stufe);
  return f;
};
export function motivBild(m) {
  if (bilder.has(m.id)) return bilder.get(m.id);
  const roh = m.zeichne(zufall('v3:' + m.id));
  const setze = (f) => roh.replace(/§([a-z0-9]+)§/g, (_, r) => { if (!f[r]) throw new Error(`Motiv ${m.id}: Rolle ${r} fehlt in der Palette`); return f[r]; });
  const b = Object.freeze({ h: setze(faerben(m, BAND.hell)), d: setze(faerben(m, BAND.dunkel)) });
  bilder.set(m.id, b);
  return b;
}
export const feldFarben = (m) => ({ h: inBand(m.palette.grund[0], BAND.hell, m.palette.grund[1]), d: inBand(m.palette.grund[0], BAND.dunkel, m.palette.grund[1]) });
// Koordinaten: sehr dunkel im Ton des Motivs auf hellen Feldern, sehr hell auf dunklen
export const koordFarben = (m) => ({ h: inBand(m.koord.farbe, [0.03, 0.05], 0.5), d: inBand(m.koord.farbe, [0.86, 0.9], 0.5) });

export function motivCss(m) {
  const b = motivBild(m), feld = feldFarben(m), k = koordFarben(m), r = m.rahmen;
  const sel = `.motiv-brett[data-motiv="${m.id}"]`;
  let css = `${sel} { padding: ${r.breite}px; border-radius: ${Math.min(r.radius, 40)}px; background: ${r.grund}; `
    + `box-shadow: inset 0 0 0 2px ${r.linie}, 0 10px 28px rgba(0, 0, 0, .5); `
    + `--feld-hell: ${feld.h}; --feld-dunkel: ${feld.d}; --feld-muster-hell: ${svgUrl(b.h)}; --feld-muster-dunkel: ${svgUrl(b.d)}; --feld-muster-groesse: ${GROESSE}; }\n`
    + `${sel} .brett { border-radius: ${r.radius >= 400 ? 6 : Math.min(r.radius, 10) / 2}px; box-shadow: 0 0 0 2px ${r.linie}; }\n`
    + `${sel} .brett .koord { font-family: ${m.koord.schrift}; font-weight: ${m.koord.gewicht}; }\n`
    + `${sel} .brett .feld.h .koord { color: ${k.h}; text-shadow: none; }\n`
    + `${sel} .brett .feld.d .koord { color: ${k.d}; text-shadow: none; }\n`;
  // leiser Glanz NUR ueber den Rahmen (nie ueber die Felder) und nur ohne "weniger Bewegung"
  if (m.bewegung) {
    css += `@media (prefers-reduced-motion: no-preference) {\n`
      + `  ${sel} { background: linear-gradient(115deg, transparent 35%, rgba(255, 255, 255, .22) 50%, transparent 65%) 0 0 / 300% 100%, ${r.grund}; `
      + `animation: motiv-glanz-${m.id} 9s ease-in-out infinite alternate; }\n`
      + `  @keyframes motiv-glanz-${m.id} { from { background-position: 100% 0, 0 0; } to { background-position: 0 0, 0 0; } }\n}\n`;
  }
  return css;
}
