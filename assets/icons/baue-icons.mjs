// Baut die App-Icons von Crownmate: das Premium-Wappen (Krone auf Scheibe mit Strahlenkranz) auf dunklem Grund.
// Schreibt favicon.svg und rendert per Playwright (Chromium) die PNGs:
//   icon-192.png, icon-512.png          Zweck "any": volle Flaeche, ohne Alphakanal (keine hellen Ecken)
//   icon-maskable-512.png               Zweck "maskable": volle Flaeche, Wappen in der Sicherheitszone
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
// Das Wappen der Premium-Seite (emblem() in js/ui/premium.js) im 120er-Raster, Farben fest aus dem dunklen Design
const GOLD = '#F2BE4A';
const BAND = '#F2C96D';   // --gold 78 % mit --text gemischt
const SCHEIBE = '#403A2C';   // --gold 16 % mit --flaeche gemischt
const FLAECHE = '#1E2126';
const AKZENT = '#C8441E';
const GRUND = '#15171B';

const funkel = (x, y, s) => `<path fill="${GOLD}" d="M${x} ${y - s}C${x + s * .18} ${y - s * .18} ${x + s * .18} ${y - s * .18} ${x + s} ${y}`
  + `C${x + s * .18} ${y + s * .18} ${x + s * .18} ${y + s * .18} ${x} ${y + s}C${x - s * .18} ${y + s * .18} ${x - s * .18} ${y + s * .18} ${x - s} ${y}`
  + `C${x - s * .18} ${y - s * .18} ${x - s * .18} ${y - s * .18} ${x} ${y - s}z"/>`;

function wappen(fein) {
  const strahlen = Array.from({ length: 16 }, (_, i) => {
    const w = (i * 22.5) * Math.PI / 180;
    const [x1, y1, x2, y2] = [60 + Math.cos(w) * 44, 60 + Math.sin(w) * 44, 60 + Math.cos(w) * 57, 60 + Math.sin(w) * 57];
    return `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}"/>`;
  }).join('');
  return `${fein ? `<g stroke="${GOLD}" stroke-width="2.4" stroke-linecap="round" opacity=".5">${strahlen}</g>` : ''}
<circle cx="60" cy="60" r="40" fill="${SCHEIBE}" stroke="${GOLD}" stroke-width="2.2"/>
${fein ? `<circle cx="60" cy="60" r="35" fill="none" stroke="${GOLD}" stroke-width="1.2" stroke-dasharray="1.5 3.2" opacity=".7"/>` : ''}
<path d="M37 74 33 47l13.5 11L60 38l13.5 20L87 47l-4 27z" fill="${GOLD}" stroke="${GOLD}" stroke-width="2.4" stroke-linejoin="round"/>
<path d="M37.5 74h45v7.5h-45z" fill="${BAND}"/>
<circle cx="60" cy="63" r="4.2" fill="${FLAECHE}" stroke="${AKZENT}" stroke-width="2.6"/>
<circle cx="46" cy="66" r="2.6" fill="${AKZENT}"/><circle cx="74" cy="66" r="2.6" fill="${AKZENT}"/>
<circle cx="33" cy="46" r="3" fill="${GOLD}"/><circle cx="60" cy="37" r="3.4" fill="${GOLD}"/><circle cx="87" cy="46" r="3" fill="${GOLD}"/>
${fein ? `${funkel(16.8, 31.1, 7)}${funkel(88.9, 16.8, 5)}${funkel(103.2, 88.9, 6)}` : ''}`;   // Funken je mittig zwischen zwei Strahlen
}

// art: 'voll' (Zweck any und Apple, ganze Flaeche), 'maskable', 'favicon' (Ecken frei)
export function iconSvg(art = 'voll') {
  const S = 512;
  const fav = art === 'favicon';
  // maskable: alles bleibt im Kreis der Sicherheitszone (Radius 40 %); Favicon: nur Scheibe und Krone, gross
  const skala = art === 'maskable' ? 3.4 : fav ? 6 : 4;
  const versatz = S / 2 - 60 * skala;
  const flaeche = `<rect width="${S}" height="${S}"${fav ? ' rx="112"' : ''} fill="${GRUND}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}">
${flaeche}
<g transform="translate(${versatz} ${versatz}) scale(${skala})">
${wappen(!fav)}
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
      ['icon-192.png', 'voll', 192, false],
      ['icon-512.png', 'voll', 512, false],
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
