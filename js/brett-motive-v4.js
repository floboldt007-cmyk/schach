// Motiv-Bretter, Fassung 4 (Flo 14.11.2026 zu Fassung 3: "man erkennt das Brett gar nicht mehr"). 20 Entwuerfe, die
// auf den ersten Blick ein klares Schachbrett sind: helle und dunkle Felder deutlich getrennt (mind. 3,0 an der
// schlechtesten Stelle), das Motiv lebt nur leise IN den Feldern (feine Textur, hoechstens 1,15 innerhalb einer Feldart)
// und im RAHMEN (Ornament, Koordinaten-Schrift). Kein Bild ueber die Felder hinweg: jede Feldtextur ist eine eigene
// SVG-Zelle, die an der Feldkante abschneidet. Ideen aus Fassung 3 (Kirchenfenster als Bleiglas-Rahmen, Seekarte mit
// Kompassrose, Sternbilder nur als feine Punkte im dunklen Feld ...).
// NUR fuer die Vorschau (werkzeuge/bretter-vorschau-v4.html), nicht in der App, nicht im Service Worker, nicht freischaltbar.
//
//   MOTIVE                 [{ id, name, idee, konkret, seltenheit, weg, bewegung?, feld, textur(R, art), rahmen, koord }]
//                          feld: { h: [Ton, L], d: [Ton, L], akzent?: { h, d } }   L = relative Leuchtdichte (WCAG)
//   GRENZE                 { textur: 1.15, feld: 3.0, koord: 3.0 }   (tests/bretter-v4.test.mjs prueft dieselben Werte)
//   texturBild(m) -> { h, d }    SVG-Inhalt (viewBox 0 0 800 800, 64 Zellen je 100) fuer helle und dunkle Felder
//   feldFarben(m) -> { h, d }    Grundfarbe der Felder
//   koordFarben(m) -> { h, d }   Koordinaten auf hellen bzw. dunklen Feldern
//   rahmenBild(m) -> string      SVG-Inhalt des Rahmens (viewBox 0 0 1000 1000, Band = rahmen.breite)
//   motivCss(m) -> string        Rahmen, Felder, Koordinaten und (nur ohne "weniger Bewegung") ein Glanz NUR auf dem Rahmen
//
// Textur durch Bauart leise: jede Farbe einer Feldart hat die Leuchtdichte der Grundfarbe, um hoechstens den Faktor TON
// auf (L + 0,05) verschoben (Rollen g, l, ll, t, tt, a, b). Das allein haelt 1,15 nicht ganz: an Kanten zwischen zwei
// Farbtoenen mischt der Browser etwas dunkler. Darum misst der Test zusaetzlich das echte Brett (Herleitung B), und die
// gilt.
import { inBand } from './brett-motive.js';
import { svgUrl, GROESSE } from './brett-flaechen.js';

export const GRENZE = Object.freeze({ textur: 1.15, feld: 3.0, koord: 3.0 });
const TON = 0.055;

// ---------- Werkzeuge
const zufall = (text) => {
  let s = 2166136261;
  for (const c of text) s = Math.imul(s ^ c.charCodeAt(0), 16777619);
  return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
};
const z = (v) => Math.round(v * 10) / 10;
const zw = (R, a, b) => a + R() * (b - a);
const F = (rolle) => `§${rolle}§`;
const zug = (pkt) => 'M' + pkt.map(([x, y]) => `${z(x)} ${z(y)}`).join('L') + 'Z';
const linie = (pkt) => 'M' + pkt.map(([x, y]) => `${z(x)} ${z(y)}`).join('L');
const stern = (cx, cy, aussen, innen, zacken, dreh = -Math.PI / 2) => Array.from({ length: zacken * 2 }, (_, i) => { const a = dreh + (i * Math.PI) / zacken, r = i % 2 ? innen : aussen; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; });
const sechseck = (cx, cy, r) => Array.from({ length: 6 }, (_, i) => [cx + Math.cos(Math.PI / 6 + i * Math.PI / 3) * r, cy + Math.sin(Math.PI / 6 + i * Math.PI / 3) * r]);
const zahnrad = (cx, cy, r, zaehne, tiefe) => {
  const pkt = [];
  for (let i = 0; i < zaehne; i++) {
    const a = (i / zaehne) * Math.PI * 2, b = Math.PI * 2 / zaehne;
    for (const [w, q] of [[0, r - tiefe], [0.15, r], [0.5, r], [0.65, r - tiefe]]) pkt.push([cx + Math.cos(a + w * b) * q, cy + Math.sin(a + w * b) * q]);
  }
  return pkt;
};
// wellige Linie quer durch die Zelle (Maserung, Wellen, Adern)
const welle = (R, y, amp, schritte = 6) => linie(Array.from({ length: schritte + 1 }, (_, i) => [i * 100 / schritte, y + Math.sin(i * 1.3 + R() * 6) * amp]));
const strich = (w = 1.6) => `fill="none" stroke-width="${w}" stroke-linecap="round"`;

// Rahmen: Band rundherum (viewBox 1000), Punkte auf der Mittellinie mit Richtung, die vier Ecken
const umlauf = (B, n, versatz = 0.5) => {
  const L = 1000 - B, aus = [];
  for (let i = 0; i < n; i++) {
    const t = ((i + versatz) / n) * 4 * L, seite = Math.floor(t / L), u = t - seite * L, h = B / 2;
    aus.push([[h + u, h, 0], [1000 - h, h + u, 90], [1000 - h - u, 1000 - h, 180], [h, 1000 - h - u, 270]][seite]);
  }
  return aus;
};
const ecken = (B) => [[B / 2, B / 2], [1000 - B / 2, B / 2], [1000 - B / 2, 1000 - B / 2], [B / 2, 1000 - B / 2]];
const band = (B, fill) => `<path d="M0 0H1000V1000H0ZM${B} ${B}V${1000 - B}H${1000 - B}V${B}Z" fill="${fill}" fill-rule="evenodd"/>`;
const kante = (a, farbe, w) => `<rect x="${a}" y="${a}" width="${1000 - 2 * a}" height="${1000 - 2 * a}" fill="none" stroke="${farbe}" stroke-width="${w}"/>`;
const verlauf = (id, stopps) => `<defs><linearGradient id="${id}" gradientTransform="rotate(45 .5 .5)">${stopps.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')}</linearGradient></defs>`;

// ---------- die 20 Motive
// textur(R, art) zeichnet EINE Feldzelle (0..100) mit den Rollen §g§ (Grund) §l§ §ll§ (heller) §t§ §tt§ (dunkler) §a§ §b§ (Akzentton heller/dunkler)
const M = [];

