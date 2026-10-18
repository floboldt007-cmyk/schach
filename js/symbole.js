import { ZUGKLASSEN, KLASSEN_NAME } from './zugklassen.js';

// Die 11 Zug-Klassen-Symbole.
// Form verraet die Gruppe (Diamant = brillant, Sechseck = stark, Achteck = grober Fehlzug,
// Kreis = alles andere), das Zeichen die Klasse. Zeichen immer dunkel (#0a0b18).
// Nutzung: setzeSymbole(SYMBOLE) aus board.js einmal beim Start; danach liefert
// symbolSvg(klasse) aus board.js das Symbol auch fuer Coach-Zeile und Zugliste.

const FARBEN = ['#7A4FD6', '#2F67D8', '#14936A', '#5E9C4E', '#7F928A', '#A07A52', '#D6A21C', '#DD7A2A', '#B4468F', '#BC2A4C', '#878E9E'];
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

// Fertige SVG-Texte je Klasse fuer board.js setzeSymbole(); Farbe ueber die CSS-Variable
// (mit Ersatzwert, falls die Variable fehlt).
export const SYMBOLE = Object.fromEntries(KLASSEN.map((k) => [k.id,
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" style="color:var(--kg-${k.id}, #1C1B19)">${form(k.id, `var(--k-${k.id}, ${k.farbe})`)}${zeichen(k.id, `var(--k-${k.id}, ${k.farbe})`)}</svg>`]));

// Deutscher Anzeigename je Klasse
export { KLASSEN_NAME };
