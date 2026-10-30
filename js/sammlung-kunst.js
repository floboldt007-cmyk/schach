// Sammlung-Kunst (Flo, 30.10.2026, Bild der Klangsets "Holz" und "Arcade" mit demselben Lautsprecher: "Merk dir sowas,
// braucht auch ein besseres Design"): jedes Stueck der Sammlung bekommt ein eigenes Bild statt eines Sammel-Symbols.
// Klangsets zeigen ihr Material, Bretter ein kleines Brett mit Figuren, Erfolge ein eigenes Abzeichen je Art, gestaffelt
// wie die Rahmen (js/rahmen-kunst.js): je schwerer, desto mehr Glanz und Bewegung (Keyframes rk-* in css/app.css,
// "Bewegung aus" und prefers-reduced-motion stellen sie still). Ohne DOM, in Node testbar.
//
//   klangKunst(id) -> string | null          ganzes <svg> fuer ein Klangset (PAKETE_KLANG in js/sounds.js)
//   brettKunst(hell, dunkel, rand) -> string ganzes <svg> fuer ein Brett-Design
//   erfolgKunst(id) -> string | null         ganzes <svg> fuer einen Erfolg ('erster-sieg', 'welt-3', 'liga-6', ...)
//   erfolgSeltenheit(id) -> string           'frei' | 'selten' | 'episch' | 'legende'
//   ligaWappen(stufe) -> string              ganzes <svg> fuer die Liga-Stufe 0 (Holz) bis 6 (Meister)
import { KUNST_TEILE } from './rahmen-kunst.js';

const { id, um, verlauf, aura, kranz, orbit, lorbeer, fluegel, funke, glut, krone } = KUNST_TEILE;
const svg = (inhalt, klasse = '') => `<svg viewBox="0 0 120 120"${klasse ? ` class="${klasse}"` : ''} aria-hidden="true" overflow="visible">${inhalt}</svg>`;
const schrift = 'font-family="Manrope, system-ui, sans-serif" font-weight="800" text-anchor="middle"';

// Figuren im eigenen Raum (Bauer 24 x 34, Koenig 24 x 36), mit translate/scale platziert
const BAUER = 'M12 1a6 6 0 1 1 0 12a6 6 0 1 1 0-12ZM7 14h10l-1.5 3c2 3 3.5 7 3.5 12H5c0-5 1.5-9 3.5-12ZM3 30h18v4H3Z';
const KOENIG = 'M11 0h2v3h3v2h-3v3h-2V5H8V3h3ZM6 9h12l-1 4c3 4 4 9 4 15H3c0-6 1-11 4-15ZM2 30h20v5H2Z';
const figur = (pfad, x, y, s, fill, rand) => `<path d="${pfad}" transform="translate(${x} ${y}) scale(${s})" fill="${fill}" stroke="${rand}" stroke-width="${(1.6 / s).toFixed(2)}" stroke-linejoin="round"/>`;

// Stern mit n Zacken um (cx, cy)
const stern = (cx, cy, r, fill, extra = '', n = 5, innen = 0.45) => `<path d="${Array.from({ length: n * 2 }, (_, i) => {
  const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2; const rr = i % 2 ? r * innen : r;
  return `${i ? 'L' : 'M'}${(cx + rr * Math.cos(a)).toFixed(2)} ${(cy + rr * Math.sin(a)).toFixed(2)}`;
}).join('')}Z" fill="${fill}"${extra ? ' ' + extra : ''}/>`;

// ---------- Klangsets ----------

