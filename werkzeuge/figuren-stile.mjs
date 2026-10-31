// Figurensaetze mit eigenem Stil fuers Labor (Flo 31.10.2026 abends: "Mach coole Figur-Designs ... und tu die in mein
// Konto"). Nichts uebernommen von anderen Schachseiten: Pixel und Geo sind eigene Zeichnungen (Raster und Grundformen
// unten, GPL-3.0 wie das Projekt). Die gedrechselten Saetze (Neon, Glas, Holz, Elfenbein, Marmor, Gold, Frost, Kuerbis)
// zeichnet werkzeuge/figuren-3d.mjs.
// Welche Saetze nur der Erfinder sieht, steht in js/labor.js (LABOR_FIGUREN).
//   node werkzeuge/figuren-stile.mjs    schreibt assets/pieces/{pixel,geo}/*.svg neu
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const QUELLE = path.join(WURZEL, 'assets/pieces');
const FIGUREN = ['K', 'Q', 'R', 'B', 'N', 'P'];
const kopf = (defs, inhalt) => `<svg xmlns="http://www.w3.org/2000/svg" width="45" height="45" viewBox="0 0 45 45">${defs ? `<defs>${defs}</defs>` : ''}${inhalt}</svg>\n`;

// ---------- Pixel: eigene 8-Bit-Zeichnungen, 16 x 16 ----------
// o Umriss, f Flaeche, h Licht, s Schatten, . leer
const PIXEL = {
  P: ['................', '................', '................', '......oooo......', '.....ohhffo.....', '....ohfffffo....',
    '....offfffso....', '.....offffo.....', '......oooo......', '.....ohfffo.....', '......offo......', '.....offfso.....',
    '....offffffo....', '...ohffffffso...', '...oooooooooo...', '................'],
  R: ['................', '................', '...ooo.oo.ooo...', '...ofo.oo.ofo...', '...offoffoffo...', '...ohffffffso...',
    '....offffffo....', '....ohfffffo....', '....offffffo....', '....ohfffffo....', '....offffffo....', '...offffffffo...',
    '...ohfffffffso..'.slice(0, 16), '..offffffffffso.'.slice(0, 16), '..oooooooooooooo'.slice(0, 16), '................'],
  B: ['................', '.......oo.......', '......ohfo......', '.......oo.......', '......offo......', '.....ohffoo.....',
    '....ohffoffo....', '....offofffo....', '....offffffo....', '.....offfso.....', '......oooo......', '.....offffo.....',
    '......offo......', '....ohffffso....', '...oooooooooo...', '................'],
  N: ['................', '......o.o.......', '.....ofofo......', '....offffoo.....', '...offofffffo...', '..ohffffffffso..',
    '..offfoo.offfo..', '...oo....offfo..', '........offffo..', '.......offffso..', '......offffffo..', '......ohfffffo..',
    '.....offffffffo.', '....ohffffffffso'.slice(0, 16), '....oooooooooooo'.slice(0, 16), '................'],
  Q: ['.o....o..o....o.', 'ofo..ofoofo..ofo', '.o.o..o..o..o.o.', '..ofo.o..o.ofo..', '..offofoofoffo..', '...offffffffo...',
    '...ohffffffso...', '....offffffo....', '.....offffo.....', '.....ohffso.....', '....offffffo....', '.....offffo.....',
    '....ohffffffo...'.slice(0, 16), '...offffffffso..', '...oooooooooooo.', '................'],
  K: ['.......oo.......', '......offo......', '.....offffo.....', '......offo......', '.......oo.......', '....oo.oo.oo....',
    '...ofooffoofo...', '...ohffffffso...', '....offffffo....', '....ohffffso....', '.....offffo.....', '....offffffo....',
    '....ohffffffo...'.slice(0, 16), '...offffffffso..', '...oooooooooooo.', '................'],
};
const PIXEL_FARBEN = {
  w: { o: '#24222B', f: '#F3EEDF', h: '#FFFFFF', s: '#C7BEA8' },
  b: { o: '#0C0B10', f: '#3C3848', h: '#5E5870', s: '#26232F' },
};
function pixel(fig, weiss) {
  const farben = PIXEL_FARBEN[weiss ? 'w' : 'b'];
  const rechtecke = [];
  PIXEL[fig].forEach((zeile, y) => {
    let x = 0;
    while (x < 16) {
      const c = zeile[x] || '.';
      if (c === '.' || !farben[c]) { x++; continue; }
      let n = 1;
      while (x + n < 16 && zeile[x + n] === c) n++;
      rechtecke.push(`<rect x="${x}" y="${y}" width="${n}" height="1" fill="${farben[c]}"/>`);
      x += n;
    }
  });
  // 16er-Raster mittig in 45 x 45 (Rand 1,5), scharfe Kanten
  return kopf('', `<g transform="translate(1.5 1.5) scale(2.625)" shape-rendering="crispEdges">${rechtecke.join('')}</g>`);
}