M.push({ id: 'kirchenfenster', name: 'Kirchenfenster', seltenheit: 'episch', weg: { art: 'level', n: 60 },
  idee: 'Rahmen aus Bleiglas, Felder wie gehaemmertes Glas',
  konkret: 'Helle Felder bernsteinfarben, dunkle Felder tiefblau, beide mit feiner Glaskörnung; der Rahmen ist ein Bleiglasband aus Rubin, Saphir, Smaragd und Bernstein mit kleinen Rosetten in den Ecken.',
  feld: { h: ['#f0d890', 0.62], d: ['#3040b0', 0.12] },
  textur(R) {
    let s = '';
    for (let i = 0; i < 7; i++) { const x = zw(R, 5, 95), y = zw(R, 5, 95), r = zw(R, 8, 16); s += `<path d="${zug(Array.from({ length: 6 }, (_, k) => [x + Math.cos(k + R()) * r, y + Math.sin(k + R()) * r]))}" fill="${F(i % 2 ? 'll' : 'tt')}"/>`; }
    for (let i = 0; i < 3; i++) s += `<path d="${welle(R, zw(R, 15, 85), 6, 5)}" stroke="${F('l')}" ${strich(1.2)}/>`;
    return s;
  },
  rahmen: { breite: 66, radius: 14, linie: '#d9b45a', zeichne(B, R) {
    const glas = ['#c0203a', '#2050c0', '#1f9a5a', '#e0a020', '#8a3cc0'];
    let s = band(B, '#2a2830');
    for (const [x, y, w] of umlauf(B, 40)) s += `<rect x="${z(x - 22)}" y="${z(y - B / 2 + 7)}" width="44" height="${B - 14}" rx="4" fill="${glas[Math.floor(R() * glas.length)]}" stroke="#1a1a20" stroke-width="5" transform="rotate(${w} ${z(x)} ${z(y)})"/>`;
    for (const [x, y] of ecken(B)) {
      s += `<circle cx="${x}" cy="${y}" r="${B / 2 - 4}" fill="#2050c0" stroke="#1a1a20" stroke-width="5"/>`;
      for (let i = 0; i < 8; i++) s += `<ellipse cx="${x}" cy="${y - 14}" rx="5" ry="11" fill="${i % 2 ? '#c0203a' : '#e0a020'}" stroke="#1a1a20" stroke-width="2" transform="rotate(${i * 45} ${x} ${y})"/>`;
    }
    return s + kante(3, '#d9b45a', 5) + kante(B - 3, '#d9b45a', 5);
  } },
  koord: { schrift: '"Palatino Linotype", Palatino, Georgia, serif', gewicht: 700, ton: '#2a2440' } });

M.push({ id: 'seekarte', name: 'Alte Seekarte', seltenheit: 'episch', weg: { art: 'welt', welt: 4 },
  idee: 'Kartenrand mit Gradskala und Kompassrosen, Felder aus Pergament und Meer',
  konkret: 'Helle Felder pergamentfarben mit feinen Fasern, dunkle Felder meerblau mit ganz leisen Wellenlinien; der Rahmen ist die schwarz-weiße Gradskala alter Seekarten mit einer Kompassrose in jeder Ecke.',
  feld: { h: ['#e8d4a0', 0.62], d: ['#1f5a8a', 0.12] },
  textur(R, art) {
    let s = '';
    if (art === 'd') for (let i = 0; i < 5; i++) { const x = zw(R, 0, 70), y = zw(R, 10, 90); s += `<path d="M${z(x)} ${z(y)}q8 -5 16 0t16 0" stroke="${F(i % 2 ? 'l' : 'll')}" ${strich(1.8)}/>`; }
    else for (let i = 0; i < 9; i++) { const y = zw(R, 0, 100); s += `<path d="M${z(zw(R, -10, 40))} ${z(y)}l${z(zw(R, 30, 70))} ${z(zw(R, -4, 4))}" stroke="${F(i % 3 ? 'tt' : 't')}" ${strich(1)}/>`; }
    return s;
  },
  rahmen: { breite: 70, radius: 6, linie: '#c9a15a', zeichne(B) {
    let s = band(B, '#efe0b8') + kante(B * 0.18, '#2a1e12', 3) + kante(B * 0.48, '#2a1e12', 3);
    for (const [x, y, w] of umlauf(B, 64)) s += `<rect x="${z(x - 6)}" y="${z(y - B * 0.15)}" width="12" height="${z(B * 0.3)}" fill="#2a1e12" transform="rotate(${w} ${z(x)} ${z(y)})"/>`;
    for (const [x, y] of ecken(B)) {
      s += `<circle cx="${x}" cy="${y}" r="${B / 2 - 2}" fill="#efe0b8" stroke="#2a1e12" stroke-width="3"/>`;
      s += `<path d="${zug(stern(x, y, B / 2 - 6, 6, 4))}" fill="#a0302a" stroke="#2a1e12" stroke-width="2"/><path d="${zug(stern(x, y, B / 3, 4, 4, -Math.PI / 4))}" fill="#d8a838" stroke="#2a1e12" stroke-width="2"/>`;
    }
    return s + kante(2, '#5a3c1c', 4) + kante(B - 2, '#5a3c1c', 4);
  } },
  koord: { schrift: 'Georgia, "Times New Roman", serif', gewicht: 700, ton: '#3a2a18' } });

M.push({ id: 'sternbilder', name: 'Sternbilder', seltenheit: 'legende', weg: { art: 'stufe', familie: 'sterne', stufe: 'gold' }, bewegung: true,
  idee: 'Nachtblaue Felder mit feinem Sternenstaub, Rahmen mit Sternbildern',
  konkret: 'Helle Felder silberblau und fast glatt, dunkle Felder mitternachtsblau mit feinen hellblauen Pünktchen (Sterne nur als Punkte, kein Himmel über dem Brett); der Rahmen zeigt kleine Sternbilder auf Nachtblau, ein Glanz läuft leise darüber.',
  // Sterne blassblau-weiss statt gold: zwischen Gold und Nachtblau mischte die Kante zu dunkel (am Brett 1,17)
  feld: { h: ['#dfe6f5', 0.66], d: ['#1a2a80', 0.125], akzent: { h: '#c0c8e0', d: '#b0c0ff' } },
  textur(R, art) {
    let s = '';
    const n = art === 'd' ? 14 : 5;
    for (let i = 0; i < n; i++) s += `<circle cx="${z(zw(R, 4, 96))}" cy="${z(zw(R, 4, 96))}" r="${z(zw(R, 0.8, 2))}" fill="${F(art === 'd' ? 'a' : 'tt')}"/>`;
    if (art === 'd' && R() < 0.5) { const x = zw(R, 20, 80), y = zw(R, 20, 80); s += `<path d="${zug(stern(x, y, 4, 1.2, 4))}" fill="${F('a')}"/>`; }
    return s;
  },
  rahmen: { breite: 64, radius: 16, linie: '#a8c4ff', zeichne(B, R) {
    let s = band(B, '#0e1436');
    for (const [x, y] of umlauf(B, 90, 0.3)) { s += `<circle cx="${z(x + zw(R, -B / 3, B / 3))}" cy="${z(y + zw(R, -B / 3, B / 3))}" r="${z(zw(R, 1.2, 3))}" fill="#fff4c0"/>`; }
    for (const [x, y, w] of umlauf(B, 12, 0.25)) {
      const p = [[-40, 8], [-15, -12], [8, 6], [36, -10]];
      s += `<g transform="translate(${z(x)} ${z(y)}) rotate(${w})"><path d="${linie(p)}" ${strich(2)} stroke="#8aa8ff"/>${p.map(([a, b]) => `<path d="${zug(stern(a, b, 7, 2.4, 4))}" fill="#ffd040"/>`).join('')}</g>`;
    }
    return s + kante(3, '#a8c4ff', 4) + kante(B - 3, '#a8c4ff', 3);
  } },
  koord: { schrift: '"Trebuchet MS", "Segoe UI", sans-serif', gewicht: 700, ton: '#1a2a6c' } });

