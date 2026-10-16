// Die 11 Zug-Klassen-Symbole (Design "Neon-Arena", Quelle design/neon/werkzeug/symbole.mjs).
// Form verraet die Gruppe (Diamant = brillant, Sechseck = stark, Achteck = Patzer,
// Kreis = alles andere), das Zeichen die Klasse. Zeichen immer dunkel (#0a0b18).
// Nutzung: setzeSymbole(SYMBOLE) aus board.js einmal beim Start; danach liefert
// symbolSvg(klasse) aus board.js das Symbol auch fuer Coach-Zeile und Zugliste.

export const KLASSEN = [
  { id: 'brillant',  name: 'Brillant',        kurz: '!!', farbe: '#19f6e8' },
  { id: 'stark',     name: 'Großartig',       kurz: '!',  farbe: '#a06bff' },
  { id: 'bester',    name: 'Bester Zug',      kurz: '★',  farbe: '#3ef08a' },
  { id: 'exzellent', name: 'Exzellent',       kurz: '⌃⌃', farbe: '#b4ec5c' },
  { id: 'gut',       name: 'Gut',             kurz: '⌃',  farbe: '#8fbcaa' },
  { id: 'buch',      name: 'Buchzug',         kurz: 'B',  farbe: '#d6a874' },
  { id: 'ungenau',   name: 'Ungenau',         kurz: '?!', farbe: '#ffd23f' },
  { id: 'fehler',    name: 'Fehler',          kurz: '?',  farbe: '#ff8a1e' },
  { id: 'verpasst',  name: 'Chance verpasst', kurz: 'Ø',  farbe: '#ff5fc8' },
  { id: 'patzer',    name: 'Patzer',          kurz: '??', farbe: '#ff2d4d' },
  { id: 'erzwungen', name: 'Erzwungen',       kurz: '→',  farbe: '#9aa4c8' },
];

const D = '#0a0b18';
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
    case 'bester': return `<path d="M6.2 16.6 5.2 8.6l4 3.2L12 6.4l2.8 5.4 4-3.2-1 8z" fill="${D}" stroke="${D}" stroke-width="1.2" stroke-linejoin="round"/><path d="M6.6 18.4h10.8" ${S} stroke-width="1.8"/>`;
    case 'exzellent': return `<path d="M7 12.4 12 7.6l5 4.8M7 17.2l5-4.8 5 4.8" ${S} stroke-width="2.6"/>`;
    case 'gut': return `<path d="M6.8 14.6 12 9.4l5.2 5.2" ${S} stroke-width="2.9"/>`;
    case 'buch': return `<path d="M8 5.8h8v12.8l-4-3.3-4 3.3z" fill="${D}" stroke="${D}" stroke-width="1.2" stroke-linejoin="round"/>`;
    case 'ungenau': return frage(9.3, 2.4, 2.7) + ausruf(16, 2.5);
    case 'fehler': return frage(12, 2.8, 3.2);
    case 'verpasst': return `<path d="M4.6 12c2.6-4.4 12.2-4.4 14.8 0-2.6 4.4-12.2 4.4-14.8 0z" ${S} stroke-width="2.2"/><circle cx="12" cy="12" r="2.3" fill="${D}"/><path d="M6.4 17.6 17.6 6.4" style="stroke:${fuellung}" stroke-width="4.2" stroke-linecap="round"/><path d="M6.4 17.6 17.6 6.4" ${S} stroke-width="2.2"/>`;
    case 'patzer': return frage(8.7, 2.4, 2.6) + frage(15.3, 2.4, 2.6);
    case 'erzwungen': return `<path d="M6 12h11M13 7.6 17.4 12 13 16.4" ${S} stroke-width="2.7"/>`;
  }
  return '';
}

// Komplettes Symbol als <symbol> (Farbe per CSS-Variable) oder als eigenstaendiges SVG
export function symbolSprite() {
  return KLASSEN.map(k => `<symbol id="k-${k.id}" viewBox="0 0 24 24">${form(k.id, `var(--k-${k.id})`)}${zeichen(k.id, `var(--k-${k.id})`)}</symbol>`).join('\n');
}
export function symbolDatei(k) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" role="img" aria-label="${k.name}"><title>${k.name}</title>${form(k.id, k.farbe)}${zeichen(k.id, k.farbe)}</svg>\n`;
}

// Fertige SVG-Texte je Klasse fuer board.js setzeSymbole(); Farbe ueber die CSS-Variable
// (mit Ersatzwert, falls die Variable fehlt).
export const SYMBOLE = Object.fromEntries(KLASSEN.map((k) => [k.id,
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">${form(k.id, `var(--k-${k.id}, ${k.farbe})`)}${zeichen(k.id, `var(--k-${k.id}, ${k.farbe})`)}</svg>`]));

// Deutscher Anzeigename je Klasse
export const KLASSEN_NAME = Object.fromEntries(KLASSEN.map((k) => [k.id, k.name]));
