// Material-Proben auf der klassischen Form (R19 14.11.2026, Flo fand die 20 eigenen Entwuerfe "ganz haesslich"): die
// Umrisse kommen unveraendert aus dem Standardsatz "cburnett" (assets/pieces/<w|b><Figur>.svg, Colin M.L. Burnett, GPLv2
// oder neuer), darum steht auch jede Probe unter GPLv2 oder neuer. Neu ist nur das Material: Koerper mit Verlauf (Licht
// von links oben), Glanz und Spiegelstreif, Schatten unten am Koerper, Umriss mit Verlauf, weicher Bodenschatten, beim
// Marmor Adern. Schwarz nimmt die schwarze cburnett-Datei: dunkler Umriss aussen, die hellen Innenlinien (#ececec)
// werden zur Glanzkante im Material (licht). So bleibt jede schwarze Figur auch mit vielen Innenlinien dunkel.
// Nur Entwurf: Ziel ist design/figuren-material/<probe>/, nicht assets/pieces/ (kein Eintrag in js/figurensatz.js).
//   node werkzeuge/figuren-material.mjs    schreibt alle Proben aus PROBEN
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ZIEL = path.join(WURZEL, 'design/figuren-material');
const FIGUREN = ['K', 'Q', 'R', 'B', 'N', 'P'];

// Material je Farbe: koerper = Verlaufsstufen [Ort, Farbe, Deckkraft], kante = Umriss oben links -> unten rechts,
// auge = Springer-Auge (nur Weiss), licht = helle Innenlinien (nur Schwarz), glanz = Deckkraft des Lichts,
// streif = Spiegelstreif, adern = Marmor-Adern (Farbe, Deckkraft)
const PROBEN = {
  'gold-elfenbein': {
    name: 'Gold und Elfenbein',
    w: { koerper: [[0, '#fffefa'], [0.4, '#faf4e6'], [0.8, '#efe5cd'], [1, '#d8c49e']], kante: ['#5e4526', '#2b1d0b'], auge: '#2b1d0b',
      glanz: 0.6, streif: 0.35 },
    b: { koerper: [[0, '#e8c055'], [0.28, '#b07714'], [0.62, '#704306'], [1, '#3c2402']], kante: ['#3d2904', '#140c01'], licht: '#cf9f3e',
      glanz: 0.55, streif: 0.7 },
  },
  glas: {
    name: 'Glas',
    w: { koerper: [[0, '#ffffff', 0.94], [0.4, '#eef6fb', 0.8], [0.8, '#c4dbea', 0.84], [1, '#8fb0c8', 0.92]], kante: ['#3e6280', '#132536'],
      auge: '#132536', glanz: 0.7, streif: 0.9 },
    b: { koerper: [[0, '#6f6963', 0.8], [0.35, '#403b36', 0.86], [0.75, '#211e1b', 0.91], [1, '#0c0b0a', 0.95]], kante: ['#2a2622', '#000'],
      licht: '#c9c3bb', glanz: 0.35, streif: 0.6 },
  },
  marmor: {
    name: 'Marmor',
    w: { koerper: [[0, '#ffffff'], [0.4, '#f4f4f2'], [0.8, '#dcdcd7'], [1, '#aaaaa3']], kante: ['#53575d', '#24262a'], auge: '#24262a',
      glanz: 0.45, streif: 0.25, adern: ['#7d848c', 0.6] },
    b: { koerper: [[0, '#4b4b4e'], [0.35, '#2b2b2d'], [0.75, '#161617'], [1, '#050505']], kante: ['#1e1e20', '#000'], licht: '#b9b9b4',
      glanz: 0.3, streif: 0.35, adern: ['#f2f0ea', 0.8] },
  },
};

// Adern im 45er-Feld, je Figur leicht versetzt, damit nicht alle Figuren dasselbe Muster tragen
const ADERN = ['M3 31C10 27 15 33 22 28S34 19 42 23', 'M7 13c5 4 8 2 13 8s9 4 15 9', 'M17 41c2-6 6-8 8-13s5-7 7-12',
  'M22 28c1 3 4 4 5 7', 'M12 20c3 1 4 4 7 4'];