M.push({ id: 'intarsie', name: 'Holzintarsie', seltenheit: 'episch', weg: { art: 'welt', welt: 2 },
  idee: 'Ahorn und Nussbaum mit wechselnder Maserung, Rahmen mit Zahnband',
  konkret: 'Helle Felder aus Ahorn, dunkle aus Nussbaum, die feine Maserung läuft von Feld zu Feld abwechselnd quer und längs wie bei echten Einlegearbeiten; der Rahmen ist ein Zahnband aus hellen und dunklen Holzdreiecken.',
  feld: { h: ['#e8c890', 0.58], d: ['#6a3a1a', 0.12] },
  textur(R) {
    let s = ''; const quer = R() < 0.5;
    for (let i = 0; i < 9; i++) s += `<path d="${welle(R, 6 + i * 11 + zw(R, -2, 2), zw(R, 1, 3))}" stroke="${F(i % 3 ? 'tt' : 't')}" ${strich(zw(R, 0.8, 2))}${quer ? ' transform="rotate(90 50 50)"' : ''}/>`;
    return s;
  },
  rahmen: { breite: 66, radius: 8, linie: '#e8c890', zeichne(B) {
    let s = band(B, '#4a2a12');
    for (const [x, y, w] of umlauf(B, 60)) s += `<path d="M${z(-14)} ${z(B * 0.28)}L0 ${z(-B * 0.28)}L14 ${z(B * 0.28)}Z" fill="#e8c890" transform="translate(${z(x)} ${z(y)}) rotate(${w})"/>`;
    for (const [x, y] of ecken(B)) s += `<rect x="${x - B / 2 + 6}" y="${y - B / 2 + 6}" width="${B - 12}" height="${B - 12}" fill="#e8c890"/><path d="${zug(stern(x, y, B / 2 - 10, B / 6, 4, 0))}" fill="#6a3a1a"/>`;
    return s + kante(6, '#c8a070', 4) + kante(B - 6, '#c8a070', 4);
  } },
  koord: { schrift: 'Georgia, serif', gewicht: 700, ton: '#3a1e0a' } });

M.push({ id: 'orientteppich', name: 'Orientteppich', seltenheit: 'episch', weg: { art: 'level', n: 80 },
  idee: 'Gewebte Felder in Elfenbein und Karminrot, Teppichborduere als Rahmen',
  konkret: 'Helle Felder elfenbein, dunkle karminrot, beide mit einem feinen Webraster wie Knoten im Teppich; der Rahmen ist eine indigoblaue Bordüre mit Rosetten, Zickzack und Safrangelb.',
  feld: { h: ['#f0e0b8', 0.64], d: ['#b01828', 0.12] },
  textur(R) {
    let s = '';
    for (let i = 5; i < 100; i += 10) s += `<path d="M0 ${i}H100" stroke="${F('tt')}" stroke-width="1.4"/><path d="M${i} 0V100" stroke="${F('ll')}" stroke-width="1.4"/>`;
    if (R() < 0.4) s += `<path d="${zug(stern(50, 50, 10, 10, 2, 0))}" fill="${F('t')}"/>`;
    return s;
  },
  rahmen: { breite: 70, radius: 4, linie: '#f0e0c0', zeichne(B) {
    let s = band(B, '#1e2a6a') + kante(B * 0.14, '#e8b030', 6) + kante(B * 0.86, '#e8b030', 6);
    for (const [x, y, w] of umlauf(B, 28)) s += `<g transform="translate(${z(x)} ${z(y)}) rotate(${w})">${[0, 90, 180, 270].map((d) => `<ellipse cy="-10" rx="6" ry="10" fill="#e8b030" transform="rotate(${d})"/>`).join('')}<circle r="6" fill="#b01828"/></g>`;
    for (const [x, y, w] of umlauf(B, 28, 0)) s += `<path d="${zug(stern(0, 0, 10, 10, 2, 0))}" fill="#f0e0b8" transform="translate(${z(x)} ${z(y)}) rotate(${w})"/>`;
    for (const [x, y] of ecken(B)) s += `<rect x="${x - B / 2}" y="${y - B / 2}" width="${B}" height="${B}" fill="#b01828"/><path d="${zug(stern(x, y, B / 2 - 6, B / 4, 8))}" fill="#e8b030"/>`;
    return s;
  } },
  koord: { schrift: 'Georgia, serif', gewicht: 700, ton: '#3a0a0a' } });

