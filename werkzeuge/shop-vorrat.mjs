// Shop-Vorrat (Konzept 06.11.2026, Abschnitt 4 und 10b: "Shop-Inhalte zeichnet Claude als SVG, zum Start mindestens
// 4 Wochen Vorrat, rund 24 Stuecke. Flo gibt jedes Set frei."). Eigene Formen (GPL-3.0 wie das Projekt), keine Preise:
// die stehen nur im Vault. Noch NICHT eingebaut: nichts in js/, css/ oder sw.js verweist auf diese Dateien.
//   node werkzeuge/shop-vorrat.mjs   schreibt assets/shop/** , assets/shop/vorrat.json und docs/shop-vorrat.html
// Figuren-Sets: 12 Figuren je Set wie assets/pieces/<set>/ (wK.svg ... bP.svg), zwei Grundformen (rund gedrechselt,
// kantig geschliffen) mit eigenem Schmuck je Set. Bretter: Vorschau-SVG plus hell/dunkel/rand im Format von
// LABOR_BRETTER (js/labor.js), damit daraus spaeter ein html[data-brett]-Eintrag in css/tokens.css werden kann.
// Effekte: SMIL-Animation im SVG; fuer die Vorschau in Endlosschleife, die App spielt sie spaeter einmal ab.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..');
const n = (v) => +v.toFixed(2);
const pt = ([x, y]) => `${n(x)} ${n(y)}`;
function schreibe(rel, inhalt) {
  const ziel = join(WURZEL, rel);
  mkdirSync(dirname(ziel), { recursive: true });
  writeFileSync(ziel, inhalt);
  return Buffer.byteLength(inhalt);
}

// ---------- Figuren: Grundformen (viewBox 0 0 100 100, Mitte x=50) ----------
// Drehkoerper je Figur: [halbe Breite, y] von unten nach oben, Sockel und Kopf kommen extra
const PROFIL = {
  P: [[18, 84], [13, 77], [9, 66], [8, 61], [13, 60], [13, 57], [7, 56]],
  R: [[22, 84], [17, 77], [15, 68], [15, 42], [19, 38], [19, 34]],
  B: [[20, 84], [14, 77], [10, 68], [8, 62], [13, 61], [13, 58], [8, 57]],
  Q: [[22, 84], [16, 77], [12, 66], [11, 56], [16, 52], [16, 49], [12, 48]],
  K: [[23, 84], [17, 77], [13, 66], [12, 56], [17, 52], [17, 49], [13, 48]],
};
// Catmull-Rom als kubische Kurven, ab dem ersten Punkt
function weich(p) {
  let s = '';
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i - 1] || p[i], b = p[i], c = p[i + 1], d = p[i + 2] || c;
    s += `C${pt([b[0] + (c[0] - a[0]) / 6, b[1] + (c[1] - a[1]) / 6])} ${pt([c[0] - (d[0] - b[0]) / 6, c[1] - (d[1] - b[1]) / 6])} ${pt(c)}`;
  }
  return s;
}
function drehkoerper(profil, rund) {
  const li = profil.map(([w, y]) => [50 - w, y]);
  const re = profil.slice().reverse().map(([w, y]) => [50 + w, y]);
  if (!rund) return `<path d="M${li.map(pt).join('L')}L${re.map(pt).join('L')}Z"/>`;
  return `<path d="M${pt(li[0])}${weich(li)}L${pt(re[0])}${weich(re)}Z"/>`;
}
const raute = (x, y, w, h) => `M${n(x)} ${n(y - h)}L${n(x + w)} ${n(y)}L${n(x)} ${n(y + h)}L${n(x - w)} ${n(y)}Z`;
function vieleck(x, y, r, ecken, start) {
  const p = [];
  for (let i = 0; i < ecken; i++) { const w = start + (i * 2 * Math.PI) / ecken; p.push([x + r * Math.cos(w), y + r * Math.sin(w)]); }
  return `M${p.map(pt).join('L')}Z`;
}
const ZINNEN = '<path d="M31 35V20h8v6h7v-6h8v6h7v-6h8v15z"/>';
const KREUZ = '<path d="M46.5 30V10h7v5H59v6h-5.5v9z"/><path d="M41 15h5.5v6H41z"/>';
const KRONE = 'M34 48L29 25l10 12 5-16 6 12 6-12 5 16 10-12-5 23z';
const SPITZEN = [[29, 25], [44, 21], [56, 21], [71, 25]];