const KLANG = {
  // Holz: Baumscheibe mit Jahresringen, darauf ein Holzbauer, warme Schallbogen
  holz: () => {
    const g = id('h');
    return `<defs>${verlauf(g, ['#E2B47A', '#B9814A', '#D9A56A'])}</defs>`
      + '<ellipse cx="50" cy="92" rx="38" ry="12" fill="#6E4420"/><ellipse cx="50" cy="87" rx="38" ry="12" fill="#C8925A"/>'
      + [30, 21, 12, 5].map((r, i) => `<ellipse cx="50" cy="87" rx="${r}" ry="${(r * 0.32).toFixed(1)}" fill="none" stroke="#8A5A2B" stroke-width="1.3" opacity="${(0.5 + i * 0.12).toFixed(2)}"/>`).join('')
      + figur(BAUER, 30, 22, 1.65, `url(#${g})`, '#5A3414')
      + '<path d="M55 30c4 0 6 3 5 6" fill="none" stroke="#fff" stroke-width="1.6" opacity=".55" stroke-linecap="round"/>'
      + [[16, 4, 1], [27, 3.5, 0.7], [38, 3, 0.45]].map(([r, w, o], i) => `<path class="rk rk-atmen" d="M${80 + i * 2} ${50 - r * 0.7}a${r} ${r} 0 0 1 0 ${(r * 1.4).toFixed(1)}" fill="none" stroke="#F1C27D" stroke-width="${w}" stroke-linecap="round" opacity="${o}" style="animation-delay:${(i * 0.35).toFixed(2)}s"/>`).join('');
  },
  // Arcade: Leuchtbildschirm mit Pixel-Equalizer und Pixel-Note
  arcade: () => {
    const hoehen = [3, 5, 7, 4, 6, 2];
    const farbe = (k) => (k >= 6 ? '#FF4FD8' : k >= 4 ? '#FFE14D' : '#3EF2E6');
    const balken = hoehen.map((h, i) => `<g class="rk rk-atmen" style="animation-delay:${(i * 0.22).toFixed(2)}s">${Array.from({ length: h }, (_, k) => `<rect x="${22 + i * 13}" y="${86 - k * 8}" width="10" height="6" rx="1" fill="${farbe(k)}"/>`).join('')}</g>`).join('');
    return '<rect x="8" y="14" width="104" height="92" rx="14" fill="#1B1035" stroke="#FF4FD8" stroke-width="3"/>'
      + '<rect x="8" y="14" width="104" height="92" rx="14" fill="none" stroke="#7A3CFF" stroke-width="9" opacity=".25"/>'
      + Array.from({ length: 10 }, (_, i) => `<rect x="12" y="${20 + i * 9}" width="96" height="1" fill="#fff" opacity=".05"/>`).join('')
      + balken
      + '<path d="M86 22h6v4h4v4h-4v12h-2a4 4 0 1 1 0-4h2v-8h-2v-4h-4Z" fill="#FFE14D" transform="translate(-2 2)"/>'
      + funke(24, 26, 0.8, 0.3, '#3EF2E6');
  },
};

export function klangKunst(kid) {
  const f = KLANG[kid];
  return f ? svg(f(), 'sk-klang') : null;
}

// ---------- Bretter ----------

// Kleines Brett 4 x 4 im Rahmen, darauf Koenig (hell) und Bauer (dunkel)
export function brettKunst(hell, dunkel, rand = '#2A2A2A') {
  const felder = Array.from({ length: 16 }, (_, i) => {
    const x = i % 4; const y = Math.floor(i / 4);
    return `<rect x="${18 + x * 21}" y="${18 + y * 21}" width="21" height="21" fill="${(x + y) % 2 ? dunkel : hell}"/>`;
  }).join('');
  return svg(`<rect x="10" y="10" width="100" height="100" rx="12" fill="${rand}"/>${felder}`
    + '<rect x="18" y="18" width="84" height="84" fill="none" stroke="#000" stroke-opacity=".25" stroke-width="1.5"/>'
    + figur(KOENIG, 42, 21, 1.15, '#FAFAF7', '#2A2A2A') + figur(BAUER, 66, 61, 1.05, '#26262B', '#000'), 'sk-brett');
}

// ---------- Erfolge ----------

const SELTEN = {
  'erster-sieg': 'frei', 'drei-sterne': 'selten',
  'welt-1': 'selten', 'welt-2': 'selten', 'welt-3': 'episch', 'welt-4': 'episch', 'welt-5': 'legende',
  'alle-bots': 'legende', 'alle-sterne': 'legende',
  'liga-1': 'selten', 'liga-2': 'selten', 'liga-3': 'episch', 'liga-4': 'episch', 'liga-5': 'legende', 'liga-6': 'legende',
  'serie-7': 'selten', 'serie-30': 'episch', 'serie-100': 'legende',
  'level-10': 'selten', 'level-20': 'episch', 'level-30': 'legende',
};
export function erfolgSeltenheit(eid) {
  return SELTEN[eid] || 'frei';
}