M.push({ id: 'goldthron', name: 'Goldthron', seltenheit: 'legende', weg: { art: 'stufe', familie: 'liga', stufe: 'gold' }, bewegung: true,
  idee: 'Goldrahmen mit Filigran und Edelsteinen, Felder mit leisem Damastmuster',
  konkret: 'Helle Felder champagnerfarben, dunkle Felder weinrot, beide mit einem ganz leisen Damast-Lilienmuster; der Rahmen ist poliertes Gold mit Ranken und Rubinen und Saphiren, ein Glanz läuft darüber.',
  feld: { h: ['#f4e4b0', 0.66], d: ['#6a1840', 0.12] },
  textur() {
    const l = 'M50 30c-6 8 -6 16 0 22c6 -6 6 -14 0 -22zM50 52c-10 -4 -18 0 -20 8c8 2 14 0 20 -8zM50 52c10 -4 18 0 20 8c-8 2 -14 0 -20 -8z';
    return `<path d="${l}" fill="${F('ll')}"/><path d="M50 52v18" stroke="${F('ll')}" stroke-width="2"/>`
      + [[0, 0], [100, 0], [0, 100], [100, 100]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9" fill="${F('tt')}"/>`).join('');
  },
  rahmen: { breite: 70, radius: 12, linie: '#fff0b0', zeichne(B) {
    let s = verlauf('gold', [[0, '#7a5410'], [0.3, '#f0d070'], [0.5, '#a07418'], [0.75, '#f8e090'], [1, '#7a5410']]) + band(B, 'url(#gold)');
    for (const [x, y, w] of umlauf(B, 24)) s += `<path d="M-28 6c6 -14 18 -14 22 -4s-6 12 -10 6M28 6c-6 -14 -18 -14 -22 -4s6 12 10 6" ${strich(3)} stroke="#6a4808" transform="translate(${z(x)} ${z(y)}) rotate(${w})"/>`;
    for (const [x, y, w] of umlauf(B, 24, 0)) s += `<ellipse cx="${z(x)}" cy="${z(y)}" rx="8" ry="11" fill="${w % 180 ? '#2050c0' : '#c01830'}" stroke="#fff0b0" stroke-width="2" transform="rotate(${w} ${z(x)} ${z(y)})"/>`;
    for (const [x, y] of ecken(B)) s += `<circle cx="${x}" cy="${y}" r="${B / 2 - 6}" fill="#c01830" stroke="#fff0b0" stroke-width="4"/><circle cx="${x - 6}" cy="${y - 6}" r="5" fill="#ff8090"/>`;
    return s + kante(4, '#fff0b0', 3) + kante(B - 4, '#5a3c08', 4);
  } },
  koord: { schrift: '"Palatino Linotype", Palatino, serif', gewicht: 700, ton: '#4a0a2a' } });

M.push({ id: 'honigwabe', name: 'Honigwabe', seltenheit: 'selten', weg: { art: 'welt', welt: 1 },
  idee: 'Felder mit feinen Wabenlinien, Rahmen aus Wachswaben mit Bienen',
  konkret: 'Helle Felder hellhonigfarben, dunkle bernsteinbraun, beide mit ganz feinen Sechseck-Linien; der Rahmen ist eine goldgelbe Wabe mit verdeckelten Zellen und vier Bienen in den Ecken.',
  feld: { h: ['#f4d890', 0.62], d: ['#8a5010', 0.12] },
  textur() {
    let s = ''; const r = 12, w = r * Math.sqrt(3);
    for (let j = -1; j < 7; j++) for (let i = -1; i < 6; i++) s += `<path d="${zug(sechseck(i * w + (j % 2 ? w / 2 : 0), j * r * 1.5, r))}" fill="none" stroke="${F('t')}" stroke-width="1.4"/>`;
    return s;
  },
  rahmen: { breite: 68, radius: 10, linie: '#f8d060', zeichne(B, R) {
    let s = band(B, '#7a4a08'); const r = 13, w = r * Math.sqrt(3);
    for (let j = -1; j < 1000 / (r * 1.5) + 1; j++) for (let i = -1; i < 1000 / w + 1; i++) {
      const cx = i * w + (j % 2 ? w / 2 : 0), cy = j * r * 1.5;
      if (cx > B + r && cx < 1000 - B - r && cy > B + r && cy < 1000 - B - r) continue;
      s += `<path d="${zug(sechseck(cx, cy, r - 1.5))}" fill="${R() < 0.25 ? '#f8e8b0' : R() < 0.5 ? '#f0b020' : '#e09a10'}"/>`;
    }
    for (const [x, y] of ecken(B)) s += `<g transform="translate(${x} ${y}) rotate(-30)"><ellipse cx="-4" cy="-12" rx="10" ry="6" fill="#e8f4ff"/><ellipse cx="-4" cy="12" rx="10" ry="6" fill="#e8f4ff"/><ellipse rx="17" ry="10" fill="#f8c838"/><rect x="-6" y="-9" width="4" height="18" fill="#201810"/><rect x="3" y="-9" width="4" height="18" fill="#201810"/><circle cx="17" r="6" fill="#201810"/></g>`;
    return s + kante(3, '#f8d060', 4) + kante(B - 3, '#5a3404', 4);
  } },
  koord: { schrift: '"Segoe UI", system-ui, sans-serif', gewicht: 800, ton: '#3a2008' } });

M.push({ id: 'marmorsaal', name: 'Marmorsaal', seltenheit: 'episch', weg: { art: 'level', n: 66 },
  idee: 'Weisser und gruener Marmor mit feinen Adern, Rahmen aus kanneliertem Stein',
  konkret: 'Helle Felder weißer Carrara-Marmor, dunkle grüner Marmor, je Feld ein paar feine, leise Adern, die an der Feldkante enden; der Rahmen ist hellgrauer Stein mit Rillen wie eine Säule und Eckblöcken.',
  feld: { h: ['#eeeeea', 0.70], d: ['#2a7050', 0.12] },
  textur(R) {
    let s = '';
    for (let i = 0; i < 3; i++) { let x = zw(R, 0, 100), y = 0; const p = [[x, y]]; while (y < 100) { y += zw(R, 8, 16); x += zw(R, -12, 12); p.push([x, y]); } s += `<path d="${linie(p)}" stroke="${F(i ? 'tt' : 't')}" ${strich(zw(R, 0.8, 2.2))}/>`; }
    return s;
  },
  rahmen: { breite: 66, radius: 6, linie: '#f0f0ea', zeichne(B) {
    let s = verlauf('stein', [[0, '#9a9a98'], [0.5, '#d8d8d4'], [1, '#8a8a88']]) + band(B, 'url(#stein)');
    for (const [x, y, w] of umlauf(B, 70)) s += `<rect x="${z(x - 3)}" y="${z(y - B * 0.32)}" width="6" height="${z(B * 0.64)}" rx="3" fill="#7a7a78" transform="rotate(${w} ${z(x)} ${z(y)})"/>`;
    for (const [x, y] of ecken(B)) s += `<rect x="${x - B / 2}" y="${y - B / 2}" width="${B}" height="${B}" fill="#e8e8e4" stroke="#7a7a78" stroke-width="3"/><rect x="${x - B / 4}" y="${y - B / 4}" width="${B / 2}" height="${B / 2}" fill="none" stroke="#7a7a78" stroke-width="3"/>`;
    return s + kante(3, '#f0f0ea', 4) + kante(B - 3, '#5a5a58', 4);
  } },
  koord: { schrift: '"Times New Roman", Georgia, serif', gewicht: 700, ton: '#1a3a2a' } });

M.push({ id: 'jadepalast', name: 'Jadepalast', seltenheit: 'episch', weg: { art: 'stufe', familie: 'raetsel', stufe: 'silber' },
  idee: 'Seladon und Jade mit Wolkenspiralen, Rahmen aus rotem Lack mit Goldmaeander',
  konkret: 'Helle Felder zartes Seladon, dunkle Felder Jadegrün, je Feld eine leise Wolkenspirale; der Rahmen ist roter Lack mit einem goldenen Mäanderband.',
  feld: { h: ['#d8ead8', 0.66], d: ['#1a8050', 0.12] },
  textur(R) {
    const x = zw(R, 30, 70), y = zw(R, 30, 70);
    return `<path d="M${z(x)} ${z(y)}a6 6 0 1 1 6 6a12 12 0 1 1 12 -12a18 18 0 0 1 -18 18" stroke="${F('t')}" ${strich(1.8)}/><path d="M${z(x - 30)} ${z(y + 18)}h22" stroke="${F('tt')}" ${strich(1.6)}/>`;
  },
  rahmen: { breite: 66, radius: 6, linie: '#e8c060', zeichne(B) {
    let s = band(B, '#9a1a1a') + kante(B * 0.12, '#e8c060', 4) + kante(B * 0.88, '#e8c060', 4);
    const m = 'M-16 12V-12H12V6H-4V-2H4';
    for (const [x, y, w] of umlauf(B, 40)) s += `<path d="${m}" fill="none" stroke-width="4" stroke-linecap="square" stroke="#e8c060" transform="translate(${z(x)} ${z(y)}) rotate(${w})"/>`;
    for (const [x, y] of ecken(B)) s += `<circle cx="${x}" cy="${y}" r="${B / 2 - 6}" fill="#1a8050" stroke="#e8c060" stroke-width="4"/><circle cx="${x}" cy="${y}" r="${B / 6}" fill="#e8c060"/>`;
    return s;
  } },
  koord: { schrift: '"Segoe UI", system-ui, sans-serif', gewicht: 700, ton: '#0a3a20' } });

M.push({ id: 'eiskristall', name: 'Eiskristall', seltenheit: 'selten', weg: { art: 'stufe', familie: 'serie', stufe: 'silber' },
  idee: 'Eisweisse und tiefblaue Felder mit Kristallfacetten, Rahmen aus Frostkristallen',
  konkret: 'Helle Felder eisweiß, dunkle tief petrolblau, jedes Feld mit ein paar leisen Kristallflächen; der Rahmen ist eisblau mit weißen Schneekristallen.',
  feld: { h: ['#e4f2f8', 0.74], d: ['#1a6a90', 0.12] },
  textur(R) {
    let s = ''; const m = [zw(R, 30, 70), zw(R, 30, 70)];
    const r = [[0, 0], [50, 0], [100, 0], [100, 50], [100, 100], [50, 100], [0, 100], [0, 50]];
    for (let i = 0; i < 8; i++) s += `<path d="${zug([m, r[i], r[(i + 1) % 8]])}" fill="${F(['ll', 'tt', 'l', 'g'][i % 4])}"/>`;
    return s;
  },
  rahmen: { breite: 64, radius: 12, linie: '#e8f8ff', zeichne(B) {
    let s = verlauf('eis', [[0, '#5aa0c8'], [0.5, '#bfe4f4'], [1, '#4a8ab8']]) + band(B, 'url(#eis)');
    for (const [x, y] of umlauf(B, 32)) {
      s += `<g transform="translate(${z(x)} ${z(y)})">${[0, 60, 120].map((d) => `<path d="M0 -15V15M-5 -10l5 4l5 -4M-5 10l5 -4l5 4" ${strich(2.4)} stroke="#ffffff" transform="rotate(${d})"/>`).join('')}</g>`;
    }
    return s + kante(3, '#e8f8ff', 4) + kante(B - 3, '#2a6a90', 3);
  } },
  koord: { schrift: '"Segoe UI", system-ui, sans-serif', gewicht: 700, ton: '#0a3048' } });

M.push({ id: 'lavafeld', name: 'Lavafeld', seltenheit: 'legende', weg: { art: 'level', n: 75 }, bewegung: true,
  idee: 'Asche und Basalt mit feinen Rissen, der Rahmen gluehende Lava',
  konkret: 'Helle Felder aschgrau-sandig, dunkle Felder Basalt mit ganz feinen Rissen, nichts glüht auf den Feldern; der Rahmen ist schwarzes Gestein mit glühend orangen Lavaadern, ein Glanz läuft darüber.',
  feld: { h: ['#e0d0c0', 0.60], d: ['#4a3a38', 0.12] },
  textur(R) {
    let s = '';
    for (let i = 0; i < 3; i++) { let x = zw(R, 10, 90), y = zw(R, 10, 90); const p = [[x, y]]; for (let k = 0; k < 4; k++) { x += zw(R, -18, 18); y += zw(R, -18, 18); p.push([x, y]); } s += `<path d="${linie(p)}" stroke="${F(i ? 'tt' : 't')}" ${strich(1.4)}/>`; }
    return s;
  },
  rahmen: { breite: 68, radius: 10, linie: '#ff8a30', zeichne(B, R) {
    let s = band(B, '#1a1210');
    for (const [x, y, w] of umlauf(B, 36)) s += `<path d="${linie([[-30, zw(R, -8, 8)], [-10, zw(R, -14, 14)], [10, zw(R, -14, 14)], [30, zw(R, -8, 8)]])}" ${strich(zw(R, 3, 6))} stroke="${R() < 0.5 ? '#ff7020' : '#ffb040'}" transform="translate(${z(x)} ${z(y)}) rotate(${w})"/>`;
    for (const [x, y] of ecken(B)) s += `<circle cx="${x}" cy="${y}" r="${B / 3}" fill="#ff5010"/><circle cx="${x}" cy="${y}" r="${B / 6}" fill="#ffd060"/>`;
    return s + kante(3, '#ff8a30', 3) + kante(B - 3, '#3a1a10', 4);
  } },
  koord: { schrift: '"Trebuchet MS", "Segoe UI", sans-serif', gewicht: 700, ton: '#2a1008' } });

M.push({ id: 'urwald', name: 'Urwald', seltenheit: 'selten', weg: { art: 'level', n: 52 },
  idee: 'Blassgruene und waldgruene Felder mit Blattadern, Rahmen aus Ranken und Blaettern',
  konkret: 'Helle Felder blassgrün, dunkle waldgrün, in jedem Feld die leisen Adern eines Blattes; der Rahmen ist eine dunkle Ranke mit frischgrünen Blättern.',
  feld: { h: ['#dfe8c0', 0.62], d: ['#2a6a2a', 0.12] },
  textur(R) {
    const a = zw(R, -40, 40);
    let s = `<path d="M15 85L85 15" stroke="${F('t')}" ${strich(2)}/>`;
    for (let i = 1; i < 6; i++) { const t = i / 6, x = 15 + 70 * t, y = 85 - 70 * t; s += `<path d="M${z(x)} ${z(y)}l-12 -6M${z(x)} ${z(y)}l6 12" stroke="${F('tt')}" ${strich(1.3)}/>`; }
    return `<g transform="rotate(${z(a)} 50 50)">${s}</g>`;
  },
  rahmen: { breite: 66, radius: 14, linie: '#a8d070', zeichne(B, R) {
    let s = band(B, '#2a2014');
    s += `<path d="${linie(umlauf(B, 120, 0).map(([x, y], i) => [x + Math.sin(i * 0.9) * 9 * (i % 30 < 15 ? 1 : 1), y + Math.cos(i * 0.9) * 9]))}" ${strich(4)} stroke="#6a4a20"/>`;
    for (const [x, y, w] of umlauf(B, 44)) { const d = w + (R() < 0.5 ? 40 : -40); s += `<path d="M0 0c6 -10 18 -12 26 -6c-6 10 -18 12 -26 6z" fill="${R() < 0.5 ? '#5ab040' : '#3a9030'}" transform="translate(${z(x)} ${z(y)}) rotate(${d})"/>`; }
    return s + kante(3, '#a8d070', 3) + kante(B - 3, '#1a1408', 4);
  } },
  koord: { schrift: '"Segoe UI", system-ui, sans-serif', gewicht: 700, ton: '#14300a' } });

M.push({ id: 'zahnwerk', name: 'Zahnwerk', seltenheit: 'episch', weg: { art: 'level', n: 85 },
  idee: 'Messing und Stahl, gebuerstet, der Rahmen aus Kupfer mit Zahnraedern',
  konkret: 'Helle Felder aus gebürstetem Messing, dunkle aus blauem Stahl, mit feinen Schleifspuren; der Rahmen ist Kupfer mit Nieten und je einem Zahnrad in den Ecken.',
  feld: { h: ['#e8d8a8', 0.60], d: ['#2a4a70', 0.12] },
  textur(R) {
    let s = ''; const quer = R() < 0.5;
    for (let i = 0; i < 16; i++) { const y = i * 6.4 + zw(R, 0, 3); s += `<path d="M${z(zw(R, -5, 20))} ${z(y)}H${z(zw(R, 70, 105))}" stroke="${F(['ll', 'tt', 'l', 't'][i % 4])}" stroke-width="1.2"${quer ? ' transform="rotate(90 50 50)"' : ''}/>`; }
    return s;
  },
  rahmen: { breite: 68, radius: 8, linie: '#f0b080', zeichne(B) {
    let s = verlauf('kupfer', [[0, '#6a3418'], [0.4, '#d08050'], [0.6, '#8a4a24'], [1, '#c07040']]) + band(B, 'url(#kupfer)');
    for (const [x, y] of umlauf(B, 48)) s += `<circle cx="${z(x)}" cy="${z(y)}" r="6" fill="#f0c090" stroke="#4a2410" stroke-width="2"/>`;
    for (const [x, y] of ecken(B)) s += `<path d="${zug(zahnrad(x, y, B / 2 - 3, 12, 7))}" fill="#e0b030" stroke="#4a2410" stroke-width="2"/><circle cx="${x}" cy="${y}" r="${B / 7}" fill="#4a2410"/>`;
    return s + kante(3, '#f0b080', 3) + kante(B - 3, '#3a1a08', 4);
  } },
  koord: { schrift: '"Courier New", Consolas, monospace', gewicht: 700, ton: '#2a1a08' } });

M.push({ id: 'papyrus', name: 'Papyrus', seltenheit: 'episch', weg: { art: 'endgegner', welt: 3 },
  idee: 'Papyrusfasern und Lapislazuli mit Goldflittern, Rahmen mit Lotosband',
  konkret: 'Helle Felder Papyrus mit feinen Kreuzfasern, dunkle Felder Lapislazuli mit kleinen goldenen Flittern; der Rahmen ist ein Band aus Lotosblüten in Türkis und Gold.',
  feld: { h: ['#ecdcb0', 0.62], d: ['#1a3a9a', 0.12], akzent: { h: '#c8b080', d: '#e0b040' } },
  textur(R, art) {
    let s = '';
    if (art === 'h') { for (let i = 4; i < 100; i += 8) s += `<path d="M0 ${z(i + zw(R, -1, 1))}H100" stroke="${F(i % 16 ? 'tt' : 't')}" stroke-width="1.6"/>`; for (let i = 6; i < 100; i += 14) s += `<path d="M${z(i)} 0V100" stroke="${F('ll')}" stroke-width="1"/>`; }
    else for (let i = 0; i < 7; i++) s += `<circle cx="${z(zw(R, 5, 95))}" cy="${z(zw(R, 5, 95))}" r="${z(zw(R, 1, 2.4))}" fill="${F('a')}"/>`;
    return s;
  },
  rahmen: { breite: 68, radius: 4, linie: '#e0b040', zeichne(B) {
    let s = band(B, '#1a3a9a') + kante(B * 0.12, '#e0b040', 6) + kante(B * 0.88, '#e0b040', 6);
    for (const [x, y, w] of umlauf(B, 30)) s += `<g transform="translate(${z(x)} ${z(y)}) rotate(${w})"><path d="M0 14C-14 4 -14 -10 -8 -16C-4 -6 0 -4 0 14Z" fill="#30b0a0"/><path d="M0 14C14 4 14 -10 8 -16C4 -6 0 -4 0 14Z" fill="#30b0a0"/><path d="M0 14C-5 0 -4 -12 0 -20C4 -12 5 0 0 14Z" fill="#e0b040"/></g>`;
    for (const [x, y] of ecken(B)) s += `<rect x="${x - B / 2}" y="${y - B / 2}" width="${B}" height="${B}" fill="#e0b040"/><circle cx="${x}" cy="${y}" r="${B / 4}" fill="#c03020"/>`;
    return s;
  } },
  koord: { schrift: '"Palatino Linotype", Palatino, serif', gewicht: 700, ton: '#2a2008' } });

M.push({ id: 'kirschgarten', name: 'Kirschgarten', seltenheit: 'episch', weg: { art: 'level', n: 70 },
  idee: 'Washi-Papier in Blassrosa und Pflaume, Rahmen als bluehender Kirschzweig',
  konkret: 'Helle Felder blassrosa, dunkle pflaumenfarben, beide mit feinen Fasern wie japanisches Papier; der Rahmen ist ein dunkler Zweig mit rosa Kirschblüten.',
  feld: { h: ['#f8e4e8', 0.70], d: ['#7a2a50', 0.12] },
  textur(R) {
    let s = '';
    for (let i = 0; i < 10; i++) { const x = zw(R, 0, 90), y = zw(R, 0, 95); s += `<path d="M${z(x)} ${z(y)}q${z(zw(R, 4, 10))} ${z(zw(R, -8, 8))} ${z(zw(R, 10, 22))} ${z(zw(R, -4, 4))}" stroke="${F(i % 2 ? 'tt' : 'll')}" ${strich(1)}/>`; }
    return s;
  },
  rahmen: { breite: 66, radius: 14, linie: '#f8c0d0', zeichne(B, R) {
    let s = band(B, '#2a1a20');
    s += `<path d="${linie(umlauf(B, 80, 0).map(([x, y], i) => [x + Math.sin(i * 1.7) * 10, y + Math.cos(i * 1.3) * 10]))}" ${strich(5)} stroke="#5a3a2a"/>`;
    for (const [x, y] of umlauf(B, 30)) { const cx = x + zw(R, -10, 10), cy = y + zw(R, -10, 10); s += `<g transform="translate(${z(cx)} ${z(cy)}) rotate(${Math.round(zw(R, 0, 72))})">${[0, 72, 144, 216, 288].map((d) => `<ellipse cy="-8" rx="5" ry="8" fill="${R() < 0.5 ? '#f8b0c8' : '#fcd0dc'}" transform="rotate(${d})"/>`).join('')}<circle r="3" fill="#e06080"/></g>`; }
    return s + kante(3, '#f8c0d0', 3) + kante(B - 3, '#1a0a10', 4);
  } },
  koord: { schrift: '"Yu Gothic", "Segoe UI", sans-serif', gewicht: 700, ton: '#3a0a20' } });

M.push({ id: 'art-deco', name: 'Art déco', seltenheit: 'legende', weg: { art: 'stufe', familie: 'siege', stufe: 'gold' }, bewegung: true,
  idee: 'Creme und Schwarzpetrol mit Nadelstreifen, Rahmen mit goldenen Faechern',
  konkret: 'Helle Felder creme, dunkle schwarz-petrol, beide mit feinen schrägen Nadelstreifen; der Rahmen ist schwarz mit goldenen Fächern und Stufenlinien wie in den 1920ern, ein Glanz läuft darüber.',
  feld: { h: ['#f0e6d0', 0.68], d: ['#1a4a4a', 0.12] },
  textur() {
    let s = '';
    for (let i = -100; i < 100; i += 12) s += `<path d="M${i} 100L${i + 100} 0" stroke="${F('t')}" stroke-width="1.2"/>`;
    return s;
  },
  rahmen: { breite: 70, radius: 4, linie: '#e8c870', zeichne(B) {
    let s = band(B, '#101414') + kante(B * 0.1, '#e8c870', 3) + kante(B * 0.2, '#e8c870', 2) + kante(B * 0.9, '#e8c870', 3);
    for (const [x, y, w] of umlauf(B, 26)) s += `<g transform="translate(${z(x)} ${z(y + 0)}) rotate(${w})">${[-60, -30, 0, 30, 60].map((d) => `<path d="M0 16L${z(Math.sin(d / 57.3) * 22)} ${z(16 - Math.cos(d / 57.3) * 26)}" stroke="#e8c870" stroke-width="3"/>`).join('')}<circle cy="16" r="5" fill="#e8c870"/></g>`;
    for (const [x, y] of ecken(B)) s += `<path d="${zug([[x, y - B / 2 + 6], [x + B / 2 - 6, y], [x, y + B / 2 - 6], [x - B / 2 + 6, y]])}" fill="#e8c870"/><path d="${zug([[x, y - B / 4], [x + B / 4, y], [x, y + B / 4], [x - B / 4, y]])}" fill="#101414"/>`;
    return s;
  } },
  koord: { schrift: '"Century Gothic", "Futura", "Segoe UI", sans-serif', gewicht: 700, ton: '#0a2020' } });

M.push({ id: 'unterwasser', name: 'Unterwasser', seltenheit: 'episch', weg: { art: 'endgegner', welt: 5 }, bewegung: true,
  idee: 'Meerschaum und Tiefsee mit leisem Lichtnetz, Rahmen aus Korallen und Blasen',
  konkret: 'Helle Felder meerschaumgrün, dunkle Felder tiefseeblau, beide mit dem ganz leisen Lichtnetz, das die Sonne unter Wasser malt; der Rahmen zeigt Korallen in Orange und Pink und aufsteigende Blasen, ein Glanz läuft darüber.',
  feld: { h: ['#d0ece6', 0.66], d: ['#0a4a7a', 0.12] },
  textur(R) {
    let s = '';
    for (let i = 0; i < 6; i++) { const x = zw(R, 0, 100), y = zw(R, 0, 100); s += `<path d="M${z(x)} ${z(y)}c${z(zw(R, 8, 20))} ${z(zw(R, -10, 10))} ${z(zw(R, 20, 30))} ${z(zw(R, 10, 20))} ${z(zw(R, 30, 40))} ${z(zw(R, -5, 5))}" stroke="${F(i % 2 ? 'l' : 'll')}" ${strich(1.8)}/>`; }
    return s;
  },
  rahmen: { breite: 66, radius: 16, linie: '#70e0e0', zeichne(B, R) {
    let s = verlauf('meer', [[0, '#04203a'], [0.5, '#0a4a6a'], [1, '#04203a']]) + band(B, 'url(#meer)');
    for (const [x, y, w] of umlauf(B, 22)) s += `<path d="M0 ${B / 2 - 6}V0M0 6l-12 -14M0 -2l10 -16M-12 -8l-4 -10M10 -18l6 -6" ${strich(5)} stroke="${R() < 0.5 ? '#ff7a50' : '#ff60a0'}" transform="translate(${z(x)} ${z(y)}) rotate(${w}) translate(0 ${-B / 2 + 32})"/>`;
    for (const [x, y] of umlauf(B, 40, 0.1)) s += `<circle cx="${z(x + zw(R, -14, 14))}" cy="${z(y + zw(R, -14, 14))}" r="${z(zw(R, 3, 7))}" fill="none" stroke="#c8f4ff" stroke-width="2"/>`;
    return s + kante(3, '#70e0e0', 3) + kante(B - 3, '#022030', 4);
  } },
  koord: { schrift: '"Trebuchet MS", "Segoe UI", sans-serif', gewicht: 700, ton: '#06283a' } });

M.push({ id: 'galaxie', name: 'Galaxie', seltenheit: 'legende', weg: { art: 'stufe', familie: 'endgegner', stufe: 'gold' }, bewegung: true,
  idee: 'Lavendel und Tiefviolett mit leisen Nebelschleiern, Rahmen als bunter Nebel mit Sternen',
  konkret: 'Helle Felder lavendel, dunkle tiefviolett, in jedem Feld ein ganz leiser Nebelschleier und ein paar Staubpunkte; der Rahmen ist ein bunter Nebel in Pink, Blau und Türkis mit Sternen, ein Glanz läuft darüber.',
  feld: { h: ['#e6dcf4', 0.64], d: ['#4a1a8a', 0.12] },
  textur(R) {
    let s = `<ellipse cx="${z(zw(R, 30, 70))}" cy="${z(zw(R, 30, 70))}" rx="${z(zw(R, 25, 40))}" ry="${z(zw(R, 12, 20))}" fill="${F('ll')}" transform="rotate(${Math.round(zw(R, 0, 180))} 50 50)"/>`;
    for (let i = 0; i < 6; i++) s += `<circle cx="${z(zw(R, 5, 95))}" cy="${z(zw(R, 5, 95))}" r="1.4" fill="${F('l')}"/>`;
    return s;
  },
  rahmen: { breite: 66, radius: 18, linie: '#d8a0ff', zeichne(B, R) {
    let s = band(B, '#140a30');
    for (const [x, y, w] of umlauf(B, 30, 0.3)) s += `<ellipse cx="${z(x)}" cy="${z(y)}" rx="${z(zw(R, 30, 50))}" ry="${z(B * 0.3)}" fill="${['#ff30d0', '#4060ff', '#20c0e0'][Math.floor(R() * 3)]}" opacity=".55" transform="rotate(${w} ${z(x)} ${z(y)})"/>`;
    for (const [x, y] of umlauf(B, 70, 0.7)) s += `<circle cx="${z(x + zw(R, -B / 3, B / 3))}" cy="${z(y + zw(R, -B / 3, B / 3))}" r="${z(zw(R, 1.2, 3))}" fill="#fff6d0"/>`;
    for (const [x, y] of ecken(B)) s += `<path d="${zug(stern(x, y, B / 3, 4, 4))}" fill="#ffe080"/>`;
    return s + kante(3, '#d8a0ff', 3) + kante(B - 3, '#0a0420', 4);
  } },
  koord: { schrift: '"Trebuchet MS", "Segoe UI", sans-serif', gewicht: 700, ton: '#1a0a3a' } });

M.push({ id: 'mosaik', name: 'Römisches Mosaik', seltenheit: 'selten', weg: { art: 'level', n: 58 },
  idee: 'Travertin und Terrakotta aus kleinen Steinchen, Rahmen mit Wellenband',
  konkret: 'Helle Felder Travertin, dunkle Terrakotta, beide aus leise sichtbaren kleinen Mosaiksteinen; der Rahmen ist das schwarz-weiße Wellenband römischer Böden.',
  feld: { h: ['#ece0c8', 0.64], d: ['#9a3a20', 0.12] },
  textur(R) {
    let s = '';
    for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) s += `<rect x="${z(i * 20 + 1.5 + zw(R, -1, 1))}" y="${z(j * 20 + 1.5 + zw(R, -1, 1))}" width="${z(17 + zw(R, -1, 1))}" height="${z(17 + zw(R, -1, 1))}" rx="2" fill="${F(['ll', 'tt', 'g', 'l', 't'][Math.floor(R() * 5)])}"/>`;
    return s;
  },
  rahmen: { breite: 68, radius: 4, linie: '#f0e8d8', zeichne(B) {
    let s = band(B, '#f0e8d8') + kante(B * 0.1, '#1a1a1a', 6) + kante(B * 0.9, '#1a1a1a', 6);
    for (const [x, y, w] of umlauf(B, 36)) s += `<path d="M-14 14C-14 -2 -2 -14 10 -10C18 -6 16 6 6 6C0 6 0 0 4 -2" ${strich(6)} stroke="#1a1a1a" transform="translate(${z(x)} ${z(y)}) rotate(${w})"/>`;
    for (const [x, y] of ecken(B)) s += `<rect x="${x - B / 2}" y="${y - B / 2}" width="${B}" height="${B}" fill="#9a3a20"/><rect x="${x - B / 4}" y="${y - B / 4}" width="${B / 2}" height="${B / 2}" fill="#f0e8d8" transform="rotate(45 ${x} ${y})"/>`;
    return s;
  } },
  koord: { schrift: '"Times New Roman", Georgia, serif', gewicht: 700, ton: '#3a1408' } });