// Teile je Figur und Grundform: koerper (gefuellt, mit Umriss), linien (nur Strich), punkte (Augen, Nuestern)
function teile(fig, rund) {
  const sockel = rund ? '<rect x="22" y="82" width="56" height="10" rx="4"/>' : '<path d="M24 82h52l3 4v6H21v-6z"/>';
  const k = { koerper: [sockel], linien: '', punkte: '' };
  if (fig !== 'N') k.koerper.push(drehkoerper(PROFIL[fig], rund));
  if (fig === 'P') k.koerper.push(rund ? '<circle cx="50" cy="44" r="12.5"/>' : `<path d="${vieleck(50, 44, 13, 6, Math.PI / 6)}"/>`);
  if (fig === 'R') k.koerper.push(ZINNEN);
  if (fig === 'B') {
    if (rund) {
      k.koerper.push('<path d="M50 19c12 11 14 25 8 36q-8 4-16 0c-6-11-4-25 8-36z"/>', '<circle cx="50" cy="15" r="4"/>');
      k.linien = '<path d="M55 31l-9 11"/>';
    } else {
      k.koerper.push(`<path d="M50 19L61 38 57 55H43L39 38z"/>`, `<path d="${raute(50, 14, 4, 5)}"/>`);
      k.linien = '<path d="M41 38h18M50 21v32"/>';
    }
  }
  if (fig === 'Q') {
    k.koerper.push(`<path d="${KRONE}"/>`);
    k.koerper.push(...SPITZEN.map(([x, y]) => (rund ? `<circle cx="${x}" cy="${y}" r="3.2"/>` : `<path d="${raute(x, y - 1, 3, 4)}"/>`)));
  }
  if (fig === 'K') {
    k.koerper.push(rund ? '<path d="M33 48c0-14 7-20 17-20s17 6 17 20z"/>' : '<path d="M34 48l4-16h24l4 16z"/>', KREUZ);
  }
  if (fig === 'N') {
    if (rund) {
      k.koerper.push('<path d="M32 84c0-12 4-20 10-26-8 0-16-2-20-6-3-3-2-8 2-11l14-11c3-6 7-11 12-14l2-7 5 6c13 4 21 15 21 31 0 14-6 26-8 38z"/>');
      k.linien = '<path d="M57 17c10 6 16 17 16 31"/>';
      k.punkte = '<circle cx="41" cy="33" r="2.6"/><circle cx="25.5" cy="47" r="1.4"/>';
    } else {
      k.koerper.push('<path d="M32 84l6-22 4-4-18-4-4-7 17-17 11-13 4-8 6 6 12 7 7 16-1 22-6 24z"/>');
      k.linien = '<path d="M58 16l12 8 4 16"/>';
      k.punkte = `<path d="${raute(41, 33, 2.4, 3)}"/><circle cx="25" cy="47.5" r="1.3"/>`;
    }
  }
  return k;
}
// Stelle mit genug Flaeche fuer den Schmuck je Figur: [x, y, halbe Breite]
const MITTE = { P: [50, 72, 9], R: [50, 56, 12], B: [50, 42, 7], Q: [50, 66, 10], K: [50, 66, 10], N: [61, 58, 8] };

// ---------- Schmuck je Set ----------
const funkel = (x, y, r) => `M${n(x)} ${n(y - r)}Q${n(x)} ${n(y)} ${n(x + r)} ${n(y)}Q${n(x)} ${n(y)} ${n(x)} ${n(y + r)}Q${n(x)} ${n(y)} ${n(x - r)} ${n(y)}Q${n(x)} ${n(y)} ${n(x)} ${n(y - r)}z`;
function zahnrad(x, y, r) {
  const p = [];
  for (let i = 0; i < 32; i++) { const w = (i * Math.PI) / 16; const rr = Math.floor(i / 2) % 2 ? r * 0.76 : r; p.push([x + rr * Math.cos(w), y + rr * Math.sin(w)]); }
  return `M${p.map(pt).join('L')}Z`;
}
const SCHMUCK = {
  lampion: (m, [x, y, w]) => `<ellipse cx="${x}" cy="${y}" rx="${n(w * 0.6)}" ry="3.4" fill="${m.akz}" opacity=".8"/>`
    + `<path d="M${x - w} ${y - 5}Q${x} ${y - 2} ${x + w} ${y - 5}M${x - w} ${y + 5}Q${x} ${y + 8} ${x + w} ${y + 5}" fill="none" stroke="${m.deko}" stroke-width="1.5" stroke-linecap="round"/>`,
  sternwarte: (m, [x, y, w]) => `<path fill="${m.deko}" d="${funkel(x - w * 0.45, y - 3, 3.4)}${funkel(x + w * 0.5, y + 3.5, 2.5)}"/><circle cx="${n(x + w * 0.2)}" cy="${y - 5}" r=".9" fill="${m.deko}"/>`,
  uhrwerk: (m, [x, y, w]) => { const r = Math.min(w * 0.7, 6); return `<path d="${zahnrad(x, y, r)}" fill="${m.deko}" stroke="${m.l}" stroke-width=".8"/><circle cx="${x}" cy="${y}" r="${n(r * 0.34)}" fill="${m.d}"/>`; },
  kristall: (m, [x, y, w]) => `<path d="${raute(x, y, w * 0.6, 8)}M${x} ${y - 8}V${y + 8}" fill="none" stroke="${m.deko}" stroke-width="1.3" stroke-linejoin="round"/><path d="${funkel(x + w * 0.75, y - 7, 2.6)}" fill="${m.deko}"/>`,
  origami: (m, [x, y, w]) => `<path d="M${x - w} ${y - 6}L${x + w} ${y + 6}" stroke="${m.deko}" stroke-width="1.4"/><path d="M${n(x + w * 0.15)} ${y + 2}L${n(x + w * 0.8)} ${y + 7}H${n(x + w * 0.15)}z" fill="${m.akz}"/>`,
  kronjuwel: (m, [x, y]) => `<path d="${raute(x, y, 4.2, 5.6)}" fill="${m.akz}" stroke="${m.l}" stroke-width="1.2" stroke-linejoin="round"/><path d="M${x - 1.6} ${y - 2}l1.6-2" stroke="#fff" stroke-width="1" opacity=".75" stroke-linecap="round"/>`,
};