// Glanz und Aura je Seltenheit hinter dem Abzeichen
function hof(eid, farbe) {
  const s = erfolgSeltenheit(eid);
  if (s === 'legende') return kranz(farbe, 8, 12) + aura(farbe, 50, 6);
  if (s === 'episch') return aura(farbe, 50, 5) + lorbeer('#C9A13B', '#5A3A06');
  return '';
}
function funken(eid, farbe = '#FFF6D6') {
  const s = erfolgSeltenheit(eid);
  if (s === 'legende') return orbit(6, farbe, 54, 1.5) + funke(24, 26, 1, 0, farbe) + funke(96, 30, 0.8, 0.9, farbe);
  if (s === 'episch') return funke(92, 28, 0.8, 0.4, farbe);
  return '';
}

const SCHILD = 'M60 14L96 26V58C96 82 80 98 60 108C40 98 24 82 24 58V26Z';
const WELT = [
  null,
  { farbe: '#8CC66A', dunkel: '#3E6B2A', bild: (c) => `<g clip-path="url(#${c})" opacity=".55">${Array.from({ length: 30 }, (_, i) => {
    const x = i % 6; const y = Math.floor(i / 6); return (x + y) % 2 ? '' : `<rect x="${24 + x * 12}" y="${30 + y * 12}" width="12" height="12" fill="#3E6B2A"/>`;
  }).join('')}</g>` },
  { farbe: '#4E7A4A', dunkel: '#22391F', bild: () => [[44, 76, 14], [60, 68, 18], [76, 76, 14]].map(([x, y, h]) => `<path d="M${x} ${y - h * 2}L${x + h * 0.8} ${y}H${x - h * 0.8}Z" fill="#A9D59A"/><rect x="${x - 2}" y="${y}" width="4" height="6" fill="#22391F"/>`).join('') },
  { farbe: '#9AA3AE', dunkel: '#4B535D', bild: () => '<path d="M46 44h5v6h5v-6h8v6h5v-6h5v12l-5 5v17h5v7H46v-7h5V61l-5-5Z" fill="#EEF1F5" stroke="#4B535D" stroke-width="1.5" stroke-linejoin="round"/>' },
  { farbe: '#3E8DA8', dunkel: '#17485A', bild: () => [52, 64, 76].map((y, i) => `<path d="M32 ${y}c6-6 10-6 14 0s8 6 14 0 10-6 14 0 8 6 14 0" fill="none" stroke="#BFF1FF" stroke-width="3.5" stroke-linecap="round" opacity="${(1 - i * 0.22).toFixed(2)}"/>`).join('') },
  { farbe: '#1F2A4F', dunkel: '#0B1230', bild: () => '<path d="M38 64c8-12 22-14 32-6l10-8v24l-10-8c-10 8-24 6-32-2Z" fill="#5FD3A6"/><circle cx="50" cy="61" r="2.2" fill="#0B1230"/>'
    + '<circle class="rk rk-steigen" cx="72" cy="50" r="2.5" fill="#BFF1FF"/><circle class="rk rk-steigen" cx="78" cy="44" r="1.6" fill="#BFF1FF" style="animation-delay:.8s"/>' },
];

const LIGA = [
  ['#E2B47A', '#A8743F', '#C8925A', '#7C4F27'],
  ['#F2B887', '#9A5A2E', '#E7A26C', '#7E4520'],
  ['#FFFFFF', '#A9B2BE', '#EEF1F5', '#8792A1'],
  ['#FFF0B0', '#D9981E', '#FFD86A', '#A86B0C'],
  ['#F4FFFD', '#8FB7B3', '#E2F4F1', '#5F8F8A'],
  ['#E6F6FF', '#5AA6F0', '#BDE8FF', '#2F7DD6'],
  ['#F5C451', '#8B5CF6', '#F5C451', '#C084FC'],
];
const LIGA_GLANZ = ['#C8925A', '#E7A26C', '#EEF1F5', '#F5C451', '#9FE8DF', '#8FD3FF', '#C084FC'];