M.push({ id: 'buchleder', name: 'Bucheinband', seltenheit: 'selten', weg: { art: 'level', n: 62 },
  idee: 'Pergament und braunes Leder mit Narbung, Rahmen mit Goldpraegung',
  konkret: 'Helle Felder Pergament mit feinen Fasern, dunkle Felder braunes Leder mit leiser Narbung; der Rahmen ist dunkles Leder mit goldener Prägung, Doppellinien und Eckbeschlägen wie ein alter Bucheinband.',
  feld: { h: ['#efe2c4', 0.66], d: ['#6a3014', 0.12] },
  textur(R, art) {
    let s = '';
    if (art === 'd') for (let i = 0; i < 26; i++) s += `<circle cx="${z(zw(R, 2, 98))}" cy="${z(zw(R, 2, 98))}" r="${z(zw(R, 1.4, 3.6))}" fill="${F(i % 2 ? 'tt' : 'll')}"/>`;
    else for (let i = 0; i < 12; i++) { const y = zw(R, 0, 100); s += `<path d="M${z(zw(R, -10, 60))} ${z(y)}l${z(zw(R, 20, 50))} ${z(zw(R, -3, 3))}" stroke="${F('tt')}" ${strich(1)}/>`; }
    return s;
  },
  rahmen: { breite: 68, radius: 8, linie: '#d8b050', zeichne(B) {
    let s = band(B, '#3a1a0a') + kante(B * 0.2, '#d8b050', 3) + kante(B * 0.32, '#d8b050', 1.6) + kante(B * 0.8, '#d8b050', 3);
    for (const [x, y, w] of umlauf(B, 40)) s += `<path d="${zug(stern(0, 0, 7, 3, 4))}" fill="#d8b050" transform="translate(${z(x)} ${z(y)}) rotate(${w})"/>`;
    for (const [x, y] of ecken(B)) s += `<path d="${zug([[x - B / 2, y - B / 2], [x + B / 2, y - B / 2], [x - B / 2, y + B / 2]])}" fill="#d8b050" transform="rotate(${x < 500 ? (y < 500 ? 0 : 270) : (y < 500 ? 90 : 180)} ${x} ${y})"/><circle cx="${x}" cy="${y}" r="5" fill="#3a1a0a"/>`;
    return s;
  } },
  koord: { schrift: 'Georgia, "Times New Roman", serif', gewicht: 700, ton: '#2a1406' } });