// Farben: rund mit Verlauf (h hell, m mitte, d dunkel), kantig flach (f) mit Schliff-Schatten; l Umriss
const SETS = [
  { id: 'lampion', name: 'Lampion', seltenheit: 'Episch', rund: true, text: 'Gedrechselte Laternen mit warmem Glimmen in der Mitte.',
    w: { h: '#FFF3D6', m: '#FFC86B', d: '#E0782E', l: '#5C2408', deko: '#B5461B', akz: '#FFE9A8' },
    // dunkle Seite dunkler (G-002, Ausreisser 07.11.: lila Figuren mit zu wenig Kontrast)
    b: { h: '#382B70', m: '#1E1648', d: '#0B0722', l: '#A894FF', deko: '#FF9E5E', akz: '#FFB36B' } },
  { id: 'sternwarte', name: 'Sternwarte', seltenheit: 'Episch', rund: true, text: 'Mondsilber gegen Nachthimmel, mit goldenen Funkelsternen.',
    w: { h: '#FFFFFF', m: '#E3E8F4', d: '#A9B4CF', l: '#27304F', deko: '#C79A2E' },
    b: { h: '#33437A', m: '#1C2650', d: '#0A1030', l: '#9FB2E8', deko: '#F2C84B' } },
  { id: 'uhrwerk', name: 'Uhrwerk', seltenheit: 'Episch', rund: true, text: 'Kupfer und Bronze mit einem Zahnrad in jeder Figur.',
    w: { h: '#FFE2B8', m: '#E3A462', d: '#A9612A', l: '#4A2408', deko: '#7A3F14' },
    b: { h: '#6A5A4A', m: '#3E332A', d: '#1E1813', l: '#C9A27A', deko: '#D9A65C' } },
  { id: 'kristall', name: 'Kristall', seltenheit: 'Episch', rund: false, text: 'Geschliffene Figuren aus Eis und Amethyst.',
    w: { f: '#DDF6FF', l: '#1F4F6E', deko: '#5FAFD6' },
    // dunkle Seite dunkler (G-002, Ausreisser 07.11.)
    b: { f: '#2C1650', l: '#C8A8FF', deko: '#B98AFF' } },
  { id: 'origami', name: 'Origami', seltenheit: 'Episch', rund: false, text: 'Gefaltetes Papier, hell und kohlegrau, mit rotem Siegel.',
    w: { f: '#FBF6EC', l: '#3A3328', deko: '#B9AA8E', akz: '#E2553B' },
    b: { f: '#34363D', l: '#B9BCC7', deko: '#6A6D76', akz: '#E2553B' } },
  { id: 'kronjuwel', name: 'Kronjuwel', seltenheit: 'Exklusiv', rund: false, text: 'Sonder-Set: Gold mit Rubin, Onyx mit Smaragd. Im Shop mit Goldrahmen.',
    w: { f: '#F4D27A', l: '#7A5410', deko: '#FFF1C2', akz: '#C8243E' },
    b: { f: '#1E1A22', l: '#D9A93B', deko: '#3A3340', akz: '#2FB37A' } },
];
const FIGUREN = ['K', 'Q', 'R', 'B', 'N', 'P'];

