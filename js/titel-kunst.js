// Titel-Wappen (Flo 01.11.2026: "auch bei den Titeln bessere Designs, Titel auch zu Errungenschaften, nicht nur bei den
// Leveln"): jeder Titel bekommt ein eigenes Wappen, ein Schild mit Verlauf und einem Zeichen. Die Level-Titel erzaehlen
// eine Geschichte vom Funken bis zur Sonne, die Erfolgs-Titel zeigen, wofuer es sie gibt (Sterne, Krone, Welt, Lorbeer,
// Flamme). Ab "legende" rahmt ein Lorbeer das Schild. Eigene Zeichnung, rein (ohne DOM), in Node testbar.
//
//   TITEL_ZEICHEN                          Ids der Zeichen (zeichen-Feld der Titel in js/pakete/sammlung/titel.js)
//   titelWappen(zeichen, { farbe, seltenheit, klasse }) -> SVG   farbe: [oben, unten, rand]; unbekanntes Zeichen: ''

let nr = 0;
const uid = (p) => `tw${p}${++nr}`;
const TINTE = '#1B1530';
const CREME = '#FFF6E0';
const GOLD = '#FFD54F';
const GOLD_TIEF = '#E0A21B';
const ROT = '#E2412F';

const flamme = (x, y, s, innen = GOLD, aussen = '#FF7A2E') => `<path d="M${x} ${y - 16 * s}c${7 * s} ${7 * s} ${11 * s} ${12 * s} ${11 * s} ${18 * s}`
  + `a${11 * s} ${11 * s} 0 0 1-${22 * s} 0c0-${4 * s} ${2 * s}-${8 * s} ${5 * s}-${11 * s}c0 ${4 * s} ${2 * s} ${6 * s} ${4 * s} ${6 * s}c0-${5 * s} ${1 * s}-${9 * s} ${2 * s}-${13 * s}z"`
  + ` fill="${aussen}" stroke="${TINTE}" stroke-width="2" stroke-linejoin="round"/>`
  + `<path d="M${x} ${y - 5 * s}c${3 * s} ${3 * s} ${5 * s} ${5 * s} ${5 * s} ${8 * s}a${5 * s} ${5 * s} 0 0 1-${10 * s} 0c0-${3 * s} ${2 * s}-${5 * s} ${5 * s}-${8 * s}z" fill="${innen}"/>`;
const stern = (x, y, r, zacken = 5, farbe = GOLD, innen = .45) => {
  const p = [];
  for (let i = 0; i < zacken * 2; i++) {
    const w = (Math.PI * i) / zacken - Math.PI / 2;
    const rr = i % 2 ? r * innen : r;
    p.push(`${(x + Math.cos(w) * rr).toFixed(1)} ${(y + Math.sin(w) * rr).toFixed(1)}`);
  }
  return `<path d="M${p.join('L')}z" fill="${farbe}" stroke="${TINTE}" stroke-width="2" stroke-linejoin="round"/>`;
};
const funke = (x, y, s, farbe = CREME) => `<path d="M${x} ${y - s}Q${x + s * .2} ${y - s * .2} ${x + s} ${y}Q${x + s * .2} ${y + s * .2} ${x} ${y + s}`
  + `Q${x - s * .2} ${y + s * .2} ${x - s} ${y}Q${x - s * .2} ${y - s * .2} ${x} ${y - s}z" fill="${farbe}"/>`;
const krone = (x, y, s) => `<path d="M${x - 14 * s} ${y + 8 * s}l-3 ${-17 * s} ${8 * s} ${6 * s} ${9 * s} ${-12 * s} ${9 * s} ${12 * s} ${8 * s} ${-6 * s} -3 ${17 * s}z"`
  + ` fill="${GOLD}" stroke="${TINTE}" stroke-width="2" stroke-linejoin="round"/><path d="M${x - 14 * s} ${y + 8 * s}h${28 * s}v${5 * s}h-${28 * s}z" fill="${GOLD_TIEF}" stroke="${TINTE}" stroke-width="2" stroke-linejoin="round"/>`
  + `<circle cx="${x}" cy="${y + 3 * s}" r="${2.6 * s}" fill="${ROT}"/>`;
