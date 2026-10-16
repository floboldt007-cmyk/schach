// Erzeugt die 10 Pixel-Avatare (16x16) als SVG nach design/neon/avatare/.
// Aufruf: node design/neon/werkzeug/baue-avatare.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ZIEL = join(dirname(fileURLToPath(import.meta.url)), '..', 'avatare');
mkdirSync(ZIEL, { recursive: true });

const N = 16;
const UMRISS = '#120f26';
const HAUT = '#f6c9a2', HAUT2 = '#dd9d77', WANGE = '#ff8fa8', AUGE = '#120f26';

function leer() { return Array.from({ length: N }, () => Array(N).fill(null)); }
function px(g, x, y, c) { if (x >= 0 && x < N && y >= 0 && y < N) g[y][x] = c; }
function rect(g, x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px(g, x + i, y + j, c); }
function weg(g, x, y) { if (x >= 0 && x < N && y >= 0 && y < N) g[y][x] = null; }

// Grundkoerper: Kopf 8x8 (x4..11, y4..11), Hals, Schultern
function koerper(g, kleid, kleid2) {
  rect(g, 4, 4, 8, 8, HAUT); weg(g, 4, 4); weg(g, 11, 4); weg(g, 4, 11); weg(g, 11, 11);
  rect(g, 6, 12, 4, 1, HAUT2);
  rect(g, 2, 13, 12, 3, kleid); weg(g, 2, 13); weg(g, 13, 13);
  rect(g, 1, 14, 1, 2, kleid); rect(g, 14, 14, 1, 2, kleid);
  if (kleid2) { rect(g, 7, 13, 2, 3, kleid2); }
}
function gesicht(g, { augen = true, wangen = true, mund = 'laecheln' } = {}) {
  if (augen) { px(g, 6, 7, AUGE); px(g, 6, 8, AUGE); px(g, 9, 7, AUGE); px(g, 9, 8, AUGE); }
  if (wangen) { px(g, 5, 9, WANGE); px(g, 10, 9, WANGE); }
  if (mund === 'laecheln') { px(g, 6, 9, AUGE); px(g, 7, 10, AUGE); px(g, 8, 10, AUGE); px(g, 9, 9, AUGE); }
  if (mund === 'klein') { px(g, 7, 10, AUGE); px(g, 8, 10, AUGE); }
  if (mund === 'grinsen') { px(g, 5, 10, AUGE); rect(g, 6, 11, 4, 1, AUGE); px(g, 10, 10, AUGE); rect(g, 6, 10, 4, 1, '#ffffff'); }
}
// Umriss automatisch: jedes leere Feld neben einem gefuellten wird dunkel
function umriss(g) {
  const o = leer();
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (g[y][x]) continue;
    const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => g[y + dy]?.[x + dx] && g[y + dy][x + dx] !== UMRISS);
    if (nb) o[y][x] = UMRISS;
  }
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (o[y][x]) g[y][x] = o[y][x];
}
function zuSvg(g, titel) {
  let r = '';
  for (let y = 0; y < N; y++) {
    let x = 0;
    while (x < N) {
      const c = g[y][x];
      if (!c) { x++; continue; }
      let w = 1; while (x + w < N && g[y][x + w] === c) w++;
      r += `<rect x="${x}" y="${y}" width="${w}" height="1" fill="${c}"/>`;
      x += w;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 18 18" shape-rendering="crispEdges" role="img" aria-label="${titel}"><title>${titel}</title>${r}</svg>\n`;
}

const bots = [];

// 1 Bauer Benno: Strohhut, Grashalm, gruenes Hemd mit Latzhose
{ const g = leer(); koerper(g, '#4f9bff', '#7ee06a'); gesicht(g, { mund: 'grinsen' });
  rect(g, 5, 1, 6, 2, '#ffd86b'); rect(g, 5, 3, 6, 1, '#c9902b'); rect(g, 1, 4, 14, 1, '#ffd86b'); rect(g, 4, 4, 8, 1, '#ffd86b');
  rect(g, 11, 10, 3, 1, '#e8c24a'); px(g, 14, 9, '#e8c24a');
  rect(g, 3, 13, 2, 3, '#7ee06a'); rect(g, 11, 13, 2, 3, '#7ee06a');
  bots.push(['01-bauer-benno', 'Bauer Benno', g]); }

// 2 Oma Hilde: grauer Dutt, runde Brille, rosa Strickjacke
{ const g = leer(); koerper(g, '#ff9ed6', '#ffffff'); gesicht(g, { augen: false, mund: 'klein' });
  rect(g, 6, 0, 4, 3, '#d9dcef'); rect(g, 4, 3, 8, 2, '#d9dcef'); rect(g, 3, 4, 1, 6, '#d9dcef'); rect(g, 12, 4, 1, 6, '#d9dcef'); px(g, 4, 5, '#d9dcef'); px(g, 11, 5, '#d9dcef');
  px(g, 7, 1, '#b5b9d6');
  const B = '#a06bff', GL = '#d8f3ff';
  rect(g, 5, 6, 2, 1, B); rect(g, 9, 6, 2, 1, B); rect(g, 5, 8, 2, 1, B); rect(g, 9, 8, 2, 1, B);
  px(g, 4, 7, B); px(g, 7, 7, B); px(g, 8, 7, B); px(g, 11, 7, B);
  px(g, 5, 7, GL); px(g, 6, 7, AUGE); px(g, 9, 7, AUGE); px(g, 10, 7, GL);
  px(g, 5, 9, WANGE); px(g, 10, 9, WANGE);
  bots.push(['02-oma-hilde', 'Oma Hilde', g]); }

// 3 Kalle vom Stammtisch: Schiebermuetze, Schnurrbart, rote Nase, gelbes Trikot
{ const g = leer(); koerper(g, '#ffd23f', '#ffb000'); gesicht(g, { mund: 'keiner', wangen: false });
  rect(g, 4, 2, 8, 2, '#8a7a6a'); rect(g, 3, 3, 1, 1, '#8a7a6a'); rect(g, 4, 4, 10, 1, '#6c5d4f'); px(g, 12, 2, '#8a7a6a'); px(g, 6, 2, '#a3927f');
  rect(g, 7, 8, 2, 1, '#ff5a5a');
  rect(g, 5, 9, 6, 1, '#6b3f22'); px(g, 4, 10, '#6b3f22'); px(g, 11, 10, '#6b3f22'); px(g, 5, 10, '#6b3f22'); px(g, 10, 10, '#6b3f22');
  px(g, 7, 10, AUGE); px(g, 8, 10, AUGE);
  px(g, 5, 6, '#6b3f22'); px(g, 6, 6, '#6b3f22'); px(g, 9, 6, '#6b3f22'); px(g, 10, 6, '#6b3f22');
  bots.push(['03-kalle-vom-stammtisch', 'Kalle vom Stammtisch', g]); }

// 4 Lisa Laeufer: Pony, Pferdeschwanz, Stirnband, Kapuzenpulli
{ const g = leer(); koerper(g, '#5ad1ff', '#2a8fd6'); gesicht(g, { mund: 'laecheln' });
  const H = '#c1592e';
  rect(g, 4, 3, 8, 2, H); rect(g, 3, 4, 1, 5, H); rect(g, 12, 4, 1, 4, H); rect(g, 4, 5, 3, 1, H);
  rect(g, 4, 3, 8, 1, '#5ad1ff');
  rect(g, 13, 5, 2, 2, H); rect(g, 14, 7, 1, 3, H);
  bots.push(['04-lisa-laeufer', 'Lisa Läufer', g]); }

// 5 Ritter Rudi: Helm mit Visierschlitz und orangem Federbusch
{ const g = leer(); koerper(g, '#ff8a1e', '#b9c4da');
  const S = '#c4cde0', S2 = '#8e9ab5';
  rect(g, 4, 3, 8, 9, S); weg(g, 4, 3); weg(g, 11, 3); rect(g, 3, 5, 1, 6, S); rect(g, 12, 5, 1, 6, S);
  rect(g, 5, 7, 6, 1, '#120f26'); px(g, 6, 7, '#19f6e8'); px(g, 9, 7, '#19f6e8');
  rect(g, 7, 4, 2, 3, S2); rect(g, 7, 8, 2, 4, S2);
  px(g, 5, 9, S2); px(g, 5, 10, S2); px(g, 10, 9, S2); px(g, 10, 10, S2);
  rect(g, 8, 0, 3, 1, '#ff8a1e'); rect(g, 7, 1, 5, 1, '#ff8a1e'); rect(g, 7, 2, 3, 1, '#ffb15c'); px(g, 12, 2, '#ff8a1e'); px(g, 12, 1, '#ffb15c');
  rect(g, 5, 13, 6, 1, '#b9c4da');
  bots.push(['05-ritter-rudi', 'Ritter Rudi', g]); }

// 6 Professor Turm: Zinnen-Hut, Brille, weisser Bart
{ const g = leer(); koerper(g, '#8fa8ff', '#ffffff'); gesicht(g, { augen: false, wangen: false, mund: 'keiner' });
  const T = '#9aa3bf', T2 = '#6f7896';
  rect(g, 4, 0, 2, 2, T); rect(g, 7, 0, 2, 2, T); rect(g, 10, 0, 2, 2, T); rect(g, 4, 2, 8, 2, T); rect(g, 4, 3, 8, 1, T2); px(g, 6, 2, T2); px(g, 9, 2, T2);
  const W = '#f1f3fb';
  rect(g, 3, 5, 1, 4, W); rect(g, 12, 5, 1, 4, W);
  rect(g, 4, 9, 8, 3, W); rect(g, 5, 12, 6, 1, W); rect(g, 6, 13, 4, 1, W); px(g, 7, 10, '#c97a6a'); px(g, 8, 10, '#c97a6a');
  const B = '#120f26';
  rect(g, 5, 6, 2, 1, B); rect(g, 9, 6, 2, 1, B); rect(g, 7, 6, 2, 1, B);
  px(g, 5, 7, '#7fe9ff'); px(g, 6, 7, AUGE); px(g, 9, 7, AUGE); px(g, 10, 7, '#7fe9ff');
  rect(g, 5, 5, 2, 1, W); rect(g, 9, 5, 2, 1, W);
  bots.push(['06-professor-turm', 'Professor Turm', g]); }

// 7 Dame Delia: Krone, lange rote Haare, roter Mund
{ const g = leer(); koerper(g, '#ff2d78', '#ffd23f'); gesicht(g, { mund: 'keiner' });
  const H = '#ff5a3c', H2 = '#c8331f';
  rect(g, 4, 3, 8, 2, H); rect(g, 3, 4, 1, 9, H); rect(g, 12, 4, 1, 9, H); rect(g, 2, 8, 1, 5, H2); rect(g, 13, 8, 1, 5, H2); px(g, 4, 5, H); px(g, 11, 5, H); rect(g, 4, 11, 1, 2, H); rect(g, 11, 11, 1, 2, H);
  const K = '#ffd23f';
  rect(g, 5, 2, 6, 1, K); px(g, 5, 1, K); px(g, 8, 0, K); px(g, 7, 1, K); px(g, 8, 1, K); px(g, 10, 1, K); px(g, 8, 2, '#19f6e8');
  px(g, 7, 10, '#ff2d55'); px(g, 8, 10, '#ff2d55');
  px(g, 5, 6, AUGE); px(g, 10, 6, AUGE);
  bots.push(['07-dame-delia', 'Dame Delia', g]); }

// 8 Kommissar Koenig: Hut mit Kronen-Pin, Trenchcoat, Bartstoppeln, Lupe
{ const g = leer(); koerper(g, '#d9b36c', '#5a4632'); gesicht(g, { mund: 'klein', wangen: false });
  const HU = '#4a3b2b';
  rect(g, 5, 1, 6, 2, HU); rect(g, 4, 3, 8, 1, '#d9b36c'); rect(g, 2, 4, 12, 1, HU); px(g, 9, 3, '#ffd23f');
  px(g, 5, 7, AUGE); rect(g, 5, 7, 2, 1, AUGE); px(g, 6, 8, null); px(g, 6, 8, HAUT);
  px(g, 5, 10, '#b98e74'); px(g, 7, 11, '#b98e74'); px(g, 9, 11, '#b98e74'); px(g, 10, 10, '#b98e74');
  rect(g, 3, 13, 2, 1, '#f0d59c'); rect(g, 11, 13, 2, 1, '#f0d59c');
  const L = '#19f6e8';
  rect(g, 12, 9, 3, 1, L); rect(g, 12, 11, 3, 1, L); px(g, 12, 10, L); px(g, 14, 10, L); px(g, 13, 10, '#b8fffa'); px(g, 11, 12, '#8e9ab5'); px(g, 10, 13, '#8e9ab5');
  bots.push(['08-kommissar-koenig', 'Kommissar König', g]); }

// 9 Grossmeisterin Greta: schwarzer Bob, scharfe Augenbrauen, violetter Blazer
{ const g = leer(); koerper(g, '#a06bff', '#ffffff'); gesicht(g, { mund: 'klein', wangen: false });
  const H = '#2b2346', H2 = '#3e3466';
  rect(g, 4, 3, 8, 3, H); rect(g, 3, 4, 1, 8, H); rect(g, 12, 4, 1, 8, H); rect(g, 4, 10, 1, 2, H); rect(g, 11, 10, 1, 2, H); px(g, 5, 3, H2); px(g, 6, 3, H2);
  px(g, 5, 6, AUGE); px(g, 6, 6, null); px(g, 6, 6, HAUT); px(g, 10, 6, AUGE);
  rect(g, 5, 6, 2, 1, AUGE); rect(g, 9, 6, 2, 1, AUGE);
  px(g, 6, 8, '#a06bff'); px(g, 9, 8, '#a06bff');
  px(g, 13, 10, '#ffd23f');
  rect(g, 5, 13, 1, 3, '#7b4bd6'); rect(g, 10, 13, 1, 3, '#7b4bd6');
  bots.push(['09-grossmeisterin-greta', 'Großmeisterin Greta', g]); }

// 10 Der Stockfisch: Fisch mit Krone und gluehendem Auge (Endgegner)
{ const g = leer();
  const F = '#19c9be', F2 = '#0e8f88', BA = '#9ff7ef';
  rect(g, 4, 6, 9, 7, F); rect(g, 5, 5, 7, 1, F); rect(g, 5, 13, 6, 1, F); rect(g, 13, 7, 1, 5, F); rect(g, 14, 8, 1, 3, F);
  rect(g, 5, 11, 8, 2, BA); rect(g, 6, 13, 4, 1, BA);
  rect(g, 0, 5, 2, 1, F2); rect(g, 0, 6, 3, 2, F2); rect(g, 1, 8, 3, 3, F2); rect(g, 0, 11, 3, 2, F2); rect(g, 0, 13, 2, 1, F2);
  rect(g, 6, 3, 4, 2, F2); px(g, 7, 2, F2);
  rect(g, 10, 7, 2, 2, '#ffffff'); px(g, 11, 8, '#ff2d78'); px(g, 11, 7, '#ff2d78');
  px(g, 8, 7, F2); px(g, 8, 8, F2); px(g, 8, 9, F2); px(g, 7, 10, F2);
  px(g, 6, 7, '#5ff5ea'); px(g, 5, 9, '#5ff5ea');
  rect(g, 12, 10, 3, 1, '#120f26'); px(g, 13, 11, '#ffffff');
  const K = '#ffd23f';
  rect(g, 10, 4, 4, 1, K); px(g, 10, 3, K); px(g, 12, 3, K); px(g, 13, 3, K); px(g, 12, 2, K); px(g, 12, 3, '#ff2d78');
  bots.push(['10-der-stockfisch', 'Der Stockfisch', g]); }

for (const [datei, titel, g] of bots) { umriss(g); writeFileSync(join(ZIEL, datei + '.svg'), zuSvg(g, titel)); }
console.log('Avatare geschrieben:', bots.length);
