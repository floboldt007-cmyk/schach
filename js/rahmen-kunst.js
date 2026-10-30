// Rahmen-Kunst (Flo, 30.10.2026: "Die Rahmen sind so nichts Besonderes. Die sehen alle gleich aus ... sieht billig aus",
// Entwurf "Crownmate Runde 5", Abschnitt Rahmen): jeder Rahmen aus eigenem Material statt nur einem farbigen Ring. Holz mit
// Maserung, Liga-Metalle mit Glanz, Diamant mit Facetten, die Krone mit Aura, Welten mit ihrer Landschaft, Serie als Funke,
// Glut und Flamme, die Blaupause des Erfinders mit Messstrichen. Je seltener, desto mehr Bewegung (nur transform und
// opacity, Keyframes rk-* in css/app.css; "Bewegung aus" und prefers-reduced-motion stellen sie still, css/tokens.css).
// Ohne DOM, in Node testbar.
//
//   rahmenKunst(id) -> string | null      SVG-Inhalt im Raum 0..120, Mitte (60, 60), Ring r = 46 (innen 41, aussen 51);
//                                         null fuer 'ohne' und unbekannte Ids. Jeder Aufruf hat eigene Verlauf-Ids.
//   RAHMEN_KUNST                          Id -> Seltenheit ('frei' | 'selten' | 'episch' | 'legende' | 'einzig')
//   rahmenSvg(id, { klasse? }) -> string  ganzes <svg viewBox="0 0 120 120"> mit dunkler Scheibe und Rahmen (Auswahl, Sammlung)
let nr = 0;
const id = (p) => `rk${p}${++nr}`;
const um = (n, r, f) => Array.from({ length: n }, (_, i) => {
  const a = (i / n) * Math.PI * 2 - Math.PI / 2;
  return f(+(60 + r * Math.cos(a)).toFixed(2), +(60 + r * Math.sin(a)).toFixed(2), +((a * 180) / Math.PI + 90).toFixed(1), i);
}).join('');
const verlauf = (gid, farben, x2 = 1, y2 = 1) => `<linearGradient id="${gid}" x1="0" y1="0" x2="${x2}" y2="${y2}">${farben
  .map((c, i) => `<stop offset="${(i / (farben.length - 1)).toFixed(3)}" stop-color="${c}"/>`).join('')}</linearGradient>`;
const ring = (farbe, w = 10, r = 46, extra = '') => `<circle cx="60" cy="60" r="${r}" fill="none" stroke="${farbe}" stroke-width="${w}"${extra ? ' ' + extra : ''}/>`;
const kante = (c = '#1C1B19', o = 0.35) => `<circle cx="60" cy="60" r="51.5" fill="none" stroke="${c}" stroke-width="1.2" opacity="${o}"/>`
  + `<circle cx="60" cy="60" r="40.5" fill="none" stroke="${c}" stroke-width="1.2" opacity="${o}"/>`;
const glanz = (v = 0) => `<circle class="rk rk-glanz" cx="60" cy="60" r="46" fill="none" stroke="#fff" stroke-width="10" stroke-dasharray="22 300" opacity=".55" style="animation-delay:${v}s"/>`;
const funke = (x, y, s = 1, v = 0, c = '#fff') => `<path class="rk rk-funkeln" d="M${x} ${y - 5 * s}L${x + 1.4 * s} ${y - 1.4 * s}L${x + 5 * s} ${y}L${x + 1.4 * s} ${y + 1.4 * s}`
  + `L${x} ${y + 5 * s}L${x - 1.4 * s} ${y + 1.4 * s}L${x - 5 * s} ${y}L${x - 1.4 * s} ${y - 1.4 * s}Z" fill="${c}" style="transform-origin:${x}px ${y}px;animation-delay:${v}s"/>`;
const krone = (y = 6, s = 1, c = '#F5C451') => `<g transform="translate(60 ${y}) scale(${s})"><path d="M-14 8L-12 -6L-6 0L0 -10L6 0L12 -6L14 8Z" fill="${c}"`
  + ` stroke="#5A3A06" stroke-width="2" stroke-linejoin="round"/><circle cx="0" cy="1" r="2.2" fill="#E8483B"/></g>`;