const holz = (x, y) => `<g stroke="${TINTE}" stroke-width="2" stroke-linejoin="round"><rect x="${x - 15}" y="${y + 4}" width="30" height="6" rx="3" fill="#A86B3C" transform="rotate(14 ${x} ${y + 7})"/>`
  + `<rect x="${x - 15}" y="${y + 4}" width="30" height="6" rx="3" fill="#8A5530" transform="rotate(-14 ${x} ${y + 7})"/></g>`;
const lorbeerAst = (seite) => {
  const s = seite;
  let blaetter = '';
  for (let i = 0; i < 5; i++) {
    const y = 74 - i * 11;
    const x = 48 + s * (36 - i * 1.5);
    blaetter += `<ellipse cx="${x}" cy="${y}" rx="3.2" ry="6.4" transform="rotate(${s * (35 - i * 4)} ${x} ${y})" fill="#7BC46A" stroke="#2F6B2A" stroke-width="1.4"/>`;
  }
  return blaetter;
};

// Lorbeerkranz im Schild (Liga): Blaetter auf einem Kreis um die Mitte, links und rechts gespiegelt
const kranz = (cx = 48, cy = 50, r = 21) => {
  let b = '';
  for (const seite of [-1, 1]) {
    for (let i = 0; i < 6; i++) {
      // von unten (knapp neben der Mitte) bis seitlich oben, Blaetter entlang der Bahn
      const grad = 90 - seite * (18 + i * 27);
      const w = grad * Math.PI / 180;
      const x = cx + Math.cos(w) * r;
      const y = cy + Math.sin(w) * r;
      b += `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="2.7" ry="6" transform="rotate(${(grad + seite * 20).toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})" fill="${GOLD}" stroke="${TINTE}" stroke-width="1.3"/>`;
    }
  }
  return `<path d="M${cx - 6} ${cy + r + 2}q6-4 12 0" fill="none" stroke="${GOLD_TIEF}" stroke-width="2.4" stroke-linecap="round"/>${b}`;
};