function figurSvg(set, farbe, fig) {
  const m = set[farbe], t = teile(fig, set.rund), koerper = t.koerper.join('');
  let defs, fuellung, schliff = '';
  if (set.rund) {
    defs = `<linearGradient id="g" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="${m.d}"/><stop offset=".3" stop-color="${m.h}"/><stop offset=".65" stop-color="${m.m}"/><stop offset="1" stop-color="${m.d}"/></linearGradient>`;
    fuellung = 'url(#g)';
  } else {
    // Schliff: helle Figuren werden rechts dunkler, dunkle links heller
    defs = `<clipPath id="c"><rect x="${farbe === 'w' ? 50 : 0}" width="50" height="100"/></clipPath>`;
    fuellung = m.f;
    schliff = `<g clip-path="url(#c)" fill="${farbe === 'w' ? '#000' : '#fff'}" opacity=".14">${koerper}</g>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="45" height="45" viewBox="0 0 100 100"><defs>${defs}</defs>`
    + `<g fill="${fuellung}" stroke="${m.l}" stroke-width="2.2" stroke-linejoin="round">${koerper}</g>${schliff}`
    + (t.linien ? `<g fill="none" stroke="${m.l}" stroke-width="1.6" stroke-linecap="round">${t.linien}</g>` : '')
    + (t.punkte ? `<g fill="${m.l}">${t.punkte}</g>` : '')
    + SCHMUCK[set.id](m, MITTE[fig]) + '</svg>';
}

// ---------- Bretter (Vorschau 8x8, a8 hell) ----------
const HELL = [[0, 0], [11, 11]], DUNKEL = [[11, 0], [0, 11]];
const je = (felder, f) => felder.map(([x, y]) => f(x, y)).join('');
const BRETTER = [
  { id: 'sandstein', name: 'Sandstein', seltenheit: 'Selten', hell: '#F1E1C2', dunkel: '#C4935E', rand: '#6E4A2A', text: 'Warmer Stein mit feiner Koernung.',
    muster: () => je(HELL, (x, y) => `<circle cx="${x + 3}" cy="${y + 4}" r=".7"/><circle cx="${x + 8}" cy="${y + 7.5}" r=".5"/>`).replace(/<circle/g, '<circle fill="rgba(120,80,40,.28)"')
      + je(DUNKEL, (x, y) => `<circle fill="rgba(80,40,10,.25)" cx="${x + 4}" cy="${y + 7}" r=".8"/>`) },
  { id: 'mitternacht', name: 'Mitternacht', seltenheit: 'Selten', hell: '#C9CFE6', dunkel: '#2E3766', rand: '#12152B', text: 'Tiefblau mit winzigen Sternen.',
    muster: () => je(DUNKEL, (x, y) => `<circle cx="${x + 3}" cy="${y + 3}" r=".55"/><circle cx="${x + 8}" cy="${y + 7.5}" r=".4"/>`).replace(/<circle/g, '<circle fill="rgba(255,255,255,.7)"') },
  { id: 'kirschbluete', name: 'Kirschblüte', seltenheit: 'Selten', hell: '#FBE8EC', dunkel: '#D98AA0', rand: '#6B2E3E', text: 'Zartrosa mit kleinen Blueten.',
    muster: () => je(HELL, (x, y) => [0, 1, 2, 3, 4].map((i) => { const w = -Math.PI / 2 + (i * 2 * Math.PI) / 5; return `<circle fill="rgba(217,138,160,.4)" cx="${n(x + 5.5 + 1.5 * Math.cos(w))}" cy="${n(y + 5.5 + 1.5 * Math.sin(w))}" r="1"/>`; }).join('')) },
  { id: 'lagune', name: 'Lagune', seltenheit: 'Selten', hell: '#E6F4EF', dunkel: '#3E9C9A', rand: '#154747', text: 'Tuerkis mit sanften Wellen.',
    muster: () => je(DUNKEL, (x, y) => `<path d="M${x + 1} ${y + 6}q2.25-2 4.5 0t4.5 0" fill="none" stroke="rgba(255,255,255,.35)" stroke-width=".7"/>`) },
  { id: 'schiefer', name: 'Schiefer', seltenheit: 'Selten', hell: '#D7DADF', dunkel: '#59606B', rand: '#23262B', text: 'Kuehles Grau mit Schichtlinien.',
    muster: () => je(DUNKEL, (x, y) => `<path d="M${x} ${y + 4}l4-4M${x} ${y + 9}l9-9M${x + 5} ${y + 11}l6-6" stroke="rgba(0,0,0,.16)" stroke-width=".6"/>`)
      + je(HELL, (x, y) => `<path d="M${x + 1} ${y + 10}l9-9" stroke="rgba(0,0,0,.06)" stroke-width=".6"/>`) },
  { id: 'ahorn', name: 'Ahorn', seltenheit: 'Selten', hell: '#F3DDB4', dunkel: '#C98A4B', rand: '#5A3418', text: 'Helles Holz mit Maserung.',
    muster: () => je([...HELL, ...DUNKEL], (x, y) => `<path d="M${x} ${y + 3}q5.5 2 11 0M${x} ${y + 7.5}q5.5-2 11 0" fill="none" stroke="rgba(90,52,24,.16)" stroke-width=".5"/>`) },
  { id: 'kupfer', name: 'Kupfer', seltenheit: 'Selten', hell: '#F2D3B8', dunkel: '#B4643A', rand: '#4A2412', text: 'Gehaemmertes Kupfer mit Nieten im Rahmen.',
    muster: () => '', rahmen: () => '<g fill="#D99A6C">' + [[3, 3], [97, 3], [3, 97], [97, 97], [50, 3], [50, 97], [3, 50], [97, 50]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.3"/>`).join('') + '</g>' },
  // G-002 (Ausreisser 07.11.): Felder waren unter dem Schleier schlecht zu unterscheiden; jetzt hellere helle und dunklere
  // dunkle Felder, das Nordlicht liegt nur im Rahmen und als feine Kante um das Feld
  { id: 'aurora', name: 'Aurora', seltenheit: 'Episch', hell: '#E8F1F7', dunkel: '#1E3050', rand: '#0D1626', text: 'Nordlicht zieht als Schleier um das Brett.',
    muster: () => '', defs: '<linearGradient id="a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3BE8B0"/><stop offset=".5" stop-color="#4C6EF5"/><stop offset="1" stop-color="#B565F0"/></linearGradient>',
    ueber: '<path d="M0 6a6 6 0 0 1 6-6h88a6 6 0 0 1 6 6v88a6 6 0 0 1-6 6H6a6 6 0 0 1-6-6zM6 6v88h88V6z" fill="url(#a)" fill-rule="evenodd" opacity=".85"/>'
      + '<rect x="6" y="6" width="88" height="88" fill="none" stroke="url(#a)" stroke-width=".8"/>' },
  { id: 'kronsaal', name: 'Kronsaal', seltenheit: 'Exklusiv', hell: '#F3E3B6', dunkel: '#7A1F2E', rand: '#B8862B', text: 'Sonder-Brett: Weinrot und Gold mit Kronen im Feld.',
    muster: () => je(DUNKEL, (x, y) => `<path d="M${x + 3} ${y + 7.5}V${y + 4}l1.5 1.5 1-2 1 2 1.5-1.5v3.5z" fill="rgba(232,190,90,.5)"/>`),
    rahmen: () => '<rect x="3.2" y="3.2" width="93.6" height="93.6" rx="4" fill="none" stroke="#F3D27A" stroke-width=".9"/><rect x="6" y="6" width="88" height="88" fill="none" stroke="#5A3A08" stroke-width=".7"/>' },
];
const brettSvg = (b) => `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><defs>`
  + `<pattern id="p" width="22" height="22" x="6" y="6" patternUnits="userSpaceOnUse"><rect width="22" height="22" fill="${b.hell}"/>`
  + `<path d="M11 0h11v11H11zM0 11h11v11H0z" fill="${b.dunkel}"/>${b.muster()}</pattern>${b.defs || ''}</defs>`
  + `<rect width="100" height="100" rx="6" fill="${b.rand}"/><rect x="6" y="6" width="88" height="88" fill="url(#p)"/>`
  + `${b.ueber || ''}${b.rahmen ? b.rahmen() : ''}</svg>`;

// ---------- Effekte (SMIL; negative Startzeiten, damit auch das erste Bild schon etwas zeigt) ----------
const anim = (attr, werte, dauer, start = 0, extra = '') => `<animate attributeName="${attr}" values="${werte}" dur="${dauer}s" begin="${n(start)}s" repeatCount="indefinite"${extra}/>`;
const bewegt = (typ, werte, dauer, start = 0, summe = false) => `<animateTransform attributeName="transform" type="${typ}" values="${werte}" dur="${dauer}s" begin="${n(start)}s" repeatCount="indefinite"${summe ? ' additive="sum"' : ''}/>`;
function STERN5(r) {
  const p = [];
  for (let i = 0; i < 10; i++) { const w = -Math.PI / 2 + (i * Math.PI) / 5; const rr = i % 2 ? r * 0.45 : r; p.push([rr * Math.cos(w), rr * Math.sin(w)]); }
  return `M${p.map(pt).join('L')}Z`;
}
const KRONE_KLEIN = 'M-7 4v-8l3.5 4L0-6l3.5 4L7-4v8z';
// G-002 (Ausreisser 07.11.: zu bunt): nur Gold- und Akzentfarben der App
const KONFETTI_FARBEN = ['#FFC233', '#E9B949', '#C9461F', '#F3D27A', '#A97B1F'];
const EFFEKTE = [
  { id: 'wellenring', name: 'Wellenring', art: 'zug', seltenheit: 'Häufig', text: 'Zwei Ringe laufen vom Zielfeld nach aussen.',
    svg: () => '<g fill="none" stroke="#5B8CFF" stroke-width="3">' + [0, -0.7].map((s) => `<circle cx="50" cy="50" r="6">${anim('r', '6;42', 1.4, s)}${anim('opacity', '1;0', 1.4, s)}</circle>`).join('') + '</g><circle cx="50" cy="50" r="4" fill="#5B8CFF"/>' },
  { id: 'funkenspur', name: 'Funkenspur', art: 'zug', seltenheit: 'Häufig', text: 'Funken folgen dem Weg der Figur.',
    svg: () => '<g fill="#FF9F1C" stroke="#8A4B00" stroke-width="1">' + [0, 1, 2, 3, 4, 5].map((i) => `<circle cx="${n(18 + i * 12.8)}" cy="${n(82 - i * 12.8)}" r="2">${anim('r', '1;4;1', 1, -1 + i * 0.12)}${anim('opacity', '0;1;0', 1, -1 + i * 0.12)}</circle>`).join('') + '</g>' },
  { id: 'blattwirbel', name: 'Blattwirbel', art: 'zug', seltenheit: 'Häufig', text: 'Vier Blaetter drehen sich um das Zielfeld.',
    svg: () => `<g>${bewegt('rotate', '0 50 50;360 50 50', 2.4)}` + [0, 90, 180, 270].map((w) => `<g transform="rotate(${w} 50 50) translate(50 30) rotate(30)"><path d="M0-7Q6 0 0 7Q-6 0 0-7z" fill="#52B35A" stroke="#1F5E24" stroke-width="1"/><path d="M0-6V6" stroke="#1F5E24" stroke-width=".7"/></g>`).join('') + '</g>' },
  { id: 'pixelstaub', name: 'Pixelstaub', art: 'zug', seltenheit: 'Häufig', text: 'Kleine Pixel stieben auseinander.',
    svg: () => '<g stroke="#2B1A66" stroke-width=".8">' + Array.from({ length: 10 }, (_, i) => { const w = (i * 2 * Math.PI) / 10, dx = n(34 * Math.cos(w)), dy = n(34 * Math.sin(w)), s = -i * 0.11;
      return `<rect x="47.5" y="47.5" width="5" height="5" fill="${i % 2 ? '#5BD1FF' : '#9C6BFF'}">${bewegt('translate', `0 0;${dx} ${dy}`, 1.2, s)}${anim('opacity', '1;0', 1.2, s)}</rect>`; }).join('') + '</g>' },
  { id: 'konfetti', name: 'Konfetti', art: 'sieg', seltenheit: 'Selten', text: 'Goldene Schnipsel regnen ueber das Brett.',
    svg: () => '<g stroke="#22223A" stroke-width=".6">' + Array.from({ length: 14 }, (_, i) => { const x = 6 + ((i * 37) % 88), d = 1.8 + (i % 4) * 0.35, s = -((i * 0.53) % d);
      return `<rect x="${x}" y="-4" width="4" height="8" rx="1" fill="${KONFETTI_FARBEN[i % 5]}">${bewegt('translate', `0 -12;${(i % 3) * 6 - 6} 112`, d, s)}${bewegt('rotate', `0 ${x + 2} 0;${i % 2 ? 360 : -360} ${x + 2} 0`, d, s, true)}</rect>`; }).join('') + '</g>' },
  { id: 'lichtsaeule', name: 'Lichtsäule', art: 'sieg', seltenheit: 'Selten', text: 'Ein Lichtstrahl steigt ueber dem Koenig auf.',
    svg: () => '<defs><linearGradient id="s" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#F59F00" stop-opacity=".9"/><stop offset="1" stop-color="#F59F00" stop-opacity="0"/></linearGradient></defs>'
      + `<rect x="36" y="0" width="28" height="100" rx="14" fill="url(#s)">${anim('opacity', '.35;1;.35', 1.6)}</rect><rect x="46" y="8" width="8" height="92" rx="4" fill="#FFD43B">${anim('opacity', '.5;1;.5', 1.6)}</rect>`
      + '<g fill="#E8590C">' + [0, 1, 2, 3, 4].map((i) => `<circle cx="${40 + i * 5}" cy="90" r="1.8">${anim('cy', '92;8', 1.8, -i * 0.36)}${anim('opacity', '1;0', 1.8, -i * 0.36)}</circle>`).join('') + '</g>' },
  { id: 'sternschnuppe', name: 'Sternschnuppe', art: 'sieg', seltenheit: 'Selten', text: 'Ein Stern zieht mit Schweif ueber das Brett.',
    svg: () => '<defs><linearGradient id="t" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="-32" y2="19"><stop offset="0" stop-color="#FFC233"/><stop offset="1" stop-color="#FFC233" stop-opacity="0"/></linearGradient></defs>'
      + `<g>${bewegt('translate', '14 82;86 18', 1.6, -0.6)}${anim('opacity', '0;1;1;0', 1.6, -0.6, ' keyTimes="0;.15;.8;1"')}<path d="M0 0L-32 19" stroke="url(#t)" stroke-width="5" stroke-linecap="round"/><path d="${STERN5(8)}" fill="#FFC233" stroke="#8A6100" stroke-width="1.2" stroke-linejoin="round"/></g>`
      + '<g fill="#FFC233" stroke="#8A6100" stroke-width=".6">' + [[22, 24, 0], [76, 70, -0.5], [60, 30, -1]].map(([x, y, s]) => `<path d="${funkel(x, y, 3.2)}">${anim('opacity', '.2;1;.2', 1.5, s)}</path>`).join('') + '</g>' },
  { id: 'kronenregen', name: 'Kronenregen', art: 'sieg', seltenheit: 'Episch', text: 'Goldene Kronen fallen nach dem Matt.',
    svg: () => '<g fill="#FFC233" stroke="#7A5200" stroke-width="1.2" stroke-linejoin="round">' + Array.from({ length: 6 }, (_, i) => { const x = 12 + i * 15, d = 2 + (i % 3) * 0.4, s = -((i * 0.7) % d);
      return `<path d="${KRONE_KLEIN}">${bewegt('translate', `${x} -12;${x + (i % 2 ? 5 : -5)} 112`, d, s)}${bewegt('rotate', `${i % 2 ? -14 : 14};${i % 2 ? 14 : -14}`, d, s, true)}</path>`; }).join('') + '</g>' },
  { id: 'goldkranz', name: 'Goldkranz', art: 'sieg', seltenheit: 'Exklusiv', text: 'Sonder-Effekt: ein Lorbeerkranz waechst Blatt fuer Blatt, oben die Krone.',
    svg: () => { const blaetter = []; let i = 0;
      for (const seite of [1, -1]) for (let k = 0; k < 8; k++) { const w = ((seite === 1 ? 100 + k * 19 : 80 - k * 19) * Math.PI) / 180;
        const x = 50 + 30 * Math.cos(w), y = 52 + 30 * Math.sin(w), dreh = (w * 180) / Math.PI - 180 + seite * 20, s = (k * 0.12) - 1.9;
        blaetter.push(`<ellipse cx="0" cy="0" rx="3.2" ry="7" transform="translate(${n(x)} ${n(y)}) rotate(${n(dreh)})">${anim('opacity', '0;1;1;0', 2.6, s, ' keyTimes="0;.3;.85;1"')}</ellipse>`); i++; }
      return `<g fill="#E0A800" stroke="#6B4C00" stroke-width="1">${blaetter.join('')}</g><path d="${KRONE_KLEIN}" transform="translate(50 15) scale(1.3)" fill="#FFC233" stroke="#6B4C00" stroke-width="1" stroke-linejoin="round">${anim('opacity', '.6;1;.6', 2.6)}</path>`; } },
];
const effektSvg = (e) => `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">${e.svg()}</svg>`;

// ---------- Schreiben ----------
const stuecke = [];
const groessen = [];
for (const set of SETS) {
  const dateien = [];
  for (const farbe of ['w', 'b']) for (const fig of FIGUREN) {
    const rel = `assets/shop/figuren/${set.id}/${farbe}${fig}.svg`;
    groessen.push([rel, schreibe(rel, figurSvg(set, farbe, fig))]);
    dateien.push(rel);
  }
  stuecke.push({ id: set.id, art: 'figuren', name: set.name, seltenheit: set.seltenheit, text: set.text, ordner: `assets/shop/figuren/${set.id}`, figuren: 12 });
}
for (const b of BRETTER) {
  const rel = `assets/shop/bretter/${b.id}.svg`;
  groessen.push([rel, schreibe(rel, brettSvg(b))]);
  stuecke.push({ id: b.id, art: 'brett', name: b.name, seltenheit: b.seltenheit, text: b.text, datei: rel, hell: b.hell, dunkel: b.dunkel, rand: b.rand });
}
for (const e of EFFEKTE) {
  const rel = `assets/shop/effekte/${e.id}.svg`;
  groessen.push([rel, schreibe(rel, effektSvg(e))]);
  stuecke.push({ id: e.id, art: 'effekt', anlass: e.art, name: e.name, seltenheit: e.seltenheit, text: e.text, datei: rel });
}
const vorrat = {
  stand: '2026-11-06',
  hinweis: 'Nur Grafiken, noch nicht in die App eingebaut. Flo gibt jedes Stueck frei. Keine Preise: die stehen nur im Vault.',
  quelle: 'werkzeuge/shop-vorrat.mjs',
  seltenheiten: ['Häufig', 'Selten', 'Episch', 'Exklusiv'],
  stuecke,
};
schreibe('assets/shop/vorrat.json', JSON.stringify(vorrat, null, 2) + '\n');

// Uebersichtsseite: jedes Stueck auf hellem und dunklem Grund
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const vorschau = (s) => {
  if (s.art === 'figuren') {
    const reihe = (f) => `<div class="reihe">${FIGUREN.map((x) => `<img src="../${s.ordner}/${f}${x}.svg" alt="">`).join('')}</div>`;
    return reihe('w') + reihe('b');
  }
  return `<img class="gross" src="../${s.datei}" alt="">`;
};
const ART = { figuren: 'Figuren-Set', brett: 'Brett', effekt: 'Effekt' };
const karte = (s) => `<article class="karte s-${s.seltenheit === 'Häufig' ? 'haeufig' : s.seltenheit.toLowerCase()}"><header><b>${esc(s.name)}</b><span class="stufe">${s.seltenheit}</span></header>`
  + `<p>${ART[s.art]}${s.anlass ? (s.anlass === 'sieg' ? ' · Sieg' : ' · Zug') : ''} · ${esc(s.text)}</p><div class="gruende"><div class="hell">${vorschau(s)}</div><div class="dunkel">${vorschau(s)}</div></div></article>`;
const zaehl = (st) => stuecke.filter((s) => s.seltenheit === st).length;
const html = `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Shop-Vorrat</title>
<style>
:root{--grund:#f5f1e8;--karte:#fff;--linie:#e6dfd0;--text:#1d1b33;--leise:#6b6680;--gold:#b8862b}
*{box-sizing:border-box}body{margin:0;background:var(--grund);color:var(--text);font:14px/1.45 system-ui,sans-serif;padding:24px 16px}
h1{margin:0 0 4px;font-size:24px}h2{margin:28px 0 10px;font-size:18px}.leise{color:var(--leise);margin:0}
.raster{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:14px}
.karte{background:var(--karte);border:1px solid var(--linie);border-radius:16px;padding:12px}
.karte header{display:flex;justify-content:space-between;align-items:center;gap:8px}.karte p{margin:4px 0 10px;color:var(--leise);font-size:13px}
.stufe{font-size:12px;font-weight:700;padding:2px 9px;border-radius:99px;background:#ece8de}
.s-selten .stufe{background:#dbe7ff;color:#1f3f99}.s-episch .stufe{background:#eadcff;color:#53228f}
.s-exklusiv{border:2px solid var(--gold);box-shadow:0 0 0 3px #f3e2b0}.s-exklusiv .stufe{background:var(--gold);color:#fff}
.gruende{display:grid;grid-template-columns:1fr 1fr;border-radius:10px;overflow:hidden}
.gruende>div{padding:10px 4px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;min-height:130px}
.hell{background:#fbfaf6}.dunkel{background:#1d1b33}
.reihe{display:flex}.reihe img{width:26px;height:26px}.gross{width:110px;height:110px}
</style></head><body>
<h1>Shop-Vorrat Crownmate</h1>
<p class="leise">${stuecke.length} Stuecke, Stand ${vorrat.stand}. Noch nicht in die App eingebaut, Flo gibt jedes Stueck frei. Je Stueck links heller, rechts dunkler Grund.
Seltenheit: ${vorrat.seltenheiten.map((st) => `${st} ${zaehl(st)}`).join(', ')}. Liste: assets/shop/vorrat.json.</p>
${[['figuren', 'Figuren-Sets (je 12 Figuren)'], ['brett', 'Bretter'], ['effekt', 'Sieges- und Zug-Effekte']].map(([art, titel]) => `<h2>${titel}</h2><div class="raster">${stuecke.filter((s) => s.art === art).map(karte).join('')}</div>`).join('\n')}
</body></html>
`;
schreibe('docs/shop-vorrat.html', html);

const zuGross = groessen.filter(([, b]) => b > 8192);
console.log(`${stuecke.length} Stuecke, ${groessen.length} SVG-Dateien, groesste ${Math.max(...groessen.map(([, b]) => b))} Byte`);
if (zuGross.length) { console.log('ueber 8 KB:', zuGross); process.exitCode = 1; }
