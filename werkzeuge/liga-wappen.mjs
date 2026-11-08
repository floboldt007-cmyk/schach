// Wappen der Kronen-Liga (Umbau Wochen-Gruppen 07.11.2026, Entwurf "Liga-Wappen", Reihe B "Die Figuren"):
// Schild in der Farbe der Liga (Holz bis Krone), darin die Figur; je hoeher, desto edler (Turm mit Fluegeln, Dame mit
// Schliff, Koenig mit Krone und Leuchten). Eigene einfache Formen, keine Figuren aus einem Satz.
//   node werkzeuge/liga-wappen.mjs        schreibt assets/liga/<liga>.svg (bauer, springer, laeufer, turm, dame, koenig)
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ZIEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'liga');

// Farben je Liga: Schild oben, Schild unten, Rand, Figur, Glanz
const FARBEN = {
  bauer: ['#B98656', '#7A4E2E', '#5E3B22', '#3F2716', '#E2B98E'],
  springer: ['#EDA56A', '#B4632F', '#8A4A22', '#5C2C12', '#FFD2A8'],
  laeufer: ['#F4F6FA', '#AEB5C2', '#7F889A', '#3E4656', '#FFFFFF'],
  turm: ['#FCE592', '#D9A93A', '#A97B1F', '#6B4C10', '#FFF6CF'],
  dame: ['#D8F3FF', '#76C1EC', '#3F94C6', '#164E73', '#FFFFFF'],
  koenig: ['#C1A6F6', '#7650D2', '#E3BC4E', '#F7D77E', '#EBDFFF'],
};

const SOCKEL = '<rect x="35" y="86" width="30" height="6" rx="3"/>';
const FIGUR = {
  bauer: '<circle cx="50" cy="52" r="7.5"/><path d="M44 60h12c0 6 3 12 7 18l2 6H35l2-6c4-6 7-12 7-18z"/>' + SOCKEL,
  springer: '<path d="M38 84l3-10c2-6 6-10 11-13l-6 1-6 4-4-3 3-6c3-6 7-10 13-12l2-6 4 5c9 2 15 9 16 18 1 8-1 15-6 22z"/>'
    + '<circle cx="51" cy="51" r="1.8" fill="var(--glanz)"/>' + SOCKEL,
  laeufer: '<circle cx="50" cy="43" r="3.4"/><path d="M50 47c-8 6-12 13-12 20 0 6 3 10 7 12l-3 5h16l-3-5c4-2 7-6 7-12 0-7-4-14-12-20z"/>'
    + '<path d="M53 57l-6 8" stroke="var(--glanz)" stroke-width="2.4" stroke-linecap="round" fill="none"/>' + SOCKEL,
  turm: '<path d="M36 46h6v6h5v-6h6v6h5v-6h6v12l-4 3v15l4 8H36l4-8V61l-4-3z"/>' + SOCKEL,
  dame: '<circle cx="35" cy="47" r="3.6"/><circle cx="50" cy="41" r="3.6"/><circle cx="65" cy="47" r="3.6"/>'
    + '<path d="M36 51l7 9 7-14 7 14 7-9-4 25-1 8H41l-1-8z"/>' + SOCKEL,
  koenig: '<path d="M47.5 36h5v5h5v5h-5v5h-5v-5h-5v-5h5z"/><path d="M38 84l2-14c-5-4-6-9-3-13 4-5 9-5 13 0 4-5 9-5 13 0 3 4 2 9-3 13l2 14z"/>' + SOCKEL,
};

// Schild 76 breit, oben flach mit zwei Ecken, unten spitz; Platz oben fuer die Krone (Koenig)
const SCHILD = 'M50 20 L86 30 V64 C86 90 69 106 50 114 C31 106 14 90 14 64 V30 Z';

function wappen(liga) {
  const [oben, unten, rand, figur, glanz] = FARBEN[liga];
  const id = 'w-' + liga;
  const extra = [];
  const defs = [`<linearGradient id="${id}-s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${oben}"/><stop offset="1" stop-color="${unten}"/></linearGradient>`];
  if (liga === 'turm') {
    // Fluegel links und rechts
    extra.push(`<path d="M14 34 L3 26 L8 44 L14 48 Z M86 34 L97 26 L92 44 L86 48 Z" fill="${unten}" stroke="${rand}" stroke-width="2" stroke-linejoin="round"/>`);
  }
  if (liga === 'dame') {
    // Schliff: helle Facetten im Schild
    extra.push(`<path d="M50 24 L82 33 L50 62 Z M50 24 L18 33 L50 62 Z" fill="#FFFFFF" opacity=".18"/>`);
  }
  if (liga === 'koenig') {
    defs.push(`<radialGradient id="${id}-l" cx=".5" cy=".55" r=".55"><stop offset="0" stop-color="#F7D77E" stop-opacity=".55"/><stop offset="1" stop-color="#F7D77E" stop-opacity="0"/></radialGradient>`);
    extra.push(`<circle cx="50" cy="66" r="48" fill="url(#${id}-l)"/>`);
  }
  const krone = liga === 'koenig'
    ? `<path d="M34 18 L38 4 L44 12 L50 2 L56 12 L62 4 L66 18 Z" fill="#F2C94C" stroke="#B5862A" stroke-width="1.6" stroke-linejoin="round"/>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 120" width="100" height="120" role="img" aria-hidden="true">
<defs>${defs.join('')}</defs>
${liga === 'koenig' ? extra.pop() : ''}${extra.join('')}
<path d="${SCHILD}" fill="url(#${id}-s)" stroke="${rand}" stroke-width="3.5" stroke-linejoin="round"/>
<path d="M50 26 L80 34 V64 C80 85 66 99 50 106" fill="none" stroke="${glanz}" stroke-width="2" opacity=".55" stroke-linecap="round"/>
<g fill="${figur}">${FIGUR[liga].replaceAll('var(--glanz)', glanz)}</g>
${krone}
</svg>
`;
}

mkdirSync(ZIEL, { recursive: true });
for (const liga of Object.keys(FIGUR)) {
  writeFileSync(path.join(ZIEL, liga + '.svg'), wappen(liga));
  console.log('geschrieben', path.join('assets', 'liga', liga + '.svg'));
}