// ---------- Geo: eigene flache Formen ----------
const GEO_FARBEN = {
  w: { f: '#F7F2E8', l: '#2F2A35', d: '#2F2A35', s: '#E2D9C8' },
  b: { f: '#35303D', l: '#0F0D12', d: '#E9E2D4', s: '#24202B' },
};
const SOCKEL = (c) => `<rect x="9.5" y="36" width="26" height="5" rx="2.2" fill="${c.f}" stroke="${c.l}"/><path d="M11 38.5h23" stroke="${c.s}" stroke-width="1.2"/>`;
const GEO = {
  P: (c) => `${SOCKEL(c)}<path d="M15.5 36 19 25h7l3.5 11z" fill="${c.f}" stroke="${c.l}"/><rect x="17" y="22" width="11" height="3.2" rx="1.6" fill="${c.f}" stroke="${c.l}"/><circle cx="22.5" cy="16" r="5.6" fill="${c.f}" stroke="${c.l}"/><circle cx="20.6" cy="14.2" r="1.4" fill="${c.s}"/>`,
  R: (c) => `${SOCKEL(c)}<path d="M14 36l1.5-18h14L31 36z" fill="${c.f}" stroke="${c.l}"/><path d="M12.5 18V9.5h4v3.5h4V9.5h4v3.5h4V9.5h4V18z" fill="${c.f}" stroke="${c.l}" stroke-linejoin="round"/><path d="M16 23h13M15.6 29h13.8" stroke="${c.d}" stroke-width="1.1"/>`,
  B: (c) => `${SOCKEL(c)}<path d="M16 36l2.5-7h8l2.5 7z" fill="${c.f}" stroke="${c.l}"/><rect x="16.5" y="26.5" width="12" height="3" rx="1.5" fill="${c.f}" stroke="${c.l}"/><path d="M22.5 7.5C29.5 13 30.5 20.5 22.5 26.5 14.5 20.5 15.5 13 22.5 7.5z" fill="${c.f}" stroke="${c.l}"/><path d="M24.6 13.2l-4.3 5.6" stroke="${c.d}" stroke-width="1.6" stroke-linecap="round"/><circle cx="22.5" cy="6" r="2.1" fill="${c.f}" stroke="${c.l}"/>`,
  N: (c) => `${SOCKEL(c)}<path d="M14.5 36c0-6 1.5-9 5-12.5l-6 1.6c-2.2.4-3.6-1.4-2.6-3.2l5.6-8.4c1.4-2.1 3.4-3.6 5.8-4.2L23 6l2.6 3.3C32 11 34 18 33 36z" fill="${c.f}" stroke="${c.l}" stroke-linejoin="round"/><circle cx="19.2" cy="15.6" r="1.5" fill="${c.d}"/><path d="M26.5 12.5c2.8 3.2 4 9 3.8 16" fill="none" stroke="${c.d}" stroke-width="1.2" stroke-linecap="round"/>`,
  Q: (c) => `${SOCKEL(c)}<path d="M14.5 36l2.5-9h11l2.5 9z" fill="${c.f}" stroke="${c.l}"/><path d="M12 27l-1.5-13 6.5 6 5.5-10.5 5.5 10.5 6.5-6L33 27z" fill="${c.f}" stroke="${c.l}" stroke-linejoin="round"/><g fill="${c.f}" stroke="${c.l}"><circle cx="10.5" cy="12.5" r="2"/><circle cx="22.5" cy="8" r="2"/><circle cx="34.5" cy="12.5" r="2"/></g><path d="M14 23.5h17" stroke="${c.d}" stroke-width="1.1"/>`,
  K: (c) => `${SOCKEL(c)}<path d="M14.5 36l2.5-10h11l2.5 10z" fill="${c.f}" stroke="${c.l}"/><path d="M12.5 26c0-6.5 4.5-11 10-11s10 4.5 10 11z" fill="${c.f}" stroke="${c.l}"/><path d="M22.5 4v10M18.5 8h8" stroke="${c.l}" stroke-width="3.4" stroke-linecap="round"/><path d="M22.5 4v10M18.5 8h8" stroke="${c.f}" stroke-width="1.4" stroke-linecap="round"/><path d="M15.5 21.5h14" stroke="${c.d}" stroke-width="1.1"/>`,
};
function geo(fig, weiss) {
  const c = GEO_FARBEN[weiss ? 'w' : 'b'];
  return kopf('', `<g stroke-width="1.5" stroke-linejoin="round">${GEO[fig](c)}</g>`);
}

export const STILE = Object.freeze({
  pixel: (fig, weiss) => pixel(fig, weiss),
  geo: (fig, weiss) => geo(fig, weiss),
});

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  for (const [satz, bau] of Object.entries(STILE)) {
    const ziel = path.join(QUELLE, satz);
    mkdirSync(ziel, { recursive: true });
    for (const f of FIGUREN) {
      for (const c of ['w', 'b']) {
        const quelle = readFileSync(path.join(QUELLE, `${c}${f}.svg`), 'utf8');
        writeFileSync(path.join(ziel, `${c}${f}.svg`), bau(f, c === 'w', quelle));
      }
    }
  }
  console.log(`${Object.keys(STILE).length * 12} Figuren geschrieben: assets/pieces/{${Object.keys(STILE).join(',')}}/`);
}