function welt(eid, nr) {
  const w = WELT[nr]; const c = id('c'); const g = id('w');
  return `<defs>${verlauf(g, [w.farbe, w.dunkel], 0, 1)}<clipPath id="${c}"><path d="${SCHILD}"/></clipPath></defs>${hof(eid, w.farbe)}`
    + `<path d="${SCHILD}" fill="url(#${g})" stroke="#F5E6B8" stroke-width="4" stroke-linejoin="round"/>${w.bild(c)}`
    + `<path d="${SCHILD}" fill="none" stroke="#1C1B19" stroke-width="1.2" opacity=".5"/>`
    + `<text x="60" y="38" ${schrift} font-size="13" fill="#F5E6B8">${nr}</text>${funken(eid)}`;
}

function liga(eid, stufe) {
  const g = id('l'); const glanz = LIGA_GLANZ[stufe];
  const pips = Array.from({ length: Math.min(stufe, 5) }, (_, i) => stern(60 + (i - (Math.min(stufe, 5) - 1) / 2) * 11, 86, 4.6, '#1C1B19', 'opacity=".55"')).join('');
  return `<defs>${verlauf(g, LIGA[stufe])}</defs>${hof(eid, glanz)}${stufe === 6 ? fluegel('#F5C451') : ''}`
    + `<path d="${SCHILD}" fill="url(#${g})" stroke="#1C1B19" stroke-width="2" stroke-linejoin="round" stroke-opacity=".45"/>`
    + '<path d="M38 46L60 60L82 46V58L60 72L38 58Z" fill="#1C1B19" opacity=".28"/>'
    + '<path d="M36 30L60 22L84 30" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".6"/>'
    + pips + (stufe === 6 ? krone(10, 1.1) : '') + funken(eid);
}

function serie(eid, n) {
  const farben = n >= 100 ? ['#F5F3FF', '#C084FC', '#7C3AED'] : n >= 30 ? ['#E0F2FF', '#5AA6F0', '#1E5BB8'] : ['#FFE7A3', '#FF9A3C', '#E04A1F'];
  const g = id('f');
  return `<defs>${verlauf(g, farben, 0, 1)}</defs>${hof(eid, farben[1])}`
    + `<g class="rk-flamme"><path d="M60 10C72 28 88 40 84 64C82 84 70 96 60 96C46 96 34 86 36 66C38 50 48 44 50 28C56 38 58 42 60 48C62 36 62 24 60 10Z" fill="url(#${g})"/>`
    + `<path d="M60 44C66 54 72 60 70 72C69 82 65 88 60 88C53 88 49 82 50 73C51 64 56 60 60 44Z" fill="${farben[0]}" opacity=".85"/></g>`
    + '<rect x="34" y="88" width="52" height="22" rx="11" fill="#1C1B19"/>'
    + `<text x="60" y="104" ${schrift} font-size="${n >= 100 ? 14 : 16}" fill="${farben[0]}">${n}</text>`
    + (n >= 30 ? glut(farben[1], 4) : '') + funken(eid);
}

function level(eid, n) {
  const metall = n >= 30 ? ['#FFF0B0', '#D9981E', '#FFD86A', '#A86B0C'] : n >= 20 ? ['#FFFFFF', '#A9B2BE', '#EEF1F5', '#8792A1'] : ['#F2B887', '#9A5A2E', '#E7A26C', '#7E4520'];
  const g = id('m');
  return `<defs>${verlauf(g, metall)}</defs>${hof(eid, metall[1])}`
    + '<path d="M40 6H54L66 46H52Z" fill="#C2410C"/><path d="M80 6H66L54 46H68Z" fill="#1D4ED8"/>'
    + `<circle cx="60" cy="72" r="32" fill="url(#${g})" stroke="#1C1B19" stroke-width="2" stroke-opacity=".4"/>`
    + um(16, 27, (x, y) => `<circle cx="${x}" cy="${(y + 12).toFixed(2)}" r="1.4" fill="#1C1B19" opacity=".35"/>`)
    + `<circle cx="60" cy="72" r="21" fill="none" stroke="#fff" stroke-width="2" opacity=".55"/>`
    + `<text x="60" y="80" ${schrift} font-size="22" fill="#1C1B19" opacity=".8">${n}</text>` + funken(eid);
}

