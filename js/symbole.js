import { ZUGKLASSEN, KLASSEN_NAME } from './zugklassen.js';

// Die 11 Zug-Klassen-Symbole.
// Variante A "Ruhig" (Flo, 30.10.2026: "Die Analyse-Logos sind auch nicht so clean"): eine zarte Kachel in der Farbe
// der Klasse, darauf das Zeichen in der Textfarbe (--kt-*, fuer hell und dunkel auf >= 4,5:1 abgestimmt). Fuenf
// Farbfamilien statt elf (css/themes/modern.css); das Zeichen unterscheidet die Klassen einer Familie. Die alten
// Formen (form, zeichen) bleiben fuer die Werkzeuge unter design/.
// Nutzung: setzeSymbole(SYMBOLE) aus board.js einmal beim Start; danach liefert
// symbolSvg(klasse) aus board.js das Symbol auch fuer Coach-Zeile und Zugliste.

// Ersatzfarben wie --k-* in css/themes/modern.css (Variante A, fuenf Familien)
const FARBEN = ['#7C3AED', '#B98A1E', '#2F7D5B', '#2F7D5B', '#6E8A7C', '#958571', '#C27A12', '#C2561A', '#B23A3A', '#B23A3A', '#8B8F99'];
export const KLASSEN = ZUGKLASSEN.map((k, i) => ({ ...k, kurz: k.zeichen, farbe: FARBEN[i] }));

const D = 'currentColor';
const S = `stroke="${D}" stroke-linecap="round" stroke-linejoin="round" fill="none"`;

const ausruf = (x, w = 2.7, o = 6.6, u = 13, p = 17.3, r = 1.6) => `<path d="M${x} ${o}V${u}" ${S} stroke-width="${w}"/><circle cx="${x}" cy="${p}" r="${r}" fill="${D}"/>`;
const frage = (x, w = 2.5, b = 2.9) =>
  `<path d="M${x - b} 8.6c0-2.9 ${b * 2 + 0.2}-3.2 ${b * 2 + 0.2} 0c0 2.1-${b + 0.2} 2.4-${b + 0.2} 4.6" ${S} stroke-width="${w}"/><circle cx="${x}" cy="17.3" r="1.6" fill="${D}"/>`;

function polygon(n, r, dreh) {
  const p = [];
  for (let i = 0; i < n; i++) { const a = (dreh + i * 360 / n) * Math.PI / 180; p.push((12 + r * Math.cos(a)).toFixed(2) + ',' + (12 + r * Math.sin(a)).toFixed(2)); }
  return p.join(' ');
}

// fuellung: Farbwert oder 'var(--k-...)'
export function form(id, fuellung) {
  const st = `style="fill:${fuellung}" stroke="${D}" stroke-width="1.6" stroke-linejoin="round"`;
  if (id === 'brillant') return `<path d="M12 .9 23.1 12 12 23.1.9 12z" ${st}/>`;
  if (id === 'stark') return `<polygon points="${polygon(6, 11.2, -90)}" ${st}/>`;
  if (id === 'patzer') return `<polygon points="${polygon(8, 11.4, 22.5)}" ${st}/>`;
  return `<circle cx="12" cy="12" r="10.9" ${st}/>`;
}

export function zeichen(id, fuellung = '#ff5fc8') {
  switch (id) {
    case 'brillant': return ausruf(9.6, 2.4, 7.4, 12.4, 16.2, 1.45) + ausruf(14.4, 2.4, 7.4, 12.4, 16.2, 1.45) + `<path d="M19.6 2.2l.7 1.7 1.7.7-1.7.7-.7 1.7-.7-1.7-1.7-.7 1.7-.7z" fill="#fff"/>`;
    case 'stark': return ausruf(12, 2.9);
    case 'bester': return `<circle cx="12" cy="12" r="2.2" fill="${D}"/><path d="M12 5v4M12 15v4M5 12h4M15 12h4" ${S} stroke-width="2"/>`;
    case 'exzellent': return `<path d="m6.5 12.5 3.5 3.6 7.7-8" ${S} stroke-width="2.8"/>`;
    case 'gut': return `<path d="M7 9.5h10M7 14.5h10" ${S} stroke-width="2.7"/>`;
    case 'buch': return `<path d="M8 5.8h8v12.8l-4-3.3-4 3.3z" fill="${D}" stroke="${D}" stroke-width="1.2" stroke-linejoin="round"/>`;
    case 'ungenau': return frage(9.3, 2.4, 2.7) + ausruf(16, 2.5);
    case 'fehler': return frage(12, 2.8, 3.2);
    case 'verpasst': return `<path d="M12 10c-1.5-4.8-7-4.5-5.8-1 .7 2 3.4 1.5 5.8.5 2.4 1 5.1 1.5 5.8-.5 1.2-3.5-4.3-3.8-5.8 1zM6 11h12v8H6zM12 10v9" ${S} stroke-width="2"/>`;
    case 'patzer': return frage(8.7, 2.4, 2.6) + frage(15.3, 2.4, 2.6);
    case 'erzwungen': return `<path d="M6 12h11M13 7.6 17.4 12 13 16.4" ${S} stroke-width="2.7"/>`;
  }
  return '';
}