export const MOTIVE = Object.freeze(M.map((m) => Object.freeze(m)));

// ---------- Farben, Bilder, CSS
const genau = (ton, L) => inBand(ton, [L, L], 0.5);
const verschoben = (ton, L, f) => genau(ton, (L + 0.05) * f - 0.05);
const rollen = (m, art) => {
  const [ton, L] = m.feld[art], akz = (m.feld.akzent || {})[art] || ton;
  return { g: genau(ton, L), l: verschoben(ton, L, 1 + TON), ll: verschoben(ton, L, 1 + TON / 2), t: verschoben(ton, L, 1 - TON), tt: verschoben(ton, L, 1 - TON / 2),
    // Akzent nur halb verschoben: zwischen zwei Farbtoenen gleicher Helligkeit mischt die Kante dunkler (am Brett gemessen)
    a: verschoben(akz, L, 1 + TON / 2), b: verschoben(akz, L, 1 - TON / 2) };
};
export const feldFarben = (m) => ({ h: genau(...m.feld.h), d: genau(...m.feld.d) });
// Koordinaten: sehr dunkel im Ton des Motivs auf hellen Feldern, sehr hell auf dunklen
export const koordFarben = (m) => ({ h: genau(m.koord.ton, 0.03), d: genau(m.koord.ton, 0.82) });

