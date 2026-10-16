// Baut die App-Icons der Schach-Arena: Springer mit Neon-Verlauf auf Nachtblau (wie das Logo).
// Schreibt favicon.svg und rendert per Playwright (Chromium) die PNGs:
//   icon-192.png, icon-512.png          Zweck "any": abgerundetes Quadrat, Ecken durchsichtig
//   icon-maskable-512.png               Zweck "maskable": volle Flaeche, Springer in der Sicherheitszone
//   apple-touch-icon.png (180)          volle Flaeche, ohne Alphakanal (iOS rundet selbst)
//
//   node assets/icons/baue-icons.mjs            alles bauen
//   node assets/icons/baue-icons.mjs --nur-svg  nur favicon.svg (ohne Playwright)
//
// Playwright: PLAYWRIGHT_PFAD, sonst 'playwright', sonst /opt/node-tools/node_modules/playwright.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { writeFileSync } from 'node:fs';
import { deflateSync, inflateSync } from 'node:zlib';
import path from 'node:path';

const require = createRequire(import.meta.url);
const ORDNER = path.dirname(fileURLToPath(import.meta.url));

// ---------- Form ----------
// Springerkopf (nach links blickend) im 100er-Raster, Sockel darunter
const KOPF = 'M34 80C33 70 36 63 43 57C37 58 31 61 26 63C22 64.5 18 62.5 17 58.5C16 55 17 52 20 50'
  + 'L34 33C36 27 39 22 43 19L42 8.5L52 15.5C66 17 78 28 80 46C81 58 79.5 70 76.5 80Z';
const SOCKEL = '<rect x="27" y="80" width="56" height="7" rx="2.5"/><rect x="22" y="86" width="66" height="8" rx="3"/>';
// Auge, Nuester und Maehnenkerben (dunkel, auf dem Verlauf)
const DETAILS = '<circle cx="41.5" cy="30.5" r="2.7"/><circle cx="22.5" cy="53.5" r="1.5"/>'
  + '<path d="M67 27.5l-5.5 4.2M74.5 39l-6.6 2.6M77.5 52l-7 .8M77.5 65l-7-1" fill="none" stroke-width="2.6" stroke-linecap="round"/>'
  + '<path d="M29.5 81H80.5M25 86.8H85" fill="none" stroke-width="1.4"/>';
// Umriss: x 17..88, y 8.5..94, Mitte:
const MITTE = { x: 52.5, y: 51.25 };

const VERLAUF = [['0', '#19f6e8'], ['.38', '#a06bff'], ['.72', '#ff2d78'], ['1', '#ff8a1e']];
const NACHT = '#070914';

// art: 'rund' (Zweck any, Ecken frei), 'voll' (Apple, ganze Flaeche), 'maskable', 'favicon'
export function iconSvg(art = 'rund') {
  const S = 512;
  const voll = art === 'voll' || art === 'maskable';
  const fav = art === 'favicon';
  const radius = fav ? 112 : 114;
  // Springergroesse: maskable passt in den Kreis der Sicherheitszone (Radius 40 %)
  const skala = art === 'maskable' ? 3.45 : fav ? 4.75 : 3.95;
  const tx = S / 2 - MITTE.x * skala;
  const ty = S / 2 - MITTE.y * skala + (fav ? 2 : 6);
  const stops = VERLAUF.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('');
  const form = `<path d="${KOPF}"/>${SOCKEL}`;
  const flaeche = voll ? `<rect width="${S}" height="${S}" fill="url(#hg)"/>`
    : `<rect width="${S}" height="${S}" rx="${radius}" fill="url(#hg)"/>`;
  const gitter = fav ? '' : `<g mask="url(#gm)" opacity=".24">${
    Array.from({ length: 12 }, (_, i) => `<path d="M0 ${22 + i * 42}H${S}M${22 + i * 42} 0V${S}"/>`).join('')}</g>`;
  // Neon-Rahmen (nicht beim maskable-Icon, das wird beschnitten)
  const rahmen = art === 'maskable' ? '' : fav
    ? `<rect x="14" y="14" width="${S - 28}" height="${S - 28}" rx="${radius - 14}" fill="none" stroke="url(#rg)" stroke-width="16"/>`
    : `<rect x="16" y="16" width="${S - 32}" height="${S - 32}" rx="${radius - 16}" fill="none" stroke="url(#rg)" stroke-width="7" filter="url(#weich)" opacity=".9"/>`
      + `<rect x="16" y="16" width="${S - 32}" height="${S - 32}" rx="${radius - 16}" fill="none" stroke="url(#rg)" stroke-width="4"/>`;
  const glanz = fav ? '' : `<ellipse cx="256" cy="${ty + 92 * skala}" rx="${40 * skala}" ry="${7 * skala}" fill="#a06bff" opacity=".35" filter="url(#weit)"/>`
    + `<g transform="translate(${tx} ${ty}) scale(${skala})" fill="url(#sg)" opacity=".75" filter="url(#schein)">${form}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}">
<defs>
<radialGradient id="hg" cx=".5" cy="0" r="1.15"><stop offset="0" stop-color="#1c2658"/><stop offset=".55" stop-color="#0a0c1a"/><stop offset="1" stop-color="#05060d"/></radialGradient>
<linearGradient id="sg" gradientUnits="userSpaceOnUse" x1="22" y1="14" x2="84" y2="94">${stops}</linearGradient>
<linearGradient id="rg" x1="0" y1="0" x2="1" y2="1">${stops}</linearGradient>
<radialGradient id="gv" cx=".5" cy=".42" r=".55"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
<mask id="gm"><rect width="${S}" height="${S}" fill="url(#gv)"/></mask>
<filter id="schein" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="${(5 / skala).toFixed(2)}"/></filter>
<filter id="weich" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="6"/></filter>
<filter id="weit" x="-50%" y="-200%" width="200%" height="500%"><feGaussianBlur stdDeviation="18"/></filter>
</defs>
${flaeche}
${gitter ? gitter.replace('<g ', '<g stroke="#3a5cff" stroke-width="2" ') : ''}
${rahmen}
${glanz}
<g transform="translate(${tx} ${ty}) scale(${skala})">
<g fill="url(#sg)">${form}</g>
<g fill="${NACHT}" stroke="${NACHT}">${DETAILS}</g>
</g>
</svg>
`;
}