const ERFOLG = {
  'erster-sieg': () => {
    const g = id('t');
    return `<defs>${verlauf(g, ['#FFE7A3', '#D9981E', '#FFD86A', '#A86B0C'])}</defs>`
      + '<path d="M38 34H26c0 14 7 22 16 24M82 34h12c0 14-7 22-16 24" fill="none" stroke="#A86B0C" stroke-width="5" stroke-linecap="round"/>'
      + `<path d="M36 24h48v14c0 18-11 30-24 30S36 56 36 38Z" fill="url(#${g})" stroke="#6B4205" stroke-width="2"/>`
      + '<rect x="54" y="68" width="12" height="12" fill="#A86B0C"/><path d="M42 80h36l5 16H37Z" fill="#6B4205"/>'
      + stern(60, 44, 9, '#FFF6D6', 'opacity=".9"') + '<path d="M42 28v8" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".6"/>';
  },
  'drei-sterne': () => '<path d="M30 88h60l-6 12H36Z" fill="#6B4205"/>'
    + stern(36, 64, 15, '#F5C451', 'stroke="#6B4205" stroke-width="2"') + stern(84, 64, 15, '#F5C451', 'stroke="#6B4205" stroke-width="2"')
    + stern(60, 46, 21, '#FFD86A', 'stroke="#6B4205" stroke-width="2"') + funke(60, 16, 0.9, 0.2, '#FFF6D6'),
  'alle-bots': () => `${hof('alle-bots', '#C084FC')}`
    + [24, 42, 60, 78, 96].map((x, i) => figur(BAUER, x - 9, 58 + (i % 2) * 4, 0.75, ['#A9B2BE', '#E7A26C', '#F5C451', '#9FE8DF', '#8FD3FF'][i], '#1C1B19')).join('')
    + '<path d="M22 92h76" stroke="#1C1B19" stroke-width="3" stroke-linecap="round" opacity=".4"/>'
    + krone(38, 1.9) + `<text x="60" y="110" ${schrift} font-size="12" fill="#F5E6B8">30</text>${funken('alle-bots')}`,
  'alle-sterne': () => `${hof('alle-sterne', '#F5C451')}`
    + `<g class="rk rk-drehen-langsam" style="transform-origin:60px 60px">${um(8, 40, (x, y) => stern(x, y, 5, '#FFE7A3'))}</g>`
    + stern(60, 60, 27, '#F5C451', 'stroke="#6B4205" stroke-width="2.4"') + stern(60, 60, 13, '#FFF6D6', 'opacity=".7"') + funken('alle-sterne'),
};

export function erfolgKunst(eid) {
  const s = String(eid || '');
  let inhalt = null;
  if (ERFOLG[s]) inhalt = ERFOLG[s]();
  else {
    const m = /^(welt|liga|serie|level)-(\d+)$/.exec(s);
    const n = m ? Number(m[2]) : 0;
    if (m && m[1] === 'welt' && WELT[n]) inhalt = welt(s, n);
    else if (m && m[1] === 'liga' && n >= 1 && LIGA[n]) inhalt = liga(s, n);
    else if (m && m[1] === 'serie' && SELTEN[s]) inhalt = serie(s, n);
    else if (m && m[1] === 'level' && SELTEN[s]) inhalt = level(s, n);
  }
  return inhalt ? svg(inhalt, 'sk-erfolg') : null;
}

// Liga-Wappen der Stufe 0 (Holz) bis 6 (Meister), z. B. fuer die Liga-Karte im Ergebnis
export function ligaWappen(stufe) {
  const n = Math.max(0, Math.min(6, Math.floor(Number(stufe) || 0)));
  return svg(liga('liga-' + n, n), 'sk-liga');
}