const texturen = new Map();
export function texturBild(m) {
  if (texturen.has(m.id)) return texturen.get(m.id);
  const bild = (art) => {
    const R = zufall(`v4:${m.id}:${art}`), f = rollen(m, art);
    let s = '';
    for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) s += `<svg x="${i * 100}" y="${j * 100}" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="§g§"/>${m.textur(R, art, i, j)}</svg>`;
    return s.replace(/§([a-z]+)§/g, (_, r) => { if (!f[r]) throw new Error(`Motiv ${m.id}: Rolle ${r} unbekannt`); return f[r]; });
  };
  const b = Object.freeze({ h: bild('h'), d: bild('d') });
  texturen.set(m.id, b);
  return b;
}
const rahmenBilder = new Map();
export function rahmenBild(m) {
  if (!rahmenBilder.has(m.id)) rahmenBilder.set(m.id, m.rahmen.zeichne(m.rahmen.breite, zufall('v4-rahmen:' + m.id)));
  return rahmenBilder.get(m.id);
}
const rahmenUrl = (innen) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1000 1000' preserveAspectRatio='none'>${innen}</svg>`).replace(/'/g, '%27')}")`;

export function motivCss(m) {
  const b = texturBild(m), feld = feldFarben(m), k = koordFarben(m), r = m.rahmen;
  const sel = `.motiv-brett[data-motiv="${m.id}"]`, grund = `${rahmenUrl(rahmenBild(m))} 0 0 / 100% 100% no-repeat`;
  // padding in % bezieht sich auf die Breite: das Band ist damit immer rahmen.breite / 1000 der Brettbreite
  let css = `${sel} { padding: ${r.breite / 10}%; border-radius: ${r.radius}px; background: ${grund}; box-shadow: 0 10px 28px rgba(0, 0, 0, .45); `
    + `--feld-hell: ${feld.h}; --feld-dunkel: ${feld.d}; --feld-muster-hell: ${svgUrl(b.h)}; --feld-muster-dunkel: ${svgUrl(b.d)}; --feld-muster-groesse: ${GROESSE}; }\n`
    // kleine Brett-Ecke: mit dem App-Rund (12 px) blieb zwischen Feld und Rahmen ein heller Zwickel
    + `${sel} .brett { --brett-radius: 3px; border-radius: 3px; box-shadow: 0 0 0 2px ${r.linie}; }\n`
    + `${sel} .brett .koord { font-family: ${m.koord.schrift}; font-weight: ${m.koord.gewicht}; }\n`
    + `${sel} .brett .feld.h .koord { color: ${k.h}; text-shadow: none; }\n`
    + `${sel} .brett .feld.d .koord { color: ${k.d}; text-shadow: none; }\n`;
  // leiser Glanz NUR auf dem Rahmen (.motiv-brett, die Felder liegen darueber) und nur ohne "weniger Bewegung"
  if (m.bewegung) {
    css += `@media (prefers-reduced-motion: no-preference) {\n`
      + `  ${sel} { background: linear-gradient(115deg, transparent 35%, rgba(255, 255, 255, .28) 50%, transparent 65%) 0 0 / 300% 100% no-repeat, ${grund}; `
      + `animation: motiv-glanz-${m.id} 9s ease-in-out infinite alternate; }\n`
      + `  @keyframes motiv-glanz-${m.id} { from { background-position: 100% 0, 0 0; } to { background-position: 0 0, 0 0; } }\n}\n`;
  }
  return css;
}