// Komplettes Symbol als <symbol> (Farbe per CSS-Variable) oder als eigenstaendiges SVG
export function symbolSprite() {
  return KLASSEN.map(k => `<symbol id="k-${k.id}" viewBox="0 0 24 24"><g style="color:var(--kg-${k.id})">${form(k.id, `var(--k-${k.id})`)}${zeichen(k.id, `var(--k-${k.id})`)}</g></symbol>`).join('\n');
}
export function symbolDatei(k) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" role="img" aria-label="${k.name}"><title>${k.name}</title>${form(k.id, k.farbe)}${zeichen(k.id, k.farbe)}</svg>\n`;
}

// Zeichen der Variante A (Linien in currentColor, 24er-Raster)
const L = (w = 2.2) => `fill="none" stroke="${D}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;
const text = (t) => `<text x="12" y="16.3" text-anchor="middle" fill="${D}" font-size="${t.length > 1 ? 10.5 : 12.5}" font-weight="800" `
  + `letter-spacing="-.5" font-family="Manrope, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif">${t}</text>`;
const RUHIG = {
  brillant: text('!!'),
  stark: text('!'),
  bester: `<path d="M12 5.2l2 4.2 4.6.6-3.4 3.1.9 4.5L12 15.4l-4.1 2.2.9-4.5L5.4 10l4.6-.6z" fill="${D}"/>`,
  exzellent: `<path d="M7.5 13.5L12 9l4.5 4.5M7.5 17.5L12 13l4.5 4.5" ${L()}/>`,
  gut: `<path d="M7 12.5l3.2 3.2L17 9" ${L()}/>`,
  buch: `<path d="M12 8.2c-1.6-1.2-3.6-1.5-5.5-1.2v9.5c1.9-.3 3.9 0 5.5 1.2 1.6-1.2 3.6-1.5 5.5-1.2V7c-1.9-.3-3.9 0-5.5 1.2zM12 8.2v9.3" ${L(1.8)}/>`,
  ungenau: text('?!'),
  fehler: text('?'),
  verpasst: `<path d="M8.5 8.5l7 7M15.5 8.5l-7 7" ${L()}/>`,
  patzer: text('??'),
  erzwungen: `<path d="M6.5 12h10M12.5 8l4 4-4 4" ${L()}/>`,
};
// Kachel: deckender Grund (Flaeche), darueber die Klassenfarbe getoent; so bleibt das Zeichen auch auf dem Brett lesbar.
// Flo 30.10. abends ("die Symbole muessen bisschen staerker sein"): Toenung .16 -> .30, Rand .28 -> .65
const kachel = (id, farbe) => `<rect x="1" y="1" width="22" height="22" rx="7" style="fill:var(--flaeche, #fff)"/>`
  + `<rect x="1" y="1" width="22" height="22" rx="7" style="fill:var(--k-${id}, ${farbe}); fill-opacity:.3"/>`
  + `<rect x="1.6" y="1.6" width="20.8" height="20.8" rx="6.4" fill="none" style="stroke:var(--k-${id}, ${farbe}); stroke-opacity:.65" stroke-width="1.3"/>`;

// Fertige SVG-Texte je Klasse fuer board.js setzeSymbole(); Farbe ueber die CSS-Variablen
// (mit Ersatzwert, falls die Variable fehlt).
export const SYMBOLE = Object.fromEntries(KLASSEN.map((k) => [k.id,
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" style="color:var(--kt-${k.id}, #1C1B19)">${kachel(k.id, k.farbe)}${RUHIG[k.id]}</svg>`]));

// Deutscher Anzeigename je Klasse
export { KLASSEN_NAME };