const ZEICHEN = {
  // Level-Geschichte: Funke, Glut, Fackel, Feuer ... Leuchtturm, Sterne, Sonne
  funke: () => `${flamme(48, 56, .78)}${funke(34, 30, 4.4)}${funke(62, 34, 3.2)}`,
  glut: () => `<path d="M30 58c-3-10 6-20 18-20s21 10 18 20c-2 6-10 9-18 9s-16-3-18-9z" fill="#5A1E14" stroke="${TINTE}" stroke-width="2"/>`
    + `<path d="M37 52l6 4 4-7 6 6 5-3" fill="none" stroke="#FF8A3D" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>${funke(48, 30, 3.6, GOLD)}`,
  fackel: () => `<rect x="44.5" y="44" width="7" height="28" rx="2" fill="#8A5530" stroke="${TINTE}" stroke-width="2" transform="rotate(12 48 58)"/>`
    + `<path d="M40 44h16l-2 6H42z" fill="#B0B6C2" stroke="${TINTE}" stroke-width="2" stroke-linejoin="round"/>${flamme(48, 42, .7)}`,
  fackeltraeger: () => `${ZEICHEN.fackel()}${funke(30, 30, 3.4)}${funke(66, 30, 3.4)}`,
  lagerfeuer: () => `${holz(48, 58)}${flamme(48, 56, .9)}`,
  kaminfeuer: () => `<path d="M26 72V40a22 20 0 0 1 44 0v32" fill="#6B3A2A" stroke="${TINTE}" stroke-width="2"/><path d="M33 72V44a15 13 0 0 1 30 0v28" fill="#2A1712"/>`
    + `${flamme(48, 66, .72)}`,
  esse: () => `<path d="M28 60h40l-6 8H34z" fill="#5E6675" stroke="${TINTE}" stroke-width="2" stroke-linejoin="round"/><path d="M34 52h28v8H34z" fill="#7C8596" stroke="${TINTE}" stroke-width="2"/>`
    + `${flamme(48, 48, .66, '#FFE58A', '#FF5A2E')}${funke(30, 32, 3)}${funke(66, 28, 3.6)}`,
  leuchtfeuer: () => `<path d="M42 72l3-20h6l3 20z" fill="#7C8596" stroke="${TINTE}" stroke-width="2" stroke-linejoin="round"/><path d="M34 52h28l-4-6H38z" fill="#5E6675" stroke="${TINTE}" stroke-width="2" stroke-linejoin="round"/>`
    + `${flamme(48, 44, .95)}`,
  sonnwendfeuer: () => `<circle cx="48" cy="40" r="17" fill="#FFE07A" opacity=".55"/>${holz(48, 60)}${flamme(40, 60, .62)}${flamme(56, 60, .62)}${flamme(48, 58, .9)}`,
  leuchtturm: () => `<path d="M24 34l16 6v6zM72 34l-16 6v6z" fill="#FFF3B0" opacity=".85"/><path d="M41 74l3-30h8l3 30z" fill="${CREME}" stroke="${TINTE}" stroke-width="2" stroke-linejoin="round"/>`
    + `<path d="M43 56h10M42 66h12" stroke="${ROT}" stroke-width="4"/><path d="M42 44h12l-2-8h-8z" fill="${GOLD}" stroke="${TINTE}" stroke-width="2" stroke-linejoin="round"/><path d="M42 36h12l-6-6z" fill="${ROT}" stroke="${TINTE}" stroke-width="2" stroke-linejoin="round"/>`,
  morgenstern: () => `${stern(48, 50, 20, 8, '#FFF1B8', .5)}${funke(70, 30, 3.4)}${funke(28, 70, 3)}`,
  komet: () => `<path d="M28 70L52 44" stroke="#BFE3FF" stroke-width="9" stroke-linecap="round" opacity=".5"/><path d="M34 72L54 50" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round" opacity=".8"/>`
    + `${stern(56, 42, 13, 5, '#FFF1B8')}`,
  polarlicht: () => `<path d="M24 60c8-14 16-14 24-6s16 8 24-8" fill="none" stroke="#6CF2B8" stroke-width="6" stroke-linecap="round" opacity=".9"/>`
    + `<path d="M24 48c8-12 16-12 24-5s16 6 24-8" fill="none" stroke="#9A7CFF" stroke-width="5" stroke-linecap="round" opacity=".85"/>${funke(34, 30, 3)}${funke(62, 28, 2.6)}${funke(50, 70, 2.4)}`,
  sonne: () => {
    let strahlen = '';
    for (let i = 0; i < 12; i++) {
      const w = (i * 30) * Math.PI / 180;
      strahlen += `<path d="M${(48 + Math.cos(w) * 17).toFixed(1)} ${(50 + Math.sin(w) * 17).toFixed(1)}L${(48 + Math.cos(w) * 25).toFixed(1)} ${(50 + Math.sin(w) * 25).toFixed(1)}"/>`;
    }
    return `<g stroke="${GOLD}" stroke-width="4" stroke-linecap="round">${strahlen}</g><circle cx="48" cy="50" r="13" fill="${GOLD}" stroke="${TINTE}" stroke-width="2"/>`
      + `<circle cx="44" cy="46" r="4" fill="#FFF6C8"/>`;
  },
  // Erfolge
  sieg: () => `<path d="M48 30a6 6 0 0 1 3.7 10.7c3.4 2.1 5.3 5.2 5.3 8.9 0 2.6-1 5-2.8 6.7l2 7.1H39.8l2-7.1A9.4 9.4 0 0 1 39 49.6c0-3.7 1.9-6.8 5.3-8.9A6 6 0 0 1 48 30z" fill="${CREME}" stroke="${TINTE}" stroke-width="2" stroke-linejoin="round"/>`
    + `<rect x="36" y="63" width="24" height="6" rx="3" fill="${CREME}" stroke="${TINTE}" stroke-width="2"/><path d="M58 24v22" stroke="${TINTE}" stroke-width="2.4" stroke-linecap="round"/><path d="M58 25h12l-3 4 3 4H58z" fill="${ROT}" stroke="${TINTE}" stroke-width="2" stroke-linejoin="round"/>`,
  sterne: () => `${stern(32, 54, 10)}${stern(48, 42, 13)}${stern(64, 54, 10)}`,
  krone: () => `${krone(48, 50, 1.25)}${funke(30, 30, 3)}${funke(68, 30, 3)}`,
  sternenkrone: () => `${krone(48, 60, 1)}${stern(48, 36, 12, 5, '#FFF1B8')}`,
  'welt-1': () => `<g stroke="${TINTE}" stroke-width="2"><path d="M30 40h18v14H30z" fill="#F4E7B8"/><path d="M48 40h18v14H48z" fill="#8CB86A"/><path d="M30 54h18v14H30z" fill="#8CB86A"/><path d="M48 54h18v14H48z" fill="#F4E7B8"/></g>`
    + `<path d="M48 22v16M44 26l4 4 4-4M44 32l4 4 4-4" fill="none" stroke="${GOLD_TIEF}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`,
  'welt-2': () => `<path d="M48 22l14 18h-7l10 13h-8l9 12H34l9-12h-8l10-13h-7z" fill="#4E9A54" stroke="${TINTE}" stroke-width="2" stroke-linejoin="round"/><rect x="45" y="65" width="6" height="8" fill="#8A5530" stroke="${TINTE}" stroke-width="2"/>`,
  'welt-3': () => `<path d="M36 72V44h-3v-12h6v5h5v-5h8v5h5v-5h6v12h-3v28z" fill="#B7BFCC" stroke="${TINTE}" stroke-width="2" stroke-linejoin="round"/><path d="M45 72V60a3 3 0 0 1 6 0v12" fill="#4A5160"/>`
    + `<path d="M48 22v8" stroke="${TINTE}" stroke-width="2"/><path d="M48 22h9l-2 3 2 3h-9z" fill="${ROT}" stroke="${TINTE}" stroke-width="1.6" stroke-linejoin="round"/>`,
  'welt-4': () => `<path d="M24 56c6-10 14-10 18-2 4-8 12-8 16 0 4-8 12-8 14 2v14H24z" fill="#3E8DA8" stroke="${TINTE}" stroke-width="2" stroke-linejoin="round"/>`
    + `<path d="M28 46c5-9 14-12 22-6-5 0-8 3-8 8" fill="none" stroke="${CREME}" stroke-width="4" stroke-linecap="round"/><circle cx="64" cy="34" r="7" fill="${GOLD}" stroke="${TINTE}" stroke-width="2"/>`,
  'welt-5': () => `<path d="M26 52c8-12 24-14 34-4l10-8v24l-10-8c-10 10-26 8-34-4z" fill="#5FD3A6" stroke="${TINTE}" stroke-width="2" stroke-linejoin="round"/>`
    + `<circle cx="38" cy="50" r="2.6" fill="${TINTE}"/><circle cx="52" cy="30" r="3" fill="none" stroke="${CREME}" stroke-width="1.6"/><circle cx="60" cy="24" r="2" fill="none" stroke="${CREME}" stroke-width="1.4"/>`,
  lorbeer: () => `${kranz()}${stern(48, 50, 12, 5, GOLD)}`,
  ligakrone: () => `${krone(48, 54, 1.2)}${funke(30, 34, 3.4, GOLD)}${funke(66, 34, 3.4, GOLD)}`,
  serie: (n) => `${flamme(48, 54, 1.05, '#FFE58A', '#FF6A2E')}<rect x="${n >= 100 ? 33 : 36}" y="58" width="${n >= 100 ? 30 : 24}" height="16" rx="8" fill="${CREME}" stroke="${TINTE}" stroke-width="2"/>`
    + `<text x="48" y="70.5" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="900" font-size="12.5" fill="${TINTE}">${n}</text>`,
  // Koennen (Flo 01.11.2026: "bessere Titel, denk dir was aus")
  blitz: () => `<path d="M52 20L34 52h12l-6 24 22-34H50l8-22z" fill="${GOLD}" stroke="${TINTE}" stroke-width="2.2" stroke-linejoin="round"/>${funke(66, 58, 3.4)}${funke(30, 30, 2.8)}`,
  sanduhr: () => `<path d="M34 24h28M34 76h28" stroke="#8A5530" stroke-width="5" stroke-linecap="round"/><path d="M37 27h22c0 12-8 15-8 23s8 11 8 23H37c0-12 8-15 8-23s-8-11-8-23z" fill="${CREME}" stroke="${TINTE}" stroke-width="2" stroke-linejoin="round"/>`
    + `<path d="M41 33h14c-1 6-7 9-7 13-0-4-6-7-7-13zM40 70c2-6 8-8 8-12 0 4 6 6 8 12z" fill="${GOLD}"/>`,
  diamant: () => `<path d="M30 40l8-12h20l8 12-18 30z" fill="#BFF0FF" stroke="${TINTE}" stroke-width="2.2" stroke-linejoin="round"/><path d="M30 40h36M38 28l10 42 10-42M44 28l4 12 4-12" fill="none" stroke="${TINTE}" stroke-width="1.4" stroke-linejoin="round" opacity=".6"/>`
    + `${funke(66, 26, 4)}${funke(30, 64, 3)}`,
  berg: () => `<path d="M20 72l20-32 8 10 10-18 18 40z" fill="#8C97AB" stroke="${TINTE}" stroke-width="2.2" stroke-linejoin="round"/><path d="M40 40l-5 8 5-2 4 4zM58 32l-5 9 5-3 5 4z" fill="${CREME}"/>`
    + `<path d="M58 32V18" stroke="${TINTE}" stroke-width="2"/><path d="M58 18h11l-3 4 3 4H58z" fill="${ROT}" stroke="${TINTE}" stroke-width="1.6" stroke-linejoin="round"/>`,
  stammgast: () => `<path d="M30 74V44l18-14 18 14v30z" fill="#C9A06A" stroke="${TINTE}" stroke-width="2.2" stroke-linejoin="round"/><path d="M42 74V58a6 6 0 0 1 12 0v16" fill="#5A3A22" stroke="${TINTE}" stroke-width="2"/>`
    + `<rect x="34" y="48" width="7" height="7" rx="1.4" fill="${GOLD}" stroke="${TINTE}" stroke-width="1.4"/><rect x="55" y="48" width="7" height="7" rx="1.4" fill="${GOLD}" stroke="${TINTE}" stroke-width="1.4"/>`
    + `<text x="48" y="44" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="900" font-size="9" fill="${TINTE}">100</text>`,
  waage: () => `<path d="M48 26v42M34 72h28" stroke="${TINTE}" stroke-width="2.6" stroke-linecap="round"/><path d="M28 34h40" stroke="${TINTE}" stroke-width="2.6" stroke-linecap="round"/>`
    + `<path d="M28 34l-8 16h16zM68 34l-8 16h16z" fill="none" stroke="${TINTE}" stroke-width="1.6" stroke-linejoin="round"/><path d="M19 50a9 5 0 0 0 18 0zM59 50a9 5 0 0 0 18 0z" fill="${GOLD}" stroke="${TINTE}" stroke-width="1.8"/>`
    + `<circle cx="48" cy="26" r="3.4" fill="${GOLD}" stroke="${TINTE}" stroke-width="1.6"/>`,
  // Pionier (die ersten 100 Konten): Fahne auf dem Gipfel, Stern daneben
  pionier: () => `<path d="M22 74c8-16 16-24 26-24s18 8 26 24z" fill="#5E8C5A" stroke="${TINTE}" stroke-width="2.2" stroke-linejoin="round"/><path d="M46 52V22" stroke="${TINTE}" stroke-width="2.6" stroke-linecap="round"/>`
    + `<path d="M46 23h20l-4 6 4 6H46z" fill="${GOLD}" stroke="${TINTE}" stroke-width="2" stroke-linejoin="round"/>${stern(30, 34, 7, 5, CREME)}${funke(70, 48, 3)}`,
  erfinder: () => `<circle cx="48" cy="50" r="15" fill="none" stroke="${GOLD}" stroke-width="6" stroke-dasharray="5 4.4"/><circle cx="48" cy="50" r="10" fill="#2A2F3A" stroke="${GOLD}" stroke-width="2"/>`
    + `${krone(48, 47, .55)}${funke(70, 28, 3.6, GOLD)}`,
  // Neue Errungenschaften (Flo 01.11.2026): Banner (100 Siege), Mond mit Koenig (Sieg mit Schwarz), Pfeile (Siegesfolge),
  // Schwert (Endgegner), drei Kronen (alle Endgegner), Feder (Meisterschule), Buch mit Sternen (alle Sterne der Schule)
  banner: () => `<path d="M34 22V76" stroke="${TINTE}" stroke-width="2.6" stroke-linecap="round"/><path d="M34 24h32l-6 10 6 10H34z" fill="${ROT}" stroke="${TINTE}" stroke-width="2" stroke-linejoin="round"/>`
    + `${stern(48, 34, 5.5, 5, GOLD)}<circle cx="34" cy="21" r="3" fill="${GOLD}" stroke="${TINTE}" stroke-width="1.6"/>${funke(66, 60, 3.4)}`,
  mond: () => `<path d="M62 24a24 24 0 1 0 6 38a19 19 0 1 1-6-38z" fill="${CREME}" stroke="${TINTE}" stroke-width="2" stroke-linejoin="round" opacity=".9"/>`
    + `<path d="M46 28h4v4h4v4h-4v4h-4v-4h-4v-4h4z M40 44h16l-1 5c3 4 4 10 4 16H37c0-6 1-12 4-16zM36 66h24v5H36z" fill="${TINTE}" stroke="${CREME}" stroke-width="1.4" stroke-linejoin="round"/>`
    + `${funke(70, 30, 3)}`,
  pfeile: () => [0, 1, 2].map((i) => `<path d="M30 ${70 - i * 14}l18-12 18 12" fill="none" stroke="${i === 2 ? GOLD : CREME}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`).join('')
    + `<path d="M30 ${70 - 2 * 14}l18-12 18 12" fill="none" stroke="${TINTE}" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" opacity=".5"/>${funke(70, 24, 3)}`,
  schwert: () => `<path d="M48 18l4 7v35h-8V25z" fill="#E6EAF0" stroke="${TINTE}" stroke-width="2" stroke-linejoin="round"/><path d="M36 60h24v5H36z" fill="${GOLD}" stroke="${TINTE}" stroke-width="2" stroke-linejoin="round"/>`
    + `<path d="M45.5 65h5v9h-5z" fill="#8A5530" stroke="${TINTE}" stroke-width="1.8"/><circle cx="48" cy="76.5" r="3" fill="${GOLD}" stroke="${TINTE}" stroke-width="1.6"/>${funke(66, 34, 3.2)}`,
  kronen: () => `${krone(30, 34, .55)}${krone(66, 34, .55)}${krone(48, 54, .8)}${funke(48, 24, 3.4)}`,
  feder: () => `<path d="M68 18C52 20 38 32 33 50c-2 8-2 16 0 24 5-10 13-15 20-23 9-10 15-20 15-33z" fill="${GOLD}" stroke="${TINTE}" stroke-width="2" stroke-linejoin="round"/>`
    + `<path d="M66 21Q48 46 33 76" fill="none" stroke="${TINTE}" stroke-width="1.6" stroke-linecap="round"/><path d="M33 76l-3 6" stroke="${TINTE}" stroke-width="2.4" stroke-linecap="round"/>${funke(68, 58, 3.2)}`,
  buch: () => `<path d="M22 46c9-4 17-4 25 2v26c-8-5-16-6-25-2z M74 46c-9-4-17-4-25 2v26c8-5 16-6 25-2z" fill="${CREME}" stroke="${TINTE}" stroke-width="2" stroke-linejoin="round"/>`
    + `${stern(32, 32, 5, 5, GOLD)}${stern(48, 25, 7, 5, GOLD)}${stern(64, 32, 5, 5, GOLD)}`,
};
export const TITEL_ZEICHEN = Object.freeze(Object.keys(ZEICHEN));