function figur(form, farbe, m, id) {
  // Weiss: Koerper fill="#fff", Auge fill="#000". Schwarz: Koerper fill="#000" oder ohne fill (erbt Schwarz, darum die
  // Huelle <g fill=...>), Innenlinien und Maehne #ececec.
  const innen = form.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').trim();
  const fuell = farbe === 'w' ? /fill="#fff"/g : /fill="#000"/g;
  const detail = farbe === 'w' ? /fill="#000"/g : /fill="#ececec"/g;
  const koerper = `<g fill="url(#${id}k)">` + innen.replace(fuell, `fill="url(#${id}k)"`).replace(detail, 'fill="none"')
    .replace(/stroke="(#000|#ececec)"/g, 'stroke="none"') + '</g>';
  const maske = '<g fill="#fff">' + innen.replace(fuell, 'fill="#fff"').replace(detail, 'fill="none"')
    .replace(/stroke="(#000|#ececec)"/g, 'stroke="#fff"') + '</g>';
  const umriss = '<g fill="none">' + innen.replace(fuell, 'fill="none"').replace(detail, `fill="${m.auge || m.licht}"`)
    .replace(/stroke="#000"/g, `stroke="url(#${id}r)"`).replace(/stroke="#ececec"/g, `stroke="${m.licht}"`)
    .replace(/stroke-width="1.5"/g, 'stroke-width="1"') + '</g>';
  const stufen = m.koerper.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}"${a < 1 ? ` stop-opacity="${a}"` : ''}/>`).join('');
  const versatz = 'wb'.indexOf(farbe) * 3 + FIGUREN.indexOf(id[1]) * 2.5 - 6;
  // Ader = weicher, breiter Schleier (unscharf) plus feine Linie darauf; ohne den Schleier wirken sie wie Kratzer
  const adern = m.adern ? `<g fill="none" stroke="${m.adern[0]}" stroke-linecap="round" transform="translate(${versatz} ${-versatz / 2})">`
    + `<g stroke-opacity="${(m.adern[1] / 2.5).toFixed(2)}" stroke-width="1.6" filter="url(#${id}w)">${ADERN.slice(0, 3).map((d) => `<path d="${d}"/>`).join('')}</g>`
    + `<g stroke-opacity="${m.adern[1]}">${ADERN.map((d, i) => `<path d="${d}" stroke-width="${i < 3 ? 0.3 : 0.18}"/>`).join('')}</g></g>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="45" height="45" viewBox="0 0 45 45">`
    + `<!-- Form: cburnett (Colin M.L. Burnett, GPLv2 oder neuer), Material: werkzeuge/figuren-material.mjs -->`
    + `<defs><linearGradient id="${id}k" x1="0" y1="0" x2="1" y2=".35">${stufen}</linearGradient>`
    + `<linearGradient id="${id}r" gradientUnits="userSpaceOnUse" x1="6" y1="5" x2="39" y2="41"><stop offset="0" stop-color="${m.kante[0]}"/><stop offset="1" stop-color="${m.kante[1]}"/></linearGradient>`
    + `<linearGradient id="${id}g" gradientUnits="userSpaceOnUse" x1="8" y1="6" x2="30" y2="32"><stop offset="0" stop-color="#fff" stop-opacity="${m.glanz}"/><stop offset=".45" stop-color="#fff" stop-opacity="${(m.glanz / 4).toFixed(2)}"/><stop offset=".75" stop-color="#fff" stop-opacity="0"/></linearGradient>`
    + `<linearGradient id="${id}s" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="45" y2="0"><stop offset=".3" stop-color="#fff" stop-opacity="0"/><stop offset=".345" stop-color="#fff" stop-opacity="${m.streif}"/><stop offset=".4" stop-color="#fff" stop-opacity="0"/></linearGradient>`
    + `<linearGradient id="${id}u" gradientUnits="userSpaceOnUse" x1="0" y1="24" x2="0" y2="40"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></linearGradient>`
    + `<radialGradient id="${id}b" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#000" stop-opacity=".38"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>`
    + (m.adern ? `<filter id="${id}w" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation=".7"/></filter>` : '')
    + `<mask id="${id}m" maskUnits="userSpaceOnUse" x="0" y="0" width="45" height="45">${maske}</mask></defs>`
    + `<ellipse cx="22.5" cy="39.4" rx="15" ry="2.8" fill="url(#${id}b)"/>`
    + `<g>${koerper}</g>`
    + `<g mask="url(#${id}m)">${adern}<rect width="45" height="45" fill="url(#${id}u)"/><rect width="45" height="45" fill="url(#${id}g)"/><rect width="45" height="45" fill="url(#${id}s)"/></g>`
    + `<g>${umriss}</g></svg>\n`;
}

for (const [probe, material] of Object.entries(PROBEN)) {
  const ordner = path.join(ZIEL, probe);
  mkdirSync(ordner, { recursive: true });
  for (const farbe of ['w', 'b']) {
    for (const f of FIGUREN) {
      const form = readFileSync(path.join(WURZEL, 'assets/pieces', `${farbe}${f}.svg`), 'utf8');
      writeFileSync(path.join(ordner, `${farbe}${f}.svg`), figur(form, farbe, material[farbe], `${farbe}${f}`));
    }
  }
  console.log(`${probe}: 12 Figuren (${material.name})`);
}