// ---------- PNG ohne Alphakanal (fuer apple-touch-icon) ----------
// Liest ein 8-Bit-RGBA-PNG (wie Chromium es schreibt) und schreibt es als RGB-PNG.
function crc32(buf) {
  let c;
  const tab = crc32.tab || (crc32.tab = Array.from({ length: 256 }, (_, n) => {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  }));
  let crc = 0xffffffff;
  for (const b of buf) crc = tab[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(typ, daten) {
  const laenge = Buffer.alloc(4);
  laenge.writeUInt32BE(daten.length);
  const td = Buffer.concat([Buffer.from(typ, 'ascii'), daten]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([laenge, td, crc]);
}
export function ohneAlpha(png, grund = [7, 9, 20]) {
  let pos = 8;
  let ihdr = null;
  const idat = [];
  while (pos < png.length) {
    const len = png.readUInt32BE(pos);
    const typ = png.toString('ascii', pos + 4, pos + 8);
    const daten = png.subarray(pos + 8, pos + 8 + len);
    if (typ === 'IHDR') ihdr = daten;
    else if (typ === 'IDAT') idat.push(daten);
    pos += 12 + len;
  }
  const w = ihdr.readUInt32BE(0);
  const h = ihdr.readUInt32BE(4);
  const tiefe = ihdr[8];
  const farbtyp = ihdr[9];
  if (tiefe !== 8 || (farbtyp !== 6 && farbtyp !== 2) || ihdr[12] !== 0) throw new Error('PNG-Format nicht unterstuetzt');
  const bpp = farbtyp === 6 ? 4 : 3;
  const roh = inflateSync(Buffer.concat(idat));
  const zeile = w * bpp;
  const pix = Buffer.alloc(h * zeile);
  for (let y = 0; y < h; y++) {
    const f = roh[y * (zeile + 1)];
    const ein = roh.subarray(y * (zeile + 1) + 1, (y + 1) * (zeile + 1));
    const o = y * zeile;
    for (let x = 0; x < zeile; x++) {
      const a = x >= bpp ? pix[o + x - bpp] : 0;
      const b = y > 0 ? pix[o - zeile + x] : 0;
      const c = x >= bpp && y > 0 ? pix[o - zeile + x - bpp] : 0;
      let v = ein[x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a); const pb = Math.abs(p - b); const pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      pix[o + x] = v & 0xff;
    }
  }
  const neu = Buffer.alloc(h * (w * 3 + 1));
  for (let y = 0; y < h; y++) {
    neu[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const i = y * zeile + x * bpp;
      const al = bpp === 4 ? pix[i + 3] / 255 : 1;
      for (let k = 0; k < 3; k++) neu[y * (w * 3 + 1) + 1 + x * 3 + k] = Math.round(pix[i + k] * al + grund[k] * (1 - al));
    }
  }
  const kopf = Buffer.from(ihdr);
  kopf[9] = 2;
  return Buffer.concat([png.subarray(0, 8), chunk('IHDR', kopf), chunk('IDAT', deflateSync(neu, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// ---------- Bauen ----------
function ladePlaywright() {
  const kandidaten = [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean);
  for (const k of kandidaten) {
    try { return require(k); } catch (e) { /* naechster */ }
  }
  throw new Error('Playwright nicht gefunden (PLAYWRIGHT_PFAD setzen)');
}

async function rendere(browser, svg, groesse, durchsichtig) {
  const seite = await browser.newPage({ viewport: { width: groesse, height: groesse }, deviceScaleFactor: 1 });
  const html = `<!doctype html><html><head><style>html,body{margin:0;background:transparent}svg{display:block;width:${groesse}px;height:${groesse}px}</style></head><body>${svg}</body></html>`;
  await seite.setContent(html);
  const png = await seite.screenshot({ clip: { x: 0, y: 0, width: groesse, height: groesse }, omitBackground: durchsichtig });
  await seite.close();
  return png;
}

async function baue() {
  const nurSvg = process.argv.includes('--nur-svg');
  writeFileSync(path.join(ORDNER, 'favicon.svg'), iconSvg('favicon'));
  console.log('favicon.svg');
  if (nurSvg) return;
  const { chromium } = ladePlaywright();
  const browser = await chromium.launch();
  try {
    const ziele = [
      ['icon-192.png', 'rund', 192, true],
      ['icon-512.png', 'rund', 512, true],
      ['icon-maskable-512.png', 'maskable', 512, false],
      ['apple-touch-icon.png', 'voll', 180, false],
    ];
    for (const [datei, art, groesse, durchsichtig] of ziele) {
      let png = await rendere(browser, iconSvg(art), groesse, durchsichtig);
      if (!durchsichtig) png = ohneAlpha(png);
      writeFileSync(path.join(ORDNER, datei), png);
      console.log(`${datei} (${groesse} px)`);
    }
  } finally {
    await browser.close();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await baue();
}