const KUNST = {
  holz: () => `${ring('#A8743F')}<circle cx="60" cy="60" r="48.5" fill="none" stroke="#7C4F27" stroke-width="1.2" stroke-dasharray="16 7 5 11" opacity=".75"/>`
    + `<circle cx="60" cy="60" r="43.5" fill="none" stroke="#7C4F27" stroke-width="1.2" stroke-dasharray="9 13 21 6" opacity=".6"/>${kante('#4A2F17', 0.5)}`
    + um(4, 46, (x, y) => `<circle cx="${x}" cy="${y}" r="2" fill="#4A2F17"/>`),
  brett: () => `${ring('#F2EDE3')}${ring('#26221E', 10, 46, 'stroke-dasharray="12.04 12.04"')}${kante('#26221E', 0.9)}`,
  'liga-1': () => { const g = id('b'); return `<defs>${verlauf(g, ['#F2B887', '#9A5A2E', '#E7A26C', '#7E4520'])}</defs>${ring(`url(#${g})`, 11)}${kante('#5B3015', 0.6)}`
    + um(8, 46, (x, y) => `<circle cx="${x}" cy="${y}" r="1.8" fill="#FFD9B5"/>`); },
  'liga-2': () => { const g = id('s'); return `<defs>${verlauf(g, ['#FFFFFF', '#A9B2BE', '#EEF1F5', '#8792A1'])}</defs>${ring(`url(#${g})`, 11)}${kante('#4C5562', 0.55)}`
    + um(12, 46, (x, y) => `<circle cx="${x}" cy="${y}" r="2.1" fill="#fff" stroke="#8792A1" stroke-width=".8"/>`) + glanz(0); },
  'liga-3': () => { const g = id('g'); return `<defs>${verlauf(g, ['#FFF0B0', '#D9981E', '#FFD86A', '#A86B0C'])}</defs>${ring(`url(#${g})`, 12)}${kante('#6B4205', 0.6)}`
    + um(3, 46, (x, y) => `<circle cx="${x}" cy="${y}" r="3.6" fill="#E8483B" stroke="#7A1A12" stroke-width="1"/>`) + glanz(0.4) + krone(9, 0.95); },
  'liga-4': () => { const g = id('p'); return `<defs>${verlauf(g, ['#F4FFFD', '#8FB7B3', '#E2F4F1', '#5F8F8A'])}</defs>${ring(`url(#${g})`, 12)}`
    + `<circle cx="60" cy="60" r="49.5" fill="none" stroke="#3E6E69" stroke-width=".8"/><circle cx="60" cy="60" r="42.5" fill="none" stroke="#3E6E69" stroke-width=".8"/>`
    + kante('#2F5752', 0.6) + um(4, 46, (x, y) => `<rect x="${x - 4}" y="${y - 4}" width="8" height="8" transform="rotate(45 ${x} ${y})" fill="#E6FFFB" stroke="#3E6E69" stroke-width="1"/>`) + glanz(0.8); },
  'liga-5': () => `${ring('#5AA6F0', 12)}${ring('#BDE8FF', 12, 46, 'stroke-dasharray="9 9"')}${ring('#2F7DD6', 4, 46, 'stroke-dasharray="3 15" stroke-dashoffset="-3"')}`
    + `${kante('#1F5FA8', 0.8)}${funke(98, 26, 1.1, 0)}${funke(22, 34, 0.8, 0.8)}${funke(96, 92, 0.9, 1.5)}${funke(28, 96, 1, 2)}`,
  'liga-6': () => { const g = id('k'); return `<defs>${verlauf(g, ['#F5C451', '#8B5CF6', '#F5C451', '#C084FC', '#F5C451'])}</defs>`
    + `<circle class="rk rk-atmen" cx="60" cy="60" r="55" fill="none" stroke="#A78BFA" stroke-width="5"/>`
    + `<g class="rk rk-drehen" style="transform-origin:60px 60px">${ring(`url(#${g})`, 12)}</g>${kante('#3B1D7A', 0.7)}`
    + um(6, 46, (x, y) => `<circle cx="${x}" cy="${y}" r="2.8" fill="#fff" stroke="#6D28D9" stroke-width="1"/>`) + krone(7, 1.25) + funke(102, 40, 0.9, 0.3) + funke(18, 70, 0.8, 1.3); },
  'welt-1': () => `${ring('#8CC66A', 11)}${kante('#3E6B2A', 0.5)}`
    + um(14, 46, (x, y, d) => `<ellipse cx="${x}" cy="${y}" rx="5" ry="2.6" transform="rotate(${d + 35} ${x} ${y})" fill="#4E9A3A"/>`)
    + um(5, 46, (x, y) => `<g transform="translate(${x} ${y})"><circle r="3.6" fill="#FFF7E0"/><circle r="1.6" fill="#F5B82E"/></g>`),
  'welt-2': () => `${ring('#4E7A4A', 11)}${kante('#22391F', 0.6)}`
    + um(20, 48, (x, y, d, i) => `<path d="M0 -7L4 1L1.5 1L1.5 5L-1.5 5L-1.5 1L-4 1Z" transform="translate(${x} ${y}) rotate(${d})" fill="${i % 2 ? '#2F5A2B' : '#77A86A'}"/>`),
  'welt-3': () => `${ring('#9AA3AE', 11)}${kante('#4B535D', 0.6)}`
    + um(16, 50.5, (x, y, d) => `<rect x="-3" y="-3.5" width="6" height="7" transform="translate(${x} ${y}) rotate(${d})" fill="#7C8796" stroke="#4B535D" stroke-width=".8"/>`)
    + um(24, 46, (x, y, d) => `<rect x="-3.6" y="-2" width="7.2" height="4" rx=".6" transform="translate(${x} ${y}) rotate(${d})" fill="none" stroke="#5E6774" stroke-width=".7"/>`),
  'welt-4': () => { const c = id('c'); return `<defs><clipPath id="${c}"><circle cx="60" cy="60" r="51.5"/></clipPath></defs>${ring('#3E8DA8', 11)}`
    + `<g clip-path="url(#${c})"><g class="rk rk-welle"><path d="M-24 102q6 -6 12 0t12 0t12 0t12 0t12 0t12 0t12 0t12 0t12 0t12 0t12 0t12 0t12 0v20h-160z" fill="#9FE3F2" opacity=".75"/></g></g>`
    + kante('#1C5A70', 0.6) + um(6, 46, (x, y, d, i) => `<circle class="rk rk-funkeln" cx="${x}" cy="${y}" r="${1.4 + (i % 3)}" fill="#E6FBFF" style="transform-origin:${x}px ${y}px;animation-delay:${(i * 0.4).toFixed(1)}s"/>`); },
  'welt-5': () => `${ring('#1F2A4F', 12)}${kante('#0B1230', 0.9)}`
    + um(9, 46, (x, y, d, i) => `<circle class="rk rk-funkeln" cx="${x}" cy="${y}" r="${i % 3 ? 1.1 : 1.8}" fill="#FFF6D6" style="transform-origin:${x}px ${y}px;animation-delay:${(i * 0.3).toFixed(1)}s"/>`)
    + `<path d="M93 22a8 8 0 1 0 8 10a6 6 0 1 1 -8 -10z" fill="#FFE59A"/>${funke(26, 26, 0.8, 0.5, '#5FD3A6')}`,
  'serie-7': () => `${ring('#F08A3C', 7)}${kante('#8A3D0E', 0.4)}` + um(8, 53, (x, y, d, i) => funke(x, y, 0.75, +(i * 0.3).toFixed(1), '#FFB347')),
  'serie-30': () => { const g = id('u'); return `<defs>${verlauf(g, ['#FFB347', '#E8442C', '#FF8A3C', '#B3261E'])}</defs>${ring(`url(#${g})`, 11)}`
    + `<circle class="rk rk-atmen" cx="60" cy="60" r="46" fill="none" stroke="#FFD27A" stroke-width="3" stroke-dasharray="2 9"/>${kante('#5A0F08', 0.6)}`; },
  'serie-100': () => { const g = id('f'); return `<defs>${verlauf(g, ['#FFE08A', '#FF7A1A', '#D9261C'], 0, 1)}</defs>`
    + um(12, 50, (x, y, d, i) => `<g transform="translate(${x} ${y}) rotate(${d})"><path class="rk-flamme" d="M0 4C-5 0 -4 -7 0 -14C4 -7 5 0 0 4Z" fill="url(#${g})"`
      + ` style="animation-duration:${(0.9 + (i % 4) * 0.15).toFixed(2)}s;animation-delay:${(i * 0.07).toFixed(2)}s"/></g>`)
    + ring('#B3261E', 11) + kante('#4A0905', 0.7) + um(12, 46, (x, y) => `<circle cx="${x}" cy="${y}" r="1.3" fill="#FFD27A"/>`); },
  'erfinder-blatt-0': () => `${ring('#1E5BB8', 12)}${ring('#E9F2FF', 5, 46, 'stroke-dasharray=".7 3.12"')}${ring('#E9F2FF', 9, 46, 'stroke-dasharray=".9 23.18"')}`
    + `${kante('#0B2D63', 0.8)}<g transform="translate(60 106)"><rect x="-15" y="-6.5" width="30" height="13" rx="3" fill="#F5C451" stroke="#5A3A06" stroke-width="1.4"/>`
    + `<text y="3.6" text-anchor="middle" font-family="Manrope, system-ui, sans-serif" font-weight="800" font-size="9" fill="#3A2504">Nr. 0</text></g>`,
  drache: () => `${ring('#2E1F47', 12)}`
    + um(18, 46, (x, y, d, i) => `<path d="M-5 -3Q0 6 5 -3Q0 0 -5 -3Z" transform="translate(${x} ${y}) rotate(${d})" fill="${i % 2 ? '#6C3FC1' : '#3FA77A'}" stroke="#140C22" stroke-width=".6"/>`)
    + `${kante('#140C22', 0.8)}<path d="M44 16L40 2L50 12ZM76 16L80 2L70 12Z" fill="#E8E1D0" stroke="#140C22" stroke-width="1.2"/>`
    + `<circle class="rk rk-atmen" cx="60" cy="13" r="4" fill="#FF3B30"/>`,
  neon: () => `<circle class="rk rk-atmen" cx="60" cy="60" r="47" fill="none" stroke="#2CF2FF" stroke-width="12" opacity=".25"/>`
    + `${ring('#2CF2FF', 4, 47)}${ring('#FF3DCB', 2.4, 51.5)}${ring('#FF3DCB', 2.4, 42.5)}`,
  pixel: () => um(24, 46, (x, y, d, i) => `<rect x="${(x - 5).toFixed(2)}" y="${(y - 5).toFixed(2)}" width="10" height="10" fill="${['#FF5A5F', '#FFD23F', '#3BCEAC', '#4D9DE0'][i % 4]}" stroke="#1C1B19" stroke-width="1.2"/>`),
};

export const RAHMEN_KUNST = Object.freeze({
  holz: 'frei', brett: 'frei',
  'liga-1': 'selten', 'liga-2': 'selten', 'liga-3': 'episch', 'liga-4': 'episch', 'liga-5': 'legende', 'liga-6': 'legende',
  'welt-1': 'selten', 'welt-2': 'selten', 'welt-3': 'episch', 'welt-4': 'episch', 'welt-5': 'legende',
  'serie-7': 'selten', 'serie-30': 'episch', 'serie-100': 'legende',
  drache: 'episch', pixel: 'selten', neon: 'episch', 'erfinder-blatt-0': 'einzig',
});

export function rahmenKunst(rid) {
  const f = KUNST[rid];
  return f ? f() : null;
}

export function rahmenSvg(rid, { klasse = '' } = {}) {
  const kunst = rahmenKunst(rid);
  const leer = '<circle cx="60" cy="60" r="46" fill="none" stroke="currentColor" stroke-width="3" stroke-dasharray="6 6" opacity=".5"/>';
  return `<svg viewBox="0 0 120 120" class="${klasse}" aria-hidden="true" overflow="visible"><circle cx="60" cy="60" r="40" fill="#2C3038"/>${kunst || leer}</svg>`;
}