export function titelWappen(zeichen, { farbe = ['#FF9A5A', '#B5381E', '#7A2412'], seltenheit = 'frei', klasse = '', n = 0 } = {}) {
  const art = String(zeichen || '');
  const z = ZEICHEN[art];
  if (!z) return '';
  const g = uid('g');
  const legende = seltenheit === 'legende' || seltenheit === 'einzig';
  const rand = legende ? GOLD : farbe[2];
  return `<svg class="titel-wappen${klasse ? ' ' + klasse : ''}" data-zeichen="${art}" data-seltenheit="${seltenheit}" viewBox="0 0 96 96" aria-hidden="true" focusable="false">`
    + `<defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${farbe[0]}"/><stop offset="1" stop-color="${farbe[1]}"/></linearGradient></defs>`
    + (legende ? `<g class="tw-lorbeer">${lorbeerAst(-1)}${lorbeerAst(1)}</g>` : '')
    + `<path d="M48 8l32 10v26c0 22-15 37-32 45C31 81 16 66 16 44V18z" fill="url(#${g})" stroke="${rand}" stroke-width="${legende ? 4 : 3}" stroke-linejoin="round"/>`
    + `<path d="M48 15l25 8v21c0 18-12 30-25 37-13-7-25-19-25-37V23z" fill="none" stroke="#FFFFFF" stroke-width="1.4" opacity=".28"/>`
    + `<path d="M22 22l26-8v66C33 72 22 60 22 44z" fill="#FFFFFF" opacity=".08"/>`
    + `<g class="tw-zeichen">${z(n)}</g></svg>`;
}
